# Slice 7a – Source import and re-import

Status: **draft for step 1**, 22 October 2026. Branch `slice/07a-source-import`, from `main` at tag `slice-06b`. PRD file: `docs/prd/slice-07a-source-import.md`. A large slice: the full e2e run after each step (CLAUDE.md, "Tests per step").

## 1. Why this slice

Today a source table enters the app only by typing it ("New source table" with column lines, S1A-13) or through the seed. A data warehouse model starts from dozens of systems and hundreds of tables, and those sources keep changing. Slice 7a brings the prototype's Source importer: describe a system once from a file, a catalog query or DDL scripts, then re-import it and see exactly what changed before anything is written.

The importer came from a separate prototype and is merged into `infomapper-prototype-with-sources.html`, which becomes the reference (section 10). It is too large for one slice, so it is split in three (Łukasz, 22 October 2026):

- **7a (this slice): import and re-import.** The wizard, three channels, the engine, missing and back statuses, the import history, relationships between source tables.
- **7b: consequences of source changes.** Changes to resolve with their actions, the requirement coverage preview, model consistency on the project home, the "Changes" view on the canvas.
- **7c: classifications and Data Vault reading.** The workspace's classification list, notes on tables and columns, suggested classifications, the Data Vault reading.

The working chat behind the importer ("architecture area A-04") was not kept. The prototype is the only source, so the rules it shows are written down here as decisions.

**Decisions agreed with Łukasz on 22 October 2026.** One principle decides them: the modeller stays in control and sees what will happen before it happens. Nothing changes silently, everything an import does can be read in the review, in the toast and on the system's panel, and it can be undone.

- **P1. Who owns what on a source column.** The source owns name, position, type with its parameters, nullable, primary key, foreign key and comment; a re-import updates them. The modeller owns classifications and notes; a re-import never changes them, and the review says so where the file disagrees (prototype `diffCols`).
- **P2. A field the file leaves out is never compared or overwritten.** A file without a `column_comment` column keeps every stored comment.
- **P3. Missing is a status, not a delete.** A table or column not in the file gets `missing_since`; it keeps its mappings, its canvas cards and its links. When it comes back, the status clears. Nothing is deleted by an import.
- **P4. Missing is judged only inside the import's scope, and the modeller picks the scope.** Either inside the imported schemas (a full snapshot) or only among the columns of the tables in the file (a partial file). A partial file never marks the rest of the system missing, and a warning catches the likely mistake (item 23).
- **P5. Renames are the modeller's decision.** The engine suggests a rename where a gone column and a new one share position and type; the modeller can pair any gone column with any new one, or say it was removed. A rename keeps the column's id, so its mappings, labels, requirement links and classifications stay.
- **P6. Source changes reach mappings (extends D-51), in 7a.** An approved mapping goes back to review, with a stored reason, when an import gives one of its input columns a type conflict it did not have, changes the type of an input that is a business key, or renames an input named in the rule (the rule is rewritten). There is no switch to keep the approval: it was given for the source as it was (D-51), and keeping it would bypass four-eyes (AD-06). Instead it is shown before the import (item 27's callout and item 25's impact), stated in the toast, and reversible by approving the mapping again as usual.
- **P7. The import is one write and one undo step.** One domain command, one change group, one entry in the undo history; the toast offers Undo. Nothing is written before "Import into {system}".
- **P8. A review never goes stale silently.** On import the server builds the plan again from the same text and the modeller's choices. If the system changed since the review was opened (someone else edited or imported it), nothing is written; the review refreshes to the current state, keeps the scope and the rename choices that still apply, and says "{system} changed since you opened this review. The review now shows the current state; check it and import again."
- **P9. The working context does not label an import** (D-26 already leaves source tables and columns out; this adds the mappings an import sends to review).
- **P10. No samples in the app.** The prototype's sample links are left out; the standard's description and `template.csv` stay. The prototype's samples become test files under `e2e/fixtures/slice-07a/` for the specs; Łukasz tests with his own files.
- **P11. Classifications in the file:** in 7a only Business key and PII are read (they exist as `is_business_key` and `is_pii`). Any other classification is not dropped silently: the review lists it as "Classification “{name}” is not read yet; slice 7c brings the full list."

