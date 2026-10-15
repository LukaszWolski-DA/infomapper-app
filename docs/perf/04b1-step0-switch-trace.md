# Slice 4b-1, step 0: tracing a fading switch (15 October 2026)

A diagnosis before slice 4b-1 builds the requirement lens and Focus on slice 4p's fading. No application code changed.
The 4b-1 PRD references this file.

**Summary**
- **The bimodal switching was an artefact of how we timed it.** Every F1 switch in 4p's slow view re-rasters the
  visible part of the canvas's big layer on the GPU. The in-page timer stops before that raster, so a switch read "fast"
  or "slow" depending on where the stall fell.
- **Measured to the screen, F1 misses S4P-02:** 436 ms (large lens) and 285 ms (Focus) at 30 % with frames expanded,
  160 ms at 100 % expanded, 190 ms at 30 % collapsed.
- **The cost is F1's lift rule, not its veil.** The veil alone reaches the screen in 13 ms, the lift rule alone in
  540 ms. F4 reaches it in 86 ms (large lens) and 44 ms (Focus).
- **C-10 and the lasso hold to the screen:** 20 ms and 43 ms.
- **Every veil gets its own compositing layer**, by overlap. So B2's premise is refuted, and 4b-1 builds on F4
  (decision below).

## Conditions

- **Laptop:** the reference machine (i7-8550U, Intel UHD 620, 1536 × 864; AD-24), on mains, Windows power mode Best
  performance; Chrome 155.0.8059.40 (Playwright, headed, 1536 × 864, pane 932 × 718).
- **Prepared by Łukasz** before each sitting: for 0.2 a lighter preparation; for 0.3b a restart, 10 min idle, Update
  and OneDrive paused, Chrome closed, display and sleep set to Never.
- **Builds:** production measurement builds (`npm run measure:build`, `.next-measure`; AD-31):

  | Side | Commit | Where |
  | --- | --- | --- |
  | main (F1) | `052daaf` (tag `slice-04p`) | this repository |
  | `slice-04a` (no fading) | `5e02c96` | `../infomapper-ab-main` |
  | F4 (`perf/4p-trial-f4`) | `f0d0f61` | `../infomapper-side-perf-4p-trial-f4` |

- **Data:** “Performance test” (`seed:large`).
  - Views as in `e2e/slice-04p/S4P-fading.spec.ts`: around ent:23 at 100 % or 30 %; S1A-14's dense area around src:57
    at 100 %; the overview fitted.
  - Frames expanded, or all collapsed (`?diag=collapsed`).
  - Large lens REQ-102, dense lens REQ-103, Focus ent:23.
- **CPU check:** before every side, total CPU under 5 % for 30 s (Claude, node and the shells excluded, as in 4p). Every
  check passed.
- **Every figure here is traced** (Chrome DevTools Protocol). Traced runs are slower than untraced ones, so these figures
  are a diagnosis, not verdicts.
- **Raw traces and scripts** are in `.data/measure/s4b1-step0-traces/` and `.data/measure/s4b1-step0/` (git-ignored,
  never committed):
  - `switch-trace.spec.ts` (0.2), `settled-trace.spec.ts` and `run-all.ps1` (0.3b), `layer-check.spec.ts`;
  - the analysers `analyse.ts`, `split.js`, `aggregate.js`, `endpoints.js`.
  - The tooling step of 4b-1 moves what stays in use into `scripts/` and `e2e/`.

## Definitions

- **In page:** as 4p's specs time it.
  - Fading and C-10: from the switch to the first `setTimeout` after the `requestAnimationFrame` that follows the change
    appearing in the page.
  - Lasso: from the pointerup's timestamp to the timestamp of the `requestAnimationFrame` whose frame has every mark
    (the start of that frame).
- **To screen:** from the switch's start to the end of the first GPU present (`DXGISwapChainImageBacking::Present`) that
  ends after the compositor's activation (`ActivateLayerTree`) of the switch's commit. That activation is the first
  one after the start of the first main-thread `Commit` after the switch's start.
- **Split** (per switch, from the start to that present):
  - main: the renderer main thread's busy time;
  - raster: the GPU main thread's raster (`DoRasterCHROMIUM`, `DoEndRasterCHROMIUM`) outside main-thread busy time;
  - rest: everything else (compositor, Viz draw, present, waiting).
