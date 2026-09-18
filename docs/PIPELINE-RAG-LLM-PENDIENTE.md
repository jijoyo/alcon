# Pipeline LLM Fallback para RAG — Pendiente

> Guardado 2026-08-26 — para implementar después.

## Contexto (actualizado R0 2026-09-17)
- **Embeddings RAG:** qwen3-0.6B-ONNX MRL-768 en `:8087` (qwen-embed-serve). Histórico: nomic-embed-text 768d (Ollama :11434, sidecar :3005, dual forja→VPS — muertos).
- **Generación RAG:** proxy a forja GPU **solo bajo orden de Israel**; HP se vale con CPU/nube (burbuja + opencode, receta Oracle).

## Modelos testeados en cel2 (Helio G96, --threads 2)

| Modelo | Tamaño | Gen | Uso recomendado |
|--------|--------|-----|-----------------|
| Gemma-3-4B-IT Q4_K_M | 2.1GB | 10.8 t/s | **Mejor fallback VPS** — calidad general, cabe en 21GB |
| LFM2.5-1.2B-Thinking-ToMoE Q4_K_M | 698M | 10.1 t/s | RAG con razonamiento (extraer datos, agentes) |
| Gemma-3-1B-IT Q4_K_M | 769M | 10.6 t/s | Ultra-ligero |
| Qwen3-1.7B Q4_K_M | 1.1GB | 9.2 t/s | Balance |

## Plan
1. Copiar `Gemma-3-4B` (o `LFM-Thinking` según tarea) a VPS `~/models/`
2. Compilar `llama.cpp` en VPS con flags ARM (`-mcpu=native -Ofast`)
3. Lanzar `llama-server --host 127.0.0.1 --port 8080 --threads 2` como fallback
4. Modificar `alcon-api` (/rag): si `BOARD_API_URL` no responde, fallback a `http://127.0.0.1:8080/v1/chat/completions`

## Estado
- Benchmark cel2: `docs/BENCHMARK-cel2.md` (10 t/s)
- Modelos en forja: `models/gemma3/`, `models/lfm2.5/`, `models/qwen3/`
- Engram: `Plan LLM fallback RAG en VPS — Gemma-4B / LFM-Thinking` (#294)
