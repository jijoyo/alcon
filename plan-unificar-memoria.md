# Plan: Unificar memoria (aprobado 2026-09-07)

## Mapa (investigado, no adivinado)

| Store | Estado | Veredicto |
|-------|--------|-----------|
| Engram/Qdrant :6333 + CLI | Activo, usado cada sesión | **Fuente de verdad: decisiones y aprendizajes** |
| Vault `~/obsidian-vault/` | Organizado 00–10 | **Fuente de verdad: canon y docs humanos** |
| `~/.config/opencode/memory.jsonl` | 13KB, intacto desde 30-jul, contenido dose-dash | Congelado: referencia solo-lectura, NO borrar (lo usan otros repos) |
| `.engram/memoria.md` | 347 líneas, log crudo auto-append ("estás?", timeouts) | Declarar log crudo, NO memoria curada |
| `.engram/chunks/*.jsonl.gz` | Soporte del log | Se queda con el log |
| `server/lib/memory/conversations/` | Vacío | Scratch efímero de squads, se queda |
| `server/lib/memory/pending-2026-08-16.md` | 183 líneas, 3 semanas, ruido de test | Archivar a `.processed/` |
| `agent-inbox/` | Canal transitorio COMMS | Fuera de alcance (ya tiene su `.processed/`) |

## Acciones

1. Header aclaratorio en `.engram/memoria.md` (1 línea: log crudo, curado vive en Engram+vault).
2. Mover `pending-2026-08-16.md` → `server/lib/memory/.processed/`.
3. Crear `docs/MEMORIA.md` (tabla de arriba, corta) como canon.
4. Engram save + commit `chore:` con docs + plan.

## Fuera de alcance

- No tocar `memory.jsonl` global ni el writer de `.engram/`.
- Validación `ops-brain/` Dosedash va en tarea separada (otro repo).
