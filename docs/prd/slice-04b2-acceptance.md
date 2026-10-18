# Slice 4b-2 – Acceptance

Status: **step 3, waiting for Łukasz.** Branch `slice/04b2-requirement-cards`, from `main` at the tag `slice-04b1`
(`8133ee8`). PRD: `docs/prd/slice-04b2-requirement-cards.md` (its section 10 holds the answers below).

## Łukasz's answers after step 1 (18 October 2026)

- **A, B, C, E, F:** as proposed.
- **G, I, J, K, L, M, N:** as proposed.
- **H: the opposite.** Duplicate layout copies requirement cards too: they are part of the canvas's layout. A deliberate
  difference from the prototype.
- **D:** “the veil without its own layer” is B2, which step 0's layer check refuted (Chrome composites every veil by
  overlap). Before step 6, say what is different now:
  - with a reason to expect another result, check it with a LayerTree read only (no timing, no laptop preparation);
  - without one, or if the read shows an overlap layer: T3 is dropped. Step 6 is then Focus with requirement cards
    only, and S4B2-11 is measured as it is; if it misses, it is partly met and goes to the performance review.
- **Costly or unclear:** the proposals accepted. Where a test means entity and table cards, its selector is narrowed.
  S4B2-13's drags are measured as presented frames on both sides in every round.
- **Then step 2** (the card), stopping after it.

**What D will need before step 6** (noted now, reported then). B2 put the veil in the viewport's big layer, and the
check found Chrome composites it by overlap with the notes', frames' and sticky headers' layers below it. Step 1's
proposal puts it **inside the overlay**, which is already a composited layer (`will-change: transform`) above all of
those. Its own children are what it would overlap. That is a reason to expect another result only if nothing inside
the overlay before the veil has a layer of its own, and 4b-1's step 6 read found the coverage SVG with one (2–8 Mpx)
without a veil. So the read before step 6 first asks why that SVG had a layer; without an answer, T3 is dropped.

## Step 4: placing from element panels (18 October 2026)

Items 14–16. D-41 and the data-model text applied as approved.

### What changed

| Part | Change |
| --- | --- |
| Requirements section (`requirements-section.tsx`) | for those who may edit: each row (direct and indirect) gets a “Place card” icon and can be dragged (`REQ_CARD_DRAG_TYPE`); under the list “Add all to this canvas”, or “Add the {n} missing to this canvas”, hidden when all are here. A click on the name still opens the requirement's panel. The row carries `data-on-canvas` |
| Canvas (`ModelCanvas.tsx`) | `placeRequirementCardsBeside` (item 15): the element's anchor (prototype `elemAnchor`: its card, or its block in a collapsed frame; an attribute's or column's card from 20 px above its row; a 20 × 40 box around a mapping's middle; none when the element is not here: the view's top centre), then `requirementCardSpots` (step 2) keeping clear of cards, blocks, notes and requirement cards; one change; the view fits the element and the new cards when one is outside it; one card placed is selected; toast “Placed {n} requirement card(s) on this canvas.” `showRequirementCard`: selects a card already here and fits a 630 × 400 box around it (prototype `showReqCard`). A row dropped on the canvas places its card there (top middle 115 px left and 30 px above the drop, on the grid; prototype), or moves it there when it is here (M), and selects it |
| Entity and table panels (item 16) | “Add to this canvas” where “Remove from this canvas” stands, when the card is not on the open canvas: placed with its top middle at the view's centre, a third down (prototype `add-card`), and selected; on a live canvas it asks first, as any add there (D-11) |

### Assumptions

- **Readers and reviewers** get neither the icon, nor the drag, nor “Add all”, nor “Add to this canvas” (item 24; the
  permissions sweep is step 7).
- **The rule moves a card past what is in the way:** “Add all” on Customer placed three cards beside it and the fourth
  below Order Line, the first free place going down (prototype). Checked in the browser.
- **A mapping hidden whole in a collapsed frame** has no line, so its cards go to the view's top centre.

### Tests

| Test | What |
| --- | --- |
| `e2e/slice-04b2/S4B2-04.spec.ts` (new) | at 300 % with Customer at the left edge, birth_date's “Place card” places REQ-105 at (832, row − 20 on the grid), selects it, and the view fits it; on the card already here it selects it and writes nothing; a click on REQ-103's name opens its panel; REQ-101's row dragged onto the canvas places its card at the drop; “Add the 2 missing to this canvas” places REQ-102 and REQ-103 stacked at x = 832, then the button goes |
| `e2e/slice-04b2/S4B2-05.spec.ts` (new) | Product and the table `items` (not on “Customer & orders”) opened from REQ-101's traces: no “Remove from this canvas”, “Add to this canvas” places the card at the view's centre, upper third, selects it, and the panel then offers “Remove” |

No earlier test changed in this step.

### Proposed text (for Łukasz's approval; not applied)

**`docs/decisions.md` D-34**, the closing bracket replaced:

> … Clicking a requirement opens its panel. (Changed in slice 4b-1.) Each row's “Place card” places the requirement's
> card next to the element, or shows its card when it is on the canvas; a row dragged onto the canvas places the card
> where it is dropped; “Add all to this canvas” or “Add the {n} missing to this canvas” under the list. An entity or table
> panel whose card is not on the open canvas offers “Add to this canvas”. (Changed in slice 4b-2.)

RUNS4_PLACEHOLDER

## Łukasz's answers after step 3 (18 October 2026)

- **Step 3 accepted.**
- **4.** The e2e timing is the laptop, not the branch: no fix and no extra run.
- **D-41 and the data-model text approved as written:** applied in step 4 (`docs/decisions.md` D-41,
  `docs/data-model-v2.md` under `canvas_item`).
- **Then step 4** (placing from element panels, items 14–16), stopping after it.

## Step 3: trace lines (18 October 2026)

Items 8–12. Before it, answer 4: why the e2e runs grew.

### Why the e2e runs grew from 27 to 32 min (answer 4)

`slice-04b1`'s own suite, run today on the same laptop from the reference worktree (`../infomapper-ab-main`, its
fresh build folder, one run from scratch), took **33.8 min**, against 26.8–27.6 min on 17 October. Step 2's three runs of
this branch took 31.8–32.1 min.

| Run (18 October) | Tests | Total | Inside the tests |
| --- | --- | --- | --- |
| `slice-04b1` | 173 | 33.8 min | 31.6 min |
| this branch, step 2, run 1 / 2 / 3 | 175 | 31.8 / 32.1 / 32.1 min | 30.2 / 30.3 / 30.1 min |

**Per file** (the branch's median of three against `slice-04b1`'s run, seconds):

