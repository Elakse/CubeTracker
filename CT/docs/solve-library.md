# Solve library

The screen is one component, `assets/library.js` (`window.CTLibrary`), styled by `assets/library.css`. The app (`app.js`, "Solve library" section) only supplies data and actions.

## Pieces

| Part | Where | Job |
| --- | --- | --- |
| Model | `CTLibrary.select / rangeBounds / dayLabel / monthGrid / defaultState` | Pure functions: which solves match, in which order, what the calendar looks like. Covered by `tests/library.test.cjs`. |
| View | `CTLibrary.create(host, ctx)` | Builds the toolbar and list inside `host`, returns `{ refresh, update, results, destroy }`. |
| Glue | `libraryContext()` in `app.js` | Hands the component the app's solves, formatting, `openSolve`, `penalty`, `requestDeleteSolve`, copy and preference saving. The component never imports app code. |

## Behaviour worth knowing

- **State** (`CTLibrary.defaultState()`) lives in `libraryUI` in `app.js`, so it survives leaving and returning. Filters reset when you change category. `group` and `T` are saved in preferences (`libraryGroup`, `libraryT`); T starts at your Sub target.
- **Search** repaints once, 140 ms after the last key, in place. The input is never re-created, so focus and caret never move. Matching runs on a cached lowercase string per solve.
- **Filters:** All / Sub T (strictly under T seconds, +2 counted, DNF never) / +2 / DNF. Every toolbar item has a fixed size, so nothing shifts when one is chosen; the highlight is a sliding thumb.
- **Dates:** presets, or click a first and a last day. Days with solves carry a dot. The footer shows how many solves the range holds.
- **By day:** a switch. On, a heading with the date and the count sits above each day (only while sorted by Solve; sorting by Time ungroups and greys the switch). Off, every row shows its own date.
- **Rows** are exactly one height. The scramble and at most one line of note (cut with an ellipsis) share the row. The full note is in the solve dialog, which also refreshes the list when it closes.
- **Animation:** the list is repainted by key with FLIP: rows that stay slide, new ones fade up, removed ones fade out, only near the viewport. Reduced motion turns it all off.
- **After a change** to the solves (penalty, delete, undo), the app calls `refreshView()`, which repaints the library in place instead of rebuilding the page.
- **Export** uses `libraryItems()`, the same list the screen shows, in chronological order.

## Changing it

- New filter: add it to `FILTERS` and `select()` in `library.js`, add a test to `tests/library.test.cjs`.
- New column: change the `grid-template-columns` of `.lib-cols, .lib-row` (and its two `@media` overrides) and add the cell in `rowHTML()`.
- `tests/library-interface.cjs` runs the real screen in a browser.
