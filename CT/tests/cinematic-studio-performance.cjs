/* Diagnostic benchmark for the full-screen Lighting Studio interaction path. */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.CT_PLAYWRIGHT || 'C:/Users/alejo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  if (req.url === '/') {
    res.setHeader('Content-Type', 'text/html');
    res.end('<style>*{box-sizing:border-box}html,body,#stage{width:100%;height:100%;margin:0}canvas{display:block;width:100%;height:100%}</style><div id="stage"></div><script src="/assets/core.js"></script><script src="/assets/environments.js"></script>');
    return;
  }
  const file = path.resolve(root, '.' + req.url.split('?')[0]);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', path.extname(file) === '.js' ? 'text/javascript' : 'application/octet-stream');
  res.end(fs.readFileSync(file));
});

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const width = Number(process.env.CT_STUDIO_WIDTH) || 1450;
    const height = Number(process.env.CT_STUDIO_HEIGHT) || 900;
    const deviceScaleFactor = Number(process.env.CT_STUDIO_DPR) || 1;
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const result = await page.evaluate(async () => {
      const { RealisticCube } = await import('/assets/cube-realistic.js');
      const make = async quality => {
        const stage = document.querySelector('#stage');
        const cube = new RealisticCube(stage, () => { throw Error('WebGL unavailable'); }, 'uv', quality, 'studioSmall08', false, 'black');
        cube.setPalette(Object.fromEntries(Object.entries(CT.FACES).map(([face, value]) => [face, value.color])));
        cube.draw(new CT.Cube().stickers);
        while (!cube.scene.environment) await new Promise(requestAnimationFrame);
        cube.setInteractionActive(true);
        cube.orbit(-25, -42, 1);
        cube.renderer.getContext().finish();
        return cube;
      };
      const sample = (cube, frames = 20) => {
        const times = [];
        for (let i = 0; i < frames; i++) {
          const started = performance.now();
          cube.orbit(-25 + Math.sin(i) * 4, -42 + i * 2, 1);
          cube.renderer.getContext().finish();
          times.push(performance.now() - started);
        }
        times.sort((a, b) => a - b);
        return { median: times[times.length >> 1], p90: times[Math.floor(times.length * .9)], average: times.reduce((a, b) => a + b, 0) / times.length };
      };
      const cinematic = await make('cinematic');
      const interactionTarget = { width: cinematic.target.width, height: cinematic.target.height };
      const full = sample(cinematic);
      const liveHalation = cinematic.renderHalation.bind(cinematic);
      cinematic.renderHalation = () => {};
      const noHalation = sample(cinematic);
      cinematic.renderHalation = liveHalation;
      cinematic.setInteractionActive(false);
      const stillTarget = { width: cinematic.target.width, height: cinematic.target.height };
      cinematic.destroy();
      const ultra = await make('ultra');
      const ultraResult = sample(ultra);
      ultra.destroy();
      return { interactionTarget, stillTarget, full, noHalation, ultra: ultraResult };
    });
    assert.ok(result.interactionTarget.width * result.interactionTarget.height <= 901_000, 'Studio interaction stays inside its Cinematic pixel budget');
    assert.ok(result.stillTarget.width * result.stillTarget.height <= 4_001_000, 'Studio still stays inside its Cinematic pixel budget');
    console.log(JSON.stringify({ viewport: { width, height, deviceScaleFactor }, ...result }, null, 2));
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
