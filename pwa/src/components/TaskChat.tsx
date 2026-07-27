import { useState, useRef, useEffect } from 'react';
import { Send, User } from 'lucide-react';
import { taskApi, type Task, type Message } from '../lib/api';
import { agentColor, timeAgo } from '../lib/utils';

interface TaskChatProps {
  task: Task;
  onTaskUpdate: (task: Task) => void;
}

export function TaskChat({ task, onTaskUpdate }: TaskChatProps) {
  const [messages, setMessages] = useState<Message[]>(task.messages || []);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(task.messages || []);
  }, [task.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput('');
    setSending(true);

    try {
      const msg = await taskApi.message(task.id, 'user', text);
      setMessages(prev => [...prev, msg]);
    } catch (e) {
      console.error('Failed to send message:', e);
      setInput(text); // restore
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 && (
          <div className="text-center text-slate-500 text-sm py-8">
            Sin mensajes. Envia el primero.
          </div>
        )}
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex gap-2 ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                msg.from === 'user'
                  ? 'bg-blue-600 text-white'
                  : `border ${agentColor(msg.from)}`
              }`}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="font-medium text-xs opacity-70">{msg.from}</span>
                <span className="text-[10px] opacity-50">{timeAgo(msg.timestamp)}</span>
              </div>
              <div className="whitespace-pre-wrap break-words">{msg.text}</div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-slate-800 p-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe un mensaje..."
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            disabled={sending}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg px-3 py-2 transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
