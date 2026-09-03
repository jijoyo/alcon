package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestSelectBackend_NoTag_Fast(t *testing.T) {
	got := selectBackend("hola mundo, dame un resumen", "")
	if got != "gemma4-12b-unc" {
		t.Errorf("expected gemma4-12b-unc for short simple prompt, got %q", got)
	}
}

func TestSelectBackend_NoTag_Heavy(t *testing.T) {
	got := selectBackend(strings.Repeat("architecture ", 60), "")
	if got != "qwen36-mx" {
		t.Errorf("expected qwen36-mx for architecture keyword, got %q", got)
	}
}

func TestSelectBackend_VideoTag(t *testing.T) {
	got := selectBackend("hola", "video")
	if got != "qwen36-mx" {
		t.Errorf("routeTag=video should force qwen36-mx, got %q", got)
	}
}

func TestSelectBackend_MonetizaTag(t *testing.T) {
	got := selectBackend("hola", "monetiza")
	if got != "qwen36-mx" {
		t.Errorf("routeTag=monetiza should force qwen36-mx, got %q", got)
	}
}

func TestSelectBackend_LongPromptNoKeyword(t *testing.T) {
	long := strings.Repeat("a", 600)
	got := selectBackend(long, "")
	if got != "qwen36-mx" {
		t.Errorf("expected qwen36-mx for long prompt, got %q", got)
	}
}

func TestContainsKeywords(t *testing.T) {
	if !containsKeywords("this is an Audit task", []string{"audit", "complex"}) {
		t.Error("should detect 'audit' keyword")
	}
	if containsKeywords("simple hello", []string{"audit", "complex"}) {
		t.Error("should not detect keyword in simple text")
	}
}

func TestFallbackChain_AllFail(t *testing.T) {
	// Both will fail because no API key, but chain should not panic
	os.Setenv("OPENROUTER_API_KEY", "")
	_, _, err := fallbackChain("test", "sys", []string{"m1", "m2"})
	if err == nil {
		t.Error("expected error when API key missing")
	}
	if !strings.Contains(err.Error(), "OPENROUTER_API_KEY") {
		t.Errorf("expected OPENROUTER_API_KEY error, got %v", err)
	}
}

func TestLoadGranja_NotFound(t *testing.T) {
	os.Setenv("ALCON_GRANJA", "/nonexistent/path/granja.json")
	os.Setenv("HOME", "/nonexistent")
	_, err := loadGranja()
	if err == nil {
		t.Error("expected error for missing granja.json")
	}
}

func TestInjectCode_NoMatch(t *testing.T) {
	got := injectCode("simple prompt without paths", "/tmp")
	if got != "simple prompt without paths" {
		t.Errorf("expected unchanged prompt, got %q", got)
	}
}

func TestInjectCode_MatchServer(t *testing.T) {
	// Create a temp file to inject
	tmpDir := t.TempDir()
	tmpFile := filepath.Join(tmpDir, "server.js")
	os.WriteFile(tmpFile, []byte("console.log('hello')"), 0644)
	got := injectCode("revisa server.js", tmpDir)
	if !strings.Contains(got, "console.log") {
		t.Errorf("expected injected content, got %q", got)
	}
	if !strings.Contains(got, "=== server.js ===") {
		t.Errorf("expected file header, got %q", got)
	}
}

func TestInjectCode_MatchGoWithKeyword(t *testing.T) {
	tmpDir := t.TempDir()
	tmpFile := filepath.Join(tmpDir, "main.go")
	os.WriteFile(tmpFile, []byte("package main\n"), 0644)
	got := injectCode("revisa main.go", tmpDir)
	if !strings.Contains(got, "package main") {
		t.Errorf("expected injected.go content, got %q", got)
	}
}

func TestInjectCode_IgnoresMissing(t *testing.T) {
	got := injectCode("revisa nonexistent.xyz", "/tmp")
	if got != "revisa nonexistent.xyz" {
		t.Errorf("expected unchanged prompt for missing file, got %q", got)
	}
}
