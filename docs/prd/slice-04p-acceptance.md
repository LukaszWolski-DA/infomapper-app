# Slice 4p – Acceptance

Status: **step 0 accepted; baseline measured with three rounds (S4P-01), waiting for Łukasz's OK for step 1**. Draft pull request #12. Branch
`slice/04p-canvas-performance`, from `main` at the tag `slice-04a` (`5e02c96`).

## Step 0 (14 October 2026)

- `git remote -v`: `origin https://github.com/LukaszWolski-DA/infomapper-app.git`. `main` = `origin/main` = `slice-04a` =
  `5e02c96`; tree clean; no `node`, Playwright or server running, ports 3000–3400 free. The PRD is committed as
  `docs/prd/slice-04p-canvas-performance.md` (`d52d323`); step 0's code is `fc5a782`.

### How the canvas is layered today (the base for Q1–Q4)

Everything the canvas draws is inside React Flow's `.react-flow__viewport`, which has `will-change: transform`
(`src/canvas/canvas.css:18`): one big GPU layer that the compositor moves and scales on pan and zoom. Inside it, in paint
order (`@xyflow/react` 12.12.0, `dist/esm/index.mjs:3273`): the edges container (unused), `.react-flow__edgelabel-renderer`
(our `LineLayer` and, at z-index −1, `FrameLayer`), `.react-flow__nodes` (one absolutely positioned wrapper per card, with
`z-index` from `node.internals.z`), `.react-flow__viewport-portal` (our `NoteLayer`, `HoverOverlay`, `SelectionOverlay`).
Neither `.react-flow__nodes` nor the portal makes a stacking context, so a card's wrapper and anything in the portal can
be ordered against each other by `z-index`. No element inside the viewport has a compositing layer of its own.

So any change inside the viewport repaints part of that one layer. A 1 × 1 SVG with `overflow: visible` (how the line
layer and every overlay are drawn) has a visual rectangle as large as everything it draws, so adding, removing or
restyling one invalidates that whole rectangle and Chrome re-rasterises the tiles under it, the 340 curves and the cards
there included. That matches slice 2a's diagnosis (C-10 about 150 ms with the line layer, about 49 ms without) and slice
2p's (the lasso marks 27–32 ms without the line layer).

### Q1. How C-10 draws today, and which tests read it

- Hovering a row or a mapping line sets `hover` in `ModelCanvas` (`onHoverOver`, `src/canvas/ModelCanvas.tsx:1433`;
  one canvas commit, React work about 5–7 ms per slice 2a).
- **`LineLayer`** (`src/canvas/LineLayer.tsx:339`) re-renders and mounts a second SVG, `layer-hover-lines`, in the edge
  label renderer (below the cards) with the hovered lines drawn again at 2.4 px; the 340 lines themselves are reused,
  not restyled, and nothing fades (the `.dimmed` class is for a selection, not a hover).
- **`HoverOverlay`** (`src/canvas/HoverOverlay.tsx`) mounts an SVG in the viewport portal (above the cards) with a
  12 % `--im-map` rectangle per row at the other ends (`hover-row`) and the two connection dots (`circle.hnd`). The same
  overlay draws the moved-row flash (`row-moved`) and the card-width outline while resizing (`outline-card-width`).
- **What repaints:** both SVGs sit in the viewport's one layer and their visual rectangles span the lines they draw, so
  the hover re-rasterises the tiles under them, lines and cards included.
- **e2e tests:** S1B-10 reads `hover-row`, `layer-hover` with `circle.hnd`, `layer-hover-lines` with its
  `line-mapping`s, no `.dimmed` and no `.card .row.hl`; S2C-02 reads `layer-hover` and `layer-hover-lines` on a bundle;
  S1B-08 and S1B-14 read `row-moved`; S1B-09 reads `outline-card-width`. The selection overlay: `mark-selected` in S2A-01
  to S2A-07, S2A-13, S2A-14, S3A-10 and the 2b helpers; `box-selection` in S2A-02; `label-selection` in S2A-01 and S2A-02;
  `lasso` in S2A-01. C-10 itself is measured by S1B-10 (`MEASURE=1`), the lasso marks by S2A-14.

### Q2. F1, the veil: lifting lit cards by z-index

- **Feasible with React Flow:** the portal and the card wrappers share the viewport's stacking context, so a veil in the
  portal with `z-index: 1` and lit cards with `zIndex: 2` would paint unlit cards, veil, lit cards in that order.
