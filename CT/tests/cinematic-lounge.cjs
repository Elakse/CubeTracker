/* Local GPU visual review; never loads or writes the solve library. */
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
    res.end('<style>body{margin:0;background:#fff}#stage{width:640px;height:640px}canvas{display:block;width:100%;height:100%}</style><div id="stage"></div><script src="/assets/core.js"></script><script src="/assets/environments.js"></script>');
    return;
  }
  const url = req.url.split('?')[0];
  const file = path.resolve(root, '.' + (url === '/assets/cube-uv-before.js' ? '/backups/cube-realistic.pre-uv-refinement.js' : url));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.png': 'image/png' })[path.extname(file)] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 640, height: 640 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const before = process.env.UV_BEFORE === '1';
    const quality = 'cinematic';
    await page.evaluate(async ({ before, quality }) => {
      const { RealisticCube } = await import(before ? '/assets/cube-uv-before.js' : '/assets/cube-realistic.js');
      window.cube = new RealisticCube(document.querySelector('#stage'), () => { throw Error('WebGL unavailable'); }, 'uv', quality, 'studioSmall08', false, 'black');
      cube.setPalette(Object.fromEntries(Object.entries(CT.FACES).map(([face, value]) => [face, value.color])));
      cube.draw(new CT.Cube().apply("x'").stickers);
      cube.orbit(-25, -42, 1);
    }, { before, quality });
    await page.locator('canvas[data-logo="loaded"]').waitFor();
    await page.waitForFunction(() => !!cube.scene.environment);
    await page.evaluate(() => {
      const uniforms = cube.postMaterial.uniforms;
      window.productionLens = {
        bloom: uniforms.bloom.value,
        bokeh: uniforms.bokeh.value,
        occlusion: uniforms.occlusion.value,
      };
    });
    await page.evaluate(() => {
      document.body.style.background = '#0c100d';
      document.querySelector('#stage').style.cssText = 'width:274px;height:265px';
      cube.draw(new CT.Cube().apply("R U F2 L D B").stickers);
      cube.orbit(-15, -20, 1);
    });
    await page.waitForTimeout(150);
    for (const effect of ['all', 'no-bloom', 'no-dof', 'no-ao']) {
      await page.evaluate(effect => {
        const u = cube.postMaterial.uniforms;
        u.bloom.value = effect === 'no-bloom' ? 0 : productionLens.bloom;
        u.bokeh.value = effect === 'no-dof' ? 0 : productionLens.bokeh;
        u.occlusion.value = effect === 'no-ao' ? 0 : productionLens.occlusion;
        cube.render();
      }, effect);
      await page.locator('#stage').screenshot({ path: path.join(output, `studio-small-08-${effect}.png`) });
    }
    // An isolated HDR impulse must become one smooth lobe, never replicas.
    const profile = await page.evaluate(async () => {
      const T = await import('/assets/vendor/three.module.js');
      const data = new Float32Array(65 * 4);
      data.set([16, 16, 16, 1], 32 * 4);
      const source = new T.DataTexture(data, 65, 1, T.RGBAFormat, T.FloatType);
      source.minFilter = source.magFilter = T.LinearFilter;
      source.needsUpdate = true;
      cube.bloomA.setSize(65, 1);
      cube.blurMaterial.uniforms.source.value = source;
      cube.blurMaterial.uniforms.texel.value.set(1 / 65, 1);
      cube.blurMaterial.uniforms.direction.value.set(1, 0);
      cube.blit(cube.blurMaterial, cube.bloomA);
      const pixels = new Uint16Array(65 * 4);
      cube.renderer.readRenderTargetPixels(cube.bloomA, 0, 0, 65, 1, pixels);
      source.dispose();
      return Array.from({ length: 65 }, (_, i) => pixels[i * 4]);
    });
    assert.ok(profile[32] > 0, 'HDR impulse is rendered');
    for (let i = 33; i < 65; i++) {
      assert.ok(profile[i] <= profile[i - 1], 'Bloom has no secondary peaks or bands');
      assert.ok(Math.abs(profile[i] - profile[64 - i]) <= 2, 'Bloom is symmetric');
    }
    assert.deepEqual(errors, []);
    console.log('Studio small 08 Cinematic effect isolation passed');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });

