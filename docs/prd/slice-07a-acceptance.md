# Slice 7a – Acceptance

Status: **step 4 done (22 October 2026); step 5 waits for Łukasz's go.** Branch
`slice/07a-source-import`, from `main` at `576c614`. PRD: `docs/prd/slice-07a-source-import.md`. The PRD stays as
written; this file is its amendment (Łukasz, 22 October 2026).

## Łukasz's answers to step 1 (22 October 2026)

Guiding principle for all of them: the modeller stays in control and sees what will happen before it happens. Nothing
changes silently; whatever an import does is visible before it is written and can be undone.

1. **Branch:** from `main` including PR #18.
2. **Old references:** the old prototype's name stays in closed slices, the inventory and the spike.
3. **`max` (F2):** `type_length = -1`, on one condition: -1 lives only inside the domain's type reader and storage;
   every screen, review row and export shows `max`, never -1. Existing rows that lost `max`: see "Open after the
   answers", point 1.
4. **Fractional seconds (F3):** kept as precision; one type reader for "New source table" and the import.
   `datetime2(3)` → `datetime2(7)` is a real change and shows as one; differences that are not real never show.
5. **Type table (F4):** Oracle and PostgreSQL names in D-01's table, `number(p,0)` as integer. **New criterion
   S7A-16:** re-importing an unchanged SQL Server, PostgreSQL and Oracle file shows no changes and sends no mapping to
   review.
6. **`review_reason` (F6):** set only when an import moves a mapping from approved to review; cleared on any change of
   the mapping's status or content.
7. **Four-eyes (F7):** yes, and only while four-eyes is on: it stays a workspace setting (AD-06, off by default). With
   it off, the person who ran the import approves the mapping themselves. P6 applies either way: it answers "is the
   approval still valid", not "who approves", consistent with D-51, which already applies with four-eyes off.
8. **Column comment (F19): stays editable** (tables added with "New source table" need it until 7c). A re-import that
   would overwrite it shows it in the review as a change ("comment: {current} → {from the source}"), so the modeller
   sees it before importing. P2 still lets a file without `column_comment` leave every comment alone.
9. **Coverage (F20):** in 7a, an approved mapping from a column missing from source no longer counts toward coverage.
10. **Seed (F21):** the attribute lengths and the two source relationships from the new prototype go into the seed.
11. **Positions (F23):** the new position is written; the review shows "position {a} → {b}" among the unchanged
    columns, not counted as a change.
12. **Upload and P8 (F15, F16):** a separate upload endpoint (route handler; the write still goes through the domain
    command, AD-23); the server rebuilds the plan and compares it with the one shown in the review.
13. **Size (F17):** measure at 20,000 and 100,000 column rows, then propose the limit with the figures.
14. **"New source table" (F27):** stays, with the proposed texts for its hint and the empty workspace.
15. **Samples (F25):** `src/domain/import/samples/`, on one condition: no application code imports them and they
    never reach the client bundle (P10: no samples in the app). Only tests read them.
16. **Tests per step (F28):** CI after steps 2 and 3; a full e2e run after steps 4, 5 and 6; two full runs in a row
    at the close.
17. **Extra figure (F10):** moving a card after three large imports, bar 500 ms.
18. **CLAUDE.md rule:** word for word, added in step 1 as its own commit.

Also:

- **S7A-08 (F1):** the type conflict is tested on a direct mapping; the business key change and the renamed input in
  the rule on a combined mapping.
- **`docs/ideas.md`, for 7b:** "Approve again all {n}" for the mappings one import sent back to review (added).

### Open after the answers

1. **Rows that lost `max` (answer 3).** The demo seed and `seed:large` have no `(max)` column, so no seeded row lost
   it. Only columns typed by hand as `(max)` in a local data file are stored with no length; that information is gone
   and cannot be recovered. From step 2 on, "New source table" stores `(max)` as -1. A later re-import of such a
   column from a file that says `max` shows one real change against what is stored, "type nvarchar → nvarchar(max)",
   and writes -1. Nothing is converted silently.
2. **Answer 10 makes a demo mapping a type problem.** With Customer.email at `string(120)`, the draft mapping
   `web_users.email` (`varchar(255)`) → Customer.email no longer fits: the canvas shows its warning chip and the
   status bar's "Type problems" goes up by one. The new prototype has the same seed and the same result. Earlier specs
   that count type problems or read that line are checked when the seed changes (step 6); I take this as intended
   unless you say otherwise.
3. **Answer 8 and P1.** P1 says the source owns the comment, and the comment stays editable. I write it into the new
   D-entry as: the source owns it on re-import, the modeller may edit it in between, and the review shows every
   overwrite. The review shows the overwrite whether the stored comment came from a person or from an earlier import.
4. **Answer 5's criterion needs vendor files.** S7A-16 needs one file per vendor shaped as its catalog query returns it
   (Oracle and PostgreSQL type names, `NULL` cells). They are made in step 2 next to the prototype's samples in
   `src/domain/import/samples/`.
5. **Answer 15's condition is enforced by lint.** Step 2 adds an ESLint rule: files under
   `src/domain/import/samples/` may be read only from `*.test.ts`, `tests/` and `e2e/`; the samples are text files read
   with `fs`, not modules, so no bundle can include them.
6. **Steps 2 and 3 change behaviour the app already has.** Steps 2–3 are CI only (answer 16), but step 2's type changes
   (`max`, the type table, one type reader) touch the type check and "New source table" that pages already use. Under
   CLAUDE.md's rule for a step's touched specs, step 2 also runs the earlier specs of the type check and of "New
   source table" (slice 1a, 1b). Say if you want them left to step 4's full run.

## Step 1: start checks (22 October 2026)

- `main` equals `origin/main` (`576c614`), working tree clean.
- **`main` is not at the tag `slice-06b`.** The tag is on `6977a34` (PR #17's merge). `main` has three commits after it:
  PR #18 (`chore/audit-handlebars-2026-10-22`: the handlebars 4.7.10 override and the npm audit note). The branch was
  made from `main` as asked, so it includes PR #18. The PRD's header ("from `main` at tag `slice-06b`") is off by that
  PR.
- No dev server, Playwright or measurement server running: ports 3000, 3200 and 3300 free, no `next`, `playwright`
  or measurement process.
- Downloads held one copy of each file: `slice-07a-source-import.md` (35,705 bytes, 22 Oct 20:56) and
  `infomapper-prototype-with-sources.html` (584,023 bytes, 22 Oct 20:29). No “(1)” copies.
- Commits in this step:
  1. `7627ef0 docs: add the slice 7a PRD`: the PRD copied byte for byte (`cmp` identical).
  2. `74d355d docs: make infomapper-prototype-with-sources.html the reference prototype`: the new file added
     (identical to the download), the old one removed, live references updated (list below).

### The prototype's references

Changed to the new file:

| File | Line |
| --- | --- |
| `CLAUDE.md` | "Sources of truth" table |
| `docs/decisions.md` | line 7, "Behaviour reference" |
| `docs/data-model-v2.md` | line 7 |
| `e2e/slice-04p/S4P-04-screens.spec.ts` | `PROTOTYPE` (screenshots beside the prototype) |
| `e2e/slice-04b1/S4B1-06-screens.spec.ts` | `PROTOTYPE` |
| `src/data/local/seed-model.ts` | the file's first comment (rewrapped to 120 columns; comment only) |

The two screenshot specs call the prototype's globals `openCanvasFromHome`, `V`, `S`, `applyT`, `rebuild` and the
canvas `dia_main`; all exist in the new file. Not run (they run only with `SCREENS=`).

**Left as they are, on purpose (please confirm):**

- Closed slices' PRDs and acceptance docs (`slice-00-skeleton.md`, `slice-01a-*`, `slice-01b-*`, `slice-02a-*`,
  `slice-02b-*`, `slice-02c-*`, `slice-03a-*`, `slice-03b-*`, `slice-04a-*`): they record what the reference was when
  that slice was built, and `slice-04a-acceptance.md:257` cites line numbers in the old file. The old file stays
  readable at the tag: `git show slice-06b:docs/prototype/infomapper-model-prototype.html`.
- `docs/inventory-prototype-vs-app.md`: it records a comparison with the old file at a named commit. It is rewritten
  for the new reference at the closing step (PRD section 10).
