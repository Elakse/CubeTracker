/* A mock File System Access folder verifies standalone persistence without
   granting the browser access to any real directory. */
const assert=require('node:assert/strict');
const {open,makeSolves}=require('./browser-helper.cjs');
const V=require('../assets/virtual.js');
(async()=>{
  const attempt=new V.Attempt('R');
  const solve={id:'v-solve',date:'2026-10-27T12:00:00.000Z',note:'',...attempt.accept("R'",10).result};
  const app=await open({categories:[{id:'physical',name:'Physical',solves:makeSolves(2)},{id:'virtual',name:'3x3 Virtual',type:'virtual',puzzle:'3x3',solves:[solve]}]}),{page}=app;
  try{
    await page.evaluate(data=>localStorage.setItem('cubetracker.workspace.v2',JSON.stringify({...data,dirty:false})),app.library());
    await page.route('**/api/library',route=>route.fulfill({status:503,body:'Unavailable'}));
    await page.reload();await page.waitForTimeout(1200);
    await page.evaluate(()=>{
      window.__folderFiles={};window.__folderWrites=[];
      window.showDirectoryPicker=async()=>({getFileHandle:async(name,options={})=>{
        if(!(name in window.__folderFiles)&&!options.create)throw new DOMException('Missing','NotFoundError');
        return {getFile:async()=>({text:async()=>window.__folderFiles[name]}),createWritable:async()=>{
          let pending='';return {write:async text=>{pending=String(text);},close:async()=>{window.__folderFiles[name]=pending;window.__folderWrites.push(name);}};
        }};
      }});
    });
    const storage=()=>page.locator('[data-action="storage"]').first().evaluate(e=>e.click());
    await storage();await page.locator('[data-action="connect-folder"]').click();
    await page.waitForFunction(()=>Boolean(window.__folderFiles['.cubetracker.json']));
    const files=await page.evaluate(()=>window.__folderFiles),metadata=JSON.parse(files['.cubetracker.json']);
    const virtual=metadata.categories.find(c=>c.id==='virtual');
    assert.deepEqual(virtual.solves[0].reconstruction,solve.reconstruction);
    assert.equal(metadata.categoryTypesVersion,1);assert.ok(Array.isArray(metadata.archivedCategories));
    assert.match(files[virtual.file],/Date,Source,Reconstruction/);
    const before=await page.evaluate(()=>window.__folderWrites.length);
    await page.evaluate(()=>{window.__folderFiles['.cubetracker.json']='{"revision":999,"categories":[]}';});
    await page.locator('[data-category="virtual"]').evaluate(e=>e.click());
    await page.locator('.main-nav [data-view="solves"]').evaluate(e=>e.click());await page.locator('.lib-row').click();
    await page.locator('#solve-note').fill('Browser update retained');await page.locator('#solve-note').dispatchEvent('change');
    await page.waitForFunction(()=>[...document.querySelectorAll('.toast')].some(e=>e.textContent.includes('folder changed')));
    assert.equal(await page.evaluate(()=>window.__folderWrites.length),before,'external changes are checked before any CSV writes');
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('cubetracker.workspace.v2')).categories.find(c=>c.id==='virtual').solves[0].note),'Browser update retained');
    await page.keyboard.press('Escape');await page.waitForTimeout(250);
    const other=JSON.stringify({categories:[{id:'other',type:'physical',solves:[{id:'private'}]}]});
    await page.evaluate(text=>{window.__folderFiles['.cubetracker.json']=text;},other);
    await storage();await page.locator('[data-action="connect-folder"]').click();
    await page.waitForFunction(()=>[...document.querySelectorAll('.toast')].some(e=>e.textContent.includes('different workspace')));
    assert.equal(await page.evaluate(()=>window.__folderFiles['.cubetracker.json']),other);
    assert.equal(await page.evaluate(()=>window.__folderWrites.length),before);
    assert.deepEqual(app.errors,[]);
    console.log('PASS: standalone folder writes full virtual metadata and CSV; external changes and a different existing workspace are preserved, with browser recovery retained.');
  }finally{await app.close();}
})().catch(e=>{console.error(e);process.exit(1)});
