import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const LLAMA_URL = process.env.LLAMA_URL || 'http://localhost:8080';
const COLLECTION = 'granja_memoria';
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

export async function embed(text) {
  ensureEmbedRunning();
  const truncated = text.slice(0, 2000);
  try {
    const res = await fetch(`${LLAMA_URL}/v1/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'nomic-embed-text',
        input: truncated
      })
    });
    if (!res.ok) throw new Error(`llama ${res.status}`);
    const data = await res.json();
    return data.data?.[0]?.embedding;
  } catch (e) {
    console.log(`[memory-rag] Embed failed (${e.message}), using fallback`);
    return null;
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
