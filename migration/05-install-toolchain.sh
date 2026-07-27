#!/bin/bash
# 05-install-toolchain.sh — Instalar dev toolchain en Debian 13
set -e

echo "╔══════════════════════════════════════╗"
echo "║  FASE 5: Toolchain Dev               ║"
echo "╚══════════════════════════════════════╝"

# --- Node.js via nvm ---
echo ""
echo "=== Instalando nvm ==="
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
export NVM_DIR="$HOME/.config/nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm install 22
nvm use 22
nvm alias default 22
echo "Node: $(node -v), npm: $(npm -v)"

# --- Bun ---
echo ""
echo "=== Instalando Bun ==="
curl -fsSL https://bun.sh/install | bash
echo "Bun: $(bun --version)"

# --- Go ---
echo ""
echo "=== Instalando Go ==="
GO_VERSION="1.23.4"
curl -sL "https://go.dev/dl/go${GO_VERSION}.linux-amd64.tar.gz" | sudo tar -C /usr/local -xzf -
echo 'export PATH="/usr/local/go/bin:$HOME/go/bin:$PATH"' >> ~/.bashrc
echo "Go: $(go version)"

# --- Ollama (fresh install - system service) ---
echo ""
echo "=== Instalando Ollama ==="
curl -fsSL https://ollama.com/install.sh | sh
echo "Ollama: $(ollama --version)"

# --- OpenCode ---
echo ""
echo "=== Instalando OpenCode ==="
mkdir -p ~/.opencode/bin
curl -fsSL https://opencode.ai/install.sh | bash
echo "OpenCode installed"

echo ""
echo "✅ Toolchain instalado"
echo "Siguiente: 06-restore-config.sh"
