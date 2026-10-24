# Slice 7a – Acceptance

Status: **step 7 (closing) done but for the two full e2e runs (24 October 2026); merge and tag on Łukasz's command.** Branch
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

## Łukasz's answers to step 4 (23 October 2026)

Step 4 accepted as built: the case conflicts, the migration with the review reason only in review and row-level
security on the three new tables, `data-model-v2.md`, format 6 with its upgrade, undo with the new tables, the delete
cascade, the import command (permissions, P8, one change group, one undo step, P9), answers 6, 7 and 9, the upload
route with its 25 MB limit and the proxy's, the speed fixes. "The destination stream closed early" is the known message;
nothing to change.

- **The slow writes after large imports: option 1, accepted.** Łukasz works incrementally and will not import whole
  databases, so the local data file stays small in practice. In `known-limitations.md`: every write rewrites the whole
  local data file (about 1 s per write after three 20,000-column imports); local adapter only, the Supabase adapter
  writes only the changed rows. Option 3 (one file per table, change events appended) is in `ideas.md`.
- **The size limit: 30,000 column rows per import, a temporary limit.** It comes from the local adapter's figures, not
  from the importer; to be measured again when the Supabase adapter exists (`known-limitations.md`). Item 12's message:
  "The file has {n} rows; one import takes up to 30,000. Split it by database or schema." The 20 MB text limit stays.
- **The decision texts** (D-55, the D-51 and D-26 additions, step 4 above) are reviewed before they go into
  `decisions.md`; step 5 waits for that.

### The limit's figures

| Figure (median of 5) | 20,000 column rows | 100,000 column rows | Bar |
| --- | --- | --- | --- |
| Read the standard | 113 ms | 539 ms | ≤ 1 s |
| Translate and read a DDL script | 385 ms | 1,772 ms | ≤ 2 s |
| Plan a re-import, 5 % changed | 107 ms | 442 ms | ≤ 2 s |
| First import through the local adapter | 2,149 ms | **13,120 ms** | ≤ 5 s |
| Re-import, 5 % changed | 1,085 ms | **7,907 ms** | ≤ 5 s |
| Undo the first import | 2,502 ms | **16,354 ms** | ≤ 5 s |
| Three imports | 128 MB data file | **out of memory** | |

At 30,000 rows the write is expected at about 3.3 s and its undo at about 4.8 s (both grow with the rows written:
about 0.11 and 0.16 ms per column here), within the 5 s bars.

### After the answers (23 October 2026)

- `MAX_IMPORT_ROWS` is 30,000 (`src/domain/import/standard.ts`); the reader takes `{ maxRows }` so the benchmarks
  still read past it (`bench-import-read.ts`, `bench-import-plan.ts`); `bench-import-write.ts` imports through the
  command, so it now measures 20,000 by default.
- **Found by the new limit's test:** one table with tens of thousands of columns made the reader slow (it looked up
  each row's column in the table's list): 30,001 columns in one table took about 20 s. Columns are now found by name
  through a map; the same test takes well under a second. The figures above are unchanged (115, 399, 530 and 1,746 ms
  in a new run).
- Unit tests: 830 domain tests pass; the route spec expects the new message.

## Łukasz's answers on the decision texts (23 October 2026)

Approved with two edits, in `docs/decisions.md` (`786bd61`): D-55's last sentence reads "The app has no sample files;
for now one import takes up to 30,000 column rows (a limit of the local adapter, see known-limitations.md)." **The
coverage sentence went into D-31** ("An approved mapping from a column missing from source covers no requirement"),
which defines when a mapping covers a requirement; D-51 keeps the rest of its addition. **Relationships:** when no
relationship matches by name, it is matched by from-table, to-table and column pairs, and a name-only difference is a
change of name (`ddadf55`; unit test with a generated SQL Server name; `known-limitations.md` updated).

## Step 5: the wizard (23 October 2026)

### What changed

- **"Import sources…"** at the top of the Sources tab (owners, admins, modelers; not archived) opens the wizard
  (`src/app/_panels/import/`: `import-wizard.tsx`, `source-step.tsx`, `scope-step.tsx`, `review-step.tsx`,
  `wizard-model.ts`, `catalog-queries.ts`). The page passes the model and requirement data as the same objects the
  inspector gets (one copy in the payload), plus each system's last import.
- **The dialog** (item 20): "Import sources into {target}", the three steps clickable when reachable, the footer note per
  step, Back or Cancel, Next or "Import into {target}"; Esc and Cancel write nothing.
- **Source** (items 14–19, 21): an existing system (sorted, "{n} tables · last import {date}" or "not imported yet",
  "Find a system" above five) or a new one (a taken name, in any case, blocks Next with item 21's text); the four
  channels, dbt disabled; the file drop zone; the catalog queries for SQL Server, PostgreSQL and Oracle with Copy and
  how-to, Snowflake and Databricks "(later)" disabled, the result pasted ("Read it") or dropped; the DDL script pasted or
  dropped, with Database and "Schema for unqualified names", what was read and skipped, the database and schema used,
  "The translated standard" with Copy; what was read or the reader's error with "Choose another"; the standard's
  description and `template.csv` with Copy. **No sample links** (P10).
- **The catalog queries** come from the prototype's own text (a script), with fractional seconds added (step 3,
  question 1): SQL Server's `precision` is `c.scale` for `datetime2`, `datetimeoffset` and `time`; PostgreSQL's is
  `atttypmod` for `timestamp`, `timestamptz`, `time` and `timetz`.
- **Scope** (items 22–23): tables by database and schema, groups half-checked when partly selected, column counts,
  "{n} new" / "all new to {system}"; tables with case conflicts disabled with their reason; "What is missing from the
  source?"; the missing-tables callout ("Not in the file: … with their mappings kept") or "Every table {system} has in
  the selected schemas is in the file."; the mass warning with its button.
