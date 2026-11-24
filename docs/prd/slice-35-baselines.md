# Slice 35 – Baselines: create, list, rename, delete, compare

Status: **proposed** (24 November 2026). Proposed by Łukasz on 24 November 2026: Baselines as the next feature, in two
slices built in order (35: baselines; 36: documents from a baseline), with the decision rounds for both done first.
**Full path** (CLAUDE.md, "The slice cycle", 2), because it adds a table's columns (a migration), a stored snapshot
format with its own upgrade chain, new commands on both adapters and a new tab. Branch `slice/35-baselines`, from `dev`
(`8ff39f3` or later). PRD file: `docs/prd/slice-35-baselines.md`; step 1 writes `docs/prd/slice-35-acceptance.md`. Test
regime: CLAUDE.md, "Testing". Slice number 35 is an assumption (the next free number); step 1 confirms.

It has a **prototype change**, accepted by Łukasz on 24 November 2026 (for slices 35 and 36 together). Files in
Łukasz's Downloads folder (The slice cycle, 3):

| File | SHA-256 |
| --- | --- |
| `slice-35-baselines.md` | given in the prompt |
| `infomapper-prototype-with-sources.html` | `6d5b5b7f5f00c739f3c799961ec2b6198e3ec407601595fe63c47a400ecdc179` |

Written from the decision rounds of 24 November 2026 (no file in the repository; quoted as "B1.1" to "B4.6"), the
design agreed on 11 November 2026 (`docs/ideas.md`, "Baselines: the design agreed for their slice"; quoted as "the
design"), AD-03, AD-14, AD-18, the prototype and a few lookups in the code on `dev` at `8ff39f3` (marked "fact,
`8ff39f3`"). Facts and assumptions are marked; every assumption is to be checked in step 1.

## 1. Why

A baseline is the state of a whole workspace's model at a moment, with a name (e.g. "Stage 2 sign-off"): the source of
comparisons and, from slice 36, of documents (AD-03). Łukasz's daily question is **"what changed between stage 1 and
stage 5?"** (B4.6): a baseline's value comes mostly from comparing it, with now or with another baseline. So this slice
builds the baselines themselves and the comparison; slice 36 builds documents from a baseline, the section "Changes
since …", the sign-off preset and "Make a document" from the comparison.

Decisions taken before this PRD (Łukasz, 24 November 2026, on Claude's recommendations):
- **B1.1:** a tab "Baselines (n)" on the workspace home, after the modules' tabs (Documentation), before People. A
  baseline covers the whole workspace, not a project.
- **B1.2:** create and rename for owners, admins and modelers; delete for owners and admins (the design). Every member
  sees the list, reviewers, readers and guests included; read only in an archived workspace.
- **B1.3:** the name required and unique among the workspace's baselines that are not deleted, case-insensitive; the
  note optional; "Rename" changes the name and the note in one dialog; at most 120 and 1,000 characters.
- **B1.4:** the content never changes (not by editing the model, undo, or deleting in the live model); only the name and
  note change; soft delete; no "Restore" in this slice.
- **B1.5:** a baseline is the whole model's state; a version (one document frozen as rendered) is neither this slice's
  nor slice 36's.
- **B1.6 (b), B4.6 (c):** "Compare…" in this slice: with Now or with any other baseline, filters, old → new values.
- **B2.1 (a):** deleting asks first. **B2.2 (a):** deleting is allowed while documents use the baseline (none can in
  this slice); the dialog will say how many (slice 36). **B2.3 (b):** the comparison covers entities, attributes,
  mappings, relationships, requirements, source tables and source columns. **B2.5 (b):** date and time to the minute.
  **B2.6 (a):** created only in the Baselines tab.
- **B4.2 (b):** short values as "old → new", long texts as "{field} (changed)"; one rule for the dialog and slice 36's
  section.

## 2. What to build

### The tab (the prototype's "Baselines (n)")

- **Intro line:** "A baseline freezes the model (entities, attributes, sources, mappings, relationships, requirements)
  with a name, e.g. for a sign-off. Compare it with today, or produce documentation exactly as it was."
- **"New baseline" box** (owners, admins, modelers; not in an archived workspace): "Name, e.g. Stage 2 sign-off"
  (`maxlength` 120), "Note (optional)" (`maxlength` 1,000), "Create baseline". Empty name: "Give the baseline a name.";
  a name taken in any letter case: "A baseline named {name} already exists in this workspace."; nothing is created.
  Success: "Created the baseline {name}." (toast).
- **The list**, newest first, one card per baseline: the name; "{yyyy-mm-dd hh:mm} by {person} · {note} · {e} entities,
  {m} mappings, {r} requirements" (the note left out when empty; the time in the person's time zone, *assumption:* as
  other times in the app); buttons "Compare…" (everyone), "Rename" (owners, admins, modelers), "Delete baseline"
  (owners, admins, danger style). None but "Compare…" in an archived workspace. No baselines: "No baselines yet."
- The counts come from the baseline's stored summary, not from reading its snapshot (see "Reading").

### Rename

A dialog "Rename “{name}”" (subtitle "{workspace} · baseline"): "Only the name and the note change. What the baseline
holds stays as it was taken on {date time}.", Name (`maxlength` 120), Note (optional, a text area, `maxlength`
1,000), Cancel and Save. The same checks as creating; a refused name keeps the dialog open with its message. Save with
nothing changed closes and writes nothing. Toasts: "Renamed the baseline {old} to {new}." or "Changed the note of the
baseline {name}.". A rename is saved with the row's version (D-59's rule), so two people renaming at once get the
app's usual conflict message.

