# Slice 7c – Classifications, notes and the Data Vault reading

Status: **draft for step 1**, 26 October 2026. Branch `slice/07c-classifications`, from `main` at tag `slice-07b`. PRD file: `docs/prd/slice-07c-classifications.md`. Test regime: a small slice (CLAUDE.md, "Testing"), plus one full e2e run after the step with the data upgrade (P13). Step 1 checks this PRD against the code (CLAUDE.md, "How we work").

## 1. Why this slice

Slice 7c closes the source importer: a workspace list of **classifications** replaces the two fixed flags (`is_business_key`, `is_pii`) on source columns, tables and columns get the modeller's **notes**, the import **reads every classification** a file names and **suggests** some, and in Data Vault 2.0 mode a table panel shows its **Data Vault reading** (AD-08). This is business metadata about sources: what a column means for the model, owned by the modeller, never overwritten by a re-import (D-55).

The guiding principle of slices 7a and 7b stays: the modeller stays in control and sees what will happen before it happens. Nothing changes silently; everything can be undone. Where the app already has its own convention (undo, change events, impact forms, rich text, four-eyes, roles), the app's convention wins over the prototype's code; the prototype gives the behaviour, the wording and the layout.

The data model of this slice is the minimum the features need. A data model review is planned as a slice of its own at the end; what 7c leaves open for it is listed in section 9.

**Decisions agreed with Łukasz on 26 October 2026:**

