# PATCH para tasks.js (387L original) — NO REEMPLAZAR, MERGEAR

> Archivo original: `server/routes/tasks.js` (387 líneas con claim, heartbeat, artifact, stage-log)
> NO usar `tasks.v3.js` (70L) ni `tasks.FIXED.js` (120L) — son stubs sin funcionalidad real

## Paso 1: Agregar imports al inicio (después de L1-L6)

```javascript
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let GRANJA = { squads: {}, devices: {} };
try {
  GRANJA = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'lib', 'granja.json'), 'utf8'));
} catch(e) {
  console.warn(`[tasks] no granja.json: ${e.message}`);
}
const GRANJA_SQUADS = Object.keys(GRANJA.squads || {});
```

## Paso 2: En POST /api/task, ANTES del INSERT (alrededor L45)

Buscar la línea donde haces:
```javascript
const id = db.prepare("INSERT INTO tasks ...")
```

ANTES de esa línea, agregar:
```javascript
const squadMatch = text.match(/^@(\S+)\s+(.*)/s);
if (squadMatch && GRANJA_SQUADS.includes(squadMatch[1])) {
  const squad = squadMatch[1];
  const prompt = squadMatch[2];
  const existing = db.prepare("SELECT id FROM tasks WHERE squad=? AND status='en_proceso' ORDER BY id DESC LIMIT 1").get(squad);
  let taskId;
  if (existing) {
    taskId = existing.id;
    db.prepare("UPDATE tasks SET text=text || char(10) || '→ ' || ?, updated_at=datetime('now') WHERE id=?").run(prompt, taskId);
  } else {
    taskId = db.prepare("INSERT INTO tasks (text, original_text, squad, status, assigned_to, created) VALUES (?, ?, ?, 'en_proceso', 'orchestrator', datetime('now'))").run(`@${squad} ${prompt}`, trimmed, squad).lastInsertRowid;
  }
  setImmediate(async () => {
    try {
      const { handleSquadMessage, squadSessions } = await import('../lib/orchestrator.js');
      if(squadSessions.has(squad)) squadSessions.get(squad).taskId = taskId;
      const response = await handleSquadMessage(squad, prompt, from || 'api');
      const doneTs = new Date().toISOString();
      db.prepare("UPDATE tasks SET status='hecho', result=?, completed_at=datetime('now'), stage='done', stage_updated_at=? WHERE id=?").run(response, doneTs, taskId);
      if (globalThis._io) {
        globalThis._io.of('/enjambre').emit('task:updated', { id: taskId, status: 'hecho', stage: 'done' });
        globalThis._io.of('/enjambre').emit('chat:message', { id: crypto.randomUUID(), from: squad, text: response.slice(0,2000), timestamp: doneTs });
      }
    } catch (e) {
      db.prepare("UPDATE tasks SET status='error', result=?, error_at=datetime('now') WHERE id=?").run(e.message, taskId);
    }
  });
  return { orchestrator: true, squad, status: 'en_proceso', id: taskId, followUp: !!existing };
}
// si no es squad, continúa con lógica original de INSERT INTO tasks...
```

## Verificación

- `tasks.js` debe seguir teniendo ~400 líneas después del patch
- NO debe usar `express.Router()`, debe usar `fastify.post` / `fastify.get`
- Debe mantener `getDb()` y SQLite queries
- Debe mantener claim, heartbeat, artifact, stage-log, advance, regress
