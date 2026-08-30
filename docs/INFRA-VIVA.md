# INFRA-VIVA — Estado operativo del enjambre

> ⚡ REGLA: todo cambio de infraestructura actualiza ESTE archivo en el mismo commit.
> BOOTSTRAP.md = constitución · handoff/10 = mapa maestro · ESTE archivo = estado vivo.
> Si un comando de aquí falla, arréglalo aquí en el mismo commit que lo arregla.

_Última actualización: 2026-08-29 (Ferrari v4.3 — router :8080 18 modelos on-demand 0.0.0.0, granja.json 127.0.0.1+Tailscale, 80/20 gemma4-12b-unc vs qwen36-mx, duelo + paredón, OmniRoute 5/5 via forwarder)_

## Puertos

### forja (debian 100.121.64.26) — FÁBRICA + GPU
| Puerto | Servicio | Cómo se lanza |
|--------|----------|---------------|
| 8080 | router forja :8080 — 18 modelos on-demand (0.0.0.0, forwarder 100.121.64.26:20128) | `systemctl --user status llama-router` — health `./scripts/ferrari.sh` (`curl /v1/models`) — 80/20 `gemma4-12b-unc` vs `qwen36-mx` |
| 20128 | OmniRoute gateway free (forwarder 100.121.64.26:20128 → 127.0.0.1:20128) | `systemctl --user status omniroute-forwarder` — `curl -H "Authorization: Bearer $OMNIROUTE_API_KEY" http://100.121.64.26:20128/v1/models` — 5/5 devices |
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
| 8086 | nomic embeddings (descontinuado, ahora via Ollama :11434) | — |
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

## RAG (dieta completada + v3.1 dual nomic)

```
RAG_DOCS_DIR=<docs> RAG_CACHE_DIR=<cache> EMBEDDING_URL=http://100.121.64.26:8080  sudo systemctl restart rag
venv fastapi+uvicorn → rag_sidecar.py  → nomic-embed-text (router :8080 CPU-only, 768d) + fallback VPS :8086
→ cache/embeddings.npy + meta.json     → /rag?q= (vía alcon-api :3003/rag)
→ scp al VPS ~/alcon/cache/            → scripts/rag.sh "pregunta" (CLI)
```

**Gotchas:**
- **RAG v4.4-embed 2026-08-30**: embedding **Qwen3-Embedding-0.6B ONNX local 1024d** en-proceso (adiós Ollama HTTP para queries; nomic queda en router :8080 para memory-rag.js). Reranker via **fastretrieval 1.1.0** (sucesor de qwen3-embed) con perfil **YesNo 598MB** — el estándar pide ~12GB y era el root cause de los OOM kills (YesNo es perfil interno v1.4.2+, NO repo de HF: 404/401 engañoso). `MemoryMax=4G` (2.1G en reposo). **`HF_HUB_OFFLINE=1` removido** del unit — bloqueaba la resolución de modelos de fastretrieval
- **Corpus ampliado 2026-08-29**: 1437 chunks = docs/ + handoff/ + vault (02-guías, 04-aprendizajes via symlink) + repo-root (AGENTS.md, BOOTSTRAP.md, README.md via symlink en docs/repo-root/). Symlinks en VPS `~/alcon/docs/` — el vault llega por Syncthing
- **Eval harness**: `scripts/rag-eval.sh` + `server/rag-eval/eval-set.json` (15 preguntas, accept-lists). Baseline 4/15 → **15/15 recall@3** con ambos embeddings (nomic y qwen3-1024d). Correr en cada cambio de modelo/chunking
- **Fixes de estabilidad 2026-08-29** (commit 9322ed3): proxy timeout 20s (era 5s → hits vacíos), sidecar `/rag` sync handler (async bloqueaba event loop → fetch failed), rerank en try/except (degrada a coseno, nunca tumba el sidecar)
- **Dieta completada 2026-08-26**: torch eliminado (5-6GB RAM era el veto original al Qwen3-Embedding; ONNX lo resuelve — Engram #288/#300)
- **v3.1 dual 2026-08-27**: nomic en router :8080 como 10mo modelo `n-gpu-layers=0` (CPU-only, no contención VRAM). Fallback VPS :8086. `memory-rag.js` con `FORJA_HOST`→`VPS_HOST`. Test `POST /v1/embeddings` 200 en ambos.
- Cache se invalida automáticamente si cambia dimensión (768→1024 detectado)
- Qdrant :6333 = corpus viejo de sesiones (507 pts congelado) — el sidecar NO lo usa
- MRL: el embedder es Matryoshka 32-1024d — si storage aprieta, truncar a 512d solo re-indexando
- Cambiar de modelo = re-indexar (3-6 min en VPS) — ya no es telenovela

## Comms del enjambre
- **Chat**: Socket.io `/enjambre` en :3003. Mención al INICIO del mensaje → server rutea agent:direct (una vez). Mención a mitad de texto → el listener del agente la procesa. Citas en backticks/> = ignoradas (anti-eco, d27df10).
- **Floor**: turno compartido namespace-wide (d27df10) — `floor:request`/`floor:release`, timeout 60s, cola.
- **[COMMS:destino] msg** en el OUTPUT de un agente → evento agent:comms → re-emit como agent:direct.
- **Puerta para sesiones TUI** (sin agent.js): `ssh ubuntu@100.102.63.30 "node ~/comms/hablar.cjs <nombre> 'msg'"`
- **Buzon alcon** (forja): `node scripts/buzon-alcon.cjs` — escucha todo; enviar: `echo "msg" > ~/.alcon-buzon/send.txt`. Log: `~/.alcon-buzon/inbox.log`.
- **Protocolo 8 claves**: PROCEDE · EN PISTA · FUERA · ESPERO · ALERTA · POSA · PASE · CONTEXT (ver obsidian-vault/comms/LEEME.md)
- **TODA identidad que hable debe estar en `server/config/agents.js`** — si no, el server la trata como humano y la reenvía a vps.
- **Duelo**: squad `duelo` (5 devices: debian/kali/vps/cel/montar-forja) + `duel:mute/unmute/status` → bloquea `chat:message` y `agent:comms` del evaluado (paredón Fase B, probado 5/5 en 15s)

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
10. **Listener muerto silencioso** (buzon): log congelado + send.txt sin consumir = proceso muerto. `pgrep -f` se auto-matchea (trampa #1) → verificar con `ps -eo pid,etime,cmd | grep "[b]uzon-alcon"`. Lección radar 2026-08-30
11. `HF_HUB_OFFLINE=1` en units de systemd bloquea silenciosamente la resolución de modelos (fastretrieval/qwen3_embed fallan "from any source" aunque la red esté bien) — lección RAG 2026-08-30
