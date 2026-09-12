/* Renderer regression and reference views; isolated from the solve library. */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.CT_PLAYWRIGHT || 'C:/Users/alejo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  if (req.url === '/') {
    res.setHeader('Content-Type', 'text/html');
    res.end('<style>body{margin:0;background:#f1f0ed}#stage{width:640px;height:640px}canvas{display:block;width:100%;height:100%}</style><div id="stage"></div><script src="/assets/core.js"></script><script src="/assets/environments.js"></script>');
    return;
  }
  const file = path.resolve(root, '.' + req.url.split('?')[0]);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.png': 'image/png' })[path.extname(file)] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    for (const model of ['speedcube','uv','og']) for (const quality of ['low','balanced','high','ultra','cinematic']) {
      const result = await page.evaluate(async ({model,quality}) => {
        window.cube?.destroy();
        const {RealisticCube} = await import('/assets/cube-realistic.js');
        const cube = window.cube = new RealisticCube(document.querySelector('#stage'), () => {}, model, quality, 'studio', true);
        cube.draw(new CT.Cube().stickers, CT.moveSpec('R'), .5);
        let triangles = 0, collapsedUVs = 0, invalid = 0, reversed = 0;
        for (const {mesh} of cube.bodies) {
          const g=mesh.geometry, p=g.attributes.position, uv=g.attributes.uv, n=g.attributes.normal, ix=g.index.array;
          if (![...p.array,...uv.array,...n.array].every(Number.isFinite)) invalid++;
          for(let i=0;i<ix.length;i+=3) {
            const [a,b,c]=ix.slice(i,i+3);
            const area=(uv.getX(b)-uv.getX(a))*(uv.getY(c)-uv.getY(a))-(uv.getY(b)-uv.getY(a))*(uv.getX(c)-uv.getX(a));
            if (Math.abs(area)<1e-12) collapsedUVs++;
            const ab=[p.getX(b)-p.getX(a),p.getY(b)-p.getY(a),p.getZ(b)-p.getZ(a)];
            const ac=[p.getX(c)-p.getX(a),p.getY(c)-p.getY(a),p.getZ(c)-p.getZ(a)];
            const facing=(ab[1]*ac[2]-ab[2]*ac[1])*n.getX(a)+(ab[2]*ac[0]-ab[0]*ac[2])*n.getY(a)+(ab[0]*ac[1]-ab[1]*ac[0])*n.getZ(a);
            if (facing <= 0) reversed++;
            triangles++;
          }
        }
        return {bodies:cube.bodies.length,triangles,collapsedUVs,invalid,reversed,wear:!!cube.shellMaterial.normalMap && !!cube.shellMaterial.roughnessMap};
      },{model,quality});
      assert.equal(result.bodies,26);
      assert.ok(result.triangles>300);
      assert.equal(result.collapsedUVs,0, 'Every wall triangle must have usable wear UVs');
      assert.equal(result.invalid,0);
      assert.equal(result.reversed,0,'All shell triangles face outward');
      assert.ok(result.wear);
      console.log(model,quality,'body geometry and wear passed');
    }
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
