# Plan de Ejecución: Alcon v4.1-conversacional

> Fecha: 16 ago 2026
> Rama: `feat/v4.1-conversacional`
> Archivos: `referencias/` tiene los archivos de Meta para copiar

## Evolución

```
Rama B (Superset)    → solo desktop, sin multi-device
Rama C (Squads)      → multi-device, sin local/cloud
Rama D (Híbrido)     → multi-device + squads + patterns
V4-Hybrid Meta       → Rama D implementada con hybrid local/cloud
```

## Archivos a modificar

| # | Archivo | Origen | Líneas |
|---|---------|--------|--------|
| 1 | `server/lib/granja.json` | `referencias/granja.v4-final.json` | 194 |
| 2 | `server/lib/orchestrator.js` | `referencias/orchestrator.v4-final.js` | 291 |
| 3 | `server/routes/chat.js` | `referencias/chat.FINAL_CORRECTED.js` | 196 |
| 4 | `server/routes/tasks.js` | Patchear original (387L) con PATCH-TASKS.md | ~400 |
| 5 | `server/lib/memory/conversations/` | Crear directorio | 0 |
| 6 | `agents/agent.js` | `git checkout main -- agents/agent.js` | 0 |

## Pasos de ejecución

### Paso 1: Setup
```bash
cd ~/Documentos/alcon
git checkout -b feat/v4.1-conversacional
```

### Paso 2-3: Reemplazar granja.json + orchestrator.js
```bash
cp docs/PLAN-V4.1/referencias/granja.v4-final.json server/lib/granja.json
cp docs/PLAN-V4.1/referencias/orchestrator.v4-final.js server/lib/orchestrator.js
```

### Paso 4: Reemplazar chat.js
```bash
cp docs/PLAN-V4.1/referencias/chat.FINAL_CORRECTED.js server/routes/chat.js
```

### Paso 5: Patch tasks.js (mergear, NO reemplazar)
Ver `PATCH-TASKS.md` para instrucciones exactas.

### Paso 6-7: Directorio + limpiar agent.js
```bash
mkdir -p server/lib/memory/conversations
git checkout main -- agents/agent.js
```

### Paso 8-9: Commit + Push
```bash
git add server/lib/granja.json server/lib/orchestrator.js server/routes/chat.js server/routes/tasks.js server/lib/memory/
git commit -m "feat: v4.1-conversacional Rama D Hibrido - 4 devices OpenCode propio + hybrid + throttle"
git push origin feat/v4.1-conversacional
```

## Deploy VPS
```bash
ssh root@100.102.63.30
cd ~/alcon
git reset --hard origin/feat/v4.1-conversacional
pm2 restart alcon-api --update-env
```

## Archivos de referencia

En `referencias/`:
- `granja.v4-final.json` — Config de squads v4.1
- `orchestrator.v4-final.js` — Orchestrator con circuit breaker + hybrid + throttle
- `chat.FINAL_CORRECTED.js` — Chat Fastify con squad detection
- `orchestrator.go` — Versión Go para v4.2 (experimento paralelo)
