# Graphics quality

The 3D cube's realism work, and the **Appearance → Graphics quality** setting
that carries the expensive half of it.

The rule that splits the work: anything whose cost is paid once, at construction,
is always on. Anything that costs GPU time on every frame sits behind the
setting, because `draw()` runs once per animation frame during scramble playback
and reward animations, on whatever machine the person happens to have.

## The levels

`pref.cubeQuality`, saved per device beside `cubeFinish` and `cubePalette`.
`RealisticCube` takes it as a constructor argument; changing it destroys and
rebuilds the cube on the same path a model change uses, because the choice is
baked into the renderer's targets, materials and geometry.

| Level | Pixel ratio | Shadows | Detail | Post |
|---|---|---|---|---|
| Low | 1 | no | no | no |
| Balanced | up to 2 | yes | no | no |
| High | up to 2 | yes | yes | no |
| Ultra | up to 2 | yes | yes | yes |
| Cinematic | up to 2 | yes, 2048 | yes | yes, plus the lens |

First run guesses rather than assumes: a coarse pointer or four cores or fewer
gets **Low**, everything else gets **Balanced**. Nobody is opted into High,
Ultra or Cinematic without choosing it, and the guess never runs again once a
value is saved.

The first four levels are a single ramp: each one is a better description of
the cube. **Cinematic is a description of the camera looking at it**, which is
why it sits apart rather than at the end of that ramp, and why it is the only
level that changes colour on purpose.

## Always on

In `assets/cube-realistic.js`, all one-time cost:

- **Contact occlusion on the caps.** `faceGeometry()` writes a vertex-colour
  attribute darkening the profile rings that sit below the crown, so the groove
  where two pieces meet reads as shadow. A shadow map cannot resolve a gap that
  small, and the eye reads its absence as "rendered by a computer". Knob:
  `AO_FLOOR`, currently `.55` for speedcube and off elsewhere.
- **Per-piece imperfection.** `setupJitter()` hashes each piece coordinate to a
  small offset and tilt, applied in the piece's own frame so a turning layer
  carries it rather than sliding the piece through it. Knobs: `offset` (`.009`)
  and `tilt` (`.6` degrees).
- **A studio the reflections can believe in.** `setupLight()` builds a graded
  dome instead of a flat background fill, plus two negative-fill flags and a warm
  floor. The gradient averages out to the old flat value, so it changed the
  direction of the reflections without changing exposure.

## The exposure budget

All four 3D models draw their light from one table, `RIG` in
`assets/cube-realistic.js`: `exposure`, the four source intensities, the
environment weight, and the face gloss. It is one table because as scattered
per-model ternaries the rigs drifted apart, and three of the four ended up far
outside any budget at all.

The budget is stated in terms of the palette, which is the only fixed reference
the renderer has: **a cap turned toward the camera should land at roughly its
palette colour and never above it**, so every other orientation falls below and
the shading has somewhere to go.

Measured against that, before this work a camera-facing cap at the default orbit
received `1.84x` (tiles), `1.55x` (stickers) and `1.99x` (uv) the irradiance that
renders the sticker at its own value. Only `speedcube`, rebalanced earlier, was
close, at `1.10x`. That is why every model except the CSS `standard` preview read
as overexposed, and why `speedcube` read as the one that was right.

Two things produce the failure, and both had to move:

- **Light landing on the axis you are looking down.** `fill` sat at `(3, 1, 7)`,
  within 25 degrees of the view direction, so it added nearly its whole
  contribution to whichever face was pointed at the camera — the one face that
  already has the key on it, and the one place a fill light must not land. It is
  now at `FILL_AT = (5.5, -1.5, 3.5)`, from the camera's right and slightly
  below. That makes it the safe lever: it lifts a face turned away from the key
  without touching the brightest one.
- **A white veil from gloss times environment.** Surplus light does not arrive as
  glare, because ACES compresses a saturated colour's dominant channel long
  before the other two — the green channel of a green cap clips while red and
  blue keep climbing. The result is chalky pastel, which is what "overexposed"
  actually looked like here. Gloss therefore lives in `RIG` beside the light:
  the veil is the product of the two, and tuning either alone only moves it.

