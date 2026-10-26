# Slice 7c – Acceptance

Status: **step 2 (the domain).** Branch `slice/07c-classifications`, from `main` at `408c3c0` (tag `slice-07b`). PRD:
`docs/prd/slice-07c-classifications.md`. The PRD stays as written; this file is its amendment.

## Łukasz's answers to step 1 (26 October 2026)

The principle stays: the modeller stays in control and sees what will happen before it happens; nothing changes
silently; everything can be undone. Any recommendation that conflicts with it is not applied but listed.

- **F1, F3:** yes. Rules read codes only (one domain module of codes). Texts about a rule keep naming the role
  ("business key"); only the dialog, the panels, the chips and the review show a classification's current name. One
  "what stops" text per built-in classification that a rule reads, all listed in step 2's report for approval. Built-ins
  no rule reads get no extra text.
- **F2:** yes. P11, item 6, item 10 and S7C-02/06 read as "the BK badge on source rows" (from the index) and "the PII
  badge on attribute rows" (unchanged).
- **F4:** relative bars: a classification toggle adds the same canvas commits as slice-07b's flag toggle, measured on
  both tags; the BK toggle shows the badge on its row. No new per-card counter. To `docs/ideas.md`: a panel-only write
  that does not redraw the canvas.
- **F14:** the built-in `PII`'s default name is **"Personal data"** (code `PII`), so a file's "PII" and "Personal data"
  both match and the panel label stays. A difference from the prototype (section 8's list below).
- **F7:** notes are plain text like the mapping's note (`plainTextPair` into `note_html`/`note_text`, a text area saved
  on blur, the PRD's toasts). S7C-07 checks that markup is stored escaped. To `docs/ideas.md`: rich text for all notes at
  once (mappings, tables, columns).
- **F16:** count uses (links of Data Vault classifications). **F17:** the new settings text as proposed.
- **Q7:** yes. Column-level business key changes settle with "Settled: {column} is no longer a business key" and
  "Settled: the classification {name} was removed"; undo reopens them. Mapping-level changes stay open.
- **Q8:** the attribute suggestion's text stays as it is.
- **Q4:** the upgrade's report as a file in `.data/` plus one log line, column paths only; every move is also a change
  event.
- **F9–F13:** all as proposed: matching in the plan; names unique against names and codes per scope, removed built-ins
  included; restore refused while its name is taken, with the proposed text; the fingerprint's additions; the business
  key suggestion also checks live stored columns; one warning per value and table, and the
  table-classification-on-a-column warning.
- **F15:** `seed:large` without BK links; the element guard stays "equal to slice-07b".
- **F8:** "Create attribute from column" keeps copying only the source's comment; the note is not copied.
- **F5, F6, F18–F22:** accepted as recommended. F6: one line in `docs/known-limitations.md`.
- **For the data model slice (PRD section 9's list):** F5 (moving the flags' data and seeding the built-in rows in a
  real database) and F20 (`origin` carries both "built-in or own" and the group).

### Section 8's differences from the prototype, amended

- The built-in `PII` is named "Personal data" (the app's panel label since slice 1a); the prototype names it "PII". A
  file's "PII" (the code) and "Personal data" (the name) both match.

### The recommendations checked against the principle

None of the accepted recommendations conflicts with it. Four come close and hold as follows:

1. **Q4, moving hand-typed comments in the upgrade** is no undo step (as slice 7b's derivation): it is not a person's
   action. Every move is a change event in the upgrade's change group and listed in the report; nothing is lost (the
   text moves into the note, which was empty).
2. **F6:** undo steps recorded before the upgrade that touch a column are refused ("changed afterwards"). Nothing wrong
   is written; the history lives in server memory and is empty after a restart anyway. Known-limitations says so.
3. **F18:** a deleted table's or column's classification links go with it without being listed in the delete form; the
   delete is one undo step and undoing it brings them back.
4. **F10:** a restore whose name is taken is refused with a message saying why; nothing happens silently.

## Step 1: start checks (26 October 2026)

- The working tree was clean on `main`; `main` equals `origin/main` after a fetch (`408c3c0`, the merge of PR #20).
- The tag `slice-07b` exists and points at `408c3c0`, main's merge of slice 7b.
- Branch `slice/07c-classifications` created from `slice-07b`; the PRD copied from `~/Downloads` and committed on its own
  (`289a2e9`, "docs: slice 7c PRD").
- Baseline: `npm run lint` passes, `npm run typecheck` passes, `npm test` passes (93 files, 1,242 tests). About 2 minutes
  for the three.

## Step 1: answers to Q1–Q10

### Q1. Readers of the old flags

Every place that reads or writes `source_column.is_business_key` or `is_pii` (`attribute.is_business_key` and `is_pii`
stay, P3, and are left out):

| Where | What it does | After 7c |
| --- | --- | --- |
| `src/domain/types.ts` `SourceColumn` | the two fields | dropped |
| `supabase/migrations/20261002000000_initial_schema.sql` (source_column) | the two columns | dropped by the new migration |
| `src/domain/commands/source.ts` `createSourceTable` | writes `false, false` on new columns | nothing |
| `src/domain/commands/source.ts` `updateSourceColumn` | `isBusinessKey`, `isPii`, `comment` | loses all three (P9): `comment` goes; the flags become link commands; the note is new (F7) |
| `src/domain/commands/attribute.ts` `createAttributeFromColumn` (line 270) | copies `is_pii` from the column to the new attribute | reads the `PII` code from the index (Q8) |
| `src/domain/model/mapping-rules.ts` `suggestsBusinessKey` | AD-28: the attribute panel's suggestion | takes "is the column a `BK`" from the index |
| `src/app/_panels/model-index.ts` `businessKeyHint` | the columns named in the suggestion | reads the index (built in `ModelIndex`, once per model) |
| `src/app/_panels/attribute-panel.tsx` (note-bk-suggestion) | the suggestion's text | unchanged text (Q8) |
| `src/app/_panels/source-panels.tsx` `SourceColumnPanel` | the "Flags" field (Business key, Personal data) and the editable "Comment" | the Classifications section, the read-only comment, the Note |
| `src/canvas/card-data.ts` `buildCards` (line 236) | a source row's `bk` | reads the index; **a source row's `pii` is always `false` today** (F2) |
| `src/canvas/CardNode.tsx`, `src/canvas/text-fit.ts`, `src/domain/model/card-size.ts` `rowShown` | the BK badge, the row's clip width, the Keys filter (`pk \|\| fk \|\| bk`) | unchanged: they read `CardRow.bk`, which `buildCards` fills |
| `src/domain/import/standard.ts` | reads `BK`/`PII` (and `businesskey`, `personaldata`) into two booleans; `NOT_READ_YET` for the rest | keeps the file's values raw; matching moves to the plan (F9) |
| `src/domain/import/plan.ts` `classificationNote` | "The file says …" only when BK or PII differ | compares the matched set with the column's links |
| `src/domain/import/plan.ts` line 523 | the business key change without a mapping (D-56) | reads the index |
| `src/domain/import/plan.ts` `mappingImpacts` line 710 | D-51's send-back for a business key column that changed type | reads the index |
| `src/domain/import/apply.ts` `NewColumnRow` | writes the file's two flags on a new column | writes links (the file's matched classifications and the ticked suggestions) |
| `src/domain/import/compare.ts` `planDigest` | `newColumn(c.file)` carries the two booleans | carries the matched classification ids and the suggestions (F11) |
| `src/app/_panels/import/review-step.tsx` lines 85–86 | "Business key" and "PII" chips on a new column | classification chips |
| `src/data/local/seed-model.ts` | `BK`/`PII` flags of the demo | links |
| `src/data/local/seed-large.ts`, `src/domain/model/requirement-index-synthetic.ts` | `false, false` | nothing (F15 for `seed:large`'s classifications) |
| `src/domain/__fixtures__/domain.ts`, `src/domain/__fixtures__/import.ts` | test rows | links in the fixtures |
| unit tests | `attribute.test.ts`, `source.test.ts`, `plan.test.ts`, `standard.test.ts`, `import.test.ts`, `compare.test.ts`, `mapping-rules.test.ts`, `model-store.test.ts`, `model-index.test.ts`, `canvas.test.ts`, `labels.test.ts`, `text-fit.test.ts` | updated |
| e2e | `e2e/slice-07a/S7A-07.spec.ts` (reads `is_pii` from the data file), `S7A-01.spec.ts` (the "not read yet" warning) | Q10 |

Not readers: `src/domain/source-changes/` (`derive.ts` reads the stored `review_reason` prefix "business key column
changed type, ", `consistency.ts`, `touched.ts`, `settle.ts`), `src/domain/commands/live.ts` (the working context never
labels sources, D-26; classification writes do not touch live canvases), the system panel, the tree, the Sources tab.

**On the canvas's render path:** none. The flags are read once on the server in `buildCards` (the canvas page's server
component); the client only reads `CardRow.bk`. Moving `buildCards` to the index adds one pass over the links per page
render (a `Set` of `BK` column ids), linear in the links. Nothing changes in `CardNode`, `text-fit` or `rowShown`.

**Cost of moving each:** small in the code (about 20 files, most of them one line), larger in the tests: every fixture
that builds a `SourceColumn` loses two fields, and the tests that set BK through `updateSourceColumn` set a link instead.
The index itself is a domain module (`src/domain/model/classifications.ts`: the list by id and by code, the codes per
table and per column), built where the model is: `ModelIndex` on the client, `buildCards` and the import's state on the
server.

### Q2. Where the panels live, and undo

- The table and column panels (`SourceTablePanel`, `SourceColumnPanel`) are drawn only by the `Inspector`, which only the
  canvas page mounts (`src/app/w/[workspaceId]/p/[projectId]/c/[canvasId]/page.tsx`, line 224). They open from a card
  or row on the canvas, from the left panel (Model tree, Sources tab), from go-to links in other panels, and on arrival
  with `?row=` / `?system=` (slice 7b, model consistency). The project home and the workspace page have no panels.
- So every place a panel opens has undo. A write is an undo step when all its change events are on tables in
  `UNDOABLE_TABLES` (`src/domain/commands/undo.ts`, `isUndoable`; `remember` in `src/app/_lib/run-command.ts`). D-29's
  "no undo outside canvases" does not apply.
- The dialog opens from the panels, so it lives on the canvas page too, with undo. "Edit the list…" can be offered in both
  panels, as the PRD says. No other place is needed.
- **Code that 7c needs:** `classification` and `classification_link` added to `UNDOABLE_TABLES` and to `PARENTS`
  (`classification_link` → `classification`, `source_table`, `source_column`), so the undo's consistency check refuses a
  link to a deleted classification or object (F6). The undo button's label (`changeLabel`,
  `src/domain/model/change-label.ts`) needs texts for the new steps ("Set {classification} on {column}", "Remove
  classification {name}" …), listed in step 2.
- **Data Vault mode** is a workspace setting (`workspace.dv2_mode`, `updateWorkspaceSettings`,
  `src/domain/commands/workspace.ts`), switched on the workspace page
  (`src/app/w/[workspaceId]/_components/settings-form.tsx`), outside undo (settings are, `isUndoable`). The canvas page
  loads the workspace but does not pass `dv2_mode` to the panels or the wizard today; 7c passes it (the panel context and
  `ImportData`).

### Q3. Making workspaces

| Path | Where | The 19 rows |
| --- | --- | --- |
| "New workspace" | `createWorkspace` (`src/domain/commands/workspace.ts`), server action in `src/app/_actions/workspace.ts` | in the same write set (one change group; the group is not an undo step because it writes `workspace`, which is outside undo) |
| The demo seed | `src/data/local/seed.ts` `workspace()` (Retail Co – DWH, Bank X – Risk DWH, Sales analytics) | written by the helper; rows only, the seed writes no change events (as for every seeded row) |
| `seed:large` | `src/data/local/seed-large.ts` (Performance test) | written there |
| e2e | `e2e/*/fixtures.ts` reseed `.data/e2e-db.json` through `seed.ts` | by the seed |
| unit tests | `src/domain/__fixtures__/domain.ts` (`workspace` fixture) | a helper `builtinClassifications(workspaceId)` |

No copy of a workspace exists (`grep` for copy/duplicate/clone finds none). One domain function makes the 19 rows
(`builtinClassifications(ctx, workspaceId)`); every path above calls it, so the list is in one place.

- **The local data file's next format is 8** (`DEV_DB_FORMAT` in `src/data/local/schema.ts`; the upgrade chain in
  `upgradeDb`, `src/data/local/file.ts`). The step 7 → 8 adds the two tables, writes the 19 rows per workspace, turns
  the flags into links, drops the two fields, adds `note_html`/`note_text` (null) to tables and columns and moves P9's
  comments (Q4). Like 7b's derivation: one change group per workspace, its events signed by the workspace's creator,
  no undo step, and written back at once (`was < 8` in `loadDb`) so every later read sees the same ids.
- The local adapter's rules (`RULES` in `src/data/local/schema.ts`) get the two tables: unique `code` per workspace,
  unique `name_key` per workspace and scope (live rows), one link per classification and object (live rows), exactly
  one target on a link.
- **The migration** (`supabase/migrations/20261026xxxxxx_classifications.sql`): the two tables with RLS on, their
  indexes and checks (`scope`, `origin`, exactly one target), `note_html`/`note_text` on `source_table` and
  `source_column`, and `alter table source_column drop column is_business_key, drop column is_pii`. DDL only, as the PRD
  says; the domain's tables in `tests/schema/domain-tables.ts` follow, so `npm run schema:check` stays green (F5 on what
  "DDL only" leaves out).

