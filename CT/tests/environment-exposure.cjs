/* Renders every environment and measures the cube, so "not overexposed" is a
   number rather than an impression. `mean` is the average luminance of the cube
   pixels; `clipped` is the share of them with a channel at or above .985, which
   is what a colour cast does before it ever looks bright. */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.CT_PLAYWRIGHT || 'C:/Users/alejo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const library = { version: 1, revision: 0, categories: [{ id: 'env-test', name: 'Practice', solves: [] }] };
const server = http.createServer((req, res) => {
  if (req.url === '/api/library') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(library)); return; }
  const file = path.resolve(root, '.' + (req.url === '/' ? '/CTU.html' : req.url.split('?')[0]));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' })[path.extname(file)] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});
const ids = Object.keys(new Function('window', fs.readFileSync(path.join(root, 'assets/environments.js'), 'utf8') + '; return window.CT_ENVIRONMENTS;')({}).ENVIRONMENTS);
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const errors = [];
  try {
    console.log('environment      mean   clipped');
    for (const id of ids) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      page.on('pageerror', e => errors.push(`${id}: ${e.message}`));
      await page.route('**/api/library', route => route.fulfill({ json: library }));
      await page.addInitScript(env => {
        window.Worker = undefined;
        localStorage.setItem('cubetracker.preferences.v2', JSON.stringify({
          version: 2, theme: 'light', scrambleAnimation: false, active: 'env-test',
          cubeMode: '3d', cubeQuality: 'balanced', cubeFinish: 'standard',
          cubePalette: 'classic', cubeEnvironment: env,
        }));
      }, id);
      await page.goto(`${base}/#timer`);
      await page.waitForSelector('.cube-studio-canvas', { timeout: 20000 });
      await page.waitForTimeout(2500);
      const shot = await page.locator('.cube-studio-canvas').first().screenshot();
      fs.writeFileSync(path.join(__dirname, 'screenshots', `environment-${id}.png`), shot);
      const stats = await page.evaluate(() => {
        const c = document.querySelector('.cube-studio-canvas');
        const off = document.createElement('canvas');
        off.width = c.width; off.height = c.height;
        off.getContext('2d').drawImage(c, 0, 0);
        const d = off.getContext('2d').getImageData(0, 0, off.width, off.height).data;
        let n = 0, sum = 0, clipped = 0;
        for (let i = 0; i < d.length; i += 4) {
          if (d[i + 3] < 200) continue;             // transparent surround is not the cube
          const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
          const L = .2126 * r + .7152 * g + .0722 * b;
          if (L < .04) continue;                     // recessed internals are not a cap
          n++; sum += L;
          if (Math.max(r, g, b) >= .985) clipped++;
        }
        return n ? { mean: sum / n, clipped: clipped / n } : null;
      });
      console.log(`${id.padEnd(14)} ${stats ? stats.mean.toFixed(3) : ' n/a '}   ${stats ? (stats.clipped * 100).toFixed(1) + '%' : ''}`);
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  if (errors.length) { console.error('PAGE ERRORS:', errors); process.exit(1); }
})();
