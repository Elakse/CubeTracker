/* Camera calibration and surface explosion use the real renderer in an
   isolated sample-data browser, including its normal packed-cube path. */
const assert = require('node:assert/strict');
const {open, LEGACY_PLAY} = require('./browser-helper.cjs');
const path = require('node:path');
(async()=>{
  const app=await open({hash:'play',cubePlay:LEGACY_PLAY}), {page}=app;
  const pref=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cubetracker.preferences.v2')).cubePlay);
  const settings=async()=>{await page.locator('[data-play="settings"]').click();await page.locator('#cube-play-preview .cube-stage').waitFor();};
  const close=async()=>{await page.locator('.play-settings [data-action="close-dialog"]').last().click();await page.waitForFunction(()=>{const d=document.querySelector('#dialog');return !d.open&&!d.classList.contains('closing');});};
  const set=(key,value)=>page.locator(`[data-play-setting="${key}"]`).evaluate((el,value)=>{el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));},value);
  const toggle=key=>page.locator(`[data-control="play-${key}"]`).evaluate(el=>el.click());
  const wheel=async(slot,delta)=>{await page.locator(`#${slot} .cube-stage`).evaluate((el,delta)=>el.dispatchEvent(new WheelEvent('wheel',{deltaY:delta,bubbles:true,cancelable:true})),delta);};
  const renderInfo=slot=>page.evaluate(async slot=>{
    const p=JSON.parse(localStorage.getItem('cubetracker.preferences.v2'));
    const {acquireCube}=await import('/assets/cube-realistic.js');
    const r=acquireCube(slot,document.querySelector(`#${slot} .cube-stage`),undefined,p.cubeFinish,p.cubeQuality,p.cubeEnvironment,p.cubeWear,p.cubeCore);
    r.root.updateWorldMatrix(true,true);r.camera.updateMatrixWorld();
    return {bodies:r.bodies.filter(b=>b.mesh.visible).length,core:r.innerCore.visible,
      faces:r.faces.map(m=>({position:m.position.toArray(),side:m.material.side,material:m.material.uuid})),
      projection:{pitch:r.playgroundView.pitch,yaw:r.playgroundView.yaw,zoom:r.root.scale.x,perspective:r.playgroundView.perspective,pixelScale:r.playgroundView.pixelScale,distance:r.camera.position.z,fov:r.camera.fov},
      mark:r.mark?{position:r.mark.position.toArray(),visible:r.mark.visible}:null,
      projected:r.faces.map(m=>{const v=m.position.clone().applyMatrix4(r.root.matrixWorld).project(r.camera);return [v.x* r.stage.clientWidth/2,-v.y*r.stage.clientHeight/2];})};
  },slot);
  const realReady=async(slot='cube-play-mount')=>{await page.locator(`#${slot} canvas`).waitFor({timeout:45000});await page.waitForFunction(slot=>!document.getElementById(slot).classList.contains('cube-loading'),slot,{timeout:45000});};
  try{
    await page.locator('[data-play="reset"]').click();
    await settings();
    assert.equal(await page.locator('#cube-play-preview .sticker').count(),54);
    const left=await page.locator('.play-settings-layout .settings-scroll').boundingBox(),right=await page.locator('.play-preview-pane').boundingBox();
    assert.ok(left.width<550&&right.x>left.x+left.width,'narrow settings with a dedicated preview on the right');
    await set('pitch',-35);await set('yaw',32);await set('perspective',0);await set('separation',90);
    const views=()=>page.locator('#cube-play-mount .cube-stage,#cube-play-preview .cube-stage').evaluateAll(es=>es.map(e=>({zoom:e.dataset.zoom,perspective:e.dataset.perspective,orbit:e.querySelector('.cube-world').style.transform})));
    let pair=await views();assert.equal(pair[0].perspective,'0');assert.equal(pair[1].perspective,'0');
    const previewTransforms=await page.locator('#cube-play-preview .sticker').evaluateAll(es=>es.map(e=>e.style.transform));
    assert.deepEqual(previewTransforms,await page.locator('#cube-play-mount .sticker').evaluateAll(es=>es.map(e=>e.style.transform)),'preview has the same physical sticker state');
    await wheel('cube-play-preview',-300);pair=await views();assert.equal(pair[0].zoom,pair[1].zoom);assert.ok((await pref()).zoom>1);
    await wheel('cube-play-preview',-100000);assert.equal((await pref()).zoom,1.8);
    await wheel('cube-play-preview',100000);assert.equal((await pref()).zoom,.45);
    await set('perspective',100);await wheel('cube-play-preview',-300);await close();
    await wheel('cube-play-mount',-100000);assert.equal((await pref()).zoom,1.8);
    await wheel('cube-play-mount',100000);assert.equal((await pref()).zoom,.45);
    // Use a detailed real model; the public renderer acquisition API reuses
    // the existing slot when inspected below, without modifying its settings.
    await page.evaluate(()=>{const key='cubetracker.preferences.v2',p=JSON.parse(localStorage.getItem(key));Object.assign(p,{cubeFinish:'tiles',cubeQuality:'balanced'});Object.assign(p.cubePlay,{useAppCube:true,explodeAppCube:false,zoom:1});localStorage.setItem(key,JSON.stringify(p));});
    await page.reload();await realReady();await page.locator('[data-play="reset"]').click();await realReady();await settings();await realReady('cube-play-preview');
    assert.equal(await page.locator('[data-control="play-outlines"]').isDisabled(),true);
    assert.equal(await page.locator('[data-play-setting="radius"]').isDisabled(),true);
    assert.equal(await page.locator('[data-separation]').isVisible(),false);
    const packed=await renderInfo('cube-play-mount');assert.equal(packed.bodies,26);assert.equal(packed.core,true);
    await toggle('explodeAppCube');await set('separation',90);await set('perspective',100);
    assert.equal(await page.locator('[data-separation]').isVisible(),true);
    const exploded=await renderInfo('cube-play-mount'),preview=await renderInfo('cube-play-preview');
    assert.equal(exploded.bodies,0);assert.equal(exploded.core,false);assert.ok(exploded.faces.every(f=>f.side===2));
    assert.deepEqual(exploded.faces.map(f=>f.material),packed.faces.map(f=>f.material),'explosion retains existing surface materials');
    assert.deepEqual(exploded.faces.map(f=>f.position),preview.faces.map(f=>f.position),'both scenes share the exploded state');
    assert.equal(exploded.projection.pitch,-35);assert.equal(exploded.projection.yaw,32);
    assert.ok(Math.abs(exploded.projection.distance-exploded.projection.perspective/exploded.projection.pixelScale)<1e-9);
    // Independently project the CSS face centres; the real surface sits only
    // ~.02 cubie units lower than the standard sticker plane.
    // Hidden CSS stickers are normally not updated by the realistic renderer;
    // compute the reference from the shared engine rather than stale DOM.
    const projectionError=await page.evaluate(async()=>{
      const p=JSON.parse(localStorage.getItem('cubetracker.preferences.v2')),stage=document.querySelector('#cube-play-mount .cube-stage'),world=stage.querySelector('.cube-world'),M=new DOMMatrix(world.style.transform),P=parseFloat(stage.style.perspective),{acquireCube}=await import('/assets/cube-realistic.js'),r=acquireCube('cube-play-mount',stage,undefined,p.cubeFinish,p.cubeQuality,p.cubeEnvironment,p.cubeWear,p.cubeCore);
      r.root.updateWorldMatrix(true,true);r.camera.updateMatrixWorld();
      return Math.max(...new CT.Cube().stickers.map((s,i)=>{const k=p.cubePlay.separation,step=46+k*.52,plane=69+k*1.05,a=s.p.map((v,j)=>v*step+s.n[j]*(plane-step)),v=new DOMPoint(a[0],-a[1],a[2]).matrixTransform(M),n=r.faces[i].position.clone().applyMatrix4(r.root.matrixWorld).project(r.camera);return Math.hypot(P*v.x/(P-v.z)-n.x*stage.clientWidth/2,P*v.y/(P-v.z)+n.y*stage.clientHeight/2);}));
    });assert.ok(projectionError<4,`CSS/WebGL camera alignment (${projectionError}px)`);
    await page.screenshot({path:path.join(__dirname,'screenshots/playground-exploded-tiles-preview.png')});
    await wheel('cube-play-preview',-120);assert.equal((await views())[0].zoom,(await views())[1].zoom);
    await toggle('explodeAppCube');const restored=await renderInfo('cube-play-mount');assert.equal(restored.bodies,26);assert.equal(restored.core,true);assert.ok(restored.faces.every(f=>f.side===0));
    await toggle('explodeAppCube');await toggle('animations');await close();
    await page.locator('#cube-play-mount .cube-stage').focus();await page.keyboard.press('i');
    await page.waitForFunction(()=>document.querySelector('[data-play-status]').dataset.lastMove==='R');
    await page.keyboard.press('k');
    await page.waitForFunction(()=>document.querySelector('[data-play-status]').dataset.lastMove==="R'");
    assert.equal(await page.locator('[data-play-status]').textContent(),'Scramble to start');
    await page.reload();await realReady();assert.equal((await pref()).explodeAppCube,true);
    await settings();await realReady('cube-play-preview');await toggle('useAppCube');
    assert.equal(await page.locator('[data-control="play-outlines"]').isDisabled(),false);
    assert.equal(await page.locator('[data-play-setting="radius"]').isDisabled(),false);
    assert.equal(await page.locator('[data-separation]').isVisible(),true);
    await page.setViewportSize({width:390,height:844});await page.waitForTimeout(250);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    const mobilePreview=await page.locator('.play-preview-pane').boundingBox(),mobileControls=await page.locator('.play-settings-layout .settings-scroll').boundingBox();
    assert.ok(mobilePreview.y<mobileControls.y&&mobilePreview.height>100,'phone preview stacks above scrolling settings');
    await page.screenshot({path:path.join(__dirname,'screenshots/playground-live-preview-phone.png')});
    await close();
    // Stickered model carries a printed logo; it must follow its surface.
    await page.evaluate(()=>{const key='cubetracker.preferences.v2',p=JSON.parse(localStorage.getItem(key));p.cubeFinish='stickers';Object.assign(p.cubePlay,{useAppCube:true,explodeAppCube:true,zoom:1});localStorage.setItem(key,JSON.stringify(p));});
    await page.reload();await realReady();await page.locator('[data-play="reset"]').click();await realReady();const logo=await renderInfo('cube-play-mount');assert.ok(logo.mark?.visible);assert.equal(logo.bodies,0);
    await page.locator('#cube-play-mount .cube-stage').focus();await page.keyboard.press('t');
    await page.waitForFunction(()=>document.querySelector('[data-play-status]').dataset.lastMove==='x');
    const turned=await renderInfo('cube-play-mount');assert.notDeepEqual(turned.mark.position,logo.mark.position);
    await page.screenshot({path:path.join(__dirname,'screenshots/playground-exploded-stickers-phone.png')});
    assert.deepEqual(app.errors,[]);
    console.log('PASS: live preview, CSS/WebGL projection calibration, shared bounded wheel zoom, perspective, packed/exploded Tiles, surface materials, sticker logo, moves/animation, disabled controls, persistence and phone layout.');
  }finally{await app.close();}
})().catch(e=>{console.error(e);process.exit(1)});
