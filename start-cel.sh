#!/data/data/com.termux/files/usr/bin/bash
# start-cel.sh — agente cel vivo contra HP (espejo, solo pull).
# Uso manual: bash ~/alcon/start-cel.sh · Auto: ~/.termux/boot/alcon-boot.sh
termux-wake-lock 2>/dev/null
cd ~/alcon || exit 1
export AGENT_BRAIN=opencode AGENT_MODEL=opencode/muse-spark-1.3-contributor-free
if pgrep -f "[a]gent.js cel " >/dev/null 2>&1 || pgrep -f "[a]gent.js cel$" >/dev/null 2>&1; then
  echo "cel ya corre"
  exit 0
fi
setsid nohup node agents/agent.js cel http://100.107.54.12:3003 >> ~/cel-agent.log 2>&1 &
echo "cel lanzado"