| File | `slice-04b1` | Branch | Difference |
| --- | --- | --- | --- |
| `slice-04b2/S4B2-02` (new) | – | 21.8 | +21.8 |
| `slice-04b2/S4B2-01` (new) | – | 7.5 | +7.5 |
| `slice-03a/S3A-09` | 13.4 | 18.7 | +5.3 |
| `slice-04b1/S4B1-06` | 16.7 | 19.7 | +3.0 |
| `slice-03a/S3A-04` | 6.4 | 8.9 | +2.5 |
| `slice-02a/S2A-14-pan-zoom` | 42.6 | 45.0 | +2.4 |
| `slice-02c/S2C-01` | 29.8 | 32.1 | +2.3 |
| `slice-02c/S2C-07` | 14.4 | 16.6 | +2.2 |
| `slice-02a/S2A-10` | 12.4 | 14.6 | +2.2 |
| `slice-03a/S3A-13` | 32.2 | 34.1 | +1.9 |
| … the most shrunk: `slice-01a/S1A-14` | 60.0 | 47.4 | −12.6 |
| `slice-00/S0-10`, `slice-04a/S4A-11`, `S0-04`, `S0-05`, `S4B1-05` | | | −6.3 to −6.8 each |

**Reading:**
- **Not the branch.** On the same day the branch spends 1.4 min less inside its tests than `slice-04b1`, the two new
  tests (29 s) included. The ten files that grew most, after the two new ones, grew by 2–5 s each, while as many shrank
  by 6–13 s: the noise of one run against three.
- **So not REQ-104's card, not the requirement index, not renders.** A cost there would show on the demo canvas's
  tests (S2A-*, S3A-*, S4A-*), and those moved both ways.
- **It is the laptop today:** the same code ran 6–7 min slower than on 17 October. I don't know why (background load,
  power mode, a Chrome update since); I did not change anything to find out.
- **Proposal:** no fix. If you want the reason, a restart and one `slice-04b1` run afterwards (about 30 min) would show
  whether it comes back to 27 min. Each step keeps reporting its three runs' times.

### What changed

