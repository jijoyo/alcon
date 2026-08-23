import glob
import json
import math
import os
import hashlib
import threading
import time

os.environ["TORCH_DISABLE_MKLDNN"] = "1"
os.environ["DNNL_MAX_CPU_ISA"] = "ARMv8"

import numpy as np
from fastapi import FastAPI, Query
from fastapi.responses import JSONResponse

DOCS_DIR = os.environ.get("RAG_DOCS_DIR", os.path.expanduser("~/alcon/docs"))
CACHE_DIR = os.environ.get("RAG_CACHE_DIR", os.path.expanduser("~/alcon/cache"))
RERANK_MODEL_NAME = "n24q02m/Qwen3-Reranker-0.6B-ONNX"
MAX_CHUNK = 800
MIN_CHUNK = 50
RERANK_TOP = 5
BATCH = 128
EXCLUDE_DIRS = {"sessions"}

st_model = None
rerank_model = None
docs = []
indexing = True
index_progress = {"loaded": 0, "total": 0, "embedded": 0, "pct": 0, "elapsed": 0}


def cosine_sim(a, b):
    return float(np.dot(a, b))


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
        h.update(str(os.path.getmtime(fpath)).encode())
    return h.hexdigest()


def cache_paths():
    os.makedirs(CACHE_DIR, exist_ok=True)
    return os.path.join(CACHE_DIR, "embeddings.npy"), os.path.join(CACHE_DIR, "meta.json")


def save_cache():
    emb_path, meta_path = cache_paths()
    embs = np.array([d["embedding"] for d in docs], dtype=np.float32)
    meta = [{"file": d["file"], "idx": d["idx"], "text": d["text"]} for d in docs]
    np.save(emb_path, embs)
    with open(meta_path, "w") as f:
        json.dump({"hash": dir_hash(), "count": len(docs), "chunks": meta}, f)
    print(f"[sidecar] Cache saved: {len(docs)} chunks → {emb_path}")


def load_cache():
    emb_path, meta_path = cache_paths()
    if not os.path.exists(emb_path) or not os.path.exists(meta_path):
        return False
    with open(meta_path) as f:
        meta = json.load(f)
    if meta.get("hash") != dir_hash():
        print("[sidecar] Cache stale (docs changed)")
        return False
    embs = np.load(emb_path)
    if len(embs) != len(meta["chunks"]):
        return False
    global docs
    docs = []
    for i, chunk in enumerate(meta["chunks"]):
        docs.append({"file": chunk["file"], "idx": chunk["idx"], "text": chunk["text"], "embedding": embs[i].tolist()})
    print(f"[sidecar] Cache loaded: {len(docs)} chunks from {emb_path}")
    return True


def load_model():
    global st_model
    import torch
    from sentence_transformers import SentenceTransformer
    st_model = SentenceTransformer("Qwen/Qwen3-Embedding-0.6B", device="cpu", trust_remote_code=True)
    st_model = st_model.to(torch.float32)
    st_model.eval()
    print("[sidecar] SentenceTransformer model loaded (CPU, float32, mkldnn=off)")


def load_reranker():
    global rerank_model
    from qwen3_embed import TextCrossEncoder
    rerank_model = TextCrossEncoder(model_name=RERANK_MODEL_NAME)
    print("[sidecar] Reranker loaded")


def index_docs():
    global docs, indexing
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

    if raw_chunks and st_model is not None:
        texts = [d["text"] for d in raw_chunks]
        t1 = time.time()
        embs = st_model.encode(texts, batch_size=BATCH, show_progress_bar=False, normalize_embeddings=True, convert_to_numpy=True)
        for i, e in enumerate(embs):
            raw_chunks[i]["embedding"] = e.tolist()
        elapsed = time.time() - t1
        print(f"[sidecar] Embedded {len(texts)} chunks in {elapsed:.1f}s")
        docs = raw_chunks
    print(f"[sidecar] Indexing done: {len(docs)} chunks in {time.time()-t0:.1f}s")
    save_cache()
    indexing = False


app = FastAPI(title="rag-sidecar")


@app.get("/health")
async def health():
    return {
        "status": "ok" if not indexing else "indexing",
        "model": "Qwen/Qwen3-Embedding-0.6B",
        "docs_indexed": len(docs),
        "reranker_loaded": rerank_model is not None,
        "indexing": indexing,
        "progress": index_progress if indexing else None,
    }


@app.get("/rag")
async def rag(q: str = Query(...), k: int = Query(5)):
    if indexing:
        return JSONResponse({"query": q, "hits": [], "error": "indexing in progress", "progress": index_progress}, status_code=202)
    if not docs or st_model is None:
        return JSONResponse({"query": q, "hits": [], "error": "no docs indexed"}, status_code=200)
    q_emb = st_model.encode([q], normalize_embeddings=True, convert_to_numpy=True)[0].tolist()
    scored = []
    for d in docs:
        s = cosine_sim(q_emb, d["embedding"])
        scored.append({"file": d["file"], "text": d["text"], "score": s})
    scored.sort(key=lambda x: x["score"], reverse=True)
    top = scored[:RERANK_TOP]
    used_rerank = False
    if rerank_model is not None and top and top[0]["score"] < 0.75:
        texts = [d["text"] for d in top]
        rscores = list(rerank_model.rerank(q, texts))
        for d, rs in zip(top, rscores):
            d["rerank_score"] = rs
        top.sort(key=lambda x: x.get("rerank_score", 0), reverse=True)
        used_rerank = True
    hits = []
    for d in top[:k]:
        hits.append({
            "path": d["file"],
            "score": round(d.get("rerank_score", d["score"]), 4),
            "text": d["text"][:500],
        })
    return {"query": q, "hits": hits, "used_rerank": used_rerank}


def startup():
    t0 = time.time()
    load_model()
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
