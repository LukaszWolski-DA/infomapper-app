# Chore e2e reliability – acceptance

Status: **step 1 answered by Łukasz (1 November 2026); step 2 (the memory log and one measured full run) in progress.**

- Branch `chore/e2e-reliability`, made on 1 November 2026 from `main` at the tag `slice-12b` (annotated tag object
  `71ecd5383bcb1a26b7dc2c9dd01287ca3b325031`), whose commit is the merge of pull request 31,
  `b49ede24f6f9575ce330a291ac5381932d5be472` (the start commit); `origin/main` is at the same commit.
- The PRD is copied unchanged from `~/Downloads/chore-e2e-reliability.md` (9,464 bytes, identical byte for byte: `cmp`
  and SHA-256 `b39189b5b98889df67cd7f2775dafaf0dfe2923c8f025717e36c149765af3288`).
- Step 1 changed no code, configuration or script, ran no e2e test and did not touch `.data/dev-db.json`. The kept
  traces were unpacked into a scratch folder outside the repository and read there.

## Step 1 – critical review

Sources read: the PRD; `docs/known-limitations.md`, "End-to-end tests"; `docs/ideas.md`, "Sign-in timeouts in full e2e
runs" and "A chore before slice 13"; `playwright.config.ts`, `e2e/config.ts`, `e2e/global-setup.ts`,
`scripts/clean-e2e-build.ts`, `e2e/slice-00/helpers.ts`, `S0-10.spec.ts`, `S7C-02.spec.ts`; the sign-in's code
(`src/app/sign-in/page.tsx`, `src/app/_actions/session.ts`, `src/app/_lib/session.ts`, `dev-session.ts`,
`src/data/local/session-secret.ts`, `src/proxy.ts`, `src/app/page.tsx`); `src/app/layout.tsx`; Next.js 16.3.8's own
source in `node_modules/next/dist` and its bundled docs (`node_modules/next/dist/docs`); the kept logs and traces in
`.data/e2e-failures/12a-close-1/`, `.data/e2e-failures/12b-close-1/`, `.data/e2e-11-close/` and
`.data/s12b-close-e2e-start-failed.log`.

### Summary

1. **The restart's threshold is 80 % of the dev server's V8 heap limit, and that limit is already half the laptop's
   memory** (Q1). The laptop has 8 GB (8,042 MB); `next dev` gives its server process `--max-old-space-size=4021`
   (a heap limit of 4,069 MB), so the restart comes at about 3,255 MB of used JavaScript heap. P2 A ("a larger heap")
   would let one process on an 8 GB machine use more than 4 GB of heap, besides Turbopack's native memory, Chromium
   and the rest. It moves the restart, but it may well make the machine page (F2).
2. **Every flake of the last three closings came late in the run** (F3): 9 failures in three closings, all after 60 %
   of the run's time, none in the first 60 %. The sign-in timeouts are not slow sign-ins: in every kept trace the
   *whole server* answered slowly for a while (simple GETs of 4 to 17 s that normally take 0.1 to 0.2 s), and the
   sign-in's 15 s wait is simply the longest chain of requests under one `expect`. A test sign-in (P4 B) would move
   the wait, not remove the cause.
3. **The memory restart happened in slice 11's closing too** (F4): S11-10's failure, filed as "cause unknown", came
   right after the restart line. The restart is the third in three closings and comes earlier as the suite grows
   (at 99.6 %, 98 % and 94 % of the tests).
4. **The font failure in slice 12b's closing was not a network timeout in the log** (F6): the log has no download error
   at all; it repeats one Turbopack error ("next/font/google queries have exactly one entry") 6,840 times for 120 s.
   A longer start limit (P3 A) would probably only have waited longer.
5. **The PRD's Q2 names S7C-02 as a spec with its own server; it has none** (F8): only S0-10 starts its own dev
   server. The known limitation that says so is wrong too.

### F1. Q1 – how Next.js decides to restart (Next.js 16.3.8)

