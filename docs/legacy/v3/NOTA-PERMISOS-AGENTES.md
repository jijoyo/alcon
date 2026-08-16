# Nota: Sistema de Permisos de Agentes en Alcon

## Implementado: v3.1-clean

### Archivos
- `server/lib/permisos.js` — Módulo de whitelist por agente
- `agents/agent.js` — Integrado antes de ejecutar bash/opencode

## Permisos por agente

| Agente | bash | write | deploy | git | gitRead | net | chat | list |
|--------|------|-------|--------|-----|---------|-----|------|------|
| **vps** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **kali** | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| **cel** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **reina** | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |

### Detalle de permisos

#### VPS (full access)
- Puede ejecutar cualquier comando bash
- Puede escribir archivos, hacer deploy, git push
- Acceso completo a red y sistema

#### Kali (readonly + net)
- Solo comandos de lectura (ls, cat, grep, etc.)
- Git: pull, status, log, diff (NO push a main)
- Net: curl, wget, ssh, scp, rsync
- Sin deploy, sin escritura

#### Cel (solo chat/list)
- Solo chat y listar tareas
- Sin ejecución de comandos
- Sin acceso a filesystem

#### Reina (desarrollo pesado)
- bash + write + git + net
- Sin deploy (deploy es solo VPS)

## Cómo funciona

```javascript
import { checkPermiso } from '../server/lib/permisos.js';

const result = checkPermiso('kali', 'git push origin main');
// { allowed: false, reason: 'kali: sin permiso git write' }

const result2 = checkPermiso('vps', 'pm2 restart alcon-api');
// { allowed: true, reason: 'bash OK' }
```

## Comandos bloqueados por patrón

### Escritura (requiere `write: true`)
- `git add/commit/push/rm/checkout/merge/rebase/reset/cherry-pick`
- `npm build/install/run/publish/uninstall`
- `yarn/pnpm add/remove/install/build`
- `deploy.sh`
- `rm -/rmdir`
- `chmod/chown`
- `systemctl/reboot/shutdown`
- `mv/cp/mkdir/touch`
- `echo > file`
- `sed -i`
- `tee`

### Deploy (requiere `deploy: true`)
- `deploy.sh`
- `pm2 restart/stop/delete/start`
- `systemctl`
- `reboot/shutdown`

### Git peligroso (requiere `git: true`)
- `git push`
- `git checkout/switch main/master`
- `git merge/rebase main/master`
- `git reset/revert --hard`

### Red (requiere `net: true`)
- `curl/wget/ssh/scp/rsync`
- `ping/dig/nslookup`
- `netstat/ss/ip/ifconfig/route`

## Pendientes

- [ ] Rate limiting por agente
- [ ] Sandbox para ejecución
- [ ] Auditoría de cambios
- [ ] Aprobación humana para cambios críticos
