#!/bin/bash
# 99-verify.sh — Verificar migración completa
set -e

FAIL=0

echo "╔══════════════════════════════════════╗"
echo "║  VERIFICACIÓN FINAL                  ║"
echo "╚══════════════════════════════════════╝"

echo ""
echo "=== TOOLCHAIN ==="
command -v node && echo "✅ Node: $(node -v)" || { echo "❌ Node missing"; FAIL=1; }
command -v bun && echo "✅ Bun: $(bun --version)" || { echo "❌ Bun missing"; FAIL=1; }
command -v go && echo "✅ Go: $(go version)" || { echo "❌ Go missing"; FAIL=1; }
command -v ollama && echo "✅ Ollama: $(ollama --version 2>&1 | head -1)" || { echo "❌ Ollama missing"; FAIL=1; }
command -v opencode && echo "✅ OpenCode" || { echo "❌ OpenCode missing (check ~/.opencode/bin/ in PATH)"; FAIL=1; }
command -v gh && echo "✅ GitHub CLI" || { echo "❌ gh missing"; FAIL=1; }
command -v adb && echo "✅ ADB" || { echo "❌ adb missing"; FAIL=1; }
command -v java && echo "✅ Java: $(java -version 2>&1 | head -1)" || { echo "❌ Java missing"; FAIL=1; }

echo ""
echo "=== GPU ==="
nvidia-smi --query-gpu=name,memory.total --format=csv,noheader 2>/dev/null && echo "✅ GPU OK" || echo "⚠️ GPU no detectada (¿reboot necesario? ¿no tiene NVIDIA?)"

echo ""
echo "=== SERVICIOS ==="
sudo systemctl is-active ollama && echo "✅ Ollama running" || { echo "❌ Ollama not running"; FAIL=1; }
systemctl --user is-active engram 2>/dev/null && echo "✅ Engram running" || echo "⚠️ Engram not running (re-login o instalar manualmente)"

echo ""
echo "=== SSH ==="
ssh -o ConnectTimeout=5 -o BatchMode=yes ubuntu@159.54.143.227 "echo ok" 2>/dev/null && echo "✅ SSH to VPS OK" || echo "❌ SSH failed"

echo ""
echo "=== GIT ==="
cd ~/Documentos/dose-dash-digital 2>/dev/null && git status >/dev/null 2>&1 && echo "✅ Git OK" || echo "❌ Git failed or dose-dash-digital not found"

echo ""
echo "=== OPENCODE CONFIG ==="
[ -f ~/.config/opencode/opencode.jsonc ] && echo "✅ opencode.jsonc exists" || { echo "❌ Missing"; FAIL=1; }
[ -f ~/.config/opencode/AGENTS.md ] && echo "✅ AGENTS.md exists" || { echo "❌ Missing"; FAIL=1; }
[ -d ~/.config/opencode/plugins/lazy-load ] && echo "✅ lazy-load plugin" || echo "⚠️ lazy-load missing"

echo ""
echo "=== OLLAMA MODELS ==="
ollama list 2>/dev/null | tail -n +2 | wc -l | xargs -I{} echo "Modelos instalados: {}"

echo ""
echo "=== NODE_MODULES ==="
[ -d ~/Documentos/dose-dash-digital/node_modules ] && echo "✅ dose-dash node_modules" || echo "⚠️ dose-dash: npm install needed"
[ -d ~/.config/opencode/plugins/lazy-load/node_modules ] && echo "✅ lazy-load node_modules" || echo "⚠️ lazy-load: npm install needed"

echo ""
echo "=== REMOTE OLLAMA (VPS) ==="
curl -s --connect-timeout 3 http://100.102.63.30:11434/api/tags >/dev/null 2>&1 && echo "✅ VPS ollama reachable" || echo "⚠️ VPS ollama not reachable (check Tailscale)"

echo ""
if [ $FAIL -eq 0 ]; then
    echo "🎉 MIGRACIÓN COMPLETA — Todos los checks pasaron"
else
    echo "⚠️  MIGRACIÓN INCOMPLETA — Revisar errores arriba"
fi
