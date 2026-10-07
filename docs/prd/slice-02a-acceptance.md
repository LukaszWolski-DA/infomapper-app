# Slice 2a – Acceptance

Status: **accepted by Łukasz on 7 October 2026**, merged into `main` with pull request #5, tag `slice-02a`. Branch `slice/02a-selection-and-canvases`, pull request #5.

## Criteria

Each criterion has its Playwright test in `e2e/slice-02a/`, named after its id; every test starts from a freshly seeded
data file and does not depend on another.

| ID | Test | Result |
| --- | --- | --- |
| S2A-01 | `S2A-01.spec.ts`: a real-mouse lasso around Customer and Sales Order, partly over Order Line; a Shift lasso adds order_line; a new lasso replaces; a click on the empty canvas clears | passes |
| S2A-02 | `S2A-02.spec.ts`: Shift+click adds and takes out; the box “3 selected”, the panel “2 entities, 1 table.” and its list; Ctrl+A selects all 7; Esc clears; Ctrl+A in a text field does not select cards | passes |
| S2A-03 | `S2A-03.spec.ts`: a three-card group and a line between two of them move by the same snapped amount; the positions survive a reload; a second move, then Ctrl+Z twice, each putting the whole group one move back | passes |
| S2A-04 | `S2A-04.spec.ts`: → by 8 px, Shift+↓ by 32 px, five quick ← in one undo step | passes |
| S2A-05 | `S2A-05.spec.ts`: the group toolbox's entries; a row of a selected card opens the row's own toolbox (assumption 10); Align left, Align top, Stack, Line up against `arrange()`, each undone by one Ctrl+Z; Fit widths equals each card's own “Fit width to names”, one undo step | passes |
| S2A-06 | `S2A-06.spec.ts`: the sources taken off with a lasso; “Add sources of selected entities” places them all without overlaps, one Ctrl+Z; the group removed from the toolbox and brought back with “Undo” in the toast | passes |
| S2A-07 | `S2A-07.spec.ts`: Hand tool by button and H, grab cursor, pans over a card and the empty canvas, selects and moves nothing; V and Esc; right drag, middle button and Space still pan | passes |
| S2A-08 | `S2A-08.spec.ts`: the copy after the original with the same layout, look and layer; a rename on the copy shows on the original; Ctrl+Z twice on the copy undoes the rename and the duplicate and returns to the original | passes |
| S2A-09 | `S2A-09.spec.ts`: last canvas disabled; delete of a canvas only in this project (cards gone, model kept), the next canvas opens; Ctrl+Z restores it; a shared canvas only leaves this project; its old address opens the first canvas with the toast | passes |
| S2A-10 | `S2A-10.spec.ts`: background and grid from the tab menu and the panel, drawn (colours, the grid element), per canvas, after a reload, untouched by Ctrl+Z; “Use this look on all canvases” sets every canvas, layers stay | passes |
| S2A-11 | `S2A-11.spec.ts`: Mappings and Relationships hide the other lines, cards stay; saved per canvas; Ctrl+Z does not change it | passes |
| S2A-12 | `S2A-12.spec.ts`: Customer and order_line list both canvases (“this canvas”, “in Order management”); a click switches the project with its toast, opens the canvas with Customer selected and in view | passes |
| S2A-13 | `S2A-13.spec.ts`: Piotr lassoes, Ctrl+A, pans and switches layers (not saved, gone after a reload); no tab menu, look section, group actions, drag or nudge; nine direct calls refused, nothing changed | passes |
| S2A-14 | `S2A-14.spec.ts` (group drag, lasso marks), `S2A-14-pan-zoom.spec.ts` with `scripts/measure-ab.ts` (pan and zoom against `main`) | pan and zoom: **met** (accepted as met in the production measurement build; the dev server misses for Lines at the overview, −8.9 %, and Dots at 100 %, −5.9 %); group drag 24.5 fps: **partly met**; lasso marks 139 ms in production: **partly met** (bar 100 ms); all three decided by Łukasz on 7 October |
| S2A-15 | CI (lint, typecheck, unit tests, Postgres migration check) and three full e2e runs in a row | passes: lint, typecheck, 502 unit tests; three full runs in a row on 7 October, 68 of 68 each (15.7, 15.5, 15.5 min), no dev server running; CI green on the pull request |

