const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('../assets/core.js');
const { profile, appendProfile, achievements, subStatus, interval, SPECIAL, inspectionCuePaths, pickInspectionCue, plan, demoEvent, demoGroups, tier, TITLE_EFFECT, MIN_REWARD_SOLVE } = require('../assets/timer-effects.js');
const solve = (time, penalty = '') => ({ rawMs: time * 1000, penalty });
test('record profiles agree with trimmed windows including DNFs and penalties', () => {
  const data = Array.from({length: 240}, (_, i) => solve(10 + (i * 37 % 119) / 10, i % 39 === 0 ? 'DNF' : i % 17 === 0 ? '+2' : ''));
  const p = profile(data);
  for (const n of [5, 12, 100]) {
    const expected = C.rolling(data, n).filter(Number.isFinite).reduce((a, b) => Math.min(a, b), Infinity);
    assert.ok(Math.abs(p.averages[n] - expected) < 1e-9);
  }
  assert.equal(p.best, C.stats(data).best);
});
test('appending a solve updates the record profile without rescanning history', () => {
  for (const length of [0, 1, 5, 12, 99, 499, 500, 501, 1700]) {
    const data = Array.from({ length }, (_, i) => solve(8 + (i * 37 % 120) / 10, i % 41 === 0 ? 'DNF' : i % 17 === 0 ? '+2' : ''));
    const next = solve(7.3),
      updated = appendProfile(profile(data), [...data, next], next),
      expected = profile([...data, next]);
    assert.deepEqual(updated.sub, expected.sub);
    assert.equal(updated.best, expected.best);
    assert.equal(updated.worst, expected.worst);
    assert.equal(updated.valid, expected.valid);
    assert.equal(updated.sum, expected.sum);
    for (const n of [5, 12, 100]) assert.equal(updated.averages[n], expected.averages[n]);
  }
});
test('simultaneous single and average records combine; ties and first windows do not celebrate', () => {
  const data = Array.from({length: 110}, () => solve(12));
  const event = achievements(profile(data), [...data, solve(9)]);
  assert.deepEqual(event.records.map(r => r.label), ['Single PB']); // trimmed fastest alone cannot lower an average
  const descending = Array.from({length: 110}, (_, i) => solve(20 - i * .05));
  assert.equal(achievements(profile(descending), [...descending, solve(10)]).records.length, 4);
  assert.equal(achievements(profile(data), [...data, solve(12)]).records.length, 0);
  assert.equal(achievements(profile([]), [solve(12)]).records.length, 0);
});
test('rolling barriers require 500 attempts, are strict, and report both directions', () => {
  const data = Array.from({length: 500}, () => solve(12.5));
  assert.equal(achievements(profile(data), [...data, solve(12.5)]).barrier, null);
  assert.equal(achievements(profile(data), [...data, solve(12)]).barrier, 12.5);
  const short = data.slice(2);
  assert.equal(achievements(profile(short), [...short, solve(1)]).special, null);
  assert.equal(achievements(profile(short), [...short, solve(1)]).barrier, null);
  const down = [...data, solve(12)];
  const up = achievements(profile(down), [...down, solve(13)]);
  assert.equal(up.barrier, 12.5);
  assert.equal(up.direction, 'up');
  assert.equal(achievements(profile(data.slice(1)), data).special, 15);
});

test('interval bands are exact and the extension grows indefinitely', () => {
  for (const [mean, step] of [[1,.5],[19.999,.5],[20,1],[29.999,1],[30,5],[119.99,5],[120,20],[599.99,20],[600,20],[601,50],[1501,100],[3001,200],[1e9,5e7]]) assert.equal(interval(mean), step);
});

test('historical rolling 500 scans every window and retains DNF and penalties', () => {
  const data = Array.from({length: 1700}, (_, i) => solve(i < 500 ? 35 : i < 1100 ? 9 : 22, i === 740 ? 'DNF' : i % 93 === 0 ? '+2' : ''));
  const windows = data.slice(499).map((_, i) => data.slice(i, i + 500).reduce((sum, s) => sum + C.value(s), 0) / 500);
  const s = subStatus(data);
  assert.ok(Math.abs(s.best - Math.min(...windows)) < 1e-9);
  assert.ok(Math.abs(s.current - windows.at(-1)) < 1e-9);
  const dnf = Array.from({length: 500}, () => solve(9)); dnf[0] = solve(2, 'DNF');
  assert.equal(subStatus(dnf).threshold, null);
  assert.equal(subStatus([...dnf, solve(9)]).threshold, 10);
});

test('all special thresholds are strict and the hardest earned title survives regression', () => {
  for (const threshold of SPECIAL) {
    const data = Array.from({length: 500}, () => solve(threshold));
    assert.notEqual(subStatus(data).threshold, threshold);
    const event = achievements(profile(data), [...data, solve(threshold - 1)]);
    assert.equal(event.special, threshold);
    assert.equal(subStatus([...data, solve(threshold - 1), ...Array.from({length: 500}, () => solve(100))]).threshold, threshold);
  }
  const good = Array.from({length: 500}, () => solve(9.99));
  const worse = [...good, ...Array.from({length: 500}, () => solve(10.5))];
  assert.equal(subStatus(worse).rusty, false); // equality is not more than one interval
  const rust = achievements(profile(worse), [...worse, solve(11)]);
  assert.equal(rust.rusty, true);
  assert.equal(rust.status.threshold, 10);
  const rustyData = [...good, ...Array.from({length: 500}, () => solve(11))];
  assert.equal(achievements(profile(rustyData), [...rustyData, solve(11)]).rusty, false);
  const recovered = [...rustyData, ...Array.from({length: 499}, () => solve(10.5))];
  assert.equal(achievements(profile(recovered), [...recovered, solve(10.5)]).recovered, true);
  assert.equal(achievements(profile(good), [...good, solve(9.98)]).special, null);
});

