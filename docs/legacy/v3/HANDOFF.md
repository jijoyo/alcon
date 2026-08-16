# HANDOFF — Alcon Multi-Agent Task System

> Para: Agente nuevo
> Creado: 2026-07-27
> Estado: Listo para ejecutar

## Qué es Alcon

Alcon es un **sistema de coordinación multi-agente con chat en tiempo real**. Permite que agentes AI (Kali, Mimo, VPS, Reina) colaboren en tareas con comunicación directa, presencia, y un dashboard visual.

**Stack:**
- Server: Fastify + Socket.io (Node.js, ESM)
- PWA: React + TypeScript + Tailwind + Capacitor
- Deploy: PM2 en VPS Oracle ARM (`ubuntu@159.54.143.227`)
- Puertos: :3003 (server), :5176 (PWA)

**Qué tiene hoy:**
- Chat en tiempo real entre agentes (Socket.io)
- Coordinación multi-dispositivo (Termux, VPS, Kali)
- Presencia con heartbeat (quién está vivo)
- Sistema de tareas con distributed locking (TTL + heartbeat)
- Engram (memoria persistente entre sesiones)
- PWA con 3 vistas (tasks, chat, status)

**Qué le falta (el update):**
- Pipeline stages (backlog → plan → implement → test → done)
- Task dependencies (DAG)
- Subtasks, artifacts, approval workflows
- Full-text search
- Dashboard Kanban
- Agent execution real (agent.js es un stub)

## Quiénes somos

| Nodo | Rol | Capacidad |
|------|-----|-----------|
| **Kali** (PC) | Orquestador | Builds, debugging, git, desarrollo |
| **Mimo** (Cel) | Supervisora | Testing físico, vite dev, opencode web |
| **VPS** (Oracle) | Ejecutor | 24/7 uptime, server, engram, PM2 |
| **Reina** (Debian) | Desarrollo | Desarrollo pesado (futuro) |

## Dónde está TODO

| Qué | Dónde |
|-----|-------|
| Repo GitHub | `github.com/jijoyo/alcon` (privado) |
| Repo local | `/home/jijoyo/Documentos/alcon/` |
| Server en VPS | `/home/ubuntu/alcon/server/server.js` |
| PWA en VPS | `/home/ubuntu/alcon/pwa/` |
| Engram (memorias) | Proyecto `alcon` (9 memorias) |
| Research de Mimo | `handoff/01-04` en este repo |
| OODA loop | `handoff/05-project-loop.md` |
| Ecosistema Kali | `handoff/06-ecosystem.md` |

## Cómo trabajar

### OODA Loop (obligatorio para cada tarea)

```
1. OBSERVAR  → Entender el problema, recopilar datos
2. ORIENTAR  → Investigar opciones, comparar fuentes
3. DECIDIR   → Elegir la mejor opción, crear plan guardado
4. ACTUAR    → Ejecutar paso a paso con checkpoints
5. DOCUMENTAR → Guardar aprendizajes en Engram
```

**Regla #0:** SIEMPRE guardar el plan como MD antes de ejecutar. Si no guardaste el plan, no podés avanzar.

### Reglas del enjambre

- SIEMPRE `git pull` antes de cada tarea
- SIEMPRE `git push` después de cada cambio
- NUNCA commitear `.env` o secrets
- Documentar en CHANGELOG.md cada cambio
- Guardar en Engram después de cada decisión importante

### Shell Escaping

Siempre usar comillas simples cuando el texto tenga caracteres especiales: `()` `|` `>` `<` `` ` `` `$` `;` `!`

## El Update (13 features)

### Fase 1: Fundamentos (post-audit)
| # | Feature | Fuente | Notas |
|---|---------|--------|-------|
| 1.1 | SQLite | wood-fired-tasks | Migrar de tasks.json a SQLite WAL |
| 1.2 | Pipeline stages | agent-tasks | 5 etapas: backlog → done |
| 1.3 | Task dependencies | wood-fired-tasks | DAG con auto-unblock |

### Fase 2: Colaboración
| # | Feature | Fuente | Notas |
|---|---------|--------|-------|
| 2.1 | Subtasks | agent-tasks | Parent/child con progreso |
| 2.2 | Threaded comments | agent-tasks | Extender messages existente |
| 2.3 | Artifacts | agent-tasks | Archivos adjuntos por etapa |
| 2.4 | Approval workflows | agent-tasks | Approve/reject con auto-regress |

### Fase 3: Búsqueda y UX
| # | Feature | Fuente | Notas |
|---|---------|--------|-------|
| 3.1 | Full-text search | agent-tasks | FTS5 en SQLite |
| 3.2 | Kanban dashboard | agentboard | React + drag-and-drop |
| 3.3 | Agent affinity | agent-tasks | Routing inteligente por historial |

### Fase 4: Integración
| # | Feature | Fuente | Notas |
|---|---------|--------|-------|
| 4.1 | Engram auto-save | Nuestro | Al completar tarea → mem_save ✅ DONE v3.1-clean |
| 4.2 | Chat mejorado | Nuestro | Threaded, notificaciones |
| 4.3 | PWA actualizado | Nuestro | Nuevo dashboard con pipeline |

**Orden de implementación:**
```
1.1 SQLite → 1.2 Pipeline → 1.3 Dependencies → 2.1 Subtasks
→ 2.2 Comments → 2.3 Artifacts → 3.1 Search → 4.1 Engram
```

## EMPEZAR AQUÍ

### Paso 1: Audit de server.js

Leer el checklist en `handoff/02-audit-pendiente.md`.

**Qué revisar:**
1. Estructura de server.js (endpoints, modelo de datos, locking, Socket.io)
2. Datos actuales (tasks.json, mensajes, agentes)
3. Dependencias (package.json, vulnerabilidades)
4. Riesgos (code paths, hardcodes, escalabilidad)

**Output esperado:** `handoff/07-audit-results.md` con:
1. Resumen de la arquitectura actual
2. Lista de endpoints y su función
3. Modelo de datos actual
4. Recomendaciones para agregar pipeline stages
5. Riesgos identificados

### Paso 2: Feature 1.1 — SQLite

Después del audit, migrar de tasks.json a SQLite WAL.

### Referencia

- `handoff/01-research-comparison.md` — 8 alternativas comparadas
- `handoff/03-feature-roadmap.md` — Roadmap completo con criterios de éxito
- `handoff/04-decision-record.md` — Por qué mejorar, no reemplazar
- `handoff/05-project-loop.md` — OODA loop detallado
- `handoff/06-ecosystem.md` — Herramientas y proyectos disponibles
