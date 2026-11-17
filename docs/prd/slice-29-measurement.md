# Slice 29 – the measurement (step 4, S29-08)

The pages read from Postgres on the Vercel preview, measured from Łukasz's laptop, beside the same pages on the local
adapter. **Figures only (DB7): no read fix is made or proposed here as decided; bars come after Łukasz has seen these.**

**Łukasz's decision (17 November 2026): option A.** No read fixes in slice 29 (no step 5): slice B's rights round
changes the same reads, so the read fixes are a slice of their own after slice B, measured with this spec against these
figures (`docs/ideas.md`, "The database program: what comes later"). No bars are set yet.

## How it was measured

- **The preview:** the branch address `infomapper-app-dev-git-slice-2-f77c19-lukaszs-projects-9ffbc132.vercel.app`, serving
  deployment `BVEU2T6P14oaJ4mk4KwXTEgnj3nW` (commit `5f974fd`, Vercel's inspector id; the deployment's own address is in
  the dashboard). Functions in `fra1` (`X-Vercel-Id` `arn1 → fra1`), Fluid compute, the pool at 5 connections through
  Supabase's transaction pooler; `infomapper-dev` (Micro, Central EU). Behind Deployment Protection, reached with the
  Protection Bypass for Automation header.
- **The local adapter:** the measurement-only production build (`npm run measure:build`, `npm run measure:start`, AD-31)
  on `127.0.0.1:3300` with `INFOMAPPER_TIMING=1`, on a data file of its own (`.data/measure/s29/local-db.json`: the same
  demo and "Performance test", built by `scripts/lib/seed-rows.ts`; never `.data/dev-db.json`).
- **The spec:** `e2e/slice-29/S29-08-measure.spec.ts` (`MEASURE=1`, headless Chromium on the laptop, signed in as
  Łukasz): per page the run's first load on its own, then 2 discarded and **10 counted loads; medians**. 17 November
  2026, 20:49 to 20:51 UTC (preview) and 20:53 to 20:54 UTC (local).
- **The data sets:** the demo's "Retail Co – DWH" (the demo's largest workspace: 4,283 rows in the database in all) and
  "Performance test" (the spike's 100 cards). Each page is the workspace home, the first project's home, its first
  canvas, that canvas's thumbnail, and for the demo a document's editor (Performance test has no document, and none can
  be made on a read-only server).
- **The columns:**
  - **ready:** from the request to the page drawn (the home's page, the project home's first tile, the canvas's first
    card, the editor's first laid-out pages), in the browser.
  - **TTFB** and **response end:** the browser's navigation timing (the page streams: its first bytes come early, the
    rest when the reads are done).
  - **calls, statements, statement time, wait, read span, server total:** the page's own timing record (Q9, F15):
    port calls, SQL statements, their time added up, the time waiting for a pool connection, the time the calls spanned,
    and the server's time until the record was rendered at the page's end. A page's record counts the reads before it
    renders (the page's and the shell's): a module's tab rendered after it is not in it. The thumbnail's are its
    `Server-Timing` header. On the local adapter there are no statements: its reads filter the cached file in memory.

## Warm loads (medians of 10)

| Data set | Page | Ready, preview | Ready, local | TTFB preview / local | Response end preview / local | Calls | Statements | Statement time | Wait | Read span | Server total, preview / local |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Retail Co – DWH | workspace home | **434 ms** | 164 ms | 89 / 43 | 380 / 44 | 38 | 91 | 204 ms | 16 ms | 169 ms | 172 / 19 ms |
| Retail Co – DWH | project home | **463 ms** | 188 ms | 71 / 53 | 423 / 56 | 42 | 93 | 237 ms | 22 ms | 168 ms | 173 / 29 ms |
| Retail Co – DWH | canvas page | **626 ms** | 344 ms | 67 / 42 | 493 / 47 | 50 | 116 | 283 ms | 32 ms | 193 ms | 214 / 16 ms |
| Retail Co – DWH | thumbnail | **264 ms** | 12 ms | – | – | 14 | 37 | 76 ms | 5 ms | 73 ms | 77 / 4 ms |
| Retail Co – DWH | editor and snapshot | **1,799 ms** | 1,255 ms | snapshot answer 414 / 28 | 453 / 45 | – | – | – | – | – | – |
| Performance test | workspace home | **552 ms** | 174 ms | 65 / 34 | 499 / 36 | 31 | 73 | 365 ms | 19 ms | 288 ms | 304 / 18 ms |
| Performance test | project home | **630 ms** | 324 ms | 75 / 104 | 610 / 140 | 35 | 83 | 451 ms | 19 ms | 234 ms | 275 / 49 ms |
| Performance test | canvas page | **1,783 ms** | 1,461 ms | 70 / 208 | 1,173 / 295 | 43 | 106 | 579 ms | 43 ms | 316 ms | 428 / 98 ms |
| Performance test | thumbnail | **340 ms** | 13 ms | – | – | 12 | 35 | 195 ms | 6 ms | 158 ms | 166 / 5 ms |

- The local adapter's calls are one fewer per page (37 against 38 and so on): on Postgres the session reads the person
  by their Auth account and their organizations (`getByAuthUserId`, `listForUser`).
- **Spread** (min to max of the 10): preview demo canvas 597 to 864 ms, Performance test canvas 1,396 to 4,515 ms,
  Performance test workspace home 473 to 1,586 ms; local Performance test canvas 1,252 to 2,039 ms. The raw samples are in
  `.data/measure/s29/preview-2026-11-17T20-51-33-120Z.json` and `local-2026-11-17T20-54-15-412Z.json` (git-ignored).

## What the figures say (no fix proposed: DB7)

- **The reads are most of the server's time on Postgres.** The read span is 74 to 98 % of the server total on the homes
  and the canvas page (169 of 172 ms on the demo home, 316 of 428 ms on Performance test's canvas). The pattern is as the report and F3 expected: 31 to 50 port calls
  and **73 to 116 SQL statements per page**; statements run 2 to 3 at a time on average (statement time over read span:
  204 / 169 ms ≈ 1.2 overlap on the demo home, 579 / 316 ≈ 1.8 on Performance test's canvas).
- **Waiting for a connection is small** (5 to 43 ms) with the pool at 5: the parallel reads queue a little, not much.
- **The browser's share stays the local one.** The canvas page's ready time grows by about the server's extra time
  (demo 626 against 344 ms; Performance test 1,783 against 1,461 ms): the client's work (hydration, the canvas's first
  renders, C-08) is unchanged; Postgres adds 270 to 380 ms per page (demo 270 to 282 ms, Performance
  test 306 to 378 ms).
- **The thumbnail** is a whole `model.load` and five more reads per request: 264 and 340 ms on the preview against 12
  and 13 ms locally (it is cached for good once its key matches, AD-32; a home shows one per canvas).

## The snapshot and Vercel's 4.5 MB (F11)

The editor's snapshot action (`documentSnapshotAction`), read as the action reads it, through the Postgres adapter, from
the laptop (`scripts/pg-snapshot-size.ts`):

| Workspace | Uncompressed | Share of 4.5 MB | gzip | brotli |
| --- | --- | --- | --- | --- |
| Retail Co – DWH | 193.2 KB | 4.2 % | 17.2 KB | 12.2 KB |
| Sales analytics | 98.4 KB | 2.1 % | 8.9 KB | 6.8 KB |
| Bank X – Risk DWH | 14.1 KB | 0.3 % | 2.5 KB | 2.0 KB |
| Performance test | **2,251.3 KB** | **48.9 %** | 135.3 KB | 85.9 KB |

- On the preview the demo's snapshot answer arrived as **15.8 KB** (compressed, as the browser received it; 17.5 KB from
  the local build), in 414 ms to its first byte and 453 ms to its end.
- Performance test's 2.25 MB is half of Vercel's 4.5 MB body limit, as slice 26 measured (2.2 MB). Whether the limit
  counts a server action's answer (streamed RSC) compressed, uncompressed or at all is **not confirmed**: Vercel's page
  exempts "streamed responses". A workspace about twice Performance test's size would reach it if it counts.
- **The action's own log line** (`timing {"route":"document-snapshot", … "bytes": …}`, numbers only) is written on
  the preview. Reading it needs Vercel's runtime logs: in the dashboard (project → Logs, filter `timing`), which Łukasz
  can read and paste; or `vercel logs` with a token, which this slice does not add (no token in the repository, CI or the
  laptop's files without Łukasz's decision).

## Cold loads (one sample each)

A fresh deployment's first requests: deployment `3TDsrGrxMHtAuh3EYwygDvVAC8Bm` (commit `d04187d`, which changes no app
code against `5f974fd`) had had no request when the run began (21:06 UTC). The sign-in comes first, so the instance's
very start falls on `/sign-in`; the pages after it are the instance's first loads of each, one sample per page, not a
median (five cold samples need five fresh deployments or idle periods of 15 minutes or more).

