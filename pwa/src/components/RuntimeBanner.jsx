import { useEffect, useState } from 'react';
import { aEspanol } from '../lib/traduccion.js';

export default function RuntimeBanner() {
  const [rt, setRt] = useState(null);
  const [rag, setRag] = useState(null);

  useEffect(() => {
    const base = typeof window === 'undefined' ? 'http://localhost:3003'
      : window.location.origin.replace(':3004', ':3003').replace(':5173', ':3003').replace(':5175', ':3003');
    fetch(`${base}/api/granja`)
      .then(r => r.json())
      .then(d => setRt(d.runtime))
      .catch(() => {});
    fetch(`${base}/api/estado-rag`)
      .then(r => r.json())
      .then(d => setRag(d))
      .catch(() => {});
  }, []);

  if (!rt && !rag) return null;

  const on = rt?.devices?.debian?.online;
  const heme = rag?.colecciones?.hemeroteca;
  const al = rag?.colecciones?.alcon;

  return (
    <div style={{ padding: 8, background: on ? '#0a2' : '#a20', color: 'white', fontSize: 12 }}>
      <b>Cuartel:</b> Forja {on ? 'ON' : 'OFF'} | Kali {rt?.devices?.kali?.online ? 'ON' : 'OFF'} | Modelos: {rt?.modelsLoaded?.join(', ') || 'cargando'} | Confianza: {on ? '95%' : '60% fallback'}
      {!on && <span> → Para mejor config prende forja (100.121.64.26)</span>}
      {rag && <span> | RAG: {rag.embeds ? '✅' : '❌'} hemeroteca {heme?.points ?? '?'} ({heme?.status}) · alcon {al?.points ?? '?'} ({al?.status})</span>}
    </div>
  );
}
