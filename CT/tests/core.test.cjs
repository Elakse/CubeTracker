const { test } = require("node:test");
const assert = require("node:assert/strict");
const C = require("../assets/core.js");
const Reference = require("../assets/vendor/cube.js");
const seq = [
  "U",
  "R",
  "F",
  "D",
  "L",
  "B",
  "M",
  "E",
  "S",
  "x",
  "y",
  "z",
  "u",
  "r",
  "f",
  "d",
  "l",
  "b",
];
const solved = new C.Cube().signature();
test("all 54 stickers agree with independent cubejs model for every move and modifier", () => {
  for (const face of seq)
    for (const suffix of ["", "'", "2"]) {
      const alg = face + suffix;
      assert.equal(
        new C.Cube().apply(alg).signature(),
        new Reference().move(alg).asString(),
        alg,
      );
    }
});
test("1,000 mixed scrambles agree with independent cubie model, sticker for sticker", () => {
  let seed = 29;
  const random = (n) => {
    seed = (seed * 16807) % 2147483647;
    return seed % n;
  };
  for (let i = 0; i < 1000; i++) {
    const alg = Array.from(
      { length: 25 },
      () => seq[random(seq.length)] + ["", "'", "2"][random(3)],
    ).join(" ");
    assert.equal(
      new C.Cube().apply(alg).signature(),
      new Reference().move(alg).asString(),
      alg,
    );
  }
});
test("inverse, four turns, wide aliases, commutation, and orientation identities", () => {
  for (const face of seq) {
    assert.equal(
      new C.Cube().apply(Array(4).fill(face).join(" ")).signature(),
      solved,
    );
    assert.equal(
      new C.Cube().apply(face + " " + C.inverse(face)).signature(),
      solved,
    );
  }
  for (const f of "URFDLB")
    assert.equal(
      new C.Cube().apply(f + "w").signature(),
      new C.Cube().apply(f.toLowerCase()).signature(),
    );
  assert.equal(new C.Cube().apply("R L R' L'").signature(), solved);
  assert.equal(
    new C.Cube().apply("R M' L'").signature(),
    new C.Cube().apply("x").signature(),
  );
  for (let i = 0; i < 50; i++) {
    const alg = C.scramble();
    assert.equal(
      new C.Cube().apply(alg).apply(C.inverse(alg)).signature(),
      solved,
    );
  }
  assert.throws(() => new C.Cube().apply("R nonsense U"), /Unsupported move/);
  assert.deepEqual(C.tokens("Rw2’ U’ r2'"), ["Rw2", "U'", "r2"]);
});
test("CSV round trip preserves minutes, penalties, DNF, commas, quotes and row order", () => {
  const csv =
    '\uFEFFIndex,Time,Scramble,Date\r\n3,DNF(12.34),"R U R\'", "9/5/2026, 9:30:00 PM"\r\n2,1:04.50+,"F2 B2","9/5/2026, 9:20:00 PM"\r\n1,9.87,"R2 U2","9/5/2026, 9:10:00 PM"\r\n'.replace(
      ', "',
      ',"',
    );
  const { solves } = C.parseCSV(csv);
  assert.equal(solves.length, 3);
  assert.equal(solves[0].rawMs, 9870);
  assert.equal(solves[1].rawMs, 62500);
  assert.equal(C.value(solves[1]), 64.5);
  assert.equal(solves[2].rawMs, 12340);
  assert.equal(solves[2].penalty, "DNF");
  const exported = C.exportCSV(solves);
  assert.ok(exported.includes('"64.50+"'));
  assert.ok(exported.includes('"DNF"'));
  const again = C.parseCSV(exported).solves;
  assert.deepEqual(
    again.map(({ rawMs, penalty, scramble, date }) => ({
      rawMs,
      penalty,
      scramble,
      date,
    })),
    solves.map(({ rawMs, penalty, scramble, date }) => ({
      rawMs: penalty === "DNF" ? 0 : rawMs,
      penalty,
      scramble,
      date,
    })),
  );
  assert.deepEqual(C.csvRows('a,b\n"hello, \"\"world\"\"","two\nlines"'), [
    ["a", "b"],
    ['hello, "world"', "two\nlines"],
  ]);
});
test("legacy unquoted date commas, bad rows, invalid dates and empty exports", () => {
  const p = C.parseCSV(
    "Index,Time,Scramble,Date\n1,12.34,R U,9/5/2026, 9:30:00 PM\n2,DNF,R2,unknown",
  );
  assert.equal(p.missingDates, 1);
  assert.ok(p.solves[0].date);
  assert.throws(
    () => C.parseCSV("Index,Time,Scramble,Date\n1,bogus,R,2026-09-05"),
    /invalid row/,
  );
  assert.throws(
    () => C.parseCSV('Index,Time,Scramble,Date\n1,12,"R,2026-09-05'),
    /unclosed/,
  );
  assert.throws(() => C.parseTime("1:70.00"), /Invalid seconds/);
  assert.throws(() => C.parseTime("0.01+"), /out of range/);
  assert.equal(C.exportCSV([]), "Index,Time,Scramble,Date\r\n\r\n");
});
const solve = (t) => ({
  rawMs: Number.isFinite(t) ? t * 1000 : 0,
  penalty: Number.isFinite(t) ? "" : "DNF",
});
test("WCA-style trimmed averages retain DNFs and +2; goals use all attempts", () => {
  assert.equal(C.average([10, 11, 12, 13, Infinity].map(solve), 5), 12);
  assert.equal(
    C.average([10, 11, 12, Infinity, Infinity].map(solve), 5),
    Infinity,
  );
  assert.equal(C.average([10, 11].map(solve), 5), null);
  const a = [10, 11, 12, 15, Infinity].map(solve);
  assert.deepEqual(C.subSeries(a, 5, 15), [null, null, null, null, 60]);
  assert.equal(C.subSeries([...a, solve(14)], 5, 15).at(-1), 60);
  assert.equal(C.value({ rawMs: 13000, penalty: "+2" }), 15);
  assert.equal(C.stats(a).mean, 12);
  assert.equal(C.stats(a).dnf, 1);
  assert.equal(C.stats(a).median, 11.5);
  assert.equal(C.format(59.999), "1:00.00");
  assert.equal(C.format(60.12), "1:00.12");
});
