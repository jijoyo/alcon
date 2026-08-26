# Mis Equipos — Stack Completo

**Fecha**: 2026-08-18
**Propósito**: Contexto para IA sobre los equipos que uso para trabajar

---

## Resumen Rápido

| Equipo | Tipo | GPU | RAM | IP Tailscale | Rol |
|--------|------|-----|-----|--------------|-----|
| **debian** (forja) | Desktop | RTX 3060 12GB | 32GB | 100.121.64.26 | Brain (desarrollo + GPU) |
| **kali** | Laptop Dell G7 | GTX 1050 Ti 4GB | 16GB | 100.103.82.104 | Git executor |
| **vps** (oracle) | Cloud ARM | — | 21GB | 100.102.63.30 | Server (Fastify + PM2) |
| **cel** (redmi-note-11) | Phone Android | — | 1GB | 100.122.196.23 | Reviewer/approver |
| **cel2** (redmi-note-12s) | Phone Android | Mali-G57 | 6-8GB | 100.96.34.100 | Reviewer + LFM2.5 |

---

## 1. DEBIAN (forja) — Desktop Principal

| Spec | Valor |
|------|-------|
| **Alias** | debian, forja, Reina |
| **OS** | Debian 13 (trixie) |
| **CPU** | AMD Ryzen 5 5600GT |
| **GPU** | NVIDIA RTX 3060 12GB VRAM |
| **RAM** | 32GB |
| **IP Tailscale** | 100.121.64.26 |
| **SSH** | root (habilitado) |
| **Rol en Alcon** | Brain — desarrollo + GPU para modelos locales |

### Herramientas
- Go 1.23.4, Node 22.11, Bun 1.3.14
- Ollama (qwen25-coder-1.5b, gemma4-e2b, gemma4-e4b)
- llama.cpp (CUDA 12.4 + Vulkan)
- OpenCode v1.17.10

### Modelos GPU (llama-server :8080)
| Modelo | VRAM | tok/s |
|--------|------|-------|
| qwen3.6-35b-A3B-MXFP4 | 10.6GB | 45 |
| qwen2.5-coder-14b | 8.4GB | 30 |
| gemma4-12b-hauhaucs | 6.9GB | 129 |
| gemma4-12b-uncensored | 6.9GB | 80 |
| gemma4-26b-a4b | 11.4GB | 55 |

---

## 2. KALI — Laptop Dell G7

| Spec | Valor |
|------|-------|
| **Modelo** | Dell G7 |
| **OS** | Debian (migrado de Kali Linux) |
| **GPU** | NVIDIA GTX 1050 Ti 4GB VRAM |
| **RAM** | 16GB |
| **IP Tailscale** | 100.103.82.104 |
| **Rol** | Git executor, performance testing |

### Nota importante
- llama-server en puerto **8082** (no 8080)
- Necesita `LD_LIBRARY_PATH=/home/jijoyo/.local/lib`
- Modelo: LFM2.5-1.2B-Thinking-Q4_K_M

---

## 3. VPS (oracle) — Cloud ARM

| Spec | Valor |
|------|-------|
| **Proveedor** | Oracle Cloud (ARM) |
| **CPU** | 4 ARM cores |
| **RAM** | 21GB |
| **Disco** | 48GB (13GB libres) |
| **IP pública** | 159.54.143.227 |
| **IP Tailscale** | 100.102.63.30 |
| **Rol** | Server — Fastify + PM2 en :3003 |

### Servicios
- `alcon-api` (:3003) — Node.js Fastify
- `alcon-pwa` (:3004) — PWA static
- `code-server` (:8443) — VS Code en navegador
- Engram server (:7438) — Memoria persistente
- RustDesk self-hosted — ID: 14156943

---

## 4. CEL (redmi-note-11) — Phone

| Spec | Valor |
|------|-------|
| **Modelo** | Xiaomi Redmi Note 11 |
| **OS** | Android 13 + Termux |
| **RAM** | 1GB |
| **IP Tailscale** | 100.122.196.23 |
| **SSH** | Puerto 8022, user u0_a366 |
| **Rol** | Reviewer/approver, testing físico |

### Servicios Termux
- API Server (:3002), PWA (:3004)
- SQLite con `@mmmbuto/better-sqlite3-termux`
- SSH server en puerto 8022 (`pkg install openssh && sshd`)

---

## 5. CEL2 (redmi-note-12s) — Phone

