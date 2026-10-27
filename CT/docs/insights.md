# Insights

The screen is one component, `assets/insights.js` (`window.CTInsights`), styled by `assets/insights.css`. The app (`app.js`, "Insights" section) only supplies data and actions.

## Pieces

| Part | Where | Job |
| --- | --- | --- |
| Model | `CTInsights.niceTicks / histogram / records / bestAt / weekdayCounts / regression / bestAverage / sample / autoWindow` | Pure functions, covered by `tests/insights.test.cjs`. |
| View | `CTInsights.create(host, ctx)` | Builds the five cards inside `host`, draws the charts, returns `{ destroy }`. |
| Glue | `insightsContext()` in `app.js` | Hands over the range's solves, the target, formatting, `openSolve` and icons. The component never imports app code. |

## One range, one target

- The range menu at the top (latest 50 ... 10,000, or all) decides which solves every card uses. Its value is `pref.insightsRange`; Insights starts at the latest 1,000. There is no category dropdown on this screen: the sidebar switches category.
- The target is the only setting on the Consistency card (`pref.target`, shared with Overview).
- **Headline %:** solves in the range strictly under the target (+2 counted, DNF a miss), as "407 of 1,000". Below it, the latest rolling value compared with the range as a whole.
- **Rolling line:** the same share, rolling over `autoWindow(n)` solves: a tenth of the range, between 20 and 500, always leaving at least two points. A note under the chart says how many solves each point covers. (Overview keeps its own "Last N" window, `pref.window`.)

## Charts

- Each chart is an SVG drawn at its box's real pixel size by `chartBox()` and redrawn by a `ResizeObserver` when the box changes width. Nothing is stretched.
- Hover shows a guide, a dot and a tooltip; clicking opens the solve (consistency and personal best). On touch, a tap shows the tooltip and tapping the tooltip opens the solve. Arrow keys move along a focused chart, Shift jumps 10, Enter opens, Escape hides.
- Long series are thinned with `sample()` (extremes of the ends are kept). The personal-best line is a step path through the records only.
- Distribution bins sit on round edges (`histogram()` picks 0.5 s, 1 s, 2.5 s ...), at most 14 of them. Bars that end at or below the target are drawn dark.
- Weekday highlights the busiest day only when one day is clearly the busiest.

## Motion

Charts draw in, bars rise and the headline counts up once per visit: `insightsSeen` in `app.js` is reset when you leave the screen, and a re-render caused by changing the target or range does not replay it. Reduced motion turns it all off.

## Changing it

- New card: add a `card(...)` in `create()` and a grid span in `insights.css`.
- New chart: use `chartBox(el, height, draw)`; `draw` returns `{ svg, count, nearest, at }` and gets hover, touch and keyboard for free.
- `tests/insights-interface.cjs` runs the real screen in a browser.
