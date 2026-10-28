/* Shared set-up for the browser tests: the app served from this folder with an in-memory library, so nothing
   touches your real data. Set CT_PLAYWRIGHT to a Playwright module path and CT_CHROME to a Chrome binary if the
   defaults below are not right for this machine. */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const root = path.resolve(__dirname, '..');
const WIN_PLAYWRIGHT = 'C:/Users/alejo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright';
const WIN_CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

// The playground tests were written against the original defaults (I/K = R/R', slow squares, animations off).
// The app now ships Alejo's own defaults, so those tests seed the original settings explicitly.
const LEGACY_PLAY = { separation: 65, pitch: -25, yaw: 0, radius: 4, outlineThickness: 2.5, perspective: 80, animations: false,
  bindings: { KeyI:'R', KeyK:"R'", KeyJ:'U', KeyF:"U'", KeyH:'F', KeyG:"F'", KeyD:'L', KeyE:"L'", KeyS:'D', KeyL:"D'", KeyW:'B', KeyO:"B'", KeyT:'x', KeyY:"x'", KeyA:"y'", Semicolon:'y', KeyQ:"z'", KeyP:'z', KeyU:'Rw', KeyM:"Rw'", KeyV:'Lw', KeyR:"Lw'", Digit5:'M', Digit6:"M'", KeyN:'E', KeyB:"E'", Comma:'Uw', Period:"Uw'" } };

function loadPlaywright() {
  for (const id of [process.env.CT_PLAYWRIGHT, WIN_PLAYWRIGHT, 'playwright']) {
    if (!id) continue;
    try { return require(id); } catch {}
  }
  throw new Error('Playwright not found. Set CT_PLAYWRIGHT to its path.');
}
/** Solves for a test library: `count` solves, one every `everyHours`, times from `time(i)` in ms, newest last. */
function makeSolves(count, { time = (i) => 9000 + (i % 50) * 100, everyHours = 2.5, penalty = () => '', note = () => '' } = {}) {
  const end = Date.now();
  return Array.from({ length: count }, (_, i) => ({
    id: `t-${i}`, rawMs: time(i), penalty: penalty(i), scramble: "R U R' U' F2 D L2 B U2 R' F D2 L B' U F2",
    date: new Date(end - (count - i) * everyHours * 3600e3).toISOString(), note: note(i),
  }));
}
async function open({ categories, width = 1440, height = 900, theme = 'dark', hash = 'timer', clock = false, cubePlay, prefs } = {}) {
  let library = { version: 1, revision: 0, categories: categories || [{ id: 'test', name: 'Test', solves: makeSolves(300) }] };
  const server = http.createServer(async (req, res) => {
    if (req.url === '/api/library') {
      if (req.method === 'PUT') { let body = ''; for await (const chunk of req) body += chunk; library = { version: 1, ...JSON.parse(body), revision: library.revision + 1 }; }
      res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(library)); return;
    }
    const file = path.join(root, req.url.split('?')[0] === '/' ? 'CTU.html' : req.url.split('?')[0]);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' })[path.extname(file)] || 'text/plain');
    res.end(fs.readFileSync(file));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { chromium } = loadPlaywright();
  const executablePath = process.env.CT_CHROME || (fs.existsSync(WIN_CHROME) ? WIN_CHROME : undefined);
  const browser = await chromium.launch({ executablePath, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(({ theme, cubePlay, prefs }) => { window.Worker = undefined; if (!localStorage.getItem('cubetracker.preferences.v2')) localStorage.setItem('cubetracker.preferences.v2', JSON.stringify({ version: 2, theme, accent: 'forest', ...(prefs || {}), ...(cubePlay ? { cubePlay } : {}) })); }, { theme, cubePlay, prefs });
  await page.goto(`http://127.0.0.1:${server.address().port}/?t=${Date.now()}#${hash}`);
  await page.waitForTimeout(2500);
  if (clock) await page.clock.install();
  return { page, errors, library: () => library, close: async () => { await browser.close(); server.close(); } };
}
module.exports = { open, makeSolves, root, LEGACY_PLAY };
