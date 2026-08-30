"""
RAG Sidecar — FastAPI + Qwen3-Embedding-0.6B (ONNX local) + Qwen3-Reranker (ONNX)

Dieta: 0 torch, 0 transformers. Embed + rerank locales via qwen3_embed ONNX.
Embeddings: Qwen3-Embedding-0.6B ONNX INT8, 1024d (antes nomic 768d via Ollama —
el veto original era torch 5-6GB; ONNX lo resuelve, ver Engram #288/#300).
"""

import glob
import json
import os
import hashlib
import threading
import time

import numpy as np
from fastapi import FastAPI, Query
from fastapi.responses import JSONResponse

DOCS_DIR = os.environ.get("RAG_DOCS_DIR", os.path.expanduser("~/alcon/docs"))
CACHE_DIR = os.environ.get("RAG_CACHE_DIR", os.path.expanduser("~/alcon/cache"))
EMBED_MODEL_NAME = "n24q02m/Qwen3-Embedding-0.6B-ONNX"
QUERY_INSTRUCTION = "Given a user question about a project knowledge base, retrieve the most relevant documentation passages that answer it"
RERANK_MODEL_NAME = "n24q02m/Qwen3-Reranker-0.6B-ONNX-YesNo"  # fastretrieval perfil 598MB (vs ~12GB estandar = OOM root cause)
EXPECTED_DIM = 1024  # Qwen3-Embedding-0.6B (MRL, antes nomic 768d)
MAX_CHUNK = 800
MIN_CHUNK = 50
RERANK_TOP = 5
BATCH = 64
EXCLUDE_DIRS = {"sessions"}

embed_model = None
rerank_model = None
docs = []
doc_matrix = None
indexing = True
index_progress = {"loaded": 0, "total": 0, "embedded": 0, "pct": 0, "elapsed": 0}


# ─── Embedding local (ONNX, sin torch, sin Ollama) ───

def load_embed_model():
    global embed_model
    from fastretrieval import TextEmbedding
    embed_model = TextEmbedding(model_name=EMBED_MODEL_NAME)
    print(f"[sidecar] Embedding model loaded: {EMBED_MODEL_NAME} (dim={EXPECTED_DIM})")


def embed_one(text: str) -> list[float]:
    """Embed de query con instruction (mejor retrieval, doc oficial qwen3)."""
    return list(embed_model.query_embed([text], task=QUERY_INSTRUCTION))[0]


def embed_batch(texts: list[str]) -> np.ndarray:
    """Embed de documentos (sin instruction) en lotes."""
    embs = []
    for i in range(0, len(texts), BATCH):
        batch = texts[i:i + BATCH]
        embs.extend(embed_model.embed(batch))
        print(f"[sidecar] Embedded {min(i + BATCH, len(texts))}/{len(texts)} chunks")
    return np.array(embs, dtype=np.float32)


# ─── Chunking ───

def chunk_text(text, fname):
    paragraphs = text.split("\n\n")
    out = []
    for i, para in enumerate(paragraphs):
        para = para.strip()
        if len(para) < MIN_CHUNK:
            continue
        if len(para) > MAX_CHUNK:
            para = para[:MAX_CHUNK]
        out.append({"file": fname, "idx": i, "text": para})
    return out


def dir_hash():
    h = hashlib.md5()
    for fpath in sorted(glob.glob(os.path.join(DOCS_DIR, "**", "*.md"), recursive=True)):
        fname = os.path.relpath(fpath, DOCS_DIR)
        if fname.split(os.sep)[0] in EXCLUDE_DIRS:
            continue
        h.update(fpath.encode())
        with open(fpath, "rb") as f:
            h.update(f.read())
    return h.hexdigest()


# ─── Cache ───

def cache_paths():
    os.makedirs(CACHE_DIR, exist_ok=True)
    return os.path.join(CACHE_DIR, "embeddings.npy"), os.path.join(CACHE_DIR, "meta.json")


def save_cache():
    emb_path, meta_path = cache_paths()
    meta = [{"file": d["file"], "idx": d["idx"], "text": d["text"]} for d in docs]
    np.save(emb_path, doc_matrix)
    with open(meta_path, "w") as f:
        json.dump({"hash": dir_hash(), "dim": int(doc_matrix.shape[1]), "count": len(docs), "chunks": meta}, f)
    print(f"[sidecar] Cache saved: {len(docs)} chunks, dim={doc_matrix.shape[1]} → {emb_path}")


def load_cache():
    emb_path, meta_path = cache_paths()
    if not os.path.exists(emb_path) or not os.path.exists(meta_path):
        return False
    with open(meta_path) as f:
        meta = json.load(f)
    if meta.get("hash") != dir_hash():
        print("[sidecar] Cache stale (docs changed)")
        return False
    cache_dim = meta.get("dim", 0)
    if cache_dim != EXPECTED_DIM:
        print(f"[sidecar] Cache dimension mismatch: cache={cache_dim}, expected={EXPECTED_DIM}. Regenerating.")
        return False
    embs = np.load(emb_path)
    if len(embs) != len(meta["chunks"]):
        return False
    global docs, doc_matrix
    docs = meta["chunks"]
    doc_matrix = np.ascontiguousarray(embs, dtype=np.float32)
    print(f"[sidecar] Cache loaded: {len(docs)} chunks, matriz {doc_matrix.shape} ({doc_matrix.nbytes/1048576:.0f}MB)")
    return True


