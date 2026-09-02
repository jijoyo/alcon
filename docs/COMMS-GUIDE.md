# COMMS-GUIDE — Protocolo de comunicación del enjambre

> Fuente operativa completa: `docs/INFRA-VIVA.md` § Comms · Protocolo 8 claves: `obsidian-vault/comms/LEEME.md`
> Caso de estudio: **Fiesta del Enjambre 24-25 Ago** (engram #280, #281, #282)

## Las 2 rutas para hablar

| Ruta | Quién | Formato | Mecanismo |
|------|-------|---------|-----------|
| **1. Salida de agente** | Un agente escribiendo en su output | `[COMMS:destino] mensaje` | agent.js detecta con regex → emite `agent:comms` → server re-emit como `agent:direct` |
| **2. Chat / PWA** | Humano o mensaje escrito en el chat | `@destino mensaje` (al INICIO) | chat.js rutea como `agent:direct` (una vez) |

**Formato blindado** (cubre ambas rutas, verificado en la fiesta):
```
[COMMS:debian] @debian ¿puedo hacer push a main?
```

## Las 5 formas institucionalizadas

| # | Forma | Cuándo usarla | Cómo |
|---|-------|---------------|------|
| 1 | **Buzón** (`~/.alcon-buzon`) | Nota rápida async entre sesiones distintas | `echo "msg" > ~/.alcon-buzon/send.txt` · `tail -f inbox.log` |
| 2 | **Agent.js vivo con misma sesión** | Plan longevo donde cada paso depende del anterior | `BUZON_NAME=radar setsid node .../agent.js radar ...` con `ses_...` compartida |
| 3 | **PWA :3004** | Ver en vivo sin tocar terminal | `http://100.102.63.30:3004` |
| 4 | **Squad vía orquestador** | Tarea paralela que necesita varias cabezas | `@code-audit` / `@duelo` → `POST :3003/api/orchestrate` |
| 5 | **Vault + Engram** | Retomar con contexto cero | `retoma <plan>` → lee `vault/02-guías/*.md` + `memory/conversations` + Engram |

> Las 5 quedan institucionalizadas aquí — elige según la situación, no todas a la vez.

## Esencia de la Fiesta (principio institucionalizado)

> **Todos los dispositivos en su sesión real, en vivo y visibles en la PWA** — cada agente con su contexto avanzado (ej: 583 msgs) conectado vía `agent.js` con su `ses_...` real, no usurpador. Es la forma más eficiente para planes longevos: cada uno aporta su historia sin cargar el contexto del otro, convergiendo liviano por el bus. Mismo bus, distinta puerta — la PWA es el espejo vivo.

## Cuándo usar cuál (COMMS vs orquestación Alcon)

| Necesitas | Usa |
|-----------|-----|
| Pregunta rápida / permiso / coordinación entre 2 | **COMMS directo** (`[COMMS:x] @x ...`) |
| Tarea estructural multi-agente con resultado trazable | **Squad vía orquestador** (`@code-audit ...` → `POST :3003/api/orchestrate`) |
| Duelo | **Ambos**: orquestador clona tareas (fan-out), jueces debaten por COMMS con floor |

Desde forja: disparar squad = `curl -X POST http://100.102.63.30:3003/api/orchestrate -H "Content-Type: application/json" -d '{"text":"@squad tarea","squad":"squad"}'` · hablar directo = `echo "msg" > ~/.alcon-buzon/send.txt`

## Reglas duras

1. **Toda identidad debe estar en `server/config/agents.js`** — si no, el server la trata como humano y la reenvía a vps (bug #280 de la fiesta: alcon plagiado por vps)
2. **Un proceso agent.js por identidad** — duplicados se patean (ghost-fix v4.3)
3. **Floor system** (turnos, `a7263f2`): `floor:request` / `floor:release`, timeout 60s — nadie habla encima de otro
4. Menciones a mitad de texto las procesa el listener; citas en backticks/`>` se ignoran (anti-eco, `d27df10`)

## Levantar un agente caído

```bash
# forja/debian
setsid node ~/Documentos/alcon/agents/agent.js debian http://100.102.63.30:3003 &
# vps
pm2 start ecosystem.config.cjs --only vps-agent
# kali
node ~/alcon/agents/agent.js kali http://100.102.63.30:3003
# cel (termux)
setsid nohup node ~/alcon/agents/agent.js cel http://100.102.63.30:3003 &

# verificar presencia
curl -s http://100.102.63.30:3003/health
```

## Puertas alternativas

- **TUI sin agent.js**: `ssh ubuntu@100.102.63.30 "node ~/comms/hablar.cjs <nombre> 'msg'"`
- **Buzón forja**: `node scripts/buzon-alcon.cjs` (escucha todo) · enviar: `echo "msg" > ~/.alcon-buzon/send.txt`

## Lecciones de la fiesta (no repetir)

- Push fantasma: nunca confiar en un "pushed" que salió de un espejo — verificar `git log` en GitHub
- cel con 1GB RAM se cae: no cargarle tareas pesadas
- Ecos en chat: el anti-eco `d27df10` existe por algo — no citar mensajes completos con menciones dentro
