/* Browser-level verification for camera settings, recording, storage and playback. */
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const assert = require("node:assert/strict");
const { chromium } = require(
  process.env.CT_PLAYWRIGHT ||
    "C:/Users/alejo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
);

const root = path.resolve(__dirname, ".."),
  output = path.join(root, "tests", "screenshots");
fs.mkdirSync(output, { recursive: true });
let library = {
  version: 1,
  revision: 0,
  categories: [{ id: "video-test", name: "Video practice", solves: [] }],
};
const videos = new Map();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost"),
    videoMatch = url.pathname.match(/^\/api\/videos\/([\w-]+)$/);
  if (videoMatch) {
    const id = videoMatch[1];
    if (req.method === "PUT") {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = Buffer.concat(chunks);
      videos.set(id, body);
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ size: body.length, mimeType: "video/webm" }));
      return;
    }
    if (req.method === "GET") {
      const body = videos.get(id);
      if (!body) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, {
        "Content-Type": "video/webm",
        "Content-Length": body.length,
        "Accept-Ranges": "bytes",
      });
      res.end(body);
      return;
    }
    if (req.method === "DELETE") {
      videos.delete(id);
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ removed: true }));
      return;
    }
  }
  if (url.pathname === "/api/library") {
    if (req.method === "PUT") {
      let data = "";
      for await (const chunk of req) data += chunk;
      library = { version: 1, ...JSON.parse(data), revision: library.revision + 1 };
    }
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(library));
    return;
  }
  const file = path.join(root, url.pathname === "/" ? "CTU.html" : url.pathname);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.setHeader(
    "Content-Type",
    ({ ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".woff2": "font/woff2", ".mp3": "audio/mpeg" })[path.extname(file)] || "application/octet-stream",
  );
  res.end(fs.readFileSync(file));
});

(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }),
      errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
      window.Worker = undefined;
      window.__cameraRequests = [];
      const cameras = [
        { kind: "videoinput", deviceId: "camera-1", label: "Front camera" },
        { kind: "videoinput", deviceId: "camera-2", label: "Desk camera" },
      ];
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {
          enumerateDevices: async () => cameras,
          addEventListener() {},
          getUserMedia: async (constraints) => {
            window.__cameraRequests.push(JSON.parse(JSON.stringify(constraints)));
            const canvas = document.createElement("canvas"),
              video = constraints.video,
              width = video.width?.ideal || 1280,
              height = video.height?.ideal || 720,
              fps = video.frameRate?.ideal || 30,
              context = canvas.getContext("2d");
            canvas.width = Math.min(width, 640);
            canvas.height = Math.min(height, 360);
            let frame = 0;
            const draw = () => {
              context.fillStyle = frame++ % 2 ? "#18352a" : "#284f40";
              context.fillRect(0, 0, canvas.width, canvas.height);
              context.fillStyle = "#e2ee98";
              context.fillRect((frame * 7) % canvas.width, 20, 50, 50);
            };
            draw();
            const interval = setInterval(draw, 33),
              stream = canvas.captureStream(Math.min(fps, 30)),
              track = stream.getVideoTracks()[0],
              stop = track.stop.bind(track);
            track.stop = () => { clearInterval(interval); stop(); };
            track.getSettings = () => ({
              deviceId: video.deviceId?.exact || "camera-1",
              width,
              height,
              frameRate: fps,
            });
            return stream;
          },
        },
      });
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/#timer`);
    await page.locator("#timer-surface").waitFor();

    await page.locator('[data-action="settings"]').evaluate((element) => element.click());
    await page.locator('[data-control="video-recording"]').check();
    await page.locator("#camera-status").filter({ hasText: "ready" }).waitFor();
    await page.locator('[data-control="camera-device"]').selectOption("camera-2");
    await page.locator('[data-control="video-resolution"]').selectOption("1080");
    await page.locator('[data-control="video-fps"]').selectOption("60");
    await page.locator("#camera-status").filter({ hasText: "1920×1080 · 60 fps · ready" }).waitFor();
    const request = await page.evaluate(() => window.__cameraRequests.at(-1));
    assert.equal(request.video.deviceId.exact, "camera-2");
    assert.equal(request.video.width.ideal, 1920);
    assert.equal(request.video.frameRate.ideal, 60);
    await page.screenshot({ path: path.join(output, "video-settings.png") });
    await page.locator('[data-action="close-dialog"]').first().click();
    await page.waitForTimeout(230);

    await page.locator("#timer-surface").focus();
    await page.keyboard.down("Space");
    await page.locator("body.recording-video").waitFor();
    await page.waitForFunction(() => Number(getComputedStyle(document.querySelector(".live-camera")).opacity) > 0);
    assert.ok(await page.locator(".live-camera").evaluate((element) => Number(getComputedStyle(element).opacity) > 0));
    await page.waitForTimeout(420);
    await page.keyboard.up("Space");
    assert.equal(await page.locator(".timer-card").getAttribute("data-state"), "running");
    await page.waitForTimeout(500);
    await page.keyboard.press("KeyA");
    await page.locator(".solve-video-badge").waitFor({ timeout: 5000 }).catch(async (error) => {
      console.error("video debug", {
        videos: videos.size,
        solves: library.categories[0].solves,
        toasts: await page.locator(".toast").allTextContents(),
        pageErrors: errors,
      });
      throw error;
    });
    assert.equal(videos.size, 1);

    await page.locator(".solve-entry-open").first().click();
    const geometry = await page.locator(".detail-visuals").evaluate((element) => {
      const video = element.querySelector(".solve-video-frame").getBoundingClientRect(),
        cube = element.querySelector(".detail-cube").getBoundingClientRect();
      return { videoLeft: video.left, videoRight: video.right, videoHeight: video.height, cubeLeft: cube.left, cubeHeight: cube.height };
    });
    assert.ok(geometry.videoRight <= geometry.cubeLeft);
    assert.ok(Math.abs(geometry.videoHeight - geometry.cubeHeight) < 1);
    assert.equal(await page.locator("#solve-video").getAttribute("controls"), null);
    assert.notEqual(await page.locator("#solve-video").getAttribute("loop"), null);
    await page.locator("#solve-video").click();
    assert.equal(await page.locator("#solve-video").evaluate((video) => video.paused), true);
    await page.screenshot({ path: path.join(output, "solve-video.png") });
    assert.deepEqual(errors, []);
    console.log("PASS: configurable camera capture, immediate hold-mode recording, async video storage and balanced looping player.");
  } finally {
    await browser.close();
    server.close();
  }
})().catch((error) => {
  console.error(error);
  server.close();
  process.exitCode = 1;
});
