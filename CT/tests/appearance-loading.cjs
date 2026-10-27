/* Isolated browser checks for carousel loading, cancellation and GPU reuse. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.CT_PLAYWRIGHT || 'C:/Users/alejo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  if (req.url === '/api/library') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ version: 1, revision: 0, categories: [{ id: 'test', name: 'Practice', solves: [] }] }));
    return;
  }
  const file = path.resolve(root, '.' + (req.url === '/' ? '/CTU.html' : req.url.split('?')[0]));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' })[path.extname(file)] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    for (const reducedMotion of ['no-preference', 'reduce']) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => {
        window.Worker = undefined;
        localStorage.setItem('cubetracker.preferences.v2', JSON.stringify({ version: 2, cubeFinish: 'standard', cubeQuality: 'low', cubeEnvironment: 'studio', scrambleAnimation: false }));
      });
      await page.goto(`http://127.0.0.1:${server.address().port}/#timer`);
      await page.locator('#theme-btn').evaluate(el => el.click());
      const settled = () => page.waitForFunction(() => {
        const mount = document.querySelector('#appearance-cube');
        return mount?.querySelector('.cube-stage') && !mount.classList.contains('cube-loading');
      });
      await settled();
      await page.evaluate(() => {
        window.loadingFrames = [];
        window.sampleLoading = true;
        const sample = () => {
          const mount = document.querySelector('#appearance-cube');
          const stage = mount?.querySelector('.cube-stage');
          if (stage) window.loadingFrames.push({ loading: mount.classList.contains('cube-loading'), fading: mount.classList.contains('cube-loading-out'), hidden: getComputedStyle(stage).visibility === 'hidden', animation: stage.getAnimations()[0]?.currentTime });
          if (window.sampleLoading) requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      });
      const step = direction => page.locator(`[data-cube-step="${direction}"]`).evaluate(el => el.click());
      await step(1);
      assert.equal(await page.locator('.cube-carousel').getAttribute('data-model'), 'tiles');
      await settled();
      await page.evaluate(() => { window.tilesCanvas = document.querySelector('#appearance-cube canvas'); });
      await step(1);
      await settled();
      await step(-1);
      await settled();
      assert.ok(await page.evaluate(() => window.tilesCanvas === document.querySelector('#appearance-cube canvas')), 'Returning to a model reuses its canvas and WebGL context');
      for (let i = 0; i < 6; i++) { await step(1); await settled(); }
      assert.ok(await page.evaluate(() => window.tilesCanvas === document.querySelector('#appearance-cube canvas')), 'A full carousel keeps the visited models ready');
      await page.evaluate(() => {
        for (const direction of [1, 1, 1, -1, -1]) document.querySelector(`[data-cube-step="${direction}"]`).click();
      });
      assert.equal(await page.locator('.cube-carousel').getAttribute('data-model'), 'stickers', 'Rapid navigation selects the final model immediately');
      await settled();
      assert.equal(await page.locator('#appearance-cube canvas').getAttribute('data-model'), 'stickers');
      // A selection during the fade must cancel the old reveal.
      if (reducedMotion === 'no-preference') {
        await step(-1);
        await page.waitForFunction(() => document.querySelector('#appearance-cube').classList.contains('cube-loading-out'));
        await step(-1);
        await settled();
        assert.equal(await page.locator('#appearance-cube canvas').count(), 0);
      }
      const frames = await page.evaluate(() => { window.sampleLoading = false; return window.loadingFrames; });
      assert.ok(frames.some(frame => frame.loading));
      assert.ok(frames.filter(frame => frame.loading).every(frame => frame.hidden), 'The cube stays hidden throughout loading and throbber fade');
      if (reducedMotion === 'no-preference') {
        assert.ok(frames.some(frame => frame.fading));
        assert.ok(frames.some(frame => !frame.loading && !frame.hidden && frame.animation < 100), 'The entrance starts after loading ends');
      }
      while (await page.locator('.cube-carousel').getAttribute('data-model') !== 'standard') { await step(1); await settled(); }
      await page.locator('[data-control="cube-quality"]').selectOption('balanced');
      await step(1);
      await settled();
      assert.ok(await page.evaluate(() => window.tilesCanvas !== document.querySelector('#appearance-cube canvas')), 'Changing graphics settings invalidates cached models');
      await step(1);
      await page.locator('#dialog [data-action="close-dialog"]').first().evaluate(el => el.click());
      await page.waitForFunction(() => !document.querySelector('#dialog').open);
      await page.waitForTimeout(400);
      assert.equal(await page.locator('#appearance-cube canvas').count(), 0, 'Closing during loading releases the preview');
      assert.deepEqual(errors, []);
      console.log(`Carousel loading, fade order, rapid selection, reuse and cleanup passed (${reducedMotion})`);
      await page.close();
    }
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
