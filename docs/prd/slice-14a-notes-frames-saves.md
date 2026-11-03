# Slice 14a – Notes and frames keep what was typed (D-66 on the canvas's queue)

Status: **step 1 answered** (Łukasz, 3 November 2026; `docs/prd/slice-14a-acceptance.md`, "Łukasz's answers to step 1"). This PRD is updated to the answers; the copy from `~/Downloads` is commit `6c3c6a1`. Branch `slice/14a-notes-frames-saves`, from `main` at tag `slice-13` (`3befbf0`, assumption A1). PRD file: `docs/prd/slice-14a-notes-frames-saves.md`; step 1 writes `docs/prd/slice-14a-acceptance.md`.

Test regime: a small slice (CLAUDE.md, "Testing"): in each step the canvas's, notes' and frames' specs that the step touches (the acceptance's list, Q8) and CI; one full e2e run (three parts, `E2E_MEMORY_LOG=1`) at the closing (N6, changed in the answers). If step 2 turns out wider than F1 (more than the types for the other writes), it stops and the full run after step 2 comes back. Step 1 checks this PRD against the code (CLAUDE.md, "How we work").

This PRD was written from the docs at slice 13's state:
- `CLAUDE.md`, `docs/decisions.md` (D-66, AD-24), `docs/known-limitations.md`, `docs/ideas.md`;
- `slice-13-acceptance.md` (F12, the field inventory).

It was written without reading the code.

## 1. Why this slice

Slice 13 (D-66) made every panel field keep what a person typed after a refused save. It left notes and frames out, because they save through the canvas's own queue (`useNotes`, `useFrames`, `enqueueGroup`), not through the panels' save chain (`rowSaves`):

- **A note's text rolls back after a refused save,** made in its panel or on the canvas: the typed text is lost (`docs/known-limitations.md`, "A note's text rolls back after a refused save; a frame's fields have no line").
- **A frame's name keeps a refused value** (the stable key of slice 13), but shows no conflict line and no "Not saved": the canvas's queue answers only "stored or not", with no refusal code.
- **A note's status and colour, and a frame's kind,** go back to their earlier values instead of the newest stored ones.

Notes are where people write free text on a canvas. After this slice, D-66 holds for them too.

**Agreed with Łukasz on 3 November 2026 (N1–N8):**

- **N1. A note edited on the canvas keeps its draft there** and shows a small "Not saved" mark on the note. Clicking the mark selects the note and opens its panel, where the conflict line of slice 13 shows, with "Use this" and "Keep mine". The canvas gets no conflict line of its own.
- **N2. The canvas's queue learns the kinds of refusal** that the save chain knows: a stale version (conflict), a permission, the archive, a locked organization (`locked`), not found, and an invalid input. A refusal that cuts the queue brings the fresh page, as D-66 says for the save chain. The other writes on that queue keep their behaviour: card moves, sizes, the names switch and the like.
- **N3. Choice fields follow D-66:** after a refusal they show the newest stored value, with the toast. These are a note's status and colour, and a frame's kind, concept and system.
- **N4. A note's save stays optimistic** (its text shows at once). After a refusal the draft stays instead of rolling back.
- **N5. The canvas's look** (grid, background, layer) belongs to slice 14b, with a canvas's rename in its tab, not here.
- **N6. Test regime (changed in the step 1 answers):** step 2 changes the canvas's other writes in their types only (F1), so there is no full e2e run after it; each step runs the canvas's, notes' and frames' specs it touches, and one full run (three parts, `E2E_MEMORY_LOG=1`) comes at the closing. If step 2 turns out wider than F1, it stops and the full run after step 2 comes back.
- **N7. Measurements:**
  - canvas commit counts (typing in a note, the mark, "Use this");
  - the element check against `slice-08.json`;
  - a LayerTree read if the mark is a new element in notes;
  - pan and zoom only if the LayerTree read shows a change.
- **N8. Pinned notes** (on cards) follow the same rule as free notes.

## 2. Sources

**Decisions:**
- **D-66:** a field's draft and a refused save, and the sentence this slice replaces.
- **D-03, D-20, D-21:** notes, pinned notes, resolved notes.
- **D-04, D-07:** frames, collapsed frames.
- **D-38:** a selection that no longer exists.
- **AD-12, AD-13:** versions, change events, undo steps.
- **AD-24:** the canvas's rules: a new repeated element is checked with a LayerTree read; no opacity on repeated elements; nothing above the canvas reads layout during a commit.

