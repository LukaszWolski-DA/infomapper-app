# Known limitations

Things we know are not fully right yet, accepted for now, with what has to happen later.

## Local data adapter (AD-29)

### "At least one canvas" can race (slice 0)

Removing a canvas from a project is refused when the canvas would belong to no project, or the project would have no
canvas left (D-28). The command checks this against links read just before the write; the local adapter then
re-checks versions, keys and references inside its serialised write, but not this count. Two removals at the same
moment can therefore both pass the check and leave a canvas or project without its last link.

- **Accepted** in the local adapter: it is development only and has one user at a time in practice.
- **The database slice (last, AD-31):** check this rule in the same transaction as the write (e.g. lock the project's and the canvas's
  `project_canvas` rows, count, then delete), so concurrent removals cannot both succeed.

### A late fresh page could show an older state (slice 3a step 5; fixed for notes, frames and cards in slice 3b)

After a write the canvas takes the server's fresh page. A page started by one write can read the data before a later
write lands and arrive after it. Slice 3a found it for notes (a note created meanwhile vanished); slice 3b's step 0
found the same for frames and cards: moves and resizes do not refresh the page, so a card or frame moved just after a
label write jumped back to its old place and the canvas sent the old version with its next move, which was refused.
Since slice 3b, step 1, notes, frames and cards take a fresh page through one rule (`mergeFresh` in
`src/canvas/fresh.ts`): what still has writes on its way or is newer here stays, rows deleted here stay gone, rows
created after the page read the data (`readAt`) stay, and the versions the canvas sends only grow.

- **What is left:** the model's content on cards (names, rows, label marks) and everything else on the page is taken
  as it comes. A late page can show it older for a moment; a newer page follows, because every model write refreshes
  the page.
- **Candidate for the database slice (last, AD-31): a store revision.** Each page and each write result would carry the
  store's revision (a number that grows with every change group), and the canvas would ignore a page older than the
  newest revision it has seen. That covers everything on the page in one place, not only rows with a version, and
  several people working at once make late pages more likely. Not built now: the local adapter has one person at a
  time, and the per-row rule above covers what can stay wrong.

## Canvas performance (slice 1a)

### Where the canvas stands after slice 4b-2 (20 October 2026)

Slice 4b-2's closing sitting (`2026-10-20-12-00`; production measurement build; three rounds A/B against `slice-04b1`,
no round dropped; to the screen and as presented frames, traced; `docs/prd/slice-04b2-acceptance.md`). Each pan now
starts from a freshly opened view, and drags are driven in the page (AD-24, “Measuring”). The entries below this one are
kept as they were measured.

| Figure | Bar | Now | State |
| --- | --- | --- | --- |
| Pan and zoom with 12 requirement cards and 126 trace lines (S4B2-10) | ≥ −5 % against the same view without them | 30 % −0.4 %, dense −0.6 %, collapsed −0.3 % | met |
| Pan and zoom without requirement cards (S4B2-14) | ≥ −5 % against `slice-04b1` | −0.9 / +1.0 / +0.5 / −0.2 % | met |
| Pan and zoom, 100 % dense area | ≥ 50 fps | 49.4 presented (`slice-04b1` 48.9) | **fps confirmed against `slice-04b1`** (S4B1-12): the markers' cost is gone; the absolute 50 fps at 100 % stays with S1A-14's entry below (partly met, the database slice) |
| Pan and zoom with Focus on (S4B2-11, S4B1-11) | within 5 % of Focus off | −1.4 to +2.3 % at 30 % and 100 %, expanded and collapsed | **met** (S4B1-11 closed) |
| Focus switching with requirement cards lit (S4B2-12) | ≤ 100 ms | 17–71 ms to the screen (p95 at most 94) | met |
| Selecting a requirement card (S4B2-12) | ≤ 100 ms | 44–73 ms (p95 116–117: the main thread) | met on the median |
| The drop target while dragging (S4B2-12) | ≤ 100 ms | 12–22 ms | met |
| Dragging a requirement card (S4B2-13) | within the entity drag's spread or above | 11.5 against 9.7 presented fps at 100 %, 26.5 against 24.0 at 30 % | met |
| C-10 hover / lasso marks | ≤ 100 ms | 19 / 40 ms to the screen | met |
| C-08 initial render | ≤ 1,500 ms to the stable frame | 1,350–1,367 ms; last present 1,509 ms (recorded) | met |
| Drawing layers (S4B2-15) | not growing with requirement cards | 47 / 30 with 0 and 12 cards, and with cards over a frame | met |

### Where the canvas stands after slice 4b-1 (17 October 2026)

Slice 4b-1's closing sitting (`2026-10-17-15-39`, `-16-44`, `-17-04`; production measurement build; three rounds A/B
against `slice-04p`; to the screen and as presented frames, traced; `docs/prd/slice-04b1-acceptance.md`). The method is
the entry “How canvas figures are measured since slice 4b-1”. The entries below this one are kept as they were measured.

| Figure | Bar | Now | State |
| --- | --- | --- | --- |
| Pan and zoom, overview | ≥ 50 fps; ≥ −5 % | 58.9 presented, 59.5 rAF; +0.3 % | met |
| Pan and zoom, 100 % dense area | ≥ 50 fps; ≥ −5 % | 43.2 presented, 47.5 rAF; −8.7 % | **met, layers confirmed; fps confirmed in slice 4b-2's sitting** (49.4 presented, +1.0 % against `slice-04b1`; above): the cause was the requirement markers, two compositing layers each (+16 in this view); fixed, the layers are `slice-04p`'s again (47) |
| Pan and zoom, frames collapsed | ≥ 50 fps; ≥ −5 % | 59.1–59.4 presented; 0.0 % | met |
| C-08 initial render | ≤ 1,500 ms to the stable frame | 1,382 ms (untraced); **to its last present 1,462 ms** (traced; two of five loads over 1,500) | **met** on the stable frame; the last present is recorded beside it. Redefining the bar: the performance review before the database slice (Łukasz) |
| C-10 hover | ≤ 100 ms | 23 ms to the screen | met |
| Lasso marks | ≤ 100 ms | 42 ms to the screen (p95 48) | met |
| Coverage colours (S4B1-09) | ≤ 100 ms | 31–77 ms to the screen | met |
| Focus switching (S4B1-10) | ≤ 100 ms | 11–88 ms to the screen (p95 at most 126) | met |
| Pan and zoom with Focus on (S4B1-11) | ≥ −5 % vs Focus off | 100 %: +5 to +15 %; **30 %: −40 % expanded, −22 % collapsed** | **partly met** (Łukasz; below); **closed in slice 4b-2**: met, −1.4 to +2.3 % (above) |

### Where the canvas stands after slice 4p (15 October 2026)

Slice 4p's final sitting (`2026-10-15-09-36`; production measurement build; Chrome 155; three rounds A/B against
`slice-04a`, untraced; `docs/prd/slice-04p-acceptance.md`). The entries below this one are kept as they were measured.

