# Slice 2a – Selection and canvases

Status: ready once Łukasz confirms it · Branch: `slice/02a-selection-and-canvases` · Builds on: slice 1b (`main` at
`26789b0`, tag `slice-01b`, AD-31 merged)
Decisions: D-12, D-15, D-16, D-18, D-19, D-22, D-28, AD-12, AD-13, AD-23, AD-24, AD-25, AD-31

## Goal

Work with several cards at once and with several canvases in practice, the way the prototype does: draw a lasso,
Shift+click, select all, move, nudge and align a group, remove it from the canvas or bring in the sources of all
selected entities; pan with the Hand tool; duplicate and delete canvases; give each canvas its look and its layer
mode; see from an entity or a table on which canvases it appears. This prepares slice 2b (frames), which adds frames
to the same selection.

## Reference

- Behaviour: `docs/prototype/infomapper-model-prototype.html`. For this slice: the lasso and the “N selected” box,
  Shift+click, Ctrl+A, group drag, arrow-key nudge, the selection panel (`insMulti`), the group toolbox (`ctxFor`, “a
  group”: align, stack, line up, fit widths), the empty-canvas toolbox (“Select all”, “Hand tool”), the Hand tool (H),
  the canvas tab menu (rename, duplicate layout, background, grid, “Use this look on all canvases”, “In projects”,
  delete or remove), the layer buttons Everything / Mappings / Relationships in the top bar, the “On canvases” list in
  the entity and source table panels, the “Canvas look” section of the canvas overview panel.
- Inventory of the gaps against the prototype, made on `main` on 6 October 2026 (Claude Code, read-only): items 1b, 1c,
  1d, 1f, 2a, 2b, 3, 4 and 5 are what this slice builds.
- Canvas rules: AD-24. Slice 1a and 1b acceptance files for what exists and what is only partly met.

## In scope

1. **Lasso (D-15, D-16).** A left drag that starts on the empty canvas draws a lasso rectangle; on release it selects
   the cards that are fully inside it, nothing that is only partly inside. With Shift held at the start, the lasso adds
   to the current selection. A left click on the empty canvas without moving clears the selection, as today. The
   lasso works at every zoom level, including below 40%.
2. **Selecting several cards.** Shift+click on a card (its header or body) adds it to the selection or takes it out.
   Ctrl+A (⌘A on Mac) outside text fields selects every card on the canvas. Esc clears the selection (after closing an
   open toolbox or leaving an active tool, as today). A plain click on a card selects only that card. Selecting a row
   or a line stays a single selection.
3. **The selection box.** With two or more cards selected, each selected card is marked and a dashed box around the
   group shows “N selected”, as in the prototype. Both are drawn in the overlay layer, not by restyling the cards
   (AD-24, the same approach as the hover highlight in slice 1b).
4. **Moving a group.** Dragging any selected card moves the whole group; lines follow during the drag. The move is
   snapped to the 8 px grid as a whole (the cards keep their relative positions) and saved as one change group, so one
   Ctrl+Z puts every card back.
5. **Nudging.** With one or more cards selected, the arrow keys move them 8 px, with Shift 32 px. The cards move at
   once on screen; the moves are saved as one change group after the keys have been still for about 400 ms, so holding
   an arrow key gives one undo step, not one per repeat.
6. **The selection panel.** With two or more cards selected, the right panel shows “N items selected”, the counts
   (“2 entities, 3 tables”), the list of selected cards (each a link that selects that card), the actions “Add sources
   of selected entities” (only when entities are selected), “Remove from this canvas” and “Clear selection”, and the
   prototype's short help text.
7. **The group toolbox (D-19).** A right click on a selected card while two or more are selected opens the group's
   toolbox: header “N items selected”; “Align left”, “Align top”, “Stack in a column”, “Line up in a row”, “Fit widths
   to names”; then “Add sources of selected entities”, “Remove from this canvas”; then “Clear selection” (Esc). The
   arrangement rules are the prototype's (`arrange`): align to the leftmost or topmost edge; a column sorted by y with
   32 px gaps; a row sorted by x with 64 px gaps. Each action is one change group. A right click on a card outside the
   selection selects that card first, as today.
8. **The empty-canvas toolbox** gets “Select all” (Ctrl A) and “Hand tool” (H), or “Back to selecting” (V) while the Hand
   tool is on.
9. **“Add sources of selected entities”.** Places the missing feeding source tables of every selected entity beside
   its card with the slice 1b placement rules (left of the card, no overlaps, also not with cards placed for another
   selected entity), all in one change group. A toast says how many were added, or that all are already here.
10. **“Remove from this canvas” for a group.** Removes all selected cards in one change group, with “Undo” in the
    toast (“Removed 4 cards from this canvas. They stay in the model with their mappings.”).
11. **Hand tool (D-18).** A toolbar button and the H key turn it on; a left drag anywhere, over cards too, pans the
    canvas; V or Esc turn it off. Right drag, middle button and Space + left drag keep panning as today. The cursor
    shows the tool. The tool is not saved.
