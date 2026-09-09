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
    const quality = process.env.UV_QUALITY || 'balanced';
    const environment = process.env.UV_ENVIRONMENT || 'studioSmall08';
    const wear = process.env.UV_WEAR === '1';
    await page.evaluate(async ({ before, quality, environment, wear }) => {
      const { RealisticCube } = await import(before ? '/assets/cube-uv-before.js' : '/assets/cube-realistic.js');
      window.cube = new RealisticCube(document.querySelector('#stage'), () => { throw Error('WebGL unavailable'); }, 'uv', quality, environment, wear, 'black');
      cube.setPalette(Object.fromEntries(Object.entries(CT.FACES).map(([face, value]) => [face, value.color])));
      cube.draw(new CT.Cube().apply("x'").stickers);
      cube.orbit(-25, -42, 1);
    }, { before, quality, environment, wear });
    await page.locator('canvas[data-logo="loaded"]').waitFor();
    if (!before && wear) {
      await page.locator('canvas[data-wear="loaded"]').waitFor();
      await page.locator('canvas[data-wear-roughness="loaded"]').waitFor();
      await page.locator('canvas[data-wear-clearcoat="loaded"]').waitFor();
    }
    if (!before) await page.waitForFunction(() => Boolean(cube.scene.environment));
    if (!before) {
      const surface = await page.evaluate(() => {
        const geometries = [...new Set(cube.faces.map(face => face.geometry))];
        return geometries.map(geometry => {
          const positions = geometry.getAttribute('position'), normals = geometry.getAttribute('normal');
          let peak = -Infinity, innerShoulder = -Infinity, centerError = 0, normalError = 0;
          for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
            peak = Math.max(peak, z);
            const inset = .497 - Math.max(Math.abs(x), Math.abs(y));
            if (inset > .10 && inset < .13) innerShoulder = Math.max(innerShoulder, z);
            if (Math.hypot(x, y) < .2) centerError = Math.max(centerError, Math.abs(z - .0195));
            normalError = Math.max(normalError, Math.abs(Math.hypot(normals.getX(i), normals.getY(i), normals.getZ(i)) - 1));
          }
          return { peak, innerShoulder, centerError, normalError };
        });
      });
      assert.ok(surface.every(cap => cap.peak > .022 && cap.peak < .027), 'Ridge stays shallow');
      assert.ok(surface.every(cap => cap.innerShoulder > .0215), 'Shoulder extends into the pool instead of forming a narrow rim');
      assert.ok(surface.every(cap => cap.centerError < .0001), 'Center stays flat');
      assert.ok(surface.every(cap => Number.isFinite(cap.normalError) && cap.normalError < .001), 'Surface normals remain finite and normalized');
    }
    for (const [name, pitch, yaw, moves] of [
      ['studio', -25, -42, "x'"],
      ['blue', -62, 24, "x'"],
      ['orange', -48, -25, "z"],
      ['scrambled', -30, 34, "R U R' F2 D L2 B"],
    ]) {
      await page.evaluate(({ pitch, yaw, moves }) => {
        cube.draw(new CT.Cube().apply(moves).stickers);
        cube.orbit(pitch, yaw, 1);
      }, { pitch, yaw, moves });
      await page.screenshot({ path: path.join(output, `uv-${before ? 'before' : quality}-${name}.png`) });
    }
    // Rotation must move the reflection, and reversing a turn restores it.
    await page.evaluate(() => { cube.draw(new CT.Cube().stickers); cube.orbit(-25, -42, 1); });
    const original = await page.screenshot();
    await page.evaluate(() => cube.draw(new CT.Cube().stickers, CT.moveSpec('R'), .5));
    assert.ok(!original.equals(await page.screenshot()), 'A partial layer turn renders');
    await page.evaluate(() => { cube.draw(new CT.Cube().stickers); cube.orbit(-25, -12, 1); });
    assert.ok(!original.equals(await page.screenshot()), 'Reflections respond to orbit');
    await page.evaluate(() => { cube.draw(new CT.Cube().apply("R R'").stickers); cube.orbit(-25, -42, 1); });
    assert.ok(original.equals(await page.screenshot()), 'Reversing a turn restores the rendered cube');
    assert.deepEqual(errors, []);
    if (quality === 'cinematic') {
      for (const background of ['#111820', '#ffffff']) {
        for (const size of [240, 640]) {
          await page.evaluate(({ background, size }) => {
            document.body.style.background = background;
            Object.assign(document.querySelector('#stage').style, { width: size + 'px', height: size + 'px' });
          }, { background, size });
          await page.waitForTimeout(100);
          await page.evaluate(() => cube.render());
          assert.equal(await page.locator('canvas').count(), 1);
          const frame = await page.screenshot();
          await page.evaluate(() => cube.render());
          assert.ok(frame.equals(await page.screenshot()), 'Cinematic stays deterministic across sizes and backgrounds');
          await page.screenshot({ path: path.join(output, `cinematic-${background === '#111820' ? 'dark' : 'light'}-${size}.png`) });
        }
      }
      assert.deepEqual(errors, [], 'Cinematic shaders remain valid after resizing');
    }
    await page.evaluate(() => cube.destroy());
    assert.equal(await page.locator('canvas').count(), 0);
    for (const [previous, filename, titles, captions] of [
      ['uv-before-blue.png', 'uv-coating-before-after.png', ['Previous UV coating', 'Refined UV coating'], ['Same palette, camera and cube orientation', 'Clear finish · broad reflections · polished edges']],
      ['uv-domed-blue.png', 'uv-coating-ridges-before-after.png', ['Domed coating', 'Blended perimeter ridges'], ['Previous uniform convex surface', 'Flatter center · shallow dip · softly raised perimeter']],
      ['uv-narrow-ridge-blue.png', 'uv-coating-broad-shoulder-comparison.png', ['Previous narrow ridge', 'Wider, softer shoulder'], ['Narrow border around the pool', 'Same ridge height · broader inward blend']],
      ['uv-strong-reflections-blue.png', 'uv-coating-reflection-strength-comparison.png', ['Previous highlights', 'Natural highlights'], ['Bright studio panels dominated the color', 'Reduced reflection energy · preserved gloss']],
    ]) {
      if (before || quality !== 'balanced' || !fs.existsSync(path.join(output, previous))) continue;
      const filenames = [previous, 'uv-balanced-blue.png'];
      const images = filenames.map(name => 'data:image/png;base64,' + fs.readFileSync(path.join(output, name)).toString('base64'));
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.setContent(`<style>body{margin:0;background:white;font-family:Arial,sans-serif;color:#182333}main{display:flex}section{width:50%}h2{font-size:19px;font-weight:500;margin:25px 32px 14px}img{width:620px;height:620px;display:block;margin:0 auto}p{margin:5px 32px;color:#657182;font-size:13px}</style><main>${images.map((src, i) => `<section><h2>${titles[i]}</h2><img src="${src}"><p>${captions[i]}</p></section>`).join('')}</main>`);
      await page.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
      await page.screenshot({ path: path.join(output, filename) });
    }
    console.log(`UV ${before ? 'before' : quality}: four views, orbit, reverse turn and disposal passed.`);
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
