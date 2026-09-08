"""Bake deterministic, runtime-ready cube wear textures.

Wear is drawn here rather than sampled from a scan. The previous version took
the plastic_0010 scan's hairlines and multiplied their slope, which produced a
map that measured as wear and rendered as nothing: its features were one to
three texels wide, and a cap is about 1024 texels of this map inside 145 device
pixels on screen. Seven texels per pixel is not a filter, it is an average, and
the average of a hairline and the plastic around it is the plastic.

So the unit of design here is the screen pixel, not the texel:

    one cap spans u = x / .9 + .5  ->  1.10 of this texture
    a cap in the appearance dialog  ->  about 145 device pixels
    hence                            ->  ~7 texels per device pixel

That number does not mean scratches must be ten texels wide. It means a scratch
narrower than that cannot survive *as slope* — the two walls of a groove tilt
opposite ways and the average cancels them. So the field below is drawn small
and dense, the way real wear is, and `toksvig()` converts the slope the pixel
cannot resolve into the roughness it physically behaves as. Wide grooves were
the first attempt and read as gouges.

Running this file rewrites only the generated files in assets/wear/.
"""

from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "wear"
SIZE = 1024

# Source art, read at bake time and never shipped: the runtime cost of the
# fingerprints is zero because they end up inside the two maps that already
# load. The sheet is a dense tiling of about fifty prints at roughly 130 texels
# each, which is neither the size nor the density a cube has — a fingertip
# covers a good part of a 19mm cap, and a cube has a few prints on it, not
# fifty. So it is enlarged and stamped sparsely rather than used as it comes.
FINGERPRINTS = OUTPUT / "Fingerprints01_1K.png"
FINGERPRINT_SCALE = 3.4
FINGERPRINT_STAMPS = 1

# The renderer divides its calibrated roughness by this before multiplying the
# map back in, so unscratched plastic renders at exactly the value the exposure
# budget was tuned against. It is a floor, not a mean: keep the two in step.
CLEAN_ROUGHNESS = 0.72

# How steep the wall of the deepest scratch gets. The height field is scaled to
# hit this rather than carrying a hand-set slope constant, so the intent stays
# readable when the density or the widths change: 30 degrees is about the
# shallowest wall that swings a reflected light card clear of the cap's own
# highlight, which is what draws a line instead of a tint. The old map's
# steepest wall was 2 degrees and its median was a third of one.
STEEPEST_FLANK_DEG = 30.0
STEEPEST_PERCENTILE = 99.9

# `coatingNormal()` in cube-realistic.js builds the orange peel at 512 and takes
# central differences in texels, so its slope depends on the resolution it was
# written for. Baking the same function at 1024 would halve it. This keeps the
# baked coat identical to the one the renderer generates.
COATING_SIZE = 512
COATING_STRENGTH = 1.15


def smoothstep(edge0, edge1, value):
    value = np.clip((value - edge0) / (edge1 - edge0), 0.0, 1.0)
    return value * value * (3.0 - 2.0 * value)


def value_noise(size, frequency, salt):
    """Vectorized equivalent of cube-realistic.js's seamless value noise."""
    axis = np.arange(size, dtype=np.float64) / size * frequency
    x0 = np.floor(axis).astype(np.uint32)
    fraction = axis - np.floor(axis)
    eased = fraction * fraction * (3.0 - 2.0 * fraction)
    xx, yy = np.meshgrid(x0, x0)

    def hashed(x, y):
        x = x % np.uint32(frequency)
        y = y % np.uint32(frequency)
        work = (
            x.astype(np.uint64) * np.uint64(374761393)
            + y.astype(np.uint64) * np.uint64(668265263)
            + np.uint64(salt) * np.uint64(987654323)
        ) & np.uint64(0xFFFFFFFF)
        h = work.astype(np.uint32)
        h = ((h ^ (h >> np.uint32(13))).astype(np.uint64) * 1274126177 & np.uint64(0xFFFFFFFF)).astype(np.uint32)
        h = h ^ (h >> np.uint32(16))
        return h.astype(np.float64) / 4294967296.0

    top_left = hashed(xx, yy)
    top_right = hashed(xx + np.uint32(1), yy)
    bottom_left = hashed(xx, yy + np.uint32(1))
    bottom_right = hashed(xx + np.uint32(1), yy + np.uint32(1))
    sx, sy = np.meshgrid(eased, eased)
    top = top_left + (top_right - top_left) * sx
    bottom = bottom_left + (bottom_right - bottom_left) * sx
    return top + (bottom - top) * sy


