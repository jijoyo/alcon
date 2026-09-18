#!/usr/bin/env bash
# hp-pull.sh — espejo HP se jala solo (opción B, P-085).
# Solo fast-forward (--ff-only): si el HP divergió, NO toca nada (log y sale).
# Uso en HP: HP_REPO=~/alcon HP_RESTART="pm2 restart all" ./hp-pull.sh
# Instalación una vez (manos en HP): copiar systemd/hp/* a ~/.config/systemd/user/,
#   systemctl --user daemon-reload && systemctl --user enable --now hp-pull.timer
set -u
REPO="${HP_REPO:-$HOME/alcon}"
RESTART="${HP_RESTART:-}"
LOG="${HP_PULL_LOG:-$HOME/hp-pull.log}"
ts() { date '+%F %T'; }

if [ ! -d "$REPO/.git" ]; then
  echo "$(ts) SKIP: $REPO no es repo git" | tee -a "$LOG"
  exit 0
fi
git -C "$REPO" fetch origin main >>"$LOG" 2>&1
LOCAL=$(git -C "$REPO" rev-parse HEAD)
REMOTE=$(git -C "$REPO" rev-parse origin/main)
if [ "$LOCAL" = "$REMOTE" ]; then
  echo "$(ts) OK: ya en $LOCAL" >>"$LOG"
  exit 0
fi
if git -C "$REPO" pull --ff-only origin main >>"$LOG" 2>&1; then
  echo "$(ts) PULL: $LOCAL -> $REMOTE" | tee -a "$LOG"
  if [ -n "$RESTART" ]; then
    # shellcheck disable=SC2086
    $RESTART >>"$LOG" 2>&1 || echo "$(ts) WARN: restart falló" | tee -a "$LOG"
  fi
else
  echo "$(ts) HOLD: diverge, no toco (hacerlo a mano)" | tee -a "$LOG"
  exit 0
fi
