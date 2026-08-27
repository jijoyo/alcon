# Alcon v4.3-regla-oro

> Sistema multi-agente con squads de IA que compiten, debaten y colaboran.
> Local-first híbrido: GPU propia (llama.cpp) + nube opcional (OpenRouter/opencode). Es tuyo.

## Qué es

Alcon es un sistema de orquestación multi-agente distribuido en 4 equipos vía Tailscale. Tiene 3 squads activos que ejecutan tareas de auditoría y research; la visión a largo plazo es un batallón de squads especializados por proyecto (contenido, médico, etc.). Usa modelos locales en GPU (llama.cpp) con fallback a nube.

No es CrewAI. No es LangChain. Es tu sistema, en tus máquinas, con tus modelos.

## Arquitectura

```
                    ┌─────────────────────────────────────┐
                    │         PWA (React + TS)            │
                    │      http://100.102.63.30:3004      │
                    └──────────────┬──────────────────────┘
                                   │
                    ┌──────────────▼──────────────────────┐
                    │     Fastify Server (:3003)          │
                    │   ┌─────────────────────────────┐   │
                    │   │  POST /api/orchestrate      │   │
                    │   │  POST /api/task (granja     │   │
                    │   │         guard)              │   │
                    │   └─────────────┬───────────────┘   │
                    │                 │                    │
                    │   ┌─────────────▼───────────────┐   │
                    │   │     orchestrator.js          │   │
                    │   │  boardStart → injectCode →   │   │
                    │   │  callLlama → boardStop       │   │
                    │   └─────────────┬───────────────┘   │
                    └─────────────────┼──────────────────┘
                                      │
                    ┌─────────────────▼──────────────────┐
                    │       Board API (:9998)            │
                    │  POST /start?model=qwen            │
                    │  POST /stop                        │
                    │  13 modelos registrados            │
                    └─────────────────┬──────────────────┘
                                      │
                    ┌─────────────────▼──────────────────┐
                    │    llama-server (:8080)            │
                    │    1 modelo a la vez en GPU        │
                    │    switch via systemd              │
                    └────────────────────────────────────┘

debian (RTX 3060) ←──Tailscale──→ vps Oracle (100.102.63.30)
```

## Squads Activos (server/lib/granja.json)

| Squad | Pattern | Qué hace | Prompt ejemplo |
|-------|---------|----------|----------------|
| `quick-review` | single | Revisión rápida con 1 modelo | `@quick-review revisa pwa/src/App.tsx` |
| `code-audit` | fan-out-fan-in | Auditoría multi-dispositivo (debian+kali+vps+cel) | `@code-audit audita server/server.js` |
| `research-deep` | debate 3 rondas | Investigación con argumentos | `@research-deep debate SQLite vs JSON` |

### Roadmap: Batallón por proyecto (diseñado, no implementado)

La visión original: un squad especializado por cada proyecto de israel, que se ayudan entre sí cuando hay traslape.

| Squad | Proyecto objetivo | Estado |
|-------|-------------------|--------|
| `architecture` | consensus 3 votos | Diseñado en docs, sin agentes en granja.json |
| `mithos-cap` | Contenido (Mithos/YouTube) | Diseñado, no implementado |
| `deploy` | Deploy al VPS | Diseñado, no implementado |
| `memory-consolidation` | Consolidar auditorías | Diseñado, no implementado |
| `youtube-auto` | Metadata de video | Diseñado, no implementado |

Para revivir uno: agregar sus agentes a `granja.json` (ver `Cómo agregar squad` abajo).

## Modelos Locales

| Board Key | Modelo | VRAM | tok/s | Uso principal |
|-----------|--------|------|-------|---------------|
| `qwen` | qwen3.6-35b-A3B-MXFP4 | 10.6GB | 45 | Code review |
| `qwen-coder-14b` | qwen2.5-coder-14b | 8.4GB | 30 | Security audit |
| `hauhaucs-12b` | gemma4-12b-hauhaucs | 6.9GB | 129 | Creative / health |
| `gemma` | gemma4-12b-uncensored | 6.9GB | 80 | Uncensored |
| `gemma-26b-a4b` | gemma4-26b-a4b | 11.4GB | 55 | Dense reasoning |

## Endpoints API

### Orquestación (nuevo en v4.0)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/orchestrate` | Ejecuta un squad completo. Body: `{text, squad}` |

### Tasks (con granja guard)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/task` | Crear tarea. **Si empieza con @squads, va directo al orchestrator** |
| `GET` | `/api/tasks` | Listar tareas |
| `GET` | `/api/task/:id` | Detalle de tarea |
| `POST` | `/api/task/:id/claim` | Agente reclama tarea |
| `POST` | `/api/task/:id/heartbeat` | Extender lock |
| `POST` | `/api/task/:id/message` | Mensaje en chat de tarea |
| `POST` | `/api/task/:id/complete` | Marcar como hecha |

