import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { readFile, writeFile, appendFile, mkdir, copyFile } from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import { execSync } from 'child_process';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3002;
const TASKS_FILE = path.join(__dirname, 'tasks.json');
const HISTORY_FILE = path.join(__dirname, 'history.json');
const LOG_FILE = path.join(__dirname, 'reporte.log');
const PING_FILE = path.join(__dirname, 'ping.json');
const BACKUP_DIR = path.join(__dirname, '..', 'backups');

const app = Fastify({ logger: false });

await mkdir(path.join(__dirname, 'logs'), { recursive: true });
await mkdir(BACKUP_DIR, { recursive: true });

await app.register(fastifyStatic, { root: __dirname });

async function readJSON(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf-8')); }
  catch { return fallback; }
}
async function writeJSON(file, data) {
  await writeFile(file, JSON.stringify(data, null, 2));
}
async function appendLog(line) {
  await appendFile(LOG_FILE, line + '\n');
}
async function getLogLines(n = 50) {
  try {
    const data = await readFile(LOG_FILE, 'utf-8');
    return data.trim().split('\n').slice(-n);
  } catch { return []; }
}

function getSystemInfo() {
  const cpus = os.cpus();
  const load = os.loadavg();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  let disk = 'N/A';
  try { disk = execSync('df -h / | tail -1', { encoding: 'utf-8' }).trim(); } catch {}
  let pm2Info = [];
  try {
    const raw = execSync('pm2 jlist', { encoding: 'utf-8' });
    pm2Info = JSON.parse(raw).map(p => ({
      name: p.name, pid: p.pid, status: p.pm2_env.status,
      uptime: Math.floor((Date.now() - p.pm2_env.pm_uptime) / 1000),
      cpu: p.monit?.cpu || 0, memory: p.monit?.memory || 0,
      restarts: p.pm2_env.restart_time || 0
    }));
  } catch {}
  return {
    hostname: os.hostname(), platform: os.platform(), arch: os.arch(),
    uptime: os.uptime(),
    cpu: { model: cpus[0]?.model, cores: cpus.length, load },
    memory: { total: totalMem, free: freeMem, used: totalMem - freeMem, pct: Math.round((1 - freeMem / totalMem) * 100) },
    disk, pm2: pm2Info
  };
}

function getKaliStatus() {
  try {
    const ping = JSON.parse(readFileSync(PING_FILE, 'utf-8'));
    const ago = Date.now() - new Date(ping.timestamp).getTime();
    return { alive: ago < 120000, lastPing: ping.timestamp, secondsAgo: Math.floor(ago / 1000) };
  } catch { return { alive: false, lastPing: null, secondsAgo: null }; }
}

async function logHistory(endpoint, ip, data) {
  const history = await readJSON(HISTORY_FILE, []);
  history.push({ endpoint, ip, data, timestamp: new Date().toISOString() });
  if (history.length > 500) history.splice(0, history.length - 500);
  await writeJSON(HISTORY_FILE, history);
}

// --- ROUTES ---

app.get('/', async (req, reply) => {
  return reply.type('text/html').sendFile('dashboard.html');
});

app.post('/api/task', async (req, reply) => {
  const { text } = req.body || {};
  if (!text) return reply.code(400).send({ error: 'text required' });
  const tasks = await readJSON(TASKS_FILE, []);
  const task = { id: Date.now(), text, status: 'pendiente', created: new Date().toISOString() };
  tasks.push(task);
  await writeJSON(TASKS_FILE, tasks);
  await logHistory('POST /api/task', req.ip, { text });
  await appendLog('[TASK] Nueva: ' + text);
  return { ok: true, task };
});

app.get('/api/tasks', async () => {
  return await readJSON(TASKS_FILE, []);
});

app.post('/api/task/:id/done', async (req, reply) => {
  const tasks = await readJSON(TASKS_FILE, []);
  const task = tasks.find(t => t.id === Number(req.params.id));
  if (!task) return reply.code(404).send({ error: 'not found' });
  task.status = 'hecho'; task.done = new Date().toISOString();
  await writeJSON(TASKS_FILE, tasks);
  return { ok: true };
});

app.post('/api/task/:id/error', async (req, reply) => {
  const tasks = await readJSON(TASKS_FILE, []);
  const task = tasks.find(t => t.id === Number(req.params.id));
  if (!task) return reply.code(404).send({ error: 'not found' });
  task.status = 'error'; task.error = new Date().toISOString();
  await writeJSON(TASKS_FILE, tasks);
  return { ok: true };
});

app.get('/api/status', async () => {
  const sys = getSystemInfo();
  const kali = getKaliStatus();
  const tasks = await readJSON(TASKS_FILE, []);
  return {
    alive: true, timestamp: new Date().toISOString(), system: sys, kali,
    tasks: {
      total: tasks.length,
      pendientes: tasks.filter(t => t.status === 'pendiente').length,
      hechos: tasks.filter(t => t.status === 'hecho').length,
      errores: tasks.filter(t => t.status === 'error').length
    }
  };
});

app.post('/api/ping', async (req) => {
  const { nodo, vivo } = req.body || {};
  await writeJSON(PING_FILE, { nodo, vivo, timestamp: new Date().toISOString() });
  await appendLog('[PING] ' + nodo + ': ' + (vivo ? 'VIVO' : 'MUERTO'));
  await logHistory('POST /api/ping', req.ip, { nodo, vivo });
  return { ok: true };
});

app.get('/api/logs', async () => {
  return { lines: await getLogLines(50) };
});

app.get('/api/history', async () => {
  return await readJSON(HISTORY_FILE, []);
});

app.post('/api/restart', async () => {
  await appendLog('[SYSTEM] Restart solicitado');
  setTimeout(() => execSync('pm2 restart alcon-api'), 500);
  return { ok: true, message: 'Reiniciando...' };
});

app.post('/api/clear-logs', async () => {
  await writeFile(LOG_FILE, '');
  await appendLog('[SYSTEM] Logs limpiados');
  return { ok: true };
});

app.post('/api/backup', async (req) => {
  const date = new Date().toISOString().slice(0, 10);
  const dest = path.join(BACKUP_DIR, 'alcon-' + date);
  try {
    execSync('cp -r ' + __dirname + ' ' + dest);
    await appendLog('[BACKUP] Creado: ' + dest);
    await logHistory('POST /api/backup', req.ip, { dest });
    return { ok: true, dest };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

app.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
  if (err) { console.error(err); process.exit(1); }
  console.log('[Alcon] Dashboard vivo en http://localhost:' + PORT);
});
