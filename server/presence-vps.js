import { io } from 'socket.io-client';
const URL = 'http://100.102.63.30:3003/enjambre';
const AGENT = 'vps';
const s = io(URL, { transports: ['websocket','polling'] });

s.on('connect', () => {
  console.log('connected as', AGENT, s.id);
  s.emit('chat:join', { name: AGENT });
  setInterval(() => s.emit('chat:heartbeat'), 5000);
});

s.on('presence:update', (d) => console.log('presence:', JSON.stringify(d).slice(0,200)));
s.on('chat:history', (h) => console.log('history', h.length));
s.on('disconnect', () => console.log('disconnected'));
