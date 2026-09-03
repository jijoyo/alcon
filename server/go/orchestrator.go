package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

type Device struct {
	Name     string `json:"name"`
	Backend  string `json:"backend"`
	IP       string `json:"ip"`
	Port     int    `json:"port,omitempty"`
	Model    string `json:"model,omitempty"`
	Throttle int    `json:"throttle"`
	Role     string `json:"role,omitempty"`
}

type SquadConfig struct {
	Devices []string `json:"devices"`
}

type Granja struct {
	Version string                 `json:"version"`
	Devices map[string]Device      `json:"devices"`
	Squads  map[string]SquadConfig `json:"squads"`
	Router  map[string]interface{} `json:"router"`
}

type Result struct {
	Device string
	Role   string
	Output string
	Ms     int64
	Error  string
}

type OrchestrateRequest struct {
	Text     string `json:"text"`
	Squad    string `json:"squad"`
	RouteTag string `json:"routeTag,omitempty"`
}

type Detail struct {
	Device   string `json:"device"`
	Model    string `json:"model"`
	Role     string `json:"role"`
	Response string `json:"response"`
	OK       bool   `json:"ok"`
	Ms       int64  `json:"ms"`
	Error    string `json:"error,omitempty"`
}

type OrchestrateResponse struct {
	Final       string   `json:"final"`
	Details     []Detail `json:"details"`
	PendingPath string   `json:"pendingPath"`
}

var granjaCache Granja
var granjaCacheAt time.Time
var granjaMu sync.RWMutex
const granjaTTL = 30 * time.Second

func loadGranja() (Granja, error) {
	granjaMu.RLock()
	if time.Since(granjaCacheAt) < granjaTTL {
		defer granjaMu.RUnlock()
		return granjaCache, nil
	}
	granjaMu.RUnlock()

	granjaPath := os.Getenv("ALCON_GRANJA")
	if granjaPath == "" {
		for _, p := range []string{
			filepath.Join(os.Getenv("HOME"), "Documentos/alcon/server/go/granja.json"),
			filepath.Join(os.Getenv("HOME"), "Documentos/alcon/granja.json"),
			"/home/ubuntu/alcon/server/go/granja.json",
			"/home/ubuntu/alcon/granja.json",
		} {
			if _, err := os.Stat(p); err == nil {
				granjaPath = p
				break
			}
		}
	}
	if granjaPath == "" {
		return Granja{}, fmt.Errorf("granja.json no encontrado")
	}
	data, err := os.ReadFile(granjaPath)
	if err != nil {
		return Granja{}, err
	}
	var g Granja
	if err := json.Unmarshal(data, &g); err != nil {
		return Granja{}, err
	}
	granjaMu.Lock()
	granjaCache = g
	granjaCacheAt = time.Now()
	granjaMu.Unlock()
	return g, nil
}

func callLlama(d Device, prompt string) (string, error) {
	port := d.Port
	if port == 0 {
		port = 8080
	}
	url := fmt.Sprintf("http://%s:%d/v1/chat/completions", d.IP, port)
	payload := map[string]interface{}{
		"model":       d.Model,
		"messages":    []map[string]string{{"role": "user", "content": prompt}},
		"stream":      false,
		"temperature": 0.7,
		"max_tokens":  1024,
	}
	if d.Model == "" {
		delete(payload, "model")
	}
	b, _ := json.Marshal(payload)
	resp, err := http.Post(url, "application/json", bytes.NewReader(b))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return string(body), fmt.Errorf("llama %d", resp.StatusCode)
	}
	var r struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(body, &r); err == nil && len(r.Choices) > 0 {
		return r.Choices[0].Message.Content, nil
	}
	return string(body), nil
}