**Docs:**
- **CLAUDE.md:** "Saving in panels" after slice 13 (the draft, the conflict line, `locked`, the fresh page after a refusal, `field-drafts.ts`); the canvas's queue (`enqueueGroup`).
- **`docs/known-limitations.md`:** "A note's text rolls back after a refused save; a frame's fields have no line"; "A field's draft: what slice 13 does not cover"; "Writes still off the save chain".
- **`docs/ideas.md`:** "The plan after slice 13", "Notes and frames on slice 13's rule".

**Earlier slices' acceptance:**
- **Slice 13:** F2, F3, F9, F12, the field inventory, S13-12 (canvas commits); the conflict line, "Not saved", Escape, a closed panel's draft (`keep`), the test-only hold of a save's answer.
- **Slice 3a and later:** notes on the canvas and in the Overview's miniature.
- **Slice 2b, 2c:** frames.
- **Slice 10a:** the canvas's writes and the save chain.

## 3. What to build

Texts in quotes are proposals. The step that builds them lists every new user-facing text for approval.

### The canvas's queue (step 2)

Step 1 found (F1) that every note and frame write already goes through `runCommand`: its answer carries the refusal's code and, for a stale version, a permission, the archive or a row not found, the fresh page (slice 13, F3); `locked` and an invalid input bring none. The canvas throws the code away in its own types.

