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
| cel | 100.76.111.99 | Reviewer |

## SSH entre equipos

| Desde → Hacia | Comando | Notas |
|---------------|---------|-------|
| debian → kali | `ssh kali` | alias en `~/.ssh/config`; llave `israel@debian` autorizada para user `jijoyo` |
| kali → debian | `ssh israel@100.121.64.26` | Tailscale SSH: puede pedir check de navegador la primera vez |

## Memoria compartida entre agentes

| Canal | Dónde | Cómo |
|-------|-------|------|
| Engram cloud | VPS :7438 | instalar engram; token compartido en vps `/home/ubuntu/.engram/.kali_token`; luego `export ENGRAM_CLOUD_TOKEN=<token>` → `engram search --project alcon` |
| Obsidian vault | Syncthing | kali: `~/Documents/obsidian-vault`, vps: `/home/ubuntu/obsidian-vault`, cel: Syncthing Fork |
| Repo git | BOOTSTRAP.md | Este archivo — contexto rápido sincronizado por pull/push |


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
