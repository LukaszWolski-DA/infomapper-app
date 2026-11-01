# Slice 12a – acceptance

Status: **step 5 (closing) done; waiting for Łukasz's manual acceptance, then his command to merge and tag `slice-12a`.**

- Branch `slice/12a-home-undo-project-delete`, made on 31 October 2026 from `main` at `de2af7f` (the start commit). Tag
  `slice-11` is at `6c231c6`; `main` is one docs-only merge past it (PR 29, the InfoCube idea in `docs/ideas.md`), so
  the code is slice 11's (A1).
- The PRD is copied unchanged from `~/Downloads/slice-12a-home-undo-project-delete.md` (29,061 bytes, SHA-256
  `2d388194…7efe2`, identical byte for byte). Commit "docs: add slice 12a PRD and acceptance".
- `.data/dev-db.json` (KB) is not touched. Nothing that opens the local file was run.

Step 1 checks items 1–19, P1–P12, section 10's decisions, A1–A4 and S12A-01 to S12A-14 against the code,
`docs/decisions.md` and the earlier acceptance docs. Most of the PRD holds, and two of its biggest pieces already exist:
the redirect of a deleted project's pages (item 16) and the refusal of a partial undo (item 12). What the PRD misses is
mostly in undo: the step's name, the last project under undo, and who may undo a delete.

## Step 1: findings

