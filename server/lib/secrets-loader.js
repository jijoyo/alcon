import fs from 'fs';
import path from 'path';
import os from 'os';

const warned = new Set();

function readFirst(paths) {
  for (const p of paths) {
    try {
      const expanded = p.startsWith('~/') ? path.join(os.homedir(), p.slice(2)) : p;
      if (fs.existsSync(expanded)) {
        return fs.readFileSync(expanded, 'utf8').trim();
      }
    } catch {}
  }
  return null;
}

export function getSecret(name) {
  const xdg = path.join(os.homedir(), '.config', 'alcon', name);
  const legacy = path.join(os.homedir(), 'obsidian-vault', '.secrets', `${name}.txt`);
  const legacyNoExt = path.join(os.homedir(), 'obsidian-vault', '.secrets', name);

  let val = readFirst([xdg]);
  if (val) return val;

  val = readFirst([legacy, legacyNoExt]);
  if (val) {
    if (!warned.has(name)) {
      console.warn(`[secrets] ${name} leido desde legacy ${legacy} — migra a ${xdg} y gitignorealo`);
      warned.add(name);
    }
    return val;
  }
  return null;
}

export function getOpenRouterKey() {
  if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY;
  return getSecret('omniroute-key') || getSecret('openrouter-key');
}
