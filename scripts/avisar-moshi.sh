#!/bin/bash
# avisar-moshi.sh "titulo" ["detalle"] — push al cel vía Moshi webhook.
# Token en ~/.config/agente/moshi-token.txt (600). No loguea el token.
MSG="${1:-Alcon}"
DET="${2:-}"
for F in ~/.config/agente/moshi-token.txt ~/.config/agente/moshi-token-cel.txt; do
  TOKEN="$(cat "$F" 2>/dev/null)"
  [ -z "$TOKEN" ] && continue
  curl -s -m 15 -X POST https://api.getmoshi.app/api/webhook \
    -H "Content-Type: application/json" \
    -d "{\"token\":\"$TOKEN\",\"title\":\"[alcon] $MSG\",\"message\":\"$DET\"}" | head -c 60
  echo " -> $F"
done
