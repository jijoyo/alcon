# BOOTSTRAP — Alcon v4.3-regla-oro

> Verdad: github.com/jijoyo/alcon main HEAD (verificar vía `/health` — hash dinámico, sin pines en docs)
> Histórico: ghost fix 4f21091 (21-Ago) - Fantasma neutralizado - 507 engrams Qdrant green
> Si ves este archivo, estás en Alcon v4.3

## Quién es Juan

- Debian 13 (trixie)
- RTX 3060 12GB VRAM
- 32GB RAM
- AMD Ryzen 5 5600GT
- VPS Oracle ARM (21GB)
- **Sesión: X11 (gnome-xorg)** — Wayland causa CPU hog en gnome-shell 48.7 con uptime largo. Fix: `WaylandEnable=false` en `/etc/gdm3/daemon.conf`

## IPs Tailscale

| Equipo | IP | Rol | Estado |
|--------|-----|-----|--------|
| forja (debian) | 100.121.64.26 | Brain + GPU + FABRICA | ✅ main |
| vps | 100.102.63.30 | Server + PM2 + ESPEJO | ✅ 5 PM2 |
| kali | 100.103.82.104 | Git executor | ✅ v4.2-kali branch |
| note-11 | 100.122.196.23 | Reviewer | ✅ ICMP bloqueado por Android, vivo |
| note-12s | 100.96.34.100 | Reviewer | ✅ |
| ~~cel viejo~~ | ~~100.76.111.99~~ | Offline 3+ días | ❌ borrar en consola Tailscale |

## SSH entre equipos

| Desde → Hacia | Comando | Notas |
|---------------|---------|-------|
| debian → kali | `ssh kali` | alias en `~/.ssh/config`; llave `israel@debian` autorizada para user `jijoyo` |
| kali → debian | `ssh israel@100.121.64.26` | Tailscale SSH: puede pedir check de navegador |
| vps → kali | `ssh jijoyo@100.103.82.104` | llave `root@oracle-arm` autorizada |
| vps → debian | `ssh israel@100.121.64.26` | Tailscale SSH check navegador ocasional |
| celulares → vps | `granja` = alias de `ssh ubuntu@100.102.63.30` | Termux; sin engram local, corren CLI del vps |

## Memoria compartida (engram cloud)

- Server: vps `:7438` (systemd `engram-cloud.service`, backend Postgres docker). Token legacy en `~/.engram/cloud.json`.
- Clientes con daemon autosync (systemd user `engram.service`): debian, kali, y **vps como espejo** (`http://127.0.0.1:7438`).
- Celulares: `granja engram search "..." --project alcon` (~30-60s de propagación).
- Enroll es POR CLIENTE: proyecto nuevo → `engram cloud enroll <p>` en cada máquina + allowlist del server (`/home/ubuntu/.engram/cloud.env`) + restart.
- ⚠️ Lección dura: observaciones pueden llegar al stream SIN su sesión upsert → espejo nuevo se traba en FK. Fix aplicado: backfill de sesiones huérfanas en Postgres (`/tmp/backfill-sessions.sh` del 2026-08-21) + patch directo en sqlite del espejo. Si un espejo nuevo se traba: buscar `reason_code` en `sync_state`.

## Qdrant / RAG

- Collection: `alcon` - 507 puntos - 768 dim cosine - status green - port 6333
- Docker --restart unless-stopped en vps
- No borrar colección sin backup. Engrams upsert desde forja.

## Paths

- **alcon:** `~/Documentos/alcon/` (debian) / `~/alcon` (vps ubuntu)
- **montar-modelos:** `~/Documentos/montar-modelos/`
- **obsidian-vault:** `~/obsidian-vault/`
- **creacion de contenido:** `~/Documentos/creacion de contenido/`

## Tag actual

```
v4.3-regla-oro (commit 4f21091) - fix ghost loop + resilient reconnect
Históricos:
  v4.0-granja-real (f21366a) -> granja base 8 squads
  v4.1-conversacional -> chat + presence + CLI overrides
  v4.2-go / v4.2-go-lab / v4.2-kali -> alcon-go 13.2MB Go
  v4.3-regla-oro (4f21091) -> REGLA DE ORO + ghost fix

Branches: main (verdad), v4.2-kali, cel-experimental, fix/termux, v3.1-clean
```

## Puertos

| Servicio | Puerto | Dispositivo | Nota |
|----------|--------|-------------|------|
| alcon-api | :3003 | vps (100.102.63.30) | Fastify Node (backup) |
| alcon-go | :3001 | vps | Go 13.2MB Docker, 60MB RAM |
| alcon-pwa | :3004 | vps | React + TS |
| Qdrant | :6333 | vps | 507 pts, green |
| nomic embeddings | :8086 | vps | systemd nomic.service ARM64 |
| llama-server | :8080 | debian | 1 modelo GPU |
| board API | :9998 | debian | 13 modelos |
| dashboard | :8081 | debian | monitor |
| engram-cloud | :7438 | vps | Postgres docker |