1. **Refusal kinds.** The canvas's result types carry the code of every write's answer (types only for the other writes). A note's saves and a frame's `updateFrame` answer their callers with `{ ok, code }`.
2. **The cut and the fresh page (F2, F3; answers 2 and 3).** A cutting refusal (stale version, permission, archive, not found, `locked`) of any write on the canvas's queue is recorded for its rows; a note's save and a frame's `updateFrame` waiting behind it answer `cut` without being sent and without a toast. Every other write waiting behind it is sent as today. A note's or frame's refusal that brings the fresh page is answered once that page's notes or frames have been merged (3 s at most, as `afterPage` in slice 13). An invalid input cuts nothing.
3. **The other writes on the queue keep their behaviour** (Q1's table):
   - card moves and sizes;
   - frames' layout (moving, resizing, collapsing);
   - the names switch;
   - the removes and deletes, and the rest of Q1's table.

   The same toasts, the same undo steps, the same canvas commits.
3a. **A frame's name** (F7, answer 6) gets slice 13's line, "Not saved" and Escape in its panel from item 1's answer, and keeps its draft when its panel closes (`keep`).

### Notes

4. **A note's text keeps its draft** after any refusal, in its panel and on the canvas (N4). No rollback of the text. The draft is the text the person typed. The page's fresh values never replace it, nor does another person's write or an undo, as D-66 says for fields.
5. **On a conflict** (stale version):
   - **in the note's panel:** slice 13's conflict line under the text ("Changed meanwhile to: …" or "Cleared meanwhile.", folded to three lines with "Show more"), with "Use this" and "Keep mine". "Keep mine" saves the draft on the newest version: an ordinary undo step;
   - **on the canvas (N1):** the note shows the draft and a small "Not saved" mark. Clicking the mark selects the note and opens its panel, where the line shows. The note's text on the canvas is the draft until the person uses "Use this" or "Keep mine", or presses Escape (item 8).
6. **A save cut behind a conflict,** or refused as stale while the note's text did not change meanwhile, keeps its draft as "Not saved" in the panel and with the mark on the canvas. The person saves it again by leaving the field, as D-66 says.
7. **Typing while a save is on its way,** in the panel or on the canvas: the text typed after the save was sent stays, with the focus and the caret, and is saved next (D-66). On the canvas, editing ends when the note is left and starts again with a double-click (answer 11); the editor then starts from the draft's text.
8. **Escape** in the note's text (panel or canvas) puts the stored text back; while a conflict line shows, it is "Use this" (D-66). Q4 says what Escape does on the canvas today.
9. **The other refusals:**
   - **Permission or archive:** the panel's text is read-only and the draft stays readable and selectable ("Not saved. You can still copy it."). On the canvas the note is not editable and shows the draft with the mark until the person leaves the page.
   - **Locked organization:** the draft stays editable, with "Not saved".
   - **Invalid input:** the draft stays for correcting.
   - **Not found (the note was deleted):** its draft goes with it (D-66).
10. **A note's status and colour** (N3): after a refusal, the newest stored value, with the toast; no rollback to the earlier value.
11. **Pinned notes** (N8) follow items 4–10. The mark shows on the pinned note where it is drawn.
12. **A closed panel.** A note's draft lives with the note (one draft per note in the canvas's store, answer 4), so closing its panel does not lose it: the canvas shows it with the mark, and the panel shows it again when it opens; no toast when the panel closes (answer 8). It ends when the page is left or reloaded (D-66: never in the browser's storage).

### Frames

13. **A frame's name** is edited in its panel only (Q2, F7). Item 3a gives it the conflict line, "Not saved", Escape and `keep` of slice 13; it has no mark on the canvas.
14. **A frame's kind, concept and system** (N3): after a refusal, the newest stored value, with the toast (mostly so today, F8).

### Out of this slice (answers 7 and 9)

- A new note that was never saved loses its text when its creation is refused (F9): a known limitation.
- A note that is not drawn (in a collapsed frame, or resolved while resolved notes are hidden) shows its mark only when it is drawn again (F13): the same known limitation.

### Unchanged

15. **Unchanged:**
    - the domain's commands and messages;
    - the save chain (`rowSaves`);
    - the panels' fields of slice 13;
    - the canvas's other writes (item 3);
    - the canvas's look and a canvas's rename (slice 14b, N5);
    - the data model and the local data file's format;
    - undo and redo.

## 4. Steps

Stop after each step with a short summary of what changed and how to check it. Wait for Łukasz before the next. A new Claude Code session may start at a step's boundary, never inside a step; it starts by reading CLAUDE.md, this PRD and `slice-14a-acceptance.md`.

1. **Critical review** (section 7). Check every item, decision and criterion against the code, `docs/decisions.md` and the earlier slices' acceptance docs. Answer Q1–Q9 in `docs/prd/slice-14a-acceptance.md`, with every new or changed text and the earlier specs that change. No application code. Stop.
2. **The canvas's queue** (items 1–3a): the result types with codes, the cut and the wait for the fresh page for notes' and frames' saves, the frame name's answer and `keep`, with unit tests. Specs S14A-01, S14A-02 and S14A-09, the earlier specs of the canvas's writes, frames and notes (the acceptance's Q8) and CI; no full run (N6). Stop.
3. **Notes and frames** (items 4–14):
   - the draft;
   - the conflict line in the panels;
   - the mark on the canvas;
   - choice fields;
   - pinned notes;
   - the other refusals.

   Specs S14A-03 to S14A-12, the earlier specs of notes and frames (slices 2b, 2c, 3a, 10a, 13; Q8) and CI. Screenshots: a note on the canvas with the mark, its panel with the conflict line, a frame's name with the line, a read-only note; light and dark. Stop.
4. **Measurements** (section 6): S14A-13. Stop.
5. **Closing:**
   - the docs (section 10);
   - one full e2e run (three parts, `E2E_MEMORY_LOG=1`), keeping a failing test's traces before rerunning it;
   - CI and the pull request with both GitHub checks;
   - a backup of KB (`.data/backups/dev-db-<yyyymmdd-hhmm>.json` and `kb-model-latest.json`);
   - the manual acceptance scenario.

   Merge and tag `slice-14a` only on Łukasz's command.

## 5. Acceptance criteria

Tests in `e2e/slice-14a/`, one file per criterion, each from a fresh seed; unit tests next to the code. A save's answer is held back with slice 13's test-only hook, never a switch in the application.

