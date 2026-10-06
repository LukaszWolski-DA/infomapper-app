# Slice 2a – Acceptance

Status: in progress (steps 0–3 and the performance detour 3b done). Branch `slice/02a-selection-and-canvases`, pull request #5. The criteria table,
the measurements, the three runs in a row and the manual checklist are filled in at step 5.

## Measurements so far

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
   one CSS background on the canvas pane and must pass the pan-and-zoom regression check”, changed with the grid code
   in step 4 (6 October).
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

## Changes to tests of earlier slices

Deliberate, because slice 2a changes the behaviour they check:

- **S1B-14** (reviewer): the empty canvas's toolbox now offers “Select all”, “Fit everything on screen” and “Hand tool”
  (was only “Fit everything on screen”), because PRD items 8 and 17 give these to every role.
- **S0-10** (restart): it now waits up to 5 minutes for its own cold dev server (was about 2), warms the canvas page
  after the restart, and leaves the page before restarting, so the old page's dev client cannot reload it in the middle
  of the next navigation. Its steps and checks are unchanged (step 0).
