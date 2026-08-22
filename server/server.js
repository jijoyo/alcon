import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fs from 'fs';
import { Server } from 'socket.io';
import { open as openDb, get as getDb } from './db/connection.js';
import tasksRoutes from './routes/tasks.js';
import { registerChat } from './routes/chat.js';
import { ARTIFACTS_DIR, agentRunning, now } from './lib/shared.js';
import { orchestrateTask } from './lib/orchestrator.js';
import { discover } from './lib/auto-discovery.js';
import granjaRoutes from './routes/granja.js';
import espanolRoutes from './routes/espanol.js';
import memoriaRoutes from './routes/memoria.js';

fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

const fastify = Fastify({ logger: true });

await openDb();

await fastify.register(cors, { 
  origin: (origin, cb) => { 
    if (!origin) return cb(null, true);
    cb(null, true);
  }, 
  credentials: true, 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], 
  allowedHeaders: ['Content-Type', 'Authorization'] 
});
await fastify.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });
await fastify.register(tasksRoutes);

await discover();
setInterval(() => discover(), 60000);
fastify.register(granjaRoutes);
fastify.register(espanolRoutes);
fastify.register(memoriaRoutes);

fastify.get('/health', async () => {
  const db = getDb();
  const { count: taskCount } = db.prepare('SELECT COUNT(*) as count FROM tasks').get();
  return { status: 'ok', version: 'v4.3-regla-oro (fbb6655)', timestamp: now(), uptime: process.uptime(), taskCount, agents: agentRunning };
});

fastify.post('/api/ping', async (request) => { const { agent } = request.body || {}; return { ok: true, agent, timestamp: now() }; });

let orchestrating = false;
fastify.post('/api/orchestrate', async (request, reply) => {
  if (orchestrating) return reply.code(429).send({ error: 'Orquestación en curso, espera a que termine' });
  orchestrating = true;
  try {
    const result = await orchestrateTask(request.body);
    return result;
  } catch (e) {
    fastify.log.error(e);
    return reply.code(500).send({ error: e.message });
  } finally {
    orchestrating = false;
  }
});

const PORT = process.env.PORT || 3003;
const HOST = process.env.HOST || '0.0.0.0';

const io = new Server(fastify.server, { cors: { origin: true, methods: ['GET', 'POST'], credentials: true }, transports: ['websocket', 'polling'] });
globalThis._io = io;
registerChat(io);

fastify.listen({ port: PORT, host: HOST }, (err) => {
  if (err) { fastify.log.error(err); process.exit(1); }
  fastify.log.info(`Alcon server v4.0-granja-real on ${HOST}:${PORT}`);
  fastify.log.info(`Socket.io namespace /enjambre ready`);
});

const shutdown = async (signal) => {
  fastify.log.info(`${signal} received, shutting down...`);
  if (globalThis._io) globalThis._io.close();
  const { close: closeDb } = await import('./db/connection.js');
  closeDb();
  await fastify.close();
  process.exit(0);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
