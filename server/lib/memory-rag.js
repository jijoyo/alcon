import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import Database from 'better-sqlite3';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const FORJA_HOST = 'http://100.121.64.26:8080';
const VPS_HOST = 'http://localhost:8086';
const COLLECTION = 'alcon';
const VECTOR_SIZE = 768;

const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
let lastEmbedTime = 0;
let idleTimer = null;

function ensureEmbedRunning() {
  try {
    execSync('systemctl --user is-active llama-embed', { stdio: 'pipe' });
  } catch {
    console.log('[memory-rag] Starting llama-embed service...');
    try {
      execSync('systemctl --user start llama-embed', { stdio: 'pipe', timeout: 10000 });
      console.log('[memory-rag] llama-embed started');
    } catch (e) {
      console.log(`[memory-rag] Failed to start llama-embed: ${e.message}`);
    }
  }
  scheduleStop();
}

function scheduleStop() {
  lastEmbedTime = Date.now();
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    const idle = Date.now() - lastEmbedTime;
    if (idle >= IDLE_TIMEOUT_MS) {
      try {
        execSync('systemctl --user stop llama-embed', { stdio: 'pipe' });
        console.log('[memory-rag] llama-embed stopped (idle)');
      } catch {}
    }
  }, IDLE_TIMEOUT_MS + 1000);
}

async function qdrantFetch(endpoint, options = {}) {
  const res = await fetch(`${QDRANT_URL}${endpoint}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Qdrant ${res.status}: ${text}`);
  }
  return res.json();
}

export async function ensureCollection() {
  try {
    const collections = await qdrantFetch('/collections');
    const exists = collections.result?.collections?.some(c => c.name === COLLECTION);
    if (exists) {
      console.log(`[memory-rag] Collection ${COLLECTION} exists`);
      return;
    }
  } catch (e) {
    console.log(`[memory-rag] Qdrant not reachable: ${e.message}`);
    return;
  }

  await qdrantFetch(`/collections/${COLLECTION}`, {
    method: 'PUT',
    body: JSON.stringify({
      vectors: {
        size: VECTOR_SIZE,
        distance: 'Cosine'
      }
    })
  });
  console.log(`[memory-rag] Created collection ${COLLECTION}`);
}

export async function embed(text, attempt = 0) {
  const truncated = text.slice(0, 500);
  if (attempt >= 3) {
    console.log('[memory-rag] Embed failed after 3 retries');
    return null;
  }
  try {
    const res = await fetch(`${FORJA_HOST}/v1/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'nomic-embed-text', input: truncated }),
      signal: AbortSignal.timeout(30000)
    });
    if (!res.ok) throw new Error('forja ' + res.status);
    const data = await res.json();
    return data.data?.[0]?.embedding;
  } catch (e) {
    console.warn(`[memory-rag] forja offline (${e.message}), fallback VPS`);
    try {
      const res2 = await fetch(`${VPS_HOST}/v1/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'nomic-embed-text', input: truncated }),
        signal: AbortSignal.timeout(30000)
      });
      if (!res2.ok) throw new Error('vps ' + res2.status);
      const data2 = await res2.json();
      return data2.data?.[0]?.embedding;
    } catch (e2) {
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
        return embed(text, attempt + 1);
      }
      console.log(`[memory-rag] Embed failed (${e2.message})`);
      return null;
    }
  }
}





export async function upsert(id, payload, vector) {
  if (!vector) {
    console.log(`[memory-rag] Skip upsert ${id} (no vector)`);
    return false;
  }
  try {
    await qdrantFetch(`/collections/${COLLECTION}/points`, {
      method: 'PUT',
      body: JSON.stringify({
        points: [{
          id: id,
          vector: vector,
          payload: payload
        }]
      })
    });
    return true;
  } catch (e) {
    console.log(`[memory-rag] Upsert failed ${id}: ${e.message}`);
    return false;
  }
}

