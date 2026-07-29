import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { taskApi, type Task, type Stage } from '../lib/api';
import { agentColor, statusColor, statusLabel, stageColor, stageLabel, timeAgo } from '../lib/utils';

const STAGES: Stage[] = ['backlog', 'plan', 'implement', 'test', 'review', 'done'];

export function KanbanBoard() {
  const [tasksByStage, setTasksByStage] = useState<Record<string, Task[]>>({});
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    try {
      const data = await taskApi.byStage();
      setTasksByStage(data);
    } catch (e) {
      console.error('Failed to fetch tasks by stage:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 5000);
    return () => clearInterval(interval);
  }, [fetchTasks]);

  const handleAdvance = async (id: number) => {
    try {
      await taskApi.advance(id);
      fetchTasks();
    } catch (e) {
      console.error('Failed to advance task:', e);
    }
  };

  const handleRegress = async (id: number) => {
    try {
      await taskApi.regress(id);
      fetchTasks();
    } catch (e) {
      console.error('Failed to regress task:', e);
    }
  };

  if (loading) {
    return (
      <div className="text-center text-slate-500 text-sm py-8">
        Cargando tablero...
      </div>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto h-[calc(100vh-140px)]">
      {STAGES.map((stage) => {
        const tasks = tasksByStage[stage] || [];
        return (
          <div
            key={stage}
            className="flex-shrink-0 w-64 bg-slate-900/30 rounded-xl border border-slate-800 flex flex-col"
          >
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${stageColor(stage)}`}>
                  {stageLabel(stage)}
                </span>
                <span className="text-xs text-slate-600">{tasks.length}</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="bg-slate-800/50 rounded-lg p-3 border border-slate-800"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-mono text-slate-500">#{task.id}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${statusColor(task.status)}`}>
                      {statusLabel(task.status)}
                    </span>
                  </div>
                  <div className="text-sm text-slate-200 mb-2 line-clamp-2">{task.text}</div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {task.assigned_to && (
                        <span className={`text-xs font-mono px-1.5 py-0.5 rounded border ${agentColor(task.assigned_to)}`}>
                          {task.assigned_to}
                        </span>
                      )}
                      <span className="text-xs text-slate-600">{timeAgo(task.created)}</span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleRegress(task.id)}
                        disabled={stage === 'backlog'}
                        className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-700 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                        title="Regresar"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <button
                        onClick={() => handleAdvance(task.id)}
                        disabled={stage === 'done'}
                        className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-700 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                        title="Avanzar"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {tasks.length === 0 && (
                <div className="text-xs text-slate-700 text-center py-6">
                  Vacío
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
