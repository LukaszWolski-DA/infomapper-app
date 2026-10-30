# Slice 10c – acceptance

Status: **step 1 answered (Łukasz, 30 October 2026); step 2 (data) in progress.** The PRD is updated to the answers.

- Tag `slice-10b` is at `6d1a251`, as A1 says. Branch `slice/10c-copy-attribute` was made from that tag.
- The PRD is copied unchanged from `~/Downloads/slice-10c-copy-attribute.md` (23,900 bytes, 30 October 2026; the only
  file with that name). Commit "docs: slice 10c PRD".
- `.data/dev-db.json` (KB) was not touched. No seed, reset or anything that opens the local file was run.

Step 1 checks every item, P1–P12, D-63, A1–A4 and every criterion against the code, `docs/decisions.md` and the earlier
slices' acceptance docs. The agreed points (P1–P5, P7, P9, P10) stand; F1–F4 say what they cost in the code.

## Summary

| # | Finding | Proposal |
| --- | --- | --- |
| F1 | **Undo and redo can leave a copy out of step** (Q4). `revertChangeGroup` (`src/domain/commands/undo.ts`) writes back only the rows its change group recorded. Five ways it breaks P2: (a) undo of a type change on the original made *before* the copy was pasted; (b) undo of a type change after a new copy was pasted since; (c) redo of a paste after the original's type changed; (d) undo of "Stop following" after the original's type changed; (e) undo of an original's delete after the copy's followed fields were edited (item 9). The PRD assumes that following happens only in `updateAttribute`. | **One rule in one place:** `followOriginals(attributes after the writes, written ids)` in a new `src/domain/model/copies.ts`. After the writes, every live copy below a written attribute gets its original's followed fields, in the same change group. A copy that is already in the write set has that write changed; it is not written twice. `updateAttribute` and `revertChangeGroup` both call it. The copies it adds are rewritten rows, as a renumbered sibling is (no version from the browser). The undo action already returns every written version (`src/app/_actions/undo.ts`, `writtenVersions`). Question 1. |
| F2 | **Item 9 contradicts itself.** Item 9 makes a copy's followed fields editable while its original is deleted, and then says Undo of the delete makes the copy "follow again with no further write". If the copy was edited meanwhile, the two now differ, and F1 would overwrite the modeller's edit on Undo. | **A copy with a link never edits its followed fields**, whether the original is live or deleted. To edit them, the modeller uses "Stop following". Undo of a delete then writes nothing in the usual case, and nothing is overwritten. Item 9's "become editable" and S10C-05's "with editable type fields" change. Question 2. |
| F3 | **The working context would label every copy** (D-26). `contextTargets` (`src/domain/model/live.ts`) labels every attribute an action changes, except a change of `sort_order` only. The copies that following writes would be labeled too, and a label brings cards onto live canvases (D-10, D-11). | The copies written by following are left out of `contextTargets`. A list on the write set does this, next to `mainTargets` (`src/domain/changes.ts`), e.g. `followers`. The original is labeled as today. The new attribute of a paste is labeled in an active context, as "Add attribute" is. That is D-26, not copying labels (P3). Question 3. |
| F4 | **Returned versions alone do not stop a false conflict** (S10C-09, Q4). `rowSaves.answer` (`src/ui/row-saves.ts`) helps only the saves sent *after* the answer. A copy's delete sent while the original's save is still on its way reads the copy's old version and is refused as stale. Slice 10a's `saveRows` solves exactly this with held rows. | A save of a followed field on an original goes through `saveRows`: the original checked, and every live copy below it held (the page knows them from `copied_from_attribute_id`). `updateAttributeAction` (`src/app/_actions/model.ts`) answers with `{ versions: true }`. Saves of other fields (name, definition, keys) stay `saveRow`. |
| F5 | **The domain must refuse a followed field on a copy, not only the panel.** `updateAttribute` (`src/domain/commands/attribute.ts`) takes `type` and `isPii` from any caller. | `updateAttribute` refuses `type` and `isPii` on an attribute with `copied_from_attribute_id` set (F2: original live or deleted). Text in "New texts". A unit test and S10C-08's direct call. |
| F6 | **The page cannot name a deleted original.** `store.model.load` sends live rows only (`src/data/ports.ts`: "Every live model row"; `src/data/local/store.ts`). Item 9's "Copied from {entity}.{attribute}, which was deleted." needs the deleted attribute's name and its entity's name, and the entity may be deleted too (D-47). | `model.load` adds a small list `lostOriginals`: `{ id, name, entityName }` for each deleted original that a live copy points to. One pass over attributes and entities, in the local adapter; nothing in the domain. The alternative is a text without names, "Its original was deleted.". Question 4. |
| F7 | **The app already asks before an attribute delete, with two clicks, not a dialog** (item 8, Q6). In the panel, `ConfirmDelete` (`src/app/_panels/fields.tsx`) shows "Click again to delete, with {also}". In the row's menu, the toolbox item's `confirm` (`src/app/_panels/canvas-host.tsx`) does the same. Both ask when the attribute has mappings (S1B-13). So "without copies the delete stays immediate" is true only without mappings too, and there is no "Delete" and "Cancel" pair anywhere for attributes. | Reuse the two clicks. Ask when the attribute has mappings **or** live copies, and add the copies to the `also` text. The panel's new "Copies" section (item 7) already names them above the button. No new dialog, and nothing changes for an attribute with neither. Question 5. |
| F8 | **D-47's preview gets one row** (Q6). `entityImpact` (`src/domain/model/impact.ts`) builds the numbers; `DeleteEntityDialog` (`src/app/_panels/delete-entity-dialog.tsx`) draws the rows. `entityImpactAction` loads the live model, which is enough. | `EntityImpact.copies`: the live copies in *other* entities whose originals are among the entity's attributes, by "{entity}.{attribute}". Copies in the same entity go with it and are counted as attributes. The row is shaped like `requirementsImpactRow`: at most five names, then "and n more". |
| F9 | **The link must not be a parent in undo** (Q5). `PARENTS` (`undo.ts`) makes `consistent()` refuse a live row whose parent is deleted, and a deletion whose row still has live children. With `copied_from_attribute_id` among them, Undo could not bring back a copy whose original is deleted, nor delete an original that has copies. | Leave it out of `PARENTS`. The local adapter's rule is `copied_from_attribute_id: "attribute"` in `RULES.attribute.foreignKeys` (`src/data/local/schema.ts`). `findViolation` checks against every row, deleted ones included, so a lost reference passes, as it does in Postgres. |
| F10 | **Undoing a change recorded before the new column drops the column from the row.** `revertChangeGroup` writes `e.before_image` as the new row; `applyWrite` (`store.ts`) stores it as it is. KB's whole history predates format 10, so after such an undo an attribute would have no `copied_from_attribute_id` key at all (undefined, not null). `unchangedSince` already reads an absent column as null, but only when comparing. | In `revertChangeGroup`, a column of the current row that the image lacks is written as null. One line and a unit test. It also covers slice 7a's and 7b's added columns, which have the same gap today. |
| F11 | **Format 10 needs no module of its own** (Q7). The current format is 9 (`DEV_DB_FORMAT`, `schema.ts`). Format 9's step is inline in `upgradeDb` (`src/data/local/file.ts`); `upgrade-8.ts` is the only upgrade module. `readDb` writes the file back only when `was < 9`. | An inline step, like 5 → 6: `for (const a of db.attribute) a.copied_from_attribute_id ??= null`, then format 10. The write-back condition becomes `was < DEV_DB_FORMAT`. No change events, and no log line, since there is nothing to report. The tests go in a new `src/data/local/upgrade-10.test.ts`. Reading an absent field as null instead would put `?? null` into every reader, so the upgrade is simpler. |
| F12 | **Attribute names need not be unique, and nothing warns** (Q1). The data model sets no rule, the local adapter has no unique index on attribute names, and `duplicateNameWarning` (B-25) is for entities only (`src/domain/commands/entity.ts`). There is one catch: `createAttributeFromColumn` maps a dropped column to an existing attribute with the column's name (`attributeNamedAfter`, case ignored). With two attributes of the same name it picks the first. | The paste keeps the name in every case, with no suffix. The panel opens with the name selected, so the modeller types `manager_id` at once. When the entity already has an attribute of that name (case ignored), the paste's toast says so. No new domain rule. Question 6. |
| F13 | **The clipboard is a value store in the page** (Q3). A module-level store survives Next.js's client navigation (canvas tabs, the homes) and is empty after a reload, as `rowSaves` is. | `src/app/_components/attribute-clipboard.ts`, a `createValueStore` (`src/canvas/value-store.ts`; `app` → `canvas` is allowed) holding `{ workspaceId, attributeId }` only. Menus read the name and entity from the page's index (`ModelIndex`), so a rename shows. "Paste" shows only in the same workspace and only while the original is in the page's model, so switching workspaces needs no clearing. The paste sends `{ entityId, attributeId }`; the server reads the rest. |
| F14 | **The paste is a new command.** Nothing today creates an attribute from another attribute. | `pasteAttribute` in `attribute.ts`, with state `{ entity, original, attributes }` and permission `model.edit` (role and archive through `begin`). It refuses an original that is not live in this workspace, and the browser then empties the clipboard. The copy goes last (`nextSortOrder`) with item 5's fields, in one change group. The host selects the new row, opens the details panel (D-54: a menu action that leads to a name to type) and focuses the name with `setNameFocus`, as the entity panel's "Add attribute" does (`entity-panel.tsx`). |
| F15 | **There is no attribute rule for live canvases** (Q2). D-11 is about adding and removing *cards*, and attributes are added in the entity panel only. On a live canvas, cards and their header menus are editable for editors (`canvas-host.tsx`, `cardItems`). | No special rule: the paste works on a live canvas as "Add attribute" does. On a context card, which shows only relevant rows (`live.relevantRows`, `card-data.ts`), the new row may not show unless the active context labels it. That is today's behaviour for "Add attribute". |
| F16 | **Stop following fits `updateAttribute`.** | `updateAttribute` gains `stopFollowing: true`, which clears `copied_from_attribute_id`. It needs no new action, and it saves through `saveRow` on the copy. `stopFollowing` with no link is "Nothing to change.". |
| F17 | **Following cannot loop, and it is linear** (Q4). `copied_from_attribute_id` is set only on insert, pointing to a row that exists already (so it is older). "Stop following" only clears it, and Undo writes back earlier values, so the links form a forest by construction. | `followOriginals` builds a `childrenOf` map once from the attributes `modelCommand` already loads, walks depth-first, and keeps a visited set as a guard anyway. O(attributes) per save; no measurement. |
| F18 | **The earlier specs do not change** (S10C-12, Q10). The seed gets no copies (A4), so S1B-13 and D-47's specs (`S1A-10`, `S1A-11`, `S1B-07`, `S3A-12`, `S10A-04`, `S10A-11`) see the same pages. Only code that builds `Attribute` rows by hand gets the new field, which typecheck enforces: the seeds (`seed-model.ts`, `seed-large.ts`), `requirement-index-synthetic.ts`, the fixtures (`src/domain/__fixtures__/domain.ts`, `import.ts`), six unit test files and one spec that builds a row (`e2e/slice-07c/S7C-02.spec.ts`, the field only). | S10C-12 reads: "earlier specs pass unchanged in behaviour; code that builds attribute rows gains the column". They run in step 4 as the PRD lists, and none is expected to change. |
| F19 | **The canvas: as the PRD assumes** (Q8, P12). The row's FK badge exists (`card-data.ts` `fk: a.is_foreign_key`, `CardNode.tsx` `<b>FK</b>`). The key column widens only for a row that is both PK and FK (`dual`), and a copy has PK false. The guard's baseline `.data/measure/s9-14-baseline/slice-08.json` is on disk. | No change. S10C-11 is as written. |
| F20 | **The page's data grows by one field per attribute** (Q9). The whole `WorkspaceModel` reaches the page. `"copied_from_attribute_id":null` is 31 bytes of JSON per attribute: about 25 KB uncompressed on "Performance test" (about 800 attributes), against rows of about 400 bytes. | No gate. Step 2 reports the canvas page's payload before and after on "Performance test". |
| F21 | **The plan in `docs/ideas.md` still says "tied to a relationship".** "The plan after slice 10a" describes 10c as "a foreign key tied to a relationship". The entry "Copying an attribute to another entity" asks "copy to" by picking an entity. | Both are updated in the closing (PRD section 10), as P4 and P5 agreed. No conflict with the code. |
| F22 | **The undo toasts name the change in general words.** `changeLabel` (`src/domain/model/change-label.ts`) gives "Create attribute" for a paste and "Change attribute" for following and for Stop following. | Keep them; no new texts. |

