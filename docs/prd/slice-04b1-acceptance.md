# Slice 4b-1 – Acceptance

Status: **steps 1 to 7 accepted; step 8, part 1 (docs, checklist, builds, the sitting's plan) waiting for Łukasz; part 2 (the closing sitting) after he prepares the laptop.** Branch `slice/04b1-lens-focus`, from `main` at the tag `slice-04p`
(`052daaf`), draft pull request #13. PRD: `docs/prd/slice-04b1-coverage-focus.md`. Step 0:
`docs/perf/04b1-step0-switch-trace.md`.

## Step 8, part 1: docs, checklist, builds, the sitting's plan (17 October 2026)

Step 7 was accepted. Łukasz's answers:
1. **“Show everything”: left to slice 6** (D-39). Recorded in `docs/known-limitations.md` as a deliberate gap
   (“Focus without the view-state bar”), with the note that the “Focus” chip moves from the status bar to the
   view-state bar there.
2. **Run 3's S0-10 failure: accepted** as the known cold-start flake (noted in step 7's runs).

No measuring in this part.

### Docs (PRD section 9)

| File | What | State |
| --- | --- | --- |
| `docs/decisions.md` D-31, D-32, D-34 | as approved | applied in steps 4 and 6 |
| `docs/decisions.md` AD-24 | “Overlay and fading”: F4, the method rule | **waits for the sitting's figures** (part 2, Łukasz approves the text) |
| `docs/data-model-v2.md` | the coverage sentence | applied in step 4 |
| `docs/known-limitations.md` | **corrections** under “Where the canvas stands after slice 4p” (S4P-02 missed to the screen; S4P-03, C-09 and the drags as rAF figures, unverified as presented; C-10 20 ms and the lasso 43 ms to the screen; C-08's last present not included); “Fading's slow switches at 30 %” **replaced** by “Fading: F1's slow switches, and F4 instead” (the lift's re-raster, the bimodal mode explained, F4's open pan point with T1–T3); **C-08's 0.7 s idle corrected** (below); **a method entry** (“How canvas figures are measured since slice 4b-1”); “Requirements are not on the canvas yet” brought up to date with item 19's outcome (the dot); “Focus without the view-state bar” (new); the pinned-notes point closed in step 3; the palette's contrast in step 7 | done; F4's closing figures and “where the canvas stands after 4b-1” in part 2 |
| `docs/prd/slice-04p-acceptance.md` | new section “Corrections after slice 4b-1, step 0”: S4P-02, S4P-03, C-10, the lasso, C-08 (its idle an artefact), F4's rejection; 4p's own text unchanged | done |
| `docs/ideas.md` | “Entity-level requirements” marked resolved (link to the PRD); new: “Coverage by hierarchy”, “Link all attributes in an entity panel”; the palette's contrast (step 7) | done |
| `README.md` | status (4b-1 in review, 4b-2 next), what 4b-1 brings, the acceptance link | done |
| `CLAUDE.md` | “Overlay and fading” for F4, Focus and the coverage colours; the test hook's request forms; S4B1-09's and the screenshots' commands | done |

### C-08's “0.7 s idle”: an artefact

`scripts/c08-waiting.ts` now anchors on the page's `im:stable` mark when a trace has it, and falls back to 4p's
`navigationStart` otherwise. Re-run on the traces that have the mark (step 2's smoke, `2026-10-15-18-05`, five loads,
unprepared laptop, diagnosis only):

| | 4p's anchor (`2026-10-15-10-37`, 4p's sitting) | The mark (`2026-10-15-18-05`) |
| --- | --- | --- |
| The anchor's shift | – | the origin 1,067–1,132 ms before 4p's |
| Window: document end → stable frame | 1,038–1,045 ms | 984–1,028 ms |
| Main thread busy | 297–331 ms | 983–1,027 ms |
| Main thread idle | **709–748 ms** | **about 1 ms** |

With the right anchor, the main thread works through the whole window. Its work, a median per load (top-level tasks):

| Work | ms |
| --- | --- |
| React's scheduled work (`MessagePort::Accept`) | about 560 |
| incoming messages | about 165 |
| frames (`BeginMainFrame`) | about 145 |
| deferred scripts | about 70 |
| parsing | about 40 |

So 4p's idle was the shifted window, which held mostly the time after the page was complete. Recorded in
`docs/known-limitations.md` (C-08 entry) and in 4p's corrections. C-08's own figures, both ways, come from the sitting.

### Tooling changes for the sitting

The sitting runs `measure:canvas --only …`. Two things in it would have cost time or failed:
- **S4B1-09 on the reference side.** In traced mode every measuring spec is copied into the `slice-04p` worktree, and
  S4B1-09 needs this slice's helpers, so the reference's run would fail and stop the sitting. `colours` now runs on
  this branch only.
- **S4P-fading on the reference side.** S4B1-10 and S4B1-11 compare Focus on and off on this branch; the reference's F1
  fading was about 29 min per round that no criterion uses. With `--only`, `fading` now runs on this branch only.
  Without `--only` it still runs on both sides, as in slice 4p.
- **S4P-fading's scenarios.** `FADING_SCENARIOS=focus,lens-large` limits it to Focus on ent:23 and on REQ-102 (and to
  the four views around ent:23). 4p's lens-small and lens-dense cases are not 4b-1's criteria. Unset, it measures all of
  them.

These are measurement-only files; the three full runs below include them.

### Measurement builds

`npm run measure:canvas -- --prepare-only --against slice-04p` (17 October 2026, 1.4 min): the reference worktree
`../infomapper-ab-main` at `slice-04p`, and both measurement builds (`.next-measure`). The sitting uses them with
`--no-build`. No app code changed after the builds.

### The sitting's final plan

**Before:** Łukasz prepares the laptop (power, restart, nothing else running) and says so. No dev or measurement
server runs (ports 3200, 3300). Every command below checks the CPU before each side and replaces a disturbed round.

PowerShell:

```powershell
$env:FADING_SCENARIOS="focus,lens-large"
$env:SETTLED_PAIRS="1"; npm run measure:canvas -- --to-screen --only pan,c10,lasso,fading,colours --rounds 1 --no-build --against slice-04p; Remove-Item Env:SETTLED_PAIRS   # warm-up, discarded
npm run measure:canvas -- --to-screen --only pan,c10,lasso,fading,colours --rounds 3 --no-build --against slice-04p   # A
npm run measure:canvas -- --to-screen --only pan --diag collapsed --rounds 3 --no-build --against slice-04p          # B
npm run measure:canvas -- --to-screen --only c08 --rounds 1 --no-build --against slice-04p                           # C
```

bash:

```bash
export FADING_SCENARIOS=focus,lens-large
SETTLED_PAIRS=1 npm run measure:canvas -- --to-screen --only pan,c10,lasso,fading,colours --rounds 1 --no-build --against slice-04p   # warm-up, discarded
npm run measure:canvas -- --to-screen --only pan,c10,lasso,fading,colours --rounds 3 --no-build --against slice-04p   # A
npm run measure:canvas -- --to-screen --only pan --diag collapsed --rounds 3 --no-build --against slice-04p          # B
npm run measure:canvas -- --to-screen --only c08 --rounds 1 --no-build --against slice-04p                           # C
```

Then **D**, S4B1-13's element counts with Focus off (not timed): S4A-14-elements on the reference build for the
baseline, then on this branch against it (`ELEMENTS_BASELINE`), each difference explained (F4's layer, the markers).

| Part | Covers | Side | Per round | Rounds | Time |
| --- | --- | --- | --- | --- | --- |
| Warm-up | everything in A with one pair per case (`SETTLED_PAIRS=1`; the pans full length), discarded | both | about 21 min | 1 | about 21 min |
| A | **S4B1-09:** coverage colours, 4 views. **S4B1-10:** Focus ent:23 and REQ-102 switching, 4 views. **S4B1-11:** pan with Focus on against off. **S4B1-12, expanded:** pan and zoom (overview, dense), C-10, lasso, and C-08 untraced | branch about 27 min (fading 17, colours 4, pan, C-10 and lasso 4.5, server and CPU check 1.5); reference about 6 min | about 33 min | 3 | about 1 h 40 min |
| B | **S4B1-12, collapsed:** pan and zoom with every frame collapsed | both, about 3 min each | about 6 min | 3 | about 18 min |
| C | **C-08** to its stable frame and to its last present (S4P-10, five traced loads) | both | about 10 min | 1 | about 10 min |
| D | **S4B1-13:** element counts with Focus off against `slice-04p` | both | – | 1 | about 5 min |

- **Total: about 2 h 35 min,** plus about 33 min for each replaced round of A. That is a little over the PRD's 2–2.5 h
  and over step 1's estimate of 1 h 50 min. Step 1 counted neither the collapsed pans (B) nor the element counts (D),
  and timed S4P-fading's views for fewer cases. Without B it is about 2 h 15 min. B is S4B1-12's “frames collapsed”.
- **Not in the sitting:** S4B1-13's commit counters. S4B1-06 checks them in every e2e run (switching Focus: no canvas
  and no miniature commit), with S4P-12, S2C-12, S3A-14-idle, S3B-15-idle and S3B-13.

**Part 2's report** (as Łukasz asked):
- S4B1-09 to S4B1-13 with median, p95, max and the settled-check failures;
- C-08 both ways (in-page stable frame and last present) against the 1,500 ms bar;
- the calibration: presented fps with fading off against 4p's rAF figures (the presented 54 against rAF 45 seen in
  step 2's smoke);
- the proposed AD-24 text for Łukasz's approval (not applied).

### Manual acceptance checklist (Łukasz)

On a dev server with fresh demo data in the preview file. Stop it again before any e2e run.

PowerShell:

```powershell
$env:INFOMAPPER_DEV_DB=".data/preview-db.json"; npm run reset-dev-data; npm run dev
```

bash:

```bash
export INFOMAPPER_DEV_DB=.data/preview-db.json && npm run reset-dev-data && npm run dev
```

Open http://localhost:3000/sign-in, sign in as **Łukasz**, open Retail Co – DWH → Customer 360 → Customer & orders.

| # | Steps | Expected |
| --- | --- | --- |
| 1 | Look at Customer's header, then hover over its violet diamond. Open Customer's panel (click its header) and compare its Requirements section. | The diamond shows **4**. Its tooltip lists REQ-101, REQ-102, REQ-103 and REQ-105, in the panel's order. Sales Order and Order Line show 1 (REQ-104); no table shows one in the demo data. |
| 2 | In the left panel's Requirements tab, click **REQ-105**. | Nothing fades. On Customer, first_name, last_name and email have a blue bar at the left and a faint blue tint; birth_date has an orange bar and tint. The text stays fully readable. The panel says “3 of 4 covered”. |
| 3 | Click birth_date's row. In its panel, open the mapping from customers.dob and set it to **Approved**. Click REQ-105 again. | birth_date's row turns blue; the panel says “4 of 4 covered”. |
| 4 | With REQ-105 selected, zoom out below 40 % (the zoom box or Ctrl + wheel). | Rows are no longer drawn. A blue dot sits at the right end of Customer's header. Zoom back to 100 %. |
| 5 | With REQ-105 selected, click **Focus** in the toolbar. | Everything fades except Customer, customers and web_users with the lines between them. The rows stay coloured. The status bar shows the chip “Focus ×”. |
| 6 | Click Customer's header, then drag Customer by its header and drop it. | Focus moves: Customer, customers, web_users and Sales Order stay lit, the rest fades. Customer stays lit while it moves and after the drop. |
| 7 | Right-click Sales Order's header → **Turn Focus off**. Then right-click it again → **Focus on this**. Click × on the chip. | The fading goes, comes back around Sales Order, and goes again with the chip. The Focus button's pressed look follows each time. |
| 8 | Click Focus, then press F5. Then turn Focus on again and switch the project to **Order management** (top bar) and open the tab **Order lines & products**. | After F5, Focus is off (no chip, nothing faded). On the other canvas, Focus is off too. |

