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
  // Twelve titles. The index + 1 is the "tier" used by rank-cards.css (tier 0 = not ranked yet).
  const SPECIAL = [60, 45, 30, 25, 20, 15, 12, 10, 8, 7, 6, 5];
  // Solves faster than this are almost certainly an accidental press: no reward, just a joke.
  const MIN_REWARD_SOLVE = 2.5;
  const TITLES = ["First horizon", "Finding your flow", "Half a minute. Whole new level.", "Speed takes shape", "The twenty barrier falls", "Serious speed", "New speed class", "Single-digit territory", "Beyond fast", "Rare air", "Human highlight reel", "Five seconds. No ceiling."];
  const RUST = ["Your lookahead called. It wants its job back.", "The cube isn't a fidget toy. Turn it.", "Did you lube the cube with peanut butter?", "Your PB is starting to look like an alibi.", "Those algorithms aren't going to remember themselves."];
  // Every reward owns a pool of lines; plan() picks one so the same moment never reads the same twice.
  const COPY = {
    pb: ["Record broken. Literally.", "You broke your own record. Clean break.", "It was a good record. Now it's pieces.", "Handle with care: the old one didn't make it."],
    worst: ["Even the best take the scenic route.", "Slowest on record. Fastest to forget.", "The cube won that one. Rematch?"],
    detour: ["The tide comes in. It also goes out.", "Water finds its level. So will you.", "One bad week isn't a trend."],
    unlock: ["Five hundred solves. Real progress.", "That line was there to be crossed."],
    accident: ["You can't do it that fast.", "You're not that good.", "Come on, man...", "This is ridiculous. Just delete it.", "Yiheng, is it you?", "Accident, or a 9-year-old Chinese kid?", "Even Xuanyi can't do this...", "LMAO sure.", "Scramble again...", "Who are you trying to fool?", "Delete this time unless your name is Xuanyi.", "Sucks when this happens.", "The timer started before the cube did.", "That's not a solve, that's a sneeze.", "Did the cat walk on the spacebar?", "The cube was never even scrambled, was it?", "Nice try. The cube saw nothing.", "Sub-2.5 on a 3x3? In this economy?", "Your finger slipped. Your ego didn't.", "Even the timer is embarrassed for you.", "Reality called. It wants its physics back.", "A solve? In that time? Come on.", "Oh, so now you're the world record?", "Bro pressed the spacebar twice.", "Pretty sure the cube is still scrambled.", "Mirror scramble? No? Then no.", "That's called a misclick, champ.", "Feliks would like a word.", "You blinked and it started. Classic.", "Not even a robot does that. And you're not a robot. Right?", "The solve is lying. The timer knows.", "Delete it before anyone sees.", "Great pop. Terrible solve.", "Fastest solve in history, according to nobody.", "This one counts as a warm-up. For your thumb.", "Speedcubing is hard. Cheating is harder.", "Nice stackmat. Shame about the hands.", "That time wasn't earned. It was dropped.", "The spacebar is not a personality.", "Sure, and I'm the Pope.", "Look, the cube didn't do anything wrong here.", "This is not the way. Delete.", "Your fingers moved faster than your brain. Obviously.", "Easy there, Max Park.", "If this were real, you'd be on the news.", "Next time, try using the cube.", "Hands off the keyboard, genius.", "Tell me you misclicked without telling me you misclicked.", "This time was brought to you by a shaky thumb.", "We'll pretend we didn't see that.", "Zero reward for zero effort.", "Did you even touch the cube?", "That's a no from me, chief.", "Are you sure your cube isn't a pocket calculator?", "No trophy for physics violations.", "Hard pass.", "Okay, but now do it for real.", "You found the fastest way to waste a solve.", "Accident? Accident. Obviously accident."],
  };
  // Which effect plays for which title tier (1 = Sub 60 … 12 = Sub 5).
  const TITLE_EFFECT = ["sunrise", "sunrise", "aurora", "aurora", "aurora", "warp", "warp", "warp", "forge", "forge", "forge", "singularity"];
  const esc = s => String(s).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
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
        records.push({ label: `ao${n} PB`, value: avg, improvement: best - avg, window: solves.slice(-Math.min(n, 12)).map(C.value) });
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
    return { records, barrier, direction, step, special, rusty, recovered, status, mean: status.current, time: v,
      worst: !records.length && !barrier && !special && !rusty && Number.isFinite(v) && before.valid > 0 && v > before.worst + 1e-9 };
  }

  const heroLabel = n => String(Number(n.toFixed(2)));
  /* Turns an achievements() result into what the player should see: which effect, the data it needs, and the label.
     Pure and deterministic given rng, so it is tested without a browser. Priority: accident > title > record >
     rust > recovery > barrier > slowest > ordinary. */
  function plan(event, rng = Math.random) {
    const pick = list => list[Math.floor(rng() * list.length)];
    const { records = [], barrier, direction, step, special, rusty, recovered, worst, status, time } = event;
    const text = Number.isFinite(time) ? C.format(time) : "DNF", last500 = `Last 500 · ${C.format(status?.current)}`;
    const out = (id, card = null, data = {}) => ({ id, card, data: { time, text, ...data } });
    const recordLines = records.map(r => `${r.label} · ${C.format(r.value)} · ${C.format(r.improvement)} faster`);
    const shortName = r => r.label.replace(" PB", "");
    if (Number.isFinite(time) && time < MIN_REWARD_SOLVE)
      return out("accident", { skin: "muted", eyebrow: `Under ${MIN_REWARD_SOLVE} s · no reward`, title: pick(COPY.accident), lines: ["Probably an accidental press."], modal: false });
    if (special) {
      const t = tier(special);
      return out(TITLE_EFFECT[t - 1], { tier: t, eyebrow: TITLES[t - 1], hero: `SUB ${heroLabel(special)}`, title: `You're now sub ${timeLabel(special)}`, lines: [`${last500} · Title earned`, ...recordLines], modal: true, big: true }, { tier: t });
    }
    if (records.length > 1) {
      const words = ["", "", "Two", "Three", "Four"], n = records.length;
      return out("prism", { skin: "gold", eyebrow: `Personal best · ${words[n].toLowerCase()} in one`, hero: `×${n}`, title: `${words[n]} records. One solve.`, lines: recordLines, modal: true },
        { recs: records.map(r => ({ name: shortName(r), value: C.format(r.value) })) });
    }
    if (records.length === 1) {
      const r = records[0], old = r.value + r.improvement;
      if (r.label === "Single PB")
        return out("shatter", { skin: "gold", eyebrow: "Record broken", hero: `−${C.format(r.improvement)}`, title: pick(COPY.pb), lines: [`${C.format(r.value)} · the old mark was ${C.format(old)}`, `${(r.improvement / old * 100).toFixed(1)}% faster than ever before`], modal: true, big: true }, { oldText: C.format(old) });
      const name = shortName(r);
      return out("settle", { skin: "gold", eyebrow: "Personal best · settled", hero: C.format(r.value), title: r.label, lines: [`${C.format(r.improvement)} faster than ${C.format(old)}`, "Best and worst trimmed. Everything else, level."], modal: true },
        { label: name, avg: r.value, old, avgText: C.format(r.value), oldText: C.format(old), bars: r.window });
    }
    if (rusty) {
      const t = tier(status.threshold);
      return out("oxidation", { tier: t, rusty: true, eyebrow: "A little oxidation", hero: `SUB ${heroLabel(status.threshold)}`, title: `You're now a Rusty sub ${timeLabel(status.threshold)}`, lines: [pick(RUST), `${last500} · Your title stays yours`], modal: false });
    }
    if (recovered) {
      const t = tier(status.threshold);
      return out("polish", { tier: t, eyebrow: "Back in form", hero: `SUB ${heroLabel(status.threshold)}`, title: "Rust off. Hands back.", lines: [last500, "Shiny again."], modal: false });
    }
    if (barrier) {
      const label = timeLabel(barrier), data = { barrier, barrierText: barrier.toFixed(2) };
      if (direction === "up")
        return out("seal", { skin: "amber", eyebrow: "Pace check", title: `Back above ${label}`, lines: [last500, pick(COPY.detour)], modal: false }, data);
      const next = step ? `Next barrier: ${Number((barrier - step).toFixed(2))}` : "";
      return out("breach", { skin: "plain", eyebrow: "Another barrier down", hero: `SUB ${heroLabel(barrier)}`, title: `You're now sub ${label}`, lines: [last500, next ? `${pick(COPY.unlock)} ${next}.` : pick(COPY.unlock)], modal: false }, data);
    }
    if (worst) return out("thud", { skin: "muted", eyebrow: "Slowest solve so far", title: pick(COPY.worst), lines: ["Reset. Take your time."], modal: false });
    return Number.isFinite(time) ? out("ripple") : out("none");
  }

  /* ───── Animation Studio: every moment the player can earn, as an event the real pipeline understands ───── */
  function demoGroups() {
    return [
      { label: "Personal bests", options: [["single", "A single PB"], ["average", "An average PB"], ["stack", "Four records at once"]] },
      { label: "Everyday", options: [["ordinary", "An ordinary solve"], ["barrier-down", "A barrier crossed"], ["barrier-up", "Back above a barrier"], ["worst", "The slowest solve yet"], ["accident", "Under 2.5 seconds"]] },
      { label: "Title unlocked", options: SPECIAL.map(n => [`sub-${n}`, `Sub ${timeLabel(n)} · level ${tier(n)}`]) },
      { label: "Rust & recovery", options: [...SPECIAL.map(n => [`rust-${n}`, `Rusty sub ${timeLabel(n)}`]), ["recovery", "Shake off the rust"]] },
    ];
  }
  function demoEvent(id) {
    const m = /^(sub|rust)-(\d+(?:\.\d+)?)$/.exec(id), n = m ? Number(m[2]) : 10, t = tier(n);
    const status = { ready: true, count: 1500, best: n - .02, current: n - .02, threshold: n, step: interval(n), tier: t, rusty: false };
    const event = { records: [], status, time: Number((n * .985).toFixed(2)) };
    const run = [10.9, 9.6, 11.8, 10.2, 9.1, 12.9, 10.6, 9.8, 10.4, 9.7, 10.9, 9.9];
    const rec = (label, value, improvement, n) => ({ label, value, improvement, window: run.slice(-n) });
    if (m?.[1] === "sub") event.special = n;
    else if (m) { event.rusty = status.rusty = true; status.current = n + interval(n - 1e-7) + .15; event.time = Number((status.current + .2).toFixed(2)); }
    else if (id === "recovery") { event.recovered = true; event.time = Number((n - .02).toFixed(2)); }
    else if (id === "single") { event.time = 8.42; event.records = [rec("Single PB", 8.42, 2.57, 1)]; }
    else if (id === "average") { event.time = 9.04; event.records = [rec("ao12 PB", 10.77, .23, 12)]; }
    else if (id === "stack") { event.time = 9.04; event.records = [rec("Single PB", 9.04, .41, 1), rec("ao5 PB", 10.2, .23, 5), rec("ao12 PB", 10.77, .12, 12), rec("ao100 PB", 11.31, .05, 12)]; }
    else if (id === "barrier-down" || id === "barrier-up") {
      const up = id === "barrier-up"; Object.assign(event, { barrier: 13.5, direction: up ? "up" : "down", step: .5, time: up ? 13.9 : 13.31 }); status.current = up ? 13.53 : 13.49;
    }
    else if (id === "worst") { event.worst = true; event.time = 21.37; }
    else if (id === "accident") event.time = 1.87;
    else event.time = 11.62;   /* "ordinary" */
    return event;
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
      this.lift = 0;
      addEventListener("resize", () => { if (this.showing) this.place(); });
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
      // The reward engine (reward-fx.js) draws on this canvas and shows its card through present().
      this.rewards = root.CTRewardFX?.create({ canvas: this.canvas, present: card => this.present(card), dismiss: () => this.dismissAnnouncement() });
    }
    /* True when rewards must be still: Settings → Reward animations is off, or the OS asks for reduced motion. */
    get still() { return this.reduceQuery.matches || Boolean(root.CTRank?.motionOff()); }
    clear() {
      cancelAnimationFrame(this.raf); clearTimeout(this.labelTimeout);
      this.rewards?.reset();
      this.mode = ""; this.canvas.hidden = true;
      this.hideLabel();
      this.alert.className = "inspection-alert";
      this.alert.textContent = "";
      if (this.cueAudio) { this.cueAudio.pause(); this.cueAudio.currentTime = 0; }
      this.cueAudio = null;
    }
    hideLabel() {
      this.label.classList.remove("visible", "leaving", "modal");
      this.shade.classList.remove("visible", "leaving");
      root.CTRank?.unmount(this.label);
      this.lift = 0; document.querySelector(".focus-row")?.style.removeProperty("--reward-lift");
    }
    dismissAnnouncement(instant = false) {
      if (!this.label.classList.contains("visible") && !this.shade.classList.contains("visible")) return;
      clearTimeout(this.labelTimeout);
      this.rewards?.endCinema();
      if (instant || this.still) { this.hideLabel(); return; }
      this.label.classList.remove("visible");
      this.label.classList.add("leaving");
      this.shade.classList.remove("visible");
      this.shade.classList.add("leaving");
      setTimeout(() => { if (!this.label.classList.contains("visible")) this.hideLabel(); }, 420);
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
    /* The short motions around the timer itself: "start" and "stop" ripple, "expiry" crumble, "inspection" ring. */
    start(mode, options = {}) {
      const previousRadius = this.mode === "inspection" ? this.radius : null;
      this.clear(); this.origin(); this.mode = mode; this.options = options;
      if (mode === "inspection" && options.voice) this.prepareInspectionAudio();
      if (mode === "start" && previousRadius) this.radius = previousRadius;
      this.startTime = performance.now(); this.lastCue = 0;
      this.reduced = this.still;
      this.canvas.hidden = this.reduced || !this.ctx;
      this.frame(this.startTime);
    }
    /* Shows a reward card. card = { skin | tier+rusty, eyebrow, hero, title, lines, modal, big }.
       A tier makes it a rank card (same materials as the Overview card); otherwise a plain skin is used. */
    present(card) {
      const { skin = "plain", tier = 0, rusty = false, eyebrow = "", hero = "", title = "", lines = [], modal = false, big = false } = card;
      const text = (cls, tag, content, extra = "") => content ? `<${tag} class="${cls}"${extra}>${esc(content)}</${tag}>` : "";
      const letters = [...hero].map((ch, i) => `<i style="--i:${i}">${ch === " " ? "&nbsp;" : esc(ch)}</i>`).join("");
      this.hideLabel();
      this.label.className = `timer-achievement${tier ? " rank-card" : ""}${rusty ? " is-rusty" : ""}${modal ? " modal" : ""}`;
      const frame = root.CTRank ? root.CTRank.frame(tier) : tier;   /* the card design this level wears */
      this.label.dataset.tier = frame; this.label.dataset.skin = tier ? "rank" : skin; this.label.dataset.big = big;
      this.label.innerHTML = (tier && root.CTRank ? root.CTRank.layers(frame) : "")
        + text("reward-eyebrow metric-label", "small", eyebrow)
        + (hero ? `<b class="reward-hero metric-value" aria-label="${esc(hero)}">${letters}</b>` : "")
        + text("reward-title rank-title", "strong", title)
        + lines.map((line, i) => text("reward-line metric-foot", "span", line, ` style="--i:${i}"`)).join("");
      this.place();
      root.CTRank?.mount(this.label);
      if (modal) this.shade.classList.add("visible");
      void this.label.offsetWidth;
      this.label.classList.add("visible");
      /* No timer: a card stays until the next solve begins, the solve is changed or deleted, you click it, or press Esc. */
    }
    /* Where the card goes: directly under the lowest control of the timer (the OK / +2 / DNF row), never over it.
       When the window is too short for that, the whole timer block slides up by exactly the missing amount. */
    place() {
      const box = this.label, gap = 22, edge = 16;
      const row = document.querySelector(".focus-row");
      if (row) { row.style.transition = "none"; row.style.setProperty("--reward-lift", "0px"); void row.offsetHeight; row.style.transition = ""; }   /* measure the resting layout */
      const digits = document.querySelector("#timer-digits")?.getBoundingClientRect();
      const result = document.querySelector("#timer-result");
      const lowest = result?.offsetHeight && result.children.length ? result.getBoundingClientRect() : digits;
      const stage = document.querySelector(".focus-stage")?.getBoundingClientRect();
      const panelEl = document.querySelector(".solve-panel");   /* sizes, not positions: the panel slides in and out while you solve */
      const pw = panelEl?.offsetWidth || 0, ph = panelEl?.offsetHeight || 0;
      const bottomPanel = pw >= innerWidth * .5 && ph > 0;      /* phones: the list sits under the timer */
      const stageR = stage?.right ?? innerWidth, stageB = stage?.bottom ?? innerHeight;
      /* The card lives in the free area: right of the navigation, left of a side panel, above a bottom panel. */
      const areaL = stage ? stage.left : 0, areaR = pw && !bottomPanel ? stageR - pw : stageR;
      box.style.setProperty("--ach-max", `${Math.max(240, areaR - areaL - edge * 2)}px`);
      const w = box.offsetWidth, h = box.offsetHeight;
      if (!lowest?.width && !lowest?.height) {   /* no timer on screen */
        box.style.setProperty("--ach-x", `${innerWidth / 2}px`); box.style.setProperty("--ach-y", `${innerHeight * .72}px`);
        return;
      }
      const limit = Math.min(innerHeight, stageB) - (bottomPanel ? ph : 0) - edge;
      const naturalBottom = lowest.bottom;                                /* where the controls sit with no card */
      const topLimit = row ? row.getBoundingClientRect().top : edge;
      const room = Math.max(0, topLimit - 8);                            /* how far the timer block may rise */
      let space = gap, need = Math.max(0, naturalBottom + space + h - limit);
      if (need > room) { space = 10; need = Math.max(0, naturalBottom + space + h - limit); }   /* tight window: close the gap before giving up */
      this.lift = Math.min(need, room);
      row?.style.setProperty("--reward-lift", `${this.lift}px`);
      const cx = digits?.width ? digits.left + digits.width / 2 : innerWidth / 2;
      const x = Math.min(Math.max(cx, areaL + w / 2 + edge), areaR - w / 2 - edge);
      const y = Math.min(naturalBottom - this.lift + space + h / 2, innerHeight - h / 2 - edge);
      box.style.setProperty("--ach-x", `${x}px`); box.style.setProperty("--ach-y", `${y}px`);
    }
    /* True while a card is up. */
    get showing() { return this.label.classList.contains("visible"); }
    /* A finished solve. The plan says which effect; with motion off the card appears at once and nothing moves. */
    celebrate(event, rng) {
      const p = plan(event, rng);
      this.clear(); this.origin();
      this.reduced = this.still;
      if (p.id === "none") { this.start("stop"); return; }
      if (this.reduced || !this.rewards) { if (p.card) this.present(p.card); return; }
      this.rewards.play(p);
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
    frame(now) {
      if (!this.mode) return;
      const t = (now - this.startTime) / 1000, c = this.ctx;
      if (c) { c.clearRect(0, 0, this.w, this.h); c.globalAlpha = 1; }
      if (this.mode === "inspection") this.inspection(t, now);
      else if (!this.reduced && c) {
        if (this.mode === "start" || this.mode === "stop") this.wave(t, this.mode === "start" ? .65 : .85);
        if (this.mode === "start" && t < .5) this.ring(this.radius * (1 + t * 2), (.5 - t) * .4, this.accent);
        if (this.mode === "expiry") {
          const p = Math.min(1, t / 1.1);
          for (let i = 0; i < 90; i++) {
            const a = i * 6.283 / 90, r = this.radius * (1 - .15 * Math.sin(p * Math.PI)) + Math.sin(i * 5) * 16 * Math.sin(p * Math.PI);
            c.globalAlpha = (1 - p) * .65; c.fillStyle = "#c68d61";
            c.fillRect(this.cx + Math.cos(a) * r, this.cy + Math.sin(a) * r + p * p * 100, 2, 2);
          }
        }
      }
      const duration = this.mode === "start" ? .7 : this.mode === "stop" ? .9 : this.mode === "expiry" ? 1.2 : 0;
      if (this.mode === "inspection" || t < duration) this.raf = requestAnimationFrame(n => this.frame(n));
      else { this.canvas.hidden = true; this.mode = ""; }
    }
  }
  const api = { profile, appendProfile, achievements, plan, demoGroups, demoEvent, subStatus, interval, tier, timeLabel, SPECIAL, TITLES, TITLE_EFFECT, RUST, COPY, MIN_REWARD_SOLVE, inspectionCuePaths, pickInspectionCue, Motion };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.CTEffects = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
