package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"os"
	"sync"
	"time"
)

type Agent struct {
	ID              string   `json:"id"`
	ModelRef        string   `json:"model_ref"`
	Device          string   `json:"device"`
	Backend         string   `json:"backend"` // auto, llama, opencode
	URL             string   `json:"url"`
	Role            string   `json:"role"`
	ThrottleMs      int      `json:"throttle_ms"`
	CloudThrottleMs int      `json:"cloud_throttle_ms"`
	FallbackModels  []string `json:"fallback_models"`
}

type Squad struct {
	Pattern           string  `json:"pattern"`
	ChatTimeoutMin    int     `json:"chat_timeout_minutes"`
	DefaultBackend    string  `json:"default_backend"`
	Agents            []Agent `json:"agents"`
	MaxRounds         int     `json:"max_rounds"`
}

type Granja struct {
	Version string           `json:"version"`
	Squads  map[string]Squad `json:"squads"`
	Global  struct {
		ThrottleLocal int `json:"throttle_local_ms"`
		ThrottleCloud int `json:"throttle_cloud_ms"`
	} `json:"global"`
}

// Circuit breaker
type CB struct {
	DeadUntil time.Time
	Failures  int
}
var (
	breakers   = map[string]CB{}
	breakersMu sync.Mutex
)

func isDead(provider string) bool {
	breakersMu.Lock()
	defer breakersMu.Unlock()
	cb, ok := breakers[provider]
	if !ok { return false }
	if time.Now().After(cb.DeadUntil) {
		delete(breakers, provider)
		return false
	}
	return true
}

func markDead(provider string) {
	breakersMu.Lock()
	defer breakersMu.Unlock()
	cb := breakers[provider]
	cb.Failures++
	cooldown := time.Duration(5*cb.Failures) * time.Minute
	if cooldown > 25*time.Minute { cooldown = 25 * time.Minute }
	cb.DeadUntil = time.Now().Add(cooldown)
	breakers[provider] = cb
	fmt.Printf("[circuit] %s dead until %v (failures %d)\n", provider, cb.DeadUntil, cb.Failures)
}

func sleep(ms int) {
	jitter := rand.Intn(1000)
	time.Sleep(time.Duration(ms+jitter) * time.Millisecond)
}

func callLlama(url, model, prompt, systemPrompt string) (string, error) {
	// Llama.cpp OpenAI compatible /v1/chat/completions
	body := map[string]interface{}{
		"model": model,
		"messages": []map[string]string{
			{"role": "system", "content": systemPrompt},
			{"role": "user", "content": prompt},
		},
		"stream": false,
	}
	b, _ := json.Marshal(body)
	resp, err := http.Post(url+"/v1/chat/completions", "application/json", bytes.NewReader(b))
	if err != nil { return "", err }
	defer resp.Body.Close()
	if resp.StatusCode == 429 { return "", fmt.Errorf("429 rate limited") }
	data, _ := io.ReadAll(resp.Body)
	var j map[string]interface{}
	json.Unmarshal(data, &j)
	if choices, ok := j["choices"].([]interface{}); ok && len(choices) > 0 {
		if m, ok := choices[0].(map[string]interface{})["message"].(map[string]interface{}); ok {
			if c, ok := m["content"].(string); ok { return c, nil }
		}
	}
	return string(data), nil
}

func callOpenCode(prompt, systemPrompt, model string) (string, error) {
	// OpenCode Zen endpoint - local opencode binary exposes http or we call via OpenRouter
	// For this minimal version, we call OpenRouter compatible
	endpoint := os.Getenv("OPENCODE_ENDPOINT")
	if endpoint == "" { endpoint = "http://localhost:20128/v1/chat/completions" }
	body := map[string]interface{}{
		"model": model,
		"messages": []map[string]string{
			{"role": "system", "content": systemPrompt},
			{"role": "user", "content": prompt},
		},
		"stream": false,
	}
	b, _ := json.Marshal(body)
	req, _ := http.NewRequest("POST", endpoint, bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "opencode/1.18.16")
	resp, err := http.DefaultClient.Do(req)
	if err != nil { return "", err }
	defer resp.Body.Close()
	if resp.StatusCode == 429 { return "", fmt.Errorf("429 rate limited") }
	data, _ := io.ReadAll(resp.Body)
	var j map[string]interface{}
	json.Unmarshal(data, &j)
	if choices, ok := j["choices"].([]interface{}); ok && len(choices) > 0 {
		if m, ok := choices[0].(map[string]interface{})["message"].(map[string]interface{}); ok {
			if c, ok := m["content"].(string); ok { return c, nil }
		}
	}
	return string(data), nil
}

func throttledCall(agent Agent, prompt string) (string, error) {
	tryLocal := agent.Backend == "auto" || agent.Backend == "llama"
	if tryLocal && agent.URL != "" {
		sleep(agent.ThrottleMs)
		res, err := callLlama(agent.URL, agent.ModelRef, prompt, fmt.Sprintf("Sos %s del enjambre Alcon", agent.Role))
		if err == nil { return res, nil }
		fmt.Printf("[hybrid] %s local fail: %v, trying cloud\n", agent.Device, err)
		sleep(agent.CloudThrottleMs)
		for _, cm := range agent.FallbackModels {
			if !containsPrefix(cm, "opencode/") { continue }
			if isDead(cm) { continue }
			r, err := callOpenCode(prompt, fmt.Sprintf("Sos %s", agent.Role), cm)
			if err == nil { return r, nil }
			if contains(err.Error(), "429") { markDead(cm); sleep(5000); continue }
			return "", err
		}
		return "", fmt.Errorf("all cloud fallbacks dead")
	}

	// opencode direct
	sleep(agent.ThrottleMs)
	for _, m := range agent.FallbackModels {
		if m == "" { m = agent.ModelRef }
		if isDead(m) { continue }
		r, err := callOpenCode(prompt, fmt.Sprintf("Sos %s", agent.Role), m)
		if err == nil { return r, nil }
		if contains(err.Error(), "429") { markDead(m); sleep(5000); continue }
		return "", err
	}
	return "", fmt.Errorf("all providers dead")
}