- `spikes/canvas-react-flow/app/globals.css`: a comment in a spike (CLAUDE.md: spikes change only when asked).
- `README.md` names no file, only "the prototype". `scripts/` has no reference.

## Step 1: answers to Q1–Q10

### Q1. Sources in the app today

- **"New source table"** (`src/app/_panels/new-source-table-dialog.tsx` → `createSourceTableAction` →
  `createSourceTable` in `src/domain/commands/source.ts`): system name, database, schema, name, optional object type,
  columns as lines (`parseColumnLines`, `src/domain/model/column-lines.ts`). One change group. The system is found by
  name ignoring case, otherwise created (`source_system` row in the same group). Columns get `ordinal` 1…n, nullable,
  no PK/FK/BK/PII, no comment.
- **`nvarchar(max)`:** `parameters()` in `column-lines.ts` stores `(max)` as `type_length = null`, the same as no
  length. `formatColumnType` then prints `nvarchar`, and `checkColumnType` skips the length check: `nvarchar(max)`
  fits `string(100)` today. See finding F2.
- **One number** of a non-text type is a precision (`datetime2(7)` → `type_precision 7`, `float(53)` → precision 53);
  data types are stored lower case. See F3.
- **Uniqueness and soft delete:** migration `20261002000000_initial_schema.sql`: `source_system_name_uq (workspace_id,
  name)`, `source_table_name_uq (source_system_id, database_name, schema_name, name)`, `source_column_name_uq
  (source_table_id, name)`, all among non-deleted rows and **case-sensitive**. The local adapter mirrors them
  (`src/data/local/schema.ts`, `unique` without `lower`). `createSourceTable`'s own `taken` check is case-sensitive too;
  only the system lookup ignores case. Deletes are soft; `deleteSourceTable` refuses while a mapping reads a column and
  otherwise takes the columns, cards, label links, requirement links and pinned notes with it.
- **What the migration of items 1–5 needs:** `source_table`: drop and re-add `source_table_object_type_ck` with
  `file`, add `file_format text`, `missing_since timestamptz`; `source_column.missing_since`; two new tables and
  `source_import` with RLS on; `mapping.review_reason`. Plus everything listed in F12 and F13 (the local adapter's
  schema and format, undo, loaders), which the PRD does not list.

### Q2. Where the work runs

- The canvas page already holds the whole workspace model (`store.model.load`, label and requirement links:
  `src/app/w/[workspaceId]/p/[projectId]/c/[canvasId]/page.tsx:86–98`). Reading and planning can run **in the browser**
  for the review (the readers and the engine are pure `src/domain` code), so filters and rename choices answer at once.
  The page has to load the new tables (relationships, imports) too.
- **The server reads and plans again** from the same text and the person's choices (P8). A server action cannot carry
  the text: actions are capped at 1 MB by default (`node_modules/next/dist/docs/01-app/02-guides/server-actions.md:83`).
  Raising `serverActions.bodySizeLimit` would raise it for every action. Proposal: one **route handler** for the import
  (`src/app/w/[workspaceId]/import/route.ts`, POST, the text as the body, refused above the size limit) that runs the
  same write pipeline as `runCommand` (session, command, live writes, apply, undo history). See F16.
- **Windowed rendering:** a first import of 20,000 columns lists 20,000 "new" rows in step 3. The review needs either
  windowing or table cards folded by default. Decided by measuring in step 5 (F18).

### Q3. One undo step for a large write

- The undo history keeps each step's change events in the server's memory (`src/domain/model/undo-history.ts`, 50
  steps per person and workspace, `globalThis.__infomapperUndo` in `src/data/local/store.ts`). A 20,000-column import
  is one step with about 20,000 events, each with full row images: tens of MB in memory, acceptable in development.
- `revertChangeGroup` (`src/domain/commands/undo.ts`) is all or nothing: if any row the import wrote has changed since
  (a new column mapped, a BK flag set), the whole undo is refused with "This can't be undone because it was changed
  afterwards." The PRD should say so (F34).
- Cost: undo's `consistent()` scans every child table for each row that stops being live (quadratic, F11), and the
  local adapter's `applyWrite` searches the table for every write (quadratic, F10). Both are fixable in the adapter
  and in `undo.ts` without changing behaviour; both are measured in step 4.
- Data file growth: every large import adds its rows and their events to `.data/dev-db.json`; its undo adds as many
  events again with both images. After a few large imports the file is tens of MB, and every later write and page load
  parses and writes the whole file (F10).

### Q4. Concurrency (P8)

Versions alone do not catch it: the import writes only changed rows, so the adapter checks versions only of those. A
column whose BK flag someone set, a table someone added by hand, a mapping someone made on an imported column: all are
rows the import reads but does not write. Proposal: **compare plans, not states.** The review sends a digest of the plan
it showed (each table's and column's status and changes, the rename pairs, each mapping's send-back with its reasons,
the relationships, and the id and version of every row the import will write). The server rebuilds the plan from the
text, the scope and the choices against the current data, digests it the same way, and writes only when the digests
match. An unrelated edit in the system does not refuse the import; anything that changes what the import does does.
When they differ, the refusal carries P8's text and the browser rebuilds the review (choices kept where their
`table|column` key still exists, as the prototype's `decisions` map is keyed). See F15.

### Q5. The type check

`checkColumnType` and `checkMappingTypes` in `src/domain/model/type-check.ts`: pure, per input, on a `ColumnType`
(`data_type`, `type_length`, `type_precision`, `type_scale`), so the engine can call them on a column state that is not
stored. Two facts change P6 and S7A-08 (F1): a transform with a rule is never a type problem, and a combined mapping is
always a transform with a rule (`checkMappingShape`, `src/domain/model/mapping-rules.ts`). So "a new type conflict" can
only happen on a direct mapping. The prototype's new `typeIssue` also checks lengths and treats `max` as unbounded; the
app's check already compares lengths (stricter), but sees `max` as no length (F2) and misses the Oracle and long
PostgreSQL type names the catalog queries return (F4).

### Q6. Mapping status changes

