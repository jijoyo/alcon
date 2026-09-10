# MEMORIA — fuentes de verdad (2026-09-07)

> Plan: `plan-unificar-memoria.md`. Congelar ceremonia, una fuente por tipo.

| Qué buscas | Dónde | Notas |
|------------|-------|-------|
| Decisiones y aprendizajes | Engram/Qdrant :6333 (`engram search`) | Activo, curado por sesión |
| Canon y docs humanos | `~/obsidian-vault/` (00–10) | Plantilla canónica v4.6 en raíz |
| Log crudo de agentes | `.engram/memoria.md` | Auto-append, NO curado, no citar como verdad |
| Historial de squads | `server/lib/memory/conversations/` | Efímero, puede estar vacío |
| Sesiones viejas | `server/lib/memory/.processed/` | Archivo, solo lectura |
| `memory.jsonl` global | `~/.config/opencode/` | CONGELADO desde 30-jul, no borrar (otros repos) |

## Reglas

- Duda entre stores → manda Engram, luego vault.
- Nada nuevo de memoria hasta que algo duela de verdad.
