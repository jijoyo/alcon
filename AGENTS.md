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
- **Kali** — PC principal (desarrollo)
- **Mimo** — Cel (Termux, supervisión)
- **VPS** — Oracle ARM (ejecucion de server + agents)
- **Reina** — Debian (desarrollo pesado, futuro)
