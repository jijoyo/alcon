import { useState } from 'react';
import { Plus, Download } from 'lucide-react';
import { taskApi, getArtifacts, API_BASE, type Task } from '../lib/api';
import { agentColor, timeAgo, timeUntil, statusColor, statusLabel } from '../lib/utils';

interface TaskInputProps {
  onTaskCreated: (task: Task) => void;
}

export function TaskInput({ onTaskCreated }: TaskInputProps) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!text.trim() || loading) return;
    setLoading(true);
    try {
      const task = await taskApi.create(text.trim());
      onTaskCreated(task);
      setText('');
    } catch (e) {
      console.error('Failed to create task:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex gap-2">
      <input
        type="text"
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="@vps haz deploy  |  @kali revisa bug  |  @cel prueba app"
        className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
        disabled={loading}
      />
      <button
        onClick={handleSubmit}
        disabled={!text.trim() || loading}
        className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg px-4 py-2.5 font-medium text-sm transition-colors flex items-center gap-2"
      >
        <Plus size={16} />
        {loading ? '...' : 'Enviar'}
      </button>
    </div>
  );
}

interface TaskListProps {
  tasks: Task[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  refresh: () => void;
}

export function TaskList({ tasks, selectedId, onSelect, refresh }: TaskListProps) {
  return (
    <div className="space-y-1">
      {tasks.length === 0 && (
        <div className="text-center text-slate-500 text-sm py-8">
          No hay tareas. Crea una con @tag.
        </div>
      )}
      {tasks.map(task => {
        const artifacts = getArtifacts(task);
        return (
          <button
            key={task.id}
            onClick={() => onSelect(task.id)}
            className={`w-full text-left rounded-lg p-3 transition-colors ${
              selectedId === task.id
                ? 'bg-slate-700/50 border border-slate-600'
                : 'hover:bg-slate-800/50 border border-transparent'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-mono px-1.5 py-0.5 rounded border ${agentColor(task.assigned_to || 'user')}`}>
                  {task.assigned_to || '?'}
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${statusColor(task.status)}`}>
                  {statusLabel(task.status)}
                </span>
              </div>
              <span className="text-xs text-slate-500">{timeAgo(task.created)}</span>
            </div>
            <div className="text-sm text-slate-200 truncate">{task.text}</div>
            {task.status === 'en_proceso' && task.lock_expires_at && (
              <div className="text-xs text-slate-500 mt-1">
                Lock: {timeUntil(task.lock_expires_at)}
              </div>
            )}
            {task.messages.length > 0 && (
              <div className="text-xs text-slate-500 mt-1">
                {task.messages.length} mensaje{task.messages.length !== 1 ? 's' : ''}
              </div>
            )}
            {artifacts.length > 0 && (
              <div className="flex gap-1 mt-2 flex-wrap">
                {artifacts.map(f => (
                  <a
                    key={f}
                    href={`${API_BASE}/api/artifacts/${f}`}
                    target="_blank"
                    download
                    onClick={e => e.stopPropagation()}
                    className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded"
                  >
                    <Download size={10} />
                    {f}
                  </a>
                ))}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
