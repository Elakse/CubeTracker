/* Real interaction with sample data only: geometry, keyboard routing, modal
   remapping, both renderers, persistence, responsive layouts and date regression. */
const assert = require('node:assert/strict');
const { open, LEGACY_PLAY } = require('./browser-helper.cjs');
const C = require('../assets/core.js');
const path = require('node:path');
(async () => {
  const app = await open({hash:'play',cubePlay:LEGACY_PLAY}), {page} = app;
  const stage = () => page.locator('#cube-play-mount .cube-stage');
  const transforms = () => page.locator('#cube-play-mount .sticker').evaluateAll(es => es.map(e => e.style.transform));
  const settings = async () => { await page.locator('[data-play="settings"]').click(); await page.locator('.play-settings').waitFor(); };
  const close = async () => { await page.locator('.play-settings [data-action="close-dialog"]').last().click(); await page.waitForFunction(() => {const d=document.querySelector('#dialog');return !d.open && !d.classList.contains('closing');}); };
  const set = async (key,value) => page.locator(`[data-play-setting="${key}"]`).evaluate((el,v) => {el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));},value);
  const toggle = key => page.locator(`[data-control="play-${key}"]`).evaluate(el => el.click());
  const check = async (cube,separation=65) => {
    const actual = (await transforms()).map(m => m.slice(9,-1).split(',').map(Number));
    const css = v => [v[0],-v[1],v[2]], step=46+separation*.52, plane=69+separation*1.05;
    cube.stickers.forEach((s,i) => {
      const wanted = [...css(s.right),0,...css(s.down),0,...css(s.n),0,...css(s.p.map((v,j) => v*step+s.n[j]*(plane-step))),1];
      wanted.forEach((v,j) => assert.ok(Math.abs(v-actual[i][j])<.001, `sticker ${i}, coordinate ${j}: ${actual[i][j]} ≈ ${v}`));
    });
  };
  try {
    await stage().waitFor();
    await page.locator('[data-play="reset"]').click();
    const solved = await transforms();
    assert.equal(await page.locator('.cube-exploded .sticker').count(),54);
    assert.equal(await page.locator('.sticker').first().evaluate(e => getComputedStyle(e).backfaceVisibility),'visible');
    await check(new C.Cube());
    await page.keyboard.press('i'); await check(new C.Cube().apply('R'));
    await page.keyboard.press('k'); await check(new C.Cube());
    for (const [key,move] of [['t','x'],['a',"y'"],['p','z']]) {
      await page.locator('[data-play="reset"]').click(); await page.keyboard.press(key); await check(new C.Cube().apply(move));
    }
    await page.locator('[data-play="reset"]').click();
    await page.locator('[data-play="settings"]').focus(); await page.keyboard.press('i'); assert.deepEqual(await transforms(),solved,'focused app controls do not play moves');
    await settings();
    await page.keyboard.press('i'); assert.deepEqual(await transforms(),solved,'modal blocks gameplay');
    await set('pitch',-40); await set('yaw',30); await set('separation',100); await set('radius',0); await toggle('outlines');
    await check(new C.Cube(),100);
    assert.equal(await page.locator('.sticker').first().evaluate(e => getComputedStyle(e).borderRadius),'0px');
    assert.match(await page.locator('#cube-play-mount .cube-world').getAttribute('style'),/rotateX\(-40deg\) rotateY\(30deg\)/);
    await page.locator('[data-game-key="KeyI"]').click();
    await page.locator('.play-action-picker:popover-open').waitFor();
    assert.equal(await page.locator('.play-action-picker').evaluate(e => e.closest('dialog').open),true,'picker lives inside modal');
    await page.locator('.play-action-picker [data-assign="F2"]').click();
    assert.equal(await page.locator('[data-game-key="KeyI"] b').textContent(),'F2');
    await page.locator('[data-game-key="KeyK"]').focus(); await page.keyboard.press('Enter');
    await page.keyboard.press('Home'); await page.keyboard.press('Enter');
    assert.equal(await page.locator('[data-game-key="KeyK"] b').textContent(),'·','clear assignment without typing notation');
    await page.locator('[data-game-key="KeyI"]').click(); await page.keyboard.press('Escape');
    assert.equal(await page.locator('#dialog').evaluate(d => d.open),true,'first Escape only closes picker');
    assert.equal(await page.locator('[data-game-key="KeyI"]').evaluate(e=>e===document.activeElement),true);
    await close();
    await page.keyboard.press('i'); await check(new C.Cube().apply('F2'),100);
    await page.keyboard.press('k'); await check(new C.Cube().apply('F2'),100);
    await page.reload(); await stage().waitFor(); await page.locator('[data-play="reset"]').click(); await page.waitForTimeout(2500);
    const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('cubetracker.preferences.v2')).cubePlay);
    assert.equal(saved.bindings.KeyI,'F2'); assert.equal(saved.bindings.KeyK,undefined); assert.equal(saved.pitch,-40); assert.equal(saved.separation,100);
    await settings(); await toggle('animations'); await set('speed',20);
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('cubetracker.preferences.v2')).trainerSpeed),280,'uses Trainer speed preference');
    await close(); await stage().focus();
    // Drive animation frames explicitly; headless background scheduling can
    // otherwise delay the first frame beyond a wall-clock snapshot.
    await page.clock.install();
    await page.clock.pauseAt(new Date(Date.now()+1000));
    const beforeAnimation = await transforms();
    await page.keyboard.press('i'); await page.clock.runFor(80);
    const mid=await transforms(); assert.notDeepEqual(mid,beforeAnimation,'animated turn has intermediate frames');
    await page.keyboard.press('i'); await page.clock.runFor(600); await check(new C.Cube(),100);
    await page.clock.resume();
    await settings(); await toggle('useAppCube'); await close();
    assert.equal(await page.locator('.cube-exploded').count(),0,'app standard cube is not exploded');
    await check(new C.Cube(),0);
    // Select a real model through saved Appearance settings, then reload.
    await page.evaluate(()=>{const key='cubetracker.preferences.v2',p=JSON.parse(localStorage.getItem(key));p.cubeFinish='tiles';p.cubeQuality='balanced';localStorage.setItem(key,JSON.stringify(p));});
    await page.reload(); await page.locator('#cube-play-mount canvas').waitFor({timeout:45000});
    await page.waitForFunction(()=>!document.querySelector('#cube-play-mount').classList.contains('cube-loading'),{timeout:45000});
    await page.locator('[data-play="reset"]').click();
    await stage().focus(); await page.keyboard.press('i'); await page.waitForTimeout(350);
    await page.screenshot({path:path.join(__dirname,'screenshots/playground-app-cube.png')});
    await settings(); await toggle('animations'); await close();
    await page.keyboard.press('i');
    assert.equal(await page.locator('[data-play-status]').getAttribute('data-last-move'),'F2','realistic model also executes immediate practice moves');
    await settings(); await toggle('useAppCube'); await set('pitch',-25); await set('yaw',0); await set('separation',65); await close();
    await page.locator('[data-play="scramble"]').click(); assert.notDeepEqual(await transforms(),solved);
    await page.locator('[data-play="reset"]').click(); await check(new C.Cube());
    await page.screenshot({path:path.join(__dirname,'screenshots/playground-desktop.png')});
    await settings(); await page.locator('[data-game-key="KeyI"]').scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(__dirname,'screenshots/playground-settings.png')});
    await close();
    await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:path.join(__dirname,'screenshots/playground-phone.png')});
    await settings(); await page.locator('[data-game-key="KeyI"]').click();
    const box=await page.locator('.play-action-picker').boundingBox(); assert.ok(box.x>=0 && box.x+box.width<=391 && box.y>=0 && box.y+box.height<=845,'picker fits phone');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'no horizontal overflow');
    await page.screenshot({path:path.join(__dirname,'screenshots/playground-picker-phone.png')});
    await page.keyboard.press('Escape'); await close();
    // Same shared surface, unchanged calendar UI and range workflow.
    await page.selectOption('select[data-control="category"]','test');
    await page.evaluate(()=>document.querySelector('[data-view="solves"]').click());
    await page.locator('[data-ref="dateBtn"]').click(); await page.locator('.lib-datepop.open').waitFor();
    const dates=page.locator('.lib-day-c:not(.dis):not(.out)');
    await dates.nth(1).click(); await dates.nth(5).click();
    await page.waitForTimeout(300); assert.match(await page.locator('[data-ref="dateLabel"]').innerText(),/–/);
    await page.locator('[data-ref="dateBtn"]').click(); await page.keyboard.press('Escape');
    assert.equal(await page.locator('.lib-datepop.open').count(),0);
    assert.deepEqual(app.errors,[]);
    console.log('Cube playground: moves, rotations, explosion geometry, instant/animated queue, app model, saved settings, modal key picker, mobile layout and date picker passed.');
  } finally { await app.close(); }
})().catch(e=>{console.error(e);process.exit(1);});
