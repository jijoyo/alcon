#!/usr/bin/env node
// sonda-dm: verifica que un DM a un agente recibe respuesta en el chat.
// Uso: node tools/sonda-dm.cjs "@debian-forja pregunta" (timeout 90s, exit 0/1)
const { io } = require('/home/israel/Documentos/alcon/agents/node_modules/socket.io-client');
const text = process.argv[2] || '@debian-forja ping sonda';
const socket = io('http://127.0.0.1:3003/enjambre', { transports: ['websocket', 'polling'] });
const t0 = Date.now();
socket.on('connect', () => {
  socket.emit('chat:join', { name: 'sonda' });
  setTimeout(() => socket.emit('chat:message', { from: 'sonda', text }), 500);
});
socket.on('chat:message', (m) => {
  if (m.from === 'debian-forja' || m.from === 'system') {
    console.log(`RESPUESTA [${Math.round((Date.now() - t0) / 1000)}s] ${m.from}: ${String(m.text).slice(0, 200)}`);
    process.exit(0);
  }
});
setTimeout(() => { console.log('SIN RESPUESTA en 90s'); process.exit(1); }, 90000);
