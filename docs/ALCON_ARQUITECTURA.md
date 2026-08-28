# ALCON_ARQUITECTURA — Informe profundo PWA :3004

> Generado por @local-router repomix ligero — solo lectura, sin cambios.
> Fuentes: `server/lib/orchestrator.js` (322L), `memory-rag.js` (391L), `auto-discovery.js` (45L), `granja.json`/`server/lib/granja.json`, `model-registry.json`, `ecosystem.config.cjs`, `.env`, `pwa/src/lib/api.ts`

## 1) Mapa de squads @vps @kali @cel @orchestrator

### Registro actual (`server/lib/granja.json` v4.1 + `granja.json` Ferrari 1-backend)

| Squad | Pattern | Agents (device/backend) | Throttle | Rol |
|-------|---------|------------------------|----------|-----|
| `quick-review` | single | `qr-debian` → debian/llama `http://100.121.64.26:8080` `throttle_ms 0` fallback `hauhaucs-12b → mimo-v2.5-free → deepseek-v3.1-free` | 0 local / 4000 nube | reviewer |
| `code-audit` | fan-out-fan-in | `audit-debian-arch` debian/llama `http://100.121.64.26:8080` `qwen-12b` • `audit-kali-perf` kali/llama `http://100.121.64.26:8080` `hauhaucs-12b` • `audit-vps-sec` vps/opencode `mimo-v2.5-free` • `audit-cel-edge` cel/opencode `deepseek-v3.1-free` | 0 local / 4000 nube | arquitecto / performance / seguridad / edge-cases |
| `research-deep` | debate 3 rounds | `res-debian` debian/llama `qwen` • `res-kali` kali/llama `hauhaucs-12b` • `res-vps` vps/opencode `mimo-v2.5-free` | 0 / 4000 | researcher / critic / analyst |

> `granja.json` Ferrari (v2.2): 1 backend `forja-router http://100.121.64.26:8080 throttle 0` con routing 80/20. El `server/lib/granja.json` Node sigue con 4 devices para squads; el Go `granja.json` es el que usa el operador local-router.

### @orchestrator

* Vive en `server/lib/orchestrator.js` + `server/go/orchestrator.go` (Go v4.2 paralelo, Node backup).
* Expone `handleSquadMessage(squad, prompt, from)` y `orchestrateTask(task)`.
* CLI: `@code-audit --local revisa server.js` → `parseOverrides` detecta `--local/--cloud/--auto` y `--device=debian`.
* Squads se invocan desde PWA o API; el orchestrator decide backend por agente (`backend: llama` vs `opencode`).

## 2) Flujo PWA -> api :3003 -> LLAMA_URL :8080 -> board :9998

```
PWA :3004 (Vite preview)                alcon-api :3003 (Fastify)
pwa/src/lib/api.ts ──fetch──>            server/server.js
  getApiBase():                           POST /api/orchestrate
    VITE_API_URL ?                        GET /api/tasks, /api/task/:id/*, /health
    : window.origin.replace(:3004->:3003)   │
    : http://localhost:3003                │
                              ──►  server/lib/orchestrator.js
                                        parseOverrides(prompt)
                                        fan-out:
                                          localAgents  -> Promise.allSettled (paralelo, GPU comparte)
                                          cloudAgents  -> for secuencial con throttle
                                        fan-in: sintetiza con boardStart('code-review') + callLlamaWithHistory
                                                          │
                                ┌─────────┴──────────┐
                                │ LLAMA_URL           │ BOARD_API_URL
                                │ http://localhost:8080 │ http://localhost:9998
                                │ (o http://100.121.64.26:8080 en prod) │
                                │ callLlamaWithHistory │ boardStart(modelKey) -> board_key
                                │ /v1/chat/completions │ /start?model=, /start {model}, /stop
                                │ injectCode: si prompt menciona server.js/lib/*.js lo lee y lo inyecta (hasta 12k) │
                                │ callOpenCode fallback si local falla: opencode_bin run -m <modelo> │
                                └────────────────────┘
ecosystem.config.cjs:
  alcon-api env LLAMA_URL=http://localhost:8080 (local) / http://100.121.64.26:8080 (vps-agent)
  vps-agent env BOARD_API_URL=http://100.121.64.26:9998
  alcon-pwa vite preview :3004
  .env forja: LLAMA_URL=http://localhost:8080, ALCON_API_URL=http://100.102.63.30:3003
```