// callOpenRouter supports a model override and a fallback chain.
// Returns (text, modelUsed, error).
func callOpenRouter(prompt, systemPrompt, modelOverride string) (string, string, error) {
	apiKey := os.Getenv("OPENROUTER_API_KEY")
	if apiKey == "" {
		return "", "", fmt.Errorf("OPENROUTER_API_KEY no seteada")
	}
	model := modelOverride
	if model == "" {
		model = os.Getenv("OPENROUTER_MODEL")
	}
	if model == "" {
		model = "xiaomi/mimo-v2.5:free"
	}
	if !strings.Contains(model, "/") && strings.Contains(model, ":free") {
		if strings.Contains(model, "mimo") {
			model = "xiaomi/" + model
		}
		if strings.Contains(model, "llama") {
			model = "meta-llama/" + model
		}
		if strings.Contains(model, "deepseek") {
			model = "deepseek/" + model
		}
	}
	url := "https://openrouter.ai/api/v1/chat/completions"
	payload := map[string]interface{}{
		"model": model,
		"messages": []map[string]string{
			{"role": "system", "content": systemPrompt},
			{"role": "user", "content": prompt},
		},
	}
	b, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", url, bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)
	client := &http.Client{Timeout: 90 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", model, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		msg := string(body)
		if len(msg) > 500 {
			msg = msg[:500]
		}
		return msg, model, fmt.Errorf("openrouter %d", resp.StatusCode)
	}
	var r struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if json.Unmarshal(body, &r) == nil && len(r.Choices) > 0 {
		return r.Choices[0].Message.Content, model, nil
	}
	return string(body), model, nil
}

// fallbackChain tries each model in order. Returns first success or last error.
func fallbackChain(prompt, systemPrompt string, models []string) (string, string, error) {
	var lastErr error
	var lastBody string
	for i, m := range models {
		body, used, err := callOpenRouter(prompt, systemPrompt, m)
		if err == nil {
			return body, used, nil
		}
		lastErr = err
		lastBody = body
		// Backoff: 5s, 10s, 20s, 40s (capped at 40s)
		backoff := 5 * (1 << i)
		if backoff > 40 {
			backoff = 40
		}
		log.Printf("[fallback] %s fail: %v — retry in %ds", used, err, backoff)
		// If last model, don't sleep
		if i < len(models)-1 {
			time.Sleep(time.Duration(backoff) * time.Second)
		}
	}
	return lastBody, models[len(models)-1], lastErr
}

func throttledCall(d Device, prompt string, wg *sync.WaitGroup, ch chan<- Result) {
	defer wg.Done()
	start := time.Now()
	if d.Throttle > 0 {
		jitter := time.Duration(time.Now().UnixNano()%800) * time.Millisecond
		time.Sleep(time.Duration(d.Throttle)*time.Millisecond + jitter)
	}
	var out string
	var err error
	if d.Backend == "llama" {
		out, err = callLlama(d, fullPrompt(prompt))
	} else {
		out, err = callOpenRouterSimple(d, prompt)
	}
	r := Result{Device: d.Name, Role: d.Role, Output: out, Ms: time.Since(start).Milliseconds()}
	if err != nil {
		r.Error = err.Error()
	}
	ch <- r
}

func callOpenRouterSimple(d Device, prompt string) (string, error) {
	system := fmt.Sprintf("Eres %s rol %s", d.Name, d.Role)
	body, _, err := callOpenRouter(prompt, system, d.Model)
	return body, err
}

func fullPrompt(p string) string { return p }

// selectBackend decides which model to use based on prompt length, keywords, and routeTag.
// routeTag values "video" or "monetiza" force the heavy model (qwen36-mx).
// Without routeTag, 80/20 rule: prompt<500 + no heavy keywords -> gemma4-12b-unc (fast).
func selectBackend(prompt, routeTag string) string {
	if routeTag == "video" || routeTag == "monetiza" {
		return "qwen36-mx"
	}
	heavyKeywords := []string{"architecture", "research-deep", "audit", "complex"}
	if len(prompt) < 500 && !containsKeywords(prompt, heavyKeywords) {
		return "gemma4-12b-unc"
	}
	return "qwen36-mx"
}

func containsKeywords(text string, keywords []string) bool {
	lower := strings.ToLower(text)
	for _, k := range keywords {
		if strings.Contains(lower, k) {
			return true
		}
	}
	return false
}

