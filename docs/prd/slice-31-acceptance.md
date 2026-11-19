# Slice 31 – acceptance and step 1's check (KB copied into the database)

Step 1 (reconnaissance and check) of `docs/prd/slice-31-kb-copy.md`, on `slice/31-kb-copy` from `dev` at `4d920f3`
(19 November 2026). No application code, no write to `infomapper-dev`, KB not read: `.data/dev-db.json` and its backups
were not opened. Everything below comes from the code, the migrations, the docs and the earlier slices' acceptance docs.

## The PRD's copy and the slice number

- `slice-31-kb-copy.md` copied from Downloads to `docs/prd/slice-31-kb-copy.md`: `cmp` reports no difference; SHA-256
  `b4b4063adfde67bc868dfd4db9fabef4e3bfb5c2386e471e0a0663c8f0811968`, as the prompt gives.
- **31 is the next free number:** `docs/prd/` ends at slice 30 (`slice-30-measurement.md`); no branch, tag or pull request
  names a slice 31 (the last PR is 81, slice 30's measurement; the last tag `slice-30`).

## Answers to the PRD's questions (section 7)

### Q1. KB in the file

- **The file's tables** are `DevDb`'s 36 (`src/data/local/schema.ts`) plus a module's tables under their own names
  (`ModuleDb`: InfoCube's `cube_*`, InfoDocumenter's documents), absent until a module writes its first row (AD-33). Every
  one is in the table registry (`STORE_SCHEMA`), which `loadRows` already checks (it refuses a table the store does not
  know).
- **Fields without a column:** the loader already refuses them (`strayFields` against `information_schema.columns`).
  Two fields of the file are known to have a column but must not be copied: `organization_access.access_hash` (below,
  Q4). Whether KB's rows hold a field the demo's do not cannot be told without reading KB: Q2's count script lists, per
  table, the field names KB's rows use that no seed row uses (names only), and step 2's copy refuses any without a column
  before it writes (section 3's stop holds: if one has none, step 2 stops and proposes).
- **Which rows are KB's, by key:** every table but six has `workspace_id`: those rows are KB's when their workspace is
  one of KB's. The six (from the migrations): `organization` (its id), `organization_member`, `organization_access` and
  `organization_licence` (`organization_id`), `workspace` (`organization_id`), and `app_user` (no owner: a person is
  global). Module tables all have `workspace_id`. `change_event` is per workspace, so KB's history is its workspaces'
  events. `undo_step` (Postgres only) is per workspace and person.
- **Rows that point across organizations — the one real gap in the PRD (F1 below).** KB's rows point to `app_user` by
  every `created_by`, `updated_by`, `changed_by`, `user_id` and the like (foreign keys in the SQL). The people they name
  are KB's members, but also anyone who ever wrote in a KB workspace and left, and possibly a demo person (the file began
  as the demo's seed, and KB was made in it). A demo person in KB's rows has the file's id and the demo's e-mail; on
  Postgres the demo's people have **other ids** (the seed loader builds fresh ids each run, `e2e/slice-29/helpers.ts`) and
  `app_user.email` is unique (`app_user_email_uq`): such a row cannot be inserted. Other cross references (a foreign key
  from a KB row to a row of another organization, other than a person) should not exist; Q2 counts them.

### Q2. KB's counts before the copy

A read-only count script, run by Łukasz on a copy of his newest backup; it prints counts and schema names only (no
names, no content, no e-mail, no id). **Decided:** `scripts/kb-counts.ts`, added in its own commit on this branch before step 2 (`a3c72ad`; it is not
application code and writes nothing).

**What it reads:** only the path it is given, which must be a file under `.data/backups/` and not named `dev-db.json`
(it refuses otherwise); it never opens `.data/dev-db.json`. It parses the JSON, upgrades a copy **in memory** with
`upgradeDb` (never written back), and compares with the demo built in memory (`seedRows()`, no file).

**What it prints:**
1. The file's format before and after the upgrade in memory, and the rows the upgrade made per table (Q3).
2. Organizations in the file (a count) and how many are named "KB" (it stops unless exactly one); KB's workspaces (a
   count, live and deleted).
3. Per table: KB's rows (live, soft-deleted) and the other organizations' rows; module tables included.
4. Per table: field names KB's rows use that no row of the demo's seed uses (schema names only).
5. People: KB's organization members; members of KB's workspaces; the distinct people KB's rows name (every column that
   refers to `app_user`); of those, how many are not KB's members, how many also belong to another organization in the
   file, and how many have an e-mail equal to one of the demo's (counts only), and how many e-mails are not lower case.
6. Foreign keys from KB's rows to rows outside KB, other than people (per `table.column`, a count).
7. Time columns: values not in the domain's ISO text in milliseconds (a count per table), and the largest number of
   rows sharing one millisecond per table (for T3).
8. KB's `organization_access` rows and its licences (counts), and the file's size in bytes.