Next.js version: `16.3.8` (`node_modules/next/package.json`; `@next/swc-win32-x64-msvc` 16.3.8). Node `v22.20.0`. The
bundled docs (`node_modules/next/dist/docs`) do not describe the restart; everything below is from the source.

- **What starts what.** `next dev` (`next/dist/cli/next-dev.js`, `startServer`) forks a child process,
  `next/dist/server/lib/start-server.js`, with `__NEXT_DEV_SERVER=1`. The child serves the requests and holds
  Turbopack (a native module in the same process). The parent only restarts the child.
- **The heap limit.** In the parent (`next-dev.js`, around line 275): if `NODE_OPTIONS` has no `--max-old-space-size`
  and `NEXT_DISABLE_MEM_OVERRIDE` is not set, it sets `max-old-space-size` to **50 % of the machine's total memory**
  (`os.totalmem()`), and passes `NODE_OPTIONS` to the child. A `--max-old-space-size` in `NODE_OPTIONS` is kept as
  given (`getMaxOldSpaceSize`, `server/lib/utils.js` line 283).
- **The check.** After **every request** (`start-server.js`, `requestListener`'s `finally`, line 232),
  `getMemoryRestartStats` (`utils.js` line 265) reads `v8.getHeapStatistics()` and restarts when
  `used_heap_size > 0.8 × heap_size_limit`: it prints the warning, writes a trace event
  `server-restart-close-to-memory-threshold` (with `memory.heapSizeLimit` and `memory.heapUsed`, into the build
  folder's `trace` file) and exits with code 77; the parent starts a new child on the same port.
- **What it measures.** Only the V8 heap of the server process (JavaScript objects: compiled server modules, React's
  rendering, caches). Turbopack's own memory is native and is not counted, though it is in the same process's
  resident memory.
- **What moves it.** `--max-old-space-size` in `NODE_OPTIONS` (the threshold stays 80 % of the resulting limit);
  `NEXT_DISABLE_MEM_OVERRIDE=1` (then Node's own default limit applies); `experimental.devMemoryThresholdRestart: false`
  in `next.config` (`server/lib/router-server.js` line 192; no restart at all: the process would then run into the heap
  limit and crash, which is worse, and it is an app configuration change).
- **This laptop.** Total memory 8,042 MB → `max-old-space-size=4021` → heap limit 4,069 MB → threshold about
  **3,255 MB** of used heap (checked with `node --max-old-space-size=4021`). Free physical memory while nothing of
  the app ran: about 1.3 to 1.6 GB; Windows' "Memory Compression" held 1 GB.

### F2. P2 A costs more than the PRD assumes

The default heap limit is already half the RAM. Raising it (say to 6 GB) on an 8 GB laptop lets the server's heap grow
past what the machine can hold in memory together with Turbopack's native memory, Chromium, Playwright, Defender and the
desktop. The likely result is paging, and paging is what the slow episodes in the traces look like (F3). The restart
is, in effect, the only thing that frees the server's memory during a run. Raising the limit is safe only if P1 shows
the heap's real peak far below what the machine can hold; on this laptop that is unlikely.

### F3. The sign-in timeouts are whole-server slow episodes, late in the run

Positions of the failures (`ok`/`x` lines of the kept logs; time = sum of test durations up to the failure):

| Closing | Test | Where | Kind |
| --- | --- | --- | --- |
| 11 (474 tests, 1.4 h) | S7C-02 | test 312 (66 %) | sign-in (in `openColumn`) |
| 11 | S11-10 | test 472 (99.6 %) | the memory restart (F4) |
| 12a (486 tests, 4,680 s) | S9-08 | test 377, 3,814 s (81 %) | sign-in (`newSession`) |
| 12a | S10C-02 | test 446, 4,365 s (93 %) | sign-in |
| 12a | S12A-02 | test 476, 4,585 s (98 %) | the memory restart |
| 12b (497 tests, 5,182 s) | S7C-02 | test 313, 3,585 s (69 %) | sign-in (in `openColumn`) |
| 12b | S10A-08 | test 415, 4,526 s (87 %) | sign-in |
| 12b | S11-06 | test 467, 4,950 s (96 %) | the memory restart (`ERR_CONNECTION_REFUSED`) |
| 12b | S12A-04 | test 479, 5,045 s (97 %) | after the restart (compiling again) |

(Slice 11's first failure, `panel-field-focus`, was a real bug fixed in that slice and is left out.)

**What the traces show** (the network of each failing test, read from `trace.zip`):

- **S9-08 (12a):** the second session's `GET /sign-in` took 4,482 ms, the sign-in's `POST` 5,864 ms, the two `GET
  /w/…?_rsc=` 6,256 and 4,025 ms; the 15 s ran out before the workspace page was drawn. Just before, in the same test,
  a project home took 1,434 ms and a server action 8,117 ms. In the earlier tests of the same trace the same requests
  took 130 to 513 ms.
- **S10C-02 (12a):** `GET /sign-in` 4,478 ms, `POST` 5,092 ms, one `_rsc` request 9,677 ms and the other never answered.
- **S10A-08 (12b):** `GET /sign-in` 4,612 ms, `POST` 3,360 ms, `_rsc` 3,751 and 4,639 ms.
- **S7C-02 (12b):** a canvas page 8,268 ms, then `GET /sign-in` 16,780 ms, `POST` 3,390 ms. The same requests a few
  seconds earlier in the same test: 310, 515, 596 ms.

So the sign-in's code is not slow; the server is slow at those moments, for every kind of request. `signInAs`'s
`expect(bar-top)` covers the most requests under one 15 s wait (the `POST`, the redirect, two `_rsc` fetches and the
workspace page's render), which is why it is where such an episode most often ends a test. The episodes come late, as
the heap grows towards the threshold; that points to garbage collection near the heap limit or to paging, or both. It
is not proven: the logs have no memory figures. P1 is what can tell.

**S7C-02 failed at the sign-in in two of the three closings**, at the same place (its fourth sign-in, in `openColumn`,
right after the server upgraded a format-7 file). The upgrade reads, rewrites and freezes the whole data file; under a
large heap that allocation is a likely trigger of a long collection. P1's log should show whether its sign-in lines up
with a memory peak.

### F4. Q6 – the restart's third occurrence, and causes the PRD does not name

- **Slice 11's S11-10** (`.data/e2e-11-close/full-run.txt`, line 1400): "⚠ Server is approaching the used memory
  threshold, restarting..." comes right after test 472's start, followed by a `ChunkLoadError` of Turbopack's HMR
  client; the canvas never became ready. `docs/known-limitations.md` files it as "cause unknown"; it is the restart.
- **The restart comes earlier as the suite grows:** test 472 of 474, 476 of 486, 467 of 497.
- **About 80 to 100 "The destination stream closed early" errors per full run** (92 in 12a, 82 in 12b, 98 in 11).
  Each is logged with a stack, and `next dev` turns on `--enable-source-maps` for the child (`next-dev.js`), so each
  stack is mapped through source maps. Whether that adds to the heap is not known; P1's per-spec log can show whether
  the heap jumps on the specs that print it. The known limitation from slice 3a still stands.
- **Every test reseeds the data file**, so the server reads and parses the 232 KB e2e file again on the test's first
  request (`src/data/local/file.ts`, the stamp cache keeps one copy per file). That is steady, not growing; it is not
  a suspect, only a cost per test.

### F5. Q2 – the e2e web server today, and where a memory log and a heap setting go

- **`playwright.config.ts`, `webServer` (dev):** command `npx tsx scripts/clean-e2e-build.ts .next-e2e && npm run
  reset-dev-data && npm run dev -- --port 3200`; env `INFOMAPPER_DEV_DB=.data/e2e-db.json`, `NEXT_DIST_DIR=.next-e2e`,
  `INFOMAPPER_TEST_HOOKS=1`; url `http://localhost:3200/sign-in`; `timeout: 120_000`; `reuseExistingServer:
  !process.env.CI`, so **locally an already running server on port 3200 is reused**, and then no setting of this
  config reaches it. The measurement build has its own `webServer` (`MEASURE_BUILD=production`, also 120 s); it is a
  production server without the restart, and this chore leaves it alone.
- Test timeout 60 s, `expect` 15 s, one worker, `retries` 0 locally (1 on CI, where e2e does not run: CI is lint,
  typecheck and unit tests only, `.github/workflows/ci.yml`).
- **`e2e/global-setup.ts`:** reseeds, signs in through the page once, opens the workspace, its settings, Customer 360's
  home and "Customer & orders", reseeds again. It runs after the server answered.
- **`scripts/clean-e2e-build.ts`:** deletes `.next-e2e` (only folders named `.next-e2e*`).
- **Specs with their own server:** only **S0-10** (`e2e/slice-00/S0-10.spec.ts`): `npx next dev --port 3201` with
  `{ ...process.env, INFOMAPPER_DEV_DB, NEXT_DIST_DIR: .next-e2e-restart[-2] }`, a 300 s start limit, run twice and
  stopped with `taskkill /T /F`. It runs early (test 21, about 1 min), so for that minute two dev servers (each with
  its own 4 GB heap limit) run side by side. S2C-11 spawns Vitest, not a server. **S7C-02 starts no server** (F8).
- **Where the memory log goes (P1):** the heap can only be read inside the server process. Proposal: a small probe
  (`scripts/e2e-memory-probe.cjs`) loaded with `NODE_OPTIONS=--require …` in the `webServer` env when
  `E2E_MEMORY_LOG=1`. `next dev` passes `NODE_OPTIONS` to the child; the probe acts only where `__NEXT_DEV_SERVER=1`
  (the child), so `npx`, `npm`, `tsx` and the parent stay quiet. Every 5 s, with an unref'd timer, it appends one line:
  time, `heapUsed`, `heap_size_limit`, `rss`, `external`, and the machine's free memory (`os.freemem()`). The spec
  running at the time comes from a small Playwright reporter (`e2e/memory-reporter.ts`, `onTestBegin`/`onTestEnd`)
  appending to the same log, also only with `E2E_MEMORY_LOG=1`. A restarted child starts the probe again, so the log
  shows the restart too, and Next's own `trace` event gives the heap at that moment. Cost: one `appendFileSync` every
  5 s; not measurable against 1.5 h. The memory log needs `reuseExistingServer` not to reuse a server (it does not
  when nothing listens on 3200, which is the rule anyway).
- **Where a heap setting goes:** `NODE_OPTIONS=--max-old-space-size=<MB>` in the same `webServer` env (it applies to
  the parent and the child; the parent keeps it as given). S0-10's own servers inherit the test worker's environment,
  not the `webServer`'s, so they keep the default unless S0-10 passes it too.

### F6. Q4 – the fonts, and what the slice 12b start failure really was

- **Fonts:** `src/app/layout.tsx` loads **IBM Plex Sans** (400, 500, 600; subsets latin and latin-ext) and **IBM Plex
  Mono** (400, 500; latin and latin-ext) through `next/font/google`, as CSS variables `--font-plex-sans` and
  `--font-plex-mono` (`globals.css` maps them to `--font-sans` and `--font-mono`). **License:** SIL Open Font License
  1.1 (IBM Plex is published under OFL 1.1, which allows bundling and redistributing the files with the software if the
  license text goes with them).
- **What the failed start's log shows** (`.data/s12b-close-e2e-start-failed.log`, 59,762 lines, 123 s): the
  Google CSS **was** fetched (the error quotes the `@font-face` blocks with their `fonts.gstatic.com` addresses and
  unicode ranges); what failed is Turbopack resolving the font *files* inside that CSS:
  "Module not found: Can't resolve '@vercel/turbopack-next/internal/font/google/font'" / "next/font/google queries have
  exactly one entry", for the 18 `@font-face` blocks of IBM Plex Sans, 95 times each (6,840 errors; every request the
  readiness check made recompiled into the same error). There is **no** download error, retry or timeout line. So the
  known limitation's "Google Fonts did not answer" is an inference the log does not show; what is certain is that the
  server stayed broken for the whole 120 s.
- **How a slow or absent font host is handled:** in the webpack path (`next/dist/compiled/@next/font/dist/google`):
  3 s timeout per request in dev (`fetch-resource.js`), retries (`retry.js`), and in dev a fallback font with an error
  log ("Failed to download … Using fallback font instead", `loader.js` line 151). Turbopack (which the app uses) has
  its own implementation in the native module; its binary contains the same "Failed to download … from Google" text
  and "next/font/google queries have exactly one entry", but its retries and fallback **cannot be read from the
  source in `node_modules`** (it is compiled Rust). Not established: why the font-file replacer failed that once.
- **Consequence for P3 A:** a longer start limit helps only if the error clears by itself within the longer limit. In
  the kept log it did not clear in 120 s, and the same server process kept failing; a fresh run a minute later started.
  So P3 A is unlikely to help; at best it turns a failed start into a slow one.
- **What P3 B (`next/font/local`) costs:**
  - Files: 5 weights × the 2 subsets, as `woff2` (around 10 files, roughly 200 to 300 KB in all), plus `OFL.txt`, for
    example in `src/app/fonts/`. Source: the IBM Plex release or Google Fonts' download; to be chosen in step 3.
  - `layout.tsx` changes from `IBM_Plex_Sans(...)` to `localFont({ src: [...], variable: "--font-plex-sans" })`: an app
    file, which CE-04 allows when explained. The CSS variables stay, so nothing else changes.
  - Google's CSS splits each weight by `unicode-range` (latin, latin-ext). Local files either keep two files per
    weight with `unicode-range` declared (`next/font/local` takes `declarations`), or one file per weight with both
    subsets. Either way, the glyphs drawn are the same files' glyphs.
  - The fallback font's metrics (`adjustFontFallback`) are computed from the local file instead of Google's table; the
    moment before the font loads may differ by a pixel. Screenshot specs (`*-screens.spec.ts`, on demand) may show it.
  - **Builds:** `npm run dev`, every e2e run, S0-10's two servers, `npm run build` and `npm run measure:build` stop
    fetching from Google (today each cold compile fetches). CI does not build, so nothing changes there. The
    measurement build's figures do not depend on where the font comes from, but a figure measured before and after is
    not comparable by one font load; the next measuring slice should note it.
- **A cheap check for CE-02:** the native module contains `NEXT_FONT_GOOGLE_MOCKED_RESPONSES`, the variable the
  webpack path uses to read Google's CSS from a file instead of the network. Whether Turbopack honours it for the CSS
  and the font files is not verified. With P3 B, CE-02 is checked by blocking `fonts.googleapis.com` and
  `fonts.gstatic.com` (for example in the hosts file, by Łukasz) for one start; no code is needed.

### F7. Q3 – splitting the run

- Playwright **1.63.0**. One `playwright test` starts one `webServer`; it cannot restart it between files. A split
  needs a wrapper script (for example `scripts/e2e.ts`, behind `npm run e2e`) that runs `playwright test` twice, each
  with its own fresh server, each writing a `blob` report, and then `npx playwright merge-reports` into the list and HTML
  reports. `npm run e2e -- <files>` (a single file or folder) must stay one part, unchanged.
- **Choosing the parts:** by folder, balanced by time. From slice 12b's closing (sum of test durations 5,182 s;
  1.5 h with start and warm-up): `fixes` to `slice-05a` take 2,525 s (49 %), `slice-06a` to `slice-12b` 2,657 s
  (51 %). Playwright's `--shard=1/2` balances by number of tests, not time; folders are clearer and stable. The split
  point moves as slices are added; the wrapper can take it from a list in one place.
- **Cost per run:** a second start (delete `.next-e2e`, reseed, start, about 10 to 20 s) and a second warm-up and cold
  compile of every page the second part uses (the known limitation says about a minute for all pages). Estimate
  1.5 to 2 min per run, about 2 %, inside CE-05's 10 %.
- **What it gains:** each part's server starts with an empty heap. If the heap grows per test, as the restart's
  position suggests (about 3.2 GB after about 470 tests), each part peaks around half of that, about 45 to 50 % of the
  threshold's heap, which is inside CE-01's 20 % margin. This is the assumption P1 checks.

### F8. Q5 – the sign-in, and what a test sign-in would need

- **The path:** `signInAs` (`e2e/slice-00/helpers.ts`) opens `/sign-in`, clicks the user's button (a form with the
  server action `signInAsDevUser`, `src/app/_actions/session.ts`), which checks the user, lists their organizations,
  writes the signed cookie `infomapper_dev_session` (`writeSession`, `src/app/_lib/session.ts`) and redirects to `/`;
  `/` (`src/app/page.tsx`) redirects to the last or first workspace; the test waits for `bar-top` (15 s).
- **Usage:** 408 calls of `signInAs` in `e2e/` (285 of the 348 spec files call it); S7C-02's `openColumn` signs in each time (four times
  in the one test).
- **A test sign-in that sets the cookie** (P4 B) would need: `encodeSession` (`src/app/_lib/dev-session.ts`), the
  secret (`sessionSecret()`, `src/data/local/session-secret.ts`: `INFOMAPPER_SESSION_SECRET` or `.data/session-secret`,
  which the e2e server reads too), the user's organizations (`organizations.listForUser` through the local store, as
  the helpers already write test data), `context.addCookies` with the cookie's options (`httpOnly`, `sameSite: lax`,
  `path: /`), then `goto("/")` and the same `bar-top` wait. The proxy (`src/proxy.ts`) only checks that the cookie is
  present; the pages check its signature. No app change is needed.
