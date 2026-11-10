# Slice 24 – acceptance

PRD: [`slice-24-entity-stereotypes.md`](slice-24-entity-stereotypes.md). Branch `slice/24-entity-stereotypes`.

## Step 1: the PRD checked against the code (10 November 2026)

### The starting point

- **The branch.** `slice/24-entity-stereotypes` was cut from the tag `slice-23` (`239ffad`, the merge of PR 52), which
  is `origin/main`; the local `main` was fast-forwarded to it first.
- **No run in this step.** No dev server, e2e run, unit test, lint or bench ran. One read-only count ran on KB (Q9): a
  copy of `.data/backups/kb-model-latest.json` (8 November 2026, 22:44) in the scratchpad, counts printed, the copy
  deleted. `.data/dev-db.json` was not read or written.
- **The two files from Łukasz's Downloads**, each checked with `cmp` after the copy and with `sha256sum` against the
  prompt's value, and committed with this document (neither has a carriage return, so the committed bytes are the
  files'):

  | File | SHA-256 | `cmp` |
  | --- | --- | --- |
  | `docs/prd/slice-24-entity-stereotypes.md` (new, 18,440 bytes) | `98e11c166f7f13fd6d711652eabda76a511ef4c546ec4685b2944eb86198df84` | equal |
  | `docs/prototype/infomapper-prototype-with-sources.html` (745,060 bytes, replaces slice 23's `bf7cbb6a…`) | `190d9ea9ef08b4f232f9af37a8d0cee0342ffb17a9c6c3762d625748e30b28da` | equal |

- **The prototype is built on slice 23's.** Against the file at tag `slice-23` it differs in 16 places (`diff` hunks), every one on the
  PRD's list (section 4): the CSS `.st-def`; the entity card's label (`CONV.stName`, the definition as `title`); the
  model tree's row (`CONV.stName`); the entity panel's select (`CONV.stList()`, value the key, text the name, each
  option's `title` the definition, `.st-def` under it); the baseline view's heading (`CONV.stName`); Settings' "Model
  conventions" (the sentence with "entity stereotypes", the static chips gone); the `CONV` module (the comment, the
  texts per language `ST_DEF`, `stList`, `stOf`, `stName`, `stDef`, `stCode`, `stUse`, the one-time seeding `c.v24`, the
  intro's new clause, `stSection`, `stSnake`, `stRemove`, the click and input handlers for add, remove, rename and
  definition, the exports). Nothing else differs.

### Summary

The PRD's shape holds, and slice 23 already built most of the pattern it reuses: built-in texts per language keyed by
code (`BUILTIN_TEXTS`, `builtinText`), rows made at a workspace's creation in its language (`newWorkspaceRows`, shared by
both create commands), D-78's comparison (`normClassification`), codes kept by soft-deleted rows (an undone insert is
soft-deleted, `undo.ts`), the tab's table, its add row, its remove dialog and the read-only rules. Only two places write
a stereotype (`createEntity`, always `object`; `updateEntity`) and only three places show one. Nothing imports, exports,
filters, searches or checks a stereotype. Twenty-four findings below; the four that change the slice's cost:

1. **F1, the CHECK's replacement.** The local adapter's foreign keys point to an `id` only (`TableRules.foreignKeys`,
   `src/data/local/schema.ts`), so a composite key on `(workspace_id, code)` is a new adapter feature (shared
   infrastructure). Without it the adapter accepts a code no database would, against AD-29.
2. **F2, undo needs two new refusals.** `PARENTS` follows ids; an entity names its stereotype by code. Without a check, an
   undo can bring back an entity on a removed stereotype, or a stereotype whose name another one has meanwhile.
3. **F11, `WorkspaceModel` gets the list.** The canvas page, its panels and the homes read the model; 25 files build a
   `WorkspaceModel` literal (mostly tests) and take the new field.
4. **F19, the local file's format 16** (a core table; the upgrade writes five rows per workspace). With F1 and F2, step 2
   changes three items on the "Test runs" exception list (the adapter, undo, the format): **step 2 has a full run**, as
   the PRD foresees.

### Findings

**Data and the CHECK (Q1, Q2)**

- **F1. The CHECK's replacement: a composite foreign key in SQL and in the local adapter (proposal).**
  `entity_stereotype_ck` (`20261002000000_initial_schema.sql`) and its mirror `oneOf(STEREOTYPES, "stereotype")`
  (`schema.ts`, `RULES.entity`) go. Three options:
  - (a) **recommended:** the migration adds `foreign key (workspace_id, stereotype) references stereotype (workspace_id,
    code)` (with an index on `entity (workspace_id, stereotype)`), and the local adapter learns composite foreign keys
    (a new `TableRules.compositeKeys` beside `foreignKeys`, checked in the same write as every rule). The adapter keeps
    refusing what a database refuses: `model-store.test.ts:394` ("hub" refused) keeps its meaning with a new message.
  - (b) the SQL key only, the domain alone in the local adapter: the adapter would accept a code the database refuses
    (AD-29 says it enforces the same rules).
  - (c) the domain alone, no key: the cheapest; a code from a file or a bug lands unnoticed.

  A foreign key cannot see a soft delete: an entity on a removed own stereotype is the domain's and undo's to prevent
  (`updateEntity` checks the live list, F15; undo F2). The key's target is unique on `(workspace_id, code)` over every
  row, deleted ones included, which the PRD wants anyway.
- **F2. Undo: two refusals of its own (`undo.ts`, beside `classificationNameClash`).** `PARENTS` compares ids, and
  `entity.stereotype` is a code, so neither of these is caught today:
  - (i) a revert that leaves a live entity whose code has no live stereotype: undo an own stereotype's add after an
    entity chose it; undo an entity's delete after its stereotype was removed (unused then, so removed at once); redo an
    entity's choice of a stereotype removed since. Text (proposal): "This can't be undone: the stereotype {name} is no
    longer in the list."
  - (ii) a revert that leaves a live stereotype whose name another live one has, or whose name is any row's code
    (removed and deleted ones too), as slice 23 did for classifications (F4 there): e.g. remove own "Event", rename Link
    to "Event", undo the removal. Text (proposal): "This can't be undone: another stereotype is called {name} now."
- **F3. Built-in rows are never deleted, by the data's own rule.** A CHECK `origin = 'own' or deleted_at is null` (SQL and
  the local adapter), a CHECK that a built-in row's code is one of the five, and one on the code's shape
  (`^[a-z][a-z0-9_]{0,29}$`). No command deletes a built-in row; the check also stops an undo from doing it.
