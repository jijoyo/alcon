# FAILOVER de director (quién manda)
Prioridad: hp-server > forja > kali. (Histórico: vps primero — muerto 2026-09-07; hp era reserva flaca, hoy es el server.)
Motor forja (GPU) solo bajo orden explícita de Israel, caso por caso — ningún failover lo monta solo.
Regla: manda el vivo de mayor prioridad. Si el titular cae, el siguiente toma el
mando y lo devuelve al volver (aviso por socket). Sin elección no hay dúo:
dos directores = doble fan-out prohibido.
Réplica Qdrant: forja + HP + Kali (53 pts c/u). HOME roto en Kali (/home/israel inexistente, usar /home/jijoyo absoluto).