- **What it saves:** the `GET /sign-in` and the `POST`, two of the four or five requests (about 0.3 to 0.5 s per
  sign-in on a quiet server, a few minutes per run). **What it does not:** the slow episodes (F3) slow every request; the
  test would then time out on `goto("/")` or its first own step instead. It is a speed gain, not a fix of the flake.
- **Specs that must keep the real sign-in:** S0-01 (sign-in, landing, the cookie checks), slice 8's sign-in and
  organization specs (`signInWithPassword`, used by S8-06, S8-11, S8-13 and S12B-09; S8-01 clicks `button-dev-user`), the global setup (it warms up
  `/sign-in` and the action).
- **The PRD's Q2 mentions "S7C-02 and others" as starting their own servers:** wrong. S7C-02 rewrites the e2e data file
  to format 7 and lets the one e2e server upgrade it. The known limitation "S11-10 and S7C-02 failed once in slice 11's
  closing run" says the same and needs correcting.

### F9. Q6 – the docs to update (in step 4)

- `docs/known-limitations.md`, "End-to-end tests":
  - "The e2e dev server restarts itself at its memory threshold": the threshold as found (F1), slice 11's occurrence
    (F4), the remedy chosen.
  - "The e2e server's start may miss its 120 s": what the log shows (F6), the remedy chosen.
  - "S7A-04-route's development sign-in timed out once" and "S11-10 and S7C-02 failed once": the cause as P1 shows it;
    S11-10 was the restart; S7C-02 has no own server.
  - "e2e dev servers run without Turbopack's file-system cache": unchanged unless the split changes the warm-up.