## Q1. Names

- Attribute names are **not unique** in an entity. The data model (`docs/data-model-v2.md`, section 4) and the migration
  have no rule, the local adapter's `RULES.attribute` has no `unique`, and `addAttribute` gives every new attribute the
  name `new_attribute`.
- **No warning.** B-25's `duplicateNameWarning` is for entities only (`createEntity`, `updateEntity`).
- **Proposal (F12):** the paste keeps the name. A clash (case ignored) adds one clause to the toast, and the panel opens
  with the name selected. Same entity: "employee_id" becomes a second "employee_id", which the modeller renames to
  "manager_id" straight away. A "_copy" suffix would be a rename the modeller has to undo in the foreign key case,
  which is the common one.

## Q2. Menus and rights

- **Both menus are built in `useCanvasHost`** (`src/app/_panels/canvas-host.tsx`): the row's menu in `items()` at
  `t.kind === "row" && card.kind === "ent"`, and the card header's in `cardItems()`. The menu is drawn by `Toolbox`
  (`toolbox.tsx`).
- **Rights:** `editable` comes from the page (owners, admins and modelers, workspace not archived). Today the row's menu
  offers editors the moves, "Map from a column…" and "Delete attribute", and everyone Focus. Readers and reviewers get
  only Focus and the headings.
