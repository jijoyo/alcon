#!/bin/bash
# check-card.sh <nombre> — verifica identidad casera del enjambre.
# OK si existe agent-cards/<nombre>.json con firma. Si no, avisa (rechazo suave).
# Uso: check-card.sh kali && echo autorizado
DIR="$(cd "$(dirname "$0")/../agent-cards" && pwd)"
N="$1"
[ -z "$N" ] && { echo "SIN-CARD (sin nombre)"; exit 1; }
F="$DIR/$N.json"
[ -f "$F" ] || { echo "SIN-CARD: $N no tiene agent-card (ver agent-cards/)"; exit 1; }
grep -q '"firmado_por"' "$F" || { echo "SIN-FIRMA: $N sin firma"; exit 1; }
echo "CARD-OK: $N ($(python3 -c "import json;print(json.load(open('$F'))['rol'])" 2>/dev/null))"