| Spec | Valor |
|------|-------|
| **Modelo** | Xiaomi Redmi Note 12S |
| **Chipset** | MediaTek Helio G96 (12nm) |
| **CPU** | 2x Cortex-A76 @2.05GHz + 6x Cortex-A55 @2.0GHz |
| **GPU** | Mali-G57 MC2 (sin NPU) |
| **RAM** | 6-8GB LPDDR4X |
| **OS** | Android + Termux |
| **IP Tailscale** | 100.96.34.100 |
| **SSH** | Puerto 8022, user u0_a339 |
| **Rol** | Reviewer + experimento LFM2.5 (Nichonauta) |

### Plan LFM2.5 (Nichonauta)
- Modelo: `LFM2.5-1.2B-Thinking-ToMoE-Q4_K_M.gguf` (Nichonauta, ~698MB)
- Framework: **llama.cpp** (no Ollama — más ligero, control fino de hilos/capas)
- Hilos: `--threads 2` (solo Cortex-A76 potentes, ignorar A55 débiles)
- Contexto: `--ctx-size 4096` (ahorrar RAM, 32K es overkill para phone)
- Benchmark estimado: ~20-30 tok/s (Cortex-A76, sin NPU)
- Script: `scripts/setup-llm-cel2.sh`
- Referencia: [Nichonauta/LFM2.5-1.2B-Thinking-ToMoE-GGUF](https://huggingface.co/Nichonauta/LFM2.5-1.2B-Thinking-ToMoE-GGUF)

---

## Topología de Red

```
forja (100.121.64.26) ──Tailscale──→ vps/oracle (100.102.63.30)
       │                                            │
       └────────────────────────────────────────────┘
                         │
kali (100.103.82.104) ───┘
                         │
cel/redmi-note-11 (100.122.196.23) ──┘
cel2/redmi-note-12s (100.96.34.100) ──┘

Red Tailscale: jijoyo202@gmail.com
```

---

## Stack Tecnológico Resumido

| Categoría | debian | kali | vps | cel |
|-----------|--------|------|-----|-----|
| **Lenguajes** | Go, Node, Python | Node, Python | Node | Node |
| **Runtime** | Native | nvm | PM2 | Termux |
| **GPU** | RTX 3060 12GB | GTX 1050 Ti 4GB | — | — |
| **Modelos LLM** | llama-server + Ollama | llama-server | OpenRouter | OpenRouter |
| **Deploy** | Local + Docker | Local | PM2 + Docker | Git pull |
| **DB** | SQLite | SQLite | SQLite | SQLite |
| **Comunicación** | Socket.io | Socket.io | Socket.io | Socket.io |

---

## Notas Importantes

1. **debian es el cerebro** — GPU potente para modelos locales grandes
2. **kali es el executor** — GPU menor, bueno para modelos pequeños
3. **vps es el server público** — Always-on, Oracle Cloud free tier
4. **cel es el reviewer** — Para testing en dispositivo real
5. **Tailscale** conecta todo sin VPN compleja
6. **OpenRouter** para modelos cloud (vps + cel)
7. **llama-server** para modelos locales (debian + kali)

---

## RAG Memory System

Sistema centralizado de búsqueda semántica para sesiones de OpenCode.

### Stack
- **Qdrant** `:6333` — Vector DB (systemd user service `qdrant.service`)
- **llama-server** `:8080` — nomic-embed-text v1.5 Q5_K_M (768 dim)
- **alcon server** `:3003` — Endpoints de ingest y búsqueda

### Endpoints
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/memoria/ingest-granja` | Ingest DB → embed → upsert → export .md |
| GET | `/api/memoria/buscar?q=&device=` | Búsqueda semántica cosine |
| GET | `/api/memoria/stats` | Conteo por dispositivo |

### Datos Actuales
| Device | Sesiones | Puerto SSH | User |
|--------|----------|------------|------|
| forja | 72 | 22 | israel |
| kali | 77 | 22 | jijoyo |
| vps | 345 | 22 (tailscale) | ubuntu |
| cel | 36 | 8022 | u0_a366 |
| cel2 | 339 | 8022 | u0_a339 |
| **Total** | **530** | | |

### Recolecta
```bash
./scripts/recolectar-granja.sh
```
Best-effort: ping check → SSH check → SCP → ingest. No falla si device offline.

### Notas de Conectividad
- **VPS**: SCP via `ProxyCommand=tailscale nc %h %p` (no tiene SSH key directa)
- **Cel**: Puerto 8022 (Termux SSH), user u0_a366
- **Kali**: SSH key instalada vía paramiko
- **Tailscale**: DNS puede ser secuestrado por ISP (192.200.0.x). Solución: `tailscale set --operator=$USER` con sudo
