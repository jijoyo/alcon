#!/usr/bin/env node

// Alcon Agent — socket.io DM listener + opencode execution
// Usage: node agent.js <agent-name> <server-url>

import { io } from 'socket.io-client';
import { execa } from 'execa';

const AGENT_NAME = process.argv[2] || 'kali';
const SERVER_URL = process.argv[3] || 'http://localhost:3002';
const OPENCODE_BIN = '/home/israel/.opencode/bin/opencode';
const WORKDIR = '/home/israel/Documentos/alcon';

function log(msg) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${AGENT_NAME}] ${msg}`);
}

function connectSocket() {
  const socket = io(`${SERVER_URL}/enjambre`, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 2000,
    reconnectionAttempts: Infinity
  });

  let heartbeatInterval = null;

  socket.on('connect', () => {
    log(`Socket connected: ${socket.id}`);
    socket.emit('chat:join', { name: AGENT_NAME });
    if (!heartbeatInterval) {
      heartbeatInterval = setInterval(() => socket.emit('chat:heartbeat'), 5000);
    }
  });

  socket.on('chat:message', (msg) => {
    if (msg.from === AGENT_NAME) return;
    const mention = `@${AGENT_NAME}`;
    if (msg.text.includes(mention)) {
      log(`[CHAT] Mentioned by ${msg.from}: ${msg.text.slice(0, 80)}`);
      socket.emit('chat:message', { from: AGENT_NAME, text: 'recibido' });
    }
  });

  socket.on('agent:direct', async (msg) => {
    if (msg.to !== AGENT_NAME) return;
    log(`[DM] ${msg.from} → ${msg.to}: ${msg.text}`);

    // Cel auto-deploy
    if (AGENT_NAME === 'cel' && msg.text === 'deploy') {
      log(`[DEPLOY] Iniciando auto-deploy...`);
      try {
        const { execSync } = await import('child_process');
        execSync('cd ~/alcon && git pull origin cel-experimental', { timeout: 30000 });
        log(`[DEPLOY] git pull OK`);
        execSync('pm2 restart all', { timeout: 10000 });
        log(`[DEPLOY] pm2 restart all OK`);
        socket.emit('chat:message', { from: 'cel', text: 'auto-deploy hecho ✅' });
      } catch (e) {
        log(`[DEPLOY] Error: ${e.message}`);
        socket.emit('chat:message', { from: 'cel', text: `auto-deploy falló: ${e.message}` });
      }
      return;
    }

    // Execute via opencode
    try {
      log(`[OPENCODE] Running: ${msg.text}`);
      socket.emit('typing:start');
      const result = await execa(OPENCODE_BIN, ['run', '--model', 'opencode/mimo-v2.5-free', msg.text], {
        cwd: WORKDIR,
        timeout: 300_000
      });
      const output = result.stdout || '(sin output)';
      socket.emit('typing:stop');
      socket.emit('chat:message', { from: AGENT_NAME, text: output.slice(0, 2000) });
      log(`[OPENCODE] Done (${output.length} chars)`);
    } catch (e) {
      log(`[OPENCODE] Error: ${e.message}`);
      socket.emit('typing:stop');
      socket.emit('chat:message', { from: AGENT_NAME, text: `Error: ${e.message}` });
    }
  });

  socket.on('disconnect', (reason) => {
    log(`Socket disconnected: ${reason}`);
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
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

connectSocket();