def normalize(normals):
    return normals / np.maximum(np.linalg.norm(normals, axis=2, keepdims=True), 1e-8)


def encode_normal(normals):
    encoded = np.clip(normalize(normals) * 0.5 + 0.5, 0.0, 1.0)
    return Image.fromarray(np.rint(encoded * 255.0).astype(np.uint8))


def udn(base, detail):
    """Blend tangent-space normals while preserving both sets of slopes."""
    combined = np.empty_like(base)
    combined[:, :, :2] = base[:, :, :2] + detail[:, :, :2]
    combined[:, :, 2] = base[:, :, 2] * detail[:, :, 2]
    return normalize(combined)


def normal_from_height(height):
    """Central differences on a wrapping height field, scaled to a stated slope.

    Green is +dy, not -dy, and the sign is the whole difference between a cut
    and an embossed ridge. Three.js loads a PNG with `flipY` on, so image row 0
    arrives as v = 1 and v runs opposite to the array index; the procedural maps
    next door are DataTextures, which are not flipped, which is why they take
    the other sign. Getting this backwards lights every groove as if it stood
    proud of the cap, and at the old map's third of a degree it was invisible
    either way.
    """
    dx = (np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)) * 0.5
    dy = (np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)) * 0.5
    steepest = np.percentile(np.hypot(dx, dy), STEEPEST_PERCENTILE)
    slope = np.tan(np.radians(STEEPEST_FLANK_DEG)) / max(steepest, 1e-9)
    return normalize(np.dstack((-dx * slope, dy * slope, np.ones_like(height))))


def toksvig(normals, radius=3):
    """Turn the slope a pixel cannot resolve into the roughness it behaves as.

    A scratch narrower than a screen pixel does not disappear from the world,
    only from the normal map: its two walls tilt by equal and opposite amounts,
    so averaging them — which is what the mip chain and the pixel footprint both
    do — cancels them exactly and leaves flat plastic. That is the single reason
    fine wear cannot be drawn as geometry at this scale, and it is why the first
    attempt at this texture had to use grooves wide enough to look like gouges.

    Roughness does not cancel that way. Both walls of a groove scatter, so a
    footprint that averages a scratch away still ends up rougher than the
    plastic beside it. Toksvig's observation is that the length of the averaged
    normal measures exactly how much slope the average destroyed, and that the
    lost slope can be added back as variance: a' squared = a squared + 2 sigma
    squared. So the fine family below is not a compromise between visible and
    invisible — it is drawn as slope and read as sheen, which is what fine
    scratches on plastic actually look like.

    The radius is three texels, not the seven that one device pixel covers.
    Seven would be right for the dialog and too strong close up, where the
    normals really are resolved and would be paying twice; three splits the
    difference toward the close view, which is the one where being wrong is
    obvious.
    """
    box = np.ones((2 * radius + 1,)) / (2 * radius + 1)
    averaged = normals.copy()
    for axis in (0, 1):
        for channel in range(3):
            padded = np.take(averaged[:, :, channel], np.arange(-radius, normals.shape[axis] + radius) % normals.shape[axis], axis=axis)
            averaged[:, :, channel] = np.apply_along_axis(lambda row: np.convolve(row, box, mode="valid"), axis, padded)
    length = np.clip(np.linalg.norm(averaged, axis=2), 1e-4, 1.0)
    variance = np.clip(1.0 / length - 1.0, 0.0, None)
    # Roughness is alpha's square root in three.js, so the widening is applied
    # in alpha and converted back rather than added to roughness directly.
    alpha = CLEAN_ROUGHNESS ** 2
    return np.sqrt(np.sqrt(alpha * alpha + 2.0 * variance)) - CLEAN_ROUGHNESS


