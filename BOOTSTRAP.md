# BOOTSTRAP — Alcon v4.0-granja-real

> Si ves este archivo, ya sabes que estás en Alcon v4.0-granja-real.

## Quién es Juan

- Debian 13 (trixie)
- RTX 3060 12GB VRAM
- 32GB RAM
- AMD Ryzen 5 5600GT
- VPS Oracle ARM (21GB)

## IPs Tailscale

| Equipo | IP | Rol |
|--------|-----|-----|
| forja (debian) | 100.121.64.26 | Brain + GPU |
| vps | 100.102.63.30 | Server + PM2 |
| kali | 100.103.82.104 | Git executor |
| note-11 | 100.122.196.23 | Reviewer (ICMP bloqueado por Android, está vivo) |
| note-12s | 100.96.34.100 | Reviewer |
| ~~cel viejo~~ | ~~100.76.111.99~~ | Offline 3+ días — borrar en consola Tailscale |

## SSH entre equipos

| Desde → Hacia | Comando | Notas |
|---------------|---------|-------|
| debian → kali | `ssh kali` | alias en `~/.ssh/config`; llave `israel@debian` autorizada para user `jijoyo` |
| kali → debian | `ssh israel@100.121.64.26` | Tailscale SSH: puede pedir check de navegador la primera vez |
| vps → kali | `ssh jijoyo@100.103.82.104` | llave `root@oracle-arm` autorizada |
| vps → debian | `ssh israel@100.121.64.26` | Tailscale SSH check navegador ocasional |
| celulares → vps | `granja` = alias de `ssh ubuntu@100.102.63.30` | Termux; sin engram local, corren el CLI del vps |

## Memoria compartida (engram cloud)

- Server: vps `:7438` (systemd `engram-cloud.service`, backend Postgres docker). Token legacy en `~/.engram/cloud.json`.
- Clientes con daemon autosync (systemd user `engram.service`): debian, kali, y **vps como espejo** (`http://127.0.0.1:7438`).
- Celulares: `granja engram search "..." --project alcon` (~30-60s de propagación).
- Enroll es POR CLIENTE: proyecto nuevo → `engram cloud enroll <p>` en cada máquina + allowlist del server (`/home/ubuntu/.engram/cloud.env`) + restart.
- ⚠️ Lección dura: observaciones pueden llegar al stream SIN su sesión upsert → espejo nuevo se traba en FK. Fix aplicado: backfill de sesiones huérfanas en Postgres (`/tmp/backfill-sessions.sh` del 2026-08-21) + patch directo en sqlite del espejo. Si un espejo nuevo se traba: buscar `reason_code` en `sync_state`.

## Paths

- **alcon:** `~/Documentos/alcon/`
- **montar-modelos:** `~/Documentos/montar-modelos/`
- **obsidian-vault:** `~/obsidian-vault/`
- **creacion de contenido:** `~/Documentos/creacion de contenido/`

## Tag actual

```
v4.0-granja-real (commit f21366a)
```

## Puertos

| Servicio | Puerto | Dispositivo |
|----------|--------|-------------|
| alcon-api | :3003 | vps (100.102.63.30) |
| alcon-pwa | :3004 | vps (100.102.63.30) |
| Qdrant | :6333 | vps (docker, --restart unless-stopped) |
| nomic embeddings | :8086 | vps (systemd nomic.service, ARM64 CPU) |
| llama-server | :8080 | debian (100.121.64.26) |
| board API | :9998 | debian |
| dashboard | :8081 | debian |

## Qué es granja.json

8 squads de IA:

| Squad | Qué hace |
|-------|----------|
| `quick-review` | Revisión rápida (1 modelo) |
| `code-audit` | Auditoría profunda (3 modelos) |
| `research-deep` | Debate con argumentos (3 rondas) |
| `architecture` | Consenso de arquitectos (3 votos) |
| `mithos-cap` | Fábrica de CAPs YouTube |
| `deploy` | Deploy al VPS |
| `memory-consolidation` | Consolida auditorías |
| `youtube-auto` | Título + miniatura + descripción |

## Qué hace injectCode()

Busca patrones como "revisa server.js" en el prompt del usuario. Si encuentra uno:
1. Lee el archivo real del disco
2. Lo inyecta en el prompt (max 12000 chars)
3. El modelo analiza código REAL, no imaginario

## Modelos disponibles

| Board Key | Modelo | VRAM | tok/s |
|-----------|--------|------|-------|
| `qwen` | qwen3.6-35b-A3B-MXFP4 | 10.6GB | 45 |
| `qwen-coder-14b` | qwen2.5-coder-14b | 8.4GB | 30 |
| `hauhaucs-12b` | gemma4-12b-hauhaucs | 6.9GB | 129 |
| `gemma` | gemma4-12b-uncensored | 6.9GB | 80 |
| `gemma-26b-a4b` | gemma4-26b-a4b | 11.4GB | 55 |

## Qué es pending-*.md

Historial de auditorías. Cada orchestración guarda resultado en `server/lib/memory/pending-YYYY-MM-DD.md`. Sirve para:
- Ver qué se ha auditado
- Encontrar patrones de bugs
- Medir progreso de calidad

## Filosofía

"Adaptar la realidad al plan, no el plan a la realidad"

El pack v3 asumía 5 modelos en paralelo. Nosotros adaptamos a 1 modelo a la vez con switch systemd + board API :9998.

## Prompt de inicio

Si ves este archivo y no sabes qué hacer, ejecuta:

```bash
curl -s http://100.102.63.30:3003/health
```

Si responde `"status":"ok"`, el sistema está vivo. Luego:

```bash
curl -X POST http://100.102.63.30:3003/api/orchestrate \
  -H "Content-Type: application/json" \
  -d '{"text":"@quick-review test rapido","squad":"quick-review"}'
```

## Commits

```
feat: Feature nueva
fix: Bug fix
chore: Maintenance
docs: Documentación
```

## PM2

```bash
pm2 list                    # Ver procesos
pm2 logs alcon-api          # Logs
pm2 restart alcon-api       # Reiniciar
pm2 save                    # Guardar (IMPORTANTE antes de apagar)
```

## 🚨 GOLDEN RULE - Fuente de Verdad

**GitHub = verdad, VPS = espejo, forja = fábrica**

Todos los dispositivos del enjambre (forja, debian, debian2, vps, laptops) deben respetar esto:
- Nunca hacer scp de archivos trackeados
- Nunca editar directo en VPS con nano sin commit+push
- Nunca usar `ssh root@100.102.63.30` ni `pm2` como root. Solo `ubuntu@100.102.63.30`
- Flujo: forja edita -> git push -> GitHub -> VPS git pull + pm2 restart -> resto git pull
- Excepción hotfix en VPS: si VPS está tirado, arregla ahí, pero INMEDIATAMENTE `git add -A && git commit -m "hotfix: ..." && git push` y luego `git pull` en forja.
- Antes de tocar VPS, siempre: `pm2 ls` (si ves duplicados, alerta) y `git -C ~/alcon log --oneline -3`

Este archivo es leído por todos los dispositivos al hacer git pull.
