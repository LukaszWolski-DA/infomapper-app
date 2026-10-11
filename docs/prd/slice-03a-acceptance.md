# Slice 3a – Acceptance

Status: **step 5 done, waiting for the confirming measurement round and Łukasz's acceptance**. Branch
`slice/03a-labels-and-notes`, pull request #9 (draft). Steps 0 to 4 were accepted one by one (below).

## Criteria

Each criterion has its Playwright test in `e2e/slice-03a/`, named after its id; every test starts from a freshly seeded
data file (the demo labels CR-23 and JIRA-481 and the three demo notes on Customer & orders) and does not depend on
another. Data a test starts from is made through the domain (`removeLabel`, frames with `makeFrame`, notes moved or
resolved with the note commands); what the criterion checks goes through the page with the real mouse and keyboard and
is read back from the data file.

| ID | Test | Result |
| --- | --- | --- |
| S3A-01 | `S3A-01.spec.ts`: with CR-23 gone, “cr 23” on Customer offers “Create “cr-23”” first; Enter creates and assigns it and the input keeps the focus; one undo takes label and link away; “CR” on `email` offers “Create “CR”” and below it cr-23 with “1 item”; picking it adds the link; × removes it, one undo puts it back | passes |
| S3A-02 | `S3A-02.spec.ts`: JIRA-900 on Sales Order (entity), its first attribute, order_header (table), its first column and a mapping (chosen by its line), typed as “JIRA-900”, “jira-900” and “Jira-900”: one label, five links, one in each target column | passes |
| S3A-03 | `S3A-03.spec.ts`: at 45 % the tag marks on `email`, `segment_code` (“Working labels: CR-23”), `customers.email_addr` (JIRA-481), the headers of Customer and customers, none on unlabeled rows and cards, one line tag with “Labels: CR-23”, no opacity; at 30 % no row marks and no line tag, the two header marks stay | passes |
| S3A-04 | `S3A-04.spec.ts`: CR-23's panel: “Marks 1 entity, 2 attributes, 1 mapping. …”, the items by kind as links (one opens the attribute); renaming to “jira-481” is refused (“Another label is already called “JIRA-481”.”) and the field shows CR-23 again; renaming to CR-24 works; “Delete label” soft-deletes label and links, the model is unchanged, Undo in the toast brings label and all four links back | passes |
| S3A-05 | `S3A-05.spec.ts`: Order management's home lists CR-23, JIRA-481 by items; pinning JIRA-481 puts it first, also after a reload; unpinning and pinning again; with its links taken off (domain) it stays listed, pinned, “0 items”; “2 open notes”, the list with canvas names and “, on order_line”; a click opens Customer & orders with the note selected (`?note=`); with both notes resolved: “0 open notes” and “No open notes on this project’s canvases.” | passes |
| S3A-06 | `S3A-06.spec.ts`: Esc and an empty note left by a click leave no note and Undo disabled; the Note tool (N and the button) makes a free note (yellow, 220 px, open) and notes pinned to Sales Order, a collapsed frame's block and a frame's name; “Add a note here”, “Add a note to this”, “Add a note to this frame” and the card panel's “Add a note” make notes too (8 in all) | passes |
| S3A-07 | `S3A-07.spec.ts`: on the demo's free note: text edited in place (Ctrl+Enter), undone; Esc cancels; width 220 → 320 by its edge, undone; colour pink by the toolbox and green by the panel, each undone; resolved by its ✓, the toolbox and the panel, reopened by the toolbox, each one undo step | passes |
| S3A-08 | `S3A-08.spec.ts`: the free note dropped in a frame joins it, moves with the frame by the same amount and is hidden while the frame is collapsed; order_line's pinned note follows the card while the mouse is down, with a dashed tether, its offset unchanged; “Unpin” keeps it in place as a free note; order_line taken off the canvas turns its other note into a free note at its place | passes |
| S3A-09 | `S3A-09.spec.ts`: order_line's header “2 notes pinned here”; its panel lists both (open, resolved); the frame panel lists its note; the collapsed block shows “2 notes”; the overview lists the three open notes; unticking “Show resolved notes” hides the resolved note and the header shows 1, Undo unchanged; after a reload still hidden; Piotr still sees it | passes |
| S3A-10 | `S3A-10.spec.ts`: click and Shift+click on notes and a card; a lasso around the free note; Ctrl+A takes the free note in no frame, not the pinned ones; a group of order_line, its pinned note and the free note dragged by the card: the free note moves by the card's amount, the pinned note's offset and version stay; two arrow presses, one undo; with the free note in a frame, a lasso around the frame catches the frame, not the note, and Ctrl+A leaves the note out; Delete removes a selected note | passes |
| S3A-11 | `S3A-11.spec.ts`: Duplicate layout: the toast, the copy with all cards and no note (page and data), the original's three notes exactly as before | passes |
| S3A-12 | `S3A-12.spec.ts`: deleting Customer soft-deletes CR-23's four links (Customer, email, segment_code, the mapping) with change events in the entity's change group; the label stays; Ctrl+Z brings the entity and the four links back | passes |
| S3A-13 | `S3A-13.spec.ts`: Łukasz uses every label and note write once (their action ids); Piotr sees labels read-only (no input, no ×, read-only name, no delete, no pin stars) and writes a note; his direct label calls are refused (“As a reviewer you cannot change labels.”) and change nothing; Kasia has no Note tool, no ✓, no edge, no toolbox on a note, a read-only note panel, no “Add a note”, no Labels input; her drag and Delete change nothing; all twelve direct calls are refused (“As a reader you cannot change labels.” / “… notes.”) and change nothing | passes |
| S3A-14 | two quick `measure:canvas` rounds on “Performance test” against `slice-02c` (below); `S3A-14.spec.ts` checks the data part (24 notes, half pinned, labels on 50 rows and 30 mappings, drawn on the canvas) and `S3A-14-idle.spec.ts` (2 tests) guards the canvas while idle with notes below 40 %, frames expanded and collapsed | after step 4: within the bar (expanded −5.6 % at 100 %, +0.3 % at the overview; collapsed +16.3 %); the step 5 round confirms (to come) |
| S3A-15 | CI (lint, typecheck, unit tests, the schema check with `label`, `label_link`, `note`, `project_pinned_label`), three full e2e runs in a row | passes: CI and the schema check green on 7fa2438; lint, typecheck, 765 unit tests; three full runs in a row on 7fa2438, 124 of 124 each (below) |