### Delete

A dialog "Delete the baseline “{name}”?" (subtitle "{workspace} · baseline"): "It cannot be brought back here.", Cancel
and "Delete baseline" (danger). Then the row is soft-deleted, leaves the list, and its name is free again. Toast
"Deleted the baseline {name}.". **The documents' line** ("One document is made from it. It stays and says that the
baseline no longer exists; its author can choose another source.") is slice 36's: in this slice no document can point
to a baseline, so the line never shows. *Assumption:* the dialog is built so slice 36 only adds the count.

### Compare…

A dialog "Compare “{name}”" (subtitle the workspace):
- One row: "Compared with" (`Now (the live model)` by default, then the other baselines newest first, "{name} ({date
  time})"), "Filter" (a search field, placeholder "A name, e.g. Customer or cust_no") and "Kind" ("All kinds", Entity,
  Attribute, Mapping, Relationship, Requirement, Source table, Source column).
- **The older state is always the starting point**, whichever row the dialog was opened from (Now is always the newer).
- The line: "{n} changes from {older} to {newer}" where a baseline reads "“{name}” ({date time})" and Now reads "now";
  "; {m} shown by the filter" while a filter hides some; "No changes from {older} to {newer}." when nothing differs;
  "Nothing matches the filter." when the filter leaves none.
- Groups "Added ({n})", "Changed ({n})", "Removed ({n})" (in that order, empty ones left out), each a table Kind / Item /
  What changed. Item labels: an entity by its name; an attribute "{entity}.{attribute}"; a mapping "{table}.{column} →
  {entity}.{attribute}"; a relationship "{from} – {to}"; a requirement "{key} {name}"; a source table "{system} ·
  {table}"; a source column "{system} · {table}.{column}". *Assumption:* the app's own labels for these where they
  exist (step 1 names them).
- **What changed (B4.2):** for each changed field, short values "{field}: {old} → {new}" (booleans "yes"/"no", empty
  "–", lists joined with ", ", ids by name: a mapping's source column and target attribute, an entity's concept);
  long texts (definition, rule, description, expression) "{field} (changed)". Field names in plain words ("type",
  "definition", "PK", "FK", "personal data", "nullable", "source column", "target attribute"…).
- **Which fields count** (the prototype's lists, step 1 to complete from the app's columns): entity name, stereotype,
  concept, definition; attribute name, type, PK, FK, personal data, nullable, definition; mapping status, kind, rule,
  source column, target attribute; relationship label and cardinalities; requirement name, kind, status, priority,
  description, expression; source table name, system, database, schema, object type; source column name, type,
  nullable, PK, FK, tags. Not counted: order, positions, timestamps, versions, ids, who changed.
