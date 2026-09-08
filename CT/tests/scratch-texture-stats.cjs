/* Measures the plastic wear scans the way the shader consumes them, so the
 * remap thresholds can be chosen from the data instead of by eye. */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.CT_PLAYWRIGHT || 'C:/Users/alejo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + req.url.split('?')[0]);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', { '.png': 'image/png', '.jpg': 'image/jpeg' }[path.extname(file)] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/assets/plastic_0010_2k_9akcRm/plastic_0010_normal_opengl_2k.png`);
    const stats = await page.evaluate(async base => {
      const read = async url => {
        const image = new Image();
        image.src = url;
        await image.decode();
        const canvas = new OffscreenCanvas(image.width, image.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);
        return ctx.getImageData(0, 0, image.width, image.height).data;
      };
      const normal = await read(base + 'plastic_0010_normal_opengl_2k.png');
      const rough = await read(base + 'plastic_0010_roughness_2k.jpg');
      const color = await read(base + 'plastic_0010_color_2k.jpg');
      const pct = (values, p) => { values.sort((a, b) => a - b); return values[Math.floor(p * (values.length - 1))]; };
      const devR = [], devG = [], roughG = [], lum = [];
      for (let i = 0; i < normal.length; i += 16) {
        devR.push(Math.abs(normal[i] - 128));
        devG.push(Math.abs(normal[i + 1] - 128));
        roughG.push(rough[i + 1] / 255);
        lum.push((0.2126 * color[i] + 0.7152 * color[i + 1] + 0.0722 * color[i + 2]) / 255);
      }
      const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
      const max = a => a.reduce((m, v) => (v > m ? v : m), 0);
      return {
        normal: { meanDevR: mean(devR), p50: pct(devR, .5), p90: pct(devR, .9), p99: pct(devR, .99), max: max(devR), meanDevG: mean(devG), p99G: pct(devG, .99) },
        roughness: { mean: mean(roughG), p05: pct(roughG, .05), p50: pct(roughG, .5), p90: pct(roughG, .9), p99: pct(roughG, .99), max: max(roughG), above72: roughG.filter(v => v > .72).length / roughG.length, below08: roughG.filter(v => v < .08).length / roughG.length },
        color: { mean: mean(lum), p05: pct(lum, .05), p50: pct(lum, .5), p95: pct(lum, .95), p99: pct(lum, .99), max: max(lum), above50: lum.filter(v => v > .5).length / lum.length, above41: lum.filter(v => v > .41).length / lum.length },
      };
    }, `http://127.0.0.1:${server.address().port}/assets/plastic_0010_2k_9akcRm/`);
    console.log(JSON.stringify(stats, null, 2));
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
