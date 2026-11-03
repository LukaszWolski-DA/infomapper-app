# Slice 13 – One behaviour for a field's save: nothing typed is lost

Status: **step 1 answered** (Łukasz, 1 November 2026; `docs/prd/slice-13-acceptance.md`, "Łukasz's answers to step 1"). This PRD is updated to the answers; the copy from `~/Downloads` is commit `a1829dc`. Branch `slice/13-field-saves`, from `main` after the e2e reliability chore's merge (assumption A1). PRD file: `docs/prd/slice-13-field-saves.md`; step 1 writes `docs/prd/slice-13-acceptance.md`. Test regime: a small slice (CLAUDE.md, "Testing") with one full e2e run after the shared mechanism (step 2) and one at the closing (R7). Step 1 checks this PRD against the code (CLAUDE.md, "How we work").

This PRD was written from the docs at the state after the e2e reliability chore (`CLAUDE.md`, `docs/decisions.md`, `docs/known-limitations.md`, `docs/ideas.md`, the acceptance docs of slices 9, 10a and 12a), without reading the code. The prototype has no save conflicts (it is a one-person app), so everything this slice shows on a conflict is new behaviour for Łukasz's approval.

## 1. Why this slice

People write long business texts in InfoMapper: definitions, descriptions, rules, notes, requirements. Today three things can lose what they typed:

- **A conflict loses the typed value in the workspace settings.** When someone else changed the row meanwhile, the save is refused ("Someone changed this meanwhile. Reload to see the latest version.") and the settings form goes back to the last saved value (`docs/ideas.md`, "Settings: keep the typed value on a stale-version conflict", slice 0).
- **Three behaviours after a refused save (F6, slice 9).** Most panel fields keep the refused text (they are keyed by their stored value, `fieldKey`); the requirement panel shows the stored values again (its `reset` counter); the settings form reverts (`revert()`). Łukasz kept this in slice 9 (`docs/ideas.md`, "Panels: one behaviour for a refused save in every field").
- **Text typed while a save is on its way is lost** with the field and its focus, because the save's answer replaces a field keyed by its stored value (`docs/known-limitations.md`, "Typing into a field while its save is on its way", slice 9, found in slice 10c).

Slice 13 gives every field that saves a row one behaviour: **what a person typed stays until it is saved or they choose to drop it.**

**Agreed (the plan after slice 10a; 1 November 2026):** the three points above are slice 13's scope, after the e2e reliability chore.

**Agreed in step 1 (R1–R8, as answered by Łukasz on 1 November 2026):**

