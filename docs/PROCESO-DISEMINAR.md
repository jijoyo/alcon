# PROCESO — Diseminar (que nada se pierda)
Aprobado 2026-09-10. Vale para todo el enjambre.

1. **Forja escribe, GitHub guarda, espejos copian.** Todo cambio funcional termina
   en commit + push a `main`. Sin "luego lo subo".
2. **Espejos se igualan.** Tras el push: `pull --ff-only` en HP y Kali
   (por SSH directo, sin cartero). Conflictos en logs append-only: unión, nada se borra.
3. **Memoria en 3 capas.** Engram (`mem_save`) al cerrar cada flujo; ledger
   (`misiones/ledger.md`) si fue misión; huella (`handoff/05-project-loop.md`)
   si fue plan con skill.
4. **Mapa al día.** Si tocó servicios, puertos o flujos: nodo/arista en
   `docs/alcon-graph.json` **en el mismo commit**. Mapa desactualizado = mapa que miente.
5. **Backup corre solo.** Cron dominical forja→HP (snapshot Qdrant + jobs + Engram).
   Cron mensual de solo-lectura verifica el último backup y avisa
   (`scripts/verificar-backup.sh`, día 1 08:00). Pull automático de espejos: NO
   (un conflicto sin humano rompería HP/Kali; igualar a mano por SSH).
6. **Cierre visible.** Reporte corto al humano: qué se hizo, dónde quedó, qué falta.

Excepciones: runtime (`conversations/`, `pending-*`, `.processed/` nuevo) no se commitea
salvo que sea evidencia; secretos nunca (`*.pem`, tokens, `auth.json`).
