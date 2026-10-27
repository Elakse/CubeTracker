/* Real browser checks against a disposable, in-memory library. */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.CT_PLAYWRIGHT || 'C:/Users/alejo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const C = require('../assets/core.js');
const root = path.resolve(__dirname, '..');
const output = path.join(__dirname, 'screenshots');
let writes = 0;
let library = { version: 1, revision: 0, categories: [{ id: 'rewards-test', name: 'Rewards test', solves: Array.from({length:1000}, (_, i) => ({id:`reward-${i}`,rawMs:i < 500 ? 9900 : 11000,penalty:'',scramble:"R U R' U' F2 D L2 B",date:new Date(Date.UTC(2026,0,1,0,i)).toISOString(),note:''})) }] };
const server = http.createServer(async (req,res) => {
  if (req.url === '/api/library') {
    if (req.method === 'PUT') { let body=''; for await (const chunk of req) body += chunk; library={version:1,...JSON.parse(body),revision:library.revision+1}; writes++; }
    res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(library)); return;
  }
  const file=path.join(root,req.url.split('?')[0] === '/' ? 'CTU.html' : req.url.split('?')[0]);
  if (!file.startsWith(root+path.sep) || !fs.existsSync(file)) {res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.woff2':'font/woff2','.mp3':'audio/mpeg'})[path.extname(file)] || 'text/plain');
  res.end(fs.readFileSync(file));
});
(async () => {
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1440,height:900}}), errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{ window.Worker=undefined; localStorage.setItem('cubetracker.preferences.v2',JSON.stringify({version:2,theme:'dark',accent:'violet'})); });
    await page.goto(`http://127.0.0.1:${server.address().port}/#overview`);
    await page.locator('.rank-card').waitFor();
    assert.match(await page.locator('.rank-title').innerText(),/Rusty sub 10s/);
    assert.equal(await page.locator('.rank-card .metric-value').innerText(),'9.90s');
    await page.locator('[data-control="range"]').selectOption('50');
    assert.equal(await page.locator('.rank-card .metric-value').innerText(),'9.90s');
    await page.screenshot({path:path.join(output,'rank-rust-overview.png')});
    // Import scans every historical window and reconstructs the same title on reload.
    await page.locator('#file-input').setInputFiles({name:'historical-rewards.csv',mimeType:'text/csv',buffer:Buffer.from(C.exportCSV(library.categories[0].solves))});
    await page.locator('#import-form button[type="submit"]').click();
    await page.waitForFunction(()=>!document.querySelector('#dialog').open);
    await page.reload();
    await page.locator('.rank-card').waitFor();
    assert.match(await page.locator('.rank-title').innerText(),/Rusty sub 10s/);
    assert.equal(library.categories.length,2);
    const before=JSON.stringify(library), beforeWrites=writes;
    await page.locator('[data-action="help"]').evaluate(e=>e.click());
    await page.locator('[data-action="effects-demo"]').click();
    await page.locator('.effects-demo').waitFor();
    assert.equal(await page.locator('#timer-surface').count(),0);
    await page.clock.install();
    const centered = e => e.evaluate(el => { const r = el.getBoundingClientRect(); return Math.abs((r.left + r.right) / 2 - innerWidth / 2) < innerWidth * .35 && r.top >= 0 && r.bottom <= innerHeight; });
    const effects = require('../assets/timer-effects.js');
    require('../assets/rank-cards.js'); const frameOf = level => globalThis.CTRank.frame(level);   // the card design each level wears
    const expectCard = { 'single': 'modal', 'average': 'modal', 'stack': 'modal', 'barrier-down': 'visible', 'barrier-up': 'visible', 'worst': 'visible', 'accident': 'visible', 'recovery': 'rank-card' };
    for (const [id] of effects.demoGroups().flatMap(g => g.options)) {
      await page.locator('#demo-effect').selectOption(id);
      const card = page.locator('.timer-achievement.visible');
      for (let t = 0; t < (id === 'ordinary' ? 3 : 14) && !(await card.count()); t++) { await page.clock.fastForward(1000); await page.clock.runFor(100); }
      if (id === 'ordinary') { assert.equal(await card.count(), 0, id); continue; }
      await page.clock.runFor(400);
      assert.equal(await card.count(), 1, id);
      assert.ok(await centered(card), `${id} stays on screen`);
      if (expectCard[id]) assert.ok((await card.getAttribute('class')).includes(expectCard[id]), id);
      if (id.startsWith('sub-')) {
        const level = effects.tier(Number(id.slice(4)));
        assert.ok((await card.getAttribute('class')).includes('rank-card'), id);
        assert.equal(await card.getAttribute('data-tier'), String(frameOf(level)), id);
        assert.equal(await page.locator('.timer-achievement-shade.visible').count(), 1, id);
        await page.locator('.timer-achievement-shade.visible').click({ position: { x: 10, y: 10 } }); await page.clock.runFor(600);
        assert.equal(await page.locator('.timer-achievement.visible').count(), 0, id);
      }
      if (id.startsWith('rust-')) assert.ok((await card.getAttribute('class')).includes('is-rusty'), id);
      // the preview card in the side panel is the same card the overview shows
      assert.equal(await page.locator('#demo-rank .rank-card').count(), 1, id);
      if (['single', 'sub-10', 'sub-12', 'sub-5', 'rust-10'].includes(id)) await page.screenshot({ path: path.join(output, `reward-${id}.png`) });
    }
    assert.equal(await page.locator('#demo-rank .rank-card').evaluate(e => e.getBoundingClientRect().right <= innerWidth), true, 'side preview fits its panel');
    await page.locator('#demo-effect').selectOption('inspection'); await page.clock.runFor(3100);
    assert.match(await page.locator('.inspection-alert.visible').innerText(),/SECONDS/);
    await page.clock.runFor(2000); assert.equal(await page.locator('#timer-digits').innerText(),'+2');
    await page.clock.runFor(2000); assert.equal(await page.locator('#timer-digits').innerText(),'DNF');
    await page.locator('#demo-effect').selectOption('entrance');
    assert.ok(await page.locator('.scramble-reveal').count() > 1);
    assert.equal(await page.locator('.cube-materialize').count(),1);
    await page.clock.runFor(1100);
    // All accent families reach previously fixed status, cube and reward colors.
    const colors=[];
    for (const accent of ['forest','ocean','violet','ember']) {
      colors.push(await page.evaluate(accent=>{document.documentElement.dataset.accent=accent;const s=getComputedStyle(document.documentElement);return s.getPropertyValue('--ok').trim();},accent));
    }
    assert.equal(new Set(colors).size,4);
    await page.evaluate(()=>document.documentElement.dataset.accent='violet');
    await page.setViewportSize({width:390,height:844}); await page.clock.runFor(1000);
    await page.locator('#demo-effect').selectOption('sub-5'); for (let t = 0; t < 14 && !(await page.locator('.timer-achievement.visible').count()); t++) { await page.clock.fastForward(1000); await page.clock.runFor(100); }
    await page.screenshot({path:path.join(output,'reward-mobile.png')});
    assert.ok(await page.locator('.timer-achievement').evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=0 && r.right<=innerWidth && r.top>=0 && r.bottom<=innerHeight;}));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.locator('#demo-effect').selectOption('rust-5'); await page.clock.runFor(900);
    assert.equal(await page.locator('html[data-reward-motion="off"]').count(),1);
    assert.equal(await page.locator('canvas.timer-effects').isVisible(),false);
    assert.match(await page.locator('.timer-achievement.visible').innerText(),/Rusty sub 5s/);
    assert.equal(await page.locator('#demo-rank canvas').count(),0);
    await page.locator('#demo-effect').selectOption('inspection'); await page.clock.runFor(3100);
    assert.equal(await page.locator('canvas.timer-effects').isVisible(),false);
    assert.match(await page.locator('.inspection-alert.visible').innerText(),/SECONDS/);
    await page.locator('[data-action="exit-effects"]').click(); await page.clock.runFor(300);
    assert.equal(await page.locator('.inspection-alert.visible').count(),0);
    assert.equal(await page.locator('#timer-surface').count(),1);
    assert.equal(JSON.stringify(library),before); assert.equal(writes,beforeWrites);
    assert.deepEqual(errors,[]);
    console.log('PASS: imported rolling titles, range independence, all reward tiers, rust, inspection, entrance, accents, responsive and reduced motion; studio makes no writes.');
  } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
