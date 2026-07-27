import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Users } from 'lucide-react';
import {
  getSocket,
  joinChat,
  sendChatMessage,
  startTyping,
  stopTyping,
  sendHeartbeat,
  onChatMessage,
  onChatHistory,
  onPresenceUpdate,
  type ChatMessage,
  type Peer
} from '../lib/socket';
import { agentColor, timeAgo } from '../lib/utils';

const MY_NAME = 'israel';

export function ChatView() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null!);
  const [amITyping, setAmITyping] = useState(false);

  // Connect and join
  useEffect(() => {
    const s = getSocket();

    s.on('connect', () => {
      setConnected(true);
      joinChat(MY_NAME);
    });

    s.on('disconnect', () => {
      setConnected(false);
    });

    // If already connected, join now
    if (s.connected) {
      setConnected(true);
      joinChat(MY_NAME);
    }

    return () => {
      s.off('connect');
      s.off('disconnect');
    };
  }, []);

  // Listen for messages
  useEffect(() => {
    const unsubMsg = onChatMessage((msg) => {
      setMessages(prev => [...prev, msg]);
    });

    const unsubHistory = onChatHistory((history) => {
      setMessages(history);
    });

    const unsubPresence = onPresenceUpdate((data) => {
      setPeers(data.peers);
    });

    return () => {
      unsubMsg();
      unsubHistory();
      unsubPresence();
    };
  }, []);

  // Heartbeat every 5s
  useEffect(() => {
    const interval = setInterval(() => {
      if (connected) {
        sendHeartbeat();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [connected]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Typing detection
  const handleInput = (val: string) => {
    setInput(val);

    if (!amITyping) {
      setAmITyping(true);
      startTyping();
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setAmITyping(false);
      stopTyping();
    }, 3000);
  };

  const handleSend = useCallback(() => {
    if (!input.trim() || !connected) return;
    sendChatMessage(MY_NAME, input.trim());
    setInput('');

    if (amITyping) {
      setAmITyping(false);
      stopTyping();
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  }, [input, connected, amITyping]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Determine which peers are typing
  const typingPeers = peers.filter(p => p.typing && p.name !== MY_NAME);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-blue-400" />
          <span className="text-sm font-medium text-slate-200">Enjambre</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Presence dots */}
          {peers.filter(p => p.name !== MY_NAME).map(p => (
            <div key={p.name} className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${
                p.status === 'vivo' ? 'bg-emerald-400' :
                p.typing ? 'bg-amber-400 animate-pulse' :
                p.status === 'idle' ? 'bg-slate-500' :
                'bg-red-400'
              }`} />
              <span className={`text-xs ${agentColor(p.name).split(' ')[0]}`}>
                {p.name}
              </span>
            </div>
          ))}
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-red-400'}`} />
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-slate-500 text-sm py-8">
            {connected ? 'Sin mensajes. Escribe el primero.' : 'Conectando al enjambre...'}
          </div>
        )}
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex gap-2 ${msg.from === MY_NAME ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm ${
                msg.from === MY_NAME
                  ? 'bg-blue-600 text-white'
                  : msg.from === 'system'
                    ? 'bg-amber-600/20 border border-amber-400/30 text-amber-200'
                    : `border ${agentColor(msg.from)}`
              }`}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="font-medium text-xs opacity-70">
                  {msg.from === MY_NAME ? 'Tu' : msg.from}
                </span>
                <span className="text-[10px] opacity-50">{timeAgo(msg.timestamp)}</span>
              </div>
              <div className="whitespace-pre-wrap break-words">{msg.text}</div>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {typingPeers.length > 0 && (
          <div className="flex gap-2 justify-start">
            <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-sm text-slate-400">
              <div className="flex items-center gap-1.5">
                <span className="text-xs">
                  {typingPeers.map(p => p.name).join(', ')} escribiendo
                </span>
                <span className="flex gap-0.5">
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:300ms]" />
                </span>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-slate-800 p-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => handleInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={connected ? 'Escribe un mensaje...' : 'Conectando...'}
            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            disabled={!connected}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || !connected}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl px-4 py-2.5 transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
