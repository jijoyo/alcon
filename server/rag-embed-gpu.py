#!/usr/bin/env python3
"""rag-embed-gpu.py — embeddings Qwen3-Embedding-0.6B en GPU (torch CUDA),
OpenAI-compatible :8087, MRL-768 (slice + renormalize) para calzar con Qdrant.
Uso: ~/.local/bin/python-taller? No: alcon/.venv/bin/python server/rag-embed-gpu.py
Endpoints: GET /health, POST /v1/embeddings {model, input}
"""
import os

os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

from fastapi import FastAPI
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
import torch

MODEL_ID = os.environ.get("EMBED_MODEL", "Qwen/Qwen3-Embedding-0.6B")
DIM = int(os.environ.get("EMBED_DIM", "768"))
PORT = int(os.environ.get("EMBED_PORT", "8087"))

app = FastAPI()
_model = None


def get_model():
    global _model
    if _model is None:
        _model = SentenceTransformer(MODEL_ID, device="cuda",
                                     trust_remote_code=True)
    return _model


class Req(BaseModel):
    model: str = "qwen-gpu"
    input: object


@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL_ID, "dim": DIM,
            "cuda": torch.cuda.is_available()}


@app.post("/v1/embeddings")
def embeddings(req: Req):
    texts = req.input if isinstance(req.input, list) else [req.input]
    vecs = get_model().encode(texts, normalize_embeddings=False,
                              show_progress_bar=False)
    out = []
    for i, v in enumerate(vecs):
        v = v[:DIM]
        n = float((v * v).sum() ** 0.5) or 1.0
        out.append({"object": "embedding", "index": i,
                    "embedding": (v / n).tolist()})
    return {"object": "list", "model": req.model, "data": out}


if __name__ == "__main__":
    import uvicorn
    get_model()
    uvicorn.run(app, host="127.0.0.1", port=PORT, log_level="warning")
