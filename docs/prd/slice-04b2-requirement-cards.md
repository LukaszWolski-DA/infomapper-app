# Slice 4b-2 – Requirement cards on the canvas

Status: **draft for step 1**, 18 October 2026. Branch `slice/04b2-requirement-cards`, from `main` at tag `slice-04b1`
(`8133ee8`).

## 1. Why this slice

Slice 4b-1 put requirements on the canvas as markers, coverage colours and Focus. Slice 4b-2 adds the requirement
itself as a card: a violet card with dashed trace lines to what it is linked to, placed from the requirement's panel,
from element panels and by dragging. Dragging a requirement onto an element links it, which makes the canvas a place to
build traceability, not only to read it.

It also closes what 4b-1 left open on performance: pan and zoom with Focus on at 30 % (S4B1-11, partly met) and the
dense view's frame rate after the marker fix (S4B1-12, layers confirmed, fps to confirm).

Decisions agreed with Łukasz on 18 October 2026:

- **A click on a requirement in an element panel opens the requirement's panel** (as since 4a). Placing a card is its
  own action: a “Place card” icon in the row, dragging the row onto the canvas, or “Add all to this canvas”.
- **Trace lines are always shown in “Everything”**, and hidden in the “Mappings” and “Relationships” layer modes.
- **Dropping a requirement on an element links it at once**, with the drop target lit while dragging, a hint at the
  pointer (“Link to birth_date” / “Place card”) and Undo. No confirmation dialog.
- **Two candidates from `docs/ideas.md` are in:** “Add to this canvas” in an entity or table panel whose card is not on
  the canvas, and the project home opening the canvas that shows most of the requirement.
- **T3 is a design step, not a trial:** lit lines in the overlay without a large layer of their own, checked by a
  LayerTree read, judged in the closing sitting. T2 is dropped. If S4B1-11 still misses, it stays partly met and moves
  to the performance review before the database slice.
- **One slice, one measuring sitting at its end**, only the criteria the slice touches (method as in 4b-1: to the
  screen, presented frames, A/B in the same sitting, three rounds, median, p95, max).

## 2. Sources

- `docs/decisions.md`: D-22, D-31, D-32, D-34, D-41, AD-24 (rules 1–4, “Overlay and fading”, “Measuring”).
- `docs/known-limitations.md`: “Where the canvas stands after slice 4b-1”, “Requirement cards are not on the canvas
  yet”, “Focus without the view-state bar”.
- `docs/ideas.md`: “Add to this canvas” on a panel without its card; “Project home: open the canvas that shows most of
  the requirement”.
- `docs/prd/slice-04b1-coverage-focus.md` and `slice-04b1-acceptance.md`: scope items, coverage, the requirement
  index, the overlay, F4 and T1, the to-screen tooling, the diagnosis of T1–T3.
- `docs/data-model-v2.md`: the canvas item with `requirement_id` (exactly one of entity, source table, requirement;
  unique per canvas among non-deleted rows).
- Prototype: `.rq-card` and its CSS, `reqCardH`, `reqTraces` (`.trace-rq`, `.trace-rq-dot`), `reqSection`,
  `elemAnchor`, `placeReqCards`, `dropReq`, `req-card` / `req-uncard`, `add-card` in the entity and table panels,
  `[data-hreq]` on the project home, `placeSeedReq`, `RKIND`, `RSTAT`, `RICON`.

## 3. What to build

### The requirement card

1. **Content (D-41):** a filled header in the reserved violet with the kind's icon, the key and the kind's name; the
   requirement's name; a three-part coverage bar; the status pill and “{m} of {n} covered” (or “nothing traced yet”
   with no items). Tooltip: the first 300 characters of the description as plain text.
2. **The bar's parts**, over 4b-1's items (D-31):
   - covered: as D-31;
   - mapped but not approved: an attribute item with at least one mapping, none approved without a type conflict; an
     entity item with mappings on its attributes, none of them covering;
   - not mapped: an item with no mapping at all.
   Tooltip: “{a} covered, {b} mapped but not approved, {c} not mapped”.
3. **Size and grid:** 230 px wide, height from its content; moved on the 8 px grid like other cards.
4. **Below 40 %:** the header and a plain block, as other cards (AD-24 rule 1). The requirement marker rules (4b-1)
   apply unchanged to entity and table cards; a requirement card has no marker.
5. **Selecting the card is selecting the requirement:** the coverage colours (4b-1) and the requirement's panel. The
   card shows the selection mark in the overlay.
6. **Moving, multi-selection and undo** as for other cards. Requirement cards are never frame members: frames ignore
   them when arranging, and a requirement card dropped onto a frame stays outside it.