### Three full runs

No dev server, Playwright or measurement server running; each run from scratch, in a row:

| Run | Result | Time |
| --- | --- | --- |
| 1 | 172 passed | 27.6 min |
| 2 | 172 passed | 27.3 min |
| 3 | 172 passed | 27.3 min |

Lint, typecheck and the unit tests (976 in 72 files) pass.

## Step 7: Focus, and step 6's last answers (16 October 2026)

Step 6's follow-up was accepted. Łukasz's answers, built together with step 7 (PRD items 20–23):
1. **The “and N more” row gets the summary dot** for its hidden members (orange if any of them is a gap). S4B1-05
   checks it with a frame whose only member in scope is past the sixth.
2. **The palette's contrast: not now.** Recorded in `docs/known-limitations.md` (Text contrast) and in `docs/ideas.md`
   as a candidate for the ergonomics slice.

### What changed

| File | Change |
| --- | --- |
| `src/domain/model/lit.ts` | `targetLit(model, target)`: what Focus lights for each selection besides a requirement (prototype `relatedOf`), with `LitTarget`: an entity, a table (its columns' mappings with their ends), an attribute, a column, a mapping, a relationship, or several entities and tables (a frame's cards or a multi-selection). `focusLit` is its entity case. |
| `src/canvas/fade.ts` | `FocusTarget` = `LitTarget` or a requirement; keys `focus:<kind>:<id>` and `focus:several:<entities>\|<tables>` (an entity keeps 4p's `focus:<id>`); `focusOn`, a store of its own: on or off |
| `src/canvas/Focus.tsx` (new) | `focusTargetOf(selection, cards)`; `FocusDriver` (turns Focus and the selection into the fade request; off when leaving or switching canvas); `toggleFocus`; the toolbar's `FocusButton`; the status bar's `FocusChip` |
| `src/canvas/fade-canvas.tsx` | `useLit` works out every target with `targetLit`, a requirement with the index as before |
| `src/canvas/ModelCanvas.tsx` | the selection's Focus target, and `FocusDriver` |
| `src/app/.../c/[canvasId]/page.tsx` | the Focus button after the layer switch, as in the prototype |
| `src/app/_panels/status-bar.tsx` | the Focus chip after Requirements |
| `src/app/_panels/canvas-host.tsx` | “Focus on this” / “Turn Focus off” in the card menus (every role) and the attribute and column row menus |
| `src/canvas/CoverageLayer.tsx` | the “and N more” row's dot (`data-member="more"`) |
| `docs/known-limitations.md`, `docs/ideas.md` | the palette's contrast |

### How it works

- **On and off:**
  - the toolbar button (`aria-pressed`, the prototype's title, no shortcut);
  - “Focus on this” / “Turn Focus off” in a card's and a row's menu (the right-click has already selected it);
  - the chip “Focus ×” in the status bar.

  Turning it on with nothing selected toasts “Focus fades everything not connected to what you select.”
- **What it lights:** the selection's lit set (item 21). A change of selection moves it. With nothing selected, or a
  note, a label or a bundle, Focus stays on and fades nothing (prototype `relatedOf` has nothing for them). A
  requirement keeps its coverage colours.
- **Momentary:** a store in the page's memory, never saved; off after a reload. `FocusDriver` turns it off when the
  canvas is left or another one opens.
- **No canvas commit on switching:** the button, the chip and the menu set `focusOn`; only `FocusDriver` and the
  fading layer draw again. S4B1-06 checks that the canvas's and the miniature's commit counters stay as they were.
- **Every role** (item 23): the button, the chip and the menu entry are there for reviewers and readers too. A reader's
  card menu now has one entry, so it opens.

### Not built: “Show everything”

PRD item 22 says Focus also turns off with “Show everything” (the view reset). The application has no such reset:
- in the prototype it is the view-state bar's “Show all” (`data-vall`, D-39);
- that bar is not built yet (`docs/known-limitations.md`, "Live canvases without the view-state bar": slice 6).

I didn't add a reset, so as not to build a piece of D-39 in this slice. **A question for Łukasz:** leave it to the
view-state bar's slice (recorded as a deliberate gap), or add a reset now, and where?

### Assumptions

- **The chip sits in the status bar after Requirements**, as the PRD says (item 20). The prototype's view-state list is
  in the bar under the tabs.
- **Row menus:** the attribute and column rows (answer C). Frame, line and selection menus have no entry, as in the
  prototype. Focus on a frame or several items comes from the toolbar or the chip.
- **A frame's lit set** is what its cards light (the prototype's `relatedOf "frame"`). The frame's own outline stays
  under the veil, as since step 3.

### Tests

| Test | What |
| --- | --- |
| `src/domain/model/lit.test.ts` | six new cases: a table, an attribute, a column, a mapping and a relationship, several items, unknown or deleted ids |
| `src/canvas/focus.test.ts` (new) | the selection's target for every kind, and the keys |
| `e2e/slice-04b1/S4B1-06.spec.ts` (new) | **S4B1-06.** **On and off:** on from the toolbar (the hint, the chip), off from the chip, on and off from a card's menu, on from a column row's menu. **Lit sets:** Customer (written out) and an attribute, a mapping, a relationship, several cards, a frame and REQ-105 (with its colours), each against the domain. **Commits:** switching Focus commits neither the canvas nor the miniature. **Off** after switching canvas (and back) and after a reload. |
| `e2e/slice-04b1/S4B1-08.spec.ts` (new) | **S4B1-08.** Piotr (reviewer) and Kasia (reader): Focus from the toolbar, the chip and a card's menu, REQ-105's colours with Focus on; the data file unchanged. |
| `e2e/slice-04b1/S4B1-05.spec.ts` | a third test: a frame around all seven cards, collapsed; a requirement on the seventh puts one dot on the “and 1 more” row |

No earlier test changed in this step.

### Three full runs

No dev server, Playwright or measurement server running; each run from scratch:

| Run | Result | Time |
| --- | --- | --- |
| 1 | 172 passed | 27.5 min |
| 2 | 172 passed | 27.2 min |
| 3 | 171 passed, **1 failed: S0-10** | 29.6 min |

- **Run 3's failure is S0-10** (slice 0): “Server did not start within 300 s”. Its own restarted dev server on port 3201
  did not come up in time. This is the slow cold start seen before in slices 1a and 1b. No step 7 file is on its path,
  and it passed in runs 1 and 2. Not changed. **Accepted by Łukasz as the known cold-start flake;** no fresh set, since
  step 8 runs three in a row before the merge.
- **172** is step 6's 167 plus S4B1-06 (two tests), S4B1-08 (two) and S4B1-05's “and N more” test.
- Lint, typecheck and the unit tests (976 in 72 files) pass.

## Step 6 follow-up: Łukasz's answers (16 October 2026)

Step 6 was accepted. Łukasz's answers:
1. **Below 40 %: the dot.**
2. **Collapsed frames: yes.** The block's member row carries the same summary dot. S4B1-05 checks it, and S4B1-09
   measures the collapsed views too.
3. **D-32 approved** with three changes: "a violet diamond", the bracket filled with the dot, and the collapsed block's
   sentence. Applied.
4. **Contrast:** check the text under the tints at 4.5:1 (WCAG AA); if short, adjust the tint, not the text, with a
   before/after screenshot.

### What changed

| File | Change |
| --- | --- |
| `src/canvas/coverage-colours.ts`, `src/canvas/TestHooks.tsx` | the tint variant, its value store and `__imCoverageLod` removed: the dot is the only look below 40 % |
| `src/canvas/CoverageLayer.tsx` | a collapsed frame's block: the summary dot on each shown member's row (`coverage-block-dot-covered` / `-gap`, `data-block`, `data-member`); a header's mark is a faint fill and a bar along its bottom edge |
| `src/canvas/fade-canvas.tsx` | `LitRows`: each row a faint fill and a 4 px bar in the full colour in the row's left padding (Focus's rows too, which share it) |
| `src/canvas/canvas.css` | the fills' opacities set for 4.5:1 (light .06 blue, .04 orange; dark .16); bars and dots in the full colour |
| `docs/decisions.md` | D-32 as approved |
| `CardNode.tsx`, `requirement-marks.ts`, `canvas.css` | the marker called a diamond in the comments, as it is drawn |

### The dot on a block's rows

- **At 40 % and above,** the dot (7 px) sits at the row's right end, in the 12 px padding after the count. On the left it
  would sit beside the kind marker, and an entity's is a blue dot too.
- **Below 40 %** the block's body is plain (AD-24 rule 1). The dot is larger (18 px) and sits where a card header's
  dot is, one per member row.
- **Members past the sixth** are not listed in the block; their row is "and N more". They get no dot (question below).

Screenshots in `docs/prd/slice-04b1-screens/step-6b/`: `demo-req-105-100-collapsed.png`, `demo-req-105-30-collapsed.png`
(a frame around Customer and Sales Order, REQ-105: Customer's row orange, Sales Order's none). The cards' dots at 30 %:
`demo-req-105-30.png`, `demo-req-101-30.png`, `perf-req-102-30.png`.

### Contrast under the tints

**The tints failed by far.** The overlay lies above the cards, so a translucent fill lies over the text as well and
lightens it as much as the background. Measured on the screenshots' pixels (darkest text pixel against the background):

| Text | Plain card | Before (step 6) | After |
| --- | --- | --- | --- |
| attribute name (covered row) | 16.2 | 2.2 | 14.4 |
| attribute name (gap row) | 16.2 | 1.7 | 15.1 |
| entity name (covered header) | 16.2 | 2.2 | 14.4 |
| stereotype "Object" (header) | 7.4 | 1.6 | 5.0 |
| data type, count (grey) | 3.3 | 1.3–1.5 | 3.0–3.2 |

