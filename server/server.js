import Fastify from 'fastify';
import cors from '@fastify/cors';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, 'tasks.json');
const CHAT_FILE = path.join(__dirname, 'messages.json');
const LOCK_TIMEOUT_MS = 10 * 60 * 1000;
const STALE_CHECK_INTERVAL_MS = 30 * 1000;
const CHAT_MAX_MESSAGES = 50;
const PRESENCE_TIMEOUT_MS = 15 * 1000;
const PRESENCE_CHECK_MS = 5 * 1000;

const KEYWORD_MAP = {
  vps: ['build', 'deploy', 'server', 'docker', 'pm2', 'database', 'supabase', 'api', 'backend', 'migrate', 'nginx', 'ssl', 'domain', 'dns'],
  kali: ['code', 'bug', 'fix', 'test', 'review', 'git', 'commit', 'merge', 'refactor', 'lint', 'typecheck', 'spec', 'implement', 'feature'],
  cel: ['screen', 'mobile', 'touch', 'capacitor', 'android', 'ios', 'app', 'apk', 'install', 'push', 'notification', 'camera', 'gps']
};

const AGENTS = ['kali', 'vps', 'cel'];

// --- Chat persistence ---

function readChat() {
  try {
    if (!fs.existsSync(CHAT_FILE)) {
      fs.writeFileSync(CHAT_FILE, JSON.stringify([], null, 2));
    }
    return JSON.parse(fs.readFileSync(CHAT_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeChat(messages) {
  try {
    const trimmed = messages.slice(-CHAT_MAX_MESSAGES);
    const tmp = CHAT_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(trimmed, null, 2));
    fs.renameSync(tmp, CHAT_FILE);
    return true;
  } catch (e) {
    console.error('Error writing chat:', e.message);
    return false;
  }
}

// --- Agent process state (master switch) ---

const agentRunning = { kali: true, vps: true, cel: false };

const fastify = Fastify({ logger: true });

await fastify.register(cors, {
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE']
});

// --- Data helpers ---

function readData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify({ tasks: [], version: 0 }, null, 2));
    }
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    fastify.log.error('Error reading tasks.json:', e.message);
    return { tasks: [], version: 0 };
  }
}

function writeData(data) {
  try {
    const tmp = DATA_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, DATA_FILE);
    return true;
  } catch (e) {
    fastify.log.error('Error writing tasks.json:', e.message);
    return false;
  }
}

function parseAgentFromText(text) {
  const tagMatch = text.match(/^@(\w+)\s/);
  if (tagMatch && AGENTS.includes(tagMatch[1])) {
    return { agent: tagMatch[1], cleanText: text.slice(tagMatch[0].length) };
  }
  // keyword fallback
  const lower = text.toLowerCase();
  for (const [agent, keywords] of Object.entries(KEYWORD_MAP)) {
    if (keywords.some(kw => lower.includes(kw))) {
      return { agent, cleanText: text };
    }
  }
  return { agent: 'kali', cleanText: text }; // default
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

// --- Routes ---

// Health check
fastify.get('/health', async () => {
  const data = readData();
  return {
    status: 'ok',
    version: '3.0.0-enjambre',
    timestamp: now(),
    uptime: process.uptime(),
    taskCount: data.tasks.length,
    version_number: data.version,
    agents: agentRunning
  };
});

// Create task
fastify.post('/api/task', async (request, reply) => {
  const { text } = request.body || {};
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return reply.code(400).send({ error: 'text is required' });
  }

  const { agent, cleanText } = parseAgentFromText(text.trim());
  const data = readData();
  const task = {
    id: generateId(),
    text: cleanText,
    original_text: text.trim(),
    status: 'pendiente',
    assigned_to: agent,
    lock_owner: null,
    lock_acquired_at: null,
    lock_expires_at: null,
    last_heartbeat: null,
    messages: [],
    result: null,
    created: now()
  };

  data.tasks.push(task);
  data.version++;
  writeData(data);

  fastify.log.info(`Task ${task.id} created for agent: ${agent}`);
  return task;
});

// List tasks
fastify.get('/api/tasks', async (request) => {
  const { agent, status } = request.query;
  const data = readData();
  let tasks = data.tasks;

  if (agent) tasks = tasks.filter(t => t.assigned_to === agent);
  if (status) tasks = tasks.filter(t => t.status === status);

  return { tasks, count: tasks.length, version: data.version };
});

// Get task detail
fastify.get('/api/task/:id', async (request, reply) => {
  const id = Number(request.params.id);
  const data = readData();
  const task = data.tasks.find(t => t.id === id);
  if (!task) return reply.code(404).send({ error: 'Task not found' });
  return task;
});

