/* The sliding navigation sidebar closes as soon as you pick any screen, not only the Timer. */
const assert = require('node:assert/strict');
const { open } = require('./browser-helper.cjs');

(async () => {
  const app = await open({ hash: 'overview', theme: 'light', width: 1440, height: 900 });
  const { page } = app;
  const isOpen = () => page.evaluate(() => document.body.classList.contains('sidebar-open'));
  try {
    for (const view of ['solves', 'insights', 'trainer', 'overview', 'timer']) {
      await page.mouse.move(2, 300); await page.waitForTimeout(500);
      assert.ok(await isOpen(), `${view}: the sidebar opens at the left edge`);
      await page.mouse.move(80, 300); await page.locator(`[data-view="${view}"]`).click(); await page.waitForTimeout(600);
      assert.ok(!(await isOpen()), `${view}: the sidebar closes after choosing it`);
      assert.equal(await page.evaluate(() => location.hash), `#${view}`, `${view}: the screen changed`);
    }
    assert.deepEqual(app.errors, [], 'no page errors');
    console.log('sidebar close ok');
  } finally { await app.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
