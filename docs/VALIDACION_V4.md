# Validación v4.0-granja-real

**Fecha:** 2026-08-16
**Tag:** v4.0-granja-real
**Commit:** f21366a

## Estado del sistema

| Check | Resultado | Detalle |
|-------|-----------|---------|
| PM2 | ✅ online | alcon-api pid 2152975, uptime 5m, 83.5mb |
| Health | ✅ ok | version 3.1.0-clean, 4 tasks |
| Board API | ✅ 16 servicios | :9998 activo |
| Pending | ✅ 125 líneas | pending-2026-08-16.md |
| Git log | ✅ 5 commits | f21366a → 6f6d8bc |
| Git tag | ✅ | v4.0-granja-real |

## Granja guard test

```bash
curl -X POST localhost:3003/api/task \
  -H "Content-Type: application/json" \
  -d '{"text":"@quick-review test rapido"}'
```

**Resultado:**
```json
{
    "orchestrator": true,
    "squad": "quick-review",
    "final": "...",
    "pendingPath": "./lib/memory/pending-2026-08-16.md"
}
```

✅ `orchestrator: true` — PWA distingue respuesta de granja
✅ `squad: "quick-review"` — squad correcto
✅ `pendingPath` — resultado guardado en memoria

## Archivos creados/actualizados

| Archivo | Acción |
|---------|--------|
| `AGENTS.md` | Reescrito v4.0 completo |
| `README.md` | Reescrito v4.0 extenso |
| `BOOTSTRAP.md` | Creado (1 página contexto) |
| `docs/MANUAL_USUARIO_EXTENSO.md` | Creado (10 secciones, 12 ejemplos) |
| `docs/legacy/v3/` | 8 archivos obsoletos movidos |
| `server/routes/tasks.js` | Patch granja guard |
| `docs/VALIDACION_V4.md` | Este archivo |

## Commits

```
f21366a fix: orchestrator inyecta codigo real para auditorias
02823f2 fix: orchestrator inyecta codigo real para auditorias
41c851d fix: model-registry usa board_key de API :9998
bba60ce feat: granja v3 adaptada a montar-modelos :9998
6f6d8bc chore: remove debug logging
```

## Deploy VPS

```bash
ssh root@100.102.63.30 "cd /home/ubuntu/alcon && git pull origin main && pm2 restart alcon-api --update-env"
```

**Estado:** ✅ Deploy completado
- git pull: Already up to date (repo sync)
- PM2: alcon-api online (pid 1645211, 32.3mb)
- Health: `http://100.102.63.30:3003/health` → status ok
- pm2 save: guardado en /root/.pm2/dump.pm2

## Para agentes con contexto cero

Si ves este archivo, ejecuta:

```bash
curl -s http://100.102.63.30:3003/health
curl -X POST http://100.102.63.30:3003/api/orchestrate \
  -H "Content-Type: application/json" \
  -d '{"text":"@quick-review test","squad":"quick-review"}'
```
