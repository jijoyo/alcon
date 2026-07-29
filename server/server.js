import Fastify from 'fastify';
import cors from '@fastify/cors';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import { open as openDb, get as getDb } from './db/connection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCK_TIMEOUT_MS = 10 * 60 * 1000;
const STALE_CHECK_INTERVAL_MS = 30 * 1000;
const PRESENCE_TIMEOUT_MS = 15 * 1000;
const PRESENCE_CHECK_MS = 5 * 1000;

// === FEATURE 1.2 - Stage Machine ===
const STAGES = ['backlog', 'plan', 'implement', 'test', 'review', 'done'];
const STAGE_TRANSITIONS = {
  backlog: 'plan',
  plan: 'implement',
  implement: 'test',
  test: 'review',
  review: 'done',
  done: null
};
const REVERSE_TRANSITIONS = {
  plan: 'backlog',
  implement: 'plan',
  test: 'implement',
  review: 'test',
  done: 'review',
  backlog: null
};
function advanceStage(current) { return STAGE_TRANSITIONS[current] || null; }
function regressStage(current) { return REVERSE_TRANSITIONS[current] || null; }
// === END FEATURE 1.2 ===

const KEYWORD_MAP = {
  vps: ['build', 'deploy', 'server', 'docker', 'pm2', 'database', 'supabase', 'api', 'backend', 'migrate', 'nginx', 'ssl', 'domain', 'dns'],
  kali: ['code', 'bug', 'fix', 'test', 'review', 'git', 'commit', 'merge', 'refactor', 'lint', 'typecheck', 'spec', 'implement', 'feature'],
  cel: ['screen', 'mobile', 'touch', 'capacitor', 'android', 'ios', 'app', 'apk', 'install', 'push', 'notification', 'camera', 'gps']
};

const AGENTS = ['kali', 'vps', 'cel'];
const agentRunning = { kali: true, vps: true, cel: false };
const fastify = Fastify({ logger: true });

openDb();

await fastify.register(cors, {
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
});

function parseAgentFromText(text) {
  const tagMatch = text.match(/^@(\w+)\s/);
  if (tagMatch && AGENTS.includes(tagMatch[1])) {
    return { agent: tagMatch[1], cleanText: text.slice(tagMatch[0].length) };
  }
  const lower = text.toLowerCase();
  for (const [agent, keywords] of Object.entries(KEYWORD_MAP)) {
    if (keywords.some(kw => lower.includes(kw))) {
      return { agent, cleanText: text };
    }
  }
  return { agent: 'kali', cleanText: text };
}

function generateId() {
  return Date.now() * 1000 + Math.floor(Math.random() * 1000);
}

function now() {
  return new Date().toISOString();
}

function isExpired(task) {
  if (!task.lock_expires_at) return false;
  return new Date(task.lock_expires_at) < new Date();
}

function formatTask(row) {
  if (!row) return null;
  const db = getDb();
  const messages = db.prepare('SELECT * FROM messages WHERE task_id = ? ORDER BY timestamp ASC').all(row.id);
  return { ...row, messages };
}

// --- Routes ---

fastify.get('/health', async () => {
  const db = getDb();
  const { count: taskCount } = db.prepare('SELECT COUNT(*) as count FROM tasks').get();
  return {
    status: 'ok',
    version: '3.0.0-enjambre',
    timestamp: now(),
    uptime: process.uptime(),
    taskCount,
    agents: agentRunning
  };
});

fastify.post('/api/task', async (request, reply) => {
  const { text } = request.body || {};
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return reply.code(400).send({ error: 'text is required' });
  }
  const { agent, cleanText } = parseAgentFromText(text.trim());
  const db = getDb();
  const id = generateId();
  const created = now();
  db.prepare(`
    INSERT INTO tasks (id, text, original_text, status, assigned_to, created, stage, stage_updated_at)
    VALUES (?, ?, ?, 'pendiente', ?, ?, 'backlog', ?)
  `).run(id, cleanText, text.trim(), agent, created, created);
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  fastify.log.info(`Task ${task.id} created for agent: ${agent}`);
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
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }
  sql += ' ORDER BY created DESC';
  const tasks = db.prepare(sql).all(...params);
  const { count } = db.prepare('SELECT COUNT(*) as count FROM tasks').get();
  return { tasks: tasks.map(formatTask), count, version: count };
});

