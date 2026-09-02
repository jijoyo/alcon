import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function timeAgo(dateStr: string): string {
  if (!dateStr) return 'ahora'
  let iso = dateStr
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(dateStr)) {
    iso = dateStr.replace(' ', 'T') + 'Z'
  }
  const now = Date.now();
  const then = new Date(iso).getTime();
  let diff = Math.floor((now - then) / 1000);
  if (isNaN(diff)) return 'ahora'
  if (diff < 0) diff = 0
  if (diff < 5) return 'ahora'
  if (diff < 60) return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
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
    case 'vps': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400';
    case 'kali': return 'text-blue-400 bg-blue-400/10 border-blue-400';
    case 'cel': return 'text-purple-400 bg-purple-400/10 border-purple-400';
    case 'cel2': return 'text-fuchsia-400 bg-fuchsia-400/10 border-fuchsia-400';
    case 'cel-tui': return 'text-pink-400 bg-pink-400/10 border-pink-400';
    case 'debian': return 'text-amber-400 bg-amber-400/10 border-amber-400';
    case 'radar': return 'text-teal-400 bg-teal-400/10 border-teal-400';
    case 'local-router': return 'text-cyan-400 bg-cyan-400/10 border-cyan-400';
    case 'montar-forja': return 'text-orange-400 bg-orange-400/10 border-orange-400';
    case 'hermes': return 'text-rose-400 bg-rose-400/10 border-rose-400';
    case 'alcon': return 'text-indigo-400 bg-indigo-400/10 border-indigo-400';
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

export function stageColor(stage: string): string {
  switch (stage) {
    case 'backlog': return 'text-slate-400 bg-slate-400/10';
    case 'plan': return 'text-amber-400 bg-amber-400/10';
    case 'implement': return 'text-blue-400 bg-blue-400/10';
    case 'test': return 'text-purple-400 bg-purple-400/10';
    case 'review': return 'text-cyan-400 bg-cyan-400/10';
    case 'done': return 'text-emerald-400 bg-emerald-400/10';
    default: return 'text-slate-400 bg-slate-400/10';
  }
}

export function stageLabel(stage: string): string {
  switch (stage) {
    case 'backlog': return 'Backlog';
    case 'plan': return 'Plan';
    case 'implement': return 'Implement';
    case 'test': return 'Test';
    case 'review': return 'Review';
    case 'done': return 'Done';
    default: return stage;
  }
}