Verified by rendering every model at every quality level through three orbits and
solving each cap back to the irradiance that produced it (`ratio` against the
palette, and saturation loss against it). All sixteen model/quality pairs now sit
at or below `1.0x` with saturation within about 8% — see the open item below
about keeping that in the test suite.

## Surface wear and High detail

Optional, independent of quality, behind `pref.cubeWear`. Three baked maps in
`assets/wear/`, produced by `tools/bake-wear-textures.py` and loaded only when
wear is on.

It shipped invisible, and the reasons are worth keeping because none of them
were the one everybody guessed. Measured on the shipped maps:

| | before | after |
|---|---|---|
| median slope of the normal map | 0.32° | 0° |
| 99th percentile slope | 2.1° | 19.4° |
| roughness pixels above 0.80 | 0.0% | 11.7% |
| roughness at the 50th percentile | 0.722 | 0.729 |
| mean cap difference, wear on vs off, dialog size | 0.45 | 0.79 – 1.42 |

Four separate faults, all of them real:

- **The features were smaller than the filter.** A cap's UVs run `u = x / .9 + .5`,
  so it spans 1.10 of the texture: **one tile is one cap**, about 1024 texels
  inside 145 device pixels. At seven texels per pixel a one-to-three-texel
  hairline is not filtered, it is averaged, and the average of a hairline and
  the plastic around it is the plastic.
- **The roughness map did nothing.** 96.8% of it sat at 0.722, which is the
  value the material already divides by. It cancelled itself exactly.
- **Only the base layer was scratched.** On tiles and stickers nearly all the
  specular lives in the clearcoat, and its roughness was a flat scalar. Half the
  response — the visible half — never knew about the wear.
- **Green was inverted.** The maps are PNGs read through `TextureLoader`, which
  flips Y; the procedural maps beside them are `DataTexture`s, which do not. So
  every groove was lit as though it stood proud of the cap. At 0.3° nobody could
  see it either way.

### Drawn, not scanned

The baker draws the scratches rather than rescaling the plastic scan. Sizes are
chosen in screen pixels, and the smallest family is deliberately below what a
pixel can hold: a scratch narrower than a pixel has two walls tilting opposite
ways, so averaging cancels them and leaves flat plastic. `toksvig()` measures
how much slope the average destroys and adds it back as roughness — `α'² = α² +
2σ²` — because roughness does *not* cancel that way. Both walls of a groove
scatter. Fine wear is therefore drawn as slope and read as sheen, which is what
it looks like on real plastic, and the texture does not need gouges to be seen.

Density turned out to matter more than size. Eleven hundred scratches covered
the cap and the eye stopped reading scratches and started reading a finish;
302 leaves clean plastic between them, which is the thing a scratch is read
against. The clustering field runs at frequency 2 — one tile being one cap, that
gives a cap a worn side and a clean side rather than an even nine-patch — with a
floor of 0.20, because 0.10 left some caps pristine at detail quality.

### Per-model response, and the fingerprint

`WEAR` sits beside `RIGS` for the same reason: as per-model ternaries these
drifted into one shared strength that suited none of the four. A scratch reads
through slope and through roughness, and the finishes weight them differently —
glossy tiles let the roughness do the work, matte stickerless plastic has no
specular to dull so the slope carries it (1.30, the highest), vinyl scuffs
rather than gouges, and `uv` wears in the coat rather than under it.

The fingerprint is baked in from `Fingerprints01_1K.png`, which is read at bake
time and never shipped. One stamp, enlarged 3.4×: the sheet's own prints are an
eighth of a cap and read as stipple at that scale, and since one tile is one cap
anything baked here appears on every one of the 54. It is almost entirely a
roughness event and almost no slope — the opposite weighting to a scratch —
because a print is oil: ridges scatter, valleys do not, which is why it is
invisible on matte plastic and obvious on a glossy cap held to a window.

### Nine cap buffers below detail quality

Below High every cap shared a single geometry buffer, so every cap sampled the
*same patch* of the wear texture — the same scratch in the same place, 54 times.
Invisible while the wear was; the most obviously fake thing on the cube once it
was not. Now nine buffers, one per position on a face, so no two caps a viewer
sees side by side repeat. The sculpted models already paid for nine to get their
moulded cells.

