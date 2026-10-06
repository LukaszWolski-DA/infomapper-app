# Slice 1b – Acceptance

Branch `slice/01b-modeling-on-canvas` · PRD: [slice-01b-modeling-on-canvas.md](slice-01b-modeling-on-canvas.md) ·
Pull request #3 (draft) · Status: ready for acceptance by Łukasz; **S1B-09 and S1B-10 are partly met** on the
development laptop (C-09 and C-10; see [Performance](#performance-s1b-09-s1b-10))

Every end-to-end test starts from freshly seeded data (the fixture in `e2e/slice-01b/fixtures.ts` is slice 0's: it
resets `.data/e2e-db.json` before each test), so no test depends on another. The undo history lives in the server's
memory; steps whose change group is no longer in the reseeded data are left out, so every test also starts with an
empty history. Tests that need more data make it themselves through the domain (`asLukasz`, `asUser` in
`e2e/slice-01b/helpers.ts`): S1B-05 a combined mapping, S1B-08 a Customer card on a second canvas, S1B-11 a third
feeding source, S1B-12 a change by Anna in another session; S1B-09 and S1B-10 add the “Performance test” workspace.

Results from 5 October 2026: `npm run lint`, `npm run typecheck` and `npm test` (437 unit tests) pass; full e2e runs
(slice 0, 1a and 1b, 50 tests each) are in [Three runs in a row](#three-runs-in-a-row).

## Criteria and tests

| ID | Criterion | Test(s) | Result |
| --- | --- | --- | --- |
| S1B-01 | Dragging `customers.segment` onto `Customer.segment_code` creates a direct mapping and its line | e2e `S1B-01.spec.ts`: real mouse drag from the column row to the attribute row; toast, one direct draft mapping with that input, its line, the mapping panel open | Pass |
| S1B-02 | `web_users.cust_no` onto `Customer.customer_number` pre-selects “Separate mapping”, Enter creates a second mapping; `customers.lname` onto an attribute mapped from `customers.fname` pre-selects “Add to mapping” and asks for a rule | e2e `S1B-02.spec.ts`: the popover's options and pre-selection, Enter, a second direct mapping; then “Add to mapping customers.fname” pre-selected, the column waiting in the mapping panel with the rule note, saved with a rule as a transform with both inputs in order; unit `mapping-choice.test.ts` | Pass |
| S1B-03 | Dropping `order_line.price` on the Order Line header creates attribute `price` (decimal with the column's precision and scale) and a direct mapping | e2e `S1B-03.spec.ts`: drop on the header; `price` decimal(10,2), one direct mapping from the column, the new row on the card; its precision and scale fields (and a string's length) fit the right panel at 340 px and at its narrowest, 280 px, wrapping under the type ([finding 3](#findings-from-the-definition-of-done)); a column dropped on a header whose entity has an attribute of its name maps to it, with the D-48 choice when it has a mapping ([assumption 11](#assumptions)); unit `mapping-choice.test.ts`, `type-check.test.ts` (the type table in reverse), `attribute.test.ts` | Pass |
| S1B-04 | “Map to an attribute” in the column panel creates the mapping | e2e `S1B-04.spec.ts`: the column panel's picker, the mapping and its line | Pass |
| S1B-05 | Split turns a combined mapping into one mapping per input; merge turns two mappings of one attribute into one transform after a rule is given | e2e `S1B-05.spec.ts`: split of a two-input mapping into two direct ones; merge of Customer.email's two mappings refused without a rule, then a transform in review with both inputs; unit `mapping.test.ts` | Pass |
| S1B-06 | Relate from Customer to Country creates a relationship; the panel sets its label and ends | e2e `S1B-06.spec.ts`: Country placed from the left panel, relate button, click on Country; default ends 1 to 0..n; label and both ends set in the panel; unit `relationship.test.ts` | Pass |
| S1B-07 | The Entity tool and “New entity here” create an entity at the clicked spot with the name ready to type; the toolbox offers the actions listed for each kind of item | e2e `S1B-07.spec.ts`: Entity tool click (card at the click − 24, − 20, within the 8 px snap), name focused and typed; “New entity here”; the toolbox's actions on the empty canvas, a card, an attribute row, a column row, a mapping line and a relationship line; a row's toolbox has exactly that row's actions and no card actions (D-52); “Collapse card” turns into “Expand card” on a collapsed card and expands it ([findings 1 and 2](#findings-from-the-definition-of-done)) | Pass |
| S1B-08 | Ctrl+↑ moves an attribute up, Ctrl+Shift+↓ to the bottom; panel drag reorders; lines follow; the order is the same on every canvas and after reload | e2e `S1B-08.spec.ts`: both keys, the flash, the line end on the moved row, a drag in the entity panel, the order after reload and on a second canvas; unit `attribute.test.ts` (reorder in one change group) | Pass |
| S1B-09 | Card width by dragging the edge and by “Fit width to names”, per canvas; on “Performance test” resize at 45 fps or better on average (C-09) | e2e `S1B-09.spec.ts`: the outline while dragging, the width on release (snapped to 8 px), double-click and toolbox fit, a different width for Order Line on the other canvas, after reload; C-09 with `MEASURE=1` | **Partly met**: the behaviour passes; C-09 24.0–32.1 fps (bar 45) – see [Performance](#performance-s1b-09-s1b-10) |
| S1B-10 | Hovering a row highlights its lines and far-end rows within 100 ms on “Performance test” (C-10); pan and zoom do not regress against slice 1a | e2e `S1B-10.spec.ts`: hovering Customer.email marks its row and both far-end rows and draws its dots in the overlay, draws its two lines again above the others, fades nothing and restyles no card; C-10 and three pan-and-zoom runs with `MEASURE=1` | **Partly met**: the behaviour and pan and zoom pass (55.2 / 51.7 fps against 52.8 / 47.0); C-10 169 ms median (bar 100) |
| S1B-11 | “Add the N missing to this canvas” places Customer's missing sources to the left of its card without overlaps | e2e `S1B-11.spec.ts`: with a third feeding source on the canvas, “Add the 2 missing” places both 160 px left of Customer from its top down; no two cards overlap; a fed entity clicked in the source table panel lands on the table's right; unit `canvas.test.ts` (`besideSpots`), `canvas-item.test.ts` (several cards in one change group) | Pass |
| S1B-12 | Undo and redo: create, edit, move, reorder and delete are each undone with Ctrl+Z and redone; undo is refused with the message when another session changed the row afterwards | e2e `S1B-12.spec.ts`: each of the five undone and redone (Ctrl+Shift+Z and Ctrl+Y) with its toast; a move on another canvas named in the toast; a rename changed afterwards by Anna refused with the agreed message and dropped, the next Ctrl+Z going further back; Anna's change not in Łukasz's history; unit `undo.test.ts`, `undo-history.test.ts`, `change-label.test.ts` | Pass |
| S1B-13 | Deleting a mapping or relationship is immediate with “Undo” in the toast; an attribute with mappings still asks for confirmation | e2e `S1B-13.spec.ts`: a mapping from its panel and a relationship with Delete, each undone from the toast's link; an attribute with mappings needs a second click; one without goes at once; the same in an attribute row's toolbox (D-52) | Pass |
| S1B-14 | A reviewer gets no drag, relate, tool or reorder actions, and can undo only their own status changes; direct server calls are refused | e2e `S1B-14.spec.ts`: as Piotr no Entity tool, relate button, width handle, column drag, Ctrl+↑, panel order or feeding-source buttons; the toolbox only fits the view or sets a status; his status change undone and redone; relate, reorder, attribute from a column and width called directly are refused; undo called directly undoes his own step and then nothing of Łukasz's; unit `undo.test.ts`, `permissions.test.ts` | Pass |
| S1B-15 | CI passes on the pull request; lint, typecheck, unit and all e2e suites pass three times in a row | e2e `S1B-15.spec.ts` (the workflow and scripts, and one test file per criterion); CI on PR #3 passed on every push of this slice (checked each time); local runs below | Pass |

## Performance (S1B-09, S1B-10)

Measured on 5 October 2026 with the spike's method, as in slice 1a's S1A-14 (`e2e/slice-01b/measure.ts`): every
animation-frame interval is recorded and Chrome's Long Animation Frames API counts long frames. Same laptop as the
spike and slice 1a (i7-8550U, Intel UHD 620), Google Chrome 154 headed, 1536 × 864 window, the dev server (`next dev`;
the local data adapter refuses a production build, AD-29). Data: “Performance test” (101 cards, 300 mappings,
40 relationships).

| Measurement | Bar | Step 4 quick check (4 Oct) | **Step 6 (5 Oct)** |
| --- | --- | --- | --- |
| C-09: resize of the 200-row card at 50 %, 6 s back and forth | ≥ 45 fps on average | 31–36 fps | **25.1, 32.1, 24.0 fps** (three runs; 21–28 long frames each) |
| C-10: hover to the next frame, 40 hovers on mapped rows at 100 % | ≤ 100 ms | about 190 ms | **168.6 ms median** (p95 304.8 ms; the mark itself is in the page after 26.2 ms median) |
| C-10: mouse sweep over a card for 5 s | – | – | 20.5 fps |
| Pan and zoom at the overview, median of 3 runs | ≥ 52.8 fps (slice 1a's 55.6 − 5 %) | – | **55.2 fps** (52.7, 55.4, 55.2) – met |
| Pan and zoom at 100 %, dense area, median of 3 runs | ≥ 47.0 fps (slice 1a's 49.5 − 5 %) | – | **51.7 fps** (53.0, 51.7, 50.6) – met |

As decided after step 4, C-09 and C-10 are accepted as **partly met** and were measured once more for the record,
without further optimisation. The spread between C-09 runs (24–32 fps, same code, minutes apart) is the laptop's, as
in slice 1a. What was tried and why it did not help (a veil over the lines, a block view while resizing: every change
repaints the canvas's one large GPU layer) is in the PRD's items 8 and 9 and in
[known limitations](../known-limitations.md#s1a-14-is-only-partly-met-and-measured-on-the-dev-server): the Supabase
slice measures S1A-14, C-09 and C-10 in a production build, if possible also on a newer machine, and if they still
miss, draws the mapping lines on an HTML canvas instead of SVG.

The pan-and-zoom check is the regression bar agreed for slice 1b: slice 1b's canvas (hover overlay, width handles,
resize outline, drag targets) does not make panning and zooming slower than slice 1a's.

Raw results: `test-results/S1B-09.json` and `test-results/S1B-10.json` after a `MEASURE=1` run (not committed). In the
normal e2e run both tests check the behaviour and run the measuring steps briefly without judging them (headless
Chromium has no GPU).

## Three runs in a row

`npm run e2e` with no dev server running (slice 0, 1a and 1b: 50 tests per run), 5 October 2026, after the slice 1b
tests were complete:

| Set | Run 1 | Run 2 | Run 3 | “Destination stream closed early” in the server log |
| --- | --- | --- | --- | --- |
| First | 50/50 (9.6 min) | 50/50 (8.9 min) | 49/50: S0-10 – its own restarted dev server did not answer within 2 minutes | 2 per run |
| **Second (the three in a row)** | **50/50** (9.5 min) | **50/50** (9.2 min) | **50/50** (9.3 min) | 1–2 per run |

Between the two sets only the `MEASURE=1` runs of S1B-09 and S1B-10 ran; no code changed. S0-10 starts a second dev
server inside the test and waits up to two minutes for it; on this laptop a cold start of that server sometimes takes
longer (it timed out in slice 1a's runs too). It is not caused by slice 1b, and the test was not changed. The server-log
line is the accepted one from slice 1a ([known limitations](../known-limitations.md#the-destination-stream-closed-early-in-the-e2e-server-log)).

After the three [findings](#findings-from-the-definition-of-done) were fixed (6 October): lint, typecheck, 437 unit
tests and one more full run, 50/50.

## Manual checklist (S1B-01 to S1B-12)

On http://localhost:3000 after `npm run reset-dev-data`, signed in as Łukasz, canvas “Customer & orders”:

- [ ] **S1B-01** Drag the `segment` row of `customers` onto `segment_code` of Customer: a draft line appears, the
      mapping panel opens.
- [ ] **S1B-02** Drag `web_users.cust_no` onto `customer_number`: the choice shows “Separate mapping (alternative
      source)” highlighted; Enter. Drag `customers.lname` onto `first_name`: “Add to mapping customers.fname” is
      highlighted; Enter; the panel asks for a rule; write one and save.
- [ ] **S1B-03** Drag `order_line.price` onto the Order Line header: a new attribute `price`, Decimal(10,2), mapped.
- [ ] **S1B-04** Select `customers.segment`, “Map to an attribute”: pick an attribute; the mapping is there.
- [ ] **S1B-05** A mapping with two inputs: “Split into separate mappings”. Customer.email: “Merge mappings…”, tick the
      other one, merge without a rule (refused), with a rule (one transform, in review).
- [ ] **S1B-06** Place Country, press the relate button on Customer, click Country; set the verb and the ends.
- [ ] **S1B-07** Press E, click an empty spot, type a name. Right-click the empty canvas, a card, an attribute row, a
      column row, a mapping line and a relationship line: each shows its actions (a row only its own, D-52); “New entity
      here” works; “Collapse card” on a card, then right-click it again: “Expand card”.
- [ ] **S1B-08** Select an attribute, Ctrl+↑ and Ctrl+Shift+↓ (the row flashes, its lines follow); drag in the entity
      panel's list; reload: same order.
- [ ] **S1B-09** Drag a card's right edge (an outline follows, the card takes the width on release); double-click the
      edge; “Fit width to names” in the toolbox; the other canvas keeps its own width.
- [ ] **S1B-10** Hover a mapped row: its lines are drawn stronger, the rows at the other ends are marked, nothing fades.
- [ ] **S1B-11** Take `customers` and `web_users` off the canvas, select Customer: “Add all to this canvas” places them
      on its left; Ctrl+Z takes them both off again.
- [ ] **S1B-12** Create, rename, move, reorder and delete something; Ctrl+Z each (toast “Undone: …”), Ctrl+Shift+Z or
      Ctrl+Y; the top bar's buttons do the same and are greyed out when there is nothing to undo or redo.

And the definition of done: build a small model from scratch on an empty canvas using only the canvas.

## Assumptions

Decided with Łukasz during the slice:

1. A refused undo or redo is dropped from the history with the toast “Couldn't undo “{action}” because it was changed
   afterwards. Ctrl+Z again goes further back.” (redo: “… Ctrl+Shift+Z again goes further on.”) (4 October).
2. Undo and redo toasts name the step, “Undone: {action}”, and the canvas when it is not the open one, “… on {canvas}”
   (5 October).
3. Card resize shows an outline while dragging and updates the card and its lines on release; hover redraws the
   hovered lines above the others and does not fade the rest (C-09, C-10; 4 October). Both are partly met; the
   production measurement is in the Supabase slice (5 October).
4. S1B-10's pan-and-zoom bar is slice 1a's median of three runs minus 5 % (4 October).
5. Deleting from the toolbox is immediate (a mapping or a relationship; an attribute follows the panel's rules, D-52).
6. The undo history is kept in server memory and lost when the server restarts; the Supabase slice decides whether it
   must survive a restart ([known limitations](../known-limitations.md#the-undo-history-lives-in-server-memory)).

Assumed while building (please check):

7. The undo history covers the model and the layout (canvas cards, projects and canvases); workspace settings, people
   and a canvas's look are outside it, as in the prototype. A step's label (“Delete mapping”, “Move card”,
   “Reorder attributes”) is read from its change events, so every command gets one without naming it.
8. Undo and redo, their keys and the top bar's buttons are on canvas pages. Ctrl+Z inside a text field is the field's
   own undo.
9. “Undo” appears in the toasts of destructive actions (deletes and “Remove from this canvas”); the prototype has it
   on almost every toast ([ideas](../ideas.md)). A mapping, a relationship, an attribute without mappings and a table
   without columns are deleted at once; an attribute with mappings and a table with columns ask for a second click;
   entities and concepts keep their dialog. Delete or Backspace deletes a selected line, as in the prototype.
10. “Map to an attribute” is one picker grouped by entity (entities on this canvas first), not two steps.
11. A column dropped on an entity's header whose name is already an attribute of that entity (ignoring case) maps to
    that attribute instead of creating a second one, as if it had been dropped on its row: a direct mapping when the
    attribute has none, otherwise the same D-48 choice with the same hint (“Separate mapping (alternative source)” or
    “Add to mapping …”), and nothing is added without it. Checked by Łukasz on 6 October, the choice added then. Tests:
    S1B-03 (both cases), `mapping-choice.test.ts`.
12. Feeding sources go 160 px to the left of the card and fed entities 160 px to the right, from the card's top down,
    each moved down until it covers no card; several are placed in one change, so one undo takes them all off. They
    are placed by a click; dragging them from the right panel is not built ([ideas](../ideas.md)). The toolbox's “Show
    its sources (N)” does the same.
13. A new entity from the Entity tool goes into the concept used last, else the first one (frames come in slice 2).
14. The toolbox does not open when it would offer nothing (a reviewer or reader on a card), and Esc closes it from
    anywhere.
15. A reviewer can set a mapping's status from the toolbox; everything else in it is for editors.

Decided after the definition of done (6 October):

16. **D-52** A row's right-click menu shows only that row's actions (move, map from or to, “Delete attribute”); card
    actions are only in the card header's menu, so deleting an attribute can't be mistaken for deleting its entity.

## Findings from the definition of done

Łukasz built a small model from scratch on an empty canvas on 6 October 2026 and found three things, fixed before
acceptance:

1. **The toolbox could not expand a collapsed card.** Its entry read the card's state from the page, which a collapse
   on the canvas does not refresh, so it kept offering “Collapse card”. It now reads the card as the canvas shows it
   and toggles: “Collapse card” or “Expand card” (the rows filter likewise). Test: S1B-07.
2. **A row's toolbox also listed the card's actions** (remove from canvas, delete from model, …), so deleting an
   attribute could be mistaken for deleting its entity. New rule **D-52**: a row's toolbox shows only that row's actions
   (move up, down, to top, to bottom; map from a column or to an attribute; “Delete attribute” with the panel's
   confirmation rules); card actions are only in the header's toolbox. Tests: S1B-07, S1B-13.
3. **The data type's length, precision and scale fields ran out of the right panel.** They took the inputs' full
   width instead of their own; now they keep 84 px and wrap under the type field when the panel is narrow, down to its
   narrowest, 280 px. Test: S1B-03.

## Known limitations carried forward

- C-09 and C-10 partly met, measured on the dev server
  ([known limitations](../known-limitations.md#s1a-14-is-only-partly-met-and-measured-on-the-dev-server)).
- Undo history in server memory ([known limitations](../known-limitations.md#the-undo-history-lives-in-server-memory)).
- S0-10 (slice 0) restarts a dev server inside the test; on this laptop its cold start sometimes needs more than the
  test's two minutes (also seen in slice 1a), see [Three runs in a row](#three-runs-in-a-row).
