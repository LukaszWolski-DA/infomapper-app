# Slice 3a – Working labels and notes

Status: ready once Łukasz confirms it · Branch: `slice/03a-labels-and-notes` · Builds on: slice 2c (`main` at
`10907f4`, tag `slice-02c`)
Decisions: D-08, D-09, D-17, D-19, D-20, D-21, D-24, D-29, D-35, D-52, AD-05, AD-12, AD-13, AD-15, AD-17, AD-23,
AD-24 (incl. rule 4 and the slice 2c finding on frame label width), AD-30

## Goal

Give analysts a working layer on top of the model: **working labels** (e.g. `CR-23`, `JIRA-481`) that mark the
entities, attributes, mappings, tables and columns a ticket or change request touches, kept apart from the model's
own tags (D-08); and **notes** on the canvas, free or pinned to a card or frame, open or resolved, for summaries,
observations and questions (D-20, D-21). Labels are assigned by hand in this slice (D-09). The active working context
that labels changes automatically (D-26) and live label canvases (D-10, D-11, D-25) are **slice 3b**.

## Reference

- Behaviour: `docs/prototype/infomapper-model-prototype.html`:
  - labels: `normLabel`, `lmark`, `labelField`, `showLblSug`, `applyLabel`, `removeLabel`, `lineTag`, `insLabel`, the
    `lbl-open`, `lbl-rm` and `lbl-del` actions, `projLabels` and the labels on the project home (`renderHome`);
  - notes: `NOTE_COLORS`, `notePos`, `noteVisible`, `setNoteXY`, `renderNotes`, `positionNotes`, `tethers`,
    `noteMark`, `createNote`, `placeNoteAt`, `afterNoteDrop`, `deleteNote`, `unpinNote`, `startEditNote`,
    `notesHere`, `insNote`, the note toolbox and the “Add a note …” entries in `ctxFor`, the note drag and width
    resize (`D.type` `note` and `nresize`), notes in `movingItems`, `lassoHits`, `selectAll`, the canvas overview's
    “Notes on this canvas” with “Show resolved notes on the canvas”, the note chip on a collapsed block (`blockCard`),
    and the open notes on the project home.
- Data: `label`, `label_link`, `note` and `project_pinned_label` in `docs/data-model-v2.md` and the migration.
  Values follow the data model (`note.status`: `open`, `resolved`; `note.color`: `yellow`, `blue`, `green`, `pink`,
  `grey`), not the prototype's names.
- Rich text: until the rich-text editor arrives with requirements (AD-30, slice 4), note text is plain text stored in
  `body_html` and `body_text` like the definitions today. The prototype's “Edit with formatting…” is not built.

## In scope

### Labels

1. **Labels in domain and data.** `Label` and `LabelLink` types and commands; the local adapter gets `label`,
   `label_link` and `project_pinned_label` with their keys, the case-insensitive unique name (`name_key`, written by
   the server), and the “exactly one target” check on `label_link` (entity, attribute, mapping, source table or
   source column, AD-15). Labels and label links are undoable. The schema check's “not built yet” list shrinks
   accordingly.
2. **The Labels field.** In the panels of an entity, attribute, mapping, source table and source column: a “Labels”
   field with the item's labels as chips (tag icon, name as a link to the label, × to remove) and an input
   (“Add a label, e.g. CR-23” / “Add another…”) with suggestions as in the prototype: what you type comes first as
   “Create “{name}”” when no label has that name; existing labels below it, sorted by exact match, then by how many
   items they mark, then by name, at most 8, each with “N items”; ↑/↓ and Enter pick; the input keeps focus after
   adding or removing. Names are normalised as in the prototype (trimmed, commas removed, spaces become hyphens, at
   most 60 characters). Hint: “Working labels for tickets and change requests. Kept apart from the model definition.”
3. **Marks.** A small tag mark on a labeled attribute row, column row and table header, and on a labeled mapping
   line (prototype `lmark`, `lineTag`), with the label names as a tooltip. Marks follow AD-24 (no opacity on
   repeated elements; nothing zoom-dependent on the canvas root) and are left out below 40 % zoom like other row
   details.
4. **The label panel.** Opening a label (its chip) shows “Working label”, its name (editable; renaming keeps the
   unique rule), “Marks 2 entities, 3 attributes, 1 mapping.” or “Not used anywhere yet.”, the sentence “Labels belong
   to your working context, not to the model.”, the marked items grouped by kind (Entities, Attributes, Mappings,
   Tables, Columns) as links, and “Delete label” with “Deleting takes the label off every item. The model is
   untouched.” Deleting asks no question, shows the toast “Deleted the label {name}.” with Undo, and is one undo step.
   The prototype's “Open as live canvas” is slice 3b and not shown.
