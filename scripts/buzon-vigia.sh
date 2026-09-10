#!/bin/bash
# Vigía v2 con ciclo de vida: vive solo mientras la misión está ACTIVA.
# Se apaga solo cuando: ESTADO=LISTO|AYUDA, idle supera IDLE_MAX, o vence MAX_MINUTOS.
# Uso: scripts/buzon-vigia.sh agent-inbox/mision-forja-kali.md
MISION="${1:?ruta del archivo de mision}"
SCRIPTS="$(cd "$(dirname "$0")" && pwd)"
NAME=$(basename "$MISION" .md)
STATE="/tmp/buzon-trigger.${NAME}.state"
LOG=~/.alcon-buzon/inbox.log
SEEN=/tmp/buzon-vigia.seen
estado() { grep -m1 "^ESTADO:" "$MISION" | awk '{print $2}'; }
campo()  { grep -m1 "^$1:" "$MISION" | awk '{print $2}'; }
notify() { notify-send "📡 $1" "$2" 2>/dev/null; echo "[vigia $(date +%H:%M:%S)] $1: $2"; }

INICIO_EPOCH=$(date +%s)
ULT_ACT=$INICIO_EPOCH
touch "$SEEN"
echo "$(grep -ac "kali" "$LOG" 2>/dev/null)" > "$SEEN"

MAX_MIN=$(campo MAX_MINUTOS); MAX_MIN=${MAX_MIN:-120}
IDLE_MAX=$(campo IDLE_MAX_MINUTOS); IDLE_MAX=${IDLE_MAX:-30}

while true; do
  # Trigger con condición: solo hay prisa si fire:true; si no, dormir el intervalo dinámico
  FIRERES=$("$SCRIPTS/check-mision.sh" "$MISION" 2>/dev/null | grep -m1 "^fire:")
  INT=$(grep -m1 "^interval=" "$STATE" 2>/dev/null | cut -d= -f2); INT=${INT:-5}
  case "$FIRERES" in fire:true*) ULT_ACT=$(date +%s); notify "Kali escribió" "$(grep -a "kali" "$LOG" | tail -1 | head -c 200)" ;; esac
  sleep $(( INT * 60 ))
  E=$(estado)
  # 1. Misión cerrada => avisar una vez y morir
  if [ "$E" = "LISTO" ] || [ "$E" = "AYUDA" ]; then
    notify "Misión $E" "El vigía se apaga. Revisa la misión."
    exit 0
  fi
  # 2. Sin archivo o sin estado => morir (nadie lo necesita)
  if [ -z "$E" ] || [ ! -f "$MISION" ]; then
    exit 0
  fi
  # 3. Vida máxima => morir avisando
  if [ $(( $(date +%s) - INICIO_EPOCH )) -gt $(( MAX_MIN * 60 )) ]; then
    notify "Vigía apagado" "Venció MAX_MINUTOS ($MAX_MIN min). Misión sigue $E."
    exit 0
  fi
  # 4. Mensaje nuevo lo detecta el trigger (check-mision actualiza last=); aquí solo idle
  # 5. Idle largo => dormirse avisando
  if [ $(( $(date +%s) - ULT_ACT )) -gt $(( IDLE_MAX * 60 )) ]; then
    notify "Vigía dormido" "Sin actividad ${IDLE_MAX} min. Me apago; re-actívame con una misión."
    exit 0
  fi
done
