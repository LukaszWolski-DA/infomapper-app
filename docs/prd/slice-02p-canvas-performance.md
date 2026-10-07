# Slice 2p – Canvas performance

Status: ready once Łukasz confirms it · Branch: `slice/02p-canvas-performance` · Builds on: slice 2a (`main` at
`b6f3452`, tag `slice-02a`)
Decisions: AD-24, AD-25, AD-29, AD-31; D-01, D-49 (lines), D-22 (layer mode, notation)

## Goal

Make the canvas meet its performance bars on the reference laptop without changing what the user sees or does. The
slice 2a diagnosis found two separate costs, both in painting, not in JavaScript:

- **The line layer** is the cost of the hover highlight (C-10: about 150 ms, about 49 ms without the line layer) and
  probably of the lasso marks (139 ms). AD-24 already names the remedy: draw the lines on an HTML canvas instead of SVG.
- **The card rows** are the cost of resize and drag (C-09: 28–32 fps, 57–59 fps with cards drawn as blocks; single-card
  drag 13 fps, 23–27 fps as blocks; group drag 25–27 fps).

This slice adds no feature. Slice 2b (frames) follows; it adds large frame fills and line bundles, so the line layer
should be in its final form first.

## Reference

- Measurements and diagnosis: `docs/prd/slice-02a-acceptance.md` (S2A-14 and the diagnosis tables),
  `docs/known-limitations.md` (S1A-14, C-09, C-10, group drag, lasso marks).
- Canvas rules: AD-24 in `docs/decisions.md`; the spike report `spikes/canvas-react-flow/REPORT.md`.
- Measuring: the production measuring build (`npm run measure:build`, `npm run measure:start`, `MEASURE=1
  MEASURE_BUILD=production`), the A/B script `scripts/measure-ab.ts` and the `../infomapper-ab-main` worktree, the
  diagnosis switches `DIAG=nolines` and `DIAG=blocks`.
- Behaviour of the lines: the prototype and slices 1a, 1b, 2a as built. Everything the lines do today is the
  specification for the new renderer.

## Reference hardware and method

- **The reference machine is the development laptop** (i7-8550U, Intel UHD 620, 1536 × 864, DPR 1), the same as for the
  spike and every slice so far. There is no second machine; AD-24's “also on a newer machine” is replaced in this slice.
- **Bars are judged in the production measuring build.** Dev numbers are recorded, not judged.
- **Every measurement is A/B**: this branch and `slice-02a` in turns in one sitting, medians of at least 3 rounds,
  conditions recorded (power, power mode, other programs). A round disturbed by something else is repeated, not
  averaged in. Before a measuring sitting, stop and ask Łukasz to prepare the laptop.

## In scope

1. **One measuring command.** A single command that runs every performance measurement of the canvas in the production
   measuring build, A/B against `slice-02a`: pan and zoom at the overview and at 100% (S1A-14, with grid Dots), initial
   render (C-08), card resize (C-09), hover (C-10), single-card drag, group drag (31 cards at 50%), lasso marks. It
   writes one results file and one table (median, spread, bar, met or not) for the acceptance doc.
2. **Mapping and relationship lines on an HTML canvas.** `src/canvas/LineLayer.tsx` draws all lines on one `<canvas>`
   element instead of SVG, keeping everything the lines show today:
   - mapping lines from the column's row to the attribute's row on facing sides, with end dots above 40% zoom;
   - status styles (approved solid, in review dash-dot, draft dashed), the map colour, type problems in orange;
   - combined mappings: input lines meeting in the ƒ node next to the attribute, one line on (D-49);
   - relationship lines with their ends in crow's foot and UML notation and their labels (D-22);
   - lines of collapsed cards and filtered rows anchored to the header (S1A-04), detail by zoom below 40% (S1A-03);
   - layer mode Everything / Mappings / Relationships (S2A-11);
   - hover emphasis: the hovered row's lines drawn again above the others, nothing faded (S1B-10);
   - the selected line and the fading of other lines when a row or a line is selected (slice 1a);
   - sharp at every zoom from 10% to 300% and at DPR 1 and 2 (the canvas is sized to the visible area and redrawn,
     never scaled as a bitmap).
3. **Line interaction without SVG elements.** Clicking a line selects it, hovering shows the pointer as today, a right
   click opens its toolbox (D-19), Delete or Backspace deletes a selected line (slice 1b), at every zoom, including
   the lines into and out of an ƒ node. Hit testing is our own, from the same geometry, with a tolerance of at least
   the current clickable width. Rows, cards, the relate line, the column drag and the lasso must keep working on top.
4. **Geometry stays independent of drawing.** Line geometry (end points, routes, ƒ nodes, relationship ends) is
   computed by a module that knows nothing about SVG or canvas, so a later export to SVG or PDF (B-06) can draw the
   same lines. The SVG renderer is removed once step 2 is accepted; there are not two renderers to maintain.
