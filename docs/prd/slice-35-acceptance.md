# Slice 35 – acceptance: step 1 (the PRD checked against the code)

Step 1 of `docs/prd/slice-35-baselines.md`, 24 November 2026, on `slice/35-baselines` from `origin/dev` at `8ff39f3`
(the merge of PR 92, fix/s6b-04-zoom-flake). No application code; no `pg:` script, no connection to `infomapper-dev`;
neither `.data/dev-db.json` nor a KB backup was read. "Fact" is read in the code at `8ff39f3` (file and line);
"assumption" is not verified yet and says how it will be. Q2's figures come from a throwaway script outside `src/` and
outside the repository (scratchpad, not committed) on a fresh demo seed in a temporary file.

## 0. The files and the number

| File | Bytes | `cmp` with Downloads | SHA-256 | Expected (prompt) |
| --- | --- | --- | --- | --- |
| `docs/prd/slice-35-baselines.md` | 25,877 | equal | `3c3126edb0359cf1b54aa0ef84ceed24626a3902c6dacb42b45232ebff665601` | equal |
| `docs/prototype/infomapper-prototype-with-sources.html` | 990,528 | equal | `6d5b5b7f5f00c739f3c799961ec2b6198e3ec407601595fe63c47a400ecdc179` | equal (also the PRD's) |

The prototype replaces `92b78b95141a10d557adddc620b695b0cbce640f1e6e27a2310e5dba3291f439` (980,246 bytes). Downloads
held one file of each name; no "… (1)" copy of either.

**35 is the next free number (fact):** the newest tags are `slice-33` and `slice-34`; `docs/prd/` ends at slice 34; no
branch `slice/35*` or `*baseline*` existed locally or on `origin`.

### The prototype's diff against `92b78b95…`, by hunk

116 lines in, 27 out, 22 hunks (`git diff -U0`). Each against the PRD's section 4:

| # | Prototype line (new) | What | Slice | In the PRD's section 4 |
| --- | --- | --- | --- | --- |
| 1 | 1241 | CSS `.dpre:disabled` (a disabled preset button) | 36 | – (the sign-off preset, slice 36) |
| 2 | 6184 | `modelPart` adds `diagrams` (B3.3: canvases and frames in the snapshot) | 35 | the snapshot (design) |
| 3 | 6192 | `seedRoot`: `customers.cust_no` as `varchar(10)` in the demo's baseline | 35 | "The demo" |
| 4 | 6203 | the demo baseline's time `2026-09-15 10:12` | 35 | "The demo" |
| 5 | 6265–6281 | `DIFF_FL`, `DIFF_LONG`, `diffDet`, `diffWhat`; `diffModels(a, b)` now "a = before, b = after" | 35 | yes (`diffWhat` not named) |
| 6 | 6288 | `diffModels` keeps `det` per change | 35 | yes |
| 7 | 6298–6301 | Source table and Source column kinds (B2.3) | 35 | yes |
| 8 | 6318–6353 | `blNameTaken`, `renameBaseline` and its Save, `askDeleteBaseline` and its delete, `blAt`, `blPair`, `blTxt` | 35 | yes (`blAt`, `blTxt` not named) |
| 9 | 6355–6371 | `compareBaseline`: the one-row controls, the line, the groups, "Make a document" | 35 (the button 36) | yes |
| 10 | 6373–6376 | the `bl-mkdoc` click (`DOC.fromChanges`) | 36 | "Make a document" is 36's |
| 11 | 6427 | the box's `maxlength` 120 and 1,000 | 35 | yes |
| 12 | 6429 | the card's buttons: "Compare…", Rename (`perm === "full"`), Delete (owner, admin) | 35 | yes |
| 13 | 6488–6489 | the card's clicks: Rename, the delete question | 35 | yes |
| 14 | 6506–6507 | create: the unique name, the time to the minute | 35 | yes |
| 15–17 | 9344, 9381, 9418 | the document words `noBase` in English, Polish and German | 36 | – |
| 18 | 9497–9499 | `goneBl`, `expOff` (B3.5: no print or export from a gone baseline) | 36 | – |
| 19 | 10044–10047 | `prevBl`, `againstOf` (B4.1: "previous baseline") | 36 | – |
| 20 | 10049–10055 | the section "Changes since …" | 36 | – |
| 21 | 10388–10395 | New document: the sign-off preset disabled without a baseline; `fromChanges` | 36 | – |
| 22 | 10447, 10485, 10508, 10692 | Print, Markdown and Generate disabled for a gone baseline; the editor's note; the source select's gone option; `DOC.fromChanges` exported | 36 | – |

Every hunk of slice 35 is one of section 4's functions or a helper of them (`diffWhat`, `blAt`, `blTxt`); every other
hunk is slice 36's, as section 4 says ("Its 'New document from it' and 'Make a document' are slice 36's"). The
prototype's tab itself (`renderWsHome`, `tab === "baselines"`, line 6425, and the tab list at 6408) is unchanged context
except hunks 11 and 12. Nothing in the diff contradicts the PRD; the differences from the app are section 4 below.

## 1. The answers (Q1–Q10)

### Q1. The table registry

**Where tables are registered (fact).** Three records, joined in the composition root:
- **Undo:** `UNDOABLE_TABLES` and `OUTSIDE_UNDO` (`src/domain/commands/undo.ts:53-97`), and a module's
  `ModuleTableClass` (a `ModuleUndoTable` or `"outside undo"`, `undo.ts:143`) in `INFOCUBE_UNDO`
  (`src/modules/infocube/domain/tables.ts:35`) and `INFODOC_UNDO` (`src/modules/infodocumenter/domain/tables.ts:7`);
  `undoTables(MODULE_UNDO)` joins them (`undo.ts:227-259`).
- **The local adapter:** `RULES` and `localSchema(MODULE_RULES, …)` (`src/data/local/schema.ts`; `INFOCUBE_RULES`,
  `INFODOC_RULES`); the file's shape `DevDb` (`schema.ts:111-151`) plus `ComposedDb` (`src/compose/tables.ts:23`).
- **The guard:** `tests/table-registry.test.ts` checks every `create table` of the migrations against `STORE_SCHEMA` and
  the undo records, minus `NOT_IN_DOMAIN_YET` (`tests/schema/compare-schema.ts:106`, today only `baseline`) and
  `POSTGRES_ONLY_TABLES` (`undo_step`).

`baseline` is in the migrations (`20261002000000_initial_schema.sql:586-596`) but in none of the records: no domain
type, no rules, not in the file (fact).

**How a snapshot flag fits (recommendation).** A fourth record, built the same way so the build fails on a table
without a flag: `BASELINE_TABLES: Record<CoreTable, "in" | "out">` in the domain (`src/domain/baseline/tables.ts`), and
for a module a `Record<ModuleTable, "in" | "out">` beside its undo record (`INFOCUBE_BASELINE`, `INFODOC_BASELINE`),
joined in `src/compose/tables.ts` as `BASELINE_FLAGS`. `tests/table-registry.test.ts` gets one more case: every
migrated table (but `undo_step`) has a flag, and every "in" table is carried by the snapshot (Q2). A flag needs no
store change: it decides which tables of `store.snapshot`'s result go into a baseline (Q2).

**The tables and their flags** (the design of 11 November 2026, completed):

| Table | Flag | Why |
| --- | --- | --- |
| `concept`, `entity`, `attribute`, `attribute_input`, `relationship` | in | the core (`attribute_input`: slice 18's calculations) |
| `source_system`, `source_table`, `source_column`, `source_relationship`, `source_relationship_column` | in | sources |
| `classification`, `classification_link` | in | classifications and their links |
| `stereotype` | in | stereotypes |
| `mapping`, `mapping_input` | in | mappings |
| `requirement`, `requirement_link` | in | requirements and their links |
| `project`, `canvas`, `project_canvas`, `canvas_item`, `frame` | in | projects and canvases with their items and frames (B3.3) |
| `cube_entity`, `cube_measure`, `cube_key`, `cube_mapping`, `cube_mapping_input`, `cube_attribute` | in | "every module's tables": InfoCube's are model |
| `document_definition` | **out** | see F3: a recipe, not model; private documents of other people |
| `label`, `label_link`, `project_pinned_label`, `note` | out | the working layer (design) |
| `change_event`, `source_change`, `source_import` | out | history and import bookkeeping (design) |
| `app_user`, `organization`, `organization_member`, `organization_access`, `organization_licence`, `workspace_member`, `invitation`, `password_reset` | out | people and access (design) |
| `workspace` | out, but four settings in | `dv2_mode`, `four_eyes`, `naming_conventions`, `infocube` (design); see F4 for `doc_language` |
| `baseline` | out | a baseline never holds baselines |
| `undo_step` | – | Postgres's own bookkeeping, outside the domain (`POSTGRES_ONLY_TABLES`) |

### Q2. The snapshot's shape and the store method

**The store method exists (fact).** `store.snapshot(workspaceId, tables)` (`src/data/ports.ts:262`) is one consistent
read on both adapters: locally one read of the file (`src/data/local/store.ts:244-251`), online one REPEATABLE READ
transaction (CLAUDE.md, AD-37), contract-tested on both (`tests/contract/reads.test.ts`). It returns
`WorkspaceSnapshot` (`src/domain/model/workspace-model.ts:160-182`, built by the pure `workspaceSnapshotOf`,
`:186-219`): the model as `model.load` reads it (live rows, the orders, `lostOriginals`, the classification and
stereotype lists **with their removed rows**), the live requirements and their live links (both ends live), the live
projects and canvas links (both ends live, tab order), the live cards, canvases, frames, labels and label links, the
members and people, the organization and the asked module tables' live rows. **No new store method is needed** (F1).

**The shape (recommendation).** A pure `baselineContentOf(snapshot)` in the domain makes the stored content from
`WorkspaceSnapshot`, keeping its field names, so a baseline read back is a `WorkspaceSnapshot` again (with no labels,
label links, members or people) and every reader (the comparison, slice 36's documents) reads a baseline and the live
model through the same rules:

```
{ settings: { dv2_mode, four_eyes, naming_conventions, infocube },
  model: { concepts, entities, attributes, relationships, sourceSystems, sourceTables, sourceColumns, mappings,
           mappingInputs, attributeInputs, sourceRelationships, sourceRelationshipColumns, classifications,
           classificationLinks, stereotypes, lostOriginals },
  requirements, requirementLinks, projects, projectCanvases, canvasItems, canvases, frames,
  modules: { cube_entity, cube_measure, cube_key, cube_mapping, cube_mapping_input, cube_attribute } }
```

Rows as the store hands them on (every column, the modules' defaults and upgrades applied), in the snapshot's orders.
A fixed map from these fields to their tables (`model.entities` → `entity`, …) is what the flags and the upgrade chain
read (Q1, Q3). The deleted originals that live copies point to are `model.lostOriginals` (`{ id, name, entityName }`,
`lostOriginalsOf`, `workspace-model.ts:54-72`), exactly the design's "id, name, entity name". The classification and
stereotype lists keep their removed rows as `model.load` does (assumption to confirm in step 2: the design says "live
rows", but the list read back must equal `model.load`'s, and the removed rows are what keeps a code taken; they are
small, 19 + 5 rows on the demo).

**The one read online** is `store.snapshot` asking only the module tables flagged "in" (its statement per table already
filters on the workspace). It also reads labels, label links, members and people, which `baselineContentOf` leaves out:
cheap, and one read path instead of two.

**Size and time, the demo's "Retail Co – DWH", local adapter (fact, measured 24 November 2026):** a fresh demo seed
(`resetDevData(tmp, addSeedDemoData)`, the seed `npm run demo` writes) in a temporary file, the design's tables, live
rows of the workspace:

| Table | Rows | Table | Rows |
| --- | --- | --- | --- |
| concept | 4 | mapping | 14 |
| entity | 13 | mapping_input | 14 |
| attribute | 72 | requirement | 6 |
| attribute_input | 3 | requirement_link | 16 |
| relationship | 12 | project | 2 |
| source_system | 3 | canvas | 3 |
| source_table | 6 | project_canvas | 4 |
| source_column | 36 | canvas_item | 25 |
| source_relationship | 2 | frame | 0 |
| source_relationship_column | 2 | cube_entity, cube_measure, cube_key | 7, 6, 6 |
| classification | 19 | cube_mapping, cube_mapping_input | 19, 19 |
| classification_link | 10 | stereotype | 5 |

**328 rows, 188.0 KB of JSON (192,499 bytes), 16.1 KB gzipped.** `store.snapshot` on the file: 2.6 ms the first read,
0.5 ms cached (median of 9); `JSON.stringify` 0.6 ms, `JSON.parse` 0.7 ms, gzip 1.8 ms. A reference on the seed's
"Performance test" (`addLargeWorkspace`): 3,572 rows, 2,204.5 KB of JSON, 129.1 KB gzipped, `store.snapshot` 3.4 ms
cached, stringify 15.2 ms, parse 9.2 ms.

**KB (assumption, not measured: no KB read in this step):** the PRD gives 4,871 rows at the last backup
(`kb-20261120-1911.json`), which counts every table, change events included. KB's snapshot is at most a few MB of JSON
by Performance test's ratio (about 620 bytes a row), a few hundred KB compressed in Postgres's TOAST. Step 2 adds the
summary's counts and the bytes to `scripts/kb-counts.ts`'s read-only count (on a copy of a backup, counts only), so
Łukasz can see KB's figure at step 4 without anything written. Online timing is measured on the demo only (S35-03's
timing spec), never on KB.

### Q3. The upgrade chain

**What exists (fact).** A module's row shape changes through `TableRules.defaults` (a column added after rows existed)
and `TableRules.upgrade` (pure, idempotent), run by `readRows`/`upgradeRows` in `src/data/rows.ts` on every read on both
adapters (`src/data/postgres/tables.ts:65-70`, `shaped`). InfoMapper's own tables change through the local file's
format steps (`upgradeDb`, `src/data/local/file.ts:104`, upgrade-8 to upgrade-18), which work on the whole file and
may make new rows with new ids and times (format 8 made classifications), so they cannot be reused per row.

**The chain (recommendation).** `snapshot_schema` 1 is the shape above at slice 35. `upgradeBaseline(content, schema)`
in `src/domain/baseline/upgrade.ts`: a list of steps `n → n+1`, each a pure function over the content; then every
module table's rows go through that module's own `defaults` and `upgrade` (the same rules `readRows` runs; `rows.ts`
is pure and the store runs the chain, so the domain does not import the data layer). It runs when a snapshot is read
(the compare action, slice 36's documents) and is never written back: the stored `snapshot_schema` stays as taken.

**"Deterministic, never written back" in code:** a step takes `(content, baseline)` only, no `CommandContext`, so it
has no `newId()` and no clock; a value a step must invent comes from what the content already holds (a default, a
copy, an id derived from existing ids by a fixed rule). Tests: the chain run twice gives equal output; a fixture of
schema 1 (taken from the demo by the step 2 code, committed as JSON under `src/domain/baseline/__fixtures__/`) reads as
the current schema; the store's read never calls a write.

**A guard against a forgotten step (recommendation, cheap):** a test records the columns of every "in" table at the
current `SNAPSHOT_SCHEMA` (read from the migrations, as `table-registry.test.ts` reads them) and fails when a migration
adds, drops or renames a column of such a table without the schema number going up with a step. That is the design's
"a later slice that changes a stored shape of a snapshot table adds its step and a fixture test", made a rule the build
checks.

### Q4. The migration and the local file

**The table today (fact, `initial_schema.sql:586-596`):** `id`, `workspace_id`, `name`, `note`, `created_at`,
`created_by`, `snapshot jsonb not null`, `snapshot_schema integer not null default 1`; index
`baseline_workspace_ix (workspace_id, created_at)`; RLS on (`20261002000100_enable_rls.sql:33`).
`document_definition.baseline_id` already points to it (`20261111120000_infodocumenter.sql:27,40`).

**The migration (recommendation), `20261124120000_baselines.sql` (the time in step 2):**
- AD-12's standard columns that are missing: `version integer not null default 1`, `updated_at timestamptz`,
  `updated_by uuid references app_user (id)`, `deleted_at timestamptz` (F5: AD-12 has no `deleted_by`; the app records
  who deleted in `updated_by` and the change event, as every soft delete does). `updated_at`/`updated_by` are set from
  `created_at`/`created_by` for existing rows (there are none: no code ever wrote one, fact) and then `not null`.
- `name_key text not null`: the normalized name the server writes, unique among live rows: `create unique index
  baseline_name_uq on baseline (workspace_id, name_key) where deleted_at is null` (F6: the app's precedent for a
  case-insensitive name, `classification.name_key` and `stereotype.name_key`, instead of an index on `lower(name)`).
- CHECKs: `baseline_name_ck` (`name = btrim(name) and char_length(name) between 1 and 120`), `baseline_note_ck`
  (`note is null or (note = btrim(note) and char_length(note) between 1 and 1000)`: an empty note is stored as null),
  `baseline_snapshot_ck` (`jsonb_typeof(snapshot) = 'object'`, as `document_definition_recipe_ck`), and
  `baseline_counts_ck` on the summary.
- **The summary:** three columns `entity_count`, `mapping_count`, `requirement_count` (`integer not null`, `>= 0`),
  written with the row and never changed (recommendation: plain columns the list reads and the schema check compares;
  a jsonb would be a fifth JSON place against AD-18's list). What they count: F9.
- The index `baseline_workspace_ix` stays; the list reads live rows of one workspace by it.
- RLS: on already; new columns need nothing; no policy (CLAUDE.md, "Security"). `schema:check -- --existing` covers it.
- **Schema workflow:** `baseline` leaves `NOT_IN_DOMAIN_YET` (`compare-schema.ts:106`), so the schema check compares
  its columns with the domain's `Baseline` type; `snapshot` is a column the domain row type does not carry (F2), named
  in the check as a Postgres column read only by `baselines.snapshot`.

**The local adapter (recommendation, F7):** no format step. `baseline?: Baseline[]` is optional in `DevDb`, as a module's
table is ("absent until a module writes its first row", `ModuleDb`, `schema.ts:163`), so a format-18 file reads as having no
baselines and **KB's archived local file needs no upgrade** (CLAUDE.md: untouched since 21 November 2026). Each
snapshot is a file `<data file without .json>.baselines/<baseline id>.json` (`.data/dev-db.baselines/`,
`.data/demo-db.baselines/`, `.data/e2e-db.baselines/`; `.data/` is git-ignored). The split lives in `file.ts`:
`writeDb` writes every baseline row's `snapshot` to its file (temp file and rename, as the main file) **before** the main
file and stores the row without it; `readDb` never reads the folder; the store's `baselines.snapshot(id)` reads one
file. So every writer (the store's `apply`, the seed, `npm run demo`, the scripts) gets the split without code of its
own. A snapshot file is never deleted (the row is soft-deleted); `resetDevData` empties the folder with the file
(otherwise the e2e reseed before every test leaves files behind).

**KB's local backup including the folder: obsolete (F8).** Since the switch on 20 November 2026 KB's master is online and
the local file an untouched archive; what must include baselines is **`pg:backup`, `pg:restore` and the copy's
`replaceOrganization`** (`scripts/lib/organization-rows.ts`, `src/data/postgres/load.ts`), and `readBackupCopy`
(`scripts/lib/backup-file.ts`). Recommendation: a pg backup holds each baseline's snapshot inline in its row (one
self-contained file, as a backup should be); `pg:restore` writes it back with the row; `tests/contract/copy.test.ts`
gains a baseline in its round trip.

### Q5. The comparison

**The fields per kind, from the app's columns** (fact: `src/domain/types.ts`; the prototype's `DIFF_FL` lists in
brackets; recommendation for the rest, "for Łukasz" 4):

| Kind | Item label | Short fields ("{field}: old → new") | Long fields ("{field} (changed)") | Left out |
| --- | --- | --- | --- | --- |
| Entity | `{name}` | name, alias, stereotype (by its name, `stereotypeIndex`), concept (by name) | definition | model_level (never changes), order, times, versions, ids |
| Attribute | `{entity}.{attribute}` | name, alias, type (`formatAttributeType`, `type-check.ts:75`), PK, FK, BK, personal data, nullable, calculated | definition, rule (`calc_rule`) | sort_order, `copied_from_attribute_id`, calculation inputs (F10) |
| Mapping | `{table}.{column}, … → {entity}.{attribute}` | status (the app's labels: Draft, In review, Approved), kind, source columns (the inputs in order, by name), target attribute | rule (`rule_expression`), note | approved_by/at, review_reason (who and when) |
| Relationship | `{from} – {to}` | label, from min, from max, to min, to max, role at the left end, role at the right end | description | – |
| Requirement | `{key} {name}` | name, kind, status, priority, severity, owner, external reference, parent (by key) | description, expression | links (F10) |
| Source table | `{system} · {table}` | name, system (by name), database, schema, object type, file format, missing from source (yes/no) | comment, note | row count (changes at every re-import), retired_since |
| Source column | `{system} · {table}.{column}` | name, type (`formatColumnType`, `type-check.ts:62`: `varchar(10)`), nullable, PK, FK, default, not needed, missing from source, classifications (F11) | comment, note | ordinal, retired_since |

Every kind covers both levels: a fact or dimension is an Entity row, its attributes Attribute rows (recommendation,
"for Łukasz" 5); InfoCube's own rows (grain, measures, keys, dimensional mappings) are not compared (PRD, "Not in this
slice"). Source relationships (keys between source tables) are not a kind (B2.3 does not name them).

**The labels the app already uses (fact):** the mapping label `inputs.join(", ") → entity.attribute` is the canvas's
`mappingName` (`src/canvas/ModelCanvas.tsx:2188-2194`); a mapping has one input or more (`mapping_input`, AD-26), so the
PRD's single `{table}.{column}` is the one-input case. An attribute `{entity}.{attribute}` and a column
`{table}.{column}` are the app's everywhere (the gap texts, the Markdown's mappings, slice 34). The type texts are
`formatColumnType` and `formatAttributeType`. The status, kind and priority labels are the panels'. A requirement's
`{key} {name}` is the Requirements tab's. The source table's `{system} · {table}` is new (the canvas shows the table's
name; the import's review the system as a heading); two tables of one system with one name in two schemas get the same
label (accepted, a known limitation; their rows still differ).

**Ids by name, both sides (recommendation):** an id is shown by its name **in the state it belongs to**: the old value
by the older state, the new by the newer (the prototype's `show(ov, a)`, `show(nv, b)`), so a concept renamed and moved
to reads right.

**The dictionary (recommendation):** `src/domain/baseline/words.ts`: the kinds, the group headings, the field names, "yes",
"no", "–", "(changed)" by `DocLanguage`, English now; Polish and German keys present and filled from English until slice
36 writes them (the same as `labels.ts` did for German in slice 25). The comparison returns structured changes
(`{ kind, change, id, label, fields: [{ field, short: { old, new } } | { field, long: true }] }`) and the words turn them
into text, so slice 36's section uses the same function in the document's language.

**Where it runs (recommendation, F12):** on the server, in a read action (`baselineCompareAction`, through `modelRead`:
session, membership, an unlocked organization, a read only), which reads the one or two snapshots (Now through the
same `store.snapshot` and `baselineContentOf`) and answers the list of changes only; the browser filters it. Snapshots
never reach the browser.

**The cost (estimate, assumption):** one map per kind and a field comparison per row: on two demo snapshots (328 rows)
well under a millisecond; on two of Performance test's size (3,572 rows) a few milliseconds, plus parsing each snapshot
(9 ms measured). Step 2 adds `scripts/bench-baselines.ts` (reference figures, no bar: CLAUDE.md, "When to measure").

### Q6. History and undo

**Change events outside undo (fact):** `buildWriteSet` writes a change event per row with before and after images
(`src/domain/changes.ts`); a table in `OUTSIDE_UNDO` makes the group not undoable (`isUndoable`, `undo.ts:291`), and
`runCommand` puts only undoable groups into the person's undo history (`historyOf`, `src/app/_lib/run-command.ts:267-269`).
InfoDocumenter's documents work exactly so (`INFODOC_UNDO: "outside undo"`). So `baseline` goes into `OUTSIDE_UNDO`
and its commands into `runCommand`: Ctrl+Z after a baseline undoes the last model change, nothing else is needed.

**The snapshot out of the images (recommendation, F2):** the domain's `Baseline` row has no `snapshot`; only the insert's
write carries it, and `images()` (`changes.ts:93-106`, where `SECRET_COLUMNS` already rewrites columns) leaves the
columns of a new `IMAGE_LEFT_OUT: { baseline: ["snapshot"] }` out of both images entirely (no marker: it is never secret,
only large).

**Where the app shows the history to Łukasz (fact): nowhere.** No page reads change events for display: the readers are
four-eyes' last editor (`src/app/w/[workspaceId]/p/[projectId]/c/[canvasId]/page.tsx:129`,
`src/app/_actions/mapping.ts:110`, `requirement.ts:77`, `source-change.ts:128,136`) and undo. The PRD's assumption is
wrong (F13): S35-02's "recorded in the workspace's history with who and when" can be checked by the tests (the
contract suite on both adapters, the e2e spec reading the e2e data file's events as slice 25's `documentEvents` does)
and shown in CC's report, not on a page ("for Łukasz" 7).

### Q7. Rights

**Today (fact, `src/domain/permissions.ts:9-72`):** 21 actions; `EDITORS` = owner, admin, modeler; `ALLOWED_WHEN_ARCHIVED`
= `workspace.view`, `workspace.unarchive`; every action's "You cannot …" text (`:75-…`).

**New (recommendation):** `baseline.create` and `baseline.rename` for `EDITORS`, `baseline.delete` for owner and admin,
none allowed when archived, texts "create baselines", "rename baselines", "delete baselines". Reading (the list, Compare)
is `workspace.view` (every role, archived too). Guests are not a role: a guest has a workspace role like anyone (`shell.guest`
is only the label, `src/app/w/[workspaceId]/page.tsx:66`), so a guest Reader reads and compares. The domain command
checks the action (`checkPermission`), `runCommand` reads the access again inside the write on Postgres (AD-38), the
pages hide what the role cannot do (`can(access, …)`). The demo accounts for S35-01: Piotr Wiśniewski (Reviewer) and
Kasia Zielińska (Reader, a guest from Retail Co) in "Retail Co – DWH" (fact, the seed's members; online they are the
demo accounts `pg:accounts` made).

### Q8. The demo

**Locally (recommendation):** `addBaselinesDemoData(db)` in `src/compose/seed.ts`, called last by `addSeedDemoData` (the
seed, the reset, `npm run demo`) and by slice 35's fixtures; never inside `addFullDemoData` or the plain e2e seed, so the
earlier fixtures and the benches read the demo as before. It builds the content with the same pure rules
(`workspaceSnapshotOf` over the db's rows, then `baselineContentOf`), then takes out REQ-105 ("Personal data is encrypted
at rest") with its links, `Customer.segment_code` (F14: it has no mapping in the app's seed, `seed-model.ts:187-201`), sets
one approved mapping back to Draft and `customers.cust_no` to `varchar(10)` (it is `varchar(20)`, `seed-model.ts:165`),
and writes the row "Stage 1 sign-off", `created_at` 2026-09-15 10:12 (Europe/Warsaw, 08:12 UTC), by Łukasz, the note
"Agreed with Retail Co on 15 September.", the summary from the content. Which mapping: the prototype takes the first
approved one; in the app that is `customers.cust_id → Customer.customer_id`. Recommendation: `customers.cust_no →
Customer.customer_number`, so S35-04's two named rows are both about `cust_no`. Cost: about 40 lines and a unit test.

**Online (fact, F15):** `pg:seed` refuses a database with rows and its `--reset` refuses while KB is in `infomapper-dev`
(`scripts/pg-seed.ts:7,9-10`, `resetRefusal`), so **the demo baseline cannot reach `infomapper-dev` by the seed.**
Recommendation: at the acceptance (step 5, `dev:pg`, a demo owner) Łukasz takes a baseline, then changes the model
(approve a draft mapping, change a column's type in its panel, delete an attribute) and compares: S35-04's case made by
hand, as the PRD's fallback says. No new `pg:` script.

### Q9. Words

The interface is English only (fact: no interface text is translated; the documentation languages are InfoDocumenter's
and the built-in classifications'). Every new interface text, as the PRD and the prototype give them:
- Tab: "Baselines ({n})". Intro: "A baseline freezes the model (entities, attributes, sources, mappings, relationships,
  requirements) with a name, e.g. for a sign-off. Compare it with today, or produce documentation exactly as it was."
  (F16: "produce documentation" points to slice 36.)
- Box: "New baseline", "Name, e.g. Stage 2 sign-off", "Note (optional)", "Create baseline".
- Refusals: "Give the baseline a name.", "A baseline named {name} already exists in this workspace.", and the rights'
  "You cannot create baselines …" (the app's pattern).
- Toasts: "Created the baseline {name}.", "Renamed the baseline {old} to {new}.", "Changed the note of the baseline
  {name}.", "Deleted the baseline {name}.".
- List: "{yyyy-mm-dd hh:mm} by {person} · {note} · {e} entities, {m} mappings, {r} requirements" (singulars: "1 entity",
  "1 mapping", "1 requirement", recommendation), "No baselines yet.", "Compare…", "Rename", "Delete baseline".
- Rename: "Rename “{name}”", "{workspace} · baseline", "Only the name and the note change. What the baseline holds stays
  as it was taken on {date time}.", "Name", "Note (optional)", "Cancel", "Save".
- Delete: "Delete the baseline “{name}”?", "{workspace} · baseline", "It cannot be brought back here.", "Cancel",
  "Delete baseline".
- Compare: "Compare “{name}”", "Compared with", "Now (the live model)", "{name} ({date time})", "Filter", "A name, e.g.
  Customer or cust_no", "Kind", "All kinds", the seven kinds, "{n} change(s) from {older} to {newer}", "; {m} shown by the
  filter", "No changes from {older} to {newer}.", "Nothing matches the filter.", "Added ({n})", "Changed ({n})", "Removed
  ({n})", "Kind", "Item", "What changed", "now", "“{name}” ({date time})", "Close", the field names (Q5), "yes", "no",
  "–", "(changed)".
- Gone: a baseline deleted meanwhile when Compare or Rename is clicked: "This baseline no longer exists." (new,
  recommendation, F17).

Only the comparison's words need Polish and German, in slice 36 (the dictionary, Q5).

### Q10. Risks and shared infrastructure

- **The home's tabs (fact):** the page draws Overview, the modules' tabs, People, Metadata conventions, Settings
  (`src/app/w/[workspaceId]/page.tsx:160-168`); the order rule is `CORE_HOME_TABS` and `homeTabOrder`
  (`src/ui/home-tabs.ts:9-25`, tested in `home-tabs.test.ts`). Baselines is a core tab after the modules' and before
  People: `CORE_HOME_TABS` becomes `overview, baselines, people, conventions, settings` and `homeTabOrder` puts the
  modules' tabs after Overview as now. `S23-01` asserts the whole tab list (`e2e/slice-23/S23-01.spec.ts:18`) and changes;
  no other spec does (fact, grep of `[role="tab"]` and `getByRole("tab")`: `S15-01` and `S15-06` read the left panel's
  tabs).
- **The tab's count on every home load:** one more read (`baselines.list`) on both adapters. **Online `select *`
  (`src/data/postgres/tables.ts:49`) would fetch every snapshot** (F2): the baseline list names its columns. Measured on
  the demo by the timing spec; no measuring sitting (no canvas drawing changes, CLAUDE.md "When to measure").
- **Shared infrastructure** (CLAUDE.md, "Test runs"' exception): the table registry, the local adapter (`file.ts`,
  `store.ts`, `schema.ts`), `changes.ts`' images and undo's outside list. Step 2 runs a full run.
- **The e2e parts:** `e2e/slice-35` joins the last part (from `slice-26`, `e2e/parts.ts:25`, recut on 21 November);
  about six specs, a few minutes. Heap: parts 5 and 6 peaked near 1.9 GB in slice 34's runs on folders this slice does
  not touch; part 10's growth is reported after step 3's run, a recut only by the rule.
- **`docs/data-model-v2.md`'s line on `document_definition.baseline_id`** ("no key in the local adapter while `baseline`
  is not in the domain") becomes a foreign key in the local rules now (cheap, slice 36 needs it).
- **What changes this plan:** nothing found that needs a decision before step 2 beyond section 3.

## 2. A note on the time (F18)

The PRD's assumption "the time in the person's time zone, as other times in the app" has no rule to follow: the app's
times are **the server's local time** (fact: `src/app/_panels/import/system-imports.ts:1-3`, "Built on the server … the
time is the server's local time"; the e2e run sets `TZ` Europe/Warsaw, `.github/workflows/e2e.yml:41`). On Vercel the
server's time is UTC, so the preview would show 08:12 for a baseline taken at 10:12 in Warsaw. Recommendation: the
baselines' times are written in the browser's time zone by a small client part (the ISO time from the server, the text
after hydration, `yyyy-mm-dd hh:mm`), used by the list, the Rename dialog and Compare; "for Łukasz" 1.

## 3. Where the PRD is wrong or costs more (with proposals)

- **F1. "One store method makes it from one read" exists already.** `store.snapshot` is that read, on both adapters,
  contract-tested (Q2). Proposal: no new store method for taking; `baselineContentOf` (pure) projects it; the store gets
  only the baselines' own port (`baselines.list`, `get`, `snapshot(id)`) and its writes go through `apply`.
- **F2. The snapshot must stay out of every row read and image.** Postgres reads `select *` (`tables.ts:49`) and drops
  hidden columns only after the read (`POSTGRES_ONLY`, `tables.ts:62-70`), so the list would carry every snapshot; and
  `buildWriteSet` copies the whole row into the images. Proposal: the domain's `Baseline` row has no `snapshot`; the
  insert's write carries it (`IMAGE_LEFT_OUT` drops it from the images); the Postgres baseline reads name their columns;
  a rename's update carries only the domain row, and Postgres's update writes only the fields a row carries (fact,
  `src/data/postgres/write.ts:257-266`), so the snapshot is never written again; the local adapter refuses an update of
  a baseline that carries `snapshot` (a rule and a test: the content is immutable by construction).
- **F3. `document_definition` is a module table, but out of the snapshot.** "Every module's tables" would put the
  workspace's documents into a baseline, other people's private ones included (D-80: never told to exist), and a
  document can point to a baseline. Proposal: InfoDocumenter flags it "out"; "every module's tables" reads "every
  module's model tables" in D-87.
- **F4. The settings.** The four (`dv2_mode`, `four_eyes`, `naming_conventions`, `infocube`) are the design's. Not in it:
  `doc_language` (a document has its own language, D-81; the built-in classifications' names are rows) and `infodoc`.
  Proposal: the four, as designed; slice 36 reads a document's language as today.
- **F5. `deleted_by` is not an app column.** AD-12's standard columns are `version`, `created_at/by`, `updated_at/by`,
  `deleted_at` (`src/domain/types.ts:25-37`); the PRD also misses `updated_at/by`. Proposal: the standard columns, the
  delete's person in `updated_by` and its change event.
- **F6. `lower(name)` in an index.** Not portable to SQL Server's filtered indexes (AD-18) and not the app's way.
  Proposal: a `name_key` column written by the server, unique among live rows, as classifications and stereotypes have
  one; the local adapter's uniqueness rule the same. Its rule is B1.3's, not D-78's: D-78 also ignores spaces, `_`, `-`
  and `/` (`normClassification`, `src/domain/model/classifications.ts:161`), so "Stage 2" and "Stage-2" would clash.
  Recommendation: the trimmed name in lower case, repeated spaces as one (`stage 2 sign-off`).
- **F7. "A format step if needed": not needed, and better avoided.** An optional `baseline` table reads a format-18 file
  as before, so neither the local files nor KB's archive change (Q4).
- **F8. "KB's local backup includes that folder" is out of date.** Since 20 November 2026 KB's master is online; the
  backup that matters is `pg:backup` (and `pg:restore`, `replaceOrganization`), with the snapshots inline (Q4). S35-05's
  sentence becomes: "a `pg:backup` of an organization holds its baselines with their snapshots, and `pg:restore`
  brings them back" (contract suite, `copy.test.ts`).
- **F9. What the counts count.** The prototype counts every entity and mapping of its model. The app's rule since slice
  15a (Q4 there, CLAUDE.md: "InfoMapper's lists and counts are logical only … a later count decides its level"): the
  Overview's stats count logical entities and InfoMapper's mappings. Proposal: logical entities, InfoMapper's mappings
  (source → logical), live requirements, as the Overview; "for Łukasz" 2.
- **F10. Calculation inputs and requirement links are not compared.** Neither is a kind (B2.3); a calculation's rule
  change shows as "rule (changed)" on its attribute and "calculated: no → yes". Proposal: left out, named in "Not in this
  slice".
- **F11. A column's "tags" are classifications**, which the PRD leaves out of the comparison ("comparing
  classifications" in "Not in this slice") while its field list keeps "tags". Proposal: compare the classifications **of
  a column and of a table** as a list field ("classifications: Business key → Business key, Personal data"), by name in
  each state; the classification list itself stays out; "for Łukasz" 3.
- **F12. Where the comparison runs** is not said. Proposal: a server read action answers the changes; the browser
  filters (Q5). Snapshots of a few MB never go to the browser.
- **F13. No page shows the history** (Q6). Proposal: S35-02's "recorded … with who and when" is proved by tests and the
  report; no history view in this slice ("for Łukasz" 7).
- **F14. `Customer.segment_code` has no mappings in the app's seed**, unlike the prototype's; "and its mappings" is void
  (Q8).
- **F15. The demo baseline cannot be seeded online** while KB is in `infomapper-dev` (Q8). Proposal: the acceptance's
  case made by hand on `dev:pg`; the local seed has the baseline.
- **F16. S35-04's filter example is incomplete.** With the demo baseline, "cust" also finds the changed mapping
  (`customers.cust_no → Customer.customer_number`) and REQ-105 only if its name contains "cust" (it does not). Proposal:
  "‘cust’ finds customers.cust_no, Customer.segment_code and the mapping from cust_no" in the criterion. The intro's
  "produce documentation exactly as it was" promises slice 36: proposal, keep it (the tab is shared with slice 36).
- **F17. A baseline gone meanwhile.** Another person may delete a baseline while it is open in Compare or Rename. Proposal:
  the rename answers "not found" (the app's cut) and the list refreshes; Compare answers "This baseline no longer
  exists." and closes; "Compared with" offers what the page read.
- **F18. The time zone** (section 2).
- **F19. The comparison of "Now" must be built like a baseline.** Otherwise a field the live read gives and the snapshot
  does not (or another order) shows as a change. Proposal: Now is `baselineContentOf(store.snapshot(…))` run through the
  same chain, so a baseline compared with Now right after it is taken shows "No changes" (a unit test and S35-03).
- **F20. The rename's name check runs on the server too**, against live rows, inside the write's uniqueness rule (both
  adapters refuse a duplicate `name_key`, answered with the PRD's message), so two people creating the same name at once
  get the message and not a database error.

## 4. The prototype against the app (what this slice touches)

- **The time:** the prototype keeps "yyyy-mm-dd hh:mm" as the browser made it; the app stores a timestamp and writes it
  in the browser's zone (F18).
- **The counts:** the prototype reads them from the snapshot (`b.model.entities.length`); the app stores the summary
  (PRD) and counts logical entities (F9).
- **The mapping:** the prototype's has one `columnId`; the app's has inputs (Q5).
- **Types:** the prototype's `dataType` is one string; the app formats the type from its parts (Q5).
- **Tags:** the prototype's source column `tags`; the app's classifications (F11).
- **More fields:** the app has aliases, BK, calculations, roles, a relationship's description, a requirement's severity,
  owner, external reference and parent, a column's default, comment, note, "not needed" and "missing" (Q5).
- **Rights:** the prototype's `perm === "full"` (owner, admin, modeler, not archived) for the box and Rename and
  `admin` for Delete match the PRD (fact, `wsPerm`, prototype line 6178).
- **Checks:** the prototype checks the name in the browser only; the app checks it in the domain and in the write (F20).
- **Not undoable:** the prototype's `rootChange` is not an undo step either (prototype line 6232): no difference.
- **Slice 36's parts** ("New document from it", "Make a document", the sign-off preset, the gone baseline's document)
  are not built.
- **The snapshot's content:** the prototype's `modelPart` holds the model and canvases; the app's holds the design's
  tables (Q1), InfoCube's rows and the four settings too.

## 5. Earlier specs and tests, by step

- **Step 2:** `tests/table-registry.test.ts` (baseline registered, the flag case), `tests/schema/compare-schema.ts`
  (`NOT_IN_DOMAIN_YET` empty), `tests/contract/reads.test.ts`, `writes.test.ts` and `copy.test.ts` (the baseline's
  port, writes, the copy and backup), `tests/kb-copy.test.ts` (the rows by key), `src/domain/permissions` tests (three
  actions), `src/data/local/store.test.ts` and the file's tests (the folder), the seed's tests where they count rows per
  table (`addSeedDemoData` gets a baseline). No e2e spec changes in step 2 (no page changes); the "full" seed's
  fixtures (slices 25 to 28, 32, 34) get one baseline row that no page shows until step 3. A full run (shared
  infrastructure).
- **Step 3:** `src/ui/home-tabs.test.ts` (the order), `e2e/slice-23/S23-01.spec.ts` (the tab list gets "Baselines (0)",
  plain seed), the new `e2e/slice-35/` (S35-01 to S35-04 and the timing spec; S35-05 and S35-06 are the runs and the
  report). A full run.
- **Steps 4 to 6:** no test changes; the closing's full run.

## 6. The plan for steps 2 to 6

2. **The domain and the data.** `Baseline` type, `src/domain/baseline/` (`tables.ts` flags, `content.ts`
   `baselineContentOf` and the reader, `upgrade.ts`, `compare.ts`, `words.ts`, `names.ts`), commands
   `createBaseline`, `renameBaseline`, `deleteBaseline` (outside undo, `IMAGE_LEFT_OUT`), the three rights, the migration,
   the local adapter (rules, the optional table, the folder in `file.ts`, `baselines.snapshot`), the Postgres adapter
   (its reads with named columns, the write through `apply`), `pg:backup`/`pg:restore`/copy with baselines, the demo's
   baseline, the unit tests, the contract suite, `scripts/bench-baselines.ts` (reference figures), `kb-counts.ts`'s
   baseline line. Draft PR into `dev`. A full run.
3. **The tab and the dialogs.** The tab after the modules' and before People, the box, the list (the browser's time),
   Rename, Delete, Compare (the server action, the filter in the browser), the e2e specs and their helpers. A full run.
4. **Łukasz's migration:** `pg:backup`, KB's counts, `pg:migrate` on `infomapper-dev`, KB's counts again. Stop.
5. **Łukasz's acceptance** on `dev:pg` with demo accounts: S35-01 to S35-04 (S35-04's case by hand, F15). Stop.
6. **Close.** D-87, AD-03/AD-14's notes, AD-39's housekeeping note, PR 92's decisions, the docs (section 8 of the PRD),
   one full run on the final commit; the merge and the tag on Łukasz's command.

## 7. For Łukasz to decide

Business questions; each with Claude's recommendation first.

1. **The time shown** for a baseline (list, Rename, Compare): (a, recommended) the browser's time zone; (b) the server's,
   as the import's times (UTC on the preview). F18.
2. **The list's counts:** (a, recommended) logical entities, source-to-logical mappings and requirements, as the
   Overview; (b) every entity and mapping, facts and dimensions and dimensional mappings included. F9.
3. **A column's and a table's classifications in Compare:** (a, recommended) yes, as a list field ("classifications: A →
   A, B"); (b) no, as the PRD's "Not in this slice". F11.
4. **The fields compared** (Q5's table: aliases, BK, calculated and its rule, roles, a relationship's description, a
   requirement's severity, owner, external reference and parent, a column's default, comment, note, "not needed" and
   "missing", a table's file format, comment, note and "missing"; the row count left out): (a, recommended) as the
   table; (b) only the prototype's lists.
5. **Facts and dimensions in Compare:** (a, recommended) compared as entities and attributes (InfoCube's own rows not);
   (b) logical only.
6. **The demo online:** (a, recommended) no seeded "Stage 1 sign-off" on `infomapper-dev`; S35-04's case made by hand at
   the acceptance; (b) a script that adds only the demo's baseline online (a new `pg:` script). F15.
7. **The history:** (a, recommended) no page shows baselines' change events in this slice; S35-02's "recorded" is shown
   by the tests and the report; (b) a history view (a feature of its own, not in the PRD). F13.
8. **S35-04's filter sentence** as F16 proposes.

Technical points, Claude's recommendations (no answer needed unless Łukasz disagrees): F1–F7, F10, F12, F14, F17, F19,
F20, the shape (Q2), the chain and its guard (Q3), the migration (Q4), the server-side comparison (Q5), the rights' texts
(Q7), the demo's mapping `cust_no → customer_number` (Q8).

Housekeeping for the closing (PRD section 8): AD-39's note on Supabase's own backups and the simplified backup rule, and
PR 92's decisions (1 and 3 approved, 2 (b)), quoted in full then.