- **Settled** (0.3b): every switch is followed by a 1,200 ms pause. The check counts a switch as settled when no GPU
  raster runs at its start or ends in the 50 ms before it (see the lasso below for why this is too strict).

## 0.2 and 0.3a: back-to-back switches on main (F1)

Main, 30 % around ent:23, frames expanded. 4 runs × 20 on/off pairs per case, each switch right after the previous one
(S4P-fading's rhythm), traced. Quiet check passed (33 s, peak 15.6 %, last 1 %). Times in ms.

| Case | Dir | n | In page median / p95 / max | Slow (> 100) | To screen median / p95 / max | Main | Raster | Rest |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Large lens | on | 80 | 582 / 675 / 763 | 59 | 1,032 / 1,226 / 1,353 | 22 | 980 | 16 |
| Large lens | off | 80 | 478 / 536 / 694 | 57 | 1,037 / 1,166 / 1,385 | 20 | 975 | 15 |
| Focus | on | 80 | 22 / 285 / 307 | 20 | 234 / 505 / 553 | 19 | 210 | 6 |
| Focus | off | 80 | 20 / 234 / 247 | 16 | 279 / 488 / 516 | 16 | 256 | 5 |

The split columns are medians.

**Fast against slow, by thread** (medians, in ms):

| Group | n | Duration | Main busy | Main idle | GPU main | GPU raster | Tiles recorded | GPU raster calls |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Focus, fast | 124 | 19 | 16 | 2 | 19 | 19 | 0 | 3 |
| Focus, slow | 36 | 268 | 19 | 244 | 265 | 256 | 14 | 49 |
| Large lens, fast | 44 | 19 | 17 | 0 | 19 | 19 | 0 | 0 |
| Large lens, slow | 116 | 555 | 19 | 537 | 555 | 543 | 31 | 77 |

**Reading:**
- **The main thread's work doesn't differ** between fast and slow switches (16–19 ms in both).
- **In a slow switch, the main thread waits** while the GPU process's main thread rasters, mostly deserialising paint
  operations.
- **Every switch, fast or slow, re-records about 80–120 tiles** of the big layer. The GPU then rasters about
  330–400 ms per large-lens switch.
- **Whether the in-page timer sees that raster depends on where the stall falls:**
  - before the timer stops, the switch reads slow;
  - in the untimed wait before the next switch, it reads fast (that wait's median: 474 ms for the large lens, 229 ms for
    Focus);
  - the timed part plus that wait is about the same either way (494–569 ms large lens, 249–271 ms Focus).
- **The 4p hypothesis is confirmed in its mechanism** (a full GPU raster of the big layer) **and corrected in its
  frequency:** it happens on every switch in this view, not just some.
- **Back to back, a switch also waits for the previous switch's raster.** That is why "to screen" here counts about two
  rasters. These figures are superseded by 0.3b's settled ones, and they use the old anchor (see "The analyser fix").

## 0.3b: settled switches, three sides

**The sitting** (`sitting-2026-10-15-16-02`, 52 min, `run-all.ps1`):
- **Order:** a discarded warm-up round (1 pair per case, every side); Part 1 in three rounds, each side first once
  (main → slice-04a → F4, slice-04a → F4 → main, F4 → main → slice-04a); Part 2 in one round (main → slice-04a).
- **Switches:** 20 on/off pairs per case and round, each followed by a 1,200 ms pause.
- **Checks:** every CPU check passed and every run passed, so **no round was dropped or replaced**.

### Part 1: 30 %, frames expanded (60 switches each way per case)

| Side | Case | Dir | Not settled | In page median / p95 / max | To screen median / p95 / max | Main | Raster | Rest |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| slice-04a | veil only | on | 0 | 8 / 25 / 26 | 14 / 29 / 32 | 9 | 1 | 3 |
| slice-04a | veil only | off | 0 | 8 / 25 / 25 | 12 / 28 / 29 | 8 | 1 | 3 |
| main | veil only | on | 0 | 9 / 25 / 26 | 13 / 30 / 30 | 9 | 1 | 3 |
| main | veil only | off | 0 | 8 / 25 / 26 | 12 / 29 / 29 | 9 | 1 | 2 |
| main | lift only | on | 0 | 11 / 28 / 29 | 543 / 606 / 707 | 11 | 522 | 8 |
| main | lift only | off | 0 | 11 / 29 / 29 | 540 / 658 / 674 | 12 | 518 | 8 |
| main | veil + lift | on | 0 | 11 / 28 / 28 | 370 / 425 / 466 | 12 | 343 | 13 |
| main | veil + lift | off | 0 | 12 / 29 / 29 | 339 / 369 / 481 | 12 | 316 | 11 |
| main (F1) | large lens | on | 0 | 15 / 23 / 24 | **436 / 501 / 530** | 16 | 406 | 13 |
| main (F1) | large lens | off | 0 | 13 / 19 / 29 | **341 / 372 / 391** | 13 | 319 | 8 |
| main (F1) | Focus | on | 0 | 13 / 22 / 30 | **285 / 315 / 356** | 14 | 261 | 8 |
| main (F1) | Focus | off | 0 | 12 / 20 / 29 | **237 / 263 / 271** | 12 | 215 | 7 |
| F4 | large lens | on | 0 | 12 / 21 / 23 | 86 / 116 / 120 | 12 | 67 | 6 |
| F4 | large lens | off | 0 | 9 / 19 / 25 | 12 / 15 / 18 | 10 | 0 | 2 |
| F4 | Focus | on | 0 | 10 / 21 / 40 | 44 / 75 / 181 | 11 | 28 | 5 |
| F4 | Focus | off | 0 | 9 / 19 / 27 | 12 / 23 / 32 | 9 | 0 | 3 |

**What each case switches:**
- **veil only:** a probe `div` in `.react-flow__viewport` with F1's veil style (`canvas.css` `.fade-veil`), toggled.
- **lift only:** F1's own lift `<style>` for the large lens (copied from the page), toggled alone.
- **veil + lift:** both.
- **The F1 and F4 cases** use the measuring hook (`__imFade`).

**Reading:**
- **The veil isn't the cost:** about 13 ms on both main and slice-04a.
- **The lift rule is:** alone it takes about 540 ms, nearly all of it GPU raster. Changing the z-index of about half the
  cards changes the big layer's paint order, and every visible tile is rastered again.
- **Veil + lift (340–370 ms) is cheaper than lift alone.** Kept as an open note (see the layer check).
- **The whole lens adds the lit lines and rows** to veil + lift: +66 ms on, about 0 off.
- **F4 rasters only its own layer.** It is within 100 ms to the screen except its large lens's p95 and max (116 and
  120 ms on).
