# Slice 4b-1 – Requirements on the canvas: markers, coverage colours, Focus

Status: **draft for step 1**, 15 October 2026. Branch `slice/04b1-lens-focus` (created in step 0, commit `0e16f8e`).
Starts from `main` at tag `slice-04p` (`052daaf`).

## 1. Why this slice

Slice 4a brought requirements without the canvas. Slice 4b puts them on the canvas and is split in two:

- **4b-1 (this slice):** requirement markers on cards, coverage colours when a requirement is selected, and Focus
  (D-22), on a fading mechanism that reaches the screen within the bar.
- **4b-2 (next):** requirement cards (D-41) with dashed trace lines, dragging a requirement onto an element (link) or
  onto empty canvas (card), “Place its card”, “Add all to this canvas”, candidates from `docs/ideas.md`.

Step 0 (`docs/perf/04b1-step0-switch-trace.md`) showed that F1, the fading mechanism adopted in 4p, misses S4P-02 when
measured to the screen: lifting the lit cards re-rasters the whole big layer (about 300–550 ms at 30 %, frames
expanded). F4 (veil with holes on its own layer, tag `perf/4p-trial-f4`) reaches the screen in 86 ms (large lens) and
44 ms (Focus). F4's panning cost is unknown, because 4p measured it as rAF intervals. The layer check refuted B2, so
there is no separate fallback: if F4 misses in this slice's closing sitting, Łukasz decides.

Decisions agreed with Łukasz on 15 October 2026:

- **Scope is what the modeler links.** A link to an entity is about the entity; it does not pull in its attributes.
  A link to an attribute is about that attribute.
- **Coverage of an entity:** covered when at least one of its attributes has an approved mapping with no type conflict.
- **Panels:** an entity shows its own requirements and its attributes'; an attribute shows its own (no “via entity”).
- **No separate lens.** Selecting a requirement only colours its scope (covered blue, gaps orange). Fading the rest is
  always Focus, also for a requirement. (This changes D-32.)
- **Coverage colours are drawn in the overlay**, never by restyling cards: restyling many cards at once is what made F1
  re-raster the big layer.
- **F4** carries Focus. F1's lift rule is removed.
- **Measuring to the screen** from now on (section 6): interactions to the first GPU present, pan and zoom as presented
  frames, one sitting at the end of the slice, only the criteria the slice touches.

## 2. Sources

- `docs/perf/04b1-step0-switch-trace.md`: the to-screen figures, the analyser fix, the layer check, the decision.
- `docs/decisions.md`: D-22, D-31, D-32, D-34, AD-24 (block “Overlay and fading”).
- `docs/known-limitations.md`: canvas performance section; requirement index (browser figures).
- `docs/prd/slice-04a-requirements.md` and `slice-04a-acceptance.md`: scope, coverage, panels, `checkMappingTypes`.
- `docs/prd/slice-04p-canvas-performance.md` and `slice-04p-acceptance.md`: the fading hook, the overlay, the guards,
  the measuring method.
- Code: `src/canvas/fade.ts` (`requestFade`), `src/domain/model/lit.ts`, `requirement-index.ts`, tag
  `perf/4p-trial-f4` (`f0d0f61`).
- Prototype: `reqScope`, `reqCoverage`, `reqsTouching`, `reqMark`, `reqsFor`, `relatedOf`, `focusCtx`,
  `applyHighlight`, the Focus button `#tFocus`, the context menu's “Focus on this” / “Turn Focus off”, the view-state
  chip “Focus”, CSS `.rmark`, `.row.rq`, `.row.gap`.

## 3. What to build

### Measuring to the screen (tooling, test code)

