#!/bin/bash
# 08-rebuild-mcp.sh — Reconstruir node_modules de MCP servers
set -e

echo "╔══════════════════════════════════════╗"
echo "║  FASE 8: Rebuild MCP servers          ║"
echo "╚══════════════════════════════════════╝"

echo ""
echo "=== lazy-load plugin ==="
cd ~/.config/opencode/plugins/lazy-load && npm install 2>/dev/null && echo "✅ lazy-load" || echo "⚠️ lazy-load: skip"

echo ""
echo "=== opencode-lab MCP servers ==="
cd ~/Documentos/opencode-lab/.opencode/mcp-servers 2>/dev/null && npm install && echo "✅ opencode-lab mcp" || echo "⚠️ opencode-lab: no encontrado"

echo ""
echo "=== octocode-mcp ==="
cd ~/.local/lib/octocode-mcp && npm install 2>/dev/null && echo "✅ octocode" || echo "⚠️ octocode: reinstall manual"

echo ""
echo "✅ MCP servers reconstruidos"
echo "Siguiente: 09-setup-services.sh"
