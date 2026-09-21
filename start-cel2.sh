#!/data/data/com.termux/files/usr/bin/bash
# start-cel2.sh — agente cel2 vivo contra HP (espejo, solo pull).
# Uso manual: bash ~/alcon/start-cel2.sh · Auto: ~/.termux/boot/alcon-cel2-boot.sh
termux-wake-lock 2>/dev/null
unset LD_PRELOAD LD_LIBRARY_PATH
cd ~/alcon || exit 1
export AGENT_BRAIN=opencode AGENT_MODEL=opencode/big-pickle
if pgrep -f "[a]gent.js cel2" >/dev/null 2>&1; then
  echo "cel2 ya corre"
  exit 0
fi
setsid nohup node agents/agent.js cel2 http://100.107.54.12:3003 >> ~/cel2-agent.log 2>&1 &
echo "cel2 lanzado"
