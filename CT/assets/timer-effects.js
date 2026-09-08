/* Shared milestone calculations and a single, disposable procedural motion layer. */
(function (root) {
  "use strict";
  const C = typeof module !== "undefined" && module.exports ? require("./core.js") : root.CT;
  const inspectionCuePaths = {
    8: Array.from({ length: 10 }, (_, i) => `assets/audio/inspection-eight-${String(i + 1).padStart(2, "0")}.mp3?v=2`),
    12: Array.from({ length: 10 }, (_, i) => `assets/audio/inspection-twelve-${String(i + 1).padStart(2, "0")}.mp3?v=2`),
  };
  function pickInspectionCue(cue, previous = -1, random = Math.random) {
    const paths = inspectionCuePaths[cue];
    if (!paths?.length) return null;
    const available = paths.length > 1 && previous >= 0 && previous < paths.length ? paths.length - 1 : paths.length;
    const slot = Math.min(available - 1, Math.max(0, Math.floor(random() * available)));
    const index = available < paths.length && slot >= previous ? slot + 1 : slot;
    return { index, path: paths[index] };
  }
  const SPECIAL = [60, 45, 30, 25, 20, 15, 10, 8, 7, 6, 5];
  const TITLES = ["First horizon", "Finding your flow", "Half a minute. Whole new level.", "Speed takes shape", "The twenty barrier falls", "Serious speed", "Single-digit territory", "Beyond fast", "Rare air", "Human highlight reel", "Five seconds. No ceiling."];
  const RUST = ["Your lookahead called. It wants its job back.", "The cube isn't a fidget toy. Turn it.", "Did you lube the cube with peanut butter?", "Your PB is starting to look like an alibi.", "Those algorithms aren't going to remember themselves."];
  function interval(mean) {
    if (mean < 20) return .5;
    if (mean < 30) return 1;
    if (mean < 120) return 5;
    if (mean < 600) return 20;
    if (!Number.isFinite(mean)) return 20;
    // Extend the supplied bands with the familiar 1–2–5 ladder: ~30 steps per mean.
    const raw = mean / 30, power = 10 ** Math.floor(Math.log10(raw));
    return [1, 2, 5, 10].find(n => n * power >= raw - 1e-9) * power;
  }
  function tier(threshold) { return threshold == null ? 0 : SPECIAL.indexOf(threshold) + 1; }
  function timeLabel(seconds) {
    if (seconds >= 60 && seconds % 60 === 0) return `${seconds / 60} min`;
    return `${Number(seconds.toFixed(1))}s`;
  }
  function subStatus(solves) {
    let sum = 0, dnfs = 0, best = Infinity, current = Infinity;
    for (let i = 0; i < solves.length; i++) {
      const v = C.value(solves[i]);
      if (Number.isFinite(v)) sum += v; else dnfs++;
      if (i >= 500) {
        const old = C.value(solves[i - 500]);
        if (Number.isFinite(old)) sum -= old; else dnfs--;
      }
      if (i >= 499) { current = dnfs ? Infinity : sum / 500; best = Math.min(best, current); }
    }
    // `threshold` is the earned title anchor. Rust is measured from this
    // title's own time, never from the best 500 that happened to earn it.
    const threshold = SPECIAL.findLast(n => best < n - 1e-9) ?? null;
    const step = threshold == null ? null : interval(threshold);
    return { count: solves.length, ready: solves.length >= 500, current, best, threshold, step,
      tier: threshold == null ? 0 : SPECIAL.indexOf(threshold) + 1,
      rusty: threshold != null && Number.isFinite(current) && current > threshold && current > threshold + step + 1e-9 };
  }
  function profile(solves) {
    const result = { best: Infinity, worst: -Infinity, sum: 0, valid: 0, averages: {} };
    for (const s of solves) {
      const v = C.value(s);
      if (!Number.isFinite(v)) continue;
      result.best = Math.min(result.best, v);
      result.worst = Math.max(result.worst, v);
      result.sum += v;
      result.valid++;
    }
    // Keep windows sorted incrementally; do not sort the entire history per solve.
    for (const n of [5, 12, 100]) {
      const sorted = [], values = solves.map(C.value), trim = Math.ceil(n * .05);
      let best = Infinity;
      for (let i = 0; i < values.length; i++) {
        if (i >= n) sorted.splice(sorted.indexOf(values[i - n]), 1);
        let lo = 0, hi = sorted.length;
        while (lo < hi) { const mid = (lo + hi) >>> 1; if (sorted[mid] < values[i]) lo = mid + 1; else hi = mid; }
        sorted.splice(lo, 0, values[i]);
        if (i >= n - 1) {
          let sum = 0;
          for (let j = trim; j < n - trim; j++) sum += sorted[j];
          best = Math.min(best, sum / (n - 2 * trim));
        }
      }
      result.averages[n] = best;
    }
    result.sub = subStatus(solves);
    return result;
  }
  function appendProfile(previous, solves, solve) {
    if (!previous) return profile(solves);
    const value = C.value(solve),
      result = {
        ...previous,
        averages: { ...previous.averages },
      };
    if (Number.isFinite(value)) {
      result.best = Math.min(result.best, value);
      result.worst = Math.max(result.worst, value);
      result.sum += value;
      result.valid++;
    }
    for (const n of [5, 12, 100]) {
      if (solves.length < n) continue;
      const average = C.average(solves.slice(-n), n);
      if (Number.isFinite(average)) result.averages[n] = Math.min(result.averages[n], average);
    }
    const window = solves.slice(-500);
    let sum = 0,
      dnfs = 0;
    for (const item of window) {
      const itemValue = C.value(item);
      if (Number.isFinite(itemValue)) sum += itemValue;
      else dnfs++;
    }
    const current = window.length < 500 || dnfs ? Infinity : sum / 500,
      best = Math.min(previous.sub.best, current),
      threshold = SPECIAL.findLast(n => best < n - 1e-9) ?? null,
      step = threshold == null ? null : interval(threshold);
    result.sub = {
      count: solves.length,
      ready: solves.length >= 500,
      current,
      best,
      threshold,
      step,
      tier: threshold == null ? 0 : SPECIAL.indexOf(threshold) + 1,
      rusty: threshold != null && Number.isFinite(current) && current > threshold && current > threshold + step + 1e-9,
    };
    return result;
  }
  function achievements(before, solves, after = null) {
    const v = C.value(solves.at(-1)), records = [];
    if (Number.isFinite(v) && Number.isFinite(before.best) && v < before.best - 1e-9)
      records.push({ label: "Single PB", value: v, improvement: before.best - v });
    for (const n of [5, 12, 100]) {
      const avg = C.average(solves, n), best = before.averages[n];
      if (Number.isFinite(avg) && Number.isFinite(best) && avg < best - 1e-9)
        records.push({ label: `ao${n} PB`, value: avg, improvement: best - avg });
    }
    const status = after?.sub || subStatus(solves), previous = before.sub;
    const globalMean = (before.sum + (Number.isFinite(v) ? v : 0)) / (before.valid + (Number.isFinite(v) ? 1 : 0));
    const step = interval(globalMean);
    let barrier = null, direction = "down";
    if (status.ready && previous?.ready && Number.isFinite(status.current) && Number.isFinite(previous.current)) {
      if (status.current < previous.current) {
        const boundary = Math.floor((previous.current + 1e-9) / step) * step;
        if (boundary > 0 && status.current < boundary - 1e-9) barrier = (Math.floor((status.current + 1e-9) / step) + 1) * step;
      } else {
        const boundary = (Math.floor((previous.current + 1e-9) / step) + 1) * step;
        if (status.current >= boundary - 1e-9) { barrier = Math.floor((status.current + 1e-9) / step) * step; direction = "up"; }
      }
    }
    const special = status.threshold != null && (!previous?.threshold || status.threshold < previous.threshold) ? status.threshold : null;
    const rusty = status.rusty && !previous?.rusty;
    const recovered = !status.rusty && previous?.rusty;
    return { records, barrier, direction, special, rusty, recovered, status, mean: status.current,
      worst: !records.length && !barrier && !special && !rusty && Number.isFinite(v) && before.valid > 0 && v > before.worst + 1e-9 };
  }
  class Motion {
    constructor() {
      this.canvas = document.createElement("canvas");
      this.canvas.className = "timer-effects";
      this.canvas.setAttribute("aria-hidden", "true");
      this.label = document.createElement("div");
      this.label.className = "timer-achievement";
      this.label.setAttribute("role", "status");
      this.alert = document.createElement("div");
      this.alert.className = "inspection-alert";
      this.alert.setAttribute("role", "status");
      this.shade = document.createElement("div");
      this.shade.className = "timer-achievement-shade";
      this.shade.setAttribute("aria-hidden", "true");
      this.shade.addEventListener("click", () => this.dismissAnnouncement());
      this.label.addEventListener("click", () => this.dismissAnnouncement());
      document.body.append(this.canvas, this.shade, this.label, this.alert);
      this.ctx = this.canvas.getContext("2d");
      this.reduceQuery = matchMedia("(prefers-reduced-motion: reduce)");
      this.resize = () => {
        this.w = innerWidth; this.h = innerHeight;
        const dpr = Math.min(devicePixelRatio || 1, 2);
        this.canvas.width = this.w * dpr; this.canvas.height = this.h * dpr;
        this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
      };
      addEventListener("resize", this.resize);
      this.resize();
      this.raf = 0; this.mode = ""; this.cueBanks = {}; this.lastCueClip = {};
    }
    clear() {
      cancelAnimationFrame(this.raf); clearTimeout(this.labelTimeout);
      this.mode = ""; this.canvas.hidden = true;
      this.label.classList.remove("visible", "leaving", "threshold", "centered");
      this.shade.classList.remove("visible", "leaving");
      this.thresholdAnnouncement = false;
      this.alert.className = "inspection-alert";
      this.alert.textContent = "";
      if (this.cueAudio) { this.cueAudio.pause(); this.cueAudio.currentTime = 0; }
      this.cueAudio = null;
    }
    dismissAnnouncement(instant = false) {
      if (!this.label.classList.contains("visible") && !this.shade.classList.contains("visible")) return;
      clearTimeout(this.labelTimeout);
      this.thresholdAnnouncement = false;
      if (instant || this.reduced) {
        this.label.classList.remove("visible", "leaving", "threshold", "centered");
        this.shade.classList.remove("visible", "leaving");
        return;
      }
      this.label.classList.remove("visible");
      this.label.classList.add("leaving");
      this.shade.classList.remove("visible");
      this.shade.classList.add("leaving");
      setTimeout(() => {
        this.label.classList.remove("leaving", "threshold", "centered");
        this.shade.classList.remove("leaving");
      }, 420);
    }
    prepareInspectionAudio() {
      if (typeof root.Audio !== "function") return;
      for (const cue of [8, 12]) if (!this.cueBanks[cue]) {
        this.cueBanks[cue] = inspectionCuePaths[cue].map(path => {
          const audio = new root.Audio(path); audio.preload = "auto"; audio.load?.(); return audio;
        });
      }
    }
    playInspectionCue(cue) {
      this.prepareInspectionAudio();
      const choice = pickInspectionCue(cue, this.lastCueClip[cue]);
      const audio = choice && this.cueBanks[cue]?.[choice.index];
      if (!audio) return;
      if (this.cueAudio) { this.cueAudio.pause(); this.cueAudio.currentTime = 0; }
      this.lastCueClip[cue] = choice.index; this.cueAudio = audio; audio.currentTime = 0;
      const playback = audio.play();
      if (playback?.catch) playback.catch(() => {});
    }
    origin() {
      const r = document.querySelector("#timer-digits")?.getBoundingClientRect();
      this.cx = r ? r.left + r.width / 2 : this.w / 2;
      this.cy = r ? r.top + r.height / 2 : this.h / 2;
      this.radius = Math.min(this.w * .29, Math.max(110, (r?.width || 200) * .62));
      const styles = getComputedStyle(document.documentElement);
      this.accent = styles.getPropertyValue("--green").trim();
      this.colors = [this.accent, styles.getPropertyValue("--lime").trim(), styles.getPropertyValue("--accent-2").trim(), styles.getPropertyValue("--solid").trim(), styles.getPropertyValue("--ink").trim()];
    }
    start(mode, options = {}) {
      const previousRadius = this.mode === "inspection" ? this.radius : null;
      this.clear(); this.origin(); this.mode = mode; this.options = options;
      this.label.dataset.tier = options.tier || 0;
      this.label.classList.toggle("is-rusty", mode === "rusty");
      this.label.classList.toggle("is-rise", mode === "rise");
      this.label.classList.remove("threshold", "leaving", "centered");
      this.shade.classList.remove("visible", "leaving");
      this.label.style.setProperty("--reward-power", options.tier || 0);
      if (options.tier >= 6) this.colors[2] = "#e5b95f";
      if (mode === "inspection" && options.voice) this.prepareInspectionAudio();
      if (mode === "start" && previousRadius) this.radius = previousRadius;
      this.startTime = performance.now(); this.lastCue = 0;
      this.reduced = this.reduceQuery.matches;
      this.canvas.hidden = this.reduced || !this.ctx;
      this.pieces = Array.from({ length: Math.min(420, 40 + (options.tier || 0) * 32) }, (_, i) => {
        const side = i % 2 ? 1 : -1, depth = .6 + Math.random() * .8;
        return { x: this.w * (side < 0 ? .12 : .88), y: this.h * 1.03,
          vx: -side * (120 + Math.random() * this.w * .29), vy: -(this.h * (.68 + Math.random() * .55)),
          spin: (Math.random() - .5) * 12, angle: Math.random() * 6.28,
          size: (3 + Math.random() * 5) * depth, depth, delay: Math.random() * (options.single ? .22 : .65), color: this.colors[i % 5] };
      });
      this.frame(this.startTime);
    }
    announce(title, details = [], eyebrow = "", hero = "") {
      this.label.replaceChildren();
      if (eyebrow) { const kicker = document.createElement("small"); kicker.textContent = eyebrow; this.label.append(kicker); }
      if (hero) { const number = document.createElement("b"); number.className = "reward-hero"; number.textContent = hero; this.label.append(number); }
      const head = document.createElement("strong"); head.textContent = title; this.label.append(head);
      for (const detail of details) { const line = document.createElement("span"); line.textContent = detail; this.label.append(line); }
      const threshold = Boolean(this.options?.threshold);
      this.label.classList.toggle("threshold", threshold);
      // Positive rewards share the threshold's centre stage; only setbacks stay under the timer.
      const centered = !threshold && Boolean(this.options?.centered);
      this.label.classList.toggle("centered", centered);
      // Every centre-stage reward is modal: shade behind it, dismissed by a click.
      const modal = threshold || centered;
      this.thresholdAnnouncement = modal;
      if (modal) this.shade.classList.add("visible");
      this.label.classList.add("visible");
      if (!modal) this.labelTimeout = setTimeout(() => this.dismissAnnouncement(), 3000);
    }
    celebrate(event) {
      const { records = [], barrier, worst, special, rusty, recovered, status, direction } = event;
      const lead = records.reduce((best, r) => !best || r.improvement / (r.value + r.improvement) > best.improvement / (best.value + best.improvement) ? r : best, null);
      const gain = lead ? lead.improvement / (lead.value + lead.improvement) : 0;
      const power = special ? tier(special) : lead ? Math.min(8, 1 + (gain >= .01 ? 1 : 0) + (gain >= .05 ? 2 : 0) + (gain >= .15 ? 2 : 0) + Math.min(2, records.length - 1)) : recovered || rusty ? tier(status.threshold) : 0;
      this.start(special ? "barrier" : records.length ? "record" : rusty ? "rusty" : recovered ? "barrier" : barrier ? direction === "up" ? "rise" : "barrier" : worst ? "worst" : "stop", { tier: power, single: records.some(r => r.label === "Single PB"), barrier: special || barrier, threshold: Boolean(special), centered: Boolean(special || records.length || recovered || (barrier && direction !== "up")) });
      const details = records.map(r => `${r.label} · ${C.format(r.value)} · ${C.format(r.improvement)} faster`);
      if (rusty) details.push(`Rusty sub ${timeLabel(status.threshold)} · ${RUST[Math.floor(Math.random() * RUST.length)]}`);
      if (special) this.announce(`You're now sub ${timeLabel(special)}`, [`Last 500 · ${C.format(status.current)} · Title earned`, ...details], TITLES[SPECIAL.indexOf(special)], `SUB ${timeLabel(special)}`);
      else if (records.length) this.announce(records.length > 1 ? `${records.length} records. One solve.` : `${lead.label} — yours to keep.`, details, gain >= .15 ? "Personal best • demolished" : gain >= .05 ? "Personal best • breakthrough" : "Personal best • a new mark", C.format(lead.value));
      else if (rusty) this.announce(`You're now a Rusty sub ${timeLabel(status.threshold)}`, [RUST[Math.floor(Math.random() * RUST.length)], `Last 500 · ${C.format(status.current)} · Your title stays yours`], "A little oxidation", `SUB ${timeLabel(status.threshold)}`);
      else if (recovered) this.announce("Rust off. Hands back.", [`Last 500 · ${C.format(status.current)}`], "Back in form", `SUB ${timeLabel(status.threshold)}`);
      else if (barrier) this.announce(direction === "up" ? `Back above ${timeLabel(barrier)}` : `You're now sub ${timeLabel(barrier)}`, [`Last 500 · ${C.format(status.current)}`, direction === "up" ? "A detour. Keep turning." : "Five hundred solves. Real progress."], direction === "up" ? "Pace check" : "Another barrier down");
      else if (worst) this.announce("Slowest solve so far", ["Reset. Take your time."]);
    }
    ring(radius, alpha, color, width = 1) {
      const c = this.ctx; c.globalAlpha = Math.max(0, alpha); c.strokeStyle = color; c.lineWidth = width;
      c.beginPath(); c.arc(this.cx, this.cy, Math.max(1, radius), 0, Math.PI * 2); c.stroke();
    }
    wave(t, duration = .85, color = this.accent) {
      if (t > duration) return;
      const c = this.ctx, progress = t / duration, max = Math.hypot(this.w, this.h) * .65;
      const r = max * (1 - Math.pow(1 - progress, 2));
      this.ring(r, (1 - progress) * .3, color, 1.2);
      this.ring(r * .87, (1 - progress) * .13, color);
      const step = Math.max(28, Math.sqrt(this.w * this.h / 1500));
      for (let x = 0; x < this.w; x += step) for (let y = 0; y < this.h; y += step) {
        const dx = x - this.cx, dy = y - this.cy, d = Math.hypot(dx, dy) || 1;
        const envelope = Math.exp(-Math.pow((d - r) / 75, 2)), displacement = Math.sin((d - r) / 29) * 15 * envelope;
        c.globalAlpha = envelope * (1 - progress) * .58; c.fillStyle = color;
        c.fillRect(x + dx / d * displacement, y + dy / d * displacement, 1.4 + envelope * 1.5, 1.4 + envelope * 1.5);
      }
    }
    inspection(t, now) {
      const c = this.ctx, elapsed = (now - this.options.since) / 1000;
      const color = elapsed >= 15 ? "#ce675e" : elapsed >= 12 ? "#cc854e" : elapsed >= 8 ? "#b69855" : this.accent;
      const cue = elapsed >= 12 ? 12 : elapsed >= 8 ? 8 : 0;
      if (cue > this.lastCue) {
        this.lastCue = cue;
        if (this.options.voice && elapsed - cue < .8) this.playInspectionCue(cue);
      }
      const alertText = elapsed >= 17 ? "DNF • inspection expired" : elapsed >= 15 ? "+2 PENALTY • START NOW" : elapsed >= 12 ? `${Math.ceil(15 - elapsed)} SECONDS • START YOUR SOLVE` : "";
      if (this.alert.textContent !== alertText) this.alert.textContent = alertText;
      this.alert.className = `inspection-alert${elapsed >= 12 ? " visible" : ""}${elapsed >= 15 ? " penalty" : ""}`;
      if (this.reduced || !c) return;
      if (elapsed >= 12) {
        const pulse = .5 + .5 * Math.cos(elapsed * Math.PI * 2);
        c.globalAlpha = .08 + .10 * pulse; c.strokeStyle = color; c.lineWidth = 18 + 12 * pulse;
        c.strokeRect(0, 0, this.w, this.h);
        this.ring(this.radius * (1.06 + .09 * pulse), .35 + .3 * pulse, color, 5 + pulse * 4);
      }
      const r = this.radius * (1 - .05 * Math.min(1, Math.max(0, elapsed - 12) / .4)), assembly = Math.min(1, t / .65);
      this.ring(r, (elapsed >= 15 ? .45 : .13) * assembly, color, elapsed >= 15 ? 1.6 : 1);
      c.strokeStyle = color; c.lineWidth = 2; c.globalAlpha = .75 * assembly;
      c.beginPath(); c.arc(this.cx, this.cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(.001, 1 - elapsed / 15)); c.stroke();
      for (let i = 0; i < 100; i++) {
        const angle = i * Math.PI * 2 / 100 + t * .025, drift = 5 * Math.sin(t * .7 + i * 2.4);
        const rr = r + drift + (1 - assembly) * 28;
        c.globalAlpha = (.15 + .3 * (1 + Math.sin(i * 1.7 + t)) / 2) * assembly;
        c.fillStyle = color; c.beginPath(); c.arc(this.cx + Math.cos(angle) * rr, this.cy + Math.sin(angle) * rr, i % 5 ? 1 : 1.8, 0, 6.29); c.fill();
      }
      for (const mark of [8, 12, 12.24, 13, 14, 15]) if (elapsed >= mark && elapsed < mark + .75) this.wave(elapsed - mark, .75, color);
    }
    breakthrough(t) {
      if (t > 3) return;
      const c = this.ctx, span = Math.min(this.w * .82, 1160);
      const gather = Math.min(1, t / .5), release = Math.max(0, (t - .5) / 2.5);
      const split = 1 - Math.pow(1 - release, 3), fade = Math.min(1, (3 - t) * 1.8);
      // Strands converge into a threshold, then peel apart in a travelling wave.
      for (let band = 0; band < 12; band++) {
        c.beginPath(); c.lineWidth = band % 3 ? .7 : 1.3; c.strokeStyle = this.colors[band % 5];
        c.globalAlpha = (.18 + .16 * Math.sin(gather * Math.PI / 2)) * fade;
        for (let i = 0; i <= 90; i++) {
          const u = i / 90, x = this.cx + (u - .5) * span;
          const wave = Math.sin(u * Math.PI) * Math.sin(u * 5 + band * .33 + release * 3);
          const side = band % 2 ? 1 : -1;
          const y = this.cy + (1 - gather) * Math.sin(u * 8 + band) * 60
            + side * split * (28 + band * 12) * Math.sin(u * Math.PI)
            + wave * split * 45;
          if (!i) c.moveTo(x, y); else c.lineTo(x, y);
          if (i % 6 === 0) {
            c.fillStyle = this.colors[band % 5]; c.fillRect(x, y, 2, 2);
          }
        }
        c.stroke();
      }
      if (t >= .5 && t < 1.2) this.wave(t - .5, .7, this.colors[2]);
    }
    frame(now) {
      if (!this.mode) return;
      const t = (now - this.startTime) / 1000, c = this.ctx;
      if (c) { c.clearRect(0, 0, this.w, this.h); c.globalAlpha = 1; }
      if (this.mode === "inspection") this.inspection(t, now);
      else if (!this.reduced && c) {
        if (["start", "stop", "record", "barrier"].includes(this.mode)) this.wave(t, this.mode === "start" ? .65 : .85);
        if (this.mode === "start" && t < .5) this.ring(this.radius * (1 + t * 2), (.5 - t) * .4, this.accent);
        if (this.mode === "barrier" || this.options.barrier) this.breakthrough(t);
        const power = this.options.tier || 0;
        if (power >= 3 && ["record", "barrier"].includes(this.mode) && t < 3.8) {
          const release = Math.max(0, t - .25), fade = Math.max(0, 1 - release / 3.5);
          for (let i = 0; i < power; i++) this.ring(this.radius * (.6 + release * (.6 + i * .065)), fade * .25, this.colors[i % 5], i % 3 ? 1 : 3);
          if (power >= 7) for (let i = 0; i < power * 8; i++) {
            const angle = i * 6.283 / (power * 8) + t * .06, r = this.radius * (1 + release * .9);
            c.globalAlpha = fade * .6; c.strokeStyle = this.colors[i % 5]; c.lineWidth = i % 4 ? 1 : 2;
            c.beginPath(); c.moveTo(this.cx + Math.cos(angle) * r, this.cy + Math.sin(angle) * r);
            c.lineTo(this.cx + Math.cos(angle) * (r + 30 + power * 4), this.cy + Math.sin(angle) * (r + 30 + power * 4)); c.stroke();
          }
        }
        if (this.mode === "record" || this.mode === "barrier" && power >= 2) for (const p of this.pieces) {
          const age = t - .18 - p.delay; if (age < 0) continue;
          const drag = (1 - Math.exp(-age * .8)) / .8;
          const x = p.x + p.vx * drag + Math.sin(age * 3 + p.angle) * 18 * age;
          const y = p.y + p.vy * drag + 180 * age * age;
          c.save(); c.translate(x, y); c.rotate(p.angle + age * p.spin); c.scale(1, Math.cos(age * 8 * p.depth + p.angle));
          c.globalAlpha = Math.max(0, Math.min(1, (4.2 - t) / .8)) * .85; c.fillStyle = p.color;
          c.fillRect(-p.size / 2, -p.size / 4, p.size, p.size * .55); c.restore();
        }
        if (this.mode === "rusty") {
          for (let i = 0; i < 65; i++) {
            const angle = i * 2.399, r = this.radius * (.7 + (i % 7) / 12);
            c.globalAlpha = Math.max(0, 1 - t / 3) * .55; c.fillStyle = "#b77b50";
            c.fillRect(this.cx + Math.cos(angle) * r, this.cy + Math.sin(angle) * r + t * t * 34, 2 + i % 3, 2);
          }
        }
        if (this.mode === "worst" || this.mode === "expiry") {
          if (this.mode === "worst") this.wave(t, .85, "#c68d61");
          const duration = this.mode === "expiry" ? 1.1 : 1.4, p = Math.min(1, t / duration);
          if (this.mode === "worst") {
            for (let band = 0; band < 3; band++) {
              c.beginPath(); c.strokeStyle = "#c68d61"; c.lineWidth = .8;
              c.globalAlpha = Math.sin(p * Math.PI) * .26;
              for (let i = 0; i <= 60; i++) {
                const a = i * 6.283 / 60, fracture = Math.sin(i * 2.399 + band) * 22 * Math.sin(p * Math.PI);
                const r = this.radius + 16 * band - 25 * Math.sin(p * Math.PI) + fracture;
                const x = this.cx + Math.cos(a) * r, y = this.cy + Math.sin(a) * r;
                if (!i) c.moveTo(x, y); else c.lineTo(x, y);
              }
              c.stroke();
            }
          }
          for (let i = 0; i < 90; i++) {
            const a = i * 6.283 / 90, r = this.radius * (1 - .15 * Math.sin(p * Math.PI)) + Math.sin(i * 5) * 16 * Math.sin(p * Math.PI);
            c.globalAlpha = (1 - p) * .65; c.fillStyle = "#c68d61";
            c.fillRect(this.cx + Math.cos(a) * r, this.cy + Math.sin(a) * r + (this.mode === "expiry" ? p * p * 100 : 0), 2, 2);
          }
        }
      }
      const duration = this.mode === "start" ? .7 : this.mode === "stop" ? .9 : this.mode === "worst" ? 1.5 : this.mode === "expiry" ? 1.2 : 4.3;
      if (this.mode === "inspection" || t < duration) this.raf = requestAnimationFrame(n => this.frame(n));
      else { this.canvas.hidden = true; this.mode = ""; }
    }
  }
  const api = { profile, appendProfile, achievements, subStatus, interval, tier, timeLabel, SPECIAL, TITLES, RUST, inspectionCuePaths, pickInspectionCue, Motion };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.CTEffects = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