fastify.get('/api/task/:id', async (request, reply) => {
  const id = Number(request.params.id);
  const db = getDb();
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!task) return reply.code(404).send({ error: 'Task not found' });
  return formatTask(task);
});

fastify.post('/api/task/:id/claim', async (request, reply) => {
  const id = Number(request.params.id);
  const { owner } = request.body || {};
  if (!owner) return reply.code(400).send({ error: 'owner is required' });
  const db = getDb();
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!task) return reply.code(404).send({ error: 'Task not found' });
  if (task.status === 'en_proceso' && task.lock_owner && !isExpired(task)) {
    if (task.lock_owner !== owner) {
      return reply.code(409).send({
        error: 'Task already claimed',
        claimed_by: task.lock_owner,
        lock_expires_at: task.lock_expires_at
      });
    }
    const expiresAt = new Date(Date.now() + LOCK_TIMEOUT_MS).toISOString();
    const ts = now();
    db.prepare('UPDATE tasks SET lock_expires_at = ?, last_heartbeat = ? WHERE id = ?')
      .run(expiresAt, ts, id);
    const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    return formatTask(updated);
  }
  const acquiredAt = now();
  const expiresAt = new Date(Date.now() + LOCK_TIMEOUT_MS).toISOString();
  db.prepare(`
    UPDATE tasks SET status = 'en_proceso', assigned_to = COALESCE(NULLIF(assigned_to, ''), ?),
      lock_owner = ?, lock_acquired_at = ?, lock_expires_at = ?, last_heartbeat = ?
    WHERE id = ?
  `).run(owner, owner, acquiredAt, expiresAt, acquiredAt, id);
  const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  fastify.log.info(`Task ${id} claimed by ${owner}`);
  return formatTask(updated);
});

fastify.post('/api/task/:id/heartbeat', async (request, reply) => {
  const id = Number(request.params.id);
  const { owner } = request.body || {};
  if (!owner) return reply.code(400).send({ error: 'owner is required' });
  const db = getDb();
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!task) return reply.code(404).send({ error: 'Task not found' });
  if (task.lock_owner !== owner) {
    return reply.code(403).send({ error: 'Not the lock owner' });
  }
  const expiresAt = new Date(Date.now() + LOCK_TIMEOUT_MS).toISOString();
  const ts = now();
  db.prepare('UPDATE tasks SET last_heartbeat = ?, lock_expires_at = ? WHERE id = ?')
    .run(ts, expiresAt, id);
  return { ok: true, lock_expires_at: expiresAt };
});

fastify.post('/api/task/:id/message', async (request, reply) => {
  const id = Number(request.params.id);
  const { from, text } = request.body || {};
  if (!from || !text) return reply.code(400).send({ error: 'from and text are required' });
  const db = getDb();
  const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(id);
  if (!task) return reply.code(404).send({ error: 'Task not found' });
  const message = {
    id: crypto.randomUUID(),
    from,
    text,
    timestamp: now()
  };
  db.prepare('INSERT INTO messages (id, task_id, from_agent, text, timestamp) VALUES (?, ?, ?, ?, ?)')
    .run(message.id, id, from, text, message.timestamp);
  return message;
});

fastify.get('/api/task/:id/messages', async (request, reply) => {
  const id = Number(request.params.id);
  const db = getDb();
  const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(id);
  if (!task) return reply.code(404).send({ error: 'Task not found' });
  const messages = db.prepare('SELECT * FROM messages WHERE task_id = ? ORDER BY timestamp ASC').all(id);
  return { messages, count: messages.length };
});

