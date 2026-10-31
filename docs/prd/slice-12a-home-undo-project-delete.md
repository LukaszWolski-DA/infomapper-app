# Slice 12a – Undo on the home pages, and deleting a project

Status: **step 1 answered (Łukasz, 31 October 2026)**; the PRD is updated to the answers (`slice-12a-acceptance.md`, F1–F29, Q-A to Q-G). Branch `slice/12a-home-undo-project-delete`, from `main` at `de2af7f`: tag `slice-11` plus one docs-only merge (assumption A1). PRD file: `docs/prd/slice-12a-home-undo-project-delete.md`; step 1 writes `docs/prd/slice-12a-acceptance.md`. Test regime: a small slice (CLAUDE.md, "Testing"), plus the earlier undo specs in every step (section 5) and one full e2e run at the closing. Step 1 checks this PRD against the code (CLAUDE.md, "How we work").

This PRD was written from the docs at slice 11's state (`CLAUDE.md`, `docs/decisions.md`, `docs/data-model-v2.md`, `docs/known-limitations.md`, `docs/ideas.md`, the acceptance docs of slices 8, 9 and 11) and from the prototype's `renderHome`, `renderWsHome`, `mutate` and `toast`, without reading the code.

## 1. Why this slice

The plan after slice 10a (`docs/ideas.md`) puts the home pages next. Slice 12 is split: **12a** brings undo and redo to the home pages and lets people delete a project; **12b** brings the canvas tiles' thumbnails after measuring the home's load.

Today the project and workspace home pages write into the person's undo history (projects, canvases, a project's name and description), but those steps can be undone only from a canvas (D-59, known limitation "No undo outside canvases"). Pinning a label is not an undo step at all (D-29). And a project, once created, cannot be deleted: the prototype can (`renderHome`, "Delete this project"), the app cannot (`docs/inventory-prototype-vs-app.md`, "Delete a project").

**Agreed with Łukasz on 31 October 2026:**

- **P1. The same undo everywhere.** The home pages get the canvas pages' Undo and Redo buttons and keys, on the same history: one per person and workspace, the last 50 steps, in the server's memory until the database slice. From a home page a person undoes any step of theirs in its turn, also one made on a canvas, and the toast names the step ("Undone: {step}", as on canvases today).
- **P2. Pinning a label to a project becomes an undo step,** and so does unpinning it (a change of D-29). The prototype's pin already goes through `mutate`, so this follows the prototype.
- **P3. A project is deleted from its own home,** as in the prototype: a "Delete this project" section at the end of the page, two clicks, no dialog. (The tile menu on the workspace home considered earlier is not built.)
- **P4. The preview is the text under the button,** computed from what the page already has: which canvases are deleted with the project and which stay in their other projects. The model is never changed (D-28).
- **P5. Deleting a project is one undo step.** Undo brings back the project with its canvases, their content, its canvas links and its pinned labels.
- **P6. The last project cannot be deleted:** the button is disabled with "This is the only project." (prototype); the server refuses it too.
- **P7. After the delete the person lands on the workspace home** (D-38: a project that no longer exists leads to the workspace home), not on another project's home as the prototype does. The toast offers Undo.
- **P8. A page of a deleted project** (its home or one of its canvases), loaded by anyone in any way (reload, link, Back, Forward), shows the workspace home with a toast, as D-38 does for traversals. This exists since slice 6b (`loadShell`, "That project no longer exists."; step 1, F1); S12A-12 keeps it as a regression test.
- **P9. Archive:** an archived workspace refuses the delete and every undo and redo, as today.
- **P10. Texts follow the prototype** ("The model is untouched.").

**Confirmed in step 1 (Łukasz, 31 October 2026):**

- **P11. Who deletes a project:** owners, admins and modelers (Q-D), as for creating a project, editing its name and deleting a canvas (AD-05; all `EDITORS`, F20). A new permission `project.delete` with the editors, so that it can be narrowed later without touching `project.edit`. Only the person who deleted a project can undo the delete: the undo history is personal.
- **P12. No data model change** and no new format of the local data file: `project` has `deleted_at`; `project_canvas` and `project_pinned_label` are link rows removed with a before image (data model, section 10). So no KB backup step is needed before the closing's usual backup (F25).

