# INFRA-VIVA — Estado operativo del enjambre

> ⚡ REGLA: todo cambio de infraestructura actualiza ESTE archivo en el mismo commit.
> BOOTSTRAP.md = constitución · handoff/10 = mapa maestro · ESTE archivo = estado vivo.
> Si un comando de aquí falla, arréglalo aquí en el mismo commit que lo arregla.

_Última actualización: 2026-08-26 (post gran-noche + fixes floor/anti-eco + RAG telenovela cerrada)_

## Puertos

### forja (debian 100.121.64.26) — FÁBRICA + GPU
| Puerto | Servicio | Cómo se lanza |
|--------|----------|---------------|
| 8080 | llama-server (1 modelo en VRAM) | Board API :9998 lo controla |
| 8082 | llama-server alternativo | `llamacpp-serve` |
| 9998 | Board Control API | `systemctl --user start board-control-api` |
| 8081 | Dashboard board | board-v3-http.service |
| 3005 (local) | sidecar RAG solo para indexar | ver RAG abajo |

### VPS (oracle ARM 100.102.63.30) — SERVER + ESPEJO always-on
| Puerto | Servicio | Cómo se lanza |
|--------|----------|---------------|
| 3003 | alcon-api (Node: chat/tasks/presencia/orchestrate/RAG) | pm2: alcon-api |
| 3004 | PWA | pm2: alcon-pwa |
| 3001 | alcon-go (orquestador Go v4.2) | pm2: alcon-go |
| 3005 | rag_sidecar.py (embeddings + búsqueda) | `sudo systemctl restart rag` |
| 3000 | buzz relay (Nostr, zombie — no invertir) | buzz-prod-relay |
| 6333 | Qdrant (507 pts sesiones, congelado) | docker/systemd |
| 8086 | nomic embeddings (llama.cpp ARM) | systemd |
| 7438 | engram cloud (memoria entre dispositivos) | docker |

### PM2 oficial VPS (usuario ubuntu, NUNCA root)
`alcon-pwa · buzz-farm · vps-agent · alcon-api · alcon-go` — tras cualquier cambio: `pm2 save`

## SSH (matriz real)
| Desde → Hacia | Comando | Nota |
|----------------|---------|------|
| forja → VPS | `ssh ubuntu@100.102.63.30` | vía Tailscale SSH (sin llave). **El flag `tailscale set --ssh` se RESETAEA con cada re-auth de tailscale** — si da Permission denied: `sudo tailscale set --ssh` desde otra máquina |
| forja → kali | `ssh kali` | alias en ~/.ssh/config |
| kali → forja | `ssh israel@100.121.64.26` | |
| forja → note-11 (cel) | `ssh -p 8022 100.122.196.23` | llave ed25519 de forja en authorized_keys de Termux |
| forja → note-12s (cel2) | `ssh -p 8022 100.96.34.100` | idem |
| cel/cel2 → VPS | `ssh ubuntu@100.102.63.30` | alias `granja` |
| **Termux sshd** | puerto **8022** (NO 22) | se prende con `sshd` dentro de Termux |

## Lanzamiento de agentes (en cada dispositivo)
```bash
# Termux (cel/cel2) — setsid + wake-lock, NOHUP SOLO NO BASTA (muere al cerrar SSH)
setsid nohup node ~/alcon/agents/agent.js <nombre> http://100.102.63.30:3003 >> ~/cel2-agent.log 2>&1 &
# Scripts persistentes: ~/alcon/start-cel.sh · ~/alcon/start-cel2.sh (guard pgrep con bracket trick [a]gent.js)
# Auto-relaunch: bloque en ~/.bashrc + ~/.termux/boot/ (requiere app Termux:Boot de F-Droid)
# forja (debian): setsid node agents/agent.js debian http://100.102.63.30:3003
# VPS: pm2 start ecosystem.config.cjs --only vps-agent
```
- Memoria persistente: cada agente tiene sesión opencode propia (`agents/.session-<nombre>.txt`, gitignored). Se crea sola al primer run con `--title enjambre-<nombre>`.
- **AGENT_MODEL** (pendiente): hardcodeado `opencode/mimo-v2.5-free` — hacer env var para diversidad de cerebros.