- `docs/ideas.md`: close or shorten "Sign-in timeouts in full e2e runs" and "A chore before slice 13".
- `CLAUDE.md`, "Testing" and "Commands": `E2E_MEMORY_LOG=1`, the split (if chosen) and how to run one part.
- `.env.example`: only if a new variable is read by the app (none is planned; `E2E_MEMORY_LOG` is read by the test
  setup only, but listing it there costs nothing; Łukasz decides).
- The full-run rule in CLAUDE.md ("a failing test run three times on its own") stays.

### Proposals

- **P1 – as the PRD says,** with the probe inside the server process (F5), the reporter for the spec names, and the
  machine's free memory in the same line. Step 2 runs one full run with it on `main`'s code.
- **P2 – B (split in two by folder) first, not A.** Reasons: the heap limit is already half the RAM on this laptop (F1,
  F2); every failure came in the run's last 40 % (F3); a split costs about 2 % of a run (F7) and needs no app change.
  A is reconsidered only if P1 shows the heap's peak small and the machine with memory to spare. C (both) only if B
  fails CE-01.
- **P3 – B (`next/font/local`),** with the OFL text. The kept log does not show a slow download but a server that
  stayed broken (F6), so a longer limit (A) would likely not have saved that run. B removes Google Fonts from every
  start, including S0-10's two and the measurement build's. It touches `layout.tsx` and adds font files; CE-04 allows
  it when explained. If Łukasz prefers no app change, A with 300 s is harmless but should not be counted as a fix.
