# chore/e2e-recut: the full run's parts after slice 34

Branch `chore/e2e-recut` from `dev` at `b74fb81` (slice 34's merge), 21 November 2026. Step 1: the facts and the
proposal; no code. Shared infrastructure in CLAUDE.md's sense is not touched (only the e2e parts' list, its test and the
docs that name the parts), but the change is checked by a full run, as every recut before it.

## 1. Why

- **Time** (CLAUDE.md's recut rule): part 9 is the longest part by more than a minute on the median of the last three full
  runs: median 930 s against 729 s for the next longest part by median (part 5). Measured on the e2e step
  (`part.json`): part 9 930, 836 and 999 s; the next longest part in each run 707 (part 1), 742 (part 5) and 818 s
  (part 6).
- **Heap** (CLAUDE.md's "about 2 GB"): run 44915828042 peaked at 1,902 MB in part 5 and 1,937 MB in part 6. The peaks
  include garbage not yet collected (CLAUDE.md, "Heap peaks"), but the retained heap at the start of those parts' last
  folders reached 1,170 MB (part 5, `slice-09`) and 1,470 MB (part 6, `slice-13`), with peaks of 300 to 730 MB above it.
  Part 9 retains the most at its end (about 1,360 to 1,410 MB when `slice-34` starts), but its tests spike less.
- `docs/ideas.md`, "Slice 34's follow-ups": the recut after slice 34, on its own `chore/` branch with its own full run.

## 2. The facts

Source: the artifacts `part-<n>` of the full runs on `slice/34-markdown`, the last three on what `dev` now holds
(44915828042 on `fe72ec0`, 44909278968 on `8685d01`, 44897852644 on `eb227cc`) and, for reference, 44880173545 (on
`77ea32d`, `fix/blank-page-after-sign-in`, before slice 34's folder). Each part's memory logs
(`e2e-memory-ci-part<n>.tests.jsonl`, `.server.jsonl`: the child server's `heapUsedMb`) and `part.json`. Read with a
throwaway script in the session's scratchpad (not committed); numbers only.

### 2.1 Per part

The e2e step's seconds (`part.json`) and the child server's heap peak.

| Part | Folders | Tests | 44915828042 | 44909278968 | 44897852644 | Median time | 44880173545 |
| --- | --- | ---: | --- | --- | --- | ---: | --- |
| 1 | `fixes` to `slice-01b` | 89 | 707 s, 1,252 MB | 453 s, 1,343 MB | 583 s, 1,207 MB | 583 s | 736 s, 1,199 MB |
| 2 | `slice-02a` to `slice-03a` | 73 | 663 s, 1,112 MB | 676 s, 1,247 MB | 485 s, 1,530 MB | 663 s | 533 s, 1,483 MB |
| 3 | `slice-03b` to `slice-04p` | 60 | 457 s, 1,379 MB | 590 s, 998 MB | 415 s, 1,488 MB | 457 s | 433 s, 1,315 MB |
| 4 | `slice-05a` to `slice-07a` | 93 | 461 s, 1,362 MB | 601 s, 1,125 MB | 390 s, 1,433 MB | 461 s | 588 s, 1,193 MB |
| 5 | `slice-07b` to `slice-09` | 108 | 500 s, **1,902 MB** | 742 s, 1,329 MB | 729 s, 1,396 MB | 729 s | 504 s, 1,876 MB |
| 6 | `slice-10a` to `slice-13` | 130 | 572 s, **1,937 MB** | 549 s, 1,883 MB | 818 s, 1,326 MB | 572 s | 637 s, 1,459 MB |
| 7 | `slice-14a` to `slice-15d` | 89 | 609 s, 1,289 MB | 587 s, 1,281 MB | 389 s, 1,483 MB | 587 s | 586 s, 1,132 MB |
| 8 | `slice-16` to `slice-21` | 87 | 624 s, 1,129 MB | 574 s, 1,352 MB | 644 s, 1,031 MB | 624 s | 487 s, 1,456 MB |
| 9 | `slice-22` to `slice-34` | 169 | **930 s**, 1,601 MB | **836 s**, 1,729 MB | **999 s**, 1,642 MB | **930 s** | 887 s, 1,561 MB |

(44880173545 has no `slice-34` and its part 9 has 157 tests.) The run's wall-clock (first job to last): 1,036, 932 and
1,138 s. A whole job adds 45 to 100 s to its e2e step (checkout, `npm ci`, Playwright's Chromium).

**The runners differ more than the parts do:** the same part took 453 to 736 s (part 1) and 389 to 609 s (part 7) in
four runs, and a run's slow runner is not the same part each time. A recut can only balance the medians; the run's
wall-clock is its slowest runner.

### 2.2 Per folder

Median over the three runs of a folder's own wall time (its first test's start to its last test's end), the tests, and
the retained heap growth: the next folder's start heap minus its own (the lowest child heap in its first 30 s), median of
the three runs; a part's last folder has no next one in the same part and takes the median growth per test, 8.5 MB, times
its tests (marked *). Garbage makes single values noisy (one is below zero); their sums over a part are what the
proposal uses.

| Folder | Tests | Time | Growth | Folder | Tests | Time | Growth |
| --- | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| `fixes` | 32 | 128 s | 259 MB | `slice-12a` | 12 | 72 s | 135 MB |
| `slice-00` | 21 | 134 s | 123 MB | `slice-12b` | 10 | 36 s | 58 MB |
| `slice-01a` | 19 | 152 s | 141 MB | `slice-13` | 20 | 86 s | 170 MB* |
| `slice-01b` | 17 | 142 s | 145 MB* | `slice-14a` | 23 | 132 s | 237 MB |
| `slice-02a` | 16 | 199 s | 150 MB | `slice-14b` | 19 | 108 s | 215 MB |
| `slice-02b` | 14 | 111 s | 169 MB | `slice-15a` | 9 | 66 s | 19 MB |
| `slice-02c` | 27 | 161 s | 353 MB | `slice-15b` | 17 | 100 s | 139 MB |
| `slice-03a` | 16 | 162 s | 136 MB* | `slice-15c` | 14 | 107 s | 118 MB |
| `slice-03b` | 17 | 140 s | 346 MB | `slice-15d` | 7 | 41 s | 60 MB* |
| `slice-04a` | 14 | 106 s | 167 MB | `slice-16` | 25 | 136 s | 226 MB |
| `slice-04b1` | 14 | 80 s | 134 MB | `slice-17` | 17 | 100 s | 76 MB |
| `slice-04b2` | 11 | 77 s | −115 MB | `slice-18` | 16 | 107 s | 151 MB |
| `slice-04p` | 4 | 30 s | 34 MB* | `slice-19` | 11 | 80 s | 88 MB |
| `slice-05a` | 29 | 126 s | 288 MB | `slice-20` | 8 | 99 s | 82 MB |
| `slice-06a` | 17 | 92 s | 68 MB | `slice-21` | 10 | 68 s | 85 MB* |
| `slice-06b` | 14 | 76 s | 223 MB | `slice-22` | 13 | 78 s | 196 MB |
| `slice-07a` | 33 | 143 s | 281 MB* | `slice-23` | 15 | 67 s | 181 MB |
| `slice-07b` | 31 | 191 s | 392 MB | `slice-24` | 14 | 56 s | 36 MB |
| `slice-07c` | 30 | 227 s | 157 MB | `slice-25` | 26 | 144 s | 215 MB |
| `slice-08` | 19 | 108 s | 163 MB | `slice-26` | 28 | 123 s | 10 MB |
| `slice-09` | 28 | 171 s | 238 MB* | `slice-27` | 20 | 111 s | 101 MB |
| `slice-10a` | 44 | 183 s | 398 MB | `slice-28` | 13 | 121 s | 37 MB |
| `slice-10b` | 13 | 49 s | 130 MB | `slice-30` | 5 | 26 s | 112 MB |
| `slice-10c` | 14 | 66 s | 20 MB | `slice-32` | 12 | 61 s | 8 MB |
| `slice-11` | 17 | 57 s | 102 MB | `slice-33` | 11 | 56 s | 68 MB |
|  |  |  |  | `slice-34` | 12 | 53 s | 102 MB* |

(`slice-34`: two runs, 44897852644 had no specs in it yet.)

**The model for a part:** time = the sum of its folders' times + 30 s (its server's start and warm-up inside the e2e
step); retained heap at its end = 300 MB (the server after warm-up) + the sum of its folders' growth; peak = retained +
300 to 730 MB of garbage (about 500 MB typical). Checked on today's cut: it gives part 9 926 s and about 1,370 MB retained
(measured: 930 s median; 1,356 to 1,408 MB when `slice-34` starts), part 5 727 s and about 1,250 MB (measured 729 s;
1,170 MB when `slice-09` starts in 44915828042, which peaked at 1,902 MB).

## 3. The options

The in-order cuts that make the longest part as short as possible (exhaustive, by the model above).

**A. Nine parts, moved for time only:** `slice-02a`, `slice-03b`, `slice-06b`, `slice-08`, `slice-10c`, `slice-15b`,
`slice-19`, `slice-26`. The longest part 681 s (from 930 s), but part 4 (`slice-06b` to `slice-07c`, with 07b and 07c,
the heaviest folders on the heap) retains about 1,350 MB: a peak near 1.85 GB typical, past 2 GB at the worst garbage
seen. No gain on the heap.

**B. Nine parts, retained heap held to 1,300 MB:** `slice-02a`, `slice-03b`, `slice-06a`, `slice-07c`, `slice-10b`,
`slice-14b`, `slice-17`, `slice-25`. The longest part 725 s; two parts retain about 1,260 MB (peaks about 1.75 GB
typical, about 2 GB at the worst), as today's parts 5 and 6. No nine-part cut keeps every part under 1,250 MB retained.
The last part has the least room for slices to come (about 950 MB retained).

**C. Ten parts (recommended):** `PART_STARTS` = `slice-02a`, `slice-03a`, `slice-04b2`, `slice-07b`, `slice-09`,
`slice-12a`, `slice-15b`, `slice-19`, `slice-26`.

| Part | Folders | Tests | Expected time | Retained | Expected peak |
| --- | --- | ---: | ---: | ---: | ---: |
| 1 | `fixes` to `slice-01b` (unchanged) | 89 | 586 s | ~970 MB | ~1.5 GB |
| 2 | `slice-02a` to `slice-02c` | 57 | 501 s | ~970 MB | ~1.5 GB |
| 3 | `slice-03a` to `slice-04b1` | 61 | 518 s | ~1,080 MB | ~1.6 GB |
| 4 | `slice-04b2` to `slice-07a` | 108 | 574 s | ~1,080 MB | ~1.6 GB |
| 5 | `slice-07b` to `slice-08` | 80 | 556 s | ~1,010 MB | ~1.5 GB |
| 6 | `slice-09` to `slice-11` | 116 | 556 s | ~1,190 MB | ~1.7 GB |
| 7 | `slice-12a` to `slice-15a` | 93 | 530 s | ~1,130 MB | ~1.6 GB |
| 8 | `slice-15b` to `slice-18` | 96 | 621 s | ~1,070 MB | ~1.6 GB |
| 9 | `slice-19` to `slice-25` | 97 | 622 s | ~1,180 MB | ~1.7 GB |
| 10 | `slice-26` to `slice-34` | 101 | 581 s | ~740 MB | ~1.2 GB |

- The longest part 622 s (from 930 s); every part retains at most about 1,190 MB, so the worst peak seen above the
  retained heap (730 MB) stays under 2 GB (about 1.92 GB), where today's parts reach about 2.1 GB by the same measure.
  About 1,190 MB is the floor for ten in-order parts (no ten-part cut keeps every part under 1,150 MB).
- `slice-07b` and `slice-07c` stay together, at the start of a part, as chore recut e2e parts wanted them (fresh server).
- The last part starts light (about 740 MB retained, 581 s): room for about four slices at slice 34's size (about 12
  tests, 55 s and 100 MB each) before the recut rule's minute is reached (about 680 s).
- `fixes` sorts before `slice-00` and stays in part 1.

**Why C:** the time rule is met by A and B too, but only C lowers the heap of the heaviest parts, which is the other
reason for this chore; a recut on nine parts would be due again within a slice or two on the heap.

## 4. What it costs

- **CI minutes:** the repository is public, so GitHub's standard runners cost nothing. Runner time grows by one job's
  setup and server start, about 2 minutes a full run (100 to 104 minutes of part jobs in the three runs); the tests' own time
  does not change.
- **Wall-clock of a full run:** expected about 12 to 13 minutes on the medians (the longest e2e step about 620 s, its job
  about 700 s, plus `e2e-plan` and `e2e-report`), against 15.5 to 19 minutes in the three runs; the slowest runner decides
  it, so a single run may still take 14 to 15 minutes.
- **Concurrency:** ten part jobs side by side, plus CI and Schema on a push; within GitHub's 20 concurrent jobs for a free
  account (to be confirmed for the account's plan if a run queues).
- **The local fallback** (`npm run e2e`, one part after another): one more server start, about 1 to 2 minutes on the
  laptop's about 95.
- **Nothing in the workflow changes:** `e2e.yml` reads `PART_COUNT` from `e2e/parts.ts`, `scripts/e2e.ts` loops over it,
  and `scripts/e2e-summary.ts` sorts `part-<n>` folders as numbers (`part-10` after `part-9`).

## 5. The plan

**Step 2: the change and the full run.**
1. `e2e/parts.ts`: `PART_STARTS` as in option C; its header comment (ten since this chore, by the median folder times and
   heap growth of the three full runs 44915828042, 44909278968 and 44897852644).
2. `tests/e2e-parts.test.ts`: "has ten parts" (`PART_COUNT` 10) and its other expectations of the starts.
3. `scripts/e2e.ts`'s header comment ("ten parts").
4. The docs that name the parts: CLAUDE.md ("Test runs": the full run's parts; "Commands": `--part`; "The full run in
   ten parts" with the new `PART_STARTS`), README (the e2e command's row and the status line's chores), `docs/ideas.md`
   (the recut entry of slice 34's follow-ups: done; the parts' heap history).
5. `npm run e2e -- --list` (each part's files, no server), `npm run lint`, `npm run typecheck`, `npm test`.
6. Commit, push, open the draft PR into `dev` (CI's `check`, Schema's `migrations` and `smoke`).
7. One full run (`gh workflow run e2e.yml --ref chore/e2e-recut`): every part's time and heap peak against section 3's
   table, with the report (link, commit, wall-clock, parts' times and peaks, passed / failed / skipped). If a part misses
   the expectation by much (a time over about 750 s or a peak over 1.9 GB), stop and report, without cutting again.
8. The results go into this file (section 6) and the PR's description.

**Then:** a closing prompt with the merge only (CLAUDE.md, The slice cycle, 7): `dev` merged into the branch first if it
moved (and the full run again on that commit unless only Markdown in `docs/` and the root changed), CI passed on the last
commit, a merge into `dev`. No tag: a chore has none.

## 6. Łukasz's answers on step 1 (24 November 2026)

- **Option C: ten parts**, `PART_STARTS` `slice-02a`, `slice-03a`, `slice-04b2`, `slice-07b`, `slice-09`, `slice-12a`,
  `slice-15b`, `slice-19`, `slice-26` (CC's call, for Łukasz's approval at the closing).
- **Concurrency:** 13 jobs on a push (ten parts, CI and Schema) fit the free plan's 20 concurrent jobs; no check needed.
- Step 2 as planned.

## 7. Step 2: the change and the full run

(Results below.)
