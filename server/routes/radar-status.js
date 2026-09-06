import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function statePath() {
  return process.env.RADAR_STATE_PATH || path.join(__dirname, '..', '..', 'data', 'radar.last.json');
}

export default async function radarStatusRoutes(fastify) {
  fastify.get('/api/radar-status', async () => {
    try {
      const raw = fs.readFileSync(statePath(), 'utf8');
      const s = JSON.parse(raw);
      return {
        status: s.status || 'ok',
        last_fetch: s.last_fetch || null,
        source: s.source || null,
        count: typeof s.count === 'number' ? s.count : null,
        last_query: s.last_query || null,
      };
    } catch {
      return { status: 'unknown', last_fetch: null, source: null, count: null, last_query: null };
    }
  });
}