## RAG (estado post-telenovela — NO repetir la historia: nomic/qwen fueron grails y fiascos)
```
Indexar (2 min, en FORJA):                          Servir (VPS, always-on):
RAG_DOCS_DIR=<docs> RAG_CACHE_DIR=<cache>           sudo systemctl restart rag
venv sentence-transformers → rag_sidecar.py         → load_cache() instantáneo
→ cache/embeddings.npy + meta.json                  → /rag?q= (vía alcon-api :3003/rag)
→ scp al VPS ~/alcon/cache/                         → scripts/rag.sh "pregunta" (CLI)
```
- **dir_hash es por CONTENIDO** (no mtime) → el cache generado en forja sirve en el VPS (bbe9f29)
- Embeddings en **matriz numpy** (1MB), NO listas .tolist() (~200x overhead, f7de7a1/4a326fa)
- `MemoryMax=7G` en rag.service (pico de carga torch; base ~5GB = torch + 2 modelos)
- **Dieta definitiva pendiente**: eliminar torch (nomic HTTP u ONNX) → ~300MB
- Qdrant :6333 = corpus viejo de sesiones (507 pts congelado) — el sidecar NO lo usa
- Modelo actual: Qwen/Qwen3-Embedding-0.6B (1024 dims) + reranker Qwen3-Reranker-0.6B-ONNX
- Cambiar de modelo = re-indexar en forja (5 min total) — ya no es telenovela

## Comms del enjambre
- **Chat**: Socket.io `/enjambre` en :3003. Mención al INICIO del mensaje → server rutea agent:direct (una vez). Mención a mitad de texto → el listener del agente la procesa. Citas en backticks/> = ignoradas (anti-eco, d27df10).
- **Floor**: turno compartido namespace-wide (d27df10) — `floor:request`/`floor:release`, timeout 60s, cola.
- **[COMMS:destino] msg** en el OUTPUT de un agente → evento agent:comms → re-emit como agent:direct.
- **Puerta para sesiones TUI** (sin agent.js): `ssh ubuntu@100.102.63.30 "node ~/comms/hablar.cjs <nombre> 'msg'"`
- **Buzon alcon** (forja): `node scripts/buzon-alcon.cjs` — escucha todo; enviar: `echo "msg" > ~/.alcon-buzon/send.txt`. Log: `~/.alcon-buzon/inbox.log`.
- **Protocolo 8 claves**: PROCEDE · EN PISTA · FUERA · ESPERO · ALERTA · POSA · PASE · CONTEXT (ver obsidian-vault/comms/LEEME.md)
- **TODA identidad que hable debe estar en `server/config/agents.js`** — si no, el server la trata como humano y la reenvía a vps.

## Env vars por dispositivo
| Var | VPS | debian/forja | Termux |
|-----|-----|--------------|--------|
| LLAMA_URL | http://100.121.64.26:8080 | http://localhost:8080 | — |
| BOARD_API_URL | http://100.121.64.26:9998 | http://localhost:9998 | — |
| ALCON_WORKDIR | /home/ubuntu/alcon | ~/Documentos/alcon | /data/data/com.termux/files/home/alcon |
| RAG_DOCS_DIR / RAG_CACHE_DIR | defaults ~/alcon/docs · ~/alcon/cache | idem para indexar | — |

## Trampas conocidas (gotchas que ya nos mordieron)
1. `pgrep -f` se auto-machea si el patrón está en tu propio comando → usar `[a]gent.js` bracket trick
2. `nohup` NO basta en Termux por SSH → `setsid` + `termux-wake-lock`
3. `io server disconnect` NO auto-reconecta en socket.io → reconnect manual (fix 4f21091)
4. El plugin lazy-load esconde MCPs tras compaction — herramienta "rota" puede estar solo deferida
5. `echo "listo"` puede mentir (venv/push) → verificar SIEMPRE: `ls venv/bin/python`, `git ls-remote`
6. Espejos NO commitean (Regla de Oro) — commits desde espejo arrastran basura local (casi sube .venv de 24k archivos)
7. Archivos reescritos en runtime NUNCA trackeados (runtime-state.json)
8. Tailscale re-auth resetea `set --ssh` del server
9. /tmp/opencode se limpia solo — cosas persistentes van a ~/ o al repo
