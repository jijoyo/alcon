# Alcon Server

Fastify v5 + Socket.io v4 server para el sistema multi-agente Alcon.

## Quick Start

```bash
npm install
node server.js          # Puerto 3003 (default)
PORT=3002 node server.js  # Puerto custom
```

## API Reference

### Health

```
GET /health
→ { status, version, uptime, taskCount, agents }
```

### Tasks

```
POST /api/task
Body: { text: "@vps haz deploy" }
→ Task (con auto-route por tag)

GET /api/tasks?agent=kali&status=pendiente
→ { tasks[], count, version }

GET /api/task/:id
→ Task

POST /api/task/:id/claim
Body: { owner: "kali" }
→ Task (con lock)
409 si ya esta reclamado por otro

POST /api/task/:id/heartbeat
Body: { owner: "kali" }
→ { ok, lock_expires_at }

POST /api/task/:id/message
Body: { from: "kali", text: "Procesando..." }
→ Message { id, from, text, timestamp }

GET /api/task/:id/messages
→ { messages[], count }

POST /api/task/:id/complete
Body: { owner: "kali", result: "Deploy exitoso" }
→ Task

POST /api/task/:id/error
Body: { owner: "kali", error: "Connection timeout" }
→ Task
```

### Agent Control

```
GET /api/agents
→ { agents: [{ name, running }] }

POST /api/agent/:name/start
→ { ok, agent, status: "started"|"already_running" }

POST /api/agent/:name/stop
→ { ok, agent, status: "stopped"|"already_stopped" }
```

### System

```
GET /api/status
→ { total_tasks, version, agents, timestamp }

POST /api/ping
Body: { agent: "kali" }
→ { ok, agent, timestamp }
```

## Socket.io — Namespace `/enjambre`

### Client → Server

| Evento | Payload | Descripcion |
|--------|---------|-------------|
| `chat:join` | `{ name }` | Identificarse y unirse al chat |
| `chat:message` | `{ from, text }` | Enviar mensaje grupal |
| `typing:start` | — | Empezar a escribir |
| `typing:stop` | — | Dejar de escribir |
| `chat:heartbeat` | — | Keepalive (cada 5s) |

### Server → Client

| Evento | Payload | Descripcion |
|--------|---------|-------------|
| `chat:history` | `Message[]` | Historial al unirse (ultimos 50) |
| `chat:message` | `Message` | Nuevo mensaje broadcast |
| `presence:update` | `{ peers[] }` | Estado de todos los peers |

### Presence Peer Schema

```json
{
  "name": "kali",
  "status": "vivo|muerto|idle|escribiendo",
  "typing": false
}
```

## CORS

```js
// @fastify/cors — para rutas HTTP
origin: [
  'http://100.102.63.30:5176',  // PWA en VPS
  'http://100.102.63.30:3003',  // API directo
  'http://localhost:5175',       // dev
  'http://localhost:5176',       // preview
]

// Socket.io — para /socket.io/* paths (independiente de @fastify/cors)
cors: {
  origin: [...],  // misma lista
  methods: ['GET', 'POST'],
}
```

**IMPORTANTE**: `@fastify/cors` y Socket.io `cors` son capas independientes. Ambas necesitan configuracion.

## Persistencia

- `tasks.json` — Tareas con messages embebidos
- `messages.json` — Chat grupal (ultimos 50, rotacion automatica)

Ambos usan atomic write (write .tmp + rename) para evitar corrupcion.

## Variables de Entorno

| Variable | Default | Descripcion |
|----------|---------|-------------|
| `PORT` | 3003 | Puerto del server |
| `HOST` | 0.0.0.0 | Host bind |

## Arquitectura Interna

```
server.js
├── Imports + Constants
├── Chat persistence (readChat/writeChat)
├── Agent state (agentRunning map)
├── Fastify setup + CORS
├── Data helpers (readData/writeData)
├── HTTP Routes (tasks, agents, health)
├── Stale lock reclaim (setInterval 30s)
├── fastify.listen callback
│   ├── Socket.io new Server(fastify.server)
│   ├── Namespace /enjambre
│   ├── Connection handler (join, message, typing, heartbeat, disconnect)
│   └── Presence check (setInterval 5s)
└── broadcastPresence (module scope)
```