### Three full runs in a row

`npm run e2e` three times in a row on 7 October 2026 with no dev server running: 68 passed each time. Earlier attempts
the same day, and why they do not count: the first set ran while Łukasz's own `next dev` was on port 3000 (S0-10's
restarted server once took more than 5 minutes to start); in the second set S2A-06 failed once because the test pressed
Ctrl+Z before the page had taken in the step it had just made. The test now waits for the Undo button and uses it (the
same single undo step) and passed three times on its own before the final set.

## Measurements

### Group drag (S2A-14), quick check at step 3

`MEASURE=1 npx playwright test e2e/slice-02a/S2A-14.spec.ts` on 6 October 2026, the slice 1b method and laptop
(i7-8550U, Intel UHD 620), Google Chrome 154 headed, 1536 × 864, the dev server. “Performance test” (101 cards): a
lasso at about 20 % selects 31 cards, the view zooms in to 50 %, and one of them is dragged by its header in circles for
6 s.

| Measurement | Bar | Result |
| --- | --- | --- |
| Group drag, 31 cards at 50 % | ≥ 45 fps on average | **8.3 fps**, then 7.6 fps (22–23 frames over 50 ms) |
| For comparison: the same card dragged alone | – | 10.4 fps (31 frames over 50 ms) |

The bar is missed. Dragging a single card on this canvas is about as slow, so most of the cost is not the group. As the
PRD asks, nothing that changes behaviour was tried; the numbers and options went to Łukasz with the step 3 report.

### Step 3b: dev server and the measurement-only production build (AD-31), 6 October 2026

Same laptop and method (`MEASURE=1`, headed Chrome 154, 1536 × 864), before the speed-up. The production numbers come
from `npm run measure:build` and `MEASURE=1 MEASURE_BUILD=production npx playwright test <spec>`.

| Measurement | Bar | Dev server | Production |
| --- | --- | --- | --- |
| S2A-14 group drag, 31 cards at 50 % | ≥ 45 fps | 10.5 fps (step 3: 8.3, 7.6) | 14.2 fps |
| Single-card drag, same card | – | 10.0 fps (step 3: 10.4) | 11.8 fps |
| S1A-14 pan and zoom at the overview | ≥ 50 fps | 42.7 fps | 56.1 fps |
| S1A-14 pan and zoom at 100 %, dense area | ≥ 50 fps | 35.0 fps | 48.3 fps |
| S1A-14 initial render (C-08), median of 5 | ≤ 1.5 s | 4.9 s | 2.1 s |
| C-09 card resize, 200-row card at 50 % | ≥ 45 fps | 27.6 fps | 20.3 fps |
| C-10 hover to the next frame, median of 40 | ≤ 100 ms | 199 ms (commit 37 ms) | 166 ms (commit 6.7 ms) |
| S1B-10 pan and zoom at the overview, median of 3 | ≥ 52.8 fps | 51.4 fps | 53.3 fps |
| S1B-10 pan and zoom at 100 %, median of 3 | ≥ 47.0 fps | 41.9 fps | 45.6 fps |

Production halves the initial render and lifts panning and zooming, but the drags, the resize and the hover stay far
from their bars: the React work of a hover takes 6.7 ms in production, yet the frame after it takes 166 ms. Most of the
time is spent painting, not in JavaScript. Today's dev pan-and-zoom numbers are below slice 1b's (55.2 / 51.7 fps);
whether that is the laptop or slice 2a will show in S2A-14's pan-and-zoom check (step 4 and 5).

### Step 3b: after the speed-up (no change of behaviour)

What changed: while cards are dragged, `will-change` is off on the viewport, as for a resize (AD-24), so the moved cards
and lines repaint instead of the whole canvas layer; the line layer computes a line's geometry again only when one of
its cards moved or changed; a card's row positions are indexed once per card instead of on every line end; the Overview
keeps its miniature during a drag and redraws it on release (as the prototype); the selection's clean-up runs when the
set of cards changes, not on every frame.

