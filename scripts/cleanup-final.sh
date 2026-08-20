#!/bin/bash
CUTOFF_MS=$(( $(date +%s%3N) - 60*24*3600*1000 ))
LOG=/home/israel/Documentos/alcon/rag_data/cleanup.log
mkdir -p $(dirname $LOG)
echo "[$(date)] CUTOFF 60d = $CUTOFF_MS" | tee -a $LOG
for DB in /home/israel/.local/share/opencode/opencode.db /tmp/opencode_*.db; do
  [ -f "$DB" ] || continue
  COUNT_BEFORE=$(sqlite3 "$DB" "SELECT COUNT(*) FROM session;" 2>/dev/null || echo 0)
  SIZE_BEFORE=$(du -h "$DB" | cut -f1)
  echo "[$(date)] $DB ANTES: $SIZE_BEFORE COUNT=$COUNT_BEFORE" | tee -a $LOG
  sqlite3 "$DB" "DELETE FROM session WHERE time_created < $CUTOFF_MS; VACUUM; PRAGMA wal_checkpoint(TRUNCATE);"
  rm -f "${DB}-shm" "${DB}-wal"
  COUNT_AFTER=$(sqlite3 "$DB" "SELECT COUNT(*) FROM session;" 2>/dev/null || echo 0)
  SIZE_AFTER=$(du -h "$DB" | cut -f1)
  echo "[$(date)] $DB DESPUES: $SIZE_AFTER COUNT=$COUNT_AFTER" | tee -a $LOG
done
echo "[$(date)] RAG stats: $(curl -s http://localhost:3003/api/memoria/stats)" | tee -a $LOG
