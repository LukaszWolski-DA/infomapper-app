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

_The full run on this branch: filled in after it ran._
