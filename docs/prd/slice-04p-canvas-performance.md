# Slice 4p – Canvas performance review

Status: **step 0 accepted**, 14 October 2026 (steps and S4P-08 changed after the baseline, Łukasz, 14 October). Branch `slice/04p-canvas-performance`. Starts from `main` at tag
`slice-04a` (`5e02c96`).

## 1. Why this slice

Slice 4b brings the requirement lens, and Focus (D-22) comes with it. Both fade most of the canvas and keep a set of
cards, rows and lines lit (prototype `applyHighlight()`: a selected requirement is Focus that is always on). Today the
only comparable effect, the hover highlight C-10, takes about 170–190 ms against a bar of 100 ms, because it repaints
the SVG line layer. The prototype fades with `opacity` on every card, which AD-24 rule 4 forbids. So 4b needs a fading
mechanism that is cheap to switch and does not slow pan and zoom while it is on. Finding it is the **main goal** of this
slice; the rest are the “partly met” items and open questions collected in `docs/known-limitations.md` since slice 1a.

Slice 2p closed without changing the renderer. To avoid an open-ended search, every trial here ends with a verdict,
**adopted** or **rejected**, with its figures; a rejection with figures is a full result (section 5).

Order agreed with Łukasz on 13–14 October 2026: **4a → 4p → 4b with Focus**.

## 2. Sources

- `docs/known-limitations.md`: “Canvas performance (slice 1a)” and “Frame cost grows with the number of elements in the
  viewport (slice 3a)”, the requirement index rebuild note (slice 4a).
- `docs/prd/slice-02p-acceptance.md`: the measuring method (`npm run measure:canvas`, sittings, dropped rounds), the
  line-renderer trial (`perf/canvas-lines-trial`) and why it lost.
- `docs/prd/slice-03a-acceptance.md`: the Chrome traces (`.data/measure/diag-3a`, `diag-3a-after`), Layerize per frame.
- `docs/decisions.md`: AD-24 (rules for the canvas, the reference machine), AD-31 (measurement-only build), D-22, D-32,
  D-39.
- Prototype: `applyHighlight`, `relatedOf`, `reqScope`, `focusCtx`, and the CSS `.card.dim` (25 %), `.frame.dim` (35 %),
  `.rq-card.dim` (25 %), `#notes .nt.dim` (30 %), `.trace-rq.fade` (8 %), `.row.hl`, `.row.rq` (covered, blue),
  `.row.gap` (gap, orange).

## 3. What to do

### Measuring

1. **Harness.** `npm run measure:canvas` keeps its sides and rounds (this branch against `slice-04a` in the sibling
   worktree, the starting side changing each round) and gains the fading scenarios of item 2. A fading scenario runs on
   this branch only, because `slice-04a` has no fading; it is compared with the same branch with fading off, in the same
   round.
2. **Fading scenarios**, on “Performance test” at 100 % and 30 %, frames expanded and collapsed:
   - **Focus:** lit = the entity with the most relationships and everything `relatedOf` gives for it (prototype);
   - **Lens, small:** lit = the scope of a requirement linked to one entity's attributes, with its rows coloured
     (covered blue, gaps orange);
   - **Lens, large:** the same for a requirement whose scope covers about half of the cards in view;
   - for each: the time from switching fading on (and off) to the first frame showing it, median of 40; pan and zoom
     with fading on (fps, frames over 50 ms).
   The two requirements are added to `seed:large` with their links. They have no cards, so the canvas draws the same
   elements as on `slice-04a` (as S4A-14 showed).
