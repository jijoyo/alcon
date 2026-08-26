# Pipeline Curación Qdrant — Pendiente

> Guardado 2026-08-26 — para ejecutar después, no ahora.

## Objetivo
Rescatar vitamina de los 507 pts de Qdrant (sesiones 2024-25) y convertirla en `handoff/11-historia-curada.md` que sí alimente el RAG.

## Pipeline (chico filtra → denso cura → humano valida)

1. **Cel2 chicos (1-4B, 10 t/s)** — 80% barrido
   - Clasifica cada punto: `chorizo / borde / vitamina`
   - Enlaza por tema, quita duplicados
   - Modelos: Gemma-3-1B, LFM2.5-1.2B, Qwen3-1.7B (cel2)

2. **Forja denso (14B, 30 t/s)** — 20% fino
   - Verifica clasificación, reescribe vitamina con criterio
   - Conecta ideas entre puntos
   - Modelo: qwen2.5-coder-14b / gemma-26b-a4b (forja :9998)

3. **Humano** — ok final
   - Revisa `11-historia-curada.md` y aprueba ingesta al RAG

## Recursos
- Input: Qdrant `alcon` (507 pts, 768d) + `docs/sessions/` (525 archivos)
- Output: `handoff/11-historia-curada.md` + re-ingesta a sidecar
- Tiempo estimado: horas en batch (507 pts es pequeño, no días 24/7)

## Estado
- Benchmark cel2 listo: `docs/BENCHMARK-cel2.md` (10 t/s Helio G96)
- Qdrant congelado pero vivo: `:6333`, 58MB RAM/disco
- Engram guardado: `Pipeline curación Qdrant — chico filtra, denso cura` (#293)