**The adjustment** changes the tint, not the text:
- **The fill** is the strongest at which every text that reaches 4.5:1 on a plain card keeps 4.5:1. That is .06 for
  blue and .04 for orange in light mode, and .16 in dark mode (computed; dark not screenshot). The source key's brown
  ("PK" on a table's row, 4.8:1 plain) sets the light limit.
- **A bar in the full colour** carries the colour where no text is: 4 px in a row's left padding, and 3 px along a
  header's bottom edge (10 px below 40 %).

Before/after: `docs/prd/slice-04b1-screens/step-6b/contrast-before-after.png`. From left to right: REQ-105 before, after;
REQ-101 before, after.

**What stays short, without any tint:**
- **The grey texts** (`--im-ink-3`: data types, counts, key letters, "in Customer") are 3.6:1 on a plain white card
  (computed; 3.3 measured with anti-aliasing) and 4.1:1 in dark mode.
- **The PII tag** (orange on its light orange) is 4.4:1.
- **The BK tag** (brown on its light brown) is 4.1:1.

These are the palette's, not the tints'. No tint can fix them, and changing them is not this step's. A question for
Łukasz below.

### Questions for Łukasz

1. **Members past the sixth** in a block (the "and N more" row): give that row the summary dot of those members (orange
   when any of them is a gap)? Not built. Today a frame whose only member in scope is the seventh shows no dot.
2. **The grey text** (`--im-ink-3`) and the PII and BK tags are below 4.5:1 on a plain card. Record it in
   `docs/ideas.md` for a palette change later, or change it now?

### Tests

| Test | What |
| --- | --- |
| `e2e/slice-04b1/S4B1-05.spec.ts` | a second test: a frame around Customer and Sales Order, collapsed. REQ-105: Customer's row an orange dot, Sales Order's none. REQ-101: blue. Escape clears. The header checks find the header's mark as before. |
| `e2e/slice-04b1/S4B1-09.spec.ts` | the collapsed views are measured (a dot is checked first), no longer "not applicable". Not run: a measurement, it waits for the closing sitting. |
| `e2e/slice-04b1/S4B1-06-screens.spec.ts` | the dot at 30 % and the collapsed block at 100 % and 30 %, instead of the two variants |

### Three full runs

No dev server, Playwright or measurement server running; each run from scratch:

| Run | Result | Time |
| --- | --- | --- |
| 1 | 167 passed | 26.2 min |
| 2 | 167 passed | 26.7 min |
| 3 | 167 passed | 26.5 min |

Lint, typecheck and the unit tests (965 in 71 files) pass. 167 is step 6's 166 plus S4B1-05's collapsed-frame test.

## Step 6: coverage colours (16 October 2026)

PRD items 16–19. Selecting a requirement (from the Requirements tab, its panel, a go-to link or the project home)
colours its scope on the open canvas, with nothing faded:
- attribute items' rows: blue when covered, orange when a gap;
- entity items' headers: tinted the same way;
- linked columns' rows and linked tables' headers: blue;
- linked mappings: their lines drawn lit.

Selecting anything else, a click on empty canvas or Escape clears the colours.

### What changed

| File | Change |
| --- | --- |
| `src/canvas/coverage-colours.ts` (new) | `coverageColours(index, requirementId, entityOf, tableOf)`: the rows, the headers, the lit mappings and each card's summary (orange when any of its items in scope is a gap) from the requirement index; `lodVariant`, item 19's variant below 40 % as a value store (`tint` by default). |
| `src/canvas/CoverageLayer.tsx` (new) | draws them in `OverlayLayer` above the fading, from positions computed from data (AD-24 rule 2): rows with `LitRows`, header tints and the dots as one SVG, lit lines with `LitLines`. No card's own class or style changes. |
| `src/canvas/ModelCanvas.tsx` | `CoverageLayer` after `FadeLayer` in the overlay, with the selected requirement (`selection.t === "req"`) and the canvas's requirement index (step 5's) |
| `src/canvas/LineLayer.tsx`, `fade-canvas.tsx` | `LitLines` and `LitRows` take their test ids, so Focus's and the coverage colours' copies can be told apart (`layer-coverage-lines`, `layer-coverage-rows`, `coverage-row-covered` / `-gap`). The rows carry `data-row`. |
| `src/canvas/canvas.css` | below 40 %, the header tints in the full colour at 35 % opacity (`.lod`); the dot variant's dots |
| `src/canvas/TestHooks.tsx` | `__imCoverageLod("tint" \| "dot")`, for the screenshots (test hooks only) |
| `scripts/measure-canvas.ts`, `playwright.config.ts` | S4B1-09 in the to-screen table (`--only colours`); kept out of normal e2e runs (measurement build only) |

### The smoke: colours to the screen, and answer B

S4B1-09 on the rebuilt measurement build: “Performance test”, REQ-102 (46 attribute rows) selected from its row and
cleared with Escape. Two runs, 5 settled pairs each, traced, unprepared laptop; smoke figures, not a verdict:

| View | Switch | To screen median / p95 / max, ms | Main thread, ms (median) | Not settled |
| --- | --- | --- | --- | --- |
| 100 %, expanded | on | 78 / 108 / 108 and 83 / 125 / 125 | 77–81 | 0 |
| 100 %, expanded | off | 72 / 77 / 77 and 72 / 78 / 78 | 72 | 0 |
| 30 %, expanded | on | 42 / 56 / 56 and 41 / 54 / 54 | 37–38 | 0 |
| 30 %, expanded | off | 42 / 63 / 63 and 39 / 50 / 50 | 37–40 | 0 |
| 100 % and 30 %, collapsed | – | not applicable: REQ-102's cards are in blocks, and blocks show no colours (question below) | | |

- **The medians are within 100 ms,** so under Łukasz's answer B the one `ModelCanvas` commit on selecting a
  requirement stays. S4B1-13 reads “one commit on selecting a requirement, as for any selection; none on switching
  Focus”. **No selection store.**
- **Almost all of it is the main thread** (the selection's canvas commit and the panel; raster under 3 ms): the colours
  themselves are cheap to draw.
- **The p95 and max at 100 % (108–125 ms on)** are over 100 ms in the smoke. The closing sitting gives the proper
  figures; S4B1-09's bar is on the median.

### How the lit lines and rows are drawn, and their layers

**Today's way, in the overlay, with no work for it:**
- The rows, header tints and dots are one SVG each (rows; headers and dots), and the lit lines one SVG (`LitLines`).
- None has `will-change`, and none is drawn in the canvas's big layer.

In step 3's diagnosis, Focus's lit lines had a layer of their own (22–31 Mpx), even with the veil hidden.

**CDP `LayerTree`** (`.data/measure/s4b1-step6-diag/`). “Performance test”, around ent:23, frames expanded; REQ-101
of `seed:large` linked to two mappings for the check:

| View | Selected | Drawing layers | Total Mpx | Coverage layers |
| --- | --- | --- | --- | --- |
| 100 % | nothing | 53 | 67.8 | – |
| 100 % | REQ-102 (46 rows) | 54 | 75.7 | rows 1,758 × 4,466 (7.9 Mpx) |
| 100 % | REQ-101 (6 rows, 2 lit lines) | 54 | 70.3 | rows 618 × 4,026 (2.5 Mpx); the lit lines no layer of their own |
| 30 % | nothing | 54 | 69.6 | – |
| 30 % | REQ-102 | 55 | 77.2 | headers 1,758 × 4,330 (7.6 Mpx) |
| 30 % | REQ-101 | 55 | 71.9 | headers 618 × 3,708 (2.3 Mpx) |

- **The coverage SVG gets one layer of its own,** the size of what it draws: 2–8 Mpx, against the veil's 2,195 Mpx in
  step 3's diagnosis.
- **The lit lines had none in this read.** That was two lines. Whether a large set of lit coverage lines gets a layer
  of its own, as Focus's did, this read doesn't settle; no requirement in `seed:large` links many mappings.

So no large layer for the rows, the headers or a few lit lines, without changing how they are drawn. For many lit lines
the question stays open (step 3's T3 is the candidate).

### The rows' look

- **The tints lie translucent over the rows,** in the overlay above the cards, as 4p's lens did. The rows' text looks
  lighter than in the prototype, where the row's background is coloured.
- **`mix-blend-mode: multiply` was tried and dropped.** The overlay is its own composited layer, so the tints blended
  only with its transparent backdrop and came out opaque. A separate blend layer would cost GPU time on every pan with
  colours on, Focus with a requirement included (S4B1-11).
- **The 4p look stays.** Łukasz accepted it for the lens in 4p.

### Item 19: below 40 %, two variants for Łukasz

Screenshots in `docs/prd/slice-04b1-screens/step-6/`:

| File | What |
| --- | --- |
| `demo-req-105-100-app.png`, `demo-req-105-100-prototype.png` | REQ-105 at 100 %: the three covered rows blue, birth_date orange; the prototype's lens beside it |
| `demo-req-101-100-app.png` | REQ-101 at 100 %: Customer's header tinted blue (an entity item, covered) |
| `demo-req-105-30-tint.png`, `demo-req-105-30-dot.png` | REQ-105 at 30 %: Customer's header tinted orange (a gap among its items), or a dot at its right end |
| `demo-req-101-30-tint.png`, `demo-req-101-30-dot.png` | REQ-101 at 30 % |
| `perf-req-102-30-tint.png`, `perf-req-102-30-dot.png` | “Performance test”, REQ-102 at 30 %: four cards with gaps |

**What the header colour means at each zoom level:**
- **At 40 % and above,** a header tint marks an entity item or a linked table. Blue on an entity means “this directly
  linked entity has a source” (at least one attribute covered); orange means it has none. The rows carry the attribute
  items.
- **Below 40 %, the tint variant:** every card with something in scope gets a header tint. Blue means everything on
  this card in scope is covered; orange means at least one item on it is a gap. So the same blue means two different
  things at the two zoom levels.
- **Below 40 %, the dot variant:** the headers keep their meaning from 40 % and above, and a dot at the header's right
  end carries the summary. Blue or orange, as the tint variant's colour.

**Proposal:** the dot. It keeps one meaning per mark at every zoom. The tint is easier to see at 10–30 %. Łukasz
decides from the screenshots.

### Question for Łukasz: collapsed frames

With frames collapsed, the cards in scope are hidden in their frames' blocks, and nothing is coloured: the PRD names
cards only. A block lists its member cards as rows (prototype `blockCard`).

**Proposal:** tint a member's row in the block by its card's summary (blue or orange), one rectangle per member in
scope, in the same overlay. Not built.

Until it's decided, S4B1-09 records the collapsed views as not applicable.

### Proposed text for `docs/decisions.md` D-32 (for Łukasz's approval; not applied)

**D-32, now:** “On the canvas: markers on cards, a lens when a requirement is selected (covered rows blue, gaps orange),
and optional requirement cards with dashed trace lines.”

**D-32, proposed:**

> On the canvas: requirement markers on entity and table cards (a violet dot and the number of requirements the card's
> panel lists, the list as its tooltip). Selecting a requirement colours its scope without fading anything:
> attribute items' rows blue when covered and orange when a gap, entity items' headers the same way, linked columns'
> rows and linked tables' headers blue, and linked mappings' lines drawn lit. Below 40 % a card's summary (orange when
> any of its items in scope is a gap) stands for its rows, as [a dot at the header's right end | a header tint]
> (Łukasz's choice in step 6). Fading the rest is always Focus (D-22), also for a requirement. (Changed in slice 4b-1.)
> (Requirement cards with dashed trace lines: slice 4b-2.)

### Tests

| Test | What |
| --- | --- |
| `src/canvas/coverage-colours.test.ts` (new) | attribute items' colours and the card's summary; an entity item's header; a linked column, table and mapping; nothing without a requirement or an index |
| `e2e/slice-04b1/S4B1-05.spec.ts` (new) | **S4B1-05.** **REQ-105:** covered rows blue, birth_date orange, no fading. **REQ-101:** Customer's header blue. **After approving birth_date's mapping:** blue; with REQ-105 still selected, an undo turns it orange and a redo blue. **Clearing:** Escape and a click on empty canvas. **Cards' look:** every card's own class and style unchanged (DOM). |
| `e2e/slice-04b1/S4B1-09.spec.ts` (new, measurement build only) | **S4B1-09:** colours to the screen, REQ-102 selected and cleared, 100 % and 30 %, frames expanded (collapsed: not applicable for now) |
| `e2e/slice-04b1/S4B1-06-screens.spec.ts` (new, with `SCREENS=<folder>` only) | the screenshots above |
| `e2e/slice-04a/S4A-14.spec.ts` (changed) | `drawn()` counts only the line layer's own lines, not the lit copies in the overlay (as planned in Q5) |

### Three full runs

No dev server, Playwright or measurement server running; each run from scratch:

| Run | Result | Time |
| --- | --- | --- |
| 1 | 166 passed | 26.2 min |
| 2 | 166 passed | 26.9 min |
| 3 | 166 passed | 27.2 min |

Lint, typecheck and the unit tests (965 in 71 files) pass. 166 is step 5's 165 plus S4B1-05; S4B1-09 and the screens
spec run only when asked (measurement build, `SCREENS`). The idle-commit guards (S2C-12, S3A-14-idle, S3B-15-idle,
S3B-13), S4P-12 and S4A-14 pass with the coverage layer.

## Step 5: markers on cards (16 October 2026)

PRD items 14–15. Before the step, Łukasz approved the D-31 and D-34 texts (D-34 ending “Clicking a requirement opens
its panel.”, then “(Placing requirement cards from panels and ‘Add all’: slice 4b-2.)”) and the data model's
sentence, and asked for `seed:large`'s REQ-102 on the 46 attributes. All of it is committed in `3739df1` (docs and test
data only).

### `seed:large`'s REQ-102: the lit set before and after

Focus on REQ-102 (“Performance test”), worked out from the seed by the domain's `requirementFocusLit` (scratch script in
`.data/measure/s4b1-step5/`):

| REQ-102 | Links | Cards lit (entities + tables) | Lines lit | Attribute rows in scope |
| --- | --- | --- | --- | --- |
| 4a's scope (an entity link brings its attributes), as slice 4p and step 0 measured | 4 entities | **29** (4 + 25) | **29** | **46** |
| Step 4's scope, before the seed change | 4 entities | 4 (4 + 0) | 0 | 0 |
| **Now** (the 46 attributes linked) | 46 attributes | **29** (4 + 25) | **29** | **46** |

So the large set is the same as before, and S4P-fading's "lens-large" and S4B1-10's requirement case stay comparable
with slice 4p and step 0. Its coverage is 4 of 46 items (46 attributes).

### What changed

| File | Change |
| --- | --- |
| `src/canvas/requirement-marks.ts` (new) | `requirementMarks(index, cards)`: for each entity and table card, the number of requirements its panel lists (direct and indirect) and the tooltip, in the prototype's form (“Requirements: REQ-101 Single view of the customer” and a line per further requirement); none without requirements. `sameMark` compares two markers. |
| `src/canvas/CardNode.tsx` | `RequirementMarker`, one `<i class="rmark">` with the count, after the label and note marks in the header's first line (prototype order). A click on it does nothing (the card's click handler ignores it). The header's clip check counts its width. |
| `src/canvas/ModelCanvas.tsx` | The markers come from the canvas's requirement index (`useRequirementIndex`, once per data version) and the cards' targets. An effect writes a card's `reqMark` into its node data only when the marker changes, so no other card draws again. `toNode` keeps the pinned notes' number and the marker when the page's data merges in. |
| `src/canvas/text-fit.ts` | `reqMarkWidth`; `lineNeedsClip` takes the number of requirements |
| `src/canvas/canvas.css` | `.rmark` as the prototype's, the dot a rotated square in its `::before` (one element per marker, AD-24) |