7. **Removing:** “Remove its card from this canvas” in the requirement's panel and the card's menu; Delete on a
   selected card removes the card only (never the requirement). Deleting the requirement removes its cards from every
   canvas; undo brings them back with it.

### Trace lines

8. From each requirement card on the canvas, a dashed line with an end dot to each element it is linked to **on this
   canvas**:
   - entity or table: the nearer side edge of its card, at header height;
   - attribute or column: the nearer side edge of its card, at the row's height;
   - mapping: the middle of the mapping's line.
   The line starts at the card's edge nearest to the end. No line to an element that is not on the canvas.
9. **Collapsed frames:** a target inside a collapsed frame ends at its member row in the frame's block; a target past
   the sixth member ends at the block's “and N more” row (as the 4b-1 dots). (Q3 confirms this is cheap.)
10. **Layer switch:** shown in “Everything”; hidden in “Mappings” and “Relationships”.
11. **Where they are drawn:** in the existing lines SVG layer (AD-24 rule 3), so they are rastered once and moved by the
    compositor while panning. They are redrawn when a card at either end moves or resizes, a link changes, or a frame
    collapses or expands.
12. **Dimming:** while another element (not a requirement) is selected or hovered, trace lines are dimmed, as in the
    prototype; under Focus they follow their card (item 21).

### Placing cards

13. **From the requirement's panel:** “Place its card on this canvas” (at the top centre of the view) or “Remove its
    card from this canvas”.
14. **From an element panel's Requirements section** (entity, attribute, table, column, mapping):
    - each row gets a “Place card” icon: places the card next to the element, or, when the card is already on the
      canvas, selects it and brings it into view;
    - dragging a row onto the canvas places the card where it is dropped (never a link);
    - under the list: “Add all to this canvas”, or “Add the {n} missing to this canvas” when some are already there;
      hidden when all are there.
    A click on the row's name still opens the requirement's panel (decision above).
15. **Next to the element:** to the right of its card, row or line middle, at its top; the first free place going down
    in 16 px steps, keeping 20 px from cards, notes and other requirement cards; several cards stack with 24 px
    between them. If a placed card falls outside the view, the view fits the element and the new cards. Toast:
    “Placed {n} requirement card(s) on this canvas.”
16. **“Add to this canvas” (from `docs/ideas.md`):** an entity or table panel whose card is not on the open canvas shows
    “Add to this canvas” where “Remove from this canvas” stands; it places the card in the view's centre, upper third,
    and selects it.

### Dragging a requirement from the left panel

17. A requirement row in the left panel's Requirements tab can be dragged onto the canvas:
    - onto an attribute or column row: links the requirement to it;
    - onto an entity or table card (not on a row): links it to the entity or table;
    - onto a mapping line: links it to the mapping;
    - onto empty canvas or a collapsed frame's block: places the requirement's card there.
18. **While dragging:** the target under the pointer is lit in the overlay (row, card or line), and a hint at the
    pointer says what a drop does: “Link to {name}”, “Already linked to {name}”, “Place card”. Lighting the target
    must not restyle cards (AD-24).
19. **After a drop:** a link shows the toast “Linked {key} to {name}.” with Undo; dropping where it is already linked
    changes nothing and toasts “{key} is already linked to {name}.”; placing shows “Placed {key} on this canvas. Dashed
    lines show what it traces to.” and selects the requirement.

### Focus with requirement cards

20. Focus's veil (F4) cuts a hole at each lit requirement card.
21. A requirement card is lit when its requirement is selected or is linked to anything in the lit set; its trace lines
    are lit when both ends are lit, otherwise faded with the veil.
22. **T3:** the lit lines of Focus and of the coverage colours are drawn in the overlay's existing layer, without a
    large SVG layer of their own. Checked by a LayerTree read (layer count and sizes) before and after; judged in the
    closing sitting (S4B1-11 rerun).

### Project home

23. Opening a requirement from the project home opens the project canvas that shows most of it: the count of the
    entities and tables of its scope on the canvas, plus one if its card is there. Ties go to the earlier canvas in the
    project's order. With no canvas scoring above zero, as today (the last opened canvas, else the first). The
    requirement is then selected, so its coverage colours show.

### Permissions

24. Placing, moving and removing requirement cards and linking by dropping need the rights to change the canvas and the
    links (AD-05). A reviewer and a reader see cards and trace lines, can select them and use Focus; dragging, “Place
    card”, “Add all”, “Add to this canvas” and removing are not offered to them.

### Seeds

