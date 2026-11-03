# Slice 14b – acceptance

- Branch: `slice/14b-canvas-row-and-leaving`
- Start: `main` at tag `slice-14a`, `797dd62f9a774d55f84d12b6a65621c1c4f1063f` (main was not further; assumption A1 holds)
- Date: 3 November 2026
- PRD: `docs/prd/slice-14b-canvas-row-and-leaving.md`, copied unchanged from Łukasz's Downloads (`cmp` identical; SHA-256
  `67a9342e22468ab276bce5e4f813c976ff2e66a69081fe8462f3ab798e602d9d` for both)

## Step 1: the PRD checked against the code (3 November 2026)

Read: the PRD; `docs/decisions.md` (D-12, D-28, D-38, D-59, D-64, D-66, AD-12, AD-13, AD-16); CLAUDE.md ("Saving in
panels" with slices 10a, 13 and 14a, "Names and aliases", "The full run in three parts"); `docs/known-limitations.md`
("Writes still off the save chain", "A field's draft: what slice 13 does not cover", "Names and aliases on canvases");
`docs/ideas.md` ("The plan after slice 13", "A field's draft: what comes later", "A fourth part for the full e2e run");
`slice-13-acceptance.md` (F13, the line, "Not saved"); `slice-14a-acceptance.md` (`save-cuts.ts`, `afterPage`,
`note-drafts.ts`).

Code: `src/canvas/look.tsx`; `src/app/w/[workspaceId]/p/[projectId]/_components/canvas-tabs.tsx`, `canvas-menu.tsx`;
`src/app/_components/app-shell.tsx`; the canvas page (`c/[canvasId]/page.tsx`, the look's provider);
`src/canvas/ModelCanvas.tsx` (`enqueue`, `enqueueGroup`, `setNames`, `namesVersion`); `src/canvas/NamesSwitch.tsx`;
`src/app/_actions/canvas.ts`, `frame.ts` (`setCanvasNamesAction`), `source-change.ts`; `src/domain/commands/canvas.ts`
(`renameCanvas`, `deleteCanvas`, `setCanvasLook`, `applyLookToAllCanvases`, `setCanvasNames`), `label.ts`
(`renameLabel`, `deleteLabel`), `undo.ts` (the look outside undo); `src/domain/source-changes/actions.ts`, `delete.ts`;
`src/ui/row-saves.ts`; `src/app/_components/use-action.ts`, `undo.tsx`; `src/app/_panels/fields.tsx` (`useDraft`,
`DraftLine`), `left-panel.tsx` (`NameInput`, F13), `source-changes.tsx`, `classifications.tsx` (table and column notes);
`src/ui/field-drafts.ts`, `src/canvas/note-drafts.ts`, `src/ui/rich-text/rich-text-field.tsx`; `e2e/parts.ts`,
`scripts/e2e.ts`; slice 14a's closing memory log (`.data/e2e-memory-20261103-1058-part{1,2,3}.*`).

No application code was changed.

### Findings

| # | Finding | Files and functions | Proposal |
| --- | --- | --- | --- |
| F1 | **The canvas's row has more writers than the PRD lists.** Besides the look, the names switch, the rename and the delete: (a) the tab menu's look for a canvas that is **not** open (`run(setCanvasLookAction(…, expectedVersion: canvas.version))`), also on the project home; (b) "Use this look on all canvases" writes every canvas row of the workspace, with no version check and no versions in its answer; (c) a label's rename renames its live canvas, and a label's delete clears its live canvas's `live_label_id` (server-side writes of a canvas row); (d) undo and redo, which already feed `rowSaves`. | `canvas-menu.tsx` `setLook` (l. 239–242) and the "look-all" item (l. 314–320); `applyLookToAllCanvases` (`canvas.ts` l. 419); `renameLabel` (`label.ts` l. 170), `deleteLabel` (l. 206); `undo.tsx` l. 69–75 | (a) on the chain like the open canvas's look (`saveRow`); (b) on the chain as a write over the project's canvases, all **held** (`saveRows` with no `shown`), answering `{ versions: true }`; (c) the label's rename and delete answer `{ versions: true }` (the label panel's `saveRow` already passes `versions` to `rowSaves`); (d) unchanged. See Q1's table. |
| F2 | **The names switch does not send the canvas's version.** `setCanvasNames` reads the canvas row as it stands (slice 11, F2: the last write wins) and checks only the cards' versions; its answer already carries every version it wrote, the canvas's included. So it is never refused because of the look or a rename; the others are refused because of it. Item 2's "each sends the newest version the chain knows" does not apply to it. | `setCanvasNames` (`canvas.ts` l. 534–566); `ModelCanvas.setNames` (l. 795–839: `enqueueGroup`, `noteCanvasVersion`, `namesVersion`) | The switch stays on the canvas's queue (it needs the cards' versions) and **holds** the canvas row on the chain while it is on its way: `rowSaves.saveRows([{ id: canvasId }], …)` around its queued write, registered at the click, so a rename or a look change started meanwhile waits for it and sends the version it answers. `noteVersion` goes; `namesVersion` stays (it only filters stale pages for the names). |
| F3 | **A held row's waiting saves are cut by the write's refusal.** In `saveRows` a cutting refusal (`stale_version`, `forbidden`, `archived`, `not_found`, `locked`) sets `cutThrough` on **every** listed row, held ones included. For O4 and F2 this is wrong: a change-to-resolve action refused because someone resolved the change meanwhile would cut the column note waiting behind it, which then shows "Not saved" though nothing changed on it: the false message O4 is meant to remove. A held row's version was not sent, so the refusal says nothing about it. | `RowSaves.saveRows` (`row-saves.ts` l. 278) | **A cutting refusal cuts only the checked rows' waiting saves**; a held row's waiting save is sent after it with the newest version known (a refusal wrote nothing). This mirrors slice 10a's rule the other way round ("a cut on a held row does not stop a several-row save"). It changes slice 10a's held rows too (an attribute's move, a merge, a concept deleted with "move to", the D-05 drop): after a refused move a sibling's waiting save is sent instead of cut. Question 2. |
| F4 | **A popover "under the tab, placed by CSS" cannot work inside the tab bar.** The tab list is `overflow-x-auto overflow-y-hidden` with a fixed height of 38 px; anything positioned inside a tab is clipped. A Radix popover anchored to the tab would escape it, but floating-ui measures the tab in a layout effect (a layout read in a commit above the canvas, CLAUDE.md, slice 6a). | `canvas-tabs.tsx` l. 56–61 (the tab list's classes) | **The line inside the tab, after the field, on one row:** "Changed meanwhile to: {name}" (truncated, the full name in its title), "Use this", "Keep mine" as the panels' small buttons (26 px high; the tab is 31 px); "Not saved" or "Not saved. You can still copy it." the same way. `DraftLine` gets a compact variant (one row, `truncate` instead of the three-line fold). The tab grows to the right; the tab list already scrolls sideways. No popover, no layout read, nothing below the tab bar moves. This differs from O2's wording ("under the tab"): Question 1. |
| F5 | **The rename closes before its answer** (as F13 found for a concept): `rename` calls `setRenaming(null)` first and sends `canvas.version` from the page with a plain `run`; a refused name is lost. Escape writes the stored name into the field and blurs it, so the rename returns at once. An empty name goes back silently (no toast). | `CanvasTabs.rename` (l. 44–53), the input (l. 87–105) | The field uses `useDraft` (`required`, trimmed), saves with `saveRow({ id, version }, …)` and stays until its answer: success closes it; a refusal keeps it open with its mark (F4). Escape: `useDraft`'s rule (the stored name back; "Use this" during a conflict), then the field closes. Read-only after a permission or archive refusal (`view.canEdit` from the fresh page). An empty name: unchanged (Question 7). `?rename=1` is dropped as today. |
| F6 | **The delete checks the canvas's version also when it only takes a shared canvas out of the project**, without writing the canvas row. With `deletes: true` on the chain, such a success would cut the canvas row's waiting saves (a look change) silently. | `deleteCanvas` (`canvas.ts` l. 331, 343–345); `CanvasMenu.remove` | `saveRow(…, { undoable: true, deletes: !others.length })`. The refusals (the last canvas, D-28: the item is disabled with its title, and the domain still refuses) are unchanged. |
| F7 | **The look after a refusal shows the look from before the click, not the newest stored one (O3).** `setLook` puts `before` back; the page's effect that takes the stored look is skipped while a save is on its way (`pending.current`) and runs again only when the page's look or version changes. If another session changed the grid and the refusal's fresh page arrives before the answer, the old grid stays. | `CanvasLookProvider` (`look.tsx` l. 64–97) | The look saves through `useAction`'s `saveRow` (its refusal is answered after the fresh page, `afterPage`); after a refusal the provider shows the newest page's look (a ref to the `look` prop), as `useChoice` does. The look's own queue (`queue`, `versionRef`, `noteVersion`) goes, and `SaveLookResult` with it (the action's `ActionResult`, with `code`). |
| F8 | **The change-to-resolve actions are plain `run`s and send the change's version from the page.** What they write (domain): `source_change` (the change and the changes it settles), `source_column`, `source_table`, `mapping`, `mapping_input`, `source_import` (approve all), and for "Delete…" the cascade (`sourceDeleteCascade`: mappings, canvas items, notes, links). The browser knows the change's `source_system_id` (on the row) and the page's model (`p.ix.model`). | `ChangeCard.act`, the `MoveForm`/`MapForm`/`SourceDeleteForm` callbacks, `ApproveAgainAll` (`source-changes.tsx` l. 175–265, 463–531); `changeCommand` (`source-change.ts` l. 76–88, `{ versions: true }`) | Each action runs through `saveRows`: the change row **checked** (`{ id: c.id, shown: c.version }`; approve all has none) and, **held**, every table, column, mapping and mapping input of the change's source system (from `p.ix.model`). The answer's `versions` reach every row (already returned). The panels' saves of those rows started meanwhile wait and are sent with the new versions; with F3 a refusal does not cut them. Canvas items and notes stay on the canvas's queue (a deleted one is refused as not found there, as today). |
| F9 | **The whole source can be large.** "Performance test" has 20,000 columns: one action would list about 20,000 held rows (a `Row` entry each, kept in `rowSaves`' map for the page). | `RowSaves.row` (entries are never removed) | Keep O4 as agreed (one rule: the whole source), measured in step 3 on "Performance test" (`seed:large -- --changes`): from the click to the request under 20 ms. If it is over, hold only the rows the change names (its table, that table's columns, their mappings and inputs; the import's mappings for approve all). Question 3. |
| F10 | **Nothing on the page knows today whether it has unsaved text.** A field's refusal is component state (`useDraft`'s `refusal`); kept drafts are in `field-drafts.ts` (one map, every path); notes' drafts in `NoteDrafts` (with `subscribe`); saves on their way in `rowSaves` (tails, no count) and in `ModelCanvas`'s `pending` map; the rich-text editor's text in its dialog; the canvas's note editor in `NoteLayer`. | as listed | A small module `src/ui/leave-guard.ts`: sources call `hold(key, check?)` and `release(key)`; the `beforeunload` listener is on `window` only while at least one source holds, and at the event it asks the checks and calls `preventDefault()` (and sets `returnValue`) only when one says yes. Sources in Q5. No React state, no render (Q5, Q6). |
| F11 | **The focused fields that count (O5's fourth kind).** Fields that save a row: every `useDraft` field (panels, the project home's name and description, the settings form), the tab's rename (F5), the note editor, the rich-text dialog. Not counted: the search boxes, the zoom (view state), fields that create something (a new concept's name, the new source table dialog), the import wizard, the sign-in and people forms. | — | As listed; Question 5. |
| F12 | **Next.js's own navigations fire no `beforeunload`** (links, `router.push`, Back and Forward between the app's pages stay in one document); there is one root layout (`src/app/layout.tsx`), so no link reloads the document, and nothing in the app uses `window.location`. A full navigation does fire it: a typed address, a reload, a closed tab, Back into a document from the back-forward cache (`docs/known-limitations.md`). | `src/app/layout.tsx`; grep | As the PRD says (O6). The listener is added and removed with the held set, not kept on every page: Firefox keeps a page with a `beforeunload` listener out of its back-forward cache. |
| F13 | **An earlier spec reloads with a refused draft on the page:** `S13-14` reloads after "Not saved" (a kept draft); from step 4 that asks for the warning. 45 spec files call `reload()`; the others need checking for a focused draft or a save on its way. | `e2e/slice-13/S13-14.spec.ts` l. 34 | `S13-14` accepts the dialog before its reload (its point, "gone after a reload", stays). Step 4 checks every `reload()`/`goto` that follows typing and runs those specs. |
| F14 | **Testing the warning.** Chromium shows a `beforeunload` dialog only after a user gesture on the page (typing in Playwright counts). `page.close({ runBeforeUnload: true })` fires it reliably and raises a `dialog` of type `beforeunload`; a reload does too, but must accept or dismiss it. | — | S14B-09 uses `page.close({ runBeforeUnload: true })` with `page.on("dialog")` per case, plus one F5 case with `page.reload()` (accepting the dialog). "Nothing asked" is checked as no dialog during the close. |
| F15 | **S14B-05 cannot happen within one session after item 2**, as the PRD expects. | — | The spec changes the look as another session through the domain (a new helper `changeCanvasLookElsewhere`, written like `changeSettingsElsewhere`), then renames in the page: refused as stale with the name unchanged meanwhile: "Not saved". S14B-04 does the same with a name (`renameCanvasElsewhere`). |
| F16 | **The look's controls on a page without the open canvas** (the project home's tab menu) show the canvas's look from the page (`canvas.look`), which a refusal's fresh page already brings: O3 holds there once the write is on the chain. | `CanvasMenu` (`look = open?.look ?? canvas.look`) | Nothing more. |
| F17 | **The concept's rename in the tree (F13) keeps a refused name without the line.** The tab would get the line (O2): two renames in two forms. | `left-panel.tsx` `NameInput`, `renameConcept` | Not in this slice (the PRD names only the tab); noted in `docs/ideas.md`. Question 8. |
| F18 | **No unit test covers the parts.** | `e2e/parts.ts` | A unit test in `tests/` (`partFolders`: every folder in exactly one of four parts, in order; a wrong part number refused). |