| ID | Criterion |
| --- | --- |
| S14A-01 | **The frame name's answer reaches its field.** A frame's name save refused as stale shows the conflict line once the fresh page is in; a frame's name save waiting behind a refused frame write is cut ("Not saved", one toast); a `locked` refusal brings no fresh page and keeps the name editable with "Not saved"; an invalid input (a name too long) cuts nothing. |
| S14A-02 | **The canvas's other writes are unchanged.** A card move and a frame's resize refused (stale and archive) show the same toasts and the same canvas as before the slice; their undo steps are unchanged. A regression check (F16). |
| S14A-03 | **A note's text in its panel.** Two sessions on one note; the second's text save is refused: the text stays with "Changed meanwhile to: …"; "Keep mine" stores it (one change event, an undo step); in a repeat, "Use this" shows the first's text and stores nothing. |
| S14A-04 | **A note's text on the canvas.** The same conflict made on the canvas: the note keeps the typed text and shows "Not saved"; clicking the mark selects the note and opens its panel with the conflict line; "Keep mine" stores it and the mark goes. |
| S14A-05 | **Typing while a save is on its way,** on the canvas and in the panel: with the answer held, the text typed after the save stays with the focus (on the canvas after a double-click back, starting from the draft); leaving the note saves the rest. |
| S14A-06 | **Not saved.** A note's text save cut behind a conflict on its status keeps its draft as "Not saved" (panel) with the mark (canvas), with one toast; leaving the field saves it. |
| S14A-07 | **Escape.** On the canvas and in the panel, Escape puts the stored text back; with the conflict line showing, it is "Use this". |
| S14A-08 | **Choices.** A refused change of a note's colour and of a frame's kind shows the newest stored value with the toast, not the earlier one. |
| S14A-09 | **A frame's name.** A conflict on a frame's name shows the line in its panel, with "Use this" and "Keep mine"; Escape is "Use this"; a refused name stays when the panel closes and comes back with its mark when the frame's panel opens again on the same page. |
| S14A-10 | **Pinned notes.** A pinned note's conflict behaves as S14A-04's, with the mark where the pinned note is drawn. |
| S14A-11 | **Permission and archive.** A note's text save refused because the workspace was archived meanwhile: the panel's text is read-only and selectable with "Not saved. You can still copy it."; the canvas's note is not editable and shows the draft with the mark. |
| S14A-12 | **Locked and deleted.** A `locked` refusal keeps the note's draft editable with "Not saved"; a save on a note deleted meanwhile in another session takes the draft with it. |
| S14A-13 | **The canvas's cost:**<br>• typing 20 characters in a note on the canvas, the mark shown and "Use this" pressed add no canvas commits beyond what the note's own save adds today (`window.__imCanvasCommits`, as S13-12);<br>• `S3B-15-elements.spec.ts` against `.data/measure/s9-14-baseline/slice-08.json`: the viewport counts equal, the page totals as slice 13's, or each difference explained;<br>• a LayerTree read with 20 notes showing the mark (20 real refusals, no test hook; answer 10) against the same notes without it: no more drawing layers;<br>• pan and zoom only if that read shows a change. |
| S14A-14 | CI and the runs of the test regime; changed earlier tests listed with the reason. |

