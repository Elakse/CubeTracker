/* Insights screen: five cards, one self-contained component (window.CTInsights).

   Two halves, so the maths can be tested without a browser:

   MODEL  (pure functions, no DOM)
     niceTicks(min, max, count)        round axis values: { min, max, step, ticks }
     histogram(values, maxBins)        bins on round edges: { lo, step, bins:[{from,to,count}], total, top }
     records(solves, value)            every new personal best: [{ i, v, id }]
     bestAt(records, i)                the record standing after solve i
     weekdayCounts(solves, dateOf)     Monday-first counts, 7 numbers
     regression(ys)                    least-squares line over the defined points, or null
     bestAverage(solves, n, average)   best rolling average of n, or null
     sample(ys, max)                   indices to draw: stride plus first and last
     autoWindow(n)                     how many solves each point of the consistency line covers

   VIEW   create(host, ctx) -> { destroy() }
     host   the element to fill
     ctx    everything the component needs from the app, so it knows nothing about it:
              data()                solves of the chosen range, oldest first
              target()              the sub-T goal, in seconds
              value(s), format(v, digits)   seconds (Infinity for DNF) and its text
              average(list, n)      trimmed average of a list
              subSeries(list, n, T) rolling % under T, null until the window is full
              stats(list)           { valid, median, sd, ... }
              dateOf(s), dayLabel(s)   Date or null, and a short label such as "Jul 3"
              number(s)             the solve's position in the whole category (1-based)
              esc(text), icon(name)
              open(id)              show the solve dialog
              reduced()             prefers-reduced-motion
              animate               true on the first paint of a visit, so charts draw in once
   Every chart is drawn at its real pixel size and redrawn when its box resizes. */
