const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const C = require("../assets/core.js");
function harness({ video = false } = {}) {
  let now = 0,
    serial = 0,
    saved = 0;
  const timeouts = new Map(),
    elements = new Map(),
    events = new Map(),
    recordingStarts = [];
  const node = (key) => {
    if (!elements.has(key))
      elements.set(key, {
        id: key.slice(1),
        open: false,
        innerHTML: "",
        textContent: "",
        classList: { toggle() {}, add() {}, remove() {} },
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
        play: () => Promise.resolve(),
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
    CTVirtual: require("../assets/virtual.js"),
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
  if (video) {
    const track = {
        readyState: "live",
        stop() { this.readyState = "ended"; },
        getSettings: () => ({ deviceId: "camera-1", width: 1280, height: 720, frameRate: 30 }),
        addEventListener() {},
      },
      stream = { getVideoTracks: () => [track], getTracks: () => [track] };
    ctx.navigator = {
      mediaDevices: {
        getUserMedia: async () => stream,
        enumerateDevices: async () => [{ kind: "videoinput", deviceId: "camera-1", label: "Test camera" }],
      },
      storage: { persist: async () => true },
    };
    ctx.Blob = globalThis.Blob;
    ctx.MediaRecorder = class FakeMediaRecorder {
      static isTypeSupported(type) { return type.startsWith("video/webm"); }
      constructor() { this.state = "inactive"; this.mimeType = "video/webm"; this.listeners = new Map(); }
      addEventListener(name, fn) { this.listeners.set(name, fn); }
      start() { this.state = "recording"; recordingStarts.push(now); }
      stop() { this.state = "inactive"; this.listeners.get("stop")?.(); }
    };
  }
  ctx.window = {
    addEventListener(name, fn) {
      events.set("window:" + name, fn);
    },
  };
  // CTU.html loads the environment manifest before app.js; the harness has to
  // do the same, or the appearance selector has no environments to list.
  vm.runInNewContext(fs.readFileSync(require.resolve("../assets/environments.js"), "utf8"), ctx);
  let source = fs.readFileSync(require.resolve("../assets/app.js"), "utf8");
  source = source.replace(
    /\binit\(\);\s*\}\)\(\);\s*$/,
    `render=()=>{};persist=()=>{onSaved();};takeScramble=()=>{currentScramble='F2';};toast=()=>{};openCategory=()=>{};
    state={categories:[{id:'test',name:'Test',solves:[]}],revision:0};pref.active='test';view='timer';
    globalThis.hooks={context(nextView,type){view=nextView;state.categories[0].type=type;},stubTraining(){finishTrainingAttempt=()=>{globalThis.hooks._trainingStopped=true;};},trainingStopped(){return Boolean(globalThis.hooks._trainingStopped);},beginHold,releaseHold,finishSolve,cancelTimer,bindTimerSurface,inspectionTick,timer,pref,solves,ensureCameraReady,videoCapture,setPending(v){scramblePending=v;},currentAlg(){return currentScramble;}};
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
  return { ...ctx.hooks, advance, events, node, saved: () => saved, recordingStarts };
}
test("Trainer completion is independent of virtual category selection, while physical recording rejects it", () => {
  const training = harness(); training.context("training", "virtual"); training.stubTraining(); training.timer.phase = "running"; training.finishSolve();
  assert.equal(training.trainingStopped(), true); assert.equal(training.saved(), 0);
  const physical = harness(); physical.context("timer", "virtual"); physical.timer.phase = "running"; physical.finishSolve();
  assert.equal(physical.saved(), 0); assert.equal(physical.solves().length, 0);
});
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
  assert.equal(h.timer.phase, "stopped");
  h.advance(1000);
  down();
  h.advance(350);
  up();
  assert.equal(h.timer.phase, "running");
});

test("inspection that runs past 17 seconds saves a DNF and is ready again", () => {
  const h = harness();
  h.pref.inspection = true;
  const alg = h.currentAlg();
  h.beginHold();
  assert.equal(h.timer.phase, "inspection");
  h.advance(16999);
  h.inspectionTick();
  assert.equal(h.solves().length, 0);
  h.advance(1);
  h.inspectionTick();
  assert.equal(h.solves().length, 1);
  assert.equal(h.solves()[0].penalty, "DNF");
  assert.equal(h.solves()[0].rawMs, 0);
  assert.equal(h.solves()[0].scramble, alg);
  assert.equal(h.timer.phase, "stopped");
  assert.equal(h.saved(), 1);
  h.releaseHold();
  assert.equal(h.solves().length, 1);
  h.advance(1000);
  h.beginHold();
  assert.equal(h.timer.phase, "inspection");
});

test("stopping a solve ignores an immediate second start", () => {
  const h = harness();
  h.beginHold();
  h.advance(350);
  h.releaseHold();
  assert.equal(h.timer.phase, "running");
  h.advance(1000);
  h.finishSolve();
  assert.equal(h.timer.phase, "stopped");

  h.beginHold();
  assert.equal(h.timer.phase, "stopped");
  h.advance(999);
  h.beginHold();
  assert.equal(h.timer.phase, "stopped");
  h.advance(1);
  h.beginHold();
  h.advance(350);
  h.releaseHold();
  assert.equal(h.timer.phase, "running");
});

test("a hold that outlives inspection cannot start a solve after the DNF", () => {
  const h = harness();
  h.pref.inspection = true;
  h.beginHold();
  h.advance(16800);
  h.beginHold();
  assert.equal(h.timer.phase, "holding");
  h.advance(200);
  h.inspectionTick();
  assert.equal(h.timer.phase, "stopped");
  h.advance(400);
  assert.equal(h.timer.phase, "stopped");
  h.releaseHold();
  assert.equal(h.timer.phase, "stopped");
  assert.equal(h.solves().length, 1);
  assert.equal(h.solves()[0].penalty, "DNF");
});

test("press-to-start runs on the press and stops on the next one", () => {
  const h = harness();
  h.pref.pressToStart = true;
  const alg = h.currentAlg();
  h.beginHold();
  assert.equal(h.timer.phase, "running");
  assert.equal(h.timer.blockedRelease, true);
  h.releaseHold();
  assert.equal(h.timer.phase, "running");
  assert.equal(h.timer.blockedRelease, false);
  h.advance(8420);
  h.beginHold();
  assert.equal(h.solves().length, 1);
  assert.equal(h.solves()[0].rawMs, 8420);
  assert.equal(h.solves()[0].scramble, alg);
  h.releaseHold();
  assert.equal(h.solves().length, 1);
});

test("press-to-start still takes inspection one press at a time", () => {
  const h = harness();
  h.pref.pressToStart = true;
  h.pref.inspection = true;
  h.beginHold();
  assert.equal(h.timer.phase, "inspection");
  h.releaseHold();
  assert.equal(h.timer.phase, "inspection");
  h.advance(15200);
  h.beginHold();
  assert.equal(h.timer.phase, "running");
  assert.equal(h.timer.penalty, "+2");
  h.releaseHold();
  h.advance(9000);
  h.finishSolve();
  assert.equal(h.solves()[0].penalty, "+2");
  assert.equal(h.solves()[0].rawMs, 9000);
});

test("video starts on initial keydown for hold mode and at inspection start", async () => {
  const hold = harness({ video: true });
  hold.pref.videoRecording = true;
  await hold.ensureCameraReady();
  hold.beginHold();
  assert.deepEqual(hold.recordingStarts, [0]);
  hold.advance(200);
  hold.releaseHold();
  assert.equal(hold.timer.phase, "idle");

  const inspection = harness({ video: true });
  inspection.pref.videoRecording = true;
  inspection.pref.inspection = true;
  await inspection.ensureCameraReady();
  inspection.beginHold();
  assert.equal(inspection.timer.phase, "inspection");
  assert.deepEqual(inspection.recordingStarts, [0]);
});

test("single-press mode defers video recording until the initiating release", async () => {
  const h = harness({ video: true });
  h.pref.videoRecording = true;
  h.pref.pressToStart = true;
  await h.ensureCameraReady();
  h.beginHold();
  assert.equal(h.timer.phase, "running");
  assert.deepEqual(h.recordingStarts, []);
  h.advance(37);
  h.releaseHold();
  assert.deepEqual(h.recordingStarts, [37]);
});
