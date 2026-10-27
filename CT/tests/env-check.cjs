/* Verifies the reflection-environment setting: studio default, downloaded HDR switch. */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.CT_PLAYWRIGHT || 'C:/Users/alejo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const library = { version: 1, revision: 0, categories: [{ id: 'env-test', name: 'Practice', solves: [{ id: 's-0', rawMs: 10000, penalty: '', scramble: "R U R' U' F2 D L2 B", date: new Date(2026, 8, 1, 12, 0).toISOString(), note: '' }] }] };
const server = http.createServer((req, res) => {
  if (req.url === '/api/library') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(library)); return; }
  const file = path.resolve(root, '.' + (req.url === '/' ? '/CTU.html' : req.url.split('?')[0]));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.hdr': 'application/octet-stream', '.png': 'image/png' })[path.extname(file)] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const appearanceLayout = () => page.evaluate(() => {
      const bounds = element => {
        const box = element.getBoundingClientRect();
        return { top: box.top, bottom: box.bottom, left: box.left, right: box.right };
      };
      return {
        dialog: bounds(document.querySelector('#dialog')),
        environment: bounds(document.querySelector('[data-control="cube-environment"] + .dd .dd-trigger')),
        done: bounds(document.querySelector('#dialog .dialog-actions [data-action="close-dialog"]')),
      };
    });
    await page.addInitScript(() => {
      window.Worker = undefined;
      localStorage.setItem('cubetracker.preferences.v2', JSON.stringify({ version: 2, theme: 'light', cubeFinish: 'tiles', cubeQuality: 'balanced', cubeEnvironment: 'studio', scrambleAnimation: false }));
    });
    await page.route('**/api/library', route => route.fulfill({ json: library }));
    await page.goto(`http://127.0.0.1:${server.address().port}/#timer`);
    await page.locator('#cube-mount canvas.cube-studio-canvas').waitFor({ timeout: 15000 });
    await page.waitForTimeout(600);
    const studioShot = await page.locator('#cube-mount').screenshot();
    console.log('studio canvas up');
    // Switch to a downloaded HDR in settings.
    await page.locator('#theme-btn').evaluate(el => el.click());
    await page.locator('[data-control="cube-environment"]').selectOption('ferndale04');
    await page.waitForTimeout(2500);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('cubetracker.preferences.v2')).cubeEnvironment);
    assert.equal(saved, 'ferndale04', 'preference saved');
    const layout = await appearanceLayout();
    assert.ok(layout.environment.bottom < layout.done.top, 'environment control stays above actions');
    assert.ok(layout.done.bottom <= layout.dialog.bottom, 'Done button stays inside the dialog');
    await page.screenshot({ path: path.join(__dirname, 'screenshots', 'env-ferndale-appearance.png') });
    await page.setViewportSize({ width: 1024, height: 700 });
    await page.waitForTimeout(200);
    const compactLayout = await appearanceLayout();
    assert.ok(compactLayout.environment.bottom < compactLayout.done.top, 'environment control stays above actions at 1024x700');
    assert.ok(compactLayout.done.bottom <= compactLayout.dialog.bottom, 'Done button stays inside the dialog at 1024x700');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(200);
    console.log('PASS: downloaded HDR selected and saved');
    await page.locator('#dialog [data-action="close-dialog"]').first().click();
    await page.waitForTimeout(1500);
    const downloadedShot = await page.locator('#cube-mount').screenshot();
    assert.ok(!studioShot.equals(downloadedShot), 'downloaded cube renders differently from studio');
    await page.screenshot({ path: path.join(__dirname, 'screenshots', 'env-ferndale-timer.png') });
    console.log('PASS: downloaded HDR renders on the timer cube');
    // Switch back to studio and confirm the default is restored.
    await page.locator('#theme-btn').evaluate(el => el.click());
    await page.locator('[data-control="cube-environment"]').selectOption('studio');
    await page.waitForTimeout(1200);
    await page.locator('#dialog [data-action="close-dialog"]').first().click();
    await page.waitForTimeout(1200);
    const backShot = await page.locator('#cube-mount').screenshot();
    assert.ok(backShot.equals(studioShot), 'studio restored exactly');
    console.log('PASS: studio restored');
    assert.deepEqual(errors, []);

    // A missing photograph must fall back to the generated studio instead of
    // leaving the 3D stage transparent and its spawn lifecycle paused forever.
    const fallbackPage = await browser.newPage({ viewport: { width: 1000, height: 700 } });
    const fallbackErrors = [], warnings = [];
    fallbackPage.on('pageerror', e => fallbackErrors.push(e.message));
    fallbackPage.on('console', message => { if (message.type() === 'warning') warnings.push(message.text()); });
    await fallbackPage.addInitScript(() => {
      window.Worker = undefined;
      localStorage.setItem('cubetracker.preferences.v2', JSON.stringify({ version: 2, theme: 'light', cubeFinish: 'tiles', cubeQuality: 'balanced', cubeEnvironment: 'ferndale04', scrambleAnimation: false }));
    });
    await fallbackPage.route('**/api/library', route => route.fulfill({ json: library }));
    await fallbackPage.route('**/ferndale_studio_04_4k.hdr', route => route.fulfill({ status: 503, body: 'unavailable' }));
    await fallbackPage.goto(`http://127.0.0.1:${server.address().port}/#timer`);
    await fallbackPage.locator('#cube-mount canvas.cube-studio-canvas').waitFor({ timeout: 15000 });
    await fallbackPage.locator('#cube-mount .cube-materialize').waitFor({ timeout: 15000 });
    assert.ok((await fallbackPage.locator('#cube-mount').screenshot()).length > 1000, 'fallback frame is visible');
    assert.ok(warnings.some(message => message.includes('environment "ferndale04" failed')), 'failed photograph is reported');
    assert.deepEqual(fallbackErrors, []);
    await fallbackPage.close();
    console.log('PASS: missing downloaded photograph falls back to the generated studio');
    console.log('ALL ENVIRONMENT CHECKS PASSED');
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
