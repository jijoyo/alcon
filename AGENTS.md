# AGENTS.md — Alcon v4.0-granja-real

> Sistema multi-agente con 8 squards de IA que compiten, debaten y colaboran.
> Todo corre en local. Nada sale a la nube.

## Infra

| Dispositivo | Hardware | IP Tailscale | Rol |
|-------------|----------|--------------|-----|
| **debian** | RTX 3060 12GB, 32GB RAM | 100.121.64.26 | Brain (desarrollo + GPU) |
| **vps** | Oracle ARM 21GB | 100.102.63.30 | Server (Fastify + PM2) |
| **kali** | GTX 1050 4GB, 16GB RAM | 100.103.82.104 | Git executor |
| **cel** | Redmi Note 11, 1GB | 100.76.111.99 | Reviewer/approver |

## Stack

- **Server:** Fastify + Socket.io (Node.js, ESM)
- **PWA:** React + TypeScript + Tailwind + Capacitor
- **Deploy:** PM2 en VPS Oracle ARM
- **GPU:** 1 modelo a la vez en :8080, switch via systemd + Board API :9998
- **Dashboard:** :8081 (monitor de modelos)

## Board API :9998 — Modelos

| Board Key | Modelo | Servicio systemd | VRAM | tok/s |
|-----------|--------|------------------|------|-------|
| `qwen` | qwen3.6-35b-A3B-MXFP4 | qwen3-35b.service | 10.6GB | 45 |
| `qwen-coder-14b` | qwen2.5-coder-14b | qwen-coder-14b.service | 8.4GB | 30 |
| `hauhaucs-12b` | gemma4-12b-hauhaucs | hauhaucs-12b.service | 6.9GB | 129 |
| `gemma` | gemma4-12b-uncensored | llama-3060.service | 6.9GB | 80 |
| `gemma-26b-a4b` | gemma4-26b-a4b | gemma4-26b-a4b.service | 11.4GB | 55 |

## Los 8 Squads (granja.json)

| Squad | Pattern | Agents | Ejemplo de prompt |
|-------|---------|--------|-------------------|
| `quick-review` | single | reviewer | `@quick-review revisa pwa/src/App.tsx` |
| `code-audit` | fan-out-fan-in | reviewer+security+health | `@code-audit audita server/server.js` |
| `research-deep` | debate 3 rondas | researcher+analyst+critic | `@research-deep debate si migrar a SQLite` |
| `architecture` | consensus 3 votos | architect+architect2+architect3 | `@architecture propone microservicios` |
| `mithos-cap` | proxy-atomico | guion+lore-check+seo-youtube | `@mithos-cap crea CAP para este video` |
| `deploy` | single | deployer | `@deploy haz deploy al VPS` |
| `memory-consolidation` | single | consolidator | `@memory-consolidation consolida auditorías` |
| `youtube-auto` | fan-out-fan-in | title+thumbnail+description | `@youtube-auto genera metadata` |

## Orchestrator

**Endpoint:** `POST /api/orchestrate`

**Flujo:**
1. Recibe `{text, squad}` desde PWA o curl
2. `granja.json` define agents del squad
3. Para cada agent: `boardStart(model_ref)` → switch systemd → espera GPU
4. `injectCode(text)` lee archivos reales (hasta 12000 chars) y los inyecta
5. `callLlama(prompt)` llama a :8080 con el prompt enriquecido
6. `boardStop()` libera GPU
7. Resultado se guarda en `server/lib/memory/pending-YYYY-MM-DD.md`

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
4. Test: `curl -X POST localhost:3003/api/orchestrate -H "Content-Type: application/json" -d '{"text":"@nuevo-squad test","squad":"nuevo-squad"}'`

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

- `server/lib/granja.json` — Definición de squads
- `server/lib/model-registry.json` — Mapeo de modelos a board_key
- `server/lib/orchestrator.js` — Lógica de orquestación + injectCode
- `server/routes/tasks.js` — Granja guard (intercepta @squads)
- `server/lib/memory/pending-*.md` — Historial de auditorías
- `docs/MANUAL_USUARIO_EXTENSO.md` — Manual completo para Juan
- `BOOTSTRAP.md` — Contexto rápido para no olvidar
