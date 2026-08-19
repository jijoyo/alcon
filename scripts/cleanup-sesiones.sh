#!/bin/bash
# cleanup-sesiones.sh — Limpia opencode.db sesiones >60 días
# PRIMERO ingesta a Qdrant (append-only), DESPUÉS borra

set -euo pipefail

DB=~/.local/share/opencode/opencode.db
CUTOFF_DAYS=60
CUTOFF_MS=$((CUTOFF_DAYS * 86400 * 1000))
SERVER_URL="http://localhost:3003"

echo "[GC] $(date -Iseconds) Iniciando cleanup..."

# 1. Ingest local antes de borrar
echo "[GC] Ingestando DB local a Qdrant..."
if [ -f "$DB" ]; then
  curl -s -X POST "$SERVER_URL/api/memoria/ingest-granja" \
    -H "Content-Type: application/json" \
    -d "{\"device\":\"forja\",\"db_path\":\"$DB\"}" 2>/dev/null | \
    python3 -c "import sys,json; d=json.load(sys.stdin); print(f'  Ingeridos: {d.get(\"ingested\",0)}, Exportados: {d.get(\"exported\",0)}')" 2>/dev/null || echo "  Ingest failed (Qdrant offline?)"
fi

# 2. Borrar sesiones viejas
echo "[GC] Borrando sesiones >${CUTOFF_DAYS} días..."
if [ -f "$DB" ]; then
  # Usar node para manejar time_created en ms
  node -e "
    const Database = require('better-sqlite3');
    const db = new Database('$DB', { readonly: false });
    const cutoff = Date.now() - (${CUTOFF_DAYS} * 86400 * 1000);
    try {
      const result = db.prepare('DELETE FROM session WHERE time_created < ?').run(cutoff);
      db.prepare('VACUUM').run();
      console.log('  Eliminadas:', result.changes, 'sesiones');
    } catch(e) {
      console.log('  Error:', e.message);
    }
    db.close();
  " 2>/dev/null || echo "  Node cleanup failed, trying sqlite3..."
  
  # Fallback: sqlite3 CLI
  if command -v sqlite3 &>/dev/null; then
    sqlite3 "$DB" "DELETE FROM session WHERE time_created < (strftime('%s','now')*1000 - ${CUTOFF_MS}); VACUUM;" 2>/dev/null && echo "  sqlite3 cleanup OK"
  fi
  
  # Limpiar WAL/SHM
  rm -f "${DB}-shm" "${DB}-wal"
  echo "[GC] DB size: $(du -sh "$DB" 2>/dev/null | cut -f1)"
else
  echo "[GC] DB not found: $DB"
fi

echo "[GC] Cleanup completado"
echo "[GC] Stats:"
curl -s "$SERVER_URL/api/memoria/stats" 2>/dev/null | python3 -m json.tool 2>/dev/null || echo "  (Qdrant offline)"
