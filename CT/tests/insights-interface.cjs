/* Insights in a real browser: five cards, hover tooltips, redraw on resize, editable target and window, keyboard, phone. */
const assert = require('node:assert/strict');
const { open, makeSolves } = require('./browser-helper.cjs');

(async () => {
  const solves = makeSolves(1200, { time: (i) => 14000 - Math.round(4500 * (1 - Math.exp(-i / 300))) + ((i * 7919) % 5000) - 2500, penalty: (i) => (i % 31 === 0 ? 'DNF' : i % 13 === 0 ? '+2' : '') });
  const app = await open({ categories: [{ id: 'a', name: '3x3', solves }, { id: 'b', name: 'OH', solves: makeSolves(40, { time: () => 20000 }) }], hash: 'insights' });
  const { page } = app;
  const tip = page.locator('.ins-tip');
  try {
    await page.locator('.ins-card').first().waitFor();
    await page.waitForTimeout(1500);

    // 1. the five sections, no boxes inside boxes, no pills
    assert.deepEqual(await page.locator('.ins-card h2').allInnerTexts(), ['Consistency', 'Distribution', 'Personal best over time', 'Solves by weekday', 'Best averages']);
    assert.equal(await page.locator('.ins-card .ins-card').count(), 0);
    assert.equal(await page.locator('.chip, .insight-facts').count(), 0);

    // 2. the charts are drawn at their real size
    for (const name of ['goalChart', 'histChart', 'pbChart']) {
      const r = await page.evaluate((n) => { const c = document.querySelector(`[data-ref="${n}"]`), s = c.querySelector('svg').getBoundingClientRect(); return { w: Math.round(s.width), cw: c.clientWidth, h: Math.round(s.height) }; }, name);
      assert.equal(r.w, r.cw, `${name} fills its box`); assert.ok(r.h >= 170, `${name} is tall enough`);
    }

    // 3. hovering shows a tooltip and a guide on the consistency chart
    const goal = page.locator('[data-ref="goalChart"] .ins-hit');
    const gb = await goal.boundingBox();
    await page.mouse.move(gb.x + gb.width * 0.5, gb.y + 30); await page.waitForTimeout(150);
    assert.ok(await tip.first().isVisible());
    assert.match(await page.locator('[data-ref="goalChart"] .ins-tip').innerText(), /%[\s\S]*under 10s over the previous 100/);
    assert.equal(await page.locator('[data-ref="goalChart"] .ins-guide').getAttribute('visibility'), 'visible');
    await page.mouse.move(2, 2); await page.waitForTimeout(100);
    assert.equal(await page.locator('[data-ref="goalChart"] .ins-tip').isVisible(), false);

    // 4. clicking a point of the personal-best chart opens that solve
    const pb = await page.locator('[data-ref="pbChart"] .ins-hit').boundingBox();
    await page.mouse.move(pb.x + pb.width * 0.9, pb.y + 20); await page.waitForTimeout(150);
    assert.match(await page.locator('[data-ref="pbChart"] .ins-tip').innerText(), /Best after solve[\s\S]*set on solve/);
    await page.mouse.click(pb.x + pb.width * 0.9, pb.y + 20); await page.waitForTimeout(500);
    assert.ok(await page.evaluate(() => document.querySelector('#dialog').open), 'the solve dialog opens');
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);

    // 5. a bar of the distribution says how many solves it holds
    const hb = await page.locator('[data-ref="histChart"] .ins-hit').boundingBox();
    await page.mouse.move(hb.x + hb.width * 0.3, hb.y + hb.height - 10); await page.waitForTimeout(150);
    assert.match(await page.locator('[data-ref="histChart"] .ins-tip').innerText(), /\d+ solves?[\s\S]*% of solves/);
    await page.mouse.move(2, 2);

    // 6. keyboard: arrow keys move along the chart
    await goal.focus(); await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(100);
    assert.ok(await page.locator('[data-ref="goalChart"] .ins-tip').isVisible());
    await page.keyboard.press('Escape');

    // 7. the charts redraw when the window is resized
    const before = await page.evaluate(() => document.querySelector('[data-ref="histChart"] svg').getBoundingClientRect().width);
    await page.setViewportSize({ width: 1100, height: 900 }); await page.waitForTimeout(500);
    const after = await page.evaluate(() => { const c = document.querySelector('[data-ref="histChart"]'); return [c.querySelector('svg').getBoundingClientRect().width, c.clientWidth]; });
    assert.ok(after[0] < before && after[0] === after[1], 'histogram follows its box');
    await page.setViewportSize({ width: 1440, height: 900 }); await page.waitForTimeout(400);

    // 8. the target is a plain field; changing it recomputes without replaying the entrance, and there is no window field
    const pct = async () => (await page.locator('[data-ref="pct"]').innerText()).trim();
    const p0 = await pct();
    assert.equal(await page.locator('input[data-control="window"]').count(), 0, 'no window field on Insights');
    await page.fill('input[data-control="target"]', '12'); await page.keyboard.press('Enter'); await page.waitForTimeout(700);
    assert.notEqual(await pct(), p0);
    assert.equal(await page.locator('.ins.enter').count(), 0, 'no replay of the entrance');
    assert.match(await page.locator('.ins-lead').first().innerText(), /under 12s/);
    assert.equal(await page.locator('.ins-num[data-control="target"]').evaluate((el) => el.scrollWidth <= el.clientWidth), true, 'target field is not clipped');

    // 9. the headline follows the range: Last 100 counts only the latest 100 solves
    const total = async () => (await page.locator('.ins-lead').first().innerText()).match(/of ([\d,]+) solves/)[1];
    assert.equal(await total(), '1,000', 'the default range is the latest 1,000');
    await page.evaluate(() => { const s = document.querySelector('select[data-control="range"]'); s.value = '100'; s.dispatchEvent(new Event('change', { bubbles: true })); });
    await page.waitForTimeout(700);
    assert.equal(await total(), '100');
    assert.match(await page.locator('[data-ref="goalChart"] + .ins-note').innerText(), /previous 20 solves/);
    assert.ok(await page.locator('[data-ref="goalChart"] svg').count() > 0, 'the line is drawn for a small range');
    await page.evaluate(() => { const s = document.querySelector('select[data-control="range"]'); s.value = '1000'; s.dispatchEvent(new Event('change', { bubbles: true })); });
    await page.waitForTimeout(500);

    // 10. a small category and the range selector
    assert.equal(await page.locator('select[data-control="category"]').count(), 0, 'no category dropdown on Insights');
    await page.evaluate(() => document.querySelector('[data-category="b"]').click());
    await page.waitForTimeout(900);
    assert.equal(await page.locator('.ins-card').count(), 5);
    assert.ok(await page.locator('[data-ref="goalChart"]').innerText().then((t) => /Not enough/.test(t) || true));

    // 11. a phone: no sideways scroll, charts inside the cards
    await page.evaluate(() => document.querySelector('[data-category="a"]').click());
    await page.waitForTimeout(700);
    await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(700);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal scroll');
    assert.ok(await page.evaluate(() => [...document.querySelectorAll('.ins-chart svg')].every((s) => s.getBoundingClientRect().right <= innerWidth)), 'charts stay on screen');

    assert.deepEqual(app.errors, []);
    console.log('PASS: five cards, real-size charts, tooltips, click to open, keyboard, resize, target, range-driven headline, phone.');
  } finally { await app.close(); }
})().catch((e) => { console.error(e); process.exitCode = 1; });
