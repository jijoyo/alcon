#!/bin/bash
# 09-setup-services.sh — Configurar servicios en Debian
set -e

echo "╔══════════════════════════════════════╗"
echo "║  FASE 9: Servicios                   ║"
echo "╚══════════════════════════════════════╝"

echo ""
echo "=== Ollama (system service) ==="
sudo systemctl enable --now ollama
sleep 3
sudo systemctl status ollama --no-pager | head -5
echo ""
echo "Modelos disponibles:"
ollama list 2>/dev/null || echo " (Ninguno aún)"

echo ""
echo "=== Pull modelos (ligeros) ==="
ollama pull qwen2.5-coder-1.5b 2>/dev/null && echo "✅ qwen2.5-coder-1.5b" || echo "⚠️ qwen2.5 pull failed"
# Los demás modelos se pueden pull después si se necesitan
# ollama pull gemma4-e2b
# ollama pull mistral:7b

echo ""
echo "=== Engram (user service) ==="
systemctl --user daemon-reload
systemctl --user enable --now engram 2>/dev/null && echo "✅ engram" || echo "⚠️ engram: no service file (install manually)"

echo ""
echo "=== Verificar servicios ==="
echo "Ollama: $(sudo systemctl is-active ollama)"
echo "Engram: $(systemctl --user is-active engram 2>/dev/null || echo 'no configurado')"

echo ""
echo "✅ Servicios configurados"
echo "Siguiente: 10-fix-paths.sh"