- **P1. Every classification is editable.** Built-in ones (general and Data Vault) and the workspace's own can be renamed and removed; own ones are added. The app is methodology-neutral, so no classification is forced on a workspace. Built-in classifications keep a stable **code** (`BK`, `PII`, `LK`…) that the app's rules read; renaming changes only the name shown. Removing a classification shows first where it is used and, for a built-in one, which rules stop reading it (for Business key: the business key suggestion on attributes, AD-28; sending an approved mapping back on a type change, D-51; the change "Business key column changed", D-56; the import's suggestion; the Keys row filter; the BK badge). A removed built-in classification can be restored from the list, empty. Each change is one undo step.
- **P2. The built-in list** is the prototype's 19 (section 3, item 1), with **Effective date moved to the general group**: effective dating is not specific to Data Vault. No hash diff: it is a column of the warehouse, not of a source.
- **P3. A minimal data model:** `classification` (the workspace's list, built-in ones as rows with their code) and `classification_link` (one classification on one source table or column, AD-15). The column flags `is_business_key` and `is_pii` become links and are dropped. The attribute's `is_business_key` and `is_pii` stay as they are.
- **P4. The list is edited** in a dialog opened from the table and column panels ("Edit the list…"), by owners, admins and modelers; read-only in an archived workspace. Removing a classification in use shows its impact first (D-47). The dialog says that a new name is also the name an import file must use.
- **P5. Data Vault 2.0 mode off:** Data Vault classifications stay stored and are hidden in the panels, chips and the reading. Switching the mode off says how many stay stored. The import still reads Data Vault classifications and the review shows them, marked as hidden while the mode is off.
- **P6. The import reads the whole list** from the `classifications` column: each value matched to a classification's code or current name, ignoring case, spaces, `_`, `-` and `/`; column classifications only. An unknown value is a warning and is ignored. A re-import never changes classifications; when the file differs, the review says so and keeps the modeller's. Table classifications are set by hand only.
- **P7. Suggested classifications in the review:** Business key for the only primary key column of a table without a business key; Link key, in Data Vault mode, for a foreign key column that is not a primary key. Only for new columns the file does not classify; ticked by default, unticked by the modeller. The unticked suggestions go to the server with the other choices and are part of the plan's fingerprint (slice 7a, P8).
- **P8. Notes** on source tables and columns, the modeller's own text, separate from the source's comment: `note_html` and `note_text` (AD-17), edited the way the app edits a mapping's note, one undo step per change.
- **P9. The column comment becomes read-only** ("From the source:"), ending slice 7a's answer 8. Comments typed by hand move into the column's note in the data upgrade, when the change log shows that no import wrote them; otherwise they stay. Nothing is moved silently: the upgrade lists what it moved (section 7, Q4).
- **P10. The Data Vault reading** as in the prototype: Data Vault mode only, in the table panel, hints only. Columns missing from source, retired or marked not needed are left out.
- **P11. No new marks on the canvas.** Rows keep the BK and PII badges, read from an index built once per load, not by searching links while drawing. The viewport's element counts equal `slice-07b`'s.
- **P12. Data Vault hints in the entity panel** (the prototype's `dvSection`) are not part of 7c.
- **P13. Tests:** the small-slice regime, plus one full e2e run after the step with the data upgrade.

## 2. Sources

**Prototype** (`docs/prototype/infomapper-prototype-with-sources.html`, the `IMP` module):

| Function | What it gives this slice |
| --- | --- |
| `DEFAULT_CLASSES`, `indexClasses`, `classOf`, `norm` | the built-in list, its groups, matching a file's value to a classification |
| `renderSettings`, `#setDlg` | the classification list dialog: columns and tables, used counts, add, rename, remove |
| `togs` | the toggles in the panels, grouped General / Data Vault 2.0 / This workspace |
| `sourceBody`, `colSections` | where classifications, notes and the reading sit in the table and column panels; their texts |
| `classChips` | classifications as chips in the review |
| `buildPlan` ("Classification hints"), `stepReview` ("Suggested classifications"), `applyPlan` (accepted hints) | the import's suggestions |
| reading `classifications` in the standard's reader; `diffCols`'s `clsNote` | the import reads the list; "The file says …; your classifications are kept." |
| `dvReading` | the Data Vault reading |
| the `change` handler on `[data-imx-note]` | saving a note and its toast |

**Decisions:** D-08 (model tags apart from working labels), D-26 (the working context labels no source table or column), D-42 and AD-17 (rich text), D-47 (impact before delete), D-51, D-55, D-56, AD-05 (roles), AD-08 (Data Vault hints only), AD-09 (archive), AD-12, AD-13, AD-15 (link tables), AD-18 (no arrays), AD-24 (canvas rules), AD-28 (business key on attributes).

**Data model:** `docs/data-model-v2.md`, section 5 (Sources) and section 4 (`attribute`).

**Earlier slices:** slice 7a's PRD and acceptance (P11's "not read yet" warning, answer 8 on the comment, the review, P8's fingerprint); slice 7b's PRD and acceptance (the business key change, settling); slice 1a (the BK suggestion on attributes, the BK and PII badges, the column panel).

## 3. What to build

### The list and its data

1. **The built-in list (P2).** Every workspace starts with these 19. The code is fixed; the name is the default name.

   | Code | Name | Scope | Group |
   | --- | --- | --- | --- |
   | `BK` | Business key | column | General |
   | `PII` | PII | column | General |
   | `TECH` | Technical / audit | column | General |
   | `LDTS` | Load date | column | General |
   | `RSRC` | Record source | column | General |
   | `EFF` | Effective date | column | General (prototype: Data Vault) |
   | `LK` | Link key | column | Data Vault 2.0 |
   | `DCK` | Dependent child key | column | Data Vault 2.0 |
   | `DK` | Driving key | column | Data Vault 2.0 |
   | `MAK` | Multi-active key | column | Data Vault 2.0 |
   | `T_MASTER` | Master data | table | General |
   | `T_TXN` | Transactions | table | General |
   | `T_REF` | Reference / code list | table | General |
   | `T_STG` | Staging | table | General |
   | `T_LOG` | Log / audit | table | General |
   | `T_HIST` | History (SCD2) | table | General |
   | `T_HUB` | Hub candidate | table | Data Vault 2.0 |
   | `T_LNK` | Link candidate | table | Data Vault 2.0 |
   | `T_SAT` | Satellite source | table | Data Vault 2.0 |

2. **`classification`** (P3): standard columns, `workspace_id`, `code` (text, set for built-in ones, unique per workspace among non-deleted rows, never changed), `name`, `name_key` (normalized as in `norm`, written by the server; unique per workspace and scope among non-deleted rows), `scope` (`column`, `table`; CHECK), `origin` (`builtin`, `data_vault`, `own`; CHECK). A removed classification is soft-deleted (`deleted_at`); restoring a built-in one brings the same row back.
3. **`classification_link`** (P3, AD-15): standard columns, `workspace_id`, `classification_id`, `source_table_id`, `source_column_id`, exactly one of the two set; unique per classification and object among non-deleted rows. The domain refuses a link whose object does not fit the classification's scope.
4. **Workspaces get the list:** a new workspace gets the 19 rows in its creation's change group; every way the app makes a workspace does the same (step 1 lists them).
5. **The data upgrade:** the local data file's next format and one migration (DDL only, RLS on both tables): the 19 rows in every workspace; `source_column.is_business_key` → a `BK` link, `is_pii` → a `PII` link; both columns dropped; P9's comments moved (item 16). Like slice 7b's derivation, the upgrade is no undo step and changes no model content: it writes what the flags said in the new form.
6. **One way to read classifications.** A domain function answers "which classifications does this table or column have" and "does it have the role `BK`" from an index built once per load (P11). Every reader of the old flags uses it: the BK and PII badges on rows, the Keys row filter, the column panel, the business key suggestion on attributes (AD-28), creating an attribute from a column, the import's plan (D-51's business key send-back, D-56's "Business key column changed"), P8's fingerprint, the seeds and the tests. Step 1 lists them all.

### The classification list dialog (P1, P4)

7. **"Classifications"**, opened by "Edit the list…" in the table and column panels. The prototype's text: "One list for the workspace. Data Vault ones show while Data Vault 2.0 mode is on in the workspace settings. An import file may use any of these names in its classifications column." Two sections, "For columns" and "For tables"; each row has the name (a "Data Vault 2.0" chip on Data Vault ones), "used {n}×" or "unused", and "built in" for built-in ones.
8. **Add** (own ones): "New column classification, e.g. Hash candidate" / "New table classification, e.g. Golden source" and Add; a taken name (in the same scope, compared with `norm`) is refused with "That name is taken". One undo step.
9. **Rename** any classification in place; the same name rule. Under the list: "A new name is also the name an import file must use; for built-in ones the code (e.g. BK) keeps working." One undo step.
10. **Remove** any classification. When it is used, a confirmation first (D-47): "{name} is used on {t} tables and {c} columns." with the objects listed (a filter and "Show all" past 20, D-35); for a built-in one with rules, what stops: e.g. for Business key "Without it, the app no longer suggests business keys on attributes, sends approved mappings back when a business key column changes type, raises business key changes on import, suggests business keys in the import, filters keys by it or shows the BK badge." Remove takes the classification and its links away in one undo step.
11. **Restore:** removed built-in classifications are listed under "Removed built-in classifications" with Restore; restored, they come back empty, under the name they had. One undo step.
12. **Who:** owners, admins and modelers edit the list; reviewers and readers see it read-only; an archived workspace is read-only. The server refuses every write the role or the archive forbids.

### Classifications and notes in the panels

13. **Column panel:** a "Classifications" section with toggle buttons in the groups "General", "Data Vault 2.0" (only in Data Vault mode, P5) and "This workspace", then "Yours: a re-import never changes them." and "Edit the list…". It replaces today's business key and personal data checkboxes. Each toggle is one undo step; disabled for reviewers, readers and in an archive.
14. **Table panel:** the same section for table classifications, with "Edit the list…".
15. **Notes (P8):** a "Note" section in the table panel (placeholder "What this table holds, who owns it, how it is loaded"; hint "Separate from the source's comment.") and in the column panel (placeholder "What a modeller should know: meaning, quirks, which values to expect"). Saved as the app saves a mapping's note; one undo step; toast "Note saved on {name}" or "Note removed from {name}". Read-only for reviewers, readers and in an archive.
16. **The comment (P9):** the column panel shows the source's comment read-only as "From the source: {comment}", as the table panel does; `updateSourceColumn` no longer takes `comment`. The upgrade moves every column comment no import wrote into the column's note (empty notes only) and clears the comment; step 1 confirms the change log can tell (Q4).
17. **Data Vault mode (P5):** switching it off says "Data Vault 2.0 mode is off. {n} Data Vault classifications stay stored and show again when the mode is on." ({n} only when there are any).

### The import

18. **Reading (P6):** the standard's reader matches each value of `classifications` (split on `;` and `|`) to a column classification of the workspace's current list, by code or name, with `norm`. An unknown value: "Row {n}: unknown classification “{value}” on {table}.{column}, ignored. Add it under Classifications to use it." Slice 7a's "not read yet" warning goes. The list is an input of the plan: the server plans with the list as it stands, and a list changed between the review and the import refreshes the review (slice 7a, P8).
19. **The review:** a new column shows its classifications as chips (names; a Data Vault chip; with the mode off, "hidden while Data Vault 2.0 mode is off"). A matched column whose file classifications differ shows "The file says {names}; your classifications are kept.", now for every classification.
20. **Suggested classifications (P7):** a "Suggested classifications" section in the review ("Suggestions only. Untick what does not fit; you can change classifications on the column later."), one ticked checkbox per suggestion with the column, the chip and the reason: Business key, "the only primary key column, and the table has no business key"; Link key in Data Vault mode, "a foreign key: a candidate for a link between hubs". A suggestion needs its classification in the list. The unticked ones go to the server and into the fingerprint; the ticked ones become links in the import's change group, undone with it.

### The Data Vault reading (P10)

21. **"Data Vault reading"** in the table panel in Data Vault mode, below the relationships, with the prototype's lines and texts: Hub on the business key columns (or "Marked as a hub candidate, but no column is a business key yet"); a Link per source relationship of the table, noting "(foreign key; not marked Link key)"; Link keys with no relationship; Dependent child key, Driving key, Multi-active satellite, Effective-dated; a Satellite with its descriptive columns and the PII ones as a separate satellite. Columns missing from source, retired or not needed are left out; missing relationships too. Empty: "Classify columns (Business key, Link key…) to see what this table suggests." Footer: "Hints from the classifications and the source’s keys; nothing is created." The reading reads codes, so a renamed classification keeps working and a removed one is simply absent.

### Data for tests

22. **Seeds:** the demo seed's BK and PII flags become links; the prototype's sample files already carry `TECH`, "Effective date" and "Load date", which are now read. `seed:large` gets classifications on its tables so the index is measured at size (section 6).

## 4. Steps

Stop after each step with a short summary of what changed and how to check it; wait for Łukasz before the next.

1. **Critical review** (section 7): check every item, decision and criterion against the code, `docs/decisions.md` and slices 7a and 7b's acceptance; answer Q1–Q10 in `docs/prd/slice-07c-acceptance.md`. No application code. Stop.
2. **The domain** (items 1–3, 6, 8–11 as pure commands, 18, 20, 21): the list and its rules, links and scope, the role check and the index, the reader and the plan's suggestions, the Data Vault reading, every reader of the old flags switched in the domain. Unit tests; CI. Stop.
3. **Data, upgrade and commands** (items 2–5, 12, 16's upgrade, 22): the migration, the local data file's new format and its upgrade, the server actions, the seeds. The decision texts quoted for approval (section 10). One full e2e run (P13). Stop.
4. **The panels and the dialog** (items 7–17): classifications and notes in the panels, the list dialog, the read-only comment, the Data Vault mode message. The slice's specs for these, the touched earlier specs, CI. Stop.
5. **The import and the reading** (items 18–21): the review's chips, the file's classifications, the suggestions and the fingerprint, the Data Vault reading; section 6's figures and the element-count guard. The slice's specs, the touched earlier specs, CI. Stop.
6. **Closing:** docs (section 10), one full e2e run, Łukasz's manual acceptance. Merge only on his command; tag `slice-07c`.

A new Claude Code session when a step's context runs long, with a handover section in the acceptance doc first (slices 7a and 7b).

## 5. Acceptance criteria

Tests in `e2e/slice-07c/`, one file per criterion, each from a fresh seed; unit tests next to the domain code; test files from `src/domain/import/samples/`.

| ID | Criterion |
| --- | --- |
| S7C-01 | The built-in list: a new workspace and every upgraded one hold the 19 classifications of item 1, with their codes, scopes and groups; Effective date is general. |
| S7C-02 | The upgrade: every column's business key and personal data flags become `BK` and `PII` links; the BK and PII badges, the Keys filter, the business key suggestion on attributes and the column panel show what they showed before; P9's comments moved into notes, as the upgrade lists them. Unit test on a data file in the previous format. |
| S7C-03 | Toggles: a column and a table classification set and cleared from the panels, each one undo step; the Data Vault group only in Data Vault mode; disabled for a reviewer and a reader; the server refuses their writes. |
| S7C-04 | Add and rename: an own classification added; a built-in and an own one renamed; a taken name refused; the new name shows in the panels and the review; an import matches the new name and the built-in's code. |
| S7C-05 | Remove and restore: the confirmation lists the uses and, for a built-in one, the rules that stop; Cancel changes nothing; Remove takes the links with it; Undo brings both back; a removed built-in one restored comes back empty. |
| S7C-06 | Rules follow the code: with Business key removed, no business key suggestion on attributes, no send-back or change on a business key column's type change, no business key suggestion in the import, no BK badge; restored and set again, each works again. Unit tests per rule. |
| S7C-07 | Notes: on a table and a column; saved, with its toast; Undo; read-only for a reviewer and a reader; the HTML sanitized on the server (AD-17). |
| S7C-08 | The comment: read-only "From the source:" in the column panel; a re-import still shows a comment overwrite in the review (slice 7a) and leaves the note alone. |
| S7C-09 | Data Vault mode: switched off, the Data Vault classifications are hidden and stay stored, the message names their count; switched on, they show again; the reading shows only in the mode. |
| S7C-10 | Reading the file: codes and names of the whole list read; an unknown value warns and is ignored; with the mode off, Data Vault values are read and marked in the review; the "not read yet" warning is gone; a re-import never changes classifications and says "The file says …; your classifications are kept." |
| S7C-11 | Suggestions: Business key and, in Data Vault mode, Link key offered by their rules; an unticked one is not written; ticked ones become links and go with the import's undo; changing the list or a tick between the review and the import refreshes the review. |
| S7C-12 | The Data Vault reading: each line on test tables made for it; missing, retired and not needed columns left out; the empty text; a renamed classification still read. |
| S7C-13 | Roles and archive: the list, the toggles and the notes follow item 12 and items 13–15; the server refuses each forbidden write. |
| S7C-14 | Performance (section 6) and the element-count guard against `slice-07b`. |
| S7C-15 | CI and the full e2e runs of the test regime; changed earlier tests listed with the reason. |

**Definition of done (scenario for the manual acceptance).** As Łukasz, in Retail Co – DWH: open `customers` and see `cust_no` still a business key and the PII columns still PII; add a table classification "Golden source" and set it on `customers`; write a note on the table and on `cust_no`, then undo one; rename Business key to "Klucz biznesowy" and see it in the panels; remove it, read what stops, cancel; switch Data Vault mode on, set Link key on a foreign key column and read the table's Data Vault reading; re-import CRM with a file that classifies a column differently and read "The file says …"; import a new system, untick one suggested classification and import; check that the ticked one is set and the unticked one is not; undo the import.

## 6. Performance

The slice touches the canvas only through where the BK and PII badges come from (P11); the rest is panels, a dialog and the import. Bars are proposals to confirm in step 1.

| What | How | Bar |
| --- | --- | --- |
| Viewport elements | `S3B-15-elements.spec.ts` with `ELEMENTS_BASELINE` from `slice-07b` | equal |
| Canvas idle and toggles | the canvas commit counter: a toggle of a classification other than Business key and PII | no canvas commit |
| Toggling Business key on a column | the canvas commit counter, the card's row on the screen | that card only |
| The classification index | a new `scripts/bench-classifications.ts`: 20,000 columns, 10 % classified, median of 5 | under 20 ms |
| Planning an import | `scripts/bench-import-plan.ts` with classifications and suggestions | within 10 % of `slice-07b` |
| Writing an import | `scripts/bench-import-write.ts 20000` with classifications | within 10 % of `slice-07b` |
| Removing a classification used on 2,000 columns | through the local adapter, one change group | under 1 s |
| The data upgrade | on `seed:large` | reported, not a gate |

Nothing new above the canvas reads layout during a commit (CLAUDE.md); the panels' sections and the dialog take sizes, if any, from a `ResizeObserver`.

## 7. Questions for step 1

**The rule (CLAUDE.md, "How we work"):** a PRD is a proposal to verify, not a specification; this one was written from the prototype and the docs without reading the code. In step 1, check every item, decision and acceptance criterion against the code, `docs/decisions.md` and the earlier slices' acceptance docs, and write into `docs/prd/slice-07c-acceptance.md` where the PRD is wrong, contradicts the code or a decision, duplicates what the app already has, misses what the code needs, or costs more than it assumes (data model, undo, change events, performance), each with the files and functions behind it and a proposal. List the differences between the reference prototype and the app that the slice touches. No application code in step 1; Łukasz answers before step 2.

- **Q1. Readers of the old flags.** Every place that reads or writes `is_business_key` or `is_pii` on a source column (domain, data, pages, canvas, seeds, tests, scripts), and what moving each to the index of item 6 costs. Which of them sit on the canvas's render path.
- **Q2. Where the panels live and undo.** Where the table and column panels can be opened (canvas pages, homes, the tree), and whether a change made there is an undo step today (D-29 says no undo outside canvases yet). The same for the dialog. Propose where "Edit the list…" is offered if undo is missing somewhere.
- **Q3. Making workspaces.** Every path that creates a workspace (the new-workspace action, the seeds, the e2e fixtures, any copy) and where the 19 rows are written; the local data file's next format number and its upgrade; the migration.
- **Q4. The comment (P9).** Whether the change log tells a comment typed by hand from one an import wrote, for every column; whether the table's comment is editable today; whether "New source table" writes comments. Propose the upgrade's report (where the moved comments are listed).
- **Q5. The note's editor (P8).** How the mapping's note is edited and stored today (rich-text dialog or a field; `note_html`/`note_text`), and whether the same works in the source panels.
- **Q6. The import's inputs.** How the classification list enters the reader and `buildPlan`, how the review's choices reach the upload route and the fingerprint, and what the plan does when an own name matches a built-in code of another scope.
- **Q7. Settling changes.** An open "Business key column changed" change whose column loses Business key, or whose classification is removed: propose its settlement text ("Settled: …", slice 7b's form). Whether D-51's stored review reason, which names the business key, needs anything.
- **Q8. The attribute side.** The business key suggestion on attributes (slice 1a's wording names the business key): which name it shows after a rename; whether creating an attribute from a column copies personal data today, and from which flag.
- **Q9. The reading's inputs.** Whether the table panel has the source relationships, `not_needed`, `retired_since` and `missing_since` at hand; whether the reading can be computed in the panel without a new load.
- **Q10. Earlier tests and docs.** Specs that change (slice 1a's column panel, slice 7a's P11 warning and review, slice 7b's business key change, the element-count baseline), and the known limitations this slice touches.

## 8. Differences from the prototype (deliberate)

- Built-in classifications can be renamed, removed and restored (P1); the prototype fixes them.
- Effective date is general, not Data Vault (P2).
- Classifications are rows and links (AD-18), not code arrays on the objects.
- Removing a classification shows its impact and the rules that stop, and is one undo step (D-47); the prototype asks with `confirm()`.
- Notes are rich text, saved the app's way (AD-17); the prototype has a plain text field.
- Hand-typed column comments move into notes in the upgrade (P9).
- Data Vault values in a file are marked in the review while the mode is off (P5); the prototype reads them silently.
- Switching Data Vault mode off says how many classifications stay stored.
- The suggestions' choices are part of the plan's fingerprint (slice 7a, P8).
- The Data Vault reading also leaves out retired and not needed columns.
- Every write follows the app's roles, archive and change log; the prototype has one permission check.

## 9. Left for later

- **The data model slice (last):** whether attributes get classifications too (then `attribute.is_business_key` and `is_pii` become links and AD-28 a suggestion of the Business key classification); one pattern for `requirement_link`, `label_link` and `classification_link`; baselines and export with classifications; indexes at enterprise scale.
- **Ideas (`docs/ideas.md`):** built-in names per the workspace's documentation language; a `table_classifications` column in the source standard; Data Vault hints in the entity panel (the prototype's `dvSection`, P12); readings that use Link candidate and Satellite source, which the prototype lists but does not read; own classifications with a code, so a file can name them by code.

## 10. Docs in this PR

- **`docs/decisions.md`** (only with Łukasz's approval of the quoted text, step 3): a new D-entry "Classifications and notes" with P1–P11; D-55 (the import reads the whole list and suggests, the comment read-only); D-56 and D-51 (rules read the Business key classification); AD-08 (the Data Vault reading); AD-28 (suggested from the Business key classification).
- **`docs/data-model-v2.md`:** `classification`, `classification_link`, `note_html`/`note_text` on `source_table` and `source_column`, the dropped flags, the upgrade.
- **`supabase/migrations/`:** one new migration, DDL only, RLS on the new tables.
- **`docs/inventory-prototype-vs-app.md`:** "Sources" lists nothing missing but the ideas of section 9.
- **`docs/known-limitations.md`:** what steps 1–5 find.
- **`docs/ideas.md`:** section 9's ideas.
- **README and CLAUDE.md:** the slice's status; classifications in "What this is"; a short note on the classification index and the codes the rules read; new helpers and the bench line.
