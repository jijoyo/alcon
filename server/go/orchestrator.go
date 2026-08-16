package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"sync"
	"time"
)

type Device struct {
	Name     string `json:"name"`
	Backend  string `json:"backend"`
	IP       string `json:"ip"`
	Proxy    string `json:"proxy,omitempty"`
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

func getOpencodeBin() string {
	if v := os.Getenv("OPENCODE_BIN"); v != "" {
		return v
	}
	if v := os.Getenv("HOME"); v != "" {
		candidate := v + "/.opencode/bin/opencode"
		if _, err := os.Stat(candidate); err == nil {
			return candidate
		}
	}
	// VPS path from your deploy fix
	if _, err := os.Stat("/usr/local/bin/opencode"); err == nil {
		return "/usr/local/bin/opencode"
	}
	if _, err := os.Stat("/home/ubuntu/.opencode/bin/opencode"); err == nil {
		return "/home/ubuntu/.opencode/bin/opencode"
	}
	return "opencode"
}

func callLlama(d Device, prompt string) (string, error) {
	url := fmt.Sprintf("http://%s:8080/completion", d.IP)
	payload := map[string]interface{}{
		"prompt":      fmt.Sprintf("[%s %s] %s", d.Name, d.Role, prompt),
		"n_predict":   512,
		"temperature": 0.7,
	}
	b, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", url, bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{Timeout: 30 * time.Second}
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

func callOpencode(d Device, prompt string) (string, error) {
	bin := getOpencodeBin()
	args := []string{"run", "--model", "opencode/mimo-v2.5-free", prompt}
	cmd := exec.Command(bin, args...)
	workdir := os.Getenv("ALCON_WORKDIR")
	if workdir == "" {
		workdir, _ = os.Getwd()
	}
	cmd.Dir = workdir
	env := os.Environ()
	if d.Proxy != "" {
		env = append(env, "HTTP_PROXY="+d.Proxy, "HTTPS_PROXY="+d.Proxy)
	}
	cmd.Env = env
	done := make(chan error, 1)
	var out []byte
	go func() {
		var err error
		out, err = cmd.CombinedOutput()
		done <- err
	}()
	select {
	case err := <-done:
		return string(out), err
	case <-time.After(90 * time.Second):
		cmd.Process.Kill()
		return "", fmt.Errorf("opencode timeout 90s")
	}
}

func throttledCall(d Device, prompt string, wg *sync.WaitGroup, ch chan<- Result) {
	defer wg.Done()
	start := time.Now()
	if d.Throttle > 0 {
		jitter := time.Duration(200+time.Now().UnixNano()%800) * time.Millisecond
		time.Sleep(time.Duration(d.Throttle)*time.Millisecond + jitter)
	}
	var out string
	var err error
	if d.Backend == "llama" {
		out, err = callLlama(d, prompt)
	} else {
		out, err = callOpencode(d, prompt)
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
	data, _ := os.ReadFile("granja.json")
	var g Granja
	json.Unmarshal(data, &g)
	fmt.Printf("=== v4.2 Go %s squad=%s ===\nDevices: %v\n", g.Version, squad, g.Squads[squad].Devices)
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
		status := "OK"
		if r.Error != "" {
			status = "ERR " + r.Error
		}
		fmt.Printf("[%s %s] %s %dms %d chars\n%.300s\n---\n", r.Device, r.Role, status, r.Ms, len(r.Output), r.Output)
	}
	fmt.Printf("Total %dms RAM est %dMB\n", time.Since(start).Milliseconds(), len(g.Squads[squad].Devices)*15)
}