### Open on wear

- **The exposure check is one bake behind.** `tests/wear-exposure.cjs` last ran
  green at 2.00% worst drift — wear *lifts* a cap rather than darkening it,
  against 8–12% of headroom — but that was measured before the final clustering
  floor changed the density. Re-run it.
- Nothing here has been seen on a real GPU. Every image behind these numbers is
  a headless SwiftShader render, so the anisotropic filtering a real driver
  applies to these maps is untested, and the fine family is exactly the content
  that filtering decides.
- `close` views measure lower than `dialog` ones on every model now, which is
  the clustering working as intended — but it means a close-up can land on a cap
  that happens to be one of the clean ones.
- Wear concentrated at cap edges and corners is still not possible: one tile is
  one cap and the per-cap shift *rolls* that tile, so a cap-aligned mask lands
  somewhere different on every cap. It needs a second UV set.

**Corner wear was tried and removed.** A term peaking at the corner arcs and
falling to zero between them interpolates across these coarse rings as a
four-pointed star on every cap. Carrying an angular signal per vertex needs
finer tessellation than the caps have. Doing it per-pixel in texture space has
no such problem and hits a different wall instead — the last bullet above.

**High and above still add the geometry-side detail** independently of the wear
choice: per-cap moulding tint baked into the same vertex-colour attribute the
occlusion uses, and 54 cap geometries rather than nine, at roughly 700KB of
vertex data. Note that the "rather than nine" is only now true — below High,
tiles and stickers built *one* cap buffer, not nine, until the change above.

## UV coating

The UV model shares the speedcube's cap outlines, outside miters, piece placement
and movement. `coatingProfile()` blends a low perimeter ridge (about .028 high)
through a shallow inner dip into a flat .0195 center. The shoulder is asymmetric:
the compact outside rollover peaks .042 inward from the outline, then eases over
.12 into the pool. Quintic easing keeps the shorter transition curved rather than
linear, while the ridge peak is now about .025. The residual dip is only .0003
deep. The center cap uses a hybrid topology: its outer rings are rounded-square,
its inner rings become circular around the enlarged crest, and the intermediate
rings blend between that circle and an octagonal square with deeper diagonal
corner cuts and softly rounded junctions while following the convex dome. This gives the center both the chamfered
square limits and the circular ridge seen in the reference;
other caps retain their rounded-square outlines.
Surface-derived normals follow that contour; collapsed samples at mitered
corners use the nearest valid perimeter direction. The center emblem follows
the flat center height through the shared `COATING_CENTER` constant.

- A full clearcoat uses .065 roughness and a mipmapped 512px normal texture.
  Broad undulations dominate at reduced strength (1.15); fine texture is
  restrained so it supports the ridge geometry instead of obscuring it.
  Deterministic texture offsets vary the caps at every quality level.
- Rear and overhead HDR diffusion panels give the top face broad highlights
  in both the default and tipped orientations. Side strips trace the shoulders.
  `softboxMap()` feathers panel edges and adds gentle luminance variation. Their
  UV-only intensity multiplier is .9, strong enough to reveal the coating while
  retaining color and detail inside the highlights. The clearcoat is slightly
  softened at .88 strength and .095 roughness so the finish reads polished
  rather than mirror-like.
- `coatingLighting()` separates the reflected panels from the pigment exposure.
  The UV shader scales environment diffuse fill by .045 and the underlying
  plastic's environment specular contribution by .08, leaving clearcoat
  reflections intact. Direct lights carry the base color. This hook targets
  the bundled Three.js `lights_fragment_maps` chunk; verify shader compilation
  if that dependency changes.
- Recessed internals are dark graphite with restrained gloss. The center emblem
  sits at the new crown height and receives the same coating lighting.
- Other finishes and the shared palette values are unchanged. UV's added
  geometry and texture work also apply at Low so the finish remains recognizable.