5. **Labels on the project home (D-29).** The project home lists the labels used on its canvases (prototype
   `projLabels`: pinned ones first, then by how many items they mark), each opening the label; a label can be pinned
   to and unpinned from the project (`project_pinned_label`). A pinned label stays listed when no canvas of the
   project uses it any more (as in the prototype). Pinning and unpinning write a change group with their change
   events; the project home has no undo (Łukasz, Step 0).

### Notes

6. **Notes in domain and data.** A `Note` type and commands; the local adapter gets `note` with its keys and the rules
   the SQL cannot express: a note's canvas is the canvas of the card or frame it is pinned to and of the frame it
   belongs to; at most one pin. Notes are undoable. `resolved_at` and `resolved_by` are set by the server.
7. **Creating notes.** The Note tool (toolbar button and N): a click on the empty canvas makes a free note there; a
   click on a card, a frame's name strip or a collapsed block pins the note to it, placed to its right. Also: “Add a
   note here” (empty canvas toolbox), “Add a note to this” (card toolbox), “Add a note to this frame” (frame toolbox),
   and “Add a note” in the card's and frame's “Notes” panel section. A new note is yellow, 220 px wide, opens for
   typing (“Summary, observation or question…”), and is selected. **An empty new note disappears** when editing ends
   (D-21), leaving no saved note and no undo step. The tool turns off after one note; Esc cancels.
8. **The note on the canvas.** Header: a note icon, “Note” or “on {card or frame}”, a ✓ button (“Mark as resolved” /
   “Reopen”). Body: the text (first lines, as the prototype) or “Empty note”. Footer: the creation date and
   “resolved” when resolved. A double-click edits the text in place (Ctrl+Enter or a click outside saves, Esc
   cancels); the right edge changes the width. Resolved notes look resolved without opacity (AD-24).
9. **Free and pinned notes (D-20).**
   - A free note is moved by dragging and joins the frame it is dropped in (by the point the prototype uses in
     `afterNoteDrop`); it moves with its frame and is hidden while that frame is collapsed.
   - A pinned note keeps an offset from its card or frame, follows it while it is dragged, and is linked to it by a
     dashed tether drawn in the SVG line layer (AD-24 rule 3). Dragging a pinned note changes its offset.
   - A note pinned to a card hidden in a collapsed frame is hidden; a note pinned to a collapsed frame follows its
     block.
   - When the pinned card leaves the canvas or the frame is deleted, the note stays as a free note at its place, in
     the same change group.
   - “Unpin (make it a free note)” in the note toolbox and panel; the panel's “Pin to” picks a card or frame on this
     canvas.
10. **The note toolbox (D-19).** Header “Note” or “Note on {name}”; “Edit text” (Dbl-click), “Mark as resolved” /
    “Reopen”, “Colour” (the five colours), “Unpin (make it a free note)” when pinned; then “Delete note” (Del).
11. **The note panel.** “Note on this canvas”; the text (plain-text field); “Status” Open / Resolved; “Colour”;
    “Attached to” (the pinned card or frame as a link, with Unpin) or “A free note[, inside the frame {name}].” with
    “Pin to”; “Created {date}. Notes belong to this canvas and to your working layer, not to the model.”; actions
    “Edit on the canvas” and “Delete note”. Deleting shows the toast “Note deleted” with Undo.
12. **Notes elsewhere.**
    - A card's header shows the number of open notes pinned to it (prototype `noteMark`); the card and frame panels
      have a “Notes” section listing them (first line, open or resolved) with “Add a note”.
    - A collapsed frame's block shows “N notes” in its footer chips (the notes pinned to the frame and the free notes
      inside it). The frame **label** gets no note chip in this slice (slice 2c finding: a wider frame label costs GPU
      time at the overview).
    - The canvas overview's “Notes on this canvas”: the open notes as links (first line, what they are pinned to),
      “All N notes are resolved.”, or “No notes yet. Use the Note tool (N) or right-click the canvas or a card.”, and
      the checkbox “Show resolved notes on the canvas”. Hiding resolved notes is a per-user browser preference (data
      model, section 12), not a canvas setting and not an undo step.
    - The project home shows the number of open notes on its canvases and, as in the prototype (`renderHome`), the
      list “Open notes”: each note's first line or “Empty note” and its canvas's name (“, on {card or frame}” when
      pinned); a click opens that canvas with the note selected; without open notes: “No open notes on this
      project's canvases.” (Łukasz, Step 0)