### Three full runs in a row

`npm run e2e` with no dev server running. The rule: three passing runs in a row, and after any test change the three
start again.

| Set | Commit | Runs | What happened |
| --- | --- | --- | --- |
| 1 (11 October, 16:05–17:13) | 5139ba6 | 3 | Runs 1 and 3 failed S3A-13 (the owner's note vanished from the page; fixed in 7fa2438, step 5 item 4), run 2 passed 124/124 (24.1, 20.6, 23.6 min). Code changed: the sets start again. |
| 2 (11 October, 17:21–18:22) | 7fa2438 | 3 | Three in a row: 124/124 each (20.2, 20.4, 20.2 min). “The destination stream closed early” 15, 11 and 15 times (known noise, also on `main`). |

## Manual checklist (Łukasz)

Fresh demo data, then the app on the preview data file:

PowerShell:

```powershell
$env:INFOMAPPER_DEV_DB=".data/preview-db.json"; npm run reset-dev-data; npm run seed:large; npm run dev
```

bash:

```bash
export INFOMAPPER_DEV_DB=.data/preview-db.json && npm run reset-dev-data && npm run seed:large && npm run dev
```

Open http://localhost:3000/sign-in, pick Łukasz, open Retail Co – DWH › Customer 360 › Customer & orders, unless a step
says otherwise.

- [ ] **S3A-01** Select Customer. In its panel's Labels field type `cr 23`: the list shows “Create “cr-23”” first (the
  demo CR-23 is there too, so here it offers CR-23 instead: open the CR-23 chip, “Delete label”, then type `cr 23`
  again). Press Enter: the chip cr-23 appears and the cursor stays in the field. Ctrl+Z (outside the field): it is
  gone; Enter again. Click the `email` row: type `CR`: “Create “CR”” first, then cr-23 with “1 item”; pick cr-23.
  Click its ×: gone; Ctrl+Z: back.
- [ ] **S3A-02** Select Sales Order and type `JIRA-900`, Enter. Then click one of its attribute rows, the table
  order_header, one of its columns and a mapping line, and type `jira-900` (or `Jira-900`) in each: the list offers the
  existing JIRA-900, never “Create”. Open the label: “Marks 1 entity, 1 attribute, 1 table, 1 column, 1 mapping.”
- [ ] **S3A-03** At about 50 % zoom: the tag mark on the rows `email`, `segment_code` and `customers.email_addr`, on the
  headers of Customer and customers, and a tag on one mapping line; hover each for “Working labels: …” or “Labels: …”.
  Zoom out below 40 %: the row marks and the line tag go, the header marks stay.
