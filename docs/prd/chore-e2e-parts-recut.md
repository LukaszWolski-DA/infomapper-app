# chore/e2e-parts-recut: the full run's parts after slice 35

Branch `chore/e2e-parts-recut` from `dev` at `3403287` (slice 35's merge), 25 November 2026. No application code and no
e2e spec changes: only where the parts are cut (`e2e/parts.ts`, its unit test `tests/e2e-parts.test.ts`, CLAUDE.md's
line naming the cut). The number of parts stays ten. The change is checked by a full run, as every recut before it.

## 1. Why

In the last two full runs, part 9 (`slice-19` to `slice-25`) peaked at **1,941 MB** (45440728536) and **1,864 MB**
(45487488095). We watch the line at 1,850 MB, and the limit is about 2 GB (CLAUDE.md, "The full run in ten parts").
Parts 5 and 7 came close as well (1,729 and 1,716 MB), and part 10 reached 1,584 MB once slice 35's folder joined it.

## 2. The facts

Source: the artifacts `part-<n>` of the three full runs on slice 35, 45425975437 (`11f284b`), 45440728536 (`e58cc93`) and
45487488095 (`d6ba340`): each part's memory logs (`e2e-memory-ci-part<n>.tests.jsonl` and `.server.jsonl`, the child
server's `heapUsedMb`) and `part.json`. They were read with a throwaway script in the session's scratchpad, not committed,
and only numbers were read.

For each folder, over the three runs:

- **time:** the median wall time, from its first test's start to its last test's end;
- **growth:** the median retained heap growth. This is the next folder's start heap minus its own, where a folder's start
  heap is the lowest child heap in its first 30 s. For a part's last folder it is the part's lowest heap in its last
  30 s minus the folder's start heap. It is never taken as less than 4 MB a test;
- **spike:** the peak during the folder minus its start heap, as a median and as the worst of the three runs.

**The model for a part:**

- time = its folders' times + 30 s;
- retained heap = 330 MB (the server after warm-up) + its folders' growth, in order;
- expected peak = the highest of (the retained heap when a folder starts + that folder's median spike);
- worst peak = the same with the worst spike.

Checked on today's cut, the model gives part 9 1,947 MB expected (measured 1,941, 1,864 and 1,351 MB), part 7 1,724 MB
(measured 1,700, 1,716 and 1,255) and part 5 1,690 MB (measured 1,642, 1,202 and 1,729).

**Why part 9 was high:** `slice-25` (26 tests, Paged.js layouts) spikes 600 to 700 MB above its start heap. In part 9
it started last, at about 1,250 MB retained in two of the three runs, after `slice-21` and `slice-24`, which grow
about 355 and 260 MB each.

## 3. The cut

| | `PART_STARTS` |
| --- | --- |
| Old (chore e2e recut) | `slice-02a`, `slice-03a`, `slice-04b2`, `slice-07b`, `slice-09`, `slice-12a`, `slice-15b`, `slice-19`, `slice-26` |
| New | `slice-01b`, `slice-03a`, `slice-04p`, `slice-07c`, `slice-10a`, `slice-12b`, `slice-15c`, `slice-22`, `slice-27` |

The new cut came from an exhaustive search over the in-order cuts into ten parts. It keeps the expected peak of every
part at or below 1,500 MB and the worst peak at or below 1,650 MB, and among those cuts it has the shortest longest
part.

| Part | Folders | Tests | Expected time | Retained | Expected peak | Worst peak |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | `fixes` to `slice-01a` | 72 | 402 s | ~1,070 MB | ~1,310 MB | ~1,640 MB |
| 2 | `slice-01b` to `slice-02c` | 74 | 631 s | ~970 MB | ~1,350 MB | ~1,520 MB |
| 3 | `slice-03a` to `slice-04b2` | 72 | 677 s | ~1,150 MB | ~1,240 MB | ~1,340 MB |
| 4 | `slice-04p` to `slice-07b` | 128 | 581 s | ~1,390 MB | ~1,410 MB | ~1,460 MB |
| 5 | `slice-07c` to `slice-09` | 77 | 436 s | ~1,170 MB | ~1,410 MB | ~1,460 MB |
| 6 | `slice-10a` to `slice-12a` | 100 | 649 s | ~1,210 MB | ~1,330 MB | ~1,340 MB |
| 7 | `slice-12b` to `slice-15b` | 98 | 512 s | ~1,440 MB | ~1,480 MB | ~1,490 MB |
| 8 | `slice-15c` to `slice-21` | 108 | 695 s | ~1,480 MB | ~1,440 MB | ~1,480 MB |
| 9 | `slice-22` to `slice-26` | 96 | 427 s | ~1,240 MB | ~1,350 MB | ~1,440 MB |
| 10 | `slice-27` to `slice-35` | 88 | 497 s | ~930 MB | ~1,250 MB | ~1,460 MB |

By the same model the old cut gives:

- **Peaks:** expected peaks up to 1,947 MB (part 9), worst up to 2,041 MB.
- **Time:** the longest part is 739 s (part 6). On the new cut it is 695 s (part 8).

**The reasoning:**

- **Heap first.** No ten-part cut keeps every expected peak under 1,450 MB with the worst under 1,650 MB, so this cut is
  about as low as ten in-order parts get. The expected peaks are 200 to 450 MB under 1,850 MB.
- **`slice-25`** now starts at about 740 MB retained (part 9 after `slice-22` to `slice-24`). `slice-26` follows it in
  the same part, at about 850 MB.
- **`slice-07b` and `slice-07c` are split.** `slice-07b` grows the most of any folder (about 530 MB), so it now ends
  part 4, where its growth no longer matters. `slice-07c` starts part 5 on a fresh server. The previous recut kept them
  together at a part's start, which put `slice-08` (spikes about 700 MB) on top of `slice-07b`'s growth: that is today's
  1,729 MB in part 5.
- **The last part starts light** (about 930 MB retained, 497 s): there is room for slice 36 and a few slices after it.
- **Ten parts, not eleven.** The best eleven-part cut under the same caps saves 18 s on the longest part (677 s against
  695 s) with no lower worst peak. An eleventh part costs one more job's setup and server start (about 2 minutes of
  runner time a run, and one more locally), so it is not clearly better.

The runners vary more than the parts do: the same part took 382 to 530 s (part 5) and 489 to 747 s (part 1) across the
three runs. A run's wall-clock is decided by its slowest runner. The peaks include garbage not yet collected (CLAUDE.md,
"Heap peaks"), so a single run's peak can differ from the expected peak by a few hundred MB either way.

