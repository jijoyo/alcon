import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { get as getDb } from '../db/connection.js';
import { STOP_WORDS } from '../config/stopWords.js';
import {
  AGENTS, agentRunning, presence, PRESENCE_TIMEOUT_MS, PRESENCE_CHECK_MS,
  isAgentAlive, now, broadcastPresence
} from '../lib/shared.js';

function log(msg) { console.log(`[${new Date().toISOString()}] [CHAT] ${msg}`); }

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// FIX CRÍTICO L17: chat.js está en server/routes/, granja.json en server/lib/
let GRANJA_SQUADS = [];
let granjaCache = {};
try{
  const granjaPath = path.join(__dirname, '..', 'lib', 'granja.json');
  granjaCache = JSON.parse(fs.readFileSync(granjaPath, 'utf8'));
  GRANJA_SQUADS = Object.keys(granjaCache.squads || {});
  log(`squads cargados desde ${granjaPath}: ${GRANJA_SQUADS.join(', ')}`);
} catch(e){
  log(`no granja.json, usando fallback: ${e.message}`);
  GRANJA_SQUADS = ['quick-review','code-audit','research-deep','architecture','mithos-cap','youtube-auto','memory-consolidation','deploy'];
}

export function registerChat(io) {
  const chatNs = io.of('/enjambre');

  // Floor system COMPARTIDO entre todas las conexiones (scope namespace, no por-socket)
  const floor = { owner: null, timeout: null, queue: [] };
  const FLOOR_TIMEOUT_MS = 60_000;

  // Duelo: evaluado muteado (Fase B paredón)
  const dueloMuted = new Set();

  function emitFloor() {
    chatNs.emit('floor:update', { owner: floor.owner, queue: floor.queue });
  }

  function grantFloor(agent) {
    floor.owner = agent;
    floor.queue = floor.queue.filter(a => a !== agent);
    clearTimeout(floor.timeout);
    floor.timeout = setTimeout(() => {
      log(`[FLOOR] Timeout for ${floor.owner}, releasing`);
      floor.owner = null;
      if (floor.queue.length > 0) grantFloor(floor.queue.shift());
      emitFloor();
    }, FLOOR_TIMEOUT_MS);
    emitFloor();
  }

  chatNs.on('connection', (socket) => {
    socket.on('chat:join', ({ name, sessionId }) => {
      const isAgent = socket.handshake.auth?.isAgent === true;
      if (isAgent) {
        for (const [existingId, existingP] of presence) {
          if (existingP.name === name && existingId !== socket.id) {
            const oldSocket = chatNs.sockets.get(existingId);
            if (oldSocket) {
              console.log(`[presence] kicking duplicate agent ${name} oldSocket=${oldSocket.id}`);
              oldSocket.disconnect(true);
            }
            presence.delete(existingId);
          }
        }
      }
      presence.set(socket.id, { name: name||'user', sessionId, isAgent, status:'vivo', lastSeen:Date.now(), typing:false });
      const db = getDb();
      socket.emit('chat:history', db.prepare('SELECT * FROM chat ORDER BY timestamp ASC').all());
      broadcastPresence(chatNs);
    });

    socket.on('chat:message', async ({ from, text }) => {
      if (!from || !text) return;
      if (dueloMuted.has(from)) {
        log(`[DUELO-MUTE] bloqueado ${from}: ${text.slice(0,60)}`);
        return;
      }
      const db = getDb();
      const chatMsg = { id: crypto.randomUUID(), from, text, timestamp: now() };
      db.prepare('INSERT INTO chat (id, from_agent, text, timestamp) VALUES (?, ?, ?, ?)').run(chatMsg.id, from, text, chatMsg.timestamp);
      chatNs.emit('chat:message', chatMsg);

      if (from === 'vps') return;

      const tagMatch = text.match(/^@(\w[\w-]*)\s/);
      if(!tagMatch) {
        const isAgentSender = AGENTS.includes(from);
        if (isAgentSender) return;
        chatNs.emit('agent:direct', { id: crypto.randomUUID(), from, to: 'vps', text, task_id: null, timestamp: now() });
        return;
      }

      const tag = tagMatch[1];

      if (tag === 'triage') {
        let prompt = text.replace(/^@[\w-]+\s*/, '').trim();
        if (!prompt) return;
        try {
          const res = await fetch('http://127.0.0.1:3006/triage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ task: prompt }) });
          const j = await res.json();
          const reply = `triage: ${j.triage} (via ${j.source})`;
          const tmsg = { id: crypto.randomUUID(), from: 'tagger', text: reply, timestamp: now() };
          db.prepare('INSERT INTO chat (id, from_agent, text, timestamp) VALUES (?, ?, ?, ?)').run(tmsg.id, tmsg.from, tmsg.text, tmsg.timestamp);
          chatNs.emit('chat:message', tmsg);
        } catch (e) {
          chatNs.emit('chat:message', { id: crypto.randomUUID(), from: 'tagger', text: `triage error: ${e.message}`, timestamp: now() });
        }
        return;
      }

      // === RAMA D HÍBRIDO: SQUAD DETECTION ===
      if (GRANJA_SQUADS.includes(tag)) {
        const squad = tag;
        let prompt = text.replace(/^@[\w-]+\s*/, '').trim();
        
        // parse overrides --local --cloud --auto --device=
        let backendOverride = null;
        let deviceFilter = null;
        if (prompt.includes('--local')) { backendOverride = 'llama'; prompt = prompt.replace('--local','').trim(); }
        else if (prompt.includes('--cloud')) { backendOverride = 'opencode'; prompt = prompt.replace('--cloud','').trim(); }
        else if (prompt.includes('--auto')) { backendOverride = 'auto'; prompt = prompt.replace('--auto','').trim(); }
        const m = prompt.match(/--device=([\w,]+)/);
        if (m) { deviceFilter = m[1].split(',').map(d=>d.trim()); prompt = prompt.replace(m[0],'').trim(); }

        if(!prompt) return;
        log(`[SQUAD-CHAT] ${from} → ${squad} [${backendOverride||'auto'}] [${deviceFilter||'all'}]: ${prompt.slice(0,80)}`);

        // SINGLE TASK PER SQUAD - no duplicar
        const existing = db.prepare("SELECT id FROM tasks WHERE squad=? AND status='en_proceso' ORDER BY id DESC LIMIT 1").get(squad);
        let taskId;
        if(existing){
          taskId = existing.id;
          db.prepare("UPDATE tasks SET text=text || char(10) || '→ ' || ?, updated_at=datetime('now') WHERE id=?").run(prompt, taskId);
        } else {
          taskId = db.prepare("INSERT INTO tasks (text, original_text, squad, status, assigned_to, created) VALUES (?, ?, ?, 'en_proceso', 'orchestrator', datetime('now'))").run(`@${squad} ${prompt}`, text, squad).lastInsertRowid;
        }

        chatNs.emit('typing:start');
        chatNs.emit('task:updated', { id: taskId, status: 'en_proceso', squad });

        try{
          const { handleSquadMessage, squadSessions } = await import('../lib/orchestrator.js');
          if(squadSessions && squadSessions.has(squad)) squadSessions.get(squad).taskId = taskId;
          const response = await handleSquadMessage(squad, prompt, from, { backendOverride, deviceFilter });
          const doneTs = new Date().toISOString();
          db.prepare("UPDATE tasks SET status='hecho', result=?, completed_at=datetime('now'), stage='done', stage_updated_at=? WHERE id=?").run(response, doneTs, taskId);
          
          // MEMORY PERSISTENCE
          try{
            const dir = path.join(__dirname, '..', 'lib', 'memory', 'conversations');
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            const file = path.join(dir, `${squad}.json`);
            let hist = [];
            if (fs.existsSync(file)) hist = JSON.parse(fs.readFileSync(file,'utf8')).messages || [];
            hist.push({ role:'user', content: prompt, from, ts: doneTs }, { role:'assistant', content: response, squad, ts: doneTs });
            if (hist.length > 100) hist = hist.slice(-100);
            fs.writeFileSync(file, JSON.stringify({ squad, messages: hist, updated: doneTs }, null, 2));
          } catch(e){ log(`memory save error: ${e.message}`); }

          const squadMsg = { id: crypto.randomUUID(), from: squad, text: response.slice(0,2000), timestamp: doneTs };
          db.prepare('INSERT INTO chat (id, from_agent, text, timestamp) VALUES (?, ?, ?, ?)').run(squadMsg.id, squadMsg.from, squadMsg.text, squadMsg.timestamp);

          chatNs.emit('typing:stop');
          chatNs.emit('chat:message', squadMsg);
          chatNs.emit('task:updated', { id: taskId, status: 'hecho', stage: 'done' });

        } catch(e){
          log(`[SQUAD-CHAT] error ${e.message}`);
          chatNs.emit('typing:stop');
          db.prepare("UPDATE tasks SET status='error', result=?, error_at=datetime('now') WHERE id=?").run(e.message, taskId);
          chatNs.emit('chat:message', { id: crypto.randomUUID(), from: squad, text: `Error: ${e.message}`, timestamp: now() });
          chatNs.emit('task:updated', { id: taskId, status: 'error' });
        }
        return;
      }

      if (tag === 'all') {
        const cleanText = text.replace(/^@all\s*/, '');
        for (const agent of AGENTS) {
          if (agentRunning[agent] && isAgentAlive(agent)) {
            chatNs.emit('agent:direct', { id: crypto.randomUUID(), from, to: agent, text: cleanText, task_id: null, timestamp: now() });
          }
        }
        return;
      }

      if (text.startsWith('/debate')) {
        const cleanText = text.replace(/^\/debate\s*/, '');
        for (const agent of AGENTS) {
          if (agentRunning[agent] && isAgentAlive(agent)) {
            chatNs.emit('agent:direct', { id: crypto.randomUUID(), from, to: agent, text: cleanText, task_id: null, timestamp: now() });
          }
        }
        return;
      }

      if (AGENTS.includes(tag)) {
        if (isAgentAlive(tag)) {
          chatNs.emit('agent:direct', { id: crypto.randomUUID(), from, to: tag, text: text.replace(/^@[\w-]+\s*/, ''), task_id: null, timestamp: now() });
        } else {
          chatNs.emit('chat:message', { id: crypto.randomUUID(), from: 'system', text: `${tag} no está disponible.`, timestamp: now() });
        }
        return;
      }

      const isAgentSender = AGENTS.includes(from);
      if (isAgentSender) return;
      chatNs.emit('agent:direct', { id: crypto.randomUUID(), from, to: 'vps', text, task_id: null, timestamp: now() });
    });

    socket.on('typing:start', () => { const p = presence.get(socket.id); if (p) { p.typing = true; p.lastSeen = Date.now(); } broadcastPresence(chatNs); });
    socket.on('typing:stop', () => { const p = presence.get(socket.id); if (p) { p.typing = false; p.lastSeen = Date.now(); } broadcastPresence(chatNs); });
    socket.on('chat:heartbeat', () => { const p = presence.get(socket.id); if (p) { p.lastSeen = Date.now(); if (p.status !== 'vivo') { p.status = 'vivo'; broadcastPresence(chatNs); } } });
    socket.on('presence:request', () => broadcastPresence(chatNs));

    // Floor system — handlers por-socket que referencian el floor COMPARTIDO del namespace
    socket.on('floor:request', ({ name }) => {
      if (!name) return;
      if (!floor.owner) {
        grantFloor(name);
        log(`[FLOOR] Granted to ${name}`);
      } else if (floor.owner === name) {
        // Extend timeout
        clearTimeout(floor.timeout);
        floor.timeout = setTimeout(() => {
          floor.owner = null;
          if (floor.queue.length > 0) grantFloor(floor.queue.shift());
          emitFloor();
        }, FLOOR_TIMEOUT_MS);
      } else {
        if (!floor.queue.includes(name)) floor.queue.push(name);
        log(`[FLOOR] ${name} queued (owner: ${floor.owner})`);
        emitFloor();
      }
    });

    socket.on('floor:release', ({ name }) => {
      if (!name || floor.owner !== name) return;
      clearTimeout(floor.timeout);
      floor.owner = null;
      log(`[FLOOR] Released by ${name}`);
      if (floor.queue.length > 0) grantFloor(floor.queue.shift());
      emitFloor();
    });

    // Duelo Fase B: paredón mute
    socket.on('duel:mute', ({ agent }) => {
      if (!agent) return;
      dueloMuted.add(agent);
      log(`[DUELO] mute ${agent}`);
      chatNs.emit('duel:update', { muted: Array.from(dueloMuted) });
    });
    socket.on('duel:unmute', ({ agent }) => {
      if (!agent) return;
      dueloMuted.delete(agent);
      log(`[DUELO] unmute ${agent}`);
      chatNs.emit('duel:update', { muted: Array.from(dueloMuted) });
    });
    socket.on('duel:status', () => {
      socket.emit('duel:update', { muted: Array.from(dueloMuted) });
    });

    socket.on('agent:comms', (msg) => {
      if (!msg || !msg.from || !msg.to || !msg.text) return;
      if (dueloMuted.has(msg.from)) {
        log(`[DUELO-MUTE] comms bloqueado ${msg.from} → ${msg.to}`);
        return;
      }
      log(`[COMMS] ${msg.from} → ${msg.to}: ${msg.text.slice(0, 100)}`);
      const db = getDb();
      const commsMsg = { id: crypto.randomUUID(), from: msg.from, text: `[comms→${msg.to}] ${msg.text}`, timestamp: now() };
      db.prepare('INSERT INTO chat (id, from_agent, text, timestamp) VALUES (?, ?, ?, ?)').run(commsMsg.id, commsMsg.from, commsMsg.text, commsMsg.timestamp);
      chatNs.emit('chat:message', commsMsg);
      chatNs.emit('agent:comms', { id: crypto.randomUUID(), from: msg.from, to: msg.to, text: msg.text, timestamp: now() });
    });

    socket.on('disconnect', () => { const p = presence.get(socket.id); if (p) { p.status = 'muerto'; p.typing = false; } presence.delete(socket.id); broadcastPresence(chatNs); });
  });

  setInterval(() => {
    const nowMs = Date.now();
    let changed = false;
    for (const [id, p] of presence) {
      if (p.status !== 'muerto' && nowMs - p.lastSeen > PRESENCE_TIMEOUT_MS) {
        p.status = 'muerto';
        p.typing = false;
        changed = true;
      }
    }
    if (changed) broadcastPresence(chatNs);
  }, PRESENCE_CHECK_MS);
}