- [ ] **S3A-04** Open CR-23 from Customer's chip: the sentence, then Entities, Attributes, Mappings; click an item to
  open it. Rename CR-23 to `jira-481`: refused, the name stays; rename to `CR-24`: saved. “Delete label”: the toast
  “Deleted the label CR-24.”, the marks are gone, nothing else changed; Undo in the toast: all back.
- [ ] **S3A-05** Open the project Order management (Home): Labels in this project lists CR-23 and JIRA-481; click the ☆ of
  JIRA-481: it goes first with ★; reload: still first; click ★: back in place. “2 open notes” and the list “Open notes”;
  click “Which order statuses …”: Customer & orders opens with that note selected. Resolve both open notes, go Home:
  “No open notes on this project’s canvases.”
- [ ] **S3A-06** Press N, press Esc on the new note: nothing stays, Undo unchanged. N, click the empty canvas, type,
  Ctrl+Enter: a yellow note. N on a card: a note to its right with a dashed tether. Draw a frame (A), N on its name: a
  note on the frame; collapse it, N on the block: a note on the block. Right-click the empty canvas, a card and a frame:
  “Add a note here”, “Add a note to this”, “Add a note to this frame”; select a card: “Add a note” in its Notes section.
- [ ] **S3A-07** Double-click a note, change the text, Ctrl+Enter; double-click again, type, Esc (nothing changes). Drag
  its right edge. Right-click it: Colour; select it: Colour in the panel. Its ✓, “Mark as resolved” / “Reopen” in the
  toolbox, Status in the panel. After each change Ctrl+Z undoes exactly that change.
- [ ] **S3A-08** Drag the blue free note into a frame, drag the frame: the note moves with it; collapse the frame: the
  note is hidden; expand it. Drag order_line: its notes follow, with their tethers. Right-click a pinned note, “Unpin
  (make it a free note)”: it stays where it is. Select order_line, “Remove from this canvas”: its other note stays as a
  free note.
- [ ] **S3A-09** order_line's header shows a note icon with 2 (its open and resolved notes); its panel's Notes lists
  both. A frame's panel lists the notes pinned to it; collapsed, its block shows “N notes”. Press Esc: the overview's
  “Notes on this canvas” lists the open notes. Untick “Show resolved notes on the canvas”: the resolved note goes, the
  header shows 1, Undo unchanged; reload: still hidden; sign in as Piotr: he sees it.
- [ ] **S3A-10** Click a note; Shift+click a card and another note (“N selected”); lasso around a free note; Ctrl+A (free
  notes outside frames are in, pinned ones not); drag the group by a card or a note; arrow keys, then one Ctrl+Z; a
  pinned note whose card is in the group moves once. A free note in a frame: a lasso around the whole frame selects the
  frame only. Select a note, Delete: “Note deleted” with Undo.
- [ ] **S3A-11** Canvas tab menu (⋯) › “Duplicate layout”: the toast “Duplicated Customer & orders. Only the layout is
  copied; the model is shared.”; the copy has no notes; back on the original, the notes are as before.
