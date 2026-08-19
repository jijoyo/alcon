import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function recommendBestConfig(text = '', squad = '') {
  let rt = {};
  try { rt = JSON.parse(fs.readFileSync(path.join(__dirname, 'runtime-state.json'), 'utf8')); }
  catch {}

  const on = rt.devices?.debian?.online;
  const t = (text + ' ' + squad).toLowerCase();

  let ideal = { model: 'qwen-coder-14b', device: 'debian 100.121.64.26', reason: 'general' };
  let accion = '';

  if (t.includes('terror') || t.includes('gore') || t.includes('horror') || t.includes('mithos')) {
    ideal = {
      model: 'gemma-uncensored-12b (gemma4-12b-uncensored 6.9GB 80 tok/s)',
      device: 'debian',
      reason: 'Mithos terror necesita uncensored, el censurado bloquea gore'
    };
    accion = 'Carga gemma4-12b-uncensored: llama.cpp --model gemma4-12b-uncensored';
  } else if (t.includes('quick') || t.includes('revisa') || t.includes('youtube') || t.includes('thumb') || t.includes('title')) {
    ideal = { model: 'hauhaucs-12b (129 tok/s, 6.9GB)', device: 'debian', reason: 'rapida, no quemar 10GB VRAM' };
  } else if (t.includes('audit') || t.includes('seguridad') || t.includes('owasp') || t.includes('arquitectura')) {
    ideal = { model: 'qwen3.6-35b-A3B (10.6GB 45 tok/s)', device: 'debian', reason: 'audit profundo razonamiento alto' };
    if (!on) accion = 'Prende forja (100.121.64.26) para 95% confianza. Ahora 60% fallback vps con subagentes';
  }

  if (!on && ideal.device.includes('debian')) {
    accion = accion || 'Prende forja (100.121.64.26) - offline. Confianza sube 60%->95%';
  }

  return { ideal, actual: rt, accion, confianza: on ? '95%' : '60% fallback', updated_at: rt.updated_at };
}