## 4. The results

- CI `check`, Schema `migrations` and `smoke` passed on `54e5e70` (PR 94). Locally: `tests/e2e-parts.test.ts` (7
  passed), typecheck, and lint on the changed files.
- **Full run** [45563847036](https://github.com/LukaszWolski-DA/infomapper-app/actions/runs/45563847036) on `54e5e70`,
  which contains `dev`'s head `3403287`: **897 passed, 16 skipped, 0 failed, 0 flaky**. Wall-clock 14 min 57 s
  (06:52:35 to 07:07:32 UTC), against 15 min 4 s and 15 min 42 s in the last two runs.

| Part | Folders | E2e step | Job | Heap peak | Expected peak |
| --- | --- | ---: | ---: | ---: | ---: |
| 1 | `fixes` to `slice-01a` | 558 s | 11 min 16 s | 1,115 MB | ~1,310 MB |
| 2 | `slice-01b` to `slice-02c` | 518 s | 9 min 55 s | 1,564 MB | ~1,350 MB |
| 3 | `slice-03a` to `slice-04b2` | 482 s | 9 min 32 s | 1,560 MB | ~1,240 MB |
| 4 | `slice-04p` to `slice-07b` | 737 s | 13 min 40 s | 1,364 MB | ~1,410 MB |
| 5 | `slice-07c` to `slice-09` | 551 s | 10 min 41 s | 1,378 MB | ~1,410 MB |
| 6 | `slice-10a` to `slice-12a` | 502 s | 9 min 48 s | 1,501 MB | ~1,330 MB |
| 7 | `slice-12b` to `slice-15b` | 419 s | 8 min 1 s | 1,630 MB | ~1,480 MB |
| 8 | `slice-15c` to `slice-21` | 620 s | 11 min 43 s | **1,721 MB** | ~1,440 MB |
| 9 | `slice-22` to `slice-26` | 401 s | 7 min 44 s | **1,751 MB** | ~1,350 MB |
| 10 | `slice-27` to `slice-35` | 418 s | 7 min 56 s | 1,180 MB | ~1,250 MB |

**Every part is under 1,850 MB**, and the highest peak fell from 1,941 and 1,864 MB to 1,751 MB. **Parts 8 and 9 still
peaked above 1,700 MB**, about 300 to 400 MB above the model's expected peaks:

- **Part 9:** `slice-25` grew 527 MB in this run. The model had 104 MB for it, because it had always been a part's last
  folder, where growth can only be estimated. So `slice-26` started at 1,570 MB and peaked at 1,751 MB.
- **Part 8:** `slice-20` grew 387 MB (the model had 67 MB), and `slice-21` started at 1,454 MB and peaked at 1,721 MB.

**Łukasz's decision** (25 November 2026): an eleventh part, on this PR before the merge.

## 5. The eleven-part cut

### 5.1 The model again, with the fourth run

The figures now come from four full runs: the three above and 45563847036. For a folder that had been the last of its
part in all three earlier runs, the earlier figure was only an estimate, so its growth is now the one measured in
45563847036:

| Folder | Growth (earlier estimate → measured in 45563847036) |
| --- | --- |
| `slice-01b` | 136 → 423 MB |
| `slice-04b1` | 100 → 45 MB |
| `slice-07a` | 132 → 214 MB |
| `slice-08` | 425 → 379 MB |
| `slice-18` | 75 → 276 MB |
| `slice-25` | 104 → **527 MB** |

Two further rules:

- **Floors:** `slice-11` (−274 MB) and `slice-15a` (−500 MB) were measured as garbage collected during the folder, so
  they take the floor of 4 MB a test.
- **`slice-20`:** it was measured in all four runs (279, −4, 67 and 387 MB), but takes 45563847036's 387 MB, as Łukasz
  asked. The other folders keep the median of the runs in which they were measured.

With these figures, the model gives the ten-part cut part 8 1,893 MB expected (measured 1,721 MB) and part 9 1,780 MB
(measured 1,751 MB). The model is now on the pessimistic side, which is where it should be. Part 7 is the exception:
modelled 1,552 MB, measured 1,630 MB.

### 5.2 The cut

| | `PART_STARTS` |
| --- | --- |
| Ten parts (section 3) | `slice-01b`, `slice-03a`, `slice-04p`, `slice-07c`, `slice-10a`, `slice-12b`, `slice-15c`, `slice-22`, `slice-27` |
| **Eleven parts** | `slice-02a`, `slice-03b`, `slice-06a`, `slice-07c`, `slice-10a`, `slice-13`, `slice-15c`, `slice-21`, `slice-25`, `slice-27` |

The cut came from an exhaustive search over the in-order cuts into eleven parts. It keeps every part's expected peak at
or below 1,500 MB and has the shortest longest part.

| Part | Folders | Tests | Expected time | Retained | Expected peak | Worst peak |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | `fixes` to `slice-01b` | 89 | 604 s | ~1,380 MB | ~1,360 MB | ~1,540 MB |
| 2 | `slice-02a` to `slice-03a` | 73 | 578 s | ~1,050 MB | ~1,290 MB | ~1,390 MB |
| 3 | `slice-03b` to `slice-05a` | 89 | 614 s | ~1,160 MB | ~1,290 MB | ~1,580 MB |
| 4 | `slice-06a` to `slice-07b` | 95 | 500 s | ~1,270 MB | ~1,260 MB | ~1,340 MB |
| 5 | `slice-07c` to `slice-09` | 77 | 478 s | ~1,120 MB | ~1,330 MB | ~1,420 MB |
| 6 | `slice-10a` to `slice-12b` | 110 | 614 s | ~1,390 MB | ~1,490 MB | ~1,500 MB |
| 7 | `slice-13` to `slice-15b` | 88 | 443 s | ~1,280 MB | ~1,330 MB | ~1,510 MB |
| 8 | `slice-15c` to `slice-20` | 98 | 608 s | ~1,600 MB | ~1,480 MB | ~1,750 MB |
| 9 | `slice-21` to `slice-24` | 52 | 245 s | ~1,190 MB | ~1,390 MB | ~1,510 MB |
| 10 | `slice-25` to `slice-26` | 54 | 254 s | ~1,250 MB | ~1,270 MB | ~1,360 MB |
| 11 | `slice-27` to `slice-35` | 88 | 474 s | ~1,020 MB | ~1,300 MB | ~1,540 MB |

- **Parts 8 and 9 of the ten-part cut are split.**
  - `slice-21`, which peaked last at 1,721 MB, now starts part 9 on a fresh server.
  - `slice-25` (527 MB kept, spikes up to about 700 MB) starts part 10, followed only by `slice-26`.
- **No eleven-part cut keeps the worst peak under 1,700 MB as well.** In part 8, `slice-20`'s spike of 538 MB (seen
  once, in 45563847036) on top of `slice-15c` to `slice-19` gives about 1,750 MB.
