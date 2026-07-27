import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);

  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export function timeUntil(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((then - now) / 1000);

  if (diff <= 0) return 'expirado';
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  return `${Math.floor(diff / 3600)}h`;
}

export function agentColor(agent: string): string {
  switch (agent) {
    case 'vps': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30';
    case 'kali': return 'text-blue-400 bg-blue-400/10 border-blue-400/30';
    case 'cel': return 'text-purple-400 bg-purple-400/10 border-purple-400/30';
    case 'system': return 'text-amber-400 bg-amber-400/10 border-amber-400/30';
    case 'user': return 'text-slate-300 bg-slate-400/10 border-slate-400/30';
    default: return 'text-slate-400 bg-slate-400/10 border-slate-400/30';
  }
}

export function statusColor(status: string): string {
  switch (status) {
    case 'pendiente': return 'text-amber-400 bg-amber-400/10';
    case 'en_proceso': return 'text-blue-400 bg-blue-400/10';
    case 'hecho': return 'text-emerald-400 bg-emerald-400/10';
    case 'error': return 'text-red-400 bg-red-400/10';
    default: return 'text-slate-400 bg-slate-400/10';
  }
}

export function statusLabel(status: string): string {
  switch (status) {
    case 'pendiente': return 'Pendiente';
    case 'en_proceso': return 'En proceso';
    case 'hecho': return 'Completado';
    case 'error': return 'Error';
    default: return status;
  }
}
