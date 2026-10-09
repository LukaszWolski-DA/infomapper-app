# Slice 2b – Acceptance

Status: **waiting for Łukasz's acceptance**. Branch `slice/02b-frames`, pull request #7 (draft, not merged).

## Criteria

Each criterion has its Playwright test in `e2e/slice-02b/`, named after its id; every test starts from a freshly seeded
data file and does not depend on another. Frames a test starts from are made through the domain (`makeFrame` in
`e2e/slice-02b/helpers.ts`, as the Frame tool would); what the criterion checks goes through the page with the real
mouse and keyboard.

| ID | Test | Result |
| --- | --- | --- |
| S2B-01 | `S2B-01.spec.ts`: A, then a drag from above left of Customer to below Sales Order, over Order Line (already in the frame “Lines”): a free frame “New frame” in the first free colour, snapped to 8 px, selected, its name field focused; Customer and Sales Order are in it, Order Line stays in “Lines”; the tool is off; the typed name is saved | passes |
| S2B-02 | `S2B-02.spec.ts`: Order Line dropped with the middle of its header inside the frame joins it and the frame grows to 24 px below it; dropped right of Customer it is in no frame; inside a large and a smaller overlapping frame it joins the smaller one | passes |
| S2B-03 | `S2B-03.spec.ts`: the panel sets the frame to Concept, then Sales: the chip “1 misplaced” and “Customer is in Customer” under “Doesn't belong here”; “Move to Sales” moves it in the model, Ctrl+Z back; Customer into a frame of its own concept: no question; back into the Sales frame: the question, “Keep in Customer” leaves it marked; Sales Order and Order Line dropped together into the Customer frame: one question for both, “Move to Customer” moves both, one Ctrl+Z puts back the drop and both concepts | passes |
| S2B-04 | `S2B-04.spec.ts`: a drag on the frame's name moves the frame and its two cards by the same snapped amount, a mapping line's Customer end follows and its customers end stays; one Ctrl+Z puts all back; a drag on an empty spot inside moves it again; after a reload frame and cards are drawn where saved | passes |
| S2B-05 | `S2B-05.spec.ts`: the handle to 600 × 880: free Sales Order joins, Order Line (in “Lines”) is not taken; back to 304 × 400: Sales Order is released, Customer stays | passes |
| S2B-06 | `S2B-06.spec.ts`: Shift + drag from an empty spot inside the frame adds Customer to web_users, the frame does not move; right drag, middle button and Space + drag from inside pan (no toolbox), the wheel pans, Ctrl + wheel zooms; a right click without moving opens the frame's toolbox: Rename…, Fit frame to its content, Select its cards, Zoom to frame, Delete frame (keeps its cards) | passes |
| S2B-07 | `S2B-07.spec.ts`: a Customer concept frame around Customer and customers: the chips mapped, used, type, drafts and “1 misplaced” as counted from the model in the test; the panel's sentence with the same counts, its two cards, customers under “Doesn't belong here” (“system CRM”); the canvas overview lists the frame with “2 cards” | passes |
| S2B-08 | `S2B-08.spec.ts`: a lasso around the whole frame selects the frame only; with web_users (Shift+click) “1 table, 1 frame.”, one frame mark and one card mark; group drag, nudge (→, Shift+↓), Align left, Stack in a column (64 px after the frame), Line up in a row move the frame with its cards; Ctrl+A marks the frame and the 5 cards in no frame (“1 entity, 4 tables, 1 frame.”); Shift+click on an empty spot inside and on the name take the frame out and put it back | passes |
| S2B-09 | `S2B-09.spec.ts`: Customer and Customer Address (toolbox) → a Customer concept frame 32 px around them, 40 above; customers and customer_addresses (panel) → a CRM source frame, web_users inside its rectangle not taken; Order Line and order_line → a free frame; Sales Order's card panel “Put in a new concept frame” → a Sales concept frame, then the card panel links to it | passes |
| S2B-10 | `S2B-10.spec.ts`: Delete on the selected frame: the toast, no frame, both cards in place in no frame; Undo in the toast: the frame with both members | passes |
| S2B-11 | `S2B-11.spec.ts`: “Arrange into frames by concept and system” builds CRM, ERP, WEB on the left and Customer, Sales on the right at the prototype's positions (worked out in the test), every card in its frame, the free frame “Notes” unchanged; one Ctrl+Z restores the layout, only “Notes” stays | passes |
| S2B-12 | `S2B-12.spec.ts`: E and a click inside the Sales frame: a new entity of Sales in that frame; deleting the concept Temp in the left panel turns its frames on Customer & orders and on Order lines & products into free frames (name, place, the concept's colour kept); Duplicate layout: the copy's frames match the original's with new ids, every card in the copy of its frame | passes |
| S2B-13 | `S2B-13.spec.ts`: Łukasz uses each frame write once; Piotr: no Frame tool, handles or arrange button, A does nothing; selecting a frame shows a read-only panel with only “Zoom to frame” (which zooms); its toolbox offers “Select its cards” and “Zoom to frame”; dragging, Delete, Ctrl+A and arrow keys change nothing; the eight frame actions called directly are refused with “As a reviewer you cannot change what is on a canvas.” and change nothing | passes |
| S2B-14 | quick `measure:canvas` rounds on “Performance test” with its 8 frames against `slice-02p` | **met after a fix**: the first round missed pan and zoom (−20.8 % at the overview, −35.4 % at 100 %); the frame names' zoom variable restyled the whole canvas on every zoom step. With it set on the frame layer only: ±0.0 % at the overview, −4.2 % at 100 % (bar: within about 10 %); group drag −3.8 % (first round). Details below |
| S2B-15 | CI (lint, typecheck, unit tests, Postgres migration check with `frame` built) and three full e2e runs in a row | passes: lint, typecheck, 601 unit tests; three full runs in a row on 8–9 October, 81 of 81 each (18.2, 16.4, 16.3 min), no dev server running; CI green on the pull request |

### Three full runs in a row

`npm run e2e` (81 tests: slices 0 to 2b) with no dev server running. The rule: three passing runs in a row, and after any
test change the three runs start again.

| Set | Runs | What happened |
| --- | --- | --- |
| 1 (8 October, evening) | 1 | S2B-08 failed: right after a Ctrl+Z the page still drew web_users at its stacked place, so “Line up in a row” sorted from that. The test now waits until the page draws the undone layout (`expectDrawnAt`), as the slice 2a helpers advise; it then passed three times on its own. Test change: the sets start again. |
| 2 | 1 | S0-10 (slice 0, restart) timed out at its first sign-in on its own cold dev server (the workspace page took over 15 s to compile), the known slow cold start on this laptop (slices 1a and 1b). No change. |
| 3 | 3 | Runs 1 and 2 passed (81/81); run 3: S2A-10 (slice 2a, look) timed out waiting for its third look save. The trace shows all three saves sent in order and the dev server answering the first after 10.7 s and the second after 2.9 s; the third had no answer yet when the 15 s wait ended. Nothing was refused or lost; slice 2b does not touch the look. No change. |
| 4 (8–9 October, 23:13–00:04) | 3 | **81 passed each time** (18.2, 16.4, 16.3 min). |

## S2B-14: rounds against slice 2p

### First round: frames as built

`npm run measure:canvas -- --rounds 1 --against slice-02p` on 9 October 2026, 07:57–08:10, sitting
`.data/measure/2026-10-09-07-57`: this branch (d038f54) against `slice-02p` (cc8005a), production measurement build,
headed Chrome, 1536 × 864, the development laptop (the reference machine, AD-24). One full round rather than `--quick`,
because `--quick` leaves out the group drag that S2B-14 asks for.

**Conditions:** mains power, Windows power mode “Best performance”, screen and sleep “Never”; Teams, Chrome, Spotify,
Outlook and Explorer windows closed, OneDrive paused (Łukasz). Before each side the machine was quiet (reference: 0.4 %
after 75 s; branch: 0.6 % after 42 s); windows open: only Claude and the Settings app. On `slice-02p` “Performance
test” has no frames; on this branch it has the 8 frames `seed:large` stores.

| Figure | Bar | slice-02p | This branch | Change | Result |
| --- | --- | --- | --- | --- | --- |
| Pan and zoom at the overview (S1A-14, grid Dots) | ≥ 50 fps, ≥ −5 % vs reference | 54.2 | 42.9 | −20.8 % | not met (below the reference) |
| – frames over 50 ms | 0 | 0 | 23 | – | not met |
| Pan and zoom at 100 %, dense area (S1A-14) | ≥ 50 fps, ≥ −5 % vs reference | 47.7 | 30.8 | −35.4 % | not met (below the reference) |
| – frames over 50 ms | 0 | 4 | 54 | – | not met |
| Initial render (C-08), median of 5 | ≤ 1500 ms | 1407 | 1408 | +0.1 % | met |
| Card resize, 200-row card at 50 % (C-09) | ≥ 45 fps | 33.9 | 34.3 | +1.2 % | not met (as before) |
| Hover to the next frame, median of 40 (C-10) | ≤ 100 ms | 137 | 133 | −3.3 % | not met (as before) |
| Single-card drag at 50 % | ≥ 45 fps | 14.6 | 11.9 | −18.5 % | not met (as before) |
| Group drag, 31 cards at 50 % | ≥ 45 fps | 26.5 | 25.5 | −3.8 % | not met (as before) |
| Marks after a lasso around the visible cards, median of 20 | ≤ 100 ms | 98 (85 cards) | 112 (4 frames, 54 cards) | +13.6 % | not met |

**Reading.** S2B-14 asks for pan and zoom and group drag within about 10 % of slice 2p (the method's spread for one
round). Group drag is within (−3.8 %). Pan and zoom are not: about a fifth slower at the overview and a third slower at
100 %, with many frames over 50 ms where slice 2p had none or few, and the conditions were clean. The frames are the only
difference on this canvas, so they cost the pan and zoom; the single-card drag (−18.5 %) points the same way. Where the
time goes (the frame layer's painting, its labels resized on every zoom through `--iz`, or the large frame fills) is
not measured yet; slice 2p's `DIAG` switches show how such a diagnosis is done. The lasso-marks figure is not comparable
one to one: the lasso now catches 4 frames and 54 cards instead of 85 cards.

### Diagnosis (9 October, by reading the code; Łukasz asked for it bounded to one quick round per variant)

- The frame layer is inside React Flow's transformed viewport (`.react-flow__edgelabel-renderer`, beside the cards), so
  panning and zooming move it on the compositor; no JavaScript or React positions it per frame, and a pan changes
  nothing about it.
- Frame fills and outlines are static colours mixed in CSS; nothing changes their style per frame.
- **The frame names** keep their size on the screen through `--iz` (1 / zoom). It was set on the canvas root
  (`.im-canvas`) on every zoom change, so on each zoom step (one per frame in the measurement's zoom segments) Chrome
  restyled the whole canvas, every card and row, because an inherited variable had changed above them; the names were
  laid out again as well (their `max-width` depends on `--iz`). Only the names (`.f-lab`) and the resize handles
  (`.f-rs`) read it; the “N selected” label scales itself through React and the hover dots do not use it.

**The fix** (ac757df, normal code, nothing visible changes): `--iz` is set on the frame layer's own element when the
zoom changes, so a zoom step restyles only the frame names and handles. Measuring-only switches `DIAG=noframes` and
`DIAG=nolabels` were added for the diagnosis (06d4510, measurement build only, as slice 2a's).

### After the fix

`npm run measure:canvas -- --quick --rounds 1 --against slice-02p` on 9 October, 08:54, sitting
`.data/measure/2026-10-09-08-54`, this branch at ac757df; the same conditions as the first round (Łukasz prepared the
laptop again; both sides quiet before measuring: 1.2 % and 1.0 %).

| Figure | Bar | slice-02p | This branch | Change | Result |
| --- | --- | --- | --- | --- | --- |
| Pan and zoom at the overview (S1A-14, grid Dots) | ≥ 50 fps, ≥ −5 % vs reference | 58.9 | 58.9 | ±0.0 % | met |
| – frames over 50 ms | 0 | 0 | 0 | – | met |
| Pan and zoom at 100 %, dense area (S1A-14) | ≥ 50 fps, ≥ −5 % vs reference | 55.2 | 52.9 | −4.2 % | met |
| – frames over 50 ms | 0 | 4 | 8 | – | not met (slice 2p misses it too) |
| Initial render (C-08), median of 5 | ≤ 1500 ms | 1417 | 1461 | +3.1 % | met |
| Hover to the next frame, median of 40 (C-10) | ≤ 100 ms | 134 | 132 | −0.9 % | not met (as before) |
| Marks after a lasso around the visible cards, median of 20 | ≤ 100 ms | 95 | 90 | −5.0 % | met |

S2B-14 is **met**: pan and zoom within about 10 % of slice 2p (±0.0 % and −4.2 %); group drag was already within in the
first round (−3.8 %), and the fix only takes work away from zooming. Both sides were faster in this sitting than in the
first (slice 2p 58.9 against 54.2 fps at the overview): the laptop's own spread, which is why each figure is compared with
slice 2p in the same sitting.

### The `noframes` round did not give figures

`--branch-diag noframes` (sitting `2026-10-09-08-24`, also at ac757df) stopped without a summary, for two reasons in the
measuring tools, not the application: (1) `--quick` ran every e2e spec, because on Windows the specs run through a shell
that does not quote arguments and `--grep-invert dragging a group` became a filter plus the file filters “a” and
“group” (slice 2p's tool; fixed: the filter is now the one word `dragging`; the after-the-fix round above ran the extra
specs too, which made it longer but measured pan and zoom with the same spec as always); (2) with `noframes` the lasso
still selects the frames, which are in the data, while S2A-14's lasso-marks test counts only frames drawn on the page, so
it waited for marks that never came. As the fix met the criterion, the `noframes` and `nolabels` rounds were not repeated
(Łukasz: skip `nolabels` unless the fix does not help).

### Tests that failed once, not caused by frames

Seen in sets 2 and 3 above, each once, each passing in every other run of this slice; neither test checks frames:

- **S0-10** (slice 0, restart): a slow cold start of its own dev server; the first sign-in waited more than 15 s for the
  workspace page to compile. Known on this laptop since slices 1a and 1b.
- **S2A-10** (slice 2a, look): a slow server reply; the dev server answered the first two look saves after 10.7 s and
  2.9 s, so the third had no answer within the test's 15 s. Nothing was refused or lost.

## Manual checklist (Łukasz)

On Customer & orders, signed in as Łukasz (`npm run dev`, http://localhost:3000), then as Piotr for S2B-13:

- [ ] **S2B-01** Press A (or the Frame button) and drag around Customer and Sales Order: “New frame” appears selected,
  its name ready to type. Type a name, Enter. Draw a second frame over the first one: the first one's cards stay there.
  A click without dragging makes a 480 × 320 frame; Esc while drawing cancels.
- [ ] **S2B-02** Drag Order Line into the frame: it joins and the frame grows around it. Drag it out: in no frame. Draw a
  small frame inside a large one and drop a card in both: it joins the small one.
- [ ] **S2B-03** Set the frame to Concept → Sales: Customer gets “misplaced” in the label and “Doesn't belong here” in
  the panel; “Move to Sales”, then Ctrl+Z. Drag an entity of another concept into a concept frame: the question; Keep.
  Select two such entities and drop them together: one question.
- [ ] **S2B-04** Drag a frame by its name, then by an empty spot inside it: the cards and their lines go along. Ctrl+Z,
  reload.
- [ ] **S2B-05** Resize a frame with its bottom-right handle: free cards whose header middle ends up inside join, cards
  outside leave, cards of another frame are never taken.
- [ ] **S2B-06** Inside a frame: Shift + drag (lasso adds), right drag, middle button, Space + drag, the wheel and Ctrl +
  wheel; a right click opens the frame's toolbox.
- [ ] **S2B-07** The label's chips and the panel's sentence agree with the cards in the frame.
- [ ] **S2B-08** Lasso a whole frame: the frame is selected, not its cards. With a card added, try group drag, arrow
  keys, Align left, Align top, Stack in a column, Line up in a row; Ctrl+A; Shift+click inside a frame and on its name.
- [ ] **S2B-09** “Put in a new frame” on two entities of one concept, on two tables of one system, on a mix; a card's
  panel “Put in a new concept frame”.
- [ ] **S2B-10** Delete a frame (Delete key or toolbox): its cards stay; Undo in the toast.
- [ ] **S2B-11** The canvas overview's “Arrange into frames by concept and system”, then Ctrl+Z.
- [ ] **S2B-12** The Entity tool inside a concept frame; delete a concept that has frames (they become free frames on
  every canvas); Duplicate layout copies the frames.

And the definition of done: organise Customer & orders into frames by hand (a concept frame, a source frame, a free
frame), move and resize them, use “Arrange into frames”, and undo it.

## Assumptions

### Decided with Łukasz at step 1 (8 October)

1. **Membership after any change of position or width.** A drop, card resize, “Fit width(s) to names”, align, stack,
   line up and nudge all decide the card's frame again (smallest frame under the middle of its header), and the frame
   grows to hold a card that joined it. The concept question (D-05) is asked only on a drag drop; otherwise an entity
   of another concept is only marked as misplaced.
2. **A drawn frame smaller than 160 × 96** becomes the 480 × 320 default, centred on the drag.
3. **A new free frame** takes the first of the six free colours.
4. **“Put in a new concept / source system frame”** from a card also takes the free cards fully inside the new frame
   (D-06); “Put in a new frame” for a selection takes only the selection.
5. **Changing what a frame stands for** renames it only when its name is the default (“New frame”) or the previous
   concept's or system's name; a typed name is kept (assumption).
6. **Arrange order** follows the left panel: systems by name, a system's tables by `database.schema` group (in order of
   first appearance) and then by name (made exact at step 4), concepts in panel order, entities by name.
7. **Nudged cards** get their frame decided again when the nudge is saved; cards inside a moved frame move with it and
   keep their frame.
8. **The concept move after a drop** uses the entity as stored at that moment.
9. **A deleted concept's frames** keep its colour as their free colour; no swatch is marked then. (At step 5 S2B-12
   found that a frame which still held a colour from its time as a free frame took that colour back; it now always
   keeps the concept's colour, the one it was drawn in.)

### Step 2 (decided and accepted)

10. **Frames are their own layer** under the lines and cards, not React Flow nodes or parents; where frames overlap the
    smaller one is on top. Cards, rows and lines are always hit before a frame; only a frame's name strip, its resize
    handle and its empty area count as the frame.
11. **Gestures:** a left drag on the name or an empty spot moves the frame with its cards; Shift + drag inside a frame
    draws an adding lasso; right drag, middle button, Space + drag and the wheel pan; a right click opens the frame's
    toolbox.
12. **Frame fills** are a 7 % mix of the colour with transparent, without `opacity` (AD-24 kept).

### Step 3 (assumed, accepted)

13. **Switching to Concept or Source system** without choosing one takes the first card's concept or system, else the
    first in the list.
14. **A link in “Frames on this canvas”** selects the frame and zooms to it; the link in a card's “Frame” section only
    selects it.
15. **Esc in the concept question** means “Keep”.

### Step 4 (assumed or answered, accepted)

16. **A single selected frame** can be nudged with the arrow keys, as in the prototype.
17. **The group toolbox for a selection of frames only** offers align, stack, line up and “Clear selection”; fit widths,
    “Put in a new frame”, “Add sources” and “Remove from this canvas” appear only when cards are selected (they act on the
    selected cards only).
18. **Counts in the prototype's order**: entities, tables, frames (“1 entity, 4 tables, 1 frame.”) (answer 1).
19. **A Shift+click without moving on an empty spot inside a frame** adds the frame to the selection or takes it out,
    consistent with a plain click selecting it there (D-14); Shift + drag there still draws the adding lasso. A small
    deviation from the prototype, where only the name toggles (answer 2).
20. **The group toolbox's heading** stays “N items selected” (frames counted in N); the kinds are counted in the panel
    (answer 3).

## Changes to tests of earlier slices

Deliberate, because slice 2b changes the behaviour they check:

- **S2A-14** (group drag): its lassos start with Shift, because “Performance test” now has frames and a plain drag that
  starts inside a frame moves the frame (D-14), while Shift + drag draws a lasso there too (D-15) (step 2).
- **S2A-14** (lasso marks): a lasso around the view now catches whole frames, which stand for their cards (D-17); the
  test expects one mark per caught frame and one per caught card outside them (step 4).
- **S2A-05** (group toolbox): the group's toolbox now also offers “Put in a new frame” (PRD item 12) (step 3).
