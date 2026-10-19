/* Optional, on-demand renderer. All geometry, textures and studio light are local. */
import * as T from "./vendor/three.module.js";
import { RoundedBoxGeometry } from "./vendor/RoundedBoxGeometry.js";
import { parseRGBE, toHalfFloat } from "./vendor/rgbe-loader.js";
// The manifest ships as a classic script (app.js cannot import), so it is read
// from the CT namespace the same way `window.CT.rotate` is.
const { ENVIRONMENTS, TUNING, REFERENCE_LUMINANCE, SCALE_CAP, SCALE_FLOOR } = window.CT_ENVIRONMENTS;

const vector = a => new T.Vector3(...a);
const rotate = (v, spec, fraction) => window.CT.rotate(v, spec.axis, spec.angle * fraction);

// What each quality level buys. Everything above "balanced" costs GPU time on
// every frame of a scramble animation, which is why it is the person's choice
// and not ours: detail adds 54 individual cap geometries,
// post adds an off-screen pass with occlusion, aberration and grain.
const QUALITY = {
  low: { pixelRatio: 1, shadows: false, detail: false, post: false },
  balanced: { pixelRatio: 2, shadows: true, detail: false, post: false },
  high: { pixelRatio: 2, shadows: true, detail: true, post: false },
  ultra: { pixelRatio: 2, shadows: true, detail: true, post: true },
  // Cinematic keeps every one of those and puts a lens in front of them. Up to
  // here each level has been a better description of the cube; this one is a
  // description of the camera looking at it, which is why it sits apart rather
  // than at the end of the same ramp. It is also the only level that changes
  // colour on purpose, and the only one that spends draw calls on something
  // other than the cube.
  cinematic: { pixelRatio: 2, shadows: true, detail: true, post: true, camera: true },
};
// The clean floor baked into the roughness map, not its mean. Every material
// that samples the map divides its calibrated roughness by this first, so
// unscratched plastic renders at exactly the value the exposure budget was
// tuned against and only the cut rises above it. `CLEAN_ROUGHNESS` in
// tools/bake-wear-textures.py is the same number; the two have to move together.
const WEAR_ROUGHNESS_FLOOR = .72;
// The supplied vinyl scan covers roughly a whole cube face, not one 19 mm
// sticker. A worn film samples about a third of the source so the broad curved
// impressions remain fingernail-sized instead of shrinking with the full sheet.
const STICKER_NORMAL_UV_SCALE = .34;
// Factory-new vinyl still has a fine printed/laminated grain. The supplied
// clean normal is mapped one full sticker at a time at a restrained strength.
const STICKER_CLEAN_NORMAL_SCALE = .30;
const STICKER_CLEAN_CLEARCOAT_NORMAL_SCALE = .12;
// The supplied handling scan is sampled more closely than the scratch sheet:
// a fingerprint spans most of a real 19 mm sticker. Its clearcoat-only strength
// stays low so the many overlapping touches read as haze, not stamped ridges.
const STICKER_HANDLING_UV_SCALE = .22;
const STICKER_HANDLING_NORMAL_SCALE = .10;
// The cutout takes the moulded rim with it. `alphaMap` removes pixels, not
// geometry, so where a tear eats into the perimeter the rolled edge that gives
// a sticker its .0072 of thickness is discarded along with everything else and
// what is left is a vertical, one-texel cut. A cut that thin has no width to
// reflect anything, which is the whole reason torn film reads as paint while
// the untorn sides of the same sticker read as film. The baked edge map is that
// rim redrawn as shading, locked to the same contour and the same UV set as the
// mask. Strength is 1: the slope is already stated in the bake, in degrees, and
// a second multiplier here would only make the two disagree.
const STICKER_EDGE_NORMAL_SCALE = 1;
// The contact line the bake puts at the foot of the wall arrives through the
// stock aoMap path, which in an environment-lit scene like this one is most of
// the light reaching that texel.
const STICKER_EDGE_OCCLUSION = 1;
// Every film is scratched, but only nine carry one of the broad curved nail
// impressions. Each entry selects a source impression, places it at a different
// local point on the film, and rotates the cut in quarter turns. The selection
// is fixed to the physical films, so dents follow their stickers through turns.
const STICKER_NAIL_CUTS = new Map([
  [0,  { source: [.23,.69], position: [ .22, .20], turns: 0 }],
  [10, { source: [.84,.74], position: [ .18,-.22], turns: 0 }],
  [15, { source: [.25,.38], position: [ .22,-.18], turns: 0 }],
  [21, { source: [.50,.16], position: [-.24,-.25], turns: 0 }],
  [29, { source: [.66,.84], position: [-.18, .22], turns: 0 }],
  [35, { source: [.23,.69], position: [ .20,-.24], turns: 2 }],
  [41, { source: [.84,.74], position: [-.20, .22], turns: 2 }],
  [45, { source: [.25,.38], position: [-.20, .24], turns: 1 }],
  [52, { source: [.66,.84], position: [-.24,-.20], turns: 3 }],
]);
// Deliberate cuts from the supplied sheet, in texture UV space, avoiding the
// recognizable curved impressions.
const STICKER_SCRATCH_CROPS = [[.50,.65], [.50,.48], [.72,.50], [.72,.25], [.82,.20], [.18,.18], [.42,.82], [.18,.84], [.82,.45]];

// Wear changes the material response as well as adding surface detail. These
// offsets are anchored to the Studio Small 08 UV calibration: its clean
// clearcoat/highlight-spread pair is .85/.070, and its worn target is
// .51/.120. Applying the delta instead of replacing the values preserves each
// model and environment's own calibration.
const WEAR_MATERIAL_OFFSET = {
  gloss: .51 - .85,
  glossRough: .120 - .070,
};
// Shape, surface and lighting are independent: OG uses the speedcube moulds
// with the existing vinyl response. A new surface need not fork turn logic.
const MODELS = {
  tiles: { shape: "tiles", surface: "tiles", rig: "tiles" },
  stickers: { shape: "tiles", surface: "vinyl", rig: "stickers" },
  speedcube: { shape: "speedcube", surface: "abs", rig: "speedcube" },
  uv: { shape: "speedcube", surface: "uv", rig: "uv" },
  og: { shape: "speedcube", surface: "vinyl", rig: "stickers" },
};
const SCULPTED = model => MODELS[model]?.shape === "speedcube";
const COATED = model => MODELS[model]?.surface === "uv";
const STICKERED = model => MODELS[model]?.surface === "vinyl";
const SEPARATE_HOLDERS = model => SCULPTED(model) && STICKERED(model);

// Vinyl keeps a reflective laminate on the surviving film. The plastic's
// additive gloss reduction would zero its .32 clearcoat and make it chalky.
const withWearMaterial = (values, wear, model) => wear ? {
  ...values,
  gloss: Math.max(0, Math.min(1, STICKERED(model) ? values.gloss * .85 : values.gloss + WEAR_MATERIAL_OFFSET.gloss)),
  glossRough: Math.max(.03, Math.min(.5, values.glossRough + (STICKERED(model) ? .02 : WEAR_MATERIAL_OFFSET.glossRough))),
} : { ...values };

// How hard each finish wears. One table, for the same reason the rigs are one
// table: as per-model ternaries these drifted into a single shared strength
// that suited none of the four.
//
// The split is not decoration. A scratch is visible through two channels — the
// slope, which bends the reflection, and the roughness, which scatters it —
// and the four finishes weight them differently. On glossy tiles the roughness
// does most of the work, because a dull line across a mirror-ish cap is
// obvious. On matte stickerless plastic there is barely any specular to dull,
// so the slope has to carry it, and the number is higher to compensate. A
// sticker is vinyl over cardboard: it scuffs and creases, it does not gouge, so
// it gets the softest treatment of the four. `uv` is the odd one: its wear
// lives in the coat rather than under it, so the plastic normal is held back
// and the clearcoat normal — which is the orange peel with the same scratches
// blended into it — is what the viewer actually sees.
const WEAR = {
  tiles:     { normal: 1.25, coat: 0 },
  stickers:  { normal: .42, coat: 0 },
  speedcube: { normal: 1.30, coat: 0 },
  // The coat was at 1.05 and the red face came out looking like a cracked
  // windscreen: a near-mirror multiplies whatever you give it, so the number
  // that reads as wear on the other three reads as damage here. It comes down,
  // and the plastic underneath comes up to keep the close view from emptying
  // out — a coated cube should still be scratched under the coat, not only in it.
  uv:        { normal: .70, coat: .80 },
};
const SURFACES = {
  tiles: { roughness: .235, bump: .00065, ior: 1.46, wear: WEAR.tiles },
  vinyl: { roughness: .32, bump: .00065, ior: 1.46, wear: WEAR.stickers },
  abs: { roughness: .30, bump: .00035, ior: 1.46, wear: WEAR.speedcube },
  uv: { roughness: .17, bump: .00012, ior: 1.52, wear: WEAR.uv },
};
// UV pools gently near the shared moulded cap perimeter.
const COATING_CENTER = .0195;

function coatingProfile() {
  const profiles = [[.480, .04, -.045], [.494, .043, -.021]];
  // A pooled coat has a low rounded shoulder. The inner falloff is deliberately
  // shorter than the previous version and uses quintic easing throughout, so it
  // never reads as a straight ramp. The small Gaussian bump is broad enough to
  // catch light but stays below the old ridge height.
  const smoother = t => { t = Math.max(0, Math.min(1, t)); return t * t * t * (t * (t * 6 - 15) + 10); };
  for (const inset of [.004, .008, .012, .016, .021, .026, .032, .038, .044, .05, .058, .068, .08, .094, .11, .128, .148, .17, .195, .22, .25, .29, .34, .4]) {
    const ridge = .004 * (inset < .042
      ? Math.exp(-(((inset - .042) / .030) ** 2))
      : 1 - smoother((inset - .042) / .12));
    const dip = .0003 * Math.exp(-(((inset - .14) / .032) ** 2));
    const t = Math.min(1, inset / .026), blend = smoother(t);
    const z = -.004 + (COATING_CENTER + ridge - dip + .004) * blend;
    profiles.push([.497 - inset, Math.min(.065, .048 + inset * .5), z]);
  }
  return profiles;
}

// One table for every model's rig, because as scattered per-model ternaries
// they drifted: three of the four ended up putting 1.5-2x the irradiance on a
// camera-facing cap that renders a sticker at its own palette value, and the
// cap washed out. ACES makes that failure worse than it sounds — it compresses
// the dominant channel of a saturated colour long before the other two, so
// surplus light arrives on screen as chalky pastel rather than as glare, which
// is why it reads as overexposure rather than as brightness.
//
// The budget: a cap facing the camera at the default orbit lands at roughly
// the palette's own value and never above it, so every other orientation falls
// below and the shading has somewhere to go.
//
// Gloss belongs in this table with the light rather than beside the other
// surface properties, because the white veil that desaturates a cap is the
// product of the two: a broad clearcoat lobe multiplied by a bright
// environment. Tuning either alone just moves the veil around.
//
// `fill` used to sit at (3, 1, 7), within 25 degrees of the view axis, so it
// added nearly its whole contribution to whichever face you were looking at —
// the one place a fill light must not land, since that face already has the
// key on it. From the camera's right and slightly below it does what a fill is
// for: it opens the shadow side, and it is now the safe lever, the one that
// lifts a turned-away face without touching the brightest one.
//
// There are two rigs and not eleven. Every photographic environment used to
// carry its own copy of these four rows — thirty-six numbers each, of which
// exactly one, `env`, was ever different — and the copies were how the newest
// five HDRs ended up with no calibration at all: they were aliased to the base
// rather than measured, because measuring meant writing another thirty-six
// numbers. The lights are the studio and only the photograph changes, so the
// photograph now changes one number. `env` here is the base reading; the
// per-environment scale that multiplies it comes from `environments.js`,
// measured from the HDR itself unless that entry overrides it.
//
// The global balance pass that used to sit under this table (exposure .84,
// env .85, glossRough 1.15, applied to every rig on the way out) is folded into
// the numbers below. It existed to darken a set of environments that were
// individually miscalibrated, which is a thing you need only while the
// calibration is wrong; keeping it as a live multiplier meant every value here
// read as something other than what it did. The rendered result is unchanged.
const RIGS = {
  // The built-in studio: luminous cards around a graded dome, all generated
  // in code. The entries here are the numbers those cards were tuned against.
  studio: {
    tiles:     { exposure: .7812, hemi: .58, key: 1.02, rim: 1.05, fill: .80, env: .340, coatEnv: 1, gloss: .46, glossRough: .1495 },
    stickers:  { exposure: .7812, hemi: .58, key: 1.06, rim: 1.05, fill: .78, env: .408, coatEnv: 1, gloss: .32, glossRough: .1955 },
    speedcube: { exposure: .7812, hemi: .45, key: 1.30, rim: .68, fill: .64, env: .408, coatEnv: 1, gloss: .16, glossRough: .1150 },
    uv:        { exposure: .8400, hemi: .72, key: 2.10, rim: .72, fill: 1.05, env: .595, coatEnv: .9, gloss: .88, glossRough: .1093 },
  },
  // Every photograph. It reads dimmer than the cards — its light sits in a few
  // hot windows and lamps rather than in wall-sized softboxes — so the same
  // caps want a little more of everything to land at the same value. `env` is
  // the reading for an environment at the reference luminance; a brighter or
  // dimmer one scales it.
  photographic: {
    tiles:     { exposure: .8400, hemi: .70, key: 1.10, rim: 1.05, fill: .85, env: .680, coatEnv: 1, gloss: .46, glossRough: .1495 },
    stickers:  { exposure: .8400, hemi: .70, key: 1.14, rim: 1.05, fill: .83, env: .765, coatEnv: 1, gloss: .32, glossRough: .1955 },
    speedcube: { exposure: .8400, hemi: .55, key: 1.40, rim: .68, fill: .70, env: .765, coatEnv: 1, gloss: .16, glossRough: .1150 },
    uv:        { exposure: .8820, hemi: .85, key: 2.20, rim: .72, fill: 1.10, env: 1.020, coatEnv: 1, gloss: .88, glossRough: .1093 },
  },
};
const baseRigFor = environment => ENVIRONMENTS[environment]?.generated ? RIGS.studio : RIGS.photographic;
const tuningFor = (model, environment) => ({
  ...baseRigFor(environment)[MODELS[model]?.rig ?? model],
  ...(TUNING?.[environment]?.[model] || {}),
});

// The controls and the renderer read the exact same numbers.
export function cubeTuning(model, environment, defaults = false) {
  const values = defaults ? baseRigFor(environment)[MODELS[model]?.rig ?? model] : tuningFor(model, environment);
  return values ? { ...values } : null;
}

// The scale that stands in for a calibration pass. Solid-angle weighting is the
// whole of it: an equirectangular map devotes as many rows to the two poles as
// to the horizon while they cover almost none of the sphere, so an unweighted
// mean is mostly a reading of the ceiling and the floor.
//
// Cost is one pass over the float data, tens of milliseconds even for a 4k map,
// paid once per file because the result is cached with it.
function measureEnvironmentScale({ width, height, data }) {
  let sum = 0, weightSum = 0;
  for (let y = 0; y < height; y++) {
    const weight = Math.sin(((y + .5) / height) * Math.PI);
    let row = 0;
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      row += .2126 * data[o] + .7152 * data[o + 1] + .0722 * data[o + 2];
    }
    sum += row * weight;
    weightSum += weight * width;
  }
  const mean = sum / weightSum;
  if (!(mean > 0)) return 1;
  return Math.min(SCALE_CAP, Math.max(SCALE_FLOOR, Math.sqrt(REFERENCE_LUMINANCE / mean)));
}

const KEY_AT = [-3.5, 6, 7], RIM_AT = [4, 3, -4], FILL_AT = [5.5, -1.5, 3.5];

// The lens Cinematic puts in front of that studio, in one table for the same
// reason RIG is one table: every entry here is a photographic decision, they
// only make sense read against each other, and as scattered literals inside a
// 200-line shader they would drift exactly the way the rigs did.
//
// What the level is trying to be: a short lens close to a small object, which
// is how a cube this size is actually photographed. That single premise fixes
// most of these numbers. Focus lands slightly in front of the cube's centre,
// because a photographer focuses on the face you are meant to read, not on the
// middle of the object. Depth of field is then shallow enough to be seen and
// no shallower, because the caps are a UI element people orbit to read state
// from — the sharp zone has to cover every cap turned toward the camera, and
// the softness has to arrive only where the cube is already turning away.
const LENS = {
  focus: 1.3,          // how far in front of the cube's centre the focal plane sits
  focusRange: 2.9,     // and how much further before the blur reaches full width
  bokeh: .006,         // bounded defocus keeps small specular highlights continuous
  bloom: .10,          // restrained optical diffusion, without veiling the plastic
  threshold: 1.1,      // isolate HDR highlights rather than saturated face colours
  knee: .45,
  // Diffusion uses a contiguous 25-tap Gaussian, sigma 4 half-resolution texels.
  halation: [1, .93, .84],   // film's halo is red-biased; a neutral one reads as fog
  distortion: .028,    // barrel, sampled outward so the frame can never crop
  aberration: .0015,   // a corrected lens: barely perceptible lateral colour
  grain: .006,
  shadowTint: [.965, .99, 1.055],   // the two ends of a restrained split-tone,
  highlightTint: [1.045, 1.005, .955],
  saturation: 1.025,
  // Shutter angle, as a fraction of the interval between two drawn frames. A
  // real camera's shutter is open for part of that interval, not all of it;
  // 180 degrees is the cinema convention and what keeps a fast turn readable
  // instead of dissolving into a smudge.
  shutter: .55,
};

// Spend samples where the displayed image can retain them. Eight samples at a
// 2x canvas are useful on the normal preview, but become a large transient VRAM
// allocation in the full-screen studio without adding visible edge coverage.
// The shadow follows the same rule: a 2048 map cannot resolve more detail than
// a compact target can show after defocus and the VSM filter.
const CINEMATIC_BUDGET = {
  maxEightSamplePixels: 2_000_000,
  compactShadowEdge: 900,
  // Cube Studio can cover most of a large monitor. A DPR cap alone does not
  // protect that path: 1x at 2560x1400 is still 3.6 million fragments, each
  // running the lens, depth-of-field and occlusion shader. Match its moving
  // frame to the pixel count of the already-fluid timer preview, then spend a
  // larger but bounded budget on the final still after the pointer is released.
  maxInteractionPixels: 900_000,
  maxAnimationPixels: 2_000_000,
  maxStillPixels: 4_000_000,
};

