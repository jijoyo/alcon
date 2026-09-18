#!/usr/bin/env node
// alcon-audit v1 (P-075) — espejo de montar-modelos/tools/board-audit.cjs
// Técnica: navegador real (playwright-core + chromium del sistema), ve el DOM
// renderizado — no anda a ciegas como curl. No monta modelos, no reinicia nada.
// Gate P-075: script + AUDIT OK sin montar modelos ni restart router.
// Probe A (default): mensaje plano, 0 GPU (chat.js:88-96 prueba por código que
//   el eco valida socket+DB+broadcast sin inferencia).
// Probe B (--full, informativo, NO bloquea el gate): @quick-review --local,
//   despierta modelo en GPU y deja 1 task real en la board. Solo bajo petición.
const { chromium } = require('playwright-core');

const FULL = process.argv.includes('--full');

(async () => {
  const PWA = 'http://localhost:3004';
  const out = [];
  const check = (n, p, d = '') => { out.push(!!p); console.log((p ? '✅' : '❌') + ' ' + n + (d ? ' — ' + d : '')); };
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  try {
    await page.goto(PWA, { waitUntil: 'domcontentloaded', timeout: 15000 });
    check('board abre', true);
    const title = await page.title();
    check('C1 título Alcon', /alcon/i.test(title), title);

    // C2: kanban renderiza (tab índice 2: tasks=0, chat=1, kanban=2 — orden fijo App.tsx)
    const tabs = page.locator('header button');
    await tabs.nth(2).click();
    await page.waitForTimeout(2500);
    const stages = ['backlog', 'plan', 'implement', 'test', 'review', 'done'];
    const mainTxt = (await page.locator('main').innerText().catch(() => ''));
    check('C2 kanban columnas', stages.every(s => mainTxt.toLowerCase().includes(s)), '6 stages');
    // una tarjeta real: toma 1er task del API y busca su texto en el DOM
    const tasks = await page.evaluate(async () => {
      const r = await fetch('http://localhost:3003/api/tasks').then(r => r.json()).catch(() => ({}));
      return r.tasks || r || [];
    }).catch(() => []);
    const probe = Array.isArray(tasks) && tasks.length ? String(tasks[0].text || '').slice(0, 40) : '';
    check('C2b ≥1 tarjeta visible', !!probe && mainTxt.includes(probe), `${tasks.length} tasks, probe: ` + probe.slice(0, 40));

    // C3+C4: chat conecta + eco (tab índice 1)
    await tabs.nth(1).click();
    const input = page.locator('input[placeholder="Escribe un mensaje..."]');
    await input.waitFor({ timeout: 15000 }).catch(() => {});
    check('C3 chat conecta', await input.isEnabled().catch(() => false), 'input habilitado = socket vivo');
    const ts = 'ping audit ' + Date.now();
    await input.fill(ts);
    await input.press('Enter');
    let echo = false;
    try {
      await page.waitForFunction((t) => document.body.innerText.includes(t), ts, { timeout: 15000 });
      echo = true;
    } catch (e) { echo = false; }
    check('C4 eco socket (0 GPU)', echo, echo ? 'roundtrip+DB+broadcast OK' : 'sin eco en 15s');

    // C5-C9: APIs in-page (misma política que board-audit).
    // EXCEPCIÓN ASENTADA: Go :3011 no envía Access-Control-Allow-Origin
    // (verificado: curl 200 OK pero sin header ACAO; :3003 sí lo envía).
    // El fetch in-page a :3011 muere por CORS del navegador, no porque Go
    // esté caído. Por eso C8 se verifica lado-Node. Si un día Go agrega
    // CORS, mover de vuelta a in-page.
    const goNode = await (async () => {
      try {
        const { get } = await import('node:http');
        const body = await new Promise((res, rej) => {
          get('http://localhost:3011/health', (r) => {
            let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => res(d));
          }).on('error', rej);
        });
        return JSON.parse(body);
      } catch (e) { return { _err: String(e).slice(0, 60) }; }
    })();
    const api = await page.evaluate(async () => {
      const j = async (u) => fetch(u).then(r => r.json()).catch(e => ({ _err: String(e).slice(0, 60) }));
      return {
        health: await j('http://localhost:3003/health'),
        tasks: await j('http://localhost:3003/api/tasks'),
        agents: await j('http://localhost:3003/api/agents'),
        qdrant: await j('http://localhost:6333/collections/alcon'),
      };
    });
    check('C5 :3003/health', api.health && api.health.status === 'ok', (api.health && api.health.version) || JSON.stringify(api.health).slice(0, 60));
    const n = (api.tasks && (api.tasks.tasks || api.tasks || []).length) || 0;
    check('C6 /api/tasks', n > 0, n + ' tasks');
    const alive = ((api.agents && api.agents.agents) || []).filter(a => a.running);
    check('C7 agentes vivos', alive.length > 0, alive.length + ' vivos');
    check('C8 go :3011 (lado-Node por falta de CORS)', goNode && goNode.status === 'ok', 'devices:' + (goNode.devices || '?') + ' squads:' + (goNode.squads || '?'));
    const q = api.qdrant && api.qdrant.result;
    check('C9 qdrant alcon', q && q.status === 'green' && q.points_count > 0, q ? (q.status + ' ' + q.points_count + 'pts') : 'sin colección');

    // Probe B: solo --full, informativo
    if (FULL) {
      const bts = 'test audit ' + Date.now();
      await input.fill('@quick-review --local ' + bts);
      await input.press('Enter');
      let benj = false;
      try {
        await page.waitForFunction((t) => {
          const txt = document.body.innerText;
          return txt.includes(t) && /síntesis|perspectiva|veredicto|enjambre/i.test(txt);
        }, bts, { timeout: 240000 });
        benj = true;
      } catch (e) { benj = false; }
      console.log((benj ? '✅' : '❌') + ' B enjambre --local (informativo, no bloquea gate)');
    }
  } catch (e) { check('sin excepción', false, String(e).slice(0, 160)); }
  await browser.close();
  const ok = out.every(Boolean);
  console.log('\n' + (ok ? 'AUDIT OK' : 'AUDIT CON FALLOS'));
  process.exit(ok ? 0 : 1);
})();