// Claim task (agent takes ownership)
fastify.post('/api/task/:id/claim', async (request, reply) => {
  const id = Number(request.params.id);
  const { owner } = request.body || {};
  if (!owner) return reply.code(400).send({ error: 'owner is required' });

  const data = readData();
  const taskIdx = data.tasks.findIndex(t => t.id === id);
  if (taskIdx === -1) return reply.code(404).send({ error: 'Task not found' });

  const task = data.tasks[taskIdx];

  // Check if already claimed by someone else and lock is still valid
  if (task.status === 'en_proceso' && task.lock_owner && !isExpired(task)) {
    if (task.lock_owner !== owner) {
      return reply.code(409).send({
        error: 'Task already claimed',
        claimed_by: task.lock_owner,
        lock_expires_at: task.lock_expires_at
      });
    }
    // Same owner re-claiming — extend lock
    task.lock_expires_at = new Date(Date.now() + LOCK_TIMEOUT_MS).toISOString();
    task.last_heartbeat = now();
    data.version++;
    writeData(data);
    return task;
  }

  // Claim the task
  const acquiredAt = now();
  task.status = 'en_proceso';
  task.assigned_to = task.assigned_to || owner;
  task.lock_owner = owner;
  task.lock_acquired_at = acquiredAt;
  task.lock_expires_at = new Date(Date.now() + LOCK_TIMEOUT_MS).toISOString();
  task.last_heartbeat = acquiredAt;

  data.tasks[taskIdx] = task;
  data.version++;
  writeData(data);

  fastify.log.info(`Task ${id} claimed by ${owner}`);
  return task;
});

// Heartbeat (extend lock)
fastify.post('/api/task/:id/heartbeat', async (request, reply) => {
  const id = Number(request.params.id);
  const { owner } = request.body || {};
  if (!owner) return reply.code(400).send({ error: 'owner is required' });

  const data = readData();
  const taskIdx = data.tasks.findIndex(t => t.id === id);
  if (taskIdx === -1) return reply.code(404).send({ error: 'Task not found' });

  const task = data.tasks[taskIdx];

  if (task.lock_owner !== owner) {
    return reply.code(403).send({ error: 'Not the lock owner' });
  }

  task.last_heartbeat = now();
  task.lock_expires_at = new Date(Date.now() + LOCK_TIMEOUT_MS).toISOString();
  data.tasks[taskIdx] = task;
  data.version++;
  writeData(data);

  return { ok: true, lock_expires_at: task.lock_expires_at };
});

// Send message (append-only)
fastify.post('/api/task/:id/message', async (request, reply) => {
  const id = Number(request.params.id);
  const { from, text } = request.body || {};
  if (!from || !text) return reply.code(400).send({ error: 'from and text are required' });

  const data = readData();
  const taskIdx = data.tasks.findIndex(t => t.id === id);
  if (taskIdx === -1) return reply.code(404).send({ error: 'Task not found' });

  const message = {
    id: crypto.randomUUID(),
    from,
    text,
    timestamp: now()
  };

  data.tasks[taskIdx].messages.push(message);
  data.version++;
  writeData(data);

  return message;
});

// Get messages for a task
fastify.get('/api/task/:id/messages', async (request, reply) => {
  const id = Number(request.params.id);
  const data = readData();
  const task = data.tasks.find(t => t.id === id);
  if (!task) return reply.code(404).send({ error: 'Task not found' });

  return { messages: task.messages, count: task.messages.length };
});

// Complete task
fastify.post('/api/task/:id/complete', async (request, reply) => {
  const id = Number(request.params.id);
  const { owner, result } = request.body || {};
  if (!owner) return reply.code(400).send({ error: 'owner is required' });

  const data = readData();
  const taskIdx = data.tasks.findIndex(t => t.id === id);
  if (taskIdx === -1) return reply.code(404).send({ error: 'Task not found' });

  const task = data.tasks[taskIdx];

  if (task.lock_owner && task.lock_owner !== owner) {
    return reply.code(403).send({ error: 'Not the lock owner' });
  }

  task.status = 'hecho';
  task.result = result || null;
  task.lock_owner = null;
  task.lock_acquired_at = null;
  task.lock_expires_at = null;
  task.last_heartbeat = null;
  task.completed_at = now();

  data.tasks[taskIdx] = task;
  data.version++;
  writeData(data);

  fastify.log.info(`Task ${id} completed by ${owner}`);
  return task;
});