D-51 today: `afterContentChange` (`mapping-rules.ts`) returns `{ status: "review", approved_by: null, approved_at:
null }` for an approved mapping whose inputs, kind or rule change; `updateMapping`, `addMappingInput`,
`removeMappingInput`, `reorderMappingInputs` and the split/merge commands use it. The import can use the same helper and
add `review_reason`, so there is no second approval path. `mapping_approval_ck` (status approved ⇔ `approved_at` set)
holds. The reason shows in the mapping panel under the status control (`src/app/_panels/mapping-panel.tsx`, the
`seg-mapping-status` segment, around line 339). Three things the PRD misses: F5 (undo of a reviewer's approval), F6
(when the reason is cleared), F7 (four-eyes after an import).

### Q7. Test files against the demo data

The CRM sample (`SAMPLE_CRM`) matches the demo CRM's names (`crmprod.dbo.customers`, `customer_addresses`), and the
prototype's seed was its basis. Against the **app's** demo (`src/data/local/seed-model.ts`) it gives: `cust_no`
varchar(20) → varchar(25) (a BK column: its approved mapping to Customer.customer_number goes back to review);
`email_addr` varchar(120) → varchar(255) (no conflict, because the app's Customer.email has no length, F21); `dob` →
`date_of_birth` (suggested rename, same position 6 and type date; its mapping is in review); `segment` char(3),
`created_ts` gone; `consent_flag`, `created_on`, `customer_segment` new; `updated_ts` moves 9 → 7; `city` nvarchar(60)
→ (80); two new tables (`customer_consents`, `stage.customers_load`); one new relationship. It has **no missing table,
no "back", no missing relationship**, so S7A-05 cannot pass with the sample alone.

Proposal (files written in step 6, exact content then):

1. `crm-partial.csv`, imported first (compare "Anything in the imported schemas"): the demo CRM without
   `customers.segment` and without `customer_addresses` → one missing column, one missing table (and its relationship
   if F21's seeded relationships are accepted).
2. `crm-changed.csv`, imported second, the changed file of the DoD: based on `SAMPLE_CRM`, with `segment` and
   `customer_addresses` back, `updated_ts` left out (missing, not mapped: "Not mapped"), `customers` with the comment
   "Customer master" and a new row count (table meta), `cust_no` and `email_addr` widened, `dob` → `date_of_birth`
   (suggested), `created_ts` → `created_on` (paired by hand; its rule `CAST(created_ts AS date)` is rewritten; the
   mapping is in review and stays so), `customer_consents` new with `FK_customer_consents_customers` (new relationship),
   `FK_customer_addresses_customers` left out (missing relationship, if seeded), `stage.customers_load` new with
   `payload nvarchar(max)` and `batch_ref` without a type (a warning).
3. `crm-no-comments.csv`: the same as 2 without the `column_comment` column (P2).

Every status then appears at least once: new, changed, unchanged, missing, still missing (a third import), back,
rename; new, missing and back relationships; table meta.

### Q8. The system as a selection

Not selectable today. Frames of kind `source_system` exist (`src/app/_panels/frame-panel.tsx`), but a system has no
panel. The selection type (`src/canvas/line-data.ts:117`) already has a panel-only kind for elements without a card:
`{ t: "element", kind: "entity" | "attribute" | "source_table" | "source_column", id }`. Proposal: add `"source_system"`
to that `kind` rather than a new `t`. Then `placeOf` (`src/canvas/SelectionHistory.tsx:37`) records it with no change,
`ui.showPlace` already does not centre an `element`, and `GONE.element` ("That element no longer exists.") or a new
"That source system no longer exists." covers a gone one. Item 38's panel is a new branch in `inspector.tsx`. Note: the
app has no command that deletes a system; a system disappears only when the import that created it is undone, so
S7A-11's "deleted system" is reached through undo.

### Q9. The dialog

`src/ui/components/dialog.tsx` (shadcn/Radix Dialog, already used by `new-source-table-dialog.tsx`) gives the modal,
focus trap, focus return and Esc. It is `sm:max-w-lg`; the wizard passes its own width and height (the prototype's
`.wiz`). Steps as `<ol>` of buttons with `aria-current="step"`, as the prototype. Files: `<input type=file>` and drop
with `File.text()` in the browser, no upload until "Import into". Esc while a native `<select>` is open (the Database
select, `GroupedSelect` in `fields.tsx` uses native `<select>`): Chromium's popup takes the key, so the dialog should not
close; checked in a spec in step 5. The tree's checkboxes need `indeterminate` set from an effect (it is not an
attribute).

### Q10. Earlier tests and texts

- Sources tab: "Import sources…" at the top and the system's open button change the tab's buttons; specs that count
  or locate buttons in `tree-system-head` (slice 1a, 4a's tree specs) are checked in step 6.
- Column panel specs (BK, PII, comment: slice 1a, 1b) change if the comment becomes read-only (F19).
- Type check specs (slice 1a, D-01) change if `max` or the type table changes (F2–F4).
- D-51's specs and the mapping panel: `review_reason` under the status; F5's undo change.
- Requirement coverage specs (4a, 4b-1) change only if F20 is accepted.
- Element counts: `S3B-15-elements.spec.ts` against `slice-06b`'s (S7A-14).
- **Texts that mention import:** `src/app/w/[workspaceId]/page.tsx:145` ("add sources (import comes with architecture
  area A-04)") and `new-source-table-dialog.tsx:43` ("Describe a table by hand. Import from a database comes later.").
  The PRD names only the first (F27). The new prototype still has the A-04 text on its empty workspace.

## Step 1: findings from the critical review

Each finding: where, the problem, the proposal. "Ask" marks those that need a decision (questions below).

**F1. Type conflicts and combined mappings (P6, item 31, S7A-08).** `checkMappingTypes` returns ok for any transform
with a rule; `checkMappingShape` makes every mapping with two or more inputs a transform with a rule. So a combined
mapping never gets a type conflict; P6's first reason applies only to direct mappings. *Proposal:* S7A-08's combined
case checks a business key type change and a renamed input in the rule; item 25's "type conflict" impact is shown only
for direct mappings.

**F2. `max` has no value (item 8). Ask.** `type_length` is an integer and `(max)` is stored as null today
(`column-lines.ts`, `parameters`), so `nvarchar(max)` and `nvarchar` look the same, `formatColumnType` loses `(max)`,
and `checkColumnType` lets `nvarchar(max)` into `string(100)`. A re-import cannot report "length 50 → max". *Proposal:*
`type_length = -1` means max (SQL Server's own catalog value), with a CHECK `type_length = -1 or type_length >= 1`;
`formatColumnType` prints `(max)`; `checkColumnType` treats -1 as longer than any length. Existing rows typed as
`(max)` by hand stay null (the information is gone). Alternative: a boolean column.

**F3. Two type readers disagree (items 8, 29). Ask.** The prototype's `parseTypeStr` drops the argument of
`timestamp`, `datetime2`, `time`, `datetimeoffset` and puts other single numbers into length; the app keeps them as
precision. A table entered by hand and then imported would show false "type" changes. *Proposal:* one reader in the
domain for both paths (extend `parameters` in `column-lines.ts`, and keep base types lower case), compare types by
`formatColumnType`. I recommend keeping fractional seconds as precision (the app's way): `datetime2(3)` → `datetime2(7)`
is a real change, and nothing is lost. Item 8 then reads "is fractional seconds, stored as precision".

**F4. The type table misses the catalog queries' names. Ask.** `PHYSICAL_CLASSES` (`type-check.ts`) has no `varchar2`,
`nvarchar2`, `binary_double`, `binary_float`, `timestamp with time zone`, `timestamp without time zone`, and treats
`number(10,0)` as decimal. The Oracle query returns these; without them every Oracle mapping to a string or integer
attribute would be a type conflict and approved mappings would go back to review on the first re-import. The new
prototype extends its `logicalOf` the same way (diff below). *Proposal:* extend D-01's table in step 2 (Łukasz's table
from slice 1a): the names above to their classes, `number(p,0)` and `number(p)` to integer.

**F5. Undo of an approval breaks with `review_reason`.** `undo.ts`: `statusOnly()` counts an update as a reviewer's
status change only when it changes `status`, `approved_by`, `approved_at` (`STATUS_COLUMNS`); `actionFor` otherwise
asks for `model.edit`. If approving clears `review_reason`, a reviewer can no longer undo their own approval.
*Proposal:* add `review_reason` to `STATUS_COLUMNS`.

**F6. When `review_reason` is cleared (item 5). Ask.** The PRD clears it on approval only. A mapping in review can be
set to draft, or edited (D-51 changes nothing for a mapping already in review), and the reason would stay, now stale.
*Proposal:* the import sets it only when it moves an approved mapping to review; `setMappingStatus` clears it on any
status change; a content change (`afterContentChange`'s callers) clears it too.

**F7. Four-eyes after an import (P6, AD-06). Ask.** Who may approve again depends on `lastContentEditor`
(`mapping-rules.ts`), which counts only input, kind and rule changes. A rule the import rewrites makes the importer the
content author, so with four-eyes on the importer cannot approve it. A send-back for a type conflict or a business key
change writes only status columns: the author stays the mapping's earlier author, and the importer can approve it at
once, although the import caused the review. *Proposal:* an import's send-back counts as a content change for four-eyes
(`isContentChange` also true for a mapping event that moves approved → review with a `review_reason`), so the person
who imported never approves the consequences of their own import.

**F8. P9 needs a switch in the write pipeline.** `runCommand` → `completeLiveWrites` → `contextTargets`
(`src/domain/model/live.ts:238`) adds every written mapping (`case "mapping"`), so the mappings an import sends to
review would be labeled by the context. `mainTargets` can only add. *Proposal:* a `WriteSet` field that says "label
nothing" (for example `contextTargets: []`); the events still carry `context_label_id`, as for a layout change (D-26:
recorded on every event of the group, labeled only for model changes).

**F9. Live canvases are touched (no change needed).** New tables and columns are inserts, so `touchesLiveCanvases`
(`src/domain/commands/live.ts:189`) is true and the server loads the live state and syncs live canvases in the same
group: a labeled table's card on a live canvas gains its new rows. Part of the apply figure.

**F10. The local adapter grows quadratic and the file grows large (section 6).** `applyToFile` (`store.ts`)
`structuredClone`s the whole data file, `applyWrite` searches the table with `rows.some`/`findIndex` for every write
(20,000 inserts × 20,000+ rows), `findViolation` scans every table, and the whole file is written. Each large import
adds ~20,000 change events with images, its undo as many with two images: after a few imports `dev-db.json` is tens of
MB, and every later write (a card move) and every page load after it parses and writes all of it. *Proposal:* index rows
by key per touched table inside `applyToFile` (behaviour unchanged); add a figure "move a card after three large
imports" with a bar (≤ 500 ms proposed); if it misses, discuss keeping change events in a file of their own (AD-29
territory, Łukasz decides).

**F11. Undo's check is quadratic.** `consistent()` (`undo.ts`) loops, for each touched row that stops being live,
over all rows of every child table (`PARENTS`): 20,000 columns × the mapping inputs, label links, requirement links and
relationship columns; 2,000 tables × all columns and cards. *Proposal:* build a child index (parent table, column, id →
live children) once per revert. Same results, measured in step 4.

**F12. Places the new tables must be registered (items 1–6).** Not in the PRD: `WritableRows` (`src/domain/types.ts`);
`UNDOABLE_TABLES` and `PARENTS` in `undo.ts` (`source_relationship` → `source_table` at both ends,
`source_relationship_column` → relationship and both columns, `source_import` → `source_system`); `DevDb`, the rules and
`DEV_DB_FORMAT` 5 → 6 with `readDb`'s upgrade (`src/data/local/schema.ts`, `file.ts`); the loaders (`model.load`,
`loadForUndo` in `store.ts`, `ports.ts`); `change-label.ts` (an import's undo label: "Import into CRM", not "Create
source table"); `model-index.ts` for the panels. And **`deleteSourceTable` must take the table's relationships in both
directions** with it (D-47: listed in the confirmation), or the delete leaves relationships to a deleted table.

**F13. `source_relationship_column` needs the standard columns (item 3).** The PRD lists four columns. Soft delete,
versions and `workspace_id` on every model table (AD-10, AD-12) need `id`, `workspace_id`, `version`, `created_*`,
`updated_*`, `deleted_at`, as `mapping_input` has. A changed relationship replaces its pairs (soft delete and insert).

**F14. `source_import` duplicates columns (item 4).** `imported_by` and `imported_at` repeat `created_by` and
`created_at`. *Proposal:* drop them and read the standard columns. Undo soft-deletes the import row, so the imports list
reads live rows only; redo brings it back. Counts: `columns_missing` includes the columns of a missing table (as the
prototype's `counts.missing`).

**F15. P8's check (Q4).** Proposal: the plan digest above instead of a fingerprint of states.

**F16. The text does not fit a server action (Q2).** Proposal: the route handler above. The browser sends the text,
the channel's options (DDL database and schema), the target, the scope, the compare choice, the rename choices and the
plan digest.

**F17. The size limit and the bars measure different things (item 12, section 6). Ask.** The limit allows 100,000
column rows and 20 MB; the bars are measured at 20,000. *Proposal:* measure at 20,000 and at 100,000; set the limit to
the largest size that meets the bars.

**F18. The review at size (item 24, section 6).** 20,000 rows in one dialog will not switch filters in 200 ms.
*Proposal:* in step 5, measure first; if it misses, table cards of more than 50 columns start folded ("Show {n}
columns") and only open cards render rows. No new behaviour beyond folding; Łukasz decides if it is needed.

**F19. Who owns a column's comment (P1). Ask.** The app lets a modeller edit a column's comment
(`SourceColumnPanel`'s "Comment" field → `updateSourceColumn`, `source-panels.tsx`). P1 gives the comment to the source,
so a re-import overwrites what the modeller typed. The new prototype shows it read-only ("From the source: …") and gives
the modeller a separate note (7c). *Proposal:* in 7a the comment becomes read-only, shown as "From the source:
{comment}", and `updateSourceColumn` loses `comment`; the modeller's own note comes with 7c. Alternative: keep it
editable until 7c and let the review show the overwrite.

**F20. Coverage and missing columns. Ask.** The new prototype no longer counts an approved mapping from a missing
column as covering a requirement (`reqCoverage`, its line 4051). The app counts an approved mapping whose type check
passes (`countsForCoverage`, `src/domain/model/requirements.ts:319`). The PRD does not mention it.
*Proposal:* in 7a, an approved mapping with any missing input does not count (one condition; coverage colours, the
status bar and the project home follow); or leave it to 7b.

**F21. The new prototype's seed differs. Ask.** It gives Customer.email length 120, first_name and last_name 50,
segment_code 3, and seeds two declared relationships (`FK_order_line_order_header`, `FK_customer_addresses_customers`).
The app's seed has no attribute lengths and no `segment_code`. Without email's length, the CRM test file's email change
causes no conflict. *Proposal:* add the lengths to email, first_name and last_name and the two relationships to the demo
seed (step 6), and check the specs that read those types.

**F22. Case-insensitive matching on case-sensitive keys (item 29).** The unique indexes and `createSourceTable`'s check
are case-sensitive, so a system can hold `Customers` and `customers`; matching ignoring case would be ambiguous. A
case-only change (`Email` → `email`) is matched, its name written, and the prototype does not show it (`diffCols` has no
name). *Proposal:* an ambiguous system stops the plan with "{system} has two tables named {name} that differ only in
case." (or columns); a case-only change is "changed: name Email → email".

**F23. Position changes are written but not shown (item 2). Ask.** `diffCols` does not compare `ordinal`, but
`applyPlan` writes it. One column inserted at position 2 rewrites every later column with a change event while the review
calls them unchanged. *Proposal:* written (D-36, physical order), shown in "Show {n} unchanged columns" as "position
{a} → {b}", not counted as changed; or counted as a change. The principle "nothing changes silently" argues for showing
it somewhere.

**F24. No slice names in the app's texts (P11, item 11).** "slice 7c brings the full list" is our planning, not words
for the user. *Proposal:* "Classification “{name}” is not read yet: only Business key and PII are read for now."

**F25. Where the sample files live (P10, item 41).** Step 2's unit tests in `src/domain` need the same samples as the
e2e specs, and `e2e/slice-XX/fixtures.ts` already means Playwright fixtures. *Proposal:* `src/domain/import/samples/`
(next to `src/domain/__fixtures__`), read by the unit tests and by `e2e/slice-07a/`.

**F26. The system's selection (item 39).** See Q8: `{ t: "element", kind: "source_system", id }`.

**F27. "New source table" and its texts (item 20, Q10). Ask.** The new prototype's Sources tab has only "Import
sources…"; the app's "New source table" (slice 1a) is not in either prototype. *Proposal:* keep it, below "Import
sources…", with its hint changed to "Describe a table by hand, or import a whole system with “Import sources…”."; the
empty workspace reads "Next steps: import sources, create concepts and entities, then set up projects and canvases."

**F28. The PRD's test plan.** The header refers to "CLAUDE.md, Tests per step", which does not exist (the rules are
under "Testing (AD-21)"), and says a full e2e run follows each step while steps 2 and 3 say CI. *Proposal:* steps 2 and 3
are domain only and not wired to a page: CI only. Full e2e runs after steps 4, 5 and 6, two in a row at closing (about
46 minutes each, slice 6b).

**F29. The mapping line of a missing input (item 34).** A mapping line is one `<g data-testid="line-mapping">` with
one `path.s` per input (`MappingLine`, `src/canvas/LineLayer.tsx`). For a combined mapping only one segment may come from
a missing column. *Proposal:* the class goes on that input's segment (an existing element); the `<g>` gets it only when
every input is missing. Bundles at collapsed frames and the block rows of collapsed frames do not change.

**F30. DDL and catalog give different key names (item 30).** The DDL translator names unnamed keys
`FK_{table}_{columns}`; a catalog query returns the database's names (system-generated on SQL Server). Re-importing a
system through the other channel marks its relationships missing and adds them again. *Proposal:* a line in
`known-limitations.md`.

**F31. Undo and server restarts (P7).** The undo history lives in memory (known limitation): an import cannot be undone
after a server restart, and a change to any imported row afterwards refuses the whole undo (Q3). *Proposal:* say both in
the PRD's P7 and in `known-limitations.md`.

**F32. The PRD is right on these (checked):** permissions (item 40 matches `model.edit`, which is owners, admins,
modelers, and is refused in an archived workspace: `src/domain/permissions.ts`); the D-51 reuse (Q6); the undo toast
(`useAction`'s `run(…, { undoable: true })`); AD-24's classes (rows and lines are existing elements); the mass warning's
threshold (`massWarn`: more than half of the present columns); scope rules (P4, `buildPlan`); the prototype's
`decisions` map keyed by `table|column`, which keeps rename choices across a refresh (P8).

## Differences between the old and the new prototype outside the importer

The new file is the old one plus the `IMP` module (lines 5272–7176) and its CSS (lines 799–1025), with these changes in
the main prototype:

| Where (new file) | Change | Slice |
| --- | --- | --- |
| `<title>` | "Model workspace with sources (prototype)" | none |
| top bar | a "Changes" toggle (`#tChg`) | 7b |
| two `<dialog>`s | the wizard (`#wiz`) and the classification list (`#setDlg`) | 7a, 7c |
| `seed()` | attribute lengths (Customer.email 120, first_name 50, last_name 50, segment_code 3); two seeded source relationships | 7a (F21) |
| load | builds `S.systems` from the tables' system names; `S.issues`, `imports`, `srcRelations`, `classes` | 7a–7c |
| selection check | `system` is a selection | 7a (Q8) |
| `logicalOf` | more physical names (Oracle, PostgreSQL long names); `number(p,0)` integer | 7a (F4) |
| `typeIssue` | one check for canvas, panel and importer; string length checked, `max` unbounded; a `short` text | 7a (F2) |
| attribute row | `im-chg` when a mapping is in review with a reason; `IMP.hit` marks | 7b |
| column row | `im-gone` with title "Missing from source" (7a); `im-old` retired, `im-chg`/`im-new` (7b) | 7a, 7b |
| entity and table cards | `IMP.hit` (the Changes view) | 7b |
| mapping lines | `gone` when the column is missing (7a); `IMP.hit` (7b) | 7a, 7b |
| Sources tab | `IMP.sourcesTree`: "Import sources…", open button, `im-gone`, dot, file/view meta; a "Reset the prototype's demo data" link (prototype only) | 7a |
| attribute panel | a "Length" field for String attributes | none: the app has type parameters (AD-27) |
| column panel | `IMP.colSections`: missing tag, comment "From the source:", classifications, note | 7a (F19), 7c |
| table panel | `IMP.sourceHead`/`sourceBody`: kind line, comment, missing tag, relationships, classifications, note, Data Vault reading | 7a, 7c |
| inspector | the system panel (`IMP.insSystem`) | 7a |
| status bar | "Source changes to resolve {n}" | 7b |
| project home | `IMP.consistencyHtml` | 7b |
| requirement coverage | an approved mapping from a missing column does not cover | 7a or 7b (F20) |

Nothing else in the main prototype changed (2,231 diff lines, all inside these hunks or the new module).

## Docs plan (PRD section 10)

| Doc | What | When |
| --- | --- | --- |
| `docs/prototype/` | the new reference (done) | step 1 |
| `CLAUDE.md` | the new reference (done); the step 1 rule below after approval; at closing: slice state, import in the commands (`bench-import`), the samples' place, the route handler | step 1, 7 |
| `docs/decisions.md` | new D-entry "Source import" (P1–P5, P7–P10 as amended here); D-51 extended with P6, F6, F7; D-26 with P9; D-01's type table with F2–F4. Quoted text for approval first | step 4 |
| `docs/data-model-v2.md` | section 5: new columns, `source_relationship`, `source_relationship_column`, `source_import`; section 6: `review_reason`; the standard v1 as the import format (D-13); `type_length = -1` if F2 is accepted | step 4 |
| `docs/inventory-prototype-vs-app.md` | rewritten against the new file; "Sources" lists what 7b and 7c still miss | step 7 |
| `docs/ideas.md` | "Approve again all {n}" for 7b (done in step 1); own headers in the standard; dbt, Snowflake, Databricks; relationships as grey lines on the canvas | step 1, 7 |
| `docs/known-limitations.md` | the size limit; no changes to resolve in 7a; F30 (key names); F31 (undo) | step 7 |
| `README.md` | the import in the model section; the bench script | step 7 |

## Plan for section 6's figures

All synthetic, generated by a script (`scripts/lib/import-synthetic.ts`, deterministic seed), never stored in the
seed (item 42: `seed:large` only gains the generator's entry point if Łukasz wants the files on disk). The domain and
adapter figures run in Node with `npx tsx scripts/bench-import.ts` (like `bench-requirement-index.ts`): one warm-up,
then 5 rounds, median, fastest, slowest. The adapter and undo figures run on a copy of the data file in `.data/measure/`,
never on `dev-db.json`.

| Figure | Where | Step | Machine time |
| --- | --- | --- | --- |
| read 20,000 and 100,000 column rows (F17) | Node, domain | 2 | 2 min |
| translate a 2,000-table DDL script | Node, domain | 2 | 2 min |
| plan a re-import, 5 % changed, renamed, missing | Node, domain | 3 | 3 min |
| apply through the local adapter with change events, live writes | Node, adapter on a copy | 4 | 10 min |
| undo that import | Node, adapter on a copy | 4 | 10 min |
| a card move after three large imports (F10) | Node, adapter on a copy | 4 | 5 min |
| switching filters in the review | browser, measurement build, to the screen (slice 4b-1's method, traced, `MEASURE=1`) | 5 | 15 min plus a 5 min build |
| element counts on "Performance test" against `slice-06b`'s (`S3B-15-elements.spec.ts`) | measurement build | 6 | 10 min |

About 1 hour of machine time, 3–4 hours with the generator, the scripts and the write-up, spread over steps 2–6. A
miss stops the step with the figures. The bars stay the PRD's proposals plus F10's 500 ms; the 100,000-row figures
decide the size limit.

## Proposal for CLAUDE.md ("How we work")

To add as a new bullet after "Work in the steps the PRD lists…", exactly:

> - **Step 1 checks the PRD against the code.** A PRD is a proposal to verify, not a specification: it may be written
>   from the prototype and the docs without reading the code. In step 1, check every item, decision and acceptance
>   criterion against the code, `docs/decisions.md` and the earlier slices' acceptance docs, and write into
>   `docs/prd/slice-XX-acceptance.md` where the PRD is wrong, contradicts the code or a decision, duplicates what the app
>   already has, misses what the code needs, or costs more than it assumes (data model, undo, change events,
>   performance), each with the files and functions behind it and a proposal. List the differences between the
>   reference prototype and the app that the slice touches. No application code in step 1; Łukasz answers before step 2.

## Questions for Łukasz

1. **The tag:** `main` is PR #18 past `slice-06b`; fine to branch from `main` as done?
2. **Old references:** leave closed slices' PRDs, the inventory and the spike's comment pointing at the old file?
3. **`max` (F2):** `type_length = -1`, or a boolean column?
4. **Fractional seconds (F3):** keep them as precision (one reader for both paths)?
5. **Type table (F4):** add the Oracle and PostgreSQL names and `number(p,0)` as integer to D-01's table?
6. **`review_reason` (F6):** set only on approved → review, cleared on any status or content change?
7. **Four-eyes (F7):** an import's send-back makes the importer the content author?
8. **Column comment (F19):** read-only "From the source:" in 7a, or editable until 7c?
9. **Coverage (F20):** an approved mapping with a missing input stops covering in 7a, or in 7b?
10. **Seed (F21):** add the attribute lengths and the two relationships to the demo seed?
11. **Positions (F23):** written and shown under unchanged, or counted as a change?
12. **The route handler and the plan digest (F15, F16):** agreed?
13. **Size (F17):** measure at 20,000 and 100,000, then set the limit?
14. **"New source table" (F27):** keep it, with the texts proposed?
15. **Samples' place (F25):** `src/domain/import/samples/`?
16. **Tests per step (F28):** steps 2–3 CI only; full e2e after 4, 5, 6 and two at closing?
17. **F10's extra figure:** a card move after three large imports, bar 500 ms?
18. **The CLAUDE.md rule:** approve the text above?

## Łukasz's answers to the open points (22 October 2026)

All six as proposed: rows that lost `max` show the real change on their next import; the new type problem in the demo
(`web_users.email` → Customer.email `string(120)`) is intended, a draft that P6 does not touch, checked in step 6; the
D-entry text for answer 8 and P1; S7A-16's vendor files; the lint rule for the samples. **Tests after step 2:** CI plus
the e2e specs of what the step changes (the small-slice rule), at least "New source table" (S1A-13), the type check and
its warning chips, the status bar's type-problem count and D-51's specs; a failing spec three times on its own. Steps
4, 5 and 6 keep their full e2e runs.

## Step 2: readers in the domain (22 October 2026)

### What changed

- **One type reader** (`readColumnType`, `src/domain/model/column-type.ts`), used by "New source table"
  (`parseColumnLines`) and the import. `max` and -1 are stored as `MAX_LENGTH` (-1) and shown as `max` everywhere
  (`formatColumnType`); fractional seconds stay precision (`datetime2(7)`); Oracle's length units are dropped
  (`varchar2(100 char)`); `timestamp(6) with time zone` keeps its parameter and is shown that way. The same type written
  differently reads the same (`VARCHAR (20)` and `varchar(20)`).
- **The type table** (`src/domain/model/type-check.ts`, D-01): `varchar2`, `nvarchar2`, `long` (text); `binary_double`,
  `binary_float` (decimal); the timestamp and time names with and without time zone (temporal); `number(p,0)` and
  `number(p)` are integers (`columnClass`); `max` is longer than any string length; a new attribute from a `max`
  column is a string without length. `TYPE_ALIASES` is the one table of spellings for step 3's comparison.
- **The standard reader** (`readStandard`, `src/domain/import/standard.ts`, items 7–13) and delimited text
  (`src/domain/import/delimited.ts`), `STANDARD_TEMPLATE` (`template.csv`), `MAX_IMPORT_ROWS` (100,000 until the
  figures of steps 3–4 set it).
- **The DDL translator** (`ddlToStandard`, `readDdl`, `skippedText`, `ddlSummaryText`, `src/domain/import/ddl.ts`,
  items 16–18), a port of the prototype that keeps type parameters (answer 4).
- **Samples** in `src/domain/import/samples/` (README there): the prototype's three standard samples and three DDL
  samples, written from the prototype's own code; three catalog-query results for S7A-16 (SQL Server as SSMS copies it,
  PostgreSQL as psql writes it, Oracle as SQL Developer exports it). `.gitattributes` keeps their bytes (the SQL Server
  file's CRLF).
- **Lint** (`eslint.config.mjs`): outside `*.test.ts` nothing in `src/` may import or name `import/samples` (checked
  with a probe file: an import, a string and a template literal are refused); domain tests may read files from disk;
  the rest of the domain still may not.
- **Earlier spec changed:** `S1A-13` now expects `nvarchar(max)` on the card and `type_length` -1 in the data.

### Decisions I took (please check)

1. **P11's text names the table:** "Classification “{name}” on {schema}.{table} is not read yet: only Business key and
   PII are read for now." Without the table, the same line listed once per table reads as a duplicate. No slice name
   (F24).
2. **"Personal data" counts as PII** besides the code `PII`: the column panel calls the flag "Personal data".
3. **A type the reader cannot read** (`integer[]`, PostgreSQL arrays) is kept as written, without parameters, as the
   prototype does; no warning (none in the PRD).
4. **Several missing headers** read "The file has no “database”, “schema” columns." (plural); one reads as item 9.
5. **Warnings name the file's line**, also after blank lines and line breaks inside quotes (the prototype counted rows).
6. **The DDL channel keeps the prototype's spellings** (`integer` → `int`, `timestamp with time zone` →
   `timestamptz`); the catalog queries return their own. Step 3 compares both sides through `TYPE_ALIASES`, so a
   spelling never shows as a change.

### How to check

```
npx vitest run src/domain/import src/domain/model
npx tsx scripts/bench-import-read.ts
```

### Runs

- `npm run lint`, `npm run typecheck`: pass. `npm test`: **84 files, 1,111 tests pass** (51 new in `src/domain/import`,
  the rest of the new ones in `column-type.test.ts`, `column-lines.test.ts`, `type-check.test.ts`).
- e2e, the specs of what step 2 changes: **10 passed, 1.9 min**, none failed.

| Spec | Why |
| --- | --- |
| S1A-13 | "New source table" now reads types through `readColumnType` (`max`) |
| S1A-09 | the type check, its warning chip and the status bar's type-problem count |
| S1A-01 | the cards' column types and the type-problem marks on the lines |
| S2B-07 | the frame chips' type-problem count |
| S1B-03 (3 tests) | a new attribute from a column (`logicalTypeOf`) |
| S1A-08, S1A-12 | D-51: a content change sends an approved mapping back to review; four-eyes |
| S1A-11 | the reviewer: no "New source table", the server refuses `createSourceTable` |

The seeds' types read the same as before (no `(max)`; `seed:large`'s types are `VARCHAR(50)`, `DECIMAL(18,2)` and
others the old reader read the same way), so no seeded row changes.

### Timings (Node, `scripts/bench-import-read.ts`, median of 5 after a warm-up)

| Case | Size | Median (fastest–slowest) | Bar |
| --- | --- | --- | --- |
| Read the standard, 20,000 columns (2,000 tables) | 1.5 MB | 113 ms (94–128) | ≤ 1 s, met |
| Translate and read a 2,000-table DDL script | 1.7 MB | 385 ms (344–499) | ≤ 2 s, met |
| Read the standard, 100,000 columns (10,000 tables) | 7.7 MB | 539 ms (526–593) | ≤ 1 s, met |
| Translate and read a 10,000-table DDL script | 8.3 MB | 1,772 ms (1,637–2,350) | ≤ 2 s, met, close |

At 100,000 rows the standard is 7.7 MB, so the row limit, not the 20 MB, binds for files of this shape. The limit is
proposed after steps 3 and 4 measure plan, apply and undo at both sizes (answer 13).

## Łukasz's answers to step 2 (22 October 2026)

Step 2 accepted. Decisions 1, 2, 4, 5 and 6 as taken. **Decision 3 changed:** a type the reader cannot parse is kept as
written **with a warning** in the review ("Type “integer[]” of loyalty.points_txn.tags is kept as written; the type
check cannot judge mappings from this column."): nothing the importer cannot judge may pass silently. **Decision 6:** a
new criterion: a system imported from a DDL script and then from the matching catalog-query result shows no changes and
sends no mapping to review. The DDL figure at 100,000 columns (1,772 ms) is fine for now; the limit is proposed after
steps 3 and 4. "The destination stream closed early" is watched in step 4's full runs.

## Step 3: the engine in the domain (22 October 2026)

### What changed

- **The reader's warning** for a type it cannot parse (`TYPE_KEPT`, decision 3); the DDL sample's `text[]` now has it.
- **`src/domain/import/plan.ts`**, `buildPlan(model, read, target, choices)`: the plan of items 22–32, pure. Statuses
  (new, changed, unchanged, missing, still missing, back, rename) for tables, columns and relationships; table meta and
  row counts; positions among the unchanged columns (answer 11); a comment overwrite as a change (answer 8); P2 (only
  the file's fields are compared); the scope rule (P4: "schemas" or "tables"); rename suggestions, choices and options
  (P5: a new column paired once); the file's classifications when they differ (item 11, kept); relationships with the
  unresolved-key warning (item 30) and those of a missing table (item 32); the mass warning (item 23); `planCounts`
  and `importSummary` (item 28).
- **P6 per input** (`planMappings`): for each mapping reading a column whose type or name changes, the type check runs
  on every input before and after. Reasons: "type conflict, {column} into {attribute}" (only where an input did not
  have the problem; a transform with a rule never has one, so only direct mappings, F1), "business key column changed
  type, {before} → {after}", "its rule now reads {rule}" (whole words, ignoring case, one pass). An approved mapping
  with a reason goes back to review; a draft or review mapping keeps its status and gets no reason (answer 6); its rule
  is still rewritten. "Fits again" and the conflicts after the import are in the impact, for item 25.
- **`src/domain/import/apply.ts`**, `applyPlan`: the changeset (new rows, and patches with the version read). Nothing is
  deleted; missing sets `missing_since`, back clears it; unchanged rows get no patch; a sent-back mapping gets
  `status: review`, no approval and its `review_reason`. Step 4 turns it into writes and change events.
- **`src/domain/import/compare.ts`**: `planDigest` (statuses, changes, renames, mapping impacts, warnings, and the id
  and version of every row the plan reads), `samePlan` (P8: an edit elsewhere does not refuse the import, one that
  changes what it does does), `keptChoices` (scope and compare kept, rename choices kept where still offered),
  `STALE_REVIEW` (P8's text).
- **`columnTypeKey`, `sameColumnType`** (`column-type.ts`): types compared through `TYPE_ALIASES`, so `integer` and
  `int`, `timestamp with time zone` and `timestamptz` are one type.
- **Samples:** `billing_sqlserver_catalog.tsv` (the SQL Server query's result for `billing.sql`'s database);
  `hr_oracle_catalog.csv` now matches `hrleg_ddl.sql` exactly (the scale-only `NUMBER` and `CLOB` checks moved inline).
- **Test fixtures:** `src/domain/__fixtures__/import.ts` (`importInto`, `materialize`, `withMapping`…).
- **Coverage (answer 9) is not in this step.** It needs `missing_since` on stored columns, which the data model gets in
  step 4. Step 4 changes `countsForCoverage` and runs the coverage specs it touches, so step 3 is CI only.

### Tests (unit)

`plan.test.ts` and `compare.test.ts`, 46 tests:

- a first import (S7A-04);
- every sample and vendor file imported twice shows no changes and writes nothing (S7A-16); the same type spelled
  another way is no change;
- the CRM re-import with every column status, positions, meta, the file's classifications and the exact patches
  (S7A-05); P2; a comment overwrite; a case-only rename;
- missing, still missing and back for tables, columns and relationships;
- scope and the mass warning (S7A-06);
- renames, "removed", one column paired once, a rename that keeps a relationship (S7A-07);
- P6: a direct mapping's type conflict, a business key change, a combined mapping's business key change and renamed
  input with no type conflict, a draft keeping its status, "fits again", a missing input (S7A-08);
- relationships; `rewriteRule`; P8.

**DDL then catalog (decision 6):**

- **Oracle** (`hrleg_ddl.sql`, then `hr_oracle_catalog.csv`): no changes, no mapping to review; the catalog's row counts
  are written, not counted.
- **SQL Server** (`billing.sql`, then `billing_sqlserver_catalog.tsv`): two differences remain, both real: the computed
  column `full_ref` ("type: computed → varchar(24)": the script does not give its type) and the view `v_open_invoices`
  (new: the script skips views with a warning). No mapping to review. See question 2.

### Decisions I took (please check)

1. **F22 as proposed in step 1:** a name that changes only in case is "changed: name Email → email"; a system with two
   tables (or a table with two columns) that differ only in case stops the plan: "{system} has two tables that differ
   only in case: {a} and {b}."
2. **New texts:** "Name the new system." (an empty name), "That source system no longer exists." (a system deleted
   meanwhile), and for a key that names a column the tables do not have: "Foreign key {name} on {table} names a column
   that is not in {table}. Relationship skipped."
3. **A key without target columns** points at the target's primary key in the standard too, as in the DDL channel.
4. **A column that comes back** counts as a changed column in the summary (the prototype's count).
5. **Requirement keys and canvases in item 25's impact** are not in the plan: the review takes them from the page's
   data in step 5; they do not change what the import does.

### Questions

1. **The SQL Server catalog query returns no fractional seconds** (it gives `precision` only for decimal and numeric),
   while an SSMS script writes `[datetime2](7)`. A system imported from a script and re-imported from the query would
   show "type: datetime2(7) → datetime2" for every such column: a difference that is not real. The prototype's queries
   are the source. Proposal: the SQL Server query also gives `c.scale` as `precision` for `datetime2`,
   `datetimeoffset` and `time`; the PostgreSQL query gives the precision of `timestamp`, `timestamptz` and `time` from
   `atttypmod`. Oracle's `data_type` already carries it. May I change the queries this way when the wizard takes them
   in step 5?
2. **The new criterion's wording** (decision 6), as S7A-17: "A system imported from a DDL script and re-imported from
   the matching catalog-query result shows no changes apart from what a script cannot give (the type of a computed
   column, views), and sends no mapping to review." Agreed?

### How to check

```
npx vitest run src/domain/import
npx tsx scripts/bench-import-plan.ts
```

### Runs

`npm run lint`, `npm run typecheck`: pass. `npm test`: **86 files, 1,157 tests pass**. No e2e: the step changes no page
(coverage moved to step 4).

### Timings (Node, `scripts/bench-import-plan.ts`, median of 5 after a warm-up)

A re-import against a system that holds the file, 5 % of the columns changed (2 %), renamed (1.5 %) or missing (1.5 %),
a direct approved mapping on every tenth column.

| Case | 20,000 columns, 2,000 mappings | 100,000 columns, 10,000 mappings | Bar |
| --- | --- | --- | --- |
| Plan the re-import | 107 ms (84–119) | 442 ms (425–480) | ≤ 2 s, met |
| Apply (the changeset, no writes) | 27 ms | 135 ms | none (step 4 measures the writes) |
| P8's digest | 25 ms | 145 ms | none |

The plans: 400 changed, 300 renamed (all by suggestion), 300 missing and 15 mappings back to review at 20,000 columns;
2,000, 1,500, 1,500 and 110 at 100,000.

## Łukasz's answers to step 3 (22 October 2026)

Step 3 accepted. **Decision 1 changed:** a name that changes only in case is a name change in the review; names that
differ only in case within one system (two tables) or one table (two columns) do not stop the import: the affected
table is left out of scope (it cannot be selected), the scope step and the warnings say why, and the rest is imported;
two columns in conflict take out only their own table. Decisions 2–5 as taken. **Questions:** fractional seconds go
into the SQL Server and PostgreSQL catalog queries in step 5; S7A-17 as worded: "A system imported from a DDL script and
re-imported from the matching catalog-query result shows no changes apart from what a script cannot give (the type of a
computed column, views), and sends no mapping to review."

## Step 4: data and the command (22 October 2026)

### What changed

- **Case conflicts** (`plan.ts`, answer 1): `plan.leftOut` lists the file's tables that cannot be selected, each with its
  reason (also in the warnings); they are never compared, never marked missing, and keys to them are skipped with a
  warning. Texts: "{system} has two tables whose names differ only in case, {a} and {b}, so the file's table cannot be
  matched to one of them. It is left out of this import; rename or delete one of the two first." and "{table} in
  {system} has two columns whose names differ only in case, {a} and {b}. The table is left out of this import; rename or
  delete one of the two first."
- **Migration** `supabase/migrations/20261022220000_source_import.sql` (items 1–5): `object_type` allows `file`;
  `file_format`, `missing_since` on `source_table`; `missing_since` and `type_length` -1 (max) on `source_column`;
  `mapping.review_reason`, only while in review (CHECK); `source_relationship` (name unique per from-table in any case),
  `source_relationship_column` (standard columns, F13), `source_import` (who and when are `created_by`/`created_at`,
  F14; counts with a CHECK); RLS on the three new tables. `npm run schema:check` passes on a throwaway Postgres
  (18.3 here, initialised UTF-8; CI uses 17): "The schema matches the domain: 29 tables, 382 columns".
- **`docs/data-model-v2.md`**: the new columns and tables, -1 as max, who owns what on a column (P1, P2), the
  import standard as the import format (D-13), the new domain rules.
- **Domain types** (`src/domain/types.ts`): the new columns and tables, `WritableRows`, `WorkspaceModel` (relationships
  and their columns); every row builder (seeds, fixtures, commands) fills the new columns.
- **Local adapter** (`src/data/local/`): the three tables with their keys, foreign keys, unique name and CHECKs;
  `DEV_DB_FORMAT` 6, a format-5 file is read as 6 (new tables empty, new columns null; unit test);
  `model.load` returns the relationships; `model.listImports` (newest first).
- **Undo** (`undo.ts`): the new tables and their parents; `review_reason` counts as a status column, so a reviewer can
  undo their own approval (F5); a column added after a step was recorded compares as null.
- **Speed** (F10, F11): the adapter finds rows by an index instead of searching each table per write; it keeps its own
  write in the cache instead of parsing the file again; it copies only the tables a write touches; the integrity check
  covers only what a write can break (the touched tables, the new change events); the file is written without
  indentation; undo's consistency check builds its child index once per revert.
- **Deleting a source table** takes its relationships in both directions along (`deleteSourceTable`); the
  confirmation lists them ("6 columns, 1 relationship", D-47).
- **The command** `src/domain/commands/import.ts`, `importSources`: owners, admins, modelers, not archived (AD-05,
  AD-09); reads the text again with the domain's readers; builds the plan from the review's choices; writes only when
  `planFingerprint` (two 53-bit hashes of the digest and its length) matches the review's (P8, otherwise P8's text with
  `fields.review`); one change group with an event per row; the import recorded; `labelNothing` (P9: the context labels
  nothing, its events still record it, D-26). The undo history's label is "Import {file}".
- **Answers 6, 7, 9**: any status or content change clears `review_reason`; with four-eyes on, an import's send-back
  makes the person who imported the mapping's last editor (`lastContentEditor`); an approved mapping from a column
  missing from source covers no requirement (`countsForCoverage` and the requirement index).
- **The upload route** `POST /w/{workspace}/import` (`src/app/w/[workspaceId]/import/route.ts`, `src/app/_lib/import-sources.ts`):
  JSON body, refused above 25 MB (413); runs `runCommand` and the command like any write (AD-23). **The proxy**
  (`src/proxy.ts`, every route) buffers request bodies up to 10 MB by default and cuts off the rest:
  `next.config.ts` sets `experimental.proxyClientMaxBodySize: "25mb"`.
- **e2e** `e2e/slice-07a/S7A-04-route.spec.ts`: a new system through the route (one change group of 18 events, the
  import recorded), a reader refused (S7A-12's server part), P8's refusal, a 12 MB body that arrives whole, a 26 MB
  body refused.
- **Earlier tests changed:** the format tests now expect format 6 (`requirement-store.test.ts`,
  `working-layer-store.test.ts`); `compare-schema.test.ts` lists the three tables; the hand-built rows in
  `undo.test.ts` and `frame.test.ts` and seven `WorkspaceModel` fixtures have the new lists.

### Runs

- `npm run lint`, `npm run typecheck`: pass. `npm test`: **87 files, 1,168 tests pass**. `npm run schema:check`: pass.
- The requirement-coverage specs answer 9 touches (S2C-11, S4A-01, S4A-08, S4A-13, S4B1-01, -03, -05, -06, -08,
  S4B2-01, -08, -12): **15 passed, 2.5 min**.
- **The full e2e run** (22 October 2026, 23:00–23:43, `npm run e2e` from scratch, no dev server running): **246 passed,
  0 failed, 43.0 min**. “The destination stream closed early” was printed 35 times, each between two tests (after
  S0-11, S1B-03, S1B-04, S2A-03 and others): the known, accepted message of `docs/known-limitations.md` (a page left while
  it still streams). Slice 4p's three runs printed it 26–28 times with fewer tests; nothing new from slice 7a, and no
  test fails on it.

### Timings (Node, `scripts/bench-import-write.ts`, median of 5 after a warm-up)

Each write runs the server's steps: the state from the store, the command, the live canvas rules, the adapter
(which writes the whole data file), the undo history; on copies of the demo data.

| Case | 20,000 columns | 100,000 columns | Bar |
| --- | --- | --- | --- |
| First import (every row new), with change events | 2,149 ms | 13,120 ms | ≤ 5 s: met / **missed** |
| Re-import, 5 % changed, renamed or missing | 1,085 ms | 7,907 ms | ≤ 5 s: met / **missed** |
| Undo the re-import | 521 ms | 4,034 ms | ≤ 5 s: met / met |
| Undo the first import | 2,502 ms | 16,354 ms | ≤ 5 s: met / **missed** |
| Move a card after three large imports | **1,146 ms** | **out of memory** | ≤ 500 ms: **missed** |

- After a first import and a re-import of 20,000 columns the data file is 44 MB; after three first imports of 20,000
  columns, 128 MB: 80 MB of change events (78,000), 48 MB of rows. Serialising it takes 591 ms alone.
- At 100,000 columns the data file is 221 MB after two imports; the third import of 100,000 columns ran the process
  out of memory (Node's default heap, 2.4 GB). A dev server would stop the same way.
- Before the speed fixes, the card move after three 20,000-column imports took 3,334 ms (166 MB indented).

### The size limit (answer 13): proposal

From all the figures (read, translate, plan, apply, undo): reading, translating and planning meet their bars at
100,000 rows; writing and undoing grow with the rows written, about 0.11 ms (import) and 0.16 ms (undo) per column at
the sizes measured. **Proposal: one import takes up to 30,000 column rows** (expected first import about 3.3 s and its
undo about 4.8 s here), and the text up to 20 MB as now. Above it: "The file has {n} rows; one import takes up to
30,000. Split it by database or schema." A larger system is imported in parts, one database or schema at a time ("Only
columns of the tables in the file", P4). The limit is the local adapter's (development, AD-29); it is looked at again
with the database slice (AD-31).

### Question: a card move after large imports (the extra figure, F10)

The local adapter writes the whole data file on every write, so every write after large imports is slow: 1.1 s per
card move after three 20,000-column imports. Production never has this (Supabase, the last slice). Options:

1. **Accept it for now** (my recommendation for this slice): the local adapter is a development tool until the database
   slice; a line in `docs/known-limitations.md` ("after very large imports every write takes about a second"),
   `npm run reset-dev-data` brings it back. The 30,000-row limit keeps one import's file growth bounded.
2. **Change events in a file of their own**, appended per write (format 7): about 0.3 s less per write by my estimate
   (stringifying the events is 283 ms of 591 ms); still above 500 ms after three 20,000-column imports, since the rows
   alone are 48 MB.
3. **One file per table, change events appended**: a card move would rewrite only the cards and append its events,
   well under 100 ms. A larger change to the adapter (AD-29) and its e2e helpers that read the data file whole
   (`rawDb`, `loadModel` go through the store, a few read the file directly); about a day with a full e2e run. Could
   be its own small slice before 7b.

### Proposed decision texts (for docs/decisions.md, after your approval)

> - **D-55** Source import (slice 7a). A system is described once from a file in InfoMapper's source standard, a
>   catalog query's result or DDL scripts, and re-imported the same way; the review shows everything an import would do
>   before anything is written, and the import is one undo step. The source owns a column's name, position, type,
>   nullable, keys and comment, and a re-import updates them; the comment stays editable, and the review shows every
>   overwrite. The modeller owns the classifications: a re-import never changes them. A field the file leaves out is
>   never compared or overwritten. Missing is a status, not a delete: a table, column or relationship not in the file
>   gets “missing from source” and keeps its mappings, cards and links, and loses it when it comes back. Missing is
>   judged only inside the scope the modeller picks: the imported schemas, or only the columns of the tables in the
>   file; more than half of a system's columns going missing is warned about. Renames are the modeller's choice; the
>   engine suggests one for the same position and type, and a rename keeps the column's identity. The server builds the
>   plan again from the same text and choices and writes only when it does what the review showed; otherwise the review
>   refreshes and says so. The working context labels nothing an import writes. A type the importer cannot read, and a
>   table whose name differs only in case from another, are never passed over silently: the first is kept with a
>   warning, the second left out of the import with its reason. The app has no sample files; one import takes up to
>   30,000 column rows.
>
> - **D-51** (added) … An import sends an approved mapping back to review, with a stored reason, when an input gets a
>   type conflict it did not have, an input marked business key changes type, or a renamed input is named in its rule
>   (the rule is rewritten). The reason is cleared by any change of the mapping's status or content. With four-eyes on,
>   the person who ran the import counts as the mapping's last editor. An approved mapping from a column missing from
>   source covers no requirement.
>
> - **D-26** (added) … An import labels nothing, the mappings it sends back to review included.

### How to check

```
npx vitest run src/domain/commands/import.test.ts src/domain/import src/data
npx playwright test e2e/slice-07a
npx tsx scripts/bench-import-write.ts 20000
```

### Questions

1. **The size limit:** 30,000 column rows per import?
2. **The card move after large imports:** option 1, 2 or 3?
3. **The decision texts** above: approve, or change?
