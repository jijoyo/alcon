#!/usr/bin/env node

// Alcon Agent - Polls task server and executes tasks
// Usage: node agent.js <agent-name> <server-url> <execute-fn>

import http from 'http';
import { io } from 'socket.io-client';

const AGENT_NAME = process.argv[2] || 'kali';
const SERVER_URL = process.argv[3] || 'http://localhost:3002';
const POLL_INTERVAL = 30_000; // 30 seconds
const HEARTBEAT_INTERVAL = 120_000; // 2 minutes

let activeTask = null;
let heartbeatTimer = null;

function request(method, urlPath, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, SERVER_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve({ raw: data });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(10_000, () => { req.destroy(); reject(new Error('timeout')); });

    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function log(msg) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${AGENT_NAME}] ${msg}`);
}

async function heartbeat() {
  if (!activeTask) return;
  try {
    await request('POST', `/api/task/${activeTask.id}/heartbeat`, { owner: AGENT_NAME });
    log(`Heartbeat sent for task ${activeTask.id}`);
  } catch (e) {
    log(`Heartbeat failed: ${e.message}`);
  }
}

async function processTask(task) {
  log(`Processing task ${task.id}: ${task.text}`);
  activeTask = task;

  // Start heartbeat
  heartbeatTimer = setInterval(heartbeat, HEARTBEAT_INTERVAL);

  try {
    // Send status message
    await request('POST', `/api/task/${task.id}/message`, {
      from: AGENT_NAME,
      text: `Procesando tarea: ${task.text}`
    });

    // Simulate work (replace with actual task execution)
    log(`Executing: ${task.text}`);
    await new Promise(r => setTimeout(r, 5000)); // Simulated work

    // Complete task
    const result = `Tarea "${task.text}" completada por ${AGENT_NAME}`;
    await request('POST', `/api/task/${task.id}/complete`, {
      owner: AGENT_NAME,
      result
    });

    await request('POST', `/api/task/${task.id}/message`, {
      from: AGENT_NAME,
      text: result
    });

    log(`Task ${task.id} completed`);
  } catch (e) {
    log(`Task ${task.id} failed: ${e.message}`);
    await request('POST', `/api/task/${task.id}/error`, {
      owner: AGENT_NAME,
      error: e.message
    }).catch(() => {});
  } finally {
    clearInterval(heartbeatTimer);
    activeTask = null;
  }
}

async function poll() {
  try {
    if (activeTask) return; // Already processing

    const data = await request('GET', `/api/tasks?agent=${AGENT_NAME}&status=pendiente`);
    if (!data.tasks || data.tasks.length === 0) return;

    // Sort by created (oldest first)
    const sorted = data.tasks.sort((a, b) => new Date(a.created) - new Date(b.created));
    const task = sorted[0];

    // Try to claim
    try {
      const claimed = await request('POST', `/api/task/${task.id}/claim`, { owner: AGENT_NAME });
      if (claimed.status === 'en_proceso') {
        await processTask(claimed);
      }
    } catch (e) {
      if (e.message?.includes('409')) {
        log(`Task ${task.id} already claimed by another agent`);
      } else {
        log(`Claim failed: ${e.message}`);
      }
    }
  } catch (e) {
    log(`Poll error: ${e.message}`);
  }
}

// Register agent
async function register() {
  try {
    await request('POST', '/api/ping', { agent: AGENT_NAME });
    log(`Registered with server`);
  } catch (e) {
    log(`Registration failed: ${e.message}`);
  }
}

// --- Socket.io DM listener ---
function connectSocket() {
  const socket = io(`${SERVER_URL}/enjambre`, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 2000,
    reconnectionAttempts: Infinity
  });

  socket.on('connect', () => {
    log(`Socket connected: ${socket.id}`);
    socket.emit('chat:join', { name: AGENT_NAME });
  });

  socket.on('agent:direct', (msg) => {
    if (msg.to !== AGENT_NAME) return;
    log(`[DM] ${msg.from} → ${msg.to}: ${msg.text}`);
    if (msg.task_id) {
      log(`[DM] Related task: ${msg.task_id}`);
    }
  });

  socket.on('disconnect', (reason) => {
    log(`Socket disconnected: ${reason}`);
  });

  socket.on('connect_error', (err) => {
    log(`Socket error: ${err.message}`);
  });

  return socket;
}

log(`Starting agent (server: ${SERVER_URL})`);

process.on('unhandledRejection', (err) => {
  log(`Unhandled rejection: ${err.message || err}`);
});

await register();
connectSocket();
setInterval(poll, POLL_INTERVAL);
poll().catch(e => log(`Initial poll error: ${e.message}`));
