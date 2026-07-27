#!/bin/bash
# 02-upload-to-vps.sh — Subir backups al VPS
set -e

BAKDIR="/tmp/migration-$(date +%Y%m%d)"
VPS="ubuntu@159.54.143.227"
SSH_KEY="$HOME/.ssh/oracle_key"
REMOTE_DIR="/home/ubuntu/migration-backup"

echo "╔══════════════════════════════════════╗"
echo "║  FASE 2: Subir al VPS                ║"
echo "╚══════════════════════════════════════╝"

# Verificar que existen los backups
[ -f "$BAKDIR/config-backup.tar.gz" ] || { echo "❌ No existe config-backup.tar.gz"; exit 1; }
[ -f "$BAKDIR/projects.tar.zst" ] || { echo "❌ No existe projects.tar.zst"; exit 1; }

# Verificar espacio en VPS
echo ""
echo "[PRE] Verificando VPS..."
ssh -o ConnectTimeout=10 -i "$SSH_KEY" "$VPS" "mkdir -p $REMOTE_DIR" || { echo "❌ VPS no alcanzable"; exit 1; }

VPS_FREE=$(ssh -i "$SSH_KEY" "$VPS" "df -B1 / | tail -1 | awk '{print \$4}'")
CONFIG_SIZE=$(stat -c%s "$BAKDIR/config-backup.tar.gz")
PROJECTS_SIZE=$(stat -c%s "$BAKDIR/projects.tar.zst")
TOTAL_NEEDED=$((CONFIG_SIZE + PROJECTS_SIZE))

echo "   VPS libre: $((VPS_FREE / 1024 / 1024 / 1024))GB"
echo "   Total a subir: $((TOTAL_NEEDED / 1024 / 1024 / 1024))GB"

if [ "$TOTAL_NEEDED" -gt "$VPS_FREE" ]; then
    echo "⚠️  No hay espacio suficiente en VPS!"
    echo "   Necesario: $((TOTAL_NEEDED / 1024 / 1024 / 1024))GB"
    echo "   Disponible: $((VPS_FREE / 1024 / 1024 / 1024))GB"
    echo "   Opción: Subir solo config y hacer rsync directo Kali→Debian"
    read -p "¿Continuar solo con config? (yes/no) " confirm
    [ "$confirm" = "yes" ] || exit 1
fi

# Subir config (rápido, ~355MB)
echo ""
echo "[1/2] Subiendo config-backup.tar.gz..."
scp -i "$SSH_KEY" "$BAKDIR/config-backup.tar.gz" "$VPS:$REMOTE_DIR/"
echo "   ✅ Config subido"

# Subir proyectos (lento, ~9.7GB)
echo ""
echo "[2/2] Subiendo projects.tar.zst (esto toma ~5-10 min)..."
scp -i "$SSH_KEY" "$BAKDIR/projects.tar.zst" "$VPS:$REMOTE_DIR/"
echo "   ✅ Proyectos subidos"

# Verificar
echo ""
echo "Verificando en VPS..."
ssh -i "$SSH_KEY" "$VPS" "ls -lh $REMOTE_DIR/"

echo ""
echo "╔══════════════════════════════════════╗"
echo "║  VPS LISTO PARA MIGRACIÓN            ║"
echo "╚══════════════════════════════════════╝"
echo ""
echo "Siguiente paso: En Debian, instalar Tailscale y correr scripts 03-12"
