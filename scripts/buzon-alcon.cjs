// Buzon de alcon — escucha el enjambre y envía via archivo-cola
// Uso: node scripts/buzon-alcon.cjs
// Enviar mensaje:  echo "texto" > ~/.alcon-buzon/send.txt
const { io } = require('/home/israel/Documentos/alcon/agents/node_modules/socket.io-client');
const fs = require('fs');
const path = require('path');

const LOG = path.join(process.env.HOME, '.alcon-buzon', 'inbox.log');
const SEND = path.join(process.env.HOME, '.alcon-buzon', 'send.txt');
fs.mkdirSync(path.dirname(LOG), { recursive: true });

const socket = io('http://100.102.63.30:3003/enjambre', { reconnection: true, reconnectionDelay: 3000 });

function log(line) {
  const ts = new Date().toISOString().slice(11, 19);
  fs.appendFileSync(LOG, `[${ts}] ${line}\n`);
}

setInterval(() => {
  try {
    if (fs.existsSync(SEND)) {
      const text = fs.readFileSync(SEND, 'utf8').trim();
      if (text) {
        socket.emit('chat:message', { from: 'alcon', text });
        log('[alcon ENVIÓ] ' + text.slice(0, 100));
      }
      fs.unlinkSync(SEND);
    }
  } catch {}
}, 1500);

socket.on('connect', () => {
  log('[alcon-buzon] conectado ' + socket.id);
  socket.emit('chat:join', { name: 'alcon' });
});

socket.on('chat:message', (m) => {
  if (m.from === 'alcon') return;
  const paraMi = /alcon/i.test(m.text);
  log(`[${m.from}${paraMi ? ' ⚡PARA-MI' : ''}] ${m.text}`);
});

socket.on('agent:comms', (m) => log(`[COMMS ${m.from}→${m.to}] ${m.text}`));

socket.on('disconnect', (r) => {
  log('[alcon-buzon] desconectado: ' + r);
  if (r === 'io server disconnect') setTimeout(() => socket.connect(), 2000);
});
