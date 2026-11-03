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

## Łukasz's answers to step 1 (3 November 2026)

1. **The tab's line (F4):** inside the tab, on one row after the field, with slice 13's texts; no popover.
2. **The cut rule (F3):** a refusal cuts only the checked rows' waiting saves, also for slice 10a's held rows. This is a
   **deliberate change of slice 10a's behaviour.** Example: a person moves the attribute "Email" up in Customer while a
   save of its sibling "Phone"'s definition waits behind the move (the move renumbers "Phone", so it holds it). Until
   slice 14a, a move refused as stale also cut the "Phone" save, which came back as cut ("Not saved" since slice 13)
   though nobody had changed "Phone". From slice 14b the "Phone" save is sent after the refusal with the newest version
   known and is stored, or refused on its own if "Phone" did change. Only the rows whose version a write sent (its
   checked rows) are cut by its refusal.
3. **The source hold (F8, F9):** the whole source; bar under 20 ms per action on 20,000 columns; the narrow hold only if
   the bar fails.
4. **The writers the PRD missed (F1):** "Use this look on all canvases" and the live canvas's writes on a label's rename
   and delete are in this slice (the chain, or answers with `{ versions: true }`).
5. **The fields that count (F11):** as proposed. The import wizard as an idea in `docs/ideas.md` (its progress is lost on
   a reload).
6. **The names switch (F2):** it holds the canvas row on the chain while on its way; `noteVersion` goes; D-66's addition
   reworded.
7. **An empty canvas name** goes back with the toast "Enter a name.", as the settings and the requirement panel since
   slice 13. Checked: an empty **project** name is not silent either: its home's field goes back with "A project needs a
   name." (`PROJECT_NAME_REQUIRED`, D-59's own text, `project-heading.tsx`, the domain's message too). So no field is
   silent after this slice and nothing more needs unifying for the behaviour; the texts differ only in that D-59 names
   the project. Left as D-59 says (changing it would change an accepted decision's text and S9's specs); if wanted
   later, "Enter a name." everywhere is a one-line change, noted in `docs/ideas.md`.
8. **The concept's rename in the tree (F17):** if the tab's compact line fits the tree's field at a small cost, step 3
   adds it; if not, a note in `docs/ideas.md`. Step 3's summary says which and why.
9. **The four parts:** `PART_STARTS = ["slice-03a", "slice-07a", "slice-10a"]`.

Also agreed: `S13-14` changes (it accepts the warning before its reload), and S14B-05 changes the look as a second
session through the domain.

The PRD is updated to these answers (status "step 1 answered").

## Step 2: the e2e parts and the canvas's row (3 November 2026)

### What changed

- **Four e2e parts** (item 1): `PART_STARTS = ["slice-03a", "slice-07a", "slice-10a"]` (`e2e/parts.ts`; the comments
  in `parts.ts` and `scripts/e2e.ts` say four). `npm run e2e -- --part 4 --list` lists 156 tests in 93 files (slice-10a
  to slice-14b). New unit test `tests/e2e-parts.test.ts` (F18): four parts, every folder in exactly one part and in
  order, each later part starting at its cut, a part 0 or 5 refused.
- **The cut rule** (item 2a, F3, answer 2): `RowSaves.saveRows` cuts on a cutting refusal only the waiting saves of its
  checked rows; a held row's waiting save is sent after it with the newest version known. `row-saves.test.ts`: the old
  case "cuts … held ones too" now says the opposite (the held sibling's save is sent with the version its field showed,
  for every cutting code including `locked`), and a new case: a hold with no checked row cuts nothing when refused.