- **F4. "A code is never given twice" needs no list of its own.** An undone insert is soft-deleted (`undo.ts`, the
  revert of a create writes `deleted_at`), and a removal is a soft delete, so every code ever given stays on a row: the
  domain compares against every row of the workspace, deleted ones included (as `codeRefusal` does for classifications).
  The prototype's `S.conv.stCodes` is the app's deleted rows. As slice 23's F16, a code stays taken after its add is
  undone (S24-04 tests it); `known-limitations.md` gets the line at the closing.
- **F5. Names against codes, the row's own code excepted.** Item 5's comparison must leave out the stereotype itself:
  renaming Object to "OBJECT", or adding "Event" with the code `event`, is allowed (the name's key equals only its own
  code). S24-03's "a code such as OBJECT" is a rename of Link to "OBJECT", refused. The prototype checks a rename only
  against the live list's names and codes, but an add also against the codes ever given (`stCodes`). **Proposal:** both
  compare with every row's code, removed and deleted ones included, as D-78's `nameTakenBy`; names compare with live
  rows only (a removed own one's name is free again).
- **F6. The code's proposal: the prototype's `stSnake`, which the PRD's sentence shortens.** The prototype trims, lower-
  cases, removes diacritics (NFD) and turns `ł` into `l` (NFD does not decompose it: "Słownik" would give `s_ownik`),
  turns every **run** of other characters into one `_`, trims `_` at both ends, puts `s_` before a leading digit, and
  cuts at 30. An empty code field at Add takes the proposal; a name with no letter or digit proposes nothing and the code
  is refused ("Letters, digits and _; starting with a letter"). **Proposal:** the prototype's rule, a pure function in the
  domain (`proposedCode`); the code field shows the proposal as its value while it was not edited by hand, and is
  "untouched" again after a successful Add.
- **F7. Lower-case codes.** Classification codes are upper case (`CODE_PATTERN`); stereotype codes are lower case, as the
  five built-in ones. A typed code is trimmed and lower-cased (the prototype lower-cases it), then checked. One
  comparison for both lists: `normClassification` (it is D-78's), reused; renaming it is not needed.

**The commands (Q5)**

- **F8. Where a refusal shows.** The PRD's item 3 says a taken name "is refused with 'That name is taken.'" (the prototype:
  a toast). The app's classification table shows "That name is taken" under the field and keeps the draft (D-66;
  `classification-name-error` in `conventions.tsx`), and the add row its two errors under its fields. **Proposal:** the
  same for stereotypes (under the field, the classifications' texts without a full stop), so the tab has one way.
- **F9. A definition's toast.** The PRD and the prototype give none. **Proposal:** the classifications' "Saved the
  definition of {name}." and "Cleared the definition of {name}." (with Undo), so the two boxes behave alike.
- **F10. The undo history's names** (`change-label.ts`, a rule beside the classifications'): "Add stereotype {name}",
  "Rename stereotype {old name}", "Change definition of {name}" (`DEFINITION_LABEL`'s text), "Remove stereotype {name}"
  for both removals (the one with its entities moved is one stereotype event and n entity events; the rule names it by
  the stereotype). Today an entity's stereotype change is "Change entity" (`change-label.test.ts`), unchanged.
- **F15. `updateEntity` reads the workspace's list.** `stereotype: z.enum(STEREOTYPES)` becomes the code's shape, and the
  command checks it against the workspace's live stereotypes (`UpdateEntityState.stereotypes`, passed by
  `updateEntityAction`, `src/app/_actions/model.ts`). An unknown or removed code (S24-01): "That stereotype is not in the
  list." (`invalid`). `createEntity` keeps writing `object` for both levels (C-5); it needs no list (`object` is built in
  and never removed, F3). The type `Stereotype` becomes the code (`string`) and `STEREOTYPES` the five built-in codes
  (`BUILTIN_STEREOTYPE_CODES`); `seed-model.ts` and `seed-large.ts` use them.
- **F16. Removing an own stereotype: one command, two forms.** `removeStereotype({ stereotypeId, expectedVersion, moveTo?
  })`: a built-in one is refused ("A built-in stereotype can't be removed."); a used one without `moveTo` is refused
  ("Choose the stereotype they get instead."); `moveTo` must be another live stereotype. Its live **logical** entities on
  that code move (each `nextVersion`), the row is soft-deleted, one change group (dimensional entities never have an own
  code: C-5, `DIMENSIONAL_STEREOTYPE_MESSAGE`). The page saves it on the stereotype's chain (`saveRow`, `deletes: true`,
  as the classifications' removal); the entities are read on the server as they stand (they are not on the home page's
  chain). The dialog's count comes from the page, the toast's from the answer (someone may have changed an entity in
  between); an own one that is unused by then is removed without a move. Deleted entities keep their code (F2 (i)).
- **F17. The singular forms**, which the PRD gives in the plural only and the prototype has: "1 entity has this
  stereotype. Choose the one it gets instead:", "Remove and move 1 entity", "{name} removed; 1 entity is now {other}.";
  the Used column "1 entity" (the PRD has it).

**Where the list is read and shown (Q3, Q6)**