| # | Finding | Code behind it | Proposal |
| --- | --- | --- | --- |
| F1 | **Item 16 exists already (D-38, slice 6b).** Every page under a project that is not live (its home, any canvas under its address, shared canvases included) redirects to `/w/{ws}?gone=project`, and the workspace home shows "That project no longer exists.". This holds for a reload, a link, Back and Forward, and for every person. `S6B-06.spec.ts` tests it with a project id that never existed. | `loadShellFor` (`src/app/_lib/shell.ts`): `if (!project) redirect(…?gone=project)`, before the canvas check; `GoneNotice` (`src/app/w/[workspaceId]/page.tsx`) | Nothing to build for item 16. S12A-12 checks it with a really deleted project. The one place for items 5, 14 and 18 is this same line (F2). |
| F2 | **Item 18's exception needs a signal, or the person's own delete shows two toasts.** After the delete's server action, `revalidatePath` draws the project home again inside the action's answer. `loadShell` then redirects to `?gone=project`, so "That project no longer exists." races with item 14's toast (one toast at a time). For canvases, slice 2a solved the same thing with a short-lived cookie: the action remembers where it leads, and `loadShell`, under the `next-action` header, opens it without a toast. | `shell.ts` (the `next-action` branch for canvases); `rememberNextCanvas`, `nextCanvasFor` (`src/app/_lib/next-canvas.ts`, a one-minute cookie) | A twin, `rememberGoneProject(projectId)`, written by the delete action and by an undo or redo that removes a project. In `loadShell`, under `next-action` and with that cookie naming this project, it redirects to the workspace home **without** `?gone`. Every other arrival, someone else's write on a shared canvas included, keeps `?gone=project`. One line in `loadShell`, one helper. |
| F3 | **Item 5 and S12A-05: two toasts for one undo.** An undo that removes the page's project ends with "Undone: {step}" from `UndoProvider`. Item 16's toast on top of that would replace it, or be replaced by it. On canvases, an undo that takes the open canvas away opens another canvas silently, with only "Undone: …" (slice 2a). | `undo.tsx` (`run` → `toast(doneStepMessage…)`); `undoAction` → `rememberNextCanvas` | **Proposal:** follow the canvas precedent. After an undo or redo of yours that removes the page's project, the workspace home shows only "Undone: Create project" (F2's cookie, no `?gone`). S12A-05 changes accordingly. **Q-A** |
| F4 | **The step "Create project" is named "Create canvas" today** (a slip since slice 0, only visible on canvases until now). `changeLabel` picks the group's name by `PRIORITY`, and `canvas` comes before `project`. A project's delete would likewise be named "Delete canvas". | `change-label.ts` (`PRIORITY`: `"canvas"` before `"project"`); `createProject` (`project.ts`, no `label`) | Explicit labels on the write set, as `setCanvasNames` does: `createProject` → "Create project"; `deleteProject` → "Delete project {project}"; pins → "Pin label {label}" / "Unpin label {label}" (the pin's events hold only ids, so the command names it). `changeLabel` stays as it is. |
| F5 | **Item 12's refusal exists, and order does not matter.** `revertChangeGroup` builds the whole state after the revert in memory and checks it once (`consistent`): every touched live row needs live parents (`PARENTS`), and a row that stops being live needs no live children. A refusal returns before any write set exists, and the adapter applies a write set all or nothing (`applyToFile`: any error before `writeDb`). `PARENTS` already has `project_canvas` → `project` and `canvas`, `project_pinned_label` → `project` and `label`, and `canvas_item`, `frame`, `note` → `canvas`. | `undo.ts` (`PARENTS`, `consistent`, `revertChangeGroup`); `store.ts` (`applyToFile`) | No new mechanism. The step-2 tests cover it: undo refused after a pinned label is deleted, or after a shared canvas is deleted. |
| F6 | **The undo of a delete is refused in more cases than the PRD names (Q5).** A card comes back only with its entity, source table or requirement. A frame comes back only with its concept or source system. Deleting an entity, table or requirement soft-deletes only live cards, so the deleted canvases' cards keep pointing at it. So deleting, after the project, **any element that was on one of its own canvases** makes the undo refuse. The canvas delete's undo has worked like this since slice 2a. When an undo is refused as "changed afterwards", the step leaves the history ("Ctrl+Z again goes further back", `dropNextUndo`). | `PARENTS.canvas_item`, `PARENTS.frame`; `undoAction` → `drop()` | Accept as the rule: all or nothing (AD-13). The D-65 text and the known limitation say so: "an undo is refused when anything it would bring back depends on something deleted since". Test one case (an entity deleted after the project). |
| F7 | **The last project can disappear through undo, not only through concurrent deletes.** Say A (the seed's) and B (created by Kasia) are the workspace's projects. Łukasz deletes A. Kasia then undoes "Create project B", and the workspace has no project. `consistent` checks "a project keeps a canvas" and "a canvas keeps a project", but not "a workspace keeps a project". A redo of a delete can do the same. | `consistent` (`undo.ts`) | Add to `consistent`: a project that stops being live must leave a live project in the workspace. The refusal is the existing "changed afterwards" message, as for D-28's two rules there. Unit test. |
| F8 | **Item 13 costs as little as the last-owner check (Q10).** `workspaceWithoutOwner` filters `workspace_member` for the workspaces the write touches, inside the serialised write. The same shape for projects means: only when a write takes a project from live to deleted, filter `db.project` for that workspace (a handful of rows). A single pass, no index. It also covers F7 under concurrency, because undo writes through the same `apply`. | `applyToFile`, `workspaceWithoutOwner` (`src/data/local/store.ts`) | Build it in the local adapter (`workspaceWithoutProject`), with the same message as the domain ("A workspace needs at least one project."). Test it with two concurrent deletes. Known limitation: a database-slice note next to "the last owner". |
| F9 | **A shared canvas can end in no project (a race the PRD does not list).** Say S is in P1 and P2. Person A deletes P1 (S stays in P2), while person B takes S out of P2 (allowed, because S is still in P1). S is then in no project and not deleted. This is the same race as "'At least one canvas' can race", reached through the project's delete. | `removeCanvasFromProject` (`canvas.ts`); known limitation "'At least one canvas' can race" | Add a sentence to that known limitation: deleting a project is one more way in. No adapter check: not asked, development only. **Q-B** if you want it checked too. |
| F10 | **Q4: `deleteCanvas` cannot be called per canvas.** It refuses a project's last canvas (every canvas of a project being deleted is, in the end). It checks the permission and each canvas's version from the browser, and builds its own write set. What it deletes is right: cards (requirement cards included), frames and notes are soft-deleted, the canvas too, and the link is removed. A live canvas keeps its `live_label_id` while deleted, and `openLiveCanvas` looks only at live canvases, so the next "Open live" makes a new one (D-10). | `deleteCanvas` (`canvas.ts`); `openLiveCanvas` (`live.ts`, `existing = …isLive…`) | Extract the soft-delete part into one helper, `canvasDeletionWrites(ctx, canvas, items, frames, notes)`, used by `deleteCanvas` and `deleteProject` ("through the same code", item 11). `deleteProject` checks the **project's** version only. Its canvases and their contents are read as they stand, like a held row in `saveRows`; the adapter refuses any row changed between read and write. |
| F11 | **Undo of a delete and a label's live canvas.** (a) After the delete, the label's "Open live" makes a new live canvas. Undoing the delete would then bring back a second live canvas for the label. The local adapter's unique index (`canvas_live_label_uq`) refuses it as a conflict, so `undoAction` drops the step with the refusal toast. Correct, but only because of the adapter. (b) After the delete, the label itself is deleted. Its delete clears `live_label_id` on live canvases only, so the undo brings back a canvas that points at a deleted label. The page treats it as a normal canvas. Nothing breaks, but the row is wrong. | `schema.ts` (`canvas` unique `live_label_id`, live rows); `deleteLabel` (`label.ts`: `live = …isLive…`); `PARENTS` has no `canvas` entry | Add `canvas: [["live_label_id", "label"]]` to `PARENTS`: an undo then refuses (b) as for every other lost parent. Leave (a) to the unique index, which the database slice has too (data model). Unit tests for both. |
| F12 | **Who may undo a delete (P11).** `actionFor` maps every `project` event to `project.create`. A delete's undo also needs `canvas.delete`, `canvas.edit_items`, `note.edit`, `canvas.edit_projects` and `label.edit` (pins): all editors have these. If you choose owners and admins only, a modeler could still undo or redo a delete they made before losing the right. | `actionFor` (`undo.ts`) | `actionFor("project")`: create → `project.create`; a change of `deleted_at` (delete, restore) → `project.delete`; any other update → `project.edit` (slice 9 left this as `project.create`, the same roles). |
| F13 | **The undo buttons and keys depend on the canvas's context, not on the canvas (Q1).** `UndoProvider` reads `CanvasUiCtx` for `settled()` (cards on their way) and `registerUndo` (the canvas's toasts). That context has defaults outside a canvas (`settled` resolves at once, `registerUndo` and `undo()` do nothing). So the provider works on a home page as it is. What does not work: `useAction`'s `undoable` toasts take Undo from `ui.undo()`, which is `null` without a canvas. So the delete's toast would have no Undo. | `undo.tsx`; `use-action.ts` (`ui.undo()`); `src/canvas/context.ts` (defaults) | The home pages wrap their content in `UndoProvider` (no `canvasId`) and show `UndoButtons` in the top bar. `AppShell` and `TopBar` get a `tools` slot on the workspace home too: only the two buttons, no other tool. `useAction` falls back to `useUndo()` when the canvas gives no undo. The keys come with the provider (F14). |
| F14 | **Keys (item 2, Q1):** Ctrl+Z, Ctrl+Shift+Z and **Ctrl+Y**, also with ⌘ (`metaKey`), never with Alt. Ignored in `INPUT`, `TEXTAREA`, `SELECT` and contenteditable elements: the project's name and description, the settings form and the People tab's fields and selects. Installed on `window` by `UndoProvider`. | `undo.tsx` (`isTyping`, `onKey`) | Item 2 holds as written, Ctrl+Y included. |
| F15 | **The home pages need the undo state from the server.** The canvas page reads `store.undoHistory.get` for `canUndo` and `canRedo`. The home pages do not read it. After an undo, `undoAction` calls `revalidatePath("/", "layout")`, so the home is drawn again: tiles, stats, "Also in", pins, the name and description (keyed by their stored value), model consistency. The versions undo wrote reach `rowSaves.answer` (item 4). | canvas page (`undoState`); `undoAction`; `UndoProvider.run` (`rowSaves.exclusive`, `rowSaves.answer`) | Both home loaders read the history (one in-memory read) and pass it to `UndoProvider`. Item 4 then comes for free. |
| F16 | **The toast after an undo on a home names the canvas.** `doneStepMessage(mode, label, otherCanvas)` adds "on {canvas}" when the step's canvas is not the open one. A home has no open canvas, so every canvas step reads e.g. "Undone: Move card on Customer & orders". | `doneStepMessage` (`undo-history.ts`); `undoAction` (`canvas` in the outcome) | Keep it: it says where the step happened. S12A-01 expects "Undone: Move card on {canvas}". Listed with the texts below. |
| F17 | **Q2: the workspace home's writes.** Undo steps: only "Create project" (the tile). Not undo steps: settings (name, client, description, documentation language, Data Vault 2.0 mode, four-eyes), archive and unarchive (all on the `workspace` row, outside `UNDOABLE_TABLES`), people and the organization's password (D-58). Concept colours and classifications are not on the workspace home (the canvas pages' panels and dialog). After archiving, the buttons may stay enabled: Undo answers with the archive message (code `archived`), and the step stays. This is the same as on a canvas page. | `UNDOABLE_TABLES`, `isUndoable`; `checkPermission` (archived); `undoAction` (only `conflict` drops a step); `settings-form.tsx`, `lifecycle.tsx`, `people.tsx` | No change. Item 6 and S12A-04 hold. |
| F18 | **Pins (item 7, Q3).** `setLabelPinned` (label.edit: owners, admins, modelers) writes one `project_pinned_label` insert or remove. `isUndoable` excludes a group made only of those rows. The two unit tests that say so change: `label.test.ts` "…but not an undo step" and `undo.test.ts` "does not undo pinning a label to a project". **No e2e spec asserts it** (S3A-05 only pins and unpins). Comments to update: `label.ts` (file header, `setLabelPinned`), `undo.ts` (header, `isUndoable`), `_actions/label.ts`. A label's delete keeps bringing its pins back (`undo.test.ts` "deleting a label and undoing it brings back … its project pins"). An undo of a pin whose label was deleted since is refused (a removed link must still be absent; `PARENTS` for a pin coming back). | `isUndoable`, `setLabelPinned`, `deleteLabel` | As item 7, with F4's names. D-58's text also says "like a pin (D-29) they are not undo steps" and must change with D-29 (section 10 misses it). |
| F19 | **Q8: `ConfirmDelete` fits, almost.** It arms on the first click and disarms after 4 s or on blur. It is a plain component in `src/app/_panels/fields.tsx`, which the project home may import. Its armed text is `armedDeleteText()`: "Click again to delete" (with ", with …" or "; …"), not the prototype's "Click again to delete the project". It has no disabled state. The app's pattern for an editor's control that a person may not use, or in an archived workspace, is **to leave it out or show it read-only**: the project's name as text, the plain ★, no "New project" tile, no canvas menu items. | `ConfirmDelete`, `armedDeleteText` (`fields.tsx`); `ProjectHeading` (`editable`), `ProjectLabels` (`editable`), `NewProjectTile` (`can(…, "project.create")`) | **Hidden** for reviewers, readers and in an archived workspace (S12A-11: no section). Use `ConfirmDelete` with one new optional prop for the armed text ("Click again to delete the project", the prototype's), and a plain disabled button for the only project. **Q-C** on the armed text. |
| F20 | **Q9: the rights.** `project.create`, `project.edit`, `canvas.create`, `canvas.rename`, `canvas.delete` (deleting a canvas no other project uses) and `canvas.edit_projects` (taking a shared canvas out of a project, adding one) all go to owners, admins and modelers (`EDITORS`). | `ROLE_PERMISSIONS` (`permissions.ts`) | P11 as proposed: `project.delete: EDITORS`, refusal text "As a {role} you cannot delete projects." (`ACTION_TEXT`). |
| F21 | **Q7: the toast survives the move.** `ToastProvider` sits in the root layout (`src/app/layout.tsx`), so a toast shown after the action survives the soft navigation to the workspace home. Its Undo calls the project home's `UndoProvider.run` from a closure. The provider may be unmounted by then, but `undoAction` and the toast do not depend on it. The `revalidatePath` in `undoAction` draws the workspace home again with its tile back. One caveat, the same as on canvases today: the toast's Undo undoes the newest step, whatever it is. Ctrl+Z pressed on the workspace home within the same 5 s would undo one more step (two providers, two queues, both behind `rowSaves.exclusive`). | `toast.tsx`, `layout.tsx`; `undo.tsx` (`queue` per provider) | Show the toast in the delete's client handler after the action returns (the action's answer carries the redirect, F2). Make the undo queue module-level in `undo.tsx`, so every provider and every toast Undo share one queue. A small change, in step 3. |
| F22 | **Item 9's preview needs no read (P4).** `loadProjectView` already gives each canvas its `projectIds` (live links), and the shell has `projects.length`. "Deleted with it" lists the canvases whose only project is this one; "Staying in other projects" lists the others. Rendered on the server as text, with no layout read (CLAUDE.md, "Nothing above the canvas reads layout"; the project home has no canvas anyway). | `ProjectView.canvases[].projectIds` (`project-view.ts`); `ShellData.projects` | As item 9. The toast's count comes from the server's result (`deleted` canvases), not from the preview, in case someone shared a canvas meanwhile. |
| F23 | **The save chain.** The delete is a write on the project row, which the name and description fields save through `saveRow`. Sent through `saveRow(project, (v) => deleteProjectAction(…, v), { deletes: true })`, it waits for a rename still on its way, and a success cuts the saves queued behind it without a toast (slice 10a). | `useAction.saveRow` (`deletes`), `rowSaves` | As described. |
| F24 | **Q11: the browser's leftovers do no harm.** The last project per workspace (cookie `infomapper_last_projects`): `loadShell` falls back to the first project, and `proxy.ts` may still write a deleted id on a redirected visit, which is harmless. The last canvas per project (`infomapper:last-canvas:<project>`, localStorage): read only on that project's home, which can no longer open. A canvas's view (`infomapper:view:<canvas>`): read only when that canvas opens, and kept for an undo. History places (`sessionStorage`): a traversal to a deleted project's page goes through `loadShell` (F1). The panels' cookie is per person, not per project. The project switcher and "Add a canvas from another project" come from the server (live projects and canvases only). The next-canvas cookie lives one minute. | `preferences.ts`, `proxy.ts`, `last-canvas.tsx`, `src/canvas/views.ts`, `src/ui/history-places.ts`, `project-view.ts` (`outside`) | No clean-up needed. The orphan keys stay, as they do after a canvas's delete today. |
| F25 | **P12 confirmed: no data model change and no new file format (Q5).** `project` has the standard columns (`deleted_at`, `version`). `project_canvas` and `project_pinned_label` are link rows, removed with a before image. Undo already restores link rows by inserting them (`revertChangeGroup`, the link branch). F11's `PARENTS` entry is domain code. F8's check reads existing rows. No format upgrade, so no KB backup step before the closing's usual backup (A2, A3). | data model sections 9, 10; `schema.ts`; `undo.ts` | As P12. |
| F26 | **A text in the app already promises this slice.** Deleting a project's last canvas is refused with "A project keeps at least one canvas. Delete the project from its home screen instead.", which becomes true now. | `LAST_CANVAS_MESSAGE` (`canvas.ts`) | Keep it. |
| F27 | **Undo after a restart.** The undo history lives in the server's memory, so after a restart a deleted project cannot be brought back from the app. Its rows stay soft-deleted in the file. The PRD's section 9 leaves a restore list for later. | known limitation "The undo history lives in server memory" | One sentence in that known limitation (a project's delete is the largest step it can lose). |
| F28 | **Item 17: someone else's open page.** A write of theirs on a deleted canvas is refused as not found, and their page stays as it is. A write on a shared canvas succeeds, and its `revalidatePath` draws their page again: `loadShell` then sends them to the workspace home with "That project no longer exists." (F1, no F2 cookie for them). Back after the delete: a server action's redirect pushes an entry, so the project home's entry stays in the tab's history, and Back to it ends on the workspace home with the toast (S12A-12). | `shell.ts`; Next.js `redirect` in server actions (push) | As item 17. Step 4 verifies the Back case in the browser. |
| F29 | **The live step.** A write that touches `canvas` rows loads the whole live state and syncs every live canvas in the same group (`touchesLiveCanvases`). The delete pays this once, as a canvas's delete does today. An undo that brings back a live canvas also catches it up with its label in the same step. | `withLiveCanvases`, `completeLiveWrites` (`live.ts`) | No change. Mentioned so that a restored live canvas that shows one card more or less is understood. |

## Answers to Q1–Q12

- **Q1 (undo on canvas pages):**
  - The buttons are `UndoButtons` (`src/app/_components/undo.tsx`), placed in the canvas's `tools` (`CanvasTools` in the canvas page) inside `TopBar`.
  - Their state comes from `UndoProvider`: the server's `undoState` with every fresh page, and the local state after an undo or a saved card change.
  - The keys and `rowSaves.exclusive`: F13, F14.
  - The refresh: `revalidatePath("/", "layout")` in `undoAction` (F15).
  - The smallest change: F13. A `tools` slot for the workspace home, `UndoProvider` around both homes, `UndoButtons` as their only tool, the history read in both loaders, and the `useAction` fallback.
- **Q2:** F17.
- **Q3:** F18. The names come from the command (F4), because the pin's events hold only ids.
- **Q4:** F10.
- **Q5:** F5, F6, F7, F11, F25. The order of restoring does not matter: the check runs on the whole state after the revert. A refused undo writes nothing and leaves the history. F12 covers the rights.
- **Q6:** F1, F2, F3. A canvas page whose canvas is not in its address's project opens the project's first canvas with "This canvas is no longer in {project}. Opened {canvas}." (`?moved=1`), or silently after your own action (`next-canvas.ts`). A canvas under a deleted project's address never gets there: the project check comes first.
- **Q7:** F21.
- **Q8:** F19.
- **Q9:** F20.
- **Q10:** F8.
- **Q11:** F24.
- **Q12:** below.

## Earlier tests and docs that change (Q12)

- **Unit tests:** `label.test.ts` ("pins … not an undo step") and `undo.test.ts` ("does not undo pinning a label to a project") are turned around. Any test that reads the label of "Create project" (F4) changes: the only one found is `store.test.ts`, which writes the label itself and is unaffected.
- **e2e:**
  - `S9-09.spec.ts`: its comment ("the home pages have no undo") changes, and the test still passes.
  - `S6B-06.spec.ts`: unchanged; S12A-12 adds the deleted-project case.
  - No spec asserts that the home pages have no undo buttons.
  - Specs that undo "Create project" from a canvas and read its toast: none found.
  - Earlier specs to run in steps 3 and 4: the PRD's list (slice 1b's undo and redo, S1B-13, S9-09, S11-05, S11-11), plus S3A-05 (pins), S6B-06 (a gone project), S9-06 to S9-11 (the project home's name and description), and the slice 0 and 2a specs of the project home, the workspace home and the switcher (step 4 names the files).
- **Docs:** as section 10, plus:
  - D-58's "like a pin (D-29) they are not undo steps" (F18);
  - the headers of `undo.ts` and `label.ts`;
  - the known limitations "The last owner …" (F8, a database-slice note for the last project), "'At least one canvas' can race" (F9) and "The undo history lives in server memory" (F27).

## Differences between the prototype and the app that the slice touches

| Where | Prototype | App after slice 12a | Why |
| --- | --- | --- | --- |
| Top bar on the home pages | The whole canvas top bar stays (tools, Undo, Redo); only the tabs hide on the workspace home (`body.wsmode #dtabs`) | Only Undo and Redo | Item 1; the other tools act on a canvas |
| Undo toast | "Undone" / "Redone" | "Undone: {step}" (+ " on {canvas}", F16) | Since slice 1b |
| Undo on a home | One snapshot stack per browser, 150 steps | The person's history in the workspace, 50 steps, shared with the canvases | P1, slice 1b |
| The delete section | Always drawn, for everyone; a refused change shows its message | Hidden for reviewers, readers and in an archived workspace | F19, the app's pattern |
| Armed button | "Click again to delete the project"; disarms only when the page is drawn again | The same text (Q-C); disarms after 4 s or on blur (`ConfirmDelete`) | The app's armed deletes |
| Preview text | General sentence only | The general sentence plus "Deleted with it: …" and "Staying in other projects: …" | P4 |
| After the delete | Another project's home | The workspace home | P7, D-38 |
| Toast count | "{n} canvas"/"canvases" | The same wording, singular for one | Prototype |
| Last project | `S.projects.length < 2` disables the button | The same, plus the server's refusal and the adapter's check | P6, F7, F8 |
| Pin | An undo step (`mutate`) | An undo step, named "Pin label {label}" | P2 |
| Pages of a deleted project | No addresses, no other people | The workspace home with "That project no longer exists." (F1) | D-38 |

## New user-facing texts (for approval)

| Where | Text |
| --- | --- |
| Project home, button | "Delete this project" (prototype) |
| Armed (Q-C) | "Click again to delete the project" (prototype) |
| Under the button, only project | "This is the only project." (prototype) |
| Under the button, otherwise | "The model is untouched. Canvases shared with other projects stay there; canvases only in this project are deleted with it." (prototype) |
| … then, what applies | "Deleted with it: {canvas}, {canvas}." · "Staying in other projects: {canvas}, {canvas}." |
| Toast after the delete, with Undo | "Deleted the project {project} and {n} canvases that only it used. The model is untouched." · one canvas: "… and 1 canvas that only it used. …" · none: "Deleted the project {project}. The model is untouched." |
| Server refusal (domain and local adapter) | "A workspace needs at least one project." |
| Refusal by role | "As a reviewer you cannot delete projects." / "As a reader you cannot delete projects." |
| Undo step names | "Delete project {project}" · "Pin label {label}" · "Unpin label {label}" · "Create project" (F4, replaces "Create canvas") |
| Undo toast on a home | "Undone: {step}" / "Redone: {step}"; a canvas step adds " on {canvas}" (F16) |
| Existing, reused | "That project no longer exists." (F1) · "This can't be undone because it was changed afterwards." and "Couldn't undo “{step}” because it was changed afterwards. Ctrl+Z again goes further back." (F5–F7) |

## Questions for Łukasz

- **Q-A (F3).** After an undo or redo of yours that removes the page's project, should the workspace home show only "Undone: {step}" (the canvas precedent, my proposal), or also "That project no longer exists." (the PRD; one would replace the other)?
- **Q-B (F9).** The shared canvas left in no project by a race: a sentence in the known limitation (my proposal), or a check in the local adapter as well?
- **Q-C (F19).** The armed text: the prototype's "Click again to delete the project" (my proposal, one optional prop on `ConfirmDelete`), or the app's usual "Click again to delete"?
- **Q-D (P11, F12, F20).** Who deletes a project: owners, admins and modelers (my proposal, as for a canvas), or owners and admins only?
- **Q-E (F7, F8, F11).** Agree to the three undo additions: "a workspace keeps a project" in `consistent`, the same count inside the local adapter's write, and `canvas.live_label_id` in `PARENTS`?
- **Q-F (F4).** Agree to explicit undo names, which also renames the existing "Create canvas" of a new project to "Create project"?
- **Q-G (manual acceptance, A3).** Scenario point 4 creates and deletes a test project in KB. Its soft-deleted rows and change events stay in your file afterwards. Is that fine, after the backup?

## Łukasz's answers to step 1 (31 October 2026)

- **Q-A:** only "Undone: Create project", as on canvases.
- **Q-B:** a sentence in the known limitation "'At least one canvas' can race"; the database slice fixes both. No check
  in the local adapter.
- **Q-C:** "Click again to delete the project", as in the prototype.
- **Q-D:** owners, admins and modelers (`project.delete` with the editors). D-65 gets a sentence that only the person
  who deleted a project can undo it (the undo history is personal).
- **Q-E:** yes to F7, F8 and F11.
- **Q-F:** yes to explicit step names, "Create project" instead of today's "Create canvas" included. The tests that
  change are listed with their reason.
- **Q-G:** yes, after the KB backup.
- **F1:** item 16 exists; it stays as a regression test (S12A-12) with "That project no longer exists.".
- **F2:** the short-lived cookie is agreed; the redirect stays in `loadShell` only.
- **F6:** agreed; the wider refusals go into the known limitations and a sentence into D-65.
- **F10:** the shared soft-delete part of a canvas is agreed; `deleteCanvas` behaves as before.
- **F13:** Undo in the toast on the home pages is in the slice (item 14).
- **Texts:** the table above is accepted, with the changes these answers bring (S12A-01's "… on {canvas}", S12A-05's
  single toast).

The PRD is updated to these answers (status "step 1 answered").

## Step 2: the domain (31 October 2026)

**What changed**

- **`project.delete`** (`permissions.ts`): owners, admins and modelers; refusal "As a {role} you cannot delete
  projects.".
- **`deleteProject`** (`src/domain/commands/project.ts`), item 11:
  - one change group named "Delete project {project}" (`deleteProjectLabel`);
  - checks `project.delete`, the archive and the project's version;
  - refuses the last live project with `LAST_PROJECT_MESSAGE` ("A workspace needs at least one project.");
  - soft-deletes every canvas only this project links, through `canvasDeletionWrites`;
  - removes the project's canvas links and pins, then soft-deletes the project;
  - returns `deletedCanvasIds` and `keptCanvasIds` for item 14's toast.
- **`canvasDeletionWrites`** (`canvas.ts`, F10) is the soft-delete part of `deleteCanvas`: notes, cards, frames, the
  canvas. `deleteCanvas` uses it and writes what it wrote before, in the same order (its tests are unchanged and pass).
- **Step names** (F4): `createProject` names its group "Create project" (`CREATE_PROJECT_LABEL`), and `setLabelPinned`
  names its groups "Pin label {label}" / "Unpin label {label}" (`pinLabelLabel`). `changeLabel` is unchanged.
- **Undo** (`undo.ts`):
  - pins are undo steps: the `project_pinned_label` exception in `isUndoable` is gone (item 7);
  - `PARENTS` has `canvas.live_label_id` → `label` (F11);
  - `actionFor("project")`: create → `project.create`, delete and restore → `project.delete`, other updates →
    `project.edit` (F12);
  - `consistent` refuses a revert that leaves the workspace without a live project (F7).
- **Local adapter** (`store.ts`, F8): `workspaceWithoutProject` counts the live projects again inside the serialised
  write, only for workspaces whose projects the write deletes, and refuses with `LAST_PROJECT_MESSAGE`.
- Comments updated in `label.ts`, `undo.ts` and `_actions/label.ts`. No server action, page or text on screen yet:
  the delete's action, the section and the home pages' undo come in steps 3 and 4.

**Unit tests (new)**

- `project.test.ts`, "deleteProject (slice 12a, D-65)":
  - the change group with shared and unshared canvases, a card, a requirement card, a frame, a note, a live canvas
    (keeps its `live_label_id`) and pins of two projects, in order and in one group;
  - only shared canvases;
  - the last project;
  - the roles (owner, admin and modeler may; reviewer and reader refused with their text) and the archive;
  - a stale version, a deleted or unknown project and bad input.
  - `createProject` is named "Create project", while `changeLabel` alone would still say "Create canvas".
- `undo.test.ts`, "a project's delete (slice 12a, D-65)":
  - undo brings back exactly the state before, and redo the state after;
  - the undo is refused as a whole after a pinned label, the shared canvas or an entity on its canvas was deleted;
  - no canvas comes back for a deleted live label;
  - a reviewer, an archived workspace and another person are refused;
  - no revert leaves the workspace without a project: neither an undo of "Create project" nor a redo of a delete.
  - Pins: pin and unpin are undone and redone with their names, and an unpin is not undone once its label is
    deleted. The existing test that a label's delete brings its pins back on undo still passes.
- `store.test.ts`, "the last project under concurrent writes": two deletes of Retail Co – DWH's two projects from
  the same read, one refused with `LAST_PROJECT_MESSAGE`, one project left.

**Earlier tests changed, with the reason**

| Test | Change | Why |
| --- | --- | --- |
| `undo.test.ts` "does not undo pinning a label to a project" | Replaced by "undoes and redoes pinning and unpinning a label…" | P2, item 7: pins are undo steps now (D-29 changes) |
| `label.test.ts` "pins a label … but not an undo step" | `isUndoable` expects `true`; the step names are checked | Same |
| `permissions.test.ts`, the roles' matrix | `project.delete` added for admins and modelers (owners get every action) | P11, Q-D |

**Runs**

- `npm run lint` and `npm run typecheck`: pass.
- `npm test`: 116 files, 1,525 tests pass (20 s).
- e2e of what step 2 touched: S3A-05 (pins), S9-09 (undo of the project's name from a canvas), S6B-06 (a gone
  project and canvas), S1B-12 to S1B-14 (undo), S2A-09 (a canvas's delete). 9 tests pass, 2.4 min, no dev server of
  mine running.
- **Seen in that run's server log:** during S6B-06's "Back onto a deleted canvas", the canvas page logged
  `TypeError: Cannot read properties of undefined (reading 'live_label_id')` (`page.tsx:127`). The test passes, and
  step 2 changes neither that page nor what a canvas's delete writes. I have not checked whether `main` logs it too;
  step 4 touches the pages of deleted projects and will look at it.

**How to check:** `npx vitest run src/domain/commands/project.test.ts src/domain/commands/undo.test.ts
src/domain/commands/label.test.ts src/data/local/store.test.ts`. Nothing changes on screen yet, except that a pin on
the project home is now an undo step, undone from a canvas ("Undone: Pin label …").

## Before step 3 (Łukasz's three points, 31 October 2026)

1. **The canvas page's `live_label_id` on undefined (`page.tsx:127`) is an old race, found in this slice: fixed in
   step 4.**
   - **Where I ran it:** `main` at `de2af7f`, in a separate worktree (`../infomapper-check-main`, `npm ci`, no code
     changed), and this branch.
   - **On `main`:** S6B-06 alone twice (`--repeat-each=2`) and the same seven-spec set as step 2's run once; the error
     did not appear.
   - **On this branch:** S6B-06 alone twice, and the seven-spec set twice more; the error did not appear. So it
     appeared once in 3 runs of the set on the branch, and never in the 3 runs on `main`.
   - **Why it is old:** the branch changes nothing on that path. `loadShell`, the canvas page and the local adapter's
     reads are as on `main`, and `deleteCanvas` writes the same rows in the same order. `loadShell` reads the canvas
     and its link from one state of the file. The page then reads `store.canvases.list` again and takes
     `canvases.find(…)!`. When a canvas's delete lands between the two reads (here: S6B-06 deletes "Order lines &
     products" while that tab's page may be prefetched or drawn again), the second read has no such canvas, and the
     render throws. It is a timing race that one run in a few hits, on either branch.
   - **Fix in step 4** (it touches the pages of deleted projects anyway): the page takes the canvas from the same read
     as `loadShell`, or treats a canvas missing from its own read as gone (the `?moved=1` path), and never uses `!` on
     it. With a unit or e2e test that deletes the canvas between the two reads.
2. **The working context and a project's delete.** A new test, `live.test.ts` "labels nothing when a project is
   deleted…", confirms D-26's rule that deletions are not labeled: with the context on, the delete writes no label
   link and nothing of the model or the labels (`labeled` 0). **But `context_label_id` is not empty on the group's
   events:** the context is recorded on **every** change event of an editor's group, deletions included. D-26 asks for
   that ("records it on every change event of the group"), and so does AD-13. A canvas's delete has done the same
   since slice 3b (the existing test "links the label … with the label on every event"). The new test asserts this
   as it is. Changing it, so that a group which labels nothing records no context, would change D-26 and every
   delete, not only the project's. **Question to Łukasz (Q-H):** keep D-26 as it is (my proposal), or change it in a
   later slice?

   **Łukasz's answer to Q-H (31 October 2026):** D-26 stays as it is. His remark was wrong: D-26 forbids labeling
   deleted elements (no `label_link`), while recording `context_label_id` on every change event of the group is
   required, deletions included. The test in `live.test.ts` checks the right behaviour.
3. **D-58:** "like a pin (D-29) they are not undo steps" becomes "they are not undo steps". It goes into
   `docs/decisions.md` in this PR's closing, together with D-29, D-59, D-65, D-28's addition and AD-05's note (PRD
   section 10, as updated after step 1).

## Step 3: undo on the home pages (31 October 2026)

**What changed**

- **Both homes** wrap their page in `UndoProvider` and show `UndoButtons` as the top bar's only tool (item 1). The
  project home passes them in its frame's `tools`; `AppShell` got a `tools` slot for workspace pages (the workspace
  home). Both loaders read the person's history for `canUndo` and `canRedo` (F15). The buttons' enabled state comes
  from that data, never from a measured size.
- **`UndoProvider`** (`src/app/_components/undo.tsx`) works without a canvas: `projectId` and `canvasId` are optional,
  and `undoAction` gets no `open` canvas on a home. The keys are the canvas pages' (Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y, also
  with ⌘), outside text fields (item 2). A step made on a canvas reads "Undone: {step} on {canvas}" (F16). The undo
  queue is now one for the tab, shared by every provider and every toast's "Undo" (F21).
- **Toasts with "Undo" on the home pages** (F13, item 14): `useAction` takes Undo from the canvas as before, else from
  the page's provider through a separate context, `useUndoNow`. That context holds only a stable function, so
  components that use `useAction` on canvas pages do not re-render when the undo state changes. Step 4's delete toast
  uses this.
- **An undo or redo that removes the page's project** (item 5, Q-A, F2): `undoAction` remembers every project its
  revert deleted (`rememberGoneProject`, `src/app/_lib/gone-project.ts`, a one-minute cookie, the twin of
  `next-canvas.ts`). `loadShell`, the one place that sends a missing project's pages to the workspace home, does so
  without `?gone=project` when the page is drawn again as that action's result. So the workspace home shows only
  "Undone: Create project". Every other arrival keeps "That project no longer exists." (F1, S6B-06).
- After an undo or redo the home is drawn again by `undoAction`'s `revalidatePath`. Its versions reach `rowSaves`, as
  on canvases (item 4).

**Specs (`e2e/slice-12a/`, new helpers in `helpers.ts`: `undoButton`, `redoButton`, `key`, `moveCardUp`, `yOf`,
`OM_HOME`)**

| ID | What it does |
| --- | --- |
| S12A-01 | Both buttons disabled on both homes with nothing to undo, and the bar has only them. A card moved on "Customer & orders" is undone and redone from the project home ("Undone: Move card on Customer & orders"), undone again from the workspace home; the canvas shows the card back in place |
| S12A-02 | A rename undone on the home: the field, the breadcrumbs and the switcher show "Customer 360"; the next rename is stored, no conflict toast |
| S12A-03 | In the description, Ctrl+Z undoes the typing and the rename stays undoable; outside a field Ctrl+Z, Ctrl+Shift+Z and Ctrl+Y undo and redo the rename |
| S12A-04 | Anna renames the project after Łukasz: his undo on the home is refused with "Couldn't undo “Rename project” because it was changed afterwards. …", nothing written; in an archived workspace Undo and Redo answer "This workspace is archived, so it is read-only." |
| S12A-05 | "Create project" undone on the new project's home: the workspace home with only "Undone: Create project" (the recorded toasts have no "That project no longer exists."), the project gone; Redo brings it and its tile back |
| S12A-06 | Pin and unpin of CR-23 on the home are undone and redone ("Undone: Pin label CR-23", "Undone: Unpin label CR-23"); Piotr (reviewer) sees the plain ★ with no control; CR-23's delete from its label panel, undone from the home, brings the pin back |

**Notes from the runs**

- S12A-03 failed twice while I wrote it; both were the test, not the app:
  - Chrome undoes typing in the description one letter at a time. The test now presses Ctrl+Z in the field until the
    text is back, and checks that the field still has the focus and the history is untouched.
  - A Ctrl+Y pressed before the previous undo's answer was back does nothing, because the page does not know yet that
    there is something to redo. This is the same on canvases, where S1B-12 waits for the toast; the test now waits too.

  Afterwards it passed three runs in a row.

**Runs**

- `npm run lint`, `npm run typecheck`: pass. `npm test`: 116 files, 1,526 tests pass.
- e2e, with no dev server of mine running: 75 tests pass in 12.4 min. The set:
  - slice 12a's six specs;
  - all of slice 0 (the homes, the switcher, creating projects);
  - S1B-12 to S1B-14 (undo and redo, the Undo toasts);
  - S3A-05 and S3A-13 (pins, roles on the project home);
  - all of slice 6b (Back and Forward, gone places);
  - all of slice 9 (the project home's fields, S9-09's undo from a canvas);
  - S11-05 and S11-11 (undo of the names).

  The `live_label_id` error from "Before step 3" did not appear in this run.
- No earlier test changed in step 3.

**How to check:** `npx playwright test e2e/slice-12a`. By hand: move a card on a canvas, open the project home or the
workspace home, and press Undo, Redo or Ctrl+Z there. Or create a project and press Undo on its home: you land on the
workspace home with "Undone: Create project".

## Step 4: deleting a project (31 October 2026)

**What changed**

- **The section** (`project-delete.tsx`, items 8–10): at the end of the project home, after "Open notes", for people
  with `project.delete` in a workspace that is not archived (`ProjectView.canDeleteProject`).
  - The button is `ConfirmDelete`, with one new optional prop for the armed text, "Click again to delete the project".
    It disarms after 4 s or on blur.
  - For the only project it is a disabled button, and the text reads "This is the only project.".
  - Otherwise the text is the prototype's sentence, then "Deleted with it: …" and "Staying in other projects: …". The
    page computes them from the projects each canvas is in (P4), with no extra read.
- **`deleteProjectAction`** (`_actions/workspace.ts`) reads what `deleteProject` needs, runs it through `runCommand`,
  and remembers the project (`rememberGoneProject`, F2).
  - The browser sends it on the project row's save chain (`saveRow`, `deletes: true`, F23).
  - The page, drawn again, goes to the workspace home without "That project no longer exists."
  - The toast "Deleted the project {project} and {n} canvas(es) that only it used. The model is untouched." offers
    Undo (item 14), from the page's undo (step 3). The count comes from the server's answer.
- **The toast after undoing a delete** said "Undone: Delete project Order management on Order lines & products",
  because the group's cards are all on one canvas (`changeCanvasId`). A group that writes a project is no longer "on"
  a canvas (`change-label.ts`, with a unit test). The toast now reads "Undone: Delete project Order management".
- **The race from step 2** (`page.tsx:127`, fixed as Łukasz asked):
  - one rule, `missingCanvasWay` (`src/app/_lib/missing-canvas.ts`, pure), decides where a canvas page whose canvas
    is not there goes, by D-38;
  - `leaveMissingCanvas` (`shell.ts`) reads the project and its links as they are now and redirects by it;
  - `loadShell` uses it for a gone project and for a canvas no longer in its project (its own earlier branches, now
    in one place);
  - the canvas page uses it when its own `canvases.list` no longer has the canvas that `loadShell` saw, instead of
    `find(…)!`.

  So a delete landing between the two reads takes the same way as an arrival at a deleted canvas: the project's first
  other canvas with "This canvas is no longer in …", or the workspace home with "That project no longer exists.". The
  race cannot be driven from an e2e test without a switch in the app: both reads happen inside one server request,
  and a Playwright route only holds the browser's traffic. So it has a unit test of the branch,
  `missing-canvas.test.ts` (4 cases), as Łukasz allowed.

**Specs**

| ID | What it does |
| --- | --- |
| S12A-07 | Order management's preview names "Order lines & products" (deleted with it) and "Customer & orders" (staying); the section is the page's last; the first click arms ("Click again to delete the project"), and the arm goes after 4 s and on a click elsewhere |
| S12A-08 | With a frame, a note, a requirement card on its own canvas and CR-23 pinned: the second click deletes. The workspace home shows the toast, without "That project no longer exists."; the project and its own canvas with every card, frame and note are deleted; the shared canvas and its rows are exactly as before; the links and the pin are gone; the model's tables are unchanged; all in one change group |
| S12A-09 | Undo in the toast brings back the project, its canvas with the same live rows, its links and its pin, and its tile; Redo deletes it again; Ctrl+Z on the workspace home brings it back. Deleted again, then CR-23 deleted: Undo is refused with "Couldn't undo “Delete project Order management” …", and the projects, canvases, links and pins are unchanged |
| S12A-10 | Customer 360 deleted through the domain: Order management's button is disabled with "This is the only project."; a direct call of the action is refused with "A workspace needs at least one project." |
| S12A-11 | Anna (modeler) sees the section and deletes a spare project; Piotr (reviewer) and Kasia (reader) see no section and a direct call is refused ("As a reviewer / reader you cannot delete projects."); archived: no section, and the call is refused with the archive's message |
| S12A-12 | Anna has Order management's home and its own canvas open. After Łukasz's delete her card move is refused (a refusal toast, nothing written); reloading each of her pages, and opening the shared canvas under the deleted project's address, leads to the workspace home with "That project no longer exists."; Back in Łukasz's tab to the deleted project's canvas does the same |

`S12A-screens.spec.ts` (`SCREENS=step-4`): `docs/prd/slice-12a-screens/step-4/`. It has the section, armed, and the
only project, each light and dark, and the workspace home's top bar with Undo and Redo.

**What the runs found (and are not bugs of the app)**

- **F28 was wrong about Back.** The redirect of the delete's own page **replaces** the deleted home's history entry; it
  does not push one (checked: the tab's entries before and after the delete). So after your own delete, Back from the
  workspace home goes to the page before the project home, not to the deleted home. This suits D-38 better: no dead
  entry to step through. S12A-12 checks Back to the deleted project's **canvas**, which stays in the history: it leads
  to the workspace home with the toast.
- **A page restored from Chrome's back-forward cache is not checked (an old gap in D-38).** If the earlier page was
  opened by a full page load (a typed address, `page.goto` in a test), Back restores that whole document from Chrome's
  back-forward cache. No server request is made, and no code of the page runs (`history-nav.tsx`'s refresh listens to
  traversals inside one document). So Back shows the deleted project's canvas as it was. It goes away on the next
  click or reload, and any write is refused as not found. Through the app's own links (tabs, breadcrumbs, tiles) the
  pages are one document, and Back goes through `loadShell`, as S12A-12 shows. The same holds for a canvas deleted
  since slice 6b. **Proposal:** a known limitation in the closing, and an idea for later (`pageshow` with `persisted`
  → refresh). Not built: not in this PRD.
- S12A-09 compared the restored canvas links in file order; they come back complete in another order, so the test
  compares them sorted. S12A-12 reads Anna's toasts from a record of every toast (`recordToasts`), because her tabs
  may be in the background.

**Runs**

- `npm run lint`, `npm run typecheck`: pass. `npm test`: 117 files, 1,530 tests pass.
- S12A-12 three times on its own after its last change: pass.
- e2e, with no dev server of mine running: 92 tests pass in 16.1 min. The set: all of slice 0 (homes, switcher), all
  of slice 2a (a canvas's delete and removal, the "moved" notice), all of slice 6b (Back and Forward, gone places), all
  of slice 9 (the project home), S3A-05, S1B-13 (Undo toasts) and all of slice 12a (the screenshot spec skips itself
  without `SCREENS`). The `live_label_id` error did not appear.
- No earlier test changed in step 4.

**New texts on screen (as accepted after step 1):** "Delete this project", "Click again to delete the project", "This is
the only project.", the preview's sentence with "Deleted with it: …" and "Staying in other projects: …", and the
toast "Deleted the project {project} and {n} canvas(es) that only it used. The model is untouched." (or "Deleted the
project {project}. The model is untouched."). The server's "A workspace needs at least one project." and "As a
{role} you cannot delete projects." are step 2's.

**How to check:** `npx playwright test e2e/slice-12a`. By hand on the demo data: open Order management's home, read
the section at its end, click twice, press Undo in the toast; then open the project's old address from the history.

## Step 5: closing (31 October 2026)

Łukasz accepted step 4 with two additions: D-65 gets a sentence on the history after one's own delete (F28), and the
back-forward cache becomes a known limitation and an idea, not built in 12a.

**Docs (PRD section 10, and the answers since)**

- `docs/decisions.md`:
  - **D-65**, new, with step 1's two sentences (only the person who deleted it undoes it; the undo refused as a whole)
    and the history sentence;
  - the changes of D-29 (pins are undo steps), D-58 ("they are not undo steps"), D-59 (undone from any page of the
    workspace);
  - D-28's addition (a project is deleted from its home; the last one cannot be);
  - AD-05's note (`project.delete`).
- `docs/known-limitations.md`:
  - **removed:** "No undo outside canvases". What stays true moved: the history per person and workspace is in "The
    undo history lives in server memory", with the delete lost after a restart (F27); a label's delete bringing its
    pins back is in D-29 and the tests;
  - **new:** "A project's delete: its undo is all or nothing" (F6); "The last project under concurrent writes" (F8,
    fixed in the local adapter, a note for the database slice); "Back onto a page restored from the browser's
    back-forward cache" (step 4);
  - **added to:** "'At least one canvas' can race", with the shared canvas left in no project (Q-B).
- `docs/ideas.md`:
  - the plan: 12a done, next 12b;
  - "Undo and redo on the project and workspace home pages" done;
  - "Deleting a project: what comes later" (PRD section 9);
  - "Refresh a page restored from the back-forward cache".
- `docs/inventory-prototype-vs-app.md`: "Delete a project" done, its source corrected to `renderHome` (`data-hdel`);
  "Undo and Redo on the home pages" done; the slice's deliberate differences (PRD section 8, plus the top bar, the
  section's visibility and the arm's timeout).
- `docs/data-model-v2.md` section 11: the projects' rules (the last project, what a delete takes, the live label);
  no table changes (A2).
- `README.md` (status, the slice's features, the acceptance link) and `CLAUDE.md` (what this is, the screenshot
  command, slice 12a's e2e helpers and the back-forward cache note for tests, the architecture note "Undo on the home
  pages and a project's delete").

**S12A-13 (the element guard):** `npm run measure:build`, then `MEASURE=1 MEASURE_BUILD=production
ELEMENTS_BASELINE=.data/measure/s9-14-baseline/slice-08.json npx playwright test e2e/slice-03b/S3B-15-elements.spec.ts`
passes (65 s with the build).

| View | Viewport (slice 8 → 12a) | Page total (slice 8 → 12a) |
| --- | --- | --- |
| 30 %, expanded | 4,508 → 4,508 | 5,994 → 6,000 |
| 100 %, expanded | 19,305 → 19,305 | 20,791 → 20,797 |
| 30 %, collapsed | 1,465 → 1,465 | 2,861 → 2,867 |
| 100 %, collapsed | 4,907 → 4,907 | 6,303 → 6,309 |

The viewport counts are equal. The page totals are +6, the same as slice 11's (the names' check boxes, S11-13), so
slice 12a adds nothing to the canvas page.

**Full e2e run** (from scratch, no dev server running): **481 passed, 2 skipped, 3 failed, 4,901 s** (1 h 22 min),
against slice 10a's 4,646 s with 78 fewer tests. The failures:

- `S9-08` and `S10C-02`: timed out at sign-in (`bar-top` not shown within 15 s), as slice 10a's two flakes did; nothing
  of slice 12a on that path.
- `S12A-02`: the dev server restarted during the test ("Server is approaching the used memory threshold,
  restarting..."), and the page after the undo was the error page; the undo itself had been stored and its toast shown.

Output and traces are kept in `.data/e2e-failures/12a-close-1/` (git-ignored). Each file three times on its own: all
passed, 3 of 3 (S9-08 75 s, 59 s, 52 s; S10C-02 41 s, 43 s, 40 s; S12A-02 34 s, 36 s, 35 s). Flakes, not bugs.

**CI:** lint and typecheck pass; `npm test`: 117 files, 1,530 tests pass.

**Backup of KB:** `.data/backups/dev-db-20261031-2038.json` and `.data/backups/kb-model-latest.json`, both identical to
`.data/dev-db.json` (SHA-256 `f530d1aa…`), git-ignored. No format change in this slice (P12), so nothing upgrades the
file.

**Manual acceptance (on KB, after the backup):**

1. In "Kanton Basel", move a card on a canvas, open the project home and press Undo there ("Undone: Move card on
   {canvas}"), then Redo.
2. Rename the project on its home, click outside the field, press Ctrl+Z ("Undone: Rename project").
3. Pin a label on the project home and press Undo ("Undone: Pin label {label}").
4. Create a test project from the switcher, add one of the existing canvases to it ("Add a canvas from another
   project"), and read the section at the end of its home: "Deleted with it: First canvas." and "Staying in other
   projects: {canvas}.". Click "Delete this project" twice: the workspace home with "Deleted the project … and 1 canvas
   that only it used. The model is untouched."; press Undo in the toast (the tile is back); delete it again. The test
   project stays soft-deleted in KB (Q-G).
5. Open the deleted project's address from the browser's history (or Back to one of its pages, reached through the
   app's links): the workspace home with "That project no longer exists.".

## During the manual acceptance (1 November 2026)

- **"useInsertionEffect must not schedule updates."** (Łukasz, in the dev console, `history-nav.tsx:33`). Not slice 12a's:
  the file was unchanged since slice 6b. A link clicked after Back drops the forward entries inside Next.js's own push
  (a `useInsertionEffect`); the Navigation API reports it at once, and the Back and Forward buttons' store scheduled
  its update there. Fix: the store hears of the change in a microtask, after that commit. Regression check
  `e2e/slice-06b/S6B-01-console.spec.ts` (fails without the fix). Slice 6b's specs, S12A-05 and S12A-12: 16 passed
  (2.6 min); lint, typecheck and 1,530 unit tests pass.

## Assumptions

- A1: the slice starts from `main` at `de2af7f`: slice 11's code plus one docs commit.
- A2/P12: confirmed (F25).
- A4: the seed stays. The tests make their extra projects, shared canvases and pins through the domain.
- The workspace home's undo needs no `open` canvas. `undoAction`'s `open` stays canvas-only.
