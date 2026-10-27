/* Isolated appearance checks: real browser/GPU, no user's library or preferences. */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.CT_PLAYWRIGHT || 'C:/Users/alejo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = process.env.CT_SCREENSHOT_DIR || path.join(__dirname, 'screenshots');
const library = { version: 1, revision: 0, categories: [{ id: 'appearance-test', name: 'Practice', solves: Array.from({ length: 12 }, (_, i) => ({ id: `s-${i}`, rawMs: 10000 + i * 230, penalty: '', scramble: "R U R' U' F2 D L2 B", date: new Date(2026, 8, 1, 12, i).toISOString(), note: '' })) }] };
const server = http.createServer((req, res) => {
  if (req.url === '/api/library') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(library)); return; }
  const file = path.resolve(root, '.' + (req.url === '/' ? '/CTU.html' : req.url.split('?')[0]));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' })[path.extname(file)] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => {
      window.Worker = undefined;
      if (!localStorage.getItem('cubetracker.preferences.v2')) localStorage.setItem('cubetracker.preferences.v2', JSON.stringify({ version: 2, theme: 'light', scrambleAnimation: false }));
    });
    // CT_BASE_URL exercises the running production server; intercept library
    // requests in this isolated browser so real solves are never read or written.
    await page.route('**/api/library', route => route.fulfill({ json: library }));
    await page.goto(`${process.env.CT_BASE_URL || `http://127.0.0.1:${server.address().port}`}/#timer`);
    const close = async () => { await page.locator('#dialog [data-action="close-dialog"]').first().click(); await page.waitForFunction(() => !document.querySelector('#dialog').open); };
    const model = () => page.locator('.cube-carousel').getAttribute('data-model');
    // Models are reached only through the arrows now, and the slide swaps the
    // model at its halfway point, so each press is followed by a settle.
    const selectModel = async name => {
      for (let i = 0; i <= 5; i++) {
        if (await model() === name) return;
        await page.locator('[data-cube-step="1"]').click();
        await page.waitForTimeout(240);
      }
      throw new Error('carousel never reached ' + name);
    };
    const dimensions = () => page.evaluate(() => {
      const dialog = document.querySelector('#dialog'), list = document.querySelector('.average-solves');
      return { height: dialog.offsetHeight, client: list.clientHeight, scroll: list.scrollHeight, gap: list.getBoundingClientRect().bottom - list.lastElementChild.getBoundingClientRect().bottom };
    });
    await page.locator('[data-stat="ao5"]').click();
    await page.waitForTimeout(350);
    const five = await dimensions(); console.log('ao5', five);
    await page.screenshot({ path: path.join(output, 'average-ao5-compact.png') });
    await close();
    await page.locator('[data-stat="ao12"]').click();
    const twelve = await dimensions(); console.log('ao12', twelve);
    assert.equal(five.height, twelve.height);
    assert.ok(twelve.scroll > twelve.client);
    await page.locator('.average-solve').last().scrollIntoViewIfNeeded();
    await page.locator('.average-solve').last().click();
    assert.equal(await page.locator('.average-solve[aria-pressed="true"] .average-index').textContent(), '12');
    assert.ok(await page.locator('.average-solves').evaluate(el => el.scrollTop > 0));
    await page.screenshot({ path: path.join(output, 'average-ao12-compact.png') });
    await close();
    for (const width of [800, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await page.locator('[data-stat="ao5"]').evaluate(el => el.click());
      await page.waitForTimeout(350);
      const compactFive = await dimensions();
      assert.ok(compactFive.scroll <= compactFive.client + 1, `All five solves fit at ${width}px`);
      await close();
      await page.locator('[data-stat="ao12"]').evaluate(el => el.click());
      const compactTwelve = await dimensions();
      assert.equal(compactFive.height, compactTwelve.height);
      assert.ok(compactTwelve.scroll > compactTwelve.client);
      await page.locator('.average-solve').last().scrollIntoViewIfNeeded();
      await page.locator('.average-solve').last().click();
      assert.ok(await page.locator('.average-solves').evaluate(el => el.scrollTop > 0));
      await page.screenshot({ path: path.join(output, `average-ao12-${width}.png`) });
      await close();
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    assert.equal(await page.locator('#cube-mount .cube-stage').count(), 1);
    await page.locator('#theme-btn').evaluate(el => el.click());
    assert.equal(await page.locator('#dialog[open].appearance-dialog').count(), 1, 'Appearance opens before cube work begins');
    assert.equal(await page.locator('#appearance-cube.cube-loading').count(), 1, 'The dialog owns a stable cube placeholder');
    assert.equal(await page.locator('#cube-mount .cube-stage.cube-death').count(), 1, 'The background cube animates out');
    await page.waitForFunction(() => !document.querySelector('#cube-mount .cube-stage'));
    const workspaceGutters = await page.locator('.cube-workspace').evaluate(el => {
      const frame = el.querySelector('.cube-carousel-frame').getBoundingClientRect();
      const controls = el.querySelector('.cube-controls').getBoundingClientRect();
      const outerDivider = el.closest('.appearance-layout').querySelector('.appearance-divider').getBoundingClientRect();
      return { before: frame.left - outerDivider.right, after: controls.left - frame.right, frame: frame.width, controls: controls.width };
    });
    assert.ok(Math.abs(workspaceGutters.before - workspaceGutters.after) <= 2, 'The cube is packed between equal divider gutters');
    assert.ok(workspaceGutters.frame <= 361 && workspaceGutters.controls > workspaceGutters.frame, 'Recovered workspace width belongs to cube settings');
    assert.equal(await page.locator('[data-cube-palette]').count(), 2);
    assert.equal(await page.locator('[data-cube-cross]').count(), 6);
    assert.equal(await page.locator('[data-cube-palette="classic"] strong').textContent(), 'Washed');
    assert.equal(await page.locator('.appearance-dialog small').count(), 0, 'Appearance controls do not carry descriptive subtitles');
    assert.equal(await page.locator('[data-cube-dot]').count(), 6);
    assert.ok(await page.locator('#dialog').evaluate(el => el.scrollHeight <= el.clientHeight + 1), 'The dialog itself does not scroll');
    assert.ok(await page.locator('.appearance-scroll').evaluate(el => getComputedStyle(el).overflowY === 'auto'), 'The settings pane is the scrolling one');
    assert.ok(await page.locator('.appearance-cube-pane').evaluate(el => el.scrollHeight <= el.clientHeight + 1), 'The cube pane fits above the dialog footer');
    assert.ok(await page.locator('.appearance-dialog .dialog-actions [data-action="close-dialog"]').evaluate(el => {
      const button = el.getBoundingClientRect(), dialog = el.closest('dialog').getBoundingClientRect();
      return button.top >= dialog.top && button.bottom <= dialog.bottom;
    }), 'The Done button remains fully inside the Appearance dialog');
    const crossCentre = page.locator('#appearance-cube .sticker').nth(4);
    const crossBefore = await crossCentre.evaluate(el => el.style.transform);
    await page.locator('[data-cube-cross="U"]').click();
    await page.waitForTimeout(120);
    const crossMid = await crossCentre.evaluate(el => el.style.transform);
    assert.notEqual(crossMid, crossBefore, 'Changing cross animates the cube rotation');
    await page.waitForTimeout(360);
    await page.locator('#appearance-cube .cube-stage').press('Enter');
    assert.equal(await page.locator('#appearance-cube .net-face[title="D face"] span').nth(4).evaluate(el => el.style.backgroundColor), 'rgb(244, 242, 233)', 'The preferred white cross is displayed on the down face');
    assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('cubetracker.preferences.v2')))).cubeCross, 'U');
    await page.locator('#appearance-cube .cube-stage').press('Enter');
    await close();
    await page.locator('#cube-mount .cube-stage').waitFor();
    await page.locator('#cube-mount .cube-stage').press('Enter');
    assert.equal(await page.locator('#cube-mount .net-face[title="D face"] span').nth(4).evaluate(el => el.style.backgroundColor), 'rgb(239, 202, 87)', 'The live timer keeps yellow down regardless of the preferred cross');
    await page.locator('#cube-mount .cube-stage').press('Enter');
    await page.locator('#theme-btn').evaluate(el => el.click());
    await page.waitForFunction(() => !document.querySelector('#cube-mount .cube-stage'));
    await page.locator('[data-cube-cross="D"]').click();
    const paletteImages = {};
    for (const palette of ['classic', 'vivid']) {
      await page.locator('[data-cube-palette="' + palette + '"]').click();
      for (const name of ['standard', 'tiles', 'stickers', 'speedcube', 'uv', 'og']) {
        await selectModel(name);
        if (name !== 'standard') await page.locator('#appearance-cube canvas[data-model="' + name + '"]').waitFor();
        else await page.waitForFunction(() => !document.querySelector('#appearance-cube canvas'));
        if (name === 'speedcube' || name === 'uv' || name === 'og') await page.locator('#appearance-cube canvas[data-logo="loaded"]').waitFor();
        await page.waitForTimeout(250);
        const shot = await page.locator('#appearance-cube').screenshot({ path: path.join(output, 'cube-' + name + '-' + palette + '.png') });
        if (palette === 'classic') paletteImages[name] = shot;
        else assert.ok(!paletteImages[name].equals(shot), name + ' changes palette');
        const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('cubetracker.preferences.v2')));
        assert.equal(saved.cubePalette, palette);
        assert.equal(saved.cubeFinish, name);
      }
    }
    assert.ok(!paletteImages.tiles.equals(paletteImages.stickers), 'Stickers and Tiles render differently');
    await page.locator('[data-cube-step="1"]').click();
    await page.waitForTimeout(240);
    assert.equal(await model(), 'standard', 'The carousel wraps past the last cube');
    await page.locator('[data-cube-step="-1"]').click();
    await page.waitForTimeout(240);
    assert.equal(await model(), 'og', 'And wraps back');
    await page.locator('#appearance-cube canvas[data-model="og"]').waitFor();
    await page.waitForTimeout(360);
    await page.screenshot({ path: path.join(output, 'appearance-carousel.png') });
    // The bare and coated cubes share every line of geometry, so the pair is
    // rendered together: the only thing that may differ between them is surface.
    for (const model of ['speedcube', 'uv']) {
      const detailPage = await browser.newPage({ viewport: { width: 800, height: 800 }, deviceScaleFactor: 1 });
      await detailPage.route('**/api/library', route => route.fulfill({ json: library }));
      await detailPage.goto(page.url());
      await detailPage.evaluate(async name => {
        const { RealisticCube } = await import('/assets/cube-realistic.js');
        const stage = document.createElement('div');
        stage.style.cssText = 'position:fixed;inset:0;background:white';
        document.body.replaceChildren(stage);
        const cube = new RealisticCube(stage, () => {}, name);
        cube.setPalette({ U: '#fafcff', R: '#eb3046', F: '#16bd6b', D: '#ffdb19', L: '#ff821c', B: '#2474ef' });
        cube.draw(new CT.Cube().apply("x'").stickers);
        cube.orbit(-25, -42, 1);
      }, model);
      await detailPage.locator('canvas[data-logo="loaded"]').waitFor();
      await detailPage.screenshot({ path: path.join(output, model + '-reference-detail.png') });
      await detailPage.close();
    }
    await page.locator('[data-cube-palette="vivid"]').click();
    await selectModel('tiles');
    await page.locator('#appearance-cube .cube-realistic').waitFor({ timeout: 20000 });
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(output, 'appearance-studio.png') });
    await page.locator('#appearance-cube').screenshot({ path: path.join(output, 'cube-studio.png') });
    const stage = page.locator('#appearance-cube .cube-stage');
    const before = await stage.screenshot();
    await stage.press('ArrowRight');
    const after = await stage.screenshot();
    assert.ok(!before.equals(after), 'Lighting and geometry respond to orbit');
    await stage.press('Enter');
    assert.equal(await page.locator('#appearance-cube .net-face span').count(), 54);
    assert.equal(await page.locator('#appearance-cube canvas').isVisible(), false);
    await page.locator('[data-cube-palette="classic"]').click();
    assert.equal(await page.locator('#appearance-cube .net-face span').first().evaluate(el => el.style.backgroundColor), 'rgb(244, 242, 233)');
    await stage.press('Enter');
    await page.locator('#appearance-cube .cube-realistic').waitFor();
    await close();
    await page.locator('#cube-mount .cube-stage').waitFor();
    assert.equal(await page.locator('#cube-mount .cube-stage.cube-materialize').count(), 1, 'The background cube animates back in');
    assert.equal(await page.locator('#appearance-cube canvas').count(), 0);
    await page.reload();
    await page.locator('#cube-mount .cube-realistic').waitFor();
    await page.screenshot({ path: path.join(output, 'timer-studio.png') });
    await page.locator('[data-stat="ao5"]').click();
    await page.locator('#drawer-cube .cube-realistic').waitFor();
    await page.locator('#dialog [data-cube="first"]').click();
    await page.waitForTimeout(650);
    await page.locator('#drawer-cube').screenshot({ path: path.join(output, 'cube-studio-solved.png') });
    const solved = await page.locator('#drawer-cube').screenshot();
    await page.locator('#dialog [data-cube="next"]').click();
    await page.waitForTimeout(350);
    const moved = await page.locator('#drawer-cube').screenshot();
    assert.ok(!solved.equals(moved), 'A move changes the rendered cube');
    await page.locator('#dialog [data-cube="prev"]').click();
    await page.waitForTimeout(350);
    const restored = await page.locator('#drawer-cube').screenshot();
    assert.ok(restored.equals(solved), 'Forward/backward restores exactly the same rendered state');
    await close();
    for (const name of ['stickers', 'speedcube', 'og']) {
      await page.locator('#theme-btn').evaluate(el => el.click());
      await selectModel(name);
      await page.locator('#appearance-cube canvas[data-model="' + name + '"]').waitFor();
      await close();
      await page.reload();
      await page.locator('#cube-mount canvas[data-model="' + name + '"]').waitFor();
      await page.locator('[data-stat="ao5"]').click();
      await page.locator('#drawer-cube canvas[data-model="' + name + '"]').waitFor();
      await page.locator('#dialog [data-cube="first"]').click();
      await page.waitForTimeout(650);
      const first = await page.locator('#drawer-cube').screenshot();
      await page.locator('#dialog [data-cube="next"]').click();
      await page.waitForTimeout(350);
      assert.ok(!first.equals(await page.locator('#drawer-cube').screenshot()), name + ' plays moves');
      await page.locator('#dialog [data-cube="prev"]').click();
      await page.waitForTimeout(350);
      assert.ok(first.equals(await page.locator('#drawer-cube').screenshot()), name + ' restores moves exactly');
      await close();
    }
    await page.locator('#theme-btn').evaluate(el => el.click());
    await page.locator('#appearance-cube .cube-realistic').waitFor();
    await page.locator('[data-theme-choice="dark"]').click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(output, 'appearance-studio-dark.png') });
    // Graphics quality is the shared dropdown: closed by default, opens in the
    // top layer so the dialog cannot clip it, applies on choice and closes again.
    const qualityMenu = page.locator('.dd-menu[aria-label="Graphics quality"]');
    const qualityTrigger = page.locator('[data-control="cube-quality"] + .dd .dd-trigger');
    assert.equal(await qualityMenu.isVisible(), false);
    await qualityTrigger.click();
    await page.waitForTimeout(260);
    assert.equal(await qualityMenu.isVisible(), true);
    const menuBox = await qualityMenu.boundingBox(), viewport = page.viewportSize();
    assert.ok(menuBox.y >= 0 && menuBox.y + menuBox.height <= viewport.height, 'The quality menu stays on screen');
    await page.screenshot({ path: path.join(output, 'appearance-quality-menu.png') });
    await qualityMenu.getByRole('option', { name: 'High' }).click();
    // Surface wear is independent of quality; opt into it explicitly.
    await page.locator('[data-control="cube-wear"]').check();
    await page.locator('#appearance-cube canvas[data-wear="loaded"]').waitFor({ timeout: 20000 });
    await page.waitForTimeout(220);
    assert.equal(await qualityMenu.isVisible(), false);
    assert.equal((await qualityTrigger.textContent()).trim(), 'High');
    assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('cubetracker.preferences.v2')))).cubeQuality, 'high');
    await qualityTrigger.click();
    await qualityMenu.getByRole('option', { name: 'Balanced' }).click();
    await page.waitForTimeout(300);
    await page.locator('#appearance-cube canvas[data-wear="loaded"]').waitFor();
    await page.locator('[data-control="cube-wear"]').uncheck();
    await page.waitForFunction(() => !document.querySelector('#appearance-cube canvas[data-wear]'));
    // The floor shadow is live: it is saved and applied without rebuilding the cube.
    const floorShadowPref = () => page.evaluate(() => JSON.parse(localStorage.getItem('cubetracker.preferences.v2')).cubeFloorShadow);
    const cubeCanvas = await page.locator('#appearance-cube canvas').elementHandle();
    await page.locator('[data-control="cube-floor-shadow"]').uncheck();
    assert.equal(await floorShadowPref(), false);
    assert.equal(await page.locator('#appearance-cube canvas').elementHandle().then(h => h.evaluate((a, b) => a === b, cubeCanvas)), true, 'Toggling the floor shadow keeps the same canvas');
    await page.locator('[data-control="cube-floor-shadow"]').check();
    assert.equal(await floorShadowPref(), true);
    for (const width of [800, 390]) {
      await page.setViewportSize({ width, height: 844 });
      const framed = await page.locator('.cube-carousel-frame').evaluate(el => { const a = el.getBoundingClientRect(), b = el.closest('.dialog-body').getBoundingClientRect(); return a.left >= b.left - 1 && a.right <= b.right + 1 && a.width > 140; });
      assert.ok(framed, 'The carousel fits its pane at ' + width + 'px');
      assert.ok(await page.locator('#dialog').evaluate(el => el.scrollWidth <= el.clientWidth + 1));
      await page.screenshot({ path: path.join(output, `appearance-studio-${width}.png`) });
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    // Verify graceful recovery from a lost GPU context and switching back to CSS.
    await page.locator('#appearance-cube canvas').evaluate(el => el.dispatchEvent(new Event('webglcontextlost', { cancelable: true })));
    assert.match(await page.locator('#cube-finish-status').textContent(), /unavailable/);
    assert.equal(await page.locator('#appearance-cube canvas').count(), 0);
    await selectModel('standard');
    assert.equal(await page.locator('canvas.cube-studio-canvas').count(), 0);
    assert.ok(await page.locator('#appearance-cube .sticker').first().evaluate(el => !!el.style.transform));
    await page.evaluate(() => localStorage.setItem('cubetracker.preferences.v2', JSON.stringify({ version: 2, cubeFinish: 'realistic', cubePalette: 'pastel', scrambleAnimation: false })));
    await page.reload();
    await page.locator('#theme-btn').evaluate(el => el.click());
    await page.locator('#appearance-cube canvas[data-model="tiles"]').waitFor();
    assert.equal(await model(), 'tiles');
    assert.equal(await page.locator('[data-cube-palette="classic"]').getAttribute('aria-pressed'), 'true');
    await page.locator('[data-cube-step="1"]').click();
    await page.locator('#appearance-cube canvas[data-model="stickers"]').waitFor();
    assert.equal(await model(), 'stickers');
    assert.deepEqual(errors, []);
    assert.ok(five.scroll <= five.client + 1, 'All five solves fit without scrolling');
    assert.ok(five.gap >= -1 && five.gap < 18, 'No blank space below ao5 list');
    console.log('PASS: equal compact dialogs, list scroll, two-pane appearance, arrow carousel, quality dropdown, palettes, persistence, GPU orbit/playback, net, responsive styles and GPU fallback.');
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
