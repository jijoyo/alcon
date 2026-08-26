#!/usr/bin/env node

// Alcon Agent — socket.io DM listener + opencode execution
// Usage: node agent.js <agent-name> <server-url>

import { io } from 'socket.io-client';
import { execSync, spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import { AGENTS } from '../server/config/agents.js';
import path from 'path';
import os from 'os';
import { STOP_WORDS } from '../server/config/stopWords.js';
import { checkPermiso } from '../server/lib/permisos.js';

const AGENT_NAME = process.argv[2] || 'kali';
const SERVER_URL = process.argv[3] || 'http://100.102.63.30:3003';
const isTermux = process.env.PREFIX?.includes('com.termux');

const SYSTEM_PROMPTS = {
  'vps': `Eres el agente VPS del enjambre Alcon. REGLAS:
1. PROACTIVO PARA LEER: al recibir CUALQUIER mensaje, ejecuta: git status, pm2 status, lee HANDOFF.md si existe. Resume estado en 5 líneas máximo.
2. NUNCA hagas acciones de escritura (git add/commit/push, npm build, deploy.sh, rm, ALTER TABLE, cambios en server.js) sin que el usuario diga explícitamente "sí", "hazlo", "procede", "deploy" o "@vps haz X".
3. Cuando digan "hola", solo saluda + resumen + pregunta ¿qué necesitas? No inicies auditorías automáticamente.
4. Mantén el Interruptor Maestro respetado: si un agente está en Inactivo, no lo uses.
5. COMMS: Para hablar con otro agente, escribí una línea con el formato: [COMMS:nombre_agente] mensaje Ejemplo: [COMMS:debian] ¿puedo hacer push a main? Esto enviará un mensaje directo a ese agente.`,
  'vps-agent': `Eres el agente VPS del enjambre Alcon. REGLAS:
1. PROACTIVO PARA LEER: al recibir CUALQUIER mensaje, ejecuta: git status, pm2 status, lee HANDOFF.md si existe. Resume estado en 5 líneas máximo.
2. NUNCA hagas acciones de escritura (git add/commit/push, npm build, deploy.sh, rm, ALTER TABLE, cambios en server.js) sin que el usuario diga explícitamente "sí", "hazlo", "procede", "deploy" o "@vps haz X".
3. Cuando digan "hola", solo saluda + resumen + pregunta ¿qué necesitas? No inicies auditorías automáticamente.
4. Mantén el Interruptor Maestro respetado: si un agente está en Inactivo, no lo uses.
5. COMMS: Para hablar con otro agente, escribí una línea con el formato: [COMMS:nombre_agente] mensaje Ejemplo: [COMMS:debian] ¿puedo hacer push a main? Esto enviará un mensaje directo a ese agente.`,
  'debian': `Eres debian, agente de desarrollo del enjambre Alcon. REGLAS:
1. Enfócate en código, debugging, refactoring, y desarrollo general.
2. Puedes ejecutar comandos bash, escribir archivos, y usar git.
3. Consulta con otros agentes antes de cambios grandes en el server.
4. Cuando digan "hola", solo saluda y pregunta qué necesitas.
5. COMMS: Para hablar con otro agente, escribí una línea con el formato: [COMMS:nombre_agente] mensaje Ejemplo: [COMMS:vps] ¿puedo hacer deploy? Esto enviará un mensaje directo a ese agente.`,
  'kali': `Eres kali, agente orquestador del enjambre Alcon. REGLAS:
1. Enfócate en builds, debugging, git, y desarrollo.
2. Puedes ejecutar comandos bash y usar git.
3. Coordiná con otros agentes para tareas complejas.
4. Cuando digan "hola", solo saluda y pregunta qué necesitas.
5. COMMS: Para hablar con otro agente, escribí una línea con el formato: [COMMS:nombre_agente] mensaje Ejemplo: [COMMS:debian] revisá el PR #5 Esto enviará un mensaje directo a ese agente.`,
  'cel': `Eres cel, agente móvil del enjambre Alcon. REGLAS:
1. Enfócate en testing físico, Capacitor, y problemas de UI móvil.
2. No ejecutes comandos bash — reportá problemas a otros agentes.
3. Cuando digan "hola", solo saluda y pregunta qué necesitas.
4. COMMS: Para hablar con otro agente, escribí una línea con el formato: [COMMS:nombre_agente] mensaje Ejemplo: [COMMS:kali] hay un bug en el login Esto enviará un mensaje directo a ese agente.`,
  'cel2': `Eres cel2 (note-12s), agente móvil reviewer del enjambre Alcon. REGLAS:
1. Reviewer edge: lees código, reportas problemas de UI móvil y testing. Tienes más RAM que cel — puedes correr opencode con comodidad.
2. Bash solo lectura (git status/log, ls, cat). Nada de escritura ni push — eso es de forja.
3. Cuando digan "hola", saluda breve y pregunta qué necesitas.
4. COMMS: formato [COMMS:nombre_agente] mensaje. Ejemplo: [COMMS:cel] probaste el build de Capacitor?
5. Tu sesión opencode es persistente — recuerdas conversaciones anteriores.`,
};
const OPENCODE_BIN = isTermux
  ? '/data/data/com.termux/files/usr/bin/opencode'
  : (process.env.OPENCODE_BIN || path.join(os.homedir(), '.opencode/bin/opencode'));
const WORKDIR = isTermux
  ? '/data/data/com.termux/files/home/alcon'
  : (process.env.ALCON_WORKDIR || path.join(os.homedir(), 'Documentos/alcon'));
const AGENTS_DIR = path.join(WORKDIR, 'agents');

// === Sesión persistente por agente (memoria a largo plazo) ===
const SESSION_FILE = path.join(AGENTS_DIR, `.session-${AGENT_NAME}.txt`);
const AGENT_TITLE = `enjambre-${AGENT_NAME}`;
let SESSION_ID = null;
try { SESSION_ID = fs.readFileSync(SESSION_FILE, 'utf8').trim() || null; } catch {}

function findSessionIdByTitle() {
  try {
    const dbPath = path.join(os.homedir(), '.local/share/opencode/opencode.db');
    const out = execSync(`sqlite3 "${dbPath}" "SELECT id FROM session WHERE title='${AGENT_TITLE}' ORDER BY rowid DESC LIMIT 1"`, { encoding: 'utf8', timeout: 5000 });
    return out.trim() || null;
  } catch { return null; }
}

function persistSessionId() {
  if (SESSION_ID) return;
  const id = findSessionIdByTitle();
  if (id) {
    SESSION_ID = id;
    try { fs.writeFileSync(SESSION_FILE, id); } catch {}
    log(`[SESION] ${AGENT_NAME} persiste sesión ${id}`);
  }
}

function buildOpencodeArgs(prompt) {
  const args = ['run', '-m', 'opencode/mimo-v2.5-free', '--dir', WORKDIR, '--auto'];
  if (SESSION_ID) args.push('-s', SESSION_ID);
  else args.push('--title', AGENT_TITLE);
  args.push(prompt);
  return args;
}
// === fin sesión persistente ===

const BASH_REGEX = /^(ls|cat|pwd|echo|find|head|tail|grep|ps|df|du|whoami|uname|wc|sort|uniq|date|hostname|id|env|which|file|stat|mkdir|rm|cp|mv|chmod|chown|touch|ln|readlink|basename|dirname|realpath|mktemp|tee|xargs|tr|cut|sed|awk|diff|patch|tar|gzip|gunzip|zip|unzip|curl|wget|ssh|scp|rsync|ping|dig|nslookup|netstat|ss|ip|ifconfig|route|iptables|crontab|systemctl|journalctl|dmesg|lsblk|fdisk|mount|umount|lsof|fuser|kill|killall|nohup|screen|tmux|bg|fg|jobs|wait|sleep|yes|seq|rev|base64|md5sum|sha256sum|cksum|wc|iconv|fmt|fold|paste|join|split|csplit|comm|tee|stdbuf|timeout|nice|ionice|taskset|numactl|chroot|unshare|nsenter|capsh|setcap|getcap|ldd|strace|ltrace|perf|bpftrace|SystemTap|dtrace|flock|sync|fsync|fdatasync|fallocate|fadvise|finit_module|delete_module|kexec|reboot|shutdown|halt|poweroff|init|telinit|runlevel|who|w|last|lastb|ac|lastlog|faillog|journal|logger|syslog|rsyslog|logrotate|cron|at|batch|anacron|anacrontab|plocate|locate|updatedb|mknod|MAKEDEV|fsck|e2fsck|mkfs|mkswap|swapon|swapoff|blkid|findblk|blockdev|hdparm|sdparm|smartctl|badblocks|e2label|tune2fs|debugfs|dumpe2fs|e2image|e2undo|logsave|resize2fs|e4defrag|fallocate|fadvise|finit_module|delete_module|kexec|reboot|shutdown|halt|poweroff|init|telinit|runlevel|who|w|last|lastb|ac|lastlog|faillog|journal|logger|syslog|rsyslog|logrotate|cron|at|batch|anacron|anacrontab|plocate|locate|updatedb|mknod|MAKEDEV|fsck|e2fsck|mkfs|mkswap|swapon|swapoff|blkid|findblk|blockdev|hdparm|sdparm|smartctl|badblocks|e2label|tune2fs|debugfs|dumpe2fs|e2image|e2undo|logsave|resize2fs|e4defrag)\b/i;
const FAST_REGEX = /^(hola|ping|ruta|pwd)/i;

function log(msg) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${AGENT_NAME}] ${msg}`);
}

let currentFloor = null;
let floorQueue = [];

function sendComms(socket, to, text) {
  socket.emit('agent:comms', {
    from: AGENT_NAME,
    to,
    text,
    timestamp: new Date().toISOString()
  });
  log(`[COMMS] Sent to ${to}: ${text.slice(0, 80)}`);
}

function requestFloor(socket) {
  socket.emit('floor:request', { name: AGENT_NAME });
}

function releaseFloor(socket) {
  socket.emit('floor:release', { name: AGENT_NAME });
}

function waitForFloor(socket) {
  return new Promise((resolve) => {
    if (currentFloor === AGENT_NAME) { resolve(true); return; }
    requestFloor(socket);
    const check = setInterval(() => {
      if (currentFloor === AGENT_NAME) {
        clearInterval(check);
        resolve(true);
      }
    }, 500);
    setTimeout(() => { clearInterval(check); resolve(false); }, 30_000);
  });
}

function fastReply(text) {
  if (/^hola/i.test(text)) {
    return `${AGENT_NAME}: ¡Hola! ¿Cómo estás? ¿Qué necesitas?`;
  }
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

function claimTask(taskId, owner) {
  if (!taskId) return;
  try {
    execSync(`curl -s -X POST ${SERVER_URL}/api/task/${taskId}/claim -H "Content-Type: application/json" -d '${JSON.stringify({ owner })}'`, { timeout: 10000 });
    log(`[CLAIM] Task ${taskId} claimed by ${owner}`);
  } catch (e) {
    log(`[CLAIM] Failed for ${taskId}: ${e.message}`);
  }
}

function completeTask(taskId, result, owner) {
  if (!taskId) return;
  try {
    const body = JSON.stringify({ owner, result: result?.slice(0, 5000) || '' });
    execSync(`curl -s -X POST ${SERVER_URL}/api/task/${taskId}/complete -H "Content-Type: application/json" -d '${body}'`, { timeout: 10000 });
    log(`[COMPLETE] Task ${taskId} marked done`);
  } catch (e) {
    log(`[COMPLETE] Failed for ${taskId}: ${e.message}`);
  }
}

function saveEngram(taskId, taskText, result, status) {
  try {
    const engramDir = path.join(WORKDIR, '.engram');
    if (!fs.existsSync(engramDir)) fs.mkdirSync(engramDir, { recursive: true });
    const file = path.join(engramDir, 'memoria.md');
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const block = `\n## ${ts} | ${AGENT_NAME} | ${status === 'ok' ? 'COMPLETADO' : 'ERROR'}\n\n- **Tarea ID:** ${taskId || 'N/A'}\n- **Resumen:** ${taskText.slice(0, 120)}\n- **Resultado:** ${(result || '').slice(0, 200)}\n- **Agente:** ${AGENT_NAME}\n---\n`;
    fs.appendFileSync(file, block);
    log(`[ENGRAM] Saved task ${taskId || 'N/A'}`);
  } catch (e) {
    log(`[ENGRAM] Save failed: ${e.message}`);
  }
}