### Q4. The comment (P9)

- **Can the change log tell?** Yes, for every column, with one rule. Every write of a column's comment has a change event
  with the column's after-image (AD-13). An import's change group always holds its `source_import` row (insert; an undo
  of an import holds its soft delete). A person's edit through `updateSourceColumn` never does. An undo or a redo of a
  person's edit holds no `source_import` either, but may put back a value an import wrote earlier.
  - **Rule:** a column's current comment came from an import when some change group with a `source_import` event wrote
    this exact value onto this column (an after-image whose `comment` equals it). Otherwise it was typed by hand and moves.
  - That rule gives the right answer after undo and redo, and for a comment an import wrote and a person later typed
    identically (it stays: the source said it).
  - Seeded rows have no events, but every seeded comment is `null` (demo and `seed:large`), so nothing to judge there.
  - Columns of a hand-made table (`createSourceTable` writes `comment: null`) have only hand-typed comments: slice 7a's
    answer 8 kept the field editable for exactly them.
- **The table's comment is not editable today:** there is no `updateSourceTable`; only an import writes
  `source_table.comment` (`apply.ts` line 144). Nothing moves for tables.
- **"New source table" writes no comments** (`createSourceTable`, `source.ts` lines 97 and 115).
- **The report (proposal):** the upgrade writes the list of moved comments to
  `.data/upgrade-8-<data file name>.txt` (git-ignored, beside the file) and prints one line to the server log ("Slice 7c
  upgrade: moved 3 hand-typed column comments into notes; see .data/upgrade-8-dev-db.txt"). The list names each column
  by `system / database.schema.table.column`, **never the comment's text** (CLAUDE.md: never log rich-text content).
  Each move is also a change event in the upgrade's change group, so the column's history shows it. An empty list says
  so.
- A moved comment goes into an empty note only (a fresh file has no notes); the comment is cleared. `createAttributeFromColumn`
  copies the column's comment into the new attribute's definition (`attribute.ts`, `plainTextPair(column.row.comment)`);
  after 7c it copies only what the source said. I keep that and do not copy the note (F8).

### Q5. The note's editor (P8)

- The mapping's note is **plain text**, not the rich-text editor: a `TextArea` saved on blur (`mapping-panel.tsx`, line
  360), sent as `note` to `updateMapping`, stored with `plainTextPair` (`src/domain/model/plain-text.ts`): `note_text` is
  the text, `note_html` the escaped paragraphs. Nothing to sanitize: the server never takes HTML from the browser for it.
  Its save shows no toast.
