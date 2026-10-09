# Slice 2b – Frames

Status: ready once Łukasz confirms it · Branch: `slice/02b-frames` · Builds on: slice 2p (tag `slice-02p`)
Decisions: D-04, D-05, D-06, D-14, D-15, D-16, D-17, D-19, D-23, D-46, D-47, D-52, AD-12, AD-13, AD-16, AD-23, AD-24

## Goal

Organise a canvas into areas, the way the prototype does: draw frames that stand for a concept, a source system or
just an area; cards belong to the frame they are dropped in; a frame moves with everything in it; its label shows how
far its content is mapped and what does not belong there; the canvas can arrange itself into frames by concept and
system. Frames belong to the canvas, not the model (D-04).

Collapsing a frame into a block with bundled lines (D-07) is **slice 2c**; this slice keeps `frame.collapsed` false.

## Reference

- Behaviour: `docs/prototype/infomapper-model-prototype.html`: the Frame tool (A), `createFrame`, `claimFree`,
  `afterResize`, `afterCardDrop`, `askConcept`, `wrapInFrame`, `frameAroundSelection`, `fitFrameToContent`,
  `deleteFrame`, `frameAt`, `misfits`, `frameStats` and the label chips (`renderFrames`), the frame panel (`insFrame`),
  the frame toolbox (`ctxFor`, “a frame”), the card panel's “Frame” section (`frameInfo`), the canvas overview's
  “Frames on this canvas”, `arrangeLayout`, and the selection rules for frames (`lassoHits`, `selectAll`, group moves).
- Data: `frame` and `canvas_item.frame_id` in `docs/data-model-v2.md` and the migration. Values follow the data
  model (`kind`: `concept`, `source_system`, `free`), not the prototype's names.
- Inventory of 6 October 2026: SQL complete; domain, local adapter, seed and canvas have nothing yet. Its risk list for
  frames in React Flow is the checklist for “Canvas rules” below.

## In scope

1. **Frames in domain and data.** A `Frame` type and commands; the local adapter gets the `frame` table, the foreign
   keys, the `frame_ref` check (a concept frame has a concept, a source frame a source system, a free frame neither)
   and the rule the SQL cannot express: a card's frame is on the card's canvas. `frame` joins the undoable tables and
   comes off the schema check's “not built yet” list. `seed:large` stores the 8 frames it already computes.
2. **Frame tool (A).** A toolbar button and the A key; drag on the canvas to draw a frame (snapped to 8 px); a click
   without dragging makes a 480 × 320 frame centred on the click; the tool turns off after one frame; Esc cancels. The
   empty-canvas toolbox gets “New frame here”. A new frame is a free frame named “New frame” in the first free colour,
   selected, with its name ready to type. It takes the cards that are fully inside it and in no other frame (D-06).
3. **Membership (D-05).** A card belongs to the smallest frame that contains the middle of its header. After a card or
   a group is dropped, membership is recomputed for the dropped cards, and a frame grows to hold a card that joined it
   (24 px at the sides and bottom, 40 px above). No nested frames (D-23): frames may overlap, but membership is always
   one frame.
4. **The concept question (D-05, D-17).** An entity dropped into a concept frame of another concept asks: “{entity} is
   now inside the {concept} frame, but belongs to the {other} concept. Move it to {concept} in the model?” with “Move
   to {concept}” and “Keep in {other}”. A group drop asks once for all such entities. Moving changes the model (one
   change group with the drop); keeping leaves the card marked as misplaced.
5. **Resizing (D-06).** A handle at the frame's bottom-right corner. On release, members whose header middle is now
   outside go to the frame under them or to none, and free cards whose header middle is now inside join. Cards of
   other frames are never taken. Minimum size 160 × 96 px.
6. **Moving a frame (D-14).** Dragging the frame's name, or any empty spot inside it, moves the frame and every card in
   it, lines following, as one change group. The same snapping and speed approach as the 2a group drag.
7. **Gestures inside a frame (D-15, D-18).** Shift + drag inside a frame draws a lasso that adds to the selection.
   Right drag, middle button, Space + left drag and the wheel pan and zoom inside a frame exactly as on the empty canvas;
   a right click without moving opens the frame's toolbox. The Hand tool pans over frames.
8. **The frame label.** Above the frame: a colour dot, the name, and chips: “{n}/{m} mapped” (attributes),
   “{n}/{m} used” (columns), “{n} type” (type problems), “{n} drafts”, “{n} misplaced” (cards that are not entities of
   this concept, or not tables of this system). Colours: a concept frame takes its concept's colour, a free frame its
   own, a source frame as in the prototype.
