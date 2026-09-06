# Plantilla: replicar el mapa vivo en otro proyecto

## Paso 1 — Grafo determinista
Crea un script sin dependencias que lea tu config y genere `docs/alcon-graph.json`
(`{nodes, edges}`). Agrega el target `brain-map` a tu Makefile.

## Paso 2 — Health real + estado runtime
Monta `GET /api/health-map` (200 siempre, degraded en el body) y
`GET /api/radar-status` (200 siempre, aunque no haya datos).
Guarda el estado en `data/*.last.json`, ignorado por git, con ruta
configurable por variable de entorno.

## Paso 3 — HTML autónomo + deploy seguro
Crea `docs/ARCHITECTURE.html` nativo sin CDN, con tarjetas con fetch
propio y colores por edad. Commitea con `git add` explícito y despliega
con `merge --ff-only origin/main` + `pm2 restart` + `curl` de verificación.
