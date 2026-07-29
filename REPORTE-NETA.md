# Reporte para Neta: Alcón en Termux

**Fecha**: 2026-07-28
**Dispositivo**: Xiaomi Redmi Note 11 | Android 13 | Termux

---

## Qué hicimos

### 1. Alcón server funcionando en Termux
- Puerto 3002 (API + WebSocket)
- SQLite compilado con `@mmmbuto/better-sqlite3-termux` (Node 26)
- 4 merge conflicts resueltos en server.js

### 2. PWA desplegada
- Puerto 3004 (PM2 serve)
- Assets + manifest.json + icons copiados del VPS
- URL WebSocket cambiada de VPS (`100.102.63.30:3003`) a localhost (`localhost:3002`)

### 3. Chat funciona
- Socket.io /enjambre namespace operativo
- Mensajes se envían y reciben correctamente

---

## Pendiente (bug actual)

**La PWA no se instala en Android** — Chrome se queda en "instalando" sin completar.

**Causa**: Falta service worker. Chrome necesita un `sw.js` registrado para crear la WebAPK.

**Solución (pendiente)**:
1. Crear `sw.js` con cache básico
2. Agregar registro en `index.html`
3. Reiniciar PM2

---

## Comandos útiles

```bash
# Arrancar API
cd ~/alcon/server && node server.js &

# Arrancar PWA
node $(which pm2) restart alcon-pwa

# Verificar
curl http://localhost:3002/health
curl http://localhost:3004/
```

## Estado de servidores

| Servicio | Puerto | Estado |
|----------|--------|--------|
| API Server | 3002 | Activo (se reinicia al volver a Termux) |
| PWA | 3004 | Activo (mismo motivo) |

---

## Git
- Commit: `v3.0.0-enjambre` (VPS)
- Push pendiente (conflictos con remote)
- .gitignore creado
