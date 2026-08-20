const getApiBase = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    return origin.replace(':3004', ':3003').replace(':5173', ':3003').replace(':5175', ':3003');
  }
  return 'http://localhost:3003';
};

export const API_BASE = getApiBase();

export type Stage = 'backlog' | 'plan' | 'implement' | 'test' | 'review' | 'done';

export interface Task {
  id: number;
  text: string;
  original_text: string;
  status: 'pendiente' | 'en_proceso' | 'hecho' | 'error' | 'bloqueada';
  stage: Stage;
  assigned_to: string | null;
  lock_owner: string | null;
  lock_acquired_at: string | null;
  lock_expires_at: string | null;
  last_heartbeat: string | null;
  messages: Message[];
  result: string | null;
  artifacts: string | null;
  blocked_by: string | null;
  created: string;
  completed_at?: string;
}

export interface Message {
  id: string;
  from: string;
  text: string;
  timestamp: string;
}

export interface SystemStatus {
  total_tasks: number;
  version: number;
  agents: Record<string, AgentStatus>;
  timestamp: string;
}

export interface AgentStatus {
  active: number;
  pending: number;
  done: number;
  error: number;
  total: number;
  active_tasks: Array<{
    id: number;
    text: string;
    lock_owner: string;
    lock_expires_at: string;
    last_heartbeat: string;
    is_stale: boolean;
  }>;
}

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export function getArtifacts(task: Task): string[] {
  try { return JSON.parse(task.artifacts || '[]'); } catch { return []; }
}

export const taskApi = {
  create: (text: string) => api<Task>('POST', '/api/task', { text }),
  list: (agent?: string, status?: string) => {
    const params = new URLSearchParams();
    if (agent) params.set('agent', agent);
    if (status) params.set('status', status);
    const qs = params.toString();
    return api<{ tasks: Task[]; count: number }>('GET', `/api/tasks${qs ? '?' + qs : ''}`);
  },
  get: (id: number) => api<Task>('GET', `/api/task/${id}`),
  claim: (id: number, owner: string) => api<Task>('POST', `/api/task/${id}/claim`, { owner }),
  heartbeat: (id: number, owner: string) => api<{ ok: boolean; lock_expires_at: string }>('POST', `/api/task/${id}/heartbeat`, { owner }),
  message: (id: number, from: string, text: string) => api<Message>('POST', `/api/task/${id}/message`, { from, text }),
  messages: (id: number) => api<{ messages: Message[] }>('GET', `/api/task/${id}/messages`),
  complete: (id: number, owner: string, result?: string) => api<Task>('POST', `/api/task/${id}/complete`, { owner, result }),
  error: (id: number, owner: string, error: string) => api<Task>('POST', `/api/task/${id}/error`, { owner, error }),
  byStage: () => api<Record<string, Task[]>>('GET', '/api/tasks/by-stage'),
  advance: (id: number, by_agent?: string) => api<Task>('POST', `/api/task/${id}/advance`, { by_agent }),
  regress: (id: number, by_agent?: string) => api<Task>('POST', `/api/task/${id}/regress`, { by_agent }),
  status: () => api<SystemStatus>('GET', '/api/status'),
  health: () => api<{ status: string; version: string; timestamp: string }>('GET', '/health')
};
