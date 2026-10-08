# Slice 2p – Acceptance

Status: **closed without changing the renderer** (Łukasz, 8 October 2026): steps 0, 1 and 1b done; steps 2–4 dropped or
deferred; waiting for Łukasz's acceptance of the closing. Branch `slice/02p-canvas-performance`, pull request #6.

## Decisions during the slice

Łukasz's answers at step 0 (7 October 2026):

1. **AD-24 rule 3** (“all mapping lines in one SVG layer”) changes in step 2, in the same commits as the canvas line
   layer, so the code never contradicts AD-24. The reference-laptop sentence changes at step 5.
2. **Test hook flag:** an environment variable set only by the e2e dev server and the measurement build; a normal
   production build does not expose the hook (as AD-29 does for the local adapter).
3. **Different “drawn” signals on the two A/B sides are accepted.** S1A-14 and C-08 decide that every line is drawn by
   counting the SVG line elements on `slice-02a`; once the lines are on a canvas, this branch uses the test hook. Both
   mean “every line drawn”.
4. **In scope as well** (what the lines do today, from `canvas.css`): 45 % for a line whose row end is hidden, thickening
   under the mouse, colours from CSS variables following the theme and the canvas background, other lines at 12 % on a
   selection. Alpha inside the canvas does not break AD-24's no-opacity rule, which is about DOM elements.
5. **Redrawing on pan and zoom** is measured in step 1; if it costs, options (e.g. a canvas larger than the view with a
   margin, moved by a transform and redrawn when the pan stops) are reported before choosing.
6. **Lasso marks:** S2P-06 applies whichever layer is the cost; if it is `SelectionOverlay`, it is in scope.
7. **The e2e tests that read lines from SVG today** (the list for item 5): line ends S1A-04, S1A-05, S1B-08, S2A-03;
   line elements, ids or styles S1A-01, S1A-07, S1A-09, S1A-10, S1A-14, S1B-01, S1B-04, S2A-11, S2A-13; ƒ node and
   relationship ends S1A-02, S1A-06, S1A-08; a point on a line S1B-07, S1B-13, S1B-14; the hover layer and the fade
   S1B-10; the helpers `lineEnds`, `mappingLine` (slice 1a) and `pointOnLine` (slice 1b).

## Step 0 – Baseline (item 1)

### The command

`npm run measure:canvas` (`scripts/measure-canvas.ts`): this branch and the tag `slice-02a` in turns, in the production
measurement build, three rounds by default, the starting side changing each round. Each side runs its own S1A-14
(pan and zoom with grid Dots, C-08), S1B-09 (C-09), S1B-10 (C-10) and S2A-14 (single-card drag, group drag, lasso marks).
Results per side and round, the conditions before, after and after every side, and one summary table go to
`.data/measure/<sitting>/`. `--drop <round>` leaves a disturbed round out of the summary, `--add-round <sitting>`
measures its replacement, `--prepare-only` checks the reference worktree (`../infomapper-ab-main`) and both builds.

### Conditions, 7 October 2026, 20:50–23:00

Same laptop (i7-8550U, Intel UHD 620, 1536 × 864, DPR 1), Google Chrome 154 headed. Prepared by Łukasz: mains (96 %),
Windows power mode “Best performance” plugged in and on battery (checked in the registry), screen and sleep “Never”,
Spotify, Chrome, Teams and Outlook closed, OneDrive paused, no dev server. Windows open: the Claude app, Notepad++.

### Baseline sitting: `slice-02a` against itself

At step 0 this branch's application code is the same as `slice-02a` (only the PRD and the measuring scripts differ), so
the sitting measures `slice-02a` against itself: any difference between the two columns is the method's spread.

**Dropped round.** After round 2's `slice-02a` side, Explorer was using 7.0 % of all cores (more than half a core) and
that side had the sitting's worst C-09 and C-10, so round 2 was left out and replaced by round 4. After round 4's
`slice-02a` side Explorer showed 3.4 %; its figures are mixed (the best pan and zoom, C-10 and lasso of the sitting, the
worst C-08 and C-09), so it was kept and is flagged here. Explorer appeared only after `slice-02a` sides, which run in the
sibling worktree (twice in four rounds); nothing else used more than 0.5 % after any side.

