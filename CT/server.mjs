import http from "node:http";
import { readFile, writeFile, rename, mkdir, copyFile, open, stat, unlink } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url),
  CT = require("./assets/core.js");
const root = path.dirname(fileURLToPath(import.meta.url)),
  port = Number(process.env.CT_PORT || 4173),
  manifest = path.join(root, ".cubetracker.json"),
  environmentSource = path.join(root, "assets", "environments.js"),
  videoRoot = path.join(root, "videos"),
  MAX_VIDEO_BYTES = 512 * 1024 * 1024,
  // `capabilities` is also the version handshake the launcher uses: start.ps1
  // asks a running server for these and replaces the process when one it
  // requires is missing, which is how a Node process holding old code in memory
  // gets retired. Bump a key here whenever the server gains something the page
  // cannot get from a stale process — `environments` is the asset allowlist
  // that carries the current reflection-photograph allowlist.
  capabilities = { video: 1, environments: 2, surfaces: 2, environmentTuning: 1 };
let queue = Promise.resolve();
const TUNING_LIMITS = {
  exposure: [.3, 1.6],
  hemi: [0, 2.5],
  key: [0, 4],
  rim: [0, 3],
  fill: [0, 3],
  env: [0, 2.5],
  gloss: [0, 1],
  glossRough: [.03, .5],
};
async function load() {
  try {
    return JSON.parse(await readFile(manifest, "utf8"));
  } catch (e) {
    if (e.code === "ENOENT") return { version: 1, revision: 0, categories: [] };
    throw e;
  }
}
async function atomic(file, data) {
  const tmp = file + "." + randomUUID() + ".tmp";
  await writeFile(tmp, data, "utf8");
  await rename(tmp, file);
}
async function readJsonBody(req, maximum = 16384) {
  let bytes = 0;
  const chunks = [];
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > maximum)
      throw Object.assign(new Error("Request is too large."), { status: 413 });
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString());
}
async function saveEnvironmentTuning(body) {
  const environment = String(body?.environment || ""),
    model = String(body?.model || ""),
    values = body?.values;
  if (!/^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(environment) ||
      !["tiles", "stickers", "speedcube", "uv"].includes(model) ||
      !values || typeof values !== "object" || Array.isArray(values))
    throw new Error("Invalid environment tuning.");
  const clean = {};
  if (Object.keys(values).length !== Object.keys(TUNING_LIMITS).length)
    throw new Error("Every lighting value is required.");
  for (const [key, [min, max]] of Object.entries(TUNING_LIMITS)) {
    const value = Number(values[key]);
    if (!Number.isFinite(value) || value < min || value > max)
      throw new Error(`Invalid ${key} value.`);
    clean[key] = Math.round(value * 10000) / 10000;
  }
  const source = await readFile(environmentSource, "utf8"),
    marker = /\/\* cube-tuning:start \*\/\s*([\s\S]*?)\s*\/\* cube-tuning:end \*\//,
    match = source.match(marker);
  if (!match) throw new Error("The environment tuning block is missing.");
  if (!new RegExp(`\\n\\s{2}${environment}:\\s*\\{`).test(source))
    throw new Error("Unknown environment.");
  const tuning = JSON.parse(match[1]);
  tuning[environment] ||= {};
  tuning[environment][model] = clean;
  const replacement = `/* cube-tuning:start */ ${JSON.stringify(tuning, null, 2)} /* cube-tuning:end */`,
    updated = source.replace(marker, replacement);
  await mkdir(path.join(root, "backups"), { recursive: true });
  await copyFile(environmentSource, path.join(root, "backups", "environments.js.bak"));
  await atomic(environmentSource, updated);
  return { saved: true, environment, model, values: clean };
}
const send = (res, status, data) => {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
};
function trustedOrigin(req) {
  return (
    !req.headers.origin ||
    [`http://127.0.0.1:${port}`, `http://localhost:${port}`].includes(req.headers.origin)
  );
}
function videoId(pathname) {
  const match = pathname.match(/^\/api\/videos\/([\w-]{1,80})$/);
  return match?.[1] || "";
}
async function findVideo(id) {
  for (const extension of [".webm", ".mp4"]) {
    const file = path.join(videoRoot, id + extension);
    try {
      return {
        file,
        extension,
        mimeType: extension === ".mp4" ? "video/mp4" : "video/webm",
        info: await stat(file),
      };
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return null;
}
async function writeVideo(req, id) {
  const mimeType = String(req.headers["content-type"] || "").split(";", 1)[0].toLowerCase();
  if (!['video/webm', 'video/mp4'].includes(mimeType))
    throw Object.assign(new Error("WebM or MP4 video required."), { status: 415 });
  const declared = Number(req.headers["content-length"] || 0);
  if (declared > MAX_VIDEO_BYTES)
    throw Object.assign(new Error("Video exceeds 512 MB."), { status: 413 });
  const extension = mimeType === "video/mp4" ? ".mp4" : ".webm",
    target = path.join(videoRoot, id + extension),
    temporary = target + "." + randomUUID() + ".tmp";
  await mkdir(videoRoot, { recursive: true });
  const handle = await open(temporary, "wx");
  let bytes = 0;
  try {
    for await (const chunk of req) {
      bytes += chunk.length;
      if (bytes > MAX_VIDEO_BYTES)
        throw Object.assign(new Error("Video exceeds 512 MB."), { status: 413 });
      await handle.write(chunk);
    }
  } catch (error) {
    await handle.close().catch(() => {});
    await unlink(temporary).catch(() => {});
    throw error;
  }
  await handle.close();
  if (!bytes) {
    await unlink(temporary).catch(() => {});
    throw new Error("The video is empty.");
  }
  try {
    await rename(temporary, target);
  } catch (error) {
    if (!["EEXIST", "EPERM"].includes(error.code)) throw error;
    await unlink(target).catch(() => {});
    await rename(temporary, target);
  }
  const other = path.join(videoRoot, id + (extension === ".mp4" ? ".webm" : ".mp4"));
  await unlink(other).catch((error) => {
    if (error.code !== "ENOENT") throw error;
  });
  return { size: bytes, mimeType };
}
async function deleteVideo(id) {
  let found = false;
  for (const extension of [".webm", ".mp4"]) {
    try {
      await unlink(path.join(videoRoot, id + extension));
      found = true;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return found;
}
function serveVideo(req, res, video) {
  const size = video.info.size,
    range = req.headers.range;
  let start = 0,
    end = size - 1,
    status = 200;
  if (range) {
    const match = range.match(/^bytes=(\d*)-(\d*)$/);
    if (!match || (!match[1] && !match[2])) {
      res.writeHead(416, { "Content-Range": `bytes */${size}` });
      res.end();
      return;
    }
    if (!match[1]) start = Math.max(0, size - Number(match[2]));
    else start = Number(match[1]);
    if (match[2]) end = Number(match[2]);
    end = Math.min(end, size - 1);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= size) {
      res.writeHead(416, { "Content-Range": `bytes */${size}` });
      res.end();
      return;
    }
    status = 206;
  }
  const headers = {
    "Content-Type": video.mimeType,
    "Content-Length": end - start + 1,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-cache",
    "X-Content-Type-Options": "nosniff",
  };
  if (status === 206) headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
  res.writeHead(status, headers);
  if (req.method === "HEAD") res.end();
  else {
    const stream = createReadStream(video.file, { start, end });
    stream.on("error", () => res.destroy());
    stream.pipe(res);
  }
}
async function save(body) {
  const previous = await load();
  if (body.revision !== previous.revision)
    throw Object.assign(
      new Error(
        "Another window saved changes. Reload before saving to protect both copies.",
      ),
      { status: 409 },
    );
  if (!Array.isArray(body.categories) || body.categories.length > 200)
    throw new Error("Invalid categories.");
  const ids = new Set(),
    categories = [];
  for (const c of body.categories) {
    if (
      typeof c.id !== "string" ||
      !/^[\w-]{1,80}$/.test(c.id) ||
      ids.has(c.id) ||
      typeof c.name !== "string" ||
      !c.name.trim() ||
      c.name.length > 80 ||
      !Array.isArray(c.solves) ||
      c.solves.length > 200000
    )
      throw new Error("Invalid category.");
    ids.add(c.id);
    for (const s of c.solves) {
      if (
        typeof s.id !== "string" ||
        !Number.isFinite(s.rawMs) ||
        s.rawMs < 0 ||
        s.rawMs > 86400000 ||
        !["", "+2", "DNF"].includes(s.penalty) ||
        typeof s.scramble !== "string" ||
        s.scramble.length > 10000 ||
        (s.date !== null &&
          (typeof s.date !== "string" || !Number.isFinite(Date.parse(s.date))))
      )
        throw new Error("Invalid solve.");
      if (
        s.video != null &&
        (typeof s.video !== "object" ||
          !["video/webm", "video/mp4"].includes(s.video.mimeType) ||
          !Number.isFinite(s.video.size) ||
          s.video.size <= 0 ||
          s.video.size > MAX_VIDEO_BYTES ||
          !Number.isFinite(s.video.width) ||
          s.video.width < 1 ||
          s.video.width > 7680 ||
          !Number.isFinite(s.video.height) ||
          s.video.height < 1 ||
          s.video.height > 4320 ||
          !Number.isFinite(s.video.fps) ||
          s.video.fps < 1 ||
          s.video.fps > 240)
      )
        throw new Error("Invalid solve video.");
    }
    const old = previous.categories.find((x) => x.id === c.id);
    const slug =
      c.name
        .normalize("NFKD")
        .replace(/[^a-zA-Z0-9-]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 45) || "category";
    const file = old?.file || `${slug}-${c.id.slice(0, 8)}.csv`;
    if (path.basename(file) !== file || !file.endsWith(".csv"))
      throw new Error("Invalid filename.");
    categories.push({ id: c.id, name: c.name.trim(), file, solves: c.solves });
  }
  await mkdir(path.join(root, "backups"), { recursive: true });
  for (const c of categories) {
    const file = path.join(root, c.file),
      csv = CT.exportCSV(c.solves);
    let old;
    try {
      old = await readFile(file, "utf8");
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    if (old !== csv) {
      if (old != null)
        await copyFile(file, path.join(root, "backups", c.file + ".bak"));
      await atomic(file, csv);
    }
  }
  const result = { version: 1, revision: previous.revision + 1, categories };
  await atomic(manifest, JSON.stringify(result));
  return result;
}
const server = http.createServer(async (req, res) => {
  try {
    if (
      ![`127.0.0.1:${port}`, `localhost:${port}`].includes(req.headers.host)
    ) {
      send(res, 403, { error: "Local access only." });
      return;
    }
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const requestedVideoId = videoId(url.pathname);
    if (requestedVideoId) {
      if (["PUT", "DELETE"].includes(req.method) && !trustedOrigin(req)) {
        send(res, 403, { error: "Untrusted origin." });
        return;
      }
      if (req.method === "PUT") {
        send(res, 200, await writeVideo(req, requestedVideoId));
        return;
      }
      if (req.method === "DELETE") {
        const removed = await deleteVideo(requestedVideoId);
        send(res, removed ? 200 : 404, removed ? { removed: true } : { error: "Video not found." });
        return;
      }
      if (["GET", "HEAD"].includes(req.method)) {
        const video = await findVideo(requestedVideoId);
        if (!video) send(res, 404, { error: "Video not found." });
        else serveVideo(req, res, video);
        return;
      }
      send(res, 405, { error: "Method not allowed." });
      return;
    }
    if (url.pathname === "/api/library") {
      if (req.method === "GET") {
        send(res, 200, { ...(await load()), capabilities });
        return;
      }
      if (req.method === "PUT") {
        if (!trustedOrigin(req)) {
          send(res, 403, { error: "Untrusted origin." });
          return;
        }
        if (!req.headers["content-type"]?.startsWith("application/json")) {
          send(res, 415, { error: "JSON required." });
          return;
        }
        let bytes = 0,
          chunks = [];
        for await (const chunk of req) {
          bytes += chunk.length;
          if (bytes > 60 * 1024 * 1024) {
            send(res, 413, { error: "Library exceeds 60 MB." });
            return;
          }
          chunks.push(chunk);
        }
        const body = JSON.parse(Buffer.concat(chunks).toString());
        const job = queue.then(() => save(body));
        queue = job.catch(() => {});
        send(res, 200, { ...(await job), capabilities });
        return;
      }
      send(res, 405, { error: "Method not allowed." });
      return;
    }
    if (url.pathname === "/api/environment-tuning") {
      if (req.method !== "PUT") {
        send(res, 405, { error: "Method not allowed." });
        return;
      }
      if (!trustedOrigin(req)) {
        send(res, 403, { error: "Untrusted origin." });
        return;
      }
      if (!req.headers["content-type"]?.startsWith("application/json")) {
        send(res, 415, { error: "JSON required." });
        return;
      }
      const body = await readJsonBody(req),
        job = queue.then(() => saveEnvironmentTuning(body));
      queue = job.catch(() => {});
      send(res, 200, await job);
      return;
    }
    if (!["GET", "HEAD"].includes(req.method)) {
      send(res, 405, { error: "Method not allowed." });
      return;
    }
    const requested = url.pathname === "/" ? "/CTU.html" : url.pathname;
    const isInspectionCue = /^\/assets\/audio\/inspection-(?:eight|twelve)-(?:0[1-9]|10)\.mp3$/.test(requested);
    // Environments used to be listed here one file at a time, so adding an HDR
    // meant editing the server and restarting it. The pattern is as tight as the
    // list was: a single path segment directly under /assets, letters, digits,
    // dashes and underscores only, ending in .hdr. No dot and no separator can
    // appear in the name, so there is nothing for a traversal to climb with, and
    // a file that is not on disk still 404s from readFile. Dropping an HDR into
    // assets/ now serves it.
    const isEnvironmentMap = /^\/assets\/[A-Za-z0-9_-]+\.hdr$/.test(requested);
    // The wear maps get the same treatment for the same reason, and they need
    // it more: they were never listed at all, so every one of them 404'd, the
    // texture loader took its own unavailable path, and the Surface wear toggle
    // silently did nothing in the app while looking correct in every test that
    // serves the folder directly. One segment under /assets/wear, no dot and no
    // separator in the name, so there is nothing for a traversal to climb with.
    const isWearMap = /^\/assets\/wear\/[A-Za-z0-9_-]+\.png$/.test(requested);
    if (
      ![
        "/CTU.html",
        "/assets/core.js",
        "/assets/timer-effects.js",
        "/assets/app.js",
        "/assets/cube-realistic.js",
        "/assets/environments.js",
        "/assets/gan-logo.png",
        "/assets/plastic_0010_2k_9akcRm/plastic_0010_normal_opengl_2k.png",
        "/assets/plastic_0010_2k_9akcRm/plastic_0010_roughness_2k.jpg",
        "/assets/plastic_0010_2k_9akcRm/plastic_0010_color_2k.jpg",
        "/assets/style.css",
        "/assets/scramble-worker.js",
        "/assets/vendor/cube.js",
        "/assets/vendor/solve.js",
         "/assets/vendor/three.module.js",
         "/assets/vendor/RoundedBoxGeometry.js",
         "/assets/vendor/rgbe-loader.js",
         "/assets/vendor/dm-sans.woff2",
         "/assets/vendor/manrope.woff2",
      ].includes(requested) && !isInspectionCue && !isEnvironmentMap && !isWearMap
    ) {
      send(res, 404, { error: "Not found." });
      return;
    }
    const data = await readFile(path.join(root, requested));
    const extension = path.extname(requested), contentType = {
      ".html": "text/html; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".woff2": "font/woff2",
       ".mp3": "audio/mpeg",
       ".png": "image/png",
       ".hdr": "application/octet-stream",
    }[extension];
    res.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    });
    res.end(req.method === "HEAD" ? undefined : data);
  } catch (e) {
    send(res, e.status || 400, { error: e.message });
  }
});
server.listen(port, "127.0.0.1", () =>
  console.log(
    `CubeTracker is ready at http://127.0.0.1:${port}\nCSV files are saved in ${root}\nClose this process to stop the server.`,
  ),
);
server.on("error", (e) => {
  console.error(
    e.code === "EADDRINUSE"
      ? `Port ${port} is already in use. CubeTracker may already be running.`
      : e,
  );
  process.exitCode = 1;
});