- **Where the items go:**
  - "Copy" goes after "Map from a column…", behind `editable`.
  - "Paste attribute “{attribute}”" goes in `cardItems` for an entity card, behind `editable`, after "Relate to itself".
  - The server checks again (`begin(access, "model.edit")`: role and archive).
- **Live canvases:** no attribute rule (F15).
- **"Copy" in the attribute's panel:** not proposed, as the PRD says. A panel button "Copy" next to "Delete attribute"
  would be one line if Łukasz wants it later.

## Q3. The clipboard

- **Where it lives:** a value store in the page (F13). There is no "UI store" across pages today; `rowSaves` and
  `focusOn` are the same kind of module-level state.
- **Switching workspaces:** nothing to clear. The store holds the workspace id, and the paste item shows only there.
- **What a paste sends:** `{ entityId, attributeId }`. The server reads the original and its entity.
- **A deleted original:** the paste item shows only while the original is in the page's model. A delete in another
  session is refused by the server with item 4's text, and the browser then empties the store.

## Q4. Following

**Every path that can change a followed field** (`data_type`, `custom_type`, `type_length`, `type_precision`,
`type_scale`, `is_pii`):

| Path | Writes followed fields? | In slice 10c |
| --- | --- | --- |
| `updateAttribute` (the panel's type select, Length, Precision, Scale, custom name, the Personal data flag) | yes | on an original: follows (F1); on a copy: refused (F5) |
| `revertChangeGroup` (undo and redo) | yes, from images | follows (F1) |
| `pasteAttribute` (new) | on its own new row | copies them once |
| `addAttribute`, `createAttributeFromColumn` | on new rows only; a name clash maps to the existing attribute without writing it | none |
| `reorderAttribute` | `sort_order` only | none |
| `deleteAttribute`, `deleteEntity` | `deleted_at` only | none (the copies keep their link) |
| Imports, source-change actions (`mapToAttribute` and the others), classifications | never write attributes | none |

- **Where it belongs:** in the domain, as one function (`followOriginals`, F1), called by the two commands that can
  change a followed field. The action layer stays as it is (AD-23).
- **Copies of copies:** the walk goes depth-first from each written attribute through `childrenOf` and sets every
  descendant to its *own* original's values. The written attribute's values therefore reach the grandchildren through
  the child. The links form a forest (F17); a visited set guards anyway.
- **The change group and undo:** one group. Undo of it reverts the original and every copy, because they are all in its
  events. A copy changed in between makes the undo refused ("changed afterwards"), as for any row.
- **The versions:** `updateAttributeAction` with `{ versions: true }`, and `saveRows` with the copies held (F4). Undo and
  redo already answer with every written version.
- **Any other path to a copy's followed field:** none in the code except `updateAttribute`, which refuses it (F5).

## Q5. Deleting

- **Deletes are soft everywhere.**
  - A `remove` write is typed for link tables only (`RemoveOf<LinkTable>` in `src/domain/changes.ts`).
  - `applyWrite` (`store.ts`) splices a row only for `remove`.
  - No purge exists, and AD-09's workspace delete is not built.
  - `reset-dev-data` and the e2e reseed replace the whole file.

  No path hard-deletes an attribute that a copy points to.
- **Undo restores an original** from its delete event's before-image (`deleted_at` null). F9 keeps it free of the
  parent check; F1 brings copies back in step if they differ.
- **The self FK:**
  - The migration's column is `copied_from_attribute_id uuid references attribute (id)`, nullable, with no
    `on delete` clause. Postgres checks a `NO ACTION` FK at the end of the statement, so the later workspace delete can
    remove all of a workspace's attributes in one statement.
  - No RLS line, since this is not a new table.
  - The local adapter gets the rule of F9, and the seed gets nothing.

## Q6. The previews

- **How an attribute is deleted today:** in the panel and in the row's menu, at once with Undo in the toast, or after a
  second click when it has mappings (S1B-13; F7). Both go through `saveRow` with `deletes: true`.
- **Item 8:**
  - The same two clicks, armed also by live copies; the `also` text names the count (F7).
  - Without mappings and copies, nothing changes.
  - The success toast adds the copies.
  - The server needs no change: `deleteAttribute` leaves the copies as they are.
- **D-47:** `entityImpact` and one row in `DeleteEntityDialog` (F8).

## Q7. The local data file

- **The current format is 9** (`DEV_DB_FORMAT = 9`, `src/data/local/schema.ts`), from slice 8. There is no later one.
- **The pattern:**
  - Formats 3 to 7 and 9 are inline steps in `upgradeDb` (`src/data/local/file.ts`); only format 8 has a module
    (`upgrade-8.ts`), because it writes rows and a report.
  - Format 9's step is tested in `organization-store.test.ts`.
- **Upgrade, or read absent as null:** an upgrade (F11). Reading an absent field would put `?? null` into every reader
  and into the undo images (F10). The format number moves to 10 either way. `readDb`'s write-back condition moves with
  it, so the upgraded file is written at once, as before.
- **The backup:** step 2 copies `.data/dev-db.json` to `.data/backups/dev-db-<yyyymmdd-hhmm>.json` and
  `kb-model-latest.json` before anything opens it (CLAUDE.md, "Łukasz's test model").

## Q8. The canvas

Yes: an attribute row shows an FK badge from `is_foreign_key` (F19). A pasted copy of a primary key shows it, as any row
with the flag does: one `<b>` inside the row's existing key span, no new element type. The seed has no copies, so the
guard is expected equal to `slice-08.json`.

## Q9. Other readers of attributes

| Reader | Must know the column? |
| --- | --- |
| The attribute panel (`attribute-panel.tsx`) | yes: "Follows…", "Copied from…", "Copies", Stop following, read-only fields |
| `ModelIndex` (`model-index.ts`) | yes: `copiesOf` (built once per load), for the panel, the menus and F4's held rows |
| The canvas host's menus (`canvas-host.tsx`) | yes: Copy, Paste, the delete confirmation |
| `entityImpact` and its dialog | yes (F8) |
| `revertChangeGroup` | yes (F1, F10); not in `PARENTS` (F9) |
| `contextTargets` (`live.ts`) | yes (F3) |
| The local adapter (`schema.ts` RULES, `upgradeDb`, `model.load` for F6) | yes |
| The schema check (`tests/schema/domain-tables.ts`) | reads the type itself; nothing to add |
| Seeds, fixtures, `requirement-index-synthetic.ts` | the field only (F18) |
| The cards (`card-data.ts`), the tree, search (entities and tables only), change labels | no |
| Imports (`src/domain/import/`), model consistency, the changes to resolve | no: they read attributes for mappings only and never write them |
| The Data Vault reading (`data-vault-reading.ts`) | no: it reads source tables |
| Business key suggestions (AD-28, `businessKeyHint`) | no: they read the attribute's mapped columns; a copy has none |
| Requirement index and coverage | no |
| Exports, baselines | none exist (inventory: baselines decision only, workspace export not built) |

**The page's data:** one null per attribute (F20).

## Q10. Earlier tests and docs

- **Specs:** none change (F18). Step 4 runs the earlier specs of attribute rows, the attribute and entity panels and the
  deletes, as the PRD lists: S1B-07, S1B-08, S1B-13, S1B-14, S1A-10, S1A-11, S3A-12, S4A-10, S10A-04, S10A-11.
- **Unit tests that grow:**
  - `attribute.test.ts`: paste, following, the refusals, Stop following;
  - `undo.test.ts`: F1, F9, F10;
  - `live.test.ts`: F3;
  - `impact.test.ts`: F8;
  - `row-saves.test.ts`: F4's held copies, if the helper changes;
  - the upgrade test.
- **Docs**, as PRD section 10, plus:
  - `docs/data-model-v2.md`: section 2's deleting paragraph (the link survives a soft delete) and section 11's rule list;
  - CLAUDE.md: the clipboard store, `followOriginals`, the held copies and format 10.

## Items, decisions and criteria checked

| Item | Result |
| --- | --- |
| 1 Column | Correct. The PRD's FK and nullability are right; F9 and F11 add the adapter's rule and the upgrade. |
| 2 Format | Format 10 (F11). "No change events, as format 9's" is right. "One log line" was slice 8's; here there is none. |
| 3 Copy | Correct. The row's menu is in `canvas-host.tsx` (Q2). The clipboard holds ids only (F13); the name comes from the page. |
| 4 Paste | Correct, with F14 and F15. "When it shows" adds: while the original is in the page's model. |
| 5 What is copied | Correct. The definition is copied as stored (sanitized already, AD-17). |
| 6 Following | Needs F1 (undo), F3 (labels), F4 (saveRows), F5 (refusal). "Other fields stay the copy's own" is right. |
| 7 Panels | Correct; `goAttribute` (`inspector.tsx`) already selects a row or an element, both history places (D-38). The "Copied from" of a deleted original is plain text, as it has no place. |
| 8 Delete | Two clicks, not Delete and Cancel (F7); D-47's row (F8). |
| 9 Lost original | Needs F6 (names) and F2 (read-only). |
| 10 Stop following | `updateAttribute` (F16). "Become editable" holds. |
| 11 Canvas | Correct (F19). |
| 12 Unchanged | Correct for relationships, mappings, requirements, imports and Data Vault; the working context changes (F3). |
| P1–P5, P7, P9, P10 | Agreed; nothing in the code prevents them. P2 costs F1–F5. |
| P6 | Holds with F6 and F7: the trace is in the panel; the consequences are the two clicks. |
| P8 | Correct: `is_foreign_key` = the original's `is_primary_key`. |
| P11 | One column, format 10. Confirmed (A2). |
| P12 | Confirmed: the guard only. |
| D-63 | Its "first lists them" becomes the two clicks with the count; "read-only" also while the original is deleted (F2). Text proposed below. |
| D-01, D-11, D-36, D-38, D-47, D-52, D-54, D-61, D-62 | D-01: a copy's mappings are type-checked after a followed change with no new code. D-11: F15. D-36: last. D-38: Q2 and item 7. D-47: F8. D-52: "Copy" is a row action and "Paste" a card action, as D-52 asks. D-54: F14. D-61: the same-entity paste needs nothing from it. D-62: untouched. |
| AD-05, AD-09, AD-12, AD-13, AD-23 | `begin(access, "model.edit")`; versions through the chain (F4); one change group per action; the domain writes. |
| AD-27, AD-28 | All five type parts follow; BK is false on a copy, and with no mappings no BK suggestion shows. |
| AD-31 | `npm run schema:check` compares column types and nullability only, not FKs (`tests/schema/compare-schema.ts`). The FK is the migration's and the adapter's. |
| A1 | Confirmed (`6d1a251`). |
| A2 | Confirmed, with F6's read (no data change). |
| A3 | Confirmed; step 2 and the closing. |
| A4 | Confirmed; F18. |
| S10C-01 | Correct. |
| S10C-02 | Correct; "(Q1's naming)": the same name, and the toast's clash clause (F12). |
| S10C-03 | Correct; add "the copy's followed fields cannot be saved by a direct call" (F5). |
| S10C-04 | Correct. |
| S10C-05 | Change: "first shows its consequences" → "asks for a second click naming 2 copies; the button disarms after 4 s or on leaving it (no Cancel)"; "with editable type fields" → "its followed fields read-only with Stop following" (F2). |
| S10C-06 | Correct (F8). |
| S10C-07 | Correct. |
| S10C-08 | Correct; add the direct call of F5. |
| S10C-09 | Correct as a test; it needs F4, not only `answer`. |
| S10C-10 | Correct; add "an undo of a change recorded before format 10 writes the column as null" (F10). |
| S10C-11 | Correct. |
| S10C-12 | "Changed earlier tests: at least S1B-13's…" → none expected (F18). |
| New (proposed) | S10C-13 **Undo keeps copies in step**: undo of a type change made before a paste, redo of a paste after a type change, undo of Stop following after a type change: every copy shows its original's type (unit tests; one e2e for the first case). S10C-14 **The working context**: with a context on, a followed change labels the original only (unit). |

## Differences between the prototype and the app that the slice touches

The prototype has no copy and paste of attributes, so everything here is new (D-63). The slice touches these places,
where the app and the prototype already differ or will differ:

- **The row's menu** (prototype `ctxFor`, attribute row) gains "Copy". The app's row menu already differs: Focus, and
  the moves with their shortcuts.
- **The card header's menu** gains "Paste attribute “{attribute}”", next to slice 10a's "Relate to itself".
- **The attribute panel** (prototype `insAttr`) gains "Copied from" or "Copies", read-only followed fields with
  "Follows {entity}.{attribute}.", and "Stop following".
- **Deleting an attribute.** The prototype deletes at once. The app has asked since slice 1b when there are mappings,
  and now also when there are copies.
- **D-47's dialog** gains a row for copies elsewhere.

## New user-visible texts (proposals)

| Where | Text |
| --- | --- |
| Row menu | "Copy" |
| Toast after Copy | "Copied “{attribute}”. Paste it with “Paste attribute” in an entity card's menu." |
| Card header menu | "Paste attribute “{attribute}”" |
| Toast after a paste | "Pasted “{attribute}” into {entity}. Type its name now." With a clash (F12): "Pasted “{attribute}” into {entity}, which has another attribute of that name. Type its name now." |
| Paste refused | "The copied attribute no longer exists." |
| Followed field refused (F5) | "This follows {entity}.{attribute}. Change it there, or stop following first." |
| Panel, beside the type and Personal data | "Follows {entity}.{attribute}." |
| Panel, a copy | "Copied from {entity}.{attribute}" (a link) |
| Panel, a lost original | "Copied from {entity}.{attribute}, which was deleted." (F6; without names: "Its original was deleted.") |
| Panel, an original | section "Copies" with "{entity}.{attribute}" rows |
| Panel button | "Stop following" |
| Toast after Stop following | none (a field save) |
| Delete, armed (panel) | "Click again to delete, with 2 mappings; 2 copies stop following it" (the "with…" part only when there are mappings; one copy: "1 copy stops following it") |
| Delete, armed (row menu) | the same text in the item's `confirm` |
| Toast after the delete | "Attribute deleted together with 2 mappings. 2 copies no longer follow it." (each part only when it applies) |
| D-47 dialog row | "2 copies" — "lose their original: Order.customer_id, Invoice.customer_id" (one: "1 copy" — "loses its original: …"; more than five: "and n more"; none: no row) |
| D-63 | "An attribute can be copied to any entity, its own included: “Copy” in its row's menu, then “Paste attribute” in an entity card header's menu, one attribute at a time, by owners, admins and modelers in a workspace that is not archived. The copy is a full attribute of its entity. It starts with the original's name, definition and nullable, which are then its own, and gets no mappings, requirement links or labels. A copy of a primary key is flagged as a foreign key; nothing ties a copy to a relationship. The copy follows its original's data type with its parameters and Personal data, which are read-only in its panel while it is a copy; a change of them on the original, or an undo or redo, reaches every copy and their copies in the same step. Deleting an original that has copies asks for a second click naming how many copies stop following it; the copies stay, and each copy's panel says its original was deleted until Undo brings it back. “Stop following” detaches a copy." |

## Questions for Łukasz

1. **F1:** may undo and redo write the copies too, so that a copy always shows its original's type? This is
   recommended. The alternative is to refuse such an undo, which would refuse many ordinary undos.
2. **F2:** should a copy's followed fields stay read-only while its original is deleted, with "Stop following" to edit
   them? This is recommended. The alternative is the PRD's "become editable", where Undo of the delete then overwrites
   the edit.
3. **F3:** should copies written by following be left unlabeled by the working context, so that only the original is
   labeled? This is recommended.
4. **F6:** should the copy's panel name a deleted original, through a small list the page loads? This is recommended.
   The alternative is "Its original was deleted." without names.
5. **F7:** should an attribute delete ask with the existing two clicks (count of copies in the text) instead of a Delete
   and Cancel pair? This is recommended.
6. **F12:** should a paste keep the name, adding a clause to the toast when it clashes? This is recommended. The
   alternative is a "_copy" suffix.
7. **F10:** may `revertChangeGroup` write a column that an old image lacks as null? This is a small change in undo that
   all of KB's history needs.
8. Do you approve the new criteria S10C-13 and S10C-14, the changed S10C-05 and S10C-12, and the texts above?

## Łukasz's answers (30 October 2026)

- **F1: yes.** Undo and redo write the copies too, through `followOriginals` in `src/domain/model/copies.ts`, called by
  `updateAttribute` and `revertChangeGroup`, in the same change group. The visited set stays.
- **F2: yes.** A copy with a link keeps its followed fields read-only, whether its original is live or deleted. Only
  "Stop following" makes them editable. Item 9 and D-63 are corrected (PRD).
- **F3: yes.** Copies written by following are left out of the working context; only the original is labeled.
- **F4: accepted.** A followed-field save on an original goes through `saveRows`, with its copies as held rows.
- **F5, F8, F9, F11, F18: accepted.**
- **F6:** the panel names the deleted original ("Copied from {entity}.{attribute}, which was deleted."), from the small
  `lostOriginals` list in `model.load`.
- **F7:** two clicks, the existing pattern, armed also by copies. The second click's text names the copies, not only
  their count. The exact text and its rule for many copies are below.
- **F12:** the paste keeps the name. When the target entity already has an attribute with that name, the toast says so.
  The panel opens with the name selected.
- **F10: yes.** Undo writes a missing column as null.
- **S10C-13, S10C-14, the changed S10C-05 and S10C-12:** accepted as proposals (PRD updated).
- **The new texts:** accepted as proposals. Łukasz approves them finally in step 4, built.

### F7's text (proposal)

The armed button (panel) and the armed menu item (row's menu) read the same:

| Case | Text |
| --- | --- |
| Copies only, one | "Click again to delete; this copy stops following it: Order.customer_id" |
| Copies only, several | "Click again to delete; these copies stop following it: Order.customer_id, Invoice.customer_id" |
| Mappings and copies | "Click again to delete, with 2 mappings; these copies stop following it: Order.customer_id, Invoice.customer_id" |
| Mappings only | as today: "Click again to delete, with 2 mappings" |

- **Order:** by entity name, then attribute name, as "{entity}.{attribute}".
- **Many copies:** the first five are named, then "and {n} more" (n ≥ 1), the rule of D-47's requirements row
  (`IMPACT_KEYS_SHOWN`, `requirementsImpactRow`). Example: "…: A.x, B.x, C.x, D.x, E.x and 3 more".
- **The toast after the delete** counts only: "Attribute deleted together with 2 mappings. 2 copies no longer follow
  it." (one: "1 copy no longer follows it").

## Step 2: data (30 October 2026)

**The backup, before anything opened the local file:**
- `.data/backups/dev-db-20261030-1554-before-format-10.json`, 1,429,705 bytes, byte-identical to `.data/dev-db.json`
  (`cmp`; SHA-256 `a81d91a0…`).
- `.data/backups/kb-model-latest.json` was updated to the same copy.
- Read from the backup, not from KB's file: format 9, 118 attributes (117 live), 771 change events.
- Both backups are local only (`.data/` is git-ignored).

**KB is not upgraded.** `.data/dev-db.json` has the same SHA-256 after every run of this step. It waits for Łukasz's go.

**Built:**
- **The migration** `supabase/migrations/20261030160000_attribute_copied_from.sql`:
  - `copied_from_attribute_id uuid references attribute (id)`, nullable, with no `on delete` clause (Q5);
  - an index `attribute_copied_from_ix`, as every other foreign key of `attribute` has one.
- **The domain type:** `Attribute.copied_from_attribute_id: Uuid | null` (`src/domain/types.ts`).
  - Every place that builds an attribute row sets it to null: `addAttribute`, `createAttributeFromColumn`, both seeds,
    `requirement-index-synthetic.ts`, the two fixtures and `import.test.ts`.
- **The local adapter's rule:** `copied_from_attribute_id: "attribute"` in `RULES.attribute.foreignKeys`
  (`src/data/local/schema.ts`). It accepts a deleted original and refuses an unknown id (F9).
- **Format 10** (`DEV_DB_FORMAT = 10`):
  - an inline step in `upgradeDb` (`src/data/local/file.ts`): `copied_from_attribute_id ??= null` on every attribute;
  - no change events and no log line;
  - format 9's step now ends at 9 and the new step at `DEV_DB_FORMAT`;
  - `readDb`'s write-back condition is `was < DEV_DB_FORMAT` (F11).
- **Undo** (`revertChangeGroup`, `src/domain/commands/undo.ts`):
  - a column of the current row that the image lacks is written as null (F10);
  - `PARENTS` is unchanged, with a comment saying why the link is not in it (F9).

**Tests:**
- `src/data/local/upgrade-10.test.ts` (new, 4 tests):
  - a format-9 file gets the column as null on every attribute;
  - nothing else changes, every table's count is kept, and there is no change event and no log line;
  - the file is written back at once;
  - a format-10 file with a link is read as it is and not written again;
  - the adapter's FK accepts a deleted original and refuses an unknown id.
- `undo.test.ts` (3 new tests):
  - F10 on an undone edit and on a restored delete, with the images an event recorded before format 10 holds. The test
    fails without the fix (checked).
  - A copy's recorded link comes back on undo.
  - F9: a copy comes back while its original is deleted, and undoing an original's creation is allowed while a copy
    points to it.
- The current format in the earlier tests' assertions moves from 9 to 10, as slice 8 moved it from 8 to 9:
  - `organization-store.test.ts`, `requirement-store.test.ts`, `upgrade-8.test.ts`, `working-layer-store.test.ts`;
  - `e2e/slice-07b/S7B-12.spec.ts` and `e2e/slice-07c/S7C-02.spec.ts`, which read the e2e file's format after an
    upgrade.

**A correction to F18:** `S7C-02.spec.ts` builds source column rows, not attribute rows, so it needs no new field. It
changes only its format assertion (above).

**Runs:**
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm test`: 111 files, 1,439 tests, passed.
- **The AD-31 schema check** passed on a local Postgres 18.3 in the scratchpad, made with
  `initdb -E UTF8 --locale=C` and deleted afterwards. CI uses 17.
  - Result: "The schema matches the domain: 33 tables, 440 columns". The new column is `uuid`, nullable, with
    `FOREIGN KEY (copied_from_attribute_id) REFERENCES attribute(id)`.
  - A cluster in the Windows default encoding (WIN1252) cannot apply the earlier migrations (they contain "Ł"), hence
    `-E UTF8`.
- **e2e, what the step touched:** `S7B-12` and `S7C-02`, the specs that upgrade an older e2e file. Both passed, 57 s.

**F20's size, measured on a scratch file:** `npm run seed` and `npm run seed:large` into a scratch file, with
`INFOMAPPER_DEV_DB` set; it was deleted afterwards.
- The file is created at format 10.
- "Performance test" has 779 live attributes. Their JSON grows by 24,928 bytes, 32 bytes per attribute: 4.9 % of the
  attributes' JSON, uncompressed.
- This is the data, not the page's payload; step 4 can read the page itself if Łukasz wants.

**Not done in this step, as the brief says:**
- KB's upgrade.
- `docs/data-model-v2.md` (closing docs, PRD section 10).
- The commands: paste, following, Stop following (step 3).
