# Contrato: Feature 1.1 — Migración a SQLite WAL

> Creado: 2026-07-27
> Autor: Debian (Reina/forja)
> Estado: PROPUESTO (pendiente aprobación)

---

## 1. Contexto

Alcón server actualmente guarda datos en archivos JSON (`tasks.json` y `messages.json`). Esto tiene limitaciones:
- Sin concurrencia segura (read/write no atómico más allá de rename)
- Sin índices para búsqueda
- Sin soporte para pipeline stages (Feature 1.2)
- Sin full-text search (Feature 3.1)

La decisión de migrar a SQLite WAL ya fue tomada (handoff/04-decision-record.md) después de investigar 8 alternativas (handoff/01-research-comparison.md).

---

## 2. Scope

### INCLUYE

| Item | Descripción |
|------|-------------|
| Schema SQLite | Tablas: tasks, messages, agents, presence |
| Migración de datos | Script para importar tasks.json → SQLite |
| Endpoints HTTP | Actualizar todos los endpoints para usar SQLite |
| Socket.io | Actualizar chat para persistir en SQLite |
| WAL mode | Configurar SQLite en WAL para concurrencia |
| Tests | Verificar que todos los endpoints funcionan |

### NO INCLUYE

| Item | Razón |
|------|-------|
| Pipeline stages (1.2) | Siguiente feature, no este contrato |
| Task dependencies (1.3) | Siguiente feature |
| Full-text search (3.1) | Depende de SQLite, pero es feature separada |
| Autenticación | Feature separada, urgente pero no parte de este contrato |
| Rate limiting | Feature separada |

---

## 3. Schema Propuesto

```sql
-- Tasks
CREATE TABLE tasks (
  id INTEGER PRIMARY KEY,
  text TEXT NOT NULL,
  original_text TEXT,
  status TEXT DEFAULT 'pendiente' CHECK(status IN ('pendiente','en_proceso','hecho','error')),
  assigned_to TEXT,
  lock_owner TEXT,
  lock_acquired_at TEXT,
  lock_expires_at TEXT,
  last_heartbeat TEXT,
  result TEXT,
  created TEXT DEFAULT (datetime('now')),
  completed_at TEXT,
  error_at TEXT
);

-- Messages (por tarea)
CREATE TABLE messages (
  id TEXT PRIMARY KEY,  -- UUID
  task_id INTEGER REFERENCES tasks(id),
  from_agent TEXT NOT NULL,
  text TEXT NOT NULL,
  timestamp TEXT DEFAULT (datetime('now'))
);

-- Chat global
CREATE TABLE chat (
  id TEXT PRIMARY KEY,  -- UUID
  from_agent TEXT NOT NULL,
  text TEXT NOT NULL,
  timestamp TEXT DEFAULT (datetime('now'))
);

-- Agents
CREATE TABLE agents (
  name TEXT PRIMARY KEY,
  running INTEGER DEFAULT 0,
  last_seen TEXT
);

-- Presence (in-memory, no persistir)
-- Se mantiene como Map() en server.js
```

---

## 4. Criterios de Aceptación

| # | Criterio | Verificación |
|---|----------|-------------|
| 1 | Todos los endpoints HTTP funcionan | `curl` test para cada endpoint |
| 2 | Chat en tiempo real persiste | Enviar mensaje, reiniciar server, verificar que aparece |
| 3 | Distributed locking funciona | Claim + heartbeat + stale reclaim |
| 4 | WAL mode activo | `PRAGMA journal_mode=WAL` retorna "wal" |
| 5 | Migración de datos funciona | Script importa tasks.json sin perder datos |
| 6 | Sin regressions | PWA sigue funcionando en :5176 |
| 7 | PM2 no tiene restarts nuevos | Monitorear después del deploy |

---

## 5. Dependencias

| Dependencia | Estado |
|-------------|--------|
| Audit de server.js | ✅ Completado (handoff/07-audit-results.md) |
| Investigación de alternativas | ✅ Completada (handoff/01-research-comparison.md) |
| Decisión de migrar a SQLite | ✅ Tomada (handoff/04-decision-record.md) |
| Node.js sqlite3 o better-sqlite3 | ⏳ Instalar en VPS |

---

## 6. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Pérdida de datos en migración | Baja | Alto | Backup antes de migrar, script de rollback |
| Regressions en endpoints | Media | Medio | Tests manuales antes de deploy |
| PM2 restarts | Media | Bajo | Monitorear post-deploy |
| PWA no funciona | Baja | Alto | Verificar después de cada cambio |

---

## 7. Timeline Estimado

| Fase | Duración | Entregable |
|------|----------|------------|
| Instalar sqlite3 en VPS | 1h | Dependencia instalada |
| Crear schema + migración | 2h | Script de migración |
| Actualizar server.js | 4h | Endpoints funcionando con SQLite |
| Tests + fix | 2h | Todos los criterios pasan |
| Deploy + monitoreo | 1h | Server actualizado en PM2 |
| **Total** | **10h** | Feature 1.1 completada |

---

## 8. Aprobación

- [ ] **Debian (Reina)**: Crea el contrato
- [ ] **Usuario**: Aprueba el scope y timeline
- [ ] **Kali/Mimo**: Ejecutan la implementación (o Debian si está disponible)

---

> **Siguiente paso:** Esperar aprobación del usuario para proceder con la implementación.
