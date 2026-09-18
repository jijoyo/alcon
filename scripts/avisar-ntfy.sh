#!/bin/bash
# avisar-ntfy.sh "titulo" ["detalle"] — push via ntfy propio en HP (sin rate-limit).
# Credencial en ~/.config/agente/ntfy-hp.txt (600). Suscribirse: app ntfy Android ->
# http://100.107.54.12:2586, topic alcon, usuario alcon + misma clave.
MSG="${1:-Alcon}"
DET="${2:-}"
P="$(cat ~/.config/agente/ntfy-hp.txt 2>/dev/null)"
[ -z "$P" ] && { echo "sin credencial ntfy"; exit 1; }
curl -s -m 15 -u "alcon:$P" -H "Title: [alcon] $MSG" -d "$DET" http://100.107.54.12:2586/alcon | head -c 60
echo
