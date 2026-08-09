import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import path from 'path';
import fs from 'fs';
import { pipeline } from 'stream/promises';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import { open as openDb, get as getDb } from './db/connection.js';
import { requireString, maxLength } from './middleware/validate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ARTIFACTS_DIR = process.env.ARTIFACTS_DIR || path.join(__dirname, 'artifacts');
fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
const LOCK_TIMEOUT_MS = 10 * 60 * 1000;
const STALE_CHECK_INTERVAL_MS = 30 * 1000;
const PRESENCE_TIMEOUT_MS = 15 * 1000;
const PRESENCE_CHECK_MS = 5 * 1000;

const STAGES = ['backlog', 'plan', 'implement', 'test', 'review', 'done'];
const STAGE_TRANSITIONS = { backlog:'plan', plan:'implement', implement:'test', test:'review', review:'done', done:null };
const REVERSE_TRANSITIONS = { plan:'backlog', implement:'plan', test:'implement', review:'test', done:'review', backlog:null };
function advanceStage(current) { return STAGE_TRANSITIONS[current] || null; }
function regressStage(current) { return REVERSE_TRANSITIONS[current] || null; }

const KEYWORD_MAP = {
  vps: ['build','deploy','server','docker','pm2','database','supabase','api','backend','migrate','nginx','ssl','domain','dns'],
  kali: ['code','bug','fix','test','review','git','commit','merge','refactor','lint','typecheck','spec','implement','feature'],
  cel: ['screen','mobile','touch','capacitor','android','ios','app','apk','install','push','notification','camera','gps'],
  debian: ['forja','debian','linux','reina','distro','apt','systemd','ssh']
};

const AGENTS = ['kali','vps','cel','debian'];
const agentRunning = { kali:true, vps:true, cel:false, debian:true };
const fastify = Fastify({ logger: true });

openDb();

const db = getDb();

await fastify.register(cors, { origin:true, credentials:true, methods:['GET','POST','PUT','DELETE','OPTIONS'], allowedHeaders:['Content-Type','Authorization'] });
await fastify.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });

