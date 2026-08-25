# 10 — MAPA MAESTRO ALCON v4.3 (post-cuadre)

> Fuente canónica de qué es Alcon, qué vive y qué está enterrado.
> Generado 2026-08-25 tras arqueología completa (RAG + engram + código + VPS).
> Si un doc viejo contradice este mapa, gana este mapa.

## 1. La visión original (no perderla de nuevo)

Alcon nace como **batallón orgánico de agentes**: decenas de agentes definidos
como plantillas (roles intercambiables) simulando una agencia real, inspirado en
las agencias de agentes de GitHub (MetaGPT, AutoGen, ChatDev).

**El plan YA está documentado** en `docs/alcon-full-dump.md` (2026-08-19):
batallón de **194 roles** (15 definidos entonces) con estructura completa propuesta:
- `server/lib/roles.json` + motor de herencia (`inherits`), permisos, prompts-template,
  modelo/timeout/costo por rol, API `/api/roles`, UI `RoleSelector.tsx`
- Categorías: Seguridad, Desarrollo, Infra, Data, DevOps, Legal, Business
- Integración con squads: un squad usa múltiples roles; roles asignados dinámicos

Cada proyecto de israel (mithos=contenido, dose-dash=médico) tendría sus squads.
El síndrome bola-de-nieve dispersó el plan; este mapa lo ancla de nuevo. La escala
(194) exige plantillas: un rol = una entrada JSON reutilizable, no código nuevo.

## 2. CAPA VIVA (el corazón)

| Componente | Dónde | Rol |
|------------|-------|-----|
| alcon-api Node | VPS :3003 | Chat Socket.io `/enjambre`, tareas SQLite, presencia, `/api/orchestrate`, `/rag` |
| alcon-go | VPS :3001 | Orchestrator Go v4.2 (backup del Node) |
| PWA React+TS | VPS :3004 | Interfaz visual |
| agents/agent.js | debian+kali+vps+cel | Wrapper: opencode CLI como cerebro del agente |
| Board API | forja :9998 | Switch de modelos GPU (systemd), 1 en VRAM |
| llama-server | forja :8080 | Inferencia GPU local |
| Qdrant + nomic | VPS :6333/:8086 | RAG semántico (consultar vía `GET /rag?q=`) |
| engram cloud | VPS :7438 | Memoria entre sesiones/dispositivos |
| GitHub main HEAD | verdad única | Golden Rule: forja escribe → push → espejos pull |

Squads reales (granja.json): quick-review (single/qr-debian), code-audit
(fan-out/debian+kali+vps+cel), research-deep (debate/debian+kali+vps).

Enjambre completo 2026-08-25: kali✅ vps✅ cel✅ debian✅ hermes✅ (primera vez 5/5).

## 3. CAPA ZOMBIE (corre, no molesta, decisión aplazada)

**Hermes** (agente Nous Research, alternativa a opencode):
- Instalado: forja `~/.hermes-venv/bin/hermes` + VPS `~/.local/bin/hermes*`
- Config apunta a llama :8080; nunca integrado a granjas
- Uso básico: `hermes -z "prompt" --no-restore-cwd` · `hermes chat` · `hermes status`
- PENDIENTE: si algún día aporta como backend de perspectiva, agregar
  `backend:'hermes'` a orchestrator.js (~15 líneas espejo de callOpenCode)

**Buzz** (relay Nostr de Block, VPS :3000 + buzz-acp + buzz-farm PM2):
- Sistema multiagente paralelo que duplicaba el chat de Alcon → por eso "no aterrizó"
- Valor único si algún día se quiere: acceso EXTERNO sin Tailscale
  (cel → relay → hermes-acp). Hermes trae gateways whatsapp/slack nativos.
- Decisión 2026-08-25: dejar corriendo, NO invertir más hasta que haya caso de uso real

## 4. CEMENTERIO (movido a legacy/frankenstein/, 2026-08-25)

AUTO-FIX.sh + AUTO_FIX.sh (duplicados one-off), gen_int8/nomic/onnx_direct/torch.py,
HTML DE AYUDA/, orchestrator.go.bak.*. Gitignored además: cache/, chunks.jsonl,
docs/sessions/, docs/alcon-full-dump.md, binarios server/go/alcon*.

Muertos históricos SIN código residual: QEMU (abandonado pre-v4.2),
presence-vps.js (eliminado ghost fix 4f21091), legacy/v3 (vacío; ojo: el RAG
todavía cita archivos que ya no existen — reingestar cuando se toque el RAG).

## 5. Inconsistencias ya corregidas

- README decía "v4.0-granja-real / nada sale a la nube / 8 squards" → v4.3 híbrido real
- AGENTS.md prometía 8 squads → ahora distingue 3 activos vs 5 roadmap
- /health hardcodeaba fbb6655 → hash dinámico git rev-parse (99d1341)
- runtime-state.json trackeado rompía pulls → des-trackeado (99b6106)
- vps-agent sin declarar desaparecía con pm2 save → declarado en ecosystem (1294594)

## 6. Pendientes activos (orden sugerido)

1. **Persistencia cel**: plan 3 capas de @cel en su docs/PLAN-persistencia-agent-cel.md
   (WakeLock+battery unrestricted / .bashrc relaunch / Termux:Boot). Cel ya arrancado;
   capas 1-3 requieren acción física en el teléfono.
2. **qr-vps en quick-review**: granja.json solo tiene qr-debian; --device=vps filtra a 0.
3. **Fallback síntesis sin tools** (orchestrator.js): exigir leer archivo real antes de opinar.
4. Reingesta RAG: purgar fuentes de archivos inexistentes (legacy/v3/*).
