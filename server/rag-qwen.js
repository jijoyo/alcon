import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = path.join(__dirname, '..', 'docs');
const SIDECAR_URL = process.env.RAG_SIDECAR_URL || 'http://127.0.0.1:3005/rag';

const STOP_WORDS = new Set([
  'el','la','los','las','un','una','unos','unas','de','del','al','a','en','por','para','con','sin','sobre','entre',
  'es','son','fue','ser','estar','hay','ha','han','que','como','pero','más','o','y','e','ni','no','sí','ya','muy',
  'este','esta','estos','estas','ese','esa','esos','esas','aquel','aquella','lo','le','les','me','te','se','nos',
  'mi','tu','su','mis','tus','sus','nuestro','nuestra','nuestros','nuestras','vuestro','vuestra',
  'the','a','an','is','are','was','were','be','been','being','have','has','had','do','does','did',
  'will','would','could','should','may','might','shall','can','need','dare','ought','used',
  'to','of','in','for','on','with','at','by','from','as','into','through','during','before','after',
  'and','but','or','nor','not','so','yet','both','either','neither','each','every','all','any','few',
  'it','its','he','she','they','them','their','what','which','who','whom','when','where','why','how',
  'this','that','these','those','i','you','we','me','him','her','us','myself','yourself','himself',
]);

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-záéíóúüñ0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2 && !STOP_WORDS.has(t));
}

function chunkDocument(content, fileName) {
  const paragraphs = content.split(/\n{2,}/).filter(p => p.trim().length > 20);
  return paragraphs.map((text, i) => ({
    file: fileName,
    chunkIndex: i,
    text: text.trim().slice(0, 1000),
    tokens: tokenize(text),
  }));
}

function computeTF(tokens) {
  const freq = {};
  for (const t of tokens) freq[t] = (freq[t] || 0) + 1;
  const max = Math.max(...Object.values(freq), 1);
  const tf = {};
  for (const [term, count] of Object.entries(freq)) {
    tf[term] = 0.5 + 0.5 * (count / max);
  }
  return tf;
}

function computeIDF(chunks) {
  const df = {};
  const N = chunks.length;
  for (const chunk of chunks) {
    const unique = new Set(chunk.tokens);
    for (const term of unique) {
      df[term] = (df[term] || 0) + 1;
    }
  }
  const idf = {};
  for (const [term, count] of Object.entries(df)) {
    idf[term] = Math.log((N + 1) / (count + 1)) + 1;
  }
  return idf;
}

function vectorize(tokens, tf, idf) {
  const vec = {};
  for (const t of tokens) {
    if (idf[t]) vec[t] = (tf[t] || 0.5) * idf[t];
  }
  return vec;
}

function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of allKeys) {
    const va = a[k] || 0;
    const vb = b[k] || 0;
    dot += va * vb;
    normA += va * va;
    normB += vb * vb;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

let chunks = [];
let idf = {};

function loadDocs() {
  chunks = [];
  if (!fs.existsSync(DOCS_DIR)) return;
  const files = fs.readdirSync(DOCS_DIR).filter(f => f.endsWith('.md'));
  for (const file of files) {
    const content = fs.readFileSync(path.join(DOCS_DIR, file), 'utf-8');
    chunks.push(...chunkDocument(content, file));
  }
  idf = computeIDF(chunks);
}

function queryTfidf(question) {
  if (chunks.length === 0) loadDocs();
  if (chunks.length === 0) return { respuesta: 'No hay documentos indexados.', fuentes: [] };

  const qTokens = tokenize(question);
  if (qTokens.length === 0) return { respuesta: 'Pregunta sin términos útiles.', fuentes: [] };

  const qTF = computeTF(qTokens);
  const qVec = vectorize(qTokens, qTF, idf);

  const scored = chunks.map(chunk => {
    const cTF = computeTF(chunk.tokens);
    const cVec = vectorize(chunk.tokens, cTF, idf);
    return { ...chunk, score: cosineSimilarity(qVec, cVec) };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 3).filter(s => s.score > 0.05);

  if (top.length === 0) {
    return { respuesta: 'No encontré información relevante en los documentos.', fuentes: [] };
  }

  const bestChunk = top[0];
  const respuesta = bestChunk.text.slice(0, 500);
  const fuentes = top.map(s => ({ file: s.file, score: Math.round(s.score * 1000) / 1000, snippet: s.text.slice(0, 150) }));

  return { respuesta, fuentes };
}

async function querySidecar(question, k = 3) {
  const url = `${SIDECAR_URL}?q=${encodeURIComponent(question)}&k=${k}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`sidecar ${res.status}`);
  const data = await res.json();
  if (!data.hits || data.hits.length === 0) {
    return { respuesta: 'No encontré información relevante en los documentos.', fuentes: [] };
  }
  const respuesta = data.hits[0].text.slice(0, 500);
  const fuentes = data.hits.map(h => ({
    file: h.path,
    score: h.score,
    snippet: h.text.slice(0, 150),
  }));
  return { respuesta, fuentes, source: 'qwen3-embed', used_rerank: data.used_rerank };
}

export async function queryRAG(question) {
  try {
    return await querySidecar(question);
  } catch (err) {
    console.log('[rag] sidecar unavailable, falling back to TF-IDF:', err.message);
    return { ...queryTfidf(question), source: 'tfidf-fallback' };
  }
}

loadDocs();