- **Review** (items 24–27): the six filters with counts; the P8 callout; the P6 callout ("{n} approved mapping(s) go(es)
  back to review after this import" with each reason); "The file matches what {system} has…"; a card per table (tag,
  `schema.table`, "{format} file", a new table's comment, "{n} columns" or "rows a → b"); rows with tag, name ("old →
  new" for a rename), what (type, PK/FK, not null, Business key / PII for a new column; "{field}: before → after"; "Back
  in the source after being missing since {date}"; "Was {type}"; "position a → b"; "The file says …; your
  classifications are kept.") and the impact ("Feeds {Entity.attribute} ({status})" with "; the mapping stays, on a
  column that is gone", "; the mapping stays", "; goes back to review: …", "; type conflict: …", "; fits again, the mapping
  can be approved", "; its rule now reads …", the requirement keys as tags, "On {canvases}"; "Not mapped"); the rename
  choice ("What happened to {name}?", the suggestion marked and pre-selected, a paired column not offered twice);
  "Show {n} unchanged columns" with positions; "Relationships between source tables" (a renamed key "old → new"); the
  warnings (reading, DDL, classifications not read, types kept as written, tables left out, keys skipped).
- **Import** (item 28): the upload route; the toast "Imported into {system}: {summary}" with Undo; the page's data
  refreshed. **P8:** the route's refusal carries `fields.review`; the wizard stays on the review, shows P8's text,
  refreshes the page's data and rebuilds the plan; the scope, the compare choice and the rename choices that still apply
  are kept (a choice of a column the file no longer offers falls back to the suggestion, in the plan itself, so the
  server and the browser agree).
- **Texts** (step 1, answer 14): "New source table": "Describe a table by hand, or import a whole system with “Import
  sources…”."; the empty workspace: "This workspace is empty. Next steps: import sources, create concepts and entities,
  then set up projects and canvases."
- **`runCommand`** passes the domain's field messages through (`ActionResult.fields`).

### Decisions I took (please check)

1. **A long review renders in parts:** 100 table cards, 50 rows per card and 200 relationships at first, each with a
   "Show the next …" / "Show … more columns" button (F18). Measured below.
2. **The prototype's "Shown later as a grey line between the table cards on a canvas"** for a new relationship is left
   out: it promises a later feature (as "iteration 2" was, F24). A missing one reads "No longer declared in the source".
3. **After an import the Sources tab stays; the system is not selected yet.** Selecting a system and its panel are
   step 6 (items 38–39); the wizard already takes a pre-selected system for "Re-import {system}…".
4. **P8's refusal shows in the review only**, not also as a toast; a toast shows any other refusal.
5. **"Choose another"** in the DDL channel clears the script and its name and keeps the Database and schema fields (the
   prototype kept the name: a pasted script was then called by the earlier file's name; found by S7A-03).
6. **An attribute's requirement keys** in the impact: requirements linked to the attribute or to a mapping that fills
   it (as its panel's Requirements section lists them).
7. **Status words** in the impact: "draft", "in review", "approved".
8. **Footer on step 1 without a file:** "Choose a file, or paste a query result." (the prototype's "a sample" removed,
   P10).

### Tests

- `e2e/slice-07a/`: S7A-01 (2 tests: file channel, errors, warnings, a type kept; the standard and `template.csv`
  with Copy), S7A-02 (query channel, the three queries with fractional seconds, Copy, how-to, a pasted SSMS result, a
  dropped CSV, later ones disabled), S7A-03 (DDL channel), S7A-04 (2: a new system end to end; a taken name), S7A-05
  (2: every status and the filter counts over two imports; P2 and a comment overwrite), S7A-06 (2: an unselected table;
  "Only columns…" and the mass warning), S7A-07 (2: the suggested rename and "renamed to"; "removed"), S7A-08 (P6 before
  and after, approving again clears the reason), S7A-09 (2: nothing before Import, Esc, Cancel, Undo; P8's refresh),
  S7A-12 (3: reviewer, reader, archived), S7A-13 (no samples), S7A-17 (DDL then the catalog query), and step 4's
  `S7A-04-route.spec.ts`. **All 23 passed** on their first run after two fixes in the specs (a hidden radio is clicked
  by its label; Playwright's `toBeDisabled` does not see a disabled `<option>`) and one in the app (above, decision 5).
- Unit tests: 87 files, 1,169 tests pass. Lint and typecheck pass.
- **Seen in the browser** (development server on a fresh copy of the demo data): the dialog, the CRM file's review
  (the P6 callout, a suggested rename, requirement keys and canvases in the impacts), the import and its toast, Undo
  ("Undone: Import crm_snapshot_2026-10-20.csv"), the tree before and after.

### The review's filters (S7A-14's review part, measurement build)

`e2e/slice-07a/S7A-14-review.spec.ts` (`MEASURE=1 MEASURE_BUILD=production`): in the page, from the filter's click to
the second animation frame after it, median of 5 (not slice 4b-1's traced method):

| File | new | all | changed | missing | relationships |
| --- | --- | --- | --- | --- | --- |
| A first import of 20,000 columns (2,000 new tables) | 30 ms | 101 ms | 20 ms | 9 ms | 34 ms |
| Its re-import, 5 % changed, renamed or missing | 16 ms | 144 ms | 49 ms | 51 ms | 13 ms |

All within the 200 ms bar.

### The full e2e run

23 October 2026, 08:06–08:59, `npm run e2e` from scratch, no dev server running: **265 passed, 1 failed, 53.1 min**
(19 more tests than step 4's run: slice 7a's specs).

- **The failure: S0-10** (stopping and restarting the dev server) hit its 15-minute timeout. Its first server answered
  404 for the canvas page it had just created (`.data/e2e-runs/S0-10-server-0.log`), so the test never reached the
  restart. **Run three times on its own: 3 passed** (43.8, 47.1 and 50.0 s). A flake: the known case in
  `known-limitations.md`, "e2e dev servers run without Turbopack's file-system cache", which names S0-10. Nothing in
  slice 7a touches it.
- “The destination stream closed early”: 48 times, between tests (the known message); the import specs end right after
  a page refresh, which adds a few.

### Open for step 6

- **`datetime2` in the demo.** The SQL Server query now gives `datetime2` its precision (7 by default), while the demo
  CRM's `created_ts` and `updated_ts` are `datetime2` without one (as typed in the seed), and so is S7A-16's
  `crm_sqlserver_catalog.tsv`. A real catalog result would show "type: datetime2 → datetime2(7)" for them once: true
  against what is stored, but surprising in the demo. Proposal for step 6: the demo seed's `datetime2` columns become
  `datetime2(7)` and S7A-16's file gives precision 7, as the query does now.

### How to check in the browser

1. `npm run dev`, sign in as Łukasz, open "Customer & orders", the Sources tab, "Import sources…".
2. CRM is pre-selected. Drop `src/domain/import/samples/crm_snapshot_2026-10-20.csv` (or choose it): "4 tables, 24
   columns, 4 warnings". Next: the scope by schema (`crmprod.dbo`, `crmprod.stage`). Next: the review.
3. In the review: the callout for Customer.customer_number going back to review; `dob → date_of_birth` suggested;
   change "What happened to created_ts?" to `created_on` and see "its rule now reads CAST(created_on AS date)"; the
   filters; the warnings at the end.
4. "Import into CRM": the toast with Undo; the tree shows `customer_consents` and `crmprod.stage`. Click Undo: the tree
   is as before.
5. Also: "A query on the database" (switch the Database, Copy), "DDL scripts" (drop `samples/billing.sql`, open "The
   translated standard"), "A new system" with the name "crm" (Next stays off), Esc.

## Handover after step 5 (22 October 2026)

Written on 23 October 2026 for the session that continues with step 6.

### State

- Steps 1–5 done and recorded above; **step 6 not started**. Branch `slice/07a-source-import`, last commit before this
  handover `a48310a` (docs: slice 7a step 5). Nothing pushed, no pull request.
- **Waiting for Łukasz:** his answers to step 5's eight decisions and to the `datetime2(7)` proposal ("Open for step 6"
  above). Step 6 starts on his go.

### Only in the conversation so far (now written down)

- **Step 6 also does the seed changes accepted in step 1** (answer 10): Customer.email `string(120)`, first_name and
  last_name `string(50)`, and the source relationships `FK_order_line_order_header` and
  `FK_customer_addresses_customers` (`src/data/local/seed-model.ts`). Then **check the earlier specs** that read types,
  type problems or the status bar: the draft mapping `web_users.email` (`varchar(255)`) → Customer.email becomes a type
  problem (accepted as intended): S1A-01, S1A-09, S2B-07 (frame chips' type count), S6A-07 (status bar), and any spec
  counting "Type problems" or reading Customer's attribute types. If the `datetime2(7)` proposal is accepted, the seed's
  `created_ts`, `updated_ts` and `crm_sqlserver_catalog.tsv` change with it.
- **S7A-16's e2e** (unchanged SQL Server, PostgreSQL and Oracle files show no changes against the demo) waits for the
  seeded relationships; its unit tests exist (`plan.test.ts`). **S7A-17's wording** is in Łukasz's answers to step 3.
- **Step 6's other criteria:** S7A-10 (tree, canvas and panel marks), S7A-11 (system panel, history place), S7A-14's
  element-count guard (`S3B-15-elements.spec.ts` on "Performance test" equal to `slice-06b`'s), S7A-15 at the close.
- **Test files (item 41):** e2e builds the partial CRM file in `e2e/slice-07a/helpers.ts` (`crmPartial`); step 1 Q7's
  `crm-changed.csv` was not needed (the prototype's CRM file and two imports cover every status, S7A-05).
- **Closing (step 7) docs still to do:** `inventory-prototype-vs-app.md` rewritten for the new reference; `ideas.md`
  (own headers in the standard; dbt, Snowflake, Databricks; relationships as grey lines on canvases);
  `known-limitations.md` (no changes to resolve in 7a; an import cannot be undone after a server restart and a later
  change to any imported row refuses its undo, F31); README and CLAUDE.md (slice state, the wizard and route, the
  samples' place, the bench scripts `bench-import-read.ts`, `bench-import-plan.ts`, `bench-import-write.ts`).
- **Known issues:** `experimental.proxyClientMaxBodySize` (`next.config.ts`) is an experimental Next.js option;
  “The destination stream closed early” is printed more often (import specs end right after a refresh); S0-10 can hit
  the known 404 flake; every write on the local data file slows after very large imports (accepted, option 1).

### The code of steps 2–5

- **Domain, readers:** `src/domain/model/column-type.ts` (`readColumnType`, `columnTypeKey`/`sameColumnType`,
  `TYPE_ALIASES`), `type-check.ts` (`MAX_LENGTH` -1, `columnClass`), `src/domain/import/standard.ts` (`readStandard`,
  `MAX_IMPORT_ROWS` 30,000, `STANDARD_TEMPLATE`, `TYPE_KEPT`, `NOT_READ_YET`), `delimited.ts`, `ddl.ts` (`readDdl`,
  `ddlToStandard`, `skippedText`, `ddlSummaryText`), samples in `src/domain/import/samples/` (tests only, lint-guarded).
- **Domain, engine:** `import/model.ts` (`ImportModel`, `relationshipsWithColumns`), `plan.ts` (`buildPlan` →
  `ImportPlan` with `tables`, `relationships` incl. `renamedFrom`, `renames`, `mappings` (P6 impacts), `leftOut`,
  `massWarning`; `planCounts`, `importSummary`), `apply.ts` (`applyPlan` → `ImportChangeset`), `compare.ts`
  (`planDigest`, `planFingerprint`, `keptChoices`, `STALE_REVIEW`).
- **Domain, command and rules:** `commands/import.ts` (`importSources`, `importStateOf`, `STALE_REVIEW_FIELD`),
  `commands/source.ts` (`deleteSourceTable` takes relationships along, `relationshipsOfTable`),
  `model/mapping-rules.ts` (`afterContentChange` clears `review_reason`; `isContentChange` counts an import's
  send-back), `commands/mapping.ts` (`setMappingStatus` clears it), `model/requirements.ts` (missing input covers
  nothing), `commands/undo.ts` (new tables, `review_reason` a status column), `changes.ts` (`labelNothing`).
- **Data:** `src/data/local/schema.ts` (format 6, rules), `file.ts` (upgrade from 5; caches its own write; compact),
  `store.ts` (`model.load` with `sourceRelationships`/`sourceRelationshipColumns`, `model.listImports`, `KeyIndex`,
  scoped `findViolation`); migration `supabase/migrations/20261022220000_source_import.sql`.
- **App:** the route `src/app/w/[workspaceId]/import/route.ts` → `src/app/_lib/import-sources.ts` (`runImport`);
  `run-command.ts` passes `fields`; the wizard `src/app/_panels/import/` (`import-wizard.tsx` with props `systemId` and
  `onImported`, `source-step.tsx`, `scope-step.tsx`, `review-step.tsx`, `wizard-model.ts`, `catalog-queries.ts`);
  `left-panel.tsx` (`importData` prop, `button-import-sources`); the canvas page builds `importData` (`lastImports` from
  `listImports`); `model-index.ts` has `relationshipsOf` (both directions).

### Where step 6 plugs in

- **Item 28 after an import:** `ImportWizard`'s `onImported(outcome)` is not passed by `LeftPanel` yet. Step 6: select
  the system (`outcome.systemId`), keep the Sources tab, and call `openDetails()` (an action that leads to details on
  purpose, CLAUDE.md "Side panels").
- **The system as a selection (items 38–39, Q8):** add `"source_system"` to `{ t: "element", kind }` in
  `src/canvas/line-data.ts`; `placeOf` in `SelectionHistory.tsx` then records it; `ui.showPlace` must not centre it and
  must report it gone (`GONE`); a branch in `src/app/_panels/inspector.tsx` for the system panel (counts; "Re-import
  {system}…" opens `ImportWizard` with `systemId`; "Imports" from `listImports`, which the page must pass per system).
- **Tree (item 33):** `src/app/_panels/tree-data.ts` and `left-panel.tsx`'s `sourceTree` (missing marks and tooltips,
  "{format} file" / "view" / "{n} cols", the system's open button).
- **Canvas (item 34, AD-24: classes on existing elements only):** rows in `src/canvas/card-data.ts` (`buildCards`, a
  column's `missing_since`), lines in `src/canvas/LineLayer.tsx` (`MappingLine`: one `path.s` per input; the class on
  the missing input's segment, F29), styles in `canvas.css`; then the element-count guard.
- **Panels (items 35–37):** `src/app/_panels/source-panels.tsx` (`SourceTablePanel`: kind line with file/view and the
  system link, "Missing from source since", columns with missing last, relationships via `ix.relationshipsOf`;
  `SourceColumnPanel`: "Missing from source since", the comment stays editable per answer 8);
  `src/app/_panels/mapping-panel.tsx` (`review_reason` under the status control, near `seg-mapping-status`).

## Łukasz's answers to step 5 (23 October 2026)

Step 5 accepted, on one condition: the paged review's filter counts and the P6 callout count the whole plan, not only
what is rendered, and a test covers it (done in step 6: `S7A-14-counts.spec.ts`). **`datetime2` (open point):** the
type reader treats a type without a parameter as the type with its default precision where the type's name tells the
vendor unambiguously: `datetime2` and `datetimeoffset` 7 (SQL Server only), `timestamp` 6 (PostgreSQL and Oracle
agree); where the default differs between vendors (`time`: 7 in SQL Server, 6 in PostgreSQL) the difference stays and
shows as a change. Unit tests for each case; the seed and the S7A-16 file may change to `datetime2(7)`.

## Step 6: statuses and panels (23 October 2026)

### What changed

- **The condition on step 5:** `e2e/slice-07a/S7A-14-counts.spec.ts` imports a synthetic system of 160 tables through
  the route, gives two tables past the first 100 cards approved mappings on their business key, and re-imports with a
  change in every table: 100 cards rendered, "Show the next 60 tables of 160", "all changes" and "changed" 162, and the
  callout "2 approved mappings go back to review after this import" with both reasons, while neither table's card is
  rendered. It runs in the normal e2e run.
- **Default precision** (`DEFAULT_PRECISION`, `withDefaultPrecision`, `src/domain/model/column-type.ts`): `datetime2`
  and `datetimeoffset` read as 7; `timestamp`, `timestamptz`, `timestamp with/without time zone` and Oracle's
  `timestamp with local time zone` as 6; `time` keeps no default (`time` and `time(7)` differ). The comparison
  (`columnTypeKey`) applies the same default, so a column stored without its precision before this step and
  `datetime2(7)` from a file are one type. The standard's `precision` column replaces the default (`readStandard` reads
  its own parameter columns whenever the type has none written). Unit tests in `column-type.test.ts`,
  `standard.test.ts`, `ddl.test.ts`.
- **Seed (answer 10):** Customer.email `string(120)`, first_name and last_name `string(50)`, segment_code
  `string(3)`; the declared relationships `FK_order_line_order_header` and `FK_customer_addresses_customers`;
  `created_ts` and `updated_ts` `datetime2(7)`, `web_users.registered_at` `timestamp(6)`. The SQL Server and PostgreSQL
  catalog samples give the precision their queries return (7 and 6). No import is recorded: every system is "not
  imported yet" (item 41). Unit test in `model-store.test.ts`.
- **After an import (item 28):** `useImported` (`src/app/_panels/import/use-imported.ts`): the Sources tab, the
  system selected, `openDetails()`. The left panel's tab now lives in `PanelsProvider` (`leftTab`), so "Re-import" on
  the system panel can show the Sources tab too.
- **The Sources tab (item 33):** a table missing from source struck through in the warning colour with a dot, tooltip
  "Missing from source. …"; a table with missing columns gets the dot, "Some columns are missing from source. …"; the
  right side reads "{format} file", "view" or "{n} cols"; each system has an open button ("Open {system}: imports",
  shown on hover like the concepts' buttons).
- **The canvas (item 34, AD-24, F29):** a missing column's row gets the class `gone` and the title "Missing from
  source"; a mapping's segment from a missing column gets `s gone` (dotted, `stroke-opacity` .5); the ƒ node's line only
  when every input is missing. Classes on existing elements only; bundles and blocks unchanged.
- **Table panel (item 35):** "Source table / Source view / Source file ({format}) of {system}" with the system as a
  link; `database.schema`; "{n} rows · From the source: {comment}"; "Missing from source since {date}"; columns with the
  missing ones last, struck through, "missing" on the right; "Relationships between source tables" in both directions
  ("cust_id → dbo.customers", "dbo.customer_addresses.cust_id → here", the name, "· missing"), a click goes to the other
  table; "None known. They come from foreign keys in an import."
- **Column panel (item 36):** "Missing from source since {date}". The comment stays the editable field (answer 8).
- **Mapping panel (item 37):** under the status of a mapping in review with a reason: "An import sent it back to review:
  {reason}."
- **System panel (item 38,** `src/app/_panels/system-panel.tsx`): "Source system", the name, "{n} tables, {m} columns,
  {k} mapped" and ", {x} missing from source" when there are any; "Re-import {system}…" for editors; "Imports": date
  and time, source label, who, summary, newest first, or "No imports yet." The page passes every import
  (`systemImports`, built on the server) and the wizard's data to the inspector.
- **The system as a place (item 39):** `{ t: "element", kind: "source_system", id }`; `showPlace` never centres it and
  reports it gone ("That source system no longer exists.", `GONE.source_system`) when the system is not in the model,
  e.g. after its import was undone.

### Decisions I took (please check)

1. **Fractional seconds may be 0.** `datetime2(0)` and a `precision` column of 0 were refused as "zero" (a type kept as
   written, with a warning); with the default in place a precision column of 0 would have read as 7. Now 0 is allowed
   for date and time types only; lengths and number precisions still refuse 0.
2. **The time-zone forms of `timestamp` get 6 as well** (`timestamptz`, `with time zone`, Oracle's `with local time
   zone`): PostgreSQL and Oracle agree on them as on `timestamp`.
3. **No opacity on rows and lines** (AD-24: no opacity on repeated elements): a missing row is muted by colour (ink-3)
   with its name struck through in the warning colour; a line segment by `stroke-opacity`, as the dimmed lines are.
   The PRD and the prototype say "reduced opacity".
4. **Texts:** the mapping's "An import sent it back to review: {reason}."; dates as in the review
   ("Missing from source since 2026-10-23"); imports as "23 Oct 2026, 09:44" (the server's local time).
5. **The system panel shows the missing count only when there is one**, as the prototype does.
6. **The table panel's path is now `database.schema`**; the system moved into the kind line (as the prototype). No spec
   read the old path.
7. **The DoD's CRM re-import now sends two approved mappings back to review:** `email_addr` widens to `varchar(255)`
   and Customer.email is `string(120)` since answer 10, a type conflict on a direct mapping (P6). S7A-08 checks both.

### Question

1. **SQL Server's `timestamp` is not a date** (it is `rowversion`, binary(8)). The reader does not know the vendor, so
   a SQL Server catalog result with a `timestamp` column now reads it as `timestamp(6)`. It compares the same on every
   re-import (no false change) and its type check is the same as before; only the shown text gains "(6)". Leave it, or
   should `timestamp` without a parameter stay without a default?

### Tests

- New: `S7A-10.spec.ts` (2: the tree, canvas, table and column marks and their going away; the mapping's reason),
  `S7A-11.spec.ts` (3: the panel from the tree and from a table panel; Re-import, the Sources tab and the imports newest
  first; Back and Forward, and the toast of a system whose import was undone), `S7A-14-counts.spec.ts`.
- **Earlier specs changed** (all by the seed of answer 10 or the default precision): `S1A-09` (Customer.email at 100
  adds one type problem, not two; the transform brings the count back to where it started), `S1A-13` (`issued_at
  datetime2(7)`), `S2C-06` (the bundle of 8 holds `web_users.email`'s type problem: `warn`), `S7A-04` and
  `S7A-04-route` (HR's relationships among the seeded ones), `S7A-05` ("1 new relationship": the seeded one comes back),
  `S7A-08` (two send-backs). `e2e/slice-06b/helpers.ts`'s `selected` reads a system panel as `system:<name>`.
- S2C-07 (the bundle panel counts the same type problem), found by the full run.
- Specs of what the step touched, before the full run: slice 7a, slice 6b, and S1A-01, -09, -13, S1B-11, S2A-02, -06,
  -08, S2B-07, -09, -11, S2C-04, -05, -06, S3A-02, -06, S4B1-04, -06, S4B2-03, -06, S4P-12, S6A-05, -07: 63 passed and 7
  failed on the first run, the 7 above; after the changes all 13 tests of those files pass.
- Lint and typecheck pass. `npm test`: 87 files, 1,174 tests pass.

### The element-count guard (S7A-14)

`S3B-15-elements.spec.ts` on "Performance test", measurement build, first on `slice-06b` (a worktree at the tag,
`../infomapper-base-06b`), then on this branch with `ELEMENTS_BASELINE=.data/measure/s7a14-baseline/slice-06b.json`:

| View | `slice-06b` page / viewport | this branch page / viewport |
| --- | --- | --- |
| 100 %, frames expanded | 20,785 / 19,305 | 20,826 / 19,305 |
| 30 %, frames expanded | 5,988 / 4,508 | 6,029 / 4,508 |
| 100 %, frames collapsed | 6,297 / 4,907 | 6,338 / 4,907 |
| 30 %, frames collapsed | 2,855 / 1,465 | 2,896 / 1,465 |

Every viewport count is equal. The whole page has 41 elements more in every view, outside the viewport; I have not
traced which (the left panel and the page's data are the candidates).

### The full e2e run

23 October 2026, 10:28–11:12, `npm run e2e` from scratch: **271 passed, 1 failed, 44.3 min** (26 tests more than
step 4's run, 6 more than step 5's).

- **The failure: S2C-07**, the bundle panel's status counts: "9 approved, 2 in review, 2 draft, 1 with a type problem."
  where the spec expected no type problem. Not a flake: the bundle holds `web_users.email` → Customer.email, a type
  problem since the seed of answer 10; my search for specs affected by the seed missed this text. The spec now expects
  it and passes (3 tests, run on its own after the fix).
- **Not quite from scratch:** a development server on port 3000 (PID 26124, started 09:35, before this session) was
  running during the run. It was not mine, so I left it; the run uses its own server on 3200 and its own build folder.
- "The destination stream closed early": 45 times, between tests (the known message).

### How to check in the browser

1. `npm run reset-dev-data`, `npm run dev`, sign in as Łukasz, open "Customer & orders", the Sources tab.
2. Hover CRM's header and click "⋯": the system panel ("2 tables, 15 columns, 7 mapped", "No imports yet.",
   "Re-import CRM…").
3. "Re-import CRM…", drop a copy of `src/domain/import/samples/crm_sqlserver_catalog.tsv` with the `email_addr` line
   removed, Next, Next, "Import into CRM": the Sources tab, CRM's panel with the import and ", 1 missing from source";
   on the canvas `email_addr` struck through and its line to Customer.email dotted; `customers` in the tree with the
   dot and its tooltip.
4. Click the `customers` card: the kind line, "182,340 rows", `email_addr` last with "missing", the relationship from
   `customer_addresses`. Click `email_addr`: "Missing from source since …".
5. Re-import with the full file: the marks are gone. Back and Forward walk through the system's panel.
6. "Import sources…" with `crm_snapshot_2026-10-20.csv`: after the import, click `cust_no`, then
   Customer.customer_number under "Feeds": "An import sent it back to review: business key column changed type,
   varchar(20) → varchar(25)."

## Łukasz's answers to step 6 (24 October 2026)

Step 6 accepted with its decisions: `datetime2(0)` readable, muted colour instead of opacity (AD-24 wins over the PRD's
wording), the panel texts, `database.schema` as the table panel's path, the definition-of-done scenario with two
mappings. The port-3000 server was Łukasz's. Remove `../infomapper-base-06b` at the close.

**SQL Server's `timestamp`:** it is `rowversion`, not a date, so `timestamp(6)` misleads the modeller even without a
false change. The channels that know the vendor translate it: the query channel for SQL Server's result, and the DDL
channel when it recognises a SQL Server script; the type table treats `rowversion` as `binary(8)`. The file channel
cannot tell the vendor and keeps today's behaviour, with a line in `known-limitations.md`. Unit tests for both channels.

## Step 7: closing (24 October 2026)

### `rowversion` (step 6's question)

- `readStandard(text, name, { vendor })`: with `vendor: "sqlserver"` a `timestamp` reads as `rowversion`
  (`sqlServerType`, `src/domain/import/standard.ts`). The wizard reads a query result with the database chosen and
  reads it again when the choice changes; the upload sends `vendor`, and the command reads with it.
- `ddlToStandard`: a script with SQL Server's signs (brackets, `GO`, `IDENTITY`: the same signs that make `dbo` the
  unqualified schema) writes `timestamp` as `rowversion`.
- The type check reads `rowversion` as `binary` (`CHECKED_AS`, `type-check.ts`): no date, number or text attribute
  takes it, a custom `binary` attribute does.
- **Found on the way: P8's digest did not hold a new column's type.** It held the new column's name only, since both
  sides read the same text; a reader option (the vendor) can make them differ. The digest now holds what a new table
  and a new column are written with, so the server refuses a plan that would write another type than the review showed.
  Unit test: the server without the vendor refuses.
- Unit tests: `standard.test.ts` (SQL Server, PostgreSQL, Oracle, a file), `ddl.test.ts` (a SQL Server script, a
  PostgreSQL script, one without signs), `type-check.test.ts` (`rowversion`), `import.test.ts` (the server's read).
- `known-limitations.md`: "SQL Server's `timestamp` read from a file is a date" (with `time`'s default).

### The 41 elements outside the viewport

Traced by counting every element outside `.react-flow__viewport` by its nearest test id and by tag, on `slice-06b` and
on this branch (measurement build, "Performance test" at 100 %): all 41 were `<span>`s in `tree-item`. Step 6 wrapped
every tree item's name in a span of its own for the strike-through, whether the table was missing or not, so every
item in the left panel had one element more (41 items listed). **Fixed** (`add7b0a`): the strike-through is a class on
the name's existing span, and only a missing mark adds its dot. After the fix the whole page's counts equal
`slice-06b`'s too:

| View | `slice-06b` page / viewport | this branch page / viewport |
| --- | --- | --- |
| 100 %, frames expanded | 20,785 / 19,305 | 20,785 / 19,305 |
| 30 %, frames expanded | 5,988 / 4,508 | 5,988 / 4,508 |
| 100 %, frames collapsed | 6,297 / 4,907 | 6,297 / 4,907 |
| 30 %, frames collapsed | 2,855 / 1,465 | 2,855 / 1,465 |

The baseline is `.data/measure/s7a14-baseline/slice-06b.json` (git-ignored); the worktree it came from is removed.

### Docs

- `README.md`: the status (slices 0 to 7a), what slice 7a brings, the test files for trying the import, the bench
  scripts and the review's measuring spec.
- `CLAUDE.md`: the import in "What this is"; the bench scripts, the review's spec and the element guard in the
  commands; slice 7a's e2e helpers; a "Source import" note (domain code, the wizard, the upload route and P8's
  fingerprint, the samples' lint rule, the classes on the canvas, the system as a place).
- `docs/inventory-prototype-vs-app.md`: rewritten against `infomapper-prototype-with-sources.html`; "Sources" lists what
  7b and 7c still miss, and slice 7a's deliberate differences.
- `docs/known-limitations.md`, checked against steps 1–7: added "Imports raise no changes to resolve yet" (PRD section
  9), "An import's undo: all or nothing, and not after a restart" (F31), "SQL Server's `timestamp` read from a file is a
  date" (step 7), "The upload relies on an experimental Next.js option" (step 4), "Combined mappings never get a type
  conflict" (F1). Already there: the slow writes after large imports (step 4, option 1), the 30,000-row limit, the
  relationship matching (F30, `ddadf55`).
- `docs/ideas.md`, checked against steps 1–7: added matching a file's own headers (PRD section 10), the dbt, Snowflake
  and Databricks channels, relationships between source tables as lines on the canvas (step 5, decision 2). Already
  there: "Approve again all {n}" (step 1), one file per table in the local adapter (step 4).

### The acceptance criteria

Each criterion against its spec. "Passed" is the latest run of that file; the closing full runs are below.

| ID | Spec(s) | What it checks | Result |
| --- | --- | --- | --- |
| S7A-01 | `S7A-01.spec.ts` (2), `standard.test.ts` | the samples and the template read; aliases, delimiters, quotes, BOM, `NULL`; each error and warning with its text; the standard's description and `template.csv` with Copy | passed |
| S7A-02 | `S7A-02.spec.ts`; `standard.test.ts`, `import.test.ts` (`rowversion`) | each vendor's query with Copy and how-to, fractional seconds in the queries; a pasted SSMS result with `NULL` cells; a dropped CSV; Snowflake, Databricks and dbt disabled | passed |
| S7A-03 | `S7A-03.spec.ts`, `ddl.test.ts` | the three DDL samples; each skip and warning; database and schema rules; the translated standard copied | passed |
| S7A-04 | `S7A-04.spec.ts` (2), `S7A-04-route.spec.ts` | HR into "HR": all new; system, tables, columns, relationships, `source_import`, one change group; a taken name blocks Next | passed |
| S7A-05 | `S7A-05.spec.ts` (2) | new, changed, unchanged, missing and back columns, new and back relationships, table meta, filter counts; P2; a comment overwrite | passed. A missing relationship is covered by the first import of the same test (`crmPartial` marks `FK_customer_addresses_customers` missing) and by `S7A-10`'s table panel ("· missing") |
| S7A-06 | `S7A-06.spec.ts` (2) | an unselected table untouched; "Only columns of the tables in the file"; the mass warning and its button | passed |
| S7A-07 | `S7A-07.spec.ts` (2) | the suggestion pre-selected; "renamed to" keeps the id, mappings, **label and requirement link** (added in step 7: the title said so, the spec did not check it), flags; "removed"; one new column paired once | passed |
| S7A-08 | `S7A-08.spec.ts` (2), `plan.test.ts` | a business key type change on a direct mapping, a type conflict, **a combined mapping with its business key input and its renamed input in the rule, rule rewritten, and a draft keeping its status** (added in step 7: before, only in unit tests); approving clears the reason; item 25's impact texts | passed |
| S7A-09 | `S7A-09.spec.ts` (2), route P8, `import.test.ts` | nothing written before "Import into"; Cancel and Esc; one undo step restores everything; P8's refresh keeps the choices | passed |
| S7A-10 | `S7A-10.spec.ts` (2) | the tree's marks and tooltips, the canvas row and line marks, the table, column and mapping panels; a column that comes back loses its marks | passed |
| S7A-11 | `S7A-11.spec.ts` (3) | the panel from the tree and from a table panel; counts, Re-import, the imports newest first; the Sources tab after an import; Back and Forward; the toast of a system gone | passed |
| S7A-12 | `S7A-12.spec.ts` (3), `S7A-04-route.spec.ts` (2) | reviewer, reader and archived workspace see no import action; **the server refuses the reader, the reviewer and an archived workspace** (reviewer and archived added in step 7) | passed |
| S7A-13 | `S7A-13.spec.ts` | no sample links on any channel; the standard and `template.csv` there | passed |
| S7A-14 | `bench-import-*.ts` (steps 2–4), `S7A-14-review.spec.ts`, `S7A-14-counts.spec.ts`, `S3B-15-elements.spec.ts` | the figures within the bars at the 30,000-row limit (step 4); the review's filters ≤ 200 ms (step 5); counts over the whole plan (step 6); element counts equal `slice-06b`'s | passed |
| S7A-15 | CI, two full runs | lint, typecheck, unit tests (87 files, 1,179 tests), `npm run schema:check` (a throwaway Postgres 18.3: "29 tables, 382 columns"): pass. **Two full runs: not run yet** (below). Changed earlier tests: S1A-09, S1A-13, S2C-06, S2C-07 (seed and default precision, step 6), S1A-13 (`max`, step 2), the format tests of step 4, `e2e/slice-06b/helpers.ts`'s `selected` | open |
| S7A-16 | `S7A-16.spec.ts` (**new in step 7**), `plan.test.ts` | the demo's CRM (SQL Server) and WEB (PostgreSQL) and HR from Oracle, unchanged, through the query channel: no changes, no mapping to review, "No changes" | passed |
| S7A-17 | `S7A-17.spec.ts`, `plan.test.ts` | DDL then the catalog query: only the computed column's type and the view; no mapping to review | passed |

### The two full runs

**Not run.** A development server was still running when the runs were to start (port 3000, PID 26124, `npm run dev`
with `next dev`, started 23 October 09:35). Stopping it was refused by the session's permission rules, and the runs need
no dev server running (CLAUDE.md). They wait for that server to be stopped.

## Manual acceptance (the definition of done)

Start from fresh demo data, with no other server running:

```
npm run reset-dev-data
npm run dev
```

Open http://localhost:3000, sign in as Łukasz, open Retail Co – DWH, the project Customer 360, the canvas "Customer &
orders". The test files are in `src/domain/import/samples/`.

1. **Sources tab.** Click "Sources". You see "Import sources…" at the top and the systems CRM, WEB, ERP. Hover CRM's
   header and click "⋯": CRM's panel, "Source system", "2 tables, 15 columns, 7 mapped", "Re-import CRM…", Imports "No
   imports yet."
2. **HR into a new system.** "Import sources…" → "A new system", name "HR" → "A file" → drop or choose
   `hr_snapshot_2026-10-20.csv`: "2 tables, 10 columns". Next: the scope shows `hrdb.dbo` with two tables. Next: the
   review, filters "12 all changes", "10 new (2 tables)", "2 relationships"; "Relationships between source tables" lists
   `FK_employees_departments` and `FK_employees_manager`. "Import into HR".
   **You see:** the toast "Imported into HR: 2 new tables, 10 new columns, 2 new relationships" with Undo; the Sources
   tab with HR and its two tables; HR's panel open with one import (date and time, `hr_snapshot_2026-10-20.csv`,
   Łukasz, the summary). Click `employees` in the tree, then "Relationships between source tables" in its panel: both
   relationships.
3. **Re-import CRM.** Open CRM's panel ("⋯" on CRM) and click "Re-import CRM…" (CRM is pre-selected). Drop
   `crm_snapshot_2026-10-20.csv`: "4 tables, 24 columns, 4 warnings". Next, Next.
   **In the review you see:**
   - the callout "2 approved mappings go back to review after this import": Customer.customer_number "business key
     column changed type, varchar(20) → varchar(25)", Customer.email "type conflict, varchar(255) into string(120)";
   - the filters: 21 all changes, "11 new (2 tables)", 4 changed, 3 "removed or renamed?", 2 missing from source, 1
     relationship;
   - "What happened to dob?" pre-set to "It was renamed to date_of_birth (suggested: same position and type)": keep it;
   - "What happened to created_ts?" and "What happened to segment?" on "It was removed from the source": leave both;
     `created_ts`'s impact reads "Feeds Customer.created_at (in review); the mapping stays, on a column that is gone";
   - "Warnings": three classifications not read yet (TECH, Effective date, Load date) and "batch_ref has no data_type.
     Column skipped."
   "Import into CRM".
   **You see:** the toast "Imported into CRM: 2 new tables, 11 new columns, 3 changed columns, 1 renamed column, 2
   missing from source, 1 new relationship" with Undo; the Sources tab, CRM's panel with ", 2 missing from source" and
   the import listed.
4. **The missing column on the canvas.** On the `customers` card, `created_ts` and `segment` are struck through in the
   warning colour, muted, with the tooltip "Missing from source"; the line from `created_ts` to Customer.created_at is
   dotted and faded. In the tree, `customers` has the orange dot (tooltip "Some columns are missing from source. …").
   Click `created_ts`: its panel says "Missing from source since {today}". Click the `customers` card's header: the
   panel lists `created_ts` and `segment` last, struck through, "missing".
5. **The mapping in review.** Click `cust_no` on the card, then Customer.customer_number under "Feeds": the mapping's
   status is "In review" and below it "An import sent it back to review: business key column changed type, varchar(20)
   → varchar(25)."
6. **Undo.** Click Undo (the toolbar's, or the toast's if still open): the toast "Undone: Import
   crm_snapshot_2026-10-20.csv". **You see** everything as before step 3: no strike-through on the card, `dob` back, no
   `customer_consents` or `crmprod.stage` in the tree, the mapping approved again without a reason, CRM's panel without
   the import ("2 tables, 15 columns, 7 mapped").
7. **Billing from a DDL script.** "Import sources…" → "A new system", name "Billing" → "DDL scripts" → drop
   `billing.sql`. **You see:** "billing.sql: 2 tables, 14 columns, 3 keys, 2 comments", the database `billing` and the
   schema `dbo` used, "Skipped: 2 SET statements, 1 CREATE INDEX, 1 default, 1 other ALTER TABLE statement", and "The
   translated standard" to open and copy. Next, Next: in "Warnings", "dbo.invoice.full_ref is a computed column; its type
   is not in the DDL, so it is imported as “computed”…" and "view dbo.v_open_invoices skipped. A DDL script does not give
   the types of a view’s columns…". "Import into Billing": "Imported into Billing: 2 new tables, 14 new columns, 1 new
   relationship".
8. **Back and Forward.** Click the Back button before the breadcrumbs a few times: the system panels and the items you
   selected come back one by one, the latest first (a system has no place on the canvas, so the view does not move);
   Forward walks the other way.
