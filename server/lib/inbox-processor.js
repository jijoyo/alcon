import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createJob } from '../config/jobs.js';
import { get as getDb } from '../db/connection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INBOX_DIR = path.join(__dirname, '..', '..', 'agent-inbox');
const PROCESSED_DIR = path.join(INBOX_DIR, '.processed');

export function scanInbox() {
  if (!fs.existsSync(INBOX_DIR)) return 0;
  fs.mkdirSync(PROCESSED_DIR, { recursive: true });

  const files = fs.readdirSync(INBOX_DIR).filter(f => f.endsWith('.md') && !f.startsWith('.'));
  let imported = 0;

  for (const file of files) {
    const filepath = path.join(INBOX_DIR, file);
    try {
      const content = fs.readFileSync(filepath, 'utf8');
      const firstLine = content.split('\n').find(l => l.trim() && !l.startsWith('#'));
      const title = firstLine ? firstLine.trim().slice(0, 200) : file;

      const db = getDb();
      const existing = db.prepare("SELECT id FROM tasks WHERE text LIKE ? AND status != 'error' LIMIT 1").get(`%[inbox:${file}%`);
      if (existing) continue;

      createJob({
        text: `${title}\n\n[inbox:${file}]`,
        source: `inbox:${file}`,
        assigned_to: null
      });

      fs.renameSync(filepath, path.join(PROCESSED_DIR, file));
      imported++;
    } catch (e) {
      console.error(`[inbox] Error procesando ${file}: ${e.message}`);
    }
  }
  return imported;
}

export function startInboxWatcher(intervalMs = 30000) {
  console.log(`[inbox] Watcher activo cada ${intervalMs / 1000}s`);
  return setInterval(() => {
    const imported = scanInbox();
    if (imported > 0) console.log(`[inbox] ${imported} mensajes importados a jobs`);
  }, intervalMs);
}
