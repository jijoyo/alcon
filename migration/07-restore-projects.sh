#!/bin/bash
# 07-restore-projects.sh — Restaurar proyectos (rsync LAN o del VPS)
set -e

echo "╔══════════════════════════════════════╗"
echo "║  FASE 7: Restaurar proyectos         ║"
echo "╚══════════════════════════════════════╝"

VPS="ubuntu@159.54.143.227"
SSH_KEY="$HOME/.ssh/oracle_key"
REMOTE_DIR="/home/ubuntu/migration-backup"

mkdir -p ~/Documentos

# Opción 1: rsync directo desde Kali (si están en la misma red)
KALI_IP="${1:-}"
if [ -n "$KALI_IP" ]; then
    echo ""
    echo "[OPCIÓN A] rsync directo desde Kali ($KALI_IP)..."
    rsync -avz --progress \
      --exclude='node_modules' \
      --exclude='__pycache__' \
      --exclude='dist' \
      -e "ssh -i $SSH_KEY" \
      "ubuntu@${KALI_IP}:~/Documentos/" \
      ~/Documentos/
else
    # Opción 2: Descargar del VPS
    echo ""
    echo "[OPCIÓN B] Descargando projects.tar.zst del VPS..."
    scp -i "$SSH_KEY" "$VPS:$REMOTE_DIR/projects.tar.zst" /tmp/
    
    echo "Extrayendo proyectos..."
    cd /tmp && tar --zstd -xf projects.tar.zst -C ~/Documentos/
    rm /tmp/projects.tar.zst
fi

echo ""
echo "=== Proyectos restaurados ==="
ls -la ~/Documentos/

echo ""
echo "=== Instalando node_modules en proyectos principales ==="
if [ -f ~/Documentos/dose-dash-digital/package.json ]; then
    cd ~/Documentos/dose-dash-digital && npm install
    echo "✅ dose-dash-digital"
fi

if [ -f ~/Documentos/alcon/pwa/package.json ]; then
    cd ~/Documentos/alcon/pwa && npm install 2>/dev/null || echo "⚠️ alcon pwa: sin package.json"
fi

echo ""
echo "✅ Proyectos restaurados"
echo "Siguiente: 08-rebuild-mcp.sh"