fastify.post('/api/task/:id/complete', async (request, reply) => {
  const id = Number(request.params.id);
  const { owner, result } = request.body || {};
  if (!owner) return reply.code(400).send({ error: 'owner is required' });
  const db = getDb();
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!task) return reply.code(404).send({ error: 'Task not found' });
  if (task.lock_owner && task.lock_owner !== owner) {
    return reply.code(403).send({ error: 'Not the lock owner' });
  }
  const ts = now();
  db.prepare(`
    UPDATE tasks SET status = 'hecho', result = ?,
      lock_owner = NULL, lock_acquired_at = NULL, lock_expires_at = NULL,
      last_heartbeat = NULL, completed_at = ?
    WHERE id = ?
  `).run(result || null, ts, id);
  const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  fastify.log.info(`Task ${id} completed by ${owner}`);
  return formatTask(updated);
});

fastify.post('/api/task/:id/error', async (request, reply) => {
  const id = Number(request.params.id);
  const { owner, error: errorMsg } = request.body || {};
  if (!owner) return reply.code(400).send({ error: 'owner is required' });
  const db = getDb();
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!task) return reply.code(404).send({ error: 'Task not found' });
  if (task.lock_owner && task.lock_owner !== owner) {
    return reply.code(403).send({ error: 'Not the lock owner' });
  }
  const ts = now();
  db.prepare(`
    UPDATE tasks SET status = 'error', result = ?,
      lock_owner = NULL, lock_acquired_at = NULL, lock_expires_at = NULL,
      last_heartbeat = NULL, error_at = ?
    WHERE id = ?
  `).run(errorMsg || 'Unknown error', ts, id);
  const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  fastify.log.info(`Task ${id} errored by ${owner}`);
  return formatTask(updated);
});

// === FEATURE 1.2 - Endpoints Stage ===
fastify.post('/api/task/:id/advance', async (request, reply) => {
  const id = Number(request.params.id);
  const { by_agent = 'unknown' } = request.body || {};
  const db = getDb();
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!task) return reply.code(404).send({ error: 'Task not found' });
  const next = advanceStage(task.stage);
  if (!next) return reply.code(400).send({ error: `No se puede avanzar desde ${task.stage}` });
  const ts = now();
  db.prepare('UPDATE tasks SET stage = ?, stage_updated_at = ? WHERE id = ?').run(next, ts, id);
  try {
    db.prepare('INSERT INTO stage_log (id, task_id, from_stage, to_stage, by_agent, timestamp) VALUES (?, ?, ?, ?, ?, ?)')
      .run(crypto.randomUUID(), id, task.stage, next, by_agent, ts);
  } catch(e) { fastify.log.warn('stage_log insert fail: ' + e.message); }
  const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  return formatTask(updated);
});

fastify.post('/api/task/:id/regress', async (request, reply) => {
  const id = Number(request.params.id);
  const { by_agent = 'unknown' } = request.body || {};
  const db = getDb();
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!task) return reply.code(404).send({ error: 'Task not found' });
  const prev = regressStage(task.stage);
  if (!prev) return reply.code(400).send({ error: `No se puede regresar desde ${task.stage}` });
  const ts = now();
  db.prepare('UPDATE tasks SET stage = ?, stage_updated_at = ? WHERE id = ?').run(prev, ts, id);
  try {
    db.prepare('INSERT INTO stage_log (id, task_id, from_stage, to_stage, by_agent, timestamp) VALUES (?, ?, ?, ?, ?, ?)')
      .run(crypto.randomUUID(), id, task.stage, prev, by_agent, ts);
  } catch(e) { fastify.log.warn('stage_log insert fail: ' + e.message); }
  const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  return formatTask(updated);
});

fastify.get('/api/tasks/by-stage', async () => {
  const db = getDb();
  const tasks = db.prepare('SELECT * FROM tasks ORDER BY created DESC').all();
  const grouped = {};
  STAGES.forEach(s => grouped[s] = []);
  for (const t of tasks) {
    const s = t.stage || 'backlog';
    if (!grouped[s]) grouped[s] = [];
    grouped[s].push(formatTask(t));
  }
  return grouped;
});

fastify.get('/api/task/:id/stage-log', async (request, reply) => {
  const id = Number(request.params.id);
  const db = getDb();
  const logs = db.prepare('SELECT * FROM stage_log WHERE task_id = ? ORDER BY timestamp ASC').all(id);
  return { logs, count: logs.length };
});
// === END FEATURE 1.2 ===