- **P4 – A,** decided after step 2's log: if the sign-in failures line up with high memory or low free memory, the
  split is the remedy. B (a cookie sign-in) is worth it only as a speed gain, not as a fix (F8); not proposed for this
  chore.

### Differences from the PRD

| PRD | Finding |
| --- | --- |
| P2 A "proposed": a larger heap | Already 50 % of RAM by default; raising it on 8 GB risks paging (F1, F2). Propose B. |
| P3 A "proposed": a longer start limit | The failed start was a repeated Turbopack error, not a slow answer (F6). Propose B. |
| §1: the server did not start "because `next/font/google` did not answer" | The log shows no download error (F6). |
| Q2: S0-10, **S7C-02** and others start their own servers | Only S0-10 does (F5, F8). |
| §1 lists two restart occurrences (12a, 12b) | Three: slice 11's S11-10 was one too (F4). |
| P1: "resident and heap, if available" | The heap is available only from inside the child; proposed probe (F5). |
| §3.1: "a part of the global setup" for the log | The global setup runs in Playwright's process, not the server's; it cannot read the heap (F5). |
| Unchanged: "the tests' assertions" | Holds for every proposal; P3 B changes `layout.tsx`. |

The PRD does not touch the reference prototype; there are no prototype differences for this chore.

### Questions for Łukasz

