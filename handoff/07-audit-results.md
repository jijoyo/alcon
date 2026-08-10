# Auditoría: Alcón Server

> Fecha: 2026-08-09
> Auditor: Mimo (opencode)
> Archivo: `/home/ubuntu/alcon/server/server.js` (491 líneas)
> Estado: COMPLETADA

---

## 1. Resumen de Arquitectura

Alcón server es un **monolito Fastify + Socket.io** en Node.js (ESM). Gestiona tareas para 4 agentes (kali, vps, cel, debian) con distributed locking, chat en tiempo real, presencia, y pipeline de 6 etapas.

| Componente | Detalle |
|-----------|---------|
| Runtime | Node.js (ESM) |
| HTTP Framework | Fastify 5.3.3 |
| Realtime | Socket.io 4.8.3 |
| CORS | @fastify/cors 11.0.1 |
| Persistencia | **SQLite WAL** (better-sqlite3) |
| Process Manager | PM2 (fork mode) |
| Puerto | :3003 (VPS) |

---

## 2. Endpoints (22 API + 1 health)

### Health & Status

| Método | Ruta | Función | Línea |
|--------|------|---------|-------|
| GET | `/health` | Health check, uptime, task count, agents | 76 |
| GET | `/api/status` | Status completo por agente | 345 |
| POST | `/api/ping` | Heartbeat de agente | 356 |

### Tasks CRUD

| Método | Ruta | Función | Línea |
|--------|------|---------|-------|
| POST | `/api/task` | Crear tarea (parsea @tag o keywords) | 82 |
| GET | `/api/tasks` | Listar tareas (filtro por agent, status, stage) | 101 |
| GET | `/api/task/:id` | Detalle de tarea | 117 |

### Distributed Locking

| Método | Ruta | Función | Línea |
|--------|------|---------|-------|
| POST | `/api/task/:id/claim` | Reclamar tarea (lock con TTL 10min) | 125 |
| POST | `/api/task/:id/heartbeat` | Extender lock + auto-advance stage | 149 |
| POST | `/api/task/:id/complete` | Completar tarea (libera lock, auto-desbloquea dependencias) | 191 |
| POST | `/api/task/:id/error` | Marcar error (libera lock) | 235 |

### Messages (por tarea)

| Método | Ruta | Función | Línea |
|--------|------|---------|-------|
| POST | `/api/task/:id/message` | Enviar mensaje | 169 |
| GET | `/api/task/:id/messages` | Obtener mensajes | 182 |

### Pipeline Stages

| Método | Ruta | Función | Línea |
|--------|------|---------|-------|
| POST | `/api/task/:id/advance` | Avanzar stage (backlog→plan→implement→test→review→done) | 272 |
| POST | `/api/task/:id/regress` | Retroceder stage | 287 |
| GET | `/api/tasks/by-stage` | Agrupar tareas por stage | 302 |
| GET | `/api/task/:id/stage-log` | Historial de cambios de stage | 311 |

### Dependencies

| Método | Ruta | Función | Línea |
|--------|------|---------|-------|
| POST | `/api/task/:id/unblock` | Verificar y desbloquear tarea | 252 |

### Artifacts

| Método | Ruta | Función | Línea |
|--------|------|---------|-------|
| POST | `/api/task/:id/artifact` | Subir archivo adjunto | 318 |
| GET | `/api/artifacts/:filename` | Descargar artifact | 335 |

### Agent Control

| Método | Ruta | Función | Línea |
|--------|------|---------|-------|
| GET | `/api/agents` | Listar agentes + estado | 357 |
| GET | `/api/agents/status` | Listar agentes (duplicado) | 358 |
| POST | `/api/agent/:name/start` | Iniciar agente | 360 |
| POST | `/api/agent/:name/stop` | Detener agente | 370 |

### Socket.io (namespace `/enjambre`)

| Evento | Dirección | Función |
|--------|-----------|---------|
| `chat:join` | in | Identificar agente, enviar historial |
| `chat:message` | in/out | Enviar mensaje de chat (+ auto-crear tarea si no hay sesión activa) |
| `typing:start/stop` | in | Indicador de escritura |
| `chat:heartbeat` | in | Keepalive de presencia |
| `presence:request` | in | Solicitar presencia actual |
| `disconnect` | in | Marcar como muerto |
| `chat:history` | out | Historial de chat |
| `presence:update` | out | Actualización de presencia |
| `agent:direct` | out | Mensaje directo a agente |
| `task:updated` | out | Notificación de cambio de tarea |
| `task:unblocked` | out | Notificación de tarea desbloqueada |

---

## 3. Modelo de Datos (SQLite WAL)

### Schema: `server/db/schema.sql`

```sql
CREATE TABLE tasks (
  id INTEGER PRIMARY KEY,
  text TEXT NOT NULL,
  original_text TEXT,
  status TEXT NOT NULL DEFAULT 'pendiente'
    CHECK(status IN ('pendiente','en_proceso','hecho','error','bloqueada')),
  assigned_to TEXT,
  lock_owner TEXT,
  lock_acquired_at TEXT,
  lock_expires_at TEXT,
  last_heartbeat TEXT,
  heartbeat_count INTEGER DEFAULT 0,
  result TEXT,
  created TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  error_at TEXT,
  stage TEXT DEFAULT 'backlog',
  stage_updated_at TEXT,
  artifacts TEXT DEFAULT '[]',      -- JSON array de filenames
  blocked_by TEXT DEFAULT '[]'     -- JSON array de task IDs
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  from_agent TEXT NOT NULL,
  text TEXT NOT NULL,
  timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE chat (
  id TEXT PRIMARY KEY,
  from_agent TEXT NOT NULL,
  text TEXT NOT NULL,
  timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE agents (
  name TEXT PRIMARY KEY,
  running INTEGER NOT NULL DEFAULT 0,
  last_seen TEXT
);

CREATE TABLE stage_log (
  id TEXT PRIMARY KEY,
  task_id INTEGER,
  from_stage TEXT,
  to_stage TEXT,
  by_agent TEXT,
  timestamp TEXT
);
```