9. **The frame panel.** Name; “Stands for” Free area / Concept / Source system, with the concept or system picker or
   the six free colours; the explanation per kind; “In this frame” (links to the cards, or “Empty. Drag cards into the
   frame.”); the counts sentence; “Doesn't belong here” with “Move to {concept}” for entities of another concept; the
   actions “Zoom to frame”, “Fit frame to its content”, “Delete frame”, and “Deleting a frame keeps everything inside
   it on the canvas.” Changing what the frame stands for re-evaluates the misplaced marks; it never moves cards or
   changes the model.
10. **The frame toolbox (D-19).** Header with the frame's name; “Rename…”, “Fit frame to its content”, “Select its
    cards”, “Zoom to frame”; then “Delete frame (keeps its cards)” (Del). Collapse comes in 2c, notes in slice 3.
11. **Frames and the selection (D-16, D-17).** Clicking a frame's name or an empty spot inside it selects the frame.
    Shift+click adds or removes it. A lasso that fully contains a frame selects the frame, which stands for its cards
    (the cards are not selected separately, and are moved once). Ctrl+A selects all frames and the cards that are in
    no frame. In a group, frames move with group drag and nudge, and take part as units in Align left, Align top,
    Stack in a column (64 px after a frame) and Line up in a row; Fit widths to names and Remove from this canvas act on
    cards only. The selection panel and group toolbox count frames (“2 frames, 3 entities”).
12. **Putting cards in a frame.** “Put in a new frame” in the group toolbox and the selection panel draws a frame around
    the selected cards (32 px at the sides, 40 above, 32 below): a concept frame if all are entities of one concept, a
    source frame if all are tables of one system, else a free frame; the cards join it. The card panel's “Frame” section
    shows the card's frame (a link) or “Not in a frame on this canvas.” with “Put in a new concept frame” or “Put in a
    new source system frame”; the card toolbox offers the same.
13. **Deleting a frame.** The frame goes, its cards stay where they are and belong to no frame; toast “Deleted the frame
    {name}. Everything inside stays on the canvas.” with Undo. Delete or Backspace deletes a selected frame.
14. **The canvas overview panel.** “Frames on this canvas”, each with its card count and type problems, a link to the
    frame, or “No frames yet. Draw one with the Frame tool (A), or let the canvas arrange itself.”; and the action
    “Arrange into frames by concept and system”.
15. **Arrange into frames (prototype `arrangeLayout`).** Free frames stay as they are; concept and source frames are
    rebuilt: source tables grouped by system on the left (one column per system frame), entities grouped by concept on
    the right (two columns when a concept has more than two entities), frames 96 px apart. One change group, with
    Undo in the toast.
16. **The Entity tool and frames (D-46).** A new entity made by clicking inside a concept frame belongs to that
    frame's concept and joins the frame; elsewhere the concept is the last used, as today.
17. **Concept deletion (D-47).** When a concept is deleted, its concept frames on every canvas become free frames (name
    and position kept), in the same change group.
18. **Duplicate layout** copies the frames with new ids and keeps each card's membership in the copy.
19. **Permissions.** Reviewers and readers can select frames, see their panel and use “Zoom to frame” and “Select its
    cards”; nothing else. Direct server calls are refused with the domain's message.

## Out of scope

Collapsing frames, bundled lines, drill-down, Collapse all / Expand all (slice 2c) · notes in or pinned to frames
(slice 3) · nested frames (D-23) · frames in the Overview minimap beyond what it already draws · performance work
beyond keeping the 2a numbers (see criterion S2B-14).

## Rules for the domain and data

