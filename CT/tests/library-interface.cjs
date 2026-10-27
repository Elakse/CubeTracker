/* Solve library in a real browser: stable toolbar, Sub T, date picker, one-line notes, grouping, quick actions. */
const assert = require('node:assert/strict');
const path = require('node:path');
const { open, makeSolves } = require('./browser-helper.cjs');
const output = path.join(__dirname, 'screenshots');
const LONG = 'Great F2L, but I paused way too long on the last pair and the whole solve fell apart after that, then I kept thinking about it for the rest of the session';

(async () => {
  const solves = makeSolves(1000, { penalty: (i) => (i % 25 === 0 ? 'DNF' : i % 11 === 0 ? '+2' : ''), note: (i) => (i % 9 === 0 ? (i % 18 === 0 ? LONG : 'warm-up') : '') });
  const app = await open({ categories: [{ id: 'a', name: '3x3', solves }, { id: 'b', name: 'OH', solves: makeSolves(30, { time: () => 20000 }) }], hash: 'solves' });
  const { page } = app;
  const ref = (name) => page.locator(`[data-ref="${name}"]`);
  const count = async () => (await ref('count').innerText()).replace(/\s+/g, ' ');
  try {
    await page.locator('.lib-row').first().waitFor();

    // 1. the toolbar never moves when the filter changes
    const box = async () => JSON.stringify(await ref('searchBox').boundingBox());
    const home = await box();
    for (const v of ['sub', 'plus', 'dnf', 'all']) { await page.locator(`[data-ref="filters"] [data-v="${v}"]`).click(); await page.waitForTimeout(450); assert.equal(await box(), home, `search box stays put on ${v}`); }
    // a DNF strikes the time itself, not the word
    await page.locator('[data-ref="filters"] [data-v="dnf"]').click(); await page.waitForTimeout(450);
    const dnfRow = await page.locator('.lib-row.dnf .time').first().evaluate((el) => ({ struck: getComputedStyle(el.querySelector('s')).textDecorationLine, tag: getComputedStyle(el.querySelector('.tag')).textDecorationLine, num: /^\d/.test(el.querySelector('s').textContent) }));
    assert.deepEqual(dnfRow, { struck: 'line-through', tag: 'none', num: true }, 'DNF strikes the time, not the label');
    await page.locator('[data-ref="filters"] [data-v="all"]').click(); await page.waitForTimeout(450);

    // 2. Sub T: any number of seconds, by typing or by the steppers; strictly under T
    await page.locator('[data-ref="filters"] [data-v="sub"]').click();
    await page.fill('[data-ref="subT"]', '9'); await page.waitForTimeout(500);
    const subCount = Number((await count()).match(/^([\d,]+) of/)[1].replace(',', ''));
    const expected = solves.filter((s) => { const v = s.penalty === 'DNF' ? Infinity : s.rawMs / 1000 + (s.penalty === '+2' ? 2 : 0); return v < 9; }).length;
    assert.equal(subCount, expected, 'Sub 9 matches the solves under 9.00 s');
    await page.locator('[data-ref="filters"] [data-step="1"]').click(); await page.waitForTimeout(400);
    assert.equal(await page.inputValue('[data-ref="subT"]'), '9.5');
    assert.equal(await box(), home, 'the toolbar did not move');
    await page.reload(); await page.locator('.lib-row').first().waitFor();
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('cubetracker.preferences.v2')).libraryT), 9.5, 'the last T is remembered');
    assert.equal(await page.inputValue('[data-ref="subT"]'), '9.5', 'and is back in the box after a reload');

    // 3. rows are all one height, long notes end in an ellipsis
    const heights = await page.evaluate(() => [...new Set([...document.querySelectorAll('.lib-row')].map((r) => Math.round(r.getBoundingClientRect().height)))]);
    assert.equal(heights.length, 1, 'every row has the same height');
    await page.fill('[data-ref="q"]', 'fell apart'); await page.waitForTimeout(500);
    assert.ok(await page.evaluate(() => { const em = document.querySelector('.lib-row .n em'); return em.scrollWidth > em.clientWidth && getComputedStyle(em).textOverflow === 'ellipsis' && getComputedStyle(em).whiteSpace === 'nowrap'; }), 'a long note is cut with an ellipsis');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.ref), 'q', 'typing keeps the focus in the search box');
    await ref('reset').click(); await page.waitForTimeout(400);

    // 4. date picker: fits its popover, range by two clicks
    await ref('dateBtn').click(); await page.waitForTimeout(350);
    assert.equal(await page.evaluate(() => { const pop = document.querySelector('[data-ref="datePop"]').getBoundingClientRect(); return [...document.querySelectorAll('[data-ref="datePop"] *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && (r.right > pop.right + .5 || r.left < pop.left - .5 || r.bottom > pop.bottom + .5); }).length; }), 0, 'nothing overflows the date popover');
    await page.screenshot({ path: path.join(output, 'library-date.png'), clip: { x: 0, y: 0, width: 1440, height: 620 } }).catch(() => {});
    const days = page.locator('.lib-day-c:not(.dis):not(.out)');
    await days.nth(3).click(); await days.nth(9).click(); await page.waitForTimeout(700);
    assert.match(await ref('dateLabel').innerText(), /–/);
    assert.match(await count(), / of 1,000 solves$/);
    await ref('reset').click(); await page.waitForTimeout(400);

    // 5. grouping switch
    assert.ok(await page.locator('.lib-day').count() > 0, 'grouped by day to begin with');
    await ref('group').evaluate((e) => e.click()); await page.waitForTimeout(500);
    assert.equal(await page.locator('.lib-day').count(), 0, 'no day headings when grouping is off');
    assert.match(await page.locator('.lib-row .when').first().innerText(), /·/, 'each row then carries its own date');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('cubetracker.preferences.v2')).libraryGroup), false, 'the choice is remembered');
    await ref('group').evaluate((e) => e.click()); await page.waitForTimeout(500);
    assert.ok(await page.locator('.lib-day').count() > 0);
    assert.match(await page.locator('.lib-day span').first().innerText(), /^\d+ solves?$/, 'the heading shows only the number of solves');

    // 6. sort by time, quick penalty, open the solve
    await page.locator('[data-ref="cols"] [data-sort="time"]').click(); await page.waitForTimeout(500);
    assert.equal(await page.locator('.lib-day').count(), 0, 'no day headings while sorted by time');
    assert.ok(await ref('groupSwitch').evaluate((e) => e.classList.contains('off')));
    await page.locator('[data-ref="cols"] [data-sort="date"]').click(); await page.waitForTimeout(500);
    const first = page.locator('.lib-row').first();
    await first.hover(); await first.locator('[data-pen="+2"]').click(); await page.waitForTimeout(500);
    assert.ok((await page.locator('.lib-row').first().locator('[data-pen="+2"]').getAttribute('class')).includes('on'));
    assert.ok(app.library().categories[0].solves.some((s) => s.id === 't-999' && s.penalty === '+2'), 'the penalty was saved');
    await page.locator('.lib-row').first().click(); await page.waitForTimeout(700);
    assert.equal(await page.evaluate(() => document.querySelector('#dialog').open), true, 'a row opens the solve dialog');
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);

    // 7. more rows load while scrolling; the toolbar stays on screen
    const before = await page.locator('.lib-row').count();
    for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 2500); await page.waitForTimeout(250); }
    assert.ok(await page.locator('.lib-row').count() > before, 'scrolling loads more');
    assert.ok(await page.evaluate(() => document.querySelector('.lib-sticky').getBoundingClientRect().top < 2), 'the toolbar stays pinned');

    // 8. switching category starts from a clean slate
    await page.evaluate(() => scrollTo(0, 0));
    await page.fill('[data-ref="q"]', 'warm'); await page.waitForTimeout(400);
    await page.evaluate(() => { const s = document.querySelector('select[data-control="category"]'); s.value = 'b'; s.dispatchEvent(new Event('change', { bubbles: true })); });
    await page.waitForTimeout(800);
    assert.equal(await page.inputValue('[data-ref="q"]'), '');
    assert.equal(await count(), '30 solves');

    // 9. a phone: no sideways scroll, toolbar inside the screen
    await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(500);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal scroll on a phone');
    assert.ok(await page.evaluate(() => document.querySelector('.lib-seg').getBoundingClientRect().right <= innerWidth - 8));

    assert.deepEqual(app.errors, []);
    console.log('PASS: stable toolbar, Sub T (typed and stepped, remembered), one-line notes, date picker, grouping switch, sorting, quick actions, infinite scroll, category reset, phone layout.');
  } finally { await app.close(); }
})().catch((e) => { console.error(e); process.exitCode = 1; });
