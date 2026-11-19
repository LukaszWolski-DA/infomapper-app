# Slice 31 – Database C: KB copied into the database (copy, backup, restore, the measurement on KB)

Status: **proposed** (19 November 2026). Proposed by Łukasz on 19 November 2026. **Full path** (CLAUDE.md, "The slice
cycle", 2): new scripts that write to `infomapper-dev`, the local file's upgrade used by a loader, a guard on
`pg:seed`, a change in the writes' lock (`lock_timeout`), the measuring spec. Branch `slice/31-kb-copy`, from `dev`
(`4d920f3` or later). PRD file: `docs/prd/slice-31-kb-copy.md`; step 1 writes `docs/prd/slice-31-acceptance.md`. Test
regime: CLAUDE.md, "Testing". Slice number 31 is an assumption (the next free number); step 1 confirms.

The third slice of the database program (AD-31 as amended: C, the local JSON copied in). **No prototype change**: nothing
visible changes in the app (T7 below). The PRD is in Łukasz's Downloads folder (The slice cycle, 3):

| File | SHA-256 |
| --- | --- |
| `slice-31-kb-copy.md` | given in the prompt |

Written from the decision rounds of 19 November 2026 (no file in the repository; quoted below as "C1", "C2" and
"T1" to "T7"), slice 29's and slice 30's PRDs, acceptance and measurement docs, `docs/decisions.md`, `docs/ideas.md`
("The database program: what comes later") and CLAUDE.md, with a few lookups in the code on `dev` at `4d920f3` (marked
"fact, `4d920f3`"). Facts and assumptions are marked; every assumption is to be checked in step 1.

## 1. Why

Slice 30 made the model editable online. Łukasz's own model, organization **KB** with the workspace "Kanton Basel",
lives only in his local file (`.data/dev-db.json`). This slice copies it into `infomapper-dev`, so he can open it on
`dev`'s preview, and **measures reads and writes on KB** there. The measurement decides two things Łukasz left open: the
day KB online becomes the master, and whether the read fixes slice is needed before further work.

Decisions taken before this PRD:
- **The program's order (Łukasz, 19 November 2026).** Slice C comes before the read fixes slice (changes the handover's
  order and `docs/ideas.md`'s "The read fixes, a slice of their own after slice B"). The read fixes slice follows only if
  this slice's measurement shows it is needed, aimed at what is slow on KB. Moved into this slice: `lock_timeout` 15 s,
  the measuring spec's two flaws, the measurement on KB.
- **Slice 30's measurement (Łukasz, 19 November 2026):** `lock_timeout` 15 s with AD-38's text; the measuring spec's two
  flaws fixed (Playwright's polling steps; the first load counted as the refresh); Vercel's runtime logs not needed.
- **C1.1 (c): the local KB stays the master at first.** The online copy is for the measurement and trials and may be
  copied again, overwriting what was changed online. Łukasz sets the switch day after the measurement; on that day the
  last copy is made from the local file; from then on KB online is the master and the local file a backup. Nothing in
  this slice switches.
- **C1.2 (yes): KB may leave the laptop into Supabase (`infomapper-dev`).** Amends Łukasz's decision of 28 October 2026
  (KB on his disk only). Copied: the model's content and his e-mail; **not** the password hash from the file: he signs
  in through a Supabase Auth account with his real e-mail. **Condition:** no e2e, smoke or measuring test opens KB or
  signs in with his real e-mail in a run whose artifacts are public. Facts: Row Level Security is deny-all against the
  API roles and the Data API is off (AD-05's note, AD-37); the demo accounts are not members of organization KB
  (assumption, step 1). Preliminary fact (`4d920f3`): no file in `e2e/` or `tests/` names `kb-model` or "Kanton".
- **C2.1 (b): backups by our own script, built here.** `pg:backup` writes organization KB's rows from `infomapper-dev`
  to a JSON file on the laptop (git-ignored); `pg:restore` loads it back, replacing only organization KB. No Supabase
  settings, no clicks. Supabase's own backups may come in slice D.
- **C2.2 (a): a copy again replaces only organization KB** (its rows deleted and inserted again in one transaction); the
  demo, "Performance test", the accounts and their histories stay.
- **C2.3: the technical questions are Claude's call** (T1 to T7 below), quoted in section 8 for Łukasz's approval at
  the closing.

## 2. What to build

### The copy (`pg:kb`)

- **T2. Read only from a copy of a backup.** The script takes a file path; it never opens `.data/dev-db.json` itself
  (CLAUDE.md: "KB is read only on a copy of a backup, printing counts only"). Proposal: it refuses the path of
  `.data/dev-db.json` and any path outside `.data/backups/` or a scratch copy made by the script from the newest backup
  (step 1 proposes which). The file is upgraded to the current format **in memory** with the local adapter's own
  upgrade (fact, `4d920f3`: `upgradeDb` in `src/data/local/file.ts`, current format 16), never written back; a format the
  code does not know is refused.
- **T1. What is copied:** every row of organization KB in the file (its workspaces and everything in them, module rows
  included; its members' `app_user` rows; `change_event` and the other history rows), keeping their ids, so links stay
  and a second copy is stable. **Not copied:** the password hash and every other local sign-in field (the organization's
  password too, Q4); rows of other organizations in the file. **Undo starts empty online** (the local undo history is in
  memory only, slice 30, Q4 (a)).
- **One transaction, checked by counts** per table against the rows taken from the file; it refuses a field no column
  holds (as the seed loader, AD-37). It prints counts only: no names, no content, no e-mail.
- **T3. The stored order:** the time columns' microseconds set by the rows' places in the file, 999 per millisecond, the
  following rows moved into the next milliseconds (AD-12's note, written for "slice C's copy of a file").
- **C2.2. Again:** a second run deletes organization KB's rows and inserts them again in the same transaction. Other
  organizations, accounts and their undo histories stay. `pg:kb -- --remove` removes organization KB only.
- **The target:** `INFOMAPPER_MIGRATION_URL` from `.env.postgres.local`, named as host/database only; refused when it
  is not `infomapper-dev` until slice D (step 1 proposes the check).
- **The loader is general, the command is for KB:** proposal: a function that copies one named organization from a
  local file (used by `pg:kb` with KB, and by the tests with the demo's file, section "Tests"); the organization chosen by
  name or id (step 1).

### Łukasz's account (T5)

`pg:accounts` gains an option: his real e-mail and his password from variables in `.env.postgres.local` (names proposed
in step 1; never in the repository), makes or keeps his Supabase Auth account and links his `app_user` row from KB
(`auth_user_id`). Nothing is printed but "linked" and counts. Assumption (step 1): KB's people are Łukasz only; any other
`app_user` in KB is listed by count and left without an Auth account.

### Backup and restore (C2.1)

- `pg:backup` reads organization KB's rows from `infomapper-dev` in one read-only transaction and writes a JSON file to
  the laptop, named with the date and time, in a git-ignored folder (proposal: `.data/backups/pg/`), with a count per
  table. Proposal: the same shape the copy reads (so a backup can be copied in again by `pg:restore` with the same
  loader); step 1 decides whether that is the local file's shape or a table-per-key shape.
- `pg:restore <file>` replaces organization KB with the file's rows in one transaction, counts checked; nothing else
  changes. Undo histories of KB's workspaces are emptied (proposal: an undo step pointing to rows that changed under it
  must not survive; step 1 checks what `undo_step` holds).

### The reset guard (T4)

`pg:seed -- --reset` refuses while organization KB is in the database, with a message naming the order to follow:
`pg:backup`, then `pg:kb -- --remove`, then the reset. No override flag. Proposal: KB is recognised by a property the
copy sets (step 1: the organization's id from the file, or a marker), not by its name.

### `lock_timeout` 15 s

`LOCK_TIMEOUT` in `src/data/postgres/write.ts` (fact, `4d920f3`) from 10 s to 15 s; AD-38's text; `pg-lock-check` shows
it; the "busy" refusal unchanged.

### The measuring spec's two flaws

`e2e/slice-29/S30-measure.spec.ts` (fact, `4d920f3`) as slice 30's measurement found and its scratchpad copy did
(`docs/prd/slice-30-measurement.md`, "How it was measured"): times stamped in the page from the save indicator's
`data-state` every frame, not Playwright's polling; the page's timing record counted as a refresh only when it changed
(waiting up to 2 s, outside the timed span); a card whose header is in view. **Proposal:** the spec takes the workspace
and canvas to measure and the account from variables, so it measures KB without naming it in the repository.

### Measurement on KB (after the merge)

As slices 29 and 30, as a docs-only `chore/` PR after the merge (L4 (b)), on `dev`'s preview, only after Łukasz has run
`pg:kb`:
- **Reads:** the workspace home, a project home, KB's largest canvas, its thumbnail, a document's editor and snapshot;
  warm medians of 10 (2 discarded first), with calls, statements, wait, read span and server total; the demo's figures
  beside them.
- **Writes:** a rename, a card's move, adding an attribute, Undo; action to "Saved" and the refresh's split, with the
  fixed spec.
- **The snapshot's size for KB** against Vercel's 4.5 MB (`scripts/pg-snapshot-size.ts`).
- The measuring writes are undone by Undo at the end (C1.1 makes it a courtesy, not a need). No thresholds beforehand:
  Łukasz decides after.
- Signed in as Łukasz with his real e-mail, run from the laptop only: its raw files git-ignored, no trace, video or
  screenshot committed or uploaded; the report names KB's objects by role ("the largest canvas"), with sizes, not names.

### Tests

- **The copy proved by the contract suite:** the demo's local file (`npm run seed`'s `.data/demo-db.json`, or a file
  built the same way) copied into a fresh database by the same loader; every read of the contract suite on the local
  adapter over that file and on Postgres after the copy gives the same results. In the Schema workflow's container.
  Never KB.
- **The copy again, `--remove`, backup and restore:** on the same container: a second copy leaves other organizations
  and their undo steps untouched; restore after a change gives the backup's counts and rows; the reset refuses with an
  organization marked as KB present.
- **T2's refusals:** the copy refuses `.data/dev-db.json`'s path, an unknown format, a field no column holds.
- **KB never in a run (C1.2):** a check (proposal: in CI) that no spec, fixture or helper names KB's organization or
  workspace or reads `.data/dev-db.json`; step 1 lists every account and workspace the e2e, smoke and measuring specs
  sign into.
- **`dev-db.json` unchanged:** each new command checked against the file's SHA-256 before and after, on Łukasz's
  laptop at his acceptance (S31-07).
- The full e2e run on the local adapter as usual.

### Not in this slice

The switch day (Łukasz's decision after the measurement); the read fixes (their own slice if the measurement asks for
it); "Add person" online, invitations and the rest of the people slice; Supabase's own backups, a dedicated database
role, production (slice D); a delete of a source system ("ideas.md"); KB's format upgrade in Łukasz's file (only on his
command, CLAUDE.md).

## 3. Data model

No schema change expected. **Assumption** (step 1): every field KB's file holds after the in-memory upgrade has a column
(the seed loader covers the demo's; KB may use fields the demo does not: module rows, InfoDocumenter's figures, aliases,
classifications, stereotypes, derivations). If one has none, step 1 stops and proposes.

## 4. Sources

- **Decisions:** AD-04 (note), AD-05 (note), AD-12 (note), AD-13, AD-19, AD-22, AD-31 (amended), AD-33, AD-37, AD-38;
  D-58, D-59.
- **Slice 29:** PRD, acceptance (F2's stored order, F11's body limits), `slice-29-measurement.md`; `scripts/pg-seed.ts`,
  `scripts/pg-accounts.ts`, `scripts/pg-snapshot-size.ts`, `e2e/slice-29/S29-08-measure.spec.ts`.
- **Slice 30:** PRD, acceptance, `slice-30-measurement.md` (the spec's flaws, `lock_timeout`), `src/data/postgres/write.ts`,
  `scripts/pg-lock-check.ts`, `e2e/slice-29/S30-measure.spec.ts`.
- **CLAUDE.md:** "Łukasz's test model", "Security", "Environments and hosting", the slice cycle's stops for KB.
- **`docs/known-limitations.md`:** "The editor's snapshot is half of Vercel's 4.5 MB", the shared `infomapper-dev`,
  "Add person" online.

## 5. Steps

Stop after each step; wait for Łukasz.

1. **Reconnaissance and check.** Copy this PRD from Downloads into the repository and check it with `cmp` and the
   SHA-256 (stop if it differs). Answer Q1–Q10 in `slice-31-acceptance.md`; every place where the PRD is wrong or costs
   more than it assumes, with a proposal; the earlier specs and tests each step touches; the plan for steps 2 to 5. **No
   application code, no write to `infomapper-dev`, KB not read** (Q2 says how KB's counts are read at Łukasz's command).
2. **The copy and the account:** the loader, `pg:kb` (copy, again, `--remove`), T2's refusals, the account option in
   `pg:accounts`, the reset guard; the tests above in the Schema workflow. A draft PR into `dev`. **Not run on
   `infomapper-dev`.**
3. **Backup and restore, `lock_timeout`, the spec:** `pg:backup`, `pg:restore` and their tests; `lock_timeout` 15 s;
   the measuring spec's fixes and its variables; the "KB never in a run" check. A full run.
4. **Łukasz's acceptance:** the prompt lists his commands one at a time: a fresh backup of his file, `pg:kb` from its
   copy, his account, sign-in on `dev`'s preview (the copy is data, so `dev`'s code already shows it: no deployment of
   the branch) and on `dev:pg`; backup, a change, restore; the copy again; the reset's refusal; the SHA-256 of
   `dev-db.json` before and after. **Stop** with what he saw.
5. **Close.** The docs and the decisions quoted in full for approval (section 8); one full run on the final commit.
   Merge into `dev` and tag `slice-31` only on Łukasz's command. The measurement on KB follows as a `chore/` PR.

## 6. Acceptance criteria

Łukasz's criteria 1 to 5 (19 November 2026) as S31 criteria.

| ID | Criterion |
| --- | --- |
| S31-01 | **KB online.** One command on the laptop copies KB; it shows the row counts on the laptop and in the database, and they are equal. Signed in on `dev`'s preview with his real e-mail, Łukasz sees organization KB with "Kanton Basel": projects, canvases, entities, attributes, mappings, sources and documents as locally, and the elements' change history the same. Undo is empty. (Criterion 1.) |
| S31-02 | **The demo accounts do not see KB**, on the preview and on `dev:pg`. (Criterion 1.) |
| S31-03 | **Backup and restore.** `pg:backup` writes a dated file on the laptop with counts; after a change in KB online, `pg:restore` with that file brings KB back to the backup's state, counts equal; the demo and its accounts untouched. (Criterion 2.) |
| S31-04 | **The copy again.** After a change in KB locally, `pg:kb` again shows the laptop's state online; changes made online before are gone; the demo and its accounts untouched. (Criterion 3.) |
| S31-05 | **The reset's guard.** `pg:seed -- --reset` with KB in the database refuses with the message naming backup and removal first; nothing changes in the database. (Criterion 3.) |
| S31-06 | **The measurement on KB** (after the merge, a `chore/` PR): reads, writes with the fixed spec, the snapshot's size, beside the demo's figures; the measuring writes undone. (Criterion 4.) |
| S31-07 | **Łukasz's file untouched.** The SHA-256 of `.data/dev-db.json` is the same before and after every command of this slice; the local app works as before. (Criterion 5.) |
| S31-08 | **`lock_timeout` 15 s:** a write waiting longer gets "busy", shown by `pg-lock-check`. (Criterion 5.) |
| S31-09 | **KB and Łukasz's e-mail never in a run or the repository:** no test opens KB or signs in with his real e-mail in CI; his e-mail and password are in no file in the repository, no log, no report and no artifact. (Criterion 5, C1.2.) |
| S31-10 | **Both adapters read the same after a copy:** the contract suite passes on the demo's file and on Postgres after the copy. (Criterion 5.) |
| S31-11 | CI, the Schema workflow, the full run before the merge; every earlier test changed, with its reason. (Criterion 5.) |

**Manual acceptance:** Łukasz, step 4: S31-01 to S31-05 and S31-07; he reads the measurement report after the merge
(S31-06).

## 7. Questions for step 1

- **Q1. KB in the file.** Which tables and fields KB's rows use that the demo's do not; whether every one has a column
  (section 3); which rows belong to an organization through which keys (workspace, module rows, InfoDocumenter's
  documents and figures, the people); rows that point across organizations (a guest, a shared reference) and what the
  copy does with them.
- **Q2. KB's counts before the copy.** Proposal: a read-only count script Łukasz runs on a copy of his newest backup
  (counts per table only), so step 2's tests and the measurement are planned on KB's real size. Its output pasted by
  Łukasz. Not run by CC without his command.
- **Q3. The upgrade in memory.** `upgradeDb`'s side effects (it may give passwords and new ids: fact, `4d920f3`, its
  report has `passwordsGiven`): whether ids it makes are stable from one copy to the next (C2.2 needs them stable or
  replaced as a whole), and what the copy does with them.
- **Q4. Sign-in fields.** Every local sign-in field (`app_user`'s password hash, the organization's password and
  unlock, the development sign-in) and how each maps online; whether organization KB needs an "unlocked" state on
  Postgres (AD-32's 403) and how the demo's organizations have it.
- **Q5. The stored order.** How the seed loader stamps the microseconds and whether the copy reuses it as is (T3);
  rows without a time column.
- **Q6. The loader's shape.** Shared with `pg:seed`'s `loadRows` or a sibling; how one organization's rows are selected
  and deleted (order of tables, foreign keys, soft-deleted rows, `undo_step`); the count check's form.
- **Q7. Backup's file.** Its shape (C2.1: readable by the same loader), its folder, its size for KB (Q2), and what
  restore does with KB's `undo_step` rows.
- **Q8. The guard.** How the reset recognises KB (T4); whether any other script or test can empty a table KB uses
  (`pg-lock-check`'s own workspace, the smoke set's reseed, the measuring spec) and how each is fenced.
- **Q9. The measuring spec.** The fixes (section 2), its variables, how it finds KB's largest canvas and a document
  without naming them; where its raw files go; that a run cannot upload artifacts.
- **Q10. Shared infrastructure and risks.** What this slice touches that others use (`upgradeDb`, `loadRows`, the
  table registry, `write.ts`'s lock, `pg:accounts`); the shared `infomapper-dev` (the laptop and the preview see KB as
  soon as it is copied; the measurement's writes); anything in the code that changes this plan.

## 8. Decisions (proposals) and docs

Quoted in full at the closing for Łukasz's approval; the texts below are proposals for step 1 to correct.

- **AD-31 (amended again):** "Slice C (slice 31) copies organization KB from a copy of Łukasz's local file into
  `infomapper-dev`, with backup and restore by script and a guard on the reset. The demo is loaded by the seed loader as
  before (no copy of the demo's file). The read fixes slice follows slice C only if slice C's measurement on KB asks for
  it (Łukasz, 19 November 2026)."
- **AD-39 (new): KB in the database** as built: the copy (T1 to T3, C2.2), the account (T5), backup and restore
  (C2.1), the guard (T4); the local KB stays the master until Łukasz's switch day (C1.1); what is never copied.
- **AD-38 (note):** `lock_timeout` 15 s (slice 30's measurement, Łukasz, 19 November 2026).
- **CLAUDE.md's "Łukasz's test model" (amended, C1.2):** KB may be copied into `infomapper-dev` (content and his e-mail,
  never the password hash); his file is still read only on a copy of a backup and changed only on his command; no test
  opens KB.
- Docs: `decisions.md`, `data-model-v2.md` (only if Q1 finds a field), `known-limitations.md` (the shared
  `infomapper-dev` with KB; new items from the measurement), `ideas.md` (the read fixes' place in the program), README
  and CLAUDE.md (the commands, the environments table, the backups' folder).

## 9. Left for later

The switch day and the read fixes slice (after the measurement); the people slice ("Add person" online, invitations,
organization roles, guests, passwords, e-mail); slice D (production, Supabase's backups, the database role, Auth
hardening, GDPR).
