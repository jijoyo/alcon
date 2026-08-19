import { useEffect, useState } from 'react';
import { aEspanol } from '../lib/traduccion.js';

export default function RuntimeBanner() {
  const [rt, setRt] = useState(null);

  useEffect(() => {
    fetch('/api/granja')
      .then(r => r.json())
      .then(d => setRt(d.runtime))
      .catch(() => {});
  }, []);

  if (!rt) return null;

  const on = rt.devices?.debian?.online;

  return (
    <div style={{ padding: 8, background: on ? '#0a2' : '#a20', color: 'white', fontSize: 12 }}>
      <b>Cuartel:</b> Forja {on ? 'ON' : 'OFF'} | Kali {rt.devices?.kali?.online ? 'ON' : 'OFF'} | Modelos: {rt.modelsLoaded?.join(', ') || 'cargando'} | Confianza: {on ? '95%' : '60% fallback'}
      {!on && <span> → Para mejor config prende forja (100.121.64.26)</span>}
    </div>
  );
}
