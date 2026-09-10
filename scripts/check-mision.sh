#!/bin/bash
# Trigger con condición: decide si vale despertar a alguien por una misión.
# Uso: check-mision.sh <mision.md>  →  imprime fire:true|fire:false + motivo
# fire:true solo si ESTADO=ACTIVA y hay mensaje nuevo de la contraparte.
# Estado persistente: /tmp/buzon-trigger.<nombre-mision>.state (last_count, interval)
MISION="${1:?ruta del archivo de mision}"
[ -f "$MISION" ] || { echo "fire:false (sin archivo de mision)"; exit 0; }
LOG=~/.alcon-buzon/inbox.log
NAME=$(basename "$MISION" .md)
STATE="/tmp/buzon-trigger.${NAME}.state"
BASE_MIN=5; MAX_MIN=30   # cadencia dinámica: 5 min con actividad, hasta 30 sin ella

ESTADO=$(grep -m1 "^ESTADO:" "$MISION" | awk '{print $2}')
[ "$ESTADO" = "ACTIVA" ] || { echo "fire:false (ESTADO=$ESTADO, misión no activa)"; exit 0; }

# Contraparte = quien no soy yo. Forja escucha a kali y viceversa.
PEER=$(grep -m1 "^PEER:" "$MISION" | awk '{print $2}'); PEER=${PEER:-kali}
now=$(grep -ac "$PEER" "$LOG" 2>/dev/null); now=${now:-0}
last=0; interval=$BASE_MIN
[ -f "$STATE" ] && source "$STATE" 2>/dev/null

if [ "$now" -gt "$last" ]; then
  interval=$BASE_MIN
  { echo "last=$now"; echo "interval=$interval"; } > "$STATE"
  echo "fire:true (mensaje nuevo de $PEER, intervalo reset a ${BASE_MIN}m)"
else
  interval=$(( interval * 2 )); [ "$interval" -gt "$MAX_MIN" ] && interval=$MAX_MIN
  { echo "last=$last"; echo "interval=$interval"; } > "$STATE"
  echo "fire:false (sin mensajes nuevos, próximo chequeo en ${interval}m)"
fi
