-- Alcon Database Schema (SQLite WAL)
-- Migration from tasks.json + messages.json to SQLite

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY,
  text TEXT NOT NULL,
  original_text TEXT,
  status TEXT NOT NULL DEFAULT 'pendiente' CHECK(status IN ('pendiente','en_proceso','hecho','error','bloqueada')),
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
  artifacts TEXT DEFAULT '[]',
  blocked_by TEXT DEFAULT '[]',
  squad TEXT
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  from_agent TEXT NOT NULL,
  text TEXT NOT NULL,
  timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_messages_task_id ON messages(task_id);

CREATE TABLE IF NOT EXISTS chat (
  id TEXT PRIMARY KEY,
  from_agent TEXT NOT NULL,
  text TEXT NOT NULL,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  task_id INTEGER
);

CREATE TABLE IF NOT EXISTS agents (
  name TEXT PRIMARY KEY,
  running INTEGER NOT NULL DEFAULT 0,
  last_seen TEXT
);

INSERT OR IGNORE INTO agents (name, running) VALUES ('kali', 1), ('vps', 1), ('cel', 0);

CREATE TABLE IF NOT EXISTS stage_log (
  id TEXT PRIMARY KEY,
  task_id INTEGER,
  from_stage TEXT,
  to_stage TEXT,
  by_agent TEXT,
  timestamp TEXT
);

CREATE TABLE IF NOT EXISTS job_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  agent TEXT NOT NULL,
  started TEXT NOT NULL DEFAULT (datetime('now')),
  finished TEXT,
  status TEXT DEFAULT 'running' CHECK(status IN ('running','done','error')),
  output TEXT,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_job_runs_job_id ON job_runs(job_id);
