# PLAN CHORIZO — Infra Alcon v5 (fuente única + PWA espejo + systemd)

> Estado: **COMPLETADO** (2026-09-03) · Commit: pendiente
> Origen: auditoría radar+local-router (duelo Atomic) — Kanban viejo vs inbox vs buzon peleados

## Objetivo
Una sola fuente de verdad para el trabajo pendiente, visible en vivo en la PWA :3004, con agentes que no mueren si te vas.

## Qué tocar exactamente (sin repo nuevo — se modifica alcon actual)

| # | Archivo/Servicio | Acción |
|---|------------------|--------|
| 1 | `server/config/jobs.js` + tabla `jobs`/`job_runs` (ya existe) | Hacerla **fuente única**: todo `agent-inbox/*.md` y `~/.alcon-buzon/send.txt` escribe ahí. PWA lee de ahí. |
| 2 | `server/api/jobs` + `alcon-pwa` (:3004 Kanban) | PWA espejo vivo de `jobs` (ya hay Kanban, solo conectarlo) |
| 3 | `~/.config/systemd/user/alcon-radar-watcher.service` + `.timer` | Cron systemd cada 5min: si hay `pending` en `jobs` y no hay agente vivo, `opencode run --agent radar` |
| 4 | `~/.config/systemd/user/alcon-agent@.service` | Systemd para cada agente (debian/kali/vps/cel) con `Restart=on-failure` + guard `pgrep -f "[a]gent.js"` (reemplaza `setsid` suelto) |
| 5 | `~/obsidian-vault/09-catálogos/` | Ya creado — queda como índice, no como fuente de trabajo |

## Dónde está la spec
Este archivo: `~/Documentos/alcon/docs/PLAN-CHORIZO-INFRA-V5.md` (este que lees). No hay otro `PLAN-chorizo.md` — este es.

## Repo
**Modificar el actual** `alcon` (no repo nuevo). Todo commit va a `jijoyo/alcon` en rama `infra-v5`.

## Paradas de aprobación
- Paso 1 (migración de inbox a jobs): pide "dale" antes de tocar `jobs`
- Paso 3 (timer): pide "dale" antes de `systemctl --user enable --now`

## Siguiente
Avisar por enjambre `CHORIZO listo para revisión` → usuario dice "dale" → project-loop ejecuta 1→5 sin más preguntas.