| Part | Change |
| --- | --- |
| `trace-data.ts` (new) | `buildTraces`: per requirement card on the canvas, one line per direct link to an element that is here: an entity or table (its card), an attribute or column (its row of its card), a mapping (its line); none to an element off the canvas |
| `line-geometry.ts` | `traceGeom`, from data (AD-24 rule 2): the nearer side of the element's card, at the header's middle or the row's height (a hidden row: the header, as mapping lines); a mapping's middle (`MapGeom.mid`: its curve's middle, or the ƒ node of a combined mapping); a card in a collapsed frame: its member row in the block, past the sixth the “and N more” row (`blockRowY`). It starts at the requirement card's point nearest to that end. A mapping in a bundle ends at the bundle line's middle; one hidden whole in a collapsed frame ends at its attribute's block row |
| `LineLayer.tsx` | a fourth group in the one SVG (AD-24 rule 3): a dashed path and an end dot per line, no dot below 40 %, no group per line (S3A-14). Each line is drawn again only when its ends move (memo on its coordinates) |
| `ModelCanvas.tsx` | the traces from the requirement index once per set of cards and data version (not per move); passed only in “Everything” (item 10) |
| `canvas.css` | `.trace` dashed in `--im-req`, `.trace-dot`; under the layer's `dimmed` class (a selection with related lines) they fade with the other lines, never on a hover (B) |
| `known-limitations.md` | B's note under “C-10 met; the other lines do not fade on a hover” |

What redraws them (item 11): the line layer re-renders on node changes (a drag, a resize, a collapse), and a line whose
coordinates did not change keeps its element; a link changes the page's data and so the traces; panning and zooming
change no node, so the layer is rastered once and moved by the compositor.

### Tests

| Test | What |
| --- | --- |
| `e2e/slice-04b2/S4B2-03.spec.ts` (new) | REQ-104 (four seeded rows) also linked to Customer, `order_header`, a column of `customers`, a mapping onto Customer and Product (off the canvas): eight lines, none to Product; every line starts on the requirement card's edge; ends at Customer's and `order_header`'s right edge at the header's middle, at the `total_amount` and `email_addr` rows, at the mapping line's middle; Customer dragged, its line follows; none in “Mappings” and “Relationships”, eight again in “Everything”; Sales Order and Order Line in a collapsed frame: their lines end at their member rows on the block's edge |
| `src/canvas/trace-data.test.ts` (new) | `buildTraces` (card, row, column, mapping, table; none off the canvas, none for a deleted link); `traceGeom` (nearer side, nearest point on the requirement card, row height, mapping middle, block row and “and N more”, nothing without both ends); `nearerSide`, `nearestOn` |

No earlier test changed in this step.

### Checked in the browser

“Customer & orders” at 62 %: REQ-104's four dashed lines run from the top of its card to the right edges of Sales Order's
`total_amount` row and Order Line's `quantity`, `unit_price` and `discount_pct` rows; no console error.

### Three full runs

No dev server, Playwright or measurement server running; each run from scratch (`npm run e2e`), in a row:

| Run | Result | Time |
| --- | --- | --- |
| 1 | 176 passed | 33.6 min |
| 2 | 176 passed | 32.2 min |
| 3 | 176 passed | 32.0 min |

Lint, typecheck and the unit tests (1,004 in 76 files) pass. 176 is step 2's 175 plus S4B2-03 (about 60 s).

### The texts you approve in this report (not applied)

**`docs/decisions.md` D-41**, replacing the line:

> **D-41** Requirement card: 230 px, filled header in a reserved violet (excluded from the concept palette) with the
> kind's icon, the key and the kind's name; the name; a three-part coverage bar over the requirement's items (D-31):
> covered, mapped but not approved, not mapped (an entity item is mapped when any of its attributes has a mapping); the
> status badge and “{m} of {n} covered”. Below 40 % the header and a plain block. Selecting the card is selecting the
> requirement. A requirement has at most one card per canvas; its cards are layout, never frame members, carry no label
> on a live canvas and hold no pinned notes; Duplicate layout copies them. (Changed in slice 4b-2.)

**`docs/data-model-v2.md`**, under `canvas_item`, after the table:

> A requirement card (`requirement_id` set) stores `width` null (drawn 230 px), `collapsed` false, `row_filter` `all`,
> and `frame_id` and `live_level` null: it is layout only (slice 4b-2).

## Łukasz's answers after step 2 (18 October 2026)

- **Step 2 accepted.**
- **1.** REQ-104's card stays at (1176, 1136).
- **2.** The layer result is accepted for step 2. In the closing sitting S4B2-15 also reports the cost of cards laid over
  frames at 30 % (layers and presented fps), and whether item 15's placement can ever put a card over a frame.
- **3.** D-41 and the data-model text: quoted in full in the next report, approved there; not applied until then.
- **4.** The e2e runs grew from about 27 to 32 min with two new tests: before step 3, find out why (per-file durations
  against `slice-04b1`, the ten files that grew most, the app or the tests). No fix without Łukasz's OK.
- **Then step 3** (trace lines), stopping after it.

## Step 2: the card (18 October 2026)

Items 1–7, 13 and 25, with the answers G, H, I, J, L and N where they touch the card.

### What changed

| Part | Change |
| --- | --- |
| Data (Q1) | The adapter's guard `canvas_item_no_requirement_yet` is gone; undo checks a card's requirement as its parent; deleting a requirement soft-deletes its cards on every canvas in the same change group |
| Domain | `placeRequirementCards` (one or more, one change group; refused for reviewers and readers, a second card on a canvas, a deleted requirement); `card-kinds.ts` (`isRequirementCard`, `isElementCard`); the frame rules, the live sync and note pins ignore requirement cards (item 6, G, N); `moveOnCanvas` moves requirement cards by position only, never into a frame; removing them on a live canvas needs no label (G); `coverageBar` and `entityNotApproved` for the bar's middle part over entity items (item 2); `requirementCardSpots`, item 15's placing rule (pure, used by the seed now and by the panels in step 4) |
| Canvas | `RequirementCardNode`, a third React Flow node type with its own state beside the cards; `requirement-card-data.ts` builds the cards on the server from the requirement index. Selecting it is selecting the requirement (`req:<id>` keys in the selection); the mark is in the overlay (`SelectionOverlay`); single drag, group drag, nudge, lasso and Ctrl+A move it in the same change as the cards (`ReqMover` in `useFrames` and `GroupActions`, one undo step); Delete and the card's menu remove the card; fit (F) and the Overview's miniature include it (I) |
| Panels | The requirement panel: “Place its card on this canvas” (the view's top centre) or “Remove its card from this canvas”; the Requirements tab's “Only on this canvas” and the on-canvas dot (J) |
| Seed (A) | REQ-104's card on “Customer & orders”, by item 15's rule from the Sales cards' box (below) |

### The seed's REQ-104 card: where item 15's rule put it

Answer A said 80 px right of the Sales cards' box, 40 px below its top: (1176, 608). The `order_line` table already
stands at (1176, 600), with two notes pinned below it. So the seed uses item 15's rule from that point: down in 16 px
steps to the first place 20 px clear of cards and notes. The card lands at **(1176, 1136)**, below `order_line`'s notes,
right of the Sales cards. If you prefer it elsewhere (for instance right of `order_line`, at x = 1512), say so.

### Assumptions

- **No toast when placing from the requirement's panel** (prototype `req-card`); removing a card toasts “Removed
  REQ-104's card from this canvas. The requirement stays.” with Undo, as removing an element card does.
- **Delete and the card's menu clear the selection** after removing the card (prototype); the panel's “Remove its card”
  keeps the requirement selected, so its panel stays open.
- **The project tiles have no thumbnails** in the app (an empty strip), so I's “tiles” part has nothing to draw. The
  tile's card count stays the entity and table cards.
- **A live canvas's “Remove from this canvas” for several** still refuses when the selection holds element cards (D-11);
  a selection of requirement cards only is removed.
- **The height** comes from the name's lines (`requirementNameLines`, an estimate that errs on more lines), so the card's
  height is the same at every zoom and known before it is drawn. S4B2-01 checks that the name never reaches the bar.

### LayerTree read against `slice-04b1` (AD-24 rule 4)

Measurement builds of both sides (`../infomapper-ab-main` moved to `slice-04b1`; its earlier sitting copies are in a git
stash there), CDP `LayerTree`, no timing (`.data/measure/s4b2-step2-layers/`). “Performance test” with requirement cards
placed through the domain: in a grid over whatever is in view, or by item 15's rule beside elements.

| View | Cards | Drawing layers (`slice-04b1`) | Drawing Mpx | Viewport elements |
| --- | --- | --- | --- | --- |
| “Customer & orders”, 60 % | REQ-104 (seed) | 8 (7) | 4.5 (4.5) | 612 (601) |
| Performance test, 100 % dense | 0 / 1 / 12 grid / 12 beside | 47 / 47 / 47 / 47 (47) | 68.4 | +0 / +11 / +132 / +132 |
| Performance test, 30 % ent:23 | 0 / 1 / 12 grid / 12 beside | 47 / 48 / **53** / 47 (47) | 69.2–69.4 | +0 / +8 / +96 / +96 |

- **Elements per card: 11 at 40 % and above, 8 below** (step 1 estimated 7 below: the plain block has an inner element,
  as on entity cards).
- **No growth at 100 %, and none at 30 % with item 15's placement.**
- **At 30 %, cards laid over frames and other cards get a layer each** for “Overlaps other composited content”: 6 of 12.
  The frames' bodies, labels and handles are composited in that view. Element cards there squash into one shared layer;
  scattered requirement cards do not (Chrome does not squash sparse layers). Notes behave the same way today (each note
  over composited content has its own layer in the same read). Drawing the requirement cards below the cards instead of
  above them changed nothing, so they stay above (prototype).
- **“Customer & orders” +1:** REQ-104's card next to the pinned notes, for the same reason.
- **Reading:** the rule holds for cards where the app places them; a user who drops many cards over frames at 30 % adds
  a layer per card, as with notes. S4B2-15 counts this again in the closing sitting.

### Tests

| Test | What |
| --- | --- |
| `e2e/slice-04b2/S4B2-01.spec.ts` (new) | the card's content against the domain for REQ-101, REQ-104, REQ-105; tooltip; 230 px; the name above the bar; below 40 % header and block at the same height |
| `e2e/slice-04b2/S4B2-02.spec.ts` (new) | placed from the panel at the view's top centre; one per canvas; moved on the grid and kept out of a frame; removed from the panel, the menu and by Delete; deleting REQ-104 removes its cards on both canvases, undo restores them; Ctrl+A and a group drag take it along, one undo |
| Unit (new) | `requirement-card-data.test.ts`, `requirement-placement.test.ts`; requirement cards in `canvas-item`, `frame` (moves), `requirement` (cascade and undo), `canvas` (duplicate copies them, H), `selection`, `text-fit`, `requirements` (`coverageBar`), the adapter (a requirement card, one per canvas) |
| `e2e/slice-01a/helpers.ts` (changed) | `loadItems` returns the entity and table cards, as every caller meant; `loadRequirementCards` and `cardNodes` are new |
| `src/data/local/model-store.test.ts`, `requirement-store.test.ts` (changed) | the demo seed's counts: seven element cards plus REQ-104's card; REQ-104's card is the only requirement card |
| `selection.test.ts`, `requirements.test.ts` (changed) | `unitsOf` returns `reqs`; coverage carries `entityNotApproved` |

**Changed earlier e2e tests** (the first full run had seven failures; all are REQ-104's seeded card or decision J/L):

| Test | Change |
| --- | --- |
| `S1A-03`, `S2A-11`, `S2A-13` | narrowed to the entity and table cards' nodes (`.react-flow__node-card`, `cardNodes`); expectations unchanged |
| `S2A-02`, `S2B-08`, `S3A-10` | Ctrl+A takes REQ-104's card (L): “9 selected”, “… 1 note, 1 requirement.”, one more item; the selection panel lists it as “REQ-104 Order total …” |
| `S2A-13` | “Remove from this canvas” on Ctrl+A's selection removes eight cards, REQ-104's included (L); undo restores them |
| `S4A-01` | “Only on this canvas” lists REQ-104 (J) instead of the empty text; the test's title says so |

**A regression the suite caught (S4P-06):** with no collapsed frame, every selection change built a new empty block list,
so the canvas handed React Flow a new nodes array and the miniature redrew once per selection. The block list is now one
constant empty array, as the nodes array was before (fixed in `ModelCanvas.tsx`, no test changed).

**The selection panel** (`selection-panel.tsx`) counts and lists requirement cards and offers “Remove from this canvas”
for them; without it a requirement card in a selection showed as a table named “?”.

### Three full runs

No dev server, Playwright or measurement server running; each run from scratch (`npm run e2e`), in a row:

| Run | Result | Time |
| --- | --- | --- |
| 1 | 175 passed | 31.8 min |
| 2 | 175 passed | 32.1 min |
| 3 | 175 passed | 32.1 min |

Lint, typecheck and the unit tests (999 in 75 files) pass. 175 is 173 plus S4B2-01 and S4B2-02. The runs are about 5 min
longer than 4b-1's (26.8–27.6 min); the two new tests take about 50 s, the rest is this laptop's load (the measurement
builds ran just before).

### Proposed texts (for Łukasz's approval; not applied)

**`docs/decisions.md` D-41**, replacing the line:

> **D-41** Requirement card: 230 px, filled header in a reserved violet (excluded from the concept palette) with the
> kind's icon, the key and the kind's name; the name; a three-part coverage bar over the requirement's items (D-31):
> covered, mapped but not approved, not mapped (an entity item is mapped when any of its attributes has a mapping); the
> status badge and “{m} of {n} covered”. Below 40 % the header and a plain block. Selecting the card is selecting the
> requirement. A requirement has at most one card per canvas; its cards are layout, never frame members, carry no label
> on a live canvas and hold no pinned notes; Duplicate layout copies them. (Changed in slice 4b-2.)

**`docs/data-model-v2.md`**, under `canvas_item`, after the table:

> A requirement card (`requirement_id` set) stores `width` null (drawn 230 px), `collapsed` false, `row_filter` `all`,
> and `frame_id` and `live_level` null: it is layout only (slice 4b-2).

### Questions for Łukasz

| # | Question | Proposal |
| --- | --- | --- |
| 1 | **REQ-104's seeded card** sits at (1176, 1136), below `order_line`'s two notes, because answer A's spot is taken (above). | Keep it there. Alternative: right of `order_line` at (1512, 608), closer to the Sales cards' row. |
| 2 | **The texts for D-41 and the data model** above. | Apply them as written, in this PR. |
| 3 | **The layer read:** no growth where the app places cards; at 30 % a card laid over frames gets an overlap layer, as notes do. | Accept for step 2; S4B2-15 counts it again in the closing sitting, and AD-24's text records it after the sitting. |

## Step 1 (18 October 2026)

- **Start:** local `main` was behind `origin/main` (`052daaf`); fast-forwarded to `8133ee8` (tag `slice-04b1`), tree
  clean, in sync with `origin`. No `node`, dev server, Playwright or measurement server running. The Chrome processes
  running were Łukasz's (no `ms-playwright` or remote-debugging command line).
- **The PRD** is copied unchanged from Łukasz's download to `docs/prd/slice-04b2-requirement-cards.md`.
- **No application code changed.** The answers below come from reading the code at `8133ee8` and the prototype; nothing
  was measured.

### Questions for Łukasz (found while answering)

Each has a proposal. A to F change what the PRD says; G to N fill gaps the PRD leaves.

| # | Question | Proposal |
| --- | --- | --- |
| A | **Item 25: the demo seed has no frames.** `seed-model.ts` places the cards “without frames”; the prototype arranges its layout into frames on first load (`arrangeLayout`) and only then places REQ-104 right of the Sales frame (`placeSeedReq`). | Place REQ-104's card on “Customer & orders” 80 px right of the box around the Sales concept's cards (Sales Order, Order Line) and 40 px below its top, on the 8 px grid: where the prototype's Sales frame would put it. |
| B | **Item 12: dimming on a hover.** Slice 4p rejected fading lines on a hover (C-10 228–247 ms against 19–26 ms; `known-limitations.md`, “C-10 met; the other lines do not fade on a hover”). Since then a hover dims no line. | Trace lines **dim on a selection** with the other lines: the line layer's existing `.dimmed` class (one class on the layer's root, set when a selection has related lines), plus one CSS rule for `.trace`. **No dimming on a hover**, as for mapping lines. Under Focus they follow item 21. Recorded as a deliberate difference. |
| C | **Item 21: which requirement cards stay lit.** “Linked to anything in the lit set” lights more than the prototype. Focus on Customer lights its neighbours too (Sales Order through a relationship, the CRM tables through mappings). REQ-104 (Sales Order and Order Line) would then stay lit with Customer focused. The prototype's `reqActive` lights a card only when its requirement's **scope contains the focused element itself**. | **The prototype's rule:** with a requirement focused, only its card; with an element focused, the cards whose scope contains it. For a frame, any member counts; for several selected, any of them; for a mapping, the mapping or its attribute; for a relationship, either entity. The definition of done (“the requirement cards linked to it stay lit”) holds under both rules. Trace lines are lit when both ends are lit, as the PRD says. |
| D | **Item 22, T3 as written cannot have “no layer of its own”.** The veil is its own compositing layer (`will-change: transform`), and the lit lines must paint **above** it. Chrome then has to give them a layer by overlap: that is the 22–31 Mpx layer in 4b-1's diagnosis. Lit lines can only share the overlay's layer if nothing composited lies between them and that layer. | **T3 = the veil without a layer of its own.** It paints into the overlay's layer together with the lit lines, rows and trace lines: one layer instead of three. **The risk:** switching Focus then repaints the overlay layer's visible tiles, not only the veil's. So step 6 adds, besides the LayerTree reads, a **to-screen diagnosis of Focus switching** (10 pairs, 30 % and 100 %, no preparation, figures diagnostic). If switching goes over 100 ms, step 6 stops with the figures. The other way to share a layer is the lit lines inside the veil's SVG (T2), which you dropped. |
| E | **S4B2-10 and S4B2-14 need “Performance test” with and without requirement cards.** S4B2-14 compares with no requirement cards against `slice-04b1`, and S4B2-15 counts elements without and with them. | `seed:large` adds the cards on a **second canvas**, “Performance test – requirements”: the same layout, frames and notes, plus the requirement cards. The original canvas stays as it is in `slice-04b1`, so S4B2-14 and S4B2-15's “without” compare the same data. S4B2-10 and S4B2-11 use the new canvas; its `slice-04b1` side is the original canvas (Q8). |
| F | **S4B2-12, the drop-target highlight to the screen.** The drag from the left panel is native HTML drag and drop. `to-screen.ts` anchors on an input event, and Playwright's CDP drag (`Input.dispatchDragEvent`) may not produce one the trace shows as input. | Anchor on a `performance.mark` the spec sets just before it dispatches each `dragover` move, and then as today (the first commit after it, to the present). Step 5's smoke checks that a trace shows it; if not, step 5 stops with a proposal. |
| G | **Live canvases.** The PRD does not mention them. On a live canvas a card added or removed changes the label (D-11), and requirements carry no labels. `live.ts` treats every card that is not an entity as a table (`source_table_id!`). | Requirement cards are allowed on live canvases as **layout only**: placing, moving and removing them changes no label and needs no question, as notes. The live sync and the live arrange ignore them. Dropping onto an element links, as on any canvas (a link is not labeled, D-26). |
| H | **Duplicate layout.** The app's `duplicateCanvas` copies every card; the prototype's `dupDia` copies entity and table cards and frames, not requirement cards (nor notes, D-20). | As the prototype: the copy gets **no requirement cards**. |
| I | **Fit (F), the Overview's miniature and the project home's tiles.** The prototype includes requirement cards in fit-everything (`fit`), and draws them in the miniature and the tile thumbnails as violet rectangles (`thumb`). The PRD says nothing. | All three as the prototype: one rectangle per card, in `--im-req`. S3B-13's guard (the miniature does not redraw on a pan or zoom) stays, and one drop of a requirement card redraws the miniature once. |
| J | **The Requirements tab's “Only on this canvas”** says “No requirement has a card on this canvas yet.” since slice 4a. The prototype then lists the requirements with a card here, and marks those rows with the on-canvas dot. | As the prototype: the filter shows the requirements with a card on this canvas, and every requirement row gets the dot, as the Model tab's items do. |
| K | **The project home's Requirements list** (`projectRequirements`) lists requirements whose scope touches the project's canvases. The prototype's `projReqs` also lists those whose card lies on one. | As the prototype: a requirement with a card on one of the project's canvases is listed even when its scope touches none. Item 23's score already counts the card. |
| L | **Multi-selection** (item 6, “as for other cards”). The prototype's requirement cards are not in multi-selection (a deliberate extension, then). The group actions differ: arrange, fit widths and “Place sources” make no sense for them. | The lasso and Ctrl+A take requirement cards. Moving them together, “Remove from this canvas” and Delete act on them. Arranging, fitting widths and placing sources ignore them. A lassoed frame stands only for its members (D-17), and requirement cards are never members. |
| M | **Item 17, a requirement whose card is already on the canvas, dropped on empty canvas.** | As the prototype's drop of a placed card: the card **moves** to the drop point and is selected. The hint reads “Move card”, the toast “Moved {key}'s card.” |
| N | **Notes pinned to a requirement card.** The prototype pins notes to entity and table cards and frames only. | Not offered: a note dropped on a requirement card stays free. If a requirement is deleted, no pinned note needs releasing. |

**Left out on purpose** (prototype features the PRD does not ask for; to `docs/ideas.md` in step 8):
- double-click on a requirement card opens the description editor, and the card menu's “Edit description…”;
- “Show its requirements (n)” in the attribute row and card menus;
- resizing a requirement card (230 px fixed, as the prototype).

### Q1. Data

**The schema and the adapter already have the column, the check and the index.**

| What | Where | State |
| --- | --- | --- |
| `requirement_id` | `canvas_item` in the initial migration, `CanvasItem` in `types.ts`, the adapter's foreign keys (`schema.ts:282`) | present |
| “Exactly one of entity, table, requirement” | `canvas_item_one_target_ck` in the migration and the adapter | present |
| One card per requirement per canvas among live rows | `canvas_item_requirement_uq` (partial unique index) and the adapter's `unique` with `live: true` | present |
| **Refusing requirement cards** | the adapter's extra check `canvas_item_no_requirement_yet` (`schema.ts:294`, “requirement cards come with slice 4b”) | **to remove in step 2** |
| Soft delete, versions, change events | generic for every table | nothing to do |
| Undo | `undo.ts`'s `PARENTS` for `canvas_item` lists canvas, entity, table and frame, **not requirement** | **add `["requirement_id", "requirement"]`**, so undo and redo check a card's requirement as they check its entity |
| The data file's format | no column changes, so no new `format` | nothing to do |

**The delete cascade.** `deleteRequirement` (`requirement.ts:240`) soft-deletes the links and lifts the children. It
does not see canvas items. Step 2 gives it the live `canvas_item` rows of the workspace and soft-deletes every card of
the requirement, on every canvas, in the same change group. One undo brings the requirement, its links and its cards
back. No note needs releasing (N).

**What a requirement card stores.** `width` null (drawn 230 px), `collapsed` false, `row_filter` `all`, `frame_id` and
`live_level` null. The domain keeps them so: the frame rules never set `frame_id` on a requirement card (item 6), and a
command that would is refused.

**`docs/data-model-v2.md`:** one sentence under `canvas_item` saying the above. No table or migration change. It needs
your approval of the text, as the file says.

**A sweep, step 2.** Several readers assume a card is an entity or a table. Each gets an explicit
“element cards only” filter, tested:
- `live.ts` (`source_table_id!`, three places);
- `frames.ts`' `dropCards` and `frame.ts`' `moveOnCanvas` (membership, arranging, fitting);
- `canvas-item.ts`' duplicate check;
- `card-data.ts`' `buildCards`;
- `tree-data.ts` and `stats.ts` (presence dots, tiles, project statistics);
- `selection.ts`, the lasso and `GroupActions.ts`;
- `notes.ts` (pins).

### Q2. The card

**Component.** `RequirementCardNode` in `src/canvas/`, a third React Flow node type next to `card` and `block`
(`nodeTypes` in `ModelCanvas.tsx:107`). Its data comes from a pure `buildRequirementCards(index, items)` beside
`buildCards`: key, kind, name, status, the description's first 300 characters, and the bar's three counts. The counts
come from the requirement index the canvas already gets (4b-1), so nothing is built a second time.

**The bar's three parts (item 2).** `RequirementCoverage` has `covered`, `notApproved` and `notMapped` for attribute
items, but one `entityGaps` list for entity items. Step 2 splits it into entity items that are **mapped but not
approved** and those **not mapped**, with unit tests. `done`, the “{m} of {n}” text and 4b-1's panels stay as they are.

**Elements per card** (AD-24 rule 4: keep repeated marks to one element):

| Part | At 40 % and above | Below 40 % |
| --- | --- | --- |
| React Flow's node wrapper | 1 | 1 |
| The card | 1 | 1 |
| Header: the kind's icon as a CSS mask (as 3a's label marks), key, kind's name | 4 (header + 3) | 4 |
| Name (wraps; no clip, no `overflow: hidden`, height from content) | 1 | – |
| The bar: **one element** with a three-stop `linear-gradient` background | 1 | – |
| Footer: status pill, “{m} of {n} covered” | 3 | – |
| The plain block | – | 1 |
| **Total** | **11** | **7** |

- **No opacity, no `transform`, no `overflow: hidden`.** The prototype's `.rq-card` clips its header with
  `overflow: hidden`; here the header gets its own top radius instead.
- **The selection mark** is drawn in the overlay (`SelectionOverlay`) in violet, not as a box-shadow on the card.
- **The tooltip** is the card's `title`.
- **Height.** Drawn from content, so React Flow measures it, and the lines and holes use the measured size.
  Placement (item 15) cannot wait for a measure, so it uses a pure estimate, `requirementCardHeight(name)`, from
  `text-fit.ts`' character widths. The estimate is unit-tested against the measured heights of the seed's names in
  step 2's e2e test.

**The LayerTree read (step 2, against `slice-04b1`).** “Customer & orders” with REQ-104's card, and “Performance test –
requirements” (E) at the overview, 100 % dense and 30 %, frames expanded:
- drawing layers and total megapixels, with and without the cards;
- elements in the viewport.

**The bar:** the number of drawing layers does not grow with the number of requirement cards (one more card, the same
count). Any difference is explained. The same read is S4B2-15's.

### Q3. Trace lines

**Where.** In `LineLayer`'s one SVG (AD-24 rule 3), a fourth group after the tethers. Each line is a `path` and a
`circle` (no group, as the tethers: slice 3a's S3A-14). No end dot below 40 % (rule 1). Dashed, in `--im-req`, without
opacity on the elements (rule 4). Selection dimming (B) is the layer's existing class.

**Their ends.** A pure `traceEnds(card, links, lookup)` in `line-geometry.ts`, from data (rule 2):

| Target | End |
| --- | --- |
| Entity or table | its card's nearer side edge, at the header's middle (`HEAD_H / 2`) |
| Attribute or column | the nearer side edge, at `rowEnd`'s height. A row hidden by its card's row filter or a collapsed card anchors at the header, as mapping lines do (`rowEnd` already does it). |
| Mapping, one input | the middle of its curve (`curve().mid`) |
| Mapping, several inputs | the ƒ node (`fNode().node`), where its inputs meet |
| Inside a collapsed frame (item 9) | its member row in the block, by the formula 4b-1's coverage dot uses (`CoverageLayer.tsx:95`), at the block's nearer edge. Past the sixth member: the “and N more” row. |
| A mapping with an end in a collapsed frame | the middle of the bundle line that carries it |

The start is the point of the requirement card's rectangle nearest to the end (the prototype's clamp). No line to an
element that is not on the canvas.

**What redraws them.** `LineLayer` already re-renders on every node change (`useStore((s) => s.nodes)`) and reuses each
line's element while its key is unchanged. A trace line's key is both cards' `cardKey`, plus the block's rectangle when
the end is in a collapsed frame, plus the link's object identity. So:
- a drag recomputes the lines of the dragged cards only;
- linking or unlinking changes the canvas's data and redraws the affected lines;
- collapsing or expanding a frame changes the block and redraws its lines.

Panning and zooming change no node, so nothing re-renders. The layer is rastered once and moved by the compositor.

**The layer switch (item 10).** Trace lines are built only in “Everything”, which costs nothing in the other modes.

**Item 9's cost.** A lookup of the member's index in the block's data (already built for 4b-1's dots) and one
multiplication. No DOM read, no new element. The cost is the same as a row end.

