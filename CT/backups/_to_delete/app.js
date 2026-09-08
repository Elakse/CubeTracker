/* UI and local persistence. No build step or runtime dependencies. */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s),
    $$ = (s, r = document) => [...r.querySelectorAll(s)],
    C = CT;
  const paths = {
    cube: "m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Zm0 9 8-4.5M12 12 4 7.5M12 12v9",
    grid: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
    timer:
      "M9 2h6m-3 0v3m6 2 2-2M12 10v4l3 2M21 14a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
    list: "M8 5h13M8 12h13M8 19h13M3 5h.01M3 12h.01M3 19h.01",
    chart: "m3 17 5-6 5 3 8-10M3 3v18h18",
    plus: "M12 5v14M5 12h14",
    upload: "M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5",
    download: "M12 3v13m-5-5 5 5 5-5M4 16v5h16v-5",
    play: "m8 5 11 7-11 7V5Z",
    pause: "M8 5v14M16 5v14",
    help: "M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2-3 4m.1 3h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
    "arrow-up-right": "M6 18 18 6M6 6h12v12",
    arrow: "M4 12h16m-6-6 6 6-6 6",
    chevron: "m9 5 7 7-7 7",
    left: "m15 5-7 7 7 7",
    reset: "M3 11a9 9 0 1 1 2 7M3 4v7h7",
    copy: "M9 9h12v12H9zM15 9V3H3v12h6",
    close: "m6 6 12 12M6 18 18 6",
    search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
    trophy:
      "M8 3h8v7a4 4 0 0 1-8 0V3Zm0 2H3v3a4 4 0 0 0 5 4m8-7h5v3a4 4 0 0 1-5 4m-4 2v6m-5 1h10",
    target:
      "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-4 0a5 5 0 1 1-10 0 5 5 0 0 1 10 0Zm-5 0h.01",
    calendar: "M3 5h18v16H3zM7 2v6M17 2v6M3 11h18",
    more: "M5 12h.01M12 12h.01M19 12h.01",
    first: "M5 5v14m13-14-9 7 9 7",
    last: "M19 5v14M6 5l9 7-9 7",
    expand: "M3 9V3h6M15 3h6v6M21 15v6h-6M9 21H3v-6",
    check: "m5 12 4 4L19 6",
    trash: "M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7",
    folder: "M3 7V4h6l2 3h10v13H3V7Z",
    sun: "M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7m10 10 1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
    moon: "M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z",
    settings:
      "M4 6h9m5 0h2M4 12h3m5 0h8M4 18h9m5 0h2M15 4v4M9 10v4M15 16v4",
  };
  const icon = (name) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.cube}"/></svg>`;
  const esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (ch) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[ch],
    );
  const fmt = C.format;
  const uid = () => crypto.randomUUID();
  const STORE = "cubetracker.workspace.v2",
    PREF = "cubetracker.preferences.v2";
  let pref = {
      target: 15,
      window: 50,
      inspection: false,
      trend: "ao12",
      range: "all",
      active: null,
      theme: "system",
      cubeMode: "3d",
    },
    state = { categories: [], revision: 0 },
    view = "timer",
    server = false,
    saveChain = Promise.resolve(),
    dirty = false,
    writeError = false,
    cacheError = false,
    saveGeneration = 0,
    recovery = null,
    demo = null,
    query = "",
    sort = "newest",
    page = 1,
    filter = "all",
    startDate = "",
    endDate = "",
    scene = null,
    drawerScene = null,
    drawerId = null,
    latestId = null,
    panelObserver = null,
    panelCount = 0,
    keepPanel = false;
  const PANEL_BATCH = 60;
  let currentScramble = C.scramble(),
    scrambleSource = "practice",
    scramblePending = false,
    scrambleWorker = null,
    scrambleQueue = [],
    timer = {
      phase: "idle",
      start: 0,
      raf: 0,
      hold: 0,
      inspectStart: 0,
      penalty: "",
      elapsed: 0,
      blockedRelease: false,
    };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  try {
    pref = { ...pref, ...JSON.parse(localStorage.getItem(PREF) || "{}") };
  } catch {}
  pref.window = Math.max(
    5,
    Math.min(10000, Math.round(Number(pref.window) || 50)),
  );
  pref.target = Math.max(0.01, Math.min(3600, Number(pref.target) || 15));
  const darkQuery = matchMedia("(prefers-color-scheme: dark)");
  function resolvedTheme() {
    return pref.theme === "light" || pref.theme === "dark"
      ? pref.theme
      : darkQuery.matches
        ? "dark"
        : "light";
  }
  function applyTheme() {
    const dark = resolvedTheme() === "dark",
      root = document.documentElement;
    if (root) {
      if (pref.theme === "light" || pref.theme === "dark")
        root.dataset.theme = pref.theme;
      else delete root.dataset.theme;
    }
    $("#theme-color")?.setAttribute("content", dark ? "#0c0f0d" : "#f5f6f2");
    const btn = $("#theme-btn"),
      slot = btn && $("[data-icon]", btn),
      label = btn && $(".theme-label", btn);
    if (slot) slot.innerHTML = icon(dark ? "sun" : "moon");
    if (label) label.textContent = dark ? "Light mode" : "Dark mode";
    if (btn)
      btn.title = dark ? "Switch to light mode" : "Switch to dark mode";
  }
  darkQuery.addEventListener?.("change", () => {
    if (pref.theme !== "light" && pref.theme !== "dark") applyTheme();
  });
  applyTheme();
  function savePref() {
    try {
      localStorage.setItem(PREF, JSON.stringify(pref));
    } catch {}
  }
  function active() {
    return (
      demo ||
      state.categories.find((c) => c.id === pref.active) ||
      state.categories[0] ||
      null
    );
  }
  function solves() {
    return active()?.solves || [];
  }
  function dated(s) {
    return s.date ? new Date(s.date) : null;
  }
  function shortDate(s) {
    const d = dated(s);
    return d
      ? d.toLocaleDateString("en", { month: "short", day: "numeric" })
      : "Unknown date";
  }
  function longDate(s) {
    const d = dated(s);
    return d
      ? d.toLocaleString("en", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : s.originalDate || "Unknown date";
  }
  function localDay(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }
  function rangeSolves() {
    const a = solves();
    if (pref.range === "all") return a;
    const n = Number(pref.range);
    return a.slice(-n);
  }
  function toast(message, error = false, action) {
    const div = document.createElement("div");
    div.className = "toast" + (error ? " error" : "");
    const span = document.createElement("span");
    span.textContent = message;
    div.append(span);
    if (action) {
      const b = document.createElement("button");
      b.textContent = action.label;
      b.onclick = () => {
        action.run();
        div.remove();
      };
      div.append(b);
    }
    $("#toast-region").append(div);
    setTimeout(() => div.remove(), action ? 13000 : 6500);
  }
  function storageStatus() {
    const n = $("#storage-label"),
      d = $("#storage-detail");
    $("#storage-dot").classList.toggle("warn", writeError || !server);
    n.textContent = writeError
      ? "Save failed"
      : dirty
        ? "Saving…"
        : server || folderHandle
          ? "Saved to folder"
          : "Saved in browser";
    d.textContent = writeError
      ? cacheError
        ? "Export a CSV to keep your times"
        : "Browser copy retained"
      : server || folderHandle
        ? "Auto-saving CSV"
        : "Connect a folder to save CSVs";
  }
  function cache() {
    try {
      localStorage.setItem(STORE, JSON.stringify({ ...state, dirty }));
      cacheError = false;
      return true;
    } catch {
      if (!cacheError)
        toast(
          "Browser backup is full or unavailable. Export your CSV to keep a copy.",
          true,
        );
      cacheError = true;
      return false;
    }
  }
  function persist() {
    dirty = true;
    const generation = ++saveGeneration;
    const cached = cache();
    storageStatus();
    if (!server) {
      if (folderHandle) saveFolder();
      else {
        dirty = !cached;
        writeError = !cached;
        if (cached) cache();
        storageStatus();
      }
      return Promise.resolve();
    }
    const snapshot = JSON.parse(JSON.stringify(state.categories));
    saveChain = saveChain.then(async () => {
      try {
        const res = await fetch("/api/library", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            revision: state.revision,
            categories: snapshot,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not save CSV files.");
        state.revision = data.revision;
        for (const c of state.categories)
          c.file = data.categories.find((d) => d.id === c.id)?.file || c.file;
        writeError = false;
        if (generation === saveGeneration) dirty = false;
        cache();
        storageStatus();
      } catch (e) {
        writeError = true;
        dirty = true;
        cache();
        storageStatus();
        toast(e.message, true);
      }
    });
    return saveChain;
  }
  let folderHandle = null,
    folderChain = Promise.resolve();
  function saveFolder() {
    const generation = saveGeneration,
      snapshot = state.categories.map((c) => ({
        id: c.id,
        name: c.name,
        file: c.file,
        solves: structuredClone(c.solves),
      }));
    folderChain = folderChain.then(async () => {
      try {
        for (const c of snapshot) {
          const name =
            c.file ||
            `${c.name.replace(/[^a-zA-Z0-9-]/g, "-").slice(0, 40) || "category"}-${c.id.slice(0, 8)}.csv`;
          const handle = await folderHandle.getFileHandle(name, {
            create: true,
          });
          const writable = await handle.createWritable();
          await writable.write(C.exportCSV(c.solves));
          await writable.close();
          const live = state.categories.find((x) => x.id === c.id);
          if (live) live.file = name;
        }
        if (generation === saveGeneration) dirty = false;
        writeError = false;
        cache();
        storageStatus();
        $("#storage-detail").textContent = "Connected folder · auto-save on";
      } catch (e) {
        dirty = true;
        writeError = true;
        cache();
        storageStatus();
        toast(
          `Folder save failed: ${e.message}. Your browser copy is retained.`,
          true,
        );
      }
    });
    return folderChain;
  }
  async function connectFolder() {
    try {
      if (!window.showDirectoryPicker) {
        toast(
          "Use Start CubeTracker.cmd for automatic CSV saving, or export a CSV from the library.",
          true,
        );
        return;
      }
      folderHandle = await showDirectoryPicker({
        id: "cubetracker",
        mode: "readwrite",
      });
      await persist();
      closeDialog();
      toast("Folder connected. Category CSVs will update after every change.");
    } catch (e) {
      if (e.name !== "AbortError") toast(e.message, true);
    }
  }
  function renderIcons(root = document) {
    $$("[data-icon]", root).forEach(
      (el) => (el.innerHTML = icon(el.dataset.icon)),
    );
  }
  function renderSidebar() {
    const cat = active();
    $("#category-list").innerHTML =
      state.categories
        .map(
          (c) =>
            `<button class="category-item ${cat?.id === c.id && !demo ? "active" : ""}" data-category="${esc(c.id)}" title="${esc(c.name)}"><span class="category-dot"></span><span class="category-name">${esc(c.name)}</span><span class="category-count">${c.solves.length.toLocaleString()}</span></button>`,
        )
        .join("") ||
      '<p class="category-empty">No categories yet.</p>';
    $$("[data-view]").forEach((b) => {
      b.classList.toggle("active", b.dataset.view === view);
      b.setAttribute(
        "aria-current",
        b.dataset.view === view ? "page" : "false",
      );
    });
    $("#page-label").textContent = {
      overview: "Overview",
      timer: "Timer",
      solves: "Solve library",
      insights: "Insights",
    }[view];
    $("#footer-meta").textContent = demo
      ? "Demo dataset · not saved"
      : cat
        ? `${cat.name} · ${cat.solves.length.toLocaleString()} solve${cat.solves.length === 1 ? "" : "s"}`
        : "No category";
    storageStatus();
  }
  function categorySelect() {
    return `<select class="mobile-category" aria-label="Active category" data-control="category">${demo ? "<option>Demo dataset</option>" : ""}${state.categories.map((c) => `<option value="${esc(c.id)}" ${c.id === active()?.id ? "selected" : ""}>${esc(c.name)}</option>`).join("") || "<option>No category</option>"}<option value="__new__">+ New category…</option></select>`;
  }
  function rangeSelect() {
    return `<select class="period-select" aria-label="Solve range" data-control="range"><option value="all" ${pref.range === "all" ? "selected" : ""}>All solves</option>${[50, 100, 500, 1000].map((n) => `<option value="${n}" ${String(pref.range) === String(n) ? "selected" : ""}>Last ${n} solves</option>`).join("")}</select>`;
  }
  function heading(title, actions = "") {
    return `<div class="page-heading"><h1>${title}</h1><div class="heading-actions">${categorySelect()}${actions}</div></div>`;
  }
  function banners() {
    return (
      (demo
        ? '<div class="banner"><span><span class="chip demo">DEMO</span> Sample data. Nothing is saved.</span><button class="btn-link" data-action="exit-demo">Exit demo ' +
          icon("close") +
          "</button></div>"
        : "") +
      (recovery
        ? '<div class="banner"><span>An unsaved browser copy was found. Download it before continuing.</span><button class="btn-link" data-action="recovery">Recover CSVs</button></div>'
        : "")
    );
  }
  function empty(
    title = "No solves yet",
    text = "Record a solve or import a CSV.",
  ) {
    return `<div class="empty-state"><strong>${title}</strong>${text}<br><button class="btn btn-dark" data-action="practice">${icon("play")}Start solving</button> <button class="btn btn-quiet" data-action="import">Import CSV</button></div>`;
  }
  function miniSpark(values) {
    const v = values.filter(Number.isFinite).slice(-25);
    if (v.length < 2) return "";
    let min = Math.min(...v),
      max = Math.max(...v);
    const pts = v
      .map(
        (x, i) =>
          `${(i / (v.length - 1)) * 75},${26 - ((x - min) / (max - min || 1)) * 22}`,
      )
      .join(" ");
    return `<svg class="metric-spark" viewBox="0 0 78 30" aria-hidden="true"><polyline points="${pts}" fill="none" style="stroke:var(--lime-mid)" stroke-width="1.6"/></svg>`;
  }
  function metrics(a) {
    const s = C.stats(a),
      best = s.best,
      days = new Set(a.filter((x) => x.date).map((x) => localDay(dated(x))))
        .size;
    return `<div class="metric-grid">
<div class="metric"><div class="metric-label">Personal best ${icon("trophy")}</div><div class="metric-value">${fmt(best)}${Number.isFinite(best) ? '<span class="unit">s</span>' : ""}</div><div class="metric-foot"><strong>${best != null ? "Fastest single" : "No solves yet"}</strong></div>${miniSpark(a.map(C.value))}</div>
<div class="metric"><div class="metric-label">Average of 12 ${icon("chart")}</div><div class="metric-value">${fmt(s.ao12)}${Number.isFinite(s.ao12) ? '<span class="unit">s</span>' : ""}</div><div class="metric-foot">${a.length >= 12 ? "Latest 12 · trimmed" : `${Math.max(0, 12 - a.length)} more solves needed`}</div></div>
<div class="metric"><div class="metric-label">Session mean ${icon("target")}</div><div class="metric-value">${fmt(s.mean)}${Number.isFinite(s.mean) ? '<span class="unit">s</span>' : ""}</div><div class="metric-foot">${s.valid.toLocaleString()} completed · ${s.dnf} DNF</div></div>
<div class="metric"><div class="metric-label">Total solves ${icon("cube")}</div><div class="metric-value">${s.count.toLocaleString()}</div><div class="metric-foot"><strong>${days} day${days === 1 ? "" : "s"}</strong></div></div></div>`;
  }
  function chart(data, kind = "trend", height = 211) {
    if (!data.length)
      return `<div class="empty-chart">${icon("chart")}<strong>No data yet</strong></div>`;
    const n =
      kind === "goal"
        ? pref.window
        : pref.trend === "ao5"
          ? 5
          : pref.trend === "ao100"
            ? 100
            : 12;
    const line =
      kind === "goal"
        ? C.subSeries(data, n, pref.target)
        : kind === "pb"
          ? (() => {
              let b = Infinity;
              return data.map((s) => (b = Math.min(b, C.value(s))));
            })()
          : C.rolling(data, n);
    const vals =
      kind === "goal" ? [0, 100] : data.map(C.value).filter(Number.isFinite);
    if (!vals.length)
      return '<div class="empty-chart"><strong>No completed times in this range</strong></div>';
    const mainStyle = getComputedStyle($("#main"));
    const available =
      $("#main").clientWidth -
      parseFloat(mainStyle.paddingLeft) -
      parseFloat(mainStyle.paddingRight);
    let panelWidth = available;
    if (innerWidth > 760) {
      if (view === "overview")
        panelWidth =
          kind === "goal"
            ? (available - 21) / 2
            : (available - 21) * (innerWidth > 1180 ? 1.75 / 2.75 : 1.5 / 2.5);
      else if (kind !== "goal") panelWidth = (available - 21) / 2;
    }
    const w = Math.max(
        190,
        Math.round(panelWidth - (innerWidth <= 480 ? 36 : 48)),
      ),
      h = height,
      l = 38,
      r = 12,
      t = 18,
      b = 28;
    const ticks = height < 120 || w < 380 ? 2 : 4;
    const sameDay = shortDate(data[0]) === shortDate(data.at(-1));
    let min =
        kind === "goal"
          ? 0
          : Math.max(
              0,
              Math.floor(vals.reduce((a, b) => Math.min(a, b), Infinity) - 1),
            ),
      max =
        kind === "goal"
          ? 100
          : Math.ceil(vals.reduce((a, b) => Math.max(a, b), -Infinity) + 1);
    if (max === min) max++;
    const x = (i) => l + (i / Math.max(1, data.length - 1)) * (w - l - r),
      y = (v) => t + (1 - (v - min) / (max - min)) * (h - t - b);
    let svg = `<svg class="chart ${height < 120 ? "mini-chart" : ""}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="${kind === "goal" ? `Rolling percentage under ${pref.target} seconds across ${n} solves` : kind === "pb" ? "Personal best progression" : "Solve times and rolling average"}">`;
    for (let i = 0; i <= ticks; i++) {
      const v = min + ((max - min) * i) / ticks;
      svg += `<line class="gridline" x1="${l}" x2="${w - r}" y1="${y(v)}" y2="${y(v)}"/><text x="${l - 9}" y="${y(v) + 3}" text-anchor="end">${kind === "goal" ? Math.round(v) + "%" : fmt(v, 0)}</text>`;
    }
    // Preserve extrema in each pixel bucket when displaying a large library.
    const indices = new Set([0, data.length - 1]);
    const step = Math.max(1, Math.ceil(data.length / 500));
    for (let i = 0; i < data.length; i += step) {
      let lo = i,
        hi = i;
      for (let j = i; j < Math.min(i + step, data.length); j++) {
        if (C.value(data[j]) < C.value(data[lo])) lo = j;
        if (
          Number.isFinite(C.value(data[j])) &&
          (!Number.isFinite(C.value(data[hi])) ||
            C.value(data[j]) > C.value(data[hi]))
        )
          hi = j;
      }
      indices.add(lo);
      indices.add(hi);
      indices.add(i);
    }
    if (kind === "trend")
      for (const i of indices) {
        const v = C.value(data[i]);
        if (Number.isFinite(v))
          svg += `<circle cx="${x(i)}" cy="${y(v)}" r="2" style="fill:var(--chart-dot)" opacity=".6"/>`;
      }
    let d = "",
      started = false;
    for (let i = 0; i < line.length; i++) {
      const v = line[i];
      if (v == null || !Number.isFinite(v)) {
        started = false;
        continue;
      }
      if (!started || i % step === 0 || i === line.length - 1) {
        d += `${started ? "L" : "M"}${x(i).toFixed(2)},${y(v).toFixed(2)} `;
        started = true;
      }
    }
    if (d) {
      if (kind === "goal" && line.length >= n) {
        const first = n - 1;
        svg += `<path d="${d}L${x(data.length - 1)},${h - b}L${x(first)},${h - b}Z" style="fill:var(--chart-fill)" opacity=".5"/>`;
      }
      svg += `<path d="${d}" fill="none" style="stroke:var(${kind === "goal" ? "--chart-goal" : "--chart-line"})" stroke-width="${kind === "goal" ? 2 : 2.2}" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;
    }
    for (let i = 0; i <= ticks; i++) {
      const idx = Math.round((i / ticks) * (data.length - 1));
      svg += `<text x="${x(idx)}" y="${h - 5}" text-anchor="${i === 0 ? "start" : i === ticks ? "end" : "middle"}">${sameDay || shortDate(data[idx]) === "Unknown date" ? "#" + (idx + 1) : shortDate(data[idx])}</text>`;
    }
    svg += `<rect class="chart-hit" data-chart="${kind}" data-count="${data.length}" x="${l}" y="${t}" width="${w - l - r}" height="${h - t - b}" fill="transparent"/></svg>`;
    if (!d && kind !== "pb")
      svg += `<p class="chart-note">${Math.max(0, n - data.length)} more solves for a complete ${n}-solve window.</p>`;
    return svg;
  }
  function goalPanel(data, wide = false) {
    const sample = data.slice(-pref.window),
      hits = sample.filter((s) => C.value(s) < pref.target).length,
      pct = sample.length ? (100 * hits) / sample.length : 0;
    const series = C.subSeries(data, pref.window, pref.target),
      prev =
        series.length > pref.window
          ? series[series.length - 1 - pref.window]
          : null,
      delta = prev == null ? null : pct - prev;
    return `<section class="panel panel-pad ${wide ? "wide" : ""}"><div class="panel-heading"><h2>Consistency</h2><span class="chip green">SUB-${esc(pref.target)}</span></div><div class="goal-topline"><div class="goal-number">${sample.length ? pct.toFixed(1) : "—"}<span>%</span></div><div class="goal-explainer"><strong>${hits} of ${sample.length} solves</strong> under ${esc(pref.target)}s<br>${delta != null ? `${delta >= 0 ? "+" : ""}${delta.toFixed(1)} percentage points vs. previous window` : sample.length < pref.window ? `Building your ${pref.window}-solve window` : `Your latest ${pref.window} solves`}</div></div><div class="goal-progress"><div style="width:${pct}%"></div></div><div class="goal-controls"><label>Under <input type="number" min="0.01" max="3600" step="0.5" value="${esc(pref.target)}" data-control="target" aria-label="Target in seconds"> seconds</label><label>Last <input type="number" min="5" max="10000" step="1" value="${esc(pref.window)}" data-control="window" aria-label="Rolling window size"> solves</label></div>${chart(data, "goal", wide ? 230 : 98)}<p class="chart-note">Strictly under the target. +2 included, DNF counts as a miss.</p></section>`;
  }
  function cubePanel() {
    const label = scramblePending
      ? "PREPARING…"
      : scrambleSource === "practice"
        ? "PRACTICE SCRAMBLE"
        : "";
    return `<section class="panel cube-panel"><div class="panel-heading"><div><h2>Scramble</h2>${label ? `<p>${label}</p>` : ""}</div><span class="chip">3 × 3</span></div><div id="cube-mount"></div><div class="cube-bottom"><p class="scramble-mini">${esc(currentScramble)}</p><button class="btn btn-dark" data-action="practice">${icon("play")}Timer ${icon("arrow")}</button></div></section>`;
  }
  function recent(data, limit = 5) {
    const best = C.stats(solves()).best;
    return data.length
      ? `<div class="recent-list">${data
          .slice(-limit)
          .reverse()
          .map(
            (s) =>
              `<button class="recent-row" data-solve="${esc(s.id)}"><span class="solve-number">#${solves().indexOf(s) + 1}</span><span class="solve-time">${fmt(C.value(s))}${s.penalty === "+2" ? "+" : ""}</span><span class="solve-date">${shortDate(s)}</span>${C.value(s) === best ? '<span class="solve-badge">PB</span>' : ""}<span class="arrow">↗</span></button>`,
          )
          .join("")}</div>`
      : '<div class="empty-state"><strong>No solves yet</strong></div>';
  }
  function activity(data) {
    const dayCounts = new Map();
    for (const s of data)
      if (s.date) {
        const k = localDay(dated(s));
        dayCounts.set(k, (dayCounts.get(k) || 0) + 1);
      }
    const last = new Date();
    last.setHours(12, 0, 0, 0);
    const first = new Date(last);
    first.setDate(first.getDate() - 181);
    first.setDate(first.getDate() - ((first.getDay() + 6) % 7));
    let cells = "",
      max = 1;
    for (const v of dayCounts.values()) max = Math.max(max, v);
    let activeDays = 0;
    for (let d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) {
      const count = dayCounts.get(localDay(d)) || 0;
      if (count) activeDays++;
      cells += `<div class="heat-cell" data-level="${count ? Math.max(1, Math.ceil((count / max) * 4)) : 0}" title="${d.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}: ${count} solves"></div>`;
    }
    return `<section class="panel panel-pad activity-panel"><div class="panel-heading"><div><h2>Activity</h2><p>${activeDays} active day${activeDays === 1 ? "" : "s"} in the last six months</p></div>${icon("calendar")}</div><div class="activity-wrap"><div class="activity-chart"><div class="heatmap" role="img" aria-label="Daily solve activity for the last six months">${cells}</div><div class="activity-meta"><span>${first.toLocaleDateString("en", { month: "long" })}</span><span>${last.toLocaleDateString("en", { month: "long" })}</span></div></div><div class="heat-legend"><span>Less</span>${[0, 1, 2, 3, 4].map((x) => `<i class="heat-cell" data-level="${x}"></i>`).join("")}<span>More</span></div></div></section>`;
  }
  function overview() {
    const a = rangeSolves(),
      s = C.stats(a);
    return (
      heading("Overview", rangeSelect()) +
      metrics(a) +
      `<div class="main-grid"><section class="panel panel-pad"><div class="panel-heading"><h2>Solve times</h2><div class="segmented">${["ao5", "ao12", "ao100"].map((x) => `<button class="${pref.trend === x ? "active" : ""}" data-trend="${x}">${x}</button>`).join("")}</div></div><div class="legend"><span><i></i>${pref.trend}</span><span><i class="single"></i>Individual solves</span></div>${chart(a)}<div class="chart-caption"><span>${a.length ? `${a.length.toLocaleString()} solves · chronological order` : "No solves yet"}</span><button class="btn-link" data-view="insights">Explore ${icon("arrow-up-right")}</button></div></section>${cubePanel()}</div><div class="bottom-grid">${goalPanel(a)}<section class="panel panel-pad"><div class="panel-heading"><h2>Recent solves</h2><button class="btn-link" data-view="solves">View all ${icon("arrow-up-right")}</button></div>${recent(a, 5)}${!a.length ? '<div class="demo-empty"><button data-action="demo">Load demo data</button></div>' : ""}</section></div>${activity(solves())}`
    );
  }
  function panelStats() {
    const s = C.stats(solves());
    return `<div class="panel-stats">${[
      ["ao5", fmt(s.ao5)],
      ["ao12", fmt(s.ao12)],
      ["mean", fmt(s.mean)],
      ["best", fmt(s.best)],
    ]
      .map(([k, v]) => `<div><span>${k}</span><strong>${v}</strong></div>`)
      .join("")}</div>`;
  }
  function solveRow(s, n) {
    const t = `${fmt(C.value(s))}${s.penalty === "+2" ? "+" : ""}`;
    return `<div class="solve-entry"><button class="solve-entry-open" data-solve="${esc(s.id)}" aria-label="Solve ${n}: ${t}">${t}</button><button class="solve-entry-del" data-delete="${esc(s.id)}" tabindex="-1" aria-label="Delete solve ${n}">${icon("trash")}</button></div>`;
  }
  function solveRows(from, to) {
    const all = solves(),
      total = all.length;
    let html = "";
    for (let i = from; i < to && i < total; i++)
      html += solveRow(all[total - 1 - i], total - i);
    return html;
  }
  function focusPage() {
    const last = solves().find((x) => x.id === latestId),
      total = solves().length;
    panelCount = Math.max(PANEL_BATCH, Math.min(panelCount, total));
    return `<div class="focus-stage timer-card" data-state="${timer.phase}"><div class="focus-main"><div class="focus-scramble">${esc(scramblePending ? "Preparing scramble…" : currentScramble)}</div><div class="focus-row"><div id="cube-mount" class="focus-cube"></div><div class="focus-time"><button class="timer-surface" id="timer-surface" aria-label="Timer. ${pref.inspection ? "Press to start inspection, then hold and release to start the solve." : "Hold space or press and hold here, then release to start."}"><span class="timer-state sr-only" id="timer-state" role="status">${last ? "SAVED" : "READY"}</span><span class="timer-digits" id="timer-digits">${last ? fmt(C.value(last)) : "0.00"}</span></button><div class="timer-result" id="timer-result">${last ? resultControls(last) : ""}</div></div></div></div><aside class="solve-panel">${panelStats()}<div class="solve-list" id="solve-list">${total ? solveRows(0, panelCount) : '<p class="solve-empty">No solves yet</p>'}<div class="solve-sentinel" id="solve-sentinel"${panelCount >= total ? " hidden" : ""}></div></div></aside></div>`;
  }
  // The solve panel grows in batches as it scrolls: appended rows never
  // disturb the rows already on screen, so scrolling stays smooth.
  function bindSolvePanel() {
    const list = $("#solve-list"),
      sentinel = $("#solve-sentinel");
    if (
      !list ||
      !sentinel ||
      typeof IntersectionObserver === "undefined" ||
      panelCount >= solves().length
    )
      return;
    const grow = () => {
      const total = solves().length;
      if (panelCount < total) {
        const next = Math.min(total, panelCount + PANEL_BATCH);
        sentinel.insertAdjacentHTML("beforebegin", solveRows(panelCount, next));
        panelCount = next;
      }
      if (panelCount >= solves().length) {
        sentinel.hidden = true;
        panelObserver?.disconnect();
        panelObserver = null;
      } else {
        panelObserver.unobserve(sentinel);
        panelObserver.observe(sentinel);
      }
    };
    panelObserver = new IntersectionObserver(
      (entries) => {
        if (entries.some((x) => x.isIntersecting)) grow();
      },
      { root: list, rootMargin: "700px 0px" },
    );
    panelObserver.observe(sentinel);
    // Fallback for the cases where the observer is throttled.
    list.addEventListener(
      "scroll",
      () => {
        if (
          panelObserver &&
          list.scrollHeight - list.scrollTop - list.clientHeight < 700
        )
          grow();
      },
      { passive: true },
    );
    // A restored or short list can already sit at the end: top it up once.
    setTimeout(() => {
      if (
        panelObserver &&
        list.isConnected &&
        list.scrollHeight - list.scrollTop - list.clientHeight < 700
      )
        grow();
    }, 0);
  }
  function resultControls(s) {
    return `<button class="penalty-btn ${s.penalty === "" ? "active" : ""}" data-penalty="" data-id="${esc(s.id)}">OK</button><button class="penalty-btn ${s.penalty === "+2" ? "active" : ""}" data-penalty="+2" data-id="${esc(s.id)}">+2</button><button class="penalty-btn ${s.penalty === "DNF" ? "active" : ""}" data-penalty="DNF" data-id="${esc(s.id)}">DNF</button><button class="icon-btn" data-delete="${esc(s.id)}" aria-label="Delete last solve">${icon("trash")}</button>`;
  }
  function filtered() {
    let a = solves().filter(
      (s) =>
        (!query ||
          `${fmt(C.value(s))} ${s.scramble} ${s.note || ""} ${s.originalDate || s.date || ""}`
            .toLowerCase()
            .includes(query.toLowerCase())) &&
        (filter === "all" ||
          (filter === "dnf" && s.penalty === "DNF") ||
          (filter === "sub" && C.value(s) < pref.target)) &&
        (!startDate || (s.date && localDay(dated(s)) >= startDate)) &&
        (!endDate || (s.date && localDay(dated(s)) <= endDate)),
    );
    if (sort === "fastest") a.sort((a, b) => C.value(a) - C.value(b));
    else if (sort === "newest") a.reverse();
    return a;
  }
  function tableHTML(data, full = true) {
    if (!data.length)
      return empty("No solves yet", "Recorded solves appear here.");
    return `<div class="table-scroll"><table><thead><tr><th>Solve</th><th>Time</th><th>${full ? "ao5" : "Status"}</th><th>Scramble</th><th>Recorded</th><th><span class="sr-only">Details</span></th></tr></thead><tbody>${data
      .map((s) => {
        const idx = solves().indexOf(s);
        return `<tr data-solve="${esc(s.id)}"><td>#${idx + 1}</td><td class="time-cell">${fmt(C.value(s))}${s.penalty === "+2" ? "<small>+</small>" : ""}</td><td>${full ? fmt(C.average(solves().slice(Math.max(0, idx - 4), idx + 1), 5)) : s.penalty || "OK"}</td><td class="scramble-cell" title="${esc(s.scramble)}">${esc(s.scramble || "No scramble recorded")}</td><td>${esc(longDate(s))}</td><td><button class="icon-btn" data-solve="${esc(s.id)}" aria-label="View solve ${idx + 1}">${icon("arrow-up-right")}</button></td></tr>`;
      })
      .join("")}</tbody></table></div>`;
  }
  function library() {
    const a = filtered(),
      s = C.stats(solves()),
      pages = Math.max(1, Math.ceil(a.length / 20));
    page = Math.min(page, pages);
    return (
      heading(
        "Solve library",
        `<button class="btn btn-quiet" data-action="manual">${icon("plus")}Manual entry</button><button class="btn btn-quiet" data-action="manage">${icon("folder")}Manage</button><button class="btn btn-dark" data-action="export">${icon("download")}Export CSV</button>`,
      ) +
      `<div class="stat-strip"><span><strong>${s.count.toLocaleString()}</strong> solves</span><span>Best <strong>${fmt(s.best)}</strong></span><span>Mean <strong>${fmt(s.mean)}</strong></span><span><strong>${s.dnf}</strong> DNF</span><span class="chip">${esc(active()?.file || "Index, Time, Scramble, Date")}</span></div><section class="panel"><div class="table-tools"><div class="search-wrap">${icon("search")}<input type="search" id="solve-search" placeholder="Search time, scramble, or note…" value="${esc(query)}" aria-label="Search solves"></div><div class="table-actions"><select class="period-select" data-control="filter" aria-label="Filter solves">${[
        ["all", "All results"],
        ["sub", `Sub-${pref.target}`],
        ["dnf", "DNF only"],
      ]
        .map(
          ([v, t]) =>
            `<option value="${v}" ${filter === v ? "selected" : ""}>${t}</option>`,
        )
        .join(
          "",
        )}</select><select class="period-select" data-control="sort" aria-label="Sort solves">${[
        ["newest", "Newest first"],
        ["oldest", "Oldest first"],
        ["fastest", "Fastest first"],
      ]
        .map(
          ([v, t]) =>
            `<option value="${v}" ${sort === v ? "selected" : ""}>${t}</option>`,
        )
        .join(
          "",
        )}</select></div></div><div class="table-tools" style="padding-top:12px;padding-bottom:12px"><div class="chart-range"><label>From <input type="date" data-control="start-date" value="${esc(startDate)}"></label><label>To <input type="date" data-control="end-date" value="${esc(endDate)}"></label></div><button class="btn-link" data-action="clear-filter">Reset filters</button></div><div id="library-results">${a.length ? tableHTML(a.slice((page - 1) * 20, page * 20)) : solves().length ? '<div class="empty-state"><strong>No matching solves</strong>Try a different search, or reset the filters.</div>' : empty()}<div class="pagination"><span>${a.length ? `${(page - 1) * 20 + 1}–${Math.min(page * 20, a.length)} of ${a.length.toLocaleString()}` : "0 solves"}</span><div><button class="icon-btn" data-page="${page - 1}" ${page <= 1 ? "disabled" : ""} aria-label="Previous page">${icon("left")}</button><span>${page} / ${pages}</span><button class="icon-btn" data-page="${page + 1}" ${page >= pages ? "disabled" : ""} aria-label="Next page">${icon("chevron")}</button></div></div></div></section><p class="range-note">Export uses the current filters, in chronological order.</p>`
    );
  }
  function histogram(a) {
    const vals = a.map(C.value).filter(Number.isFinite);
    if (!vals.length)
      return '<div class="empty-chart"><strong>No completed solves</strong></div>';
    const min = vals.reduce((a, b) => Math.min(a, b), Infinity),
      max = vals.reduce((a, b) => Math.max(a, b), -Infinity),
      size = (max - min || 1) / 12,
      bins = Array(12).fill(0);
    for (const v of vals) bins[Math.min(11, Math.floor((v - min) / size))]++;
    const top = Math.max(...bins);
    return `<div class="histogram">${bins.map((count, i) => `<div class="hist-bin" title="${fmt(min + i * size)}–${fmt(min + (i + 1) * size)}s: ${count} solves"><div style="height:${(count / top) * 100}%"></div></div>`).join("")}</div><div class="hist-labels"><span>${fmt(min)}s</span><span>Finish time</span><span>${fmt(max)}s</span></div>`;
  }
  function bestAverage(a, n) {
    let best = null;
    for (let i = n - 1; i < a.length; i++) {
      const v = C.average(a.slice(i - n + 1, i + 1), n);
      if (best == null || v < best) best = v;
    }
    return best;
  }
  function insights() {
    const a = rangeSolves(),
      s = C.stats(a),
      groups = Array.from({ length: 7 }, () => []),
      hours = Array.from({ length: 24 }, () => []);
    for (const solve of a)
      if (solve.date) {
        groups[(dated(solve).getDay() + 6) % 7].push(solve);
        hours[dated(solve).getHours()].push(solve);
      }
    const top = Math.max(1, ...groups.map((g) => g.length));
    return (
      heading("Insights", rangeSelect()) +
      `<div class="insights-grid">${goalPanel(a, true)}<section class="panel panel-pad"><div class="panel-heading"><div><h2>Distribution</h2><p>Completed solves only</p></div><span class="chip">${s.valid} solves</span></div>${histogram(a)}<div class="insight-facts"><div><span>Median</span><strong>${fmt(s.median)}</strong></div><div><span>Std. deviation</span><strong>${fmt(s.sd)}</strong></div><div><span>Completion</span><strong>${a.length ? ((s.valid / a.length) * 100).toFixed(1) + "%" : "—"}</strong></div></div></section><section class="panel panel-pad"><div class="panel-heading"><div><h2>Personal best over time</h2></div>${icon("trophy")}</div>${chart(a, "pb", 220)}<div class="chart-caption"><span>Best single</span><strong>${fmt(s.best)}${s.best != null ? " seconds" : ""}</strong></div></section><section class="panel panel-pad"><div class="panel-heading"><div><h2>Solves by weekday</h2></div>${icon("calendar")}</div><div class="bar-list">${groups.map((g, i) => `<div class="bar-row"><span>${["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][i]}</span><div class="bar-track"><div style="width:${(g.length / top) * 100}%"></div></div><strong>${g.length}</strong></div>`).join("")}</div><p class="chart-note">Local dates. Solves without a date are excluded.</p></section><section class="panel panel-pad"><div class="panel-heading"><div><h2>Best averages</h2></div>${icon("target")}</div><table style="margin-top:17px"><thead><tr><th style="padding-left:0">Window</th><th>Current</th><th>Best in range</th></tr></thead><tbody>${[5, 12, 100].map((n) => `<tr><td style="padding-left:0">ao${n}</td><td class="time-cell">${fmt(C.average(a, n))}</td><td class="time-cell">${fmt(bestAverage(a, n))}</td></tr>`).join("")}</tbody></table><div class="quality-note">Averages trim the fastest and slowest 5%, rounded up. DNFs stay in the window.</div></section><section class="panel panel-pad wide"><div class="panel-heading"><div><h2>Mean time by hour</h2></div>${icon("sun")}</div><div class="bar-list" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">${hours
        .map((g, i) => {
          const mean = C.stats(g).mean;
          return `<div class="bar-row" title="${g.length} solves · ${g.filter((x) => x.penalty === "DNF").length} DNF"><span>${String(i).padStart(2, "0")}:00</span><strong>${fmt(mean)}</strong><span style="min-width:0;font-size:9px">${g.length} solves</span></div>`;
        })
        .join(
          "",
        )}</div><p class="chart-note">Local timezone. Compare hours with similar solve counts.</p></section></div>${activity(solves())}`
    );
  }
  function render() {
    scene?.destroy();
    scene = null;
    panelObserver?.disconnect();
    panelObserver = null;
    $("#chart-tooltip").hidden = true;
    const focused = view === "timer",
      scroll = keepPanel ? $("#solve-list")?.scrollTop || 0 : 0;
    if (!keepPanel) panelCount = PANEL_BATCH;
    keepPanel = false;
    $("#main").innerHTML = focused
      ? focusPage()
      : banners() +
        `<div class="page-enter">${view === "overview" ? overview() : view === "solves" ? library() : insights()}</div>`;
    document.body.classList.toggle("focus-mode", focused);
    document.body.classList.toggle("timer-view", focused);
    renderSidebar();
    renderIcons();
    if ($("#cube-mount")) {
      scene = new CubeScene($("#cube-mount"), currentScramble);
      scene.onChange = updateNotation;
      if (pref.cubeMode === "net") scene.setMode("net");
      updateNotation();
    }
    bindCharts();
    if (focused) {
      bindSolvePanel();
      if ($("#solve-list")) $("#solve-list").scrollTop = scroll;
      bindTimerSurface();
      requestAnimationFrame(() => {
        if (view === "timer" && !$("#dialog").open)
          $("#timer-surface")?.focus({ preventScroll: true });
      });
    }
  }
  function navigate(next) {
    if (timerBusy()) return;
    view = next;
    history.replaceState(null, "", "#" + view);
    render();
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  // True sticker coordinates drive both the 3D scene and the unfolded net.
  class CubeScene {
    constructor(mount, alg) {
      this.mount = mount;
      this.alg = alg;
      this.moves = [];
      this.index = 0;
      this.cube = new C.Cube();
      this.pitch = -25;
      this.yaw = -34;
      this.zoom = 1;
      this.mode = "3d";
      this.playing = false;
      this.anim = 0;
      this.disposed = false;
      this.drag = null;
      this.velocity = 0;
      this.busy = false;
      if (!alg?.trim() || alg.trim() === "N/A") {
        const preparing = scramblePending && mount.id !== "drawer-cube";
        mount.innerHTML = `<div class="empty-state cube-placeholder"><strong>${preparing ? "Preparing scramble…" : "No scramble recorded"}</strong></div>`;
        this.invalid = true;
        return;
      }
      try {
        this.moves = C.tokens(alg);
        this.cube.apply(alg);
        this.index = this.moves.length;
      } catch (e) {
        mount.innerHTML = `<div class="empty-state"><strong>Scramble unavailable</strong>${esc(e.message)}</div>`;
        this.invalid = true;
        return;
      }
      mount.innerHTML = `<div class="cube-stage" tabindex="0" role="img" aria-label="Scrambled 3 by 3 cube. Drag or use arrow keys to rotate, click to switch to the flat net, Home to reset."><span class="cube-mini-label">WHITE ↑ &nbsp; GREEN →</span><div class="cube-world"></div><span class="cube-help">drag to rotate · click for net</span></div>`;
      this.stage = $(".cube-stage", mount);
      this.world = $(".cube-world", mount);
      this.elements = this.cube.stickers.map((s) => {
        const el = document.createElement("div");
        el.className = "sticker";
        el.style.background = C.FACES[s.face].color;
        this.world.append(el);
        return el;
      });
      this.draw();
      this.orbit();
      this.bind();
    }
    draw(spec = null, fraction = 0) {
      if (this.invalid || this.disposed) return;
      if (this.mode === "net") {
        this.drawNet();
        return;
      }
      this.cube.stickers.forEach((st, i) => {
        let s = st;
        if (spec && spec.select(st.p)) {
          s = { ...st };
          for (const k of ["p", "n", "right", "down"])
            s[k] = C.rotate(st[k], spec.axis, spec.angle * fraction);
        }
        const css = (v) => [v[0], -v[1], v[2]],
          r = css(s.right),
          d = css(s.down),
          n = css(s.n),
          p = css(s.p.map((v, j) => v * 46 + s.n[j] * 23));
        this.elements[i].style.transform =
          `matrix3d(${[...r, 0, ...d, 0, ...n, 0, ...p, 1].map((v) => (Math.abs(v) < 1e-9 ? 0 : v)).join(",")})`;
      });
    }
    orbit() {
      if (this.world)
        this.world.style.transform = `rotateX(${this.pitch}deg) rotateY(${this.yaw}deg) scale(${this.zoom})`;
    }
    drawNet() {
      const f = this.cube.facelets();
      let net = $(".cube-net", this.stage);
      if (!net) {
        net = document.createElement("div");
        net.className = "cube-net";
        this.stage.append(net);
      }
      const coords = {
        U: [2, 1],
        L: [1, 2],
        F: [2, 2],
        R: [3, 2],
        B: [4, 2],
        D: [2, 3],
      };
      net.innerHTML = Object.entries(coords)
        .map(
          ([face, [col, row]]) =>
            `<div class="net-face" style="grid-column:${col};grid-row:${row}" title="${face} face">${f[face].map((c) => `<span style="background:${C.FACES[c].color}"></span>`).join("")}</div>`,
        )
        .join("");
    }
    setMode(mode) {
      if (this.invalid) return;
      this.mode = mode;
      this.world.style.display = mode === "net" ? "none" : "";
      $(".cube-help", this.stage).textContent =
        mode === "net" ? "click for 3D" : "drag to rotate · click for net";
      if (mode === "net") this.drawNet();
      else {
        $(".cube-net", this.stage)?.remove();
        this.draw();
      }
    }
    toggleMode() {
      const next = this.mode === "net" ? "3d" : "net";
      this.setMode(next);
      if (this === scene) {
        pref.cubeMode = next;
        savePref();
      }
    }
    bind() {
      this.stage.addEventListener("pointerdown", (e) => {
        if (e.target.closest("button")) return;
        this.press = { x: e.clientX, y: e.clientY, moved: false };
        if (this.mode === "net") return;
        this.stage.setPointerCapture(e.pointerId);
        cancelAnimationFrame(this.inertia);
        this.drag = { x: e.clientX, y: e.clientY };
        this.velocity = 0;
      });
      this.stage.addEventListener("pointermove", (e) => {
        if (
          this.press &&
          Math.hypot(e.clientX - this.press.x, e.clientY - this.press.y) > 4
        )
          this.press.moved = true;
        if (!this.drag) return;
        const dx = e.clientX - this.drag.x,
          dy = e.clientY - this.drag.y;
        this.yaw += dx * 0.55;
        this.pitch = Math.max(-85, Math.min(85, this.pitch - dy * 0.45));
        this.velocity = dx * 0.55;
        this.drag = { x: e.clientX, y: e.clientY };
        this.orbit();
      });
      const end = () => {
        const tap = this.press && !this.press.moved;
        this.press = null;
        this.drag = null;
        if (tap) {
          this.toggleMode();
          return;
        }
        const tick = () => {
          if (this.disposed || reduced) return;
          this.velocity *= 0.91;
          this.yaw += this.velocity;
          this.orbit();
          if (Math.abs(this.velocity) > 0.03)
            this.inertia = requestAnimationFrame(tick);
        };
        tick();
      };
      this.stage.addEventListener("pointerup", end);
      this.stage.addEventListener("pointercancel", () => {
        this.drag = null;
        this.press = null;
      });
      this.stage.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          this.toggleMode();
          return;
        }
        if (
          !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home"].includes(
            e.key,
          )
        )
          return;
        e.preventDefault();
        e.stopPropagation();
        if (e.key === "Home") {
          this.pitch = -25;
          this.yaw = -34;
        } else if (e.key === "ArrowLeft") this.yaw -= 15;
        else if (e.key === "ArrowRight") this.yaw += 15;
        else if (e.key === "ArrowUp")
          this.pitch = Math.max(-85, this.pitch - 15);
        else this.pitch = Math.min(85, this.pitch + 15);
        this.orbit();
      });
    }
    async step(direction) {
      if (this.invalid || this.busy || this.disposed) return;
      if (
        (direction > 0 && this.index >= this.moves.length) ||
        (direction < 0 && this.index <= 0)
      )
        return;
      this.busy = true;
      const token =
          direction > 0
            ? this.moves[this.index]
            : C.inverse(this.moves[this.index - 1]),
        spec = C.moveSpec(token),
        start = performance.now(),
        duration = reduced ? 0 : 260;
      await new Promise((resolve) => {
        this.finishAnimation = resolve;
        const frame = () => {
          if (this.disposed) {
            resolve();
            return;
          }
          const p = duration
            ? Math.min(1, (performance.now() - start) / duration)
            : 1;
          this.draw(spec, p * p * (3 - 2 * p));
          if (p < 1) this.anim = requestAnimationFrame(frame);
          else resolve();
        };
        frame();
      });
      if (this.disposed) return;
      this.cube.move(token);
      this.index += direction;
      this.busy = false;
      this.draw();
      this.onChange?.();
    }
    seek(index) {
      if (this.invalid || this.busy) return;
      this.playing = false;
      this.index = Math.max(0, Math.min(this.moves.length, index));
      this.cube = new C.Cube().apply(this.moves.slice(0, this.index).join(" "));
      this.draw();
      this.onChange?.();
    }
    async play() {
      if (this.invalid) return;
      if (this.playing) {
        this.playing = false;
        this.onChange?.();
        return;
      }
      if (this.busy) return;
      if (this.index === this.moves.length) this.seek(0);
      this.playing = true;
      this.onChange?.();
      while (this.playing && this.index < this.moves.length && !this.disposed) {
        await this.step(1);
        if (!this.disposed) await new Promise((r) => setTimeout(r, 70));
      }
      this.playing = false;
      this.onChange?.();
    }
    destroy() {
      this.disposed = true;
      this.playing = false;
      cancelAnimationFrame(this.anim);
      cancelAnimationFrame(this.inertia);
      this.finishAnimation?.();
    }
  }
  function updateNotation() {
    const s = drawerScene || scene;
    if (!s || s.invalid) return;
    const root = drawerScene ? $("#dialog") : document;
    const el = $("#scramble-notation", root);
    if (el)
      el.innerHTML = s.moves
        .map(
          (m, i) =>
            `<button class="${i < s.index ? "done " : ""}${i === s.index - 1 ? "current" : ""}" data-move="${i + 1}" aria-label="Show cube after move ${i + 1}: ${esc(m)}">${esc(m)}</button>`,
        )
        .join("");
    const play = $('[data-cube="play"]', root);
    if (play) {
      play.innerHTML = icon(s.playing ? "pause" : "play");
      play.setAttribute(
        "aria-label",
        s.playing ? "Pause scramble" : "Play scramble",
      );
    }
  }
  function bindCharts() {
    const data = rangeSolves();
    $$("[data-chart]").forEach((hit) => {
      hit.addEventListener("pointermove", (e) => {
        const rect = hit.getBoundingClientRect(),
          i = Math.max(
            0,
            Math.min(
              data.length - 1,
              Math.round(
                ((e.clientX - rect.left) / rect.width) * (data.length - 1),
              ),
            ),
          ),
          s = data[i];
        if (!s) return;
        const kind = hit.dataset.chart;
        let v, label;
        if (kind === "goal") {
          v = C.subSeries(
            data.slice(Math.max(0, i + 1 - pref.window), i + 1),
            pref.window,
            pref.target,
          ).at(-1);
          label =
            v == null
              ? `Building ${pref.window}-solve window`
              : `${v.toFixed(1)}% under ${pref.target}s`;
        } else
          label = `${fmt(C.value(s))}${s.penalty === "+2" ? "+" : ""} seconds`;
        const tip = $("#chart-tooltip");
        tip.innerHTML = `Solve #${solves().indexOf(s) + 1} · ${esc(shortDate(s))}<br><strong>${esc(label)}</strong><br>Click to inspect scramble`;
        tip.hidden = false;
        tip.style.left = Math.min(innerWidth - 220, e.clientX + 12) + "px";
        tip.style.top = Math.max(8, e.clientY - 80) + "px";
        hit.dataset.solveId = s.id;
      });
      hit.addEventListener(
        "pointerleave",
        () => ($("#chart-tooltip").hidden = true),
      );
      hit.addEventListener("click", () => {
        if (hit.dataset.solveId) openSolve(hit.dataset.solveId);
      });
    });
  }

  // Timing uses a monotonic clock. Pointer and keyboard share one state machine.
  function timerBusy() {
    return ["holding", "ready", "running", "inspection"].includes(timer.phase);
  }
  function setTimerPhase(phase) {
    timer.phase = phase;
    $(".timer-card")?.setAttribute("data-state", phase);
    document.body.classList.toggle("timing", phase === "running");
    document.body.classList.toggle(
      "solving",
      ["inspection", "ready", "running"].includes(phase) ||
        (phase === "holding" && timer.priorPhase === "inspection"),
    );
    const label = $("#timer-state");
    if (label)
      label.textContent =
        {
          idle: "READY",
          holding: "HOLD",
          ready: "RELEASE",
          running: "",
          inspection: "INSPECTION",
          stopped: "SAVED",
        }[phase] || "";
  }
  function beginHold() {
    if (view !== "timer" || $("#dialog").open) return;
    if (scramblePending) {
      toast("Preparing scramble…");
      return;
    }
    if (timer.phase === "running") {
      finishSolve();
      timer.blockedRelease = true;
      return;
    }
    if (timer.phase === "holding" || timer.phase === "ready") return;
    if (!active() || demo) {
      openCategory("Create a category to start recording.");
      return;
    }
    if (pref.inspection && (timer.phase === "idle" || timer.phase === "stopped")) {
      timer.inspectStart = performance.now();
      timer.penalty = "";
      setTimerPhase("inspection");
      inspectionTick();
      return;
    }
    timer.priorPhase = timer.phase;
    setTimerPhase("holding");
    timer.hold = setTimeout(() => setTimerPhase("ready"), 350);
  }
  function releaseHold() {
    if (timer.blockedRelease) {
      timer.blockedRelease = false;
      return;
    }
    clearTimeout(timer.hold);
    if (timer.phase === "holding") {
      setTimerPhase(timer.priorPhase === "inspection" ? "inspection" : "idle");
      return;
    }
    if (timer.phase !== "ready") return;
    if (pref.inspection && timer.priorPhase !== "inspection") {
      timer.inspectStart = performance.now();
      timer.penalty = "";
      setTimerPhase("inspection");
      inspectionTick();
      return;
    }
    if (timer.priorPhase === "inspection") {
      const seconds = (performance.now() - timer.inspectStart) / 1000;
      timer.penalty = seconds >= 17 ? "DNF" : seconds >= 15 ? "+2" : "";
    } else timer.penalty = "";
    timer.start = performance.now();
    cancelAnimationFrame(timer.raf);
    setTimerPhase("running");
    if ($("#timer-result")) $("#timer-result").innerHTML = "";
    if ($("#timer-instruction"))
      $("#timer-instruction").textContent = "Any key to stop";
    tick();
  }
  function tick() {
    if (timer.phase !== "running") return;
    timer.elapsed = performance.now() - timer.start;
    $("#timer-digits").textContent = fmt(timer.elapsed / 1000);
    timer.raf = requestAnimationFrame(tick);
  }
  function inspectionTick() {
    if (
      !["inspection", "holding", "ready"].includes(timer.phase) ||
      (timer.phase !== "inspection" && timer.priorPhase !== "inspection")
    )
      return;
    const seconds = (performance.now() - timer.inspectStart) / 1000;
    if (seconds >= 17) {
      inspectionDNF();
      return;
    }
    $("#timer-digits").textContent =
      seconds >= 15 ? "+2" : String(Math.ceil(15 - seconds));
    if ($("#timer-instruction"))
      $("#timer-instruction").textContent = "Hold space, release to start";
    timer.raf = requestAnimationFrame(inspectionTick);
  }
  // Inspection past 17 seconds is a DNF: record it and be ready for the next
  // attempt, rather than leaving the timer waiting for a key.
  function inspectionDNF() {
    cancelAnimationFrame(timer.raf);
    clearTimeout(timer.hold);
    timer.blockedRelease = false;
    timer.penalty = "";
    const s = {
      id: uid(),
      rawMs: 0,
      penalty: "DNF",
      scramble: currentScramble,
      date: new Date().toISOString(),
      note: "",
    };
    active().solves.push(s);
    latestId = s.id;
    setTimerPhase("stopped");
    persist();
    takeScramble();
    render();
    toast("Inspection ran out. Saved as DNF.");
  }
  function finishSolve() {
    if (timer.phase !== "running") return;
    const rawMs = Math.floor((performance.now() - timer.start) / 10) * 10;
    cancelAnimationFrame(timer.raf);
    const s = {
      id: uid(),
      rawMs,
      penalty: timer.penalty,
      scramble: currentScramble,
      date: new Date().toISOString(),
      note: "",
    };
    active().solves.push(s);
    latestId = s.id;
    setTimerPhase("stopped");
    persist();
    takeScramble();
    render();
    const old = solves().slice(0, -1).map(C.value).filter(Number.isFinite);
    if (
      old.length &&
      C.value(s) < old.reduce((a, b) => Math.min(a, b), Infinity)
    )
      toast("New personal best.");
  }
  function cancelTimer() {
    clearTimeout(timer.hold);
    cancelAnimationFrame(timer.raf);
    timer.blockedRelease = false;
    setTimerPhase("idle");
    if (view === "timer") render();
  }
  function bindTimerSurface() {
    const el = $("#timer-surface");
    el.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      timer.pointerActive = true;
      beginHold();
    });
    el.addEventListener("pointercancel", () => {
      timer.pointerActive = false;
      timer.blockedRelease = false;
      if (["holding", "ready"].includes(timer.phase)) {
        clearTimeout(timer.hold);
        setTimerPhase(
          timer.priorPhase === "inspection" ? "inspection" : "idle",
        );
      }
    });
    el.addEventListener("click", (e) => e.preventDefault());
  }
  function editable(el) {
    return el?.closest('input,textarea,select,[contenteditable="true"]');
  }
  const sidebar = $("#sidebar");
  function openSidebar() {
    if (timerBusy() || $("#dialog").open) return;
    document.body.classList.add("sidebar-open");
  }
  function closeSidebar() {
    document.body.classList.remove("sidebar-open");
  }
  $("#sidebar-hotzone").addEventListener("pointerenter", openSidebar);
  sidebar.addEventListener("pointerenter", openSidebar);
  sidebar.addEventListener("focusin", openSidebar);
  sidebar.addEventListener("focusout", (e) => {
    if (!sidebar.contains(e.relatedTarget)) closeSidebar();
  });
  document.addEventListener("pointermove", (e) => {
    if (!matchMedia("(min-width: 961px)").matches) return;
    if (e.clientX <= 6) openSidebar();
    else if (
      document.body.classList.contains("sidebar-open") &&
      e.clientX > sidebar.offsetWidth + 30
    )
      closeSidebar();
  });
  document.addEventListener("keydown", (e) => {
    if ($("#dialog").open || (timer.phase !== "running" && editable(e.target)))
      return;
    if (
      e.key === "Enter" &&
      view === "timer" &&
      e.target.id === "timer-surface" &&
      timer.phase !== "running" &&
      !e.repeat
    ) {
      e.preventDefault();
      beginHold();
      if (timer.phase === "holding") {
        clearTimeout(timer.hold);
        setTimerPhase("ready");
        releaseHold();
      }
      return;
    }
    if (
      timer.phase === "running" &&
      !e.repeat &&
      !["Shift", "Control", "Alt", "Meta", "Tab"].includes(e.key)
    ) {
      e.preventDefault();
      if (e.key === "Escape") {
        cancelTimer();
        toast("Solve cancelled.");
      } else {
        finishSolve();
        timer.blockedRelease = true;
      }
      return;
    }
    if (
      e.code === "Space" &&
      view === "timer" &&
      !e.target.closest(".cube-stage,button:not(.timer-surface)")
    ) {
      e.preventDefault();
      if (!e.repeat) beginHold();
      return;
    }
    if (e.code === "Space" && view === "timer" && e.target === document.body) {
      e.preventDefault();
      if (!e.repeat) beginHold();
      return;
    }
    if (e.key === "Escape" && timerBusy()) {
      cancelTimer();
      return;
    }
    if (!timerBusy() && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (e.key.toLowerCase() === "t") {
        e.preventDefault();
        navigate("timer");
      } else if (e.key.toLowerCase() === "n" && view === "timer") {
        newScramble();
      } else if (e.key === "?") {
        help();
      }
    }
  });
  document.addEventListener("pointerup", () => {
    if (timer.pointerActive) {
      timer.pointerActive = false;
      releaseHold();
    }
  });
  document.addEventListener("keyup", (e) => {
    if (e.code === "Space") {
      if (
        timer.phase === "holding" ||
        timer.phase === "ready" ||
        timer.blockedRelease
      ) {
        e.preventDefault();
        releaseHold();
      }
    } else if (timer.blockedRelease) timer.blockedRelease = false;
  });
  window.addEventListener("blur", () => {
    if (timer.phase === "holding" || timer.phase === "ready") {
      clearTimeout(timer.hold);
      setTimerPhase(timer.priorPhase === "inspection" ? "inspection" : "idle");
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (
      document.hidden &&
      (timer.phase === "holding" || timer.phase === "ready")
    ) {
      clearTimeout(timer.hold);
      setTimerPhase(timer.priorPhase === "inspection" ? "inspection" : "idle");
    }
  });
  window.addEventListener("beforeunload", (e) => {
    if (dirty || timerBusy()) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (view !== "timer" && !timerBusy()) render();
    }, 180);
  });
  function takeScramble() {
    if (scrambleWorker) {
      if (scrambleQueue.length) {
        currentScramble = scrambleQueue.shift();
        scrambleSource = "random-state";
        scrambleWorker.postMessage({ generate: true });
      } else {
        currentScramble = "";
        scramblePending = true;
      }
    } else {
      currentScramble = C.scramble();
      scrambleSource = "practice";
    }
  }
  function startScrambler() {
    if (!location.protocol.startsWith("http") || typeof Worker === "undefined")
      return;
    try {
      scrambleWorker = new Worker("assets/scramble-worker.js");
      currentScramble = "";
      scramblePending = true;
      const fallback = () => {
        scrambleWorker?.terminate();
        scrambleWorker = null;
        scrambleQueue = [];
        if (scramblePending) {
          scramblePending = false;
          currentScramble = C.scramble();
          scrambleSource = "practice";
          render();
        }
        toast(
          "Using random-move practice scrambles. The random-state generator is unavailable.",
          true,
        );
      };
      scrambleWorker.onerror = fallback;
      scrambleWorker.onmessage = (e) => {
        if (e.data.error) {
          fallback();
          return;
        }
        if (scramblePending) {
          currentScramble = e.data.algorithm;
          scrambleSource = "random-state";
          scramblePending = false;
          render();
          scrambleWorker.postMessage({ generate: true });
        } else scrambleQueue.push(e.data.algorithm);
      };
      scrambleWorker.postMessage({ generate: true });
      scrambleWorker.postMessage({ generate: true });
    } catch {
      scrambleWorker = null;
      scramblePending = false;
      currentScramble = C.scramble();
    }
  }
  function newScramble() {
    if (timerBusy()) return;
    takeScramble();
    render();
    if (view === "timer") $("#timer-surface")?.focus({ preventScroll: true });
  }
  function penalty(id, value) {
    const s = solves().find((x) => x.id === id);
    if (!s) return;
    s.penalty = value;
    if (!demo) persist();
    const inDrawer = drawerId;
    keepPanel = true;
    render();
    if (inDrawer) openSolve(id);
  }
  function deleteSolve(id) {
    const cat = active(),
      idx = cat.solves.findIndex((x) => x.id === id);
    if (idx < 0) return;
    const [s] = cat.solves.splice(idx, 1);
    if (latestId === id) latestId = null;
    if (!demo) persist();
    closeDialog();
    keepPanel = true;
    render();
    toast("Solve removed.", false, {
      label: "Undo",
      run: () => {
        cat.solves.splice(Math.min(idx, cat.solves.length), 0, s);
        if (!demo) persist();
        keepPanel = true;
        render();
      },
    });
  }

  function showDialog(title, body, cls = "") {
    drawerScene?.destroy();
    drawerScene = null;
    drawerId = null;
    $("#dialog").className = cls;
    $("#dialog-content").innerHTML =
      `<div class="dialog-head"><h2 id="dialog-title">${title}</h2><button class="icon-btn" data-action="close-dialog" aria-label="Close dialog">${icon("close")}</button></div><div class="dialog-body">${body}</div>`;
    if (!$("#dialog").open) $("#dialog").showModal();
  }
  function closeDialog() {
    $("#dialog").close();
    drawerScene?.destroy();
    drawerScene = null;
    drawerId = null;
  }
  $("#dialog").addEventListener("close", () => {
    drawerScene?.destroy();
    drawerScene = null;
    drawerId = null;
    if (view === "timer") $("#timer-surface")?.focus({ preventScroll: true });
  });
  function openCategory(
    message = "Each category keeps its own solve history and CSV file.",
  ) {
    showDialog(
      "New category",
      `<p>${esc(message)}</p><form id="category-form"><label class="field">Category name<input name="name" maxlength="80" placeholder="Name" required autofocus autocomplete="off"></label><div class="error-text" id="form-error"></div><div class="dialog-actions"><button type="button" class="btn btn-quiet" data-action="close-dialog">Cancel</button><button class="btn btn-dark" type="submit">Create category ${icon("arrow")}</button></div></form>`,
    );
    $("#category-form").onsubmit = (e) => {
      e.preventDefault();
      const name = e.target.elements.name.value.trim();
      if (!name) return;
      if (
        state.categories.some(
          (c) => c.name.toLowerCase() === name.toLowerCase(),
        )
      ) {
        $("#form-error").textContent =
          "A category with this name already exists.";
        return;
      }
      const c = { id: uid(), name, solves: [] };
      state.categories.push(c);
      pref.active = c.id;
      demo = null;
      latestId = null;
      savePref();
      persist();
      closeDialog();
      render();
      toast(`Created ${name}.`);
    };
  }
  function download(name, text) {
    const url = URL.createObjectURL(
        new Blob([text], { type: "text/csv;charset=utf-8" }),
      ),
      a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  function exportCurrent() {
    const c = active();
    if (!c?.solves.length) {
      toast("Record or import some solves first.");
      return;
    }
    const items = view === "solves" ? filtered() : c.solves;
    const set = new Set(items.map((s) => s.id));
    const selected = c.solves.filter((s) => set.has(s.id));
    download(
      (c.name.replace(/[^a-zA-Z0-9_-]/g, "-") || "solves") + ".csv",
      C.exportCSV(selected),
    );
    toast(`Exported ${selected.length} solves.`);
  }
  $("#file-input").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      if (file.size > 50 * 1024 * 1024)
        throw new Error(
          "Please split CSV files larger than 50 MB before importing.",
        );
      const result = C.parseCSV(await file.text());
      showDialog(
        "Import CSV",
        `<p><strong>${result.solves.length.toLocaleString()} solves</strong> found in ${esc(file.name)}.</p>${result.missingDates || result.unsupported ? `<p class="inline-warning">${result.missingDates ? `${result.missingDates} solve(s) have unknown dates and will be excluded from calendar views. ` : ""}${result.unsupported ? `${result.unsupported} scramble(s) use unsupported notation; their original text will be kept.` : ""}</p>` : ""}<form id="import-form"><label class="field">Import into<select name="destination"><option value="new">Create a new category</option>${state.categories.map((c) => `<option value="${esc(c.id)}">Append to ${esc(c.name)}</option>`).join("")}</select></label><label class="field" id="import-name-label">New category name<input name="name" maxlength="80" value="${esc(file.name.replace(/\.csv$/i, ""))}" required></label><p class="chart-note">Existing solves are kept. Exact matches on date, time, penalty, and scramble are skipped when appending.</p><div class="error-text" id="form-error"></div><div class="dialog-actions"><button class="btn btn-quiet" type="button" data-action="close-dialog">Cancel</button><button class="btn btn-dark" type="submit">Import solves ${icon("arrow")}</button></div></form>`,
      );
      $("#import-form").elements.destination.onchange = (e) => {
        $("#import-name-label").hidden = e.target.value !== "new";
        $("#import-form").elements.name.required = e.target.value === "new";
      };
      $("#import-form").onsubmit = (e) => {
        e.preventDefault();
        const dest = e.target.elements.destination.value,
          name = e.target.elements.name.value.trim();
        let cat;
        if (dest === "new") {
          if (!name) return;
          if (
            state.categories.some(
              (c) => c.name.toLowerCase() === name.toLowerCase(),
            )
          ) {
            $("#form-error").textContent =
              "Use a different name or append to the existing category.";
            return;
          }
          cat = { id: uid(), name, solves: [] };
          state.categories.push(cat);
        } else cat = state.categories.find((c) => c.id === dest);
        const key = (s) =>
            JSON.stringify([
              s.date || s.originalDate,
              s.rawMs,
              s.penalty,
              s.scramble,
            ]),
          seen = new Set(cat.solves.map(key));
        let skipped = 0;
        for (const s of result.solves) {
          if (dest !== "new" && seen.has(key(s))) {
            skipped++;
            continue;
          }
          cat.solves.push(s);
          seen.add(key(s));
        }
        cat.solves.sort((a, b) =>
          a.date && b.date ? Date.parse(a.date) - Date.parse(b.date) : 0,
        );
        pref.active = cat.id;
        demo = null;
        latestId = null;
        savePref();
        persist();
        closeDialog();
        navigate("overview");
        toast(
          `Imported ${result.solves.length - skipped} solves${skipped ? `; skipped ${skipped} exact duplicates` : ""}.`,
        );
      };
    } catch (err) {
      toast(err.message, true);
    }
  });
  function manual() {
    if (!active() || demo) {
      openCategory("Create a category for your times first.");
      return;
    }
    showDialog(
      "Add a solve",
      `<p>Use seconds or minutes:seconds. A trailing + means the two-second penalty is already included.</p><form id="manual-form"><label class="field">Time<input name="time" placeholder="12.34, 1:02.50, 14.34+, or DNF" required autofocus></label><label class="field">Scramble<textarea name="scramble" rows="3">${esc(currentScramble)}</textarea></label><div class="error-text" id="form-error"></div><div class="dialog-actions"><button type="button" class="btn btn-quiet" data-action="close-dialog">Cancel</button><button type="submit" class="btn btn-dark">Save solve</button></div></form>`,
    );
    $("#manual-form").onsubmit = (e) => {
      e.preventDefault();
      try {
        const time = C.parseTime(e.target.elements.time.value),
          alg = e.target.elements.scramble.value.trim();
        C.tokens(alg);
        const s = {
          id: uid(),
          ...time,
          scramble: alg,
          date: new Date().toISOString(),
          note: "",
        };
        active().solves.push(s);
        latestId = s.id;
        persist();
        takeScramble();
        closeDialog();
        render();
        toast("Solve recorded.");
      } catch (err) {
        $("#form-error").textContent = err.message;
      }
    };
  }
  function openSolve(id) {
    if (timerBusy()) return;
    const s = solves().find((x) => x.id === id);
    if (!s) return;
    $("#chart-tooltip").hidden = true;
    const i = solves().indexOf(s);
    showDialog(
      `Solve #${i + 1}`,
      `<div class="detail-grid"><div class="detail-cube"><div id="drawer-cube"></div><div class="playback"><button class="icon-btn" data-cube="first" aria-label="Show solved cube">${icon("first")}</button><button class="icon-btn" data-cube="prev" aria-label="Previous move">${icon("left")}</button><button class="icon-btn play-btn" data-cube="play" aria-label="Play scramble">${icon("play")}</button><button class="icon-btn" data-cube="next" aria-label="Next move">${icon("chevron")}</button><button class="icon-btn" data-cube="last" aria-label="Show full scramble">${icon("last")}</button></div></div><div class="detail-side"><div class="detail-time">${fmt(C.value(s))}${s.penalty === "+2" ? "+" : ""}</div><div class="detail-meta"><span>${esc(longDate(s))}</span><span>${esc(active().name)}</span></div><div class="detail-actions">${resultControls(s)}</div><div class="scramble-line"><button class="icon-btn copy-inline" data-action="copy" aria-label="Copy scramble">${icon("copy")}</button><div id="scramble-notation" class="scramble-tokens"></div></div><label class="field">Note<textarea class="detail-note" id="solve-note" maxlength="2000" rows="2" placeholder="Add a note"></textarea></label><div class="detail-nav"><button class="btn btn-quiet" data-detail-nav="${i - 1}" ${i === 0 ? "disabled" : ""}>${icon("left")}Previous</button><button class="btn btn-quiet" data-detail-nav="${i + 1}" ${i === solves().length - 1 ? "disabled" : ""}>Next ${icon("chevron")}</button></div></div></div>`,
      "solve-detail",
    );
    drawerId = id;
    $("#solve-note").value = s.note || "";
    drawerScene = new CubeScene($("#drawer-cube"), s.scramble);
    drawerScene.onChange = updateNotation;
    if (drawerScene.invalid)
      $("#scramble-notation", $("#dialog")).textContent = s.scramble;
    else updateNotation();
    $("#solve-note").addEventListener("change", (e) => {
      s.note = e.target.value;
      if (!demo) persist();
    });
  }
  function settings() {
    showDialog(
      "Settings",
      `<label class="toggle-row"><input type="checkbox" data-control="inspection" ${pref.inspection ? "checked" : ""}><span><strong>15-second inspection</strong>Press once to start inspection, then hold and release to start the solve. +2 at 15 seconds; at 17 the attempt is saved as a DNF automatically.</span></label><label class="toggle-row"><input type="checkbox" data-control="cube-net" ${pref.cubeMode === "net" ? "checked" : ""}><span><strong>Show the cube as a flat net</strong>The scramble preview opens unfolded instead of in 3D. Clicking the cube switches either way.</span></label><div class="dialog-actions"><button class="btn btn-dark" data-action="close-dialog">Done</button></div>`,
    );
  }
  function manage() {
    const c = active();
    if (!c || demo) {
      openCategory();
      return;
    }
    showDialog(
      "Category",
      `<form id="manage-form"><label class="field">Category name<input name="name" value="${esc(c.name)}" maxlength="80" required></label><p class="spacer file-status">${c.solves.length.toLocaleString()} solves<br>CSV: <code>${esc(c.file || "Assigned when saved to a folder")}</code></p><p>Renaming keeps the existing filename.</p><div class="error-text" id="form-error"></div><div class="dialog-actions"><button type="button" class="btn btn-quiet" data-action="export">${icon("download")}Export CSV</button><button type="submit" class="btn btn-dark">Save name</button></div></form>`,
    );
    $("#manage-form").onsubmit = (e) => {
      e.preventDefault();
      const name = e.target.elements.name.value.trim();
      if (!name) return;
      if (
        state.categories.some(
          (x) => x.id !== c.id && x.name.toLowerCase() === name.toLowerCase(),
        )
      ) {
        $("#form-error").textContent = "That category name is already in use.";
        return;
      }
      c.name = name;
      persist();
      closeDialog();
      render();
    };
  }
  function storage() {
    showDialog(
      "Storage",
      `<p>${server ? "Your workspace is connected to the local saver. Every solve and penalty change updates the category’s CSV beside CTU.html. A previous copy is kept in the backups folder." : "This HTML is saving a recovery copy in your browser. For automatic CSV files beside the HTML, open Start CubeTracker.cmd. You can also connect the HTML folder below in a supported browser."}</p><div class="file-list">${state.categories.map((c) => `<div><strong>${esc(c.name)}</strong><br>${esc(c.file || "No folder file yet")} · ${c.solves.length} solves</div>`).join("") || "<div>No categories yet.</div>"}</div>${!server ? '<p class="chart-note">A standalone HTML page needs you to choose a folder before it can write files. Reconnect after reopening the page.</p>' : ""}<div class="dialog-actions">${!server ? '<button class="btn btn-dark" data-action="connect-folder">Connect a folder</button>' : ""}${writeError ? '<button class="btn btn-dark" data-action="retry-save">Retry save</button>' : ""}<button class="btn btn-quiet" data-action="export">Export current CSV</button></div>`,
    );
  }
  function help() {
    showDialog(
      "Guide & shortcuts",
      `<p><strong>Import.</strong> Import a CubeDesk-style CSV with <code>Index,Time,Scramble,Date</code>. Create your own categories; each gets a separate CSV.</p><p><strong>Timing.</strong> The timer is the home screen. Without inspection, hold space for 350ms, release when green, then press any key to stop. On touch screens, press and hold the timer. Turn inspection on in Settings: a normal press then starts inspection immediately, and you hold and release for 350ms to start the solve. At 15 seconds the result gets +2; at 17 the attempt is saved as a DNF on its own and the timer is ready for the next one.</p><p><strong>Solves.</strong> The list on the right holds every solve, newest first. Click one for its scramble, reconstruction and note, or use the button on the row to delete it. Move the pointer to the left edge for categories and the rest of the app.</p><p><strong>Cube.</strong> Drag to rotate. Click the cube to switch between the 3D view and the flat net. Open a solve to step through its moves or play the sequence. Start white-up, green-front.</p><p><strong>Scramble source.</strong> In local server mode, a background worker generates random cube states and solves them backward into verified scrambles. In standalone HTML mode, the timer uses 20 random moves and labels them accordingly. Neither mode is an official competition scramble source.</p><p><strong>Files.</strong> Open <code>Start CubeTracker.cmd</code> for automatic CSV saving beside the HTML. Opening the HTML directly uses browser storage; connect a folder or export to keep CSVs.</p><div class="help-grid"><span>Open timer</span><kbd>T</kbd><span>Next scramble (timer)</span><kbd>N</kbd><span>Hold, then release to start</span><kbd>Space</kbd><span>Instant start (timer focused)</span><kbd>Enter</kbd><span>Cancel an active attempt</span><kbd>Esc</kbd><span>This guide</span><kbd>?</kbd></div><p class="chart-note">Rolling averages retain DNFs. +2 counts toward time. Sub-target percentages count every attempt.</p>`,
    );
  }
  function loadDemo() {
    let seed = 714;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    const data = [],
      now = Date.now();
    for (let i = 0; i < 280; i++) {
      const ms =
        (Math.round(
          (19 -
            (i / 280) * 5 +
            (rand() - 0.5) * 7 +
            (rand() < 0.05 ? rand() * 8 : 0)) *
            100,
        ) /
          100) *
        1000;
      data.push({
        id: "demo-" + i,
        rawMs: Math.round(ms),
        penalty: rand() < 0.025 ? "DNF" : "",
        scramble: C.scramble(),
        date: new Date(now - (279 - i) * 1000 * 3600 * 11).toISOString(),
      });
    }
    demo = { id: "demo", name: "Demo practice", solves: data };
    render();
  }
  async function copyScramble() {
    const text = drawerId
      ? solves().find((s) => s.id === drawerId)?.scramble
      : currentScramble;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast("Scramble copied.");
    } catch {
      showDialog(
        "Copy scramble",
        `<textarea style="width:100%" rows="4" readonly>${esc(text)}</textarea>`,
      );
      $("textarea", $("#dialog")).select();
    }
  }
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("button,a.brand");
    if (!b || b.disabled) return;
    if (timerBusy() && !b.closest(".timer-surface")) return;
    if (b.matches("a.brand")) {
      e.preventDefault();
      navigate("overview");
      return;
    }
    if (b.dataset.view) {
      navigate(b.dataset.view);
      return;
    }
    if (b.dataset.category) {
      pref.active = b.dataset.category;
      demo = null;
      latestId = null;
      page = 1;
      savePref();
      render();
      return;
    }
    if (b.dataset.solve) {
      openSolve(b.dataset.solve);
      return;
    }
    if (b.hasAttribute("data-penalty")) {
      penalty(b.dataset.id, b.dataset.penalty);
      return;
    }
    if (b.dataset.delete) {
      deleteSolve(b.dataset.delete);
      return;
    }
    if (b.dataset.trend) {
      pref.trend = b.dataset.trend;
      savePref();
      render();
      return;
    }
    if (b.dataset.page) {
      page = +b.dataset.page;
      render();
      return;
    }
    if (b.hasAttribute("data-detail-nav")) {
      const s = solves()[+b.dataset.detailNav];
      if (s) openSolve(s.id);
      return;
    }
    if (b.dataset.cube) {
      const s = drawerScene || scene;
      if (!s) return;
      if (b.dataset.cube === "first") s.seek(0);
      else if (b.dataset.cube === "last") s.seek(s.moves.length);
      else if (b.dataset.cube === "play") s.play();
      else {
        s.playing = false;
        await s.step(b.dataset.cube === "next" ? 1 : -1);
      }
      return;
    }
    if (b.dataset.move) {
      (drawerScene || scene)?.seek(+b.dataset.move);
      return;
    }
    switch (b.dataset.action) {
      case "practice":
        navigate("timer");
        if (demo || !active()) openCategory();
        break;
      case "category":
        openCategory();
        break;
      case "import":
        $("#file-input").click();
        break;
      case "export":
        exportCurrent();
        break;
      case "manual":
        manual();
        break;
      case "new-scramble":
        newScramble();
        break;
      case "copy":
        copyScramble();
        break;
      case "close-dialog":
        closeDialog();
        break;
      case "help":
        help();
        break;
      case "manage":
        manage();
        break;
      case "storage":
        storage();
        break;
      case "connect-folder":
        await connectFolder();
        break;
      case "retry-save":
        await persist();
        if (!writeError) closeDialog();
        break;
      case "settings":
        settings();
        break;
      case "theme":
        pref.theme = resolvedTheme() === "dark" ? "light" : "dark";
        savePref();
        applyTheme();
        break;
      case "demo":
        loadDemo();
        break;
      case "exit-demo":
        demo = null;
        render();
        break;
      case "clear-filter":
        query = "";
        filter = "all";
        startDate = "";
        endDate = "";
        page = 1;
        render();
        break;
      case "recovery":
        showDialog(
          "Recover files",
          `<p>These files contain the unsaved copy from your previous session. Download each, then import into a new category to compare and recover.</p><div class="file-list">${recovery.categories.map((c, i) => `<div>${esc(c.name)} · ${c.solves.length} solves <button class="btn-link" data-recover="${i}">Download CSV</button></div>`).join("")}</div>`,
        );
        $$("[data-recover]").forEach(
          (b) =>
            (b.onclick = () => {
              const c = recovery.categories[+b.dataset.recover];
              download(c.name + "-recovered.csv", C.exportCSV(c.solves));
            }),
        );
        break;
    }
  });
  document.addEventListener("change", (e) => {
    const key = e.target.dataset.control;
    if (!key || timerBusy()) return;
    switch (key) {
      case "range":
        pref.range = e.target.value;
        break;
      case "category":
        if (e.target.value === "__new__") {
          render();
          openCategory();
          return;
        }
        pref.active = e.target.value;
        demo = null;
        latestId = null;
        break;
      case "target": {
        const v = +e.target.value;
        if (!Number.isFinite(v) || v <= 0 || v > 3600) {
          toast("Choose a target above 0 and up to 3,600 seconds.", true);
          e.target.value = pref.target;
          return;
        }
        pref.target = v;
        break;
      }
      case "window": {
        const v = +e.target.value;
        if (!Number.isInteger(v) || v < 5 || v > 10000) {
          toast("Choose a window from 5 to 10,000 solves.", true);
          e.target.value = pref.window;
          return;
        }
        pref.window = v;
        break;
      }
      case "inspection":
        pref.inspection = e.target.checked;
        break;
      case "cube-net":
        pref.cubeMode = e.target.checked ? "net" : "3d";
        break;
      case "sort":
        sort = e.target.value;
        page = 1;
        break;
      case "filter":
        filter = e.target.value;
        page = 1;
        break;
      case "start-date":
        startDate = e.target.value;
        page = 1;
        break;
      case "end-date":
        endDate = e.target.value;
        page = 1;
        break;
    }
    savePref();
    render();
  });
  document.addEventListener("input", (e) => {
    if (e.target.id !== "solve-search") return;
    query = e.target.value;
    page = 1;
    const pos = e.target.selectionStart;
    render();
    $("#solve-search").focus();
    try {
      $("#solve-search").setSelectionRange(pos, pos);
    } catch {}
  });
  async function init() {
    renderIcons();
    $("#main").innerHTML = '<div class="loading">Loading…</div>';
    let cached;
    try {
      cached = JSON.parse(localStorage.getItem(STORE) || "null");
      if (cached?.categories) state = cached;
    } catch {}
    if (location.protocol.startsWith("http")) {
      try {
        const res = await fetch("/api/library", {
          signal: AbortSignal.timeout(2500),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.version === 1 && Array.isArray(data.categories)) {
            server = true;
            if (cached?.dirty) {
              if (cached.revision === data.revision) {
                state = cached;
                persist();
              } else {
                recovery = cached;
                try {
                  localStorage.setItem(
                    STORE + ".recovery",
                    JSON.stringify(cached),
                  );
                } catch {}
                state = data;
              }
            } else if (
              cached?.categories?.length &&
              !data.categories.length &&
              data.revision === 0
            ) {
              recovery = cached;
              state = data;
            } else state = data;
          }
        }
      } catch {}
    }
    if (!recovery)
      try {
        recovery = JSON.parse(
          localStorage.getItem(STORE + ".recovery") || "null",
        );
      } catch {}
    if (!state.categories.some((c) => c.id === pref.active))
      pref.active = state.categories[0]?.id || null;
    const initial = location.hash.slice(1);
    if (["overview", "timer", "solves", "insights"].includes(initial))
      view = initial;
    savePref();
    startScrambler();
    render();
  }
  init();
})();
