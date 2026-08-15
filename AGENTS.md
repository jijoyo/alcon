# AGENTS.md — Alcon

Sistema multi-agente de coordinacion de tareas con chat en tiempo real.

## Stack
- **Server:** Fastify + Socket.io (Node.js, ESM)
- **PWA:** React + TypeScript + Tailwind + Capacitor
- **Deploy:** PM2 en VPS Oracle ARM (`ubuntu@100.102.63.30`)
- **Branch:** `v3.1-clean`
- **Puertos:** :3003 (alcon-api), :3004 (alcon-pwa)

## PM2 Procesos (VPS)
| Nombre | Puerto | Funcion |
|--------|--------|---------|
| alcon-api | :3003 | Server principal |
| alcon-pwa | :3004 | PWA (Vite dev) |
| buzz-farm | - | Worker |
| oracle-bridge | :3001 | Bridge |
| vps-agent | - | Agente VPS |

## Estructura (modular, v3.1-clean)
```
alcon/
├── server/
│   ├── server.js       — Bootstrap Fastify+Socket.io
│   ├── routes/chat.js  — Rutas de chat
│   ├── routes/tasks.js — Rutas de tasks
│   ├── lib/permisos.js — Permisos por agente
│   └── lib/shared.js   — Utilidades compartidas
├── agents/agent.js     — Agente con ejecucion real
├── pwa/src/            — React PWA
└── deploy.sh           — SCP + PM2 deploy
```

## Convenciones
- Commits convencionales: `feat:`, `fix:`, `chore:`, `docs:`
- Sin comentarios en codigo a menos que se pida
- Server usa ESM (`import`/`export`), no CommonJS
- Datos persistidos en JSON (tasks.json) — no hay DB todavia
- Sin autenticacion — es un sistema de confianza interna del enjambre

## Agentes
- **Kali** — PC principal (desarrollo) — modo espejo/respaldo
- **Mimo** — Cel (Termux, supervisión)
- **VPS** — Oracle ARM (100.102.63.30, ejecucion de server + agents)
- **Reina** — Debian forja (100.121.64.26, desarrollo pesado) — PRINCIPAL ACTIVA
- **Debian** — Debian local (desarrollo, permisos equivalentes a Reina)

## Infra actual (post-migración Kali→Debian)
- SSH GitHub: ed25519 key en forja, autenticando como jijoyo
- Tailscale: forja=100.121.64.26, VPS=100.102.63.30, kali=100.103.82.104
- alcon server: corriendo en VPS :3003
- Ollama: forja tiene qwen2.5-coder:7b + nomic-embed-text
- Repo local: ~/Documentos/alcon/ (clonado de GitHub)
