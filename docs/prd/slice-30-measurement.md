# Slice 30 – the measurement (S30-13, S30-05)

The writes on Postgres on `dev`'s Vercel preview, measured from Łukasz's laptop after slice 30's merge, in the style of
slice 29's read measurement (`docs/prd/slice-29-measurement.md`). **Figures only (DB7): no threshold was set
beforehand; Łukasz decides.** The one proposal is AD-38's `lock_timeout` (below), as L7 asked.

## Decided (Łukasz, 19 November 2026)

1. **Decided: the test system goes by Undo.** Remove "Synth 1795092803262" from the demo's "Retail Co – DWH" through
   the app on `dev`'s preview, as Łukasz's demo account, whose history it is: Undo steps 113 down to 89 (the
   measurement's renames and card moves), then step 88, "Import synth.csv", reading each step's label before its Undo
   and stopping at any difference or refusal. Then take Product's card off "Customer & orders" (the entity kept), and
   time one rename as a check. Nothing else. (The app has no delete for a source system: the first wording, "in its
   panel, one step", followed this report's first version, which was wrong; `docs/ideas.md` has the idea.) Done:
   "The cleanup", below.
2. **Decided: `lock_timeout` 15 s**, without a 30,000-column import. It is built in the read fixes slice (the next
   one), with AD-38's text changed there; no fix branch now.
3. **Decided: the measuring spec's two flaws** (Playwright's polling steps, the first load counted as the refresh) are
   fixed in the read fixes slice, which measures the writes again.
4. **Decided: Vercel's runtime logs are not needed**; the read fixes slice measures the server's split again.

## How it was measured

- **The preview:** `dev`'s branch address, `infomapper-app-dev-git-dev-lukaszs-projects-9ffbc132.vercel.app`, serving
  `dev` at `ec6ca70` (slice 30's merge), redeployed by Łukasz on 19 November 2026 with `INFOMAPPER_SERVER_NAME=dev`
  and `INFOMAPPER_TIMING=1`. Functions in `fra1` (`X-Vercel-Id` `arn1 → fra1`), Fluid compute, the pool at 5 connections
  through Supabase's transaction pooler; `infomapper-dev` (Micro, Central EU). Reached with the Protection Bypass for
  Automation header (`playwright.pg.config.ts`), headless Chromium on the laptop, signed in with the demo accounts
  (Łukasz; Anna Nowak as the second session).
- **The data:** the demo's "Retail Co – DWH", the canvas "Customer & orders" (Customer 360's first canvas). Before the
  run: 3 source systems, 6 tables, 36 live columns, 72 live attributes.
- **When (UTC, 19 November 2026):** the repository's spec 12:38:20 to 12:39:13; the precise copy (below) S30-13
  12:51:13 to 12:52:26, S30-05 12:53:18 to 12:53:43, S30-13 again after the import 12:55:17 to 12:57:38. All warm: the
  instance had served the probe and the earlier runs; no cold figures were taken.
- **Two runs of S30-13, and why.** `e2e/slice-29/S30-measure.spec.ts` ran as written first. Its raw samples showed two
  flaws of the method, not of the app:
  1. **The times are Playwright's retry steps.** `oneWrite` waits with `expect(...).toHaveAttribute`, which checks
     again after 100, 250 and 500 ms and then every 1,000 ms: the samples fall at about 350, 860 and 1,010 ms (rename
     342 to 869 ms in two clusters, Undo 859 to 892 ms). Each figure is the next check after "Saved", up to 500 ms
     late.
  2. **The "refresh statements" are not always a refresh.** After a rename or a moved card the page's `im-timing`
     record never changed in the run (the same 116 statements and the same milliseconds in every sample): what the spec
     reports for those two is the canvas page's first load.

  Changing the spec is a code change, outside this chore. The figures below come from a **copy of the spec run from the
  scratchpad** (not committed), with the same steps and three differences: the times are stamped in the page, every
  frame, from the indicator's `data-state` (action to "Saved", and "Saving…" to "Saved"); the page's record counts as a
  refresh only when it changed (waiting up to 2 s for it, outside the timed span); the card moved is Product's, whose
  header is in view (in the copy's runs the first `.react-flow__node` lay under the top bar, where a drag moves
  nothing). The spec's own figures are kept beside them. Proposed: a `fix/` branch for the spec. **Decided** (3, above):
  fixed in the read fixes slice, which measures the writes again.

## S30-13: warm medians of 10 (2 discarded first)

Before the import (12:51 UTC):

| Write | Action to "Saved" (min to max) | "Saving…" to "Saved" | Page refreshed | Refresh: calls / statements | Refresh: statement time | Refresh: wait | Refresh: read span | Refresh: server total |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rename (entity panel) | **365 ms** (307 to 386) | 341 ms | 10 of 10 | 50 / 116 | 257 ms | 30 ms | 186 ms | 195 ms |
| Move a card (canvas) | **456 ms** (438 to 519) | 283 ms | 0 of 10 | – | – | – | – | – |
| Add an attribute (entity panel) | **523 ms** (481 to 592) | 411 ms | 10 of 10 | 50 / 116 | 245 ms | 29 ms | 166 ms | 176 ms |
| Undo (top bar) | **498 ms** (472 to 594) | 450 ms | 10 of 10 | 50 / 116 | 251 ms | 30 ms | 169 ms | 180 ms |

The repository's spec as written (12:38 UTC; rounded up to Playwright's next check): rename 381 ms (342 to 869), move a
card 499 ms (484 to 1,017), add an attribute 927 ms (914 to 1,245), Undo 869 ms (859 to 892); its "116 statements" for the
rename and the move are the first load's.

