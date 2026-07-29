import { useState, useEffect } from 'react';
import { Activity, Bot, Clock, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { taskApi, type SystemStatus } from '../lib/api';
import { agentColor, timeUntil, timeAgo } from '../lib/utils';

interface StatusPanelProps {
  onRefresh: () => void;
}

export function StatusPanel({ onRefresh }: StatusPanelProps) {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const s = await taskApi.status();
      setStatus(s);
    } catch (e) {
      console.error('Status fetch failed:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10_000);
    return () => clearInterval(interval);
  }, []);

  if (!status) {
    return (
      <div className="text-center text-slate-500 text-sm py-8">
        Cargando estado...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-300">Estado del Sistema</h3>
        <button
          onClick={fetchStatus}
          disabled={loading}
          className="text-slate-500 hover:text-slate-300 transition-colors"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-slate-800/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-blue-400">{status.total_tasks}</div>
          <div className="text-xs text-slate-500">Total</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-amber-400">
            {Object.values(status.agents).reduce((sum, a) => sum + a.pending, 0)}
          </div>
          <div className="text-xs text-slate-500">Pendientes</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-emerald-400">
            {Object.values(status.agents).reduce((sum, a) => sum + a.done, 0)}
          </div>
          <div className="text-xs text-slate-500">Completados</div>
        </div>
      </div>

      {/* Agent cards */}
      <div className="space-y-2">
        {Object.entries(status.agents).map(([name, agent]) => (
          <div key={name} className="bg-slate-800/50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Bot size={16} className={agentColor(name).split(' ')[0]} />
                <span className={`font-medium text-sm ${agentColor(name).split(' ')[0]}`}>
                  {name.toUpperCase()}
                </span>
              </div>
              <div className="flex gap-3 text-xs text-slate-500">
                <span>{agent.active} activa{agent.active !== 1 ? 's' : ''}</span>
                <span>{agent.pending} pend</span>
                <span>{agent.done} hecha{agent.done !== 1 ? 's' : ''}</span>
              </div>
            </div>

            {agent.active_tasks.length > 0 && (
              <div className="space-y-1 mt-2">
                {agent.active_tasks.map(task => (
                  <div key={task.id} className="flex items-center gap-2 text-xs">
                    <Activity size={12} className="text-blue-400 animate-pulse" />
                    <span className="text-slate-300 truncate flex-1">{task.text}</span>
                    <span className="text-slate-500">
                      {task.is_stale ? (
                        <span className="text-red-400">STALE</span>
                      ) : (
                        timeUntil(task.lock_expires_at)
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {agent.active_tasks.length === 0 && agent.active === 0 && (
              <div className="text-xs text-slate-600 mt-1">idle</div>
            )}
          </div>
        ))}
      </div>

      <div className="text-xs text-slate-600 text-center">
        v{status.version} | {timeAgo(status.timestamp)}
      </div>
    </div>
  );
}
