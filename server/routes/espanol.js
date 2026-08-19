import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TRAD = {
  auditor: 'code-audit',
  'revision-rapida': 'quick-review',
  youtube: 'youtube-auto',
  mithos: 'mithos-cap'
};

export default async function espanolRoutes(fastify) {
  fastify.get('/api/escuadras', async () => {
    try { return JSON.parse(fs.readFileSync(path.join(__dirname, '../lib/granja.json'), 'utf8')); }
    catch { return {}; }
  });

  fastify.get('/api/escuadras/:nombre', async (req) => {
    try {
      const g = JSON.parse(fs.readFileSync(path.join(__dirname, '../lib/granja.json'), 'utf8'));
      const n = req.params.nombre;
      return g.squads?.[n] || g.squads?.[TRAD[n]] || {};
    } catch { return {}; }
  });

  fastify.get('/api/fases', (req, rep) => rep.redirect('/api/tasks/by-stage'));
  fastify.get('/api/chambas', (req, rep) => rep.redirect('/api/tasks'));
  fastify.get('/api/soldados', (req, rep) => rep.redirect('/api/agents'));

  fastify.get('/api/traducir/:cmd', async (req) => {
    const c = req.params.cmd.toLowerCase();
    return { original: c, interno: TRAD[c] || c };
  });
}
