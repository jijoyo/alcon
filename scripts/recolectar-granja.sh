#!/bin/bash
# recolectar-granja.sh — Recolecta opencode.db de toda la granja via tailscale
# Append-only: nunca borra sin antes exportar a .md y upsert a Qdrant

set -euo pipefail

LOG_DIR="$HOME/Documentos/alcon/rag_data"
LOG_FILE="$LOG_DIR/recolecta.log"
SERVER_URL="http://localhost:3003"
CUTOFF_DAYS=60

mkdir -p "$LOG_DIR"

log() {
  echo "[$(date -Iseconds)] $1" | tee -a "$LOG_FILE"
}

# DEVICES: ip:nombre
DEVICES=(
  "100.121.64.26:forja"
  "100.103.82.104:kali"
  "100.102.63.30:vps"
  "100.76.111.99:cel"
)

log "=== Iniciando recolección de granja ==="

for entry in "${DEVICES[@]}"; do
  IP="${entry%%:*}"
  DEVICE="${entry##*:}"
  log "--- Procesando $DEVICE ($IP) ---"

  REMOTE_DB="$HOME/.local/share/opencode/opencode.db"
  LOCAL_DB="/tmp/opencode_${DEVICE}.db"

  # 1. Copiar DB remota
  log "  Copiando DB desde $IP..."
  if scp -o ConnectTimeout=5 -o StrictHostKeyChecking=no "$IP:$REMOTE_DB" "$LOCAL_DB" 2>/dev/null; then
    log "  DB copiada: $(du -sh "$LOCAL_DB" 2>/dev/null | cut -f1)"
  else
    log "  ERROR: No se pudo copiar DB de $IP"
    continue
  fi

  # 2. Ingest via API
  log "  Ingestando a Qdrant via API..."
  RESPONSE=$(curl -s -X POST "$SERVER_URL/api/memoria/ingest-granja" \
    -H "Content-Type: application/json" \
    -d "{\"device\":\"$DEVICE\",\"db_path\":\"$LOCAL_DB\"}" 2>/dev/null)

  if echo "$RESPONSE" | grep -q '"ingested"'; then
    INGESTED=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('ingested',0))" 2>/dev/null || echo "0")
    EXPORTED=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('exported',0))" 2>/dev/null || echo "0")
    log "  OK: $INGESTED ingeridos, $EXPORTED exportados"
  else
    log "  ERROR: $RESPONSE"
  fi

  # 3. Cleanup remoto: borrar sesiones viejas (>60 días)
  log "  Limpiando sesiones >${CUTOFF_DAYS} días en $IP..."
  SSH_CMD="sqlite3 $REMOTE_DB \"DELETE FROM session WHERE time_created < (strftime('%s','now')*1000 - ${CUTOFF_DAYS}*86400000); VACUUM;\" 2>/dev/null && rm -f ${REMOTE_DB}-shm ${REMOTE_DB}-wal && echo 'Limpio' || echo 'Cleanup failed'"
  if ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no "$IP" "$SSH_CMD" 2>/dev/null; then
    log "  Cleanup OK en $IP"
  else
    log "  WARN: No se pudo limpiar $IP (¿sin sudo?)"
  fi

  # 4. Cleanup local
  rm -f "$LOCAL_DB" "${LOCAL_DB}-shm" "${LOCAL_DB}-wal"

  log "--- $DEVICE completado ---"
done

log "=== Recolección completada ==="

# Stats
log "Stats finales:"
curl -s "$SERVER_URL/api/memoria/stats" 2>/dev/null | python3 -m json.tool >> "$LOG_FILE" 2>/dev/null || true
