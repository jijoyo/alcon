#!/bin/bash
# rag-eval.sh — recall@k del RAG de Alcon contra eval-set.json
# Uso: scripts/rag-eval.sh [k=3]
K=${1:-3}
SET_JSON="$(dirname "$0")/../server/rag-eval/eval-set.json"
python3 - "$K" "$SET_JSON" <<'PY'
import json, sys, time, urllib.parse, urllib.request
k = int(sys.argv[1]); eval_set = json.load(open(sys.argv[2]))
hits_ok = 0; results = []
for case in eval_set:
    q = case["q"]; expect = "|".join(a.split("/")[-1] for a in case.get("accept", []))
    url = f"http://100.102.63.30:3003/rag?q={urllib.parse.quote(q)}"
    time.sleep(0.3)
    try:
        d = json.load(urllib.request.urlopen(url, timeout=30))
        files = [f.get("file","") for f in d.get("fuentes",[])[:k]]
        accept = case.get("accept", [case.get("expect","")])
    except Exception as e:
        results.append((q, ",".join(case.get("accept",[])), f"ERROR {e}")); continue
    ok = any(any(a in f for f in files) for a in accept)
    hits_ok += ok
    mark = "✅" if ok else "❌"
    results.append((q, "|".join(a.split("/")[-1] for a in accept), f"{mark} got={files[:2]}"))
print(f"=== RAG EVAL recall@{k}: {hits_ok}/{len(eval_set)} ({100*hits_ok/len(eval_set):.0f}%) ===")
for q, expect, r in results:
    if not r.startswith("✅"): print(f"  {q[:45]:45s} acepta={expect[:38]:38s} {r}")
PY
