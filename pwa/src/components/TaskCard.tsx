import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { API_BASE, type Task } from '../lib/api';
import { agentColor, statusColor, statusLabel, timeAgo } from '../lib/utils';

interface TaskCardProps {
  task: Task;
  onAdvance?: (id: number) => void;
  onRegress?: (id: number) => void;
}

function getArtifacts(task: Task): string[] {
  try {
    return JSON.parse(task.artifacts || '[]');
  } catch {
    return [];
  }
}

function parseBlockedBy(task: Task): number[] {
  try {
    return JSON.parse(task.blocked_by || '[]');
  } catch {
    return [];
  }
}

export function TaskCard({ task, onAdvance, onRegress }: TaskCardProps) {
  const [showArtifacts, setShowArtifacts] = useState(false);
  const [artifactContent, setArtifactContent] = useState<string | null>(null);
  const [loadingArtifact, setLoadingArtifact] = useState(false);

  const artifacts = getArtifacts(task);
  const blockedBy = parseBlockedBy(task);

  const handleToggleArtifact = async (filename: string) => {
    if (showArtifacts && artifactContent) {
      setShowArtifacts(false);
      setArtifactContent(null);
      return;
    }
    setLoadingArtifact(true);
    try {
      const res = await fetch(`${API_BASE}/api/artifacts/${filename}`);
      const text = await res.text();
      const lines = text.split('\n').slice(0, 10).join('\n');
      setArtifactContent(lines);
      setShowArtifacts(true);
    } catch (e) {
      console.error('Failed to fetch artifact:', e);
    } finally {
      setLoadingArtifact(false);
    }
  };

  return (
    <div className={`bg-slate-800/50 rounded-lg p-3 border border-slate-800 transition-all duration-300 ${
      task.status === 'bloqueada' ? 'opacity-60 border-amber-500/30' : ''
    }`}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-xs font-mono text-slate-500">#{task.id}</span>
        <span className={`text-xs px-1.5 py-0.5 rounded ${statusColor(task.status)}`}>
          {statusLabel(task.status)}
        </span>
        {task.status === 'bloqueada' && blockedBy.length > 0 && (
          <span className="text-[11px] px-2 py-0.5 bg-amber-500/20 text-amber-500 rounded-full">
            🔒 {blockedBy.map(id => `#${id}`).join(' ')}
          </span>
        )}
        {task.status === 'en_proceso' && task.assigned_to && (
          <span className="text-[11px] animate-pulse">⏳ {task.assigned_to} trabajando...</span>
        )}
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
          {onRegress && (
            <button
              onClick={() => onRegress(task.id)}
              className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-700 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
              title="Regresar"
            >
              <ChevronLeft size={14} />
            </button>
          )}
          {onAdvance && (
            <button
              onClick={() => onAdvance(task.id)}
              className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-700 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
              title="Avanzar"
            >
              <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>
      {artifacts.length > 0 && (
        <div className="mt-2 pt-2 border-t border-slate-700">
          <button
            onClick={() => handleToggleArtifact(artifacts[0])}
            disabled={loadingArtifact}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            📎 {artifacts[0]} {loadingArtifact ? '...' : showArtifacts ? '▲' : '▼'}
          </button>
          {showArtifacts && artifactContent && (
            <pre className="mt-2 p-2 bg-slate-900 rounded text-xs text-slate-300 overflow-x-auto max-h-40 overflow-y-auto">
              {artifactContent}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
