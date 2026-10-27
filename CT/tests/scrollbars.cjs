/* Scrollbars in a real browser: every visible scrollbar uses the shared look from assets/scrollbars.css, and the ones
   that are hidden on purpose stay hidden. Nothing may set the standard scrollbar-width/color on an element, because
   Chromium then ignores the ::-webkit-scrollbar rules. */
const assert = require('node:assert/strict');
const { open, makeSolves } = require('./browser-helper.cjs');

const probe = () => {
  const bar = (el, pseudo = '::-webkit-scrollbar') => getComputedStyle(el, pseudo);
  const html = document.documentElement;
  const standard = [...document.querySelectorAll('*')].filter((el) => { const s = getComputedStyle(el); return s.scrollbarWidth === 'thin' || s.scrollbarColor !== 'auto'; }).map((el) => el.tagName + '.' + el.className);
  const thumb = bar(html, '::-webkit-scrollbar-thumb');
  return { width: bar(html).width, radius: thumb.borderTopLeftRadius, thumbBg: thumb.backgroundColor, track: bar(html, '::-webkit-scrollbar-track').backgroundColor, standard };
};

(async () => {
  let app = await open({ categories: [{ id: 'a', name: '3x3', solves: makeSolves(300) }], hash: 'solves', theme: 'light' });
  const { page } = app;
  try {
    await page.locator('.lib-row').first().waitFor();
    for (const theme of ['light', 'dark']) {
      await page.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme);
      const r = await page.evaluate(probe);
      assert.equal(r.width, '12px', `${theme}: the page scrollbar uses the shared size`);
      assert.notEqual(r.radius, '0px', `${theme}: the thumb is rounded`);
      assert.notEqual(r.thumbBg, 'rgba(0, 0, 0, 0)', `${theme}: the thumb is visible`);
      assert.equal(r.track, 'rgba(0, 0, 0, 0)', `${theme}: no track`);
      assert.deepEqual(r.standard, [], `${theme}: no element sets the standard scrollbar-width/color: ${r.standard}`);
    }
    // the page scrolls on this screen, so the bar really takes space and is not the native one
    assert.ok(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight), 'the Solve library page scrolls');

    // scrollbars that are hidden on purpose stay hidden
    await page.evaluate(() => { location.hash = 'timer'; });
    await page.reload(); await page.waitForTimeout(2500);
    const hidden = await page.evaluate(() => ['#solve-list', 'dialog'].map((sel) => { const el = document.querySelector(sel); const s = getComputedStyle(el); return { sel, none: s.scrollbarWidth === 'none' || getComputedStyle(el, '::-webkit-scrollbar').width === '0px' }; }));
    for (const h of hidden) assert.ok(h.none, `${h.sel} keeps its scrollbar hidden`);
    assert.deepEqual(app.errors, [], 'no page errors');
    console.log('scrollbars ok');
  } finally { await app.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