- The filter matches the item's label, any letter case. The comparison covers the whole workspace (no scope here).
- **The comparison is a pure function in the domain** (two snapshots in, a list of changes out, with labels and field
  values), shared with slice 36's section; labels and field names come through a small dictionary so slice 36 can give
  them in Polish and German.

### The snapshot (the design of 11 November 2026)

- **Holds** the live rows (for link tables, both ends live) of the core, sources, classifications and their links,
  stereotypes, mappings, requirements and their links, every module's tables, projects and canvases with their items
  and frames, plus the deleted originals that live copies point to (id, name, entity name), and the settings
  `dv2_mode`, `four_eyes`, `naming_conventions` and `infocube`. **Leaves out** labels, label links, project pinned
  labels, notes, change events, source changes, source imports, people and access.
- **A per-table snapshot flag in the table registry** decides it, so every new table is classified (a test fails for a
  table without one).
- **Its own `snapshot_schema`** (fact, `8ff39f3`: the column exists, default 1) with a short, pure upgrade chain that
  reuses the modules' row upgrades; it runs on read, deterministically (no new ids or times), and never writes back. A
  later slice that changes a stored shape of a snapshot table adds its step and a fixture test.
- **One store method makes it from one read** (one transaction online, so the snapshot is consistent).
- **Locally** each snapshot is its own file in a folder per data file, written before its row; KB's local backup
  includes that folder. **Online** it stays jsonb, kept out of change event images.
- **A summary** stored with the row (the counts the list shows), so the list never reads a snapshot. *Assumption:*
  a jsonb or three integer columns; step 1 proposes.

### Reading

Opening the workspace home or the Baselines tab reads the baselines' rows without their snapshots. A snapshot is read
only by "Compare…" (and from slice 36 by a document or a section that needs it), one baseline at a time, through the
upgrade chain.

### Rights, history and undo

- Actions (the design): `baseline.create` and `baseline.rename` for owners, admins and modelers; `baseline.delete` for
  owners and admins; none in an archived workspace; reading for every member. Checked in the domain (AD-05, AD-09) and
  again on the server.
- Each create, rename and delete is a change event with who and when (outside the snapshot); none is an undo step;
  undo and redo never touch a baseline. *Assumption:* the existing history shows these to Łukasz somewhere (Q6).

### The demo

The demo's "Retail Co – DWH" gets the baseline "Stage 1 sign-off" (taken 15 September 2026 10:12 by Łukasz, note
"Agreed with Retail Co on 15 September.") from today's demo model minus what the prototype removes (REQ-105, the
attribute `Customer.segment_code` and its mappings), with one approved mapping still a draft and `customers.cust_no` as
`varchar(10)`, so S35-04's case shows. *Assumption:* the demo's seed can make it; step 1 says how and what it costs
(`pg:seed` online included); if costly, the case is prepared by hand at the acceptance.

### Tests

- Unit: the comparison (every kind, added / changed / removed, old → new and "(changed)", ids by name, booleans, lists,
  empty values, the older-first rule, the filter); the snapshot flag on every table; the snapshot's content (what is in,
  what is out, deleted originals); the upgrade chain on a fixture; name rules (required, trimmed, 120 / 1,000,
  case-insensitive unique among live rows, free again after delete).
- Contract suite on both adapters: create, list (no snapshot read), rename (version conflict), delete (soft; name free),
  read for compare; rights per role and in an archived workspace; a baseline unchanged after model edits, undo and redo.
- E2E (`e2e/slice-35/`): S35-01 to S35-04 as written, with demo accounts; one spec times creating a baseline on the demo.

### Not in this slice

Documents from a baseline, "Changes since …", the sign-off preset, "Make a document", the documents' count in the
delete dialog, Markdown from a baseline (slice 36); Restore; comparing classifications, stereotypes or InfoCube's rows;
"who changed it and when" between two baselines (ideas.md); a version (one frozen document); a workspace transfer or
copy with baselines (the transfer slice).

