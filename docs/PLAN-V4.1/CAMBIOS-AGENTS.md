# Cambios en AGENTS.md para v4.1-conversacional

## Resumen de cambios

| Sección | Cambio |
|---------|--------|
| L1 | `v4.0-granja-real` → `v4.1-conversacional` |
| L3-4 | Agregar hybrid local/nube |
| L10-13 | Agregar `OpenCode: ✅` por device |
| L40-51 | Actualizar squads con nuevos patterns |
| L53-67 | Reescribir Orchestrator section |
| Nueva | CLI Overrides |
| Nueva | Circuit Breaker + Throttle |
| L129-137 | Agregar `memory/conversations/` a referencias |

## Cambios detallados

### L1: Versión
```markdown
# AGENTS.md — Alcon v4.1-conversacional
```

### L3-4: Descripción
```markdown
> Sistema multi-agente con 8 squards de IA que compiten, debaten y colaboran.
> Hybrid: local primero (0ms), nube si falla (4s throttle). 4 devices × 2 backends.
```

### L10-13: Infra (agregar OpenCode)
```markdown
| **debian** | RTX 3060 12GB, 32GB RAM | 100.121.64.26 | Brain (desarrollo + GPU) | OpenCode ✅ |
| **vps** | Oracle ARM 21GB | 100.102.63.30 | Server (Fastify + PM2) | OpenCode ✅ |
| **kali** | GTX 1050 4GB, 16GB RAM | 100.103.82.104 | Git executor | OpenCode ✅ |
| **note-11** | Redmi Note 11, 1GB | 100.122.196.23 | Reviewer/approver | OpenCode ✅ |
```

### Después de L28: Agregar CLI Overrides
```markdown
### CLI Overrides (v4.1)

| Comando | Efecto |
|---------|--------|
| `@code-audit --local revisa server.js` | Solo debian/kali local, 0ms, sin gastar tokens |
| `@code-audit --cloud revisa server.js` | Todos en nube, 4s throttle |
| `@code-audit --auto revisa server.js` | Auto: local primero, fallback nube (default) |
| `@code-audit --device=debian revisa server.js` | Solo debian |
| `@code-audit --device=kali,vps --cloud revisa server.js` | Solo kali+vps en nube |
```

### L53-67: Reescribir Orchestrator
```markdown
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
```

### L40-51: Actualizar tabla de squads
```markdown
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
```

### L129-137: Actualizar referencias
```markdown
## Referencias

- `server/lib/granja.json` — Definición de squads v4.1
- `server/lib/model-registry.json` — Mapeo de modelos a board_key
- `server/lib/orchestrator.js` — Orchestrator v4.1 (circuit breaker + hybrid + throttle)
- `server/routes/chat.js` — Chat con squad detection + parseOverrides
- `server/routes/tasks.js` — Granja guard + single task per squad
- `server/lib/memory/conversations/` — Historial JSON por squad
- `server/lib/memory/pending-*.md` — Historial de auditorías
- `docs/PLAN-V4.1/` — Plan de ejecución v4.1
- `docs/MANUAL_USUARIO_EXTENSO.md` — Manual completo para Juan
- `BOOTSTRAP.md` — Contexto rápido para no olvidar
```