## 2. Sources

**Prototype:** `renderHome` (the "Delete this project" section, `data-hdel`, its armed second click, the texts and the toast), `renderWsHome` (the project tiles, no menu), `mutate`, `doUndo`, `doRedo`, `toast` (an Undo toast for destructive actions), the top bar's `#tUndo` (shown on both home pages).

**Decisions:**
- **D-10, D-11:** live canvases (a label has at most one live canvas).
- **D-26:** the working context labels no layout change and no delete.
- **D-28:** canvases in several projects; deleting a project deletes only canvases no other project uses.
- **D-29:** the project home; pins (changed by this slice).
- **D-38:** history places; a project that no longer exists leads to the workspace home.
- **D-58:** people and password changes are not undo steps (unchanged).
- **D-59:** a project's name and description; "the home pages have no Undo or Redo" (changed by this slice).
- **AD-05, AD-09:** roles, archive. **AD-12, AD-13:** versions, change events, one action = one undo step. **AD-23:** writes.
- **AD-24:** nothing on the canvas changes (section 6).

**Data model:** `docs/data-model-v2.md` section 9 (`project`, `project_canvas`, `project_pinned_label`, `canvas`, `canvas_item`, `frame`), section 8 (`note`), section 10 (`change_event`: link rows removed, not soft-deleted).

**Earlier slices:**
- **1b:** undo and redo, the history, the Undo toasts on destructive actions (S1B-13).
- **3a:** pins as change groups that are not undo steps; a label's delete brings its pins back on undo.
- **6b:** back and forward, `GONE`, a missing place's toasts.
- **8:** `isUndoable`, `UNDOABLE_TABLES`; the last owner checked again inside the local adapter's write (`workspaceWithoutOwner`).
- **9:** the project's name and description on its home (`project-heading.tsx`), `saveRow`, undo as `rowSaves.exclusive`, S9-09 (undo of a rename from a canvas), Q6 and F11 (the `project_pinned_label` exception in `isUndoable`).
- **10a:** the save chain's `{ deletes: true }` cut; `ConfirmDelete`.

**Known limitations:** "No undo outside canvases"; "'At least one canvas' can race".

## 3. What to build

Texts in quotes are proposals. The step that builds them lists every new user-facing text for approval.

### Undo and redo on the home pages

