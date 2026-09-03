import { createJob, claimJob, completeJob, failJob, getPendingJobs, getActiveJobs, getJobRuns, reapStaleJobs } from '../config/jobs.js';
import { get as getDb } from '../db/connection.js';
import { requireString } from '../middleware/validate.js';

export default async function jobsRoutes(fastify) {
  fastify.get('/api/jobs', async (request) => {
    const { status } = request.query;
    const db = getDb();
    if (status === 'pending') return { jobs: getPendingJobs() };
    if (status === 'active') return { jobs: getActiveJobs() };
    const jobs = db.prepare('SELECT * FROM tasks ORDER BY created DESC LIMIT 100').all();
    return { jobs };
  });

  fastify.post('/api/jobs', async (request, reply) => {
    const { text, source, assigned_to, squad } = request.body || {};
    const err = requireString(text, 'text');
    if (err) return reply.code(400).send(err);
    const job = createJob({ text, source: source || 'api', assigned_to, squad });
    if (globalThis._io) globalThis._io.of('/enjambre').emit('task:updated', { id: job.id, status: 'pendiente', stage: 'backlog' });
    return job;
  });

  fastify.post('/api/jobs/:id/claim', async (request, reply) => {
    const id = Number(request.params.id);
    const { agent } = request.body || {};
    const err = requireString(agent, 'agent');
    if (err) return reply.code(400).send(err);
    const result = claimJob(id, agent);
    if (!result) return reply.code(404).send({ error: 'Job not found' });
    if (result.locked) return reply.code(409).send({ error: 'Job locked', owner: result.owner });
    if (globalThis._io) globalThis._io.of('/enjambre').emit('task:updated', { id, stage: 'implement' });
    return result;
  });

  fastify.post('/api/jobs/:id/complete', async (request, reply) => {
    const id = Number(request.params.id);
    const { agent, output } = request.body || {};
    const err = requireString(agent, 'agent');
    if (err) return reply.code(400).send(err);
    const result = completeJob(id, agent, output);
    if (!result) return reply.code(404).send({ error: 'Job not found' });
    if (globalThis._io) globalThis._io.of('/enjambre').emit('task:updated', { id, status: 'hecho', stage: 'done' });
    return result;
  });

  fastify.post('/api/jobs/:id/fail', async (request, reply) => {
    const id = Number(request.params.id);
    const { agent, error: errorMsg } = request.body || {};
    const err = requireString(agent, 'agent');
    if (err) return reply.code(400).send(err);
    const result = failJob(id, agent, errorMsg || 'Unknown error');
    if (!result) return reply.code(404).send({ error: 'Job not found' });
    if (globalThis._io) globalThis._io.of('/enjambre').emit('task:updated', { id, status: 'error' });
    return result;
  });

  fastify.get('/api/jobs/:id/runs', async (request, reply) => {
    const id = Number(request.params.id);
    const db = getDb();
    const job = db.prepare('SELECT id FROM tasks WHERE id = ?').get(id);
    if (!job) return reply.code(404).send({ error: 'Job not found' });
    return { runs: getJobRuns(id) };
  });

  fastify.post('/api/jobs/reap', async () => {
    const reaped = reapStaleJobs();
    return { reaped };
  });
}
