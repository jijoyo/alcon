# AGENTS.md — Alcon v4.3-regla-oro

> Sistema multi-agente con squads de IA que compiten, debaten y colaboran.
> v4.3: Regla de Oro + Ghost Fix (4f21091) - 5 PM2 estables, 507 engrams Qdrant green.

## 🚨 GUARDRAIL CRÍTICO - ANTES DE TOCAR VPS O ~/alcon

LEE BOOTSTRAP.md v4.3 sección GOLDEN RULE. Si el usuario o tú intentan:
- ssh root@100.102.63.30
- scp archivo trackeado
- pm2 como root / ver /root/alcon
- editar ~/alcon sin git commit/push
- crear server/presence-vps.js de nuevo

DEBES detenerte y decir:
"Hey, BOOTSTRAP v4.3 dice que vas a hacer un cagadero si continúas. Golden Rule: Forja escribe, GitHub guarda, espejos copian. Flujo: forja: edit+push, vps: pull+restart. ¿Quieres que haga el flujo correcto?"
No continúes hasta que el usuario confirme flujo correcto.

## Agentes

- **Alcon** (`~/.config/opencode/agent/alcon.md`): TODA la app en este repo — código, docs, ingestas Qdrant :6333 / nomic :8086 / EDCO :6335, handoff/09-*, PDFs, contexto médico
- **Base Build**: tareas fuera de ~/Documentos/alcon

Si la tarea es de la app Alcon → Tab → Alcon. Fuera del repo → Base Build.

## Infra v4.3

| Dispositivo | Hardware | IP Tailscale | Rol | Branch |
|-------------|----------|--------------|-----|--------|
| **forja/debian** | RTX 3060 12GB, 32GB RAM | 100.121.64.26 | Brain (GPU) + FABRICA | main |
| **vps** | Oracle ARM 21GB | 100.102.63.30 | Server + PM2 + ESPEJO | main |
| **kali** | GTX 1050 4GB, 16GB RAM | 100.103.82.104 | Git executor | v4.2-kali |
| **cel note-11** | Redmi Note 11, 1GB | 100.122.196.23 | Reviewer | cel-experimental |
| **cel note-12s** |  | 100.96.34.100 | Reviewer |  |

## Stack v4.3

- **Orchestrator:** Go v4.2 Go (server/go/) — 13.2MB Docker, 60MB RAM + Node v4.1 backup (orchestrator.js)
- **PWA:** React + TypeScript + Tailwind + Capacitor :3004
- **Deploy:** Go :3001 + Node :3003
- **GPU:** 1 modelo a la vez en :8080, switch via systemd + Board API :9998
- **Dashboard:** :8081
- **RAG:** Qdrant :6333 - 507 pts - 768 dim cosine - green + nomic :8086 + engram-cloud :7438
- **Verdad:** github.com/jijoyo/alcon main HEAD (hash dinámico vía `/health`, sin pines en docs)

### PM2 Oficial v4.3 (ubuntu@100.102.63.30)

```
0 alcon-pwa (3004)
2 buzz-farm
3 vps-agent (FIX 4f21091: resilient reconnect)
4 alcon-api (3003)
6 alcon-go (3001)
```

Si `pm2 ls` muestra !=5 o alguno en /root -> ejecutar antidoto BOOTSTRAP.

### Env vars (ecosystem.config.cjs)

| Variable | VPS | debian (local) |
|----------|-----|----------------|
| `LLAMA_URL` | `http://100.121.64.26:8080` | `http://localhost:8080` |
| `BOARD_API_URL` | `http://100.121.64.26:9998` | `http://localhost:9998` |

### CLI Overrides (v4.1+)

| Comando | Efecto |
|---------|--------|
| `@code-audit --local revisa server.js` | Solo debian/kali local, 0ms |
| `@code-audit --cloud revisa server.js` | Todos en nube, 4s throttle |
| `@code-audit --auto revisa server.js` | Auto: local primero, fallback nube (default) |
| `@code-audit --device=debian revisa server.js` | Solo debian |

## Board API :9998 — Modelos

| Board Key | Modelo | Servicio systemd | VRAM | tok/s |
|-----------|--------|------------------|------|-------|
| `qwen` | qwen3.6-35b-A3B-MXFP4 | qwen3-35b.service | 10.6GB | 45 |
| `qwen-coder-14b` | qwen2.5-coder-14b | qwen-coder-14b.service | 8.4GB | 30 |
| `hauhaucs-12b` | gemma4-12b-hauhaucs | hauhaucs-12b.service | 6.9GB | 129 |
| `gemma` | gemma4-12b-uncensored | llama-3060.service | 6.9GB | 80 |
| `gemma-26b-a4b` | gemma4-26b-a4b | gemma4-26b-a4b.service | 11.4GB | 55 |