// The cube's internals, seen through the gaps and while a layer is mid-turn.
// Colour is the whole choice: every option is the same moulded plastic, so the
// finish is written once here instead of once per colour. The White option is
// intentionally dark grey so the recessed core reads as shadowed without
// relying on unavailable ambient occlusion. Ids match CUBE_CORES in app.js.
const CORE_FINISH = {
  white: { color: 0x4a4d50, roughness: .34, clearcoat: .30, clearcoatRoughness: .16, env: .52 },
  black: { color: 0x16181b, roughness: .32, clearcoat: .30, clearcoatRoughness: .16, env: .34 },
  green: { color: 0x1d7a45, roughness: .33, clearcoat: .30, clearcoatRoughness: .16, env: .40 },
};
const CORE = id => Object.hasOwn(CORE_FINISH, id) ? id : "black";

// The procedural maps are deterministic: fixed seeds, no inputs, the same bytes
// for every cube that has ever been built. Rebuilding them per instance was
// costing well over a tenth of a second of main-thread CPU on every spawn — most
// of it the coat's normal map, which evaluates three octaves of noise four times
// per texel across 512x512 — and it was being spent at exactly the moment the
// cube was supposed to be animating in. They are built once and shared, which is
// also why nothing disposes them: another live cube is using the same texture.
const SHARED = new Map();
const sharedMap = (key, build) => {
  if (!SHARED.has(key)) SHARED.set(key, build());
  return SHARED.get(key);
};
// Bump this when the baked atlas changes so an already-open app cannot keep
// rendering a stale alpha mask from the previous session.
const STICKER_WEAR_MAP_KEY = "wear-sticker-alpha-v7";
const STICKER_NORMAL_MAP_KEY = "wear-sticker-normal-v1";
const STICKER_CLEAN_NORMAL_MAP_KEY = "sticker-clean-normal-v1";
const STICKER_HANDLING_MAP_KEY = "wear-sticker-handling-v1";
const STICKER_HANDLING_NORMAL_MAP_KEY = "wear-sticker-handling-normal-v1";
const STICKER_EDGE_MAP_KEY = "wear-sticker-edge-v1";

// Photographic environments ship as Radiance RGBE files. Fetched once and held
// as raw floats; the PMREM step needs a renderer and so happens per cube.
const ENV_CACHE = new Map();
function loadEnvironment(name) {
  if (!ENV_CACHE.has(name)) {
    const entry = ENVIRONMENTS[name];
    ENV_CACHE.set(name, entry?.file
      ? fetch(new URL(`./${entry.file}`, import.meta.url).href)
          .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.arrayBuffer(); })
          .then(buffer => {
            const parsed = parseRGBE(new Uint8Array(buffer));
            if (!parsed) throw new Error(`Unrecognized HDR file: ${name}`);
            // Measured here rather than at use, so the cost is paid once per
            // file and every cube built from it inherits the same reading.
            parsed.scale = entry.envScale ?? measureEnvironmentScale(parsed);
            return parsed;
          })
      : Promise.reject(new Error(`Unknown environment: ${name}`)));
  }
  return ENV_CACHE.get(name);
}

// One live renderer per slot ("cube-mount", "drawer-cube", "appearance-cube").
// A WebGL context, a prefiltered environment and a compiled shader set are the
// expensive half of a cube and none of them depend on the scramble, so tearing
// them down for each new scramble paid the entire construction cost to arrive at
// an identical renderer. A slot keeps its cube across scene rebuilds and only
// rebuilds when the model or the quality actually changes.
const STUDIO = new Map();
// Appearance keeps at most the five realistic models for one configuration.
// Parked canvases retain compiled shaders; all are freed with the dialog.
const APPEARANCE_MODELS = new Map();
let appearanceConfiguration = "";

// Build the shared maps ahead of the first cube. The app calls this while the
// browser is idle so the first spawn does not pay for them.
export function warmCube(model = "tiles", quality = "balanced", environment = "studio", wear = false) {
  sharedMap("grain", plasticGrain);
  if (STICKERED(model)) sharedMap(STICKER_CLEAN_NORMAL_MAP_KEY, stickerCleanNormalMap);
  if (wear) {
    sharedMap("wear-normal", scratchNormalMap);
    sharedMap("wear-roughness", scratchRoughnessMap);
    if (STICKERED(model)) {
      sharedMap(STICKER_NORMAL_MAP_KEY, stickerScratchNormalMap);
      sharedMap(STICKER_HANDLING_MAP_KEY, stickerHandlingMap);
      sharedMap(STICKER_HANDLING_NORMAL_MAP_KEY, stickerHandlingNormalMap);
      sharedMap(STICKER_WEAR_MAP_KEY, stickerDamageMap);
    }
    if (COATED(model)) sharedMap("wear-uv-normal", scratchClearcoatNormalMap);
  }
  if (COATED(model)) sharedMap("coating", () => coatingNormal());
  if (environment !== "studio") loadEnvironment(environment);
}

// Hand back the slot's cube, adopting it into `stage` when it can be reused and
// building a new one when it cannot. Environment is part of the identity: a
// slot built for the studio cannot become a different photographic cube by adoption.
export function acquireCube(slot, stage, onUnavailable, model, quality, environment = "studio", wear = false, core = "black", onReady, options = {}) {
  if (slot === "appearance-cube") {
    const configuration = [quality, environment, wear, CORE(core)].join("|");
    if (configuration !== appearanceConfiguration) {
      discardCube(slot);
      appearanceConfiguration = configuration;
    }
    const previous = STUDIO.get(slot);
    if (previous && previous.model !== model) previous.park();
    let cube = APPEARANCE_MODELS.get(model);
    if (!cube || cube.disposed) {
      cube = new RealisticCube(stage, onUnavailable, model, quality, environment, wear, core, options);
      cube.onReady = onReady;
      cube.slot = slot;
      APPEARANCE_MODELS.set(model, cube);
    } else cube.adopt(stage, onUnavailable, onReady);
    STUDIO.set(slot, cube);
    return cube;
  }
  const live = STUDIO.get(slot);
  if (live && !live.disposed && live.model === model && live.quality === quality && live.environment === environment && live.wear === wear && live.core === CORE(core)) {
    live.adopt(stage, onUnavailable, onReady);
    return live;
  }
  live?.destroy();
  const cube = new RealisticCube(stage, onUnavailable, model, quality, environment, wear, core, options);
  cube.onReady = onReady;
  cube.slot = slot;
  STUDIO.set(slot, cube);
  return cube;
}

// The Trainer's case cards share one cube. It renders each case to a still on a
// hidden stage, and a card being dragged borrows its live canvas until release,
// so dozens of cards cost one WebGL context instead of one each. It is pinned to
// Low quality and the studio room: at card size the higher tiers add nothing the
// eye can resolve, and the studio keeps the first frame synchronous.
export function acquirePreviewCube(slot, stage, onUnavailable, model, wear = false, core = "black") {
  return acquireCube(slot, stage, onUnavailable, model, "low", "studio", wear, core, undefined, { preserveDrawingBuffer: true });
}

// Park the slot's cube: it leaves the DOM but keeps its context, so the next
// scramble adopts it instead of paying for a new one.
export function releaseCube(slot) {
  const live = STUDIO.get(slot);
  if (live && !live.disposed) live.park();
}

// Give the slot up for good — for a cube whose mount disappears with its dialog.
export function discardCube(slot) {
  if (slot === "appearance-cube") {
    for (const cube of APPEARANCE_MODELS.values()) cube.destroy();
    APPEARANCE_MODELS.clear();
    appearanceConfiguration = "";
  }
  STUDIO.get(slot)?.destroy();
}

function plasticGrain() {
  const data = new Uint8Array(128 * 128 * 4);
  let seed = 173;
  for (let i = 0; i < data.length; i += 4) {
    seed = (1664525 * seed + 1013904223) >>> 0;
    const value = 180 + (seed >>> 27);
    data[i] = data[i + 1] = data[i + 2] = value;
    data[i + 3] = 255;
  }
  const texture = new T.DataTexture(data, 128, 128);
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.magFilter = T.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function valueNoise() {
  // Tiling value noise for the coat's orange peel and studio diffusion.
  const hash = (x, y, salt) => {
    let h = (x * 374761393 + y * 668265263 + salt * 987654323) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177) | 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const noise = (u, v, freq, salt) => {
    const x = u * freq, y = v * freq;
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = x - x0, fy = y - y0;
    const ease = t => t * t * (3 - 2 * t);
    const sx = ease(fx), sy = ease(fy);
    // Wrapping the lattice at the frequency keeps the texture seamless.
    const at = (i, j) => hash(((x0 + i) % freq + freq) % freq, ((y0 + j) % freq + freq) % freq, salt);
    const top = at(0, 0) + (at(1, 0) - at(0, 0)) * sx;
    const bottom = at(0, 1) + (at(1, 1) - at(0, 1)) * sx;
    return top + (bottom - top) * sy;
  };
  return noise;
}

function wearTexture(file, name, mipmaps = true) {
  const listeners = [], url = new URL(`./wear/${file}`, import.meta.url).href;
  const texture = new T.TextureLoader().load(url, () => {
    texture.userData.loaded = true;
    listeners.splice(0).forEach(listener => listener(true));
  }, undefined, () => {
    texture.userData.failed = true;
    listeners.splice(0).forEach(listener => listener(false));
  });
  texture.name = name;
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.minFilter = mipmaps ? T.LinearMipmapLinearFilter : T.LinearFilter;
  texture.magFilter = T.LinearFilter;
  texture.generateMipmaps = mipmaps;
  texture.userData.listeners = listeners;
  return texture;
}

function scratchNormalMap() {
  // The scratches are already vector-blended into this static texture. Runtime
  // only samples the finished normal.
  //
  // Mipmapped, unlike the version before it. A cap is about 1024 texels of this
  // map inside 145 device pixels, so the hardware is minifying seven to one no
  // matter what; the choice is between a filtered average and a point sample of
  // one texel in fifty, and the unfiltered one boils as the cube turns. The
  // features are now wide enough to survive three mip levels, which is what
  // makes the filtered path affordable — it was not, when they were hairlines.
  return wearTexture("worn-plastic-normal.png", "Worn plastic normal");
}

function scratchRoughnessMap() {
  return wearTexture("worn-plastic-roughness.png", "Worn plastic roughness");
}

function stickerScratchNormalMap() {
  // Channel 2 is a vinyl-only UV set. Plastic wear and the sticker damage atlas
  // retain their original mappings on channels 0 and 1.
  const texture = wearTexture("worn-sticker-normal.png", "Worn sticker normal");
  texture.channel = 2;
  return texture;
}

function stickerCleanNormalMap() {
  // Channel 0 is the ordinary sticker UV: one supplied material tile per film.
  return wearTexture("sticker-clean-normal.png", "Clean sticker normal");
}

function stickerHandlingMap() {
  // Scuff haze and handled-surface mottle, without fingerprints or the retired
  // scratch pattern from the plastic roughness map.
  return wearTexture("worn-sticker-handling.png", "Worn sticker handling");
}

function stickerHandlingNormalMap() {
  const texture = wearTexture("worn-sticker-handling-normal.png", "Worn sticker handling normal");
  texture.channel = 3;
  return texture;
}

function scratchClearcoatNormalMap() {
  // UV wear is baked into the orange-peel normal so scratches bend the topmost,
  // dominant reflection rather than hiding underneath the clear layer.
  return wearTexture("worn-uv-clearcoat-normal.png", "Worn UV clearcoat normal");
}

function stickerDamageMap() {
  // Alpha uses UV channel 1: unlike the scratch maps, chipped vinyl has to stay
  // attached to the sticker perimeter. Each 256px tile has a transparent
  // gutter; mipmaps filter the torn edge when the cube is small or oblique.
  const texture = wearTexture("worn-sticker-alpha.png?v=7", "Worn sticker cutout");
  texture.channel = 1;
  texture.wrapS = texture.wrapT = T.ClampToEdgeWrapping;
  return texture;
}

function stickerEdgeMap() {
  // Rides the cutout's UV channel and its 8x8 tiling because it has to: a lip
  // drawn against a contour the mask does not actually cut is worse than no lip
  // at all. tools/bake-wear-textures.py emits the two files from one distance
  // field for that reason -- rebake both or neither.
  //
  // R is contact occlusion, G and B are the lip normal's XY. Z is reconstructed
  // in the shader rather than stored, which is what lets one RGB texture bound
  // as `aoMap` carry both and costs this effect no sampler of its own.
  const texture = wearTexture("worn-sticker-edge.png?v=1", "Worn sticker edge");
  texture.channel = 1;
  texture.wrapS = texture.wrapT = T.ClampToEdgeWrapping;
  return texture;
}

function coatingNormal(size = 512, strength = .30) {
  // Orange peel: what a sprayed, UV-cured coat actually looks like. The coat
  // does not copy the plastic's micro-texture, it floods it and sets with its
  // own long, shallow undulation, so a softbox reflected in it wanders instead
  // of holding a razor edge. This is the difference between a coated cube and
  // a merely polished one, and it lives in the clearcoat normal rather than in
  // roughness: the surface stays a mirror, the mirror is just not flat.
  const noise = valueNoise();
  const height = (u, v) => noise(u, v, 5, 5) * 1.2 + noise(u, v, 17, 6) * .24 + noise(u, v, 53, 7) * .035;
  const data = new Uint8Array(size * size * 4);
  const step = 1 / size;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    // Central differences on the height field, scaled to a gentle slope. Too
    // much here reads as hammered metal; the real defect is barely a degree.
    const dx = (height(u + step, v) - height(u - step, v)) * strength;
    const dy = (height(u, v + step) - height(u, v - step)) * strength;
    const length = Math.hypot(dx, dy, 1);
    const i = (y * size + x) * 4;
    data[i] = Math.round((-dx / length * .5 + .5) * 255);
    data[i + 1] = Math.round((-dy / length * .5 + .5) * 255);
    data[i + 2] = Math.round((1 / length * .5 + .5) * 255);
    data[i + 3] = 255;
  }
  const texture = new T.DataTexture(data, size, size);
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.magFilter = T.LinearFilter;
  // Mipmapped, unlike the other procedural maps here. A near-mirror surface
  // samples this at a shallow angle across a cap a couple of hundred pixels
  // wide, and unfiltered it boils into speckle the moment the cube turns.
  texture.minFilter = T.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.repeat.set(1, 1);
  texture.needsUpdate = true;
  return texture;
}

function capVariants() {
  // One entry per cap: its texture offset and tiny moulding-colour variation.
  // Deterministic, so a cube looks the same every time it is built.
  let seed = 991;
  const next = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
  return Array.from({ length: 54 }, (_, index) => {
    const shift = [next(), next()];
    const tint = [1 + (next() - .5) * .035, 1 + (next() - .5) * .035, 1 + (next() - .5) * .035];
    // Unique film outlines without changing the scratch/tint random sequence.
    const chip = index;
    return { shift, tint, chip, cell: index % 9 };
  });
}

