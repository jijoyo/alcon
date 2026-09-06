import os from 'node:os';

function detectEnv() {
  if (process.env.ALCON_ENV === 'forja' || process.env.ALCON_ENV === 'vps') return process.env.ALCON_ENV;
  return os.hostname().includes('oracle') ? 'vps' : 'forja';
}

function hosts(env) {
  const forjaRouter = process.env.FORJA_ROUTER_URL || 'http://100.121.64.26:8080';
  if (env === 'vps') {
    return {
      go: process.env.GO_URL || 'http://localhost:3011',
      router: forjaRouter,
      api: 'http://localhost:3003',
      pwa: 'http://localhost:3004',
    };
  }
  return {
    go: process.env.GO_URL || null,
    router: 'http://localhost:8080',
    api: 'http://100.102.63.30:3003',
    pwa: 'http://100.102.63.30:3004',
  };
}

async function checkPage(url, timeoutMs = 5000) {
  const started = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    await res.text();
    return { ok: res.ok, host: url, ms: Date.now() - started };
  } catch (e) {
    return { ok: false, host: url, ms: Date.now() - started, error: e.message };
  }
}

async function checkJson(url, timeoutMs = 8000) {
  const started = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    const text = await res.text();
    const ms = Date.now() - started;
    const contentType = res.headers.get('content-type') || '';
    const isHtml = text.trim().startsWith('<') || contentType.includes('text/html');
    const ok = res.ok && !isHtml;
    return { ok, isHtml, status: res.status, host: url, ms };
  } catch (e) {
    return { ok: false, isHtml: false, status: 0, host: url, ms: Date.now() - started, error: e.message };
  }
}

export default async function healthMapRoutes(fastify) {
  fastify.get('/api/health-map', async () => {
    const env = detectEnv();
    const h = hosts(env);
    const [go, router, api, pwa] = await Promise.all([
      h.go ? checkJson(`${h.go}/health`) : Promise.resolve({ ok: 'skipped', host: null, ms: 0, reason: 'go vive en VPS' }),
      checkJson(`${h.router}/v1/models`),
      checkJson(`${h.api}/health`),
      checkPage(h.pwa, 5000),
    ]);
    return {
      env,
      go,
      router,
      api: api.ok === 'skipped' ? api : { ok: api.ok, host: api.host, ms: api.ms },
      pwa: pwa.ok === 'skipped' ? pwa : { ok: pwa.ok, host: pwa.host, ms: pwa.ms },
      timestamp: new Date().toISOString(),
    };
  });
}
