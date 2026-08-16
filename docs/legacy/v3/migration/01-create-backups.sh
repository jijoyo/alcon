#!/bin/bash
# 01-create-backups.sh — Empaquetar config + proyectos para migración
set -e

BAKDIR="/tmp/migration-$(date +%Y%m%d)"
mkdir -p "$BAKDIR"

echo "╔══════════════════════════════════════╗"
echo "║  FASE 1: Crear backups               ║"
echo "╚══════════════════════════════════════╝"

# --- Tarball 1: Config (~355MB) ---
echo ""
echo "[1/2] Empaquetando configuración..."
tar czf "$BAKDIR/config-backup.tar.gz" \
  --exclude='*.save' --exclude='*.save.*' --exclude='*.BAK*' \
  --exclude='node_modules' --exclude='engram/memory.jsonl' \
  --exclude='__pycache__' \
  -C ~ \
  .config/opencode \
  .config/systemd/user \
  .opencode/bin/opencode \
  .opencode/plugins \
  .gitconfig \
  .ssh/oracle_key \
  .ssh/oracle_key.pub \
  .ssh/known_hosts \
  .config/nvm \
  .bashrc \
  .local/bin/engram \
  .local/bin/stv-mcp \
  .local/bin/crc32c \
  .local/bin/oci \
  .local/bin/jp.py \
  .local/bin/create_backup_from_onprem \
  .local/lib/octocode-mcp \
  .engram \
  2>/dev/null

echo "   Config: $(du -sh "$BAKDIR/config-backup.tar.gz" | cut -f1)"

# --- Tarball 2: Proyectos (~9.7GB sin node_modules) ---
echo ""
echo "[2/2] Empaquetando proyectos (esto toma ~2 min)..."
tar --zstd -cf "$BAKDIR/projects.tar.zst" \
  --exclude='node_modules' --exclude='__pycache__' \
  --exclude='dist' --exclude='.angular' \
  --exclude='*.zip' \
  -C ~/Documentos \
  dose-dash-digital \
  alcon \
  opencode-lab/.opencode \
  ai-automation-agency \
  azteca-unlocked \
  kodi-mcp-server \
  youtube-knowledge \
  yt-dlp-power \
  remote-control-tv \
  2>/dev/null

echo "   Proyectos: $(du -sh "$BAKDIR/projects.tar.zst" | cut -f1)"

# --- Resumen ---
echo ""
echo "╔══════════════════════════════════════╗"
echo "║  BACKUPS CREADOS                     ║"
echo "╚══════════════════════════════════════╝"
ls -lh "$BAKDIR/"
echo ""
echo "Total: $(du -sh "$BAKDIR" | cut -f1)"
echo "Directorio: $BAKDIR"
