package main


import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)


type Device struct {
	Name string `json:"name"`
	Backend string `json:"backend"`
	IP string `json:"ip"`
	Port int `json:"port,omitempty"`
	Model string `json:"model,omitempty"`
	Throttle int `json:"throttle"`
	Role string `json:"role,omitempty"`
}


type Granja struct {
	Version string `json:"version"`
	Devices map[string]Device `json:"devices"`
	Squads map[string]struct {
		Devices []string `json:"devices"`
	} `json:"squads"`
}


type Result struct {
	Device string
	Role string
	Output string
	Ms int64
	Error string
}


func callLlama(d Device, prompt string) (string, error) {
	port := d.Port
	if port == 0 {
		port = 8080
	}
	url := fmt.Sprintf("http://%s:%d/completion", d.IP, port)
	payload := map[string]interface{}{"prompt": prompt, "n_predict": 512}
	if d.Model != "" {
		payload["model"] = d.Model
	}
	b, _ := json.Marshal(payload)
	resp, err := http.Post(url, "application/json", bytes.NewReader(b))
	if err!= nil {
		return "", err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	return string(body), nil
}


func callOpenRouter(d Device, prompt string) (string, error) {
	apiKey := os.Getenv("OPENROUTER_API_KEY")
	if apiKey == "" {
		return "", fmt.Errorf("OPENROUTER_API_KEY no seteada")
	}
	model := d.Model
	if model == "" {
		model = os.Getenv("OPENROUTER_MODEL")
	}
	if model == "" {
		model = "xiaomi/mimo-v2.5:free"
	}
	// si viene corto tipo "mimo-v2.5:free" -> expande
	if!strings.Contains(model, "/") && strings.Contains(model, ":free") {
		if strings.Contains(model, "mimo") {
			model = "xiaomi/" + model
		}
		if strings.Contains(model, "llama") {
			model = "meta-llama/" + model
		}
	}
	url := "https://openrouter.ai/api/v1/chat/completions"
	payload := map[string]interface{}{
		"model": model,
		"messages": []map[string]string{
			{"role": "system", "content": fmt.Sprintf("Eres %s rol %s", d.Name, d.Role)},
			{"role": "user", "content": prompt},
		},
	}
	b, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", url, bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)
	client := &http.Client{Timeout: 90 * time.Second}
	resp, err := client.Do(req)
	if err!= nil {
		return "", err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode!= 200 {
		msg := string(body)
		if len(msg) > 500 {
			msg = msg[:500]
		}
		return msg, fmt.Errorf("openrouter %d", resp.StatusCode)
	}
	var r struct {
		Choices []struct {
			Message struct{ Content string `json:"content"` } `json:"message"`
		} `json:"choices"`
	}
	if json.Unmarshal(body, &r) == nil && len(r.Choices) > 0 {
		return r.Choices[0].Message.Content, nil
	}
	return string(body), nil
}


func throttledCall(d Device, prompt string, wg *sync.WaitGroup, ch chan<- Result) {
	defer wg.Done()
	start := time.Now()
	if d.Throttle > 0 {
		time.Sleep(time.Duration(d.Throttle)*time.Millisecond + time.Duration(time.Now().UnixNano()%800)*time.Millisecond)
	}
	var out string
	var err error
	if d.Backend == "llama" {
		out, err = callLlama(d, fullPrompt(prompt))
	} else {
		out, err = callOpenRouter(d, prompt)
	}
	r := Result{Device: d.Name, Role: d.Role, Output: out, Ms: time.Since(start).Milliseconds()}
	if err!= nil {
		r.Error = err.Error()
	}
	ch <- r
}


func fullPrompt(p string) string { return p }


func main() {
	var promptFlag string
	var squadName string
	flag.StringVar(&promptFlag, "prompt", "", "prompt")
	flag.StringVar(&squadName, "squad", "code-audit", "squad")
	flag.Parse()


	// MODO NO-TECNICO: alcon "mi pregunta"
	prompt := promptFlag
	if prompt == "" && len(flag.Args()) > 0 {
		prompt = strings.Join(flag.Args(), " ")
	}
	if prompt == "" {
		// fallback sin flags: alcon hola como estas
		if len(os.Args) > 1 &&!strings.HasPrefix(os.Args[1], "-") {
			prompt = strings.Join(os.Args[1:], " ")
		}
	}
	if prompt == "" {
		fmt.Println(`uso: alcon "tu pregunta" o alcon --prompt "tu pregunta" --squad code-audit`)
		return
	}


	granjaPath := os.Getenv("ALCON_GRANJA")
	if granjaPath == "" {
		granjaPath = filepath.Join(os.Getenv("HOME"), "Documentos/alcon/server/go/granja.json")
		if _, err := os.Stat(granjaPath); err!=nil {
			granjaPath = filepath.Join(os.Getenv("HOME"), "Documentos/alcon/granja.json")
		}
	}
	data, err := os.ReadFile(granjaPath)
	if err!= nil {
		fmt.Printf("no granja.json en %s: %v\n", granjaPath, err)
		return
	}
	var granja Granja
	if err := json.Unmarshal(data, &granja); err!= nil {
		fmt.Printf("json err: %v\n", err)
		return
	}


	squad, ok := granja.Squads[squadName]
	if!ok {
		fmt.Printf("squad %s no encontrado\n", squadName)
		return
	}


	fmt.Printf("=== v4.2 Go simple squad=%s model-per-device ===\n", squadName)
	selectedModel := selectBackend(prompt, granja)
	fmt.Printf("[ROUTING] prompt=%d chars -> model=%s\n", len(prompt), selectedModel)
	var wg sync.WaitGroup
	ch := make(chan Result, len(squad.Devices))
	for _, devName := range squad.Devices {
		d, ok := granja.Devices[devName]
		if!ok {
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

func selectBackend(prompt string, granja Granja) string {
	heavyKeywords := []string{"architecture", "research-deep", "audit", "complex"}
	if len(prompt) < 500 && !containsKeywords(prompt, heavyKeywords) {
		return "gemma4-12b-unc" // 80% rápido — gemma4-12b/qwen-coder-14b
	}
	return "qwen36-mx" // 20% pesado — qwen36-mx 131K ctx
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
