/* CubeTracker's dependency-free cube, CSV, and statistics engine. */
(function (root) {
  "use strict";
  const FACES = {
    U: { n: [0, 1, 0], right: [1, 0, 0], down: [0, 0, 1], color: "#f4f2e9" },
    R: { n: [1, 0, 0], right: [0, 0, -1], down: [0, -1, 0], color: "#e55d56" },
    F: { n: [0, 0, 1], right: [1, 0, 0], down: [0, -1, 0], color: "#59aa83" },
    D: { n: [0, -1, 0], right: [1, 0, 0], down: [0, 0, -1], color: "#efca57" },
    L: { n: [-1, 0, 0], right: [0, 0, 1], down: [0, -1, 0], color: "#ee9852" },
    B: { n: [0, 0, -1], right: [-1, 0, 0], down: [0, -1, 0], color: "#649bd6" },
  };
  const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
  function rotate(v, axis, angle) {
    const c = Math.cos(angle),
      s = Math.sin(angle),
      d = dot(axis, v);
    const cross = [
      axis[1] * v[2] - axis[2] * v[1],
      axis[2] * v[0] - axis[0] * v[2],
      axis[0] * v[1] - axis[1] * v[0],
    ];
    return v.map((x, i) => x * c + cross[i] * s + axis[i] * d * (1 - c));
  }
  function tokens(alg) {
    if (!alg || alg.trim() === "N/A") return [];
    return alg
      .trim()
      .replace(/[’′]/g, "'")
      .split(/\s+/)
      .map((t) => {
        if (!/^([URFDLB]w?|[urfdlbMESxyz])(2'?|')?$/.test(t))
          throw new Error(`Unsupported move: ${t}`);
        return t.replace("2'", "2");
      });
  }
  function moveSpec(token) {
    const key = token.replace(/[2']/g, "");
    let axis, select;
    if (FACES[key]) {
      axis = FACES[key].n;
      select = (p) => dot(p, axis) === 1;
    } else if (/[urfdlb]/.test(key[0]) || key.endsWith("w")) {
      axis = FACES[key[0].toUpperCase()].n;
      select = (p) => dot(p, axis) >= 0;
    } else if ("MES".includes(key)) {
      axis = FACES[{ M: "L", E: "D", S: "F" }[key]].n;
      select = (p) => dot(p, axis) === 0;
    } else {
      axis = FACES[{ x: "R", y: "U", z: "F" }[key]].n;
      select = () => true;
    }
    return {
      axis,
      select,
      angle:
        (-Math.PI / 2) *
        (token.includes("2") ? 2 : token.includes("'") ? -1 : 1),
    };
  }
  class Cube {
    constructor() {
      this.stickers = [];
      for (const [face, f] of Object.entries(FACES))
        for (let row = 0; row < 3; row++)
          for (let col = 0; col < 3; col++) {
            this.stickers.push({
              face,
              id: face + (row * 3 + col),
              p: f.n.map(
                (v, i) => v + (col - 1) * f.right[i] + (row - 1) * f.down[i],
              ),
              n: [...f.n],
              right: [...f.right],
              down: [...f.down],
            });
          }
    }
    move(token) {
      tokens(token);
      const { axis, select, angle } = moveSpec(token);
      for (const sticker of this.stickers)
        if (select(sticker.p))
          for (const key of ["p", "n", "right", "down"])
            sticker[key] = rotate(sticker[key], axis, angle).map(Math.round);
      return this;
    }
    apply(alg) {
      for (const token of tokens(alg)) this.move(token);
      return this;
    }
    facelets() {
      const result = {};
      for (const [face, f] of Object.entries(FACES)) {
        result[face] = Array(9);
        for (const s of this.stickers)
          if (dot(s.n, f.n) === 1)
            result[face][(dot(s.p, f.down) + 1) * 3 + dot(s.p, f.right) + 1] =
              s.face;
      }
      return result;
    }
    signature() {
      const f = this.facelets();
      return Object.keys(FACES)
        .map((k) => f[k].join(""))
        .join("");
    }
  }
  const inverse = (alg) =>
    tokens(alg)
      .reverse()
      .map((t) =>
        t.includes("2") ? t : t.endsWith("'") ? t.slice(0, -1) : t + "'",
      )
      .join(" ");
  function scramble(length = 20) {
    const faces = ["U", "D", "R", "L", "F", "B"],
      suffix = ["", "'", "2"],
      seq = [];
    let last = -1,
      axis = -1;
    const random = (n) => {
      const v = new Uint32Array(1);
      root.crypto.getRandomValues(v);
      return Math.floor((v[0] / 4294967296) * n);
    };
    for (let i = 0; i < length; i++) {
      let f;
      do {
        f = random(6);
      } while (
        f === last ||
        (Math.floor(f / 2) === axis &&
          i > 1 &&
          Math.floor(faces.indexOf(seq[i - 2][0]) / 2) === axis)
      );
      seq.push(faces[f] + suffix[random(3)]);
      last = f;
      axis = Math.floor(f / 2);
    }
    return seq.join(" ");
  }
  function csvRows(text) {
    text = text.replace(/^\uFEFF/, "");
    const rows = [];
    let row = [],
      cell = "",
      quote = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '"') {
        if (quote && text[i + 1] === '"') {
          cell += '"';
          i++;
        } else if (!quote && cell.length) {
          throw new Error("Unexpected quote in CSV.");
        } else quote = !quote;
      } else if (ch === "," && !quote) {
        row.push(cell);
        cell = "";
      } else if ((ch === "\n" || ch === "\r") && !quote) {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(cell);
        if (row.some((v) => v.trim())) rows.push(row);
        row = [];
        cell = "";
      } else cell += ch;
    }
    if (quote) throw new Error("The CSV has an unclosed quoted field.");
    row.push(cell);
    if (row.some((v) => v.trim())) rows.push(row);
    return rows;
  }
  function parseTime(value) {
    let t = String(value).trim(),
      penalty = "";
    if (/^DNF$/i.test(t)) return { rawMs: 0, penalty: "DNF" };
    const dnf = t.match(/^DNF\((.+)\)$/i);
    if (dnf) {
      penalty = "DNF";
      t = dnf[1];
    } else if (t.endsWith("+")) {
      penalty = "+2";
      t = t.slice(0, -1);
    }
    if (!/^(?:\d+:)?\d+(?:\.\d{1,3})?$/.test(t))
      throw new Error(`Invalid time: ${value}`);
    const parts = t.split(":");
    if (parts.length === 2 && +parts[1] >= 60)
      throw new Error(`Invalid seconds: ${value}`);
    const seconds = parts.length === 2 ? +parts[0] * 60 + +parts[1] : +parts[0];
    const rawMs = Math.round(seconds * 1000) - (penalty === "+2" ? 2000 : 0);
    if (rawMs < 0 || rawMs > 86400000)
      throw new Error(`Time is out of range: ${value}`);
    return { rawMs, penalty };
  }
  function parseCSV(text) {
    const rows = csvRows(text);
    if (rows.length < 2)
      throw new Error("The file needs a header and at least one solve.");
    const header = rows.shift().map((s) => s.trim().toLowerCase());
    const ti = header.indexOf("time"),
      si = header.indexOf("scramble"),
      di = header.indexOf("date"),
      ii = header.indexOf("index");
    if ([ti, si, di].includes(-1))
      throw new Error("Expected CSV columns: Index, Time, Scramble, Date.");
    const errors = [],
      solves = [];
    let missingDates = 0,
      unsupported = 0;
    rows.forEach((row, i) => {
      try {
        const time = parseTime(row[ti]);
        let originalDate = (row[di] || "").trim();
        if (di === header.length - 1 && row.length > header.length)
          originalDate = row.slice(di).join(",").trim();
        const dateMs = Date.parse(originalDate);
        if (!Number.isFinite(dateMs)) missingDates++;
        const alg = (row[si] || "").trim();
        try {
          tokens(alg);
        } catch {
          unsupported++;
        }
        const extra = {};
        const sourceIndex = header.indexOf("source"), reconstructionIndex = header.indexOf("reconstruction");
        const rawIndex = header.indexOf("rawms");
        if (rawIndex >= 0 && row[rawIndex] !== "") {
          const rawMs = Number(row[rawIndex]);
          if (!Number.isInteger(rawMs) || rawMs < 0 || rawMs > 86400000 || (time.penalty !== "DNF" && rawMs !== time.rawMs)) throw new Error("Invalid underlying time.");
          time.rawMs = rawMs;
        }
        if (sourceIndex >= 0 && row[sourceIndex]) {
          if (!["physical", "virtual"].includes(row[sourceIndex])) throw new Error("Invalid solve source.");
          extra.source = row[sourceIndex];
        }
        if (reconstructionIndex >= 0 && row[reconstructionIndex]) {
          extra.reconstruction = JSON.parse(row[reconstructionIndex]);
          extra.source = "virtual";
        }
        solves.push({
          id: root.crypto.randomUUID(),
          ...time,
          ...extra,
          scramble: alg,
          date: Number.isFinite(dateMs) ? new Date(dateMs).toISOString() : null,
          originalDate,
          index: Number(row[ii]) || i + 1,
        });
      } catch (e) {
        errors.push(`Row ${i + 2}: ${e.message}`);
      }
    });
    // Never partially import a file silently: the original can be corrected and reimported.
    if (errors.length)
      throw new Error(
        `${errors.length} invalid row(s). ${errors.slice(0, 3).join(" ")}`,
      );
    solves.sort((a, b) =>
      a.date && b.date
        ? Date.parse(a.date) - Date.parse(b.date) || a.index - b.index
        : a.index - b.index,
    );
    return { solves, missingDates, unsupported };
  }
  const value = (s) =>
    s.penalty === "DNF"
      ? Infinity
      : s.rawMs / 1000 + (s.penalty === "+2" ? 2 : 0);
  function format(seconds, digits = 2) {
    if (seconds == null || Number.isNaN(seconds)) return "—";
    if (!Number.isFinite(seconds)) return "DNF";
    const ticks = Math.round(seconds * Math.pow(10, digits)),
      unit = Math.pow(10, digits);
    if (ticks >= 60 * unit)
      return `${Math.floor(ticks / (60 * unit))}:${((ticks % (60 * unit)) / unit).toFixed(digits).padStart(3 + digits, "0")}`;
    return (ticks / unit).toFixed(digits);
  }
  const csvEscape = (s) => '"' + String(s ?? "").replace(/"/g, '""') + '"';
  function exportCSV(solves) {
    const virtual = solves.some(s => s.source === "virtual" || s.reconstruction);
    return (
      "Index,Time,Scramble,Date" + (virtual ? ",Source,Reconstruction,RawMs" : "") + "\r\n" +
      solves
        .map((s, i) => ({ s, i }))
        .reverse()
        .map(({ s, i }) => {
          const digits = s.rawMs % 10 === 0 ? 2 : 3;
          const time =
            s.penalty === "DNF"
              ? "DNF"
              : value(s).toFixed(digits) + (s.penalty === "+2" ? "+" : "");
          return [i + 1, time, s.scramble, s.originalDate || s.date || "", ...(virtual ? [s.source || "physical", s.reconstruction ? JSON.stringify(s.reconstruction) : "", s.rawMs] : [])]
            .map(csvEscape)
            .join(",");
        })
        .join("\r\n") +
      "\r\n"
    );
  }
  function average(solves, n) {
    if (solves.length < n) return null;
    const sorted = solves
        .slice(-n)
        .map(value)
        .sort((a, b) => a - b),
      trim = Math.ceil(n * 0.05),
      middle = sorted.slice(trim, n - trim);
    return middle.reduce((a, b) => a + b, 0) / middle.length;
  }
  function rolling(solves, n, fn = average) {
    return solves.map((_, i) =>
      i + 1 < n ? null : fn(solves.slice(Math.max(0, i + 1 - n), i + 1), n),
    );
  }
  function subSeries(solves, n, target) {
    let hits = 0;
    return solves.map((s, i) => {
      if (value(s) < target) hits++;
      if (i >= n && value(solves[i - n]) < target) hits--;
      return i + 1 < n ? null : (100 * hits) / n;
    });
  }
  function stats(solves) {
    const vals = solves.map(value).filter(Number.isFinite),
      mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    const best = vals.length
      ? vals.reduce((a, b) => Math.min(a, b), Infinity)
      : null;
    const sorted = [...vals].sort((a, b) => a - b),
      mid = Math.floor(sorted.length / 2);
    return {
      count: solves.length,
      valid: vals.length,
      best,
      mean,
      median: vals.length
        ? sorted.length % 2
          ? sorted[mid]
          : (sorted[mid - 1] + sorted[mid]) / 2
        : null,
      sd: vals.length
        ? Math.sqrt(vals.reduce((a, v) => a + (v - mean) ** 2, 0) / vals.length)
        : null,
      ao5: average(solves, 5),
      ao12: average(solves, 12),
      ao100: average(solves, 100),
      dnf: solves.length - vals.length,
    };
  }
  // Whole-cube rotations are convenient to write but inconvenient to reason
  // about: an algorithm that opens with y ends with the cube facing elsewhere,
  // so inverting it produces a scramble in a rotated frame. Rewriting the
  // sequence without rotations keeps every derived scramble in the standard
  // orientation while the algorithm itself is still shown exactly as written.
  const ROTATION_FACE = { x: "R", y: "U", z: "F" };
  const SLICE_FACE = { M: "L", E: "D", S: "F" };
  // Which slice a rotated slice axis becomes, and whether its direction flips:
  // M runs along L, so the same slice seen from R is M'.
  const SLICE_AS = {
    L: ["M", false], R: ["M", true],
    D: ["E", false], U: ["E", true],
    F: ["S", false], B: ["S", true],
  };
  const sameVector = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-6);
  const faceAt = (v) => Object.keys(FACES).find((f) => sameVector(FACES[f].n, v));
  const modifierOf = (token) =>
    token.includes("2") ? "2" : token.includes("'") ? "'" : "";
  const flipModifier = (m) => (m === "2" ? "2" : m === "'" ? "" : "'");
  function normalize(alg) {
    // Columns hold the images of the canonical axes. A rotation left-multiplies
    // them; every other move is re-expressed in the frame accumulated so far,
    // which for a sequence applied left to right is the transposed basis.
    let basis = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
    const unrotate = (v) => basis.map((column) => dot(column, v));
    const out = [];
    for (const token of tokens(alg)) {
      const key = token.replace(/[2']/g, ""),
        mod = modifierOf(token);
      if (ROTATION_FACE[key]) {
        const { axis, angle } = moveSpec(token);
        basis = basis.map((column) =>
          rotate(column, axis, angle).map(Math.round),
        );
        continue;
      }
      if (SLICE_FACE[key]) {
        const [name, flip] =
          SLICE_AS[faceAt(unrotate(FACES[SLICE_FACE[key]].n))];
        out.push(name + (flip ? flipModifier(mod) : mod));
        continue;
      }
      const face = faceAt(unrotate(FACES[key[0].toUpperCase()].n));
      const wide = /[a-z]/.test(key[0]) || key.endsWith("w");
      out.push((wide ? face.toLowerCase() : face) + mod);
    }
    return out.join(" ");
  }
  // Wide and slice turns always reorient the cube: Rw is the opposite outer
  // face plus a whole-cube rotation, and M turns both outer layers of its axis
  // around a rotated core. Each token below is that same turn written with the
  // rotation made explicit, so replacing a token and letting normalize() fold
  // the rotation back into the following moves leaves an equivalent sequence
  // of outer face turns only.
  const PLAIN_MOVES = {
    M: "R L' x'",
    E: "U D' y'",
    S: "F' B z",
    R: "L x",
    L: "R x'",
    U: "D y",
    D: "U y'",
    F: "B z",
    B: "F z'",
  };
  const expand = (token) => {
    const key = token.replace(/[2']/g, ""),
      wide = /^(?:[URFDLB]w|[udfblr])$/.test(key),
      slice = /^[MES]$/.test(key);
    if (!wide && !slice) return token;
    const base = PLAIN_MOVES[wide ? key[0].toUpperCase() : key],
      doubled = token.includes("2") ? `${base} ${base}` : base;
    return token.includes("'") ? inverse(doubled) : doubled;
  };
  // Rewrites any sequence a solver can be given as outer face turns only. A
  // sequence whose own net rotation is not empty ends in a rotated frame, so
  // this keeps the cube's relative state and drops only that whole-cube turn.
  const plain = (alg) => normalize(tokens(alg).map(expand).join(" "));
  // Merges turns of the same face that end up next to each other, so a scramble
  // built from an inverse plus a random adjustment still reads like a scramble.
  function collapse(alg) {
    const quarters = (t) => (t.includes("2") ? 2 : t.includes("'") ? 3 : 1),
      suffix = (n) => (n === 1 ? "" : n === 2 ? "2" : "'");
    const out = [];
    for (const token of tokens(alg)) {
      const face = token.replace(/[2']/g, ""),
        previous = out.at(-1);
      if (previous && previous.replace(/[2']/g, "") === face) {
        const total = (quarters(previous) + quarters(token)) % 4;
        out.pop();
        if (total) out.push(face + suffix(total));
        continue;
      }
      out.push(token);
    }
    return out.join(" ");
  }
  // Wide and slice turns move centres, so a sequence whose wide turns do not
  // cancel — R' d' F R2 u R' U R U' R u' R2, for one — finishes with the cube
  // held differently even after its rotations are rewritten away. The 24 ways a
  // cube can be held, each as the shortest sequence that gets there.
  const centreKey = (cube) => {
    const f = cube.facelets();
    return Object.keys(FACES)
      .map((face) => f[face][4])
      .join("");
  };
  const ORIENTATIONS = (() => {
    const map = new Map();
    for (const tilt of ["", "x", "x2", "x'", "z", "z'"])
      for (const spin of ["", "y", "y2", "y'"]) {
        const seq = [tilt, spin].filter(Boolean).join(" ");
        const key = centreKey(new Cube().apply(seq));
        if (!map.has(key)) map.set(key, seq);
      }
    return map;
  })();
  // How the cube ends up being held after this sequence, as x/y/z turns.
  const orientation = (alg) =>
    ORIENTATIONS.get(centreKey(new Cube().apply(normalize(alg)))) ?? "";
  // The scramble that turns a solved cube into the case this algorithm solves,
  // always with white up and green front so every case is shown the same way,
  // and always in outer face turns a solver can follow without turning the
  // whole cube.
  const setup = (alg) =>
    collapse(
      plain(
        [inverse(normalize(alg)), orientation(alg)].filter(Boolean).join(" "),
      ),
    );
  // The turn of the whole cube that has to precede the algorithm for it to
  // solve that scramble. Empty for all but the sequences described above.
  const hold = (alg) => inverse(orientation(alg));
  // Two algorithms belong to the same case when their setups match.
  const caseKey = (alg) => new Cube().apply(setup(alg)).signature();
  const AUF = ["", "U", "U2", "U'"];
  const HOLDS = ["", "y", "y2", "y'"];
  // A cube whose six faces are each a single colour, wherever they point. The
  // orientation is irrelevant: a solved cube held sideways is still solved, and
  // algorithms written with rotations legitimately finish that way.
  const isSolved = (cube) => {
    const f = cube.facelets();
    return Object.values(f).every((face) => face.every((c) => c === face[0]));
  };
  // Alternative algorithms for one case are routinely written from a different
  // adjustment, or for the cube held a quarter turn round. Returns the prefix
  // that makes this algorithm solve the given setup, or null when no way of
  // holding the cube makes it solve that case at all.
  function solvesCase(alg, setupAlg) {
    const moves = [hold(alg), normalize(alg)].filter(Boolean).join(" ");
    for (const hold of HOLDS)
      for (const before of AUF)
        for (const after of AUF) {
          const prefix = [hold, before].filter(Boolean).join(" ");
          if (
            isSolved(
              new Cube().apply(
                [setupAlg, prefix, moves, after].filter(Boolean).join(" "),
              ),
            )
          )
            return prefix;
        }
    return null;
  }
  // A random U turn before and after the setup keeps the case identical while
  // making the scramble different every time, so the case is recognised rather
  // than remembered as a string. Viewing the whole scramble from another
  // lateral side does the same again: the physical sequence is unchanged, only
  // its notation is, and plain() folds the viewing rotation back out so the
  // scramble never asks the solver to turn the whole cube.
  const VIEWS = ["", "y", "y2", "y'"];
  function trainingScramble(alg, random = Math.random) {
    const pick = () => AUF[Math.floor(random() * AUF.length)];
    const view = VIEWS[Math.floor(random() * VIEWS.length)];
    const base = [pick(), setup(alg), pick()].filter(Boolean).join(" ");
    const viewed = view ? [view, base, inverse(view)].join(" ") : base;
    return collapse(plain(viewed));
  }
  const api = {
    Cube,
    FACES,
    rotate,
    moveSpec,
    tokens,
    inverse,
    normalize,
    plain,
    collapse,
    setup,
    hold,
    orientation,
    caseKey,
    solvesCase,
    isSolved,
    trainingScramble,
    scramble,
    parseTime,
    parseCSV,
    exportCSV,
    csvRows,
    value,
    format,
    average,
    rolling,
    subSeries,
    stats,
  };
  root.CT = api;
  if (typeof module !== "undefined") module.exports = api;
})(globalThis);
