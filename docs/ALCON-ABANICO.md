# ALCON-ABANICO — Formas × mecanismos × sockets

> El abanico propio de Alcon (no el de la board). Cada forma: cuándo, con qué
> motor (sabor), por dónde habla (socket/API/archivo). Si forja presta el
> sabor, se marca. Fecha: 2026-09-21.

## Las 5 formas canónicas (COMMS-GUIDE)

| # | Forma | Cuándo | Motor (sabor) | Habla por |
|---|-------|--------|---------------|-----------|
| 1 | Buzón `~/.alcon-buzon` | Nota async entre sesiones | Ninguno (texto plano) | Archivos `send.txt`/`inbox.log` + hilos 1:1 |
| 2 | Agent.js vivo + misma sesión | Plan longevo, pasos encadenados | El del agent (`AGENT_BRAIN`: opencode/spark en espejos) | Socket.io `/enjambre` `:3003` + `ses_...` persistente |
| 3 | PWA `:3004` | Ver en vivo, operar por chat | El que conteste (humano o agent) | HTTP `:3004` + socket chat |
| 4 | Squad vía orquestador | Tarea paralela trazable | Tiers: pesado `muse-spark` / medio `big-pickle` (cloud) / liviano `gemma4-12b` (`:8080` forja) | `POST :3003/api/orchestrate` + `POST :3011` (Go) |
| 5 | Vault + Engram | Retomar contexto cero | Qdrant `:6333` + embeds `:8087` + `engram serve :7437` | HTTP APIs + MCP |

## Formas nuevas (doctrina 2026-09)

| # | Forma | Cuándo | Motor (sabor) | Habla por |
|---|-------|--------|---------------|-----------|
| 6 | F4 tick con compuerta | Despertar barato cada 10-15min | `muse-spark` free (hoy) → tiny local (P-148) | Cron + `f4-tick.sh` + send.txt |
| 7 | Jev gate (Choice/Score/Noul) | Decidir antes de gastar | `forjito-mini` `:8091` CPU (forja) | `taller/jev-*.py` + board API |
| 8 | Duelo (jueces + sentencia) | Evaluar opciones | Contendientes cloud + jueces | Orquestador + Engram (sentencia) |
| 9 | TTL + WIP + semáforo | Higiene de cola | `forjito` + timers systemd | Board API + bus (avisos) |
| 10 | Caza AMD (E2.Micro) | Rescatar VPS libre | OCI CLI (no LLM) | Timer HP + `oracle-hunt.log` + bus (PESCA) |

## Cruce con sabores forja (montar-modelos)

| Necesidad Alcon | Sabor forja | Dónde vive | Estado |
|-----------------|-------------|------------|--------|
| Squad liviano/privado | `gemma4-12b-rapido/largo` | Router `:8080` forja | ✅ vivo |
| Squad pesado largo | `Qwen3.6-35B-*-largo`, `qwen4exp-177b-*` | Router `:8080` | ✅ vivo |
| Scorer Jev | `forjito-mini` (gemma-3-1b/Qwen3-1.7B) | `:8091` forja CPU | ✅ vivo |
| Embeddings RAG | Qwen3 MRL-768 (`montar-modelos/rag-servers/rag-embed-gpu.py` GPU ó `qwen-embed-serve` ONNX CPU, excluyentes) | `:8087` forja/HP | ✅ vivo |
| Gate en cels | LFM-ToMoE/Qwen-1.7B/gemma-1b (staged cel2) o Needle-29MB (P-148) | cel2 | 🅿️ evaluar |
| Voz TTS | Piper `voz2.onnx` + Moshi | forja | ✅ vivo |

## Preguntas al taller (forja-taller)

1. ¿La tabla de sabores tiene dueño canónico (presets.ini vs router vs board)? ¿Cuál leo yo?
2. ¿Tabla/grafo/specs se hablan por sockets o solo archivos? (quiero suscribirme a cambios, no polear)
3. ¿Algún sabor reservado que Alcon no deba tocar (exclusividad VRAM)?
