# Cómo conectarse a Alcon como agente

> Para: cualquier dispositivo que quiera unirse al enjambre Alcon
> Server: `http://100.102.63.30:3003` (VPS Oracle ARM)
> Branch: `v3.1-clean`

## Requisitos previos

1. **Node.js** (v18+) instalado
2. **Tailscale** conectado a la red `jijoyo202@gmail.com`
3. **Clone del repo** de Alcon
4. **opencode** instalado (para ejecutar tareas con IA)

## Paso 1: Clonar el repo

```bash
git clone git@github.com:jijoyo/alcon.git ~/alcon
cd ~/alcon
git checkout v3.1-clean
npm install  # solo si hay dependencias
```

## Paso 2: Verificar conexión al server

```bash
curl -s http://100.102.63.30:3003/health
```

Debe devolver JSON con `"status":"ok"`.

## Paso 3: Probar el agente manualmente

```bash
cd ~/alcon
node agents/agent.js <nombre-agente> http://100.102.63.30:3003
```

Ejemplos:
```bash
node agents/agent.js debian http://100.102.63.30:3003
node agents/agent.js kali http://100.102.63.30:3003
node agents/agent.js cel http://100.102.63.30:3003
```

Verificar que aparece "Socket connected" en la salida.

## Paso 4: Hacerlo persistente con systemd

### 4.1 Crear el service file

```bash
# Reemplazar <nombre> y <ruta-node> según el dispositivo
NOMBRE=debian  # okali, cel, etc.
NODE_PATH=$(which node)
RUTA_ALCON=~/alcon

mkdir -p ~/.config/systemd/user

cat > ~/.config/systemd/user/alcon-${NOMBRE}-agent.service << EOF
[Unit]
Description=Alcon ${NOMBRE} agent
After=network.target

[Service]
Type=simple
ExecStart=${NODE_PATH} ${RUTA_ALCON}/agents/agent.js ${NOMBRE} http://100.102.63.30:3003
WorkingDirectory=${RUTA_ALCON}
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=default.target
EOF
```

### 4.2 Activar el service

```bash
systemctl --user daemon-reload
systemctl --user enable alcon-${NOMBRE}-agent.service
systemctl --user start alcon-${NOMBRE}-agent.service
```

### 4.3 Verificar

```bash
systemctl --user status alcon-${NOMBRE}-agent.service
journalctl --user -u alcon-${NOMBRE}-agent -f
```

### 4.4 Activar linger (para que corra sin sesión)

```bash
loginctl enable-linger $(whoami)
```

## Paso 5: Verificar en la PWA

1. Abrir `http://100.102.63.30:3004`
2. El agente debe aparecer con estado "Activo" en el Interruptor Maestro
3. Mandar `@<nombre> hola` — debe contestar

## Comandos útiles

```bash
# Ver estado del agente
systemctl --user status alcon-<nombre>-agent

# Reiniciar
systemctl --user restart alcon-<nombre>-agent

# Parar
systemctl --user stop alcon-<nombre>-agent

# Ver logs en tiempo real
journalctl --user -u alcon-<nombre>-agent -f

# Verificar conexión al server
curl -s http://100.102.63.30:3003/health | python3 -m json.tool
```

## Variables de entorno opcionales

En el service file o antes de ejecutar agent.js:

```bash
export OPENCODE_BIN=/ruta/a/opencode     # por defecto: ~/.opencode/bin/opencode
export ALCON_WORKDIR=/ruta/a/alcon        # por defecto: ~/Documentos/alcon
export ALCON_API_URL=http://100.102.63.30:3003
```

## Permisos

Cada agente tiene permisos definidos en `server/lib/permisos.js`. Si tu agente no está listado, se usan los permisos por defecto (kali: readonly + net).

Para agregar un agente nuevo, editar `permisos.js` y `shared.js` (AGENTS + agentRunning).

## Troubleshooting

| Problema | Solución |
|----------|----------|
| "Socket error: connect ECONNREFUSED" | Tailscale no está conectado o el server está caído |
| "No such file: /home/ubuntu/.opencode/bin/opencode" | Los paths están hardcodeados — actualizar agent.js o usar env vars |
| Agente no aparece en PWA | Verificar que `agentRunning[agente] = true` en shared.js |
| Service falla con exit 203/EXEC | Node no está en `/usr/bin/node` — usar `which node` para encontrar la ruta |
| Agente no contesta | Verificar permisos en permisos.js, o que el agente tiene bash:true |
