/* Lighting studio layout and cube-setting regression checks in a real browser. */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.CT_PLAYWRIGHT || 'C:/Users/alejo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const root = path.resolve(__dirname, '..');
const library = { version: 1, revision: 0, categories: [{ id: 'studio-test', name: 'Practice', solves: [] }] };
const server = http.createServer((req, res) => {
  if (req.url === '/api/library') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(library));
    return;
  }
  const file = path.resolve(root, '.' + (req.url === '/' ? '/CTU.html' : req.url.split('?')[0]));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg' })[path.extname(file)] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const chrome = process.env.CT_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const browser = await chromium.launch({ headless: true, ...(fs.existsSync(chrome) ? { executablePath: chrome } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => localStorage.setItem('cubetracker.preferences.v2', JSON.stringify({
      version: 2,
      theme: 'light',
      cubeFinish: 'tiles',
      cubePalette: 'standard',
      cubeCore: 'black',
      cubeCross: 'D',
      cubeQuality: 'medium',
      cubeEnvironment: 'studio',
      cubeWear: false,
    })));
    await page.goto(`http://127.0.0.1:${server.address().port}/#timer`);
    await page.locator('[data-action="appearance"]').evaluate(element => element.click());
    await page.locator('[data-action="lighting-studio"]').click();
    await page.locator('.lighting-panel-title').waitFor({ state: 'visible', timeout: 15000 });

    const layout = await page.evaluate(() => {
      const rect = selector => {
        const box = document.querySelector(selector).getBoundingClientRect();
        return { x: box.x, width: box.width, right: box.right, bottom: box.bottom };
      };
      return {
        viewport: { width: innerWidth, height: innerHeight },
        main: rect('#main'),
        screen: rect('.lighting-screen'),
        canvas: rect('.lighting-canvas'),
        panel: rect('.lighting-panel'),
        footer: getComputedStyle(document.querySelector('.footer')).display,
        pageOverflow: document.documentElement.scrollHeight - innerHeight,
      };
    });
    assert.equal(layout.main.x, 0, 'Studio removes the normal sidebar offset');
    assert.equal(layout.main.width, layout.viewport.width, 'Studio uses the full viewport width');
    assert.equal(layout.screen.bottom, layout.viewport.height, 'Studio ends exactly at the viewport edge');
    assert.equal(layout.canvas.bottom, layout.viewport.height, 'Cube canvas fills the studio height');
    assert.equal(layout.panel.bottom, layout.viewport.height, 'Inspector fills the studio height');
    assert.equal(layout.panel.right, layout.viewport.width, 'Inspector is flush with the right edge');
    assert.equal(layout.footer, 'none', 'Normal app footer is absent');
    assert.ok(layout.pageOverflow <= 0, 'Desktop studio does not create page-level overflow');

    assert.equal(await page.locator('.studio-zoom').count(), 0, 'Redundant zoom controls are absent');
    assert.equal(await page.locator('[data-studio-accent]').count(), 0, 'App accent does not appear among cube settings');
    assert.equal(await page.locator('[data-control="studio-theme"]').count(), 0, 'Display theme does not appear among cube settings');
    assert.equal(await page.locator('[data-studio-core]').count(), 3, 'All core colors are present');
    assert.equal(await page.locator('[data-studio-cross]').count(), 6, 'All cross colors are present');

    await page.locator('[data-studio-core="green"]').click();
    assert.equal(await page.locator('[data-studio-core="green"]').getAttribute('aria-pressed'), 'true');
    await page.locator('[data-studio-cross="U"]').click();
    assert.equal(await page.locator('[data-studio-cross="U"]').getAttribute('aria-pressed'), 'true');
    const preferences = await page.evaluate(() => JSON.parse(localStorage.getItem('cubetracker.preferences.v2')));
    assert.equal(preferences.cubeCore, 'green');
    assert.equal(preferences.cubeCross, 'U');
    assert.deepEqual(errors, []);
    if (process.env.CT_STUDIO_SCREENSHOT) await page.screenshot({ path: process.env.CT_STUDIO_SCREENSHOT });

    await page.setViewportSize({ width: 800, height: 844 });
    const medium = await page.evaluate(() => {
      const box = selector => document.querySelector(selector).getBoundingClientRect();
      return { main: box('#main').width, canvas: box('.lighting-canvas').width, panel: box('.lighting-panel').width, bottom: box('.lighting-panel').bottom, viewport: innerHeight };
    });
    assert.equal(medium.main, 800, 'Compact desktop studio still uses the full width');
    assert.equal(medium.canvas + medium.panel, 800, 'Compact desktop columns fit without a gutter or overflow');
    assert.equal(medium.bottom, medium.viewport, 'Compact desktop inspector fills the viewport');

    await page.setViewportSize({ width: 390, height: 844 });
    const narrow = await page.evaluate(() => ({
      main: document.querySelector('#main').getBoundingClientRect().width,
      screen: document.querySelector('.lighting-screen').getBoundingClientRect().width,
      canvas: document.querySelector('.lighting-canvas').getBoundingClientRect().width,
      panel: document.querySelector('.lighting-panel').getBoundingClientRect().width,
      columns: getComputedStyle(document.querySelector('.lighting-screen')).gridTemplateColumns,
      padding: getComputedStyle(document.querySelector('.lighting-screen')).padding,
      pageWidth: document.documentElement.scrollWidth,
      footer: getComputedStyle(document.querySelector('.footer')).display,
    }));
    assert.equal(narrow.canvas, 390, 'Narrow studio canvas spans the viewport');
    assert.equal(narrow.panel, 390, 'Narrow inspector stacks at full width');
    assert.equal(narrow.pageWidth, 390, 'Narrow studio has no horizontal overflow');
    assert.equal(narrow.footer, 'none');

    console.log(JSON.stringify({ layout, medium, narrow }, null, 2));
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
