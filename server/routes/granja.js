import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default async function granjaRoutes(fastify) {
  fastify.get('/api/granja', async () => {
    let granja = {};
    let runtime = {};
    let registry = {};
    try { granja = JSON.parse(fs.readFileSync(path.join(__dirname, '../lib/granja.json'), 'utf8')); } catch {}
    try { runtime = JSON.parse(fs.readFileSync(path.join(__dirname, '../lib/runtime-state.json'), 'utf8')); } catch {}
    try { registry = JSON.parse(fs.readFileSync(path.join(__dirname, '../lib/model-registry.json'), 'utf8')); } catch {}
    return { granja, runtime, registry };
  });

  fastify.get('/api/granja/squads', async () => {
    try { return JSON.parse(fs.readFileSync(path.join(__dirname, '../lib/granja.json'), 'utf8')); }
    catch { return {}; }
  });

  fastify.get('/api/granja/devices', async () => {
    try { return JSON.parse(fs.readFileSync(path.join(__dirname, '../lib/runtime-state.json'), 'utf8')).devices; }
    catch { return {}; }
  });
}