12. **Duplicate layout.** In the canvas tab's ⋯ menu, “Duplicate layout” creates a new canvas named “{name} (copy)”
    right after the original in this project, with the same cards (positions, widths, collapsed state, row filters),
    the same look and the same layer mode, and opens it with the original's view. The model is shared, not copied.
    Toast: “Duplicated {name}. Only the layout is copied; the model is shared.” One change group, undoable. (Slice 2b
    extends this to frames.)
13. **Delete a canvas (D-28).** The tab menu's last item is “Remove from this project” when the canvas is also in
    another project (only the link to this project goes), otherwise “Delete canvas” (the canvas and its cards are
    soft-deleted; the model is untouched). It is disabled when this is the project's last canvas. If the open canvas
    goes, the next canvas of the project opens. Toasts as in the prototype (“Took {canvas} out of {project}. It is
    still in {other projects}.” / “Deleted the canvas {name}. The model and its mappings are untouched.”). One change
    group, undoable from the canvas that opens next.
14. **Canvas look (D-12).** Background (Grey, White, Blue, Warm) and grid (Dots, Lines, None) in the tab menu and in
    the canvas overview panel's “Canvas look” section, saved in `canvas.look`, rendered on the canvas. “Use this look
    on all canvases” copies the look to every canvas of the workspace. Look changes are saved but are not undo steps
    (the undo rule already skips them). The grid is drawn as one CSS background on the canvas pane, not with React
    Flow's background component, and must pass the pan-and-zoom check in criterion S2A-14 (AD-24: no dotted background
    of many elements).
15. **Layer mode (D-22).** Buttons Everything / Mappings / Relationships in the top bar (short labels All / Maps / Rels
    when narrow). Mappings hides the relationship lines, Relationships hides the mapping lines; cards stay. Saved per
    canvas in `canvas.look.layer`, not an undo step. Every canvas opens in its own saved mode.
16. **“On canvases” (entity and source table panels).** Lists every canvas of the workspace that shows the card, each
    marked “this canvas”, “open” (another canvas of this project) or “in {project}”. A click opens that canvas, switching
    the project when needed (toast “Switched to the project {name}.”), with the card selected and in view. When there is
    none: “Not on any canvas. It still exists in the model with all its mappings.”
17. **Permissions.** Reviewers and readers can select, lasso, Ctrl+A and use the Hand tool and the layer buttons. They
    get no group drag, nudge, align, fit, remove, add-sources, duplicate, delete or look actions; the selection panel
    and group toolbox show them only “Clear selection”. Their layer choice changes the view in their browser only and
    is not saved. Direct server calls for these commands are refused with the domain's message.

## Out of scope

Frames of any kind, “Put in a new frame”, a lasso caught frame standing for its cards, collapsed frames, “Arrange into
frames” (all slice 2b) · notes in the selection (slice 3) · the view-state bar showing the layer mode (D-39, slice 6) ·
selection in the navigation history (D-38, slice 6) · auto-scroll at the canvas edge while drawing a lasso · Delete
key for a group · undo on the project and workspace home pages (ideas.md).

## Rules for the domain and data

- Commands: move canvas items (several, with their versions, one change group); arrange canvas items (the canvas
  computes the positions from card sizes, the domain checks that every item is on the canvas and the positions are
  numbers on the 8 px grid); set widths of several items; remove several items from a canvas; duplicate canvas
  (new canvas, its `project_canvas` row after the original, copies of the canvas items with new ids); delete canvas
  (D-28 as in item 13, refused for a project's last canvas; soft-deletes the canvas and its items; removes the
  `project_canvas` row); set canvas look (background, grid, layer) for one canvas or all canvases of the workspace.
- Every command checks permission, archive and version and writes its change events in the same write (AD-12, AD-13,
  AD-23). Look and layer changes write change events too, so the history is complete, and stay outside undo.
- Undo of a deleted canvas restores the canvas, its items and its project link together; undo of a duplicate removes
  the copy. The existing undo consistency checks apply.
- No change to `docs/data-model-v2.md` or the SQL migrations is expected (inventory item 7). If one is needed, stop
  and ask first.

## Canvas rules for this slice

- **Our own selection, not React Flow's.** The selection is a set of keys in the canvas state (`entity:<id>`,
  `source:<id>`), designed so that slice 2b adds `frame:<id>` without changing it. `elementsSelectable` stays off, as
  set up for AD-24. Lasso hits are computed from the card rectangles in the store, not from the DOM.
- **Overlay for marks.** The lasso rectangle, the selected-card marks and the selection box are drawn in the overlay
  layer.
- **Group drag.** Lines must follow during the drag. Keep the AD-24 rules (no opacity on repeated elements,
  `will-change` as in setup B, switched off during the drag if that helps, as for resize). If the bar in S2A-14 is
  missed, stop and report the numbers and options before trying anything that changes behaviour.
- **Hit tests.** The lasso must not start on a card, a row, a line, the toolbox or the relate button, and must not
  interfere with the column drag, the Entity tool or the relate line from slice 1b.

## Steps (stop after each one and report)