1. **Trace module** in `e2e/` and `scripts/`, moved from `.data/measure/s4b1-step0/`: tracing, the anchors (end = first
   GPU present after the compositor's `ActivateLayerTree` that follows the start of the first commit after the start),
   the settled check (no GPU raster running at the start, the last raster already presented) and the split (main
   thread, GPU raster, rest).
2. **Interactions to the screen:** S4P-fading, S1B-10 (C-10), S2A-14 (lasso; also gets p95 and max) and the new specs of
   this slice get a traced mode. Each switch starts from a settled screen (1.2 s pause). In-page time stays as a
   breakdown.
3. **Pan and zoom as presented frames:** S1A-14's driver unchanged (one wheel event per rAF, 10 s); a light trace
   (`viz`, `gpu`, `benchmark`, `graphics.pipeline`, `blink.user_timing`); presented fps = GPU presents in the window ÷
   its length; frames over 50 ms = intervals between presents over 50 ms; one untraced pan per case and round to
   calibrate the trace's own cost. rAF figures stay as a breakdown.
4. **C-08 to its last present:** S4P-10's stable frame ends at the first present after that frame's activation.
5. `measure:canvas` gets `--to-screen` and a way to run a subset of criteria (for example `--only fading,pan`).

### Fading mechanism

6. **F4 onto the branch:** the veil with holes as one SVG path on its own compositing layer above the cards, from
   `perf/4p-trial-f4`, behind the existing `requestFade({focus} | {lit, key} | null)`. F1's veil and lift rule are
   removed. The `{lens}` form goes (no lens); a requirement under Focus uses `{focus}` with the requirement selected.
7. **Holes follow** dragging a lit card, resizing it, collapsing and expanding frames, and zoom-level changes (AD-24
   rule 1). **Notes pinned to a lit card** get their own hole, so they stay lit (F1 could not do this; the known
   limitation from 4p is closed).
8. AD-24's rules hold: no opacity on repeated elements; the veil's `fill-opacity` is on one element; the extra layer is
   counted in the element and layer guards.

### Domain: scope, coverage, panels (changes D-31 and D-34)

9. **Scope items** of a requirement (pure functions in `domain`, served by the requirement index):
   - a linked **entity** is one item;
   - a linked **attribute** is one item;
   - a linked **mapping** adds its attribute as an item;
   - linked **tables** and **columns** are in scope but are not coverage items.
   Nothing is pulled in implicitly: an entity link does not add the entity's attributes, an attribute link does not add
   its entity as an item.
10. **Coverage.** An attribute item is covered when it has at least one approved mapping with no type conflict
    (`checkMappingTypes`, as in 4a). An entity item is covered when at least one of its attributes is covered by that
    rule. A requirement is covered when it has at least one item and every item is covered. A requirement with no
    items (only tables or columns) shows 0 / 0 and is not covered (as in 4a). Coverage stays computed, never stored.
11. **Coverage text** counts items: “{m} of {n} covered” with a tooltip naming the parts, e.g. “1 entity, 3 attributes”.
    The gap list in the requirement panel lists entity items (“Customer: no approved mapping on any attribute”) and
    attribute items as today; a click goes to the element (4a's go-to).
12. **Panels (D-34):**
    - entity: its direct requirements, then those linked to its attributes or to mappings onto its attributes, marked
      “via attribute” or “via mapping”;
    - attribute: its direct requirements, then those linked to mappings onto it, marked “via mapping” (follows from
      item 9: a mapping link makes the attribute an item, so its panel must show the requirement);
    - mapping: direct only;
    - table: direct, then those linked to its columns or to mappings that read its columns, “via column” or
      “via mapping”;
    - column: direct only.
    No “via entity” anywhere.
13. Project home, status bar and the left panel's coverage bars use the new coverage with no other change.

### Markers on cards

14. Entity and table cards show a requirement marker in the header when their panel lists at least one requirement
    (direct or indirect): a violet dot and the count (prototype `reqMark`). Tooltip: “Requirements:” and one line per
    requirement, “REQ-101 Single view of the customer”. A click on the marker does nothing (it does not select the card
    either). The marker updates after linking, unlinking, deleting and undo.
15. Markers are drawn at every zoom level, including below 40 % (the header is drawn there).

### Coverage colours

16. Selecting a requirement (left panel, requirement panel, go-to link, project home) colours its scope on the open
    canvas, with no fading:
    - attribute items: row blue when covered, orange when a gap;
    - entity items: header tint blue or orange by item 10's rule;
    - linked columns: row blue; linked tables: header tint blue;
    - linked mappings: their lines drawn lit, as the hover highlight draws them.
    Selecting anything else, a click on empty canvas, or Escape clears the colours.
17. All colours are drawn in the overlay layer (the one that carries the hover highlight and the lasso), from row
    positions computed from data (AD-24 rule 2). No card's own style changes.
18. Colours update while the requirement stays selected: approving a mapping turns an orange row blue; a type conflict
    turns it orange.
19. **Open question for step 6:** below 40 % rows are not drawn, so row colours are invisible. Candidate: a small
    summary dot on the card's header (orange if any of the card's items in scope is a gap, else blue). Step 6 proposes;
    Łukasz decides.

### Focus (D-22)

20. **Turning it on and off:** a “Focus” toggle in the canvas toolbar; “Focus on this” / “Turn Focus off” in the card
    and row context menus; a view-state chip “Focus” in the status bar with × to turn it off. With nothing selected,
    turning it on toasts “Focus fades everything not connected to what you select.” Keyboard shortcut only if the
    prototype has one (Q4).
21. **What stays lit:** the lit set from `src/domain/model/lit.ts` (prototype `relatedOf`) for the selection: entity,
    table, frame, attribute, column, mapping, relationship, multi-selection. For a selected requirement: the cards in
    its scope (linked entities, entities of linked attributes and mappings, linked tables, tables of linked columns and
    of the inputs of linked mappings) and its mappings' lines; the coverage colours stay on.
22. **Momentary:** not saved (D-22); turned off when switching canvas and by “Show everything” (the view reset). Changing
    the selection keeps Focus on and moves the lit set.
23. Every role, including reader, can use Focus and see coverage colours (view only).

## 4. Steps (stop after each one)

1. **Questions** (section 7) answered in the acceptance doc; the docs plan; no code. Fix the B2 sentence in
   `docs/perf/04b1-step0-switch-trace.md` (no separate fallback). Stop.
2. **Tooling** (items 1–5). Smoke runs only, figures thrown away. Three full e2e runs. Stop.
3. **F4** (items 6–8) behind the existing hook; F1 removed; guards updated (S4P-12's method). No UI yet. Three full e2e
   runs. Stop.
4. **Domain** (items 9–13): scope, coverage, panels, index; changed 4a tests listed. Three full e2e runs. Stop.
5. **Markers** (items 14–15). Three full e2e runs. Stop.
6. **Coverage colours** (items 16–19), with the proposal for item 19. Three full e2e runs. Stop.
7. **Focus** (items 20–23). Three full e2e runs. Stop.
8. **Closing:** docs (section 9), the closing sitting (section 6) after Łukasz prepares the laptop, results in the
   acceptance doc, then Łukasz's manual acceptance. Merge only on his command; tag `slice-04b1`.

No measuring sitting before step 8. A step that clearly misses a bar in its smoke run reports it and stops; a trial
needs Łukasz's OK and a time estimate.

## 5. Acceptance criteria

Tests in `e2e/slice-04b1/`, one file per criterion, each from a fresh seed. Data a test starts from is written through
the domain; what the criterion checks goes through the page and is read back from the data file.

| ID | Criterion |
| --- | --- |
| S4B1-01 | Scope and coverage (unit and e2e): an entity link makes one item, covered after one attribute gets an approved, type-correct mapping; an attribute link does not add its entity as an item; a mapping link adds its attribute; a requirement linked only to a table shows 0 / 0, not covered; the seed's figures as agreed in step 1. |
| S4B1-02 | Panels: `email` shows its direct requirements and no “via entity”; Customer shows REQ-101 directly and the attribute-linked ones “via attribute”; an attribute under a linked mapping shows it “via mapping”; a table shows column- and mapping-linked ones; indirect rows have no ×. |
| S4B1-03 | Coverage text and gaps: “{m} of {n} covered” with its tooltip; an entity gap listed and its click goes to the entity. Project home, status bar and left panel bars show the same figures. |
| S4B1-04 | Markers: count and tooltip on entity and table cards match their panels; updated by link, unlink, delete and undo; drawn at 30 %; a click on a marker changes nothing. |
| S4B1-05 | Coverage colours: selecting REQ-102 colours its covered rows blue and its gap orange, no card fades; an entity link tints the header; approving a mapping turns the row blue while selected; Escape and a click on empty canvas clear it. No card's own class or style changes (checked on the DOM). |
| S4B1-06 | Focus: on from the toolbar, the context menu and off from the chip; the lit set for an entity, an attribute, a mapping, a frame, a multi-selection and a requirement (with its colours); off after switching canvas and after “Show everything”; not saved after a reload. |
| S4B1-07 | Holes: dragging a lit card, resizing it and collapsing its frame keep it lit; a note pinned to a lit card stays lit; a note pinned to a faded card fades. |
| S4B1-08 | Roles: reader and reviewer can use Focus and see coverage colours; nothing is written. |
| S4B1-09 | Coverage colours to the screen ≤ 100 ms (median of 30, p95 and max reported), at 100 % and 30 %, frames expanded and collapsed. |
| S4B1-10 | Focus switching to the screen ≤ 100 ms (median of 30, p95 and max reported) for a large lit set and for a requirement, at 100 % and 30 %, frames expanded and collapsed. |
| S4B1-11 | Pan and zoom with Focus on: presented fps within 5 % of Focus off, same branch, same sitting, in every view measured; no more frames over 50 ms than Focus off plus the spread. |
| S4B1-12 | No regression with Focus off against `slice-04p`: presented fps for pan and zoom (overview and dense, frames expanded and collapsed) ≥ −5 %; C-10 and lasso to the screen ≤ 100 ms; C-08 to its last present recorded (traced, diagnosis only). These figures become the new baseline. |
| S4B1-13 | Guards: element and layer counts with Focus off against `slice-04p`, every difference explained (F4's layer); `__imCanvasCommits` and `__imMiniatureCommits` unchanged by selecting a requirement and by switching Focus. |
| S4B1-14 | CI (lint, typecheck, unit tests, schema check) and three full e2e runs in a row; changed earlier tests listed. |

**Done** when every row has a result. If S4B1-10 or S4B1-11 misses, step 8 stops with the figures and Łukasz decides.

**Definition of done (scenario for the manual acceptance).** As Łukasz, in “Customer 360”: select REQ-102 and see its
covered rows blue and its gap orange with nothing faded; approve the gap's draft mapping and see the row turn blue;
turn Focus on and see everything outside REQ-102's scope fade; select Customer and see Focus move to its connections;
drag Customer and see it stay lit; switch canvas and see Focus off; check the requirement markers on Customer and on a
source table against their panels.

## 6. The closing sitting

Full laptop preparation by Łukasz. Measurement builds of this branch and `slice-04p`, made before the restart and reused
with `--no-build`. One unrecorded warm-up, then three rounds, sides rotated, a CPU check before every side, a disturbed
round dropped and replaced. Switching from a settled screen, 10 pairs per case and round. Reported: median, p95, max,
and the settled-check failures per case. Covers S4B1-09 to S4B1-12 only. Step 1 gives the plan with a time estimate
(expected about 2–2.5 h).

## 7. Questions for step 1

- **Q1.** F4 onto the branch: which files, what conflicts with `main` since `f0d0f61`, and how the holes for pinned
  notes are added.
- **Q2.** The requirement index: what it holds today, and what changes for item 9's items, item 12's indirect lists and
  item 14's markers. Is a rebuild still one per data version?
- **Q3.** The overlay: can it draw row and header tints from computed positions the way the hover highlight does, and
  which commits does selecting a requirement cause?
- **Q4.** Focus in the prototype: toolbar placement, shortcut (if any), context-menu entries, the chip, what resets it.
- **Q5.** The seed's coverage figures under the new rules, per requirement, before and after; which 4a tests change.
- **Q6.** The tooling: module names, which specs get a traced mode, `measure:canvas` flags, and the closing sitting's
  plan with a time estimate.
- **Q7.** Item 19: a first proposal for the summary dot below 40 %.

## 8. Differences from the prototype (deliberate)

- Selecting a requirement does not fade the canvas; only Focus fades (the prototype's “lens” fades automatically).
- An entity link does not bring in its attributes; no “via entity” in attribute panels; attributes show “via mapping”.
- Coverage counts entity items (“has a source”) next to attribute items.
- Coverage colours use the same type check as coverage (the prototype colours any approved mapping blue).
- Notes pinned to a lit card stay lit under Focus.
- When hovering, other lines do not fade (since 4p).
- Requirement cards and their part in Focus come in 4b-2.

## 9. Docs in this PR

- `docs/decisions.md` (only with Łukasz's approval):
  - D-31: scope items and coverage as in items 9–10;
  - D-32: markers, coverage colours on selection, fading only through Focus, requirement cards (4b-2);
  - D-34: indirect lists as in item 12;
  - AD-24 “Overlay and fading”: F4 with the reasons, the method rule (to the screen, presented frames), after the
    closing sitting.
- `docs/known-limitations.md`: the corrections listed in step 0's proposal (S4P-02 missed to the screen; S4P-03, C-09
  and the drags as rAF figures, unverified as presented; C-10 and lasso to the screen; C-08's last raster); “Fading to
  the screen: F1's lift re-rasters the big layer” replaced by F4's results; the method entry; the pinned-notes
  limitation closed; item 19's outcome.
- `docs/prd/slice-04p-acceptance.md`: new section “Corrections after slice 4b-1, step 0”; 4p's own text unchanged.
- `docs/data-model-v2.md`: the coverage description, if it has one.
- `docs/ideas.md`: “Requirements at entity level” resolved (link to this PRD); new: coverage by hierarchy (a need covered
  when its children are), “Link all attributes” in an entity panel.
- README and CLAUDE.md: slice status and the measuring rule.