### Q4. Dragging from the left panel

**Today.** The Model and Sources tabs' items drag with native HTML drag and drop, with a custom type
(`CARD_DRAG_TYPE`, `left-panel.tsx:579`). The canvas's `onDragOver` and `onDrop` (`ModelCanvas.tsx:1392`) take it and
place the card where it is dropped. Requirement rows do not drag yet. The column drag inside the canvas
(`ColumnDrag.tsx`) is pointer events, and marks its drop target by **adding a class to the row** (`.drop`), which
restyles the card. Item 18 forbids that, so it is not reused.

**The new drag:**
- **The type.** Requirement rows in the left panel set `REQ_DRAG_TYPE` with `{ requirementId, key, name }`. Element
  panels' rows set a second type, `REQ_CARD_DRAG_TYPE` (item 14: a drop only places the card, never a link).
- **The drop target,** on every `dragover`, from `document.elementFromPoint`, in this order:
  - a row (`.row[data-row]`) of an expanded card at 40 % and above;
  - a mapping line's hit path (`.lnk.map .hit`; a bundle of one mapping counts as that mapping);
  - an entity or table card (not a block);
  - otherwise the pane, or a collapsed frame's block: “Place card”, or “Move card” (M).

  A bundle of two or more mappings is no target; the drop places the card. Below 40 % there are no rows, so the card
  is the target.
