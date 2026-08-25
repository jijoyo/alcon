# Plan: Persistencia del Agent Cel en Termux

> Para presentar al agente Debian en forja. Solo plan, sin ejecutar.

## Problema

El agent `cel` (Socket.IO en `agents/agent.js`) se muere cuando:
1. Android mata procesos por RAM baja (1GB Redmi Note 11)
2. El usuario swipea Termux de recientes
3. Reboot del dispositivo

**Root cause**: Android 13 Phantom Process Killer + OOM killer. Con 1GB RAM, Cel es el dispositivo más vulnerable del enjambre.

## Solución propuesta (3 capas)

### Capa 1 — Prevenir muerte (sin modificar código)

**Acciones manuales del usuario (una vez):**
1. Settings → Apps → Termux → Battery → **Unrestricted**
2. Abrir Termux → notificación → tocar **"Acquire WakeLock"**
3. (Opcional, necesita PC) ADB:
   ```
   adb shell settings put global settings_enable_monitor_phantom_procs false
   ```

**Efecto**: Reduce probabilidad de kill de ~80% a ~20%. No elimina el riesgo.

### Capa 2 — Auto-relanzamiento al abrir Termux

**Archivo a modificar**: `~/.bashrc`

```bash
# Auto-relaunch cel agent if not running
if ! pgrep -f "agent.js cel" > /dev/null 2>&1; then
  cd ~/alcon && nohup node agents/agent.js cel http://100.102.63.30:3003 &>/data/data/com.termux/files/home/cel-agent.log &
  disown
fi
```

**Efecto**: Cada vez que el usuario abre Termux, el agent se relanza automáticamente.

### Capa 3 — Auto-relanzamiento al reboot (requiere Termux:Boot)

**Requisito**: Instalar **Termux:Boot** desde F-Droid (app separada, no se puede por pkg)

**Archivo a crear/modificar**: `~/.termux/boot/alcon-boot.sh`

```bash
#!/data/data/com.termux/files/usr/bin/bash
termux-wake-lock
sleep 10  # Wait for network
cd ~/alcon && nohup node agents/agent.js cel http://100.102.63.30:3003 &>/data/data/com.termux/files/home/cel-agent.log &
disown
```

**Efecto**: Al hacer reboot, el agent arranca automáticamente.

## Archivos involucrados

| Archivo | Acción | ¿Quién ejecuta? |
|---------|--------|-----------------|
| `~/.bashrc` | Agregar auto-relaunch block | Forja (edición) |
| `~/.termux/boot/alcon-boot.sh` | Agregar agent start | Cel (edición) |
| Termux:Boot app | Instalar desde F-Droid | Usuario (manual) |
| Settings Android | Battery → Unrestricted | Usuario (manual) |

## Limitaciones conocidas

1. **Swipe de Termux**: Si el usuario mata Termux, todo muere. `.bashrc` solo funciona si Termux se vuelve a abrir.
2. **1GB RAM**: Con tan poca RAM, Android mata procesos agresivamente. WakeLock ayuda pero no garantiza.
3. **Termux:Boot one-shot**: Solo dispara una vez al reboot. Si el agent muere después, no se relanza hasta próximo reboot o apertura de Termux.
4. **Sin tunnel inverso**: El VPS no puede relanzar el agent de Cel. Solo Cel puede conectarse al VPS.

## Comparativa de opciones

| Opción | Complejidad | Efectividad | Sobrevive swipe | Sobrevive reboot |
|--------|------------|-------------|-----------------|------------------|
| WakeLock + Battery Unrestricted | Baja | Media | Sí | No |
| `.bashrc` auto-relaunch | Baja | Alta | Sí (al reabrir) | No |
| Termux:Boot | Media | Alta | No | Sí |
| ADB phantom killer disable | Alta | Muy alta | Sí | Sí (hasta update) |
| **Combinación (plan completo)** | **Media** | **Alta** | **Sí** | **Sí** |

## Siguiente paso

1. Presentar este plan a Debian en forja
2. Debian revisa y sugiere cambios
3. Ejecutar en orden:
   - Forja edita `~/.bashrc` (auto-relaunch)
   - Usuario instala Termux:Boot + edita boot script
   - Usuario ajusta settings de battery