- **But it is not cheap to switch,** for three reasons:
  1. A card's `z-index` comes from the `nodes` array (`node.zIndex` → `internals.z` → the wrapper's style). Changing it
     means a new nodes array from `ModelCanvas`, so a canvas commit and a React Flow update for every lit card, against
     S4P-12 (`__imCanvasCommits` must not change). Setting the wrapper's style from outside React would be overwritten by
     React Flow on the next render of that card.
  2. Moving a card above the veil changes the paint order of the viewport's one layer, so the tiles under every lit card,
     and under the veil, are re-rasterised: for the large lens about half of the view. The same cost as today's hover,
     only larger.
  3. Lit lines are below the cards (edge label renderer). Above the veil they need drawing again in the portal (as the
     hover lines are), which means they then lie over the faded cards they pass.
- **Verdict at step 0:** feasible but expected to miss S4P-02 for the large lens and to break S4P-12. Worth measuring in
  step 2 only as the reference point the other candidates are judged against.

### Q3. F2, two containers of cards

React Flow renders every node into the one `.react-flow__nodes` container (`NodeRenderer`, `index.mjs:2380`); there is
no second container to move a node to. A card could portal its content elsewhere, but a portal whose target changes
unmounts and mounts its children again (React's `createPortal`), which is exactly the remount the PRD rules out; it
would also leave the wrapper behind (its position, drag and `data-id`). **Dropped.**

### Q4. A better candidate: F4, a veil with holes on its own layer, lit things drawn again above it

The aim is that switching fading on or off touches **nothing** in the viewport's big layer: no card, row, line, note or
frame is restyled, moved or re-ordered. Then switching costs only the raster of what is new, on layers of its own.

- **The veil:** one SVG `<path>` in the viewport portal, with `will-change: transform` so it is its own compositing
  layer: a rectangle around the content in the canvas background's colour at 75 % alpha (cards at 25 %) with a hole
  (`fill-rule: evenodd`, rounded like a card) for every lit card, lit note and lit block. One element, so it adds one
  element to the viewport, not one per card (AD-24 rule 4 is about `opacity` on repeated elements; this is one fill
  alpha on one element).
- **Lit lines and row colours:** one SVG above the veil, also its own layer: the lit lines drawn again (as the hover
  lines are, from `line-geometry.ts`) and a rectangle per lit row (the lens's covered blue / gap orange, at the
  prototype's `--im-req-soft` / `--im-warn-soft`). The full line layer stays as it is under the veil, so unlit lines are
  faded by the veil like everything else.
- **Why it should meet S4P-02:** mounting two composited layers re-layerises the tree once (about what one pan frame
  costs, 9–11 ms of Layerize at 100 %) and rasterises only them; the big layer's tiles stay valid. Switching off
  removes them the same way.
- **The risk for S4P-03:** while fading is on, every pan and zoom frame composites two more layers the size of the
  content, and the GPU blends a 75 % veil over the view; on the UHD 620 that is fill rate, not raster, and should be
  small, but it is the thing to measure. Lit lines above the veil are rasterised once and then moved like the line
  layer (not redrawn per frame, unlike slice 2p's canvas renderer).
- **Where it differs from the prototype's look:**
  1. one fade level: cards at 25 % as the prototype; frames and notes also at 25 % instead of 35 % and 30 % (Łukasz
     judges from the screenshots; a second, lighter veil band for frames is possible if he wants);
  2. lit lines lie over faded cards they cross (in the prototype they pass under them);
  3. a gap row is tinted orange, but its name keeps its colour (the prototype also turns the name orange).
- **F3** (trial A's overlay carrying lit lines and row colours) is part of F4: the lit layer above the veil is that
  overlay. With F1 it would be the same overlay; F4 just avoids F1's restyle and re-ordering of the cards.

**Proposal for step 2:** build F4 fully and F1 only as far as the scenarios need, one sitting with both, as the PRD
says. If F4 meets S4P-02 and S4P-03, F1's figures are its verdict (rejected).

**Note for trial A (step 1).** The hover's lines are drawn below the cards today. On a layer of their own below the
cards, Chrome would have to promote every card that overlaps them into layers above (to keep the order), which costs
more than it saves. So trial A draws the hovered lines in the overlay above the cards, as F4 does. That is a visible
change (a hovered line crosses the cards in its way); if Łukasz does not want it, trial A keeps them below and measures
only the row marks and the lasso marks on their own layer.

### Q5. The measuring hook

- **Name and what it takes:** `window.__imFade({ focus: "<entity id>" })`, `window.__imFade({ lens: "<requirement
  id>" })`, `window.__imFade(null)` (`src/canvas/TestHooks.tsx`). It writes a small store outside React state
  (`src/canvas/fade.ts`: `requestFade`, `useFadeRequest`), so the mechanism subscribes to it in its own component and
  switching never re-renders `ModelCanvas` (S4P-12). Slice 4b switches the same store from Focus and the requirement
  panel.
- **Gating:** slice 2p's rule (its hook was removed with its trial): `areTestHooksOn()` in
  `src/data/local/measure-mode.ts`, true in the measurement-only build (`INFOMAPPER_MEASURE=1`) and in a development
  server with `INFOMAPPER_TEST_HOOKS=1`, which only `playwright.config.ts`'s e2e dev server sets (`.env.example` lists
  it). A plain `npm run dev` and a normal production build do not install it (unit tests). The canvas page renders
  `<TestHooks />` only then. Item 8's error hook will use the same gate.
- **The mechanism's side:** while it shows a request it renders `[data-testid="layer-fade"]` with `data-fade` =
  `focus:<id>` / `lens:<id>` (and may add `data-lit-cards`); the spec times the switch until that element is in the page
  (or gone) and then the next frame, as C-10.

### Q6. The two requirements in `seed:large`, and what is lit

`src/data/local/seed-large-requirements.ts`, keys REQ-101 and REQ-102 (the workspace's counter 103), no cards, status
Draft. The views of the fading spec are centred on the Focus entity: at 100 % around `src:57` (S1A-14's dense area)
only four tall source tables are in view and none is lit, so fading there would measure nothing.

| Scenario | Links | Lit (whole canvas) | In view, 100 % | In view, 30 % |
| --- | --- | --- | --- | --- |
| Focus `ent:23` “Device Snapshot 23” (5 relationships, the most) | – | 10 cards, 4 mappings, 5 relationships | 2 of 4 cards | 5 of 19 |
| Lens, small: REQ-101 | 6 attributes of `ent:19` (its 5 mapped ones and 1 without a mapping: a gap row) | 10 cards, 6 rows, 9 mappings | 1 of 4 | 4 of 19 |
| Lens, large: REQ-102 | entities `ent:3`, `ent:4`, `ent:7`, `ent:19` (all 46 attributes in scope, D-31) | 29 cards, 46 rows, 29 mappings | 2 of 4 | 10 of 19 |

The counts in view are worked out from the generator with a pane of about 932 × 740 px (1536 × 864 window, both panels
open); the spec records the real pane and, once the mechanism exists, `data-lit-cards`. At 100 % only four cards fit
around `ent:23`; that view tests the dense rows, the 30 % view the number of cards. A unit test checks both
requirements, their links, the gap and the counter (`model-store.test.ts`).

### Q7. Error boundaries

- **Where:**
  - `src/app/error.tsx` for any page;
  - `src/app/global-error.tsx` for an error in the root layout;
  - `src/app/not-found.tsx` for an unknown route;
  - a boundary around `<ModelCanvas>` in the canvas page
    (`src/app/w/[workspaceId]/p/[projectId]/c/[canvasId]/page.tsx:224`), inside the `AppShell`'s `main`. The top bar,
    tabs, breadcrumbs, left panel, inspector and status bar are outside it, so they keep working. The panels' go-to
    links need the canvas, so they do nothing until it is reloaded.
- **Proposed wording** (item 8):

  | Where | Heading | Text | Action |
  | --- | --- | --- | --- |
  | Canvas boundary | Something went wrong on this canvas. | The panels still work. Reload the canvas to try again; your saved work is not affected. | **Reload** (draws the canvas again from the server's data) |
  | `error.tsx` | Something went wrong. | This page could not be shown. | **Try again**, and a link “Go to the start page” |
  | `global-error.tsx` | Something went wrong. | InfoMapper could not start this page. | **Reload** |
  | `not-found.tsx` | This page does not exist. | The link may be out of date, or what it pointed to was deleted. | link “Go to the start page” |

- **The e2e test** throws inside the canvas boundary through a test hook (`window.__imCanvasThrow()`, same gate as
  `__imFade`), checks the message, that the left panel and the top bar still work, that Reload brings the canvas back,
  and that an unknown URL shows the not-found page. Nothing logs the error's content (no personal data or rich text in
  logs).

### Q8. GPU memory and raster time in the harness

Yes, through the Chrome DevTools Protocol from Playwright (`page.context().newCDPSession(page)`), in headed Chrome as
now:

- **Raster and Layerize per frame:** `Tracing.start` around a 10 s pan and zoom with the categories `devtools.timeline`,
  `disabled-by-default-devtools.timeline`, `cc`, `gpu` and `viz`; the trace's `Layerize`, `Paint` and `RasterTask`
  events summed per frame (slice 3a's traces in `.data/measure/diag-3a` used the same events by hand).
- **GPU memory:** the same trace with `disabled-by-default-memory-infra` and a detailed memory dump at the start and the
  end (`memoryDumpConfig`); the dump's `cc/tile_memory` and `gpu` allocators give the tile and GPU memory of the tab.
  `LayerTree.enable` adds the number of compositing layers and their sizes, so a new layer's cost is visible.
- **Proposal:** a small trace helper with an analyser in `scripts/`, used by the notes trial (item 7, step 3) and by F4
  in step 2 if a frame needs explaining. Traces are large, so they go to `.data/measure/<sitting>/` and are not part of
  every round.

### Item 8: wording

As in Q7's table. Open: whether Reload should also tell the person what went wrong (proposed: no; the details go to the
browser console only, without personal data).

### The harness (items 1–3)

- **`e2e/slice-04p/S4P-fading.spec.ts`** (measurement build only; the normal run leaves it out, `playwright.config.ts`):
  four views (100 % and 30 % around `ent:23`, frames expanded and all collapsed with `?diag=collapsed`). In each, pan and
  zoom with fading off; then, where the page has the hook and a fading mechanism, each scenario: 40 switches on and 40
  off, each timed to the next frame (C-10's method), and pan and zoom with fading on. Results in
  `test-results/S4P-fading.json`. It imports only what `slice-04a` has.
- **`npm run measure:canvas`** runs it on both sides (it copies the spec into the reference worktree, which has no
  fading and so measures fading off), adds the fading-off pan and zoom of the four views to the A/B table (S4P-08, “≥ −5 %
  vs reference”), and writes a second table for this branch only: per view and scenario, switching on and off, pan and
  zoom off → on with its change, frames over 50 ms off → on (S4P-02, S4P-03). `--quick` includes it.
- **Tests:** `npm test` 924 (920 before: `fade.test.ts`, the gate in `measure-mode.test.ts`; `seed:large` in
  `model-store.test.ts`); lint and typecheck pass. The e2e specs that seed `seed:large` and all of slice 4a ran on the
  e2e dev server (22 passed): the two requirements change nothing they check.

### Baseline sitting (S4P-01): prepared at step 0 (measured below)

`npm run measure:canvas -- --prepare-only --against slice-04a` ran: `../infomapper-ab-main` is clean at `slice-04a`
(`5e02c96`) with its measurement build, and this branch's measurement build is made (log `.data/s4p-prepare.log`).

One difference from “the application code still the same”: this branch has the measuring hook. On the canvas page it
renders `<TestHooks />`, which installs one function on `window` and renders nothing. Nothing subscribes to the fade
store until step 2. So the code that draws the canvas is `slice-04a`'s, and I expect the difference to be within the
spread. If Łukasz prefers, the baseline can run with the hook switched off for the sitting.

**Commands, after Łukasz's OK and his preparation of the laptop** (as CLAUDE.md: one discarded warm-up, then a
balanced sitting):

```bash
npm run measure:canvas -- --quick --rounds 1 --against slice-04a
npm run measure:canvas -- --rounds 2 --against slice-04a
```

The first is the warm-up and is not counted. The second is the baseline: every figure (S1A-14, C-09, C-10, the drags,
the lasso marks and the four fading-off views), two rounds with each side first once. The spread goes into S4P-01. A
side takes a few minutes more than in slice 3b (the four fading-off views, about 1 minute).

## Łukasz's answers after step 0 (14 October)

Step 0 accepted.

1. **F4 is the fading candidate.** F1 is built only as far as needed for the comparison; F2 is dropped (Q3: React Flow
   has one node container, and a portal that changes its target remounts its children). Step 2 also checks and reports:
   the veil moves with the canvas's own transform during pan and zoom, with no script per frame; the holes follow a card
   that is dragged or resized while fading is on; the veil's GPU memory at 30 %. The look differences of Q4 are accepted
   for now; Łukasz judges them on the S4P-04 screenshots.
2. **Trial A** draws the hovered lines above the cards (approved); screenshots of the hover go with S4P-04 too.
3. **Error pages:** the wording of Q7 is approved, including “your saved work is not affected”.
4. **The measuring hook stays in for the baseline.** If the sides differ by more than slice 2p's spread, say so, and the
   hook is checked.
5. **Added:** REQ-103 in `seed:large`, linked to the source tables in S1A-14's 100 % view, and the large-lens scenario
   measured in that view too (the heaviest), with its lit counts. The draft pull request is opened now.

## Step 0, additions (14 October)

- **REQ-103 “Lens, dense area”** (`seed-large-requirements.ts`, `denseViewTables`): the source tables in S1A-14's 100 %
  view, `src:1`, `src:29`, `src:47` and `src:57`; no attributes in scope (0 / 0). The workspace's counter is 104.
- **The fading spec has six views**: the four around `ent:23`, and S1A-14's 100 % view around `src:57` (“100 % dense
  area”), frames expanded and collapsed; there the scenario is the dense lens. Under `DIAG=collapsed` only the collapsed
  views run. Each view records the cards in view (`inView`).
- **`measure:canvas --diag <switch>`**: a measurement-only switch for both sides, so a collapsed baseline compares
  `slice-04a` with itself (`--branch-diag` switches only this branch's side).
- Commit `c5f2296`. Draft pull request
  [LukaszWolski-DA/infomapper-app#12](https://github.com/LukaszWolski-DA/infomapper-app/pull/12).

### Views and lit counts

The pane in the measuring window is 932 × 718 px (recorded by the spec). The cards in each view (from the sitting) and
what each scenario lights there (from the scenarios' definitions; the mechanism records its own count from step 2):

| View | Cards in view | Scenario | Lit in view |
| --- | --- | --- | --- |
| 100 % around `ent:23` | 4: `ent:4`, `ent:19`, `ent:23`, `ent:28` | Focus `ent:23` | 2 of 4 |
| | | Lens, small (REQ-101) | 1 of 4 (6 rows coloured on `ent:19`) |
| | | Lens, large (REQ-102) | 2 of 4 |
| 30 % around `ent:23` | 19 (12 tables, 7 entities) | Focus | 5 of 19 |
| | | Lens, small | 4 of 19 |
| | | Lens, large | 10 of 19 |
| 100 % dense area (S1A-14's) | 4 tables: `src:1`, `src:29`, `src:47`, `src:57` | Lens, dense (REQ-103) | 4 of 4 (no rows, no lines: tables only) |
| The same three views, collapsed | 0, 2 blocks, 1 block | as above | measured from step 2 |

## Baseline (S4P-01, 14 October)

Conditions: the laptop prepared by Łukasz (as in earlier sittings). The warm-up sitting `2026-10-14-15-35` (`--quick
--rounds 1`, not counted) ran first, after the builds. Every side then waited for a quiet machine (below 2 % for 30 s,
at most 3 minutes) and recorded the busiest processes after it. Google Chrome 155.0.8059.40, headed, 1536 × 864.

### Frames expanded: sitting `2026-10-14-15-48`

`npm run measure:canvas -- --rounds 2 --against slice-04a`, this branch `c5f2296` against `slice-04a` (`5e02c96`).
All four sides quiet (waits 31–45 s); nothing besides the command's own programs above 0.4 % after any side. No round
dropped.

| Figure | Bar | `slice-04a`: median (min–max) | This branch: median (min–max) | Change |
| --- | --- | --- | --- | --- |
| Pan and zoom at the overview (S1A-14) | ≥ 50 fps | 59.1 (58.5–59.7) | 59.1 (58.9–59.4) | +0.1 % |
| – frames over 50 ms | 0 | 0 (0–0) | 0 (0–0) | – |
| Pan and zoom at 100 %, dense area (S1A-14) | ≥ 50 fps | 48.5 (47.4–49.6) | 51.0 (50.4–51.7) | +5.3 % |
| – frames over 50 ms | 0 | 11 (6–15) | 8 (5–11) | – |
| Initial render (C-08), median of 5 | ≤ 1500 ms | 1501 (1486–1515) | 1438 (1412–1463) | −4.2 % |
| Card resize (C-09) | ≥ 45 fps | 34.6 (34.5–34.7) | 37.5 (37.2–37.7) | +8.2 % |
| Hover to the next frame (C-10), median of 40 | ≤ 100 ms | 117 (117–118) | 117 (115–118) | −0.3 % |
| Single-card drag at 50 % | ≥ 45 fps | 13.6 (10.7–16.5) | 13.8 (10.7–16.9) | +1.5 % |
| Group drag, 31 cards at 50 % | ≥ 45 fps | 30.8 (29.6–32.0) | 29.3 (28.2–30.4) | −4.9 % |
| Lasso marks, median of 20 | ≤ 100 ms | 25 (25–25) | 22 (20–24) | −11.5 % |
| Fading off, 100 % around `ent:23` | – | 47.7 (47.2–48.1) | 48.7 (48.7–48.7) | +2.2 % |
| – frames over 50 ms | – | 11 (10–12) | 8 (7–8) | – |
| Fading off, 30 % around `ent:23` | – | 53.0 (53.0–53.1) | 53.0 (52.3–53.6) | −0.2 % |
| – frames over 50 ms | – | 7 (6–8) | 8 (7–8) | – |
| Fading off, 100 % dense area | – | 48.5 (47.3–49.6) | 48.8 (47.8–49.8) | +0.7 % |
| – frames over 50 ms | – | 7 (5–9) | 10 (10–10) | – |
| Fading off, 100 % around `ent:23`, collapsed | – | 55.9 (55.6–56.2) | 56.6 (56.6–56.6) | +1.3 % |
| – frames over 50 ms | – | 7 (6–7) | 5 (5–5) | – |
| Fading off, 30 % around `ent:23`, collapsed | – | 57.7 (57.4–58.0) | 58.0 (57.8–58.2) | +0.5 % |
| – frames over 50 ms | – | 5 (2–7) | 3 (2–4) | – |
| Fading off, 100 % dense area, collapsed | – | 60.0 (60.0–60.0) | 60.0 (60.0–60.0) | 0.0 % |
| – frames over 50 ms | – | 0 (0–0) | 0 (0–0) | – |

### Frames collapsed: sitting `2026-10-14-16-16`

`npm run measure:canvas -- --quick --rounds 2 --diag collapsed --against slice-04a`: both sides with every frame
collapsed (C-09, C-10 and the drags need drawn cards and are not measured collapsed).

**Round 1 dropped and replaced by round 3.** After round 1's `slice-04a` side the busiest processes were `chrome`
(28.8 %) and `claude` (10.4 %); the quiet wait before round 1's branch side then timed out (181 s, up to 76 %), and that
`slice-04a` side was far below every other side (fading off 49.3 / 43.7 / 46.4 fps against 56–60). No Chrome was left
running afterwards, so it was most likely the measuring Chrome still closing. Round 3 (`--add-round`, both sides quiet
after 47 s and 31 s) replaces it; round 1 stays in the sitting's folder.

| Figure | `slice-04a`: median (min–max) | This branch: median (min–max) | Change |
| --- | --- | --- | --- |
| Pan and zoom at the overview (S1A-14) | 60.0 (60.0–60.0) | 60.0 (60.0–60.0) | 0.0 % |
| Pan and zoom at 100 %, dense area (S1A-14) | 60.0 (60.0–60.0) | 60.0 (60.0–60.0) | 0.0 % |
| Fading off, 100 % around `ent:23` | 56.5 (56.3–56.8) | 56.9 (56.7–57.1) | +0.6 % |
| – frames over 50 ms | 5 (5–5) | 5 (5–5) | – |
| Fading off, 30 % around `ent:23` | 58.3 (58.2–58.3) | 58.4 (58.1–58.6) | +0.2 % |
| – frames over 50 ms | 2 (1–2) | 3 (2–4) | – |
| Fading off, 100 % dense area | 60.0 (60.0–60.1) | 60.0 (59.9–60.0) | −0.2 % |
| – frames over 50 ms | 0 (0–0) | 0 (0–0) | – |

Frames over 50 ms in both sittings: 0 at the overview and in the collapsed dense area; 0–15 elsewhere.

### The spread, and the hook (Łukasz's point 4)

Against slice 2p's spread between the two sides (pan and zoom and C-08 within about 4 %, the group drag about 3 %, C-09,
C-10, the single-card drag and the lasso 5–9 %), three figures differ by more:

- **Pan and zoom at 100 % (S1A-14): +5.3 %**, in this branch's favour. Within a side it ranges 47.4–49.6 and
  50.4–51.7, and the fading spec's own 100 % dense area (the same view, run later in the same side) differs by only
  +0.7 %.
- **Group drag: −4.9 %**, against this branch (30.8 against 29.3 fps; the sides' ranges 29.6–32.0 and 28.2–30.4
  overlap).
- **Lasso marks: −11.5 %**, in this branch's favour, but 3 ms (25 against 22 ms).

C-09 (+8.2 %) is inside slice 2p's 5–9 % for the interactive figures. The hook cannot make this branch faster. It also
takes no part in a group drag: it is one component beside `ModelCanvas` that sets one function on `window`, and nothing
reads the fade store yet. So I read these three as the method's spread at two rounds rather than the hook's effect.
Łukasz asked for this to be raised. Options: (a) accept the baseline as it is; (b) one more round (`--add-round`) to
narrow the medians; (c) a short sitting with the hook removed, to see whether the group drag moves.

**What else the baseline shows.** Against slice 2p's baseline (7 October, Chrome 154, `slice-02a`):
- C-10 is now 117 ms (about 170 then);
- the lasso marks are 22–25 ms (about 140 then), so **already below S4P-06's 100 ms bar** with fading off;
- C-09 is 35–37 fps (about 25 then);
- C-08 is about 1.44–1.50 s (about 1.75 then);
- pan and zoom at the overview is 59 fps (53.5 then).

The application changed a lot since (frames, notes, labels, requirements), so these gains are probably not the
code. The likely cause is the browser (Chrome 155 against 154) or the laptop's state, not proven. S4P-05 and S4P-06
start from these numbers: the lasso already meets its bar, and C-10 misses by 17 ms.

## Łukasz's answers after the baseline (14 October)

1. **Option (b):** one more round for the expanded sitting (three rounds, the harness's default); the collapsed sitting
   keeps its two.
2. **S4P-08** is judged on three-round medians and reads “not worse than 5 %, or within the baseline's spread”. PRD
   changed in its own commit (`8a1f17b`).
3. **Chrome 155 changed the starting point** (below; also in `docs/known-limitations.md`). Only figures from the same
   sitting (A/B) are compared, never with earlier slices' numbers.
4. **Trial A merges into step 2.** Step 1 builds the overlay on its own compositing layer and uses it for the hover (the
   hovered lines above the cards) and the row and lasso marks, on its trial branch, with the affected e2e tests and the
   hover screenshots, and no sitting. Step 2 builds F1 and F4 on it and measures C-10, the lasso marks and every fading
   scenario in one sitting, which gives the verdicts for trial A, F1 and F4. PRD steps changed in the same commit as
   point 2.

### Baseline, frames expanded: three rounds (S4P-01)

Sitting `2026-10-14-15-48`, the two rounds above plus a third. HEAD had moved by the docs commit `a93f5dd` only, so the
added rounds ran with `--any-commit` on the same measurement builds (`c5f2296` against `5e02c96`).

**Round 3 dropped, replaced by round 4.** Both sides of round 3 started on a quiet machine (58 s and 31 s), but this
branch's fading-off run in the 100 % dense area measured 24.9 fps with 56 frames over 50 ms and a 350 ms frame. S1A-14's
run on the same view in the same side measured 49.5, and every other figure of that side was normal. Explorer was among
the busiest processes after both sides (2.0 % and 1.7 %), as in slice 2p's dropped round. Round 4 replaces it.
**Flagged, kept:** in round 4 `slice-04a`'s dense-area run measured 42.8 fps (47.3–49.6 in its other rounds), and
Explorer showed 2.1 % after round 4's branch side. Dropping it would change no conclusion.

| Figure | Bar | `slice-04a`: median (min–max) | This branch: median (min–max) | Change |
| --- | --- | --- | --- | --- |
| Pan and zoom at the overview (S1A-14) | ≥ 50 fps | 59.7 (58.5–59.7) | 59.4 (58.9–59.8) | −0.5 % |
| – frames over 50 ms | 0 | 0 (0–0) | 0 (0–0) | – |
| Pan and zoom at 100 %, dense area (S1A-14) | ≥ 50 fps | 49.6 (47.4–49.9) | 50.4 (50.4–51.7) | +1.6 % |
| – frames over 50 ms | 0 | 7 (6–15) | 9 (5–11) | – |
| Initial render (C-08), median of 5 | ≤ 1500 ms | 1509 (1486–1515) | 1463 (1412–1496) | −3.0 % |
| Card resize (C-09) | ≥ 45 fps | 34.7 (34.5–35.7) | 37.2 (35.9–37.7) | +7.2 % |
| Hover to the next frame (C-10), median of 40 | ≤ 100 ms | 117 (117–118) | 115 (115–118) | −1.6 % |
| Single-card drag at 50 % | ≥ 45 fps | 16.2 (10.7–16.5) | 14.6 (10.7–16.9) | −9.9 % |
| Group drag, 31 cards at 50 % | ≥ 45 fps | 29.6 (28.1–32.0) | 30.4 (28.2–30.8) | +2.7 % |
| Lasso marks, median of 20 | ≤ 100 ms | 25 (25–25) | 21 (20–24) | −15.7 % |
| Fading off, 100 % around `ent:23` | – | 47.5 (47.2–48.1) | 48.7 (48.2–48.7) | +2.5 % |
| – frames over 50 ms | – | 10 (9–12) | 7 (7–8) | – |
| Fading off, 30 % around `ent:23` | – | 53.0 (52.5–53.1) | 53.6 (52.3–53.8) | +1.1 % |
| – frames over 50 ms | – | 8 (6–8) | 8 (7–8) | – |
| Fading off, 100 % dense area | – | 47.3 (42.8–49.6) | 49.1 (47.8–49.8) | +3.8 % |
| – frames over 50 ms | – | 9 (5–9) | 10 (6–10) | – |
| Fading off, 100 % around `ent:23`, collapsed | – | 55.6 (54.6–56.2) | 56.6 (56.5–56.6) | +1.8 % |
| – frames over 50 ms | – | 6 (6–7) | 5 (5–6) | – |
| Fading off, 30 % around `ent:23`, collapsed | – | 57.7 (57.4–58.0) | 57.8 (57.3–58.2) | +0.2 % |
| – frames over 50 ms | – | 3 (2–7) | 4 (2–4) | – |
| Fading off, 100 % dense area, collapsed | – | 60.0 (60.0–60.0) | 60.0 (59.9–60.0) | 0.0 % |
| – frames over 50 ms | – | 0 (0–0) | 0 (0–0) | – |

**The spread** (same code on both sides, three rounds):
- **Pan and zoom** differ by −0.5 to +3.8 % between the sides, the S1A-14 dense area +1.6 % (+5.3 % with two rounds).
  Within one side: ±1 fps, up to −10 % for one disturbed-looking run.
- **C-08:** −3.0 %.
- **C-10:** −1.6 % (115–118 ms on both sides).
- **C-09:** +7.2 %. Each side's range is tight (34.5–35.7 against 35.9–37.7), so this looks like a steady side
  difference, not noise. C-09 is out of scope here, but it is worth knowing for S4P-08.
- **The drags vary most:** single-card drag 10.7–16.9 fps on each side, a median difference of −9.9 %. Group drag
  +2.7 % (−4.9 % with two rounds).
- **Lasso marks:** −15.7 %, but 4 ms (25 against 21 ms).
- **Frames over 50 ms:** vary by up to ±4 per run.

This is the spread S4P-08 and S4P-03 are read against. With three rounds the group drag's difference is gone. The
single-card drag's −9.9 % comes from its own range (10.7–16.9 on both sides), not from the hook.

### Chrome 155: the new starting point

Measured in Google Chrome 155.0.8059.40 (slice 2p: 154). Against slice 2p's baseline (7 October, `slice-02a`) the same
measurements now give:

| Figure | Slice 2p (Chrome 154) | Now (Chrome 155, `slice-04a`) |
| --- | --- | --- |
| C-10 hover | about 170 ms | 117 ms |
| Lasso marks | about 140 ms | 22–25 ms |
| C-09 resize | about 25 fps | about 36 fps |
| C-08 initial render | about 1.75 s | about 1.45 s |
| Pan and zoom, overview | 53.5 fps | 59–60 fps |

The application has changed a lot since (frames, notes, labels, requirements), so the gain is very likely the browser.
That is not proven; the laptop's state may also play a part. So in this slice **only figures from the same sitting are
compared** (this branch against `slice-04a`, or fading on against off in the same run), never with earlier slices'
numbers. The lasso marks already meet S4P-06's bar at the baseline, and C-10 misses by about 17 ms.

### C-09's side offset (Łukasz, 14 October)

C-09 showed a steady difference between the two sides with the same code: +7.2 %, with tight ranges (34.5–35.7 against
35.9–37.7 fps). So S4P-08 compares C-09 against that offset: a regression is a change **below +2.2 %** (+7.2 % − 5 %),
not below −5 %. Every other figure keeps the rule as written. PRD changed in its own commit.
