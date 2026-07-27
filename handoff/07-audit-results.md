# Auditoría: Alcón Server

> Fecha: 2026-07-27
> Auditor: Debian (Reina/forja)
> Archivo: `/home/ubuntu/alcon/server/server.js` (631 líneas)
> Estado: COMPLETADA

---

## 1. Resumen de Arquitectura

Alcón server es un **monolito Fastify + Socket.io** en Node.js (ESM). Gestiona tareas para 3 agentes (kali, vps, cel) con distributed locking, chat en tiempo real, y presencia.

| Componente | Detalle |
|-----------|---------|
| Runtime | Node.js (ESM) |
| HTTP Framework | Fastify 5.3.3 |
| Realtime | Socket.io 4.8.3 |
| CORS | @fastify/cors 11.0.1 |
| Persistencia | JSON files (tasks.json, messages.json) |
| Process Manager | PM2 (fork mode) |
| Puerto | :3003 (VPS) / :3002 (ecosystem.config.cjs default) |

---

## 2. Endpoints (16 HTTP + Socket.io)

### Health & Status

| Método | Ruta | Función | Línea |
|--------|------|---------|-------|
| GET | `/health` | Health check, uptime, task count, agents | 120 |
| GET | `/api/status` | Status completo por agente (active/pending/done/error) | 355 |
| POST | `/api/ping` | Heartbeat de agente (no-op) | 394 |

### Tasks CRUD

| Método | Ruta | Función | Línea |
|--------|------|---------|-------|
| POST | `/api/task` | Crear tarea (parsea @tag o keywords) | 134 |
| GET | `/api/tasks` | Listar tareas (filtro por agent, status) | 166 |
| GET | `/api/task/:id` | Detalle de tarea | 178 |

### Distributed Locking

| Método | Ruta | Función | Línea |
|--------|------|---------|-------|
| POST | `/api/task/:id/claim` | Reclamar tarea (lock con TTL 10min) | 187 |
| POST | `/api/task/:id/heartbeat` | Extender lock via heartbeat | 233 |
| POST | `/api/task/:id/complete` | Completar tarea (libera lock) | 292 |
| POST | `/api/task/:id/error` | Marcar error (libera lock) | 324 |

### Messages (por tarea)

| Método | Ruta | Función | Línea |
|--------|------|---------|-------|
| POST | `/api/task/:id/message` | Enviar mensaje (append-only) | 258 |
| GET | `/api/task/:id/messages` | Obtener mensajes de una tarea | 282 |

### Agent Control

| Método | Ruta | Función | Línea |
|--------|------|---------|-------|
| GET | `/api/agents` | Listar agentes + estado | 401 |
| POST | `/api/agent/:name/start` | Iniciar agente | 410 |
| POST | `/api/agent/:name/stop` | Detener agente | 428 |

### Socket.io (namespace `/enjambre`)

| Evento | Dirección | Función |
|--------|-----------|---------|
| `chat:join` | in | Identificar agente, enviar historial |
| `chat:message` | in/out | Enviar mensaje de chat |
| `typing:start/stop` | in | Indicador de escritura |
| `chat:heartbeat` | in | Keepalive de presencia |
| `disconnect` | in | Marcar como muerto |
| `chat:history` | out | Historial de chat (50 msgs max) |
| `presence:update` | out | Actualización de presencia |

---

## 3. Modelo de Datos

### tasks.json

```json
{
  "tasks": [
    {
      "id": 1784676200505676,          // Date.now() * 1000 + random
      "text": "prueba tailscale",       // Texto limpio (sin @tag)
      "original_text": "@kali prueba",  // Texto original
      "status": "pendiente|en_proceso|hecho|error",
      "assigned_to": "kali|vps|cel",
      "lock_owner": null,               // Agente que posee el lock
      "lock_acquired_at": null,         // ISO timestamp
      "lock_expires_at": null,          // ISO timestamp (TTL 10min)
      "last_heartbeat": null,           // ISO timestamp
      "messages": [],                   // Array de mensajes
      "result": null,                   // Resultado al completar
      "created": "2026-07-21T23:23:20.505Z",
      "completed_at": null,             // ISO timestamp
      "error_at": null                  // ISO timestamp
    }
  ],
  "version": 44                         // Optimistic concurrency
}
```

### messages.json

```json
[
  {
    "id": "uuid-v4",
    "from": "israel",
    "text": "hola",
    "timestamp": "2026-07-22T00:41:55.106Z"
  }
]
```

**Nota:** messages.json es chat global (no por tarea). Las tareas tienen sus mensajes embebidos en `task.messages`.

### Estados de tarea

| Estado | Significado |
|--------|------------|
| `pendiente` | Creada, esperando agente |
| `en_proceso` | Reclamada con lock activo |
| `hecho` | Completada exitosamente |
| `error` | Falló |

---

## 4. Agentes

| Agente | Palabras clave | Estado PM2 |
|--------|---------------|------------|
| kali | code, bug, fix, test, review, git... | Running |
| vps | build, deploy, server, docker, pm2... | Running |
| cel | screen, mobile, touch, capacitor... | Stopped |

