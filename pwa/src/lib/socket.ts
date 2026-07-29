import { io, Socket } from 'socket.io-client';

const BASE = import.meta.env.VITE_API_URL || '';
const NAMESPACE = '/enjambre';

let socket: Socket | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let listeners: Array<{ event: string; fn: (...args: any[]) => void }> = [];

export type Peer = {
  name: string;
  status: 'vivo' | 'muerto' | 'idle' | 'escribiendo';
  typing: boolean;
};

export type ChatMessage = {
  id: string;
  from: string;
  text: string;
  timestamp: string;
};

export function getSocket(): Socket {
  if (!socket) {
    socket = io(`${BASE}${NAMESPACE}`, {
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity
    });

    socket.on('connect', () => {
      console.log('[WS] Connected to enjambre');
    });

    socket.on('disconnect', (reason) => {
      console.log('[WS] Disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      console.error('[WS] Connection error:', err.message);
    });
  }
  return socket;
}

export function joinChat(name: string) {
  const s = getSocket();
  s.emit('chat:join', { name });
}

export function sendChatMessage(from: string, text: string) {
  const s = getSocket();
  s.emit('chat:message', { from, text });
}

export function startTyping() {
  const s = getSocket();
  s.emit('typing:start');
}

export function stopTyping() {
  const s = getSocket();
  s.emit('typing:stop');
}

export function sendHeartbeat() {
  const s = getSocket();
  s.emit('chat:heartbeat');
}

export function onChatMessage(fn: (msg: ChatMessage) => void) {
  const s = getSocket();
  const handler = (msg: ChatMessage) => fn(msg);
  s.on('chat:message', handler);
  listeners.push({ event: 'chat:message', fn: handler });
  return () => {
    s.off('chat:message', handler);
    listeners = listeners.filter(l => l.fn !== handler);
  };
}

export function onChatHistory(fn: (msgs: ChatMessage[]) => void) {
  const s = getSocket();
  const handler = (msgs: ChatMessage[]) => fn(msgs);
  s.on('chat:history', handler);
  listeners.push({ event: 'chat:history', fn: handler });
  return () => {
    s.off('chat:history', handler);
    listeners = listeners.filter(l => l.fn !== handler);
  };
}

export function onPresenceUpdate(fn: (data: { peers: Peer[] }) => void) {
  const s = getSocket();
  const handler = (data: { peers: Peer[] }) => fn(data);
  s.on('presence:update', handler);
  listeners.push({ event: 'presence:update', fn: handler });
  return () => {
    s.off('presence:update', handler);
    listeners = listeners.filter(l => l.fn !== handler);
  };
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
    listeners = [];
  }
}