| Figure | Bar | `slice-02a`: median (min–max) | Same code, other side: median (min–max) | Change | Result |
| --- | --- | --- | --- | --- | --- |
| Pan and zoom at the overview (S1A-14, grid Dots) | ≥ 50 fps, ≥ −5 % vs reference | 53.5 (51.8–54.4) | 52.9 (47.6–58.2) | −1.1 % | met |
| – frames over 50 ms | 0 | 0 (0–0) | 0 (0–4) | – | met |
| Pan and zoom at 100 %, dense area (S1A-14) | ≥ 50 fps, ≥ −5 % vs reference | 44.7 (43.7–48.0) | 46.2 (45.5–46.3) | +3.4 % | not met |
| – frames over 50 ms | 0 | 4 (4–6) | 6 (6–6) | – | not met |
| Initial render (C-08), median of 5 | ≤ 1500 ms | 1771 (1605–1981) | 1745 (1590–1902) | −1.5 % | not met |
| Card resize, 200-row card at 50 % (C-09) | ≥ 45 fps | 24.6 (20.6–25.1) | 26.2 (22.5–30.9) | +6.5 % | not met |
| Hover to the next frame, median of 40 (C-10) | ≤ 100 ms | 174 (170–177) | 159 (151–183) | −9.0 % | not met |
| Single-card drag at 50 % | ≥ 45 fps | 13.2 (12.2–13.9) | 12.5 (10.6–14.2) | −5.3 % | not met |
| Group drag, 31 cards at 50 % | ≥ 45 fps | 28.1 (27.4–29.6) | 29.0 (28.3–29.2) | +3.2 % | not met |
| Lasso marks around the visible cards, median of 20 | ≤ 100 ms | 138 (115–143) | 146 (118–166) | +5.4 % | not met |

Every value of every round, round 2 included, is in the sitting's folder `.data/measure/2026-10-07-18-49/` (not in the
repository). Per round, `slice-02a` / other side: pan overview 51.8, 53.5, 54.4 / 52.9, 58.2, 47.6; pan 100 % 43.7, 44.7,
48.0 / 45.5, 46.3, 46.2; C-08 1771, 1605, 1981 / 1590, 1745, 1902 ms; C-09 24.6, 25.1, 20.6 / 26.2, 22.5, 30.9; C-10 174,
177, 170 / 183, 159, 151 ms; single drag 12.2, 13.9, 13.2 / 10.6, 12.5, 14.2; group drag 28.1, 27.4, 29.6 / 29.0, 29.2,
28.3; lasso 143, 138, 115 / 146, 166, 118 ms (rounds 1, 3, 4).

### The method's spread

- **Between the two sides** (same code): pan and zoom and the initial render agree within about 4 %; the group drag
  within about 3 %; C-09, C-10, the single-card drag and the lasso marks differ by 5–9 %.
- **Within one side** across the rounds: pan and zoom ±5–10 %, C-08 ±10 %, C-09 20.6–30.9 fps, C-10 151–183 ms,
  single-card drag 10.6–14.2 fps, lasso 115–166 ms.
- **So with three rounds** a change of the interactive figures (C-09, C-10, drags, lasso) can only be told from the noise
  when it is larger than about 10 %; for pan and zoom the 5 % regression bar is about at the method's limit (the two
  identical sides differed by up to 3.4 %). The changes the slice is after are far larger (C-10 from about 170 ms to at
  most 100 ms, C-09 from about 25 to 45 fps), so they will show; for the pan-and-zoom regression check more rounds
  (`--rounds 5`) would make it firmer.
- **Absolute numbers** today in production: pan and zoom 53.5 / 44.7 fps (slice 2a's step 5 production A/B: 57.3 / 51.8
  for `main`), C-08 1.6–2.0 s (slice 2a step 3b: 2.1 s), C-10 about 170 ms (slice 2a diagnosis: 145–153 ms), lasso
  about 140 ms (139 ms). Today's sitting ran with grid Dots and all checks of S1A-14; pan and zoom at 100 % are lower
  than in slice 2a's A/B, where a shorter spec ran without the other measurements in between.

## Step 1 – Line layer trial

### What was built

A trial renderer, `src/canvas/CanvasLineLayer.tsx`, behind the measurement-only switch `?diag=canvaslines` (honoured
only by the measurement build, like `nolines` and `blocks`). It draws every mapping and relationship line on one
`<canvas>` the size of the visible area, redrawn on every pan, zoom or change, from the same geometry as the SVG layer
(mapping geometry moved to `src/canvas/line-geometry.ts`): statuses, colours from the CSS variables, end dots above
40 %, ƒ nodes, crow's foot and UML ends, labels, 45 % for a hidden row end, the 12 % fade on a selection, the hovered
row's lines drawn again. No interaction. The line shapes (`Path2D`) are kept between frames and rebuilt only when cards,
lines or the notation change. S1A-14 counts drawn lines from the SVG elements or from the renderer's count (decision 3).

