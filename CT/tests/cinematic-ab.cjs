/* Reproducible A/B capture for the production Cinematic renderer. */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.CT_PLAYWRIGHT || 'C:/Users/alejo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const root = path.resolve(__dirname, '..');
const output = path.join(__dirname, 'screenshots');
const label = process.env.CT_AB_LABEL || 'after';
assert.match(label, /^[a-z0-9-]+$/, 'CT_AB_LABEL must be filename-safe');

const server = http.createServer((req, res) => {
  if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  if (req.url === '/') {
    res.setHeader('Content-Type', 'text/html');
    res.end(`
      <style>
        * { box-sizing: border-box }
        html, body { width: 100%; height: 100%; margin: 0 }
        body { background: radial-gradient(circle at 48% 38%, #263034 0, #111719 58%, #090d0e 100%) }
        #stage { position: absolute; inset: 0; overflow: hidden }
        canvas { display: block; width: 100%; height: 100% }
      </style>
      <div id="stage"></div>
      <script src="/assets/core.js"></script>
      <script src="/assets/environments.js"></script>
    `);
    return;
  }
  const url = req.url.split('?')[0];
  const file = path.resolve(root, '.' + url);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.png': 'image/png', '.hdr': 'application/octet-stream' })[path.extname(file)] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});

async function compose(page, kind) {
  const before = path.join(output, `cinematic-ab-before-${kind}.png`);
  const after = path.join(output, `cinematic-ab-after-${kind}.png`);
  if (!fs.existsSync(before) || !fs.existsSync(after)) return;
  const image = file => `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;
  await page.setViewportSize({ width: 1400, height: 700 });
  await page.setContent(`
    <style>
      * { box-sizing: border-box }
      body { margin: 0; background: #070a0b; color: #eef3f2; font: 15px Arial, sans-serif }
      main { display: grid; grid-template-columns: 1fr 1fr; height: 700px }
      figure { position: relative; margin: 0; overflow: hidden }
      figure + figure { border-left: 1px solid #435052 }
      img { width: 100%; height: 100%; display: block; object-fit: cover }
      figcaption { position: absolute; top: 20px; left: 22px; padding: 8px 12px; border: 1px solid #ffffff26; border-radius: 999px; background: #071012c9; backdrop-filter: blur(10px); letter-spacing: .02em }
    </style>
    <main>
      <figure><img src="${image(before)}"><figcaption>Actual</figcaption></figure>
      <figure><img src="${image(after)}"><figcaption>Optimizado</figcaption></figure>
    </main>
  `);
  await page.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
  const difference = await page.locator('img').evaluateAll(images => {
    const canvases = images.map(image => {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      canvas.getContext('2d').drawImage(image, 0, 0);
      return canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    });
    let total = 0, compared = 0, overOne = 0;
    for (let i = 0; i < canvases[0].length; i += 4) for (let channel = 0; channel < 3; channel++) {
      const delta = Math.abs(canvases[0][i + channel] - canvases[1][i + channel]);
      total += delta;
      compared++;
      if (delta > 1) overOne++;
    }
    return { meanChannelDelta: total / compared, channelsOverOne: overOne / compared };
  });
  await page.screenshot({ path: path.join(output, `cinematic-ab-${kind}.png`) });
  return difference;
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 700, height: 700 }, deviceScaleFactor: 2 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.evaluate(async () => {
      const { RealisticCube } = await import('/assets/cube-realistic.js');
      window.cube = new RealisticCube(
        document.querySelector('#stage'),
        () => { throw Error('WebGL unavailable'); },
        'uv',
        'cinematic',
        'studioSmall08',
        false,
        'black',
      );
      cube.setPalette(Object.fromEntries(Object.entries(CT.FACES).map(([face, value]) => [face, value.color])));
      cube.draw(new CT.Cube().stickers);
      cube.orbit(-31.3, -43.324, 1.02);
    });
    await page.locator('canvas[data-logo="loaded"]').waitFor();
    await page.waitForFunction(() => Boolean(cube.scene.environment));
    const calibration = await page.evaluate(() => ({
      live: cube.tuning,
      hardcoded: CT_ENVIRONMENTS.TUNING.studioSmall08.uv,
    }));
    assert.ok(
      Object.entries(calibration.hardcoded).every(([key, value]) => calibration.live[key] === value),
      'A/B uses the production Studio small 08 UV calibration',
    );
    await page.waitForTimeout(120);
    await page.locator('#stage').screenshot({ path: path.join(output, `cinematic-ab-${label}-hero.png`) });

    await page.evaluate(() => {
      const stickers = new CT.Cube().stickers;
      const move = CT.moveSpec('R');
      cube.setAnimationActive(true);
      cube.draw(stickers, move, .34);
      cube.draw(stickers, move, .52);
    });
    await page.locator('#stage').screenshot({ path: path.join(output, `cinematic-ab-${label}-motion.png`) });
    assert.deepEqual(errors, [], 'Cinematic A/B renders without browser or shader errors');
    await page.evaluate(() => cube.destroy());
    assert.equal(await page.locator('canvas').count(), 0, 'A/B releases its WebGL renderer');

    if (label === 'after') {
      const hero = await compose(page, 'hero');
      const motion = await compose(page, 'motion');
      console.log('A/B pixel deltas:', { hero, motion });
    }
    console.log(`Cinematic ${label}: UV Speedcube / Studio small 08 captured.`);
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