- Commands: create frame (with the cards it claims); update frame (name, kind, concept or source system, colour);
  move frame (frame and its cards, one change group, versions of all rows); resize frame (with the membership changes);
  set membership of dropped cards (with the frame growth and, when confirmed, the entity's concept change); delete
  frame (clears its cards' `frame_id`); put cards in a new frame; arrange into frames; select-its-cards needs no write.
- Every command checks permission, archive and version, and writes its change events in the same write (AD-12,
  AD-13, AD-23). Membership rules (smallest frame by header middle, D-06 claiming, D-23 one frame) live in the domain
  as pure functions with unit tests, fed with card sizes from the canvas.
- Undo restores a frame and its members' `frame_id` together; undo of a concept change made by the drop question
  undoes the drop with it (one change group).
- No change to `docs/data-model-v2.md` or the migrations is expected. If one is needed, stop and ask first.

## Canvas rules for this slice

- **Frames are not React Flow parents.** No `parentId`; frames are nodes (or an own layer) under the cards and the
  line layer, with a fixed stacking order that hover, drag, relate and selection never change. Card positions stay
  absolute, as in the data.
- **Hit tests.** The column drop, Entity tool, relate line, row hover, the lasso start and the toolbox must look
  through a frame to what is on top; only a frame's name strip, its handle and its empty area count as the frame.
- **Panning through frames** as in item 7; this is the inventory's first risk and is decided in Step 2 before
  anything else is built on it.
- **AD-24.** Frame fills follow the rules (no opacity on repeated elements, a plain fill colour mixed in CSS). Frames at
  any zoom draw their outline, fill and name; below 40% the chips may be left out. Moving a frame uses the 2a group
  drag path.
- **Placement and fit.** Fit everything, content bounds, “Add the N missing” and free-spot placement take frames into
  account (a card placed beside another may land in a frame and joins it by the membership rule).

## Steps (stop after each one and report)

### Step 1 – Domain and data
Item 1 and the commands and rules above, with unit tests; the adapter's frame table, checks and undo; `seed:large`
stores its frames; the schema check's list updated.

### Step 2 – Frames on the canvas
Items 2, 7 and 13 first, the gesture plan for the frame body decided and reported, then items 3, 5, 6 and 8.

### Step 3 – Concept rules and panels
Items 4, 9, 10, 12, 14, 16 and 17.

### Step 4 – Selection, arrange and duplicate
Items 11, 15, 18 and 19.

### Step 5 – Acceptance tests and wrap-up
Playwright tests for every criterion (`e2e/slice-02b/`), independent of each other; three full e2e runs in a row with
no dev server running; one quick `measure:canvas` round (S2B-14). Write `docs/prd/slice-02b-acceptance.md` (results,
manual checklist S2B-01 to S2B-12, assumptions). Update README and CLAUDE.md commands.

## Acceptance criteria

| ID | Criterion |
| --- | --- |
| S2B-01 | The Frame tool (A) draws a frame around Customer and Sales Order: it is a free frame “New frame”, selected, name ready to type, and both cards belong to it; a card already in another frame is not taken. |
| S2B-02 | Dragging Order Line into the frame makes it a member and the frame grows to hold it; dragging it out makes it a member of no frame; where two frames overlap, the smaller one wins. |
| S2B-03 | Setting the frame to Concept “Sales” marks Customer as misplaced (label chip and “Doesn't belong here”); “Move to Sales” moves it in the model. Dropping an entity of another concept into a concept frame asks the question; “Keep” leaves it marked; a group drop asks once. |
| S2B-04 | Dragging a frame by its name, and by an empty spot inside it, moves it with its cards and lines; one Ctrl+Z puts all back; after a reload the positions are kept. |
| S2B-05 | Resizing a frame releases cards that end up outside and takes free cards that end up inside, never cards of another frame. |
| S2B-06 | Inside a frame: Shift + drag draws an adding lasso; right drag, middle button, Space + drag and the wheel pan and zoom; a right click opens the frame toolbox with the actions of item 10. |
| S2B-07 | The label chips show mapped, used, type, drafts and misplaced counts that match the model; the panel shows the same counts and the frame's cards. |
| S2B-08 | A lasso around a whole frame selects the frame, not its cards separately; group drag, nudge, align, stack and line up move frames with their cards; Ctrl+A selects frames and the cards outside frames. |
| S2B-09 | “Put in a new frame” on Customer and Customer Address makes a Customer concept frame; on two CRM tables a CRM source frame; on a mix a free frame. The card panel's “Put in a new concept frame” does the same for one card. |
| S2B-10 | Deleting a frame keeps its cards in place, free of frames, and Undo in the toast restores the frame with its members. |
| S2B-11 | “Arrange into frames by concept and system” on Customer & orders builds one frame per system and per concept as in the prototype, keeps free frames, and is one undo step. |
| S2B-12 | The Entity tool inside the Sales frame creates an entity of Sales in that frame; deleting a concept turns its frames into free frames on every canvas; Duplicate layout copies frames and memberships. |
| S2B-13 | As Piotr (reviewer): frames can be selected, zoomed to and their cards selected; no drawing, moving, resizing, editing, arranging or deleting is offered; those commands called directly are refused. |
| S2B-14 | One quick `measure:canvas` round on “Performance test” with its 8 frames: pan and zoom and group drag no more than about 10% below slice 2p's figures (the method's spread for one round); recorded, not a full sitting. |
| S2B-15 | CI passes, including the schema check with `frame` built; lint, typecheck, unit and all e2e suites pass three times in a row locally. |

## Definition of done

All criteria pass, steps were reported one by one, assumptions are listed, and Łukasz has organised Customer & orders
into frames by hand (a concept frame, a source frame, a free frame), moved and resized them, used “Arrange into
frames”, and undone it, then accepted the slice.
