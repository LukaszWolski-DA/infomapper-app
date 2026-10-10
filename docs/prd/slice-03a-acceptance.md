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