- **At every zoom:** the header is drawn below 40 % too, so the markers are there (item 15).
- **Updates:** they follow link, unlink, delete and undo through the page's data: the canvas's index is rebuilt with
  each new data version.

### For the closing sitting (S4B1-13)

Markers add one element per marked card. In “Performance test” these are ent:19 (REQ-101 and REQ-102 via attribute),
ent:3, ent:4 and ent:7 (REQ-102 via attribute), and the four tables of REQ-103: up to 8 elements, those in view.
S4A-14-elements' counts will differ by them (and by F4's layer when Focus is on); S4B1-13 explains every difference.

### Tests

| Test | What |
| --- | --- |
| `src/canvas/requirement-marks.test.ts` (new) | counts what the panel lists, direct and indirect; the tooltip; no marker without requirements or without an index; `sameMark` |
| `e2e/slice-04b1/S4B1-04.spec.ts` (new) | **S4B1-04.** **Count and tooltip:** Customer 4 (REQ-101 directly, REQ-102, 103 and 105 via attribute), in the order of its panel; Sales Order and Order Line 1 each; no table has one. **Updates:** linking REQ-103 from order_line's panel adds its marker, unlinking takes it away; deleting REQ-104 takes Sales Order's and Order Line's away, and one undo brings them back. **Click:** nothing selected, nothing written. **At 30 %:** drawn. |

- **Checked in the browser** (preview server, stopped before the e2e runs): Customer's header shows the violet diamond
  and the count after the label mark, as the prototype does, with the tooltip listing the requirements.

### Three full runs

No dev server, Playwright or measurement server running; each run from scratch:

| Run | Result | Time |
| --- | --- | --- |
| 1 | 165 passed | 26.7 min |
| 2 | 165 passed | 26.9 min |
| 3 | 165 passed | 27.0 min |

Lint, typecheck and the unit tests (961 in 70 files) pass. The idle-commit guards (S2C-12, S3A-14-idle, S3B-15-idle,
S3B-13) and S4P-12 pass with the markers' effect.

## Step 4: the domain (16 October 2026)

PRD items 9–13: scope items, coverage over items, indirect requirements each with its own “via”, and the panels, the
Requirements tab, the project home, the status bar and the Overview on the new coverage.

### What changed

| File | Change |
| --- | --- |
| `src/domain/model/requirements.ts` | **Scope:** `RequirementScope` gains `entityItems` and `attributeItems`, and `scopeOfLinks` no longer adds a linked entity's attributes. **Coverage:** `RequirementCoverage` counts items; it gains `entityGaps` and `parts`, with `covered` holding entity and attribute ids. **New helpers:** `coverageParts` (“1 entity, 3 attributes”) and `ENTITY_GAP_REASON` (“no approved mapping on any attribute”). **Indirect requirements:** `ElementRequirements.indirect` carries a `via` per row (`"via attribute" \| "via mapping" \| "via column"`). **The lookup** gains mappings per attribute, mappings per column and columns per table. |
| `src/domain/model/requirement-index.ts` | `of(target)` follows PRD item 12: an entity via attribute and via mapping; an attribute via mapping; a table via column and via mapping; mappings and columns direct only; no “via entity”; each requirement once, as direct when it is both, else with the first way it was found; sorted in the requirements' order. The scopes-reach maps go. |
| `src/domain/model/lit.ts` | (no change) Focus on a requirement now lights only what the new scope says: an entity link lights the entity alone. |
| `src/canvas/fade-canvas.tsx` | The canvas's requirement index is built once per data version (`useRequirementIndex`), not per Focus request. The inspector builds its own from the same data; the canvas can't read the app layer's context (AD-19). |
| `src/app/_panels/requirement-panel.tsx` | **Coverage:** “In scope: {m} of {n} covered”, its tooltip naming the parts. **A row for entity gaps** (“Entities without an approved mapping”), shown only when the requirement has entity items. **The gap list:** entity items first (“Order Line · no approved mapping on any attribute”, a click opens the entity), then attribute items as before. |
| `src/app/_panels/requirement-ui.tsx` | `coverageText` (“{m} of {n} covered”); `coverageTitle` adds the parts in brackets (“1 of 4 covered (1 entity, 3 attributes)”), none without items; `CoverageBar` takes `parts`. |
| `src/app/_panels/requirements-section.tsx` | the indirect rows show their own `via` |
| `src/app/_panels/tree-data.ts`, `stats.ts`, `left-panel.tsx`, `project-requirements.tsx` | the rows carry `parts` for the bars' tooltips. The project home, the status bar and the Overview read the index's `coveredCount` and `done` as before (item 13). |

### The seed's figures (as agreed in step 1, Q5)

| Requirement | 4a | Now |
| --- | --- | --- |
| REQ-101 (entity Customer) | 5 of 8 | **1 of 1, covered** |
| REQ-102 | 3 of 3 | 3 of 3 |
| REQ-103 | 1 of 1 | 1 of 1 |
| REQ-104 | 1 of 4 | 1 of 4 |
| REQ-105 | 3 of 4 | 3 of 4 |
| Covered | 2 of 5 | **3 of 5** |

### A consequence for measuring: “Performance test”'s REQ-102

REQ-102 in `seed:large` (the "large lens", then Focus on a requirement) links four whole entities (ent:3, ent:4, ent:7,
ent:19). Under the new rules it has 4 entity items, and Focus on it lights those 4 cards only. Its 46 attributes, their
mappings and tables are no longer in scope. So S4P-fading's "lens-large" and S4B1-10's "requirement" case are no longer
a large set. **Question for Łukasz:** link REQ-102 to those four entities' attributes in `seed:large` instead, so it
stays the large set (about the same cards and lines as before)? That changes test data only; `model-store.test.ts` now
checks 4 entity items.

### Tests

| Test | What |
| --- | --- |
| `src/domain/model/requirements.test.ts` (changed) | **Scope:** an entity link is one item without its attributes; an attribute link adds its card's entity but no entity item; a mapping link adds its attribute; tables and columns are not items. **Coverage:** attribute items; an entity item covered by one covered attribute, a gap otherwise, the same type check; an entity and its attribute together; a table-only requirement 0 / 0; `coverageParts`. **Indirect lists:** each kind of element, once each, direct first. |
| `src/domain/model/requirement-index.test.ts` (changed) | covered count 3 (REQ-101 now covered); `via` per row |
| `src/domain/model/lit.test.ts` (changed) | an entity link lights the entity alone |
| `src/app/_panels/tree-data.test.ts`, `src/data/local/requirement-store.test.ts`, `model-store.test.ts` (changed) | the new figures (REQ-101 1 / 1; `seed:large`'s REQ-102: 4 entity items) |
| `e2e/slice-04b1/S4B1-01.spec.ts` (new) | **S4B1-01:** the seed's figures in the bars; an entity link (Order Line) is 0 of 1, still 0 after an approved mapping with a type conflict, 1 of 1 after a type-correct one; an attribute link and a mapping link one attribute item each; a table-only requirement 0 of 0; the status bar's count |
| `e2e/slice-04b1/S4B1-02.spec.ts` (new) | **S4B1-02:** email with its own and “via mapping”, no “via entity”; an attribute without its own gets nothing from its entity; Customer “via attribute” and “via mapping”; the table customers “via mapping” and “via column”; no × on indirect rows |
| `e2e/slice-04b1/S4B1-03.spec.ts` (new) | **S4B1-03:** “0 of 2 covered” with “1 entity, 1 attribute”; the entity gap first, then the attribute gap; its click opens Order Line's panel; the status bar, the project home (rows and statistic), the Overview and the left panel's bar agree |
| `e2e/slice-04b1/helpers.ts` | `requirementLinkedTo` and `approvedMapping` as test data through the domain |

**Changed earlier tests:**
- **S4A-01:** the bars' titles “1 of 4 covered (4 attributes)”, “3 of 3 covered (3 attributes)”.
- **S4A-07:** “REQ-101 via entity” → “REQ-104 via mapping” on email; REQ-104 “via mapping” on Customer and on the
  table; the title says so.
- **S4A-08:** REQ-101 1 of 1, no gaps; the bars' titles; the texts “{m} of {n} covered”.
- **S4A-13:** covered 2 → 3 of 5 (status bar, project homes, Overview), 3 → 4 after the approval; REQ-101's home row
  1/1.
- **`e2e/slice-04a/helpers.ts`:** a comment.
- **S4P-12:** Focus on REQ-101 lights 1 card (Customer) instead of 3.

### Checked in the browser

On the preview server (port 3001; stopped before the e2e runs), REQ-104's panel reads “In scope: 1 of 4 covered”,
with the tooltip “4 attributes”, the three gaps as before, and REQ-101's bar “1 of 1 covered (1 entity)”.

### Proposed text for `docs/decisions.md` (for Łukasz's approval; not applied)

**D-31, now:** “Coverage is computed: a requirement is covered when every attribute in its scope (direct, via entity,
via mapping) has an approved mapping without a type conflict.”

**D-31, proposed:**

> Coverage is computed from a requirement's items. A linked entity is one item, a linked attribute is one, and a linked
> mapping makes its attribute one. Links to tables and columns are in scope but are not items, and nothing is pulled
> in implicitly: an entity link does not bring its attributes. An attribute item is covered when it has an approved
> mapping without a type conflict. An entity item is covered when at least one of its attributes is covered that way.
> A requirement is covered when it has at least one item and all of them are covered. Coverage reads “{m} of {n}
> covered”, its tooltip naming the parts (“1 entity, 3 attributes”). (Changed in slice 4b-1.)

**D-34, now:** “Element panels list direct and indirect requirements; clicking places the requirement card next to the
element; “Add all”.”

**D-34, proposed:**

> Element panels list each requirement once: direct ones first, with × to unlink, then indirect ones, without ×. An
> entity's come via its attributes (“via attribute”) or via mappings onto them (“via mapping”); an attribute's via
> mappings onto it (“via mapping”); a table's via its columns (“via column”) or via mappings that read them (“via
> mapping”). Mappings and columns show their own only. There is no “via entity”. Clicking a requirement opens its
> panel; from slice 4b-2 it places the requirement card next to the element, with “Add all”. (Changed in slice 4b-1.)