(function (root) {
  "use strict";

  /* ------------------------------------------------------------------ model */
  const round = (v, d = 10) => Math.round(v * 10 ** d) / 10 ** d;

  /* Axis values on round numbers that cover [min, max]. */
  function niceTicks(min, max, count = 4) {
    if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1, step: 1, ticks: [0, 1] };
    if (max <= min) { const pad = Math.abs(min) * 0.05 || 1; min -= pad; max += pad; }
    const rough = (max - min) / count, mag = 10 ** Math.floor(Math.log10(rough)), norm = rough / mag;
    const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
    const lo = round(Math.floor(min / step + 1e-9) * step), hi = round(Math.ceil(max / step - 1e-9) * step);
    const ticks = [];
    for (let v = lo; v <= hi + step / 2; v += step) ticks.push(round(v));
    return { min: lo, max: hi, step, ticks };
  }

  /* Bins on round edges (0.5 s, 1 s, 5 s ...), the smallest width that needs at most maxBins. */
  function histogram(values, maxBins = 14) {
    if (!values.length) return { lo: 0, step: 1, bins: [], total: 0, top: 0 };
    let min = Infinity, max = -Infinity;
    for (const v of values) { if (v < min) min = v; if (v > max) max = v; }
    let step = 1;
    search: for (let k = -2; k <= 6; k++) {
      for (const m of [1, 2, 2.5, 5]) {
        const s = m * 10 ** k, lo = Math.floor(min / s + 1e-9) * s;
        if (Math.floor((max - lo) / s + 1e-9) + 1 <= maxBins) { step = s; break search; }
        step = s;
      }
    }
    const lo = round(Math.floor(min / step + 1e-9) * step), n = Math.floor((max - lo) / step + 1e-9) + 1;
    const bins = Array.from({ length: n }, (_, i) => ({ from: round(lo + i * step), to: round(lo + (i + 1) * step), count: 0 }));
    for (const v of values) bins[Math.min(n - 1, Math.max(0, Math.floor((v - lo) / step + 1e-9)))].count++;
    return { lo, step, bins, total: values.length, top: Math.max(...bins.map((b) => b.count)) };
  }

  /* Every solve that beat all before it, in order. */
  function records(solves, value) {
    const out = [];
    let best = Infinity;
    solves.forEach((s, i) => {
      const v = value(s);
      if (Number.isFinite(v) && v < best) { best = v; out.push({ i, v, id: s.id }); }
    });
    return out;
  }
  /* The record standing after solve i (null before the first valid one). */
  function bestAt(recs, i) {
    let lo = 0, hi = recs.length - 1, at = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (recs[mid].i <= i) { at = mid; lo = mid + 1; } else hi = mid - 1; }
    return at < 0 ? null : recs[at];
  }

  function weekdayCounts(solves, dateOf) {
    const out = Array(7).fill(0);
    for (const s of solves) { const d = dateOf(s); if (d) out[(d.getDay() + 6) % 7]++; }
    return out;
  }

  /* Least-squares line through the defined points of ys: { i0, v0, i1, v1 }. */
  function regression(ys) {
    let n = 0, sx = 0, sy = 0, sxx = 0, sxy = 0, first = -1, last = -1;
    ys.forEach((v, i) => {
      if (v == null || !Number.isFinite(v)) return;
      if (first < 0) first = i;
      last = i; n++; sx += i; sy += v; sxx += i * i; sxy += i * v;
    });
    const den = n * sxx - sx * sx;
    if (n < 3 || !den) return null;
    const slope = (n * sxy - sx * sy) / den, icpt = (sy - slope * sx) / n;
    return { i0: first, v0: icpt + slope * first, i1: last, v1: icpt + slope * last };
  }

  function bestAverage(solves, n, average) {
    let best = null;
    for (let i = n - 1; i < solves.length; i++) {
      const v = average(solves.slice(i - n + 1, i + 1), n);
      if (v != null && Number.isFinite(v) && (best == null || v < best)) best = v;
    }
    return best;
  }

  /* Indices worth drawing for a long series: a stride, always including the first and last defined point. */
  function sample(ys, max = 600) {
    const idx = [], stride = Math.max(1, Math.ceil(ys.length / max));
    let last = -1;
    ys.forEach((v, i) => {
      if (v == null || !Number.isFinite(v)) return;
      last = i;
      if (idx.length === 0 || i % stride === 0) idx.push(i);
    });
    if (last >= 0 && idx[idx.length - 1] !== last) idx.push(last);
    return idx;
  }

  /* The consistency line is a rolling share; its window follows the size of the range: a tenth of it,
     between 20 and 500 solves, and never so wide that fewer than two points are left to draw. */
  function autoWindow(n) {
    const w = Math.min(500, Math.max(20, Math.round(n / 10)));
    return Math.max(5, Math.min(w, n - 1));
  }

  /* ------------------------------------------------------------------- view */
  const SVGNS = "http://www.w3.org/2000/svg";
  let uid = 0;

  function create(host, ctx) {
    const esc = ctx.esc, fmt = ctx.format;
    const reduced = () => (typeof ctx.reduced === "function" ? ctx.reduced() : matchMedia("(prefers-reduced-motion: reduce)").matches);
    const animate = Boolean(ctx.animate) && !reduced();
    const cleanups = [];
    const on = (target, type, fn, opts) => { target.addEventListener(type, fn, opts); cleanups.push(() => target.removeEventListener(type, fn, opts)); };
    const ref = (name) => host.querySelector(`[data-ref="${name}"]`);
    const plural = (n, word) => `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;

    const data = ctx.data();
    const T = ctx.target(), W = autoWindow(data.length);
    const values = data.map(ctx.value);
    const valid = values.filter(Number.isFinite);
    const targetText = `${fmt(T, T % 1 ? 2 : 0)}s`;

    /* ---- shared pieces ---- */
    function card(name, title, body, extra = "") {
      return `<section class="ins-card ins-${name}" data-ref="${name}"><header class="ins-head"><h2>${title}</h2>${extra}</header>${body}</section>`;
    }
    const empty = (title, text = "") => `<div class="ins-empty"><strong>${title}</strong>${text ? `<span>${text}</span>` : ""}</div>`;

    /* ---- consistency (hero) ----
       The headline is the share of every solve in the range that beat the target. The line below it is the same
       share rolling over W solves, so "recent form" is visible without a second setting. */
    const hits = values.filter((v) => v < T).length;
    const pct = data.length ? (100 * hits) / data.length : 0;
    const series = ctx.subSeries(data, W, T);
    const now = series.length ? series.at(-1) : null;
    const diff = now == null ? null : now - pct;

    const deltaHTML = diff == null
      ? `<p class="ins-delta none">Needs at least 6 solves to show a trend</p>`
      : Math.abs(diff) < 0.05
        ? `<p class="ins-delta none"><b>${now.toFixed(1)}%</b> over the latest ${plural(W, "solve")}, in line with the range</p>`
        : `<p class="ins-delta ${diff > 0 ? "up" : "down"}">${ctx.icon(diff > 0 ? "trend-up" : "trend-down")}<span><b>${now.toFixed(1)}%</b> over the latest ${plural(W, "solve")}, ${Math.abs(diff).toFixed(1)} points ${diff > 0 ? "above" : "below"} the range</span></p>`;

    const controls = `<div class="ins-set">
        <label>Under<input class="ins-num" type="number" min="0.01" max="3600" step="0.5" value="${esc(T)}" data-control="target" aria-label="Target in seconds"><span>s</span></label>
      </div>`;

    const hero = card("hero", "Consistency", `
      <div class="ins-hero-top">
        <div class="ins-big" aria-label="${pct.toFixed(1)} percent"><span data-ref="pct">${data.length ? pct.toFixed(1) : "—"}</span><i>%</i></div>
        <div class="ins-hero-text">
          <p class="ins-lead"><b>${hits.toLocaleString()}</b> of ${data.length.toLocaleString()} solves were under <b>${esc(targetText)}</b></p>
          ${deltaHTML}
        </div>
        ${controls}
      </div>
      <div class="ins-chart tall" data-ref="goalChart"></div>
      <p class="ins-note">Each point is the share of the previous ${plural(W, "solve")} under the target. Strictly under: +2 included, DNF counts as a miss. Dashed: the overall direction.</p>`);

    /* ---- distribution ---- */
    const hist = histogram(valid);
    const st = ctx.stats(data);
    const distBody = valid.length ? `
      <div class="ins-chart" data-ref="histChart"></div>
      <dl class="ins-facts">
        <div><dt>Median</dt><dd>${fmt(st.median)}</dd></div>
        <div><dt>Std. deviation</dt><dd>${fmt(st.sd)}</dd></div>
        <div><dt>Completion</dt><dd>${data.length ? ((st.valid / data.length) * 100).toFixed(1) : "—"}<small>%</small></dd></div>
        <div class="ins-legend"><span><i class="u"></i>Under ${esc(targetText)}</span><span><i></i>Slower</span></div>
      </dl>` : empty("No completed solves", "Finished solves will show up here.");
    const dist = card("dist", "Distribution", distBody, `<span class="ins-sub">${plural(valid.length, "completed solve")}</span>`);

    /* ---- personal best ---- */
    const recs = records(data, ctx.value);
    const pbTop = recs.at(-1);
    let pbBody;
    if (!pbTop) pbBody = empty("No completed solves", "Your personal best will be tracked here.");
    else {
      const s = data[pbTop.i], when = ctx.dayLabel(s);
      pbBody = `<div class="ins-pb-top"><div class="ins-big sm"><span>${fmt(pbTop.v)}</span><i>s</i></div>
        <p class="ins-lead"><b>Best single</b><br>solve #${ctx.number(s).toLocaleString()}${when && when !== "Unknown date" ? ` · ${esc(when)}` : ""}</p></div>
        <div class="ins-chart" data-ref="pbChart"></div>`;
    }
    const pb = card("pb", "Personal best over time", pbBody);

    /* ---- weekday ---- */
    const days = weekdayCounts(data, ctx.dateOf), dayTop = Math.max(1, ...days);
    const NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const dayTotal = days.reduce((a, b) => a + b, 0), uniqueTop = days.filter((n) => n === dayTop).length === 1;
    const week = card("week", "Solves by weekday", dayTotal ? `
      <div class="ins-days">${days.map((n, i) => `<div class="ins-day${uniqueTop && n === dayTop ? " top" : ""}" style="--i:${i}"><span>${NAMES[i]}</span><div class="ins-track"><i style="--w:${(n / dayTop) * 100}%"></i></div><b>${n.toLocaleString()}</b></div>`).join("")}</div>
      <p class="ins-note">Local dates. Solves without a date are left out.</p>` : empty("No dated solves", "Solves need a date to be counted by weekday."));

    /* ---- best averages ---- */
    const AVG = [5, 12, 100];
    const avgRows = AVG.map((n) => {
      const cur = ctx.average(data, n), best = bestAverage(data, n, ctx.average);
      const ok = cur != null && Number.isFinite(cur) && best != null;
      const gap = ok ? cur - best : null;
      return `<div class="ins-avg-row"><span class="w">ao${n}</span><span class="v">${fmt(cur)}</span><span class="v best">${fmt(best)}</span><span class="g${gap != null && gap <= 0.0049 ? " at" : ""}">${gap == null ? "" : gap <= 0.0049 ? "at best" : "+" + fmt(gap)}</span></div>`;
    }).join("");
    const avgs = card("avg", "Best averages", `
      <div class="ins-avgs"><div class="ins-avg-row head"><span>Window</span><span>Current</span><span>Best</span><span></span></div>${avgRows}</div>
      <p class="ins-note">Averages trim the fastest and slowest 5%, rounded up. DNFs stay in the window.</p>`);

    host.innerHTML = `<div class="ins${animate ? " enter" : ""}">${hero}${dist}${pb}${week}${avgs}</div>`;

    /* the headline number counts up once per visit */
    if (animate && data.length) {
      const el = ref("pct"), t0 = performance.now(), dur = 800;
      let raf = requestAnimationFrame(function tick(t) {
        const k = Math.min(1, (t - t0) / dur), e = 1 - (1 - k) ** 3;
        el.textContent = (pct * e).toFixed(1);
        if (k < 1) raf = requestAnimationFrame(tick);
      });
      cleanups.push(() => cancelAnimationFrame(raf));
      el.textContent = "0.0";
    }

    /* ---------------------------------------------------------- charts */
    const mk = (tag, attrs = {}) => { const el = document.createElementNS(SVGNS, tag); for (const k in attrs) el.setAttribute(k, attrs[k]); return el; };
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

    /* A box that redraws itself at its own width. draw(w, h) returns { svg, hover } */
    function chartBox(el, height, draw) {
      if (!el) return;
      let width = 0, pinned = -1;
      const tip = document.createElement("div");
      tip.className = "ins-tip"; tip.hidden = true;
      const paint = (first) => {
        const w = Math.floor(el.clientWidth);
        if (w < 80) return;
        width = w;
        const h = height();
        const spec = draw(w, h, first && animate);
        el.querySelector("svg")?.remove();
        el.prepend(spec.svg);
        el.style.height = h + "px";
        wire(spec, w, h);
      };
      function wire(spec, w, h) {
        const svg = spec.svg, hit = svg.querySelector(".ins-hit");
        if (!hit || !spec.at) return;
        const guide = svg.querySelector(".ins-guide"), dot = svg.querySelector(".ins-dot");
        let cur = -1;
        const show = (e, i, touch) => {
          const p = spec.at(i);
          if (!p) return;
          cur = i;
          guide?.setAttribute("x1", p.x); guide?.setAttribute("x2", p.x);
          guide?.setAttribute("visibility", "visible");
          if (dot) { dot.setAttribute("cx", p.x); dot.setAttribute("cy", p.y); dot.setAttribute("visibility", p.y == null ? "hidden" : "visible"); }
          tip.innerHTML = p.html + (p.open ? `<small>${touch ? "Tap to open the solve" : "Click to open the solve"}</small>` : "");
          tip.dataset.open = p.open || "";
          tip.classList.toggle("touch", touch);
          tip.hidden = false;
          const tw = tip.offsetWidth, th = tip.offsetHeight;
          tip.style.left = clamp(p.x - tw / 2, 4, w - tw - 4) + "px";
          tip.style.top = Math.max(4, (p.y == null ? 24 : p.y) - th - 14) + "px";
        };
        const hide = () => {
          cur = -1;
          guide?.setAttribute("visibility", "hidden"); dot?.setAttribute("visibility", "hidden"); tip.hidden = true; spec.clear?.();
        };
        const indexAt = (e) => {
          const r = hit.getBoundingClientRect();
          return spec.nearest(clamp((e.clientX - r.left) / r.width, 0, 1));
        };
        hit.addEventListener("pointermove", (e) => { if (e.pointerType === "mouse" || e.buttons || pinned >= 0) show(e, indexAt(e), e.pointerType !== "mouse"); });
        hit.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse") { pinned = 1; show(e, indexAt(e), true); } });
        hit.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") hide(); });
        // a mouse click opens the solve; on touch the first tap only shows the tooltip, and tapping the tooltip opens it
        hit.addEventListener("click", (e) => {
          if (e.pointerType && e.pointerType !== "mouse") return;
          const p = spec.at(indexAt(e));
          if (p?.open) ctx.open(p.open);
        });
        on(tip, "click", () => { if (tip.dataset.open) ctx.open(tip.dataset.open); });
        hit.addEventListener("keydown", (e) => {
          const n = spec.count; if (!n) return;
          if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            e.preventDefault();
            const next = clamp((cur < 0 ? n - 1 : cur) + (e.key === "ArrowRight" ? 1 : -1) * (e.shiftKey ? 10 : 1), 0, n - 1);
            show(e, next, false);
          } else if (e.key === "Enter" && cur >= 0) { const p = spec.at(cur); if (p?.open) ctx.open(p.open); }
          else if (e.key === "Escape") hide();
        });
        hit.addEventListener("blur", hide);
      }
      el.append(tip);
      paint(true);
      let raf = 0;
      const ro = new ResizeObserver(() => {
        if (Math.floor(el.clientWidth) === width) return;
        cancelAnimationFrame(raf); raf = requestAnimationFrame(() => paint(false));
      });
      ro.observe(el);
      cleanups.push(() => { ro.disconnect(); cancelAnimationFrame(raf); });
      on(document, "pointerdown", (e) => { if (pinned >= 0 && !el.contains(e.target)) { pinned = -1; tip.hidden = true; el.querySelector(".ins-guide")?.setAttribute("visibility", "hidden"); el.querySelector(".ins-dot")?.setAttribute("visibility", "hidden"); } });
    }

    const phone = () => matchMedia("(max-width: 640px)").matches;

    /* Axes and gridlines shared by the line charts. Returns the SVG and the x / y mappers. */
    function frame(w, h, o) {
      const padL = o.padL ?? 46, padR = 14, padT = 14, padB = 30;
      const svg = mk("svg", { viewBox: `0 0 ${w} ${h}`, width: w, height: h, role: "img", "aria-label": o.label });
      const x = (i) => padL + ((i - o.i0) / Math.max(1, o.i1 - o.i0)) * (w - padL - padR);
      const y = (v) => padT + (1 - (v - o.axis.min) / (o.axis.max - o.axis.min)) * (h - padT - padB);
      let g = "";
      for (const t of o.axis.ticks) g += `<line class="ins-grid" x1="${padL}" x2="${w - padR}" y1="${y(t)}" y2="${y(t)}"/><text x="${padL - 10}" y="${y(t) + 4}" text-anchor="end">${o.yFmt(t)}</text>`;
      const n = phone() ? 3 : w < 520 ? 4 : 5;
      for (let k = 0; k < n; k++) {
        const i = Math.round(o.i0 + (k / (n - 1)) * (o.i1 - o.i0));
        g += `<text x="${x(i)}" y="${h - 8}" text-anchor="${k === 0 ? "start" : k === n - 1 ? "end" : "middle"}">${esc(o.xLabel(i))}</text>`;
      }
      svg.innerHTML = g;
      return { svg, x, y, padL, padR, padT, padB };
    }
    const drawIn = (path, on) => { if (on) { path.setAttribute("pathLength", "1"); path.classList.add("ins-draw"); } return path; };

    const xLabelFor = () => {
      const labels = data.map((s) => ctx.dayLabel(s));
      const same = labels.length > 0 && labels[0] === labels.at(-1);
      return (i) => { const l = labels[clamp(i, 0, labels.length - 1)]; return same || !l || l === "Unknown date" ? "#" + ctx.number(data[clamp(i, 0, data.length - 1)]) : l; };
    };
    const xLabel = data.length ? xLabelFor() : () => "";

    /* ---- consistency chart ---- */
    const goalEl = ref("goalChart");
    const goalIdx = sample(series);
    if (goalIdx.length < 2) {
      goalEl.className = "ins-chart-empty";
      goalEl.innerHTML = `<div class="ins-empty">${ctx.icon("chart")}<strong>Not enough solves to chart yet</strong><span>The line needs at least 6 solves in this range${data.length ? `; it has ${data.length.toLocaleString()}` : ""}.</span></div>`;
    } else {
      const defined = goalIdx.map((i) => series[i]);
      const axis = (() => {
        const lo = Math.min(...defined), hi = Math.max(...defined), pad = Math.max(2, (hi - lo) * 0.15);
        const a = niceTicks(Math.max(0, lo - pad), Math.min(100, hi + pad), 4);
        return { ...a, min: Math.max(0, a.min), max: Math.min(100, a.max) };
      })();
      const trend = regression(series);
      const i0 = goalIdx[0], i1 = goalIdx.at(-1);
      const id = "g" + ++uid;
      chartBox(goalEl, () => (phone() ? 200 : 260), (w, h, anim) => {
        const f = frame(w, h, { i0, i1, axis, yFmt: (t) => t + "%", xLabel, label: `Share of solves under ${targetText}, rolling over ${W} solves, now ${(now ?? pct).toFixed(1)} percent` });
        const pts = goalIdx.map((i) => `${f.x(i).toFixed(1)},${f.y(series[i]).toFixed(1)}`);
        const line = "M" + pts.join("L"), base = h - f.padB;
        const defs = mk("defs"); defs.innerHTML = `<linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--chart-goal)" stop-opacity=".32"/><stop offset="1" stop-color="var(--chart-goal)" stop-opacity="0"/></linearGradient>`;
        f.svg.prepend(defs);
        f.svg.append(mk("path", { d: `${line}L${f.x(i1)},${base}L${f.x(i0)},${base}Z`, fill: `url(#${id})`, class: anim ? "ins-fade" : "" }));
        if (trend) f.svg.append(mk("path", { d: `M${f.x(trend.i0)},${f.y(clamp(trend.v0, axis.min, axis.max))}L${f.x(trend.i1)},${f.y(clamp(trend.v1, axis.min, axis.max))}`, class: "ins-trend" }));
        f.svg.append(drawIn(mk("path", { d: line, class: "ins-line goal" }), anim));
        f.svg.append(mk("line", { class: "ins-guide", y1: f.padT, y2: base, visibility: "hidden" }), mk("circle", { class: "ins-dot goal", r: 5, visibility: "hidden" }));
        f.svg.append(mk("circle", { class: "ins-end goal", cx: f.x(i1), cy: f.y(series[i1]), r: 4.5 }));
        const hit = mk("rect", { class: "ins-hit", x: f.padL, y: 0, width: w - f.padL - f.padR, height: h - f.padB, tabindex: 0, "aria-label": "Consistency over time. Use the arrow keys to move along it." });
        f.svg.append(hit);
        const span = i1 - i0;
        return {
          svg: f.svg, count: data.length,
          nearest: (t) => Math.round(i0 + t * span),
          at: (i) => {
            i = clamp(i, i0, i1);
            const v = series[i];
            if (v == null) return null;
            const s = data[i];
            return { x: f.x(i), y: f.y(v), open: s.id, html: `<span>Solve #${ctx.number(s).toLocaleString()} · ${esc(xLabel(i).startsWith("#") ? ctx.dayLabel(s) : xLabel(i))}</span><strong>${v.toFixed(1)}%</strong><span>under ${esc(targetText)} over the previous ${W.toLocaleString()}</span>` };
          },
        };
      });
    }

    /* ---- distribution chart ---- */
    const histEl = ref("histChart");
    if (histEl) {
      const median = st.median;
      chartBox(histEl, () => (phone() ? 190 : 220), (w, h, anim) => {
        const padL = 8, padR = 8, padT = 42, padB = 30, bw = (w - padL - padR) / hist.bins.length;
        const svg = mk("svg", { viewBox: `0 0 ${w} ${h}`, width: w, height: h, role: "img", "aria-label": `Distribution of ${valid.length} solve times, median ${fmt(median)} seconds` });
        const y = (c) => h - padB - (c / hist.top) * (h - padT - padB);
        const dg = hist.step >= 1 ? 0 : hist.step >= 0.5 ? 1 : 2;
        const every = bw < 44 ? Math.ceil(44 / bw) : 1;
        let g = `<line class="ins-grid" x1="${padL}" x2="${w - padR}" y1="${h - padB}" y2="${h - padB}"/>`;
        hist.bins.forEach((b, i) => {
          const x = padL + i * bw, top = y(b.count), under = b.to <= T + 1e-9;
          if (b.count) g += `<rect class="ins-bar${under ? " under" : ""}${anim ? " rise" : ""}" x="${x + 1.5}" y="${top}" width="${Math.max(1, bw - 3)}" height="${h - padB - top}" rx="4" style="--i:${i}"/>`;
          if (b.count && bw >= 30) g += `<text class="ins-count" x="${x + bw / 2}" y="${top - 6}" text-anchor="middle">${b.count}</text>`;
          if (i % every === 0) g += `<text x="${x}" y="${h - 8}" text-anchor="${i === 0 ? "start" : "middle"}">${fmt(b.from, dg)}</text>`;
        });
        const mx = padL + ((median - hist.lo) / (hist.step * hist.bins.length)) * (w - padL - padR);
        g += `<line class="ins-median" x1="${mx}" x2="${mx}" y1="${padT - 20}" y2="${h - padB}"/><text class="ins-median-label" x="${clamp(mx, 44, w - 44)}" y="${padT - 26}" text-anchor="middle">median ${fmt(median)}</text>`;
        svg.innerHTML = g;
        svg.append(mk("rect", { class: "ins-hit bars", x: padL, y: 0, width: w - padL - padR, height: h - padB, tabindex: 0, "aria-label": "Distribution. Use the arrow keys to move between bars." }));
        const hl = mk("rect", { class: "ins-bar-hl", rx: 4, visibility: "hidden" });
        svg.insertBefore(hl, svg.querySelector(".ins-hit"));
        const at = (i) => {
          const b = hist.bins[i]; if (!b) return null;
          const x = padL + i * bw, top = y(b.count);
          hl.setAttribute("x", x + 1.5); hl.setAttribute("y", top); hl.setAttribute("width", Math.max(1, bw - 3)); hl.setAttribute("height", Math.max(2, h - padB - top)); hl.setAttribute("visibility", b.count ? "visible" : "hidden");
          return { x: x + bw / 2, y: top, html: `<span>${fmt(b.from, Math.max(dg, 1))}–${fmt(b.to, Math.max(dg, 1))}s</span><strong>${plural(b.count, "solve")}</strong><span>${((b.count / hist.total) * 100).toFixed(1)}% of solves</span>` };
        };
        return { svg, count: hist.bins.length, clear: () => hl.setAttribute("visibility", "hidden"), nearest: (t) => clamp(Math.floor(t * hist.bins.length), 0, hist.bins.length - 1), at };
      });
    }

    /* ---- personal best chart ---- */
    const pbEl = ref("pbChart");
    if (pbEl && recs.length) {
      const first = recs[0], last = recs.at(-1);
      const axis = niceTicks(last.v - (first.v - last.v) * 0.08, first.v + (first.v - last.v) * 0.08 || first.v + 1, 4);
      const i0 = 0, i1 = Math.max(1, data.length - 1);
      chartBox(pbEl, () => (phone() ? 170 : 258), (w, h, anim) => {
        const f = frame(w, h, { i0, i1, axis, yFmt: (t) => fmt(t, axis.step < 1 ? 1 : 0), xLabel, label: `Personal best over time, now ${fmt(last.v)} seconds` });
        let d = `M${f.x(first.i)},${f.y(first.v)}`;
        for (let k = 1; k < recs.length; k++) d += `H${f.x(recs[k].i)}V${f.y(recs[k].v)}`;
        d += `H${f.x(i1)}`;
        f.svg.append(drawIn(mk("path", { d, class: "ins-line pb" }), anim));
        const marks = recs.length > 40 ? [last] : recs;
        for (const r of marks) f.svg.append(mk("circle", { class: "ins-mark", cx: f.x(r.i), cy: f.y(r.v), r: r === last ? 4.5 : 2.6 }));
        f.svg.append(mk("line", { class: "ins-guide", y1: f.padT, y2: h - f.padB, visibility: "hidden" }), mk("circle", { class: "ins-dot", r: 5, visibility: "hidden" }));
        f.svg.append(mk("rect", { class: "ins-hit", x: f.padL, y: 0, width: w - f.padL - f.padR, height: h - f.padB, tabindex: 0, "aria-label": "Personal best over time. Use the arrow keys to move along it." }));
        const span = i1 - i0;
        return {
          svg: f.svg, count: data.length,
          nearest: (t) => Math.round(i0 + t * span),
          at: (i) => {
            const r = bestAt(recs, i); if (!r) return null;
            const s = data[r.i];
            return { x: f.x(i), y: f.y(r.v), open: s.id, html: `<span>Best after solve #${ctx.number(data[clamp(i, 0, data.length - 1)]).toLocaleString()}</span><strong>${fmt(r.v)}s</strong><span>set on solve #${ctx.number(s).toLocaleString()}${ctx.dayLabel(s) && ctx.dayLabel(s) !== "Unknown date" ? " · " + esc(ctx.dayLabel(s)) : ""}</span>` };
          },
        };
      });
    }

    return { destroy() { cleanups.forEach((f) => f()); cleanups.length = 0; host.innerHTML = ""; } };
  }

  const api = { create, niceTicks, histogram, records, bestAt, weekdayCounts, regression, bestAverage, sample, autoWindow };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.CTInsights = api;
})(typeof window !== "undefined" ? window : globalThis);
