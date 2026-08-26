# Plan Alcon Excéntrico — Pendiente

> Guardado 2026-08-26 — sin tope para lo excéntrico. Para implementar después.

## Modelos sin censura (para delirio creativo)

| Modelo | Link | Tamaño | Qué trae |
|--------|------|--------|----------|
| **Qwen3.6-35B-A3B-Uncensored-Genesis-APEX-MTP** (MoE, recomendado) | [LuffyTheFox/Qwen3.6-35B-A3B-Uncensored-Genesis-V2-APEX-MTP-GGUF](https://huggingface.co/LuffyTheFox/Qwen3.6-35B-A3B-Uncensored-Genesis-V2-APEX-MTP-GGUF) | 10.6GB Q4 + MTP draft | MoE 35B (3B activos), MTP (+51%), uncensored, APEX quant |
| **Gemma4-12B-Uncensored-HauhauCS-1M** | [satgeze/Gemma4-12B-Uncensored-HauhauCS-1M-GGUF](https://huggingface.co/satgeze/Gemma4-12B-Uncensored-HauhauCS-1M-GGUF) | 7.4GB Q4 + 175MB mmproj + 254MB MTP | 1M contexto, MTP (+51% vel), visión, uncensored |
| Gemma-4-12b-it-uncensored | [zaakirio/gemma-4-12b-it-uncensored-GGUF](https://huggingface.co/zaakirio/gemma-4-12b-it-uncensored-GGUF) | 6.9GB Q4_K_M | Uncensored pelado, sin extras |

> Ambos entran en RTX 3060 12GB. El de satgeze es el completo (1M + MTP + visión).

## Ideas excéntricas para aloc ar Alcon

1. **Squad del delirio**: `squad: delirio` — solo con modelo sin censura, genera ideas imposibles para alcon (ej: "alcon como oráculo de sueños")
2. **RAG visionario**: usar mmproj para que el RAG entienda imágenes/diagramas de `docs/` (fotos de pizarra, sketches)
3. **1M contexto**: cargar TODA la historia (507 pts Qdrant + docs + BENCHMARK) en un solo prompt y pedirle que reescriba `handoff/12-manifiesto-excentrico.md`
4. **MTP para enjambre veloz**: con `mtp-gemma-12b.gguf` el enjambre responde 50% más rápido en debates largos
5. **Agente excéntrico permanente**: `hermes-excentrico` en VPS que solo habla sin filtro, propone rarezas diarias al canal

## Cómo probar (cuando digas)

```bash
# En forja, con 3060
llama-server -m satgeze/Gemma4-12B-Uncensored-HauhauCS-1M-GGUF:Q4 --mmproj mmproj-gemma12b-hauhau.gguf -md mtp-gemma-12b.gguf --spec-type draft-mtp -ngl 99 -fa on --host 0.0.0.0 --port 8080
# Luego en opencode: opencode run --model llamacpp/gemma4-12b-uncensored-1M "@delirio propón 3 rarezas para alcon"
```

## Estado
- Engram: Plan Alcon Excéntrico — pendiente
- Modelos en HF listos, no descargados aún a forja
- Board actual: gemma4-12b-uncensored (6.9GB) ya disponible, falta el 1M+MTP
