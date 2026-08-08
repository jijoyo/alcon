#!/usr/bin/env node

// Alcon Agent — socket.io DM listener + opencode execution
// Usage: node agent.js <agent-name> <server-url>

import { io } from 'socket.io-client';
import { execa } from 'execa';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const AGENT_NAME = process.argv[2] || 'kali';
const SERVER_URL = process.argv[3] || 'http://100.102.63.30:3002';
const OPENCODE_BIN = process.env.OPENCODE_BIN || '/data/data/com.termux/files/usr/bin/opencode';
const WORKDIR = process.env.WORKDIR || '/data/data/com.termux/files/home/alcon';
const AGENTS_DIR = path.join(WORKDIR, 'agents');

const BASH_REGEX = /^(ls|cat|pwd|echo|find|head|tail|grep|ps|df|du|whoami|uname|wc|sort|uniq|date|hostname|id|env|which|file|stat|mkdir|rm|cp|mv|chmod|chown|touch|ln|readlink|basename|dirname|realpath|mktemp|tee|xargs|tr|cut|sed|awk|diff|patch|tar|gzip|gunzip|zip|unzip|curl|wget|ssh|scp|rsync|ping|dig|nslookup|netstat|ss|ip|ifconfig|route|iptables|crontab|systemctl|journalctl|dmesg|lsblk|fdisk|mount|umount|lsof|fuser|kill|killall|nohup|screen|tmux|bg|fg|jobs|wait|sleep|yes|seq|rev|base64|md5sum|sha256sum|cksum|wc|iconv|fmt|fold|paste|join|split|csplit|comm|tee|stdbuf|timeout|nice|ionice|taskset|numactl|chroot|unshare|nsenter|capsh|setcap|getcap|ldd|strace|ltrace|perf|bpftrace|SystemTap|dtrace|flock|sync|fsync|fdatasync|fallocate|fadvise|finit_module|delete_module|kexec|reboot|shutdown|halt|poweroff|init|telinit|runlevel|who|w|last|lastb|ac|lastlog|faillog|journal|logger|syslog|rsyslog|logrotate|cron|at|batch|anacron|anacrontab|plocate|locate|updatedb|mknod|MAKEDEV|fsck|e2fsck|mkfs|mkswap|swapon|swapoff|blkid|findblk|blockdev|hdparm|sdparm|smartctl|badblocks|e2label|tune2fs|debugfs|dumpe2fs|e2image|e2undo|logsave|resize2fs|e4defrag|fallocate|fadvise|finit_module|delete_module|kexec|reboot|shutdown|halt|poweroff|init|telinit|runlevel|who|w|last|lastb|ac|lastlog|faillog|journal|logger|syslog|rsyslog|logrotate|cron|at|batch|anacron|anacrontab|plocate|locate|updatedb|mknod|MAKEDEV|fsck|e2fsck|mkfs|mkswap|swapon|swapoff|blkid|findblk|blockdev|hdparm|sdparm|smartctl|badblocks|e2label|tune2fs|debugfs|dumpe2fs|e2image|e2undo|logsave|resize2fs|e4defrag)\b/i;
const FAST_REGEX = /^(hola|ping|ruta|pwd)/i;

function log(msg) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${AGENT_NAME}] ${msg}`);
}

function fastReply(text) {
  if (FAST_REGEX.test(text)) {
    const pwd = execSync('pwd', { encoding: 'utf8' }).trim();
    return `${AGENT_NAME}: ${pwd}`;
  }
  return null;
}

function uploadArtifact(taskId, output) {
  try {
    const tmpfile = path.join(os.tmpdir(), `artifact-${taskId}-${Date.now()}.txt`);
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

    const rawCmd = msg.text.replace(/^@\w+\s*/, '').trim();
    const taskText = rawCmd;

    // 1. BASH fast-path (sin IA)
    if (BASH_REGEX.test(taskText) || /^(ls -la|cat |pwd|echo )/.test(taskText)) {
      try {
        log(`[BASH] Running: ${taskText}`);
        socket.emit('typing:start');
        const result = execSync(taskText, { cwd: WORKDIR, encoding: 'utf-8', timeout: 10000, maxBuffer: 1024 * 1024 });
        socket.emit('typing:stop');
        socket.emit('chat:message', { from: AGENT_NAME, text: result.slice(0, 2000) });
        log(`[BASH] Done (${result.length} chars)`);
        if (msg.task_id && result.length > 100) {
          uploadArtifact(msg.task_id, result);
        }
      } catch (e) {
        socket.emit('typing:stop');
        socket.emit('chat:message', { from: AGENT_NAME, text: `Error: ${e.message}` });
        log(`[BASH] Error: ${e.message}`);
      }
      return;
    }

    // 2. FAST regex (hola/ping/ruta/pwd)
    const fast = fastReply(taskText);
    if (fast) {
      log(`[FAST] ${fast}`);
      socket.emit('typing:stop');
      socket.emit('chat:message', { from: AGENT_NAME, text: fast });
      return;
    }

    // 3. Opencode fallback (con timeout 60s y modelo air)
    try {
      log(`[OPENCODE] Running: ${taskText}`);
      socket.emit('typing:start');
      const prompt = `Tarea: ${taskText}\nResponde en español, corto.`;
      const result = await execa(OPENCODE_BIN, ['run', '--model', 'opencode/glm-4.5-air-free', '--max-turns', '2', '--dir', AGENTS_DIR, prompt], {
        cwd: AGENTS_DIR,
        timeout: 60_000
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