`node tests/uv-coating.cjs` renders blue, orange, studio and scrambled views in
an isolated browser, checks orbit, a partial layer turn, inverse restoration,
shader errors and resource disposal. It also checks the shallow ridge height,
flat center, broad inner shoulder, and finite unit surface normals. Set `UV_QUALITY` to `low`, `high`, `ultra` or
`cinematic` to exercise those paths. `UV_BEFORE=1` renders the saved pre-refinement renderer.
The default run writes `tests/screenshots/uv-coating-before-after.png` when the
baseline screenshots are present, plus `uv-coating-ridges-before-after.png`
when the previous domed screenshot is available. These are visual review artifacts rather
than pixel-golden assertions across different GPUs.

## Ultra — the photographic layer

`setupPost()` builds a deliberately small chain rather than a general composer:
one multisampled half-float target with a depth texture, and one composite pass.
The stock three.js passes assume an opaque scene, and this cube floats over the
panel on a transparent canvas, so alpha correctness had to be designed in rather
than worked around.

- **Contact occlusion, in screen space**, from the depth buffer with normals
  reconstructed from its derivative. Background texels are excluded so the
  silhouette does not eat itself.
- **Chromatic aberration**, scaled by the square of the distance from centre, at
  about a pixel at the extremes.
- **Grain**, hashed from `gl_FragCoord` so it belongs to the screen rather than
  the cube and never crawls when the same frame is re-rendered.

Things worth knowing before touching this:

- Three skips tone mapping whenever a render target is bound, so the target
  holds linear HDR and the composite owns exposure, the ACES curve and the sRGB
  encode. Its ACES fit is copied from three's own so a quality change is never
  also a colour change — measured at under 0.2% mean difference against Balanced.
- The target is premultiplied. The shader divides alpha out before the tone
  curve and puts it back at the end.
- Three injects its tone-mapping helpers into the prefix of *every* fragment
  shader, so a function named `RRTAndODTFit` in a `ShaderMaterial` collides. The
  local copy is named `rrtOdtFit` for that reason.
- The occlusion bias is wide (`.18`). Depth-derived normals carry the caps'
  tessellation, and a tight bias lets that faceting through. A normal-free,
  depth-difference formulation was tried and is worse: a domed cap occludes its
  own slope.

**Vignette is still rejected**, not deferred: a vignette darkens the edges of a
frame, and this cube has no frame — it floats over the panel on a transparent
canvas, so there is nothing for the darkening to be the edge of. **Depth of
field was rejected here and now lives one level up**, in Cinematic, where the
person has asked for a photograph rather than a diagram. The objection that
blocked it — it blurs a UI element people orbit and read state from — is what
sets its numbers rather than what forbids it; see below.

## Cinematic — the lens

Cinematic uses a linear HDR scene, optical diffusion, restrained defocus, a subtle
warm-highlight/cool-shadow grade and fine luminance grain. Ultra retains its
existing shader branch. All photographic parameters live in `LENS`.

The September review replaced the 16 randomly rotated defocus samples with 48
fixed golden-angle samples and a soft aperture weight. Blur is capped at three
buffer pixels to keep tiny glossy reflections continuous without temporal
accumulation. Depth rejection limits foreground leakage onto rear surfaces.
This remains a compact screen-space approximation: silhouettes do not scatter
outward as a full multilayer depth-of-field solution would.

The 48-sample aperture now runs only where the circle of confusion exceeds a
quarter buffer pixel. Transparent and effectively sharp pixels use the centre
sample, and transparent pixels skip the 20-sample occlusion kernel while still
retaining halation. During layer motion the lens renders at up to 1.5x density,
4x MSAA and a 1024 shadow; the completed still returns to 2x density, 8x MSAA
and its 2048 shadow. Motion hides that temporary reduction while the final
photograph remains unchanged.

Lateral aberration is reduced to `.0015` and restricted to fully covered pixels;
it fades with defocus. The cinematic composite now uses premultiplied-alpha
blending, matching its output and avoiding double attenuation at transparent
edges. The occlusion kernel is fixed in this mode to reduce spatial noise.

Highlight diffusion uses luminance rather than the brightest colour channel,
with an HDR threshold of `1.1`, a soft knee of `.45`, and strength `.18`.
This keeps saturated plastic from glowing simply because it is saturated.
Diffusion is tinted slightly warm and composited before ACES and sRGB encoding.
Barrel distortion and a restrained split tone complete the lens treatment;
fine, deterministic luminance grain fades in shadows and highlights.

