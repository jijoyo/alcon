import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RUNTIME_PATH = path.join(__dirname, 'runtime-state.json');

function run(c) {
  try { return execSync(c, { encoding: 'utf8', timeout: 4000 }); }
  catch { return ''; }
}

export async function discover() {
  const ts = run('tailscale status --json 2>/dev/null || tailscale status 2>/dev/null');

  const devices = {
    debian: { ip: '100.121.64.26', online: ts.includes('100.121.64.26'), name: 'forja' },
    kali: { ip: '100.103.82.104', online: ts.includes('100.103.82.104'), name: 'kali' },
    vps: { ip: '100.102.63.30', online: true, name: 'vps' },
    cel: { ip: '100.76.111.99', online: ts.includes('100.76.111.99'), name: 'cel' }
  };

  let modelsLoaded = [];
  try {
    const r = await fetch('http://100.121.64.26:8080/v1/models', { signal: AbortSignal.timeout(2000) })
      .then(x => x.json()).catch(() => null);
    if (r?.data) modelsLoaded = r.data.map(m => m.id);
  } catch {}

  const state = { updated_at: new Date().toISOString(), devices, modelsLoaded, projects: [] };
  try {
    state.projects = fs.readdirSync(process.env.HOME + '/Documentos')
      .filter(d => fs.statSync(process.env.HOME + '/Documentos/' + d).isDirectory());
  } catch {}

  try {
    fs.writeFileSync(RUNTIME_PATH, JSON.stringify(state, null, 2));
  } catch {}

  console.log('[auto-discovery]', state);
  return state;
}

export default { discover };
