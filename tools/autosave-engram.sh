#!/usr/bin/env bash
# autosave-engram.sh — duende externo para alcon (P-108, opción 3).
# El plugin no carga en sesiones desktop (4 probes ciegos); esto no depende del host:
# cada 15 min, si hay trabajo sin guardar (git dirty), retrato factual a Engram.
# Freno doble como el plugin: dirty + intervalo lo da el timer (15min).
# Uso: tools/autosave-engram.sh  |  Proyecto: ver PROJ abajo (fijo por proyecto, no inventar)
set -u
# Anti-solape: dos disparos juntos (manual+timer) no duplican
REPO="$HOME/Documentos/alcon"
PROJ="alcon"
# Anti-solape por proyecto (locks globales serializaban timers independientes)
LOCK="/tmp/autosave-alcon.lock"
[ -n "${FLOCKED:-}" ] || exec env FLOCKED=1 flock -n "$LOCK" "$0" "$@"
cd "$REPO" || exit 0
ST=$(git status --short 2>/dev/null | head -n 10)
if [ -z "$ST" ]; then
  echo "$(date '+%F %T') limpio: sin disparo"
  exit 0
fi
BR=$(git branch --show-current 2>/dev/null || echo "?")
# Freno contenido: si el status es idéntico al último guardado, no aporta nada
HASHFILE="/tmp/autosave-engram-hash-$(echo $PROJ | tr -cd 'a-z0-9').txt"
NEWHASH=$(echo "$ST" | md5sum | cut -d" " -f1)
if [ -f "$HASHFILE" ] && [ "$(cat "$HASHFILE")" = "$NEWHASH" ]; then
  echo "$(date '+%F %T') sin cambios desde último checkpoint: sin disparo"
  exit 0
fi
STAMP=$(date -u +%FT%TZ)
TITLE="Checkpoint auto $PROJ $STAMP (timer externo)"
BODY="Trigger: timer 15min $STAMP
Rama: $BR
Cambios:
$ST"
if OUT=$("$HOME/.local/bin/engram" save "$TITLE" "$BODY" --type evidence --project "$PROJ" 2>&1); then
  echo "$OUT" | grep -q "Memory saved" && { echo "$NEWHASH" > "$HASHFILE"; echo "$(date '+%F %T') checkpoint guardado (rama $BR)"; } || { echo "$(date '+%F %T') FALLO save (sin Memory saved)"; echo "$OUT" | head -n 3; }
else
  echo "$(date '+%F %T') FALLO save rc=$?"; echo "$OUT" | head -n 3
fi