| Measurement | Bar | Dev server, before → after | Production, before → after |
| --- | --- | --- | --- |
| S2A-14 group drag, 31 cards at 50 % | ≥ 45 fps | 10.5 → **15.8, 18.8** | 14.2 → **28.9, 29.5, 28.9, 24.7** |
| Single-card drag, same card | – | 10.0 → **25.2, 23.4** | 11.8 → **14.8, 9.3, 12.5, 19.5**; on a fresh page first: 21.5 |

The group drag in production doubles but stays below 45 fps. Single-card drags in production spread from 9 to 22 fps
between runs on this laptop; dev and production are within that spread. Still open: outlines instead of live lines
during the drag (behaviour, Łukasz decides), or recording the bar as partly met.

### Step 4: pan and zoom with the grid (S2A-14), 6 October 2026

`MEASURE=1 npx playwright test e2e/slice-02a/S2A-14.spec.ts -g grid` (and with `MEASURE_BUILD=production` after
`npm run measure:build`), same laptop and method. “Performance test”, pan and zoom for 10 s at the overview and at 100 %
in the dense area; grid None, Dots and Lines take turns in each of three runs; median of the three. Bars: slice 1b's
medians minus 5 % (overview 55.2 → **52.4 fps**, 100 % 51.7 → **49.1 fps**). None is the reference that separates the
grid's own cost from the laptop's spread.