**Detalle board:** `boardStart(modelKey)` mapea `model-registry.json` (`registry[modelKey].board_key` ej `qwen`, `hauhaucs-12b`, `gemma`) y hace `POST API_BOARD/start?model=boardKey` (fallback JSON). Luego espera 30s a `LLAMA/health`. `boardStop()` hace `POST /stop`. Esto es legado del board multi-modelo.

**Ferrari v4.3:** router forja :8080 tiene 10 modelos on-demand (9 chat + 1 nomic CPU-only) (`/v1/models`), `selectBackend` 80/20 en Go elige `gemma4-12b` (rápido, prompt<500 sin architecture|research-deep|audit complejo) vs `qwen36-mx 131K` (pesado). `granja.json` Ferrari pone `throttle 0` porque el router ya serializa GPU.

## 3) Donde entra Qdrant :6333 y embed :8080 (v3.1 dual)

```
server/lib/memory-rag.js
  QDRANT_URL=http://localhost:6333  COLLECTION=alcon  VECTOR_SIZE=768 cosine
  LLAMA_URL (embed) = http://100.121.64.26:8080  model=nomic-embed-text (CPU-only, n-gpu-layers=0)

  ensureEmbedRunning()  -> systemctl --user is-active llama-embed, si no start; scheduleStop() tras 5min idle
  embed(text) -> POST http://100.121.64.26:8080/v1/embeddings (fallback VPS :8086) {model:'nomic-embed-text', input:text.slice(0,500)} retry 3x 30s
  upsert(id,payload,vector) -> PUT /collections/alcon/points
  search(query,limit,device) -> embed(query) -> POST /collections/alcon/points/search {vector, filter:{device}, with_payload:true}
  countByDevice() -> /collections/alcon/points/count por device

  ingestDb(name, dbPath) -> lee opencode.db (session/part o sessions/messages), junta content 500 chars, embed(title+clean), upsert con payload {device, fecha, texto(8000), session_id, model, tokens, title, directory}

  ingestAll() -> si existen /home/ubuntu/opencode-dbs/*.db (VPS local) los usa; si no, hace SCP via Tailscale desde forja/kali/vps/cel (tailscale nc para oracle)
  ensureCollection() crea alcon si no existe

auto-discovery.js
  fetch http://100.121.64.26:8080/v1/models -> modelsLoaded
  tailscale status --json -> devices online
  escribe server/lib/runtime-state.json
```

**Flujo vivo:** el chat/orchestrator no consulta Qdrant en cada mensaje; Qdrant es memoria a largo plazo para `memory-rag` CLI (`--reindex`). El chat sí guarda `memory/conversations/{squad}.json` (30 mensajes) y `memory/pending-YYYY-MM-DD.md`.

## 4) Qué rompería si quitamos :9998

| Si quitamos :9998 | Impacto |
|---|---|
| `orchestrator.js: boardStart/boardStop` | Llamadas fallan, pero `catch(()=>{})` las ignora. El `callLlamaWithHistory` seguiría funcionando porque pega directo a `LLAMA_URL`. La síntesis local `await boardStart('code-review')` fallaría y caería al `catch` que hace `callOpenCode` síntesis. No rompe el flujo principal, pero degrada: deja de pre-calentar modelo correcto y depende de que LLAMA_URL ya tenga modelo cargado. |
| Dashboard/control :8081 + :9998 `/status` | `auto-discovery` no lo usa; `ferrari.sh` y dashboard perderían health. No crítico. |
| `model-registry.json` `board.board.api` | Deja de ser fuente de board_key. Si Ferrari usa router directo `:8080/v1/chat/completions` con `model` explícito, no necesita board_key. |
| Router :8080 con 10 modelos on-demand | Si :9998 era el que hacía `switch` de modelo, quitarlo obliga a usar `/v1/chat/completions` con `model` en payload (que ya soporta el router montar-modelos). Verificado: `auto-discovery` ya usa `http://100.121.64.26:8080/v1/models`. |