1. **The buttons.** The workspace home and the project home show the top bar's Undo and Redo buttons, in the same place, with the same titles and the same enabled state as on a canvas page, for the same people. Nothing else of the canvas's top bar comes with them.
2. **The keys.** Ctrl+Z undoes and Ctrl+Shift+Z redoes (plus any other key the canvas pages accept, Q1) when the focus is not in a text field. In a text field (the project's name and description, the workspace settings' fields, the People tab's fields) the browser's own text undo works and the person's history is not touched.
3. **The same history.** Undo and redo on a home page take the person's newest step in the workspace, wherever it was made (a canvas of any project, a home page), with the same refusals as on a canvas ("changed afterwards", the archive, a locked organization) and the same toasts ("Undone: {step}", "Redone: {step}"). A home page has no open canvas, so a step made on a canvas reads "Undone: {step} on {canvas}" (`doneStepMessage`, F16).
4. **What the home shows afterwards.** After an undo or a redo the home page shows the fresh state: tiles, stats, the "Also in" texts, pins, the project's name and description, model consistency. The versions undo and redo wrote reach the save chain (`rowSaves.exclusive`, as on canvases), so the next rename of the project is not refused as a false conflict.
5. **An undo or redo that removes the page's own project** (undoing "Create project" on that project's home, redoing a project's delete) leads to the workspace home with only the toast "Undone: {step}", as an undo that takes the open canvas away does on canvas pages (Q-A, F3). An undo that removes a canvas only removes its tile.
6. **Unchanged:** which writes on the workspace home are undo steps (Q2 lists them); people and password changes stay outside undo (D-58).

### Pins

7. **Pinning and unpinning a label** on the project home is one undo step each, named "Pin label {label}" and "Unpin label {label}" by the command (the pin's change events hold only ids; F4, F18). The `project_pinned_label` exception in `isUndoable` goes. Who may pin is unchanged (D-29). Deleting a label stays one undo step that brings its pins back on undo.

### Deleting a project

8. **The section.** At the end of the project home, after "Open notes", a section with the button "Delete this project" and a text under it, for people with `project.delete` (P11) in a workspace that is not archived. Others do not see the section: the app leaves out the controls a person may not use (F19).
9. **The text under the button (the preview):**
   - when the project is the workspace's only live project: the button is disabled, and the text is "This is the only project.";
   - otherwise: "The model is untouched. Canvases shared with other projects stay there; canvases only in this project are deleted with it." followed by what applies of "Deleted with it: {canvas}, {canvas}." and "Staying in other projects: {canvas}, {canvas}.";
   - computed from the page's data (the tiles already know each canvas's other projects); no extra read and no layout read.
10. **Two clicks.** The first click arms the button: "Click again to delete the project" (the prototype's text, Q-C; a new optional prop of `ConfirmDelete` for the armed text). It disarms the way the app's other armed deletes do (`ConfirmDelete`: after 4 s or on blur). The second click deletes. The delete goes through the project row's save chain (`saveRow` with `deletes: true`, F23).
11. **The command `deleteProject`** (domain), in one change group:
    - checks `project.delete`, the archive, a locked organization and the project's version; the project's canvases and their contents are read as they stand (the adapter refuses a row changed between read and write; F10);
    - refuses the workspace's last live project: "A workspace needs at least one project.";
    - soft-deletes the project;
    - removes the project's `project_canvas` rows and its `project_pinned_label` rows;
    - soft-deletes each of its canvases that no other project links, with everything a canvas's delete takes today (cards, requirement cards, frames, notes), through the same code: the soft-delete part of `deleteCanvas` becomes one shared helper, and `deleteCanvas` behaves as before (F10);
    - leaves every shared canvas, with its content, in its other projects;
    - writes nothing in the model (concepts, entities, attributes, relationships, sources, mappings, requirements, labels, label links) and no working-context label (D-26);
    - when a deleted canvas is a label's live canvas, the label has none afterwards; its next "Open live" makes a new one (D-10). Undo brings the old one back.
12. **The undo step** is named "Delete project {project}"; "Create project" is named so too, instead of today's "Create canvas" (Q-F, F4). Undo restores everything item 11 wrote in one step, or refuses as a whole with the existing message when anything it would restore has changed or lost its parent since: a shared canvas deleted afterwards, a pinned label deleted afterwards, and any entity, source table, requirement, concept or source system shown on one of its own canvases deleted afterwards (F6). A refused step leaves the history, as every refused undo does. A canvas whose live label was deleted afterwards does not come back either (`canvas.live_label_id` joins `PARENTS`, F11). Redo deletes again. Undo and redo of a project's delete need `project.delete` (F12).
13. **The last project under concurrent deletes and under undo.** Two people deleting the last two projects at the same moment could both pass the check, and an undo of "Create project" or a redo of a delete could remove the last project too (F7). So undo refuses a revert that leaves the workspace without a live project ("changed afterwards", as for D-28's rules), and the local adapter counts the live projects again inside its serialised write and refuses any write that leaves none, as it does for the last owner (`workspaceWithoutProject` beside `workspaceWithoutOwner`; F8); the database slice does it in the write's transaction. A shared canvas left in no project by a delete racing a removal is a known limitation, added to "'At least one canvas' can race" (Q-B, F9).
14. **After the delete** the page goes to the workspace home and shows the toast "Deleted the project {project} and {n} canvases that only it used. The model is untouched." (one canvas: "… and 1 canvas that only it used. …"; with no canvas: "Deleted the project {project}. The model is untouched."), with Undo, as the app's other destructive toasts (S1B-13). The count comes from the server's result. Undo from the toast or with Ctrl+Z restores the project; the person stays on the workspace home, where its tile is back. The toast's Undo works on the home pages (`useAction` falls back to the page's `UndoProvider`, F13), and one undo queue serves every provider and toast (F21).
15. **The browser's leftovers** of a deleted project (the remembered last canvas per project, the canvases' remembered views, the project switcher, "Add a canvas from another project") must neither break a page nor offer the deleted project or its deleted canvases. Q11 lists them.

### Pages of a deleted project

16. **Loading a page of a deleted project** (its home, or any canvas under its address, shared canvases included) goes to the workspace home with D-38's toast "That project no longer exists.". This holds for a reload, a link, a bookmark, Back and Forward, and for every person. It exists since slice 6b (`loadShell`, F1); S12A-12 keeps it as a regression test.
17. **An open page of someone else** learns of the delete on its next load. Until then a write on a deleted canvas is refused as not found, as today; a write on a shared canvas goes through, because the canvas exists. No live notice is built.
18. **One rule for items 5, 14 and 16, in one place (`loadShell`):** the page whose project no longer exists goes to the workspace home with item 16's toast, except when it is drawn again as the result of the person's own action that removed the project (the delete, an undo or a redo): then it goes there without that toast, and the action's own toast is shown (item 14's, or "Undone: {step}"). The action marks this with a short-lived cookie, as `rememberNextCanvas` does for canvases (F2).

