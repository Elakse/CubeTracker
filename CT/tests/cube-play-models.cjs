/* Exercise the shared renderer directly so unrelated Appearance layout
   assertions cannot hide regressions in a model's normal or exploded path. */
const assert=require('node:assert/strict');
const {open}=require('./browser-helper.cjs');
(async()=>{
  const app=await open({hash:'play',width:600,height:600}),{page}=app;
  try{
    const results=await page.evaluate(async()=>{
      const {RealisticCube}=await import('/assets/cube-realistic.js');
      const mount=document.createElement('div');mount.style.cssText='position:fixed;inset:0;width:500px;height:500px;background:var(--bg)';document.body.append(mount);
      const output=[];
      for(const model of ['tiles','stickers','speedcube','uv','og']){
        const r=new RealisticCube(mount,()=>{},model,'balanced'),cube=new CT.Cube();
        r.setPalette(Object.fromEntries(Object.entries(CT.FACES).map(([f,v])=>[f,v.color])));
        r.draw(cube.stickers);r.orbit(-25,-42,1);
        const normal={bodies:r.bodies.filter(b=>b.mesh.visible).length,core:r.innerCore.visible,camera:r.camera.position.toArray(),fov:r.camera.fov};
        const materialIds=r.faces.map(f=>f.material.uuid),normalPositions=r.faces.map(f=>f.position.clone());
        r.setPlaygroundView({pitch:-30,yaw:25,pixelScale:50,perspective:800});
        r.draw(cube.stickers,null,0,100);
        const separated=r.faces.map(f=>f.position.clone());
        const first=cube.stickers.findIndex(s=>s.p.every(v=>v===1)),second=cube.stickers.findIndex((s,i)=>i!==first&&s.p.every(v=>v===1));
        const exploded={bodies:r.bodies.filter(b=>b.mesh.visible).length,core:r.innerCore.visible,floor:r.floor.visible,sides:r.faces.every(f=>f.material.side===2),sameMaterials:r.faces.every((f,i)=>f.material.uuid===materialIds[i]),cornerGap:separated[first].distanceTo(separated[second]),normalGap:normalPositions[first].distanceTo(normalPositions[second])};
        const markBefore=r.mark?.position.clone();
        r.draw(cube.stickers,CT.moveSpec('R'),.5,100);
        const intermediate=r.faces.some((f,i)=>f.position.distanceTo(separated[i])>.01);
        cube.move('x');r.draw(cube.stickers,null,0,100);
        const logoFollows=!r.mark||r.mark.position.distanceTo(markBefore)>.1;
        r.draw(cube.stickers);
        const restored={bodies:r.bodies.filter(b=>b.mesh.visible).length,core:r.innerCore.visible,sides:r.faces.every(f=>f.material.side===0)};
        output.push({model,normal,exploded,intermediate,logoFollows,restored});
        r.destroy();
      }
      mount.remove();return output;
    });
    for(const result of results){
      const {model,normal,exploded,restored}=result;
      assert.equal(normal.bodies,26,model);assert.equal(normal.core,true,model);assert.deepEqual(normal.camera,[0,4.2,9],model+' retains the normal app camera');
      assert.equal(exploded.bodies,0,model);assert.equal(exploded.core,false,model);assert.equal(exploded.floor,false,model);assert.equal(exploded.sides,true,model);assert.equal(exploded.sameMaterials,true,model);
      assert.ok(exploded.cornerGap>exploded.normalGap*2,model+' separates surfaces on the same corner');assert.equal(result.intermediate,true,model+' animates surfaces');assert.equal(result.logoFollows,true,model+' carries its logo');
      assert.equal(restored.bodies,26,model);assert.equal(restored.core,true,model);assert.equal(restored.sides,true,model);
    }
    assert.deepEqual(app.errors,[]);
    console.log('PASS: normal app camera and reversible surface explosion, same-corner separation, original materials, animation and logos for Tiles, Stickers, Speedcube, UV Speedcube and OG.');
  }finally{await app.close();}
})().catch(e=>{console.error(e);process.exit(1)});