- **In page shows none of this:** every case reads 8–15 ms there.

### Part 2: other views, hover and lasso (20 switches per case)

| Side | Case | Dir | Not settled | In page median / p95 / max | To screen median / p95 / max | Main | Raster | Rest |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| main (F1) | large lens, 100 % expanded | on | 0 | 27 / 30 / 30 | **160 / 188 / 188** | 27 | 131 | 3 |
| main (F1) | large lens, 100 % expanded | off | 0 | 24 / 37 / 37 | **146 / 158 / 158** | 24 | 119 | 2 |
| main (F1) | large lens, 100 % collapsed | on | 0 | 13 / 19 / 19 | 23 / 37 / 37 | 13 | 8 | 2 |
| main (F1) | large lens, 100 % collapsed | off | 0 | 17 / 26 / 26 | 11 / 27 / 27 | 10 | 0 | 1 |
| main (F1) | large lens, 30 % collapsed | on | 0 | 9 / 11 / 11 | **190 / 277 / 277** | 9 | 172 | 7 |
| main (F1) | large lens, 30 % collapsed | off | 0 | 6 / 19 / 19 | **153 / 162 / 162** | 8 | 139 | 6 |
| main (F1) | dense lens, dense expanded | on | 0 | 24 / 27 / 27 | 76 / 103 / 103 | 24 | 50 | 2 |
| main (F1) | dense lens, dense expanded | off | 0 | 25 / 40 / 40 | 73 / 95 / 95 | 25 | 47 | 1 |
| main (F1) | dense lens, dense collapsed | on | 0 | 10 / 18 / 18 | 40 / 55 / 55 | 10 | 27 | 2 |
| main (F1) | dense lens, dense collapsed | off | 0 | 9 / 13 / 13 | 37 / 45 / 45 | 9 | 26 | 2 |
| main | C-10 hover, dense | on | 0 | 21 / 24 / 24 | 20 / 25 / 25 | 20 | 0 | 0 |
| main | C-10 hover, dense | off | 0 | 20 / 36 / 36 | 16 / 32 / 32 | 16 | 0 | 0 |
| slice-04a | C-10 hover, dense | on | 0 | 89 / 108 / 108 | 86 / 102 / 102 | 76 | 8 | 0 |
| slice-04a | C-10 hover, dense | off | 0 | 87 / 105 / 105 | 66 / 82 / 82 | 60 | 6 | 0 |
| main | lasso, overview | on | 14 (all settled, see below) | 23 / 30 / 30 | 43 / 51 / 51 | 43 | 0 | 0 |
| slice-04a | lasso, overview | on | 13 (all settled, see below) | 26 / 35 / 35 | 45 / 62 / 62 | 45 | 0 | 0 |

