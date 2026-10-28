/* Verify physical bottom-row keys, their saved mappings and modifier chords. */
const assert = require('node:assert/strict');
const { open, LEGACY_PLAY } = require('./browser-helper.cjs');

(async () => {
  const app = await open({hash:'play',cubePlay:LEGACY_PLAY}), {page} = app;
  const codes = ['Space','ShiftLeft','ShiftRight','ControlLeft','ControlRight','AltLeft','AltRight'];
  const stage = page.locator('#cube-play-mount .cube-stage');
  const transforms = () => page.locator('#cube-play-mount .sticker').evaluateAll(es => es.map(e => e.style.transform));
  const toggleSettings = () => page.locator('[data-play="settings"]').click();
  try {
    await page.locator('[data-play="reset"]').click();
    await toggleSettings();
    for (const code of codes) {
      const key = page.locator(`[data-game-key="${code}"]`);
      await key.click();
      await page.locator('.play-action-picker:popover-open [data-assign="R"]').click();
      assert.equal(await key.locator('b').textContent(), 'R');
    }
    await page.locator('.play-settings [data-action="close-dialog"]').last().click();
    await page.waitForFunction(() => !document.querySelector('#dialog').open);
    await stage.focus();
    for (const code of codes) {
      const before = await transforms();
      await page.keyboard.press(code);
      await page.waitForFunction(before => [...document.querySelectorAll('#cube-play-mount .sticker')].some((e,i) => e.style.transform !== before[i]), before);
    }
    const beforeChord = await transforms();
    await page.keyboard.down('ControlLeft');
    await page.keyboard.down('ShiftLeft');
    await page.keyboard.up('ShiftLeft');
    await page.keyboard.up('ControlLeft');
    assert.deepEqual(await transforms(), beforeChord, 'modifier chords do not trigger standalone bindings');
    await page.keyboard.down('ShiftLeft');
    await page.keyboard.press('i');
    const afterShiftedMove = await transforms();
    assert.notDeepEqual(afterShiftedMove, beforeChord, 'shifted normal key retains its mapping');
    await page.keyboard.up('ShiftLeft');
    assert.deepEqual(await transforms(), afterShiftedMove, 'shift used with another key does not trigger its own binding');
    await page.reload();
    await toggleSettings();
    for (const code of codes) assert.equal(await page.locator(`[data-game-key="${code}"] b`).textContent(), 'R', `${code} persists`);
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    for (const code of codes) assert.equal(await page.locator(`[data-game-key="${code}"] span`).evaluate(e => e.scrollWidth <= e.clientWidth), true, `${code} label fits on a phone`);
    assert.deepEqual(app.errors, []);
    console.log('PASS: space and left/right modifiers, separate mappings, chords, persistence and phone layout');
  } finally { await app.close(); }
})().catch(e => { console.error(e); process.exit(1); });
