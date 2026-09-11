import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, copyFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url),
  C = require("../assets/core.js");
test("server serves the app, preserves saves, rejects stale writes and reloads saved data", async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), "cubetracker-test-")),
    port = 14173;
  await mkdir(path.join(dir, "assets"));
  await mkdir(path.join(dir, "assets", "audio"));
  await copyFile(
    new URL("../server.mjs", import.meta.url),
    path.join(dir, "server.mjs"),
  );
  const html = await readFile(new URL("../CTU.html", import.meta.url), "utf8");
  const appAssets = [...new Set([...html.matchAll(/(?:src|href)="(assets\/[^"?#]+)"/g)].map(match => match[1]))];
  // Follow local JS imports too: Studio is loaded on demand, not from the HTML.
  for (let i = 0; i < appAssets.length; i++) {
    const file = appAssets[i];
    if (!file.endsWith(".js")) continue;
    const source = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
    for (const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*\()\s*["'](\.[^"']+)["']/g)) {
      const dependency = path.posix.normalize(path.posix.join(path.posix.dirname(file), match[1]));
      assert.ok(dependency.startsWith("assets/"));
      if (!appAssets.includes(dependency)) appAssets.push(dependency);
    }
    for (const match of source.matchAll(/new URL\(\s*["'](\.[^"']+)["']\s*,\s*import\.meta\.url\s*\)/g)) {
      const dependency = path.posix.normalize(path.posix.join(path.posix.dirname(file), match[1]));
      assert.ok(dependency.startsWith("assets/"));
      if (!appAssets.includes(dependency)) appAssets.push(dependency);
    }
  }
  for (const file of ["CTU.html", ...appAssets]) {
    await mkdir(path.dirname(path.join(dir, file)), { recursive: true });
    await copyFile(new URL(`../${file}`, import.meta.url), path.join(dir, file));
  }
  const logoAsset = "assets/gan-logo.png";
  await copyFile(new URL(`../${logoAsset}`, import.meta.url), path.join(dir, logoAsset));
  const cueAsset = "assets/audio/inspection-eight-01.mp3";
  await copyFile(new URL(`../${cueAsset}`, import.meta.url), path.join(dir, cueAsset));
  let child;
  async function start() {
    child = spawn(process.execPath, [path.join(dir, "server.mjs")], {
      env: { ...process.env, CT_PORT: String(port) },
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    await Promise.race([
      once(child.stdout, "data"),
      once(child, "exit").then(([code]) => {
        throw new Error("Server exited " + code);
      }),
    ]);
  }
  const get = () =>
    fetch(`http://127.0.0.1:${port}/api/library`).then((r) => r.json());
  const put = (data) =>
    fetch(`http://127.0.0.1:${port}/api/library`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  try {
    await start();
    await t.test("page assets and transitive dynamic imports load through the real server", async () => {
      const page = await fetch(`http://127.0.0.1:${port}/`);
      assert.equal(page.status, 200);
      assert.equal(await page.text(), html);
      for (const file of appAssets) {
        const response = await fetch(`http://127.0.0.1:${port}/${file}`);
        assert.equal(response.status, 200, `${file} must be served`);
        const expectedType = {
          ".js": /javascript/,
          ".css": /css/,
          ".png": /image\/png/,
          ".jpg": /image\/jpeg/,
          ".hdr": /octet-stream/,
        }[path.extname(file)];
        assert.ok(expectedType, `content type expectation exists for ${file}`);
        assert.match(response.headers.get("content-type"), expectedType);
        assert.deepEqual(Buffer.from(await response.arrayBuffer()), await readFile(path.join(dir, file)));
      }
      const cue = await fetch(`http://127.0.0.1:${port}/${cueAsset}`);
      assert.equal(cue.status, 200);
      assert.equal(cue.headers.get("content-type"), "audio/mpeg");
      assert.deepEqual(Buffer.from(await cue.arrayBuffer()), await readFile(path.join(dir, cueAsset)));
      const logo = await fetch(`http://127.0.0.1:${port}/${logoAsset}`);
      assert.equal(logo.status, 200);
      assert.equal(logo.headers.get("content-type"), "image/png");
      assert.deepEqual(Buffer.from(await logo.arrayBuffer()), await readFile(path.join(dir, logoAsset)));
      assert.equal((await fetch(`http://127.0.0.1:${port}/assets/audio/unlisted.mp3`)).status, 404);
      assert.equal((await fetch(`http://127.0.0.1:${port}/assets/vendor/unlisted.js`)).status, 404);
    });
    await t.test("solve videos stream independently with range support", async () => {
      const clip = Buffer.from("0123456789abcdef"),
        endpoint = `http://127.0.0.1:${port}/api/videos/video-test-1`;
      let response = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "video/webm" },
        body: clip,
      });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { size: clip.length, mimeType: "video/webm" });
      response = await fetch(endpoint);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("accept-ranges"), "bytes");
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), clip);
      response = await fetch(endpoint, { headers: { Range: "bytes=4-9" } });
      assert.equal(response.status, 206);
      assert.equal(response.headers.get("content-range"), `bytes 4-9/${clip.length}`);
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), clip.subarray(4, 10));
      response = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "video/webm", Origin: "https://untrusted.example" },
        body: clip,
      });
      assert.equal(response.status, 403);
      assert.equal((await fetch(endpoint, { method: "DELETE" })).status, 200);
      assert.equal((await fetch(endpoint)).status, 404);
    });
    await t.test("lighting calibrations are validated and hardcoded into the environment source", async () => {
      const endpoint = `http://127.0.0.1:${port}/api/environment-tuning`,
        values = { exposure: .91, hemi: .72, key: 1.4, rim: .8, fill: .76, env: .88, gloss: .42, glossRough: .135 };
      let response = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ environment: "studio", model: "tiles", values }),
      });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { saved: true, environment: "studio", model: "tiles", values });
      const source = await readFile(path.join(dir, "assets", "environments.js"), "utf8");
      assert.match(source, /"studio"\s*:\s*\{/);
      assert.match(source, /"exposure"\s*:\s*0\.91/);
      assert.equal(await readFile(path.join(dir, "backups", "environments.js.bak"), "utf8"), await readFile(new URL("../assets/environments.js", import.meta.url), "utf8"));
      response = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ environment: "studio", model: "tiles", values: { ...values, exposure: 99 } }),
      });
      assert.equal(response.status, 400);
      response = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Origin: "https://untrusted.example" },
        body: JSON.stringify({ environment: "studio", model: "tiles", values }),
      });
      assert.equal(response.status, 403);
    });
    await t.test("OG lighting saves independently of sticker and speedcube calibrations", async () => {
      const file = path.join(dir, "assets", "environments.js");
      const tuning = source => JSON.parse(source.match(/\/\* cube-tuning:start \*\/\s*([\s\S]*?)\s*\/\* cube-tuning:end \*\//)[1]);
      const before = tuning(await readFile(file, "utf8"));
      const values = { exposure: .65, hemi: .7, key: 1.14, rim: 1.05, fill: .83, env: .765, gloss: .32, glossRough: .1955 };
      const response = await fetch(`http://127.0.0.1:${port}/api/environment-tuning`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ environment: "studio", model: "og", values }),
      });
      assert.equal(response.status, 200);
      const after = tuning(await readFile(file, "utf8"));
      assert.deepEqual(after.studio.og, values);
      delete after.studio.og;
      assert.deepEqual(after, before);
      assert.equal((await get()).capabilities.environmentTuning, 2);
    });
    assert.equal((await get()).categories.length, 0);
    const a = {
        id: "test-a-123",
        name: "Practice",
        solves: [
          {
            id: "s1",
            rawMs: 12340,
            penalty: "",
            scramble: "R U R'",
            date: "2026-09-05T12:00:00.000Z",
            note: "Test note",
            video: {
              mimeType: "video/webm",
              size: 1200,
              width: 1280,
              height: 720,
              fps: 30,
            },
          },
        ],
      },
      b = { id: "test-b-123", name: "Other practice", solves: [] };
    let r = await put({ revision: 0, categories: [a, b] });
    assert.equal(r.status, 200);
    let saved = await r.json();
    assert.notEqual(saved.categories[0].file, saved.categories[1].file);
    const file = path.join(dir, saved.categories[0].file),
      original = await readFile(file, "utf8");
    assert.equal(C.parseCSV(original).solves[0].rawMs, 12340);
    a.solves[0].penalty = "+2";
    r = await put({ revision: 1, categories: [a, b] });
    assert.equal(r.status, 200);
    saved = await r.json();
    assert.equal(
      await readFile(
        path.join(dir, "backups", saved.categories[0].file + ".bak"),
        "utf8",
      ),
      original,
    );
    assert.equal(
      C.value(C.parseCSV(await readFile(file, "utf8")).solves[0]),
      14.34,
    );
    assert.equal((await put({ revision: 1, categories: [] })).status, 409);
    assert.equal((await get()).categories[0].solves[0].note, "Test note");
    assert.equal((await get()).categories[0].solves[0].video.width, 1280);
    a.name = "Renamed";
    r = await put({ revision: 2, categories: [a, b] });
    assert.equal(r.status, 200);
    assert.equal((await r.json()).categories[0].file, saved.categories[0].file);
    const bad = await fetch(`http://127.0.0.1:${port}/api/library`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://untrusted.example",
      },
      body: "{}",
    });
    assert.equal(bad.status, 403);
    assert.equal(
      (await fetch(`http://127.0.0.1:${port}/.cubetracker.json`)).status,
      404,
    );
    child.kill();
    await once(child, "exit");
    await start();
    const loaded = await get();
    assert.equal(loaded.categories[0].name, "Renamed");
    assert.equal(loaded.categories[0].solves[0].penalty, "+2");
    assert.equal(loaded.revision, 3);
  } finally {
    if (child && child.exitCode === null) {
      child.kill();
      await once(child, "exit");
    }
    const resolved = path.resolve(dir);
    assert.equal(path.dirname(resolved), path.resolve(tmpdir()));
    assert.ok(path.basename(resolved).startsWith("cubetracker-test-"));
    await rm(resolved, { recursive: true, force: true });
  }
});