export async function search(query, limit = 10, device = null) {
  const vector = await embed(query);
  if (!vector) {
    console.log('[memory-rag] Search skipped (no embed)');
    return [];
  }

  const filter = device ? {
    must: [{
      key: 'device',
      match: { value: device }
    }]
  } : undefined;

  try {
    const result = await qdrantFetch(`/collections/${COLLECTION}/points/search`, {
      method: 'POST',
      body: JSON.stringify({
        vector: vector,
        limit: limit,
        filter: filter,
        with_payload: true
      })
    });
    return result.result || [];
  } catch (e) {
    console.log(`[memory-rag] Search failed: ${e.message}`);
    return [];
  }
}

export async function countByDevice() {
  try {
    const result = await qdrantFetch(`/collections/${COLLECTION}/points/count`, {
      method: 'POST',
      body: JSON.stringify({ filter: {} })
    });
    const total = result.result?.count || 0;

    const devices = ['forja', 'kali', 'vps', 'cel'];
    const counts = {};
    for (const d of devices) {
      try {
        const r = await qdrantFetch(`/collections/${COLLECTION}/points/count`, {
          method: 'POST',
          body: JSON.stringify({
            filter: { must: [{ key: 'device', match: { value: d } }] }
          })
        });
        counts[d] = r.result?.count || 0;
      } catch { counts[d] = 0; }
    }
    return { total, by_device: counts };
  } catch (e) {
    return { total: 0, by_device: {}, error: e.message };
  }
}

export { COLLECTION, QDRANT_URL };

// CLI: node server/lib/memory-rag.js --reindex
// O auto-reindex si no existe .qdrant-initialized

async function copyDbViaSsh(host, user, remoteDb, localDb) {
  const ip = host.split('@')[1];
  const cmd = ip === '100.102.63.30'
    ? `scp -o "ProxyCommand=tailscale nc %h %p" -o StrictHostKeyChecking=no ${user}@${ip}:${remoteDb} ${localDb}`
    : `scp -o ConnectTimeout=10 -o StrictHostKeyChecking=no ${user}@${ip}:${remoteDb} ${localDb}`;
  try {
    execSync(cmd, { timeout: 120000 });
    return true;
  } catch {
    return false;
  }
}

async function ingestDb(name, dbPath) {
  console.log(`[memory-rag] ${name}: procesando ${dbPath}...`);
  try {
    const db = new Database(dbPath, { readonly: true });
    let sessions = [];
    try {
      sessions = db.prepare(`
        SELECT id, time_created, directory, model, title,
               tokens_input, tokens_output
        FROM session ORDER BY time_created DESC
      `).all();
    } catch {
      try {
        sessions = db.prepare(`
          SELECT id, time_created, directory, model, title, tokens
          FROM sessions ORDER BY time_created DESC
        `).all();
      } catch {
        console.log(`[memory-rag] ${name}: No session table`);
        db.close();
        return { ingested: 0, skipped: 0 };
      }
    }

    let ingested = 0;
    let skipped = 0;

    let processed = 0;
    for (const session of sessions) {
      processed++;
      if (processed % 10 === 0) console.log(`[memory-rag] ${name}: ${processed}/${sessions.length} processed, ${ingested} OK, ${skipped} skipped`);
      let messages = [];
      try {
        messages = db.prepare(`
          SELECT data FROM part WHERE session_id = ? ORDER BY time_created ASC
        `).all(session.id);
      } catch {
        try {
          messages = db.prepare(`
            SELECT text FROM messages WHERE session_id = ? ORDER BY timestamp ASC
          `).all(session.id);
        } catch {}
      }

      const content = messages.map(m => {
        try {
          const d = JSON.parse(m.data);
          return d.text || '';
        } catch {
          return m.text || m.data || '';
        }
      }).filter(Boolean).join('\n');
      if (!content || content.length < 10) continue;

      let modelId = session.model;
      try { const p = JSON.parse(session.model); modelId = p.id || p.model || session.model; } catch { modelId = session.model; }

      const title = session.title || content.slice(0, 200).replace(/\n/g, ' ').trim();
      const tokens = (session.tokens_input || 0) + (session.tokens_output || 0) || session.tokens || 0;

      const rawId = `${name}_${session.id}`;
      const pointId = crypto.createHash('md5').update(rawId).digest('hex');

      const clean = content.replace(/\n+/g, ' ').slice(0, 500).trim();
      if (clean.length < 10) { skipped++; continue; }

      const vector = await embed(session.title + '\n' + clean);
      if (vector) {
        const payload = {
          device: name,
          fecha: new Date(session.time_created).toISOString(),
          texto: (content || '').slice(0, 8000),
          session_id: session.id,
          model: modelId,
          tokens,
          title,
          directory: session.directory || ''
        };
        try {
          await qdrantFetch(`/collections/${COLLECTION}/points`, {
            method: 'PUT',
            body: JSON.stringify({
              points: [{ id: pointId, vector, payload }]
            })
          });
          ingested++;
          await new Promise(r => setTimeout(r, 2000));
        } catch (e) {
          console.log(`[memory-rag] ${name} upsert failed ${pointId}: ${e.message}`);
          skipped++;
        }
      } else {
        skipped++;
      }
    }

    db.close();
    console.log(`[memory-rag] ${name}: ${ingested} ingested, ${skipped} skipped`);
    return { ingested, skipped };
  } catch (e) {
    console.log(`[memory-rag] ${name} error: ${e.message}`);
    return { ingested: 0, skipped: 0 };
  }
}

