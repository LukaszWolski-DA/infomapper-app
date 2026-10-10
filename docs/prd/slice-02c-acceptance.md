# Slice 2c – Acceptance

Status: **accepted by Łukasz on 10 October 2026**. Branch `slice/02c-collapsed-frames`, pull request #8.

## Criteria

Each criterion has its Playwright test in `e2e/slice-02c/`, named after its id; every test starts from a freshly seeded
data file and does not depend on another. Frames a test starts from are drawn around the seed's cards through the domain
(`AROUND`, `makeFrame`) and collapsed through the domain when the test needs that (`collapse`, `collapsedFrame` in
`e2e/slice-02c/helpers.ts`); what the criterion checks goes through the page with the real mouse and keyboard.

| ID | Test | Result |
| --- | --- | --- |
| S2C-01 | `S2C-01.spec.ts` (3 tests): a free frame around all 7 cards collapsed by the label's button: its block at the frame's corner, 280 px wide, as high as the prototype's `blockH`, “Free area”, “collapsed, 7 cards”, six member rows with “n/m”, “and 1 more”, the frame's chips; no card moves in the data; Ctrl+Z expands it and every card is drawn in its place. Collapse and expand by the label button and the block's “Expand”, by double-clicks on the name and on the block's header, by the toolbox (“Collapse into one block” / “Expand”) and by the frame panel (“Collapse frame” / “Expand frame”), each with its toast, no card moving, and Ctrl+Z undoing one step at a time. The label's collapse button sits just left of the name on its row, covers neither the name nor the chips and is clickable at 25, 40, 100 and 300 % | passes |
| S2C-02 | `S2C-02.spec.ts` (3 tests): with Customer's concept frame collapsed, Customer is not drawn; hovering, a lasso around its hidden place (not around the block), a column dropped on its hidden rows and a relationship drawn to it do nothing; selected from the left panel it is selected, its panel shows and the view centres on the block; the arrow keys do not move it (decision (b)); a click on its row in the block expands the frame and selects it. Collapsing a frame takes its cards out of a selection of several (prototype `pruneMulti`) | passes |
| S2C-03 | `S2C-03.spec.ts` (2 tests): a click on the block selects the frame; dragging its header moves the frame and its hidden card by the same snapped amount, one Ctrl+Z puts both back; its toolbox offers “Expand”, no “Fit frame to its content”, “Select its cards” disabled, no resize handle. A lasso only partly around the block catches nothing, fully around it the frame; with web_users: group drag, nudge (one undo step), Align left, Line up in a row and Stack in a column move the block with its hidden card, and stacking uses the block's height, not the frame's | passes |
| S2C-04 | `S2C-04.spec.ts` (2 tests): web_users dragged onto a collapsed frame's block joins it at x = frame's x + 32, y = frame's bottom − 8 (snapped), the frame grows, the toast names both, no other card is claimed or moved; Order Line dropped on a Customer concept frame's block asks the concept question, and “Move” is saved with the drop | passes |
| S2C-05 | `S2C-05.spec.ts` (3 tests): with the source frame CRM (customers) collapsed, its seven mappings are one line per attribute from the middle of the block's right side; a single mapping keeps its status style (review, approved), its ƒ chip (created_at) and its selection, opens the mapping panel and is deleted by Delete. With the three tables on the left collapsed together, customers.email_addr and web_users.email are one line with the count chip “2”. With customers and Customer in one collapsed frame, their seven mappings are not drawn | passes |
| S2C-06 | `S2C-06.spec.ts` (2 tests): with the tables and the frame around Customer and Order Line collapsed, one bundle of 8 from block to block, one line per attribute to Sales Order, and one relationship line “2 relationships”; Mappings hides the relationship bundle, Relationships the mapping bundles and lines. With Customer and Sales Order in the second frame, one bundle of 13 and “1 relationship” | passes |
| S2C-07 | `S2C-07.spec.ts` (3 tests): a click on the bundle of 13 opens its panel: “Bundled mappings”, “13 mappings”, “From Tables (collapsed frame) to People (collapsed frame).”, “9 approved, 2 in review, 2 draft.”, the mappings under “Into Customer” and “Into Sales Order” as links (one opens the mapping panel), “Expand Tables” and “Expand People”; “Expand Tables” expands it and the bundle is gone. The bundle's toolbox: “Show what is inside”, “Expand Tables”, “Expand People”. A relationship bundle's panel: “Bundled relationships”, “2 relationships”, “Between Sales Order and Ends (collapsed frame).”, each relationship with its multiplicities, as a link | passes |
| S2C-08 | `S2C-08.spec.ts` (4 tests): “Collapse all” and “Expand all” in the canvas overview, each one undo step with its toast; without frames neither is offered. With every card in a collapsed frame: F fits the block, the Overview draws one block and no card, and a card placed from the left panel does not land on the block. “Add the 1 missing to this canvas” for Customer hidden in a collapsed frame places customers beside the block (decision (ii)) | passes |
| S2C-09 | `S2C-09.spec.ts`: Duplicate layout: the copy's frames have the same collapsed state, and the copy draws a block for the collapsed one | passes |
| S2C-10 | `S2C-10.spec.ts`: as Piotr (reviewer): a bundle's panel and its mapping link work; collapsing (label button), expanding (block's “Expand”) and “Collapse all” change his tab only: nothing saved, Undo stays disabled, a reload shows the saved state; the collapse commands called directly (one frame, all frames) are refused with “As a reviewer you cannot change what is on a canvas.” and change nothing | passes |
| S2C-11 | `S2C-11.spec.ts`: the unit tests in `src/canvas/line-geometry.test.ts` cover grouping keys, single-mapping identity, lines inside one frame left out, layer mode, both ends collapsed, relationship bundles, distinct mappings and the line end at a block; the spec runs them (15 tests, all pass) | passes |
| S2C-12 | quick `measure:canvas` rounds on “Performance test” against `slice-02b`, expanded and with `DIAG=collapsed`; `S2C-12.spec.ts` is the guard against the render loop found in the first rounds | **met after two fixes** (details below): expanded +1.4 % at the overview and +4.8 % at 100 %, long frames 0 / 4 against slice 2b's 0 / 9; collapsed at 100 % 60.0 fps with no long frame, against 52.0 expanded |
| S2C-13 | `S2C-13.spec.ts` (the workflows, scripts and one spec per criterion) | passes: CI (lint, typecheck, unit tests, Postgres migration check) green on every push of this slice; lint, typecheck, 641 unit tests; three full e2e runs in a row on e48050e, 108 of 108 each (16.1, 16.0, 16.0 min), see below |

