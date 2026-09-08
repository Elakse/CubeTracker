const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const C = require("../assets/core.js");
function harness() {
  let now = 0,
    serial = 0,
    saved = 0;
  const timeouts = new Map(),
    elements = new Map(),
    events = new Map();
  const node = (key) => {
    if (!elements.has(key))
      elements.set(key, {
        id: key.slice(1),
        open: false,
        innerHTML: "",
        textContent: "",
        classList: { toggle() {} },
        setAttribute() {},
        addEventListener(name, fn) {
          events.set(key + ":" + name, fn);
        },
        setPointerCapture() {},
        focus() {},
        closest() {
          return null;
        },
        querySelector: () => null,
        querySelectorAll: () => [],
        dataset: {},
      });
    return elements.get(key);
  };
  const document = {
    querySelector: node,
    querySelectorAll: () => [],
    body: node("body"),
    documentElement: node("html"),
    addEventListener(name, fn) {
      events.set(name, fn);
    },
  };
  const ctx = {
    CT: C,
    crypto: globalThis.crypto,
    document,
    matchMedia: () => ({ matches: true, addEventListener() {} }),
    localStorage: { getItem: () => null, setItem() {} },
    performance: { now: () => now },
    Date,
    console,
    history: { replaceState() {} },
    location: { protocol: "file:", hash: "" },
    requestAnimationFrame: () => ++serial,
    cancelAnimationFrame() {},
    setTimeout(fn, ms) {
      const id = ++serial;
      timeouts.set(id, { fn, at: now + ms });
      return id;
    },
    clearTimeout(id) {
      timeouts.delete(id);
    },
  };
  ctx.window = {
    addEventListener(name, fn) {
      events.set("window:" + name, fn);
    },
  };
  let source = fs.readFileSync(require.resolve("../assets/app.js"), "utf8");
  source = source.replace(
    /\binit\(\);\s*\}\)\(\);\s*$/,
    `render=()=>{};persist=()=>{onSaved();};takeScramble=()=>{currentScramble='F2';};toast=()=>{};openCategory=()=>{};
    state={categories:[{id:'test',name:'Test',solves:[]}],revision:0};pref.active='test';view='timer';
    globalThis.hooks={beginHold,releaseHold,finishSolve,cancelTimer,bindTimerSurface,timer,pref,solves,setPending(v){scramblePending=v;},currentAlg(){return currentScramble;}};
  })();`,
  );
  ctx.onSaved = () => saved++;
  vm.runInNewContext(source, ctx);
  const advance = (ms) => {
    now += ms;
    for (const [id, t] of [...timeouts])
      if (t.at <= now) {
        timeouts.delete(id);
        t.fn();
      }
  };
  return { ...ctx.hooks, advance, events, node, saved: () => saved };
}
test("hold-to-start rejects a short hold and records exactly once with the original scramble", () => {
  const h = harness(),
    alg = h.currentAlg();
  h.beginHold();
  h.advance(200);
  h.releaseHold();
  assert.equal(h.timer.phase, "idle");
  assert.equal(h.solves().length, 0);
  h.beginHold();
  h.advance(350);
  assert.equal(h.timer.phase, "ready");
  h.releaseHold();
  assert.equal(h.timer.phase, "running");
  h.advance(12340);
  h.finishSolve();
  h.finishSolve();
  assert.equal(h.solves().length, 1);
  assert.equal(h.solves()[0].rawMs, 12340);
  assert.equal(h.solves()[0].scramble, alg);
  assert.equal(h.saved(), 1);
});
test("inspection evaluates 15s and 17s boundaries at actual release", () => {
  for (const [elapsed, penalty] of [
    [14990, ""],
    [15000, "+2"],
    [16990, "+2"],
    [17000, "DNF"],
  ]) {
    const h = harness();
    h.pref.inspection = true;
    h.beginHold();
    assert.equal(h.timer.phase, "inspection");
    h.advance(elapsed - 350);
    h.beginHold();
    h.advance(350);
    h.releaseHold();
    assert.equal(h.timer.penalty, penalty);
    h.advance(10000);
    h.finishSolve();
    assert.equal(h.solves()[0].penalty, penalty);
    assert.equal(h.solves()[0].rawMs, 10000);
  }
});
test("inspection starts on a press without the ready hold", () => {
  const h = harness();
  h.pref.inspection = true;
  h.beginHold();
  assert.equal(h.timer.phase, "inspection");
  h.advance(200);
  h.releaseHold();
  assert.equal(h.timer.phase, "inspection");
  h.beginHold();
  h.advance(349);
  assert.equal(h.timer.phase, "holding");
  h.advance(1);
  assert.equal(h.timer.phase, "ready");
  h.releaseHold();
  assert.equal(h.timer.phase, "running");
});
test("cancel, lost focus and pending scramble never record an accidental attempt", () => {
  const h = harness();
  h.setPending(true);
  h.beginHold();
  assert.equal(h.timer.phase, "idle");
  h.setPending(false);
  h.beginHold();
  h.advance(350);
  h.events.get("window:blur")();
  assert.equal(h.timer.phase, "idle");
  h.releaseHold();
  assert.equal(h.solves().length, 0);
  h.beginHold();
  h.advance(350);
  h.releaseHold();
  h.advance(600);
  h.cancelTimer();
  assert.equal(h.solves().length, 0);
  assert.equal(h.timer.phase, "idle");
});
test("touch stop consumes its release and the next hold starts normally", () => {
  const h = harness();
  h.bindTimerSurface();
  const down = () =>
      h.events.get("#timer-surface:pointerdown")({
        button: 0,
        pointerId: 1,
        preventDefault() {},
      }),
    up = () => h.events.get("pointerup")();
  down();
  h.advance(350);
  up();
  assert.equal(h.timer.phase, "running");
  h.advance(5000);
  down();
  up();
  assert.equal(h.solves().length, 1);
  assert.equal(h.timer.blockedRelease, false);
  down();
  h.advance(350);
  up();
  assert.equal(h.timer.phase, "running");
});