| Figure | Bar | Now | State |
| --- | --- | --- | --- |
| Pan and zoom, overview | ≥ 50 fps, none over 50 ms | 59.7 fps, 0 | met |
| Pan and zoom, 100 % dense area | ≥ 50 fps, none over 50 ms | 52.1 fps, 7–9 frames over 50 ms | **partly met** (the frames over 50 ms, as on `slice-04a`: 4–12) |
| C-08 initial render | ≤ 1,500 ms | 1,432 ms (untraced) | **met** |
| C-09 card resize | ≥ 45 fps | 36.7 fps (+1.9 % A/B, no regression) | **partly met** against its bar (card rows; needs a decision on the card's look) |
| C-10 hover | ≤ 100 ms | 18 ms | **met** (slice 4p's overlay, AD-24) |
| Lasso marks | ≤ 100 ms | 23 ms | **met** |
| Single-card and group drags | ≥ 45 fps | 11 and 32 fps | **partly met** (card rows, as C-09) |
| Fading, switching (S4P-02) | ≤ 100 ms | 15–33 ms, except the 30 % view with frames expanded: see below | **partly met** (Łukasz, 15 October) |
| Fading, pan and zoom on vs off (S4P-03) | ≥ −5 % | −4.9 to +5.8 % in all 14 cells | **met** |

**Corrections after slice 4b-1, step 0** (the table above stays as 4p measured it; the figures to the screen are from
step 0's settled sitting `sitting-2026-10-15-16-02`, traced, `docs/perf/04b1-step0-switch-trace.md`):
- **S4P-02 missed to the screen** at 30 % and 100 % with frames expanded and at 30 % collapsed: the large lens 436 / 341 ms
  (on / off) at 30 % expanded, Focus 285 / 237 ms, the large lens 160 / 146 ms at 100 % expanded and 190 / 153 ms at
  30 % collapsed. In the page these read 15–33 ms: the GPU's raster came after the page's timer had stopped.
- **S4P-03, pan and zoom, C-09 and the drags were measured as rAF intervals.** Whether the screen showed as many
  frames is unverified (“presented frames” in the method entry below).
- **C-10 holds to the screen:** 20 ms on, 16 ms off. **The lasso marks hold:** 43 ms (p95 51); the in-page figure is
  about 20 ms low.
- **C-08 was met in the page,** at a rAF before the last raster; its last present is not included (C-08 entry below).

The figures after slice 4b-1, measured to the screen in its closing sitting, are in the entry above this one.

### Fading: F1's slow switches, and F4 instead (slice 4p; slice 4b-1)

**Slice 4p's F1** (one veil in the canvas layer, the lit cards lifted by a stylesheet rule) switched in 15–33 ms in the
page, except at 30 % with frames expanded on “Performance test”, where whole runs took 200–600 ms per switch (bimodal).
4p's hypothesis was a full GPU raster of the canvas's big layer.

**Slice 4b-1's step 0 traced it** (`docs/perf/04b1-step0-switch-trace.md`):
- **The lift rule is the cost,** not the veil. Changing the z-index of about half the cards changes the big layer's
  paint order, and every visible tile is rastered again: about 540 ms for the rule alone, 13 ms for the veil alone.
- **It happens on every switch in this view,** not on some. The bimodal mode was the in-page timer: the raster fell
  either before the timer stopped (slow) or in the untimed wait after it (fast).
- **To the screen:** the large lens 436 ms on, Focus 285 ms on; F4 (the veil with holes on a layer of its own) 86 and
  44 ms.

**Slice 4b-1 builds on F4** (Łukasz, 15 October 2026; F1 and its lift rule removed in step 3). Its open point:
- **Pan with Focus on at 30 %, frames expanded,** smoked at 20–32 presented fps against 46.5 with Focus off (step 3).
- **Step 3's diagnosis:** the veil's own layer (2,195 Mpx) and a layer of 22–31 Mpx under the lit lines.
- **Trial candidates,** if the closing sitting confirms the miss: T1 (a smaller veil), T2 (the lit lines inside the
  veil's SVG), T3 (the lit lines and rows in the overlay's own layer) (`docs/prd/slice-04b1-acceptance.md`).

**The closing sitting** (slice 4b-1, 17 October 2026):
- **Switching meets the bar:** 11–88 ms to the screen; the large set at 30 % expanded has p95 126 ms.
- **Pan and zoom with Focus on at 30 % do not:** −40 % presented frames with frames expanded, −22 % collapsed. The page
  keeps its pace (rAF −1 to −8 %), but the presents stall up to 0.77 s about 20 times per 10 s pan: compositing and GPU
  raster. At 100 %, Focus on is faster than off.
- **Partly met** (Łukasz, 17 October 2026). **T1 applied in slice 4b-1:** the veil reaches one pane at the minimum zoom
  beyond the content instead of 20,000 px. Its layer fell from 2,195 to 543 Mpx (LayerTree, no timing), and a test
  checks that its edge never shows while any of the content is in view (S4B1-07).
- **Later: T2 and T3 in slice 4b-2,** designed together with its dashed trace lines; 4b-2's sitting measures pan with
  Focus on.
- **Slice 4b-2:** T3 applied (the veil paints into the overlay's layer; Focus adds one drawing layer instead of two), T2
  dropped. **A caveat on the 30 % figures above,** found in 4b-2's step 8: S4P-fading measured its traced pan with fading
  on right after the untraced one, without opening the view again. The spike's 10 s driver ends on a zoom-in segment
  (30 % becomes about 37 %), so that pan ran from 37 % to above 40 %, where cards draw their rows, while the pan with
  fading off started at 30 %. Part of the −22 to −40 % is likely that, not Focus. 4b-2's S4B2-11 opens the view again
  before every pan; its sitting gives the figures.
- **Closed in slice 4b-2's sitting** (20 October 2026): with T3 and every pan from a freshly opened view, Focus on is
  within −1.4 to +2.3 % of off at 30 % and 100 %, frames expanded and collapsed (S4B2-11). How much of 4b-1's −40 % was
  the drift and how much T3 removed was left unmeasured (Łukasz).

### Focus's lit lines stayed in place after a drag (slice 4b-1; fixed in slice 4b-2)

With Focus on, the lit relationship, mapping and bundle lines drawn again above the veil were memoised on an empty
signature: after a card was dragged they kept their old place while the holes followed. Found in the browser in slice
4b-2's step 6 and fixed there (`LitLines` carries the line layer's signatures); S4B2-07 checks that every lit line lies
where the line layer draws it after a drag.

### C-08: what the first render waits for (slice 4p)

C-08 is met untraced (1,432 ms). The traced diagnosis (five loads, `scripts/c08-waiting.ts`) splits the first render:
- **the first byte:** about 230–300 ms, the server rendering the page with the local adapter;
- **the main thread's own work:** about 550 ms (script about 340, style and layout about 145, paint and layerize about
  30);
- **after the document**, about 1.04 s to the stable frame:
  - the network about 30–130 ms, only Next.js prefetching the workspace and project links;
  - the GPU's raster about 130 ms;
  - **the main thread idle for about 0.7 s**, with nothing in the trace filling it. **Corrected in slice 4b-1:** an
    artefact (below).

- **A lead from the code** (15 October, no measurement): the idle time is nearly the same in every load (709–748 ms),
  which looks like a fixed wait, not work. There is no timer, debounce, animation or transition of about 300 ms or more
  on the path from the page's load to the canvas being ready:
  - the first view is set once without animation (`ModelCanvas`, `setViewport` with no `duration`), and `<ReactFlow>`
    gets no `fitView` or `onInit`;
  - the 250 ms durations belong to the Fit button, the go-to links and a frame's fit, all user actions;
  - the other timers (the moved row's 700 ms flash, toasts, the delete confirmation, the right-drag's click swallow, the
    local adapter's write retry) are not on the load path;
  - the fonts come from `next/font/google` with its default `display: swap`, and nothing waits for them;
  - the canvas is `visibility: hidden` only until React Flow's observer reports the pane's size.

  So the wait is most likely outside our code: how React hydrates the streamed page (the 246 KiB document carries the
  React payload inline; hydration may wait for the stream to end and then work in yielding slices) or when Chrome
  starts drawing frames for the page. Unconfirmed.
- **Correction (slice 4b-1, step 8): the 0.7 s idle was an artefact of the anchor.** `c08-waiting.ts` placed the
  page's time origin at the trace's last `navigationStart`, which lies about 1.0–1.2 s after the real origin. Since
  slice 4b-1 the page puts a mark (`im:stable`) in the frame where it is first complete, and the script anchors on it.
  Re-run on the five traced loads of step 2's smoke (`2026-10-15-18-05`, unprepared laptop, diagnosis only), the window
  from the document's end to the stable frame (984–1,028 ms) has **the main thread busy all of it** (idle about 1 ms):
  - React's scheduled work (`MessagePort::Accept`, its scheduler's tasks): about 560 ms;
  - frames (`BeginMainFrame`): about 145 ms;
  - incoming messages: about 165 ms;
  - deferred scripts: about 70 ms; parsing about 40 ms.

  So the first render waits for work, mostly React's, not for a fixed delay. The lead from the code above is moot.
  The four older trace folders have no mark and keep the shifted window.
- **Later:** if C-08 needs work (for example with the database's own latency), profile React's work in that window
  (hydration, the canvas's first renders). In the database slice (AD-31), add Server-Timing to the canvas page.

### How canvas figures are measured since slice 4b-1

Slice 4b-1, step 0 found that the in-page times missed the GPU's work. Since then (`e2e/measure/`,
`scripts/lib/to-screen.ts`; CLAUDE.md):
- **Interactions to the screen:** from the input to the first GPU present after the compositor activates the commit it
  caused, traced. The split is main thread, GPU raster and the rest.
- **From a settled screen:** a 1.2 s pause before each switch. A switch counts only if no raster is running at its start
  and the last raster ended at least 50 ms earlier or was presented. A switch that fails the check is reported, not
  counted.
- **Pan and zoom as presented frames:** the frames the GPU presented during the pan, traced. One untraced pan per case
  keeps the trace's own cost known, and rAF intervals stay as a breakdown.
- **C-08 to its last present:** the first present after the stable frame, anchored on the page's `im:stable` mark.
- **Medians with p95 and max,** and the number of switches that failed the settled check.

The entries above slice 4b-1 report in-page and rAF figures as they were measured.

### S1A-14 is only partly met, and measured on the dev server

On the “Performance test” workspace (`seed:large`), pan and zoom at the overview mostly reach the bar, but at 100% the
canvas runs at about 42–53 fps with 1–8 frames over 50 ms (bar: 50 fps, none over 50 ms), and the initial render takes
about 4–7 s (bar: 1.5 s). The numbers and what was tried are in
[slice-01a-acceptance.md](prd/slice-01a-acceptance.md#performance-s1a-14). All of it was measured under `next dev`,
because the local data adapter refuses a production build (AD-29); the spike shows that dev mode alone doubles the
initial render.

- **Recorded** as “partly met” for slice 1a, as Łukasz asked on 4 October 2026.
- **The database slice (last, AD-31):** measure S1A-14 again in a production build (`npm run build`, `npm start`) with the same method
  (`MEASURE=1`, headed Chrome, same laptop), and decide on the card design (fewer elements per row, or detail by zoom
  level between 40% and 100%) if 100% still misses the bar.
- **Slice 1b** adds two more that are only partly met on the development laptop (S1B-09, S1B-10): card resize (C-09)
  runs at 31–36 fps with an outline while dragging (bar: 45 fps), and the hover highlight (C-10) takes about 190 ms
  (bar: 100 ms). A veil over the lines and a block view while resizing were tried and did not help: every change
  repaints the canvas's one large GPU layer. Recorded as “partly met”, as Łukasz decided.
- **The database slice (last, AD-31):** measure S1A-14, C-09 and C-10 in a production build. (Slice 2p: the reference
  machine is the development laptop in the production measuring build; the HTML canvas line layer was tried and is no
  longer the next step, see below and AD-24.)
- **Slice 2a** adds a third (S2A-14): dragging a group of 31 cards at 50 % on “Performance test” runs at about 16–19 fps
  on the dev server and 25–30 fps in the measurement-only production build (bar: 45 fps). Recorded as “partly met”, as
  Łukasz decided on 6 October 2026; lines keep following the cards (no outlines while dragging). The production build
  confirms that the cost is painting, not JavaScript: a hover's React work takes 6.7 ms there, the frame after it 166 ms.
  A short performance slice comes between slices 2a and 2b. Measured on the development laptop (i7-8550U, Intel UHD 620),
  headed Chrome 154, 1536 × 864; details in [slice-02a-acceptance.md](prd/slice-02a-acceptance.md).

  Before the speed-up of step 3b:

  | Measurement | Bar | Dev server | Production |
  | --- | --- | --- | --- |
  | Group drag, 31 cards at 50 % | ≥ 45 fps | 10.5 fps | 14.2 fps |
  | Single-card drag, same card | – | 10.0 fps | 11.8 fps |
  | C-09 card resize, 200-row card at 50 % | ≥ 45 fps | 27.6 fps | 20.3 fps |
  | C-10 hover to the next frame, median of 40 | ≤ 100 ms | 199 ms | 166 ms |

  After it (no change of behaviour):

  | Measurement | Bar | Dev server | Production |
  | --- | --- | --- | --- |
  | Group drag, 31 cards at 50 % | ≥ 45 fps | 15.8, 18.8 fps | 28.9, 29.5, 28.9, 24.7 fps |
  | Single-card drag, same card | – | 25.2, 23.4 fps | 14.8, 9.3, 12.5, 19.5 fps; 21.5 on a fresh page |

  At step 5 (7 October, the laptop prepared): group drag 22.4 fps on the dev server, 24.5 fps in production.
- **Slice 2a, lasso marks (S2A-14)**, next to C-10: the selection marks after a lasso around the whole view at the
  overview appear after 139 ms in the production measurement build (280 ms on the dev server; bar: 100 ms). Recorded as
  “partly met”, as Łukasz decided on 7 October 2026. The lasso holds the 85 of 101 cards fully inside the view: the
  tallest stick out even at the 10 % minimum zoom (criterion change confirmed). S2A-14's pan and zoom, now judged
  against `main` in the same sitting, are met in the production build (accepted; the dev server misses for one cell per
  grid).
- **Diagnosis (slice 2a, production measurement build, slice-02a-acceptance.md):** the **line layer is the cost of the
  hover** (C-10: without it about 49 ms instead of about 150 ms, with the same 5 ms of React work); the **card rows are
  the cost of resize and drag** (with every card as a block the resize C-09 runs at 57–59 fps instead of 28–32 and a
  single-card drag doubles; without lines the drags and the resize barely change).
- **Slice 2p (canvas performance, 7–8 October 2026) was closed without changing the renderer.** Its baseline (production
  measuring build, `slice-02a` against itself, `npm run measure:canvas`): pan and zoom 53.5 / 44.7 fps, initial render
  (C-08) about 1.75 s, C-09 about 25 fps, C-10 about 170 ms, single-card drag about 13 fps, group drag about 28 fps,
  lasso marks about 140 ms. A trial line renderer on an HTML canvas (tag `perf/canvas-lines-trial`) met the hover
  (63 ms) and the lasso marks (29 ms; with no line layer at all 27–32 ms, so their cost is the SVG line layer, not
  `SelectionOverlay`), but pan and zoom fell to about 21 fps against about 55 (5 rounds), and batching the strokes and
  skipping lines outside the view (about 28 fps) did not change that. The profile: about 3 ms of script per frame; the
  cost is the GPU rasterising 340 antialiased, partly dashed curves on every frame (with strokes switched off 56 fps),
  where the SVG layer is rasterised once and moved by the compositor. Details in
  [slice-02p-acceptance.md](prd/slice-02p-acceptance.md); AD-24 keeps the SVG line layer.
- **Deferred to before the database slice (AD-31), all still “partly met”:** card resize (C-09), hover (C-10), the
  single-card and group drags, the lasso marks, and the initial render (C-08). What is known: the hover and the lasso
  marks are the SVG line layer repainting; resize and drags are the cards' row elements; the initial render was not
  diagnosed (slice 2p's step 4 was dropped). **Untested idea:** put the hover and selection overlays on their own
  compositing layer, so that their changes do not repaint the line layer (the hover and the lasso marks would then cost
  what the overlays themselves cost, under 35 ms for the marks). The card rows need a decision on the card's look
  (fewer elements per row, or detail by zoom between 40 % and 100 %), measured with `DIAG=blocks` as the upper limit.

### Chrome 155 changed the starting point (slice 4p)

Slice 4p's baseline (14 October 2026, Google Chrome 155.0.8059.40, `slice-04a` against itself) gives on the same laptop:
C-10 hover 117 ms (slice 2p, Chrome 154: about 170), lasso marks 22–25 ms (about 140), C-09 about 36 fps (about 25),
C-08 about 1.45 s (about 1.75), pan and zoom at the overview 59–60 fps (53.5). The application only grew since, so the
gain is very likely the browser, not proven. Earlier slices' figures in this file are kept as measured; from slice 4p
on, only figures from the same sitting are compared (A/B against the previous tag, or fading on against off in the same
run). Details in [slice-04p-acceptance.md](prd/slice-04p-acceptance.md).

### C-10 met; the other lines do not fade on a hover (slice 4p)

Since slice 4p the hover, the row and selection marks and the lasso are drawn in an overlay on its own compositing layer
(AD-24): C-10 is **met**, 19 ms against 120 ms on `slice-04a` (sitting `trials-2026-10-14-20-04`, three rounds; slice
1b's “partly met” at about 190 ms is closed). The lasso marks were already at about 28 ms with Chrome 155 and stay
there.

What remains: on a hover the hovered lines are drawn again, stronger, above the cards, but the **other lines keep their
colour**. The prototype fades them to 12 %. Slice 4p measured a veil above the lines and below the cards, shown only
while something is hovered (the hover line fade): C-10 **228 ms** with it in the canvas layer and **247 ms** on its own
layer, against 19–26 ms without it, on every branch.

- **Rejected** by Łukasz on 15 October 2026, with these figures (`docs/prd/slice-04p-acceptance.md`, tag
  `perf/4p-trial-a`).
- **Later:** only with a way to fade lines that changes neither the canvas layer nor the cards' layering; none is
  known.
- **Trace lines too** (slice 4b-2, answer B): a requirement card's dashed trace lines fade with the other lines on a
  selection (the line layer's `dimmed` class), not on a hover; the prototype fades them on both.

### Frame cost grows with the number of elements in the viewport (slice 3a)

On every pan and zoom frame Chrome repaints and re-layers the whole viewport of the canvas; Layerize is the main cost
(about 9–11 ms of a frame at 100 % in “Performance test”), and both follow the number of elements there. Slice 3a's notes
and label marks add about 700 elements (19,613 against 18,913 in the measurement build) and cost about 3–5 % of pan and
zoom at 100 % (balanced sitting `2026-10-11-16-56`: 48.6 against 51.0 fps, 10 long frames against 6). It is the same
mechanism as slice 2c's wider frame labels. Details in [slice-03a-acceptance.md](prd/slice-03a-acceptance.md#looking-for-the-cause-11-october-after-the-confirming-rounds).

- **The attribution rests on Chrome traces** (Layerize 10.4–10.6 against 9.2 ms; with notes and marks switched off
  9.3–9.6 ms, about −3 % frames instead of −6 %). One balanced sitting with both switched off (`2026-10-11-17-14`)
  contradicted it (−6.2 %, C-08 1549 ms).
- **Done in slice 3a (option b, Łukasz):** a label mark is one element (its tag a CSS mask) and a line tag two (circle
  and path, no group, no transform): 210 fewer elements in that view (21,012 → 20,802 on the dev server). **Fewer
  elements per note, partly done:** the note icon is a CSS mask, the spacer before the ✓ is a margin, a tether has no
  group: a note has 7–8 elements at 100 % instead of 11–12, 6 below 40 % instead of 10, a tether 2 instead of 3; 108
  fewer in that view (20,802 → 20,694; at 30 %: 6,005 → 5,897). The balanced sitting after it (`2026-10-11-18-41`)
  still had 100 % at −5.3 % (49.7 against 52.5 fps, 9 long frames against 4), accepted by Łukasz as within S3A-14's bar.
  Traces after it: Layerize per frame fell a little (branch 10.48 → 10.12 ms, gap to `slice-02c` +1.22 → +0.80 ms),
  about what the element count predicts but inside the run-to-run spread (0.4–0.7 ms); the remaining excess is about
  +0.8 ms Layerize, +0.1 ms layout, +0.15 ms script per frame. So the element-count attribution is consistent with the
  traces but not proven; the performance review starts from these traces (`.data/measure/diag-3a`, `diag-3a-after`).
- **Slice 4p measured option (c), the notes on a compositing layer of their own, and rejected it** (Łukasz's rule set
  before the trace; tag `perf/4p-trial-notes`): pan and zoom at 30 % without tracing 44.5 → 45.2 fps around `ent:23` and
  43.3 → 46.7 fps on the notes, both inside the spread; tile memory +20 to +35 MiB; and it makes the notes' container a
  stacking context, so notes pinned to a lit card could no longer be lifted above the fading veil
  (`docs/prd/slice-04p-acceptance.md`). What remains is fewer elements per note, if needed. **Since slice 4b-1, step 3
  (F4):** the veil cuts a hole for every note pinned to a lit card, so those notes stay lit without being lifted; this
  point no longer stands in option (c)'s way.
- **What has to happen later (performance review before the database slice, AD-31):** measure a separate compositing
  layer for the notes (option c: their paint and Layerize no longer part of the cards'; it touches AD-24's rules on
  layers and may cost GPU memory or raster time) and, if still needed, fewer elements per note beyond slice 3a's (body,
  footer and resize edge remain), together with the “partly met” items above (C-09, C-10, dragging, lasso marks).

### Live canvases without the view-state bar (slice 3b)

**Closed in slice 6a** ([PRD](prd/slice-06a-view-state-bar.md), [acceptance](prd/slice-06a-acceptance.md)): the view-state bar starts with “Live: {name}” on a live canvas (no ×), and the
Labeled filter is neither counted as filtered nor reset by “Show all” (S6A-04, S6A-03). The text below is kept as it was
written.

The prototype shows a live canvas's “Live: {name}” as the first chip of the view-state bar (not removable, not part of
“Show all”), and a live canvas's Labeled row filter is not counted as “filtered” there and is left by “Show all”. The
application has no view-state bar yet (D-39), so neither exists; a live canvas shows its tag icon on the tab and the
tile and its box in the overview.

- **Accepted** by Łukasz after slice 3b's step 3.
- **Later:** with the view-state bar (slice 6, D-39): the “Live: {name}” chip, and the Labeled filter neither counted as
  “filtered” nor reset by “Show all”.

### Focus without the view-state bar (slice 4b-1)

**Closed in slice 6a** ([PRD](prd/slice-06a-view-state-bar.md), [acceptance](prd/slice-06a-acceptance.md)): “Show all” turns Focus off, and the “Focus” chip moved from the status bar to the
view-state bar (S6A-03, S6A-07). The text below is kept as it was written.

PRD item 22 turns Focus off with “Show everything” (the view reset). In the prototype that is the view-state bar's
“Show all” (D-39), and the application has no view-state bar yet. Focus turns off from its toolbar button, its chip,
the card and row menus, a canvas switch and a reload, but there is no view reset.

The “Focus” chip sits in the status bar for now (PRD item 20).

- **Accepted** by Łukasz after slice 4b-1, step 7, as a deliberate gap.
- **Later:** slice 6, with the view-state bar (D-39): “Show all” turns Focus off, and the “Focus” chip moves from the
  status bar to the view-state bar.

### Requirement cards are not on the canvas yet (slice 4a; slice 4b-1)

**Closed in slice 4b-2** ([PRD](prd/slice-04b2-requirement-cards.md)): requirement cards with dashed trace lines,
placed from the requirement's panel and the element panels, dragged from the left panel onto an element to link it,
lit or faded by Focus (D-32, D-34, D-41). The text below is kept as it was written.

Slice 4a brought requirements everywhere but the canvas. **Slice 4b-1** adds:
- markers on entity and table cards;
- coverage colours when a requirement is selected: rows and headers, and below 40 % a dot at the header's right end
  and on a collapsed block's rows (item 19, Łukasz's choice);
- Focus on a requirement (D-32).

Still missing: requirement cards, trace lines and dragging a requirement onto an element. The Requirements tab's “Only
on this canvas” shows none, and linking is done from the element panels.

- **Accepted** in slice 4a's PRD (section 6) and slice 4b-1's. **Later:** slice 4b-2 (requirement cards).

### Notes stay plain text (slice 4a)

Entity and attribute definitions and requirement descriptions are rich text since slice 4a; notes are not (D-42 not
complete): their text is drawn on the canvas, and the canvas work waits for the performance review.

- **Accepted** in slice 4a's PRD (section 6). **Later:** after the performance review.

### An Agreed requirement stays Agreed when edited (slice 4a)

Four-eyes makes setting Agreed an approval (AD-06), but changing an Agreed requirement's content does not send it back
to Draft (mappings go back to review, D-51).

- **Accepted** in slice 4a's PRD (item 13). **Later:** requirements step 2 (`ideas.md`).

### The requirement index is rebuilt on every write (slice 4a, step 3)

The requirement index (scope, coverage, children, and each element's direct and indirect requirements;
`src/domain/model/requirement-index.ts`) is built from scratch once per data version: once per page on the server for
the left panel, the project home and the status bar, and once in the browser for the panels whenever the requirements,
their links or the model change, which is after every write. On a synthetic model of 500 requirements, 5,000
attributes, 2,000 mappings and 3,000 links one build takes a median of 12.7 ms in the browser (measurement build, Chrome
155, the development laptop; three rounds of 30 builds: medians 12.6–12.8 ms, slowest 18.6–20.6 ms; slice 4p, S4P-11).

- **Fine for now, decided in slice 4p** (Łukasz's rule): an incremental rebuild only if the median is above 50 ms or the
  p95 above 100 ms. It is neither, so slice 4b keeps the full rebuild. The demo data builds in under 0.2 ms and
  “Performance test” in under 1.2 ms.
- **Measure it again** if a real workspace grows well beyond the synthetic model, or if 4b's lens reads it more often
  than once per data version.

## Screens compared with the prototype (slice 4a, step 5)

Found while fixing the workspace Overview's hard-coded “0 of 0 requirements covered” (slice 4a, step 5).

### The project home has no left panel or inspector

The prototype keeps the left panel (Model, Sources, Requirements) and the inspector on its project home. The
application's project home shows two empty side panels that say “Open a canvas to work with the model, sources and
requirements.” and “Open a canvas to see the details of what you select.” (`src/app/_components/app-shell.tsx`); the
panels exist only on canvas pages.

- **Accepted** by Łukasz in slice 4a, step 5. **Later:** not planned yet.
- **Slice 5a:** the empty panels follow the same layout as the canvas pages' (hidden, shown, widths, the toolbar's two
  buttons).

## Back and forward (slice 6b)

### Browsers without the Navigation API

Back and Forward, Alt+←/→ and the selection places rest on the Navigation API (Baseline since January 2026: Chrome and
Edge 102, Firefox 147, Safari 26.2). Where it is missing, the two buttons are hidden and the app's Alt+←/→ is off; the
browser's own back and forward still walk the pages, and selections are not places.

- **Accepted** by Łukasz in slice 6b, step 1 (answer 2): no fallback.

### The mouse's back and forward buttons are tested by hand only

The browser handles them (the app adds nothing). Playwright cannot press them, so no spec covers them; the manual
acceptance does.

- **Accepted** by Łukasz in slice 6b, step 1 (answer 7).

### At most 50 entries per tab

The browser's history is the one history; Chromium keeps at most 50 entries per tab (the prototype kept 120 places).
Older entries drop off, and their places with them (pruned from `sessionStorage`).

- **Accepted** by Łukasz with slice 6b's step 1 (the PRD's item 8: no cap of the app's own).

### A reload starts without a selection

A reload keeps the page and its entry, but the canvas opens without a selection (as before slice 6b). The entry keeps
its place: Back and then Forward onto it select it again.

- **Decided** in slice 6b, step 1 (item 5).

## Side panels (slice 5a)

### A remembered canvas view and a different left panel

**Closed in slice 6a** ([PRD](prd/slice-06a-view-state-bar.md), [acceptance](prd/slice-06a-acceptance.md)): a view is saved with the canvas's left edge on the screen and corrected by the
difference on open, in the one `setViewport` call (D-54; S6A-11). Views saved before slice 6a open as stored. The text
below is kept as it was written.

Each canvas remembers its last view in the browser, in the canvas's own coordinates (`infomapper:view:<canvas id>`).
Hiding, showing or resizing the left panel moves the view so the model stays in place (PRD item 6), but a view saved
with the left panel at one width and opened with it at another is shifted on the screen by the difference (264 px for
a hidden panel).

- **Accepted** by Łukasz in slice 5a, step 1 (answer 5). **Later:** not planned.

### The top bar on narrow windows

**Closed in slice 6a** ([PRD](prd/slice-06a-view-state-bar.md), [acceptance](prd/slice-06a-acceptance.md)): measured in slice 6a, the tools were cut off from about 1,700 px (not 1,100 px as
written below: the zoom group at 1,600 px, the working context, undo and zoom at 1,300 px). Now nothing is cut off from
800 to 2,560 px with both panels shown: the prototype's label steps at 2,100, 1,880 and 1,300 px, and a “More” menu for
Focus and the notation up to 1,200 px and the Entity, Frame, Note and Hand tools up to 1,100 px (S6A-10). The text below
is kept as it was written.

Below about 1,100 px the canvas page's top bar has more tools than room: the tools are cut off at their right end, the
details panel's button and the user indicator stay visible (slice 5a, step 2). The canvas still zooms with the wheel
and undoes with Ctrl+Z. Idea in `docs/ideas.md` (“A top bar that fits narrow windows”).

- **Found** in slice 5a, step 2; left for a later slice. **Later:** not planned yet.

### The status bar has no “Open notes on canvas {n}”

**Closed in slice 6a** ([PRD](prd/slice-06a-view-state-bar.md), [acceptance](prd/slice-06a-acceptance.md)): the status bar follows Requirements with “Open notes on canvas {n}”, counting open
notes only, as the prototype (S6A-07). The text below is kept as it was written.

The prototype's status bar (`renderStatus`) ends with “Open notes on canvas {n}” after Requirements; the application's
stops at Requirements and the working context (`src/app/_panels/status-bar.tsx`).

- **Accepted** by Łukasz in slice 4a, step 5. **Later:** slice 6, with the view-state bar (D-39).

### Canvas tiles have no frame count

The prototype's canvas tile on the project home says “{n} cards, {m} frames. Also in …”; the application's says
“{n} cards. Also in …” (`src/app/w/[workspaceId]/p/[projectId]/_components/project-tiles.tsx`).

- **Accepted** by Łukasz in slice 4a, step 5. **Later:** not planned yet.

## Text contrast (slice 4b-1, step 6)

### Grey text and two tags are below WCAG AA on a plain card

Found while checking the text under slice 4b-1's coverage colours (step 6). On a plain white card, three texts are
below WCAG AA's 4.5:1 for normal text, with or without any tint:

| Text | Colours | Contrast |
| --- | --- | --- |
| Grey text: data types, counts, key letters, a card's “in {concept}” (`--im-ink-3`) | `#7c8998` on `#ffffff` | 3.6:1 (dark mode 4.1:1) |
| The PII tag | `--im-warn` on `--im-warn-soft` | 4.4:1 |
| The BK tag | `--im-physical` on `--im-physical-soft` | 4.1:1 |

The prototype's palette has the same values. This comes from the palette and does not depend on the coverage tints:
those keep every text that reaches 4.5:1 on a plain card at 4.5:1 under them (step 6's follow-up).

- **Accepted** by Łukasz after slice 4b-1, step 6. **Later:** a candidate for the ergonomics slice (`docs/ideas.md`).

## Undo history (slice 1b)

### The undo history lives in server memory

Each person's undo history in a workspace (the last 50 steps, slice 1b PRD item 12) is kept in the
memory of the server process, as the PRD asks for now. It is lost when the server restarts (and, in development, when
the demo data is replaced: steps whose change group is no longer in the change log are left out).

- **Accepted** for the local adapter: one development server, one user at a time in practice.
- **The database slice (last, AD-31):** decide whether the history must survive a restart (and several server instances). If it must,
  keep it in the database next to `change_event`.
- **Slice 7c (F6):** a step recorded before the local data file's upgrade to format 8 that touched a source column
  carries the column's old business key and personal data flags in its images, so undoing or redoing it is refused
  ("changed afterwards"); nothing wrong is written. A server restart empties the history anyway.
- **Slice 7c (who signs the upgrade):** the rows and change events slice 7c's upgrade wrote are signed by the
  workspace's creator; a future "last changed by" must recognise them as the upgrade's. The data model slice decides on a
  system author for upgrades (e.g. "InfoMapper upgrade").
- **Slice 7c (Escape in dialogs):** the canvas listens for Escape and its one-letter shortcuts (F, M, E, H, A, N, V) on
  the whole window. In the dialogs "Delete {entity} from the model?", "Delete the concept {name}?", "New source table" and "Import
  sources into {system}", Escape closes the dialog and also clears the canvas selection, which closes the panel behind it, and a letter
  pressed outside a text field acts on the canvas. The Classifications dialog (slice 7c) keeps both to itself; the
  others are left as they are (Łukasz, step 4).
- **Slice 7c (live columns only):** the upgrade moved hand-typed comments into notes on live columns only. A deleted
  column brought back by undo keeps a hand-typed comment, shown as "From the source:".

### No undo outside canvases (slice 3a, step 0)

Undo and redo (the top bar's buttons, Ctrl+Z, Ctrl+Shift+Z) exist only on canvas pages (slice 1b, assumption 8).
Changes made on the project and workspace home pages (projects, canvases) are in the undo history, but can only be
undone from a canvas. Pinning a label to a project and unpinning it (project home, slice 3a) write a change group with
their change events but are not undo steps at all. Deleting a label is an undo step, and its undo brings its project pins
back with it.

- **Accepted** by Łukasz in slice 3a, step 0.
- **Later:** undo on the home pages (`docs/ideas.md`, “Undo and redo on the project and workspace home pages”).

## Dependencies (slice 2a, step 0)

### `npm audit`: 11 high, all from one advisory without a fix

On 6 October 2026 `npm audit` reports 11 high-severity findings. All come from one advisory,
[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) (published 18 September 2026): `braces`
up to 3.0.3 can exhaust the stack on deeply nested brace patterns and crash the Node.js process. 3.0.3 is the newest
`braces`, so there is no patched version yet. The other ten are the packages that reach it through `micromatch` and
`fast-glob`:

| Package (we depend on it directly) | Path to `braces` | npm's suggested “fix” |
| --- | --- | --- |
| `eslint-plugin-boundaries` 7.2.0 (dev) | `micromatch` → `braces`; `@boundaries/elements` | downgrade to 1.1.1 (breaking) |
| `eslint-config-next` 16.3.8 (dev) | `@next/eslint-plugin-next` → `fast-glob` → `micromatch` | downgrade to 14.2.35 (breaking) |
| `shadcn` 4.21.1 (dev) | `@shadcn/registry`, `ts-morph`, `fast-glob` → `micromatch` | downgrade to 1.0.0 (breaking) |

`npm audit fix` without `--force` resolves none of them (it only moves `shadcn` to 4.21.3), so nothing was changed.

- **Risk: low for us.** All three are development tools (lint and the shadcn CLI) and are not part of the application
  the server runs. They match glob patterns from this repository's own configuration, not input from users, so an
  attacker would need to change the repository to trigger it, and the worst outcome is a crashed lint run.
- **Accepted** until `braces` (or `micromatch`) publishes a fix; then update within the current majors and run
  `npm audit` again. Do not take the suggested downgrades: they would break lint (the layer rules) and the shadcn CLI.

### `npm audit`: 1 critical in `handlebars`, fixed release too new (slice 2c, step 0)

On 9 October 2026 `npm install` reports a new critical finding: `handlebars` up to 4.7.9 has three advisories
([GHSA-8r5x-fm3f-whwj](https://github.com/advisories/GHSA-8r5x-fm3f-whwj) and
[GHSA-p8wg-vrv2-v86f](https://github.com/advisories/GHSA-p8wg-vrv2-v86f), critical;
[GHSA-xw65-4hp5-5hc7](https://github.com/advisories/GHSA-xw65-4hp5-5hc7), moderate), JavaScript injection when
templates are compiled. Its only path is `eslint-plugin-boundaries` 7.2.0 (dev, the newest) → `@boundaries/elements`
3.1.1, which pins `handlebars` to exactly 4.7.9. npm's suggested “fix” is a downgrade of the plugin to 5.4.0 (breaking).
`handlebars` 4.7.10, published 5 October 2026, is outside the advisories' range.

- **Risk: low for us.** Only lint uses it, to fill in templates from this repository's own `eslint.config.mjs`; no user
  input reaches it, and it is not part of the application the server runs.
- **Condition (Łukasz, 9 October; still open at the end of slice 2c, 10 October):** add
  `"overrides": { "handlebars": "4.7.10" }` (or newer) to `package.json` once 4.7.10 is at least 14 days old (from 19
  October 2026), or earlier if `eslint-plugin-boundaries` ships a release that fixes it; then `npm install`, lint
  (including a deliberately broken layer rule to confirm the layer rules still catch it), typecheck, unit tests, and
  `npm audit` again (expected: only the 11 from `braces`). Do not take the suggested downgrade.
- **Decision (Łukasz, 13 October, slice 3b):** the plugin still has no fix (7.2.0; `@boundaries/elements` 3.1.1 still
  pins 4.7.9). The override comes as a separate small pull request after slice 3b's merge, from 19 October 2026.
- **Resolved on 22 October 2026 (Łukasz, after slice 6b): override added.** `package.json`'s `overrides` has
  `"handlebars": "4.7.10"` (a plain top-level entry, 17 days old); `npm ls handlebars` shows 4.7.10 on both paths
  (`eslint-plugin-boundaries` 7.2.0 and `@boundaries/elements` 3.1.1). The lock file changed only `handlebars`. Checks:
  a deliberately broken layer rule (`domain` → `app` and `canvas`, `ui` → `canvas`) still fails lint with the plugin's
  filled-in messages; lint, typecheck and unit tests (80 files, 1,045 tests) pass; `npm audit` no longer lists
  `handlebars`.
  - **Exposure was development and lint only.** `handlebars` is reached only from `eslint.config.mjs`; no file in
    `src/`, `scripts/`, `tests/` or `e2e/` imports it, `eslint-plugin-boundaries` or `@boundaries/elements`. A fresh
    `npm run build` on 22 October: no file under `.next/server` or `.next/static` (including the `*.nft.json` traces of
    what a deployment ships) mentions `handlebars`.
  - **Next (from 4 November 2026):** `eslint-plugin-boundaries` 7.2.1 and `@boundaries/elements` 3.1.2 (both
    21 October) pin `handlebars` 4.7.10, the upstream fix within the current major. Once they are 14 days old, update the
    plugin to `^7.2.1`, remove the `handlebars` override and repeat the checks above.

### `npm audit`: three further findings on 22 October 2026, one of them in `next` (not yet decided)

On 22 October 2026 `npm audit` reports 15 findings (1 moderate, 10 high, 4 critical): the `braces` and `handlebars`
ones above, and three new ones. Recorded here only; nothing changed. After the `handlebars` override the same day:
14 (1 moderate, 12 high, 1 critical; the plugin's two entries now count as high through `braces`).

| Package | Advisories | Path | Exposure | Fixed in (published) |
| --- | --- | --- | --- | --- |
| `next` 16.3.8 (**production**) | [GHSA-2464-fhr4-w9xw](https://github.com/advisories/GHSA-2464-fhr4-w9xw) (critical, RCE in the image optimizer with SVG files), [GHSA-673q-mjm6-r5xr](https://github.com/advisories/GHSA-673q-mjm6-r5xr) (critical, RCE in `use cache` functions), [GHSA-p3m5-59mp-jv5r](https://github.com/advisories/GHSA-p3m5-59mp-jv5r) (DoS through server actions) | direct | the application server; `npm audit --omit=dev` reports this one only. The app uses neither `next/image` nor `use cache`, but it does use server actions, and nothing is deployed yet | 16.4.1 (14 October), 16.4.2 (15 October); no 16.3.x backport |
| `vite` 8.3.2 (dev) | six advisories in Vite's dev server and `launch-editor` | `vitest` 5.0.3 | unit tests only; Vitest runs no dev server here | 8.3.3 (6 October) |
| `ip-address` 10.7.3 (dev) | [GHSA-rxp7-6hxx-x8q5](https://github.com/advisories/GHSA-rxp7-6hxx-x8q5) (moderate, DoS) | `shadcn` → `socks`, `@modelcontextprotocol/sdk` | the shadcn CLI only | 10.7.4 (11 October) |

- **Not `npm audit fix`.** Without `--force` it would take the newest releases in range, several younger than 14 days
  (`vite` 8.3.5, `eslint-plugin-boundaries` 7.2.1, `shadcn` 4.22.1, all 21 October). `vite` 8.3.3 is old enough but
  only reachable through `vitest`, so taking it would need another override; `ip-address` 10.7.4 is 14 days old on
  25 October. Both are development-only; update them with the next dependency pull request.
- `next` 16.4.x is a minor update outside `package.json`'s exact `16.3.8` and younger than 14 days (16.4.1: from
  28 October; 16.4.2: from 29 October). Planned as its own pull request from 29 October with a full e2e run, not inside
  a slice. Because the advisory is critical and in the production dependency, an earlier exception is Łukasz's call.

### `npm` override: `fast-equals` 5.4.3 under `@tiptap/react` (slice 4a, step 2)

`@tiptap/react` 3.31.3 asks for `fast-equals` `^5.3.3`, which resolved to 5.4.4, published 8 October 2026, younger than
the 14 days the dependency rule asks for. `package.json` has `"overrides": { "@tiptap/react": { "fast-equals": "5.4.3" } }`
(20 September 2026), for Tiptap only.

- **Risk: none known.** 5.4.3 and 5.4.4 are patch releases of a small comparison library; `npm audit` reports nothing
  for either.
- **Review on 22 October 2026** (5.4.4 is then 14 days old), together with the `handlebars` pull request: remove the
  override, `npm install`, check that `fast-equals` resolves to a release at least 14 days old, then lint, typecheck,
  unit tests and the editor's end-to-end tests.
- **Reviewed on 22 October 2026: kept.** Without the override `^5.3.3` would now resolve to 5.4.5 (14 October 2026),
  8 days old, so removing it would break the 14-day rule again. `fast-equals` stays at 5.4.3. **Review again from
  28 October 2026** (5.4.5 is then 14 days old), with the `next` pull request, using the same steps.

## End-to-end tests (slice 1a, step 6)

### “The destination stream closed early” in the e2e server log

The e2e dev server sometimes prints `⨯ Error: The destination stream closed early.` (digest 2208966200). It was seen
three times in every full run until step 6; two causes were found and fixed: the proxy wrote preference cookies during
server actions, which made Next.js refresh the page after every action, and a navigation right after an action cut
that refresh off (after S0-05, S1A-12, S1A-13). What remains is about once in three full runs, after S0-11, which
clicks through the breadcrumbs quickly: a navigation that starts while the previous page is still streaming. No test
fails on it, and the browser behaves as it should.

- **Accepted:** it is the dev server noting that the browser left a page early.
- **Later:** look again if it shows up outside fast navigation, or in a production build.

**Counted again on 10 October 2026 (slice 3a, after step 1).** It is now far more frequent than once in three runs:
one full run on `main` at 717f42d printed it 9 times (108 passed), one on 1db6f1e (slice 3a, step 1) 11 times (108
passed); step 1 does not cause it. It is printed right after these specs finish (so at the end of that spec or the start
of the next): in both runs S0-11, S1B-03 (line 45), S1B-04, S2B-02, S2C-01 (both tests), S2C-04 (line 20) and S2C-07
(line 66); only on main S2A-03; only on 1db6f1e S2C-06, S2C-07 (line 51) and S2C-08 (line 52). No test fails because
of it.

- **Cause, inferred, not traced:** these specs write and then end or navigate at once, so the page is probably still
  loading its refresh after the write when the test closes it or leaves it.
- **What has to happen later (not in slice 3a):** make tests that write and then end or navigate wait until the page
  has finished its refresh, and check whether the message goes away.

### e2e dev servers run without Turbopack's file-system cache

Next.js 16.1+ keeps a cache of the dev compilation in the build folder. The e2e runs stop their dev servers by force,
and a server that reused such a folder answered 404 for whole routes now and then (S0-10, and once a whole run). E2e
servers (`NEXT_DIST_DIR` set) therefore run without that cache, `npm run e2e` starts from an empty `.next-e2e`, and
S0-10 removes `.next-e2e-restart` before and after use. A global setup warms the server up (signs in, opens the main
pages), so the first tests do not wait for compiles.

- **Accepted:** an e2e run compiles every page once (about a minute); `npm run dev` keeps its cache.
- **`npm run dev` can hit it too** (slice 4a): after a dev server on `.next` was stopped by force (a closed terminal, an
  ended session), the next one answered 404 for every project and canvas page while the workspace page worked; the data
  file was not the cause. Fix: stop the server, delete `.next/dev/cache/turbopack`, start it again (the first pages
  compile once more).
- **Later:** if the e2e runs move to a production build once the local adapter is gone (the database slice, last, AD-31), this goes away.

### S7A-04-route's development sign-in timed out once (a known flake)

In slice 7b's closing (run 5 of 26 October 2026), “P8 (route): a review that no longer matches the system writes
nothing and says so” (`e2e/slice-07a/S7A-04-route.spec.ts`) failed at its first line, the development sign-in: after
the click on Łukasz the top bar did not show within 15 s. That is before any slice code runs. It happened in 1 of 9
full runs logged since slice 7a's close, and the file passed 3 of 3 on its own. Recorded as a known flake (Łukasz, 26
October 2026); if it comes back, look at the sign-in redirect's timing under a long run.

## Source import (slice 7a)

### Every write rewrites the whole local data file

The local adapter (AD-29) writes the whole `.data/dev-db.json` on every write, so writes slow down after very large
imports: about 1 s per write (a card move) after three 20,000-column imports, when the file is 128 MB (80 MB of it
change events). Slice 7a, step 4 made the adapter copy only the tables a write touches, check only what a write can
break and write the file without indentation (3.3 s before); the rest is writing the file itself.

- **Accepted** (Łukasz, 23 October 2026): work is imported incrementally, not whole databases, so the file stays small
  in practice. `npm run reset-dev-data` brings it back to the demo.
- **Local adapter only:** the Supabase adapter writes only the changed rows. If large imports are ever needed locally:
  `docs/ideas.md`, "One file per table in the local adapter".

### One import takes up to 30,000 column rows (a temporary limit)

Above it: "The file has {n} rows; one import takes up to 30,000. Split it by database or schema." A larger system is
imported in parts, one database or schema at a time ("Only columns of the tables in the file"). The text of one import
is limited to 20 MB, an upload to 25 MB.

- **Why:** the local adapter's figures (slice 7a, step 4), not the importer's. Reading, translating, planning and the
  P8 comparison are fast at 100,000 rows (read 0.5 s, translate a DDL script 1.8 s, plan 0.4 s); writing and undoing
  through the local data file grow with the rows (at 20,000: import 2.1 s, undo 2.5 s; at 100,000: 13.1 s and 16.4 s,
  and three such imports ran the process out of memory). Details: `docs/prd/slice-07a-acceptance.md`, step 4.
- **Later:** measure again when the Supabase adapter exists (the database slice, AD-31), and raise the limit from those
  figures.

### Relationships between source tables: matched by name, then by what they join

A re-import matches a relationship first by its foreign key's name on its table, then, when no name matches, by its
target table and column pairs (slice 7a, step 4): a DDL script names an unnamed key `FK_{table}_{columns}`, SQL
Server's catalog gives the name it generated, and the review shows the same relationship as one "changed" with its new
name, not as a missing and a new one (S7A-17). What remains: two keys over the same columns to the same table, both
renamed, are paired in file order.

### An import's undo: all or nothing, and not after a restart

An import is one undo step (P7). Undo is refused as a whole ("This can't be undone because it was changed afterwards.")
when any row the import wrote has changed since: a new column mapped, a business key set, a table renamed. The undo
history lives in the server's memory ("The undo history lives in server memory" above), so an import cannot be undone
after the server restarts. Approving a mapping again, or importing the previous file again, is the way back then.
Since slice 7b, resolving one of the import's changes to resolve writes rows the import wrote: undoing the resolution
first brings the change back as the import left it, and then the import can be undone. A resolution by someone else
blocks the import's undo, as any later change does (step 1, F13).

### SQL Server's `timestamp` read from a file is a date

SQL Server's `timestamp` is `rowversion`, a row's version stamp (binary(8)), not a date. The query channel (with SQL
Server chosen) and the DDL channel (a script with SQL Server's signs: brackets, `GO`, `IDENTITY`) write it as
`rowversion` (slice 7a, step 7). A file in the standard does not say which database it comes from, so `timestamp` there
is read as everywhere else: a date with 6 digits of fractional seconds (`timestamp(6)`, PostgreSQL's and Oracle's
meaning). Write `rowversion` in such a file for a SQL Server column. The same holds for `time` without a parameter:
SQL Server's default is 7 digits, PostgreSQL's 6, so it keeps no default and `time` against `time(7)` shows as a change.

### The upload relies on an experimental Next.js option

An import's text goes to `POST /w/{workspace}/import` (up to 25 MB). The proxy (`src/proxy.ts`) buffers request bodies
up to 10 MB by default and cuts off the rest, so `next.config.ts` sets `experimental.proxyClientMaxBodySize: "25mb"`
(slice 7a, step 4; `S7A-04-route.spec.ts` sends 12 MB and 26 MB). An upgrade of Next.js may rename or drop it; the spec
fails if it does.

### Combined mappings never get a type conflict

A mapping with two or more inputs is a transformation with a rule, and a rule is never a type problem (D-01). So an
import can send a combined mapping back to review for a business key column that changed type or a renamed input in its
rule, but never for a type conflict; only direct mappings get that reason (slice 7a, step 1, F1).

## Changes to resolve (slice 7b)

### The changes derived at the upgrade are no undo step

The local data file's upgrade to format 7 derived open changes from what slice 7a's imports stored (missing columns and
tables, mappings sent back to review, new tables and columns with no mapping yet), each saying “Raised when slice 7b was
installed.” The upgrade is not a person's action, so it has no undo step; every resolution of such a change is undoable
(step 1, F1). A new table or column a 7a import created and someone has mapped since is not derived as new.

### Model consistency lists every line

The project home's model consistency lists every mapping and attribute it finds, with no folding or limit. On a real
project that is a handful of lines; a project with thousands of type conflicts (the synthetic 20,000-column file of
`bench-consistency.ts` has 1,619, as all its attributes are string(50)) would list them all. The computation stays at
about 23 ms there; the page grows with the list.

### Model consistency is fresh on each load, not while the home is open

The home computes model consistency when it loads; a change made by someone else while the home stays open shows on the
next load. Every action in this browser happens on a canvas, so going back to the home always shows its result.

### The Changes view lights whole cards

Touched cards stay lit as a whole; the touched rows inside them carry the row marks (new, changed, retired, missing),
and untouched rows are not dimmed as in the prototype (`docs/ideas.md`, “Per-row fading in the Changes view”).
Switching the view on with many cards lit costs more than Focus on one entity: 74.7 ms to the screen at 30 % on
“Performance test” with 22 cards lit, against 50.9 ms for Focus on ent:23 (within the 100 ms bar; step 5).
