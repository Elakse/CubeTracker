# Rewards and rank cards

Two systems share one set of materials: the **rank card** (Overview, Animation studio side panel, "Title unlocked" popup) and the **reward effects** (the full-screen moments after a solve). Neither draws anything on its own: effects are chosen by pure code and painted by a separate engine.

## Files

| File | Job |
| --- | --- |
| `assets/timer-effects.js` | `CTEffects`: record/title logic, `plan(event, rng)` (which effect and which card text), `demoGroups()` / `demoEvent(id)` for the Animation studio, `Motion` (label DOM, card placement, inspection and entrance motion). No drawing. |
| `assets/reward-fx.js` | `CTRewardFX.create(host)`: viewport canvas engine and the effect registry (`ripple`, `accident`, `shatter`, `settle`, `prism`, `breach`, `seal`, `sunrise`, `aurora`, `warp`, `forge`, `singularity`, `oxidation`, `polish`, `thud`). |
| `assets/rank-cards.js` | `CTRank`: mounts a card's decoration layers, a WebGL PBR shader for steel/bronze/obsidian tiers, and the canvas fire for tier 9. |
| `assets/rank-cards.css` | Every tier and its rusty variant, plus tier 0 ("building your title"). |
| `assets/style.css` (`.timer-achievement`) | Reward label/modal layout, the lift of the timer block, and the `html[data-reward-motion]` switch. |

## How an event flows

1. `app.js` builds an event (`records`, `special`, `barrier`, `rusty`, `recovered`, `worst`, `status`, `time`).
2. `CTEffects.plan(event)` returns `{ id, card, data }`. Solves under `MIN_REWARD_SOLVE` (2.5 s) always return `accident`, whatever else happened.
3. `Motion.celebrate` runs `CTRewardFX.play(plan)` for effects, or just `present(card)` when motion is off.
4. `present(card)` makes the label. With `card.tier` it becomes a rank card (same CSS as Overview); otherwise it uses a plain `gold`, `muted` or `amber` skin.

Levels: level = index in `SPECIAL` + 1. A level is not the same as a card design: `CTRank.FRAME` (top of `rank-cards.js`) maps each level to the frame that wears it, and `data-tier` on a card, `CTRank.layers()` and every selector in `rank-cards.css` use the **frame** id. Always go through `CTRank.frame(level)`. To reorder the ranks, edit `FRAME` only. `TITLE_EFFECT` maps each level to its unlock effect.

| Level | Title | Frame (card material) | Unlock effect |
| --- | --- | --- | --- |
| 0 | not ranked yet | 0 · medal socket, ring of 500 ticks | none |
| 1 | Sub 60 | 2 · Breeze | Sunrise |
| 2 | Sub 45 | 1 · Horizon | Sunrise |
| 3 | Sub 30 | 3 · Bronze (WebGL) | Aurora |
| 4 | Sub 25 | 4 · Steel (WebGL) | Aurora |
| 5 | Sub 20 | 8 · Gold | Aurora |
| 6 | Sub 15 | 10 · Crystal | Warp |
| 7 | Sub 12 | 7 · Obsidian (WebGL) | Warp |
| 8 | Sub 10 | 9 · Forge (canvas fire) | Warp |
| 9 | Sub 8 | 6 · Neon | Forge |
| 10 | Sub 7 | 5 · Aurora | Forge |
| 11 | Sub 6 | 11 · Holographic | Forge |
| 12 | Sub 5 | 12 · Supernova | Singularity |

Every frame also has a rusty variant that decays in its own way (verdigris on bronze, a power cut on Aurora, a broken sign on Neon, and so on).

## The ranks dialog

Clicking (or pressing Enter on) the Overview rank card opens `ranks()` in `app.js`: all twelve normal cards stacked, Sub 60 first, built from the same `.rank-card` markup and CTRank layers and kept at the Overview card's 2.3 : 1 proportion. Rusty variants are never shown. Every card is the same size and carries only its title; the rank you hold (`.is-here`) is told apart by the trophy badge (`.rank-here`) alone. The list has no scrollbar (soft fades at both ends instead) and its padding keeps every card's shadow inside the scroller. It opens scrolled to the current rank. `Rank.mount` runs on the dialog and `Rank.unmount` on its `close` event, so WebGL and fire contexts are given back. The card is only a link on Overview (`rankCard(status, true)` adds `.is-link`); the Animation studio preview is not. `node tests/ranks-dialog.cjs` covers it (Chrome and Playwright).

## Where a card goes, how long it stays

- **Under the lowest control.** `Motion.place()` puts the card directly under the OK / +2 / DNF row (or under the time when there are no buttons), never over them. It lives in the free area: right of the navigation, left of the solve panel on wide screens, above the solve list on phones.
- **The timer makes room.** If the window is too short for the card to fit under the buttons, the whole timer block (`.focus-row`) slides up by exactly the missing amount through the CSS variable `--reward-lift`. It slides back when the card goes. If even that is not enough the gap shrinks, never the buttons.
- **Quiet cards stay.** There is no timeout. A card (quiet or big) closes when: the next solve starts, the solve it describes is changed or deleted, you click it, you press Esc, or you leave the timer. `Motion.showing` tells the app whether one is up (Esc checks it first).
- **Only big moments dim.** Cards with `modal: true` (titles, records, multi-records, averages) dim and blur the background with `.timer-achievement-shade`. The time and the buttons have a higher z-index than the dimming, so they stay sharp. Quiet cards never dim anything.
- `tests/reward-placement.cjs` drives this in the real timer.

## Motion off

`html[data-reward-motion="off"]` is set when the **Reward animations** preference is off or the device asks for reduced motion. It stops canvas effects, WebGL and fire loops, and every card animation. Cards still appear, still readable, just still. Any new moving thing must be disabled under that attribute, not under a separate media query.

## Adding an effect

1. Add the id to `plan()` in `timer-effects.js` (and to `TITLE_EFFECT` if it is a title effect).
2. Add `FX.<id>(data)` in `reward-fx.js`, using the stage helpers (`S.set`, `S.later`, `S.scene`, `S.anim`, `Particles`, `E.*` easing).
3. Add its studio option in `demoGroups()` / `demoEvent()`.
4. Keep every looping animation seamless (alternate direction, or move by exact multiples of the tile size).
5. Add the id to the expectations in `tests/effects.test.cjs`.

## Adding a level or a frame

A new level: extend `SPECIAL`, `TITLES`, `TITLE_EFFECT` and `FRAME`, and update the README's list of thresholds. A new card design: add `.rank-card[data-tier="N"]` (and `.is-rusty`) blocks to `rank-cards.css` with a fresh frame id, and point a level at it in `FRAME`. If the frame needs WebGL, add its material id in `rank-cards.js`.

## Performance

Only the cards on screen run: one WebGL card in Overview, at most two in the Animation studio. Contexts are released when a card leaves the page. If a machine struggles, **Reward animations** off removes every moving part.