- **The canvas's row on the chain** (items 2–3, O1):
  - **the look** (`look.tsx`): `rowSaves.save(canvasId, page's version, …)`; its own queue, `versionRef` and
    `noteVersion` are gone. After a refusal (or a cut) it shows the newest page's look (a ref to the page's look, kept
    in an effect: no render); a later page brings a newer one through the existing effect (F7, O3; the look's refusal
    spec S14B-07 is step 3's). The look stays in `src/canvas`, which may not import `useAction` (layers): it uses
    `rowSaves` directly. `SaveLookResult` carries the refusal's `code`;
  - **the names switch** (`ModelCanvas.setNames`): registers, at the click, a held row for the canvas
    (`rowSaves.saveRows([{ id: canvasId }], …)`) around its write on the canvas's queue; the write's answer gives the
    chain its `versions` (the canvas's included); `noteCanvasVersion` is gone, `namesVersion` stays (F2, answer 6);
  - **the rename in the tab** (`canvas-tabs.tsx`): `saveRow(canvas, …)`; the field's draft and line are step 3's;
  - **the tab menu** (`canvas-menu.tsx`): another canvas's look `saveRow(canvas, …)`; "Use this look on all canvases"
    `saveRows` over the project's canvases, all held; the delete `saveRow(…, { undoable: true, deletes: !others.length })`
    (F6: "Remove from this project" writes no canvas row and cuts nothing);
  - **the actions:** `applyLookToAllCanvasesAction` answers `{ versions: true }`; `labelCommand` takes
    `{ versions }`, and `renameLabelAction` and `deleteLabelAction` answer with every row they wrote, the live canvas's
    included (F1, answer 4).
- No domain command, message, data or seed change.

### Specs

`e2e/slice-14b/` (fixtures with a 1,536 × 864 window for the names' check boxes; helpers `canvasStored`,
`startRename`, `renameInTab`, and slice 2a's `canvasIn`, `canvasTab`, `openCanvasMenu`, `tabNames`):

- **S14B-01:** the layer switch's answer held (`holdUntil`), then a grid switch and a rename in the tab, then the answer
  released: layer, grid and name stored, the rename's toast, no conflict toast, no mark.
- **S14B-02:** the names switch's answer held, then a rename: both stored, no conflict toast.
- **S14B-03:** the background's answer held in Order management, then "Delete canvas" on Order lines & products: deleted
  (with the blue background), no conflict toast; the remaining canvas's delete item is disabled with its title.
- **S14B-11:** `tests/e2e-parts.test.ts` and `npm run e2e -- --part 4 --list` (above); the full run's four parts and
  one summary are checked at the closing.

Checked against the old code: with `canvas-tabs.tsx` as at `slice-14a`, S14B-01 and S14B-02 fail (the rename refused,
the tab keeps "Customer & orders"); restored afterwards. S14B-02 failed once in its first version on the rename's toast
read before the answer reached the page (the name was stored); it now waits for the toast (`expect.poll`), and passed
three times on its own.

### A bug found on the way: a click in a canvas tab's menu opened that canvas (since slice 2a)

The tab menu is a Radix portal, and React passes a click in a portal up its own tree: a click on any item of a tab's
menu ("Delete canvas", a background, "In projects") reached the tab's `onClick`, which pushed that canvas's address. For
the open canvas's own tab nothing showed; for another canvas's tab the page opened it. Before the chain the delete's
action started before that push, and the push then landed on the deleted canvas and was redirected with the "moved"
notice, which is how `S6B-06`'s deleted-canvas case met its toast. On the chain the delete is sent a moment later, after
the push, so Back went to the pushed entry and no notice came (S6B-06 failed 3 of 3 times on its own; traces kept in
`.data/measure/s14b-step2-fail/`, with the run's log). Fix (`canvas-tabs.tsx`): the tab opens its canvas only for a
click inside its own element (`e.currentTarget.contains(e.target)`). Checked: S6B-06's notice comes after Back.

**Still failing, for Łukasz's decision:** `S6B-06`'s last part, "Forward still works" after Back onto the deleted canvas.
Measured through the Navigation API (three runs, the same each time): after the delete the history is
`[sign-in, workspace, Order lines, Customer & orders]` at index 3; Back goes to index 2 (Order lines, deleted), the
background refresh after the traversal (`history-nav.tsx`, `router.refresh()`) finds it gone and the redirect to
Customer & orders **pushes** a new entry at index 3 over the one Forward led to, so Forward is disabled. A redirect with
`RedirectType.replace` in `leaveMissingCanvas` does not change it (tried and reverted): the push comes from Next.js's
handling of a refresh that ends at another address. Until now the test passed only thanks to the extra entry the bug
above left. Proposal: in step 3, at most half a day, make the page drawn after such a refresh replace the deleted entry
(for example `history-nav.tsx` stepping back over the pushed entry, or the `?moved=1` cleanup); if that does not work,
S6B-06 checks Forward only where it can work (Back onto a removed card, as its other case does) and a known limitation
says that after Back onto a deleted canvas Forward is gone.

### Runs (step 2)

- **CI:** `npm run lint`, `npm run typecheck` and `npm test` (124 files, 1,589 tests) pass.
- **Slice 14b specs:** S14B-01, -02, -03 pass (and again after the fix above).
- **Earlier specs the step touches** (one run, 89 tests in 16.0 min): the tabs' rename (`S0-04`, `S0-05`, `S0-06`,
  `S0-10`, `S6B-06`), the menu and the look (`S2A-03`, `S2A-05`, `S2A-09`, `S2A-10`, `S2A-11`, `S2A-13`, `S2C-02`,
  `S2C-04`, `S6A-02`, `S6A-03`, `S6A-10`), the names switch (`S11-01` to `S11-05`, `S11-10`, `S11-11`), a label's rename
  and delete (`S3A-04`, `S3A-13`, `S3B-08`, `S3B-12`, `S13-04`), all of slice 10a (held rows, the canvas's writes on the
  chain): 88 passed, 1 failed (`S6B-06`, above). After the fix: the tabs' and the menu's specs and slice 14b's (13 tests)
  pass; `S6B-06` fails 3 of 3 times on its Forward check only.

### Changed earlier tests

- `src/ui/row-saves.test.ts`: the held-row cut case now asserts slice 14b's rule (F3, answer 2).
- `S6B-06`: not changed yet (Łukasz's decision above).

## Łukasz's answers to step 2 (3 November 2026)

- Step 2 accepted. The fix in `canvas-tabs.tsx` stays: **a bug found in this slice, there since slice 2a** (a click in
  a canvas tab's menu, a portal, reached the tab's `onClick` and opened that canvas). It hid the Forward failure in
  `S6B-06`: the extra history entry it pushed was what made Forward look enabled.
- `S6B-06`: one attempt at a fix in step 3, at most half a day, with the hypothesis that the deleted canvas's page
  replaces the address on the client (`router.replace`) instead of a redirect from the server. If it fails: S6B-06
  checks Back and the notice, and Forward after Back onto a deleted canvas becomes a known limitation of D-38. D-38 is not
  changed.
- Then the rest of step 3 as the PRD and the step 1 answers say.

## Step 3: the rename, the look and the change-to-resolve actions (3 November 2026)

### S6B-06: the cause, and the hypothesis tested

**The hypothesis was tried and does not change it.** The canvas page caught the missing canvas on the app's own
navigations (`RSC: 1`, not your own action, a live project) and drew a client component calling `router.replace` instead
of the server's redirect (`LeaveOnClient`, `LeaveOnClientError` from `leaveMissingCanvas`). S6B-06 still lost Forward 3 of
3 times. Removed again; nothing of it is in the branch.

**The cause, from the Navigation API's `navigate` events with their stacks:** right after Back's `traverse` to the
deleted canvas, Next.js's router itself called `history.pushState` for **Customer & orders**, from a commit
(`commitHookEffectListMount`), before any redirect. That is the delete's own server action committing its router state:
the toast "Deleted the canvas …" is shown when the action answers, but the page it brings commits a moment later, inside
the action's transition. The test pressed Back between the two, and the late commit pushed the address the action was
started from over the entry Forward led to. Before this slice the stray push of the menu bug (step 2) came in between and
hid it.

**Change:** `S6B-06` waits for the delete's own page (its tab gone) before Back, as a person does; then Back, the
notice, and Forward all pass, 3 of 3 times on their own. No application change for it; D-38 unchanged. What remains is a
narrow timing case, for `docs/known-limitations.md` at the closing: Back pressed after a write's toast but before its
page arrives (a fraction of a second) can lose the entry Forward leads to, as Next.js commits the write's page with a
push of the address it was started from.

### What changed

- **The rename in the tab** (items 4–5, O2; `canvas-tabs.tsx`, `TabRename`): the field is slice 13's draft (`useDraft`,
  trimmed, `required`), saved with `saveRow` on the canvas row's chain, and stays open until its answer:
  - stored: the field closes; nothing to send (the stored name): it closes on leaving;
  - a conflict: the typed name stays with the line **inside the tab, on one row after the field** ("Changed meanwhile
    to: {name}", the name cut to 180 px with its full text in the title, "Use this", "Keep mine"); leaving the field
    saves nothing; "Keep mine" saves the typed name on the newest version (an ordinary undo step); "Use this" and Escape
    take the stored name and close the field;
  - stale while the name did not change: "Not saved"; leaving the field again saves it;
  - archived or forbidden: read-only, selectable, "Not saved. You can still copy it."; leaving or Escape closes it;
  - locked: "Not saved", editable;
  - not found: the field closes, the page goes where D-38 says;
  - empty: back to the stored name with the toast "Enter a name." (`NAME_REQUIRED`, answer 7).
- **`DraftLine`'s compact form** (`fields.tsx`, `inline`): the same texts and test ids on one row, no fold, buttons 22 px
  high in the 31 px tab. No popover, no layout read, nothing below the tab bar moves (F4, answer 1).
- **The look after a refusal** (item 6, O3): done in step 2 (`look.tsx`: the newest page's look after a refusal or a
  cut); its spec is S14B-07 here.
- **The change-to-resolve actions** (item 7, O4; `source-changes.tsx`, `useChangeRun`): every action runs through
  `saveRows`, the change's own row checked (its version from the chain) and the rows it names held
  (`src/domain/source-changes/held.ts`, with unit tests): the change's table and, for a move, its target column's table,
  all their columns, the mappings reading those columns with all their inputs, the change's mapping; "Approve again all"
  holds the mappings it approves. The answer's `versions` reach every row; with F3 a refusal does not cut the held
  saves.
- **The bar of 20 ms, measured** (`scripts/bench-source-hold.ts`, 20,000 columns in 2,000 tables, a mapping on every
  tenth column): holding **the whole source** (26,000 rows) cost 40.6 ms for the first action on a page as `saveRows`
  stood; two small changes to `saveRows` with the same behaviour (each distinct tail awaited once, one settled promise for
  all rows, no object spread per row) brought it to **28–30 ms on a fresh chain** and 13–21 ms once the chain knows the
  rows: **over the bar**. So, as answer 3 says, the **narrow hold**: 13 rows for a column's change, **0.4 ms**. The PRD's
  O4 said "the whole source"; the narrow hold is its agreed fallback.
- **The concept's rename in the tree** (question 8): **not in this slice, a note in `docs/ideas.md`.** The tab's compact
  line does not fit the left panel's narrow field ("Changed meanwhile to: …" with two buttons is wider than the panel),
  so the tree would need the panels' line under the field, and `NameInput` (which also creates concepts) moved to
  `useDraft` for renames only, with its own specs: not a small cost.
- **S6B-06** (above): the spec waits for the delete's own page before Back; no application change for it.

### Specs

- **S14B-04:** Anna renames the canvas through the domain; the tab's rename is refused: the line inside the tab with
  her name, the typed name kept; "Keep mine" stores it, and Undo brings hers back; again with "Use this", and with
  Escape: her name, nothing stored.
- **S14B-05:** Anna changes only the grid; the rename: "Not saved", no line; Enter in the field again stores it.
- **S14B-06:** archived meanwhile: "Not saved. You can still copy it.", read-only, the text selectable, nothing
  written; a locked organization (S13-10's way: Anna signs in to Retail Co with its password in another tab): "Not
  saved", editable.
- **S14B-07:** archived meanwhile, a grid switch: the stored grid on the canvas (`area-canvas`'s `data-grid`) with the
  toast; a second case for O3 itself: Anna stores another grid, the page's switch is refused as stale and the canvas
  shows **Anna's** grid, not the one from before the click.
- **S14B-08:** "Not needed" on CRM's `customer_segment` with its answer held; the column's note typed and left
  meanwhile is not stored until the answer, then stored with no conflict toast and no "Not saved". Checked against the
  code before this step: the note is refused (it fails). **A difference from the criterion:** "a save of another
  source's column in the same time is not held" cannot be seen in the browser: Next.js sends a page's server actions one
  at a time, so while one answer is held no other action leaves, whatever the chain does (the first version of the spec
  found the ERP note unsent until the release). The chain's side is covered by `held.test.ts` (another table's rows are
  not held) and `row-saves.test.ts`; the spec checks that the ERP note typed meanwhile is stored after the answer
  without a refusal.
- All of S14B-04 to S14B-08 passed in their first full run except S14B-08's first version (above); S14B-08 then passed
  three times on its own.

### Screenshots

`docs/prd/slice-14b-screens/step-3/` (`SCREENS=step-3 npx playwright test e2e/slice-14b/S14B-screens.spec.ts`): the tab
with the conflict line (`tab-conflict-*`), with "Not saved" (`tab-not-saved-*`) and read-only after the archive
(`tab-read-only-*`), light and dark.

### New and changed user-visible texts

None new. The tab uses slice 13's texts; an empty canvas name now shows the existing toast "Enter a name." (before: back
silently).

### A regression found by the earlier specs, fixed: `S0-06` and `?rename=1`

`S0-06` (a new canvas, its name typed, Enter, then at once the Home tab) failed 3 of 3: the page landed on the canvas
again. Before this step the field dropped `?rename=1` with `router.replace` on the blur, before the rename was sent, so
Next.js's router applied the rename's page before the Home link. With the field closing on its answer, the drop came
after the link, and the late page took the person back. Tried first: the drop guarded to the canvas's own address, then
with `history.replaceState`; neither was enough (the rename's late page itself pushed the canvas's address, as found
for S6B-06). Fix: `?rename=1` is dropped the first time the field is left, before its save is sent, as before
(`leftRename`); the field still closes on its answer. `S0-06` then passed 3 of 3 times. Traces of the failing run in
`.data/measure/s14b-step3-fail/`.

**The pattern behind S0-06 and S6B-06** (corrected after step 3: two mechanisms, see "Łukasz's answers to step 3"), for `docs/known-limitations.md` at the closing: a server action's page that
commits after a link or Back pushes the address the action was started from. The app's saves are answered in tenths of a
second, so a person meets it only by clicking a link right after a save; both specs now follow the order a person does.

### Runs (step 3)

- **CI:** `npm run lint`, `npm run typecheck` and `npm test` (125 files, 1,593 tests) pass.
- **Slice 14b:** S14B-01 to S14B-08 pass (15 tests with the tab specs below); S14B-08 three times on its own; the
  screenshots spec (6) passes.
- **Earlier specs:** the tabs (`S0-04`, `S0-05`, `S0-06`, `S0-10`), `S6B-06`, the menu (`S2A-09`, `S2A-10`, `S2A-13`),
  all of slice 7b's source changes: 54 tests, 53 passed, 1 failed (`S0-06`, above); after the fix `S0-06` 3 of 3, and
  `S0-04`, `S0-05`, `S0-10` with slice 14b's specs again: 15 passed.

### Changed earlier tests (the slice so far)

- `src/ui/row-saves.test.ts`: the held-row cut case asserts slice 14b's rule (F3, answer 2) (step 2).
- `e2e/slice-06b/S6B-06.spec.ts`: waits for the delete's own page (its tab gone) before Back (step 3).

## Łukasz's answers to step 3 (3 November 2026)

Step 3 accepted: `S6B-06` waits for the delete's page; the narrow hold for the change-to-resolve actions; `S14B-08` with
"another source" in `held.test.ts`; the concept's rename in the tree in `docs/ideas.md`; the `S0-06` fix. Before the
closing: explain in this document whether S0-06 and S6B-06 are one mechanism, and check whether any save on its way
followed at once by an in-app link (Home, breadcrumbs, another tab, the project switcher) can take the person back to
the page the save came from or lose Forward; if so, describe the reach in `docs/known-limitations.md` (no fix in this
slice); if not, say why `?rename=1` was special.

### S0-06 and S6B-06 are not one mechanism (a correction to step 3)

Step 3's report called them one pattern. Checked again, they are two:

- **S6B-06 is Next.js's:** Back pressed in the short window after a save's answer reaches the page and before its fresh
  page commits loses the entry Forward leads to (below).
- **S0-06 was the app's own:** the rename's field, closing on its answer, then called `router.replace` to the canvas's
  address to drop `?rename=1`. By then the person had clicked Home, so that replace took them back to the canvas. The
  guard tried in step 3 (only while `window.location` is the canvas's) did not help, because the address changes only
  when the link's page commits: right after the click it was still the canvas's. **Checked:** with no drop of
  `?rename=1` at all, `S0-06` passes 6 of 6 (`--repeat-each=3`, both tests). So `?rename=1` was special because it was
  the only place where the app itself navigated after a save's answer. Step 3's fix (the drop at the first leave,
  before the save is sent) stays; a navigation of the app's own after an answer is the thing to avoid (a note for later
  PRDs in `docs/known-limitations.md`).

### A save on its way, then a link or Back: what was checked

An exploratory spec (removed after; e2e dev server, Customer 360) made a save and then went elsewhere, in three timings:
with the save's answer held (`holdUntil`), at once after the answer reached the page, and 50, 150 and 400 ms after it.
Each run recorded where the person landed, then Back and Forward.

| After the save | Runs | Landed | Back, Forward |
| --- | --- | --- | --- |
| The Home tab (an entity's name in its panel) | 1 held, 4 at once | the project home | the canvas, the project home |
| The first breadcrumb (the workspace) | 1 held, 4 at once | the workspace home | as above |
| The project switcher, Order management | 1 held, 4 at once | Order management's home | as above |
| Another canvas tab (Order management, a grid switch) | 4 at once | the other canvas | as above |
| Back (the project's name on its home) | 1 held, 3 at once, 3 × 400 ms | the workspace home | Forward to the project home works |
| Back, 50 ms after the answer | 3 | the workspace home | **Forward lost** in 3 of 3 |
| Back, 150 ms after the answer | 3 | the workspace home | **Forward lost** in 2 of 3 |

**Links: no.** A link right after a save, the answer held or not, always landed where it led, with Back and Forward
intact. Why, in Next.js 16.3.8's router (`app-router-instance.js`, `dispatchAction`): a navigation marks the router's
pending action as discarded, so a save whose page has not been applied yet never applies it, and a revalidated
discarded action only asks for a refresh of the current page once the queue is idle.

**Back: yes, in a narrow window.** Back pressed after the answer reached the page but before its page committed (here
roughly 50 to 150 ms; a canvas page takes longer to commit than a home) keeps the person where Back took them but loses
the entry Forward led to. Held answers and Back after 400 ms keep it. It is the same with the breadcrumbs row's Back
button and Alt+←, which call the browser's Back. Described in `docs/known-limitations.md` ("Back right after a save can
lose Forward"), without a fix in this slice.