function parseAgentFromText(text) {
  const tagMatch = text.match(/^@\s*(\w+)\s/);
  if (tagMatch && AGENTS.includes(tagMatch[1])) return { agent: tagMatch[1], cleanText: text.slice(tagMatch[0].length) };
  const lower = text.toLowerCase();
  for (const [agent, keywords] of Object.entries(KEYWORD_MAP)) {
    if (keywords.some(kw => lower.includes(kw))) return { agent, cleanText: text };
  }
  return { agent: 'kali', cleanText: text };
}
function generateId() { return Date.now() * 1000 + Math.floor(Math.random() * 1000); }
function now() { return new Date().toISOString(); }
function isExpired(task) { return task.lock_expires_at ? new Date(task.lock_expires_at) < new Date() : false; }
function formatTask(row) {
  if (!row) return null;
  const db = getDb();
  const messages = db.prepare('SELECT * FROM messages WHERE task_id = ? ORDER BY timestamp ASC').all(row.id);
  return { ...row, messages };
}
function safeFilename(name) { return path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_'); }
function parseDependencies(text) {
  const matches = text.match(/#(\d+)/g);
  if (!matches) return [];
  return [...new Set(matches.map(m => Number(m.slice(1))))];
}

fastify.get('/health', async () => {
  const db = getDb();
  const { count: taskCount } = db.prepare('SELECT COUNT(*) as count FROM tasks').get();
  return { status:'ok', version:'3.0.0-enjambre', timestamp:now(), uptime:process.uptime(), taskCount, agents:agentRunning };
});

fastify.post('/api/task', async (request, reply) => {
  const { text } = request.body || {};
  const err = requireString(text, 'text') || maxLength(text, 5000, 'text');
  if (err) return reply.code(400).send(err);
  const { agent, cleanText } = parseAgentFromText(text.trim());
  const db = getDb();
  const id = generateId();
  const created = now();
  const blockedBy = parseDependencies(text.trim());
  const initialStatus = blockedBy.length > 0 ? 'bloqueada' : 'pendiente';
  db.prepare(`INSERT INTO tasks (id, text, original_text, status, assigned_to, created, stage, stage_updated_at, blocked_by) VALUES (?, ?, ?, ?, ?, ?, 'backlog', ?, ?)`).run(id, cleanText, text.trim(), initialStatus, agent, created, created, JSON.stringify(blockedBy));
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  fastify.log.info(`Task ${task.id} created for agent: ${agent} [${initialStatus}]`);
  if (agent && globalThis._io) {
    globalThis._io.of('/enjambre').emit('agent:direct', { id:crypto.randomUUID(), from:'system', to:agent, text:cleanText, task_id:task.id, timestamp:now() });
  }
  return formatTask(task);
});

fastify.get('/api/tasks', async (request) => {
  const { agent, status, stage } = request.query;
  const db = getDb();
  let sql = 'SELECT * FROM tasks';
  const params = [];
  const conditions = [];
  if (agent) { conditions.push('assigned_to = ?'); params.push(agent); }
  if (status) { conditions.push('status = ?'); params.push(status); }
  if (stage) { conditions.push('stage = ?'); params.push(stage); }
  if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY created DESC';
  const tasks = db.prepare(sql).all(...params);
  const { count } = db.prepare('SELECT COUNT(*) as count FROM tasks').get();
  return { tasks: tasks.map(formatTask), count, version: count };
});

fastify.get('/api/task/:id', async (request, reply) => {
  const id = Number(request.params.id);
  const db = getDb();
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!task) return reply.code(404).send({ error:'Task not found' });
  return formatTask(task);
});

fastify.post('/api/task/:id/claim', async (request, reply) => {
  const id = Number(request.params.id);
  const { owner } = request.body || {};
  const err = requireString(owner, 'owner');
  if (err) return reply.code(400).send(err);
  const db = getDb();
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!task) return reply.code(404).send({ error:'Task not found' });
  if (task.status === 'en_proceso' && task.lock_owner && !isExpired(task)) {
    if (task.lock_owner !== owner) return reply.code(409).send({ error:'Task already claimed', claimed_by:task.lock_owner, lock_expires_at:task.lock_expires_at });
    const expiresAt = new Date(Date.now() + LOCK_TIMEOUT_MS).toISOString();
    const ts = now();
    db.prepare('UPDATE tasks SET lock_expires_at = ?, last_heartbeat = ? WHERE id = ?').run(expiresAt, ts, id);
    return formatTask(db.prepare('SELECT * FROM tasks WHERE id = ?').get(id));
  }
  const acquiredAt = now();
  const expiresAt = new Date(Date.now() + LOCK_TIMEOUT_MS).toISOString();
  db.prepare(`UPDATE tasks SET status = 'en_proceso', stage = 'implement', stage_updated_at = ?, heartbeat_count = 0, assigned_to = COALESCE(NULLIF(assigned_to, ''), ?), lock_owner = ?, lock_acquired_at = ?, lock_expires_at = ?, last_heartbeat = ? WHERE id = ?`).run(acquiredAt, owner, owner, acquiredAt, expiresAt, acquiredAt, id);
  const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  fastify.log.info(`Task ${id} claimed by ${owner}`);
  if (globalThis._io) globalThis._io.of('/enjambre').emit('task:updated', { id, stage:'implement' });
  return formatTask(updated);
});

fastify.post('/api/task/:id/heartbeat', async (request, reply) => {
  const id = Number(request.params.id);
  const { owner } = request.body || {};
  const err = requireString(owner, 'owner');
  if (err) return reply.code(400).send(err);
  const db = getDb();
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!task) return reply.code(404).send({ error:'Task not found' });
  if (task.lock_owner !== owner) return reply.code(403).send({ error:'Not the lock owner' });
  const expiresAt = new Date(Date.now() + LOCK_TIMEOUT_MS).toISOString();
  const ts = now();
  const newCount = (task.heartbeat_count || 0) + 1;
  let newStage = task.stage;
  let stageUpdated = task.stage_updated_at;
  if (newCount >= 2 && task.stage === 'implement') { newStage = 'test'; stageUpdated = ts; }
  db.prepare('UPDATE tasks SET last_heartbeat = ?, lock_expires_at = ?, heartbeat_count = ?, stage = ?, stage_updated_at = ? WHERE id = ?').run(ts, expiresAt, newCount, newStage, stageUpdated, id);
  if (newStage !== task.stage && globalThis._io) globalThis._io.of('/enjambre').emit('task:updated', { id, stage:newStage });
  return { ok:true, lock_expires_at:expiresAt };
});

