/* Reward cards in the real timer: where they sit, that quiet ones stay, and every way to close one. */
const assert = require('node:assert/strict');
const path = require('node:path');
const { open, makeSolves } = require('./browser-helper.cjs');
const output = path.join(__dirname, 'screenshots');

// A ~11.5 s average history, so 1.5 s is an accident (quiet card) and 5 s is a record (big, dims the background).
const history = () => [{ id: 'c', name: 'Test', solves: makeSolves(300, { time: (i) => 11000 + (i % 7) * 300 }) }];

async function solveFor(page, ms) {
  await page.keyboard.down('Space'); await page.clock.runFor(700); await page.keyboard.up('Space');
  await page.clock.runFor(ms); await page.keyboard.press('Space');
  for (let i = 0; i < 10; i++) { await page.clock.fastForward(500); await page.clock.runFor(100); }
}
const geometry = (page) => page.evaluate(() => {
  const card = document.querySelector('.timer-achievement').getBoundingClientRect();
  const result = document.querySelector('#timer-result').getBoundingClientRect();
  const panel = document.querySelector('.solve-panel').getBoundingClientRect();
  return { cardTop: card.top, cardBottom: card.bottom, cardLeft: card.left, cardRight: card.right, resultBottom: result.bottom, panelTop: panel.top, panelLeft: panel.left, vh: innerHeight, vw: innerWidth };
});

(async () => {
  // --- a roomy window ---
  let app = await open({ categories: history(), clock: true });
  let page = app.page;
  try {
    await solveFor(page, 1500);   // accident: a quiet card
    assert.equal(await page.locator('.timer-achievement.visible').count(), 1, 'the quiet card appears');
    let g = await geometry(page);
    assert.ok(g.cardTop >= g.resultBottom + 8, 'the card is under the OK / +2 / DNF row, not over it');
    assert.ok(g.cardBottom <= g.vh, 'and fully on screen');
    assert.equal(await page.locator('.timer-achievement-shade.visible').count(), 0, 'a quiet card does not dim anything');
    await page.clock.fastForward(60000); await page.clock.runFor(200);
    assert.equal(await page.locator('.timer-achievement.visible').count(), 1, 'a quiet card stays for as long as you like');
    await page.screenshot({ path: path.join(output, 'reward-quiet-under-buttons.png') });
    await page.keyboard.press('Escape'); await page.clock.runFor(800);
    assert.equal(await page.locator('.timer-achievement.visible').count(), 0, 'Esc closes it');

    await solveFor(page, 1500);
    assert.equal(await page.locator('.timer-achievement.visible').count(), 1);
    await page.locator('.timer-achievement.visible').click(); await page.clock.runFor(800);
    assert.equal(await page.locator('.timer-achievement.visible').count(), 0, 'a click closes it');

    await solveFor(page, 1500);
    assert.equal(await page.locator('.timer-achievement.visible').count(), 1);
    await page.keyboard.down('Space'); await page.clock.runFor(700); await page.keyboard.up('Space'); await page.clock.runFor(300);
    assert.equal(await page.locator('.timer-achievement.visible').count(), 0, 'starting the next solve closes it');
    await page.keyboard.press('Space'); await page.clock.runFor(2500);   // stop the solve that just started (an accident again)
    await page.clock.fastForward(1000);

    // a record: big card, background dims, time and buttons stay above the dimming
    await page.keyboard.press('Escape'); await page.clock.runFor(800);
    await solveFor(page, 5000);
    assert.equal(await page.locator('.timer-achievement.modal.visible').count(), 1, 'a record is a big card');
    assert.equal(await page.locator('.timer-achievement-shade.visible').count(), 1, 'it dims the background');
    assert.ok(await page.evaluate(() => {
      const z = (sel) => Number(getComputedStyle(document.querySelector(sel)).zIndex);
      return z('#timer-digits') > z('.timer-achievement-shade') && z('#timer-result') > z('.timer-achievement-shade');
    }), 'the time and the buttons sit above the dimming');
    g = await geometry(page);
    assert.ok(g.cardTop >= g.resultBottom + 8 && g.cardBottom <= g.vh, 'the big card is also under the buttons and on screen');
    await page.screenshot({ path: path.join(output, 'reward-big-under-buttons.png') });
    await page.locator('[data-penalty="DNF"]').click(); await page.clock.runFor(800);
    assert.equal(await page.locator('.timer-achievement.visible').count(), 0, 'changing the solve closes its card');
    assert.equal(await page.locator('.timer-achievement-shade.visible').count(), 0);
    assert.deepEqual(app.errors, []);
  } finally { await app.close(); }

  // --- a short window: the timer slides up just enough ---
  app = await open({ categories: history(), clock: true, width: 1280, height: 560 });
  page = app.page;
  try {
    await solveFor(page, 30000);   // slowest solve: a quiet card
    const g = await geometry(page);
    assert.ok(g.cardTop >= g.resultBottom + 8, 'still under the buttons when the window is short');
    assert.ok(g.cardBottom <= g.vh, 'and still on screen');
    assert.ok(await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.focus-row')).top) < 0), 'the timer moved up to make room');
    await page.keyboard.press('Escape'); await page.clock.runFor(900); await page.waitForTimeout(800);   // the slide back is a CSS transition: real time
    assert.equal(await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.focus-row')).top)), 0, 'and came back');
    assert.deepEqual(app.errors, []);
  } finally { await app.close(); }

  // --- a phone: the card stays right of the navigation and above the solve list ---
  app = await open({ categories: history(), clock: true, width: 390, height: 844 });
  page = app.page;
  try {
    await solveFor(page, 1500);
    const g = await geometry(page);
    assert.ok(g.cardLeft >= 58, 'right of the navigation');
    assert.ok(g.cardBottom <= g.panelTop + 1, 'above the solve list');
    assert.ok(g.cardRight <= g.vw);
    assert.deepEqual(app.errors, []);
  } finally { await app.close(); }
  console.log('PASS: cards sit under the buttons, quiet cards stay until closed, big cards dim only the background, short and narrow windows.');
})().catch((e) => { console.error(e); process.exitCode = 1; });
