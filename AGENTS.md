# AGENTS.md — Alcon v4.2-go

> Sistema multi-agente con squads de IA que compiten, debatan y colaboran.
> v4.2 Go: 4/4 perspectivas en 13.6s, 60MB RAM, 13.2MB Docker. OpenRouter HTTP direct.

## 🚨 GUARDRAIL CRÍTICO - ANTES DE TOCAR VPS O ~/alcon

LEE BOOTSTRAP.md sección GOLDEN RULE. Si el usuario o tú intentan:
- ssh root@100.102.63.30
- scp archivo trackeado
- pm2 como root
- editar ~/alcon sin git commit/push
DEBES detenerte y decir:
"Hey, BOOTSTRAP dice que vas a hacer un cagadero si continúas. Golden Rule: GitHub = verdad, VPS = espejo, forja = fábrica. ¿Quieres que haga el flujo correcto? forja: edit+push, vps: pull+restart"
No continúes hasta que el usuario confirme flujo correcto.

## Infra

| Dispositivo | Hardware | IP Tailscale | Rol | OpenCode |
|-------------|----------|--------------|-----|----------|
| **debian** | RTX 3060 12GB, 32GB RAM | 100.121.64.26 | Brain (desarrollo + GPU) | ✅ |
| **vps** | Oracle ARM 21GB | 100.102.63.30 | Server (Fastify + PM2) | ✅ |
| **kali** | GTX 1050 4GB, 16GB RAM | 100.103.82.104 | Git executor | ✅ |
| **cel** | Redmi Note 11, 1GB | 100.122.196.23 | Reviewer/approver | ✅ |

## Stack

- **Orchestrator:** Go v4.2 Go (server/go/) — 13.2MB Docker, 60MB RAM para 4 workers
- **PWA:** React + TypeScript + Tailwind + Capacitor
- **Deploy:** Go binario en VPS Oracle ARM :3001, Node v4.1 backup en :3003
- **GPU:** 1 modelo a la vez en :8080, switch via systemd + Board API :9998
- **Dashboard:** :8081 (monitor de modelos)

### Env vars (ecosystem.config.cjs)

| Variable | VPS | debian (local) |
|----------|-----|----------------|
| `LLAMA_URL` | `http://100.121.64.26:8080` | `http://localhost:8080` |
| `BOARD_API_URL` | `http://100.121.64.26:9998` | `http://localhost:9998` |

### CLI Overrides (v4.1)

| Comando | Efecto |
|---------|--------|
| `@code-audit --local revisa server.js` | Solo debian/kali local, 0ms, sin gastar tokens |
| `@code-audit --cloud revisa server.js` | Todos en nube, 4s throttle |
| `@code-audit --auto revisa server.js` | Auto: local primero, fallback nube (default) |
| `@code-audit --device=debian revisa server.js` | Solo debian |
| `@code-audit --device=kali,vps --cloud revisa server.js` | Solo kali+vps en nube |

## Board API :9998 — Modelos

| Board Key | Modelo | Servicio systemd | VRAM | tok/s |
|-----------|--------|------------------|------|-------|
| `qwen` | qwen3.6-35b-A3B-MXFP4 | qwen3-35b.service | 10.6GB | 45 |
| `qwen-coder-14b` | qwen2.5-coder-14b | qwen-coder-14b.service | 8.4GB | 30 |
| `hauhaucs-12b` | gemma4-12b-hauhaucs | hauhaucs-12b.service | 6.9GB | 129 |
| `gemma` | gemma4-12b-uncensored | llama-3060.service | 6.9GB | 80 |
| `gemma-26b-a4b` | gemma4-26b-a4b | gemma4-26b-a4b.service | 11.4GB | 55 |

## Los 8 Squads (granja.json v4.1)

| Squad | Pattern | Backend | Agents | Ejemplo |
|-------|---------|---------|--------|---------|
| `quick-review` | fan-out-fan-in | hybrid | qr-debian | `@quick-review --local revisa server.js` |
| `code-audit` | fan-out-fan-in | hybrid | debian+kali+vps+cel | `@code-audit revisa server.js` |
| `research-deep` | debate 3 rondas | hybrid | debian+kali+vps | `@research-deep investiga X` |
| `architecture` | consensus 3 votos | auto | 3 agents | `@architecture propone microservicios` |
| `mithos-cap` | proxy-atomico | auto | guion+lore+seo | `@mithos-cap crea CAP` |
| `deploy` | single | auto | deployer | `@deploy haz deploy` |
| `memory-consolidation` | single | auto | consolidator | `@memory-consolidation consolida` |
| `youtube-auto` | fan-out-fan-in | auto | title+thumb+desc | `@youtube-auto genera metadata` |

## Orchestrator

**Endpoint:** `POST /api/orchestrate` + Socket.IO `squad:message`

