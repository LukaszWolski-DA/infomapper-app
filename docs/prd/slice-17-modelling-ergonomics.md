# Slice 17 – Modelling ergonomics

Status: **proposed** (Łukasz, 7 November 2026). **Light path**: no data model or local file format change, no shared
infrastructure (undo and change groups, the save chain, the canvas's layers, the table registry, the local adapter), one
decision (D-72). Two steps. Branch `slice/17-modelling-ergonomics`, from `main` at its newest tag (assumption A1). PRD
file: `docs/prd/slice-17-modelling-ergonomics.md`; step 1 writes `docs/prd/slice-17-acceptance.md`. Test regime:
CLAUDE.md, "Testing".

Written from the docs at slice 16's closing and Łukasz's testing of 7 November 2026, **without reading the code**, and
from the prototype changed for this slice, which Łukasz accepted on 7 November 2026: **the prototype is the source of
truth for behaviour; where this PRD and the prototype differ, ask.** If step 1 finds that an item breaks a light-path
criterion, it says so and proposes the full path for that item or drops it.

## 1. What to build

1. **The concept of a new entity, fact or dimension is chosen, not suggested** (changes D-46). Inside a concept frame
   nothing changes: the new entity takes the frame's concept. Everywhere else, creating opens a small concept picker
   with no preselected item ("Concept for the new entity", "… fact", "… dimension"), filtered by typing, anchored at the
   click point or at the button: the Entity tool's click, the toolbox's "New entity here", "New fact here" and "New
   dimension here", an entity created from the toolbox's search, the Cube tab's New fact and New dimension, and any other
   create without a concept that step 1 finds. Choosing a concept creates as today (the card placed, its panel open, its
   name selected, one undo step); Enter picks when one concept is left; the arrow keys move through the list; Escape or a
   click outside creates nothing. Unchanged: the Model tab's
   "+" per concept and "Create dimension from this…" (its entity's concept, B-2). The "last used concept" preference is
   no longer read (step 1: remove it or keep it, Q1).
2. **Requirements linked faster.**
   (a) **Several at once.** The element panels' "Link to a requirement…" becomes a button "Link to requirements…" that
   opens the same kind of picker with check items: requirements already linked are shown checked and disabled, "Link {n}"
   links the checked ones in one undo step, and "New requirement…" in its footer works as today's option. The card's and
   the row's menu items "Link to a requirement…" open it too.
   (b) **All attributes of an entity.** An entity panel's Requirements section (both levels) gets "Link all
   attributes…": the same picker; each live attribute of the entity is linked to each chosen requirement, existing links
   skipped, one undo step, a toast with the count ("Linked {n} attributes of {entity} to {keys}.").
   (c) **A link drag from a requirement card on the canvas.** A requirement card's header gets a link handle (a chain
   icon at its right end), for those who may edit the model. Dragging from it draws a dashed line in the requirement
   colour from the card's nearer side to the pointer and lights the target under the pointer; dropping on an attribute
   row, an entity card (both levels), a mapping line, a table card or a column row links the requirement to it (the same
   targets and command as a drop from the left panel, slice 4b-2), one undo step. Dropping elsewhere links nothing and
   says where to drop; Escape cancels. A drag anywhere else on the card still moves it; a double-click still opens its
   description. No multi-row selection on the canvas.
3. **A found attribute shows its row.** A click on an entity found through one of its attributes in the object
   browser's search (the row with the hint "attribute {name}") does what a click on an entity does today (centred when
   its card is on the canvas, otherwise placed on this canvas in a free spot) and then selects the attribute's row (a
   history place) with its panel and a short highlight. A collapsed card, or a row filter that hides the row, is opened
   to show it (view state, not undone). A hit on the entity's own name is unchanged. A hidden details panel is not opened
   (D-54).
4. **A frame resized from every edge and corner.** Besides today's bottom-right handle, a selected frame can be resized
   from its four edges and four corners; the cursor shows the direction. The left and top edges move the frame's
   position too. The minimum size, the snapping, the cards' membership on release and notes (never claimed, D-20) are as
   today. One undo step. Only for those who may edit the canvas; not on a collapsed frame.