function updateHandoffRoadmap(taskId, taskText, status) {
  try {
    const handoff = path.join(WORKDIR, 'HANDOFF.md');
    if (!fs.existsSync(handoff)) return;
    let content = fs.readFileSync(handoff, 'utf8');
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const entry = `| ${ts} | ${AGENT_NAME} | ${taskId || '-'} | ${taskText.slice(0, 60)} | ${status} |\n`;
    if (content.includes('## Últimas tareas completadas')) {
      content += entry;
    } else {
      content += `\n## Últimas tareas completadas\n\n| Fecha | Agente | Task ID | Descripción | Estado |\n|-------|--------|---------|-------------|--------|\n${entry}`;
    }
    fs.writeFileSync(handoff, content);
    log(`[HANDOFF] Roadmap updated`);
  } catch (e) {
    log(`[HANDOFF] Update failed: ${e.message}`);
  }
}

function fetchTaskMessages(taskId, limit = 5) {
  if (!taskId) return [];
  try {
    const raw = execSync(`curl -s ${SERVER_URL}/api/task/${taskId}/messages`, { encoding: 'utf-8', timeout: 5000 });
    const { messages } = JSON.parse(raw);
    return (messages || []).slice(-limit);
  } catch { return []; }
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
    if (msg.from === 'system') return;
    const mention = `@${AGENT_NAME}`;
    // Anti-doble: si la mención está al inicio, el server ya la ruteó via agent:direct
    if (msg.text.trimStart().startsWith(mention)) return;
    // Anti-eco: ignorar menciones dentro de citas (>) o código (`...` / ```)
    const limpio = msg.text
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`[^`]*`/g, '')
      .split('\n').filter(l => !l.trimStart().startsWith('>')).join('\n');
    if (limpio.includes(mention)) {
      log(`[CHAT] Mentioned by ${msg.from}: ${msg.text.slice(0, 80)}`);
      // Procesar directamente (no re-emitir agent:direct al server)
      const rawCmd = limpio.replace(/^@\w+\s*/, '').trim();
      
      // Fast replies
      if (/^hola/i.test(rawCmd)) {
        socket.emit('chat:message', { from: AGENT_NAME, text: `¡Hola ${msg.from}! ¿Qué necesitas?` });
        return;
      }
      
      // Comms pattern
      const commsMatch = rawCmd.match(/^\[COMMS:(\w+)\]\s*(.+)/);
      if (commsMatch) {
        const [, target, commsText] = commsMatch;
        if (AGENTS.includes(target)) {
          sendComms(socket, target, commsText);
          log(`[COMMS] Detected in chat → ${target}: ${commsText.slice(0, 80)}`);
        }
        return;
      }
      
      // BASH fast-path
      if (BASH_REGEX.test(rawCmd)) {
        const permCheck = checkPermiso(AGENT_NAME, rawCmd);
        if (!permCheck.allowed) {
          socket.emit('chat:message', { from: AGENT_NAME, text: `🚫 Bloqueado: ${permCheck.reason}` });
          return;
        }
        try {
          socket.emit('typing:start');
          const result = execSync(rawCmd, { cwd: WORKDIR, encoding: 'utf-8', timeout: 10000, maxBuffer: 1024 * 1024 });
          socket.emit('typing:stop');
          socket.emit('chat:message', { from: AGENT_NAME, text: result.slice(0, 2000) });
        } catch (e) {
          socket.emit('typing:stop');
          socket.emit('chat:message', { from: AGENT_NAME, text: `Error: ${e.message}` });
        }
        return;
      }
      
      // Opencode fallback
      socket.emit('chat:message', { from: AGENT_NAME, text: `Procesando: "${rawCmd.slice(0, 50)}..."` });
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

    if (msg.from === 'vps' || msg.from === msg.to || msg.from === AGENT_NAME || rawCmd.startsWith('vps:')) return;

    // Anti-loop: respuestas cortas sin crear task
    if (STOP_WORDS.test(rawCmd)) {
      console.log(`[FAST] STOP_WORDS match: ${rawCmd}`);
      const uptime = process.uptime().toFixed(0);
      socket.emit('chat:message', { from: AGENT_NAME, text: `¡Hola! ¿Qué necesitas? 📊 Todo online. Uptime: ${uptime}s - PID: ${process.pid}` });
      return;
    }

    // 1. BASH fast-path (sin IA)
    if (BASH_REGEX.test(taskText) || /^(ls -la|cat |pwd|echo )/.test(taskText)) {
      const permCheck = checkPermiso(AGENT_NAME, taskText);
      if (!permCheck.allowed) {
        socket.emit('typing:stop');
        socket.emit('chat:message', { from: AGENT_NAME, text: `🚫 Bloqueado por permisos: ${permCheck.reason}\nComando: \`${taskText}\`` });
        log(`[PERMISO] Bloqueado: ${taskText} — ${permCheck.reason}`);
        return;
      }
      claimTask(msg.task_id, AGENT_NAME);
      const needsPrefix = msg.text?.match(/^(@all|\/debate)/);
      const prefix = needsPrefix ? `[${AGENT_NAME}] ` : '';
      try {
        log(`[BASH] Running: ${taskText}`);
        socket.emit('typing:start');
        const result = execSync(taskText, { cwd: WORKDIR, encoding: 'utf-8', timeout: 10000, maxBuffer: 1024 * 1024 });
        socket.emit('typing:stop');
        socket.emit('chat:message', { from: AGENT_NAME, text: `${prefix}${result.slice(0, 2000)}` });
        log(`[BASH] Done (${result.length} chars)`);
        if (msg.task_id && result.length > 100) uploadArtifact(msg.task_id, result);
        completeTask(msg.task_id, result, AGENT_NAME);
        saveEngram(msg.task_id, taskText, result, 'ok');
        updateHandoffRoadmap(msg.task_id, taskText, 'done');
      } catch (e) {
        socket.emit('typing:stop');
        socket.emit('chat:message', { from: AGENT_NAME, text: `${prefix}Error: ${e.message}` });
        log(`[BASH] Error: ${e.message}`);
        completeTask(msg.task_id, `Error: ${e.message}`, AGENT_NAME);
      }
      return;
    }

    // 2. FAST regex (hola/ping/ruta/pwd)
    const fast = fastReply(taskText);
    if (fast) {
      claimTask(msg.task_id, AGENT_NAME);
      const needsPrefix = msg.text?.match(/^(@all|\/debate)/);
      const prefix = needsPrefix ? `[${AGENT_NAME}] ` : '';
      log(`[FAST] ${fast}`);
      socket.emit('typing:stop');
      socket.emit('chat:message', { from: AGENT_NAME, text: `${prefix}${fast}` });
      completeTask(msg.task_id, fast, AGENT_NAME);
      saveEngram(msg.task_id, taskText, fast, 'ok');
      updateHandoffRoadmap(msg.task_id, taskText, 'done');
      return;
    }

    // 3. Opencode fallback (timeout 15m)
    const opencodePerm = checkPermiso(AGENT_NAME, taskText);
    if (!opencodePerm.allowed) {
      socket.emit('chat:message', { from: AGENT_NAME, text: `🚫 Bloqueado por permisos: ${opencodePerm.reason}\nComando: \`${taskText}\`` });
      log(`[PERMISO] OpenCode bloqueado: ${taskText} — ${opencodePerm.reason}`);
      return;
    }
    claimTask(msg.task_id, AGENT_NAME);
    try {
      log(`[OPENCODE] Running: ${taskText}`);
      socket.emit('typing:start');
      const history = fetchTaskMessages(msg.task_id);
      const context = history.length > 0
        ? `Contexto previo del chat:\n${history.map(m => `${m.from_agent}: ${m.text}`).join('\n')}\n\n`
        : '';
      const systemPrompt = SYSTEM_PROMPTS[AGENT_NAME] || '';
      const systemSection = systemPrompt ? `[System Instructions]\n${systemPrompt}\n\n` : '';
      const prompt = `${systemSection}${context}Tarea: ${taskText}\nResponde en español, corto.`;
      const output = await new Promise((resolve, reject) => {
        const child = spawn(OPENCODE_BIN, buildOpencodeArgs(prompt), {
          cwd: WORKDIR,
          stdio: ['ignore', 'pipe', 'inherit']
        });
        let stdout = '';
        child.stdout.on('data', (data) => { stdout += data; });
        const timer = setTimeout(() => { child.kill(); reject(new Error('timeout')); }, 900_000);
        const heartbeat = setInterval(() => {
          try {
            execSync(`curl -s -X POST ${SERVER_URL}/api/task/${msg.task_id}/heartbeat -H "Content-Type: application/json" -d '${JSON.stringify({ owner: AGENT_NAME })}'`, { timeout: 5000 });
            log(`[HEARTBEAT] Task ${msg.task_id} extended`);
          } catch (e) {
            log(`[HEARTBEAT] Failed: ${e.message}`);
          }
        }, 30_000);
        child.on('close', (code) => {
          clearTimeout(timer);
          clearInterval(heartbeat);
          persistSessionId();
          code === 0 ? resolve(stdout || '(sin output)') : reject(new Error(`exit code ${code}`));
        });
        child.on('error', (err) => { clearTimeout(timer); clearInterval(heartbeat); reject(err); });
      });
      socket.emit('typing:stop');
      
      // Detectar comms en la salida: [COMMS:agente] mensaje
      const commsLines = output.match(/\[COMMS:(\w+)\]\s*(.+)/g);
      if (commsLines) {
        for (const line of commsLines) {
          const m = line.match(/\[COMMS:(\w+)\]\s*(.+)/);
          if (m) {
            const [, target, commsText] = m;
            if (AGENTS.includes(target)) {
              sendComms(socket, target, commsText);
              log(`[COMMS] Detected in output → ${target}: ${commsText.slice(0, 80)}`);
            }
          }
        }
        // Limpiar las líneas de comms del output antes de mostrar
        output = output.replace(/\[COMMS:\w+\]\s*.+/g, '').trim();
      }
      
      const needsPrefix = msg.text?.match(/^(@all|\/debate)/);
      const prefix = needsPrefix ? `[${AGENT_NAME}] ` : '';
      socket.emit('chat:message', { from: AGENT_NAME, text: `${prefix}${output.slice(0, 2000)}` });
      log(`[OPENCODE] Done (${output.length} chars)`);
      if (output.length > 100 && msg.task_id) uploadArtifact(msg.task_id, output);
      completeTask(msg.task_id, output, AGENT_NAME);
      saveEngram(msg.task_id, taskText, output, 'ok');
      updateHandoffRoadmap(msg.task_id, taskText, 'done');
    } catch (e) {
      log(`[OPENCODE] Error: ${e.message}`);
      socket.emit('typing:stop');
      const needsPrefix = msg.text?.match(/^(@all|\/debate)/);
      const prefix = needsPrefix ? `[${AGENT_NAME}] ` : '';
      socket.emit('chat:message', { from: AGENT_NAME, text: `${prefix}Error: ${e.message}` });
      completeTask(msg.task_id, `Error: ${e.message}`, AGENT_NAME);
      saveEngram(msg.task_id, taskText, e.message, 'error');
      updateHandoffRoadmap(msg.task_id, taskText, 'error');
    }
    // Release floor after responding
    releaseFloor(socket);
  });

  // Comms directas agent-to-agent (with floor control)
  socket.on('agent:comms', async (msg) => {
    if (msg.to !== AGENT_NAME) return;
    log(`[COMMS] ${msg.from} → ${msg.to}: ${msg.text.slice(0, 100)}`);
    const rawCmd = msg.text.replace(/^@\w+\s*/, '').trim();
    if (STOP_WORDS.test(rawCmd)) {
      socket.emit('chat:message', { from: AGENT_NAME, text: `Entendido, ${msg.from}.` });
      return;
    }
    // Request floor before replying
    const gotFloor = await waitForFloor(socket);
    if (!gotFloor) {
      log(`[COMMS] Floor timeout, replying anyway`);
    }
    // Reenviar como agent:direct para procesamiento normal
    socket.emit('agent:direct', {
      id: Date.now().toString(),
      from: msg.from,
      to: AGENT_NAME,
      text: msg.text,
      task_id: null,
      timestamp: new Date().toISOString()
    });
  });

  socket.on('disconnect', (reason) => {
    log(`Socket disconnected: ${reason}`);
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
    if (reason === 'io server disconnect') {
      log('Kicked by server, reconnecting in 5s...');
      setTimeout(() => {
        socket.connect();
        const keepalive = setInterval(() => {}, 10000);
        socket.once('connect', () => clearInterval(keepalive));
      }, 5000);
    }
  });

  socket.on('connect_error', (err) => {
    log(`Socket error: ${err.message}`);
  });

  socket.on('floor:update', (data) => {
    currentFloor = data.owner;
    floorQueue = data.queue || [];
    if (data.owner === AGENT_NAME) {
      log(`[FLOOR] You have the floor`);
    } else if (data.owner) {
      log(`[FLOOR] ${data.owner} has the floor, queue: [${data.queue.join(', ')}]`);
    }
  });

  return socket;
}

log(`Starting agent (server: ${SERVER_URL})`);

process.on('unhandledRejection', (err) => {
  log(`Unhandled rejection: ${err.message || err}`);
});

connectSocket();
