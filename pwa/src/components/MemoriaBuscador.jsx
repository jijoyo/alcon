import { useState } from 'react';
import { Search, Database, Clock } from 'lucide-react';

const BASE = import.meta.env.VITE_API_URL || '';

export function MemoriaBuscador() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ q: query, limit: '10' });
      if (filter) params.set('device', filter);
      const res = await fetch(`${BASE}/api/memoria/buscar?${params}`);
      const data = await res.json();
      setResults(data.results || []);
    } catch (e) {
      console.error('Search failed:', e);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const res = await fetch(`${BASE}/api/memoria/stats`);
      const data = await res.json();
      setStats(data);
    } catch (e) {
      console.error('Stats failed:', e);
    }
  };

  const formatTime = (ms) => {
    if (!ms) return 'N/A';
    return new Date(ms).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  return (
    <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Database size={16} className="text-purple-400" />
        <h3 className="text-sm font-medium text-slate-200">Memoria RAG</h3>
        <button
          onClick={loadStats}
          className="ml-auto text-xs text-slate-500 hover:text-slate-300"
        >
          Stats
        </button>
      </div>

      {stats && (
        <div className="mb-3 text-xs text-slate-400">
          Total: {stats.total} | 
          {Object.entries(stats.by_device || {}).map(([d, c]) => (
            <span key={d}> {d}: {c}</span>
          ))}
        </div>
      )}

      <form onSubmit={handleSearch} className="flex gap-2 mb-3">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar en memoria..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-7 pr-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-300"
        >
          <option value="">Todos</option>
          <option value="forja">Forja</option>
          <option value="kali">Kali</option>
          <option value="vps">VPS</option>
          <option value="cel">Cel</option>
        </select>
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded-lg"
        >
          {loading ? '...' : 'Buscar'}
        </button>
      </form>

      {results.length > 0 && (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {results.map((r) => (
            <div
              key={r.id}
              className="bg-slate-800/50 rounded-lg p-2 border border-slate-700/50"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-purple-400">{r.device}</span>
                <span className="text-xs text-slate-500">
                  <Clock size={10} className="inline mr-1" />
                  {formatTime(r.time_created)}
                </span>
                <span className="text-xs text-slate-600 ml-auto">
                  score: {r.score?.toFixed(3)}
                </span>
              </div>
              <div className="text-xs text-slate-300 line-clamp-2">
                {r.title?.slice(0, 150)}
              </div>
              {r.summary_files?.length > 0 && (
                <div className="text-xs text-slate-500 mt-1">
                  Files: {r.summary_files.slice(0, 3).join(', ')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {query && results.length === 0 && !loading && (
        <div className="text-xs text-slate-500 text-center py-4">
          Sin resultados para "{query}"
        </div>
      )}
    </div>
  );
}