def fingerprint_layer(rng):
    """One touch per tile, which is one touch per cap.

    A cap's UVs run u = x / .9 + .5, so it spans 1.10 of this texture: one tile
    covers one cap, and the per-cap `shift` rolls that tile rather than moving a
    window across a larger field. Everything baked here therefore appears on
    every one of the 54 caps, once, in a different place each time — and three
    stamps meant three fingerprints on every cap, 162 on the cube.

    So: one print, enlarged to about half a cap, rolled to a different corner of
    each cap by the shift the geometry already carries. Some caps get it whole,
    some get it cut by their own edge, which reads as a partial touch. The
    sheet's own prints are an eighth of a cap across, which is why it is
    enlarged rather than used as it comes — at its native scale it is stipple,
    not a finger.
    """
    if not FINGERPRINTS.exists():
        print(f"note: {FINGERPRINTS.name} not found, baking without fingerprints")
        return np.zeros((SIZE, SIZE), dtype=np.float64)
    source = Image.open(FINGERPRINTS).convert("L")
    enlarged = source.resize((int(SIZE * FINGERPRINT_SCALE),) * 2, Image.Resampling.LANCZOS)
    sheet = np.asarray(enlarged, dtype=np.float64) / 255.0
    # The sheet's brightest print sits at about .65, and the radial window takes
    # another third off the edges, so used raw a stamp lands at half strength
    # and the ridges — the part that makes it read as a finger rather than as a
    # smudge — arrive as almost nothing. Rescale to the full range first.
    sheet = np.clip(sheet / max(np.percentile(sheet, 99.5), 1e-6), 0.0, 1.0) ** 0.85

    stamp = int(SIZE * 0.52)
    axis = (np.arange(stamp) + 0.5) / stamp * 2.0 - 1.0
    # A radial cosine window, so a stamp fades out instead of ending on a square
    # edge — a fingerprint with a visible bounding box is worse than none.
    window = np.clip(1.0 - np.hypot(*np.meshgrid(axis, axis, indexing="ij")), 0.0, 1.0)
    window = window * window * (3.0 - 2.0 * window)

    layer = np.zeros((SIZE, SIZE), dtype=np.float64)
    for _ in range(FINGERPRINT_STAMPS):
        # Pick the fullest window out of forty candidates rather than the first
        # one. The sheet is prints on black, so a random crop is as likely to
        # land on the gap between two as on a whole one, and a stamp of mostly
        # background is a faint bruise with no ridges in it.
        best, patch = -1.0, None
        for _ in range(40):
            sy = int(rng.integers(0, sheet.shape[0] - stamp))
            sx = int(rng.integers(0, sheet.shape[1] - stamp))
            candidate = sheet[sy:sy + stamp, sx:sx + stamp] * window
            score = candidate.mean()
            if score > best:
                best, patch = score, candidate
        # The window has already taken a third off the edges, so renormalise or
        # the print arrives at half the strength the coefficient below assumes.
        patch = patch / max(np.percentile(patch, 99.5), 1e-6)
        ys = (np.arange(stamp) + rng.integers(0, SIZE))[:, None] % SIZE
        xs = (np.arange(stamp) + rng.integers(0, SIZE))[None, :] % SIZE
        layer[ys, xs] = np.maximum(layer[ys, xs], np.clip(patch, 0.0, 1.0))
    return layer


