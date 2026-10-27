/* Rank-card materials: textures, a real-time PBR shader for the three "hard" tiers, and a living fire.
   Public API (window.CTRank):
     layers(tier)      markup for the decoration layers of a .rank-card (call before inserting it)
     mount(scope)      start the canvases (WebGL / fire) inside scope; safe to call repeatedly
     unmount(scope)    stop them and give the WebGL contexts back
     motionOff()       true when Settings → Reward animations is off or the OS asks for reduced motion
   Everything is pure decoration: no layout, no events. With motion off the canvases paint one still frame.
   Levels follow SPECIAL in timer-effects.js (1 = Sub 60 … 12 = Sub 5, 0 = not ranked yet).
   A level is not the same as a material: FRAME maps each level to the card design ("frame") that wears it,
   and every data-tier attribute, layers() call and CSS rule in this file speaks in frames. To reorder the
   ranks, edit FRAME only.
     frame(level)      the frame id for a level (use it for data-tier and layers) */
(function (root) {
  "use strict";
  const doc = root.document, docEl = doc?.documentElement, TAU = Math.PI * 2;
  const motionOff = () => docEl?.dataset.rewardMotion === "off" || Boolean(root.matchMedia?.("(prefers-reduced-motion:reduce)").matches);
  const fireOff = motionOff;
  /* canvases that belong to a removed card are released the next time their loop runs */
  function release(group, st) {
    group.list.delete(st); st.ro?.disconnect(); st.io?.disconnect();
    st.gl?.getExtension("WEBGL_lose_context")?.loseContext();
  }

  /* ── textures: generated once, handed to CSS as custom properties (--t-*, --facets, --crackle …) ── */
  let texturesDone = false;
  function textures() {
    if (texturesDone || !doc) return; texturesDone = true;
  const uri = svg => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  /* organic decay textures: fractal noise thresholded into soft blotches, tinted per material */
  const tex = (rgb, freq, k, c, seed, oct = 4, srgb = false) => uri(`<svg xmlns="http://www.w3.org/2000/svg" width="360" height="190"><filter id="f" x="0" y="0" width="100%" height="100%"${srgb ? ' color-interpolation-filters="sRGB"' : ""}><feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="${oct}" seed="${seed}"/><feColorMatrix values="0 0 0 0 ${rgb[0]} 0 0 0 0 ${rgb[1]} 0 0 0 0 ${rgb[2]} ${k} 0 0 0 ${c}"/></filter><rect width="360" height="190" filter="url(#f)"/></svg>`);
  const setv = (n, v) => docEl.style.setProperty(n, v);
  setv("--t-rust-big", tex([.62, .27, .09], ".011 .017", 7, -3.3, 4, 4, true)); setv("--t-rust-fine", tex([.45, .17, .05], ".09", 8, -4.2, 9, 3, true));
  setv("--t-verd-big", tex([.16, .62, .5], ".012 .018", 7, -3.2, 11, 4, true)); setv("--t-verd-fine", tex([.1, .45, .38], ".085", 8, -4.1, 5, 3, true));
  setv("--t-soot", tex([.05, .045, .04], ".014 .02", 7, -2.7, 3)); setv("--t-tarnish", tex([.2, .13, .04], ".016 .024", 6, -2.6, 8));
  setv("--t-frost", tex([.9, .94, 1], ".02 .03", 6, -3.1, 2));
  setv("--lock", uri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#8a9488" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/><path d="M12 15v2"/></svg>'));
  const crack = (core, glow, w1, w2) => uri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 140" preserveAspectRatio="none"><g fill="none" stroke-linejoin="round" stroke-linecap="round"><path d="M-5 40 L40 56 L70 38 L112 63 L150 50 L192 71 L240 53 L305 67 M112 63 L121 100 L150 119 L170 145 M192 71 L206 106 L240 121 L250 145 M40 56 L31 91 L52 145 M70 38 L86 -5 M240 53 L262 20 L271 -5 M150 119 L131 145" stroke="${glow}" stroke-width="${w1}" opacity=".35"/><path d="M-5 40 L40 56 L70 38 L112 63 L150 50 L192 71 L240 53 L305 67 M112 63 L121 100 L150 119 L170 145 M192 71 L206 106 L240 121 L250 145 M40 56 L31 91 L52 145 M70 38 L86 -5 M240 53 L262 20 L271 -5 M150 119 L131 145" stroke="${core}" stroke-width="${w2}"/></g></svg>`);
  setv("--crack-hot", crack("#ffb15a", "#ff6a10", 5, 1.5)); setv("--crack-cold", crack("#6b4a3c", "#3a2218", 4, 1.2)); setv("--crack-ice", crack("rgba(235,240,255,.85)", "rgba(180,200,255,.5)", 3.5, .9));
  { let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647, cols = 5, rows = 3, pt = [];
    for (let j = 0; j <= rows; j++) { pt.push([]); for (let i = 0; i <= cols; i++) pt[j].push([i / cols * 300 + (i && i < cols ? (r() - .5) * 34 : 0), j / rows * 140 + (j && j < rows ? (r() - .5) * 26 : 0)]); }
    let polys = ""; for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const a = pt[j][i], b = pt[j][i + 1], c = pt[j + 1][i + 1], d = pt[j + 1][i], flip = (i + j) % 2;
      for (const tri of flip ? [[a, b, d], [b, c, d]] : [[a, b, c], [a, c, d]]) { const light = r() > .5, o = (.04 + r() * .16).toFixed(2); polys += `<polygon points="${tri.map(p => p.map(n => n.toFixed(1)).join(",")).join(" ")}" fill="${light ? "#fff" : "#00103a"}" fill-opacity="${o}" stroke="rgba(190,215,255,.3)" stroke-width=".6"/>`; } }
    setv("--facets", uri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 140" preserveAspectRatio="none">${polys}</svg>`)); }


  /* lava net: seeded fissures that start on the left edge and run to the right edge, branch toward top and bottom, and thin out instead of stopping */
  const lavaNet = (seed) => { let s = seed; const r = () => (s = (s * 16807) % 2147483647) / 2147483647, lines = [];
    const walk = (x, y, a, depth, mainRun) => { const pts = [[x, y]]; let n = 0, max = mainRun ? 60 : 2 + Math.floor(r() * 4);
      while (n++ < max) { a += (r() - .5) * (mainRun ? .5 : .8); if (mainRun) a *= .8; const st = 18 + r() * 20; x += Math.cos(a) * st; y += Math.sin(a) * st * .85; pts.push([x, y]);
        if (depth < 2 && r() < (mainRun ? .2 : .1)) walk(x, y, a + (r() < .5 ? -1 : 1) * (.75 + r() * .55), depth + 1, false);
        if (x > 308 || y < -8 || y > 148) break; }
      lines.push({ pts, depth }); };
    [30, 78, 122].forEach(y0 => walk(-6, y0 + (r() - .5) * 14, (r() - .5) * .3, 0, true));
    [70, 200].forEach(x0 => { walk(x0 + r() * 30, -6, 1.2 + r() * .6, 1, false); walk(x0 + 40 + r() * 30, 146, -1.2 - r() * .6, 1, false); });
    return lines; };
  const lavaSvg = (layers, bg = "") => { const lines = lavaNet(23); const body = layers.map(([col, w, o]) => `<g fill="none" stroke-linecap="round" stroke-linejoin="round" stroke="${col}" opacity="${o}">${lines.map(l => `<path d="M${l.pts.map(p => p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" L")}" stroke-width="${(w * [1, .62, .38][l.depth]).toFixed(2)}"/>`).join("")}</g>`).join(""); return uri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 140" preserveAspectRatio="none">${bg}${body}</svg>`); };
  setv("--lava-hot", lavaSvg([["#ff4a0a", 11, .28], ["#ff7a1c", 5.5, .85], ["#ffd070", 2.8, 1], ["#fff4c8", 1.1, .95]]));
  setv("--lava-core", lavaSvg([["#000", 3.4, 1]]));
  setv("--lava-cold", lavaSvg([["#2a1a14", 4.5, .9], ["#5a3f33", 1.6, .9], ["#8b4a22", .7, .6]]));
  setv("--t-basalt", tex([.2, .1, .055], ".07 .11", 1.4, -.5, 14, 4));

  /* forged iron: long dark grain streaks plus a faint light scale, like a hot-worked bar */
  setv("--hammer", tex([0, 0, 0], ".006 .2", 2.4, -.85, 5, 3, true));
  /* peeling gilding: noise cut to hard edges, allowed only toward the borders, filled with dark red clay */
  setv("--t-peel", uri(`<svg xmlns="http://www.w3.org/2000/svg" width="360" height="190"><defs><radialGradient id="g" cx=".5" cy=".5" r=".8"><stop offset=".36" stop-color="#fff" stop-opacity="0"/><stop offset=".92" stop-color="#fff" stop-opacity="1"/></radialGradient><filter id="f" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency=".022 .034" numOctaves="4" seed="9" result="n"/><feColorMatrix in="n" values="0 0 0 0 .35 0 0 0 0 .13 0 0 0 0 .1 14 0 0 0 -5.9" result="p"/><feComposite in="p" in2="SourceGraphic" operator="in"/></filter></defs><rect width="360" height="190" fill="url(#g)" filter="url(#f)"/></svg>`));

  setv("--t-dust", tex([.72, .7, .68], ".03 .05", 1.5, -.45, 21, 3, true));

  /* ── texture builders ── */
  const rng = seed => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
  const XMLNS = 'xmlns="http://www.w3.org/2000/svg"';
  /* gold: dried gilding. A fine web of craquelure, dirt settled in every crack, and a few flakes that have fallen out */
  { const r = rng(77), cols = 36, rows = 16, W = 460, H = 200, P = []; for (let j = 0; j <= rows; j++) { P.push([]); for (let i = 0; i <= cols; i++) P[j].push([i / cols * W + (i && i < cols ? (r() - .5) * 5 : 0), j / rows * H + (j && j < rows ? (r() - .5) * 4.5 : 0)]); }
    const lost = new Set(); while (lost.size < 5) lost.add(Math.floor(r() * cols) + "," + Math.floor(r() * rows)); let cells = "", lines = "";
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const [a, b, c, d] = [P[j][i], P[j][i + 1], P[j + 1][i + 1], P[j + 1][i]], pts = [a, b, c, d].map(p => p.map(v => v.toFixed(1)).join(",")).join(" "), gone = lost.has(i + "," + j), tint = r();
      cells += gone ? `<polygon points="${pts}" fill="#7a4d10" fill-opacity=".85"/><polygon points="${pts}" fill="none" stroke="#fff0b8" stroke-opacity=".55" stroke-width=".8" transform="translate(-.8,-.8)"/>` : `<polygon points="${pts}" fill="${tint > .5 ? "#fff3c4" : "#5a3a08"}" fill-opacity="${(.015 + tint * .07).toFixed(3)}"/>`;
      lines += `M${a[0].toFixed(1)} ${a[1].toFixed(1)} L${b[0].toFixed(1)} ${b[1].toFixed(1)} L${c[0].toFixed(1)} ${c[1].toFixed(1)} `; }
    setv("--crackle", uri(`<svg ${XMLNS} viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${cells}<path d="${lines}" fill="none" stroke="#4a2c08" stroke-opacity=".5" stroke-width=".7" stroke-linejoin="round"/><path d="${lines}" fill="none" stroke="#fff0b8" stroke-opacity=".22" stroke-width=".5" transform="translate(.5,.5)"/></svg>`)); }
  /* rain: seamless tiles of slanted streaks. The tile slides by exactly one period along the slant, so the loop never jumps */
  const rainTile = (w, h, n, l0, l1, a0, a1, seed) => { const r = rng(seed), k = w / h; let s = ""; for (let i = 0; i < n; i++) { const x = 8 + r() * (w - 16), y = r() * (h - l1), l = l0 + r() * (l1 - l0); s += `<path d="M${x.toFixed(1)} ${y.toFixed(1)} l${(-l * k).toFixed(1)} ${l.toFixed(1)}" stroke="#e4eefa" stroke-opacity="${(a0 + r() * (a1 - a0)).toFixed(2)}" stroke-width="${(.7 + r() * .5).toFixed(2)}" stroke-linecap="round"/>`; } return uri(`<svg ${XMLNS} viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${s}</svg>`); };
  setv("--rain-near", rainTile(90, 464, 26, 14, 30, .25, .6, 3)); setv("--rain-far", rainTile(60, 309, 24, 8, 17, .12, .32, 8));
  /* crystal, neglected: a fingerprint smudged across the glass */
  { const r = rng(13);
    setv("--fp", uri(`<svg ${XMLNS} viewBox="0 0 90 110"><g fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round">${Array.from({ length: 11 }, (_, i) => `<ellipse cx="45" cy="56" rx="${6 + i * 3.4}" ry="${8 + i * 4.3}" stroke-dasharray="${(8 + r() * 14).toFixed(0)} ${(2 + r() * 5).toFixed(0)}" stroke-dashoffset="${(r() * 30).toFixed(0)}" stroke-opacity="${(.9 - i * .05).toFixed(2)}"/>`).join("")}</g></svg>`)); }
  }

  /* ── real-time PBR ── */
  const PBR = { list: new Set(), raf: 0, last: 0, at: null, STILL: 2.46 };
  const PBR_MAT = { 7: 0, 4: 1, 3: 2 };
  const PBR_VS = "attribute vec2 a;varying vec2 vUv;void main(){vUv=a*.5+.5;gl_Position=vec4(a,0.,1.);}";
  const PBR_FS = `precision highp float;varying vec2 vUv;uniform vec2 uRes,uCss;uniform float uT,uMat,uRust;
  const float PI=3.14159265,M=17.,RAD=13.;
  vec2 h22(vec2 p){p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3)));return fract(sin(p)*43758.5453);}
  float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h22(i).x,h22(i+vec2(1,0)).x,f.x),mix(h22(i+vec2(0,1)).x,h22(i+vec2(1,1)).x,f.x),f.y);}
  float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<4;i++){s+=a*vn(p);p=p*2.03+vec2(7.1,3.7);a*=.5;}return s;}
  float sdCard(vec2 cp){vec2 q=abs(cp-uCss*.5)-uCss*.5+RAD;return length(max(q,0.))+min(max(q.x,q.y),0.)-RAD;}
  vec2 boltAt(int i){vec2 s=vec2(mod(float(i),2.),floor(float(i)/2.));return vec2(mix(M,uCss.x-M,s.x),mix(M,uCss.y-M,s.y));}

  /* obsidian: broad conchoidal scars, each a shallow bowl with ripples, domain-warped so the ridges curve.
     Heights are blended between neighbouring scars (weight falls off with distance, KS sets how tightly),
     so there is no sharp seam between them for the light to catch as a thin bright line. */
  #define KS 16.
  float scars(vec2 p,float seed,float ripAmp){
    vec2 i=floor(p),f=fract(p);float ws=0.,hs=0.;
    for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
      vec2 g=vec2(float(x),float(y)),id=i+g+seed,o=h22(id),l=f-(g+o);float dist=length(l);
      vec2 t=(h22(id+11.3)-.5)*.95,imp=normalize(h22(id+5.1)-.5+1e-3)*.5;float rr=length(l-imp);
      float hh=dot(t,l)-.3*dot(l,l)+ripAmp*sin(rr*22.+o.y*6.28)*exp(-rr*2.)+(h22(id+3.7).x-.5)*.02;
      float w=exp(-dist*KS);ws+=w;hs+=w*hh;
    }
    return hs/ws;
  }
  float hObs(vec2 cp){
    vec2 p=cp/uCss*vec2(2.6,1.13);
    vec2 q=p+.75*vec2(fbm(p*.8),fbm(p*.8+9.));
    float c=cos(.55),s=sin(.55);vec2 r=mat2(c,-s,s,c)*q*vec2(1.,1.8);
    float a=scars(r,0.,.0016),b=scars(q*1.55+17.,31.,.0008)*.5;
    return mix(a,b,smoothstep(.5,.64,fbm(q*.7+4.)))*uCss.x/2.6;
  }

  /* metal plate: slow oil-canning, a rolled edge, domed rivets (bronze) or hex bolts with washers (steel) */
  float hPlate(vec2 cp){
    vec2 u=cp/vec2(190.,150.);
    float und=(fbm(u+vec2(3.,7.))-.5)*8.+(vn(u*2.1+vec2(11.,2.))-.5)*2.5;
    float ed=-sdCard(cp),t=1.-smoothstep(0.,5.5,ed);
    return und-t*t*3.4;
  }
  float bolts(vec2 cp,out float ao,out float msk,out float hole){
    float h=0.;ao=1.;msk=0.;hole=0.;
    for(int i=0;i<4;i++){
      vec2 d=cp-boltAt(i);float l=length(d);
      if(i==3&&uMat>1.5&&uRust>.5){
        float hl=smoothstep(7.4,5.6,l);h-=2.6*hl;hole=max(hole,hl);ao*=1.-.55*smoothstep(8.5,5.5,l)*(1.-hl);
      }else if(uMat<1.5){
        vec2 q=abs(d);float hx=max(q.x*.866+q.y*.5,q.y);
        float head=smoothstep(5.6,4.1,hx),wash=smoothstep(8.8,7.7,l);
        h+=head*(2.9+.7*(1.-l/7.))+wash*1.0;msk=max(msk,smoothstep(9.5,6.,l));
        ao*=1.-.5*exp(-max(l-6.,0.)/2.2)*(1.-head);
      }else{
        float r=6.5,q=l/r,dome=q<1.?1.-q*q:0.;
        h+=dome*3.4+smoothstep(r*1.55,r*1.35,l)*.8;msk=max(msk,smoothstep(9.5,6.,l));
        ao*=1.-.5*exp(-max(l-r,0.)/2.4)*(1.-smoothstep(r*.98,r,l));
      }
    }
    return h;
  }

  /* corrosion: pools at the edges and bolts, runs down from every bolt, ragged where it meets clean metal */
  float gThr;
  float rustCov(vec2 cp,out float halo){
    float ed=-sdCard(cp);
    float n=fbm(cp/52.+vec2(1.,5.)),n2=fbm(cp/12.+vec2(8.,2.));
    float bd=999.,st=0.;
    for(int i=0;i<4;i++){
      vec2 b=boltAt(i);float d=length(cp-b);bd=min(bd,d);
      float dy=cp.y-b.y,dx=cp.x-b.x+(n2-.5)*8.+(n-.5)*10.;
      float w=2.2+2.6*vn(vec2(float(i)*3.1,cp.y*.04));
      float len=38.+34.*fract(float(i)*.37+.2);
      st=max(st,exp(-dx*dx/(2.*w*w))*smoothstep(3.,10.,dy)*exp(-max(dy,0.)/len)*(.5+.5*vn(vec2(cp.y*.12,float(i)*7.))));
    }
    float pot=.8*exp(-ed/11.)+.85*exp(-bd/17.),nn=smoothstep(.3,.7,n);
    float v=pot*(.25+1.2*nn)+st*1.15+(n2-.5)*.45-gThr;
    halo=smoothstep(0.,.7,pot*(.3+.9*n)*1.6+st*.7+(n2-.5)*.1);
    return smoothstep(0.,.16,v);
  }
  float grit(vec2 cp,float s){return .5*vn(cp/s)+.5*vn(mat2(.8,.6,-.6,.8)*cp/(s*.7)+5.);}
  float relief(vec2 cp,float c){return c*(2.+1.2*grit(cp,3.8)+2.*grit(cp+9.,8.));}

  /* the studio */
  float rect(vec2 d,vec2 hs,float soft){vec2 q=(abs(d)-hs)/soft;return (1.-smoothstep(-1.,1.,q.x))*(1.-smoothstep(-1.,1.,q.y));}
  vec3 skyB,skyT,bxC,stC,sdC;float bxI,bxW,bxH,bxY,stI,stY,sdI,sdX,coreI,box2I,swp,swp2,gT;
  vec3 envOne(vec3 R,float rough){
    float sf=.035+rough*rough*1.6+rough*.12;
    vec2 r=R.xy;
    vec3 c=mix(skyB,skyT,smoothstep(-.9,.9,r.y));
    vec2 d=vec2(r.x-swp-.28*(r.y-bxY),r.y-bxY);
    float rdz=(uMat>.5&&uMat<1.5)?mix(.5,1.,smoothstep(.2,.75,vUv.x)):1.;
    c+=bxC*rdz*(rect(d,vec2(bxW,bxH),sf)*bxI+rect(d,vec2(bxW*.38,bxH*.8),sf*.7)*coreI);
    c+=stC*stI*rect(vec2(r.x,r.y-stY),vec2(1.6,.05),sf*.8);
    c+=sdC*sdI*rect(vec2(r.x-sdX,r.y),vec2(.16,.7),sf);
    vec2 d2=vec2(r.x-swp2+.2*(r.y-bxY),r.y-bxY);
    c+=bxC*box2I*rect(d2,vec2(bxW*.8,bxH),sf);
    return c;
  }
  vec3 envA(vec3 R,float rough,vec2 dir,float spr){
    vec3 s=vec3(0.);float w=0.;
    for(int i=-3;i<=3;i++){float k=float(i)/3.,wt=exp(-k*k*1.6);s+=envOne(vec3(R.xy+dir*k*spr,R.z),rough)*wt;w+=wt;}
    return s/w;
  }

  void main(){
    vec2 cp=vec2(vUv.x,1.-vUv.y)*uCss;
    gT=uT;
    float per=6.4,trav=.9,k=clamp(fract(uT/per)/trav,0.,1.),k2=clamp(fract(uT/per+.5)/trav,0.,1.);swp=mix(-2.4,2.4,k);swp2=mix(2.4,-2.4,k2);

    /* material tables */
    vec3 F0;float rough,tilt=1.,spr=0.,tone;vec2 adir=vec2(0.);vec3 alb=vec3(0.);
    bxY=0.;stY=.6;sdX=.88;sdI=0.;box2I=0.;coreI=0.;
    if(uMat<.5){
      F0=vec3(mix(.05,.03,uRust));rough=mix(.17,.85,uRust);tilt=1.15;tone=2.4;
      alb=mix(vec3(.016,.017,.022),vec3(.034,.034,.037),uRust);
      skyB=vec3(.02,.022,.03);skyT=vec3(.13,.14,.18);bxC=vec3(1.,1.02,1.08);stC=vec3(.8,.9,1.);sdC=vec3(1.,.85,.7);
      bxI=mix(6.,2.,uRust);coreI=mix(9.,1.,uRust);bxW=.2;bxH=.9;stI=mix(3.5,.4,uRust);sdI=mix(2.5,.3,uRust);box2I=mix(3.,.5,uRust);
    }else if(uMat<1.5){
      F0=vec3(.58,.60,.64);rough=.28;adir=vec2(0.,1.);spr=.28;tone=1.;
      skyB=vec3(.26,.29,.34);skyT=vec3(.6,.67,.78);bxC=vec3(1.,1.,1.06);stC=vec3(.9,.96,1.);sdC=vec3(.6,.78,1.);
      bxI=1.9;coreI=1.1;bxW=.17;bxH=.95;stI=1.8;sdI=.9;box2I=.35;
      if(uRust>.5){F0*=.72;rough=.42;skyB*=.8;skyT*=.8;bxI=1.9;coreI=.6;gThr=.33;}
    }else{
      F0=vec3(.93,.6,.32);rough=.34;adir=vec2(1.,0.);spr=.3;tone=1.;
      skyB=vec3(.52,.5,.46);skyT=vec3(1.,.97,.9);bxC=vec3(1.,.95,.82);stC=vec3(1.,.93,.8);sdC=vec3(1.,.7,.4);
      bxI=1.9;coreI=1.2;bxW=.17;bxH=.95;stI=1.3;sdI=.8;box2I=.3;
      if(uRust>.5){F0*=vec3(.58,.52,.46);rough=.46;skyB*=.8;skyT*=.8;bxI=1.2;coreI=.4;gThr=.46;}
    }

    /* heights */
    float e=1.1,ao=1.,msk=0.,hole=0.,aoD,mD,hD,halo=0.,cov=0.,cx=0.,cy=0.,dum;
    float h0,hx,hy;
    if(uMat<.5){h0=hObs(cp);hx=hObs(cp+vec2(e,0.));hy=hObs(cp+vec2(0.,e));}
    else{
      h0=hPlate(cp)+bolts(cp,ao,msk,hole);
      hx=hPlate(cp+vec2(e,0.))+bolts(cp+vec2(e,0.),aoD,mD,hD);
      hy=hPlate(cp+vec2(0.,e))+bolts(cp+vec2(0.,e),aoD,mD,hD);
      if(uRust>.5){
        float mx=mD;
        cov=rustCov(cp,halo)*(1.-.5*msk);
        cx=rustCov(cp+vec2(e,0.),dum)*(1.-.5*mx);
        cy=rustCov(cp+vec2(0.,e),dum)*(1.-.5*mx);
        h0+=relief(cp,cov);hx+=relief(cp+vec2(e,0.),cx);hy+=relief(cp+vec2(0.,e),cy);
      }
    }
    float gx=(hx-h0)/e,gy=(hy-h0)/e;

    /* brushed grain: streaks along the brushing direction nudge the normal and the reflectance */
    float grain=.5;
    if(uMat>.5){
      vec2 q=uMat<1.5?cp:cp.yx;
      grain=vn(vec2(q.x*.012,q.y*.7))*.5+vn(vec2(q.x*.04,q.y*1.5+7.))*.3+vn(vec2(q.x*.1,q.y*2.4+3.))*.2;
      float jig=(grain-.5)*.06*(1.-cov);
      if(uMat<1.5)gy+=jig;else gx+=jig;
    }
    vec3 N=normalize(vec3(-gx*tilt,gy*tilt,1.));
    vec3 V=normalize(vec3(-(vUv-.5)*vec2(1.3,.7),1.));
    vec3 R=reflect(-V,N);
    float NdV=max(dot(N,V),1e-3);

    vec3 col;
    if(uMat<.5){
      vec2 p=cp/uCss*vec2(2.6,1.13);
      float rr=rough*(.78+.45*fbm(p*7.));
      vec3 Lk=normalize(vec3(-.5,.5,.62));float NdL=max(dot(N,Lk),0.);
      vec3 Fr=F0+(1.-F0)*pow(1.-NdV,5.);
      col=alb*(NdL*.9+.25)+vec3(.02,.012,.006)*smoothstep(.55,.85,fbm(p*2.2+3.))*(1.-uRust)+Fr*envA(R,rr,adir,spr)*(1.-.5*uRust);
      col=mix(col,vec3(.3,.29,.28),uRust*.5*smoothstep(.45,.75,fbm(p*3.+9.))*.35);
      col=1.-exp(-col*tone);
    }else{
      float n2=fbm(cp/9.+13.),pit=grit(cp,3.4);
      /* the metal under everything: grain varies reflectance, the stain halo dulls and warms it */
      F0*=.78+.44*grain;
      if(uRust>.5){
        float hl=halo*(1.-cov);
        if(uMat<1.5)F0=mix(F0,F0*vec3(.8,.62,.5),hl*.8);else F0=mix(F0,vec3(.3,.2,.12)*(.8+.4*n2),hl*.7);
        vec3 rc;
        if(uMat<1.5){
          rc=mix(vec3(.16,.065,.032),vec3(.52,.23,.08),smoothstep(.22,.72,n2*.75+pit*.5));
          rc=mix(rc,vec3(.74,.4,.14),smoothstep(.7,.95,n2+pit*.3)*.5);
        }else{
          rc=mix(vec3(.04,.115,.095),vec3(.14,.36,.31),smoothstep(.2,.65,n2*.8+pit*.3));
          rc=mix(rc,vec3(.5,.7,.62),smoothstep(.62,.92,n2*.8+pit*.5)*.6);
        }
        rc*=.62+.5*pit;
        F0=mix(F0,vec3(.045),cov);rough=mix(rough,.86,cov);alb=rc*cov;spr*=1.-cov;
      }
      vec3 Fr=F0+(1.-F0)*pow(1.-NdV,5.);
      vec3 Lk=normalize(vec3(-.4,.5,.75));
      vec3 irr=envOne(N,1.)*.5+vec3(.9,.85,.8)*max(dot(N,Lk),0.)*.45;
      col=Fr*envA(R,rough,adir,spr)+alb*irr;
      float ed=-sdCard(cp);
      col*=ao*mix(.76,1.,smoothstep(0.,15.,ed));
      col=mix(col,vec3(.02,.012,.008),hole);
      /* soft-knee tone map: neutral below the knee, highlights roll off towards a creamy white */
      float kn=uMat<1.5?.46:.62;vec3 m=max(col-kn,0.);col=col-m+m/(1.+m*(uMat<1.5?2.8:1.7));
    }
    gl_FragColor=vec4(clamp(col,0.,1.),1.);
  }`;
  function pbrSetup(cv) {
    const card = cv.closest(".rank-card"), mat = PBR_MAT[card.dataset.tier], rusty = card.classList.contains("is-rusty");
    const gl = cv.getContext("webgl", { antialias: false, alpha: false }); if (!gl) return;  /* no WebGL: the CSS gradient on the card is the fallback */
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s)); return s; }, pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, PBR_VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, PBR_FS)); gl.linkProgram(pr); gl.useProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return;
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, "a"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const u = n => gl.getUniformLocation(pr, n), st = { cv, gl, uT: u("uT"), uRes: u("uRes"), uCss: u("uCss"), t0: rand(0, 6), vis: true, still: false };
    gl.uniform1f(u("uMat"), mat); gl.uniform1f(u("uRust"), rusty ? 1 : 0);
    st.draw = t => { gl.uniform1f(st.uT, (PBR.at ?? (fireOff() ? PBR.STILL : st.t0 + t)) % 6.4); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); };
    /* supersampled: the canvas is rendered at 2–3× and the browser filters it down, which is what keeps facet edges and grain smooth */
    const fit = () => { const b = cv.getBoundingClientRect(); if (!b.width) return; const d = Math.max(1, Math.min(3, Math.max(2, (devicePixelRatio || 1) * 1.5), Math.sqrt(1.7e6 / (b.width * b.height))));
      cv.width = Math.round(b.width * d); cv.height = Math.round(b.height * d); gl.viewport(0, 0, cv.width, cv.height); gl.uniform2f(st.uRes, cv.width, cv.height); gl.uniform2f(st.uCss, b.width, b.height); st.draw(0); };
    st.ro = new ResizeObserver(fit); st.ro.observe(cv); st.io = new IntersectionObserver(e => { st.vis = e[0].isIntersecting; }); st.io.observe(cv); fit(); PBR.list.add(st); if (!PBR.raf) PBR.raf = requestAnimationFrame(pbrLoop);
  }
  function pbrLoop(now) {
    const off = fireOff();
    if (now - PBR.last > 32 && !document.hidden) { PBR.last = now; PBR.list.forEach(st => {
      if (!st.cv.isConnected) release(PBR, st);
      else if (st.vis && (!off || !st.still || PBR.at != null)) { st.draw(now / 1000); st.still = off; } else if (!off) st.still = false; }); }
    PBR.raf = PBR.list.size ? requestAnimationFrame(pbrLoop) : 0;   /* idle when no card is on screen */
  }

  /* ── fire ── */
  const FIRE = { list: new Set(), raf: 0, last: 0 };
  function fireSetup(cv, rusty) {
    const ctx = cv.getContext("2d"), st = { cv, ctx, rusty, p: [], W: 0, H: 0, t: 0, acc: 0, flare: rand(1.5, 3), boost: 0, fx: .5, seed: Math.random() * 99 };
    const fit = () => { const b = cv.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1); st.W = b.width; st.H = b.height; cv.width = Math.max(1, Math.round(b.width * d)); cv.height = Math.max(1, Math.round(b.height * d)); ctx.setTransform(d, 0, 0, d, 0, 0); };
    st.ro = new ResizeObserver(fit); st.ro.observe(cv); fit(); FIRE.list.add(st); for (let i = 0; i < 160; i++) fireStep(st, 1 / 40, false); fireDraw(st); if (!FIRE.raf) FIRE.raf = requestAnimationFrame(fireLoop);
  }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function fireStep(st, dt) {
    const { W, H } = st, sc = H / 215 || 1; st.t += dt; const t = st.t;
    if (!W) return;
    if (!st.rusty) {
      st.fa = (st.fa || 0) + dt * 560; while (st.fa > 1) { st.fa--; const x = rand(0, W); if (Math.random() > .5 + .5 * nz(x / W * 9 + t * 1.4)) continue; st.p.push({ x, y: H + 3 * sc, vx: rand(-8, 8), vy: -rand(70, 130) * sc, s: rand(9, 17) * sc, age: 0, life: rand(.55, 1), k: Math.random() * 9, kind: 3 }); }
      if (st.boost > .04) { st.fb = (st.fb || 0) + dt * 320 * st.boost; while (st.fb > 1) { st.fb--; st.p.push({ x: st.fx * W + rand(-.12, .12) * W, y: H + 3 * sc, vx: rand(-14, 14), vy: -rand(95, 160) * sc, s: rand(11, 20) * sc, age: 0, life: rand(.7, 1.2), k: Math.random() * 9, kind: 3 }); } }
      st.acc += dt * 46; while (st.acc > 1) { st.acc--; const big = Math.random() < .08; st.p.push({ x: rand(0, W), y: H - rand(0, 8) * sc, vx: rand(-14, 14), vy: -rand(big ? 24 : 46, big ? 60 : 130) * sc, s: big ? rand(2.4, 3.6) : rand(.8, 2), age: 0, life: big ? rand(2.8, 4.4) : rand(1.2, 3), k: Math.random() * 9, kind: 0 }); }
      st.flare -= dt; if (st.flare < 0) { st.flare = rand(2.4, 5); st.boost = 1; const x0 = rand(W * .1, W * .9); st.fx = x0 / W; for (let i = 0; i < 30; i++) st.p.push({ x: x0 + rand(-30, 30) * sc, y: H - rand(0, 10) * sc, vx: rand(-70, 70) * sc, vy: -rand(150, 360) * sc, s: rand(.9, 2.2), age: 0, life: rand(1.1, 2.4), k: Math.random() * 9, kind: 1 }); }
      st.boost *= Math.exp(-dt * 1.6);
    } else {
      st.acc += dt * 7; while (st.acc > 1) { st.acc--; const src = Math.random() < .7 ? (Math.random() < .5 ? .24 : .71) * W + rand(-14, 14) * sc : rand(0, W); st.p.push({ x: src, y: H - rand(0, 6) * sc, vx: rand(-4, 4), vy: -rand(14, 30) * sc, s: rand(9, 15) * sc, age: 0, life: rand(3.4, 5.8), k: Math.random() * 9, kind: 2 }); }
      if (Math.random() < dt * .6) st.p.push({ x: (Math.random() < .5 ? .24 : .71) * W + rand(-8, 8), y: H - 5 * sc, vx: rand(-20, 20), vy: -rand(40, 90) * sc, s: rand(.7, 1.3), age: 0, life: rand(.5, 1.1), k: Math.random() * 9, kind: 0 });
    }
    for (const q of st.p) { q.age += dt; if (q.kind === 2) { q.vx += Math.sin(t * .9 + q.k + q.y * .02) * 9 * dt; q.s += dt * 9 * sc; q.y += q.vy * dt; q.x += q.vx * dt; } else { q.vx += Math.sin(q.y * .035 / sc + t * 1.7 + q.k) * 90 * dt * sc; q.vx *= Math.exp(-.7 * dt); if (q.kind === 1) q.vy += 150 * sc * dt; else q.vy -= 10 * sc * dt; q.x += q.vx * dt; q.y += q.vy * dt; } }
    st.p = st.p.filter(q => q.age < q.life && q.y > -20);
  }
  const nz = x => (Math.sin(x) + .5 * Math.sin(2.3 * x + 1.7) + .25 * Math.sin(5.1 * x + .4)) / 1.75;
  const hash = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  function fireDraw(st) {
    const { ctx: c, W, H } = st, t = st.t, sc = H / 215 || 1; c.clearRect(0, 0, W, H); if (!W) return;
    if (!st.rusty) {
      c.globalCompositeOperation = "lighter";
      const sp = FIRE.sprites || (FIRE.sprites = Array.from({ length: 16 }, (_, n) => { const h = n / 15, col = h > .9 ? [255, 232, 160] : h > .58 ? [255, 168, 40] : h > .32 ? [255, 92, 14] : [190, 28, 6], s = document.createElement("canvas"); s.width = s.height = 48; const x = s.getContext("2d"), g = x.createRadialGradient(24, 24, 0, 24, 24, 24); g.addColorStop(0, `rgba(${col},1)`); g.addColorStop(.35, `rgba(${col},.75)`); g.addColorStop(1, `rgba(${col},0)`); x.fillStyle = g; x.fillRect(0, 0, 48, 48); return s; }));
      for (const q of st.p) if (q.kind === 3) { const heat = 1 - q.age / q.life, r = q.s * (.3 + .7 * Math.pow(heat, .8)); c.globalAlpha = Math.min(1, heat * 1.8) * .6; c.drawImage(sp[Math.max(0, Math.min(15, heat * 15 | 0))], q.x - r * .8, q.y - r * 1.5, r * 1.6, r * 3); }
      c.globalAlpha = 1;
      for (const q of st.p) { if (q.kind === 3) continue; const heat = 1 - q.age / q.life, h2 = Math.pow(heat, 1.1), fl = .65 + .35 * Math.sin(t * 16 + q.k * 7), a = Math.min(1, heat * 1.6) * fl, g = Math.round(60 + 175 * h2), b = Math.round(18 + 150 * h2 * h2);
        if (q.kind === 1) { c.strokeStyle = `rgba(255,${g},${b},${a})`; c.lineWidth = q.s * .8; c.lineCap = "round"; c.beginPath(); c.moveTo(q.x, q.y); c.lineTo(q.x - q.vx * .04, q.y - q.vy * .04); c.stroke(); continue; }
        const rad = q.s * (.55 + .5 * heat) * Math.max(.7, sc * .9); c.fillStyle = `rgba(255,${g},${b},${a * .14})`; c.beginPath(); c.arc(q.x, q.y, rad * 2.6, 0, TAU); c.fill(); c.fillStyle = `rgba(255,${Math.min(255, g + 40)},${Math.min(255, b + 60)},${a})`; c.beginPath(); c.arc(q.x, q.y, rad, 0, TAU); c.fill(); }
      c.globalCompositeOperation = "source-over";
    } else {
      for (const q of st.p) if (q.kind === 2) { const k = q.age / q.life, a = .3 * Math.sin(Math.PI * Math.pow(k, .7)); if (a <= .002) continue; const g = c.createRadialGradient(q.x, q.y, 0, q.x, q.y, q.s); g.addColorStop(0, `rgba(176,168,160,${a})`); g.addColorStop(1, "rgba(130,124,118,0)"); c.fillStyle = g; c.beginPath(); c.arc(q.x, q.y, q.s, 0, TAU); c.fill(); }
      c.globalCompositeOperation = "lighter";
      [.24, .71].forEach((u, i) => { const f = .5 + .5 * Math.sin(t * (1.1 + i * .5) + i * 2), g = c.createRadialGradient(u * W, H - 8 * sc, 0, u * W, H - 8 * sc, 40 * sc); g.addColorStop(0, `rgba(255,150,60,${.6 + .3 * f})`); g.addColorStop(.35, `rgba(230,80,24,${.2 + .14 * f})`); g.addColorStop(1, "rgba(180,40,10,0)"); c.fillStyle = g; c.beginPath(); c.arc(u * W, H - 8 * sc, 40 * sc, 0, TAU); c.fill(); });
      c.globalCompositeOperation = "source-over"; [.24, .71].forEach((u, i) => { const f = .5 + .5 * Math.sin(t * (1.1 + i * .5) + i * 2); c.fillStyle = `rgba(255,${100 + 60 * f | 0},40,${.55 + .35 * f})`; c.beginPath(); c.ellipse(u * W - 5 * sc, H - 8 * sc, 7 * sc, 2.2 * sc, -.2, 0, TAU); c.ellipse(u * W + 7 * sc, H - 7 * sc, 5 * sc, 1.8 * sc, .2, 0, TAU); c.fill(); }); c.globalCompositeOperation = "lighter";
      for (const q of st.p) if (q.kind === 0) { const a = 1 - q.age / q.life; c.fillStyle = `rgba(255,150,70,${a})`; c.beginPath(); c.arc(q.x, q.y, q.s * sc, 0, TAU); c.fill(); }
      c.globalCompositeOperation = "source-over";
    }
  }
  function fireLoop(now) {
    const dt = Math.min(.05, (now - FIRE.last) / 1000 || .016); FIRE.last = now;
    const live = !document.hidden && !fireOff();
    FIRE.list.forEach(st => { if (!st.cv.isConnected) release(FIRE, st); else if (live) { fireStep(st, dt); fireDraw(st); } });
    FIRE.raf = FIRE.list.size ? requestAnimationFrame(fireLoop) : 0;
  }

  /* ── markup ── */
  /* level → frame: Breeze, Horizon, Bronze, Steel, Gold, Crystal, Obsidian, Forge, Neon, Aurora, Holographic, Supernova */
  const FRAME = [0, 2, 1, 3, 4, 8, 10, 7, 9, 6, 5, 11, 12];
  const frame = level => FRAME[level] ?? 0;
  const PBR_TIERS = [3, 4, 7];
  function layers(tier) {
    textures();
    const canvas = tier === 9 ? '<canvas class="rk fire" aria-hidden="true"></canvas>' : PBR_TIERS.includes(tier) ? '<canvas class="rk pbr" aria-hidden="true"></canvas>' : "";
    return `<i class="rk a"></i><i class="rk b"></i><i class="rk c"></i><i class="rk ox"></i>${canvas}`;
  }
  function mount(scope = doc) {
    textures();
    scope.querySelectorAll("canvas.rk.pbr:not([data-live])").forEach(cv => { cv.dataset.live = "1"; pbrSetup(cv); });
    scope.querySelectorAll("canvas.rk.fire:not([data-live])").forEach(cv => { cv.dataset.live = "1"; fireSetup(cv, !!cv.closest(".is-rusty")); });
  }
  function unmount(scope = doc) {
    for (const group of [PBR, FIRE]) for (const st of [...group.list]) if (scope.contains(st.cv)) release(group, st);
  }
  root.CTRank = { layers, frame, FRAME, mount, unmount, motionOff, PBR };
})(globalThis);