- [ ] **S3A-12** Select Customer, “Delete entity”, confirm. Ctrl+Z: Customer is back and the CR-23 marks on it, `email`,
  `segment_code` and the mapping line are back too (CR-23's panel says “Marks 1 entity, 2 attributes, 1 mapping.”).
- [ ] **S3A-13** As Piotr: labels show as chips without × or input, the label panel is read-only, the project home has
  no pin stars (a pinned label shows a plain ★); notes: the Note tool works, he edits, resolves, moves and deletes
  notes. As Kasia: no Note tool, notes cannot be moved, edited or resolved, a right-click on a note opens nothing, the
  note panel is read-only, no “Add a note”, labels read-only.

And the definition of done: label the Customer mappings of a change request on Customer & orders, open the label and
walk its items, write three notes (one free in a frame, one pinned to a card, one on a frame), resolve one, hide resolved
notes, collapse the frame with notes, duplicate the layout, and undo the label's deletion.

## Changes to `docs/decisions.md`

Proposed in step 5; **approved by Łukasz on 11 October 2026** with two changes (D-21 and D-29 as below) and
applied in this pull request. The proposals as first written:

1. **AD-05**, replace: “Five roles per workspace: owner, admin, modeler, reviewer (read, comment, notes, approve),
   reader.” with: “Five roles per workspace: owner, admin, modeler, reviewer (read, comment, notes, approve), reader.
   Reviewers write, resolve, move, pin and delete any note as modelers do; working labels are changed by owners, admins
   and modelers only; readers read notes and labels.”
2. **D-20**, append: “Duplicate layout copies no notes. A note joins a frame only when dropped in it (drawing,
   resizing or fitting a frame never moves or claims notes). A note whose card or frame leaves the canvas stays as a
   free note at its place, in no frame.”
3. **D-21**, replace: “Notes are open or resolved; resolved ones can be hidden; an empty new note disappears.” with:
   “Notes are open or resolved; resolved ones can be hidden, a preference of each person in their browser (not saved,
   not an undo step); an empty new note disappears. Every note change is one undo step; anyone who may write notes
   edits any note, and its panel names who wrote it.”
4. **D-53** (new, under Working layer): “A count of notes (a card's header, a collapsed frame's block) shows the notes
   you would see: open ones, and resolved ones while they are shown. Notes take part in the selection: a lassoed frame
   stands for its free notes, Ctrl+A takes the free notes outside frames, and a pinned note moves with its card or
   frame, never twice.”
5. **D-24**, append: “Merging mappings keeps the labels of the merged ones on the mapping that stays.”
6. **D-29**, append: “Pinning a label to a project is saved with its change event but is not an undo step (no undo
   outside canvases yet).”

As applied: AD-05, D-20, D-53 and D-24 as proposed; D-21: “Notes are open or resolved; resolved ones can be hidden, a
preference kept per person in their browser only (not on the server, not an undo step); an empty new note disappears.
Every note change is one undo step; anyone who may write notes edits any note, and its panel names who wrote it.”; D-29:
the proposal plus “Roles without label rights see a pinned label's plain ★, not the pin control.” The late-page race for
frames and cards (step 5, item 4) is in `docs/known-limitations.md` (Łukasz: not fixed in this slice).

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
   `web_users`; step 4: below `order_line` instead of to its right, so Fit everything, which counts notes, keeps the
   first view of the earlier tests above 40 % zoom). No label is
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
   (`im-review-strong`), the nearest to the prototype's. *Changed after step 3 (Łukasz):* the star is offered only to
   roles with label rights, as the app hides other actions a role can't take; for the others a pinned label keeps a
   plain, non-clickable ★ (“Pinned to this project”) and an unpinned one an empty slot. Łukasz's decision (11 October,
   after checking `46ac76f`): the plain ★ stays; it shows state, not an action, so it has no hover effect and no
   pointer cursor.

**Accepted by Łukasz on 10 October 2026** after his manual check of step 2 (all steps, as Łukasz, Piotr and a reader).
Open question from step 2, answered after step 3 (Łukasz): a labeled entity's card header shows the tag mark too, at
every zoom like a table header (prototype `lmark("entity", …)`); PRD item 3 now says so.

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
   panel's fields are for editors and reviewers; readers see notes and their panel read-only, and a right-click on a
   note opens no toolbox for them (a toolbox that offers nothing is not opened, as elsewhere in the app; corrected in
   step 5, the first text said “only its heading”).
9. **A new card is not placed under a note:** the free spots for cards placed from the left panel or the panels avoid
   the notes drawn, as the prototype's `freeSpot` does.
10. **Not yet:** the card's and frame's “Notes” panel section with its “Add a note” (item 12, step 4), the note count on
   card headers and blocks (step 4), Fit everything counting notes (item 14, step 4).

**Accepted by Łukasz on 11 October 2026** after his manual check of step 3, with two follow-ups to step 2 (both in
`46ac76f`, then `f5acb59`): the tag mark on a labeled entity's card header, and the pin star only for roles with label
rights (step 2, item 6).

### Step 4 (notes elsewhere, selection, permissions)

1. **`seed:large` adds a working layer to “Performance test”** (the data part of S3A-14, done first): five labels
   `PERF-1` to `PERF-5` on 25 attributes, 25 columns and 30 mappings (every tenth) and on five entity and five table
   headers; 24 notes, 12 pinned (one card in each of the 8 frames, and the first 4 frames above their name) and 12 free
   (6 inside frames, 6 between the frames and the cards in no frame), every fourth resolved. The notes lie on spots that
   touch no card, frame name or other note, so the measuring tests' clicks, drags and lassos are not caught by a note.
   `seed:large` still adds nothing to a file that has “Performance test” already: `npm run reset-dev-data` first. The
   measuring tests seed a fresh file, so they get the notes.
2. **A card's header** shows the number of its pinned notes that are shown: a note icon, the number from two on, the
   tooltip “N notes pinned here”; at every zoom, like the rest of the header; it takes room when deciding whether the
   first line needs clipping. Open notes count, resolved ones only while “Show resolved notes on the canvas” is on.
   *Łukasz's decision after step 4*, unlike the prototype's `noteMark` (open notes only): one rule everywhere, a count
   shows the notes you'd see.
