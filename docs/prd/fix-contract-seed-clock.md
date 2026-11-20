# Fix – The contract suite's seed mixes a fixed time with the real one

Status: **step 2, the fix and its proof** (20 November 2026); step 1 accepted by Łukasz the same day. Branch `fix/contract-seed-clock` from `dev` at
`6a6e7d7`. A fix to shared test infrastructure (the contract suite and `scripts/lib/seed-rows.ts`), outside slices
(CLAUDE.md, the slice cycle, 4). Found on slice 32's branch (`docs/prd/slice-32-acceptance.md` on `slice/32-theme`,
"Open before step 4").

## 1. The failure and its cause (confirmed)

**What fails.** The Schema workflow's `migrations` job, `tests/contract/writes.test.ts` › "the writes on Postgres: the
same answers and the same data as the local adapter's (S30-10)" › "leaves the data every read gives as the local adapter
does". First on `dev` (`6a6e7d7`, run 44688061872, attempt 2 at 10:05 UTC; attempt 1 at 06:28 UTC and every run before
passed), then on every push of `slice/32-theme`. 1 failed, 41 passed. The one read that differs is
`model.loadForUndo` of "Retail Co – DWH", table `attribute`: the scenario's attribute `amount` (created at
`2026-11-20T09:00:03.000Z`) comes **first** of the workspace's attributes on Postgres and **last** on the local adapter;
the seed's star attributes beside it carry `2026-11-20T10:04:52.414Z`, the moment the job ran.

**The cause.** The seed the suite loads is not at one time:

- `seedRows(now)` (`scripts/lib/seed-rows.ts:10`) hands `now` to `buildSeed(now)` and `addLargeWorkspace(db, now)`,
  but calls `addSeedDemoData(db)` **without it**. Every step below it then defaults to the real clock
  (`at: string = new Date().toISOString()`):
  `addSalesStar` (`src/modules/infocube/data/sales-star.ts:128`), `addStarDerivations` (`:302`), `addStarTypes` (`:346`),
  `addChecksDemo` (`src/data/local/seed-checks.ts:34`), `addDocumentsDemo`
  (`src/modules/infodocumenter/data/demo.ts:54`).
- So `contractRows()` (`tests/contract/shared.ts`, `seedRows(AT)` with `AT` = 16 Nov 10:00) holds rows at 16 Nov and
  rows at the moment the test runs, in **16 tables** (counted with `seedRows(AT)` today):
  `organization_licence` 2/2, `canvas` 1/8, `project_canvas` 1/9, `entity` 7/60, `attribute` 38/885,
  `attribute_input` 3/3, `relationship` 7/57, `requirement` 1/18, `requirement_link` 3/142, `canvas_item` 13/268,
  `cube_entity` 7/7, `cube_measure` 6/6, `cube_key` 6/6, `cube_mapping` 19/19 (also `approved_at`),
  `cube_mapping_input` 19/19, `document_definition` 3/3.
