#!/bin/bash
# f4-tick.sh — compuerta F4: solo despierta al modelo si hay mensaje nuevo.
# Sin novedad = cero llamadas, cero sesiones basura, cero cuota quemada.
# Uso en cron: f4-tick.sh "<prompt-trabajo>" [log]
LOG_FILE="${HOME}/.alcon-buzon/inbox.log"
SEEN="/tmp/f4-tick.seen"
PROMPT="$1"
OUT="${2:-/tmp/f4-tick.log}"
# Novedad = líneas recibidas (todo menos mis propios ENVIÓ)
total=$(wc -l < "$LOG_FILE" 2>/dev/null); total=${total:-0}
mine=$(grep -ac "ENVIÓ" "$LOG_FILE" 2>/dev/null); mine=${mine:-0}
now=$(( total - mine ))
last=0; [ -f "$SEEN" ] && last=$(cat "$SEEN")
echo "$now" > "$SEEN"
if [ "$now" -le "$last" ]; then exit 0; fi
# Hay novedad: 1 ronda con el modelo indicado por $F4_MODEL (default spark free)
MODEL="${F4_MODEL:-opencode/muse-spark-1.3-contributor-free}"
OC="${OPENCODE_BIN:-$HOME/.opencode/bin/opencode}"
cd ~ && timeout 500 "$OC" run --model "$MODEL" "$PROMPT" >> "$OUT" 2>&1