| Data set | Page | Ready (cold) | Ready (warm median) | TTFB | Response end | Statements | Wait | Server total |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Retail Co – DWH | workspace home | 555 ms | 434 ms | 62 | 439 | 91 | 16 ms | 224 ms |
| Retail Co – DWH | project home | 1,021 ms | 463 ms | 56 | 953 | 101 | **312 ms** | 367 ms |
| Retail Co – DWH | canvas page | 1,096 ms | 626 ms | 75 | 800 | 116 | 33 ms | 219 ms |
| Retail Co – DWH | thumbnail | 426 ms | 264 ms | – | – | 37 | 5 ms | 85 ms |
| Retail Co – DWH | editor and snapshot | 5,053 ms | 1,799 ms | 486 | 543 | – | – | – |
| Performance test | workspace home | 1,111 ms | 552 ms | 621 | 1,053 | 73 | 21 ms | 312 ms |
| Performance test | project home | 975 ms | 630 ms | 135 | 883 | 90 | 196 ms | 378 ms |
| Performance test | canvas page | 2,272 ms | 1,783 ms | 61 | 1,579 | 106 | 34 ms | 404 ms |
| Performance test | thumbnail | 367 ms | 340 ms | – | – | 35 | 5 ms | 172 ms |

The cold loads are 1.1 to 2.8 times the warm medians. Their extra wait for a connection (196 and 312 ms on the project
homes) is most likely the pool opening its connections through the pooler with TLS (not measured apart); the editor's 5 s most likely includes the first load of the
editor's and Paged.js's code in a fresh deployment besides its snapshot. Raw: `.data/measure/s29/cold/`.

## Not measured

- The editor's snapshot on Performance test in the browser (no document there; sized by the script instead).
- Environment 2 (the laptop's dev server on `infomapper-dev`) as a third column: a development server, not comparable.
- The proxy's own time: it runs at the edge where a request arrives (`arn1`, Stockholm, for the laptop), not in `fra1`;
  its `getClaims` checks the token locally (ES256), so it reads no database. Its time is inside TTFB.
