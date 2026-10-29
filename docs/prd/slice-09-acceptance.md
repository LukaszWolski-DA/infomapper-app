# Slice 9 – acceptance

Status: **step 1 (critical review) done, waiting for Łukasz's answers.**

- Branch `slice/09-saves-project-zoom` was made from `main` at `bcdfb7a`, the merge of PR 23 (`fix/panel-field-focus`).
- The PRD is copied unchanged from `~/Downloads/slice-09-saves-project-zoom.md` (commit "docs: slice 9 PRD").
- **About that file:** the one in Downloads is 25,843 bytes and dated 29 October 07:29. The step 1 prompt described 25,588 bytes from 28 October 22:33. It is the only file with that name, so I took it as the newer version. Please confirm.

Step 1 checks every item, decision, assumption and criterion against the code, `docs/decisions.md`, the earlier slices' acceptance docs and `e2e/fixes/panel-field-focus.spec.ts`. It writes no application code.

## Summary

| # | Finding | Proposal |
| --- | --- | --- |
| F1 | **A queued save can undo the save before it.** An attribute's type is sent whole (data type, custom type, length, precision, scale), built from the panel's last render. Item 1 alone would send Scale with the right version but with the old precision (null), and the stored precision 12 would be lost without any message. | Build a queued save's patch when its turn comes. Either the type command keeps the parameters it is not sent (proposal a), or the queue merges the patch with the values the last answered save stored (b). Recommended: (a). |
| F2 | **Saves already go one at a time.** Next.js dispatches server actions one at a time per client (`node_modules/next/dist/docs/01-app/02-guides/server-actions.md`, "Sequential dispatch"). The false conflict comes from the arguments: `expectedVersion: a.version` is read when the save is *started*, from the render before the first save's answer. | Item 2 is still needed, but not as a second network queue. What matters is reading the version (and the patch, F1) when the save is sent. Next.js calls its sequential dispatch "an implementation detail", so our own per-object chain stays. |
| F3 | **The panels' update actions return no version.** `updateAttributeAction`, `updateEntityAction`, `updateMappingAction` and the others return `null` or a notice, so item 1's "the version the last answered save returned" does not exist yet. Only `updateWorkspaceSettingsAction` returns `{ version }` (`settings-form.tsx`). | Every update action a panel uses returns the row's new version (about 10 actions, a type change each). The alternative "expected + 1 after success" is not safe once a write set touches the row twice. |
| F4 | **Undo writes a higher version** (Q2). Item 1's "the larger of" is safe. | Keep item 1 as written. |
| F5 | **Undo does not wait for panel saves.** `UndoProvider` runs a step after `ui.settled()`, which covers only the canvas's card, frame and note queue (`ModelCanvas.tsx`, `settled`). A click on Undo while a panel save is on its way can undo the step before it. | The new panel queue joins `settled()`. S9-05 checks it. |
| F6 | **A refused save does not put the panel field back today.** With `fieldKey` (and with the version key before it), a refusal changes no stored value, so the field keeps the refused text. Only the requirement panel resets (its `reset` counter) and the settings form reverts. Items 3 and 4 say "the field goes back" as if it already did. | Make "goes back" part of item 3 for every panel field: the queue raises the object's reset counter on a refusal, as the requirement panel does. S0-08 (settings) is unchanged. |
| F7 | **"Nothing to change."** If a field is left twice with the same new value before the page refreshes, the second save repeats the first one. The domain refuses it as `invalid` "Nothing to change." (`shared.ts`, `nothingToChange`), shown as a refusal toast. | The queue drops a save whose patch equals what the last answered save stored. |
| F8 | **Notes and frames already do items 1–2.** The canvas saves them through `enqueue` with `versions` (`ModelCanvas.tsx`) and `mergeFresh` (`useNotes.update`, `ui.updateFrame`). The note panel and the frame panel's name are therefore not affected. | Q1's list below. S9-04 covers them as "unchanged" cases, not new code. |
| F9 | **Names have no length limit.** `nameSchema` (`src/domain/validation.ts`) is `trim().min(1)` with no maximum. A project name has no limit when created, and duplicate project names are allowed. | Item 10 states the real rules: no maximum, duplicates allowed. Adding a 200-character maximum would be a new rule for all names, so it waits for its own decision. |
| F10 | **Most of item 20 already holds.** The canvas shortcuts (F, M, E, H, A, N, V, Escape, Delete), the nudge keys, Undo's Ctrl+Z/Y and history-nav's Alt+←/→ all skip an `INPUT` target (`isTyping` and `isTextField`). | An `<input>` in the zoom group needs no new key code; S9-12 only proves it. |
| F11 | **D-59 (iii) costs almost nothing.** `project` is an undoable table (`undo.ts`, `isUndoable`), and every `runCommand` write is remembered. (iv) needs a new exception next to `project_pinned_label`. | Either works. (iii) is the default path. |
| F12 | **No new permission is needed for the project home.** A `project.edit` (or reusing `canvas.rename`'s EDITORS set) gives the roles of item 13. The archive check is part of `checkPermission`. | A new `project.edit` permission with EDITORS and the message "edit projects". |

## Q1. Where saves get their version

**How the version reaches a field today.**
- Every panel reads its object from the page's model (`Inspector` → `indexModel(model)`), with no `mergeFresh`.
- The save closure sends `expectedVersion: <row>.version` from that render.
- The field is keyed by its own value (`fieldKey`, since PR 23).
- A model write calls `revalidatePath("/", "layout")` (`modelCommand`), so the action's single response carries the fresh page. The new version reaches the panel only when that page is applied: about 0.9 s on the e2e dev server, after the action resolves.
- `data-version` is on `panel-attribute` (PR 23), `panel-requirement` (slice 4a) and the source note (slice 7c).

**Every field that saves with an object's version:**

| Panel or page | Fields | Action | Several columns at once? |
| --- | --- | --- | --- |
| Attribute (`attribute-panel.tsx`) | name, type select, length, precision, scale, custom type, five flags, definition (dialog) | `updateAttributeAction` | **yes: the type is sent whole (F1)** |
| Entity (`entity-panel.tsx`) | name, stereotype, concept, definition (dialog) | `updateEntityAction` | no |
| Mapping (`mapping-panel.tsx`) | kind, rule, note, status | `updateMappingAction`, `setMappingStatusAction` | kind and rule together when a rule is typed for a direct mapping (`saveRule`); `chooseKind` reads `m.rule_expression` from the render |
| Relationship (`relationship-panel.tsx`) | label, cardinality of each end | `updateRelationshipAction` | min and max of one end (one control: safe) |
| Requirement (`requirement-panel.tsx`) | key, kind, name, description, expression, owner, ref, parent; status | `updateRequirementAction` (one field per call), `setRequirementStatusAction` | no |
| Source table and column note (`classifications.tsx`, `SourceNote`) | note | `setSourceNoteAction` | no |
| Classification list (`classifications.tsx`) | rename | `renameClassificationAction` | no |
| Concept, left panel (`left-panel.tsx`) | rename | `renameConceptAction` | no |
| Canvas tab (`canvas-tabs.tsx`) | rename | `renameCanvasAction` | no |
| Canvas menu (`canvas-menu.tsx`) | look (grid, layer…) | `setCanvasLookAction` | no; view state |
| Working label (`label-panel.tsx`) | rename | `renameLabelAction` | no |
| Workspace settings (`settings-form.tsx`) | name, description, four-eyes, Data Vault | `updateWorkspaceSettingsAction` | no; **already keeps the returned version**, but in state, so a second save before the first answer has the same race |
| Note panel (`note-panel.tsx`) | text, status, colour | `ui.updateNote`: the canvas's queue | **already queued (F8)** |
| Frame panel (`frame-panel.tsx`) | name, concept, system | `ui.updateFrame`: the canvas's queue | **already queued (F8)**; "move to concept" uses `updateEntityAction` per entity |
| Project home (new, items 7–15) | name, description | new action | name and description separately |

Toggles that add or remove rows (classification links, label links, requirement links) send no version of the object and are not affected.

**One place.**
- The rule can live in one hook beside `fieldKey`, for example `useRowSaves()` in `src/app/_panels/fields.tsx` or its own module.
- Per object id, it keeps the last answered version and a promise chain. `save(id, versionNow, send)` runs `send(max(lastAnswered, versionNow()))` when its turn comes.
- `versionNow` reads a ref set on every render, not the closure.
- Each panel's `save` changes from `run(() => action({ …, expectedVersion: x.version }))` to `rowSave(x.id, () => x.version, (v) => action({ …, expectedVersion: v }))`. That is one line per panel plus F3's return values.
- The settings form and the canvas tabs and menu use the same hook.

## Q2. Undo, redo and versions

- An undo or a redo writes a **new, higher version**. It never restores the image's version.
- `src/domain/commands/undo.ts:269` builds the row as `{ ...structuredClone(base), version: (current.version as number) + 1, updated_at: ctx.now, updated_by: ctx.actorId }`.
- The tests say so: `undo.test.ts`, "undoes an edit with the before-image, as a new version": Customer→Client→Customer gives version 3, and redo gives `version: 3` after `2`.
- Versions only grow, so item 1's "the larger of" never sends a version that is too high. No other rule is needed.
- **The catch is the order, not the number (F5).** Undo must wait for a panel save on its way, or it may undo the step before it.

## Q3. A refused save in a queue

- **Today**, `useAction.run` shows the domain's message as a refusal toast. The panel field keeps the refused text (F6), except in the requirement panel (`setReset`) and the settings form (`revert()`).
- **Item 3's proposal holds, with F6:** a refusal stops the object's queue, raises its reset counter (all its fields show the stored values), and one toast shows the first refusal.
- **A validation refusal of a different field.** Example: a too-long custom type is refused while a queued name save waits. The name save would have succeeded on its own. I propose to stop it anyway: the person sees one toast and every field back at its stored value. That is simpler to understand than a half-saved panel. The alternative, sending queued saves after a validation refusal (not after a conflict), is about 5 more lines.

## Q4. The fresh page and the panels

- The panels take the fresh page as it comes (the props), not through `mergeFresh`.
- Because Next.js applies one action's response at a time (F2), a late page from the panels' own saves cannot overtake a later save's page.
- A late page from *another* write could. The known limitation "A late fresh page could show an older state" says so ("What is left: the model's content on cards … and everything else on the page").
- With item 1 the *version* sent never goes back (the larger of). A field could still show an older value for a moment, until the next page. That remains the limitation's case; the store revision (AD-31) is still its fix.
- The limitation's text changes only to say that panel saves keep their version.

## Q5. Projects today

- **Creating:** `createProject` (`src/domain/commands/project.ts`):
  - permission `project.create` (EDITORS: owner, admin, modeler; archived workspaces are refused by `checkPermission`);
  - `name: nameSchema`, trimmed, at least 1 character, **no maximum** (F9);
  - **duplicates allowed**;
  - `description: null`;
  - the action is `createProjectAction` (`src/app/_actions/workspace.ts:82`).
- **The model for item 11:** `renameCanvas` (`src/domain/commands/canvas.ts:89`): `checkPermission(access, "canvas.rename")`, `parseInput`, the version, then `nextVersion(ctx, canvas, { name })`.
- **A new `project.edit` permission** with EDITORS (F12).
- **Where the name shows:**
  - the project home's `<h1>` (`p/[projectId]/page.tsx:89`) and its description `<p>` (line 90);
  - the breadcrumbs (`breadcrumbs.tsx:21`);
  - the switcher (`top-bar.tsx:203`);
  - the workspace home's tiles (`w/[workspaceId]/page.tsx:175`);
  - the canvas menu's toasts and list (`canvas-menu.tsx:89, 107, 115, 168`);
  - `project-tiles.tsx` ("Also in", "Add to {project}", its toast);
  - the moved notice (`MovedNotice`, canvas page);
  - the live canvas toast "Added the live canvas {name} to {project}."
  - There is no document title (`generateMetadata` is not used) and no `GONE` entry: a project is not a history place.
  - All are read from the page, so every one shows the new name after the save's fresh page.
- **Escape in the panels' fields:** `TextField` and `TextArea` do nothing on Escape: no revert, no blur. So item 8's "Escape returns the field to the stored value" would be new. Proposal: the project home does as the panels do (nothing). Escape in all text fields stays an idea.

## Q6. Undo on the home pages

- A canvas created on a project home goes into the person's undo history as every `runCommand` write does (`remember` → `isUndoable`). It can be undone only from a canvas (known limitation "No undo outside canvases").
- **(iii) costs:**
  - nothing in undo (`project` is an undoable table);
  - a label for the toast ("Undid: Renamed project …"), which `changeLabel` already writes generically from the events ("project");
  - the known limitation's text.
- **(iv) costs:** a new exception in `isUndoable` next to `project_pinned_label`, with its unit test.
- Both are small. I leave the choice to you.

## Q7. The zoom controls today

`src/canvas/ZoomControls.tsx`:
- It subscribes to React Flow's store for `transform[2]` (the zoom), `width` and `height`. A pan does not re-render it, because the selected zoom number does not change.
- − and + call `zoomAround(rf.getViewport(), 1/1.2 or 1.2, { width, height })` (`geometry.ts`) and one `rf.setViewport(v)`, around the middle of the canvas's own size from the store, with no layout read.
- The range is `MIN_ZOOM = 0.1` and `MAX_ZOOM = 3`, i.e. **10–300 %**, as the prototype. Fit goes up to `FIT_MAX_ZOOM = 1.1`.
- The value is `<span data-testid="value-zoom" class="min-w-[44px] …">{Math.round(zoom * 100)}%</span>`.
- A typed zoom calls `zoomAround` with `factor = typed / current`, the same path as − and +.
- **The remembered view:** `onMoveEnd` (`ModelCanvas.tsx:420`) writes `infomapper:view:<canvas id>`. It reads `rootRef.current.getBoundingClientRect().left`, but in a React Flow event, not in a commit. Whatever fires it for − and + fires it for a typed zoom (S9-13 checks it).
- **Keys:** see F10. An `<input>` in the top bar is covered by `isTyping` (canvas), `isTextField` (history-nav) and Undo's `isTyping`. React Flow's own `panActivationKeyCode="Space"` ignores inputs.

## Q8. The element guard and the top bar

- **Guard:** the zoom group is in the top bar, outside the canvas's viewport. Replacing the `<span>` with an `<input>` keeps the element count the same, so the viewport counts are unchanged and the page total is unchanged. A wrapper or a `<label>` would add one element to the page total, but not to the viewport.
- **Width:** the field must stay the span's box (`min-w-[44px]`, with the same padding) with a fixed CSS width, e.g. `w-[44px]` and `text-center`. Then slice 6a's measurements stay as they are: the zoom group in the 1,600 px row of `slice-06a-acceptance.md`, never in "More".
- **Commits:** typing is the input's own state in `ZoomControls`. Applying is one `setViewport`, as + is.

## Q9. Earlier tests and docs

**Specs that read `value-zoom`:**
- `S1A-03` (30 %), `S2A-14` (50 %), `S4B2-11` (zoom after a pan).
- If the test id moves to the input, they read `toHaveValue` instead of `toHaveText`.
- Proposal: keep the id `value-zoom` on the input, so the change is `toHaveValue` in three specs, rather than item 16's new id `field-zoom`.

**Specs of what step 2 touches:**
- `e2e/fixes/panel-field-focus.spec.ts`;
- the slice 4a specs that wait with `expectPanelVersion`;
- `S0-08` (settings, unchanged);
- the panel specs of slices 1a, 1b, 2b, 3a and 7c (the PR 23 set: 106 tests).

**Other specs:**
- Step 3: `S0-04`, `S0-06`, `S0-07` and `S0-11` (the project home); `S6B-*` if the home is a history place (it stays one).
- Step 4: slice 6a's top bar specs (`S6A-10` widths) and slice 5a's zoom specs.

**Known limitations:**
- "No undo outside canvases": item 14.
- "A late fresh page could show an older state": Q4.

**Status lines:** the README ("slices 0 to 8 are merged") and `docs/inventory-prototype-vs-app.md` ("Projects and workspace").

## Decisions and assumptions

- **P1 (scope):** matches the ideas list, the "Quick" notes of slice 8's acceptance in `docs/ideas.md`.
- **P2 (tests):** right. Item 1 touches every panel; one full run after step 2.
- **P3 (a fix, not a decision):** right for the version. F6 (a refused field goes back) changes what a person sees after a refusal in most panels: today the refused text stays. I count it as part of the fix, since S0-08 already shows the rule for settings; tell me if it should be a decision.
- **D-59 and D-60:** the options are open; costs in Q6 and below.
  - **(v)/(vi):** both are a `blur` handler.
  - **(vii)** reuses `clamp`. **(viii)** adds one toast text.
  - Neither touches the guard.
- **A1:** holds. PR 23 is merged (`bcdfb7a`), `fieldKey` is on main, and the branch starts from it.
- **A2: holds, checked against `8f0f3e7`.**
  - CLAUDE.md ("Łukasz's test model") now says the model "is never committed; it stays on his disk only (his decision, 28 October 2026)".
  - It says to back up `.data/dev-db.json` before a slice that changes the local file's format, and on request.
  - This slice changes no format, so no upgrade and no forced backup. The Definition of done asks for a backup before the manual acceptance, which CLAUDE.md allows ("on request").
  - PRD section 9 says "never a fixture in the repository". CLAUDE.md does not use the word "fixture", but it says the same thing ("never committed"). No conflict.
  - Optional wording for the PRD: "(CLAUDE.md: never committed, on his disk only)".
- **A3:** holds. `project.name` and `project.description` exist (data model section 9; `Project` type; `createProject` writes `description: null`). No migration and no format change. F9 adds no rule unless you want a maximum.

## Differences from the prototype that the slice touches

- **Project home:**
  - In the prototype the name and description are always fields (`.ph-name`, `.ph-desc`). In the app they are an `<h1>` and a `<p>` that appears only when there is a description. Item 7 makes them fields for editors and keeps text for the others (item 13).
  - The prototype's description grows by reading `scrollHeight` in `renderHome` and on `input`. The app would use CSS (`field-sizing: content`, supported in Chromium; Firefox and WebKit would keep `rows` with `resize-y`) or the input event only, never a read in a render.
- **Zoom:** the prototype's `#zoomv` is a `<span>` (`min-width: 44px`). The input is a deliberate difference (D-60).
- **Saving:** the prototype has no versions; the app's per-object chain does not show.

## New user-visible texts (proposals, for approval in steps 3 and 4)

- Project home: the aria labels "Project name" and "Project description", and the placeholder "What is this project about?" (all from the prototype).
- D-59 (ii): the toast "A project needs a name."
- D-60 (viii): the toast "Type a zoom from 10 to 300 %."
- The zoom field: an aria label "Zoom", and a title "Type a zoom and press Enter" (new; the prototype has none).
- The permission message for `project.edit`: "edit projects", inside the existing refusal sentence.
- Step 2 adds no text: the conflict and refusal toasts are the domain's.

## Small things found in passing (step 2)

- In `src/app/_panels/fields.tsx` the doc comment of `TextField` ("A text field that saves on Enter…") now sits above `fieldKey`, whose own comment follows it. The file's header still says the fields are "keyed by the row's version". Both get fixed in step 2, where the file changes anyway.

## Łukasz's answers (29 October 2026)

- **The PRD:** the file from Downloads dated 29 October (25,843 bytes) is the right version.
- **F1:** the attribute's type command takes only the changed parameters:
  - absent: keep the stored value;
  - `null`: clear it;
  - a value: set it.

  Changing only the data type behaves as today (described below, with a unit test). Other panel actions that send a whole object or several fields at once follow the same rule (the list below).
- **F2:** the version is read when the save is sent. The order of one object's saves is kept by our own chain per object, not only by Next.js's queue of actions, and a test covers it.
- **F3:** agreed. Every save action of the panels returns the new version, in one shape.
- **F5:** agreed. Undo and Redo wait for panel saves on their way; Ctrl+Z in a text field stays the field's own text undo. S9-05 is extended.
- **F6:** no change in this slice: on a refusal every field behaves as today. PRD items 3–4 and S9-03 are corrected. Making the behaviour the same everywhere is in `docs/ideas.md`, next to "keep the typed value on a stale-version conflict".
- **Q3:** a stale version, a missing permission and the archive stop the object's queued saves (one toast). A validation refusal does not stop them.
- **F9:** no length rule. Item 10: no length rule, duplicates as when creating a project.
- **Q8:** the test id `value-zoom` stays (assertions with `toHaveValue`).
- **D-59:**
  - (ii): an empty name sends the field back with the toast "A project needs a name.";
  - (iii): renaming and the description are an undo step, as `renameCanvas`.
- **D-60:**
  - (v): leaving the field applies the value, as Enter does;
  - (vii): a value out of range is cut to 10 % or 300 % and the result is shown.
- The texts of D-59 and D-60 are quoted for approval in steps 3 and 4. They go into `docs/decisions.md` only after that.

The PRD is corrected accordingly: items 2 (with 2a and 2b), 3, 4, 10 and 16, S9-03 and S9-05, and the chosen options of D-59 and D-60.