fastify.post('/api/task/:id/message', async (request, reply) => {
  const id = Number(request.params.id);
  const { from, text } = request.body || {};
  const err = requireString(from, 'from') || requireString(text, 'text');
  if (err) return reply.code(400).send(err);
  const db = getDb();
  const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(id);
  if (!task) return reply.code(404).send({ error:'Task not found' });
  const message = { id:crypto.randomUUID(), from, text, timestamp:now() };
  db.prepare('INSERT INTO messages (id, task_id, from_agent, text, timestamp) VALUES (?, ?, ?, ?, ?)').run(message.id, id, from, text, message.timestamp);
  return message;
});

fastify.get('/api/task/:id/messages', async (request, reply) => {
  const id = Number(request.params.id);
  const db = getDb();
  const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(id);
  if (!task) return reply.code(404).send({ error:'Task not found' });
  const messages = db.prepare('SELECT * FROM messages WHERE task_id = ? ORDER BY timestamp ASC').all(id);
  return { messages, count:messages.length };
});

fastify.post('/api/task/:id/complete', async (request, reply) => {
  const id = Number(request.params.id);
  const { owner, result } = request.body || {};
  const err = requireString(owner, 'owner');
  if (err) return reply.code(400).send(err);
  const db = getDb();
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!task) return reply.code(404).send({ error:'Task not found' });
  if (task.lock_owner && task.lock_owner !== owner) return reply.code(403).send({ error:'Not the lock owner' });
  const ts = now();
  let artifacts = JSON.parse(task.artifacts || '[]');
  if (result && result.length > 500) {
    const filename = safeFilename(`task-${id}-${Date.now()}.txt`);
    fs.writeFileSync(path.join(ARTIFACTS_DIR, filename), result);
    artifacts.push(filename);
  }
  db.prepare(`UPDATE tasks SET status = 'hecho', result = ?, artifacts = ?, lock_owner = NULL, lock_acquired_at = NULL, lock_expires_at = NULL, last_heartbeat = NULL, completed_at = ? WHERE id = ?`).run(result || null, JSON.stringify(artifacts), ts, id);
  db.prepare('UPDATE tasks SET stage = ?, stage_updated_at = ? WHERE id = ?').run('review', ts, id);
  cleanupSessionByTaskId(id);
  if (globalThis._io) globalThis._io.of('/enjambre').emit('task:updated', { id, stage:'review' });
  setTimeout(() => {
    const db2 = getDb();
    const doneTs = new Date().toISOString();
    db2.prepare('UPDATE tasks SET stage = ?, stage_updated_at = ? WHERE id = ?').run('done', doneTs, id);
    if (globalThis._io) globalThis._io.of('/enjambre').emit('task:updated', { id, stage:'done' });
  }, 5000);
  const blocked = db.prepare("SELECT id, blocked_by FROM tasks WHERE status = 'bloqueada'").all();
  for (const t of blocked) {
    let deps = JSON.parse(t.blocked_by || '[]');
    deps = deps.filter(d => d !== id);
    if (deps.length === 0) {
      db.prepare("UPDATE tasks SET status = 'pendiente', blocked_by = '[]' WHERE id = ?").run(t.id);
      globalThis._io?.of('/enjambre')?.emit('task:unblocked', { id: t.id });
      globalThis._io?.of('/enjambre')?.emit('task:updated', { id: t.id, status: 'pendiente', blocked_by: '[]' });
      fastify.log.info(`Task ${t.id} auto-desbloqueada por completion de ${id}`);
    } else {
      db.prepare('UPDATE tasks SET blocked_by = ? WHERE id = ?').run(JSON.stringify(deps), t.id);
    }
  }
  const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  fastify.log.info(`Task ${id} completed by ${owner}`);
  return formatTask(updated);
});

