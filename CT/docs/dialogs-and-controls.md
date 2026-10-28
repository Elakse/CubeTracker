# Dialogs and shared controls

How the app's dialogs are built, and the pieces to reuse instead of writing new ones.

## One dialog, many bodies

There is a single `<dialog id="dialog">` in `CTU.html`. `showDialog(title, bodyHtml, className)` in `assets/app.js` fills it, opens it modally and returns. The class name picks the layout (`settings-dialog`, `appearance-dialog`, `delete-dialog`, `average-detail`, ...). `closeDialog()` plays the exit animation; `closeDialog(true)` skips it.

Shared chrome lives in `style.css` under the `dialog` / `.dialog-head` / `.dialog-body` / `.dialog-actions` rules: header with a round close button, 13px body text, a footer row for actions. Esc and a click on the backdrop close the dialog; an open dropdown menu takes the first Esc.

Focus: showing a dialog hands focus to the dialog itself (not the close button), so nothing is ringed on open. A field with `autofocus` keeps focus.

## Building blocks (all in `assets/app.js`)

| Helper | Use |
| --- | --- |
| `settingsGroup(label, content)` | A labelled group: small uppercase heading plus rows. |
| `toggleRow(control, checked, title, hint, cls)` | A row with a switch. The switch is a real `<input type="checkbox" data-control="...">`, so handle it in the `change` switch like any other control. |
| `linkTile(action, icon, title, hint)` | A tile that triggers a `data-action`. |
| `cubeSelect(control, label, table, current)` | A labelled dropdown over an `{ value: { label } }` table. |

Group headings use `.group-label` (optionally with a `.group-value` span on the right). Round swatch choices (core, cross colour, colour theme) share the `.cube-cross-options` / `.cube-core-options` rules.

Layout notes for the two big dialogs:
- **Settings**: one scrollable list of groups (Timer, Cube, Video, Workspace) with a fade at the bottom and a pinned Done. Rows are whole-row targets with a hover tint and no rules between them; the Video options open under their switch, and the three Workspace links sit side by side. To add a setting, append a `toggleRow` to the right group's list in `settings()`. Timer group: **Hide time while solving** (`pref.hideTimeWhileSolving`, default on) replaces the running time with `···` on the Timer, in Trainer rounds and on the virtual timer (`HIDDEN_TIME` in `tick()`, `ctx.hideTime()` in the playground); inspection counts and the final result are never hidden.
- **Appearance**: a fixed-height grid (rail | divider | cube pane). The Core row also holds the **Floor shadow** switch on its right (`cube-floor-shadow`, a shared `toggleRow`). It is saved in `pref.cubeFloorShadow` (default on) and is *live*: it is not part of a cube's identity, so it never rebuilds a cube or shows the loading shell. `setFloorShadow()` in `cube-realistic.js` hides the floor plane on every live cube, and `loadCubeStudio()` in `app.js` applies the saved value the first time the renderer module loads, from any screen. Not in the Lighting studio yet. The Display mode tiles stretch to fill the rail; the cube pane aligns its first row with the rail's. Below 1050px wide or 720px tall everything stacks and the dialog scrolls as one.
- **Cube playground**: the shared settings shell holds a 460px scrolling control column and a dedicated live cube preview on the right. The preview uses the same surface as the dialog, with a divider matching Appearance. Below 900px wide or 650px tall it stacks above the scrolling controls. Controls and both cube stages share saved view/zoom settings; see `cube-playground.md`.

## Shared controls and sizes

One set of controls is used on every screen, so a new screen should reuse them and not restyle its own:

- `.btn` (40px, 12px radius) for text buttons, `.tool-btn` for a 40px icon or tool button, `.icon-btn` for the small round ones.
- `.segmented`: the one toggle (a row of buttons, the active one filled dark). Used by the Solve library filter, Trainer 3D / Top, Insights ranges and Overview ranges. Do not build another toggle style.
- Dropdown triggers are 40px high (`.dd-trigger`); `data-dd="compact"` caps the width at 240px for toolbars.
- `.case-check`: the round check for any multi-select (Trainer cases and groups).
- Numbers shown in a strip: `.lib-summary` / `.lib-stat` on list screens (Solve library, Trainer); `.ov-stats` / `.ov-stat` is the single card of big numbers on Overview.
- Timer side panel: `.panel-stats` is plain (no card): four `.stat-button`s with the number and one lowercase word under it (best, mean, ao5, ao12). ao5 and ao12 add a small `PB x.xx` line; the longer hint (for example "All-time single") is the button's `title`. The solve list below uses `.solve-entry` rows: rounded hover shape, with a straight hairline drawn by `::after` and inset by 12px so the rounded corners are never cut.

