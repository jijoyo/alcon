import { get as getDb } from '../db/connection.js';
import crypto from 'crypto';

const STAGES = ['backlog', 'plan', 'implement', 'test', 'review', 'done'];

function now() { return new Date().toISOString(); }

export function createJob({ text, source = 'api', assigned_to = null, squad = null, priority = 0 }) {
  const db = getDb();
  const created = now();
  const id = db.prepare(
    `INSERT INTO tasks (text, original_text, status, assigned_to, created, stage, stage_updated_at, squad)
     VALUES (?, ?, 'pendiente', ?, ?, 'backlog', ?, ?)`
  ).run(text, text, assigned_to, created, created, squad).lastInsertRowid;

  db.prepare(
    `INSERT INTO messages (id, task_id, from_agent, text, timestamp)
     VALUES (?, ?, 'system', ?, ?)`
  ).run(crypto.randomUUID(), id, `[jobs] Creada desde ${source}`, created);

  return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
}

export function claimJob(jobId, agent) {
  const db = getDb();
  const job = db.prepare('SELECT * FROM tasks WHERE id = ?').get(jobId);
  if (!job) return null;
  if (job.status === 'en_proceso' && job.lock_owner && job.lock_owner !== agent) {
    return { locked: true, owner: job.lock_owner };
  }
  const ts = now();
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  db.prepare(
    `UPDATE tasks SET status = 'en_proceso', stage = 'implement', stage_updated_at = ?,
     lock_owner = ?, lock_acquired_at = ?, lock_expires_at = ?, assigned_to = COALESCE(?, assigned_to)
     WHERE id = ?`
  ).run(ts, agent, ts, expires, agent, jobId);

  db.prepare(
    `INSERT INTO job_runs (job_id, agent, started, status) VALUES (?, ?, ?, 'running')`
  ).run(jobId, agent, ts);

  return db.prepare('SELECT * FROM tasks WHERE id = ?').get(jobId);
}

export function completeJob(jobId, agent, output = null) {
  const db = getDb();
  const ts = now();
  db.prepare(
    `UPDATE tasks SET status = 'hecho', stage = 'done', stage_updated_at = ?,
     result = ?, lock_owner = NULL, lock_acquired_at = NULL, lock_expires_at = NULL,
     completed_at = ? WHERE id = ?`
  ).run(ts, output, ts, jobId);

  db.prepare(
    `UPDATE job_runs SET status = 'done', finished = ?, output = ? WHERE job_id = ? AND agent = ? AND status = 'running'`
  ).run(ts, output, jobId, agent);

  return db.prepare('SELECT * FROM tasks WHERE id = ?').get(jobId);
}

export function failJob(jobId, agent, error) {
  const db = getDb();
  const ts = now();
  db.prepare(
    `UPDATE tasks SET status = 'error', result = ?, lock_owner = NULL, lock_acquired_at = NULL,
     lock_expires_at = NULL, error_at = ? WHERE id = ?`
  ).run(error, ts, jobId);

  db.prepare(
    `UPDATE job_runs SET status = 'error', finished = ?, error = ? WHERE job_id = ? AND agent = ? AND status = 'running'`
  ).run(ts, error, jobId, agent);

  return db.prepare('SELECT * FROM tasks WHERE id = ?').get(jobId);
}

export function getPendingJobs() {
  const db = getDb();
  return db.prepare("SELECT * FROM tasks WHERE status = 'pendiente' ORDER BY created ASC").all();
}

export function getActiveJobs() {
  const db = getDb();
  return db.prepare("SELECT * FROM tasks WHERE status = 'en_proceso' ORDER BY created ASC").all();
}

export function getJobRuns(jobId) {
  const db = getDb();
  return db.prepare('SELECT * FROM job_runs WHERE job_id = ? ORDER BY started ASC').all(jobId);
}

export function reapStaleJobs() {
  const db = getDb();
  const ts = now();
  const stale = db.prepare(
    "SELECT * FROM tasks WHERE status = 'en_proceso' AND lock_expires_at IS NOT NULL AND lock_expires_at < ?"
  ).all(ts);
  for (const job of stale) {
    db.prepare(
      `UPDATE tasks SET status = 'pendiente', lock_owner = NULL, lock_acquired_at = NULL,
       lock_expires_at = NULL, last_heartbeat = NULL WHERE id = ?`
    ).run(job.id);
    db.prepare(
      `UPDATE job_runs SET status = 'error', error = 'stale reap', finished = ? WHERE job_id = ? AND status = 'running'`
    ).run(ts, job.id);
  }
  return stale.length;
}
