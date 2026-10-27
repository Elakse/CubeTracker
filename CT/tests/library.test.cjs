const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../assets/library.js");
const C = require("../assets/core.js");

const NOW = new Date(2026, 9, 26, 15, 0).getTime();   // Mon Oct 26 2026, local time
const at = (daysAgo, h = 12) => new Date(2026, 9, 26 - daysAgo, h).toISOString();
const solve = (id, ms, extra = {}) => ({ id, rawMs: ms, penalty: "", scramble: "R U", note: "", date: at(0), ...extra });
const ctx = { value: C.value, format: C.format, dateOf: (s) => (s.date ? new Date(s.date) : null), now: () => NOW };
const ids = (list) => list.map((s) => s.id);

const solves = [
  solve("a", 12000, { date: at(9) }),
  solve("b", 9500, { date: at(3), note: "Warm-up" }),
  solve("c", 8000, { date: at(1), penalty: "+2" }),
  solve("d", 30000, { date: at(1), penalty: "DNF", scramble: "F2 D2" }),
  solve("e", 9900, { date: at(0) }),
  solve("f", 11000, { date: null }),
];

test("default state groups by day, newest first", () => {
  const st = L.defaultState();
  assert.deepEqual([st.filter, st.sort, st.dir, st.group, st.range], ["all", "date", "desc", true, "any"]);
  assert.equal(L.defaultState({ T: 8, group: false }).T, 8);
  assert.equal(L.defaultState({ group: false }).group, false);
});

test("no filters: everything, newest first; asc flips it", () => {
  assert.deepEqual(ids(L.select(solves, L.defaultState(), ctx)), ["f", "e", "d", "c", "b", "a"]);
  assert.deepEqual(ids(L.select(solves, L.defaultState({ dir: "asc" }), ctx)), ["a", "b", "c", "d", "e", "f"]);
});

test("Sub T keeps solves strictly under T seconds, and +2 counts as 2 seconds more", () => {
  const sub = (T) => ids(L.select(solves, L.defaultState({ filter: "sub", T, dir: "asc" }), ctx));
  assert.deepEqual(sub(10), ["b", "c", "e"].filter((x) => x !== "c"));   // c is 8.00 + 2 = 10.00, not under 10
  assert.deepEqual(sub(10.01), ["b", "c", "e"]);
  assert.deepEqual(sub(9.5), []);   // strictly under: 9.50 itself is out
  assert.deepEqual(sub(9.51), ["b"]);
  assert.deepEqual(sub(60), ["a", "b", "c", "e", "f"]);   // DNF never qualifies
});

test("+2 and DNF filters", () => {
  assert.deepEqual(ids(L.select(solves, L.defaultState({ filter: "plus" }), ctx)), ["c"]);
  assert.deepEqual(ids(L.select(solves, L.defaultState({ filter: "dnf" }), ctx)), ["d"]);
});

test("sorting by time: fastest first, DNF last, ties keep solve order", () => {
  const tied = [solve("x", 9000), solve("y", 9000), solve("z", 8000), solve("w", 1, { penalty: "DNF" })];
  assert.deepEqual(ids(L.select(tied, L.defaultState({ sort: "time", dir: "asc" }), ctx)), ["z", "x", "y", "w"]);
  assert.deepEqual(ids(L.select(tied, L.defaultState({ sort: "time", dir: "desc" }), ctx)), ["w", "x", "y", "z"]);
});

test("search looks at the time, scramble, note and penalty, ignoring case", () => {
  const find = (q) => ids(L.select(solves, L.defaultState({ q }), ctx));
  assert.deepEqual(find("warm"), ["b"]);
  assert.deepEqual(find("F2 d2"), ["d"]);
  assert.deepEqual(find("9.5"), ["b"]);
  assert.deepEqual(find("dnf"), ["d"]);
  assert.deepEqual(find("  "), ["f", "e", "d", "c", "b", "a"]);
  assert.deepEqual(find("nothing like this"), []);
});

test("search text follows edits to the solve", () => {
  const s = solve("n", 10000);
  assert.deepEqual(ids(L.select([s], L.defaultState({ q: "lucky" }), ctx)), []);
  s.note = "Lucky skip";
  assert.deepEqual(ids(L.select([s], L.defaultState({ q: "lucky" }), ctx)), ["n"]);
});

test("date ranges: presets and custom, inclusive of both ends; undated solves drop out", () => {
  const range = (r) => ids(L.select(solves, L.defaultState({ range: r, dir: "asc" }), ctx));
  assert.deepEqual(range("today"), ["e"]);
  assert.deepEqual(range("7"), ["b", "c", "d", "e"]);
  assert.deepEqual(range("30"), ["a", "b", "c", "d", "e"]);
  assert.deepEqual(range("month"), ["a", "b", "c", "d", "e"]);
  const st = L.defaultState({ range: "custom", from: "2026-10-23", to: "2026-10-25", dir: "asc" });
  assert.deepEqual(ids(L.select(solves, st, ctx)), ["b", "c", "d"]);
  assert.deepEqual(L.rangeBounds(L.defaultState({ range: "7" }), NOW), ["2026-10-20", "2026-10-26"]);
  assert.deepEqual(L.rangeBounds(L.defaultState(), NOW), ["", ""]);
});

test("filters combine", () => {
  const st = L.defaultState({ filter: "sub", T: 10.5, range: "7", q: "9" });
  assert.deepEqual(ids(L.select(solves, st, ctx)), ["e", "b"]);
});

test("isFiltered ignores sort and grouping", () => {
  assert.equal(L.isFiltered(L.defaultState({ sort: "time", group: false })), false);
  assert.equal(L.isFiltered(L.defaultState({ q: "x" })), true);
  assert.equal(L.isFiltered(L.defaultState({ filter: "dnf" })), true);
  assert.equal(L.isFiltered(L.defaultState({ range: "30" })), true);
});

test("T is clamped to something sensible and rounded to hundredths", () => {
  assert.equal(L.clampT(0), 0.5);
  assert.equal(L.clampT(10.004), 10);
  assert.equal(L.clampT(99999), 3600);
});

test("day labels", () => {
  assert.equal(L.dayLabel("2026-10-26", NOW), "Today");
  assert.equal(L.dayLabel("2026-10-25", NOW), "Yesterday");
  assert.match(L.dayLabel("2026-10-17", NOW), /Saturday, Oct 17/);
  assert.match(L.dayLabel("2025-12-31", NOW), /2025/);
  assert.equal(L.dayLabel("", NOW), "No date");
});

test("calendar grid starts on Monday and fills whole weeks", () => {
  const oct = L.monthGrid(2026, 9);   // Oct 1 2026 is a Thursday
  assert.equal(oct.length % 7, 0);
  assert.equal(oct[0].iso, "2026-09-28");
  assert.equal(oct[0].outside, true);
  assert.equal(oct.find((c) => !c.outside).iso, "2026-10-01");
  assert.equal(oct.filter((c) => !c.outside).length, 31);
  const feb = L.monthGrid(2026, 1);   // Feb 2026 starts on a Sunday and has 28 days
  assert.equal(feb[0].iso, "2026-01-26");
  assert.equal(feb.length, 35);
});
