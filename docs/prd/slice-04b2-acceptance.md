# Slice 4b-2 – Acceptance

Status: **step 8: docs closed, two full runs before the merge; waiting for Łukasz's manual acceptance.** Branch `slice/04b2-requirement-cards`, from `main` at the tag `slice-04b1`
(`8133ee8`). PRD: `docs/prd/slice-04b2-requirement-cards.md` (its section 10 holds the answers below).

## Manual acceptance checklist (step 8)

Łukasz's own checks in a real browser, after the PRD's definition of done (section 5: REQ-104's card beside the Sales
cards with its dashed lines; REQ-105 placed from `birth_date`'s panel; REQ-103 dragged onto `email`, the line and the
toast with Undo; REQ-101 dragged onto empty canvas; “Mappings” hides the lines; Focus on Customer keeps the cards linked
to it lit; REQ-102 from the project home lands on the canvas that shows most of it). As Łukasz unless said otherwise,
on a fresh demo seed (`npm run reset-dev-data`):

| # | From | Check | Expected |
| --- | --- | --- | --- |
| 1 | step 5 | Drag a requirement from the left panel onto Customer's `email` row, about 40 px from the row's left edge | The hint says “Link to email” and the drop creates the link. If it fails in a real browser, it is a product bug for this slice. |
| 2 | step 2 | Select REQ-104's card, at 100 % and below 40 % | Its panel opens and its coverage colours show; the card has the violet selection mark. Below 40 % the card is its header and a plain block |
| 3 | step 2 | Ctrl+A, then drag the selection | REQ-104's card moves with the cards; one Undo puts all back |
| 4 | step 2 | Delete on the selected card; then delete REQ-104 in its panel, and Undo | Delete removes the card, not the requirement; deleting the requirement removes its cards on both canvases, Undo brings them back |
| 5 | step 3 | Drag Customer; draw a frame around Sales Order and Order Line and collapse it | Trace lines follow the card; into the collapsed frame they end at the members' rows in the block |
| 6 | step 4 | Customer's panel: “Add the n missing to this canvas”, then a row's “Place card” on a card already placed | The cards stack beside Customer; the icon selects the card already there and brings it into view |
| 7 | step 8 (answer 4) | Draw a frame around Customer, then “Place card” from its panel | The card lands below the frame, never over it |
| 8 | step 4 | Product's panel (from REQ-101's traces; Product is not on “Customer & orders”): “Add to this canvas” | The card appears in the view's upper third, selected; the panel then offers “Remove from this canvas” |
| 9 | step 5 | Drag a requirement over a row, a card, a mapping line, then empty canvas, without dropping | The target is outlined in violet (a line drawn lit); the hint says “Link to …”, “Already linked to …” or “Place card”; nothing else on the canvas changes |
| 10 | step 6 | Focus on Sales Order, then on Customer, then select REQ-104 | REQ-104's card is lit with Sales Order (its scope holds it) and faded with Customer; with REQ-104 selected only its card is lit, with its lines |
| 11 | step 6 | With Focus on, drag a lit card | The lit lines and the holes follow the card |
| 12 | step 7 | As Piotr (reviewer) and Kasia (reader): select a card, Focus on, try to drag a card and a requirement row | Cards and lines show, selection and Focus work; no drag, no “Place card”, “Add all” or “Remove its card” |
| 13 | step 7 | `npm run seed:large`, then open “Performance test – requirements” | 12 requirement cards, none over a frame, with their trace lines |
| 14 | step 8 | Focus on REQ-102 (select its card, then Focus) on “Customer & orders” or the requirements canvas | Its lit trace lines are solid, in violet with their end dots, and still read as trace lines, not mappings; the faded ones under the veil stay dashed |

## Łukasz's answers after the sitting (20 October 2026)

- **The sitting accepted;** every criterion met.
- **1. AD-24:** applied as approved, with his addition: 4b-1's bracket in “Overlay and fading” (“Partly met: pan and
  zoom with Focus on at 30 % lose 22–40 % … T1 applied in 4b-1, T3 in 4b-2 (T2 dropped).”) became “Met in slice 4b-2
  (T1 in 4b-1, T3 in 4b-2, T2 dropped).”, followed by the sitting's figures; the measuring note is in “Measuring”.
- **2. The split of 4b-1's −40 %:** left unmeasured.
- **Then:** the closing docs (`known-limitations.md`: S4B1-11 closed, S4B1-12's fps confirmed, “Where the canvas stands
  after slice 4b-2”) and two full runs in a row before the merge.

**Done:** AD-24 and `known-limitations.md` (`158d198`). **Two full runs in a row before the merge** (`npm run e2e`,
from scratch, no server running), with lint, typecheck and the unit tests (1,024) passing:

| Run | Result | Time |
| --- | --- | --- |
| 1 | 184 passed | 28.5 min |
| 2 | 184 passed | 28.6 min |

S4B2-16 (CI and the runs before the merge): **met** once CI on the PR is green.

## Step 8, part 2: the closing sitting (20 October 2026)

**Every measured criterion is met.** No round was dropped, and one switch failed the settled check.

### How it ran

- **The laptop:** prepared by Łukasz (restarted, 10 min, power adapter, Best performance; Update, OneDrive, iCloud and
  Google Drive paused; Chrome closed; display and sleep Never; the pointer off the windows). Before the warm-up no node
  process, server or Chrome was running, and the tree was clean.
- **The builds** from part 1, used with `--no-build`: this branch at `eea915b` (the sitting ran at `5153047`, which
  changes docs only); `slice-04b1` at `8133ee8` in `../infomapper-ab-main`.
- **The warm-up:** one round with three settled pairs per switch case (`2026-10-20-11-33`, 26 min, not counted).
  Every spec passed on both sides.
- **The sitting:** `npm run measure:canvas -- --to-screen --only s4b2pans,c10,lasso,c08,s4b2focus,s4b2screen,s4b2drag
  --rounds 3 --no-build --against slice-04b1` (`.data/measure/2026-10-20-12-00/`, 83.5 min; raw traces there, not
  committed).
- **The quiet check before every side** passed in each case: 31–38 s to quiet (round 1's reference, the first side:
  104 s, peak 15 %). **No round was dropped or replaced.**

### The criteria

