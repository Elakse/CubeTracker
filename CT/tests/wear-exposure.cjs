/* Does turning wear on move a cap off its palette value?
 *
 * The exposure budget in docs/graphics-quality.md guarantees that a cap facing
 * the camera renders at or just below the colour the palette asked for. Wear
 * changes roughness, and roughness changes where the specular lobe puts its
 * energy, so the guarantee has to be re-checked rather than assumed: the whole
 * point of the budget is that it is measured.
 *
 * This renders one solved face straight at the camera, per model, with wear off
 * and on, and reports the mean linear luminance of the cap interiors. Never
 * loads or writes the solve library. */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.CT_PLAYWRIGHT || 'C:/Users/alejo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const MODELS = (process.env.WEAR_MODELS || 'tiles,stickers,speedcube,uv').split(',');
const QUALITY = process.env.WEAR_QUALITY || 'high';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.hdr': 'application/octet-stream' };
const server = http.createServer((req, res) => {
  if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  if (req.url === '/') {
    res.setHeader('Content-Type', 'text/html');
    res.end('<style>body{margin:0;background:#fff}#stage{width:700px;height:700px}canvas{display:block;width:100%;height:100%}</style><div id="stage"></div><script src="/assets/core.js"></script><script src="/assets/environments.js"></script>');
    return;
  }
  const file = path.resolve(root, '.' + req.url.split('?')[0]);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({
    executablePath: process.env.CT_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    args: process.env.CT_SOFTWARE_GL ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [],
  });
  let worst = 0;
  try {
    const page = await browser.newPage({ viewport: { width: 700, height: 700 }, deviceScaleFactor: 1 });
    page.setDefaultTimeout(180000);
    page.on('pageerror', error => console.error('PAGE ERROR', error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    for (const model of MODELS) {
      const reading = {};
      for (const wear of [false, true]) {
        await page.evaluate(async ({ model, quality, wear }) => {
          document.querySelector('#stage').replaceChildren();
          const { RealisticCube } = await import('/assets/cube-realistic.js?v=' + Date.now());
          window.cube?.destroy?.();
          window.cube = new RealisticCube(document.querySelector('#stage'), () => { throw Error('WebGL unavailable'); }, model, quality, 'studio', wear);
          cube.setPalette({ U: '#fafcff', R: '#eb3046', F: '#16bd6b', D: '#ffdb19', L: '#ff821c', B: '#2474ef' });
          cube.draw(new CT.Cube().stickers);
          cube.orbit(0, 0, 1);
        }, { model, quality: QUALITY, wear });
        if (wear) await page.locator('canvas[data-wear="loaded"]').waitFor({ timeout: 60000 });
        await page.waitForTimeout(400);
        const shot = await page.locator('#stage').screenshot();
        reading[wear ? 'wear' : 'clean'] = await page.evaluate(async source => {
          const image = new Image();
          image.src = 'data:image/png;base64,' + source;
          await image.decode();
          const canvas = new OffscreenCanvas(image.width, image.height);
          const ctx = canvas.getContext('2d');
          ctx.drawImage(image, 0, 0);
          const { data, width, height } = ctx.getImageData(0, 0, image.width, image.height);
          // The middle third of the frame is the centre cap of the face turned
          // at the camera: the one the budget is written about.
          const linear = v => (v /= 255) <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
          let sum = 0, count = 0;
          for (let y = height * .40; y < height * .60; y++) for (let x = width * .40; x < width * .60; x++) {
            const i = ((y | 0) * width + (x | 0)) * 4;
            sum += .2126 * linear(data[i]) + .7152 * linear(data[i + 1]) + .0722 * linear(data[i + 2]);
            count++;
          }
          return sum / count;
        }, shot.toString('base64'));
      }
      const drift = (reading.wear - reading.clean) / reading.clean;
      worst = Math.max(worst, Math.abs(drift));
      console.log(`${model.padEnd(10)} clean ${reading.clean.toFixed(4)}  wear ${reading.wear.toFixed(4)}  drift ${(drift * 100).toFixed(2)}%`);
    }
    await page.close();
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
  // The line is set by the headroom the budget already has, not by taste. A
  // clean cap facing the camera lands at .88 to .92 of its palette value, so
  // there is eight to twelve percent of room under the guarantee; four percent
  // is half of the tightest of those. Wear lifts a cap rather than darkening
  // it — a scratch's raised lip catches the key on more facets than its groove
  // hides from it, and a rougher surface scatters more of a broad environment
  // back at the viewer — which is the direction that eats headroom, so it is
  // the one worth gating.
  console.log(`worst drift ${(worst * 100).toFixed(2)}%`);
  if (worst > 0.04) { console.error('FAIL: wear moved a cap off its calibrated value'); process.exitCode = 1; }
})().catch(error => { console.error(error); process.exitCode = 1; });
