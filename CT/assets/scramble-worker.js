// Kociemba two-phase solving stays off the UI thread. cubejs is MIT licensed.
importScripts("vendor/cube.js", "vendor/solve.js");
Cube.initSolver();
self.onmessage = () => {
  try {
    const target = Cube.random();
    const solution = target.solve();
    const algorithm = Cube.inverse(solution);
    // Verify the generated sequence reconstructs the exact chosen random state.
    if (new Cube().move(algorithm).asString() !== target.asString())
      throw new Error("Scramble verification failed.");
    self.postMessage({ algorithm });
  } catch (e) {
    self.postMessage({ error: e.message });
  }
};
