# AGENTS.md — Alcon

Sistema multi-agente de coordinacion de tareas con chat en tiempo real.

## Stack
- **Server:** Fastify + Socket.io (Node.js, ESM)
- **PWA:** React + TypeScript + Tailwind + Capacitor
- **Deploy:** PM2 en VPS Oracle ARM (`ubuntu@159.54.143.227`)
- **Puertos:** :3003 (server), :5176 (PWA), :3002 (legacy, deprecado)

## Estructura
```
alcon/
├── server/server.js    — Monolith Fastify+Socket.io (~630 lineas)
├── agents/agent.js     — Stub de agente (simula ejecucion)
├── pwa/src/            — React PWA (5 componentes, 3 vistas)
├── deploy.sh           — SCP + PM2 deploy
├── migration/          — Scripts de migracion Kali→Debian
└── README.md           — Docs completas
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

## Infra actual (post-migración Kali→Debian)
- SSH GitHub: ed25519 key en forja, autenticando como jijoyo
- Tailscale: forja=100.121.64.26, VPS=100.102.63.30, kali=100.103.82.104
- alcon server: corriendo en VPS :3003
- Ollama: forja tiene qwen2.5-coder:7b + nomic-embed-text
- Repo local: ~/Documentos/alcon/ (clonado de GitHub)
