# Plan Infra‑Deploy 2026-08-29

## Observación (Entender tu contexto)
1. **Hardware** – PC con RTX 3060 12 GB, 30 GB RAM, Ubuntu 23.10.  
2. **Servidor remoto** – Oracle VPS Free‑Tier (1 vCPU / 1 GB), IP Tailscale `100.102.63.30`.  
3. **Software existente** – Tailscale, UFW, Systemd, Opencode 1.17, local llama‑cpp (deberá compilarse), Ominiroute (listening on 8080).  
4. **Backup** – disco mecánico USB 3‑0 (1 TB) montado en `/mnt/vps-bk`.  
5. **Control móvil** – Moshi + Telegram Bot (configurado pero no activo).  
6. **IP pública** del VPS y PC no expuestas al Internet.

## Orientación (Investigar opciones)
| Tema | Herramienta | Resultado esperado |
|------|-------------|--------------------|
| Backup incremental | `rsync` con `-a` y `--delete` | Copia de /home y /etc del VPS a disco
| Oml‑Route con llama‑cpp | Docker‑unplugged installation (`omniroute` CLI) | Endpoint `http://<Tailscale-IP>:8080/v1/chat/completions` que llama a Llama‑cpp
| Persistencia de sesiones | `herdr`, `systemd` con `Restart=no` + `loginctl enable-linger` | Agentes y el servidor siguen vivos después de cerrar SSH
| Seguridad de red | `ufw` con reglas de entrada 22/8080/3000 bloqueadas por default | Ningún puerto abierto al público
| Notificación push | Telegram Bot + websocket, Moshi | Mensajes de estado en móvil al ejecutarse prompts
| Automatizar backup | `cron` con `rsync` | Backup diario de VPS en disco externo

## Decisión (Plan ejecutable)
1. Compilar **llama‑cpp** con soporte CUDA en PC.
2. Instalar **omniroute** y levantar el servidor de LLM local (PCI).
3. Configurar **Opencode** para usar `omniroute` como provider (`provider.baseURL = "http://<Tailscale-CPU>:8080"`).
4. En el VPS, instalar **UFW** y agregar reglas: 
   - `allow proto tcp from <Tailscale-PC> to any port 8080`
   - `allow proto tcp from <Tailscale-PC> to any port 3000`
   - `deny in on any to any port 22` (solo Tailscale)
5. Crear *orquestador* Node/Express que exponga `/prompt` y reenvíe a `omniroute`.
6. Habilitar **Herdr** y **systemd** con `Restart=no` + `loginctl enable-linger` en PC y VPS.
7. Instalar **Telegram Bot** con webhook apuntando al VPS‐3000.
8. Configurar **Moshi** para autoconectar al bot.
9. Programar **rsync backup**: `0 2 * * * rsync -az -e ssh root@100.102.63.30:/home/ sshuser@<PC>/mnt/vps-bk/backup`.
10. Documentar los pasos en Engram al finalizar.

## Acción (Paradas de aprobación)
1. **Aprobación** antes de compilar Llama‑cpp (requiere 30 min de tiempo de CPU).  
2. **Aprobación** antes de instalar `omniroute` (necesita red).  
3. **Aprobación** antes de modificar UFW (cuelgue de acceso).  
4. **Aprobación** antes de desplegar el orquestador (cambia puerto de 3000).  
5. **Aprobación** antes de habilitar `loginctl enable-linger` (pérdida de sesiones).  
6. **Aprobación** antes de configurar el bot de Telegram.  
7. **Aprobación** antes de ejecutar el script de backup automática.

## Documentación y aprendizaje
- Al terminar cada fase, guardaremos en Engram (`mem_save`) una entrada sobre los cambios y los conceptos aprendidos.  
- Mantendremos el plan y el código de operación en `~/.opencode/plans/infra‑deploy.md`.

---
*Este plan se implementará de manera iterativa; se validará con pruebas de ping y de `curl` antes de cada fase de ejecución.*