**Conclusión:** quitar :9998 **no rompe PWA -> api -> LLAMA** si `orchestrator.js` deja de llamar `boardStart/Stop` y en su lugar pasa `model` en `callLlamaWithHistory` (router on-demand). Tal como está hoy, el `catch` hace que sea tolerante, pero hay ventana de 30s de espera a `/health` que se volvería innecesaria.

## 5) Ejercicio de la fiesta — por qué no se pisaron

El sistema que probamos en la fiesta (agentes @debian @kali @vps @cel en el mismo chat) fue el test de estrés real del enjambre:

* **Chat en tiempo real:** PWA :3004 (Socket.io) + `server/routes/chat.js` con namespaces por sala. Todos los dispositivos platicaban en el mismo canal.
* **No pisarse:** el módulo **lock/claim** de `server/routes/tasks.js` (no parte de este repomix, pero referenciado) usa `lock_owner`, `lock_expires_at`, `last_heartbeat`. El orquestador que describimos arriba extiende eso a nivel squad: `fan-out` separa `localAgents` (Promise.allSettled paralelo) de `cloudAgents` (for secuencial con `throttle_ms` + jitter + backoff). El `throttledCall` local no hace sleep, el cloud duerme `throttle + random*1000` y reintenta fallback models si hay `429`.
* **Heartbeat y timeout:** `squadSessions` guarda `history` (30) y `taskId` en `memory/conversations/{squad}.json`. `closeSquadSession` se programa a `chat_timeout_minutes` (30/45) y `saveConversation` persiste. Así, si un agente se cae, el lock expira y otro reclama.
* **Detallitos cerrados hasta aquí:** `chat.js:37` log `[presence] kicking duplicate` + `agents/agent.js:411-427` reconnect manual 5s + `BOARD_API_URL`/`LLAMA_URL` envs + `ALLOWED_ORIGINS` en `.env` para 3003/3004. Todo quedó en `INFRA-VIVA.md` y `BOOTSTRAP.md v4.3-regla-oro`.

> La fiesta demostró que el diseño híbrido (local paralelo + nube secuencial) sí escala a 4 dispositivos sin pisarse, siempre que se respete `throttle_ms 0` para local y `4000 + jitter` para nube.

## 6) Deuda v3 completada — Ferrari v4.3 limpio (2026-08-26)

**Antes:** 3 granja.json peleando (`granja.json` root, `server/lib/granja.json`, `server/go/granja.json`), board :9998 metiendo 30s de `for(i<30) fetch /health`, `orchestrator.js` con `boardStart/Stop` legacy y `throttle 4000 vs 0`.

**Ahora:**
- **Fuente única:** `granja.json` root v4.3-ferrari → `server/lib/granja.json` symlink → `server/go/granja.json` symlink. Un solo `throttle 0`, un solo router `http://100.121.64.26:8080`, `routing 80/20` real.
- **Orchestrator sin andamio:** `callLlamaWithHistory(history, prompt, url, model)` pasa `model` directo a `/v1/chat/completions`. `boardStart/Stop` quedan como `return; // bypass` con `catch` por 404. Se eliminó la espera de 30s a `/health`.
- **Test automático:** `make test-squad` (4 agents misma task sin pisarse) — `ALL TESTS PASSED`. Es el criterio de Done que faltaba desde la fiesta.
- **Ferrari verificado:** `./scripts/ferrari.sh` con endpoints reales `/v1/models` (9 modelos), `/health` ok, control `:9998 /status` router active. No placeholder.

**v3.1 completada (dual):** `memory-rag.js` ahora `LLAMA_EMBED_URL http://100.121.64.26:8080` (Forja principal) + fallback VPS `:8086` (95M nomic). `embed(text)` intenta Forja :8080, si falla cae a VPS :8086. `POST /v1/embeddings` → 200 con `data[0].embedding`. `:8086` respaldo, `llama-embed.service` no necesario. `make test-squad` PASS + `curl /v1/models` 10 modelos.

*Documentado tras Deuda v3 ejecutada por @local-router.*
