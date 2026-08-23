# New session - 2026-08-23T00:18:56.441Z

- Device: forja
- Session: ses_f37228a00ffeRAGfix
- Model: mimo-v2.5-free
- Date: 2026-08-23T00:18:56.441Z
- Tokens: 450
- Directory: /home/ubuntu/alcon

## Content

**Fix: RAG score bajo 0.0156 — sessions/ ruidosas + bf16 ARM crash**

### Problema
- `rag_sidecar.py` indexaba 520 archivos (507 sessions/ + 6 legacy + 4 PLAN-V4.1 + 3 raiz)
- Query `retencion ISR` retornaba sessions/ con score 0.0156 — puro ruido
- Al re-indexar sin cache: crash `mkldnn_matmul bf16 path needs a cpu with bf16 support` en Oracle ARM

### Cambios en `server/rag_sidecar.py`
1. **EXCLUDE_DIRS = {"sessions"}** — whitelist invertido, excluye sessions/ del indexado
2. **dir_hash()** — omite paths en dirs excluidos del hash (evita invalidar cache por sessions/)
3. **index_docs()** — omite archivos en dirs excluidos
4. **Fix bf16 ARM:** `os.environ["TORCH_DISABLE_MKLDNN"]` + `DNNL_MAX_CPU_ISA=ARMv8` + `torch.float32` para que Qwen3 Embedding funcione en ARM

### Cambios en `/etc/systemd/system/rag.service`
- `TORCH_DISABLE_MKLDNN=1`
- `DNNL_MAX_CPU_ISA=ARMv8`
- `KMP_AFFINITY=disabled`

### Resultado
| Métrica | Antes | Ahora |
|---------|-------|-------|
| Chunks indexados | 6611 | 225 |
| Archivos sessions/ | 507 | 0 |
| Cache embeddings.npy | 27MB | 921KB |
| Score `deploy granja` | — | 0.87 |
| Score `retencion ISR` | 0.0156 (sessions) | 0.01 (legacy docs) |

### Commit
`f37228a fix: exclude sessions/ from RAG, fix bf16 MKLDNN ARM (oracle-arm-4cpu-24gb), score deploy granja 0.87`

### Nota
El score de `retencion ISR` es bajo porque no hay contenido fiscal en los docs indexados (son docs de Alcon). Para mejorar: agregar docs de tax law a `~/alcon/docs/`.