13. **Notes and the selection (D-17).** A click selects a note; Shift+click adds it to a selection; a lasso that fully
    contains a free note selects it, unless its frame is caught as well (the frame stands for it); Ctrl+A also selects
    the visible free notes that are in no frame and not pinned. In a group, notes move with group drag and nudge; a
    pinned note whose element is also moved follows it instead of moving twice. Delete or Backspace deletes a selected
    note. Align, stack, line up and fit widths act on cards and frames only, as in the prototype.
14. **Notes and the rest of the canvas.** Moving a frame moves its free notes; Duplicate layout does **not** copy
    notes, as in the prototype's `dupDia` (Łukasz, Step 0: notes are loose remarks about a canvas, not part of its
    layout): the copy starts with no notes, the original keeps all of them, and the toast stays “Duplicated {name}.
    Only the layout is copied; the model is shared.”; Fit everything and content bounds count visible notes; “Remove
    from this canvas” of a card turns its pinned notes into free notes.

### Both

15. **Permissions (AD-05).** See “Questions before Step 1”. Direct server calls outside a role's rights are refused
    with the domain's message and change nothing.

## Out of scope

Active working context and automatic labels (D-26), live label canvases, “Open as live canvas”, the `labeled` row
filter and `live_level` (slice 3b) · rich-text notes and “Edit with formatting…” (slice 4, AD-30) · promoting a label
to a requirement (D-33, later) · the view-state bar's “Resolved notes hidden” item (D-39, slice 6) · a note count on the
frame label · labels on frames, notes or canvases.

## Questions before Step 1 (Łukasz answers; proposed answers given)

1. **Reviewers and notes.** AD-05 gives reviewers “read, comment, notes, approve”. Proposed: reviewers create, edit,
   resolve, reopen, move, resize, recolour, pin, unpin and delete notes, as modelers do; readers only read them.
2. **Labels.** Proposed: modelers, admins and owners assign, remove, rename and delete labels and pin them to a
   project; reviewers and readers see labels and open label panels but change nothing.
3. **Undo.** Proposed, as in the prototype: assigning or removing a label, deleting or renaming a label, and every
   note change are undo steps; hiding resolved notes is not.
4. **Note authorship.** Proposed: any note can be edited by anyone with note rights (no “own notes only” rule); the
   panel shows who created it next to the date (“Created {date} by {name}.”).

## Rules for the domain and data

- Commands: create label (normalised name, unique case-insensitively per workspace); rename label; delete label (its
  links and project pins with it, one change group); add label to item / remove label from item (one link, exactly
  one target); pin / unpin label on a project; create note; update note (text, colour, status, width); move note
  (position or pin offset, frame membership after a free drop); pin / unpin note; delete note. Existing commands that
  remove a card from a canvas, delete a frame, or delete an entity, attribute, mapping, table or column are extended:
  pinned notes become free notes, label links of deleted items are soft-deleted with them (D-47 cascade). Duplicate
  layout stays as it is: it copies no notes.
- Every command checks permission, archive and version, validates input (Zod at the boundary), and writes its change
  events in the same write (AD-12, AD-13, AD-23). Note text is sanitised on the server and `body_text` derived there
  (AD-17), even though it is plain text in this slice.
- Pure functions with unit tests: label name normalisation and matching, suggestion order, note visibility (resolved
  hidden, collapsed frame, hidden pinned card), note position (free or pinned offset), note frame membership, which
  notes move with a selection.
- No change to `docs/data-model-v2.md` or the migrations is expected. If one is needed, stop and ask first.

## Canvas rules for this slice

- Notes are drawn in their own layer above frames and cards, not as React Flow nodes with parents; card positions stay
  absolute. Their hit tests follow the slice 2b rules: a note is hit before the card or frame under it.
- Tethers are drawn by the existing SVG line layer (AD-24 rule 3). Label marks on lines are part of the line's own
  drawing; no new layer.
- AD-24: no opacity on repeated elements (resolved notes and marks use colours), zoom-dependent CSS variables only on
  the elements that use them, nothing that re-renders the canvas while idle (the `window.__imCanvasCommits` guard of
  slice 2c must stay quiet with notes on the canvas).
- Below 40 % zoom a note may draw only its header and a plain body, like cards.

## Steps (stop after each one and report)

### Step 0 – Housekeeping and inventory
- **handlebars:** if `handlebars` 4.7.10 is at least 14 days old (from 19 October 2026) or `eslint-plugin-boundaries`
  has shipped a fix, add the override, run `npm install`, lint (including a deliberately broken layer rule), typecheck,
  unit tests and `npm audit`, and update `docs/known-limitations.md`. Otherwise leave it and say so.
- **Inventory:** what exists for `label`, `label_link`, `note` and `project_pinned_label` in SQL, domain, adapter,
  seed and UI; what the project home shows today; how the prototype's Duplicate layout treats notes. Report before
  building.

