# Known limitations

Things we know are not fully right yet, accepted for now, with what has to happen later.

## Local data adapter (AD-29)

### "At least one canvas" can race (slice 0)

Removing a canvas from a project is refused when the canvas would belong to no project, or the project would have no
canvas left (D-28). The command checks this against links read just before the write; the local adapter then
re-checks versions, keys and references inside its serialised write, but not this count. Two removals at the same
moment can therefore both pass the check and leave a canvas or project without its last link.

- **Accepted** in the local adapter: it is development only and has one user at a time in practice.
- **The database slice (last, AD-31):** check this rule in the same transaction as the write (e.g. lock the project's and the canvas's
  `project_canvas` rows, count, then delete), so concurrent removals cannot both succeed.

## Canvas performance (slice 1a)

### S1A-14 is only partly met, and measured on the dev server

On the “Performance test” workspace (`seed:large`), pan and zoom at the overview mostly reach the bar, but at 100% the
canvas runs at about 42–53 fps with 1–8 frames over 50 ms (bar: 50 fps, none over 50 ms), and the initial render takes
about 4–7 s (bar: 1.5 s). The numbers and what was tried are in
[slice-01a-acceptance.md](prd/slice-01a-acceptance.md#performance-s1a-14). All of it was measured under `next dev`,
because the local data adapter refuses a production build (AD-29); the spike shows that dev mode alone doubles the
initial render.

- **Recorded** as “partly met” for slice 1a, as Łukasz asked on 4 October 2026.
- **The database slice (last, AD-31):** measure S1A-14 again in a production build (`npm run build`, `npm start`) with the same method
  (`MEASURE=1`, headed Chrome, same laptop), and decide on the card design (fewer elements per row, or detail by zoom
  level between 40% and 100%) if 100% still misses the bar.
- **Slice 1b** adds two more that are only partly met on the development laptop (S1B-09, S1B-10): card resize (C-09)
  runs at 31–36 fps with an outline while dragging (bar: 45 fps), and the hover highlight (C-10) takes about 190 ms
  (bar: 100 ms). A veil over the lines and a block view while resizing were tried and did not help: every change
  repaints the canvas's one large GPU layer. Recorded as “partly met”, as Łukasz decided.
- **The database slice (last, AD-31):** measure S1A-14, C-09 and C-10 in a production build. (Slice 2p: the reference
  machine is the development laptop in the production measuring build; the HTML canvas line layer was tried and is no
  longer the next step, see below and AD-24.)
- **Slice 2a** adds a third (S2A-14): dragging a group of 31 cards at 50 % on “Performance test” runs at about 16–19 fps
  on the dev server and 25–30 fps in the measurement-only production build (bar: 45 fps). Recorded as “partly met”, as
  Łukasz decided on 6 October 2026; lines keep following the cards (no outlines while dragging). The production build
  confirms that the cost is painting, not JavaScript: a hover's React work takes 6.7 ms there, the frame after it 166 ms.
  A short performance slice comes between slices 2a and 2b. Measured on the development laptop (i7-8550U, Intel UHD 620),
  headed Chrome 154, 1536 × 864; details in [slice-02a-acceptance.md](prd/slice-02a-acceptance.md).

  Before the speed-up of step 3b:

  | Measurement | Bar | Dev server | Production |
  | --- | --- | --- | --- |
  | Group drag, 31 cards at 50 % | ≥ 45 fps | 10.5 fps | 14.2 fps |
  | Single-card drag, same card | – | 10.0 fps | 11.8 fps |
  | C-09 card resize, 200-row card at 50 % | ≥ 45 fps | 27.6 fps | 20.3 fps |
  | C-10 hover to the next frame, median of 40 | ≤ 100 ms | 199 ms | 166 ms |

  After it (no change of behaviour):

  | Measurement | Bar | Dev server | Production |
  | --- | --- | --- | --- |
  | Group drag, 31 cards at 50 % | ≥ 45 fps | 15.8, 18.8 fps | 28.9, 29.5, 28.9, 24.7 fps |
  | Single-card drag, same card | – | 25.2, 23.4 fps | 14.8, 9.3, 12.5, 19.5 fps; 21.5 on a fresh page |

  At step 5 (7 October, the laptop prepared): group drag 22.4 fps on the dev server, 24.5 fps in production.
- **Slice 2a, lasso marks (S2A-14)**, next to C-10: the selection marks after a lasso around the whole view at the
  overview appear after 139 ms in the production measurement build (280 ms on the dev server; bar: 100 ms). Recorded as
  “partly met”, as Łukasz decided on 7 October 2026. The lasso holds the 85 of 101 cards fully inside the view: the
  tallest stick out even at the 10 % minimum zoom (criterion change confirmed). S2A-14's pan and zoom, now judged
  against `main` in the same sitting, are met in the production build (accepted; the dev server misses for one cell per
  grid).
- **Diagnosis (slice 2a, production measurement build, slice-02a-acceptance.md):** the **line layer is the cost of the
  hover** (C-10: without it about 49 ms instead of about 150 ms, with the same 5 ms of React work); the **card rows are
  the cost of resize and drag** (with every card as a block the resize C-09 runs at 57–59 fps instead of 28–32 and a
  single-card drag doubles; without lines the drags and the resize barely change).
- **Slice 2p (canvas performance, 7–8 October 2026) was closed without changing the renderer.** Its baseline (production
  measuring build, `slice-02a` against itself, `npm run measure:canvas`): pan and zoom 53.5 / 44.7 fps, initial render
  (C-08) about 1.75 s, C-09 about 25 fps, C-10 about 170 ms, single-card drag about 13 fps, group drag about 28 fps,
  lasso marks about 140 ms. A trial line renderer on an HTML canvas (tag `perf/canvas-lines-trial`) met the hover
  (63 ms) and the lasso marks (29 ms; with no line layer at all 27–32 ms, so their cost is the SVG line layer, not
  `SelectionOverlay`), but pan and zoom fell to about 21 fps against about 55 (5 rounds), and batching the strokes and
  skipping lines outside the view (about 28 fps) did not change that. The profile: about 3 ms of script per frame; the
  cost is the GPU rasterising 340 antialiased, partly dashed curves on every frame (with strokes switched off 56 fps),
  where the SVG layer is rasterised once and moved by the compositor. Details in
  [slice-02p-acceptance.md](prd/slice-02p-acceptance.md); AD-24 keeps the SVG line layer.
- **Deferred to before the database slice (AD-31), all still “partly met”:** card resize (C-09), hover (C-10), the
  single-card and group drags, the lasso marks, and the initial render (C-08). What is known: the hover and the lasso
  marks are the SVG line layer repainting; resize and drags are the cards' row elements; the initial render was not
  diagnosed (slice 2p's step 4 was dropped). **Untested idea:** put the hover and selection overlays on their own
  compositing layer, so that their changes do not repaint the line layer (the hover and the lasso marks would then cost
  what the overlays themselves cost, under 35 ms for the marks). The card rows need a decision on the card's look
  (fewer elements per row, or detail by zoom between 40 % and 100 %), measured with `DIAG=blocks` as the upper limit.

## Undo history (slice 1b)

### The undo history lives in server memory

Each person's undo history in a workspace (the last 50 steps, slice 1b PRD item 12) is kept in the
memory of the server process, as the PRD asks for now. It is lost when the server restarts (and, in development, when
the demo data is replaced: steps whose change group is no longer in the change log are left out).

- **Accepted** for the local adapter: one development server, one user at a time in practice.
- **The database slice (last, AD-31):** decide whether the history must survive a restart (and several server instances). If it must,
  keep it in the database next to `change_event`.

## Dependencies (slice 2a, step 0)

### `npm audit`: 11 high, all from one advisory without a fix

On 6 October 2026 `npm audit` reports 11 high-severity findings. All come from one advisory,
[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) (published 18 September 2026): `braces`
up to 3.0.3 can exhaust the stack on deeply nested brace patterns and crash the Node.js process. 3.0.3 is the newest
`braces`, so there is no patched version yet. The other ten are the packages that reach it through `micromatch` and
`fast-glob`:

| Package (we depend on it directly) | Path to `braces` | npm's suggested “fix” |
| --- | --- | --- |
| `eslint-plugin-boundaries` 7.2.0 (dev) | `micromatch` → `braces`; `@boundaries/elements` | downgrade to 1.1.1 (breaking) |
| `eslint-config-next` 16.3.8 (dev) | `@next/eslint-plugin-next` → `fast-glob` → `micromatch` | downgrade to 14.2.35 (breaking) |
| `shadcn` 4.21.1 (dev) | `@shadcn/registry`, `ts-morph`, `fast-glob` → `micromatch` | downgrade to 1.0.0 (breaking) |

`npm audit fix` without `--force` resolves none of them (it only moves `shadcn` to 4.21.3), so nothing was changed.

- **Risk: low for us.** All three are development tools (lint and the shadcn CLI) and are not part of the application
  the server runs. They match glob patterns from this repository's own configuration, not input from users, so an
  attacker would need to change the repository to trigger it, and the worst outcome is a crashed lint run.
- **Accepted** until `braces` (or `micromatch`) publishes a fix; then update within the current majors and run
  `npm audit` again. Do not take the suggested downgrades: they would break lint (the layer rules) and the shadcn CLI.

## Right panel (slice 1a)

### Panel links only reach rows whose card is on this canvas (step 5a)

The canvas selection points at a card (a card, a row of a card, or a line), so the right panel can only show an
attribute or a column whose entity or source table has a card on the open canvas. Links in the panels (the
attribute list of an entity, the source and target of a mapping, “Comes from”) do nothing for attributes and columns
whose card is not here. Mappings open from anywhere, because a mapping is selected by itself.

- **Accepted** by Łukasz for slice 1a.
- **Later:** let the selection name an attribute or a column directly (as the prototype's `attr` and `col`
  selections do), so the panel can show them without a card.

## End-to-end tests (slice 1a, step 6)

### “The destination stream closed early” in the e2e server log

The e2e dev server sometimes prints `⨯ Error: The destination stream closed early.` (digest 2208966200). It was seen
three times in every full run until step 6; two causes were found and fixed: the proxy wrote preference cookies during
server actions, which made Next.js refresh the page after every action, and a navigation right after an action cut
that refresh off (after S0-05, S1A-12, S1A-13). What remains is about once in three full runs, after S0-11, which
clicks through the breadcrumbs quickly: a navigation that starts while the previous page is still streaming. No test
fails on it, and the browser behaves as it should.

- **Accepted:** it is the dev server noting that the browser left a page early.
- **Later:** look again if it shows up outside fast navigation, or in a production build.

### e2e dev servers run without Turbopack's file-system cache

Next.js 16.1+ keeps a cache of the dev compilation in the build folder. The e2e runs stop their dev servers by force,
and a server that reused such a folder answered 404 for whole routes now and then (S0-10, and once a whole run). E2e
servers (`NEXT_DIST_DIR` set) therefore run without that cache, `npm run e2e` starts from an empty `.next-e2e`, and
S0-10 removes `.next-e2e-restart` before and after use. A global setup warms the server up (signs in, opens the main
pages), so the first tests do not wait for compiles.

- **Accepted:** an e2e run compiles every page once (about a minute); `npm run dev` keeps its cache.
- **Later:** if the e2e runs move to a production build once the local adapter is gone (the database slice, last, AD-31), this goes away.