func injectCode(prompt, codeRoot string) string {
	patterns := []string{
		`(?:revisa|analiza|audita|check|lee)\s+([\w/\.\-]+(?:\.js|\.ts|\.json|\.md))`,
		`(server/server\.js|server\.js|routes/[\w\-]+\.js|lib/[\w\-]+\.js)`,
	}
	code := ""
	for _, pat := range patterns {
		// Re-encode the pattern: replace literal chars since Go regex doesn't support lookbehind in same way
		// We use a simple substring search instead
		_ = pat
	}
	// Simple substring injection: look for known file tokens in prompt
	tokens := []string{"server.js", "server/server.js", "routes/", "lib/"}
	for _, t := range tokens {
		if strings.Contains(prompt, t) {
			idx := strings.Index(prompt, t)
			// Find the start of the file path token
			start := idx
			for start > 0 && prompt[start-1] != ' ' && prompt[start-1] != '\n' && prompt[start-1] != '\t' {
				start--
			}
			path := prompt[start:idx+len(t)]
			// Strip trailing punctuation
			for len(path) > 0 && (path[len(path)-1] == '.' || path[len(path)-1] == ',' || path[len(path)-1] == ';') {
				path = path[:len(path)-1]
			}
			if !strings.HasSuffix(path, ".js") && !strings.HasSuffix(path, ".ts") && !strings.HasSuffix(path, ".json") && !strings.HasSuffix(path, ".md") {
				continue
			}
			full := path
			if !strings.HasPrefix(full, "/") {
				full = filepath.Join(codeRoot, path)
			}
			data, err := os.ReadFile(full)
			if err != nil {
				continue
			}
			content := string(data)
			if len(content) > 12000 {
				content = content[:12000]
			}
			code += fmt.Sprintf("\n=== %s ===\n%s\n=== FIN ===\n", path, content)
		}
	}
	if code != "" {
		return prompt + "\n\n" + code
	}
	return prompt
}

func appendPending(path, content string) {
	_ = os.MkdirAll(filepath.Dir(path), 0755)
	f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return
	}
	defer f.Close()
	ts := time.Now().Format(time.RFC3339)
	fmt.Fprintf(f, "\n## %s [go-orchestrator]\n%s\n", ts, content)
}

func orchestrate(req OrchestrateRequest) OrchestrateResponse {
	granja, err := loadGranja()
	if err != nil {
		return OrchestrateResponse{Final: fmt.Sprintf("ERROR: %v", err)}
	}
	squad, ok := granja.Squads[req.Squad]
	if !ok {
		return OrchestrateResponse{Final: fmt.Sprintf("ERROR: squad %q no existe", req.Squad)}
	}

	selectedModel := selectBackend(req.Text, req.RouteTag)
	log.Printf("[orchestrate] squad=%s routeTag=%q model=%s textLen=%d",
		req.Squad, req.RouteTag, selectedModel, len(req.Text))

	codeRoot := os.Getenv("ALCON_CODE_ROOT")
	if codeRoot == "" {
		codeRoot = filepath.Join(os.Getenv("HOME"), "Documentos/alcon")
	}
	promptWithCode := injectCode(req.Text, codeRoot)

	var wg sync.WaitGroup
	ch := make(chan Result, len(squad.Devices))
	for _, devName := range squad.Devices {
		d, ok := granja.Devices[devName]
		if !ok {
			continue
		}
		if d.Backend == "llama" {
			d.Model = selectedModel
		}
		wg.Add(1)
		go throttledCall(d, promptWithCode, &wg, ch)
	}
	go func() { wg.Wait(); close(ch) }()

	var results []Result
	totalMs := int64(0)
	for r := range ch {
		results = append(results, r)
		totalMs += r.Ms
	}

	details := make([]Detail, 0, len(results))
	var perspectives strings.Builder
	for _, r := range results {
		d := Detail{
			Device:   r.Device,
			Model:    selectedModel,
			Role:     r.Role,
			Response: r.Output,
			OK:       r.Error == "",
			Ms:       r.Ms,
		}
		if r.Error != "" {
			d.Error = r.Error
		}
		details = append(details, d)
		fmt.Fprintf(&perspectives, "[%s/%s/%s]: %s\n---\n", r.Device, selectedModel, r.Role, r.Output)
	}

	// Fan-in synthesis: try local first if any local results, else fallback to OpenRouter
	final := ""
	if len(results) > 0 && results[0].Error == "" {
		// Use the first local result as synthesis (cheapest)
		final = results[0].Output
	}
	if final == "" {
		synthesisPrompt := fmt.Sprintf("Sintetiza estas %d perspectivas sobre: %q\n\n%s\n\nSintesis final en español, corta, accionable.",
			len(results), req.Text, perspectives.String())
		fallbackModels := []string{
			"xiaomi/mimo-v2.5:free",
			"deepseek/deepseek-chat-v3.1:free",
		}
		body, _, err := fallbackChain(synthesisPrompt,
			"Sos el sintetizador del enjambre Alcon. Combina multiples perspectivas en una respuesta coherente. Responde en español, corto.",
			fallbackModels)
		if err == nil {
			final = body
		} else {
			final = perspectives.String()
			if len(final) > 2000 {
				final = final[:2000]
			}
		}
	}

	// Append to pending log
	pendingDir := os.Getenv("ALCON_PENDING_DIR")
	if pendingDir == "" {
		pendingDir = filepath.Join(codeRoot, "server", "go", "memory")
	}
	pendingPath := filepath.Join(pendingDir, fmt.Sprintf("pending-%s.md", time.Now().Format("2006-01-02")))
	appendPending(pendingPath, fmt.Sprintf("squad=%s routeTag=%q model=%s devices=%d ms=%d\nfinal=%s",
		req.Squad, req.RouteTag, selectedModel, len(results), totalMs, final))

	return OrchestrateResponse{
		Final:       final,
		Details:     details,
		PendingPath: pendingPath,
	}
}

