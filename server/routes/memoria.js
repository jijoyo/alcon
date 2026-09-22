import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFile } from 'child_process';
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
    const { q, device, limit, coleccion } = request.query || {};
    if (!q) return reply.code(400).send({ error: 'q parameter required' });

    const k = parseInt(limit) || 10;

    // PRIMARY: Qwen3 sidecar :3005 (receta VPS: rag_sidecar.py + fastretrieval)
    try {
      const sidecarUrl = `http://127.0.0.1:3005/rag?q=${encodeURIComponent(q)}&k=${k}`;
      const res = await fetch(sidecarUrl, { signal: AbortSignal.timeout(4000) });
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
    const results = await search(q, k, device || null, coleccion || null);
    return {
      query: q,
      device: device || 'all',
      coleccion: (coleccion === 'hemeroteca' || coleccion === 'alcon') ? coleccion : 'alcon',
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
    // PRIMARY: Qwen3 sidecar health (:3005 receta VPS)
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

  fastify.get('/api/estado-rag', async () => {    const out = { qdrant: {}, embeds: false, colecciones: {} };
    for (const col of ['alcon', 'hemeroteca']) {
      try {
        const r = await fetch(`${process.env.QDRANT_URL || 'http://localhost:6333'}/collections/${col}`, { signal: AbortSignal.timeout(5000) });
        const d = await r.json();
        out.colecciones[col] = { status: d.result?.status, points: d.result?.points_count || 0 };
      } catch { out.colecciones[col] = { status: 'off', points: 0 }; }
    }
    try {
      const r = await fetch(`${process.env.QWEN_EMBED_URL || 'http://127.0.0.1:8087'}/health`, { signal: AbortSignal.timeout(5000) });
      out.embeds = r.ok;
    } catch { out.embeds = false; }
    out.qdrant = { ok: Object.values(out.colecciones).some(c => c.status === 'green') };
    return out;
  });

  fastify.get('/api/rag/responder', async (request, reply) => {
    const q = request.query?.q || '';
    if (!q.trim()) return reply.code(400).send({ error: 'q parameter required' });
    const LLM = process.env.FORJA_LLM_URL || 'http://100.121.64.26:8090/v1/chat/completions';
    try {
      // retrieval JS nativo (mismo que buscar): top6 híbrido alcon+hemeroteca
      const [a, h] = await Promise.all([
        search(q, 6, null, 'alcon').catch(() => []),
        search(q, 6, null, 'hemeroteca').catch(() => []),
      ]);
      const seen = new Set(), top = [];
      for (const r of [...a, ...h].sort((x, y) => (y.score || 0) - (x.score || 0))) {
        const key = (r.payload?.file || r.payload?.title || r.id || '').slice(-80);
        if (!key || seen.has(key)) continue;
        seen.add(key); top.push(r);
        if (top.length >= 6) break;
      }
      if (!top.length || Math.max(...top.map(r => r.score || 0)) < 0.30)
        return { query: q, respuesta: 'No sé con lo indexado (ninguna fuente pasa el umbral). Prueba otra pregunta.', fuentes: [] };
      const ctx = top.map((r, i) => {
        const p = r.payload || {};
        const t = (p.title || p.file || r.id || '').split('/').pop();
        const txt = (p.texto || r.texto || '').slice(0, 600);
        return `[${i + 1}] ${t}\n${txt}`;
      }).join('\n\n');
      const r = await fetch(LLM, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [
          { role: 'system', content: 'Responde SOLO con las fuentes dadas, cita como [1][2]. Si no alcanza, dilo. Si hay acepciones distintas, menciona cada una con su fuente.' },
          { role: 'user', content: `Pregunta: ${q}\n\nFuentes:\n${ctx}` }],
          max_tokens: 400, temperature: 0.2 }),
        signal: AbortSignal.timeout(60000),
      });
      const j = await r.json();
      const respuesta = j.choices?.[0]?.message?.content?.trim() || 'Sin respuesta del sintetizador.';
      const fuentes = top.map(r2 => `${(r2.score || 0).toFixed(3)} | ${((r2.payload?.title || r2.payload?.file || '')).split('/').pop()}`.slice(0, 100));
      return { query: q, respuesta, fuentes };
    } catch (e) {
      return { query: q, respuesta: 'No sé con lo indexado (bibliotecario no disponible).', fuentes: [] };
    }
  });
}