- The scenario's commands run on a **fixed** clock: `clock()` in `writes.test.ts:49`, `Date.UTC(2026, 10, 20, 9, 0,
  second)`, one second per command.
- AD-12's stored order: the local adapter keeps a table in the order its rows were written (a new row is appended);
  Postgres orders by the time column (`created_at`, `added_at`, …), then the key. `apply` stamps only the microseconds;
  it never moves a row to another millisecond. A read the domain does not sort (here `loadForUndo`) shows that order.
- While the real time was before 20 Nov 09:00:01, the scenario's rows were later than every seed row, so "appended" and
  "by time" agreed. Since then the seed's real-time rows are later than the scenario's rows, Postgres puts the
  scenario's rows before them, and the two adapters' orders differ. **It fails on every run from now on.**

## 2. Every clock in the contract suite and its seed

| Where | Clock | Meets |
| --- | --- | --- |
| `tests/contract/shared.ts` `AT` = 16 Nov 10:00, `LATER` = 16 Nov 11:00 | fixed | `contractRows()` = `seedRows(AT)`; `LATER` only as `deleted_at` (not an order column) |
| `scripts/lib/seed-rows.ts` `seedRows(now = new Date())` | given, real by default | `buildSeed`, `addLargeWorkspace` take it; **`addSeedDemoData` does not** (real) |
| the five demo steps above (`at = new Date()`) | real (default) | the 16 tables above |
| `writes.test.ts:49` `clock()` 20 Nov 09:00:01 + n s | fixed | the seed's rows in every table the scenario inserts into: `entity`, `attribute`, `concept`, the import's tables, `change_event`, `project_canvas` / `workspace_member` (concurrency cases) |
| `copy.test.ts:49` `clock()` 19 Nov 09:00:01 + n s | fixed | the imports' tables (`source_*`, `change_event`) |
| `copy.test.ts:77` `seedRows(19 Nov 08:00)` | fixed, but the same real-time demo rows | as above |
| `copy.test.ts:225` `seedRows()` | real | only the reset guard's refusal (nothing compared by order) |
| `copy.test.ts:180, 262` SQL `now()` into `undo_step` | the database's | read by `position`, not by time; these tests count rows |
| `upgradedFrom(text, now = new Date())` (`scripts/lib/backup-file.ts:39`), the local adapter's `readDb` upgrade (`src/data/local/file.ts:61`) | real | only rows an upgrade adds; a current-format file gets none (the suite passes before 09:00) |
| `undo_step.created_at` on Postgres (`undo-history.ts:71`), the local history | the command's `ctx.now` | ordered by `position` |
| `reads.test.ts` stamp tests (16 Nov literals) | fixed | nothing (pure functions) |
| `tests/kb-copy.test.ts:28` `seedRows(19 Nov 10:00)` | fixed + real demo rows | compares rows with the same seed's rows, filtered: no order between two sources |

**Which tests can break the same way, and when:**

- `writes.test.ts`, Postgres side: broken since 20 Nov 09:00:01 UTC, for good. The local-only describe and the
  concurrency and undo-history cases compare answers, not orders: not affected.
- `copy.test.ts`: the same mix (imports at 19 Nov 09:00, star rows at the real time, the copy keeps each row's own
  millisecond). It passes today only because its imports write tables the demo steps never fill (`source_*`,
  `change_event`). It breaks the day its scenario writes an entity, attribute, canvas item, requirement link or any other
  of the 16 tables. Latent, same cause.
- `reads.test.ts`: no writes; the real-time rows come after the 16 Nov rows in both the file and by time. Safe while the
  real time is after 16 Nov 10:00, i.e. always from now on, but by luck, not by construction.
- `kb-copy.test.ts` and the unit tests that call the demo steps without a time: not affected (no second source of order).

## 3. The fix (proposed)

**One time for the whole seed, and the suite's clock after it.**

1. `seedRows(now)` passes its time on: `addSeedDemoData(db, now.toISOString())`. Then `seedRows(t)` never reads the real
   clock; every seed row is at `t`. (`npm run pg:seed` calls `seedRows()`, so its demo rows move from "a few
   milliseconds after the seed's moment" to "the seed's moment": no count, id or content changes; the loader's place
   stamps keep the file's order, AD-12. `npm run seed`, the reset, `npm run demo` and the e2e fixtures do not use
   `seedRows` and are unchanged.)
2. One clock for the suite in `tests/contract/shared.ts`: `contractClock(prefix, from = AT)` gives the commands'
   contexts **from the seed's time + 1 hour**, one second per command, ids from the prefix's counter (`01a1c000` for the
   writes, `01a1d000` for the copy, as today). `writes.test.ts` and `copy.test.ts` drop their own `clock()`;
   `copy.test.ts` builds its file with `seedRows(AT)` (its 19 Nov literals go). The commands are then later than every
   seed row by construction, whatever day it is.
3. A guard in `npm test` (no Postgres): `tests/seed-rows-clock.test.ts`, with only `Date` faked
   (`vi.useFakeTimers({ toFake: ["Date"] })`) and the system time set **far after** `AT` (2030) and **before** it (2020):
   every time field of every row of `seedRows(AT)` equals `AT` (the probe in section 1, as a test), and the suite's
   clock's first moment is after all of them. A later demo step that reads the real clock fails it, naming the table and
   field.

**Why it cannot recur:** the order the two adapters compare depends only on the rows' times; after the fix the seed has
one time, given by the test, and the commands start an hour after it from the same constant. Nothing in what the suite
loads or writes reads the real clock (the remaining real clocks in section 2 touch nothing compared by order), and the
guard fails the day a new seed step does.

**Not proposed:** only moving the dates (it recurs at the next date); making the demo steps' `at` required (six
functions and their callers in scripts, fixtures and unit tests for no gain here; the real-time default is right for
`npm run seed`); faking `Date` inside the contract suites themselves (the guard covers the source; faking it next to
`pg`'s pool and timers adds risk for nothing).

**Łukasz's answer (step 1, 20 November 2026):** step 1 accepted. `npm run pg:seed`'s demo rows take the seed's moment
(Claude's call, accepted; quoted for his approval at the closing): "With the fix, `npm run pg:seed`'s demo rows (the
star, the derivations, the types, the checks, the documents) are stamped with the seed's moment, the same as the rest
of the seed, instead of the real time a few milliseconds later; counts, ids and content are unchanged, and the loader's
place stamps keep the file's order (AD-12)."

## 4. The proof

1. **Fails on today's code:** commit the guard first, alone. `npx vitest run tests/seed-rows-clock.test.ts` fails,
   listing the 16 tables (shown in the report), and CI's `check` fails on that commit. The contract failure itself is
   already recorded (run 44688061872, attempt 2; `slice/32-theme`'s runs).
2. **Passes after:** the fix commit: the guard passes; `npm test` (the local-adapter side of the contract suite included)
   passes; the Schema workflow's `migrations` job (`tests/contract` on Postgres in its container) passes, with
   `writes.test.ts` 25/25 and `copy.test.ts` all passed.
3. **The clock moved past the fixed time:** the guard runs with the system time at 2030 and at 2020; with the fix the
   suite's commands are at `AT` + 1 h regardless, so no run on any day can reproduce section 1.

## 5. The plan

**Step 2 (one step, then stop):**
- Commit `test:` the guard; show it failing locally (and CI's `check` on that commit).
- Commit `fix:` `seedRows` passing its time, the shared clock, the two suites on it.
- Open a draft PR into `dev` at the first push; CI and Schema run on each push.
- `npm run lint`, `npm run typecheck`, `npm test`; the Schema workflow green on the last commit.
- One full e2e run on the last commit (the slice cycle, 4: a fix branch's own full run), reported with its link, commit,
  wall-clock, parts' times and heap peaks, and counts. The e2e data do not use `seedRows`, so nothing should change there.
- This doc updated with the results; no decision text changes (AD-12 is unchanged: the fix is in tests and the seed's
  plumbing).

**Closing prompt (on Łukasz's command):** `npm run pg:backup` on `dev`'s checkout first (AD-39's rule before every merge
into `dev`); check CI and Schema passed on the last commit; merge the PR into `dev`; nothing else. Then slice 32 merges
`dev` into `slice/32-theme` in its own session (its step 4).
