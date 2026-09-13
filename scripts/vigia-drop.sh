#!/bin/bash
# vigia-drop.sh — Vigía parametrizable de drops por cable/disco.
# Uso: vigia-drop.sh <drop_dir> [log_path] [keywords_regex] [interval_s]
# Ejemplo: vigia-drop.sh /run/media/jijoyo/Externo/debian-drop "$HOME/.alcon-buzon/inbox.log" "hash|fino|terminó|LISTO" 30
# Alarma: speaker-test + log /tmp/vigia-drop.log . Vive aunque la sesión duerma.
DROP="${1:-/tmp}"
LOG="${2:-$HOME/.alcon-buzon/inbox.log}"
KEYS="${3:-hash|fino|terminó|LISTO|verific}"
INTERVAL="${4:-30}"
VLOG="/tmp/vigia-drop.log"
SEEN="$LOG.seen"
[ -f "$LOG" ] && tail -1 "$LOG" > "$SEEN" 2>/dev/null
PREV=$(du -sb "$DROP" 2>/dev/null | cut -f1); PREV=${PREV:-0}
ESTABLE=0
alarma() {
  echo "[$(date -u +%H:%M:%S)] VIGIA-ALARMA: $1" >> "$VLOG"
  speaker-test -t sine -f 880 -l 2 -P 4 >/dev/null 2>&1
  sleep 1
  speaker-test -t sine -f 880 -l 2 -P 4 >/dev/null 2>&1
}
echo "[$(date -u +%H:%M:%S)] VIGIA armado drop=$DROP keys=$KEYS interval=$INTERVAL" >> "$VLOG"
while true; do
  sleep "$INTERVAL"
  LAST=$(tail -1 "$LOG" 2>/dev/null)
  OLD=$(cat "$SEEN" 2>/dev/null)
  if [ "$LAST" != "$OLD" ]; then
    echo "$LAST" > "$SEEN"
    if echo "$LAST" | grep -qiE "$KEYS"; then
      alarma "buzón: $LAST"
      exit 0
    fi
  fi
  SZ=$(du -sb "$DROP" 2>/dev/null | cut -f1)
  if [ -n "$SZ" ] && [ "$SZ" -ge 171798691840 ] 2>/dev/null; then
    if [ "$SZ" = "$PREV" ]; then ESTABLE=$((ESTABLE+1)); else ESTABLE=0; fi
    if [ "$ESTABLE" -ge 2 ]; then
      alarma "drop estable en $(du -sh "$DROP" | cut -f1)"
      exit 0
    fi
  else
    ESTABLE=0
  fi
  PREV=$SZ
done