### Step 1 – Domain and data
Items 1 and 6, the commands and rules above, with unit tests; the adapter's tables, checks and undo; the demo seed
gets two labels (e.g. `CR-23` on Customer, two of its attributes and one mapping; `JIRA-481` on `customers` and one
column) and three notes on Customer & orders (one free, one pinned to a card, one resolved).

### Step 2 – Labels
Items 2, 3, 4 and 5.

### Step 3 – Notes on the canvas
Items 7, 8, 9, 10 and 11.

### Step 4 – Notes elsewhere, selection, permissions
Items 12, 13, 14 and 15.

### Step 5 – Acceptance tests and wrap-up
Playwright tests for every criterion (`e2e/slice-03a/`), independent of each other; three full e2e runs in a row with
no dev server running (after a test change, start the three again); one quick `measure:canvas` round against
`slice-02c` (S3A-14). Write `docs/prd/slice-03a-acceptance.md` (results, the round, manual checklist S3A-01 to
S3A-13, assumptions, changes to earlier tests). Update README and CLAUDE.md commands.

## Acceptance criteria

| ID | Criterion |
| --- | --- |
| S3A-01 | Typing `cr 23` in Customer's Labels field offers “Create “cr-23”” first; Enter creates and assigns it; typing `CR` on an attribute suggests the existing label with its item count; × removes it; each is one undo step. |
| S3A-02 | Labels can be assigned to an entity, attribute, mapping, source table and source column; a second label with the same name in another case is not created (the existing one is used). |
| S3A-03 | Labeled attribute rows, column rows, table headers and mapping lines show the tag mark with the label names as a tooltip; below 40 % zoom the row marks are not drawn. |
| S3A-04 | The label panel lists everything the label marks by kind as links; renaming works and refuses a name another label has; “Delete label” takes it off every item, the model is untouched, Undo in the toast restores it with all its links. |
| S3A-05 | The project home lists the labels used on its canvases; pinning one puts it first and survives a reload; unpinning works; a pinned label stays listed when no canvas uses it. It shows the number of open notes and the list “Open notes” (first line or “Empty note”, the canvas's name); a click opens that canvas with the note selected; without open notes it shows “No open notes on this project's canvases.” |
| S3A-06 | The Note tool (N) makes a free note on the empty canvas and a pinned note on a card, a frame's name and a collapsed block; an empty new note disappears without an undo step; the toolbox and panel entries create notes too. |
| S3A-07 | A note's text is edited in place (Ctrl+Enter saves, Esc cancels), its width changed by its edge, its colour by the toolbox and panel, and it is resolved and reopened by its ✓ button, the toolbox and the panel; each is one undo step. |
| S3A-08 | A free note dropped in a frame moves with it and is hidden while the frame is collapsed; a pinned note follows its card while dragged, with a dashed tether; unpinning keeps it in place as a free note; removing its card from the canvas turns it into a free note. |
| S3A-09 | A card's header shows its open pinned notes; card and frame panels list their notes; a collapsed block shows “N notes”; the canvas overview lists open notes and “Show resolved notes on the canvas” hides resolved ones for this user only, after a reload too, without an undo step. |
| S3A-10 | Notes take part in the selection: click, Shift+click, lasso (not when their frame is caught), Ctrl+A for free notes outside frames, group drag and nudge (a pinned note moves once), Delete. |
| S3A-11 | Duplicate layout copies no notes: the copy has no notes, and the original's notes are unchanged (text, place, pin, frame, status); the toast reads “Duplicated {name}. Only the layout is copied; the model is shared.” |
| S3A-12 | Deleting an entity soft-deletes its label links and those of its attributes and mappings in the same change group; Ctrl+Z restores them. |
| S3A-13 | As Piotr (reviewer) and as a reader: what each may do with notes and labels follows the answers to the questions before Step 1; everything else is not offered, and the commands called directly are refused and change nothing. |
| S3A-14 | One quick `measure:canvas` round on “Performance test” against `slice-02c`, with labels and notes added by `seed:large` (at least 20 notes, half pinned, and labels on 50 rows and 30 mappings): pan and zoom no more than about 10 % below `slice-02c`; the S2C-12 guard stays quiet. |
| S3A-15 | CI passes, including the schema check with `label`, `label_link`, `note` and `project_pinned_label` built; lint, typecheck, unit and all e2e suites pass three times in a row locally. |

## Definition of done

All criteria pass, steps were reported one by one, assumptions are listed, and Łukasz has labeled the Customer
mappings of a change request on Customer & orders, opened the label and walked its items, written three notes (one
free in a frame, one pinned to a card, one on a frame), resolved one, hidden resolved notes, collapsed the frame with
notes, duplicated the layout, and undone the label's deletion, then accepted the slice.
