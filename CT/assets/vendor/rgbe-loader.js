/**
 * @fileoverview
 * Minimal RGBE (.hdr, Radiance) reader, trimmed to what the studio needs:
 * an equirectangular HDR as a linear HalfFloat DataTexture ready for
 * PMREMGenerator.fromEquirectangular(). Supports new-style RLE and flat
 * scanlines; that covers every file in the wild that matters here.
 * Standalone: imports nothing, the caller wraps the result.
 */

const RGBE_RETURN_FAILURE = null;

function readHeader(bytes) {
  let pos = 0;
  const line = () => {
    let end = pos;
    while (end < bytes.length && bytes[end] !== 10) end++;
    const s = new TextDecoder().decode(bytes.subarray(pos, end));
    pos = end + 1;
    return s;
  };
  if (line().trim() !== "#?RADIANCE") return null;
  let l;
  do { l = line(); } while (l.trim() !== "");
  const match = line().match(/^-Y (\d+) \+X (\d+)$/);
  if (!match) return null;
  return { width: +match[2], height: +match[1], offset: pos };
}

function rgbeToFloat(r, g, b, e) {
  return e ? Math.pow(2, e - 136) : 0;
}

export function parseRGBE(bytes) {
  const header = readHeader(bytes);
  if (!header) return RGBE_RETURN_FAILURE;
  const { width, height } = header;
  let pos = header.offset;
  const data = new Float32Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    let scan;
    if (bytes[pos] === 2 && bytes[pos + 1] === 2 && (bytes[pos + 2] & 0x80) === 0) {
      const w = (bytes[pos + 2] << 8) | bytes[pos + 3];
      if (w !== width) return RGBE_RETURN_FAILURE;
      pos += 4;
      const chans = [new Uint8Array(width), new Uint8Array(width), new Uint8Array(width), new Uint8Array(width)];
      for (let c = 0; c < 4; c++) {
        let x = 0;
        while (x < width) {
          const count = bytes[pos++];
          if (count > 128) { const v = bytes[pos++]; chans[c].fill(v, x, x + count - 128); x += count - 128; }
          else { for (let k = 0; k < count; k++) chans[c][x++] = bytes[pos++]; }
        }
      }
      scan = chans;
    } else {
      // Flat RGBE, one pixel at a time.
      scan = null;
    }
    for (let x = 0; x < width; x++) {
      const r = scan ? scan[0][x] : bytes[pos],
        g = scan ? scan[1][x] : bytes[pos + 1],
        b = scan ? scan[2][x] : bytes[pos + 2],
        e = scan ? scan[3][x] : bytes[pos + 3];
      if (!scan) pos += 4;
      const o = (y * width + x) * 4;
      const f = rgbeToFloat(r, g, b, e);
      data[o] = r * f;
      data[o + 1] = g * f;
      data[o + 2] = b * f;
      data[o + 3] = 1;
    }
  }
  return { width, height, data };
}

// RGBE has no alpha; the fourth channel is padding for the RGBA upload.
export function toHalfFloat(floats) {
  const half = new Uint16Array(floats.length);
  const floatView = new Float32Array(1);
  const intView = new Uint32Array(floatView.buffer);
  for (let i = 0; i < floats.length; i++) {
    floatView[0] = floats[i];
    const x = intView[0];
    const sign = (x >> 16) & 0x8000;
    let e = ((x >> 23) & 0xff) - 112;
    let m = x & 0x7fffff;
    if (e <= 0) { half[i] = sign; continue; }          // underflow to zero
    if (e >= 31) { half[i] = sign | 0x7bff; continue; } // clamp to max half
    half[i] = sign | (e << 10) | (m >> 13);
  }
  return half;
}