- **R1. Every text field keeps the typed value after any refusal.** No field goes back on its own, with one exception: an empty required name goes back to the stored name everywhere, as D-59 says for a project's name (answer 6).
- **R2. One rule per kind of refusal** (item 9's table).
- **R3. A conflict shows the other value under the field,** with "Use this" and "Keep mine", only when that field's own stored value changed meanwhile; a stale refusal of a field nobody else changed shows "Not saved" and is saved again by the person (answer 3). "Keep mine" saves the typed value on the current version: a deliberate overwrite and an ordinary undo step, except in the workspace settings, which are not undo steps (F10).
- **R4. Choice fields** (selects, segmented buttons, flags, check boxes) show the newest stored value after a refusal, with the toast; they keep no draft (answer 4).
- **R5. Writes still off the save chain stay as they are:** a canvas's rename and delete in its tab, the canvas's look, the names check boxes, the change-to-resolve actions (`docs/known-limitations.md`, "Writes still off the save chain"), the role select. **Notes and frames** keep their canvas queue; the frame panel's fields only get the stable key (answer 5). Section 9.
- **R6. The workspace settings form, the requirement panel and the working label's panel join the common rule:** no `revert()`, no `reset` counter, no form keyed by the workspace's version.
- **R7. A small slice,** with a full e2e run (three parts) after step 2 (the shared mechanism, which every panel uses) and at the closing.
- **R8. New texts** as listed in item 12, approved (answer 11).
- **After every refusal that cuts** (a stale version, a permission, the archive, not found) the server sends the fresh page in the same answer, for every write; the conflict toast becomes "Someone changed this meanwhile." (answer 1).

## 2. Sources

**Docs:**
- **CLAUDE.md, "Saving in panels":** `saveRow`, `saveRows`, `rowSaves` (one save per object at a time, the newest known version), the cuts (stale version, permission, archive, not found; a validation refusal cuts nothing), `Saved<T>`, `rowSaves.exclusive` for undo and redo, `fieldKey`.
- **`docs/known-limitations.md`:** "Saving in panels (slice 9; the canvas's writes joined the chain in slice 10a)", "Writes still off the save chain (slice 10a)", "Typing into a field while its save is on its way".
- **`docs/ideas.md`:** the two entries above and the plan after slice 10a.
- **Earlier slices' acceptance:**
  - **Slice 9:** F6, Q3 (a refused save in a queue), S9-03 (a conflict in a panel; the field keeps the typed text), S9-06 to S9-11 (the project's name and description, the typed zoom), S9-14 (canvas commits while typing).
  - **Slice 10a:** the save chain's cuts, `{ deletes: true }`, held rows.
  - **Slice 12a:** undo on the home pages (D-65), which writes rows that fields show.
- **Slice 0:** S0-08 (the settings form's conflict).
- **Slice 10c:** the test-only `holdAnswer` that keeps a save's answer back.

**Decisions:**
- **AD-12, AD-13:** versions, change events, one action = one undo step.
- **AD-23:** writes.
- **AD-24:** "nothing above the canvas reads layout during a commit".
- **D-38:** a selection or place that no longer exists.
- **D-58:** people and passwords, not undo steps.
- **D-59:** a project's name and description.
- **D-65:** undo on the home pages.

## 3. What to build

Texts in quotes are proposals. The step that builds them lists every new user-facing text for approval.

### Which fields

1. **Every text field that saves an object's row,** on any page (the inventory: `slice-13-acceptance.md`, Q1):
   - the canvas's panels: entity, attribute (with the custom type and the type's parameters), mapping (rule, note), relationship, requirement (with its rule or check), working label, classification list, table and column notes, and the concept's rename in the tree; aliases are included;
   - the rich-text fields (definitions, a requirement's description), whose draft is in their editor dialog;
   - the project's name and description on its home;
   - the workspace settings form.

   Out of scope (R5): notes (their text keeps rolling back after a refusal, `docs/known-limitations.md`) and frames (only the stable key), a canvas's rename in its tab, the canvas's look, the names check boxes, the change-to-resolve actions, the role select, the typed zoom (it saves no row), sign-in and password fields.

### The field's value

2. **A field has a draft.** From the first key (or the first choice) until its value is saved, the field holds what the person entered, apart from the stored value the page shows.
3. **The page's fresh values never replace a draft.** A field with a draft, or with the focus, is not mounted anew and does not take a stored value that arrives from a save's answer, an undo, a redo or another write. A field with neither takes the newest stored value, as today. (This replaces keying the field by its stored value, `fieldKey`; step 1 proposes how, Q2.)
4. **Typing while a save is on its way.** Text typed after a save was sent and before its answer arrives stays in the field with the focus and the caret. When the answer arrives, the field's draft is what was typed. If the draft differs from what was saved, it is saved next on Enter or on leaving the field, as today's chain does (`rowSaves`). If it equals the saved value, the draft ends.
5. **A draft ends** when its value is saved, when the person chooses "Use this" (item 7), or when they press Escape in a text field: Escape puts the stored value back, keeps the focus and saves nothing; while a conflict line shows it is "Use this" (answer 10). A field compares what it saves with the value it last sent while that save is on its way, so a repeated Enter is not refused as "Nothing to change." (F8).
5a. **A draft whose field is gone.** A draft refused after its panel closed (another selection, the panel hidden) stays in the page's memory, never in the browser's storage, and comes back with its state when a panel of that object opens again; it is gone when the page is left or reloaded (answer 7). If this is more than a small change, step 4 stops and describes the cost; then a toast is enough.

### A refused save

6. **The field keeps the draft after any refusal (R1).** Nothing goes back on its own; the toasts stay one per cut, as today.
7. **A conflict (R3).** When a save is refused because the row changed meanwhile (a stale version), the refusal's answer brings the fresh page. If the field's own stored value differs from the value its draft started from, the field keeps the draft and shows under it:
   - "Changed meanwhile to: {value}" ("Cleared meanwhile." when it is empty), the newest stored value from the fresh page; a long text folded to three lines by CSS with "Show more" / "Show less" (no "by {person}", answer 9);
   - **"Use this":** the field takes the newest stored value; the draft ends;
   - **"Keep mine":** the draft is saved on the newest version, as a deliberate overwrite; it is an ordinary save (change event, undo step, the working context's label as D-26 says), and in the workspace settings an ordinary save without an undo step.

   While the line shows, Enter and leaving the field save nothing. The line goes when the draft ends or the stored value comes to equal the draft. If the field's own stored value did not change (another field of the row did), it shows "Not saved" as in item 8. In a rich-text field the line is inside the editor dialog; "Use this" puts the stored text into the editor, which stays open (answer 2).
8. **Saves cut behind a conflict.** Today a stale refusal cuts the saves of the same object waiting behind it, with one toast. Each cut field keeps its draft:
   - if its own stored value changed meanwhile, it shows item 7's line;
   - if not, it shows "Not saved", and its draft is saved by the person on Enter or on leaving the field again (no automatic retry, answer 3).
9. **The other kinds of refusal (R2):**

| Refusal | The field | The page |
| --- | --- | --- |
| Validation (an invalid input) | keeps the draft, the focus stays, nothing is cut (as today) | the domain's message as a toast |
| Stale version (a conflict) | item 7 | one toast: "Someone changed this meanwhile." (for every write; the fresh page comes with the refusal) |
| Permission, archive | keeps the draft as read-only text the person can select and copy, marked "Not saved. You can still copy it." | the domain's message; the fresh page makes the field read-only, and the draft stays readable until the person leaves the panel or the page |
| Locked organization | keeps the draft, still editable; no fresh page (it would lead to the password form) | "Unlock {organization} first: …" as today |
| Not found (the object was deleted) | the draft is lost with the object (answer 8); the fresh page shows what still exists | the domain's message |

   The last row is the one exception to "nothing typed is lost": the object is gone, and there is nowhere to save.
10. **Choice fields (R4)** keep no draft: after a refusal they show the newest stored value from the fresh page, with the toast (answer 4).
11. **The workspace settings form, the requirement panel and the working label's panel (R6)** follow items 2–9. The settings form's `revert()` and its key on the workspace's version, the requirement panel's `reset` counter and the label panel's version key go. S0-08, S3A-04 and S4A-02 change.

### Texts and what does not change

12. **New texts (R8, approved):** "Changed meanwhile to: {value}", "Cleared meanwhile.", "Use this", "Keep mine", "Show more" / "Show less", "Not saved", "Not saved. You can still copy it.", "Not saved: {field} of {object}. Open it again to see your text." (item 5a, if built), and the conflict toast "Someone changed this meanwhile.". The table: `slice-13-acceptance.md`.
13. **Unchanged:**
    - the domain, its refusals and messages (apart from the conflict message's wording);
    - the save chain's rules (one save per object at a time, the newest known version, the cuts, held rows);
    - undo and redo;
    - the data model and the local data file's format;
    - the writes listed in R5;
    - the canvas's code (it gets a fresh page after its own cutting refusals, which it already merges).

## 4. Steps

Stop after each step with a short summary of what changed and how to check it. Wait for Łukasz before the next. A new Claude Code session may start at a step's boundary, never inside a step; it starts by reading CLAUDE.md, this PRD and `slice-13-acceptance.md`.

1. **Critical review** (section 7):
   - the inventory of every field (Q1);
   - the proposal for the draft (Q2);
   - Q3–Q10 answered in `docs/prd/slice-13-acceptance.md`;
   - every new or changed text;
   - the earlier specs that change.

   No application code. Stop.
2. **The shared mechanism** (items 2–6, 10, 11): the draft (a stable key per object and field, the stored value taken only without a draft or focus), typing while a save is on its way, the comparison with the value last sent, every field's save returning its answer, a refusal that keeps the draft, the fresh page after a cutting refusal and the new conflict toast, empty required names going back, choice fields showing the newest stored value; the settings form, the requirement panel and the label panel without their resets; the concept's rename open until its answer. Unit tests.

   Specs S13-01, S13-02 and S13-09, plus the earlier specs of every panel and of the project's name. **One full e2e run** (three parts) and CI. Stop.
3. **Conflicts** (items 5, 7, 8): the line under the field and in the rich-text dialog, "Use this", "Keep mine", "Not saved" for cut saves and for a stale refusal of an unchanged field, Escape.

   Specs S13-03 to S13-08 and CI. S13-12's commit count. Screenshots: a conflict on a short field, on a long text, in the rich-text dialog, a "Not saved" field; light and dark. Stop.
4. **The other refusals** (items 5a, 9): permission, archive, locked organization, not found, a draft whose field is gone. Specs S13-10, S13-11 and S13-14 and CI. Stop.
5. **Closing:**
   - the docs (section 10);
   - one full e2e run (three parts, `E2E_MEMORY_LOG=1`), keeping a failing test's traces before rerunning it;
   - CI and the pull request with both GitHub checks;
   - a backup of KB (`.data/backups/dev-db-<yyyymmdd-hhmm>.json` and `kb-model-latest.json`);
   - the manual acceptance scenario.

   Merge and tag `slice-13` only on Łukasz's command.

## 5. Acceptance criteria

Tests in `e2e/slice-13/`, one file per criterion, each from a fresh seed; unit tests next to the code. Specs that need a save's answer held back use the test-only hook slice 10c introduced (`holdAnswer`, or what step 1 names), never a switch in the application.

| ID | Criterion |
| --- | --- |
| S13-01 | **Typing while a save is on its way, in a panel.** (a) In an entity's name: type, press Enter, click back and type more while the answer is held; release it: the field shows all the text, keeps the focus and the caret; Enter saves the rest after the first save; both are stored, in order, as two undo steps. (b) The same in a source table's note (a long text, left with Tab). |
| S13-02 | **The same on the project's home** for the project's description, left by a click elsewhere (Enter adds a line, D-59). |
| S13-03 | **A conflict in a panel.** Two sessions on one entity; the first changes its name, the second's name save is refused: the field keeps the typed text and shows "Changed meanwhile to: {the first's name}". "Keep mine" stores the second's text (one change event, an undo step); in a repeat, "Use this" shows the first's text and stores nothing. The same on a source table's note. |
| S13-04 | **A long text in the rich-text dialog.** A conflict on a requirement's description of several paragraphs shows the line inside the dialog, the other value folded with "Show more"; "Use this" puts it into the editor. |
| S13-05 | **Saves cut behind a conflict.** The first session changes the entity's stereotype; the second changes the name and at once the alias; the name's save is refused and shows "Not saved" (its own value did not change), the alias's cut save "Not saved"; with the first session's alias changed too, the alias shows the conflict line; leaving a "Not saved" field again saves it. |
| S13-06 | **The workspace settings form.** A conflict on the workspace's description keeps the typed text with the conflict line; "Keep mine" saves without an undo step (S0-08 changed). |
| S13-07 | **The requirement panel.** A refusal keeps the typed text in every text field; nothing goes back on its own. |
| S13-08 | **A choice field.** A save of an entity's stereotype refused as stale shows the newest stored stereotype, with the toast; nothing is overwritten. |
| S13-09 | **A fresh value without a draft.** An undo on the project home, and another session's save followed by a fresh page of this one (an own save of another field), show the new stored value in a field that has neither a draft nor the focus; a field with a draft keeps it. |
| S13-10 | **Permission and archive.** A save refused because the workspace was archived meanwhile, or the person's role became reviewer: the typed text stays readable and selectable, marked "Not saved. You can still copy it.", and nothing is written. A locked organization keeps the draft editable. |
| S13-11 | **A deleted object.** A save on an entity deleted meanwhile in another session: the domain's toast, the panel goes, the draft with it. |
| S13-12 | **Nothing on the canvas changes.** Typing 20 characters in an attribute's panel field and pressing "Use this" add **0** canvas commits (`window.__imCanvasCommits`, as S9-14); a conflict's fresh page adds as many as an own save's fresh page of the same field. `S3B-15-elements.spec.ts` against `.data/measure/s9-14-baseline/slice-08.json`: the viewport counts equal; the page totals as slice 12b's, or each difference explained. |
| S13-13 | CI and the runs of the test regime; changed earlier tests listed with the reason. |
| S13-14 | **A draft whose field is gone** (item 5a): a refused save after the panel closed comes back with its state when the object's panel opens again, and is gone after a reload. |

**Definition of done (scenario for the manual acceptance, on Łukasz's model KB, after the backup).**

1. In "Kanton Basel", open an entity in two browser windows (two people, or two sessions).
2. Change its description in the first. In the second, type a different description and leave the field: read the conflict line; press "Keep mine"; undo it.
3. Repeat and press "Use this".
4. In one window, type a long description, press Enter and keep typing at once: nothing is lost.
5. Change the workspace's description in the settings in both windows.

## 6. Performance

The slice adds state to fields and a line under a field on a conflict.

- **Typing costs the canvas nothing:** a draft lives in its field; S13-12 counts canvas commits while typing, as S9-14 does.
- **Nothing reads layout** during a commit (CLAUDE.md, AD-24): the line's folding uses CSS (`line-clamp`), not a measured height.
- **New elements on the canvas:** none.
- **No measurement sitting.**

## 7. Questions for step 1

**The rule (CLAUDE.md, "How we work"):** a PRD is a proposal to verify, not a specification; this one was written from the docs without reading the code. In step 1, check every item, decision and acceptance criterion against the code, `docs/decisions.md` and the earlier slices' acceptance docs. Write into `docs/prd/slice-13-acceptance.md` where the PRD is wrong, contradicts the code or a decision, duplicates what the app already has, misses what the code needs, or costs more than it assumes (data model, undo, change events, performance), each with the files and functions behind it and a proposal. List the differences between the reference prototype and the app that the slice touches. No application code in step 1; Łukasz answers before step 2.

- **Q1. The inventory.** Every field that saves a row, per page and panel:
  - its component (`TextField` and the others in `src/app/_panels/fields.tsx`, `project-heading.tsx`, the settings form, the requirement panel, anything else);
  - how it saves (`saveRow`, `saveRows`, `run`);
  - its key;
  - what it does after each kind of refusal today.

  Mark the fields R5 leaves out, and any field the PRD does not name.
- **Q2. The draft.** How to keep a draft across the page's fresh values without remounting the field: what replaces `fieldKey` (a key by object and field, with the stored value adopted only without a draft or focus), what the "Tab lost the focus" fix (`fix/panel-field-focus`) needs kept, and where the draft lives so that typing renders only the field.
- **Q3. Escape and leaving.** What Escape does in each field today, and what happens to a draft when the panel's selection changes, the panel closes, or the page is left. Proposal: a draft not saved when its field is left is saved, as today; nothing new on leaving the page.
- **Q4. The newest stored value.** Where the conflict line takes it from (the refusal's answer, the page's refresh, a read) and how a long text is folded.
- **Q5. The author.** Whether the page knows who made the newest change of a row (change events, `workspacePeople`) without a new read; if not, propose leaving "by {person}" out.
- **Q6. A deleted object.** What the panel does today when its object is deleted while a save is on its way, and what keeping the draft as read-only text would cost.
- **Q7. Permission, archive, locked organization.** How a field becomes read-only today after the page's fresh state (a role change, an archive), and what keeping a draft readable until the person leaves needs.
- **Q8. The save chain.** What `rowSaves` needs to tell a field: that its save was refused, of which kind, that it was cut, and the stored value after it. Whether "Keep mine" can reuse `saveRow` with the newest version.
- **Q9. Earlier tests and docs.** Specs whose expectations change (S0-08, S9-03, the requirement panel's, any that assert a field goes back), and the docs to update.
- **Q10. Test hooks.** The hook to hold a save's answer (slice 10c) and to make a second session's save land first; anything the specs need that does not exist.

## 8. Differences from the prototype (deliberate)

- **The prototype has no save conflicts,** no drafts across saves and no refusals of a stale version. Everything in items 6–11 is new.
- **Fields look as before** apart from the line under a field on a conflict or a "Not saved" mark.

## 9. Left for later

- **The writes still off the save chain (R5):** a canvas's rename in its tab, the canvas's look, the names check boxes, the change-to-resolve actions.
- **Notes and frames on the common rule** (a note's text keeps its draft after a refusal): a candidate for the next scope after slice 13 (`docs/ideas.md`).
- **"by {person}"** from the field's own last change event (`docs/ideas.md`).
- **A warning when leaving a page with a draft** not saved (`beforeunload`).
- **A field-level merge** of two texts (showing the differences), beyond "Use this" and "Keep mine".
- **Drafts kept across a reload** (in the browser's storage).

## 10. Decisions to accept, and docs in this PR

### D-66 (proposal, updated to the step 1 answers) A field's draft and a refused save

"Every text field that saves an object's row keeps what the person typed (its draft) until it is saved or they drop it. A save's answer, an undo or another person's write never replaces a draft or a focused field. Text typed while a save is on its way stays and is saved next. A refusal that cuts (a stale version, a permission, the archive, an object not found) brings the fresh page with it. After a refused save the field keeps its draft:
- on a conflict over the field's own value it shows the other value under the field (in a rich-text field, inside its editor), with 'Use this' (take it) and 'Keep mine' (save the draft on the newest version, an ordinary undo step; in the workspace settings an ordinary save, as settings are not undo steps); while the line shows, leaving the field saves nothing;
- a save cut behind a conflict, or refused as stale while its own value did not change, keeps its draft as 'Not saved', saved again by the person;
- after a permission or archive refusal the draft stays readable and can be copied; after a locked organization's refusal it stays editable;
- an invalid input keeps the draft for correcting;
- a deleted object takes its draft with it;
- a draft refused after its panel closed comes back when a panel of that object opens again on the same page, and is gone when the page is left.

Escape in a text field puts the stored value back (while a conflict line shows, it is 'Use this'). An empty required name goes back to the stored name (D-59). Choice fields (selects, segmented buttons, flags, check boxes) keep no draft: after a refusal they show the newest stored value, with the toast. Notes and frames keep their canvas queue: a note's text still rolls back after a refusal. The workspace settings, the requirement panel and the working label's panel no longer go back on a refusal. (Slice 13.)"

### Assumptions to confirm

- **A1.** The slice starts from `main` after the e2e reliability chore's merge; step 1 records the commit.
- **A2.** No data model change and no new format of the local data file.
- **A3.** Łukasz's KB model is backed up before the manual acceptance; it is not reset or seeded.
- **A4.** The seed is not changed.

### Docs in this PR

- **`docs/decisions.md`** (only with Łukasz's approval): D-66.
- **`docs/known-limitations.md`:** "Typing into a field while its save is on its way" removed; the "Saving in panels" entries updated; anything steps 1–4 find and Łukasz accepts.
- **`docs/ideas.md`:** the two entries done; section 9's entries; the plan: 13 done, and what comes next.
- **`docs/inventory-prototype-vs-app.md`:** section 8's differences.
- **README and CLAUDE.md:**
  - the slice's status (README's status line still says slice 12b awaits acceptance: correct it);
  - "Saving in panels" with the draft and the conflict line;
  - the new e2e helpers.