- **Time:** the longest part is 614 s, against 658 s for the ten-part cut by the same model.
  - Parts 9 and 10 are short (about 250 s). Any cut that keeps `slice-25` and `slice-21` off a heavy retained heap leaves
    them so.
  - The run's wall-clock is decided by the slowest runner, as before.
- **The cost:** one more job's setup and server start, about 2 minutes of runner time per full run (free on the public
  repository's standard runners), and one more server start in the local fallback. There are eleven part jobs side by
  side, plus CI and Schema on a push, within GitHub's 20 concurrent jobs.
- **The workflow needs no change.** `e2e-plan` reads `PART_COUNT` from `e2e/parts.ts` (`seq 1 $count`). `scripts/e2e.ts`
  loops to `PART_COUNT`. `scripts/e2e-summary.ts` sorts `part-<n>` as numbers. The limit of 10 in `e2e.yml` is for a
  single-file check's `rounds` only. Checked: `PART_COUNT` read the way the workflow reads it gives 11, and
  `npm run e2e -- --list` lists eleven parts.
- **Left as written:** `scripts/e2e.ts`' header comment and two lines of CLAUDE.md ("Test runs": "its ten parts", and the
  commands list's `--part 2`) still say "ten parts". This change was limited to the line that names the cut.

### 5.3 The results