def coating_normal():
    height = (
        value_noise(COATING_SIZE, 5, 5) * 1.2
        + value_noise(COATING_SIZE, 17, 6) * 0.24
        + value_noise(COATING_SIZE, 53, 7) * 0.035
    )
    dx = (np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)) * COATING_STRENGTH
    dy = (np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)) * COATING_STRENGTH
    # Same flip as normal_from_height: this one is baked into a PNG, while the
    # identical function in cube-realistic.js writes a DataTexture.
    normals = normalize(np.dstack((-dx, dy, np.ones_like(height))))
    if COATING_SIZE == SIZE:
        return normals
    resized = Image.fromarray(np.rint((normals * 0.5 + 0.5) * 255).astype(np.uint8))
    resized = resized.resize((SIZE, SIZE), Image.Resampling.BICUBIC)
    return normalize(np.asarray(resized, dtype=np.float64) / 255.0 * 2.0 - 1.0)


def segment_distance(shape, ax, ay, bx, by):
    """Perpendicular distance to segment AB, position along it, and its span mask.

    Deliberately not wrapped. Seamlessness is handled where the window is
    written back into the texture, by taking its row and column indices modulo
    the texture size; wrapping *here* would fold the window onto itself, and
    since a window is only a couple of hundred texels wide that folded the far
    end of every long segment back over its own start — which is what put a
    row of beads along each scratch that survived the taper fix.
    """
    height, width = shape
    ys, xs = np.meshgrid(np.arange(height, dtype=np.float64), np.arange(width, dtype=np.float64), indexing="ij")
    px, py = xs - ax, ys - ay
    dx, dy = bx - ax, by - ay
    length2 = max(dx * dx + dy * dy, 1e-9)
    t = (px * dx + py * dy) / length2
    # Perpendicular distance to the segment's *line*, masked to the segment's
    # own span, rather than distance to the segment as a capsule. A capsule has
    # rounded ends, and the lip is a ring offset from the surface it is drawn
    # around, so every rounded end put a half-ring across the scratch: a stroke
    # came out as a chain of beads with a bright crescent on each. Consecutive
    # segments share an endpoint exactly, so masking instead of capping leaves
    # no gap between them.
    # Half a texel of overlap at each end. Butting two masks exactly leaves a
    # one-texel gap wherever the joint is not axis-aligned, and a one-texel gap
    # in a groove is a cliff: it was putting 67-degree normals into a map whose
    # deepest wall is meant to be 30.
    length = np.sqrt(length2)
    margin = 0.75 / length
    inside = (t >= -margin) & (t <= 1.0 + margin)
    return np.abs(px * dy - py * dx) / length, t, inside


def draw_scratch(groove_buffer, lip_buffer, rng, x, y, angle, length, width, depth, drift):
    """A ploughed groove: a cut with a raised lip on either side of it.

    The lip is not decoration. A pure trench only darkens; the ridge of
    displaced material either side is what catches the key light, and it is the
    bright edge next to the dark line that reads as a scratch rather than as a
    smudge.
    """
    steps = max(2, int(length / 40))
    points = [(x, y)]
    for _ in range(steps):
        angle += rng.normal(0.0, drift)
        x += np.cos(angle) * (length / steps)
        y += np.sin(angle) * (length / steps)
        points.append((x, y))

    size = groove_buffer.shape[0]
    reach = width * 2.6
    span = len(points) - 1
    for index, ((ax, ay), (bx, by)) in enumerate(zip(points, points[1:])):
        lo_x = int(np.floor(min(ax, bx) - reach))
        hi_x = int(np.ceil(max(ax, bx) + reach))
        lo_y = int(np.floor(min(ay, by) - reach))
        hi_y = int(np.ceil(max(ay, by) + reach))
        window = (hi_y - lo_y + 1, hi_x - lo_x + 1)
        distance, t, inside = segment_distance(window, ax - lo_x, ay - lo_y, bx - lo_x, by - lo_y)
        # Taper the ends of the *stroke*, not of every segment. Tapering per
        # segment was what turned each scratch into a row of dashes: the
        # polyline is walked in 40-texel steps, and fading each one in and out
        # stamps a bead every 40 texels instead of drawing one line.
        along = (index + np.clip(t, 0.0, 1.0)) / span
        taper = smoothstep(0.0, 0.09, along) * smoothstep(0.0, 0.09, 1.0 - along)
        groove = depth * taper * inside * np.exp(-((distance / width) ** 2))
        # The lip is narrow on purpose. At 0.30 amplitude and 0.65 width it
        # spread the whole feature over three and a half widths, and a 26-texel
        # scratch became a 90-texel dent — which is what the first bake looked
        # like: a quilted surface rather than a scratched one.
        lip = depth * taper * inside * 0.20 * np.exp(-(((distance - width * 1.15) / (width * 0.42)) ** 2))
        ys = (np.arange(lo_y, hi_y + 1) % size)[:, None]
        xs = (np.arange(lo_x, hi_x + 1) % size)[None, :]
        # Deepest-wins rather than additive: where two scratches cross they
        # should cross, not sum into a pit that is twice as deep as either.
        # The window is smaller than the texture, so these indices are unique
        # and plain fancy indexing is safe (and far faster than ufunc.at).
        groove_buffer[ys, xs] = np.maximum(groove_buffer[ys, xs], groove)
        lip_buffer[ys, xs] = np.maximum(lip_buffer[ys, xs], lip)


