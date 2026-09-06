#!/usr/bin/env node
// Genera docs/alcon-graph.json determinista desde granja.json + archivos clave.
// Sin dependencias: solo fs/path. No llama a la red ni a modelos.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const GRANJA_PATH = path.join(ROOT, 'server', 'lib', 'granja.json');
const GRAPH_PATH = path.join(ROOT, 'docs', 'alcon-graph.json');
const HTML_PATH = path.join(ROOT, 'docs', 'ARCHITECTURE.html');

function lineCount(file) {
  try {
    return fs.readFileSync(file, 'utf8').split('\n').length;
  } catch {
    return 0;
  }
}

function serviceNode(id, rel, role) {
  const file = path.join(ROOT, rel);
  return { id, file: rel, role, lines: lineCount(file) };
}

const granja = JSON.parse(fs.readFileSync(GRANJA_PATH, 'utf8'));
const granjaRel = 'server/lib/granja.json';
const granjaLines = lineCount(GRANJA_PATH);

const nodes = [
  serviceNode('svc:forja-router', granjaRel, 'infra'),
  serviceNode('svc:alcon-api', 'server/server.js', 'api'),
  serviceNode('svc:alcon-pwa', 'pwa/src/App.tsx', 'ui'),
  serviceNode('svc:go-orchestrator', 'server/go/orchestrator.go', 'orchestrator'),
];

for (const [name, device] of Object.entries(granja.devices || {})) {
  nodes.push({
    id: `device:${name}`,
    file: granjaRel,
    role: `device:${device?.role || device?.backend || 'llama'}`,
    lines: granjaLines,
  });
}

for (const [name] of Object.entries(granja.squads || {})) {
  nodes.push({
    id: `squad:${name}`,
    file: granjaRel,
    role: 'squad',
    lines: granjaLines,
  });
}

const edges = [
  { from: 'svc:alcon-api', to: 'svc:forja-router', type: 'call' },
  { from: 'svc:go-orchestrator', to: 'svc:forja-router', type: 'call' },
  { from: 'svc:alcon-pwa', to: 'svc:alcon-api', type: 'http', via: 'pwa/src/lib/api.ts: POST /api/task, GET /api/tasks, POST /api/task/:id/claim, POST /api/task/:id/heartbeat' },
  { from: 'svc:alcon-pwa', to: 'svc:alcon-api', type: 'socket', via: ':3003' },
];

for (const [squad, cfg] of Object.entries(granja.squads || {})) {
  edges.push({ from: 'svc:alcon-api', to: `squad:${squad}`, type: 'orchestrate' });
  for (const device of cfg?.devices || []) {
    edges.push({ from: `squad:${squad}`, to: `device:${device}`, type: 'fanout' });
    edges.push({ from: `device:${device}`, to: 'svc:forja-router', type: 'call' });
  }
}

// Nodo radar: refleja el último estado del agente (si existe data/radar.last.json).
try {
  const radarPath = path.join(ROOT, 'data', 'radar.last.json');
  const radarState = JSON.parse(fs.readFileSync(radarPath, 'utf8'));
  nodes.push({
    id: 'agent:radar',
    file: 'server/config/agents.js',
    role: `agent:last_fetch=${radarState.last_fetch || 'unknown'} count=${radarState.count ?? '?'}`,
    lines: lineCount(path.join(ROOT, 'server', 'config', 'agents.js')),
  });
  edges.push({ from: 'svc:alcon-api', to: 'agent:radar', type: 'listener' });
} catch {
  nodes.push({
    id: 'agent:radar',
    file: 'server/config/agents.js',
    role: 'agent:status=unknown',
    lines: lineCount(path.join(ROOT, 'server', 'config', 'agents.js')),
  });
}

const graph = { nodes, edges };
fs.mkdirSync(path.dirname(GRAPH_PATH), { recursive: true });
fs.writeFileSync(GRAPH_PATH, JSON.stringify(graph, null, 2) + '\n');

// Inyecta el mismo grafo en el HTML para vista file:// sin fetch.
if (fs.existsSync(HTML_PATH)) {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  const payload = JSON.stringify(graph);
  const start = '<!--ALCON-GRAPH:START-->';
  const end = '<!--ALCON-GRAPH:END-->';
  const i1 = html.indexOf(start);
  const i2 = html.indexOf(end);
  if (i1 !== -1 && i2 > i1) {
    const out = html.slice(0, i1 + start.length)
      + '\n<script type="application/json" id="alcon-graph">' + payload + '</script>\n'
      + html.slice(i2);
    fs.writeFileSync(HTML_PATH, out);
  } else {
    console.log('brain-map: marcadores ALCON-GRAPH no encontrados, sin inyección');
  }
}

console.log(`brain-map: ${nodes.length} nodos, ${edges.length} aristas -> docs/alcon-graph.json`);
