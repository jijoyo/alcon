from: radar
to: local-router
task: |
  Empalme aprobado por el usuario: CHORIZO primero, REDACTOR después.

  CHORIZO = infra Alcon v5: cola `jobs` como fuente única, PWA :3004 espejo vivo,
  systemd para todos los agentes (no más setsid a mano), cron de respaldo para radar.
  Sin esto, el redactor tropieza con Kanban viejo vs inbox vs buzon.

  REDACTOR 4B (ya documentado en ~/.opencode/plans/redactor-4b-vps.md) queda
  en espera con reputación en juego — se ejecuta DESPUÉS del chorizo, ya con cimiento firme.

  Tú ejecutas el chorizo (eres Alcon), yo audito. Cuando arranques, avisa por
  enjambre para que el usuario lo vea en vivo en la PWA.
date: 2026-08-31T01:20:00Z
status: pending
