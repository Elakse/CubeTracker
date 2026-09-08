/* Optional, on-demand renderer. All geometry, textures and studio light are local. */
import * as T from "./vendor/three.module.js";
import { RoundedBoxGeometry } from "./vendor/RoundedBoxGeometry.js";

const vector = a => new T.Vector3(...a);
const rotate = (v, spec, fraction) => window.CT.rotate(v, spec.axis, spec.angle * fraction);

// What each quality level buys. Everything above "balanced" costs GPU time on
// every frame of a scramble animation, which is why it is the person's choice
// and not ours: detail adds a roughness map and 54 individual cap geometries,
// post adds an off-screen pass with occlusion, aberration and grain.
const QUALITY = {
  low: { pixelRatio: 1, shadows: false, detail: false, post: false },
  balanced: { pixelRatio: 2, shadows: true, detail: false, post: false },
  high: { pixelRatio: 2, shadows: true, detail: true, post: false },
  ultra: { pixelRatio: 2, shadows: true, detail: true, post: true },
};
const SMUDGE_MEAN = .8;
// Both speedcubes share their molded outlines. UV pools gently near the cap's
// perimeter and blends through a shallow dip into an almost-flat center.
const SCULPTED = model => model === "speedcube" || model === "uv";
const COATED = model => model === "uv";
const COATING_CENTER = .021;