### Unchanged

19. **Unchanged:**
    - D-28's rules for removing a canvas from a project and deleting a canvas;
    - the model and everything in it;
    - creating projects and canvases;
    - the workspace's lifecycle (archive, duplicate, transfer, delete);
    - people and passwords;
    - the canvas pages and the canvas (section 6).

## 4. Steps

Stop after each step with a short summary of what changed and how to check it. Wait for Łukasz before the next. A new Claude Code session may start at a step's boundary, never inside a step; it starts by reading CLAUDE.md, this PRD and `slice-12a-acceptance.md`.

1. **Critical review** (section 7). Check every item, decision and criterion against the code, `docs/decisions.md` and the earlier slices' acceptance docs. Answer Q1–Q12 in `docs/prd/slice-12a-acceptance.md`, with the differences from the prototype the slice touches and every new text proposed. No application code. Stop.
2. **The domain** (items 7, 11–13): `deleteProject` and `project.delete`; pins as undo steps; the undo step names; undo and redo of a delete; the last-project check (and inside the local adapter's write, if Łukasz agrees after Q10). Unit tests: the delete's change group (shared and unshared canvases, pins, a live canvas, a requirement card, notes, frames), its undo and redo, the refusals (last project, rights, archive, stale version, undo after a shared canvas or a pinned label was deleted), the model untouched, a label's delete still bringing its pins back. CI. Stop.
3. **Undo on the home pages** (items 1–6). The buttons, the keys, the fresh page, the versions back to the save chain, undo that removes the page's project. Specs S12A-01 to S12A-06, the earlier undo specs (section 5) and CI. Stop.
4. **Deleting a project** (items 8–10, 14–18). The section, the preview, the two clicks, the landing and the toast, pages of a deleted project. Specs S12A-07 to S12A-12, the earlier specs of the project home, the workspace home, the project switcher and back and forward, and CI. Screenshots: the section with shared and unshared canvases, armed, the only project, light and dark. Every new text listed. Stop.
5. **Closing:**
   - the docs (section 10);
   - S12A-13's element check;
   - one full e2e run, keeping a failing test's error output and trace before rerunning it;
   - CI and the pull request with both GitHub checks;
   - a backup of KB (`.data/backups/dev-db-<yyyymmdd-hhmm>.json` and `kb-model-latest.json`);
   - the manual acceptance scenario.

   Merge and tag `slice-12a` only on Łukasz's command.

## 5. Acceptance criteria

Tests in `e2e/slice-12a/`, one file per criterion, each from a fresh seed; unit tests next to the code. In steps 3 and 4 also run the earlier undo specs (slice 1b's undo and redo, S1B-13, S9-09, S11-05, S11-11) and the specs Q12 names.

| ID | Criterion |
| --- | --- |
| S12A-01 | **Buttons on both homes.** After moving a card on a canvas, the project home's Undo undoes the move ("Undone: Move card on {canvas}") and Redo redoes it; the canvas shows the result. The same from the workspace home. With nothing to undo the buttons are disabled, as on a canvas. |
| S12A-02 | **The project's name.** Rename the project on its home, press Undo on the home: the field, the breadcrumbs and the switcher show the old name; a new rename right after it is stored without a conflict. |
| S12A-03 | **Keys.** Ctrl+Z outside a text field undoes the newest step, Ctrl+Shift+Z redoes it. Typing in the project's description and pressing Ctrl+Z there undoes the typing only: the person's history is unchanged (the step made before is still undoable). |
| S12A-04 | **Refusals on a home.** A step whose row someone else changed since is refused with the existing message and changes nothing; in an archived workspace undo and redo are refused. |
| S12A-05 | **Undo removes the page's project.** Create a project, then on its home press Undo: the workspace home shows with only "Undone: Create project" (not item 16's toast), and the project is gone; Redo brings it back ("Redone: Create project"). |
| S12A-06 | **Pins.** Pinning a label on the project home is one undo step ("Undone: Pin label CR-23"), and so is unpinning it; redo works. A reviewer or reader sees the plain ★ (D-29). Deleting the label and undoing it still brings the pin back. |
| S12A-07 | **The preview.** In a project with one canvas of its own and one shared canvas, the section names both under "Deleted with it" and "Staying in other projects", with "The model is untouched." The first click arms the button; the arm goes as `ConfirmDelete`'s does. |
| S12A-08 | **The delete.** The second click deletes the project: the workspace home shows with item 14's toast; in the data the project is deleted, its own canvas is deleted with its cards, requirement cards, frames and notes, the shared canvas is in its other project with all its content, the project's canvas links and pins are gone, the model's rows are unchanged, all in one change group. |
| S12A-09 | **Undo and redo of a delete.** Undo from the toast restores the project, its canvas with its content, its links and pins, and its tile on the workspace home; redo deletes it again; Ctrl+Z on the workspace home undoes it as well. A delete whose pinned label was deleted afterwards cannot be undone: the existing message, nothing written, the step leaves the history. |
| S12A-10 | **The last project.** With one project left, the button is disabled with "This is the only project."; a direct call is refused with item 11's message. |
| S12A-11 | **Rights and archive.** A reviewer and a reader see no delete section, and a direct call is refused ("As a reviewer you cannot delete projects."); in an archived workspace there is no section and the delete is refused. A modeler deletes. |
| S12A-12 | **Pages of a deleted project** (a regression test of D-38's existing redirect, F1). A second person has the project's home and its own canvas open; after the delete, a write on that canvas is refused as not found, a reload of each page shows the workspace home with item 16's toast, and so does Back to the deleted project's home in the first person's tab. A shared canvas opened under the deleted project's address does the same. |
| S12A-13 | **Nothing on the canvas changes.** `S3B-15-elements.spec.ts` against `.data/measure/s9-14-baseline/slice-08.json`: the viewport counts equal; the page totals as slice 11's, or each difference explained. |
| S12A-14 | CI and the runs of the test regime; changed earlier tests listed with the reason. |

**Definition of done (scenario for the manual acceptance, on Łukasz's model KB, after the backup).**

1. In "Kanton Basel", change something on a canvas, go to the project home and undo it there; redo it.
2. Rename the project on its home and undo it with Ctrl+Z outside the field.
3. Pin a label and undo it.
4. Make a test project with a canvas of its own and add a shared canvas to it; read the preview; delete the project; undo from the toast; delete it again.
5. Open the deleted project's address from the browser's history.

## 6. Performance

The slice adds nothing to the canvas. The home pages get two buttons in their top bar and a section at the end of the project home.

- **New elements on the canvas (AD-24):** none. S12A-13 checks that the canvas page did not change.
- **Nothing above the canvas reads layout during a commit** (CLAUDE.md). The top bar is shared with the canvas pages: the buttons' enabled state comes from data, never from a measured size, and the preview's texts come from the page's data.
- **No measurement sitting.** The home's load is measured in slice 12b, before the thumbnails.

## 7. Questions for step 1

**The rule (CLAUDE.md, "How we work"):** a PRD is a proposal to verify, not a specification; this one was written from the docs without reading the code. In step 1, check every item, decision and acceptance criterion against the code, `docs/decisions.md` and the earlier slices' acceptance docs. Write into `docs/prd/slice-12a-acceptance.md` where the PRD is wrong, contradicts the code or a decision, duplicates what the app already has, misses what the code needs, or costs more than it assumes (data model, undo, change events, performance), each with the files and functions behind it and a proposal. List the differences between the reference prototype and the app that the slice touches. No application code in step 1; Łukasz answers before step 2.

- **Q1. Undo on the canvas pages today.**
  - Where the buttons are drawn (the top bar's component, shared with the home pages or not) and how their enabled state reaches the page.
  - The keyboard handler: which keys, the rule for text fields, where it is installed.
  - The toasts, `rowSaves.exclusive`, and how the page refreshes after an undo.
  - The smallest change that gives both home pages the same buttons and keys, without bringing the canvas's other tools.
- **Q2. The workspace home's writes.** Which are undo steps today (settings, Data Vault 2.0 mode, four-eyes, archive and unarchive, concept colours, classifications, others) and which are not (people, passwords). Whether undoing an archive is refused by the archive rule itself, and what a home-page undo of it would show. No change is proposed; say if one is needed.
- **Q3. Pins.** The pin command, the `project_pinned_label` exception in `isUndoable`, the names its steps would get from `changeLabel` or the write set's `label`, and the specs that assert a pin is not undoable (slice 3a).
- **Q4. A canvas's delete today.** The command, what it deletes (cards, requirement cards, frames, notes, a live canvas's link to its label), its refusals (a project's last canvas, D-28's shared canvas), and whether `deleteProject` can call it per canvas inside one change group.
- **Q5. Undo of a delete.** `revertChangeGroup` and `PARENTS` for `project`, `project_canvas`, `project_pinned_label`, `canvas` and the canvas's children: the order of restoring, the check that refuses a restore whose parent is gone (a deleted label, a deleted shared canvas), and that a refused undo writes nothing. Confirm that no column or format change is needed (P12).
- **Q6. Pages of a missing project or canvas today.** The loaders of the project home and the canvas page (`notFound()`, S0-11, `loadShell`), D-38's texts in `SelectionHistory.tsx` and elsewhere, and the one place where item 16's redirect and toast belong. What a canvas page does today when its canvas is not in the project of its address.
- **Q7. A toast across a navigation.** Whether a toast with Undo, shown by the project home, survives the move to the workspace home; if not, the smallest way to show it there.
- **Q8. The armed delete and the archive.** `ConfirmDelete` (its `then`, how it disarms) and whether the project home can use it. How the app shows an editor's control in an archived workspace (hidden, disabled, read-only), to follow for the section.
- **Q9. Permissions.** `project.create`, `project.edit`, `canvas.delete` and `canvas.remove` (or their real names) and their roles; where `project.delete` goes.
- **Q10. The last project inside the local adapter's write.** What counting the live projects again inside the serialised write costs, compared with `workspaceWithoutOwner`.
- **Q11. The browser's leftovers.** Every place that remembers a project or its canvases in the browser or in a cookie (the last canvas per project, remembered views, history places in `sessionStorage`, the panels' cookie) and what each does with a deleted project.
- **Q12. Earlier tests and docs.** Specs that change (pins not undoable, no undo on the home pages, S9-09's "from a canvas", the project home's sections, the inventory's row) and the docs to update.

## 8. Differences from the prototype (deliberate)

- **After the delete** the app shows the workspace home (D-38); the prototype shows another project's home.
- **The preview names the canvases** deleted and staying; the prototype's text is general.
- **The undo toast names the step** ("Undone: Delete project …"); the prototype says "Undone". The app does this since slice 1b.
- **A page of a deleted project** goes to the workspace home with a toast; the prototype has no other people and no addresses.
- **The last-project refusal on the server** and the concurrent-delete check have no counterpart in the prototype.

## 9. Left for later

- **Deleting a project from the workspace home** (a tile menu).
- **A list of deleted projects to restore** after the undo history is gone (a restart, more than 50 steps).
- **Moving a project's own canvases** to another project before deleting it.
- **A live notice** to people who have a deleted project open.
- **The workspace's lifecycle** from the prototype (duplicate, transfer, export and delete).
- **Slice 12b:** the canvas tiles' thumbnails, after measuring the home's load. **Slice 13:** one behaviour for a refused save in every field (F6), with the typed text kept on a conflict and while a save is on its way (S9-06's race).

## 10. Decisions to accept, and docs in this PR

### D-65 (proposal) Undo on the home pages, and deleting a project

"The workspace home and the project home have the canvas pages' Undo and Redo, buttons and keys (outside text fields), on the same history: a person undoes and redoes their steps in the workspace in their turn from any page, also a step made on a canvas, and the toast names the step. A project is deleted from its home, by owners, admins and modelers in a workspace that is not archived: the section at the end of the page names the canvases deleted with it and those staying in their other projects, and a second click deletes. The model is untouched; canvases no other project uses are deleted with their content; the project's pins go with it. The last project cannot be deleted, also not by an undo or a redo. Deleting a project is one undo step that brings everything back; only the person who deleted it can undo it, as the undo history is personal. The undo is refused as a whole when anything it would bring back depends on something deleted since (a pinned label, a shared canvas, an element shown on one of its canvases). Afterwards the person is on the workspace home; any page of a deleted project leads there, with a toast."

(Roles confirmed by Łukasz, Q-D.)

### D-29 (change)

Replace "Pinning a label to a project is saved with its change event but is not an undo step (no undo outside canvases yet)." with "Pinning a label to a project and unpinning it are one undo step each (slice 12a)."

### D-59 (change)

Replace "The home pages have no Undo or Redo. Such a step is undone and redone from any canvas of the workspace, of any project, in its turn after the steps the person made later." with "Such a step is undone and redone from any page of the workspace, in its turn after the steps the person made later (slice 12a, D-65)."

### D-58 (change)

Replace "People changes and password changes are change events in the workspace's log, never with the hash; like a pin (D-29) they are not undo steps." with "People changes and password changes are change events in the workspace's log, never with the hash; they are not undo steps." (step 1, F18)

### D-28 (addition)

"A project is deleted from its home (slice 12a, D-65); the last project cannot be deleted."

### AD-05 (note)

"Note (slice 12a): Owners, admins and modelers delete a project (`project.delete`, D-65)."

### Assumptions to confirm

- **A1.** The slice starts from `main` at `de2af7f` (tag `slice-11` plus one docs-only merge); confirmed in step 1.
- **A2.** No data model change and no new format of the local data file (P12, Q5).
- **A3.** Łukasz's KB model is backed up before the manual acceptance; it is not reset or seeded.
- **A4.** The seed is not changed; tests make their extra projects and pins through the domain.

### Docs in this PR

- **`docs/decisions.md`** (only with Łukasz's approval): D-65; the changes of D-29, D-58 and D-59; D-28's addition; AD-05's note.
- **`docs/data-model-v2.md`:** section 11's rules (the last project; a project's delete and what it takes); no table changes (A2).
- **`docs/inventory-prototype-vs-app.md`:** "Delete a project" done, its source corrected to `renderHome` (`data-hdel`, not `openProjMenu`); section 8's differences.
- **`docs/known-limitations.md`:** "No undo outside canvases" removed (its history paragraph kept where still true); "'At least one canvas' can race" gets the shared canvas left in no project by a delete (F9); "The last owner …" gets a database-slice note for the last project (F8); "The undo history lives in server memory" gets the delete that cannot be undone after a restart (F27); the wider refusals of a delete's undo (F6); anything else steps 2–4 find and Łukasz accepts.
- **`docs/ideas.md`:** "Undo and redo on the project and workspace home pages" done; section 9's entries; the plan: 12 split into 12a (done) and 12b (next).
- **README and CLAUDE.md:** the slice's status; undo on the home pages; deleting a project; the new e2e helpers.