## 3. Data model

- `baseline` exists (fact, `8ff39f3`, initial migration, line ~586): `id`, `workspace_id`, `name`, `note`,
  `created_at`, `created_by`, `snapshot` (jsonb), `snapshot_schema` (integer, default 1); index
  `baseline_workspace_ix (workspace_id, created_at)`; RLS on.
- **New (one migration; assumption, step 1 confirms the shape):** `deleted_at` and `deleted_by` (soft delete);
  `version` (the row's version for rename, D-59); the summary (the list's counts); CHECKs on the name (trimmed, 1 to 120
  characters) and the note (at most 1,000); a partial unique index on `(workspace_id, lower(name)) where deleted_at is
  null`. `data-model-v2.md`'s `### baseline` updated (its `snapshot` line lists today's content, which the design
  widened).
- **Local adapter:** the baselines' rows in the data file, each snapshot in its own file (the design); a format step if
  needed.
- On `infomapper-dev` Łukasz runs `npm run pg:migrate` himself, after `npm run pg:backup` (AD-39's note), with KB's row
  counts before and after (4,871 at the last backup, `kb-20261120-1911.json`). No test or step makes a baseline in KB.

## 4. Sources

- **Decisions:** AD-03, AD-14, AD-18 (JSON for snapshots), AD-05 and AD-09 (rights, archive), D-59 (row versions),
  AD-39 (KB online, backups); the design in `docs/ideas.md` ("Baselines: the design agreed for their slice").
- **Code (fact, `8ff39f3`):** `supabase/migrations/20261002000000_initial_schema.sql` (`baseline`),
  `src/app/w/[workspaceId]/page.tsx` (the workspace home's tabs: Overview, the modules' tabs, People, Metadata
  conventions, Settings), `src/domain/commands/undo.ts` (the registry of undoable tables), `src/data/local`,
  `src/data/postgres`, `src/data/ports.ts`; InfoDocumenter's `document_definition.source_kind` and `baseline_id` (only
  `live` accepted; slice 36).
- **The prototype:** the tab (`renderWsHome`, `tab === "baselines"`), `blNameTaken`, `renameBaseline`,
  `askDeleteBaseline`, `compareBaseline`, `blPair`, `diffModels`, `diffDet`, `DIFF_FL`, `DIFF_LONG`. Its "New document
  from it" and "Make a document" are slice 36's.

## 5. Steps

Stop after each step; wait for Łukasz.

1. **Reconnaissance and check.** Copy this PRD and the prototype from Downloads into the repository and check both with
   `cmp` and the SHA-256 (stop if either differs). Answer Q1–Q10 in `slice-35-acceptance.md`; every place where the PRD
   is wrong or costs more than it assumes, with a proposal; the differences between the prototype and the app this
   slice touches; the earlier specs and tests each step touches; the plan for steps 2 to 6. No application code, no
   connection to `infomapper-dev`.
2. **The domain and the data:** the snapshot (flags, store method, schema and upgrade chain, local files), the
   comparison, the commands and rights, the migration, both adapters, the contract suite, the demo's baseline. A draft
   PR into `dev`.
3. **The tab and the dialogs:** the Baselines tab, create, the list, Rename, Delete, Compare…; the e2e specs. A full run.
4. **Łukasz's migration, one step at a time:** `pg:backup`, KB's counts, `pg:migrate` on `infomapper-dev`, KB's counts
   again. **Stop.**
5. **Łukasz's acceptance** on `npm run dev:pg` with demo accounts (AD-39: no backup needed for an acceptance):
   S35-01 to S35-04. **Stop** with what he saw.
6. **Close.** The docs and the decisions quoted in full for approval (section 8); the housekeeping (section 8); one full
   run on the final commit. Merge into `dev` and tag `slice-35` only on Łukasz's command, with `pg:backup` before the
   merge only if KB changed since the last backup.

## 6. Acceptance criteria

Łukasz's criteria 1 to 5 (24 November 2026).

