# Alcon - Multi-Agent Swarm

Sistema multi-agente con tareas, chat en tiempo real, presencia y interruptor maestro.

## Arquitectura

```
PWA (React + Tailwind)          VPS (Oracle Cloud)
┌─────────────────────┐    ┌──────────────────────────────────┐
│  ChatView.tsx       │───▶│  Fastify (:3003)                 │
│  InterruptorMaestro │───▶│    ├── HTTP API (tasks, agents)  │
│  socket.ts          │◀─WS│    └── Socket.io /enjambre       │
│  TaskInput/Chat     │───▶│  pm2 serve (:5176) ← PWA estática│
└─────────────────────┘    └──────────────────────────────────┘
         ▲                              ▲
    Kali (Tailscale)             Cel (Tailscale)
    100.103.82.104               100.76.111.99
```

## Agentes

| Agente | Tag | Keywords | Rol |
|--------|-----|----------|-----|
| **Kali** | `@kali` | code, bug, fix, test, review, git | Codigo y debugging |
| **VPS** | `@vps` | build, deploy, server, docker, pm2 | Infraestructura |
| **Cel** | `@cel` | screen, mobile, touch, capacitor | App movil |

## Infraestructura

| Servicio | Puerto | Descripcion |
|----------|--------|-------------|
| `alcon-server` | 3003 | Fastify + Socket.io (API + chat) |
| `alcon-pwa` | 5176 | PWA estática (pm2 serve --spa) |
| `alcon-api` | 3001 | API legacy |
| Tailscale | — | VPN mesh (Kali ↔ VPS ↔ Cel) |

## URL de Acceso

- **Cel/Kali via Tailscale**: `http://100.102.63.30:5176`
- **Local (dev)**: `http://localhost:5175` (vite dev server)
- **API directa**: `http://100.102.63.30:3003`

## API Endpoints

### Tasks

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| `POST` | `/api/task` | Crear tarea (auto-route por tag) |
| `GET` | `/api/tasks` | Listar tareas (`?agent=vps&status=pendiente`) |
| `GET` | `/api/task/:id` | Detalle de tarea |
| `POST` | `/api/task/:id/claim` | Agente toma la tarea (locking) |
| `POST` | `/api/task/:id/heartbeat` | Extender lock +10min |
| `POST` | `/api/task/:id/message` | Enviar mensaje al chat de tarea |
| `GET` | `/api/task/:id/messages` | Obtener mensajes de tarea |
| `POST` | `/api/task/:id/complete` | Marcar como hecha |
| `POST` | `/api/task/:id/error` | Marcar con error |

### Agent Control (Interruptor Maestro)

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| `GET` | `/api/agents` | Estado de todos los agentes |
| `POST` | `/api/agent/:name/start` | Prender agente |
| `POST` | `/api/agent/:name/stop` | Apagar agente |

### System

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| `GET` | `/health` | Health check + version |
| `GET` | `/api/status` | Estado del sistema (tasks + agents) |
| `POST` | `/api/ping` | Registro de agente |

## Socket.io — Namespace `/enjambre`

### Eventos Client → Server

| Evento | Payload | Descripcion |
|--------|---------|-------------|
| `chat:join` | `{ name }` | Unirse al chat (identifica al usuario) |
| `chat:message` | `{ from, text }` | Enviar mensaje grupal |
| `typing:start` | — | Indicar que esta escribiendo |
| `typing:stop` | — | Dejar de escribir |
| `chat:heartbeat` | — | Keepalive (cada 5s) |

### Eventos Server → Client

| Evento | Payload | Descripcion |
|--------|---------|-------------|
| `chat:history` | `ChatMessage[]` | Historial al conectarse (ultimos 50) |
| `chat:message` | `ChatMessage` | Nuevo mensaje broadcast |
| `presence:update` | `{ peers: Peer[] }` | Estado de todos los peers |

### Presence States

