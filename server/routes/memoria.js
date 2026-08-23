import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import { ensureCollection, embed, upsert, search, countByDevice } from '../lib/memory-rag.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EVIDENCIA_DIR = path.join(__dirname, '..', '..', 'evidencia');

function readOpencodeDb(dbPath) {
  try {
    const db = new Database(dbPath, { readonly: true });

    let sessions = [];
    try {
      sessions = db.prepare(`
        SELECT id, time_created, directory, model, title,
               tokens_input, tokens_output
        FROM session
        ORDER BY time_created DESC
      `).all();
    } catch {
      try {
        sessions = db.prepare(`
          SELECT id, time_created, directory, model, title, tokens
          FROM sessions
          ORDER BY time_created DESC
        `).all();
      } catch (e) {
        console.log(`[memoria] No session table found: ${e.message}`);
        db.close();
        return [];
      }
    }

    const results = [];
    for (const session of sessions) {
      let messages = [];
      try {
        messages = db.prepare(`
          SELECT data FROM part
          WHERE session_id = ?
          ORDER BY time_created ASC
        `).all(session.id);
      } catch {
        try {
          messages = db.prepare(`
            SELECT text FROM messages
            WHERE session_id = ?
            ORDER BY timestamp ASC
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

      const title = session.title || content.slice(0, 200).replace(/\n/g, ' ').trim();
      const summaryFiles = [];
      const fileMatches = content.match(/(?:reading|editing|writing)\s+([^\s]+\.(?:js|ts|json|md|go))/gi);
      if (fileMatches) {
        for (const m of fileMatches.slice(0, 10)) {
          const file = m.split(/\s+/).pop();
          if (!summaryFiles.includes(file)) summaryFiles.push(file);
        }
      }

      const tokens = (session.tokens_input || 0) + (session.tokens_output || 0) || session.tokens || 0;

      results.push({
        session_id: session.id,
        time_created: session.time_created,
        directory: session.directory || '',
        model: session.model || '',
        tokens: tokens,
        title: title,
        content: content.slice(0, 12000),
        summary_files: summaryFiles
      });
    }

    db.close();
    return results;
  } catch (e) {
    console.log(`[memoria] Error reading ${dbPath}: ${e.message}`);
    return [];
  }
}

export default async function memoriaRoutes(fastify) {

  fastify.post('/api/memoria/ingest-granja', async (request, reply) => {
    const { device, db_path } = request.body || {};
    if (!device || !db_path) {
      return reply.code(400).send({ error: 'device and db_path required' });
    }

    if (!fs.existsSync(db_path)) {
      return reply.code(404).send({ error: `DB not found: ${db_path}` });
    }

    await ensureCollection();

    const sessions = readOpencodeDb(db_path);
    let ingested = 0;
    let skipped = 0;
    let exported = 0;

    for (const session of sessions) {
      const rawId = `${device}_${session.session_id}`;
      const pointId = crypto.createHash('md5').update(rawId).digest('hex');
      const evidenciaDir = path.join(EVIDENCIA_DIR, device);
      const evidenciaFile = path.join(evidenciaDir, `${session.session_id}.md`);

      if (!fs.existsSync(evidenciaDir)) {
        fs.mkdirSync(evidenciaDir, { recursive: true });
      }

      if (!fs.existsSync(evidenciaFile)) {
        const md = `# Session ${session.session_id}\n\n` +
          `- Device: ${device}\n` +
          `- Model: ${session.model}\n` +
          `- Time: ${new Date(session.time_created).toISOString()}\n` +
          `- Tokens: ${session.tokens}\n` +
          `- Files: ${session.summary_files.join(', ')}\n\n` +
          `## Content\n\n${session.content.slice(0, 10000)}\n`;
        fs.writeFileSync(evidenciaFile, md);
        exported++;
      }

      let modelId = session.model;
      try { const p = JSON.parse(session.model); modelId = p.id || p.model || session.model; } catch { modelId = session.model; }

      const vector = await embed(session.title + '\n' + session.content.slice(0, 2000));
      if (vector) {
        const payload = {
          device,
          fecha: new Date(session.time_created).toISOString(),
          texto: (session.content || '').slice(0, 8000),
          session_id: session.session_id,
          model: modelId,
          tokens: session.tokens,
          title: session.title,
          directory: session.directory
        };
        const ok = await upsert(pointId, payload, vector);
        if (ok) ingested++;
        else skipped++;
      } else {
        skipped++;
      }
    }

    return { device, sessions: sessions.length, ingested, skipped, exported };
  });

  fastify.get('/api/memoria/buscar', async (request, reply) => {
    const { q, device, limit } = request.query || {};
    if (!q) return reply.code(400).send({ error: 'q parameter required' });

    const k = parseInt(limit) || 10;

    // PRIMARY: Qwen3 sidecar :3005
    try {
      const sidecarUrl = `http://127.0.0.1:3005/rag?q=${encodeURIComponent(q)}&k=${k}`;
      const res = await fetch(sidecarUrl, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`sidecar ${res.status}`);
      const data = await res.json();
      if (data.hits && data.hits.length > 0) {
        return {
          query: q,
          device: device || 'all',
          results: data.hits.map(h => ({
            id: h.path,
            score: h.score,
            payload: { path: h.path, texto: h.text },
            texto: h.text
          })),
          source: 'qwen3-sidecar:3005',
          used_rerank: data.used_rerank,
          model: 'Qwen3-Embedding-0.6B-ONNX-Q4F16'
        };
      }
    } catch (err) {
      console.log('[memoria] sidecar unavailable, falling back to Qdrant:', err.message);
    }

    // FALLBACK: Qdrant + mimo (viejo)
    const results = await search(q, k, device || null);
    return {
      query: q,
      device: device || 'all',
      results: results.map(r => ({
        id: r.id,
        score: r.score,
        payload: r.payload,
        texto: r.payload?.texto
      })),
      source: 'qdrant-fallback'
    };
  });

  fastify.get('/api/memoria/stats', async () => {
    // PRIMARY: Qwen3 sidecar health
    try {
      const res = await fetch('http://127.0.0.1:3005/health', { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const data = await res.json();
        return {
          total: data.docs_indexed || 0,
          by_device: {},
          model: data.model,
          reranker_loaded: data.reranker_loaded,
          source: 'qwen3-sidecar:3005'
        };
      }
    } catch {}
    // FALLBACK: Qdrant
    const stats = await countByDevice();
    return { ...stats, source: 'qdrant-fallback' };
  });
}
