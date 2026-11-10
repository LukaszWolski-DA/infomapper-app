# Slice 23 – acceptance

PRD: [`slice-23-metadata-conventions.md`](slice-23-metadata-conventions.md). Branch `slice/23-metadata-conventions`.

## Step 1: the PRD checked against the code (10 November 2026)

### The starting point

- **The branch.** `slice/23-metadata-conventions` was cut from the tag `slice-22` (`b40b97f`, the merge of PR 51),
  which is `origin/main` and the local `main`.
- **No run in this step.** No dev server, e2e run, unit test, lint or bench ran. One read-only count ran on KB (Q10): a
  copy of `.data/backups/kb-model-latest.json` (8 November 2026, 22:44) in the scratchpad, counts printed, the copy
  deleted. `.data/dev-db.json` was not read or written.
- **The two files from Łukasz's Downloads**, each checked with `cmp` after the copy and with `sha256sum` against the
  prompt's value, and committed with this document (neither has a carriage return, so the committed bytes are the
  files'):

  | File | SHA-256 | `cmp` |
  | --- | --- | --- |
  | `docs/prd/slice-23-metadata-conventions.md` (new, 23,757 bytes) | `c343169e72f683a1cf4da7c78099f2659f7be220bf1d4cd8855ee1d7f9bfe3e3` | equal |
  | `docs/prototype/infomapper-prototype-with-sources.html` (736,807 bytes, replaces slice 22's `3b77c53a…`) | `bf7cbb6af3619699128823f1a1cf635f2ffecdc6f097d8fa8b183927f700c8de` | equal |

- **The prototype is built on slice 22's.** Against the file at tag `slice-22` the new one adds 143 lines and removes 5,
  in 10 places, and every one is on the PRD's list (section 4): the CSS (`.cv-*`, 28 lines); `idx()`'s call of
  `window.__conv23`; the workspace home's tab bar (`["conv", "Metadata conventions"]` between People and Settings) and
  its body (`CONV.tab()`); Settings' colours box hidden (`display:none`) and "Model conventions" with its sentence and
  button; the home's click and change handlers handing over to `CONV`; `indexClasses` reading `S.conv`;
  `[data-imx-opencls]` opening the tab instead of `openSettings`; the module `CONV` (104 lines). Nothing else differs.

### Summary

The PRD's shape holds and most of it is already prepared by slice 7c: the import's matcher reads every row that has a
code (`matcherOf`, `src/domain/import/plan.ts`), so an own code matches with no change to the engine; the unique index
on codes already includes removed rows; the workspace home already loads the whole model; and an impact read for a
removal exists and is unused (`classificationImpactAction`). Twenty-one places need a decision or a correction. The
four that change what the slice is:

1. **F1, no language at creation.** A new workspace is always English (`newWorkspaceRows` writes `doc_language: "en"`)
   and neither the top bar's "New workspace" field nor the organization's creation asks for a language; the prototype
   doesn't either. S23-05 ("a new workspace with documentation language Polish") cannot happen in the app as it is
   (question 1).
2. **F3–F5, an own code breaks three of 7c's assumptions.** The CHECK `classification_code_ck` forbids a code on an own
   row; six places read "has a code" as "is built in"; and codes are matched normalized (`HASH_KEY` and `HASHKEY`,
   `T_HUB` and `THUB` are one value to the import), so uniqueness by the exact code is not enough.
3. **F11, the naming conventions and undo.** The workspace row is outside undo (D-12's rule for settings,
   `UNDOABLE_TABLES`), and the settings' command is for owners and admins only. The PRD's roles (D-57's) need a command
   of their own; undo needs either "outside undo" or a table of its own (question 5).
4. **F12, Settings has no "Model conventions" box.** Item 12 changes a box the app never had (it is on the
   inventory's "still missing" list, `docs/inventory-prototype-vs-app.md`).

Step 2 changes the local adapter (the format, a CHECK) and undo (the name clash): **both are on the "Test runs"
exception list, so step 2 has a full run** (S23-08 foresaw it).

### Findings

**F1. A workspace's language at creation (items 9, 11; decision 4; S23-05).**
- `newWorkspaceRows` (`src/domain/commands/workspace.ts`) writes `doc_language: "en"`; `createWorkspaceInput` is
  `{ organizationId, name }`, strict. Two callers: `createWorkspaceAction` (the top bar's "New workspace" field,
  `src/app/_components/top-bar.tsx`, a name and Enter) and creating an organization (`src/domain/commands/organization.ts`,
  its "First workspace"). The prototype's field is also a name only (`#ws-new`), and its `CONV.conv()` seeds lazily, on
  the first visit, in the language the workspace has then.
- So in the app every new workspace starts English, and decision 11 (a later change renames nothing) means a Polish or
  German workspace could never get the Polish or German texts except by hand.
- **Proposal (a, recommended):** a "Documentation language" select (English, Polski, Deutsch, default English) next to
  the name in both places: the top bar's create field and the organization's creation form. `createWorkspace` and
  `createOrganization` take `docLanguage` (optional, `en` when absent) and write the built-in rows in it. New UI the
  prototype does not have: Łukasz decides.
- **(b):** the top bar's new workspace takes the language of the workspace it is created from; an organization's first
  workspace is English. No new UI, but invisible.
- **(c):** leave creation English and test S23-05 through the domain only (`createWorkspace` with a language in a unit
  test); in the app it would never happen. Not recommended.

**F2. Existing workspaces: names kept, definitions filled (items 10, 11; Q2).**
- The prototype gives an existing workspace both the names and the definitions of its language (`x.name ||= …` on a
  `S.conv.cls` that is empty before slice 23): a Polish prototype workspace gets Polish names. The PRD says names stay.
  The PRD is the stricter one and matches decision 11; **proposal: the PRD (names kept, definitions filled where null,
  own ones none).**
- **The seed** (`addBuiltinClassifications`, `src/data/local/seed-model.ts`) is a fresh creation. Proposal: it writes
  each workspace as a new one would be written, in its language: "Sales analytics" (`lang: "pl"`) gets Polish names and
  definitions, the two English ones English. No earlier spec reads that workspace's classifications (the specs that
  name it, S0-02, S0-03, S8-06, S8-10 and S15-16, read none). `seed-large.ts` stays English.

**F3. The CHECK on codes (section 3, Q1).**
- `classification_code_ck check ((origin = 'own') = (code is null))` in `20261026200000_classifications.sql`, mirrored in
  `src/data/local/schema.ts` (`(r.origin === "own") === !isSet(r.code)`). An own row with a code is refused by both.
- `classification_code_ux on classification (workspace_id, code) where code is not null` has no `deleted_at`
  condition, and the local adapter's rule is the same (no `live: true`): **a removed row keeps its code taken today**,
  as the PRD wants.
- **Proposal:** a new migration drops the CHECK and adds `classification_code_ck check (origin = 'own' or code is not
  null)` and `classification_code_format_ck check (code is null or code ~ '^[A-Z][A-Z0-9_]{0,29}$')` (every built-in
  code fits it), the same two rules in the local schema, and the domain checks the pattern first (its text). A CHECK
  with a regular expression is a plain constraint, no stored function (CLAUDE.md, Data).

**F4. Codes compared as the import compares them (items 4, 6; D-57).**
- `matcherOf` keys a classification by `name_key` and by `normClassification(code)`, both in one map per scope; a second
  key silently replaces the first. D-57's rule ("one value of a file matches at most one classification", 7c's F10) holds
  today because names are checked against built-in codes. With own codes:
  - two codes that are equal after `normClassification` (`HASH_KEY`, `HASHKEY`; an own `THUB` against `T_HUB`) pass an
    exact uniqueness and collide in the import;
  - a new code equal to an existing name of its scope (an own code `HASH` while "Hash" is a name) collides too. The
    prototype checks codes only against codes and names only against names and built-in codes.
- **Proposal:** a code is "taken" when its normalized form equals the normalized code of any row of the workspace
  (removed and deleted included, both scopes, as the index) **or** the `name_key` of a live row of its scope.
  `nameTakenBy` already compares a name with every row's code (removed included), so names against own codes follow
  without a change once own rows carry codes. Both texts stay the PRD's.
- **Undo** (`classificationNameClash`, `src/domain/commands/undo.ts`) compares `name_key` with `name_key` only; a revert
  (a rename undone back to "Hash") could make a live name equal a code added since. Proposal: it also refuses a live row
  whose `name_key` equals the normalized code of another row of its scope, with the same text
  (`CLASSIFICATION_NAME_CLASH`).

**F5. "Has a code" read as "is built in" (Q1).** Six places, each to read `origin !== "own"` through one predicate
(`isBuiltin` in `classifications.ts`):
- `restoreClassification`: `before.code === null` → `ONLY_BUILTIN_RESTORED`; a removed own one with a code would be
  restorable;
- `byListOrder`: an own one with a code sorts at 999, before those without (1000); own ones must stay by name;
- `classificationIndex.byCode` is documented as "live built-in classifications by code"; own codes enter it. Harmless
  for the rules (`has(id, code: ClassificationCode)`, and no own code can equal a built-in one), but the comment and
  `whatStops` (by code, fine) are checked;
- the dialog's removed list (`c.code !== null`) and its "built in" label: both go with the dialog (F7), the tab uses
  the predicate;
- `upgrade-8.ts`'s `byCode` reads format-8 files only, unchanged.

**F6. The restore refusal's text (item 7).** The app says `RESTORE_TAKEN`: "Rename {other} first: {name} is taken."
(slice 7c, unit tests in `classification.test.ts`); the PRD and the prototype say "“{name}” is taken by another
classification; rename that one first.". **Proposal: keep the app's**, which names the other one; question 6.

**F7. The dialog needs the canvas page's model index (item 8, Q3).**
- `ClassificationsDialog`, `ListSection`, `Row` and `RemoveForm` (`src/app/_panels/classifications.tsx`) read
  `usePanel()`: `p.ix.model` (every source table and column, for the removal's labels), `p.ix.classes` (the uses),
  `p.changes` (the business key changes a removal settles), `p.editable`. The workspace home has no panel context.
- The home's page already calls `store.model.load(workspaceId)` on every tab (`src/app/w/[workspaceId]/page.tsx`), so
  the server has it all. Sending every column to the browser for one tab is not needed (20,000 in Performance test).
- **Proposal:** the page sends the tab plain rows: every classification of the workspace (live and removed: the name
  check needs the removed codes) with its use count from `indexOf(model).uses`, the workspace's Data Vault mode, the
  concepts' colour rows (as now) and the naming conventions. The removal's form reads its impact when it opens with the
  existing `classificationImpactAction` (unused today; it reads the open changes for "settles" too). The components move
  to `src/app/w/[workspaceId]/_components/conventions.tsx`; `ClassificationsSection` (the toggles) stays in
  `_panels/classifications.tsx` without the dialog.
- **The form's place.** In the dialog the form replaced the list. Proposal: a small dialog with `RemoveForm`'s content
  (uses, what stops, settles, "You can undo it right after.", Cancel and Remove), opened by Remove when the
  classification is used or a rule reads it, and Remove at once otherwise (Łukasz's rule from 7c's step 4). The prototype
  uses the browser's `confirm` with its own text; D-57 keeps the form.

**F8. Every way into the dialog (item 8, S23-07).** One: "Edit the list…" (`button-edit-classifications`) in
`ClassificationsSection`, rendered by the table and the column panels (`src/app/_panels/source-panels.tsx`). Source
panels exist only on canvas pages. Nothing else opens it. Two texts point to it:
- the import's warning `UNKNOWN_CLASSIFICATION` (`plan.ts`): "Add it to the classification list (“Edit the list…” in a
  table or column panel) to use it." Proposal: "Add it in Metadata conventions on the workspace home to use it.";
- the dialog's own description goes with it.

"Edit the list…" becomes a link to `/w/{workspace}?tab=conventions`: a page change (the leave guard applies; Back
returns to the canvas, slice 6b). Proposal: a plain push, not `replace`, so Back works.

**F9. The removed built-in ones (item 7).** The dialog lists them in one section, "Removed built-in classifications",
with "for columns"/"for tables". The PRD and the prototype list them under each table: "Removed built-in: {name}
{CODE} [Restore]". Proposal: the PRD's.

**F10. The definition's cap (item 5).** A note's text is `plainTextSchema` (`src/domain/commands/shared.ts`): up to
20,000 characters, "This text is too long.". Proposal: the same for a definition and for the naming conventions,
trimmed, empty is null.

**F11. The naming conventions: command, roles, undo (item 13, Q5).**
- Workspace fields are written by `updateWorkspaceSettings` (`workspace.edit_settings`: owners and admins), saved with
  `saveRow` on the workspace row's chain with the newest version (D-59). The workspace table is outside undo
  (`UNDOABLE_TABLES`: "Workspace settings and people are outside it").
- Making the workspace row undoable would let an undo write a whole earlier workspace row (settings included), against
  D-12 and slice 7c's mode switch. **Proposal (recommended): `workspace.naming_conventions`, outside undo like
  `doc_language`, written by its own command `setNamingConventions` for `model.edit` (owners, admins, modelers, not
  archived, D-57's roles), on the workspace row's chain (its version, D-66's draft and conflict line); a toast without
  Undo.** D-78 then says "every change is one undo step except the naming conventions, a workspace setting".
- **Alternative:** a table `workspace_convention` (one row per workspace), undoable: a migration with RLS, the
  registry's three records, undo, the local schema and the format, for one text. More cost; it would be the natural
  home of an organization's defaults later (F21), but those can be decided then.

**F12. Settings' "Model conventions" box (item 12, Q6).** The app's Settings has General, Methodology (Data Vault 2.0,
the modules' boxes, Process) and, since slice 21, "Concept colours" (`settings-form.tsx`). There is no "Model
conventions" box; the prototype's (stereotype, classification and type map chips, "Editable per workspace in the app.")
is on the inventory's missing list. **Proposal:** Settings loses "Concept colours" and gains a box "Model conventions"
with only the sentence and its button ("Classifications, concept colours and naming conventions are edited in
[Metadata conventions]."), not the prototype's chips: they are illustrations, and the type chips describe a map the app
does not have (decision 7). Question 7.

**F13. The box's language sentence.** The prototype's Classifications hint ends "This workspace started with the names
and definitions in {language}; changing the documentation language later renames nothing.", where `{language}` is the
workspace's **current** language: wrong after a change. The app stores no creation language. **Proposal:** "A new
workspace starts with the built-in names and definitions in its documentation language; changing the language later
renames nothing." Question 8.

**F14. The migration fills nothing (section 3).** Slice 7c's migration is DDL only (no database holds data, AD-31;
the local file's upgrade moves data, the database slice seeds and moves). The PRD has the migration fill the
definitions. **Proposal:** DDL only: `classification.definition text`, the two CHECKs (F3), `workspace.naming_conventions
text`; the fill is the local file's upgrade (F15) and, later, the database slice (PRD section 9 of 7c, which already
seeds the 19 rows there).

**F15. The local file's format (section 3).** `DEV_DB_FORMAT` is 14 (slice 18). Core columns are added, so **15**: a
format-14 file gets `definition` on every classification (the built-in ones' text in their workspace's
`doc_language`, own ones null) and `naming_conventions` null on every workspace; no change events and no log line, as
formats 10 to 14. The schema's comment and `file.ts`'s upgrade list grow by one line; `docs/data-model-v2.md` gets the
three columns and the CHECKs. KB's backup is at format 13 (Q10): its upgrade runs 13 → 14 → 15 in Łukasz's manual
acceptance, after the backup.

**F16. Undo and removed codes (decision 3).** Undo reverts an insert by soft-deleting the row
(`revertChangeGroup`: `base = { ...current, deleted_at }`), and the code index includes removed rows. So: "Add" of
"Hash candidate" `HASH`, Undo, Add again with `HASH` → "That code is taken"; Redo brings the first back. This is what
"removed ones too" means; it is also what keeps an undo of a removal from ever meeting a reused code. Proposal: accept,
and say so in `known-limitations.md`.

**F17. The import (item 14, Q4).** Nothing to change in the engine: `matcherOf` keys every row with a code, the server
plans again from the same list (P8), and the review's chips and "The file says …" use current names (`fileSays`). Step 2
adds unit tests: an own code matches, a value equal to an own code's normalized form matches, a removed own one's code
is unknown. Only F8's warning text changes. The source step's hint ("Codes or names separated by ;  e.g. BK;PII")
stays.

**F18. Built-in texts per language (items 9, 10; Q2).** `BUILTIN_CLASSIFICATIONS` (`classifications.ts`) has one name
per code; `builtinClassificationRows(ctx, workspaceId)` writes them. Proposal: a table of texts per language beside the
codes (`BUILTIN_TEXTS: Record<DocLanguage, Record<ClassificationCode, { name, definition }>>`, Appendix A word for word),
`builtinClassificationRows(ctx, workspaceId, language)`, and the same for the seed's `addBuiltinClassifications` and
the domain fixture (`__fixtures__/domain.ts`). English names are today's exactly (Appendix A = the app's list), so no
English workspace and no spec changes name. `builtinOf(code)` (the default name, tests and the upgrade) takes a
language.

**F19. The tab (items 1–3).**
- `TABS` (`page.tsx`) gains `conventions` between `people` and `settings`; `?tab=conventions`; the tab bar's `Link`
  with `replace` as the others (6b: a tab is no place of its own).
- Everyone who can open the workspace sees it; `can(access, "model.edit")` decides editing, and is false in an archived
  workspace (S21-05 relies on it).
- **The rename's refusal shows under the field**, as the dialog does today (`classification-name-error`, "That name is
  taken", without a full stop, checked in the browser before sending, and the server's refusal the same way); the
  prototype shows a toast "That name is taken.". Proposal: the app's (D-66 keeps the draft with its message). The PRD's
  "That name is taken." with a full stop is the prototype's toast; the domain's `TAKEN_NAME` has none.
- Item 4's "an unchanged name writes nothing" is `useDraft`'s rule already; the command's "Nothing to change." is never
  reached from the field.
- The Code column: a built-in one's code and an own one's in monospace; "—" with its title for none. The dialog's
  "built in" label goes (the Code column says it).

**F20. Colours (item 12, Q6).** The box moves unchanged: `ConceptColours` and `ConceptColourLine` (`settings-form.tsx`,
`setConceptColorAction`, one undo step, `model.edit`), with the prototype's longer sentence ("Each concept's colour on
canvases and in documents. Violet is reserved for requirements, so it is not offered here; a new concept takes the
first colour no concept uses."). The test ids stay (`box-concept-colours`, `concept-colour`), so S21-05 changes only
where it goes.

**F21. Q8: what later slices need (no change now).** See Q8 below; this slice makes none of them harder if F4's
normalized code rule and F18's text table are kept as proposed.

### Answers to the PRD's questions

**Q1. `classification`.** Columns today: `id, workspace_id, code, name, name_key, scope, origin, version, created_*,
updated_*, deleted_at`; `origin` is `builtin | data_vault | own`, own rows have `code` null by CHECK (F3). The code
index includes removed and deleted rows, in SQL and in the local adapter. New: `definition text` (null, trimmed, never
empty), the CHECKs of F3. The code's immutability is the domain's: no command takes a code except `addClassification`
(`renameClassification`'s input is strict and has none), and step 2 adds a unit test that every classification command
refuses or ignores a code; no CHECK can say "never changed".

**Q2. Built-ins at creation.** `newWorkspaceRows` (shared by `createWorkspace` and `createOrganization`) writes them in
the creation's change group; `doc_language` is known there (it writes it), but always `en` (F1). Texts per language in
the domain (F18). Existing workspaces: definitions in their language where null, names kept (F2); the seed per F2.

**Q3. Slice 7c's dialog.** One way in (F8). Components: `ClassificationsDialog`, `ListSection`, `Row`, `RemoveForm` in
`_panels/classifications.tsx`; the actions `addClassificationAction`, `renameClassificationAction`,
`removeClassificationAction`, `restoreClassificationAction` and `classificationImpactAction` (`_actions/classification.ts`)
stay and gain a definition action and the code in `addClassificationAction`. What moves: the list, add, rename, remove
with its form, restore. What goes: the dialog shell, its description and hint lines, the "built in" label, the
single removed section. Specs: Q9.

**Q4. The import.** F17: matched by code or current name per scope, normalized; own codes need no engine change.

**Q5. Naming conventions.** F11: proposal outside undo, its own command for D-57's roles, on the workspace row's chain
with its version (D-59, D-66), cap 20,000 (F10).

**Q6. Colours.** F20 and F12: the box moves, the command does not change (D-76's first unused colour is
`nextConceptColor` at creation, untouched).

**Q7. Roles.** Every field of the tab (names, definitions, add with code, remove, restore, colours, naming) for
`model.edit`: owners, admins and modelers in a workspace that is not archived; reviewers, readers and an archived
workspace see the tab read only (inputs read only, no Add, Remove or Restore, swatches disabled). The tab itself is for
everyone (`workspace.view`), as the prototype. The server refuses each write by `begin(access, "model.edit", …)`.

**Q8. What later slices need.**
- **Stereotypes' names and definitions (decision 6a).** `entity.stereotype` is `text not null default 'object'` with
  `entity_stereotype_ck check (stereotype in ('object', 'link', 'dictionary', 'context', 'informative'))`
  (`20261002000000_initial_schema.sql`), mirrored by `oneOf(STEREOTYPES)` in the local schema. A dimensional entity keeps
  `object`, unused (C-5, `20261104100000_model_level_and_licences.sql`; `DIMENSIONAL_STEREOTYPE_MESSAGE` in
  `levels.ts`). Nothing imports or exports a stereotype. What shows its name: `cap(entity.stereotype)` in
  `buildCards` (`src/canvas/card-data.ts`, the card's first line, measured by `text-fit.ts`), `tree-data.ts` (the Model
  tab's meta), `left-panel.tsx` (`meta={e.stereotype}`, twice, raw), and the entity panel's select
  (`STEREOTYPES.map`). 6a needs one label function fed by the workspace's names in those four places (and the card's
  width measured with the shown name, as aliases did in slice 11). 6b needs the CHECK dropped (a migration, the local
  schema, a format) and the five codes kept for InfoCube's C-5. This slice touches none of it. **Proposal for 6a:** the
  same shape as F18 (built-in texts per language keyed by code), so both lists share one pattern; nothing to build now.
- **The type map (decision 7).** One module: `src/domain/model/type-check.ts` (`PHYSICAL_CLASSES`, `CLASS_OF` as module
  constants; `checkColumnType`, `checkMappingTypes`, `logicalTypeOf`). Its callers: `card-data.ts`, `line-data.ts`,
  `model-index.ts`, `attribute-panel.tsx`, `map-column.tsx`, `requirements.ts` (the requirement index),
  `consistency.ts`, `coverage.ts`, `rules.ts` (the import's D-51 rules), `plan.ts`, `standard.ts` (`physicalClass`),
  `column-type.ts` and `attribute.ts` (`logicalTypeOf`, an attribute made from a column). InfoCube's `typesDiffer` and
  `hasTypeConflict` compare logical with logical and read no map. A workspace's map means a parameter through those
  callers (as `AttributeFeeds` went through the requirement index in 15d) and a decision on approved mappings first
  (D-51). This slice touches none of them.
- **An organization's defaults (decision 8).** Copying by code works for built-in ones (fixed codes) and for own ones
  with a code. Two things this slice decides that matter then: (1) a removed own row keeps its code (F3, F16), so a
  default that brings an own code into a workspace where a removed row holds it must restore that row, not insert a
  new one: today only built-in ones can be restored (`restoreClassification`), so the later slice extends restore to
  own rows with a code; nothing now. (2) Own ones without a code can be matched only by name. Neither is made harder.
- **Reported as harder:** nothing, provided codes are unique **normalized** (F4): an exact-only uniqueness would let a
  workspace hold `HASH_KEY` and `HASHKEY`, which an organization's defaults and the import could not tell apart.

**Q9. Earlier specs and fixtures.** See "Earlier specs and fixtures" below.

**Q10. KB (a copy of the backup of 8 November 2026, 22:44; counts only).** Format 13. Three organizations, four
workspaces. KB has one workspace: documentation language `en`, 19 built-in classifications, **none renamed, none
removed, no own ones**, 17 live links, 4 concepts. The other three workspaces (the demo's organizations in that file):
two `en` (one archived) and one `pl`, each with 19 built-in ones, none renamed or removed, no own ones. So KB's upgrade
gives its 19 built-in ones the English definitions and changes no name; nothing can clash.

### Differences between the prototype and the app that the slice touches

| # | Prototype | App (today, or as proposed) |
| --- | --- | --- |
| 1 | A new workspace: a name only; conventions seeded on the first visit in the language then | F1: always `en` today; proposal (a) a language at creation |
| 2 | An existing workspace gets names and definitions of its language | F2: names kept, definitions filled (the PRD) |
| 3 | Effective date is Data Vault | general (D-57; known, PRD section 4) |
| 4 | A removed own one is dropped and its code is free | F3, F16: soft-deleted, its code stays taken (the PRD) |
| 5 | Codes checked against codes only (exact), names against names and built-in codes | F4: codes normalized, against every code and the scope's names; names against every code |
| 6 | Removal: the browser's `confirm` with its own text | F7: D-57's form (uses, what stops, settles) in a small dialog |
| 7 | Restore refused: "“{name}” is taken by another classification; rename that one first." (toast) | F6: `RESTORE_TAKEN` kept, proposal |
| 8 | Rename taken: toast "That name is taken." | F19: the message under the field (D-66) |
| 9 | Toasts "Classification “{name}” added.", "{name} removed.", "{name} restored, unused." | the app's: none on add (the row appears), "Removed {name} from the list.", "Restored {name}." (kept) |
| 10 | The hint names the current language | F13: no language named |
| 11 | Settings' "Model conventions" with chips | F12: a box with the sentence and the button only |
| 12 | The tab key `conv` | `?tab=conventions` |
| 13 | A built-in one's name and definition in `S.conv`; own ones in `S.classes` with `uc` | D-57's rows with the new columns (PRD section 4) |
| 14 | The Add row: name, code, Add (a grid) | the same; proposal: Enter in either field adds (the dialog's name field does today) |
| 15 | Data Vault rows dimmed with the mode off (`.cv-dim`), chip "· hidden while the mode is off" | the same (the dialog showed them undimmed) |

### Every new UI text

The tab (from the prototype unless marked):
- Tab: "Metadata conventions".
- Intro: "The workspace's conventions, in one place. The import matches classifications by their name or code; table
  and column panels set them; documents and exports print their definitions."
- Box "Classifications", hint: "One list for the workspace's source tables and columns. Every name can be changed;
  built-in ones keep a code the app's rules read (BK, PII, LK…), so a renamed one keeps working and a removed one is
  absent until it is restored. An own classification may get a code when it is added, for import files that should not
  depend on its name; the code cannot change later." + F13's sentence (question 8).
- Tables "For source columns", "For source tables"; headers "Name", "Code", "Definition", "Used" and an empty one.
- Chips "Data Vault 2.0", "Data Vault 2.0 · hidden while the mode is off", "own".
- "—" titled "No code: an import file names it by its name".
- Definition placeholder "What it means, when to use it"; "used {n}×", "unused"; "Remove".
- Add: placeholders "New column classification, e.g. Hash candidate", "New table classification, e.g. Golden source"
  (as the dialog), "Code (optional), e.g. HASH", "Code (optional), e.g. GOLD"; "Add".
- Code refusals: "Letters, digits and _; starting with a letter", "That code is taken" (no full stop, as `TAKEN_NAME`).
- "Removed built-in: {name} {CODE}" and "Restore".
- Box "Concept colours", hint as F20.
- Box "Naming conventions", hint "Your rules for names of entities, attributes, keys and codes, as plain text.
  Documents print them in their conventions section; nothing checks names against them yet.", placeholder "- Entities:
  singular, Title Case (Sales Order)⏎- Attributes: snake_case (order_date)⏎- Keys: …_id; surrogate keys: …_key".
- Last line: "Later, in their own slices: entity stereotypes' names and definitions, the map from physical to logical
  types, an organization's default conventions."
- **Toasts (proposed, the app's style):** "Saved the definition of {name}.", "Cleared the definition of {name}.",
  "Saved the naming conventions.", "Cleared the naming conventions." Undo names: "Change definition of {name}"
  (proposal), the others as 7c's.

Elsewhere:
- Settings: box "Model conventions": "Classifications, concept colours and naming conventions are edited in" +
  button "Metadata conventions" + "." (F12).
- The import's warning (F8): "… ignored. Add it in Metadata conventions on the workspace home to use it." (proposal).
- F1 (a): a select "Documentation language" (English, Polski, Deutsch) in the top bar's new workspace field and the
  organization's creation form (proposal; its exact place in step 3).
- Appendix A's 57 names and definitions (domain texts).

### Earlier specs and fixtures each step touches

- **Step 2 (unit):** `src/domain/commands/classification.test.ts` (own code, the pattern, normalized uniqueness,
  restore by origin, definitions; `RESTORE_TAKEN` if question 6 changes it), `src/domain/model/classifications.test.ts`
  (list order, `isBuiltin`, texts per language), `src/domain/import/classifications.test.ts` (an own code matches; the
  warning's text, three expectations), `src/domain/commands/workspace.test.ts` and `organization.test.ts` (the rows in
  the language, F1), `src/domain/commands/undo.test.ts` (the clash with a code), the local adapter's upgrade and schema
  tests (format 15, the CHECKs), `src/domain/__fixtures__/domain.ts` (built-in rows with definitions). The full run of
  step 2 covers every e2e spec; none should change in step 2.
- **Step 3 (e2e):**
  - `e2e/slice-07c/helpers.ts` (`openList`, `listRow`: the tab instead of the dialog), `S7C-04` (add, rename, taken
    name), `S7C-05` (remove with the form, Undo, Restore; the removed list's new form), `S7C-13` (read only for a
    reviewer, a reader and an archived workspace);
  - `e2e/slice-09/S9-04.spec.ts` (a classification's rename as one of its panel cases) and
    `e2e/slice-10a/S10A-04.spec.ts` (a classification's remove after its rename): both opened the dialog from a panel;
    they go to the tab;
  - `e2e/slice-21/S21-05.spec.ts` and `e2e/slice-21/helpers.ts` (the colours from Settings → from the tab);
  - `e2e/slice-08/S8-02.spec.ts`, `S8-07.spec.ts` only if F1 (a) adds the language to the organization's form (their
    sentence stays; the count of 19 stays);
  - the element guard (`S3B-15-elements`) and the canvas commit counts: the canvas does not change; removing the dialog
    from the panel's code may change the page's script count by one (read against slice-08's baseline, CLAUDE.md).
- **Fixtures:** the seed (`seed-model.ts`, F2) and the e2e reseed take the new texts; no fixture of an earlier slice
  names a definition.

### The plan for steps 2 to 4

- **Step 2, data and domain** (draft PR at the start). The migration (F3, F14); `types.ts` (`definition`,
  `naming_conventions`); `classifications.ts` (texts per language, `isBuiltin`, list order, the code rules, F4, F5,
  F18); the commands: `addClassification` with `code`, `setClassificationDefinition` (one undo step), `restore` by
  origin, `setNamingConventions` (F11, as decided), `createWorkspace` and `createOrganization` with the language (F1, as
  decided); undo's clash (F4); the import's text (F8) and tests (F17); the local schema's CHECKs and format 15 (F15);
  the seed (F2); `data-model-v2.md`'s columns. The actions only where the domain needs them (add's code, the
  definition, the naming conventions). Unit tests; lint, typecheck, unit tests; **one full run (local adapter and undo
  change)**.
- **Step 3, interface.** The tab (`conventions.tsx`: the two tables with rename, definition, code, uses, remove with its
  dialog, restore, add; the colours box moved; the naming conventions), Settings' boxes (F12), "Edit the list…" as a link
  (F8), the dialog removed, the language at creation (F1, as decided); specs S23-01 to S23-07 and the earlier specs
  above; the element guard and the commit counts; screenshots of the tab light and dark beside the prototype's.
- **Step 4, close.** `decisions.md` (D-78 quoted for approval, D-57 "(Changed by D-78.)"), `data-model-v2.md`,
  `ideas.md` (the two 7c entries done; section 9's items with their prerequisites from Q8), the inventory, known
  limitations (F16), README and CLAUDE.md; the full run on the final commit; the manual acceptance steps (KB after its
  backup).

### Questions for Łukasz before step 2

1. **F1, the language at creation:** (a) a select at both creations (recommended), (b) the language of the workspace
   it is created from, or (c) English, tested through the domain only?
2. **F2, the seed:** "Sales analytics" (Polish) gets Polish names and definitions (recommended), or English names with
   Polish definitions like an upgraded workspace?
3. **F4, codes:** unique after the import's comparison (case, spaces, `_`, `-`, `/` ignored) and against the scope's
   names, as proposed?
4. **F11, the naming conventions:** a workspace column outside undo, editable by owners, admins and modelers
   (recommended), or a table of its own as an undo step?
5. **F7, removal's confirmation:** D-57's form in a small dialog (recommended), as proposed?
6. **F6, restore refused:** keep "Rename {other} first: {name} is taken." (recommended) or the PRD's text?
7. **F12, Settings:** a new "Model conventions" box with the sentence and the button only (recommended), or with the
   prototype's chips?
8. **F13, the hint's last sentence:** "A new workspace starts with the built-in names and definitions in its
   documentation language; changing the language later renames nothing." (recommended)?
9. **F16:** a code stays taken after its classification's add is undone: accept and list it in known limitations?
10. **Toasts and undo names** (the list above): the definition's and the naming conventions' as proposed?

## Step 1: Łukasz's answers (10 November 2026)

1. **F1:** (a). A "Documentation language" select (English, Polski, Deutsch; default English) in both places a
   workspace is created: the top bar's "New workspace" and creating an organization. **A deliberate difference from the
   prototype**, whose new workspace has a name only.
2. **F2:** yes. The seed's "Sales analytics" (Polish) gets the Polish built-in names and definitions.
3. **F3, F5:** the CHECK changes so an own classification may have a code; built-in ones are recognised by origin, not
   by having a code, in all six places. A removed own classification is never restorable as a built-in one.
4. **F4:** both. Codes are unique the way the import compares them (case, spaces, `_`, `-`, `/` ignored) against every
   code of the workspace, removed and deleted rows and built-in codes included; and codes and names of the same scope
   never collide in that comparison, in either direction (a new name against own codes too, as D-57 already does for
   built-in codes).
5. **F11:** a workspace column outside undo, with a command of its own for owners, admins and modelers, with the version
   check (D-59).
6. **F7:** yes: a small dialog with D-57's form (where it is used and what stops), using the existing read of what a
   removal takes with it.
7. **F6:** keep the app's text: "Rename {other} first: {name} is taken."
8. **F12:** yes: a "Model conventions" box in Settings with only the sentence and the button that opens the tab, no
   chips. **A deliberate difference from the prototype.**
9. **F13:** yes, the proposed text.
10. **F16:** accepted; listed in `known-limitations.md`.
11. **Toasts and undo names:** as listed above.

## Step 2: data and domain (10 November 2026)

Draft PR: https://github.com/LukaszWolski-DA/infomapper-app/pull/52, opened at the start of the step.

### What changed

- **Migration** `supabase/migrations/20261110120000_metadata_conventions.sql` (DDL only, F14): `classification.definition`;
  `classification_code_ck` now `origin = 'own' or code is not null` (F3); `classification_code_format_ck` (the pattern);
  `classification_definition_ck` and `workspace_naming_conventions_ck` (never empty); `workspace.naming_conventions`.
- **Types** (`src/domain/types.ts`): `Classification.definition`, `Workspace.naming_conventions`.
- **The rules** (`src/domain/model/classifications.ts`):
  - `BUILTIN_TEXTS` (Appendix A word for word, `en`, `pl`, `de`), `builtinText`;
  - `builtinClassificationRows(ctx, workspaceId, language)`;
  - `isBuiltin` (by origin, F5), used by `byListOrder`, the index's `byCode` (built-in ones only), `whatStops`,
    `restoreClassification` and the dialog's removed list and "built in" label (the dialog goes in step 3);
  - own codes (F4): `CODE_PATTERN`, `typedCode`, `codeRefusal` ("Letters, digits and _; starting with a letter",
    "That code is taken"): normalized against every code of the workspace (built-in codes, removed and deleted rows,
    both scopes) and the live names of its scope. `nameTakenBy` needed no change: it already compares a name with
    every row's code of the scope, which now includes own codes.
- **Commands** (`src/domain/commands/`):
  - `addClassification` takes an optional `code` (trimmed, upper-cased, empty is none); no other command takes one, so a
    code is never changed;
  - `setClassificationDefinition` (new): plain text, trimmed, empty clears, up to 20,000 characters, one undo step
    named "Change definition of {name}" (also in `change-label.ts`); its toasts `DEFINITION_SAVED`,
    `DEFINITION_CLEARED`;
  - `restoreClassification` refuses every own one by origin;
  - `createWorkspace` takes `docLanguage` (optional, `en`); `createOrganization` and `createOrganizationForUser` take
    `workspaceLanguage`; both through `newWorkspaceRows(…, language)`, which writes the language and the built-in texts
    in it, and `naming_conventions` null;
  - `setNamingConventions` (new, F11): `model.edit` (owners, admins, modelers, not archived), the workspace row's
    version (D-59), trimmed, empty clears, up to 20,000; outside undo; toasts `NAMING_SAVED`, `NAMING_CLEARED`;
  - undo (`classificationNameClash`): also refuses a revert that makes a live name another one's code of its scope
    (removed ones too), with `CLASSIFICATION_NAME_CLASH` (F4).
- **The import**: no engine change (F17); the unknown value's warning now ends "Add it in Metadata conventions on the
  workspace home to use it." (F8).
- **Actions**: `setClassificationDefinitionAction` (`Saved`, on the classification's chain), `setNamingConventionsAction`
  (`Saved`), `createWorkspaceAction`'s `docLanguage`, the organization actions' `workspaceLanguage`;
  `addClassificationAction` passes the code through. No UI uses them yet (step 3).
- **The local file's format 15** (`schema.ts`, `file.ts`): the CHECKs above; the upgrade from 14 gives every built-in
  classification without a definition its definition in its workspace's language, names kept (F2), own ones null,
  every workspace `naming_conventions` null; no change events, no log line.
- **The seed** (`seed-model.ts`, `seed.ts`, `seed-large.ts`): each workspace's built-in rows in its language with their
  definitions; "Sales analytics" (Polish) has the Polish names and definitions (F2). The domain fixture's built-in
  rows carry the English definitions.
- **Docs**: `data-model-v2.md` (the columns, the CHECKs, the rules), `known-limitations.md` (F16).

### Tests

- New and changed unit tests: `classifications.test.ts` (texts per language for every code, names clear of codes in
  every language, `isBuiltin`, list order, the index by code, code shape, codes taken as the import compares, names
  against own codes), `commands/classification.test.ts` (add with a code, refusals, a code never changed, the definition
  and its refusals, a removed own one not restored), `workspace.test.ts` (the language at creation, a later change
  renames nothing, the naming conventions and their refusals), `organization.test.ts` (the first workspace's language),
  `undo.test.ts` (a name that is another's code now, a definition undone, a code taken after its add is undone),
  `import/classifications.test.ts` (an own code matched as compared, a removed one's code unknown, written on a new
  column; the warning's text), `upgrade-15.test.ts` (new: the upgrade, names kept, a definition kept, written back
  once, not repeated; the seed in its languages).
- `npm run lint`, `npm run typecheck`: clean. `npm test`: 162 files, 2,035 tests passed.
- **Earlier e2e spec changed:** `e2e/slice-07c/S7C-10.spec.ts`, the unknown value's warning text (F8).
- **The full run** (local adapter and undo changed, the "Test runs" exception): below.

### The full run (step 2: the local adapter and undo changed)

- [Run 42790164033](https://github.com/LukaszWolski-DA/infomapper-app/actions/runs/42790164033) on `c883dfd`, the
  workflow "E2E", all eight parts, no retries: **708 passed, 0 failed, 4 skipped, 0 flaky**, no expected failures.
- Wall-clock 13 min 4 s (09:22:28 to 09:35:32 UTC); the tests 10 min 55 s.
- Parts (time; heap peak, against the runner's restart threshold of 6,431 MB; no server restart in any part):
  1: 8.7 min, 1,043 MB · 2: 8.0 min, 1,153 MB · 3: 6.3 min, 1,290 MB · 4: 9.3 min, 912 MB · 5: 10.3 min, 1,029 MB ·
  6: 9.6 min, 1,015 MB · 7: 6.5 min, 1,441 MB · 8: 7.9 min, 1,466 MB.
- A commit after `c883dfd` that touches only Markdown in `docs/` and the root keeps this run valid
  (`git diff --stat c883dfd..HEAD`).

## Step 3: interface (10 November 2026)

### What changed

- **The tab** (`src/app/w/[workspaceId]/_components/conventions.tsx`, `page.tsx`): "Metadata conventions" between People
  and Settings (`?tab=conventions`, `CONVENTIONS_TAB` in `src/app/_lib/paths.ts`), for every member; editable with
  `model.edit` (owners, admins, modelers, not archived). The page sends every classification of the workspace (removed
  ones too) and each one's use count; nothing else of the sources (F7).
  - **Classifications:** the prototype's intro and hint (F13's sentence in place of the prototype's language clause),
    "For source columns" and "For source tables" with Name (D-66's draft, the message under the field), Code (built-in,
    own, or "—" with its title), Definition (plain text, trimmed, saved on leaving it, one undo step), Used and Remove;
    the chips "Data Vault 2.0" ("· hidden while the mode is off", the row dimmed) and "own"; "Removed built-in: {name}
    {CODE} [Restore]" under each table; the Add row (name, code, Add; Enter in either field adds) with the code's
    refusals under it.
  - **The remove dialog** (`dialog-remove-classification`, "Remove {name}?"): opened by Remove when the classification
    is used or a rule reads it; it reads its impact when it opens (`classificationImpactAction`) and shows D-57's form
    (`RemoveClassificationForm`, moved out of the old dialog); any other is removed at once with Undo (7c's rule).
  - **Concept colours:** slice 21's box, moved unchanged in behaviour, with the prototype's longer sentence.
  - **Naming conventions:** the prototype's sentence and placeholder; saved on leaving it, trimmed, empty clears it;
    outside undo (toasts "Saved the naming conventions." and "Cleared the naming conventions.", no Undo).
  - The last line: "Later, in their own slices: …".
- **Settings** (`settings-form.tsx`): no colours box; a box "Model conventions" with the sentence and a button
  "Metadata conventions" that opens the tab (F12, a deliberate difference: no chips).
- **"Edit the list…"** in the table and column panels (`_panels/classifications.tsx`) is a link to the tab (a push:
  Back returns to the canvas); slice 7c's dialog (`ClassificationsDialog`, its list, rows and description) is gone.
- **The language at creation** (F1, a deliberate difference): a select "Documentation language" (English, Polski,
  Deutsch; default English) beside the top bar's "New workspace" field, in the start page's "Create an organization" and
  in "New organization…" (`src/ui/doc-languages.ts` shares the options with the settings).
- **`TextArea`'s `prepare`** (`src/app/_panels/fields.tsx`): optional, passed to `useDraft` as `TextField` does; the
  tab's two text areas trim with it, so a text saved trimmed is no draft afterwards (S23-02 found it: an undo did not
  show the earlier definition while the untrimmed text stayed as a draft). Every other `TextArea` is unchanged.

### New UI texts beyond the acceptance list

- "Reading where it is used…" while the remove dialog reads its impact (usually for a moment only).
- The dialog's title "Remove {name}?".

### Tests

- **New specs** `e2e/slice-23/` (fresh seed each): S23-01 (3 tests: the tab, Data Vault dimming, read only for a
  reviewer, a reader and an archived workspace), S23-02 (2: rename and definition with undo and redo, the panel's
  toggle; empty, unchanged and taken names), S23-03 (2: an own code, the bad and taken codes, "—"; an import file's
  `HASH` in the review), S23-04 (2: remove with the dialog, Undo, Restore refused while taken, restored unused; at once
  without the form), S23-05 (2: a Polish workspace from the top bar, a later language change renames nothing; a German
  first workspace from the start page), S23-06 (2: colours with undo and Settings' box; the naming conventions), S23-07
  (2: the column's and the table's "Edit the list…"). Locally: **15 passed**. The upgrade of a workspace from before the
  slice is `upgrade-15.test.ts` (step 2); the import's reading of an own code is `import/classifications.test.ts`.
- `S23-screens.spec.ts` (only with `SCREENS=<folder>`): `docs/prd/slice-23-screens/step-3/` (the tab, the remove
  dialog, Settings, the new workspace's language select; light and dark).
- **Earlier specs, run locally:** `slice-07c` (all), `S0-06`, `S0-07`, `S0-08`, `S0-09`, `S1A-12`, `S8-02`, `S8-07`,
  `S8-08`, `S9-04`, `S10A-04`, `S13-06`, `slice-15a/S15-03`, `S15-04`, `slice-15b/S15-03`, `S21-05`, and the canvas
  commit counts `S2C-12`, `S3A-14-idle`, `S3B-15-idle`: **72 passed, 1 skipped** (`S7C-14-commits`, on demand only).
- **The element guard** (`S3B-15-elements`, measurement build, against `slice-08.json`): passed; viewport 4,508,
  19,305, 1,465, 4,907 and page totals 6,135, 20,932, 3,002, 6,444, all equal to slice 22's. No measuring sitting.
- `npm run lint`, `npm run typecheck`: clean; `npm test`: 162 files, 2,035 tests.
- **No full run in this step:** it changes no table, undo, the save chain's rules, the canvas's layers or the local
  adapter. One shared component gained an optional prop (`TextArea`'s `prepare`, used only by the new tab); the full run
  is step 4's.

### Earlier specs changed (all on the acceptance doc's list)

| Spec | Change | Reason |
| --- | --- | --- |
| `e2e/slice-07c/helpers.ts` | `openList` opens the tab through "Edit the list…"; `listRow` reads the tab; `backToColumn` (new) | the dialog is the tab (item 8) |
| `S7C-04` | the tab's hint instead of the dialog's; the chip's "· hidden while the mode is off"; the Code column instead of "built in"; back to the panel by `backToColumn` instead of Escape; the dialog's footer line dropped | items 3, 8 |
| `S7C-05` | the form found on the page (its own dialog); `backToColumn` instead of Escape | F7, item 8 |
| `S7C-13` | the tab's box; no fields or buttons, the definitions read-only text areas | Q7 |
| `S9-04` | the row found in the tab | item 8 |
| `S10A-04` | the row in the tab; Remove's confirmation clicked when it shows (the form is read when it opens), the test's title | F7 |
| `S21-05` | the colours opened on the tab; the sentence's longer text | item 12 |
| `S7C-10` (step 2) | the unknown value's warning text | F8 |

`e2e/slice-21/helpers.ts`, `S8-02` and `S8-07` needed no change (their summary text and counts stay).

### How to check it by hand

On `npm run demo -- --reset` (its own file, `.data/demo-db.json`; never `.data/dev-db.json`):

1. Sign in as Łukasz; open Retail Co – DWH's home, tab "Metadata conventions" (between People and Settings).
2. Rename Business key, change its definition; Undo and Redo in the top bar; open a column's panel on "Customer &
   orders": the toggle has the new name.
3. Add "Hash candidate" with the code `hash` (stored as `HASH`); try `BK`, `9x` and `hash` again; add one without a code
   ("—").
4. Remove Personal data: the dialog lists its six columns and what stops; Remove; Undo; remove it again, add an own
   "Personal data", Restore is refused; rename the own one, Restore.
5. Change a concept's colour in the tab; Settings has "Model conventions" with the button to the tab.
6. Write naming conventions, leave the field; reload; sign in as Kasia (reader): read only.
7. The workspace menu's "New workspace" with "Polski": its tab shows "Klucz biznesowy"; changing its language in
   Settings renames nothing. "Sales analytics" (Polish) has the Polish names after the reset.
8. In a column's or a table's panel, "Edit the list…" opens the tab; Back returns to the canvas.

## Step 4: closing (10 November 2026)

### What changed

- `docs/decisions.md`: **D-78** (new, below), written from what was built, with step 1's answers; **D-57** ends "(Changed
  by D-78.)" (its text is otherwise as accepted: the list now lives in the tab, own classifications may have a code, and
  names are checked against every code, not only built-in ones).
- `docs/ideas.md`: the two slice 7c entries ("Built-in classification names per documentation language", "Own
  classifications with a code") marked done in slice 23; a new entry "Metadata conventions: what comes later" with the
  stereotypes' names and definitions, the type map, an organization's default conventions and a reset to a language's
  defaults, each with what step 1's Q8 found it needs; a check of names against the naming conventions; InfoDocumenter.
- `docs/known-limitations.md`, "Metadata conventions (slice 23)": F16 (a code stays taken after its add is undone,
  written in step 2) and "A text area whose command trims may keep an untrimmed draft": found in slice 23 on a
  definition and fixed for the tab's two text areas with `TextArea`'s optional `prepare`; the other text areas were not
  checked and are left to a `fix/…` branch (The slice cycle, 4).
- `docs/inventory-prototype-vs-app.md`: the tab, the language at creation and Settings' box present; the deliberate
  differences (F1, F12, F6, F7, F3/F4/F16, F2, F13, F19, F11).
- `README.md` and `CLAUDE.md`: the status line; slice 23's helpers, the screenshots command, the classifications'
  paragraph.
- `docs/ideas_infodocumenter.md` (untracked, Łukasz's) is not part of the slice.

### D-78, for Łukasz's approval

> **D-78** Metadata conventions (slice 23). A workspace's conventions have one place, the workspace home's tab "Metadata conventions", between People and Settings, which every member sees: its classification list (D-57's dialog moved there; "Edit the list…" in a table's or a column's panel opens the tab), its concepts' colours (moved from Settings; D-76's rules unchanged) and its naming conventions. Settings keeps a box "Model conventions" with one sentence and a button that opens the tab. Every classification has an optional definition, plain text. An own classification may get a code when it is added, never changed afterwards: letters, digits and `_`, starting with a letter, at most 30, upper-cased; unique in the import's comparison (case, spaces, `_`, `-` and `/` ignored) against every code of the workspace, built-in ones and those of removed and deleted classifications included, so a code is never given twice, also after its classification's add is undone; and codes and names of the same scope never collide in that comparison, in either direction. The import matches an own classification by its name or its code. Built-in classifications are told by their origin, never by having a code, and only they can be restored. A workspace gets its built-in classifications' names and definitions in its documentation language when it is created (English, Polish, German), chosen in a "Documentation language" select wherever a workspace is created: beside the top bar's "New workspace" and with an organization's first workspace; English by default. Changing the language later renames nothing and rewrites no definition; when slice 23 was installed, the built-in classifications of existing workspaces kept their names and got the definitions in their workspace's language. Removing a classification that is used or that a rule reads shows D-57's form first, in a small dialog; any other is removed at once, with Undo. Names, definitions, codes, removals, restores and colours are each one undo step, for owners, admins and modelers in a workspace that is not archived; reviewers, readers and an archived workspace see the tab read only. The naming conventions are plain text, a workspace setting outside undo, edited by owners, admins and modelers with the workspace's version (D-59); nothing checks names against them yet. Entity stereotypes' names and definitions, the map from physical to logical types, an organization's default conventions and a reset to a language's defaults are later. Proposed in slice 23's step 4, for Łukasz's approval.

**Changed:** D-57 ends "(Changed by D-78.)". No other decision changes; D-76's colour rules and D-59's version check
are referred to, not changed.
