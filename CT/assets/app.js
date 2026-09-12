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
    down: "m5 9 7 7 7-7",
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
    camera:
      "M15 6 17 9h4v10H3V9h4l2-3h6Zm1 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
    settings:
      "M4 6h9m5 0h2M4 12h3m5 0h8M4 18h9m5 0h2M15 4v4M9 10v4M15 16v4",
    layers: "m12 3 9 4.5-9 4.5-9-4.5L12 3Zm9 9-9 4.5L3 12m18 4.5-9 4.5-9-4.5",
    star: "m12 3.6 2.6 5.4 5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9L5.5 9.8l5.9-.8L12 3.6Z",
    shuffle: "M3 6h4l10 12h4M17 3l4 3-4 3M3 18h4l3-3.6M14 8.6 17 6M17 21l4-3-4-3",
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
    classic: { label: "Washed", detail: "Familiar and balanced", colors: Object.fromEntries(Object.entries(C.FACES).map(([f, v]) => [f, v.color])) },
    vivid: { label: "Vivid", detail: "Bright competition colors", colors: { U: "#fafcff", R: "#eb3046", F: "#16bd6b", D: "#ffdb19", L: "#ff821c", B: "#2474ef" } },
  };
  // Graphics quality trades fidelity for frame time. Only the 3D models read
  // it; the standard preview is CSS and costs the same everywhere.
  const CUBE_QUALITY = {
    low: { label: "Low", detail: "No shadows, single-density canvas. For integrated graphics and phones." },
    balanced: { label: "Balanced", detail: "Shadows and the full studio environment. The default." },
    high: { label: "High", detail: "Adds individual geometry and subtle variation to all 54 caps." },
    ultra: { label: "Ultra", detail: "Adds contact occlusion, lens aberration and grain. Wants a discrete GPU." },
    cinematic: { label: "Cinematic", detail: "Photographs it: defocus, halation, lens distortion and a film grade." },
  };
  // Model definitions never own colors: every renderer consumes the same palette.
  const CUBE_MODELS = {
    standard: { label: "Standard", detail: "Simple, crisp faces" },
    tiles: { label: "Tiles", detail: "Raised tiles · polished black plastic" },
    stickers: { label: "Stickers", detail: "Thin stickers · satin black plastic" },
    speedcube: { label: "Speedcube", detail: "Sculpted, stickerless pieces" },
    uv: { label: "UV Speedcube", detail: "The same pieces under a cured UV coat" },
    og: { label: "OG Speedcube", detail: "Classic vinyl stickers on sculpted plastic" },
  };
  // What the internals are moulded from, seen through the gaps and while a
  // layer turns. Colour only: the plastic's finish belongs to the renderer,
  // which keys CORE_FINISH off these same ids.
  const CUBE_CORES = {
    white: { label: "White", swatch: "#4a4d50" },
    black: { label: "Black", swatch: "#16181b" },
    green: { label: "Green", swatch: "#1d7a45" },
  };
  // Choosing a cross fixes only which centre points down. The remaining spin
  // is deterministic but carries no user-facing meaning.
  const CUBE_CROSSES = {
    U: { label: "White", rotation: "x2" },
    D: { label: "Yellow", rotation: "" },
    F: { label: "Green", rotation: "x'" },
    B: { label: "Blue", rotation: "x" },
    L: { label: "Orange", rotation: "z'" },
    R: { label: "Red", rotation: "z" },
  };
  const vectorDot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
  function rotateForCross(vector, face, inverse = false) {
    const token = CUBE_CROSSES[face]?.rotation;
    if (!token) return [...vector];
    const spec = C.moveSpec(token);
    return C.rotate(vector, spec.axis, spec.angle * (inverse ? -1 : 1)).map(Math.round);
  }
  function orientedStickers(stickers, face) {
    if (!CUBE_CROSSES[face]?.rotation) return stickers;
    return stickers.map(sticker => {
      const shown = { ...sticker };
      for (const key of ["p", "n", "right", "down"])
        shown[key] = rotateForCross(sticker[key], face);
      return shown;
    });
  }
  function orientedMoveSpec(spec, face) {
    if (!spec || !CUBE_CROSSES[face]?.rotation) return spec;
    return {
      ...spec,
      axis: rotateForCross(spec.axis, face),
      select: position => spec.select(rotateForCross(position, face, true)),
    };
  }
  function faceletsFromStickers(stickers) {
    const result = {};
    for (const [face, basis] of Object.entries(C.FACES)) {
      result[face] = Array(9);
      for (const sticker of stickers)
        if (vectorDot(sticker.n, basis.n) === 1)
          result[face][(vectorDot(sticker.p, basis.down) + 1) * 3 + vectorDot(sticker.p, basis.right) + 1] = sticker.face;
    }
    return result;
  }
  function crossQuaternion(face) {
    const token = CUBE_CROSSES[face]?.rotation;
    if (!token) return [0, 0, 0, 1];
    const { axis, angle } = C.moveSpec(token),
      sine = Math.sin(angle / 2);
    return [axis[0] * sine, axis[1] * sine, axis[2] * sine, Math.cos(angle / 2)];
  }
  function multiplyQuaternion(a, b) {
    const [ax, ay, az, aw] = a,
      [bx, by, bz, bw] = b;
    return [
      aw * bx + ax * bw + ay * bz - az * by,
      aw * by - ax * bz + ay * bw + az * bx,
      aw * bz + ax * by - ay * bx + az * bw,
      aw * bw - ax * bx - ay * by - az * bz,
    ];
  }
  function crossTransitionSpec(from, to) {
    const start = crossQuaternion(from),
      end = crossQuaternion(to),
      inverseStart = [-start[0], -start[1], -start[2], start[3]],
      delta = multiplyQuaternion(end, inverseStart);
    if (delta[3] < 0) for (let i = 0; i < 4; i++) delta[i] *= -1;
    const length = Math.hypot(delta[0], delta[1], delta[2]);
    if (length < 1e-7) return null;
    return {
      axis: delta.slice(0, 3).map(value => value / length),
      angle: 2 * Math.atan2(length, Math.max(-1, Math.min(1, delta[3]))),
      select: () => true,
    };
  }
  // The standard preview keeps its own reset angle; all realistic 3D models
  // share the user's preferred orbit captured from the live cube preview.
  const CUBE_ORBITS = {
    standard: { pitch: -25, yaw: -34 },
    threeD: { pitch: -31.3, yaw: -43.324 },
  };
  // Where the 3D cube's reflections come from. Studio is the generated softbox
  // rig; everything else is a photograph, and none of them change the standard
  // preview. The list itself lives in environments.js, next to each entry's HDR
  // and its calibration, so a new environment appears in this selector without
  // anything here being edited.
  const CUBE_ENVIRONMENTS = Object.fromEntries(
    Object.entries(window.CT_ENVIRONMENTS.ENVIRONMENTS)
      .map(([id, { label, detail }]) => [id, { label, detail }]));
  const LIGHTING_CONTROLS = {
    exposure: { label: "Brightness", detail: "Camera exposure", min: .3, max: 1.6, step: .01 },
    hemi: { label: "Ambient", detail: "Overall shadow lift", min: 0, max: 2.5, step: .01 },
    key: { label: "Key light", detail: "Main warm light", min: 0, max: 4, step: .01 },
    rim: { label: "Rim light", detail: "Cool edge separation", min: 0, max: 3, step: .01 },
    fill: { label: "Fill light", detail: "Opens the dark side", min: 0, max: 3, step: .01 },
    env: { label: "Reflections", detail: "HDR environment strength", min: 0, max: 2.5, step: .01 },
    gloss: { label: "Clearcoat", detail: "Top-layer reflection", min: 0, max: 1, step: .01 },
    glossRough: { label: "Highlight spread", detail: "Soft to sharp reflections", min: .03, max: .5, step: .005 },
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
      cubeEnvironment: "studio",
      cubeWear: false,
      cubeCore: "black",
      cubeCross: "D",
      scrambleAnimation: true,
      pressToStart: false,
      mouseClickStart: true,
      videoRecording: false,
      videoRecordInspection: true,
      cameraDeviceId: "",
      videoResolution: "720",
      videoFps: 30,
      videoMaxSeconds: 0,
      trainerSet: null,
      trainerView: "3d",
      trainerSpeed: 72,
      trainerReps: 12,
      trainerMode: "random",
      version: 2,
    },
    state = { categories: [], algSets: null, revision: 0 },
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
    appearanceSuspendedMainCube = false,
    appearanceLoadToken = 0,
    caseLoadToken = 0,
    appearanceSuspension = Promise.resolve(),
    lightingScene = null,
    lightingState = null,
    lightingReturnView = "timer",
    drawerId = null,
    averageDrawer = null,
    latestId = null,
    panelObserver = null,
    libraryObserver = null,
    sceneIdleHandle = 0,
    panelCount = 0,
    libraryCount = 0,
    trainerSelection = new Set(),
    trainerThumbs = [],
    trainerObserver = null,
    trainerResizeObserver = null,
    previewHost = null,
    previewCube = null,
    previewIdentity = null,
    previewFailed = false,
    previewDragging = false,
    previewPending = new Set(),
    caseDrawer = null,
    training = null,
    keepPanel = false;
  const PANEL_BATCH = 60;
  const LIBRARY_BATCH = 60;
  const VIDEO_RESOLUTIONS = {
    480: { label: "480p", width: 854, height: 480, bitrate: 850000 },
    720: { label: "720p", width: 1280, height: 720, bitrate: 1500000 },
    1080: { label: "1080p", width: 1920, height: 1080, bitrate: 2800000 },
  };
  const VIDEO_FPS = [24, 30, 60];
  const TIMER_RESTART_COOLDOWN_MS = 1000;
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
      restartAt: 0,
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
  if (!Object.hasOwn(CUBE_ENVIRONMENTS, pref.cubeEnvironment)) pref.cubeEnvironment = "studio";
  if (typeof pref.cubeWear !== "boolean") pref.cubeWear = false;
  if (!Object.hasOwn(CUBE_CORES, pref.cubeCore)) pref.cubeCore = "black";
  if (!Object.hasOwn(CUBE_CROSSES, pref.cubeCross)) pref.cubeCross = "D";
  // A first guess, not a verdict. Machines that advertise little get the safe
  // level, and nobody is opted into the expensive ones without choosing them.
  if (!Object.hasOwn(CUBE_QUALITY, pref.cubeQuality))
    pref.cubeQuality = matchMedia("(pointer: coarse)").matches || (navigator.hardwareConcurrency || 4) <= 4 ? "low" : "balanced";
  if (typeof pref.scrambleAnimation !== "boolean") pref.scrambleAnimation = true;
  if (typeof pref.mouseClickStart !== "boolean") pref.mouseClickStart = true;
  if (typeof pref.videoRecording !== "boolean") pref.videoRecording = false;
  if (typeof pref.videoRecordInspection !== "boolean") pref.videoRecordInspection = true;
  if (typeof pref.cameraDeviceId !== "string") pref.cameraDeviceId = "";
  if (!Object.hasOwn(VIDEO_RESOLUTIONS, String(pref.videoResolution)))
    pref.videoResolution = "720";
  pref.videoFps = Number(pref.videoFps);
  if (!VIDEO_FPS.includes(pref.videoFps)) pref.videoFps = 30;
  // 0 means "keep every recording". Anything above is a ceiling in seconds on
  // the solve itself, not on the clip.
  pref.videoMaxSeconds = Math.round(Number(pref.videoMaxSeconds));
  if (!Number.isFinite(pref.videoMaxSeconds) || pref.videoMaxSeconds < 0) pref.videoMaxSeconds = 0;
  pref.videoMaxSeconds = Math.min(3600, pref.videoMaxSeconds);
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
  const algSets = () => state.algSets || [];
  const activeSet = () =>
    algSets().find((set) => set.id === pref.trainerSet) || algSets()[0] || null;
  const emptyStats = () => ({
    attempts: 0,
    best: null,
    total: 0,
    last: null,
    lastDate: null,
  });
  const favouriteAlg = (entry) =>
    entry.algs.find((alg) => alg.id === entry.favoriteId) || entry.algs[0];
  const findCase = (id) => activeSet()?.cases.find((entry) => entry.id === id);
  function newCase(name, groupId, moves) {
    const algs = moves.map((text) => ({ id: uid(), moves: text }));
    return {
      id: uid(),
      name,
      groupId,
      algs,
      favoriteId: algs[0].id,
      stats: emptyStats(),
    };
  }
  // The preloaded sets are instantiated once, so ids are stable and everything
  // the user adds afterwards lives beside them. A set the user deletes stays
  // deleted; it can be brought back from the Trainer's set menu.
  function seedAlgSets() {
    if (typeof CT_TRAINER === "undefined") return false;
    if (!state.algSets) {
      state.algSets = CT_TRAINER.SETS.map(buildSeedSet);
      return true;
    }
    // Upgrade a user-created empty placeholder when a matching built-in ships.
    // This is intentionally narrower than auto-adding every missing set: a
    // built-in the user deliberately deleted must stay deleted.
    let changed = false;
    for (const seed of CT_TRAINER.SETS) {
      if (algSets().some((set) => set.builtin === seed.builtin)) continue;
      const placeholder = algSets().find(
        (set) =>
          !set.builtin &&
          !set.groups.length &&
          !set.cases.length &&
          set.name.toLowerCase() === seed.name.toLowerCase(),
      );
      if (!placeholder) continue;
      const completed = buildSeedSet(seed);
      Object.assign(placeholder, completed, { id: placeholder.id });
      changed = true;
    }
    return changed;
  }
  function buildSeedSet(seed) {
    const set = {
      id: uid(),
      name: seed.name,
      builtin: seed.builtin || null,
      groups: [],
      cases: [],
    };
    for (const group of seed.groups) {
      const created = { id: uid(), name: group.name };
      set.groups.push(created);
      for (const entry of group.cases)
        set.cases.push(newCase(entry.name, created.id, entry.algs));
    }
    return set;
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
      const snapshot = state.categories,
        sets = state.algSets;
      saveChain = saveChain.then(async () => {
        try {
          const res = await fetch("/api/library", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              revision: state.revision,
              categories: snapshot,
              algSets: sets,
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Could not save CSV files.");
          state.revision = data.revision;
          // The response echoes the sets back, but adopting them would undo an
          // edit made while this save was in flight. The local copy is the one
          // that matters; the next save carries it.
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
    let svg = `<svg class="chart ${height < 120 ? "mini-chart" : ""}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="${kind === "goal" ? `Rolling percentage under ${pref.target} seconds across ${n} solves` : kind === "pb" ? "Personal best progression" : "Solve times, rolling average, and trendline"}">`;
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
    if (kind === "trend") {
      // Fit the trendline to the individual completed solves, not the rolling
      // average, so it shows the direction of the underlying solve times.
      let count = 0,
        sx = 0,
        sy = 0,
        sxx = 0,
        sxy = 0,
        first = -1,
        last = -1;
      for (let i = 0; i < data.length; i++) {
        const v = C.value(data[i]);
        if (!Number.isFinite(v)) continue;
        if (first < 0) first = i;
        last = i;
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
          at = (i) => Math.max(min, Math.min(max, intercept + slope * i));
        svg += `<path d="M${x(first).toFixed(2)},${y(at(first)).toFixed(2)}L${x(last).toFixed(2)},${y(at(last)).toFixed(2)}" fill="none" style="stroke:var(--chart-trend)" stroke-width="1.7" stroke-dasharray="6 5" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`;
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
    return `<section class="panel cube-panel"><div class="panel-heading"><div><h2>Scramble</h2>${label ? `<p>${label}</p>` : ""}</div></div><div id="cube-mount"></div><div class="cube-bottom"><p class="scramble-mini" data-copyable>${esc(currentScramble)}</p><button class="btn btn-dark" data-action="practice">${icon("play")}Solve ${icon("arrow")}</button></div></section>`;
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
        const dateLabel = date.toLocaleDateString("en", { month: "long", day: "numeric", year: "numeric" });
        const label = `${dateLabel} · ${future ? "Upcoming" : `${n.toLocaleString()} solves`}`;
        cells += `<button class="calendar-day heat-cell${future ? " future" : ""}${today ? " today" : ""}" data-level="${n && !future ? Math.max(1, Math.ceil(Math.sqrt(n / max) * 4)) : 0}" ${future ? "disabled" : ""} aria-label="${label}" data-day-info="${label}" data-day-date="${esc(dateLabel)}" data-day-count="${n}" aria-expanded="false" aria-controls="activity-day-popover" ${today ? 'aria-current="date"' : ""}><span>${day}</span></button>`;
      }
      months += `<div class="activity-month"><h3>${start.toLocaleDateString("en", { month: "short" })}<span>${start.getFullYear()}</span></h3><div class="calendar-weekdays" aria-hidden="true">${["M", "T", "W", "T", "F", "S", "S"].map(x => `<span>${x}</span>`).join("")}</div><div class="month-grid">${cells}</div></div>`;
    }
    return `<section class="panel panel-pad activity-panel"><div class="panel-heading"><div><h2>Activity</h2><p>${activeDays} active days · ${total.toLocaleString()} solves · ${countMonths} months</p></div><div class="heat-legend"><span>Less</span>${[0,1,2,3,4].map(x => `<i class="heat-cell" data-level="${x}"></i>`).join("")}<span>More</span></div></div><div class="activity-months" style="--months:${countMonths}">${months}</div><div id="activity-day-popover" class="activity-popover" role="status" hidden></div><div class="activity-day-info">Click a day to see its activity <span>Today is outlined</span></div></section>`;
  }
  function overview() {
    const a = rangeSolves();
    return (
      heading(
        "Overview",
        `${solves().length ? "" : '<button class="btn btn-quiet" data-action="demo">Load demo data</button>'}${rangeSelect()}`,
      ) +
      metrics(a) +
      `<div class="main-grid"><section class="panel panel-pad"><div class="panel-heading"><h2>Solve times</h2><div class="segmented">${["ao5", "ao12", "ao100"].map((x) => `<button class="${pref.trend === x ? "active" : ""}" data-trend="${x}">${x}</button>`).join("")}</div></div><div id="trend-body"><div class="legend"><span><i></i>${pref.trend}</span><span><i class="single"></i>Individual solves</span><span><i class="trend"></i>Trendline</span></div>${chart(a)}</div><div class="chart-caption"><span>${a.length ? `${a.length.toLocaleString()} solves · chronological order` : "No solves yet"}</span><button class="btn-link" data-view="insights">Explore ${icon("arrow-up-right")}</button></div></section>${cubePanel()}</div>${activity(solves())}`
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
    return `<div class="solve-entry"><button class="solve-entry-open" data-solve="${esc(s.id)}" aria-label="Solve ${n}: ${t}${s.video ? ", with video" : ""}"><span class="solve-entry-time">${t}</span><span class="solve-entry-num">${s.video ? `<i class="solve-video-badge" title="Video recorded">${icon("camera")}</i>` : ""}#${n}</span></button><button class="solve-entry-del" data-delete="${esc(s.id)}" tabindex="-1" aria-label="Delete solve ${n}">${icon("trash")}</button></div>`;
  }
  function solveRows(from, to) {
    const all = solves(),
      total = all.length;
    let html = "";
    for (let i = from; i < to && i < total; i++)
      html += solveRow(all[total - 1 - i], total - i);
    return html;
  }
  function refreshSolveVideoBadge(id) {
    const solve = findSolveAnywhere(id),
      button = $$('[data-solve]').find((element) => element.dataset.solve === id),
      number = solve && solves().indexOf(solve) + 1;
    if (!solve?.video || !button || number < 1) return;
    button.setAttribute("aria-label", `${button.getAttribute("aria-label") || `Solve ${number}`}, with video`);
    const label = $(".solve-entry-num", button);
    if (label)
      label.innerHTML = `<i class="solve-video-badge" title="Video recorded">${icon("camera")}</i>#${number}`;
  }
  function focusPage() {
    const last = solves().find((x) => x.id === latestId),
      total = solves().length;
    panelCount = Math.max(PANEL_BATCH, Math.min(panelCount, total));
    return `<div class="focus-stage timer-card" data-state="${timer.phase}"><div class="focus-main"><div class="focus-row"><div class="focus-media"><div id="cube-mount" class="focus-cube"></div><div class="live-camera" style="--camera-aspect:16 / 9"><video id="live-camera-feed" autoplay muted playsinline aria-label="Live recording preview"></video><span class="live-camera-rec"><i></i>REC</span></div></div><div class="focus-time"><div class="focus-scramble-wrap"><p class="focus-scramble" data-copyable>${esc(scramblePending ? "Preparing scramble…" : currentScramble)}</p><button class="icon-btn focus-scramble-refresh" data-action="new-scramble" title="New scramble" aria-label="New scramble">${icon("reset")}</button></div><button class="timer-surface" id="timer-surface" aria-label="Timer. ${pref.pressToStart ? (pref.inspection ? "Press to start inspection, press again to start the solve." : "Press to start, press again to stop.") : pref.inspection ? "Press to start inspection, then hold and release to start the solve." : "Hold space or press and hold here, then release to start."}"><span class="timer-state sr-only" id="timer-state" role="status">${last ? "SAVED" : "READY"}</span><span class="timer-digits" id="timer-digits">${last ? fmt(C.value(last)) : "0.00"}</span></button><div class="timer-result" id="timer-result">${last ? resultControls(last) : ""}</div></div></div></div><aside class="solve-panel">${panelStats()}<div class="solve-list" id="solve-list">${total ? solveRows(0, panelCount) : '<p class="solve-empty">No solves yet</p>'}<div class="solve-sentinel" id="solve-sentinel"${panelCount >= total ? " hidden" : ""}></div></div></aside></div>`;
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
        const current = solves(),
          total = current.length;
        panelCount = Math.max(PANEL_BATCH, Math.min(panelCount, total));
        // Reconcile the rows on screen against the solves that should be
        // there, matched by id. A recorded solve is still the cheap prepend,
        // but a deletion, an undo or any other reshuffle now rebuilds instead
        // of prepending a duplicate on top of a stale list.
        const wanted = [];
        for (let i = 0; i < panelCount && i < total; i++) wanted.push(current[total - 1 - i].id);
        const shown = $$(".solve-entry", list).map(
          (entry) => entry.querySelector("[data-solve]")?.dataset.solve,
        );
        const unchanged =
          shown.length === wanted.length && wanted.every((id, i) => id === shown[i]);
        const prependOnly =
          !unchanged &&
          shown.length > 0 &&
          wanted.length > 0 &&
          shown.length >= wanted.length - 1 &&
          shown.length <= wanted.length &&
          wanted.every((id, i) => i === 0 || id === shown[i - 1]);
        if (prependOnly) {
          list.insertAdjacentHTML("afterbegin", solveRow(current.at(-1), total));
          $$(".solve-entry", list)
            .slice(panelCount)
            .forEach((entry) => entry.remove());
        } else if (!unchanged) {
          const scroll = list.scrollTop;
          panelObserver?.disconnect();
          panelObserver = null;
          list.innerHTML = `${total ? solveRows(0, panelCount) : '<p class="solve-empty">No solves yet</p>'}<div class="solve-sentinel" id="solve-sentinel"${panelCount >= total ? " hidden" : ""}></div>`;
          list.scrollTop = Math.min(scroll, Math.max(0, list.scrollHeight - list.clientHeight));
          bindSolvePanel();
        }
        $$(".solve-entry", list).forEach((entry, index) => {
          entry.querySelector(".solve-entry-num").textContent = `#${total - index}`;
        });
        const sentinel = $("#solve-sentinel");
        if (sentinel) sentinel.hidden = panelCount >= total;
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
  // ---------------------------------------------------------------- Trainer
  // A case is whatever its algorithm solves: the cube on a card is the solved
  // cube with that algorithm run backwards, so a card can never show a case its
  // algorithm does not answer.
  function thumbRotate(v, pitch, yaw) {
    const ry = (yaw * Math.PI) / 180,
      rx = (-pitch * Math.PI) / 180,
      cy = Math.cos(ry),
      sy = Math.sin(ry),
      cx = Math.cos(rx),
      sx = Math.sin(rx),
      x = v[0] * cy + v[2] * sy,
      z = -v[0] * sy + v[2] * cy;
    return [x, v[1] * cx - z * sx, v[1] * sx + z * cx];
  }
  function drawCaseThumb(mount) {
    const state = mount._caseThumb;
    if (state?.realistic) { drawRealisticThumb(mount); return; }
    const canvas = state?.canvas;
    if (!canvas || !canvas.isConnected) return;
    const width = Math.max(1, mount.clientWidth || 160),
      height = Math.max(1, mount.clientHeight || 114),
      ratio = Math.min(devicePixelRatio || 1, 2),
      pixelWidth = Math.round(width * ratio),
      pixelHeight = Math.round(height * ratio);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    const ctx = canvas.getContext("2d"),
      camera = 18,
      project = (point) => {
        const p = thumbRotate(point, state.pitch, state.yaw),
          perspective = camera / (camera - p[2]);
        return { x: p[0] * perspective, y: -p[1] * perspective, z: p[2] };
      },
      same = (a, b) => a.every((value, i) => value === b[i]),
      faces = [];
    for (const face of Object.values(C.FACES)) {
      const normal = thumbRotate(face.n, state.pitch, state.yaw);
      if (normal[2] <= .001) continue;
      const faceCenter = face.n.map((value) => value * 1.51),
        faceCorner = (right, down) => faceCenter.map(
          (value, i) => value + face.right[i] * right * 1.5 + face.down[i] * down * 1.5,
        ),
        points = [faceCorner(-1, -1), faceCorner(1, -1), faceCorner(1, 1), faceCorner(-1, 1)].map(project),
        stickers = state.cube.stickers
          .filter((sticker) => same(sticker.n, face.n))
          .map((sticker) => {
            const center = sticker.p.map((value, i) => value + sticker.n[i] * .515),
              corner = (right, down) => center.map(
                (value, i) => value + sticker.right[i] * right * .425 + sticker.down[i] * down * .425,
              ),
              stickerPoints = [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)].map(project);
            return { points: stickerPoints, color: state.colors[sticker.face] };
          });
      faces.push({ points, stickers, depth: points.reduce((sum, p) => sum + p.z, 0) / 4 });
    }
    faces.sort((a, b) => a.depth - b.depth);
    const outer = faces.flatMap((face) => face.points),
      minX = Math.min(...outer.map((p) => p.x)),
      maxX = Math.max(...outer.map((p) => p.x)),
      minY = Math.min(...outer.map((p) => p.y)),
      maxY = Math.max(...outer.map((p) => p.y)),
      padding = Math.max(9, Math.min(width, height) * .085),
      fit = Math.min((width - padding * 2) / (maxX - minX), (height - padding * 2) / (maxY - minY)),
      baseScale = state.fitWidth === width && state.fitHeight === height ? state.baseScale : fit,
      scale = Math.min(baseScale, fit),
      offsetX = (width - (minX + maxX) * scale) / 2,
      offsetY = (height - (minY + maxY) * scale) / 2,
      screenPoints = (points) => points.map((p) => ({ x: offsetX + p.x * scale, y: offsetY + p.y * scale })),
      path = (points, radius = 0) => {
        const p = screenPoints(points);
        ctx.beginPath();
        if (!radius) {
          ctx.moveTo(p[0].x, p[0].y);
          for (let i = 1; i < p.length; i++) ctx.lineTo(p[i].x, p[i].y);
        } else {
          for (let i = 0; i < p.length; i++) {
            const previous = p[(i + p.length - 1) % p.length],
              current = p[i],
              next = p[(i + 1) % p.length],
              incoming = { x: current.x + (previous.x - current.x) * radius, y: current.y + (previous.y - current.y) * radius },
              outgoing = { x: current.x + (next.x - current.x) * radius, y: current.y + (next.y - current.y) * radius };
            if (!i) ctx.moveTo(incoming.x, incoming.y);
            else ctx.lineTo(incoming.x, incoming.y);
            ctx.quadraticCurveTo(current.x, current.y, outgoing.x, outgoing.y);
          }
        }
        ctx.closePath();
      },
      style = getComputedStyle(mount),
      plastic = style.getPropertyValue("--sticker-line").trim() || "#28362f",
      gloss = style.getPropertyValue("--sticker-gloss").trim() || "#ffffff19";
    state.baseScale = baseScale;
    state.fitWidth = width;
    state.fitHeight = height;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.lineJoin = "round";
    for (const face of faces) {
      path(face.points);
      ctx.fillStyle = plastic;
      ctx.fill();
      for (const sticker of face.stickers) {
        path(sticker.points, .13);
        ctx.fillStyle = sticker.color;
        ctx.fill();
        ctx.lineWidth = .7;
        ctx.strokeStyle = gloss;
        ctx.stroke();
      }
    }
    canvas.dataset.pitch = state.pitch.toFixed(3);
    canvas.dataset.yaw = state.yaw.toFixed(3);
  }
  function queueCaseThumbDraw(mount) {
    const state = mount._caseThumb;
    if (!state || state.raf) return;
    state.raf = requestAnimationFrame(() => {
      state.raf = 0;
      drawCaseThumb(mount);
    });
  }
  function clearCaseThumb(mount) {
    if (mount._caseThumb?.raf) cancelAnimationFrame(mount._caseThumb.raf);
    previewPending.delete(mount);
    if (previewCube && previewCube.stage === mount) {
      previewCube.park();
      mount.classList.remove("hosting-live");
    }
    mount._caseThumb = null;
    mount.replaceChildren();
  }
  function bindCaseThumbOrbit(mount) {
    mount.addEventListener("pointerdown", (event) => {
      const state = mount._caseThumb;
      if (!state || mount.dataset.mode !== "3d") return;
      if (state.realistic && previewCube && !previewCube.disposed) {
        // Render the case before lending the canvas so the first frame is right.
        previewCube.setPalette(state.colors);
        previewCube.draw(state.stickers, null, 0);
        previewCube.orbit(state.pitch, state.yaw, 1);
        previewCube.adopt(mount);
        previewDragging = true;
        mount.classList.add("hosting-live");
      }
      mount.setPointerCapture(event.pointerId);
      state.drag = { x: event.clientX, y: event.clientY, moved: false };
      mount.classList.add("is-orbiting");
      queueCaseThumbDraw(mount);
    });
    mount.addEventListener("pointermove", (event) => {
      const state = mount._caseThumb;
      if (!state?.drag) return;
      const dx = event.clientX - state.drag.x,
        dy = event.clientY - state.drag.y;
      if (Math.hypot(dx, dy) > 2) state.drag.moved = true;
      state.yaw += dx * .55;
      state.pitch = Math.max(-85, Math.min(85, state.pitch - dy * .45));
      state.drag.x = event.clientX;
      state.drag.y = event.clientY;
      queueCaseThumbDraw(mount);
    });
    const finish = (cancelled = false) => {
      const state = mount._caseThumb;
      if (!state?.drag) return;
      if (!cancelled && state.drag.moved) mount.dataset.suppressOpen = "true";
      state.drag = null;
      mount.classList.remove("is-orbiting");
      if (state.realistic && previewCube && previewCube.stage === mount) {
        // Freeze the final frame into the card, then hand the canvas back.
        previewCube.setPalette(state.colors);
        previewCube.draw(state.stickers, null, 0);
        previewCube.orbit(state.pitch, state.yaw, 1);
        blitPreview(state, mount);
        previewCube.park();
        mount.classList.remove("hosting-live");
        previewDragging = false;
        const pending = [...previewPending];
        previewPending.clear();
        pending.forEach((el) => { if (el._caseThumb?.realistic && el.isConnected) drawRealisticThumb(el); });
      }
    };
    mount.addEventListener("pointerup", () => finish());
    mount.addEventListener("pointercancel", () => finish(true));
  }
  function caseThumb(mount, setupAlg, mode) {
    if (mount._caseThumb?.raf) cancelAnimationFrame(mount._caseThumb.raf);
    mount._caseThumb = null;
    // Hold the solved cube first, then execute the setup in that frame. Doing
    // this in the opposite order moves a white-top PLL to the bottom instead
    // of creating the same case on the newly selected upper layer.
    const cube = new C.Cube().apply([CUBE_CROSSES[pref.cubeCross].rotation, setupAlg].filter(Boolean).join(" ")),
      colors = CUBE_PALETTES[pref.cubePalette].colors;
    if (mode === "top") {
      const f = cube.facelets(),
        cell = (face, i) =>
          `<span style="background:${colors[f[face][i]]}"></span>`,
        gap = '<span class="case-gap"></span>';
      // Read as an algorithm sheet: the up face with the band of side stickers
      // around it, back at the top.
      mount.innerHTML = `<span class="case-top">${[
        gap, cell("B", 2), cell("B", 1), cell("B", 0), gap,
        cell("L", 0), cell("U", 0), cell("U", 1), cell("U", 2), cell("R", 2),
        cell("L", 1), cell("U", 3), cell("U", 4), cell("U", 5), cell("R", 1),
        cell("L", 2), cell("U", 6), cell("U", 7), cell("U", 8), cell("R", 0),
        gap, cell("F", 0), cell("F", 1), cell("F", 2), gap,
      ].join("")}</span>`;
      return;
    }
    const orbit = CUBE_ORBITS.standard;
    // Card previews are deliberately not CubeScene instances. One small 2D
    // canvas projects the cube's real sticker geometry and redraws only while
    // that card is being dragged, avoiding 54 composited DOM layers per card.
    mount.innerHTML = '<canvas class="case-canvas" aria-hidden="true"></canvas>';
    mount._caseThumb = {
      canvas: $("canvas", mount),
      cube,
      colors,
      pitch: orbit.pitch,
      yaw: orbit.yaw,
      drag: null,
      raf: 0,
    };
    drawCaseThumb(mount);
  }
  // --- Realistic Trainer previews -------------------------------------------
  // One shared cube renders every card: a still on a hidden host for cards at
  // rest, and its live canvas borrowed by the single card being dragged. A large
  // set therefore costs one WebGL context, not one per case. It is pinned to Low
  // quality and the studio room, where the extra tiers are not resolvable at card
  // size and the first frame stays synchronous.
  const PREVIEW_SLOT = "trainer-preview";
  function previewUsesRealistic() {
    return !previewFailed && pref.cubeFinish !== "standard" && pref.trainerView === "3d";
  }
  function previewStage() {
    if (previewHost?.isConnected) return previewHost;
    previewHost = document.createElement("div");
    previewHost.className = "cube-preview-host";
    previewHost.setAttribute("aria-hidden", "true");
    document.body.append(previewHost);
    return previewHost;
  }
  function acquirePreview() {
    const identity = `${pref.cubeFinish}|${pref.cubeWear ? 1 : 0}|${pref.cubeCore ?? "black"}`;
    if (previewCube && !previewCube.disposed && previewIdentity === identity) {
      if (!previewDragging) previewCube.adopt(previewStage());
      return previewCube;
    }
    previewCube = cubeStudio.acquirePreviewCube(
      PREVIEW_SLOT,
      previewStage(),
      () => { previewFailed = true; previewCube = null; repaintThumbs2D(); },
      pref.cubeFinish,
      Boolean(pref.cubeWear),
      pref.cubeCore ?? "black",
    );
    previewIdentity = identity;
    // Low's 1x buffer would blit soft on a retina display, so the shared preview
    // cube renders at the device cap instead. Nothing else about Low changes.
    const crisp = Math.min(devicePixelRatio || 1, 2);
    if (previewCube && !previewCube.disposed && previewCube.restPixelRatio !== crisp) {
      previewCube.restPixelRatio = crisp;
      previewCube.renderer.setPixelRatio(crisp);
      previewCube.resize();
    }
    return previewCube;
  }
  function caseThumb2D(mount, entry) {
    try {
      caseThumb(mount, C.setup(favouriteAlg(entry).moves), pref.trainerView);
    } catch {
      mount.textContent = "—";
    }
  }
  function renderPreviewStill(state, width, height) {
    const host = previewStage();
    if (previewCube.stage !== host) previewCube.adopt(host);
    host.style.width = `${width}px`;
    host.style.height = `${height}px`;
    previewCube.resize();
    previewCube.setPalette(state.colors);
    previewCube.draw(state.stickers, null, 0);
    previewCube.orbit(state.pitch, state.yaw, 1);
  }
  function blitPreview(state, mount) {
    if (!state.canvas || !previewCube) return;
    const width = Math.max(1, mount.clientWidth || 160),
      height = Math.max(1, mount.clientHeight || 114),
      ratio = Math.min(devicePixelRatio || 1, 2),
      pixelWidth = Math.round(width * ratio),
      pixelHeight = Math.round(height * ratio);
    if (state.canvas.width !== pixelWidth || state.canvas.height !== pixelHeight) {
      state.canvas.width = pixelWidth;
      state.canvas.height = pixelHeight;
    }
    const ctx = state.canvas.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, pixelWidth, pixelHeight);
    ctx.drawImage(previewCube.canvas, 0, 0, pixelWidth, pixelHeight);
    state.canvas.dataset.pitch = state.pitch.toFixed(3);
    state.canvas.dataset.yaw = state.yaw.toFixed(3);
  }
  function drawRealisticThumb(mount) {
    const state = mount._caseThumb;
    if (!state?.realistic || !previewCube || previewCube.disposed) return;
    if (!state.canvas) {
      const canvas = document.createElement("canvas");
      canvas.className = "case-canvas";
      const throbber = mount.querySelector(":scope > .cube-throbber");
      if (throbber) {
        // Keep the throbber mounted under the canvas so it can fade out instead
        // of vanishing the instant the still lands.
        throbber.classList.add("is-leaving");
        mount.append(canvas);
        setTimeout(() => throbber.remove(), 320);
      } else {
        mount.replaceChildren(canvas);
      }
      state.canvas = canvas;
    }
    if (previewCube.stage === mount) {
      // This card holds the live canvas while it is being dragged.
      previewCube.setPalette(state.colors);
      previewCube.draw(state.stickers, null, 0);
      previewCube.orbit(state.pitch, state.yaw, 1);
      return;
    }
    if (previewDragging) { previewPending.add(mount); return; }
    const width = Math.max(1, mount.clientWidth || 160),
      height = Math.max(1, mount.clientHeight || 114);
    renderPreviewStill(state, width, height);
    blitPreview(state, mount);
  }
  async function paintRealisticThumb(mount, entry) {
    const token = {};
    mount._caseThumb = { token };
    mount.innerHTML = CUBE_THROBBER;
    let cube;
    try {
      const setup = C.setup(favouriteAlg(entry).moves);
      cube = new C.Cube().apply([CUBE_CROSSES[pref.cubeCross].rotation, setup].filter(Boolean).join(" "));
    } catch {
      mount._caseThumb = null;
      mount.textContent = "—";
      return;
    }
    try {
      if (!cubeStudio) cubeStudio = await import("./cube-realistic.js");
    } catch {
      previewFailed = true;
      mount._caseThumb = null;
      caseThumb2D(mount, entry);
      return;
    }
    if (mount._caseThumb?.token !== token || !mount.isConnected) return;
    // Let the throbber paint before the synchronous preview build.
    await nextPaint();
    if (mount._caseThumb?.token !== token || !mount.isConnected) return;
    acquirePreview();
    if (mount._caseThumb?.token !== token || !mount.isConnected) return;
    mount._caseThumb = {
      realistic: true,
      token,
      cube,
      stickers: cube.stickers,
      colors: CUBE_PALETTES[pref.cubePalette].colors,
      pitch: CUBE_ORBITS.standard.pitch,
      yaw: CUBE_ORBITS.standard.yaw,
      drag: null,
      raf: 0,
      canvas: null,
    };
    drawRealisticThumb(mount);
  }
  function repaintThumbs2D() {
    trainerThumbs.forEach((mount) => {
      if (!mount.isConnected) return;
      const entry = findCase(mount.dataset.caseThumb);
      if (!entry) return;
      clearCaseThumb(mount);
      caseThumb2D(mount, entry);
    });
  }
  function releasePreview() {
    if (previewCube?.stage && previewCube.stage !== previewHost) previewCube.park();
    cubeStudio?.discardCube(PREVIEW_SLOT);
    previewCube = null;
    previewIdentity = null;
    previewDragging = false;
    previewPending.clear();
    previewHost?.remove();
    previewHost = null;
  }
  const groupCases = (set, groupId) =>
    groupId
      ? set.cases.filter((entry) => entry.groupId === groupId)
      : set.cases.filter(
          (entry) => !set.groups.some((group) => group.id === entry.groupId),
        );
  function trainerHeading(set) {
    const sets = algSets(),
      selector = `<select class="period-select" aria-label="Algorithm set" data-control="alg-set">${sets
        .map(
          (s) =>
            `<option value="${esc(s.id)}"${s.id === set?.id ? " selected" : ""}>${esc(s.name)}</option>`,
        )
        .join("")}<option value="__new__">+ New alg set…</option></select>`,
      modes = `<div class="segmented" role="group" aria-label="Case preview">${[
        ["3d", "3D"],
        ["top", "Top"],
      ]
        .map(
          ([id, label]) =>
            `<button class="${pref.trainerView === id ? "active" : ""}" data-trainer-view="${id}" aria-pressed="${pref.trainerView === id}">${label}</button>`,
        )
        .join("")}</div>`;
    return `<div class="page-heading"><h1>Trainer</h1><div class="heading-actions">${set ? `<button class="btn btn-quiet" data-action="new-group">${icon("plus")}New group</button><button class="btn btn-quiet" data-action="new-case" data-group="">${icon("plus")}New case</button>` : ""}${selector}${set ? modes + `<button class="icon-btn" data-action="manage-set" aria-label="Manage this set" title="Manage this set">${icon("more")}</button>` : ""}</div></div>`;
  }
  function caseCard(entry) {
    const picked = trainerSelection.has(entry.id);
    return `<article class="case-card${picked ? " picked" : ""}" data-case="${esc(entry.id)}"><label class="case-check"><input type="checkbox" data-case-check="${esc(entry.id)}"${picked ? " checked" : ""} aria-label="Select ${esc(entry.name)}"></label><button class="case-open" data-case-open="${esc(entry.id)}"><span class="case-name">${esc(entry.name)}</span><span class="case-cube" data-case-thumb="${esc(entry.id)}" data-mode="${pref.trainerView}"></span><span class="case-alg">${esc(favouriteAlg(entry).moves)}</span></button></article>`;
  }
  function caseGroup(group, cases) {
    const picked = cases.filter((entry) => trainerSelection.has(entry.id)).length;
    return `<section class="case-group"><div class="case-group-head"><label class="case-check"><input type="checkbox" data-group-check="${esc(group.id)}"${cases.length && picked === cases.length ? " checked" : ""} aria-label="Select every case in ${esc(group.name)}"></label><h2>${esc(group.name)}</h2><span class="case-group-count">${cases.length}</span><button class="icon-btn case-group-add" data-action="new-case" data-group="${esc(group.id)}" aria-label="Add a case to ${esc(group.name)}" title="Add a case">${icon("plus")}</button></div>${cases.length ? `<div class="case-grid">${cases.map(caseCard).join("")}</div>` : '<p class="case-group-empty">No cases in this group yet.</p>'}</section>`;
  }
  function trainBar() {
    const n = trainerSelection.size;
    return `<div class="train-bar"${n < 2 ? " hidden" : ""}><span class="train-bar-count"><strong>${n}</strong> selected</span><button class="btn btn-quiet" data-action="clear-selection">Clear</button><button class="btn btn-dark" data-action="train">${icon("play")}Train</button></div>`;
  }
  function trainerTools() {
    const set = activeSet();
    return `<div class="case-tools"><button class="btn btn-quiet" data-action="select-all"${set?.cases.length ? "" : " disabled"}>${icon("check")}Select all</button></div>`;
  }
  function trainer() {
    const set = activeSet();
    if (!set)
      return (
        trainerHeading(null) +
        `<div class="empty-state"><strong>No algorithm sets yet</strong>A set holds the cases you want to drill, each with the algorithms you use for it.<br><button class="btn btn-dark" data-action="new-set">${icon("plus")}New alg set</button>${typeof CT_TRAINER !== "undefined" ? ` <button class="btn btn-quiet" data-action="restore-sets">${icon("reset")}Restore built-in sets</button>` : ""}</div>`
      );
    const loose = groupCases(set, null),
      sections =
        set.groups.map((group) => caseGroup(group, groupCases(set, group.id))).join("") +
        (loose.length ? caseGroup({ id: "", name: "Ungrouped" }, loose) : "");
    return (
      trainerHeading(set) +
      trainerTools() +
      (set.groups.length || set.cases.length
        ? sections
        : `<div class="empty-state"><strong>${esc(set.name)} is empty</strong>Add a group, then add the cases you want to practise.</div>`) +
      trainBar()
    );
  }
  function paintThumb(el) {
    const entry = findCase(el.dataset.caseThumb);
    if (!entry) return;
    clearCaseThumb(el);
    if (previewUsesRealistic()) {
      paintRealisticThumb(el, entry);
      return;
    }
    caseThumb2D(el, entry);
  }
  // The card behind the dialog carries the preferred algorithm and its case, so
  // starring a different one has to reach it without rebuilding the page.
  function refreshCaseCard(entry) {
    const card = $$(".case-card").find((el) => el.dataset.case === entry.id);
    if (!card) return;
    $(".case-name", card).textContent = entry.name;
    $(".case-alg", card).textContent = favouriteAlg(entry).moves;
    const thumb = $("[data-case-thumb]", card);
    if (thumb) paintThumb(thumb);
  }
  function syncGroupChecks() {
    const set = activeSet();
    if (!set) return;
    $$("[data-group-check]").forEach((box) => {
      const cases = groupCases(set, box.dataset.groupCheck || null),
        picked = cases.filter((entry) => trainerSelection.has(entry.id)).length;
      box.checked = Boolean(cases.length) && picked === cases.length;
      box.indeterminate = picked > 0 && picked < cases.length;
    });
  }
  function refreshTrainBar() {
    const bar = $(".train-bar");
    if (!bar) return;
    $("strong", bar).textContent = trainerSelection.size;
    bar.hidden = trainerSelection.size < 2;
  }
  function pickCase(id, on) {
    if (on) trainerSelection.add(id);
    else trainerSelection.delete(id);
    const card = $$(".case-card").find((el) => el.dataset.case === id);
    if (card) {
      card.classList.toggle("picked", on);
      $("[data-case-check]", card).checked = on;
    }
    syncGroupChecks();
    refreshTrainBar();
  }
  function pickGroup(groupId, on) {
    const set = activeSet();
    if (!set) return;
    for (const entry of groupCases(set, groupId || null)) pickCase(entry.id, on);
  }
  // Thumbnails are drawn when they come into view: a large set stays as cheap
  // to open as a small one.
  function bindTrainer() {
    syncGroupChecks();
    trainerObserver?.disconnect();
    trainerResizeObserver?.disconnect();
    trainerThumbs = $$("[data-case-thumb]");
    trainerThumbs.forEach(bindCaseThumbOrbit);
    if (typeof ResizeObserver === "function") {
      trainerResizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) if (entry.target._caseThumb) queueCaseThumbDraw(entry.target);
      });
      trainerThumbs.forEach((el) => trainerResizeObserver.observe(el));
    }
    if (typeof IntersectionObserver !== "function") {
      trainerThumbs.forEach(paintThumb);
      return;
    }
    trainerObserver = new IntersectionObserver(
      (entries) => {
        for (const item of entries) {
          if (item.isIntersecting) {
            if (!item.target.firstElementChild) paintThumb(item.target);
          } else if (item.target.firstElementChild) clearCaseThumb(item.target);
        }
      },
      { rootMargin: "160px 0px" },
    );
    trainerThumbs.forEach((el) => trainerObserver.observe(el));
  }
  function caseStats(entry) {
    const s = entry.stats || emptyStats();
    if (!s.attempts) return "";
    return `<div class="case-stats"><div><span>Attempts</span><strong>${s.attempts}</strong></div><div><span>Best</span><strong>${fmt(s.best)}</strong></div><div><span>Mean</span><strong>${fmt(s.total / s.attempts)}</strong></div></div>`;
  }
  function openCase(id) {
    const set = activeSet(),
      entry = set?.cases.find((c) => c.id === id);
    if (!entry) return;
    caseDrawer = { setId: set.id, caseId: id, algId: favouriteAlg(entry).id };
    drawCaseDialog();
  }
  function drawCaseDialog() {
    const set = algSets().find((s) => s.id === caseDrawer?.setId),
      entry = set?.cases.find((c) => c.id === caseDrawer.caseId);
    if (!entry) {
      closeDialog();
      return;
    }
    const current =
      entry.algs.find((alg) => alg.id === caseDrawer.algId) || favouriteAlg(entry);
    caseDrawer.algId = current.id;
    const rows = entry.algs
      .map(
        (alg) =>
          `<div class="alg-row${alg.id === current.id ? " on" : ""}"><button class="alg-pick" data-alg-pick="${esc(alg.id)}" aria-pressed="${alg.id === current.id}">${esc(alg.moves)}</button><button class="icon-btn alg-star${alg.id === entry.favoriteId ? " on" : ""}" data-alg-star="${esc(alg.id)}" aria-pressed="${alg.id === entry.favoriteId}" aria-label="Preferred algorithm" title="Preferred algorithm">${icon("star")}</button>${entry.algs.length > 1 ? `<button class="icon-btn alg-remove" data-alg-delete="${esc(alg.id)}" aria-label="Remove this algorithm" title="Remove">${icon("trash")}</button>` : ""}</div>`,
      )
      .join("");
    showDialog(
      esc(entry.name),
      `<div class="case-layout"><div class="case-visual"><div id="case-cube"></div><div class="playback"><button class="icon-btn" data-cube="first" aria-label="Show the case">${icon("first")}</button><button class="icon-btn" data-cube="prev" aria-label="Previous move">${icon("left")}</button><button class="icon-btn play-btn" data-cube="play" aria-label="Play the algorithm">${icon("play")}</button><button class="icon-btn" data-cube="next" aria-label="Next move">${icon("chevron")}</button><button class="icon-btn" data-cube="last" aria-label="Show the solved cube">${icon("last")}</button></div><div id="scramble-notation" class="scramble-tokens"></div><label class="case-speed"><span>Speed</span><input type="range" min="20" max="240" step="10" value="${300 - pref.trainerSpeed}" data-control="trainer-speed" aria-label="Move speed"></label></div><div class="case-side">${caseStats(entry)}<div class="alg-list">${rows}</div><form class="alg-add" id="alg-add"><input name="moves" placeholder="Add an algorithm" autocomplete="off" spellcheck="false" maxlength="600" aria-label="Add an algorithm for this case"><button class="btn btn-quiet" type="submit">${icon("plus")}Add</button></form><p class="alg-error" id="alg-error" role="status"></p><div class="case-side-foot"><button class="icon-btn" data-action="manage-case" aria-label="Manage this case" title="Manage this case">${icon("more")}</button></div></div></div>`,
      "case-dialog",
    );
    mountCaseCube(current.moves);
    refreshCaseCard(entry);
    $("#alg-add").onsubmit = (e) => {
      e.preventDefault();
      addAlgorithm(entry, e.target.elements.moves.value.trim());
    };
  }
  function mountCaseCube(moves) {
    const token = ++caseLoadToken,
      mount = $("#case-cube");
    if (!mount) return;
    let setup = "",
      hold = "";
    try {
      setup = C.setup(moves);
      hold = C.hold(moves);
    } catch {
      mount.innerHTML =
        '<div class="empty-state"><strong>Algorithm unavailable</strong></div>';
      return;
    }
    beginCubeLoading(mount);
    // Two frames guarantee that the modal and placeholder are visible before
    // module work, geometry construction or shader compilation begins.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      setTimeout(() => {
        if (token !== caseLoadToken || !mount.isConnected || !$("#dialog").open) return;
        // The scene opens on the case and steps forward through the algorithm, so
        // the last move leaves a solved cube instead of a scrambled one.
        drawerScene = new CubeScene(
          mount,
          [hold, moves].filter(Boolean).join(" "),
          null,
          {
            setup: [CUBE_CROSSES[pref.cubeCross].rotation, setup].filter(Boolean).join(" "),
            speed: pref.trainerSpeed,
            fixedOrientation: true,
          },
        );
        drawerScene.onChange = updateNotation;
        if (pref.cubeMode === "net") drawerScene.setMode("net");
        updateNotation();
      }, 0);
    }));
  }
  function addAlgorithm(entry, moves) {
    const error = $("#alg-error");
    if (!moves) return;
    error.textContent = "";
    try {
      C.tokens(moves);
    } catch (e) {
      error.textContent = e.message;
      return;
    }
    if (entry.algs.some((alg) => alg.moves === moves)) {
      error.textContent = "This case already has that algorithm.";
      return;
    }
    if (C.solvesCase(moves, C.setup(favouriteAlg(entry).moves)) === null) {
      error.textContent = "That algorithm does not solve this case.";
      return;
    }
    const alg = { id: uid(), moves };
    entry.algs.push(alg);
    caseDrawer.algId = alg.id;
    persist();
    drawCaseDialog();
  }
  function removeAlgorithm(entry, algId) {
    if (entry.algs.length < 2) return;
    entry.algs = entry.algs.filter((alg) => alg.id !== algId);
    if (entry.favoriteId === algId) entry.favoriteId = entry.algs[0].id;
    if (caseDrawer.algId === algId) caseDrawer.algId = entry.favoriteId;
    persist();
    drawCaseDialog();
  }
  function manageCase() {
    const set = algSets().find((s) => s.id === caseDrawer?.setId),
      entry = set?.cases.find((c) => c.id === caseDrawer.caseId);
    if (!entry) return;
    const target = { setId: set.id, caseId: entry.id };
    showDialog(
      "Manage case",
      `<form id="case-manage"><div class="case-form-grid"><label class="field">Case name<input name="name" maxlength="60" value="${esc(entry.name)}" required autocomplete="off"></label>${set.groups.length ? `<label class="field">Group<select name="group">${set.groups.map((g) => `<option value="${esc(g.id)}"${g.id === entry.groupId ? " selected" : ""}>${esc(g.name)}</option>`).join("")}<option value=""${entry.groupId ? "" : " selected"}>Ungrouped</option></select></label>` : ""}</div><div class="error-text" id="form-error"></div><div class="dialog-actions"><button type="button" class="btn btn-quiet" data-action="delete-case">${icon("trash")}Delete case</button><button class="btn btn-dark" type="submit">Save ${icon("arrow")}</button></div></form>`,
    );
    caseDrawer = target;
    $("#case-manage").onsubmit = (e) => {
      e.preventDefault();
      const name = e.target.elements.name.value.trim();
      if (!name) return;
      entry.name = name;
      if (e.target.elements.group) entry.groupId = e.target.elements.group.value || null;
      persist();
      closeDialog();
      render();
    };
  }
  function deleteCase() {
    const set = algSets().find((s) => s.id === caseDrawer?.setId),
      entry = set?.cases.find((c) => c.id === caseDrawer.caseId);
    if (!entry) return;
    set.cases = set.cases.filter((c) => c.id !== entry.id);
    trainerSelection.delete(entry.id);
    caseDrawer = null;
    persist();
    closeDialog();
    render();
    toast(`Deleted ${entry.name}.`);
  }
  function newSet() {
    showDialog(
      "New alg set",
      `<p>A set holds the cases you drill together — one method, one step.</p><form id="set-form"><label class="field">Set name<input name="name" maxlength="80" placeholder="Name" required autofocus autocomplete="off"></label><div class="error-text" id="form-error"></div><div class="dialog-actions"><button type="button" class="btn btn-quiet" data-action="close-dialog">Cancel</button><button class="btn btn-dark" type="submit">Create set ${icon("arrow")}</button></div></form>`,
    );
    $("#set-form").onsubmit = (e) => {
      e.preventDefault();
      const name = e.target.elements.name.value.trim();
      if (!name) return;
      if (algSets().some((s) => s.name.toLowerCase() === name.toLowerCase())) {
        $("#form-error").textContent = "A set with this name already exists.";
        return;
      }
      const set = { id: uid(), name, builtin: null, groups: [], cases: [] };
      state.algSets = [...algSets(), set];
      pref.trainerSet = set.id;
      trainerSelection.clear();
      savePref();
      persist();
      closeDialog();
      render();
    };
  }
  function manageSet() {
    const set = activeSet();
    if (!set) return;
    const missing =
      typeof CT_TRAINER !== "undefined" &&
      CT_TRAINER.SETS.some(
        (seed) => !algSets().some((s) => s.builtin === seed.builtin),
      );
    showDialog(
      "Manage set",
      `<form id="set-rename"><label class="field">Set name<input name="name" maxlength="80" value="${esc(set.name)}" required autocomplete="off"></label><div class="error-text" id="form-error"></div><div class="dialog-actions"><button type="button" class="btn btn-quiet" data-action="delete-set">${icon("trash")}Delete set</button>${missing ? `<button type="button" class="btn btn-quiet" data-action="restore-sets">${icon("reset")}Restore built-in sets</button>` : ""}<button class="btn btn-dark" type="submit">Save ${icon("arrow")}</button></div></form>`,
    );
    $("#set-rename").onsubmit = (e) => {
      e.preventDefault();
      const name = e.target.elements.name.value.trim();
      if (!name) return;
      if (
        algSets().some(
          (s) => s.id !== set.id && s.name.toLowerCase() === name.toLowerCase(),
        )
      ) {
        $("#form-error").textContent = "A set with this name already exists.";
        return;
      }
      set.name = name;
      persist();
      closeDialog();
      render();
    };
  }
  function confirmDeleteSet() {
    const set = activeSet();
    if (!set) return;
    showDialog(
      "Delete set",
      `<p><strong>${esc(set.name)}</strong> and its ${set.cases.length} case${set.cases.length === 1 ? "" : "s"} will be removed, along with the times recorded for them.</p><div class="dialog-actions"><button class="btn btn-quiet" data-action="close-dialog">Keep it</button><button class="btn btn-danger" data-action="confirm-delete-set">Delete set</button></div>`,
      "delete-dialog",
    );
  }
  function deleteSet() {
    const set = activeSet();
    if (!set) return;
    state.algSets = algSets().filter((s) => s.id !== set.id);
    pref.trainerSet = algSets()[0]?.id || null;
    trainerSelection.clear();
    savePref();
    persist();
    closeDialog();
    render();
    toast(`Deleted ${set.name}.`);
  }
  function restoreSets() {
    if (typeof CT_TRAINER === "undefined") return;
    const restored = CT_TRAINER.SETS.filter(
      (seed) => !algSets().some((s) => s.builtin === seed.builtin),
    ).map(buildSeedSet);
    if (!restored.length) return;
    state.algSets = [...algSets(), ...restored];
    pref.trainerSet = restored[0].id;
    savePref();
    persist();
    closeDialog();
    render();
    toast(`Restored ${restored.map((s) => s.name).join(", ")}.`);
  }
  function newGroup() {
    const set = activeSet();
    if (!set) return;
    showDialog(
      "New group",
      `<form id="group-form"><label class="field">Group name<input name="name" maxlength="80" placeholder="Name" required autofocus autocomplete="off"></label><div class="error-text" id="form-error"></div><div class="dialog-actions"><button type="button" class="btn btn-quiet" data-action="close-dialog">Cancel</button><button class="btn btn-dark" type="submit">Create group ${icon("arrow")}</button></div></form>`,
    );
    $("#group-form").onsubmit = (e) => {
      e.preventDefault();
      const name = e.target.elements.name.value.trim();
      if (!name) return;
      if (set.groups.some((g) => g.name.toLowerCase() === name.toLowerCase())) {
        $("#form-error").textContent = "This set already has that group.";
        return;
      }
      set.groups.push({ id: uid(), name });
      persist();
      closeDialog();
      render();
    };
  }
  function newCaseDialog(groupId = "") {
    const set = activeSet();
    if (!set) return;
    const groups = set.groups;
    showDialog(
      "New case",
      `<p>The cube is scrambled with the algorithm reversed, so the case is exactly the one it solves.</p><form id="case-form"><div class="case-form-grid"><label class="field">Case name<input name="name" maxlength="60" placeholder="Name" required autofocus autocomplete="off"></label>${groups.length ? `<label class="field">Group<select name="group">${groups.map((g) => `<option value="${esc(g.id)}"${g.id === groupId ? " selected" : ""}>${esc(g.name)}</option>`).join("")}<option value="">Ungrouped</option></select></label>` : ""}</div><label class="field">Algorithm<input name="moves" placeholder="R U R' U'" required autocomplete="off" spellcheck="false" maxlength="600"></label><div class="error-text" id="form-error"></div><div class="dialog-actions"><button type="button" class="btn btn-quiet" data-action="close-dialog">Cancel</button><button class="btn btn-dark" type="submit">Add case ${icon("arrow")}</button></div></form>`,
    );
    $("#case-form").onsubmit = (e) => {
      e.preventDefault();
      const fields = e.target.elements,
        name = fields.name.value.trim(),
        moves = fields.moves.value.trim(),
        error = $("#form-error");
      if (!name || !moves) return;
      try {
        C.tokens(moves);
      } catch (err) {
        error.textContent = err.message;
        return;
      }
      const key = C.caseKey(moves),
        clash = set.cases.find(
          (entry) => C.caseKey(favouriteAlg(entry).moves) === key,
        );
      if (clash) {
        error.textContent = `This set already has that case, as ${clash.name}.`;
        return;
      }
      set.cases.push(newCase(name, fields.group?.value || null, [moves]));
      persist();
      closeDialog();
      render();
    };
  }
  const roundLength = (mode, count) =>
    mode === "every" ? trainerSelection.size * count : count;
  function trainNote(mode, count) {
    const n = roundLength(mode, Math.max(1, count || 1));
    return `${trainerSelection.size} cases · ${n} attempt${n === 1 ? "" : "s"}`;
  }
  function openTrainDialog() {
    if (trainerSelection.size < 2) return;
    const mode = pref.trainerMode === "every" ? "every" : "random",
      count = mode === "every" ? 1 : pref.trainerReps;
    showDialog(
      "Train",
      `<form id="train-form"><div class="train-config"><div class="segmented train-modes" role="group" aria-label="Round">${[
        ["random", "Random draw"],
        ["every", "Every case"],
      ]
        .map(
          ([id, label]) =>
            `<button type="button" class="${mode === id ? "active" : ""}" data-train-mode="${id}" aria-pressed="${mode === id}">${label}</button>`,
        )
        .join("")}</div><label class="field"><span id="train-count-label">${mode === "every" ? "Times per case" : "Attempts"}</span><input name="count" type="number" min="1" max="500" step="1" inputmode="numeric" value="${count}" required></label></div><p class="train-note" id="train-note">${trainNote(mode, count)}</p><div class="dialog-actions"><button type="button" class="btn btn-quiet" data-action="close-dialog">Cancel</button><button class="btn btn-dark" type="submit">${icon("play")}Start</button></div></form>`,
      "train-dialog",
    );
    const form = $("#train-form");
    form.dataset.mode = mode;
    form.onsubmit = (e) => {
      e.preventDefault();
      startRound(form.dataset.mode, Number(e.target.elements.count.value) || 1);
    };
  }
  function setTrainMode(mode) {
    const form = $("#train-form");
    if (!form) return;
    form.dataset.mode = mode;
    $$("[data-train-mode]", form).forEach((b) => {
      b.classList.toggle("active", b.dataset.trainMode === mode);
      b.setAttribute("aria-pressed", String(b.dataset.trainMode === mode));
    });
    $("#train-count-label").textContent =
      mode === "every" ? "Times per case" : "Attempts";
    const count = form.elements.count;
    count.value = mode === "every" ? 1 : pref.trainerReps;
    $("#train-note").textContent = trainNote(mode, Number(count.value));
  }
  function startRound(mode, count) {
    const set = activeSet();
    if (!set || typeof CT_TRAINER === "undefined") return;
    const ids = [...trainerSelection].filter((id) =>
        set.cases.some((entry) => entry.id === id),
      ),
      queue = CT_TRAINER.buildRound(ids, { mode, reps: count });
    if (!queue.length) return;
    pref.trainerMode = mode;
    if (mode === "random") pref.trainerReps = Math.max(1, Math.round(count));
    savePref();
    training = { setId: set.id, queue, index: 0, results: [], caseId: null, caseName: "", scramble: "" };
    if (!nextAttempt()) {
      training = null;
      return;
    }
    closeDialog(true);
    navigate("training");
  }
  // Each attempt draws one of the case's own algorithms and scrambles from it,
  // so a case with several algorithms is shown from several angles.
  function nextAttempt() {
    if (!training) return false;
    const set = algSets().find((s) => s.id === training.setId);
    while (training.index < training.queue.length) {
      const entry = set?.cases.find(
        (c) => c.id === training.queue[training.index],
      );
      if (entry) {
        const alg = entry.algs[Math.floor(Math.random() * entry.algs.length)];
        try {
          training.scramble = C.trainingScramble(alg.moves);
          training.caseId = entry.id;
          training.caseName = entry.name;
          return true;
        } catch {}
      }
      training.index++;
    }
    return false;
  }
  const trainingRows = () =>
    [...(training?.results || [])]
      .reverse()
      .map(
        (r, i) =>
          `<div class="round-row"><span>${training.results.length - i}</span><strong>${esc(r.name)}</strong><span class="time-cell">${fmt(r.seconds)}</span></div>`,
      )
      .join("") || '<p class="solve-empty">No attempts yet</p>';
  function trainingPage() {
    const total = training?.queue.length || 0,
      done = training?.results.length || 0,
      last = training?.results.at(-1);
    // No cube here on purpose: seeing the case would answer the question.
    return `<div class="focus-stage timer-card training-stage" data-state="${timer.phase}"><div class="training-head"><span class="chip">${esc(activeSet()?.name || "Trainer")}</span><span class="training-progress" id="training-progress">${Math.min(done + 1, total)} / ${total}</span><button class="btn btn-quiet" data-action="end-round">End round ${icon("close")}</button></div><div class="focus-main"><div class="focus-time"><div class="focus-scramble-wrap"><p class="focus-scramble" data-copyable>${esc(training?.scramble || "")}</p></div><button class="timer-surface" id="timer-surface" aria-label="Timer. ${pref.pressToStart ? "Press to start, press again to stop." : "Hold space or press and hold here, then release to start."}"><span class="timer-state sr-only" id="timer-state" role="status">READY</span><span class="timer-digits" id="timer-digits">${last ? fmt(last.seconds) : "0.00"}</span></button></div></div><aside class="solve-panel training-panel"><h2>This round</h2><div class="round-list" id="training-list">${trainingRows()}</div></aside></div>`;
  }
  function refreshTrainingAttempt(last) {
    if (!$(".training-stage")) {
      render();
      return;
    }
    $("#timer-digits").textContent = fmt(last);
    $(".focus-scramble").textContent = training.scramble;
    $("#training-progress").textContent = `${Math.min(training.results.length + 1, training.queue.length)} / ${training.queue.length}`;
    $("#training-list").innerHTML = trainingRows();
    revealScramble();
  }
  function finishTrainingAttempt() {
    const seconds = Math.floor((performance.now() - timer.start) / 10) / 100;
    cancelAnimationFrame(timer.raf);
    const set = algSets().find((s) => s.id === training.setId),
      entry = set?.cases.find((c) => c.id === training.caseId);
    if (entry) {
      const stats = (entry.stats = entry.stats || emptyStats());
      stats.attempts++;
      stats.total += seconds;
      stats.last = seconds;
      stats.best = stats.best == null ? seconds : Math.min(stats.best, seconds);
      stats.lastDate = new Date().toISOString();
      persist(true, true);
    }
    training.results.push({
      caseId: training.caseId,
      name: training.caseName,
      seconds,
    });
    setTimerPhase("stopped");
    training.index++;
    if (nextAttempt()) refreshTrainingAttempt(seconds);
    else endRound();
  }
  function endRound() {
    const results = training?.results || [];
    training = null;
    cancelAnimationFrame(timer.raf);
    setTimerPhase("idle");
    navigate("trainer");
    if (results.length) roundSummary(results);
  }
  function roundSummary(results) {
    const best = results.reduce((a, r) => Math.min(a, r.seconds), Infinity),
      mean = results.reduce((a, r) => a + r.seconds, 0) / results.length;
    showDialog(
      "Round complete",
      `<div class="case-stats"><div><span>Attempts</span><strong>${results.length}</strong></div><div><span>Best</span><strong>${fmt(best)}</strong></div><div><span>Mean</span><strong>${fmt(mean)}</strong></div></div><div class="round-list round-list-scroll">${results
        .map(
          (r, i) =>
            `<div class="round-row"><span>${i + 1}</span><strong>${esc(r.name)}</strong><span class="time-cell">${fmt(r.seconds)}</span></div>`,
        )
        .join("")}</div><div class="dialog-actions"><button class="btn btn-quiet" data-action="close-dialog">Done</button><button class="btn btn-dark" data-action="train">${icon("reset")}Again</button></div>`,
    );
  }
  function render(preserveEffects = false) {
    cancelSceneRefresh();
    cancelPanelRefresh();
    if (!preserveEffects) cancelAnimationFrame(demoRaf);
    if (!timerBusy() && !preserveEffects) motion?.clear();
    scene?.destroy();
    scene = null;
    lightingScene?.destroy();
    cubeStudio?.discardCube("cube-lighting-studio");
    lightingScene = null;
    panelObserver?.disconnect();
    panelObserver = null;
    libraryObserver?.disconnect();
    libraryObserver = null;
    trainerObserver?.disconnect();
    trainerObserver = null;
    trainerResizeObserver?.disconnect();
    trainerResizeObserver = null;
    trainerThumbs.forEach(clearCaseThumb);
    trainerThumbs = [];
    releasePreview();
    $("#chart-tooltip").hidden = true;
    const focused = view === "timer" || view === "effects",
      inRound = view === "training",
      immersive = focused || inRound || view === "lighting",
      scroll = keepPanel ? $("#solve-list")?.scrollTop || 0 : 0;
    if (!keepPanel) panelCount = PANEL_BATCH;
    keepPanel = false;
    $("#main").innerHTML = view === "lighting"
      ? lightingStudioPage()
      : inRound
      ? trainingPage()
      : focused
      ? view === "effects" ? effectsDemoPage() : focusPage()
      : banners() +
        `<div class="page-enter">${view === "overview" ? overview() : view === "trainer" ? trainer() : view === "solves" ? library() : insights()}</div>`;
    document.body.classList.toggle("focus-mode", immersive);
    document.body.classList.toggle("timer-view", focused || inRound);
    document.body.classList.toggle("lighting-mode", view === "lighting");
    document.body.classList.toggle("overview-view", view === "overview");
    renderSidebar();
    renderIcons();
    if ($("#cube-mount")) {
      scene = new CubeScene($("#cube-mount"), currentScramble);
      scene.onChange = updateNotation;
      if (pref.cubeMode === "net") scene.setMode("net");
      updateNotation();
    }
    if (view === "lighting" && lightingState && $("#cube-lighting-studio"))
      lightingScene = new CubeScene($("#cube-lighting-studio"), "R R'", lightingState);
    attachLiveCamera();
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
    else if (view === "trainer") bindTrainer();
    else if (inRound) {
      bindTimerSurface();
      requestAnimationFrame(() => {
        if (view === "training" && !$("#dialog").open)
          $("#timer-surface")?.focus({ preventScroll: true });
      });
    }
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

  // Where one sticker sits, in the page's own 3D space. Shared so a still case
  // preview is the same cube as the interactive one, minus the scene around it.
  function stickerMatrix(s) {
    const css = (v) => [v[0], -v[1], v[2]],
      r = css(s.right),
      d = css(s.down),
      n = css(s.n),
      p = css(s.p.map((v, j) => v * 46 + s.n[j] * 23));
    return `matrix3d(${[...r, 0, ...d, 0, ...n, 0, ...p, 1]
      .map((v) => (Math.abs(v) < 1e-9 ? 0 : v))
      .join(",")})`;
  }
  // The throbber is a 96px window over a sprite sheet; its <i> is translated
  // frame by frame. Transform animations run on the compositor, so the cube
  // keeps bouncing while the main thread is blocked importing three.js,
  // building geometry or compiling shaders.
  const CUBE_THROBBER = '<span class="cube-throbber" aria-hidden="true"><i></i></span>';
  function ensureCubeThrobber(mount) {
    let throbber = mount.querySelector(":scope > .cube-throbber");
    if (!throbber) {
      throbber = document.createElement("span");
      throbber.className = "cube-throbber";
      throbber.setAttribute("aria-hidden", "true");
      throbber.append(document.createElement("i"));
      mount.append(throbber);
    }
    return throbber;
  }
  function beginCubeLoading(mount) {
    if (!mount) return null;
    clearTimeout(mount._loadingTimer);
    mount._loadingTimer = 0;
    mount.classList.remove("cube-loading-out");
    mount.classList.add("cube-loading");
    const throbber = ensureCubeThrobber(mount);
    throbber.classList.remove("is-leaving");
    return throbber;
  }
  // Fade the throbber and its veil, then take the shell down. Interrupting with
  // beginCubeLoading restores both before the fade completes.
  function endCubeLoading(mount, onComplete) {
    if (!mount || !mount.classList.contains("cube-loading")) { onComplete?.(); return; }
    mount.classList.add("cube-loading-out");
    mount.querySelector(":scope > .cube-throbber")?.classList.add("is-leaving");
    clearTimeout(mount._loadingTimer);
    mount._loadingTimer = setTimeout(() => {
      mount._loadingTimer = 0;
      mount.classList.remove("cube-loading", "cube-loading-out");
      mount.querySelector(":scope > .cube-throbber")?.remove();
      onComplete?.();
    }, reduced ? 0 : 320);
  }
  // Yield long enough for a just-inserted throbber to reach the compositor
  // before a heavy synchronous build takes the main thread.
  function nextPaint() {
    return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }
  // True sticker coordinates drive both the 3D scene and the unfolded net.
  class CubeScene {
    constructor(mount, alg, appearance = null, options = {}) {
      this.mount = mount;
      this.alg = alg;
      this.appearance = appearance || pref;
      this.isStudio = options.studio ?? Boolean(appearance);
      // Only the cube beside the live timer keeps the scramble's fixed frame.
      // Every other cube is re-held so the user's preferred cross points down.
      this.fixedTimerOrientation = options.fixedOrientation ?? (mount.id === "cube-mount" && view === "timer");
      // A case scene opens on the scrambled case and steps forward through the
      // algorithm that solves it, rather than through a scramble.
      this.base = options.setup || "";
      this.moveDuration = options.speed || 72;
      this.entrance = options.entrance ?? (mount.classList.contains("focus-cube") &&
        (view === "effects" || (view === "timer" && pref.scrambleAnimation)));
      this.moves = [];
      this.index = 0;
      this.cube = new C.Cube();
      const orbit = this.appearance.cubeFinish === "standard" ? CUBE_ORBITS.standard : CUBE_ORBITS.threeD;
      this.pitch = orbit.pitch;
      this.yaw = orbit.yaw;
      this.defaultZoom = options.zoom ?? 1;
      this.zoom = this.defaultZoom;
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
        endCubeLoading(mount);
        return;
      }
      try {
        this.moves = C.tokens(alg);
        if (this.base) this.cube.apply(this.base);
        else if (!this.entrance) {
          this.cube.apply(alg);
          this.index = this.moves.length;
        }
      } catch (e) {
        mount.innerHTML = `<div class="empty-state"><strong>Scramble unavailable</strong>${esc(e.message)}</div>`;
        this.invalid = true;
        endCubeLoading(mount);
        return;
      }
      // innerHTML wipes any throbber the caller mounted for the loading shell;
      // keep the same node so its compositor animation never restarts.
      const pendingThrobber = mount.querySelector(":scope > .cube-throbber");
      mount.innerHTML = `<div class="cube-stage" data-mode="3d" tabindex="0" role="img" aria-label="3 by 3 cube, white up and green front. Drag or use arrow keys to rotate, click to switch to the flat net, Home to reset."><div class="cube-world"></div></div>`;
      if (pendingThrobber) mount.append(pendingThrobber);
      this.stage = $(".cube-stage", mount);
      // Which renderer this cube uses is known now, so the stage is marked
      // before its first paint. Deciding it only after the async renderer
      // resolved is what let the standard cube flash on screen first.
      this.slot = mount.id || "cube-mount";
      this.realisticWanted = this.appearance.cubeFinish !== "standard";
      if (this.realisticWanted) this.stage.classList.add("cube-realistic");
      // Spawning is independent of the scramble entrance: with the scramble
      // animation off the cube still materializes, it just appears already
      // scrambled. Tying the two together is what made the focus cube pop in
      // with no spawn animation whenever the preference was off.
      this.materializes = true;
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
      // setAppearance() ends the loading shell when the cube is actually on the
      // stage — immediately for the standard cube, after the renderer is up for a
      // 3D one. Both kinds therefore animate in and begin their scramble at the
      // same point in their own lifecycle, which is the whole of the fix: the
      // entrance used to start on a 60ms timer regardless, so a 3D cube spent
      // its animation on an empty stage and then stuttered when the renderer
      // finally blocked the main thread.
      this.setAppearance();
    }
    // The cube's first frame is on the stage: fade the loading shell out and
    // materialize the cube. A rebuild (a different model, quality or
    // environment) materializes again; palette-only changes leave it still.
    finishLoad() {
      if (this.disposed) return;
      const request = this.appearanceRequest;
      const reveal = () => {
        if (this.disposed || request !== this.appearanceRequest) return;
        const first = !this.started && !this.invalid;
        if (first) this.started = true;
        const identity = this.realisticIdentity;
        if (this.materializes && (first || identity !== this.materializedIdentity)) {
          this.materializedIdentity = identity;
          this.replayMaterialize();
        }
        if (first && this.entrance) this.startEntrance();
      };
      if (this.slot === "appearance-cube" || this.slot === "case-cube") endCubeLoading(this.mount, reveal);
      else { endCubeLoading(this.mount); reveal(); }
    }
    replayMaterialize() {
      const stage = this.stage;
      if (!stage) return;
      // Toggling the class is not enough: the browser can keep the same
      // animation alive and its clock keeps running during the rebuild, so the
      // cube is already back to full size by the first painted frame. Forcing
      // animation-name to `none`, reflowing, then restoring it restarts the
      // animation at the next frame instead.
      stage.classList.add("cube-materialize");
      stage.style.animation = "none";
      void stage.offsetWidth;
      stage.style.animation = "";
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
      cancelAnimationFrame(this.crossAnim);
      this.crossAnim = 0;
      this.crossRequest = (this.crossRequest || 0) + 1;
      const request = this.appearanceRequest = (this.appearanceRequest || 0) + 1;
      const colors = CUBE_PALETTES[this.appearance.cubePalette].colors;
      this.elements.forEach((el, i) => { el.style.background = colors[this.cube.stickers[i].face]; });
      if (this.mode === "net") this.drawNet();
      this.stage.setAttribute("aria-label", "3 by 3 cube. Drag or use arrow keys to rotate, click to switch to the flat net, Home to reset.");
      this.realisticWanted = this.appearance.cubeFinish !== "standard";
      // A model, quality, environment, wear or core change rebuilds the whole
      // renderer and blocks the main thread. Only that path earns the loading
      // shell; palette or cross tweaks adopt the live cube and stay instant.
      const identity = [this.appearance.cubeFinish, this.appearance.cubeQuality, this.appearance.cubeEnvironment, this.appearance.cubeWear ? 1 : 0, this.appearance.cubeCore ?? pref.cubeCore].join("|");
      const rebuild = identity !== this.realisticIdentity || !this.realistic || this.realistic.disposed;
      this.realisticIdentity = identity;
      if (!this.realisticWanted) {
        if (this.slot === "appearance-cube") cubeStudio?.releaseCube(this.slot);
        else cubeStudio?.discardCube(this.slot);
        this.realistic = null;
        this.stage.classList.remove("cube-realistic");
        this.draw();
        this.finishLoad();
        return;
      }
      // Marked before the await, not after it: in the gap while the renderer
      // loads the stage must already be hiding the standard cube, or switching
      // to a 3D model shows the standard one first.
      this.stage.classList.add("cube-realistic");
      let phase = "load";
      try {
        const studio = cubeStudio || (cubeStudio = await import("./cube-realistic.js"));
        phase = "render";
        if (this.disposed || request !== this.appearanceRequest) return;
        if (rebuild && (this.started || this.mount.classList.contains("cube-loading"))) {
          // Show the throbber and let it paint before the build blocks the
          // thread; the transform animation then rides the compositor.
          beginCubeLoading(this.mount);
          await nextPaint();
          if (this.disposed || request !== this.appearanceRequest) return;
        }
        // Quality, model and environment are baked into the renderer's targets,
        // materials and geometry, so acquireCube rebuilds when any of them
        // changes and otherwise adopts the slot's existing renderer — which is
        // what makes a new scramble cost a resize instead of a WebGL context and
        // a shader compile.
        const current = () => !this.disposed && request === this.appearanceRequest;
        this.realistic = studio.acquireCube(this.slot, this.stage, () => { if (current()) this.fallbackAppearance(); }, this.appearance.cubeFinish, this.appearance.cubeQuality, this.appearance.cubeEnvironment, this.appearance.cubeWear, this.appearance.cubeCore ?? pref.cubeCore, () => { if (current()) this.finishLoad(); });
        this.realistic.setPalette(CUBE_PALETTES[this.appearance.cubePalette].colors);
        if (this.isStudio && this.appearance.values) this.realistic.setTuning(this.appearance.values);
        this.draw();
        this.orbit();
        // A photographic environment draws its first frame when the photograph
        // lands, not now; the spawn animation waits for that frame.
        if (this.appearance.cubeEnvironment === "studio" || this.realistic.scene.environment) this.finishLoad();
      } catch (error) {
        if (!this.disposed && request === this.appearanceRequest) {
          console.warn(`CubeTracker 3D ${phase} failed:`, error);
          this.fallbackAppearance(phase);
        }
      }
    }
    fallbackAppearance(reason = "render") {
      // A lost context has already dropped the cube from its slot, so
      // discardCube alone finds nothing to destroy and the dead canvas would
      // stay on the stage in front of the standard preview.
      this.realistic?.destroy();
      cubeStudio?.discardCube(this.slot);
      this.realistic = null;
      this.realisticWanted = false;
      this.stage.classList.remove("cube-realistic");
      this.draw();
      this.finishLoad();
      const status = $("#cube-finish-status");
      if (status) status.textContent = reason === "load"
        ? "The cube could not load. Reload the app; if this continues, restart CubeTracker."
        : "Realistic rendering is unavailable on this device. Showing the standard preview.";
    }
    draw(spec = null, fraction = 0, crossOverride = null, specAlreadyOriented = false) {
      if (this.invalid || this.disposed) return;
      if (this.mode === "net") {
        this.drawNet();
        return;
      }
      const cross = crossOverride ?? (this.fixedTimerOrientation ? "D" : (this.appearance.cubeCross ?? pref.cubeCross)),
        stickers = orientedStickers(this.cube.stickers, cross),
        shownSpec = specAlreadyOriented ? spec : orientedMoveSpec(spec, cross);
      if (this.realistic) {
        this.realistic.draw(stickers, shownSpec, fraction);
        return;
      }
      stickers.forEach((st, i) => {
        let s = st;
        if (shownSpec && shownSpec.select(st.p)) {
          s = { ...st };
          for (const k of ["p", "n", "right", "down"])
            s[k] = C.rotate(st[k], shownSpec.axis, shownSpec.angle * fraction);
        }
        this.elements[i].style.transform = stickerMatrix(s);
      });
    }
    orbit() {
      this.realistic?.orbit(this.pitch, this.yaw, this.zoom);
      if (this.world)
        this.world.style.transform = `scale3d(${this.zoom},${this.zoom},${this.zoom}) rotateX(${this.pitch}deg) rotateY(${this.yaw}deg)`;
    }
    drawNet() {
      const cross = this.fixedTimerOrientation ? "D" : (this.appearance.cubeCross ?? pref.cubeCross),
        f = faceletsFromStickers(orientedStickers(this.cube.stickers, cross));
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
            `<div class="net-face" style="grid-column:${col};grid-row:${row}" title="${face} face">${f[face].map((c) => `<span style="background:${CUBE_PALETTES[this.appearance.cubePalette].colors[c]}"></span>`).join("")}</div>`,
        )
        .join("");
    }
    animateCross(from, to) {
      cancelAnimationFrame(this.crossAnim);
      const spec = crossTransitionSpec(from, to);
      if (!spec || reduced || this.mode === "net" || this.invalid || this.disposed) {
        this.draw();
        return;
      }
      const request = this.crossRequest = (this.crossRequest || 0) + 1,
        started = performance.now(),
        duration = 420;
      const frame = now => {
        if (this.disposed || request !== this.crossRequest) return;
        const progress = Math.min(1, (now - started) / duration),
          eased = 1 - Math.pow(1 - progress, 3);
        this.draw(spec, eased, from, true);
        if (progress < 1) this.crossAnim = requestAnimationFrame(frame);
        else {
          this.crossAnim = 0;
          this.draw();
        }
      };
      this.crossAnim = requestAnimationFrame(frame);
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
    beginStudioInteraction() {
      if (!this.isStudio) return;
      clearTimeout(this.interactionTimer);
      this.realistic?.setInteractionActive(true);
    }
    endStudioInteraction(delay = 90) {
      if (!this.isStudio) return;
      clearTimeout(this.interactionTimer);
      this.interactionTimer = setTimeout(() => {
        this.interactionTimer = 0;
        this.realistic?.setInteractionActive(false);
      }, delay);
    }
    bind() {
      this.stage.addEventListener("pointerdown", (e) => {
        if (e.target.closest("button")) return;
        this.press = { x: e.clientX, y: e.clientY, moved: false };
        if (this.mode === "net") return;
        this.stage.setPointerCapture(e.pointerId);
        cancelAnimationFrame(this.inertia);
        this.beginStudioInteraction();
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
        if (!this.isStudio) this.orbit();
        else if (!this.studioOrbitRaf) this.studioOrbitRaf = requestAnimationFrame(() => {
          this.studioOrbitRaf = 0;
          this.orbit();
        });
      });
      const end = () => {
        const tap = this.press && !this.press.moved;
        this.press = null;
        this.drag = null;
        this.releaseFocus();
        if (tap && !this.isStudio) {
          this.toggleMode();
          return;
        }
        const tick = () => {
          if (this.disposed || reduced) {
            this.endStudioInteraction();
            return;
          }
          this.velocity *= 0.91;
          this.yaw += this.velocity;
          this.orbit();
          if (Math.abs(this.velocity) > 0.03)
            this.inertia = requestAnimationFrame(tick);
          else this.endStudioInteraction();
        };
        tick();
      };
      this.stage.addEventListener("pointerup", end);
      this.stage.addEventListener("pointercancel", () => {
        this.drag = null;
        this.press = null;
        cancelAnimationFrame(this.studioOrbitRaf);
        this.studioOrbitRaf = 0;
        this.endStudioInteraction();
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
          const orbit = this.appearance.cubeFinish === "standard" ? CUBE_ORBITS.standard : CUBE_ORBITS.threeD;
          this.pitch = orbit.pitch;
          this.yaw = orbit.yaw;
          this.zoom = this.defaultZoom;
        } else if (e.key === "ArrowLeft") this.yaw -= 15;
        else if (e.key === "ArrowRight") this.yaw += 15;
        else if (e.key === "ArrowUp")
          this.pitch = Math.max(-85, this.pitch - 15);
        else this.pitch = Math.min(85, this.pitch + 15);
        this.orbit();
      });
      if (this.isStudio) this.stage.addEventListener("wheel", (e) => {
        e.preventDefault();
        this.setZoom(this.zoom * Math.exp(-e.deltaY * .0012));
      }, { passive: false });
    }
    setZoom(value) {
      this.beginStudioInteraction();
      this.zoom = Math.max(.55, Math.min(1.8, Number(value) || 1));
      this.orbit();
      this.endStudioInteraction(120);
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
        duration = reduced ? 0 : this.moveDuration;
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
      this.cube = new C.Cube().apply(
        [this.base, this.moves.slice(0, this.index).join(" ")]
          .filter(Boolean)
          .join(" "),
      );
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
      const animatedRenderer = this.realistic;
      animatedRenderer?.setAnimationActive(true);
      try {
        while (this.playing && this.index < this.moves.length && !this.disposed) {
          await this.step(1);
          if (!this.disposed && !reduced) await new Promise((r) => setTimeout(r, 8));
        }
      } finally {
        animatedRenderer?.setAnimationActive(false);
        // The moving frames are intentionally cheaper; leave the completed cube
        // as a full-resolution Cinematic still.
        if (!this.disposed) this.draw();
      }
      this.playing = false;
      this.onChange?.();
    }
    destroy() {
      this.disposed = true;
      this.playing = false;
      endCubeLoading(this.mount);
      clearTimeout(this.entranceTimer);
      cancelAnimationFrame(this.anim);
      cancelAnimationFrame(this.inertia);
      cancelAnimationFrame(this.studioOrbitRaf);
      cancelAnimationFrame(this.crossAnim);
      clearTimeout(this.interactionTimer);
      this.finishAnimation?.();
      // Parked, not destroyed: the next scene mounted in this slot adopts the
      // same renderer. The context is only given up when the model or quality
      // changes, or when the mount goes away for good (discardCube).
      if (this.realistic) cubeStudio?.releaseCube(this.slot);
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
      // The cube stays on the stage for the death animation. Destroying the
      // renderer first — which is what used to happen here — pulled the canvas
      // out of the DOM before the animation had a chance to run, so a 3D cube
      // simply vanished where the standard one drops away. The stage animates
      // whatever is inside it; it just has to still be there.
      const park = () => {
        if (this.realistic) cubeStudio?.releaseCube(this.slot);
        this.realistic = null;
      };
      this.stage.classList.add("cube-death");
      if (reduced) { park(); return Promise.resolve(); }
      return new Promise((resolve) => {
        let done = false;
        const finish = (event) => {
          if (event && event.animationName !== "cube-death") return;
          if (done) return;
          done = true;
          park();
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

  // Video is deliberately kept outside the solve JSON. Server mode streams one
  // file per solve to disk; standalone mode uses IndexedDB, whose quota is much
  // better suited to blobs than localStorage. Recording is started synchronously
  // from the timer input path after the selected camera has been warmed up.
  const videoCapture = {
    stream: null,
    streamKey: "",
    preparing: null,
    recorder: null,
    session: null,
    devices: [],
    error: "",
    startOnRelease: false,
  };
  const videoJobs = new Map(),
    videoDeleteTimers = new Map();
  let videoDbPromise = null,
    solveVideoUrl = "";

  function videoSupported() {
    return Boolean(
      globalThis.navigator?.mediaDevices?.getUserMedia &&
        globalThis.MediaRecorder,
    );
  }
  function cameraStreamLive() {
    return Boolean(
      videoCapture.stream?.getVideoTracks().some((track) => track.readyState === "live"),
    );
  }
  function captureKey() {
    return `${pref.cameraDeviceId}|${pref.videoResolution}|${pref.videoFps}`;
  }
  function cameraConstraints(useSelectedDevice = true) {
    const mode = VIDEO_RESOLUTIONS[pref.videoResolution];
    return {
      audio: false,
      video: {
        ...(useSelectedDevice && pref.cameraDeviceId
          ? { deviceId: { exact: pref.cameraDeviceId } }
          : {}),
        width: { ideal: mode.width, max: mode.width },
        height: { ideal: mode.height, max: mode.height },
        frameRate: { ideal: pref.videoFps, max: pref.videoFps },
      },
    };
  }
  function stopCameraStream() {
    videoCapture.stream?.getTracks().forEach((track) => track.stop());
    videoCapture.stream = null;
    videoCapture.streamKey = "";
    const feed = $("#live-camera-feed");
    if (feed) feed.srcObject = null;
  }
  async function listCameraDevices() {
    if (!globalThis.navigator?.mediaDevices?.enumerateDevices) return [];
    try {
      videoCapture.devices = (await navigator.mediaDevices.enumerateDevices()).filter(
        (device) => device.kind === "videoinput",
      );
    } catch {
      videoCapture.devices = [];
    }
    refreshCameraSettingsUI();
    return videoCapture.devices;
  }
  function attachLiveCamera() {
    const feed = $("#live-camera-feed");
    if (!feed || !cameraStreamLive()) return;
    if (feed.srcObject !== videoCapture.stream) feed.srcObject = videoCapture.stream;
    const settings = videoCapture.stream.getVideoTracks()[0]?.getSettings?.() || {};
    if (settings.width && settings.height)
      feed.parentElement?.style.setProperty("--camera-aspect", `${settings.width} / ${settings.height}`);
    feed.play().catch(() => {});
  }
  async function ensureCameraReady() {
    if (!pref.videoRecording) return false;
    if (!videoSupported()) {
      videoCapture.error = "Video recording is not supported by this browser.";
      refreshCameraSettingsUI();
      return false;
    }
    if (cameraStreamLive() && videoCapture.streamKey === captureKey()) {
      attachLiveCamera();
      return true;
    }
    if (videoCapture.preparing) return videoCapture.preparing;
    videoCapture.error = "";
    refreshCameraSettingsUI(true);
    videoCapture.preparing = (async () => {
      stopCameraStream();
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(cameraConstraints(true));
      } catch (error) {
        // A saved device can disappear between sessions. Fall back to the
        // system default while retaining the requested resolution and fps.
        if (pref.cameraDeviceId && ["NotFoundError", "OverconstrainedError"].includes(error?.name)) {
          pref.cameraDeviceId = "";
          savePref();
          stream = await navigator.mediaDevices.getUserMedia(cameraConstraints(false));
        } else throw error;
      }
      if (!pref.videoRecording) {
        stream.getTracks().forEach((track) => track.stop());
        return false;
      }
      videoCapture.stream = stream;
      const track = stream.getVideoTracks()[0],
        settings = track?.getSettings?.() || {};
      if (!pref.cameraDeviceId && settings.deviceId) {
        pref.cameraDeviceId = settings.deviceId;
        savePref();
      }
      videoCapture.streamKey = captureKey();
      track?.addEventListener?.("ended", () => {
        if (videoCapture.stream !== stream) return;
        videoCapture.error = "The selected camera disconnected.";
        discardVideoRecording();
        stopCameraStream();
        refreshCameraSettingsUI();
      });
      attachLiveCamera();
      await listCameraDevices();
      return true;
    })()
      .catch((error) => {
        stopCameraStream();
        videoCapture.error =
          error?.name === "NotAllowedError"
            ? "Camera access was denied. Allow it in the browser, then try again."
            : `Could not open the camera${error?.message ? `: ${error.message}` : "."}`;
        refreshCameraSettingsUI();
        return false;
      })
      .finally(() => {
        videoCapture.preparing = null;
        refreshCameraSettingsUI();
      });
    return videoCapture.preparing;
  }
  function cameraReadyForAttempt() {
    if (!pref.videoRecording) return true;
    if (cameraStreamLive() && videoSupported()) return true;
    ensureCameraReady();
    toast(
      videoCapture.error || "Camera is getting ready. Try again in a moment.",
      Boolean(videoCapture.error),
    );
    return false;
  }
  function preferredVideoType() {
    const supported = globalThis.MediaRecorder?.isTypeSupported?.bind(globalThis.MediaRecorder);
    if (!supported) return "";
    return [
      "video/webm;codecs=vp8",
      "video/webm",
      "video/mp4;codecs=avc1.42E01E",
      "video/mp4",
    ].find((type) => supported(type)) || "";
  }
  function startVideoRecording() {
    if (!pref.videoRecording || videoCapture.recorder?.state === "recording") return false;
    if (!cameraStreamLive()) return false;
    try {
      const mode = VIDEO_RESOLUTIONS[pref.videoResolution],
        type = preferredVideoType(),
        trackSettings = videoCapture.stream.getVideoTracks()[0]?.getSettings?.() || {},
        bits = Math.round(mode.bitrate * ((trackSettings.frameRate || pref.videoFps) >= 50 ? 1.35 : 1)),
        recorder = new MediaRecorder(videoCapture.stream, {
          ...(type ? { mimeType: type } : {}),
          videoBitsPerSecond: bits,
        }),
        session = {
          recorder,
          chunks: [],
          mimeType: recorder.mimeType || type || "video/webm",
          width: trackSettings.width || mode.width,
          height: trackSettings.height || mode.height,
          fps: trackSettings.frameRate || pref.videoFps,
          solve: null,
          discard: false,
        };
      videoCapture.recorder = recorder;
      videoCapture.session = session;
      videoCapture.startOnRelease = false;
      recorder.addEventListener("dataavailable", (event) => {
        if (event.data?.size) session.chunks.push(event.data);
      });
      recorder.addEventListener("error", () => {
        videoCapture.error = "The camera stopped recording unexpectedly.";
      });
      recorder.addEventListener("stop", () => finalizeVideoSession(session));
      recorder.start(1000);
      document.body.classList.add?.("recording-video");
      attachLiveCamera();
      refreshCameraSettingsUI();
      return true;
    } catch (error) {
      videoCapture.error = `Could not start recording${error?.message ? `: ${error.message}` : "."}`;
      refreshCameraSettingsUI();
      toast(videoCapture.error, true);
      return false;
    }
  }
  const VIDEO_TAIL_MS = 1000;
  // The threshold judges the solve, not the clip: a slow attempt is dropped and
  // still saved as a solve without video. DNFs are always kept — they are the
  // ones worth watching back.
  function overVideoThreshold(solve) {
    const limit = Number(pref.videoMaxSeconds) || 0;
    if (!limit || !solve || solve.penalty === "DNF") return false;
    return solve.rawMs > limit * 1000;
  }
  function stopVideoRecording(solve = null, discard = false) {
    videoCapture.startOnRelease = false;
    const recorder = videoCapture.recorder,
      session = videoCapture.session;
    document.body.classList.remove?.("recording-video");
    if (!recorder || !session) return;
    session.solve = solve;
    session.discard = discard || !solve || overVideoThreshold(solve);
    videoCapture.recorder = null;
    videoCapture.session = null;
    const stopNow = () => {
      try {
        if (recorder.state !== "inactive") recorder.stop();
        else finalizeVideoSession(session);
      } catch {
        session.discard = true;
        finalizeVideoSession(session);
      }
    };
    if (session.discard) stopNow();
    else setTimeout(stopNow, VIDEO_TAIL_MS);
    refreshCameraSettingsUI();
  }
  function discardVideoRecording() {
    stopVideoRecording(null, true);
  }
  function openVideoDb() {
    if (videoDbPromise) return videoDbPromise;
    videoDbPromise = new Promise((resolve, reject) => {
      if (!globalThis.indexedDB) {
        reject(new Error("Browser video storage is unavailable."));
        return;
      }
      const request = indexedDB.open("cubetracker.videos.v1", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("videos");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Could not open video storage."));
    });
    return videoDbPromise;
  }
  async function browserVideoRequest(mode, id, blob) {
    const db = await openVideoDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("videos", mode === "get" ? "readonly" : "readwrite"),
        store = tx.objectStore("videos"),
        request = mode === "put" ? store.put(blob, id) : mode === "delete" ? store.delete(id) : store.get(id);
      request.onerror = () => reject(request.error || new Error("Video storage failed."));
      if (mode === "get") request.onsuccess = () => resolve(request.result || null);
      else tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("Video storage failed."));
    });
  }
  function enqueueVideoJob(id, work) {
    const previous = videoJobs.get(id) || Promise.resolve(),
      job = previous.catch(() => {}).then(work);
    videoJobs.set(id, job);
    job.then(
      () => { if (videoJobs.get(id) === job) videoJobs.delete(id); },
      () => { if (videoJobs.get(id) === job) videoJobs.delete(id); },
    );
    return job;
  }
  async function storeSolveVideo(id, blob) {
    if (server) {
      const response = await fetch(`/api/videos/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": blob.type || "video/webm" },
        body: blob,
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          response.status === 405
            ? "The local saver is still running an older CubeTracker version. Close and reopen CubeTracker, then record the solve again."
            : result.error || "Could not save the video.",
        );
      return result;
    }
    await browserVideoRequest("put", id, blob);
    globalThis.navigator?.storage?.persist?.().catch?.(() => {});
    return { size: blob.size, mimeType: blob.type || "video/webm" };
  }
  async function removeStoredVideo(id) {
    if (server) {
      const response = await fetch(`/api/videos/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!response.ok && response.status !== 404) throw new Error("Could not delete the video.");
      return;
    }
    await browserVideoRequest("delete", id);
  }
  function findSolveAnywhere(id) {
    for (const category of state.categories) {
      const solve = category.solves.find((item) => item.id === id);
      if (solve) return solve;
    }
    return null;
  }
  // A recording whose file is gone: drop the pointer so the solve simply reads
  // as a solve without video instead of one with a broken player.
  function forgetSolveVideo(id) {
    const solve = findSolveAnywhere(id);
    if (!solve?.video) return;
    delete solve.video;
    persist(true, true);
    for (const badge of document.querySelectorAll(`[data-solve="${CSS.escape(id)}"] .solve-video-badge`))
      badge.remove();
  }
  function finalizeVideoSession(session) {
    if (session._finalized) return;
    session._finalized = true;
    if (session.discard || !session.solve) return;
    const blob = new Blob(session.chunks, { type: session.mimeType });
    session.chunks.length = 0;
    if (!blob.size) return;
    const id = session.solve.id;
    enqueueVideoJob(id, async () => {
      try {
        const saved = await storeSolveVideo(id, blob),
          solve = findSolveAnywhere(id);
        if (!solve) {
          await removeStoredVideo(id);
          return;
        }
        solve.video = {
          mimeType: saved.mimeType || blob.type || "video/webm",
          size: saved.size || blob.size,
          width: session.width,
          height: session.height,
          fps: session.fps,
        };
        persist(true, true);
        refreshSolveVideoBadge(id);
        if (drawerId === id) mountSolveVideo(solve);
      } catch (error) {
        toast(error?.message || "The solve was saved, but its video could not be stored.", true);
      }
    });
  }
  function scheduleVideoDeletion(id) {
    clearTimeout(videoDeleteTimers.get(id));
    videoDeleteTimers.set(id, setTimeout(() => {
      videoDeleteTimers.delete(id);
      enqueueVideoJob(id, () => removeStoredVideo(id).catch(() => {}));
    }, 4000));
  }
  function cancelVideoDeletion(id) {
    clearTimeout(videoDeleteTimers.get(id));
    videoDeleteTimers.delete(id);
  }
  function disposeSolveVideoUrl() {
    if (!solveVideoUrl) return;
    URL.revokeObjectURL(solveVideoUrl);
    solveVideoUrl = "";
  }
  async function mountSolveVideo(solve) {
    const player = $("#solve-video");
    if (!player || !solve?.video) return;
    disposeSolveVideoUrl();
    try {
      if (server) {
        const head = await fetch(`/api/videos/${encodeURIComponent(solve.id)}`, { method: "HEAD" });
        if (head.status === 404) {
          forgetSolveVideo(solve.id);
          throw new Error("The video file is gone. This solve now counts as one without video.");
        }
        player.src = `/api/videos/${encodeURIComponent(solve.id)}`;
      } else {
        const blob = await browserVideoRequest("get", solve.id);
        if (!blob) {
          forgetSolveVideo(solve.id);
          throw new Error("The video file is gone. This solve now counts as one without video.");
        }
        if (!player.isConnected) throw new Error("This recording is unavailable.");
        solveVideoUrl = URL.createObjectURL(blob);
        player.src = solveVideoUrl;
      }
      const toggle = () => {
        if (player.paused) player.play().catch(() => {});
        else player.pause();
      };
      // Hold the left button to watch at half speed; a plain click still toggles.
      let holdTimer = 0,
        slowed = false;
      const stopSlow = () => {
        clearTimeout(holdTimer);
        holdTimer = 0;
        if (!slowed) return;
        player.playbackRate = 1;
        player.parentElement?.classList.remove("slow-motion");
      };
      player.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        slowed = false;
        clearTimeout(holdTimer);
        holdTimer = setTimeout(() => {
          slowed = true;
          player.playbackRate = 0.5;
          player.parentElement?.classList.add("slow-motion");
          if (player.paused) player.play().catch(() => {});
        }, 250);
      });
      for (const type of ["pointerup", "pointercancel", "pointerleave"])
        player.addEventListener(type, stopSlow);
      player.addEventListener("click", (event) => {
        if (slowed) {
          slowed = false;
          event.preventDefault();
          return;
        }
        toggle();
      });
      player.addEventListener("keydown", (event) => {
        if (!["Enter", " "].includes(event.key)) return;
        event.preventDefault();
        toggle();
      });
      player.addEventListener("play", () => player.parentElement?.classList.remove("paused"));
      player.addEventListener("pause", () => player.parentElement?.classList.add("paused"));
      player.addEventListener("error", () => {
        const status = $(".solve-video-status", player.parentElement);
        if (status) status.textContent = "Video unavailable";
      });
      player.play().catch(() => player.parentElement?.classList.add("paused"));
    } catch (error) {
      const status = $(".solve-video-status", player.parentElement);
      if (status) status.textContent = error?.message || "Video unavailable";
    }
  }
  function refreshCameraSettingsUI(preparing = false) {
    const section = $(".camera-settings"),
      enabled = $("[data-control='video-recording']"),
      device = $("[data-control='camera-device']"),
      resolution = $("[data-control='video-resolution']"),
      fps = $("[data-control='video-fps']"),
      maxSeconds = $("[data-control='video-max-seconds']"),
      recordInspection = $("[data-control='video-record-inspection']"),
      status = $("#camera-status");
    if (!section) return;
    if (enabled) enabled.checked = pref.videoRecording;
    section.classList.toggle("enabled", pref.videoRecording);
    for (const field of [device, resolution, fps]) if (field) field.disabled = !pref.videoRecording || preparing;
    if (recordInspection) {
      recordInspection.checked = pref.videoRecordInspection;
      recordInspection.disabled = !pref.videoRecording;
    }
    if (maxSeconds) {
      maxSeconds.disabled = !pref.videoRecording;
      if (document.activeElement !== maxSeconds) maxSeconds.value = pref.videoMaxSeconds || "";
    }
    if (resolution) resolution.value = pref.videoResolution;
    if (fps) fps.value = String(pref.videoFps);
    if (device) {
      const devices = videoCapture.devices,
        selectedPresent = devices.some((item) => item.deviceId === pref.cameraDeviceId);
      device.innerHTML = devices.length
        ? devices.map((item, index) => `<option value="${esc(item.deviceId)}"${item.deviceId === pref.cameraDeviceId ? " selected" : ""}>${esc(item.label || `Camera ${index + 1}`)}</option>`).join("")
        : `<option value="">${pref.videoRecording ? "Detecting cameras…" : "Enable recording first"}</option>`;
      if (!selectedPresent && pref.cameraDeviceId)
        device.insertAdjacentHTML("afterbegin", `<option value="${esc(pref.cameraDeviceId)}" selected>Selected camera</option>`);
    }
    if (!status) return;
    status.classList.toggle("error", Boolean(videoCapture.error));
    if (!videoSupported()) status.textContent = "This browser cannot record video.";
    else if (!pref.videoRecording) status.textContent = "Camera stays off until recording is enabled.";
    else if (preparing || videoCapture.preparing) status.textContent = "Opening camera…";
    else if (videoCapture.error) status.textContent = videoCapture.error;
    else if (cameraStreamLive()) {
      const actual = videoCapture.stream.getVideoTracks()[0]?.getSettings?.() || {};
      status.textContent = `${actual.width || "—"}×${actual.height || "—"} · ${Math.round(actual.frameRate || pref.videoFps)} fps · ready`;
    } else status.textContent = "Camera is not ready.";
  }

  // Timing uses a monotonic clock. Pointer and keyboard share one state machine.
  function timerBusy() {
    return ["holding", "ready", "running", "inspection"].includes(timer.phase);
  }
  function setTimerPhase(phase) {
    const previous = timer.phase;
    timer.phase = phase;
    if (phase === "stopped")
      timer.restartAt = performance.now() + TIMER_RESTART_COOLDOWN_MS;
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
    if (!["timer", "training"].includes(view) || $("#dialog").open) return;
    const drilling = view === "training";
    if (!drilling && scramblePending) {
      toast("Preparing scramble…");
      return;
    }
    if (timer.phase === "running") {
      finishSolve();
      timer.blockedRelease = true;
      return;
    }
    if (timer.phase === "stopped" && performance.now() < timer.restartAt) return;
    if (timer.phase === "holding" || timer.phase === "ready") return;
    if (!drilling && (!active() || demo)) {
      openCategory("Create a category to start recording.");
      return;
    }
    if (!drilling && !cameraReadyForAttempt()) return;
    if (["idle", "stopped"].includes(timer.phase)) {
      if (!drilling) recordProfile();
      motion?.clear();
    }
    // Inspection is never used while drilling: the scramble already names the
    // case, so there is nothing to inspect.
    if (!drilling && pref.inspection && (timer.phase === "idle" || timer.phase === "stopped")) {
      // With "Record inspection" off the clip begins with the solve itself,
      // not with the inspection countdown.
      if (pref.videoRecordInspection) startVideoRecording();
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
      if (!drilling && pref.videoRecording && (!pref.inspection || !pref.videoRecordInspection))
        videoCapture.startOnRelease = true;
      return;
    }
    if (!drilling && (!pref.inspection || !pref.videoRecordInspection))
      startVideoRecording();
    setTimerPhase("holding");
    timer.hold = setTimeout(() => setTimerPhase("ready"), 350);
  }
  function releaseHold() {
    if (timer.blockedRelease) {
      timer.blockedRelease = false;
      if (videoCapture.startOnRelease) startVideoRecording();
      return;
    }
    clearTimeout(timer.hold);
    if (timer.phase === "holding") {
      if (timer.priorPhase !== "inspection" || !pref.videoRecordInspection)
        discardVideoRecording();
      setTimerPhase(timer.priorPhase === "inspection" ? "inspection" : "idle");
      return;
    }
    if (timer.phase !== "ready") return;
    if (view !== "training" && pref.inspection && timer.priorPhase !== "inspection") {
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
    stopVideoRecording(s);
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
    if (view === "training") {
      finishTrainingAttempt();
      return;
    }
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
    stopVideoRecording(s);
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
    discardVideoRecording();
    setTimerPhase("idle");
    if (view === "timer" || view === "training") render();
  }
  function bindTimerSurface() {
    const el = $("#timer-surface");
    el.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      if (e.pointerType === "mouse" && !pref.mouseClickStart && timer.phase !== "running") return;
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
        if (timer.priorPhase !== "inspection" || !pref.videoRecordInspection)
        discardVideoRecording();
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
    if (e.key === "Escape" && $(".activity-popover:not([hidden])")) {
      closeActivityPopover();
      return;
    }
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
      ["timer", "training"].includes(view) &&
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
      ["timer", "training"].includes(view) &&
      !e.target.closest("button:not(.timer-surface)")
    ) {
      e.preventDefault();
      if (!e.repeat) beginHold();
      return;
    }
    if (e.code === "Space" && ["timer", "training"].includes(view) && e.target === document.body) {
      e.preventDefault();
      if (!e.repeat) beginHold();
      return;
    }
    if (e.key === "Escape" && timerBusy()) {
      cancelTimer();
      return;
    }
    if (e.key === "Escape" && view === "training") {
      endRound();
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
    } else if (timer.blockedRelease) releaseHold();
  });
  window.addEventListener("blur", () => {
    if (timer.phase === "holding" || timer.phase === "ready") {
      clearTimeout(timer.hold);
      if (timer.priorPhase !== "inspection" || !pref.videoRecordInspection)
        discardVideoRecording();
      setTimerPhase(timer.priorPhase === "inspection" ? "inspection" : "idle");
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (
      document.hidden &&
      (timer.phase === "holding" || timer.phase === "ready")
    ) {
      clearTimeout(timer.hold);
      if (timer.priorPhase !== "inspection" || !pref.videoRecordInspection)
        discardVideoRecording();
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
    scheduleVideoDeletion(s.id);
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
        cancelVideoDeletion(s.id);
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

  // The renderer module, once loaded. Held here so the scene lifecycle can
  // park and discard slots without repeating the dynamic import, and so the
  // idle warm-up below has somewhere to put it.
  let cubeStudio = null;
  let cubeWarming = 0;
  // Load and pre-build the expensive, scramble-independent half of the 3D cube
  // while the browser is idle. Without this the first spawn pays for the module
  // fetch, ~140ms of procedural texture CPU and a shader compile at the exact
  // moment it is trying to animate.
  function warmCubeStudio() {
    if (cubeStudio || cubeWarming || pref.cubeFinish === "standard") return;
    const run = () => {
      cubeWarming = 0;
      if (cubeStudio || pref.cubeFinish === "standard") return;
      import("./cube-realistic.js").then(studio => {
        cubeStudio = studio;
        studio.warmCube(pref.cubeFinish, pref.cubeQuality, pref.cubeEnvironment, pref.cubeWear);
      }).catch(() => {});
    };
    if (typeof requestIdleCallback === "function") cubeWarming = requestIdleCallback(run, { timeout: 1500 });
    else cubeWarming = setTimeout(run, 200);
  }

  let dialogCloseTimer = 0,
    cubeApplyTimer = 0;
  function showDialog(title, body, cls = "") {
    motion?.clear();
    disposeSolveVideoUrl();
    averageDrawer = null;
    clearTimeout(dialogCloseTimer);
    clearTimeout(cubeApplyTimer);
    drawerScene?.destroy();
    appearanceScene?.destroy();
    lightingScene?.destroy();
    // These mounts are rebuilt with the dialog body, so their renderers have no
    // stage to come back to. Park would leak a context per dialog open.
    cubeStudio?.discardCube("drawer-cube");
    cubeStudio?.discardCube("case-cube");
    cubeStudio?.discardCube("appearance-cube");
    cubeStudio?.discardCube("cube-lighting-studio");
    appearanceScene = null;
    lightingScene = null;
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
    const wasAppearance = $("#dialog").classList.contains("appearance-dialog"),
      closingAppearanceScene = wasAppearance ? appearanceScene : null;
    if (wasAppearance) appearanceLoadToken++;
    averageDrawer = null;
    caseDrawer = null;
    disposeSolveVideoUrl();
    clearTimeout(dialogCloseTimer);
    clearTimeout(cubeApplyTimer);
    $("#dialog").classList.remove("closing");
    drawerScene?.destroy();
    closingAppearanceScene?.destroy();
    if (!wasAppearance) appearanceScene?.destroy();
    if (view !== "lighting") lightingScene?.destroy();
    cubeStudio?.discardCube("drawer-cube");
    cubeStudio?.discardCube("case-cube");
    const appearanceCleanup = wasAppearance
      ? new Promise(resolve => requestAnimationFrame(() => {
          cubeStudio?.discardCube("appearance-cube");
          resolve();
        }))
      : (cubeStudio?.discardCube("appearance-cube"), Promise.resolve());
    if (view !== "lighting") cubeStudio?.discardCube("cube-lighting-studio");
    appearanceScene = null;
    if (view !== "lighting") {
      lightingScene = null;
      lightingState = null;
    }
    drawerScene = null;
    drawerId = null;
    restoreMainCubeAfterAppearance(appearanceCleanup);
    if (view === "timer") $("#timer-surface")?.focus({ preventScroll: true });
  });
  $("#dialog").addEventListener("cancel", (e) => {
    e.preventDefault();
    if ($(".studio-confirm:not([hidden])")) {
      toggleStudioConfirmation(false);
      return;
    }
    if ($(".quality-select.open")) {
      closeQualityMenu();
      return;
    }
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
    const i = solves().indexOf(s),
      hasVideo = Boolean(s.video),
      videoWidth = Math.max(1, Number(s.video?.width) || 16),
      videoHeight = Math.max(1, Number(s.video?.height) || 9),
      videoPane = hasVideo
        ? `<div class="solve-video-frame" style="--video-aspect:${videoWidth} / ${videoHeight}"><video id="solve-video" autoplay loop muted playsinline preload="metadata" disablepictureinpicture disableremoteplayback controlslist="nodownload nofullscreen noremoteplayback noplaybackrate" tabindex="0" aria-label="Solve recording. Click to pause or play, hold to play at half speed."></video><span class="solve-video-hint">Click to pause · hold for 0.5×</span><span class="solve-video-status">Paused</span></div>`
        : "";
    showDialog(
      `Solve #${i + 1}`,
      `<div class="detail-grid${hasVideo ? " has-video" : ""}"><div class="detail-visuals">${videoPane}<div class="detail-cube"><div id="drawer-cube"></div><div class="playback"><button class="icon-btn" data-cube="first" aria-label="Show solved cube">${icon("first")}</button><button class="icon-btn" data-cube="prev" aria-label="Previous move">${icon("left")}</button><button class="icon-btn play-btn" data-cube="play" aria-label="Play scramble">${icon("play")}</button><button class="icon-btn" data-cube="next" aria-label="Next move">${icon("chevron")}</button><button class="icon-btn" data-cube="last" aria-label="Show full scramble">${icon("last")}</button></div></div></div><div class="detail-side"><div class="detail-time">${fmt(C.value(s))}${s.penalty === "+2" ? "+" : ""}</div><div class="detail-meta"><span>${esc(longDate(s))}</span><span>${esc(active().name)}</span></div><div class="detail-actions">${resultControls(s)}</div><div class="scramble-line" data-copyable><button class="icon-btn copy-inline" data-action="copy" aria-label="Copy scramble">${icon("copy")}</button><div id="scramble-notation" class="scramble-tokens"></div></div><label class="field">Note<textarea class="detail-note" id="solve-note" maxlength="2000" rows="3" placeholder="Add a note"></textarea></label></div></div>`,
      `solve-detail${hasVideo ? " solve-detail-video" : ""}`,
    );
    drawerId = id;
    $("#solve-note").value = s.note || "";
    drawerScene = new CubeScene($("#drawer-cube"), s.scramble);
    if (pref.cubeMode === "net") drawerScene.setMode("net");
    drawerScene.onChange = updateNotation;
    if (drawerScene.invalid)
      $("#scramble-notation", $("#dialog")).textContent = s.scramble;
    else updateNotation();
    if (hasVideo) mountSolveVideo(s);
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
      `<section class="camera-settings${pref.videoRecording ? " enabled" : ""}"><label class="toggle-row camera-toggle"><input type="checkbox" data-control="video-recording" ${pref.videoRecording ? "checked" : ""}><span><strong>Record solves on video</strong>Keep the selected camera ready, record each timed attempt, and save its clip with that solve. Camera audio is not recorded.</span></label><div class="camera-options"><div class="camera-setting-grid"><label class="field">Camera<select data-control="camera-device"><option value="">Detecting cameras…</option></select></label><label class="field">Resolution<select data-control="video-resolution" id="camera-resolution">${Object.entries(VIDEO_RESOLUTIONS).map(([value, mode]) => `<option value="${value}"${pref.videoResolution === value ? " selected" : ""}>${mode.label}</option>`).join("")}</select></label><label class="field">Frame rate<select data-control="video-fps">${VIDEO_FPS.map((value) => `<option value="${value}"${pref.videoFps === value ? " selected" : ""}>${value} fps</option>`).join("")}</select></label><label class="field">Keep under (s)<input type="number" data-control="video-max-seconds" min="0" max="3600" step="1" inputmode="numeric" placeholder="No limit" value="${pref.videoMaxSeconds || ""}"></label></div><label class="toggle-row camera-inline-toggle"><input type="checkbox" data-control="video-record-inspection" ${pref.videoRecordInspection ? "checked" : ""}><span><strong>Record inspection</strong></span></label><p class="camera-status" id="camera-status" role="status"></p><p class="camera-note">Leave “Keep videos under” empty to store every clip. With a number in it, only solves faster than that many seconds keep their video; slower ones are saved as solves without video. DNFs always keep theirs. 720p at 30 fps is the balanced default. The camera remains ready while this option is on so recording can begin without delaying the timer.</p></div></section><label class="toggle-row"><input type="checkbox" data-control="inspection" ${pref.inspection ? "checked" : ""}><span><strong>15-second inspection</strong>Press once to start inspection, then hold and release to start the solve. +2 at 15 seconds; at 17 the attempt is saved as a DNF automatically.</span></label><label class="toggle-row"><input type="checkbox" data-control="press-start" ${pref.pressToStart ? "checked" : ""}><span><strong>Start on a single press</strong>Skip the 350ms hold: one press starts the solve and the next key stops it. With inspection on, the first press starts inspection and the second starts the solve.</span></label><label class="toggle-row"><input type="checkbox" data-control="inspection-voice" ${pref.inspectionVoice ? "checked" : ""}><span><strong>Spoken inspection cues</strong>Hear “8 seconds” and “12 seconds” during inspection. Visual cues are always included.</span></label><label class="toggle-row"><input type="checkbox" data-control="scramble-animation" ${pref.scrambleAnimation ? "checked" : ""}><span><strong>Scramble animation</strong>Show the cube solved first, then animate through the scramble. Turn this off to spawn the cube directly scrambled.</span></label><label class="toggle-row"><input type="checkbox" data-control="cube-net" ${pref.cubeMode === "net" ? "checked" : ""}><span><strong>Show the cube as a flat net</strong>The scramble preview opens unfolded instead of in 3D. Clicking the cube switches either way.</span></label><div class="settings-actions"><button class="btn btn-quiet" data-action="appearance">${icon("palette")}Appearance</button><button class="btn btn-quiet" data-action="import">${icon("upload")}Import CSV</button><button class="btn btn-quiet" data-action="storage">${icon("folder")}Storage</button></div><div class="dialog-actions"><button class="btn btn-dark" data-action="close-dialog">Done</button></div>`,
    );
    const mouseClickStart = document.querySelector('[data-control="inspection-voice"]');
    mouseClickStart?.closest(".toggle-row")?.insertAdjacentHTML(
      "beforebegin",
      `<label class="toggle-row"><input type="checkbox" data-control="mouse-click-start" ${pref.mouseClickStart ? "checked" : ""}><span><strong>Allow mouse clicks to start the timer</strong>Turn this off to prevent a mouse click from starting a new attempt. Keyboard and touch controls still work.</span></label>`,
    );
    refreshCameraSettingsUI();
    listCameraDevices();
    if (pref.videoRecording) ensureCameraReady();
  }
  function suspendMainCubeForAppearance() {
    const mount = $("#cube-mount");
    appearanceSuspendedMainCube = Boolean(mount && scene);
    if (!appearanceSuspendedMainCube) return Promise.resolve();
    const leavingScene = scene;
    scene = null;
    // Start the existing exit motion and yield immediately. Resource disposal
    // happens only after the dialog has had a chance to paint its shell.
    return leavingScene.exit().then(() => new Promise(resolve => requestAnimationFrame(() => {
      cubeStudio?.discardCube("cube-mount");
      if (mount.isConnected && !scene) mount.replaceChildren();
      resolve();
    })));
  }
  function restoreMainCubeAfterAppearance(cleanup = Promise.resolve()) {
    if (!appearanceSuspendedMainCube) return;
    appearanceSuspendedMainCube = false;
    const mount = $("#cube-mount");
    if (!mount || scene || view === "lighting") return;
    beginCubeLoading(mount);
    // Closing the modal reveals the page first. Only on the following paint do
    // we dispose the modal cube and build the returning one.
    requestAnimationFrame(() => {
      Promise.all([appearanceSuspension, cleanup]).then(() => setTimeout(() => {
        if (!mount.isConnected || scene || view === "lighting") return;
        scene = new CubeScene(mount, currentScramble, null, { entrance: false });
        scene.onChange = updateNotation;
        if (pref.cubeMode === "net") scene.setMode("net");
        updateNotation();
      }, 0));
    });
  }
  function loadAppearanceCube() {
    const token = ++appearanceLoadToken,
      mount = $("#appearance-cube");
    if (!mount) return;
    beginCubeLoading(mount);
    // Two frames guarantee that the modal and placeholder are visible before
    // module work, geometry construction or shader compilation begins.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      appearanceSuspension.then(() => setTimeout(() => {
        if (token !== appearanceLoadToken || !mount.isConnected || !$("#dialog").open) return;
        appearanceScene = new CubeScene(mount, "R R'", null, { zoom: .8 });
        if (pref.cubeFinish === "standard") {
          appearanceScene.yaw = -42;
          appearanceScene.orbit();
        }
      }, 0));
    }));
  }
  function appearance() {
    appearanceSuspension = suspendMainCubeForAppearance();
    const modes = [
        ["system", "System"],
        ["light", "Light"],
        ["dark", "Dark"],
        ["contrast", "High contrast"],
      ],
      accents = [
        ["forest", "Forest"],
        ["ocean", "Ocean"],
        ["violet", "Violet"],
        ["ember", "Ember"],
      ],
      model = CUBE_MODELS[pref.cubeFinish],
      quality = CUBE_QUALITY[pref.cubeQuality];
    // The app theme is a narrow rail. The larger cube workspace uses its width
    // for a preview and a dedicated controls column instead of stacking every
    // setting under a small preview.
    showDialog(
      "Appearance",
      `<div class="appearance-layout"><div class="appearance-scroll"><div class="appearance-section"><h3>Display mode</h3><div class="mode-options">${modes.map(([value, label]) => `<button class="mode-choice ${pref.theme === value ? "active" : ""}" data-theme-choice="${value}"><span class="mode-preview mode-preview-${value}"><i></i><i></i><i></i></span><strong>${label}</strong></button>`).join("")}</div></div><div class="appearance-section"><h3>Color theme</h3><div class="accent-options">${accents.map(([value, label]) => `<button class="accent-choice ${pref.accent === value ? "active" : ""}" data-accent-choice="${value}"><i class="accent-swatch"></i><span>${label}</span>${icon("check")}</button>`).join("")}</div></div></div><div class="appearance-divider" aria-hidden="true"></div><div class="appearance-cube-pane"><div class="cube-pane-head"><span>Cube</span><button class="btn btn-quiet cube-studio-launch" data-action="lighting-studio">${icon("expand")}Lighting studio</button></div><div class="cube-workspace"><div class="cube-preview-column"><div class="cube-carousel" role="region" aria-roledescription="carousel" aria-label="Cube models" data-model="${pref.cubeFinish}"><div class="cube-carousel-frame"><div class="cube-carousel-track"><div id="appearance-cube"></div><div class="cube-carousel-caption"><strong id="cube-model-name">${model.label}</strong></div></div><button class="cube-nav cube-nav-prev" data-cube-step="-1" aria-label="Previous cube">${icon("left")}</button><button class="cube-nav cube-nav-next" data-cube-step="1" aria-label="Next cube">${icon("chevron")}</button></div><div class="cube-carousel-dots" aria-hidden="true">${Object.keys(CUBE_MODELS).map(value => `<i data-cube-dot="${value}"${value === pref.cubeFinish ? ` class="on"` : ""}></i>`).join("")}</div></div></div><div class="cube-controls"><div class="cube-setting cube-color-setting"><h3>Cube colors</h3><div class="cube-palette-options" role="group" aria-label="Cube colors">${Object.entries(CUBE_PALETTES).map(([value, p]) => `<button class="cube-palette-choice" data-cube-palette="${value}" aria-pressed="${pref.cubePalette === value}"><span class="cube-color-swatches" aria-hidden="true">${["U", "D", "F", "B", "L", "R"].map(f => `<i style="background:${p.colors[f]}"></i>`).join("")}</span><strong>${p.label}</strong></button>`).join("")}</div></div><div class="cube-setting cube-core-setting"><h3>Core</h3><div class="cube-core-options" role="group" aria-label="Core color">${Object.entries(CUBE_CORES).map(([value, c]) => `<button class="cube-core-choice" data-cube-core="${value}" aria-pressed="${pref.cubeCore === value}" title="${c.label} core"><i style="background:${c.swatch}" aria-hidden="true"></i>${c.label}</button>`).join("")}</div></div><div class="cube-setting cube-wear-setting"><label class="toggle-row"><input type="checkbox" data-control="cube-wear" ${pref.cubeWear ? "checked" : ""}><span><strong>Surface wear</strong></span></label></div><div class="cube-settings-row"><div class="cube-setting"><h3>Graphics quality</h3><div class="quality-select"><button type="button" class="quality-trigger" data-quality-toggle="1" aria-haspopup="listbox" aria-expanded="false"><span class="quality-value"><strong id="quality-value">${quality.label}</strong></span>${icon("down")}</button><div class="quality-menu" role="listbox" aria-label="Graphics quality">${Object.entries(CUBE_QUALITY).map(([value, q]) => `<button type="button" class="quality-option" role="option" data-cube-quality="${value}" aria-selected="${pref.cubeQuality === value}"><span><strong>${q.label}</strong></span>${icon("check")}</button>`).join("")}</div></div></div><div class="cube-setting"><h3>Environment</h3><div class="quality-select"><button type="button" class="quality-trigger" data-quality-toggle="1" aria-haspopup="listbox" aria-expanded="false"><span class="quality-value"><strong id="environment-value">${CUBE_ENVIRONMENTS[pref.cubeEnvironment].label}</strong></span>${icon("down")}</button><div class="quality-menu environment-menu" role="listbox" aria-label="Reflection environment">${Object.entries(CUBE_ENVIRONMENTS).map(([value, e]) => `<button type="button" class="quality-option" role="option" data-cube-environment="${value}" aria-selected="${pref.cubeEnvironment === value}"><span><strong>${e.label}</strong></span>${icon("check")}</button>`).join("")}</div></div></div></div></div></div></div></div><div class="dialog-actions"><p id="cube-finish-status" class="cube-finish-status" role="status"></p><button class="btn btn-dark" data-action="close-dialog">Done</button></div>`,
      "appearance-dialog",
    );
    $(".cube-preview-column").insertAdjacentHTML(
      "beforeend",
      `<div class="cube-cross-setting"><h3>Cross color</h3><div class="cube-cross-options" role="group" aria-label="Preferred cross color">${Object.entries(CUBE_CROSSES).map(([face, item]) => `<button data-cube-cross="${face}" aria-label="${item.label}" title="${item.label}" aria-pressed="${pref.cubeCross === face}"><i style="background:${CUBE_PALETTES[pref.cubePalette].colors[face]}"></i></button>`).join("")}</div></div>`,
    );
    loadAppearanceCube();
  }
  function lightingControl(key, value) {
    const control = LIGHTING_CONTROLS[key];
    return `<label class="lighting-control"><span><strong>${control.label}</strong><small>${control.detail}</small></span><output data-lighting-output="${key}">${Number(value).toFixed(key === "glossRough" ? 3 : 2)}</output><input type="range" min="${control.min}" max="${control.max}" step="${control.step}" value="${value}" data-lighting-control="${key}" aria-label="${control.label}"></label>`;
  }
  async function lightingStudio(next = null) {
    const opening = view !== "lighting";
    let loadingPaint = Promise.resolve();
    if (opening) {
      lightingReturnView = view;
      // Enter the studio's loading state before importing or preparing WebGL.
      // Keeping it for a few frames makes the animation perceptible even when
      // the module is already warm in the browser cache.
      appearanceSuspendedMainCube = false;
      closeDialog(true);
      lightingState = null;
      navigate("lighting");
      loadingPaint = new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 700)));
    }
    try {
      const studioModule = cubeStudio ? Promise.resolve(cubeStudio) : import("./cube-realistic.js");
      const [loadedStudio] = await Promise.all([studioModule, loadingPaint]);
      cubeStudio ||= loadedStudio;
    } catch {
      if (opening) navigate(lightingReturnView);
      toast("The lighting studio could not load on this device.", true);
      return;
    }
    const model = next?.cubeFinish ?? pref.cubeFinish,
      environment = next?.cubeEnvironment ?? pref.cubeEnvironment,
      tuningModel = model === "standard" ? "tiles" : model,
      contextChanged = !lightingState || lightingState.cubeFinish !== model || lightingState.cubeEnvironment !== environment,
      tuning = contextChanged ? cubeStudio.cubeTuning(tuningModel, environment) : lightingState.values;
    lightingState = {
      cubeFinish: model,
      cubeEnvironment: environment,
      cubePalette: next?.cubePalette ?? lightingState?.cubePalette ?? pref.cubePalette,
      cubeQuality: next?.cubeQuality ?? lightingState?.cubeQuality ?? pref.cubeQuality,
      cubeWear: next?.cubeWear ?? lightingState?.cubeWear ?? pref.cubeWear,
      cubeCore: next?.cubeCore ?? lightingState?.cubeCore ?? pref.cubeCore,
      cubeCross: next?.cubeCross ?? lightingState?.cubeCross ?? pref.cubeCross,
      values: Object.fromEntries(Object.keys(LIGHTING_CONTROLS).map(key => [key, tuning[key]])),
    };
    navigate("lighting");
  }
  function lightingStudioPage() {
    if (!lightingState) return `<div class="lighting-loading" role="status">${CUBE_THROBBER}Opening lighting studio…</div>`;
    const model = lightingState.cubeFinish,
      environment = lightingState.cubeEnvironment,
      environmentOptions = Object.entries(CUBE_ENVIRONMENTS).map(([value, item]) =>
        `<option value="${value}"${value === environment ? " selected" : ""}>${item.label}</option>`).join(""),
      modelOptions = Object.entries(CUBE_MODELS).map(([value, item]) =>
        `<option value="${value}"${value === model ? " selected" : ""}>${item.label}</option>`).join(""),
      qualityOptions = Object.entries(CUBE_QUALITY).map(([value, item]) =>
        `<option value="${value}"${value === lightingState.cubeQuality ? " selected" : ""}>${item.label}</option>`).join(""),
      realistic = model !== "standard";
    const paletteOptions = Object.entries(CUBE_PALETTES).map(([value, item]) =>
        `<button data-studio-palette="${value}" aria-pressed="${lightingState.cubePalette === value}" title="${item.label}"><span>${["U", "D", "F", "B", "L", "R"].map(face => `<i style="background:${item.colors[face]}"></i>`).join("")}</span><small>${item.label}</small></button>`).join(""),
      coreOptions = Object.entries(CUBE_CORES).map(([value, item]) =>
        `<button data-studio-core="${value}" aria-pressed="${lightingState.cubeCore === value}"><i style="background:${item.swatch}"></i>${item.label}</button>`).join(""),
      crossOptions = Object.entries(CUBE_CROSSES).map(([face, item]) =>
        `<button data-studio-cross="${face}" aria-pressed="${lightingState.cubeCross === face}" aria-label="${item.label}" title="${item.label}"><i style="background:${CUBE_PALETTES[lightingState.cubePalette].colors[face]}"></i></button>`).join("");
    return `<div class="lighting-screen"><section class="lighting-canvas"><button class="studio-back" data-action="studio-exit" aria-label="Back to Appearance">${icon("left")}<span>Appearance</span></button><div id="cube-lighting-studio" class="lighting-cube"></div></section><aside class="lighting-panel"><header class="lighting-panel-title"><div><h1>Lighting studio</h1><p>Drag to rotate · scroll to zoom</p></div><button class="icon-btn" data-action="studio-exit" aria-label="Close studio">${icon("close")}</button></header><section class="studio-section studio-cube-settings"><div class="studio-section-title">Cube settings</div><div class="lighting-context"><label class="field">Model<select data-control="studio-model">${modelOptions}</select></label><label class="field">Environment<select data-control="studio-environment"${realistic ? "" : " disabled"}>${environmentOptions}</select></label><label class="field studio-quality-field">Graphics quality<select data-control="studio-quality"${realistic ? "" : " disabled"}>${qualityOptions}</select></label></div><div class="studio-setting-group"><span class="studio-setting-label">Colors</span><div class="studio-palette-options" role="group" aria-label="Cube colors">${paletteOptions}</div></div><div class="studio-setting-columns"><div class="studio-setting-group"><span class="studio-setting-label">Core</span><div class="studio-core-options" role="group" aria-label="Core color">${coreOptions}</div></div><div class="studio-setting-group"><span class="studio-setting-label">Cross color</span><div class="studio-cross-options" role="group" aria-label="Preferred cross color">${crossOptions}</div></div></div><label class="studio-wear"><span><strong>Surface wear</strong><small>Preview scratches and handling haze</small></span><input type="checkbox" data-control="studio-wear"${lightingState.cubeWear ? " checked" : ""}${realistic ? "" : " disabled"}><i></i></label></section><section class="studio-section lighting-tuning${realistic ? "" : " disabled"}"><div class="lighting-panel-head"><div class="studio-section-title">Light & material</div><button class="btn-link" data-action="studio-reset-tuning"${realistic ? "" : " disabled"}>Reset values</button></div>${realistic ? `<div class="lighting-control-list">${Object.entries(lightingState.values).map(([key, value]) => lightingControl(key, value)).join("")}</div>` : `<p class="studio-empty-note">Choose a realistic model to tune its lighting.</p>`}<div class="lighting-save-controls"><p id="lighting-save-status" class="lighting-save-status" role="status">${realistic ? server ? "Ready to save this calibration." : "Use the local launcher to save." : "Lighting is not available for Standard."}</p><button class="btn btn-dark" data-action="studio-confirm-open"${server && realistic ? "" : " disabled"}>Hardcode calibration</button></div></section></aside><div class="studio-confirm" role="dialog" aria-modal="true" aria-labelledby="studio-confirm-title" hidden><div><span class="studio-confirm-icon">${icon("settings")}</span><h3 id="studio-confirm-title">Hardcode this calibration?</h3><p>This writes the current light and material values into <strong>${CUBE_ENVIRONMENTS[environment].label}</strong> for <strong>${CUBE_MODELS[model].label}</strong>.</p><div class="dialog-actions"><button class="btn btn-quiet" data-action="studio-confirm-cancel">Cancel</button><button class="btn btn-dark" data-action="studio-confirm-save">Yes, hardcode values</button></div></div></div></div>`;
  }
  function exitLightingStudio() {
    const destination = ["overview", "timer", "solves", "insights"].includes(lightingReturnView) ? lightingReturnView : "timer";
    lightingState = null;
    navigate(destination);
    appearance();
  }
  function applyLightingControls() {
    if (!lightingState) return;
    lightingScene?.beginStudioInteraction();
    lightingScene?.realistic?.setTuning(lightingState.values);
    lightingScene?.endStudioInteraction(140);
    for (const [key, value] of Object.entries(lightingState.values)) {
      const input = $(`[data-lighting-control="${key}"]`),
        output = $(`[data-lighting-output="${key}"]`);
      if (input) input.value = value;
      if (output) output.textContent = Number(value).toFixed(key === "glossRough" ? 3 : 2);
    }
  }
  function toggleStudioConfirmation(open) {
    const confirmation = $(".studio-confirm");
    if (!confirmation) return;
    confirmation.hidden = !open;
    if (open) $('[data-action="studio-confirm-cancel"]', confirmation)?.focus();
    else $('[data-action="studio-confirm-open"]')?.focus();
  }
  async function saveLightingCalibration() {
    if (!lightingState) return;
    const button = $('[data-action="studio-confirm-save"]'),
      status = $("#lighting-save-status");
    button.disabled = true;
    button.textContent = "Saving…";
    try {
      const response = await fetch("/api/environment-tuning", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          environment: lightingState.cubeEnvironment,
          model: lightingState.cubeFinish,
          values: lightingState.values,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save calibration.");
      const tuning = window.CT_ENVIRONMENTS.TUNING;
      tuning[result.environment] ||= {};
      tuning[result.environment][result.model] = { ...result.values };
      toggleStudioConfirmation(false);
      status.textContent = `Hardcoded for ${CUBE_ENVIRONMENTS[result.environment].label} · ${CUBE_MODELS[result.model].label}.`;
      toast("Lighting calibration hardcoded.");
    } catch (error) {
      status.textContent = error.message;
      status.classList.add("error");
      toggleStudioConfirmation(false);
    } finally {
      button.disabled = false;
      button.textContent = "Yes, hardcode values";
    }
  }
  // The lightweight half: captions, dots, pressed states and the saved
  // preference. Carousel steps call this immediately; the cube rebuild is
  // debounced behind it.
  function updateCubeSelectionUI() {
    savePref();
    const carousel = $(".cube-carousel");
    if (carousel) carousel.dataset.model = pref.cubeFinish;
    $$("[data-cube-palette]").forEach(el => el.setAttribute("aria-pressed", String(el.dataset.cubePalette === pref.cubePalette)));
    $$("[data-cube-quality]").forEach(el => el.setAttribute("aria-selected", String(el.dataset.cubeQuality === pref.cubeQuality)));
    $$("[data-cube-environment]").forEach(el => el.setAttribute("aria-selected", String(el.dataset.cubeEnvironment === pref.cubeEnvironment)));
    if ($('[data-control="cube-wear"]')) $('[data-control="cube-wear"]').checked = pref.cubeWear;
    $$("[data-cube-core]").forEach(el => el.setAttribute("aria-pressed", String(el.dataset.cubeCore === pref.cubeCore)));
    $$("[data-cube-cross]").forEach(el => {
      el.setAttribute("aria-pressed", String(el.dataset.cubeCross === pref.cubeCross));
      const swatch = $("i", el);
      if (swatch) swatch.style.background = CUBE_PALETTES[pref.cubePalette].colors[el.dataset.cubeCross];
    });
    $$("[data-cube-dot]").forEach(el => el.classList.toggle("on", el.dataset.cubeDot === pref.cubeFinish));
    if ($("#cube-model-name")) {
      $("#cube-model-name").textContent = CUBE_MODELS[pref.cubeFinish].label;
      $("#quality-value").textContent = CUBE_QUALITY[pref.cubeQuality].label;
      if ($("#environment-value")) $("#environment-value").textContent = CUBE_ENVIRONMENTS[pref.cubeEnvironment].label;
      $("#cube-finish-status").textContent = "";
    }
  }
  // Apply the selected settings after carousel input settles, or immediately
  // when a setting control changes.
  function applyCubeSelection(crossFrom = null) {
    updateCubeSelectionUI();
    scene?.setAppearance();
    drawerScene?.setAppearance();
    if (crossFrom && crossFrom !== pref.cubeCross) appearanceScene?.animateCross(crossFrom, pref.cubeCross);
    else appearanceScene?.setAppearance();
    trainerThumbs.forEach(el => { if (el.firstElementChild) paintThumb(el); });
    warmCubeStudio();
  }
  // Navigation always responds immediately. Coalesce rapid presses before
  // preparing the selected model; the loading shell stays still throughout.
  function stepCubeModel(direction) {
    const models = Object.keys(CUBE_MODELS);
    pref.cubeFinish = models[(models.indexOf(pref.cubeFinish) + direction + models.length) % models.length];
    updateCubeSelectionUI();
    const mount = $("#appearance-cube");
    if (!mount) return;
    clearTimeout(cubeApplyTimer);
    // Invalidate callbacks now, including an environment fetch or reveal from
    // the previous model that may finish during the debounce window.
    if (appearanceScene) {
      appearanceScene.appearanceRequest++;
      appearanceScene.materializedIdentity = null;
    }
    beginCubeLoading(mount);
    cubeApplyTimer = setTimeout(() => {
      cubeApplyTimer = 0;
      if (mount.isConnected && $("#dialog").open) applyCubeSelection();
    }, 120);
  }
  function closeQualityMenu() {
    const select = $(".quality-select.open");
    if (!select) return;
    select.classList.remove("open");
    $(".quality-trigger", select).setAttribute("aria-expanded", "false");
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
    removed.solves.forEach((solve) => scheduleVideoDeletion(solve.id));
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
        removed.solves.forEach((solve) => cancelVideoDeletion(solve.id));
        state.categories.splice(Math.min(idx, state.categories.length), 0, removed);
        pref.active = removed.id;
        savePref();
        persist();
        render();
      },
    });
  }
  function storage() {
    const recorded = state.categories.flatMap((category) => category.solves).filter((solve) => solve.video),
      videoBytes = recorded.reduce((sum, solve) => sum + (Number(solve.video?.size) || 0), 0),
      videoSize = videoBytes >= 1024 * 1024 * 1024
        ? `${(videoBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
        : videoBytes >= 1024 * 1024
          ? `${(videoBytes / (1024 * 1024)).toFixed(1)} MB`
          : `${Math.round(videoBytes / 1024)} KB`;
    showDialog(
      "Storage",
      `<p>${server ? "Your workspace is connected to the local saver. Every solve and penalty change updates the category’s CSV beside CTU.html. A previous copy is kept in the backups folder." : "This HTML is saving a recovery copy in your browser. For automatic CSV files beside the HTML, open Start CubeTracker.cmd. You can also connect the HTML folder below in a supported browser."}</p><div class="file-list">${state.categories.map((c) => `<div><strong>${esc(c.name)}</strong><br>${esc(c.file || "No folder file yet")} · ${c.solves.length} solves</div>`).join("") || "<div>No categories yet.</div>"}${recorded.length ? `<div><strong>Video recordings</strong><br>${recorded.length.toLocaleString()} clips · ${videoSize} · ${server ? "videos folder" : "browser video storage"}</div>` : ""}</div>${!server ? '<p class="chart-note">A standalone HTML page needs you to choose a folder before it can write CSV files. Video recordings remain in this browser’s dedicated storage. Reconnect after reopening the page.</p>' : ""}<div class="dialog-actions">${!server ? '<button class="btn btn-dark" data-action="connect-folder">Connect a folder</button>' : ""}${writeError ? '<button class="btn btn-dark" data-action="retry-save">Retry save</button>' : ""}<button class="btn btn-quiet" data-action="export">Export current CSV</button></div>`,
    );
  }
  function help() {
    showDialog(
      "Guide & shortcuts",
      `<div class="guide-studio"><div><strong>See what progress feels like</strong><p>Try every reward, earned frame, and inspection cue on the timer stage.</p></div><button class="btn btn-dark" data-action="effects-demo">${icon("play")}Animation studio</button></div><p><strong>Your sub-time title.</strong> Starts after 500 attempts and uses their arithmetic mean, including +2. A DNF makes that window DNF. Your best consecutive 500 across the entire category earns your title, including imported history, independently of the overview range. Special titles: sub 60, 45, 30, 25, 20, 15, 10, 8, 7, 6 and 5 seconds.</p><p><strong>Progress & rust.</strong> The category's global mean sets ordinary intervals: below 20s → 0.5s; below 30s → 1s; below 2min → 5s; below 10min → 20s. Beyond that, a 1–2–5 scale grows with your mean. A title gets rusty when the current 500 exceeds its threshold by more than one interval from that threshold's band. Return within that margin to shake off the rust; your earned title remains.</p>` +
      `<p><strong>Import.</strong> Import a CubeDesk-style CSV with <code>Index,Time,Scramble,Date</code>. Create your own categories; each gets a separate CSV.</p><p><strong>Timing.</strong> The timer is the home screen. Without inspection, hold space for 350ms, release when the digits light up, then press any key to stop. Settings can swap the hold for a single press. On touch screens, press and hold the timer. Turn inspection on in Settings: a normal press then starts inspection immediately, and you hold and release for 350ms to start the solve. At 15 seconds the result gets +2; at 17 the attempt is saved as a DNF on its own and the timer is ready for the next one.</p><p><strong>Video.</strong> Enable solve recording in Settings, then choose the camera, resolution and frame rate. The camera stays ready so hold-mode and inspection recordings begin immediately; single-press recording begins when that press is released. A camera badge marks recorded solves. Their player loops without controls and pauses or resumes when clicked.</p><p><strong>Solves.</strong> The list on the right holds every solve, newest first. Click one for its scramble, reconstruction and note, or use the button on the row to delete it. Move the pointer to the left edge for categories and the rest of the app.</p><p><strong>Cube.</strong> Drag to rotate. Click the cube to switch between the 3D view and the flat net. Open a solve to step through its moves or play the sequence. Start white-up, green-front.</p><p><strong>Scramble source.</strong> In local server mode, a background worker generates random cube states and solves them backward into verified scrambles. In standalone HTML mode, the timer uses 20 random moves and labels them accordingly. Neither mode is an official competition scramble source.</p><p><strong>Files.</strong> Open <code>Start CubeTracker.cmd</code> for automatic CSV saving beside the HTML. Opening the HTML directly uses browser storage; connect a folder or export to keep CSVs.</p><div class="help-grid"><span>Open timer</span><kbd>T</kbd><span>Next scramble (timer)</span><kbd>N</kbd><span>Hold, then release to start</span><kbd>Space</kbd><span>Instant start (timer focused)</span><kbd>Enter</kbd><span>Cancel an active attempt</span><kbd>Esc</kbd><span>This guide</span><kbd>?</kbd></div><p class="chart-note">Rolling averages retain DNFs. +2 counts toward time. Sub-target percentages count every attempt.</p>`,
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
  function closeActivityPopover(panel = document) {
    const popover = $(".activity-popover", panel);
    if (popover) {
      popover.hidden = true;
      popover.removeAttribute("aria-label");
    }
    $$(".calendar-day.is-selected", panel).forEach((day) => {
      day.classList.remove("is-selected");
      day.setAttribute("aria-expanded", "false");
    });
  }
  function positionActivityPopover(anchor, popover, panel) {
    const rect = anchor.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const originX = panelRect.left + panel.clientLeft;
    const originY = panelRect.top + panel.clientTop;
    const margin = 8;
    const gap = 8;
    const left = Math.min(
      Math.max(margin, rect.left - originX + rect.width / 2 - popover.offsetWidth / 2),
      panel.clientWidth - popover.offsetWidth - margin,
    );
    let top = rect.bottom - originY + gap;
    let placement = "below";
    if (top + popover.offsetHeight > panel.clientHeight - margin && rect.top - originY - popover.offsetHeight - gap >= margin) {
      top = rect.top - originY - popover.offsetHeight - gap;
      placement = "above";
    }
    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
    popover.dataset.placement = placement;
    popover.style.setProperty("--anchor-x", `${rect.left - originX + rect.width / 2 - left}px`);
  }
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("button,a.brand");
    const activityPanel = e.target.closest(".activity-panel");
    if (!e.target.closest(".calendar-day") && !e.target.closest(".activity-popover"))
      closeActivityPopover(activityPanel || document);
    if (!e.target.closest(".quality-select")) closeQualityMenu();
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
      const panel = b.closest(".activity-panel"), popover = $(".activity-popover", panel);
      if (!panel || !popover) return;
      const wasOpen = b.classList.contains("is-selected") && !popover.hidden;
      closeActivityPopover(panel);
      if (wasOpen) return;
      const count = Number(b.dataset.dayCount) || 0;
      b.classList.add("is-selected");
      b.setAttribute("aria-expanded", "true");
      popover.innerHTML = `<strong>${count.toLocaleString()} ${count === 1 ? "solve" : "solves"}</strong><span>${esc(b.dataset.dayDate)}</span>`;
      popover.setAttribute("aria-label", b.dataset.dayInfo);
      popover.hidden = false;
      positionActivityPopover(b, popover, panel);
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
    if (b.dataset.qualityToggle) {
      const select = b.closest(".quality-select"), open = !select.classList.contains("open");
      select.classList.toggle("open", open);
      b.setAttribute("aria-expanded", String(open));
      if (open) $('.quality-option[aria-selected="true"]', select)?.focus();
      return;
    }
    if (b.dataset.cubeStep) {
      stepCubeModel(Number(b.dataset.cubeStep));
      return;
    }
    if (b.dataset.cubePalette || b.dataset.cubeFinish || b.dataset.cubeQuality || b.dataset.cubeEnvironment || b.dataset.cubeCore || b.dataset.cubeCross) {
      const previousCross = pref.cubeCross;
      if (Object.hasOwn(CUBE_PALETTES, b.dataset.cubePalette ?? "")) pref.cubePalette = b.dataset.cubePalette;
      if (Object.hasOwn(CUBE_CORES, b.dataset.cubeCore ?? "")) pref.cubeCore = b.dataset.cubeCore;
      if (Object.hasOwn(CUBE_CROSSES, b.dataset.cubeCross ?? "")) pref.cubeCross = b.dataset.cubeCross;
      if (Object.hasOwn(CUBE_MODELS, b.dataset.cubeFinish ?? "")) pref.cubeFinish = b.dataset.cubeFinish;
      if (Object.hasOwn(CUBE_QUALITY, b.dataset.cubeQuality ?? "")) pref.cubeQuality = b.dataset.cubeQuality;
      if (Object.hasOwn(CUBE_ENVIRONMENTS, b.dataset.cubeEnvironment ?? "")) pref.cubeEnvironment = b.dataset.cubeEnvironment;
      if (b.dataset.cubeQuality || b.dataset.cubeEnvironment) {
        closeQualityMenu();
        b.closest(".cube-setting")?.querySelector(".quality-trigger")?.focus();
      }
      applyCubeSelection(b.dataset.cubeCross ? previousCross : null);
      return;
    }
    if (b.dataset.studioPalette && lightingState && Object.hasOwn(CUBE_PALETTES, b.dataset.studioPalette)) {
      lightingState.cubePalette = pref.cubePalette = b.dataset.studioPalette;
      savePref();
      $$('[data-studio-palette]').forEach(el => el.setAttribute("aria-pressed", String(el.dataset.studioPalette === pref.cubePalette)));
      $$('[data-studio-cross]').forEach(el => {
        const swatch = $("i", el);
        if (swatch) swatch.style.background = CUBE_PALETTES[pref.cubePalette].colors[el.dataset.studioCross];
      });
      lightingScene?.setAppearance();
      return;
    }
    if (b.dataset.studioCore && lightingState && Object.hasOwn(CUBE_CORES, b.dataset.studioCore)) {
      lightingState.cubeCore = pref.cubeCore = b.dataset.studioCore;
      savePref();
      $$('[data-studio-core]').forEach(el => el.setAttribute("aria-pressed", String(el.dataset.studioCore === pref.cubeCore)));
      lightingScene?.setAppearance();
      return;
    }
    if (b.dataset.studioCross && lightingState && Object.hasOwn(CUBE_CROSSES, b.dataset.studioCross)) {
      const previousCross = lightingState.cubeCross;
      lightingState.cubeCross = pref.cubeCross = b.dataset.studioCross;
      savePref();
      $$('[data-studio-cross]').forEach(el => el.setAttribute("aria-pressed", String(el.dataset.studioCross === pref.cubeCross)));
      lightingScene?.animateCross(previousCross, lightingState.cubeCross);
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
    if (b.dataset.trainerView) {
      pref.trainerView = b.dataset.trainerView;
      savePref();
      $$('[data-trainer-view]').forEach((button) => {
        const active = button.dataset.trainerView === pref.trainerView;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
      });
      trainerThumbs.forEach((thumb) => {
        thumb.dataset.mode = pref.trainerView;
        if (thumb.firstElementChild) paintThumb(thumb);
      });
      return;
    }
    if (b.dataset.caseOpen) {
      const thumb = $("[data-case-thumb]", b);
      if (thumb?.dataset.suppressOpen === "true") {
        delete thumb.dataset.suppressOpen;
        return;
      }
      openCase(b.dataset.caseOpen);
      return;
    }
    if (b.dataset.trainMode) {
      setTrainMode(b.dataset.trainMode);
      return;
    }
    if (caseDrawer && (b.dataset.algPick || b.dataset.algStar || b.dataset.algDelete)) {
      const set = algSets().find((x) => x.id === caseDrawer.setId),
        entry = set?.cases.find((c) => c.id === caseDrawer.caseId);
      if (!entry) return;
      if (b.dataset.algDelete) removeAlgorithm(entry, b.dataset.algDelete);
      else {
        const algId = b.dataset.algPick || b.dataset.algStar;
        if (b.dataset.algStar) {
          entry.favoriteId = algId;
          persist();
        }
        caseDrawer.algId = algId;
        drawCaseDialog();
      }
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
      case "new-set":
        newSet();
        break;
      case "manage-set":
        manageSet();
        break;
      case "manage-case":
        manageCase();
        break;
      case "delete-case":
        deleteCase();
        break;
      case "delete-set":
        confirmDeleteSet();
        break;
      case "confirm-delete-set":
        deleteSet();
        break;
      case "restore-sets":
        restoreSets();
        break;
      case "new-group":
        newGroup();
        break;
      case "new-case":
        newCaseDialog(b.dataset.group || "");
        break;
      case "clear-selection":
        trainerSelection.clear();
        render();
        break;
      case "select-all":
        for (const entry of activeSet()?.cases || []) trainerSelection.add(entry.id);
        render();
        break;
      case "train":
        openTrainDialog();
        break;
      case "end-round":
        endRound();
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
      case "lighting-studio":
        await lightingStudio();
        break;
      case "studio-exit":
        exitLightingStudio();
        break;
      case "studio-reset-tuning": {
        if (!lightingState) break;
        const defaults = cubeStudio.cubeTuning(lightingState.cubeFinish, lightingState.cubeEnvironment, true);
        lightingState.values = Object.fromEntries(Object.keys(LIGHTING_CONTROLS).map(key => [key, defaults[key]]));
        applyLightingControls();
        $("#lighting-save-status").textContent = "Renderer defaults restored in the preview. Hardcode to keep them.";
        break;
      }
      case "studio-confirm-open":
        toggleStudioConfirmation(true);
        break;
      case "studio-confirm-cancel":
        toggleStudioConfirmation(false);
        break;
      case "studio-confirm-save":
        await saveLightingCalibration();
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
  document.addEventListener("change", async (e) => {
    if (e.target.dataset.caseCheck) {
      pickCase(e.target.dataset.caseCheck, e.target.checked);
      return;
    }
    if (e.target.dataset.groupCheck !== undefined) {
      pickGroup(e.target.dataset.groupCheck, e.target.checked);
      return;
    }
    const key = e.target.dataset.control;
    if (!key || timerBusy()) return;
    switch (key) {
      case "studio-environment":
        if (lightingState && Object.hasOwn(CUBE_ENVIRONMENTS, e.target.value)) {
          pref.cubeEnvironment = e.target.value;
          savePref();
          await lightingStudio({ ...lightingState, cubeEnvironment: e.target.value });
        }
        return;
      case "studio-model":
        if (lightingState && Object.hasOwn(CUBE_MODELS, e.target.value)) {
          pref.cubeFinish = e.target.value;
          savePref();
          await lightingStudio({ ...lightingState, cubeFinish: e.target.value });
        }
        return;
      case "studio-quality":
        if (lightingState && Object.hasOwn(CUBE_QUALITY, e.target.value)) {
          pref.cubeQuality = e.target.value;
          savePref();
          await lightingStudio({ ...lightingState, cubeQuality: e.target.value });
        }
        return;
      case "studio-wear":
        if (lightingState) {
          pref.cubeWear = e.target.checked;
          savePref();
          await lightingStudio({ ...lightingState, cubeWear: e.target.checked });
        }
        return;
      case "cube-wear":
        pref.cubeWear = e.target.checked;
        applyCubeSelection();
        return;
      case "video-record-inspection":
        pref.videoRecordInspection = e.target.checked;
        savePref();
        return;
      case "video-recording":
        pref.videoRecording = e.target.checked;
        videoCapture.error = "";
        savePref();
        if (pref.videoRecording) await ensureCameraReady();
        else {
          discardVideoRecording();
          stopCameraStream();
          refreshCameraSettingsUI();
        }
        return;
      case "camera-device":
        pref.cameraDeviceId = e.target.value;
        videoCapture.error = "";
        savePref();
        refreshCameraSettingsUI(true);
        await ensureCameraReady();
        return;
      case "video-resolution":
        if (!Object.hasOwn(VIDEO_RESOLUTIONS, e.target.value)) return;
        pref.videoResolution = e.target.value;
        videoCapture.error = "";
        savePref();
        refreshCameraSettingsUI(true);
        await ensureCameraReady();
        return;
      case "video-max-seconds": {
        const seconds = Math.round(Number(e.target.value));
        pref.videoMaxSeconds = Number.isFinite(seconds) && seconds > 0 ? Math.min(3600, seconds) : 0;
        e.target.value = pref.videoMaxSeconds || "";
        savePref();
        return;
      }
      case "video-fps":
        if (!VIDEO_FPS.includes(Number(e.target.value))) return;
        pref.videoFps = Number(e.target.value);
        videoCapture.error = "";
        savePref();
        refreshCameraSettingsUI(true);
        await ensureCameraReady();
        return;
      case "demo-effect":
        playDemoEffect();
        return;
      case "alg-set":
        if (e.target.value === "__new__") {
          e.target.value = activeSet()?.id || "";
          newSet();
          return;
        }
        pref.trainerSet = e.target.value;
        trainerSelection.clear();
        break;
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
      case "mouse-click-start":
        pref.mouseClickStart = e.target.checked;
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
    if (e.target.dataset.control === "trainer-speed") {
      // The slider reads left to right as slower to faster; the scene works in
      // milliseconds per move, so the two run opposite ways.
      pref.trainerSpeed = 300 - Number(e.target.value);
      savePref();
      if (drawerScene) drawerScene.moveDuration = pref.trainerSpeed;
      return;
    }
    if (e.target.name === "count" && $("#train-form")) {
      $("#train-note").textContent = trainNote(
        $("#train-form").dataset.mode,
        Number(e.target.value),
      );
      return;
    }
    const lightingKey = e.target.dataset.lightingControl;
    if (lightingKey && lightingState && LIGHTING_CONTROLS[lightingKey]) {
      lightingState.values[lightingKey] = Number(e.target.value);
      applyLightingControls();
      const status = $("#lighting-save-status");
      if (status) {
        status.classList.remove("error");
        status.textContent = "Preview changed. Hardcode when this frame feels right.";
      }
      return;
    }
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
    $("#main").innerHTML = `<div class="loading" role="status">${CUBE_THROBBER}Loading…</div>`;
    const loadingPaint = new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 800)));
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
    if (
      ["overview", "timer", "trainer", "solves", "insights", "effects"].includes(
        initial,
      )
    )
      view = initial;
    if (seedAlgSets()) persist();
    savePref();
    startScrambler();
    await loadingPaint;
    render();
    warmCubeStudio();
    globalThis.navigator?.mediaDevices?.addEventListener?.("devicechange", () => {
      listCameraDevices();
      if (pref.videoRecording && !cameraStreamLive()) ensureCameraReady();
    });
    if (pref.videoRecording) ensureCameraReady();
  }
  init();
})();