**Agent routing:** Primero busca `@tag` al inicio del texto. Si no, usa keyword matching. Default: `kali`.

**agent.js (stub):** 152 líneas. Poll cada 30s, heartbeat cada 2min. Simula trabajo con `setTimeout(5s)`. No ejecuta nada real.

---

## 5. Infraestructura PM2

| Proceso | Puerto | Uptime | Restarts | Memoria |
|---------|--------|--------|----------|---------|
| alcon-api | 3002 | 6D | 0 | 73.5MB |
| alcon-pwa | 5176 | 41h | 3 | 59MB |
| **alcon-server** | **3003** | **41h** | **799** | **76.3MB** |
| dose-dash-front | 7003 | 7D | 1 | 56.4MB |

**Nota:** `ecosystem.config.cjs` define puerto 3002, pero PM2 corre alcon-server en 3003 (override manual o PM2 environment).

---

## 6. Riesgos Identificados

### Críticos

| # | Riesgo | Línea | Impacto |
|---|--------|-------|---------|
| 1 | **Sin autenticación** | Global | Cualquiera puede crear/reclamar/completar tareas |
| 2 | **CORS wide open** | 59 | `origin: true` permite cualquier origen |
| 3 | **Sin rate limiting** | Global | Vulnerable a DDoS o abuso |
| 4 | **799 restarts en PM2** | PM2 | Indica crashes previos (bug presence ya fixeado) |
| 5 | **Puerto inconsistente** | 486/PM2 | ecosystem.config.cjs dice 3002, PM2 corre en 3003 |

### Moderados

| # | Riesgo | Línea | Impacto |
|---|--------|-------|---------|
| 6 | **ID generation con colisión** | 104-106 | `Date.now() * 1000 + random` puede colisionar |
| 7 | **Sin validación de inputs** | 134-162 | Solo verifica `text` no vacío, no sanitiza |
| 8 | **Chat limitado a 50 msgs** | 14 | Pierde historial antiguo |
| 9 | **Lock timeout hardcodeado** | 12 | 10 minutos no configurable por env |
| 10 | **agent.js es stub** | agents/ | No ejecuta tareas reales |

### Bajos

| # | Riesgo | Línea | Impacto |
|---|--------|-------|---------|
| 11 | **Sin HTTPS** | PM2 | Tráfico en claro (Tailscale mitiga parcialmente) |
| 12 | **writeData no atómico** | 77-87 | Usa .tmp + rename (bueno) pero sin lock de archivo |
| 13 | **Presencia in-memory** | 482 | Se pierde al reiniciar el server |
| 14 | **AGENTS hardcodeado** | 24 | No se puede agregar agente sin modificar código |

---

## 7. Recomendaciones para Pipeline Stages (Feature 1.2)

### Estado actual vs requerido

| Actual | Requerido |
|--------|-----------|
| 4 estados: pendiente, en_proceso, hecho, error | 5+ etapas: backlog → plan → implement → test → done |
| Sin dependencias | DAG con auto-unblock |
| Sin subtasks | Parent/child con progreso |
| Sin artifacts | Archivos adjuntos por etapa |

### Migración sugerida

1. **SQLite WAL** (Feature 1.1) — Reemplazar tasks.json + messages.json
2. **Agregar campo `stage`** a task schema: `backlog | plan | implement | test | review | done`
3. **Agregar campo `dependencies`**: array de task IDs
4. **Agregar tabla `subtasks`**: parent_id, progress percentage
5. **Agregar tabla `artifacts`**: task_id, stage, file_path, version

### Orden de implementación

```
1.1 SQLite → 1.2 Pipeline → 1.3 Dependencies → 2.1 Subtasks
→ 2.2 Comments → 2.3 Artifacts → 3.1 Search → 4.1 Engram
```

---

## 8. Code Paths Importantes

### Crear tarea
```
POST /api/task → parseAgentFromText → readData → generateId → push → writeData
```

### Reclamar tarea (claim)
```
POST /api/task/:id/claim → readData → findIndex → check lock
  → si locked por otro: 409
  → si mismo owner: extiende lock
  → si libre: status=en_proceso, lock_owner=owner
```

### Stale lock reclaim
```
setInterval(30s) → readData → check isExpired → status=pendiente + system message
```

### Chat en tiempo real
```
socket.chat:message → readChat → push → writeChat → chatNs.emit
```

---

## 9. Conclusiones

**Alcón es funcional pero frágil.** Tiene la arquitectura correcta (distributed locking, real-time chat, agent routing) pero le faltan capas de seguridad y persistencia robusta.

**Lo que funciona bien:**
- Distributed locking con TTL + heartbeat
- Chat en tiempo real con presencia
- Agent routing por @tag o keywords
- Stale lock reclaim automático
- Write atómico (.tmp + rename)

**Lo que necesita urgencia:**
- Autenticación básica
- Rate limiting
- Migración a SQLite (para pipeline stages)
- Unificación de puertos (3002 vs 3003)
- agent.js real (no stub)

---

> **Siguiente paso:** Feature 1.1 — Migrar de tasks.json a SQLite WAL.