fastify.get('/api/status', async () => {
  const db = getDb();
  const tasks = db.prepare('SELECT * FROM tasks').all();
  const agentStatus = {};
  for (const agent of AGENTS) {
    const agentTasks = tasks.filter(t => t.assigned_to === agent);
    const active = agentTasks.filter(t => t.status === 'en_proceso');
    const pending = agentTasks.filter(t => t.status === 'pendiente');
    const done = agentTasks.filter(t => t.status === 'hecho');
    const errored = agentTasks.filter(t => t.status === 'error');
    agentStatus[agent] = {
      active: active.length,
      pending: pending.length,
      done: done.length,
      error: errored.length,
      total: agentTasks.length,
      running: agentRunning[agent],
      active_tasks: active.map(t => ({
        id: t.id,
        text: t.text,
        lock_owner: t.lock_owner,
        lock_expires_at: t.lock_expires_at,
        last_heartbeat: t.last_heartbeat,
        is_stale: isExpired(t)
      }))
    };
  }
  return {
    total_tasks: tasks.length,
    version: tasks.length,
    agents: agentStatus,
    timestamp: now()
  };
});

fastify.post('/api/ping', async (request) => {
  const { agent } = request.body || {};
  return { ok: true, agent, timestamp: now() };
});

fastify.get('/api/agents', async () => {
  return {
    agents: AGENTS.map(name => ({
      name,
      running: agentRunning[name]
    }))
  };
});

fastify.get('/api/agents/status', async () => {
  return {
    agents: AGENTS.map(name => ({
      name,
      running: agentRunning[name]
    }))
  };
});

fastify.post('/api/agent/:name/start', async (request, reply) => {
  const { name } = request.params;
  if (!AGENTS.includes(name)) {
    return reply.code(400).send({ error: `Unknown agent: ${name}` });
  }
  if (agentRunning[name]) {
    return { ok: true, agent: name, status: 'already_running' };
  }
  agentRunning[name] = true;
  fastify.log.info(`Agent ${name} STARTED by user`);
  if (globalThis._io) {
    globalThis._io.of('/enjambre').emit('presence:update', {
      peers: AGENTS.map(a => ({ name: a, running: agentRunning[a], status: agentRunning[a] ? 'idle' : 'muerto', typing: false }))
    });
  }
  return { ok: true, agent: name, status: 'started' };
});

fastify.post('/api/agent/:name/stop', async (request, reply) => {
  const { name } = request.params;
  if (!AGENTS.includes(name)) {
    return reply.code(400).send({ error: `Unknown agent: ${name}` });
  }
  if (!agentRunning[name]) {
    return { ok: true, agent: name, status: 'already_stopped' };
  }
  agentRunning[name] = false;
  fastify.log.info(`Agent ${name} STOPPED by user`);
  if (globalThis._io) {
    globalThis._io.of('/enjambre').emit('presence:update', {
      peers: AGENTS.map(a => ({ name: a, running: agentRunning[a], status: agentRunning[a] ? 'idle' : 'muerto', typing: false }))
    });
  }
  return { ok: true, agent: name, status: 'stopped' };
});

setInterval(() => {
  const db = getDb();
  const staleTasks = db.prepare("SELECT * FROM tasks WHERE status = 'en_proceso' AND lock_expires_at IS NOT NULL AND lock_expires_at < ?").all(now());
  for (const task of staleTasks) {
    fastify.log.warn(`[STALE] Reclaiming task ${task.id} from ${task.lock_owner} (expired at ${task.lock_expires_at})`);
    db.prepare(`
      INSERT INTO messages (id, task_id, from_agent, text, timestamp)
      VALUES (?, ?, 'system', ?, ?)
    `).run(crypto.randomUUID(), task.id, `Tarea reclaimada: lock expirado de ${task.lock_owner}. Estado cambiado a pendiente.`, now());
    db.prepare(`
      UPDATE tasks SET status = 'pendiente',
        lock_owner = NULL, lock_acquired_at = NULL,
        lock_expires_at = NULL, last_heartbeat = NULL
      WHERE id = ?
    `).run(task.id);
    fastify.log.info(`[STALE] Reclaimed task ${task.id}`);
  }
}, STALE_CHECK_INTERVAL_MS);

