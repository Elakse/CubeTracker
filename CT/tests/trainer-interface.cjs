/* The Trainer in a real browser: previews, selection, algorithm validation,
   the preferred-algorithm star, a full round, and times surviving a reload. */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.CT_PLAYWRIGHT || 'C:/Users/alejo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
// The library lives in this process, so the real workspace is never touched and
// a reload reads back exactly what the app saved.
let library = { version: 1, revision: 0, categories: [{ id: 'trainer-test', name: 'Practice', solves: [] }], algSets: null };
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
  res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' })[path.extname(file)] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}`;
  // Chrome where it is installed, Playwright's own browser where it is not.
  const chrome = process.env.CT_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const browser = await chromium.launch({ headless: true, ...(fs.existsSync(chrome) ? { executablePath: chrome } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.addInitScript(() => {
      window.Worker = undefined;
      localStorage.setItem('cubetracker.preferences.v2', JSON.stringify({ version: 2, theme: 'light', scrambleAnimation: false, trainerView: '3d', cubeCross: 'U' }));
    });
    await page.goto(`${url}/#trainer`);
    await page.waitForSelector('.case-card');

    // The preloaded set arrives complete and every card draws its own case.
    assert.equal(await page.locator('.case-group').count(), 3, 'three PLL groups');
    assert.equal(await page.locator('.case-card').count(), 21, '21 PLL cases');
    await page.waitForSelector('.case-cube .case-canvas');
    assert.equal(await page.locator('.case-cube .sticker').count(), 0, 'cards do not create sticker DOM layers');

    // A card cube rotates in place, and a drag does not accidentally open it.
    const firstCanvas = page.locator('.case-canvas').first();
    const paintedBounds = await firstCanvas.evaluate(canvas => {
      const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let left = canvas.width, top = canvas.height, right = -1, bottom = -1;
      for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++)
        if (pixels[(y * canvas.width + x) * 4 + 3]) {
          left = Math.min(left, x); top = Math.min(top, y);
          right = Math.max(right, x); bottom = Math.max(bottom, y);
        }
      return { left, top, right: canvas.width - 1 - right, bottom: canvas.height - 1 - bottom };
    });
    assert.ok(Object.values(paintedBounds).every(value => value >= 6), `cube is clipped: ${JSON.stringify(paintedBounds)}`);
    const beforeThumb = await firstCanvas.evaluate(canvas => canvas.toDataURL());
    const box = await firstCanvas.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 34, box.y + box.height / 2 - 12, { steps: 4 });
    await page.mouse.up();
    const afterThumb = await firstCanvas.evaluate(canvas => canvas.toDataURL());
    assert.notEqual(afterThumb, beforeThumb, 'card cube redraws after a drag');
    assert.equal(await page.locator('#dialog[open]').count(), 0, 'dragging a card cube does not open the case');

    // The 3D/Top switch swaps every preview for the flat diagram, and back.
    await page.locator('[data-trainer-view="top"]').click();
    await page.waitForSelector('.case-cube .case-top');
    assert.equal(await page.locator('.case-canvas').count(), 0, 'Top mode removes 3D canvases');
    const hTop = page.locator('.case-card', { has: page.locator('.case-name', { hasText: /^H$/ }) }).locator('.case-top');
    const hColors = await hTop.locator(':scope > span').evaluateAll(spans => spans.map(span => span.style.backgroundColor));
    assert.equal(hColors[12], 'rgb(239, 202, 87)', 'white cross down puts yellow on the Trainer upper face');
    const hBands = [[1,2,3], [5,10,15], [9,14,19], [21,22,23]];
    assert.ok(hBands.some(indices => new Set(indices.map(index => hColors[index])).size > 1), 'the PLL setup is executed after the selected hold, so the case remains on top');
    await page.locator('[data-trainer-view="3d"]').click();
    await page.waitForSelector('.case-cube .case-canvas');

    // The second built-in set contains every numbered OLL, arranged by shape.
    await page.locator('[data-control="alg-set"]').selectOption({ label: 'OLL' });
    await page.waitForFunction(() => document.querySelectorAll('.case-card').length === 57);
    assert.equal(await page.locator('.case-group').count(), 14, '14 OLL shape groups');
    assert.equal(await page.locator('.case-card').count(), 57, '57 OLL cases');
    assert.equal(await page.locator('.case-alg').count(), 57, 'one preferred alg per OLL');
    const headingActions = page.locator('.page-heading .heading-actions');
    assert.ok((await headingActions.locator('[data-control="alg-set"]').count()) === 1, 'set selector stays in the heading');
    assert.ok((await headingActions.locator('[data-action="manage-set"]').count()) === 1, 'the set menu is a visible button beside it');
    assert.equal(await page.locator('.case-group .case-add').count(), 14, 'every group ends with an Add case tile');
    assert.equal(await page.locator('.group-add').count(), 1, 'one New group button closes the page');
    assert.equal(await page.locator('.trainer-summary .lib-stat b').first().textContent(), '57', 'the summary counts the cases');
    await page.locator('#trainer-select').click();
    assert.equal(await page.locator('.case-card.picked').count(), 57, 'Select all picks the current set');
    assert.equal(await page.locator('.train-bar-count strong').textContent(), '57');
    assert.equal(await page.locator('#trainer-picked b').textContent(), '57', 'the summary follows the selection');
    assert.match(await page.locator('#trainer-select').textContent(), /Clear selection/, 'the same button now clears');
    await page.locator('#trainer-select').click();
    assert.equal(await page.locator('.case-card.picked').count(), 0, 'Clear selection empties it');
    await page.locator('[data-control="alg-set"]').selectOption({ label: 'PLL' });
    await page.waitForFunction(() => document.querySelectorAll('.case-card').length === 21);

    // An algorithm has to solve the case it is being added to.
    const openCase = async name => {
      await page.locator('.case-card', { has: page.locator('.case-name', { hasText: new RegExp(`^${name}$`) }) }).locator('.case-open').click();
      await page.waitForSelector('#case-cube .cube-stage');
    };
    await openCase('H');
    await page.fill('.alg-add input', "R U R' U'");
    await page.locator('.alg-add button').click();
    assert.match(await page.locator('#alg-error').textContent(), /does not solve this case/);
    await page.fill('.alg-add input', 'M2 U2 M2 U M2 U2 M2');
    await page.locator('.alg-add button').click();
    await page.waitForFunction(() => document.querySelectorAll('.alg-row').length === 4);
    assert.equal(await page.locator('#alg-error').textContent(), '', 'a valid algorithm is accepted');

    // The star sets the preferred algorithm, which is what the card shows.
    await page.locator('.alg-row').last().locator('.alg-star').click();
    await page.waitForFunction(() => document.querySelectorAll('.alg-row').length === 4);
    assert.equal(await page.locator('.alg-row').last().locator('.alg-star.on').count(), 1, 'the last algorithm is preferred');

    // The cube opens on the case and the playback runs the algorithm over it.
    // That the last move leaves it solved is the unit tests' job; here it is
    // enough that the scene moves and the strip tracks it.
    const layout = () => page.evaluate(() => [...document.querySelectorAll('#case-cube .sticker')].map(s => s.style.transform).join('|'));
    const moves = await page.locator('.scramble-tokens button').count();
    assert.ok(moves > 0, 'the algorithm is listed move by move');
    assert.equal(await page.locator('.scramble-tokens button.done').count(), 0, 'the case is shown before the first move');
    const before = await layout();
    await page.locator('[data-cube="last"]').click();
    await page.waitForTimeout(400);
    assert.notEqual(await layout(), before, 'playing the algorithm turns the cube');
    assert.equal(await page.locator('.scramble-tokens button.done').count(), moves, 'every move is marked done');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('#dialog').open);
    assert.equal(await page.locator('.case-card').first().locator('.case-alg').textContent(), 'M2 U2 M2 U M2 U2 M2', 'the card follows the star');

    // A group ticks all of its own cases.
    assert.ok(await page.locator('.train-bar').isHidden(), 'nothing selected, no Train');
    await page.locator('[data-group-check]').first().click();
    await page.waitForSelector('.train-bar:not([hidden])');
    assert.equal(await page.locator('.case-card.picked').count(), 4, 'the whole group is picked');
    // One case is enough to train: the bar appears with a single pick.
    await page.locator('[data-action="clear-selection"]').first().click();
    await page.locator('[data-case-check]').first().click();
    await page.waitForSelector('.train-bar:not([hidden])');
    assert.equal(await page.locator('.train-bar-count strong').textContent(), '1', 'a single case can be trained');
    await page.locator('[data-case-check]').first().click();
    assert.ok(await page.locator('.train-bar').isHidden(), 'unticking the last case hides Train');
    await page.locator('[data-group-check]').first().click();
    await page.waitForSelector('.train-bar:not([hidden])');

    // A round of three attempts, timed the way the timer is.
    await page.locator('[data-action="train"]').click();
    await page.waitForSelector('#train-form');
    await page.fill('#train-form input[name="count"]', '3');
    await page.locator('#train-form button[type="submit"]').click();
    await page.waitForSelector('.training-stage');
    assert.equal(await page.locator('#training-progress').textContent(), '1 / 3');
    assert.equal(await page.locator('.training-stage .cube-stage').count(), 0, 'no cube during a round');
    const scrambles = new Set();
    for (let attempt = 0; attempt < 3; attempt++) {
      scrambles.add(await page.locator('.focus-scramble').textContent());
      await page.keyboard.down('Space');
      await page.waitForTimeout(450);
      await page.keyboard.up('Space');
      await page.waitForTimeout(400);
      await page.keyboard.press('KeyX');
      // Stops set a 1s restart cooldown, so the next hold has to wait it out.
      await page.waitForTimeout(1200);
    }
    assert.equal(await page.locator('#dialog-title').textContent(), 'Round complete');
    assert.equal(await page.locator('.round-row').count(), 3, 'every attempt is listed');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('#dialog').open);

    // The times are saved with their cases and read back on a reload.
    await page.waitForFunction(() => true);
    await page.reload();
    await page.waitForSelector('.case-card');
    const attempts = library.algSets[0].cases.reduce((n, c) => n + (c.stats.attempts || 0), 0);
    assert.equal(attempts, 3, 'three attempts were saved');
    const trained = library.algSets[0].cases.find(c => c.stats.attempts > 0);
    assert.ok(trained.stats.best > 0, 'a best time was recorded');
    await openCase(trained.name);
    assert.equal(await page.locator('.case-stats').count(), 1, 'the case shows its times');
    assert.deepEqual(errors, [], 'no console errors');
    console.log(`Trainer interface OK · 21 cases · ${scrambles.size} distinct scrambles in 3 attempts`);
  } finally {
    await browser.close();
    server.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
