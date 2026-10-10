# Slice 3a – Acceptance

Status: **in progress**. Branch `slice/03a-labels-and-notes`. Criteria, results, the measurement round and the manual
checklist follow at step 5; the decisions are recorded here as they are taken.

## Assumptions and decisions

### Starting point

The slice starts from `main` at `717f42d` (“docs: idea – labels on requirements”), one documentation commit after the
slice 2c merge `10907f4` that the PRD names. That commit already holds the idea “Labels on requirements” in
`docs/ideas.md`, so it was not added again.

### Step 0 (handlebars, 10 October)

The handlebars condition (`docs/known-limitations.md`) is not met: `handlebars` 4.7.10 was published on 5 October
2026 (5 days old; the condition starts on 19 October), and `eslint-plugin-boundaries` 7.2.0 (9 August) is still the
newest release, with `@boundaries/elements` 3.1.1 pinning `handlebars` 4.7.9. No override was added.

### Answers to the PRD's questions before step 1 (Łukasz, 10 October)

1. **Reviewers and notes:** reviewers create, edit, resolve, reopen, move, resize, recolour, pin, unpin and delete
   notes, as modelers do; readers only read them.
2. **Labels:** modelers, admins and owners assign, remove, rename and delete labels and pin them to a project;
   reviewers and readers see labels and open label panels but change nothing.
3. **Undo:** assigning or removing a label, deleting or renaming a label, and every note change are undo steps;
   hiding resolved notes is not.
4. **Note authorship:** anyone with note rights edits any note; the panel shows who created it (“Created {date} by
   {name}.”).

### Step 0 answers (Łukasz, 10 October)

