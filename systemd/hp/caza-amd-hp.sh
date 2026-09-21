#!/usr/bin/env bash
# caza-amd-hp.sh — loop acotado caza E2.1.Micro Querétaro DESDE HP (24/7).
# Solo CREA (gate FASE A vigente); nunca borra nada. Requiere ~/.oci/ funcional.
# IDs en ~/.cache/oracle-hunt/ (volad, subnet, imgid). Log: ~/oracle-hunt.log
# (volid solo para attach supervisado posterior; la caza no lo necesita)
set -u
export OCI_CLI_AUTH=api_key
OCI=~/oci-venv/bin/oci
T=$(grep -E "^tenancy=" ~/.oci/config | cut -d= -f2)
LOG=~/oracle-hunt.log
ts() { date '+%F %T'; }
note() { echo "$(ts) $*" | tee -a "$LOG"; }
for f in volad subnet imgid; do
  [ -s ~/.cache/oracle-hunt/$f ] || { note "HOLD: falta ~/.cache/oracle-hunt/$f"; exit 0; }
done
AD=$(cat ~/.cache/oracle-hunt/volad)
SUB=$(cat ~/.cache/oracle-hunt/subnet); IMG=$(cat ~/.cache/oracle-hunt/imgid)
OUT=$($OCI compute instance launch --availability-domain "$AD" --compartment-id "$T" \
  --shape "VM.Standard.E2.1.Micro" --subnet-id "$SUB" --image-id "$IMG" \
  --display-name "alcon-rescate" \
  --ssh-authorized-keys-file ~/.ssh/oracle-hp.pub 2>&1) || true
if echo "$OUT" | grep -q "Out of host capacity"; then
  note "nada: sin capacidad (reintento próximo ciclo)"
  exit 0
fi
INST=$(echo "$OUT" | python3 -c "import json,sys; print(json.load(sys.stdin).get('data',{}).get('id',''))" 2>/dev/null)
if [ -z "$INST" ]; then note "RESPUESTA RARA: $(echo "$OUT" | head -c 150)"; exit 0; fi
echo "$INST" > ~/.cache/oracle-hunt/instance
note "PESCA: instancia creada; sigue attach+mount (manual supervisado)"
