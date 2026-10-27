/* Insights model: round axes, histogram bins, records, weekday counts, trend line. Run: node --test tests/insights.test.cjs */
const test = require('node:test');
const assert = require('node:assert/strict');
const I = require('../assets/insights.js');
const C = require('../assets/core.js');

test('niceTicks covers the range on round steps', () => {
  const t = I.niceTicks(7.14, 12.6, 4);
  assert.ok(t.min <= 7.14 && t.max >= 12.6);
  assert.ok(t.ticks.every((v) => Math.abs(v / t.step - Math.round(v / t.step)) < 1e-9));
  assert.deepEqual(I.niceTicks(0, 100, 4).ticks, [0, 25, 50, 75, 100]);
  const flat = I.niceTicks(5, 5);
  assert.ok(flat.max > flat.min);
});

test('histogram uses round bin edges and counts every value once', () => {
  const vals = [7.1, 7.9, 8.0, 8.5, 9.99, 10, 10.01, 14.2];
  const h = I.histogram(vals);
  assert.equal(h.bins.reduce((n, b) => n + b.count, 0), vals.length);
  assert.ok(h.bins.length <= 14 && h.bins.length >= 2);
  assert.equal(h.bins[0].from, h.lo);
  assert.ok(Math.abs(h.lo / h.step - Math.round(h.lo / h.step)) < 1e-9, 'first edge is a multiple of the step');
  assert.ok(vals.every((v) => v >= h.lo - 1e-9 && v < h.bins.at(-1).to + 1e-9));
  assert.deepEqual(I.histogram([]).bins, []);
  assert.equal(I.histogram([9, 9, 9]).bins.reduce((n, b) => n + b.count, 0), 3);
});

test('records lists each new best and bestAt finds the one standing at a solve', () => {
  const s = (ms, penalty = '') => ({ id: 'x' + ms, rawMs: ms, penalty });
  const list = [s(12000), s(13000), s(11000), s(9000, 'DNF'), s(11000), s(10500), s(10600)];
  const r = I.records(list, C.value);
  assert.deepEqual(r.map((x) => [x.i, x.v]), [[0, 12], [2, 11], [5, 10.5]]);
  assert.equal(I.bestAt(r, 1).v, 12);
  assert.equal(I.bestAt(r, 4).v, 11);
  assert.equal(I.bestAt(r, 6).v, 10.5);
  assert.equal(I.bestAt([], 3), null);
  assert.equal(I.records([s(5000, 'DNF')], C.value).length, 0, 'a DNF is never a record');
});

test('weekdayCounts is Monday first and skips undated solves', () => {
  const mon = new Date(2026, 9, 26), sun = new Date(2026, 10, 1);
  const list = [{ d: mon }, { d: mon }, { d: sun }, { d: null }];
  assert.deepEqual(I.weekdayCounts(list, (s) => s.d), [2, 0, 0, 0, 0, 0, 1]);
});

test('regression finds the line through defined points only', () => {
  const r = I.regression([null, null, 1, 2, 3, 4]);
  assert.equal(r.i0, 2); assert.equal(r.i1, 5);
  assert.ok(Math.abs(r.v0 - 1) < 1e-9 && Math.abs(r.v1 - 4) < 1e-9);
  assert.equal(I.regression([1, 2]), null);
});

test('bestAverage is the lowest rolling window and null when there are too few solves', () => {
  const list = Array.from({ length: 20 }, (_, i) => ({ id: 'a' + i, rawMs: i === 10 ? 5000 : 10000 + i * 10, penalty: '' }));
  const best5 = I.bestAverage(list, 5, C.average), cur5 = C.average(list.slice(-5), 5);
  assert.ok(best5 <= cur5);
  assert.equal(I.bestAverage(list.slice(0, 3), 5, C.average), null);
});

test('sample keeps the first and last defined index and caps the length', () => {
  const ys = Array.from({ length: 5000 }, (_, i) => (i < 100 ? null : i));
  const idx = I.sample(ys, 600);
  assert.equal(idx[0], 100); assert.equal(idx.at(-1), 4999);
  assert.ok(idx.length <= 700);
});

test('autoWindow is a tenth of the range, between 20 and 500, and always leaves a line to draw', () => {
  assert.equal(I.autoWindow(1000), 100);
  assert.equal(I.autoWindow(100000), 500);
  assert.equal(I.autoWindow(150), 20);
  assert.equal(I.autoWindow(40), 20);
  assert.equal(I.autoWindow(12), 11);
  assert.equal(I.autoWindow(6), 5);
  for (const n of [6, 7, 10, 25, 99, 500, 3000]) assert.ok(n - I.autoWindow(n) + 1 >= 2, `n=${n} leaves two points`);
});