fastify.post('/api/task/:id/error', async (request, reply) => {
  const id = Number(request.params.id);
  const { owner, error: errorMsg } = request.body || {};
  const err = requireString(owner, 'owner');
  if (err) return reply.code(400).send(err);
  const db = getDb();
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!task) return reply.code(404).send({ error:'Task not found' });
  if (task.lock_owner && task.lock_owner !== owner) return reply.code(403).send({ error:'Not the lock owner' });
  const ts = now();
  db.prepare(`UPDATE tasks SET status = 'error', result = ?, lock_owner = NULL, lock_acquired_at = NULL, lock_expires_at = NULL, last_heartbeat = NULL, error_at = ? WHERE id = ?`).run(errorMsg || 'Unknown error', ts, id);
  cleanupSessionByTaskId(id);
  const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  fastify.log.info(`Task ${id} errored by ${owner}`);
  return formatTask(updated);
});

fastify.post('/api/task/:id/unblock', async (request, reply) => {
  const id = Number(request.params.id);
  const db = getDb();
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!task) return reply.code(404).send({ error:'Task not found' });
  const blockedBy = JSON.parse(task.blocked_by || '[]');
  if (blockedBy.length === 0) return { ok:true, status:task.status };
  const allCompleted = blockedBy.every(depId => {
    const dep = db.prepare('SELECT status FROM tasks WHERE id = ?').get(depId);
    return dep && (dep.status === 'completada' || dep.status === 'hecho');
  });
  if (allCompleted) {
    db.prepare("UPDATE tasks SET status = 'pendiente', blocked_by = '[]' WHERE id = ?").run(id);
    globalThis._io?.of('/enjambre')?.emit('task:unblocked', { id });
    globalThis._io?.of('/enjambre')?.emit('task:updated', { id, status: 'pendiente', blocked_by: '[]' });
    return { ok:true, status:'pendiente' };
  }
  return { ok:false, status:'bloqueada' };
});

fastify.post('/api/task/:id/advance', async (request, reply) => {
  const id = Number(request.params.id);
  const { by_agent = 'unknown' } = request.body || {};
  const db = getDb();
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!task) return reply.code(404).send({ error:'Task not found' });
  const next = advanceStage(task.stage);
  if (!next) return reply.code(400).send({ error:`No se puede avanzar desde ${task.stage}` });
  const ts = now();
  db.prepare('UPDATE tasks SET stage = ?, stage_updated_at = ? WHERE id = ?').run(next, ts, id);
  try { db.prepare('INSERT INTO stage_log (id, task_id, from_stage, to_stage, by_agent, timestamp) VALUES (?, ?, ?, ?, ?, ?)').run(crypto.randomUUID(), id, task.stage, next, by_agent, ts); } catch(e) {}
  if (globalThis._io) globalThis._io.of('/enjambre').emit('task:updated', { id, stage:next });
  return formatTask(db.prepare('SELECT * FROM tasks WHERE id = ?').get(id));
});

fastify.post('/api/task/:id/regress', async (request, reply) => {
  const id = Number(request.params.id);
  const { by_agent = 'unknown' } = request.body || {};
  const db = getDb();
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!task) return reply.code(404).send({ error:'Task not found' });
  const prev = regressStage(task.stage);
  if (!prev) return reply.code(400).send({ error:`No se puede regresar desde ${task.stage}` });
  const ts = now();
  db.prepare('UPDATE tasks SET stage = ?, stage_updated_at = ? WHERE id = ?').run(prev, ts, id);
  try { db.prepare('INSERT INTO stage_log (id, task_id, from_stage, to_stage, by_agent, timestamp) VALUES (?, ?, ?, ?, ?, ?)').run(crypto.randomUUID(), id, task.stage, prev, by_agent, ts); } catch(e) {}
  if (globalThis._io) globalThis._io.of('/enjambre').emit('task:updated', { id, stage:prev });
  return formatTask(db.prepare('SELECT * FROM tasks WHERE id = ?').get(id));
});