- **F11. `WorkspaceModel.stereotypes`.** The store's `model.load` returns the workspace's rows, removed ones included (as
  `classifications`: the code rules need them; the pages show only live ones). One pure module,
  `src/domain/model/stereotypes.ts`: the built-in codes and texts per language, `builtinStereotypeRows`, the order, the
  comparison rules (F5, F7), `proposedCode` (F6), and `stereotypeIndex(list)` answering `name(code)`, `definition(code)`
  and the live list in order; a code without a row reads as itself (an older change event's image, a test model). Besides
  the type and the store, 25 files build a `WorkspaceModel` literal and take `stereotypes` (17 test files, one fixture,
  `scripts/lib/checks-model.ts`, `src/domain/import/apply.ts`, `materialize.ts`, `src/domain/commands/import.ts`,
  `source.ts`, `src/app/_actions/model.ts`, `source-change.ts`; list in "Earlier specs and fixtures"). **Proposal:** required, so a new
  caller cannot forget it.
- **F12. Three places show a stereotype, not four (slice 23's Q8 corrected).** `buildCards` (`card-data.ts:273`, the
  card's first line), `buildTree` (`tree-data.ts:200`, the Model tab's meta) and the entity panel's select
  (`entity-panel.tsx:117`). `left-panel.tsx:302` and `:619` render `TreeEntity.stereotype`, which is `tree-data`'s meta
  (already capitalised there, and for a module's tab the module's role text), not the raw code: they need no change. No
  other place shows one: the search (`show`) matches names, aliases and attributes; no document, export, model check,
  thumbnail or undo name shows it.
- **F13. The card's title and width.** `CardData` gets the definition (`line1Title`, set only on a logical card whose
  stereotype has one); `CardNode` puts it as the `.stereo` span's `title`. No element more, the element guard unchanged;
  a fact's or a dimension's role keeps its own title (D-67). The first line's clip already measures the shown text
  (`lineNeedsClip([card.line1, card.line1b], …)`, `card-data.ts:335`), so a longer name ("Informacyjna") clips as any
  long concept name does. The cards come from the server (`buildCards`; the browser never rebuilds `line1`), so a
  rename shows with the next page. No measuring sitting (the PRD's step 3 agrees): the element guard and the canvas
  commit counts.
- **F24. The entity panel's select** (`entity-panel.tsx`, native `select`, `useChoice`): options in the list's order,
  value the code, text the name; under it the chosen one's definition (a hint, `.st-def`'s look, test id
  `text-entity-stereotype-definition`), absent without one. The prototype also gives each option the definition as its
  `title`, which the PRD does not mention: **proposal**, include it (an attribute, nothing drawn). Readers and reviewers:
  disabled, as now (S1A-11); the definition shows for them too. Facts and dimensions keep Role (S15-07, no select).
