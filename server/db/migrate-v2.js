import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'alcon.db');

const db = new Database(dbPath);

console.log('Migrando a v2: agregando stage...');

// 1. Agregar columnas a tasks
try { db.exec(`ALTER TABLE tasks ADD COLUMN stage TEXT DEFAULT 'backlog' CHECK(stage IN ('backlog','plan','implement','test','review','done'))`); console.log('✅ columna stage agregada'); } catch(e) { console.log('stage ya existe, skip'); }

try { db.exec(`ALTER TABLE tasks ADD COLUMN stage_updated_at TEXT DEFAULT (datetime('now'))`); console.log('✅ columna stage_updated_at agregada'); } catch(e) { console.log('stage_updated_at ya existe, skip'); }

// 2. Crear tabla de historial
db.exec(`
CREATE TABLE IF NOT EXISTS stage_log (
  id TEXT PRIMARY KEY,
  task_id INTEGER REFERENCES tasks(id),
  from_stage TEXT,
  to_stage TEXT,
  by_agent TEXT,
  timestamp TEXT DEFAULT (datetime('now'))
);
`);
console.log('✅ tabla stage_log creada');

// 3. Poner todas las tareas existentes en backlog
const result = db.prepare(`UPDATE tasks SET stage='backlog' WHERE stage IS NULL`).run();
console.log(`✅ ${result.changes} tareas puestas en backlog`);

console.log('Migración v2 lista. WAL activo:', db.pragma('journal_mode', {simple: true}));
db.close();