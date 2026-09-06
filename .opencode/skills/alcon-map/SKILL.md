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