| Session | None (overview / 100 %) | Dots | Lines | Dots vs None | Lines vs None |
| --- | --- | --- | --- | --- | --- |
| Dev, first version (grid as the pane's `background-position`) | 49.2 / 39.4 | 46.0 / 33.1 | 41.4 / 23.8 | −6.5 % / −16.0 % | −15.9 % / −39.6 % |
| Dev, grid on its own layer (a slow spell of the laptop) | 42.4 / 20.6 | 47.0 / 18.1 | 44.2 / 20.7 | +10.8 % / −12.1 % | +4.2 % / +0.5 % |
| Dev, grid on its own layer | 44.8 / 36.1 | 44.6 / 38.0 | 44.9 / 33.8 | −0.4 % / +5.3 % | +0.2 % / −6.4 % |
| Production, grid on its own layer | 45.6 / 48.2 | 48.2 / 43.6 | 44.1 / 40.0 | +5.7 % / −9.5 % | −3.3 % / −17.0 % |
| Production, grid on its own layer | 49.8 / 37.9 | 49.5 / 42.4 | 46.8 / 41.8 | −0.6 % / +11.9 % | −6.0 % / +10.3 % |

The first version moved the pane's background on every frame, so the whole pane repainted while panning. The grid now
is one element behind the pane, with the same CSS background, on its own layer: panning moves the layer by less than one
grid step (no repaint), zooming changes the step. That made Dots cost nothing measurable and Lines at most a few percent.
No session reaches the bars, **None included**; the default stays Dots.

**Is slice 2a the cause of the lower pan and zoom?** `main` (slice 1b) and this branch with grid None, measured in turns
in one sitting with the same pan-and-zoom steps (dev server, median of three runs each, overview / 100 %):

| Run | `main` | Slice 2a, grid None |
| --- | --- | --- |
| 1 | – (did not start) | 43.7 / 37.5 |
| 2 | 48.8 / 42.5 | 47.8 / 40.1 |
| 3 | 45.7 / 17.4 (a slow spell) | 49.7 / 41.3 |
| 4 | 49.1 / 45.5 | 49.4 / 44.0 |

`main` itself runs at about 49 / 43–45 fps today, well below the 55.2 / 51.7 fps slice 1b measured on the same laptop;
slice 2a is within the spread of `main`. So the drop is the laptop's state (other programs, heat), not slice 2a.

### Step 5: measuring conditions, 7 October 2026

Same laptop (Lenovo, i7-8550U, Intel UHD 620, 8 logical cores), Google Chrome 154 headed at 1536 × 864, `MEASURE=1`.
Łukasz prepared it: charger in (mains, battery 96 %), Windows power mode “Best performance” for plugged in and on
battery (checked in the registry: at first only “on battery” was set, and Spotify was still running and playing; both
were fixed before any measurement), screen and sleep “Never”, Spotify, Chrome, Acrobat, Teams, Outlook and OneDrive
sync closed or paused, his dev server stopped. Windows open during the measurements: this Claude app, Notepad++,
the touch-keyboard host. The processor time of every program was sampled for 3 s after each side of each round
(`scripts/measure-ab.ts`) and after each diagnosis run: the busiest was always the Claude app (0.7–4.3 % of all cores),
then PowerShell (the sampling itself, under 1 %); nothing else above 1.3 % (Explorer once, Google Drive once).

### Step 5: S2A-14 pan and zoom against `main` (changed criterion)

`npx tsx scripts/measure-ab.ts`: `main` and this branch in turns, two rounds per build, the side that starts changing
each round, three runs of the spike's pan-and-zoom steps per side and round (and per grid on this branch), at the
overview and at 100 % in the dense area of “Performance test”; median of all runs per cell. Production for `main` is
`main` with the measurement-only build added (commit eec0854, nothing of the canvas). Bar: this branch's median at most
5 % below `main`'s, for grid Dots and Lines (None is shown for reference).

**Repeated round.** The first production round was slow on both sides right after the two builds (`main` 43.6–50.6 fps
at 100 %, an outlier of 34.6 fps for the branch with Dots, against 49.8–54.5 in the second round). As Łukasz asked, it was
not averaged in: production round 1 was measured again (16:23–16:31) and replaced; it agreed with round 2. The dev rounds
showed no slow spell.

| Build | View | `main` | Branch, Dots | Branch, Lines | Branch, None |
| --- | --- | --- | --- | --- | --- |
| Dev | Overview | 52.7 | 51.6 (−2.1 %) | **48.0 (−8.9 %)** | 50.8 (−3.6 %) |
| Dev | 100 % | 42.1 | **39.6 (−5.9 %)** | 40.5 (−3.8 %) | 43.0 (+2.1 %) |
| Production | Overview | 57.3 | 57.0 (−0.5 %) | 56.0 (−2.3 %) | 56.9 (−0.7 %) |
| Production | 100 % | 51.8 | 51.2 (−1.2 %) | 50.4 (−2.7 %) | 51.7 (−0.2 %) |

Every run (fps), dev: `main` overview 53.3, 49.0, 49.8 · 52.4, 52.8, 52.7; 100 % 39.0, 42.1, 44.1 · 44.2, 40.6, 41.1.
Branch Dots overview 51.6, 45.0, 53.8 · 52.8, 50.7, 50.4; 100 % 37.3, 40.8, 36.5 · 37.3, 41.3, 39.6. Lines overview 47.5,
48.0, 50.6 · 47.7, 45.7, 52.4; 100 % 40.8, 38.0, 39.3 · 40.2, 40.5, 40.9. Production (round 2 · repeated round 1): `main`
overview 56.4, 58.7, 57.3 · 58.1, 55.3, 56.1; 100 % 54.5, 53.5, 49.8 · 51.8, 51.1, 46.8. Dots overview 58.0, 56.9, 55.0 ·
58.2, 57.0, 54.7; 100 % 53.1, 50.4, 51.2 · 51.5, 48.8, 51.0. Lines overview 57.2, 56.0, 56.7 · 53.9, 55.4, 51.5; 100 %
54.4, 50.4, 47.5 · 49.6, 52.0, 46.7.

**Result:** met in the production measurement build for both grids at both zoom levels. Missed on the dev server for
Lines at the overview (−8.9 %) and Dots at 100 % (−5.9 %); without a grid the dev server is within 5 % of `main`.
**Accepted by Łukasz as met in production** (7 October).

Absolute numbers next to slice 1b's medians, not judged (slice 1b measured the dev server only):

| View | Slice 1b (dev, 6 Oct) | `main` today, dev / production | Branch Dots today, dev / production |
| --- | --- | --- | --- |
| Overview | 55.2 | 52.7 / 57.3 | 51.6 / 57.0 |
| 100 % | 51.7 | 42.1 / 51.8 | 39.6 / 51.2 |

### Step 5: S2A-14 group drag and lasso marks

`MEASURE=1 npx playwright test e2e/slice-02a/S2A-14.spec.ts` (and `MEASURE_BUILD=production`).

| Measurement | Bar | Dev server | Production |
| --- | --- | --- | --- |
| Group drag, 31 cards at 50 % | ≥ 45 fps | 22.4 fps (36 frames over 50 ms) | 24.5 fps (31 over 50 ms) |
| Single-card drag, same card | – | 20.1 fps | 13.1 fps |
| Marks after a lasso around the view at the overview, median of 20 | ≤ 100 ms | **279.9 ms** (max 458.5) | **139.2 ms** (max 326.8) |

The lasso selects the 85 of the 101 cards that lie fully inside the view: at the overview the zoom is already at its
10 % minimum and the tallest cards stick out of the 1536 × 864 window, so no lasso can hold all 101. The lasso-marks bar
is missed in both builds; **recorded as partly met at 139 ms in production** (Łukasz, 7 October). The group drag stays
“partly met” (known-limitations.md).

### Step 5: diagnosis in the production measurement build

Measurement-only switches, honoured only by the measurement build (`?diag=`, `DIAG=` for the specs): (a) `nolines`, no
line layer at all; (b) `blocks`, every card drawn as its below-40 % block at any zoom. Two rounds each, the order reversed
in the second (normal → no lines → blocks, then blocks → no lines → normal); C-09 with blocks was measured right after
(its spec found the 200-row card by its rows; it now picks the tallest card).

| Measurement | Bar | Normal | (a) No line layer | (b) Cards as blocks |
| --- | --- | --- | --- | --- |
| Single-card drag at 50 % | – | 12.8, 12.8 fps | 13.9, 14.3 fps | **22.5, 27.2 fps** |
| Group drag, 31 cards at 50 % | ≥ 45 fps | 27.4, 24.7 fps | 22.2, 25.6 fps | 29.5, 33.8 fps |
| C-09 card resize, 200-row card at 50 % | ≥ 45 fps | 27.8, 31.6 fps | 29.6, 33.4 fps | **59.2, 56.7 fps** |
| C-10 hover to the next frame, median of 40 | ≤ 100 ms | 145.1, 153.3 ms (React 5.7, 5.3 ms) | **50.3, 47.3 ms** (React 5.0, 4.8 ms) | – (a block has no rows to hover) |
| C-10 hover sweep | – | 25.8, 25.7 fps | 30.6, 35.8 fps | – |
| S1B-10 pan and zoom, overview / 100 % | – | 55.3 / 50.1, 56.8 / 47.6 fps | 56.1 / 50.8, 58.8 / 53.1 fps | – |

**What recovers the frame rate:**
- **The hover (C-10) is the line layer.** Without it the frame after a hover comes in about 49 ms instead of about
  150 ms, well within the bar, with the same React work (about 5 ms). Drawing the hovered lines again above 340 others
  makes the browser repaint the large line layer.
- **Resizing and dragging are the cards' rows.** With every card as a block, the resize doubles to 57–59 fps (bar 45 met)
  and the single-card drag doubles; the group drag gains only about a fifth (it still moves 31 cards and their lines).
  Removing the lines barely changes the drags and the resize.
- So the short performance slice before 2b has two separate targets: the line layer for the hover (e.g. an HTML canvas
  for the lines, as AD-24 already names), and the number of row elements a moved or resized card repaints.

## Manual checklist (Łukasz)

On Customer & orders, signed in as Łukasz (`npm run dev`, http://localhost:3000), then as Piotr for the last line:

- [ ] **S2A-01** Draw a lasso from the empty canvas around Customer and Sales Order, partly over Order Line: only the two
  are marked. Hold Shift and lasso order_line: it is added. Click the empty canvas: the marks go.
- [ ] **S2A-02** Shift+click three cards, then one of them again; Ctrl+A; Esc. The dashed box says “N selected”, the
  right panel lists the cards and counts them by kind.
- [ ] **S2A-03** Drag one card of a three-card selection: all three and their lines move together. Ctrl+Z: all back.
  Move again, reload: the position stays.
- [ ] **S2A-04** With cards selected, tap → (8 px), Shift+↓ (32 px), then hold ← for a moment; one Ctrl+Z undoes the
  whole hold.
- [ ] **S2A-05** Right-click a selected card's header: the group toolbox. Try Align left, Align top, Stack in a column,
  Line up in a row, Fit widths to names, each followed by Ctrl+Z. Right-click a row of a selected card: the row's toolbox.
- [ ] **S2A-06** Take customers, web_users and order_header off with a lasso and “Remove from this canvas”; select
  Customer and Sales Order and click “Add sources of selected entities”: they come back beside their entities without
  overlaps. Remove the two entities and click “Undo” in the toast.
- [ ] **S2A-07** Press H (or the Hand button): drag over cards and empty canvas, the canvas moves, nothing is selected.
  V and Esc turn it off. Right drag, middle button and Space + drag still pan.
- [ ] **S2A-08** Tab ⋯ → Duplicate layout: “Customer & orders (copy)” opens next to the original, looking the same.
  Rename an entity on the copy, look at the original. Ctrl+Z twice on the copy: back on the original, the copy gone.
- [ ] **S2A-09** In Order management: delete Order lines & products (⋯ → Delete canvas), then Ctrl+Z; take Customer &
  orders out of Order management (⋯ → Remove from this project); open its old address: the first canvas opens with a
  toast. In Customer 360 the last item is greyed out.
- [ ] **S2A-10** ⋯ → Background and Grid, and the overview panel's “Canvas look”: change them, reload, Ctrl+Z (the look
  stays). “Use this look on all canvases”: the other canvas changes too.
- [ ] **S2A-11** All / Maps / Rels in the top bar: Maps hides the relationship lines, Rels the mapping lines. Another
  canvas keeps its own; Ctrl+Z does not change it.
- [ ] **S2A-12** Put Customer on Order lines & products; open Customer & orders from Customer 360, select Customer:
  “On canvases” lists both; click the other one: the project switches and Customer is selected in view.
- [ ] **S2A-13** As Piotr: lasso, Ctrl+A, Hand tool and the layer buttons work; no ⋯ on the tabs, no “Canvas look”, the
  group toolbox and panel offer only “Clear selection”; a reload shows the saved layer mode again.

## Assumptions

Decided with Łukasz during the slice:

1. **Look and undo (D-12).** When undo or redo checks whether a canvas row changed afterwards, a later change of only
   `canvas.look` does not count; a canvas row that is written back keeps its current look. Versions still rise and
   change events are still written for look changes (6 October).
2. **“Changed afterwards” compares content, not version** (a fix of slice 1b's undo). A row counts as changed when its
   content differs from what the step left, ignoring `version`, `updated_at`, `updated_by` and, for a canvas, `look`;
   the write still carries the row's current version (AD-12). So steps can be undone one after another on the same
   row. **A row someone changed and changed back (A-B-A) counts as unchanged**, and the undo goes through (6 October).
3. **AD-24 and the grid.** AD-24's “no dotted background” becomes “no React Flow `<Background>` component; a grid is
   one CSS background on its own element behind the canvas pane, and must pass the pan-and-zoom regression check”
   (step 4, wording settled at step 5, 7 October).
4. **“On canvases”.** A canvas that is in several projects opens in the first of them, as in the prototype (6 October).

Assumed while building, accepted at step 1:

5. **Where a duplicate goes.** The copy's link takes the original's sort order; tabs with the same order follow when they
   were added, so the copy sits right after the original without renumbering the other tabs.
6. **“Use this look on all canvases”** copies background and grid; the layer mode stays each canvas's own (D-22), as in
   the prototype.
7. **Arranging on the grid.** The prototype's align, stack and line up do not snap; here every arranged position is
   rounded to the 8 px grid before it is saved (the domain requires it), and the gaps of a column (32 px) and a row
   (64 px) are rounded up, so they never shrink.
8. **One command for the tab menu's last item** (D-28): it takes the canvas out of this project or deletes it,
   depending on whether another project has it.

Assumed while building, accepted at step 3:

9. **“Add sources of selected entities”** places each entity's missing feeding source tables beside that entity's own
   card, as PRD item 9 says. The prototype stacks them beside the whole group instead. A table feeding several selected
   entities is placed once, beside the first of them from top to bottom.
10. **A right-click on a selected card** opens the group's toolbox from the card's header or body (outside its rows)
    while two or more cards are selected; on a row it opens that row's own toolbox. D-52 wins over the prototype, whose
    `ctxFor` gives the group's toolbox on rows too (Łukasz, 6 October).

Assumed while building step 4, accepted at step 5 (7 October); 12 as changed by Łukasz:

11. **A reviewer's or reader's layer mode** lasts while the canvas stays open in that browser tab; it is not saved and
    not kept in the browser's storage, so a reload or another canvas shows the saved mode again.
12. **A canvas address that is no longer in the project** opens the project's first canvas instead of “not found”, with
    the toast “This canvas is no longer in {project}. Opened {canvas}.” Your own actions open the right canvas without
    that toast: deleting or taking out the open canvas opens the project's next one (prototype `delDia`), and undoing a
    duplicate while the copy is open returns to the original, as in the prototype; only if the original is gone too,
    the first canvas. (How: the action remembers the canvas to open for a minute in a cookie, and the page drawn as the
    action's result uses it; `src/app/_lib/next-canvas.ts`, `src/domain/model/next-canvas.ts`.)
13. **Look controls are for editors only**: the tab menu was already editors-only; the overview panel's “Canvas look”
    section is not shown to reviewers and readers. The layer buttons are there for everyone (PRD item 17).
14. **Short labels** All / Maps / Rels below a window width of 2100 px, the prototype's breakpoint; on the development
    laptop they are always short.
15. **The layer mode hides lines everywhere on the canvas**: in the line layer, the hover emphasis and the Overview.
16. **“On canvases”** sits above the panel's actions, as in the prototype; its click selects the card on the other
    canvas and brings it into view with the canvas's remembered zoom (prototype `centerOn`).

## Changes to this slice's criteria

- **S2A-14, pan and zoom** (decided by Łukasz, 7 October 2026). Was: with grid Dots and with grid Lines, each no more than 5 % below slice 1b's medians
  (overview 55.2 fps, 100 % 51.7 fps). Now: no regression against `main`, measured in turns with this branch in the same
  sitting; the medians within 5 %, at the overview and at 100 %, on the dev server and in the production measurement
  build. The absolute numbers are recorded next to slice 1b's without judging them, with the measuring conditions.
  Reason: the laptop's own speed changes from day to day by more than 5 % (`main` itself measured 42–53 fps where slice 1b
  measured 51.7–55.2), so only a comparison in the same sitting says whether the slice made things slower.
- **S2A-14, lasso marks** (found while measuring, confirmed by Łukasz on 7 October). The criterion says “a lasso around every card at the overview”; on the 1536 × 864 window the
  tallest cards of “Performance test” stick out of the view even at the 10 % minimum zoom, so the lasso holds the 85
  cards fully inside the view (recorded with the result).

## Changes to tests of earlier slices

Deliberate, because slice 2a changes the behaviour they check:

- **S1B-14** (reviewer): the empty canvas's toolbox now offers “Select all”, “Fit everything on screen” and “Hand tool”
  (was only “Fit everything on screen”), because PRD items 8 and 17 give these to every role.
- **S0-10** (restart): it now waits up to 5 minutes for its own cold dev server (was about 2), warms the canvas page
  after the restart, and leaves the page before restarting, so the old page's dev client cannot reload it in the middle
  of the next navigation. Its steps and checks are unchanged (step 0).
- **S1A-14, S1B-09, S1B-10** (measurements): the canvases of “Performance test” now draw the default grid Dots, so these
  measurements include it from step 4 on. Their steps and bars are unchanged.
- **S1B-09** (measurement): it now finds the 200-row card as the tallest card instead of the one with the most row
  elements, and checks its 200 rows only when rows are drawn, so slice 2a's diagnosis can run it with `DIAG=blocks`.
  For a normal run nothing changes.
