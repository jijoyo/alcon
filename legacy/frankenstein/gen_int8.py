import numpy as np, json, os, time, glob
import onnxruntime as ort
from tokenizers import Tokenizer

ONNX_DIR = os.path.expanduser("~/.cache/huggingface/hub/models--n24q02m--Qwen3-Embedding-0.6B-ONNX/snapshots/dc873d64d6143f27ad68dadbd1f0d9a4371b994e")
DOCS_DIR = os.path.expanduser("~/Documentos/alcon/docs")
CACHE_DIR = os.path.expanduser("~/Documentos/alcon/cache")
CHECKPOINT = os.path.join(CACHE_DIR, "embeddings_int8_partial.npy")
OUTPUT = os.path.join(CACHE_DIR, "embeddings.npy")
MAX_CHUNK = 800
MIN_CHUNK = 50
LOG_EVERY = 100

def chunk_text(text, fname):
    paragraphs = text.split("\n\n")
    out = []
    for i, para in enumerate(paragraphs):
        para = para.strip()
        if len(para) < MIN_CHUNK: continue
        if len(para) > MAX_CHUNK: para = para[:MAX_CHUNK]
        out.append({"file": fname, "idx": i, "text": para})
    return out

print("Chunking docs...")
docs = []
for fpath in sorted(glob.glob(os.path.join(DOCS_DIR, "**", "*.md"), recursive=True)):
    fname = os.path.relpath(fpath, DOCS_DIR)
    with open(fpath, encoding="utf-8") as f:
        text = f.read()
    docs.extend(chunk_text(text, fname))
texts = [d["text"] for d in docs]
print(f"Total chunks: {len(texts)}")

# Save docs.json for reference
os.makedirs(CACHE_DIR, exist_ok=True)
with open(os.path.join(CACHE_DIR, "docs.json"), "w") as f:
    json.dump(docs, f, ensure_ascii=False)

# Load ONNX
so = ort.SessionOptions()
so.log_severity_level = 3
sess = ort.InferenceSession(os.path.join(ONNX_DIR, "onnx/model_quantized.onnx"), sess_options=so, providers=["CPUExecutionProvider"])
tok = Tokenizer.from_file(os.path.join(ONNX_DIR, "tokenizer.json"))
tok.enable_padding(length=512, pad_id=0)
tok.enable_truncation(max_length=512)
print("ONNX INT8 loaded")

# Resume from checkpoint
done = 0
if os.path.exists(CHECKPOINT):
    partial = np.load(CHECKPOINT)
    done = partial.shape[0]
    print(f"Resuming from checkpoint: {done}/{len(texts)}")

t0 = time.time()
embs = list(partial) if done > 0 else []

for i in range(done, len(texts)):
    enc = tok.encode(texts[i])
    ids = np.array([enc.ids], dtype=np.int64)
    mask = np.array([enc.attention_mask], dtype=np.int64)
    out = sess.run(None, {"input_ids": ids, "attention_mask": mask})
    emb = out[0][:, -1, :]
    norm = np.linalg.norm(emb)
    if norm > 0:
        emb = emb / norm
    embs.append(emb[0])

    if (i + 1) % LOG_EVERY == 0:
        elapsed = time.time() - t0
        done_count = i + 1
        rate = (done_count - done) / elapsed if elapsed > 0 else 0
        eta = (len(texts) - done_count) / rate if rate > 0 else 0
        print(f"  {done_count}/{len(texts)} ({100*done_count/len(texts):.0f}%) {elapsed:.0f}s, rate={rate:.1f}/s, ETA={eta:.0f}s")

    if (i + 1) % 500 == 0:
        np.save(CHECKPOINT, np.array(embs, dtype=np.float32))
        print(f"  [checkpoint saved: {i+1}/{len(texts)}]")

final = np.array(embs, dtype=np.float32)
elapsed = time.time() - t0
print(f"\nFINAL shape={final.shape} mean={final.mean():.6f} norm_mean={np.linalg.norm(final, axis=1).mean():.4f}")
print(f"Time: {elapsed:.0f}s ({elapsed/len(texts)*1000:.1f}ms/chunk)")
assert final.shape[0] == len(texts) and final.mean() != 0
np.save(OUTPUT, final)
if os.path.exists(CHECKPOINT):
    os.remove(CHECKPOINT)
print(f"OK saved {OUTPUT}")
