#!/bin/bash
# verificar-backup.sh — solo LEE y avisa. No toca nada.
# Cron: 0 8 1 * * (día 1 de cada mes). Si no hay backup reciente, notify + log.
HP="${HP_SERVER:-100.107.54.12}"
OUT=$(ssh -o BatchMode=yes -o ConnectTimeout=15 "server@$HP" "ls -dt ~/backups/*/ 2>/dev/null | head -1" 2>&1)
if [ -z "$OUT" ]; then
  MSG="SIN backups en HP — revisar cron backup-alcon"
else
  AGE=$(( ($(date +%s) - $(ssh -o BatchMode=yes "server@$HP" "stat -c %Y '$OUT' 2>/dev/null" || echo 0)) / 86400 ))
  if [ "$AGE" -gt 10 ]; then MSG="Backup HP viejo: $OUT ($AGE días)"; else MSG="Backup HP OK: $OUT ($AGE días)"; fi
fi
echo "[$(date +%F)] $MSG" | tee -a /tmp/verificar-backup.log
notify-send "📦 Backup Alcon" "$MSG" 2>/dev/null
