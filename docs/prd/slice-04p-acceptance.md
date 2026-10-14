# Slice 4p – Acceptance

Status: **step 0 done, waiting for Łukasz** (answers below; the baseline sitting is prepared, not measured). Branch
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

### Baseline sitting (S4P-01): prepared, not measured

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
