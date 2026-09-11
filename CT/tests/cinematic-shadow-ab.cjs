/* Does the shadow-map setting earn its keep at Cinematic? Capture the same cube
 * with the shadow map on and off across a few framings, measure the pixel delta,
 * and compose a contact sheet. */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.CT_PLAYWRIGHT || 'C:/Users/alejo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const root = path.resolve(__dirname, '..');
const output = path.join(__dirname, 'screenshots');
// pitch/yaw are the production orbit (CUBE_ORBITS.threeD); zoom varies the pull-back.
const FRAMINGS = [
  { label: 'production', pitch: -31.3, yaw: -43.324, zoom: 1.02 },
  { label: 'pulled-back', pitch: -31.3, yaw: -43.324, zoom: 0.62 },
  { label: 'top-down', pitch: -62, yaw: -43.324, zoom: 1.02 },
];

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

const fileToData = file => `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;

async function measure(page, withFile, withoutFile) {
  await page.setViewportSize({ width: 700, height: 700 });
  await page.setContent(`
    <style>img{width:350px;display:block}</style>
    <img id="a" src="${fileToData(withFile)}"><img id="b" src="${fileToData(withoutFile)}">
  `);
  await page.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
  return page.evaluate(() => {
    const grab = id => {
      const image = document.getElementById(id);
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      canvas.getContext('2d').drawImage(image, 0, 0);
      return canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    };
    const a = grab('a'), b = grab('b');
    let total = 0, overTwo = 0, overTwelve = 0, max = 0, changed = 0;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < a.data.length; i += 4) {
      const delta = Math.max(
        Math.abs(a.data[i] - b.data[i]),
        Math.abs(a.data[i + 1] - b.data[i + 1]),
        Math.abs(a.data[i + 2] - b.data[i + 2]),
      );
      total += delta;
      if (delta > 2) overTwo++;
      if (delta > 12) {
        overTwelve++;
        const pixel = i / 4, x = pixel % a.width, y = Math.floor(pixel / a.width);
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
      if (delta > max) max = delta;
    }
    const compared = a.data.length / 4;
    return {
      meanChannelDelta: +(total / compared).toFixed(3),
      percentOverTwo: +(100 * overTwo / compared).toFixed(3),
      percentOverTwelve: +(100 * overTwelve / compared).toFixed(3),
      maxChannelDelta: max,
      changedBox: Number.isFinite(minX) ? {
        x: +(minX / a.width).toFixed(3), y: +(minY / a.height).toFixed(3),
        width: +((maxX - minX) / a.width).toFixed(3), height: +((maxY - minY) / a.height).toFixed(3),
      } : null,
    };
  });
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 700, height: 700 }, deviceScaleFactor: 2 });
    const sheet = await browser.newPage({ viewport: { width: 1460, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.evaluate(async () => {
      const { RealisticCube } = await import('/assets/cube-realistic.js');
      window.cube = new RealisticCube(document.querySelector('#stage'), () => { throw Error('WebGL unavailable'); }, 'uv', 'cinematic', 'studioSmall08', false, 'black');
      cube.setPalette(Object.fromEntries(Object.entries(CT.FACES).map(([face, value]) => [face, value.color])));
      cube.draw(new CT.Cube().stickers);
      cube.orbit(-31.3, -43.324, 1.02);
    });
    await page.locator('canvas[data-logo="loaded"]').waitFor();
    await page.waitForFunction(() => Boolean(cube.scene.environment));
    await page.waitForTimeout(200);

    const results = [];
    const setShadows = (on) => page.evaluate(on => {
      cube.settings = { ...cube.settings, shadows: on };
      cube.renderer.shadowMap.enabled = on;
      cube.scene.traverse(object => {
        const materials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
        for (const material of materials) material.needsUpdate = true;
      });
      if (on) cube.renderer.shadowMap.needsUpdate = true;
      cube.render();
    }, on);
    for (const framing of FRAMINGS) {
      await page.evaluate(framing => cube.orbit(framing.pitch, framing.yaw, framing.zoom), framing);
      await setShadows(true);
      await page.waitForTimeout(140);
      const withFile = path.join(output, `cinematic-shadow-${framing.label}-with.png`);
      await page.locator('#stage').screenshot({ path: withFile });

      await setShadows(false);
      await page.waitForTimeout(120);
      const withoutFile = path.join(output, `cinematic-shadow-${framing.label}-without.png`);
      await page.locator('#stage').screenshot({ path: withoutFile });

      const delta = await measure(sheet, withFile, withoutFile);
      results.push({ framing, delta });
      console.log(`${framing.label.padEnd(12)} zoom ${framing.zoom}  mean ${delta.meanChannelDelta.toFixed(3)}  >2: ${delta.percentOverTwo}%  >12: ${delta.percentOverTwelve}%  max ${delta.maxChannelDelta}`);
    }

    const rows = results.map(({ framing, delta }) => `
      <section>
        <h2>${framing.label} · pitch ${framing.pitch} yaw ${framing.yaw} zoom ${framing.zoom}</h2>
        <p>mean ${delta.meanChannelDelta.toFixed(3)} · pixels &gt;2 ${delta.percentOverTwo}% · &gt;12 ${delta.percentOverTwelve}% · max ${delta.maxChannelDelta}${delta.changedBox ? ` · changed box x${delta.changedBox.x} y${delta.changedBox.y} w${delta.changedBox.width} h${delta.changedBox.height}` : ''}</p>
        <div class="pair">
          <figure><img src="${fileToData(path.join(output, `cinematic-shadow-${framing.label}-with.png`))}"><figcaption>shadow map on</figcaption></figure>
          <figure><img src="${fileToData(path.join(output, `cinematic-shadow-${framing.label}-without.png`))}"><figcaption>shadow map off</figcaption></figure>
        </div>
      </section>`).join('');
    await sheet.setViewportSize({ width: 1460, height: 900 });
    await sheet.setContent(`
      <style>
        * { box-sizing: border-box }
        body { margin: 0; background: #070a0b; color: #eef3f2; font: 14px Arial, sans-serif; padding: 18px }
        h2 { font-size: 15px; margin: 0 0 2px }
        p { margin: 0 0 10px; color: #9fb0b2 }
        section { margin-bottom: 22px }
        .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; max-width: 720px }
        figure { position: relative; margin: 0 }
        img { width: 100%; display: block; border: 1px solid #2c383a }
        figcaption { position: absolute; left: 8px; top: 8px; padding: 4px 10px; border-radius: 999px; background: #071012c9; border: 1px solid #ffffff26; font-size: 12px }
      </style>
      ${rows}
    `, { waitUntil: 'load' });
    await sheet.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
    await sheet.screenshot({ path: path.join(output, 'cinematic-shadow-comparison.png'), fullPage: true });

    if (errors.length) throw new Error('Browser errors: ' + errors.join(' | '));
    console.log('Wrote cinematic-shadow-comparison.png');
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
