import path from 'path';
import { fileURLToPath } from 'url';
import { get as getDb } from '../db/connection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ARTIFACTS_DIR = process.env.ARTIFACTS_DIR || path.join(__dirname, '..', 'artifacts');
export const LOCK_TIMEOUT_MS = 10 * 60 * 1000;
export const STALE_CHECK_INTERVAL_MS = 30 * 1000;
export const PRESENCE_TIMEOUT_MS = 15 * 1000;
export const PRESENCE_CHECK_MS = 5 * 1000;

export const STAGES = ['backlog', 'plan', 'implement', 'test', 'review', 'done'];
export const STAGE_TRANSITIONS = { backlog:'plan', plan:'implement', implement:'test', test:'review', review:'done', done:null };
export const REVERSE_TRANSITIONS = { plan:'backlog', implement:'plan', test:'implement', review:'test', done:'review', backlog:null };
export function advanceStage(current) { return STAGE_TRANSITIONS[current] || null; }
export function regressStage(current) { return REVERSE_TRANSITIONS[current] || null; }

export const KEYWORD_MAP = {
  vps: ['build','deploy','server','docker','pm2','database','supabase','api','backend','migrate','nginx','ssl','domain','dns'],
  kali: ['code','bug','fix','test','review','git','commit','merge','refactor','lint','typecheck','spec','implement','feature'],
  cel: ['screen','mobile','touch','capacitor','android','ios','app','apk','install','push','notification','camera','gps'],
  debian: ['forja','debian','linux','reina','distro','apt','systemd','ssh']
};

import { AGENTS } from '../config/agents.js';
export { AGENTS };
export const agentRunning = { kali:true, vps:true, cel:true, debian:true, hermes:true, alcon:true, 'cel-tui':true, cel2:true, 'montar-forja':true, radar:true, 'local-router':true };
export const commsEnabled = { kali:true, vps:true, cel:true, debian:true, hermes:true, alcon:true, 'cel-tui':true, cel2:true, 'montar-forja':true, radar:true, 'local-router':true };

export const presence = new Map();
export const activeSessions = new Map(); // { userId: taskId }

export function parseAgentFromText(text) {
  const tagMatch = text.match(/^@\s*(\w+)\s/);
  if (tagMatch && AGENTS.includes(tagMatch[1])) return { agent: tagMatch[1], cleanText: text.slice(tagMatch[0].length) };
  const lower = text.toLowerCase();
  for (const [agent, keywords] of Object.entries(KEYWORD_MAP)) {
    if (keywords.some(kw => lower.includes(kw))) return { agent, cleanText: text };
  }
  return { agent: 'kali', cleanText: text };
}

export function generateId() { return Date.now() * 1000 + Math.floor(Math.random() * 1000); }
export function now() { return new Date().toISOString(); }
export function isExpired(task) { return task.lock_expires_at ? new Date(task.lock_expires_at) < new Date() : false; }

export function formatTask(row) {
  if (!row) return null;
  const db = getDb();
  const messages = db.prepare('SELECT * FROM messages WHERE task_id = ? ORDER BY timestamp ASC').all(row.id);
  return { ...row, messages };
}

export function safeFilename(name) { return path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_'); }

export function parseDependencies(text) {
  const matches = text.match(/#(\d+)/g);
  if (!matches) return [];
  return [...new Set(matches.map(m => Number(m.slice(1))))];
}

export function isAgentAlive(name) {
  for (const [, p] of presence) {
    if (p.name === name && p.status === 'vivo') return true;
  }
  return agentRunning[name] || false;
}

export function cleanupSessionByTaskId(taskId) {
  for (const [userId, tId] of activeSessions) {
    if (tId === taskId) { activeSessions.delete(userId); break; }
  }
}

export function broadcastPresence(ns) {
  const byName = new Map();
  for (const [, p] of presence) byName.set(p.name, { name:p.name, status:p.status, typing:p.typing });
  for (const agent of AGENTS) { if (!byName.has(agent)) byName.set(agent, { name:agent, status:agentRunning[agent]?'idle':'muerto', typing:false }); }
  ns.emit('presence:update', { peers:Array.from(byName.values()) });
}
