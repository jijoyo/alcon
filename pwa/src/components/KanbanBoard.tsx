import { useState, useEffect, useCallback } from 'react';
import { taskApi, type Task, type Stage } from '../lib/api';
import { stageColor, stageLabel } from '../lib/utils';
import { onTaskUpdated } from '../lib/socket';
import { TaskCard } from './TaskCard';

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
    const cleanup = onTaskUpdated(({ id, stage }) => {
      setTasksByStage(prev => {
        const next = { ...prev };
        let movedTask: Task | null = null;
        for (const col of Object.keys(next)) {
          const idx = next[col].findIndex(t => t.id === id);
          if (idx !== -1) {
            movedTask = next[col][idx];
            next[col] = [...next[col].slice(0, idx), ...next[col].slice(idx + 1)];
            break;
          }
        }
        if (movedTask) {
          const updatedTask = { ...movedTask, stage: stage as Stage };
          next[stage] = [...(next[stage] || []), updatedTask];
        }
        return next;
      });
    });
    return cleanup;
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
                <TaskCard
                  key={task.id}
                  task={task}
                  onAdvance={stage !== 'done' ? handleAdvance : undefined}
                  onRegress={stage !== 'backlog' ? handleRegress : undefined}
                />
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
