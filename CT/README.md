# CubeTracker

A local speedcubing workspace with an interactive 3D cube, timer, algorithm trainer, solve library, and progress analytics.

## Open it

Double-click **Start CubeTracker.cmd**. It opens [CubeTracker](http://127.0.0.1:4173) and runs the local saver in the background. Node.js 22 or newer is required; it is already available on this computer. Use **Stop CubeTracker.cmd** when you are finished.

1. Create a category with any name you like, or import an existing CSV into a new category from **Settings → Import CSV**.
2. The timer is the home screen. Hold Space until the digits light up, then release. Press any key to stop. Turn on **Start on a single press** in Settings to start on one press instead of a hold. On touch screens, press and hold the timer, then tap to stop. Enter provides an instant-start alternative when the timer is focused. **Settings → Record solves on video** adds per-solve camera recording with camera, resolution, and frame-rate controls.
3. Every attempt saves automatically to that category's CSV in this folder. Change a penalty with **OK**, **+2**, or **DNF**. Deleted solves can be restored with **Undo**.

The app also works by opening **CTU.html** directly, with the `assets` folder beside it. In this mode, data initially saves in the browser. Use **Storage details → Connect a folder** in a supported browser to enable automatic CSV writes, or use **Export CSV**. Folder access must be reconnected after reopening. The launcher is the easiest way to get automatic saving beside the HTML.

## Your files

- Category CSVs use `category-name-unique-id.csv`. Importing preserves the source file and creates a working copy for continued recording. Renaming a category keeps its existing filename.
- Deleting a category removes it from the workspace only; its CSV stays in the folder, so importing that file brings the solves back.
- `.cubetracker.json` stores the complete library, category names, underlying DNF times, solve notes, and the Trainer's alg sets with their per-case times. CSV files are portable copies in the original four-column format. Keep this file with your folder to preserve the full workspace.
- `videos/solve-id.webm` (or `.mp4` when the browser requires it) stores one independent recording per solve. Video bytes never enter the CSV or library JSON. Deleting a solve or category also removes its recordings after the Undo window. In standalone HTML mode, clips use the browser's dedicated video storage instead.
- `backups/category-name-unique-id.csv.bak` contains the previous CSV version. Copy it to a `.csv` filename and import it to recover an earlier version.
- `backups/CTU.original.html` is the original website.
- Local browser recovery copies protect pending writes. Failed saves are shown explicitly. Concurrent windows cannot silently overwrite each other's changes; reload and use the recovery CSVs if a conflict is reported.
- Files edited outside the app should be imported again. The workspace metadata is the source used at startup.

The app has no account, telemetry, external fonts, or CDN dependencies. The local server listens only on this computer. Keep the entire folder together when moving it.

## CSV format

```csv
Index,Time,Scramble,Date
"3","DNF","R2 U F'","2026-09-06T12:02:00.000Z"
"2","64.50+","F2 D R'","2026-09-06T12:01:00.000Z"
"1","12.34","R U R' U'","2026-09-06T12:00:00.000Z"
```

Exported times are decimal **seconds**. A trailing `+` means the two-second penalty is **already included**. DNFs export as plain `DNF` for compatibility with the original site; underlying DNF timing and notes remain in the workspace metadata. The importer also understands `minutes:seconds`, `DNF(time)`, quoted dates, legacy dates with unquoted commas, and a UTF-8 BOM. Exports retain millisecond precision when an imported time uses it. New timer attempts use centiseconds.

Exports are newest first, matching the original file workflow. The app analyzes solves chronologically. Invalid time rows reject the import with an explanation rather than silently disappearing. Missing dates and unsupported scramble notation are retained with a warning. Appending an import skips exact duplicates on date, time, penalty, and scramble.

## Interface

The sidebar stays out of the way: move the pointer to the left edge of the window and it slides out over a blurred page, then slides back when the pointer leaves. On narrow windows it stays as a fixed icon rail.

The theme follows your system setting. The sidebar toggle overrides it and remembers the choice.

The timer fills the window and is where the app opens. Between attempts the scramble sits directly above the time, the 3D cube to the left of it, the penalty controls below, and every solve in the panel on the right. Click the scramble for a new one, or click the cube to switch between 3D and the flat net. Starting an attempt slides the panel out and fades everything but the time; it all comes back when you stop. With video enabled, the warmed camera begins immediately at inspection start or the initial hold, and its rounded live feed fades onto the stage. Single-press mode begins recording on the initiating release. The camera records video only, without microphone audio.

The solve panel lists times newest first with their solve numbers, and loads more as you scroll with no scrollbar of its own. The four stats sit on the panel itself (best, mean, ao5, ao12; ao5 and ao12 show their PB). Each row has a delete button, and clicking a row opens that solve's details. Averages and the personal best sit above the list.

Dialogs share one look: grouped switches, a pinned Done button, and one dropdown style for every selector in the app. See `docs/dialogs-and-controls.md` for the building blocks and how to add a dialog, switch or dropdown.

There is no top bar: the sidebar holds navigation, categories, the theme, and **Settings**, which carries video capture (480p/720p/1080p and 24/30/60 fps), inspection, single-press starting, the flat-net preview, reward animations on or off, CSV import, and storage details. Manual entry is in the solve library.

## Explore

- **Overview:** the best consecutive 500-solve mean and global ao5 PB always cover the active category, independently of the last-n selector. The best 500 earns a sub-time rank card in one of twelve materials (a medal socket whose ring fills while you build toward a title, then Breeze, Horizon, Bronze, Steel, Gold, Crystal, Obsidian, Forge, Neon, Aurora, Holographic and Supernova, in that order), and a rusty variant of each reflects current form without removing the title. The cards move on their own; see `docs/rewards-and-rank-cards.md`. The three big numbers (global ao5 PB, session mean, total solves) share one card. Session mean, solve count, and the chart follow the selector. Select a calendar day for its date and solve count.
- **Timer:** keyboard and touch controls, hold-to-start or single-press starting, optional 15-second inspection, the full solve list beside the time, and automatic saving. Click Best for its solve, Mean to remember a global or last-n cutoff, and ao5/ao12 for a split inspector with chronological solves, excluded fastest/slowest entries, and the selected scramble's 3D/2D preview, playback, penalties, and note. On phones, the stats and solve list sit below the timer.
- **Timer motion:** inspection has spoken cues at 8 and 12 seconds, with a prominent countdown banner, thick pulsing halo, and screen-edge warning in the final three seconds. +2 begins at 15 seconds; at 17 the attempt saves as DNF. Every moment has its own effect: a single PB shatters the old time, an average PB settles it, several records at once combine into a prism, a barrier falling or returning has its own pair, titles unlock with Sunrise, Aurora, Warp, Forge or a Singularity depending on the level, and rust, recovery and a slowest-ever solve get quieter ones. A solve under 2.5 seconds is treated as an accident and never rewarded. The "Title unlocked" popup uses the same material as the rank card it earns. Reward cards land under the OK / +2 / DNF buttons, never over them (the timer slides up if the window is short); only the big moments dim the background. A card stays until the next solve starts, you change or delete that solve, or you click it or press Esc. Scramble moves appear in sequence and the cube grows into place with an overshoot. New attempts interrupt rewards. **Settings → Reward animations** (on by default) or your device's reduced-motion setting turns all effects off and keeps the rank cards still, with the same readable cards. **Guide & shortcuts → Animation studio** previews every reward, title, rusty frame, recovery, inspection and entrance without saving solves.
- **Sub-time titles:** only start at 500 attempts. Use the arithmetic mean of exactly the last 500, with +2 included and any DNF making that window DNF. Every historical window is scanned to recover the best 500 from imports and reloads. Special thresholds are 60, 45, 30, 25, 20, 15, 12, 10, 8, 7, 6 and 5 seconds, with twelve increasing reward levels. Ordinary crossings in both directions use the category's global completed-solve mean to choose intervals: below 20s → 0.5s, below 30s → 1s, below 120s → 5s, below 600s → 20s. Above that, round mean/30 upward on a 1–2–5 scale (20, 50, 100, 200, 500…). Special titles are earned only on a new historical best crossing. Rust starts strictly above the earned threshold plus one interval from the band just below that threshold; returning within this margin clears it. Imports and edits rebuild the status without launching celebrations.
- **Trainer:** sets of algorithms drilled case by case. See **Trainer** below.
- **Solve library:** search that filters as you type (time, scramble or note), an **All / Sub T / +2 / DNF** filter where T is any number of seconds you type or step (your last T is remembered), a date picker with presets and a calendar, sort by solve or by time, a **By day** switch for day headings, one-line notes (the full note is in the solve dialog), quick OK / +2 / DNF, copy and delete on each row, continuous loading as you scroll, manual entry, and CSV export of what the filters show. See `docs/solve-library.md`.
- **Insights:** five cards that follow one range (it opens on your latest 1,000 solves and can be set to all solves or the last 50 through 10,000). **Consistency** shows the share of those solves strictly under a target you type, with a rolling line and trend; **Distribution** shows round-edged bins with the median and your target marked; **Personal best** tracks every record; **Solves by weekday**; **Best averages** with the gap to your best. Charts redraw at their real size, show a tooltip on hover or touch, open the solve on click, and work with the arrow keys. See `docs/insights.md`.

DNFs stay in rolling windows and count as misses for targets. Averages trim the fastest and slowest 5%, rounded up. The consistency target starts at sub-10 over the last 1,000 solves. Its graph starts with the first complete window, scales its axis to the values it holds so a run sitting between 95% and 100% is still readable, and carries a dashed least-squares trend line; a range too short for one complete window says so instead of drawing an empty grid.

## Cube and scrambles

Start with **white up and green front**. Drag to orbit with inertia, use the arrow keys to change the viewing angle, or press Home to reset; the zoom level is fixed. Click the cube once to switch to the unfolded net, which uses the same cube state, and click again to return to 3D. Play the scramble, step forward/backward, or select a move to inspect its prefix.

The geometric engine supports `U R F D L B`, prime/double turns, wide moves (`Rw` or `r`), `M E S`, and `x y z`. Unsupported notation is displayed explicitly instead of being silently interpreted as a different move.

**Appearance** uses a rail for display mode (larger previews) and color theme (round swatches), leaving the larger workspace to a side-by-side square cube preview and controls. The preview is packed between equal divider gutters, so additional width belongs to the cube settings. The dialog itself never scrolls on wide screens; on narrow or short windows the sections stack instead. Its shell and temporary cube placeholder paint first; the cube behind it animates out and unloads before the preview is built. Closing reverses that sequence and materializes the background cube after the underlying screen is visible, so navigation never waits on two full renderers.

**Appearance → cube carousel** selects **Standard**, **Tiles** (formerly Studio), **Stickers**, **Speedcube**, or **UV Speedcube**, with a solved, rotatable preview. Press anywhere in the outer quarter of the preview on either side to move to the next or previous cube; the middle stays free for dragging the cube around and clicking for the flat net. The current cube slides out towards the side pressed away from and the next arrives from the side pressed, swapping models while it is off-frame. Dots below show the position in the list.

**Appearance → Cube colors** offers Washed and Vivid side by side. Tiles has raised glossy caps; Stickers has thick color films on the same rounded black body and carries the retail Rubik's center emblem with its wordmark, printed diagonally across the cap; Speedcube uses colored molded faces with separate center, edge and corner contours and a printed center emblem, based on the supplied reference; UV Speedcube is the same cube under a cured clear coat, so it differs only in surface — a near-mirror clearcoat with its own orange peel, and a studio holding the softboxes that coat reflects. Every model consumes the same palette, including the flat net and all scramble/playback previews. Model and palette save independently on this device. Old Studio preferences migrate to Tiles; removed palettes fall back to Washed. The local 3D renderer loads on demand, renders only during interaction/playback/resizing, and releases its resources when models change. If WebGL is unavailable, the standard preview remains usable.

**Appearance → Cross color** chooses the centre that points down whenever a cube is presented outside the live timer. The timer keeps its fixed scramble orientation; overview, solve details, trainer previews, Appearance, and the lighting studio use the preferred cross orientation. Existing preferences default to yellow-down, preserving the previous presentation until another cross is chosen.

**Appearance → Environment** switches the 3D cube between the generated bright Studio rig and a warm photographed Wooden lounge. The choice is saved with the other cube settings and applies to the timer, solve details, averages, and Appearance preview. The photograph is bundled locally; if it cannot be loaded, the renderer falls back to the generated studio instead of leaving the cube blank.

**Appearance → Lighting studio** opens a full-screen view with the cube on one side and an inspector on the other. The **Light** tab holds the lighting and material sliders (Lights, Material) with Reset and a pinned *Hardcode calibration* action; the **Cube** tab holds model, environment, quality, colors, core, cross color and surface wear, using the same controls as Appearance. Details in `docs/dialogs-and-controls.md`.

**Appearance → Surface wear** independently switches realistic cubes between pristine factory-new plastic and a handled finish with reflective hairline scratches. On the Stickers and OG Speedcube models, every vinyl film uses a differently oriented scratch-only cut from the supplied normal at cube-face scale, while nine films use cuts containing the curved fingernail impressions at varied off-center positions. Every film also samples a different close crop of the supplied handling normal at low clearcoat strength, producing soft fingerprint haze instead of sharp stamped prints. Sticker corners can still chip away to expose the modeled body underneath, and a torn edge now carries the film's own thickness: a shaded lip and a contact line stand in for the moulded rim the cutout removes, so a chip reads as torn vinyl rather than as a painted boundary. The piece bodies, core and ABS beneath the stickers retain their original plastic wear maps. The UV model has its own combined clearcoat map so scratches disturb the reflection on top of the coating. **Graphics quality** remains a separate dropdown: Balanced adds shadows; High adds per-cap colour variation and separate geometry for all 54 caps; Ultra adds screen-space occlusion, lens aberration and grain; Cinematic adds defocus, halation, lens distortion and a film grade. See `docs/graphics-quality.md`.

When launched locally, a worker uses [cubejs](https://github.com/ldez/cubejs) to generate random states and derive verified scramble sequences using two-phase solving. Several scrambles are prepared ahead of time. Standalone HTML mode uses clearly labeled random-move practice scrambles. This is a practice timer, not an official competition scramble source.

## Trainer

An **alg set** is a group of cases you drill together — PLL and OLL ship preloaded. Cases are subdivided into named groups, and each case is a card with its name, a preview of the case, and its preferred algorithm. OLL contains all 57 numbered cases, grouped by recognition shape, with one community-favourite algorithm per case. Pick cases with the round checks (or a whole group, or Select all) and press Train; one case is enough. Layout and shared controls are in `docs/trainer.md`.

Nothing stores a case as a cube state. The scramble is the algorithm reversed, so the cube on a card is always exactly the case that algorithm solves. Written rotations, wide turns and slice turns are all rewritten as outer face turns before anything else; the algorithm itself is never rewritten. Trainer previews first adopt the cross-down orientation selected in Appearance and then execute the case setup in that hold, keeping PLL and OLL on the actual upper layer. A sequence whose wide turns leave the cube held differently keeps its scramble upright and turns the cube first instead.

- **Previews** are the app's standard cube. The 3D/Top switch beside the set name turns every card into a flat algorithm-sheet diagram — the up face with the band of side stickers around it — and back.
- **Opening a case** shows it on a full cube with the playback controls, so the algorithm can be stepped through move by move or played until the cube is solved. A speed slider sets how fast a move turns, everywhere in the app. The list beside it holds every algorithm for the case; the star marks the preferred one, which is what the card shows. An algorithm added here is checked twice: the notation has to parse, and it has to solve this case — from any adjustment or any way of holding the cube — otherwise it is refused with a reason.
- **Training** starts once two or more cases are ticked, individually or by group. A round is either a number of attempts drawn at random from the selection, or a shuffled pass through every case in it. Each attempt picks one of the case's own algorithms, reverses it, and adds a random U turn before and after; it may also rewrite the whole scramble as seen from another lateral side, which is the same physical sequence in different notation. Every scramble is outer face turns only — no wide, slice or whole-cube turns — so it differs every time while the case stays the same. There is no cube during a round — it would give the case away. The timer works exactly as it does on the Timer screen, without inspection. Stopping it records the time against that case and moves to the next; Esc ends the round.
- **Per-case times** are attempts, best and mean, kept with the case and shown when it is opened.

## Verification and maintenance

Tests are a diagnostic, not a routine. Run them when a change is suspected of breaking behaviour or when you are chasing a reported issue, not after every edit.

No build step or package installation is needed. Run `npm test`, or:

```text
node --test tests/core.test.cjs tests/timer.test.cjs tests/trainer.test.cjs tests/server.test.mjs
```

Tests cover 1,000 mixed scrambles against the independent cubejs model, rotation rewriting and the case algebra behind the Trainer, every preloaded PLL algorithm, move identities, CSV compatibility, penalties, trimmed averages, target windows, timer transitions, inspection boundaries and expiry, exact video start triggers, single-press starting, touch-release behavior, independent video streaming and ranges, separate files, backups, conflict detection, and restart persistence. Server tests run in an isolated temporary folder. `node tests/rewards-interface.cjs` drives every Animation studio moment, popup placement, reduced motion and the static fallback in a real browser. `node tests/video-recording-interface.cjs` exercises configurable capture, asynchronous storage, the live feed, and the looping player in a real browser with a synthetic camera.

The interface was also checked in the browser for recording, penalties, import, duplicate detection, search, reconstruction playback, and responsive layouts.

Bundled dependencies: cubejs 1.3.2 (MIT), Three.js 0.160.1 and its geometry helpers (MIT), Inter and JetBrains Mono (SIL Open Font License). Their licenses are in `assets/vendor` (the font licenses are `inter-OFL.txt` and `jetbrains-mono-OFL.txt`). Text sizes and fonts are one set of tokens at the top of `assets/style.css`; see `docs/typography.md`. `node tests/library-interface.cjs` (solve library), `node tests/insights-interface.cjs` (Insights) and `node tests/reward-placement.cjs` (reward cards in the real timer) drive the real screens in a browser; `node tests/trainer-interface.cjs` drills a round in a real browser: preview modes, selection, algorithm validation, the preferred-algorithm star, and times surviving a reload. `node tests/cube-appearance.cjs` checks the compact average dialogs and cube styles in an isolated browser session; `node tests/scrollbars.cjs` checks the shared scrollbar (`assets/scrollbars.css`); `node tests/dialog-layout.cjs` checks the cube dialogs (column heights, transparent cube backgrounds, hidden list scrollbar, no extra captions); `node tests/env-check.cjs` checks the reflection-environment switch and its fallback (both require Playwright and Chrome).