def scratch_field():
    """The wear itself: a height field and the mask of where it cut."""
    rng = np.random.default_rng(20260908)
    groove_buffer = np.zeros((SIZE, SIZE), dtype=np.float64)
    lip_buffer = np.zeros((SIZE, SIZE), dtype=np.float64)

    # Two dominant directions with spread, not a uniform spray. Wear on a cube
    # comes from hands and from tumbling in a bag, both of which have a grain;
    # isotropic scratches read as noise, which is what "no different" looks
    # like once the average has taken the fine detail away.
    axes = [rng.uniform(0, np.pi), rng.uniform(0, np.pi)]

    # Density is as much of the effect as depth. Cover half the cap and the
    # scratches stop being scratches and become the finish; the eye needs clean
    # plastic beside a line to read it as damage. These counts leave roughly an
    # eighth of the surface cut.
    # Clustering: heavier and lighter wear across the tile, which — since one
    # tile is one cap (see `fingerprint_layer`) — is variation *within* a cap
    # rather than between caps, so a cap has worn corners and clean middles
    # instead of an even frost. The per-cap shift rolls which part lands where.
    # It is read once per scratch, at the point where the scratch starts, and
    # never multiplied into the finished height: a smooth field times a height
    # field adds the smooth field's own gradient everywhere the height is
    # non-zero, which is a slow undulation across the cap and reads as a dent.
    # Down to a fifth at the low end, not a third: with a floor of .35 even the
    # "clean" regions carried a third of the wear, so there was nowhere on the
    # cap that was actually untouched. A tenth was one step too far — at detail
    # quality each cap draws its own patch of this field, and some caps came out
    # pristine. Frequency two, not three, because one
    # tile is one cap: two lobes give a cap a worn side and a clean side, which
    # is how a cube that lives in a pocket wears, while three gave every cap a
    # nine-patch of even mottling.
    cluster = 0.20 + 0.80 * smoothstep(0.22, 0.78, value_noise(SIZE, 2, 17))

    # Three sizes, and the smallest is deliberately below what a pixel can hold.
    #
    # The first pass sized everything to survive the 7:1 minification on its
    # own, which meant 18-to-26-texel grooves running most of the way across a
    # cap. They were visible and they were wrong: a cube that has been in a bag
    # has hundreds of short fine scratches, not a dozen gashes, and the gashes
    # read as damage rather than as use. So the sizes come down by roughly two
    # and a half times, the counts go up, and the part that no longer survives
    # as a line is recovered as roughness by `toksvig()` below.
    # Counts, not sizes, are what decides whether this reads as a used cube or
    # a frosted one. Eleven hundred scratches at these widths covered the whole
    # cap and the eye stopped seeing scratches and started seeing a finish. A
    # quarter of that leaves clean plastic between them, which is the thing a
    # scratch is read against.
    families = (
        # count, length,      width,      depth,        drift
        (7, (90.0, 220.0), (5.0, 8.0), (0.85, 1.00), 0.035),      # the rare deep one
        (55, (40.0, 140.0), (3.0, 5.0), (0.40, 0.70), 0.065),     # the ones you see
        (240, (15.0, 70.0), (1.5, 3.0), (0.22, 0.50), 0.12),      # haze, not lines
    )
    for count, length, width, depth, drift in families:
        for _ in range(count):
            angle = rng.choice(axes) + rng.normal(0.0, 0.55)
            x, y = rng.uniform(0, SIZE), rng.uniform(0, SIZE)
            draw_scratch(
                groove_buffer, lip_buffer, rng, x, y, angle,
                rng.uniform(*length), rng.uniform(*width),
                rng.uniform(*depth) * cluster[int(y) % SIZE, int(x) % SIZE], drift,
            )

    height = lip_buffer - groove_buffer
    cut = groove_buffer / max(groove_buffer.max(), 1e-9)

    # Scuffs: broad abraded areas that carry no real slope but dull the finish.
    scuff = smoothstep(0.62, 0.92, value_noise(SIZE, 9, 41) * 0.75 + value_noise(SIZE, 23, 42) * 0.25)

    return height, cut, scuff * cluster, fingerprint_layer(rng)


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    height, cut, scuff, prints = scratch_field()

    # Oil sits on the surface; it does not cut into it. The print contributes a
    # tenth of the height a scratch does, which is enough for the ridges to
    # catch a grazing light and not enough to read as embossed skin.
    scratches = normal_from_height(height + prints * 0.10)
    neutral = np.zeros_like(scratches)
    neutral[:, :, 2] = 1.0
    plastic = udn(neutral, scratches)
    uv_clearcoat = udn(coating_normal(), scratches)

    # Three.js multiplies scalar roughness by this map, and the renderer has
    # already divided by CLEAN_ROUGHNESS, so 0.72 here is "as the rig intended".
    # A cut scatters, so it climbs; a scuff hazes, so it climbs less. The broad
    # mottle underneath is what stops the clean plastic reading as new.
    mottle = (value_noise(SIZE, 7, 61) - 0.5) * 0.055
    # A fingerprint is almost entirely a roughness event: the ridges scatter
    # the reflection and the valleys do not, which is why a print is invisible
    # on matte plastic and obvious on a glossy cap held up to a window. It gets
    # more roughness than a scratch and almost no slope, the opposite weighting.
    worn_roughness = np.clip(
        CLEAN_ROUGHNESS + mottle + cut * 0.30 + scuff * 0.07 + prints * 0.26 + toksvig(scratches),
        0.60, 1.0)

    encode_normal(plastic).save(OUTPUT / "worn-plastic-normal.png", optimize=True)
    encode_normal(uv_clearcoat).save(OUTPUT / "worn-uv-clearcoat-normal.png", optimize=True)
    Image.fromarray(np.rint(worn_roughness * 255.0).astype(np.uint8)).save(
        OUTPUT / "worn-plastic-roughness.png", optimize=True
    )

    tilt = np.degrees(np.arctan2(np.hypot(plastic[:, :, 0], plastic[:, :, 1]), plastic[:, :, 2]))
    print("tilt deg: median {:.2f}  p90 {:.2f}  p99 {:.2f}  max {:.2f}".format(*np.percentile(tilt, [50, 90, 99]), tilt.max()))
    print("roughness: floor {:.3f}  p99 {:.3f}  max {:.3f}  share above .80 {:.2%}".format(
        np.percentile(worn_roughness, 1), np.percentile(worn_roughness, 99), worn_roughness.max(), (worn_roughness > 0.80).mean()))
    for path in sorted(OUTPUT.iterdir()):
        print(f"{path.relative_to(ROOT)} ({path.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
