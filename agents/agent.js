#!/usr/bin/env node

// Alcon Agent — socket.io DM listener + opencode execution
// Usage: node agent.js <agent-name> <server-url>

import { io } from 'socket.io-client';
import { execa } from 'execa';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const AGENT_NAME = process.argv[2] || 'kali';
const SERVER_URL = process.argv[3] || 'http://100.102.63.30:3002';
const OPENCODE_BIN = process.env.OPENCODE_BIN || '/data/data/com.termux/files/usr/bin/opencode';
const WORKDIR = process.env.WORKDIR || '/data/data/com.termux/files/home/alcon';
const AGENTS_DIR = path.join(WORKDIR, 'agents');

function log(msg) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${AGENT_NAME}] ${msg}`);
}

function fastReply(text) {
  if (/^(hola|ping|ruta|pwd)/i.test(text)) {
    const pwd = execSync('pwd', { encoding: 'utf8' }).trim();
    return `${AGENT_NAME}: ${pwd}`;
  }
  return null;
}

function uploadArtifact(taskId, output) {
  try {
    const tmpfile = `/tmp/artifact-${taskId}-${Date.now()}.txt`;
    fs.writeFileSync(tmpfile, output);
    execSync(`curl -s -F "file=@${tmpfile}" ${SERVER_URL}/api/task/${taskId}/artifact`, { timeout: 10000 });
    fs.unlinkSync(tmpfile);
    log(`[ARTIFACT] Uploaded for task ${taskId}`);
  } catch (e) {
    log(`[ARTIFACT] Upload failed: ${e.message}`);
  }
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
        execSync('cd ~/alcon && git pull origin cel-experimental', { timeout: 30000 });
        log(`[DEPLOY] git pull OK`);
        execSync('pm2 restart all', { timeout: 10000 });
        log(`[DEPLOY] pm2 restart all OK`);
        socket.emit('chat:message', { from: 'cel', text: 'auto-deploy hecho' });
      } catch (e) {
        log(`[DEPLOY] Error: ${e.message}`);
        socket.emit('chat:message', { from: 'cel', text: `auto-deploy falló: ${e.message}` });
      }
      return;
    }

    // Fast-path: respuestas simples sin IA
    const fast = fastReply(msg.text);
    if (fast) {
      log(`[FAST] ${fast}`);
      socket.emit('typing:stop');
      socket.emit('chat:message', { from: AGENT_NAME, text: fast });
      return;
    }

    // Execute via opencode
    try {
      log(`[OPENCODE] Running: ${msg.text}`);
      socket.emit('typing:start');
      const prompt = `Tarea: ${msg.text}\nResponde en español, corto.`;
      const result = await execa(OPENCODE_BIN, ['run', '--model', 'opencode/mimo-v2.5-free', '--dir', AGENTS_DIR, prompt], {
        cwd: AGENTS_DIR,
        timeout: 120_000
      });
      const output = result.stdout || '(sin output)';
      socket.emit('typing:stop');
      socket.emit('chat:message', { from: AGENT_NAME, text: output.slice(0, 2000) });
      log(`[OPENCODE] Done (${output.length} chars)`);
      if (output.length > 100 && msg.task_id) {
        uploadArtifact(msg.task_id, output);
      }
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