- **"Action to Saved"** is from the action (Enter, the mouse's press, the click) to the indicator's "Saved": the write's
  answer in the browser. For the move it includes the drag's eight mouse steps through the browser's protocol (about
  170 ms); **"Saving… to Saved"** is the write as the page sends and receives it.
- **The refresh** is the page's own timing record after the write (the fresh page a model write brings, slice 13). A
  card's move is on the canvas's queue and brings no fresh page.
- **The write's own split** (its statements, the lock's wait, the transaction) is one log line per write on the server
  (`timing {"route":"write",…}`, `{"route":"undo",…}`), in Vercel's runtime logs: **not read** (no Vercel token without
  Łukasz's decision, slice 29). Łukasz can read them in the dashboard (project → Logs, filter `timing`, 12:51:13 to
  12:52:26 UTC for this table, 12:55:17 to 12:57:38 UTC for the next) and paste the lines; they hold numbers only.
  **Decided** (4, above): not needed; the read fixes slice measures the server's split again.

After the import (12:55 UTC; the same workspace with 10,036 columns, below):

| Write | Action to "Saved" (min to max) | "Saving…" to "Saved" | Refresh: calls / statements | Refresh: statement time | Refresh: wait | Refresh: read span | Refresh: server total |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Rename | **523 ms** (503 to 676) | 500 ms | 50 / 116 | 1,506 ms | 30 ms | 596 ms | 836 ms |
| Move a card | **665 ms** (587 to 921) | 491 ms | – | – | – | – | – |
| Add an attribute | **1,008 ms** (961 to 1,182) | 859 ms | 50 / 116 | 1,575 ms | 32 ms | 614 ms | 811 ms |
| Undo | **1,043 ms** (989 to 1,124) | 996 ms | 50 / 116 | 1,563 ms | 31 ms | 605 ms | 808 ms |

## S30-05: a 10,000-column import, and another session's save meanwhile (one sample)

A generated file in the standard (`syntheticStandard(1000)`: 1,000 tables, 10,000 columns, 769,075 bytes of text) into
a new system "Synth 1795092803262" through the wizard (12:53 UTC).

| Step | Time |
| --- | --- |
| The file given to "loaded" (the browser reads it) | 264 ms |
| The file given to the review shown (the browser's plan) | 715 ms |
| Click on "Import into" to the request leaving the browser (gzip) | 164 ms |
| Click to the route's answer (200) | 5,885 ms |
| Click to the wizard closed | **5,928 ms** |

The route's `Server-Timing`: **total 4,498 ms**; **apply 2,756 ms** (the transaction, holding the workspace's lock);
lock wait 4.8 ms; 16 calls and 74 statements, 2,740 ms of statement time; read 287 ms (the server's plan); pool wait
188.5 ms; inflate 3 ms. The rest of the 5,885 ms (about 1.2 s) is the upload and the network. The import wrote 14,000
rows (10,000 columns, 1,000 tables, 1,000 classification links, 999 source relationships with 999 key columns, the
system, the import) and their 14,000 change events, and one undo step.

**Anna's saves meanwhile** (a rename of Customer in the entity panel, one after another from the click until after the
answer; her rename alone before the import: 406 ms):

