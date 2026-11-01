# Chore – Reliable full e2e runs (memory, fonts, sign-in)

Status: **step 1 answered (1 November 2026); step 2 in progress.** Branch `chore/e2e-reliability`, from `main` at tag `slice-12b` (assumption A1). PRD file: `docs/prd/chore-e2e-reliability.md`; step 1 writes `docs/prd/chore-e2e-reliability-acceptance.md`. A chore: no change to the application's behaviour, the data model or the local data file. Step 1 checks this PRD against the code and the e2e setup (CLAUDE.md, "How we work").

This PRD was written from `docs/known-limitations.md` and `docs/ideas.md` at slice 12b's state, without reading the code or the e2e configuration.

## 1. Why this chore

A full e2e run takes about 1 h 30 min (about 495 tests). The last closings each needed reruns of failing files that passed 3 of 3 on their own:

- **The dev server restarts at its memory threshold** ("⚠ Server is approaching the used memory threshold, restarting..."): S12A-02 in slice 12a's closing; S11-06 and S12A-04 in slice 12b's closing. The test running at that moment fails, and any test may be that one.
- **The server did not start within 120 s** in slice 12b's closing, because `next/font/google` did not answer (`.data/s12b-close-e2e-start-failed.log`). A minute later the fonts answered in 0.23 s.
- **The development sign-in times out** (the top bar does not show within 15 s in `signInAs`): slice 7b, slice 10a (two), slice 12a (S9-08, S10C-02), slice 12b (S7C-02, S10A-08). It is the most frequent flake, it runs before any slice's code, and it may go with the server's memory growth (`docs/ideas.md`, "Sign-in timeouts in full e2e runs").

Slice 13 changes how every field saves, on every page, so it needs full runs whose failures mean something. This chore makes them reliable first.

**Agreed with Łukasz on 1 November 2026:** the chore comes before slice 13; it changes the tests' setup only.

**Proposed, to confirm in step 1:**

- **P1. Measure the memory first.** Log the e2e dev server's memory (resident and heap, if available) at a fixed interval through one full run, with the time each spec file starts, so the restart's threshold and the growth per spec are known before choosing a remedy.
- **P2. Remedy for the restart, by the figures:**
  - **A (proposed):** a larger heap for the e2e dev server only (Node's `--max-old-space-size` in the web server's environment), sized from P1's peak with a margin, if Next.js derives its restart threshold from the heap limit (Q1);
  - **B:** split the full run in two parts, each with its own fresh server (`npm run e2e` runs both and reports one result);
  - **C:** both, if A alone does not hold through two full runs.
- **P3. Fonts.** **A (proposed):** a longer start-up limit for the e2e web server (for example 300 s) and a note in the log when the font download is the cause; **B:** fonts hosted in the repository (`next/font/local`), which removes the network from every build but changes how the app ships its fonts (license, files, CI). Step 1 says which fonts, their license, and what B costs.
- **P4. Sign-in.** Step 1 finds out, from the kept traces and P1's log, whether the sign-in timeouts happen when the memory is high. **A:** if they do, P2 is the remedy and nothing else changes; **B:** if not, a sign-in for tests that sets the session cookie directly, as the domain helpers write test data, used by `signInAs` everywhere except the specs that test the sign-in itself (S0-01 and the like). B is built only with Łukasz's approval after step 1.

## 2. Sources

- **Known limitations:** "The e2e dev server restarts itself at its memory threshold" (slices 12a, 12b); the e2e server's start-up and `next/font/google` (slice 12b); "e2e dev servers run without Turbopack's file-system cache"; "S7A-04-route's development sign-in timed out once"; the flakes of slices 10b, 10c and 11 (error texts kept since).
- **Ideas:** "Sign-in timeouts in full e2e runs"; the chore before slice 13.
- **CLAUDE.md:** "Testing" (full runs, small slices, a failing test run three times on its own), `npm run e2e` (port 3200, `.data/e2e-db.json` reseeded before every test, `.next-e2e` started empty), the global setup that warms the server up, "never run `npm run e2e` while your own dev server runs".
- **Kept traces:** `.data/e2e-failures/12a-close-1/`, `.data/e2e-failures/12b-close-1/`, `.data/e2e-11-close/`.
- **AD-31:** the database slice moves e2e runs to a production build, which ends the dev server's restarts; this chore does not wait for it.

## 3. What to build