- The same works in the source panels unchanged: `TextArea` is in `src/app/_panels/fields.tsx`; a command per object
  (`setSourceTableNote`, `setSourceColumnNote`, or a `note` field on the two update commands) stores with `plainTextPair`.
- This contradicts the PRD's section 8 ("Notes are rich text … the prototype has a plain text field") and S7C-07 ("the
  HTML sanitized on the server"). See F7.

### Q6. The import's inputs

- **Today:** the wizard reads the text in the browser (`readStandard` / `readDdl`, `import-wizard.tsx`), builds the plan
  with `buildPlan(importStateOf(data.model, data.changes).model, read, target, choices)` and sends the text, the target,
  the channel, the vendor, the DDL fields, the scope, the compare choice, the renames and `planFingerprint(plan)` to
  `POST /w/{workspace}/import` (`src/app/_lib/import-sources.ts` → `importSources`, `src/domain/commands/import.ts`).
  The server reads and plans again from the workspace's live model and refuses when the fingerprint differs (P8,
  `STALE_REVIEW`); the wizard then shows the rebuilt review with `keptChoices`.
- **The list's way in:** `WorkspaceModel` gets `classifications` and `classificationLinks` (loaded by `store.model.load`,
  so the canvas page, the wizard's `data.model`, the server's import state and the settlement pass all have them without a
  new load). `ImportModel` gets the same two arrays (or the built index); `buildPlan` matches the file's values against
  the live column classifications and reads the column's links for the business key rules.
- **The reader stays list-free** (F9): `readStandard` keeps each column's classification values as written (with the
  row), and the plan matches them. Otherwise the reader would need the list as an input, `bench-import-read.ts` would
  change meaning, and the reader would run twice per list change.
- **The suggestions' choices:** `PlanChoices` gets `hintsOff` (the unticked suggestion ids, `{tableKey}|{column}|{code}`
  as in the prototype); the upload route's input gets `hintsOff: string[]`; `keptChoices` keeps the ids still offered.
  `dv2` is not sent: the server reads `access.workspace.dv2_mode` (the browser has the same value from the page).
