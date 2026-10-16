# Slice 4b-1 – Acceptance

Status: **steps 1 to 3 accepted; step 4 (the domain) waiting for Łukasz.** Branch `slice/04b1-lens-focus`, from `main` at the tag `slice-04p`
(`052daaf`), draft pull request #13. PRD: `docs/prd/slice-04b1-coverage-focus.md`. Step 0:
`docs/perf/04b1-step0-switch-trace.md`.

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