1. **P2:** B (split in two by folder, a wrapper behind `npm run e2e`) instead of A? Or decide only after step 2's log,
   as the PRD's step order says (my recommendation: decide after step 2, with B as the expected answer)?
2. **P3:** B (IBM Plex hosted in the repository, `next/font/local`, OFL text beside it; one app file changes), or A
   (300 s, no app change, probably no fix)?
3. **P4:** agree that the cookie sign-in is not built in this chore, unless step 2 shows sign-in failures without high
   memory?
4. **The memory log's form:** a probe loaded with `NODE_OPTIONS=--require` into the dev server's child process, plus a
   Playwright reporter for the spec names, both only with `E2E_MEMORY_LOG=1`. Agreed? (Both live in `scripts/` and
   `e2e/`, no app code.)
5. **Step 2's measured run** takes about 1.5 h on this laptop and must run with no other dev server. Run it in the
   working tree here (nothing else running), as in the closings?

### Łukasz's answers to step 1 (1 November 2026)

1. **P2:** decided after step 2's log; B (the split by folder, as proposed) is expected.
2. **P3:** before choosing, establish whether Turbopack's "next/font/google queries have exactly one entry" is tied to
   `next/font/google` (the stack, the module that raises it; whether it also comes on a start without a connection to
   `fonts.googleapis.com`, if that is cheap to check). If it is: B (IBM Plex hosted through `next/font/local`, with the
   OFL 1.1 text). If not: no app change; one automatic retry of the e2e server's start in the launching script, and a
   known limitation about the Turbopack error.
