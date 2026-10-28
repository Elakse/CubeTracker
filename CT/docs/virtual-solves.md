# Virtual categories and solves

Select **3x3 Virtual** under **Categories → Virtual**, then open **Timer**. Timer uses the interactive cube for virtual categories and the existing physical timer for regular categories. Overview, Solve library, Insights, penalties, notes, deletion, export and category management continue to use the same category and solve records.

## An attempt

The virtual cube opens scrambled, in inspection. Whole-cube rotations (`x`, `y`, `z`, including inverse/double turns) let you inspect without starting the clock. The first face, slice or wide move starts timing. When every face is uniform, the attempt stops and saves once, in any cube orientation. The final move is part of the saved reconstruction.

Timing measures accepted keyboard input using the monotonic clock, independently of animation speed. An authoritative engine cube accepts moves in order; the renderer follows with queued turns. Finishing saves against that input state before awaiting visual frames, so quickly leaving the screen cannot lose the last move or send it to another category. Input after completion is ignored until Scramble or Reset. Scramble begins a fresh inspection. Reset cancels the attempt and provides an untimed solved cube for practice; press Scramble to arm recording again.

Screen/category changes retain unfinished attempts and their original clock in memory. Returning resumes the same input state, including moves whose animations were interrupted. Reloading closes unfinished attempts; completed solves and reconstructions are durable. Settings, live preview, mouse-wheel zoom, perspective, keyboard bindings and both cube renderers are unchanged. Camera/view controls never count as cube moves.

## Category lifecycle and compatibility

Categories have `type` (`physical` or `virtual`) and virtual categories have `puzzle: "3x3"`. Missing type means physical. `assets/virtual.js` centralizes category capabilities and virtual timing rather than duplicating the library or statistics model. Future puzzle capabilities can extend this registry and session implementation.

The additive migration sets `categoryTypesVersion: 1` and creates one empty virtual category if it has never been initialized. Existing category IDs, names and solve objects remain intact, including a physical category coincidentally named “3x3 Virtual”. Selection stays on the existing category. Deleting the virtual category does not cause it to reappear on reload.

Virtual deletion uses the existing confirmation and Undo flow. Its complete record moves to `archivedCategories`, retaining IDs, filename, solves and reconstructions. The deletion dialog explains this. **+ 3x3 Virtual** explicitly restores that history; it creates a new empty category only when no history exists. Undo and recreation cannot create a second active 3x3 virtual category. Regular category deletion and its CSV behavior remain unchanged.

New timer records have explicit `source`; legacy records infer it from their category. The physical timer rejects virtual categories, and native category changes are blocked during a physical attempt. Virtual completion captures its own category ID. The saver rejects incompatible sources and category type changes instead of silently converting data.

## Reconstruction and storage

A virtual solve retains ordinary `rawMs`, `penalty`, `scramble`, `date` and `note` fields, plus:

```json
{
  "source": "virtual",
  "reconstruction": {
    "version": 1,
    "inspectionCount": 2,
    "moves": [
      { "move": "x", "atMs": 0 },
      { "move": "x'", "atMs": 0 },
      { "move": "U'", "atMs": 0 },
      { "move": "R'", "atMs": 1234 }
    ]
  }
}
```

The original scramble, then the optional `orientation` (whole-cube turns such as `x2`, at most four, no face turns), then every recorded move reproduces the solved state. `orientation` is the bottom-cross hold the attempt started in (`Attempt.prepare(scramble, orientation)`); it is omitted when empty, so older solves are unchanged, and the solve detail replay uses it as part of the setup. Inspection rotations precede `inspectionCount`; their timestamps are zero. Timed timestamps are monotonic milliseconds since the first real move. The saver validates notation, timestamp order, source, inspection boundaries and the final solved state. A category can also hold explicitly imported/manual virtual times without reconstruction.

Solve details reuse `CubeScene` playback with the original scramble as setup and the reconstruction as its move list. First/last, play/pause, stepping, selecting tokens, 3D/net and notes work as usual. Token titles identify inspection rotations or their recorded timestamp. Playback uses the shared move speed rather than replaying the original pauses. Regular details continue showing scramble playback.

`.cubetracker.json` stores active and archived metadata and full reconstructions. The connected-folder path now writes this manifest as well as CSVs; standalone browser storage retains the same full state. Before writing, it verifies that an existing workspace's records are present in the browser library, then checks the manifest for external changes before every save. Conflicts preserve the existing folder and retain the browser recovery copy.

Ordinary CSVs retain exactly `Index,Time,Scramble,Date`. CSVs containing virtual solves append `Source,Reconstruction,RawMs`, preserving their first four columns and round-tripping the reconstruction JSON and underlying DNF duration. Importing such a file requires selecting a virtual destination explicitly. A regular four-column CSV can still be deliberately imported into a virtual category, without inventing reconstruction data.

The server asset/launcher handshake is `capabilities.environments: 8` because both client and saver load `assets/virtual.js` (8 added the reconstruction `orientation`; a server still running version 7 would reject solves started with a non-yellow cross). No new dependency or build step is required.

## Verification

- `node --test tests/virtual.test.cjs`: additive/idempotent migration, inspection and timing rules, solved holds, reset/duplicate protection, validation and CSV round trips.
- `node tests/play-shortcuts.cjs`: 1/2 shortcuts, locked keys in the key map, cross-colour start position stored as `orientation`, and Hide time while solving on the physical and virtual timers.
- `node tests/virtual-interface.cjs`: isolated physical and virtual categories, exact timing in instant/queued modes, save/reload/playback, analysis navigation, leaving with pending animation, deletion/reload/restore and phone category selection.
- `node --test tests/server.test.mjs`: real temporary-folder save/restart, legacy solve preservation, virtual CSVs, archive restoration and rejection of invalid reconstruction/source.
- `node tests/virtual-folder.cjs`: standalone saves to a mock in-memory folder, including full metadata and preservation of external changes/different existing workspaces.
- Existing timer, core, library and playground tests continue covering their shared behavior. The old `#play` URL redirects to Timer with the virtual category selected; there is no separate Playground navigation tab.