# ─── Reranker (ONNX, no torch) ───

def load_reranker():
    global rerank_model
    from fastretrieval import TextCrossEncoder
    rerank_model = TextCrossEncoder(model_name=RERANK_MODEL_NAME)
    print("[sidecar] Reranker loaded (ONNX)")


# ─── Indexing ───

def index_docs():
    global docs, doc_matrix, indexing
    t0 = time.time()
    file_count = 0
    raw_chunks = []
    if not os.path.isdir(DOCS_DIR):
        indexing = False
        return
    for fpath in glob.glob(os.path.join(DOCS_DIR, "**", "*.md"), recursive=True):
        fname = os.path.relpath(fpath, DOCS_DIR)
        if fname.split(os.sep)[0] in EXCLUDE_DIRS:
            continue
        with open(fpath, encoding="utf-8") as f:
            text = f.read()
        raw_chunks.extend(chunk_text(text, fname))
        file_count += 1
    print(f"[sidecar] Loaded {file_count} files, {len(raw_chunks)} chunks in {time.time()-t0:.1f}s")
    index_progress["loaded"] = len(raw_chunks)
    index_progress["total"] = len(raw_chunks)

    if raw_chunks:
        texts = [d["text"] for d in raw_chunks]
        t1 = time.time()
        embs = embed_batch(texts)
        # Normalize for cosine similarity
        norms = np.linalg.norm(embs, axis=1, keepdims=True)
        norms[norms == 0] = 1
        embs = embs / norms
        doc_matrix = np.ascontiguousarray(embs, dtype=np.float32)
        for d in raw_chunks:
            d.pop("embedding", None)
        elapsed = time.time() - t1
        print(f"[sidecar] Embedded {len(texts)} chunks in {elapsed:.1f}s, matriz {doc_matrix.shape} ({doc_matrix.nbytes/1048576:.0f}MB)")
        docs = raw_chunks
    print(f"[sidecar] Indexing done: {len(docs)} chunks in {time.time()-t0:.1f}s")
    save_cache()
    indexing = False


# ─── API ───

app = FastAPI(title="rag-sidecar")


@app.get("/health")
async def health():
    return {
        "status": "ok" if not indexing else "indexing",
        "model": EMBED_MODEL_NAME,
        "embedding": "local-onnx",
        "dim": EXPECTED_DIM,
        "docs_indexed": len(docs),
        "reranker_loaded": rerank_model is not None,
        "indexing": indexing,
        "progress": index_progress if indexing else None,
    }


@app.get("/rag")
def rag(q: str = Query(...), k: int = Query(5)):
    if indexing:
        return JSONResponse({"query": q, "hits": [], "error": "indexing in progress", "progress": index_progress}, status_code=202)
    if not docs or doc_matrix is None:
        return JSONResponse({"query": q, "hits": [], "error": "no docs indexed"}, status_code=200)
    q_emb = np.array(embed_one(q), dtype=np.float32)
    q_emb = q_emb / (np.linalg.norm(q_emb) or 1)
    scores = doc_matrix @ q_emb
    top_idx = np.argsort(scores)[::-1][:RERANK_TOP]
    top = [{"file": docs[i]["file"], "text": docs[i]["text"], "score": float(scores[i])} for i in top_idx]
    used_rerank = False
    if rerank_model is not None and top and top[0]["score"] < 0.75:
        try:
            texts = [d["text"] for d in top]
            rscores = list(rerank_model.rerank(q, texts))
            for d, rs in zip(top, rscores):
                d["rerank_score"] = rs
            top.sort(key=lambda x: x.get("rerank_score", 0), reverse=True)
            used_rerank = True
        except Exception as e:
            print(f"[sidecar] rerank fallo (degrada a coseno): {e}")
    hits = []
    for d in top[:k]:
        hits.append({
            "path": d["file"],
            "score": round(d.get("rerank_score", d["score"]), 4),
            "text": d["text"][:500],
        })
    return {"query": q, "hits": hits, "used_rerank": used_rerank}


# ─── Startup ───

def startup():
    t0 = time.time()
    load_embed_model()  # sync — indexing y queries dependen de esto

    if load_cache():
        global indexing
        indexing = False
        print(f"[sidecar] Ready from cache in {time.time()-t0:.1f}s")
    else:
        index_docs()
    threading.Thread(target=load_reranker, daemon=True).start()


if __name__ == "__main__":
    import uvicorn
    threading.Thread(target=startup, daemon=True).start()
    uvicorn.run(app, host="0.0.0.0", port=3005)
