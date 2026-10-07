# Slice 2p – Acceptance

Status: in progress (step 0 done). Branch `slice/02p-canvas-performance`, pull request #6. Written step by step; the
criteria table, the final measurements and the three runs in a row follow at step 5.

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
