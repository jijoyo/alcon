import { useState } from 'react'

export function MemoriaBuscador() {
  const [q, setQ] = useState('')
  const [device, setDevice] = useState('')
  const [res, setRes] = useState([])
  const [loading, setLoading] = useState(false)

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
      <h1 className="text-xl font-bold mb-4">Memoria Granja (530 sesiones)</h1>
      <div className="flex gap-2 mb-6">
        <input
          value={q}
          onChange={e=>setQ(e.target.value)}
          onKeyDown={e=> e.key==='Enter' && buscar()}
          placeholder="¿qué hizo kali con auditor? / orchestrator alcon / dosdash"
          className="flex-1 p-2 border rounded bg-zinc-900 text-white"
        />
        <select value={device} onChange={e=>setDevice(e.target.value)} className="p-2 border rounded bg-zinc-900 text-white">
          <option value="">Todos (530)</option>
          <option value="forja">Forja (72)</option>
          <option value="kali">Kali (77)</option>
          <option value="vps">VPS (345)</option>
          <option value="cel">Cel (36)</option>
        </select>
        <button onClick={buscar} disabled={loading} className="px-6 bg-white text-black rounded font-medium">{loading?'...':'buscar'}</button>
      </div>
      <div className="space-y-2">
        {res.map(r=>(
          <div key={r.id} className="p-3 border border-zinc-800 rounded bg-zinc-900/50">
            <div className="text-xs text-zinc-500">{r.payload.device} • {new Date(r.payload.time_created).toLocaleString()} • {r.payload.title}</div>
            <div className="font-mono text-xs text-yellow-400 mt-1">{r.payload.directory}</div>
            <div className="text-sm mt-1 text-zinc-200 line-clamp-3">{r.payload.summary_files || r.payload.title}</div>
            <div className="text-xs mt-2 text-zinc-600">score {r.score?.toFixed(3)} • {r.payload.model}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