| Estado | Color | Significado |
|--------|-------|-------------|
| `vivo` | Verde | Conectado y activo |
| `escribiendo` | Amber pulse | Escribiendo ahora |
| `idle` | Gris | Agente disponible pero sin socket |
| `muerto` | Rojo | Desconectado o >15s sin heartbeat |

## Task Schema

```json
{
  "id": 123456,
  "text": "haz deploy del server",
  "original_text": "@vps haz deploy del server",
  "status": "pendiente|en_proceso|hecho|error",
  "assigned_to": "vps",
  "lock_owner": null,
  "lock_acquired_at": null,
  "lock_expires_at": null,
  "last_heartbeat": null,
  "messages": [],
  "result": null,
  "created": "2026-07-21T18:00:00Z"
}
```

## Sistema de Locking

1. Agente lee tareas pendientes
2. Intenta `claim` con su nombre como owner
3. Si exitoso: `status=en_proceso`, `lock_expires_at=now+10min`
4. Cada 2min: envia `heartbeat` para extender lock
5. Si lock expira: `stale reclaim` automatico cada 30s

## Persistencia

| Archivo | Contenido | Max |
|---------|-----------|-----|
| `tasks.json` | Tareas + mensajes por tarea | Sin limite |
| `messages.json` | Chat grupal del enjambre | 50 mensajes (rotacion) |

## Desarrollo Local

```bash
# Server
cd server && npm install && npm run dev    # :3002

# PWA
cd pwa && npm install && npm run dev       # :5175

# Agente
cd agents && node agent.js kali http://localhost:3002
```

## Deploy al VPS

```bash
# Automatico
./deploy.sh

# Manual
scp -r server/* ubuntu@159.54.143.227:/home/ubuntu/alcon/server/
ssh ubuntu@159.54.143.227 "cd /home/ubuntu/alcon/server && npm install --production && pm2 restart alcon-server --update-env"
```

## PM2 en VPS

```bash
pm2 list                          # Ver todos los procesos
pm2 logs alcon-server --lines 20  # Logs recientes
pm2 restart alcon-server          # Reiniciar
pm2 save                          # Guardar configuracion
```

## Android App (Capacitor)

### Setup
```bash
cd pwa && npm install
npx cap add android
npx cap sync android
```

### Build & Install
```bash
cd pwa/android
JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64 ANDROID_HOME=/usr/lib/android-sdk \
  ./gradlew assembleDebug --no-daemon -x lint -x test
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

### Mixed Content Fix (CRITICAL)
El WebView de Capacitor carga desde `https://localhost` y bloquea requests HTTP (Mixed Content).

**Solución**: Servir la PWA desde el VPS en vez de assets bundled.

```ts
// capacitor.config.ts
server: {
  url: 'http://100.102.63.30:5176',  // PWA en VPS
  cleartext: true,
  androidScheme: 'http',
}
```

**NO usar** `server.url` con `https://` (necesita cert). NO dejar sin `url` (carga bundled → Mixed Content).

### APK Output
`pwa/android/app/build/outputs/apk/debug/app-debug.apk`

## Bugs Conocidos

### Crash Loop por `presence` (resuelto)
- **Problema**: `const presence = new Map()` dentro de `fastify.listen()` callback, pero `broadcastPresence()` lo usaba desde endpoints fuera del callback → `ReferenceError` → pm2 restart loop
- **Fix**: Mover `presence` y `broadcastPresence()` a module scope

### CORS Cross-Origin (resuelto)
- **Problema**: PWA en `:5176` hace fetch a `:3003` → browser bloquea
- **Fix**: CORS explícito en `@fastify/cors` Y Socket.io `cors` (son capas independientes)
- **Nota**: `origin: true` reflection NO sirve para Socket.io, necesita array explícito

### Capacitor Mixed Content (resuelto)
- **Problema**: WebView carga desde `https://localhost` → bloquea HTTP requests a `http://100.102.63.30:3003`
- **Fix**: `server.url: 'http://100.102.63.30:5176'` en `capacitor.config.ts`
- **Causa**: Capacitor usa HTTPS internamente, pero VPS no tiene cert