## 2. Sources

- **Prototype** (`infomapper-prototype-with-sources.html`, module `IMP`):
    - the standard: `STD_HEADERS`, `STD_INFO`, `ALIASES`, `parseDelimited`, `readStandard`, `parseTypeStr`, `fmtType`;
    - the catalog queries: `SQL_SERVER`, `SQL_POSTGRES`, `SQL_ORACLE`, `VENDORS`;
    - the DDL channel: `tokenizeSQL`, `ddlToStandard`, `typeString`, `TYPE_ALIAS`, `TYPE_STOP`, `DDL_SAMPLES`;
    - the engine: `buildPlan`, `diffCols`, `applyPlan` (without its `issue(...)` calls, 7b), `importSummary`;
    - the wizard: `openWizard`, `renderWizard`, `stepSource`, `ddlIn`, `stepScope`, `massWarn`, `stepReview`, `footNote`, `canGo`, `doImport`;
    - the panels: `insSystem` (re-import and the imports list only), `sourceHead`, the columns list and "Relationships between source tables" in `sourceBody`, the status lines in `colSections`;
    - the tree: `sourcesTree` ("Import sources…", the system's open button, `im-gone`, `im-old`, `im-dot`);
    - the canvas: `colRow` (`im-gone`), the mapping line class `gone`, CSS `.card .row.im-gone`, `.lnk.map.gone`, `.titem.im-gone`;
    - the samples `SAMPLE_CRM`, `SAMPLE_HR`, `SAMPLE_FILES` and `DDL_SAMPLES`, as e2e test files only (P10).
- **`docs/decisions.md`:** D-13 (formats follow the data schema), D-26 (working context), D-36 (physical column order), D-47 (show what goes with a delete), D-49 and D-50 (inputs of a mapping), D-51 (approval belongs to a version of the mapping), AD-05, AD-06, AD-08, AD-10 to AD-18, AD-23, AD-26, AD-29.
- **`docs/data-model-v2.md`:** section 5 (`source_system`, `source_table`, `source_column`), section 6 (`mapping`, `mapping_input`), `change_event`.
- **`docs/inventory-prototype-vs-app.md`:** "Sources: nothing found missing" was written against the old reference; this slice replaces it.
- **App:** "New source table" with column lines (slice 1a, `column-lines`), the type check of mappings (slice 1a, D-01), the Sources tab, the table and column panels, the undo history, the requirement index (slice 4a), history places (slice 6b).

## 3. What to build

### Data (one migration; `docs/data-model-v2.md` in the same PR)

1. **`source_table`:** `object_type` allows `file` beside `table` and `view` (CHECK); new `file_format` text, null (`xlsx`, `csv`, `json`… as the file calls it); new `missing_since` timestamptz, null.
2. **`source_column`:** new `missing_since` timestamptz, null. An import updates `ordinal` (physical order, D-36).
3. **`source_relationship`** (a foreign key between source tables): standard columns, `source_table_id` (from), `to_source_table_id`, `name` (unique per from-table among non-deleted rows, case-insensitive), `kind` (`declared`, CHECK; room for later kinds), `missing_since`. **`source_relationship_column`:** `source_relationship_id`, `from_column_id`, `to_column_id`, `sort_order`.
4. **`source_import`:** standard columns, `source_system_id`, `imported_by` (FK `app_user`), `imported_at`, `channel` (`file`, `query`, `ddl`; CHECK), `source_label` (the file name, "pasted query result" or "{script} (translated)"), and the counts `tables_new`, `columns_new`, `columns_changed`, `columns_renamed`, `columns_missing`, `relationships_new` (integers, no JSON).
5. **`mapping`:** new `review_reason` text, null; set by item 31, cleared when the mapping is approved.
6. Every row the import writes gets its `change_event` in one change group (AD-13). Unchanged rows are not written.

### The standard (v1)

7. **One row per column.** Column names as below, in any order; other columns are ignored. Required: `database`, `schema`, `table`, `column`, `data_type`.

| Column | What it holds |
| --- | --- |
| `database`, `schema`, `table`, `column` | names; required |
| `object_type` | `table`, `view` or `file` (default `table`) |
| `file_format` | for a file: `xlsx`, `csv`, `txt`, `json`, `xml`, `parquet`… |
| `row_count`, `table_comment` | table level; the first non-empty value counts |
| `ordinal` | physical position (default: file order) |
| `data_type` | as in the source; `varchar(20)`, or `varchar` with `length` 20; required |
| `length`, `precision`, `scale` | when not in `data_type` |
| `nullable`, `primary_key` | `yes`/`no` (also `y`, `true`, `1`, `t`); nullable defaults to yes, no for a key |
| `fk_name`, `fk_ref_schema`, `fk_ref_table`, `fk_ref_column` | one row per column of the key |
| `column_comment` | comment from the source |
| `classifications` | codes or names separated by `;` or `\|` (item 11) |

8. **Reading rules** (`readStandard`): header names are matched case- and space-insensitively with the prototype's aliases (`table_name`, `column_name`, `is_nullable`, `ordinal_position`, `tags`…); the delimiter (comma, semicolon or tab) is taken from the first line; quoted fields and doubled quotes; a leading BOM is dropped; a cell reading `NULL` counts as empty (SSMS). Types: `max` or `-1` as length means max; the argument of `timestamp`, `datetime2`, `time` and `datetimeoffset` is fractional seconds, not a length. A column in two foreign keys appears in two rows; the second row adds to its keys.
9. **Errors stop the import** and keep the wizard on step 1: "The file is empty.", "The file has no “{header}” column. Name the columns as in the standard below.", "The file has no usable rows.", and item 12's size limit.
10. **Warnings** do not stop it and are listed in the review: a row without database, schema, table or column; a column without `data_type`; a column twice in a table (second row skipped).
11. **Classifications (P11):** `BK` / Business key and `PII` set `is_business_key` and `is_pii` on a new column. Any other code or name is listed once per table in the review's warnings as "Classification “{name}” is not read yet; slice 7c brings the full list." (P11). A re-import never changes them on an existing column (P1); when the file disagrees, the review says "The file says {list}; your classifications are kept."
12. **Size (assumption, to confirm in Q2):** up to 20 MB and 100,000 column rows per import. Over that: "The file has {n} rows; one import takes up to 100,000. Split it by database or schema."
13. **Flat files** are described the same way: a made-up database and schema (e.g. `flat_files.ref_data`), `object_type` `file`, the format in `file_format`, logical types allowed (`string(2)`, `decimal(18,6)`).

### Channels

14. **A file:** drop or choose a `.csv`, `.tsv` or `.txt`. Shown after reading: the name, "{n} tables, {m} columns", "{k} warnings (shown in the review)" and "Choose another"; on an error "The file can’t be read." with the message.
15. **A query on the database:** a Database select (SQL Server, PostgreSQL, Oracle; "Snowflake (later)" and "Databricks (later)" disabled), the prototype's catalog query for it (read-only, with Copy) and its how-to line, then "The result": paste it with its header row and "Read it", or drop the saved CSV. The query reads only the catalog, never data.
16. **DDL scripts:** paste a script or drop a `.sql`, `.ddl` or `.txt`, with Database and "Schema for unqualified names" fields, then "Read the script". It reads `CREATE TABLE` (column and table constraints), `ALTER TABLE … ADD` (columns and constraints), `COMMENT ON TABLE/COLUMN`, `MS_Description` extended properties, `USE`, and `GO` or `/` separators; quoted names in `[]`, `""` and backticks. It translates them to the standard and reads that (items 7–11). Database: from `USE` or three-part names, else the field, else the file name without extension. Unqualified schema: the field, else guessed `dbo` (SQL Server signs) or `public` (PostgreSQL signs), else `default`. A foreign key without target columns points at the target's primary key.
17. **What DDL skips, with a warning:** views ("A DDL script does not give the types of a view’s columns; use the catalog query or add the view to the standard."), `CREATE TABLE … AS SELECT`, a table or column defined twice, parentheses that do not close, `ALTER TABLE` on a table the script does not create. Computed columns get the type `computed` with a warning. Indexes, sequences, grants, defaults and storage clauses are skipped and counted by kind ("Skipped: 2 SET statements, 1 CREATE INDEX…").
18. **After reading a script:** "{name}: {n} tables, {m} columns, {k} keys, {c} comments", the database and schema used, what was skipped, and "The translated standard" folded open with Copy ("If something is off, copy it, fix it in Excel or an editor and import it as a file.").
19. **dbt project** ("catalog.json, later") is shown disabled.

### The wizard

20. **Opens** from "Import sources…" at the top of the Sources tab, and from "Re-import {system}…" on the system panel (the system pre-selected). A modal dialog titled "Import sources into {target}", three numbered steps (Source, Scope, Review changes) that can be clicked when reachable, a footer note, and Back or Cancel, Next or "Import into {target}". Esc and Cancel close it without writing.
21. **Step 1, Source. "Into which system?"** An existing system: a radio list sorted by name, each with "{n} tables · last import {date}" or "not imported yet", and "Find a system" above it when there are more than 5. A new system: a name; a name already taken blocks Next with "A system named {name} already exists. Pick it under “An existing system”." **"Where does the description come from?"** The four channel choices (items 14–19). **"InfoMapper’s source standard (v1)"** folded: the column table (item 7), the flat-file note and `template.csv` with Copy.
22. **Step 2, Scope.** Tables grouped by `database.schema`, a checkbox per group (indeterminate when partly selected) and per table with its column count; for an existing system "{n} new" or "all new to {system}". All are selected at first. For an existing system, **"What is missing from the source?"**: "Anything in the imported schemas that is not in the file" (default) or "Only columns of the tables in the file" (P4). A callout lists the system's tables that will be marked missing, "with their mappings kept". Footer: "{n} tables of {m} selected"; Next needs at least one.
23. **Mass warning:** when the import would mark more than half of the system's present columns missing: "This import would mark {n} of {m} columns of {system} missing from source. If the file holds only part of the system, compare only the tables in the file." with a button that switches item 22's choice.
24. **Step 3, Review changes.** Filter buttons with counts: all changes, new (columns, or "new ({n} tables)"), changed, "removed or renamed?", missing from source, relationships. Per table a card: status tag (new table, changed, missing table, back), `schema.table`, a "{format} file" chip, the comment of a new table, its column count or "rows {a} → {b}". Per column a row: the tag, the name ("old → new" for a rename), what (type, PK, FK, not null and classification chips for a new one; "{field}: {before} → {after}" for a change; "Back in the source after being missing since {date}"; "Was {type}" for a missing one) and the impact (item 25). "Show {n} unchanged columns" per table under "all changes".
25. **Impact of a column** with mappings: "Feeds {Entity}.{attribute} ({status})", then as applicable "; the mapping stays, on a column that is gone", "; the mapping stays" (rename), "; goes back to review: {reason}", "; type conflict: {short}", "; fits again, the mapping can be approved", "; its rule now reads {rule}", the attribute's requirement keys as tags, and "On {canvases}". A missing column without mappings: "Not mapped".
26. **Rename decision** on a gone column when the table has new columns: "What happened to {name}?" with "It was removed from the source" and "It was renamed to {new}" per new column, the suggestion marked "(suggested: same position and type)" and pre-selected; a new column already paired elsewhere is not offered. "A rename keeps its mappings, classifications and notes."
27. **Also in the review:** "Relationships between source tables" (status, name, `from.columns → to.columns`); "Warnings" (reading, DDL, classifications not read yet and unresolved foreign keys); when approved mappings go back to review, a callout above the tables: "{n} approved mappings go back to review after this import" with their reasons (P6); when nothing changed: "The file matches what {system} has. Importing only records the import and updates row counts." Footer: "Nothing is written until you import. The import is one undo step."
28. **Import:** the server rebuilds the plan and writes it (P7, P8). The dialog closes, the Sources tab shows with the system selected and its panel open, and a toast says "Imported into {system}: {summary}" with Undo. Summary as `importSummary` without "to resolve": "2 new tables, 5 new columns, 1 changed column, 1 renamed column, 3 missing from source, 1 new relationship" or "No changes".

### The engine

29. **Tables** are matched by `database.schema.table`, **columns** by name within their table, both case-insensitively. Statuses: new, changed, unchanged, missing, still missing, back, rename. A changed table has a changed comment, file format or object type (P2) or a changed column; a row count is updated without making the table changed.
30. **Relationships** are matched by foreign key name on their from-table: new, changed (other column pairs), unchanged, missing (an existing one the file no longer declares), back. A foreign key whose target is neither in the file nor in the system is skipped with "Foreign key {name} on {table} refers to {target}, which is neither in this file nor in the system. Relationship skipped."
31. **Mappings (P6, AD-26):** for each mapping that reads a changed or renamed column, the existing type check runs per input before and after. The mapping goes back to review, with `review_reason` listing the reasons, when: an input has a type conflict it did not have before; an input classified as business key changed type; a renamed input is named in the rule (whole word), which is then rewritten. A draft or review mapping keeps its status; its rule is still rewritten. A missing input changes no status in 7a.
32. **Back:** a table or column found again clears `missing_since`. A missing table's relationships become missing with it.

### Where the statuses show

33. **Sources tab:** a missing table's name struck through in the warning colour with a dot, tooltip "Missing from source."; a table with missing columns gets the dot, tooltip "Some columns are missing from source."; the right side reads "{format} file", "view" or "{n} cols". Each system's group has an open button ("Open {system}: imports").
34. **Canvas:** a missing column's row at reduced opacity with its name struck through in the warning colour, title "Missing from source"; a mapping line from a missing column dashed and faded. Marks are classes on existing elements, no new element per row (AD-24).
35. **Table panel:** the kind line "Source table / Source view / Source file ({format}) of {system}" with the system as a link; `database.schema`; "{n} rows · From the source: {comment}"; "Missing from source since {date}"; "Columns and where they go" (missing columns last and struck through; right side the attributes fed, "missing" or "not used"); "Relationships between source tables" in both directions, or "None known. They come from foreign keys in an import."
36. **Column panel:** "Missing from source since {date}" and "From the source: {comment}".
37. **Mapping panel:** under the status of a mapping in review, its `review_reason`.
38. **System panel** (new selection, item 39): kind "Source system", the name, "{n} tables, {m} columns, {k} mapped, {x} missing from source", "Re-import {system}…", and "Imports": date and time, source label, who, and the summary, newest first; "No imports yet." when there are none.
39. **The system as a place** (CLAUDE.md, "Back and forward"): selecting a system is a history place; it has no place on the canvas, so `showPlace` does not centre; a deleted system shows its `GONE` toast.

### Permissions

40. Importing and re-importing need the rights to change the model (owners, admins, modelers; AD-05) in a workspace that is not archived. A reviewer and a reader see statuses, panels and the imports list; "Import sources…" and "Re-import" are not offered, and the server refuses the command.

### Seeds and test files

41. The demo seed records no import: its systems show "not imported yet". No samples in the app (P10). The prototype's samples and DDL samples become files under `e2e/fixtures/slice-07a/`; a changed CRM file is added so its re-import into the demo CRM shows each status at least once (Q7).
42. `seed:large` gains a generator for the performance files (section 6), not a stored import.

## 4. Steps (stop after each one)

1. **Questions** (section 7) in a new `docs/prd/slice-07a-acceptance.md`; the docs plan; the plan of section 6 with a time estimate. The new reference prototype goes into `docs/prototype/` in this step (section 10). It includes the critical review against the code (section 7). No code. Stop.
2. **Readers in the domain** (items 7–19): the standard reader and the DDL translator as pure TypeScript in `src/domain`, with unit tests from the prototype's samples and one test per warning and error. No UI. CI. Stop.
3. **The engine in the domain** (items 29–32): plan and apply as pure functions over the model, unit tests per status, rename, scope rule (P4), mass warning and mapping rule (P6). The synthetic files of section 6 and the plan's build time. CI. Stop.
4. **Data and the command** (items 1–6, 28, 40): the migration, the local adapter (new tables, uniqueness, CHECKs, the data file's version), the import command with its permission check, the server's rebuild and the concurrency check (P8), change events, undo. One full e2e run. Stop.
5. **The wizard** (items 20–27): the three steps and the four channels, with their tests. One full e2e run. Stop.
6. **Statuses and panels** (items 33–39, 41): the tree, the canvas marks, the table, column, mapping and system panels, the history place, the e2e test files. The element-count guard (section 6). One full e2e run. Stop.
7. **Closing:** docs (section 10), the inventory, two full e2e runs in a row, Łukasz's manual acceptance. Merge only on his command; tag `slice-07a`.

## 5. Acceptance criteria

Tests in `e2e/slice-07a/`, one file per criterion, each from a fresh seed; unit tests next to the domain code. What a criterion checks goes through the page and is read back from the data file.

| ID | Criterion |
| --- | --- |
| S7A-01 | The standard: the three sample files and the template read as expected (tables, columns, types with length, precision, scale and max, keys, foreign keys over two rows, comments, files); aliases, the three delimiters, quotes, BOM and `NULL` cells; each error of item 9 and warning of item 10 with its text. Unit and e2e. |
| S7A-02 | The query channel: each vendor's query is shown with Copy and its how-to; a pasted SQL Server result with `NULL` cells reads like the CRM sample; Snowflake, Databricks and dbt are disabled. |
| S7A-03 | The DDL channel: the three DDL samples give the expected tables, columns, types, keys, foreign keys and comments; each skip and warning of item 17 with its text; the database and schema rules of item 16; the translated standard can be copied. Unit and e2e. |
| S7A-04 | A new system: HR sample into "HR"; every table and column is new; the system, tables, columns and relationships are written with `source_import` and one change group; a taken name blocks Next with its text. |
| S7A-05 | Re-import: a changed CRM file shows new, changed, unchanged, missing and back columns, a new and a missing relationship, and table meta changes, with the right counts on the filter buttons; P2: a file without `column_comment` changes no comment. |
| S7A-06 | Scope (P4): an unselected table is untouched; "Only columns of the tables in the file" marks no other table missing; the mass warning appears above half and its button switches the choice. |
| S7A-07 | Renames (P5): the suggestion is pre-selected; choosing "renamed to" keeps the column's id, its mappings, labels, requirement links and BK/PII; choosing "removed" marks it missing and adds the new column; one new column cannot be paired twice. |
| S7A-08 | Mappings (P6): an approved mapping goes back to review with its reason for a new type conflict, a business key type change and a renamed input in its rule (rule rewritten); a combined mapping with one changed input (AD-26); a draft keeps its status; approving clears the reason; the review's impact texts of item 25. |
| S7A-09 | One write (P7, P8): nothing is written before "Import into"; the import is one undo step and undo restores everything, including mapping statuses and rules; a change to the system between review and import writes nothing, refreshes the review with P8's text and keeps the scope and the rename choices that still apply. |
| S7A-10 | Statuses: the tree's marks and tooltips, the canvas row and line marks of a missing column, the table, column and mapping panels' texts; a column that comes back loses its marks. |
| S7A-11 | System panel and history: opens from the tree and from a table panel; counts, "Re-import", the imports list newest first; the system is a back-and-forward place; a deleted system shows its toast. |
| S7A-12 | Roles: a reviewer and a reader see statuses and imports but no import action; an archived workspace offers none; the server refuses the command for each. |
| S7A-13 | No samples in the app (P10): no sample links on any channel; the standard's description and `template.csv` with Copy are there. |
| S7A-14 | Performance (section 6): plan and apply times on the synthetic files within the bars; element counts in the viewport of "Performance test" equal `slice-06b`'s. |
| S7A-15 | CI (lint, typecheck, unit tests, schema check) and two full e2e runs in a row; changed earlier tests listed. |

**Definition of done (scenario for the manual acceptance).** As Łukasz, in Retail Co – DWH: import the HR test file into a new system "HR" and see it in the Sources tab with its tables and relationships; re-import CRM with the changed CRM test file, pair the suggested rename, leave the other gone column as removed, see an approved mapping announced as going back to review, and import; see the missing column struck through on "Customer & orders" with its dashed mapping line, the mapping in review with its reason, and the import in CRM's panel; undo it and see everything as before; read the Billing DDL test script into a new system and see the computed column and the skipped view in the warnings.

## 6. Performance

No measuring sitting: the canvas gains only classes on existing elements. The import itself is measured, because enterprise systems are large. Bars are proposals to confirm in step 1 (assumptions, not measured yet).

| Case (synthetic, `scripts/`) | Bar (median of 5, development build) |
| --- | --- |
| Read a 20,000-column standard file (2,000 tables) | ≤ 1 s |
| Translate a 2,000-table DDL script | ≤ 2 s |
| Plan a re-import of that file against a system holding it, 5 % of columns changed, renamed or missing | ≤ 2 s |
| Apply that plan through the local adapter, with change events | ≤ 5 s |
| Undo that import | ≤ 5 s |
| Switching filters in the review of that plan | ≤ 200 ms to the screen |

A miss stops the step with the figures and Łukasz decides. The review renders at most the visible table cards' rows at once if Q2 finds a full render too slow. The element-count guard: `S3B-15-elements.spec.ts`'s viewport counts on "Performance test" must equal `slice-06b`'s.

## 7. Questions for step 1

**Be critical and check against the code (Łukasz, 22 October 2026).** This PRD was written from the prototype and the docs, without reading the app's code. The app already works and you can read all of it, so treat this PRD as a proposal to verify, not as a specification to follow blindly.

- Check every item of section 3, every decision P1–P11 and every acceptance criterion against the code and the earlier slices.
- Say where the PRD is wrong, contradicts the code or an earlier decision, duplicates something the app already has, misses something the code needs, or would cost more than it assumes (data model, undo, performance).
- Name the files and functions behind each finding, and propose a better way where you see one.
- Q1–Q10 below are a minimum, not the whole list. When unsure, ask rather than guess (CLAUDE.md).

Questions:

- **Q1. Sources in the app today:** how "New source table" writes tables and columns; how `nvarchar(max)` is stored (`type_length` is an integer); how `source_system` is created and named; uniqueness and soft delete of tables and columns in the local adapter; what the migration of items 1–5 needs.
- **Q2. Where the work runs:** reading and planning in the browser (the model is on the page) or in a server action; how a 20 MB text reaches the server for P8; Next.js body size limits; whether the review needs windowed rendering.
- **Q3. One undo step for a large write:** how the undo history holds a write set of thousands of rows, and how big one change group may get in the data file; what P7 costs at section 6's sizes.
- **Q4. Concurrency (P8):** what fingerprint of the system the plan carries (versions of its tables and columns, the newest `updated_at`, or the data file's version) and how the command compares it.
- **Q5. The type check:** where the app's equivalent of the prototype's `typeIssue` lives, whether it works per input of a combined mapping, and whether item 31 can call it on a column state that is not stored yet.
- **Q6. Mapping status changes:** how D-51 sends a mapping to review today, and how item 31 reuses it without a separate approval path; where `review_reason` shows in the mapping panel.
- **Q7. Test files against the demo data:** do the CRM sample's names match the demo CRM's tables and columns? Propose the changed CRM test file for S7A-05 and the scenario so every status appears.
- **Q8. The system as a selection:** is a source system selectable today (frames of kind `source_system`, the tree), and what item 38 and item 39 add to the selection and history code.
- **Q9. The dialog:** the shadcn component for a three-step modal of this size, file reading in the browser, focus handling, and Esc while a select is open.
- **Q10. Earlier tests** that change (the Sources tab, panels, the type check, D-51's specs, element counts), and the empty-workspace text that mentions import.

## 8. Differences from the prototype (deliberate)

- Mappings have inputs (AD-26): conflicts, business key changes and rule rewrites are judged per input; the prototype has one column per mapping.
- The server rebuilds the plan; when the system changed after the review, nothing is written and the review refreshes (P8). The prototype applies what it showed.
- No changes to resolve, no requirement coverage box and no "to resolve" part in the summary (7b); no "Show what it touched on the canvas" (7b).
- Classifications: only Business key and PII are read; no suggested classifications, no table classifications, no notes (7c).
- No sample links in the app; the prototype's samples become e2e test files (P10).
- Real date, time and person on each import; the prototype has a fixed date and "Łukasz".
- A size limit per import (item 12).
- The error for unknown headers no longer promises "iteration 2"; matching own headers is listed in `docs/ideas.md`.
- Opening the system after an import opens its panel on purpose (CLAUDE.md, side panels: actions that lead to details call `openDetails()`).

## 9. Left for slices 7b and 7c

| Slice | What | Prototype |
| --- | --- | --- |
| 7b | Changes to resolve: kinds, severity, actions (retire, move mappings, delete with what goes with it, map, not needed, split, approve again, leave in review); `retired_since`, `not_needed`, a mapping's `until`; the open count in the tree, the status bar and the panels | `KIND`, `ACTS`, `issueAction`, `confirmPending`, `issuesHtml` |
| 7b | The review's requirement coverage box and "{n} changes to resolve" callout | `stepReview` (`reqBox`, `issBox`) |
| 7b | Model consistency on the project home | `consistency`, `consistencyHtml` |
| 7b | The "Changes" view on the canvas: toolbar button, selection of an import, fading through `FadeLayer`, a view-state chip (D-39); "Show what it touched on the canvas"; the new and changed row marks | `chgSet`, `renderChgBar`, `IMP.hit`, `im-new`, `im-chg` |
| 7c | The classification list per workspace (built-in, Data Vault, own; column and table scope), replacing `is_business_key` and `is_pii` | `DEFAULT_CLASSES`, `renderSettings` |
| 7c | Classifications and notes on tables and columns; suggested classifications in the review | `togs`, `colSections`, `plan.hints` |
| 7c | Data Vault reading of a table (AD-08) | `dvReading` |

**Open for 7b (decide before its PRD):** imports done in 7a raise no changes to resolve. 7b either derives open changes from the statuses 7a stored (missing columns, mappings in review) or starts with an empty list.

## 10. Docs in this PR

- **`docs/prototype/`:** `infomapper-prototype-with-sources.html` replaces `infomapper-model-prototype.html` as the frozen reference (Łukasz, 22 October 2026), in step 1, as its own commit. CLAUDE.md's "Sources of truth" and "Things not to touch" name the new file.
- **`docs/decisions.md`** (only with Łukasz's approval of the quoted text): a new D-entry "Source import" with P1–P5 and P7–P10; D-51 extended with P6; D-26 extended with P9.
- **`docs/data-model-v2.md`:** items 1–5 (new columns, `source_relationship`, `source_relationship_column`, `source_import`, `mapping.review_reason`) and the standard (item 7) as the import format (D-13).
- **`docs/inventory-prototype-vs-app.md`:** rewritten for the new reference; "Sources" lists what 7b and 7c still miss.
- **`docs/ideas.md`:** matching own headers in the standard; the dbt, Snowflake and Databricks channels; relationships between source tables as grey lines on the canvas (the prototype's "shown later").
- **`docs/known-limitations.md`:** the size limit (item 12); imports in 7a raise no changes to resolve.
- **README and CLAUDE.md:** the slice's status; the import in the model section; the performance scripts of section 6.
