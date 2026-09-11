/* The Trainer's case cards preview the cube selected in Appearance. One shared
   preview cube renders every card, so the checks here are that cards actually
   paint, that different cases differ, that a drag lends the live canvas and
   gives it back, and that the Top diagram and the standard model still fall back
   to the 2D projector. */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.CT_PLAYWRIGHT || 'C:/Users/alejo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
let library = { version: 1, revision: 0, categories: [{ id: 'preview-test', name: 'Practice', solves: [] }], algSets: null };
const server = http.createServer((req, res) => {
  if (req.url === '/api/library') {
    if (req.method === 'PUT') {
      let body = '';
      req.on('data', c => { body += c; });
      req.on('end', () => {
        const sent = JSON.parse(body);
        library = { version: 1, revision: library.revision + 1, categories: sent.categories, algSets: sent.algSets };
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(library));
      });
      return;
    }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(library));
    return;
  }
  const file = path.resolve(root, '.' + (req.url === '/' ? '/CTU.html' : req.url.split('?')[0]));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  const ext = path.extname(file);
  res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2' })[ext] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});
// A card is "painted" when its still has enough opaque pixels and a non-zero
// colour sum; the hash lets two cards be compared for the same case.
const sampleCards = page => page.evaluate(() => {
  const canvases = [...document.querySelectorAll('.case-cube .case-canvas')];
  return canvases.slice(0, 6).map(canvas => {
    const d = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let opaque = 0, hash = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3]) opaque++;
      hash = (hash * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7) >>> 0;
    }
    return { w: canvas.width, h: canvas.height, opaque, hash };
  });
});
const loadTrainer = async (page, url, model) => {
  await page.addInitScript((finish) => {
    window.Worker = undefined;
    localStorage.setItem('cubetracker.preferences.v2', JSON.stringify({ version: 2, theme: 'light', scrambleAnimation: false, trainerView: '3d', cubeCross: 'U', cubeFinish: finish }));
  }, model);
  await page.goto(`${url}/#trainer`);
  await page.waitForSelector('.case-card');
};
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}`;
  const chrome = process.env.CT_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const browser = await chromium.launch({ headless: true, ...(fs.existsSync(chrome) ? { executablePath: chrome } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

    // The selected 3D model is what the cards show, so the 2D projector's canvas
    // fills the same slot but no sticker DOM layers are created per card.
    await loadTrainer(page, url, 'uv');
    await page.waitForSelector('.case-cube .case-canvas', { timeout: 15000 });
    await page.waitForFunction(() => document.querySelectorAll('.case-cube .cube-throbber').length === 0, null, { timeout: 15000 });
    await page.waitForTimeout(250);
    assert.equal(await page.locator('.case-cube .sticker').count(), 0, 'cards do not create sticker DOM layers');
    const painted = await sampleCards(page);
    assert.equal(painted.length, 6, 'visible cards render a canvas');
    assert.ok(painted.every(p => p.opaque > 500), `each card painted the cube: ${JSON.stringify(painted)}`);
    assert.ok(new Set(painted.map(p => p.hash)).size > 1, 'cards show different case states');

    // Dragging lends the one live canvas, releases it, and freezes the result.
    const first = page.locator('.case-canvas').first();
    const before = await first.evaluate(c => c.toDataURL());
    const box = await first.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 - 16, { steps: 5 });
    assert.equal(await page.locator('.case-cube.hosting-live').count(), 1, 'one card hosts the live canvas while dragged');
    assert.equal(await page.locator('.case-cube.hosting-live .cube-studio-canvas').count(), 1, 'the hosted canvas is the shared renderer');
    assert.equal(await first.evaluate(c => getComputedStyle(c).visibility), 'hidden', 'the frozen still hides behind the live cube');
    await page.mouse.up();
    await page.waitForTimeout(200);
    assert.notEqual(await first.evaluate(c => c.toDataURL()), before, 'card still changes after a drag');
    assert.equal(await first.evaluate(c => getComputedStyle(c).visibility), 'visible', 'the still returns after the drag');
    assert.equal(await page.locator('.case-cube.hosting-live').count(), 0, 'live canvas is released after the drag');
    assert.equal(await page.locator('#dialog[open]').count(), 0, 'dragging a card does not open the case');

    // Top mode keeps the flat diagram; 3D returns to the shared preview.
    await page.locator('[data-trainer-view="top"]').click();
    await page.waitForSelector('.case-cube .case-top');
    assert.equal(await page.locator('.case-canvas').count(), 0, 'Top mode removes 3D canvases');
    await page.locator('[data-trainer-view="3d"]').click();
    await page.waitForSelector('.case-cube .case-canvas');
    await page.waitForFunction(() => document.querySelectorAll('.case-cube .cube-throbber').length === 0);

    // A different model rebuilds the shared cube and paints again.
    await loadTrainer(page, url, 'tiles');
    await page.waitForSelector('.case-cube .case-canvas', { timeout: 15000 });
    await page.waitForFunction(() => document.querySelectorAll('.case-cube .cube-throbber').length === 0, null, { timeout: 15000 });
    await page.waitForTimeout(250);
    const tiles = await sampleCards(page);
    assert.ok(tiles.every(p => p.opaque > 500), 'the alternate model paints every card');

    // The standard model falls back to the 2D projection, unchanged.
    await loadTrainer(page, url, 'standard');
    await page.waitForSelector('.case-cube .case-canvas');
    await page.waitForTimeout(150);
    assert.equal(await page.locator('.case-cube .cube-studio-canvas').count(), 0, 'standard keeps the 2D projector');
    assert.ok((await sampleCards(page)).every(p => p.opaque > 500), 'the 2D fallback still paints');

    assert.deepEqual(errors, [], 'no console errors');
    console.log(`Trainer previews OK · uv, tiles and standard · ${painted.length} cards sampled`);
  } finally {
    await browser.close();
    server.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