function coatingProfile() {
  const profiles = [[.480, .04, -.045], [.494, .043, -.021]];
  // Closely spaced samples resolve both sides of a low, rounded ridge. The
  // Gaussian shoulders have no crease, and the inner dip fades to a flat face.
  for (const inset of [0, .004, .008, .012, .016, .021, .026, .032, .038, .044, .052, .062, .074, .09, .112, .145, .185, .24, .32, .4]) {
    const ridge = .007 * Math.exp(-(((inset - .038) / .026) ** 2));
    const dip = .0012 * Math.exp(-(((inset - .090) / .038) ** 2));
    const t = Math.min(1, inset / .025), blend = t * t * (3 - 2 * t);
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
const RIG = {
  tiles:     { exposure: .93, hemi: .58, key: 1.02, rim: 1.05, fill: .80, env: .40, coatEnv: 1, gloss: .46, glossRough: .13 },
  stickers:  { exposure: .93, hemi: .58, key: 1.06, rim: 1.05, fill: .78, env: .48, coatEnv: 1, gloss: .32, glossRough: .17 },
  speedcube: { exposure: .93, hemi: .45, key: 1.30, rim: .68, fill: .64, env: .48, coatEnv: 1, gloss: .16, glossRough: .10 },
  uv:        { exposure: 1.0, hemi: .72, key: 2.10, rim: .72, fill: 1.05, env: .70, coatEnv: 3.5, gloss: 1, glossRough: .065 },
};
const KEY_AT = [-3.5, 6, 7], RIM_AT = [4, 3, -4], FILL_AT = [5.5, -1.5, 3.5];

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
  // Tiling value noise. Shared by the smudge map and the coat's orange peel so
  // there is one lattice to reason about instead of two.
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

function smudgeMap(size = 256) {
  // Handling leaves blotches: a coarse octave for where a thumb has been, a
  // finer one for the micro-texture. Driving roughness with this is what stops
  // every cap answering the softboxes with one identical clean highlight.
  const noise = valueNoise();
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    const value = SMUDGE_MEAN + (noise(u, v, 4, 1) - .5) * .26 + (noise(u, v, 13, 2) - .5) * .1;
    const byte = Math.max(0, Math.min(255, Math.round(value * 255)));
    const i = (y * size + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = byte;
    data[i + 3] = 255;
  }
  const texture = new T.DataTexture(data, size, size);
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.minFilter = texture.magFilter = T.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function coatingNormal(size = 512, strength = 1.15) {
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
  // One entry per cap: where it reads the smudge map and how its plastic was
  // mixed. Deterministic, so a cube looks the same every time it is built.
  let seed = 991;
  const next = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
  return Array.from({ length: 54 }, () => ({
    shift: [next(), next()],
    tint: [1 + (next() - .5) * .035, 1 + (next() - .5) * .035, 1 + (next() - .5) * .035],
  }));
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

function faceGeometry(model = "tiles", cell = 4, variant = null) {
  // Concentric rounded-square contours form a molded, slightly convex cap.
  // The crown bends softbox reflections across the face instead of leaving a
  // perfectly flat, sticker-like surface. Shared vertices keep shoulders smooth.
  const profiles = model === "stickers"
    ? [[.435, .065, 0], [.437, .067, .0012], [.435, .066, .0024], [.32, .06, .0024], [.12, .04, .0024]]
    : COATED(model)
      ? coatingProfile()
    : SCULPTED(model)
      ? [[.480, .04, -.045], [.494, .043, -.021], [.497, .048, -.004], [.493, .052, .004], [.482, .061, .009], [.44, .065, .014], [.32, .07, .018], [.12, .05, .020]]
      : [[.423, .092, 0], [.444, .108, .010], [.450, .116, .026], [.446, .122, .044], [.432, .127, .060], [.392, .134, .070], [.32, .12, .078], [.23, .09, .085], [.12, .05, .089]];
  const col = cell % 3 - 1, row = 1 - Math.floor(cell / 3);
  const positions = [], uvs = [], shades = [], indices = [], steps = 12;
  const sideSteps = COATED(model) ? 12 : 0, count = 4 * (steps + 1 + sideSteps);
  // Fake contact occlusion. The groove where two pieces meet is far too small
  // for a shadow map to resolve, but the eye reads its absence as "rendered by
  // a computer", so rings sitting deeper than the crown darken toward AO_FLOOR.
  const AO_FLOOR = SCULPTED(model) ? .55 : undefined;
  const depths = profiles.map(profile => profile[2]), lowest = Math.min(...depths);
  const span = (Math.max(...depths) - lowest || 1) * .7;
  // The moulding tint rides in the same attribute as the occlusion, so per-cap
  // variation costs one buffer instead of 54 materials. Corner wear was tried
  // here too and removed: a term that peaks at the corner arcs and falls to zero
  // between them interpolates across these coarse rings as a four-pointed star.
  const tint = variant ? variant.tint : [1, 1, 1];
  const shift = variant ? variant.shift : [0, 0];
  const shaded = AO_FLOOR !== undefined || variant !== null;
  for (const [h, r, z] of profiles) {
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
        const nextRadius = nextInner ? Math.min(h * .88, (cell === 4 ? .375 : col && row ? .065 : .31) * h / .497) : r;
        const angle = (corner + 1) * Math.PI / 2;
        const end = [nx * (h - nextRadius) + nextRadius * Math.cos(angle), ny * (h - nextRadius) + nextRadius * Math.sin(angle)];
        const start = contour.at(-1);
        for (let i = 1; i <= sideSteps; i++) {
          const t = i / (sideSteps + 1);
          contour.push([start[0] + (end[0] - start[0]) * t, start[1] + (end[1] - start[1]) * t]);
        }
      }
      for (let [x, y] of contour) {
        if (SCULPTED(model)) {
          // Miter the outside edges where two colored sides meet. Without this,
          // their beveled skirts intersect and shimmer as the cube rotates.
          const boundary = .487 + z - .001;
          if (col && x * col > boundary) x = col * boundary;
          if (row && y * row > boundary) y = row * boundary;
        }
        positions.push(x, y, z); uvs.push(x / .9 + .5 + shift[0], y / .9 + .5 + shift[1]);
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
  positions.push(0, 0, model === "stickers" ? .0024 : COATED(model) ? COATING_CENTER : SCULPTED(model) ? .020 : .090); uvs.push(.5 + shift[0], .5 + shift[1]); if (shaded) shades.push(tint[0], tint[1], tint[2]);
  const last = (profiles.length - 1) * count;
  for (let i = 0; i < count; i++) indices.push(last + i, last + (i + 1) % count, center);
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
  if (shaded) geometry.setAttribute("color", new T.Float32BufferAttribute(shades, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
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

export class RealisticCube {
  constructor(stage, onUnavailable, model = "tiles", quality = "balanced") {
    this.stage = stage;
    this.model = model;
    this.quality = Object.hasOwn(QUALITY, quality) ? quality : "balanced";
    const settings = this.settings = QUALITY[this.quality];
    const L = this.light = RIG[model] ?? RIG.tiles;
    this.geometries = [];
    this.materials = [];
    // The post chain multisamples its own target, so the canvas must not pay
    // for antialiasing a second time.
    this.renderer = new T.WebGLRenderer({ alpha: true, antialias: !settings.post, powerPreference: settings.post ? "high-performance" : "low-power" });
    try {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, settings.pixelRatio));
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.outputColorSpace = T.SRGBColorSpace;
      this.renderer.toneMapping = T.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = L.exposure;
      this.renderer.shadowMap.enabled = settings.shadows;
      this.renderer.shadowMap.type = T.VSMShadowMap;
      this.canvas = this.renderer.domElement;
      this.canvas.className = "cube-studio-canvas";
      this.canvas.dataset.model = model;
      this.canvas.setAttribute("aria-hidden", "true");
      this.onLost = event => { event.preventDefault(); onUnavailable(); };
      this.canvas.addEventListener("webglcontextlost", this.onLost);
      stage.append(this.canvas);
      this.scene = new T.Scene();
      this.camera = new T.PerspectiveCamera(33, 1, .1, 60);
      this.camera.position.set(0, 4.2, 9);
      this.camera.lookAt(0, -.06, 0);
      this.root = new T.Group();
      this.scene.add(this.root);
      this.setupLight();
      this.grain = plasticGrain();
      // UV adds a curved clear surface over the same stickerless cap outlines.
      const speedcube = SCULPTED(model), coated = COATED(model), stickers = model === "stickers";
      this.coating = coated ? coatingNormal() : null;
      // Recessed internals stay dark; bright reflective gaps flatten the caps.
      const shell = this.material(new T.MeshPhysicalMaterial({ color: coated ? 0x34383b : speedcube ? 0x6e5a45 : 0x171b20, roughness: coated ? .58 : speedcube ? .6 : .31, metalness: 0, clearcoat: coated ? .12 : speedcube ? .08 : .28, clearcoatRoughness: coated ? .15 : .24, ...(coated ? { envMapIntensity: .12 } : {}), bumpMap: this.grain, bumpScale: coated ? .0004 : .0008 }));
      const body = this.geometry(new RoundedBoxGeometry(speedcube ? .91 : .972, speedcube ? .91 : .972, speedcube ? .91 : .972, 5, speedcube ? .15 : .105));
      this.bodies = [];
      for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
        if (!x && !y && !z) continue;
        const mesh = new T.Mesh(body, shell);
        mesh.castShadow = mesh.receiveShadow = true;
        this.root.add(mesh);
        this.bodies.push({ mesh, p: [x, y, z] });
      }
      // The core becomes visible in the gaps while a layer turns.
      this.root.add(new T.Mesh(this.geometry(new T.SphereGeometry(.73, 24, 16)), shell));
      this.smudge = settings.detail ? smudgeMap() : null;
      // At detail quality every cap gets its own geometry: the same moulded
      // shape, but its own smudge offset, tint and wear, so 54 caps stop being
      // copies of nine.
      const cells = speedcube ? 9 : 1;
      const variants = settings.detail ? capVariants() : coated ? capVariants().slice(0, cells).map(v => ({ ...v, tint: [1, 1, 1] })) : null;
      const faceGeometries = Array.from({ length: settings.detail ? 54 : cells }, (_, i) => this.geometry(faceGeometry(model, i % cells, variants && variants[i])));
      // A UV finish is a layered surface, not a shinier plastic: the coloured
      // plastic keeps its own diffuse look under a separate, near-mirror clear
      // layer, and everything that reads as "coated" happens in that layer —
      // the Fresnel edge, the orange peel, the doubled highlight. Modelling it
      // as one glossy material instead would give a wet-looking cube with the
      // reflection sitting in the plastic rather than floating above it.
      // Strength and roughness come from the rig like every other model's; only
      // the maps are the coat's own. Spreading a second clearcoat literal here
      // is what let the table's gloss entry for this model sit inert.
      const coat = coated ? { clearcoatRoughness: L.glossRough / (settings.detail ? SMUDGE_MEAN : 1), clearcoatRoughnessMap: this.smudge, clearcoatNormalMap: this.coating, clearcoatNormalScale: new T.Vector2(.8, .8) } : {};
      this.faceMaterials = Object.fromEntries(["U", "R", "F", "D", "L", "B"].map(f => [f, this.material(new T.MeshPhysicalMaterial({ color: 0xffffff, roughness: (coated ? .17 : speedcube ? .30 : stickers ? .32 : .235) / (settings.detail ? SMUDGE_MEAN : 1), roughnessMap: this.smudge, metalness: 0, clearcoat: L.gloss, clearcoatRoughness: L.glossRough, ior: coated ? 1.52 : 1.46, envMapIntensity: L.env, vertexColors: speedcube || settings.detail, bumpMap: this.grain, bumpScale: coated ? .00012 : speedcube ? .00035 : .00065, ...coat }))]));
      if (coated) for (const material of Object.values(this.faceMaterials)) this.coatingLighting(material);
      this.faces = Array.from({ length: 54 }, (_, i) => {
        const mesh = new T.Mesh(faceGeometries[settings.detail ? i : i % cells], this.faceMaterials.U);
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
      if (speedcube) { this.setupCenterMark(); this.setupJitter(); }
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
  coatingLighting(material) {
    // Direct lights expose the pigment; the photographic cards supply the
    // clear-layer reflection. Avoid counting their diffuse fill a second time.
    material.onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_maps>',
        T.ShaderChunk.lights_fragment_maps + '\niblIrradiance *= 0.045;\nradiance *= 0.08;\n');
    };
    material.customProgramCacheKey = () => 'uv-coating-lighting-v1';
  }
  setupCenterMark() {
    // Printed center emblem, in the surface plane rather than raised geometry.
    this.markTexture = new T.TextureLoader().load(new URL("./gan-logo.png", import.meta.url).href, texture => {
      if (this.disposed) { texture.dispose(); return; }
      this.canvas.dataset.logo = "loaded";
      this.render();
    }, undefined, () => { if (this.mark) this.mark.visible = false; });
    this.markTexture.colorSpace = T.SRGBColorSpace;
    this.markTexture.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
    // The emblem is printed on the plastic and the coat goes over it, so it
    // must not read as a matte decal on a glossy face.
    const coated = COATED(this.model);
    this.markMaterial = this.material(new T.MeshPhysicalMaterial({ color: 0xffffff, map: this.markTexture, transparent: true, alphaTest: .15, roughness: coated ? .22 : .48, ...(coated ? { clearcoat: 1, clearcoatRoughness: .04, clearcoatNormalMap: this.coating, clearcoatNormalScale: new T.Vector2(.5, .5) } : {}), depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    if (coated) { this.markMaterial.envMapIntensity = this.light.env; this.coatingLighting(this.markMaterial); }
    this.mark = new T.Mesh(this.geometry(new T.PlaneGeometry(.72, .72)), this.markMaterial);
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
    this.target = new T.WebGLRenderTarget(1, 1, {
      type: T.HalfFloatType,
      samples: 4,
      stencilBuffer: false,
      depthTexture: new T.DepthTexture(1, 1, T.UnsignedIntType),
    });
    this.postCamera = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.postScene = new T.Scene();
    this.postMaterial = this.material(new T.ShaderMaterial({
      transparent: true,
      depthTest: false,
      depthWrite: false,
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
        aberration: { value: .006 },
        grain: { value: .016 },
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

        void main() {
          float depth = texture2D(depthBuffer, vUv).x;
          // Derivatives must be taken in uniform control flow, so the surface
          // frame is reconstructed for every pixel, the empty ones included.
          vec3 origin = viewPosition(vUv, depth);
          vec3 normal = normalize(cross(dFdx(origin), dFdy(origin)));

          // A lens pulls the channels further apart toward the edge of the frame.
          vec2 offCentre = vUv - 0.5;
          vec2 split = offCentre * dot(offCentre, offCentre) * aberration;
          vec4 low = texture2D(colorBuffer, vUv + split);
          vec4 mid = texture2D(colorBuffer, vUv);
          vec4 high = texture2D(colorBuffer, vUv - split);
          float alpha = max(mid.a, max(low.a, high.a));
          if (alpha <= 0.001) discard;
          // The buffer is premultiplied. Undo that so the tone curve sees the
          // surface rather than the coverage, and put it back at the end.
          vec3 colour = vec3(low.r, mid.g, high.b) / alpha;

          // The normal is what separates a groove from a cap's own curvature:
          // without it a domed crown occludes its own slope. It is reconstructed
          // from depth, so it carries the tessellation's faceting, and the bias
          // has to be wide enough to reject everything near the tangent plane.
          float shade = 0.0;
          float angle = hash12(gl_FragCoord.xy) * 6.2831853;
          for (int i = 0; i < 20; i++) {
            float t = (float(i) + 0.5) / 20.0;
            float spin = angle + t * 18.8495559;
            vec2 probe = vec2(cos(spin), sin(spin)) * sqrt(t) * radius / resolution;
            float sampled = texture2D(depthBuffer, vUv + probe).x;
            vec3 delta = viewPosition(vUv + probe, sampled) - origin;
            float dist = length(delta);
            // Empty space must never occlude, or the silhouette eats itself.
            float valid = 1.0 - step(0.9999, sampled);
            shade += valid * max(0.0, dot(normal, delta / max(dist, 1e-5)) - bias) / (1.0 + dist * dist * 40.0);
          }
          shade = clamp(shade / 20.0 * occlusion, 0.0, 0.85) * (1.0 - step(0.9999, depth));
          colour *= 1.0 - shade;

          colour = encodeSRGB(acesFilmic(colour));
          // Sensor grain belongs to the screen, not to the cube, so re-rendering
          // the same frame never makes it crawl.
          colour += (hash12(gl_FragCoord.xy * 1.7) - 0.5) * grain;

          gl_FragColor = vec4(clamp(colour, 0.0, 1.0) * alpha, alpha);
        }
      `,
    }));
    this.postScene.add(new T.Mesh(this.geometry(new T.PlaneGeometry(2, 2)), this.postMaterial));
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
    const pmrem = new T.PMREMGenerator(this.renderer);
    try { this.environment = pmrem.fromScene(room, coated ? .006 : .035, .1, 40); }
    finally { pmrem.dispose(); diffusion?.dispose(); room.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); }); }
    this.scene.environment = this.environment.texture;
    this.scene.add(new T.HemisphereLight(speedcube ? 0xf5f6ff : 0xe5eeff, 0x76716a, L.hemi));
    const key = new T.DirectionalLight(0xfff3e2, L.key);
    key.position.set(...KEY_AT);
    key.castShadow = true;
    key.shadow.mapSize.set(speedcube ? 1024 : 512, speedcube ? 1024 : 512);
    Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: .5, far: 24 });
    key.shadow.bias = -.00025;
    key.shadow.normalBias = speedcube ? .002 : .015;
    key.shadow.radius = 5;
    key.shadow.blurSamples = 12;
    this.scene.add(key);
    // A coated cube earns a stronger rim: the clear layer is what catches a
    // light behind it, and without one the coat has nothing to prove it exists
    // on the faces turned away from the key.
    const rim = new T.DirectionalLight(0xbcd7ff, L.rim);
    rim.position.set(...RIM_AT); this.scene.add(rim);
    const fill = new T.DirectionalLight(0xffffff, L.fill);
    fill.position.set(...FILL_AT); this.scene.add(fill);
    const floor = new T.Mesh(this.geometry(new T.PlaneGeometry(200, 200)), this.material(new T.ShadowMaterial({ opacity: coated ? .04 : speedcube ? .025 : .17 })));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.55;
    floor.receiveShadow = true;
    this.scene.add(floor);
  }
  setPalette(colors) {
    for (const [f, color] of Object.entries(colors)) this.faceMaterials[f].color.set(color);
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
        this.mark.position.copy(mesh.position).addScaledVector(vector(n), COATED(this.model) ? COATING_CENTER + .0008 : .0208);
        this.mark.quaternion.copy(mesh.quaternion);
      }
    });
    this.render();
  }
  orbit(pitch, yaw, zoom) {
    if (this.disposed) return;
    this.root.rotation.set(T.MathUtils.degToRad(-pitch - 25), T.MathUtils.degToRad(yaw), 0, "XYZ");
    this.root.scale.setScalar(zoom);
    this.render();
  }
  resize() {
    if (this.disposed) return;
    const width = this.stage.clientWidth, height = this.stage.clientHeight;
    if (!width || !height) return;
    this.renderer.setSize(width, height, false);
    if (this.target) {
      const ratio = this.renderer.getPixelRatio();
      const bufferWidth = Math.max(1, Math.round(width * ratio)), bufferHeight = Math.max(1, Math.round(height * ratio));
      this.target.setSize(bufferWidth, bufferHeight);
      this.postMaterial.uniforms.resolution.value.set(bufferWidth, bufferHeight);
      // Occlusion should reach about one piece gap whatever the canvas size.
      this.postMaterial.uniforms.radius.value = Math.max(6, bufferHeight * .035);
    }
    this.camera.aspect = width / height;
    // Keep a comfortable margin on both the narrow timer and the large preview.
    this.camera.fov = T.MathUtils.radToDeg(2 * Math.atan(2.65 / (9.93 * Math.min(1, this.camera.aspect))));
    this.camera.updateProjectionMatrix();
    this.render();
  }
  render() {
    // Render only after an interaction, move or resize; never an idle frame loop.
    if (this.disposed || this.stage.dataset.mode === "net") return;
    if (!this.target) { this.renderer.render(this.scene, this.camera); return; }
    // Off-screen first, in linear HDR. Three skips tone mapping whenever a
    // render target is bound, so the composite owns exposure, the tone curve
    // and the sRGB encode, and matches what the direct path would have drawn.
    this.postMaterial.uniforms.projectionInverse.value.copy(this.camera.projectionMatrixInverse);
    this.renderer.setRenderTarget(this.target);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.postScene, this.postCamera);
  }
  destroy() {
    if (this.disposed) return;
    this.disposed = true;
    this.observer?.disconnect();
    this.canvas?.removeEventListener("webglcontextlost", this.onLost);
    this.geometries.forEach(g => g.dispose());
    this.materials.forEach(m => m.dispose());
    this.scene?.traverse(o => o.shadow?.dispose());
    this.grain?.dispose();
    this.smudge?.dispose();
    this.coating?.dispose();
    this.markTexture?.dispose();
    this.target?.depthTexture?.dispose();
    this.target?.dispose();
    this.environment?.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas?.remove();
  }
}