### Three full runs in a row

`npm run e2e` with no dev server running. The rule: three passing runs in a row, and after any test change the three
start again.

| Set | Commit | Runs | What happened |
| --- | --- | --- | --- |
| 1 (9 October, 22:32–23:30) | c5fe6ae | 3 | S2C-01 (the four ways to collapse) failed in all three: after two quick Ctrl+Z the next collapse was sent before the page had the frame's new version (“Someone changed this meanwhile”). The test now waits until the page shows each undone state; it then passed three times on its own. Test change: the sets start again. |
| 2 (9–10 October, 23:33–00:34) | b9b1cbe | 3 | Runs 4 and 6 passed (106/106). Run 5: S0-10 (slice 0, restart) — its restarted dev server did not start within 300 s, the known cold start on this laptop. |
| 3 (10 October, 00:34–01:13) | b9b1cbe | 2 | Runs 7 and 8 passed (106/106): runs 6, 7 and 8 were three in a row (19.6, 19.2, 19.1 min); Łukasz accepted points 1 and 2 of step 5 on them. |
| – (10 October) | 1c77cd0, e48050e | 1 each | After the `DIAG=collapsed` switch (and the measuring specs' not-applicable paths): 106/106. After the S2C-12 fixes and the guard spec: 108/108. Code and tests changed, so a final set followed. |
| 4 (10 October, 17:53–18:41) | e48050e | 3 | **108 passed each time** (16.1, 16.0, 16.0 min), no dev server running. |

## S2C-12: rounds against slice 2b

Each sitting is one quick round (`--quick`: pan and zoom, C-08, C-10 and the lasso marks) of `npm run measure:canvas` in
the production measurement build, headed Chrome, 1536 × 864, on the development laptop (the reference machine, AD-24),
this branch against `slice-02b` (2e95478) in `../infomapper-ab-main`. Before each side the machine was quiet (below 2 %;
recorded in each sitting's `sitting.json`); mains power, “Best performance”. The collapsed rounds use the measurement-only
switch `DIAG=collapsed` (below) on this branch's side only; slice 2b's side is the same as in the expanded round.

### First rounds (10 October, 06:27 and 06:37, at 1c77cd0): not met

Expanded, sitting `.data/measure/2026-10-10-06-27`:

| Figure | Bar | slice-02b | This branch | Change | Result |
| --- | --- | --- | --- | --- | --- |
| Pan and zoom at the overview | ≥ 50 fps, ≥ −5 % vs reference | 59.7 | 53.2 | −10.9 % | not met (below the reference) |
| – frames over 50 ms | ≤ 0 | 0 | 11 | – | not met |
| Pan and zoom at 100 %, dense area | ≥ 50 fps, ≥ −5 % vs reference | 47.2 | 50.4 | +6.8 % | met |
| – frames over 50 ms | ≤ 0 | 10 | 12 | – | not met |
| Initial render (C-08), median of 5 | ≤ 1500 ms | 1476 | 1576 | +6.8 % | not met |
| Hover to the next frame (C-10), median of 40 | ≤ 100 ms | 142 | 140 | −1.6 % | not met |
| Marks after a lasso, median of 20 | ≤ 100 ms | 89 | 83 | −6.6 % | met |

Collapsed (`--branch-diag collapsed`), sitting `.data/measure/2026-10-10-06-37`:

| Figure | Bar | slice-02b | This branch (collapsed) | Change | Result |
| --- | --- | --- | --- | --- | --- |
| Pan and zoom at the overview | ≥ 50 fps, ≥ −5 % vs reference | 57.6 | 54.7 | −5.0 % | not met (below the reference) |
| – frames over 50 ms | ≤ 0 | 0 | 0 | – | met |
| Pan and zoom at 100 %, dense area | ≥ 50 fps, ≥ −5 % vs reference | 45.7 | 35.8 | −21.7 % | not met (below the reference) |
| – frames over 50 ms | ≤ 0 | 10 | 2 | – | not met |
| Initial render (C-08) | ≤ 1500 ms | 1599 | – | – | not applicable |
| Hover (C-10) | ≤ 100 ms | 135 | – | – | not applicable |
| Marks after a lasso | ≤ 100 ms | 106 | – | – | not applicable |

**Reading.** Expanded, the overview was −10.9 % with 11 frames over 50 ms where slice 2b had none. Collapsed was slower
than expanded at 100 % (35.8 against 50.4 fps) although it draws a third of the elements. Both were diagnosed before any
fix (below).

### After the fixes (10 October, 14:48 and 14:57, at e48050e): met

Łukasz prepared the laptop; both sides were built first with `--prepare-only`.

Expanded, sitting `.data/measure/2026-10-10-14-48`:

| Figure | Bar | slice-02b | This branch | Change | Result |
| --- | --- | --- | --- | --- | --- |
| Pan and zoom at the overview | ≥ 50 fps, ≥ −5 % vs reference | 58.9 | 59.7 | +1.4 % | met |
| – frames over 50 ms | ≤ 0 | 0 | 0 | – | met |
| Pan and zoom at 100 %, dense area | ≥ 50 fps, ≥ −5 % vs reference | 49.6 | 52.0 | +4.8 % | met |
| – frames over 50 ms | ≤ 0 | 9 | 4 | – | not met (slice 2b misses it too) |
| Initial render (C-08), median of 5 | ≤ 1500 ms | 1417 | 1367 | −3.5 % | met |
| Hover to the next frame (C-10), median of 40 | ≤ 100 ms | 129 | 135 | +5.0 % | not met (as before) |
| Marks after a lasso, median of 20 | ≤ 100 ms | 103 | 86 | −16.9 % | met |

Collapsed, sitting `.data/measure/2026-10-10-14-57`:

| Figure | Bar | slice-02b | This branch (collapsed) | Change | Result |
| --- | --- | --- | --- | --- | --- |
| Pan and zoom at the overview | ≥ 50 fps, ≥ −5 % vs reference | 60.0 | 60.0 | ±0.0 % | met |
| – frames over 50 ms | ≤ 0 | 0 | 0 | – | met |
| Pan and zoom at 100 %, dense area | ≥ 50 fps, ≥ −5 % vs reference | 52.0 | 60.0 | +15.4 % | met |
| – frames over 50 ms | ≤ 0 | 6 | 0 | – | met |
| Initial render (C-08) | ≤ 1500 ms | 1326 | – | – | not applicable |
| Hover (C-10) | ≤ 100 ms | 130 | – | – | not applicable |
| Marks after a lasso | ≤ 100 ms | 131 | – | – | not applicable |

S2C-12 is **met**: expanded, pan and zoom are not below slice 2b (+1.4 % and +4.8 %, bar: no more than about 10 % below),
with as many or fewer long frames (0 against 0, 4 against 9); collapsed, 100 % is clearly faster than expanded (60.0 fps
and no long frame against 52.0 fps and 4), at the screen's 60 fps.

## Findings of the S2C-12 diagnosis

Done on 10 October before any fix, in the measurement build: Chrome traces of one zoom and one pan segment per mode
(per-frame time split into script, style and layout, paint and GPU), screenshots and element counts of the 100 % view,
and CPU profiles on the dev server for the function names (the production build is minified). The temporary spec was
removed afterwards; its traces, profiles and screenshots are kept in `.data/measure/diag-2c/` (not in the repository).
Traced figures are slower than the rounds' (tracing costs time) and are only compared with each other.

### A render loop with collapsed frames

- **What:** with any frame collapsed the whole canvas re-rendered on every frame, also with nobody touching it: the
  canvas, the rows of the cards drawn, the blocks, the line layer and the Overview's miniature (about 1 s of rendering in
  2 s of idle). At 100 % collapsed spent about 20 ms of script per frame against 8 expanded. Real collapsed frames in the
  data and `DIAG=collapsed` gave the same figures, so the switch was not the cause.
- **Cause:** React Flow measures every node and reports its size through `onNodesChange`. The canvas dropped the blocks'
  changes (a block is drawn from its frame, not stored as a card), but React Flow's `applyNodeChanges` returns a new
  array even when no change is left, so every round set new nodes; the blocks then still looked unmeasured and React
  Flow measured them again on the next frame.
- **Fix** (e48050e, no change in behaviour): no new nodes when nothing is left after the blocks' changes are dropped, and
  block nodes carry their size as `measured`. Traced at 100 %, collapsed: 26 → 54 fps, script 20 → 3.5 ms per frame.
- **Guard:** in development the canvas counts its commits (`window.__imCanvasCommits`, a `useEffect` in
  `ModelCanvas.tsx`, removed from production builds). `S2C-12.spec.ts` collapses two frames and checks that the count does
  not move in 1.5 s of no input, nor while the view is panned and zoomed; it failed before the fix (93, then 182
  commits) and passes after it.

### Wider frame labels cost GPU time when zooming at the overview

- **What:** expanded, zooming at the overview cost about 58 ms of GPU work per frame on this branch against 35 on slice 2b
  (raster flush 11.5 ms against 2.4), with the same script time; the only difference on the page was the new collapse
  button in each of the 8 frame labels (27 elements).
- **What was tried** (CSS injected by the diagnosis spec, alternating runs, overview zoom):

  | Variant | fps | frames over 50 ms | GPU ms per frame |
  | --- | --- | --- | --- |
  | as built | 30–33 | 11–12 | 53–58 |
  | button hidden (`display: none`) | 46–48 | 2–3 | 32–34 |
  | only its icon hidden | 31 | 12 | 54–55 |
  | button `visibility: hidden` (keeps its place) | 31–32 | 11–12 | 54–56 |
  | button `appearance: none` | 29 | 12 | 59–61 |
  | the label's clip removed (`overflow: visible`) | 31–32 | 10 | 53–56 |
  | button hidden, label widened by the same 22 px with a margin | 33–35 | 10 | 50–53 |
  | button positioned outside the label's flow | 46–47 | 2 | 33 |
  | slice 2b, same conditions | 44–45 | 4–5 | 35 |

  So the cost comes with the label being wider, not with the button or its painting. The labels keep their size on the
  screen through `--iz` (×10 at the overview), and a wider label costs Chrome much more raster work on every zoom step;
  **why exactly, inside Chrome, is not known.**
- **Fix** (e48050e): the button sits just left of the label, outside it (`.im-frame > .f-collapse`), the same size and on
  the label's row, so the label keeps its slice 2b width. Traced overview zoom: 30 → 51 fps, 11 → 3–4 long frames. Checked
  on Customer & orders after “Arrange into frames” at 100 % and 40 %: it overlaps no card, frame or label and stays
  clickable; S2C-01 checks it at 25, 40, 100 and 300 %.
- **For later slices:** anything that makes frame labels wider (for example the note count on frames in slice 3) should
  be measured at the overview before it ships.

## The measurement-only switch `DIAG=collapsed`

`?diag=collapsed`, honoured only by the measurement-only production build (AD-31), shows every frame collapsed in that
tab; nothing is saved (as `DIAG=nolines`). With `DIAG=collapsed` in the environment, S1A-14 opens “Performance test” with
it and measures pan and zoom with the 8 blocks; what needs drawn cards is recorded as not applicable instead of failing:
the initial render (C-08, S1A-14), C-10 (S1B-10) and the S2A-14 lasso marks. `measure:canvas -- --branch-diag collapsed`
uses it on this branch's side only, and its summary marks a figure the branch side did not measure as “not applicable”.
Other switches behave as before.

## Manual checklist (Łukasz)

On Customer & orders, signed in as Łukasz (`npm run dev`, http://localhost:3000), after “Arrange into frames by concept
and system”; then as Piotr for S2C-10:

- [ ] **S2C-01** Collapse a source frame by its label button, by a double-click on its name (the first click selects
  it), by its toolbox and by the frame panel; the block shows the kind, the card count, its cards with n/m, “and N more”
  when there are over six, and the chips. Expand by the block's “Expand”, a double-click on its header, the toolbox and
  the panel; nothing else moves; Ctrl+Z undoes one step at a time.
- [ ] **S2C-02** A hidden card cannot be hovered, lassoed or dropped on; pick it in the left panel: its panel shows and
  the view centres on the block; the arrow keys do not move it; a click on its row in the block expands and selects it.
  Select three cards, collapse the frame of one of them: two stay selected.
- [ ] **S2C-03** Drag the block by its header, click it, lasso around it; select it with a card and try group drag,
  arrow keys, Align left, Stack in a column, Line up in a row; its toolbox has “Expand”, no fit, “Select its cards”
  greyed out.
- [ ] **S2C-04** Drag a card onto a block: it is filed at the frame's bottom, the toast names both; an entity of another
  concept onto a concept frame's block asks the concept question. Also from the left panel.
- [ ] **S2C-05** With CRM collapsed: one line per attribute, a single mapping keeps its look and chip and opens its panel;
  with a frame holding two tables that feed the same attribute, one line with a count.
- [ ] **S2C-06** Collapse two frames: one line between them with the count; relationship lines “N relationships”; the
  Mappings / Relationships switch hides the matching bundles.
- [ ] **S2C-07** Click a bundle: the counts by status, the mappings grouped by entity as links, “Expand …” buttons;
  right-click it: the same expands.
- [ ] **S2C-08** “Collapse all”, Ctrl+Z, “Expand all”, Ctrl+Z; with blocks in view: F, a card placed from the left panel,
  “Add the N missing” for a hidden card, the Overview.
- [ ] **S2C-09** Duplicate layout with one frame collapsed: the copy has it collapsed too.
- [ ] **S2C-10** As Piotr: collapse and expand frames, “Collapse all”; reload: the saved state again; bundle panels and
  their links work.

And the definition of done: collapse the source frames on Customer & orders after “Arrange into frames”, read the bundles
and their panels, drop a card on a block, expand everything and undo it.

## Assumptions and decisions

### Step 0 (handlebars, 9 October)

1. **handlebars** is recorded in `docs/known-limitations.md` with its condition (the override to 4.7.10); nothing changed
   in this slice.

### Step 0 answers (Łukasz, 9 October)

2. **Drops use the block's rectangle** for a collapsed frame; its size comes from the prototype's `blockH` (constants in
   `src/domain/model/frames.ts`).
3. **A card joins a collapsed frame only by a drag drop on its block** (from the canvas or the left panel); nudge, align,
   stack, line up, resize, fit widths and placing never put a card into one, and a card already in a collapsed frame
   keeps it.
4. **Filing on a block** puts the card at the frame's x + 32 and bottom − 8, snapped to 8 px; the frame grows to hold it.
5. **“Arrange into frames”** builds its concept and source frames expanded; free frames keep their collapsed state.
6. **The block is a React Flow node of its own kind** (`block:<frameId>`), but the selection key stays `frame:<id>`; a
   collapse or expand is one undo step.

### Step 1 (decided and accepted)

7. **A bundle counts distinct mappings**, not inputs.
8. **A mapping with several inputs** gives one pair of ends per input, so with only some inputs collapsed it can be in
   two bundles (accepted in step 3); each appearance is drawn as that mapping.
9. **Resize and “Fit frame to its content” are refused while collapsed** (“Expand the frame first.”).
10. **A one-mapping bundle of a transform shows its ƒ chip**; no ƒ node is drawn while an end of the mapping is collapsed.
11. **A card dropped on a block from the left panel** is filed like a drop from the canvas; on a concept frame the concept
    question comes first and “Move” is saved in the same change as the drop.

### Recorded by Łukasz for step 2

12. **Collapse and expand were editors-only until item 11** (step 4); since step 4 reviewers and readers collapse in their
    tab only (below).
13. **A double-click on a frame's name** collapses it after the first click has selected the frame, as in the prototype.
14. **A collapsed frame counts as its block** for drops, placement and bounds (prototype `frameAt`, `rectOf`), so a card
    placed next to a block may sit inside the frame's area after expanding without being a member.
15. **(a) Selecting a hidden card centres the view on its block** (PRD item 3; the prototype centres on the card's own
    hidden place). Łukasz's decision.
16. **(b) The arrow keys do not move a single hidden card** selected from a panel (the prototype would move it out of
    sight). Łukasz's decision. Also: collapsing a frame takes its cards out of a selection of several (prototype
    `pruneMulti`); both fixed at the start of step 3.
17. **Nudge keeps slice 2a's behaviour:** a quick burst of arrow presses is one undo step (after 0.4 s still), not one
    step per press as in the prototype. Łukasz's decision.

### Step 3 (accepted)

18. **Expand entries** of the bundle panel and toolbox were left out or disabled for reviewers and readers until item 11;
    since step 4 they work for every role, in the tab only.
19. **“Show what is inside”** is kept in the bundle's toolbox, as in the prototype; it only selects the bundle.
20. **A bundle of one relationship** is drawn as a bundle labelled “1 relationship”, as in the prototype; only a single
    mapping keeps its own look.
21. **A combined mapping with only some inputs collapsed** may appear in two bundles (see 8).

### Step 4 (accepted)

22. **Tab-only collapse for reviewers and readers is an override per frame:** the tab keeps an override only for the
    frames they collapsed or expanded themselves, which wins over the saved state until they leave or reload the canvas;
    every other frame shows the saved state, including an editor's later change once it reaches their page. Unlike slice
    2a's single layer value, which ignores saved changes once the page is open. Nothing is saved or undone.
23. **Toasts for reviewers and readers** are the same collapse toasts, without Undo.
24. **“Collapse all” when nothing would change** only shows the toast; nothing is saved (as in the prototype).
25. **(i) The Entity tool on a block** creates the entity where clicked, as in the prototype; it does not join the
    collapsed frame. Łukasz's decision; the alternative is in `docs/ideas.md`.
26. **(ii) “Add the N missing” started from a card hidden in a collapsed frame** places the new cards beside the block,
    never on it (`besideAnchor`, unit test, S2C-08). Łukasz's decision.
27. **Test ids** of the overview's buttons are `button-frames-collapse-all` and `button-frames-expand-all`
    (`button-collapse-all` is the left panel's “Collapse all groups”).

### Step 5

28. **The collapse button sits just left of the frame's label**, outside it, because a wider label costs GPU time at the
    overview (see the findings); the prototype has it inside the label.
29. **A slow page after an undo:** S2C-01 waits until the page shows each undone state before collapsing again (the
    first set of runs found that a collapse sent right after two quick undos used an old version; the known “page lags
    the data right after an undo” of slice 2a).

## Changes to earlier tests

- **S2B-06** (step 2): the frame's toolbox now also lists “Collapse into one block”.
- **S2B-13** (step 4): a reviewer's frame toolbox now also lists “Collapse into one block” (tab only, item 11).
- **S1A-14, S1B-10, S2A-14** (step 5, measuring specs): under `DIAG=collapsed` S1A-14 opens the canvas with the switch and
  records C-08 as not applicable, S1B-10 records C-10 as not applicable, S2A-14's lasso marks are not applicable;
  without the switch they are unchanged.
