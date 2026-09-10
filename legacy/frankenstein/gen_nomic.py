import numpy as np, json, glob, os, time
from pathlib import Path

DOCS_DIR = os.path.expanduser("~/Documentos/alcon/docs")
MAX_CHUNK = 800
MIN_CHUNK = 50

# 1. Chunk docs
print("Chunking documents...")
docs = []
for fpath in glob.glob(os.path.join(DOCS_DIR, "**", "*.md"), recursive=True):
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

# Save chunks for later use
with open("chunks.jsonl", "w") as f:
    for d in docs:
        f.write(json.dumps(d, ensure_ascii=False) + "\n")
print("Saved chunks.jsonl")

# 2. Load GGUF model
gguf = glob.glob("/home/israel/Documentos/montar-modelos/modelos/*nomic*Q5_K_M*gguf")[0]
print(f"Modelo: {gguf}")

from llama_cpp import Llama
t0 = time.time()
llm = Llama(model_path=gguf, embedding=True, n_gpu_layers=-1, n_ctx=8192, verbose=False)
print(f"Modelo cargado en {time.time()-t0:.1f}s")

# 3. Generate embeddings
texts = [d["text"] for d in docs]
print(f"Generando {len(texts)} embeddings en GPU...")
t1 = time.time()
embeddings = []
for i, txt in enumerate(texts):
    e = llm.embed(txt)
    embeddings.append(e)
    if i % 200 == 0:
        arr = np.array(e)
        print(f"  {i}/{len(texts)} mean={arr.mean():.6f} norm={np.linalg.norm(arr):.3f}")

final = np.array(embeddings, dtype=np.float32)
# Normalize for cosine similarity
norms = np.linalg.norm(final, axis=1, keepdims=True)
norms[norms == 0] = 1
final = final / norms

print(f"FINAL shape={final.shape} mean={final.mean():.6f} norm_mean={np.linalg.norm(final, axis=1).mean():.3f}")
assert final.shape[0] == len(texts), f"Shape mismatch: {final.shape[0]} != {len(texts)}"
assert final.mean() != 0, "Embeddings are zeros!"

np.save("embeddings_nomic_6611.npy", final)
print(f"Guardado embeddings_nomic_6611.npy ({final.shape}) en {time.time()-t1:.1f}s total")
