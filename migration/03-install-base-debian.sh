#!/bin/bash
# 03-install-base-debian.sh — Instalar dependencias del sistema en Debian 13
set -e

echo "╔══════════════════════════════════════╗"
echo "║  FASE 3: Setup base Debian 13        ║"
echo "╚══════════════════════════════════════╝"

echo ""
echo "=== ACTUALIZAR SISTEMA ==="
sudo apt update && sudo apt upgrade -y

echo ""
echo "=== PAQUETES BASE ==="
sudo apt install -y \
  build-essential \
  curl wget git \
  ca-certificates gnupg lsb-release \
  software-properties-common apt-transport-https \
  unzip zip tar zstd \
  openssh-client \
  gh \
  adb \
  python3 python3-pip python3-venv \
  openjdk-21-jdk \
  cmake pkg-config \
  libgomp1 \
  jq htop tree \
  tmux \
  chromium

echo ""
echo "=== TAILSCALE ==="
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
echo "⚠️  Tailscale instalado. Corre 'tailscale status' y pasame la IP"

echo ""
echo "=== VERIFICACIONES ==="
echo "Node: $(node -v 2>/dev/null || echo 'NO INSTALADO - instalar con nvm')"
echo "Java: $(java -version 2>&1 | head -1)"
echo "ADB: $(adb version 2>/dev/null | head -1 || echo 'NO INSTALADO')"
echo "GH: $(gh --version 2>/dev/null | head -1 || echo 'NO INSTALADO')"
echo "Tailscale: $(tailscale version 2>/dev/null | head -1 || echo 'NO INSTALADO')"

echo ""
echo "✅ Base Debian instalada"
echo "Siguiente: 04-install-nvidia.sh (si aplica) o 05-install-toolchain.sh"