### Motion blur

A turn is a rotation whose axis, layer and elapsed angle the renderer already
knows, so Cinematic derives each pixel's velocity analytically in the composite
pass: no velocity buffer, no per-mesh previous-frame matrices, no second
geometry pass. The uniforms are the axis and centre in view space, the layer
range in cube units, the zoom, and the angle advanced since the previous drawn
frame, scaled by `LENS.shutter` (`.55`, near the 180-degree cinema convention).
The angle is measured rather than assumed, so a dropped frame lengthens the
trail on its own and an eased turn blurs most where it is actually fastest.

Twelve taps run backwards along the projected arc, offset per pixel to keep a
long trail from reading as stacked copies of a cap. A pixel on the turning
layer averages the whole swept path, empty taps included, so a leading edge
loses coverage instead of staying cut out. Every other pixel takes only the
taps that are both inside the turning layer and not behind what it already
shows, blended in proportion to the shutter they covered — which is what lets a
trail spill onto the still stage without a stationary cap being smeared
through. The anchor for those pixels is where their view ray crosses the
turning layer's plane.

The whole block is behind a uniform that is zero on every still frame, so a
cube at rest compiles and costs exactly what it did before, and the shutter is
cleared after each drawn frame so a resize or a late environment redraws the
same pose as a still. Defocus fades out as the smear grows: two blurs on one
pixel is one too many, and it makes the moving frames cheaper rather than
dearer. `tests/motion-blur.cjs` renders a mid-turn frame with and without a
preceding step and asserts they differ, with no shader errors.

The scene uses 8x MSAA where supported and 2048 shadow maps. It renders only
on interaction. The UV GPU review covers four orientations, partial turns,
reversal, disposal, and deterministic redraws at 240 and 640 pixels over light
and dark backgrounds. Run with `UV_QUALITY=cinematic`.

## The environment list

Twelve entries behind `pref.cubeEnvironment`, with a control in Appearance: the
generated `studio` rig, and eleven photographs. `studio` is the default and the
only one that costs nothing to wait for; a photograph is fetched once, parsed to
raw floats and prefiltered per cube, and a cube that cannot get its photograph
falls back to the studio room with a console warning rather than leaving the
stage transparent.

**The bundled photographs ship at 1k**, downsampled in linear light from the 4k
original with an area filter. The five downloaded HDRs retain their original 4k
files because they are user-provided assets; all twelve photographs still pass
through PMREM before reaching the materials.

**A new photograph is three edits, not one.** `ENVIRONMENTS` maps the key to a
URL, `RIGS` needs a full rig under that key — `RIGS` is what the constructor
validates against, so a key missing from it silently renders as the studio — and
`CUBE_ENVIRONMENTS` in `app.js` carries the label. There is a fourth that is
easy to miss: `server.mjs` serves only the paths in its literal allowlist, and
that array is read at process start. A photograph added without it 404s, the
cube falls back to the studio, and because the rig did change the cube looks
different while reflecting nothing new — the failure mode that looks most like a
renderer bug and is not one.

That array is read at process start, so a new photograph also needs the server
restarted, and `start.ps1` is what does it: it asks a running server for its
`capabilities` and replaces the process when one it requires is missing. So a
photograph means bumping a capability too — `environments: 2` is the one that
says "this server serves the current photograph allowlist". Two things about that path were
found only by using it. It had never run before, and it stopped on a `Script
Execution Risk` prompt: Windows PowerShell 5.1 hands `Invoke-WebRequest` output
to the IE engine unless `-UseBasicParsing` is passed, and the prompt waits for a
keypress in a window sitting behind the browser it never opened, so the launcher
looks like it did nothing at all. `stop.ps1` has a narrower problem that is
still open: it kills only a `node.exe` whose command line contains the full
script path, so a server started as `npm start` or `node server.mjs` survives
it. `start.ps1`'s own branch kills by port owner and does not care how the
process was launched.

### Where the rig numbers come from

Every photograph shares the base photographic rig's lights and differs only in `env`, because
the lights are the studio and only the photograph changes. That one number is
measured. Each HDR's solid-angle-weighted mean luminance, referenced to the
reference file the rig was tuned against, says how much dimmer its sky is;
compensating for that ratio *in full* would put the same light on the cube from
every environment, which is the same as having one environment. The
compensation is the square root of the ratio, capped at 1.8x — a dim room still
renders a dimmer cube, and the cap is there for the mirror, since `uv`
multiplies `env` again.

