import { useState, useEffect, useCallback } from 'react';
import { Activity, List, BarChart3, MessageSquare, LayoutGrid, Database } from 'lucide-react';
import { taskApi, type Task } from './lib/api';
import { TaskInput, TaskList } from './components/TaskInput';
import { TaskChat } from './components/TaskChat';
import { StatusPanel } from './components/StatusPanel';
import { ChatView } from './components/ChatView';
import { InterruptorMaestro } from './components/InterruptorMaestro';
import { KanbanBoard } from './components/KanbanBoard';
import RuntimeBanner from './components/RuntimeBanner.jsx';
import { MemoriaBuscador } from './components/MemoriaBuscador';

type View = 'tasks' | 'kanban' | 'status' | 'chat' | 'memoria';

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [view, setView] = useState<View>('tasks');
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    try {
      const agent = filter === 'all' ? undefined : filter;
      const data = await taskApi.list(agent);
      setTasks(data.tasks.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime()));
    } catch (e) {
      console.error('Failed to fetch tasks:', e);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 5000);
    return () => clearInterval(interval);
  }, [fetchTasks]);

  const selectedTask = tasks.find(t => t.id === selectedId) || null;

  const handleTaskCreated = (task: Task) => {
    setTasks(prev => [task, ...prev]);
  };

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity size={20} className="text-blue-400" />
            <h1 className="text-lg font-bold text-slate-100">Alcon</h1>
            <span className="text-xs text-slate-500">Multi-Agent Tasks</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setView('tasks')}
              className={`p-2 rounded-lg transition-colors ${
                view === 'tasks' ? 'bg-slate-800 text-blue-400' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <List size={18} />
            </button>
            <button
              onClick={() => setView('chat')}
              className={`p-2 rounded-lg transition-colors ${
                view === 'chat' ? 'bg-slate-800 text-blue-400' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <MessageSquare size={18} />
            </button>
            <button
              onClick={() => setView('kanban')}
              className={`p-2 rounded-lg transition-colors ${
                view === 'kanban' ? 'bg-slate-800 text-blue-400' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <LayoutGrid size={18} />
            </button>
            <button
              onClick={() => setView('status')}
              className={`p-2 rounded-lg transition-colors ${
                view === 'status' ? 'bg-slate-800 text-blue-400' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <BarChart3 size={18} />
            </button>
            <button
              onClick={() => setView('memoria')}
              className={`p-2 rounded-lg transition-colors ${
                view === 'memoria' ? 'bg-slate-800 text-purple-400' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Database size={18} />
            </button>
          </div>
        </div>
      </header>

      <RuntimeBanner />

      <main className="max-w-6xl mx-auto px-4 py-4">
        {view === 'chat' ? (
          /* Chat view — full screen */
          <div className="flex flex-col md:flex-row gap-4 h-[calc(100vh-80px)]">
            {/* Chat panel */}
            <div className="flex-1 bg-slate-900/50 rounded-xl border border-slate-800 flex flex-col overflow-hidden min-h-0">
              <ChatView />
            </div>
            {/* Master switch sidebar — below on mobile, right on desktop */}
            <div className="md:w-56 flex-shrink-0">
              <InterruptorMaestro />
            </div>
          </div>
        ) : (
          <>
            {/* Task Input */}
            <div className="mb-4">
              <TaskInput onTaskCreated={handleTaskCreated} />
            </div>

            {view === 'tasks' ? (
              <div className="flex flex-col md:flex-row gap-4 h-[calc(100vh-180px)]">
                {/* Sidebar: task list */}
                <div className="md:w-80 flex-shrink-0 flex flex-col">
                  {/* Filter tabs */}
                  <div className="flex gap-1 mb-3 overflow-x-auto">
                    {['all', 'vps', 'kali', 'cel'].map(f => (
                      <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                          filter === f
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {f === 'all' ? 'Todos' : f.toUpperCase()}
                      </button>
                    ))}
                  </div>

                  {/* Task list */}
                  <div className="flex-1 overflow-y-auto">
                    {loading ? (
                      <div className="text-center text-slate-500 text-sm py-8">Cargando...</div>
                    ) : (
                      <TaskList
                        tasks={tasks}
                        selectedId={selectedId}
                        onSelect={setSelectedId}
                        refresh={fetchTasks}
                      />
                    )}
                  </div>
                </div>

                {/* Main: chat / detail */}
                <div className="flex-1 bg-slate-900/50 rounded-xl border border-slate-800 flex flex-col">
                  {selectedTask ? (
                    <>
                      {/* Task header */}
                      <div className="border-b border-slate-800 p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono text-slate-500">#{selectedTask.id}</span>
                          <span className="text-sm font-medium text-slate-200">{selectedTask.text}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <span>Agente: {selectedTask.assigned_to || 'sin asignar'}</span>
                          <span>Estado: {selectedTask.status}</span>
                          {selectedTask.result && <span>Resultado: {selectedTask.result}</span>}
                        </div>
                      </div>
                      {/* Chat */}
                      <div className="flex-1 min-h-0">
                        <TaskChat task={selectedTask} onTaskUpdate={fetchTasks} />
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-slate-600">
                      <div className="text-center">
                        <MessageSquare size={48} className="mx-auto mb-3 opacity-30" />
                        <div className="text-sm">Selecciona una tarea para ver el chat</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : view === 'kanban' ? (
              /* Kanban Board */
              <div className="h-[calc(100vh-140px)]">
                <KanbanBoard />
              </div>
            ) : view === 'memoria' ? (
              /* Memoria RAG */
              <div className="max-w-2xl mx-auto">
                <MemoriaBuscador />
              </div>
            ) : (
              /* Status view */
              <div className="max-w-md mx-auto">
                <StatusPanel onRefresh={fetchTasks} />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
