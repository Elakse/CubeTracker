# Trainer

The Trainer screen is one page: heading, summary strip, groups of case cards, and a floating Train bar.

## Layout
- **Heading**: title on the left; on the right the algorithm-set picker and the set menu (`manage-set`, rename or delete the set).
- **Summary strip**: reuses the Solve library's `.lib-summary` / `.lib-stat` (cases, groups, selected). On the right: the 3D / Top preview toggle (the shared `.segmented`) and one Select all / Clear selection button (`#trainer-select`, rebuilt by `refreshTrainBar`).
- **Groups**: `.case-group` with a round check (selects the whole group, shows a dash when partly picked), the name and a count. No divider lines. Every grid ends with a dashed **Add case** tile (`.case-add`, carries `data-group`); the page ends with a dashed **New group** button (`.group-add`). There is no Add button in the heading any more.
- **Cards**: name top left, round check top right (always visible), cube, then the preferred algorithm (two lines at most). Clicking the card opens the case dialog; the check only selects.
- **Train bar**: appears as soon as one case is picked (it needed two before). One case: only "Attempts" is asked. Two or more: Random draw / Every case plus the count.

## Shared pieces
- `.tool-btn`, `.segmented`: 40px controls, the same ones every screen uses (see `dialogs-and-controls.md`, Shared controls). The trainer heading's dropdown is sized to match through `body.trainer-view`.
- `.case-check`: the one round check (input stays the real control, `:has()` draws the checked / indeterminate state). Reuse it for any new multi-select.
- The `more` icon is only dots; `.icon-btn.tool-btn svg` thickens them so the button is readable.

## Training round
`.training-head`: set name, `n / total`, a thin progress meter (`#training-meter-fill`, updated with the counter), End round. The side list is "This round".

## Tests
`node tests/trainer-interface.cjs` covers selection, the one-case Train bar, the round and playback (run it on the computer with Chrome). `node tests/trainer-previews.cjs` covers 3D / Top previews.