const presence = new Map();

const PORT = process.env.PORT || 3002;
const HOST = process.env.HOST || '0.0.0.0';

fastify.listen({ port: PORT, host: HOST }, (err) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  fastify.log.info(`Alcon server v3.0.0-enjambre on ${HOST}:${PORT}`);
  const io = new Server(fastify.server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling']
  });
  globalThis._io = io;
  const chatNs = io.of('/enjambre');
  chatNs.on('connection', (socket) => {
    fastify.log.info(`[WS] Client connected: ${socket.id}`);
    socket.on('chat:join', ({ name }) => {
      for (const [existingId, existingP] of presence) {
        if (existingP.name === name) {
          presence.delete(existingId);
          const oldSocket = chatNs.sockets.get(existingId);
          if (oldSocket) oldSocket.disconnect(true);
        }
      }
      presence.set(socket.id, {
        name: name || 'user',
        status: 'vivo',
        lastSeen: Date.now(),
        typing: false
      });
      const db = getDb();
      const history = db.prepare('SELECT * FROM chat ORDER BY timestamp ASC').all();
      socket.emit('chat:history', history);
      broadcastPresence(chatNs);
      fastify.log.info(`[WS] ${name} joined the enjambre`);
    });
    socket.on('chat:message', ({ from, text }) => {
      if (!from || !text) return;
      const message = {
        id: crypto.randomUUID(),
        from,
        text,
        timestamp: now()
      };
      const db = getDb();
      db.prepare('INSERT INTO chat (id, from_agent, text, timestamp) VALUES (?, ?, ?, ?)')
        .run(message.id, from, text, message.timestamp);
      chatNs.emit('chat:message', message);
      fastify.log.info(`[CHAT] ${from}: ${text.slice(0, 80)}`);
    });
    socket.on('typing:start', () => {
      const p = presence.get(socket.id);
      if (p) {
        p.typing = true;
        p.lastSeen = Date.now();
      }
      broadcastPresence(chatNs);
    });
    socket.on('typing:stop', () => {
      const p = presence.get(socket.id);
      if (p) {
        p.typing = false;
        p.lastSeen = Date.now();
      }
      broadcastPresence(chatNs);
    });
    socket.on('chat:heartbeat', () => {
      const p = presence.get(socket.id);
      if (p) {
        p.lastSeen = Date.now();
        if (p.status !== 'vivo') {
          p.status = 'vivo';
          broadcastPresence(chatNs);
        }
      }
    });
    socket.on('presence:request', () => {
      broadcastPresence(chatNs);
    });
    socket.on('disconnect', () => {
      const p = presence.get(socket.id);
      if (p) {
        p.status = 'muerto';
        p.typing = false;
        fastify.log.info(`[WS] ${p.name} disconnected`);
      }
      presence.delete(socket.id);
      broadcastPresence(chatNs);
    });
  });
  setInterval(() => {
    const nowMs = Date.now();
    let changed = false;
    for (const [id, p] of presence) {
      if (p.status !== 'muerto' && nowMs - p.lastSeen > PRESENCE_TIMEOUT_MS) {
        p.status = 'muerto';
        p.typing = false;
        changed = true;
        fastify.log.info(`[WS] ${p.name} marked muerto (no heartbeat)`);
      }
    }
    if (changed) {
      broadcastPresence(chatNs);
    }
  }, PRESENCE_CHECK_MS);
  fastify.log.info(`Socket.io namespace /enjambre ready`);
});

function broadcastPresence(ns) {
  const entries = [];
  for (const [, p] of presence) {
    entries.push({ name: p.name, status: p.status, typing: p.typing });
  }
  for (const agent of AGENTS) {
    if (!entries.find(e => e.name === agent)) {
      entries.push({ name: agent, status: agentRunning[agent] ? 'idle' : 'muerto', typing: false });
    }
  }
  ns.emit('presence:update', { peers: entries });
}