fastify.get('/api/tasks/by-stage', async () => {
  const db = getDb();
  const tasks = db.prepare('SELECT * FROM tasks ORDER BY created DESC').all();
  const grouped = {};
  STAGES.forEach(s => grouped[s] = []);
  for (const t of tasks) { const s = t.stage || 'backlog'; if (!grouped[s]) grouped[s] = []; grouped[s].push(formatTask(t)); }
  return grouped;
});

fastify.get('/api/task/:id/stage-log', async (request, reply) => {
  const id = Number(request.params.id);
  const db = getDb();
  const logs = db.prepare('SELECT * FROM stage_log WHERE task_id = ? ORDER BY timestamp ASC').all(id);
  return { logs, count:logs.length };
});

fastify.post('/api/task/:id/artifact', async (request, reply) => {
  const id = Number(request.params.id);
  const db = getDb();
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!task) return reply.code(404).send({ error:'Task not found' });
  const data = await request.file();
  if (!data) return reply.code(400).send({ error:'No file provided' });
  const filename = safeFilename(`${id}-${Date.now()}-${data.filename}`);
  const filepath = path.join(ARTIFACTS_DIR, filename);
  await pipeline(data.file, fs.createWriteStream(filepath));
  let artifacts = JSON.parse(task.artifacts || '[]');
  artifacts.push(filename);
  db.prepare('UPDATE tasks SET artifacts = ? WHERE id = ?').run(JSON.stringify(artifacts), id);
  fastify.log.info(`Artifact ${filename} uploaded for task ${id}`);
  return { ok:true, filename };
});

fastify.get('/api/artifacts/:filename', async (request, reply) => {
  const filename = safeFilename(request.params.filename);
  const filepath = path.join(ARTIFACTS_DIR, filename);
  if (!fs.existsSync(filepath)) return reply.code(404).send({ error:'Artifact not found' });
  const content = fs.readFileSync(filepath);
  reply.header('Content-Type', 'text/plain');
  reply.header('Content-Disposition', `attachment; filename="${filename}"`);
  return reply.send(content);
});

fastify.get('/api/status', async () => {
  const db = getDb();
  const tasks = db.prepare('SELECT * FROM tasks').all();
  const agentStatus = {};
  for (const agent of AGENTS) {
    const agentTasks = tasks.filter(t => t.assigned_to === agent);
    agentStatus[agent] = { active:agentTasks.filter(t=>t.status==='en_proceso').length, pending:agentTasks.filter(t=>t.status==='pendiente').length, done:agentTasks.filter(t=>t.status==='hecho').length, error:agentTasks.filter(t=>t.status==='error').length, total:agentTasks.length, running:agentRunning[agent], active_tasks:agentTasks.filter(t=>t.status==='en_proceso').map(t=>({id:t.id,text:t.text,lock_owner:t.lock_owner,lock_expires_at:t.lock_expires_at,last_heartbeat:t.last_heartbeat,is_stale:isExpired(t)})) };
  }
  return { total_tasks:tasks.length, version:tasks.length, agents:agentStatus, timestamp:now() };
});

fastify.post('/api/ping', async (request) => { const { agent } = request.body || {}; return { ok:true, agent, timestamp:now() }; });
fastify.get('/api/agents', async () => ({ agents:AGENTS.map(name=>({name,running:agentRunning[name]})) }));
fastify.get('/api/agents/status', async () => ({ agents:AGENTS.map(name=>({name,running:agentRunning[name]})) }));

fastify.post('/api/agent/:name/start', async (request, reply) => {
  const { name } = request.params;
  if (!AGENTS.includes(name)) return reply.code(400).send({ error:`Unknown agent: ${name}` });
  if (agentRunning[name]) return { ok:true, agent:name, status:'already_running' };
  agentRunning[name] = true;
  fastify.log.info(`Agent ${name} STARTED by user`);
  if (globalThis._io) globalThis._io.of('/enjambre').emit('presence:update', { peers:AGENTS.map(a=>({name:a,running:agentRunning[a],status:agentRunning[a]?'idle':'muerto',typing:false})) });
  return { ok:true, agent:name, status:'started' };
});

