const test = require("node:test");
const assert = require("node:assert");
const C = require("../assets/core.js");
const T = require("../assets/trainer.js");

const solved = new C.Cube().signature();
const pllCases = T.PLL.groups.flatMap((g) =>
  g.cases.map((c) => ({ ...c, group: g.name })),
);
const ollCases = T.OLL.groups.flatMap((g) =>
  g.cases.map((c) => ({ ...c, group: g.name })),
);
const allCases = [...pllCases, ...ollCases];

// A deterministic generator, so a failure can be reproduced.
function seeded(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
const f2lIntact = (alg) => {
  const f = new C.Cube().apply(alg).facelets();
  return (
    f.D.every((x) => x === "D") &&
    ["F", "R", "B", "L"].every((k) => f[k].slice(3).every((x) => x === k))
  );
};
const plain = /^(?:[URFDLB](?:2|')?)(?: [URFDLB](?:2|')?)*$/;

test("rotations are rewritten away without changing what the sequence does", () => {
  const samples = [
    "x R' U R' D2 R U' R' D2 R2 x'",
    "y R' U L' U2 R U' R' U2 R L",
    "y2 M2 U M U2 M' U M2",
    "z U' R' U R U R' F' U' R' U' R U F R' U R2 U' z'",
    "R U R' y' R2 u' R U' R' U R' u R2",
  ];
  for (const alg of samples) {
    const rewritten = C.normalize(alg);
    assert.ok(!/[xyz]/.test(rewritten), `${alg} still rotates`);
    // Equivalent up to the whole-cube rotation the original leaves behind: the
    // rewritten sequence undoes the original's setup exactly.
    assert.strictEqual(
      new C.Cube().apply(C.inverse(rewritten) + " " + rewritten).signature(),
      solved,
      alg,
    );
    assert.ok(C.isSolved(new C.Cube().apply(C.setup(alg) + " " + alg)), alg);
  }
});

test("a rotation-free sequence is left as it is", () => {
  const alg = "R U R' U' R' F R2 U' R' U' R U R' F'";
  assert.strictEqual(C.normalize(alg), alg);
});

test("touching turns of the same face merge", () => {
  assert.strictEqual(C.collapse("U R R' U' U2"), "U2");
  assert.strictEqual(C.collapse("R U U' R'"), "");
  assert.strictEqual(C.collapse("U' U2"), "U");
  assert.strictEqual(C.collapse("R U R'"), "R U R'");
});

test("every preloaded case is a distinct last-layer case", () => {
  assert.strictEqual(pllCases.length, 21);
  const seen = new Map();
  for (const c of pllCases) {
    const setup = C.setup(c.algs[0]);
    assert.ok(f2lIntact(setup), `${c.name} disturbs the first two layers`);
    assert.ok(
      C.isSolved(new C.Cube().apply(setup + " " + c.algs[0])),
      `${c.name} does not undo its own setup`,
    );
    const key = C.caseKey(c.algs[0]);
    assert.ok(!seen.has(key), `${c.name} is the same case as ${seen.get(key)}`);
    seen.set(key, c.name);
  }
});

test("OLL contains all 57 distinct cases with one algorithm each", () => {
  assert.strictEqual(T.SETS.length, 2);
  assert.strictEqual(T.OLL.groups.length, 14);
  assert.strictEqual(ollCases.length, 57);
  assert.deepStrictEqual(
    ollCases.map((c) => Number(c.name.replace("OLL ", ""))).sort((a, b) => a - b),
    Array.from({ length: 57 }, (_, i) => i + 1),
  );
  const seen = new Map();
  for (const c of ollCases) {
    assert.strictEqual(c.algs.length, 1, `${c.name} should have one algorithm`);
    const alg = c.algs[0],
      setup = C.setup(alg),
      key = C.caseKey(alg);
    assert.ok(f2lIntact(setup), `${c.name} disturbs the first two layers`);
    assert.ok(C.isSolved(new C.Cube().apply(`${setup} ${alg}`)), c.name);
    assert.ok(!seen.has(key), `${c.name} is the same case as ${seen.get(key)}`);
    seen.set(key, c.name);
  }
});

test("every alternative solves the case its favourite defines", () => {
  for (const c of allCases) {
    const setup = C.setup(c.algs[0]);
    for (const alg of c.algs.slice(1)) {
      assert.doesNotThrow(() => C.tokens(alg), `${c.name}: ${alg}`);
      assert.notStrictEqual(
        C.solvesCase(alg, setup),
        null,
        `${c.name}: ${alg} does not solve this case`,
      );
    }
  }
});

test("every algorithm plays its own case back to solved", () => {
  for (const c of allCases)
    for (const alg of c.algs) {
      const setup = C.setup(alg);
      assert.ok(f2lIntact(setup), `${c.name}: ${alg} sets up a broken cube`);
      // Solved, not necessarily upright: an algorithm written with rotations
      // legitimately finishes with the cube held somewhere else.
      assert.ok(
        C.isSolved(
          new C.Cube().apply([setup, C.hold(alg), alg].filter(Boolean).join(" ")),
        ),
        `${c.name}: ${alg} does not solve its own setup`,
      );
    }
});

test("a sequence that leaves the cube held differently is set up upright", () => {
  const alg = "R' d' F R2 u R' U R U' R u' R2";
  assert.notStrictEqual(C.hold(alg), "");
  assert.ok(f2lIntact(C.setup(alg)));
  assert.strictEqual(C.hold("R U R' U'"), "");
  // Written rotations are rewritten away first, so they never reach the hold.
  assert.strictEqual(C.orientation("y"), "");
  assert.strictEqual(C.hold("y R U R' U'"), "");
});

test("an algorithm for another case is rejected", () => {
  const tPerm = C.setup("R U R' U' R' F R2 U' R' U' R U R' F'");
  assert.strictEqual(C.solvesCase("M2 U M2 U2 M2 U M2", tPerm), null);
  assert.strictEqual(C.solvesCase("R U R' U'", tPerm), null);
});

test("training scrambles vary but always keep the case", () => {
  const random = seeded(20260909);
  for (const c of pllCases)
    for (const alg of c.algs) {
      const seen = new Set();
      for (let i = 0; i < 24; i++) {
        const scramble = C.trainingScramble(alg, random);
        assert.doesNotThrow(() => C.tokens(scramble), `${c.name}: ${scramble}`);
        assert.notStrictEqual(
          C.solvesCase(alg, scramble),
          null,
          `${c.name}: ${scramble} is not this case`,
        );
        assert.ok(f2lIntact(scramble), `${c.name}: ${scramble} broke the first two layers`);
        seen.add(scramble);
      }
      assert.ok(seen.size > 1, `${c.name}: ${alg} always produces one scramble`);
    }
});

test("every OLL case produces a valid training scramble", () => {
  const random = seeded(57);
  for (const c of ollCases) {
    const alg = c.algs[0],
      scramble = C.trainingScramble(alg, random);
    assert.doesNotThrow(() => C.tokens(scramble), `${c.name}: ${scramble}`);
    assert.notStrictEqual(C.solvesCase(alg, scramble), null, c.name);
    assert.ok(f2lIntact(scramble), `${c.name}: ${scramble} broke the first two layers`);
  }
});

test("scrambles are outer face turns only", () => {
  const random = seeded(20260911);
  for (const c of allCases)
    for (const alg of c.algs) {
      const setup = C.setup(alg),
        scramble = C.trainingScramble(alg, random);
      assert.match(setup, plain, `${c.name}: ${setup}`);
      assert.match(scramble, plain, `${c.name}: ${scramble}`);
    }
});

test("every wide and slice turn expands to outer face turns only", () => {
  const check = (token) => {
    const moves = C.plain(token);
    assert.match(moves, plain, `${token} expands to ${moves}`);
    // plain() drops the turn's whole-cube rotation, so orientation() puts the
    // exact state back: the two sequences must match sticker for sticker.
    assert.strictEqual(
      new C.Cube()
        .apply([moves, C.orientation(token)].filter(Boolean).join(" "))
        .signature(),
      new C.Cube().apply(token).signature(),
      `${token} changed the cube`,
    );
  };
  for (const face of ["R", "L", "U", "D", "F", "B"])
    for (const token of [
      `${face}w`,
      `${face}w'`,
      `${face}w2`,
      face.toLowerCase(),
      `${face.toLowerCase()}'`,
      `${face.toLowerCase()}2`,
    ])
      check(token);
  for (const slice of ["M", "E", "S"])
    for (const token of [slice, `${slice}'`, `${slice}2`]) check(token);
});

test("a round covers what was asked of it", () => {
  const random = seeded(7);
  const ids = ["a", "b", "c", "d"];
  const every = T.buildRound(ids, { mode: "every", reps: 2 }, random);
  assert.strictEqual(every.length, 8);
  for (const id of ids)
    assert.strictEqual(every.filter((x) => x === id).length, 2, id);
  const draw = T.buildRound(ids, { mode: "random", reps: 30 }, random);
  assert.strictEqual(draw.length, 30);
  assert.ok(draw.every((id) => ids.includes(id)));
  assert.strictEqual(T.buildRound([], { mode: "random", reps: 5 }, random).length, 0);
});
