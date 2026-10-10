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
4. **Merging mappings drops the labels of the mappings that go** (soft-deleted in the merge's change group), as the
   prototype drops links to missing items. The kept mapping keeps its own labels.
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
   (blue), one by Piotr pinned to Customer, and one by Anna pinned to `web_users`, which Łukasz resolved. No label is
   pinned to a project (the prototype pins CR-23 and JIRA-481; S3A-05 starts from no pins).

## Changes to earlier tests

- `src/domain/permissions.test.ts`: the role matrix gains `label.edit` (owner, admin, modeler) and `note.edit` (owner,
  admin, modeler, reviewer) (step 1).
- `tests/schema/compare-schema.test.ts`: `label`, `label_link`, `project_pinned_label` and `note` are now described by
  the domain (step 1).
- `src/domain/commands/undo.test.ts` and `frame.test.ts`: their row sets include the four new undoable tables (step 1).