async function ingestAll() {
  const localDbs = {
    forja: '/home/ubuntu/opencode-dbs/forja.db',
    kali: '/home/ubuntu/opencode-dbs/kali.db',
    vps: '/home/ubuntu/opencode-dbs/vps.db',
    cel: '/home/ubuntu/opencode-dbs/cel.db'
  };

  const sshDevices = [
    { host: 'israel@100.121.64.26', name: 'forja', remoteDb: '/home/israel/.local/share/opencode/opencode.db' },
    { host: 'jijoyo@100.103.82.104', name: 'kali', remoteDb: '/home/jijoyo/.local/share/opencode/opencode.db' },
    { host: 'ubuntu@100.102.63.30', name: 'vps', remoteDb: '/home/ubuntu/.local/share/opencode/opencode.db' },
    { host: 'u0_a366@100.122.196.23', name: 'cel', remoteDb: '/data/data/com.termux/files/home/.local/share/opencode/opencode.db' }
  ];

  await ensureCollection();

  const useLocal = fs.existsSync(localDbs.forja);
  console.log(`[memory-rag] Mode: ${useLocal ? 'LOCAL (VPS)' : 'SSH (forja)'}`);

  let totalIngested = 0;
  let totalSkipped = 0;

  if (useLocal) {
    for (const [name, dbPath] of Object.entries(localDbs)) {
      if (!fs.existsSync(dbPath)) {
        console.log(`[memory-rag] ${name}: DB no encontrado en ${dbPath}, saltando`);
        continue;
      }
      const result = await ingestDb(name, dbPath);
      totalIngested += result.ingested;
      totalSkipped += result.skipped;
    }
  } else {
    for (const d of sshDevices) {
      const localDb = `/tmp/opencode_${d.name}.db`;
      console.log(`[memory-rag] ${d.name}: copiando DB via SSH...`);

      if (!await copyDbViaSsh(d.host, d.name === 'forja' ? 'israel' : d.host.split('@')[0], d.remoteDb, localDb)) {
        console.log(`[memory-rag] ${d.name}: SCP falló, saltando`);
        continue;
      }

      if (!fs.existsSync(localDb)) {
        console.log(`[memory-rag] ${d.name}: DB no llegó`);
        continue;
      }

      const result = await ingestDb(d.name, localDb);
      totalIngested += result.ingested;
      totalSkipped += result.skipped;

      try { fs.unlinkSync(localDb); } catch {}
    }
  }

  console.log(`[memory-rag] Total: ${totalIngested} ingested, ${totalSkipped} skipped`);
  fs.writeFileSync('.qdrant-initialized', 'true');
}

if (process.argv.includes('--reindex')) {
  (async () => {
    await qdrantFetch('/collections/alcon', { method: 'DELETE' }).catch(() => {});
    await qdrantFetch('/collections/granja_memoria', { method: 'DELETE' }).catch(() => {});
    console.log('[memory-rag] Collections deleted, reindexing...');
    await ingestAll();
  })();
} else if (!fs.existsSync('.qdrant-initialized')) {
  (async () => {
    console.log('[memory-rag] No .qdrant-initialized found, auto-reindexing...');
    await ingestAll();
  })();
}
