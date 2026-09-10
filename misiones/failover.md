# FAILOVER de director (quién manda)
Prioridad: vps > forja > kali > hp-server(reserva flaca solo buzón).
Regla: manda el vivo de mayor prioridad. Si el titular cae, el siguiente toma el
mando y lo devuelve al volver (aviso por socket). Sin elección no hay dúo:
dos directores = doble fan-out prohibido.
Réplica Qdrant: forja + HP hoy (53 pts). Kali pendiente (offline 2026-09-10).