## Los 8 Squads (granja.json)

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

## Orchestrator v4.3

**Endpoint:** `POST /api/orchestrate` + Socket.IO `squad:message`

**Flujo:**
1. Usuario: `@code-audit --local revisa server.js`
2. `chat.js:37` detecta squad → parseOverrides + log [presence] kicking duplicate si hay duplicado
3. `orchestrator.js` crea sesión + historial en `memory/conversations/{squad}.json`
4. Fan-out: locales paralelo (0ms), nube secuencial (4s throttle)
5. Si 429 → circuit breaker 5min → rota fallback
6. Fan-in: sintetiza con local llama
7. Emite en chat + Kanban + persiste

### Circuit Breaker + Throttle

| Backend | Throttle | Parallel | Retry | Backoff |
|---------|----------|----------|-------|---------|
| `llama` (local) | 0ms | Sí | 3 intentos | 5s |
| `opencode` (nube) | 3-5s + jitter | No | 3 intentos | 10s, 20s, 40s |

**Granja Guard:** Si texto empieza con `@squad`, intercepta ANTES de crear task. Llama directo a `orchestrateTask()`.

### Ghost Fix v4.3 (4f21091)

Loop de 389 restarts el 20-Ago:
- Causa: `presence-vps.js` fantasma registrado como 'vps' + `chat.js` kick `disconnect(true)` -> `io server disconnect` (no auto-reconnect socket.io) -> event loop vacío -> exit 0 -> pm2 relanza 3s

Fix:
- `server/presence-vps.js` -> eliminado, _deprecated_*.bak gitignored
- `agents/agent.js:411-427` -> reconnect manual 5s + keepalive setInterval
- `server/routes/chat.js:37` -> log kicking duplicate

Verificación post-fix: `pm2 logs vps-agent --lines 50` debe mostrar uptime estable >24h, sin restarts cada 3s.

## Cómo agregar modelo

1. Crear servicio systemd en `~/.config/systemd/user/`:
2. Agregar a `control-api.py` en SERVICES dict
3. Agregar entrada en `server/lib/model-registry.json` con `board_key`

## Cómo agregar squad

1. Agregar entrada en `server/lib/granja.json`
2. Definir pattern + agents + backend + throttle + fallback_models
3. Test: `curl -X POST localhost:3003/api/orchestrate -d '{"text":"@nuevo-squad test","squad":"nuevo-squad"}'`

## Convenciones

- Commits: `feat:`, `fix:`, `chore:`, `docs:`
- ESM (`import`/`export`), no CommonJS
- Sin comentarios en código a menos que se pida
- Sin autenticación — sistema confianza interna
- Datos en SQLite (tasks.json migrado a DB)
- **REGLA DE ORO:** Forja escribe, GitHub guarda, espejos copian

## OODA Loop Obligatorio

1. **Observe** — ¿Qué dice el código? ¿Qué dice el log? `pm2 ls`? `git log -3`?
2. **Orient** — ¿Cuál es el contexto real? ¿Qué assumptions tengo? ¿Estoy en forja o espejo?
3. **Decide** — ¿Qué voy a cambiar y por qué? ¿Respeta Golden Rule?
4. **Act** — Ejecuta el cambio mínimo necesario

## Para Agentes con Contexto Cero

```bash
# Verificar vivo
curl -s http://100.102.63.30:3003/health
# Debe: {"status":"ok"} + hash real de main (HEAD, dinámico)

# Auditoria rapida
curl -X POST http://100.102.63.30:3003/api/orchestrate \
  -H "Content-Type: application/json" \
  -d '{"text":"@quick-review test rapido","squad":"quick-review"}'

# Ver enjambre
pm2 ls
ls -la server/lib/memory/pending-*.md
curl -s http://100.102.63.30:6333/collections/alcon | jq .status

# Ver ghost fix
pm2 logs vps-agent --lines 20 --nostream
```

## Referencias

- `server/go/orchestrator.go` — Go v4.2 (goroutines + HTTP OpenRouter)
- `server/go/granja.json` — 4 devices reales
- `server/go/Dockerfile` — distroless 13.2MB
- `server/lib/granja.json` — squads v4.1 Node backup
- `server/lib/model-registry.json` — board_key mapping
- `server/lib/orchestrator.js` — Node v4.1 backup
- `server/routes/chat.js:37` — squad detection + kicking duplicate log (fix v4.3)
- `agents/agent.js:411-427` — resilient reconnect fix v4.3
- `BOOTSTRAP.md` — v4.3-regla-oro - fuente de verdad