| ID | Criterion |
| --- | --- |
| S35-01 | **The Baselines tab.** The workspace home has a tab "Baselines (n)" after Documentation and before People. As an Owner, Admin or Modeler I give a name (required, at most 120 characters) and an optional note (at most 1,000) and click "Create baseline"; the baseline appears at the top of the list with its name, date and time to the minute, my name, the note and its counts of entities, mappings and requirements, and the tab's number goes up. A name already used by another baseline of the workspace, in any letter case, is refused with a message and nothing is created. Every member sees the list, Reviewers, Readers and guests included; they do not see the form. In an archived workspace nobody sees the form. (Criterion 1.) |
| S35-02 | **Rename and delete.** An Owner, Admin or Modeler sees "Rename" on each baseline: one dialog changes the name and the note, with the same rules as creating (required name, unique in any letter case, 120 and 1,000 characters); a refused name keeps the dialog open with a message; Cancel changes nothing. Only an Owner or Admin sees "Delete baseline": it asks first ("Delete the baseline “{name}”?", "It cannot be brought back here.", Cancel, Delete baseline); after deleting the baseline leaves the list and the tab's number goes down, and a new baseline may take its name. Reviewers, Readers and guests see neither button; in an archived workspace nobody does. Creating, renaming and deleting are each recorded in the workspace's history with who and when, and none of them is an undo step (Ctrl+Z after them undoes the last model change, not the baseline). (Criterion 2.) |
| S35-03 | **Immutable content.** What a baseline holds never changes after it is taken. I take a baseline, then change the model: rename an entity, change an attribute's type, approve a mapping, delete an entity, import a source change, and undo and redo some of it; "Compare…" with Now shows exactly those changes, and the baseline's counts in the list stay as they were. Renaming a baseline changes only its name and note: comparing it before and after the rename gives the same result. The snapshot holds what the design of 11 November lists (the core, sources, classifications, stereotypes, mappings, requirements, every module's tables, projects and canvases with their frames, and the four settings) and leaves out labels, notes, change events, people and access. A baseline taken in a large workspace (the demo's "Retail Co – DWH") is created in a few seconds at most, and a workspace with baselines loads as fast as before (a snapshot is read only when it is compared). (Criterion 3.) |
| S35-04 | **Compare.** Every member sees "Compare…" on each baseline, in an archived workspace too. It opens "Compare “{name}”" with "Compared with" (Now, the live model, by default, or any other baseline, newest first), "Filter" and "Kind" in one row. The older state is always the starting point, whichever baseline the row belongs to. The dialog says "{n} changes from {older} to {newer}" and groups them as Added, Changed and Removed, each a table of Kind, Item and What changed, over entities, attributes, mappings, relationships, requirements, source tables and source columns. "What changed" shows short values as old → new ("type: varchar(10) → varchar(20)", "status: Draft → Approved", "PK: no → yes") and long texts as "{field} (changed)" (definition, rule, description, expression); ids are shown by name (a mapping's source column and target attribute, an entity's concept). The filter keeps the rows whose item contains the text in any letter case ("cust" finds customers.cust_no and Customer.segment_code), the kind narrows to one kind, and the line says "{m} shown by the filter"; "Nothing matches the filter." when none is left. With no differences: "No changes from {older} to {newer}." On the demo, "Stage 1 sign-off" compared with Now shows the mapping whose status changed and customers.cust_no's type. (Criterion 4.) |
| S35-05 | **Nothing breaks.** Without a baseline every page works and looks as today; the full run passes and the contract suite compares the baseline commands (create, list, rename, delete, read for compare) on both adapters. Locally each snapshot is its own file in a folder beside the data file and KB's local backup includes that folder. Online the migration passes in CI; on `infomapper-dev` Łukasz runs `pg:migrate` after `pg:backup`, with KB's row counts the same before and after, and no baseline is created in KB by any test or step. InfoDocumenter's documents still accept only the live model (documents from a baseline are slice 36's). Acceptance on `dev:pg` with demo accounts. No Vercel, GitHub or Supabase settings. (Criterion 5.) |
| S35-06 | CI, the Schema workflow, the full run before the merge; every earlier test changed, with its reason. |

