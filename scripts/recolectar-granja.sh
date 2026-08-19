#!/bin/bash
# recolectar-granja.sh — Best-effort: ping antes de SCP, no falla si device offline
# Append-only: nunca borra sin antes exportar a .md y upsert a Qdrant

set -uo pipefail

LOG_DIR="$HOME/Documentos/alcon/rag_data"
LOG_FILE="$LOG_DIR/recolecta.log"
SERVER_URL="http://localhost:3003"
TIMEOUT=5

mkdir -p "$LOG_DIR"

log() {
  local msg="[$(date -Iseconds)] $1"
  echo "$msg" | tee -a "$LOG_FILE"
}

check_ssh() {
  local ip=$1
  ssh -o ConnectTimeout=$TIMEOUT -o StrictHostKeyChecking=no -o BatchMode=yes "$ip" "echo 1" 2>/dev/null
}

# devices: ip:nombre
DEVICES=(
  "100.121.64.26:forja"
  "100.103.82.104:kali"
  "100.102.63.30:vps"
  "100.122.196.23:cel"
)

log "=== Recolección granja ==="
ONLINE=0
OFFLINE=0

for entry in "${DEVICES[@]}"; do
  IP="${entry%%:*}"
  DEVICE="${entry##*:}"
  log "--- $DEVICE ($IP) ---"

  # ping check
  if ! ping -c 1 -W $TIMEOUT "$IP" >/dev/null 2>&1; then
    log "  OFFLINE (ping falló)"
    ((OFFLINE++))
    continue
  fi

  # ssh check
  if ! check_ssh "$IP"; then
    log "  OFFLINE (ssh falló)"
    ((OFFLINE++))
    continue
  fi

  log "  ONLINE"
  ((ONLINE++))

  # copiar DB
  REMOTE_DB="$HOME/.local/share/opencode/opencode.db"
  LOCAL_DB="/tmp/opencode_${DEVICE}.db"

  log "  Copiando DB..."
  if scp -o ConnectTimeout=$TIMEOUT -o StrictHostKeyChecking=no "$IP:$REMOTE_DB" "$LOCAL_DB" 2>/dev/null; then
    log "  DB: $(du -sh "$LOCAL_DB" 2>/dev/null | cut -f1)"
  else
    log "  ERROR: SCP falló"
    continue
  fi

  # ingest
  log "  Ingestando..."
  RESPONSE=$(curl -s --max-time 120 -X POST "$SERVER_URL/api/memoria/ingest-granja" \
    -H "Content-Type: application/json" \
    -d "{\"device\":\"$DEVICE\",\"db_path\":\"$LOCAL_DB\"}" 2>/dev/null)

  if echo "$RESPONSE" | grep -q '"ingested"'; then
    INGESTED=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('ingested',0))" 2>/dev/null || echo "?")
    EXPORTED=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('exported',0))" 2>/dev/null || echo "?")
    log "  OK: $INGESTED ingeridos, $EXPORTED exportados"
  else
    log "  ERROR: respuesta inválida"
  fi

  # cleanup local
  rm -f "$LOCAL_DB" "${LOCAL_DB}-shm" "${LOCAL_DB}-wal"
  log "--- $DEVICE completado ---"
done

log "=== Resumen: $ONLINE online, $OFFLINE offline ==="
curl -s "$SERVER_URL/api/memoria/stats" 2>/dev/null | python3 -m json.tool >> "$LOG_FILE" 2>/dev/null || true