5. **"Add attribute below" in an attribute row's menu**, logical and dimensional rows: a new attribute inserted directly
   below that row (its siblings renumbered as a move does), otherwise as the header's "Add attribute" (D-71). Not on
   table rows.

## 2. Sources

- **Prototype:** `docs/prototype/infomapper-prototype-with-sources.html`, replaced in this slice by the version Łukasz
  accepted (665,210 bytes, SHA-256 `1cd443af0eaf08c193520f150936bc6f1ff618a3d651c8f633b346a4d23b12ad`), copied in step 1
  with `cmp` and SHA-256. It shows all five items. Its new code: `openPick`, `renderPick`, `closePick`, `pickConcept`
  and `createEntity`'s concept (item 1); `openReqPick`, `linkReqs`, `linkAllAttrs`, `reqSection`'s buttons, `focusField`'s
  `data-pop`, the card's `.rq-lk`, `rqTarget` and the drag type `rqlink` (item 2); the tree's `data-hitattr` and its
  click (`showRow`, item 3); `renderFrames`' handles `.f-rs[data-dir]` and `.f-rz`, the drag type `fresize` with `dir`
  (item 4); `addAttr(entityId, belowId)` and the row menu (item 5).
- **Decisions:** D-20, D-28, D-31, D-34, D-35, D-38, D-46, D-54, D-64, D-70, D-71.
- **`docs/ideas.md`:** "Link all attributes" in an entity panel (slice 4b-1), "Add attribute" from an attribute row's
  menu (slice 16, section 9).

## 3. Steps

Stop after each step; wait for Łukasz. A new session starts only at a step's boundary, reading CLAUDE.md, this PRD and
the acceptance doc.

1. **Check and plan.** Answer Q1–Q6 in `slice-17-acceptance.md`; list the prototype's differences the slice touches;
   confirm the light-path criteria per item; propose every new UI text. Copy the prototype. No application code.
2. **Build, test, close.** Items 1 to 5; the slice's specs and the earlier specs each item touches, CI; the element guard
   (section 5); the docs and D-72's text quoted for approval; then **one full run** on the final commit (the run before
   the merge). Stop with the manual acceptance steps. Merge and tag `slice-17` only on Łukasz's command.

## 4. Acceptance criteria

Tests in `e2e/slice-17/`, one file per criterion, fresh seed each.

| ID | Criterion |
| --- | --- |
| S17-01 | **Concept chosen.** Outside a concept frame the Entity tool, the toolbox's three creates and the Cube tab's two open the picker with nothing selected; typing filters; choosing creates in that concept, one undo step; Escape creates nothing. Inside a concept frame no picker shows. |
| S17-02 | **Bulk links.** Two requirements checked in an attribute's picker give two links, one undo removes both; linked ones are checked and disabled. "Link all attributes…" on an entity with an attribute already linked adds the others only; one undo step. The same on a dimension. A reader sees neither. |
| S17-03 | **Found attribute.** The entity's card collapsed on the canvas: a click on the hit expands it, centres it and selects the row with its panel; Back returns. The entity not on the canvas: its card is placed and the row selected. A hit on the entity's name: unchanged. |
| S17-04 | **Frame resize.** The left edge moves the frame's x and narrows it; the top-left corner moves both; a card left outside leaves the frame on release; a note is not claimed; one undo step restores it. No handles for a reader or on a collapsed frame. |
| S17-05 | **Add attribute below.** On the second row, the new attribute is third, its name selected; one undo removes it and the order is as before. Not on a table row. |
| S17-06 | **Link drag.** From REQ-104's card handle onto Customer's `customer_id` row: linked, one undo step, the card has not moved; onto Customer's header: linked to the entity; onto a dimension's row on the Sales star: linked; onto empty canvas: nothing linked; Escape: nothing linked. A drag from the card's name still moves it. No handle for a reviewer or a reader. |
| S17-07 | CI, the element guard, the full run; every earlier test changed, with its reason. |

