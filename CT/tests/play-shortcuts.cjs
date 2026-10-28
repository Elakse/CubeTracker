/* Cube playground shortcuts and start position, plus "Hide time while solving".
   1 scrambles, 2 resets, and both keys are locked in the key map. The cube always starts held with the
   chosen cross colour down, and the running time turns into dots when the setting is on. */
const assert = require('node:assert/strict');
const { open, makeSolves } = require('./browser-helper.cjs');
const C = require('../assets/core.js');
(async () => {
  const physical = { id: 'physical', name: 'Physical', solves: makeSolves(10) };
  const app = await open({ hash: 'play', categories: [physical], prefs: { cubeCross: 'U' } }), { page } = app;
  const stage = () => page.locator('#cube-play-mount .cube-stage');
  const transforms = () => page.locator('#cube-play-mount .sticker').evaluateAll(es => es.map(e => e.style.transform));
  const separation = 15;
  const check = async (cube, label) => {
    const actual = (await transforms()).map(m => m.slice(9, -1).split(',').map(Number));
    const css = v => [v[0], -v[1], v[2]], step = 46 + separation * .52, plane = 69 + separation * 1.05;
    cube.stickers.forEach((s, i) => {
      const wanted = [...css(s.right), 0, ...css(s.down), 0, ...css(s.n), 0, ...css(s.p.map((v, j) => v * step + s.n[j] * (plane - step))), 1];
      wanted.forEach((v, j) => assert.ok(Math.abs(v - actual[i][j]) < .001, `${label}: sticker ${i}, coordinate ${j}`));
    });
  };
  const text = sel => page.locator(sel).textContent();
  try {
    await page.locator('[data-view="timer"]').first().waitFor();
    await page.evaluate(() => document.querySelector('[data-category]:not([data-category="physical"])')?.click());
    await stage().waitFor(); await stage().focus();
    // 2 resets: solved, but held with white (the U cross) down.
    await page.keyboard.press('2'); await check(new C.Cube().apply('x2'), 'reset');
    // 1 scrambles: scramble first, then the whole-cube turn.
    await page.keyboard.press('1');
    const scramble = (await text('[data-play-scramble]')).trim();
    assert.ok(scramble.length > 10, 'a scramble is shown');
    await check(new C.Cube().apply(scramble).apply('x2'), 'scramble');
    assert.equal(await text('[data-play-status]'), 'Inspection · First turn starts');
    // Locked keys in the key map.
    await page.locator('[data-play="settings"]').click(); await page.locator('.play-settings').waitFor();
    assert.equal(await page.locator('.play-key:disabled').count(), 2);
    assert.equal(await page.locator('[data-game-key="Digit1"],[data-game-key="Digit2"]').count(), 0, 'reserved keys cannot be assigned');
    assert.equal(await page.locator('.play-key:disabled b').allTextContents().then(t => t.join()), 'Scr,Rst');
    await page.locator('#dialog [data-action="close-dialog"]').last().click();
    await page.waitForFunction(() => { const d = document.querySelector('#dialog'); return !d.open && !d.classList.contains('closing'); });
    // Hide time while solving (default ON), virtual category. The cross-held cube needs its x2 first.
    await page.evaluate(() => { const previous = CT.scramble; try { CT.scramble = () => 'R U'; document.querySelector('[data-play="scramble"]').click(); } finally { CT.scramble = previous; } });
    await stage().focus();
    await page.clock.install(); await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
    for (let i = 0; i < 2; i++) { await page.keyboard.down('ShiftRight'); await page.keyboard.up('ShiftRight'); }
    await page.keyboard.press('Semicolon'); await page.clock.runFor(700);
    assert.equal(await text('[data-play-status]'), 'Solving');
    assert.equal(await text('[data-virtual-time]'), '···', 'time is hidden while solving');
    await page.keyboard.press('Comma'); await page.clock.runFor(50);
    assert.equal(await text('[data-play-status]'), 'Saved');
    assert.match(await text('[data-virtual-time]'), /^\d+\.\d\d$/, 'result shows when the solve ends');
    await page.clock.resume();
    for (let i = 0; i < 50 && !app.library().categories.find(c => c.type === 'virtual').solves.length; i++) await page.waitForTimeout(50);
    const solve = app.library().categories.find(c => c.type === 'virtual').solves[0];
    assert.equal(solve.reconstruction.orientation, 'x2', 'the starting hold is stored with the solve');
    assert.deepEqual(solve.reconstruction.moves.map(m => m.move), ['x', 'x', "U'", "R'"]);
    // Physical timer: dots while running, the time on stop.
    await page.evaluate(() => document.querySelector('[data-category="physical"]').click());
    await page.locator('#timer-surface').waitFor();
    await page.keyboard.down('Space'); await page.waitForTimeout(500); await page.keyboard.up('Space');
    await page.waitForTimeout(600);
    assert.equal(await text('#timer-digits'), '···', 'physical timer hides the running time');
    await page.keyboard.press('Space'); await page.waitForTimeout(300);
    assert.match(await text('#timer-digits'), /^\d+\.\d\d$/);
    // Turn the setting off: the Settings dialog lists it, ON by default, and it is saved globally.
    await page.evaluate(() => document.querySelector('[data-action="settings"]').click());
    await page.locator('[data-control="hide-time"]').waitFor();
    assert.equal(await page.locator('[data-control="hide-time"]').evaluate(e => e.checked), true, 'defaults to ON');
    await page.locator('[data-control="hide-time"]').evaluate(e => e.click());
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('cubetracker.preferences.v2')).hideTimeWhileSolving), false);
    console.log('PASS: 1/2 shortcuts, locked keys, cross-down start, Hide time setting');
  } finally { await app.close(); }
})().catch(e => { console.error(e); process.exit(1); });