**Reading:**
- **Hover:** slice 4p's overlay takes it from 86 ms to 20 ms to the screen, with no raster in the big layer.
- **Lasso:** the same on both sides (about 44 ms to the screen).
- **F1's switching cost grows with how much of the big layer is in view.** It is high at 30 % and at 100 % expanded
  (the card rows), and low where collapsed blocks or the dense view leave less to raster.

### The analyser fix (the hover's "rest")

**The first analysis anchored "to screen" differently.** It took the first present ending after the *end* of the first
main-thread `Commit` after the switch's start. That gave the hover about 1,250 ms "to screen", with 1,207 ms of
"rest".

**Why that anchor was wrong:**
- **The main thread's `Commit` slice blocks until the compositor has taken the commit.** For a cheap frame like the
  hover, the compositor activates, draws and presents within that block: commit 14.1–22.2 ms, present at 22.0 ms.
- **The old anchor skipped that present** and took the next switch's present, 1.2 s later.

**The new anchor:** the first present after the compositor's activation that follows the commit's *start*. The
activation is when the commit's content becomes drawable, so the first present after it is the first that can show the
change.

**Spot-check, by hand in the traces** (times in ms from the switch's start):

| Trace | Switch | Commit | Activation | GPU raster calls | Old end | New end |
| --- | --- | --- | --- | --- | --- | --- |
| F1 large lens | on:3 | 14.6–16.2 | 22.3 | 79 (19–431) | 436.3 | 436.3 |
| F1 large lens | off:3 | 10.7–12.1 | 15.6 | 24 (16–338) | 344.1 | 344.1 |
| F1 Focus | on:5 | 12.0–13.1 | 17.0 | 50 (20–295) | 297.2 | 297.2 |
| F4 large lens | on:2 | 10.0–11.8 | 14.6 | 86 (13–83) | 86.1 | 86.1 |
| veil, main | on:4 | 6.3–7.3 | 7.7 | 1 | 12.0 | 12.0 |
| hover, main | on:1 | 14.1–22.2 | 15.1 | 4 (16–20) | 1,243.7 (next switch) | 22.0 |
| hover, main | off:1 | 13.1–19.8 | 13.9 | 0 | 1,240.7 (next switch) | 16.3 |
| lasso, main | on:1 | 34.2 (the marks' commit) | 36.4 | 8 (37–45) | 47.1 | 47.1 |

In the lasso, the first commit after pointerup (at 1.1 ms) is empty and activates nothing. The marks are painted at
23 ms, committed at 34 ms, activated at 36 ms and presented at 47 ms, so both anchors land on the frame with the marks.

**Which figures use which anchor:**
- **0.3b:** every figure comes from the fixed analyser. All of the sitting's `split.json` files were regenerated before
  aggregating; the fix changed only the hover rows.
- **0.2 and 0.3a:** the back-to-back figures above use the old anchor and are superseded. With the previous frame still
  in the pipeline, neither anchor is reliable: the new one can attach to the previous commit's activation.

### The lasso's unsettled flags

**Why 13–14 of 20 were flagged:**
- **Not Escape:** the untimed Escape came 1.8 s or more before each lasso.
- **The drag's last pointer move** (57–94 ms before pointerup) redraws the lasso rectangle in the overlay, with one GPU
  raster call of 0.1–0.3 ms. That raster ended 30–50 ms before pointerup, inside the check's 50 ms window.
- **In every flagged switch it had already been presented,** and nothing was rastering at the start.

**What that means:**
- **The check is too strict for drags.** Under "no raster running at the start, and the last one already presented",
  all 20 are settled on both sides.
- **The subsets agree.** Main: settled 43.5 ms median (n = 6) against flagged 42.7 (n = 14). slice-04a: 44.7 (n = 7)
  against 43.6 (n = 13). So all 20 are used.
- **S2A-14's in-page time ends at the start of the frame with the marks.** Its paint, commit and present add about
  20 ms (23 → 43 ms).

### Which slice 4p results hold

| 4p result | 4p figure (in page) | To screen (this trace) | Verdict |
| --- | --- | --- | --- |
| S4P-02, 30 % expanded, large lens | 462 ms median, bimodal | 436 on / 341 off | **missed** on every switch: the slow runs were real, the fast runs were measured too early |
| S4P-02, 30 % expanded, Focus | 20 ms (one round 270) | 285 / 237 | **missed** (4p: met) |
| S4P-02, 100 % expanded, large lens | 33 ms | 160 / 146 | **missed** (4p: met) |
| S4P-02, 30 % collapsed, large lens | 15–16 ms | 190 / 153 | **missed** (4p: met) |
| S4P-02, 100 % collapsed, large lens | 23–24 ms | 23 / 11 | holds |
| S4P-02, dense expanded, dense lens | 29 ms | 76 / 73 (p95 103) | holds on the median; p95 at the bar |
| S4P-02, dense collapsed, dense lens | 17 ms | 40 / 37 | holds |
| S4P-02, other scenarios (small lens; Focus at 100 % and collapsed) | 15–33 ms | not traced | unknown |
| S4P-03, pan and zoom with fading on against off | −4.9 to +5.8 % | not re-measured | **unverified:** measured as rAF intervals, not presented frames |
| C-10 hover | 18–19 ms | 20 / 16 | **holds** |
| Lasso marks | 23 ms | 43 (p95 51) | **holds** under 100 ms; the in-page figure is about 20 ms low |
| C-08 initial render | 1,432 ms | not traced here | its stable frame ends at a rAF, before the last raster; unverified to its last present |

**F4's rejection in 4p** rested on two things:
- **Pan and zoom at 30 %** (−8.4 to −11.6 %), measured as rAF intervals, so **unverified**.
- **+55 MiB of tiles and +20 % Layerize per frame.** These stand: memory-infra measured the tiles, and Layerize is the
  main thread's own work.

## The layer check (CDP LayerTree, no timing)

Main's measurement build, “Performance test”, 30 % around ent:23, frames expanded. The layer tree was read in each
state after 1.5 s settled (`layer-check-2026-10-15-17-05.json`):

| State | Layers | Drawing layers | Veil-sized layer | Its compositing reason |
| --- | --- | --- | --- | --- |
| off | 51 | 47 | none | – |
| probe veil | 52 | 47 | 80,000 × 80,000 (the probe veil's size) | “Overlaps other composited content.” (`Overlap`) |
| lift rule only | 51 | 47 | none | – |
| veil + lift | 50 | 45 | 80,000 × 80,000 | `Overlap` |
| F1's large lens (`__imFade`) | 51 | 46 | 46,328 × 47,376 (F1's veil: the content plus 20,000 px on each side) | `Overlap` |

**What the layer tree shows:**
- **Chrome reports these layers under a note's name.** A squashing layer is named after its first element, and the
  notes and other parts of the canvas (frames, sticky card headers) have layers of their own, so anything drawn above
  them overlaps composited content.
- **No layer is owned by the veil element itself.** But a drawing layer of exactly the veil's size appears with the
  veil, and disappears without it.

**Result:**
- **A veil in the viewport, F1's included, isn't drawn in the big layer.** Chrome composites it implicitly, by overlap.
  That is why "veil only" costs 13 ms.
- **B2's premise is refuted.** B2 was F4's veil with holes in F1's place, with no layer of its own and no lift, on the
  premise that a veil in the big layer is cheap. Such a veil would get a layer anyway, decided by Chrome's overlap rules
  rather than by us, so B2 would be an F4 whose layering we don't control.
- **The note "veil + lift is cheaper than lift alone"** likely belongs here too: with the veil on its own layer, Chrome
  re-layers what is drawn above it. Not chased further.

## Proposal (0.4), in short

**Mechanisms considered:**

| Mechanism | Switch to screen, 30 % expanded (lens / Focus, on) | Pan and zoom | Assessment |
| --- | --- | --- | --- |
| F1 as it is | 436 / 285 ms | rAF within 5 % except −7.1 %; presented frames unknown | misses S4P-02 by 2–4×; out |
| F4 as it is (veil with holes on its own layer) | 86 / 44 ms | rAF −8.4 to −11.6 % at 30 %; +55 MiB; presented frames unknown | the only built candidate within the switching bar; panning cost to be measured as presented frames |
| F1 with lit cards drawn again above the veil | probably low | an extra layer, as F4 | duplicates up to half the cards' DOM; poor fit with AD-24's element rule; not proposed |
| B2: F4's veil in the big layer, no own layer, no lift | expected about 70–90 / 12 ms, if the veil stays in the big layer | expected as fading off | depends on the layer check, which refutes its premise |
| F4 dropping its layer during a pan | as F4 | as fading off during the pan | re-raster at every pan's start and end; complex; not proposed |

**The method change:**
- **Interactions to the screen:** fading, C-10, the lasso, and later requirement cards and drag targets. Measured from a
  settled screen, with the fixed anchor and a settled check of "no raster running at the start, and the last raster
  already presented". The in-page time stays as a breakdown.
- **Pan, zoom and drags as presented frames:**
  - the same wheel driver, with a light trace (`viz`, `gpu`, `benchmark`, `graphics.pipeline`, `blink.user_timing`);
  - presented fps = GPU presents ÷ the pan's length;
  - frames over 50 ms = present intervals over 50 ms;
  - `PipelineReporter` states as a cross-check;
  - one untraced pan per case and round to know the trace's own cost;
  - rAF intervals kept as a breakdown.
- **C-08 to its last present.**
- **Sitting length:** settled switching runs 10 pairs per case and round; 4b-1's closing sitting is about 2–2.5 h.

**Doc corrections for 4b-1's PR:**
- **`docs/known-limitations.md`:**
  - "Where the canvas stands": S4P-02 missed to the screen; S4P-03, pan and zoom, C-09 and the drags "measured as rAF
    intervals; presented frames unverified"; C-10 20 ms and the lasso 43 ms to the screen; C-08 met in page, its last
    raster not included.
  - Replace "Fading's slow switches at 30 %" with the lift's re-raster, the decomposition and the explanation of the
    bimodal mode.
  - A new entry for the method.
- **`docs/prd/slice-04p-acceptance.md`:** a section "Corrections after slice 4b-1, step 0" (4p's own text stays as it
  was measured):
  - S4P-02 missed to the screen;
  - S4P-03 unverified;
  - the lasso's and C-10's to-screen figures;
  - C-08's last raster;
  - F4's rejection rested on rAF pan figures (unverified), while its memory and Layerize stand;
  - F1-or-F4 reopened, with this decision.
- **`docs/decisions.md`, AD-24 "Overlay and fading":** reworded after 4b-1's closing sitting, with Łukasz's approval.

## Decision (Łukasz, 15 October 2026)

A shorter path than proposed: no separate decision sitting before 4b-1's feature work.

- **F1 is out as it is.**
- **4b-1 builds the lens and Focus on F4** (`perf/4p-trial-f4`), because the layer check refuted B2's premise (Łukasz's
  rule: B2 if the check confirmed it, otherwise F4). B2 stays the fallback.
- **The method change is accepted as proposed:** to the screen, presented frames, the fixed settled check, C-08 to its
  last present. The tooling is 4b-1's first step, not a step before the slice.
- **4b-1's closing sitting measures F4 with the deciding rule,** in every view measured:
  - switching ≤ 100 ms to the screen;
  - pan and zoom with fading on within 5 % of fading off, as presented frames.

  If it misses, we talk.
- **The doc corrections above land in 4b-1's PR.** AD-24 is reworded after the closing sitting, with Łukasz's approval.
