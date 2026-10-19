/* Renderer regression and reference views; isolated from the solve library. */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.CT_PLAYWRIGHT || 'C:/Users/alejo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..'), output = process.env.OG_OUTPUT || path.join(__dirname, 'screenshots');
const server = http.createServer((req, res) => {
  if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  if (req.url === '/') {
    res.setHeader('Content-Type', 'text/html');
    res.end('<style>body{margin:0;background:#f1f0ed}#stage{width:640px;height:640px}canvas{display:block;width:100%;height:100%}</style><div id="stage"></div><script src="/assets/core.js"></script><script src="/assets/environments.js"></script>');
    return;
  }
  const file = path.resolve(root, '.' + req.url.split('?')[0]);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.png': 'image/png' })[path.extname(file)] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});
(async () => {
  fs.mkdirSync(output, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 640, height: 640 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const create = async (quality, wear = false, core = 'black', environment = 'studio') => {
      await page.evaluate(async ({quality, wear, core, environment}) => {
        window.cube?.destroy();
        const {RealisticCube, cubeTuning} = await import('/assets/cube-realistic.js');
        window.cube = new RealisticCube(document.querySelector('#stage'), () => { throw Error('WebGL unavailable'); }, 'og', quality, environment, wear, core);
        if (!Number.isFinite(cubeTuning('og', environment, true).exposure)) throw Error('Missing OG lighting defaults');
        cube.setPalette({U:'#eeeeea',D:'#ffd500',F:'#17984f',B:'#174ba1',L:'#ff7700',R:'#c92232'});
        cube.draw(new CT.Cube().apply("x'").stickers);
        cube.orbit(-25,-42,1);
        await cube.envReady;
      }, {quality, wear, core, environment});
      await page.locator('canvas[data-logo="loaded"]').waitFor();
      if (wear) await page.locator('canvas[data-wear="loaded"][data-wear-roughness="loaded"][data-wear-sticker="loaded"][data-wear-sticker-normal="loaded"][data-wear-sticker-roughness="loaded"][data-wear-sticker-handling-normal="loaded"]').waitFor();
      else await page.locator('canvas[data-sticker-clean-normal="loaded"]').waitFor();
    };
    for (const quality of ['low','balanced','high','ultra','cinematic']) {
      await create(quality);
      const geometry = await page.evaluate(() => {
        const centers = cube.faces.filter((_,i) => i % 9 === 4);
        const circular = centers.every(m => {
          const p = m.geometry.getAttribute('position');
          return Array.from({length:52},(_,i)=>Math.hypot(p.getX(i),p.getY(i))).every(r=>Math.abs(r-.4)<1e-6);
        });
        const valid = [...cube.faces,...cube.holders].every(m => {
          const p=m.geometry.getAttribute('position'), n=m.geometry.getAttribute('normal');
          return [...p.array,...n.array].every(Number.isFinite) && Array.from({length:n.count},(_,i)=>Math.hypot(n.getX(i),n.getY(i),n.getZ(i))).every(v=>Math.abs(v-1)<.001);
        });
        const physicalFilm = cube.faces.every(m => {
          m.geometry.computeBoundingBox();m.children[0].geometry.computeBoundingBox();
          return m.geometry.boundingBox.min.z > m.children[0].geometry.boundingBox.max.z;
        });
        return { circular, valid, physicalFilm, holders:cube.holders.length, faces:cube.faces.length, shared:new Set(cube.holders.map(h=>h.geometry)).size };
      });
      await page.screenshot({path:path.join(output,`og-${quality}.png`)});
      assert.deepEqual(geometry, {circular:true,valid:true,physicalFilm:true,holders:54,faces:54,shared:9});
      await page.evaluate(()=> { cube.draw(new CT.Cube().stickers);cube.orbit(-25,-42,1); });
      const original = await page.screenshot();
      await page.evaluate(()=>cube.draw(new CT.Cube().stickers,CT.moveSpec('R'),.5));
      assert.ok(!original.equals(await page.screenshot()), 'Partial layer turn is visible');
      await page.screenshot({path:path.join(output,`og-${quality}-turn.png`)});
      await page.evaluate(()=>cube.draw(new CT.Cube().apply("R R'").stickers));
      assert.ok(original.equals(await page.screenshot()), 'Inverse move restores exact image');
      await page.evaluate(()=>cube.draw(new CT.Cube().apply("R U R' F2 D L2 B").stickers));
      const attached = await page.evaluate(()=>cube.holders.every((h,i)=>h.parent===cube.faces[i] && h.position.length()===0 && h.quaternion.w===1));
      assert.ok(attached,'Every holder stays attached to its film across scrambled poses');
      await page.screenshot({path:path.join(output,`og-${quality}-scrambled.png`)});
      console.log(`${quality}: geometry, layer turn, inverse and scramble passed`);
    }
    for (const core of ['black','white','green']) {
      await create('balanced',true,core);
      const identity = await page.evaluate(()=>cube.faces.every((m,i)=>{
        const uv=m.geometry.getAttribute('uv1');
        for(let k=0;k<uv.count;k++) if (Math.floor(uv.getX(k)*8)+8*(7-Math.floor(uv.getY(k)*8))!==i) return false;
        return true;
      }));
      assert.ok(identity,'All 54 wear tiles stay within their assigned film');
      await page.screenshot({path:path.join(output,`og-worn-${core}.png`)});
    }
    const wearMaterials = await page.evaluate(() => ({
      scratchedFilms: cube.faces.filter(face => face.material.normalMap?.name === 'Worn sticker normal').length,
      nailFilms: cube.faces.filter(face => face.geometry.userData.stickerNail).length,
      nailPlacements: new Set(cube.faces.filter(face => face.geometry.userData.stickerNail).map(face => face.geometry.userData.stickerNailPosition.join(','))).size,
      handlingFilms: cube.faces.filter(face => face.material.clearcoatNormalMap?.name === 'Worn sticker handling normal').length,
      stickerNormal: cube.faceMaterials.U.normalMap?.name,
      stickerNormalChannel: cube.faceMaterials.U.normalMap?.channel,
      stickerRoughness: cube.faceMaterials.U.roughnessMap?.name,
      stickerClearcoatRoughness: cube.faceMaterials.U.clearcoatRoughnessMap?.name,
      handlingNormal: cube.faceMaterials.U.clearcoatNormalMap?.name,
      handlingNormalChannel: cube.faceMaterials.U.clearcoatNormalMap?.channel,
      handlingNormalScale: [cube.faceMaterials.U.clearcoatNormalScale.x, cube.faceMaterials.U.clearcoatNormalScale.y],
      plasticNormal: cube.shellMaterial.normalMap?.name,
      holderNormal: cube.holderMaterial.normalMap?.name,
      normalUvInBounds: cube.faces.every(face => {
        const normalUv = face.geometry.getAttribute('uv2'), handlingUv = face.geometry.getAttribute('uv3');
        return [normalUv, handlingUv].every(uv => uv && Array.from({length:uv.count}, (_, i) => [uv.getX(i), uv.getY(i)]).flat().every(value => value >= 0 && value <= 1));
      }),
    }));
    assert.deepEqual(wearMaterials, {
      scratchedFilms:54, nailFilms:9, nailPlacements:9, handlingFilms:54,
      stickerNormal:'Worn sticker normal', stickerNormalChannel:2,
      stickerRoughness:'Worn sticker handling', stickerClearcoatRoughness:'Worn sticker handling',
      handlingNormal:'Worn sticker handling normal',
      handlingNormalChannel:3, handlingNormalScale:[.1,.1],
      plasticNormal:'Worn plastic normal', holderNormal:'Worn plastic normal', normalUvInBounds:true,
    });
    await create('balanced',false,'black','studioSmall08');
    assert.deepEqual(await page.evaluate(() => ({
      normal: cube.faceMaterials.U.normalMap?.name,
      normalChannel: cube.faceMaterials.U.normalMap?.channel,
      normalScale: [cube.faceMaterials.U.normalScale.x, cube.faceMaterials.U.normalScale.y],
      coatNormal: cube.faceMaterials.U.clearcoatNormalMap?.name,
      coatNormalScale: [cube.faceMaterials.U.clearcoatNormalScale.x, cube.faceMaterials.U.clearcoatNormalScale.y],
      roughnessMap: cube.faceMaterials.U.roughnessMap,
      clearcoatRoughnessMap: cube.faceMaterials.U.clearcoatRoughnessMap,
    })), { normal:'Clean sticker normal', normalChannel:0, normalScale:[.3,.3], coatNormal:'Clean sticker normal', coatNormalScale:[.12,.12], roughnessMap:null, clearcoatRoughnessMap:null });
    await page.screenshot({path:path.join(output,'og-photographic.png')});
    await page.evaluate(()=> {
      Object.assign(document.querySelector('#stage').style,{width:'360px',height:'360px'});
      cube.resize();
    });
    await page.locator('#stage').screenshot({path:path.join(output,'og-dialog.png')});
    await page.evaluate(()=>cube.destroy());
    assert.equal(await page.locator('canvas').count(),0);
    assert.deepEqual(errors,[]);
    console.log('OG Speedcube: five qualities, three cores, wear, photographic light, compact preview and disposal passed.');
  } finally { await browser.close(); await new Promise(resolve=>server.close(resolve)); }
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
