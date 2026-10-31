# Slice 12a – acceptance

Status: **step 1 answered (Łukasz, 31 October 2026); step 2 (the domain) in progress.**

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

## Assumptions

- A1: the slice starts from `main` at `de2af7f`: slice 11's code plus one docs commit.
- A2/P12: confirmed (F25).
- A4: the seed stays. The tests make their extra projects, shared canvases and pins through the domain.
- The workspace home's undo needs no `open` canvas. `undoAction`'s `open` stays canvas-only.
