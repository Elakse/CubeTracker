/* Preloaded algorithm sets and round building for the Trainer. */
(function (root) {
  "use strict";
  // Nothing here describes a case as a cube state: a case is whatever its
  // algorithm solves, so the scramble is derived from the algorithm itself.
  // tests/trainer.test.cjs verifies every entry against the engine — the
  // favourite leaves the first two layers alone and undoes its own setup, and
  // each alternative solves the same case as the favourite. The favourite is
  // the algorithm most commonly taught for that case.
  const PLL = {
    name: "PLL",
    builtin: "pll",
    groups: [
      {
        name: "Edges only",
        cases: [
          {
            name: "H",
            algs: [
              "M2 U M2 U2 M2 U M2",
              "M2 U' M2 U2 M2 U' M2",
              "R2 S2 R2 U' R2 S2 R2",
            ],
          },
          {
            name: "Ua",
            algs: [
              "M2 U M U2 M' U M2",
              "R U R' U R' U' R2 U' R' U R' U R",
              "R2 U' S' U2 S U' R2",
            ],
          },
          {
            name: "Ub",
            algs: [
              "M2 U' M U2 M' U' M2",
              "R' U R' U' R' U' R' U R U R2",
              "R2 U' S R2 S' R2 U R2",
            ],
          },
          {
            name: "Z",
            algs: [
              "M' U' M2 U' M2 U' M' U2 M2",
              "M2 U M2 U M' U2 M2 U2 M'",
              "R' U' R U' R U R U' R' U R U R2 U' R'",
            ],
          },
        ],
      },
      {
        name: "Corners only",
        cases: [
          {
            name: "Aa",
            algs: [
              "x R' U R' D2 R U' R' D2 R2 x'",
              "y' x L2 D2 L' U' L D2 L' U L'",
              "R' D R U' R' D' R U' R' D R U2 R' D' R",
            ],
          },
          {
            name: "Ab",
            algs: [
              "x R2 D2 R U R' D2 R U' R x'",
              "y x' R U' R D2 R' U R D2 R2 x",
              "R' B' R U' R D R' U R D' R2 B R",
            ],
          },
          {
            name: "E",
            algs: [
              "x' R U' R' D R U R' D' R U R' D R U' R' D' x",
              "R2 U F' R' U R U' R' U R U' R' U R U' F U' R2",
            ],
          },
        ],
      },
      {
        name: "Edges and corners",
        cases: [
          {
            name: "F",
            algs: [
              "R' U' F' R U R' U' R' F R2 U' R' U' R U R' U R",
              "R' U R U' R2 F' U' F U R F R' F' R2",
              "R2 F R F' R' U' F' U F R2 U R' U' R",
            ],
          },
          {
            name: "Ga",
            algs: [
              "R2 U R' U R' U' R U' R2 D U' R' U R D'",
              "R2 u R' U R' U' R u' R2 F' U F",
            ],
          },
          {
            name: "Gb",
            algs: [
              "R' U' R U D' R2 U R' U R U' R U' R2 D",
              "F' U' F R2 u R' U R U' R u' R2",
              "R' d' F R2 u R' U R U' R u' R2",
            ],
          },
          {
            name: "Gc",
            algs: [
              "R2 U' R U' R U R' U R2 D' U R U' R' D",
              "R2 F2 R U2 R U2 R' F R U R' U' R' F R2",
              "R2 u' R U' R U R' u R2 f R' f'",
            ],
          },
          {
            name: "Gd",
            algs: [
              "R U R' U' D R2 U' R U' R' U R' U R2 D'",
              "R U R' y' R2 u' R U' R' U R' u R2",
            ],
          },
          {
            name: "Ja",
            algs: [
              "x R2 F R F' R U2 r' U r U2 x'",
              "R' U L' U2 R U' R' U2 R L",
              "L' U' L F L' U' L U L F' L2 U L",
            ],
          },
          {
            name: "Jb",
            algs: [
              "R U R' F' R U R' U' R' F R2 U' R'",
              "R U2 R' U' R U2 L' U R' U' L",
              "r' F R F' r U2 R' U R U2 R'",
            ],
          },
          {
            name: "Na",
            algs: [
              "R U R' U R U R' F' R U R' U' R' F R2 U' R' U2 R U' R'",
              "F' R U R' U' R' F R2 F U' R' U' R U F' R'",
              "r' D r U2 r' D r U2 r' D r U2 r' D r U2 r' D r",
            ],
          },
          {
            name: "Nb",
            algs: [
              "R' U R U' R' F' U' F R U R' F R' F' R U' R",
              "r' D' F r U' r' F' D r2 U r' U' r' F r F'",
              "R' U L' U2 R U' L R' U L' U2 R U' L",
            ],
          },
          {
            name: "Ra",
            algs: [
              "R U' R' U' R U R D R' U' R D' R' U2 R'",
              "R U R' F' R U2 R' U2 R' F R U R U2 R'",
              "L U2 L' U2 L F' L' U' L U L F L2",
            ],
          },
          {
            name: "Rb",
            algs: [
              "R' U2 R U2 R' F R U R' U' R' F' R2",
              "R2 F R U R U' R' F' R U2 R' U2 R",
              "R' U2 R' D' R U' R' D R U R U' R' U' R",
            ],
          },
          {
            name: "T",
            algs: [
              "R U R' U' R' F R2 U' R' U' R U R' F'",
              "R2 u R2 u' R2 F2 u' F2 u F2",
            ],
          },
          {
            name: "V",
            algs: [
              "R' U R' U' y R' F' R2 U' R' U R' F R F",
              "R' U R' U' R D' R' D R' U D' R2 U' R2 D R2",
              "R U' R U R' D R D' R U' D R2 U R2 D' R2",
            ],
          },
          {
            name: "Y",
            algs: [
              "F R U' R' U' R U R' F' R U R' U' R' F R F'",
              "F R' F R2 U' R' U' R U R' F' R U R' U' F'",
            ],
          },
        ],
      },
    ],
  };
  // One algorithm per case, grouped by recognition shape. These are the
  // highest-voted algorithms from SpeedCubeDB's OLL library (retrieved
  // 2026-09-09): https://www.speedcubedb.com/a/3x3/OLL
  const OLL = {
    name: "OLL",
    builtin: "oll",
    groups: [
      {
        name: "All corners oriented",
        cases: [
          { name: "OLL 28", algs: ["r U R' U' M U R U' R'"] },
          { name: "OLL 57", algs: ["R U R' U' M' U R U' r'"] },
        ],
      },
      {
        name: "OCLL",
        cases: [
          { name: "OLL 21", algs: ["R U R' U R U' R' U R U2 R'"] },
          { name: "OLL 22", algs: ["R U2 R2 U' R2 U' R2 U2 R"] },
          { name: "OLL 23", algs: ["R2 D R' U2 R D' R' U2 R'"] },
          { name: "OLL 24", algs: ["r U R' U' r' F R F'"] },
          { name: "OLL 25", algs: ["R U2 R D R' U2 R D' R2"] },
          { name: "OLL 26", algs: ["y R U2 R' U' R U' R'"] },
          { name: "OLL 27", algs: ["R U R' U R U2 R'"] },
        ],
      },
      {
        name: "T shapes",
        cases: [
          { name: "OLL 33", algs: ["R U R' U' R' F R F'"] },
          { name: "OLL 45", algs: ["F R U R' U' F'"] },
        ],
      },
      {
        name: "Square shapes",
        cases: [
          { name: "OLL 5", algs: ["r' U2 R U R' U r"] },
          { name: "OLL 6", algs: ["r U2 R' U' R U' r'"] },
        ],
      },
      {
        name: "C shapes",
        cases: [
          { name: "OLL 34", algs: ["y f R f' U' r' U' R U M'"] },
          { name: "OLL 46", algs: ["R' U' R' F R F' U R"] },
        ],
      },
      {
        name: "W shapes",
        cases: [
          { name: "OLL 36", algs: ["y R U R2 F' U' F U R2 U2 R'"] },
          { name: "OLL 38", algs: ["R U R' U R U' R' U' R' F R F'"] },
        ],
      },
      {
        name: "P shapes",
        cases: [
          { name: "OLL 31", algs: ["R' U' F U R U' R' F' R"] },
          { name: "OLL 32", algs: ["S R U R' U' R' F R f'"] },
          { name: "OLL 43", algs: ["y R' U' F' U F R"] },
          { name: "OLL 44", algs: ["f R U R' U' f'"] },
        ],
      },
      {
        name: "Line shapes",
        cases: [
          { name: "OLL 51", algs: ["y2 F U R U' R' U R U' R' F'"] },
          { name: "OLL 52", algs: ["y2 R' F' U' F U' R U R' U R"] },
          { name: "OLL 55", algs: ["y R' F U R U' R2 F' R2 U R' U' R"] },
          { name: "OLL 56", algs: ["r U r' U R U' R' U R U' R' r U' r'"] },
        ],
      },
      {
        name: "Fish shapes",
        cases: [
          { name: "OLL 9", algs: ["y R U R' U' R' F R2 U R' U' F'"] },
          { name: "OLL 10", algs: ["R U R' U R' F R F' R U2 R'"] },
          { name: "OLL 35", algs: ["R U2 R2 F R F' R U2 R'"] },
          { name: "OLL 37", algs: ["F R' F' R U R U' R'"] },
        ],
      },
      {
        name: "Knight move shapes",
        cases: [
          { name: "OLL 13", algs: ["F U R U2 R' U' R U R' F'"] },
          { name: "OLL 14", algs: ["R' F R U R' F' R F U' F'"] },
          { name: "OLL 15", algs: ["r' U' r R' U' R U r' U r"] },
          { name: "OLL 16", algs: ["r U r' R U R' U' r U' r'"] },
        ],
      },
      {
        name: "Awkward shapes",
        cases: [
          { name: "OLL 29", algs: ["r2 D' r U r' D r2 U' r' U' r"] },
          { name: "OLL 30", algs: ["y' r' D' r U' r' D r2 U' r' U r U r'"] },
          { name: "OLL 41", algs: ["y2 R U R' U R U2 R' F R U R' U' F'"] },
          { name: "OLL 42", algs: ["R' U' R U' R' U2 R F R U R' U' F'"] },
        ],
      },
      {
        name: "L shapes",
        cases: [
          { name: "OLL 47", algs: ["y' F R' F' R U2 R U' R' U R U2 R'"] },
          { name: "OLL 48", algs: ["F R U R' U' R U R' U' F'"] },
          { name: "OLL 49", algs: ["y2 r U' r2 U r2 U r2 U' r"] },
          { name: "OLL 50", algs: ["r' U r2 U' r2 U' r2 U r'"] },
          { name: "OLL 53", algs: ["r' U' R U' R' U R U' R' U2 r"] },
          { name: "OLL 54", algs: ["r U R' U R U' R' U R U2 r'"] },
        ],
      },
      {
        name: "Lightning shapes",
        cases: [
          { name: "OLL 7", algs: ["r U R' U R U2 r'"] },
          { name: "OLL 8", algs: ["y2 r' U' R U' R' U2 r"] },
          { name: "OLL 11", algs: ["r' R2 U R' U R U2 R' U M'"] },
          { name: "OLL 12", algs: ["y' M' R' U' R U' R' U2 R U' M"] },
          { name: "OLL 39", algs: ["y' f' r U r' U' r' F r S"] },
          { name: "OLL 40", algs: ["y R' F R U R' U' F' U R"] },
        ],
      },
      {
        name: "Dot cases",
        cases: [
          { name: "OLL 1", algs: ["R U2 R2 F R F' U2 R' F R F'"] },
          { name: "OLL 2", algs: ["y' R U' R2 D' r U r' D R2 U R'"] },
          { name: "OLL 3", algs: ["y' f R U R' U' f' U' F R U R' U' F'"] },
          { name: "OLL 4", algs: ["y' R' F2 R2 U2 R' F' R U2 R2 F2 R"] },
          { name: "OLL 17", algs: ["R U R' U R' F R F' U2 R' F R F'"] },
          { name: "OLL 18", algs: ["y R U2 R2 F R F' U2 M' U R U' r'"] },
          { name: "OLL 19", algs: ["y S' R U R' S U' R' F R F'"] },
          { name: "OLL 20", algs: ["r U R' U' M2 U R U' R' U' M'"] },
        ],
      },
    ],
  };
  function shuffle(list, random = Math.random) {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
  // "random" draws each attempt from the pool, so a case can repeat and another
  // can be missed; "every" walks the whole pool in a shuffled order, so the
  // round covers each selected case the same number of times.
  function buildRound(ids, { mode = "random", reps = 12 } = {}, random = Math.random) {
    const pool = [...ids],
      count = Math.max(1, Math.round(reps));
    if (!pool.length) return [];
    if (mode === "every") {
      const queue = [];
      for (let i = 0; i < count; i++) queue.push(...shuffle(pool, random));
      return queue;
    }
    return Array.from(
      { length: count },
      () => pool[Math.floor(random() * pool.length)],
    );
  }
  const api = { SETS: [PLL, OLL], PLL, OLL, buildRound, shuffle };
  root.CT_TRAINER = api;
  if (typeof module !== "undefined") module.exports = api;
})(globalThis);