1. **Duplicate layout copies no notes**, as the prototype's `dupDia`: notes are loose remarks about a canvas, not part
   of its layout. The copy starts with no notes; the original keeps all of them; the toast stays “Duplicated {name}.
   Only the layout is copied; the model is shared.” The PRD's item 14, its rules for the domain and S3A-11 were
   changed accordingly (S3A-11 checks that the copy has no notes and the original's notes are unchanged).
2. **Open notes on the project home:** the number and the list “Open notes” as in the prototype (first line or
   “Empty note”, the canvas's name; a click opens that canvas with the note selected; “No open notes on this
   project's canvases.”). Added to item 12 and to **S3A-05**, which now covers the project home as a whole.
3. **Pinned labels** stay listed on the project home when no canvas of the project uses them any more (prototype
   `projLabels`). **Pinning and unpinning** a label write a change group with change events and are not undo steps;
   “no undo outside canvases” is recorded in `docs/known-limitations.md`.

### Step 1 (domain and data)

1. **An empty new note is never saved.** `createNote` needs text; the canvas creates the note only when its first text
   is written (D-21). So an emptied new note leaves no row, no change event and no undo step. An existing note may be
   emptied; it shows “Empty note”.
2. **A pinned note's place is computed by the server.** Pinned from the Note tool, a toolbox or the panel's “Pin to”,
   its offset is the card's width (or the frame's, or the 280 px block's when collapsed) + 24 to the right, at the top
   (prototype `createNote`).
3. **Implicit unpinning keeps the note out of frames.** When a pinned card leaves the canvas (removed, or its entity or
   table deleted) or a pinned frame is deleted (also by “Arrange into frames”), the note stays as a free note at its
   place and in no frame, as the prototype's `renderNotes`. Only “Unpin (make it a free note)” puts it into the frame
   it is in, as the prototype's `unpinNote`. Free notes in a deleted frame stay where they are, in no frame.
4. **Merging mappings moves the labels of the mappings that go to the mapping that stays** (Łukasz's decision after
   step 1; neither the PRD nor the prototype, which drops them): the union of their labels, no second link for a label
   it already has (such a link is soft-deleted), in the merge's change group, one undo step.
5. **Deleting a canvas soft-deletes its notes** in the same change group. No label link changes: labels mark model
   items, not canvases.
6. **Removing a label from its last item keeps the label** (as in the prototype); it shows “Not used anywhere yet.”
   in its panel (step 2) and can be deleted there.
7. **Change labels for the undo toasts:** “Add label”, “Remove label”, “Rename label”, “Delete label”, “Add note”,
   “Edit note”, “Resolve note”, “Reopen note”, “Change note colour”, “Resize note”, “Move note”, “Pin note”, “Unpin
   note”, “Delete note”.
8. **The local data file is format 4.** A format-3 file (slices 2b to 2c) is read with empty label, link, pin and note
   tables. `npm run reset-dev-data` brings in the demo labels and notes.
9. **Demo data:** in “Retail Co – DWH”, CR-23 marks Customer, `email`, `segment_code` and the mapping
   `web_users.email → Customer.email` (as the prototype's seed), and JIRA-481 marks `customers` and
   `customers.email_addr`. Anna made both. On “Customer & orders” there are three notes: a free one by Łukasz
   (blue), and two pinned to the table `order_line`, one by Piotr, one by Anna which Łukasz resolved (step 3: on the
   canvas's far right, away from the empty spots earlier end-to-end tests use; first pinned to Customer and
   `web_users`). No label is
   pinned to a project (the prototype pins CR-23 and JIRA-481; S3A-05 starts from no pins).

### Step 2 (labels)

1. **The Labels field's keys follow the prototype beyond the PRD's list:** besides ↑/↓ and Enter, a comma or Tab (with
   text) picks too, Backspace in the empty input takes the item's last label off, and Esc closes the list first, then
   leaves the input (the canvas does not see these keys).
2. **Without label rights** (reviewers, readers, archived workspace) the field shows the chips with their names as
   links, no × and no input; “None” when the item has no labels.
3. **Where the field sits** follows the prototype: after the definition (entity, attribute), after the note and the
   other sources (mapping), after the table's path (table), after “Feeds” (column).
4. **Marks:** a tag mark on labeled attribute and column rows and on a labeled table's header, with “Working labels:
   …” as the tooltip; on a labeled mapping line a tag in a dashed circle a quarter along the line (on a combined
   mapping, along its first input), with “Labels: …” as the line's tooltip (prototype texts). Below 40 % zoom the rows
   are not drawn, so their marks go with them, and the line tag is left out like the end dots; the table header's mark
   stays, like the rest of the header. A single mapping drawn at a collapsed frame keeps its tag; a bundle of several
   shows none. The mark takes room when deciding whether a name needs clipping (`text-fit.ts`).
5. **The label panel** names the counts in the prototype's order (entities, attributes, tables, columns, mappings) and
   lists the items under Entities, Attributes, Mappings, Tables, Columns (folding sections, a filter over 20 items).
   An entity, attribute, table or column opens only when its card is on this canvas (the known limitation of panel
   links); a mapping opens anywhere. A refused rename (a name another label has) shows the toast and the stored name
   again.
6. **Opening a label from the project home** opens the first canvas of the project (tab order) on which it marks
   something, with its panel (`?label=<id>`); a pinned label that marks nothing there opens on the first canvas. The
   star is shown to everyone, active only for those who may change labels; a pinned star uses the palette's amber
   (`im-review-strong`), the nearest to the prototype's.

**Accepted by Łukasz on 10 October 2026** after his manual check of step 2 (all steps, as Łukasz, Piotr and a reader).
Open question from step 2: the prototype also marks a labeled entity's card header (`lmark("entity", …)`); PRD item 3
lists rows, table headers and mapping lines only, so entity headers have no mark for now.

### Step 3 (notes on the canvas)

1. **A new note is a draft on the canvas** until its text is written: Ctrl+Enter or a click outside saves it (one
   undo step), Esc or an empty text drops it (nothing saved, no undo step). While it is a draft the right panel says
   “A new note: write it on the canvas …”; its toolbox has no actions.
2. **Where new notes go:** the Note tool puts a free note's corner 16 px left and 13 px up of the click, “Add a note
   here” 110 px left and 20 px up (both as the prototype), snapped to 8 px; a pinned note goes 24 px to the right of its
   card, frame or block, at the top (step 1). A click on a frame's empty area with the Note tool makes a free note
   there, which joins the frame; only the frame's name strip or its collapsed block pins the note to the frame.
3. **Dragging:** a note is dragged anywhere on it except its ✓ and its right edge; a click without moving selects it,
   a double-click edits it. Shift+click and notes in a selection of several come with step 4 (item 13).
4. **A free note in a frame moves with the frame** on the server in the frame move's change group (`moveOnCanvas`
   carries the frame's free notes, one undo step), and on the canvas at once. Growing a frame to take a dropped card,
   resizing it or fitting it to its content does not move or claim notes (as the prototype: notes join a frame only
   when dropped).
5. **The note's body** shows its whole text, wrapped (the prototype shows all of it). Below 40 % zoom a note draws its
   header and a plain block of its last measured height.
6. **Looks without opacity (AD-24 rule 4):** a resolved note's paper is mixed with the surface and its text is the
   quieter ink; the tether is the quiet ink mixed with transparent. The pin name in the header gets its clip only
   when it may not fit. Colours follow the prototype's light and dark papers.
7. **The tether** joins the points of the note and its element nearest to each other's centre, with a dot on the
   element, and is left out when the note lies on its element (prototype `tethers`).
8. **Who may do what:** the Note tool (button and N), the note toolbox's actions, dragging, resizing, ✓ and the
   panel's fields are for editors and reviewers; readers see notes and their panel read-only, and their toolbox shows
   only its heading.
9. **A new card is not placed under a note:** the free spots for cards placed from the left panel or the panels avoid
   the notes drawn, as the prototype's `freeSpot` does.
10. **Not yet:** the card's and frame's “Notes” panel section with its “Add a note” (item 12, step 4), the note count on
   card headers and blocks (step 4), Fit everything counting notes (item 14, step 4).

## Changes to earlier tests

- `src/domain/permissions.test.ts`: the role matrix gains `label.edit` (owner, admin, modeler) and `note.edit` (owner,
  admin, modeler, reviewer) (step 1).
- `tests/schema/compare-schema.test.ts`: `label`, `label_link`, `project_pinned_label` and `note` are now described by
  the domain (step 1).
- `src/domain/commands/undo.test.ts` and `frame.test.ts`: their row sets include the four new undoable tables (step 1).
- `src/canvas/canvas.test.ts` and `lines.test.ts`: the expected card rows and mapping lines have `labels: null` (step 2).
- `src/domain/commands/frame.test.ts`: a new test that a moved frame carries its free notes (step 3).
- `e2e/slice-01b/S1B-14.spec.ts`: a reviewer's toolbox now offers “Add a note here” on the empty canvas and “Add a
  note to this” on a card (step 0 answer 1); before, the card offered none (step 3).
- `e2e/slice-02b/S2B-06.spec.ts` and `S2B-13.spec.ts`: the frame's toolbox lists “Add a note to this frame” after “Zoom
  to frame”, for editors and reviewers (step 3).
- The first step 3 run also failed S1B-06 and S2B-02 because demo notes lay on the empty spots those tests use; the
  demo notes moved (step 1, item 9), the tests did not change.