- **An own name equal to a built-in code of another scope** (an own table classification named "BK"): matching is per
  scope (column classifications only, P6), so it never matches a file value. **An own column name equal to a column
  code** ("LK" as an own column classification's name) would make a value match two classifications. Proposal (F10):
  a name is taken when its `norm` equals the `norm` of the name **or code** of any other classification of the same
  scope, removed built-in ones included (their code stays theirs). Then one value matches at most one classification.

### Q7. Settling changes (and every rule that reads the business key or personal data)

**Open changes to resolve that a business key decides.** Two kinds exist (slice 7b):

1. `business_key_changed` **without a mapping** (`mapping_id` null; plan.ts line 523): "Business key column changed type,
   {before} → {after}. Hash keys built on it change too." Its only action is "Noted". When the column stops being a
   business key, its question no longer applies.
   - **Column loses Business key (toggle):** settle it in the toggle's change group: "Settled: {column} is no longer a
     business key".
   - **Business key removed from the list:** settle every such open change in the removal's change group: "Settled:
     the classification {name} was removed". Undoing the removal reopens them (their before-images are in the group).
   - **Restored, or set again later:** they stay settled (a restore brings the classification back empty, P1).
   - Implementation: a rule in `settleAfterWrites` (`src/domain/source-changes/settle.ts`), which already runs after
     every command in the same group; it needs the classification of each removed link (`SettleNames` gets the list).
2. `business_key_changed` **on a mapping** (a mapping the import sent back; `review_reason` "business key column changed
   type, …"). Its question is the mapping's review ("Approve again", "Leave in review"), which stays valid: the import
   did send an approved mapping back, and the stored reason says why at the time. **Proposal: nothing settles.** D-51's
   stored `review_reason` needs nothing: it is history, in English, and does not name the classification (renaming
   Business key does not touch it; `derive.ts` reads its fixed prefix).

**Every rule that reads Business key, and what removing or restoring the classification means:**

| Rule (code) | Business key removed | Restored (empty) | Restored and set again |
| --- | --- | --- | --- |
| AD-28 suggestion on attributes (`suggestsBusinessKey`, `businessKeyHint`) | no suggestion | none (no column has it) | works |
| D-51 send-back on a type change (`mappingImpacts`) | an approved mapping goes back only for a type conflict or a rewritten rule | same | works |
| D-56 "Business key column changed" without a mapping (`buildPlan` raises) | not raised; open ones settle (above) | not raised | raised again by the next import |
| The import's suggestion (P7) | not offered ("a suggestion needs its classification in the list") | offered again | offered |
| The file's `BK` / "Business key" values | unknown, warned and ignored | read again | read |
| The Keys row filter (`rowShown`) | source rows by PK and FK only; an attribute row's BK (the attribute flag) still counts | same | works |
| The BK badge | gone on **source** rows only; attribute rows keep theirs (`attribute.is_business_key`, P3) | none | back |
| The Data Vault reading's Hub line | absent; "Marked as a hub candidate, but no column is a business key yet" when `T_HUB` | same | back |

**Personal data (`PII`)** has fewer readers than the PRD implies:

| Rule | PII removed | Restored |
| --- | --- | --- |
| "Create attribute from column" copies personal data (`createAttributeFromColumn`) | the new attribute gets `is_pii: false` | copies again once set |
| The Data Vault reading's separate PII satellite | absent | back once set |
| The file's `PII` values, the review's chips | unknown, warned and ignored | read |
| A PII badge on source rows | **none exists today** (F2) | – |

No change to resolve reads PII. The other built-ins: `LK` (the reading's Link line note, Link keys with no relationship,
the Link key suggestion), `DCK`, `DK`, `MAK`, `EFF` (one reading line each), `TECH`, `LDTS`, `RSRC` (left out of the
reading's satellite), `T_HUB` (the reading's hub candidate line). `T_MASTER`, `T_TXN`, `T_REF`, `T_STG`, `T_LOG`,
`T_HIST`, `T_LNK`, `T_SAT` are read by no rule (PRD section 9 notes `T_LNK`/`T_SAT`). Item 10's "what stops" text is
needed for every built-in with a reader, not only Business key (F3).

### Q8. The attribute side

- The suggestion's text (`attribute-panel.tsx`): "{columns} is/are marked as a business key in the source. Is {attribute}
  a business key too?" and "Mark as business key". It names the **attribute's** property (AD-28), which 7c does not
  rename. **Proposal:** keep the text as it is, also after a rename of the classification. Alternative: "{columns} is
  marked {classification name} in the source. Is {attribute} a business key too?"
- Creating an attribute from a column (`createAttributeFromColumn`, a drag onto an entity's header, slice 1b) copies
  personal data from `source_column.is_pii`; business key is never copied (`is_business_key: false`). After 7c it reads
  the column's `PII` code from the index; the business key stays uncopied (AD-28 suggests it instead).

### Q9. The reading's inputs

All at hand in the table panel, without a new load: `p.ix.columnsOf` (columns with `missing_since`, `retired_since`,
`not_needed`, `is_primary_key`, `is_foreign_key`), `p.ix.relationshipsOf` (the table's relationships both ways, with
`missing_since`), `p.ix.model.sourceRelationshipColumns` (the pairs), `p.ix.table` (the target's name). With the
classification index in `ModelIndex`, the reading is a pure domain function (`dataVaultReading(table, index)`, unit
tested) computed in the panel. Only `dv2_mode` has to reach the panel (Q2). Note the prototype also leaves primary and
foreign key columns out of the satellite (`desc = cols.filter(!keyish && !pk && !fk)`), which the PRD's item 21 does
not say; I follow the prototype.

### Q10. Earlier tests and docs

- **e2e that change:** `e2e/slice-07a/S7A-01.spec.ts` (asserts the "not read yet" warning for TECH; the CRM sample's
  TECH, "Effective date" and "Load date" are now read, so no warning); `S7A-07.spec.ts` (reads `is_pii` on a column from
  the data file: becomes a PII link). No e2e covers the column panel's flags, its comment field or the attribute's BK
  suggestion (slice 1a and 1b tested them in unit tests only). S7A-08, S7A-10, S7B-01, S7B-02, S7B-09, S7B-13 assert the
  business key send-back texts; they keep passing as long as the demo's `cust_no` keeps its BK link (the upgrade and the
  seed).
- **The element-count baseline:** `S3B-15-elements.spec.ts` with `ELEMENTS_BASELINE` from `slice-07b`; equal only if
  `seed:large` gains no BK link (F15).
- **Known limitations this slice touches** (`docs/known-limitations.md`): "An import's undo: all or nothing" names "a
  business key set" as a later change that blocks an import's undo. With links, setting a classification on a column
  the import only updated no longer touches the column row, so it no longer blocks; on a column the import created, the
  undo is still refused (a live link would point to a deleted column). The text changes in step 6. "The PII tag"'s
  contrast row stays (attribute rows).
- **Docs that name the flags:** `docs/data-model-v2.md` (attribute and `source_column`), D-55 ("the comment stays
  editable"), slice 7a's answer 8, `docs/inventory-prototype-vs-app.md` ("Sources": 7c's items).

## Step 1: findings from the critical review

**F1. P1 removes rules silently unless the code reads codes everywhere, including the change texts.** Codes must be the
only thing rules read: `BK`, `PII`, `LK`, `DCK`, `DK`, `MAK`, `EFF`, `TECH`, `LDTS`, `RSRC`, `T_HUB`. The texts that name
the business key stay English constants about the role, not the classification's name: D-56's title "Business key column
changed", the detail "Business key column changed type …", D-51's reason, the attribute suggestion (Q8). *Proposal:*
codes in one domain module (`CLASSIFICATION_CODES`), rules read `has(columnId, "BK")`; texts keep the words "business
key" (they describe what the rule is about), and only the dialog, the panels, the chips and the review show the
classification's current name.

**F2. There is no PII badge on source rows.** `buildCards` sets `pii: false` on every source row (`card-data.ts`, line
235); the PII badge is drawn only on **attribute** rows from `attribute.is_pii`. The prototype does the same (source rows
show only BK, line 1699; attributes show PII, line 1687). P11, item 6, S7C-02 and S7C-06 say rows "keep the BK and PII
badges". *Proposal:* read them as "the BK badge on source rows" (from the index) and "the PII badge on attribute rows"
(unchanged, P3). Toggling PII on a column changes nothing on the canvas. Item 10's text for Business key should say
"…or show the BK badge on source rows".

**F3. Item 10 names the stopped rules only for Business key.** Personal data, Link key, Dependent child key, Driving key,
Multi-active key, Effective date, Technical / audit, Load date, Record source and Hub candidate are read too (Q7).
*Proposal:* one text per built-in with readers, listed in step 2 for approval, e.g. PII: "Without it, the app no longer
copies personal data to attributes created from a column or shows a separate personal data satellite in the Data Vault
reading." Built-ins with no reader say nothing extra.

**F4. The section 6 bars "no canvas commit" and "that card only" cannot be met as written.** Every server action
refreshes the page; the canvas page builds the cards on the server, and `ModelCanvas` receives a new `cards` array after
**any** write, which is a commit (`__imCanvasCommits` counts every render, `ModelCanvas.tsx` line 346; the merge in the
effect at line 605 rebuilds the nodes). Today's flag toggle in the column panel already commits the canvas. *Proposal:*
the bar is relative: a classification toggle adds the same canvas commits as slice-07b's flag toggle (`updateSourceColumn`,
measured on both tags), and the BK toggle shows the badge on the row. A per-card render count would need a new dev
counter in `CardNode` (application code for a test); not proposed unless you want it.

**F5. "DDL only" drops two columns' data in a real database.** The migration drops `is_business_key`/`is_pii` without
moving them into links, and writes no built-in rows. That is fine today: no database holds data (AD-31, the database
slice is last) and the local upgrade does the moving. *Proposal:* keep the migration DDL only and say in its header
comment that the data move is the local upgrade's (step 7 → 8) and that the database slice seeds the built-in rows per
workspace. Listed for the data model review (section 9).

**F6. Undo needs the new tables in its rules, and old steps on columns are refused after the upgrade.** (a)
`UNDOABLE_TABLES`, `PARENTS`, `WorkspaceRows`, `changeLabel` (Q2). (b) The undo history lives in server memory; a step
recorded before the upgrade that touched a column carries `is_business_key`/`is_pii` in its images, so
`unchangedSince` sees a difference and refuses it ("changed afterwards"). Safe (nothing wrong is written back), and the
history is empty after a restart anyway. *Proposal:* accept, one line in known-limitations.

**F7. Notes: plain text, as the mapping's note, not rich text.** PRD section 8 and S7C-07 say rich text with server-side
sanitizing; item 15 and P8 say "saved as the app saves a mapping's note", which is plain text (Q5). The prototype is plain
text too. *Proposal:* plain text through `plainTextPair` into `note_html`/`note_text` (AD-17's pair, as mappings do), a
`TextArea` saved on blur, the PRD's toasts; S7C-07 checks that markup typed into a note is stored escaped, not
sanitized HTML. Rich text (Tiptap, `RichTextField`) would be a bigger panel and an editor per column; if you want it,
say so and step 4 grows.

**F8. "Create attribute from column" copies the comment.** It fills the new attribute's definition from
`source_column.comment` (`attribute.ts`). After P9 the comment is only the source's. *Proposal:* unchanged (the source's
comment), the note is not copied. Ask if the note should be copied when there is no comment.

**F9. Matching belongs in the plan, not the reader.** P6 and item 18 put the list into "the standard's reader". The reader
runs in the browser on every file drop and again on the server; the list is workspace data. *Proposal:* `readStandard`
keeps each value as written with its row (as today's `classifications`, plus the line), drops `NOT_READ_YET`, the two
booleans and the `personaldata` alias; `buildPlan` matches with `norm`, raises the unknown-value warnings, and the plan
carries each new column's matched classification ids. `bench-import-read.ts` keeps measuring only reading.

**F10. Name collisions.** Item 8's rule compares names only. With codes matched too, an own column classification named
"LK" or a built-in renamed to "PII" would make a file value ambiguous; restoring a removed built-in whose name an own
classification took meanwhile would break `name_key`'s uniqueness. *Proposal:* "That name is taken" when the `norm` of
the new name equals the name or code of any other classification of the same scope, removed built-ins included; a
removed built-in whose name is taken cannot be restored until the other is renamed: "Rename {other} first: {name} is
taken." (Restore is then refused with that text.)

**F11. The fingerprint needs more than the list.** Classification links are separate rows, so a toggle does not change
the column's version, which is what `planDigest` records for existing rows (`row(c.existing)`). The business key rules
already reach the digest through `raises` and `mappings`. Missing: the matched classifications of new columns, the "file
says" sets, the suggestions with their tick state, and the unknown-value warnings (warnings are in it already). *Proposal:*
the digest records, per column, the matched classification ids, the file-says set, and `plan.hints` with whether each is
off. S7C-11's "changing the list … refreshes the review" then holds whenever the change alters what the import writes or
shows (7a's P8 principle: an edit elsewhere does not refresh it). A rename of a classification the file names by code
does not refresh; one it names by the old name does (the value becomes unknown).

**F12. The Business key suggestion checks the file only in the prototype.** `buildPlan`'s hints use
`!tp.file.cols.some(x => x.classes.includes("BK"))`: a new column in an existing table whose stored columns already have
a Business key (set by hand) is still suggested. *Proposal:* "the table has no business key" = no column of the file
**and** no live stored column of the table has `BK`.

**F13. One warning per row is too many.** Item 18's text is per row ("Row {n}: …"). A file with an unknown value on every
row of a 20,000-row file gives 20,000 warnings. 7a deduplicated per table and value. *Proposal:* one warning per value
and table: "Unknown classification “{value}” on {schema}.{table} (row {n}; {k} more rows), ignored. Add it under
Classifications to use it." A value that names a **table** classification on a column: "“{value}” is a table
classification; ignored on {schema}.{table}.{column}." (P6: column classifications only.)

**F14. "Personal data" in a file.** 7a's reader reads "Personal data" as PII (7a acceptance, open point 2: the column
panel calls the flag "Personal data"). Under P6 only the code or the current name match, and the built-in's default name
is "PII" (prototype). A file saying "Personal data" would become unknown. *Proposal:* the default name stays "PII"
(prototype, item 1), and the alias goes; the warning tells the modeller to rename or add. Alternative: default name
"Personal data" (the app's current panel label), so both still match. Question 4.

**F15. `seed:large` and the element guard.** Item 22 classifies `seed:large`'s tables for the index at size. A BK link on
a placed column adds a `span.tag.bk` to the viewport, and S7C-14's guard against `slice-07b` would fail. *Proposal:*
`seed:large` gets classifications without a canvas mark (PII, TECH, LDTS and the Data Vault ones) on 10 % of its columns
and `T_*` on its tables; no BK. The index's size figure uses a synthetic model in the bench (section 6 plan).

**F16. Item 17 counts what?** "{n} Data Vault classifications stay stored": the classification rows (always 9 unless
removed) or their uses? *Proposal:* the uses (links of Data Vault classifications): "Data Vault 2.0 mode is off. 14 Data
Vault classifications on tables and columns stay stored and show again when the mode is on." The workspace page already
loads the model (`page.tsx` line 32), so the count is at hand for the settings form.

**F17. The settings text names entity panels.** "The Data Vault 2.0 mode adds hints (hubs, business keys, satellites by
source) to entity panels" (settings form and prototype), but P12 leaves entity panel hints out and 7c adds the reading to
table panels. *Proposal:* "The Data Vault 2.0 mode adds Data Vault classifications and a Data Vault reading to source
table panels (hubs, links, satellites); nothing is generated or enforced." Question 6.

**F18. Cascades must take the links.** Deleting a source table or column (`deleteSourceTable`, the change's "Delete…",
the shared cascade in `src/domain/source-changes/delete.ts`) soft-deletes label links today; classification links must go
the same way, or the undo consistency check and the index see links to deleted objects. *Proposal:* add them to the
cascade, not listed in the delete form (they are the object's own metadata, like its note).

**F19. A toggle restores or inserts?** Setting a classification removed earlier from the same column: a new link row, or
the soft-deleted one back? *Proposal:* a new row (as label links), unique among live rows; undo puts back the exact rows.

**F20. The PRD's `origin` mixes two things.** `origin` (`builtin`, `data_vault`, `own`) carries both "built in or own"
and "which group". With EFF moved, the group is a fact of the built-in list. *Proposal:* keep `origin` as the PRD has it
(three values, one CHECK); the group is `origin`. It is small and leaves the review slice room. Mentioned only.

**F21. Who adds and removes when `dv2_mode` is off.** P5 hides Data Vault classifications in the panels; the dialog shows
them with their chip (item 7). *Proposal:* the dialog always shows them (renaming and removing them works with the mode
off), the panels and the review follow P5.

**F22. Item 13's place in the panels.** The app's column panel order is facts, missing, not needed, Flags, Comment,
Feeds, Labels, Requirements, Map to; the table panel's is facts, missing, To resolve, Labels, Columns, Relationships,
Feeds entities, Requirements, notes, canvases, frame, actions. *Proposal:* column panel: "From the source:" after the
facts (as the table panel), Classifications and Note where Flags and Comment stand; table panel: Classifications and Note
after Labels, before "Columns and where they go" (the prototype's order: they open `sourceBody`); "Data Vault reading"
after "Relationships between source tables" (item 21).

## Differences between the reference prototype and the app that the slice touches

| Area | Prototype | App today | 7c |
| --- | --- | --- | --- |
| Built-in classifications | fixed; rename and remove only own ones | two flags | every one renamed, removed, restored (P1, deliberate) |
| Effective date | Data Vault group | – | General (P2, deliberate) |
| Storage | code arrays on objects (`classes`, `tags`) | two booleans | rows and links (AD-18, deliberate) |
| Own classification's code | `X_{NAME}_{time}` | – | none (null); matched by name only (section 9 idea) |
| Column panel | "Classifications" toggles in three groups, "Yours: a re-import never changes them.", "Edit the list…", Note | "Flags": Business key, Personal data; editable Comment | as the prototype; comment read-only (P9) |
| Table panel | Classifications, Note, columns, relationships, Data Vault reading | no classifications, no note | as the prototype, in the app's order (F22) |
| PII label | "PII" | "Personal data" (column panel, attribute badge's title) | the built-in's name "Personal data", code `PII` (answer F14) |
| Notes | plain textarea, saved on change, toast | – | plain text as mappings (F7), toast |
| Remove with uses | `confirm("… is used n×")` | – | impact form with uses and stopped rules (D-47, deliberate) |
| The list dialog | built-ins as plain text | – | every name an input |
| The review's chips | Data Vault chips hidden with the mode off | "Business key", "PII" | marked "hidden while Data Vault 2.0 mode is off" (P5, deliberate) |
| Suggestions | from the file only; not fingerprinted | – | file and stored columns (F12); fingerprinted (deliberate) |
| Unknown file values | ignored silently (`classOf` undefined) | "not read yet" warning | one warning per value and table (F13) |
| "Personal data" in a file | not matched | matched (7a) | not matched unless named so (F14) |
| The Data Vault reading | leaves out missing columns | – | also retired and not needed (deliberate) |
| Data Vault mode text | "… to entity panels"; toast "see the hints in entity panels" | "… to entity panels"; "Data Vault 2.0 mode is on/off." | F17; the off message (item 17) |
| Entity panel hints (`dvSection`) | shown in the mode | – | not in 7c (P12) |
| Source rows' badges | BK only; PII on attributes | BK only; PII on attributes | unchanged (F2) |

## Docs plan (PRD section 10)

| Doc | What | When |
| --- | --- | --- |
| `docs/decisions.md` | new D-57 "Classifications and notes" (P1–P11 as answered); D-55: the import reads the whole list and suggests, the comment is read-only, notes are the modeller's; D-51 and D-56: the rules read the Business key classification by its code; AD-08: the Data Vault reading in table panels; AD-28: suggested from columns with the Business key classification. Texts quoted in step 3 for your approval | step 3 |
| `docs/data-model-v2.md` | `classification`, `classification_link`, `note_html`/`note_text` on `source_table` and `source_column`, the dropped flags, the upgrade's moving; the attribute's flags unchanged | step 3 |
| `supabase/migrations/` | one migration, DDL only, RLS on both tables (F5's comment) | step 3 |
| `docs/inventory-prototype-vs-app.md` | "Sources": only section 9's ideas left; the Model row keeps entity panel hints as decision only | step 6 |
| `docs/known-limitations.md` | the import's undo text (Q10), old undo steps after the upgrade (F6), what steps 2–5 find | step 6 |
| `docs/ideas.md` | section 9's ideas; F4's per-card counter if you decline it | step 6 |
| `README.md`, `CLAUDE.md` | status; classifications in "What this is"; the index and the codes rules read; new e2e helpers; the bench line | step 6 |
| `docs/prd/slice-07a-acceptance.md` | nothing (closed); answer 8 is superseded by D-55's new text | – |

## Plan for section 6's figures

| What | How | Bar |
| --- | --- | --- |
| Viewport elements | `S3B-15-elements.spec.ts`, `ELEMENTS_BASELINE` from `slice-07b`, on `seed:large` without BK links (F15) | equal |
| A classification toggle on the canvas page | the canvas commit counter, a non-BK toggle on this branch against a PII flag toggle on `slice-07b` (F4) | the same commits |
| Business key toggled on a placed column | the same against slice-07b's BK flag toggle; the BK badge on the row | the same commits |
| The classification index | in `bench-import-plan.ts` (no new script): built on 20,000 columns with 10 % classified, median of 5 | under 20 ms (expected well under: one pass over 2,000 links) |
| Planning an import | `bench-import-plan.ts` with a `classifications` column on 10 % of rows (names and codes, a few unknown) and the suggestions | within 10 % of `slice-07b` (both run in one sitting, as slice 7b did) |
| Writing an import | `bench-import-write.ts 20000` with the same file | within 10 % of `slice-07b` |
| Removing a classification used on 2,000 columns | a step added to `bench-import-write.ts` on its copy: classify 2,000, remove, through the local adapter | under 1 s, one change group |
| The data upgrade | `upgradeDb` timed on a format-7 copy of `seed:large` with flags set on 10 % | reported, not a gate |

Nothing new above the canvas: the panels' sections live in the details panel beside it, and the dialog is a modal
(`<dialog>`); none reads layout in a commit.

## Questions for Łukasz

1. **F1, F3: the "what stops" texts.** One per built-in with a reader (Q7's tables), approved in step 2?
2. **F2:** read P11 and S7C-02/06 as "BK on source rows, PII on attribute rows"?
3. **F4:** relative canvas bars (the same commits as slice-07b's flag toggle), or a new per-card dev counter?
4. **F14:** the built-in's default name "PII" (prototype; a file's "Personal data" becomes unknown) or "Personal data"
   (the app's label; both match)?
5. **F7:** notes as plain text like the mapping's note (S7C-07 checks escaping), or rich text?
6. **F17:** the new Data Vault mode text in the settings, and **F16**: count uses in the "mode off" message?
7. **Q7:** settle column-level business key changes when the column loses Business key or Business key is removed
   ("Settled: {column} is no longer a business key", "Settled: the classification {name} was removed"), and leave
   mapping-level ones open?
8. **Q8:** keep the attribute suggestion's text as it is after a rename?
9. **Q4:** the upgrade's report as a file in `.data/` plus one log line, column paths only?
10. **F9–F13:** matching in the plan; names unique against names and codes per scope; restore refused while its name is
    taken; the fingerprint's additions; the suggestion also checks stored columns; one warning per value and table?
11. **F15:** `seed:large` without BK links, so the element guard stays equal?
12. **F8:** "Create attribute from column" keeps copying only the source's comment?

The other findings (F5, F6, F10's details, F18–F22) are recommendations I apply unless you say otherwise.

## Step 2: the domain (26 October 2026)

Commits `71aa9c3` (the bench) and `45771f8` (the domain). Lint, typecheck and unit tests pass: 97 files, 1,299 tests
(56 new, 1,243 before).

### What changed

- **Codes and the built-in list** (`src/domain/model/classifications.ts`): `CLASSIFICATION_CODES`, the 19 built-in
  classifications (Effective date general; code `PII` named "Personal data", answer F14), `normClassification`, the name
  rule `nameTakenBy` (names and codes per scope, removed built-ins' codes included, F10), `fitsScope`, the panels'
  groups, the "what stops" texts (`WHAT_STOPS`, F3), the Data Vault mode texts (F16, F17) and **the index**:
  `classificationIndex(list, links)` → `of(id)`, `has(id, code)`, `linkOf`, `uses`, built once per load (P11).
- **Types** (`src/domain/types.ts`): `Classification`, `ClassificationLink`, `note_html`/`note_text` on `SourceTable` and
  `SourceColumn`, both tables in `WritableRows` and `WorkspaceModel` (`classifications` with removed rows, live links).
- **Commands** (`src/domain/commands/classification.ts`): `addClassification`, `renameClassification`,
  `classificationImpact` (uses, what stops, the business key changes that settle) and `removeClassification`,
  `restoreClassification`, `setClassification` (one toggle; set again is a new row, F19), `linksOnSources`.
  `setSourceNote` in `source.ts` (plain text through `plainTextPair`, F7; the two toasts). `createWorkspace` writes the
  19 rows in its change group (item 4).
- **Cascade** (F18): `sourceDeleteEdits` (`source-changes/delete.ts`) soft-deletes the classification links of a deleted
  table and its columns; `deleteSourceTable` and the change's "Delete…" pass them.
- **Settlements** (Q7, `source-changes/settle.ts`): `settleAfterWrites` settles an open business key change without a
  mapping when its column loses Business key ("Settled: {column} is no longer a business key") or Business key is
  removed ("Settled: the classification {name} was removed"); a deleted column settles by its deletion first; mapping
  changes stay open. `businessKeySettlements` counts them for the removal form.
- **Undo** (`commands/undo.ts`): both tables are undo steps, `classification_link`'s parents are checked, and an undo that
  would bring back a classification whose name another one has now is refused (new text below). Undo labels in
  `model/change-label.ts`.
- **Every domain reader of the old flags switched**: `suggestsBusinessKey` (AD-28) takes column ids and the index;
  `createAttributeFromColumn` copies Personal data from the `PII` link; the plan's two business key rules (D-51's
  send-back, D-56's change without a mapping) read `has(id, "BK")`.
- **The import** (`import/standard.ts`, `plan.ts`, `apply.ts`, `compare.ts`, `materialize.ts`, `model.ts`,
  `commands/import.ts`): the reader keeps the file's values as written (F9; `NOT_READ_YET` and its two booleans are
  gone); the plan matches them to live column classifications by code or name, writes the warnings (F13), fills each
  column's `classificationIds` and "The file says …" names, and offers the suggestions (`hints`, F12). New columns get a
  link per matched classification and per ticked suggestion. The digest records the matched ids, the file-says names and
  every suggestion with its tick (F11); `keptChoices` keeps the unticked ones still offered. The server plans with the
  workspace's Data Vault mode (`access.workspace.dv2_mode`), never the browser's; the route's input takes `hintsOff`.
- **The Data Vault reading** (`model/data-vault-reading.ts`): `dataVaultReading(input, index)` returns structured lines,
  `readingText` the prototype's words.

**Outside the domain, only what the types needed:** the local adapter knows the two tables (`DevDb`, `emptyDb`,
`RULES`: unique code, unique name per scope among live rows, one live link per classification and object, exactly one
target), `upgradeDb` fills them empty and the notes with null on read (no format change), `store.model.load` returns
them; the seeds and the synthetic model write the two note fields; `ModelIndex` builds the index and `businessKeyHint`
uses it; `createAttributeFromColumnAction` passes the list; the review step's two chips ("Business key", "PII") became
one chip per matched classification.

### Decisions I took (please check)

1. **The two flags stay on `SourceColumn` until step 3** (its upgrade turns them into links and drops them); no domain
   rule reads them. `updateSourceColumn` keeps `isBusinessKey`, `isPii` and `comment` until step 4 replaces the column
   panel's flags and comment field; it is the only domain code that still writes the flags.
2. **Until step 3 the running app is between two states:** the local data file has no classification rows, so the
   domain's business key rules, the BK suggestion and the Personal data copy see nothing, while the canvas and the
   panels still read the old flags. Step 2 runs no e2e (PRD); specs that would fail now (S7A-01's "not read yet",
   S7A-08 and the 7b specs on business key send-backs) come back with step 3's upgrade and step 5's review. Nothing is
   pushed, so `schema:check` (no migration yet) does not run.
3. **An unknown value does not count as classifying a column for the suggestions:** a primary key column whose only
   value is unknown still gets the Business key suggestion (the value is warned about).
4. **One warning per value and table, for both warnings**, in the form of slice 7a's row warnings: "Row {n}: … (and {k}
   more rows of {schema.table})". The table-classification warning is deduplicated the same way (your text, with the row
   added).
5. **"The file says …"** only when the file's values matched at least one classification, compared as sets, shown by
   current names. Matching runs only for the tables in scope.
6. **"The table has no business key"** (F12) = no column of the file matched Business key and no stored column that
   stays in the source (not missing) has it.
7. **Restore** refuses an own classification (an own one comes back only by undo, as the PRD lists only built-in ones
   under "Removed built-in classifications").
8. **Names:** up to 80 characters, at least one letter or digit (`norm` not empty).
9. **The Data Vault reading:** a relationship none of whose columns is left is left out; links in relationship-name
   order; the satellite line says "with personal data" where the prototype says "PII" (the classification is "Personal
   data" now, and the line names the role).
10. **The settings text** keeps its first sentence, "InfoMapper is methodology-neutral.", before F17's text.
11. **The removal form's settlement count** (`settles`) comes from the same rule `settleAfterWrites` applies, so the form
    can say how many open business key changes settle before the click.

### Every new user-facing text

| Where | Text |
| --- | --- |
| What stops: Business key | Without it, the app no longer suggests business keys on attributes, sends approved mappings back when a business key column changes type, raises business key changes on import, suggests business keys in the import, filters keys by it or shows the BK badge on source rows, and the Data Vault reading shows no hub. |
| What stops: Personal data | Without it, the app no longer copies personal data to attributes created from a column or shows a separate personal data satellite in the Data Vault reading. |
| What stops: Technical / audit, Load date, Record source | Without it, the Data Vault reading counts these columns as descriptive columns of a satellite. |
| What stops: Effective date | Without it, the Data Vault reading no longer shows what a table is effective-dated by. |
| What stops: Link key | Without it, the import no longer suggests link keys, and the Data Vault reading no longer marks link keys or asks about link keys with no relationship. |
| What stops: Dependent child key | Without it, the Data Vault reading no longer shows dependent child keys and counts these columns as descriptive. |
| What stops: Driving key | Without it, the Data Vault reading no longer shows driving keys and counts these columns as descriptive. |
| What stops: Multi-active key | Without it, the Data Vault reading no longer shows multi-active satellites and counts these columns as descriptive. |
| What stops: Hub candidate | Without it, the Data Vault reading no longer notes a hub candidate that has no business key column yet. |
| What stops: the other eight built-ins, own ones | (none) |
| Import warning | Row {n}: unknown classification “{value}” on {schema}.{table}.{column}, ignored (and {k} more rows of {schema}.{table}). Add it under Classifications to use it. |
| Import warning | Row {n}: “{value}” is a table classification; ignored on {schema}.{table}.{column} (and {k} more rows of {schema}.{table}). |
| Suggestion's reason | the only primary key column, and the table has no business key / a foreign key: a candidate for a link between hubs |
| Settlement | Settled: {column} is no longer a business key |
| Settlement | Settled: the classification {name} was removed |
| Settings (methodology) | InfoMapper is methodology-neutral. The Data Vault 2.0 mode adds Data Vault classifications and a Data Vault reading to source table panels (hubs, links, satellites); nothing is generated or enforced. |
| Mode off | Data Vault 2.0 mode is off. {n} Data Vault classifications on tables and columns stay stored and show again when the mode is on. (1: "… 1 Data Vault classification on a table or column stays stored and shows again …"; 0: "Data Vault 2.0 mode is off.") |
| Toasts | Note saved on {name} / Note removed from {name} |
| Refusals | That name is taken · Rename {other} first: {name} is taken. · Only built-in classifications can be restored. · It is in the list already. · {name} is a table classification. / {name} is a column classification. · It is marked {name} already. · This can't be undone: another classification is called {name} now. · Enter a name. · This name is too long. |
| Undo labels | Add classification {name} · Rename classification {name} · Remove classification {name} · Restore classification {name} · Set classification · Clear classification · Edit note on {name} |
| Data Vault reading | Hub on {columns} · Marked as a hub candidate, but no column is a business key yet · Link to {table} via {columns} (foreign key; not marked Link key) · Link key {columns} with no relationship known: which table does it point to? · Dependent child key {columns}: part of the link’s or satellite’s key, not a hub · Driving key {columns}: an effectivity satellite on the link tracks it · Multi-active satellite keyed by {columns} · Effective-dated by {columns} · Satellite with {n} descriptive columns; {k} with personal data: consider a separate satellite for {columns} · empty: Classify columns (Business key, Link key…) to see what this table suggests. · footer: Hints from the classifications and the source’s keys; nothing is created. |

### Tests

New files: `model/classifications.test.ts` (11: the list, names, the index, what stops, Data Vault mode),
`commands/classification.test.ts` (14: add, rename, remove and its impact, restore, toggles, roles and archive),
`import/classifications.test.ts` (14: matching, the warnings, renamed and removed classifications, re-import keeps,
suggestions with F12 and Data Vault mode, ticks and the fingerprint, the business key rules by code, the command with the
server's mode), `model/data-vault-reading.test.ts` (5: every line, what is left out, empty, codes). Added to:
`settle.test.ts` (4: Q7's settlements, a mapping change open, the cascade), `undo.test.ts` (3: removal and toggle undone,
the name clash), `source.test.ts` (3: notes, escaping, roles), `change-label.test.ts` (2), `mapping-rules.test.ts` and
`attribute.test.ts` (rules follow the code; the old flag is not read).

Changed earlier tests, with the reason: `standard.test.ts` (the reader keeps raw values; no "not read yet"),
`plan.test.ts` (business keys set as links; new columns' classifications as links; the file-says name is "Personal
data"), `workspace.test.ts` (the 19 rows in the creation's group), `model-index.test.ts` (the index), the model and undo
row literals of seven test files (the two new arrays), `compare-schema.test.ts` (the two new tables).

### The plan timing against slice-07b (section 6)

`npx tsx scripts/bench-import-plan.ts --no-coverage`, this branch and `slice-07b` (a temporary worktree, removed
afterwards) in turns, three turns each, after a first pair of turns that led to one change (the suggestions' business
key check runs only for tables with a candidate column). Median of each turn's median:

| Plan the re-import | slice-07b | slice 7c | Bar |
| --- | --- | --- | --- |
| 20,000 columns (2,000 tables) | 122 ms (122, 113, 131) | 130 ms (130, 132, 130) | +7 %, within 10 % |
| 100,000 columns (10,000 tables) | 532 ms (504, 532, 538) | 530 ms (537, 530, 510) | level |
| The classification index, 2,000 / 10,000 links | – | 1 ms / 2 ms | under 20 ms |

The synthetic file classifies one column per table (BK), so matching runs on 10 % of the rows; suggestions find no
candidate (every table has a business key). The write figures come with step 3.

### How to check

- `npm test` (or `npx vitest run src/domain/model/classifications.test.ts src/domain/commands/classification.test.ts
  src/domain/import/classifications.test.ts src/domain/model/data-vault-reading.test.ts`).
- `npx tsx scripts/bench-import-plan.ts --no-coverage` for the plan and the index.
- Nothing to see in the app yet (decision 2).

### Open for step 3

The migration, the local data file's format 8 and its upgrade (the 19 rows, the flags as links, P9's comments, the
report), the server actions, the seeds (`seed:large` without BK links, F15), dropping the two flags, the decision texts
for your approval, and one full e2e run (P13).

### Questions for Łukasz

1. The texts above: approve, or change any?
2. Decision 2: is the in-between state until step 3 fine, given that no e2e runs before then?
3. Decision 3: should an unknown value stop the Business key suggestion for its column (the file did name something)?
4. Decision 9: "with personal data" in the reading's satellite line, instead of the prototype's "PII"?
5. Decision 7: restore for built-in ones only?