**Definition of done (scenario for the manual acceptance, on Łukasz's model KB, after the backup).**

1. Open the same canvas of "Kanton Basel" in two windows (two sessions).
2. Change a note's text in the first. In the second, type other text into the same note on the canvas and leave it: the note keeps the text and shows "Not saved". Click the mark: the panel shows the conflict line. "Keep mine", then Undo.
3. Repeat in the panel and press "Use this".
4. Type a long text into a note, leave it and double-click back at once to go on typing: nothing is lost.
5. Rename a frame in both windows: the second shows the line.
6. Change a note's colour in both windows: the second shows the first's colour, with the toast.

## 6. Performance

The slice adds one small mark to notes with a refused draft (rare), and changes the canvas's queue's answers.

- **Canvas commits** (S14A-13): typing, the mark and "Use this" add no commits beyond today's note save.
- **Nothing reads layout** during a commit (AD-24): the mark is placed by CSS inside the note, and the panel's line folds with `line-clamp`.
- **New repeated element:** the mark is drawn only on a note with a refused draft. AD-24's LayerTree read checks that it adds no drawing layer, with no opacity and no `will-change` on it. Pan and zoom are measured only if the read shows a change.
- **The queue's change** is checked by S14A-02 and the full run after step 2.

## 7. Questions for step 1

**The rule (CLAUDE.md, "How we work"):** a PRD is a proposal to verify, not a specification; this one was written from the docs without reading the code. In step 1, check every item, decision and acceptance criterion against the code, `docs/decisions.md` and the earlier slices' acceptance docs. Write into `docs/prd/slice-14a-acceptance.md` where the PRD is wrong, contradicts the code or a decision, duplicates what the app already has, misses what the code needs, or costs more than it assumes (data model, undo, change events, performance), each with the files and functions behind it and a proposal. List the differences between the reference prototype and the app that the slice touches. No application code in step 1; Łukasz answers before step 2.

- **Q1. The canvas's queue.**
  - `enqueueGroup` and its callers: every write that goes through it;
  - what each answers today on a success and on a refusal;
  - what each does after a refusal (rollback, toast, nothing);
  - whether it sends a version that can be compared as `rowSaves` does.

  What adding refusal kinds and the fresh page changes for each.
- **Q2. Frames.** Where a frame's fields are edited (panel only, or the title on the canvas too) and how they save.
- **Q3. Notes on the canvas.**
  - how a note is drawn and edited (`NoteLayer`, React Flow nodes or not), and where its optimistic text lives (`useNotes`);
  - how a draft can stay on the canvas without re-rendering other notes or cards;
  - where the mark goes in the note's element, with no new layer.
- **Q4. Escape and leaving** a note on the canvas today: what ends editing, what saves, what Escape does.
- **Q5. Pinned notes:** where they are drawn and edited, and what the mark needs there.
- **Q6. Read-only:** how a note on the canvas becomes read-only after a role change or an archive today, and what keeping the draft visible needs.
- **Q7. Slice 13's pieces to reuse:**
  - the conflict line;
  - "Not saved";
  - `field-drafts.ts`;
  - the fresh page after a refusal (`runCommand`);
  - the test hook that holds a save's answer.

  Whether the note's panel text can use slice 13's text field as it is.
- **Q8. Earlier tests and docs.** Specs whose expectations change (a note's rollback, a frame's kind going back), the earlier specs to run in steps 2 and 3, and the docs to update.
- **Q9. The data model.** Confirm or refute: no change, and no new format of the local data file.

## 8. Differences from the prototype (deliberate)

- **The prototype has no save conflicts.** The mark on a note and the panel's line are new, as in slice 13.

## 9. Left for later

- **Slice 14b:**
  - the canvas's look;
  - a canvas's rename in its tab;
  - the change-to-resolve actions;
  - a warning when leaving a page with a draft not saved.
- **A conflict line on the canvas itself** (N1's alternative), if the mark and the panel prove too indirect in use.
- **A second press on a selected note to edit it,** as in the prototype (answer 11; `docs/ideas.md`).
- **A new note's text kept after its creation is refused** (answer 7; `docs/ideas.md`, a known limitation).

## 10. Decisions to accept, and docs in this PR

### D-66 (change, proposal)

Replace "Notes and frames keep their canvas queue: a note's text still rolls back after a refused save (slice 14a)." with:

"Notes and frames follow the same rule through the canvas's queue (slice 14a):
- a note's text keeps its draft, in its panel and on the canvas;
- on the canvas a note with a refused draft shows a 'Not saved' mark, which opens its panel with the conflict line;
- a frame's name has the conflict line in its panel;
- a note's status and colour and a frame's kind, concept and system show the newest stored value after a refusal."

### AD-24 (note, proposal after step 4)

One sentence with the mark's measured cost (drawing layers, commits), as earlier slices added for new canvas elements.

### Assumptions to confirm

- **A1.** The slice starts from `main` at tag `slice-13` (`3befbf0`).
- **A2.** No data model change and no new format of the local data file (Q9).
- **A3.** Łukasz's KB model is backed up before the manual acceptance; it is not reset or seeded.
- **A4.** The seed is not changed.

### Docs in this PR

- **`docs/decisions.md`** (only with Łukasz's approval): D-66's change; AD-24's note.
- **`docs/known-limitations.md`:** "A note's text rolls back after a refused save; a frame's fields have no line" removed; "A new note's text, and a note not drawn" (answers 7 and 9, written with the answers); anything steps 2–4 find and Łukasz accepts.
- **`docs/ideas.md`:** "Notes and frames on slice 13's rule" done; the plan: 14a done, next 14b; section 9's entries.
- **`docs/inventory-prototype-vs-app.md`:** section 8.
- **README and CLAUDE.md:**
  - the slice's status;
  - "Saving in panels" and the canvas's queue with refusal kinds;
  - the mark;
  - the new e2e helpers.
