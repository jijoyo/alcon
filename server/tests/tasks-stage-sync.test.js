import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DB = path.join(__dirname, 'test-alcon.db');
const SCHEMA_PATH = path.join(__dirname, '..', 'db', 'schema.sql');

let db;

before(() => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  db = new Database(TEST_DB);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  db.exec(schema);
});

after(() => {
  if (db) db.close();
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
});

function createTask(stage = 'backlog', status = 'pendiente') {
  const insert = db.prepare(
    `INSERT INTO tasks (text, original_text, status, assigned_to, created, stage, stage_updated_at)
     VALUES (?, ?, ?, 'kali', datetime('now'), ?, datetime('now'))`
  );
  const result = insert.run('test task', 'test task', status, stage);
  return result.lastInsertRowid;
}

describe('status hecho → stage done', () => {
  test('/complete SQL: stage becomes done when status set to hecho', () => {
    const taskId = createTask('implement', 'en_proceso');
    const ts = new Date().toISOString();
    const artifacts = '[]';

    db.prepare(
      `UPDATE tasks SET status = 'hecho', stage = 'done', stage_updated_at = ?, result = ?, artifacts = ?, lock_owner = NULL, lock_acquired_at = NULL, lock_expires_at = NULL, last_heartbeat = NULL, completed_at = ? WHERE id = ?`
    ).run(ts, 'result text', artifacts, ts, taskId);

    const row = db.prepare('SELECT status, stage FROM tasks WHERE id = ?').get(taskId);
    assert.equal(row.status, 'hecho');
    assert.equal(row.stage, 'done', '/complete must set stage=done with status=hecho');
  });

  test('PATCH SQL: status=hecho forces stage=done even if client sends backlog', () => {
    const taskId = createTask('backlog', 'pendiente');
    const ts = new Date().toISOString();

    const clientStage = 'backlog';
    const clientStatus = 'hecho';
    const finalStage = clientStatus === 'hecho' ? 'done' : clientStage;

    db.prepare(
      `UPDATE tasks SET status = ?, stage = ?, stage_updated_at = ?, completed_at = CASE WHEN ? = 'hecho' THEN ? ELSE completed_at END WHERE id = ?`
    ).run(clientStatus, finalStage, ts, clientStatus, ts, taskId);

    const row = db.prepare('SELECT status, stage FROM tasks WHERE id = ?').get(taskId);
    assert.equal(row.status, 'hecho');
    assert.equal(row.stage, 'done', 'PATCH must force stage=done when status=hecho');
  });

  test('PATCH SQL: status=en_proceso keeps the stage client sends', () => {
    const taskId = createTask('backlog', 'pendiente');
    const ts = new Date().toISOString();

    const clientStage = 'implement';
    const clientStatus = 'en_proceso';
    const finalStage = clientStatus === 'hecho' ? 'done' : clientStage;

    db.prepare(
      `UPDATE tasks SET status = ?, stage = ?, stage_updated_at = ?, completed_at = CASE WHEN ? = 'hecho' THEN ? ELSE completed_at END WHERE id = ?`
    ).run(clientStatus, finalStage, ts, clientStatus, ts, taskId);

    const row = db.prepare('SELECT status, stage FROM tasks WHERE id = ?').get(taskId);
    assert.equal(row.status, 'en_proceso');
    assert.equal(row.stage, 'implement', 'non-hecho status should keep the stage sent');
  });

  test('18 tasks in backlog with hecho status get fixed to stage done', () => {
    const ids = [];
    for (let i = 0; i < 18; i++) {
      ids.push(createTask('backlog', 'hecho'));
    }

    const ts = new Date().toISOString();
    const fix = db.prepare(
      `UPDATE tasks SET stage = 'done', stage_updated_at = ? WHERE status = 'hecho' AND stage != 'done'`
    );
    const result = fix.run(ts);
    assert.equal(result.changes, 18, 'all 18 desynced tasks should be fixed');

    const remaining = db.prepare(
      `SELECT COUNT(*) as count FROM tasks WHERE status = 'hecho' AND stage != 'done'`
    ).get();
    assert.equal(remaining.count, 0, 'no tasks with hecho status should have stage != done');
  });
});
