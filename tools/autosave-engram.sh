#!/usr/bin/env bash
# autosave-engram.sh — duende externo para alcon (P-108, opción 3).
# El plugin no carga en sesiones desktop (4 probes ciegos); esto no depende del host:
# cada 15 min, si hay trabajo sin guardar (git dirty), retrato factual a Engram.
# Freno doble como el plugin: dirty + intervalo lo da el timer (15min).
# Uso: tools/autosave-engram.sh  |  Proyecto: ver PROJ abajo (fijo por proyecto, no inventar)
set -u
# Anti-solape: dos disparos juntos (manual+timer) no duplican
[ -n "${FLOCKED:-}" ] || exec env FLOCKED=1 flock -n /tmp/autosave-engram.lock "$0" "$@"
REPO="$HOME/Documentos/alcon"
PROJ="alcon"
cd "$REPO" || exit 0
ST=$(git status --short 2>/dev/null | head -n 10)
if [ -z "$ST" ]; then
  echo "$(date '+%F %T') limpio: sin disparo"
  exit 0
fi
BR=$(git branch --show-current 2>/dev/null || echo "?")
STAMP=$(date -u +%FT%TZ)
TITLE="Checkpoint auto $PROJ $STAMP (timer externo)"
BODY="Trigger: timer 15min $STAMP
Rama: $BR
Cambios:
$ST"
if OUT=$("$HOME/.local/bin/engram" save "$TITLE" "$BODY" --type evidence --project "$PROJ" 2>&1); then
  echo "$OUT" | grep -q "Memory saved" && echo "$(date '+%F %T') checkpoint guardado (rama $BR)" || { echo "$(date '+%F %T') FALLO save (sin Memory saved)"; echo "$OUT" | head -n 3; }
else
  echo "$(date '+%F %T') FALLO save rc=$?"; echo "$OUT" | head -n 3
fi
