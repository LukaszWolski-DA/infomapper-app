# Slice 4b-1 – Acceptance

Status: **step 1 accepted; step 2 (tooling).** Branch `slice/04b1-lens-focus`, from `main` at the tag `slice-04p`
(`052daaf`), draft pull request #13. PRD: `docs/prd/slice-04b1-coverage-focus.md`. Step 0:
`docs/perf/04b1-step0-switch-trace.md`.

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
