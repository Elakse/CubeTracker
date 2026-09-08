# CubeTracker

A local speedcubing workspace with an interactive 3D cube, timer, solve library, and progress analytics.

## Open it

Double-click **Start CubeTracker.cmd**. It opens [CubeTracker](http://127.0.0.1:4173) and runs the local saver in the background. Node.js 22 or newer is required; it is already available on this computer. Use **Stop CubeTracker.cmd** when you are finished.

1. Create a category with any name you like, or import an existing CSV into a new category.
2. Open **Timer**. Hold Space until the time turns green, then release. Press any key to stop. On touch screens, press and hold the timer, then tap to stop. Enter provides an instant-start alternative when the timer is focused.
3. Every attempt saves automatically to that category's CSV in this folder. Change a penalty with **OK**, **+2**, or **DNF**. Deleted solves can be restored with **Undo**.

The app also works by opening **CTU.html** directly, with the `assets` folder beside it. In this mode, data initially saves in the browser. Use **Storage details → Connect a folder** in a supported browser to enable automatic CSV writes, or use **Export CSV**. Folder access must be reconnected after reopening. The launcher is the easiest way to get automatic saving beside the HTML.

## Your files

- Category CSVs use `category-name-unique-id.csv`. Importing preserves the source file and creates a working copy for continued recording. Renaming a category keeps its existing filename.
- `.cubetracker.json` stores the complete library, category names, underlying DNF times, and solve notes. CSV files are portable copies in the original four-column format. Keep this file with your folder to preserve the full workspace.
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

The fullscreen timer (the expand button on the Timer page, or **F**) shows only the running time while you solve. Between solves it adds the next scramble across the top and the 3D cube below. Moving the pointer reveals the last five solves, the penalty controls, and the exit button for a few seconds. **Esc** leaves fullscreen.

## Explore

- **Overview:** rolling ao5/ao12/ao100, personal best, mean, recent solves, activity, and a configurable consistency target.
- **Timer:** keyboard and touch controls, optional 15-second inspection, a fullscreen mode, manual entry, and automatic saving. With inspection enabled, a normal press starts inspection immediately; holding for 350ms is only required to start the solve afterward. Inspection gives +2 at 15 seconds and DNF at 17 seconds; the solve itself is still timed.
- **Solve library:** search, result and date filters, sorting, pagination, and filtered CSV export. Open a solve to inspect the scramble, add a note, or change its penalty.
- **Insights:** percentage of the last *n* attempts strictly under *t* seconds, its rolling history, distribution, standard deviation, median, personal-best progression, best averages, and practice by day/hour.

DNFs stay in rolling windows and count as misses for targets. Averages trim the fastest and slowest 5%, rounded up. The target graph starts with the first complete window; the headline explicitly shows the smaller available sample while a window is being built.

## Cube and scrambles

Start with **white up and green front**. Drag to orbit with inertia, use the arrow keys to change the viewing angle, or press Home to reset; the zoom level is fixed. Click the cube once to switch to the unfolded net, which uses the same cube state, and click again to return to 3D. Play the scramble, step forward/backward, or select a move to inspect its prefix.

The geometric engine supports `U R F D L B`, prime/double turns, wide moves (`Rw` or `r`), `M E S`, and `x y z`. Unsupported notation is displayed explicitly instead of being silently interpreted as a different move.

When launched locally, a worker uses [cubejs](https://github.com/ldez/cubejs) to generate random states and derive verified scramble sequences using two-phase solving. Several scrambles are prepared ahead of time. Standalone HTML mode uses clearly labeled random-move practice scrambles. This is a practice timer, not an official competition scramble source.

## Verification and maintenance

No build step or package installation is needed. Run `npm test`, or:

```text
node --test tests/core.test.cjs tests/timer.test.cjs tests/server.test.mjs
```

Tests cover 1,000 mixed scrambles against the independent cubejs model, move identities, CSV compatibility, penalties, trimmed averages, target windows, timer transitions, inspection boundaries, touch-release behavior, separate files, backups, conflict detection, and restart persistence. Server tests run in an isolated temporary folder.

The interface was also checked in the browser for recording, penalties, import, duplicate detection, search, reconstruction playback, and responsive layouts.

Bundled dependencies: cubejs 1.3.2 (MIT), DM Sans and Manrope (SIL Open Font License). Their licenses are in `assets/vendor`.
