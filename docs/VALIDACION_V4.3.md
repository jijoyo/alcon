# Validación v4.3-ferrari

**Fecha:** 2026-08-27
**Tag:** v4.3-ferrari
**Commit:** 175e21a

## Estado del sistema

| Check | Resultado | Detalle |
|-------|-----------|---------|
| PM2 | ✅ online | alcon-api, alcon-pwa, vps-agent (3 procesos) + alcon-go |
| Health | ✅ ok | v4.3-regla-oro (175e21a), 8 agentes |
| Router :8080 | ✅ 10 modelos | `curl /v1/models` → 9 chat + 1 nomic CPU-only |
| Ferrar.sh | ✅ health ok | `/v1/models`, `/health`, `/status` router active |
| Make test-squad | ✅ PASS | 4 agents misma task sin pisarse |
| EMBED | ✅ 200 | `POST /v1/embeddings` nomic-embed-text 768d |

## Test 80/20

```bash
curl -X POST http://100.121.64.26:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"gemma4-12b","messages":[{"role":"user","content":"hola"}],"max_tokens":20}'
# → 200, gemma4-12b rápido

curl -X POST http://100.121.64.26:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen36-mx","messages":[{"role":"user","content":"architecture research-deep audit complejo"}],"max_tokens":50}'
# → 200, qwen36-mx 131K
```

## Archivos creados/actualizados

| Archivo | Acción |
|---------|--------|
| `granja.json` | Ferrari v4.3 fuente única (symlink lib/go) |
| `server/lib/orchestrator.js` | Bypass boardStart/Stop, model directo |
| `server/go/orchestrator.go` | selectBackend 80/20 |
| `scripts/ferrari.sh` | Endpoints reales |
| `Makefile` | test-squad, ferrari |
| `docs/ALCON_ARQUITECTURA.md` | §6 Deuda v3+v3.1 |
| `docs/CHANGELOG-v4.3-ferrari.md` | Changelog |
| `docs/MANUAL_USUARIO_EXTENSO.md` | v4.3-ferrari local-first |
| `AGENTS.md` | Consigna docs+engram+obsidian |

## Para agentes con contexto cero

```bash
curl -s http://100.102.63.30:3003/health
curl -s http://127.0.0.1:8080/v1/models | jq length  # 10
./scripts/ferrari.sh
make test-squad
```
