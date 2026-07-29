#!/bin/bash
# 06-restore-config.sh — Restaurar configuración del VPS
set -e

VPS="ubuntu@159.54.143.227"
SSH_KEY="$HOME/.ssh/oracle_key"
REMOTE_DIR="/home/ubuntu/migration-backup"
RESTORE_DIR="/tmp/restore-$$"

echo "╔══════════════════════════════════════╗"
echo "║  FASE 6: Restaurar configuración     ║"
echo "╚══════════════════════════════════════╝"

# Verificar SSH
ssh -o ConnectTimeout=10 -i "$SSH_KEY" "$VPS" "echo OK" || { echo "❌ SSH al VPS falló. Copia ~/.ssh/oracle_key primero."; exit 1; }

mkdir -p "$RESTORE_DIR"

echo ""
echo "[1/4] Descargando config-backup.tar.gz..."
scp -i "$SSH_KEY" "$VPS:$REMOTE_DIR/config-backup.tar.gz" "$RESTORE_DIR/"

echo "[2/4] Extrayendo..."
cd "$RESTORE_DIR" && tar xzf config-backup.tar.gz

echo "[3/4] Restaurando archivos..."

# Config opencode (NO sobrescribir si ya existe — merge manual después)
mkdir -p "$HOME/.config/opencode"
cp -rn "$RESTORE_DIR/.config/opencode/"* "$HOME/.config/opencode/" 2>/dev/null || true

# Plugins
cp -r "$RESTORE_DIR/.config/opencode/plugins/"* "$HOME/.config/opencode/plugins/" 2>/dev/null || true
mkdir -p "$HOME/.opencode/plugins"
cp -r "$RESTORE_DIR/.opencode/plugins/"* "$HOME/.opencode/plugins/" 2>/dev/null || true

# Binario opencode
mkdir -p "$HOME/.opencode/bin"
cp "$RESTORE_DIR/.opencode/bin/opencode" "$HOME/.opencode/bin/"
chmod +x "$HOME/.opencode/bin/opencode"

# Systemd services
mkdir -p "$HOME/.config/systemd/user/"
cp "$RESTORE_DIR/.config/systemd/user/"*.service "$HOME/.config/systemd/user/" 2>/dev/null || true

# Binarios locales
mkdir -p "$HOME/.local/bin"
cp "$RESTORE_DIR/.local/bin/"* "$HOME/.local/bin/" 2>/dev/null || true
chmod +x "$HOME/.local/bin/"* 2>/dev/null || true

# SSH key
mkdir -p "$HOME/.ssh/"
cp "$RESTORE_DIR/.ssh/oracle_key" "$HOME/.ssh/"
cp "$RESTORE_DIR/.ssh/oracle_key.pub" "$HOME/.ssh/"
cp "$RESTORE_DIR/.ssh/known_hosts" "$HOME/.ssh/" 2>/dev/null || true
chmod 600 "$HOME/.ssh/oracle_key"

# Gitconfig
cp "$RESTORE_DIR/.gitconfig" "$HOME/"

# nvm (solo versiones, no sobrescribir nvm install)
cp -r "$RESTORE_DIR/.config/nvm/versions/" "$HOME/.config/nvm/versions/" 2>/dev/null || true

# Engram data
cp -r "$RESTORE_DIR/.engram" "$HOME/" 2>/dev/null || true
cp -r "$RESTORE_DIR/.config/opencode/engram" "$HOME/.config/opencode/" 2>/dev/null || true
cp -r "$RESTORE_DIR/.config/opencode/memory.jsonl" "$HOME/.config/opencode/" 2>/dev/null || true

# octocode-mcp
cp -r "$RESTORE_DIR/.local/lib/octocode-mcp" "$HOME/.local/lib/" 2>/dev/null || true

echo "[4/4] Limpiando..."
rm -rf "$RESTORE_DIR"

echo ""
echo "✅ Config restaurada"
echo "Siguiente: 07-restore-projects.sh"