- **F14. The readers of a code (item 12, S24-07).** In the app: `createEntity` writes `object` (`entity.ts:111`, every
  new entity, InfoCube's creates through it, "Create dimension from this…" too); `updateEntity`'s refusal on a fact or a
  dimension reads the level, not the code; the seeds. No filter, search, import, export, baseline, model check or rule
  reads one (the prototype's Data Vault hint `isLink` is not in the app, as the PRD says). **Proposal for S24-07:** after
  renaming all five, an entity made on the canvas and from the Model tab is `object` and shows the new name, a fact, a
  dimension and "Create dimension from this…" keep `object` and show their role, a stereotype chosen in the panel stores
  its code, and the project home's model checks are the same. Outside the app, the documentation pilot's tools
  (`.data/exports/docs/tools`, git-ignored) read `entity.stereotype` as codes: they keep working and print codes; the
  table is there for them to read names later (InfoDocumenter).

**The tab (items 1–8)**

- **F20. The box's place and the tab's lines.** "Entity stereotypes" between Classifications and Concept colours
  (`conventions.tsx`); the intro gains "entity panels offer the stereotypes;" and the last line drops "entity
  stereotypes' names and definitions," (both from the prototype). S23-01 asserts both lines: it changes in step 3 (its
  reason: slice 24's item 8).
- **F21. The list's order.** Built-in ones in the fixed order (object, link, dictionary, context, informative), then own
  ones by `created_at`, then id. An undone removal brings the same row back, so it returns to its place.
- **F22. Used.** Live logical entities per code, counted on the page from the model the home already loads (as
  `classificationUses`, `src/app/w/[workspaceId]/page.tsx`); "4 entities" on Object in Retail Co – DWH (Customer,
  Customer Address, Sales Order, Product; the star's facts and dimensions not counted), "1 entity" on Link (Order Line)
  and on Dictionary (Country), "unused" on the others.
- **F23. Settings' sentence** (`MODEL_CONVENTIONS_TEXT`, `settings-form.tsx`): "Classifications, entity stereotypes,
  concept colours and naming conventions are edited in" + the button. S23-06 asserts it and changes in step 3. The app
  never had the prototype's chips (slice 23, F12).

**Creation, the format, the language (Q4)**

- **F18. Existing workspaces' names.** Nothing stored a stereotype's name before; the app showed `cap(code)`. "Keep their
  names (the English ones)" (decision 7) therefore gives an existing Polish or German workspace English names with
  definitions in its language. KB is English (Q9), so it sees no difference; the seed's "Sales analytics" (Polish) gets
  Polish names because the seed creates it as a new workspace is created (as slice 23's F2). **Proposal:** as decided.
- **F19. The local file's format 16.** A core table: `DevDb.stereotype`, the empty file's list, `RULES.stereotype` (keys,
  the uniques: `(workspace_id, code)` over every row, `(workspace_id, name_key)` live; the CHECKs of F3 and a definition
  never empty), `DEV_DB_FORMAT` 16 and the upgrade 15 → 16 in `upgradeDb` (`file.ts`): per workspace the five rows, new
  ids, English names, definitions in the workspace's `doc_language`, signed by the workspace's creator at the upgrade's
  time (as slice 8's access rows), no change events, no log line. Every entity's code is one of the five in any file the
  CHECK guarded (Q9: none outside them on KB); **proposal** for a code outside them all the same: an own row named by the
  code, without a definition (the prototype's seeding does that), and one log line, so the file still loads. The SQL
  migration is DDL only (AD-31: no database holds data), as slice 23's: the table, RLS, the uniques, the CHECKs, the
  entity's CHECK dropped and F1's key.
- **Q4's creation:** `builtinStereotypeRows(ctx, workspaceId, language)` in `newWorkspaceRows` (both creations, so the
  language select of slice 23 applies), and `addBuiltinStereotypes` with stable seed ids (`seedId(ws, "stereotype:object")`)
  in `seed.ts` and `seed-large.ts`.

**Tests and runs**

- **F25. The guard test.** `tests/table-registry.test.ts` reads every table the migrations create: `stereotype` must be in
  `UNDOABLE_TABLES`, `RULES` and the file's shape. Its line 207 and `tests/infocube-c7.test.ts:231` write entities into a
  fresh file: with F1 (a) that file needs the workspace's five rows (a fixture helper).
- **F26. Runs.** Step 2 changes the local adapter (F1 a), undo (F2) and the format (F19): one full run in step 2 (the
  "Test runs" exception), and one before the merge. Step 3 changes no shared infrastructure.

### Answers to the PRD's questions

**Q1. The table.** A core table (InfoMapper's, not a module's): `stereotype` with the standard columns, `workspace_id`,
`code`, `name`, `name_key`, `definition`, `origin` (`builtin`, `own`). In `UNDOABLE_TABLES` with no `PARENTS` (it points
to its workspace only; entities point to it by code, F2). Uniqueness: `(workspace_id, code)` over every row, deleted ones
included (F4), plus D-78's comparison in the domain (F5, F7); `name_key` written by the server with `normClassification`,
unique among live rows; names also against every row's code (F5). Built-in rows never deleted (F3). The local file's
format 16 (F19).

**Q2. `entity.stereotype`.** The CHECK goes; a composite foreign key replaces it in SQL and in the local adapter (F1,
recommended), with the live list checked by `updateEntity` (F15) and by undo (F2). The paths that write it: `createEntity`
(`object`, both levels: the canvas's create, the toolbox, the Model tab's create, InfoCube's creates through
`src/modules/infocube/domain/commands.ts:48`, "Create dimension from this…"); `updateEntity` (the panel's select);
`removeStereotype`'s move (new, F16); undo and redo (images); the seeds and the format's upgrade. Not: imports (they make
source tables and attributes, never entities), copies (an attribute's paste, slice 10c), concept merges and moves (they
write `concept_id` through `nextVersion`, keeping the code), the canvas's duplicate (cards, not entities). No workspace
duplicate, transfer or export exists (Q7). An unknown code from a file: refused by the adapter's key (F1 a) and by
`updateEntity` (F15); an older file's unknown code becomes an own row at the upgrade (F19).

**Q3. Where a stereotype shows and where a code is read.** Shown: the card's first line (with the definition as its
title, F13), the Model tab's meta, the entity panel's select and the definition under it (F12, F24), and the new box.
Read as a code: `createEntity`'s default, the seeds, nothing else (F14). Search, filters, the model tree's matching,
imports, exports, model checks, thumbnails and InfoCube's C-5 read no stereotype; C-5 keeps `object` because
`createEntity` writes it and `updateEntity` refuses a change on a fact or a dimension.

**Q4. Creation and migration.** F19 and "Q4's creation" above: the texts per language in
`src/domain/model/stereotypes.ts` (`BUILTIN_STEREOTYPE_TEXTS`, Appendix A's table), the rows in `newWorkspaceRows` and the
seeds, the upgrade in `upgradeDb`, a DDL-only migration.

**Q5. The commands** (`src/domain/commands/stereotype.ts`, actions in `src/app/_actions/stereotype.ts`, all
`model.edit`, D-57's roles, each one change group): `addStereotype({ name, code })` (F5, F6, F7; a new row, nothing to
version-check), `renameStereotype` and `setStereotypeDefinition` (the row's `expectedVersion`, D-59, through `saveRow`;
unchanged or empty name: nothing written, as the classifications' `useDraft` with `required`), `removeStereotype` (F16).
No delete preview read: the page has the count (F22), the server recounts.

**Q6. The panel's select.** F24.

**Q7. Duplicating, transferring and exporting a workspace.** The app has none of the three (the canvas menu's "Duplicate
layout" copies a canvas's cards). A new workspace, by either creation, gets the five rows; when such a feature comes, the
list goes with it by code (own codes included). An organization's default conventions (D-78's later item) match by code.

**Q8. Earlier specs and fixtures.** See "Earlier specs and fixtures" below. No earlier spec reads a stereotype's English
name on a card or in the tree; the select is read by value (codes), which do not change.

**Q9. KB (a copy of the backup of 8 November 2026, 22:44; counts only).** Format 13 (before slice 18's 14 and slice 23's
15: the manual acceptance upgrades it 13 → 16 after the fresh backup "Łukasz's test model" requires). One workspace,
English. Live logical entities: `object` 11, `dictionary` 10, `link` 2; live dimensional entities: `object` 6; deleted:
`object` 3. No entity in the whole file has a code outside the five.

### Differences between the prototype and the app that the slice touches

- **Storage:** the prototype keys built-in ones by their English names (`Object`…) and shows `object`…; the app keeps
  codes everywhere (the PRD says so).
- **Removal:** the prototype drops an own row from its list and keeps its code in `stCodes`; the app soft-deletes the row
  (F4).
- **Refusals:** the prototype shows a rename's "That name is taken." as a toast and the add's errors as the browser's
  validity bubbles; the app shows them under the fields (F8, proposal).
- **A definition:** no toast in the prototype; the classifications' toasts in the app (F9, proposal).
- **A rename's check:** the prototype's rename does not compare with removed codes; the app does (F5, proposal).
- **The code field:** the prototype's "touched" mark is never reset; the app resets it after a successful Add (F6).
- **Older data:** the prototype's one-time seeding adds an own row for any unknown stereotype; the app's upgrade does the
  same for a code outside the five (F19, proposal; none exists).
- **Not in the app, left as is:** the baseline view's heading (the prototype's line 5952; the app has no baseline view)
  and the entity panel's Data Vault hint for `Link` (PRD item 12).
- **Settings:** the prototype loses its chips; the app never had them (slice 23, F12).

### Every new UI text

The tab (the prototype's texts; the PRD's where it gives them):
- Box: "Entity stereotypes"; hint: "What an entity is in the model. Names and definitions are the workspace's; codes
  never change, so entities, imports and exports keep them while names change. The five built-in ones stay (Object is a
  new entity's stereotype and every fact's and dimension's); own ones can be added and removed. Facts and dimensions
  show their InfoCube role instead."
- Columns: "Name", "Code", "Definition", "Used", (empty); chip "own"; "{n} entities", "1 entity", "unused"; the
  definition's placeholder "What it means, when to use it"; button "Remove".
- Add: placeholders "New stereotype, e.g. Event" and "Code, e.g. event"; button "Add"; hint "The code is proposed from
  the name; letters, digits and _, starting with a letter. It cannot change later."; errors "That name is taken",
  "Letters, digits and _; starting with a letter", "That code is taken"; toast "Stereotype “{name}” added ({code})."
- Rename: toast "Renamed to {name}; entities keep the stereotype."; error "That name is taken" (F8).
- Definition: toasts "Saved the definition of {name}." and "Cleared the definition of {name}." (F9, proposal).
- Remove: toast "{name} removed." (with Undo); dialog title "Remove {name}?"; "{n} entities have this stereotype. Choose
  the one they get instead:" / "1 entity has this stereotype. Choose the one it gets instead:"; label "Stereotype"; "One
  undo step brings back the stereotype and every entity's."; buttons "Cancel" and "Remove and move {n} entities" /
  "Remove and move 1 entity"; toast "{name} removed; {n} entities are now {other}." / "{name} removed; 1 entity is now
  {other}." (F17).
- The intro: "The workspace's conventions, in one place. The import matches classifications by their name or code; table
  and column panels set them; entity panels offer the stereotypes; documents and exports print their definitions."
- The last line: "Later, in their own slices: the map from physical to logical types, an organization's default
  conventions."

Elsewhere:
- Settings: "Classifications, entity stereotypes, concept colours and naming conventions are edited in" + "Metadata
  conventions".
- The undo history (F10): "Add stereotype {name}", "Rename stereotype {name}", "Change definition of {name}", "Remove
  stereotype {name}".
- Refusals (proposals): "That stereotype is not in the list." (F15), "A built-in stereotype can't be removed.", "Choose
  the stereotype they get instead." (F16), "This can't be undone: the stereotype {name} is no longer in the list.",
  "This can't be undone: another stereotype is called {name} now." (F2).
- Built-in names and definitions: Appendix A (English, Polish, German).

### Earlier specs and fixtures each step touches

- **Step 2 (unit tests and fixtures):**
  - `src/domain/commands/entity.test.ts` (the code checked against the list), `workspace.test.ts` (a creation's events:
    24 → 29), `organization.test.ts` (the first workspace's rows), `undo.test.ts` (F2), `src/domain/model/change-label.test.ts`
    (F10), `src/data/local/model-store.test.ts` (:394's refusal by the key, F1), `upgrade-15.test.ts` (it reads the
    format constant; a new `upgrade-16.test.ts`), `tests/table-registry.test.ts` and `tests/infocube-c7.test.ts` (F25).
  - `stereotypes: […]` in the `WorkspaceModel` literals (F11): `src/app/_panels/model-index.test.ts`,
    `stats-derivations.test.ts`, `stats.test.ts`, `tree-data.test.ts`, `src/canvas/canvas.test.ts`, `card-names.test.ts`,
    `labels.test.ts`, `lines.test.ts`, `source-lines.test.ts`, `src/domain/commands/attribute.test.ts`,
    `src/domain/import/classifications.test.ts`, `src/domain/model/lit.test.ts`, `thumbnail.test.ts`,
    `src/domain/source-changes/settle.test.ts`, `src/domain/__fixtures__/import.ts`, `tests/infocube-lines.test.ts`,
    `infocube-unknown-member.test.ts`, `model-checks.test.ts`, `scripts/lib/checks-model.ts`; and the code that builds
    one (`src/domain/commands/import.ts`, `source.ts`, `src/domain/import/apply.ts`, `materialize.ts`,
    `src/app/_actions/model.ts`, `source-change.ts`).
  - Fixtures: `src/domain/__fixtures__/domain.ts` (the workspace's rows), the seed (`seed.ts`, `seed-model.ts`,
    `seed-large.ts`), `scripts/lib/synthetic-checks.ts` and `star-canvas.ts` (entities on `object` in synthetic files).
  - e2e: `S8-02` counts a new organization's classifications; it may count the five stereotypes too (optional, no change
    needed). `S0-09` filters the project's creation and is not affected.
- **Step 3 (interface):** `S23-01` (the intro and the last line, F20), `S23-06` (Settings' sentence, F23),
  `S23-screens` (shot again with the new box). Read, not changed: `S1A-11` (the select disabled), `S9-04`, `S13-05`,
  `S13-08`, `S13-14`, `S13-screens`, `S14B-09` (they choose and read codes), `S15-07` (no select on a fact). The element
  guard (`S3B-15-elements`, F13) and the canvas commit counts (`S2C-12`, `S3A-14-idle`).

### The plan for steps 2 to 4

- **Step 2, data and domain** (draft PR at the start): `src/domain/model/stereotypes.ts` (codes, texts, rows, order,
  comparison, `proposedCode`, `stereotypeIndex`); the type changes (F15); `src/domain/commands/stereotype.ts` (add,
  rename, definition, remove with move) and `updateEntity`'s check; `newWorkspaceRows`; undo's registration and F2's two
  refusals; `change-label.ts` (F10); the local adapter: the table, its rules, the composite key (F1 a), format 16 and its
  upgrade (F19); the store's `model.load` (F11); the seeds; the migration; `data-model-v2.md`; the server actions; unit
  tests for every rule. One full run (F26). Stop.
- **Step 3, interface:** the box and its rows, the add row with the proposal, the remove dialog
  (`src/app/w/[workspaceId]/_components/conventions.tsx`, perhaps a file of its own for the box), Used (F22), the intro
  and the last line; `buildCards` (`line1` from the index, `line1Title`), `CardNode`'s title, `tree-data.ts`, the
  entity panel's select and definition (F24); Settings' sentence; S24-01 to S24-07 and `S24-screens`; the earlier specs
  above; the element guard and the commit counts. Stop.
- **Step 4, closing:** D-79 quoted for approval; `decisions.md` (D-78's later list), `data-model-v2.md`, `ideas.md`,
  `inventory-prototype-vs-app.md`, `known-limitations.md` (F4's code after an undone add), README, CLAUDE.md; one full
  run on the final commit; the manual acceptance steps (demo and KB, the backup first). Merge and tag only on Łukasz's
  command.

### Questions for Łukasz before step 2

1. **F1, the CHECK's replacement:** (a) a composite foreign key in SQL and in the local adapter (recommended), (b) in SQL
   only, or (c) the domain alone?
2. **F2, undo:** the two refusals and their texts, as proposed?
3. **F5:** names compared with every row's code, removed and deleted ones included, in both add and rename
   (recommended), or the prototype's rename against live rows only?
4. **F6:** the prototype's code proposal (runs collapsed, ends trimmed, `ł`, `s_` before a digit), as proposed?
5. **F8:** errors under the fields, as the classifications' (recommended), or the PRD's toast for a rename?
6. **F9:** the classifications' toasts for a definition (recommended), or none, as the prototype?
7. **F14:** S24-07 as the list of the app's actual readers (recommended)?
8. **F18:** English names for every existing workspace, Polish and German ones included, as decision 7 says
   (recommended)?
9. **F19:** a code outside the five in an older file becomes an own row with a log line (recommended), or the file is
   refused?
10. **F11:** `stereotypes` required on `WorkspaceModel` (recommended), or optional?
11. **F24:** each option's definition as its title, as the prototype (recommended)?

## Step 1: Łukasz's answers (10 November 2026)

1. **F1:** the domain checks the code on every write and is the source of truth now. The composite foreign key on
   `(workspace_id, code)` goes into the SQL migration only; the local adapter gets no foreign key that does not point to
   an `id`. That difference is listed in `known-limitations.md`.
2. **F2:** yes, both undo refusals with the proposed texts.
3. **F5:** yes. A name equal to any code, removed ones included, is refused, when adding and when renaming.
4. **F6:** yes, the prototype's proposal as it is.
5. **F8:** yes, errors under the fields, as the classifications show them.
6. **F9:** yes, the classifications' toasts for a definition saved or cleared.
7. **F14:** yes. S24-07 tests the app's actual readers: `createEntity`'s default `object` (logical entities, and
   InfoCube's facts and dimensions), the seeds, and every entity's code unchanged after renaming all five.
8. **F18:** yes. English names for every existing workspace, as decision 7 says; definitions in its documentation
   language.
9. **F19:** yes. An own stereotype and one log line.
10. **F11:** yes, required on `WorkspaceModel`.
11. **F24:** yes, each option's definition as its title.

Step 2 has its full run (the format and undo).

## Step 2: data and domain (10 November 2026)

Draft PR: https://github.com/LukaszWolski-DA/infomapper-app/pull/53, opened at the start of the step.

### What changed

- **Migration** `supabase/migrations/20261110180000_entity_stereotypes.sql` (DDL only, AD-31): the table `stereotype`
  (RLS on) with `stereotype_origin_ck`, `stereotype_code_format_ck`, `stereotype_builtin_code_ck`,
  `stereotype_builtin_kept_ck` (F3) and `stereotype_definition_ck`; the unique index on `(workspace_id, code)` over every
  row and on `(workspace_id, name_key)` among live rows; `entity_stereotype_ck` dropped, `entity_stereotype_code_ck`
  (the code's shape) and the composite key `entity_stereotype_fk` on `(workspace_id, stereotype)` with its index (F1, in
  SQL only).
- **Types** (`src/domain/types.ts`): `Stereotype` is the list's row (`code`, `name`, `name_key`, `definition`, `origin`
  `builtin` / `own`), `StereotypeCode` (a string) is what `Entity.stereotype` holds; `STEREOTYPES` is gone;
  `WorkspaceModel.stereotypes` (required, F11), the table in `CoreWritableRows`.
- **The rules** (`src/domain/model/stereotypes.ts`, new): `BUILTIN_STEREOTYPE_CODES`, `DEFAULT_STEREOTYPE` (`object`),
  `BUILTIN_STEREOTYPE_TEXTS` (Appendix A word for word), `builtinStereotypeRows(ctx, workspace, language, names?)`, the
  list's order, `proposedCode` (the prototype's `stSnake`, F6), `typedStereotypeCode`, `stereotypeNameTakenBy` and
  `stereotypeCodeRefusal` (F5: a name against every live name and every row's code, its own code excepted; a code
  against every row's code and every live name), `stereotypeIndex` (`live`, `of`, `name`, `definition`),
  `stereotypeUses` (live logical entities per code), and the write rule (`writesStereotypeCodes`,
  `stereotypeWritesRefusal`, `entityWithoutStereotype`, "That stereotype is not in the list."). A built-in code is
  always live (the five rows exist in every workspace and are never deleted), so the rule reads the model only when a
  write puts an entity on an own code or removes a stereotype.
- **Commands** (`src/domain/commands/stereotype.ts`, new; all `model.edit`, one change group each, named for the
  history): `addStereotype` (the code required, lower-cased), `renameStereotype`, `setStereotypeDefinition` (trimmed,
  empty clears), `removeStereotype` (own only; a used one needs `moveTo`, another live stereotype; its live entities
  move in the same group; F16), with the toasts' texts. `createEntity` writes `DEFAULT_STEREOTYPE`. `updateEntity`
  checks a chosen code against the workspace's live list; its state's `stereotypes` is optional, and without it only a
  built-in code passes (callers that change no stereotype, the earlier tests and e2e helpers, stay as they were).
  `newWorkspaceRows` writes the five rows in the workspace's language (both creations).
- **The write rule on every write** (`runCommand`, `src/app/_lib/run-command.ts`, beside the level rules): F1's domain
  check, whatever command built the writes.
- **Undo** (`undo.ts`): `stereotype` in `UNDOABLE_TABLES`; `stereotypeNameClash` (F2 ii,
  `STEREOTYPE_NAME_CLASH`) and `stereotypeGone` (F2 i, `STEREOTYPE_GONE`), both with step 1's texts.
- **The undo history's names** (`change-label.ts`): "Add stereotype {name}", "Rename stereotype {name}", "Change
  definition of {name}", "Remove stereotype {name}" (with its moved entities).
- **Actions** (`src/app/_actions/stereotype.ts`, new): add, rename and definition (`Saved`, for the save chain), remove;
  `updateEntityAction` passes the list. No UI uses the new ones yet (step 3); the entity panel's select shows the five
  codes as before.
- **The local file's format 16** (`schema.ts`, `file.ts`, `upgrade-16.ts`): the table and its rules (the CHECKs above;
  the code's uniqueness over every row; no key on the entity's code, F1); the entity's check is its code's shape; the
  upgrade from 15 writes every workspace's five rows (English names, definitions in its language, F18), and an own row
  for any other code an entity has with one log line (F19); no change events.
- **The seeds** (`seed-model.ts` `addBuiltinStereotypes`, `seed.ts`, `seed-large.ts`): each workspace's five rows in its
  language with stable ids ("Sales analytics" in Polish).
- **Docs**: `data-model-v2.md` (the table, the entity's column, the rule), `known-limitations.md` (F1's missing key in
  the local adapter; F4's code after an undone add).

### Found on the way: `data-model-v2.md` was broken by slice 23

Slice 23's step 2 (`c883dfd`) edited `docs/data-model-v2.md` with a JavaScript `replace` whose replacement text held
`` $` `` (the end of the pattern `{0,29}$` and a backtick), which JavaScript reads as "the text before the match": the
file's first 375 lines were pasted into the classification table's `code` row, and the document had two titles. It is on
`main` since PR 52. Repaired in its own commit (`bfa4c58`): the pasted block taken out and `` $` `` put back; the repaired
file differs from slice 22's only by slice 23's intended changes (checked with `diff`). Only Markdown; I wrote these docs'
edits with the Edit tool so nothing in them is read as a pattern.

### Tests

- New unit tests: `src/domain/model/stereotypes.test.ts` (the texts in three languages, the rows per language and with
  English names, the order, the proposal, typed codes, names and codes in both directions with the own-code exception and
  removed rows, the index, the uses, the write rule), `src/domain/commands/stereotype.test.ts` (add, its refusals and
  roles, rename with the version check and its refusals, the definition, both removals and their refusals, the
  entity's code against the list and on a fact), `src/data/local/upgrade-16.test.ts` (the upgrade, the own row and its
  log line, written back once, not repeated, the seed in its languages with stable ids, the adapter's CHECKs and the
  code's uniqueness over deleted rows), `undo.test.ts` (a rename undone, a removal with its move undone and redone, a
  code kept after an undone add, both refusals), `workspace.test.ts` (the five rows in Polish, German and English).
- Changed for the new table (F11, F25): the `WorkspaceModel` literals and undo row fixtures (`stereotypes: []`,
  `stereotype: []`), `workspace.test.ts` and `organization.test.ts` (five more inserts; 29 events), `model-store.test.ts`
  (Bank X has its five rows; the adapter refuses a code of the wrong shape and lets a well-formed unknown one through,
  which the domain refuses), `tests/schema/compare-schema.test.ts` (the table).
- `npm run lint`, `npm run typecheck`: clean. `npm test`: 2,075 tests passed.
- No earlier e2e spec changed in this step.
- **Do not run `npm run dev` on this branch with `.data/dev-db.json`**: it upgrades the file to format 16, which is
  for Łukasz's manual acceptance after the backup ("Łukasz's test model"). The e2e runs use their own file.

### The full run (step 2: the local file's format and undo changed)

- [Run 42813994186](https://github.com/LukaszWolski-DA/infomapper-app/actions/runs/42813994186) on `c95e9b8`, the
  workflow "E2E", all eight parts, no retries: **723 passed, 0 failed, 4 skipped, 0 flaky**, no expected failures. CI
  (lint, typecheck, unit tests) and the schema check (the migrations on Postgres against the domain's types) passed on
  the same commit.
- Wall-clock 16 min 10 s (12:14:03 to 12:30:13 UTC); the tests 14 min 11 s.
- Parts (time; heap peak, against the runner's restart threshold of 6,431 MB, 80 % of its 8,039 MB limit; no server
  restart in any part): 1: 6.3 min, 985 MB · 2: 8.0 min, 1,269 MB · 3: 8.9 min, 1,051 MB · 4: 7.8 min, 1,136 MB ·
  5: 9.1 min, 1,668 MB · 6: 9.7 min, 1,079 MB · 7: 10.2 min, 972 MB · 8: 10.0 min, 1,488 MB.
- A commit after `c95e9b8` that touches only Markdown in `docs/` and the root keeps this run valid
  (`git diff --stat c95e9b8..HEAD`).

## Step 2: Łukasz's acceptance and the point settled (10 November 2026)

Step 2 accepted, with one point settled before step 3:

- **`updateEntity`'s list is required** (F1: no write skips the check). `UpdateEntityState.stereotypes` is no longer
  optional: a chosen code passes when it is built in (always live: the five rows exist in every workspace and are never
  deleted) or a live own one of the list; anything else is "That stereotype is not in the list.". Its only caller in the
  app, `updateEntityAction`, passes the workspace's list from the model it loads, and `runCommand`'s rule checks every
  write as before. The callers that only build test data pass a list too (type-level changes, no behaviour):
  `e2e/slice-01b/S1B-12.spec.ts`, `e2e/slice-04a/S4A-05.spec.ts`, `e2e/slice-11/S11-07.spec.ts`,
  `e2e/slice-11/helpers.ts` (`setEntityAlias`), `e2e/slice-13/helpers.ts` (`changeEntityAsAnna`), and the unit tests
  `aliases.test.ts`, `entity.test.ts`, `stereotype.test.ts`, `undo.test.ts`. `npm test`: 2,075 passed.
- **The repair of `docs/data-model-v2.md`** (`bfa4c58`, "Found on the way" above) is named in the PR's description.

## Step 3: interface (10 November 2026)

### KB's file was upgraded to format 16 before the manual acceptance

While step 2 was being built, a `next dev` started from this checkout (port 3000, from 12:18; not started by me) served
the working tree. The format-16 upgrade code was in the tree from 12:56, and `.data/dev-db.json` was written at 12:59:36:
a page load read the file and the upgrade wrote it back. I found it in step 3 (the port in use) and stopped before any
run; Łukasz stopped the server. Then, on his file:
- **Backup** `.data/backups/dev-db-20261110-1414.json`, also `.data/backups/kb-model-latest.json` (both equal to the file,
  `cmp`); the backup of 8 November 22:44 (format 13) is kept as it was.
- **A read-only count on a copy of the new backup** (counts only, the copy deleted): format 16; 4 workspaces, 20
  stereotype rows; KB's workspace has its five built-in rows (no own one, so no log line) and its live entities keep
  their codes: `object` 17 (11 logical, 6 dimensional, as Q9 counted on 8 November), `dictionary` 10, `link` 2.
- The upgrade only adds the five rows per workspace (English names, definitions in the workspace's language): no
  entity and no other row changed, and no change event. The file now needs this branch or a later one; an older branch
  refuses it with the "newer format" message (slice 15a).
- For the manual acceptance (step 4): the step "back up, then let the upgrade run" is already done; the steps that check
  KB's five stereotypes and its entities' codes stay.

### What changed

- **The box** (`src/app/w/[workspaceId]/_components/stereotypes-box.tsx`, new; `conventions.tsx` places it between
  Classifications and Concept colours): the prototype's hint; a row per live stereotype in the list's order with its
  name (D-66's draft, saved on leaving it on the row's chain; a taken name refused under the field with "That name is
  taken", F8; the toast "Renamed to {name}; entities keep the stereotype." with Undo), its code, its definition (plain
  text, the classifications' toasts with Undo, F9), Used ("n entities", "1 entity", "unused"; live logical entities) and
  Remove for an own one with the chip "own"; the Add row (the code proposed from the name with `proposedCode` until the
  code field is edited by hand, F6; errors under the fields; the toast "Stereotype “{name}” added ({code})." with Undo;
  the hint). Removing an unused own one is at once ("{name} removed." with Undo); a used one opens the dialog (the
  question, the select of every other live stereotype, the note, Cancel, "Remove and move {n} entities"; singular forms,
  F17), whose toast takes the server's count. Read only for reviewers, readers and an archived workspace.
- **The tab's lines** (`conventions.tsx`): the intro gains "entity panels offer the stereotypes;", the last line drops
  the stereotypes. **Settings' sentence** (`settings-form.tsx`): "Classifications, entity stereotypes, concept colours and
  naming conventions are edited in".
- **The three places that show a stereotype** (F12), each through `stereotypeIndex` (a built-in code without a row reads
  as its English name, as before):
  - the card's first line (`buildCards`, `card-data.ts`): the workspace's name; `CardData.line1Title`, the definition,
    only when there is one, as the `.stereo` span's `title` (`CardNode.tsx`): an attribute, no element;
  - the Model tab's meta (`buildTree`, `tree-data.ts`; `left-panel.tsx` unchanged);
  - the entity panel's select (`entity-panel.tsx`): the live list in order, value the code, text the name, each option's
    definition as its `title` (F24), the chosen one's definition under it (`text-entity-stereotype-definition`).
- **The page** (`src/app/w/[workspaceId]/page.tsx`): the box gets every stereotype (removed ones too) and `stereotypeUses`.

### Tests

- **Unit:** `canvas.test.ts` (the card's name and title, none without a definition), `tree-data.test.ts` (the meta),
  `stereotypes.test.ts` (a built-in code without a row); `tests/infocube-lines.test.ts`'s loose model takes the list.
  `npm run lint`, `npm run typecheck`: clean. `npm test`: 2,077 passed.
- **S24-01 to S24-07** (`e2e/slice-24/`, 14 tests): all passed locally. S24-04's first run read the list from the page
  before the new row reached it (the data file is written before the answer, CLAUDE.md); it now waits for the page's
  list, its assertion unchanged.
- **Earlier specs** (locally, 75 tests): `S24-04`, `slice-23` (all), `S1A-11`, `S9-04`, `slice-13` (all), `S14B-09`,
  `S15-07`, `S4A-05`, `S1B-12`, `slice-11` (all): 73 passed, 1 skipped, 1 failed (`S23-02`, below).
- **Earlier specs changed**, all on the acceptance doc's lists: `S23-01` (the intro and the last line, item 8), `S23-06`
  (Settings' sentence, item 11); and the type-level test-data helpers of "Step 2: … the point settled".
- **The element guard** (`S3B-15-elements`, measurement build, against `slice-08.json`): passed; viewport 4,508, 19,305,
  1,465, 4,907 and page totals 6,135, 20,932, 3,002, 6,444, all equal to slice 22's. The card's label changes its text
  and gains a `title` on the same element; no element is added, so no measuring sitting.
- **The canvas commit counts:** `S2C-12`, `S3A-14-idle` (both), `S3B-15-idle`: 4 passed.
- **Screenshots** (`e2e/slice-24/S24-screens.spec.ts`, `SCREENS=step-3`): `docs/prd/slice-24-screens/step-3/`
  (`box-*`, `remove-*`, `panel-*`, light and dark). The dialog's shot waits for its fade-in (it opens at once, unlike
  slice 23's, which reads its impact first).

### S23-02 fails now and then locally (found in this step, not fixed: shared infrastructure)

`S23-02`'s first test types a classification's definition, waits for its toast and for the stored value, presses the
top bar's Undo, sees the toast "Undone: …" and the stored value back, and expects the field to show it. In 3 of 9 local
runs the field kept the typed (trimmed) text for the whole 15 s:
- 1 in the run above; 1 of 3 runs on its own on `2ef3cde` (step 3); **1 of 5 runs on its own with step 3's changes
  stashed** (`d1ab542`): step 3 does not cause it.
- The single-file check on GitHub, 3 rounds each: `main` (`239ffad`, slice 23)
  [run 42826181680](https://github.com/LukaszWolski-DA/infomapper-app/actions/runs/42826181680) 3/3 passed; this branch
  (`2ef3cde`) [run 42826198511](https://github.com/LukaszWolski-DA/infomapper-app/actions/runs/42826198511) 3/3 passed.
  It passed in step 2's full run and in slice 23's runs.
- The trace (`.data/traces/s23-02-20261110/`, git-ignored, with the run's log): every server action answered with 200,
  the undo's answer (665 ms) carrying the fresh page; the undo was pressed about 0.4 s after the definition's save was
  sent. The field kept its draft although its stored value changed: the draft rules (`useDraft`, `field-draft.ts`) and
  the save chain's answer after the page (`afterPage`, `rowSaves`), shared infrastructure (CLAUDE.md, the slice cycle,
  4). I did not prove the exact interleaving; I have not reproduced it on `main` locally (the checkout is on this branch).
- **Proposal:** its own `fix/` branch from `main`: reproduce on `main` locally, find the interleaving from the trace,
  fix it with its own full run. The slice does not change the test.

### How to check it by hand

On the demo data (`npm run demo`, http://127.0.0.1:3001, `.data/demo-db.json`; it never touches `.data/dev-db.json`),
signed in as Łukasz, Retail Co – DWH, the workspace home's "Metadata conventions":
1. "Entity stereotypes" between Classifications and Concept colours: five rows, codes, English definitions, Object
   "4 entities" (the star's facts and dimensions not counted), no Remove on them.
2. Rename Link to "Association": the toast, Undo in the top bar and Redo. Try "OBJECT": "That name is taken" under it.
3. Open Customer 360 › Customer & orders: Order Line's card says "Association", its title (hover) the definition; the
   Model tab says "Association"; Order Line's panel shows it selected with the definition under it.
4. Back in the tab: type "Event" in the Add row (the code says `event`), change the code to `business_event`, Add; choose
   it on Customer in its panel (last in the select).
5. Remove "Event": the dialog asks where Customer goes; choose Context; the toast; Undo brings back both.
6. Create a workspace in Polish from the top bar: its tab shows Obiekt, Powiązanie, Słownik, Kontekst, Informacyjna.
7. As Piotr (reviewer) or Kasia (reader): the box is read only.