- **“Already linked”** compares with the requirement's **direct** links, from the index the canvas has.
- **Commits.** The target goes into a **value store** (as 4p's hover), written only when it changes.
  - **The highlight:** `DropTargetMark` in `OverlayLayer` subscribes to it. It draws a row or card rectangle, or the
    mapping drawn again with `MapPath`, computed from data like the hover's.
  - **The hint:** a small fixed element outside React Flow, in a portal on `document.body`. Its text comes from the
    store; its position is set on its style from each `dragover` (no React render).
  - So a drag over targets re-renders the mark and the hint, never `ModelCanvas` or the miniature. S4B2-15 checks it
    with `__imCanvasCommits` and `__imMiniatureCommits`.
- **{name} in the hint and the toast:**
  - the attribute's or column's name;
  - the entity's or table's name;
  - for a mapping, the label the requirement panel's link list uses.
- **The drop** runs `linkRequirementAction` (existing, undoable) or `placeRequirementCardAction` (new), then the
  toasts of item 19, the link's with Undo.
- **Esc and leaving the canvas** clear the store.

### Q5. Placement next to an element

**The prototype's `placeReqCards`,** with the PRD's figures:

| Step | Rule |
| --- | --- |
| The anchor | entity or table: its card's rectangle (its block's if it is in a collapsed frame); attribute or column: the card's rectangle with its top at the row's height − 20; mapping: a 20 × 40 box around its middle (Q3's end) |
| x | anchor's right edge + 80 (the prototype's gap), on the 8 px grid |
| y | the anchor's top, on the grid. Going down in 16 px steps until the card's rectangle with the estimated height (Q2), grown by 20 px, meets no element card, block, note or requirement card (at most 400 steps, as the prototype) |
| Several cards | each below the one before, 24 px apart, each with the same free-place search |
| The fit | if any placed card is outside the view, the view fits the anchor and the placed cards with 40 px around them, animated (`centerOnRect`) |
| Toast | “Placed {n} requirement card(s) on this canvas.” One card placed: it is selected |
| Already there (the row's icon) | select it and bring it into view (the prototype's `showReqCard`: a 630 × 400 box around it) |

