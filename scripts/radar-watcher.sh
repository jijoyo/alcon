#!/usr/bin/env bash
# radar-watcher.sh — CHORIZO step 3
# Checks for pending jobs + no agent alive → starts radar via opencode
set -euo pipefail

DB="/home/israel/Documentos/alcon/server/db/alcon.db"
OPENCODE="/home/israel/.opencode/bin/opencode"
AGENT_BIN="/home/israel/Documentos/alcon/agents/agent.js"
NODE="/home/israel/.nvm/versions/node/v22.23.1/bin/node"
SERVER="http://100.102.63.30:3003"

# Count pending jobs
PENDING=$(sqlite3 "$DB" "SELECT COUNT(*) FROM tasks WHERE status='pendiente';" 2>/dev/null || echo 0)

if [ "$PENDING" -eq 0 ]; then
  exit 0
fi

# Check if any agent is already running (via systemd or pgrep)
if systemctl --user is-active alcon-debian-agent.service >/dev/null 2>&1; then
  exit 0
fi
if pgrep -f "agent\.js.*$SERVER" >/dev/null 2>&1; then
  exit 0
fi

# No agent alive + pending jobs → start radar
echo "[radar-watcher] $PENDING pending jobs, no agent alive — starting radar"
$NODE "$AGENT_BIN" radar "$SERVER" &
disown
