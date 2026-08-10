import crypto from 'crypto';
import { get as getDb } from '../db/connection.js';
import { STOP_WORDS } from '../config/stopWords.js';
import {
  AGENTS,
  agentRunning,
  presence,
  PRESENCE_TIMEOUT_MS,
  PRESENCE_CHECK_MS,
  isAgentAlive,
  now,
  broadcastPresence
} from '../lib/shared.js';

export function registerChat(io) {
  const chatNs = io.of('/enjambre');

  chatNs.on('connection', (socket) => {
    socket.on('chat:join', ({ name }) => {
      for (const [existingId, existingP] of presence) {
        if (existingP.name === name) {
          presence.delete(existingId);
          const oldSocket = chatNs.sockets.get(existingId);
          if (oldSocket) oldSocket.disconnect(true);
        }
      }
      presence.set(socket.id, { name:name||'user', status:'vivo', lastSeen:Date.now(), typing:false });
      const db = getDb();
      socket.emit('chat:history', db.prepare('SELECT * FROM chat ORDER BY timestamp ASC').all());
      broadcastPresence(chatNs);
    });

    socket.on('chat:message', ({ from, text }) => {
      if (!from || !text) return;
      const db = getDb();
      const chatMsg = { id: crypto.randomUUID(), from, text, timestamp: now() };
      db.prepare('INSERT INTO chat (id, from_agent, text, timestamp) VALUES (?, ?, ?, ?)').run(chatMsg.id, from, text, chatMsg.timestamp);
      chatNs.emit('chat:message', chatMsg);

      if (from === 'vps') return;

      const tagMatch = text.match(/^@(\w+)\s/);

      if (tagMatch && tagMatch[1] === 'all') {
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

      if (tagMatch && AGENTS.includes(tagMatch[1])) {
        const target = tagMatch[1];
        if (isAgentAlive(target)) {
          chatNs.emit('agent:direct', { id: crypto.randomUUID(), from, to: target, text: text.replace(/^@\w+\s*/, ''), task_id: null, timestamp: now() });
        } else {
          chatNs.emit('chat:message', { id: crypto.randomUUID(), from: 'system', text: `${target} no está disponible.`, timestamp: now() });
        }
        return;
      }

      const clean = text.replace(/^@\w+\s*/, '');
      if (STOP_WORDS.test(clean) || text.trim().length < 15) {
        chatNs.emit('agent:direct', { id: crypto.randomUUID(), from, to: 'vps', text, task_id: null, timestamp: now() });
        return;
      }

      chatNs.emit('agent:direct', { id: crypto.randomUUID(), from, to: 'vps', text, task_id: null, timestamp: now() });
    });

    socket.on('typing:start', () => { const p = presence.get(socket.id); if (p) { p.typing = true; p.lastSeen = Date.now(); } broadcastPresence(chatNs); });
    socket.on('typing:stop', () => { const p = presence.get(socket.id); if (p) { p.typing = false; p.lastSeen = Date.now(); } broadcastPresence(chatNs); });
    socket.on('chat:heartbeat', () => { const p = presence.get(socket.id); if (p) { p.lastSeen = Date.now(); if (p.status !== 'vivo') { p.status = 'vivo'; broadcastPresence(chatNs); } } });
    socket.on('presence:request', () => broadcastPresence(chatNs));
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
