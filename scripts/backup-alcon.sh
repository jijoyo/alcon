#!/bin/bash
# Backup Alcon: snapshot Qdrant + dump jobs SQLite → HP (fierro propio).
# Uso manual: scripts/backup-alcon.sh | Cron: 0 4 * * 0
FECHA=$(date +%F)
HP_SERVER="${HP_SERVER:-100.107.54.12}"
REMOTE_DIR="backups/$FECHA"  # relativo al home remoto (evitar expansión local de ~)
mkdir -p /tmp/backup-alcon

# 1. Snapshot Qdrant (colección alcon)
SNAP=$(curl -s -m 60 -X POST http://localhost:6333/collections/alcon/snapshots | python3 -c "import json,sys; print(json.load(sys.stdin)['result']['name'])")
curl -s -m 120 "http://localhost:6333/collections/alcon/snapshots/$SNAP" -o "/tmp/backup-alcon/qdrant-alcon-$FECHA.snapshot" || exit 1

# 2. Dump jobs (SQLite: copiar db+wal+shm, restore = juntarlos)
mkdir -p "/tmp/backup-alcon/jobs-$FECHA" && cp server/alcon.db* "/tmp/backup-alcon/jobs-$FECHA/"

# 3. Engram local (memoria que no está en git)
tar czf "/tmp/backup-alcon/engram-$FECHA.tgz" -C ~ .engram 2>/dev/null

# 4. Envío a HP
ssh -o BatchMode=yes "server@$HP_SERVER" "mkdir -p $REMOTE_DIR" || exit 1
scp -o BatchMode=yes -r /tmp/backup-alcon/* "server@$HP_SERVER:$REMOTE_DIR/" && echo "backup $FECHA en HP OK"
rm -rf /tmp/backup-alcon
