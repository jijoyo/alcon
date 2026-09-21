#!/usr/bin/env python3
"""rag-rerank-gpu.py — BGE-reranker-v2-m3 persistente en VRAM (evita recarga por query).
Endpoints: GET /health, POST /rerank {query, documents[]} -> {scores[]}
"""
import os

from fastapi import FastAPI
from pydantic import BaseModel
from sentence_transformers import CrossEncoder

MODEL_ID = os.environ.get("RERANK_MODEL", "BAAI/bge-reranker-v2-m3")
PORT = int(os.environ.get("RERANK_PORT", "8088"))

app = FastAPI()
_model = None


def get_model():
    global _model
    if _model is None:
        _model = CrossEncoder(MODEL_ID, device="cuda")
    return _model


class Req(BaseModel):
    query: str
    documents: list


@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL_ID}


@app.post("/rerank")
def rerank(req: Req):
    scores = get_model().predict([(req.query, d) for d in req.documents], batch_size=32)
    return {"scores": [float(s) for s in scores]}


if __name__ == "__main__":
    import uvicorn
    get_model()
    uvicorn.run(app, host="127.0.0.1", port=PORT, log_level="warning")
