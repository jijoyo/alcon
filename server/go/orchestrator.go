package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type Device struct {
	Name     string `json:"name"`
	Backend  string `json:"backend"`
	IP       string `json:"ip"`
	Port     int    `json:"port,omitempty"`
	Throttle int    `json:"throttle"`
	Role     string `json:"role,omitempty"`
}

type Granja struct {
	Version string            `json:"version"`
	Devices map[string]Device `json:"devices"`
	Squads  map[string]struct {
		Devices []string `json:"devices"`
	} `json:"squads"`
}

type Result struct {
	Device string
	Role   string
	Output string
	Ms     int64
	Error  string
}

func callLlama(d Device, prompt string) (string, error) {
	port := d.Port
	if port == 0 { port = 8080 }
	url := fmt.Sprintf("http://%s:%d/completion", d.IP, port)
	payload := map[string]interface{}{
		"prompt":      fmt.Sprintf("[%s %s] %s", d.Name, d.Role, prompt),
		"n_predict":   512,
		"temperature": 0.7,
	}
	b, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", url, bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{Timeout: 120 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	var r map[string]interface{}
	if json.Unmarshal(body, &r) == nil {
		if c, ok := r["content"].(string); ok {
			return c, nil
		}
	}
	return string(body), nil
}

func callOpenRouter(d Device, prompt string) (string, error) {
	apiKey := os.Getenv("OPENROUTER_API_KEY")
	if apiKey == "" {
		return "", fmt.Errorf("OPENROUTER_API_KEY no seteada - export OPENROUTER_API_KEY=sk-or-...")
	}
	// OpenRouter directo, sin opencode intermediario - 93s -> 15s
	url := "https://openrouter.ai/api/v1/chat/completions"
	// Modelo free que usas en v4.1
	model := "xiaomi/mimo-v2.5"
	if os.Getenv("OPENROUTER_MODEL") != "" {
		model = os.Getenv("OPENROUTER_MODEL")
	}
	payload := map[string]interface{}{
		"model": model,
		"messages": []map[string]string{
			{"role": "system", "content": fmt.Sprintf("Eres %s, rol %s en squad Alcon v4.2 Go. Responde conciso.", d.Name, d.Role)},
			{"role": "user", "content": prompt},
		},
		"stream": false,
	}
	b, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", url, bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("HTTP-Referer", "https://alcon.local")
	req.Header.Set("X-Title", "Alcon v4.2 Go")
	client := &http.Client{Timeout: 90 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		msg := string(body)
		if len(msg) > 500 { msg = msg[:500] }
		return msg, fmt.Errorf("openrouter %d: %s", resp.StatusCode, msg)
	}
	var r struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if json.Unmarshal(body, &r) == nil && len(r.Choices) > 0 {
		return r.Choices[0].Message.Content, nil
	}
	return string(body), nil
}

func getRepoContext() string {
	repo := os.Getenv("ALCON_REPO")
	if repo == "" {
		return ""
	}
	target := filepath.Join(repo, "server/go/orchestrator.go")
	data, err := os.ReadFile(target)
	if err != nil {
		return ""
	}
	if len(data) > 2000 {
		data = data[:2000]
	}
	return fmt.Sprintf("=== REPO CONTEXT ===\n%s\n=== END CONTEXT ===\n\n", string(data))
}

func throttledCall(d Device, prompt string, wg *sync.WaitGroup, ch chan<- Result) {
	defer wg.Done()
	start := time.Now()
	if d.Throttle > 0 {
		jitter := time.Duration(200+time.Now().UnixNano()%800) * time.Millisecond
		time.Sleep(time.Duration(d.Throttle)*time.Millisecond + jitter)
	}
	repoCtx := getRepoContext()
	fullPrompt := prompt
	if repoCtx != "" {
		fullPrompt = repoCtx + prompt
	}
	var out string
	var err error
	if d.Backend == "llama" {
		out, err = callLlama(d, fullPrompt)
	} else {
		out, err = callOpenRouter(d, fullPrompt)
	}
	r := Result{Device: d.Name, Role: d.Role, Output: out, Ms: time.Since(start).Milliseconds()}
	if err != nil {
		r.Error = err.Error()
	}
	ch <- r
}

func main() {
	squad := "code-audit"
	prompt := "revisa server.js"
	for i := 0; i < len(os.Args); i++ {
		if os.Args[i] == "--squad" && i+1 < len(os.Args) {
			squad = os.Args[i+1]
		}
		if os.Args[i] == "--prompt" && i+1 < len(os.Args) {
			prompt = os.Args[i+1]
		}
	}
	if os.Getenv("OPENROUTER_API_KEY") == "" {
		fmt.Println("⚠ OPENROUTER_API_KEY no seteada - cloud devices fallaran")
		fmt.Println("export OPENROUTER_API_KEY=sk-or-v1-...")
	}
	data, _ := os.ReadFile("granja.json")
	var g Granja
	json.Unmarshal(data, &g)
	fmt.Printf("=== v4.2 Go OpenRouter direct %s squad=%s ===\n", g.Version, squad)
	var wg sync.WaitGroup
	ch := make(chan Result, len(g.Squads[squad].Devices))
	start := time.Now()
	for _, name := range g.Squads[squad].Devices {
		dev := g.Devices[name]
		wg.Add(1)
		go throttledCall(dev, prompt, &wg, ch)
	}
	wg.Wait()
	close(ch)
	for r := range ch {
		fmt.Printf("[%s %s] %dms err=%s\n%.500s\n---\n", r.Device, r.Role, r.Ms, r.Error, r.Output)
	}
	fmt.Printf("Total %dms\n", time.Since(start).Milliseconds())
}