- CI `check`, Schema `migrations` and `smoke` passed on `a57e0d3`. Locally: `tests/e2e-parts.test.ts` (7 passed),
  typecheck, and lint on the changed files.
- **Full run** [45566512650](https://github.com/LukaszWolski-DA/infomapper-app/actions/runs/45566512650) on `a57e0d3`,
  which contains `dev`'s head `3403287`: **897 passed, 16 skipped, 0 failed, 0 flaky**. Wall-clock 14 min 33 s
  (07:13:57 to 07:28:30 UTC). Each part ran with its own fresh dev server, side by side.

| Part | Folders | E2e step | Job | Heap peak | Expected peak |
| --- | --- | ---: | ---: | ---: | ---: |
| 1 | `fixes` to `slice-01b` | 501 s | 9 min 48 s | 1,318 MB | ~1,360 MB |
| 2 | `slice-02a` to `slice-03a` | 516 s | 9 min 53 s | 1,312 MB | ~1,290 MB |
| 3 | `slice-03b` to `slice-05a` | 609 s | 11 min 30 s | 1,374 MB | ~1,290 MB |
| 4 | `slice-06a` to `slice-07b` | 637 s | 12 min 2 s | 1,370 MB | ~1,260 MB |
| 5 | `slice-07c` to `slice-09` | 516 s | 10 min 15 s | 1,536 MB | ~1,330 MB |
| 6 | `slice-10a` to `slice-12b` | 705 s | 13 min 16 s | 1,202 MB | ~1,490 MB |
| 7 | `slice-13` to `slice-15b` | 392 s | 7 min 39 s | 1,573 MB | ~1,330 MB |
| 8 | `slice-15c` to `slice-20` | 494 s | 9 min 39 s | 1,608 MB | ~1,480 MB |
| 9 | `slice-21` to `slice-24` | 251 s | 5 min 22 s | 1,105 MB | ~1,390 MB |
| 10 | `slice-25` to `slice-26` | 263 s | 5 min 47 s | 1,391 MB | ~1,270 MB |
| 11 | `slice-27` to `slice-35` | 628 s | 12 min 2 s | 1,388 MB | ~1,300 MB |

**Every part is under 1,700 MB.** The highest peak is 1,608 MB (part 8, during `slice-20`, which started at 1,340 MB).
It was 1,941 MB and 1,864 MB in the last two runs on the old cut, and 1,751 MB on the ten-part cut. The wall-clock is
about the same as before: 14 min 33 s, against 14 min 57 s (ten parts) and 15 min 4 s and 15 min 42 s (the old cut).

Beside the ten-part run 45563847036:

| | Ten parts (45563847036) | Eleven parts (45566512650) |
| --- | --- | --- |
| Highest heap peak | 1,751 MB (part 9) | 1,608 MB (part 8) |
| Parts above 1,700 MB | 2 | 0 |
| Longest e2e step | 737 s (part 4) | 705 s (part 6) |
| Wall-clock | 14 min 57 s | 14 min 33 s |
| Tests | 897 passed, 16 skipped | 897 passed, 16 skipped |
