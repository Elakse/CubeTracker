/* UI and local persistence. No build step; optional local WebGL renderer. */
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
    palette:
      "M12 3a9 9 0 0 0 0 18h1.2a2 2 0 0 0 0-4H12a2 2 0 0 1 0-4h1a8 8 0 0 0 0-16Zm-4 6h.01m4-2h.01m4 2h.01m2 4h.01",
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
  const CUBE_PALETTES = {
    classic: { label: "Classic", detail: "Familiar and balanced", colors: Object.fromEntries(Object.entries(C.FACES).map(([f, v]) => [f, v.color])) },
    vivid: { label: "Vivid", detail: "Bright competition colors", colors: { U: "#fafcff", R: "#eb3046", F: "#16bd6b", D: "#ffdb19", L: "#ff821c", B: "#2474ef" } },
  };
  // Graphics quality trades fidelity for frame time. Only the 3D models read
  // it; the standard preview is CSS and costs the same everywhere.
  const CUBE_QUALITY = {
    low: { label: "Low", detail: "No shadows, single-density canvas. For integrated graphics and phones." },
    balanced: { label: "Balanced", detail: "Shadows and the full studio environment. The default." },
    high: { label: "High", detail: "Adds handling wear, per-piece color and a separate cap for all 54." },
    ultra: { label: "Ultra", detail: "Adds contact occlusion, lens aberration and grain. Wants a discrete GPU." },
  };
  // Model definitions never own colors: every renderer consumes the same palette.
  const CUBE_MODELS = {
    standard: { label: "Standard", detail: "Simple, crisp faces" },
    tiles: { label: "Tiles", detail: "Raised tiles · polished black plastic" },
    stickers: { label: "Stickers", detail: "Thin stickers · satin black plastic" },
    speedcube: { label: "Speedcube", detail: "Sculpted, stickerless pieces" },
    uv: { label: "UV Speedcube", detail: "The same pieces under a cured UV coat" },
  };
  let pref = {
      target: 10,
      window: 1000,
      inspection: false,
      inspectionVoice: false,
      timerMeanRange: "all",
      trend: "ao12",
      range: 1000,
      insightsRange: "all",
      active: null,
      theme: "system",
      accent: "forest",
      cubeMode: "3d",
      cubePalette: "classic",
      cubeFinish: "standard",
      cubeQuality: "auto",
      scrambleAnimation: true,
      pressToStart: false,
      version: 2,
    },
    state = { categories: [], revision: 0 },
    view = "timer",
    server = false,
    saveChain = Promise.resolve(),
    dirty = false,
    writeError = false,
    cacheError = false,
    saveGeneration = 0,
    deferredSaveHandle = 0,
    panelIdleHandle = 0,
    recovery = null,
    demo = null,
    query = "",
    sort = "newest",
    filter = "all",
    startDate = "",
    endDate = "",
    scene = null,
    drawerScene = null,
    appearanceScene = null,
    drawerId = null,
    averageDrawer = null,
    latestId = null,
    panelObserver = null,
    libraryObserver = null,
    sceneIdleHandle = 0,
    panelCount = 0,
    libraryCount = 0,
    keepPanel = false;
  const PANEL_BATCH = 60;
  const LIBRARY_BATCH = 60;
  let currentScramble = C.scramble(),
    scrambleSource = "practice",
    scramblePending = false,
    scrambleWorker = null,
    scrambleQueue = [],
    scrambleRefreshing = false,
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
  let motion = null, recordCache = null, demoRaf = 0, demoEffect = "sub-10";
  function effects() {
    if (!motion && typeof CTEffects !== "undefined") motion = new CTEffects.Motion();
    return motion;
  }
  function recordProfile() {
    const data = solves();
    if (!recordCache || recordCache.data !== data || recordCache.length !== data.length)
      recordCache = { data, length: data.length, value: typeof CTEffects !== "undefined" ? CTEffects.profile(data) : null };
    return recordCache.value;
  }
  let storedPref = {};
  try {
    storedPref = JSON.parse(localStorage.getItem(PREF) || "{}") || {};
    pref = { ...pref, ...storedPref };
  } catch {}
  if (storedPref.version !== 2) {
    // Ranges and the consistency window moved to new defaults.
    pref.range = 1000;
    pref.insightsRange = "all";
    pref.target = 10;
    pref.window = 1000;
    pref.version = 2;
  }
  pref.window = Math.max(
    5,
    Math.min(10000, Math.round(Number(pref.window) || 1000)),
  );
  pref.target = Math.max(0.01, Math.min(3600, Number(pref.target) || 10));
  if (!["all", "10000", "5000", "1000", "500", "100", "50", "12", "5"].includes(String(pref.timerMeanRange)))
    pref.timerMeanRange = "all";
  if (!["system", "light", "dark", "contrast"].includes(pref.theme))
    pref.theme = "system";
  if (!["forest", "ocean", "violet", "ember"].includes(pref.accent))
    pref.accent = "forest";
  if (!Object.hasOwn(CUBE_PALETTES, pref.cubePalette)) pref.cubePalette = "classic";
  if (pref.cubeFinish === "realistic") pref.cubeFinish = "tiles";
  if (!Object.hasOwn(CUBE_MODELS, pref.cubeFinish)) pref.cubeFinish = "standard";
  // A first guess, not a verdict. Machines that advertise little get the safe
  // level, and nobody is opted into the expensive ones without choosing them.
  if (!Object.hasOwn(CUBE_QUALITY, pref.cubeQuality))
    pref.cubeQuality = matchMedia("(pointer: coarse)").matches || (navigator.hardwareConcurrency || 4) <= 4 ? "low" : "balanced";
  if (typeof pref.scrambleAnimation !== "boolean") pref.scrambleAnimation = true;
  const darkQuery = matchMedia("(prefers-color-scheme: dark)");
  function resolvedTheme() {
    return ["light", "dark", "contrast"].includes(pref.theme)
      ? pref.theme
      : darkQuery.matches
        ? "dark"
        : "light";
  }
  function applyTheme() {
    const theme = resolvedTheme(),
      dark = theme !== "light",
      root = document.documentElement;
    if (root) {
      root.dataset.theme = theme;
      root.dataset.accent = pref.accent;
    }
    if (typeof getComputedStyle === "function") {
      const palette = getComputedStyle(root);
      const mark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="12" fill="${palette.getPropertyValue("--solid").trim()}"/><path d="m20 8 11 6v12l-11 6-11-6V14zm0 12 11-6M20 20 9 14m11 6v12" fill="none" stroke="${palette.getPropertyValue("--solid-fg").trim()}" stroke-width="2"/></svg>`;
      $('link[rel="icon"]')?.setAttribute("href", `data:image/svg+xml,${encodeURIComponent(mark)}`);
    }
    $("#theme-color")?.setAttribute(
      "content",
      theme === "contrast" ? "#000000" : dark ? "#0c0f0d" : "#f5f6f2",
    );
    const btn = $("#theme-btn"),
      slot = btn && $("[data-icon]", btn),
      label = btn && $(".theme-label", btn);
    if (slot) slot.innerHTML = icon("palette");
    if (label) label.textContent = "Appearance";
    if (btn) btn.title = "Color theme and display mode";
    $$('[data-theme-choice]').forEach((choice) =>
      choice.classList.toggle("active", choice.dataset.themeChoice === pref.theme),
    );
    $$('[data-accent-choice]').forEach((choice) =>
      choice.classList.toggle("active", choice.dataset.accentChoice === pref.accent),
    );
  }
  darkQuery.addEventListener?.("change", () => {
    if (pref.theme === "system") applyTheme();
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
  function currentRange() {
    return view === "insights" ? pref.insightsRange : pref.range;
  }
  function rangeSolves() {
    const a = solves(),
      r = currentRange();
    return r === "all" ? a : a.slice(-Number(r));
  }
  function meanOf(data) {
    let sum = 0,
      valid = 0;
    for (const solve of data) {
      const value = C.value(solve);
      if (!Number.isFinite(value)) continue;
      sum += value;
      valid++;
    }
    return valid ? sum / valid : null;
  }
  function toast(message, error = false, action) {
    const div = document.createElement("div");
    div.className = "toast" + (error ? " error" : "");
    const span = document.createElement("span");
    span.textContent = message;
    div.append(span);
    const dismiss = () => {
      if (!div.isConnected || div.classList.contains("is-leaving")) return;
      div.classList.add("is-leaving");
      setTimeout(() => div.remove(), 280);
    };
    if (action) {
      const b = document.createElement("button");
      b.textContent = action.label;
      b.onclick = () => {
        action.run();
        dismiss();
      };
      div.append(b);
    }
    $("#toast-region").append(div);
    const timeout = setTimeout(dismiss, 3000);
    if (action) {
      const button = div.querySelector("button");
      button?.addEventListener("click", () => clearTimeout(timeout), { once: true });
    }
  }
  function clearToasts() {
    $$(".toast", $("#toast-region")).forEach((toastElement) => {
      toastElement.classList.add("is-leaving");
      setTimeout(() => toastElement.remove(), 280);
    });
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
  function cache(notify = true) {
    try {
      localStorage.setItem(STORE, JSON.stringify({ ...state, dirty }));
      cacheError = false;
      return true;
    } catch {
      if (notify && !cacheError)
        toast(
          "Browser backup is full or unavailable. Export your CSV to keep a copy.",
          true,
        );
      cacheError = true;
      return false;
    }
  }
  function persist(preserveRecordCache = false, defer = false) {
    if (!preserveRecordCache) recordCache = null;
    dirty = true;
    const generation = ++saveGeneration;
    // The local server is the durable copy. Large libraries routinely exceed
    // the browser's small storage quota, so only create the full browser copy
    // in standalone mode (or as a last-resort recovery after a server error).
    const cached = server ? true : cache();
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
    const enqueue = () => {
      deferredSaveHandle = 0;
      const snapshot = state.categories;
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
          try {
            localStorage.removeItem(STORE);
          } catch {}
          storageStatus();
        } catch (e) {
          writeError = true;
          dirty = true;
          cache(false);
          storageStatus();
          toast(e.message, true);
        }
      });
    };
    if (defer) {
      if (deferredSaveHandle) {
        if (typeof cancelIdleCallback === "function") cancelIdleCallback(deferredSaveHandle);
        else clearTimeout(deferredSaveHandle);
      }
      const schedule = () => enqueue();
      deferredSaveHandle = typeof requestIdleCallback === "function"
        ? requestIdleCallback(schedule, { timeout: 1200 })
        : setTimeout(schedule, 80);
      return Promise.resolve();
    }
    enqueue();
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
    const r = String(currentRange()),
      counts =
        view === "insights" ? [50, 100, 500, 1000, 10000] : [50, 100, 500, 1000];
    return `<select class="period-select" aria-label="Solve range" data-control="range"><option value="all" ${r === "all" ? "selected" : ""}>All solves</option>${counts.map((n) => `<option value="${n}" ${r === String(n) ? "selected" : ""}>Last ${n.toLocaleString()} solves</option>`).join("")}</select>`;
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
      status = recordProfile()?.sub,
      ao5 = bestAverage(solves(), 5),
      days = new Set(a.filter((x) => x.date).map((x) => localDay(dated(x))))
        .size;
    return `<div class="metric-grid">
${rankCard(status)}
<div class="metric"><div class="metric-label">Global ao5 PB ${icon("chart")}</div><div class="metric-value">${fmt(ao5)}${Number.isFinite(ao5) ? '<span class="unit">s</span>' : ""}</div><div class="metric-foot">All solves · trimmed average</div></div>
<div class="metric"><div class="metric-label">Session mean ${icon("target")}</div><div class="metric-value">${fmt(s.mean)}${Number.isFinite(s.mean) ? '<span class="unit">s</span>' : ""}</div><div class="metric-foot">${s.valid.toLocaleString()} completed · ${s.dnf} DNF</div></div>
<div class="metric"><div class="metric-label">Total solves ${icon("cube")}</div><div class="metric-value">${s.count.toLocaleString()}</div><div class="metric-foot"><strong>${days} day${days === 1 ? "" : "s"}</strong></div></div></div>`;
  }
  function rankCard(status) {
    const s = status ? { ...status } : { count: solves().length, ready: false, best: Infinity, tier: 0 };
    const title = s.threshold ? `${s.rusty ? "Rusty sub" : "Sub"} ${CTEffects.timeLabel(s.threshold)}` : s.ready ? "Building your title" : `${Math.min(s.count, 500)} / 500 solves`;
    if (!s.ready) s.best = null;
    return `<div class="metric rank-card${s.rusty ? " is-rusty" : ""}" data-tier="${s.tier}" style="--reward-power:${s.tier}"><div class="metric-label">${s.rusty ? "A little oxidation" : "Best 500 · lifetime"} ${icon("trophy")}</div><div class="rank-title">${title}</div><div class="metric-value">${fmt(s.best)}${Number.isFinite(s.best) ? '<span class="unit">s</span>' : ""}</div><div class="metric-foot">${s.ready ? `Current 500 · ${fmt(s.current)}${s.rusty ? " · Shake off the rust" : " · This category"}` : "Your title starts at 500 attempts"}</div></div>`;
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
    // The goal axis follows its own series. Pinned to 0-100 a consistency
    // line that sits between 95% and 100% is drawn on the top gridline and
    // reads as an empty chart.
    let min, max;
    if (kind === "goal") {
      const seen = line.filter((v) => v != null && Number.isFinite(v));
      if (!seen.length) {
        min = 0;
        max = 100;
      } else {
        const lo = seen.reduce((a, b) => Math.min(a, b), Infinity),
          hi = seen.reduce((a, b) => Math.max(a, b), -Infinity),
          span = Math.max(hi - lo, 1) * 1.6,
          step = [1, 2, 5, 10, 20, 25, 50].find((s) => s * ticks >= span) || 50;
        min = Math.max(
          0,
          Math.min(Math.floor(lo / step) * step, 100 - step * ticks),
        );
        max = min + step * ticks;
        if (max > 100) {
          max = 100;
          min = Math.max(0, 100 - step * ticks);
        }
      }
    } else {
      min = Math.max(
        0,
        Math.floor(vals.reduce((a, b) => Math.min(a, b), Infinity) - 1),
      );
      max = Math.ceil(vals.reduce((a, b) => Math.max(a, b), -Infinity) + 1);
    }
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
    const plotted = (d.match(/[ML]/g) || []).length;
    if (kind === "goal" && plotted < 2)
      return `<div class="empty-chart">${icon("chart")}<strong>Not enough solves to plot</strong><span>A ${n}-solve window needs more than ${n} solves in this range.</span></div>`;
    if (d) {
      if (kind === "goal" && line.length >= n) {
        const first = n - 1;
        svg += `<path d="${d}L${x(data.length - 1)},${h - b}L${x(first)},${h - b}Z" style="fill:var(--chart-fill)" opacity=".5"/>`;
      }
      svg += `<path d="${d}" fill="none" style="stroke:var(${kind === "goal" ? "--chart-goal" : "--chart-line"})" stroke-width="${kind === "goal" ? 2 : 2.2}" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;
      if (kind === "goal") {
        // Least-squares line across the whole window series.
        let count = 0,
          sx = 0,
          sy = 0,
          sxx = 0,
          sxy = 0,
          first = -1;
        for (let i = 0; i < line.length; i++) {
          const v = line[i];
          if (v == null || !Number.isFinite(v)) continue;
          if (first < 0) first = i;
          count++;
          sx += i;
          sy += v;
          sxx += i * i;
          sxy += i * v;
        }
        const denom = count * sxx - sx * sx;
        if (count > 2 && denom) {
          const slope = (count * sxy - sx * sy) / denom,
            intercept = (sy - slope * sx) / count,
            last = line.length - 1,
            at = (i) =>
              Math.max(min, Math.min(max, intercept + slope * i));
          svg += `<path d="M${x(first).toFixed(2)},${y(at(first)).toFixed(2)}L${x(last).toFixed(2)},${y(at(last)).toFixed(2)}" fill="none" style="stroke:var(--chart-trend)" stroke-width="1.7" stroke-dasharray="6 5" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`;
        }
      }
    }
    for (let i = 0; i <= ticks; i++) {
      const idx = Math.round((i / ticks) * (data.length - 1));
      svg += `<text x="${x(idx)}" y="${h - 5}" text-anchor="${i === 0 ? "start" : i === ticks ? "end" : "middle"}">${sameDay || shortDate(data[idx]) === "Unknown date" ? "#" + (idx + 1) : shortDate(data[idx])}</text>`;
    }
    svg += `<rect class="chart-hit" data-chart="${kind}" data-count="${data.length}" x="${l}" y="${t}" width="${w - l - r}" height="${h - t - b}" fill="transparent"/></svg>`;
    if (plotted < 2 && kind !== "pb")
      svg += `<p class="chart-note">${data.length < n ? `${n - data.length} more solves for a complete ${n}-solve window.` : `A ${n}-solve window needs more than ${n} solves in this range.`}</p>`;
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
    return `<section class="panel panel-pad ${wide ? "wide" : ""}"><div class="panel-heading"><h2>Consistency</h2><span class="chip green">SUB-${esc(pref.target)}</span></div><div class="goal-topline"><div class="goal-number">${sample.length ? pct.toFixed(1) : "—"}<span>%</span></div><div class="goal-explainer"><strong>${hits} of ${sample.length} solves</strong> under ${esc(pref.target)}s<br>${delta != null ? `${delta >= 0 ? "+" : ""}${delta.toFixed(1)} percentage points vs. previous window` : sample.length < pref.window ? `Building your ${pref.window}-solve window` : `Your latest ${pref.window} solves`}</div></div><div class="goal-progress"><div style="width:${pct}%"></div></div><div class="goal-controls"><label>Under <input type="number" min="0.01" max="3600" step="0.5" value="${esc(pref.target)}" data-control="target" aria-label="Target in seconds"> seconds</label><label>Last <input type="number" min="5" max="10000" step="1" value="${esc(pref.window)}" data-control="window" aria-label="Rolling window size"> solves</label></div>${chart(data, "goal", wide ? 230 : 98)}<p class="chart-note">Strictly under the target. +2 included, DNF counts as a miss. The dashed line is the linear trend.</p></section>`;
  }
  function cubePanel() {
    const label = scramblePending
      ? "PREPARING…"
      : scrambleSource === "practice"
        ? "PRACTICE SCRAMBLE"
        : "";
    return `<section class="panel cube-panel"><div class="panel-heading"><div><h2>Scramble</h2>${label ? `<p>${label}</p>` : ""}</div></div><div id="cube-mount"></div><div class="cube-bottom"><p class="scramble-mini" data-copyable>${esc(currentScramble)}</p><button class="btn btn-dark" data-action="practice">${icon("play")}Timer ${icon("arrow")}</button></div></section>`;
  }
  function activity(data) {
    const dayCounts = new Map();
    for (const s of data)
      if (s.date && Number.isFinite(dated(s).getTime())) {
        const k = localDay(dated(s));
        dayCounts.set(k, (dayCounts.get(k) || 0) + 1);
      }
    const last = new Date();
    last.setHours(12, 0, 0, 0);
    const countMonths = innerWidth < 600 ? 3 : innerWidth < 1050 ? 4 : 6;
    const first = new Date(last.getFullYear(), last.getMonth() - countMonths + 1, 1, 12);
    let max = 1, activeDays = 0, total = 0;
    for (let d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) {
      const n = dayCounts.get(localDay(d)) || 0;
      max = Math.max(max, n); total += n; if (n) activeDays++;
    }
    let months = "";
    for (let m = 0; m < countMonths; m++) {
      const start = new Date(first.getFullYear(), first.getMonth() + m, 1, 12);
      const offset = (start.getDay() + 6) % 7;
      const days = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
      let cells = "";
      for (let i = 0; i < 42; i++) {
        const day = i - offset + 1;
        if (day < 1 || day > days) { cells += '<span class="calendar-blank"></span>'; continue; }
        const date = new Date(start.getFullYear(), start.getMonth(), day, 12), n = dayCounts.get(localDay(date)) || 0;
        const future = date > last, today = localDay(date) === localDay(last);
        const label = `${date.toLocaleDateString("en", { month: "long", day: "numeric", year: "numeric" })} · ${future ? "Upcoming" : `${n.toLocaleString()} solves`}`;
        cells += `<button class="calendar-day heat-cell${future ? " future" : ""}${today ? " today" : ""}" data-level="${n && !future ? Math.max(1, Math.ceil(Math.sqrt(n / max) * 4)) : 0}" ${future ? "disabled" : ""} aria-label="${label}" data-day-info="${label}" ${today ? 'aria-current="date"' : ""}><span>${day}</span></button>`;
      }
      months += `<div class="activity-month"><h3>${start.toLocaleDateString("en", { month: "short" })}<span>${start.getFullYear()}</span></h3><div class="calendar-weekdays" aria-hidden="true">${["M", "T", "W", "T", "F", "S", "S"].map(x => `<span>${x}</span>`).join("")}</div><div class="month-grid">${cells}</div></div>`;
    }
    return `<section class="panel panel-pad activity-panel"><div class="panel-heading"><div><h2>Activity</h2><p>${activeDays} active days · ${total.toLocaleString()} solves · ${countMonths} months</p></div><div class="heat-legend"><span>Less</span>${[0,1,2,3,4].map(x => `<i class="heat-cell" data-level="${x}"></i>`).join("")}<span>More</span></div></div><div class="activity-months" style="--months:${countMonths}">${months}</div><div class="activity-day-info" aria-live="polite">Select a day to see its activity <span>Today is outlined</span></div></section>`;
  }
  function overview() {
    const a = rangeSolves();
    return (
      heading(
        "Overview",
        `${solves().length ? "" : '<button class="btn btn-quiet" data-action="demo">Load demo data</button>'}${rangeSelect()}`,
      ) +
      metrics(a) +
      `<div class="main-grid"><section class="panel panel-pad"><div class="panel-heading"><h2>Solve times</h2><div class="segmented">${["ao5", "ao12", "ao100"].map((x) => `<button class="${pref.trend === x ? "active" : ""}" data-trend="${x}">${x}</button>`).join("")}</div></div><div id="trend-body"><div class="legend"><span><i></i>${pref.trend}</span><span><i class="single"></i>Individual solves</span></div>${chart(a)}</div><div class="chart-caption"><span>${a.length ? `${a.length.toLocaleString()} solves · chronological order` : "No solves yet"}</span><button class="btn-link" data-view="insights">Explore ${icon("arrow-up-right")}</button></div></section>${cubePanel()}</div>${activity(solves())}`
    );
  }
  function panelStats() {
    const data = solves(),
      profile = recordProfile(),
      range = pref.timerMeanRange,
      best = Number.isFinite(profile?.best) ? profile.best : null,
      mean = range === "all" ? (profile?.valid ? profile.sum / profile.valid : null) : meanOf(data.slice(-Number(range))),
      ao5 = C.average(data, 5),
      ao12 = C.average(data, 12),
      ao5PB = Number.isFinite(profile?.averages?.[5]) ? profile.averages[5] : null,
      ao12PB = Number.isFinite(profile?.averages?.[12]) ? profile.averages[12] : null;
    return `<div class="panel-stats">${[
      ["best", fmt(best), "All-time single", best != null],
      ["mean", fmt(mean), range === "all" ? "Global · change" : `Last ${Number(range).toLocaleString()} · change`, true],
      ["ao5", fmt(ao5), `PB · ${fmt(ao5PB)}`, data.length >= 5],
      ["ao12", fmt(ao12), `PB · ${fmt(ao12PB)}`, data.length >= 12],
    ]
      .map(([k, v, hint, enabled]) => `<button class="stat-button" data-stat="${k}" ${enabled ? "" : "disabled"} aria-label="${k}: ${v}. ${hint}"><span>${k}${icon("arrow-up-right")}</span><strong>${v}</strong><small>${hint}</small></button>`)
      .join("")}</div>`;
  }
  function solveRow(s, n) {
    const t = `${fmt(C.value(s))}${s.penalty === "+2" ? "+" : ""}`;
    return `<div class="solve-entry"><button class="solve-entry-open" data-solve="${esc(s.id)}" aria-label="Solve ${n}: ${t}"><span class="solve-entry-time">${t}</span><span class="solve-entry-num">#${n}</span></button><button class="solve-entry-del" data-delete="${esc(s.id)}" tabindex="-1" aria-label="Delete solve ${n}">${icon("trash")}</button></div>`;
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
    return `<div class="focus-stage timer-card" data-state="${timer.phase}"><div class="focus-main"><div class="focus-row"><div id="cube-mount" class="focus-cube"></div><div class="focus-time"><div class="focus-scramble-wrap"><p class="focus-scramble" data-copyable>${esc(scramblePending ? "Preparing scramble…" : currentScramble)}</p><button class="icon-btn focus-scramble-refresh" data-action="new-scramble" title="New scramble" aria-label="New scramble">${icon("reset")}</button></div><button class="timer-surface" id="timer-surface" aria-label="Timer. ${pref.pressToStart ? (pref.inspection ? "Press to start inspection, press again to start the solve." : "Press to start, press again to stop.") : pref.inspection ? "Press to start inspection, then hold and release to start the solve." : "Hold space or press and hold here, then release to start."}"><span class="timer-state sr-only" id="timer-state" role="status">${last ? "SAVED" : "READY"}</span><span class="timer-digits" id="timer-digits">${last ? fmt(C.value(last)) : "0.00"}</span></button><div class="timer-result" id="timer-result">${last ? resultControls(last) : ""}</div></div></div></div><aside class="solve-panel">${panelStats()}<div class="solve-list" id="solve-list">${total ? solveRows(0, panelCount) : '<p class="solve-empty">No solves yet</p>'}<div class="solve-sentinel" id="solve-sentinel"${panelCount >= total ? " hidden" : ""}></div></div></aside></div>`;
  }
  function cancelSceneRefresh() {
    if (!sceneIdleHandle) return;
    if (typeof cancelIdleCallback === "function") cancelIdleCallback(sceneIdleHandle);
    else clearTimeout(sceneIdleHandle);
    sceneIdleHandle = 0;
  }
  function cancelPanelRefresh() {
    if (!panelIdleHandle) return;
    if (typeof cancelIdleCallback === "function") cancelIdleCallback(panelIdleHandle);
    else clearTimeout(panelIdleHandle);
    panelIdleHandle = 0;
  }
  function scheduleSceneRefresh() {
    cancelSceneRefresh();
    const refresh = () => {
      sceneIdleHandle = 0;
      if (view !== "timer" || timerBusy() || scramblePending || !$("#cube-mount")) return;
      scene?.destroy();
      scene = new CubeScene($("#cube-mount"), currentScramble);
      if (pref.cubeMode === "net") scene.setMode("net");
    };
    if (typeof requestIdleCallback === "function") sceneIdleHandle = requestIdleCallback(refresh, { timeout: 900 });
    else sceneIdleHandle = setTimeout(refresh, 80);
  }
  function schedulePanelRefresh() {
    cancelPanelRefresh();
    const refreshPanel = () => {
      panelIdleHandle = 0;
      if (view !== "timer") return;
      if (typeof document.createRange !== "function") return;
      $(".panel-stats")?.replaceWith(document.createRange().createContextualFragment(panelStats()));
      const list = $("#solve-list");
      if (list) {
        const total = solves().length;
        panelCount = Math.max(PANEL_BATCH, Math.min(panelCount, total));
        const entries = $$(".solve-entry", list);
        if (!entries.length) {
          list.innerHTML = `${total ? solveRows(0, panelCount) : '<p class="solve-empty">No solves yet</p>'}<div class="solve-sentinel" id="solve-sentinel"${panelCount >= total ? " hidden" : ""}></div>`;
          bindSolvePanel();
        } else {
          const current = solves();
          list.insertAdjacentHTML("afterbegin", solveRow(current.at(-1), total));
          const updated = $$(".solve-entry", list);
          if (updated.length > panelCount) updated.at(-1).remove();
          $$(".solve-entry", list).forEach((entry, index) => {
            entry.querySelector(".solve-entry-num").textContent = `#${total - index}`;
          });
          $("#solve-sentinel").hidden = panelCount >= total;
        }
      }
      scheduleSceneRefresh();
    };
    panelIdleHandle = typeof requestIdleCallback === "function"
      ? requestIdleCallback(refreshPanel, { timeout: 700 })
      : setTimeout(refreshPanel, 60);
  }
  function refreshTimerAfterRecord(last) {
    const card = $(".timer-card");
    if (!card) {
      render();
      return;
    }
    $("#timer-digits").textContent = fmt(C.value(last));
    $("#timer-result").innerHTML = resultControls(last);
    $$(".focus-scramble, .scramble-mini").forEach((element) => {
      element.textContent = scramblePending ? "Preparing scramble…" : currentScramble;
    });
    schedulePanelRefresh();
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
  function tableRowsHTML(data, full = true) {
    return data
      .map((s) => {
        const idx = solves().indexOf(s);
        return `<tr data-solve="${esc(s.id)}" tabindex="0" aria-label="Open solve ${idx + 1}"><td>#${idx + 1}</td><td class="time-cell">${fmt(C.value(s))}${s.penalty === "+2" ? "<small>+</small>" : ""}</td><td>${full ? fmt(C.average(solves().slice(Math.max(0, idx - 4), idx + 1), 5)) : s.penalty || "OK"}</td><td class="scramble-cell" data-copyable title="${esc(s.scramble)}">${esc(s.scramble || "No scramble recorded")}</td><td>${esc(longDate(s))}</td></tr>`;
      })
      .join("");
  }
  function tableHTML(data, full = true) {
    if (!data.length)
      return empty("No solves yet", "Recorded solves appear here.");
    return `<div class="table-scroll"><table><thead><tr><th>Solve</th><th>Time</th><th>${full ? "ao5" : "Status"}</th><th>Scramble</th><th>Recorded</th></tr></thead><tbody>${tableRowsHTML(data, full)}</tbody></table></div>`;
  }
  function library() {
    const a = filtered(),
      s = C.stats(solves());
    libraryCount = Math.max(LIBRARY_BATCH, Math.min(libraryCount, a.length));
    const shown = Math.min(libraryCount, a.length);
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
        )}</select></div></div><div class="table-tools" style="padding-top:12px;padding-bottom:12px"><div class="chart-range"><label>From <input type="date" data-control="start-date" value="${esc(startDate)}"></label><label>To <input type="date" data-control="end-date" value="${esc(endDate)}"></label></div><button class="btn-link" data-action="clear-filter">Reset filters</button></div><div id="library-results">${a.length ? tableHTML(a.slice(0, shown)) : solves().length ? '<div class="empty-state"><strong>No matching solves</strong>Try a different search, or reset the filters.</div>' : empty()}<div class="library-progress"><span id="library-count">${a.length ? `Showing ${shown.toLocaleString()} of ${a.length.toLocaleString()} solves` : "0 solves"}</span><div class="library-sentinel" id="library-sentinel"${shown >= a.length ? " hidden" : ""} aria-hidden="true"></div></div></div></section><p class="range-note">Export uses the current filters, in chronological order.</p>`
    );
  }
  function bindLibrary() {
    const sentinel = $("#library-sentinel"), tbody = $("#library-results tbody");
    if (!sentinel || !tbody || typeof IntersectionObserver === "undefined" || libraryCount >= filtered().length)
      return;
    const grow = () => {
      const data = filtered(), total = data.length;
      if (libraryCount < total) {
        const next = Math.min(total, libraryCount + LIBRARY_BATCH);
        tbody.insertAdjacentHTML("beforeend", tableRowsHTML(data.slice(libraryCount, next)));
        libraryCount = next;
        $("#library-count").textContent = `Showing ${libraryCount.toLocaleString()} of ${total.toLocaleString()} solves`;
      }
      if (libraryCount >= total) {
        sentinel.hidden = true;
        libraryObserver?.disconnect();
        libraryObserver = null;
      } else {
        libraryObserver.unobserve(sentinel);
        libraryObserver.observe(sentinel);
      }
    };
    libraryObserver = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) grow();
      },
      { rootMargin: "700px 0px" },
    );
    libraryObserver.observe(sentinel);
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
      groups = Array.from({ length: 7 }, () => []);
    for (const solve of a)
      if (solve.date) groups[(dated(solve).getDay() + 6) % 7].push(solve);
    const top = Math.max(1, ...groups.map((g) => g.length));
    return (
      heading("Insights", rangeSelect()) +
      `<div class="insights-grid">${goalPanel(a, true)}<section class="panel panel-pad"><div class="panel-heading"><div><h2>Distribution</h2><p>Completed solves only</p></div><span class="chip">${s.valid} solves</span></div>${histogram(a)}<div class="insight-facts"><div><span>Median</span><strong>${fmt(s.median)}</strong></div><div><span>Std. deviation</span><strong>${fmt(s.sd)}</strong></div><div><span>Completion</span><strong>${a.length ? ((s.valid / a.length) * 100).toFixed(1) + "%" : "—"}</strong></div></div></section><section class="panel panel-pad"><div class="panel-heading"><div><h2>Personal best over time</h2></div>${icon("trophy")}</div>${chart(a, "pb", 220)}<div class="chart-caption"><span>Best single</span><strong>${fmt(s.best)}${s.best != null ? " seconds" : ""}</strong></div></section><section class="panel panel-pad"><div class="panel-heading"><div><h2>Solves by weekday</h2></div>${icon("calendar")}</div><div class="bar-list">${groups.map((g, i) => `<div class="bar-row"><span>${["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][i]}</span><div class="bar-track"><div style="width:${(g.length / top) * 100}%"></div></div><strong>${g.length}</strong></div>`).join("")}</div><p class="chart-note">Local dates. Solves without a date are excluded.</p></section><section class="panel panel-pad"><div class="panel-heading"><div><h2>Best averages</h2></div>${icon("target")}</div><table style="margin-top:17px"><thead><tr><th style="padding-left:0">Window</th><th>Current</th><th>Best in range</th></tr></thead><tbody>${[5, 12, 100].map((n) => `<tr><td style="padding-left:0">ao${n}</td><td class="time-cell">${fmt(C.average(a, n))}</td><td class="time-cell">${fmt(bestAverage(a, n))}</td></tr>`).join("")}</tbody></table><div class="quality-note">Averages trim the fastest and slowest 5%, rounded up. DNFs stay in the window.</div></section></div>${activity(solves(), 26)}`
    );
  }
  function render(preserveEffects = false) {
    cancelSceneRefresh();
    cancelPanelRefresh();
    if (!preserveEffects) cancelAnimationFrame(demoRaf);
    if (!timerBusy() && !preserveEffects) motion?.clear();
    scene?.destroy();
    scene = null;
    panelObserver?.disconnect();
    panelObserver = null;
    libraryObserver?.disconnect();
    libraryObserver = null;
    $("#chart-tooltip").hidden = true;
    const focused = view === "timer" || view === "effects",
      scroll = keepPanel ? $("#solve-list")?.scrollTop || 0 : 0;
    if (!keepPanel) panelCount = PANEL_BATCH;
    keepPanel = false;
    $("#main").innerHTML = focused
      ? view === "effects" ? effectsDemoPage() : focusPage()
      : banners() +
        `<div class="page-enter">${view === "overview" ? overview() : view === "solves" ? library() : insights()}</div>`;
    document.body.classList.toggle("focus-mode", focused);
    document.body.classList.toggle("timer-view", focused);
    document.body.classList.toggle("overview-view", view === "overview");
    renderSidebar();
    renderIcons();
    if ($("#cube-mount")) {
      scene = new CubeScene($("#cube-mount"), currentScramble);
      scene.onChange = updateNotation;
      if (pref.cubeMode === "net") scene.setMode("net");
      updateNotation();
    }
    revealScramble();
    if (view === "effects") $("#demo-effect").value = demoEffect;
    bindCharts();
    if (focused && view !== "effects") {
      recordProfile();
      bindSolvePanel();
      if ($("#solve-list")) $("#solve-list").scrollTop = scroll;
      bindTimerSurface();
      requestAnimationFrame(() => {
        if (view === "timer" && !$("#dialog").open)
          $("#timer-surface")?.focus({ preventScroll: true });
      });
    } else if (view === "solves") bindLibrary();
  }
  function navigate(next) {
    if (timerBusy()) return;
    motion?.clear();
    view = next;
    history.replaceState(null, "", "#" + view);
    render();
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function revealScramble() {
    if (scramblePending) return;
    $$(".focus-scramble, .scramble-mini").forEach(el => {
      const text = el.textContent;
      el.setAttribute("aria-label", text);
      el.innerHTML = text.split(/\s+/).filter(Boolean).map((move, i) => `<span class="scramble-reveal" aria-hidden="true" style="--move-delay:${Math.min(i * 27, 900)}ms">${esc(move)}</span>`).join(" ");
    });
  }

  function effectsDemoPage() {
    return `<div class="focus-stage timer-card effects-demo"><div class="focus-main"><div class="demo-heading"><span class="chip">ANIMATION STUDIO</span><span>Preview only · no solves saved</span><button class="btn btn-quiet" data-action="exit-effects">Back to timer ${icon("arrow")}</button></div><div class="focus-row"><div id="cube-mount" class="focus-cube"></div><div class="focus-time"><div class="focus-scramble-wrap"><p class="focus-scramble" data-copyable>${esc(scramblePending ? "Preparing scramble…" : currentScramble)}</p></div><div class="timer-surface"><span class="timer-digits" id="timer-digits">9.98</span></div><p class="demo-caption">Same stage. Same effects. Try every level.</p></div></div></div><aside class="solve-panel demo-controls"><h2>The reward room</h2><p>From a hundredth shaved off to a barrier you thought was impossible.</p><label class="field">Choose a moment<select id="demo-effect" data-control="demo-effect"><optgroup label="Personal bests"><option value="pb-small">A small single PB</option><option value="pb-big">A huge single PB</option><option value="pb-stack">Four records at once</option></optgroup><optgroup label="Everyday progress"><option value="regular">An ordinary half-second drop</option><option value="rise">An interval rise</option></optgroup><optgroup label="Title unlocked">${CTEffects.SPECIAL.map(n => `<option value="sub-${n}" ${demoEffect === `sub-${n}` ? "selected" : ""}>Sub ${CTEffects.timeLabel(n)} · level ${CTEffects.tier(n)}</option>`).join("")}</optgroup><optgroup label="Rust & recovery">${CTEffects.SPECIAL.map(n => `<option value="rust-${n}">Rusty sub ${CTEffects.timeLabel(n)}</option>`).join("")}<option value="recovery">Shake off the rust</option></optgroup><optgroup label="Timer motion"><option value="inspection">Inspection: final seconds</option><option value="entrance">Scramble & cube entrance</option></optgroup></select></label><button class="btn btn-dark" data-action="play-effect">${icon("play")}Play effect</button><div id="demo-rank">${rankCard({ ready: true, count: 500, best: 9.98, current: 9.98, threshold: 10, tier: 7, rusty: false })}</div><p class="chart-note">The frame below the controls is the one you'll earn in Overview. Reduced motion follows your device setting.</p></aside></div>`;
  }
  function playDemoEffect() {
    if (view !== "effects") return;
    cancelAnimationFrame(demoRaf);
    demoEffect = $("#demo-effect").value;
    const n = Number(demoEffect.split("-")[1]) || 10;
    const status = { ready: true, count: 1500, best: n - .02, current: n - .02, threshold: n, tier: CTEffects.tier(n), rusty: demoEffect.startsWith("rust-") };
    if (status.rusty) status.current = n + CTEffects.interval(n - 1e-7) + .15;
    $("#demo-rank").innerHTML = rankCard(status);
    $("#timer-digits").textContent = fmt(status.current);
    if (demoEffect === "entrance") {
      motion?.clear();
      scene?.destroy(); scene = new CubeScene($("#cube-mount"), currentScramble);
      if (pref.cubeMode === "net") scene.setMode("net");
      revealScramble(); return;
    }
    if (demoEffect === "inspection") {
      const since = performance.now() - 10000;
      effects().start("inspection", { since, voice: pref.inspectionVoice });
      const tick = () => {
        if (view !== "effects") return;
        const elapsed = (performance.now() - since) / 1000;
        $("#timer-digits").textContent = elapsed >= 17 ? "DNF" : elapsed >= 15 ? "+2" : String(Math.ceil(15 - elapsed));
        if (elapsed < 17) demoRaf = requestAnimationFrame(tick);
        else { effects().start("expiry"); effects().announce("Inspection expired", ["Preview complete · no solve saved"]); }
      };
      tick(); return;
    }
    const event = { records: [], status };
    if (demoEffect.startsWith("sub-")) event.special = n;
    else if (status.rusty) event.rusty = true;
    else if (demoEffect === "recovery") event.recovered = true;
    else if (demoEffect === "regular" || demoEffect === "rise") { event.barrier = 12.5; event.direction = demoEffect === "rise" ? "up" : "down"; status.current = event.direction === "up" ? 12.51 : 12.49; }
    else {
      event.records = [{ label: "Single PB", value: demoEffect === "pb-small" ? 10.99 : 8.42, improvement: demoEffect === "pb-small" ? .01 : 2.58 }];
      if (demoEffect === "pb-stack") event.records.push(...[5, 12, 100].map(n => ({ label: `ao${n} PB`, value: 10 + n / 100, improvement: .23 })));
    }
    $("#timer-digits").textContent = fmt(event.records[0]?.value ?? status.current);
    effects().celebrate(event);
  }

  // True sticker coordinates drive both the 3D scene and the unfolded net.
  class CubeScene {
    constructor(mount, alg) {
      this.mount = mount;
      this.alg = alg;
      this.entrance = mount.classList.contains("focus-cube") &&
        (view === "effects" || (view === "timer" && pref.scrambleAnimation));
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
        if (!this.entrance) {
          this.cube.apply(alg);
          this.index = this.moves.length;
        }
      } catch (e) {
        mount.innerHTML = `<div class="empty-state"><strong>Scramble unavailable</strong>${esc(e.message)}</div>`;
        this.invalid = true;
        return;
      }
      mount.innerHTML = `<div class="cube-stage" data-mode="3d" tabindex="0" role="img" aria-label="3 by 3 cube, white up and green front. Drag or use arrow keys to rotate, click to switch to the flat net, Home to reset."><div class="cube-world"></div></div>`;
      this.stage = $(".cube-stage", mount);
      if (!mount.classList.contains("focus-cube") || this.entrance)
        this.stage.classList.add("cube-materialize");
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
      this.setAppearance();
      if (this.entrance) this.startEntrance();
    }
    startEntrance() {
      const delay = reduced ? 0 : 60;
      this.entranceTimer = setTimeout(() => {
        this.entranceTimer = 0;
        if (!this.disposed) this.play();
      }, delay);
    }
    async setAppearance() {
      if (this.invalid || this.disposed) return;
      const request = this.appearanceRequest = (this.appearanceRequest || 0) + 1;
      const colors = CUBE_PALETTES[pref.cubePalette].colors;
      this.elements.forEach((el, i) => { el.style.background = colors[this.cube.stickers[i].face]; });
      if (this.mode === "net") this.drawNet();
      this.stage.setAttribute("aria-label", "3 by 3 cube. Drag or use arrow keys to rotate, click to switch to the flat net, Home to reset.");
      if (pref.cubeFinish === "standard") {
        this.realistic?.destroy();
        this.realistic = null;
        this.stage.classList.remove("cube-realistic");
        this.draw();
        return;
      }
      let phase = "load";
      try {
        const { RealisticCube } = await import("./cube-realistic.js");
        phase = "render";
        if (this.disposed || request !== this.appearanceRequest) return;
        // Quality is baked into the renderer's targets, materials and geometry,
        // so a change rebuilds the cube exactly as a model change does.
        if (this.realistic && (this.realistic.model !== pref.cubeFinish || this.realistic.quality !== pref.cubeQuality)) {
          this.realistic.destroy();
          this.realistic = null;
        }
        if (!this.realistic) this.realistic = new RealisticCube(this.stage, () => this.fallbackAppearance(), pref.cubeFinish, pref.cubeQuality);
        this.realistic.setPalette(CUBE_PALETTES[pref.cubePalette].colors);
        this.stage.classList.add("cube-realistic");
        this.draw();
        this.orbit();
      } catch (error) {
        if (!this.disposed && request === this.appearanceRequest) {
          console.warn(`CubeTracker 3D ${phase} failed:`, error);
          this.fallbackAppearance(phase);
        }
      }
    }
    fallbackAppearance(reason = "render") {
      this.realistic?.destroy();
      this.realistic = null;
      this.stage.classList.remove("cube-realistic");
      this.draw();
      const status = $("#cube-finish-status");
      if (status) status.textContent = reason === "load"
        ? "The cube could not load. Reload the app; if this continues, restart CubeTracker."
        : "Realistic rendering is unavailable on this device. Showing the standard preview.";
    }
    draw(spec = null, fraction = 0) {
      if (this.invalid || this.disposed) return;
      if (this.mode === "net") {
        this.drawNet();
        return;
      }
      if (this.realistic) {
        this.realistic.draw(this.cube.stickers, spec, fraction);
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
      this.realistic?.orbit(this.pitch, this.yaw, this.zoom);
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
            `<div class="net-face" style="grid-column:${col};grid-row:${row}" title="${face} face">${f[face].map((c) => `<span style="background:${CUBE_PALETTES[pref.cubePalette].colors[c]}"></span>`).join("")}</div>`,
        )
        .join("");
    }
    setMode(mode) {
      if (this.invalid) return;
      this.mode = mode;
      this.stage.dataset.mode = mode;
      this.world.style.display = mode === "net" ? "none" : "";
      if (mode === "net") this.drawNet();
      else {
        $(".cube-net", this.stage)?.remove();
        this.draw();
      }
    }
    // A pointer drag focuses the stage (it is keyboard-reachable), which then
    // draws a focus ring the moment the next key arrives. Hand focus back.
    releaseFocus() {
      if (view !== "timer" || $("#dialog").open) return;
      if (!this.stage.contains(document.activeElement)) return;
      requestAnimationFrame(() =>
        $("#timer-surface")?.focus({ preventScroll: true }),
      );
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
        this.releaseFocus();
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
        this.releaseFocus();
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
        duration = reduced ? 0 : 72;
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
        if (!this.disposed && !reduced) await new Promise((r) => setTimeout(r, 8));
      }
      this.playing = false;
      this.onChange?.();
    }
    destroy() {
      this.disposed = true;
      this.carouselObserver?.disconnect();
      this.playing = false;
      clearTimeout(this.entranceTimer);
      cancelAnimationFrame(this.anim);
      cancelAnimationFrame(this.inertia);
      this.finishAnimation?.();
      this.realistic?.destroy();
      this.realistic = null;
    }
    exit() {
      if (this.invalid || this.disposed || !this.stage) return Promise.resolve();
      this.disposed = true;
      this.playing = false;
      clearTimeout(this.entranceTimer);
      cancelAnimationFrame(this.anim);
      cancelAnimationFrame(this.inertia);
      this.finishAnimation?.();
      this.realistic?.destroy();
      this.realistic = null;
      this.stage.classList.add("cube-death");
      if (reduced) return Promise.resolve();
      return new Promise((resolve) => {
        let done = false;
        const finish = (event) => {
          if (event && event.animationName !== "cube-death") return;
          if (done) return;
          done = true;
          resolve();
        };
        this.stage.addEventListener("animationend", finish, { once: true });
        setTimeout(finish, 180);
      });
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
  function bindCharts(root = document) {
    const data = rangeSolves();
    $$("[data-chart]", root).forEach((hit) => {
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
    const previous = timer.phase;
    timer.phase = phase;
    if (phase === "inspection" || phase === "running") clearToasts();
    if (phase === "inspection" && !["inspection", "holding", "ready"].includes(previous))
      effects()?.start("inspection", { since: timer.inspectStart, voice: pref.inspectionVoice });
    else if (phase === "inspection" && motion?.mode !== "inspection")
      effects()?.start("inspection", { since: timer.inspectStart, voice: pref.inspectionVoice });
    else if (phase === "running") effects()?.start("start");
    else if (phase === "idle") motion?.clear();
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
    if (["idle", "stopped"].includes(timer.phase)) {
      recordProfile();
      motion?.clear();
    }
    if (pref.inspection && (timer.phase === "idle" || timer.phase === "stopped")) {
      timer.inspectStart = performance.now();
      timer.penalty = "";
      setTimerPhase("inspection");
      inspectionTick();
      return;
    }
    timer.priorPhase = timer.phase;
    if (pref.pressToStart) {
      // One press starts the attempt; the next key press stops it.
      setTimerPhase("ready");
      releaseHold();
      timer.blockedRelease = true;
      return;
    }
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
    const before = recordProfile();
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
    const after = before && typeof CTEffects !== "undefined"
      ? CTEffects.appendProfile(before, solves(), s)
      : null;
    if (after) recordCache = { data: solves(), length: solves().length, value: after };
    latestId = s.id;
    setTimerPhase("stopped");
    persist(true, true);
    takeScramble();
    refreshTimerAfterRecord(s);
    effects()?.start("expiry");
    if (before && typeof CTEffects !== "undefined") {
      const event = CTEffects.achievements(before, solves(), after || recordProfile());
      if (event.rusty) effects()?.celebrate(event);
    }
    toast("Inspection ran out. Saved as DNF.");
  }
  function finishSolve() {
    if (timer.phase !== "running") return;
    const rawMs = Math.floor((performance.now() - timer.start) / 10) * 10;
    cancelAnimationFrame(timer.raf);
    const before = recordProfile();
    const s = {
      id: uid(),
      rawMs,
      penalty: timer.penalty,
      scramble: currentScramble,
      date: new Date().toISOString(),
      note: "",
    };
    active().solves.push(s);
    const after = before && typeof CTEffects !== "undefined"
      ? CTEffects.appendProfile(before, solves(), s)
      : null;
    if (after) recordCache = { data: solves(), length: solves().length, value: after };
    latestId = s.id;
    setTimerPhase("stopped");
    persist(true, true);
    takeScramble();
    refreshTimerAfterRecord(s);
    if (before && typeof CTEffects !== "undefined") {
      const event = CTEffects.achievements(before, solves(), after || recordProfile());
      effects()?.celebrate(event);
    } else effects()?.start("stop");
  }
  function cancelTimer() {
    motion?.clear();
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
    if (view === "effects") {
      if (e.key === "Escape") { e.preventDefault(); navigate("timer"); }
      return;
    }
    const solveRow = e.target.closest?.("tr[data-solve]");
    if (
      solveRow &&
      (e.key === "Enter" || e.code === "Space") &&
      !timerBusy()
    ) {
      e.preventDefault();
      openSolve(solveRow.dataset.solve);
      return;
    }
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
      !e.target.closest("button:not(.timer-surface)")
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
          render(true);
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
          render(true);
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
    if (timerBusy() || scrambleRefreshing) return;
    scrambleRefreshing = true;
    const oldScene = view === "timer" ? scene : null;
    const replace = () => {
      if (scene !== oldScene || view !== "timer") {
        scrambleRefreshing = false;
        return;
      }
      takeScramble();
      render();
      scrambleRefreshing = false;
      $("#timer-surface")?.focus({ preventScroll: true });
    };
    if (oldScene?.stage) oldScene.exit().then(replace);
    else replace();
  }
  function penalty(id, value) {
    const s = solves().find((x) => x.id === id);
    if (!s) return;
    s.penalty = value;
    recordCache = null;
    motion?.clear();
    if (!demo) persist();
    const inDrawer = drawerId;
    const inAverage = averageDrawer;
    keepPanel = true;
    render();
    if (inAverage) openAverage(inAverage.n, id);
    else if (inDrawer) openSolve(id);
  }
  function deleteSolve(id) {
    recordCache = null;
    motion?.clear();
    const cat = active(),
      idx = cat.solves.findIndex((x) => x.id === id);
    if (idx < 0) return;
    const wasLatest = latestId === id;
    const [s] = cat.solves.splice(idx, 1);
    if (wasLatest) latestId = null;
    if (!demo) persist(false, true);
    closeDialog();
    keepPanel = true;
    if (view === "timer" && $(".timer-card")) {
      const last = solves().find((item) => item.id === latestId);
      $("#timer-digits").textContent = last ? fmt(C.value(last)) : "0.00";
      $("#timer-result").innerHTML = last ? resultControls(last) : "";
      schedulePanelRefresh();
    } else render();
    toast("Solve removed.", false, {
      label: "Undo",
      run: () => {
        cat.solves.splice(Math.min(idx, cat.solves.length), 0, s);
        if (wasLatest) latestId = s.id;
        if (!demo) persist(false, true);
        keepPanel = true;
        if (view === "timer" && $(".timer-card")) {
          const restored = solves().find((item) => item.id === latestId);
          $("#timer-digits").textContent = restored ? fmt(C.value(restored)) : "0.00";
          $("#timer-result").innerHTML = restored ? resultControls(restored) : "";
          schedulePanelRefresh();
        } else render();
      },
    });
  }

  function requestDeleteSolve(id) {
    const solve = solves().find((item) => item.id === id);
    if (!solve) return;
    if (C.value(solve) < 2) {
      deleteSolve(id);
      return;
    }
    const number = solves().indexOf(solve) + 1;
    const time = `${fmt(C.value(solve))}${solve.penalty === "+2" ? "+" : ""}`;
    showDialog(
      `Delete solve #${number}?`,
      `<div class="delete-confirm-time">${esc(time)}</div><div class="dialog-actions"><button class="btn btn-quiet" data-action="close-dialog">NO</button><button class="btn btn-danger" data-action="confirm-delete-solve" data-id="${esc(id)}">Yes</button></div>`,
      "delete-dialog",
    );
  }

  let dialogCloseTimer = 0;
  function showDialog(title, body, cls = "") {
    motion?.clear();
    averageDrawer = null;
    clearTimeout(dialogCloseTimer);
    drawerScene?.destroy();
    appearanceScene?.destroy();
    appearanceScene = null;
    drawerScene = null;
    drawerId = null;
    $("#dialog").className = cls;
    $("#dialog-content").innerHTML =
      `<div class="dialog-head"><h2 id="dialog-title">${title}</h2><button class="icon-btn" data-action="close-dialog" aria-label="Close dialog">${icon("close")}</button></div><div class="dialog-body">${body}</div>`;
    if (!$("#dialog").open) $("#dialog").showModal();
  }
  function closeDialog(immediate = false) {
    const dialog = $("#dialog");
    if (!dialog.open || dialog.classList.contains("closing")) return;
    if (immediate || reduced) {
      dialog.close();
      return;
    }
    dialog.classList.add("closing");
    dialogCloseTimer = setTimeout(() => {
      if (dialog.open) dialog.close();
    }, 190);
  }
  $("#dialog").addEventListener("close", () => {
    averageDrawer = null;
    clearTimeout(dialogCloseTimer);
    $("#dialog").classList.remove("closing");
    drawerScene?.destroy();
    appearanceScene?.destroy();
    appearanceScene = null;
    drawerScene = null;
    drawerId = null;
    if (view === "timer") $("#timer-surface")?.focus({ preventScroll: true });
  });
  $("#dialog").addEventListener("cancel", (e) => {
    e.preventDefault();
    closeDialog();
  });
  $("#dialog").addEventListener("click", (e) => {
    if (e.target !== e.currentTarget) return;
    const box = e.currentTarget.getBoundingClientRect();
    if (
      e.clientX < box.left ||
      e.clientX > box.right ||
      e.clientY < box.top ||
      e.clientY > box.bottom
    )
      closeDialog();
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
      `<p>Use seconds or minutes:seconds. A trailing + means the two-second penalty is already included.</p><form id="manual-form"><label class="field">Time<input name="time" placeholder="12.34, 1:02.50, 14.34+, or DNF" required autofocus></label><label class="field">Scramble<textarea name="scramble" rows="3" data-copyable>${esc(currentScramble)}</textarea></label><div class="error-text" id="form-error"></div><div class="dialog-actions"><button type="button" class="btn btn-quiet" data-action="close-dialog">Cancel</button><button type="submit" class="btn btn-dark">Save solve</button></div></form>`,
    );
    $("#manual-form").onsubmit = (e) => {
      e.preventDefault();
      try {
        const time = C.parseTime(e.target.elements.time.value),
          alg = e.target.elements.scramble.value.trim();
        C.tokens(alg);
        const before = recordProfile();
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
        closeDialog(true);
        render();
        if (before && typeof CTEffects !== "undefined") effects()?.celebrate(CTEffects.achievements(before, solves(), recordProfile()));
        else toast("Solve recorded.");
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
      `<div class="detail-grid"><div class="detail-cube"><div id="drawer-cube"></div><div class="playback"><button class="icon-btn" data-cube="first" aria-label="Show solved cube">${icon("first")}</button><button class="icon-btn" data-cube="prev" aria-label="Previous move">${icon("left")}</button><button class="icon-btn play-btn" data-cube="play" aria-label="Play scramble">${icon("play")}</button><button class="icon-btn" data-cube="next" aria-label="Next move">${icon("chevron")}</button><button class="icon-btn" data-cube="last" aria-label="Show full scramble">${icon("last")}</button></div></div><div class="detail-side"><div class="detail-time">${fmt(C.value(s))}${s.penalty === "+2" ? "+" : ""}</div><div class="detail-meta"><span>${esc(longDate(s))}</span><span>${esc(active().name)}</span></div><div class="detail-actions">${resultControls(s)}</div><div class="scramble-line" data-copyable><button class="icon-btn copy-inline" data-action="copy" aria-label="Copy scramble">${icon("copy")}</button><div id="scramble-notation" class="scramble-tokens"></div></div><label class="field">Note<textarea class="detail-note" id="solve-note" maxlength="2000" rows="3" placeholder="Add a note"></textarea></label></div></div>`,
      "solve-detail",
    );
    drawerId = id;
    $("#solve-note").value = s.note || "";
    drawerScene = new CubeScene($("#drawer-cube"), s.scramble);
    if (pref.cubeMode === "net") drawerScene.setMode("net");
    drawerScene.onChange = updateNotation;
    if (drawerScene.invalid)
      $("#scramble-notation", $("#dialog")).textContent = s.scramble;
    else updateNotation();
    $("#solve-note").addEventListener("change", (e) => {
      s.note = e.target.value;
      if (!demo) persist();
    });
  }
  function openAverage(n, selectedId) {
    if (timerBusy()) return;
    const all = solves(), items = all.slice(-n);
    if (items.length < n) return;
    const selected = items.find(s => s.id === selectedId) || items[0];
    const scroll = $(".average-solves")?.scrollTop || 0;
    const scrollLeft = $(".average-solves")?.scrollLeft || 0;
    openSolve(selected.id);
    averageDrawer = { n };
    const sorted = items.map((s, i) => ({ s, i })).sort((a, b) => C.value(a.s) - C.value(b.s) || a.i - b.i);
    const best = sorted[0].i, worst = sorted.at(-1).i;
    const dialog = $("#dialog"), body = $(".dialog-body", dialog), details = $(".detail-grid", body);
    dialog.classList.add("average-detail", `average-${n}`);
    $("#dialog-title").textContent = `Average of ${n}`;
    const layout = document.createElement("div"); layout.className = "average-layout";
    const list = document.createElement("section"); list.className = "average-summary";
    list.innerHTML = `<div class="average-total"><span>Latest ao${n}</span><strong>${fmt(C.average(items, n))}<small>s</small></strong><p>${n - 2} counted · fastest and slowest excluded</p></div><div class="average-solves" aria-label="Solves in this average">${items.map((s, i) => `<button class="average-solve ${s.id === selected.id ? "selected" : ""} ${i === best || i === worst ? "excluded" : ""}" data-average-solve="${esc(s.id)}" aria-pressed="${s.id === selected.id}"><span class="average-index">${String(i + 1).padStart(2, "0")}</span><strong>${fmt(C.value(s))}${s.penalty === "+2" ? "+" : ""}</strong><span class="average-status">${i === best ? "Best · excluded" : i === worst ? "Worst · excluded" : `Solve #${all.length - n + i + 1}`}</span></button>`).join("")}</div>`;
    const right = document.createElement("section"); right.className = "average-selected";
    right.innerHTML = `<div class="average-selected-heading"><span>Solve #${all.indexOf(selected) + 1}</span><span>${items.indexOf(selected) + 1} of ${n} · click cube for 2D / 3D</span></div>`;
    right.append(details); layout.append(list, right); body.append(layout);
    $(".average-solves").scrollTop = scroll;
    $(".average-solves").scrollLeft = scrollLeft;
  }
  function openMean() {
    if (timerBusy()) return;
    const data = pref.timerMeanRange === "all" ? solves() : solves().slice(-Number(pref.timerMeanRange)), stats = C.stats(data);
    showDialog("Timer mean", `<p class="mean-explanation">Choose which solves contribute to the mean in the timer panel. Personal records and mean milestones always use the full category.</p><label class="field">Solve range<select data-control="timer-mean">${["all", 10000, 5000, 1000, 500, 100, 50, 12, 5].map(n => `<option value="${n}" ${String(n) === String(pref.timerMeanRange) ? "selected" : ""}>${n === "all" ? "Global · all solves" : `Last ${n.toLocaleString()} solves`}</option>`).join("")}</select></label><div class="mean-preview"><strong>${fmt(stats.mean)}<small>s</small></strong><span>${stats.valid.toLocaleString()} completed · ${stats.dnf} DNF excluded</span></div><p class="chart-note">Uses the available solves when the category is smaller than the selected range. +2 penalties count toward the mean.</p><div class="dialog-actions"><button class="btn btn-dark" data-action="close-dialog">Done</button></div>`, "mean-dialog");
  }
  function settings() {
    showDialog(
      "Settings",
      `<label class="toggle-row"><input type="checkbox" data-control="inspection" ${pref.inspection ? "checked" : ""}><span><strong>15-second inspection</strong>Press once to start inspection, then hold and release to start the solve. +2 at 15 seconds; at 17 the attempt is saved as a DNF automatically.</span></label><label class="toggle-row"><input type="checkbox" data-control="press-start" ${pref.pressToStart ? "checked" : ""}><span><strong>Start on a single press</strong>Skip the 350ms hold: one press starts the solve and the next key stops it. With inspection on, the first press starts inspection and the second starts the solve.</span></label><label class="toggle-row"><input type="checkbox" data-control="inspection-voice" ${pref.inspectionVoice ? "checked" : ""}><span><strong>Spoken inspection cues</strong>Hear “8 seconds” and “12 seconds” during inspection. Visual cues are always included.</span></label><label class="toggle-row"><input type="checkbox" data-control="scramble-animation" ${pref.scrambleAnimation ? "checked" : ""}><span><strong>Scramble animation</strong>Show the cube solved first, then animate through the scramble. Turn this off to spawn the cube directly scrambled.</span></label><label class="toggle-row"><input type="checkbox" data-control="cube-net" ${pref.cubeMode === "net" ? "checked" : ""}><span><strong>Show the cube as a flat net</strong>The scramble preview opens unfolded instead of in 3D. Clicking the cube switches either way.</span></label><div class="settings-actions"><button class="btn btn-quiet" data-action="appearance">${icon("palette")}Appearance</button><button class="btn btn-quiet" data-action="import">${icon("upload")}Import CSV</button><button class="btn btn-quiet" data-action="storage">${icon("folder")}Storage</button></div><div class="dialog-actions"><button class="btn btn-dark" data-action="close-dialog">Done</button></div>`,
    );
  }
  function appearance() {
    const modes = [
        ["system", "System", "Follow this device"],
        ["light", "Light", "Soft and airy"],
        ["dark", "Dark", "Comfortable at night"],
        ["contrast", "High contrast", "True black and white"],
      ],
      accents = [
        ["forest", "Forest"],
        ["ocean", "Ocean"],
        ["violet", "Violet"],
        ["ember", "Ember"],
      ];
    showDialog(
      "Appearance",
      `<div class="appearance-section"><h3>Display mode</h3><div class="mode-options">${modes.map(([value, label, detail]) => `<button class="mode-choice ${pref.theme === value ? "active" : ""}" data-theme-choice="${value}"><span class="mode-preview mode-preview-${value}"><i></i><i></i><i></i></span><strong>${label}</strong><small>${detail}</small></button>`).join("")}</div></div><div class="appearance-section"><h3>Color theme</h3><p>Changes the app accents while keeping each display mode balanced.</p><div class="accent-options">${accents.map(([value, label]) => `<button class="accent-choice ${pref.accent === value ? "active" : ""}" data-accent-choice="${value}"><i class="accent-swatch"></i><span>${label}</span>${icon("check")}</button>`).join("")}</div></div><div class="dialog-actions"><button class="btn btn-dark" data-action="close-dialog">Done</button></div>`,
      "appearance-dialog",
    );
    $(".dialog-actions", $("#dialog")).insertAdjacentHTML("beforebegin", `<div class="appearance-section cube-appearance"><h3>Cube colors</h3><p>Choose a palette for any cube, in 3D or the flat net.</p><div class="cube-palette-options" role="group" aria-label="Cube colors">${Object.entries(CUBE_PALETTES).map(([value, p]) => `<button class="cube-palette-choice" data-cube-palette="${value}" aria-pressed="${pref.cubePalette === value}"><span class="cube-color-swatches" aria-hidden="true">${["U", "D", "F", "B", "L", "R"].map(f => `<i style="background:${p.colors[f]}"></i>`).join("")}</span><strong>${p.label}</strong><small>${p.detail}</small></button>`).join("")}</div><div class="cube-carousel" role="region" aria-roledescription="carousel" aria-label="Cube models"><button class="icon-btn cube-carousel-arrow" data-cube-step="-1" aria-label="Previous cube">${icon("left")}</button><div class="cube-style-preview"><div id="appearance-cube"></div><strong id="cube-model-name">${CUBE_MODELS[pref.cubeFinish].label}</strong><span id="cube-model-detail">${CUBE_MODELS[pref.cubeFinish].detail}</span><span class="cube-orbit-hint">Drag to rotate · click for 2D</span></div><button class="icon-btn cube-carousel-arrow" data-cube-step="1" aria-label="Next cube">${icon("chevron")}</button><div class="cube-finish-options" role="group" aria-label="Choose a cube">${Object.entries(CUBE_MODELS).map(([value, model]) => `<button data-cube-finish="${value}" aria-pressed="${pref.cubeFinish === value}"><span class="cube-model-thumbnail">${cubeThumbnail(value)}</span><strong>${model.label}</strong></button>`).join("")}</div></div><h3>Graphics quality</h3><p>How much work the 3D cube does per frame. Raise it if your machine has the headroom, lower it if animation stutters.</p><div class="cube-palette-options" role="group" aria-label="Graphics quality">${Object.entries(CUBE_QUALITY).map(([value, q]) => `<button class="cube-palette-choice" data-cube-quality="${value}" aria-pressed="${pref.cubeQuality === value}"><strong>${q.label}</strong><small>${q.detail}</small></button>`).join("")}</div><p id="cube-finish-status" class="cube-finish-status" role="status">Every cube works with both palettes. Your choices save automatically.</p></div>`);
    appearanceScene = new CubeScene($("#appearance-cube"), "x'");
    appearanceScene.yaw = -42;
    appearanceScene.orbit();
    appearanceScene.carouselObserver = new ResizeObserver(() => centerCubeChoice("instant"));
    appearanceScene.carouselObserver.observe($(".cube-finish-options"));
    $(".cube-finish-options").addEventListener("keydown", e => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
      const buttons = $$("[data-cube-finish]"), index = buttons.indexOf(document.activeElement);
      if (index < 0) return;
      e.preventDefault();
      const next = e.key === "Home" ? 0 : e.key === "End" ? buttons.length - 1 : (index + (e.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next].focus(); buttons[next].click();
    });
  }
  function cubeThumbnail(model) {
    const colors = CUBE_PALETTES[pref.cubePalette].colors;
    const sculpted = model === "speedcube" || model === "uv";
    const faces = [["matrix(1 .45 0 1 4 20)", colors.U], ["matrix(1 -.45 0 1 31 32)", colors.R], ["matrix(1 .45 -1 .45 31 8)", colors.B]];
    // The coated model gets a raking band of highlight across each face: the
    // one thing that tells the two sculpted cubes apart at 64px is the sheen.
    const sheen = model === "uv" ? '<path d="M0 21 L21 0 L27 0 L27 3 L3 27 L0 27 Z" fill="#ffffff" opacity=".3"/>' : "";
    return `<svg viewBox="0 0 64 64" aria-hidden="true">${faces.map(([transform, color]) => `<g transform="${transform}"><rect width="27" height="27" rx="1" fill="${sculpted ? "#b4a08b" : "#22272b"}"/>${Array.from({ length: 9 }, (_, i) => `<rect x="${i % 3 * 9 + .5}" y="${Math.floor(i / 3) * 9 + .5}" width="8" height="8" rx="${sculpted ? (i === 4 ? 3 : 1.6) : model === "tiles" ? 1.7 : .5}" fill="${color}" ${model === "tiles" ? 'stroke="#ffffff55" stroke-width=".5"' : ""}/>`).join("")}${sheen}</g>`).join("")}</svg>`;
  }
  function centerCubeChoice(behavior = reduced ? "instant" : "smooth") {
    const selected = $(`[data-cube-finish="${pref.cubeFinish}"]`);
    if (!selected) return;
    const rail = selected.parentElement;
    rail.scrollTo({ left: selected.offsetLeft - (rail.clientWidth - selected.clientWidth) / 2, behavior });
  }
  function manage() {
    const c = active();
    if (!c || demo) {
      openCategory();
      return;
    }
    showDialog(
      "Category",
      `<form id="manage-form"><label class="field">Category name<input name="name" value="${esc(c.name)}" maxlength="80" required></label><p class="spacer file-status">${c.solves.length.toLocaleString()} solves<br>CSV: <code>${esc(c.file || "Assigned when saved to a folder")}</code></p><p>Renaming keeps the existing filename.</p><div class="error-text" id="form-error"></div><div class="dialog-actions"><button type="button" class="icon-btn danger-btn" data-action="delete-category" aria-label="Delete category" title="Delete category">${icon("trash")}</button><span class="dialog-spacer"></span><button type="button" class="btn btn-quiet" data-action="export">${icon("download")}Export CSV</button><button type="submit" class="btn btn-dark">Save name</button></div></form>`,
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
  function confirmDeleteCategory() {
    const c = active();
    if (!c || demo) return;
    showDialog(
      "Delete category",
      `<p>Delete <strong>${esc(c.name)}</strong> and its ${c.solves.length.toLocaleString()} solve${c.solves.length === 1 ? "" : "s"} from this workspace?</p><p>${c.file ? `<code>${esc(c.file)}</code> stays in your folder, so you can import it again later.` : "Nothing has been written to a folder for this category yet."}</p><div class="dialog-actions"><button class="btn btn-quiet" data-action="close-dialog">Cancel</button><button class="btn btn-danger" data-action="confirm-delete-category">${icon("trash")}Delete category</button></div>`,
    );
  }
  function deleteCategory() {
    const c = active();
    if (!c || demo) return;
    const idx = state.categories.findIndex((x) => x.id === c.id);
    if (idx < 0) return;
    const [removed] = state.categories.splice(idx, 1);
    pref.active = state.categories[Math.min(idx, state.categories.length - 1)]?.id || null;
    latestId = null;
    libraryCount = LIBRARY_BATCH;
    savePref();
    persist();
    closeDialog();
    render();
    toast(`${removed.name} removed.`, false, {
      label: "Undo",
      run: () => {
        state.categories.splice(Math.min(idx, state.categories.length), 0, removed);
        pref.active = removed.id;
        savePref();
        persist();
        render();
      },
    });
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
      `<div class="guide-studio"><div><strong>See what progress feels like</strong><p>Try every reward, earned frame, and inspection cue on the timer stage.</p></div><button class="btn btn-dark" data-action="effects-demo">${icon("play")}Animation studio</button></div><p><strong>Your sub-time title.</strong> Starts after 500 attempts and uses their arithmetic mean, including +2. A DNF makes that window DNF. Your best consecutive 500 across the entire category earns your title, including imported history, independently of the overview range. Special titles: sub 60, 45, 30, 25, 20, 15, 10, 8, 7, 6 and 5 seconds.</p><p><strong>Progress & rust.</strong> The category's global mean sets ordinary intervals: below 20s → 0.5s; below 30s → 1s; below 2min → 5s; below 10min → 20s. Beyond that, a 1–2–5 scale grows with your mean. A title gets rusty when the current 500 exceeds its threshold by more than one interval from that threshold's band. Return within that margin to shake off the rust; your earned title remains.</p>` +
      `<p><strong>Import.</strong> Import a CubeDesk-style CSV with <code>Index,Time,Scramble,Date</code>. Create your own categories; each gets a separate CSV.</p><p><strong>Timing.</strong> The timer is the home screen. Without inspection, hold space for 350ms, release when the digits light up, then press any key to stop. Settings can swap the hold for a single press. On touch screens, press and hold the timer. Turn inspection on in Settings: a normal press then starts inspection immediately, and you hold and release for 350ms to start the solve. At 15 seconds the result gets +2; at 17 the attempt is saved as a DNF on its own and the timer is ready for the next one.</p><p><strong>Solves.</strong> The list on the right holds every solve, newest first. Click one for its scramble, reconstruction and note, or use the button on the row to delete it. Move the pointer to the left edge for categories and the rest of the app.</p><p><strong>Cube.</strong> Drag to rotate. Click the cube to switch between the 3D view and the flat net. Open a solve to step through its moves or play the sequence. Start white-up, green-front.</p><p><strong>Scramble source.</strong> In local server mode, a background worker generates random cube states and solves them backward into verified scrambles. In standalone HTML mode, the timer uses 20 random moves and labels them accordingly. Neither mode is an official competition scramble source.</p><p><strong>Files.</strong> Open <code>Start CubeTracker.cmd</code> for automatic CSV saving beside the HTML. Opening the HTML directly uses browser storage; connect a folder or export to keep CSVs.</p><div class="help-grid"><span>Open timer</span><kbd>T</kbd><span>Next scramble (timer)</span><kbd>N</kbd><span>Hold, then release to start</span><kbd>Space</kbd><span>Instant start (timer focused)</span><kbd>Enter</kbd><span>Cancel an active attempt</span><kbd>Esc</kbd><span>This guide</span><kbd>?</kbd></div><p class="chart-note">Rolling averages retain DNFs. +2 counts toward time. Sub-target percentages count every attempt.</p>`,
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
        `<textarea style="width:100%" rows="4" readonly data-copyable>${esc(text)}</textarea>`,
      );
      $("textarea", $("#dialog")).select();
    }
  }
  function selectionInside(element) {
    const selection = window.getSelection?.();
    return Boolean(
      selection &&
        !selection.isCollapsed &&
        (element.contains(selection.anchorNode) ||
          element.contains(selection.focusNode)),
    );
  }
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("button,a.brand");
    const row = e.target.closest("tr[data-solve]");
    if (row && !b) {
      if (!selectionInside(row)) openSolve(row.dataset.solve);
      return;
    }
    if (!b || b.disabled) return;
    if (timerBusy() && !b.closest(".timer-surface")) return;
    if (b.matches("[data-copyable]") && selectionInside(b)) return;
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
      libraryCount = LIBRARY_BATCH;
      savePref();
      render();
      return;
    }
    if (b.dataset.solve) {
      openSolve(b.dataset.solve);
      return;
    }
    if (b.dataset.stat) {
      if (b.dataset.stat === "mean") openMean();
      else if (b.dataset.stat === "best") {
        const best = solves().reduce((a, s) => Number.isFinite(C.value(s)) && (!a || C.value(s) < C.value(a)) ? s : a, null);
        if (best) openSolve(best.id);
      } else openAverage(b.dataset.stat === "ao5" ? 5 : 12);
      return;
    }
    if (b.dataset.averageSolve && averageDrawer) {
      const n = averageDrawer.n;
      openAverage(n, b.dataset.averageSolve);
      $(`[data-average-solve="${b.dataset.averageSolve}"]`)?.focus({ preventScroll: true });
      return;
    }
    if (b.dataset.dayInfo) {
      $(".activity-day-info", b.closest(".activity-panel")).textContent = b.dataset.dayInfo;
      return;
    }
    if (b.hasAttribute("data-penalty")) {
      penalty(b.dataset.id, b.dataset.penalty);
      return;
    }
    if (b.dataset.delete) {
      requestDeleteSolve(b.dataset.delete);
      return;
    }
    if (b.dataset.trend) {
      pref.trend = b.dataset.trend;
      savePref();
      const body = $("#trend-body");
      if (!body) {
        render();
        return;
      }
      $$("[data-trend]").forEach((x) =>
        x.classList.toggle("active", x.dataset.trend === pref.trend),
      );
      const a = rangeSolves();
      body.innerHTML = `<div class="legend"><span><i></i>${pref.trend}</span><span><i class="single"></i>Individual solves</span></div>${chart(a)}`;
      bindCharts(body);
      return;
    }
    if (b.dataset.cubePalette || b.dataset.cubeFinish || b.dataset.cubeStep || b.dataset.cubeQuality) {
      if (b.dataset.cubePalette && Object.hasOwn(CUBE_PALETTES, b.dataset.cubePalette)) pref.cubePalette = b.dataset.cubePalette;
      if (Object.hasOwn(CUBE_MODELS, b.dataset.cubeFinish)) pref.cubeFinish = b.dataset.cubeFinish;
      if (Object.hasOwn(CUBE_QUALITY, b.dataset.cubeQuality)) pref.cubeQuality = b.dataset.cubeQuality;
      if (b.dataset.cubeStep) {
        const models = Object.keys(CUBE_MODELS);
        pref.cubeFinish = models[(models.indexOf(pref.cubeFinish) + Number(b.dataset.cubeStep) + models.length) % models.length];
      }
      savePref();
      $$("[data-cube-palette]").forEach(el => el.setAttribute("aria-pressed", String(el.dataset.cubePalette === pref.cubePalette)));
      $$("[data-cube-quality]").forEach(el => el.setAttribute("aria-pressed", String(el.dataset.cubeQuality === pref.cubeQuality)));
      $$("[data-cube-finish]").forEach(el => el.setAttribute("aria-pressed", String(el.dataset.cubeFinish === pref.cubeFinish)));
      $("#cube-model-name").textContent = CUBE_MODELS[pref.cubeFinish].label;
      $("#cube-model-detail").textContent = CUBE_MODELS[pref.cubeFinish].detail;
      $$("[data-cube-finish]").forEach(el => $(".cube-model-thumbnail", el).innerHTML = cubeThumbnail(el.dataset.cubeFinish));
      centerCubeChoice();
      $("#cube-finish-status").textContent = `${CUBE_MODELS[pref.cubeFinish].label} · ${CUBE_PALETTES[pref.cubePalette].label} · ${CUBE_QUALITY[pref.cubeQuality].label} quality. Saved for every cube preview.`;
      scene?.setAppearance();
      drawerScene?.setAppearance();
      appearanceScene?.setAppearance();
      return;
    }
    if (b.dataset.themeChoice) {
      pref.theme = b.dataset.themeChoice;
      savePref();
      applyTheme();
      return;
    }
    if (b.dataset.accentChoice) {
      pref.accent = b.dataset.accentChoice;
      savePref();
      applyTheme();
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
      case "effects-demo":
        closeDialog(true);
        navigate("effects");
        break;
      case "exit-effects":
        navigate("timer");
        break;
      case "play-effect":
        playDemoEffect();
        break;
      case "manage":
        manage();
        break;
      case "delete-category":
        confirmDeleteCategory();
        break;
      case "confirm-delete-category":
        deleteCategory();
        break;
      case "confirm-delete-solve":
        deleteSolve(b.dataset.id);
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
      case "appearance":
        appearance();
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
        libraryCount = LIBRARY_BATCH;
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
  function isCopyableTarget(target) {
    const element = target?.nodeType === 1 ? target : target?.parentElement;
    return Boolean(element?.closest?.("[data-copyable]"));
  }
  document.addEventListener("contextmenu", (e) => {
    if (!isCopyableTarget(e.target)) e.preventDefault();
  });
  document.addEventListener("selectstart", (e) => {
    if (!isCopyableTarget(e.target)) e.preventDefault();
  });
  document.addEventListener("dragstart", (e) => e.preventDefault());
  document.addEventListener("change", (e) => {
    const key = e.target.dataset.control;
    if (!key || timerBusy()) return;
    switch (key) {
      case "demo-effect":
        playDemoEffect();
        return;
      case "range":
        if (view === "insights") pref.insightsRange = e.target.value;
        else pref.range = e.target.value;
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
        libraryCount = LIBRARY_BATCH;
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
      case "inspection-voice":
        pref.inspectionVoice = e.target.checked;
        break;
      case "scramble-animation":
        pref.scrambleAnimation = e.target.checked;
        break;
      case "timer-mean":
        pref.timerMeanRange = e.target.value;
        savePref();
        keepPanel = true;
        render();
        openMean();
        return;
      case "cube-net":
        pref.cubeMode = e.target.checked ? "net" : "3d";
        break;
      case "press-start":
        pref.pressToStart = e.target.checked;
        break;
      case "sort":
        sort = e.target.value;
        libraryCount = LIBRARY_BATCH;
        break;
      case "filter":
        filter = e.target.value;
        libraryCount = LIBRARY_BATCH;
        break;
      case "start-date":
        startDate = e.target.value;
        libraryCount = LIBRARY_BATCH;
        break;
      case "end-date":
        endDate = e.target.value;
        libraryCount = LIBRARY_BATCH;
        break;
    }
    savePref();
    render();
  });
  document.addEventListener("input", (e) => {
    if (e.target.id !== "solve-search") return;
    query = e.target.value;
    libraryCount = LIBRARY_BATCH;
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
    if (["overview", "timer", "solves", "insights", "effects"].includes(initial))
      view = initial;
    savePref();
    startScrambler();
    render();
  }
  init();
})();
