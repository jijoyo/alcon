# HANDOFF CEL-EXPERIMENTAL - 28 Jul 2026 PM

**Estado:** experimental — merge conflicts resueltos, PWA desplegada, falta service worker
**Origen:** Cel (Termux) — trabajo de la tarde post e3ae728
**Main estable:** e3ae728 alcon enjambre v1 (VPS/GitHub)

## Qué se hizo en el Cel:

1. **Alcón server corriendo en Termux** (puerto 3002)
   - SQLite compilado con `@mmmbuto/better-sqlite3-termux` (fork para Android)
   - Node 26 requiere compilación manual (prebuilds incompatibles)
   - Solución: `cd node_modules/better-sqlite3 && npx node-gyp rebuild --release`

2. **PWA desplegada en Termux** (puerto 3004, PM2 serve)
   - Assets + manifest.json + icons copiados del VPS
   - URL WebSocket cambiada de `100.102.63.30:3003` a `localhost:3002`
   - PM2: `node $(which pm2) serve ~/alcon/pwa/dist 3004 --name alcon-pwa --spa`

3. **4 merge conflicts resueltos en server.js**
   - CORS: kept HEAD (credentials + allowedHeaders + OPTIONS)
   - /api/agents/status endpoint: kept HEAD (added)
   - Socket.io CORS: kept HEAD (origin: '*' + credentials + transports)
   - presence:request handler: kept HEAD (added)

4. **Chat funciona** (Socket.io /enjambre namespace)

## Qué falta (pendiente):

- **Service worker** — Chrome necesita `sw.js` registrado para instalar PWA como app
- Sin service worker, "Agregar a pantalla de inicio" se queda en "instalando"

## Archivos modificados vs main (e3ae728):

| Archivo | Cambio |
|---------|--------|
| `.gitignore` | Merge conflict resuelto (unificado) |
| `server/server.js` | 4 merge conflicts resueltos (HEAD wins) |
| `server/package.json` | `better-sqlite3` → `@mmmbuto/better-sqlite3-termux` |
| `server/package-lock.json` | Actualizado con fork termux |
| `pwa/dist/` | Nuevo: assets, manifest.json, icons, index.html |
| `REPORTE-NETA.md` | Nuevo: reporte de estado para Neta |

## Comandos para arrancar en Termux:

```bash
# API
cd ~/alcon/server && node server.js &

# PWA
node $(which pm2) serve ~/alcon/pwa/dist 3004 --name alcon-pwa --spa

# Verificar
curl http://localhost:3002/health
curl http://localhost:3004/
```

## Notas:

- PM2 muere al cambiar de app en Android (normal)
- Al volver a Termux hay que reiniciar servidores
- `server.js.bak` y `tasks.json.bak` son backups del VPS, se pueden borrar