func contains(s, sub string) bool { return len(s) >= len(sub) && (func() bool { for i := 0; i <= len(s)-len(sub); i++ { if s[i:i+len(sub)] == sub { return true } } return false })() }
func containsPrefix(s, pre string) bool { return len(s) >= len(pre) && s[:len(pre)] == pre }

type Result struct {
	Device   string `json:"device"`
	Model    string `json:"model"`
	Role     string `json:"role"`
	Response string `json:"response"`
	Ok       bool   `json:"ok"`
}

func fanOut(squad Squad, prompt string) []Result {
	var wg sync.WaitGroup
	results := make([]Result, 0)
	mu := sync.Mutex{}

	localAgents := []Agent{}
	cloudAgents := []Agent{}
	for _, a := range squad.Agents {
		if a.Backend == "auto" || a.Backend == "llama" { localAgents = append(localAgents, a) } else { cloudAgents = append(cloudAgents, a) }
	}

	// locales en paralelo (goroutines)
	for _, agent := range localAgents {
		wg.Add(1)
		go func(ag Agent) {
			defer wg.Done()
			r, err := throttledCall(ag, prompt)
			res := Result{Device: ag.Device, Model: ag.ModelRef, Role: ag.Role, Response: r, Ok: err == nil}
			if err != nil { res.Response = err.Error() }
			mu.Lock()
			results = append(results, res)
			mu.Unlock()
		}(agent)
	}
	wg.Wait()

	// nube secuencial con throttle anti-ban
	for _, ag := range cloudAgents {
		r, err := throttledCall(ag, prompt)
		res := Result{Device: ag.Device, Model: ag.ModelRef, Role: ag.Role, Response: r, Ok: err == nil}
		if err != nil { res.Response = err.Error() }
		results = append(results, res)
	}

	return results
}

func main() {
	if len(os.Args) < 3 {
		fmt.Println("usage: orchestrator-go <squad> <prompt> [--local|--cloud|--auto] [--device=debian,kali]")
		fmt.Println("example: ./orchestrator-go code-audit \"revisa server.js\" --auto")
		os.Exit(1)
	}
	squadName := os.Args[1]
	prompt := os.Args[2]

	// parse overrides
	backendOverride := ""
	deviceFilter := map[string]bool{}
	cleanPrompt := prompt
	for _, arg := range os.Args[3:] {
		if arg == "--local" { backendOverride = "llama"; }
		if arg == "--cloud" { backendOverride = "opencode"; }
		if arg == "--auto" { backendOverride = "auto"; }
		if len(arg) > 9 && arg[:9] == "--device=" {
			cleanPrompt = prompt
			for _, d := range split(arg[9:], ",") { deviceFilter[d] = true }
		}
	}
	if backendOverride != "" {
		// clean prompt already
	}

	// load granja.json
	data, err := os.ReadFile("granja.json")
	if err != nil { data, err = os.ReadFile("server/lib/granja.json") }
	if err != nil { fmt.Printf("no granja.json: %v\n", err); os.Exit(1) }
	var granja Granja
	json.Unmarshal(data, &granja)

	squad, ok := granja.Squads[squadName]
	if !ok { fmt.Printf("squad %s not found\n", squadName); os.Exit(1) }

	// apply overrides
	if len(deviceFilter) > 0 {
		filtered := []Agent{}
		for _, a := range squad.Agents {
			if deviceFilter[a.Device] { filtered = append(filtered, a) }
		}
		squad.Agents = filtered
	}
	if backendOverride != "" {
		for i := range squad.Agents {
			squad.Agents[i].Backend = backendOverride
		}
	}

	fmt.Printf("=== Alcon v4.1 Go | Squad: %s | Agents: %d | Prompt: %s ===\n", squadName, len(squad.Agents), cleanPrompt)
	results := fanOut(squad, cleanPrompt)

	fmt.Println("\n--- RESULTS ---")
	for _, r := range results {
		fmt.Printf("[%s/%s/%s] ok=%v\n%s\n---\n", r.Device, r.Model, r.Role, r.Ok, truncate(r.Response, 500))
	}

	// fan-in synthesis via local llama if available
	synthesisPrompt := "Sintetiza estas perspectivas:\n"
	for _, r := range results {
		synthesisPrompt += fmt.Sprintf("[%s/%s/%s]: %s\n---\n", r.Device, r.Model, r.Role, r.Response)
	}
	if len(squad.Agents) > 0 && squad.Agents[0].URL != "" {
		syn, err := callLlama(squad.Agents[0].URL, squad.Agents[0].ModelRef, synthesisPrompt, "Sos sintetizador Alcon")
		if err == nil {
			fmt.Printf("\n=== SINTESIS ===\n%s\n", syn)
		}
	}

	// output json
	out, _ := json.MarshalIndent(results, "", "  ")
	os.WriteFile(fmt.Sprintf("result-%s.json", squadName), out, 0644)
}

func truncate(s string, n int) string {
	if len(s) <= n { return s }
	return s[:n] + "..."
}

func split(s, sep string) []string {
	res := []string{}
	cur := ""
	for _, c := range s {
		if string(c) == sep { res = append(res, cur); cur = "" } else { cur += string(c) }
	}
	res = append(res, cur)
	return res
}