3. **A collapsed block's “N notes”** counts the notes pinned to the frame and the free notes in it that are shown: the
   open ones, and the resolved ones only while “Show resolved notes on the canvas” is on, as the block's last chip.
   *Łukasz's decision after step 4*, unlike the prototype's `blockCard`, which counts resolved notes always; it keeps
   the block's number in line with what the canvas shows and with the card header's count (item 2, the same rule).
4. **The “Notes” section** (prototype `notesHere`) is in the entity and table panels before “On canvases”, and in the
   frame panel before “In this frame”. It lists the notes pinned to that card or frame (first line or “Empty note”,
   “open” or “resolved”); “Add a note” pins a new note there. Readers get the section only when there are notes, and no
   “Add a note”.
5. **A note link in a panel** (the Notes section, the canvas overview) selects the note and, when it is shown but out of
   view, brings it into view at the same zoom (the prototype only selects it; a link that changes nothing visible
   seemed wrong).
6. **“Notes on this canvas”** is a folding section of the canvas overview, before the frames (the prototype's order),
   with the number of open notes; “Show resolved notes on the canvas” is offered when the canvas has notes, as in the
   prototype. Hiding resolved notes is kept in this browser per person (`infomapper:notes:hide-resolved:<user id>`) and
   holds for every canvas (the prototype's `V.hideResolved` is not per canvas either). A hidden note leaves a selection
   of several; a note selected alone stays selected.
7. **The project home** shows “N open notes” after the mapped attributes (the prototype's order) and “Open notes” after
   the labels: canvas by canvas in tab order, oldest first, each with its canvas's name and “, on {card or frame}”. A
   click opens the canvas with `?note=<id>`: the note is selected and centred at 100 % (the prototype fits a box around
   it); a note in a collapsed frame is selected without moving the view.
8. **Notes in the selection (item 13):** a click selects a note; Shift+click puts it in or out of a selection; a lasso
   catches a note fully inside it unless its frame is caught (a pinned note has no frame, so it is caught on its own, as
   in the prototype); Ctrl+A takes the free notes shown in no frame. A selection moves by dragging any of its cards,
   frames or notes, and by the arrow keys; a free note in a moving frame goes with its frame, a pinned note with its
   card or frame (also a card carried by its frame), so nothing moves twice. A note selected alone moves with the arrow
   keys too (prototype `nudge`). Align, stack, line up, fit widths, “Put in a new frame” and “Remove from this canvas”
   leave notes alone; the selection panel counts and lists them (“2 tables, 1 note.”).
9. **One change group, one undo step:** a selection with cards or frames is saved by `moveOnCanvas`, which now takes
   the selected notes too (they need note rights; a free one joins the frame it lands in, among the frames after the
   move); notes alone by a new command, `moveNotes`. Undo labels: “Move notes”, and “Move selection” for notes with cards
   or frames.
10. **Who may move what:** reviewers move only the notes of a selection (cards and frames stay where they are); readers
   move nothing. A right-click on a note of a selection opens the group's toolbox; Delete with several items selected
   does nothing, as in the prototype (it deletes a single selected note).
11. **Fit everything** (F, and the first view of a canvas without a remembered view) counts the notes shown.
12. **Fixed from step 3:** below 40 % zoom a note's plain body took its height from the note's last measure, its bottom
   margin added 8 px, and the note was measured again: every note grew by 8 px about once a second and the canvas
   re-rendered while idle. A note is no longer measured while it draws its plain body, which now keeps the measured
   height.
13. **The demo's pinned notes moved below `order_line`** (step 1, item 9): to its right they widened what Fit
   everything takes in, and the first view of “Customer & orders” fell below 40 % zoom, where rows are not drawn (the
   first step 4 run failed seven slice 1a tests on that).
14. **Not built:** the prototype's miniature (`renderMini`) draws notes; the PRD does not list it, so the Overview's
   miniature shows none. Łukasz after step 4: not in this slice; in `docs/ideas.md` (slice 3b or the minimap slice,
   with its own measurement).
15. **A guard for the idle growth** (item 12 above): `e2e/slice-03a/S3A-14-idle.spec.ts` opens Customer & orders at
   30 % zoom with the demo's notes, once with a frame expanded and once with two frames collapsed, and checks that the
   canvas commits nothing and no note changes its size during three idle seconds (it fails on step 3's code). S2C-12
   did not catch the growth: it was written in slice 2c, before there were notes, and it opens and zooms at or above
   45 % (`FRAMED`, then zooming in), where notes draw their whole body and are measured normally; the growth only
   happens below 40 %, where a note draws its plain body.

**Assumptions 5, 7 and 13 and the changes to S2A-02, S2B-08 and S2C-08 accepted by Łukasz on 11 October 2026.**

**Step 4 accepted by Łukasz on 11 October 2026** after his manual check, including the count rule (items 2 and 3).

### Step 5 (acceptance tests and wrap-up)

1. **Texts the tests read:** a refused rename names the label as it is stored (“Another label is already called
   “JIRA-481”.” for a typed `jira-481`); the project home writes “this project’s” with a typographic apostrophe, like
   the rest of the app (the PRD has a straight one).
2. **A correction to step 3, item 8:** for readers a right-click on a note opens no toolbox: the app never opens a
   toolbox that offers nothing. The earlier text said “only its heading”.
3. **S3A-14 in the e2e suite:** the round itself is `measure:canvas`; `S3A-14.spec.ts` checks the data part (what
   `seed:large` adds is on the canvas) and `S3A-14-idle.spec.ts` is the idle guard from step 4. S3A-15 is the CI and
   the three runs, with no spec of its own.
4. **Fixed: a late fresh page hid notes written meanwhile.** The first set of full runs failed S3A-13 twice: a note
   created right after a label write was saved but vanished from the canvas until a reload. The label write's
   re-rendered page had read the notes before the note existed and arrived after it, and the canvas took the page's
   notes as they were. The page now passes the time it read the notes (`notesReadAt`), and the canvas keeps notes
   created after that, its own newer versions and its own deletions (`mergeServerNotes` in `note-data.ts`, with unit
   tests); an undo still wins, because it writes a newer version or removes a note created before the page's read.
   Frames and cards have the same kind of merge already for writes on their way; they were not changed.
5. **Test views:** the tests that work on the right of Customer & orders (the demo notes, order_line) open it at 50 or
   60 %, scrolled right, so every note they touch is above the status bar; a frame's name at the top of the canvas
   needs slice 2b's `FRAMED` view.

## S3A-14: rounds against slice 2c

Each sitting is one quick round (`--quick`: pan and zoom, C-08, C-10 and the lasso marks) of `npm run measure:canvas` in
the production measurement build, headed Chrome, 1536 × 864, on the development laptop (the reference machine, AD-24),
this branch against `slice-02c` (`10907f4`) in `../infomapper-ab-main`; mains power, “Best performance”, the machine quiet
before each side (each sitting's `sitting.json`). Łukasz prepared the laptop. **The `slice-02c` side runs “Performance
test” without labels and notes** (its `seed:large` has none), so the comparison includes the cost of that content (24
notes, labels on 50 rows, 30 mappings and 10 headers), as S3A-14 intends.

### After step 4 (11 October, 12:56 and 13:06, at `ed7befe`)

Frames expanded, sitting `.data/measure/2026-10-11-12-56`:

| Figure | Bar | slice-02c | This branch | Change | Result |
| --- | --- | --- | --- | --- | --- |
| Pan and zoom at the overview | ≥ 50 fps, ≥ −5 % vs reference | 59.5 | 59.7 | +0.3 % | met |
| – frames over 50 ms | ≤ 0 | 0 | 0 | – | met |
| Pan and zoom at 100 %, dense area | ≥ 50 fps, ≥ −5 % vs reference | 52.1 | 49.2 | −5.6 % | not met (tool's bar); within S3A-14's “about 10 %” |
| – frames over 50 ms | ≤ 0 | 4 | 9 | – | not met (slice 2c misses it too) |
| Initial render (C-08), median of 5 | ≤ 1500 ms | 1425 | 1485 | +4.2 % | met |
| Hover to the next frame (C-10), median of 40 | ≤ 100 ms | 136 | 119 | −12.6 % | not met (as before) |
| Marks after a lasso, median of 20 | ≤ 100 ms | 68 | 28 | −59.6 % | met |

All frames collapsed (`--branch-diag collapsed`, this branch's side only), sitting `.data/measure/2026-10-11-13-06`:

| Figure | Bar | slice-02c | This branch (collapsed) | Change | Result |
| --- | --- | --- | --- | --- | --- |
| Pan and zoom at the overview | ≥ 50 fps, ≥ −5 % vs reference | 59.2 | 60.0 | +1.4 % | met |
| – frames over 50 ms | ≤ 0 | 0 | 0 | – | met |
| Pan and zoom at 100 %, dense area | ≥ 50 fps, ≥ −5 % vs reference | 51.5 | 59.9 | +16.3 % | met |
| – frames over 50 ms | ≤ 0 | 9 | 0 | – | met |
| Initial render, hover, lasso marks | – | 1425 ms, 136 ms, 95 ms | – | – | not applicable |

**Reading.** Expanded, the overview is level with `slice-02c` and with slice 2c's accepted figure (59.7). At 100 % the
branch is 5.6 % below (49.2 against 52.1 fps; slice 2c's accepted figure was 52.0) with 9 long frames against 4: inside
S3A-14's “no more than about 10 % below”, just past the tool's 5 %. One round cannot tell whether it is real; the same
reference build had 4 long frames in the first sitting and 9 in the second. The initial render, 1485 ms, is just under
1500 ms. Collapsed, the branch matches slice 2c's accepted figures (60.0 and 60.0 fps, no long frame): notes and labels
on blocks cost nothing measurable. The lasso marks (28 against 68 ms) are faster with nothing in step 4 to explain it;
read as the noise of one round. The S2C-12 guard and the new idle guard (item 15) passed in the full e2e runs.
**Łukasz:** no extra round now; the step 5 round confirms. If, frames expanded, 100 % is again 5 % or more below
`slice-02c` with clearly more long frames, or C-08 is over 1500 ms, the cause is found before merging.

### Step 5 confirmation (11 October, 16:28 and 16:37, at `45eb772`)

Frames expanded, sitting `.data/measure/2026-10-11-16-28`:

| Figure | Bar | slice-02c | This branch | Change | Result |
| --- | --- | --- | --- | --- | --- |
| Pan and zoom at the overview | ≥ 50 fps, ≥ −5 % vs reference | 59.3 | 59.6 | +0.5 % | met |
| – frames over 50 ms | ≤ 0 | 0 | 0 | – | met |
| Pan and zoom at 100 %, dense area | ≥ 50 fps, ≥ −5 % vs reference | 51.7 | 49.1 | −5.0 % | not met |
| – frames over 50 ms | ≤ 0 | 4 | 12 | – | not met |
| Initial render (C-08), median of 5 | ≤ 1500 ms | 1502 | 1512 | +0.7 % | not met (slice-02c too) |
| Hover to the next frame (C-10), median of 40 | ≤ 100 ms | 146 | 120 | −17.6 % | not met (as before) |
| Marks after a lasso, median of 20 | ≤ 100 ms | 89 | 34 | −62.2 % | met |

All frames collapsed (`--branch-diag collapsed`), sitting `.data/measure/2026-10-11-16-37`:

| Figure | Bar | slice-02c | This branch (collapsed) | Change | Result |
| --- | --- | --- | --- | --- | --- |
| Pan and zoom at the overview | ≥ 50 fps, ≥ −5 % vs reference | 59.5 | 59.9 | +0.7 % | met |
| – frames over 50 ms | ≤ 0 | 0 | 0 | – | met |
| Pan and zoom at 100 %, dense area | ≥ 50 fps, ≥ −5 % vs reference | 51.4 | 60.0 | +16.7 % | met |
| – frames over 50 ms | ≤ 0 | 7 | 0 | – | met |
| Initial render, hover, lasso marks | – | 1428 ms, 145 ms, 94 ms | – | – | not applicable |

**Reading.** Expanded, 100 % is again 5 % below `slice-02c` (−5.0 %, after −5.6 % in step 4) with clearly more long
frames (12 against 4, after 9 against 4): Łukasz's condition holds, so the cause is looked for before merging (below).
C-08 is 1512 ms, over 1500 ms, but `slice-02c` took 1502 ms in the same sitting (1425 ms in step 4's), so this sitting's
initial render is slower on both sides; the branch is +0.7 %. Collapsed is unchanged from step 4 and slice 2c.

### Looking for the cause (11 October, after the confirming rounds)

1. **Nothing re-renders while panning and zooming** on “Performance test” at 100 % (dev server, `__imCanvasCommits`
   unchanged by wheel pans and Ctrl+wheel zooms): the cost is in drawing, not in React.
2. **The notes and the label marks are not the cost.** Two measurement-only switches were added (`DIAG=nonotes`: the
   page passes no notes; `DIAG=nolabelmarks`: no label names, so no mark on rows, headers or lines), and S1A-14 was
   measured four times in the measurement build on this branch (`.data/measure/diag-3a`, run logs): 100 % at 48.5 fps
   with 10 long frames as it is, 49.0 / 9 without notes, 46.7 / 5 without label marks, 48.1 / 11 without both. With
   neither, the branch is no faster, so what slice 3a draws there does not explain the gap.
3. **The rounds are not balanced.** A one-round sitting measures `slice-02c` first and this branch second
   (`measure-canvas.ts`: odd rounds start with the reference). In this sitting the laptop got slower as it went: C-08
   was 1502 ms on the reference, 1512 ms on the branch, then 1701 and 1761 ms in the diagnosis runs that followed. A
   slowing machine puts the branch side behind; the four diagnosis runs were sequential, so they share that drift and
   are not an A/B against `slice-02c`.
4. **Next (needs a prepared laptop and Łukasz's go):** two rounds per sitting, so each side runs first once:
   `npm run measure:canvas -- --quick --rounds 2 --against slice-02c`, and the same with
   `--branch-diag nonotes,nolabelmarks`. If the branch is level with `slice-02c` in balanced rounds, the gap was the
   order; if it stays 5 % below with both switches on, the cost is in code shared by every view (to look for next with
   Chrome traces, as in slice 2c); if it closes only with the switches, it is the content after all.
5. **Balanced sittings (Łukasz's go, 11 October, two rounds each, at `ae4d995`).** As it is, sitting
   `.data/measure/2026-10-11-16-56`: overview 59.4 against 59.7 (−0.5 %), 100 % 48.6 against 51.0 (−4.8 %) with 10
   long frames against 6, C-08 1474 against 1440 ms (+2.4 %), C-10 120 against 148 ms, lasso marks 28 against 76 ms.
   With `--branch-diag nonotes,nolabelmarks`, sitting `.data/measure/2026-10-11-17-14`: overview +0.4 %, 100 % 48.0
   against 51.1 (−6.2 %) with 9 long frames against 9, C-08 1549 against 1384 ms. The order is not the cause; the
   sitting with both switches did not close the gap either.
6. **Chrome traces of 6 s of S1A-14's 100 % pan and zoom** (measurement builds, this branch and `slice-02c` in turns;
   traces and logs in `.data/measure/diag-3a`; a temporary spec, not committed): every frame runs the whole paint
   lifecycle (about 13 ms) and Layerize (about 9–11 ms) over everything in the viewport, so their cost follows the
   number of elements there. As it is, the branch has 19,613 elements against 18,913 (24 notes of about 12 elements
   each; about 60 label marks of 4 elements and 30 line tags of 3, with their titles: about 700 in all); Layerize takes
   10.4–10.6 ms per frame against 9.2 ms (+13 %), and the branch draws 264–274 frames in 6 s against 287–290 (about
   −6 %). With both switches the branch has 18,915 elements, Layerize 9.3–9.6 ms against 9.3 ms, and 276–282 frames
   against 290 (about −3 %, close to the spread between runs).
7. **Reading.** The cost is the content slice 3a puts on the canvas: notes and label marks are more elements in a
   viewport that is painted and layerized whole on every pan and zoom frame (the same mechanism as slice 2c's frame
   labels). What remains with both switches (about −3 % in the traces, −6.2 % in one balanced sitting) is within the
   spread these figures have shown. S3A-14's bar is “no more than about 10 % below `slice-02c`”: −4.8 % in a balanced
   sitting meets it; Łukasz's extra condition (5 % or more below with clearly more long frames) is at its edge
   (−4.8 %, 10 against 6). Options, for Łukasz to choose:
   - **(a) Accept** as it is: within S3A-14's bar; recorded here and in `docs/known-limitations.md`.
   - **(b) Fewer elements per mark:** a label mark as one element (its tag icon a CSS mask on the `<i>` instead of an
     inline SVG of three elements), a line tag as one path: about 270 fewer elements, the same look. Then a balanced
     sitting again.
   - **(c) The notes in their own composited layer** (the note layer promoted, so the cards' paint and Layerize no
     longer include them): to be measured; it may cost GPU memory or raster time instead, and touches AD-24's rules on
     layers.

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
- `src/canvas/labels.test.ts`: a labeled entity's header has the tag mark now (step 2 follow-up).
- `src/data/local/model-store.test.ts`: `seed:large` also checks the labels and notes it adds (step 4).
- `src/canvas/selection.test.ts`: the units a selection moves have a `notes` list (step 4).
- `e2e/slice-02a/S2A-02.spec.ts` and `e2e/slice-02b/S2B-08.spec.ts`: Ctrl+A also selects the demo's free note in no
  frame (item 13), so the counts, kinds and names include it (step 4).
- `e2e/slice-02c/S2C-08.spec.ts` (Fit everything with all cards in one collapsed frame): Fit everything also takes in
  the demo's free note outside the frame (item 14), so the test checks that the block and the note are both in the
  view instead of the block being in the middle (step 4).