- **One command for all of them,** so “Add all” is one change group and one undo step.
- **The search** is a pure function in `geometry.ts` (beside `besideSpots`), unit-tested on the prototype's cases.
- **Frames are not avoided,** as in the prototype. A card placed inside an expanded frame's area is not a member
  (item 6), and the frame does not take it along when it moves.

**“Place its card on this canvas” (item 13):** x = the view's centre − 115, y = the view's top + 60 (the prototype),
on the grid. The requirement stays selected.

**“Add to this canvas” (item 16):** the existing `placeAt`, at the view's centre and upper third. The card is then
selected.

### Q6. Focus with requirement cards

- **The lit cards** (C): `requirementCardsLit(index, request, model)`, a domain function next to `focusLit`, tested per
  target kind. The request's key already changes with the selection, so nothing new triggers it.
- **The holes (item 20):** `litNodeIds` in `fade-canvas.tsx` gains the lit requirement cards' node ids. `FadeLayer`
  cuts their holes with the measured size, as for other cards. Requirement cards are never in a collapsed block, so
  they never need a block's hole.
- **Trace lines:**
  - they lie in the line layer below the veil, so a faded one is faded by the veil, with no restyle;
  - a lit one (both ends lit) is drawn again above the veil, next to the lit mapping lines (`LitLines` gets a `traces`
    list).
