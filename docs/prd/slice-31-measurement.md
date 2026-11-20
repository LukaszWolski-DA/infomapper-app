# Slice 31 – the measurement on KB (S31-06)

The reads and writes of Łukasz's organization KB on `dev`'s Vercel preview, measured from his laptop after slice 31's
merge, beside the demo's "Retail Co – DWH" in the same sitting, in the style of slices 29 and 30
(`docs/prd/slice-29-measurement.md`, `docs/prd/slice-30-measurement.md`). **Figures only: no threshold was set
beforehand, nothing is switched; Łukasz decides** the switch day (AD-39, C1.1) and whether the read fixes slice comes
before it (AD-31's amendment). KB's objects are named by role, with sizes; no name, content or e-mail.

## How it was measured

- **The preview:** `dev`'s branch address, `infomapper-app-dev-git-dev-lukaszs-projects-9ffbc132.vercel.app`. `dev`'s
  head is `722b87b` (slice 31's merge); GitHub's Vercel status for `722b87b` reports deployment
  `CryCkbEsj4DzHhJPHH8wmqFSJRQY` completed at 05:21:44 UTC on 20 November 2026, and no later commit on `dev`. That the
  branch address served it is inferred from that status (the preview shows no commit). `722b87b` has `lock_timeout`
  15 s (`src/data/postgres/write.ts`, from `7114ee3`). `INFOMAPPER_TIMING` is on: every page carried its timing record and
  the thumbnail its `Server-Timing` with statements. `X-Vercel-Id` `arn1 → fra1`; `infomapper-dev` (Micro, Central EU);
  the bypass header (`playwright.pg.config.ts`), headless Chromium on the laptop.
- **The specs as committed:** `e2e/slice-29/S29-08-measure.spec.ts` (reads) and `e2e/slice-29/S30-measure.spec.ts`, test
  S30-13 only (writes; **no S30-05 import**, neither in KB nor in the demo). KB through `MEASURE_WORKSPACE` (its one
  workspace), `MEASURE_EMAIL_VAR=INFOMAPPER_KB_EMAIL`, `MEASURE_PASSWORD_VAR=INFOMAPPER_KB_PASSWORD`: numbers only, no
  trace, screenshot, video or HTML report. The demo as the demo's Łukasz. Warm: first load on its own, 2 discarded, **10
  counted; medians, spread min to max**.
- **Two reads the specs do not make for KB,** measured by a scratchpad spec of the same method (git-ignored, reads only):
  - S29-08 opens a workspace's first *shared* document, and KB's one document is private (its author is the measuring
    account), so the spec skips the editor;
  - its thumbnail is the project home's first tile, which in KB is not the largest canvas.
  The scratchpad spec measured the private document's editor and the largest canvas's thumbnail.
- **When (UTC, 20 November 2026):**
  - reads: the demo and Performance test 05:33:54 to 05:35:50, KB 05:35:50 to 05:36:26, KB's extra reads to 05:44:28;
  - writes: the demo 05:44:41 to 05:46:57, KB 05:46:57 to 05:48:41, the demo again 05:50:33 to 05:52:36.
  The demo's first write run overlapped a read-only script of mine that read the demo's undoable rows (8.5 s). Its
  table is replaced by the second run (the first run's Undo: 1,379 ms, 1,138 to 1,946).
- **The columns** are slice 29's and 30's: ready (request to the page drawn), TTFB and response end, and from the page's
  record calls, statements, statement time, wait for a connection, read span and server total. For a write: action to
  "Saved", "Saving…" to "Saved", and the refresh's record.

## What was in the database (read-only counts, before)

**KB** (`readOrganization`'s rows: the organization, its one workspace, its people): **4,933 rows** against 4,871 at the
copy (S31-01). The 62 more are Łukasz's own use online on 19 November (19:27 to 20:57 UTC: 61 change events and the
rows they wrote). Sizes by role, live (soft-deleted):

| Rows | Live (deleted) |
| --- | --- |
| projects | 1 (1) |
| canvases | 7 (7) |
| canvas cards | 87 (35); the largest canvas 23, then 22, 20, 10, 6, 4, 2 |
| entities, attributes, relationships | 29 (4), 190 (10), 32 (2) |
| source systems, tables, columns | 2, 12 (5), 97 (74) |
| mappings, InfoCube's mappings | 97 (10), 54 (6) |
| documents | 1 (private) |
| change events | 3,813 |

**The demo's "Retail Co – DWH"**: 126,845 rows, of them **42,048 soft-deleted**, nearly all left by S30-05's three
10,000-column imports (slice 30's measurement, slice 31's two runs on `dev:pg`), each undone:

| Table | Rows | Soft-deleted |
| --- | --- | --- |
| source_column | 30,036 | 30,000 |
| source_table | 3,006 | 3,000 |
| classification_link | 3,010 | 3,000 |
| source_relationship, source_relationship_column | 2,999 each | 2,997 each |
| source_system, source_import | 6, 3 | 3, 3 |
| attribute | 119 | 47 |
| change_event (append-only) | 84,379 | – |

**Undo steps** (`undo_step`, per workspace and person):

| Workspace | Person | Undo | Redo |
| --- | --- | --- | --- |
| KB's workspace | the KB account | 26 (19 Nov, 20:01 to 20:57) | 0 |
| Retail Co – DWH | the demo's Łukasz | 35 | 6 |
| Retail Co – DWH | Anna Nowak | 12 | 4 |

## Reads: warm medians of 10

| Data set | Page | Ready (min to max) | TTFB / response end | Calls | Statements | Statement time | Wait | Read span | Server total | Slice 29 (ready / server) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| KB | workspace home | **491 ms** (389 to 776) | 53 / 419 | 33 | 79 | 243 ms | 15 ms | 222 ms | 227 ms | – |
| KB | project home | **471 ms** (416 to 633) | 55 / 430 | 43 | 106 | 267 ms | 27 ms | 203 ms | 209 ms | – |
| KB | the largest canvas (23 cards) | **813 ms** (664 to 1,208) | 52 / 580 | 55 | 149 | 389 ms | 57 ms | 251 ms | 267 ms | – |
| KB | its thumbnail (1,169 bytes) | **259 ms** (234 to 306) | – | 14 | 37 | 100 ms | 6 ms | 86 ms | 96 ms | – |
| KB | the document's editor (50 pages) | **3,168 ms** (2,996 to 3,866) | snapshot answer 459 / 603 | – | – | – | – | – | – | – |
| Retail Co – DWH | workspace home | **596 ms** (504 to 1,120) | 49 / 516 | 38 | 91 | 382 ms | 19 ms | 310 ms | 313 ms | 434 / 172 ms |
| Retail Co – DWH | project home | **451 ms** (405 to 1,215) | 57 / 389 | 42 | 93 | 239 ms | 23 ms | 173 ms | 177 ms | 463 / 173 ms |
| Retail Co – DWH | canvas page | **661 ms** (598 to 1,002) | 52 / 485 | 50 | 116 | 356 ms | 32 ms | 235 ms | 248 ms | 626 / 214 ms |
| Retail Co – DWH | thumbnail (900 bytes) | **234 ms** (218 to 269) | – | 14 | 37 | 80 ms | 5 ms | 71 ms | 78 ms | 264 / 77 ms |
| Retail Co – DWH | editor and snapshot | **1,869 ms** (1,767 to 2,173) | snapshot answer 434 / 452 | – | – | – | – | – | – | 1,799 ms |
| Performance test | workspace home | 565 ms (525 to 967) | 68 / 495 | 31 | 73 | 372 ms | 15 ms | 268 ms | 281 ms | 552 / 304 ms |
| Performance test | project home | 617 ms (550 to 1,006) | 64 / 572 | 35 | 83 | 542 ms | 26 ms | 258 ms | 285 ms | 630 / 275 ms |
| Performance test | canvas page | 1,679 ms (1,499 to 2,145) | 58 / 951 | 43 | 106 | 536 ms | 38 ms | 282 ms | 361 ms | 1,783 / 428 ms |
| Performance test | thumbnail | 323 ms (278 to 458) | – | 12 | 35 | 202 ms | 5 ms | 134 ms | 150 ms | 340 / 166 ms |

First loads of the run (one sample each): KB 430, 560, 979, 404 and 5,459 ms (the editor); the demo 1,252, 564, 1,302,
454 and 2,259 ms.

- **KB reads like the demo.** Its pages are drawn in 0.47 to 0.81 s, with 79 to 149 statements and 0.21 to 0.27 s of
  server time. Its canvas page has more statements than the demo's (149 against 116, 55 calls against 50): an assumption,
  not traced, is that the cards' kinds and modules (InfoCube's rows, InfoDocumenter on) add port calls. KB has no slice
  29 figure of its own: it was never measured on the local adapter.
- **The editor on KB takes 3.2 s**, of which the snapshot's answer is 0.6 s. The rest is the browser building and laying
  out 50 pages (Paged.js), against the demo document's few pages in 1.9 s; slice 26 measured that layout as the
  browser's.
- **The demo is slower than in slice 29 on its workspace home** (596 against 434 ms ready, 382 against 204 ms of
  statement time, with the same 91 statements); the other pages are within the spread. An assumption, not traced: the
  home's people read scans the workspace's change events (`peopleRows`, `src/data/postgres/store.ts:77`:
  `select distinct user_id from change_event`), which grew to 84,379 rows with the imports and their undos (each
  10,000-column import and its Undo write about 28,000). The model's reads filter the soft-deleted columns out in the database (`workspaceRows` with `live`), so those
  rows cost the pages a scan, not a transfer.

## The snapshot and Vercel's 4.5 MB

`scripts/pg-snapshot-size.ts` (the editor's snapshot as the action answers it, through the Postgres adapter from the
laptop):

| Workspace | Uncompressed | Share of 4.5 MB | gzip | brotli |
| --- | --- | --- | --- | --- |
| KB's workspace | **491.1 KB** | **10.7 %** | 48.5 KB | 31.1 KB |
| Retail Co – DWH | 200.7 KB (slice 29: 193.2) | 4.4 % | 18.3 KB | 12.9 KB |
| Sales analytics | 98.4 KB | 2.1 % | 8.9 KB | 6.8 KB |
| Bank X – Risk DWH | 14.1 KB | 0.3 % | 2.5 KB | 2.0 KB |
| Performance test | 2,251.3 KB | 48.9 % | 135.3 KB | 85.9 KB |

KB's snapshot is a tenth of the limit: KB would reach it at about nine times its size, if the limit counts a streamed
action's answer at all (slice 29: not confirmed).

## Writes: warm medians of 10 (2 discarded first)

| Data set | Write | Action to "Saved" (min to max) | "Saving…" to "Saved" | Refresh: calls / statements | Refresh: statement time | Wait | Read span | Server total |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| KB | Rename (entity panel) | **372 ms** (340 to 500) | 349 ms | 55 / 149 | 385 ms | 60 ms | 244 ms | 263 ms |
| KB | Move a card (canvas) | **480 ms** (441 to 588) | 317 ms | – | – | – | – | – |
| KB | Add an attribute | **451 ms** (416 to 643) | 375 ms | 55 / 149 | 407 ms | 62 ms | 242 ms | 268 ms |
| KB | **Undo** (top bar) | **449 ms** (409 to 740) | 401 ms | 55 / 149 | 372 ms | 53 ms | 226 ms | 247 ms |
| Retail Co – DWH | Rename | **338 ms** (323 to 361) | 317 ms | 50 / 116 | 337 ms | 26 ms | 227 ms | 234 ms |
| Retail Co – DWH | Move a card | **471 ms** (421 to 506) | 309 ms | – | – | – | – | – |
| Retail Co – DWH | Add an attribute | **456 ms** (414 to 527) | 375 ms | 50 / 116 | 343 ms | 27 ms | 226 ms | 235 ms |
| Retail Co – DWH | **Undo** | **1,216 ms** (1,103 to 1,362) | 1,159 ms | 50 / 116 | 318 ms | 25 ms | 218 ms | 227 ms |

Slice 30's figures for the demo, before its first import (scratchpad copy, the same method): rename 365, move 456,
add 523, Undo 498 ms ("Saving…" to "Saved" 341, 283, 411, 450). With the import's 10,036 live columns: rename 523,
move 665, add 1,008, Undo 1,043 ms.

Every refresh (10 of 10) brought a new record; a moved card brought none, as in slice 30 (the canvas's queue).

## Undo, KB and the demo apart

**What Undo reads** (`undoAction`, `src/app/_actions/undo.ts`):
1. the next step and its change events (`undoHistory.next`, by its change group);
2. **`store.model.loadForUndo(workspace)`** (`src/data/postgres/store.ts:162`): every undoable table of the workspace
   (34 tables, `STORE_SCHEMA.undoable`), **soft-deleted rows included** (`live` false), in one read-only transaction, to
   the server, where `revertChangeGroup` computes the revert in the domain;
3. the write (`apply`), then the fresh page.

What `loadForUndo` returns, read the same way from the laptop (rows and JSON only; scratchpad, read-only):

| Workspace | Rows | Soft-deleted | As JSON | Read from the laptop |
| --- | --- | --- | --- | --- |
| KB's workspace | 1,112 | 206 | 646 KB | 2.1 s |
| Retail Co – DWH | **42,414** | **42,060** (99 %) | **27.0 MB** | 8.5 s |

**Undo's own cost**, taken as Undo's "Saving…" to "Saved" less a rename's (the two refreshes are the same page with the
same server time, so the difference is Undo's read and revert; inferred, the server's split is in Vercel's log lines,
not read):

| Workspace | Undo less rename | Soft-deleted undoable rows |
| --- | --- | --- |
| KB, today | **52 ms** | 206 |
| Retail Co – DWH, slice 30 before the import | 109 ms | about 40 (the measurement's attributes) |
| Retail Co – DWH, slice 30 with the import live | 496 ms | about 40, and 10,000 live columns |
| Retail Co – DWH, today | **842 ms** | 42,060 |

**Undo's time grows with the workspace's soft-deleted rows** (fact: the refresh is unchanged at 227 against 234 ms of
server time, and only Undo's figure grew; the attribution to `loadForUndo` is inferred from the code and the 27 MB above).
The pages do not pay it: they filter deleted rows in the database. On KB today Undo is a rename's time plus 52 ms. KB's
soft-deleted rows grow only with its own use (206 now), and an undone import adds every row it wrote (S30-05: 14,000).

## The three puzzles from dev:pg, explained (no new runs on dev:pg)

The dev:pg figures are slice 31's step 3 raw files (`.data/measure/s30/`, 19 November 17:48 to 18:05 UTC).

### 0 statements in the routes' `Server-Timing` on dev:pg

- **Facts.** On dev:pg the pages' records counted their statements (the demo's workspace home 91, canvas page 116), but
  the thumbnail route's header said 14 calls, **0 statements, wait 0**, and the import route's 16 calls, 0 statements,
  wait 0, with a read span of 2.8 s and a non-zero `lock` and `apply`. On the preview the same thumbnail route counts
  37 statements.
- **The code.** A record gets its calls from `timedStore`, which wraps the store each time `getDataStore` is asked for it,
  and its lock and apply from `countWrite`. Its statements and waits come from hooks put on the pool once, when the pool
  is made (`timePool`, `src/data/postgres/pool.ts`). The pool lives on `globalThis` across module reloads. Each hook calls
  `countStatement` of the timing module that made the pool, and that module finds the current record through its own
  `AsyncLocalStorage` and React `cache` (`setTimingSource` in `src/app/_lib/timing.tsx`).
- **The explanation (assumption, strongly supported):** in the development server a route handler's module instance
  differs from the one whose pages made the pool (separate bundles, or a module evaluated again). The route's
  `withTiming` record sits in its own instance's `AsyncLocalStorage`, which the pool's hooks never read, so its statements
  and waits go to a record nobody reports. Calls, lock and apply come from the route's own modules and are counted.
- **The consequence:** on dev:pg a route's statements and waits are not counted (its other figures are); the preview's
  figures stand. To confirm it without reading code: on a fresh `dev:pg` server request a thumbnail first (the route then
  makes the pool), and the routes count while the pages show 0. Not run.

### The import's lock: 38 s on dev:pg against 2.8 s on the preview

- **Facts.** The same 10,000-column file (14,000 rows and 14,000 change events written):
  - the preview (slice 30): `apply` 2,756 ms, lock wait 4.8 ms, total 4,498 ms;
  - dev:pg, two runs: `apply` **38,264 ms** and 18,108 ms, lock wait 76 and 51 ms, read 2.8 and 3.0 s, total 65.5 and
    43.6 s.
  `apply` is the write's transaction, from the lock to the commit (`countWrite`), so it is how long the workspace was
  locked.
- **The code.** `apply` sends one statement per table and phase, each table's rows as one JSON parameter
  (`json_populate_recordset`, `src/data/postgres/write.ts:228`): a few round trips, but the whole write set is uploaded
  inside the transaction.
- **The explanation (assumption):** on dev:pg the server is the laptop, so the transaction includes uploading the write
  set over the laptop's line to Frankfurt. At about 640 bytes a row as JSON (the 27 MB above over 42,414 rows), that is
  roughly 9 MB of rows and as much again of change events. At a few Mbit/s up, that takes 15 to 40 s. The two runs' 38
  and 18 s for the same rows point at the network, not the database. On the preview the server sits beside the
  database in `fra1`.
- **The rest of dev:pg's total** (about 24 and 22 s beyond read and apply, against 1.4 s on the preview) is most likely
  the server's own work in a development build on the laptop: the plan again, the write set's 28,000 rows. Not profiled.
- **The consequence (fact):** on dev:pg the lock outlasted `lock_timeout` (15 s), so the second session's saves were
  refused as busy (2 and 1 of them; the longest 27 and 25 s), as AD-38 designs. On the preview the slice 30 estimate
  stands (about 8.3 s for an import at the cap).

### The 70 s Undo on dev:pg

- **Facts.** It was the Undo of an S30-05 import, from dev:pg (the spec's clean-up; its comment: "a large import's undo
  from the laptop's dev:pg outlasted the browser's request"). The same evening a plain Undo on dev:pg took a median of
  **8.1 to 8.3 s** (S30-13 on dev:pg, both runs), against 0.5 s on the preview. This morning `loadForUndo`'s read of the
  demo from the laptop took **8.5 s** (27 MB). On dev:pg a statement costs about 48 ms (the canvas page's refresh: 5,625 ms
  over 116 statements, against 3 ms on the preview).
- **The explanation (assumption, the split not measured):** an import's Undo on dev:pg does three bulk transfers over the
  laptop's line, plus a development build's work on 14,000 rows:
  1. the step's 14,000 change events with their images, down;
  2. `loadForUndo`: the whole workspace with every soft-deleted row, down (8 s and more);
  3. `apply`: 14,000 updates (soft deletes) and 14,000 change events, up, like the import's 18 to 38 s.
  Together about a minute. Nothing points at the lock: the import's own lock waits were 51 to 76 ms.
- **The consequence:** dev:pg's large-write figures measure the laptop's line, not the app. The preview's Undo of the
  same import took 5.4 s (slice 30's clean-up, at that time with fewer soft-deleted rows).

## At the end: what the measurement left

Counts after (05:53 UTC), against before:

| Workspace | Table | Before: rows (deleted) | After |
| --- | --- | --- | --- |
| KB's workspace | attribute | 200 (10) | 212 (22): the 12 added and undone, soft-deleted |
| KB's workspace | change_event | 3,813 | 3,885 (+72: 36 writes and their 36 undos; append-only) |
| Retail Co – DWH | attribute | 119 (47) | 143 (71): two runs' 12 each, soft-deleted |
| Retail Co – DWH | change_event | 84,379 | 84,523 (+144) |
| every other table, both workspaces | | | unchanged |

No live row changed. The spec checks that the renamed entity has its name back. Each card was moved an even number of
times by 40 px, so it is back in place, and the 12 Undos at the end of each run reverted the moves.

**Undo histories after** (Łukasz decided, 20 November 2026, to run the spec as committed and that these steps may go):

| Workspace | Person | Undo: before → after | Redo: before → after |
| --- | --- | --- | --- |
| KB's workspace | the KB account | 26 → **14** (positions 13 to 26: the **12 oldest trimmed**, the 50-step cap) | 0 → **36** (the measurement's steps) |
| Retail Co – DWH | the demo's Łukasz | 35 → 14 (21 oldest trimmed) | 6 → 36 (the 6 dropped by the first write; 36 the second run's) |
| Retail Co – DWH | Anna Nowak | 12 → 12 | 4 → 4 |

**Left in both:** each account's redo list holds the measurement's 36 steps. Redo in KB's workspace would apply the
measurement's renames, moves and attributes again. Any next write by that account in that workspace clears its redo
list (AD-38), and the switch day's last copy empties KB's undo histories anyway (AD-39). Removing them now would need a
write into `undo_step` outside the app, which was not done.

Raw files, git-ignored: `.data/measure/s29/preview-2026-11-20T05-35-49-807Z.json` (the demo's and Performance test's
reads), `.data/measure/s31/` (`preview-2026-11-20T05-36-26-592Z.json`, `reads-extra-2026-11-20T05-44-28-854Z.json`,
`s30-13-2026-11-20T05-48-40-969Z.json`, `demo/s30-13-*.json`, `counts-before.json`, `counts-after.json`).

## What the figures say

- **KB online is as fast as the demo** on every page and write measured:
  - pages drawn in 0.47 to 0.81 s;
  - writes "Saved" in 0.37 to 0.48 s;
  - Undo 0.45 s;
  - the editor 3.2 s for its 50 pages;
  - the snapshot at 10.7 % of Vercel's limit.
  KB is small for the database: 4,933 rows against the demo's 126,845.
- **Every page and every refresh still reads the workspace whole** (slice 29's finding): 79 to 149 statements a page,
  0.2 to 0.27 s of server time on KB. The person sees it as about 0.25 s per page and per model write.
- **Undo reads the workspace with its soft-deleted rows**, so its time grows with the history: 52 ms on KB today,
  842 ms on the demo with 42,060 deleted rows (27 MB per Undo). It is the one cost that grows with use and not with
  the model's size.
- **dev:pg is not a measuring place for large writes:** the laptop's line sits inside the transaction (the lock) and
  inside Undo's read.

## Not measured

- The writes' and Undo's own split on the server (Vercel's runtime log lines; slice 30's decision 4: not needed).
- Cold loads, and KB on the local adapter (KB's file is read only on a copy of a backup, never served).
- An import into KB (not asked).
- The 0-statements explanation's confirming run on dev:pg (above).
