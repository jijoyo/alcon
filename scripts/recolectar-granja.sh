#!/bin/bash
# recolectar-granja.sh — Best-effort con tailscale ssh
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
  local user=$2
  # VPS usa Tailscale SSH (no tiene SSH key), el resto SSH regular
  if [ "$ip" = "100.102.63.30" ]; then
    timeout $TIMEOUT tailscale ssh "$user@$ip" "echo 1" 2>/dev/null
  else
    timeout $TIMEOUT ssh -o ConnectTimeout=$TIMEOUT -o StrictHostKeyChecking=no -o BatchMode=yes "$ip" "echo 1" 2>/dev/null
  fi
}

copy_db() {
  local ip=$1
  local user=$2
  local remote_db=$3
  local local_db=$4
  if [ "$ip" = "100.102.63.30" ]; then
    # VPS: SCP via tailscale nc ProxyCommand (~2min para 55MB)
    log "  (VPS: copiando via tunnel, ~2min)"
    scp -o "ProxyCommand=tailscale nc %h %p" -o StrictHostKeyChecking=no \
      "$user@$ip:$remote_db" "$local_db" 2>/dev/null
  else
    scp -o ConnectTimeout=$TIMEOUT -o StrictHostKeyChecking=no "$ip:$remote_db" "$local_db" 2>/dev/null
  fi
}

# devices: tailscale_host:nombre
DEVICES=(
  "israel@100.121.64.26:forja"
  "jijoyo@100.103.82.104:kali"
  "ubuntu@100.102.63.30:vps"
  "u0_a366@100.122.196.23:cel"
  "u0_a339@100.96.34.100:cel2"
)

log "=== Recolección granja ==="
ONLINE=0
OFFLINE=0

for entry in "${DEVICES[@]}"; do
  HOST="${entry%%:*}"
  DEVICE="${entry##*:}"
  IP="${HOST#*@}"
  USER="${HOST%%@*}"
  log "--- $DEVICE ($HOST) ---"

  # ping check
  if ! ping -c 1 -W $TIMEOUT "$IP" >/dev/null 2>&1; then
    log "  OFFLINE (ping falló)"
    ((OFFLINE++))
    continue
  fi

  # ssh check
  if ! check_ssh "$IP" "$USER"; then
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
  if copy_db "$IP" "$USER" "$REMOTE_DB" "$LOCAL_DB" 2>/dev/null; then
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