5. **Tests that do not depend on SVG.** The e2e tests that read line ends or line styles from SVG elements (S1A-01 to
   S1A-04, S1B-01, S1B-05, S1B-06, S1B-10, S1B-13, S2A-03, S2A-11 and any other) get a test-only way to read the drawn
   lines, e.g. a geometry snapshot the line layer exposes when the e2e or measuring flag is set. What each test checks
   does not change.
6. **Cheaper card painting during gestures, without changing the look.** While a card is resized or one or more cards
   are dragged, only the moving or resized cards may repaint; the rest of the canvas must not. Candidates, to be
   measured one by one: the moving cards on their own compositing layer for the duration of the gesture only; CSS
   containment (`contain: layout paint` or similar) on cards; no style change on cards that do not move. The AD-24 rules
   stay (no opacity on repeated elements, `will-change` as in setup B, switched off during resize and drag, no
   `overflow: hidden` on repeated elements unless the text may not fit).
7. **Initial render: diagnosis.** Production measured 2.1 s against 1.5 s. Find where the time goes (server, transfer,
   first paint of cards, first paint of lines) and fix what is cheap and changes nothing visible; report the rest.

## Out of scope

Any change to the look or the content of cards (fewer elements per row, detail by zoom between 40% and 100%, other
fonts): only after Łukasz decides on measured options, as a step added to this slice by that decision · WebGL or web
workers · the Overview minimap (unless the line change breaks it) · frames (slice 2b) · Supabase.

## Steps (stop after each one and report)

### Step 0 – Baseline
Item 1. Run it once on `slice-02a` against itself to show the spread of the method on this laptop (stop and ask
Łukasz to prepare the laptop first). Report the baseline table.

### Step 1 – Line layer trial
A canvas renderer behind a measurement-only flag (users never see it), drawing the mapping and relationship lines
with their real geometry and styles, without interaction. Measure C-10, lasso marks, pan and zoom, and the drags
against the SVG renderer. **Decision gate:** report the numbers; continue to step 2 only after Łukasz's go.

### Step 2 – Line layer complete
Items 2, 3, 4 and 5: the canvas renderer becomes the only one, with everything the SVG one did, its interaction and
the test hooks. Full e2e run. Łukasz compares Customer & orders side by side with `slice-02a` (screenshots at 25%,
100% and 300% in both notations, saved for the acceptance doc).

### Step 3 – Card painting
Item 6, one technique at a time, each measured (C-09, single-card drag, group drag) and kept only if it helps. If the
bars are still missed, report the numbers and the options that change the look, with a measurement of each where
possible (the `DIAG=blocks` switch shows the upper limit), and wait for Łukasz's decision.

### Step 4 – Initial render
Item 7.

### Step 5 – Acceptance and the bars
The full measuring command A/B against `slice-02a`; three full e2e runs in a row with no dev server running; CI. For
every bar: met, or a proposal to Łukasz to change it with the reason (the bars come from the spike's simpler cards).
Update AD-24 (the reference laptop, the HTML canvas line layer, the card painting rules that were kept) and
`docs/known-limitations.md`. Write `docs/prd/slice-02p-acceptance.md`.

## Acceptance criteria

| ID | Criterion |
| --- | --- |
| S2P-01 | One command measures every canvas performance figure in the production measuring build, A/B against `slice-02a`, and writes one table with median, spread, bar and result. |
| S2P-02 | Mapping and relationship lines look as before on Customer & orders and Order lines & products at 25%, 100% and 300%, in crow's foot and UML, at DPR 1 and 2 (screenshots side by side, checked by Łukasz); they stay sharp at every zoom. |
| S2P-03 | Every existing e2e test passes and checks the same things as before; line tests read the drawn lines through the test hook, not through SVG elements. |
| S2P-04 | Clicking, hovering, right-clicking and deleting lines work as before at 25%, 100% and 300%, including the lines of a combined mapping; rows, cards, column drag, relate and lasso still work where lines cross them. |
| S2P-05 | C-10: hover to the next frame ≤ 100 ms (median of 40 hovers on mapped rows at 100%). |
| S2P-06 | Lasso marks appear ≤ 100 ms after releasing a lasso around the visible cards at the overview (median of 20). |
| S2P-07 | C-09: resizing the 200-row card at 50% runs at ≥ 45 fps on average. |
| S2P-08 | Single-card drag and group drag (31 cards at 50%) run at ≥ 45 fps on average. |
| S2P-09 | Pan and zoom at the overview and at 100% are no more than 5% below `slice-02a` in the same sitting, and S1A-14's absolute bar (≥ 50 fps, no frame over 50 ms) is recorded; initial render is recorded with its breakdown. |
| S2P-10 | For every criterion S2P-05 to S2P-09 that is not met, the acceptance doc records the numbers, what was tried, and Łukasz's decision (bar changed with a reason, or a follow-up). |
| S2P-11 | AD-24 and `docs/known-limitations.md` are up to date; CI passes; three full e2e runs in a row pass. |

## Definition of done

All criteria pass, steps were reported one by one, assumptions are listed, and Łukasz has worked for a few minutes on
“Performance test” in the production measuring build (hover, lasso, drag a group, resize the 200-row card) and on
Customer & orders (the lines look and behave as before), then accepted the slice.
