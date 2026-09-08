import json, numpy as np, time
from sentence_transformers import SentenceTransformer

model = SentenceTransformer("Qwen/Qwen3-Embedding-0.6B", device="cuda", trust_remote_code=True)

with open("cache/docs.json") as f:
    docs = json.load(f)
texts = [d["text"] for d in docs]
print(f"Encoding {len(texts)} chunks...")

t0 = time.time()
embs = model.encode(texts, batch_size=128, show_progress_bar=True, normalize_embeddings=True, device="cuda", convert_to_numpy=True)
elapsed = time.time() - t0

print(f"shape={embs.shape} mean={embs.mean():.6f} norm0={np.linalg.norm(embs[0]):.4f}")
print(f"Time: {elapsed:.1f}s ({elapsed/len(texts)*1000:.1f}ms/chunk)")
assert embs.shape[0] == len(texts) and abs(np.linalg.norm(embs[0]) - 1.0) < 0.01, "embeddings invalidos"
np.save("cache/embeddings.npy", embs)
print("OK cache/embeddings.npy")