3. **P4:** A; no cookie sign-in in this chore.
4. **The memory log:** the form is accepted. Every 5 s it also records the system's free memory, the swap (page file),
   and the resident memory (RSS) of both `next dev`'s main process and its child, not only the JavaScript heap: on
   8 GB the 4 to 17 s stalls may be swapping.
5. **Step 2's run** runs here, with no dev server running; the results note any other heavy processes during the run.

Also: the mistake about S7C-02 (it starts no server of its own; only S0-10 does) is corrected here (F5, F8) and goes
into `docs/known-limitations.md` at the closing.

## Step 2 – the memory log and one measured full run

### P3: where "next/font/google queries have exactly one entry" comes from

Read from Next.js's source at the tag `v16.3.8` (`crates/next-core/src/next_font/google/mod.rs`, fetched from GitHub; the
installed package holds only the compiled native module, whose strings match).

- **The module that raises it** is `next/font/google`'s Turbopack implementation: `NextFontGoogleFontFileReplacer`
  (`mod.rs` line 349), the import-map replacement for `@vercel/turbopack-next/internal/font/google/font` (line 79).
  Its `result` (line 379) calls `font_file_options_from_query_map` (line 638), which bails with exactly this message
  when the request's query does not parse into one entry (line 642). The failed log's "Debug info" names the same
  chain (`<NextFontGoogleFontFileReplacer as ImportMappingReplacement>::result failed`) and its import trace ends in
  `src/app/layout.tsx`'s IBM Plex Sans.