The measuring command now waits before each side until the machine is quiet: total processor use below 2 % for 30 s
(at most 3 minutes), leaving out the Claude app and the command's own programs (`claude`, `node`, `bash`, `sh`, `cmd`,
`conhost`, `powershell`, `git`), as Łukasz asked on 7 October; the waits and the names left out are recorded.

### Conditions, 7 October 2026, from about 22:15 (local time)

As at step 0, prepared by Łukasz: mains, “Best performance” plugged in and on battery, Spotify, Chrome, Teams and
Outlook closed (at the first check Chrome and Teams were still running; Łukasz closed them before anything was
measured), OneDrive paused, no dev server. 19 idle `msedgewebview2` processes stayed (no measurable processor use).
Every side started after a quiet wait of 31–71 s; nothing waited until the time-out.

### The trial against `slice-02a`'s SVG lines

`npm run measure:canvas -- --rounds 5 --branch-diag canvaslines` (sitting `2026-10-07-20-17`, UTC):

| Figure | Bar | `slice-02a` (SVG): median (min–max) | Canvas renderer: median (min–max) | Change | Result |
| --- | --- | --- | --- | --- | --- |
| Pan and zoom at the overview | ≥ 50 fps, ≥ −5 % vs reference | 56.5 (55.1–58.7) | **20.8 (18.8–24.5)** | −63.2 % | not met |
| – frames over 50 ms | 0 | 0 (0–0) | 67 (43–77) | – | not met |
| Pan and zoom at 100 %, dense area | ≥ 50 fps, ≥ −5 % vs reference | 49.0 (40.6–52.5) | **22.2 (20.7–22.8)** | −54.7 % | not met |
| – frames over 50 ms | 0 | 5 (4–7) | 60 (54–80) | – | not met |
| Initial render (C-08), median of 5 | ≤ 1500 ms | 1659 (1539–1859) | 1875 (1530–1949) | +13.0 % | not met |
| Card resize (C-09) | ≥ 45 fps | 28.1 (26.8–31.2) | 31.5 (22.9–32.7) | +12.1 % | not met |
| Hover to the next frame (C-10) | ≤ 100 ms | 148 (147–155) | **63 (62–92)** | −57.3 % | **met** |
| Single-card drag | ≥ 45 fps | 12.5 (11.3–12.8) | 14.2 (13.9–14.7) | +13.6 % | not met |
| Group drag, 31 cards | ≥ 45 fps | 28.8 (26.1–30.2) | 25.3 (23.9–26.3) | −12.2 % | not met |
| Lasso marks | ≤ 100 ms | 121 (113–129) | **29 (27–34)** | −75.8 % | **met** |

Flagged, not dropped: round 4's `slice-02a` side gave 40.6 fps at 100 % (47.3–52.5 in the other rounds); its quiet wait
passed (71 s) and dropping it would change no conclusion.

### The lasso marks: line layer or `SelectionOverlay`?

S2A-14's lasso in this branch's measurement build, three variants in turns, three rounds, each after a quiet wait
(`.data/measure/lasso-step1.json`): SVG line layer **133, 111, 133 ms**; no line layer at all (`DIAG=nolines`) **29, 27,
32 ms**; canvas renderer **30, 27, 30 ms**. The marks themselves (`SelectionOverlay`) take under 35 ms; the rest is the
SVG line layer repainting. The canvas renderer removes that cost entirely.

### Reading

- **Hover (C-10) and lasso marks are solved by the canvas line layer**: 63 ms and 29 ms against 100 ms.
- **Pan and zoom collapse** (about 21 fps against 49–56): redrawing 340 lines on every frame costs more than the SVG
  layer, which the browser only moves and scales. This needs a decision before step 2 (options in the report).
