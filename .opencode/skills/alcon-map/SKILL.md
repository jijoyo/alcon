---
name: alcon-map
description: Usa el mapa vivo de Alcon antes de modificar el repo. Lee docs/alcon-graph.json y verifica GET /api/health-map.
---

# Alcon Map

Antes de modificar Alcon:

1. Lee `docs/alcon-graph.json`.
2. Verifica `GET /api/health-map` (router/API/PWA/Go en verde).
3. Si cambiaste estructura (routes, squads, servicios), corre `make brain-map`.
4. No toques el contrato `{final,details,pendingPath}` ni la paridad Go/Node.

## Receta replicable (cualquier proyecto)

1. **Grafo determinista**: script sin dependencias que lee tu config y genera `docs/alcon-graph.json` (`{nodes, edges}`). La regla se repite en `make brain-map`.
2. **Health real**: `GET /api/health-map` y `GET /api/radar-status` con **200 siempre** (degraded va en el body, nunca 404). Estado runtime en `data/*.last.json` **ignorado por git**, ruta configurable por env (`RADAR_STATE_PATH`).
3. **HTML autónomo**: `docs/ARCHITECTURE.html` nativo sin CDN, con tarjeta propia por servicio y fetch propio con colores por edad.
4. **Deploy seguro**: add explícito de archivos, `node --check`, `merge --ff-only origin/main`, `pm2 restart` y `curl` de verificación. Nunca `git add .` ni `reset --hard` en espejo.