### System

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/health` | Health check + versión |
| `GET` | `/api/status` | Estado del sistema |
| `GET` | `/api/agents` | Agentes registrados |

## Flujo del Orchestrator

```
1. Usuario escribe: @code-audit revisa server/server.js
                          │
2. Granja guard intercepta (@code-audit → squad)
                          │
3. boardStart("code-review") → POST :9998/start?model=qwen
   └─ Switch systemd: qwen3-35b.service → GPU
   └─ Espera: polling /health cada 1s (max 30s)
                          │
4. injectCode("revisa server/server.js")
   └─ Detecta patrón: "revisa server/server.js"
   └─ Lee: /home/israel/Documentos/alcon/server/server.js
   └─ Inyecta código real (max 12000 chars)
                          │
5. callLlama("[reviewer] revisa server/server.js\n=== CODIGO REAL ===\n...")
   └─ POST :8080/v1/chat/completions
   └─ Respuesta del modelo
                          │
6. boardStop() → POST :9998/stop
   └─ Apaga modelo actual
                          │
7. Repite para security (qwen-coder-14b) y health (hauhaucs-12b)
                          │
8. Síntesis final con qwen3-35b
                          │
9. Guarda en pending-2026-08-16.md
```

## Ejemplo curl

```bash
# Auditoría completa de server.js
curl -X POST http://localhost:3003/api/orchestrate \
  -H "Content-Type: application/json" \
  -d '{"text":"@code-audit revisa server/server.js en busca de CORS y race conditions","squad":"code-audit"}'

# Respuesta:
{
  "orchestrator": true,
  "squad": "code-audit",
  "final": "### Síntesis del Squad Fan-Out-Fan-In\n...",
  "pendingPath": "./lib/memory/pending-2026-08-16.md"
}
```

## Cómo funciona injectCode()

`injectCode()` busca patrones de archivos en el prompt del usuario. Si detecta algo como "revisa server.js", lee el archivo real del disco y lo inyecta en el prompt antes de enviarlo al modelo.

```
Prompt original: "@code-audit revisa server/server.js"
Prompt inyectado: "@code-audit revisa server/server.js

=== CODIGO REAL server/server.js ===
(import Fastify from 'fastify'; ...)
=== FIN CODIGO ==="
```

Esto permite que los modelos de IA auditen código REAL, no solo su imaginación.

## Híbrido local + nube

Cuando necesites un modelo que no tienes local:

1. Agregar provider en `model-registry.json`:
```json
"openrouter-claude": {
  "board_key": "openrouter/anthropic/claude-3.5-sonnet",
  "model": "claude-3.5-sonnet",
  "service": "external",
  "vram": "0GB",
  "toks": 0
}
```

2. Agregar API key en `.env`:
```
OPENROUTER_API_KEY=sk-or-...
```

3. Modificar `orchestrator.js` para detectar `service: "external"` y llamar a la API en vez de local

## Quickstart Ferrari

```bash
pm2 start ecosystem.config.cjs
curl http://localhost:8080/v1/models  # debe dar 9 modelos
./scripts/ferrari.sh                  # health check Ferrari
```

## Desarrollo Local

```bash
# Server
cd server && npm install && npm run dev    # :3003

# PWA
cd pwa && npm install && npm run dev       # :3004

# Agente
cd agents && node agent.js debian http://localhost:3003
```

## Deploy

```bash
# Automático
./deploy.sh

# Manual en VPS
ssh root@100.102.63.30 "cd /home/ubuntu/alcon && git pull origin main && pm2 restart alcon-api --update-env"
```

## PM2

```bash
pm2 list                          # Ver procesos
pm2 logs alcon-api --lines 20     # Logs recientes
pm2 restart alcon-api             # Reiniciar
pm2 save                          # Guardar configuración
```

## Commits

- `feat:` — Feature nueva
- `fix:` — Bug fix
- `chore:` — Maintenance
- `docs:` — Documentación
- `refactor:` — Refactoring sin cambio de comportamiento

## Persistencia

| Archivo | Contenido |
|---------|-----------|
| `server/lib/memory/pending-*.md` | Historial de auditorías |
| `server/tasks.json` | Tareas del sistema |
| `server/messages.json` | Chat grupal (últimos 50) |

## Seguridad

- Sin autenticación — sistema de confianza interna
- Permisos por agente en `server/lib/permisos.js`
- Granja guard intercepta @squads antes de crear tareas
