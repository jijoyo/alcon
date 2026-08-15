import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fs from 'fs';
import { Server } from 'socket.io';
import { open as openDb, get as getDb } from './db/connection.js';
import tasksRoutes from './routes/tasks.js';
import { registerChat } from './routes/chat.js';
import { ARTIFACTS_DIR, agentRunning, now } from './lib/shared.js';

fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

const fastify = Fastify({ logger: true });

openDb();

await fastify.register(cors, { origin:true, credentials:true, methods:['GET','POST','PUT','DELETE','OPTIONS'], allowedHeaders:['Content-Type','Authorization'] });
await fastify.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });
await fastify.register(tasksRoutes);

fastify.get('/health', async () => {
  const db = getDb();
  const { count: taskCount } = db.prepare('SELECT COUNT(*) as count FROM tasks').get();
  return { status:'ok', version:'3.1.0-clean', timestamp:now(), uptime:process.uptime(), taskCount, agents:agentRunning };
});

fastify.post('/api/ping', async (request) => { const { agent } = request.body || {}; return { ok:true, agent, timestamp:now() }; });

fastify.get('/debug/sockets', async () => {
  const io = globalThis._io;
  if (!io) return { error: 'no io' };
  const ns = io.of('/enjambre');
  const sockets = [];
  for (const [id, s] of ns.sockets) {
    sockets.push({ id, rooms: [...s.rooms], transport: s.conn?.transport?.name });
  }
  return { count: sockets.length, sockets };
});

const PORT = process.env.PORT || 3003;
const HOST = process.env.HOST || '0.0.0.0';

fastify.listen({ port: PORT, host: HOST }, (err) => {
  if (err) { fastify.log.error(err); process.exit(1); }
  fastify.log.info(`Alcon server v3.1.0-clean on ${HOST}:${PORT}`);
  const io = new Server(fastify.server, { cors:{ origin:'*', methods:['GET','POST'], credentials:true }, transports:['websocket','polling'] });
  globalThis._io = io;
  registerChat(io);
  fastify.log.info(`Socket.io namespace /enjambre ready`);
});