- **How the query is made:** `update_google_stylesheet` (around line 455) takes Google's CSS, finds every font file's
  `url(...)` (`find_font_files_in_css`) and replaces it with `@vercel/turbopack-next/internal/font/google/font?{json}`,
  where the JSON holds the font file's URL; the JSON goes through `qstring::QString::from(...)`, which reads `&` and
  `=` as separators. A font URL of the usual form (`https://fonts.gstatic.com/s/ibmplexsans/v23/….woff2`, as Google
  serves it today: 18 `@font-face` blocks for the three weights, the same 18 that failed) makes one entry. A URL with
  `&` or `=` in it makes several, and the replacer fails on every one of them. So the error follows from **what
  Google's stylesheet contained at that moment**; the log cuts the URLs off ("https://fonts.gs…"), so which URLs they
  were cannot be read back. Google serves `fonts.gstatic.com/l/font?kit=…&skey=…&v=…` URLs in some answers; that is a
  likely candidate, not a proven one.
- **The answer is cached per server process:** Turbopack keeps the failed result as the task's result, so each of the
  95 requests in 120 s returned the same error; a fresh server a minute later fetched a normal stylesheet.
- **Without the network** (checked, 1 November 2026: `next dev` on port 3210 with an empty build folder
  `.next-e2e-fontcheck`, a copy of the e2e data file, and `HTTPS_PROXY`/`HTTP_PROXY` pointing to a closed port):
  Turbopack warned "Error while requesting resource … fonts.googleapis.com" and "Failed to download IBM Plex Mono /
  IBM Plex Sans from Google Fonts. Using a fallback font instead.", and `/sign-in` answered 200. A start without
  Google Fonts does **not** fail; the failure needs Google to answer with a stylesheet the replacer cannot read. The
  server was stopped, its build folder and the data copy deleted, and `tsconfig.json`'s automatic `include` edit for
  that folder reverted. Its log is kept in `.data/fontcheck-no-google-start.log`.

**Conclusion for P3:** the error is tied to `next/font/google` (its Turbopack replacer, fed by Google's answer).
By Łukasz's answer this means **B**: IBM Plex through `next/font/local` with the OFL 1.1 text, in step 3.
