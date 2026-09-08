import onnxruntime as ort
import numpy as np
import json, time, glob, os
from pathlib import Path

ONNX_DIR = os.path.expanduser("~/.cache/huggingface/hub/models--n24q02m--Qwen3-Embedding-0.6B-ONNX/snapshots/dc873d64d6143f27ad68dadbd1f0d9a4371b994e")
ONNX_PATH = os.path.join(ONNX_DIR, "onnx", "model_quantized.onnx")
TOKENIZER_PATH = os.path.join(ONNX_DIR, "tokenizer.json")
DOCS_DIR = os.path.expanduser("~/Documentos/alcon/docs")
MAX_CHUNK = 800
MIN_CHUNK = 50

print(f"Loading ONNX: {ONNX_PATH}")
so = ort.SessionOptions()
so.log_severity_level = 3
sess = ort.InferenceSession(ONNX_PATH, sess_options=so, providers=['CPUExecutionProvider'])
print(f"Providers: {sess.get_providers()}")

from tokenizers import Tokenizer
tok = Tokenizer.from_file(TOKENIZER_PATH)
tok.enable_padding(length=512, pad_id=0)
tok.enable_truncation(max_length=512)
print("Tokenizer loaded")

# Test
enc = tok.encode("test embedding hola mundo")
ids = np.array([enc.ids], dtype=np.int64)
mask = np.array([enc.attention_mask], dtype=np.int64)
out = sess.run(None, {'input_ids': ids, 'attention_mask': mask})
emb = out[0][:, -1, :]
norm = np.linalg.norm(emb)
print(f"Test: shape={emb.shape} mean={emb.mean():.6f} norm={norm:.4f}")
assert norm > 0.5, "FAIL"
print("OK!\n")

# Chunk docs
print("Chunking...")
docs = []
for fpath in sorted(glob.glob(os.path.join(DOCS_DIR, "**", "*.md"), recursive=True)):
    fname = os.path.relpath(fpath, DOCS_DIR)
    with open(fpath, encoding="utf-8") as f:
        text = f.read()
    paragraphs = text.split("\n\n")
    for i, para in enumerate(paragraphs):
        para = para.strip()
        if len(para) < MIN_CHUNK:
            continue
        if len(para) > MAX_CHUNK:
            para = para[:MAX_CHUNK]
        docs.append({"file": fname, "idx": i, "text": para})

print(f"Chunks: {len(docs)}")

# Generate embeddings
texts = [d["text"] for d in docs]
print(f"Encoding {len(texts)} chunks...")
t0 = time.time()
all_embs = []
for i, txt in enumerate(texts):
    enc = tok.encode(txt)
    ids = np.array([enc.ids], dtype=np.int64)
    mask = np.array([enc.attention_mask], dtype=np.int64)
    out = sess.run(None, {'input_ids': ids, 'attention_mask': mask})
    emb = out[0][:, -1, :]
    # L2 normalize
    emb_norm = np.linalg.norm(emb)
    if emb_norm > 0:
        emb = emb / emb_norm
    all_embs.append(emb[0])
    if i % 500 == 0:
        elapsed = time.time() - t0
        rate = (i+1) / elapsed if elapsed > 0 else 0
        eta = (len(texts) - i) / rate if rate > 0 else 0
        print(f"  {i}/{len(texts)} ({100*i/len(texts):.0f}%) {elapsed:.0f}s elapsed, ETA {eta:.0f}s, norm={np.linalg.norm(emb):.4f}")

final = np.array(all_embs, dtype=np.float32)
elapsed = time.time() - t0
print(f"\nFINAL shape={final.shape} mean={final.mean():.6f} norm_mean={np.linalg.norm(final, axis=1).mean():.4f}")
print(f"Time: {elapsed:.0f}s ({elapsed/len(texts)*1000:.1f}ms/chunk)")
assert final.shape[0] == len(texts), f"Shape mismatch"
assert final.mean() != 0, "Embeddings are zeros!"

np.save("cache/embeddings.npy", final)
print(f"OK saved cache/embeddings.npy ({final.nbytes/1024/1024:.1f}MB)")
