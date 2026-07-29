# Investigación: Alternativas a Alcón

> Creado: 2026-07-27
> Metodología: OODA (Observe → Orient → Decide → Act)
> Investigador: Mimo (OpenCode)

## Proyectos investigados

### 1. agent-tasks (keshrath/agent-tasks)
- **Repo**: https://github.com/keshrath/agent-tasks
- **NPM**: agent-tasks (101 descargas/semana)
- **Tech**: TypeScript + SQLite + MCP + REST + WebSocket
- **License**: MIT
- **Features**: Pipeline stages (7 etapas), task dependencies (DAG), approval workflows, subtasks, threaded comments, artifacts versionados, full-text search (FTS5), kanban dashboard, agent affinity, heartbeat cleanup
- **Puerto**: 3422
- **Instalación**: `npm install -g agent-tasks`

### 2. wood-fired-tasks (Wood-Fired-Games/wood-fired-tasks)
- **Repo**: https://github.com/Wood-Fired-Games/wood-fired-tasks
- **Tech**: Fastify + SQLite + MCP (31 tools) + REST + CLI + SSE
- **License**: MIT
- **Features**: Atomic claiming (optimistic locking), workflow automation (parent auto-complete, dependency auto-unblock), WSJF prioritization, event-router daemon, Slack integration
- **Puerto**: 3000 (configurable)
- **Instalación**: `npm install -g wood-fired-tasks`

### 3. agentboard (seoshmeo/agentboard)
- **Repo**: https://github.com/seoshmeo/agentboard
- **Tech**: Fastify + SQLite (Drizzle ORM) + React 19 + WebSocket
- **License**: MIT
- **Features**: Kanban 6 estados, AI agent autónomo (Claude API), role-based auth, decision logs, activity feed, Telegram notifications, sprint filtering
- **Puerto**: 3000 (API) + 5173 (web)

### 4. ai-agent-board (DanWahlin/ai-agent-board)
- **Repo**: https://github.com/DanWahlin/ai-agent-board
- **Tech**: Express + SQLite + React + WebSocket
- **License**: MIT
- **Features**: Multi-agente (Copilot, Claude, Codex, OpenCode, Hermes, OpenClaw), git worktree isolation, drag-and-drop Kanban, real-time streaming, local merge/PR
- **Puerto**: configurable

### 5. agent-kanban (saltbo/agent-kanban)
- **Repo**: https://github.com/saltbo/agent-kanban
- **Tech**: Cloudflare D1 + SSE + Ed25519
- **License**: MIT
- **Features**: Identidad criptográfica para agentes, auto-organización, task dependencies, atomic claims, multi-repo, human-agent chat
- **Distribuido**: Sí (D1)

### 6. agent_mq (KaneBetter/agent_mq)
- **Repo**: https://github.com/KaneBetter/agent_mq
- **Tech**: Fastify + Postgres + Docker + SSE
- **License**: MIT
- **Features**: Distributed task queue, fleet management, capability-based routing, dead-letter queue, reaper (stale task cleanup), dispatch board
- **Puerto**: 4000 (API) + 5173 (web)
- **Requiere**: Docker + Postgres

### 7. Fleet API (nexus-marbell/fleet-api)
- **Repo**: https://github.com/nexus-marbell/fleet-api
- **Tech**: RFC (no implementado)
- **Features**: Workflow registry, task dispatch, SSE streaming, mid-task context injection, pause/resume/cancel, retasking
- **Estado**: Solo especificación

### 8. Postgres-Agent-Orchestrator (KellerKev)
- **Repo**: https://github.com/KellerKev/Postgres-Agent-Orchestrator
- **Tech**: Postgres 18 + pgmq + Python
- **License**: MIT
- **Features**: Task queue (pgmq), agent memory (JSONB), event-driven wakeup (LISTEN/NOTIFY), agent lineage (ltree)
- **Nota**: Minimalista, proof of concept

## Tabla comparativa

| Feature | Alcón | agent-tasks | wood-fired | agentboard | ai-agent-board | agent-kanban | agent_mq |
|---------|-------|-------------|------------|------------|----------------|--------------|----------|
| Pipeline stages | ❌ | ✅ 7 | ✅ 3 | ✅ 6 | ✅ 4 | ✅ 4 | ❌ |
| Task dependencies | ❌ | ✅ DAG | ✅ Auto | ✅ Básico | ❌ | ✅ | ❌ |
| Approval workflows | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ Review | ❌ |
| Subtasks | ❌ | ✅ | ✅ Auto | ❌ | ❌ | ✅ | ❌ |
| Comments | ✅ Messages | ✅ Threaded | ✅ | ✅ | ❌ | ✅ Chat | ❌ |
| Artifacts | ❌ | ✅ Versionados | ❌ | ✅ Básico | ❌ | ❌ | ❌ |
| Full-text search | ❌ | ✅ FTS5 | ✅ FTS5 | ❌ | ❌ | ❌ | ❌ |
| Kanban dashboard | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Chat en tiempo real | ✅ Socket.io | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Multi-dispositivo | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Docker |
| MCP integration | ❌ | ✅ 8 tools | ✅ 31 tools | ❌ | ❌ | ❌ | ❌ |
| Distributed locking | ✅ TTL+HB | ❌ | ✅ Optimistic | ❌ | ❌ | ✅ Atomic | ✅ SKIP LOCKED |

## Conclusión

**Alcón es el ÚNICO con chat en tiempo real + multi-dispositivo.** Los demás son más maduros en features de pipeline, pero no tienen comunicación directa entre agentes ni coordinación en dispositivos móviles.

**Decisión: Mejorar Alcón, no reemplazar.**