| Sent after the click | "Saving…" to "Saved" |
| --- | --- |
| 146, 512, 961, 1,291, 1,643, 1,993, 2,359, 2,693 ms | 322 to 439 ms (as alone) |
| 3,044 ms | **2,889 ms** (about 2.5 s waiting for the lock) |
| 5,944 ms (after the answer) | 1,332 ms (the refresh now reads 10,036 columns) |

None was refused or failed. The lock was held from about 3.0 s after the click (the save sent at 2,693 ms ended normally
at about 3,030 ms) to the answer, about 2.8 s, which matches `apply`.

## What the figures say

- **A model write's server time is mostly the fresh page it brings.** The refresh is the canvas page's whole read:
  the same 50 calls and 116 statements as slice 29's canvas page, 176 to 195 ms of server time against slice 29's
  214 ms. The person sees "Saved" after 341 to 450 ms; the write itself and the network are the rest, unsplit until the
  log lines are read.
- **Undo and adding an attribute cost about 70 to 110 ms more than a rename**; a moved card brings no fresh page and its
  save takes 283 ms.
- **A large workspace makes every write slower, not only its reads.** With the 10,000 columns in the workspace, the
  refresh's server time is 808 to 836 ms (4.2 to 4.6 times; statement time 1,506 to 1,575 ms, six times) for the same
  116 statements, and "Saving… to Saved" is 1.5 to 2.2 times. The move, with no refresh, went from 283 to 491 ms: the
  command's own reads grow too. The canvas shows none of the new tables: the page reads the workspace whole, as slice
  29 found. This is the read fixes slice's case (`docs/ideas.md`), now with a write figure.
- **The lock does what AD-38 says:** a second write in the same workspace waits for the import's transaction (one save
  2.5 s longer) and goes through after it, with nothing refused; writes before and after the transaction are
  unaffected. The upload and the server's plan (about 3 s here) do not hold the lock.
- **The import's transaction** wrote 14,000 rows and 14,000 change events in 2.76 s: about 0.2 ms a row with its event.

## AD-38's `lock_timeout` (now 10 s, provisional): proposal

**Decided** (2, above): **15 s**, without a 30,000-column import, built in the read fixes slice with AD-38's text
changed there.

**Proposal: 15 s.** Reasons:
- The import's transaction held the lock 2.76 s for 10,000 columns. The import takes at most 30,000 column rows (`MAX_IMPORT_ROWS`, `src/domain/import/standard.ts`): at the
  same rate a full import holds it about 8.3 s, so 10 s would leave only about 20 % room. That estimate comes from one
  warm sample, and a re-import with many changes, a busier database or a cold instance would take longer.
- 15 s is about 1.8 times the estimate: a save sent during the largest import waits and goes through, as Anna's did
  here.
- Past 15 s the busy refusal is the better answer: the draft stays editable, nothing is cut, and the person tries again
  (AD-38). A wait holds one of the instance's 5 pool connections; at 15 s that is still far below the function's
  duration (300 s).