**`docs/data-model-v2.md`, proposed** (one sentence after `requirement`'s table, also with Łukasz's approval):

> Coverage is computed, never stored (D-31), over the requirement's items: its linked entities, its linked attributes
> and the attributes of its linked mappings.

### Three full runs

No dev server, Playwright or measurement server running; each run from scratch:

| Run | Result | Time |
| --- | --- | --- |
| 1 | 164 passed | 26.0 min |
| 2 | 164 passed | 26.8 min |
| 3 | 164 passed | 27.6 min |

Lint, typecheck and the unit tests (958 in 69 files) pass.

## Łukasz's decision after the pan diagnosis (16 October 2026)

- **No trials now.** The pan miss with Focus on at 30 % (step 3's smoke figures), the diagnosis below and the trial
  candidates are recorded here:
  - **T1, a smaller veil:** its margin computed from the minimum zoom and the pane, instead of a fixed 20,000 px;
  - **T2, the lit lines inside the veil's SVG:** one layer instead of two;
  - **T3, the lit lines and rows in the overlay's own layer:** no new layer.

  They are candidates for after the closing sitting, if it misses.
- **Steps 4, 5, 6 and 7 go on as in the PRD,** stopping after each.
- **In step 6,** the lit lines and rows are drawn without a large layer of their own if that is straightforward, with no
  separate branch and no extra measuring. If it is not straightforward, today's way stays, and the report says so.
- **The closing sitting decides on proper figures.** If S4B1-11 misses there, the step stops with the figures, and
  Łukasz decides between the trials and the bar.

## After step 3: the pan diagnosis (16 October 2026)

Step 3 was accepted as built. Łukasz asked for a diagnosis (about 20 min, no laptop preparation, figures diagnostic) of
the smoke's pan miss before going on, because step 6's coverage colours draw lit lines and rows in the same overlay
without Focus.

**The method:**
- **View:** “Performance test”, 30 % around ent:23, frames expanded; F4's measurement build at `744080c`.
- **Pans:** one 10 s pan per case (S1A-14's wheel driver), traced with the full categories.
- **Hiding a layer:** an injected stylesheet (`display: none` on the lit lines' SVG or on the veil), from the test, not
  the app.
- **Layer sizes:** from CDP `LayerTree`.
- **Files:** `.data/measure/s4b1-step3-diag/` (the spec and the raw traces).

| Case | Presented fps (rAF) | Per presented frame: main / GPU raster + draw, ms | Veil's layer | Lit lines' layer |
| --- | --- | --- | --- | --- |
| Focus off | **49.0** (49.9) | 18.3 / 11.6 | – | – |
| Focus ent:23 (4 cards lit) | **36.0** (36.8) | 20.8 / 16.2 | 46,328 × 47,376 (2,195 Mpx) | 5,090 × 4,327 (22 Mpx) |
| – without lit lines (veil only) | 45.1 (46.2) | 20.4 / 13.8 | the same | – |
| – without veil (lit lines only) | 48.3 (49.4) | 18.8 / 12.0 | – | the same |
| Focus REQ-102 (large set) | **43.4** (44.3) | 20.8 / 15.0 | 2,195 Mpx | 4,438 × 7,055 (31 Mpx) |
| – without lit lines (veil only) | 46.0 (47.1) | 20.0 / 12.8 | the same | – |
| – without veil (lit lines only) | 45.8 (46.7) | 19.5 / 13.0 | – | the same |

**Reading:**
- **The cost is mostly the veil, and the two layers together cost more than each alone.**
  - The veil alone costs 3–4 fps (−6 to −8 %).
  - The lit lines alone cost 1–3 fps (−1 to −6.5 %, more for the larger set).
  - Both together cost 6–13 fps (−11 to −27 %).
  - Per presented frame the GPU's raster and draw grow from 11.6 ms to 15–16 ms; the main thread grows by about
    2.5 ms.
- **The veil's layer is 46,328 × 47,376 px, about 2,200 megapixels:** the content plus a 20,000 px margin on each
  side, so its edge is never in view. Chrome rasters only the visible tiles (slice 4p: the margin changed no tile
  memory), but drawing such a layer and blending a translucent full-screen quad over everything on every frame is
  likely the cost on this GPU. **Not proven.**
- **Even with Focus off, the main thread is busy about 900 ms per second of pan,** Layerize alone about 355 ms per
  second. Pan and zoom at 30 % expanded are close to the main thread's limit anyway, so small extra costs per frame
  cost frames.
- **For step 6:** the coverage colours without Focus are the "lit lines only" case: −1 % for a small set, −6.5 % for
  REQ-102's large set (single pans, so within a few percent of noise). The lit lines' SVG gets a layer of its own
  (22–31 Mpx) even without the veil.

**The large Focus switch** (REQ-102, 30 % expanded, 10 settled pairs, to the screen, in order):

| Switch | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| On, ms | **126** | 87 | 91 | 107 | 94 | 86 | 91 | 89 | 90 | 84 |
| Off, ms | 13 | 12 | 40 | 12 | 13 | 13 | 11 | 16 | 25 | 12 |

- **The first switch is slower, then it is steady at about 90 ms on** (median 90, max 107) and about 13 ms off.
- **So the smoke's 213 ms was a first-switch effect,** made worse by the smoke's two pairs. But steady "on" is close to
  the 100 ms bar.

## Step 3: F4 onto the branch (15 October 2026)

PRD items 6–8. F4's veil replaces F1's behind the existing request (`fade.ts`); F1's lift rule is gone. No UI yet:
fading is switched only by the test hook.

### What changed

| File | Change |
| --- | --- |
| `src/canvas/FadeLayer.tsx` | F4 from `perf/4p-trial-f4`: one SVG `path` (outer rectangle plus a rounded hole per lit card, per block of a collapsed frame with a lit card, and per note pinned to a lit card; `fill-rule: evenodd`) on its own compositing layer in the overlay; the lit lines and rows above it. **F1's veil and its lift `<style>` (`liftRule`) are removed.** New: `data-lit-notes` (the notes holed), `roundRect` exported for its test. |
| `src/canvas/canvas.css` | F1's `.fade-veil` (a `div` in the big layer, z-index 1) replaced by F4's two rules: `.fade-veil` with `will-change: transform`, and `.fade-veil path` with the canvas colour at `fill-opacity: .75`, on that one element only (AD-24). `.overlay-layer { z-index: 3 }` kept. |
| `src/canvas/fade.ts` | **The lens (`{ lens }`) is gone.** `{ focus }` takes an entity id (slice 4p's short form) or a `FocusTarget`, `{ t: "entity" \| "requirement", id }`; step 7 adds the other selections. Keys: `focus:<entity id>` as in 4p, so the reference side stays comparable; `focus:requirement:<id>`; `lit:<key>`. |
| `src/domain/model/lit.ts` | `lensLit` becomes `requirementFocusLit(model, scope)`: the same lit set (the prototype's `relatedOf "req"`), with **no row coloured**. A selected requirement's coverage colours are drawn by themselves (step 6). Step 4's new scope (an entity link without its attributes) applies to it as soon as the index changes. |
| `src/canvas/fade-canvas.tsx` | `useLit` reads the Focus target. A requirement's scope still comes from an index built here per request, which step 4 replaces with the inspector's index; Q1's answer said this step would already drop it, but Focus on a requirement needs the scope. |
| `src/canvas/TestHooks.tsx` | the hook's documented forms |

### Holes for pinned notes

F4 already had them (Q1). The new spec checks that notes pinned to a lit table are holed (two in the seed), that the
free note is not, and that notes pinned to a faded card are not. A note pinned to a card inside a collapsed frame is
hidden with its card.

### Tests

| Test | What |
| --- | --- |
| `src/domain/model/lit.test.ts` (changed) | the lens cases become Focus on a requirement: the same cards and lines, no row coloured |
| `src/canvas/fade-canvas.test.ts` (changed) | the lift rule's tests go; a hole's rounded rectangle; the keys of every request form |
| `src/canvas/fade.test.ts` (changed) | `{ lens }` replaced by Focus on a requirement |
| `e2e/slice-04b1/S4B1-07.spec.ts` (new) | S4B1-07. **Focus on Customer:** a hole at each of its 4 cards, none for faded notes; the hole moves with a drag and widens with a resize. **A lit table:** its 2 pinned notes holed, the free note not. **At 30 %:** the holes still lie on the cards. **Customer in a collapsed frame:** the block holed, the card hidden. |
| `e2e/slice-04b1/fixtures.ts`, `helpers.ts` (new) | the slice's fixture; `fade`, `fadeTables`, `commitCounters`, `veilHoles` (the holes read back from the path), `nodeRect`, `holeAt` |
| `e2e/slice-04p/S4P-12.spec.ts` (changed) | F1's z-index checks become hole checks (during and after a drag, after a resize); REQ-101's lens becomes Focus on REQ-101 (3 cards: Customer and its two tables under 4a's scope; no tinted rows); a lit table's notes counted by `data-lit-notes`. The commit guards are unchanged. |
| `e2e/slice-04p/S4P-fading.spec.ts`, `S4P-04-screens.spec.ts` (changed) | the "lens" scenarios are Focus on the requirement, under their old names |

- **The fading screenshots** (S4P-04's spec, kept in `.data/measure/s4b1-step3-screens/`, not committed) look as
  expected:
  - Focus on Customer keeps Customer, its two feeding tables and Sales Order lit; `order_header` and its notes fade;
  - Focus on REQ-101 keeps Customer and its tables, with no row tints.
- **`docs/known-limitations.md`:** the notes entry notes that F4 holes notes pinned to a lit card, so the stacking
  conflict 4p found no longer stands.

### Three full runs

No dev server, Playwright or measurement server running; each run from scratch:

| Run | Result | Time |
| --- | --- | --- |
| 1 | 161 passed | 25.3 min |
| 2 | 161 passed | 25.6 min |
| 3 | 161 passed | 25.3 min |

Lint, typecheck and the unit tests (953) pass.

### Smoke run: F4 to the screen. A clear miss on pan and zoom; the step stops here.

S4P-fading's traced mode on this branch's measurement build (rebuilt after the change). **Smoke conditions:** two
settled pairs per scenario (so each "median" is the larger of two), one pan per case, traced, unprepared laptop. These
are not figures for a verdict.

| View | Fading off, presented fps (rAF) | Scenario | Switch on / off, to screen, ms | Pan with Focus on, presented fps (rAF) |
| --- | --- | --- | --- | --- |
| 100 %, expanded | 46.4 (46.8) | Focus ent:23 | 35 / 17 | 53.4 (50.6) |
| | | REQ-101 (small) | 31 / 15 | 54.0 (50.0) |
| | | REQ-102 (large) | 54 / 22 | 53.7 (50.2) |
| **30 %, expanded** | 46.5 (53.9) | Focus ent:23 | 92 / 16 | **32.4** (43.2) |
| | | REQ-101 (small) | 86 / 17 | **28.3** (45.6) |
| | | REQ-102 (large) | **213** / 14 | **20.6** (39.3) |
| 100 % dense, expanded | 35.7 (35.7) | REQ-103 (dense) | 59 / 22 | 41.6 (41.3) |
| 100 %, collapsed | 55.1 (54.8) | Focus, small, large | 16–47 / 9–10 | 58.2–59.0 (56.5–56.9) |
| **30 %, collapsed** | 57.2 (58.4) | Focus, small, large | 41–76 / 11–21 | **43.1–45.4** (57.1–57.6) |
| 100 % dense, collapsed | 58.9 (60.0) | REQ-103 (dense) | 12 / 20 | 54.8 (59.9) |

**Reading:**
- **Switching mostly meets the bar.** F4 is far below F1's 300–550 ms, except the large set at 30 % expanded (213 ms
  on, against 86 in step 0's sitting). Two switches can't tell whether that is the first switch after the page opened
  (the veil's layer allocated) or real.
- **Pan and zoom with Focus on clearly miss S4B1-11** (at most 5 % below off) at 30 %:
  - expanded: −30 to −56 % presented, and −15 to −27 % even on rAF intervals;
  - collapsed: −21 to −25 % presented.

  At 100 % and in the dense views, Focus on is not slower.
- **F1 smoked the same way in step 2** (30 % expanded, 28–36 presented fps with fading on against 54 off). So the cost is
  likely not F4's veil alone, but what both have in the overlay while fading is on: the lit lines drawn again
  (`LitLines`, one SVG as large as everything it draws) and the veil, each a layer that pans and zooms with the
  viewport. **Not shown**; a pan trace would tell.

**The PRD's rule:** a step that clearly misses a bar in its smoke run reports it and stops, and a trial needs Łukasz's OK
and a time estimate. The proposal is in the step report.

## Step 2: tooling (15 October 2026)

Measuring to the screen (PRD items 1–5). Test and measuring code only; no application code changed. Smoke runs only:
their figures were taken on an unprepared laptop and are thrown away, except where a smoke run found something about
the method (below).

### What was built

| File | What |
| --- | --- |
| `scripts/lib/to-screen.ts` | Pure functions on trace events. **The anchor:** the first GPU present ending after the `ActivateLayerTree` that follows the start of the first main-thread `Commit` after the start. **The settled check.** **The split:** main thread, GPU raster, rest. **Presented frames:** fps, gaps over 50 ms, the longest gap and the p95 gap, `PipelineReporter` states when the trace has them; the source is the swap chain's `Present`, else Viz's `DrawAndSwap`. **`stats`:** median, p95, max. |
| `tests/to-screen.test.ts` | 15 Vitest tests on hand-written traces shaped like step 0's: F1's long raster, the hover presented while the main thread's `Commit` still blocks, the lasso's empty commit, a switch without a present, the settled rules, presented frames, the fallback source. |
| `scripts/to-screen.ts` | Analyses saved traces again: switches to the screen per file and direction, pans as presented frames (`to-screen.md`, `to-screen.json`). On step 0's 0.3b traces it gives exactly step 0's medians (for example F1's large lens 438 / 342 ms, the hover 20 / 16 ms, the lasso 43 ms). |
| `e2e/measure/trace.ts` | `TO_SCREEN`, `PAUSE_MS` (1.2 s), `SETTLED_PAIRS` (10, or the environment's); `startTrace(page, "full" \| "light")` with a 512 MiB buffer that refuses a trace that lost data; `saveTrace` into `TRACE_DIR` (`.data/measure/…`, git-ignored). |
| `e2e/measure/switches.ts` | `tracedSwitches` (a settled loop traced, summarised per direction) and `tracedPan` (one pan traced, bracketed `pan:<name>`, presented frames next to its rAF figures). The loops: `fadingLoop` (the hook), `hoverLoop` (C-10), `lassoLoop` (S2A-14's lasso). |
| `scripts/measure-canvas.ts` | **`--to-screen`:** sets `TO_SCREEN=1` and a trace folder per round and side; copies the branch's measuring specs, `e2e/measure/` and `scripts/lib/to-screen.ts` into the reference worktree, so both sides measure the same way. **`--only`:** `pan`, `c10`, `lasso`, `fading`, `c08`, `colours` (once S4B1-09 exists; skipped where a spec is missing), `c09`, `drags`; one Playwright run per criterion. **A failed quiet check** drops its round and adds a replacement with the same order (at most two). **New rows:** pans as presented fps (S1A-14, S4P-fading's fading off), C-10 and the lasso to the screen, C-08 to its last present. **A to-screen table** (per side, case and direction: in page, to the screen as median / largest p95 / largest max, switches not settled), and pans with fading on against off as presented fps. |
| `eslint.config.mjs` | `.data/**` ignored, like the build and result folders: lint had started reading the git-ignored measuring scratch scripts there. |
| README, CLAUDE.md | the new commands; the measuring rule (to the screen, presented frames, traced on both sides) |

### Specs with a traced mode (`TO_SCREEN=1`; without it they measure as before)

| Spec | Traced mode |
| --- | --- |
| `e2e/slice-01a/S1A-14.spec.ts` | after each untraced pan, the same pan again from the same view, traced, as presented frames (`C-01.<view>.toScreen`) |
| `e2e/slice-01b/S1B-10.spec.ts` | C-10 to the screen, 10 settled pairs (`C-10.toScreen`); its own three pan-and-zoom runs are skipped in this mode (`measure:canvas` does not use them; S1A-14 measures pans) |
| `e2e/slice-02a/S2A-14.spec.ts` | **always:** the lasso's p95 (`p95Ms`) next to its median and max, as owed since 4p; traced: the marks to the screen, 10 settled lassos (`toScreen`) |
| `e2e/slice-04p/S4P-fading.spec.ts` | each scenario's switching as 10 settled pairs to the screen (their in-page times as `on` / `off`); pan and zoom with fading off and on, also as presented frames (`offToScreen`, `panToScreen`) |
| `e2e/slice-04p/S4P-10-c08.spec.ts` | **always traced** (as before): each load also gives C-08 to its last present (`toLastPresentMs`) and the gap from the stable frame (`stableToPresentMs`) |

### What the smoke runs found about the method

1. **The settled check needed a correction.** Step 0's rule ("the last raster before the start was presented") flagged
   19 of 20 settled switches of the 0.3b traces. After a frame, Chrome often rasters a few tiles that change nothing on
   the screen, and no present follows them.

   **The rule now:** no raster running at the start, and the last raster either ended at least 50 ms earlier or was
   presented before the start. That passes every switch of the 0.3b sitting (the lasso's included) and flags 19 of 20
   in each direction of step 0's back-to-back trace.
2. **C-08's anchor in the trace was off by about 1.0–1.2 s.** S4P-10 (slice 4p) placed the stable frame in the trace at
   the last `navigationStart` event plus the page's `stableAt`. The page now puts a `performance.mark("im:stable")` in
   the frame where it first is complete, and in ten loads (two smoke runs) the mark lies **1.0–1.2 s before** where 4p's
   anchor put the stable frame. So the trace's last `navigationStart` is not the page's time origin.

   **Consequence for 4p's C-08 breakdown** (`scripts/c08-waiting.ts`, the “main thread idle for about 0.7 s” in
   `docs/known-limitations.md`): its window from the document's end to the stable frame was shifted by about a second,
   mostly into the time after the page was complete. Its idle figure is very likely an artefact. I first suspected the
   trace buffer; Chrome reports no data loss, so that is ruled out. **To correct in step 8** (with the 4p corrections),
   after re-running the breakdown with the mark.

   S4P-10 now anchors on the mark, keeps tracing 0.5 s after the stable frame so the present is in the trace, and
   records the offset (`navStartOffsetMs`).
3. **C-08 to its last present** (smoke only, five loads, not a figure): 1,501–1,566 ms, 148–163 ms after the stable
   frame's rAF.
4. **Pans with F1's fading on, as presented frames** (smoke only, one run each, unprepared laptop, not a figure):
   - at 30 % expanded, 28–36 fps with fading on against 54 fading off;
   - at 30 % collapsed, 44–52 against 58.

   4p judged S4P-03 met on rAF intervals. The closing sitting measures this properly, on F4.
5. **A harness smoke** (`--to-screen --only c10,lasso,pan,c08 --rounds 1 --no-build --against slice-04p`,
   `SETTLED_PAIRS=2`) ran end to end on both sides in 9 minutes: the copies into the reference, the trace folders, the
   rows and the to-screen table. Its S1A-14 soft bars were missed on the unprepared laptop, as expected.

### Other changes

- **The reference worktree** `../infomapper-ab-main` is now at `slice-04p` (`052daaf`), with its measurement build
  (`--prepare-only --against slice-04p`).

### Three full runs

No dev server, Playwright or measurement server running; each run from scratch (`npm run e2e`):

| Run | Result | Time |
| --- | --- | --- |
| 1 | 159 passed | 24.6 min |
| 2 | 159 passed | 25.0 min |
| 3 | 159 passed | 25.3 min |

- **Lint, typecheck and unit tests pass:** 953 tests in 69 files (the 15 new ones in `tests/to-screen.test.ts`).
- **No earlier test's behaviour changed in the normal run.** The traced modes switch on only with `TO_SCREEN=1` and
  `MEASURE_BUILD=production`. S2A-14 now also records its lasso's p95.

## Łukasz's answers after step 1 (15 October 2026)

- **A.** S4B1-05 and the definition of done use **REQ-105** for the gap (`birth_date`; approving its mapping turns the
  row blue) and **REQ-101** for the entity header tint. REQ-102 stays the large set in “Performance test”.
- **B.** No selection store up front. Selecting a requirement keeps its one `ModelCanvas` commit, as any selection does
  today. In step 6, a smoke measurement of the colours to the screen decides:
  - within 100 ms: S4B1-13 reads “one commit on selecting a requirement, as for any selection; none on switching Focus”;
  - over 100 ms: stop and propose the selection store, which needs Łukasz's OK.
- **C.** “Focus on this” / “Turn Focus off” in the card and row menus; a deliberate difference from the prototype (card
  menu only).
- **D.** Focus turns off when switching canvas, as the PRD says; a deliberate difference (the prototype keeps it).
- **E.** No view-state chip for coverage colours; the “Focus” chip only (the prototype's “Lens: REQ-x” goes).
- **Q7.** Step 6 shows both variants (header tint and dot) on screenshots, with a note on what they mean:
  - a header tint below 40 % would mean “everything on this card in scope is covered”;
  - above 40 % it means “this directly linked entity has a source”.

  Łukasz decides from the screenshots.
- **Everything else** (Q1–Q6, the docs plan) is accepted.
- **An extra task before step 2:** `docs/inventory-prototype-vs-app.md`, what the prototype has that the app does not.

## Step 1 (15 October 2026)

- **Start:** on `slice/04b1-lens-focus` at `0e16f8e`, in sync with `origin`, tree clean; no `node`, server or
  Playwright running. The Chrome processes running were Łukasz's (started 18:53), not ours.
- **The PRD** is copied unchanged from Łukasz's download to `docs/prd/slice-04b1-coverage-focus.md`.
- **The B2 sentence** in `docs/perf/04b1-step0-switch-trace.md` is corrected: there is no separate fallback; if F4
  misses in the closing sitting, Łukasz decides.
- **No application code changed.** The seed figures in Q5 come from a scratch script in `.data/measure/s4b1-step1/`
  (git-ignored).

### Questions for Łukasz (found while answering)

| # | Question | Proposal |
| --- | --- | --- |
| A | **REQ-102 has no gap in the demo seed** (3 of 3 covered, before and after). S4B1-05 and the definition of done select REQ-102 in “Customer 360” and expect “its gap orange”, then “approve the gap's draft mapping”. | Use **REQ-105** there: three covered rows (first_name, last_name, email) and the gap `birth_date`, whose mapping is in review; approving it turns the row blue. Use **REQ-101** (an entity link) for the header tint. REQ-102 stays the large set in “Performance test” (`seed:large`). |
| B | **S4B1-13 asks for no canvas commit when a requirement is selected.** Today the canvas reads its selection from the UI context (`CanvasUiCtx`), so every selection change, a requirement's included, commits `ModelCanvas` once (from the code; Q3). | Step 6 moves the selection into a store that the canvas reads through a selector. A requirement or element selection reads as “no canvas selection”, so selecting a requirement from nothing selected commits nothing. Going from a selected card to a requirement still commits once, because the card's selection mark goes. S4B1-13 is read as “from nothing selected”. |
| C | **“Focus on this” in row menus.** The prototype has it in the card menu only (entity and table cards). The PRD asks for card and row menus. | As the PRD says (card and row menus), recorded as a deliberate difference. |
| D | **Focus when switching canvas.** The prototype keeps Focus on across canvases. The PRD turns it off. | As the PRD says, recorded as a deliberate difference (section 8 lists it with the others). |
| E | **No view-state chip for a selected requirement.** The prototype shows “Lens: REQ-x” while a requirement is selected. Without a lens, the colours go with the selection. | No chip for coverage colours; the “Focus” chip only. Recorded as a deliberate difference. |

### Q1. F4 onto the branch

**Files.** F4 (`f0d0f61`) changes only two files against its base `perf/4p-fade-base` (`8628448`):
- `src/canvas/FadeLayer.tsx`: one SVG `path`, the outer rectangle plus a rounded hole per lit card or block, with
  `fill-rule: evenodd`;
- `src/canvas/canvas.css`: `.fade-veil` on its own layer (`will-change: transform`), and `.fade-veil path` with the
  canvas background at `fill-opacity: .75`.

It is mounted in `OverlayLayer` (`ModelCanvas.tsx:1556`), as on main.

**What main changed since that base** (`8628448..052daaf`), and what happens to each:

| File on main | Change since the base | With F4 |
| --- | --- | --- |
| `src/canvas/FadeLayer.tsx` | F1: veil in the viewport portal, the lift `<style>` | **conflict.** Take F4's body. Keep main's header comment style and the `__imFadeCommits` counter (both versions have it). Remove `liftRule`. |
| `src/canvas/canvas.css` | F1's `.fade-veil` (background, z-index 1), `.overlay-layer { z-index: 3 }`; the hover veil removed | Replace `.fade-veil` with F4's two rules. Keep `.overlay-layer { z-index: 3 }`: harmless, and the overlay stays above the cards. |
| `src/canvas/fade.ts` | `{ lit, key }` added | Keep it. `{ lens }` goes (item 6); `{ focus }` widens (below). |
| `src/canvas/fade-canvas.tsx` | `useLit` takes `{ lit, key }` | Keep it. Drop the lens branch, which also stops building a second requirement index per request (Q2). |
| `src/canvas/TestHooks.tsx` | `__imCanvasThrow`, `__imIndexTiming` | Keep them. `__imFade` takes the new request forms. |
| `e2e/slice-04p/S4P-12.spec.ts`, `S4P-fading.spec.ts`, `S4P-04-screens.spec.ts`, `helpers.ts` | use `{ lens }` | The lens scenarios become Focus on a requirement. These are changed earlier tests, listed in step 3. |
| `e2e/slice-04p/S4P-fading-guard.spec.ts` | deleted on main (F1 had other guards) | Its F4 checks come back as S4B1-07: the holes follow a drag, a resize and a collapse. |

**The request forms after step 3:**
- `{ focus: FocusTarget }`, where `FocusTarget` is the selection kinds of item 21: entity, table, frame, attribute,
  column, mapping, relationship, several, requirement;
- `{ lit, key }`;
- `null`.

The domain's `focusLit` grows into one function per target kind (prototype `relatedOf`). The hook keeps
`{ focus: "<entity id>" }` as a short form, so the 4p specs change as little as possible.

**Holes for pinned notes: F4 has them already.** For every note drawn whose `pinCardId` is a lit card, it adds a
rounded hole (radius 4) at the note's rectangle (`FadeLayer.tsx`, the `notes` loop). The holes follow the nodes
through `useStore((s) => s.nodes)` and the notes through the `notes` prop.

Step 3 adds the checks that F4's guard did not have:
- a pinned note dragged while Focus is on;
- a note pinned to a card inside a collapsed frame: its block is lit and the note is hidden with its card;
- the card heights below 40 %. Holes use React Flow's measured size, so when a card's height changes below 40 %, its
  hole follows.

### Q2. The requirement index

**What it holds today** (`src/domain/model/requirement-index.ts`): for every live requirement,
- its live links;
- its scope (`scopeOfLinks`): entities, attributes, mappings, tables and columns. An entity link adds all its
  attributes; an attribute link adds its entity; a mapping link adds its attribute, the entity and the input columns
  with their tables;
- its coverage (`coverageOfScope`, over the scope's attributes);
- its children;

and for every element, `of(target)`: the direct requirements, plus one indirect list with one `via` for the whole list
(attribute “via entity”, entity “via attribute”, table “via column”).

It is built:
- on the server, three times: the canvas page, the workspace page and the project page, each once per request;
- in the browser, once per data change in the inspector (`useMemo` on requirements, links and model);
- **once more per lens request** in `fade-canvas.tsx`, which goes with the lens.

**What changes:**

| For | Change |
| --- | --- |
| Item 9, scope items | The scope keeps its five sets, because they say which cards, rows and lines a requirement touches (Focus and the colours need them). Two new sets are added: **entity items** (linked entities) and **attribute items** (linked attributes, and the attributes of linked mappings). An entity link no longer adds the entity's attributes to the scope. |
| Item 10, coverage | `coverageOfScope` counts items. An attribute item uses today's per-attribute state (approved and `checkMappingTypes` passes, else not approved, else not mapped). An entity item is covered when any attribute of the entity is covered by that rule. The result gets `parts: { entities, attributes }` for the tooltip, and gaps that name their kind. `done` stays “at least one item, all covered”. |
| Item 12, indirect lists | `of(target)` returns the indirect requirements with their own `via` each: entity “via attribute” / “via mapping”; attribute “via mapping”; table “via column” / “via mapping”; mapping and column direct only. A requirement reaching an element both ways is listed once, with the first `via` in that order. |
| Item 14, markers | `markerOf(cardTarget)`: the count and the keys and names for the tooltip, from `of(target)` on entities and tables (direct plus indirect), worked out while the index is built. |

**Rebuilds: yes, still one per data version.** The canvas gets the inspector's index (the same object) through its
existing data path, instead of building its own. The cost is about the same as today, because the new sets are filled
in the same pass over the links. Slice 4p's browser figure (12.7 ms median on the synthetic model) is checked again
with `bench-requirement-index.ts` in step 4.

### Q3. The overlay: tints from computed positions, and what selecting a requirement commits

**Rows: yes, it already does.** `LitRows` (`fade-canvas.tsx`) draws the lens's covered and gap rows as SVG rectangles
in `OverlayLayer`:
- the positions come from the card's data (`rowEnd`, `cardWidth`, `ROW_H`), not from the DOM, as the hover highlight
  does (AD-24 rule 2);
- it follows drags, collapses and widths through `useStore((s) => s.nodes)`;
- it draws nothing below 40 %.

**Header tints** use the same pattern: one rectangle per entity or table item at the card's position, with the header
height from `geometry.ts` (the header is drawn at every zoom). **The lit mapping lines** use `LitLines`, as Focus does.

So item 16 is one `CoverageLayer` in `OverlayLayer`, made of `LitRows`, header rectangles and `LitLines`, with no veil.
It repaints only the overlay's layer, which is what step 0 measured as cheap (the hover: 20 ms to the screen). No
card's own class or style changes.

**Commits when a requirement is selected:**
- **Today, one `ModelCanvas` commit per selection change.** The canvas takes `selection` from `CanvasUiCtx`
  (`ModelCanvas.tsx:269`), so every change of the context value re-renders the canvas. The cards are memoised, so
  little else re-renders, but `__imCanvasCommits` counts the commit. (This is from the code; step 6's guard confirms
  it.)
- **What S4B1-13 needs:** the canvas must not take requirement selections through its own render. That is question B
  above.
  - **Proposal:** the selection becomes a value store in the UI context (as 4p did for the hover). `ModelCanvas`
    subscribes through a selector that gives `null` for requirement and element selections. `CoverageLayer` subscribes
    to the requirement selection only.
  - **Result:** selecting a requirement commits `CoverageLayer` (and the panel), not the canvas or the miniature.
    Switching Focus commits only `FadeLayer` (as in 4p's S4P-12).
- **While a requirement stays selected and the data changes** (approving a mapping), the canvas re-renders with the
  data as it does today, and `CoverageLayer` recomputes from the new index. Item 18 needs nothing else.

### Q4. Focus in the prototype

- **Toolbar:** the button `#tFocus` comes right after the “Everything / Mappings / Relationships” group and before
  the Hand tool:
  - an icon (a small circle with four ticks) and the label “Focus”, hidden on narrow screens;
  - `aria-pressed`;
  - the title “Fade everything not connected to the selection”.

  A click toggles Focus. Turning it on with nothing selected toasts “Focus fades everything not connected to what you
  select.”
- **Shortcut: none.** F is “Fit everything on screen”; Focus has no key.
- **Context menu:** in the card menu (entity and table cards) only, one entry: “Focus on this” while Focus is off,
  “Turn Focus off” while it is on. It toggles Focus; the right-click has already selected the card. There is no entry
  in row, frame or line menus (question C).
- **Chip:** the status bar's view-state list shows “Focus” with an × that turns it off. The same list shows
  “Lens: REQ-x” while a requirement is selected (question E).
- **What resets it:**
  - the chip's ×;
  - the toolbar button;
  - the menu entry;
  - “Show everything” (`data-vall`), which also clears a requirement selection.

  Switching canvas does not reset it in the prototype (question D).
- **What it lights** (`focusCtx`): `relatedOf(selection)` for entity, table, frame, several, attribute, column, mapping
  and relationship. A selected requirement lit its scope even without Focus (the lens), which this slice changes
  (item 21).

### Q5. The seed's coverage under the new rules

Demo seed, workspace “Retail Co – DWH” (the only one with requirements), computed by the domain's current lookup with
the PRD's items 9–10:

| Requirement | Links | 4a | 4b-1 | Gaps (4b-1) |
| --- | --- | --- | --- | --- |
| REQ-101 Single view of the customer (Agreed) | entity Customer | 5 of 8, not covered | **1 of 1, covered** (1 entity item) | – |
| REQ-102 Contact data for every active customer (Agreed) | attributes Customer.first_name, last_name, email | 3 of 3, covered | 3 of 3, covered (3 attribute items) | – |
| REQ-103 E-mail is unique per customer (Draft) | attribute Customer.email | 1 of 1, covered | 1 of 1, covered | – |
| REQ-104 Order total equals the sum of its lines (Draft) | attributes Sales Order.total_amount, Order Line.quantity, unit_price, discount_pct | 1 of 4 | 1 of 4 | quantity, unit_price, discount_pct (not mapped) |
| REQ-105 Personal data is encrypted at rest (Agreed) | attributes Customer.first_name, last_name, email, birth_date | 3 of 4 | 3 of 4 | birth_date (mapping in review: not approved) |
| **Covered** | | **2 of 5** | **3 of 5** | |

REQ-101 is the only figure that moves. Customer has covered attributes (first_name, last_name, email), so its one
entity item is covered. The workspace Overview becomes “3 of 5 requirements covered”, and the status bar
“Requirements 5, covered 3” (before any approval).

**Tests that change** (step 4 lists them as changed earlier tests):

| Test | What changes |
| --- | --- |
| `e2e/slice-04a/S4A-01.spec.ts` | the bar's title “1 of 4 attributes covered”, “3 of 3 attributes covered” → “1 of 4 covered”, “3 of 3 covered” (the tooltip names the parts) |
| `e2e/slice-04a/S4A-07.spec.ts` | email: “REQ-101 via entity” goes (REQ-102, REQ-103, REQ-105 direct only); Customer: REQ-101 direct, the others “via attribute”; the table under the linked mapping: “REQ-104 via mapping” instead of “via column” |
| `e2e/slice-04a/S4A-08.spec.ts` | REQ-101's panel: 1 / 1 instead of 5 / 8, no gaps; the bars' titles; REQ-105's “4 of 4 attributes covered” → “4 of 4 covered”; the table-only requirement stays 0 / 0 |
| `e2e/slice-04a/S4A-13.spec.ts` | “2 of 5 requirements covered” → “3 of 5”; “5 requirements, 2 covered” → “3 covered” (for the project home's figure, “Customer 360” has all five); status bar “covered 2” → “covered 3”, after the approval “covered 3” → “covered 4”; Overview “3 of 5” → “4 of 5” |
| `e2e/slice-04a/helpers.ts` | `sectionRows`' comment and its `via` texts |
| `e2e/slice-04a/S4A-14.spec.ts` | selecting a requirement now colours its scope in the overlay. `drawn()` compares cards, `.sel` marks, the lines' classes and the view. `LitLines` draws its copies with `MapPath`, which carries the same `data-testid="line-mapping"`, so `drawn()` is narrowed to the line layer's own lines (outside `layer-lit-lines`). Its idle check stays. |
| `e2e/slice-04p/S4P-12.spec.ts`, `S4P-fading.spec.ts`, `S4P-04-screens.spec.ts` | the lens becomes Focus on a requirement (Q1) |
| `src/domain/model/requirements.test.ts`, `requirement-index.test.ts` | scope, coverage and `via` cases rewritten for items 9–12 |

### Q6. The tooling, and the closing sitting

**Modules** (step 2; test code, so three full e2e runs):

| Module | What it does |
| --- | --- |
| `e2e/measure/trace.ts` | Starts and stops a CDP trace with one of two category sets: **full** for interactions (as step 0) and **light** for pans (`viz`, `gpu`, `benchmark`, `graphics.pipeline`, `blink.user_timing`). Brackets each switch with a `performance.measure` (`sw:<on\|off>:<k>`) and writes the raw trace to `.data/measure/<sitting>/traces/`. |
| `e2e/measure/switches.ts` | The settled loop: switch, wait for the change in the page, the next frame, then a 1.2 s pause; the in-page time as today. |
| `scripts/lib/to-screen.ts` | Pure functions on trace events. **The anchor:** the first GPU present ending after the `ActivateLayerTree` that follows the start of the first main-thread `Commit` after the start. **The settled check:** no raster running at the start, and the last raster already presented. **The split:** main thread, GPU raster, rest. **Presented frames:** fps, intervals over 50 ms, `PipelineReporter` states if Chrome writes them. Vitest tests in `tests/to-screen.test.ts` on small hand-written event lists, including step 0's hover and lasso cases. |
| `scripts/to-screen.ts` | The command line: analyses a folder of raw traces again and writes the tables (as `split.js` and `aggregate.js` did). |

**Specs that get a traced mode** (with `TO_SCREEN=1`; without it they run as today):
- `S4P-fading` (Focus scenarios, 10 settled pairs);
- `S1B-10` (C-10, to the screen);
- `S2A-14` (the lasso, to the screen, and the p95 and max it is owed since 4p);
- `S1A-14` (pan and zoom as presented frames, plus one untraced pan per case and round);
- `S4P-10` (C-08 to its last present);
- this slice's `S4B1-09`, `S4B1-10` and `S4B1-11`.

**`measure:canvas` flags:**
- `--to-screen`: sets `TO_SCREEN=1`, collects the traces and adds the to-screen tables and the settled-check failures
  per case to `summary.md`;
- `--only <list>`: runs a subset, one of `fading`, `colours`, `pan`, `c10`, `lasso`, `c08`;
- the existing `--rounds`, `--no-build`, `--prepare-only`, `--drop`, `--add-round`, `--quick` stay.
- **The CPU check moves before every side in every round,** and a disturbed round is dropped and replaced, as step 0's
  `run-all.ps1` did.

**The closing sitting (S4B1-09 to S4B1-12).** This branch against `slice-04p`; measurement builds made before Łukasz's
restart and used with `--no-build`; one unrecorded warm-up, then three rounds with the sides rotated. Times per side and
round (step 0's rates: a settled switch about 2.6 s, a page about 8 s, a traced pan about 25 s, an untraced pan about
18 s):

| Criterion | Side | Cases | Per round |
| --- | --- | --- | --- |
| S4B1-09 coverage colours | branch | REQ-102 selected and cleared; 100 % and 30 %, frames expanded and collapsed: 4 cases × 10 pairs | about 3 min |
| S4B1-10 Focus switching | branch | Focus on ent:23 (large lit set) and on REQ-102; the same 4 views: 8 cases × 10 pairs | about 5.5 min |
| S4B1-11 pan with Focus on | branch | 4 views × (off, Focus ent:23, Focus REQ-102), traced, plus one untraced pan each | about 9 min |
| S4B1-12 no regression, Focus off | both | pan and zoom: overview and dense, frames expanded and collapsed (4 traced, 4 untraced); C-10 10 pairs; lasso 10 | about 5.5 min each |
| Server start and CPU check | both | | about 1.5 min each |

- **Per round:** the branch about 24 min, `slice-04p` about 7 min, so about 31 min.
- **Three rounds:** about 1 h 35 min.
- **Warm-up** (one pair per case, every side): about 10 min.
- **C-08 to its last present** (S4P-10, five traced loads per side, diagnosis only): about 5 min, last.
- **Total about 1 h 50 min,** plus about 31 min for each replacement round. That is within the PRD's 2–2.5 h.

### Q7. Item 19, a first proposal: the summary below 40 %

- **Proposal: below 40 %, tint the header of every card that has something in the selected requirement's scope.**
  Blue when all of the card's items are covered, orange when any is a gap:
  - an entity: its entity item, and its attribute items;
  - a table: blue when it or any of its columns is linked.

  This uses item 16's header rectangle, which is drawn at every zoom level. Below 40 % it simply covers every card in
  scope, not only entity items, so no new kind of element is needed. At 40 % and above, the rows carry the detail and
  the header tint stays for entity items only.
- **Why not a dot:** at 10–30 % a header tint is easier to see than a small dot, and it costs the same, one rectangle
  per card in scope, in the overlay.
- **The alternative,** if you prefer a dot: one circle at the header's right end, next to the requirement marker.
- Either way, nothing changes on the cards themselves (item 17). Step 6 shows both on screenshots.

### Docs plan (section 9)

| File | What | When | Approval |
| --- | --- | --- | --- |
| `docs/decisions.md` D-31 | scope items and coverage (items 9–10): an entity link is one item, covered when any of its attributes is; mapping links add their attribute; tables and columns are in scope but not items | step 4, with the domain | Łukasz approves the text first |
| `docs/decisions.md` D-32 | markers on cards; coverage colours on selection (overlay, no fading); fading only through Focus; requirement cards in 4b-2 | step 6 | the same |
| `docs/decisions.md` D-34 | indirect lists per item 12 (“via attribute”, “via mapping”, “via column”; no “via entity”) | step 4 | the same |
| `docs/decisions.md` AD-24 “Overlay and fading” | F4 with its reasons (step 0's figures, the layer check), the method rule (interactions to the screen, pan and zoom as presented frames); F1 and its lift rule removed | step 8, after the closing sitting | the same |
| `docs/known-limitations.md` | **“Where the canvas stands”:** S4P-02 missed to the screen; S4P-03, C-09 and the drags as rAF figures, unverified as presented; C-10 20 ms and the lasso 43 ms to the screen; C-08's last raster not included. **“Fading's slow switches at 30 %”** replaced by F4's closing-sitting results. **A method entry** (to the screen, presented frames, the settled check, traced against untraced). **The pinned-notes limitation** (line 224) closed. **Item 19's outcome.** | step 8; the pinned-notes entry in step 3 | none (corrections) |
| `docs/prd/slice-04p-acceptance.md` | a new section “Corrections after slice 4b-1, step 0”: S4P-02, S4P-03, the lasso, C-10, C-08, F4's rejection; 4p's own text unchanged | step 8 | none |
| `docs/data-model-v2.md` | the line after `requirement` (“Coverage is computed, never stored (D-31)”) gains one sentence on items; no table changes | step 4 | none |
| `docs/ideas.md` | “Entity-level requirements” (line 85) marked resolved with a link to this PRD; new: coverage by hierarchy, “Link all attributes” in an entity panel | step 8 | none |
| README, CLAUDE.md | slice status; the measuring rule; the new `measure:canvas` flags and `e2e/measure/` | README and CLAUDE.md commands in step 2; status in step 8 | none |
| this file | each step's results, the criteria table, changed earlier tests, the manual checklist | every step | – |