That holds for `fireplace` and `clinic`. It fails for the two gelled
studios, where the light is two large softboxes aimed at the middle of the room
rather than spread over the sphere: far more of it reaches the cube than a dim
average suggests, and it arrives as one saturated colour, which clips a channel
long before the cap looks bright. At the ratio's own 1.8x the front face of the
cube went pink and stopped being the palette's colour, which is the guarantee
every level here is supposed to keep. Those three were set by rendering instead.

Measured on `tiles` at Balanced, same scramble and same orbit for every
environment, over the cap pixels only — `mean` is cap luminance against the
the base rig, `clipped` the share of cap pixels with a channel at or above .985:

| environment | env factor | mean | clipped |
|---|---|---|---|
| base photographic rig | 1.00 | 1.00 | 22.8% |
| studio | — | .61 | 0.0% |
| fireplace | 1.80 (capped) | .77 | 13.7% |
| clinic | 1.27 | .82 | 0.0% |
| magenta | .50 (rendered) | .66 | 8.1% |
| duotone | .90 (rendered) | .68 | 6.1% |
| sunset | .75 (rendered) | .86 | 29.1% |

Sunset is the only one above the base rig, and `env` is not what does it: at .50
it still clips 28.5%. Its light arrives from one direction, so what clips is the
rig's own key on a warm cap, not the photograph. Lowering the key instead would
flatten the low sun, which is the entire environment.

### What a photograph can and cannot show

At Tiles' and Stickers' roughness the environment arrives as colour and broad
gradients, not as a picture of the room: the PMREM convolution at roughness .23
to .32 is wide enough to erase the window it came from. `uv` is the only model
that reflects recognisable shape, and even there the clearcoat lobe is soft.
An environment that reads as "no different" on Tiles is usually working
correctly; the thing to compare is hue, not content.

The downloaded HDRs are the reference set for judging whether new reflection
environments work at all: they retain their original 4k radiance and are
prefiltered by the same PMREM path as the bundled photographs.

## Open questions

- **The palette tension.** Photorealism wants saturated plastic; the shared
  palette is deliberately muted and model definitions never own colours. The
  likely resolution is the speedcube model applying a saturation transform to
  the shared palette, so the palette stays the single source of hue.
- **Frame time still needs broad hardware coverage.** Correctness is verified —
  cap placement across 400 scrambled and mid-turn states, colour parity between
  levels — and the continuous scramble path now avoids lens work on pixels that
  cannot show it while temporarily reducing moving-frame coverage. Cinematic is
  still the most expensive thing this app can be asked to draw, and `uv` at
  Cinematic remains its worst case. Measurements across integrated and discrete
  GPUs should decide whether the moving-frame settings need another tier; the
  first-run guess should certainly never pick Cinematic.
- **Cinematic is outside the exposure budget on purpose.** The budget is stated
  against the palette, and the grade and the halation both move a cap away from
  its palette value by design. The guarantee that holds for Low through Ultra —
  a camera-facing cap lands at roughly its palette colour and never above it —
  does not hold here, and should not be measured as if it did. What is worth
  measuring instead is whether the halation ever pushes a lit cap to clip,
  which the grade's small highlight multiplier makes possible on `uv`.
- **How far the defocus should go is a judgement.** `bokeh` is set where a front
  cap stays under a pixel of blur; the honest photographic answer is several
  times that, and the reason it is not is legibility, not physics.
- **No reference render in the test suite.** `tests/cube-appearance.cjs` already
  screenshots on a real GPU; a fixed-camera speedcube frame per quality level
  would give these changes something to regress against.
- **The coat's character is still judged by eye.** `uv`'s exposure is now
  measured like the others, but how much coat a viewer should see is not a
  number: a near-frontal view shows much less of it than a three-quarter view,
  which is physically right but worth knowing before anyone reports it as a bug.
  The `uv` face also still carries the widest spread between its lightest and
  darkest cap of any model, because a mirror sweeps.