### Estados de tarea

| Estado | Significado |
|--------|------------|
| `pendiente` | Creada, esperando agente |
| `en_proceso` | Reclamada con lock activo |
| `hecho` | Completada exitosamente |
| `error` | Falló |
| `bloqueada` | Esperando dependencias |

### Pipeline Stages

```
backlog → plan → implement → test → review → done
```

---

## 4. Agentes

| Agente | Palabras clave | Config actual |
|--------|---------------|---------------|
| kali | code, bug, fix, test, review, git... | running: true |
| vps | build, deploy, server, docker, pm2... | running: true |
| cel | screen, mobile, touch, capacitor... | running: false |
| debian | forja, debian, linux, reina, distro... | running: true |

**Agent routing:** Primero busca `@tag` al inicio del texto. Si no, usa keyword matching. Default: `kali`.

---

## 5. Issues Encontrados

### Críticos

| # | Issue | Línea | Impacto |
|---|-------|-------|---------|
| 1 | **ALTER TABLE statements al startup** | 41-46 | Innecesarios, el schema ya tiene las columnas. Se ejecutan 6 veces cada startup. |
| 2 | **Schema duplicado** | `server/schema.sql` vs `server/db/schema.sql` | El primero tiene CHECK sin 'bloqueada', falta stage_log. Confuso. |
| 3 | **Sin autenticación** | Global | Cualquiera puede crear/reclamar/completar tareas |
| 4 | **Sin rate limiting** | Global | Vulnerable a abuso |

### Moderados

| # | Issue | Línea | Impacto |
|---|-------|-------|---------|
| 5 | **IDs por `Date.now()*1000 + random`** | 60 | Puede colisionar bajo carga |
| 6 | **Socket.io CORS `origin:'*'`** | 413 | Muy permisivo |
| 7 | **JSON strings en SQLite** | schema | `artifacts` y `blocked_by` como JSON en vez de tablas normalizadas |
| 8 | **`tasks.json` y `messages.json` legacy** | - | Existen pero no se usan (confusión) |
| 9 | **Duplicado `/api/agents` y `/api/agents/status`** | 357-358 | Mismo endpoint, dos rutas |

### Menores

| # | Issue | Línea | Impacto |
|---|-------|-------|---------|
| 10 | **`requireNumber` no usado** | validate.js:8 | Dead code |
| 11 | **Agentes hardcoded** | 34 | No configurables sin modificar código |
| 12 | **Presencia in-memory** | 391 | Se pierde al reiniciar server |
| 13 | **`debian` no incluido en chat `@all`** | 446 | Solo envía a vps, cel, kali |

---

## 6. Riesgos y Recomendaciones

### Para Feature 1.1 (SQLite Optimization)

El SQLite ya está implementado. Los próximos pasos son:

1. **Eliminar ALTER TABLEs innecesarios** (líneas 41-46)
2. **Eliminar `server/schema.sql` duplicado**
3. **Eliminar `tasks.json` y `messages.json` legacy**
4. **Normalizar `artifacts` y `blocked_by`** en tablas separadas (opcional, baja prioridad)
5. **Agregar índices** para queries frecuentes (status, stage, assigned_to)

### Para Feature 1.2+ (Pipeline avanzado)

- La estructura de stages ya existe (6 etapas)
- Falta: subtasks, comments, search
- `stage_log` ya está implementado para auditoría de cambios

---

## 7. Code Paths Importantes

### Crear tarea
```
POST /api/task → parseAgentFromText → generateId → INSERT → emit agent:direct
```

### Reclamar tarea (claim)
```
POST /api/task/:id/claim → check lock
  → si locked por otro: 409
  → si mismo owner: extiende lock
  → si libre: status=en_proceso, stage=implement
```

### Heartbeat con auto-advance
```
POST /api/task/:id/heartbeat → extiende lock
  → si heartbeat_count >= 2 y stage=implement: auto-advance a test
```

### Completar con auto-unblock
```
POST /api/task/:id/complete → status=hecho, stage=review
  → setTimeout(5s) → stage=done
  → busca tareas bloqueadas → auto-desbloquea si dependencias cumplidas
```

### Stale lock reclaim
```
setInterval(30s) → busca locks expirados → status=pendiente + system message
```

---

## 8. Conclusiones

**Alcón server v3.0.0-enjambre está funcional y migrado a SQLite.** Tiene la arquitectura correcta para el ecosistema multi-agente.

**Lo que funciona bien:**
- SQLite WAL con foreign keys
- Distributed locking con TTL + heartbeat
- Pipeline de 6 etapas con stage_log
- Auto-unblock de dependencias
- Chat en tiempo real con presencia
- Agent routing por @tag o keywords
- Stale lock reclaim automático
- Artifacts storage

**Pendiente para producción:**
- Autenticación básica
- Rate limiting
- Limpiar schema duplicado y ALTER TABLEs
- IDs más robustos (UUID o ULID)
- CORS más restrictivo

---

> **Siguiente paso:** Feature 1.1 — SQLite optimization (limpiar ALTER TABLEs, eliminar duplicados)
