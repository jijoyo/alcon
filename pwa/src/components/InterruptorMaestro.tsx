import { useState, useEffect } from 'react';
import { Power, RefreshCw } from 'lucide-react';

const BASE = import.meta.env.VITE_API_URL || '';

interface AgentState {
  name: string;
  running: boolean;
}

const AGENT_COLORS: Record<string, string> = {
  kali: 'text-blue-400',
  vps: 'text-emerald-400',
  cel: 'text-purple-400'
};

export function InterruptorMaestro() {
  const [agents, setAgents] = useState<AgentState[]>([]);
  const [loading, setLoading] = useState<string | null>(null);

  const fetchAgents = async () => {
    try {
      const res = await fetch(`${BASE}/api/agents`);
      const data = await res.json();
      setAgents(data.agents);
    } catch (e) {
      console.error('Failed to fetch agents:', e);
    }
  };

  useEffect(() => {
    fetchAgents();
    const interval = setInterval(fetchAgents, 10000);
    return () => clearInterval(interval);
  }, []);

  const toggleAgent = async (name: string, running: boolean) => {
    setLoading(name);
    try {
      const endpoint = running ? 'stop' : 'start';
      await fetch(`${BASE}/api/agent/${name}/${endpoint}`, { method: 'POST' });
      await fetchAgents();
    } catch (e) {
      console.error(`Failed to toggle ${name}:`, e);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Interruptor Maestro</span>
        <button onClick={fetchAgents} className="text-slate-500 hover:text-slate-300 transition-colors">
          <RefreshCw size={12} />
        </button>
      </div>

      {agents.map(agent => (
        <div
          key={agent.name}
          className="flex items-center justify-between bg-slate-800/50 rounded-lg px-3 py-2"
        >
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${agent.running ? 'bg-emerald-400' : 'bg-red-400'}`} />
            <span className={`text-sm font-medium ${AGENT_COLORS[agent.name] || 'text-slate-300'}`}>
              {agent.name.toUpperCase()}
            </span>
          </div>
          <button
            onClick={() => toggleAgent(agent.name, agent.running)}
            disabled={loading === agent.name}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              agent.running
                ? 'bg-emerald-400/10 text-emerald-400 hover:bg-red-400/10 hover:text-red-400'
                : 'bg-red-400/10 text-red-400 hover:bg-emerald-400/10 hover:text-emerald-400'
            } disabled:opacity-50`}
          >
            {loading === agent.name ? (
              <RefreshCw size={12} className="animate-spin" />
            ) : (
              <Power size={12} />
            )}
            {agent.running ? 'Activo' : 'Dormido'}
          </button>
        </div>
      ))}
    </div>
  );
}
