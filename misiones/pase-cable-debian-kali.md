# MISION pase debian→kali por cable ethernet
# OJO: estado vive en misiones/ (NO en agent-inbox/, ahí todo se vuelve job).
ESTADO: LISTO
# LISTO 2026-09-13 19:46Z por kali. 1/2 iq3 77G (6 archivos) + 2/2 177b 85G
# (7 archivos) = 161G en Externo/debian-drop. Forja 2/2 FINO 19:36Z hash OK.
# Docs: 3aff127 revertido en alcon (c175334), cable en montar-modelos
# doc/CABLE-DIRECTO-KALI.md (solo forja, no llegó a kali).
PEER: forja/debian
INICIO: 2026-09-13T18:34Z
TEMA: pasar modelos (monstruo-iq3 77G + monstruo-177b 85G) al Externo en kali.
VIA ACORDADA: cable ethernet directo (NO Tailscale, NO USB).
  - kali eth0 10.10.10.2/24, forja 10.10.10.1, ping 0% loss 0.4ms (18:46Z).
  - Destino: /run/media/jijoyo/Externo/debian-drop/ (NTFS rw, 610G libres).
  - Ritmo medido ~107MB/s. ETA 1) ~19:02Z / 2) ~19:16Z del 2026-09-13.
  - Forja avisa hash por buzón al terminar cada uno; kali verifica.
REGLAS: no suspender Kali, no desconectar cable, no desmontar Externo,
  no escribir al drop hasta cierre. Buzón vivo (kali→forja 100.121.64.26:3003).
VIGIA: /tmp/vigia-cable.sh (drop estable + keywords hash/terminó/LISTO) → /tmp/vigia-cable.log.
ACORDADO (2026-09-13 18:5xZ, "cuadren"): al cerrar la transferencia,
  generalizar el vigía a scripts/vigia-drop.sh parametrizable (ruta+keywords+intervalo
  por args) + 5 líneas en docs/COMMS-GUIDE.md. La instancia /tmp actual es ad-hoc,
  el patrón (doctrina V4.4) sí es global.
CIERRE: verificar hash ambos modelos + ledger fila + mem_save 1 línea.
