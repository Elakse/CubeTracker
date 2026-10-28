const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../assets/core.js'),V=require('../assets/virtual.js');
test('category migration is additive, idempotent and does not recreate a deleted virtual category',()=>{
  const old={id:'physical',name:'3x3 Virtual',solves:[{id:'old',rawMs:12340,penalty:'',scramble:'R',date:null,note:'Keep'}]},snapshot=structuredClone(old),state={categories:[old]};
  assert.equal(V.initialize(state,()=> 'virtual'),true);assert.deepEqual(old,snapshot);
  assert.equal(state.categories.length,2);assert.equal(V.typeOf(old),'physical');
  const virtual=state.categories.pop();state.archivedCategories.push(virtual);
  assert.equal(V.initialize(state,()=> 'duplicate'),false);assert.equal(state.categories.length,1);
});
test('inspection rotations do not start timing; all moves and rotations form a complete reconstruction',()=>{
  const a=new V.Attempt('R U');a.accept('x',100);a.accept("x'",900);assert.equal(a.phase,'inspection');assert.equal(a.time(10000),0);
  a.accept("U'",1000);assert.equal(a.phase,'running');a.accept('y',1200);a.accept("y'",1400);
  const {result}=a.accept("R'",2234);assert.equal(result.rawMs,1234);assert.equal(a.phase,'complete');
  assert.deepEqual(result.reconstruction.moves.map(m=>m.move),['x',"x'","U'",'y',"y'","R'"]);
  assert.equal(result.reconstruction.inspectionCount,2);assert.equal(result.reconstruction.moves.at(-1).atMs,1234);
  V.validateReconstruction(result);assert.equal(a.accept('R',3000).accepted,false);
});
test('reset and solved-state rotations cannot produce an accidental record',()=>{
  const a=new V.Attempt();for(const move of ['x','R',"R'","x'"])assert.equal(a.accept(move,100).result,undefined);
  assert.equal(a.phase,'idle');a.prepare('R');assert.equal(a.accept("R'",100).result.rawMs,1);
  a.prepare('R U');a.accept("U'",300);a.prepare('');assert.equal(a.phase,'idle');assert.equal(a.result,null);
});
test('solved detection accepts any physical hold and does not depend on renderer frames',()=>{
  const a=new V.Attempt('R');a.accept('x',50);a.accept("R'",100);
  assert.equal(a.phase,'complete');assert.equal(a.result.reconstruction.moves.at(-1).move,"R'");V.validateReconstruction(a.result);
});
test('virtual CSV round trips complete metadata and regular CSV stays four-column compatible',()=>{
  const a=new V.Attempt('R U');a.accept("U'",100);const s={id:'a',date:'2026-10-27T10:00:00.000Z',...a.accept("R'",1250).result};
  const csv=C.exportCSV([s]),read=C.parseCSV(csv).solves[0];assert.match(csv,/Date,Source,Reconstruction/);assert.deepEqual(read.reconstruction,s.reconstruction);assert.equal(read.rawMs,1150);V.validateReconstruction(read);
  const dnf=C.parseCSV(C.exportCSV([{...s,penalty:'DNF'}])).solves[0];assert.equal(dnf.rawMs,1150);assert.equal(dnf.penalty,'DNF');V.validateReconstruction(dnf);
  assert.equal(C.exportCSV([{id:'physical',rawMs:10000,penalty:'',scramble:'R',date:null}]).split('\r\n')[0],'Index,Time,Scramble,Date');
});
test('malformed or unsolved reconstructions reject the complete import/save',()=>{
  const a=new V.Attempt('R');const s=a.accept("R'",100).result;
  assert.throws(()=>V.validateReconstruction({...s,reconstruction:{...s.reconstruction,moves:[{move:'U',atMs:0}]}}),/does not solve/);
  assert.throws(()=>V.validateReconstruction({...s,reconstruction:{...s.reconstruction,moves:[{move:"R'",atMs:-1}]}}),/Invalid/);
});
test('an attempt can start held in a chosen orientation, recorded so the replay stays valid',()=>{
  const a=new V.Attempt('R U','x2');
  assert.equal(a.orientation,'x2');assert.equal(a.phase,'inspection');
  assert.deepEqual(a.cube.stickers,new C.Cube().apply('R U').apply('x2').stickers,'scramble first, then the whole-cube turn');
  a.accept('x2',0);a.accept("U'",500);const s={id:'o',date:'2026-10-28T10:00:00.000Z',...a.accept("R'",1500).result};
  assert.equal(s.reconstruction.orientation,'x2');V.validateReconstruction(s);
  assert.throws(()=>V.validateReconstruction({...s,reconstruction:{...s.reconstruction,orientation:undefined}}),/does not solve/);
  assert.throws(()=>V.validateReconstruction({...s,reconstruction:{...s.reconstruction,orientation:'R'}}),/Invalid orientation/);
});
test('the default orientation leaves stored reconstructions byte-for-byte unchanged',()=>{
  const a=new V.Attempt('R','');const r=a.accept("R'",100).result;
  assert.equal(Object.hasOwn(r.reconstruction,'orientation'),false);
  a.prepare('R');assert.throws(()=>a.prepare('R','U'),/Invalid orientation/);
});
