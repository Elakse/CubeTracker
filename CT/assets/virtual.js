/* Category capabilities and virtual attempts, shared by browser and saver. */
(function(root){
  'use strict';
  const C = typeof module !== 'undefined' ? require('./core.js') : root.CT;
  const TYPES = { physical:{label:'Physical',virtual:false}, virtual:{label:'Virtual',virtual:true} };
  const typeOf = category => category?.type || 'physical';
  const isVirtual = category => typeOf(category) === 'virtual';
  const solved = cube => Object.values(cube.facelets()).every(face => face.every(color => color === face[0]));
  // Whole-cube turns only: the way the cube is held once the scramble is on it.
  const orientationOf = value => {
    const moves = C.tokens(value || '');
    if (moves.some(move => !/^[xyz]/.test(move) || moves.length > 4)) throw new Error('Invalid orientation.');
    return moves.join(' ');
  };
  const cloneCube = cube => {const copy=new C.Cube();copy.stickers=structuredClone(cube.stickers);return copy;};
  function initialize(state, id) {
    if (state.categoryTypesVersion >= 1) return false;
    state.archivedCategories ||= [];
    if (![...state.categories,...state.archivedCategories].some(c=>isVirtual(c)&&c.puzzle==='3x3'))
      state.categories.push({id:id(),name:'3x3 Virtual',type:'virtual',puzzle:'3x3',solves:[]});
    state.categoryTypesVersion=1;
    return true;
  }
  class Attempt {
    constructor(scramble='', orientation='') {this.prepare(scramble, orientation);}
    prepare(scramble, orientation='') {
      this.scramble=C.tokens(scramble).join(' ');
      this.orientation=orientationOf(orientation);
      this.cube=new C.Cube().apply(this.scramble).apply(this.orientation);
      this.phase=solved(this.cube)?'idle':'inspection';
      this.started=null;this.elapsed=0;this.moves=[];this.inspectionCount=0;
      this.result=null;
    }
    accept(move, now) {
      const parsed=C.tokens(move);
      if(parsed.length!==1)throw new Error('One move is required.');
      if(this.phase==='complete')return {accepted:false};
      const rotation=/^[xyz]/.test(move), armed=this.phase!=='idle';
      if(this.phase==='inspection'&&!rotation){this.phase='running';this.started=now;}
      this.cube.move(move);
      if(!armed)return {accepted:true}; // Free movement after Reset never records.
      const atMs=this.phase==='running'?Math.max(this.elapsed,Math.round(now-this.started),0):0;
      this.elapsed=atMs;
      this.moves.push({move,atMs});
      if(this.phase==='inspection')this.inspectionCount++;
      if(this.phase==='running'&&solved(this.cube)){
        this.phase='complete';this.elapsed=Math.max(1,atMs);
        this.result={rawMs:this.elapsed,penalty:'',scramble:this.scramble,source:'virtual',
          reconstruction:{version:1,...(this.orientation?{orientation:this.orientation}:{}),inspectionCount:this.inspectionCount,moves:this.moves.map(m=>({...m}))}};
        return {accepted:true,result:this.result};
      }
      return {accepted:true};
    }
    time(now){return this.phase==='running'?Math.max(this.elapsed,Math.round(now-this.started)):this.elapsed;}
  }
  function validateReconstruction(solve) {
    const r=solve.reconstruction;
    if(r==null)return;
    if(r.version!==1||!Array.isArray(r.moves)||r.moves.length<1||r.moves.length>20000||!Number.isInteger(r.inspectionCount)||r.inspectionCount<0||r.inspectionCount>=r.moves.length)throw new Error('Invalid reconstruction.');
    let last=0;
    const cube=new C.Cube().apply(solve.scramble).apply(orientationOf(r.orientation));
    for(const [i,event]of r.moves.entries()){
      if(typeof event.move!=='string'||C.tokens(event.move).length!==1||!Number.isFinite(event.atMs)||event.atMs<last||event.atMs>86400000||event.atMs>solve.rawMs)throw new Error('Invalid reconstruction move.');
      if(i<r.inspectionCount&&(!/^[xyz]/.test(event.move)||event.atMs!==0))throw new Error('Invalid inspection rotation.');
      if(i===r.inspectionCount&&(/^[xyz]/.test(event.move)||event.atMs!==0))throw new Error('Invalid first timed move.');
      cube.move(event.move);last=event.atMs;
    }
    if(!solved(cube))throw new Error('Reconstruction does not solve the scramble.');
  }
  const api={TYPES,typeOf,isVirtual,solved,orientationOf,cloneCube,initialize,Attempt,validateReconstruction};
  root.CTVirtual=api;
  if(typeof module!=='undefined')module.exports=api;
})(globalThis);