**The command** (PowerShell, in the repository's folder, once the script is in), on a copy of the newest backup, which it
then removes:

```powershell
$b = Get-ChildItem .data\backups\dev-db-*.json | Sort-Object LastWriteTime | Select-Object -Last 1; Copy-Item $b.FullName .data\backups\kb-count-copy.json; npx tsx scripts/kb-counts.ts .data/backups/kb-count-copy.json; Remove-Item .data\backups\kb-count-copy.json
```

If the newest backup is older than Łukasz's last change in KB, a fresh backup first (CLAUDE.md, "Łukasz's test model").
**Run on Łukasz's command (19 November 2026, 17:36).** `scripts/kb-counts.ts` came in its own commit (`a3c72ad`). No dev
server served this checkout: no node process, and nothing listening on 3000, 3001, 3200, 3300 or 3400. A fresh backup was
made: `.data/backups/dev-db-20261119-1736.json`, also as `kb-model-latest.json`. The SHA-256 of `.data/dev-db.json` was
`f2b60e19c457190d878f7052a331a84dcfb4e6fdfd32978a5e3b16d4816de20a` before the backup, after it and after the count, and
both backups have the same SHA-256. The script ran on a temporary copy of that backup,
`.data/backups/kb-count-copy.json`, which was removed afterwards. Its output, counts and schema names only:

```text
File: 6,679,171 bytes; format 17, in memory 17.
The upgrade in memory made rows: none.
Organizations: 3; named KB: 1.
KB's workspaces: 1 (0 deleted).

Rows per table: KB live / KB deleted / other organizations' / the demo's Retail Co – DWH
  app_user                           0       0   (6 people)       0
  attribute                        190      10           68      72
  attribute_input                    0       0            0       3
  canvas                             7       7            4       3
  canvas_item                       87      35           19      25
  change_event                    3752       0            0       0
  classification                    19       0           57      19
  classification_link               17       9           20      10
  concept                            4       1            8       4
  cube_entity                        6       3            0       7
  cube_mapping                      54       6            0      19
  cube_mapping_input                54       7            0      19
  cube_measure                       9       0            0       6
  document_definition                1       0            0       3
  entity                            29       4           12      13
  frame                              2       4            0       0
  label                              2       0            2       2
  label_link                         4       1            6       6
  mapping                           97      10           28      14
  mapping_input                     97      10           28      14
  note                               3       1            3       3
  organization                       1       0            2       0
  organization_access                1       0            2       0
  organization_licence               2       0            0       0
  organization_member                1       0            5       0
  project                            1       1            4       2
  project_canvas                     7       0            5       4
  relationship                      32       2           10      12
  requirement                        0       3            5       6
  requirement_link                   0       1           13      16
  source_change                     29       0            0       0
  source_column                     97      74           72      36
  source_import                      9       0            0       0
  source_relationship               15       6            4       2
  source_relationship_column        15       6            4       2
  source_system                      2       0            6       3
  source_table                      12       5           12       6
  stereotype                         5       0           15       5
  workspace                          1       0            3       1
  workspace_member                   1       0            8       4
KB's rows as JSON: about 6,435,396 bytes.

Fields in KB's rows that no seed row uses: change_event (no seed rows: after_image, before_image, change_group_id, context_label_id, id, object_id, object_type, occurred_at, operation, user_id, workspace_id); source_change (no seed rows: created_at, created_by, deleted_at, detail, id, kind, mapping_id, object_label, resolution, resolved_at, resolved_by, severity, source_column_id, source_import_id, source_system_id, source_table_id, status, updated_at, updated_by, version, workspace_id); source_import (no seed rows: changes_high, changes_raised, channel, columns_changed, columns_missing, columns_new, columns_renamed, created_at, created_by, deleted_at, id, relationships_new, source_label, source_system_id, tables_new, updated_at, updated_by, version, workspace_id).

People:
  KB's organization members: 1; members of KB's workspaces: 1.
  People KB's rows name: 1; not in app_user: 0.
  Of them, not KB's organization members: 0; not members of a KB workspace: 0.
  Of them, members of another organization in the file: 0.
  Of them, with an e-mail equal to a demo person's: 0.
  Of them, with an e-mail not in lower case: 0.

Foreign keys from KB's rows to rows outside KB (people left out): none.

Time columns (KB's rows): values not in ISO milliseconds / the most rows in one millisecond / milliseconds with more than 999
  source_table.created_at               0       5     0
  source_column.created_at              0      72     0
  source_relationship.created_at        0       8     0
  source_relationship_column.created_at      0       8     0
  source_change.created_at              0       5     0
  classification.created_at             0      19     0
  classification_link.created_at        0       8     0
  canvas_item.created_at                0       3     0
  frame.created_at                      0       2     0
  change_event.occurred_at              0      99     0
  stereotype.created_at                 0       5     0

KB's organization_access rows: 1; licences: 2.
Change events of KB's password with a value other than the marker: 0.
```

**What the counts mean:**
- **Q3:** the file is at format 17 already, and the upgrade in memory makes no row. The ids are stable from one copy to
  the next.
- **F1:** KB's rows name one person, KB's only member. That person is in `app_user`, belongs to no other organization,
  and has no demo person's e-mail. By Łukasz's decision, step 2 builds only the stop (with its test); the mapping is not
  built.
- **S31-02:** KB has no demo person as a member, so the demo accounts cannot see it after a copy.
- **Section 3 (fields without a column):** none. Three tables have no seed row to compare with: `change_event`,
  `source_change` and `source_import`. Their fields were checked against the migrations by hand, and every field has a
  column (`source_import`'s `changes_raised` and `changes_high` came by `alter table`). Step 2's copy checks it again
  against the database (`strayFields`).
- **Cross references:** no foreign key leads from KB's rows to a row outside KB.
- **T3 (the stored order):** no time value is outside the domain's ISO form. The most rows in one millisecond is 99
  (`change_event.occurred_at`), and no millisecond holds more than 999. `spreadCrowded` moves nothing, and every row keeps
  its time to the millisecond.
- **Q4:** KB has one `organization_access` row, which is not copied, and no change event holds a password value other
  than the marker. Its two licences are copied (InfoCube and InfoDocumenter: KB has facts, dimensions and a document).
- **KB's size against the demo:**
  - KB is one workspace. Against the demo's "Retail Co – DWH" it has 29 live entities to 13, 190 attributes to 72, 97
    mappings and 54 dimensional mappings to 14 and 19, 97 live columns to 36, 7 canvases to 3 and 87 cards to 25.
  - That is about two to three times the demo's largest workspace and well below "Performance test" (100 cards).
  - KB also has 3,752 change events, which the demo's seed has none of. Its rows are about 6.4 MB as JSON, almost all of
    it those events' images.
  - The editor's snapshot does not carry the change events. Whether a canvas page reads them on Postgres is one thing
    the measurement on KB will show: a module's four-eyes reads the page's change events.
- **Step 2, from these counts (beyond the plan below):** the demo's seed has no row in `change_event`, `source_change`
  or `source_import`, so neither the seed loader nor the contract suite has ever loaded or compared those tables'
  reads on Postgres with rows in them. KB has all three. Step 2's copy test therefore builds demo data that has them:
  an import and a re-import through the domain's commands (`importSources`) into a demo workspace, which writes
  imports, changes to resolve and change events, before the file is written and copied (F6). The reads of
  `tests/contract/reads.test.ts` then compare those tables on both adapters.

### Q3. The upgrade in memory

- **The current format is 17, not 16** (`DEV_DB_FORMAT = 17`, slice 25's `workspace.infodoc`; the PRD's "fact" is
  wrong). KB's file was at 16 on 10 November (slice 24) and slice 25 left its upgrade to 17 to Łukasz's command; whether
  it was done is unknown (Q2 prints it).
- **`upgradeDb(db, now, newId)`** (`src/data/local/file.ts`) is pure on the object it is given: it writes no file (the
  write back, the upgrade-8 report file and the log lines are `readDb`'s, which the copy must not call: it also asserts
  the local mode, which a Postgres script is not in). **What it makes, by the file's format:**
  - 16: only `infodoc` false on every workspace: no rows, no ids.
  - 15 and older: the stereotypes (`upgradeTo16`: rows with new ids and `now`), 8 and older the organizations' development
    password (`organization_access`, no id), 7 and older the classifications and notes (`upgradeTo8`, new ids), 6 the
    derived changes to resolve with their change events (new ids).
  - So the ids are stable from copy to copy at format 16 or 17; below 16 every copy gives the upgrade's rows new ids and
    times. That is acceptable under C2.2 (a copy replaces KB as a whole, and no other row refers to those ids across
    copies), but backups of two copies would differ in those rows. **Proposal:** the copy accepts formats 2 to 17 as the
    local adapter does, refuses a newer one (`newerFormatMessage`'s rule) or anything else, and prints the upgrade's
    rows per table (as Q2's script does) so a second copy's difference is explained.

### Q4. Sign-in fields

- **`app_user` has no password field** (the migration and `AppUser`: id, e-mail, name, created_at, last_seen_at; Postgres
  adds `auth_user_id`). **The PRD is wrong** that "the password hash" is a person's: the only local secret is the
  **organization's** shared password, `organization_access.access_hash` (scrypt; D-58, slice 8). The development sign-in
  (the test users' list) is a page, not data. The session cookie's unlocked organizations are not data either.
- **Online:** `organization_access` is **not copied** (C1.2). Nothing needs it on Postgres: the session unlocks every
  organization a person belongs to (`postgresSession` in `src/app/_lib/session.ts`), so KB needs no "unlocked" state; the
  workspace home's access box reads `getAccess(…)?.version ?? null`, and `changeOrganizationPassword` inserts a row when
  there is none. The demo's organizations have rows (the seed's demo hash) that nothing online reads either.
- **The change events of KB's password** are copied with KB's history: their images hold the marker `(changed)`, never
  the hash (`SECRET_COLUMNS`, `src/domain/changes.ts`), so no hash leaves the laptop through them. Step 2 checks it on
  the rows before writing (no `access_hash` value in any image), and refuses otherwise.
- **AD-32's 403** is the local adapter's locked organization; on Postgres no organization is locked.

### Q5. The stored order

- The loader (`src/data/postgres/load.ts`) stamps each row's time column (`timeColumnOf`: `created_at`, or `added_at`,
  `occurred_at`, `changed_at`; `project_pinned_label` none, ordered by key) with its place among its table's rows in the
  same millisecond (`stampPlaces`), after moving a crowded millisecond's rows past the 999th into the following
  milliseconds (`spreadCrowded`). Both are pure functions of the rows' order: the copy reuses them **as they are** (T3).
- A value not in the domain's ISO text in milliseconds stops `withPlace` with an error (no write): Q2 counts such values.
- KB's imports wrote thousands of change events in one millisecond: their `occurred_at` moves by a millisecond per further
  999 (AD-12's note). The history panel shows them unchanged to the second.

### Q6. The loader's shape

- **`loadRows` cannot be used as it is:** it refuses a database with rows, and its `reset` truncates every public table.
  **Proposal:** a sibling in the same file, `loadOrganization(db, schema, data, organizationId)`, sharing its pieces
  (`tablesInKeyOrder`, `databaseReferences`, `strayFields`, `spreadCrowded`, `stampPlaces` and the insert statement, moved
  into one internal function both call; `loadRows` unchanged in behaviour). `pg:seed` and the contract suite keep calling
  `loadRows`.
- **Selecting KB's rows** (pure, `scripts/lib/organization-rows.ts`, tested): the organization by name (exactly one, or
  by `--organization <id>`), its workspaces, every row of its workspaces, its organization rows except
  `organization_access`, and the people its rows name.
- **One transaction:** (1) `select … for update` on the organization's row and its workspaces' rows (so a write on the
  preview at that moment waits behind the copy, or is refused as busy, as AD-38's locks do); (2) delete KB's
  `undo_step` rows; (3) delete KB's rows in the reverse of the key order (its workspaces' rows by `workspace_id`, then the
  workspaces, then the organization's rows), soft-deleted rows included; (4) insert the file's rows in key order, stamped;
  (5) the people (F1, F2); (6) the counts: per table, KB's rows in the file against KB's rows in the database (by its
  workspaces or its organization), not the table's total; a difference rolls back.
- **People are never deleted** (F2): `app_user` rows are inserted when missing and otherwise left as they are (keeping
  `auth_user_id`), so a second copy, `--remove` and a restore keep Łukasz's link and nobody else's person row is touched.
- `--remove` is steps 1 to 3 and the counts (zero), in one transaction.

### Q7. Backup's file

- **Shape: the local file's** (`DevDb`: `format` 17 and every table, empty where KB has none, module tables under their
  names), holding only KB's rows and the people they name, without `auth_user_id`. So `pg:restore` is the copy reading
  that file (one loader, C2.1), and the local adapter could open it too (`INFOMAPPER_DEV_DB`), which helps on the switch
  day. The rows come from the store's reads in the stored order, so a restore stamps them back in the same order.
- **Folder:** `.data/backups/pg/kb-<yyyymmdd-hhmm>.json` (`.data/` is git-ignored), with counts per table printed.
- **Size:** from Q2 (KB's share of the file's bytes); expected small next to the demo (KB on 28 October: 8 entities, 49
  attributes, 72 columns; since then more).
- **`undo_step`:** not in the backup; a restore and a copy empty KB's undo histories (an undo step points to a change
  group whose rows changed under it). Online changes made since the backup go with the restore (C1.1).

### Q8. The guard

- **Proposal: no marker; the reset refuses while the database holds any organization the seed does not make**, compared
  by name with the organizations of `seedRows()` (InfoMate, Retail Co). That catches KB without a schema change and
  without its name in the repository, and also any organization made online on the preview, which a reset would lose as
  well. The message names the order (`pg:backup`, `pg:kb -- --remove`, then the reset) and the count of such
  organizations, never their names. An organization id from the file (the PRD's other option) would need the laptop's
  file or a marker column; a marker needs a migration (section 3 expects none).
- **Other ways to empty a table KB uses:**
  - `pg:seed -- --reset`: the guard.
  - `pg:seed` without `--reset`: refuses any database with rows already (`hasRows`).
  - The contract suite: its own databases in CI's container, `INFOMAPPER_CONTRACT_DB` localhost only (slice 29).
  - The smoke set: Supabase's local stack in CI; it never reseeds; the writes spec only against a database on the
    machine (F13).
  - `pg-lock-check`: its own workspace in InfoMate, soft-deleted at the end; its comment "KB is not in infomapper-dev"
    becomes wrong and is changed in step 3.
  - The measuring specs: write in the workspace they are given (below); never a reset.
  - **`pg:accounts`** (F3): it does not empty a table but it gives **every** person the demo password and prints every
    e-mail; with KB copied it would set the demo password on Łukasz's real account and print his real e-mail.

### Q9. The measuring spec

- **The two fixes** as the scratchpad copy did (`docs/prd/slice-30-measurement.md`): the times stamped in the page every
  frame from the indicator's `data-state` (a `requestAnimationFrame` loop, since the indicator may be mounted again), the
  end read with `waitForFunction(…, { polling: "raf" })`; the page's timing record counted as a refresh only when it
  changed, waiting up to 2 s outside the timed span; the card dragged by a header in view. Also the copy's lessons: a
  toast is told by its text at the end, not by a new element; Undo's redo row has a new change group.
- **Variables, so KB is never named:** `MEASURE_WORKSPACE` (the workspace's id), `MEASURE_EMAIL_VAR` and
  `MEASURE_PASSWORD_VAR` naming the variables of `.env.postgres.local` to sign in with (proposal: the KB account's
  `INFOMAPPER_KB_EMAIL`, `INFOMAPPER_KB_PASSWORD`; default the demo's Łukasz and `INFOMAPPER_DEMO_PASSWORD`). The
  largest canvas is found in the database (the canvas with most live cards in the workspace), the entity to rename and
  the card to move as the largest canvas's first entity card in view, a document as the workspace's newest shared one
  (none: the editor's row says "none"). The spec puts every name it changed back and undoes its writes at the end.
- **Also S29-08** (the reads): the PRD's reads on KB use `e2e/slice-29/S29-08-measure.spec.ts`, which names its data sets
  and signs in as the demo's Łukasz; it needs the same variables (F4). Its `LOCAL_DB` reads any file it is given: it
  gets the same refusal of `dev-db.json` as the copy.
- **Raw files:** `.data/measure/s31/` (git-ignored). **No trace, video or screenshot, no HTML report:** with
  `MEASURE_WORKSPACE` set the config records none whatever the target (`playwright.pg.config.ts` records traces on
  failure against a local server today, and writes an HTML report with the console output to `playwright-report-pg/`).
  The console prints sizes and times only.
- **Uploads:** CI never runs the measuring specs (`MEASURE=1` only, and the e2e workflow's parts leave `e2e/slice-29`
  out); the repository is public, so the rule is written into the spec's header and into CLAUDE.md.

### Q10. Shared infrastructure and risks

- **Touched and shared:** `src/data/postgres/load.ts` (`pg:seed`, the contract suite, the smoke job's seed), `scripts/pg-seed.ts`
  (the guard), `scripts/pg-accounts.ts` (F3), `src/data/postgres/write.ts`'s `LOCK_TIMEOUT` (every write online),
  `scripts/pg-lock-check.ts`, the two measuring specs, `playwright.pg.config.ts`. **Not changed:** `upgradeDb` (called,
  never changed), the table registry, the local adapter, undo and change groups, the save chain, the canvas: none of the
  list in "Test runs"' exception, so no step needs a full run of its own (below).
- **The shared `infomapper-dev`:** the laptop's `dev:pg` and `dev`'s preview show KB the moment a copy commits, and KB
  online changes as soon as either writes. The demo accounts see it only if a demo person is a member (Q2's count;
  S31-02). A copy while the preview writes into KB: the locks (Q6).
- **Vercel's 4.5 MB:** the editor's snapshot of KB (`scripts/pg-snapshot-size.ts`, at the measurement) against
  Performance test's 2.25 MB; KB is expected far smaller.
- **Nothing in the code changes the plan** beyond F1 to F6 below.

## Where the PRD is wrong, contradicts the code or costs more (with proposals)

- **F1. People across organizations (Q1).** The PRD copies "its members' `app_user` rows"; KB's rows also name people
  who are not members (former members, the demo's people if any wrote there). Proposal: copy every person KB's rows name;
  a person whose id exists online is kept as it is; a person whose e-mail exists online with another id (a demo person)
  makes the copy **stop with counts** (no write): then Łukasz decides between mapping those ids to the online person in
  the copy (every column that refers to `app_user`, change images left as written) or leaving them out. Q2's count says
  whether it happens at all; if it is zero, step 2 builds only the stop.
- **F2. The link is lost on a second copy.** Deleting and inserting KB's people (as C2.2 reads) drops `auth_user_id`, so
  every copy would need `pg:accounts` again. Proposal: people are never deleted (Q6); `--remove` keeps them too (a person
  without a membership sees nothing).
- **F3. `pg:accounts` would expose Łukasz's account.** As it stands it sets `INFOMAPPER_DEMO_PASSWORD` on every person in
  `app_user` and prints every e-mail. Proposal: by default it handles only the people of the seed's organizations (Q8's
  rule) and says how many it left out; `pg:accounts -- --kb` links only the person whose e-mail is
  `INFOMAPPER_KB_EMAIL` (in KB) with `INFOMAPPER_KB_PASSWORD`, prints "linked" and counts, never the e-mail. Both
  variables only in `.env.postgres.local` (never in Vercel, `.env.example` lists the names), and the Never-in-Vercel list
  in CLAUDE.md gains them.
- **F4. S29-08 is the reads' spec and needs variables too** (Q9); the PRD names only S30-measure.
- **F5. `lock_timeout` 15 s needs `pg-lock-check`'s hold past it:** it holds the row 13 s today, "past" 10 s; at 15 s the
  check would wait and store instead of showing busy (S31-08). Proposal: hold 18 s.
- **F6. The demo's file in the tests.** "`npm run seed`'s `.data/demo-db.json`": `npm run seed` writes `.data/dev-db.json`
  (`npm run demo` writes `demo-db.json`), and CI has neither. Proposal: the contract test builds the demo with
  `seedRows()`, writes it as a local file in a temporary folder (JSON, as the local adapter stores it), reads that file
  back through the same path the copy reads (parse, upgrade in memory) and copies each of its organizations into a fresh
  database with `loadOrganization`; the local adapter reads the same file.
- **F7. The format fact** (Q3): 17, not 16.
- **F8. The password hash** (Q4): an organization's, not a person's; not copied; the change events carry a marker.
- **F9. T2's path rule** (proposal): the copy and `pg:restore` read only a file under `.data/backups/` (its resolved real
  path, so no link out of it), never one named `dev-db.json`, and copy it to a temporary file first, reading only the
  copy (CLAUDE.md: "KB is read only on a copy of a backup"); the backups' own folder `.data/backups/pg/` qualifies.
- **F10. The target's check** (proposal): `INFOMAPPER_MIGRATION_URL`'s database must be `postgres` and its user name (the pooler's
  `postgres.<reference>`) must carry the project reference of `SUPABASE_URL`'s host (both from `.env.postgres.local`), and
  `INFOMAPPER_SERVER_NAME` must be `dev`;
  otherwise refused. A literal project reference in the repository is avoided. Until slice D.
- **F11. A full run in step 3** (the PRD) is not required by the rule: nothing there touches the list in "Test runs"'
  exception (the Postgres write path, scripts and Postgres-only specs; the full run is on the local adapter and runs none
  of them). Proposal: CI and the Schema workflow after each step, and the one full run before the merge (step 5).
- **F12. The "KB never in a run" check** (C1.2, S31-09): a Vitest test in `tests/` that scans `e2e/`, `tests/`,
  `playwright*.config.ts`, `scripts/e2e*.ts` and `.github/` for `dev-db.json` read as data (not as `INFOMAPPER_DEV_DB`'s
  e2e override), `.data/backups`, and the variables `INFOMAPPER_KB_EMAIL` / `INFOMAPPER_KB_PASSWORD` (allowed only in
  the measuring specs' variable defaults and `scripts/pg-*.ts`). KB's name is not in the repository, so the check cannot
  name it; the existing `organizationName: "KB"` in `tests/infocube-c7.test.ts:93` (a licence label in a unit test) is
  renamed in step 3 so no file says "KB" as an organization.

## C1.2's condition: every account, organization and workspace the specs sign into

Checked in the code (no file under `.data/` opened). **None is KB, and none uses Łukasz's real e-mail;** his real
e-mail is in no committed file.

| Account | Defined | Used by | Organizations and workspaces |
| --- | --- | --- | --- |
| `lukasz@infomate.pl` (Łukasz) | `src/data/local/seed.ts:45`, `e2e/slice-29/helpers.ts:9` | most e2e specs (`signInAs`, `signInByName`, the organization password form), the e2e global setup, S29-05/06, S30-smoke-writes, S29-08, S30-measure, `pg-lock-check` | InfoMate (owner); owner of Retail Co – DWH, Bank X – Risk DWH (archived), Performance test; reviewer in Sales analytics |
| `anna.nowak@infomate.pl` (Anna Nowak) | seed.ts:46, helpers.ts:10 | e2e, S30-measure | InfoMate; modeler in Retail Co – DWH and Bank X |
| `piotr.w@infomate.pl` | seed.ts:47 | e2e | InfoMate; reviewer in Retail Co – DWH |
| `k.zielinska@retailco.com` | seed.ts:48, helpers.ts:11 | e2e, S29-05 | Retail Co; reader in Retail Co – DWH |
| `m.lis@retailco.com` | seed.ts:49, helpers.ts:12 | S29-05 | Retail Co (owner); owner of Sales analytics |
| `rita.reader@infomate.pl` | `e2e/slice-25/helpers.ts:119` | slice 25 (added by the spec) | reader in Retail Co – DWH |
| `jan@example.com`, `ola@example.com`, `ola@elsewhere.test` | slice 8, 23, 24 specs | sign-up and add person | organizations and workspaces the specs make: Test Org, Deutsche Org, Second, Elsewhere; First workspace, Lager, Hurtownia, Pricing 2026, Pricing (old), Stale |
| `Lukasz@InfoMate.pl`, `nobody@example.com`, `nobody@retailco.com` | S8-03, S8-04, S29-05 | case and refusal checks | none |

- **The data they run on:** the e2e runs `.data/e2e-db.json` from the seed (`playwright.config.ts` sets
  `INFOMAPPER_DEV_DB`), the smoke set Supabase's local stack loaded by `pg:seed` (`seedRows()`, no file), the measuring
  specs `infomapper-dev`'s demo (or with S29-08's `LOCAL_DB` the file given: F9's refusal). Workspaces named in the
  Postgres specs: Retail Co – DWH, Performance test; `pg-lock-check` makes "Slice 30 lock check" in InfoMate.
- **Files that name the local file or backups:** comments and the e2e override in e2e specs and helpers; scripts that
  default to `.data/dev-db.json` (`seed`, `seed-large`, `reset-dev-data`: CI runs `reset-dev-data` only through the e2e
  server, which sets the variable); `scripts/demo.ts` and `scripts/count-checks.ts` refuse `dev-db.json`; unit tests use
  temporary `dev-db.json` paths.
- **Public artifacts:** the repository is **public**, so its Actions artifacts can be downloaded by any signed-in GitHub
  user for 14 days: the E2E workflow's reports and `test-results` (traces, `server.log`) and the Schema workflow's
  `smoke-report` on failure. None can hold KB: every runner checks out fresh, `.data/` is git-ignored, and the data is the
  seed's. The traces hold the demo's e-mails and passwords, which are public already.
- **Risks on the laptop only:** S29-08 with `LOCAL_DB`, and `npm run measure:start` without `INFOMAPPER_DEV_DB`, would
  read or serve `.data/dev-db.json` (F9 for the first; the second is outside this slice and listed as a known risk).

## The earlier specs and tests each step touches

| Step | Changed | Earlier specs and tests run |
| --- | --- | --- |
| 2 | `src/data/postgres/load.ts` (the shared insert, `loadOrganization`), `scripts/pg-kb.ts`, `scripts/lib/organization-rows.ts`, `scripts/pg-seed.ts` (the guard), `scripts/pg-accounts.ts` (F3), `scripts/lib/pg-env.ts` (F10's target check), `.env.example`, `package.json` | `tests/contract/reads.test.ts` and `writes.test.ts` (their setup loads through `load.ts`); new `tests/contract/copy.test.ts`; the Schema workflow's smoke job (its `pg:seed`); CI's unit tests and lint |
| 3 | `scripts/pg-backup.ts`, `scripts/pg-restore.ts`, `src/data/postgres/write.ts` (`LOCK_TIMEOUT`), `scripts/pg-lock-check.ts` (F5), `e2e/slice-29/S30-measure.spec.ts`, `e2e/slice-29/S29-08-measure.spec.ts`, `playwright.pg.config.ts`, a new guard test, `tests/infocube-c7.test.ts` (the label) | the contract suite (the busy refusal's test, `writes.test.ts`), the smoke set (`playwright.pg.config.ts` changed), S29-08 and S30-measure once against `dev:pg`'s demo with `MEASURE=1` (no write into KB), the unit tests |
| 4 | none (Łukasz's acceptance) | – |
| 5 | docs | the full run |

## The plan for steps 2 to 5

- **Step 2, the copy and the account** (no run on `infomapper-dev`): `organization-rows.ts` (pure, tested on the seed);
  `loadOrganization` sharing `loadRows`' insert; `pg:kb <backup>` (copy, again, `--remove`, F9 and F10, the counts, the
  people's stop of F1); `pg:accounts` by default the seed's organizations only, `--kb` for Łukasz's account (F3); the
  reset's guard; `kb-counts.ts` if not added before (Q2). Tests: `organization-rows`, the path rule and the format
  refusals in unit tests; the copy, the copy again with another organization's undo steps untouched, `--remove`, the
  stray field, the people's stop and the guard in `tests/contract/copy.test.ts`, and the reads of `reads.test.ts` on the
  local file against Postgres after a copy (S31-10). A draft PR into `dev` (CLAUDE.md: at step 2). CI and the Schema
  workflow; no full run (F11).
- **Step 3, backup, restore, `lock_timeout`, the specs:** `pg:backup` (one read-only REPEATABLE READ transaction, the
  local file's shape, `.data/backups/pg/`), `pg:restore <file>` (the copy reading it), their contract tests (restore
  after a change gives the backup's rows and counts; other organizations untouched); `LOCK_TIMEOUT` 15 s, `pg-lock-check`
  holding 18 s; the two measuring specs' fixes and variables, the config recording nothing in that mode; F12's guard
  test. The measuring specs run once on `dev:pg` against the demo as their own check. CI and the Schema workflow; no
  full run (F11), unless Łukasz keeps the PRD's.
- **Step 4, Łukasz's acceptance:** his commands one at a time (the SHA-256 of `.data/dev-db.json` first; a fresh backup;
  `kb-counts` if not done; `pg:kb` from the backup's copy; `pg:accounts -- --kb`; sign-in on `dev`'s preview and on
  `dev:pg`; the demo accounts not seeing KB; `pg:backup`, a change online, `pg:restore`; a change locally, `pg:kb` again;
  `pg:seed -- --reset` refused; the SHA-256 again). Stop with what he saw.
- **Step 5, close:** the docs (`decisions.md`: AD-31 amended, AD-39, AD-38's note; `known-limitations.md`; `ideas.md`;
  README; CLAUDE.md's test model, commands, environments and the Never-in-Vercel list), the decisions quoted in full; one
  full run on the final commit (merging `dev` first). Merge and tag on Łukasz's command; the measurement on KB as a
  `chore/` PR after it (S31-06).

## Decisions on step 1 (Łukasz, 19 November 2026)

Claude took the technical calls on Łukasz's behalf, as agreed; they are quoted for his approval at the closing.

- **F1 to F12:** accepted as proposed above.
- **Question 2 (F1):** decided after the counts. If no person named by KB's rows has a demo person's e-mail, step 2 builds
  only the stop. If some have, the copy maps them to the online person, in every column that refers to `app_user`, and
  leaves the change images as written. Leaving them out is not an option, because of the foreign keys. **The counts
  found none, so only the stop is built.**
- **Question 3 (Q8):** yes. The reset's guard refuses while the database holds any organization the seed does not make:
  no marker, and no name of KB in the repository.
- **Question 4 (F11):** no full run in step 3, and one full run before the merge (step 5).
- **Question 1 (Q2):** the count script was added now, in its own commit on `slice/31-kb-copy`, before step 2 (`a3c72ad`),
  and was run on Łukasz's command (Q2 above).

## Step 4: Łukasz's manual acceptance (19 November 2026)

Łukasz ran each command himself on his laptop, on `slice/31-kb-copy` at `33e4d9e`, against `infomapper-dev`. The checks
in the app were on `npm run dev:pg` (environment 2, the same database as `dev`'s preview).

| Criterion | What was run | Result |
| --- | --- | --- |
| S31-07 (before) | `Get-FileHash .data\dev-db.json` | `F2B60E19C457190D878F7052A331A84DCFB4E6FDFD32978A…` |
| – | a fresh backup | `.data/backups/dev-db-20261119-2015.json`, also as `kb-model-latest.json` |
| S31-01 | `npm run pg:kb -- .data/backups/dev-db-20261119-2015.json` | format 17, the upgrade in memory made no rows; 4,871 rows, equal per table in the file and the database (38 tables, the same counts as Q2's); 1 person; copied in 38 s |
| S31-01 | `npm run pg:accounts -- --kb` | "The --kb account: created, linked." |
| S31-01 | sign-in on `dev:pg` with his real e-mail | organization KB with "Kanton Basel": its projects, canvases and model as locally |
| S31-02 | sign-in on `dev:pg` as the demo's Łukasz, in a private window | no KB: only the demo's organizations |
| S31-03 | `npm run pg:backup` | `.data/backups/pg/kb-20261119-2043.json`, 6,477,493 bytes, 4,891 rows (20 more change events than the copy: the online changes of the sign-in check, a few card moves and an attribute's rename) |
| S31-03 | an entity renamed online ("… TEST"), then `npm run pg:restore -- .data/backups/pg/kb-20261119-2043.json` | 4,891 rows, equal per table; "People: 1, of them 1 online already and kept as they are"; in the app the entity has its name back without " TEST" |
| S31-05 | `npm run pg:seed -- --reset` | refused: "The database holds 1 organization the seed does not make (a copy of Łukasz's model, or one made online): nothing was reset. First npm run pg:backup, then npm run pg:kb -- --remove, then the reset." |
| S31-07 (after) | `Get-FileHash .data\dev-db.json` | `F2B60E19C457190D878F7052A331A84DCFB4E6FDFD32978A…`, the same: no command of the slice changed the file |

**Not run in the acceptance, on Łukasz's decision (19 November 2026):**
- **S31-04, the copy again after a local change.** The first copy and the restore both go through `pg:kb`'s one path
  (`readBackupCopy`, `placeAll`, `organizationRows`, `replaceOrganization`); the restore replaced KB's rows as a second
  copy would. The copy again is covered by `tests/contract/copy.test.ts` ("copies again: an online change and the
  organization's undo steps go, another organization's stay, and a person's link stays").
- **S31-08, `pg-lock-check` on `infomapper-dev`.** It was run in step 3 on a throwaway local cluster with the demo loaded:
  the write was refused as busy after 15,009 ms (`lock_timeout` 15 s), and the reset's guard refused through `pg:seed`
  with the database unchanged.

**Found during the acceptance: the development server logs server actions' arguments.** On `npm run dev:pg`, the sign-in
printed the e-mail and the password typed, in plain text, in the server's terminal: Next.js's development server logs
every Server Function invocation with its arguments by default (`logging.serverFunctions`, not set in
`next.config.ts`). It reached only the laptop's terminal; production builds (the preview, the smoke job) do not log it.
The e2e workflow's public `server.log` artifacts hold the same kind of lines, with the demo's data and the development
passwords. Łukasz was advised to clear the terminal and change the online password. The fix, `logging: { serverFunctions:
false }` with a guard test, touches shared configuration, so it is a `fix/` branch of its own (CLAUDE.md, "The slice
cycle", 4), proposed as a separate task, not part of this slice.
