# Typography

One place decides how text looks: the block at the top of `assets/style.css`.

## Fonts

| Token | Font | Used for |
| --- | --- | --- |
| `--font-ui` | Inter (variable, bundled) | All interface text. |
| `--font-head` | same as `--font-ui` | Headings and big stat numbers. Point it at another family to give headings their own face. |
| `--mono` | JetBrains Mono (variable, bundled) | Times, scrambles, averages, any number you compare down a column. |

Both fonts are files in `assets/vendor/` (`inter.woff2`, `jetbrains-mono.woff2`, licences beside them) and are listed in the `server.mjs` allowlist. Nothing loads from the internet. Variable fonts mean every weight from thin to extra bold comes from one file.

To change a font: replace the file, change its `@font-face`, and keep the family names in `--font-ui` / `--mono`. Run `node tests/library-interface.cjs` afterwards: it fails if a row grows or a control overflows.

## Sizes

Nothing is smaller than 12px. Use a token instead of a number:

| Token | Size | For |
| --- | --- | --- |
| `--fs-micro` | 12px | tiny labels, badges, axis ticks, uppercase captions |
| `--fs-small` | 13px | captions, secondary info |
| `--fs-body` | 14px | default text |
| `--fs-ui` | 14.5px | controls, inputs, buttons |
| `--fs-lead` | 15.5px | emphasised text |
| `--fs-md` / `--fs-lg` / `--fs-xl` | 16 / 17 / 18px | small headings |

Anything larger (page titles, big numbers, the timer) is set where it is used, usually with `clamp()`. To make the whole app a little bigger or smaller, move the tokens; do not edit individual rules.

## Rules for new code

- `font-size: var(--fs-body)`, never `font-size: 11px`.
- Numbers that line up in columns use `font-family: var(--mono)` and `font-variant-numeric: tabular-nums`.
- Canvas text (`reward-fx.js`) names the family directly (`Inter`), because canvas cannot read CSS variables.