func handleOrchestrate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req OrchestrateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad json: "+err.Error(), http.StatusBadRequest)
		return
	}
	if req.Text == "" {
		http.Error(w, "text required", http.StatusBadRequest)
		return
	}
	if req.Squad == "" {
		req.Squad = "code-audit"
	}
	resp := orchestrate(req)
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(resp); err != nil {
		log.Printf("[orchestrate] encode: %v", err)
	}
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	granja, err := loadGranja()
	status := map[string]interface{}{
		"status":  "ok",
		"version": "v5.0-go-http",
		"ts":      time.Now().Format(time.RFC3339),
	}
	if err != nil {
		status["granja_error"] = err.Error()
		status["status"] = "degraded"
	} else {
		status["granja_version"] = granja.Version
		status["devices"] = len(granja.Devices)
		status["squads"] = len(granja.Squads)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(status)
}

func main() {
	var promptFlag string
	var squadName string
	var httpMode bool
	var httpPort string
	flag.StringVar(&promptFlag, "prompt", "", "prompt (CLI mode)")
	flag.StringVar(&squadName, "squad", "code-audit", "squad (CLI mode)")
	flag.BoolVar(&httpMode, "http", false, "run as HTTP server")
	flag.StringVar(&httpPort, "port", os.Getenv("PORT"), "HTTP port (default: $PORT or 3001b)")
	flag.Parse()

	if httpMode || os.Getenv("PORT") != "" || len(os.Args) == 1 {
		// HTTP server mode
		if httpPort == "" {
			httpPort = "3001b"
		}
		http.HandleFunc("/api/orchestrate", handleOrchestrate)
		http.HandleFunc("/health", handleHealth)
		addr := ":" + httpPort
		log.Printf("[orchestrator-go] HTTP server listening on %s (granja-ttl=%s)", addr, granjaTTL)
		if err := http.ListenAndServe(addr, nil); err != nil {
			log.Fatalf("listen: %v", err)
		}
		return
	}

	// CLI mode (legacy)
	prompt := promptFlag
	if prompt == "" && len(flag.Args()) > 0 {
		prompt = strings.Join(flag.Args(), " ")
	}
	if prompt == "" {
		fmt.Println(`uso: orchestrator --http (server) | orchestrator --prompt "..." --squad code-audit (CLI)`)
		return
	}

	granja, err := loadGranja()
	if err != nil {
		fmt.Printf("granja err: %v\n", err)
		return
	}
	squad, ok := granja.Squads[squadName]
	if !ok {
		fmt.Printf("squad %s no encontrado\n", squadName)
		return
	}

	fmt.Printf("=== v5.0 Go HTTP+CLI squad=%s ===\n", squadName)
	selectedModel := selectBackend(prompt, "")
	fmt.Printf("[ROUTING] prompt=%d chars -> model=%s\n", len(prompt), selectedModel)
	var wg sync.WaitGroup
	ch := make(chan Result, len(squad.Devices))
	for _, devName := range squad.Devices {
		d, ok := granja.Devices[devName]
		if !ok {
			continue
		}
		if d.Backend == "llama" {
			d.Model = selectedModel
		}
		wg.Add(1)
		go throttledCall(d, prompt, &wg, ch)
	}
	go func() { wg.Wait(); close(ch) }()
	var total int64
	for r := range ch {
		fmt.Printf("[%s] %dms err=%s\n%s\n---\n", r.Device, r.Ms, r.Error, r.Output)
		total += r.Ms
	}
	fmt.Printf("Total %dms\n", total)
}