**Manual acceptance:** Łukasz, step 5: S35-01 to S35-04 on `dev:pg` with demo accounts; S35-03's snapshot content and
times and S35-05 from CC's report and his own check of KB's counts.

## 7. Questions for step 1

- **Q1. The table registry.** Where the tables are registered today (undo's registry, the modules' tables, InfoCube's),
  how a per-table snapshot flag fits, and the full list of tables with the flag each gets under the design (in / out,
  and why), the modules' tables included.
- **Q2. The snapshot's shape and the store method.** The jsonb's shape (per table, rows as stored or as the domain
  reads them), the one read that makes it on each adapter (one transaction online), the deleted originals that live
  copies point to, its size on the demo's "Retail Co – DWH" and on KB (counts and bytes), and the time to make it.
- **Q3. The upgrade chain.** How the modules' row upgrades are reused for snapshot rows; the fixture test; what
  "deterministic, never written back" needs in code.
- **Q4. The migration.** The columns, CHECKs and index of section 3 (or better ones), the summary's form, RLS for the new
  columns, the Schema workflow; the local adapter's file layout and format step; KB's local backup including the
  folder.
- **Q5. The comparison.** The fields per kind from the app's real columns (section 2's list completed), the labels the
  app already uses for items, the field names' dictionary (English now, Polish and German in slice 36), the cost on two
  snapshots of the demo's size.
- **Q6. History and undo.** How a create, rename and delete becomes a change event outside undo; where the app shows the
  history to Łukasz today (for S35-02's check), or that it does not.
- **Q7. Rights.** The new actions in the rights table, their checks in the domain and on the server, the archive, guests.
- **Q8. The demo.** How the demo's seed (local and `pg:seed`) gets "Stage 1 sign-off" with S35-04's differences, and what
  it costs; the demo account to use as a Reader or Reviewer in S35-01.
- **Q9. Words.** Every new text of section 2 in English, and whether the app's interface needs Polish and German for them
  now (*assumption:* the interface is English; slice 36 needs the comparison's words in the documents' languages).
- **Q10. Risks and shared infrastructure.** The workspace home's tabs (the module tabs' order), the e2e parts' heap
  (a new folder; a recut if a part nears 2 GB), the full run's time, anything that changes this plan.

## 8. Decisions (proposals) and docs

Quoted in full at the closing for Łukasz's approval; the texts below are proposals for step 1 to correct.

- **D-87 (new): Baselines** (slice 35): the tab, create, list, rename, delete, the rights, soft delete, outside undo,
  logged, immutable content, the snapshot's content and format (the design, now built), "Compare…" with its rules
  (B4.2, B4.6).
- **AD-03 / AD-14 (notes):** the snapshot's content as built, its `snapshot_schema` and upgrade chain on read, the
  summary, read only when compared.
- **AD-39 (note, housekeeping from the handover):** Supabase is on a paid plan with its own backups (retention to be
  written down); the backup rule simplified: a manual `pg:backup` before a `pg:migrate` (and before a merge when KB
  changed), Supabase's backups otherwise; CLAUDE.md changed to match. *For Łukasz's approval at the closing.*
- **The decisions of PR 92** to write in (handover): 1 and 3 approved (Claude's calls); 2 (the canvas's fly-to) (b) leave
  it (Łukasz, 24 November 2026).
- Docs: `decisions.md`, `data-model-v2.md` (`### baseline`), `ideas.md` (the design done; "who changed it and when
  between two baselines"; Restore; comparing classifications, stereotypes, InfoCube), `known-limitations.md`,
  `inventory-prototype-vs-app.md`, README and CLAUDE.md.

## 9. Left for later

Slice 36 (documents from a baseline, "Changes since …", the sign-off preset, "Make a document", Markdown from a
baseline, the documents' count on delete); Restore; comparing classifications, stereotypes and InfoCube's rows; who
changed what between two baselines; freezing the labels for label canvases (the design's option a); a workspace
transfer or copy with baselines.