3. **Switch for measuring.** Fading is switched from code through a hook that exists only in the e2e dev server and the
   measurement build (as slice 2p's test hook; a normal production build does not expose it). The hook takes “Focus on
   {entity}”, “Lens on {requirement}” or “off”; there is no user interface for it in this slice.
4. **What fading must look like** (prototype levels): out-of-scope cards at about 25 %, frames 35 %, notes 30 %, lines
   faded; lit cards, rows and lines unchanged; in a lens, the scope's attribute rows coloured covered or gap. The exact
   technique is free as long as it looks the same to the eye; Łukasz judges it from screenshots (S4P-04).

### Trials (each on its own branch, tagged `perf/4p-trial-{name}` when its verdict is given)

5. **Trial A, overlay on its own compositing layer** (the untested idea in `known-limitations.md`, and the approach AD-24
   names for C-10): the hover highlight (C-10) and the lasso marks are drawn in an overlay layer that is composited
   separately, so their changes do not repaint the SVG line layer.
6. **Fading candidates** (hypotheses; step 0 judges which are feasible with React Flow):
   - **F1, veil:** one semi-transparent element over the canvas in the canvas background's colour; lit cards are lifted
     above it (z-index on the lit cards only), and lit lines are drawn again in the overlay above it, so the full line
     layer stays untouched under the veil;
   - **F2, two layers of cards:** out-of-scope cards in a container with the opacity on the container, lit cards in
     another; only valid if cards can move between containers without remounting;
   - **F3, the overlay from trial A** carrying the lit lines and row colours, combined with F1 or F2 for the cards.
   Step 0 may add a candidate it finds better, with its reasoning, before step 2 starts.
7. **Notes on their own compositing layer** (option c from slice 3a): their paint and Layerize no longer part of the
   cards'. It touches AD-24's rules on layers; measure GPU memory and raster time as well as fps.

### Smaller items

8. **Error boundaries.** Today there is no `error.tsx`, `not-found.tsx` or `global-error.tsx`. Add them, and a boundary
   around the canvas so that an error inside the canvas shows a message in its place while the panels and the top bar
   stay usable. Wording proposed at step 0 (e.g. “Something went wrong on this canvas.” with “Reload”). The e2e test
   throws through a test hook that exists only in the e2e dev server.
9. **C-08 diagnosis** (initial render, about 1.5 s against its bar since slice 1a; never diagnosed, slice 2p's step 4 was
   dropped): a trace of the first render on “Performance test”, split into data loading, React work, layout, paint and
   Layerize, and a proposal. **No fix in this slice.**
10. **Requirement index in the browser**: the build time in the measurement build on the reference laptop, for the demo
    data and for the synthetic model of slice 4a (500 requirements, 5,000 attributes, 2,000 mappings, 3,000 links).
    Above 50 ms per build, propose an incremental rebuild for 4b; below, no change.

### Out of scope

Card resize (C-09), single-card and group drags (they depend on the card's rows and need a decision on the card's look),
Focus's button and shortcut, the lens in the requirement panel, notes as rich text, the view-state bar (slice 6).

## 4. Steps (stop after each one)

0. **Check, harness and baseline.** `git remote -v`, branch, last commit; `main` at `slice-04a`. Answer section 7.
   Extend the harness (items 1–3), add the two requirements to `seed:large`. Baseline sitting: this branch against
   `slice-04a`, with the application code still the same, so the difference is the method's spread (as slice 2p's
   step 0). Measuring commands only after Łukasz's OK; he prepares the laptop.
1. **Trial A, built** (item 5), on its trial branch: the overlay on its own compositing layer, used for the hover (the
   hovered lines drawn above the cards, Łukasz after step 0) and for the row and lasso marks. No sitting in this step:
   the affected e2e tests, and the hover screenshots for S4P-04.
2. **Fading candidates** (item 6), F1 and F4 built on trial A's overlay, each only as far as needed to measure the
   scenarios of item 2 and to take the screenshots of item 4. Then **one sitting** measuring C-10, the lasso marks and
   every fading scenario; the verdicts for trial A, F1 and F4 come from it. Łukasz chooses.
3. **The chosen mechanism, finished**, as a canvas capability 4b can use (section 6), with unit tests for what it lights;
   then trial for item 7 (notes layer) and its verdict.
4. **Error boundaries, C-08 diagnosis, index timing** (items 8–10).
5. **Wrap-up.** Final balanced sitting against `slice-04a` (all scenarios, frames expanded and collapsed), acceptance
   tests, three full e2e runs in a row, docs (section 9), Łukasz's manual checklist.

## 5. Acceptance criteria

“Sitting” means a balanced sitting on the reference laptop (AD-24), prepared by Łukasz, in the measurement build, with
one unrecorded warm-up run after the build.

