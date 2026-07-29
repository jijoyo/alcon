import { useState, useEffect } from 'react';
import { Power, RefreshCw } from 'lucide-react';
import { getSocket, onPresenceUpdate } from '../lib/socket';

const BASE = import.meta.env.VITE_API_URL || '';

const AGENTS = ['kali', 'vps', 'cel'];

const AGENT_COLORS: Record<string, string> = {
  kali: 'text-blue-400',
  vps: 'text-emerald-400',
  cel: 'text-purple-400'
};

export function InterruptorMaestro() {
  const [presence, setPresence] = useState<Map<string, boolean>>(new Map());
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    getSocket();
    const unsub = onPresenceUpdate(({ peers }) => {
      const map = new Map<string, boolean>();
      for (const p of peers) {
        map.set(p.name, p.status !== 'muerto');
      }
      setPresence(map);
    });
    return unsub;
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    getSocket().emit('presence:request');
    try {
      const res = await fetch(`${BASE}/api/agents/status`);
      const data = await res.json();
      const map = new Map<string, boolean>();
      for (const a of data.agents) {
        map.set(a.name, a.running);
      }
      setPresence(map);
    } catch (e) {
      console.error('Failed to fetch agents status:', e);
    } finally {
      setTimeout(() => setRefreshing(false), 1000);
    }
  };

  const toggleAgent = async (name: string, isAlive: boolean) => {
    try {
      const endpoint = isAlive ? 'stop' : 'start';
      await fetch(`${BASE}/api/agent/${name}/${endpoint}`, { method: 'POST' });
    } catch (e) {
      console.error(`Failed to toggle ${name}:`, e);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Interruptor Maestro</span>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {AGENTS.map(name => {
        const alive = presence.get(name) ?? false;
        return (
          <div
            key={name}
            className="flex items-center justify-between bg-slate-800/50 rounded-lg px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${alive ? 'bg-emerald-400' : 'bg-red-400'}`} />
              <span className={`text-sm font-medium ${AGENT_COLORS[name] || 'text-slate-300'}`}>
                {name.toUpperCase()}
              </span>
            </div>
            <button
              onClick={() => toggleAgent(name, alive)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                alive
                  ? 'bg-emerald-400/10 text-emerald-400 hover:bg-red-400/10 hover:text-red-400'
                  : 'bg-red-400/10 text-red-400 hover:bg-emerald-400/10 hover:text-emerald-400'
              }`}
            >
              <Power size={12} />
              {alive ? 'Activo' : 'Dormido'}
            </button>
          </div>
        );
      })}
    </div>
  );
}
