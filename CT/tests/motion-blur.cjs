/* Local GPU visual review of the cinematic turn blur; writes screenshots only. */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.CT_PLAYWRIGHT || 'C:/Users/alejo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(__dirname, 'screenshots');
const server = http.createServer((req, res) => {
  if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  if (req.url === '/') {
    res.setHeader('Content-Type', 'text/html');
    res.end('<style>body{margin:0;background:#0c100d}#stage{width:420px;height:420px}canvas{display:block;width:100%;height:100%}</style><div id="stage"></div><script src="/assets/core.js"></script><script src="/assets/environments.js"></script>');
    return;
  }
  const url = req.url.split('?')[0];
  const file = path.resolve(root, '.' + url);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.png': 'image/png' })[path.extname(file)] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 420, height: 420 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.evaluate(async () => {
      const { RealisticCube } = await import('/assets/cube-realistic.js');
      window.cube = new RealisticCube(document.querySelector('#stage'), () => { throw Error('WebGL unavailable'); }, 'uv', 'cinematic', 'studioSmall08', false, 'black');
      cube.setPalette(Object.fromEntries(Object.entries(CT.FACES).map(([face, value]) => [face, value.color])));
      cube.draw(new CT.Cube().apply("x'").stickers);
      cube.orbit(-15, -20, 1);
    });
    await page.locator('canvas[data-logo="loaded"]').waitFor();
    await page.waitForFunction(() => Boolean(cube.scene.environment));
    // Mid-turn, twice: once as a still (no previous frame) and once with the
    // step a 60fps playback would have taken.
    const frame = async (label, previous) => {
      // The shutter is cleared as soon as the frame is on screen, so it has to
      // be read from inside the render it belongs to.
      const angle = await page.evaluate(previous => {
        const stickers = new CT.Cube().apply("R U F2 L D B").stickers;
        const spec = CT.moveSpec('R');
        cube.motionState = null;
        let shutter = 0;
        if (previous == null) { cube.draw(stickers, spec, 0.5); return shutter; }
        cube.draw(stickers, spec, previous);
        const render = cube.render.bind(cube);
        cube.render = function () { shutter = cube.postMaterial.uniforms.motionAngle.value; render(); };
        cube.draw(stickers, spec, 0.5);
        cube.render = render;
        return shutter;
      }, previous);
      const file = path.join(output, `motion-${label}.png`);
      await page.locator('#stage').screenshot({ path: file });
      return { angle, image: fs.readFileSync(file) };
    };
    const still = await frame('still', null);
    const moving = await frame('blurred', 0.42);
    assert.equal(still.angle, 0, 'A still frame carries no shutter');
    assert.ok(Math.abs(moving.angle) > 0.01, 'A stepped frame carries one');
    assert.ok(!still.image.equals(moving.image), 'The moving frame is not the still one');
    assert.deepEqual(errors, [], 'No shader or page errors');
    console.log('OK');
  } finally {
    await browser.close();
    server.close();
  }
})();
