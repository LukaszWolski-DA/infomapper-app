# Fix – S6B-04 reads the zoom while the centring still runs

Status: **step 1 done** (24 November 2026): the cause, the proposal and the proof; no code. **Łukasz's answers to
section 5** (24 November 2026): 1, the test-only fix as proposed, and 3, the two fixed waits kept, are Claude's calls,
for his approval at the closing; 2, the fly-to's zoom-out, is his, and his message left it open (`<a/b>`: a, its own
branch `fix/canvas-linear-view-moves` after this one; b, leave it): still to answer, not needed for this branch. **Step 2 done** (24 November 2026): the fix in S6B-04 and its proof
(section 4's numbers), the checks and the full run (section 7). Branch
`fix/s6b-04-zoom-flake` from `dev` at `b3eb8fd`. Found in slice 34's first full run of step 3
([44907819468](https://github.com/LukaszWolski-DA/infomapper-app/actions/runs/44907819468), commit `8685d01`, part 4):
`expect((await viewportTransform(page)).zoom).toBe(zoom)` received 0.449993 for 0.45; the single-file check passed 3
rounds (`docs/ideas.md`, "S6B-04 is flaky"). No `pg:` script, no connection to `infomapper-dev`; the local file and its
backups not read (the e2e run reseeds its own `.data/e2e-db.json`).

## 1. The cause (fact)

After Back, `showPlace` (`src/canvas/ModelCanvas.tsx`) selects Customer and, since its card is off screen, calls
`centerOnRect`, which moves the view with `rf.setViewport({ x, y, zoom: z }, { duration: 250 })` at the zoom it has.
React Flow 12.12.0 animates it with d3-zoom's default interpolator, `interpolateZoom` (van Wijk and Nuij's "smooth"
fly-to, `@xyflow/system`'s `setViewport`: `interpolate === 'linear' ? interpolate : interpolateZoom`), eased cubic in-out
(`defaultEase`). That interpolator **zooms out and back in** on the way, even when the start and end zoom are equal, and
lands exactly on the target zoom only on the last frame (`d3-zoom/src/zoom.js`: `if (t === 1) t = b; // Avoid rounding
error on end.`).

The spec waits until Customer's card is within 2 px of the pane's centre, then reads the zoom once. The centre arrives
before the zoom does:

- **Computed** (d3's own `interpolateZoom` and the same easing, the spec's 4,000 × 3,000 px pan at 45 %): at 90 % of the
  time the centre is 2 px off at zoom 0.442; at 99 % it is 0 px off at zoom 0.449992, the failing run's 0.449993; the
  lowest zoom on the way is about 0.10.
- **The failing run's trace** (artifact `part-4`): Back's click ends at 257,993 ms, the poll's second read finds the card
  centred at 258,156 to 258,184 ms and the zoom is read at 258,194 ms, about 200 ms after the click, inside the 250 ms
  that started after it.
- **Reproduced in the browser** (a probe spec, removed again, not committed: S6B-04's steps, then the zoom and the card's
  distance from the centre on every frame for 800 ms after Back; `npm run e2e -- … --repeat-each 3`): the lowest zoom
  per run was 0.155, 0.207 and 0.320 (only 3 to 6 frames drawn on the laptop's dev server), every run ended at exactly
  0.45, and in the third run one frame, 391 ms after the sampler started, had the card within 2 px at zoom 0.445686: the
  failure's window.

## 2. Real bug or the test only

**The test reads too early.** The view ends at exactly the zoom it had (d3 sets the target transform itself on the last
frame), so D-38's "centred at the same zoom" holds for the view the person is left with; no person is ever left at a
wrong zoom. The fix is test-only.

**But the way there differs from the prototype** (for Łukasz to decide, section 5): during the 250 ms the view zooms out
to roughly a quarter of its zoom and back. The prototype's `centerOn` moves the view with a CSS transition on the
transform (`world.classList.add("anim")`), a straight pan at a constant zoom. The same fly-to runs on every animated view
change of the canvas (`rf.setViewport` and `rf.fitBounds` with `duration: 250`: `ModelCanvas.tsx` lines 531, 1025, 1380,
1690, 1703; `GroupActions.ts` 537; `useFrames.ts` 820): Back and Forward, "On canvases", Fit, a selection's fit, Zoom to
frame. React Flow has the switch (`{ interpolate: "linear" }`, typed in `@xyflow/system`'s `general.d.ts`). It is the
canvas, shared infrastructure: not on this branch (The slice cycle, 4).

## 3. The fix

`e2e/slice-06b/S6B-04.spec.ts` only, the assertions unchanged:

- The poll after Back waits for what the person sees at the end of the centring: the card within 2 px of the centre
  **and** the view's zoom equal to the zoom before, in one poll that returns both
  (`{ centred: true, zoom }`, `toEqual`), so a wrong zoom still fails, with the zoom it read in the message.
- `expect((await viewportTransform(page)).zoom).toBe(zoom)` stays as it is, now read after the centring has ended.
- No tolerance: the zoom is exact once the move ends, so `Object.is` keeps catching a real error (a tolerance would
  only hide the window the poll now waits through).

The Forward half (on screen: nothing moves) keeps its `waitForTimeout(400)`: it checks that nothing happens, which has
no state to wait for, and 400 ms is longer than any 250 ms move it would catch (section 5, question 3).

## 4. The proof

1. **The failure made reproducible first** (on the branch, before the fix): a scratch copy of the spec (not committed,
   like step 1's probe) with an init script that slows the page's `performance.now()` ten times. d3-timer reads the
   clock as `performance.now()` on every frame (`d3-timer/src/timer.js`), so the 250 ms centring takes 2.5 s while the
   poll keeps reading every 100 to 1,000 ms. Expected: the unchanged spec fails on most of 10 repeats with a zoom below
   0.45; the fixed spec passes 10 of 10 with the same slowed clock. If the slowed clock disturbs the page elsewhere,
   the fallback is CDP's `Emulation.setCPUThrottlingRate` (6×), reported with its own counts.
2. **The fixed spec, `npm run e2e -- e2e/slice-06b/S6B-04.spec.ts --repeat-each 10 --trace on`**, at the real clock: 10
   of 10 pass.
3. **The check from the traces** (a script over the 10 `trace.zip`, run in the scratchpad): every evaluation of the new
   poll has its `{ centred, zoom }` in the trace. Counted per run: the poll's reads, the reads with `centred: true` and a
   zoom other than the zoom before (each one a moment the old spec could have failed in), and the zoom of the last read.
   Pass: in all 10 the last read is `centred: true` with exactly the zoom before, and the time from Back's click to it is
   at least the move's (about 250 ms); the runs with a mid-flight `centred: true` read show the window was there and
   waited through.
4. The single-file check in CI (`gh workflow run e2e.yml --ref fix/s6b-04-zoom-flake -f
   files="e2e/slice-06b/S6B-04.spec.ts" -f rounds=3`), lint, typecheck, `npm test`, then one full run on a commit that
   contains `dev`'s head.

### The proof's numbers (step 2, 24 November 2026, on the laptop)

1. **Slowed clock** (`npm run e2e -- PROOF-old.spec.ts PROOF-new.spec.ts --repeat-each 10`, the two copies removed
   again): the unchanged spec **failed 5 of 10**, every time on `toBe(zoom)` (received 0.449548, 0.448012, 0.449508,
   0.44995, 0.445754); the fixed spec **passed 10 of 10**. The window is narrow even with a slowed clock (the poll
   reads every 100 to 1,000 ms), so half the runs missed it.
2. **The fixed spec at the real clock, `--repeat-each 10 --trace on`:** 10 of 10 passed.
3. **The traces** (a script over each run's `test.trace`, in the scratchpad: Playwright keeps every failed poll read's
   diff, so the received `{ centred, zoom }` of each read): 4 runs needed 2 reads, 6 needed 1. The 4 first reads were
   during the move (not centred, zoom 0.45, 0.449744, 0.449367 and 0.420832), so the poll waited through it. No read
   found the card centred at another zoom (the old spec's failure window) at the real clock. In all 10 the passing read
   was 350 to 568 ms after Back's click began, longer than the 250 ms move. **A correction to section 4's criterion:**
   measured from the click's end it was 115 to 395 ms; the traversal and the move start inside the click, which itself
   took 103 to 441 ms (Playwright waits for the navigation it starts), so the time is counted from the click's start.
   A read that is both centred and at the exact zoom can only come after the move: before it the card is off screen,
   and during it d3 reaches the exact zoom only on the last frame.

## 5. For Łukasz to decide

1. **The fix as in section 3** (test-only, one poll of the centre and the zoom, the assertion unchanged)? Recommended.
2. **The fly-to's zoom-out**: leave it, or a `fix/canvas-linear-view-moves` branch from `dev` with `interpolate:
   "linear"` on the canvas's seven animated view changes, as the prototype moves (a visible change of the canvas;
   shared infrastructure, its own full run)? Proposed in `docs/ideas.md`; recommended as its own branch after this one.
3. **Fixed waits beside it**: S6B-04's Forward half (400 ms, nothing must move) and S5A-07's fit (`waitForTimeout(600)`,
   then a compare within 1 px and 3 decimals) stay as they are (recommended: neither has flaked; the second could poll
   the fitted view instead, a later `fix/`).

## 6. Other specs with the same pattern

Searched: every spec that reads `viewportTransform` or a card's place after a view change, and those that check a
centring, a fit or Zoom to frame (`centred`, `press("f")`, `Zoom to frame`, `Show row`).

- **A value read once while the fly-to may still run: S6B-04 only.**
- **A fixed wait for the move instead of its end state:** S5A-07 (`waitForTimeout(600)` after F, then `toBeCloseTo(…, 3)`):
  stable, since 600 ms is more than 250 ms, but against "Testing"'s race rule; S6B-04's own Forward half (400 ms, a check
  that nothing moves).
- **A view read at once that must not change** (late-selection-create-dimension, late-selection-place-card in
  `e2e/fixes/`, S10A-10, S10B-06): read right after the answer; a late move would pass unnoticed rather than fail, so
  none flakes.
- **Moves checked without an exact value**: S2B-13's Zoom to frame (`expect.poll(viewOf).not.toBe(v0)`), S17-03 (the
  row visible), S20-07 (selection and toasts): none reads the zoom or the place mid-flight.
- S6B-05 (Back to another canvas) and S6B-10 (measurement) read a view the canvas sets without animation on open.

## 7. The plan

- **Step 1** (this document): the cause, the fix, the proof; committed and pushed. Stop for Łukasz's answers.
- **Step 2:** the proof's first part (the failure reproducible, the unchanged spec), the fix, the proof's second and
  third parts, a draft PR into `dev`, lint, typecheck, `npm test`, CI and the single-file check, `docs/ideas.md`'s entry
  marked done, this document's status; then one full run (E2E workflow) on a commit that contains `dev`'s head, with its
  link, commit, wall-clock, the parts' times and heap peaks, and the counts. Stop.
  **Done** (24 November 2026), PR #92 into `dev`: lint, typecheck and `npm test` (205 files, 2,474 tests passed, 13
  skipped) on the laptop; CI's `check` and Schema's `migrations` and `smoke` green; the single-file check
  ([45386293045](https://github.com/LukaszWolski-DA/infomapper-app/actions/runs/45386293045)) 3 of 3 rounds; the full
  run [45386980180](https://github.com/LukaszWolski-DA/infomapper-app/actions/runs/45386980180) on `e5f6bab` (which
  contains `dev`'s head `b3eb8fd`): 882 passed, 0 failed, 0 flaky, 16 skipped, 15 min 38 s wall-clock; the parts 9.3, 6.6,
  6.7, 8.8, 7.7, 12.5, 7.4, 7.2, 11.5 and 11.1 min, heap peaks 1,377, 1,198, 1,554, 1,565, 1,450, 1,175, 1,710, 1,516,
  1,514 and 1,082 MB. A later commit touching only Markdown in `docs/` keeps the run valid.
- **Closing:** a prompt with the merge into `dev` only, on Łukasz's command (no tag: a `fix/` branch has none).
