# Benchmark — cel2 (Redmi Note 12S, Helio G96)

_2026-08-26 — llama.cpp CPU, Termux, sin NPU/GPU_

## Hardware

| Spec | Valor |
|------|-------|
| Modelo | Xiaomi Redmi Note 12S |
| Chipset | MediaTek Helio G96 (12nm) |
| CPU | 2x Cortex-A76 @2.05GHz + 6x Cortex-A55 @2.0GHz |
| GPU | Mali-G57 MP2 (sin Vulkan Turnip) |
| RAM | 6-8GB LPDDR4X |
| OS | Android + Termux |
| Build | `cmake -B build -DCMAKE_BUILD_TYPE=Release -DCMAKE_CXX_FLAGS="-mcpu=cortex-a76 -Ofast -DNDEBUG"` (optimizado Cortex-A76) |

## Configuración óptima

- **Threads:** `--threads 2` (solo A76) > `--threads 4` (2.7% más lento)
- **Mlock:** `--mlock` (evita swap)
- **Prompt test:** `"Explain gravity in simple terms" -n 50`

| Hilos | Prompt | Generation |
|-------|--------|------------|
| 2 | 19.7 t/s | **11.0 t/s** |
| 4 | 27.4 t/s | 9.9 t/s |

**Óptimo: `--threads 2 --mlock` (+9% vs genérico)**
## Modelos (Q4_K_M)

| Modelo | Archivo | Tamaño | Prompt | Generation |
|--------|---------|--------|--------|------------|
| Gemma-3-4B-IT | `gemma-3-4b-it-Q4_K_M.gguf` | 2.1GB | 23.4 t/s | **10.8 t/s** |
| Gemma-3-1B-IT | `gemma-3-1b-it-Q4_K_M.gguf` | 769M | 27.1 t/s | 10.6 t/s |
| LFM2.5-1.2B-Thinking-ToMoE | `LFM2.5-1.2B-Thinking-ToMoE-Q4_K_M.gguf` | 698M | 19.7 t/s | **11.0 t/s** |
| Qwen3-1.7B | `Qwen3-1.7B-Q4_K_M.gguf` | 1.1GB | 27.6 t/s | 9.2 t/s |

> Español vs inglés: misma gen (~10-11 t/s). Testeado `Explica la gravedad...` → 30.5 / 10.1 t/s.

## Reproducción

```bash
# En cel2 Termux
./build/bin/llama-cli -m ~/models/<modelo>.gguf \
  -p "Explain gravity in simple terms" -n 50 \
  --threads 2 --mlock 2>&1 | grep -E "Generation|Prompt"
```

## Modelos en forja (pre-staging)

```
models/lfm2.5/LFM2.5-1.2B-Thinking-ToMoE-Q4_K_M.gguf
models/qwen3/Qwen3-1.7B-Q4_K_M.gguf
models/gemma3/gemma-3-1b-it-Q4_K_M.gguf
models/gemma3/gemma-3-4b-it-Q4_K_M.gguf
```

Fuente modelos: `Nichonauta/LFM2.5-1.2B-Thinking-ToMoE-GGUF` (ToMoE Q4_K_M) y `unsloth/*-GGUF`.

## Optimización aplicada

Recompilado con flags ARM (**+9%** gen: 10.1 → 11.0 t/s):

```bash
cmake -B build -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_CXX_FLAGS="-mcpu=cortex-a76 -Ofast -DNDEBUG" \
  -DCMAKE_C_FLAGS="-mcpu=cortex-a76 -Ofast -DNDEBUG"
```

Ver issue #7115: `make` vs `cmake` en Cortex-A76.