## PM2 Oficial (ubuntu@100.102.63.30)

```
0 alcon-pwa (3004)
2 buzz-farm
3 vps-agent (FIX 4f21091: resilient reconnect + keepalive, estable desde 00:15 21-Ago)
4 alcon-api (3003 ubuntu, NUNCA root)
6 alcon-go (3001)
```

Verificación: `pm2 ls` debe mostrar 5. Si ves duplicado o /root/alcon -> ALERTA.

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

Historial de auditorías. Cada orchestración guarda resultado en `server/lib/memory/pending-YYYY-MM-DD.md`.

## Filosofía

"Adaptar la realidad al plan, no el plan a la realidad"

El pack v3 asumía 5 modelos en paralelo. Nosotros adaptamos a 1 modelo a la vez con switch systemd + board API :9998.

## 🚨 GOLDEN RULE - Fuente de Verdad v4.3

**Forja escribe, GitHub guarda, espejos copian.**

Todos los dispositivos del enjambre (forja, debian, vps, kali, cels) deben respetar esto:

### La Regla
- **FABRICA = forja (debian 100.121.64.26 ~/Documentos/alcon)** = UNICO lugar donde se edita código.
- **VERDAD = github.com/jijoyo/alcon main** = El hash de HEAD es la versión oficial (dinámico, se verifica vía `/health`). Solo push desde forja.
- **ESPEJOS = ubuntu@100.102.63.30 + cels + kalis** = Solo `git pull`, nunca editar.

Flujo correcto SIEMPRE:
```bash
# En forja (fabrica):
cd ~/Documentos/alcon
# ...edita...
git add -A && git commit -m "fix: ..." && git push origin main

# En VPS y resto (espejos):
cd ~/alcon && git status && git pull origin main && pm2 restart all
```

### Antídoto Duplicado (98ecf09)
- NUNCA `ssh root@100.102.63.30` - Solo `ubuntu@100.102.63.30`
- NUNCA `pm2` como root - Si ves `/root/alcon`, es un fantasma: `pm2 delete all && rm -rf /root/alcon`
- NUNCA `scp` de archivo trackeado
- NUNCA editar directo en VPS con nano sin commit+push inmediato
- Antes de tocar VPS: `pm2 ls` (si ves duplicados, alerta) y `git -C ~/alcon log --oneline -3`

### 🚨 Tailscale SSH bypass (Lección 22-Ago-2026)
**Problema:** `PermitRootLogin no` + `AuthenticationMethods publickey` NO bloquean root si Tailscale SSH está habilitado. Tailscale intercepta la conexión ANTES de openssh, autentica por su propio mecanismo (ACL), y reporta `using "none"`.

**Fix:** `sudo tailscale set --ssh=false` en el VPS. Luego openssh procesa la conexión y aplica `PermitRootLogin no`.

**Verificación:** `ssh root@100.102.63.30` debe fallar con `Permission denied (publickey)`.

**Regla:** Si en cualquier equipo `ssh root@` funciona a pesar de `PermitRootLogin no`, verificar `tailscale status` y deshabilitar Tailscale SSH.

### Excepción Hotfix
Si VPS está tirado y forja no llega: arregla en VPS, pero INMEDIATAMENTE:
`git add -A && git commit -m "hotfix: ..." && git push origin main` y luego `git pull` en forja.

### GHOST FIX v4.3 (4f21091)
Causa del loop de 389 restarts 1h el 20-Ago 02:xx:
- `server/presence-vps.js` fantasma (14 líneas) registrado como 'vps' + `server/routes/chat.js` kick con `disconnect(true)` -> socket.io `io server disconnect` no reconecta -> event loop vacío -> exit 0 -> pm2 relanza cada 3s.

Fix:
| File | Cambio |
|------|--------|
| server/presence-vps.js | Eliminado, renombrado a _deprecated_*.bak, gitignored |
| agents/agent.js:411-427 | En io server disconnect: reconexión manual 5s backoff + keepalive setInterval |
| server/routes/chat.js:37 | Log [presence] kicking duplicate ${name} oldSocket=${id} |

Este archivo es leído por todos los dispositivos al hacer git pull. Si lo violas, rompes el enjambre.

## Prompt de inicio

Si ves este archivo y no sabes qué hacer, ejecuta:

```bash
curl -s http://100.102.63.30:3003/health
# debe responder {"status":"ok"}

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
refactor: Refactoring sin cambio de comportamiento
```

## PM2

```bash
pm2 list                    # Ver procesos (deben ser 5)
pm2 logs alcon-api          # Logs
pm2 logs vps-agent --lines 20 --nostream  # Ver si ghost fix estable
pm2 restart alcon-api       # Reiniciar
pm2 save                    # Guardar (IMPORTANTE antes de apagar)
```