| ID | Result | Figures |
| --- | --- | --- |
| S4B2-01 to S4B2-09 | **met** | the e2e tests (every full run since step 7) |
| S4B2-10 | **met** | presented fps with 12 requirement cards (this branch, “– requirements”) against `slice-04b1` (“100 cards”), median of 3 (min–max): 30 % expanded 54.0 (54.0–55.0) against 54.2, −0.4 %; dense expanded 48.6 (48.6–49.9) against 48.9, −0.6 %; 30 % collapsed 57.5 against 57.7, −0.3 %; dense collapsed 58.8 against 59.0, −0.3 %. Bar ≥ −5 % |
| S4B2-11 | **met** | Focus on against off, presented, this branch, median of 3: 30 % expanded +1.8 % (ent:23) / +2.3 % (REQ-102); 100 % expanded −0.6 % / +1.3 %; 30 % collapsed −1.0 % / −1.4 %; 100 % collapsed −1.1 % / −1.1 %. Bar: within 5 % |
| S4B2-12 | **met** | to the screen, median / p95 / max (ms) below; the largest median 73 ms (selecting REQ-102's card at 100 %), Focus on REQ-102 at 30 % 71 / 94 / 94 |
| S4B2-13 | **met** | presented fps, median (spread): requirement card 11.5 (11.0–11.5) against entity card 9.7 (9.6–9.8) at 100 %; 26.5 (26.1–27.4) against 24.0 (23.5–24.8) at 30 %. The requirement drag lies above the entity drag's spread |
| S4B2-14 | **met** | no requirement cards (“100 cards” on both sides): presented fps 53.7 against 54.2 (−0.9 %), 49.4 against 48.9 (+1.0 %), 58.0 against 57.7 (+0.5 %), 58.9 against 59.0 (−0.2 %). C-10 to the screen 19 / 25 / 25 ms (`slice-04b1` 18 / 43 / 43); the lasso 40 / 50 / 50 ms (39 / 55 / 55). C-08 stable frame 1,350–1,367 ms (`slice-04b1` 1,371–1,418), bar ≤ 1,500: met; last present 1,509 ms median (1,508–1,514; `slice-04b1` 1,552), recorded |
| S4B2-15 | **met** | step 8 part 1's reads (no timing): drawing layers 47 / 30 with 0 and 12 requirement cards and with cards over a frame; every element difference explained; the commit guard in S4B2-06 (every full run) |
| S4B2-16 | **open** | CI and the two full runs in a row before the merge |

### S4B2-12 in detail (this branch, three rounds; median of the rounds' medians / largest p95 / largest max, ms)

| Case | On | Off | Not settled |
| --- | --- | --- | --- |
| Drop target, row, 100 % | 17 / 36 / 36 | 18 / 32 / 32 | 0 |
| Drop target, card, 100 % | 17 / 23 / 23 | 18 / 25 / 25 | 0 |
| Drop target, line, 100 % | 22 / 37 / 37 | 18 / 23 / 23 | 0 |
| Drop target, card, 30 % | 13 / 22 / 22 | 12 / 28 / 28 | 0 |
| Drop target, line, 30 % | 15 / 30 / 30 | 14 / 27 / 27 | 0 |
| Selecting REQ-102's card, 100 % | 73 / 116 / 116 | 68 / 117 / 117 | 0 |
| Selecting REQ-102's card, 30 % | 44 / 116 / 116 | 41 / 59 / 59 | 0 |
| Focus ent:4 (3 cards lit), 30 % | 33 / 48 / 48 | 12 / 16 / 16 | 0 |
| **Focus REQ-102 (46 lit trace lines), 30 %** | **71 / 94 / 94** | 12 / 23 / 23 | **1** (off) |
| Focus ent:4, 100 % | 17 / 21 / 21 | 14 / 22 / 22 | 0 |
| Focus REQ-102, 100 % | 29 / 57 / 57 | 15 / 31 / 31 | 0 |

- **Selecting a requirement card** has the largest p95 (116–117 ms, one switch per round above 100 ms). Its time is
  the main thread (the selection's canvas commit and the panel), as 4b-1's coverage colours. The bar is on the median.
- **Focus on REQ-102 at 30 %:** 71 ms, against 107 ms in part 1's smoke with dashed lit lines (answer 1).
- **The one switch not settled:** Focus REQ-102 at 30 %, “off”, in one round: a raster was still running when it began.

### S4B2-11 against 4b-1's S4B1-11, and the drift

| View | S4B1-11 (4b-1's sitting) | S4B2-11 (now) |
| --- | --- | --- |
| 30 %, expanded | −40 % | +1.8 % (ent:23), +2.3 % (REQ-102) |
| 30 %, collapsed | −22 % | −1.0 %, −1.4 % |
| 100 %, expanded and collapsed | +5 to +15 % | −1.1 to +1.3 % |

- **Two things changed between them:**
  - **T3:** the veil paints into the overlay's layer, so Focus adds one drawing layer instead of two (step 6).
  - **The method:** every pan now starts from the same view.
- **The drift, which affected S4B1-11:** S4P-fading ran each pan with fading on right after the untraced pan, without
  opening the view again, and the 10 s driver ends on a zoom-in. In this sitting the zoom after a pan was 37–40 % (from
  30 %) and 115–134 % (from 100 %). So 4b-1's Focus-on pans at 30 % ran from about 38 % to past 40 %, where cards draw
  their rows, while the Focus-off pans started at 30 %.
- **This sitting cannot say how much of 4b-1's miss each of the two explains.** It would need S4P-fading's old method
  run once more on this build (about 15 min). The note in `known-limitations.md` stays as it is (answer 3 after part 1).
- **Frames over 50 ms** (presented gaps) are the same with Focus on and off: 5–16 per 10 s pan, in every view.

### Proposed AD-24 text (for Łukasz's approval; not applied)

**`docs/decisions.md` AD-24**: at the end of “Overlay and fading”, after “T1 applied in 4b-1, T3 in 4b-2 (T2
dropped).”, add:

> Slice 4b-2's sitting (20 October 2026; three rounds; presented frames and to the screen, traced): pan and zoom with
> Focus on within 2.3 % of off at 30 % and 100 %, frames expanded and collapsed (S4B2-11; 4b-1's −22 to −40 % at 30 %
> had its pans with Focus on start from a view the pan before had zoomed in); Focus switching at most 71 ms to the
> screen with requirement cards lit (the lit trace lines solid: dashed, they cost about 32 ms of raster). Requirement
> cards and their trace lines: pan and zoom within 0.6 % of the same view without them, and no drawing layer more with
> 12 cards (S4B2-10, S4B2-15).

And in “Measuring”, add:

> Each measured pan starts from a freshly opened view: the spike's 10 s driver ends on a zoom-in, so a pan that follows
> another starts zoomed in (slice 4b-2). A drag is driven in the page, one pointer move per frame; Playwright's mouse
> leaves the display compositor drawing about 2 frames a second (slice 4b-2).

**`docs/known-limitations.md`** (in step 8's closing, no approval needed): S4B1-11 closed with the figures above, S4B1-12's
fps confirmed (S4B2-14), and a new “Where the canvas stands after slice 4b-2” above 4b-1's.

## Łukasz's answers after step 8, part 1 (20 October 2026)

- **Part 1 accepted.**
- **1. Lit trace lines solid under Focus:** applied (`canvas.css`: `.lit-lines .trace` without dashes; violet, with the
  end dot at 40 % and above, as every trace line). The faded ones under the veil stay dashed. **A deliberate
  difference from the prototype**, whose trace lines are always dashed. Check 14 in the manual checklist. One full run,
  this branch's measurement build again (`slice-04b1`'s stays), and one smoke of Focus on REQ-102 at 30 %.
- **2. D-34:** applied as approved.
- **3. The S4B1-11 artefact:** a note only (`known-limitations.md`, as in part 1).
- **Then** stop and say when the laptop needs preparing.

**Done** (20 October 2026):
- **One full run** (`npm run e2e`, from scratch, no server running): **184 passed, 30.9 min.** Lint, typecheck and the
  unit tests pass.
- **This branch's measurement build again** at `eea915b`; `slice-04b1`'s build (`8133ee8`) kept.
- **The smoke** (no preparation, diagnostic; step 8's diagnosis spec, two rounds): **Focus on REQ-102 at 30 %, as built
  now: 76.3 ms to the screen in both rounds** (p95 93; raster 58 ms), against 107 ms before. The spec's other variants
  (lit lines hidden, all trace lines hidden) give 75–90 ms in the same run, so the solid lines cost nothing measurable.

## Step 8, part 1: S0-10, placement clear of frames, measuring specs, reads, docs (20 October 2026)

### What changed

| Part | Change |
| --- | --- |
| S0-10 (answer 1) | The restart gets its own build folder (`.next-e2e-restart-2`, both removed before and after; `tsconfig.json` lists it as the others). The servers' output goes to `.data/e2e-runs/S0-10-server-<n>.log`, and a server that exits before it answers fails the wait at once, with its log's last lines. **Three runs of S0-10 alone passed in 70, 66 and 72 s** |
| Item 15, frames (answer 4) | `requirementCardSpots` takes the expanded frames' rectangles (their name strip included) and keeps them clear like cards and notes. “Place card” and “Add all” never put a card over a frame; an element inside a frame gets its cards below the frame. **A deliberate difference from the prototype**, which ignores frames. The demo canvas has no frames, so nothing moves there |
| `seed:large` (answer 4) | Placed by the changed rule. ent:3's frame (f5) reaches below the 30 % view, so REQ-102 is placed by ent:4 instead, REQ-107 is about ent:19, and REQ-112 goes to that view's top centre. Still 12 cards and 126 trace lines: **30 % view 9 cards and 102 lines, dense view 3 cards and 24 lines**, none over a frame |
| Measuring specs | `e2e/slice-04b2/S4B2-10.spec.ts` (pans with and without requirement cards, both sides; also S4B2-14's pans), `S4B2-11` (pans with Focus on), `S4B2-12` (to the screen: the drop target, selecting a card, Focus with cards lit), `S4B2-13` (dragging a requirement card against an entity card), `S4B2-15-layers` (the reads); `measure.ts` shares their steps. `measure:canvas` gets `s4b2pans`, `s4b2focus`, `s4b2screen` and `s4b2drag`, with their figures and tables. They run only in the measurement build (`playwright.config.ts`) |
| Docs | `known-limitations.md` (requirement cards closed; the lit-lines fix; a caveat on S4B1-11's 30 % figures, below), `ideas.md` (two ideas resolved; what the prototype's requirement cards have besides), README (status, the sitting's commands), `CLAUDE.md` (the e2e rule, slice 4b-2's helpers and commands) |

**Item 23's fallback (answer 3):** kept in the code as a safeguard; the page cannot reach it (step 7's note).

### Tests

| Test | What |
| --- | --- |
| `e2e/slice-04b2/S4B2-04.spec.ts` (a second test) | a frame around Customer; REQ-101's “Place card” puts the card at x = 832 (beside Customer), below the frame and its 20 px, in no frame |
| `src/domain/model/requirement-placement.test.ts` | a frame kept clear: an element in a frame gets its card below it |
| `e2e/slice-00/S0-10.spec.ts` (changed) | the fix above |

### The smoke runs (no laptop preparation; figures not counted)

All on the measurement build of this branch, traced (`TO_SCREEN=1`), once each (`.data/measure/s4b2-step8-smoke/`).

**S4B2-10** (4.3 min): every case measured on both canvases. Presented fps, “– requirements” / “100 cards”: 30 %
expanded 49.3 / 50.3, dense expanded 45.8 / 44.3, 30 % collapsed 57.0 / 56.7, dense collapsed 58.9 / 58.9.

**S4B2-11** (6.8 min), **after a fix to the method:**
- **The first smoke ran each traced pan right after the untraced one,** as S4P-fading does for its pans with fading on.
  The spike's 10 s driver ends on a zoom-in segment: the zoom after one pan was 37 % (from 30 %) and 114–133 % (from
  100 %). So the second pan started there, and at 30 % it crossed 40 %, where cards draw their rows. Focus off gave 29.9
  presented fps, against 49.3 for the same view in S4B2-10.
- **Now each pan starts from the same view** (the page opened again, Focus switched on again). Presented fps:

| View | Off | Focus ent:23 | Focus REQ-102 |
| --- | --- | --- | --- |
| 30 %, expanded | 49.5 | 46.6 (−5.9 %) | 44.6 (−9.9 %) |
| 100 %, expanded | 40.4 | 40.6 | 40.6 |
| 30 %, collapsed | 55.1 | 52.5 (−4.7 %) | 53.2 (−3.4 %) |
| 100 %, collapsed | 54.2 | 53.6 | 54.1 |

- **What it means for 4b-1:** S4B1-11's “−40 % expanded, −22 % collapsed” at 30 % compared a pan with Focus on from
  about 37 % with a pan with Focus off from 30 %. Part of it is likely that drift, not Focus (noted in
  `known-limitations.md`). S4P-fading itself is not changed: it is not in this sitting.

**S4B2-12** (5.6 min), to the screen, median / p95 (ms):

| Case | 100 % | 30 % |
| --- | --- | --- |
| Drop target: row | 19 / 40 | – (no rows below 40 %) |
| Drop target: card | 18 / 22 | 14 / 24 |
| Drop target: line | 24 / 31 (second smoke, see below) | 15 / 31 |
| Selecting REQ-102's card | 79 / 118 (main thread 77) | 46 / 65 |
| Focus ent:4 (3 cards lit) | 24 / 45 | 41 / 55 |
| **Focus REQ-102 (46 lit trace lines)** | 55 / 80 | **107 / 122** |

- **Focus on REQ-102 at 30 % misses 100 ms in the smoke.** It is GPU raster (89 ms); the main thread takes 12 ms. A
  diagnosis (`.data/measure/s4b2-step8-diag/`, two rounds, the styles put in by the test):

| Lit trace lines | To the screen, median (round 1 / 2) | Raster |
| --- | --- | --- |
| as built (dashed) | 107.6 / 106.7 ms | 91 / 90 ms |
| hidden | 75.6 / 74.9 | 58 / 57 |
| **drawn solid** | **76.5 / 76.2** | **59 / 58** |
| all trace lines hidden | 74.9 / 75.2 | 58 / 58 |

  **The dashes are the cost.** Rastering 46 long dashed lines over the visible tiles of the overlay's 543 Mpx layer
  costs about 32 ms; drawn solid they cost about 1 ms. Question 1 below.
- **The line target at 100 %:** around ent:23 the middle of every mapping line in view lay under a card. The spec now
  tries more points along each line (a measuring change only). A second smoke of the whole spec found one: 24 / 31 ms.
  Its other figures moved by up to 15 ms either way (the laptop was not prepared); Focus on REQ-102 at 30 % was 111 / 165
  ms there.
- **Selecting a requirement card at 100 %** is main-thread time (the selection's canvas commit and the panel, as
  4b-1's S4B1-09): median 79, p95 118 ms.

**S4B2-13** (1.8 min), **after a fix to the method:**
- **Playwright's mouse broke the presented frames.** Each move is one CDP round trip, and it left the display compositor
  drawing about 2 frames a second (54 begin-frames in 7 s, against 573 in a pan) while the page ran its frames. Those
  presented frames meant nothing.
- **The drag is now driven in the page,** one pointer and mouse move per frame, like the pan driver. The spec checks that
  each card really moved.
- **Untraced rAF fps:** requirement card 24.5, entity card 19.5 at 100 %; 48.6 and 40.7 at 30 %.
- **Traced presented fps:** 10.4 and 9.0 at 100 %; 23.5 and 20.8 at 30 %. The drag is main-thread bound, so it presents
  fewer frames than rAF counts, for both cards alike.

### S4B2-15: the reads (no timing; `.data/measure/s4b2-step8-layers/`)

Drawing layers / drawing megapixels / elements in the viewport:

| Canvas, side | 30 % expanded | 100 % dense expanded | 30 % collapsed | 100 % dense collapsed |
| --- | --- | --- | --- | --- |
| “100 cards”, `slice-04b1` | 47 / 69.2 / 4,507 | 47 / 68.4 / 19,304 | 30 / 48.9 / 1,464 | 30 / 48.2 / 4,906 |
| “100 cards”, this branch | 47 / 69.2 / 4,508 | 47 / 68.4 / 19,305 | 30 / 48.9 / 1,465 | 30 / 48.2 / 4,907 |
| “– requirements” (12 cards) | 47 / 69.2 / 4,730 | 47 / 68.4 / 19,689 | 30 / 48.9 / 1,687 | 30 / 48.2 / 5,291 |
| REQ-102's card moved over f4 (worst case) | 47 / 69.2 / 4,730 | | | |
| all nine cards of the view over f4 | 47 / 69.2 / 4,730 | | | |

- **Drawing layers do not grow with requirement cards** (AD-24 rule 4): 47 and 30, with 0 and with 12 cards.
- **“100 cards” is `slice-04b1`'s plus one element in every view:** the line layer's group for trace lines
  (`LineLayer.tsx`), there even when empty. One element, not one per card.
- **What the 12 cards add, explained exactly:**
  - below 40 %: 222 = 12 cards × 8 elements + 126 trace paths (no end dots);
  - at 100 %: 384 = 12 × 11 + 126 paths + 126 end dots.
  - All 12 cards and lines are counted in every view, because React Flow keeps every node in the page.
- **Cards laid over a frame by hand add no layer here:** with one card, and with nine cards, over frame f4 at 30 %, the
  read stays at 47 layers. Step 2's +6 came from cards laid in a grid over other cards as well as frames. Over a frame's
  body alone, Chrome squashes them into a layer it already has.

### Two full runs and the builds

No dev server, Playwright or measurement server running; each run from scratch (`npm run e2e`), in a row (answer
after step 7):

| Run | Result | Time |
| --- | --- | --- |
| 1 | 184 passed | 30.5 min |
| 2 | 184 passed | 30.2 min |

- **184** is step 7's 183 plus S4B2-04's frame test. S0-10 passed in both.
- Lint, typecheck and the unit tests (1,024 in 77 files) pass.
- **The two measurement builds** (`npm run measure:canvas -- --prepare-only --against slice-04b1`): this branch at
  `42d5b50`, and `slice-04b1` (`8133ee8`) in `../infomapper-ab-main`, 3.4 min together. The sitting uses them with
  `--no-build`. If question 1's change is applied, this branch's build is made again (and one full run).

### Proposed text (for Łukasz's approval; not applied)

**`docs/decisions.md` D-34**: in “Each row's “Place card” places the requirement's card next to the element, or shows its
card when it is on the canvas”, after “next to the element”:

> … places the requirement's card next to the element (below its frame when the element is in one: a placed card never
> lies over a frame), or shows its card when it is on the canvas; …

D-41 needs no change.

## Łukasz's answers after step 7 (20 October 2026)

- **Step 7 accepted.**
- **A new rule for e2e runs, from now on** (also in `CLAUDE.md`): after each step one full run; if a test fails, that
  file three times on its own, to tell a flake from a bug. Before the merge: two full runs in a row.
- **1. S0-10:** the proposed fix, applied at the start of step 8.
- **2. The sitting plan:** approved, with 4.
- **3. Item 23's fallback:** kept in the code as a safeguard. **The page cannot reach it:** a requirement is listed only
  when some project canvas scores above zero, and then that canvas opens.
- **4. Placement over frames:** item 15's free-place search treats frame rectangles as occupied, like cards and notes,
  so “Place card” and “Add all” never put a requirement card over a frame. A deliberate difference from the prototype.
  `seed:large` places its cards by the changed rule. S4B2-15 still reads the layers of a card dragged over a frame by
  hand, as the worst case (a read only). D-34 or D-41 wording proposed if either needs it, not applied until approved.
- **Step 8, part 1:** the S0-10 fix, item 4, the measuring specs with their smoke runs, the LayerTree reads, the docs
  (except AD-24's figures), the manual checklist, two full e2e runs in a row, then the two measurement builds; stop when
  the laptop needs preparing.
- **After the merge (not now):** an estimate for running the e2e suite in parallel (several workers, each with its own
  data file and server): cost, risk, expected time per run.

## Step 7: project home, permissions sweep, `seed:large`'s requirement cards (19 October 2026)

Items 23, 24 and 26, with K. D-32 and AD-24 applied as approved (AD-24's “switched through a store …” stays as the
sentence after the approved one).

### What changed

| Part | Change |
| --- | --- |
| Project home (`stats.ts`, `project-requirements.tsx`) | `projectRequirements` gives each requirement `bestCanvasId` (item 23): per project canvas, the entities and tables of its scope there, plus one for its card; the highest wins, a tie the earlier canvas in the project's order. A click opens it with `?req=`, which selects the requirement (its panel and coverage colours, since 4a and 4b-1). **K:** a requirement whose card lies on one of the project's canvases is listed even when its scope touches none |
| Permissions (item 24) | **No code change.** Every requirement-card action is behind the one `editable` flag (editors only): the requirement panel's “Place its card” and “Remove its card”, the card's menu entry and Delete, dragging the card, the left panel's drag, the element panels' “Place card”, row drag and “Add all”, and “Add to this canvas”. S4B2-09 checks each for a reviewer and a reader |
| `seed:large` (item 26, E) | `seed-large-requirement-cards.ts`: the project's third tab, **“Performance test – requirements”**: copies of “100 cards”' 101 cards, 8 frames and 24 notes (pins and frames moved to the copies), REQ-104 to REQ-112 and **12 requirement cards with 126 trace lines** |

### `seed:large`'s requirement cards

| Requirement | Links (trace lines) | Placed |
| --- | --- | --- |
| REQ-101 (existing) | 6 attributes of ent:19 | beside ent:19 (item 15) |
| REQ-102 (existing) | 46 attributes of ent:3, ent:4, ent:7, ent:19 | beside ent:3 |
| REQ-104 to REQ-109 (new) | 6 to 8 each: ent:3, ent:4, ent:7, ent:19 and their attributes (44 in all) | beside their first link |
| REQ-112 (new) | ent:3, its mapping from `src:29` (m45), `src:29`, three of its columns (6) | beside ent:3 |
| REQ-103 (existing), REQ-110, REQ-111 (new) | the dense view's 4 tables; 10 columns of `src:57`; 6 of `src:1` and 4 of `src:47` (24) | the dense view's top centre (item 13), one third of the view apart |

| View (the sitting's) | Cards | Trace lines | Step 1's bar |
| --- | --- | --- | --- |
| 30 % around ent:23 | 9 | 102 | ≥ 8, ≥ 80 |
| 100 % dense (S1A-14's, around `src:57`) | 3 | 24 | ≥ 2, ≥ 20 |

- **“100 cards” keeps its elements** (S4B2-14 and S4B2-15 compare it with `slice-04b1`): no card there, and the new
  requirements link only what REQ-101 to REQ-103 reach already (ent:3, ent:4, ent:7, ent:19 and the four dense tables;
  m45 is the one mapping between them). Their cards' markers change their numbers, not their elements. The unit test
  checks it.
- **The dense view has no room beside its tables:** their frames abut, so item 15's rule moves a card far down, out of
  the view. Those three cards stand in the free strip above the frames, where “Place its card on this canvas” (item 13)
  puts a card at that view. None lies over a frame or a card there.
- **At 30 %, cards beside ent:3, ent:4, ent:7 and ent:19 lie over frames f4 and f5** (item 15 ignores frames, as the
  prototype): step 2's overlap layers per card are expected there, and S4B2-15 counts them (Łukasz's answer 2 after step 2).
- Checked in the browser: the canvas shows 12 cards and 126 trace lines.

### Assumptions

- **Item 23's fallback (the last opened canvas, else the first) can no longer happen:** a requirement is listed only
  when it scores above zero on some project canvas, and then that canvas opens. The code keeps the fallback for safety;
  no test can reach it through the page. S4A-13's case “after Order lines & products, that one opens” now checks that
  the best canvas wins over the last opened one.
- **The canvas's name** is “Performance test – requirements”, as the PRD says, although the project's other tabs are
  named “100 cards” and “PERF-2”.

### Tests

| Test | What |
| --- | --- |
| `e2e/slice-04b2/S4B2-08.spec.ts` (new) | in “Order management” (“Customer & orders” first): REQ-102 also on Product and `items` opens “Order lines & products” (2 against 1), selected (coverage colours); REQ-103 also on `items`: 1 against 1, the earlier canvas, not the last opened one; with its card on “Order lines & products”: 2 against 1, it opens there with its card's selection mark |
| `e2e/slice-04b2/S4B2-09.spec.ts` (new) | Piotr and Kasia: REQ-104's card and its 4 lines; selecting it (mark, panel without “Place” or “Remove its card”); Focus on it (4 lit lines); Delete, the right-click (no menu opens: nothing to offer) and a drag change nothing; no drag on the left panel's rows; no “Place card”, row drag or “Add all” in Customer's panel; no “Add to this canvas” on Product; the data file unchanged |
| `src/app/_panels/stats.test.ts` | `bestCanvasId`: most shown, ties by project order, a card counts one and lists its requirement (K) |
| `src/data/local/model-store.test.ts` (changed) | the project's three tabs, 12 requirements, `requirement_key_next` 113; the copy's cards, frames and notes, 12 requirement cards in no frame, the new requirements reaching only already-marked cards, 126 links |
| `e2e/slice-04a/S4A-13.spec.ts` (changed) | the last-opened case above (item 23; Q9 foresaw it) |

### S0-10: cause and proposed fix (not applied)

**What fails:** the second start, after the restart. The test waits the full 300 s every time (4b-1 step 7, this
slice's step 6). A slow compile would sometimes finish at 200 or 280 s, not always time out.

**Cause (inferred from Next.js 16's code, not traced):** `next dev` takes an exclusive lockfile in its build folder
(`Lockfile.acquireWithRetriesOrExit`, `node_modules/next/dist/build/lockfile.d.ts`). On Windows a lock that is not
released explicitly is cleaned up by the system “some time after process exit”. S0-10 stops its server with
`taskkill /F`, so no exit handler releases it. The restarted server reuses the same folder (`.next-e2e-restart`),
finds the lock still held, retries a few times and exits. Its output goes nowhere (`stdio: "ignore"`), so the test
cannot see the exit, and it polls the port until 300 s are up.

**Proposed change** (test code only, `e2e/slice-00/S0-10.spec.ts`):
1. **The restart gets a fresh build folder** (`.next-e2e-restart-2`; both removed before and after). The data survive
   in the JSON file, which is what S0-10 checks, and e2e servers have no compile cache to lose (step 4's note in
   `known-limitations.md`).
2. **The server's output goes to a log** (`.data/e2e-runs/S0-10-server-<n>.log`), so a later failure shows its cause.
3. **A server that exits before it answers fails the wait at once,** with the log's last lines, instead of after 300 s.

**Risk:** low. Only S0-10 changes, and it still restarts a real dev server against the same data file. If the cause is
different (a really slow cold start), 1 does not help, but 2 and 3 show it the next time, and nothing hangs longer than
today. Time: about 30 min with three S0-10 runs alone, then the full runs as usual.

### The closing sitting: final plan and time estimate

As step 1's Q8 plan, now with `seed:large`'s cards. Both sides are measurement builds made **before Łukasz's restart**
and used with `--no-build`. One unrecorded warm-up, then three rounds with the sides rotated, a CPU check before every
side, a disturbed round dropped and replaced. Interactions are measured from a settled screen to the GPU present; pans as
presented frames, each with one untraced calibration pan.

| Criterion | Side and canvas | Cases per round | Per round |
| --- | --- | --- | --- |
| S4B2-10 cards and lines in view, Focus off | branch on “– requirements”; `slice-04b1` on “100 cards” (shared with S4B2-14) | 30 % around ent:23 and 100 % dense, expanded and collapsed: 4 traced + 4 untraced pans | 3.5 min |
| S4B2-11 pan with Focus on, after T3 | branch on “– requirements” | 30 % and 100 %, expanded and collapsed × (off, ent:23, REQ-102): 12 traced + 12 untraced | 9 min |
| S4B2-12 to the screen | branch on “– requirements” | the drop highlight (row, card, line), selecting a requirement card, Focus on with cards lit; 100 % and 30 %, expanded; 10 pairs each | 6 min |
| S4B2-13 dragging a card | branch on “– requirements” | a requirement card and an entity card, 100 % and 30 %, traced | 2 min |
| S4B2-14 no regression, no requirement cards | both on “100 cards” | 4 pans traced and untraced; C-10 10 pairs; the lasso 10; C-08 five loads | 6.5 min each |
| Server start and CPU checks | both | | 1.5 min each |

- **Per round:** branch about 28.5 min, `slice-04b1` about 8 min: **about 37 min**.
- **Three rounds** about 1 h 50 min, the warm-up about 12 min: **about 2 h 5 min**, plus about 37 min for each replaced
  round.
- **Before Łukasz's restart (not in the estimate):** the two measurement builds (about 10 min).
- **Before the sitting, without preparation:** S4B2-15's LayerTree and element reads, about 15 min. Without and with
  requirement cards against `slice-04b1`: “100 cards” and “– requirements” at the sitting's views, and the 30 %
  cards over frames (answer 2 after step 2).
- **Step 8 writes the measuring specs first,** in `e2e/slice-04b2/`, as 4b-1 did: S4B2-10 to S4B2-14 on the shared
  to-screen tools. That means the new canvas in `measure:canvas`, the drop-highlight anchor from answer F (a mark before
  each dispatched `dragover`), and the two drags as presented frames. Each gets one smoke run without preparation
  (figures not counted), about 1 h of work and 30 min of smoke runs, before the builds.
- **The 4b-1 side's S4B2-10 figures** come from “100 cards”, so S4B2-10 compares the canvas with cards against the
  same layout without them, as Q8 said.

### Three full runs

No dev server, Playwright or measurement server running; each run from scratch (`npm run e2e`), in a row:

| Run | Result | Time | Playwright's figure |
| --- | --- | --- | --- |
| 1 | 183 passed | 31.1 min | 31.1 min |
| 2 | 183 passed | 29.8 min | 29.7 min |
| 3 | 183 passed | 30.3 min | 30.2 min |

- **183** is step 6's 180 plus S4B2-08 and S4B2-09 (two tests).
- **Three clean runs in a row;** S0-10 passed in each.
- Lint, typecheck and the unit tests (1,023 in 77 files) pass.
- **Changed earlier tests:** `e2e/slice-04a/S4A-13.spec.ts` (item 23), `src/data/local/model-store.test.ts` (the seed).

## Łukasz's answers after step 6 (19 October 2026)

- **Step 6 accepted.**
- **1. S0-10:** run 3's failure accepted as the known flake. It keeps coming back and costs about 5 min each time, and
  the merge needs three clean runs in a row: step 7's report proposes a fix (cause, change, risk), not applied without
  his OK.
- **2. D-32 and AD-24 approved as written:** applied (`docs/decisions.md`), with AD-24's ending “T1 applied in 4b-1, T3
  in 4b-2 (T2 dropped).” AD-24 gets the sitting's figures in step 8.
- **3. The lit-lines fix:** kept; recorded in step 8's `known-limitations.md` update.
- **4. Multi-selections with requirement cards:** kept as built.
- **Then step 7** (project home, permissions sweep, `seed:large`'s requirement cards), with the closing sitting's final
  plan and time estimate.

## Łukasz's answers after step 5 (19 October 2026)

- **Step 5 accepted.**
- **The `email` row's spot** (Playwright's drag got no `dragover` 40 px into it) goes to the manual checklist above as its
  own check.
- **Then step 6** (Focus with requirement cards, items 20–22). D settled first, by his rule: no explanation, or a
  LayerTree read with an overlap layer: T3 dropped; a confirmed reason and a read without one: T3 built as well.

## Łukasz's answers after step 1 (18 October 2026)

- **A, B, C, E, F:** as proposed.
- **G, I, J, K, L, M, N:** as proposed.
- **H: the opposite.** Duplicate layout copies requirement cards too: they are part of the canvas's layout. A deliberate
  difference from the prototype.
- **D:** “the veil without its own layer” is B2, which step 0's layer check refuted (Chrome composites every veil by
  overlap). Before step 6, say what is different now:
  - with a reason to expect another result, check it with a LayerTree read only (no timing, no laptop preparation);
  - without one, or if the read shows an overlap layer: T3 is dropped. Step 6 is then Focus with requirement cards
    only, and S4B2-11 is measured as it is; if it misses, it is partly met and goes to the performance review.
- **Costly or unclear:** the proposals accepted. Where a test means entity and table cards, its selector is narrowed.
  S4B2-13's drags are measured as presented frames on both sides in every round.
- **Then step 2** (the card), stopping after it.

**What D will need before step 6** (noted now, reported then). B2 put the veil in the viewport's big layer, and the
check found Chrome composites it by overlap with the notes', frames' and sticky headers' layers below it. Step 1's
proposal puts it **inside the overlay**, which is already a composited layer (`will-change: transform`) above all of
those. Its own children are what it would overlap. That is a reason to expect another result only if nothing inside
the overlay before the veil has a layer of its own, and 4b-1's step 6 read found the coverage SVG with one (2–8 Mpx)
without a veil. So the read before step 6 first asks why that SVG had a layer; without an answer, T3 is dropped.

## Step 6: Focus with requirement cards, and T3 (19 October 2026)

Items 20–22. **D was the second case:** a confirmed reason and a read without an overlap layer, so T3 is built as well.

### D: why 4b-1's coverage colours had a layer of their own

CDP `LayerTree` with each layer's compositing reasons and the element Chrome names it after, no timing, the measurement
build of step 5's code (`.data/measure/s4b2-step6-d/layers.spec.ts`). “Performance test” around ent:23, frames
expanded. The veil without a layer of its own is step 1's T3, put in by the test (`will-change: auto` on `.fade-veil`),
not by the app.

| View | Case | Drawing layers | Drawing Mpx | Overlay layers (size, Mpx, reason) |
| --- | --- | --- | --- | --- |
| 30 % | Focus off, nothing selected | 38 | 68.9 | none |
| 30 % | REQ-102 selected (coverage), Focus off | 39 | 76.5 | 1,750 × 4,321, 7.6, `WillChangeTransform` (named after the coverage SVG) |
| 30 % | Focus ent:23, veil on its own layer (as in 4b-1) | 40 | 632.9 | veil 24,968 × 21,736, 542.7; above it 5,090 × 4,327, 22.0 (named after the lit lines); both `WillChangeTransform` |
| 30 % | REQ-102 selected and Focus on it, own layer | 40 | 642.2 | veil 542.7; above it 4,438 × 7,055, 31.3; both `WillChangeTransform` |
| 30 % | Focus ent:23, **no layer of its own (T3)** | **39** | **610.9** | **one:** 24,968 × 21,736, 542.7, `WillChangeTransform` |
| 30 % | REQ-102 and Focus on it, T3 | **39** | **610.9** | one, 542.7 |
| 100 % | Focus off | 37 | 65.8 | none |
| 100 % | REQ-102 selected (coverage) | 38 | 73.7 | 1,758 × 4,466, 7.9, `WillChangeTransform` |
| 100 % | Focus ent:23 / REQ-102, own layer | 39 / 39 | 630.5 / 639.8 | veil 542.7 and 22.0 / 31.3 above it |
| 100 % | Focus ent:23 / REQ-102, T3 | **38 / 38** | **608.5 / 608.5** | one, 542.7 |

**The reason, confirmed:**
- **The coverage SVG never had a layer of its own. That layer is the overlay's.** Its reason is `WillChangeTransform`,
  and only the overlay has `will-change` (the SVG has none). Chrome names a layer after the first element it paints. An
  empty overlay paints nothing, so it has no drawing layer (Focus off). With the coverage colours in it, the overlay's
  layer is the size of what they draw (2–8 Mpx), and it carries the SVG's name.
- **The same goes for 4b-1's “22–31 Mpx layer under the lit lines”:** it is the overlay's own layer again. The veil had
  a layer of its own, and what the overlay paints after it (the lit lines, rows and marks) must lie above that layer. So
  the overlay's content after the veil became a second layer, for the overlay's own reason, not by overlap.
- **What differs from B2:** B2's veil sat in the viewport's big layer, below the composited notes, frames and sticky
  headers, and Chrome gave it a layer because it overlapped them. Inside the overlay the veil is painted first, and
  nothing composited lies below it there. So without `will-change` it paints into the overlay's layer.
- **The read shows no `Overlap` reason in any case:** with T3 the veil, the lit lines and the coverage colours are one
  layer, the overlay's: **one drawing layer for Focus instead of two, 22–31 Mpx less.**

### What changed

| Part | Change |
| --- | --- |
| Domain (`lit.ts`) | `litRequirements`: the requirement cards that stay lit (C, prototype `reqActive`): the focused requirement's; otherwise those whose scope contains the focused element itself (`scopeContains`: an entity, table, attribute or column in it; a mapping in it or its attribute; a relationship with either entity in it; for several items any of their entities or tables, and the requirements among them). The mapping or relationship is looked up once per Focus, not per requirement. `mergeLit`; `Lit.requirements` |
| Focus target (`Focus.tsx`, `fade.ts`) | a multi-selection's requirement cards (`req:` keys) join the `several` target as `requirements`; its key ends `\|<requirement ids>` |
| Lit set (`fade-canvas.tsx`) | `useLit` adds the lit requirements (from the canvas's requirement index), and for a multi-selection lights its requirements' scopes too (prototype `relatedOf` “multi”); `litNodeIds` includes the lit requirement cards' nodes; `litTraces`: a trace line is lit when its requirement card is and its element is (an entity's or table's card, hidden in a collapsed frame too; a row's card; a mapping) |
| Veil (`FadeLayer.tsx`) | a hole at each lit requirement card (8 px corners); the lit trace lines go to `LitLines` |
| `LineLayer.tsx` | `traceSegments`: step 3's trace geometry as one function, used by the line layer and by `LitLines`, which draws the lit trace lines above the veil (`lit-trace`) |
| **T3** (`canvas.css`) | `.fade-veil` loses `will-change: transform`: it paints into the overlay's layer |
| **Fix** (`LineLayer.tsx`) | Focus's lit relationship, mapping and bundle lines now carry the same signature as the line layer's. Before, their copies were memoised on an empty signature and **kept their old place after a drag** while the holes followed (a 4b-1 bug, found in the browser while checking this step) |
| `CLAUDE.md` | the overlay note: the veil without a layer of its own; requirement cards' holes and lit trace lines |

### The LayerTree read after T3

The measurement build of this step (`.data/measure/s4b2-step6-d/after.spec.ts`). “Performance test” around ent:23, with
REQ-101's and REQ-102's cards placed right of ent:23 for the read (diagnosis data; 52 trace lines in view, REQ-102's 46
of them lit when it is focused):

| View | Focus off | Focus ent:23 | REQ-102 selected, Focus on it | Lit cards (ent:23 / REQ-102) |
| --- | --- | --- | --- | --- |
| 30 %, expanded | 38 / 68.9 Mpx | **39** / 610.9 | **39** / 610.9 | 10 / 30 |
| 100 %, expanded | 37 / 65.8 | **38** / 608.5 | **38** / 608.5 | 10 / 30 |
| 30 %, collapsed | 21 / 48.5 | **22** / 586.0 | **22** / 586.0 | 4 / 13 |
| 100 %, collapsed | 20 / 46.3 | **21** / 584.5 | **21** / 584.5 | 4 / 13 |

- **Focus adds exactly one drawing layer everywhere** (before T3: two), the overlay's, the veil's size.
- **The 46 lit trace lines add no layer:** they paint into the overlay's layer with the veil.
- The requirement cards themselves change nothing with Focus off (38 and 37, as without them in the read before).

### Focus switching and C-10 with Focus on, to the screen (diagnosis)

Step 1's D asked for this with T3: the overlay's layer is now the veil's size, so switching and a hover repaint parts of
a larger layer. Same build, same sitting, T3 against the veil on its own layer again (put back by the test), in turns; 10
settled pairs each, traced (`.data/measure/s4b2-step6-d/screen.spec.ts`). **No laptop preparation: diagnostic figures**,
not S4B2-12's.

| Case | T3: on (median / p95 / max) | Own layer: on | T3: off | Own layer: off |
| --- | --- | --- | --- | --- |
| Focus ent:23, 100 % | 24.3 / 43.5 / 43.5 ms | 24.9 / 30.6 / 30.6 | 15.9 | 16.0 |
| Focus REQ-102, 100 % | 40.7 / 58.0 / 58.0 | 39.4 / 45.4 / 45.4 | 15.4 | 15.3 |
| Focus ent:23, 30 % | **36.2** / 49.9 / 49.9 | 44.1 / 62.9 / 62.9 | 12.3 | 13.6 |
| Focus REQ-102, 30 % | **73.9** / 88.9 / 88.9 | 85.3 / 106.5 / 106.5 | 12.7 | 12.7 |
| C-10, dense view, Focus on ent:23 | 21.7 / 25.5 / 25.5 | 20.2 / 26.5 / 26.5 | 18.9 | 17.5 |
| C-10, dense view, Focus off (reference) | 19.9 / 21.3 / 21.3 | | 15.8 | |

- **Every switch is under 100 ms** (the bar), p95 and max included; no stop.
- **At 30 % T3 switches faster** (raster 18.8 against 25.8 ms for ent:23, 57.9 against 66.8 ms for REQ-102): one layer
  to raster instead of two. At 100 % the two are the same within the noise.
- **A hover with Focus on costs about 1.5 ms more with T3** (raster 3.7 against 1.9 ms): it repaints a small part of the
  overlay's larger layer. C-10 stays about 20 ms.
- The pan with Focus on is S4B2-11, in the closing sitting.

### Assumptions

- **A multi-selection with requirement cards** lights those requirements' cards and their scopes (prototype `relatedOf`
  “multi”). A selection of requirement cards only is a Focus target now (before, Focus faded nothing for it).
- **A trace line to a row** is lit when the row's card is lit (a row has no lit state of its own under Focus).
- **REQ-102's 30 % switching at 74 ms** is the heaviest case here; with the laptop prepared it should come lower, but
  the margin to 100 ms is the smallest. S4B2-12 measures it properly.

### Tests

| Test | What |
| --- | --- |
| `e2e/slice-04b2/S4B2-07.spec.ts` (new) | REQ-101 (Customer) and REQ-105 (Customer's attributes) placed beside REQ-104, REQ-104 also linked to `customers`. Focus on Customer: REQ-101 and REQ-105 have holes in the veil and their 1 + 4 lines lit; REQ-104 faded, although Focus lights `customers` (C). Focus moves to Sales Order: REQ-104 lit with its four attribute lines, its line to `customers` faded; the others faded. After dragging Sales Order every lit line and trace line lies where the line layer draws it (the fix). Focus on REQ-104 (from the Requirements tab; the Overview covers its card at this view): only its card, all five lines lit. Focus off: no veil, no lit copy |
| `src/domain/model/lit.test.ts` | `litRequirements` per target (requirement, entity against a neighbour, table, attribute, column, mapping by itself and by its attribute, relationship, several with requirements, only the given cards), `scopeContains`, `mergeLit` |
| `src/canvas/focus.test.ts`, `fade-canvas.test.ts` | the `several` target with requirement cards and its key; lit requirement nodes and their holes; `litTraces` (card, row, hidden card, mapping, faded requirement, missing card) |

No earlier test changed in this step. Before the full runs: S4B2-03, S4B2-07, slice 4b-1's tests and S4P-12 passed (17).

### Three full runs

No dev server, Playwright or measurement server running; each run from scratch (`npm run e2e`), in a row, after the
diagnosis above (no restart since step 5's runs):

| Run | Result | Time | Playwright's figure |
| --- | --- | --- | --- |
| 1 | 180 passed | 29.7 min | 29.7 min |
| 2 | 180 passed | 30.0 min | 29.9 min |
| 3 | 179 passed, **1 failed: S0-10** | 32.6 min | 32.5 min |

- **Run 3's failure is S0-10** (slice 0): “Server did not start within 300 s”, its own restarted dev server on port 3201
  did not come up in time. It is the cold-start flake 4b-1 had in its step 7 run 3, accepted there by Łukasz. No step 6
  file is on its path, and it passed in runs 1 and 2. Not changed. Without its 5 min wait, run 3 is about as long as
  the others.
- **180** is step 5's 179 plus S4B2-07.
- **About 1.5 min faster than step 5's** (31.1–31.3 min) with one test more.
- Lint, typecheck and the unit tests (1,022 in 77 files) pass.

### Proposed texts (for Łukasz's approval; not applied)

**`docs/decisions.md` D-32**, its last bracket “(Requirement cards with dashed trace lines: slice 4b-2.)” replaced by:

> Requirement cards (D-41) draw a dashed line with an end dot to each element their requirement is linked to on the
> canvas: an entity's or table's card at its header, an attribute's or column's row, a mapping's middle; into a collapsed
> frame, the member's row in its block. The lines show in “Everything” and are hidden in “Mappings” and “Relationships”;
> they dim with the other lines on a selection, never on a hover. A requirement dragged from the left panel onto a row, a
> card or a mapping line is linked to it at once, with Undo; onto empty canvas it places its card. Under Focus a
> requirement card stays lit when its requirement is the target or its scope contains the focused element itself, and a
> trace line when both its ends are lit. (Changed in slice 4b-2.)

**`docs/decisions.md` AD-24, “Overlay and fading”**: the code now differs from its sentence “Fading (Focus) is one veil
with holes at the lit cards, blocks and pinned notes, as one SVG path on a compositing layer of its own in the overlay
(F4)”. Replacement:

> Fading (Focus) is one veil with holes at the lit cards, blocks, pinned notes and requirement cards, as one SVG path in
> the overlay (F4), painted into the overlay's layer with the lit lines, trace lines and rows: inside the overlay nothing
> composited lies below it, so it needs no layer of its own and gets none by overlap (T3, slice 4b-2: Focus adds one
> drawing layer instead of two).

and its end “T1 applied in 4b-1, T2 and T3 with slice 4b-2.” becomes “T1 applied in 4b-1, T3 in 4b-2 (T2 dropped).”
The sitting's figures follow in step 8, as planned.

## Step 5: dragging a requirement from the left panel (19 October 2026)

Items 17–19. The laptop was restarted before this step (booted 07:33).

### What changed

| Part | Change |
| --- | --- |
| `requirement-drop.ts` (new) | `dropTargetAt`: under the pointer an attribute or column row of an entity or table card (rows are drawn at 40 % and above), else a mapping line (its hit path; a bundle of several is no target), else an entity or table card, else a place (empty canvas, a collapsed frame's block, a note, a requirement card). `isLinkedTo` (direct, live links), `dropHint`, `DROP_TOAST`, `sameDropTarget`; `requirementDrag` holds the dragged requirement (a `dragover` sees only the drag's types) |
| `RequirementDrop.tsx` (new) | `DropTargetMark` in the overlay: the row or the card outlined in violet from data (dashed when already linked), a mapping line drawn again lit (`LitLines`); `DropHint`, portalled to the body, its text from the store and its position set on its element from each `dragover` |
| `ModelCanvas.tsx` | the drop store (written only when the target changes), `onDragOver` / `onDragLeave` / `onDrop` for `REQ_DRAG_TYPE`, cleared on `dragend` and `drop`; the drop: a link (`linkRequirement`, toast “Linked {key} to {name}.” with Undo), “{key} is already linked to {name}.” with nothing written, or the card placed at the drop (“Placed {key} on this canvas. Dashed lines show what it traces to.”, selected) or moved there (“Moved {key}'s card.”, M) |
| Left panel | requirement rows are draggable for editors, with the prototype's tooltip |
| Canvas page | passes `linkRequirementAction` |

A mapping's name in the hint and the toast is the requirement panel's: “customers.first_name → Customer.first_name”.

### Assumptions

- **Only editors drag** (`canvas.edit_items` and `requirement.edit` are both editors' rights, AD-05); reviewers and
  readers get no drag (item 24's sweep is step 7).
- **A link doesn't select anything;** a placed or moved card selects its requirement (item 19).
- **On a live canvas** a drop links as anywhere (a requirement link is not labeled, D-26) and a placed card is layout (G).

### Tests

| Test | What |
| --- | --- |
| `e2e/slice-04b2/S4B2-06.spec.ts` (new) | onto Customer's `first_name` row: hint “Link to first_name”, the row outlined, the link, the toast's Undo removes it; onto `email` (REQ-103 is linked): “Already linked to email”, nothing written; onto `customers.email_addr`, Sales Order's and `order_header`'s headers and a mapping line (lit while over it): the links; S4B2-15's guard, no canvas or miniature commit while dragging over a card, a row and a line; empty canvas: “Place card”, the card, selected; on its own card: “Move card”, moved; onto a collapsed frame's block: “Place card”, the card in no frame |
| `src/canvas/requirement-drop.test.ts` (new) | the hit test on stand-in elements (row, card, mapping, place, move, unknown card), hints, toasts, the store's equality, live links only |

**What the test found about Playwright's drag** (no product change):
- **`dragover` arrives only now and then.** In Playwright's emulated native drag, Chromium delivers `dragover` for
  some of the mouse moves only (5 of 20 on one path), and never while the mouse rests; a real browser sends one about
  every 50 ms. So the test nudges the mouse by a pixel at each target until one lands there (`nudgeTo`), then checks
  the hint.
- **One spot got none at all:** 40 px into Customer's `email` row. The row's middle works, so the tests aim there.
  Whether a real drag over that spot behaves differently I can't tell from the emulation: worth a look in the manual
  check.
- **The commit guard waits for the page to settle first.** The previous link's fresh page committed the canvas three
  times during the first try; with the counters still for a second beforehand, the drag itself commits nothing.

No earlier test changed in this step.

### Three full runs, and what the restart did

No dev server, Playwright or measurement server running; each run from scratch (`npm run e2e`), in a row, after the
restart:

| Run | Result | Time | Inside the tests |
| --- | --- | --- | --- |
| 1 | 179 passed | 31.3 min | 30.0 min |
| 2 | 179 passed | 31.1 min | 29.5 min |
| 3 | 179 passed | 31.3 min | 29.8 min |

Lint, typecheck and the unit tests (1,010 in 77 files) pass. 179 is step 4's 178 plus S4B2-06.

| Against | Total | Inside the tests | Reading |
| --- | --- | --- | --- |
| step 4 (18 Oct, before the restart; 178 tests) | 34.6–34.9 min | 32.8–33.0 min | **about 3.5 min (10 %) faster** with one test more |
| 4b-1 (17 Oct; 173 tests) | 26.8–27.6 min | – | still **about 3.5–4.5 min slower**; this slice's six tests take 1.3 min of it, so about 2.5 min (9 %) is left unexplained |

- **The restart helped,** by about the same amount on every file (per file the differences against step 4 are all
  within a few seconds; nothing stands out).
- **The rest is not this slice's code** as far as step 3's comparison could tell (`slice-04b1`'s own suite took 33.8
  min on 18 October). A `slice-04b1` run now, after the restart, would say whether 27 min comes back; I have not run it
  (no extra run, your answer 4).

## Łukasz's answers after step 4 (19 October 2026)

- **Step 4 accepted,** with the test fixes (waiting for the saved state is the right way).
- **D-34 approved as written:** applied (`docs/decisions.md`).
- **Before step 5:** Łukasz compacts the session and restarts the laptop. Step 5's three full runs are reported against
  step 4's (34.6–34.9 min) and 4b-1's (about 27 min), to see whether the restart helped.

## Step 4: placing from element panels (18 October 2026)

Items 14–16. D-41 and the data-model text applied as approved.

### What changed

| Part | Change |
| --- | --- |
| Requirements section (`requirements-section.tsx`) | for those who may edit: each row (direct and indirect) gets a “Place card” icon and can be dragged (`REQ_CARD_DRAG_TYPE`); under the list “Add all to this canvas”, or “Add the {n} missing to this canvas”, hidden when all are here. A click on the name still opens the requirement's panel. The row carries `data-on-canvas` |
| Canvas (`ModelCanvas.tsx`) | `placeRequirementCardsBeside` (item 15): the element's anchor (prototype `elemAnchor`: its card, or its block in a collapsed frame; an attribute's or column's card from 20 px above its row; a 20 × 40 box around a mapping's middle; none when the element is not here: the view's top centre), then `requirementCardSpots` (step 2) keeping clear of cards, blocks, notes and requirement cards; one change; the view fits the element and the new cards when one is outside it; one card placed is selected; toast “Placed {n} requirement card(s) on this canvas.” `showRequirementCard`: selects a card already here and fits a 630 × 400 box around it (prototype `showReqCard`). A row dropped on the canvas places its card there (top middle 115 px left and 30 px above the drop, on the grid; prototype), or moves it there when it is here (M), and selects it |
| Entity and table panels (item 16) | “Add to this canvas” where “Remove from this canvas” stands, when the card is not on the open canvas: placed with its top middle at the view's centre, a third down (prototype `add-card`), and selected; on a live canvas it asks first, as any add there (D-11) |

### Assumptions

- **Readers and reviewers** get neither the icon, nor the drag, nor “Add all”, nor “Add to this canvas” (item 24; the
  permissions sweep is step 7).
- **The rule moves a card past what is in the way:** “Add all” on Customer placed three cards beside it and the fourth
  below Order Line, the first free place going down (prototype). Checked in the browser.
- **A mapping hidden whole in a collapsed frame** has no line, so its cards go to the view's top centre.

### Tests

| Test | What |
| --- | --- |
| `e2e/slice-04b2/S4B2-04.spec.ts` (new) | at 300 % with Customer at the left edge, birth_date's “Place card” places REQ-105 at (832, row − 20 on the grid), selects it, and the view fits it; on the card already here it selects it and writes nothing; a click on REQ-103's name opens its panel; REQ-101's row dragged onto the canvas places its card at the drop; “Add the 2 missing to this canvas” places REQ-102 and REQ-103 stacked at x = 832, then the button goes |
| `e2e/slice-04b2/S4B2-05.spec.ts` (new) | Product and the table `items` (not on “Customer & orders”) opened from REQ-101's traces: no “Remove from this canvas”, “Add to this canvas” places the card at the view's centre, upper third, selects it, and the panel then offers “Remove” |

**Test fixes found by the full runs** (four attempts; each failure stopped the three and they began again):

| Run | Failure | Cause | Fix |
| --- | --- | --- | --- |
| 1st, run 2 | `S4B2-03` over 60 s | the test takes up to a minute in a loaded run | `S4B2-03` and `S4B2-04` get 120 s |
| 2nd, run 1 | `S4B2-03`: a trace line to a card in the collapsed frame never came (120 s) | **a race in the test:** the three layer choices are saved one after another; the test opened the page again while “Everything” was still queued, so the canvas stayed saved in “Relationships”, where trace lines are hidden | it waits until the data shows `all` before opening the page again |
| 3rd, run 2 | `S3A-09` (slice 3a): Undo enabled where it expected no change | **an older race:** the frame's collapse and expand just before are undo steps saved in the background; on a slow run Undo turned on after the test read “before” | it waits for Undo to be enabled (those two saved) before reading it |
| 4th attempt, run 2 | `S3B-04` (slice 3b): “stale version” instead of the role refusal | **an older race:** with one draft mapping on Customer, `draft` is `used`; the test clicked “In review” and read the mapping's version before that write landed | it waits for the status `review` in the data before reading the version |

None of them is caused by this step's code; S3A-09 and S3B-04 passed in every run so far and fail only when a write
lands late, which today's slow runs (34–36 min) made likely.

**Changed earlier tests:** `e2e/slice-03a/S3A-09.spec.ts`, `e2e/slice-03b/S3B-04.spec.ts` (the two waits above).

### Three full runs

No dev server, Playwright or measurement server running; each run from scratch (`npm run e2e`), in a row:

| Run | Result | Time |
| --- | --- | --- |
| 1 | 178 passed | 34.6 min |
| 2 | 178 passed | 34.9 min |
| 3 | 178 passed | 34.6 min |

Lint, typecheck and the unit tests (1,004 in 76 files) pass. 178 is step 3's 176 plus S4B2-04 and S4B2-05.

### Proposed text (for Łukasz's approval; not applied)

**`docs/decisions.md` D-34**, the closing bracket replaced:

> … Clicking a requirement opens its panel. (Changed in slice 4b-1.) Each row's “Place card” places the requirement's
> card next to the element, or shows its card when it is on the canvas; a row dragged onto the canvas places the card
> where it is dropped; “Add all to this canvas” or “Add the {n} missing to this canvas” under the list. An entity or table
> panel whose card is not on the open canvas offers “Add to this canvas”. (Changed in slice 4b-2.)


## Łukasz's answers after step 3 (18 October 2026)

- **Step 3 accepted.**
- **4.** The e2e timing is the laptop, not the branch: no fix and no extra run.
- **D-41 and the data-model text approved as written:** applied in step 4 (`docs/decisions.md` D-41,
  `docs/data-model-v2.md` under `canvas_item`).
- **Then step 4** (placing from element panels, items 14–16), stopping after it.

## Step 3: trace lines (18 October 2026)

Items 8–12. Before it, answer 4: why the e2e runs grew.

### Why the e2e runs grew from 27 to 32 min (answer 4)

`slice-04b1`'s own suite, run today on the same laptop from the reference worktree (`../infomapper-ab-main`, its
fresh build folder, one run from scratch), took **33.8 min**, against 26.8–27.6 min on 17 October. Step 2's three runs of
this branch took 31.8–32.1 min.

| Run (18 October) | Tests | Total | Inside the tests |
| --- | --- | --- | --- |
| `slice-04b1` | 173 | 33.8 min | 31.6 min |
| this branch, step 2, run 1 / 2 / 3 | 175 | 31.8 / 32.1 / 32.1 min | 30.2 / 30.3 / 30.1 min |

**Per file** (the branch's median of three against `slice-04b1`'s run, seconds):

| File | `slice-04b1` | Branch | Difference |
| --- | --- | --- | --- |
| `slice-04b2/S4B2-02` (new) | – | 21.8 | +21.8 |
| `slice-04b2/S4B2-01` (new) | – | 7.5 | +7.5 |
| `slice-03a/S3A-09` | 13.4 | 18.7 | +5.3 |
| `slice-04b1/S4B1-06` | 16.7 | 19.7 | +3.0 |
| `slice-03a/S3A-04` | 6.4 | 8.9 | +2.5 |
| `slice-02a/S2A-14-pan-zoom` | 42.6 | 45.0 | +2.4 |
| `slice-02c/S2C-01` | 29.8 | 32.1 | +2.3 |
| `slice-02c/S2C-07` | 14.4 | 16.6 | +2.2 |
| `slice-02a/S2A-10` | 12.4 | 14.6 | +2.2 |
| `slice-03a/S3A-13` | 32.2 | 34.1 | +1.9 |
| … the most shrunk: `slice-01a/S1A-14` | 60.0 | 47.4 | −12.6 |
| `slice-00/S0-10`, `slice-04a/S4A-11`, `S0-04`, `S0-05`, `S4B1-05` | | | −6.3 to −6.8 each |

**Reading:**
- **Not the branch.** On the same day the branch spends 1.4 min less inside its tests than `slice-04b1`, the two new
  tests (29 s) included. The ten files that grew most, after the two new ones, grew by 2–5 s each, while as many shrank
  by 6–13 s: the noise of one run against three.
- **So not REQ-104's card, not the requirement index, not renders.** A cost there would show on the demo canvas's
  tests (S2A-*, S3A-*, S4A-*), and those moved both ways.
- **It is the laptop today:** the same code ran 6–7 min slower than on 17 October. I don't know why (background load,
  power mode, a Chrome update since); I did not change anything to find out.
- **Proposal:** no fix. If you want the reason, a restart and one `slice-04b1` run afterwards (about 30 min) would show
  whether it comes back to 27 min. Each step keeps reporting its three runs' times.

### What changed

| Part | Change |
| --- | --- |
| `trace-data.ts` (new) | `buildTraces`: per requirement card on the canvas, one line per direct link to an element that is here: an entity or table (its card), an attribute or column (its row of its card), a mapping (its line); none to an element off the canvas |
| `line-geometry.ts` | `traceGeom`, from data (AD-24 rule 2): the nearer side of the element's card, at the header's middle or the row's height (a hidden row: the header, as mapping lines); a mapping's middle (`MapGeom.mid`: its curve's middle, or the ƒ node of a combined mapping); a card in a collapsed frame: its member row in the block, past the sixth the “and N more” row (`blockRowY`). It starts at the requirement card's point nearest to that end. A mapping in a bundle ends at the bundle line's middle; one hidden whole in a collapsed frame ends at its attribute's block row |
| `LineLayer.tsx` | a fourth group in the one SVG (AD-24 rule 3): a dashed path and an end dot per line, no dot below 40 %, no group per line (S3A-14). Each line is drawn again only when its ends move (memo on its coordinates) |
| `ModelCanvas.tsx` | the traces from the requirement index once per set of cards and data version (not per move); passed only in “Everything” (item 10) |
| `canvas.css` | `.trace` dashed in `--im-req`, `.trace-dot`; under the layer's `dimmed` class (a selection with related lines) they fade with the other lines, never on a hover (B) |
| `known-limitations.md` | B's note under “C-10 met; the other lines do not fade on a hover” |

What redraws them (item 11): the line layer re-renders on node changes (a drag, a resize, a collapse), and a line whose
coordinates did not change keeps its element; a link changes the page's data and so the traces; panning and zooming
change no node, so the layer is rastered once and moved by the compositor.

### Tests

| Test | What |
| --- | --- |
| `e2e/slice-04b2/S4B2-03.spec.ts` (new) | REQ-104 (four seeded rows) also linked to Customer, `order_header`, a column of `customers`, a mapping onto Customer and Product (off the canvas): eight lines, none to Product; every line starts on the requirement card's edge; ends at Customer's and `order_header`'s right edge at the header's middle, at the `total_amount` and `email_addr` rows, at the mapping line's middle; Customer dragged, its line follows; none in “Mappings” and “Relationships”, eight again in “Everything”; Sales Order and Order Line in a collapsed frame: their lines end at their member rows on the block's edge |
| `src/canvas/trace-data.test.ts` (new) | `buildTraces` (card, row, column, mapping, table; none off the canvas, none for a deleted link); `traceGeom` (nearer side, nearest point on the requirement card, row height, mapping middle, block row and “and N more”, nothing without both ends); `nearerSide`, `nearestOn` |

No earlier test changed in this step.

### Checked in the browser

“Customer & orders” at 62 %: REQ-104's four dashed lines run from the top of its card to the right edges of Sales Order's
`total_amount` row and Order Line's `quantity`, `unit_price` and `discount_pct` rows; no console error.

### Three full runs

No dev server, Playwright or measurement server running; each run from scratch (`npm run e2e`), in a row:

| Run | Result | Time |
| --- | --- | --- |
| 1 | 176 passed | 33.6 min |
| 2 | 176 passed | 32.2 min |
| 3 | 176 passed | 32.0 min |

Lint, typecheck and the unit tests (1,004 in 76 files) pass. 176 is step 2's 175 plus S4B2-03 (about 60 s).

### The texts you approve in this report (not applied)

**`docs/decisions.md` D-41**, replacing the line:

> **D-41** Requirement card: 230 px, filled header in a reserved violet (excluded from the concept palette) with the
> kind's icon, the key and the kind's name; the name; a three-part coverage bar over the requirement's items (D-31):
> covered, mapped but not approved, not mapped (an entity item is mapped when any of its attributes has a mapping); the
> status badge and “{m} of {n} covered”. Below 40 % the header and a plain block. Selecting the card is selecting the
> requirement. A requirement has at most one card per canvas; its cards are layout, never frame members, carry no label
> on a live canvas and hold no pinned notes; Duplicate layout copies them. (Changed in slice 4b-2.)

**`docs/data-model-v2.md`**, under `canvas_item`, after the table:

> A requirement card (`requirement_id` set) stores `width` null (drawn 230 px), `collapsed` false, `row_filter` `all`,
> and `frame_id` and `live_level` null: it is layout only (slice 4b-2).

## Łukasz's answers after step 2 (18 October 2026)

- **Step 2 accepted.**
- **1.** REQ-104's card stays at (1176, 1136).
- **2.** The layer result is accepted for step 2. In the closing sitting S4B2-15 also reports the cost of cards laid over
  frames at 30 % (layers and presented fps), and whether item 15's placement can ever put a card over a frame.
- **3.** D-41 and the data-model text: quoted in full in the next report, approved there; not applied until then.
- **4.** The e2e runs grew from about 27 to 32 min with two new tests: before step 3, find out why (per-file durations
  against `slice-04b1`, the ten files that grew most, the app or the tests). No fix without Łukasz's OK.
- **Then step 3** (trace lines), stopping after it.

## Step 2: the card (18 October 2026)

Items 1–7, 13 and 25, with the answers G, H, I, J, L and N where they touch the card.

### What changed

| Part | Change |
| --- | --- |
| Data (Q1) | The adapter's guard `canvas_item_no_requirement_yet` is gone; undo checks a card's requirement as its parent; deleting a requirement soft-deletes its cards on every canvas in the same change group |
| Domain | `placeRequirementCards` (one or more, one change group; refused for reviewers and readers, a second card on a canvas, a deleted requirement); `card-kinds.ts` (`isRequirementCard`, `isElementCard`); the frame rules, the live sync and note pins ignore requirement cards (item 6, G, N); `moveOnCanvas` moves requirement cards by position only, never into a frame; removing them on a live canvas needs no label (G); `coverageBar` and `entityNotApproved` for the bar's middle part over entity items (item 2); `requirementCardSpots`, item 15's placing rule (pure, used by the seed now and by the panels in step 4) |
| Canvas | `RequirementCardNode`, a third React Flow node type with its own state beside the cards; `requirement-card-data.ts` builds the cards on the server from the requirement index. Selecting it is selecting the requirement (`req:<id>` keys in the selection); the mark is in the overlay (`SelectionOverlay`); single drag, group drag, nudge, lasso and Ctrl+A move it in the same change as the cards (`ReqMover` in `useFrames` and `GroupActions`, one undo step); Delete and the card's menu remove the card; fit (F) and the Overview's miniature include it (I) |
| Panels | The requirement panel: “Place its card on this canvas” (the view's top centre) or “Remove its card from this canvas”; the Requirements tab's “Only on this canvas” and the on-canvas dot (J) |
| Seed (A) | REQ-104's card on “Customer & orders”, by item 15's rule from the Sales cards' box (below) |

### The seed's REQ-104 card: where item 15's rule put it

Answer A said 80 px right of the Sales cards' box, 40 px below its top: (1176, 608). The `order_line` table already
stands at (1176, 600), with two notes pinned below it. So the seed uses item 15's rule from that point: down in 16 px
steps to the first place 20 px clear of cards and notes. The card lands at **(1176, 1136)**, below `order_line`'s notes,
right of the Sales cards. If you prefer it elsewhere (for instance right of `order_line`, at x = 1512), say so.

### Assumptions

- **No toast when placing from the requirement's panel** (prototype `req-card`); removing a card toasts “Removed
  REQ-104's card from this canvas. The requirement stays.” with Undo, as removing an element card does.
- **Delete and the card's menu clear the selection** after removing the card (prototype); the panel's “Remove its card”
  keeps the requirement selected, so its panel stays open.
- **The project tiles have no thumbnails** in the app (an empty strip), so I's “tiles” part has nothing to draw. The
  tile's card count stays the entity and table cards.
- **A live canvas's “Remove from this canvas” for several** still refuses when the selection holds element cards (D-11);
  a selection of requirement cards only is removed.
- **The height** comes from the name's lines (`requirementNameLines`, an estimate that errs on more lines), so the card's
  height is the same at every zoom and known before it is drawn. S4B2-01 checks that the name never reaches the bar.

### LayerTree read against `slice-04b1` (AD-24 rule 4)

Measurement builds of both sides (`../infomapper-ab-main` moved to `slice-04b1`; its earlier sitting copies are in a git
stash there), CDP `LayerTree`, no timing (`.data/measure/s4b2-step2-layers/`). “Performance test” with requirement cards
placed through the domain: in a grid over whatever is in view, or by item 15's rule beside elements.

| View | Cards | Drawing layers (`slice-04b1`) | Drawing Mpx | Viewport elements |
| --- | --- | --- | --- | --- |
| “Customer & orders”, 60 % | REQ-104 (seed) | 8 (7) | 4.5 (4.5) | 612 (601) |
| Performance test, 100 % dense | 0 / 1 / 12 grid / 12 beside | 47 / 47 / 47 / 47 (47) | 68.4 | +0 / +11 / +132 / +132 |
| Performance test, 30 % ent:23 | 0 / 1 / 12 grid / 12 beside | 47 / 48 / **53** / 47 (47) | 69.2–69.4 | +0 / +8 / +96 / +96 |

- **Elements per card: 11 at 40 % and above, 8 below** (step 1 estimated 7 below: the plain block has an inner element,
  as on entity cards).
- **No growth at 100 %, and none at 30 % with item 15's placement.**
- **At 30 %, cards laid over frames and other cards get a layer each** for “Overlaps other composited content”: 6 of 12.
  The frames' bodies, labels and handles are composited in that view. Element cards there squash into one shared layer;
  scattered requirement cards do not (Chrome does not squash sparse layers). Notes behave the same way today (each note
  over composited content has its own layer in the same read). Drawing the requirement cards below the cards instead of
  above them changed nothing, so they stay above (prototype).
- **“Customer & orders” +1:** REQ-104's card next to the pinned notes, for the same reason.
- **Reading:** the rule holds for cards where the app places them; a user who drops many cards over frames at 30 % adds
  a layer per card, as with notes. S4B2-15 counts this again in the closing sitting.

### Tests

| Test | What |
| --- | --- |
| `e2e/slice-04b2/S4B2-01.spec.ts` (new) | the card's content against the domain for REQ-101, REQ-104, REQ-105; tooltip; 230 px; the name above the bar; below 40 % header and block at the same height |
| `e2e/slice-04b2/S4B2-02.spec.ts` (new) | placed from the panel at the view's top centre; one per canvas; moved on the grid and kept out of a frame; removed from the panel, the menu and by Delete; deleting REQ-104 removes its cards on both canvases, undo restores them; Ctrl+A and a group drag take it along, one undo |
| Unit (new) | `requirement-card-data.test.ts`, `requirement-placement.test.ts`; requirement cards in `canvas-item`, `frame` (moves), `requirement` (cascade and undo), `canvas` (duplicate copies them, H), `selection`, `text-fit`, `requirements` (`coverageBar`), the adapter (a requirement card, one per canvas) |
| `e2e/slice-01a/helpers.ts` (changed) | `loadItems` returns the entity and table cards, as every caller meant; `loadRequirementCards` and `cardNodes` are new |
| `src/data/local/model-store.test.ts`, `requirement-store.test.ts` (changed) | the demo seed's counts: seven element cards plus REQ-104's card; REQ-104's card is the only requirement card |
| `selection.test.ts`, `requirements.test.ts` (changed) | `unitsOf` returns `reqs`; coverage carries `entityNotApproved` |

**Changed earlier e2e tests** (the first full run had seven failures; all are REQ-104's seeded card or decision J/L):

| Test | Change |
| --- | --- |
| `S1A-03`, `S2A-11`, `S2A-13` | narrowed to the entity and table cards' nodes (`.react-flow__node-card`, `cardNodes`); expectations unchanged |
| `S2A-02`, `S2B-08`, `S3A-10` | Ctrl+A takes REQ-104's card (L): “9 selected”, “… 1 note, 1 requirement.”, one more item; the selection panel lists it as “REQ-104 Order total …” |
| `S2A-13` | “Remove from this canvas” on Ctrl+A's selection removes eight cards, REQ-104's included (L); undo restores them |
| `S4A-01` | “Only on this canvas” lists REQ-104 (J) instead of the empty text; the test's title says so |

**A regression the suite caught (S4P-06):** with no collapsed frame, every selection change built a new empty block list,
so the canvas handed React Flow a new nodes array and the miniature redrew once per selection. The block list is now one
constant empty array, as the nodes array was before (fixed in `ModelCanvas.tsx`, no test changed).

**The selection panel** (`selection-panel.tsx`) counts and lists requirement cards and offers “Remove from this canvas”
for them; without it a requirement card in a selection showed as a table named “?”.

### Three full runs

No dev server, Playwright or measurement server running; each run from scratch (`npm run e2e`), in a row:

| Run | Result | Time |
| --- | --- | --- |
| 1 | 175 passed | 31.8 min |
| 2 | 175 passed | 32.1 min |
| 3 | 175 passed | 32.1 min |

Lint, typecheck and the unit tests (999 in 75 files) pass. 175 is 173 plus S4B2-01 and S4B2-02. The runs are about 5 min
longer than 4b-1's (26.8–27.6 min); the two new tests take about 50 s, the rest is this laptop's load (the measurement
builds ran just before).

### Proposed texts (for Łukasz's approval; not applied)

**`docs/decisions.md` D-41**, replacing the line:

> **D-41** Requirement card: 230 px, filled header in a reserved violet (excluded from the concept palette) with the
> kind's icon, the key and the kind's name; the name; a three-part coverage bar over the requirement's items (D-31):
> covered, mapped but not approved, not mapped (an entity item is mapped when any of its attributes has a mapping); the
> status badge and “{m} of {n} covered”. Below 40 % the header and a plain block. Selecting the card is selecting the
> requirement. A requirement has at most one card per canvas; its cards are layout, never frame members, carry no label
> on a live canvas and hold no pinned notes; Duplicate layout copies them. (Changed in slice 4b-2.)

**`docs/data-model-v2.md`**, under `canvas_item`, after the table:

> A requirement card (`requirement_id` set) stores `width` null (drawn 230 px), `collapsed` false, `row_filter` `all`,
> and `frame_id` and `live_level` null: it is layout only (slice 4b-2).

### Questions for Łukasz

| # | Question | Proposal |
| --- | --- | --- |
| 1 | **REQ-104's seeded card** sits at (1176, 1136), below `order_line`'s two notes, because answer A's spot is taken (above). | Keep it there. Alternative: right of `order_line` at (1512, 608), closer to the Sales cards' row. |
| 2 | **The texts for D-41 and the data model** above. | Apply them as written, in this PR. |
| 3 | **The layer read:** no growth where the app places cards; at 30 % a card laid over frames gets an overlap layer, as notes do. | Accept for step 2; S4B2-15 counts it again in the closing sitting, and AD-24's text records it after the sitting. |

## Step 1 (18 October 2026)

- **Start:** local `main` was behind `origin/main` (`052daaf`); fast-forwarded to `8133ee8` (tag `slice-04b1`), tree
  clean, in sync with `origin`. No `node`, dev server, Playwright or measurement server running. The Chrome processes
  running were Łukasz's (no `ms-playwright` or remote-debugging command line).
- **The PRD** is copied unchanged from Łukasz's download to `docs/prd/slice-04b2-requirement-cards.md`.
- **No application code changed.** The answers below come from reading the code at `8133ee8` and the prototype; nothing
  was measured.

### Questions for Łukasz (found while answering)

Each has a proposal. A to F change what the PRD says; G to N fill gaps the PRD leaves.

| # | Question | Proposal |
| --- | --- | --- |
| A | **Item 25: the demo seed has no frames.** `seed-model.ts` places the cards “without frames”; the prototype arranges its layout into frames on first load (`arrangeLayout`) and only then places REQ-104 right of the Sales frame (`placeSeedReq`). | Place REQ-104's card on “Customer & orders” 80 px right of the box around the Sales concept's cards (Sales Order, Order Line) and 40 px below its top, on the 8 px grid: where the prototype's Sales frame would put it. |
| B | **Item 12: dimming on a hover.** Slice 4p rejected fading lines on a hover (C-10 228–247 ms against 19–26 ms; `known-limitations.md`, “C-10 met; the other lines do not fade on a hover”). Since then a hover dims no line. | Trace lines **dim on a selection** with the other lines: the line layer's existing `.dimmed` class (one class on the layer's root, set when a selection has related lines), plus one CSS rule for `.trace`. **No dimming on a hover**, as for mapping lines. Under Focus they follow item 21. Recorded as a deliberate difference. |
| C | **Item 21: which requirement cards stay lit.** “Linked to anything in the lit set” lights more than the prototype. Focus on Customer lights its neighbours too (Sales Order through a relationship, the CRM tables through mappings). REQ-104 (Sales Order and Order Line) would then stay lit with Customer focused. The prototype's `reqActive` lights a card only when its requirement's **scope contains the focused element itself**. | **The prototype's rule:** with a requirement focused, only its card; with an element focused, the cards whose scope contains it. For a frame, any member counts; for several selected, any of them; for a mapping, the mapping or its attribute; for a relationship, either entity. The definition of done (“the requirement cards linked to it stay lit”) holds under both rules. Trace lines are lit when both ends are lit, as the PRD says. |
| D | **Item 22, T3 as written cannot have “no layer of its own”.** The veil is its own compositing layer (`will-change: transform`), and the lit lines must paint **above** it. Chrome then has to give them a layer by overlap: that is the 22–31 Mpx layer in 4b-1's diagnosis. Lit lines can only share the overlay's layer if nothing composited lies between them and that layer. | **T3 = the veil without a layer of its own.** It paints into the overlay's layer together with the lit lines, rows and trace lines: one layer instead of three. **The risk:** switching Focus then repaints the overlay layer's visible tiles, not only the veil's. So step 6 adds, besides the LayerTree reads, a **to-screen diagnosis of Focus switching** (10 pairs, 30 % and 100 %, no preparation, figures diagnostic). If switching goes over 100 ms, step 6 stops with the figures. The other way to share a layer is the lit lines inside the veil's SVG (T2), which you dropped. |
| E | **S4B2-10 and S4B2-14 need “Performance test” with and without requirement cards.** S4B2-14 compares with no requirement cards against `slice-04b1`, and S4B2-15 counts elements without and with them. | `seed:large` adds the cards on a **second canvas**, “Performance test – requirements”: the same layout, frames and notes, plus the requirement cards. The original canvas stays as it is in `slice-04b1`, so S4B2-14 and S4B2-15's “without” compare the same data. S4B2-10 and S4B2-11 use the new canvas; its `slice-04b1` side is the original canvas (Q8). |
| F | **S4B2-12, the drop-target highlight to the screen.** The drag from the left panel is native HTML drag and drop. `to-screen.ts` anchors on an input event, and Playwright's CDP drag (`Input.dispatchDragEvent`) may not produce one the trace shows as input. | Anchor on a `performance.mark` the spec sets just before it dispatches each `dragover` move, and then as today (the first commit after it, to the present). Step 5's smoke checks that a trace shows it; if not, step 5 stops with a proposal. |
| G | **Live canvases.** The PRD does not mention them. On a live canvas a card added or removed changes the label (D-11), and requirements carry no labels. `live.ts` treats every card that is not an entity as a table (`source_table_id!`). | Requirement cards are allowed on live canvases as **layout only**: placing, moving and removing them changes no label and needs no question, as notes. The live sync and the live arrange ignore them. Dropping onto an element links, as on any canvas (a link is not labeled, D-26). |
| H | **Duplicate layout.** The app's `duplicateCanvas` copies every card; the prototype's `dupDia` copies entity and table cards and frames, not requirement cards (nor notes, D-20). | As the prototype: the copy gets **no requirement cards**. |
| I | **Fit (F), the Overview's miniature and the project home's tiles.** The prototype includes requirement cards in fit-everything (`fit`), and draws them in the miniature and the tile thumbnails as violet rectangles (`thumb`). The PRD says nothing. | All three as the prototype: one rectangle per card, in `--im-req`. S3B-13's guard (the miniature does not redraw on a pan or zoom) stays, and one drop of a requirement card redraws the miniature once. |
| J | **The Requirements tab's “Only on this canvas”** says “No requirement has a card on this canvas yet.” since slice 4a. The prototype then lists the requirements with a card here, and marks those rows with the on-canvas dot. | As the prototype: the filter shows the requirements with a card on this canvas, and every requirement row gets the dot, as the Model tab's items do. |
| K | **The project home's Requirements list** (`projectRequirements`) lists requirements whose scope touches the project's canvases. The prototype's `projReqs` also lists those whose card lies on one. | As the prototype: a requirement with a card on one of the project's canvases is listed even when its scope touches none. Item 23's score already counts the card. |
| L | **Multi-selection** (item 6, “as for other cards”). The prototype's requirement cards are not in multi-selection (a deliberate extension, then). The group actions differ: arrange, fit widths and “Place sources” make no sense for them. | The lasso and Ctrl+A take requirement cards. Moving them together, “Remove from this canvas” and Delete act on them. Arranging, fitting widths and placing sources ignore them. A lassoed frame stands only for its members (D-17), and requirement cards are never members. |
| M | **Item 17, a requirement whose card is already on the canvas, dropped on empty canvas.** | As the prototype's drop of a placed card: the card **moves** to the drop point and is selected. The hint reads “Move card”, the toast “Moved {key}'s card.” |
| N | **Notes pinned to a requirement card.** The prototype pins notes to entity and table cards and frames only. | Not offered: a note dropped on a requirement card stays free. If a requirement is deleted, no pinned note needs releasing. |

**Left out on purpose** (prototype features the PRD does not ask for; to `docs/ideas.md` in step 8):
- double-click on a requirement card opens the description editor, and the card menu's “Edit description…”;
- “Show its requirements (n)” in the attribute row and card menus;
- resizing a requirement card (230 px fixed, as the prototype).

### Q1. Data

**The schema and the adapter already have the column, the check and the index.**

| What | Where | State |
| --- | --- | --- |
| `requirement_id` | `canvas_item` in the initial migration, `CanvasItem` in `types.ts`, the adapter's foreign keys (`schema.ts:282`) | present |
| “Exactly one of entity, table, requirement” | `canvas_item_one_target_ck` in the migration and the adapter | present |
| One card per requirement per canvas among live rows | `canvas_item_requirement_uq` (partial unique index) and the adapter's `unique` with `live: true` | present |
| **Refusing requirement cards** | the adapter's extra check `canvas_item_no_requirement_yet` (`schema.ts:294`, “requirement cards come with slice 4b”) | **to remove in step 2** |
| Soft delete, versions, change events | generic for every table | nothing to do |
| Undo | `undo.ts`'s `PARENTS` for `canvas_item` lists canvas, entity, table and frame, **not requirement** | **add `["requirement_id", "requirement"]`**, so undo and redo check a card's requirement as they check its entity |
| The data file's format | no column changes, so no new `format` | nothing to do |

**The delete cascade.** `deleteRequirement` (`requirement.ts:240`) soft-deletes the links and lifts the children. It
does not see canvas items. Step 2 gives it the live `canvas_item` rows of the workspace and soft-deletes every card of
the requirement, on every canvas, in the same change group. One undo brings the requirement, its links and its cards
back. No note needs releasing (N).

**What a requirement card stores.** `width` null (drawn 230 px), `collapsed` false, `row_filter` `all`, `frame_id` and
`live_level` null. The domain keeps them so: the frame rules never set `frame_id` on a requirement card (item 6), and a
command that would is refused.

**`docs/data-model-v2.md`:** one sentence under `canvas_item` saying the above. No table or migration change. It needs
your approval of the text, as the file says.

**A sweep, step 2.** Several readers assume a card is an entity or a table. Each gets an explicit
“element cards only” filter, tested:
- `live.ts` (`source_table_id!`, three places);
- `frames.ts`' `dropCards` and `frame.ts`' `moveOnCanvas` (membership, arranging, fitting);
- `canvas-item.ts`' duplicate check;
- `card-data.ts`' `buildCards`;
- `tree-data.ts` and `stats.ts` (presence dots, tiles, project statistics);
- `selection.ts`, the lasso and `GroupActions.ts`;
- `notes.ts` (pins).

### Q2. The card

**Component.** `RequirementCardNode` in `src/canvas/`, a third React Flow node type next to `card` and `block`
(`nodeTypes` in `ModelCanvas.tsx:107`). Its data comes from a pure `buildRequirementCards(index, items)` beside
`buildCards`: key, kind, name, status, the description's first 300 characters, and the bar's three counts. The counts
come from the requirement index the canvas already gets (4b-1), so nothing is built a second time.

**The bar's three parts (item 2).** `RequirementCoverage` has `covered`, `notApproved` and `notMapped` for attribute
items, but one `entityGaps` list for entity items. Step 2 splits it into entity items that are **mapped but not
approved** and those **not mapped**, with unit tests. `done`, the “{m} of {n}” text and 4b-1's panels stay as they are.

**Elements per card** (AD-24 rule 4: keep repeated marks to one element):

| Part | At 40 % and above | Below 40 % |
| --- | --- | --- |
| React Flow's node wrapper | 1 | 1 |
| The card | 1 | 1 |
| Header: the kind's icon as a CSS mask (as 3a's label marks), key, kind's name | 4 (header + 3) | 4 |
| Name (wraps; no clip, no `overflow: hidden`, height from content) | 1 | – |
| The bar: **one element** with a three-stop `linear-gradient` background | 1 | – |
| Footer: status pill, “{m} of {n} covered” | 3 | – |
| The plain block | – | 1 |
| **Total** | **11** | **7** |

- **No opacity, no `transform`, no `overflow: hidden`.** The prototype's `.rq-card` clips its header with
  `overflow: hidden`; here the header gets its own top radius instead.
- **The selection mark** is drawn in the overlay (`SelectionOverlay`) in violet, not as a box-shadow on the card.
- **The tooltip** is the card's `title`.
- **Height.** Drawn from content, so React Flow measures it, and the lines and holes use the measured size.
  Placement (item 15) cannot wait for a measure, so it uses a pure estimate, `requirementCardHeight(name)`, from
  `text-fit.ts`' character widths. The estimate is unit-tested against the measured heights of the seed's names in
  step 2's e2e test.

**The LayerTree read (step 2, against `slice-04b1`).** “Customer & orders” with REQ-104's card, and “Performance test –
requirements” (E) at the overview, 100 % dense and 30 %, frames expanded:
- drawing layers and total megapixels, with and without the cards;
- elements in the viewport.

**The bar:** the number of drawing layers does not grow with the number of requirement cards (one more card, the same
count). Any difference is explained. The same read is S4B2-15's.

### Q3. Trace lines

**Where.** In `LineLayer`'s one SVG (AD-24 rule 3), a fourth group after the tethers. Each line is a `path` and a
`circle` (no group, as the tethers: slice 3a's S3A-14). No end dot below 40 % (rule 1). Dashed, in `--im-req`, without
opacity on the elements (rule 4). Selection dimming (B) is the layer's existing class.

**Their ends.** A pure `traceEnds(card, links, lookup)` in `line-geometry.ts`, from data (rule 2):

| Target | End |
| --- | --- |
| Entity or table | its card's nearer side edge, at the header's middle (`HEAD_H / 2`) |
| Attribute or column | the nearer side edge, at `rowEnd`'s height. A row hidden by its card's row filter or a collapsed card anchors at the header, as mapping lines do (`rowEnd` already does it). |
| Mapping, one input | the middle of its curve (`curve().mid`) |
| Mapping, several inputs | the ƒ node (`fNode().node`), where its inputs meet |
| Inside a collapsed frame (item 9) | its member row in the block, by the formula 4b-1's coverage dot uses (`CoverageLayer.tsx:95`), at the block's nearer edge. Past the sixth member: the “and N more” row. |
| A mapping with an end in a collapsed frame | the middle of the bundle line that carries it |

The start is the point of the requirement card's rectangle nearest to the end (the prototype's clamp). No line to an
element that is not on the canvas.

**What redraws them.** `LineLayer` already re-renders on every node change (`useStore((s) => s.nodes)`) and reuses each
line's element while its key is unchanged. A trace line's key is both cards' `cardKey`, plus the block's rectangle when
the end is in a collapsed frame, plus the link's object identity. So:
- a drag recomputes the lines of the dragged cards only;
- linking or unlinking changes the canvas's data and redraws the affected lines;
- collapsing or expanding a frame changes the block and redraws its lines.

Panning and zooming change no node, so nothing re-renders. The layer is rastered once and moved by the compositor.

**The layer switch (item 10).** Trace lines are built only in “Everything”, which costs nothing in the other modes.

**Item 9's cost.** A lookup of the member's index in the block's data (already built for 4b-1's dots) and one
multiplication. No DOM read, no new element. The cost is the same as a row end.

### Q4. Dragging from the left panel

**Today.** The Model and Sources tabs' items drag with native HTML drag and drop, with a custom type
(`CARD_DRAG_TYPE`, `left-panel.tsx:579`). The canvas's `onDragOver` and `onDrop` (`ModelCanvas.tsx:1392`) take it and
place the card where it is dropped. Requirement rows do not drag yet. The column drag inside the canvas
(`ColumnDrag.tsx`) is pointer events, and marks its drop target by **adding a class to the row** (`.drop`), which
restyles the card. Item 18 forbids that, so it is not reused.

**The new drag:**
- **The type.** Requirement rows in the left panel set `REQ_DRAG_TYPE` with `{ requirementId, key, name }`. Element
  panels' rows set a second type, `REQ_CARD_DRAG_TYPE` (item 14: a drop only places the card, never a link).
- **The drop target,** on every `dragover`, from `document.elementFromPoint`, in this order:
  - a row (`.row[data-row]`) of an expanded card at 40 % and above;
  - a mapping line's hit path (`.lnk.map .hit`; a bundle of one mapping counts as that mapping);
  - an entity or table card (not a block);
  - otherwise the pane, or a collapsed frame's block: “Place card”, or “Move card” (M).

  A bundle of two or more mappings is no target; the drop places the card. Below 40 % there are no rows, so the card
  is the target.
- **“Already linked”** compares with the requirement's **direct** links, from the index the canvas has.
- **Commits.** The target goes into a **value store** (as 4p's hover), written only when it changes.
  - **The highlight:** `DropTargetMark` in `OverlayLayer` subscribes to it. It draws a row or card rectangle, or the
    mapping drawn again with `MapPath`, computed from data like the hover's.
  - **The hint:** a small fixed element outside React Flow, in a portal on `document.body`. Its text comes from the
    store; its position is set on its style from each `dragover` (no React render).
  - So a drag over targets re-renders the mark and the hint, never `ModelCanvas` or the miniature. S4B2-15 checks it
    with `__imCanvasCommits` and `__imMiniatureCommits`.
- **{name} in the hint and the toast:**
  - the attribute's or column's name;
  - the entity's or table's name;
  - for a mapping, the label the requirement panel's link list uses.
- **The drop** runs `linkRequirementAction` (existing, undoable) or `placeRequirementCardAction` (new), then the
  toasts of item 19, the link's with Undo.
- **Esc and leaving the canvas** clear the store.

### Q5. Placement next to an element

**The prototype's `placeReqCards`,** with the PRD's figures:

| Step | Rule |
| --- | --- |
| The anchor | entity or table: its card's rectangle (its block's if it is in a collapsed frame); attribute or column: the card's rectangle with its top at the row's height − 20; mapping: a 20 × 40 box around its middle (Q3's end) |
| x | anchor's right edge + 80 (the prototype's gap), on the 8 px grid |
| y | the anchor's top, on the grid. Going down in 16 px steps until the card's rectangle with the estimated height (Q2), grown by 20 px, meets no element card, block, note or requirement card (at most 400 steps, as the prototype) |
| Several cards | each below the one before, 24 px apart, each with the same free-place search |
| The fit | if any placed card is outside the view, the view fits the anchor and the placed cards with 40 px around them, animated (`centerOnRect`) |
| Toast | “Placed {n} requirement card(s) on this canvas.” One card placed: it is selected |
| Already there (the row's icon) | select it and bring it into view (the prototype's `showReqCard`: a 630 × 400 box around it) |

- **One command for all of them,** so “Add all” is one change group and one undo step.
- **The search** is a pure function in `geometry.ts` (beside `besideSpots`), unit-tested on the prototype's cases.
- **Frames are not avoided,** as in the prototype. A card placed inside an expanded frame's area is not a member
  (item 6), and the frame does not take it along when it moves.

**“Place its card on this canvas” (item 13):** x = the view's centre − 115, y = the view's top + 60 (the prototype),
on the grid. The requirement stays selected.

**“Add to this canvas” (item 16):** the existing `placeAt`, at the view's centre and upper third. The card is then
selected.

### Q6. Focus with requirement cards

- **The lit cards** (C): `requirementCardsLit(index, request, model)`, a domain function next to `focusLit`, tested per
  target kind. The request's key already changes with the selection, so nothing new triggers it.
- **The holes (item 20):** `litNodeIds` in `fade-canvas.tsx` gains the lit requirement cards' node ids. `FadeLayer`
  cuts their holes with the measured size, as for other cards. Requirement cards are never in a collapsed block, so
  they never need a block's hole.
- **Trace lines:**
  - they lie in the line layer below the veil, so a faded one is faded by the veil, with no restyle;
  - a lit one (both ends lit) is drawn again above the veil, next to the lit mapping lines (`LitLines` gets a `traces`
    list).
- **Switching** stays a store change: `FadeLayer` and the overlay commit, the canvas and the miniature do not (S4P-12,
  S4B1-06).

### Q7. T3

**What it is** (D): the veil loses `will-change: transform`. The veil, the lit lines, the lit trace lines and the
coverage marks then paint into the overlay's one layer.

**The reads, step 6.** CDP `LayerTree`, as 4b-1's step 6, on “Performance test – requirements”: 100 % and 30 %, frames
expanded and collapsed, Focus off / ent:23 / REQ-102, before and after T3.

| Figure | Before (expected, from 4b-1) | After (the aim) |
| --- | --- | --- |
| Drawing layers with Focus on | off + 2 (veil, lit lines) | off + 0 |
| The overlay's layer | the overlay's marks only | the veil's size (about 543 Mpx at 30 %, only visible tiles rastered) |
| Lit lines' own layer | 22–31 Mpx | none |

**The risk.** Chrome may still give the overlay's content more than one layer:
- by overlap with something composited inside it (the selection marks, the hover);
- or because a 543 Mpx layer gets split.

The read shows which. And switching repaints a larger layer (D). Step 6 then reports:
- the LayerTree figures;
- the to-screen diagnosis of Focus switching;
- C-10 with Focus on, as a diagnosis: a hover then repaints the overlay's layer, the veil's visible tiles included.

**If any of them misses,** step 6 stops with a proposal. The pan figure itself is S4B2-11, in the closing sitting.

### Q8. `seed:large`, and the closing sitting

**The cards** (E), on “Performance test – requirements”, the original layout copied:

| Requirement | Links | Trace lines | Placed |
| --- | --- | --- | --- |
| REQ-101 small (existing) | 6 attributes of ent:19 | 6 | beside ent:19 |
| REQ-102 large (existing) | 46 attributes of ent:3, 4, 7, 19 | 46 | beside ent:3 |
| REQ-103 dense (existing) | the tables in S1A-14's 100 % view | one per table (about 10) | beside src:57, inside the dense view |
| REQ-104 to REQ-112 (new, 9) | 4 to 8 links each: entities, attributes, columns and mappings, in the overview's frames; two of them in the dense view, one ending in a collapsed frame when frames are collapsed | about 55 | by item 15's placement, next to their first link |
| **Total** | | **about 120 trace lines, 12 cards** | |

- **The placement** uses the same pure function as the app, so the seed shows what a user would get.
- **The views.** Step 7 checks, and reports, that the dense view holds at least 2 cards and 20 trace lines, and the
  30 % overview at least 8 cards and 80 lines.
- **Why this many.** REQ-102 is one card with 46 lines (a realistic worst case for one card); the others add the
  spread. More than a dozen cards on one canvas is past what the prototype's demo suggests a user does.

**The closing sitting** (section 6): this branch against `slice-04b1`, measurement builds made before your restart and
used with `--no-build`, one unrecorded warm-up, three rounds with the sides rotated, a CPU check before every side, a
disturbed round dropped and replaced. 4b-1's rates: a settled switch about 2.6 s, a page about 8 s, a traced pan about
25 s, an untraced pan about 18 s.

| Criterion | Side | Cases | Per round |
| --- | --- | --- | --- |
| S4B2-10 cards and lines in view, Focus off | branch on “– requirements”; `slice-04b1` on “Performance test” (shared with S4B2-14's side) | overview and dense, expanded and collapsed: 4 traced, 4 untraced pans | about 3.5 min |
| S4B2-11 pan with Focus on at 30 % | branch | 30 % and 100 %, expanded and collapsed × (off, ent:23, REQ-102): 12 traced, 12 untraced | about 9 min |
| S4B2-12 to the screen | branch | the drop-target highlight (row, card, line), selecting a requirement card, Focus on with cards lit; 100 % and 30 %, expanded; 10 pairs each | about 6 min |
| S4B2-13 dragging a card | branch | a requirement card and an entity card, 100 % and 30 %, traced | about 2 min |
| S4B2-14 no regression, no requirement cards | both, on “Performance test” | 4 pans traced and untraced; C-10 10 pairs; the lasso 10; C-08 five loads | about 6.5 min each |
| Server start and CPU check | both | | about 1.5 min each |

- **Per round:** the branch about 28.5 min, `slice-04b1` about 8 min, so about 37 min.
- **Three rounds:** about 1 h 50 min.
- **Warm-up** (one pair or pan per case, both sides): about 12 min.
- **Total about 2 h 5 min,** plus about 37 min for each replacement round. The builds (about 10 min) come before your
  restart and are not counted.
- **S4B2-15's element and layer counts** are LayerTree reads, not timed: in step 8, before the sitting, with no
  preparation. Its commit guard is an e2e spec in every run.
- **Option** (not in the estimate): the 30 % Focus pans on the `slice-04b1` side too, a direct A/B of T3. That is
  4 traced pans per round, about 12 min for three rounds. **Proposal:** no; S4B2-11 compares Focus on with off on the
  same branch, as 4b-1 did.

### Q9. Earlier tests that change

| Test | Why | Step |
| --- | --- | --- |
| Tests that count or walk every node on “Customer & orders” (`.react-flow__node` in `S1A-03`, `S2A-06`, `S2A-11`–`S2A-13`, `S2C-01`, `S1B-11`, `S4B1-05`, `S4B1-07`, and the slice 1a helpers) | REQ-104's seeded card is a node. Where a test means “entity and table cards”, its selector narrows to `.react-flow__node-card`; no expectation changes | 2 |
| Fit-everything tests (`S1A-09`, `S1B-03`, `S2B-13`, `S2C-03`, the 1b measuring helper) | F includes requirement cards (I), so the fitted view of “Customer & orders” changes | 2 |
| Ctrl+A and lasso tests on the demo canvas (`S2A-*`) | requirement cards join the selection (L) | 2 |
| Overview miniature tests (`S3B-13`) | the miniature draws requirement cards (I) | 2 |
| `S4A-08` and `S4B1-04` (deleting a requirement) | deleting REQ-104 also removes its card; undo brings it back | 2 |
| Panels' Requirements section (`S4A-07`, `helpers.ts`' `sectionRows`) | each row gains the “Place card” icon, and the list “Add all” (item 14). `sectionRows` reads the name only | 4 |
| `S4A-01`, `S4B1-03` (left panel) | “Only on this canvas” lists requirements with a card (J); requirement rows get the presence dot | 2 |
| `S4A-13` | item 23: REQ-103 opens “Customer & orders” (it holds Customer), not the last opened “Order lines & products”. The case “after Order lines & products, that one opens” becomes a requirement scoring zero on every canvas | 7 |
| `S4A-13`, `S4B1-03` (project home list) | requirements with a card are listed (K); with the demo seed the list stays the same (all five touch “Customer 360”) | 7 |
| `S3B-15-elements`, `S4A-14-elements` | none on “Performance test” (E); a new “– requirements” baseline is S4B2-15's | – |
| `S2C-12`, `S3A-14-idle`, `S3B-15-idle`, `S4P-12`, `S4B1-06` | none expected; they run on canvases without requirement cards or count commits only | – |
| Unit: `requirements.test.ts`, `requirement-index.test.ts` | the entity gaps' split (Q2) | 2 |
| Unit: `schema` and `store` tests on `canvas_item_no_requirement_yet` | the check goes | 2 |
| Unit: `cascades.test.ts`, `undo.test.ts`, `requirement.test.ts` | the card cascade and the undo parent | 2 |

**What I expect, not what I counted:** the list comes from reading the tests. Step 2 runs the full suite with REQ-104's
card in the seed and lists every test it actually changed.

### What in the PRD I think is wrong, unclear or costly

The questions A to F above are the main ones. Besides:
- **Item 2's middle part for entity items needs a domain change** (Q2: `entityGaps` split). Small, but it touches
  4b-1's coverage code. Unit tests cover it, and no panel text changes.
- **Item 25 touches about 36 e2e files that use “Customer & orders”** (Q9). Most will pass unchanged; the risky ones
  count nodes, fit the view or select all. Proposal: keep the card in the seed (as the prototype) and narrow selectors,
  not expectations, in step 2.
- **Item 14's “drag a row onto the canvas” and item 17's drag are two drag types.** A row dragged from an element
  panel onto an element places the card there, on top of the element. That is what the PRD says (“never a link”), but
  it may surprise. Proposal: as the PRD says; the hint reads “Place card” over elements too.
- **S4B2-13's baseline** (“within the baseline's spread for dragging an entity card”). 4b-1 recorded the drags as rAF
  figures, unverified as presented. Proposal: both drags measured as presented frames on the branch in every round.
  The spread is the entity drag's min to max over the three rounds; the requirement drag's median must lie in it or
  above.
- **S4B2-11's “within 5 %” may still miss after T3** (most of 4b-1's cost was the veil, not the lit lines: −6 to −8 %
  alone). The PRD already lets it end partly met; noted so the result is not a surprise.

### Docs plan (section 9)

| File | What | When | Approval |
| --- | --- | --- | --- |
| `docs/decisions.md` D-32 | requirement cards with dashed trace lines (ends, collapsed frames, layer switch, selection dimming per B); placing from panels and dragging from the left panel (link by drop, Undo); Focus lights and fades them (C) | step 6, after the Focus step | Łukasz approves the text first |
| `docs/decisions.md` D-34 | element panels' “Place card” icon, dragging a row places a card, “Add all” / “Add the {n} missing”; “Add to this canvas” on entity and table panels; a click on the name still opens the panel | step 4 | the same |
| `docs/decisions.md` D-41 | the bar's three parts over items (covered / mapped but not approved / not mapped, entity items included); 230 px; below 40 % header and block | step 2 | the same |
| `docs/decisions.md` AD-24 | trace lines in the one line layer; T3's outcome (the veil in the overlay's layer, or why not, with the LayerTree figures); the sitting's figures | step 8, after the closing sitting | the same |
| `docs/data-model-v2.md` | one sentence on what a requirement card stores (Q1) | step 2 | the same (CLAUDE.md) |
| `docs/known-limitations.md` | “Requirement cards are not on the canvas yet” closed; S4B1-11 and S4B1-12's rows updated with the sitting's figures; a new “Where the canvas stands after slice 4b-2” above 4b-1's; B (no dimming on a hover) under the C-10 entry | step 8; B in step 3 | none (corrections) |
| `docs/ideas.md` | “Add to this canvas” and “Project home: open the canvas that shows most of the requirement” resolved, with a link to the PRD; new: the description editor on a requirement card, “Show its requirements (n)” in row and card menus | step 8 | none |
| README, CLAUDE.md | slice status; requirement cards and trace lines in the canvas section; the seed's REQ-104 card and the “– requirements” canvas; new e2e helpers and test hooks | helpers per step; status in step 8 | none |
| this file | each step's results, the criteria table, changed earlier tests, the manual checklist | every step | – |