25. The demo seed places REQ-104's card to the right of the Sales frame (prototype `placeSeedReq`).
26. `seed:large` places a set of requirement cards with trace lines in “Performance test” for the closing sitting; the
    number and placement are proposed in step 1 (Q8).

## 4. Steps (stop after each one)

1. **Questions** (section 7) answered in a new `docs/prd/slice-04b2-acceptance.md`; the docs plan; the sitting's plan.
   No code. Stop.
2. **The card** (items 1–7, 13, 25): the card, its placement from the requirement's panel, moving, removing, delete
   and undo. LayerTree read of the card against `slice-04b1` (AD-24 rule 4). Three full e2e runs. Stop.
3. **Trace lines** (items 8–12). Three full e2e runs. Stop.
4. **Placing from panels** (items 14–16). Three full e2e runs. Stop.
5. **Dragging from the left panel** (items 17–19). Three full e2e runs. Stop.
6. **Focus with cards and T3** (items 20–22): the LayerTree read before and after T3. Three full e2e runs. Stop.
7. **Project home** (item 23), permissions sweep (item 24), `seed:large` cards (item 26). Three full e2e runs. Stop.
8. **Closing:** docs (section 9), the closing sitting (section 6) after Łukasz prepares the laptop, results in the
   acceptance doc, Łukasz's manual acceptance. Merge only on his command; tag `slice-04b2`.

No measuring sitting before step 8. A step whose smoke run clearly misses a bar reports it and stops; a trial needs
Łukasz's OK and a time estimate.

## 5. Acceptance criteria

Tests in `e2e/slice-04b2/`, one file per criterion, each from a fresh seed. Data a test starts from is written through
the domain; what the criterion checks goes through the page and is read back from the data file.

