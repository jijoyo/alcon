import { useState, useEffect } from 'react'

export function MemoriaBuscador() {
  const [q, setQ] = useState('')
  const [device, setDevice] = useState('')
  const [res, setRes] = useState([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(null)
  const [stats, setStats] = useState({})
  const [statsLoaded, setStatsLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/memoria/stats')
      .then(r => r.json())
      .then(data => {
        setStats(data)
        setTotal(data.total || 0)
        setStatsLoaded(true)
      })
      .catch(() => setStatsLoaded(false))
  }, [])

  const buscar = async () => {
    if(!q.trim()) return
    setLoading(true)
    try {
      const r = await fetch(`/api/memoria/buscar?q=${encodeURIComponent(q)}&device=${device}&limit=20`)
      const j = await r.json()
      console.log('buscar raw', j)
      const arr = Array.isArray(j) ? j : (j.results || j.data || j.hits || [])
      setRes(Array.isArray(arr) ? arr : [])
    } finally { setLoading(false) }
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold mb-4">Memoria Granja ({statsLoaded ? total : '...'} sesiones)</h1>
      <div className="flex gap-2 mb-6">
        <input
          value={q}
          onChange={e=>setQ(e.target.value)}
          onKeyDown={e=> e.key==='Enter' && buscar()}
          placeholder="¿qué hizo kali con auditor? / orchestrator alcon / dosdash"
          className="flex-1 p-2 border rounded bg-zinc-900 text-white"
        />
        <select value={device} onChange={e=>setDevice(e.target.value)} className="p-2 border rounded bg-zinc-900 text-white">
          <option value="">Todos ({statsLoaded ? total : '...'})</option>
          {statsLoaded && Object.entries(stats.by_device || {}).map(([d,c]) => (
            <option key={d} value={d}>{d} ({c})</option>
          ))}
        </select>
        <button onClick={buscar} disabled={loading} className="px-6 bg-white text-black rounded font-medium">{loading?'...':'buscar'}</button>
      </div>
      <div className="space-y-2">
        {res
          .filter(r => r && (r.payload || r.device || r.texto))
          .map(r => {
            const p = r.payload || {};
            const device = p.device || r.device || 'forja';
            const title = p.title || r.texto || r.title || 'sin título';
            const time = p.fecha || p.time_created || r.time_created;
            const directory = p.directory || r.directory || '';
            const texto = p.texto || r.texto || '';
            const summary = texto.slice(0, 400);
            const model = p.model || r.model || '';
            const score = r.score?.toFixed(3) || '0';
            return (
              <div key={r.id} className="p-3 border border-zinc-800 rounded bg-zinc-900/50">
                <div className="text-xs text-zinc-500">{device} • {time ? new Date(time).toLocaleString() : 'sin fecha'} • {title}</div>
                <div className="font-mono text-xs text-yellow-400 mt-1">{directory}</div>
                <div className="text-sm mt-1 text-zinc-200 line-clamp-3">{summary || 'sin contenido'}</div>
                <div className="text-xs mt-2 text-zinc-600">score {score} • {model}</div>
              </div>
            );
          })}
      </div>
    </div>
  )
}