- To set it on a measured figure rather than an extrapolation: one 30,000-column import measured the same way (on
  Łukasz's OK, since it adds 30,000 more columns to the demo, or in a workspace of its own soft-deleted afterwards).

## What the runs wrote into infomapper-dev, and what is left

All writes were in the demo's "Retail Co – DWH" (no other workspace has a change event after 12:38 UTC; never KB, no
`pg:seed`). The runs (with the copy's trial runs, 12:41 to 12:50 UTC, which failed on the off-screen drag) wrote 14,200
change events there:
- **Left by the runs, removed in the cleanup (below):** the system **"Synth 1795092803262"** with its 1,000 tables,
  10,000 columns, 1,000 classification links, 999 source relationships and their key columns, and its import row (the
  spec's plan). It slowed every page and every write in the workspace (above). It was the 26th step from the top of
  Łukasz's undo history there (S30-13's second run came after it). **Correction:** the first version of this report
  said the system could be deleted in its panel in one undo step. The app has no delete for a source system (its panel,
  `system-panel.tsx`, has its counts, "Re-import…", its changes and its imports; the source commands, `source.ts`,
  delete a table, not a system): it goes only by Undo of its import while that is still in the history, by deleting its
  tables one by one (which leaves the system), or by `pg:seed -- --reset`.
- **Left by the runs, removed in the cleanup:** **Product's card on "Customer & orders"** (608, 840), placed by the
  repository's spec at 12:38:33: its first click on "Product" in the Model tab added the entity to the canvas, as the
  tree does for an entity that is not there ("click to add"). Not a bug; a side effect of the spec.
- **Back as before:** Product's name (renamed 73 times, back to "Product"), Customer's (Anna, 12 times, back to
  "Customer"); the moved cards (38 moves, an even number per run, back and forth by 40 px).
- **Left as deleted rows:** 38 attributes added to Product and undone (soft-deleted, with their create and delete
  events).
- **Undo histories:** Łukasz 39 steps and Anna 12 in that workspace; the redo step Łukasz had there before the run went
  with the first new write.
- **Not made:** no workspace of the spec's own (nothing to soft-delete).

## The cleanup (decision 1, 19 November 2026)

Through the app on `dev`'s preview, signed in as Łukasz's demo account, on "Customer & orders" in "Retail Co – DWH",
with a scratchpad spec (not committed). Before each Undo the top step of Łukasz's undo list was read (`undo_step`, read
only) and compared with the expected position and label; after it, the top bar's indicator showed "Saved", the toast
named the step, and the step had left the undo list for the redo list (which records the revert's own change group).

| Undos | Steps | Label | Result |
| --- | --- | --- | --- |
| 1 | 113 | Rename entity | Saved, "Undone: Rename entity" |
| 2 to 13 | 112 down to 101 | Move card | each Saved, "Undone: Move card" (605 to 2,610 ms; Undo 3 not timed) |
| 14 to 25 | 100 down to 89 | Rename entity | each Saved, "Undone: Rename entity" (629 to 752 ms) |
| 26 | 88 | Import synth.csv | Saved, "Undone: Import synth.csv" (5,373 ms) |

Every label matched and no Undo was refused. The run stopped twice on the scratchpad spec's own checks, not on the app,
and went on from the next step after the database was read: after Undo 1 (it looked for the same change group in the
redo list) and during Undo 3 (the toast's element was reused with the same text, so the spec never saw it; the step had
been undone, the toast read "Undone: Move card").

Then, read back:
- **The system "Synth 1795092803262" is gone:** soft-deleted, no live table, column or source relationship of it; the
  Sources tab does not show it.
- **Product is named "Product"**, and the one card the measurement had moved besides Product's own is back in place
  (every `canvas_item` with a change event after 12:38 UTC, against its position before its first one).
- **Product's card is off "Customer & orders"** (412 ms to "Saved"); the entity Product is kept.
- **The check:** one rename (Customer to "Customer (check)") took **391 ms** to "Saved" and the rename back 341 ms,
  against 365 ms (307 to 386) before the import and 523 ms after it: the workspace's pages are back to their usual weight.
- **Undo histories now:** Łukasz's redo list is empty (the card's removal cleared it, so the import cannot be redone); his
  undo list has the measurement's earlier steps up to step 87 and three new ones (the card's removal and the two renames).

Raw samples: `.data/measure/s30/` (git-ignored): `s30-13-2026-11-19T12-39-12-902Z.json` (the spec as written),
`s30-13-precise-2026-11-19T12-52-26-707Z.json`, `s30-05-precise-2026-11-19T12-53-42-806Z.json`,
`s30-13-precise-2026-11-19T12-50-55-847Z.json` (a two-sample trial) and `s30-13-precise-2026-11-19T12-57-37-844Z.json` (after the import).

## Not measured

- The writes' own split on the server (Vercel's runtime log lines, above).
- Cold writes (a fresh deployment's first write), and the import more than once.
- A 30,000-column import (the cap), for the `lock_timeout` (above).
