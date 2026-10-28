# Cube playground

The cube playground is the interactive cube used by **Timer** when a virtual category is selected. It has Scramble, Reset, and one settings dialog. Virtual solves record in the existing category library; see `virtual-solves.md` for timing, category lifecycle, persistence and reconstruction playback. Cube state survives navigation during the current app session; settings and key assignments survive reloads on this device.

## Controls

The default view faces the green front with the white top visible. Moves use physical cube coordinates; changing Pitch or Yaw changes only the camera. `x`, `y`, and `z` assignments rotate the actual cube, including its centres.

Default keys: E / O → B / B′, S → U, ; → U′, D / F → L′ / F′, K → F, L → R, C → L, V → D′, M → D, comma → R′, Left / Right Shift → x′ / x, Left / Right Alt → y′ / y, Space → M′. **1 scrambles and 2 resets** (the same as the Scramble and Reset buttons). `Digit1` and `Digit2` are reserved: the key map shows them greyed (Scr / Rst), they cannot be assigned, and `defaults()` drops them from any saved map. Settings shows every assignment on a keyboard-shaped map. Click a key, choose an action, or Clear it; no notation entry is required. Restore default keys resets the map only.

All face turns, slices, wide turns, and whole-cube rotations have quarter, inverse, and double options. Physical key positions (`KeyboardEvent.code`) keep the layout stable across keyboard languages. Space and the left and right Shift, Ctrl and Alt keys can be assigned independently. A modifier used alone performs its move on release; using it as part of a shortcut or chord cancels its own move. Tab reaches every key, Enter or Space opens its picker, arrows and Home/End navigate actions, and Escape closes the picker before the settings dialog. Gameplay ignores typing, modifier shortcuts, repeated keydown events, dialogs, and focused app controls.

## Display and motion

The default renderer uses all 54 standard CSS stickers, in their engine positions and orientations, with both sides visible. Separation increases tangential spacing and each face plane's distance independently. Thus even stickers sharing the same corner or edge separate; hidden faces remain in place and become visible through the gaps. Outlines, outline thickness and corner radius affect only this exploded display. Outline thickness is saved independently and can be adjusted from 0.5 to 10 pixels; its control is disabled when outlines are off.

**Use app cube**, off by default, adopts Appearance's model, palette, material, environment, and quality settings. The playground keeps its own camera and fixed initial white-up/green-front frame. Turning the option off returns to the exploded display without losing cube state.

The settings dialog has a live cube preview beside its narrower controls. On phones and short windows, the preview stacks above the scrolling settings. Preview and main cube share the same physical state and camera settings. Scroll over either cube to zoom; the saved multiplier is bounded between 0.45 and 1.8. Scroll over the controls to scroll the settings normally. Ctrl-wheel keeps the browser's own zoom behavior.

**Perspective strength** changes convergence from nearly parallel to stronger perspective. It is independent of Pitch, Yaw and zoom. Both renderers use the same focal length, camera distance, cube-unit scale and rotation convention, so the preview remains representative when changing cube models or window sizes.

With **Use app cube** enabled, **Explode app cube** separates that model's actual outer surfaces and hides its inner piece bodies and core. Existing films, tiles, molded surfaces, exposed rims, textures, wear and logos move with their stickers, including independent separation between surfaces on one corner or edge. Both sides remain visible. The separation slider is available in either exploded mode. Sticker outlines and corners stay visible but disabled while using the app cube; these controls only affect the standard exploded renderer.

**Show animations** defaults on. When enabled, moves use `CubeScene.step()` and the Trainer's speed preference, slider direction, smoothstep easing, reduced-motion handling, and realistic-renderer animation lifecycle. Queued key presses execute in order. Scramble and Reset clear the queue and immediately replace the state.

## Implementation

- `assets/cube-play.js`: screen markup, settings normalization, saved key map, input routing and move queue. App dependencies are passed into `create()`; it does not know the library or persistence implementation.
- `CubeScene` in `assets/app.js`: accepts optional `gameplay` settings. Its existing cube engine, renderer selection and step animation remain shared. Gameplay disables the usual orbit/net keyboard handlers so cube rotations cannot be confused with camera changes.
- The settings preview is a second `CubeScene` in the `cube-play-preview` renderer slot. It shares the engine cube with the main stage, receives its animated draw frames, and releases its renderer when settings close. A settings-only resize observer keeps it fitted without rebuilding controls.
- `RealisticCube.draw()` accepts optional separation, leaving ordinary app scenes on their existing path. Active surface explosion hides `bodies` and `innerCore`, makes cap/mark materials double-sided, and adds the same position/normal displacement as CSS in cubie units. Closing the gaps restores normal bodies and original material sides. The packed cube's depth-based motion-blur mask is omitted during surface explosion; geometric move animation remains active.
- `RealisticCube.setPlaygroundView()` and `updateProjection()` calibrate the playground's camera: CSS sticker units are 46 pixels per cubie, focal length is the stage's CSS perspective distance, and WebGL camera distance is focal length divided by the displayed cubie scale. Other app screens retain their existing camera, field of view, and orbit behavior.
- `stickerMatrix()` accepts optional separation. Omitted separation preserves all existing cube views.
- `assets/cube-play.css`: stage and keyboard layout; controls, sliders, switches, dialog chrome and theme tokens come from the app.
- `pref.cubePlay`: saved display settings and bindings; `pref.trainerSpeed` remains the shared move speed. `virtualSessions` holds each category's authoritative input-state cube; the screen's cube follows it visually through the existing animation queue.
- The playground resizes through its own `ResizeObserver`; the app's chart resize redraw and background timer-scramble arrivals do not rebuild it or interrupt an open settings dialog.
- Assets are in the server allowlist; the launcher requires `capabilities.environments = 7`.

Run `node tests/cube-play-interface.cjs` for the isolated browser workflow. It covers engine-consistent sticker transforms, inverses and rotations, separation, instant and animated input, saved settings, clearing and choosing keys inside a modal, the selected realistic cube, responsive layout, and the calendar's shared popover. The test server uses an in-memory sample library, never the user's files.

`node tests/cube-play-keybindings.cjs` checks Space and independent left/right modifier assignments, modifier chords, persistence and the phone keyboard layout.

`node tests/cube-play-preview.cjs` checks the live preview and responsive dialog, wheel zoom on both stages and its bounds, perspective, CSS/WebGL projection alignment, normal and exploded Tiles with the original material instances, body/core visibility, disabled controls, persistence, and the printed Stickers logo during rotations.

`node tests/cube-play-models.cjs` exercises normal and exploded rendering directly for Tiles, Stickers, Speedcube, UV Speedcube and OG: original app camera, hidden bodies/core/floor, unchanged material instances, same-corner separation, intermediate move frames, logo attachment and restoration to a packed cube. This keeps renderer coverage independent of Appearance's layout assertions.

## Start position

Scramble and Reset always set the cube down the way the **bottom cross colour** from Appearance (`pref.cubeCross`, `CUBE_CROSSES[...].rotation`) is held: the scramble is applied first, then the whole-cube turn. The app passes it as `ctx.orientation()`; without a session, `reset()` applies it to the playground cube directly. Changing the cross colour takes effect at the next Scramble or Reset.