fastify.post('/api/agent/:name/stop', async (request, reply) => {
  const { name } = request.params;
  if (!AGENTS.includes(name)) return reply.code(400).send({ error:`Unknown agent: ${name}` });
  if (!agentRunning[name]) return { ok:true, agent:name, status:'already_stopped' };
  agentRunning[name] = false;
  fastify.log.info(`Agent ${name} STOPPED by user`);
  if (globalThis._io) globalThis._io.of('/enjambre').emit('presence:update', { peers:AGENTS.map(a=>({name:a,running:agentRunning[a],status:agentRunning[a]?'idle':'muerto',typing:false})) });
  return { ok:true, agent:name, status:'stopped' };
});

setInterval(() => {
  const db = getDb();
  const staleTasks = db.prepare("SELECT * FROM tasks WHERE status = 'en_proceso' AND lock_expires_at IS NOT NULL AND lock_expires_at < ?").all(now());
  for (const task of staleTasks) {
    fastify.log.warn(`[STALE] Reclaiming task ${task.id} from ${task.lock_owner}`);
    db.prepare('INSERT INTO messages (id, task_id, from_agent, text, timestamp) VALUES (?, ?, ?, ?, ?)').run(crypto.randomUUID(), task.id, 'system', `Tarea reclaimada: lock expirado de ${task.lock_owner}.`, now());
    db.prepare("UPDATE tasks SET status = 'pendiente', lock_owner = NULL, lock_acquired_at = NULL, lock_expires_at = NULL, last_heartbeat = NULL WHERE id = ?").run(task.id);
    cleanupSessionByTaskId(task.id);
  }
}, STALE_CHECK_INTERVAL_MS);

const presence = new Map();
const activeSessions = new Map(); // { userId: taskId }

function isAgentAlive(name) {
  for (const [, p] of presence) {
    if (p.name === name && p.status === 'vivo') return true;
  }
  return agentRunning[name] || false;
}

function cleanupSessionByTaskId(taskId) {
  for (const [userId, tId] of activeSessions) {
    if (tId === taskId) { activeSessions.delete(userId); break; }
  }
}

const PORT = process.env.PORT || 3003;
const HOST = process.env.HOST || '0.0.0.0';

