# Slice 2a – Acceptance

Status: in progress (steps 0–3 done). Branch `slice/02a-selection-and-canvases`, pull request #5. The criteria table,
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
