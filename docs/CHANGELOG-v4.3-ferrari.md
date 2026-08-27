# CHANGELOG v4.3-ferrari — Deuda v3

## Antes
- 3 granja.json: root, server/lib, server/go — throttle 4000 vs 0 peleando
- board :9998: `boardStart/Stop` + `for(i<30) fetch /health` = 30s humo
- orchestrator.js: `callLlamaWithHistory` con `model:'local'` hardcodeado, sin model directo
- granja.json Ferrari con `backends` incompatible con squads

## Deuda v3 (2026-08-26)
- Fuente única: `granja.json` root v4.3-ferrari (4 devices throttle 0, router 100.121.64.26:8080, routing 80/20) → symlink `server/lib/granja.json -> ../../granja.json` → `server/go/granja.json` symlink/copy
- orchestrator.js: `boardStart/Stop` → `return; // bypass`, `callLlamaWithHistory(history, prompt, url, model)` pasa `model` directo a `/v1/chat/completions`, `GRANJA` con fallback `../../granja.json`
- orchestrator.go: `selectBackend` 80/20 + `containsKeywords`
- ferrari.sh: endpoints reales `/v1/models`, `/health`, `control :9998 /status`
- Makefile: `test-squad`, `ferrari`, `test`

## Validación
- `make test-squad` → ALL TESTS PASSED (granaja symlink, throttle 0, board bypass, router, ferrari)
- `curl http://127.0.0.1:8080/v1/models` → 9 modelos (gemma4-12b sleeping, qwen36-*, qwen38-*, qwen-coder-14b)
- `./scripts/ferrari.sh` → /health ok, /status router active

## Pendiente v3.1
- `memory-rag.js` sigue `LLAMA_EMBED_URL http://localhost:8086` — `:8080` no tiene `nomic-embed-text`, POST /v1/embeddings no dio 200, no se deprecó `llama-embed.service`
- Montar `nomic-embed-text` como 10mo modelo en router :8080 y mover embed a `:8080/v1/embeddings`
