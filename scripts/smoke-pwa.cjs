const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/chromium',
    headless: true
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => { errors.push(err.message); });

  const base = 'http://100.121.64.26:3004';
  await page.goto('http://100.121.64.26:3004', { waitUntil: 'networkidle', timeout: 30000 });

  // Esperar a que desaparezca "conectando" (máx 30s)
  await page.waitForSelector('text=Conectando', { state: 'detached', timeout: 30000 }).catch(() => {});

  // Captura ARIA snapshot (zona útil, no toda la página)
  const snapshot = await page.locator('body').ariaSnapshot({ interestingOnly: true });
  require('fs').writeFileSync('/tmp/aria-snapshot.yaml', snapshot);

  // Errores consola
  require('fs').writeFileSync('/tmp/errors.json', JSON.stringify(errors, null, 2));

  // Veredicto
  const ok = errors.length === 0;
  const report = { passed: ok, errors, timestamp: new Date().toISOString() };
  require('fs').writeFileSync('/tmp/smoke-report.json', JSON.stringify(report, null, 2));

  await browser.close();
  console.log(`Smoke: ${ok ? 'PASS' : 'FAIL'} | Errors: ${errors.length}`);
})();