**Flujo (v4.1):**
1. Usuario escribe `@code-audit --local revisa server.js`
2. `chat.js` detecta squad → parseOverrides (--local, --cloud, --device=)
3. `orchestrator.js` crea sesión + historial en `memory/conversations/{squad}.json`
4. Fan-out: locales en paralelo (0ms), nube secuencial (4s throttle)
5. Si provider retorna 429 → circuit breaker 5min → rota al siguiente fallback
6. Fan-in: sintetiza perspectivas con local llama
7. Resultado se emite en chat + Kanban + persiste en disco

### Circuit Breaker + Throttle

| Backend | Throttle | Parallel | Retry | Backoff |
|---------|----------|----------|-------|---------|
| `llama` (local) | 0ms | Sí (GPU encola) | 3 intentos | 5s |
| `opencode` (nube) | 3-5s + jitter | No (secuencial) | 3 intentos | 10s, 20s, 40s |

Si un provider retorna 429 → circuit breaker lo marca dead 5 min → rota al siguiente fallback.

**Granja Guard** (en `tasks.js`):
Si el texto empieza con `@quick-review`, `@code-audit`, etc., se intercepta ANTES de crear tarea en tasks.json. Se llama directo a `orchestrateTask()`. Return: `{orchestrator: true, squad, final, pendingPath}`.

## Cómo agregar modelo

1. Crear servicio systemd en `~/.config/systemd/user/`:
```ini
[Unit]
Description=llama-server modelo-nuevo
After=network.target

[Service]
Type=simple
ExecStart=/home/israel/.local/bin/llama-server -m /home/israel/Documentos/montar-modelos/modelos/modelo.gguf --host 0.0.0.0 --port 8080 --ctx-size 8192 -ngl 99
Restart=on-failure

[Install]
WantedBy=default.target
```

2. Agregar a `montar-modelos/llama-bench-board-v3/control-api.py` en SERVICES dict
3. Agregar entrada en `server/lib/model-registry.json` con `board_key`

## Cómo agregar squad

1. Agregar entrada en `server/lib/granja.json`
2. Definir pattern: `single`, `fan-out-fan-in`, `debate`, `consensus`, `proxy-atomico`
3. Agregar agents con `model_ref` (debe existir en model-registry) y `role`
4. Agregar `backend` (`llama`, `opencode`, `auto`), `throttle_ms`, `fallback_models`
5. Test: `curl -X POST localhost:3003/api/orchestrate -H "Content-Type: application/json" -d '{"text":"@nuevo-squad test","squad":"nuevo-squad"}'`

## Convenciones

- Commits: `feat:`, `fix:`, `chore:`, `docs:`
- ESM (`import`/`export`), no CommonJS
- Sin comentarios en código a menos que se pida
- Sin autenticación — sistema de confianza interna del enjambre
- Datos en SQLite (tasks.json migrado a DB)

## OODA Loop Obligatorio

Antes de cada cambio:
1. **Observe** — ¿Qué dice el código? ¿Qué dice el log?
2. **Orient** — ¿Cuál es el contexto real? ¿Qué assumptions tengo?
3. **Decide** — ¿Qué voy a cambiar y por qué?
4. **Act** — Ejecuta el cambio mínimo necesario

## Para Agentes con Contexto Cero

Si ves este archivo y no sabes qué hacer, ejecuta esto:

```bash
# Verificar que el server está vivo
curl -s http://100.102.63.30:3003/health

# Hacer una auditoría rápida
curl -X POST http://100.102.63.30:3003/api/orchestrate \
  -H "Content-Type: application/json" \
  -d '{"text":"@quick-review test rapido","squad":"quick-review"}'

# Ver pending generados
ls -la server/lib/memory/pending-*.md
```

## Referencias

- `server/go/orchestrator.go` — Orchestrator v4.2 Go (goroutines + HTTP direct OpenRouter)
- `server/go/granja.json` — 4 devices reales, 2 squads
- `server/go/Dockerfile` — distroless 13.2MB
- `server/lib/granja.json` — Definición de squads v4.1 (Node backup)
- `server/lib/model-registry.json` — Mapeo de modelos a board_key
- `server/lib/orchestrator.js` — Orchestrator v4.1 Node (backup, v4.1-conversacional tag)
- `server/routes/chat.js` — Chat con squad detection + parseOverrides
- `server/routes/tasks.js` — Granja guard + single task per squad
- `server/lib/memory/conversations/` — Historial JSON por squad
- `server/lib/memory/pending-*.md` — Historial de auditorías
- `docs/PLAN-V4.1/` — Plan de ejecución v4.1
- `docs/MANUAL_USUARIO_EXTENSO.md` — Manual completo para Juan
- `BOOTSTRAP.md` — Contexto rápido para no olvidar
