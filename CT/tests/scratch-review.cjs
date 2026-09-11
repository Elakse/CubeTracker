/* Scratch visibility review: renders each model with and without the wear
 * scans (blocked through the built-in unavailable fallback), screenshots close
 * views, and reports pixel statistics plus an amplified difference sheet so a
 * too-subtle normal map cannot hide. Never loads or writes the solve library. */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.CT_PLAYWRIGHT || 'C:/Users/alejo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(__dirname, 'screenshots');
const MODELS = (process.env.SCRATCH_MODELS || 'tiles,stickers,speedcube,uv').split(',');
const QUALITY = process.env.SCRATCH_QUALITY || 'high';
const DSF = Number(process.env.CT_DSF || 2);
const VIEWS = [
  ['hero', -25, -42, 1, "x'"],
  ['front', -25, 0, 1, "x'"],
  ['close', -25, 0, 2.7, "x'"],
  ['close-angled', -25, 26, 2.7, "R U R' F2 D L2 B"],
  ['top-graze', 38, -22, 2.4, "x'"],
];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.hdr': 'application/octet-stream' };
const server = http.createServer((req, res) => {
  if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  if (req.url === '/') {
    res.setHeader('Content-Type', 'text/html');
    res.end('<style>body{margin:0;background:#fff}#stage{width:800px;height:800px}canvas{display:block;width:100%;height:100%}</style><div id="stage"></div><script src="/assets/core.js"></script><script src="/assets/environments.js"></script>');
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
    // A container has no GPU. SwiftShader renders the same scene in software,
    // which is slower but produces the same pixels the tuning is judged on.
    args: process.env.CT_SOFTWARE_GL ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [],
  });
  const shots = {};
  try {
    for (const blocked of [false, true]) {
      const page = await browser.newPage({ viewport: { width: 800, height: 800 }, deviceScaleFactor: DSF });
      page.setDefaultTimeout(180000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

      await page.goto(`http://127.0.0.1:${server.address().port}`);
      for (const model of MODELS) {
        await page.evaluate(async ({ model, quality, wear }) => {
          document.querySelector('#stage').replaceChildren();
          const { RealisticCube } = await import('/assets/cube-realistic.js?v=' + Date.now());
          window.cube?.destroy?.();
          window.cube = new RealisticCube(document.querySelector('#stage'), () => { throw Error('WebGL unavailable'); }, model, quality, 'studio', wear);
          cube.setPalette({ U: '#fafcff', R: '#eb3046', F: '#16bd6b', D: '#ffdb19', L: '#ff821c', B: '#2474ef' });
        }, { model, quality: QUALITY, wear: !blocked });
        if (!blocked) {
          await page.locator('canvas[data-wear="loaded"]').waitFor({ timeout: 20000 });
          if (model === 'stickers') await page.locator('canvas[data-wear-sticker="loaded"]').waitFor({ timeout: 20000 });
          if (model === 'stickers') {
            const outlines = await page.evaluate(() => new Set(cube.faces.map(face => {
              const uv = face.geometry.getAttribute('uv1');
              return `${Math.floor(uv.getX(uv.count - 1) * 8)},${Math.floor(uv.getY(uv.count - 1) * 8)}`;
            })).size);
            if (outlines !== 54) throw Error(`Expected 54 unique sticker outlines, got ${outlines}`);
          }
        }
        if (model === 'speedcube' || model === 'uv') await page.locator('canvas[data-logo="loaded"]').waitFor({ timeout: 20000 });
        console.log(blocked ? 'clean' : 'wear', model, await page.evaluate(() => {
          const material = cube.faceMaterials.U;
          return JSON.stringify({
            roughness: +material.roughness.toFixed(4),
            roughMap: material.roughnessMap?.name ?? 'none',
            normal: material.normalMap?.name ?? (material.bumpMap ? 'grain bump' : 'none'),
            normalScale: material.normalScale ? [material.normalScale.x, material.normalScale.y] : null,
            coatNormal: material.clearcoatNormalMap?.name ?? 'none',
            alpha: material.alphaMap?.name ?? 'none',
            alphaUv: material.alphaMap?.channel ?? null,
            alphaTest: material.alphaTest,
          });
        }));
        for (const [name, pitch, yaw, zoom, moves] of VIEWS) {
          await page.evaluate(({ pitch, yaw, zoom, moves }) => {
            cube.draw(new CT.Cube().apply(moves).stickers);
            cube.orbit(pitch, yaw, zoom);
          }, { pitch, yaw, zoom, moves });
          await page.waitForTimeout(140);
          const file = `scratch-${blocked ? 'clean' : 'wear'}-${model}-${name}.png`;
          await page.screenshot({ path: path.join(output, file) });
          shots[`${model}/${name}`] = shots[`${model}/${name}`] || {};
          shots[`${model}/${name}`][blocked ? 'clean' : 'wear'] = file;
        }
        // The size the wearer actually sees: the dialog carousel cube is about
        // 360 CSS px, so judge readability there too, not only in close-ups.
        await page.evaluate(() => {
          Object.assign(document.querySelector('#stage').style, { width: '360px', height: '360px' });
          cube.draw(new CT.Cube().apply("x'").stickers);
          cube.orbit(-25, -42, 1);
        });
        await page.waitForTimeout(140);
        const dialogFile = `scratch-${blocked ? 'clean' : 'wear'}-${model}-dialog.png`;
        await page.locator('#stage').screenshot({ path: path.join(output, dialogFile) });
        shots[`${model}/dialog`] = shots[`${model}/dialog`] || {};
        shots[`${model}/dialog`][blocked ? 'clean' : 'wear'] = dialogFile;
        await page.evaluate(() => Object.assign(document.querySelector('#stage').style, { width: '800px', height: '800px' }));
        await page.evaluate(() => cube.destroy());
      }
      if (errors.length) throw Error(`PAGE ERRORS ${blocked ? '(clean)' : '(wear)'}: ${errors.join('; ')}`);
      await page.close();
    }
    // Difference statistics and an amplified side-by-side sheet per view.
    const page = await browser.newPage({ viewport: { width: 1500, height: 560 }, deviceScaleFactor: 1 });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    for (const model of MODELS) {
      for (const view of [...VIEWS.map(v => v[0]), 'dialog']) {
        const pair = shots[`${model}/${view}`];
        const stats = await page.evaluate(async ({ wear, clean }) => {
          const load = async name => {
            const image = new Image();
            image.src = 'data:image/png;base64,' + name;
            await image.decode();
            const canvas = new OffscreenCanvas(image.width, image.height);
            canvas.getContext('2d').drawImage(image, 0, 0);
            return { image, data: canvas.getContext('2d').getImageData(0, 0, image.width, image.height).data, width: image.width, height: image.height };
          };
          const a = await load(wear), b = await load(clean);
          let sum = 0, count = 0, strong = 0, visible = 0, max = 0;
          const histogram = new Array(9).fill(0);
          for (let i = 0; i < a.data.length; i += 4) {
            // Only measure the cube: skip pixels that are the white backdrop in both.
            if (a.data[i] > 250 && a.data[i + 1] > 250 && a.data[i + 2] > 250 && b.data[i] > 250 && b.data[i + 1] > 250 && b.data[i + 2] > 250) continue;
            const d = Math.max(Math.abs(a.data[i] - b.data[i]), Math.abs(a.data[i + 1] - b.data[i + 1]), Math.abs(a.data[i + 2] - b.data[i + 2]));
            sum += d; count++; max = Math.max(max, d);
            histogram[Math.min(8, d >> 2)]++;
            if (d > 4) visible++;
            if (d > 12) strong++;
          }
          return { mean: sum / count, share: visible / count, strong: strong / count, max, histogram: histogram.map(h => h / count) };
        }, { wear: fs.readFileSync(path.join(output, pair.wear)).toString('base64'), clean: fs.readFileSync(path.join(output, pair.clean)).toString('base64') });
        console.log(`${model}/${view}: mean|Δ|=${stats.mean.toFixed(2)} px>4=${(stats.share * 100).toFixed(1)}% px>12=${(stats.strong * 100).toFixed(1)}% max=${stats.max} hist=${stats.histogram.map(h => (h * 100).toFixed(1)).join(',')}`);
      }
      // One sheet per model: the closest view, wear | clean | difference x10.
      const pair = shots[`${model}/close`];
      const sheet = await page.evaluate(async ({ wear, clean }) => {
        const load = async source => { const image = new Image(); image.src = 'data:image/png;base64,' + source; await image.decode(); return image; };
        const a = await load(wear), b = await load(clean);
        const cell = 500, canvas = new OffscreenCanvas(cell * 3, cell), ctx = canvas.getContext('2d');
        ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        for (const [image, index] of [[a, 0], [b, 1]]) {
          const scale = Math.min(cell / image.width, cell / image.height);
          ctx.drawImage(image, index * cell + (cell - image.width * scale) / 2, (cell - image.height * scale) / 2, image.width * scale, image.height * scale);
        }
        // The difference cell is a native-resolution center crop: scaling the
        // full frame down would average away the very hairlines we measure.
        const sx = (a.width - cell) >> 1, sy = (a.height - cell) >> 1;
        const crop = image => { const source = new OffscreenCanvas(cell, cell); source.getContext('2d').drawImage(image, -sx, -sy); return source.getContext('2d').getImageData(0, 0, cell, cell); };
        const da = crop(a), db = crop(b);
        const diff = ctx.createImageData(cell, cell);
        for (let i = 0; i < da.data.length; i += 4) {
          const d = Math.min(255, Math.max(Math.abs(da.data[i] - db.data[i]), Math.abs(da.data[i + 1] - db.data[i + 1]), Math.abs(da.data[i + 2] - db.data[i + 2])) * 10);
          diff.data[i] = diff.data[i + 1] = diff.data[i + 2] = d; diff.data[i + 3] = 255;
        }
        ctx.putImageData(diff, cell * 2, 0);
        const blob = await canvas.convertToBlob();
        return new Uint8Array(await blob.arrayBuffer());
      }, { wear: fs.readFileSync(path.join(output, pair.wear)).toString('base64'), clean: fs.readFileSync(path.join(output, pair.clean)).toString('base64') });
      fs.writeFileSync(path.join(output, `scratch-diff-${model}.png`), Buffer.from(sheet));
      console.log(`sheet written: scratch-diff-${model}.png (wear | clean | diff x10)`);
    }
    await page.close();
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