1. **A memory log** (P1): a small script or a part of the global setup that samples the e2e dev server's process memory every 5 s into `.data/e2e-memory-<date-time>.log` with the spec file running at the time, on by an environment variable (`E2E_MEMORY_LOG=1`), off in normal runs. It must not slow a run down measurably.
2. **The remedy for the restart** (P2), as Łukasz decides after step 2.
3. **The start-up limit or local fonts** (P3), as Łukasz decides after step 1.
4. **The sign-in** (P4): nothing, or the test sign-in, as Łukasz decides after step 2.
5. **The docs:** the known limitations and ideas the chore closes or changes; CLAUDE.md's "Testing" and commands.

**Unchanged:** the application's code and behaviour, the seed, the tests' assertions, `npm run dev`, Łukasz's KB model (`.data/dev-db.json`).

## 4. Steps

Stop after each step with a short summary and wait for Łukasz.

1. **Critical review** (section 6). Answer Q1–Q6 in `docs/prd/chore-e2e-reliability-acceptance.md`, with a proposal for P2, P3 and P4. No change yet. Stop.
2. **The memory log and one measured full run** on `main`'s code (item 1 only): the run's time, its failures (traces kept before any rerun), the memory curve, where the threshold was or would be, and whether each failure lines up with high memory or a restart. Stop for Łukasz's decision on P2 and P4.
3. **The remedies** (items 2–4) as decided. CI. Stop.
4. **Two full runs in a row**, with the memory log on, plus CI: the time of each, every failure with its trace, and the memory peak against the new threshold. Then the docs (item 5), the pull request with both GitHub checks, and a stop. Merge only on Łukasz's command (no tag; chores are not tagged unless Łukasz asks).

## 5. Acceptance criteria

| ID | Criterion |
| --- | --- |
| CE-01 | **No restart.** In two full runs in a row the e2e dev server never prints the memory-threshold restart, and the memory log's peak stays at least 20 % below the threshold that applies. |
| CE-02 | **Start-up.** The e2e server starts within its limit; with P3 A, a slow font download no longer fails the start (checked by delaying the font host in a one-off run, if step 1 finds a cheap way to do it); with P3 B, no build fetches fonts from the network. |
| CE-03 | **Sign-in.** In the two runs no test fails at the sign-in; if one does, its trace and the memory at that moment are reported, and Łukasz decides whether P4 B is needed. |
| CE-04 | **Nothing else changed.** The application's code is unchanged (`git diff` outside `e2e/`, `playwright.config.*`, `scripts/` and the docs is empty, or each difference explained: P3 B and P4 B touch the app); every test's assertions are unchanged; CI passes. |
| CE-05 | **The runs' cost.** Each full run's time is reported; with P2 B, the two parts' times and the total. A run is not slower than slice 12b's closing (1 h 30 min) by more than 10 %, or the reason is stated. |

## 6. Questions for step 1

**The rule (CLAUDE.md, "How we work"):** a PRD is a proposal to verify. Check every item and criterion against the code and the e2e setup; write where the PRD is wrong, misses something, or costs more than it assumes, with files and a proposal. No change in step 1.

- **Q1. The restart's threshold.** How Next.js 16's dev server decides it is "approaching the used memory threshold" (its source or docs: what it measures, against which limit, whether `--max-old-space-size` or a Next.js setting moves it), and the Next.js version the app uses.
- **Q2. The e2e web server today.** `playwright.config.*`'s `webServer` (command, environment, timeout, port), the global setup, `scripts/clean-e2e-build.ts`, the specs that start their own servers (S0-10, S7C-02 and others), and where a memory log and a heap setting would go for each.
- **Q3. Splitting the run.** Whether `npm run e2e` can run two parts with fresh servers and one combined report, how the parts would be chosen (by folder, balanced by time), and what it costs per run (the warm-up twice).
- **Q4. Fonts.** Which fonts the app loads through `next/font/google`, their license, how the dev server behaves when the font host is slow or down (retries, fallback, error), and what hosting them in the repository changes for builds, CI and the measurement build.
- **Q5. The sign-in.** `signInAs` and the development sign-in's path (the POST, the redirect, the workspace page), what the kept traces show, and what a test sign-in that sets the session cookie directly would need (the session's format, the proxy's checks, which specs must keep the real sign-in).
- **Q6. The docs** to update, and anything in the kept traces that points to a cause the PRD does not name.

## 7. Left for later

- **Production-build e2e runs** (AD-31, the database slice).
- **Parallel workers** for the e2e run (today one data file and one server).
- **The other recorded flakes** (S4B2-06, S10C-13, S11-10, "The destination stream closed early"), unless step 2 ties them to the memory.
