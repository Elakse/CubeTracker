/* Reward effects: every kind of moment owns a motion language.
   CTRewardFX.create({ canvas, present(card), dismiss() }) → { play(plan), reset(), endCinema() }
   `plan` comes from CTEffects.plan(): { id, card, data }.  Layers, bottom to top:
     toolkit (maths, particles)  →  stage S (the live timer digits, the viewport canvas, shards, shake, flash)  →  FX registry.
   Each effect is a function(d) that sets the time, schedules canvas scenes with S.scene(fn, seconds) and shows
   its card with S.card(d.card) at the right moment.  To add one: write it in FX and give plan() the new id.
   Nothing here changes the page permanently: reset() puts the digits and everything around them back. */
(function (root) {
  "use strict";
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.random() * a.length | 0];
  const clamp01 = t => Math.min(1, Math.max(0, t));
  const lerp = (a, b, t) => a + (b - a) * t;
  const TAU = Math.PI * 2;
  const E = { out3: t => 1 - (1 - t) ** 3, in3: t => t ** 3, in2: t => t * t,
    io: t => t < .5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2,
    back: t => { const s = 1.70158; return 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2; } };
  const rgba = (hex, a) => { let h = hex.slice(1); if (h.length === 3) h = [...h].map(x => x + x).join(""); const n = parseInt(h, 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };

  /* ───────── particles: dots, streaks, flakes, stars, puffs ───────── */
  class Particles {
    constructor() { this.list = []; }
    add(p) { this.list.push({ x: 0, y: 0, vx: 0, vy: 0, g: 0, drag: 0, life: 1, age: 0, delay: 0, size: 2, color: "#fff", kind: "dot", rot: rand(0, TAU), spin: 0, sway: 0, trail: .035, grow: 0, a0: 1, ...p }); }
    burst(n, x, y, o, make = () => ({})) {
      for (let i = 0; i < n; i++) {
        const a = rand(o.angle?.[0] ?? 0, o.angle?.[1] ?? TAU), s = rand(...(o.speed || [100, 400]));
        this.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(...(o.life || [.6, 1.2])), ...o.base, ...make(i) });
      }
    }
    update(dt) {
      for (const p of this.list) {
        if (p.delay > 0) { p.delay -= dt; continue; }
        p.age += dt; const d = Math.exp(-p.drag * dt); p.vx *= d; p.vy = p.vy * d + p.g * dt;
        p.x += p.vx * dt + Math.sin(p.age * 3 + p.rot) * p.sway * dt; p.y += p.vy * dt; p.rot += p.spin * dt;
        if (p.floor !== undefined && p.y > p.floor && p.vy > 0) { p.y = p.floor; p.vy *= -p.bounce; p.vx *= .8; }
      }
      this.list = this.list.filter(p => p.age < p.life);
    }
    draw(c) {
      for (const p of this.list) {
        if (p.delay > 0) continue;
        const k = p.age / p.life, a = p.a0 * (1 - k) ** .8 * Math.min(1, p.age * 12);
        if (a <= .005) continue;
        c.globalAlpha = a; c.fillStyle = c.strokeStyle = p.color;
        switch (p.kind) {
          case "streak": c.lineWidth = p.size; c.lineCap = "round"; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * p.trail, p.y - p.vy * p.trail); c.stroke(); break;
          case "flake": c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.scale(1, Math.cos(p.age * 5 + p.rot)); c.fillRect(-p.size, -p.size * .5, p.size * 2, p.size); c.restore(); break;
          case "star": c.save(); c.translate(p.x, p.y); c.rotate(p.rot); star(c, p.size * (1 - k * .5)); c.restore(); break;
          case "puff": { const r = p.size * (1 + p.grow * k), g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, r); g.addColorStop(0, p.color); g.addColorStop(1, "transparent"); c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, r, 0, TAU); c.fill(); break; }
          default: c.beginPath(); c.arc(p.x, p.y, p.size * (1 - k * .4), 0, TAU); c.fill();
        }
      }
      c.globalAlpha = 1;
    }
  }
  function star(c, s) { c.beginPath(); c.moveTo(0, -s); c.quadraticCurveTo(0, 0, s, 0); c.quadraticCurveTo(0, 0, 0, s); c.quadraticCurveTo(0, 0, -s, 0); c.quadraticCurveTo(0, 0, 0, -s); c.fill(); }
  function ring(c, x, y, r, a, color, w = 1.5) { if (a <= 0) return; c.globalAlpha = a; c.strokeStyle = color; c.lineWidth = w; c.beginPath(); c.arc(x, y, Math.max(1, r), 0, TAU); c.stroke(); c.globalAlpha = 1; }
  function bolt(x1, y1, x2, y2, spread) {
    let pts = [[x1, y1], [x2, y2]], s = spread;
    for (let k = 0; k < 6; k++) { for (let i = pts.length - 1; i > 0; i--) { const [ax, ay] = pts[i - 1], [bx, by] = pts[i]; pts.splice(i, 0, [(ax + bx) / 2 + rand(-s, s), (ay + by) / 2 + rand(-s, s) * .4]); } s *= .55; }
    return pts;
  }
  function strokePts(c, pts) { c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke(); }
  function rays(c, x, y, n, len, ang, spread, fill) {
    const g = c.createRadialGradient(x, y, 0, x, y, len); g.addColorStop(0, fill); g.addColorStop(1, "transparent"); c.fillStyle = g; c.beginPath();
    for (let i = 0; i < n; i++) { const a = ang + i * TAU / n; c.moveTo(x, y); c.lineTo(x + Math.cos(a - spread) * len, y + Math.sin(a - spread) * len); c.lineTo(x + Math.cos(a + spread) * len, y + Math.sin(a + spread) * len); c.closePath(); }
    c.fill();
  }

  /* ───────── stage: the live digits, the viewport canvas and the little DOM helpers every effect shares ───────── */
  function create(host) {
    const doc = root.document, body = doc.body, cv = host.canvas, ctx = cv.getContext("2d");
    const probe = doc.createElement("canvas").getContext("2d");
    let digits = null, core = null, ghost = null, layer = null, noteEl = null, scenes = [], timers = [], raf = 0, pending = 0, W = 0, H = 0;

    /* one fixed element, made on first use and kept: flash, letterbox bars */
    const fixed = (cls, html = "") => { let el = doc.querySelector(`.${cls}`); if (!el) { el = doc.createElement("div"); el.className = cls; el.setAttribute("aria-hidden", "true"); el.innerHTML = html; body.append(el); } return el; };
    const flashEl = () => fixed("reward-flash");
    const normal = c => { probe.fillStyle = "#000"; probe.fillStyle = c || "#000"; return probe.fillStyle; };   /* any CSS colour → #rrggbb */
    function palette() {
      const s = getComputedStyle(doc.documentElement), v = n => normal(s.getPropertyValue(n).trim());
      return { green: v("--green"), accent2: v("--accent-2"), lime: v("--lime"), gold: v("--reward-gold"), rust: v("--reward-rust"), warn: v("--warn"), danger: v("--danger"), ink: v("--ink"), muted: v("--muted"), dark: doc.documentElement.dataset.theme !== "light" };
    }
    function geometry() {
      const r = digits.getBoundingClientRect();
      return { w: W, h: H, cx: r.left + r.width / 2, cy: r.top + r.height / 2, dw: r.width, dh: r.height, R: Math.max(130, r.width * .62) };
    }
    /* the digits the effect works on: the timer's own, or a stand-in when the player is on another page */
    function pickDigits(text) {
      const el = doc.querySelector("#timer-digits");
      if (el && el.getClientRects().length) return el;
      ghost = doc.createElement("span"); ghost.className = "timer-digits reward-ghost"; ghost.textContent = text; body.append(ghost); return ghost;
    }
    function frame(now) {
      ctx.clearRect(0, 0, W, H);
      for (const s of scenes) {
        const t = (now - s.t0) / 1000, dt = Math.min(.05, (now - s.last) / 1000); s.last = now;
        ctx.save(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
        s.fn(ctx, t, dt, s.g, s.col); ctx.restore();
        if (t >= s.dur) { s.done = true; s.end?.(); }
      }
      scenes = scenes.filter(s => !s.done);
      raf = scenes.length ? requestAnimationFrame(frame) : 0;
      finishIfIdle();
    }
    /* when nothing is left to draw or wait for, the scaffolding goes away (the card is the host's business) */
    function finishIfIdle() {
      if (scenes.length || pending) return;
      ctx.clearRect(0, 0, W, H); cv.hidden = true;
      ghost?.remove(); ghost = null; layer?.remove(); layer = null; noteEl?.remove(); noteEl = null;
    }

    const S = {
      g: null, col: null,
      scene(fn, dur, end) { const now = performance.now(); cv.hidden = false; scenes.push({ fn, dur, end, t0: now, last: now, g: S.g, col: S.col }); if (!raf) raf = requestAnimationFrame(frame); },
      later(fn, sec) { pending++; timers.push(setTimeout(() => { pending--; fn(); finishIfIdle(); }, sec * 1000)); },
      /* additive light in the dark theme, plain alpha in the light one */
      glow(c) { c.globalCompositeOperation = S.col.dark ? "lighter" : "source-over"; },
      set(text) { digits.textContent = text; },
      anim(kf, opt) { return digits.animate(kf, { fill: "both", ...opt }); },
      pulse() { S.anim([{ transform: "scale(1)" }, { transform: "scale(1.05)" }, { transform: "scale(1)" }], { duration: 420, easing: "ease-out" }); },
      thump() { S.anim([{ transform: "scale(.94)" }, { transform: "scale(1)" }], { duration: 260, easing: "cubic-bezier(.2,1.6,.4,1)" }); },
      flash(color, a, ms) { const el = flashEl(); el.style.background = color; el.animate([{ opacity: a }, { opacity: 0 }], { duration: ms, easing: "ease-out" }); },
      /* the whole time block (scramble, digits, buttons) moves; `translate` is independent of any transform it already has */
      offset(x, y) { core.style.translate = x || y ? `${x}px ${y}px` : ""; },
      shake(amp, dur) {
        S.scene(() => {}, dur); const t0 = performance.now(), el = core;
        const tick = () => { const k = 1 - (performance.now() - t0) / 1000 / dur; if (k <= 0 || el !== core) { if (el === core) S.offset(0, 0); return; } S.offset(rand(-amp, amp) * k, rand(-amp, amp) * k); requestAnimationFrame(tick); };
        tick();
      },
      card(spec) { host.present(spec); },
      /* a line of small print under the digits */
      note(text) {
        const r = digits.getBoundingClientRect(); noteEl ||= fixed("reward-note"); noteEl.textContent = text;
        noteEl.style.left = `${r.left + r.width / 2}px`; noteEl.style.top = `${r.bottom + 6}px`;
        noteEl.animate([{ opacity: 0, transform: "translate(-50%,6px)" }, { opacity: 1, transform: "translate(-50%,0)" }], { duration: 500, fill: "forwards", easing: "ease-out" });
      },
      noteClear() { noteEl?.remove(); noteEl = null; },
      /* a layer exactly over the digits, with their typography, for shards / cracks / gleams cut from the live numerals */
      wrap() {
        if (!layer) {
          const r = digits.getBoundingClientRect(), cs = getComputedStyle(digits); layer = doc.createElement("div"); layer.className = "reward-wrap";
          Object.assign(layer.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, fontFamily: cs.fontFamily, fontSize: cs.fontSize, fontWeight: cs.fontWeight, lineHeight: cs.lineHeight, letterSpacing: cs.letterSpacing });
          body.append(layer);
        }
        return layer;
      },
      /* cinema: letterbox bars and a dark room (Singularity) */
      cinema(on) { fixed("reward-bars", "<i></i><i></i>"); body.classList.toggle("reward-cine", on); },
    };

    /* ═══════════════ the effects, one function per plan id ═══════════════ */
    const FX = {
      ripple(d) {
        S.set(d.text); S.pulse();
        S.scene((c, t, dt, g, col) => { ring(c, g.cx, g.cy, g.R * (.75 + t * .5), (1 - t / .8) * .35, col.accent2, 1.4); }, .8);
      },

      accident(d) { S.set(d.text); S.pulse(); S.later(() => S.card(d.card), .35); },
      shatter(d) {
        /* The old record is glass. A gold comet strikes it, cracks radiate through the numerals only, and the pieces fall away to reveal the new time. */
        const { col } = S; S.set(d.oldText); const g = S.g = geometry(), fx = new Particles();
        const W = g.dw, H = g.dh, box = { x0: g.cx - W / 2, y0: g.cy - H / 2 }, P = [g.cx + W * .02, g.cy + H * .03], Pl = [P[0] - box.x0, P[1] - box.y0];
        const fill = col.dark ? col.muted : col.ink, T = { comet: .8, hit: 1.1, wave: .55 }; T.rel = T.hit + T.wave + .12;
        S.wrap().style.perspective = "900px"; S.wrap().style.setProperty("--fill", fill);
        S.anim([{ opacity: 0, transform: "scale(.94)" }, { opacity: 1, transform: "scale(1)" }], { duration: 450, easing: "ease-out" }); S.later(() => S.note("Your record"), .25);
        /* break lines: radial cracks and jagged rings, shared by the crack artwork and the pieces so the numerals split exactly along them */
        const rad = [0, .05, .11, .19, .3, .45, .65, .9, 1.45].map(k => k * W), counts = [4, 6, 8, 11, 14, 17, 20, 22], ph = rand(0, TAU);
        const jit = (k, a) => k > 0 && k < rad.length - 1 ? (Math.sin(a * 5 + k * 1.7 + ph) + Math.sin(a * 11 + k * 3.1) * .5) * W * .0055 : 0, rr = (k, a) => rad[k] + jit(k, a);
        const angles = counts.map(n => { const o = rand(0, TAU); return Array.from({ length: n }, (_, i) => o + (i + rand(-.26, .26)) * TAU / n); });
        const radial = angles.map((list, b) => list.map(a => Array.from({ length: 6 }, (_, s) => { const u = s / 5, r = lerp(rr(b, a), rr(b + 1, a), u), off = s && s < 5 ? rand(-1, 1) * (rad[b + 1] - rad[b]) * .05 : 0; return [Pl[0] + Math.cos(a) * r - Math.sin(a) * off, Pl[1] + Math.sin(a) * r + Math.cos(a) * off]; })));
        const arcPts = (k, a0, a1, n = 8) => Array.from({ length: n + 1 }, (_, i) => { const a = lerp(a0, a1, i / n), r = rr(k, a); return [Pl[0] + Math.cos(a) * r, Pl[1] + Math.sin(a) * r]; });
        const pieces = []; angles.forEach((list, b) => list.forEach((a0, k) => { let a1 = list[(k + 1) % list.length]; if (a1 <= a0) a1 += TAU; const poly = [...radial[b][k], ...arcPts(b + 1, a0, a1), ...radial[b][(k + 1) % list.length].slice().reverse(), ...(b ? arcPts(b, a1, a0) : [])]; pieces.push({ poly, cx: poly.reduce((s, p) => s + p[0], 0) / poly.length, cy: poly.reduce((s, p) => s + p[1], 0) / poly.length }); }));
        const pd = pl => "M" + pl.map(p => p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" L"), lines = [...radial.flat().map(pd), ...[1, 2, 3, 4, 5, 6, 7].map(k => pd(arcPts(k, 0, TAU, 110)))].join(" ");
        const art = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><g fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="${lines}" stroke="${col.gold}" stroke-width="9" opacity=".5"/><path d="${lines}" stroke="#fff" stroke-width="2.4"/></g></svg>`)}")`;
        /* cracks live on a copy of the numerals, painted only inside the glyphs and revealed by a growing radial mask */
        const crackEl = document.createElement("b"); crackEl.className = "crackfx"; crackEl.textContent = d.oldText; crackEl.style.backgroundImage = art; crackEl.style.backgroundSize = `${W}px ${H}px`; crackEl.style.setProperty("--px", Pl[0] + "px"); crackEl.style.setProperty("--py", Pl[1] + "px"); crackEl.style.setProperty("--r", "0px"); S.wrap().append(crackEl);
        /* the pieces are built (and rasterised) while the shock-wave travels, so the break itself costs nothing */
        const buildShards = () => pieces.map(pc => {
          const el = document.createElement("b"); el.className = "shard cracked"; el.textContent = d.oldText; el.style.clipPath = `polygon(${pc.poly.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(",")})`; el.style.backgroundImage = `${art},linear-gradient(${fill},${fill})`; el.style.backgroundSize = `${W}px ${H}px,100% 100%`; el.style.opacity = ".01"; S.wrap().append(el);
          /* ballistic flight: launched radially from the impact, drag slows the burst gently, gravity bends every path into an arc, no stop-and-drop */
          const dx = pc.cx - Pl[0], dy = pc.cy - Pl[1], dist = Math.hypot(dx, dy) || 1, far = clamp01(dist / (W * .7)), a = dist < 4 ? rand(0, TAU) : Math.atan2(dy, dx) + rand(-.18, .18);
          const v0 = rand(520, 980) * (1.2 - far * .55), vx = Math.cos(a) * v0, vy = Math.sin(a) * v0 * .8 - rand(120, 320), vz = rand(-120, 380), K = 1.1, G = 1500, D = rand(1.35, 1.8);
          const wx = rand(-260, 260), wy = rand(-260, 260), wz = rand(-420, 420), N = 20, kf = [];
          for (let i = 0; i <= N; i++) { const t = i / N * D, e = (1 - Math.exp(-K * t)) / K;
            kf.push({ transform: `translate3d(${(vx * e).toFixed(1)}px,${(vy * e + .5 * G * t * t).toFixed(1)}px,${(vz * e).toFixed(1)}px) rotateX(${(wx * t).toFixed(1)}deg) rotateY(${(wy * t).toFixed(1)}deg) rotateZ(${(wz * t).toFixed(1)}deg)`, opacity: Math.min(1, Math.max(0, (D - t) / (D * .35))).toFixed(2), offset: i / N }); }
          return { el, kf, opt: { duration: D * 1000, delay: far * 130 + rand(0, 40), easing: "linear", fill: "both" } };
            });
        let shards = null;
        const from = [box.x0 - 170, g.cy + H * .8]; let hit = false, released = false, carded = false;
        S.scene((c, t, dt) => {
          c.lineCap = "round"; S.glow(c);
          if (t >= T.comet && t < T.hit + .04) { const k = E.in2(clamp01((t - T.comet) / (T.hit - T.comet))), hx = lerp(from[0], P[0], k), hy = lerp(from[1], P[1], k), dx = P[0] - from[0], dy = P[1] - from[1], dl = Math.hypot(dx, dy), tl = 170 * Math.min(1, k * 2.2), tg = c.createLinearGradient(hx, hy, hx - dx / dl * tl, hy - dy / dl * tl); tg.addColorStop(0, rgba(col.gold, .95)); tg.addColorStop(1, rgba(col.gold, 0)); c.strokeStyle = tg; c.lineWidth = 3.4; c.beginPath(); c.moveTo(hx, hy); c.lineTo(hx - dx / dl * tl, hy - dy / dl * tl); c.stroke(); const hg = c.createRadialGradient(hx, hy, 0, hx, hy, 20); hg.addColorStop(0, rgba("#fff", .95)); hg.addColorStop(.4, rgba(col.gold, .75)); hg.addColorStop(1, rgba(col.gold, 0)); c.fillStyle = hg; c.fillRect(hx - 20, hy - 20, 40, 40); }
          if (t >= T.hit && !hit) { hit = true; digits.style.color = fill; S.flash("#fff", .2, 300); S.shake(3.5, .28); S.anim([{ transform: "scale(1)" }, { transform: "scale(.985)", offset: .25 }, { transform: "scale(1)" }], { duration: 420, easing: "ease-out" }); fx.burst(16, P[0], P[1], { speed: [90, 420], life: [.3, .65], base: { kind: "streak", size: 1.5, drag: 2.8, trail: .03 } }, () => ({ color: pick([col.gold, "#fff"]) })); }
          if (hit && !shards) shards = buildShards();
          if (hit && !released) { const r = E.out3(clamp01((t - T.hit) / T.wave)) * W * 1.25; crackEl.style.setProperty("--r", r.toFixed(1) + "px"); const q = clamp01((t - T.hit) / .4); ring(c, P[0], P[1], E.out3(q) * W * .24, (1 - q) * .45, col.gold, 2); }
          if (t >= T.rel && !released) {
            released = true; crackEl.remove(); S.wrap().style.width = W + "px"; S.noteClear();
            shards.forEach(({ el, kf, opt }) => { el.style.opacity = ""; el.animate(kf, opt); });
            S.set(d.text); digits.style.color = ""; digits.getAnimations().forEach(a => a.cancel()); digits.classList.add("reward-gold"); S.anim([{ opacity: 0, transform: "scale(.82)", filter: "blur(12px)" }, { opacity: 1, transform: "scale(1.04)", filter: "blur(0)", offset: .65 }, { opacity: 1, transform: "scale(1)", filter: "blur(0)" }], { duration: 680, easing: "cubic-bezier(.2,.9,.3,1)" });
            const gl = document.createElement("b"); gl.className = "gleam"; gl.textContent = d.text; S.wrap().append(gl); gl.animate([{ backgroundPosition: "130% 0" }, { backgroundPosition: "-30% 0" }], { duration: 950, delay: 420, easing: "cubic-bezier(.4,0,.2,1)", fill: "both" });
            S.flash(col.gold, .16, 420); S.shake(4, .3); fx.burst(34, P[0], P[1], { speed: [120, 600], life: [.4, .95], base: { kind: "streak", size: 1.7, drag: 2, g: 300, trail: .035 } }, () => ({ color: pick([col.gold, "#fff", col.lime]) }));
          }
          c.globalAlpha = 1; fx.update(dt); fx.draw(c);
          if (!carded && t >= T.rel + .85) { carded = true; S.card(d.card); }
        }, 7);
      },

      settle(d) {
        /* Twelve uneven solves. The best and worst are trimmed, the rest level out below your old record. */
        const { g, col } = S; S.set(d.text); const fx = new Particles();
        /* the real solves behind the average; a DNF is drawn as the tallest bar */
        const fin = d.bars.filter(Number.isFinite), tall = Math.max(...fin) * 1.2, times = d.bars.map(v => Number.isFinite(v) ? v : tall), lo = Math.min(...times), hi = Math.max(...times), N = times.length;
        const iLo = times.indexOf(lo); let iHi = times.lastIndexOf(hi); if (iHi === iLo) iHi = (iLo + 1) % N;
        const avg = d.avg, old = d.old;
        const lo2 = Math.min(lo, avg, old), hi2 = Math.max(hi, old), H = v => 10 + (v - lo2) / ((hi2 - lo2) || 1) * 170, base = g.cy + g.dh * .5 + 200, STEP = Math.min(40, (g.w - 140) / N), W = Math.min(24, STEP * .6), LW = Math.min(290, g.w / 2 - 70), lay = (i, n, s) => g.cx - n * s / 2 + s / 2 + i * s;
        const hOld = H(old), hAvg = hOld - 22, T = { grow: .15, trim: 1.15, re: 1.35, level: 1.9, merge: 3.0, lock: 3.55, fade: 4.35 };
        let ki = 0; const bars = times.map((v, i) => { const trimmed = i === iLo || i === iHi; return { v, i, trimmed, k: trimmed ? -1 : ki++ }; });
        let locked = false, fell = false, carded = false;
        S.scene((c, t, dt) => {
          const fade = 1 - clamp01((t - T.fade) / .6), merge = E.io(clamp01((t - T.merge) / .5)), s = lerp(STEP, W, merge), pop = E.out3(clamp01(t / .5));
          c.lineCap = "round";
          c.globalAlpha = .25 * fade * pop; c.strokeStyle = col.muted; c.lineWidth = 1; c.beginPath(); c.moveTo(g.cx - LW - 10, base); c.lineTo(g.cx + LW + 10, base); c.stroke();
          if (!fell) {
            c.globalAlpha = .75 * fade * E.out3(clamp01((t - .4) / .5)); c.setLineDash([6, 7]); c.strokeStyle = col.muted; c.lineWidth = 1.4; c.beginPath(); c.moveTo(g.cx - LW, base - hOld); c.lineTo(g.cx + LW, base - hOld); c.stroke(); c.setLineDash([]);
            c.fillStyle = col.muted; c.font = "700 12px Inter,sans-serif"; c.textAlign = "left"; c.fillText(`PB ${d.oldText}`, g.cx + LW + 8, base - hOld + 4);
          }
          const bar = (x, h, dy, a, color) => { c.globalAlpha = a * fade; const gr = c.createLinearGradient(0, base, 0, base - h); gr.addColorStop(0, rgba(color, .5)); gr.addColorStop(1, rgba(color, 1)); c.fillStyle = gr; c.beginPath(); c.roundRect(x - W / 2, base - h + dy, W, Math.max(2, h), [8, 8, 3, 3]); c.fill(); };
          for (const b of bars) {
            const gp = E.back(clamp01((t - T.grow - b.i * .05) / .5)); if (gp <= 0) continue;
            let x = lay(b.i, N, STEP), h = H(b.v) * gp;
            if (b.trimmed) { const q = clamp01((t - T.trim) / .5), dy = (b.i === iLo ? 1 : -1) * E.in2(q) * 46; bar(x, h, dy, 1 - q, q > 0 ? col.danger : col.lime); }
            else {
              x = lerp(x, lay(b.k, N - 2, s), E.io(clamp01((t - T.re) / .5)));
              const lv = E.io(clamp01((t - T.level - b.k * .05) / .7)); h = lerp(h, hAvg, lv) + (lv > 0 && lv < 1 ? Math.sin(t * 9 - b.k * .8) * 3 : 0);
              bar(x, h, 0, 1, col.lime); if (lv > 0) bar(x, h, 0, lv, col.gold);
            }
          }
          if (t > T.lock) {
            const q = E.out3(clamp01((t - T.lock) / .45)), y = base - hAvg, half = (N - 2) / 2 * W;
            S.glow(c); c.shadowColor = col.gold; c.shadowBlur = 22; c.strokeStyle = col.gold; c.lineWidth = 2.6; c.globalAlpha = fade; c.beginPath(); c.moveTo(g.cx - LW, y); c.lineTo(g.cx - LW + 2 * LW * q, y); c.stroke(); c.shadowBlur = 0;
            c.globalAlpha = .45 * fade * (1 - clamp01((t - T.lock) / 1)); c.fillStyle = col.gold; c.fillRect(g.cx - half, y, half * 2, hAvg);
            c.globalCompositeOperation = "source-over"; c.globalAlpha = q * fade; c.fillStyle = col.gold; c.font = "800 13px Inter,sans-serif"; c.textAlign = "left"; c.fillText(`${d.label} ${d.avgText}`, g.cx + LW + 8, y + 4);
          }
          if (t >= T.lock && !locked) { locked = true; S.flash(col.gold, .2, 420); S.shake(4, .3); S.thump(); for (let i = 0; i < 12; i++) fx.add({ x: g.cx + rand(-5 * W, 5 * W), y: base - hAvg + rand(-4, 4), life: rand(.7, 1.2), delay: rand(0, .35), size: rand(7, 13), kind: "star", color: "#fff", spin: rand(-1, 1) }); }
          if (t >= T.lock + .25 && !fell) { fell = true; for (let x = g.cx - LW; x < g.cx + LW; x += 13) fx.add({ x, y: base - hOld, vy: rand(0, 60), g: 800, spin: rand(-6, 6), life: 1.3, size: 3.4, kind: "flake", color: col.muted, drag: .3 }); }
          c.globalCompositeOperation = col.dark ? "lighter" : "source-over"; fx.update(dt); fx.draw(c);
          if (!carded && t >= T.lock + .8) { carded = true; S.card(d.card); }
        }, 6);
      },


      prism(d) {
        /* One solve in, four records out: a beam splits into four, the light returns to the prism and bursts. */
        const { g, col } = S; S.set(d.text); const fx = new Particles();
        const tint = col.dark ? ["#ffd66b", "#b8f06a", "#4fe3b5", "#7ab8ff"] : ["#bf9142", "#6f9a1c", "#1f9e7a", "#3f78d0"], beam = col.dark ? "#ffffff" : col.ink;
        const recs = d.recs.map(r => [r.name, r.value]), angles = recs.map((_, i) => (i - (recs.length - 1) / 2) * .24);
        const py = g.cy + g.dh * .5 + 135, px = g.cx - g.w * .09, reach = Math.min(g.w * .3, 380), size = 44, HIT = .8, OUT = 2.9, BLAZE = 3.5; let burst = false, carded = false;
        S.scene((c, t, dt) => {
          const rayA = 1 - clamp01((t - OUT) / .75), beamA = 1 - clamp01((t - OUT) / .5), prismA = 1 - clamp01((t - BLAZE) / .5), lab = 1 - clamp01((t - 2.85) / .35);
          c.lineCap = "round"; c.lineJoin = "round"; S.glow(c);
          const bp = E.out3(clamp01(t / .75)), hx = px * bp, bg = c.createLinearGradient(0, py, px, py); bg.addColorStop(0, rgba(beam, 0)); bg.addColorStop(1, rgba(beam, .95));
          c.strokeStyle = bg; c.globalAlpha = beamA; c.lineWidth = 3; c.beginPath(); c.moveTo(0, py); c.lineTo(hx, py); c.stroke(); c.globalAlpha = .14 * beamA; c.lineWidth = 14; c.stroke();
          const ps = E.back(clamp01((t - .2) / .5)) * (1 + clamp01((t - OUT) / .6) * .25); c.save(); c.translate(px, py); c.scale(ps, ps);
          c.beginPath(); c.moveTo(0, -size); c.lineTo(size * .87, size * .5); c.lineTo(-size * .87, size * .5); c.closePath(); c.fillStyle = rgba(beam, .07); c.globalAlpha = prismA; c.fill(); c.strokeStyle = rgba(beam, .85); c.lineWidth = 1.8; c.stroke(); c.restore();
          if (t > HIT) { const q = clamp01((t - HIT) / .6), gl = c.createRadialGradient(px, py, 0, px, py, 90); gl.addColorStop(0, rgba(beam, .9 * (1 - q) * prismA)); gl.addColorStop(1, rgba(beam, 0)); c.globalAlpha = 1; c.fillStyle = gl; c.fillRect(px - 90, py - 90, 180, 180); }
          recs.forEach(([name, val], i) => {
            const a = angles[i], start = HIT + .1 * i, p = E.out3(clamp01((t - start) / .6)); if (p <= 0) return;
            const ex = px + Math.cos(a) * reach, ey = py + Math.sin(a) * reach, tx = lerp(px, ex, p), ty = lerp(py, ey, p);
            const gr = c.createLinearGradient(px, py, ex, ey); gr.addColorStop(0, rgba(beam, .9)); gr.addColorStop(.35, rgba(tint[i], .95)); gr.addColorStop(1, rgba(tint[i], .7));
            c.strokeStyle = gr; c.lineWidth = 3.2; c.globalAlpha = rayA; c.beginPath(); c.moveTo(px, py); c.lineTo(tx, ty); c.stroke(); c.lineWidth = 16; c.globalAlpha = .12 * rayA; c.stroke();
            if (p > .98) {
              const q = clamp01((t - start - .6) / .45), pulse = E.in2(clamp01((t - OUT - i * .06) / .5)); ring(c, ex, ey, 8 + q * 36, (1 - q) * .6 * rayA, tint[i], 2);
              c.globalAlpha = rayA; c.fillStyle = tint[i]; c.beginPath(); c.arc(ex, ey, 5.5 * E.back(clamp01(q * 2.5)) * (1 - pulse), 0, TAU); c.fill();
              if (pulse > 0 && pulse < 1) { const rx = lerp(ex, px, pulse), ry = lerp(ey, py, pulse), gl = c.createRadialGradient(rx, ry, 0, rx, ry, 26); gl.addColorStop(0, rgba("#fff", .95)); gl.addColorStop(.4, rgba(tint[i], .7)); gl.addColorStop(1, rgba(tint[i], 0)); c.globalAlpha = 1; c.fillStyle = gl; c.fillRect(rx - 26, ry - 26, 52, 52); }
              const la = lab * clamp01((t - start - .62) / .3);
              if (la > 0) { c.globalCompositeOperation = "source-over"; c.textAlign = "left"; c.globalAlpha = la; c.fillStyle = col.muted; c.font = "600 12px Inter,sans-serif"; c.fillText(name, ex + 18, ey - 6); c.fillStyle = col.ink; c.font = "800 21px Inter,sans-serif"; c.fillText(val, ex + 18, ey + 16); S.glow(c); }
            }
          });
          if (t >= BLAZE && !burst) { burst = true; S.flash("#fff", .7, 700); S.shake(8, .5); fx.burst(120, px, py, { speed: [100, 900], life: [.8, 1.8], base: { kind: "dot", size: 2, drag: 1.6, g: 60 } }, i => ({ color: tint[i % 4] })); }
          if (burst) {
            const q = clamp01((t - BLAZE) / 1.1); ring(c, px, py, E.out3(q) * g.w * .7, (1 - q) * .55, "#fff", 3); ring(c, px, py, E.out3(q) * g.w * .45, (1 - q) * .4, tint[0], 2);
            /* a straight starburst: no spin, just light leaving the prism */
            for (let i = 0; i < 28; i++) { const a = i * TAU / 28 + .05, L = E.out3(clamp01((t - BLAZE) / .7)) * g.w * (.28 + .22 * ((i * 7) % 5) / 4), sg = c.createLinearGradient(px, py, px + Math.cos(a) * L, py + Math.sin(a) * L); sg.addColorStop(0, rgba("#fff", .9)); sg.addColorStop(1, rgba(tint[i % 4], 0)); c.globalAlpha = 1 - clamp01((t - BLAZE) / .9); c.strokeStyle = sg; c.lineWidth = 2.2; c.beginPath(); c.moveTo(px, py); c.lineTo(px + Math.cos(a) * L, py + Math.sin(a) * L); c.stroke(); }
          }
          fx.update(dt); fx.draw(c);
          if (!carded && t >= BLAZE + .3) { carded = true; S.card(d.card); }
        }, 7);
      },
      breach(d) {
        /* A hairline holds at the barrier. Light gathers beneath it and pushes it into a taut bulge until it gives: the line parts at the centre, a travelling wave runs out along both halves and a jet of fine light goes through. */
        const { g, col } = S; S.set(d.text); S.pulse(); const fx = new Particles(), ly = g.cy + g.dh * .5 + 40, x0 = g.w * .06, x1 = g.w * .94, sigma = Math.max(90, g.w * .085), TR = 1.95;
        let ruptured = false, carded = false; const rise = [], hits = [];
        const lineAt = (x, t) => { const T = E.in2(clamp01((t - .45) / (TR - .45))), s = t - TR, bulge = (t < TR ? 58 * T : 58 * Math.exp(-s * 9)) * Math.exp(-(((x - g.cx) / sigma) ** 2)); if (t < TR) return ly - bulge; const d = Math.abs(x - g.cx), wave = 9 * Math.exp(-s * 2.6) * Math.sin(d * .045 - s * 22) * Math.min(1, d / 120); return ly - bulge + wave; };
        const edgeFade = c => { const gr = c.createLinearGradient(x0, 0, x1, 0); gr.addColorStop(0, rgba(col.gold, 0)); gr.addColorStop(.18, rgba(col.gold, 1)); gr.addColorStop(.82, rgba(col.gold, 1)); gr.addColorStop(1, rgba(col.gold, 0)); return gr; };
        S.anim([{ transform: "translateY(0)", filter: "none" }, { transform: "translateY(-7px)", offset: .56, filter: "none" }, { transform: "translateY(-19px)", filter: `drop-shadow(0 0 22px ${col.gold})`, offset: .6 }, { transform: "translateY(0)", filter: "none" }], { duration: 3400, easing: "cubic-bezier(.3,.7,.3,1)" });
        S.scene((c, t, dt) => {
          const T = E.in2(clamp01((t - .45) / (TR - .45))), s = t - TR, pre = t < TR, gap = pre ? 0 : 12 + 130 * E.out3(clamp01(s / .8)), life = pre ? 1 : 1 - clamp01((s - 1) / .8), draw = (xa, xb) => { const pts = []; for (let x = xa; x <= xb; x += 6) pts.push([x, lineAt(x, t)]); pts.push([xb, lineAt(xb, t)]); strokePts(c, pts); };
          /* the stream of light that presses up against the line */
          if (pre && t > .15 && Math.random() < dt * (30 + 120 * T)) rise.push({ x: g.cx + rand(-1, 1) * (160 + 60 * T), y: ly + rand(60, 190), s: rand(.8, 2.1), v: rand(60, 120) });
          S.glow(c); c.fillStyle = col.gold;
          for (const p of rise) { p.v += (240 + 520 * T) * dt; p.y -= p.v * dt; const top = lineAt(p.x, t); if (p.y <= top + 1) { p.dead = true; hits.push({ x: p.x, at: t }); continue; } c.globalAlpha = clamp01((p.y - top) / 90) * .8; c.fillRect(p.x, p.y, p.s, p.s * (2 + p.v / 160)); }
          c.globalAlpha = 1; for (let i = rise.length - 1; i >= 0; i--) if (rise[i].dead) rise.splice(i, 1);
          for (let i = hits.length - 1; i >= 0; i--) { const h = hits[i], k = (t - h.at) / .45; if (k > 1) { hits.splice(i, 1); continue; } c.globalAlpha = (1 - k) * .9; c.beginPath(); c.arc(h.x, lineAt(h.x, t), 1.6 + k * 3, 0, TAU); c.fill(); } c.globalAlpha = 1;
          /* the line itself: a dull hairline that warms to gold as it strains */
          if (life > 0) {
            c.globalAlpha = life; c.lineCap = "round"; c.lineJoin = "round"; const hot = pre ? T : 1 - clamp01(s / 1.4), L = pre ? [[x0, x1]] : [[x0, g.cx - gap], [g.cx + gap, x1]];
            for (const [xa, xb] of L) {
              c.strokeStyle = col.muted; c.globalAlpha = life * (.55 - .25 * hot); c.lineWidth = 1.2; draw(xa, xb);
              c.strokeStyle = edgeFade(c); c.globalAlpha = life * (.12 + .88 * hot); c.lineWidth = 1.6 + 1.2 * hot; draw(xa, xb);
              c.globalAlpha = life * hot * .35; c.lineWidth = 9; draw(xa, xb);
            }
            c.globalAlpha = 1;
            if (!pre) for (const sx of [-1, 1]) { const tx = g.cx + sx * gap, a = life * (1 - clamp01(s / 1.1)); c.globalAlpha = a; c.fillStyle = "#fff"; c.beginPath(); c.arc(tx, lineAt(tx, t), 3.2, 0, TAU); c.fill(); }
            c.globalAlpha = 1;
          }
          /* the label of the barrier, until it falls */
          c.font = "600 11px Inter,system-ui,sans-serif"; c.letterSpacing = "2.4px"; c.textBaseline = "alphabetic"; c.fillStyle = col.muted; c.globalAlpha = clamp01(t / .4) * (pre ? .8 : Math.max(0, 1 - s * 2.4)); c.fillText(d.barrierText, x0 + 6, ly - 10); c.letterSpacing = "0px"; c.globalAlpha = 1;
          if (!pre) { const k = clamp01(s / 1), rx = E.out3(k) * g.w * .46; if (k < 1) { c.globalAlpha = (1 - k) * .5; c.strokeStyle = col.gold; c.lineWidth = 1.4; c.beginPath(); c.ellipse(g.cx, ly, rx, rx * .05, 0, 0, TAU); c.stroke(); c.globalAlpha = 1; } }
          if (!ruptured && t >= TR) { ruptured = true; S.flash(col.gold, .2, 420); S.shake(4, .35);
            fx.burst(170, g.cx, ly, { angle: [Math.PI * 1.3, Math.PI * 1.7], speed: [260, 900], life: [.7, 1.5], base: { kind: "streak", size: 1.4, drag: 1.7, g: 160, trail: .05 } }, () => ({ x: g.cx + rand(-gap - 20, gap + 20), color: pick([col.gold, "#fff", col.gold]) }));
            fx.burst(44, g.cx, ly, { angle: [Math.PI * 1.05, Math.PI * 1.95], speed: [20, 130], life: [1.8, 3], base: { kind: "dot", size: 1.5, drag: 1.1, g: -30, color: col.gold } }, () => ({ size: rand(.8, 2.4) })); }
          S.glow(c); fx.update(dt); fx.draw(c);
          if (!carded && t >= TR + .55) { carded = true; S.card(d.card); }
        }, 4.3);
      },

      seal(d) {
        /* The barrier closes again. Two bright tips run in from the edges, meet at the centre with a dull seam of light and the sealed line rings down like a plucked string. Embers fall away from the seam. */
        const { g, col } = S; S.set(d.text); const fx = new Particles(), ly = g.cy + g.dh * .5 + 40, x0 = g.w * .06, x1 = g.w * .94, TM = 1.5, TS = .35; let met = false, carded = false; const trail = [];
        S.anim([{ transform: "translateY(0)", color: col.ink }, { transform: "translateY(10px)", color: col.warn, offset: .5 }, { transform: "translateY(0)", color: col.ink }], { duration: 1900, delay: TM * 1000 - 150, easing: "ease-in-out" });
        S.scene((c, t, dt) => {
          const p = E.in2(clamp01((t - TS) / (TM - TS))), s = t - TM, post = t >= TM, ax = lerp(x0, g.cx, p), bx = lerp(x1, g.cx, p), life = 1 - clamp01((s - 1.3) / 1.2), amp = post ? 26 * Math.exp(-s * 3.6) * Math.cos(s * 15) : 0, amp2 = post ? 7 * Math.exp(-s * 4.4) * Math.sin(s * 31) : 0;
          const yAt = x => { const u = (x - x0) / (x1 - x0); return ly + amp * Math.sin(Math.PI * u) + amp2 * Math.sin(2 * Math.PI * u); };
          const line = (xa, xb) => { const pts = []; for (let x = xa; x <= xb; x += 6) pts.push([x, yAt(x)]); pts.push([xb, yAt(xb)]); strokePts(c, pts); };
          const gr = c.createLinearGradient(x0, 0, x1, 0); gr.addColorStop(0, rgba(col.warn, 0)); gr.addColorStop(.18, rgba(col.warn, 1)); gr.addColorStop(.82, rgba(col.warn, 1)); gr.addColorStop(1, rgba(col.warn, 0));
          S.glow(c); c.lineCap = "round"; c.lineJoin = "round";
          if (life > 0 && t > TS) {
            /* the two approaching halves are a bright head that fades into a faint tail */
            if (!post) for (const [from, to, dir] of [[x0, ax, 1], [x1, bx, -1]]) { const tail = c.createLinearGradient(from, 0, to, 0); tail.addColorStop(0, rgba(col.warn, 0)); tail.addColorStop(1, rgba(col.warn, .85)); c.strokeStyle = tail; c.lineWidth = 1.6; c.globalAlpha = .9; c.beginPath(); c.moveTo(from, ly); c.lineTo(to, ly); c.stroke(); c.globalAlpha = 1; c.fillStyle = "#fff"; c.beginPath(); c.arc(to, ly, 2.8 + 2 * p, 0, TAU); c.fill(); c.fillStyle = rgba(col.warn, .5); c.beginPath(); c.arc(to, ly, 10 + 6 * p, 0, TAU); c.fill(); if (Math.random() < dt * 70) trail.push({ x: to, y: ly + rand(-2, 2), vx: -dir * rand(20, 80), vy: rand(-16, 40), at: t }); }
            else { c.strokeStyle = col.muted; c.globalAlpha = life * .5; c.lineWidth = 1.2; line(x0, x1); c.strokeStyle = gr; c.globalAlpha = life * Math.max(.35, 1 - s * .5); c.lineWidth = 1.7 + 1.6 * Math.exp(-s * 3); line(x0, x1); c.globalAlpha = life * Math.exp(-s * 4) * .5; c.lineWidth = 10; line(x0, x1); c.globalAlpha = 1; }
          }
          c.fillStyle = col.warn; for (let i = trail.length - 1; i >= 0; i--) { const q = trail[i], k = (t - q.at) / .6; if (k > 1) { trail.splice(i, 1); continue; } q.x += q.vx * dt; q.y += q.vy * dt; c.globalAlpha = (1 - k) * .7; c.fillRect(q.x, q.y, 1.6, 1.6); } c.globalAlpha = 1;
          if (post) { const k = clamp01(s / .9); if (k < 1) { const rx = E.out3(k) * g.w * .4; c.globalAlpha = (1 - k) * .45; c.strokeStyle = col.warn; c.lineWidth = 1.4; c.beginPath(); c.ellipse(g.cx, ly, rx, rx * .05, 0, 0, TAU); c.stroke(); c.globalAlpha = 1; }
            const f = Math.exp(-s * 9); if (f > .02) { const sg = c.createRadialGradient(g.cx, ly, 0, g.cx, ly, 90); sg.addColorStop(0, rgba("#fff", .8 * f)); sg.addColorStop(.3, rgba(col.warn, .5 * f)); sg.addColorStop(1, rgba(col.warn, 0)); c.fillStyle = sg; c.fillRect(g.cx - 90, ly - 90, 180, 180); } }
          if (!met && t >= TM) { met = true; S.shake(3, .3); S.flash(col.warn, .1, 380);
            fx.burst(46, g.cx, ly, { angle: [Math.PI * .05, Math.PI * .95], speed: [40, 260], life: [.9, 1.8], base: { kind: "dot", size: 1.6, drag: 1.8, g: 520, color: col.warn } }, () => ({ size: rand(.8, 2.4) }));
            fx.burst(14, g.cx, ly, { angle: [Math.PI * 1.1, Math.PI * 1.9], speed: [40, 180], life: [.5, 1], base: { kind: "streak", size: 1.2, drag: 3, g: 380, trail: .04, color: "#fff" } }); }
          fx.update(dt); fx.draw(c);
          if (!carded && t >= TM + .3) { carded = true; S.card(d.card); }
        }, 4.3);
      },
      sunrise(d) {
        const { g, col } = S; S.set(d.text); const fx = new Particles();
        for (let i = 0; i < 46; i++) fx.add({ x: rand(0, g.w), y: g.h + rand(0, 60), vy: -rand(22, 70), vx: rand(-8, 8), life: rand(3, 5.5), delay: rand(0, 2.2), size: rand(1, 2.8), color: col.gold, sway: 12, a0: .8 });
        S.scene((c, t, dt) => {
          const env = E.out3(clamp01(t / 1.4)) * (1 - clamp01((t - 5.2) / 1.3)), rise = E.out3(clamp01(t / 2.8)), sx = g.cx, sy = lerp(g.h + 180, g.cy, rise);
          S.glow(c); const R = Math.max(g.w, g.h) * .85, gr = c.createRadialGradient(sx, sy, 0, sx, sy, R);
          gr.addColorStop(0, rgba(col.gold, .6 * env)); gr.addColorStop(.3, rgba(col.gold, .2 * env)); gr.addColorStop(1, rgba(col.gold, 0)); c.fillStyle = gr; c.fillRect(0, 0, g.w, g.h);
          rays(c, sx, sy, 22, R, -Math.PI + t * .018, .028, rgba(col.gold, (col.dark ? .3 : .22) * env));
          const disc = c.createRadialGradient(sx, sy, 0, sx, sy, 90 + 20 * rise); disc.addColorStop(0, rgba("#fff7d6", .95 * env)); disc.addColorStop(.5, rgba(col.gold, .55 * env)); disc.addColorStop(1, rgba(col.gold, 0)); c.fillStyle = disc; c.beginPath(); c.arc(sx, sy, 130, 0, TAU); c.fill();
          c.globalAlpha = env * .5; c.strokeStyle = col.gold; c.lineWidth = 1; c.beginPath(); c.moveTo(g.w * .1, g.h * .87); c.lineTo(g.w * .9, g.h * .87); c.stroke(); c.globalAlpha = 1;
          fx.update(dt); fx.draw(c);
        }, 6.5);
        S.later(() => { S.thump(); S.card(d.card); }, 1.9);
      },

      aurora(d) {
        const { g, col } = S; S.set(d.text);
        const hues = col.dark ? ["#b8f06a", "#4fe3b5", "#6fb4ff", "#b8f06a", "#4fe3b5"] : ["#6f9a1c", "#1f9e7a", "#3f78d0", "#6f9a1c", "#1f9e7a"];
        /* one unit-height gradient per ribbon, stretched per column: smooth and cheap */
        const grads = hues.map(h => { const gr = ctx.createLinearGradient(0, 0, 0, 1); gr.addColorStop(0, rgba(h, 0)); gr.addColorStop(.07, rgba(h, col.dark ? .3 : .24)); gr.addColorStop(1, rgba(h, 0)); return gr; });
        S.scene((c, t) => {
          const env = E.out3(clamp01(t / 1.6)) * (1 - clamp01((t - 5.4) / 1.4)); S.glow(c);
          hues.forEach((hue, k) => {
            const base = lerp(-140, g.h * (.1 + k * .05), E.out3(clamp01((t - k * .14) / 1.8))), amp = 34 + k * 8, step = 4, edge = [];
            c.globalAlpha = env;
            for (let x = -8; x < g.w + 8; x += step) {
              const y = base + Math.sin(x * .0042 + t * (.7 + k * .13) + k * 1.9) * amp + Math.sin(x * .011 - t * .9 + k) * amp * .35;
              const len = (90 + 80 * (.5 + .5 * Math.sin(x * .018 + t * 1.3 + k * 2.1))) * (.75 + .25 * Math.sin(t * .8 + k));
              c.save(); c.translate(x, y); c.scale(1, len); c.fillStyle = grads[k]; c.fillRect(0, 0, step, 1); c.restore(); edge.push([x, y]);
            }
            c.lineWidth = 1.6; c.strokeStyle = hue; c.globalAlpha = .45 * env; strokePts(c, edge);
          });
        }, 7);
        S.later(() => { S.thump(); S.card(d.card); }, 1.7);
      },


      warp(d) {
        const { g, col } = S; S.set(d.text); const fx = new Particles(), stars = Array.from({ length: 240 }, () => ({ a: rand(0, TAU), r0: rand(4, 50), v: rand(2.4, 3.6), c: pick([col.gold, "#fff", col.lime]) })); let boom = false;
        const t1 = 1.45, t2 = 1.95;
        S.scene((c, t, dt) => {
          S.glow(c); c.lineCap = "round";
          if (t < t2) {
            const imp = E.in3(clamp01((t - t1) / (t2 - t1)));
            for (const s of stars) {
              const r = s.r0 * Math.exp(Math.min(t, t1) * s.v) * (1 - imp), len = Math.min(t, t1) / t1 * r * .3 + 3; if (r < 2) continue;
              c.globalAlpha = Math.min(1, t * 1.6) * (1 - imp * .6); c.strokeStyle = s.c; c.lineWidth = 1 + r / 500;
              c.beginPath(); c.moveTo(g.cx + Math.cos(s.a) * r, g.cy + Math.sin(s.a) * r); c.lineTo(g.cx + Math.cos(s.a) * (r - len), g.cy + Math.sin(s.a) * (r - len)); c.stroke();
            }
            if (t > t1 - .2) { const k = E.in2(clamp01((t - t1 + .2) / .7)); const gl = c.createRadialGradient(g.cx, g.cy, 0, g.cx, g.cy, 20 + 70 * k); gl.addColorStop(0, `rgba(255,255,255,${.95 * k})`); gl.addColorStop(1, "rgba(255,255,255,0)"); c.globalAlpha = 1; c.fillStyle = gl; c.fillRect(g.cx - 120, g.cy - 120, 240, 240); }
          }
          if (t >= t2 && !boom) { boom = true; fx.burst(280, g.cx, g.cy, { speed: [100, 1100], life: [1, 2.6], base: { kind: "dot", size: 2.2, drag: 1.5, g: 60 } }, () => ({ color: pick([col.gold, "#fff", col.lime, col.gold]) })); }
          if (t >= t2) {
            const k = t - t2, env = E.out3(clamp01(k / 1.2)) * (1 - clamp01((t - 7.2) / 1.4));
            for (let i = 0; i < 3; i++) { const p = clamp01((k - i * .13) / 1.3); ring(c, g.cx, g.cy, E.out3(p) * Math.max(g.w, g.h) * .9, (1 - p) * .7, i ? col.gold : "#fff", 5 - i * 1.5); }
            rays(c, g.cx, g.cy, 18, Math.max(g.w, g.h) * .75, k * .12, .045, rgba(col.gold, (col.dark ? .34 : .26) * env));
            rays(c, g.cx, g.cy, 12, Math.max(g.w, g.h) * .6, -k * .18, .03, rgba("#fff", (col.dark ? .2 : 0) * env));
            const halo = c.createRadialGradient(g.cx, g.cy, 0, g.cx, g.cy, g.R * 1.7); halo.addColorStop(0, rgba(col.gold, .35 * env)); halo.addColorStop(1, rgba(col.gold, 0)); c.fillStyle = halo; c.fillRect(0, 0, g.w, g.h);
          }
          fx.update(dt); fx.draw(c);
        }, 9);
        let amp = 0; const t0 = performance.now(); const ramp = () => { const s = (performance.now() - t0) / 1000; if (s > t1 + .1) { S.offset(0, 0); return; } amp = (s / t1) ** 2 * 9; S.offset(rand(-amp, amp), rand(-amp, amp)); requestAnimationFrame(ramp); }; ramp();
        S.later(() => { S.flash("#fff", 1, 1100); S.shake(18, .9); S.thump(); }, t2);
        S.later(() => S.card(d.card), t2 + .45);
      },

      forge(d) {
        /* Cold iron on the anvil. Each hammer blow drives heat into the numerals; the last one splits the floor, and the metal cools back from white-hot. */
        const { g, col } = S; S.set(d.text); const hot = ["#fff3c4", "#ffd27a", "#f0a040", "#ff7a2e"], sparks = new Particles(), fx = new Particles(), embers = new Particles();
        const cx = g.cx, fy = g.cy + g.dh * .6, strikes = [.55, 1.15, 1.65, 2.45], done = new Set(), cracks = [];
        const iron = col.dark ? "#8f969e" : "#5b6168";
        S.anim([
          { color: iron, textShadow: "0 0 0 rgba(255,120,30,0)", offset: 0 },
          { color: iron, textShadow: "0 0 0 rgba(255,120,30,0)", offset: .55 / 8 },
          { color: "#d6482b", textShadow: "0 0 22px rgba(255,80,20,.55)", offset: 1.15 / 8 },
          { color: "#ff7a2e", textShadow: "0 0 34px rgba(255,110,30,.75)", offset: 1.65 / 8 },
          { color: "#fff6d2", textShadow: "0 0 70px rgba(255,200,90,1),0 0 140px rgba(255,120,30,.8)", offset: 2.55 / 8 },
          { color: "#ffb347", textShadow: "0 0 46px rgba(255,140,40,.8),0 0 90px rgba(255,90,20,.45)", offset: 4.2 / 8 },
          { color: "#ff7a2e", textShadow: "0 0 28px rgba(255,90,20,.55)", offset: 6.2 / 8 },
          { color: col.gold, textShadow: "0 0 40px color-mix(in srgb," + col.gold + " 50%,transparent)", offset: 1 }
        ], { duration: 8000, easing: "ease-out" });
        const sparkBurst = (n, power, x, y) => sparks.burst(n, x, y, { speed: [120 * power, 760 * power], angle: [-Math.PI * .98, -Math.PI * .02], life: [.9, 2.1], base: { kind: "streak", size: 2.1, g: 1700, drag: .35, trail: .028, floor: fy, bounce: .42 } }, () => ({ color: pick(hot) }));
        const crack = (dir) => { const pts = bolt(cx, fy, cx + dir * g.w * .62, fy + rand(-14, 14), 38).map(([x, y]) => [x, fy + (y - fy) * .35]); cracks.push({ pts, dir, born: 0 }); };
        S.scene((c, t, dt) => {
          S.glow(c); c.lineCap = "round"; c.lineJoin = "round";
          const env = 1 - clamp01((t - 6.8) / 1.1), heat = clamp01((t - .5) / 2.2) * env;
          /* the anvil line and the glow it throws */
          const floorG = c.createLinearGradient(0, fy - 220, 0, fy + 150); floorG.addColorStop(0, "rgba(255,110,30,0)"); floorG.addColorStop(.52, `rgba(255,128,40,${.26 * heat})`); floorG.addColorStop(.6, `rgba(255,120,36,${.34 * heat})`); floorG.addColorStop(1, "rgba(255,90,20,0)"); c.fillStyle = floorG; c.fillRect(0, fy - 220, g.w, 370);
          { const lg = c.createLinearGradient(g.w * .04, 0, g.w * .96, 0), lc = heat > .05 ? "255,154,60" : "150,150,150"; lg.addColorStop(0, `rgba(${lc},0)`); lg.addColorStop(.18, `rgba(${lc},${(.35 + .4 * heat) * env})`); lg.addColorStop(.82, `rgba(${lc},${(.35 + .4 * heat) * env})`); lg.addColorStop(1, `rgba(${lc},0)`); c.globalAlpha = 1; c.strokeStyle = lg; c.lineWidth = 1.5; c.beginPath(); c.moveTo(g.w * .04, fy); c.lineTo(g.w * .96, fy); c.stroke(); }
          if (Math.random() < dt * 40 * heat) embers.add({ x: rand(0, g.w), y: g.h + 10, vy: -rand(60, 220), vx: rand(-20, 20), life: rand(1.8, 3.6), size: rand(1.2, 3), color: pick(hot), kind: "dot", sway: 26, a0: .9 });
          strikes.forEach((s, i) => {
            if (t >= s && !done.has(i)) {
              done.add(i); const big = i === strikes.length - 1;
              sparkBurst(big ? 150 : 60 + i * 20, big ? 1.5 : 1 + i * .12, cx + rand(-30, 30), fy - 4);
              S.thump(); S.shake(big ? 16 : 5 + i * 2.5, big ? .7 : .32); S.flash(big ? "#fff6d2" : "#ff9a3c", big ? .75 : .22 + i * .05, big ? 700 : 340);
              if (big) { crack(-1); crack(1); crack(-1); crack(1); fx.burst(120, cx, fy, { speed: [200, 1500], angle: [-Math.PI, 0], life: [1, 2.4], base: { kind: "dot", size: 2.6, g: 900, drag: .5 } }, () => ({ color: pick(hot) })); }
            }
            if (t >= s) { const k = clamp01((t - s) / (i === strikes.length - 1 ? 1.1 : .6)); if (k < 1) { c.globalAlpha = (1 - k) * .75; c.strokeStyle = hot[Math.min(3, i + 1) - 1] || hot[1]; c.lineWidth = 3 + i; c.beginPath(); c.ellipse(cx, fy, E.out3(k) * g.w * (.16 + i * .06), E.out3(k) * 26 * (1 + i * .3), 0, 0, TAU); c.stroke(); } }
          });
          /* fissures that split the floor after the last blow and slowly cool */
          cracks.forEach(cr => { cr.born += dt; const grow = E.out3(clamp01(cr.born / .55)), n = Math.max(2, Math.floor(cr.pts.length * grow)), cool = clamp01((cr.born - 1.2) / 3.2); const pts = cr.pts.slice(0, n);
            c.lineWidth = 7; c.strokeStyle = `rgba(255,70,10,${(.3 * (1 - cool)) * env})`; strokePts(c, pts); c.lineWidth = 3; c.strokeStyle = `rgba(255,170,60,${(.95 - cool * .6) * env})`; strokePts(c, pts); c.lineWidth = 1.1; c.strokeStyle = `rgba(255,248,210,${(1 - cool) * env})`; strokePts(c, pts); });
          embers.update(dt); embers.draw(c); fx.update(dt); fx.draw(c); sparks.update(dt); sparks.draw(c);
        }, 8);
        S.later(() => S.card(d.card), 3.5);
      },

      singularity(d) {
        /* A black hole is born at the heart of the time. Space bends around it, the accretion disk spins up, the old time is pulled in and torn apart, a jet fires through the poles, and the new time is thrown back out. */
        const { g, col } = S; S.set(d.text); const fx = new Particles(), cx = g.cx, cy = g.cy, M = Math.max(g.w, g.h);
        const Rs0 = Math.min(g.w * .19, g.h * .14), COS = .27, T = { form: .45, fall: 1.7, jet: 4.55, rise: 4.8, end: 11.5 };
        const HEAT = ["#fffcec", "#fff1c4", "#ffe29a", "#ffc868", "#ffa748", "#ff8434", "#f2602a", "#d04620", "#a22f19", "#6c1e12"], LV = [.22, .45, .8];
        const parts = Array.from({ length: 2200 }, () => { const s = Math.pow(Math.random(), 1.3), rr = 1.55 + s * 3.2; return { s, rr, th: rand(0, TAU), w: 4.8 * Math.pow(1.55 / rr, 1.5) * rand(.93, 1.07), j: rand(.6, 1.15) }; });
        const stars = Array.from({ length: 480 }, () => ({ rho: Rs0 * 1.35 + (M * .66 - Rs0 * 1.35) * Math.pow(Math.random(), .8), a: rand(0, TAU), r: rand(.4, 1.5), p: rand(0, TAU), c: pick(["#ffffff", "#cfe0ff", "#ffe8c8"]) }));
        const sm = (a, b, x) => { const k = clamp01((x - a) / (b - a)); return k * k * (3 - 2 * k); };
        let risen = false, jetted = false;
        S.anim([{ transform: "scale(1) rotate(0deg) skewX(0deg)", opacity: 1, filter: "blur(0px)", offset: 0 }, { transform: "scale(1) rotate(0deg) skewX(0deg)", opacity: 1, filter: "blur(0px)", offset: T.fall / T.rise, easing: "cubic-bezier(.55,0,.9,.5)" }, { transform: "scale(.03) rotate(-560deg) skewX(32deg)", opacity: 0, filter: "blur(9px)", offset: (T.fall + 1.6) / T.rise }, { opacity: 0, offset: 1 }], { duration: T.rise * 1000 });
        S.later(() => S.cinema(true), .4);
        S.scene((c, t, dt) => {
          c.lineCap = "round";
          const form = E.out3(clamp01((t - T.form) / 2.4)), Rs = Rs0 * form, shrink = 1 - .12 * sm(T.rise, T.rise + 1.4, t), R = Rs * shrink;
          const veil = .94 * E.out3(clamp01(t / .9)) * (1 - clamp01((t - (T.end - 1.8)) / 1.8));
          c.globalCompositeOperation = "source-over"; c.globalAlpha = veil; c.fillStyle = "#010106"; c.fillRect(0, 0, g.w, g.h); c.globalAlpha = 1;
          c.globalCompositeOperation = "lighter";
          const pulse = 1 + .9 * Math.exp(-(((t - (T.fall + .9)) / .38) ** 2)), post = 1 - .4 * sm(T.rise, T.rise + 1, t), vis = Math.min(1, veil * 1.2) * post;
          /* stars, bent around the hole: pushed outward and smeared along the curve */
          stars.forEach(s => {
            const rl = s.rho + (R * R * 2.8) / s.rho * form; if (rl < R * 1.04) return;
            const a = s.a + t * .03 * (M * .28 / s.rho), L = 1.5 + 26 * (R / rl) ** 2 * form, da = L / rl;
            c.globalAlpha = veil * (.35 + .65 * Math.abs(Math.sin(t * 1.3 + s.p))); c.strokeStyle = s.c; c.lineWidth = s.r;
            c.beginPath(); c.moveTo(cx + Math.cos(a) * rl, cy + Math.sin(a) * rl); c.lineTo(cx + Math.cos(a + da) * rl, cy + Math.sin(a + da) * rl); c.stroke();
          });
          c.globalAlpha = 1;
          /* the pull of the hole: a faint glow that deepens when the numbers fall in */
          if (R > 3) {
            c.save(); c.translate(cx, cy); c.scale(1, COS + .22); const bl = c.createRadialGradient(0, 0, R, 0, 0, R * 5.6);
            bl.addColorStop(0, `rgba(255,172,74,${.4 * vis * pulse})`); bl.addColorStop(.35, `rgba(255,110,40,${.17 * vis * pulse})`); bl.addColorStop(1, "rgba(255,90,30,0)"); c.fillStyle = bl; c.beginPath(); c.arc(0, 0, R * 5.6, 0, TAU); c.fill(); c.restore();
          } else if (t > .2) { const sg = c.createRadialGradient(cx, cy, 0, cx, cy, 30 + 60 * t); sg.addColorStop(0, `rgba(255,255,255,${clamp01(t * 1.2) * .9})`); sg.addColorStop(1, "rgba(255,255,255,0)"); c.fillStyle = sg; c.beginPath(); c.arc(cx, cy, 120, 0, TAU); c.fill(); }
          if (R > 3) { c.save(); c.translate(cx, cy); c.scale(1, COS); c.lineCap = "butt";
            [[2.0, 16, .06, 90, 38, 150], [2.7, 22, .05, 140, 60, -110], [3.5, 30, .04, 200, 90, 80], [4.3, 38, .03, 260, 120, -60]].forEach(([rr, lw, al, d1, d2, sp]) => { c.globalAlpha = al * vis * pulse; c.strokeStyle = "#ff9a46"; c.lineWidth = lw; c.setLineDash([d1, d2]); c.lineDashOffset = -t * sp; c.beginPath(); c.arc(0, 0, rr * R, 0, TAU); c.stroke(); });
            c.restore(); c.setLineDash([]); c.globalAlpha = 1; c.lineCap = "round"; }
          const spin = t < T.form + 2.4 ? 1 + 1.4 * (1 - form) : 1;
          const pass = (kind) => {
            const B = Array.from({ length: 30 }, () => []);
            for (const p of parts) {
              const th = p.th + p.w * t * spin, th2 = th - p.w * .11, sn = Math.sin(th), idx = Math.min(9, (p.s * 10) | 0);
              const bright = (.62 + .5 * Math.cos(th + .55)) * p.j * (1.15 - p.s * .25), ab = bright > .82 ? 2 : bright > .5 ? 1 : 0, k = idx * 3 + ab;
              if (kind === "far" && sn < 0) { B[k].push([p.rr * R * Math.cos(th), p.rr * R * sn * COS, p.rr * R * Math.cos(th2), p.rr * R * Math.sin(th2) * COS]); }
              else if (kind === "near" && sn >= 0) { B[k].push([p.rr * R * Math.cos(th), p.rr * R * sn * COS, p.rr * R * Math.cos(th2), p.rr * R * Math.sin(th2) * COS]); }
              else if (kind === "halo") {
                const Rh = R * (1.07 + .55 * Math.pow(p.s, .9)), a = Math.cos(th) * 1.5, a2 = Math.cos(th2) * 1.5, side = sn < 0 ? -1 : 1;
                B[k].push([Rh * Math.sin(a), side * Rh * Math.cos(a), Rh * Math.sin(a2), side * Rh * Math.cos(a2)]);
              }
            }
            c.save(); c.translate(cx, cy);
            B.forEach((list, k) => { if (!list.length) return; const idx = (k / 3) | 0, ab = k % 3; c.strokeStyle = HEAT[idx]; c.globalAlpha = Math.min(1, LV[ab] * vis * pulse * (kind === "halo" ? .8 : 1)); c.lineWidth = (1.1 + (1 - idx / 9) * .9) * (kind === "halo" ? .85 : 1); c.beginPath(); for (const s of list) { c.moveTo(s[0], s[1]); c.lineTo(s[2], s[3]); } c.stroke(); });
            c.restore(); c.globalAlpha = 1;
          };
          if (R > 3) {
            pass("far");
            c.globalCompositeOperation = "source-over"; c.fillStyle = "#000"; c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.fill(); c.globalCompositeOperation = "lighter";
            pass("halo"); ring(c, cx, cy, R * 1.035, .9 * vis, "#fff4d6", 2); ring(c, cx, cy, R * 1.07, .25 * vis, "#ffc060", 9);
            pass("near");
          }
          /* the old time is torn apart as it falls in */
          if (t > T.fall && t < T.fall + 2) { const q = (t - T.fall) / 2; if (Math.random() < dt * 90 * (1 - q)) { const a = rand(0, TAU), r0 = rand(40, 190); fx.add({ x: cx + Math.cos(a) * r0, y: cy + Math.sin(a) * r0 * .7, vx: -Math.sin(a) * 320, vy: Math.cos(a) * 190, life: rand(.5, 1), size: rand(1.2, 2.6), color: pick(["#fff", "#ffd27a", "#ffb04a"]), kind: "streak", trail: .05, drag: -.6 }); } }
          /* the jet, the gravitational waves, the new time */
          if (t >= T.jet && !jetted) { jetted = true; S.flash("#cfe4ff", .55, 700); S.shake(9, .8); }
          if (t >= T.jet) {
            const k = t - T.jet, grow = E.out3(clamp01(k / .8)), fade = 1 - clamp01((k - 2.6) / 1.2), Lj = g.h * .66 * grow;
            if (fade > 0) for (const dir of [-1, 1]) {
              const w0 = 5 + Math.sin(t * 24) * 1, jg = c.createLinearGradient(cx, cy, cx, cy + dir * Lj); jg.addColorStop(0, `rgba(235,246,255,${.95 * fade})`); jg.addColorStop(.4, `rgba(150,190,255,${.5 * fade})`); jg.addColorStop(1, "rgba(110,140,255,0)");
              c.fillStyle = jg; c.beginPath(); c.moveTo(cx - w0 / 2, cy); c.lineTo(cx - w0 * .12 - 5 * grow, cy + dir * Lj); c.lineTo(cx + w0 * .12 + 5 * grow, cy + dir * Lj); c.lineTo(cx + w0 / 2, cy); c.fill();
              [[34, .07], [18, .12], [8, .2]].forEach(([w, al]) => { const hg = c.createLinearGradient(cx, cy, cx, cy + dir * Lj * .9); hg.addColorStop(0, `rgba(190,215,255,${al * fade})`); hg.addColorStop(1, "rgba(110,140,255,0)"); c.fillStyle = hg; c.beginPath(); c.moveTo(cx - w / 2, cy); c.lineTo(cx - w * .9 * grow, cy + dir * Lj * .9); c.lineTo(cx + w * .9 * grow, cy + dir * Lj * .9); c.lineTo(cx + w / 2, cy); c.fill(); });
              if (Math.random() < dt * 140 * fade) fx.add({ x: cx + rand(-4, 4), y: cy + dir * R * .4, vx: rand(-30, 30), vy: dir * rand(600, 1400), life: rand(.5, 1.1), size: rand(1, 2.2), color: pick(["#e8f3ff", "#ffffff", "#a7c4ff"]), kind: "streak", trail: .05 });
            }
            for (let i = 0; i < 3; i++) { const p = clamp01((k - i * .22) / 2.3); if (p <= 0 || p >= 1) continue; const rx = E.out3(p) * M * .78; c.globalAlpha = (1 - p) * .5 * (i ? .7 : 1); c.strokeStyle = i === 1 ? "#ffd78a" : "#cfe4ff"; c.lineWidth = 3 - i * .8; c.beginPath();
              for (let a = 0; a <= TAU + .05; a += TAU / 120) { const w = 1 + .035 * Math.sin(a * 5 + t * 7 + i), x = cx + Math.cos(a) * rx * w, y = cy + Math.sin(a) * rx * w * (COS + .18); a ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); } c.globalAlpha = 1;
          }
          if (t >= T.rise && !risen) {
            risen = true; digits.classList.add("reward-gold");
            S.anim([{ opacity: 0, transform: "scale(.05) rotate(420deg)", filter: "blur(18px) drop-shadow(0 0 0 #000)" }, { opacity: 1, transform: "scale(1.2) rotate(-14deg)", filter: "blur(0) drop-shadow(0 0 14px rgba(0,0,0,.9)) drop-shadow(0 0 34px rgba(255,170,60,.7))", offset: .55 }, { opacity: 1, transform: "scale(1) rotate(0deg)", filter: "blur(0) drop-shadow(0 0 14px rgba(0,0,0,.9)) drop-shadow(0 0 34px rgba(255,170,60,.7))" }], { duration: 1400, easing: "cubic-bezier(.16,.9,.25,1)" });
            const gl = document.createElement("b"); gl.className = "gleam"; gl.textContent = d.text; S.wrap().append(gl); gl.animate([{ backgroundPosition: "130% 0" }, { backgroundPosition: "-30% 0" }], { duration: 1000, delay: 900, easing: "cubic-bezier(.4,0,.2,1)", fill: "both" });
            fx.burst(180, cx, cy, { speed: [180, 1300], life: [.9, 2.2], base: { kind: "dot", size: 2.2, drag: 1.3, g: 0 } }, () => ({ color: pick(["#fff", "#ffd27a", "#ffb04a", "#cfe4ff"]) }));
          }
          c.globalCompositeOperation = "lighter"; fx.update(dt); fx.draw(c); c.globalCompositeOperation = "source-over";
        }, T.end);
        S.later(() => S.card(d.card), T.rise + 1.3);
      },
      oxidation(d) {
        /* Corrosion creeps in from the rim: an uneven front, blooms of stain, hairline veins that feel their way toward the number, and flakes that let go of it. */
        const { g, col } = S; S.set(d.text); const fx = new Particles(), maxR = Math.hypot(g.w, g.h) / 2, cx = g.w / 2, cy = g.h / 2, T = 3.4, RUST = ["#a57250", "#8a4d2b", "#c98a5c", "#6e3b1f"];
        const ph = [rand(0, TAU), rand(0, TAU), rand(0, TAU)], edge = a => 1 + .2 * (Math.sin(3 * a + ph[0]) + .6 * Math.sin(7 * a + ph[1]) + .35 * Math.sin(13 * a + ph[2])) / 1.95, front = (a, t) => lerp(maxR * 1.3, maxR * .5, E.io(clamp01(t / T))) * edge(a);
        const speck = []; for (let k = 0; k < 44; k++) { const a0 = rand(0, TAU), d0 = Math.sqrt(rand(.25, 1)) * maxR * 1.05, x0 = cx + Math.cos(a0) * d0, y0 = cy + Math.sin(a0) * d0 * .9, n = 8 + rand(0, 26) | 0; for (let i = 0; i < n; i++) { const r = rand(0, 1) ** 1.6 * rand(18, 70), a = rand(0, TAU), x = x0 + Math.cos(a) * r, y = y0 + Math.sin(a) * r; speck.push({ x, y, ang: Math.atan2(y - cy, x - cx), dist: Math.hypot(x - cx, y - cy), s: rand(.8, 3.2), c: pick(RUST) }); } }
        const blooms = Array.from({ length: 26 }, () => { const a = rand(0, TAU), d = maxR * rand(.78, 1.02); return { x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d * .9, ang: a, dist: d, r: rand(110, 240) }; });
        const veins = Array.from({ length: 12 }, () => { let a = rand(0, TAU), x = cx + Math.cos(a) * maxR * 1.02, y = cy + Math.sin(a) * maxR * .92; const pts = [[x, y]], toward = Math.atan2(cy - y, cx - x); let h = toward; for (let i = 0; i < 44; i++) { h += rand(-.55, .55); h = lerp(h, Math.atan2(cy - y, cx - x), .12); const st = rand(12, 24); x += Math.cos(h) * st; y += Math.sin(h) * st; pts.push([x, y]); } return { pts, at: rand(.1, 1.2) }; });
        digits.style.transition = "filter 2.4s ease, color 2.4s ease"; requestAnimationFrame(() => { digits.style.filter = "sepia(.85) saturate(.9) contrast(.92)"; digits.style.color = "#b98763"; });
        S.scene((c, t, dt) => {
          const env = 1 - clamp01((t - 4.9) / 1.2);
          for (const b of blooms) { const k = clamp01((b.dist - front(b.ang, t) * .92) / b.r); if (k <= 0) continue; const gr = c.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r); gr.addColorStop(0, rgba("#99582d", .2 * k * env)); gr.addColorStop(1, rgba("#99582d", 0)); c.fillStyle = gr; c.fillRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2); }
          for (const s of speck) { const k = clamp01((s.dist - front(s.ang, t) * .95) / 110); if (k <= 0) continue; c.globalAlpha = k * .75 * env; c.fillStyle = s.c; c.fillRect(s.x, s.y, s.s, s.s); }
          c.globalAlpha = 1; c.lineCap = "round"; c.lineJoin = "round";
          for (const v of veins) { const n = Math.floor(v.pts.length * clamp01((t - .35 - v.at * .6) / 2.6)); if (n < 2) continue; c.beginPath(); for (let i = 0; i < n; i++) i ? c.lineTo(v.pts[i][0], v.pts[i][1]) : c.moveTo(v.pts[i][0], v.pts[i][1]); c.strokeStyle = rgba("#5e2f14", .5 * env); c.lineWidth = 1.2; c.stroke(); c.save(); c.translate(-.7, -.7); c.strokeStyle = rgba("#e0a070", .22 * env); c.lineWidth = .8; c.stroke(); c.restore(); const [hx, hy] = v.pts[n - 1]; c.fillStyle = rgba("#d89460", .5 * env * (n < v.pts.length ? 1 : 0)); c.beginPath(); c.arc(hx, hy, 1.8, 0, TAU); c.fill(); }
          if (t > 1.1 && t < 3.9 && Math.random() < dt * 42) fx.add({ x: g.cx + rand(-g.dw / 2, g.dw / 2), y: g.cy + rand(-g.dh / 3, g.dh / 3), vy: rand(0, 30), vx: rand(-12, 12), g: 170, drag: .4, life: rand(1.4, 2.4), size: rand(1.6, 4.6), color: pick(RUST), kind: "flake", sway: 18, spin: rand(-4, 4), a0: .9 });
          if (t > 1.6 && t < 3.6 && Math.random() < dt * 8) fx.add({ x: g.cx + rand(-g.dw / 2, g.dw / 2), y: g.cy + rand(-g.dh / 4, g.dh / 2), vy: rand(6, 22), g: 8, life: rand(1.6, 2.6), size: rand(10, 20), grow: 1.4, color: "rgba(150,92,56,.22)", kind: "puff", a0: .8 });
          fx.update(dt); fx.draw(c);
        }, 6.2);
        S.later(() => S.card(d.card), 1.8);
      },

      polish(d) {
        /* The number shudders and the rust lets go in waves: flakes tumble, land and bounce on the floor, dust billows, then a bright polishing band sweeps the stain away and a glint finishes it. */
        const { g, col } = S; S.set(d.text); const fx = new Particles(), maxR = Math.hypot(g.w, g.h) / 2, RUST = ["#a57250", "#8a4d2b", "#c98a5c", "#6e3b1f"], floor = g.cy + g.dh * .5 + 74;
        const speck = Array.from({ length: 420 }, () => { const a = rand(0, TAU), d = Math.sqrt(rand(.5, 1)); return { x: g.w / 2 + Math.cos(a) * d * maxR * 1.05, y: g.h / 2 + Math.sin(a) * d * maxR * .9, s: rand(.8, 3), c: pick(RUST) }; });
        digits.style.filter = "sepia(.85) saturate(.9) contrast(.92)"; digits.style.color = "#b98763"; const waves = [[.12, 74, 22], [.4, 46, 14], [.74, 24, 8]]; let wi = 0;
        const tilt = .35, sweepStart = .75, sweepDur = 1.1, glint = 2.05, twinkle = Array.from({ length: 7 }, (_, i) => ({ x: g.cx + rand(-g.dw / 2, g.dw / 2), y: g.cy + rand(-g.dh / 2, g.dh / 2), at: glint + .1 + i * .11, s: rand(7, 14) }));
        S.anim(Array.from({ length: 15 }, (_, i) => { const a = 10 * Math.exp(-i * .26) * (i % 2 ? 1 : -1); return { transform: `translate(${a}px,${Math.abs(a) * -.25}px) rotate(${a * .16}deg)` }; }), { duration: 900, easing: "linear" }); S.shake(6, .8);
        S.scene((c, t, dt) => {
          while (wi < waves.length && t >= waves[wi][0]) { const [, nf, np] = waves[wi++];
            for (let i = 0; i < nf; i++) fx.add({ x: g.cx + rand(-g.dw / 2, g.dw / 2), y: g.cy + rand(-g.dh / 3, g.dh / 3), vx: rand(-420, 420), vy: -rand(60, 460), g: 950, drag: .5, floor: floor + rand(-10, 14), bounce: .3, life: rand(1.8, 2.8), size: rand(1.8, 5.6), color: pick(RUST), kind: "flake", spin: rand(-9, 9), sway: 4, a0: 1 });
            for (let i = 0; i < np; i++) fx.add({ x: g.cx + rand(-g.dw / 2, g.dw / 2), y: g.cy + rand(-g.dh / 4, g.dh / 3), vx: rand(-150, 150), vy: -rand(0, 70), drag: 1.9, g: -6, life: rand(1.3, 2.6), size: rand(14, 32), grow: 2, color: "rgba(150,96,60,.33)", kind: "puff", a0: .9 }); }
          const env = 1 - clamp01((t - 4.4) / 1), p = E.io(clamp01((t - sweepStart) / sweepDur)), bandX = lerp(-g.h * tilt - 60, g.w + 60, p);
          c.save(); c.beginPath(); c.moveTo(bandX, 0); c.lineTo(g.w, 0); c.lineTo(g.w, g.h); c.lineTo(bandX - g.h * tilt, g.h); c.closePath(); c.clip();
          if (p < 1) { const gr = c.createRadialGradient(g.w / 2, g.h / 2, maxR * .52 * .55, g.w / 2, g.h / 2, maxR * 1.15); gr.addColorStop(0, rgba("#99582d", 0)); gr.addColorStop(1, rgba("#99582d", .5)); c.fillStyle = gr; c.fillRect(0, 0, g.w, g.h); for (const s of speck) { c.globalAlpha = .6; c.fillStyle = s.c; c.fillRect(s.x, s.y, s.s, s.s); } }
          c.restore(); c.globalAlpha = 1;
          if (t > sweepStart && p < 1) { S.glow(c); c.save(); c.translate(bandX, 0); c.transform(1, 0, -tilt, 1, 0, 0); const b = c.createLinearGradient(-70, 0, 20, 0); b.addColorStop(0, "rgba(255,255,255,0)"); b.addColorStop(.7, rgba("#fff", .6)); b.addColorStop(1, "rgba(255,255,255,0)"); c.fillStyle = b; c.fillRect(-70, 0, 90, g.h); c.restore(); }
          if (t > glint && t < glint + .8) { S.glow(c); const k = (t - glint) / .8, gx = lerp(g.cx - g.dw * .7, g.cx + g.dw * .7, E.io(k)); c.save(); c.translate(gx, g.cy); c.transform(1, 0, -.35, 1, 0, 0); const b = c.createLinearGradient(-50, 0, 50, 0); b.addColorStop(0, "rgba(255,255,255,0)"); b.addColorStop(.5, rgba("#fff", col.dark ? .55 : .85)); b.addColorStop(1, "rgba(255,255,255,0)"); c.fillStyle = b; c.fillRect(-50, -g.dh / 2 - 10, 100, g.dh + 20); c.restore(); }
          for (const w of twinkle) { const k = (t - w.at) / .6; if (k < 0 || k > 1) continue; S.glow(c); c.save(); c.translate(w.x, w.y); c.rotate(.4); c.globalAlpha = Math.sin(k * Math.PI); c.fillStyle = col.dark ? "#fff" : col.gold; star(c, w.s * Math.sin(k * Math.PI) + 3); c.restore(); }
          fx.update(dt); fx.draw(c);
        }, 5.4);
        S.later(() => { digits.style.transition = "filter .8s ease, color .8s ease"; digits.style.filter = "none"; digits.style.color = ""; }, sweepStart + .35);
        S.later(() => { S.card(d.card); }, glint + .15);
      },
      thud(d) {
        /* The number drops and hits the floor three times, each landing kicking up more dust: a rolling ground cloud, flung debris, a flattened shock-ring and a haze that hangs over the digits before it settles. */
        const { g, col } = S; S.set(d.text); const fx = new Particles(), gy = g.cy + g.dh * .5 + 36, dust = col.dark ? "rgba(176,162,140,.5)" : "rgba(125,110,90,.42)", soot = col.dark ? "rgba(90,84,76,.4)" : "rgba(80,70,60,.34)"; let hit = [false, false, false];
        S.anim([{ transform: "translateY(-10px)", filter: "none" }, { transform: "translateY(26px)", filter: "saturate(.4) blur(1.6px)", offset: .3 }, { transform: "translateY(12px)", filter: "saturate(.4) blur(1.2px)", offset: .45 }, { transform: "translateY(22px)", filter: "saturate(.4) blur(1px)", offset: .6 }, { transform: "translateY(17px)", filter: "saturate(.4) blur(.4px)", offset: .8 }, { transform: "translateY(18px)", filter: "saturate(.4)" }], { duration: 1500, easing: "ease-in" });
        const kick = (n, spread, power) => {
          for (let i = 0; i < n; i++) { const side = i % 2 ? 1 : -1; fx.add({ x: g.cx + side * rand(0, g.dw * spread), y: gy + rand(-6, 6), vx: side * rand(60, 460) * power, vy: -rand(10, 80) * power, drag: 1.7, g: -22, life: rand(2.2, 4), size: rand(22, 52), grow: 2.6, color: dust, kind: "puff", a0: .95 }); }
          for (let i = 0; i < n * .35; i++) fx.add({ x: g.cx + rand(-g.dw * .3, g.dw * .3), y: gy + rand(-4, 4), vx: rand(-120, 120) * power, vy: -rand(20, 90) * power, drag: 1.5, g: -10, life: rand(1.4, 2.6), size: rand(10, 22), grow: 1.8, color: soot, kind: "puff", a0: .9 });
          for (let i = 0; i < 14 * power; i++) fx.add({ x: g.cx + rand(-g.dw * .35, g.dw * .35), y: gy - 6, vx: rand(-260, 260) * power, vy: -rand(120, 420) * power, g: 1100, drag: .4, floor: gy + rand(0, 12), bounce: .28, life: rand(1.1, 1.9), size: rand(1.2, 3), color: col.dark ? "#8a8071" : "#6e6454", kind: "dot", a0: 1 });
        };
        S.scene((c, t, dt) => {
          const dim = Math.sin(clamp01(t / 3.6) * Math.PI) * .34; c.fillStyle = col.dark ? `rgba(0,0,0,${dim})` : `rgba(80,70,60,${dim * .5})`; c.fillRect(0, 0, g.w, g.h);
          [[.3, 26, .22, 1, 8], [.54, 14, .14, .6, 4], [.8, 8, .1, .4, 2.4]].forEach(([at, n, sp, pw, sh], i) => { if (!hit[i] && t >= at) { hit[i] = true; kick(n * 3.6 | 0, sp + .3, pw); if (i) S.shake(sh, .2); } });
          if (t > .3 && !fx.haze) { fx.haze = true; for (let i = 0; i < 6; i++) fx.add({ x: g.cx + rand(-g.dw * .35, g.dw * .35), y: g.cy + rand(-g.dh * .2, g.dh * .4), vx: rand(-14, 14), vy: -rand(2, 12), life: rand(2.6, 3.8), size: rand(90, 150), grow: .6, color: col.dark ? "rgba(150,140,125,.16)" : "rgba(120,106,88,.16)", kind: "puff", a0: .9, delay: rand(0, .3) }); }
          fx.update(dt); fx.draw(c);
          for (const [at, mx, a] of [[.3, 1.5, .26], [.54, .8, .16], [.8, .5, .1]]) { const k = clamp01((t - at) / 1); if (k <= 0 || k >= 1) continue; const rx = E.out3(k) * g.R * mx; c.globalAlpha = (1 - k) * a; c.strokeStyle = col.warn; c.lineWidth = 1.3; c.beginPath(); c.ellipse(g.cx, gy, rx, rx * .09, 0, 0, TAU); c.stroke(); c.globalAlpha = 1; }
        }, 5);
        S.later(() => S.shake(5, .25), .28);
        S.later(() => S.card(d.card), .9);
      },
    };

    /* ═══════════════ public ═══════════════ */
    function reset() {
      timers.forEach(clearTimeout); timers = []; pending = 0; scenes = []; ctx.clearRect(0, 0, W || cv.width, H || cv.height);
      if (digits) { digits.getAnimations().forEach(a => a.cancel()); digits.removeAttribute("style"); digits.classList.remove("reward-gold"); }
      core?.style.removeProperty("translate");
      ghost?.remove(); ghost = null; layer?.remove(); layer = null; noteEl?.remove(); noteEl = null;
      body.classList.remove("reward-cine"); digits = core = null;
    }
    function endCinema() {
      if (!body.classList.contains("reward-cine")) return;
      body.classList.remove("reward-cine"); digits?.classList.remove("reward-gold"); scenes = []; ctx.clearRect(0, 0, W, H);
    }
    function play(plan) {
      reset(); W = innerWidth; H = innerHeight;
      digits = pickDigits(plan.data.text); core = digits.closest(".focus-time") || digits;
      S.g = geometry(); S.col = palette(); cv.hidden = false;
      (FX[plan.id] || FX.ripple)({ ...plan.data, card: plan.card });
    }
    return { play, reset, endCinema, effects: Object.keys(FX) };
  }
  root.CTRewardFX = { create };
})(globalThis);
