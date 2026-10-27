/* Cube dialogs in a real browser: the cube column fills the dialog's height, the average list scrolls without a visible
   scrollbar, the cube sits on the dialog with no background of its own, and the extra captions are gone. */
const assert = require('node:assert/strict');
const { open, makeSolves } = require('./browser-helper.cjs');

const transparent = (c) => c === 'rgba(0, 0, 0, 0)' || c === 'transparent';

(async () => {
  let app = await open({ categories: [{ id: 'a', name: '3x3', solves: makeSolves(120) }], hash: 'solves', theme: 'light' });
  let { page } = app;
  const solves = { categories: [{ id: 'a', name: '3x3', solves: makeSolves(120) }], hash: 'timer', theme: 'light' };
  const reopen = async () => { await app.close(); app = await open(solves); page = app.page; await page.waitForTimeout(1000); };
  const bg = (sel) => page.locator(sel).first().evaluate((el) => { const s = getComputedStyle(el); return { color: s.backgroundColor, image: s.backgroundImage }; });
  const closeDialog = async () => { await page.keyboard.press('Escape'); await page.waitForTimeout(350); };
  try {
    await page.locator('.lib-row').first().waitFor();

    // 1. a plain solve: the cube column runs as tall as the details, and has no background
    await page.locator('.lib-row').nth(2).click(); await page.waitForTimeout(900);
    const solve = await page.evaluate(() => {
      const cube = document.querySelector('.detail-cube').getBoundingClientRect(), side = document.querySelector('.detail-side').getBoundingClientRect(), stage = document.querySelector('#drawer-cube .cube-stage').getBoundingClientRect();
      return { cubeTop: cube.top, cubeBottom: cube.bottom, sideTop: side.top, sideBottom: side.bottom, stageHeight: stage.height, cubeHeight: cube.height };
    });
    assert.ok(Math.abs(solve.cubeTop - solve.sideTop) <= 2 && Math.abs(solve.cubeBottom - solve.sideBottom) <= 2, `cube column matches the details: ${JSON.stringify(solve)}`);
    assert.ok(solve.stageHeight >= solve.cubeHeight - 80, 'the stage uses the column, it is not a small box with space below');
    const d = await bg('.detail-cube');
    assert.ok(transparent(d.color) && d.image === 'none', 'the cube box has no background');
    await closeDialog();

    // 2. the averages: no counted / click-the-cube captions, a list that scrolls with no scrollbar, a cube that fills the pane
    for (const stat of ['ao5', 'ao12']) {
      await reopen(); await page.locator(`[data-stat="${stat}"]`).waitFor({ state: "attached", timeout: 8000 });
      await page.evaluate((s) => document.querySelector(`[data-stat="${s}"]`).click(), stat); await page.waitForTimeout(900);
      const text = await page.locator('#dialog').innerText();
      assert.ok(!/counted|fastest and slowest|click cube|\d+ of \d+/.test(text), `${stat}: the extra captions are gone`);
      const list = await page.locator('.average-solves').evaluate((el) => ({ gutter: el.offsetWidth - el.clientWidth, scrolls: el.scrollHeight > el.clientHeight, ok: getComputedStyle(el).overflowY }));
      assert.equal(list.gutter, 0, `${stat}: no scrollbar takes space`);
      if (stat === 'ao12') {
        assert.ok(list.scrolls, 'ao12 list still scrolls');
        await page.locator('.average-solves').evaluate((el) => { el.scrollTop = 200; });
        assert.ok(await page.locator('.average-solves').evaluate((el) => el.scrollTop > 0), 'it can be scrolled');
      }
      const fit = await page.evaluate(() => {
        const cube = document.querySelector('.average-selected .detail-cube').getBoundingClientRect(), side = document.querySelector('.average-selected .detail-side').getBoundingClientRect();
        return { cubeTop: cube.top, cubeBottom: cube.bottom, sideTop: side.top, sideBottom: side.bottom };
      });
      assert.ok(Math.abs(fit.cubeTop - fit.sideTop) <= 2 && Math.abs(fit.cubeBottom - fit.sideBottom) <= 2, `${stat}: cube column matches the details: ${JSON.stringify(fit)}`);
      const a = await bg('.average-selected .detail-cube');
      assert.ok(transparent(a.color) && a.image === 'none');
      await closeDialog();
    }

    // 3. the appearance dialog: the cube frame is transparent too
    await reopen(); await page.locator('[data-action="settings"]').first().waitFor({ state: "attached", timeout: 8000 });
    await page.evaluate(() => document.querySelector('[data-action="settings"]').click()); await page.waitForTimeout(700);
    await page.evaluate(() => document.querySelector('.link-tile[data-action="appearance"]').click()); await page.waitForTimeout(1500);
    const frame = await bg('.cube-carousel-frame');
    assert.ok(transparent(frame.color) && frame.image === 'none', 'appearance cube has no background');
    await closeDialog();

    assert.deepEqual(app.errors, []);
    console.log('PASS: cube column fills the dialog, no list scrollbar, no captions, transparent cube backgrounds.');
  } finally { await app.close(); }
})().catch((e) => { console.error(e); process.exitCode = 1; });
