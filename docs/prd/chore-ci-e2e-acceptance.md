# Chore CI e2e – acceptance

PRD: `docs/prd/chore-ci-e2e.md`. Branch `chore/ci-e2e`.

## Step 1 – critical review (6 November 2026)

**A1 holds, with one note.** `origin/main` and tag `slice-15c` are the same commit (`d5e3b72`, PR 38's merge); the
local `main` was still at slice 15a's merge (`2bdeb10`) and was fast-forwarded to `origin/main` before the branch was
cut. The branch starts at `slice-15c`.

**The copies.** `chore-ci-e2e.md` → `docs/prd/chore-ci-e2e.md`: `cmp` identical, SHA-256 `df65537b…646da` as given.
`slice-15-infocube.md`: the Downloads file of that name is an older one (4 November, 32,210 bytes, SHA-256
`26aae0ab…8309a`, a diff of +49/−271 against the repository's); the file with the given SHA-256 `78065256…239db` is
`slice-15-infocube (1).md` (6 November, 57,884 bytes). That one was copied: `cmp` identical, SHA-256 as given; its diff
is +30/−4 in exactly the five places named (status paragraph, section 0 "Before 15d", item 13, the 15d bullet in section
4, D-70 in section 10). Both committed on their own (`b9fb58e`).

No code, workflow or test changed in this step; no e2e test ran. Read-only checks only: `gh repo view`, `gh api` for
the Actions settings and the last CI run's step times, one `node` one-liner that imports `e2e/parts.ts`.

### Summary

- **The repository is public** (Q1). Standard runners are then free and unlimited, with 4 vCPU, 16 GB RAM and 14 GB SSD
  (Linux and Windows alike). The PRD's "minutes used up" fallback and Windows's minute multiplier do not apply; the cost
  of a run is its wall-clock time, not minutes.
- **Four parts cannot meet 30 minutes** (Q4, Q5): part 4 alone is 34 to 36 min of tests on the laptop (212 tests,
  2,058 s in 15c's last part-4 run), and grows with every slice. Memory does not need more parts on the runner; time
  does. Proposal: seven parts, cut by time (P2).
- **Linux needs little** (Q2): S0-10's stop already has a non-Windows branch, the shells and `npx` calls are portable,
  `.gitattributes` fixes line ends, and import case is already checked by CI's typecheck on Linux. The one gap is the
  machine's memory log, written by a PowerShell script on Windows only.
- **What the PRD misses** (details below): the dev server's output is not kept anywhere today (P5's "server log");
  a `pull_request` run tests a merge commit, not the commit a report names (P6); dispatch and label runs on one branch
  have different refs, and the single-file check would cancel a full run (P3); the `files` input must not reach a shell
  as text; the runner's time zone is UTC, the laptop's Central European; CI-02 contradicts itself about the `MEASURE`
  specs.

### Q1. GitHub

- **Repository** `LukaszWolski-DA/infomapper-app`: **public** (`gh repo view`: `visibility: PUBLIC`). Actions are
  enabled, all actions allowed, SHA pinning not required (`actions/permissions`); the default token is **read-only**
  (`actions/permissions/workflow`: `default_workflow_permissions: read`). The existing workflows are `ci.yml` and
  `schema.yml`, both green on `main` today.
- **Runner** (GitHub's "GitHub-hosted runners" reference, read 6 November 2026): standard Linux x64 and Windows x64 for a
  public repository: **4 CPUs, 16 GB RAM, 14 GB SSD** (a private one: 2 CPUs, 8 GB). Use of standard runners is **free
  and unlimited on public repositories**. Free plan: 20 concurrent jobs, 6 h per job.
- **Speed against the laptop:** the last CI run's `npm test` took 17.9 s for 141 files on the runner; the laptop's last
  kept one (`.data/ci-test.log`) 22.7 s for 133 files: about 1.3× faster per file on the runner, a CPU-bound, parallel
  load. An e2e part is one worker, one browser and one dev server; I estimate **0.75 to 1.0×** the laptop's calm times
  (no paging on 16 GB). Step 2 measures it.
- **Minutes per full run** (estimate, billed per job rounded up; informative only, as they are free):
  - per part job, besides the tests: checkout and Node about 10 s, `npm ci` 50 s (the last CI run), Chromium with its
    system packages 60 to 90 s, the server's start and the global setup's warm-up 60 to 120 s: **about 4 min**;
  - tests: 5,690 s on the laptop (15c's step 3 for `fixes` to `slice-15b`, 5,500 s, plus `slice-15c` 188 s) × 0.75 to
    1.0 = **71 to 95 min**;
  - plan job under 1 min, merge job about 2 min.
  - **Four parts: 90 to 115 min; seven parts: 102 to 127 min.** Wall-clock with seven parts: the longest part (about
    980 s on the laptop) × 0.75 to 1.0 + 4 min + merge 2 min = **18 to 22 min**; with four parts **29 to 41 min**.
- **Windows (P1 B):** the same 4 CPUs and no minute cost here, but a Windows job starts slower (`npm ci` and the file
  system are slower, Defender scans `node_modules`), and the laptop's own runs show what Windows costs. No reason for it.
- **Needs Łukasz:** the label `full-e2e` does not exist (`gh label list`); creating it is a repository change (one
  `gh label create full-e2e` with his OK, or by hand). Nothing else: the read-only token is enough (Q7).
- **Artifact storage:** the limits page names 500 MB of artifact storage for the Free plan without saying whether it
  counts for public repositories. Failures' traces are the only large files (`trace: "retain-on-failure"`,
  `playwright.config.ts:52`); a green run leaves a few MB. Step 2 reads the repository's storage figure after its runs.
- **Public logs and artifacts:** a public repository's run logs are public and its artifacts downloadable by any signed-in
  GitHub user. What a run writes is the seed's demo data (fictional addresses such as `anna.nowak@infomate.pl`,
  `src/data/local/seed.ts:45-49`), no secret and nothing of Łukasz's. **One rule for the workflow:** upload named files
  only, never `.data/` as a whole, which holds the generated `.data/session-secret`
  (`src/data/local/session-secret.ts:13`).

### Q2. Windows-only code in `e2e/`, `scripts/` and `playwright.config.ts`

What the full run executes:

| Where | What | On Linux | Proposal |
| --- | --- | --- | --- |
| `e2e/slice-00/S0-10.spec.ts:28-33` | `spawn("npx", ["next", "dev", …], { shell: true, detached: process.platform !== "win32" })` | portable: `sh` starts `npx`, `detached` makes a process group | none |
| `S0-10.spec.ts:49-67` | `stopServer`: `taskkill /T /F` and `netstat -ano` on Windows; else `process.kill(-pid, "SIGTERM")` | the group gets SIGTERM; `next dev` ends its child on it. Untried: no run of S0-10 off Windows is recorded. Nothing frees the port if a process ignores SIGTERM (no `netstat` fallback) | none first; if step 2 shows a server left on 3201, a SIGKILL to the group after the 120 s stop wait (setup only, no assertion) |
| `S0-10.spec.ts:14-19` | two build folders because of Windows's late lock release | harmless | none |
| `e2e/slice-02c/S2C-11.spec.ts:26` | `spawnSync("npx", ["vitest", …], { shell: true })` | portable | none |
| `e2e/memory-reporter.ts:18-24` | the machine's memory: `powershell … scripts/e2e-memory-system.ps1`, only `win32` | **no machine log on Linux**; the server's own probe (`scripts/e2e-memory-probe.cjs`) works (its path tests take `[\\/]`) | a Linux branch in the reporter: `/proc/meminfo` (MemAvailable, SwapFree) every 5 s on an unref'd timer, in the same `.system.jsonl` fields the report reads (`availableMb`; the Windows-only ones absent). `scripts/e2e-memory-report.ts` already copes with missing fields |
| `e2e/memory-reporter.ts:41` → `scripts/measure-conditions.ts:17` | conditions only on Windows; else `{ platform }` | harmless | none |
| `scripts/e2e.ts:20-22` | Playwright's CLI through `process.execPath`, no shell | portable | none |
| `playwright.config.ts:23-25, 78` | `NODE_OPTIONS=--require=<path with />`; `cmd1 && cmd2 && npm run dev` | portable (`sh`) | none |

Not in the full run and left alone: `scripts/measure*.ts` (`shell: process.platform === "win32"`, PowerShell for
conditions), `scripts/e2e-memory-system.ps1`: measurement stays on the laptop (AD-24).

- **Paths:** the specs build paths with `path.join`/`path.resolve`; the reporter writes `/`.
- **Line ends:** `.gitattributes` is `* text=auto eol=lf`, the import samples `-text`: the same bytes on both systems.
- **Case of file names:** `tsconfig.json` includes `**/*.ts`, so CI's typecheck on Linux already resolves every import
  in `e2e/` case-sensitively. Files read at run time by name (the import samples through `sample()`) are not checked
  that way; a wrong case would fail in step 2 with "no such file" and is a one-word fix.
- **`npx`/`tsx`:** `npx tsx scripts/clean-e2e-build.ts` and `npm run …` run as on Windows.

### Q3. What the run needs from the machine

- **Environment:** none of `.env.example`'s variables is needed. `INFOMAPPER_DEV_DB`, `NEXT_DIST_DIR` and
  `INFOMAPPER_TEST_HOOKS` come from `playwright.config.ts:80`; without `INFOMAPPER_SESSION_SECRET` the server writes
  `.data/session-secret` once (`session-secret.ts:30`, with `mkdir`); `DATABASE_URL` is the schema check's only.
  The dev server starts without `.env.local`. **No secret is needed** (A2 holds).
- **`.data/`:** created on demand: `resetDevData` writes `.data/e2e-db.json` (`src/data/local/file.ts:229`, `mkdir`),
  S0-10 makes `.data/e2e-runs/`. The specs that read `.data/measure/…` baselines are all in `testIgnore`
  (`playwright.config.ts:35-41`). Nothing reads `.data/dev-db.json`, `.data/demo-db.json` or anything outside the checkout.
- **Ports:** 3200 (the e2e server; `E2E_PORT`) and 3201 (S0-10's own). Free on a fresh runner.
- **Network:** npm, Playwright's browser download and Ubuntu's package mirror (`--with-deps`); fonts are local (chore e2e
  reliability, P3 B). A2 holds.
- **`CI=true`** (GitHub sets it) changes three things in `playwright.config.ts`: `forbidOnly` (47, good),
  `retries: 1` (48, P4) and `reuseExistingServer: false` (81, good: a part never reuses a server).
- **Not named by the PRD – time zone.** The runner is UTC, the laptop Central European (`Get-TimeZone`: "Central European
  Standard Time"). The app formats dates and times in the process's zone (`src/app/_panels/import/system-imports.ts:23`,
  `src/canvas/note-data.ts:91`); server and browser share the zone on either machine, but a seeded time near midnight
  shows another day in UTC. Locales are fixed in code (`toLocaleString("en-GB")`) and Playwright's default locale is
  en-US on both. **Proposal:** `TZ: Europe/Warsaw` in the workflow's env (the zone Windows's "Central European Standard
  Time" maps to), so the runner sees what the laptop sees; not an app change.
- **Fonts' fallback glyphs.** IBM Plex is local; characters outside it (Σ, ƒ, ∅ and arrows, where used) fall back to the
  system's fonts, which differ on Ubuntu (Playwright's `--with-deps` installs Liberation, Noto and others). A spec that
  depends on a measured text width could differ. Not found by reading; a risk for step 2 to name if it appears.

### Q4. The parts in CI

- **One part today:** `npm run e2e -- --part <n>` (`scripts/e2e.ts:44-50`) runs `playwright test` with `E2E_PART=<n>`;
  its exit code is Playwright's. It writes a blob **only with `E2E_BLOB=1`** (`playwright.config.ts:21`), which only the
  full run sets (`scripts/e2e.ts:64`); otherwise the HTML report. So a job calls it as is with `E2E_BLOB=1` in its env;
  the blob lands in `blob-report/part-<n>.zip`, the traces in `test-results/part-<n>/`. The port check of the full run
  (`scripts/e2e.ts:54`) does not run for `--part`; on a fresh runner it is not needed.
- **Memory log per part:** with `E2E_MEMORY_LOG=1` and no `E2E_MEMORY_FILE`, the config names the file by the minute
  (`playwright.config.ts:12-15`), without the part. The job sets `E2E_MEMORY_FILE=.data/e2e-memory-ci-part<n>` itself,
  as `scripts/e2e.ts:65` does locally.
- **The merge:** one job `needs` all parts with `if: always()`, `npm ci` (Playwright 1.63.0 from the lock file; the
  blobs must come from the same version), downloads every `blob-part-*` artifact into `blob-report/`
  (`actions/download-artifact@v4`, `merge-multiple: true`) and runs `npx playwright merge-reports --reporter=html,json
  blob-report` (the JSON for the summary). Blobs carry their attachments, so the merged HTML report holds the traces.
- **One list of parts:** a `plan` job reads `e2e/parts.ts` with plain Node and writes the matrix to `$GITHUB_OUTPUT`;
  no `npm ci` is needed, since `parts.ts` imports only `node:fs` and `node:path`. Tried today with Node 22.20:
  `node --no-warnings --input-type=module -e "const p = await import('./e2e/parts.ts'); …"` prints `[1,2,3,4]` and part
  4's folders (Node 22.18 and later strip types by default; `.nvmrc` is `22`, so `setup-node` takes the newest 22.x). The
  matrix is `fromJSON(needs.plan.outputs.parts)`. The list is then written once (`PART_STARTS`), as the PRD wants.
- **CI-07's local list:** `npm run e2e -- --list` is not per part: with any argument the wrapper runs one plain
  `playwright test --list` over all folders (`scripts/e2e.ts:50`). Per part it is `npm run e2e -- --part <n> --list`.
  CI-02's comparison uses that, on both sides.

### Q5. Memory on the runner

- **The rule (F1, Next.js 16.3.8, unchanged since):** `next dev` sets `--max-old-space-size` to 50 % of `os.totalmem()`
  unless `NODE_OPTIONS` has one, and restarts its child above 80 % of the heap limit after a request.
- **On the runner (16 GB):** a heap limit of about 8 GB, the restart at about **6.5 GB** of used heap; CI-04's margin
  (20 % below) is about 5.2 GB. On a private repository's 8 GB it would be the laptop's 4,069 / 3,255 MB.
- **The parts' peaks:** the newest memory logs are slice 14b's closing run (`.data/e2e-memory-20261103-2011-part<n>.*`):
  1,247 / 1,331 / 1,253 / 1,419 MB (`docs/prd/slice-14b-acceptance.md`, "The full e2e run"). No log since; part 4 grew
  from 172 to 212 tests (15a to 15c), about 6 MB a test: **about 1.7 GB estimated** for today's part 4. That is about
  a quarter of the runner's threshold. **Memory needs no change of the parts**; seven parts (P2) lower it further.
- **Two servers at once:** S0-10 runs its own dev server beside the shared one for about a minute; each would get its own
  8 GB limit, far from 16 GB in practice (each under 2 GB resident in the laptop's logs).
- **Missing to check CI-04's "no server prints the restart":** the dev server's output is not kept. The `webServer`
  has no `stdout` option (`playwright.config.ts:74-83`); Playwright's default for it is `"ignore"`, only stderr reaches
  the console. Proposal: `stdout: "pipe"` for the dev server (its lines then appear prefixed `[WebServer]` in the
  part's output), the job's output kept with `tee` into `e2e-part-<n>.log` and uploaded; Next.js's trace file
  `.next-e2e/dev/trace` (where the restart's event is written, F1) uploaded too. Locally the run then prints the
  server's lines as well (more output, no behaviour change); if that is unwanted, only when `CI` is set.

### Q6. Timing on the runner

- **Sign-in:** `signInAs` (`e2e/slice-00/helpers.ts:13-17`) has no own limit; the bar's visibility uses `expect`'s 15 s
  (`playwright.config.ts:43`). The laptop's timeouts were whole-server slow episodes under paging (chore e2e
  reliability F3); a 16 GB runner does not page. Proposal: **no change**.
- **The server's start (120 s, `playwright.config.ts:82`):** it covers the clean, the reseed, `next dev`'s start and the
  first compile of `/sign-in`. On the laptop that is about 10 to 20 s plus the compile. Proposal: **no change**; step 2
  reports the start time of each part, and raises it only if a part comes within half of it.
- **The global setup** (`e2e/global-setup.ts:16`, 120 s per step) and **S0-10** (300 s per start, 900 s in all,
  `S0-10.spec.ts:88, 117`): generous; no change.
- **Fixed waits:** 186 `waitForTimeout` calls in 85 spec files. They wait out debounces and settling on a known
  machine; a faster machine only makes them more ample, and the runner is not expected to be slower. No change; a
  failure in step 2 that lines up with one is reported with its trace (CI-03).
- **Timed assertions:** the speed bars (`S1A-14.spec.ts:223`, `S1B-10.spec.ts:151`, `S2A-14.spec.ts:176`,
  `S4P-fading.spec.ts:280`) apply only with `MEASURE=1`, which CI never sets.
- **Job timeouts:** `timeout-minutes: 45` per part job (twice the expected part), 10 for the merge.

### Q7. Triggers, concurrency, permissions

- **Triggers:** `workflow_dispatch` (inputs `files`, default empty, and `repeat_each`, default 1) and
  `pull_request: types: [labeled]` with `if: github.event.label.name == 'full-e2e'`. A later push to a labelled pull
  request sends `synchronize`, which is not listed: **nothing runs** (the PRD's proposal; a new run is a dispatch, or the
  label removed and added again).
- **Not in the PRD – which commit a label run tests.** A `pull_request` run checks out `refs/pull/<n>/merge`, a merge
  of the branch into `main` that GitHub makes, whose SHA is not a commit on the branch. P6 says a run counts only for the
  commit it ran on. **Proposal:** check out `github.event.pull_request.head.sha` for label runs, so the run's commit is
  the branch's head, the one a report names (a branch from `main`'s tip merges to the same tree anyway).
- **Not in the PRD – concurrency.** `github.ref` differs between a dispatch on a branch (`refs/heads/<branch>`) and a
  label run (`refs/pull/<n>/merge`), so "the same ref" would let both run. And a single-file check (CI-06) dispatched
  while a full run is on its way would cancel the full run. **Proposal:** `group: e2e-${{ github.head_ref || github.ref_name }}-${{ inputs.files && 'files' || 'full' }}`,
  `cancel-in-progress: true`: a new full run cancels the branch's full run, a check cancels only an earlier check.
- **Not in the PRD – the `files` input as text.** `${{ inputs.files }}` written into a `run:` script is pasted into the
  shell. Only people with write access can dispatch, but the input still goes through an env var
  (`env: FILES: ${{ inputs.files }}`), split on spaces into arguments, each checked to start with `e2e/`, and
  `repeat_each` as a number (`type: number`), passed as `--repeat-each=<n>`.
- **`repeat_each` against CLAUDE.md's rule.** `--repeat-each=3` runs the spec three times in one Playwright run, on one
  server warmed by the first round; CLAUDE.md's "three times on its own" locally was three separate runs. With the
  reseed before every test (the fixtures) the difference is the warm server only. Proposal: accept it and say so in
  CLAUDE.md.
- **Permissions:** `permissions: contents: read` at the top (also the repository's default). `upload-artifact` and
  `download-artifact` v4 use the runner's own token; the job summary needs no permission.
- **Retention:** `retention-days: 14` on every upload.

### Q8. The docs, and what to reuse from the existing CI

- **Reuse from `ci.yml`:** `ubuntu-latest`, `actions/checkout@v4`, `actions/setup-node@v4` with `node-version-file:
  .nvmrc` and `cache: npm`, `npm ci`, the `concurrency` pattern, `timeout-minutes`. Playwright's browsers: `npx
  playwright install --with-deps chromium` (about 1 to 1.5 min); a cache of `~/.cache/ms-playwright` keyed on the lock
  file's Playwright version saves the download (about 30 s) but not the system packages; proposal: no cache first,
  added in step 3 only if step 2's times show it worth it.
- **Docs (section 7) as the PRD lists them,** plus:
  - CLAUDE.md "The full run in four parts": the part count and cuts (P2), the per-part peaks and times from the runner,
    the server's log and `TZ`;
  - CLAUDE.md "Testing": `repeat_each` as the single-file check (Q7), the run's link and commit in reports (P6), the
    label, and that the head commit is what a label run tests;
  - `tests/e2e-parts.test.ts` if the parts change (P2);
  - `docs/known-limitations.md`: the laptop's load-driven slowdowns as settled for full runs; what stays (local runs,
    the measurement specs, the machine log only from `/proc/meminfo` on Linux).
  - Appendix A into `docs/ideas.md` in step 3, as the PRD says.

### Proposals

- **P1 – A (Linux, `ubuntu-latest`).** Free like Windows here, faster to start, and almost portable already (Q2). The
  changes: the machine's memory log on Linux (`e2e/memory-reporter.ts`), and S0-10's SIGKILL fallback only if step 2
  needs it. `TZ: Europe/Warsaw` in the workflow (Q3).
- **P2 – one job per part, and seven parts.** Four cannot meet 30 minutes (part 4 is 34 to 36 min of tests on the
  laptop and grows). Cuts by 15c's folder times (seconds on the laptop):

  | Part | Folders | Tests' time |
  | --- | --- | ---: |
  | 1 | fixes to slice-02a | 909 |
  | 2 | slice-02b to slice-03b | 854 |
  | 3 | slice-04a to slice-06b | 982 |
  | 4 | slice-07a to slice-07c | 754 |
  | 5 | slice-08 to slice-10b | 766 |
  | 6 | slice-10c to slice-13 | 610 |
  | 7 | slice-14a to slice-15c | 812 |

  `PART_STARTS = ["slice-02b", "slice-04a", "slice-07a", "slice-08", "slice-10c", "slice-14a"]`; part 7 is the
  lightest-but-one, as new slices fall into it (15d's specs). **Cost locally:** three more server starts and warm-ups,
  about 1.5 min each: about +4.5 min (5 %) on a local fallback run, and each part's heap lower still. **Order:** step 2's
  first full run keeps today's four parts, so the runner's own per-folder times give the cuts; step 3 sets them (the
  table above is the starting proposal), with `tests/e2e-parts.test.ts`. Plan job from `e2e/parts.ts` (Q4).
- **P3 – as the PRD,** with the concurrency group of Q7, the head commit for label runs, and the label created with
  Łukasz's OK.
- **P4 – `retries: 0` in `playwright.config.ts` outright** (line 48: CI's 1 was never used, since no e2e ran in CI);
  `files` and `repeat_each` as in Q7, through env vars.
- **P5 – as the PRD, plus what it needs:** the server's output (`stdout: "pipe"`, the job log through `tee`, Next.js's
  trace file), the memory file named per part, the machine's memory on Linux, a small summary script in `scripts/`
  (reads the merged JSON report and the parts' memory logs: counts, each part's duration and heap peak against the
  threshold, the failed tests with files) into `$GITHUB_STEP_SUMMARY`. Upload named files only, never `.data/`.
- **P6 – as the PRD,** "the commit it ran on" being the branch's head commit for label runs too (Q7). The local run as
  the fallback; with a public repository "minutes used up" does not arise, so the fallback is GitHub down or a run that
  must not wait.
- **Minutes per full run:** about 90 to 115 with four parts, 102 to 127 with seven; free on this public repository.
  Wall-clock 18 to 22 min with seven parts, 29 to 41 with four (Q1).

### Differences from the PRD

| PRD | Finding |
| --- | --- |
| P1 B "at a higher cost in minutes"; P6 "minutes used up"; Q1 "minutes included per month" | Public repository: standard runners free and unlimited, Windows too (Q1). |
| P2 target 25 to 30 min with the parts "moved only if needed" (item 4) | Not reachable with four parts; seven proposed (P2). |
| P5 "the dev server's log" | Not kept today: the `webServer`'s stdout is ignored by default (Q5). |
| P5 "the memory log" | On Linux only the server's half; the machine's half is Windows-only (Q2). |
| P3 "a new run for the same ref cancels" | Dispatch and label runs have different refs; a single-file check would cancel a full run (Q7). |
| P6 "the commit it ran on" | A `pull_request` run tests a merge commit unless the head is checked out (Q7). |
| P4 `files` input | Must reach the command as arguments from an env var, not as script text (Q7). |
| P4 "run three times on its own" | `--repeat-each` repeats within one run on a warm server (Q7). |
| CI-02 "every spec the local full run runs, and none of the `MEASURE=1` specs" | Contradictory: S1A-14, S1B-09, S1B-10 and S2A-14 run in the local full run without `MEASURE` (their speed bars apply only with it). Proposal: "the same specs per part as the local run's `--part <n> --list`; `MEASURE` is never set". |
| CI-07 "`npm run e2e -- --list`" per part | Lists all folders as one run; per part it is `--part <n> --list` (Q4). |
| Section 9, A1 "`main` is at tag `slice-15c`" | `origin/main` was; the local `main` lagged and was fast-forwarded. |
| Not named | The runner's time zone (UTC; proposal `TZ`, Q3); fonts' fallback glyphs (a risk, Q3); `E2E_BLOB=1` and a per-part memory file name in the job's env (Q4); the `full-e2e` label must be created (Q1); `.data/session-secret` must not be uploaded (Q1). |

### Questions for Łukasz

1. **P2:** seven parts by time (the table), set in step 3 from the runner's own times after step 2's four-part run?
2. **The server's output locally:** `stdout: "pipe"` everywhere (the local run prints the server's lines too) or only on
   CI?
3. **The label:** may I create `full-e2e` with `gh label create` in step 2?
4. **`TZ: Europe/Warsaw`** in the workflow, so the runner reads times as the laptop does?
5. **`repeat_each` as the single-file check** (one run, a warm server after the first round) in place of three
   separate runs, also in CLAUDE.md's wording?

### Łukasz's answers to step 1 (6 November 2026)

1. **Seven parts**, cut from the laptop's folder times now (the table in P2), in step 2 already. One list of parts for CI
   and the local run. Step 3 corrects the cuts from the runner's own folder times only if a part is clearly longer than
   the rest.
2. **The dev server's output goes to a file in both places** (`test-results/part-<n>/server.log`), not to the console.
   In CI it is part of the part's artifacts; CI-04's "no restart printed" is read from it.
3. **Yes**, create the label `full-e2e` in step 2.
4. **Yes**, `TZ: Europe/Warsaw` in the workflow. One sentence in `docs/known-limitations.md`: the e2e run has not been
   run in another time zone.
5. **The single-file check is not `repeat_each`:** a `workflow_dispatch` input `rounds` (default 3) starts that many jobs
   in parallel, each with its own fresh dev server, each running the `files` once. Say how the local "three times on its
   own" is done today; if it differs, propose whether CLAUDE.md should describe both.

On the findings:

- Label runs check out `github.event.pull_request.head.sha`, so a run's commit is the branch's head commit, the one the
  report names (P6).
- Concurrency: full runs (dispatch without `files`, or the label) share one group per branch name (`head_ref` for a pull
  request, `ref_name` for a dispatch), `cancel-in-progress: true`. A single-file check gets a group of its own per run
  (with `run_id`) and neither cancels nor is cancelled.
- The `files` input reaches the script only through an environment variable, validated against a pattern (paths under
  `e2e/`, no other characters a path does not need); anything else fails the job before a server starts.
- CI-02 becomes: CI runs exactly the local full run's list per part, including S1A-14, S1B-09, S1B-10 and S2A-14; the
  `MEASURE=1`-only specs are skipped as locally. If any of those four asserts a duration, name it as a risk on the
  runner.
- Add a per-part list to the wrapper (`npm run e2e -- --list` prints the files of each part, with `--part <n>` one
  part), with `tests/e2e-parts.test.ts` covering it.
- The memory log's machine half on Linux: propose the smallest portable way (`os.freemem()` or `/proc/meminfo`), keep
  Windows's as it is.
- Remove the PRD's "minutes used up" and Windows's multiplier from P1 and P6 (the repository is public); the local run
  stays the fallback when GitHub is down.

Recorded in the PRD as its section 0, "Answers to step 1".

**Answer 5, the local "three times on its own" today.** `npm run e2e -- <file>` three times one after another: each run
is its own `playwright test`, whose `webServer` cleans `.next-e2e`, reseeds and starts a fresh dev server (nothing
listens on 3200 between them, so `reuseExistingServer` reuses nothing), and stops it at the end (the acceptance docs'
"3 of 3 on its own", e.g. `docs/prd/slice-15-acceptance.md`, S13-12 in 15b). The CI check is the same in what matters,
a fresh server and a fresh seed per round; it differs in running the rounds side by side on three machines rather than
one after another on one. **Proposal:** CLAUDE.md describes both, the CI check (`rounds` 3) as the rule and the local
loop as the fallback, with one line on the difference.

**On the four specs (CI-02):** none of S1A-14, S1B-09, S1B-10 and S2A-14 asserts a duration without `MEASURE`: every
speed bar is inside `if (MEASURE)` (`S1A-14.spec.ts:218-224`, `S1B-09.spec.ts:116`, `S1B-10.spec.ts:149-156`,
`S2A-14.spec.ts:100, 176`). What remains on the runner is their test timeouts (S1A-14: 240 s, S1B-10: 180 s).

## Step 2 – the workflow and one full run
