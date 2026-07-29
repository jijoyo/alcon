#!/bin/bash
# 11-degrade-kali.sh — Degradar Kali a modo espejo (Fase 8 - Meta)
# Ejecutar en Kali DESPUÉS de que Debian esté coronada
set -e

echo "╔══════════════════════════════════════╗"
echo "║  FASE 8: Degradar Kali a respaldo    ║"
echo "╚══════════════════════════════════════╝"

echo ""
echo "=== PAUSAR SERVICIOS Kali ==="
pm2 stop all 2>/dev/null && echo "✅ pm2 stop all" || echo "⚠️ pm2 not running"
pm2 save 2>/dev/null || true

echo ""
echo "=== DESHABILITAR OLLAMA ROTO ==="
systemctl --user disable --now ollama 2>/dev/null && echo "✅ ollama user service disabled" || echo "⚠️ ollama user service not found"

echo ""
echo "=== CRONTAB: git pull cada hora ==="
CRON_CMD="0 * * * * cd ~/Documentos/alcon && git pull origin main"
(crontab -l 2>/dev/null | grep -v "git pull origin main"; echo "$CRON_CMD") | crontab -
echo "✅ crontab: git pull cada hora"

echo ""
echo "=== RESUMEN ==="
echo "Kali ahora es ESPEJO de respaldo:"
echo "  - pm2 detenido"
echo "  - ollama deshabilitado"
echo "  - git pull automático cada hora desde VPS"
echo ""
echo "Si Debian falla:"
echo "  1. Cambia IP en Termux a la de Kali"
echo "  2. Kali ya tiene todo instalado"
echo "  3. pm2 start all para levantar servicios"