test('rust is anchored to the earned title, so a faster current 500 is never rusty', () => {
  const earned = Array.from({ length: 500 }, () => solve(14.8));
  const faster = [...earned, ...Array.from({ length: 500 }, () => solve(12))];
  const status = subStatus(faster);
  assert.equal(status.threshold, 15);
  assert.equal(status.rusty, false);
  assert.ok(Math.abs(status.current - 12) < 1e-9);
  assert.equal(status.step, .5);
  const sub20 = subStatus(Array.from({ length: 500 }, () => solve(19.8)));
  assert.equal(sub20.threshold, 20);
  assert.equal(sub20.step, 1); // 20 is outside the '<20s' band.
});
test('worst completed solve excludes DNF and includes +2', () => {
  const data = [solve(10), solve(12), solve(99, 'DNF')];
  assert.equal(achievements(profile(data), [...data, solve(12)]).worst, false);
  assert.equal(achievements(profile(data), [...data, solve(11, '+2')]).worst, true);
  assert.equal(achievements(profile(data), [...data, solve(20, 'DNF')]).worst, false);
});
test('inspection cue assets are complete and random selection avoids an immediate repeat', () => {
  assert.equal(inspectionCuePaths[8].length, 10);
  assert.equal(inspectionCuePaths[12].length, 10);
  assert.match(inspectionCuePaths[8][0], /inspection-eight-01\.mp3\?v=2$/);
  assert.match(inspectionCuePaths[12][9], /inspection-twelve-10\.mp3\?v=2$/);
  assert.notEqual(pickInspectionCue(8, 0, () => 0).index, 0);
  assert.notEqual(pickInspectionCue(12, 5, () => .5).index, 5);
  assert.equal(pickInspectionCue(9), null);
});

test('there are twelve levels, each with its own effect, and Sub 12 sits at level 7', () => {
  assert.equal(SPECIAL.length, 12);
  assert.equal(TITLE_EFFECT.length, 12);
  assert.equal(tier(12), 7);
  assert.equal(tier(5), 12);
  assert.equal(tier(null), 0);
  assert.deepEqual([...new Set(TITLE_EFFECT)], ['sunrise', 'aurora', 'warp', 'forge', 'singularity']);
});
test('every Animation Studio moment becomes a plan the engine knows how to play', () => {
  const known = new Set(['ripple', 'accident', 'shatter', 'settle', 'prism', 'breach', 'seal', 'sunrise', 'aurora', 'warp', 'forge', 'singularity', 'oxidation', 'polish', 'thud']);
  const expected = { single: 'shatter', average: 'settle', stack: 'prism', ordinary: 'ripple', 'barrier-down': 'breach', 'barrier-up': 'seal', worst: 'thud', accident: 'accident', recovery: 'polish' };
  const ids = demoGroups().flatMap(g => g.options.map(o => o[0]));
  assert.equal(ids.length, 9 + SPECIAL.length * 2);
  for (const id of ids) {
    const p = plan(demoEvent(id), () => 0);
    assert.ok(known.has(p.id), id);
    if (expected[id]) assert.equal(p.id, expected[id], id);
    if (id.startsWith('sub-')) { assert.equal(p.id, TITLE_EFFECT[tier(Number(id.slice(4))) - 1]); assert.equal(p.card.tier, tier(Number(id.slice(4)))); }
    if (id.startsWith('rust-')) { assert.equal(p.id, 'oxidation'); assert.equal(p.card.rusty, true); }
  }
});
test('solves under 2.5 seconds never earn a reward, even with a record or a title', () => {
  const event = { ...demoEvent('single'), time: MIN_REWARD_SOLVE - .01 };
  const p = plan(event, () => 0);
  assert.equal(p.id, 'accident');
  assert.equal(p.card.skin, 'muted');
  assert.equal(plan({ ...demoEvent('sub-5'), time: 1.2 }, () => 0).id, 'accident');
  assert.notEqual(plan({ ...event, time: MIN_REWARD_SOLVE }, () => 0).id, 'accident');
  assert.equal(plan({ records: [], time: 11 }, () => 0).id, 'ripple');
});
test('a single record shatters, several records combine, and card copy comes from the injected rng', () => {
  const rec = (label, value, improvement) => ({ label, value, improvement, window: [] });
  assert.equal(plan({ records: [rec('Single PB', 9, .5)], time: 9 }, () => 0).id, 'shatter');
  assert.equal(plan({ records: [rec('Single PB', 9, .5), rec('ao5 PB', 10, .2)], time: 9 }, () => 0).id, 'prism');
  const a = plan(demoEvent('worst'), () => 0).card.title, b = plan(demoEvent('worst'), () => .999).card.title;
  assert.notEqual(a, b);
});

test('every level wears its own card design, in the agreed order', () => {
  require('../assets/rank-cards.js');
  const { frame, FRAME } = globalThis.CTRank;
  assert.equal(FRAME.length, SPECIAL.length + 1);
  assert.equal(new Set(FRAME).size, FRAME.length);
  assert.deepEqual(SPECIAL.map((_, i) => frame(i + 1)), [2, 1, 3, 4, 8, 10, 7, 9, 6, 5, 11, 12]); // Breeze, Horizon, Bronze, Steel, Gold, Crystal, Obsidian, Forge, Neon, Aurora, Holographic, Supernova
  assert.equal(frame(0), 0);
  assert.equal(frame(tier(12)), 7); // Sub 12 is still obsidian
});