| ID | Criterion |
| --- | --- |
| S4P-01 | Baseline sitting `slice-04a` against itself with the extended harness, figures and spread recorded. |
| S4P-02 | Fading, chosen mechanism: switching on and off ≤ 100 ms (median of 40) in every scenario of item 2. |
| S4P-03 | Pan and zoom with fading on: not worse than 5 % against fading off, same branch, same sitting; no more frames over 50 ms than with fading off plus the baseline's spread. |
| S4P-04 | Fading looks as item 4 describes: screenshots of Focus, small and large lens, at 100 % and 30 %, beside the prototype's, approved by Łukasz. |
| S4P-05 | C-10 hover: verdict with figures; met if ≤ 100 ms. |
| S4P-06 | Lasso marks: verdict with figures; met if ≤ 100 ms. |
| S4P-07 | Notes layer: verdict with fps, Layerize per frame, GPU memory and raster time. |
| S4P-08 | No regression with fading off against `slice-04a`, judged on three-round medians: pan and zoom (100 % and 30 %, frames expanded and collapsed) not worse than 5 %, or within the baseline's spread; C-08, C-09 and the drags within the baseline's spread. C-09 is compared against the baseline's steady side difference of +7.2 % (same code): a regression is a change below +2.2 % (+7.2 % − 5 %), not below −5 %. |
| S4P-09 | Error boundaries: an error in the canvas shows the message, the panels and top bar still work, “Reload” recovers; an unknown route shows the not-found page. e2e test. |
| S4P-10 | C-08 diagnosis written in the acceptance doc, with the trace's split and a proposal. |
| S4P-11 | Requirement index timing in the browser, with the verdict of item 10. |
| S4P-12 | Guards: canvas viewport element counts with fading off identical to slice-04a's (S4A-14's method), or every difference explained (e.g. a layer wrapper); `__imCanvasCommits` and `__imMiniatureCommits` unchanged by switching fading; S2C-12, S3A-14 idle, S3B-15 idle pass. |
| S4P-13 | CI, unit tests, and three full e2e runs in a row; changed earlier tests listed. |

**Done** when every row has a result. S4P-05 to S4P-07 may end as “rejected” with figures; S4P-02 and S4P-03 must be met
by the chosen mechanism. If no candidate meets them, step 2 ends with the best candidate, how far it misses, and
Łukasz's decision whether 4b goes ahead with it.

## 6. What 4b gets

- A canvas capability that takes what to light (cards, rows with an optional covered or gap colour, lines) or nothing,
  and fades the rest as item 4 says. Pure functions in `domain` compute the lit set for Focus (`relatedOf`) and for a
  requirement (its scope from the requirement index, with each row's colour).
- The measuring hook (item 3) stays for 4b's measurements.
- No user interface: Focus's button, shortcut and view-state chip, and the lens in the requirement panel, are 4b.

## 7. Questions for step 0

- **Q1.** How does C-10 draw today (which layers change, what repaints), and which e2e tests read it (S1B-10 and others)?
- **Q2.** F1: can lit React Flow nodes be lifted above a veil by z-index alone, without re-rendering the others? How are
  lit lines drawn above the veil?
- **Q3.** F2: can a node move between two containers without remounting? If not, drop F2 and say why.
- **Q4.** Any candidate step 0 finds better than F1–F3, with reasoning.
- **Q5.** The hook for measuring: name, gating (same flag as slice 2p's test hook?), and what it accepts.
- **Q6.** The two requirements for `seed:large`: which elements they link to, and the resulting lit counts in view.
- **Q7.** Error boundaries: where the canvas boundary sits, and the proposed wording.
- **Q8.** Can the harness record GPU memory and raster time (item 7), and how?

## 8. Rules for the trials

- A trial's code lives on its own branch; only the chosen mechanism and adopted trials come into
  `slice/04p-canvas-performance`. Every verdict is tagged and recorded in the acceptance doc with its sitting.
- A disturbed round is dropped and replaced, as in slice 2p, and the reason is recorded.
- No change to AD-24's rules without Łukasz's approval; if an adopted result changes them, AD-24 changes in the same
  PR as the code.
- Measuring commands only after Łukasz's OK.

## 9. Docs in this PR

- `docs/known-limitations.md`: the performance sections rewritten with the verdicts; what stays “partly met”.
- `docs/decisions.md` (only with Łukasz's approval): AD-24 if a layer rule changes; the fading mechanism as a rule for
  the canvas.
- `CLAUDE.md`: the new scenarios, the measuring hook, and how to run them.
- `docs/prd/slice-04p-acceptance.md`: sittings, verdicts, screenshots, the C-08 diagnosis, three runs, manual checklist.