- Drags and resize change little (single-card drag +14 %, group drag −12 %, C-09 +12 %, all near the method's spread):
  their cost is the cards' rows, as the slice 2a diagnosis said (step 3).

## Step 1b – Profile and option C (8 October 2026)

Bounded to one session, no long sitting; probes in the production measurement build, headed Chrome, at the overview of
“Performance test” with the trial renderer, 4 s of the spike's pan-and-zoom steps each.

**The profile.** One redraw per animation frame (0.96 redraws per frame); the redraw's script takes **2.7 ms** (median,
95th percentile 4.4 ms); no line shape is rebuilt while panning; the main thread is idle about 60 % of the time. None of
the suspects was there: no CSS variables read per frame, no `measureText`, no style change per line, no extra redraws,
no React or store work. Canvas 2D only records the drawing in script; the GPU rasterises it afterwards, and that is the
cost: switching one kind of drawing off at a time gave 31 fps with everything, 36 without dashes, 30 without texts, 33
without fills and texts, and **56 fps without strokes**. `chrome://gpu` reports canvas and rasterization as hardware
accelerated. So the frame time is the Intel UHD 620 rasterising **340 antialiased, partly dashed curves on every frame**;
the SVG layer is rasterised once and then only moved by the compositor.

**Option C** (no change to the look): lines of one colour, dash, width and alpha drawn with one stroke (about 10 instead
of about 400), circles of one style with one fill, lines outside the view skipped, colours read once and again only on
a theme or look change, label widths computed. Probe: **28 fps at the overview and 25 at 100 %** (31 and 26 before):
fewer draw calls do not reduce the raster work.

## Decision

The gate (canvas pan and zoom within about 5 % of the SVG side) fails clearly; Łukasz decided on 8 October 2026 not to
run the quick A/B round and to close the slice without changing the renderer. The trial renderer and option C were
tagged `perf/canvas-lines-trial` (commit 3e85355) and removed from the code. AD-24 now names the reference machine and
records that the canvas line layer loses pan and zoom on it, so SVG stays (changed in this pull request, with Łukasz's
agreement). Card painting (step 3) and the initial render (step 4) are deferred to before the database slice
(`docs/known-limitations.md`, with the 2a diagnosis, these findings and the untested overlay idea). After this slice the
work returns to features (slice 2b, frames).

### What stays in the code

- `npm run measure:canvas` (`scripts/measure-canvas.ts`): every canvas figure in the production measuring build, A/B
  against a reference (default `slice-02a`), with the quiet wait (`scripts/measure-conditions.ts`), `--drop`,
  `--add-round`, `--quick`, `--prepare-only`, `--branch-diag`.
- The shared line geometry, `src/canvas/line-geometry.ts`, used by the SVG line layer.
- The diagnosis switches `DIAG=nolines` and `DIAG=blocks` (measurement build only).
- Not kept: the test hook for the drawn line count (only the canvas renderer used it); S1A-14 counts SVG line elements
  as before.

## Criteria

| ID | Result | Reason |
| --- | --- | --- |
| S2P-01 | **met** | `npm run measure:canvas` measures every figure in the production measuring build, A/B against `slice-02a`, and writes one table with median, spread, bar and result (step 0). |
| S2P-02 | **dropped** | The renderer did not change: the lines are the same SVG lines as in `slice-02a`; there is nothing to compare. |
| S2P-03 | **met in part, rest dropped** | Every existing e2e test passes (one full run, below); the line tests still read SVG elements, because SVG stays; the test hook was only needed for the canvas renderer. |
| S2P-04 | **dropped** | Line interaction is unchanged (SVG); the existing e2e tests cover it. |
| S2P-05 | **not met, deferred** | C-10 about 174 ms in production (baseline). The canvas trial met it (63 ms) but lost pan and zoom; deferred to before the database slice, with the untested overlay idea. |
| S2P-06 | **not met, deferred** | Lasso marks about 138 ms (baseline); their cost is the SVG line layer (27–32 ms without it). Deferred, as S2P-05. |
| S2P-07 | **not met, deferred** | C-09 about 25 fps; card painting (step 3) deferred to before the database slice. |
| S2P-08 | **not met, deferred** | Single-card drag about 13 fps, group drag about 28 fps; deferred with step 3. |
| S2P-09 | **met for pan and zoom; initial render recorded without breakdown** | The renderer is `slice-02a`'s, and the baseline shows the two sides within the method's spread (−1.1 % / +3.4 %). S1A-14's absolute bar is recorded: 53.5 fps with no frame over 50 ms at the overview, 44.7 fps with 4–6 frames over 50 ms at 100 % (not met). Initial render 1.6–2.0 s; its breakdown (step 4) was dropped. |
| S2P-10 | **met** | This file records the numbers, what was tried (canvas renderer, option C) and Łukasz's decision for every criterion not met: deferred to before the database slice. |
| S2P-11 | **met, with one full e2e run** | AD-24 and `docs/known-limitations.md` are updated; CI passes; Łukasz asked for one full e2e run with no dev server instead of three in a row. |

