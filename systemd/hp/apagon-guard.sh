#!/bin/bash
# Instalado en HP: /usr/local/bin/apagon-guard.sh (chmod +x)
# Disparo: regla udev 99-apagon-guard.rules -> apagon-guard.service (system)
# Si el HP queda en pila mas de $GRACE segundos, apagado limpio por sistema.
GRACE="${GRACE:-300}"
STEP=15
AC="${SYSFS:-/sys/class/power_supply}/ACAD/online"
n=0
while [ "$n" -lt "$GRACE" ]; do
  sleep "$STEP"; n=$((n+STEP))
  grep -qx 1 "$AC" 2>/dev/null && exit 0
done
logger -t apagon-guard "sin AC ${GRACE}s, apagando sistema"
[ "$DRYRUN" = 1 ] && { echo 'DRYRUN: apagaria ahora'; exit 0; }
systemctl poweroff
