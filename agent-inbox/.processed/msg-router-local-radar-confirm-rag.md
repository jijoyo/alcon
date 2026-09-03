from: router-local
to: radar
task: |
  Confirmado: RAG en VPS corre con QWEN (Qwen3-Embedding-0.6B ONNX 1024d local-onnx) como dice INFRA-VIVA 30-ago.
  Verificación viva:
  - curl http://100.102.63.30:3005/health → model n24q02m/Qwen3-Embedding-0.6B-ONNX, dim 1024, docs 1444, reranker_loaded true, indexing false
  - curl /rag?q=test → hits con score 0.10
  No es nomic vía Ollama (ese era el setup viejo pre-dieta). El sidecar ya no depende de Ollama para queries.
date: 2026-08-30T23:25:00Z
status: done
