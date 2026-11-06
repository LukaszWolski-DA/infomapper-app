# Chore – Full e2e runs in GitHub Actions

Status: **step 1 done and answered** (Łukasz, 6 November 2026); step 2 on the way. Branch `chore/ci-e2e`, from `main` at tag `slice-15c` (assumption A1).
PRD file: `docs/prd/chore-ci-e2e.md`; step 1 writes `docs/prd/chore-ci-e2e-acceptance.md`. A chore: no change to the
application's behaviour, the data model or the local data file. Step 1 checks this PRD against the code, the e2e setup
and GitHub (CLAUDE.md, "How we work").

This PRD was written from the docs at slice 15c's closing (CLAUDE.md, `docs/prd/chore-e2e-reliability-acceptance.md`,
`docs/prd/slice-15-acceptance.md`), **without reading the code or `.github/`**.

## 0. Answers to step 1 (Łukasz, 6 November 2026)

Where this section and a later one disagree, this section wins. The findings behind it are in
`docs/prd/chore-ci-e2e-acceptance.md`, "Step 1".

- **The repository is public:** standard runners are free and unlimited. P1's Windows multiplier and P6's "minutes
  used up" are void; the local `npm run e2e` stays the fallback when GitHub is down.
- **Seven parts** (P2), cut from the laptop's folder times now, in step 2 already: `PART_STARTS = ["slice-02b",
  "slice-04a", "slice-07a", "slice-08", "slice-10c", "slice-14a"]`. One list for CI and the local run. Step 3 corrects
  the cuts from the runner's folder times only if a part is clearly longer than the rest.
- **The dev server's output** goes to a file in both places, `test-results/part-<n>/server.log`, not to the console. In
  CI it is part of the part's artifacts; CI-04's "no server prints the restart" is read from it.
- **The label** `full-e2e` is created in step 2.
- **`TZ: Europe/Warsaw`** in the workflow; one sentence in `docs/known-limitations.md`: the e2e run has not been run in
  another time zone.
- **The single-file check is not `repeat_each`** (replaces P4's inputs and CI-06): a `workflow_dispatch` input `rounds`
  (default 3) starts that many jobs side by side, each with its own fresh dev server, each running `files` once.
- **Label runs** check out `github.event.pull_request.head.sha`: a run's commit is the branch's head commit, the one a
  report names (P6).
- **Concurrency** (P3): full runs (a dispatch without `files`, or the label) share one group per branch name
  (`head_ref` for a pull request, `ref_name` for a dispatch), `cancel-in-progress: true`. A single-file check has a group
  of its own per run (with `run_id`) and neither cancels nor is cancelled.
- **`files`** reaches the script only through an environment variable, checked against a pattern (paths under `e2e/`,
  no character a path does not need); anything else fails the job before a server starts.
- **CI-02 becomes:** CI runs exactly the local full run's list per part, S1A-14, S1B-09, S1B-10 and S2A-14 included;
  the `MEASURE=1`-only specs are skipped as locally. If one of those four asserts a duration, it is named as a risk on
  the runner.
- **A per-part list in the wrapper:** `npm run e2e -- --list` prints the files of each part, with `--part <n>` one part;
  `tests/e2e-parts.test.ts` covers it.
- **The memory log's machine half on Linux:** the smallest portable way (`os.freemem()` or `/proc/meminfo`); Windows's
  stays as it is.
- **Step 2** as section 4 says, with the above: the workflow made to work with `workflow_dispatch` runs of a part or a
  folder at a time (not full runs), then one full run on the branch, its failures checked with `rounds` 3. The branch is
  pushed for the runs; no pull request yet.

## 1. Why this chore

A full e2e run takes 90 to 130 minutes on the development laptop (i7-8550U, 8 GB), in four parts with a fresh dev
server each (`npm run e2e`, `e2e/parts.ts`). Slice 15c's closing showed that the runs measure the laptop's load as much
as the code: the same 582 tests took 1.32× longer in step 5 than in step 3, with the slowdown following the clock, not
the changed folders; part 4 had to be rerun (35 min 36 s on its own) and S2C-03's sign-in timed out once (3/3 on its
own). While a run lasts, the laptop is not usable for the manual checks.

15d needs at least two full runs (the requirement index and the lens touch the canvas's layers; the run before the
merge, which is also slice 15's closing), and every later slice needs one or two. **Agreed with Łukasz on 6 November
2026:** this chore comes before 15d.

**Proposed, to confirm in step 1:**

- **P1. Linux runners** (`ubuntu-latest`, standard size), with whatever the e2e setup needs to run off Windows (the
  laptop's OS: S0-10 stops its servers with `taskkill /T /F`). **B:** Windows runners, the laptop's OS, at a higher cost
  in minutes and usually a slower start. Step 1 lists every Windows-only line in `e2e/`, `scripts/` and
  `playwright.config.ts` and what each costs to make portable.
- **P2. One job per part, in parallel** (a matrix over `e2e/parts.ts`), each with its own fresh dev server as locally,
  and one final job that merges the blob reports. **One list of parts for both places:** if the runner needs more or
  differently cut parts to finish in time or stay below its memory threshold, `PART_STARTS` changes for the local run
  too (a split costs about 2 % of a run per part, chore e2e reliability F7). Target: the whole run in **25 to 30
  minutes** wall-clock.
- **P3. Triggers:** by hand (`workflow_dispatch`, any branch) and by a label `full-e2e` on a pull request; **not** on
  every push. A new run for the same ref cancels the one still running (`concurrency`). The existing CI workflow (lint,
  typecheck, unit tests) is unchanged.
- **P4. No retries in CI** (`retries: 0`; today `playwright.config.ts` sets 1 when `CI` is set). A retry hides a flake
  that the regime wants to see; a failing test is run three times on its own (CLAUDE.md), which the workflow offers
  too: `workflow_dispatch` inputs `files` (spec files or folders, default empty = the full run) and `repeat_each`
  (default 1; 3 for the check).
- **P5. What a run leaves:** one merged HTML report; per part the blob report, the failures' traces and screenshots,
  the dev server's log and the memory log (`E2E_MEMORY_LOG=1` always on in CI); a job summary with the counts (passed,
  failed, skipped, flaky = 0 by P4), each part's duration and memory peak, and the failed tests with their files.
  Artifacts kept 14 days.
- **P6. The regime** (CLAUDE.md, "Testing"): "a full e2e run" means a run of this workflow on the commit the report
  names; a report quotes the run's link, its commit and the summary. A run counts only for the commit it ran on. The
  local `npm run e2e` stays as the fallback (GitHub down, minutes used up). When a full run is due (a step on shared
  infrastructure, before a merge) is unchanged.

## 2. Sources

- **CLAUDE.md:** "Testing" (the regime, a failing test three times on its own), "The full run in four parts"
  (`scripts/e2e.ts`, `e2e/parts.ts`, `PART_STARTS`, `tests/e2e-parts.test.ts`, merged blob reports, traces in
  `test-results/part-<n>/`, the heap's growth of about 6 MB a test, the restart at 80 % of the heap limit), the fonts
  (P3 B: IBM Plex local, no build fetches fonts), "Never run `npm run e2e` while your own dev server runs".
- **`docs/prd/chore-e2e-reliability-acceptance.md`:** F1 (Next.js sets the heap limit to 50 % of the machine's memory
  and restarts at 80 % of it), F5 (`webServer`: port 3200, `INFOMAPPER_DEV_DB=.data/e2e-db.json`,
  `NEXT_DIST_DIR=.next-e2e`, `INFOMAPPER_TEST_HOOKS=1`, 120 s; `reuseExistingServer: !process.env.CI`; one worker;
  `retries` 1 on CI; S0-10's own server on port 3201), F7 (the split).
- **`docs/prd/slice-15-acceptance.md`,** "15c step 6": the durations by part and folder, the load-driven slowdown.
- **AD-31:** production-build e2e runs come with the database slice; not here.
- **AD-24's reference machine:** performance is measured on the laptop; the `MEASURE=1` specs never run in CI.

## 3. What to build

1. **`.github/workflows/e2e.yml`** as P2 to P5: checkout, Node as the repository pins it, `npm ci` with npm's cache,
   Playwright's Chromium (cached by Playwright's version), one job per part, the merge job, artifacts, the summary.
2. **Portability** (P1): only what the Linux run needs, in `e2e/`, `scripts/` or `playwright.config.ts`; each change
   named in the report with the reason. The local Windows run keeps working.
3. **`retries: 0` in CI** (P4) and the `files` / `repeat_each` inputs.
4. **The parts** (P2): moved or added only if the runner's times or memory call for it, with `tests/e2e-parts.test.ts`.
5. **The docs** (section 7).

**Unchanged:** the application's code and behaviour, the seed, every test's assertions, `npm run dev`, the local
`npm run e2e`, the existing CI workflow, Łukasz's KB model (`.data/dev-db.json`).

## 4. Steps

Stop after each step with a short summary and wait for Łukasz.

1. **Critical review** (section 6). Answer Q1–Q8 in `docs/prd/chore-ci-e2e-acceptance.md`, with a proposal for P1 to P6 and the
   estimated minutes per run. No change yet. Stop.
2. **The workflow and the portability**, iterated on the branch with `workflow_dispatch` runs (a part or a folder at a
   time while it is being made to work; these runs are not full runs). Then **one full run** on the branch: its link,
   duration per part, memory peaks against the runner's threshold, every failure with its trace, and for each failure
   whether it also fails locally on its own. No local full run. Stop for Łukasz's decision on any failure (fix in the
   test setup, a known limitation, or a finding about the app to take into 15d).
3. **The parts** (if needed), the docs, and **a second full run in a row** on the final commit, green. The pull
   request with the existing CI checks and this run's link. Merge only on Łukasz's command (no tag; chores are not
   tagged unless Łukasz asks).

## 5. Acceptance criteria

| ID | Criterion |
| --- | --- |
| CI-01 | **Triggers.** A `workflow_dispatch` run and the `full-e2e` label each start the full run; a push without the label starts none; a second run for the same ref cancels the first. |
| CI-02 | **The same tests.** The CI run runs every spec the local full run runs (the file lists compared, by `--list` per part), and none of the `MEASURE=1` specs; skipped tests are the same as locally. |
| CI-03 | **Green twice.** Two full runs in a row on the final commit pass with `retries: 0`. A failure on the way is reported with its trace and the memory at that moment, and Łukasz decides what happens to it; nothing is skipped or quarantined without his decision. |
| CI-04 | **Time and memory.** Each full run takes at most 30 minutes wall-clock (target 25); each part's duration and memory peak are reported; no part's peak comes within 20 % of the runner's restart threshold and no server prints the restart. |
| CI-05 | **What a run leaves.** One merged HTML report, the failures' traces, the server and memory logs per part, and the job summary of P5, downloadable for 14 days. |
| CI-06 | **The single-file check.** A `workflow_dispatch` run with `files` set to one spec and `repeat_each` 3 runs that spec three times on its own and reports each. |
| CI-07 | **Nothing else changed.** `git diff` outside `.github/`, `e2e/`, `scripts/`, `playwright.config.ts`, `tests/e2e-parts.test.ts` and the docs is empty; every difference inside them is named with its reason; every test's assertions are unchanged; the existing CI passes; the local `npm run e2e -- --list` (or the wrapper's dry run) lists the same files per part as before, or as the new parts say. |

## 6. Questions for step 1

**The rule (CLAUDE.md, "How we work"):** a PRD is a proposal to verify. Check every item and criterion against the code,
the e2e setup and GitHub; write where the PRD is wrong, misses something, or costs more than it assumes, with files and
a proposal. No change in step 1.

- **Q1. GitHub.** The repository's visibility and plan, the standard runner's cores and memory for it, the minutes
  included per month and what a full run would use (parts × duration, with Windows's multiplier if P1 B), and whether
  any setting (Actions permissions, labels) needs Łukasz.
- **Q2. Windows-only code.** Every line in `e2e/`, `scripts/` and `playwright.config.ts` that assumes Windows (process
  killing, paths, shells, line endings, case of file names, `npx` and `tsx` calls), and what makes each portable.
- **Q3. What the e2e run needs from the machine.** Environment variables (`.env.example`; does the dev server start
  without `.env.local`?), files in `.data/` the run expects, ports, anything that reads Łukasz's own files. No secret
  should be needed; if one is, say which and why.
- **Q4. The parts in CI.** How `scripts/e2e.ts` runs one part (its exit code, its blob report's path), whether a job can
  call it with `--part <n>` as is, how the merge job merges the blobs (Playwright's `merge-reports`), and how the part
  list reaches the matrix without being written twice.
- **Q5. Memory on the runner.** The heap limit and restart threshold that follow from the runner's memory (F1's rule),
  against the parts' peaks in the latest memory logs; whether the parts must change.
- **Q6. Timing on the runner.** Specs with fixed waits or tight timeouts that may fail on a machine of another speed
  (the sign-in's 15 s, the 120 s start limit, S0-10's 300 s); a proposal for each, without changing assertions.
- **Q7. Triggers, concurrency and permissions.** The label trigger (`pull_request` `labeled`, and what a later push to a
  labelled pull request does: proposal, nothing), `concurrency`, the token's permissions (read only), artifacts'
  retention.
- **Q8. The docs** to change (section 7) and anything in the existing CI workflow worth reusing (Node version, caches).

## 7. Docs in this PR

- **`CLAUDE.md`:** "Testing" and "Commands": the full run is the workflow's run (P6), how to start it (by hand, by the
  label, a single file with `repeat_each`), where its report and traces are, what a step's report quotes; the local run
  as the fallback.
- **`README.md`:** the commands table and the workflow.
- **`docs/known-limitations.md`:** what the chore settles (the load-driven slowdowns of local runs) and what it leaves.
- **`docs/ideas.md`:** this chore done in the plan; **and the entry in appendix A** (Łukasz, 6 November 2026), added as
  written.
- **`docs/prd/slice-15-infocube.md`:** the copy from Łukasz's Downloads (section 0, "Before 15d", and the 15d bullet),
  checked with `cmp` and SHA-256 as usual.

## 8. Left for later

- Production-build e2e runs (AD-31, the database slice).
- More than one worker within a part (one data file per worker).
- A full run on every push to a pull request.
- Performance measurement in CI: never (AD-24's reference machine is the laptop).

## 9. Assumptions

- **A1.** `main` is at tag `slice-15c`; slice 15c is merged.
- **A2.** The e2e run needs no secret and no network beyond GitHub, npm and Playwright's browser download (fonts are
  local since chore e2e reliability).
- **A3.** The repository is on GitHub with Actions enabled; the existing CI workflow runs on it.

## Appendix A – `docs/ideas.md`: the entry to add (Łukasz, 6 November 2026)

Add as a section of its own, after the InfoCube section:

> ## InfoMapper's canvas and menus: a slice after slice 15 (Łukasz, 6 November 2026)
>
> From Łukasz's testing of slice 15c, agreed as a slice of its own after slice 15's closing. All three are InfoMapper's,
> work at every model level, and need no new table.
>
> 1. **"Add attribute" in a card header's menu**, above "Link to a requirement…", as the entity panel's button: a new
>    attribute with its name selected for typing, one undo step; shown to those who may edit the model. The prototype
>    has it in the panel only.
> 2. **The canvas tabs' order from a tab's menu:** "Move left", "Move right", "Move to start", "Move to end", the items
>    that would not move the tab disabled. It changes `project_canvas.sort_order` in the current project only (a
>    canvas may be in several, D-28), one undo step each. Dragging tabs: later.
> 3. **Relationship lines shown or hidden by kind:** two switches, "Relationships between entities" (logical and
>    dimensional) and "Relationships between source tables" (D-62). They filter within the layer modes that show
>    relationships (Everything, Relationships); the modes stay as they are (D-22). Kept per canvas as keys in
>    `canvas.look` (not undone, as the layer is not); a hidden kind is a chip in the view-state bar (D-39), cleared by
>    its × or "Show all". The switch to the screen is measured on the dense canvas (lines in one SVG layer, AD-24). The
>    entry "Source relationships: a layer switch of their own" (slice 10b) is decided with this item in that slice's
>    step 1.
>
> The fourth observation of the same testing, the concept of a fact or a dimension, is decided in
> `docs/prd/slice-15-infocube.md`, section 0, "Before 15d".