**Manual acceptance (demo and KB):** create an entity outside and inside a concept frame; link three requirements to a
fact's attribute at once and "Link all attributes…" on a dimension; drag a link from a requirement card onto an
attribute and onto an entity; find an attribute of a collapsed card; resize a frame from its left edge and top-left
corner, undo; add an attribute below a row.

## 5. Performance

Items 2(c) and 4 touch what the canvas draws.
- **Frame handles:** only on the selected frame, so with no frame selected `S3B-15-elements.spec.ts` equals the latest
  baseline on "Performance test" (it has no requirement cards), and with one selected the difference is that frame's
  handles only (Q4).
- **The link handle:** one element more per requirement card (the prototype's `.rq-lk`), or none if step 1 draws it as
  a CSS mask on an existing element (Q7). "Performance test – requirements" (12 cards) then gets a new baseline, with
  the difference stated.
- **The link drag's line** is drawn like the lasso: in the overlay (AD-24, slice 4p), through a value store, never by
  re-rendering `ModelCanvas`; one canvas commit at most, on the drop (Q7).
- No `measure:canvas` sitting. The picker is anchored at a known point and reads no layout during a commit (CLAUDE.md).

## 6. Questions for step 1

- **Q1.** Every create path without a concept and where each takes its concept today; `lastConcept()` and its setters;
  whether the Entity tool creates on click or on a drag; keyboard focus and Escape in the picker.
- **Q2.** The requirement picker's code and its command (`linkRequirement`): several links in one change group, the
  undo name, the requirement index's recompute; the toast.
- **Q3.** Today's behaviour of a search hit (entity and attribute), the history place of a row, `?row=` across canvases.
- **Q4.** How the app draws today's frame handle; the handles' elements and hit areas on the selected frame only;
  resize from the left or top with snapping and membership (`frames`' commands).
- **Q5.** Where an attribute row's menu is built; the insert below and the renumbering (the move's `saveRows`).
- **Q6.** Confirm no migration and no format change; the earlier specs each item touches.
- **Q7.** Item 2(c): how the app's requirement card is dragged today and where a drop from the left panel links (slice
  4b-2), so the link drag reuses the same targets and command; the line in the overlay through a store (as the lasso);
  the target's highlight without a card re-render; the handle as an element or a mask; its size below 50 % zoom (the
  prototype's handle scales with the card: about 9 px at 45 %; a constant screen size, as the frame's corner handle,
  is the alternative).

## 7. D-72 (proposal) and docs

"**Modelling ergonomics (slice 17).** A new entity, fact or dimension outside a concept frame takes the concept chosen
in a picker with nothing preselected; inside a concept frame it takes the frame's (changes D-46). Requirements are
linked several at once from an element panel's picker; an entity panel links all its attributes to chosen requirements
in one step; and a requirement card on the canvas links by a drag from its handle onto an attribute, entity, mapping,
table or column, as a drop from the left panel does. An entity found through one of its attributes in the object
browser's search shows that attribute's row, selected. A selected frame is resized from every edge and corner. An
attribute row's menu adds an attribute below it."

Docs: `decisions.md` (D-72, "(Changed by D-72.)" on D-46), `ideas.md` (the two entries done; section 8 as later),
`inventory-prototype-vs-app.md`, README and CLAUDE.md status.

## 8. Left for later

- "New concept…" inside the picker (creating a concept and an entity in one step).
- X1: a logical row dragged onto a source column.
- Multi-row selection on the canvas for bulk links.
- Opening another canvas of the project from a search hit (item 3 stays on the current canvas).
- Dragging a requirement marker from an entity card onto another row.

## 9. Assumptions

- **A1:** the branch starts from `main` after the fixes `fix/next-16.4` and the relationship ends, if merged first;
  otherwise from tag `slice-16`.
- **A2:** the app's element panels have "Link to a requirement…" with a single-choice picker (D-70, slice 15 D1).
- **A3:** every entity has a concept (`entity.concept_id` NOT NULL); no "no concept" state is introduced.