## Scrollbars: `assets/scrollbars.css`

One scrollbar for the whole app: 12px wide, no track, a rounded thumb that is a muted tint of the text colour (works in every theme through `--muted`), darker on hover and the accent green while dragging. Tokens: `--scroll-size`, `--scroll-thumb`, `--scroll-thumb-hover`, `--scroll-thumb-active`.

- It is a universal `*::-webkit-scrollbar` rule, so any new scroll container gets it for free. Do not add per-element scrollbar styling.
- **Never set the standard `scrollbar-width: thin` or `scrollbar-color` on an element.** Chromium then ignores every `::-webkit-scrollbar` rule for it and the native bar comes back. (`scrollbars.css` only uses them for Firefox, inside `@supports not selector(::-webkit-scrollbar)`.)
- Scrollbars hidden on purpose stay hidden (dialogs, the Timer solve list, Settings, the average solve list, the algorithm and round lists): their own selectors set `scrollbar-width: none` and `::-webkit-scrollbar { width: 0 }`, which win over the universal rule. A hidden list should show a cut-off row as its hint.
- The page itself (Solve library, Trainer) shows the shared bar at the window edge.
- `node tests/scrollbars.cjs` checks the shared look in light and dark, that no element uses the standard properties, and that the hidden ones stay hidden.

## Separators

Rules are reserved for the big halves of a screen (Appearance: the vertical line between the theme rail and the cube area, and the same line when they stack; the studio: the line between canvas and inspector). The cube preview and its settings share one area and have no line between them. Rows, groups and footers inside a dialog are separated by space alone. A scrolling region that would otherwise end in a hard edge uses the shared `.scroll-fade` class instead of a rule.

## Sliders: `assets/slider.js`

Every `<input type="range">` gets the shared look automatically (the "slider" block in `style.css`): just a track and a thumb, no box. The script only keeps the `--fill` variable (the coloured part of the track) in step with the value, including when code assigns `input.value`. `window.Slider.sync(input)` is there if a value is ever changed some other way.

## Dropdowns: `assets/dropdown.js`

Every `<select>` is enhanced automatically (a MutationObserver watches the page, so selects that arrive with a re-render are picked up). The native `<select>` stays in the DOM, invisible, and remains the source of truth: read and write `select.value`, listen for `change`. Nothing else is needed.

```html
<select data-control="x">…</select>             <!-- default look -->
<select data-dd="compact" data-control="x">…</select>   <!-- filters, toolbars -->
<select data-native>…</select>                   <!-- keep the browser's picker -->
```

- The menu opens below or above the trigger depending on room, lives inside the open dialog (so the modal does not make it inert) and is promoted to the top layer with the Popover API so a dialog's own transform cannot clip it.
- Keyboard: arrows, Home/End, type-ahead, Enter, Esc (closes only the menu), Tab.
- Touch devices (`pointer: coarse`) keep the native picker. `.mobile-category` is `data-native` for the same reason.
- `window.Dropdown.closeOpen()` closes an open menu and returns whether there was one; the dialog's `cancel` handler uses it.
- Styles: the "dropdown" block in `style.css` (`.dd`, `.dd-trigger`, `.dd-menu`, `.dd-option`).

## Floating popovers: `assets/popover.js`

`FloatingPopover.create({ anchor, panel, floating, restoreFocus, onOpen, onClose })` returns `toggle()`, `close()`, `place()`, `destroy()` and an `open` getter. It shares the date picker's viewport fitting, outside-click dismissal (including clicks whose targets were repainted), trigger `aria-expanded`, resize handling and Escape behavior. Call `destroy()` when its owning screen or dialog is replaced. `closeOpen()` supports the app's dialog cancel handling.