### Q1. The canvas's row today

| Write | Where | Version it sends | What it answers | After a refusal | Undo step | Proposal (one chain for the row) |
| --- | --- | --- | --- | --- | --- | --- |
| Look of the open canvas (background, grid, layer) | `CanvasLookProvider.setLook` (`look.tsx`), from the tab menu, the Overview panel, the layer switch | `versionRef`: the page's version, raised by its own answers and by `noteVersion` | `{ version }` | the look from before the click, toast (F7) | no (D-12) | `saveRow({ id: canvasId, version: the page's }, …)`; after a refusal the newest page's look; the own queue and `versionRef` go |
| Look of another canvas | `CanvasMenu.setLook` | `canvas.version` from the page | `{ version }` (unused) | toast; the menu shows the page's look | no | `saveRow` on that canvas's row |
| "Use this look on all canvases" | `CanvasMenu` | none (no check) | `{ changed }` | toast | no (one change group outside undo) | `saveRows` over `view.canvases`, all held; `{ versions: true }` |
| Names switch | `ModelCanvas.setNames` → `setCanvasNamesAction`, on the canvas's queue | none for the canvas (the cards' versions only) | `{ canvas, versions, cards }` | both modes put back, toast | yes ("Show entity aliases", …) | stays on the canvas's queue; holds the canvas row on the chain (F2); its `versions` reach the chain; `noteVersion` goes |
| Rename in the tab | `CanvasTabs.rename` | `canvas.version` from the page | `{ name }` | the name is lost, toast (F5) | yes (its change group) | `saveRow`; the field keeps its draft (F4, F5) |
| Delete / Remove from this project | `CanvasMenu.remove` | `canvas.version` from the page | `{ deleted, otherProjectIds }` | toast | yes | `saveRow`, `deletes` only when it deletes (F6) |
| A label's rename / delete | label panel → `renameLabel`, `deleteLabel` | none for the canvas (the server reads it) | the label's version | — | yes | answer `{ versions: true }` (F1 c) |
| Undo / redo of a step that wrote the canvas | `undo.tsx` | — | `versions` → `rowSaves.answer` | — | — | unchanged |
| Duplicate, create, In projects | `CanvasMenu` | — | — | — | — | they do not write the canvas row: unchanged |

The smallest change: the look provider, the menu and the tab call `useAction`'s `saveRow`/`saveRows` on the canvas's id;
the names switch registers a held row (F2); `RowSaves` gets F3's cut rule. The look's own queue, `versionRef` and
`noteVersion` are removed; nothing else in `RowSaves` beyond F3 and F10's counter. Unit tests: `row-saves.test.ts` (F3,
the counter); the look's refusal through S14B-07.

### Q2. The tab's rename field

Today a double-click on the tab, or "Rename" in its menu (another canvas opens with `?rename=1`), mounts an uncontrolled
input (`autoFocus`, selected); Enter blurs it; Escape writes the stored name and blurs it; the blur closes the field
first and then sends (F5). The line cannot be a popover under the tab (F4). Proposal: F4 and F5. The input keeps
`data-testid="input-canvas-name"`; the line uses the panels' test ids (`draft-conflict`, `draft-other`,
`button-use-this`, `button-keep-mine`, `draft-not-saved`) inside the tab.

### Q3. Undo

The rename, the delete and the names switch are undo steps today; the look and "look-all" are not (D-12; `undo.ts`
ignores a look-only change). The chain decides only the order and the version sent: no command, change group or label
changes; the toasts stay (the rename's toast has no Undo button, as today). Undo and redo keep running
`rowSaves.exclusive`, so they wait for the canvas row's saves too, as for any row.

### Q4. The change-to-resolve actions

Each action sends `{ changeId, expectedVersion: c.version }` (plus a target column or an attribute for move and map;
approve all sends `{ importId, count }`) and answers `{ resolution, label }` with the `versions` of every row written
(`changeCommand`, `{ versions: true }`), which `run` passes to `rowSaves.answer`. The browser knows the change's
`source_system_id` and the page's model, so it can list the source's tables, columns, mappings and inputs. Proposal: F8
with F3, sized by F9. The cards keep `disabled={pending}`; a refusal is answered after the fresh page (`saveRows`'
`afterPage`), and a form stays open on a refusal as today.

### Q5. Unsaved state

| Kind | Where it is known | How the guard learns it (no render) |
| --- | --- | --- |
| A refused draft in a field (conflict, "Not saved", read-only, locked) | `useDraft`'s `refusalNow` ref | `hold` in `refuse(r)` for a mark, locked or copy; `release` when it clears or the field unmounts (a kept draft passes to `field-drafts`) |
| A draft kept for a closed panel | `field-drafts.ts` (`kept`, with its path) | `hold("kept", check: a draft for location.pathname)` while the map is not empty |
| A refused frame name, a canvas's name | `useDraft` (the frame panel's `TextField`; the tab after F5) | as a field |
| A note's draft (refused or on its way) | `NoteDrafts.set` | `hold` while it has a draft |
| A note typed in its editor, not yet sent | `NoteLayer`'s editor | `hold` while the editor is open, check: its text differs from the stored |
| Rich text in its dialog | `RichTextDialog` | `hold` while open, check: changed or refused |
| A save on its way | `rowSaves` (started, not settled); `ModelCanvas`'s `pending` | a counter in `saveRows` (`hold` at the first, `release` at zero); the canvas's queue the same in `enqueue`/`enqueueGroup` |
| A focused field with typed text | `useDraft` (`FieldDraft.hasDraft`) | `hold` on focus with that check, `release` on blur |

### Q6. `beforeunload`

One listener on `window`, added by `leave-guard.ts` when the first source holds and removed when the last releases. It
lives in `src/ui` (`app` and `canvas` may both import `ui`). It needs no component: both homes and the canvas page get it
from the fields, notes and saves they have. It calls `event.preventDefault()` and sets `event.returnValue = ""` (older
browsers); the browser shows its own text (O6). Next.js's navigations do not fire it (F12).

### Q7. Earlier tests and docs; the e2e cuts

**Specs to run in steps 2 and 3, and how they may change:**

- **The tabs' rename** (`S0-04`, `S0-05`, `S0-06`, `S0-10`, `S6B-06`): the field now closes on its answer, not on the
  blur; a spec that reads the tab's name right after Enter waits for it. No assertion is expected to change.
- **The menu's delete and look, the layer** (`S2A-03`, `S2A-05`, `S2A-09`, `S2A-10`, `S2A-11`, `S2A-13`, `S2C-02`,
  `S2C-04`, `S6A-02`, `S6A-03`, `S6A-09`, `S6A-10`, `S4B2-06` to `S4B2-12`): unchanged behaviour.
- **The names switch** (`S11-01` to `S11-05`, `S11-10`, `S11-11`, `S11-13`, `S11-13-commits`): unchanged; S11-13's
  commits must stay (one canvas commit, no miniature commit).
- **Source changes** (`S7B-01`, `S7B-05` to `S7B-10`, `S7B-15`): unchanged behaviour; the actions now wait for the panels'
  saves of their source on their way.
- **Held rows of slice 10a** (an attribute's move, a merge, a concept deleted with "move to", the D-05 drop): run with F3.
- **`S13-14`** changes (F13); step 4 lists any other.
- **Unit tests:** `src/ui/row-saves.test.ts` (F3, the counter), a new `leave-guard.test.ts`, a new
  `tests/e2e-parts.test.ts` (F18).

**Docs**, as the PRD's section 10, plus: CLAUDE.md "Saving in panels" ("Rows only the server knows": the change actions
hold their source; "still off the chain": only the role select), the names switch (`noteVersion` gone), "The full run in
three parts" to four, the new helpers; `docs/known-limitations.md`: "Writes still off the save chain" reduced to the role
select; "Leaving the page with a draft not saved gives no warning" replaced by the entry on navigation inside the app;
"The last write wins on a canvas's mode" stays (F2).

**The cuts for four parts.** Slice 14a's closing log, per folder (a part's server starts at about 228 MB after the
warm-up; a part's first folder also carries the routes' first compiles):

| Folders | Tests | Minutes | Heap after them (MB) | Part at 14a |
| --- | --- | --- | --- | --- |
| fixes … slice-02b | 84 | 18.7 | 1,090 | 1 |
| slice-02c | 27 | 3.7 | 1,353 | 1 |
| slice-03a | 16 | 4.2 | 1,316 (peak 1,364) | 1 |
| slice-03b … slice-04p | 60 | 11.3 | 799 (peak 899) | 2 |
| slice-05a | 29 | 3.4 | 918 (peak 1,125) | 2 |
| slice-06a, slice-06b | 30 | 4.3 | 1,219 | 2 |
| slice-07a | 33 | 3.9 | 1,308 (peak 1,340) | 2 |
| slice-07b | 31 | 4.4 | 1,532 | 2 |
| slice-07c | 30 | 4.6 | 544 (peak 743) | 3 |
| slice-08, slice-09 | 47 | 5.6 | 866 | 3 |
| slice-10a | 44 | 5.9 | 1,007 (peak 1,186) | 3 |
| slice-10b … slice-12b | 66 | 10.7 | 1,430 (peak 1,553) | 3 |
| slice-13, slice-14a | 43 | 7.6 | 1,562 (peak 1,788) | 3 |

**Proposal: `PART_STARTS = ["slice-03a", "slice-07a", "slice-10a"]`.** Estimates (each folder's measured growth, plus
about 250 MB of warm-up on a part's first folder):

| Part | Folders | Tests | Minutes | Heap at its end | Peak |
| --- | --- | --- | --- | --- | --- |
| 1 | fixes … slice-02c | 111 | 22.4 | 1,353 (measured) | 1,353 (measured) |
| 2 | slice-03a … slice-06b | 135 | 23.2 | about 1,260 | about 1,350 |
| 3 | slice-07a … slice-09 | 141 | 18.5 | about 1,270 | about 1,400 |
| 4 | slice-10a … slice-14b | about 166 with 14b | about 27 | about 1,160 | about 1,400 |

Part 4 gets the new slices, so it starts with the most room. The full run gets one more server start (about 50 s). The
closing's run (`E2E_MEMORY_LOG=1`) checks the estimates; the cuts move if a part ends far from the others.

### Q8. The data model

**A2 confirmed:** no table, column, constraint or local data file format changes. Every change is in the browser
(`row-saves.ts`, `look.tsx`, the tabs, the menu, `source-changes.tsx`, `ModelCanvas.setNames`, `leave-guard.ts`) and in
two kinds of actions' answers (`{ versions: true }` for "look-all" and for the label's rename and delete: the shape of an
answer, not stored data). No domain command or message changes. The seed is unchanged (A4).

## Items, decisions and criteria checked

| Item / criterion | Verdict |
| --- | --- |
| Item 1 (four parts) | Holds: `PART_STARTS` gets a third entry; `scripts/e2e.ts` reads `PART_COUNT`, so `--part 4` and the summary need no other change; F18 adds a unit test. Cuts: Q7. |
| Item 2 (one chain) | Holds with F1 (more writers), F2 (the names switch holds instead of sending a version), F3 (the cut rule). |
| Item 3 (delete) | Holds with F6. |
| Item 4 (the rename keeps its draft) | Holds with F5; "locked: editable with Not saved" and "not found: D-38" are `useDraft`'s and the canvas page's existing behaviour (`missingCanvasWay`). |
| Item 5 (a popover under the tab) | **Does not hold** (F4); proposal: the line inside the tab. |
| Item 6 (the look after a refusal) | Holds with F7. |
| Item 7 (holding the source) | Holds with F3, F8, F9. |
| Items 8–9 (the warning) | Hold with F10–F12. |
| Item 10 (unchanged) | Holds, except F1's answers with versions (no domain change). |
| O1 | Holds with F2. |
| O2 | Holds except the line's place (F4). |
| O3–O8 | Hold. |
| S14B-01, -02, -03 | Testable as written (S14B-03: the last canvas's item is disabled; the refusal is the domain's). |
| S14B-04 | Testable with `renameCanvasElsewhere` (F15). |
| S14B-05 | Needs another session (F15); the PRD's fallback applies. |
| S14B-06 | Testable: archive meanwhile through the domain (slice 13's helpers); `locked` as slice 13's locked case. |
| S14B-07 | Testable: archive meanwhile, then a grid switch: the stored grid with the toast. |
| S14B-08 | Testable with `holdUntil` on the action's request; "another source's column is not held" with the seed's second system. |
| S14B-09 | Testable with F14; "a save held on its way" with `holdUntil`. |
| S14B-10 | Testable: a link (`tab-home`) with a draft: no dialog, the draft gone (D-66). |
| S14B-11 | Testable; plus F18's unit test. |
| S14B-12 | Holds: nothing is drawn on the canvas, and the tab bar is outside the viewport's counts; the page totals do not change while no line shows. |
| S14B-13 | — |

## Differences between the prototype and the app that the slice touches

- **The tab's rename:** the prototype renames on a double-click, saves on Enter or leaving, and cancels on Escape; the app
  does the same. New in the app (D-66): the field stays until its answer, and after a refusal shows the line or "Not
  saved" inside the tab (F4). The prototype has no conflicts.
- **Leaving a page:** the prototype has no warning; the browser's own dialog is new (O6).
- **The look, the names switch, the delete and the change actions:** no visible difference.

## New and changed user-visible texts (proposals, for approval)

None. The tab uses slice 13's texts ("Changed meanwhile to:", "Use this", "Keep mine", "Not saved", "Not saved. You can
still copy it.", the toast "Someone changed this meanwhile."). The warning is the browser's own text. An empty name
stays silent as today (Question 7).

## Questions for Łukasz

1. **The tab's line (F4):** inside the tab after the field, on one row (recommended), instead of a popover under the tab?
   The alternatives: a strip under the tab bar's left edge (detached from a tab further right), or a Radix popover under
   the tab (it reads layout when it opens).
2. **The cut rule (F3):** a refusal cuts only the checked rows' waiting saves, also for slice 10a's held rows?
3. **The source hold (F8, F9):** the whole source system as agreed, with step 3's bar (under 20 ms per action on 20,000
   columns), and the narrow hold only if it fails?
4. **The writers the PRD missed (F1):** "look-all" on the chain (held, with versions), and the label's rename and delete
   answering with versions: in this slice?
5. **The focused fields that count (F11):** fields that save a row, the note editor and the rich-text dialog; not the
   search, the zoom, fields that create something, the import wizard, sign-in and people forms?
6. **The names switch (F2):** it stays on the canvas's queue and holds the canvas row on the chain while on its way,
   instead of "sending the newest version"; D-66's addition reworded ("…save on one chain, so none is refused because
   of another")?
7. **An empty canvas name:** back to the stored name silently as today (recommended), or with "Enter a name."?
8. **The concept's rename in the tree (F17):** leave it as F13 made it, and note the line for it in `docs/ideas.md`?
9. **The four parts:** `["slice-03a", "slice-07a", "slice-10a"]`?