### Step 0 – Housekeeping
1. **AD-31 safeguard in CI:** a job that starts a real Postgres (the major version Supabase uses for new projects;
   check and pin it), applies every migration in `supabase/migrations/` in order, and compares the resulting schema
   (tables, columns, types, nullability) with the domain's description of the tables. Propose which domain source
   the comparison reads (e.g. the local adapter's schema) in the step report. The job must fail on a mismatch; show
   that once with a unit test of the comparison.
2. **S0-10:** make it reliable on a cold start without changing what it tests (e.g. a longer start timeout for its
   own server, or warming that server like the global setup).
3. **npm audit:** apply the fixes that need no breaking upgrade; list the rest with their risk for a development-only
   app in `docs/known-limitations.md`.

### Step 1 – Domain
The commands and rules above with unit tests, including permissions, the D-28 refusals, undo of delete and duplicate,
and look changes outside undo.

### Step 2 – Selection
Items 1, 2, 3, 8 and 11: the selection state, lasso, Shift+click, Ctrl+A, Esc, the marks and the box, the Hand tool,
the empty-canvas toolbox entries.

### Step 3 – Group actions
Items 4, 5, 6, 7, 9 and 10, and the reviewer rules of item 17 for them.

### Step 4 – Canvases
Items 12, 13, 14, 15 and 16, and the rest of item 17.

### Step 5 – Acceptance tests, performance and wrap-up
Playwright tests for every criterion (`e2e/slice-02a/`), independent of each other; three full runs of all e2e
suites with no dev server running. Measure S2A-14 with `MEASURE=1` as in slice 1b. Write
`docs/prd/slice-02a-acceptance.md` (results, measurements, manual checklist for S2A-01 to S2A-12, assumptions).
Update README and the Commands section of CLAUDE.md.

## Acceptance criteria

| ID | Criterion |
| --- | --- |
| S2A-01 | On Customer & orders, a lasso fully around Customer and Sales Order and partly over Order Line selects exactly those two; a lasso started with Shift adds to the selection; a click on the empty canvas clears it. |
| S2A-02 | Shift+click adds and removes cards; Ctrl+A selects every card on the canvas; Esc clears; the box shows “N selected” and the panel lists the cards with the right counts. |
| S2A-03 | Dragging one card of a three-card selection moves all three and their line ends by the same amount; one Ctrl+Z puts all three back; after a reload the moved positions are kept. |
| S2A-04 | Arrow keys move the selection by 8 px, with Shift by 32 px; five quick presses are one undo step. |
| S2A-05 | The group toolbox offers the actions of item 7; Align left, Align top, Stack in a column, Line up in a row and Fit widths to names each give the prototype's result and are each one undo step. |
| S2A-06 | With Customer and Sales Order selected and their sources taken off the canvas, “Add sources of selected entities” places all missing sources without overlaps in one undo step; “Remove from this canvas” removes the group, and “Undo” in the toast brings it back. |
| S2A-07 | The Hand tool (button or H) pans with a left drag over cards and empty canvas and selects nothing; V and Esc turn it off; right drag, middle button and Space still pan. |
| S2A-08 | “Duplicate layout” creates “Customer & orders (copy)” in this project with the same cards, positions, widths, collapsed states, row filters, look and layer; renaming an entity shows on both; Ctrl+Z removes the copy. |
| S2A-09 | A canvas that is also in another project is only removed from this one; a canvas in one project is deleted with its cards and its entities stay in the model; the project's last canvas cannot be deleted; Ctrl+Z restores a deleted canvas with its cards. |
| S2A-10 | Background and grid change per canvas, are drawn, survive a reload and are not undone by Ctrl+Z; “Use this look on all canvases” sets every canvas of the workspace. |
| S2A-11 | Mappings hides the relationship lines and Relationships hides the mapping lines; the mode is saved per canvas, another canvas keeps its own, and Ctrl+Z does not change it. |
| S2A-12 | Customer's “On canvases” lists both canvases it is on (the test places it on a second canvas in another project); a click opens the other canvas in its project with Customer selected and in view. |
| S2A-13 | As Piotr (reviewer): lasso, Ctrl+A, Hand tool and layer buttons work and his layer choice is not saved; no group move, nudge, align, fit, remove, add-sources, duplicate, delete or look actions are offered; those commands called directly are refused and change nothing. |
| S2A-14 | On “Performance test” with `MEASURE=1`: the selection marks appear within 100 ms after releasing a lasso around every card at the overview (median of 20); dragging a group of at least 20 cards runs at 45 fps or better on average at 50% zoom; pan and zoom with grid Dots and with grid Lines are each no more than 5% below slice 1b's medians (overview 55.2 fps, 100% 51.7 fps). |
| S2A-15 | CI passes on the pull request, including the new Postgres migration check; lint, typecheck, unit and all e2e suites pass three times in a row locally. |

## Definition of done

All criteria pass (or a performance criterion is recorded as partly met after Łukasz decides), steps were reported one
by one, assumptions are listed, and Łukasz has reorganised Customer & orders with the lasso and the group actions,
duplicated it, changed the copy's look and layer, and deleted the copy, then accepted the slice.
