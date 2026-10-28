const assert=require('node:assert/strict');
const {open,makeSolves,LEGACY_PLAY}=require('./browser-helper.cjs');
const path=require('node:path');
(async()=>{
  const physical={id:'physical',name:'Physical',solves:makeSolves(20)},original=structuredClone(physical);
  const app=await open({hash:'timer',categories:[physical],cubePlay:LEGACY_PLAY}),{page}=app;
  const category=()=>app.library().categories.find(c=>c.type==='virtual');
  const select=id=>page.locator(`[data-category="${id}"]`).evaluate(e=>e.click());
  const nav=view=>page.locator(`.main-nav [data-view="${view}"]`).evaluate(e=>e.click());
  const stage=()=>page.locator('#cube-play-mount .cube-stage');
  const close=async()=>{await page.locator('#dialog [data-action="close-dialog"]').last().click();await page.waitForFunction(()=>{const d=document.querySelector('#dialog');return !d.open&&!d.classList.contains('closing');});};
  const prepare=async scramble=>page.evaluate(scramble=>{const previous=CT.scramble;try{CT.scramble=()=>scramble;document.querySelector('[data-play="scramble"]').click();}finally{CT.scramble=previous;}},scramble);
  const saved=async count=>{for(let i=0;i<50&&category()?.solves.length!==count;i++)await page.waitForTimeout(50);assert.equal(category()?.solves.length,count);};
  try{
    assert.deepEqual(app.library().categories[0],original,'migration preserves every existing solve field');
    assert.equal(app.library().categoryTypesVersion,1);assert.equal(app.library().categories.filter(c=>c.type==='virtual').length,1);
    assert.equal(await page.locator('[data-view="play"]').count(),0);
    assert.equal(await page.locator('#timer-surface').count(),1,'physical Timer unchanged');
    const virtualId=category().id;
    await select(virtualId);await stage().waitFor();assert.equal(new URL(page.url()).hash,'#timer');
    assert.equal(await page.locator('#timer-surface').count(),0);assert.equal(await page.locator('[data-view="timer"]').getAttribute('aria-current'),'page');
    await prepare('R U');
    await page.clock.install();await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000));
    await page.keyboard.press('t');await page.keyboard.press('y');await page.clock.runFor(500);
    assert.equal(await page.locator('[data-virtual-time]').textContent(),'0.00');assert.equal(category().solves.length,0);
    await page.keyboard.press('f');await page.clock.runFor(1234);await page.keyboard.press('k');
    assert.equal(await page.locator('[data-play-status]').textContent(),'Saved');
    await page.clock.resume();await saved(1);
    const first=structuredClone(category().solves[0]);assert.equal(first.rawMs,1234);assert.equal(first.source,'virtual');assert.equal(first.scramble,'R U');
    assert.deepEqual(first.reconstruction.moves.map(m=>m.move),['x',"x'","U'","R'"]);assert.equal(first.reconstruction.inspectionCount,2);
    await page.keyboard.press('k');await page.keyboard.press('t');await saved(1);
    // Existing details replay the recorded sequence from the original scramble.
    await nav('solves');await page.locator('.lib-row').first().click();
    assert.equal(await page.locator('[data-cube="play"]').getAttribute('aria-label'),'Play reconstruction');
    assert.equal(await page.locator('#scramble-notation [data-move]').count(),4);
    assert.equal(await page.locator('#scramble-notation [data-move]').first().getAttribute('title'),'Inspection rotation');
    await page.locator('[data-cube="last"]').click();assert.equal(await page.locator('#scramble-notation .done').count(),4);
    await page.locator('[data-cube="first"]').click();assert.equal(await page.locator('#scramble-notation .done').count(),0);
    await page.locator('[data-cube="play"]').click();await page.waitForFunction(()=>document.querySelectorAll('#scramble-notation .done').length===4);await close();
    await page.reload();await page.locator('.lib-row').waitFor();assert.deepEqual(category().solves[0],first);
    await nav('overview');assert.equal(await page.locator('.page-heading h1').textContent(),'Overview');
    assert.equal(await page.locator('.ov-stat').filter({hasText:'Total solves'}).locator('b').textContent(),'1');
    assert.match(await page.locator('.ov-stat').filter({hasText:'Session mean'}).locator('b').textContent(),/1\.23/);
    await nav('insights');assert.equal(await page.locator('.page-heading h1').textContent(),'Insights');
    await nav('timer');await prepare('R U');
    await page.locator('[data-play="settings"]').click();await page.locator('[data-control="play-animations"]').evaluate(e=>e.click());await close();
    // Queue several turns without waiting for their visual animation. Timing
    // and the save are based on accepted input, including the final R'.
    await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000));await page.keyboard.press('f');await page.clock.runFor(40);
    await page.keyboard.press('j');await page.clock.runFor(40);await page.keyboard.press('f');await page.clock.runFor(40);await page.keyboard.press('k');
    assert.equal(await page.locator('[data-play-status]').textContent(),'Saved');
    await page.clock.resume();await saved(2);assert.equal(category().solves[1].rawMs,120);
    assert.deepEqual(category().solves[1].reconstruction.moves.map(m=>m.move),["U'",'U',"U'","R'"]);
    // Leave while visual turns are queued: the authoritative state and saved
    // reconstruction survive, without a callback saving into another category.
    await select('physical');assert.equal(await page.locator('#timer-surface').count(),1);await page.waitForTimeout(500);
    assert.deepEqual(app.library().categories.find(c=>c.id==='physical'),original);
    await nav('overview');assert.equal(await page.locator('.ov-stat').filter({hasText:'Total solves'}).locator('b').textContent(),'20');await nav('timer');
    await select(virtualId);await prepare('R U');await page.keyboard.press('f');await nav('overview');await nav('timer');
    await page.keyboard.press('k');await saved(3);assert.equal(category().solves[2].reconstruction.moves.at(-1).move,"R'");
    await page.locator('[data-play="reset"]').click();await page.keyboard.press('i');await page.keyboard.press('k');await page.keyboard.press('t');await page.waitForTimeout(200);await saved(3);
    // Delete through the ordinary category manager, then explicitly restore.
    await nav('solves');await page.locator('[data-action="manage"]').click();await page.locator('[data-action="delete-category"]').click();
    await page.locator('[data-action="confirm-delete-category"]').click();await page.waitForTimeout(250);
    assert.equal(category(),undefined);assert.equal(app.library().archivedCategories[0].solves.length,3);
    await page.reload();await page.locator('.lib-row').first().waitFor();assert.equal(category(),undefined,'reload does not recreate a deleted virtual category');
    await page.locator('[data-action="virtual-category"]').evaluate(e=>e.click());await page.waitForTimeout(100);
    assert.equal(category().id,virtualId);assert.equal(category().solves.length,3);assert.equal(app.library().archivedCategories.length,0);
    assert.equal(category().solves[0].reconstruction.moves.length,4);
    await nav('timer');await page.setViewportSize({width:390,height:844});await page.waitForTimeout(250);
    assert.equal(await page.locator('select[data-control="category"]').isVisible(),true);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.screenshot({path:path.join(__dirname,'screenshots/virtual-timer-phone.png')});
    await page.selectOption('select[data-control="category"]','physical');assert.equal(await page.locator('#timer-surface').count(),1);
    assert.deepEqual(app.errors,[]);
    console.log('PASS: additive migration, physical/virtual Timer routing, inspection rotations, exact input timing, animated queues, reconstruction save/reload/playback, category navigation, reset, archive/delete/restore and phone category selection.');
  }finally{await app.close();}
})().catch(e=>{console.error(e);process.exit(1)});