// Error on task
fastify.post('/api/task/:id/error', async (request, reply) => {
  const id = Number(request.params.id);
  const { owner, error: errorMsg } = request.body || {};
  if (!owner) return reply.code(400).send({ error: 'owner is required' });

  const data = readData();
  const taskIdx = data.tasks.findIndex(t => t.id === id);
  if (taskIdx === -1) return reply.code(404).send({ error: 'Task not found' });

  const task = data.tasks[taskIdx];

  if (task.lock_owner && task.lock_owner !== owner) {
    return reply.code(403).send({ error: 'Not the lock owner' });
  }

  task.status = 'error';
  task.result = errorMsg || 'Unknown error';
  task.lock_owner = null;
  task.lock_acquired_at = null;
  task.lock_expires_at = null;
  task.last_heartbeat = null;
  task.error_at = now();

  data.tasks[taskIdx] = task;
  data.version++;
  writeData(data);

  return task;
});

// System status
fastify.get('/api/status', async () => {
  const data = readData();
  const tasks = data.tasks;

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
    version: data.version,
    agents: agentStatus,
    timestamp: now()
  };
});

// Agent ping (register heartbeat)
fastify.post('/api/ping', async (request) => {
  const { agent } = request.body || {};
  return { ok: true, agent, timestamp: now() };
});

// --- Agent control (master switch) ---

fastify.get('/api/agents', async () => {
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

// --- Stale lock reclaim (runs every 30s) ---
setInterval(() => {
  const data = readData();
  let reclaimed = 0;

  for (let i = 0; i < data.tasks.length; i++) {
    const task = data.tasks[i];
    if (task.status === 'en_proceso' && task.lock_owner && isExpired(task)) {
      fastify.log.warn(`[STALE] Reclaiming task ${task.id} from ${task.lock_owner} (expired at ${task.lock_expires_at})`);

      // Add system message about stale reclaim
      task.messages.push({
        id: crypto.randomUUID(),
        from: 'system',
        text: `Tarea reclaimada: lock expirado de ${task.lock_owner}. Estado cambiado a pendiente.`,
        timestamp: now()
      });

      task.status = 'pendiente';
      task.lock_owner = null;
      task.lock_acquired_at = null;
      task.lock_expires_at = null;
      task.last_heartbeat = null;
      reclaimed++;
    }
  }

  if (reclaimed > 0) {
    data.version++;
    writeData(data);
    fastify.log.info(`[STALE] Reclaimed ${reclaimed} stale task(s)`);
  }
}, STALE_CHECK_INTERVAL_MS);

// --- Presence map (module scope — shared by routes + socket.io) ---

const presence = new Map();

// --- Start server + Socket.io ---

const PORT = process.env.PORT || 3002;
const HOST = process.env.HOST || '0.0.0.0';

fastify.listen({ port: PORT, host: HOST }, (err) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }

  fastify.log.info(`Alcon server v3.0.0-enjambre on ${HOST}:${PORT}`);

  // --- Socket.io setup ---
  const io = new Server(fastify.server, {
    cors: {
      origin: true,
      methods: ['GET', 'POST'],
    }
  });

  globalThis._io = io;

  const chatNs = io.of('/enjambre');

  chatNs.on('connection', (socket) => {
    fastify.log.info(`[WS] Client connected: ${socket.id}`);

    // Join: client identifies itself
    socket.on('chat:join', ({ name }) => {
      presence.set(socket.id, {
        name: name || 'user',
        status: 'vivo',
        lastSeen: Date.now(),
        typing: false
      });

      // Send chat history to new client
      const history = readChat();
      socket.emit('chat:history', history);

      // Broadcast updated presence to all
      broadcastPresence(chatNs);
      fastify.log.info(`[WS] ${name} joined the enjambre`);
    });

    // Chat message
    socket.on('chat:message', ({ from, text }) => {
      if (!from || !text) return;

      const message = {
        id: crypto.randomUUID(),
        from,
        text,
        timestamp: now()
      };

      // Persist
      const messages = readChat();
      messages.push(message);
      writeChat(messages);

      // Broadcast to all
      chatNs.emit('chat:message', message);
      fastify.log.info(`[CHAT] ${from}: ${text.slice(0, 80)}`);
    });

    // Typing indicators
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

    // Heartbeat from client (keepalive)
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

    // Disconnect
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

  // Presence check (every 5s): mark stale as muerto
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

// --- broadcastPresence (module scope — used by both socket.io and agent control routes) ---

function broadcastPresence(ns) {
  const entries = [];
  for (const [, p] of presence) {
    entries.push({ name: p.name, status: p.status, typing: p.typing });
  }
  // Also include agent running states
  for (const agent of AGENTS) {
    if (!entries.find(e => e.name === agent)) {
      entries.push({ name: agent, status: agentRunning[agent] ? 'idle' : 'muerto', typing: false });
    }
  }
  ns.emit('presence:update', { peers: entries });
}