- **Switching** stays a store change: `FadeLayer` and the overlay commit, the canvas and the miniature do not (S4P-12,
  S4B1-06).

### Q7. T3

**What it is** (D): the veil loses `will-change: transform`. The veil, the lit lines, the lit trace lines and the
coverage marks then paint into the overlay's one layer.

**The reads, step 6.** CDP `LayerTree`, as 4b-1's step 6, on “Performance test – requirements”: 100 % and 30 %, frames
expanded and collapsed, Focus off / ent:23 / REQ-102, before and after T3.

| Figure | Before (expected, from 4b-1) | After (the aim) |
| --- | --- | --- |
| Drawing layers with Focus on | off + 2 (veil, lit lines) | off + 0 |
| The overlay's layer | the overlay's marks only | the veil's size (about 543 Mpx at 30 %, only visible tiles rastered) |
| Lit lines' own layer | 22–31 Mpx | none |

**The risk.** Chrome may still give the overlay's content more than one layer:
- by overlap with something composited inside it (the selection marks, the hover);
- or because a 543 Mpx layer gets split.

The read shows which. And switching repaints a larger layer (D). Step 6 then reports:
- the LayerTree figures;
- the to-screen diagnosis of Focus switching;
- C-10 with Focus on, as a diagnosis: a hover then repaints the overlay's layer, the veil's visible tiles included.

**If any of them misses,** step 6 stops with a proposal. The pan figure itself is S4B2-11, in the closing sitting.

### Q8. `seed:large`, and the closing sitting

**The cards** (E), on “Performance test – requirements”, the original layout copied:

| Requirement | Links | Trace lines | Placed |
| --- | --- | --- | --- |
| REQ-101 small (existing) | 6 attributes of ent:19 | 6 | beside ent:19 |
| REQ-102 large (existing) | 46 attributes of ent:3, 4, 7, 19 | 46 | beside ent:3 |
| REQ-103 dense (existing) | the tables in S1A-14's 100 % view | one per table (about 10) | beside src:57, inside the dense view |
| REQ-104 to REQ-112 (new, 9) | 4 to 8 links each: entities, attributes, columns and mappings, in the overview's frames; two of them in the dense view, one ending in a collapsed frame when frames are collapsed | about 55 | by item 15's placement, next to their first link |
| **Total** | | **about 120 trace lines, 12 cards** | |

- **The placement** uses the same pure function as the app, so the seed shows what a user would get.
- **The views.** Step 7 checks, and reports, that the dense view holds at least 2 cards and 20 trace lines, and the
  30 % overview at least 8 cards and 80 lines.
- **Why this many.** REQ-102 is one card with 46 lines (a realistic worst case for one card); the others add the
  spread. More than a dozen cards on one canvas is past what the prototype's demo suggests a user does.

**The closing sitting** (section 6): this branch against `slice-04b1`, measurement builds made before your restart and
used with `--no-build`, one unrecorded warm-up, three rounds with the sides rotated, a CPU check before every side, a
disturbed round dropped and replaced. 4b-1's rates: a settled switch about 2.6 s, a page about 8 s, a traced pan about
25 s, an untraced pan about 18 s.

