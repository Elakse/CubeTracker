/* The Overview rank card opens a dialog with every rank as its normal (never rusty) card, lowest first,
   with the player's current rank marked. Works by mouse and by keyboard, and closes with Esc. */
const assert = require('node:assert/strict');
const { open, makeSolves } = require('./browser-helper.cjs');

(async () => {
  const app = await open({ categories: [{ id: 'a', name: '3x3', solves: makeSolves(600, { time: () => 11500 }) }], hash: 'overview', theme: 'light' });
  const { page } = app;
  try {
    await page.locator('.rank-card.is-link').waitFor();
    await page.locator('.rank-card.is-link').click(); await page.waitForTimeout(800);
    assert.ok(await page.locator('#dialog').evaluate((d) => d.open), 'clicking the card opens the dialog');
    const info = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.ranks-scroll .rank-card')];
      return { n: cards.length, rusty: cards.some((c) => c.classList.contains('is-rusty')), titles: cards.map((c) => c.querySelector('.rank-title').textContent), here: [...document.querySelectorAll('.ranks-scroll .is-here .rank-title')].map((e) => e.textContent) };
    });
    assert.equal(info.n, 12, 'twelve ranks');
    assert.equal(info.rusty, false, 'no rusty cards');
    assert.equal(info.titles[0], 'Sub 1 min', 'lowest rank first');
    assert.equal(info.titles[11], 'Sub 5s', 'highest rank last');
    assert.deepEqual(info.here, ['Sub 12s'], 'the current rank is marked (11.5 s mean is Sub 12)');
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
    assert.ok(!(await page.locator('#dialog').evaluate((d) => d.open)), 'Esc closes it');
    await page.locator('.rank-card.is-link').focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(600);
    assert.ok(await page.locator('#dialog').evaluate((d) => d.open), 'Enter on the focused card opens it too');
    assert.deepEqual(app.errors, [], 'no page errors');
    console.log('ranks dialog ok');
  } finally { await app.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