fastify.listen({ port: PORT, host: HOST }, (err) => {
  if (err) { fastify.log.error(err); process.exit(1); }
  fastify.log.info(`Alcon server v3.0.0-enjambre on ${HOST}:${PORT}`);
  const io = new Server(fastify.server, { cors:{ origin:'*', methods:['GET','POST'], credentials:true }, transports:['websocket','polling'] });
  globalThis._io = io;
  const chatNs = io.of('/enjambre');
  chatNs.on('connection', (socket) => {
    fastify.log.info(`[WS] Client connected: ${socket.id}`);
    socket.on('chat:join', ({ name }) => {
      for (const [existingId, existingP] of presence) { if (existingP.name === name) { presence.delete(existingId); const oldSocket = chatNs.sockets.get(existingId); if (oldSocket) oldSocket.disconnect(true); } }
      presence.set(socket.id, { name:name||'user', status:'vivo', lastSeen:Date.now(), typing:false });
      const db = getDb();
      socket.emit('chat:history', db.prepare('SELECT * FROM chat ORDER BY timestamp ASC').all());
      broadcastPresence(chatNs);
    });
    socket.on('chat:message', ({ from, text }) => {
      if (!from || !text) return;
      const db = getDb();
      const chatMsg = { id: crypto.randomUUID(), from, text, timestamp: now() };
      db.prepare('INSERT INTO chat (id, from_agent, text, timestamp) VALUES (?, ?, ?, ?)').run(chatMsg.id, from, text, chatMsg.timestamp);
      chatNs.emit('chat:message', chatMsg);

      const tagMatch = text.match(/^@(\w+)\s/);

      if (tagMatch && ['cel', 'kali'].includes(tagMatch[1])) {
        const target = tagMatch[1];
        if (isAgentAlive(target)) {
          chatNs.emit('agent:direct', { id: crypto.randomUUID(), from, to: target, text: text.replace(/^@\w+\s*/, ''), task_id: null, timestamp: now() });
        } else {
          chatNs.emit('chat:message', { id: crypto.randomUUID(), from: 'system', text: `${target} no está disponible.`, timestamp: now() });
        }
        return;
      }

      if ((tagMatch && tagMatch[1] === 'all') || text.startsWith('/debate')) {
        const cleanText = text.replace(/^(@all|\/debate)\s*/, '');
        for (const agent of ['vps', 'cel', 'kali']) {
          if (isAgentAlive(agent)) {
            chatNs.emit('agent:direct', { id: crypto.randomUUID(), from, to: agent, text: cleanText, task_id: null, timestamp: now() });
          }
        }
        return;
      }

      let task = null;

      if (text.length < 10 && !text.match(/^@\w/)) {
        chatNs.emit('agent:direct', { id: crypto.randomUUID(), from, to: 'vps', text, task_id: null, timestamp: now() });
        return;
      }

      const existingTaskId = activeSessions.get(from);
      if (existingTaskId) {
        task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(existingTaskId);
        if (task && task.status !== 'pendiente' && task.status !== 'en_proceso') {
          task = null;
          activeSessions.delete(from);
        }
      }

      if (!task) {
        const id = generateId();
        const created = now();
        db.prepare(`INSERT INTO tasks (id, text, original_text, status, assigned_to, created, stage, stage_updated_at, blocked_by) VALUES (?, ?, ?, 'pendiente', 'vps', ?, 'backlog', ?, '[]')`).run(id, text.slice(0, 200), text, created, created);
        task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
        activeSessions.set(from, task.id);
      } else {
        db.prepare('INSERT INTO messages (id, task_id, from_agent, text, timestamp) VALUES (?, ?, ?, ?, ?)').run(crypto.randomUUID(), task.id, from, text, now());
      }

      chatNs.emit('agent:direct', { id: crypto.randomUUID(), from, to: 'vps', text, task_id: task.id, timestamp: now() });
    });
    socket.on('typing:start', () => { const p = presence.get(socket.id); if (p) { p.typing = true; p.lastSeen = Date.now(); } broadcastPresence(chatNs); });
    socket.on('typing:stop', () => { const p = presence.get(socket.id); if (p) { p.typing = false; p.lastSeen = Date.now(); } broadcastPresence(chatNs); });
    socket.on('chat:heartbeat', () => { const p = presence.get(socket.id); if (p) { p.lastSeen = Date.now(); if (p.status !== 'vivo') { p.status = 'vivo'; broadcastPresence(chatNs); } } });
    socket.on('presence:request', () => broadcastPresence(chatNs));
    socket.on('disconnect', () => { const p = presence.get(socket.id); if (p) { p.status = 'muerto'; p.typing = false; } presence.delete(socket.id); broadcastPresence(chatNs); });
  });
  setInterval(() => { const nowMs = Date.now(); let changed = false; for (const [id, p] of presence) { if (p.status !== 'muerto' && nowMs - p.lastSeen > PRESENCE_TIMEOUT_MS) { p.status = 'muerto'; p.typing = false; changed = true; } } if (changed) broadcastPresence(chatNs); }, PRESENCE_CHECK_MS);
  fastify.log.info(`Socket.io namespace /enjambre ready`);
});

function broadcastPresence(ns) {
  const byName = new Map();
  for (const [, p] of presence) byName.set(p.name, { name:p.name, status:p.status, typing:p.typing });
  for (const agent of AGENTS) { if (!byName.has(agent)) byName.set(agent, { name:agent, status:agentRunning[agent]?'idle':'muerto', typing:false }); }
  ns.emit('presence:update', { peers:Array.from(byName.values()) });
}