| ID | Criterion |
| --- | --- |
| S4B2-01 | The card: header, kind, key, name, status, “{m} of {n} covered” and the bar's three parts match the domain for REQ-101, REQ-104 and REQ-105; below 40 % header and block; the tooltip. |
| S4B2-02 | Card lifecycle: placed from the requirement's panel, moved on the grid, removed from the panel and the card menu; Delete removes the card only; deleting the requirement removes its cards from every canvas and undo restores them; one card per requirement per canvas. |
| S4B2-03 | Trace lines: one per link to an element on the canvas, ending at the card edge, the row, or the mapping's middle; none to an element off the canvas; ending at the block row in a collapsed frame; following a moved card; hidden in “Mappings” and “Relationships”. |
| S4B2-04 | Placing from element panels: “Place card” next to the element, or selecting and showing a card already there; dragging a row places the card at the drop; “Add all” and “Add the {n} missing”; the view fits when a card falls outside it; a click on the name opens the requirement's panel. |
| S4B2-05 | “Add to this canvas” on an entity and a table panel without a card; hidden when the card is there. |
| S4B2-06 | Dragging from the left panel: a link on an attribute row, a column row, an entity card, a table card and a mapping line; “already linked” changes nothing; empty canvas and a collapsed block place the card; the hint text for each target; Undo after a link. |
| S4B2-07 | Focus: requirement cards lit or faded by item 21; their holes in the veil; trace lines lit only with both ends lit. |
| S4B2-08 | Project home opens the best canvas by item 23, ties by project order, fallback as before; the requirement is selected. |
| S4B2-09 | Roles: a reviewer and a reader see cards and lines and can select them and use Focus; none of the placing, linking or removing actions is offered; nothing is written. |
| S4B2-10 | Pan and zoom with requirement cards and trace lines in view (Focus off): presented fps against `slice-04b1` ≥ −5 % at the overview and the dense view, frames expanded and collapsed. |
| S4B2-11 | Pan and zoom with Focus on at 30 % (S4B1-11 rerun after T3): within 5 % of Focus off, presented frames. If it misses: recorded as partly met, to the performance review before the database slice. |
| S4B2-12 | To the screen ≤ 100 ms (median; p95 and max reported): the drop-target highlight while dragging; selecting a requirement card (colours on); Focus switching with requirement cards in the lit set. |
| S4B2-13 | Dragging a requirement card: presented fps of the drag within the baseline's spread for dragging an entity card (S4P-08's drags method). |
| S4B2-14 | No regression with no requirement cards on the canvas against `slice-04b1` (Focus off): presented fps at the overview and the dense view, frames expanded and collapsed (confirms S4B1-12's fps); C-10 and the lasso to the screen ≤ 100 ms; C-08 stable frame ≤ 1,500 ms, last present recorded. |
| S4B2-15 | Guards: element and drawing-layer counts with and without requirement cards against `slice-04b1`, every difference explained; drawing layers do not grow with the number of requirement cards (AD-24 rule 4); no canvas or miniature commit while dragging a requirement over targets before the drop. |
| S4B2-16 | CI (lint, typecheck, unit tests, schema check) and three full e2e runs in a row; changed earlier tests listed. |

**Done** when every row has a result. If S4B2-10, S4B2-12, S4B2-13 or S4B2-14 misses, step 8 stops with the figures and
Łukasz decides. S4B2-11 may end partly met (decision above).

**Definition of done (scenario for the manual acceptance).** As Łukasz, in “Customer 360”: see REQ-104's card next to
the Sales frame with its dashed lines; open `birth_date`'s panel and place REQ-105's card next to Customer with “Place
card”; drag REQ-103 from the left panel onto `email` and see the link, the new trace line and the toast with Undo; drag
REQ-101 onto empty canvas and see its card; switch to “Mappings” and see the trace lines go; turn Focus on with Customer
selected and see the requirement cards linked to it stay lit; open REQ-102 from the project home and land on the canvas
that shows most of it.

## 6. The closing sitting

Full laptop preparation by Łukasz. Measurement builds of this branch and `slice-04b1`, made before the restart and
reused with `--no-build`. One unrecorded warm-up, three rounds, sides rotated, a CPU check before every side, a disturbed
round dropped and replaced. Switching and interactions from a settled screen; pans as presented frames with one
untraced calibration pan per case and round. Covers S4B2-10 to S4B2-15 only. Step 1 gives the plan with a time estimate.

## 7. Questions for step 1

- **Q1.** Data: does the local adapter already accept canvas items with `requirement_id` (schema, CHECK, uniqueness,
  soft delete, undo, the data file's version)? What the delete cascade for a requirement's cards needs.
- **Q2.** The card: component, element count per card above and below 40 %, how it joins the nodes (React Flow node
  type), and what the LayerTree read will compare.
- **Q3.** Trace lines: how they join the lines layer, how their ends are computed (rows from data, AD-24 rule 2; the
  mapping's middle), what redraws them, and the cost of item 9 (collapsed frames).
- **Q4.** Dragging from the left panel: the existing drag and drop between the tree and the canvas, the drop-target
  test, the hint, and the overlay highlight without commits (S4B2-15).
- **Q5.** Placement next to an element: the free-place search and the fit, against the prototype's `placeReqCards`.
- **Q6.** Focus: the lit set with requirement cards, the veil's holes, the trace lines' fade.
- **Q7.** T3: the plan for drawing the lit lines in the overlay's layer, the LayerTree reads before and after, and the
  risk that Chrome gives them a layer anyway (as it did for every veil, by overlap).
- **Q8.** `seed:large`: how many requirement cards with how many trace lines, and where, so S4B2-10 measures a
  realistic worst case; the closing sitting's plan with a time estimate.
- **Q9.** Which earlier tests change (element counts, S4A-14, commit guards, the project home's opening canvas).

## 8. Differences from the prototype (deliberate)

- A click on a requirement in an element panel opens its panel; placing a card has its own icon (the prototype places
  the card on a click).
- Trace lines follow the layer switch (hidden in “Mappings” and “Relationships”).
- While dragging, the drop target is lit and a hint names the result.
- Trace lines into a collapsed frame end at the block's member row (the prototype draws none to a hidden card).
- The bar's middle part covers entity items too (4b-1's items).
- Reviewer and reader cannot place, link or remove (AD-05).
- Focus fades and lights requirement cards through F4's veil; selecting a requirement alone fades nothing (since 4b-1).

## 9. Docs in this PR

- `docs/decisions.md` (only with Łukasz's approval):
  - D-32: requirement cards with dashed trace lines, the layer switch, placing and dragging;
  - D-34: “Place card”, dragging a row, “Add all”, “Add to this canvas”;
  - D-41: the bar's three parts over items;
  - AD-24: T3's outcome (lit lines in the overlay's layer, or why not), trace lines in the lines layer, the sitting's
    figures, after the closing sitting.
- `docs/known-limitations.md`: “Requirement cards are not on the canvas yet” closed; S4B1-11 and S4B1-12 updated with
  the sitting's figures; “Where the canvas stands after slice 4b-2”.
- `docs/ideas.md`: “Add to this canvas” and “Project home: open the canvas that shows most of the requirement”
  resolved (link to this PRD).
- `docs/data-model-v2.md`: only if Q1 finds a gap.
- README and CLAUDE.md: slice status; requirement cards and trace lines in the canvas section; the seed.