| Criterion | Side | Cases | Per round |
| --- | --- | --- | --- |
| S4B2-10 cards and lines in view, Focus off | branch on “– requirements”; `slice-04b1` on “Performance test” (shared with S4B2-14's side) | overview and dense, expanded and collapsed: 4 traced, 4 untraced pans | about 3.5 min |
| S4B2-11 pan with Focus on at 30 % | branch | 30 % and 100 %, expanded and collapsed × (off, ent:23, REQ-102): 12 traced, 12 untraced | about 9 min |
| S4B2-12 to the screen | branch | the drop-target highlight (row, card, line), selecting a requirement card, Focus on with cards lit; 100 % and 30 %, expanded; 10 pairs each | about 6 min |
| S4B2-13 dragging a card | branch | a requirement card and an entity card, 100 % and 30 %, traced | about 2 min |
| S4B2-14 no regression, no requirement cards | both, on “Performance test” | 4 pans traced and untraced; C-10 10 pairs; the lasso 10; C-08 five loads | about 6.5 min each |
| Server start and CPU check | both | | about 1.5 min each |

- **Per round:** the branch about 28.5 min, `slice-04b1` about 8 min, so about 37 min.
- **Three rounds:** about 1 h 50 min.
- **Warm-up** (one pair or pan per case, both sides): about 12 min.
- **Total about 2 h 5 min,** plus about 37 min for each replacement round. The builds (about 10 min) come before your
  restart and are not counted.
- **S4B2-15's element and layer counts** are LayerTree reads, not timed: in step 8, before the sitting, with no
  preparation. Its commit guard is an e2e spec in every run.
- **Option** (not in the estimate): the 30 % Focus pans on the `slice-04b1` side too, a direct A/B of T3. That is
  4 traced pans per round, about 12 min for three rounds. **Proposal:** no; S4B2-11 compares Focus on with off on the
  same branch, as 4b-1 did.

### Q9. Earlier tests that change

| Test | Why | Step |
| --- | --- | --- |
| Tests that count or walk every node on “Customer & orders” (`.react-flow__node` in `S1A-03`, `S2A-06`, `S2A-11`–`S2A-13`, `S2C-01`, `S1B-11`, `S4B1-05`, `S4B1-07`, and the slice 1a helpers) | REQ-104's seeded card is a node. Where a test means “entity and table cards”, its selector narrows to `.react-flow__node-card`; no expectation changes | 2 |
| Fit-everything tests (`S1A-09`, `S1B-03`, `S2B-13`, `S2C-03`, the 1b measuring helper) | F includes requirement cards (I), so the fitted view of “Customer & orders” changes | 2 |
| Ctrl+A and lasso tests on the demo canvas (`S2A-*`) | requirement cards join the selection (L) | 2 |
| Overview miniature tests (`S3B-13`) | the miniature draws requirement cards (I) | 2 |
| `S4A-08` and `S4B1-04` (deleting a requirement) | deleting REQ-104 also removes its card; undo brings it back | 2 |
| Panels' Requirements section (`S4A-07`, `helpers.ts`' `sectionRows`) | each row gains the “Place card” icon, and the list “Add all” (item 14). `sectionRows` reads the name only | 4 |
| `S4A-01`, `S4B1-03` (left panel) | “Only on this canvas” lists requirements with a card (J); requirement rows get the presence dot | 2 |
| `S4A-13` | item 23: REQ-103 opens “Customer & orders” (it holds Customer), not the last opened “Order lines & products”. The case “after Order lines & products, that one opens” becomes a requirement scoring zero on every canvas | 7 |
| `S4A-13`, `S4B1-03` (project home list) | requirements with a card are listed (K); with the demo seed the list stays the same (all five touch “Customer 360”) | 7 |
| `S3B-15-elements`, `S4A-14-elements` | none on “Performance test” (E); a new “– requirements” baseline is S4B2-15's | – |
| `S2C-12`, `S3A-14-idle`, `S3B-15-idle`, `S4P-12`, `S4B1-06` | none expected; they run on canvases without requirement cards or count commits only | – |
| Unit: `requirements.test.ts`, `requirement-index.test.ts` | the entity gaps' split (Q2) | 2 |
| Unit: `schema` and `store` tests on `canvas_item_no_requirement_yet` | the check goes | 2 |
| Unit: `cascades.test.ts`, `undo.test.ts`, `requirement.test.ts` | the card cascade and the undo parent | 2 |

**What I expect, not what I counted:** the list comes from reading the tests. Step 2 runs the full suite with REQ-104's
card in the seed and lists every test it actually changed.

### What in the PRD I think is wrong, unclear or costly

The questions A to F above are the main ones. Besides:
- **Item 2's middle part for entity items needs a domain change** (Q2: `entityGaps` split). Small, but it touches
  4b-1's coverage code. Unit tests cover it, and no panel text changes.
- **Item 25 touches about 36 e2e files that use “Customer & orders”** (Q9). Most will pass unchanged; the risky ones
  count nodes, fit the view or select all. Proposal: keep the card in the seed (as the prototype) and narrow selectors,
  not expectations, in step 2.
- **Item 14's “drag a row onto the canvas” and item 17's drag are two drag types.** A row dragged from an element
  panel onto an element places the card there, on top of the element. That is what the PRD says (“never a link”), but
  it may surprise. Proposal: as the PRD says; the hint reads “Place card” over elements too.
- **S4B2-13's baseline** (“within the baseline's spread for dragging an entity card”). 4b-1 recorded the drags as rAF
  figures, unverified as presented. Proposal: both drags measured as presented frames on the branch in every round.
  The spread is the entity drag's min to max over the three rounds; the requirement drag's median must lie in it or
  above.
- **S4B2-11's “within 5 %” may still miss after T3** (most of 4b-1's cost was the veil, not the lit lines: −6 to −8 %
  alone). The PRD already lets it end partly met; noted so the result is not a surprise.

### Docs plan (section 9)

| File | What | When | Approval |
| --- | --- | --- | --- |
| `docs/decisions.md` D-32 | requirement cards with dashed trace lines (ends, collapsed frames, layer switch, selection dimming per B); placing from panels and dragging from the left panel (link by drop, Undo); Focus lights and fades them (C) | step 6, after the Focus step | Łukasz approves the text first |
| `docs/decisions.md` D-34 | element panels' “Place card” icon, dragging a row places a card, “Add all” / “Add the {n} missing”; “Add to this canvas” on entity and table panels; a click on the name still opens the panel | step 4 | the same |
| `docs/decisions.md` D-41 | the bar's three parts over items (covered / mapped but not approved / not mapped, entity items included); 230 px; below 40 % header and block | step 2 | the same |
| `docs/decisions.md` AD-24 | trace lines in the one line layer; T3's outcome (the veil in the overlay's layer, or why not, with the LayerTree figures); the sitting's figures | step 8, after the closing sitting | the same |
| `docs/data-model-v2.md` | one sentence on what a requirement card stores (Q1) | step 2 | the same (CLAUDE.md) |
| `docs/known-limitations.md` | “Requirement cards are not on the canvas yet” closed; S4B1-11 and S4B1-12's rows updated with the sitting's figures; a new “Where the canvas stands after slice 4b-2” above 4b-1's; B (no dimming on a hover) under the C-10 entry | step 8; B in step 3 | none (corrections) |
| `docs/ideas.md` | “Add to this canvas” and “Project home: open the canvas that shows most of the requirement” resolved, with a link to the PRD; new: the description editor on a requirement card, “Show its requirements (n)” in row and card menus | step 8 | none |
| README, CLAUDE.md | slice status; requirement cards and trace lines in the canvas section; the seed's REQ-104 card and the “– requirements” canvas; new e2e helpers and test hooks | helpers per step; status in step 8 | none |
| this file | each step's results, the criteria table, changed earlier tests, the manual checklist | every step | – |
