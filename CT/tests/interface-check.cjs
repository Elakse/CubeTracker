/* Isolated browser verification. All writes go to an in-memory test library. */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.CT_PLAYWRIGHT || 'C:/Users/alejo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'tests', 'screenshots');
fs.mkdirSync(output, { recursive: true });
let library = { version: 1, revision: 0, categories: [{ id: 'visual-test', name: 'Practice', solves: Array.from({length: 240}, (_, i) => ({ id: `solve-${i}`, rawMs: Math.round((16 - i * .015 + Math.sin(i * 2) * 2) * 1000), penalty: i === 236 ? 'DNF' : '', scramble: i % 2 ? "R U R' U' F2 D L2 B" : "F R2 U' L D2 B' R U2", date: new Date(Date.now() - (239 - i) * 18 * 3600000).toISOString(), note: '' })) }] };
const server = http.createServer(async (req, res) => {
  if (req.url === '/api/library') {
    if (req.method === 'PUT') { let data = ''; for await (const chunk of req) data += chunk; library = { version: 1, ...JSON.parse(data), revision: library.revision + 1 }; }
    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(library)); return;
  }
  const file = path.join(root, req.url.split('?')[0] === '/' ? 'CTU.html' : req.url.split('?')[0]);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', ({'.html':'text/html','.js':'application/javascript','.css':'text/css','.woff2':'font/woff2','.mp3':'audio/mpeg'})[path.extname(file)] || 'text/plain');
  res.end(fs.readFileSync(file));
});
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => { window.Worker = undefined; window.__playedCues = []; HTMLMediaElement.prototype.play = function () { window.__playedCues.push(new URL(this.src).pathname); return Promise.resolve(); }; localStorage.setItem('cubetracker.preferences.v2', JSON.stringify({version:2,range:1000,theme:'light',pressToStart:true})); });
    await page.goto(`http://127.0.0.1:${server.address().port}/#overview`);
    await page.locator('.activity-months').waitFor();
    for (const [width, height] of [[1440,900],[1366,768],[1280,720],[1024,768],[390,844]]) {
      await page.setViewportSize({width,height}); await page.waitForTimeout(650);
      const layout = await page.evaluate(() => ({width: innerWidth, height: innerHeight, scrollHeight: document.documentElement.scrollHeight, scrollWidth: document.documentElement.scrollWidth, panels:[...document.querySelectorAll('.main-grid>.panel,.activity-panel')].map(e => {const r=e.getBoundingClientRect();return {bottom:r.bottom,height:r.height,scroll:e.scrollHeight,client:e.clientHeight};})}));
      console.log('overview', JSON.stringify(layout));
      await page.screenshot({path:path.join(output,`overview-${width}.png`)});
      assert.ok(layout.scrollHeight <= height + 1, `Overview scroll at ${width}x${height}`);
      assert.ok(layout.scrollWidth <= width, `Overview horizontal overflow at ${width}`);
    }
    await page.setViewportSize({width:1440,height:900});
    const initialPB = await page.locator('.metric-value').allTextContents();
    await page.locator('[data-control="range"]').selectOption('50');
    const rangedPB = await page.locator('.metric-value').allTextContents();
    assert.deepEqual(rangedPB.slice(0,2),initialPB.slice(0,2)); assert.equal(rangedPB[3],'50');
    await page.locator('[data-action="practice"]').click();
    assert.doesNotMatch(await page.locator('[data-stat="ao5"]').innerText(), /Latest 5 solves/);
    assert.match(await page.locator('[data-stat="ao5"]').innerText(), /PB ·/);
    assert.match(await page.locator('[data-stat="ao12"]').innerText(), /PB ·/);
    await page.locator('[data-stat="ao12"]').click();
    assert.equal(await page.locator('.average-solve').count(),12);
    assert.equal(await page.locator('.average-solve.excluded').count(),2);
    assert.equal(await page.locator('.average-solve.selected .average-index').textContent(),'01');
    await page.locator('.average-solve').nth(5).click();
    assert.equal(await page.locator('.average-solve.selected .average-index').textContent(),'06');
    await page.locator('#dialog [data-penalty="+2"]').click();
    assert.equal(await page.locator('.average-solve.selected .average-index').textContent(),'06');
    await page.locator('#drawer-cube .cube-stage').click();
    assert.equal(await page.locator('#drawer-cube .cube-net').count(),1);
    await page.screenshot({path:path.join(output,'average-dialog.png')});
    assert.ok(await page.locator('.average-selected .detail-grid').evaluate(e => { const cube=e.querySelector('.detail-cube').getBoundingClientRect(), side=e.querySelector('.detail-side').getBoundingClientRect(); return cube.right <= side.left; }));
    await page.locator('.average-solve').last().scrollIntoViewIfNeeded();
    assert.ok(await page.locator('.average-solve').last().isVisible());
    await page.locator('[data-action="close-dialog"]').first().click(); await page.waitForTimeout(230);
    await page.locator('[data-stat="ao5"]').click();
    assert.equal(await page.locator('.average-solve').count(),5);
    await page.waitForTimeout(350);
    await page.screenshot({path:path.join(output,'average-ao5.png')});
    await page.locator('[data-action="close-dialog"]').first().click(); await page.waitForTimeout(230);
    await page.locator('[data-stat="mean"]').click(); await page.locator('[data-control="timer-mean"]').selectOption('100');
    await page.locator('[data-action="close-dialog"]').first().click(); await page.waitForTimeout(230);
    assert.match(await page.locator('[data-stat="mean"]').innerText(),/Last 100/);
    await page.locator('[data-stat="best"]').click(); assert.equal(await page.locator('#dialog .detail-grid').count(),1);
    await page.locator('[data-action="close-dialog"]').first().click(); await page.waitForTimeout(230);
    await page.screenshot({path:path.join(output,'timer.png')});
    await page.locator('.solve-entry-del').first().evaluate(e => e.click()); await page.locator('[data-action="confirm-delete-solve"]').click(); await page.waitForTimeout(50);
    assert.ok(await page.locator('.toast').last().evaluate(e => { const toast=e.getBoundingClientRect(), panel=document.querySelector('.solve-panel').getBoundingClientRect(); return toast.right <= panel.left; }));
    await page.locator('.toast button').last().click();
    await page.locator('[data-view="solves"]').first().evaluate(e => e.click());
    await page.locator('.lib-row').first().waitFor();
    assert.equal(await page.locator('.lib-row').count(),80);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForFunction(() => document.querySelectorAll('.lib-row').length > 80);
    assert.ok(await page.locator('.lib-row').count() > 80);
    await page.locator('[data-view="timer"]').first().evaluate(e => e.click()); await page.waitForTimeout(100);
    await page.setViewportSize({width:390,height:844}); await page.waitForTimeout(650);
    await page.screenshot({path:path.join(output,'timer-mobile.png')});
    assert.ok(await page.locator('#timer-surface').evaluate(e => {const r=e.getBoundingClientRect(), p=document.querySelector('.solve-panel').getBoundingClientRect();return r.bottom < p.top;}));
    await page.locator('[data-stat="ao5"]').evaluate(e => e.click());
    assert.ok(await page.locator('.average-layout').evaluate(e => { const list=e.querySelector('.average-summary').getBoundingClientRect(), detail=e.querySelector('.average-selected').getBoundingClientRect(), dialog=document.querySelector('#dialog').getBoundingClientRect(); return list.bottom <= detail.top + 1 && dialog.left >= 0 && dialog.right <= innerWidth; }));
    await page.waitForTimeout(350);
    assert.ok(await page.locator('.average-selected').evaluate(e => e.scrollWidth <= e.clientWidth + 1));
    await page.screenshot({path:path.join(output,'average-ao5-mobile.png')});
    await page.locator('[data-action="close-dialog"]').first().click(); await page.waitForTimeout(230);
    await page.setViewportSize({width:1440,height:900}); await page.waitForTimeout(300);
    await page.locator('.solve-entry-del').first().evaluate(e => e.click()); await page.locator('[data-action="confirm-delete-solve"]').click();
    assert.equal(await page.locator('.toast').count(),1);
    await page.clock.install();
    await page.locator('#timer-surface').click(); await page.clock.runFor(1300);
    assert.equal(await page.locator('.toast').count(),0);
    await page.locator('#timer-surface').click(); await page.clock.runFor(800);
    assert.match(await page.locator('.timer-achievement').innerText(), /Single PB/);
    await page.screenshot({path:path.join(output,'confetti.png')});
    await page.locator('#timer-surface').click();
    assert.ok(!(await page.locator('.timer-achievement').getAttribute('class')).includes('visible'));
    await page.keyboard.press('Escape');
    // Open settings through its actual button without moving the pointer into the sidebar.
    await page.locator('[data-action="settings"]').evaluate(e => e.click());
    await page.locator('[data-control="inspection"]').check();
    await page.locator('[data-control="inspection-voice"]').check();
    await page.locator('[data-action="close-dialog"]').first().click(); await page.clock.runFor(230);
    await page.locator('#timer-surface').click();
    await page.clock.runFor(8150); assert.match((await page.evaluate(() => window.__playedCues.at(-1))), /inspection-eight-\d{2}\.mp3$/); await page.screenshot({path:path.join(output,'inspection-8.png')});
    await page.clock.runFor(4000); assert.match((await page.evaluate(() => window.__playedCues.at(-1))), /inspection-twelve-\d{2}\.mp3$/); await page.screenshot({path:path.join(output,'inspection-12.png')});
    await page.clock.runFor(2900); assert.equal(await page.locator('#timer-digits').textContent(),'+2');
    await page.clock.runFor(2000); assert.equal(await page.locator('#timer-digits').textContent(),'DNF');
    await page.clock.runFor(1300);
    await page.evaluate(() => { document.documentElement.dataset.theme='dark'; window.preview = new CTEffects.Motion(); window.preview.start('barrier'); window.preview.announce('A new level',['Global mean · below 12.5s']); });
    await page.clock.runFor(1100); await page.screenshot({path:path.join(output,'barrier-dark.png')});
    await page.evaluate(() => window.preview.start('worst')); await page.clock.runFor(420); await page.screenshot({path:path.join(output,'worst-dark.png')});
    await page.evaluate(() => window.preview.clear());
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.evaluate(() => { window.preview.start('record'); window.preview.announce('A new personal best',['Single PB · 9.20s']); });
    assert.equal(await page.locator('canvas.timer-effects').last().isVisible(),false);
    assert.match(await page.locator('.timer-achievement').last().innerText(),/9.20s/);
    await page.evaluate(() => window.preview.clear());
    assert.deepEqual(errors,[]); console.log('PASS: responsive overview, PB subtitles, average layouts, unobstructed toasts, infinite solve list, mean range, best dialog, record interruption, inspection boundaries; no browser errors.');
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); server.close(); process.exitCode=1; });
