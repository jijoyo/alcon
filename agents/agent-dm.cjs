const { io } = require('/data/data/com.termux/files/home/alcon/node_modules/socket.io-client');

const SERVER = 'http://100.102.63.30:3003';
const from = process.argv[2] || 'kali';
const to = process.argv[3] || 'debian';
const text = process.argv[4] || 'hola, esto es un test de comunicacion';

const socket = io(SERVER + '/enjambre', { transports: ['websocket', 'polling'] });

socket.on('connect', () => {
  console.log(`[${from}] Conectado al VPS`);
  socket.emit('chat:join', { name: from });
  
  setTimeout(() => {
    socket.emit('chat:message', { from, text });
    console.log(`[${from}] → ${to}: ${text}`);
    
    setTimeout(() => {
      socket.disconnect();
      process.exit(0);
    }, 1000);
  }, 1000);
});

socket.on('connect_error', (err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
