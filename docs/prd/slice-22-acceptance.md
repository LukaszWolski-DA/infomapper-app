# Slice 22 – acceptance

PRD: [`slice-22-unknown-member.md`](slice-22-unknown-member.md). Branch `slice/22-unknown-member`.

## Step 1: the PRD checked against the code (9 November 2026)

### The starting point

- **The branch.** `slice/22-unknown-member` was cut from the tag `slice-21` (`5a56cac`, the merge of PR 50), which is
  `origin/main`. The local `main` was one merge behind it (`df77f59`) and was not used.
- **No run in this step.** No dev server, e2e run, unit test, lint or bench ran. One read-only count ran on KB (Q9): a
  copy of `.data/backups/kb-model-latest.json` (8 November 2026, 22:44) in the scratchpad, counts printed, the copy
  deleted. `.data/dev-db.json` was not read or written.
- **The two files from Łukasz's Downloads**, each checked with `cmp` after the copy and with `sha256sum` against the
  prompt's value, and committed with this document (neither has a carriage return, so the committed bytes are the
  files'):

  | File | SHA-256 | `cmp` |
  | --- | --- | --- |
  | `docs/prd/slice-22-unknown-member.md` (new, 17,013 bytes) | `971cdeeb05b30e909a5f903a18f613967d0b83510b373b3227737726edfcdae4` | equal |
  | `docs/prototype/infomapper-prototype-with-sources.html` (718,294 bytes, replaces slice 21's `2c135f3a…`) | `3b77c53a256a7492cfe80c510dd6f5afcda14d1d1dd0f86b5490a4641480c128` | equal |

- **The prototype is built on slice 21's.** Against the file at tag `slice-21` the new one adds 52 lines and removes 4,
  in 13 places, and every one is on the PRD's list (section 4): the CSS (`.uvlist`, `.uvrow`, `.uvbad`); `unkOn`,
  `unkDefault`, `unkValue`, `unkFit`; `cubeEntitySection` (the Dimensions row and the section's place); `unkSection`;
  `cubeIndex` (`C.uvals`, `X.uv`); `lookupFields` (the placeholder); `insChange` (`cube.uv`); the flag's click
  (`cube.unk`); `modelChecks` (C6: `unkval`, `nounk`); and the two D-76 lines (`pickVisible` through `pkNorm`; a row's
  press blurs a focused panel field). Nothing else differs. `modelChecks` (4 mentions), `INS_SWAP` (5),
  `nextConceptColor` (3) and `leftSrc` (2) are there, as often as at `slice-21`.

### Summary

The PRD's shape holds and the slice is small: one column, one table, one new command and one more field on an existing
one, a pure rule, a section in an existing panel, two check groups. Nothing in it needs a change to an extension point,
to undo, to the module cascade, to the save chain, to the canvas or to the local adapter's code. Twelve places need a
decision or a correction:

1. **F1, types.** The app has eight attribute types; the prototype and the PRD's value-fit rule know six. `datetime`
   and `custom` have no rule, no sentence and no default (question 1).
2. **F2, several primary keys.** "The key is simply the primary key's value" assumes one. The app allows several, and
   two of KB's four dimensions have two. `pkOf` takes the first (question 2).
3. **F3, the version of a value.** A value's row does not exist before the first value is typed and is deleted when it
   is cleared, so "each save with the newest version known" (D-59, AD-12) has no row to hold a version for the first
   save. A proposal below (question 3).
4. **F4, old rows.** `TableRules.defaults` cannot do it: the value depends on the role, and the adapter's checks read
   raw rows. It is `upgrade`, as slice 19's.
5. **F5, `cube_attribute.unknown_value` null.** "Null when not set" and "a row exists only while it holds a value"
   cannot both describe a live row. Proposal: the row is soft-deleted when cleared, as `cube_measure`.
6. **F6, readers' fields.** The PRD says "disabled"; the app's text fields are read-only for readers and reviewers.
7. **F7, the invalid mark.** `TextField` has no way to mark its input invalid. A small optional prop, in InfoMapper's
   `fields.tsx`.
8. **F8, the defaults are not checked.** "Unknown" is the default of a `String(3)` too; only typed values are checked.
9. **F9, five earlier specs change** because every seeded dimension has its unknown member on (decision 1b): the
   Dimensions rows' texts.
10. **F10, the demo's lookup has a stored "Unknown"**, so its placeholder is there but not seen until the value is
    cleared.
11. **F11, the checks' groups need a short text** each (the app's groups have one; the PRD gives none), and their
    place among the module's groups.
12. **F12, no full run in step 2 by the rule**, unless Łukasz reads "the table registry" as covering a module's own
    entries (question 4).

### Findings

| # | What | Where | Proposal |
| --- | --- | --- | --- |
| F1 | **Two types without a rule.** `LOGICAL_TYPES` is `string`, `integer`, `decimal`, `boolean`, `date`, `datetime`, `json`, `custom`; their words are `TYPE_WORDS` ("Datetime", "Custom" or the custom type's own name, `typeWord`). The prototype's `LTYPES` has six, and its Date rule accepts a time because it has no Datetime. | `src/domain/types.ts` l. 123; `src/modules/infocube/domain/keys.ts` l. 196–207; prototype `unkFit` | `date`: the PRD's rule as written (a time allowed). `datetime`: the same rule, "“{v}” is not a Datetime (YYYY-MM-DD HH:MM)". `custom`: every value fits. Defaults: both empty, as "every other type". Question 1. |
| F2 | **Several primary keys.** `cubeIndex.pkOf` is the first primary-key attribute in the entity's order; Add key and `FactKey.pk` use it. With two keys the Dimensions row would say "no match → " with the first key's value only. | `keys.ts` l. 112, 145 | Keep the first key (as Add key does) and say so in `known-limitations.md`. The alternative: every key's value, joined with ", ". Question 2. |
| F3 | **No row, no version.** `saveRow` needs a row with an id and a version. A value's first save inserts its row; clearing deletes it; typing again inserts a new one with version 1. The Measure toggle has the same shape: on is `saveRows([{ id: attribute.id }], …)` (the attribute held, no version), off is `saveRow(measure, …)` with `expectedVersion`; `linkKey` checks "the link the page knows, or none" (`currentKeyId`). | `sections.tsx` l. 416–421; `commands.ts` `setMeasure`, `keyContext` | One command, `setUnknownValue`: `attributeId`, `value` (trimmed, empty = none) and `current`: the row's id and version as the page knows them, or null for none. A live row that is not the one named, or a different version, is `stale_version` (so D-66's conflict line works). Every save holds the attribute (`saveRows`), so the saves of one field go one at a time; the answer gives the row's new id and version (or none), and the section remembers the newest answer per attribute for a save sent before the fresh page arrives. Question 3. |
| F4 | **Old rows need `upgrade`.** `defaults` is one fixed value per column, and `has_unknown_member` is true for a dimension and null for a fact; `findViolation` checks every stored row raw, so an old dimension row would fail the new shape check on the first write (slice 19, F1). | `src/data/local/schema.ts` `readRows`, `upgradeRows`; `src/modules/infocube/data/tables.ts` `upgradeCubeEntity`, `shapeFits` | Extend `upgradeCubeEntity` (the column joins `NEW_COLUMNS`; a dimension without it reads true, a fact null) and `shapeFits`. The adapter's code does not change. Undo images need nothing: the history is in the server's memory and empty after the restart (slice 19, F2). |
| F5 | **A cleared value.** With one setting per row, a live row always holds a value. | PRD section 3 | The command soft-deletes the row when the value is cleared (as Measure off), and inserts a new row for a later value. The column stays nullable for the later settings the table is named for; CHECK `cube_attribute_unknown_value_ck`: null, or not empty and trimmed. |
| F6 | **Read-only, not disabled.** Every text field in the panels takes `readOnly={!p.editable}` (the text can still be selected and copied; D-74: "see the values without controls"); buttons and flags are disabled. `p.editable` covers the role and the archive. | `sections.tsx` (`input-cube-grain`, `input-cube-snapshot-period`); `fields.tsx` `TextField`, `Flag` | The flag disabled, the fields read-only. S22-06 checks `readonly`. |
| F7 | **`TextField` cannot be marked invalid.** It has no `aria-invalid`, warning border or title. | `src/app/_panels/fields.tsx` l. 422 | An optional `invalid?: string` on `TextField`: `aria-invalid`, the warning border, the sentence as its title (the prototype has the title too). The module renders the sentence under the row. Not an extension point and not shared infrastructure. The mark follows the stored value, not what is being typed (as the prototype). |
| F8 | **A default that would not fit.** A `String(3)` attribute's default is "Unknown" (7 characters); the rule and the check look at typed values only (decision 3). KB has no String shorter than 7 in a dimension today. | PRD item 2, 7, 8 | As the PRD: defaults are not checked. One line in `known-limitations.md`. |
| F9 | **Earlier specs' texts.** Slice 15's, 18's and 19's fixtures build the star through `typeColumns`, which gets the new column, so every dimension in them is on and the fact's Dimensions rows gain " · no match → -1". | `e2e/slice-15b/RP-02`, `RP-06`, `RP-07`, `RP-12` (anchored `key …$`), `e2e/slice-19/S19-05` ("key product_key · snapshot") | Change the five expectations to the new texts (list below). "Used by" rows (`RP-11`) do not change: the prototype adds nothing there. |
| F10 | **The demo's lookup.** Dim Customer.country_name's lookup has the stored no-match value "Unknown" (`addStarDerivations`), so the field shows it and the placeholder is hidden. | `sales-star.ts` l. 309–312; `mapping-panel.tsx` l. 347–358 | S22-04 reads the input's `placeholder`, then clears the value and reads it as shown. The demo stays as it is. |
| F11 | **The groups' short texts and place.** A module group has `title`, `short` and `hint` (`CUBE_CHECK_TEXTS`); the module returns `[feeds, facts, under]`, High first on the home. | `src/modules/infocube/domain/checks.ts` l. 30–45, 131–133 | `[feeds, unkval, facts, nounk, under]` (the prototype's order within each severity). Shorts: `unkval` "value does not fit", `nounk` "no unknown member". |
| F12 | **Shared infrastructure.** Step 2 adds entries to the module's own records (`INFOCUBE_UNDO`, `INFOCUBE_RULES`, `InfoCubeDb`, `InfoCubeRows`); `src/compose/tables.ts`, `undo.ts`, `module-cascade.ts`, `src/data/local/` and the save chain are not edited. | `src/compose/tables.ts` (spreads the module's records) | No full run in step 2; the slice's and the touched earlier specs, and the unit tests of the registry and the schema. Question 4. |
| F13 | **The flag is `updateCubeEntity`'s.** D-74: one command for the row, an undo name per field. | `commands.ts` l. 86–187 | `hasUnknownMember` joins its input; on a fact it is refused ("Only a dimension has an unknown member."); undo names "Turn on unknown member", "Turn off unknown member". No new command for the flag. |
| F14 | **The rows on a page and on the home.** The panels and the checks read InfoCube's rows from `ModuleView.data` (a canvas page) and `moduleHomeData` (the home); both list the five tables by name. | `view.ts` `CubePageRows`, `cubePageRows`; `src/compose/view.ts` l. 55–59, 154–158; `checks.ts` `CubeCheckRows`, `NO_CHECK_ROWS`; `sections.tsx` `NO_ROWS`; `scripts/lib/checks-model.ts` l. 58 | A sixth list, `cubeAttributes`, in each. `cubeIndex` (`CubeModel`) takes it and answers `unknownOn(entityId)` and `unknownValueOf(attribute)` (stored, else the default), read by the section, the Dimensions row, the lookup panel and the checks. |
| F15 | **No length cap.** `optionalTextSchema` trims and has no maximum; the grain, the snapshot period and a lookup's no-match value have none. | `src/domain/validation.ts` l. 15 | None for the value either. |
| F16 | **A date is checked by its shape only.** The prototype's rule is a pattern: "2026-13-45" fits. Integer has no range, Decimal no precision or scale; "1." and "+1" do not fit. | prototype `unkFit` | As the prototype and the PRD. |
| F17 | **KB's file and my own runs.** The upgrade runs when the new code loads a file and is written with the file's next write; `.data/dev-db.json` is KB's. | CLAUDE.md, "Łukasz's test model", The slice cycle 6 | Steps 2 and 3 run only against the e2e file and the demo file (`npm run demo`), never `npm run dev`. Older code reads an upgraded row without complaint (it ignores the extra column), so switching back to `main` is safe. |

### Q1. `cube_entity`

- **The column and the CHECK.** One migration, `supabase/migrations/20261109120000_infocube_unknown_member.sql` (it
  also creates `cube_attribute`): `add column has_unknown_member boolean`; `update … set has_unknown_member = true where
  role = 'dimension'`; `cube_entity_shape_ck` dropped and added again with "a fact has none" and "a dimension has one".
  The local mirror is `shapeFits` (`src/modules/infocube/data/tables.ts`).
- **Old rows:** `upgrade`, not `defaults` (F4). The local file's format stays 14.
- **Every path that creates a dimension goes through one function.** `createCubeEntity`
  (`src/modules/infocube/domain/commands.ts` l. 40) is called by `createFactAction` and `createDimensionAction` (the Cube
  tab, the toolbox, and through `EntityCreateInput` the concept picker's new concept) and by `createDimensionFrom`
  (`mappings.ts` l. 739, "Create dimension from this…"). There is no Entity tool with a role: the toolbox's fact and
  dimension items are those two actions. `createCubeEntity` writes the slice 19 columns inline; step 2 makes it use
  `typeColumns` (`types.ts` l. 144), which gets `has_unknown_member` (true for a dimension, null for a fact).
- **The demo and the scripts.** `addSalesStar` and `addStarTypes` (`sales-star.ts` l. 177, 392) and the unit fixture
  (`__fixtures__/star.ts`) use `typeColumns`, so they follow. Rows written by hand: `scripts/lib/star-canvas.ts` l. 71,
  `scripts/lib/synthetic-checks.ts` l. 85, `tests/infocube-requirements.test.ts` l. 232. `seed:large`'s "Performance
  test" has no InfoCube rows.

### Q2. `cube_attribute`

- **The table:** the standard columns, `attribute_id` (FK `attribute`), `unknown_value text`; a unique index on
  `attribute_id` among live rows; `cube_attribute_unknown_value_ck` (F5); `enable row level security`.
- **Registration (AD-33), all in the module:** `InfoCubeRows` and `CubeAttribute` (`domain/types.ts`), `INFOCUBE_UNDO`
  (`domain/tables.ts`: `parents: [["attribute_id", "attribute"]]`, noun "unknown member value"), `INFOCUBE_RULES` and
  `InfoCubeDb` (`data/tables.ts`: key, foreign keys, the unique rule, the check). The build fails if one is missing.
  The guard tests name the tables: `tests/table-registry.test.ts` l. 48 and `tests/schema/compare-schema.test.ts`
  l. 93–97 get the sixth.
- **Undo parents:** the attribute only. That one registration gives both the cascade (below) and the revert check.
- **Deleted or kept with null:** deleted (F5), as `cube_measure` when Measure is turned off.
- **The store:** `store.modules.list(workspaceId, "cube_attribute")` through `getDataStore(STORE_SCHEMA)`, nothing new.
- **The table registry itself does not change** (F12): `src/compose/tables.ts` spreads the module's records.

### Q3. The commands

- **The flag:** `updateCubeEntity` (F13), saved with `saveRow` on the `cube_entity` row as the kind and the history.
- **A value:** `setUnknownValue` (F3), permission `model.edit`. It refuses an attribute that is not found, and one
  whose entity is not a dimension ("Only an attribute of a dimension has an unknown member value."). An unchanged value
  is not sent by the field (`useDraft` compares with the stored one); sent anyway it is "Nothing to change.". A value
  may be written while the flag is off (the fields are hidden then, but an undo or a redo can do it). Undo names: "Set
  unknown member value" (the first value or a changed one), "Clear unknown member value". One write, one change group.
- **The length cap:** none (F15).
- **Deletes in the same change group:** nothing to write. `moduleCascade` soft-deletes a module row whose registered
  parent a write deletes; `deleteAttribute` deletes the attribute, an entity's delete deletes its attributes
  (`entityCascade`), and the cascade follows both to `cube_attribute` (as it does to `cube_measure`). One undo brings
  the attribute and its value back.
- **Undo refusing a value on a deleted attribute:** `revertChangeGroup`'s consistency check refuses a revert that
  leaves a live row whose registered parent is not live (`undo.ts` l. 499–540). Undoing "Clear unknown member value"
  after the attribute was deleted is such a revert. Nothing new; a unit test for each case.
- **The delete previews** (`attributeDeletes`, `entityDependents` in `view.ts`) do not name the value (PRD item 9).

### Q4. The value-fit rule

- **Where:** a new pure file, `src/modules/infocube/domain/unknown-member.ts`: `unknownDefault(attribute)`,
  `unknownFit(value, attribute)` (the sentence, or null), the texts. `cubeIndex` uses it (F14).
- **Nothing to reuse.** The app's type rules compare two types: a column's with an attribute's (InfoMapper's import and
  mappings) and two attributes' (`typesDiffer`, `mappings.ts`). A lookup's no-match value is free text with no check;
  the app has no attribute default.
- **The type names:** the stored type is lower case (`LogicalType`); the words are `typeWord`'s (F1).
- **The String length:** `attribute.type_length` (null: no check). The sentence shows it as "String({n})".
- **The article in the sentence:** "an Integer", "a Decimal", "a Boolean", "a Date (YYYY-MM-DD)", "JSON", as the
  prototype.

### Q5. The panel

- **Where:** inside `DimensionSection` (`src/modules/infocube/app/sections.tsx` l. 304), after History and the Snapshot
  period, before "Used by". It is the existing entity section; `PANEL_SECTIONS` does not change.
- **The flag:** `Flag` (`fields.tsx` l. 550: `aria-pressed`, `disabled`), with `useChoice` on the stored flag.
- **The lines:** `cube.attributesOf(entity.id)` (the `sort_order`, then the name: the panel's order). One `TextField`
  per attribute, keyed `fieldKey(attribute.id, "unknown_value")`, with `keep` (field "Unknown member value", object
  "{Dimension}.{attribute}"), the default as its placeholder, `invalid` (F7), `readOnly={!p.editable}` (F6). Its label
  is the attribute's name with the type's word and " · PK" under it. The layout is a two-column grid in the module's
  CSS or Tailwind classes; no layout is read.
- **Readers and reviewers:** the flag disabled, the fields read-only; an archived workspace the same (`p.editable`).
- **Test ids:** `flag-cube-unknown`, `text-cube-unknown`, `list-cube-unknown`, `item-cube-unknown` (with
  `data-attribute`), `input-cube-unknown`, `text-cube-unknown-bad`.
- **Cost:** KB's largest dimension has 21 attributes: 21 fields, each with `useDraft`. No concern.

### Q6. The fact's Dimensions and the lookup's placeholder

- **The Dimensions row** is `keyMeta(key, snapshotOf)` (`sections.tsx` l. 112), fed by `cube.dimensionsOf(fact)`
  (`FactKey`: `dimensionId`, `key`, `pk`). It gets the no-match part before the snapshot mark, under the prototype's
  condition: the row has a key, the dimension's unknown member is on and the dimension has a primary key. The value is
  `unknownValueOf(pk)` or "NULL"; test id `mark-cube-no-match`.
- **The lookup's placeholder** is the `TextField` at `mapping-panel.tsx` l. 347. The panel has the mapping's target
  (`index.attribute(m.attribute_id)`) and the page's InfoCube rows; it needs the target's entity's row and the target's
  value from the cube index (F14). A target in a fact, or in a dimension turned off, or with an empty value, keeps
  "e.g. Unknown".

### Q7. The checks

- **The extension point is enough.** `cubeChecks` (`src/modules/infocube/domain/checks.ts`) returns the module's
  groups; `src/compose/checks.ts` passes the page's or the home's rows. Two more groups (F11) and the sixth row list
  (F14); InfoMapper's `checks.ts` does not change.
- **`unkval`:** per dimension in scope with its unknown member on, per stored value that does not fit: it opens the
  attribute, `panels` the attribute (the entity's panel shows its attributes' lines by D-75), `marks` the attribute,
  `entities` the dimension. The words are built in `text()`: "{Dimension}.{attribute}", "unknown member: {sentence}".
- **`nounk`:** per dimension in scope with it off and at least one live fact at the other end of a live relationship
  that is not to itself: it opens the dimension, `panels` and `marks` the entity. "used by {facts}": each fact once, in
  the model's order of entities, whether or not the fact is in the project's scope (as the prototype). The
  dimension-to-facts map is built in one pass over the relationships.
- **InfoCube off:** `cubeModuleChecks` returns nothing, so neither group exists.
- **The bench.** `scripts/bench-checks.ts` runs the synthetic model (it has facts and dimensions), "Performance test"
  (no InfoCube rows, so unchanged) and the demo. Step 3 gives the synthetic model stored values (some that do not fit)
  and some dimensions turned off, so the two rules do work there; the bar stays 50 ms. The rules add one pass over the
  relationships and one pattern test per stored value.

### Q8. Earlier specs and fixtures

| Step | What | Why |
| --- | --- | --- |
| 2 | unit: `src/modules/infocube/domain/commands.test.ts`, `types.test.ts`; `tests/infocube-types.test.ts` (the upgrade's expected rows, l. 180–192), `tests/table-registry.test.ts`, `tests/schema/compare-schema.test.ts`, `tests/infocube-requirements.test.ts`; `scripts/lib/star-canvas.ts`, `scripts/lib/synthetic-checks.ts` | the new column on rows written by hand or compared whole; the sixth table in the guard lists |
| 2 | e2e run, not changed: `slice-15a` (S15-07, S15-14: the stored rows), `slice-19` (S19-01: `writeOlderCubeRows`, which now also proves an older row loads with the unknown member on; the other data specs of the folder) | the column and the upgrade |
| 3 | e2e changed: `slice-15b/RP-02`, `RP-06`, `RP-07`, `RP-12`, `slice-19/S19-05` | F9: " · no match → -1" in the Dimensions rows |
| 3 | e2e run, not changed: `slice-15b` (the Dimension and Fact sections), `slice-18/S18-01`, `S18-06` (the lookup panel), `slice-19/S19-04`, `S19-05`, `slice-20` (the home's and the status bar's counts) | the section, the placeholder, the checks |

- **Slice 20's counts do not change:** its fixture (`addFullDemoData`) has every dimension on and no stored value, so
  neither group has a line. The plain e2e seed has no star.
- **The element guard and the layers specs** read the plain seed or the star's cards; nothing is added to a card.
- **Copies and exports.** The app copies attributes, not entities (`pasteAttribute`): the copy is a new attribute and
  no module row is copied (a measure is not either), so a pasted attribute takes the default. "Create dimension from
  this…" makes new attributes without values. The app has no export or download (the one file-related match in `src` is the import wizard's source step).
- **Screenshots:** no earlier screenshot spec asserts; a new `S22-screens` on demand (the section, a bad value, the
  flag off; light and dark).

### Q9. KB (a copy of the backup of 8 November 2026, 22:44; counts only)

One workspace has InfoCube rows, with InfoCube on.

| What | Count |
| --- | --- |
| Facts | 2 |
| Dimensions | 4 |
| Their attributes | 35 (3, 4, 7 and 21 per dimension) |
| By type | String 19 (11 with a length, none shorter than 7), Integer 10 (8 not a key), Date 5, Boolean 1 |
| Dimensions by number of primary keys | one key: 2; two keys: 2 |
| Primary keys by type | Integer 2, String 2, Date 2 |
| Relationships between a fact and a dimension | 7 |
| Dimensions a fact relates to | 4 of 4 |
| Lookups | 0 |

What follows for KB after the slice: every dimension on, no stored value, so no check line. Two Integer keys show
"-1", two String keys "Unknown", two Date keys "empty (NULL)". The two dimensions with two keys are F2's case. The
backup's rows are still in slice 18's shape (`scd_type`); the one upgrade function covers both steps.

### Differences between the prototype and the app that the slice touches

- **Types:** six in the prototype, eight in the app (F1).
- **Readers' fields:** `disabled` in the prototype, read-only in the app (F6).
- **A draft and a conflict:** the prototype's field saves at once; the app's keeps a draft, shows D-66's line after a
  refusal and warns before the page is left.
- **Rows without their object:** the prototype drops a value whose attribute is gone when it builds its index; the app
  deletes it with the attribute in the same change group.
- **The checks' place:** the prototype lists `unkval` and `nounk` between "feeds" and "under"; the app sorts High first
  (F11).
- **The two D-76 lines** bring the prototype to the app; the closing removes the inventory's section "The app ahead of
  the prototype (slice 21)".

### New user-facing texts (for approval)

From the PRD and the prototype, unchanged:
- "Unknown member" (the flag); its two sentences (PRD item 1); "No attributes yet."; the placeholder "empty (NULL)";
  " · PK".
- "no match → {value}" and "NULL"; the title "A fact row whose {key} is empty or has no match gets {dimension}'s
  unknown member".
- "{value} (the unknown member's value)".
- "“{v}” is not an Integer", "… is not a Decimal", "… is not a Boolean", "… is not a Date (YYYY-MM-DD)", "… is not
  JSON", "“{v}” is longer than String({n})".
- The groups' titles and hints (PRD item 8); "unknown member: {sentence}"; "used by {facts}".

New, proposed here:
- "“{v}” is not a Datetime (YYYY-MM-DD HH:MM)" (F1).
- The groups' short texts: "value does not fit", "no unknown member" (F11).
- Refusals: "Only a dimension has an unknown member."; "Only an attribute of a dimension has an unknown member value."
- Undo names: "Turn on unknown member", "Turn off unknown member", "Set unknown member value", "Clear unknown member
  value".
- The kept draft's names (D-66's toast "Not saved: {field} of {object}. …"): field "Unknown member value", object
  "{Dimension}.{attribute}".
- The undo noun of a `cube_attribute` row: "unknown member value".

### Shared infrastructure, step by step

- **Step 2:** none edited (F12): no change to undo, change groups, the module cascade, the save chain, the canvas's
  layers, `src/compose/tables.ts` or `src/data/local/`. No full run by the rule.
- **Step 3:** `TextField`'s optional `invalid` (F7) is a panel field, not on the list. No full run.
- **Step 4:** the full run on the final commit.

### Questions for Łukasz

1. **Datetime and Custom (F1).** Proposed: Datetime as Date, with its own sentence; Custom fits anything; both default
   to empty. Or: Date without a time and Datetime with one.
2. **Two primary keys (F2).** Proposed: the Dimensions row shows the first key's value, as Add key uses the first key.
   Or: every key's value.
3. **A value's version (F3).** Proposed: `setUnknownValue` checks the row's id and version as the page knows them, or
   that there is none. I read the chain's code but did not run it; step 3 has a spec with two saves of one field, the
   second sent while the first's answer is held.
4. **A full run in step 2 (F12).** Proposed: none, since only the module's own records change.
5. **The texts** under "New, proposed here".

### Plan for steps 2 to 4

**Step 2, data and domain** (draft PR at the start):
1. The migration (the column, the CHECK, `cube_attribute`, RLS).
2. `types.ts` (`CubeEntity.has_unknown_member`, `CubeAttribute`, `typeColumns`), `data/tables.ts` (`shapeFits`,
   `upgradeCubeEntity`, the table's rules, `InfoCubeDb`), `domain/tables.ts` (undo).
3. `unknown-member.ts` (the defaults, the fit rule, the texts); `cubeIndex` (`unknownOn`, `unknownValueOf`).
4. `updateCubeEntity`'s flag; `setUnknownValue`; their actions; `createCubeEntity` through `typeColumns`.
5. The row lists (F14) and the checks' two groups with their rules.
6. Unit tests: the rule for every type and the length (S22-03), the defaults, the commands, the upgrade (S22-01), the
   cascade and the two undo cases, the two checks, the guard lists.
7. Lint, typecheck, unit tests; the e2e specs of step 2's row in Q8; CI on the draft PR.

**Step 3, interface:**
1. `TextField`'s `invalid`; the section in `DimensionSection`; the Dimensions row; the lookup's placeholder.
2. The checks on the page and the home (the sixth list through `ModuleView.data` and `moduleHomeData`).
3. `e2e/slice-22/` S22-01 to S22-06, its fixtures on `addFullDemoData`; the five earlier specs (F9).
4. The element guard, the canvas commit counts, `bench-checks` with the synthetic model's new rows; no sitting.

**Step 4, close:** `decisions.md` (D-77, quoted in full, with what questions 1 and 2 decide), `data-model-v2.md`,
`ideas.md`, the inventory, `known-limitations.md` (F2, F8), README and CLAUDE.md; the full run on the final commit; the
manual acceptance steps (the demo, then KB after a fresh backup).

## Step 1: Łukasz's answers (9 November 2026)

1. **F1:** Datetime follows Date's rule with its own sentence ("“{v}” is not a Datetime (YYYY-MM-DD HH:MM)"); Custom
   fits any value; both default to empty.
2. **F2:** with several primary keys, a fact's Dimensions row shows the first key's value, as Add key uses the first;
   every key attribute has its own value in the dimension's panel.
3. **F3:** the value's command checks the row's id and version as the page knows them, or that there is none (D-59); a
   unit test covers the conflict when another user created the row meanwhile.
4. **F12:** no full run in step 2.
5. **The new texts** as proposed in this document; step 2's report quotes them all for review.

The corrections that needed no decision stand as written: `upgrade` for old rows (F4), read-only fields for readers and
reviewers (F6), `TextField`'s optional `invalid` prop (F7), the five earlier specs (F9).

## Step 2: data and domain (9 November 2026)

Draft PR 51 was opened at the start of the step.

### What changed

- **The migration** `supabase/migrations/20261109120000_infocube_unknown_member.sql`: `cube_entity.has_unknown_member`
  (true for every dimension, null for a fact), `cube_entity_shape_ck` again with it, the table `cube_attribute` with its
  unique index among live rows, `cube_attribute_unknown_value_ck` and row level security.
- **The module's tables** (`domain/types.ts`, `data/tables.ts`, `domain/tables.ts`): `CubeEntity.has_unknown_member`,
  `CubeAttribute`, `typeColumns` (a new dimension on), `shapeFits`, the table's rules, `InfoCubeDb`, and the undo
  registration (parent `attribute`, noun "unknown member value"). `createCubeEntity` now takes its columns from
  `typeColumns`, so every path that makes a dimension sets the flag.
- **Old rows** (F4): `upgradeCubeEntity` gives a dimension without the column true and a fact null, from slice 19's
  shape and from slice 18's. The local file's format stays 14.
- **The rule** (`domain/unknown-member.ts`): `unknownDefault`, `unknownFit` for all eight types, `unknownValueOf`, and
  the texts of the Dimensions row and the lookup's placeholder for step 3.
- **The commands** (`domain/commands.ts`, `app/actions.ts`): `hasUnknownMember` on `updateCubeEntity`; `setUnknownValue`
  with F3's check and `setUnknownValueAction`.
- **The cube index** (`domain/keys.ts`): `unknownOn(entityId)` and `unknownOf(attributeId)`.
- **The checks** (`domain/checks.ts`): `unkval` and `nounk`, the groups in the order feeds, unkval, facts, nounk, under.
- **The row lists** (F14): `cubeAttributes` in `CubePageRows`, `CubeCheckRows`, the page's and the home's reads
  (`src/compose/view.ts`) and the bench's (`scripts/lib/checks-model.ts`).
- **`docs/data-model-v2.md`:** the column, the CHECK and the table.

### What differs from the plan

1. **`unknownValueOf` is in `unknown-member.ts`, not on the cube index.** The index answers `unknownOn` and the stored
   row (`unknownOf`); the default is added by `unknownValueOf(cube, attribute)`. `keys.ts` importing the rule and the
   rule importing the index's type would have been a cycle.
2. **The checks read the stored values from the rows, not from a cube index passed in.** A caller may pass an index
   built without them (the page's, the bench's); the rule would then miss every line without an error.
3. **A row the page knows that is gone, or is another row, is a stale version, not "not found".** D-66 drops the draft
   after "not found"; a stale version keeps it and shows the conflict line, which is what the person needs when someone
   cleared the value meanwhile.
4. **The row lists were done here, not in step 3** (the plan named them in both): a page of a model with facts or
   dimensions now reads `cube_attribute` and carries `cubeAttributes` (empty until a value is typed). Nothing shows it
   yet.
5. **`cubeAttributes` is optional** in `CubeModel` and `CubeCheckRows`, so the callers that read no value are unchanged.
6. **The synthetic bench model** got the column only; its stored values and dimensions turned off come in step 3, with
   the bench.

Nothing needed `src/compose/tables.ts`, undo, the module cascade, the save chain or `src/data/local/`: none of them is
in the step's diff.

### Tests

- **New:** `src/modules/infocube/domain/unknown-member.test.ts` (27 tests: the rule for every type with its sentence,
  the String length, Custom, the defaults, the index, the flag, the value's command with the conflict when another user
  created the row meanwhile and three more stale cases, the refusals) and `tests/infocube-unknown-member.test.ts`
  (22 tests: the seeded star, the upgrade, a file written before slice 22, the shape CHECK, `cube_attribute`'s rules,
  an attribute's and a dimension's delete with one undo, undo and redo of a value, undo refused on a deleted attribute
  and on a value changed meanwhile, the two checks, InfoCube off).
- **Changed:** `commands.test.ts` and `tests/infocube-types.test.ts` (the new column in two expected rows),
  `tests/table-registry.test.ts` and `tests/schema/compare-schema.test.ts` (the sixth table in the guard lists).
- **Checks:** `npm run lint`, `npm run typecheck` and `npm test` pass (161 files, 2,000 tests).
- **Earlier e2e specs the step touched, one local run, 8 tests passed, none changed:** `slice-15a/S15-07`, `S15-14`
  (the stored rows), `slice-19/S19-01` (an older file's rows; a save, reload, undo and redo), `S19-05`,
  `slice-15b/RP-02` (the panels on the star), `slice-20/S20-01`, `S20-02` (the checks' lines and counts: unchanged).
- No full run (answer 4).

## Step 2: Łukasz's review (9 November 2026)

1. **The undo names carry their object**, as slice 21's do: "Turn on unknown member of {dimension}", "Turn off unknown
   member of {dimension}", "Set unknown member value of {Dimension}.{attribute}", "Clear unknown member value of
   {Dimension}.{attribute}". Changed in step 3, with their unit tests.
2. Every other text of step 2 is accepted as written. The differences from the plan are accepted.
