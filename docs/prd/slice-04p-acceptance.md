# Slice 4p – Acceptance

Status: **step 3 in progress**; step 2's verdicts given (trial A adopted, F1 chosen, F4 and the hover line fade rejected). Draft pull request #12. Branch
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

## Step 1: trial A, built (14 October)

Branch `perf/4p-trial-a`, from `slice/04p-canvas-performance` at `177b806`. It will be tagged at its verdict in step 2. No
measuring sitting in this step (PRD as changed after the baseline).

### What changed (only on the trial branch)

- **`OverlayLayer`** (`src/canvas/OverlayLayer.tsx`, `canvas.css`): one container in React Flow's viewport portal, after
  the cards, with `will-change: transform`, so it has its own compositing layer. It pans and zooms with the viewport and
  takes no pointer events. It holds:
  - **`HoverLines`**, the hovered row's or line's lines drawn again. They moved out of `LineLayer`, where they were drawn
    below the cards; now they are above them (Łukasz's decision 2). `LineLayer` no longer takes a `hover` prop, so a
    hover neither re-renders nor repaints the line layer.
  - **`HoverOverlay`**: the rows at the other ends, the row's two dots, the moved-row flash and the card-width outline.
  - **`SelectionOverlay`**: the marks of several selected items, the dashed box, “N selected” and the lasso rectangle.
- **The hover and the lasso rectangle are stores** (`src/canvas/value-store.ts`), not React state. `ModelCanvas` sets
  them (`onPointerOver`, `useLasso`), and only the overlay's three components read them. So a hover, and a lasso being
  drawn, re-render the overlay only, never the canvas; the selection a lasso makes at its release re-renders it as
  before. `busy` no longer includes the lasso; the overlays check it themselves.
- **Tests:** `value-store.test.ts` (unit; `npm test` 925). The new guard `e2e/slice-04p/S4P-trial-a.spec.ts` (dev
  server) checks:
  - the overlay's `will-change` and that it comes after the cards;
  - hovering `Customer.email`: three rows marked, its two lines drawn again in the overlay, none in the edge label
    renderer;
  - no canvas and no miniature commit while hovering or while drawing a lasso;
  - the marks after the release.

### Tests run (no dev server running)

The guard, and every test that reads the hover or the selection overlays (step 0's Q1), on the e2e dev server:
- all of slices 1b, 2a and 2b;
- S2C-02 and S2C-12;
- S3A-10 and S3A-14-idle;
- S3B-13 and S3B-15-idle;
- S4A-14.

**58 passed, none failed.** No earlier test changed. Lint, typecheck and `npm test` pass.

### Element counts (S4A-14's method, measurement build of the trial branch)

| View | `.react-flow__viewport`: `slice-04a` → trial A | Whole page: `slice-04a` → trial A |
| --- | --- | --- |
| 100 %, frames expanded | 19,295 → 19,296 | 20,726 → 20,727 |
| 30 %, frames expanded | 4,498 → 4,499 | 5,929 → 5,930 |
| 100 %, frames collapsed | 4,905 → 4,906 | 6,242 → 6,243 |
| 30 %, frames collapsed | 1,463 → 1,464 | 2,800 → 2,801 |

**+1 in every view: the overlay's container**, which is empty while nothing is hovered, selected or lassoed (its
three components render nothing then). `S4A-14-elements.spec.ts` fails on exactly that +1, as expected; if trial A is
adopted, its baseline moves by one (S4P-12: “every difference explained”).

### Screenshots for S4P-04

`docs/prd/slice-04p-screens/step-1-trial-a/` (`SCREENS=step-1-trial-a npx playwright test
e2e/slice-04p/S4P-04-screens.spec.ts`, 1536 × 864, “Customer & orders”):

| | App (trial A) | Prototype |
| --- | --- | --- |
| 100 %, the row `Customer.email` hovered | `hover-100-app.png` | `hover-100-prototype.png` |
| 30 %, the line `customers.email_addr → Customer.email` hovered | `hover-30-app.png` | `hover-30-prototype.png` |

**Where it does not look like the prototype:**
1. **The other lines do not fade on a hover.** In the prototype every other line fades to 12 %. The app has not faded
   them since slice 1b (item 9, accepted then: restyling 340 lines made the hover too slow). Trial A does not change
   that; F4 in step 2 could, if Łukasz wants it.
2. **The hovered lines are drawn above the cards** (approved). In these two views they cross no card, so the
   screenshots look the same as before; where a hovered line runs behind a card, it now runs over it.
3. **At 30 % the app draws no rows** (AD-24 rule 1, below 40 %). So the hover there is on a line, the line is drawn
   again stronger, and no row is marked; the prototype still draws and marks rows at 30 %.
4. The prototype's demo canvas has frames (CRM, WEB, Customer …) and the app's demo canvas does not; this has nothing to
   do with the hover.

## Łukasz's answers after step 1 (14 October)

1. **Trial A accepted as built**; its verdict comes from the step 2 sitting.
2. **If trial A is adopted, S4A-14's reference counts move up by one** (the overlay container): 19,296 / 4,499 / 4,906 /
   1,464 in the canvas viewport (100 % and 30 %, frames expanded and collapsed). `S4A-14-elements.spec.ts` changes only at
   the adoption.
3. **A hover line fade to measure in step 2**: one semi-transparent element in the canvas background's colour, above the
   line layer and below the cards, shown only while something is hovered, so every line under it looks faded (the
   prototype's other lines at 12 %), while the hovered lines stay bright in the overlay above the cards; C-10 with and
   without it in the same sitting, and screenshots at 100 % and 30 %.
4. **Step 2** as in the PRD (F1 for comparison and F4, both on trial A's overlay, each on its own trial branch), with the
   veil's transform during pan and zoom, the holes under a dragged or resized card and the veil's GPU memory at 30 %
   answered; S4P-04 screenshots of Focus and the four lenses before the sitting.

## Step 2: F1 and F4 built, before the sitting (14 October)

### Branches

| Branch | What it adds | Commits |
| --- | --- | --- |
| `slice/04p-canvas-performance` | what fading lights, in `domain` (`src/domain/model/lit.ts`, prototype `relatedOf`: `focusLit`, `lensLit` with the rows' covered or gap colour; 7 unit tests); the measuring method (below) | `841390f`, `63016cc`, … |
| `perf/4p-trial-a` | trial A (step 1) and the **hover line fade** as a variant, off unless the measuring hook switches it: `window.__imHoverFade("off" \| "plain" \| "layer")` | `d63716d` |
| `perf/4p-fade-base` | shared by F1 and F4 (no trial of its own): what is lit **on the canvas** (`fade-canvas.tsx`: cards, blocks of collapsed frames, notes pinned to a lit card), the lit lines drawn again (`LitLines`) and the lens's rows tinted (`LitRows`) in trial A's overlay, the page passing the model and the requirements to the canvas, an empty `FadeLayer` slot | `badb0d4` |
| `perf/4p-trial-f4` | **F4**: one veil (an SVG path, in the canvas background's colour at 75 %) on a compositing layer of its own, in the overlay above the cards, with a hole for every lit card, block and note; the lit lines and rows above it | `1e5c57f` |
| `perf/4p-trial-f1` | **F1** (comparison): one veil in the viewport's big layer at z-index 1, the lit cards' React Flow wrappers lifted to z-index 2, the overlay at z-index 3 with the lit lines and rows | `c77d021`, `7071f1b` |

All the trial branches have the slice branch merged in, so they measure with the same specs. Each trial is tagged
`perf/4p-trial-{name}` at its verdict after the sitting.

**The hover line fade** (Łukasz after step 1): one element in the canvas background's colour at 88 %, drawn in React
Flow's edge label layer after the line layer, so it lies above every line and below the cards, mounted only while
something is hovered (and not while dragging or drawing a lasso); the hovered lines stay bright in the overlay. Two
ways to measure: “plain” (in the viewport's big layer) and “layer” (its own compositing layer).

**What the switch does not do:** neither F1 nor F4 re-renders the canvas. Both read the fading request from its store,
so only the `FadeLayer` re-renders (S4P-12).

### Point 3's questions

1. **Does the veil move with the canvas's transform during pan and zoom, with no script per frame?** Yes, for both. The
   veil is inside React Flow's viewport (F4: in the overlay in the viewport portal; F1: in the viewport portal), so the
   viewport's own transform moves and scales it, and nothing about it is recomputed while panning or zooming. The guard
   `e2e/slice-04p/S4P-fading-guard.spec.ts` checks it on the dev server. With Focus on, ten wheel pans and five
   Ctrl+wheel zooms leave the fading layer's commit counter (`window.__imFadeCommits`, development only) and the
   canvas's unchanged, on F4 and on F1.
2. **Do the holes follow a card that is dragged or resized while fading is on?** F4 yes. The `FadeLayer` follows React
   Flow's nodes (as the selection marks do), and the guard drags Customer by its header and then its width, and checks
   that the veil's path has Customer's hole at the new position and width after each. F1 lifts the lit card's wrapper,
   so the card itself shows; the guard checks that it is still lifted after the drag and the resize. Caveat: React Flow
   re-applies its own z-index to a wrapper it re-renders, so in F1 a dragged lit card may drop under the veil during the
   drag; the guard sees it lifted again after the drop.
3. **The veil's GPU memory at 30 %** (F4, measurement build, Chrome's memory-infra dump, 30 % around `ent:23`, fresh
   page each, 4 s settled):

   | | Fading never on | Focus on | Difference |
   | --- | --- | --- | --- |
   | `cc/tile_memory` (the renderer's tiles) | 92.0 MiB | 146.7 MiB | **+54.7 MiB** |
   | `gpu/shared_images` | 102.8 MiB | 157.5 MiB | **+54.7 MiB** |
   | `cc/resource_memory` | 61.2 MiB | 121.9 MiB | +60.7 MiB |

   The veil's margin around the content (20,000 px, so its edge is never in view) does not matter. With 2,000 px the
   figures are identical, so the memory is the tiles of the visible area of the two new layers (the veil and the overlay
   with the lit lines), not the veil's size. While fading is on, the layer tree has 49 drawing layers instead of 47.

   **A first look at pan and zoom** (the same trace, 5 s of the wheel driver each, before and after Focus on, not a
   sitting): Layerize 1,096 → 1,320 ms (+20 %), Paint 2,226 → 2,392 ms (+7 %), raster 100 → 86 ms. That is the cost
   S4P-03 judges; the sitting measures it properly.

### The page's payload

The canvas gets the same `model`, `requirements` and `requirementLinks` objects as the inspector, and React's payload
carries them once. The “Performance test” canvas page is 3,019,445 bytes on F4 against 3,019,147 on the slice branch
(+298 bytes, the prop's wrapper), three loads each, measurement build. C-08 should not move.

### Tests (no dev server running)

- **Unit:** `npm test` 932 on every branch (`lit.test.ts` 7, `value-store.test.ts` 1, as before otherwise). Lint and
  typecheck pass on every branch.
- **Guards** (`S4P-fading-guard.spec.ts`, `S4P-trial-a.spec.ts`) pass on F4 and F1. The fading guard checks: switching
  Focus and REQ-101's lens on and off without a canvas or miniature commit; REQ-101 tinting Customer's rows 5 covered and
  3 gaps; pan and zoom without a fading or canvas commit; the hole or the lifted card after a drag and a resize. It skips
  itself where the branch has no mechanism.
- **The overlay list** (slices 1b, 2a, 2b, S2C-02, S2C-12, S3A-10, S3A-14-idle, S3B-13, S3B-15-idle, S4A-14):
  **57 passed** on F4 and **57 passed** on F1. No earlier test changed.

### Screenshots for S4P-04

`docs/prd/slice-04p-screens/step-2-f4/` and `step-2-f1/` (`SCREENS=<folder> npx playwright test
e2e/slice-04p/S4P-04-screens.spec.ts` on the trial's branch), 1536 × 864, frames expanded:

| Scenario | 100 % | 30 % | Prototype beside it |
| --- | --- | --- | --- |
| Focus, “Customer & orders” (Customer) | `demo-focus-100-app.png` | `demo-focus-30-app.png` | `demo-focus-{100,30}-prototype.png` (Customer selected, Focus on) |
| Small lens, “Customer & orders” (REQ-102: three attributes) | `demo-lens-small-100-app.png` | `demo-lens-small-30-app.png` | `demo-lens-small-{100,30}-prototype.png` (REQ-102 selected) |
| Large lens, “Customer & orders” (REQ-101: the entity) | `demo-lens-large-100-app.png` | `demo-lens-large-30-app.png` | `demo-lens-large-{100,30}-prototype.png` (REQ-101 selected) |
| Focus, “Performance test” (`ent:23`) | `perf-focus-100-app.png` | `perf-focus-30-app.png` | – (the prototype has no such data) |
| Small lens, “Performance test” (REQ-101) | `perf-lens-small-100-app.png` | `perf-lens-small-30-app.png` | – |
| Large lens, “Performance test” (REQ-102) | `perf-lens-large-100-app.png` | `perf-lens-large-30-app.png` | – |
| Dense lens, “Performance test” (REQ-103, S1A-14's view) | `perf-lens-dense-100-app.png` | `perf-lens-dense-30-app.png` | – (no requirement linked to tables only in the prototype) |
| Hover with the hover line fade (“plain”) | `hover-fade-100-app.png` | `hover-fade-30-app.png` | `hover-{100,30}-prototype.png` |

F1's pictures look the same as F4's: the mechanisms differ, not the look.

**Where it does not look like the prototype** (the first three accepted for now, to be judged on these pictures):
1. One fade level: cards, frames and notes at about 25 % (the prototype: 25 %, 35 %, 30 %).
2. Lit lines are drawn above the faded cards they cross; in the prototype they pass under them.
3. A gap row is tinted orange (translucent, over the row) but its name keeps its colour; the prototype also turns the
   name orange. Covered rows are tinted blue the same way.
4. The hook switches fading without selecting anything, so the right panel shows the canvas overview; in the
   prototype the Focus or the requirement is also selected and its panel open. That is 4b's (the button and the lens in
   the requirement panel).
5. The veil lies over the grid too, so the grid's dots fade with everything else; in the prototype the grid stays.
6. The hover line fade fades the frames too (they are under the lines), and the grid as in 5; the prototype fades only
   the other lines. F1 does not lift notes, so notes pinned to a lit card fade (F4 cuts a hole for them).

### The sitting (after Łukasz's OK)

Prepared (`npx tsx scripts/measure-trials.ts --prepare-only …`, log `.data/s4p-trials-prepare.log`). It makes a
worktree per trial next to `../infomapper-ab-main`: `../infomapper-side-perf-4p-trial-a`, `-f1`, `-f4`, each with its
own `npm ci` and measurement build. One sitting, every side in turns, the starting side moving by one each round, a
quiet machine before every side:

```bash
npx tsx scripts/measure-trials.ts --rounds 2 --against slice-04a --sides perf/4p-trial-a,perf/4p-trial-f1,perf/4p-trial-f4
```

Every side runs S1B-10 (C-10, and pan and zoom at the overview and 100 %), S2A-14's lasso marks, and the fading spec:
- pan and zoom with fading off in its six views;
- on F1 and F4, every scenario: switching on and off, and pan and zoom with fading on;
- on the three trial sides, C-10 with the hover line fade off, “plain” and “layer”.

The summary has one table across the four sides (median, min–max, change against `slice-04a`) and a fading table per
candidate with S4P-02's and S4P-03's results. Estimated time: about 7 minutes for `slice-04a`, 9 for trial A and 15–17
for F1 and F4 per round, so about 1 h 45 min for two rounds after a warm-up. A warm-up run (one round, not counted)
first, as before:

```bash
npx tsx scripts/measure-trials.ts --rounds 1 --against slice-04a --sides perf/4p-trial-a,perf/4p-trial-f1,perf/4p-trial-f4
```

## Step 2: the sitting (14–15 October)

`npx tsx scripts/measure-trials.ts --rounds 3 --no-build --against slice-04a --sides
perf/4p-trial-a,perf/4p-trial-f1,perf/4p-trial-f4`, sitting `trials-2026-10-14-20-04`, after the warm-up sitting
`trials-2026-10-14-19-27` (one round, not counted, which made the four measurement builds). The laptop was prepared by
Łukasz. Sides: `slice-04a` (`5e02c96`), trial A (`641518e`), F1 (`37b2e73`), F4 (`f0d0f61`). Each round turns the
starting side by one. Every side waited for a quiet machine (below 2 % for 30 s, at most 3 minutes).

**Round 1 dropped, replaced by round 4.** Every side of round 1 was slow against rounds 2 and 3:
- `slice-04a`'s S1B-10 100 % runs 44.0 / 39.8 / 35.7 fps, against 45.6–49.9 later;
- F1's fading-off 100 % 26.2 fps, against about 47;
- F4's fading-off 100 % 37.7, against 43–46.

The quiet waits passed, but F4's took 113 s with peaks of 19 %, and Explorer was among the busiest processes after
`slice-04a`'s and trial A's sides. Round 4 (`--add-round`; all four sides quiet after 31–165 s, nothing above 2.3 %
after any side) replaces it.

**Flagged, kept:** trial A's round 2, the first side of that round, ran S1B-10 at 100 % at 40.7 / 39.2 / 40.0 fps (46.7–47.8
in rounds 3 and 4) and its fading-off 100 % at 40.4. It shows as the low end of trial A's ranges below; dropping it
would not change any verdict.

### Every figure, three rounds (2, 3, 4): median (min–max), change against `slice-04a`

| Figure | `slice-04a` | Trial A | F1 | F4 |
| --- | --- | --- | --- | --- |
| C-10 hover to the next frame, median of 40 | 120 (115–121) | **19 (19–24), −84.4 %** | 19 (19–22), −83.9 % | 19 (18–20), −84.5 % |
| Lasso marks, median of 20 | 28 (28–29) | 29 (23–33), +2.1 % | 29 (26–30), +2.1 % | 23 (23–30), −17.1 % |
| Pan and zoom, overview (S1B-10) | 58.9 (58.1–59.2) | 58.6 (57.2–59.0), −0.5 % | 58.6 (58.5–59.3), −0.5 % | 58.7 (58.6–59.2), −0.3 % |
| Pan and zoom, 100 % (S1B-10) | 48.7 (48.5–48.8) | 47.2 (40.0–47.7), −3.1 % | 47.8 (47.6–48.0), −1.8 % | 46.8 (46.1–47.5), −3.9 % |
| Fading off, 100 % around `ent:23`, expanded | 47.6 (47.5–47.7) | 47.1 (40.4–47.9), −1.1 % | 47.0 (46.9–47.4), −1.3 % | 45.7 (43.3–45.8), −4.0 % |
| Fading off, 30 %, expanded | 48.9 (45.6–52.2) | 47.6 (47.5–51.1), −2.7 % | 52.0 (48.0–53.2), +6.3 % | 47.6 (44.3–50.1), −2.7 % |
| Fading off, 100 % dense area, expanded | 45.1 (40.5–46.8) | 42.4 (41.4–47.3), −6.0 % | 48.0 (47.4–48.7), +6.4 % | 44.6 (43.6–47.6), −1.1 % |
| Fading off, 100 %, collapsed | 55.9 (55.1–56.1) | 55.6 (55.5–56.5), −0.5 % | 56.3 (56.0–56.3), +0.7 % | 56.0 (55.3–57.1), +0.2 % |
| Fading off, 30 %, collapsed | 57.4 (56.9–57.9) | 57.5 (57.0–58.1), +0.2 % | 58.0 (57.3–58.2), +1.0 % | 57.9 (57.7–58.0), +0.9 % |
| Fading off, 100 % dense area, collapsed | 60.0 (60.0–60.0) | 60.0 (59.9–60.0), 0.0 % | 60.0 (59.7–60.0), 0.0 % | 59.9 (59.9–60.0), −0.2 % |
| C-10, hover line fade off (fading spec) | – | 26 (20–26) | 22 (21–32) | 22 (20–22) |
| C-10, hover line fade “plain” | – | **228 (223–247)** | 224 (222–232) | 223 (222–228) |
| C-10, hover line fade “layer” | – | **247 (243–319)** | 244 (244–246) | 244 (243–245) |

Frames over 50 ms with fading off: the same on every side within ±1–2 (100 %: 9 on each side; 30 %: 8–9; collapsed 2–6;
the collapsed dense area 0). Per round and side every value is in the sitting's folder.

### Fading: switching (S4P-02) and pan and zoom with fading on against off (S4P-03), same run

S4P-02: on and off each ≤ 100 ms (median of 40). S4P-03: pan and zoom with fading on at most 5 % below fading off in the
same run, and no more frames over 50 ms than off plus the baseline's spread (±4).

**F1**

| View | Scenario | On, ms | Off, ms | Pan and zoom off → on, fps | Change | Frames over 50 ms | S4P-02 | S4P-03 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 100 %, expanded | Focus | 27 | 27 | 47.0 → 47.5 | +1.1 % | 9 → 9 | met | met |
| 100 %, expanded | Lens, small | 29 | 26 | 47.0 → 44.9 | −4.5 % | 9 → 11 | met | met |
| 100 %, expanded | Lens, large | 27 | 27 | 47.0 → 49.0 | +4.3 % | 9 → 9 | met | met |
| 30 %, expanded | Focus | 17 | 16 | 52.0 → 49.9 | −4.0 % | 8 → 8 | met | met |
| 30 %, expanded | Lens, small | 16 | 17 | 52.0 → 50.4 | −3.1 % | 8 → 9 | met | met |
| 30 %, expanded | Lens, large | 18 | 15 | 52.0 → 48.3 | **−7.1 %** | 8 → 9 | met | **missed by 2.1 points** |
| 100 % dense area, expanded | Lens, dense | 22 | 22 | 48.0 → 49.0 | +2.1 % | 8 → 9 | met | met |
| 100 %, collapsed | Focus / small / large | 21–22 | 21 | 56.3 → 55.5–56.9 | −1.4 to +1.1 % | 5 → 4–5 | met | met |
| 30 %, collapsed | Focus / small / large | 13–15 | 13–15 | 58.0 → 56.6–57.4 | −2.4 to −1.0 % | 3 → 3–6 | met | met |
| 100 % dense area, collapsed | Lens, dense | 14 | 14 | 60.0 → 59.9 | −0.2 % | 0 → 0 | met | met |

**F4**

| View | Scenario | On, ms | Off, ms | Pan and zoom off → on, fps | Change | Frames over 50 ms | S4P-02 | S4P-03 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 100 %, expanded | Focus / small / large | 27–28 | 27–30 | 45.7 → 45.6–46.0 | −0.2 to +0.7 % | 9 → 10–13 | met | met |
| 30 %, expanded | Focus | 25 | 26 | 47.6 → 42.1 | **−11.6 %** | 8 → 8 | met | **missed** |
| 30 %, expanded | Lens, small | 23 | 35 | 47.6 → 43.1 | **−9.5 %** | 8 → 11 | met | **missed** |
| 30 %, expanded | Lens, large | 22 | 74 | 47.6 → 43.6 | **−8.4 %** | 8 → 9 | met | **missed** |
| 100 % dense area, expanded | Lens, dense | 27 | 27 | 44.6 → 47.3 | +6.1 % | 10 → 7 | met | met |
| 100 %, collapsed | Focus / small / large | 21 | 20–21 | 56.0 → 56.4–57.0 | +0.7 to +1.8 % | 5 → 5–6 | met | met |
| 30 %, collapsed | Focus | 20 | 20 | 57.9 → 55.1 | −4.8 % | 2 → 8 | met | met (frames at the edge) |
| 30 %, collapsed | Lens, small | 20 | 27 | 57.9 → 52.9 | **−8.6 %** | 2 → 8 | met | **missed** |
| 30 %, collapsed | Lens, large | 20 | 43 | 57.9 → 52.1 | **−10.0 %** | 2 → 8 | met | **missed** |
| 100 % dense area, collapsed | Lens, dense | 21 | 21 | 59.9 → 59.9 | 0.0 % | 0 → 0 | met | met |

### Reading

- **Trial A takes C-10 from 120 ms to 19 ms** on every side that has it (F1 and F4 include it): the hover no longer
  repaints the viewport's big layer. The lasso marks were already at 28 ms on `slice-04a` (Chrome 155) and stay there.
  Pan and zoom with trial A are within −0.5 to −6.0 % of `slice-04a`, inside the baseline's spread, and F1, which has
  trial A's overlay too, is at −1.8 % to +6.4 %. So the overlay costs no measurable pan and zoom.
- **The hover line fade costs about 200 ms** a hover: 223–247 ms against 19–26 ms without it, on every branch. Its
  element under the cards changes the viewport's big layer (“plain”: everything under it repaints) or, on its own layer
  (“layer”: 244–247 ms), makes Chrome put the cards above it on layers of their own. Both miss C-10's 100 ms by more
  than double.
- **F4, the expected winner, loses pan and zoom at 30 %** (−8.4 to −11.6 % in five of fourteen cells), as step 2's
  trace suggested: its two layers (the veil and the overlay with the lit lines) add about 55 MiB of tiles at 30 % and
  about 20 % Layerize per frame. At 100 % and in the dense area it is free. Its switching is fast everywhere
  (20–28 ms on; off up to 74 ms for the large lens at 30 %).
- **F1, the comparison, does better than expected.** Switching takes 13–29 ms on and 13–27 ms off in every scenario.
  Pan and zoom with fading on are within 5 % of fading off in 13 of 14 cells. The one miss is the large lens at 30 %
  expanded, −7.1 % (52.0 → 48.3), with 8 → 9 frames over 50 ms. That view's own fading-off figure varies 45.6–52.2 on
  `slice-04a` (about ±7 %). Its veil is one ordinary element in the big layer: Chrome repaints under it once when it
  appears and then moves it with the rest, with no new layers and no extra tiles.
- **F1's weaknesses are in how it was built, not in its cost.** It lifts the lit cards by writing `z-index` on React
  Flow's wrappers, which React Flow overwrites when it re-renders a wrapper (a lit card being dragged drops under the
  veil until the drop), and it does not lift notes.

### Proposed verdicts (Łukasz chooses)

| Trial | Proposed verdict | Bars |
| --- | --- | --- |
| **Trial A** (overlay on its own layer, hover lines above the cards) | **adopt** | S4P-05 C-10 ≤ 100 ms: **met** (19 ms, from 120). S4P-06 lasso marks ≤ 100 ms: **met** (29 ms; already met by `slice-04a` under Chrome 155). S4P-08: pan and zoom −0.5 to −6.0 %, within the baseline's spread: **met**. One element more in the viewport (the container), already recorded. |
| **Hover line fade** (“plain” and “layer”) | **reject both** | C-10 ≤ 100 ms: **missed**, 228 and 247 ms (19–26 ms without it). The other lines keep their colour on a hover, as since slice 1b. |
| **F4** (veil with holes on its own layer) | **reject** | S4P-02: **met** (20–28 ms on, ≤ 74 ms off). S4P-03: **missed** at 30 %, 5 of 14 cells −8.4 to −11.6 %; +55 MiB of tiles at 30 %. |
| **F1** (veil in the big layer, lit cards lifted) | **choose, finished properly in step 3** | S4P-02: **met** in every scenario (13–29 ms). S4P-03: **met in 13 of 14**; the large lens at 30 % expanded −7.1 % (2.1 points over the bar, within that view's ±7 % spread on the reference; Łukasz decides whether that counts as met). No extra layers or memory. |

**If F1 is chosen, step 3 would finish it this way:**
- lift the lit cards and the notes pinned to them with one stylesheet rule written by the `FadeLayer`
  (`.react-flow__node[data-id="…"] { z-index: 2 !important }`) instead of the wrappers' inline style, so React Flow's
  re-renders cannot drop them (no canvas commit either);
- keep the veil, the lit lines and the lens rows as built;
- add unit tests for what is lit (the domain's are there) and the guard for S4P-12;
- trial for the notes layer (item 7) after it.

Then the step 5 sitting confirms S4P-03 for the large lens at 30 % with three rounds against `slice-04a`.

## Łukasz's verdicts after step 2 (15 October)

| Trial | Verdict | Tag | Figures (sitting `trials-2026-10-14-20-04`) |
| --- | --- | --- | --- |
| Trial A: the overlay on its own compositing layer | **adopted** | `perf/4p-trial-a` (`641518e`) | C-10 120 → 19 ms; lasso marks 28 → 29 ms; pan and zoom −0.5 to −6.0 %, within the baseline's spread |
| The hover line fade, “plain” and “layer” | **rejected** | inside `perf/4p-trial-a` (`d63716d`), not carried into the slice | C-10 228 and 247 ms against 26 ms without it |
| F4: a veil with holes on its own layer | **rejected** | `perf/4p-trial-f4` (`f0d0f61`) | switching 20–74 ms (S4P-02 met); pan and zoom −8.4 to −11.6 % at 30 % in 5 of 14 cells (S4P-03 missed); +55 MiB of tiles at 30 % |
| F1: one veil in the canvas layer, lit cards lifted | **chosen** | `perf/4p-trial-f1` (`37b2e73`) | switching 13–29 ms (S4P-02 met); pan and zoom within 5 % in 13 of 14 cells |

**F1's one miss** (the large lens at 30 %, frames expanded, −7.1 %) is re-checked on the finished F1 in the step 5
sitting: missing by at most about 3 points is accepted as partly met, with an entry in `docs/known-limitations.md`;
more than that is discussed. Written into the PRD's S4P-03.

## Step 3: fading finished (15 October)

- **Into the slice:** trial A and F1 (merge `4e65baf` of `perf/4p-trial-f1`, which carries trial A and the shared
  base). Trial A's hover line fade is not carried in (removed; the fading spec's hover-fade part skips itself without
  its hook).
- **F1 finished** (`ffec39b`): the lit cards and blocks, and the notes pinned to a lit card, are lifted above the veil
  by one stylesheet rule the `FadeLayer` writes (`.react-flow__node[data-id="…"], .nt[data-note="…"] { z-index: 2
  !important }`), no longer by writing `z-index` on React Flow's wrappers. `!important` in a stylesheet wins over the
  inline `z-index` React Flow writes when it renders a wrapper, so a lit card stays above the veil while it is dragged.
  Nothing re-renders the canvas.
- **The capability for 4b** (PRD section 6, `src/canvas/fade.ts`): `requestFade({ focus })`, `requestFade({ lens })`,
  or `requestFade({ lit, key })` with a lit set worked out elsewhere (entities and tables for cards, rows with a covered
  or gap colour, mappings and relationships for lines), or `null`. The domain computes Focus's and the lens's sets
  (`src/domain/model/lit.ts`).
- **S4A-14's reference counts** move up by one (the overlay container): `S4A-14-elements.spec.ts` adds it to slice 3b's
  file. In the measurement build: 19,296 / 4,499 / 4,906 / 1,464 in the viewport, as the rule expects. Fading adds no
  element while it is off.
- **`docs/decisions.md`, AD-24** (approved by Łukasz): the overlay on its own layer; fading as one veil with a
  stylesheet lift; F4 and the hover line fade rejected with their figures (`55bc44e`).
- **`docs/known-limitations.md`:** C-10 met; the other lines do not fade on a hover, rejected with figures.

### Tests

- **Unit:** `npm test` 938 (932 before):
  - `fade-canvas.test.ts`: what is lit on the canvas, including a hidden lit card lighting its collapsed frame's
    block; the lift rule; the direct lit set's key;
  - the domain's Focus and lens tests, row colours included, as at step 2 (`lit.test.ts`).
- **Guard** `e2e/slice-04p/S4P-fading-guard.spec.ts`, rewritten for the finished F1:
  - Focus on Customer lifts its four cards, not `order_header`;
  - REQ-101's lens tints 5 covered and 3 gap rows;
  - a lit set given directly (the table `order_line`) lifts it and its two pinned notes, not the free note;
  - switching, panning and zooming commit neither the canvas nor the miniature (nor the fading layer while panning);
  - the same drag commits the canvas and the miniature as often with fading on as off;
  - Customer stays at z-index 2 during and after the drag, and after a resize.
- **The whole suite once** (`npm run e2e`, no dev server running): **157 passed** in 25.5 min, no retries (the 155 of
  slice 4a and the two guards). No earlier test changed.

## Step 3: the notes layer (PRD item 7), built, trace not yet run

Branch `perf/4p-trial-notes` (`62f9338`): the notes' container gets `will-change: transform`, so the notes have a
compositing layer of their own and their paint and Layerize are no longer part of the cards'. Side effect: it makes the
container a stacking context, so notes pinned to a lit card can no longer be lifted above the fading veil (every note
would fade). The cheaper path (Łukasz): one Chrome trace panning at 30 %, notes on against this slice. If Layerize and
memory rise as with F4, the verdict is “rejected” with those figures; a full sitting only if the trace shows a gain.
The trace waits for Łukasz's OK.