function softboxMap(size = 128) {
  // A diffusion panel has a bright center and feathered edges. A solid white
  // rectangle clips to a flat patch and makes the reflection look painted on.
  const noise = valueNoise(), data = new Uint8Array(size * size * 4);
  const smooth = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / (size - 1), v = y / (size - 1);
    const edge = smooth(Math.min(u, 1 - u) / .13) * smooth(Math.min(v, 1 - v) / .10);
    const value = edge * (.68 + .25 * Math.sin(Math.PI * u) * Math.sin(Math.PI * v) + .07 * noise(u, v, 6, 29));
    const i = (y * size + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = Math.round(value * 255);
    data[i + 3] = 255;
  }
  const texture = new T.DataTexture(data, size, size);
  texture.minFilter = texture.magFilter = T.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

const VINYL_PROFILE = [[.399, .0618, 0], [.4009, .0627, .0036], [.399, .0618, .0072], [.38, .057, .0072], [.304, .057, .0072], [.114, .038, .0072]];
// Where a shaped film's contour lands in the damage atlas. These used to be the
// atlas's own outline -- .435, the radius `sticker_damage_atlas()` draws its
// rounded square at -- on the reasonable-sounding theory that the film's edge
// should sit on the mask's edge. But the mask's edge is its *fifty percent*
// contour, so putting the film's outer rings there put them exactly on
// `alphaTest`, and the three rings that carry the film's .0072 of thickness
// read .24, .00 and .35. Every OG sticker had its moulded rim discarded, torn
// or not, which left a flat plate with stair-stepped corners -- the model's
// stickers had no thickness anywhere, and no tear was involved.
//
// So the contour is inset three texels (.0117 of a tile) instead. Three is not
// a guess: at two the rim still fades to .83 once the mip chain is two levels
// down, at three it holds .97 there and .78 at mip 3, well clear of the test,
// and each further texel costs visible damage -- 48 of the 54 films keep a
// bite at three, 44 at four, and only 33 at the nine texels that would match
// the Stickers model's physical mapping. The rest of the profile is scaled by
// the same ratio so the wrap stays proportional.
const VINYL_ATLAS_PROFILE = [[.4233, .0633], [.4252, .0652], [.4233, .0642], [.3892, .0584], [.3114, .0584], [.1168, .0389]];
const OG_VINYL_PROFILE = [[.400, .044, .0206], [.402, .046, .0242], [.400, .044, .0278], [.38, .05, .0278], [.30, .055, .0278], [.12, .04, .0278]];
const SCULPTED_PROFILE = [[.48,.04,-.045], [.494,.043,-.021], [.497,.048,-.004], [.4875,.0499,.00151], [.4775,.052,.00634], [.4673,.054,.01047], [.4568,.0562,.01388], [.4461,.0583,.01655], [.4353,.0605,.01846], [.4243,.0628,.01962], [.4133,.065,.02], [.32,.07,.02], [.12,.05,.02]];
const SCULPTED_CENTER_RINGS = [[.48,.04,-.045,1], [.494,.043,-.021,1], [.497,.052,-.004,1], [.4875,.0539,.00151,.975], [.4775,.056,.00634,.929], [.4673,.058,.01047,.88], [.4568,.0602,.01388,.83], [.4461,.0623,.01655,.779], [.4353,.0645,.01846,.731], [.4243,.0668,.01962,.687], [.4133,.065,.02,.643], [.365,.068,.02,.45], [.32,.07,.02,.2], [.285,.068,.02,0], [.195,.06,.02,0], [.12,.05,.02,0]];
const UV_CENTER_RINGS = [[.480,.040,-.045,1], [.494,.043,-.021,1], [.497,.160,-.004,1], [.490,.170,.004,1], [.475,.210,.008,.95], [.465,.250,.013,.75], [.460,.300,.018,.45], [.445,.350,.024,0], [.365,.365,.0215,0], [.285,.285,.020,0], [.195,.195,COATING_CENTER,0], [.120,.120,COATING_CENTER,0]];

function faceGeometry(model = "tiles", cell = 4, variant = null, layer = STICKERED(model) ? "sticker" : "cap") {
  const film = layer === "sticker", shapedFilm = film && SCULPTED(model);
  // Concentric rounded-square contours form a molded, slightly convex cap.
  // The crown bends softbox reflections across the face instead of leaving a
  // perfectly flat, sticker-like surface. Shared vertices keep shoulders smooth.
  const profiles = film
    ? shapedFilm ? OG_VINYL_PROFILE : VINYL_PROFILE
    : COATED(model)
      ? coatingProfile()
    : SCULPTED(model)
      // Flat crown, curvature only in a fillet at the rim. The cap used to rise all
      // the way from the shoulder to its center -- 0.011 over 0.36, about a fifth of
      // a millimetre at cube scale. Invisible as height, but a mirror reflects slope
      // and doubles it, and a rounded square cannot dome evenly: its diagonal travels
      // sqrt(2) farther for the same rise, so the axial and diagonal slopes meet in a
      // crease and every cap wore an X in its reflection. A flat crown has one normal
      // and cannot. The fillet is a true circular arc, tangent to the crown, so its
      // slope grows from 0 to 32 degrees without the lip an ease-in-out leaves.
      ? SCULPTED_PROFILE
      : [[.423, .092, 0], [.444, .108, .010], [.450, .116, .026], [.446, .122, .044], [.432, .127, .060], [.392, .134, .070], [.32, .12, .078], [.23, .09, .085], [.12, .05, .089]];
  const col = cell % 3 - 1, row = 1 - Math.floor(cell / 3);
  const positions = [], uvs = [], chipUvs = [], stickerNormalUvs = [], handlingUvs = [], shades = [], indices = [], steps = 12;
  // Straight spans are sampled on the coated model only. Sampling them on every
  // model was tried and reverted: it doubles every cap and changes the shading
  // normals by hundredths of a degree. The X across a sculpted cap is not a
  // tessellation artifact. A rounded square shrinking toward the center travels
  // sqrt(2) farther along its diagonal than along its axis for the same rise, so
  // the diagonal slope is roughly half the axial one and the two meet in a real
  // crease -- a hip roof, not a dome. Rounding the crown toward a circle is what
  // removes it, which is what the centers already do with their squareMix column.
  const sideSteps = COATED(model) ? 12 : 0, count = 4 * (steps + 1 + sideSteps);
  // Fake contact occlusion. The groove where two pieces meet is far too small
  // for a shadow map to resolve, but the eye reads its absence as "rendered by
  // a computer", so rings sitting deeper than the crown darken toward AO_FLOOR.
  const AO_FLOOR = SCULPTED(model) && !film ? .55 : undefined;
  const depths = profiles.map(profile => profile[2]), lowest = Math.min(...depths);
  const span = (Math.max(...depths) - lowest || 1) * .7;
  // The moulding tint rides in the same attribute as the occlusion, so per-cap
  // variation costs one buffer instead of 54 materials. Corner wear was tried
  // here too and removed: a term that peaks at the corner arcs and falls to zero
  // between them interpolates across these coarse rings as a four-pointed star.
  const tint = variant && variant.tint ? variant.tint : [1, 1, 1];
  const shift = variant ? variant.shift : [0, 0];
  const chip = variant?.chip ?? 0;
  // Every sticker gets a cut and a quarter-turn variation. Most cuts contain
  // ordinary scratches only; the sparse group is centered on the nail dents.
  // Quarter turns keep the square crop inside the non-tileable source image.
  const nailCut = STICKER_NAIL_CUTS.get(chip);
  const stickerNormalRoll = (nailCut?.turns ?? chip * 3 % 4) * Math.PI / 2;
  const c = Math.cos(stickerNormalRoll), s = Math.sin(stickerNormalRoll);
  let stickerNormalCenterU, stickerNormalCenterV;
  if (nailCut) {
    const [targetU, targetV] = nailCut.position;
    const rotatedTargetU = targetU * c - targetV * s;
    const rotatedTargetV = targetU * s + targetV * c;
    stickerNormalCenterU = nailCut.source[0] - rotatedTargetU * STICKER_NORMAL_UV_SCALE;
    stickerNormalCenterV = nailCut.source[1] - rotatedTargetV * STICKER_NORMAL_UV_SCALE;
  } else {
    [stickerNormalCenterU, stickerNormalCenterV] = STICKER_SCRATCH_CROPS[chip % STICKER_SCRATCH_CROPS.length];
  }
  const stickerNormalUv = (x, y) => {
    const u = x / .9, v = y / .9;
    const ru = u * c - v * s, rv = u * s + v * c;
    return [
      stickerNormalCenterU + ru * STICKER_NORMAL_UV_SCALE,
      stickerNormalCenterV + rv * STICKER_NORMAL_UV_SCALE,
    ];
  };
  // Sample a different close crop of the handling sheet on every film. Quarter
  // turns keep the crop inside the non-tileable texture while the seeded shift
  // avoids cloned haze on neighbouring stickers.
  const handlingRoll = chip % 4 * Math.PI / 2;
  const handlingC = Math.cos(handlingRoll), handlingS = Math.sin(handlingRoll);
  const handlingSpan = 1 - STICKER_HANDLING_UV_SCALE;
  const handlingCenterU = STICKER_HANDLING_UV_SCALE / 2 + shift[0] * handlingSpan;
  const handlingCenterV = STICKER_HANDLING_UV_SCALE / 2 + shift[1] * handlingSpan;
  const handlingUv = (x, y) => {
    const u = x / .9, v = y / .9;
    return [
      handlingCenterU + (u * handlingC - v * handlingS) * STICKER_HANDLING_UV_SCALE,
      handlingCenterV + (u * handlingS + v * handlingC) * STICKER_HANDLING_UV_SCALE,
    ];
  };
  // The alpha atlas is 8x8. Its coordinates are deliberately derived from the
  // unshifted cap position: scratches may roll to a unique patch on each cap,
  // but a missing piece of vinyl must remain locked to a real sticker edge.
  // The baked PNG is indexed top-to-bottom in both tile rows and pixels, while
  // WebGL samples textures from the bottom. Flip the atlas row; the bake uses
  // upward local Y, so local Y stays positive. Scratch UVs are independent.
  const atlasRow = 7 - Math.floor(chip / 8);
  const chipUv = (x, y) => [(chip % 8 + x + .5) / 8, (atlasRow + y + .5) / 8];
  // Reuse the damage atlas by wrapping its rounded-square perimeter onto each
  // film outline. Tears stay at the real edge of D-shaped and circular stickers.
  // Scratch UVs remain in physical face coordinates and are not stretched.
  const filmChipUv = (ring, i) => {
    const [h, r] = VINYL_ATLAS_PROFILE[ring], corner = Math.floor(i / (steps + 1));
    const [sx, sy] = [[1,1],[-1,1],[-1,-1],[1,-1]][corner];
    const angle = (corner + i % (steps + 1) / steps) * Math.PI / 2;
    return chipUv(sx * (h - r) + r * Math.cos(angle), sy * (h - r) + r * Math.sin(angle));
  };
  // A variant carrying only a shift wants a different patch of the wear map,
  // not a different colour, and must not drag a whole unused colour attribute
  // along with it — that is the cheap form used below detail quality.
  const shaded = AO_FLOOR !== undefined || (variant !== null && variant.tint !== undefined);
  if (SCULPTED(model) && cell === 4) {
    // The speedcube and UV center share the same molded footprint: a softly
    // rounded octagonal square flowing into a circular inner cap. UV keeps
    // the longer, coated shoulder; the uncoated speedcube uses its original
    // shallower profile and center height.
    const centerRings = shapedFilm ? profiles.map(([h, r, z]) => [h, r, z, 0]) : COATED(model) ? UV_CENTER_RINGS : SCULPTED_CENTER_RINGS;
    const radialPositions = [], radialUvs = [], radialChipUvs = [], radialStickerNormalUvs = [], radialHandlingUvs = [], radialShades = [], radialIndices = [];
    for (const [ring, [h, r, z, squareMix]] of centerRings.entries()) {
      const t = Math.min(1, (z - lowest) / span), ramp = t * t * (3 - 2 * t);
      const shade = AO_FLOOR === undefined ? 1 : AO_FLOOR + (1 - AO_FLOOR) * ramp;
      const squarePoints = chamferedSquareContour(h, count);
      for (let i = 0; i < count; i++) {
        const theta = i / count * Math.PI * 2;
        const circleX = Math.cos(theta) * h, circleY = Math.sin(theta) * h;
        const x = circleX + (squarePoints[i][0] - circleX) * squareMix;
        const y = circleY + (squarePoints[i][1] - circleY) * squareMix;
        radialPositions.push(x, y, z);
        radialUvs.push(x / .9 + .5 + shift[0], y / .9 + .5 + shift[1]);
        if (film) radialChipUvs.push(...filmChipUv(ring, i));
        if (film) radialStickerNormalUvs.push(...stickerNormalUv(x, y));
        if (film) radialHandlingUvs.push(...handlingUv(x, y));
        if (shaded) radialShades.push(shade * tint[0], shade * tint[1], shade * tint[2]);
      }
    }
    for (let ring = 0; ring < centerRings.length - 1; ring++) for (let i = 0; i < count; i++) {
      const a = ring * count + i, b = ring * count + (i + 1) % count;
      radialIndices.push(a, b, a + count, b, b + count, a + count);
    }
    const radialCenter = radialPositions.length / 3;
    const centerHeight = shapedFilm ? .0278 : COATED(model) ? COATING_CENTER : .020;
    radialPositions.push(0, 0, centerHeight); radialUvs.push(.5 + shift[0], .5 + shift[1]);
    if (film) radialChipUvs.push(...chipUv(0, 0));
    if (film) radialStickerNormalUvs.push(...stickerNormalUv(0, 0));
    if (film) radialHandlingUvs.push(...handlingUv(0, 0));
    if (shaded) radialShades.push(tint[0], tint[1], tint[2]);
    const radialLast = (centerRings.length - 1) * count;
    for (let i = 0; i < count; i++) radialIndices.push(radialLast + i, radialLast + (i + 1) % count, radialCenter);
    const radialGeometry = new T.BufferGeometry();
    radialGeometry.setAttribute("position", new T.Float32BufferAttribute(radialPositions, 3));
    radialGeometry.setAttribute("uv", new T.Float32BufferAttribute(radialUvs, 2));
    if (shaded) radialGeometry.setAttribute("color", new T.Float32BufferAttribute(radialShades, 3));
    if (film) radialGeometry.setAttribute("uv1", new T.Float32BufferAttribute(radialChipUvs, 2));
    if (film) radialGeometry.setAttribute("uv2", new T.Float32BufferAttribute(radialStickerNormalUvs, 2));
    if (film) radialGeometry.setAttribute("uv3", new T.Float32BufferAttribute(radialHandlingUvs, 2));
    radialGeometry.userData.stickerNail = Boolean(nailCut);
    radialGeometry.userData.stickerNailPosition = nailCut?.position ?? null;
    radialGeometry.setIndex(radialIndices);
    radialGeometry.computeVertexNormals();
    const radialNormals = radialGeometry.getAttribute("normal");
    for (let i = 0; i < radialNormals.count; i++) {
      const nx = radialNormals.getX(i), ny = radialNormals.getY(i), nz = radialNormals.getZ(i);
      const length = Math.hypot(nx, ny, nz);
      if (!Number.isFinite(length) || length < 1e-6) radialNormals.setXYZ(i, 0, 0, 1);
      else radialNormals.setXYZ(i, nx / length, ny / length, nz / length);
    }
    return radialGeometry;
  }
  for (const [ring, [h, r, z]] of profiles.entries()) {
    const t = Math.min(1, (z - lowest) / span), ramp = t * t * (3 - 2 * t);
    const shade = AO_FLOOR === undefined ? 1 : AO_FLOOR + (1 - AO_FLOOR) * ramp;
    [[1, 1], [-1, 1], [-1, -1], [1, -1]].forEach(([sx, sy], corner) => {
      // Large inside radii and nearly square outside corners match the cutouts
      // of a stickerless speedcube. Geometry is tied to the sticker's identity,
      // so its molded shape travels correctly through every turn.
      const inner = (!col || sx === -col) && (!row || sy === -row);
      const radius = SCULPTED(model) && inner ? Math.min(h * .88, (cell === 4 ? .375 : col && row ? .065 : .31) * h / .497) : r;
      const cx = sx * (h - radius), cy = sy * (h - radius);
      const contour = [];
      for (let step = 0; step <= steps; step++) {
        const angle = (corner + step / steps) * Math.PI / 2;
        contour.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
      }
      // Straight spans also need samples. Corner-only rings interpolate their
      // normals across huge triangles, leaving an X-shaped dent in reflections.
      if (sideSteps) {
        const [nx, ny] = [[-1, 1], [-1, -1], [1, -1], [1, 1]][corner];
        const nextInner = (!col || nx === -col) && (!row || ny === -row);
        // Mirror the radius rule above exactly. Only sculpted caps take the wide
        // inside radius; reading it here for a model that does not use it aims the
        // span at an endpoint the corner arc never reaches, and the side folds back.
        const nextRadius = SCULPTED(model) && nextInner ? Math.min(h * .88, (cell === 4 ? .375 : col && row ? .065 : .31) * h / .497) : r;
        const angle = (corner + 1) * Math.PI / 2;
        const end = [nx * (h - nextRadius) + nextRadius * Math.cos(angle), ny * (h - nextRadius) + nextRadius * Math.sin(angle)];
        const start = contour.at(-1);
        for (let i = 1; i <= sideSteps; i++) {
          const t = i / (sideSteps + 1);
          contour.push([start[0] + (end[0] - start[0]) * t, start[1] + (end[1] - start[1]) * t]);
        }
      }
      for (let contourIndex = 0; contourIndex < contour.length; contourIndex++) {
        let [x, y] = contour[contourIndex];
        if (SCULPTED(model)) {
          // Miter the outside edges where two colored sides meet. Without this,
          // their beveled skirts intersect and shimmer as the cube rotates.
          const boundary = .487 + z - .001;
          if (col && x * col > boundary) x = col * boundary;
          if (row && y * row > boundary) y = row * boundary;
        }
        positions.push(x, y, z); uvs.push(x / .9 + .5 + shift[0], y / .9 + .5 + shift[1]);
        if (film) chipUvs.push(...(shapedFilm ? filmChipUv(ring, corner * (steps + 1) + contourIndex) : chipUv(x, y)));
        if (film) stickerNormalUvs.push(...stickerNormalUv(x, y));
        if (film) handlingUvs.push(...handlingUv(x, y));
        if (shaded) shades.push(shade * tint[0], shade * tint[1], shade * tint[2]);
      }
    });
  }
  for (let ring = 0; ring < profiles.length - 1; ring++) {
    for (let i = 0; i < count; i++) {
      const a = ring * count + i, b = ring * count + (i + 1) % count;
      indices.push(a, b, a + count, b, b + count, a + count);
    }
  }
  const center = positions.length / 3;
  positions.push(0, 0, film ? shapedFilm ? .0278 : .0072 : COATED(model) ? COATING_CENTER : SCULPTED(model) ? .020 : .090); uvs.push(.5 + shift[0], .5 + shift[1]); if (film) { chipUvs.push(...chipUv(0, 0)); stickerNormalUvs.push(...stickerNormalUv(0, 0)); handlingUvs.push(...handlingUv(0, 0)); } if (shaded) shades.push(tint[0], tint[1], tint[2]);
  const last = (profiles.length - 1) * count;
  for (let i = 0; i < count; i++) indices.push(last + i, last + (i + 1) % count, center);
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
  if (film) geometry.setAttribute("uv1", new T.Float32BufferAttribute(chipUvs, 2));
  if (film) geometry.setAttribute("uv2", new T.Float32BufferAttribute(stickerNormalUvs, 2));
  if (film) geometry.setAttribute("uv3", new T.Float32BufferAttribute(handlingUvs, 2));
  geometry.userData.stickerNail = Boolean(nailCut);
  geometry.userData.stickerNailPosition = nailCut?.position ?? null;
  if (shaded) geometry.setAttribute("color", new T.Float32BufferAttribute(shades, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  // The shared miter can collapse a few shoulder triangles at outer corners.
  // Their unused vertices still need a valid normal for every surface finish.
  const computedNormals = geometry.getAttribute("normal");
  for (let i = 0; i < computedNormals.count; i++) {
    if (Math.hypot(computedNormals.getX(i), computedNormals.getY(i), computedNormals.getZ(i)) < 1e-6)
      computedNormals.setXYZ(i, 0, 0, 1);
  }
  if (COATED(model)) {
    // Differentiate the surface along its rings, avoiding triangle-area bias
    // where the rounded shoulders join the broad, almost-flat crown.
    const p = geometry.getAttribute('position'), normal = geometry.getAttribute('normal');
    const a = new T.Vector3(), b = new T.Vector3(), tangent = new T.Vector3(), radial = new T.Vector3();
    for (let ring = 0; ring < profiles.length; ring++) for (let i = 0; i < count; i++) {
      const index = ring * count + i;
      a.fromBufferAttribute(p, ring * count + (i + count - 1) % count);
      b.fromBufferAttribute(p, ring * count + (i + 1) % count);
      tangent.subVectors(b, a);
      // Miter clipping can collapse adjacent samples at an outside corner.
      // Find the actual perimeter direction instead of emitting a zero normal.
      for (let reach = 2; tangent.lengthSq() < 1e-12 && reach < count / 2; reach++) {
        a.fromBufferAttribute(p, ring * count + (i + count - reach) % count);
        b.fromBufferAttribute(p, ring * count + (i + reach) % count);
        tangent.subVectors(b, a);
      }
      a.fromBufferAttribute(p, Math.max(0, ring - 1) * count + i);
      b.fromBufferAttribute(p, ring === profiles.length - 1 ? center : (ring + 1) * count + i);
      radial.subVectors(b, a);
      const n = tangent.cross(radial).normalize();
      normal.setXYZ(index, n.x, n.y, n.z);
    }
    normal.setXYZ(center, 0, 0, 1);
  }
  return geometry;
}

function chamferedSquareContour(h, count) {
  // A larger diagonal cut, followed by a small radius at every junction,
  // keeps the octagonal outline legible without leaving a sharp polygon.
  const cut = Math.min(h * .47, .22), round = Math.min(h * .12, .05);
  const vertices = [[h, h - cut], [h - cut, h], [-h + cut, h], [-h, h - cut], [-h, -h + cut], [-h + cut, -h], [h - cut, -h], [h, -h + cut]];
  const dense = [];
  const unit = (x, y) => { const length = Math.hypot(x, y) || 1; return [x / length, y / length]; };
  for (let i = 0; i < vertices.length; i++) {
    const previous = vertices[(i + vertices.length - 1) % vertices.length], vertex = vertices[i], next = vertices[(i + 1) % vertices.length];
    const inDir = unit(previous[0] - vertex[0], previous[1] - vertex[1]);
    const outDir = unit(next[0] - vertex[0], next[1] - vertex[1]);
    const start = [vertex[0] + inDir[0] * round, vertex[1] + inDir[1] * round];
    const end = [vertex[0] + outDir[0] * round, vertex[1] + outDir[1] * round];
    for (let s = 0; s < 5; s++) {
      const t = s / 5, one = 1 - t;
      dense.push([one * one * start[0] + 2 * one * t * vertex[0] + t * t * end[0], one * one * start[1] + 2 * one * t * vertex[1] + t * t * end[1]]);
    }
    const edgeEnd = [next[0] + unit(vertex[0] - next[0], vertex[1] - next[1])[0] * round, next[1] + unit(vertex[0] - next[0], vertex[1] - next[1])[1] * round];
    for (let s = 0; s < 5; s++) {
      const t = s / 5;
      dense.push([end[0] + (edgeEnd[0] - end[0]) * t, end[1] + (edgeEnd[1] - end[1]) * t]);
    }
  }
  // This contour is blended index-for-index with a circle below. Sampling
  // it by perimeter length gives index zero a different polar angle from
  // the circle's index zero, so intermediate rings shear around the center
  // like a twist. Intersect each circle ray with the rounded polygon instead:
  // both endpoints then share theta and their interpolation stays radial.
  return Array.from({ length: count }, (_, i) => {
    const theta = i / count * Math.PI * 2, dx = Math.cos(theta), dy = Math.sin(theta);
    let radius = Infinity;
    for (let segment = 0; segment < dense.length; segment++) {
      const a = dense[segment], b = dense[(segment + 1) % dense.length];
      const ex = b[0] - a[0], ey = b[1] - a[1], denominator = dx * ey - dy * ex;
      if (Math.abs(denominator) < 1e-9) continue;
      const rayDistance = (a[0] * ey - a[1] * ex) / denominator;
      const edgeDistance = (a[0] * dy - a[1] * dx) / denominator;
      if (rayDistance >= 0 && edgeDistance >= -1e-9 && edgeDistance <= 1 + 1e-9)
        radius = Math.min(radius, rayDistance);
    }
    return Number.isFinite(radius) ? [dx * radius, dy * radius] : [dx * h, dy * h];
  });
}

const BODY = {
  speedcube: { inset: .006 },
  uv: { inset: .006 },
  og: { inset: .006 },
};
const BODY_BASE = .487 - .045;
const BODY_SAMPLES = 256;
const BODY_FRAMES = [
  { axis: 0, sign: 1, n: [1, 0, 0], right: [0, 0, -1], down: [0, -1, 0] },
  { axis: 0, sign: -1, n: [-1, 0, 0], right: [0, 0, 1], down: [0, -1, 0] },
  { axis: 1, sign: 1, n: [0, 1, 0], right: [1, 0, 0], down: [0, 0, 1] },
  { axis: 1, sign: -1, n: [0, -1, 0], right: [1, 0, 0], down: [0, 0, -1] },
  { axis: 2, sign: 1, n: [0, 0, 1], right: [1, 0, 0], down: [0, -1, 0] },
  { axis: 2, sign: -1, n: [0, 0, -1], right: [-1, 0, 0], down: [0, -1, 0] },
];

function bodyRingPoints(cell, col, row, h, r, z, squareMix) {
  const points = [];
  if (cell === 4) {
    const samples = 128;
    const square = chamferedSquareContour(h, samples);
    for (let i = 0; i < samples; i++) {
      const angle = i / samples * Math.PI * 2;
      const circleX = Math.cos(angle) * h, circleY = Math.sin(angle) * h;
      points.push([circleX + (square[i][0] - circleX) * squareMix, circleY + (square[i][1] - circleY) * squareMix]);
    }
    return points;
  }
  const steps = 24, boundary = .487 + z - .001;
  for (let corner = 0; corner < 4; corner++) {
    const [sx, sy] = [[1, 1], [-1, 1], [-1, -1], [1, -1]][corner];
    const inner = (!col || sx === -col) && (!row || sy === -row);
    const radius = inner ? Math.min(h * .88, (col && row ? .065 : .31) * h / .497) : r;
    const centerX = sx * (h - radius), centerY = sy * (h - radius);
    for (let step = 0; step <= steps; step++) {
      const angle = (corner + step / steps) * Math.PI / 2;
      let x = centerX + radius * Math.cos(angle), y = centerY + radius * Math.sin(angle);
      if (col && x * col > boundary) x = col * boundary;
      if (row && y * row > boundary) y = row * boundary;
      points.push([x, y]);
    }
  }
  return points;
}

function bodyRingRadius(points, angle) {
  const dx = Math.cos(angle), dy = Math.sin(angle);
  let radius = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const ex = b[0] - a[0], ey = b[1] - a[1], denominator = dx * ey - dy * ex;
    if (Math.abs(denominator) < 1e-12) continue;
    const along = (a[0] * ey - a[1] * ex) / denominator;
    const edge = (a[0] * dy - a[1] * dx) / denominator;
    if (along > 0 && edge >= -1e-9 && edge <= 1 + 1e-9) radius = Math.max(radius, along);
  }
  return radius;
}

function bodyRingTable(points) {
  const table = new Float32Array(BODY_SAMPLES);
  for (let i = 0; i < BODY_SAMPLES; i++) table[i] = bodyRingRadius(points, i / BODY_SAMPLES * Math.PI * 2);
  return table;
}

function bodyRadiusAt(table, angle) {
  let position = angle / (Math.PI * 2) * BODY_SAMPLES;
  position = ((position % BODY_SAMPLES) + BODY_SAMPLES) % BODY_SAMPLES;
  const index = Math.floor(position), fraction = position - index;
  return table[index] * (1 - fraction) + table[(index + 1) % BODY_SAMPLES] * fraction;
}

const BODY_FOOTPRINTS = new Map();
function bodyFootprint(model, cell, col, row) {
  const key = `${model}|${cell}|${col}|${row}`;
  const cached = BODY_FOOTPRINTS.get(key);
  if (cached) return cached;
  const [h, r, z, squareMix] = cell === 4
    ? COATED(model) ? UV_CENTER_RINGS[0] : SCULPTED_CENTER_RINGS[0]
    : SCULPTED_PROFILE[0];
  const table = bodyRingTable(bodyRingPoints(cell, col, row, h, r, z, squareMix));
  BODY_FOOTPRINTS.set(key, table);
  return table;
}

function bodyFaces(model, p) {
  const faces = [];
  for (let axis = 0; axis < 3; axis++) {
    if (!p[axis]) continue;
    const frame = BODY_FRAMES.find(f => f.axis === axis && f.sign === Math.sign(p[axis]));
    const col = p[0] * frame.right[0] + p[1] * frame.right[1] + p[2] * frame.right[2];
    const rowIndex = p[0] * frame.down[0] + p[1] * frame.down[1] + p[2] * frame.down[2] + 1;
    faces.push({
      n: frame.n,
      right: frame.right,
      up: frame.down.map(value => -value),
      footprint: bodyFootprint(model, rowIndex * 3 + col + 1, col, 1 - rowIndex),
    });
  }
  return faces;
}

// Intersect the cap-footprint prisms into one closed shell. Clipping against
// every contour (rather than overlapping independently capped extrusions) keeps
// the corner/edge junctions clean, without internal faces or depth offsets.
function pieceBodyGeometry(model, p, quality) {
  const body = BODY[model] ?? BODY.speedcube;
  const samples = quality === "low" ? 64 : quality === "balanced" ? 96 : 144;
  const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
  const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  const unit = a => { const length = Math.hypot(...a); return a.map(v => v / length); };
  const planes = [];
  const addPlane = (n, d) => {
    if (!planes.some(plane => dot(plane.n, n) > 1 - 1e-10 && Math.abs(plane.d - d) < 1e-8)) planes.push({ n, d });
  };
  // Flat hidden backs retain the straight, untapered moulded walls.
  for (const frame of BODY_FRAMES) addPlane(frame.n, p[frame.axis] === frame.sign ? BODY_BASE : .458);
  for (const face of bodyFaces(model, p)) {
    const contour = Array.from({ length: samples }, (_, i) => {
      const angle = i / samples * Math.PI * 2;
      const radius = bodyRadiusAt(face.footprint, angle);
      return [Math.cos(angle) * radius, Math.sin(angle) * radius];
    });
    for (let i = 0; i < samples; i++) {
      const a = contour[i], b = contour[(i + 1) % samples];
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (length < 1e-9) continue;
      const nx = (b[1] - a[1]) / length, ny = (a[0] - b[0]) / length;
      addPlane(face.right.map((v, axis) => v * nx + face.up[axis] * ny), nx * a[0] + ny * a[1] - body.inset);
    }
  }
  const positions = [], normals = [], uvs = [], indices = [];
  for (const plane of planes) {
    const n = plane.n;
    const reference = Math.abs(n[2]) < .9 ? [0, 0, 1] : [0, 1, 0];
    const u = unit(cross(reference, n)), v = cross(n, u);
    let polygon = [[-2,-2],[2,-2],[2,2],[-2,2]].map(([x,y]) => n.map((value, axis) => value * plane.d + u[axis]*x + v[axis]*y));
    for (const other of planes) {
      if (other === plane) continue;
      const clipped = [];
      for (let i = 0; i < polygon.length; i++) {
        const a = polygon[i], b = polygon[(i+1) % polygon.length];
        const da = dot(other.n, a) - other.d, db = dot(other.n, b) - other.d;
        if (da <= 1e-9) clipped.push(a);
        if ((da < -1e-9 && db > 1e-9) || (da > 1e-9 && db < -1e-9)) {
          const t = da / (da-db);
          clipped.push(a.map((value, axis) => value + (b[axis]-value)*t));
        }
      }
      polygon = clipped;
      if (polygon.length < 3) break;
    }
    if (polygon.length < 3) continue;
    const start = positions.length / 3;
    // A genuine 2D surface parameterization: both wall direction and depth
    // vary, so normal-map scratches never collapse into stretched streaks.
    for (const point of polygon) {
      positions.push(...point);
      normals.push(...n);
      uvs.push(dot(point, u)/.9 + .5, dot(point, v)/.9 + .5);
    }
    for (let i = 1; i < polygon.length-1; i++) {
      const a = polygon[i].map((value, axis) => value-polygon[0][axis]);
      const b = polygon[i+1].map((value, axis) => value-polygon[0][axis]);
      if (Math.hypot(...cross(a,b)) > 1e-7) indices.push(start, start+i, start+i+1);
    }
  }
  // Smooth only the shallow contour facets. The cap/side and intersecting
  // prism boundaries retain their hard normals and their exact right angles.
  const coincident = new Map();
  for (let i = 0; i < positions.length; i += 3) {
    const key = positions.slice(i, i+3).map(value => Math.round(value * 1e7)).join(",");
    if (!coincident.has(key)) coincident.set(key, []);
    coincident.get(key).push(i);
  }
  const flatNormals = normals.slice();
  for (const vertices of coincident.values()) for (const i of vertices) {
    const normal = flatNormals.slice(i, i+3), sum = [0,0,0];
    for (const j of vertices) {
      const adjacent = flatNormals.slice(j, j+3);
      if (dot(normal, adjacent) > .97) for (let axis = 0; axis < 3; axis++) sum[axis] += adjacent[axis];
    }
    const smooth = unit(sum);
    for (let axis = 0; axis < 3; axis++) normals[i+axis] = smooth[axis];
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new T.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}

export class RealisticCube {
  constructor(stage, onUnavailable, model = "tiles", quality = "balanced", environment = "studio", wear = false, core = "black", options = {}) {
    this.stage = stage;
    this.model = model;
    this.wear = Boolean(wear);
    this.core = CORE(core);
    this.quality = Object.hasOwn(QUALITY, quality) ? quality : "balanced";
    this.environment = Object.hasOwn(ENVIRONMENTS, environment) ? environment : "studio";
    const settings = this.settings = QUALITY[this.quality];
    const calibratedLight = tuningFor(model, this.environment) ?? tuningFor("tiles", this.environment);
    this.tuning = { ...calibratedLight };
    const baseLight = withWearMaterial(this.tuning, this.wear, model);
    // An entry that states its own scale is known before the HDR arrives, so
    // its materials are built with the final value and never touched again. An
    // entry that is measured starts at the reference reading and is corrected
    // the moment the file lands, which is still before the first frame: the
    // photograph has to be prefiltered before anything renders anyway.
    this.baseEnv = baseLight.env;
    this.envScale = ENVIRONMENTS[this.environment].envScale ?? 1;
    const L = this.light = { ...baseLight, env: baseLight.env * this.envScale };
    this.geometries = [];
    this.materials = [];
    // The post chain multisamples its own target, so the canvas must not pay
    // for antialiasing a second time.
    this.renderer = new T.WebGLRenderer({ alpha: true, antialias: !settings.post, powerPreference: settings.post ? "high-performance" : "low-power", preserveDrawingBuffer: options.preserveDrawingBuffer });
    try {
      this.restPixelRatio = Math.min(window.devicePixelRatio || 1, settings.pixelRatio);
      this.renderer.setPixelRatio(this.restPixelRatio);
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.outputColorSpace = T.SRGBColorSpace;
      this.renderer.toneMapping = T.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = L.exposure;
      this.renderer.shadowMap.enabled = settings.shadows;
      this.renderer.shadowMap.type = T.VSMShadowMap;
      // Shadows depend on the cube transform, not on palette, exposure or an
      // environment arriving. Those redraws are common in the lighting studio
      // and used to rebuild and blur the complete VSM map every time.
      this.renderer.shadowMap.autoUpdate = false;
      this.renderer.shadowMap.needsUpdate = settings.shadows;
      this.canvas = this.renderer.domElement;
      this.canvas.className = "cube-studio-canvas";
      this.canvas.dataset.model = model;
      this.canvas.setAttribute("aria-hidden", "true");
      this.onUnavailable = onUnavailable;
      // A lost context cannot be adopted, so the slot has to forget this cube or
      // the next scramble would be handed a dead renderer.
      this.onLost = event => { event.preventDefault(); if (this.slot) STUDIO.delete(this.slot); this.onUnavailable?.(); };
      this.canvas.addEventListener("webglcontextlost", this.onLost);
      stage.append(this.canvas);
      this.scene = new T.Scene();
      this.camera = new T.PerspectiveCamera(33, 1, .1, 60);
      this.camera.position.set(0, 4.2, 9);
      this.camera.lookAt(0, -.06, 0);
      this.root = new T.Group();
      this.scene.add(this.root);
      // A photographic environment has to arrive before the PBR materials
      // compile, or they would build for no environment and rebuild the moment
      // it landed. The materials hold off until the promise settles.
      this.envReady = this.environment === "studio"
        ? Promise.resolve()
        : loadEnvironment(this.environment).then(parsed => {
            this.envMap = parsed;
            this.applyEnvironmentScale(parsed.scale);
          });
      this.setupLight();
      this.grain = sharedMap("grain", plasticGrain);
      // UV adds a curved clear surface over the same stickerless cap outlines.
      const speedcube = SCULPTED(model), coated = COATED(model), stickers = STICKERED(model);
      const finish = SURFACES[MODELS[model]?.surface] ?? SURFACES.tiles;
      this.coating = coated ? sharedMap("coating", () => coatingNormal()) : null;
      this.stickerCleanNormal = !this.wear && stickers ? sharedMap(STICKER_CLEAN_NORMAL_MAP_KEY, stickerCleanNormalMap) : null;
      // Wear is an explicit appearance choice, independent of graphics quality.
      // These are finished static maps; no normal composition happens at runtime.
      this.scratches = this.wear ? sharedMap("wear-normal", scratchNormalMap) : null;
      this.scratchRoughness = this.wear ? sharedMap("wear-roughness", scratchRoughnessMap) : null;
      this.stickerScratches = this.wear && stickers ? sharedMap(STICKER_NORMAL_MAP_KEY, stickerScratchNormalMap) : null;
      this.stickerHandling = this.wear && stickers ? sharedMap(STICKER_HANDLING_MAP_KEY, stickerHandlingMap) : null;
      this.stickerHandlingNormal = this.wear && stickers ? sharedMap(STICKER_HANDLING_NORMAL_MAP_KEY, stickerHandlingNormalMap) : null;
      this.scratchClearcoat = this.wear && coated ? sharedMap("wear-uv-normal", scratchClearcoatNormalMap) : null;
      this.stickerDamage = this.wear && stickers ? sharedMap(STICKER_WEAR_MAP_KEY, stickerDamageMap) : null;
      this.stickerEdge = this.stickerDamage ? sharedMap(STICKER_EDGE_MAP_KEY, stickerEdgeMap) : null;
      if (this.scratches) this.scratches.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
      if (this.scratchRoughness) this.scratchRoughness.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
      if (this.stickerScratches) this.stickerScratches.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
      if (this.stickerHandling) this.stickerHandling.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
      if (this.stickerHandlingNormal) this.stickerHandlingNormal.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
      if (this.stickerCleanNormal) this.stickerCleanNormal.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
      if (this.scratchClearcoat) this.scratchClearcoat.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
      if (this.stickerDamage) this.stickerDamage.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
      if (this.stickerEdge) this.stickerEdge.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
      const worn = this.wear ? finish.wear : null;
      const floor = this.wear ? WEAR_ROUGHNESS_FLOOR : 1;
      // Recessed internals: one moulded plastic for every model, in the colour
      // the user picked. Injection-moulded ABS, not a painted part, so it keeps
      // a low clearcoat and a tight highlight rather than reading as rubber.
      // Wear belongs here too: the body shows through the seams and under the
      // sticker cutout, and a handled cube's plastic is scratched where it shows.
      // The body is the same ABS whichever finish the caps carry, so its slope
      // uses the matte-plastic calibration rather than the cap's own.
      const core = CORE_FINISH[this.core];
      const shell = this.shellMaterial = this.material(new T.MeshPhysicalMaterial({
        color: core.color,
        roughness: core.roughness / floor,
        roughnessMap: this.scratchRoughness,
        metalness: 0,
        clearcoat: core.clearcoat,
        clearcoatRoughness: this.scratchRoughness ? core.clearcoatRoughness / floor : core.clearcoatRoughness,
        clearcoatRoughnessMap: this.scratchRoughness,
        envMapIntensity: core.env,
        ...(this.scratches
          ? { normalMap: this.scratches, normalScale: new T.Vector2(WEAR.speedcube.normal, WEAR.speedcube.normal) }
          : { bumpMap: this.grain, bumpScale: coated ? .0004 : .0008 }),
      }));
      const body = speedcube ? null : this.geometry(new RoundedBoxGeometry(.972, .972, .972, 5, .085));
      this.bodies = [];
      for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
        if (!x && !y && !z) continue;
        const geometry = body ?? this.geometry(pieceBodyGeometry(model, [x, y, z], this.quality));
        const mesh = new T.Mesh(geometry, shell);
        mesh.castShadow = mesh.receiveShadow = true;
        this.root.add(mesh);
        this.bodies.push({ mesh, p: [x, y, z] });
      }
      // The core becomes visible in the gaps while a layer turns.
      this.root.add(new T.Mesh(this.geometry(new T.SphereGeometry(.73, 24, 16)), shell));
      // At detail quality every cap gets its own geometry: the same moulded
      // shape, but its own texture offset and tint, so 54 caps stop being copies.
      // Stickers use the same molded outline for every cell, but wear needs to
      // know which one is the center so its atlas tile can stay bite-free.
      const cells = speedcube || (stickers && this.wear) ? 9 : 1;
      // How many distinct cap buffers exist. Detail quality gives all 54 their
      // own; below it, nine — one per position on a face — rather than one.
      //
      // One was fine while wear was invisible and expensive to notice. It is
      // not fine now: the caps share a texture and, without a per-cap offset,
      // they share the *same patch* of it, so every cap on the cube carried the
      // identical scratch in the identical place. Nine buffers is the number
      // that matters, because the comparison the eye actually makes is between
      // neighbours on one face, and with nine no two caps on a face repeat.
      // The sculpted models already paid for nine to get their moulded cells.
      const spread = settings.detail || (stickers && this.wear) ? 54 : 9;
      const variants = settings.detail
        ? capVariants()
        : capVariants().slice(0, spread).map(v => ({ shift: v.shift, chip: v.chip }));
      // The exposed ABS rim is a separate material and mesh from the vinyl.
      // Its outline, mitered sidewalls and circular center transition are the
      // original Speedcube mould. Children inherit the sticker's complete pose.
      // It is also the face a sticker is laid on, so wear reaches it exactly as
      // it reaches the caps: same maps, same floor divide, same fallback.
      const holderBase = { roughness: .23, clearcoatRoughness: .12, bump: .0003 };
      const holderGeometries = SEPARATE_HOLDERS(model)
        ? Array.from({ length: 9 }, (_, cell) => this.geometry(faceGeometry("speedcube", cell))) : null;
      this.holderMaterial = holderGeometries ? this.material(new T.MeshPhysicalMaterial({
        color: core.color,
        roughness: this.scratchRoughness ? holderBase.roughness / floor : holderBase.roughness,
        roughnessMap: this.scratchRoughness,
        metalness: 0, ior: 1.49,
        clearcoat: .42,
        clearcoatRoughness: this.scratchRoughness ? holderBase.clearcoatRoughness / floor : holderBase.clearcoatRoughness,
        clearcoatRoughnessMap: this.scratchRoughness,
        envMapIntensity: core.env,
        ...(this.scratches
          ? { normalMap: this.scratches, normalScale: new T.Vector2(WEAR.speedcube.normal, WEAR.speedcube.normal) }
          : { bumpMap: this.grain, bumpScale: holderBase.bump }),
        vertexColors: true,
      })) : null;
      this.holders = [];
      const faceGeometries = Array.from({ length: spread }, (_, i) => this.geometry(faceGeometry(model, variants[i].cell ?? i % cells, variants[i])));
      // A UV finish is a layered surface, not a shinier plastic: the coloured
      // plastic keeps its own diffuse look under a separate, near-mirror clear
      // layer, and everything that reads as "coated" happens in that layer —
      // the Fresnel edge, the orange peel, the doubled highlight. Modelling it
      // as one glossy material instead would give a wet-looking cube with the
      // reflection sitting in the plastic rather than floating above it.
      // Strength and roughness come from the rig like every other model's; only
      // the maps are the coat's own. Spreading a second clearcoat literal here
      // is what let the table's gloss entry for this model sit inert.
      const coat = coated ? {
        clearcoatRoughness: L.glossRough / floor,
        // Stickered coated faces keep their own handled-vinyl response in the
        // clear layer too; generic plastic scratch roughness belongs only to
        // the exposed body and holder.
        clearcoatRoughnessMap: stickers ? this.stickerHandling : this.scratchRoughness,
        clearcoatNormalMap: this.scratchClearcoat || this.coating,
        clearcoatNormalScale: new T.Vector2(worn ? worn.coat : .8, worn ? worn.coat : .8),
      } : {};
      const faceRoughness = stickers ? this.stickerHandling : this.scratchRoughness;
      const faceNormal = stickers ? (this.wear ? this.stickerScratches : this.stickerCleanNormal) : this.scratches;
      // Vinyl keeps its broad handling response in roughness; the supplied
      // handling normal adds only low-strength clearcoat haze. Its old scratch
      // roughness has been removed. Other finishes retain the combined plastic
      // wear map. Dividing by the clean floor preserves calibration.
      // Pristine cubes keep the tiny procedural grain of a factory-new finish.
      const surface = faceNormal
        ? { normalMap: faceNormal, normalScale: new T.Vector2(stickers && !this.wear ? STICKER_CLEAN_NORMAL_SCALE : worn.normal, stickers && !this.wear ? STICKER_CLEAN_NORMAL_SCALE : worn.normal) }
        : { bumpMap: this.grain, bumpScale: finish.bump };
      const damage = this.stickerDamage
        ? { alphaMap: this.stickerDamage, alphaTest: .5, alphaToCoverage: true }
        : {};
      // Bound as aoMap purely for the occlusion in R; `tearRelief` reads the
      // lip out of G and B through the same uniform and the same channel-1
      // varying three.js has already declared for it.
      const tear = this.stickerEdge
        ? { aoMap: this.stickerEdge, aoMapIntensity: STICKER_EDGE_OCCLUSION }
        : {};
      const handlingCoat = this.stickerHandlingNormal
        ? { clearcoatNormalMap: this.stickerHandlingNormal, clearcoatNormalScale: new T.Vector2(STICKER_HANDLING_NORMAL_SCALE, STICKER_HANDLING_NORMAL_SCALE) }
        : {};
      const cleanStickerCoat = this.stickerCleanNormal
        ? { clearcoatNormalMap: this.stickerCleanNormal, clearcoatNormalScale: new T.Vector2(STICKER_CLEAN_CLEARCOAT_NORMAL_SCALE, STICKER_CLEAN_CLEARCOAT_NORMAL_SCALE) }
        : {};
      const baseRoughness = finish.roughness;
      const faceMaterial = surfaceValues => new T.MeshPhysicalMaterial({ color: 0xffffff, roughness: baseRoughness / floor, roughnessMap: faceRoughness, metalness: 0, clearcoat: L.gloss, ior: finish.ior, envMapIntensity: L.env, vertexColors: (speedcube && !stickers) || settings.detail, ...(this.wear && !coated ? { clearcoatRoughness: L.glossRough / floor, clearcoatRoughnessMap: faceRoughness } : { clearcoatRoughness: L.glossRough }), ...surfaceValues, ...coat, ...handlingCoat, ...cleanStickerCoat, ...damage, ...tear });
      this.faceMaterials = Object.fromEntries(["U", "R", "F", "D", "L", "B"].map(f => [f, this.material(faceMaterial(surface))]));
      if (this.stickerEdge) for (const material of this.faceMaterialValues()) this.tearRelief(material);
      if (this.scratches) {
        const settle = loaded => {
          if (this.disposed) return;
          this.canvas.dataset.wear = loaded ? "loaded" : "unavailable";
          if (!loaded) {
            if (!stickers) for (const material of Object.values(this.faceMaterials)) {
              material.normalMap = null;
              material.bumpMap = this.grain;
              material.bumpScale = finish.bump;
              material.needsUpdate = true;
            }
            shell.normalMap = null;
            shell.bumpMap = this.grain;
            shell.bumpScale = coated ? .0004 : .0008;
            shell.needsUpdate = true;
            if (this.holderMaterial) {
              this.holderMaterial.normalMap = null;
              this.holderMaterial.bumpMap = this.grain;
              this.holderMaterial.bumpScale = holderBase.bump;
              this.holderMaterial.needsUpdate = true;
            }
          }
          this.render();
        };
        if (this.scratches.userData.loaded) settle(true);
        else if (this.scratches.userData.failed) settle(false);
        else {
          this.canvas.dataset.wear = "loading";
          this.scratches.userData.listeners.push(settle);
        }
      }
      if (this.stickerScratches) {
        const settle = loaded => {
          if (this.disposed) return;
          this.canvas.dataset.wearStickerNormal = loaded ? "loaded" : "unavailable";
          if (!loaded) for (const material of this.faceMaterialValues()) {
            material.normalMap = null;
            material.bumpMap = this.grain;
            material.bumpScale = finish.bump;
            material.needsUpdate = true;
          }
          this.render();
        };
        if (this.stickerScratches.userData.loaded) settle(true);
        else if (this.stickerScratches.userData.failed) settle(false);
        else {
          this.canvas.dataset.wearStickerNormal = "loading";
          this.stickerScratches.userData.listeners.push(settle);
        }
      }
      if (this.stickerCleanNormal) {
        const settle = loaded => {
          if (this.disposed) return;
          this.canvas.dataset.stickerCleanNormal = loaded ? "loaded" : "unavailable";
          if (!loaded) for (const material of Object.values(this.faceMaterials)) {
            if (material.normalMap === this.stickerCleanNormal) {
              material.normalMap = null;
              if (material.clearcoatNormalMap === this.stickerCleanNormal) material.clearcoatNormalMap = null;
              material.bumpMap = this.grain;
              material.bumpScale = finish.bump;
              material.needsUpdate = true;
            }
          }
          this.render();
        };
        if (this.stickerCleanNormal.userData.loaded) settle(true);
        else if (this.stickerCleanNormal.userData.failed) settle(false);
        else {
          this.canvas.dataset.stickerCleanNormal = "loading";
          this.stickerCleanNormal.userData.listeners.push(settle);
        }
      }
      if (this.stickerHandlingNormal) {
        const settle = loaded => {
          if (this.disposed) return;
          this.canvas.dataset.wearStickerHandlingNormal = loaded ? "loaded" : "unavailable";
          if (!loaded) for (const material of Object.values(this.faceMaterials)) {
            if (material.clearcoatNormalMap === this.stickerHandlingNormal) material.clearcoatNormalMap = null;
            material.needsUpdate = true;
          }
          this.render();
        };
        if (this.stickerHandlingNormal.userData.loaded) settle(true);
        else if (this.stickerHandlingNormal.userData.failed) settle(false);
        else {
          this.canvas.dataset.wearStickerHandlingNormal = "loading";
          this.stickerHandlingNormal.userData.listeners.push(settle);
        }
      }
      if (this.scratchRoughness) {
        const settle = loaded => {
          if (this.disposed) return;
          this.canvas.dataset.wearRoughness = loaded ? "loaded" : "unavailable";
          if (!loaded) {
            if (!stickers) for (const material of Object.values(this.faceMaterials)) {
              material.roughness = baseRoughness;
              material.roughnessMap = null;
              if (material.clearcoatRoughnessMap === this.scratchRoughness) {
                material.clearcoatRoughness = L.glossRough;
                material.clearcoatRoughnessMap = null;
              }
              material.needsUpdate = true;
            }
            shell.roughness = core.roughness;
            shell.roughnessMap = null;
            if (shell.clearcoatRoughnessMap === this.scratchRoughness) {
              shell.clearcoatRoughness = core.clearcoatRoughness;
              shell.clearcoatRoughnessMap = null;
            }
            shell.needsUpdate = true;
            if (this.holderMaterial) {
              this.holderMaterial.roughness = holderBase.roughness;
              this.holderMaterial.roughnessMap = null;
              if (this.holderMaterial.clearcoatRoughnessMap === this.scratchRoughness) {
                this.holderMaterial.clearcoatRoughness = holderBase.clearcoatRoughness;
                this.holderMaterial.clearcoatRoughnessMap = null;
              }
              this.holderMaterial.needsUpdate = true;
            }
          }
          this.render();
        };
        if (this.scratchRoughness.userData.loaded) settle(true);
        else if (this.scratchRoughness.userData.failed) settle(false);
        else {
          this.canvas.dataset.wearRoughness = "loading";
          this.scratchRoughness.userData.listeners.push(settle);
        }
      }
      if (this.stickerHandling) {
        const settle = loaded => {
          if (this.disposed) return;
          this.canvas.dataset.wearStickerRoughness = loaded ? "loaded" : "unavailable";
          if (!loaded) for (const material of Object.values(this.faceMaterials)) {
            material.roughness = baseRoughness;
            material.roughnessMap = null;
            material.clearcoatRoughness = L.glossRough;
            material.clearcoatRoughnessMap = null;
            material.needsUpdate = true;
          }
          this.render();
        };
        if (this.stickerHandling.userData.loaded) settle(true);
        else if (this.stickerHandling.userData.failed) settle(false);
        else {
          this.canvas.dataset.wearStickerRoughness = "loading";
          this.stickerHandling.userData.listeners.push(settle);
        }
      }
      if (this.scratchClearcoat) {
        const settle = loaded => {
          if (this.disposed) return;
          this.canvas.dataset.wearClearcoat = loaded ? "loaded" : "unavailable";
          if (!loaded) for (const material of this.faceMaterialValues()) {
            material.clearcoatNormalMap = this.coating;
            material.needsUpdate = true;
          }
          this.render();
        };
        if (this.scratchClearcoat.userData.loaded) settle(true);
        else if (this.scratchClearcoat.userData.failed) settle(false);
        else {
          this.canvas.dataset.wearClearcoat = "loading";
          this.scratchClearcoat.userData.listeners.push(settle);
        }
      }
      if (this.stickerDamage) {
        const settle = loaded => {
          if (this.disposed) return;
          this.canvas.dataset.wearSticker = loaded ? "loaded" : "unavailable";
          if (!loaded) for (const material of this.faceMaterialValues()) {
            material.alphaMap = null;
            material.alphaTest = 0;
            material.needsUpdate = true;
          }
          this.render();
        };
        if (this.stickerDamage.userData.loaded) settle(true);
        else if (this.stickerDamage.userData.failed) settle(false);
        else {
          this.canvas.dataset.wearSticker = "loading";
          this.stickerDamage.userData.listeners.push(settle);
        }
      }
      if (this.stickerEdge) {
        const settle = loaded => {
          if (this.disposed) return;
          this.canvas.dataset.wearStickerEdge = loaded ? "loaded" : "unavailable";
          // The cutout stays either way: a tear with no lip is what shipped
          // before this map existed, and it is still better than no tear.
          if (!loaded) for (const material of this.faceMaterialValues()) {
            material.aoMap = null;
            material.needsUpdate = true;
          }
          this.render();
        };
        if (this.stickerEdge.userData.loaded) settle(true);
        else if (this.stickerEdge.userData.failed) settle(false);
        else {
          this.canvas.dataset.wearStickerEdge = "loading";
          this.stickerEdge.userData.listeners.push(settle);
        }
      }
      if (coated) for (const material of this.faceMaterialValues()) this.coatingLighting(material);
      this.faces = Array.from({ length: 54 }, (_, i) => {
        // `i` walks the 54 caps face by face, so `i % 9` hands each position on
        // a face its own buffer and no two caps a viewer sees side by side
        // share one. For the sculpted models this is the same index as before,
        // since their nine buffers were already the nine moulded cells.
        const mesh = new T.Mesh(faceGeometries[settings.detail ? i : i % spread], this.faceMaterials.U);
        if (holderGeometries) {
          const holder = new T.Mesh(holderGeometries[i % 9], this.holderMaterial);
          holder.castShadow = holder.receiveShadow = true;
          mesh.add(holder);
          this.holders.push(holder);
        }
        mesh.castShadow = mesh.receiveShadow = true;
        this.root.add(mesh);
        return mesh;
      });
      // Small recessed center-cap seams distinguish centers from edges and corners.
      const seamGeometry = this.geometry(new T.TorusGeometry(.325, .0025, 4, 64));
      const seamMaterial = this.material(new T.MeshPhysicalMaterial({ color: 0x393c42, transparent: true, opacity: .16, roughness: .4, depthWrite: false }));
      this.seams = Array.from({ length: model === "tiles" ? 6 : 0 }, () => {
        const seam = new T.Mesh(seamGeometry, seamMaterial);
        this.root.add(seam);
        return seam;
      });
      if (speedcube || stickers) this.setupCenterMark();
      if (speedcube) this.setupJitter();
      if (settings.post) this.setupPost();
      this.observer = new ResizeObserver(() => this.resize());
      this.observer.observe(stage);
      this.resize();
    } catch (error) {
      this.destroy();
      throw error;
    }
  }
  geometry(value) { this.geometries.push(value); return value; }
  material(value) { this.materials.push(value); return value; }
  faceMaterialValues() {
    return Object.values(this.faceMaterials ?? {});
  }
  tearRelief(material) {
    // Give the cut its thickness back. The lip's slope is baked; all that
    // happens here is sampling it in its own tangent frame and adding it to
    // whatever the vinyl's scratches already did to the normal.
    //
    // The frame matters and is the one thing here that is easy to get wrong.
    // `normal_fragment_begin` builds `tbn` from whichever UV set the normal map
    // uses -- channel 2 for the sticker scratches, which carries a per-cap
    // quarter turn. The lip lives on channel 1, which does not. Reusing `tbn`
    // would rotate a quarter of the cube's lips by ninety degrees and light
    // them from the wrong side, so the frame is rebuilt against the lip's own
    // UVs. `nonPerturbedNormal` is the unperturbed surface, saved by that same
    // chunk, which is what a tangent frame has to be raised from.
    //
    // Adding the lip's deviation rather than replacing the normal is UDN by
    // another name: slopes add, and the scratches underneath survive.
    //
    // The clear layer gets the same deviation, and that is not a refinement --
    // it is most of the effect. Vinyl is laminated, so the highlight that reads
    // as thickness is a reflection in the laminate, not in the pigment beneath
    // it; bending only the diffuse normal moved a shadow and left the bright
    // side of the lip flat, which looked like a smudge rather than an edge.
    const previous = material.onBeforeCompile;
    material.onBeforeCompile = shader => {
      previous?.(shader);
      const guard = '#if defined( USE_AOMAP ) && ! defined( USE_TANGENT ) && ( defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) )';
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        ${guard}
          vec3 tearOffset = vec3( 0.0 );
          vec2 tearSlope = ( texture2D( aoMap, vAoMapUv ).gb * 2.0 - 1.0 ) * ${STICKER_EDGE_NORMAL_SCALE.toFixed(2)};
          float tearAmount = dot( tearSlope, tearSlope );
          if ( tearAmount > 0.0001 ) {
            vec3 tearN = vec3( tearSlope, sqrt( max( 1.0 - tearAmount, 0.0 ) ) );
            tearOffset = getTangentFrame( - vViewPosition, nonPerturbedNormal, vAoMapUv ) * tearN - nonPerturbedNormal;
            normal = normalize( normal + tearOffset );
          }
        #endif`)
        .replace('#include <clearcoat_normal_fragment_maps>', `#include <clearcoat_normal_fragment_maps>
        ${guard}
          clearcoatNormal = normalize( clearcoatNormal + tearOffset );
        #endif`);
    };
    material.customProgramCacheKey = () => 'sticker-tear-relief-v1';
  }
  coatingLighting(material) {
    // Direct lights expose the pigment; the photographic cards supply the
    // clear-layer reflection. Avoid counting their diffuse fill a second time.
    const previous = material.onBeforeCompile;
    material.onBeforeCompile = shader => {
      previous?.(shader);
      shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_maps>',
        T.ShaderChunk.lights_fragment_maps + '\niblIrradiance *= 0.045;\nradiance *= 0.08;\n');
    };
    material.customProgramCacheKey = () => 'uv-coating-lighting-v4';
  }
  setupCenterMark() {
    // Printed center emblem, in the surface plane rather than raised geometry.
    // The Stickers cube wears the retail Rubik's mark; the sculpted models wear
    // the blue GAN emblem. Both are full-colour decals on the white center.
    const rubiks = this.model === "stickers";
    const emblem = rubiks ? "./rubiks-logo.png" : "./gan-logo.png";
    this.markTexture = new T.TextureLoader().load(new URL(emblem, import.meta.url).href, texture => {
      if (this.disposed) { texture.dispose(); return; }
      this.canvas.dataset.logo = "loaded";
      this.render();
    }, undefined, () => { if (this.mark) this.mark.visible = false; });
    this.markTexture.colorSpace = T.SRGBColorSpace;
    this.markTexture.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
    // The emblem is printed on the plastic and the coat goes over it, so it
    // must not read as a matte decal on a glossy face. The Rubik's mark keeps
    // its own ink — the palette must never tint it — and sits on satin vinyl.
    const coated = COATED(this.model);
    this.markMaterial = this.material(new T.MeshPhysicalMaterial({ color: rubiks ? 0xffffff : this.model === "og" ? 0x0d73b8 : 0x2474ef, map: this.markTexture, transparent: true, alphaTest: .15, roughness: coated ? .22 : rubiks ? .34 : .48, ...(coated ? { clearcoat: 1, clearcoatRoughness: .04, clearcoatNormalMap: this.coating, clearcoatNormalScale: new T.Vector2(.5, .5) } : {}), depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    if (coated) { this.markMaterial.envMapIntensity = this.light.env; this.coatingLighting(this.markMaterial); }
    // The retail mark runs across the cap diagonally, wordmark and all.
    this.markRoll = rubiks ? new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 0, 1), T.MathUtils.degToRad(-45)) : null;
    // The Rubik's decal canvas is 1024x540, so its plane keeps that aspect.
    const markWidth = rubiks ? .88 : .78, markHeight = rubiks ? .464 : .78;
    this.mark = new T.Mesh(this.geometry(new T.PlaneGeometry(markWidth, markHeight)), this.markMaterial);
    this.root.add(this.mark);
  }
  setupJitter(offset = .009, tilt = .6) {
    // No physical cube sits on a perfect lattice: pieces rest fractions of a
    // degree off and gap widths vary. Without this the grid reads as CG however
    // good the lighting gets. Deterministic, so a piece keeps its own
    // imperfection across turns, resizes and re-renders.
    this.jitter = new Map();
    this.scratch = new T.Vector3();
    this.basis = new T.Matrix4();
    this.base = new T.Quaternion();
    let seed = 20260907;
    const next = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 2147483648 - 1; };
    const radians = tilt * Math.PI / 180;
    for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
      this.jitter.set(`${x},${y},${z}`, {
        offset: new T.Vector3(next() * offset, next() * offset, next() * offset),
        rotation: new T.Quaternion().setFromEuler(new T.Euler(next() * radians, next() * radians, next() * radians)),
      });
    }
  }
  pieceJitter(p) { return this.jitter?.get(`${p[0] | 0},${p[1] | 0},${p[2] | 0}`); }
  stickerBase(st) {
    // The cap's own orientation, before the layer turn and before the piece's
    // imperfection. Recomputed on every call and never cached: Cube.move rewrites
    // a sticker's right/down/n in place, so anything held here goes stale the
    // moment the cube turns and the cap keeps pointing where it used to.
    return this.base.setFromRotationMatrix(this.basis.makeBasis(vector(st.right), vector(st.down.map(v => -v)), vector(st.n)));
  }
  setupPost() {
    // A deliberately small post chain rather than a general composer: one
    // off-screen target and one composite pass. Everything here has to survive
    // an alpha of zero, because the cube floats over the panel instead of
    // sitting on an opaque backdrop, and the stock passes assume otherwise.
    //
    // Cinematic adds one more target pair for the halation and switches the
    // composite into its lens branch. Everything it adds is behind `#ifdef
    // CAMERA` rather than behind a uniform set to zero, so Ultra keeps
    // compiling the shader it always compiled and keeps its measured colour
    // parity with Balanced.
    const camera = this.settings.camera;
    this.target = new T.WebGLRenderTarget(1, 1, {
      type: T.HalfFloatType,
      // Defocus is a resampling filter, and resampling an aliased edge keeps
      // the aliasing and spreads it. The extra coverage is cheaper here than
      // anywhere downstream.
      samples: camera ? 8 : 4,
      stencilBuffer: false,
      depthTexture: new T.DepthTexture(1, 1, T.UnsignedIntType),
    });
    this.postCamera = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.postScene = new T.Scene();
    if (camera) this.setupHalation();
    this.postMaterial = this.material(new T.ShaderMaterial({
      transparent: true,
      premultipliedAlpha: camera,
      depthTest: false,
      depthWrite: false,
      defines: camera ? { CAMERA: 1, MOTION_TAPS: 8 } : {},
      extensions: { derivatives: true },
      uniforms: {
        colorBuffer: { value: this.target.texture },
        depthBuffer: { value: this.target.depthTexture },
        resolution: { value: new T.Vector2(1, 1) },
        projectionInverse: { value: new T.Matrix4() },
        exposure: { value: this.renderer.toneMappingExposure },
        occlusion: { value: 1.5 },
        bias: { value: .18 },
        radius: { value: 14 },
        aberration: { value: camera ? LENS.aberration : .006 },
        grain: { value: camera ? LENS.grain : .016 },
        ...(camera ? {
          bloomBuffer: { value: this.bloomB.texture },
          // The camera never moves — orbit turns the cube inside a fixed frame —
          // so the focal plane is a constant, set once from where the lens is
          // actually pointed rather than tracked per frame.
          focus: { value: this.camera.position.distanceTo(new T.Vector3(0, -.06, 0)) - LENS.focus },
          focusRange: { value: LENS.focusRange },
          bokeh: { value: LENS.bokeh },
          bloom: { value: LENS.bloom },
          halation: { value: new T.Color(...LENS.halation) },
          distortion: { value: LENS.distortion },
          saturation: { value: LENS.saturation },
          // Motion blur needs no history: the turn is a rotation the renderer
          // already knows, so a pixel's velocity is derived from these five
          // numbers and the depth buffer that is already there.
          projection: { value: new T.Matrix4() },
          motionAxis: { value: new T.Vector3(0, 1, 0) },
          motionCenter: { value: new T.Vector3() },
          motionRange: { value: new T.Vector2(-2, 2) },
          motionMid: { value: 0 },
          motionScale: { value: 1 },
          motionAngle: { value: 0 },
          shadowTint: { value: new T.Color(...LENS.shadowTint) },
          highlightTint: { value: new T.Color(...LENS.highlightTint) },
        } : {}),
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        uniform sampler2D colorBuffer;
        uniform sampler2D depthBuffer;
        uniform vec2 resolution;
        uniform mat4 projectionInverse;
        uniform float exposure;
        uniform float occlusion;
        uniform float bias;
        uniform float radius;
        uniform float aberration;
        uniform float grain;
        #ifdef CAMERA
        uniform sampler2D bloomBuffer;
        uniform float focus;
        uniform float focusRange;
        uniform float bokeh;
        uniform float bloom;
        uniform vec3 halation;
        uniform float distortion;
        uniform float saturation;
        uniform vec3 shadowTint;
        uniform vec3 highlightTint;
        uniform mat4 projection;
        uniform vec3 motionAxis;
        uniform vec3 motionCenter;
        uniform vec2 motionRange;
        uniform float motionMid;
        uniform float motionScale;
        uniform float motionAngle;
        #endif
        varying vec2 vUv;

        vec3 viewPosition(vec2 uv, float depth) {
          vec4 clip = vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
          vec4 view = projectionInverse * clip;
          return view.xyz / view.w;
        }

        float hash12(vec2 p) {
          vec3 q = fract(vec3(p.xyx) * 0.1031);
          q += dot(q, q.yzx + 33.33);
          return fract((q.x + q.y) * q.z);
        }

        // The same curve three applies when it renders straight to the canvas,
        // so a quality change is never also a colour change. Named apart from
        // three's own copy: it injects its tone-mapping functions into the
        // prefix of every fragment shader, this one included.
        vec3 rrtOdtFit(vec3 v) {
          vec3 a = v * (v + 0.0245786) - 0.000090537;
          vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
          return a / b;
        }
        vec3 acesFilmic(vec3 colour) {
          const mat3 inputMat = mat3(
            vec3(0.59719, 0.07600, 0.02840),
            vec3(0.35458, 0.90834, 0.13383),
            vec3(0.04823, 0.01566, 0.83777));
          const mat3 outputMat = mat3(
            vec3(1.60475, -0.10208, -0.00327),
            vec3(-0.53108, 1.10813, -0.07276),
            vec3(-0.07367, -0.00605, 1.07602));
          colour *= exposure / 0.6;
          colour = inputMat * colour;
          colour = rrtOdtFit(colour);
          colour = outputMat * colour;
          return clamp(colour, 0.0, 1.0);
        }
        vec3 encodeSRGB(vec3 c) {
          return mix(pow(c, vec3(0.41666)) * 1.055 - vec3(0.055), c * 12.92, vec3(lessThanEqual(c, vec3(0.0031308))));
        }

        #ifdef CAMERA
        void defocusTap(vec2 uv, vec3 origin, float spread, float index, float tapCount,
          inout vec4 gathered, inout float totalWeight) {
          float t = index / tapCount;
          float spin = index * 2.39996323;
          vec2 probe = uv + vec2(cos(spin), sin(spin)) * sqrt(t) * spread / resolution;
          vec4 sampleColour = texture2D(colorBuffer, probe);
          float sampleDepth = texture2D(depthBuffer, probe).x;
          float sampleZ = -viewPosition(probe, sampleDepth).z;
          // Do not smear a nearer, in-focus cap over a defocused rear cap.
          float edgeWeight = mix(1.0, smoothstep(-0.3, 0.0, sampleZ + 0.03 + origin.z),
            (1.0 - step(0.9999, sampleDepth)));
          float weight = exp(-2.0 * t) * edgeWeight;
          gathered += sampleColour * weight;
          totalWeight += weight;
        }
        #endif

        void main() {
          #ifdef CAMERA
            // A lens does not map the world onto a plane. The sample point is
            // pushed outward from centre, never inward, so the frame can only
            // ever shrink toward the middle and the cube can never be cropped
            // by its own distortion. Colour and depth are both read through it,
            // or the occlusion would sit a pixel off the cap it belongs to.
            vec2 centred = vUv - 0.5;
            vec2 uv = 0.5 + centred * (1.0 + distortion * dot(centred, centred));
          #else
            vec2 uv = vUv;
          #endif

          float depth = texture2D(depthBuffer, uv).x;
          float surface = 1.0 - step(0.9999, depth);
          // Derivatives must be taken in uniform control flow, so the surface
          // frame is reconstructed for every pixel, the empty ones included.
          vec3 origin = viewPosition(uv, depth);
          vec3 normal = normalize(cross(dFdx(origin), dFdy(origin)));

          // A lens pulls the channels further apart toward the edge of the frame.
          vec2 offCentre = uv - 0.5;
          vec2 split = offCentre * dot(offCentre, offCentre) * aberration;

          float alpha;
          vec3 colour;

          #ifdef CAMERA
            // Read the centre and halo before deciding how much lens work this
            // pixel needs. Most of the transparent stage has neither, and most
            // camera-facing caps are effectively in focus; neither case should
            // pay for an aperture gather.
            vec4 centreSample = texture2D(colorBuffer, uv);
            vec4 halo = texture2D(bloomBuffer, uv);
            float glow = clamp(max(halo.a, max(halo.r, max(halo.g, halo.b))) * bloom, 0.0, 1.0);

            // Motion blur. A turn is a rotation this renderer already knows the
            // axis, the layer and the elapsed angle of, so a pixel's velocity is
            // analytic: no velocity buffer, no per-mesh previous-frame matrices,
            // no second geometry pass. The anchor is the moving surface itself
            // where there is one, and the point where this pixel's ray crosses
            // the turning layer's plane where there is not, which is what lets a
            // trail spill off the silhouette onto the empty stage behind it
            // instead of stopping dead at the cube's edge.
            //
            // The whole block is behind a uniform that is zero on every still
            // frame, so a cube at rest compiles the same shader and pays nothing.
            float smear = 0.0;
            if (motionAngle != 0.0) {
              float baseAxis = dot(origin - motionCenter, motionAxis) / motionScale;
              float baseMoving = surface *
                step(motionRange.x, baseAxis) * step(baseAxis, motionRange.y);
              vec3 anchor = origin;
              float valid = baseMoving;
              if (baseMoving < 0.5) {
                vec3 ray = normalize(viewPosition(uv, 1.0));
                float denom = dot(ray, motionAxis);
                // Edge on to the layer the intersection runs away to infinity;
                // the nearest point to the cube's centre is the honest answer.
                float along = abs(denom) > 0.15
                  ? (motionScale * motionMid + dot(motionCenter, motionAxis)) / denom
                  : dot(motionCenter, ray);
                anchor = ray * along;
                valid = step(0.0, along) *
                  step(length(anchor - motionCenter), motionScale * 1.85);
              }
              if (valid > 0.5) {
                vec3 rel = anchor - motionCenter;
                float ca = cos(motionAngle), sa = sin(motionAngle);
                // Where this point stood when the shutter opened.
                vec3 prevRel = rel * ca - cross(motionAxis, rel) * sa
                  + motionAxis * dot(motionAxis, rel) * (1.0 - ca);
                vec4 clip = projection * vec4(motionCenter + prevRel, 1.0);
                vec2 trail = uv - (clip.xy / clip.w * 0.5 + 0.5);
                float pixels = length(trail * resolution);
                if (pixels > 0.75) {
                  // A bounded trail keeps the taps a couple of pixels apart at
                  // the speeds a turn actually reaches, so the smear stays
                  // continuous rather than breaking into discrete ghosts.
                  trail *= min(1.0, 36.0 / pixels);
                  smear = min(pixels, 36.0);
                  vec4 sum = vec4(0.0);
                  float cover = 0.0;
                  for (int i = 0; i < MOTION_TAPS; i++) {
                    float t = (float(i) + 0.5) / float(MOTION_TAPS);
                    vec2 probe = uv - trail * t;
                    vec4 tap = texture2D(colorBuffer, probe);
                    float tapDepth = texture2D(depthBuffer, probe).x;
                    vec3 tapPos = viewPosition(probe, tapDepth);
                    float tapAxis = dot(tapPos - motionCenter, motionAxis) / motionScale;
                    // A tap is moving surface only if it sits in the turning
                    // layer and is not behind what this pixel already shows: a
                    // still cap in front must never be smeared through.
                    float moving = (1.0 - step(0.9999, tapDepth)) *
                      step(motionRange.x, tapAxis) * step(tapAxis, motionRange.y) *
                      max(baseMoving, step(origin.z - 0.02, tapPos.z));
                    sum += tap * max(moving, baseMoving);
                    cover += moving;
                  }
                  // On the moving surface the result is the average of the whole
                  // swept path, empty taps included, which is what makes a
                  // leading edge lose coverage instead of staying cut out.
                  // Everywhere else only the moving taps contribute, laid over
                  // the still image in proportion to how much of the shutter
                  // they covered.
                  centreSample = baseMoving > 0.5
                    ? sum / float(MOTION_TAPS)
                    : mix(centreSample, sum / max(cover, 1.0), cover / float(MOTION_TAPS));
                }
              }
            }

            if (surface < 0.5 && centreSample.a + glow <= 0.002) discard;

            // Defocus. The circle of confusion grows with distance from the
            // focal plane, squared rather than linearly, which is what keeps
            // the sharp zone wide enough to cover every cap turned toward the
            // camera and puts the softness only where the cube is already
            // turning away. Background texels are pinned sharp: they carry no
            // surface, and letting them defocus would drag the panel inward.
            float circle = clamp(abs(-origin.z - focus) / focusRange, 0.0, 1.0);
            float spread = circle * circle * bokeh * resolution.y * surface;
            // Two blurs on the same pixel is one too many, and the expensive one
            // is the one nobody can see through a trail. The 48-tap aperture
            // fades out exactly as the smear takes over.
            spread *= 1.0 - clamp(smear * 0.25, 0.0, 1.0);
            // Gathered premultiplied, with alpha carried through the same
            // filter as the colour. That is the whole reason this works over a
            // transparent panel: a defocused silhouette has to lose coverage as
            // it spreads, or the cube grows a dark halo the width of the blur.
            vec4 gathered = centreSample;
            // Fixed, dense aperture sampling prevents bright reflections from
            // breaking into pixel-wise random speckles. A soft aperture and a
            // bounded radius avoid discrete replicas of tiny highlights.
            spread = min(spread, 3.0);
            // A quarter-buffer-pixel circle cannot change the displayed pixel.
            // Keeping the full gather behind this branch preserves the 48-tap
            // aperture wherever defocus is visible while making the sharp and
            // transparent majority of the frame a single read.
            if (surface > 0.5 && spread > 0.25) {
              gathered = vec4(0.0);
              float totalWeight = 0.0;
              // A sub-pixel circle was paying for the same 48 samples as the
              // widest blur even though bilinear filtering collapses most of
              // them onto the same texels. Keep the full aperture at the rear
              // face and scale down only where fewer samples are indistinguishable.
              if (spread < 1.0) {
                for (int i = 0; i < 12; i++)
                  defocusTap(uv, origin, spread, float(i), 12.0, gathered, totalWeight);
              } else if (spread < 2.0) {
                for (int i = 0; i < 24; i++)
                  defocusTap(uv, origin, spread, float(i), 24.0, gathered, totalWeight);
              } else {
                for (int i = 0; i < 48; i++)
                  defocusTap(uv, origin, spread, float(i), 48.0, gathered, totalWeight);
              }
              gathered /= max(totalWeight, 0.001);
            }
            // Apply lateral colour only where all channels have full coverage.
            vec4 redSample = texture2D(colorBuffer, uv + split);
            vec4 blueSample = texture2D(colorBuffer, uv - split);
            float chromaCoverage = smoothstep(0.95, 1.0, min(gathered.a, min(redSample.a, blueSample.a)));
            gathered.rb += (vec2(redSample.r, blueSample.b) - centreSample.rb) * chromaCoverage * exp(-spread * spread);
            alpha = gathered.a;
            colour = gathered.rgb / max(alpha, 0.001);
          #else
            vec4 low = texture2D(colorBuffer, uv + split);
            vec4 mid = texture2D(colorBuffer, uv);
            vec4 high = texture2D(colorBuffer, uv - split);
            alpha = max(mid.a, max(low.a, high.a));
            if (alpha <= 0.001) discard;
            // The buffer is premultiplied. Undo that so the tone curve sees the
            // surface rather than the coverage, and put it back at the end.
            colour = vec3(low.r, mid.g, high.b) / alpha;
          #endif

          // The normal is what separates a groove from a cap's own curvature:
          // without it a domed crown occludes its own slope. It is reconstructed
          // from depth, so it carries the tessellation's faceting, and the bias
          // has to be wide enough to reject everything near the tangent plane.
          // Empty pixels can carry the lens halo, but they have no surface to
          // occlude. Keeping the kernel inside this branch avoids twenty depth
          // reconstructions across the transparent majority of the canvas.
          if (surface > 0.5) {
            float shade = 0.0;
            #ifdef CAMERA
            float angle = 0.0;
            #else
            float angle = hash12(gl_FragCoord.xy) * 6.2831853;
            #endif
            for (int i = 0; i < 20; i++) {
              float t = (float(i) + 0.5) / 20.0;
              float spin = angle + t * 18.8495559;
              vec2 probe = vec2(cos(spin), sin(spin)) * sqrt(t) * radius / resolution;
              float sampled = texture2D(depthBuffer, uv + probe).x;
              vec3 delta = viewPosition(uv + probe, sampled) - origin;
              float dist = length(delta);
              // Empty space must never occlude, or the silhouette eats itself.
              float valid = 1.0 - step(0.9999, sampled);
              shade += valid * max(0.0, dot(normal, delta / max(dist, 1e-5)) - bias) / (1.0 + dist * dist * 40.0);
            }
            shade = clamp(shade / 20.0 * occlusion, 0.0, 0.85);
            colour *= 1.0 - shade;
          }

          #ifdef CAMERA
            // Halation goes in here, in linear light and before the tone curve,
            // because that is where a real one happens: light scatters in the
            // sensor stack and is then developed along with everything else.
            // Added after the curve it would sit on top of the image as paint.
            float covered = clamp(alpha + glow * (1.0 - alpha), 0.0, 1.0);
            colour = (colour * alpha + halo.rgb * halation * bloom) / max(covered, 0.001);
            alpha = covered;

            // The grade. This is the one thing in the renderer that changes
            // colour on purpose, and it is deliberately small: a little chroma
            // back from what ACES takes out of a saturated cap, and a split
            // between a cool shadow and a warm highlight that no single light
            // in the rig could produce. Anything stronger and the cube stops
            // being the palette's colour, which every other level guarantees.
            float value = dot(colour, vec3(0.2126, 0.7152, 0.0722));
            colour = max(mix(vec3(value), colour, saturation), vec3(0.0));
            colour *= mix(shadowTint, highlightTint, smoothstep(0.0, 1.1, value));
          #endif

          colour = encodeSRGB(acesFilmic(colour));
          // Sensor grain belongs to the screen, not to the cube, so re-rendering
          // the same frame never makes it crawl.
          #ifdef CAMERA
            // Fine luminance grain, strongest in midtones and absent at the
            // endpoints. A fixed seed keeps redraws from flickering.
            float tone = dot(colour, vec3(0.2126, 0.7152, 0.0722));
            float speck = (hash12(gl_FragCoord.xy) + hash12(gl_FragCoord.xy + 71.3) - 1.0);
            colour += speck * grain * (4.0 * tone * (1.0 - tone));
          #else
            colour += (hash12(gl_FragCoord.xy * 1.7) - 0.5) * grain;
          #endif

          gl_FragColor = vec4(clamp(colour, 0.0, 1.0) * alpha, alpha);
        }
      `,
    }));
    this.postScene.add(new T.Mesh(this.geometry(new T.PlaneGeometry(2, 2)), this.postMaterial));
  }
  setupHalation() {
    // A halo wide enough to read as light spilling across a sensor cannot be
    // gathered in the taps the composite can afford — it needs tens of pixels
    // of reach, and the composite is already paying for twenty occlusion taps
    // and forty-eight defocus taps. So it gets its own chain: a thresholded
    // half-resolution downsample, then one horizontal and one vertical blur,
    // ping-ponged between two targets. Three extra draws, all at a quarter of
    // the pixels, and the last one lands in `bloomB` where the composite
    // reads it.
    const options = {
      type: T.HalfFloatType,
      minFilter: T.LinearFilter,
      magFilter: T.LinearFilter,
      depthBuffer: false,
      stencilBuffer: false,
    };
    this.bloomA = new T.WebGLRenderTarget(1, 1, options);
    this.bloomB = new T.WebGLRenderTarget(1, 1, options);
    const vertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `;
    this.brightMaterial = this.material(new T.ShaderMaterial({
      blending: T.NoBlending,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        source: { value: this.target.texture },
        texel: { value: new T.Vector2() },
        threshold: { value: LENS.threshold },
        knee: { value: LENS.knee },
      },
      vertexShader,
      fragmentShader: `
        precision highp float;
        uniform sampler2D source;
        uniform vec2 texel;
        uniform float threshold;
        uniform float knee;
        varying vec2 vUv;
        void main() {
          // Four taps rather than one: this pass is also the downsample, and a
          // point sample of an HDR buffer turns a single bright texel into a
          // firefly that the blur then smears across the frame.
          vec4 sum = texture2D(source, vUv + vec2(-1.0, -1.0) * texel)
                   + texture2D(source, vUv + vec2( 1.0, -1.0) * texel)
                   + texture2D(source, vUv + vec2(-1.0,  1.0) * texel)
                   + texture2D(source, vUv + vec2( 1.0,  1.0) * texel);
          sum *= 0.25;
          // Premultiplied throughout, so a half-covered edge texel contributes
          // half its light to the halo, which is exactly how much of it there is.
          float luma = dot(sum.rgb, vec3(0.2126, 0.7152, 0.0722));
          float soft = clamp(luma - threshold + knee, 0.0, 2.0 * knee);
          soft = soft * soft / (4.0 * knee + 1e-4);
          float weight = max(soft, luma - threshold) / max(luma, 1e-4);
          gl_FragColor = vec4(sum.rgb * weight, sum.a * weight);
        }
      `,
    }));
    this.blurMaterial = this.material(new T.ShaderMaterial({
      blending: T.NoBlending,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        source: { value: this.bloomB.texture },
        texel: { value: new T.Vector2() },
        direction: { value: new T.Vector2(1, 0) },
      },
      vertexShader,
      fragmentShader: `
        precision highp float;
        uniform sampler2D source;
        uniform vec2 texel;
        uniform vec2 direction;
        varying vec2 vUv;
        void main() {
          // Pair adjacent Gaussian coefficients through linear filtering. The
          // fractional offset is their weighted centroid, so this is the same
          // contiguous 25-coefficient kernel in 13 texture reads, with no gaps
          // or stretched highlights.
          vec2 axisStep = direction * texel;
          vec4 sum = texture2D(source, vUv);
          float total = 1.0;
          for (int pair = 0; pair < 6; pair++) {
            float x = 1.0 + float(pair) * 2.0;
            float first = exp(-0.5 * x * x / 16.0);
            float second = exp(-0.5 * (x + 1.0) * (x + 1.0) / 16.0);
            float combined = first + second;
            float offset = (x * first + (x + 1.0) * second) / combined;
            vec2 reach = axisStep * offset;
            sum += (texture2D(source, vUv + reach) + texture2D(source, vUv - reach)) * combined;
            total += 2.0 * combined;
          }
          sum /= total;
          gl_FragColor = sum;
        }
      `,
    }));
    this.passScene = new T.Scene();
    this.passQuad = new T.Mesh(this.geometry(new T.PlaneGeometry(2, 2)), this.brightMaterial);
    this.passQuad.frustumCulled = false;
    this.passScene.add(this.passQuad);
  }
  blit(material, target) {
    this.passQuad.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.passScene, this.postCamera);
  }
  renderHalation() {
    this.blit(this.brightMaterial, this.bloomB);
    this.blurMaterial.uniforms.source.value = this.bloomB.texture;
    this.blurMaterial.uniforms.direction.value.set(1, 0);
    this.blit(this.blurMaterial, this.bloomA);
    this.blurMaterial.uniforms.source.value = this.bloomA.texture;
    this.blurMaterial.uniforms.direction.value.set(0, 1);
    this.blit(this.blurMaterial, this.bloomB);
  }
  // Re-point the surfaces at a corrected environment scale. Only the materials
  // that actually sample the environment change: the exposure, the lamps and
  // the coat's own geometry are the rig's and do not depend on which photograph
  // is behind the cube. `needsUpdate` is deliberately not set — envMapIntensity
  // is a uniform, not a shader define, so the compiled program is still valid
  // and forcing a recompile here would stall the first frame for no reason.
  applyEnvironmentScale(scale) {
    if (!(scale > 0) || Math.abs(scale - this.envScale) < 1e-4) return;
    this.envScale = scale;
    const env = this.light.env = this.baseEnv * scale;
    for (const material of this.faceMaterialValues()) material.envMapIntensity = env;
    if (this.markMaterial && COATED(this.model)) this.markMaterial.envMapIntensity = env;
  }

  setupLight() {
    const speedcube = SCULPTED(this.model), coated = COATED(this.model);
    const L = this.light;
    // A high dynamic range studio made from luminous softboxes, prefiltered for
    // physically based reflections. No remote HDR image or runtime network call.
    const room = new T.Scene();
    // A graded dome and a floor rather than a flat fill. Glossy caps mirror this
    // room, and a constant background made every one of them the same blue. The
    // gradient is built to average out to the old flat value, so it changes the
    // direction of the reflections without changing exposure.
    const dome = new T.SphereGeometry(30, 24, 16);
    const sky = [], domePosition = dome.getAttribute("position");
    for (let i = 0; i < domePosition.count; i++) {
      const t = Math.min(1, Math.max(0, domePosition.getY(i) / 60 + .5)) ** 2;
      sky.push(.03 + .23 * t, .035 + .245 * t, .05 + .28 * t);
    }
    dome.setAttribute("color", new T.Float32BufferAttribute(sky, 3));
    room.add(new T.Mesh(dome, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide })));
    const cards = [
      { p: [-4, 6, 4], w: 4, h: 5, c: [5.5, 5.2, 4.8] },
      { p: [5, 2, 1], w: 1.4, h: 5, c: [3.1, 3.7, 4.8] },
      { p: [0, 5, -4], w: 4, h: 2.5, c: [3.6, 3.8, 4.2] },
      { p: [-1, -2, 6], w: 3, h: 1, c: [.7, .75, .8] },
      { p: [-6, -1, 2.5], w: 2.5, h: 5, c: [2.8, 3.1, 3.5] },
      // Negative fill. The dark gaps between softboxes are what give plastic its
      // contrast; without them every reflection is one bright smear.
      { p: [-2.6, .5, 4.6], w: 3, h: 4, c: [.012, .013, .016] },
      { p: [3.4, -1.2, 3.6], w: 2.5, h: 4, c: [.012, .013, .016] },
      // Floor, slightly warm, for the bounce on the underside of the cube.
      { p: [0, -3.2, 0], w: 24, h: 24, c: [.10, .09, .075] },
    ];
    // The rear window reflects across the top at the default orbit. An overhead
    // panel takes over when tipped toward the viewer, and side strips trace the
    // shoulders. Their HDR reflection is exposed separately from diffuse fill.
    if (coated) cards.push(...[
      { p: [-2.5, 4, -8], w: 5, h: 5, c: [16, 15.7, 15.2] },
      { p: [-2, 9, 1], w: 4, h: 4, c: [11, 11.2, 11.8] },
      { p: [-8, -1, 1], w: 1.4, h: 7, c: [16, 16.2, 17] },
      { p: [8, -1.5, 0], w: 1.4, h: 7, c: [13, 13.4, 14.4] },
      { p: [-2.5, 4, 7], w: 5, h: 4, c: [8, 7.9, 7.7] },
    ].map(card => ({ ...card, c: card.c.map(v => v * L.coatEnv) })));
    const diffusion = coated ? softboxMap() : null;
    for (const c of cards) {
      const card = new T.Mesh(new T.PlaneGeometry(c.w, c.h), new T.MeshBasicMaterial({ color: new T.Color(...c.c), map: coated && c.c[0] > 1 ? diffusion : null, side: T.DoubleSide }));
      card.position.set(...c.p); card.lookAt(0, 0, 0); room.add(card);
    }
    // The environment that reaches the materials is chosen here: the studio
    // room costs nothing to wait for; a photograph is prefiltered the moment
    // its bytes arrive. Either way `scene.environment` is set exactly once.
    const pmrem = new T.PMREMGenerator(this.renderer);
    const disposeEnvironmentBuilder = () => {
      pmrem.dispose();
      diffusion?.dispose();
      room.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
    };
    if (this.environment === "studio") {
      try {
        this.environmentMap = pmrem.fromScene(room, coated ? .006 : .035, .1, 40);
        this.scene.environment = this.environmentMap.texture;
      } finally {
        disposeEnvironmentBuilder();
      }
    } else {
      this.envReady.then(() => {
        if (this.disposed) return;
        if (!this.envMap) throw new Error(`Environment data unavailable: ${this.environment}`);
        const tex = new T.DataTexture(toHalfFloat(this.envMap.data), this.envMap.width, this.envMap.height, T.RGBAFormat, T.HalfFloatType);
        tex.mapping = T.EquirectangularReflectionMapping;
        tex.minFilter = T.LinearMipmapLinearFilter;
        tex.magFilter = T.LinearFilter;
        tex.generateMipmaps = true;
        tex.needsUpdate = true;
        try {
          this.environmentMap = pmrem.fromEquirectangular(tex);
        } finally {
          tex.dispose();
        }
        this.scene.environment = this.environmentMap.texture;
      }).catch(error => {
        console.warn(`CubeTracker environment "${this.environment}" failed:`, error);
        if (this.disposed) return;
        this.environmentMap = pmrem.fromScene(room, coated ? .006 : .035, .1, 40);
        this.scene.environment = this.environmentMap.texture;
      }).then(() => {
        if (this.disposed || !this.scene.environment) return;
        this.render();
        // The stage was mounted while the photograph was in flight; only now
        // is there a frame worth materializing.
        this.onReady?.();
      }).catch(error => {
        console.warn("CubeTracker environment fallback failed:", error);
        if (!this.disposed) this.onUnavailable?.();
      }).finally(() => {
        disposeEnvironmentBuilder();
      });
    }
    const hemi = new T.HemisphereLight(speedcube ? 0xf5f6ff : 0xe5eeff, 0x76716a, L.hemi);
    this.hemiLight = hemi;
    this.scene.add(hemi);
    const key = new T.DirectionalLight(0xfff3e2, L.key);
    key.position.set(...KEY_AT);
    key.castShadow = true;
    // The lens defocuses the far side of the cube, and a shadow edge built
    // from 1024 texels turns into visible steps the moment something blurs it.
    const shadowMap = this.settings.camera ? 2048 : speedcube ? 1024 : 512;
    key.shadow.mapSize.set(shadowMap, shadowMap);
    Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: .5, far: 24 });
    key.shadow.bias = -.00025;
    key.shadow.normalBias = speedcube ? .002 : .015;
    key.shadow.radius = 5;
    key.shadow.blurSamples = this.settings.camera ? 20 : 12;
    this.keyLight = key;
    this.scene.add(key);
    // A coated cube earns a stronger rim: the clear layer is what catches a
    // light behind it, and without one the coat has nothing to prove it exists
    // on the faces turned away from the key.
    const rim = new T.DirectionalLight(0xbcd7ff, L.rim);
    this.rimLight = rim;
    rim.position.set(...RIM_AT); this.scene.add(rim);
    const fill = new T.DirectionalLight(0xffffff, L.fill);
    this.fillLight = fill;
    fill.position.set(...FILL_AT); this.scene.add(fill);
    const floor = new T.Mesh(this.geometry(new T.PlaneGeometry(200, 200)), this.material(new T.ShadowMaterial({ opacity: coated ? .04 : speedcube ? .025 : .17 })));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.55;
    floor.receiveShadow = true;
    this.scene.add(floor);
  }
  setPalette(colors) {
    for (const [f, color] of Object.entries(colors)) this.faceMaterials[f].color.set(color);
    if (this.markMaterial && this.model !== "og" && this.model !== "stickers" && colors.B) this.markMaterial.color.set(colors.B);
    this.render();
  }
  setTuning(values) {
    if (this.disposed || !values) return;
    this.tuning = { ...this.tuning, ...values };
    const next = withWearMaterial(this.tuning, this.wear, this.model);
    this.light = next;
    this.baseEnv = this.tuning.env;
    this.renderer.toneMappingExposure = next.exposure;
    if (this.postMaterial?.uniforms?.exposure) this.postMaterial.uniforms.exposure.value = next.exposure;
    if (this.hemiLight) this.hemiLight.intensity = next.hemi;
    if (this.keyLight) this.keyLight.intensity = next.key;
    if (this.rimLight) this.rimLight.intensity = next.rim;
    if (this.fillLight) this.fillLight.intensity = next.fill;
    const env = next.env * this.envScale;
    this.light.env = env;
    const coated = COATED(this.model);
    for (const material of this.faceMaterialValues()) {
      material.envMapIntensity = env;
      material.clearcoat = next.gloss;
      // Every model's gloss layer samples the wear map now, so the floor
      // divide is no longer the coated model's private arrangement. The live
      // tuning control has to make the same correction the constructor did, or
      // dragging a slider would quietly reset the finish to a darker one.
      material.clearcoatRoughness = this.wear && material.clearcoatRoughnessMap
        ? next.glossRough / (material.userData.roughnessFloor ?? WEAR_ROUGHNESS_FLOOR)
        : next.glossRough;
    }
    if (this.markMaterial && coated) this.markMaterial.envMapIntensity = env;
    this.render();
  }
  draw(stickers, spec, fraction) {
    if (this.disposed) return;
    const q = spec ? new T.Quaternion().setFromAxisAngle(vector(spec.axis), spec.angle * fraction) : null;
    for (const { mesh, p } of this.bodies) {
      const moving = spec && spec.select(p);
      const jitter = this.pieceJitter(p);
      mesh.position.fromArray(moving ? rotate(p, spec, fraction) : p);
      if (moving) mesh.quaternion.copy(q); else mesh.quaternion.identity();
      if (jitter) {
        // The imperfection lives in the piece's own frame, so a turning layer
        // carries it around rather than sliding the piece through it.
        const offset = this.scratch.copy(jitter.offset);
        if (moving) offset.applyQuaternion(q);
        mesh.position.add(offset);
        mesh.quaternion.multiply(jitter.rotation);
      }
    }
    let center = 0;
    stickers.forEach((st, i) => {
      const moving = spec && spec.select(st.p);
      const transform = v => moving ? rotate(v, spec, fraction) : v;
      const p = transform(st.p), n = transform(st.n), right = transform(st.right), up = transform(st.down).map(v => -v);
      const mesh = this.faces[i];
      const jitter = this.pieceJitter(st.p);
      const cap = SCULPTED(this.model) ? .487 : this.model === "stickers" ? .486 : .478;
      mesh.material = this.faceMaterials[st.face];
      if (jitter) {
        // Same piece frame as the body above, so the cap stays glued to it.
        const local = this.scratch.fromArray(st.n).multiplyScalar(cap).applyQuaternion(jitter.rotation).add(jitter.offset);
        if (moving) local.applyQuaternion(q);
        mesh.position.fromArray(p).add(local);
        if (moving) mesh.quaternion.copy(q); else mesh.quaternion.identity();
        mesh.quaternion.multiply(jitter.rotation).multiply(this.stickerBase(st));
      } else {
        mesh.position.fromArray(p.map((v, j) => v + n[j] * cap));
        mesh.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(vector(right), vector(up), vector(n)));
      }
      if (st.id.endsWith("4") && this.seams.length) {
        const seam = this.seams[center++];
        seam.position.copy(mesh.position).addScaledVector(vector(n), .079);
        seam.quaternion.copy(mesh.quaternion);
      }
      if (st.id === "U4" && this.mark) {
        // Use the cap's actual normal, including piece tilt, so the printed mark
        // remains attached to the film throughout a turn.
        const markNormal = SEPARATE_HOLDERS(this.model) ? new T.Vector3(0, 0, 1).applyQuaternion(mesh.quaternion) : vector(n);
        // The vinyl film's center sits at z = .0072 over a cap at .486; the
        // other finishes have their own printed height.
        const markHeight = SEPARATE_HOLDERS(this.model) ? .0286 : COATED(this.model) ? COATING_CENTER + .0008 : this.model === "stickers" ? .0082 : .0208;
        this.mark.position.copy(mesh.position).addScaledVector(markNormal, markHeight);
        this.mark.quaternion.copy(mesh.quaternion);
        if (this.markRoll) this.mark.quaternion.multiply(this.markRoll);
      }
    });
    this.setMotion(spec, fraction);
    this.invalidateShadow();
    this.render();
    // The trail belongs to this frame only. A resize or an environment landing
    // re-renders the same pose, and it must come back as a still.
    if (this.postMaterial?.uniforms.motionAngle) this.postMaterial.uniforms.motionAngle.value = 0;
  }
  // Feed the composite the one rotation it needs to derive every pixel's
  // velocity: the axis and centre in view space, which slice of the cube is
  // turning, and how far it moved since the previous drawn frame. The angle is
  // measured rather than assumed, so a frame the browser skipped produces a
  // longer trail on its own, the way a shutter does, and an eased turn blurs
  // most in the middle where it is actually fastest.
  setMotion(spec, fraction) {
    const uniforms = this.postMaterial?.uniforms;
    if (!uniforms?.motionAngle) return;
    const previous = this.motionState;
    this.motionState = spec ? { spec, fraction } : null;
    uniforms.motionAngle.value = 0;
    if (!spec || !previous || previous.spec !== spec) return;
    const delta = (fraction - previous.fraction) * spec.angle * LENS.shutter;
    if (!Number.isFinite(delta) || Math.abs(delta) < 2e-4) return;
    // Which layers the move takes with it, asked of the move itself rather
    // than re-derived here: a face turn, a wide turn, a slice and a whole-cube
    // rotation all answer correctly, and a new kind of move would too.
    const layers = [-1, 0, 1].filter(k => spec.select(spec.axis.map(v => v * k)));
    if (!layers.length) return;
    const low = Math.min(...layers), high = Math.max(...layers);
    this.motionScratch ??= {
      axis: new T.Vector3(),
      centre: new T.Vector3(),
      orientation: new T.Quaternion(),
      view: new T.Quaternion(),
    };
    const scratch = this.motionScratch;
    this.root.updateWorldMatrix(true, false);
    this.camera.updateMatrixWorld();
    // The cube's own axis, carried through the orbit and then into the camera's
    // frame, where the depth buffer already lives.
    uniforms.motionAxis.value
      .fromArray(spec.axis)
      .applyQuaternion(this.root.getWorldQuaternion(scratch.orientation))
      .applyQuaternion(this.camera.getWorldQuaternion(scratch.view).invert())
      .normalize();
    uniforms.motionCenter.value
      .setFromMatrixPosition(this.root.matrixWorld)
      .applyMatrix4(this.camera.matrixWorldInverse);
    // Half a piece past the outermost turning layer, in the cube's own units;
    // the shader divides the view-space distance by the zoom to compare.
    uniforms.motionRange.value.set(low - .5, high + .5);
    uniforms.motionMid.value = (low + high) / 2;
    uniforms.motionScale.value = this.root.scale.x;
    uniforms.projection.value.copy(this.camera.projectionMatrix);
    uniforms.motionAngle.value = delta;
  }
  orbit(pitch, yaw, zoom) {
    if (this.disposed) return;
    this.root.rotation.set(T.MathUtils.degToRad(-pitch - 25), T.MathUtils.degToRad(yaw), 0, "XYZ");
    this.root.scale.setScalar(zoom);
    this.invalidateShadow();
    this.render();
  }
  invalidateShadow() {
    if (this.settings.shadows) this.renderer.shadowMap.needsUpdate = true;
  }
  frameBudget(width, height) {
    const speedcube = SCULPTED(this.model);
    const fitPixels = (ratio, pixels) => Math.min(ratio, Math.sqrt(pixels / Math.max(1, width * height)));
    let ratio = this.restPixelRatio,
      samples = this.settings.camera ? 8 : this.settings.post ? 4 : 0,
      shadowSize = this.settings.camera ? 2048 : speedcube ? 1024 : 512,
      shadowSamples = this.settings.camera ? 20 : 12;

    if (this.interactionActive) {
      ratio = this.settings.camera
        ? fitPixels(Math.min(this.restPixelRatio, 1), CINEMATIC_BUDGET.maxInteractionPixels)
        : Math.min(this.restPixelRatio, 1);
      samples = this.target ? 1 : 0;
      shadowSize = 512;
      shadowSamples = 6;
    } else if (this.settings.camera && this.animationActive) {
      ratio = fitPixels(Math.min(this.restPixelRatio, 1.5), CINEMATIC_BUDGET.maxAnimationPixels);
      samples = 4;
      shadowSize = 1024;
      shadowSamples = 12;
    } else if (this.settings.camera) {
      ratio = fitPixels(ratio, CINEMATIC_BUDGET.maxStillPixels);
      const bufferPixels = width * height * ratio * ratio;
      const bufferEdge = Math.min(width, height) * ratio;
      samples = bufferPixels <= CINEMATIC_BUDGET.maxEightSamplePixels ? 8 : 4;
      shadowSize = bufferEdge <= CINEMATIC_BUDGET.compactShadowEdge ? 1024 : 2048;
      shadowSamples = shadowSize === 2048 ? 20 : 12;
    }
    return { ratio, samples, shadowSize, shadowSamples };
  }
  applyFrameBudget(width, height) {
    const { ratio, samples, shadowSize, shadowSamples } = this.frameBudget(width, height);
    if (this.target && this.target.samples !== samples) {
      this.target.samples = samples;
      // Sample count is framebuffer state; force Three to allocate the target
      // again even when its dimensions happen not to change.
      this.target.dispose();
    }
    const shadow = this.keyLight?.shadow;
    if (shadow && shadow.mapSize.x !== shadowSize) {
      shadow.map?.dispose();
      shadow.mapPass?.dispose();
      shadow.map = shadow.mapPass = null;
      shadow.mapSize.set(shadowSize, shadowSize);
      this.invalidateShadow();
    }
    if (shadow && shadow.blurSamples !== shadowSamples) {
      shadow.blurSamples = shadowSamples;
      this.invalidateShadow();
    }
    this.renderer.setPixelRatio(ratio);
  }
  // Cinematic keeps its full-density still frame, with 8x coverage on normal
  // previews and 4x on targets above the sample budget. While pieces are visibly
  // moving, motion masks the small difference from 1.5x density, 4x coverage and
  // a 1024 shadow. The still budget is restored once per playback, not per move.
  setAnimationActive(active) {
    if (!this.settings.camera || this.disposed || this.animationActive === active) return;
    this.animationActive = active;
    this.resize();
  }
  // A full-screen calibration canvas can contain several times as many pixels
  // as the normal previews. Keep the exact same materials and post-processing,
  // but render interactions at 1x with cheaper coverage; the still frame snaps
  // back to the selected quality as soon as the gesture ends.
  setInteractionActive(active) {
    if (this.disposed || this.interactionActive === active) return;
    this.interactionActive = active;
    this.resize();
  }
  resize() {
    if (this.disposed || !this.stage) return;
    const width = this.stage.clientWidth, height = this.stage.clientHeight;
    if (!width || !height) return;
    this.applyFrameBudget(width, height);
    this.renderer.setSize(width, height, false);
    if (this.target) {
      const ratio = this.renderer.getPixelRatio();
      const bufferWidth = Math.max(1, Math.round(width * ratio)), bufferHeight = Math.max(1, Math.round(height * ratio));
      this.target.setSize(bufferWidth, bufferHeight);
      this.postMaterial.uniforms.resolution.value.set(bufferWidth, bufferHeight);
      // Occlusion should reach about one piece gap whatever the canvas size.
      this.postMaterial.uniforms.radius.value = Math.max(6, bufferHeight * .035);
      if (this.bloomA) {
        const halfWidth = Math.max(1, bufferWidth >> 1), halfHeight = Math.max(1, bufferHeight >> 1);
        this.bloomA.setSize(halfWidth, halfHeight);
        this.bloomB.setSize(halfWidth, halfHeight);
        // Half a source texel: the four taps then land on the exact 2x2 block
        // the destination texel covers, which is what makes this a box filter
        // rather than four arbitrary samples near a point.
        this.brightMaterial.uniforms.texel.value.set(.5 / bufferWidth, .5 / bufferHeight);
        this.blurMaterial.uniforms.texel.value.set(1 / halfWidth, 1 / halfHeight);
      }
    }
    this.camera.aspect = width / height;
    // Keep a comfortable margin on both the narrow timer and the large preview.
    this.camera.fov = T.MathUtils.radToDeg(2 * Math.atan(2.65 / (9.93 * Math.min(1, this.camera.aspect))));
    this.camera.updateProjectionMatrix();
    this.render();
  }
  render() {
    // Render only after an interaction, move or resize; never an idle frame loop.
    if (this.disposed || !this.stage || this.stage.dataset.mode === "net") return;
    // A photographic environment compiles the materials once, when its PMREM
    // lands; drawing before that frame would show a cube with no reflections.
    if (this.environment !== "studio" && !this.scene.environment) return;
    if (!this.target) { this.renderer.render(this.scene, this.camera); return; }
    // Off-screen first, in linear HDR. Three skips tone mapping whenever a
    // render target is bound, so the composite owns exposure, the tone curve
    // and the sRGB encode, and matches what the direct path would have drawn.
    this.postMaterial.uniforms.projectionInverse.value.copy(this.camera.projectionMatrixInverse);
    this.renderer.setRenderTarget(this.target);
    this.renderer.render(this.scene, this.camera);
    // Halation is screen-space and must follow the current projection. Reusing
    // the previous bloom buffer while orbiting leaves highlights pinned to the
    // glass instead of the cube. The paired half-resolution kernel is cheap
    // enough to update during the reduced-quality interaction path.
    if (this.bloomA) this.renderHalation();
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.postScene, this.postCamera);
  }
  // Leave the DOM without giving up the context. The canvas keeps its WebGL
  // state, its prefiltered environment and its compiled shaders while detached,
  // so adopting it back costs a resize instead of a rebuild.
  park() {
    if (this.disposed) return;
    this.observer?.disconnect();
    this.canvas?.remove();
    this.stage = null;
  }
  // Move into a new stage. `onUnavailable` is re-bound because the scene that
  // owns the fallback is a different object each time the view is rebuilt.
  adopt(stage, onUnavailable, onReady) {
    if (this.disposed) return;
    if (onUnavailable) this.onUnavailable = onUnavailable;
    if (onReady) this.onReady = onReady;
    if (this.stage === stage && this.canvas?.parentNode === stage) return;
    this.observer?.disconnect();
    this.stage = stage;
    stage.append(this.canvas);
    this.observer?.observe(stage);
    this.resize();
  }
  destroy() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.slot && STUDIO.get(this.slot) === this) STUDIO.delete(this.slot);
    this.observer?.disconnect();
    this.canvas?.removeEventListener("webglcontextlost", this.onLost);
    this.geometries.forEach(g => g.dispose());
    this.materials.forEach(m => m.dispose());
    this.scene?.traverse(o => o.shadow?.dispose());
    this.markTexture?.dispose();
    this.target?.depthTexture?.dispose();
    this.target?.dispose();
    this.bloomA?.dispose();
    this.bloomB?.dispose();
    this.environmentMap?.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas?.remove();
  }
}