The Solve library uses relative positioning so its calendar's original appearance, animation and phone layout remain unchanged. `floating: true` is for pickers inside scrolling dialogs: the surface stays inside the modal and uses the Popover API's top layer, fixed viewport placement, above/below fitting, and repositioning on scroll. Tab dismisses a floating picker; Escape restores focus to its anchor and takes precedence over closing the surrounding dialog. Content owns its own arrow-key navigation. The playground's key-action picker uses this mode.

## Lighting studio

Full-screen view (`lightingStudioPage()` in `app.js`, styles under "cube lighting studio" in `style.css`): the cube canvas on the left and an inspector on the right with a fixed header, **Light** and **Cube** tabs (`data-studio-tab`, remembered in `lightingTab`), a scrolling body and, on the Light tab, a pinned footer holding the "Hardcode calibration" action.

- **Light tab**: sliders come from `LIGHTING_CONTROLS`; each entry has a `group` ("Lights" or "Material") that decides where it appears. `lightingControl()` renders one row (`.tune`); the filled track is the `--fill` CSS variable, kept in sync by `tuningFill()`.
- **Cube tab**: uses the shared `cubeSelect`, `paletteChoices`, `coreChoices`, `crossChoices` and `toggleRow` helpers, which Appearance also uses. The `prefix` argument (`cube` or `studio`) picks which click handlers answer. Add a new cube setting once in those helpers and both screens get it.
- Standard model: nothing to tune, so the Light tab shows an empty state with a "Switch to Tiles" action (`studio-use-realistic`).
- Esc closes, in order: an open dropdown, the confirm card, then the studio.

## Cube loading and the Appearance carousel

Nothing about a cube should be built while you are swiping, so it is built earlier, in layers (all in `cube-realistic.js`, driven from `app.js`):

1. **Page load, when idle** (`warmCubeStudio` → `warmAll`): the renderer module, shared textures, the chosen environment photograph and the procedural geometry of every model, one small slice at a time. It waits out a timer attempt. Geometry is cached once per shape (`cachedGeometry`); each cube gets a cheap copy it may dispose on its own.
2. **Appearance opens** (`prewarmAppearance`): once the dialog's own cube is up, the other models are built in the background, rendered once to compile their shaders, and parked. Switching models then only swaps canvases, with no loading shell (`isAppearanceWarm`). Changing quality, environment, wear or core rebuilds them for the new settings.

If a new model needs extra shapes, add them to `warmGeometry` (it mirrors what the constructor builds through `capPlan`).

## Adding a script or asset

`server.mjs` serves only an allowlist of files. A new file under `assets/` that the page loads must be added there, and `capabilities.environments` bumped so the launcher replaces a server still running old code. `tests/server.test.mjs` fetches every file `CTU.html` references and fails if one is missing from the list.

## Tests

`tests/cube-appearance.cjs`, `tests/appearance-loading.cjs` and `tests/env-check.cjs` drive the Graphics quality and Environment dropdowns through `selectOption` / the menu's `option` roles. They use Windows paths for Chrome and Playwright, so they run on this computer, not in the cloud workspace.

Title and rust rewards are not dialogs: they are the `.timer-achievement` card owned by `Motion` in `assets/timer-effects.js`, which reuses rank-card materials. See `rewards-and-rank-cards.md`.

## Cube dialogs

Every dialog that holds a cube (solve, AO5/AO12, trainer case, Appearance) lets the cube sit directly on the dialog surface: no tint, border or radius of its own. The loading cover uses `--cube-loading-bg` (set to `--paper` on `dialog`) so it matches too. Only the lighting studio canvas keeps its own backdrop.

- Solve dialog: `.detail-visuals` is a flex column, `.detail-cube` grows to fill it and the stage takes the remaining height, so the cube column is as tall as `.detail-side` with or without a recording.
- Average dialogs: `.average-selected` is a flex column. The grid grows with the pane, the cube fills it and the note textarea absorbs spare height, so nothing is left empty under the cube. The solve list (`.average-solves`) scrolls with its scrollbar hidden; the cut-off row is the cue that it scrolls. The heading only says "Solve #N"; there are no "counted" or "click cube" captions.
- `node tests/dialog-layout.cjs` checks all of this in a real browser (Chrome and Playwright; slow without a GPU).
