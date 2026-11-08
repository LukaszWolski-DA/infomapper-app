# Slice 17 – acceptance

PRD: [`slice-17-modelling-ergonomics.md`](slice-17-modelling-ergonomics.md). Branch `slice/17-modelling-ergonomics`.

## Step 1: the PRD checked against the code (8 November 2026)

### The starting point

- **A1 holds.** `origin/main` is at `2615fa3`, the merge of PR 43 (the relationship ends), which follows `33ac884`, the
  merge of PR 42 (Next 16.4). The branch was cut from `2615fa3` and has no upstream. The local `main` was behind
  (`33ac884`) and was not moved. The tag `slice-16` is `88c83e1`, an ancestor.
- **No run in this step.** No dev or e2e server ran and no script ran, so KB was not backed up. The newest backup is
  `.data/backups/dev-db-20261107-2250.json`. Step 2 backs up first.
- **The two files from Łukasz's Downloads**, committed with this document:

  | File | SHA-256 | `cmp` |
  | --- | --- | --- |
  | `docs/prd/slice-17-modelling-ergonomics.md` (new) | `61d8269374bfc415eadcc1dbe1a6070cb0c5598c1cd204688cccd650cdde2b6d` | equal |
  | `docs/prototype/infomapper-prototype-with-sources.html` (665,210 bytes, replaces slice 16's `4c0bf2d5…`) | `1cd443af0eaf08c193520f150936bc6f1ff618a3d651c8f633b346a4d23b12ad` | equal |

- **The prototype's slice-17 code** (the diff against slice 16's version: 177 lines added, 18 removed):
  - CSS `#pickpop` (l. 203–218);
  - the frame handles `.f-rs[data-dir]` and `.f-rz` (l. 415–423);
  - the link handle `.rq-lk`, `#rqtmp` and `.rq-tgt` (l. 691–699);
  - `addAttr(entityId, belowId)` (l. 1723);
  - the tree's `data-hitattr` (l. 2251, 2282) and its click's `showRow` (l. 3046–3061);
  - `fresize` with `dir` (l. 2754, 2876–2881);
  - `rqlink` (l. 2850–2855, 2937–2943, 4948–4949);
  - "Add attribute below" in `ctxFor` (l. 4152);
  - `reqSection`'s buttons (l. 4728);
  - `openReqPick`, `linkReqs`, `linkAllAttrs` and `rqTarget` (l. 4770–4803);
  - the card's `.rq-lk` (l. 4859);
  - `openPick`, `renderPick`, `closePick` and `pickConcept` (l. 5685–5711);
  - `createEntity`'s concept (l. 5752–5757) and the Cube tab's anchor (l. 5784).

### Summary

The PRD's shape holds, and every item can stay on the light path: no migration, no format change, no shared
infrastructure (Q6). It is wrong or incomplete in eleven places:

1. **There are no "Link to a requirement…" menu items in the app** (A2 is half wrong). The panel's control is a native
   `<select>`, and no canvas menu has the item. The prototype has it in three menus (F4).
2. **A requirement card has no double-click.** "A double-click still opens its description" describes the prototype,
   not the app (F9).
3. **A requirement card is a React Flow node dragged as a whole.** The handle must opt out of that drag (F8).
4. **Collapse and the row filter are undo steps in the app.** Item 3's "view state, not undone" would need an exception
   in undo, which is shared infrastructure. One undo step is proposed instead (F12).
5. **The tree does not know which attribute a hit matched**, only its hint text (F11).
6. **The frame resize command has no position**, and a resize that moves the frame would get the undo name "Move card"
   (F14, F15).
7. **Notes pinned to a frame follow its top-left corner.** A resize from the left or top would move them. D-20 says a
   resize never moves notes; the prototype moves them (F16).
8. **`addAttribute` has no position**, and an insert with renumbered siblings would not be named "Create attribute"
   (F18).
9. **Several links in one group get no good undo name.** `changeLabel` names exactly one link (F6).
10. **The Cube tab's creates read no frame today**, while the prototype's pick a free spot and then take a concept
    frame's concept if that spot is inside one (F2).
11. **Section 3 asks for Q1–Q6, section 6 has Q7.** All seven are answered below.

### Findings

| # | Finding | Files and functions | Proposal |
| --- | --- | --- | --- |
| F1 | **Every create without a concept goes through two functions.** `createEntityAt` (`canvas-host.tsx` l. 179–214) serves the Entity tool, the toolbox's "New entity here", its "New fact here" and "New dimension here" (`modules.creates`, l. 469), and the toolbox search's `Create entity “{name}”` (l. 448–456). It takes the concept from the concept frame under `at + (24, 20)`, else `lastConcept()`, else the first concept. `createFromTab` (`left-panel.tsx` l. 533–553) serves the Cube tab's New fact and New dimension and takes `lastConcept()`, else the first concept. The Model tab's "+" and "New entity in {concept}" (`addEntity`, l. 171–186) and "Create dimension from this…" (`createDimensionFrom`, the original's concept) already name their concept. Nothing else creates an entity: the header drop, paste, import and Add attribute create attributes or tables only. | `canvas-host.tsx` `createEntityAt`; `left-panel.tsx` `createFromTab`, `addEntity`; `infocube/domain/mappings.ts` `createDimensionFrom` | The picker goes into these two functions only, before the action is called: when no concept frame is under the point, `createEntityAt` opens it at the click's screen point (the toolbox search: the toolbox's point), and `createFromTab` opens it under its button. The action and the domain command do not change: `createEntityInput.conceptId` is already required. |
| F2 | **The Cube tab's spot and a concept frame.** The prototype's `createEntity` without a point first finds a free spot, then takes `conceptAt` of that spot (l. 5752). A free spot inside a concept frame therefore creates in the frame's concept, with no picker. The app's `createFromTab` places with `ui.freeSpot()` and checks no frame. S17-01 says the Cube tab's two creates open the picker. | `left-panel.tsx` l. 533–553 | **The Cube tab always opens the picker**, as S17-01 says. A spot that happens to lie in a frame is not one the person chose. Question Z1. |
| F3 | **"Last used concept" is one browser preference.** It is `localStorage["infomapper:last-concept"]` (`panels-context.tsx` l. 12, 56–57). It is read in `createEntityAt` (l. 183) and `createFromTab` (`left-panel.tsx` l. 537), and written after every create (`canvas-host.tsx` l. 200, `left-panel.tsx` l. 178, 545) and by "New concept" (l. 204). | as listed | **Remove it** (Q1): the two readers, the four writers, `lastConcept` and `setLastConcept` in the context, and the key. A key left in a browser is never read again. The first-concept fallback goes too: with no concept the picker says so (F5). |
| F4 | **No "Link to a requirement…" in any canvas menu.** The string exists only in `requirements-section.tsx` (l. 129–147): a native `<select>` in a `Field` labelled "Link to a requirement", with "+ New requirement…" as its last option. The prototype has the menu item on an entity or table card's header (l. 4181), an attribute or column row (l. 4153) and a mapping line (l. 4108), each focusing the panel's control (`focusField`, which clicks a `data-pop` button since slice 17). PRD 2(a) assumes they exist. | `canvas-host.tsx` `cardItems` l. 350–411, `items` l. 662–715 and the mapping line's l. 503; `focusDetails` l. 120 | **Add them, as the prototype has them**: "Link to requirements…" (the button's new text, F5) on the header menu after "Add attribute", on a row's menu after "Add attribute below" (F19), and on a mapping line's menu, for those who may edit. Each calls `openDetails()` and opens the panel's picker at its button, as `focusDetails` focuses a field today. The prototype keeps the old label "Link to a requirement…" in its menus; the proposal uses one text for the menu item and the button. Question Z2. |
| F5 | **No picker component exists.** The nearest are the canvas toolbox (`toolbox.tsx`: a portal, fixed, clamped in `useLayoutEffect`, arrows, Enter, Escape, a pointerdown outside) and `MapChoice` (`map-column.tsx` l. 147–219: a listbox at a point, no filter). `src/ui/components` has `button`, `dialog`, `dropdown-menu` (Radix) and `toast`. | as listed | **One component `PickPopover` in `src/ui/`**, used by the concept picker and the requirement picker. It is a portal to the body, `position: fixed`, at a screen point. It has a filter field with the focus, a list (`role="listbox"`; with `multi`, `role="menuitemcheckbox"` items), an optional note, a footer with an extra button and a confirm button, and an empty text. ↓ and ↑ move through enabled items, ↑ from the first item goes back to the field, Enter in the field picks the only item left (single) or confirms (multi, with something checked), and Escape or a pointerdown outside closes it with nothing done. Keystrokes stop at the picker (the canvas's E, Delete and arrows never see them). **It reads no layout in a commit:** it is drawn hidden at the point, a `ResizeObserver` on itself reports its size, and only then is it clamped to the window (8 px) and shown. The toolbox's `useLayoutEffect` read is not copied. |
| F6 | **One link per command, and one link per undo name.** `linkRequirement` (`requirement.ts` l. 282) takes one requirement and one target, `requirement.edit` (EDITORS), and refuses an existing link with "Already linked.". `changeLabel` says "Link requirement" only when the group is exactly one `requirement_link` (`change-label.ts` l. 183–185). Several would read "Create requirement link". | `requirement.ts`, `change-label.ts` | **A new command `linkRequirements`** `{ requirementIds: uuid[] (1–50), targets: LabelTarget[] (1–500) }`: every pair without a live link is inserted, existing ones are skipped, one change group. The same checks apply per requirement and per target. Nothing new gives "Already linked." (one target) or "Every attribute is linked already." (Link all). The label comes from the write set (`writeSet.label`, slice 12a): "Link requirement" for one link and "Link requirements" for more. The old command and `linkRequirementAction` stay for the left panel's drop. The index is rebuilt from the fresh page, as after any link (`inspector.tsx` l. 138, `buildRequirementIndex` with the feeds). |
| F7 | **The section is for editors only today.** The select, × and the place icons are rendered for `p.editable` (`standing === "full"`: owner, admin, modeler in a workspace that is not archived). The prototype shows "Link to requirements…" to everyone and guards "Link all attributes…" with `wsPerm() === "full"`. | `requirements-section.tsx` | Both buttons for editors only, as the select today. A reviewer and a reader see the list (S17-02's "A reader sees neither"). |
| F8 | **A requirement card is dragged by React Flow.** `toReqNode` (`ModelCanvas.tsx` l. 265) sets `draggable: editable` with no `dragHandle`, so the whole card moves it (`onNodeDragStop` l. 2284–2293 saves the layout). Its header is `.ric` (a CSS-mask icon), `.k` and `.kind` (`RequirementCardNode.tsx`). Below 40 % the card is a plain block. | `RequirementCardNode.tsx`, `ModelCanvas.tsx` | **The handle is one element**, `<span class="rq-lk nodrag">`, with the chain icon as a CSS mask like `.ric`, at the header's right end, drawn only at full detail (≥ 40 %), for editors. The prototype's handle is a span with an SVG and a path (three elements). `nodrag` and a capture `pointerdown` keep React Flow's drag out. It scales with the card, as the prototype's (about 9 px at 45 %). Question Z6. |
| F9 | **No double-click on a requirement card.** The app has no handler. The double-click and "Edit description…" are in `ideas.md` ("Requirement cards: what the prototype has besides", slice 4b-2). | `RequirementCardNode.tsx` | Drop the PRD's "a double-click still opens its description". S17-06 checks that a drag from the card's name still moves it. |
| F10 | **The left panel's drop already has the targets, the mark and the command.** `dropTargetAt` (`requirement-drop.ts` l. 68) reads the element under the pointer: a row (≥ 40 %) → attribute or column; `[data-mapping]` → mapping; a card → entity or table; anything else (empty canvas, blocks, notes, requirement cards) → a place. `DropTargetMark` (`RequirementDrop.tsx` l. 23, in `OverlayLayer`) draws the target from `dropStore` (dashed when already linked), and `DropHint` writes "Link to {name}" or "Already linked to {name}". `dropRequirement` (`ModelCanvas.tsx` l. 2140–2175) links with `linkRequirementAction` and toasts "Linked {key} to {name}." with Undo. | `requirement-drop.ts`, `RequirementDrop.tsx`, `ModelCanvas.tsx` | **The link drag reuses all three.** A `pointerdown` on the handle starts it. Window `pointermove` sets a value store `{ requirement, from, to }` and `dropStore` from `dropTargetAt`. A `pointerup` on a target links through the same `linkRequirementAction`, on a place toasts F-texts and links nothing, and Escape cancels. The dashed line (requirement colour, from the card's nearer side at the header's middle, prototype l. 2852) is drawn in `OverlayLayer` from its store, as the lasso. **No `ModelCanvas` commit while dragging**, and at most one on the drop (the fresh page's trace lines). There is no auto-pan, as with the left panel's drop. The hint is the app's own (P6). |
| F11 | **The tree does not keep which attribute matched.** `show()` (`tree-data.ts` l. 296–310) returns `{ item, hint }`, and `TreeEntity.fields` holds names only (l. 20–25). A tree item's click (`left-panel.tsx` l. 289–299; the Cube tab through `moduleTree` l. 601–611) calls `open({ entityId }, cardId, …)` whatever matched. | `tree-data.ts`, `left-panel.tsx` `open` l. 163–169 | **`buildTree` keeps the attribute ids beside the names** (`fieldIds`, the same order), and `show` returns `hitAttributeId` for an attribute's name or alias hit. The click passes it to `open`. Step 2 measures the project home's and the canvas's payload on "Performance test" with and without the ids, since one id per attribute rides along. The alternative, finding the row by name in the card's rows at click time, needs no payload but could pick another row with the same text. |
| F12 | **Collapse and the row filter are undo steps.** They are `canvas_item.collapsed` and `row_filter`, written by `updateCanvasItem` (`canvas-item.ts` l. 285–322) through `ModelCanvas.change` (l. 816–837), named "Collapse card", "Expand card" and "Filter card rows" (`change-label.ts` l. 122–123). The prototype's `showRow` writes `L.c` and `L.f` with `save()`, outside undo. "Not undone" in the app would need a write that undo skips, which is a change to undo (shared infrastructure: the full path). | as listed | **One undo step**, through `updateCanvasItem` with both fields, named "Show row" in the write set (`changeLabel` has no name for both fields together). The row is then selected (a history place) and flashed with the existing `flashRow` (700 ms, `CanvasProvider.tsx` l. 46–51). Question Z3. |
| F13 | **The rest of item 3 is there.** `open` selects the card and centres it (`centerOn`, a card in a collapsed frame on its block), or places it with `ui.place` (a free spot in view; on a live canvas the "Label {name} with {L}?" question for an editor, nothing for others). `showPlace` takes a filtered row, so a row is a history place (`SelectionHistory.tsx` l. 39; gone: "That row is no longer on this canvas."). Tree clicks never call `openDetails()` (D-54). | `left-panel.tsx` `open`; `ModelCanvas.tsx` `place`, `placeAt` l. 1089–1173, `showPlace` l. 1904–1965 | After `open` selects or places the card, a hit selects `{ t: "row", cardId, id }` instead of the card. A new card is expanded and shows all rows, so it needs no write. **A card in a collapsed frame** stays in its block: the row is selected and its panel shows, as `showPlace` does today. **The filter is reset only when it hides the row** (PRD), while the prototype resets any filter but All (P4). Question Z3. |
| F14 | **The resize command has no position.** `resizeFrame` (`frame.ts` l. 567–572) takes `width` and `height` and keeps `x` and `y`. `reframe` (l. 536–564) already takes a whole rectangle and runs `membershipAfterResize` (`frames.ts` l. 164), which works for any rectangle (a card's header middle decides; other frames' cards are never taken). The minimum is `FRAME_MIN_SIZE` 160 × 96 (`frames.ts` l. 26); the prototype's is 240 × 160. | `frame.ts`, `frames.ts`, `useFrames.ts` l. 435–612, `layout-plan.ts` `planReframe` l. 88 | `resizeInput` gets optional `x` and `y` (both or neither). `useFrames`' press gets a direction (`n`, `s`, `e`, `w`, `ne`, `nw`, `se`, `sw`). West and north move the edge on the 8 px grid, capped so the frame keeps the app's minimum (160 × 96, "as today"). `planReframe` takes the rectangle. Live drawing is as today's handle: `setFrames` per 8 px step. |
| F15 | **A resize that moves the frame is named "Move card".** `changeLabel` gives "Resize frame" only when the frame's event changes `width` and `height` alone (l. 146); with `x` or `y` it falls to "Move cards" or "Move card" (l. 147–149). | `change-label.ts` | `resizeFrame` sets `label: "Resize frame"` in its write set. |
| F16 | **Notes pinned to a frame follow its top-left corner.** A pinned note stores an offset from its frame's `x` and `y` (`notePosition`, `notes.ts` l. 60–63). So does the prototype (`notePos`, l. 4279), whose left-edge resize moves them. D-20 says "drawing, resizing or fitting a frame never moves or claims notes". Free notes are not touched by `reframe`, and that does not change. | `notes.ts`, `frame.ts` `reframe` | **Keep pinned notes where they are**: the resize rewrites their offsets by the frame's move in the same change group (a note update of `x` and `y`, as a frame's move writes its free notes today). D-20 then holds as written. The alternative, as the prototype does, lets them move with the frame's top-left corner and adds a note to D-20. Question Z4. |
| F17 | **Today's handle is on every frame, for editors.** `.f-rs` (`FrameLayer.tsx` l. 167) is drawn on each expanded frame when `editable`, selected or not. It is 14 × 14 px at `scale(var(--iz))`, a constant size on the screen (`canvas.css` l. 352–354). A collapsed frame is a block, not in `FrameLayer`, and the server refuses its resize ("Expand the frame first."). | `FrameLayer.tsx`, `canvas.css` | As the prototype: the bottom-right handle stays on every frame. The three other corners (`.f-rs[data-dir]`, the same constant size) and four edges (`.f-rz`, 10 px on the screen, 18 px short of the corners) are drawn **on the selected frame only**, for editors: seven elements more while one frame is selected, none otherwise. |
| F18 | **`addAttribute` has no position.** Its input is `{ entityId, name? }` (`attribute.ts` l. 88–126); the attribute goes last. `reorderAttribute` (l. 428–456) renumbers an entity's attributes 0…n−1 and writes only the changed rows; the client sends it with `saveRows`, the siblings held (`move-attribute.ts`). An insert plus sibling updates would be named by `changeLabel`'s first attribute event, which could be an update ("Change attribute"). | `attribute.ts`, `move-attribute.ts`, `change-label.ts` | `addAttribute` takes an optional `below: uuid` (a live attribute of the same entity). It inserts there and renumbers the rest as `reorderAttribute` does, in one change group, with `label: "Create attribute"` in its write set. The client sends it with `saveRows` over the entity's attributes, all held, so their next saves carry the new versions. Without `below`, nothing changes. |
| F19 | **The row menu.** `items(t)` (`canvas-host.tsx` l. 662–709) builds an entity row's menu for both levels: Move up, Move down, Move to the top, Move to the bottom; a separator; "Map from a column…" (logical only); Copy; a separator; "Delete attribute"; and Focus. Editors only, except Focus. A column row has "Map to an attribute…" and Focus. | `canvas-host.tsx` | **"Add attribute below"** after the moves' separator, before "Map from a column…", editors only, entity rows only. It reuses slice 16's `addAttributeTo` with `below`: the new row is selected, `openDetails()` and the name focused. A row filter that hides the new row stays, as slice 16's F3. Then "Link to requirements…" (F4). |
| F20 | **The concept picker and a live canvas.** `createEntityAt` labels the new entity on a live canvas (the toast ends ", labeled {label}"). | `canvas-host.tsx` | Unchanged after the pick. The picker comes first, and Escape creates and labels nothing. |
| F21 | **The create's toast already names the concept.** `Created {name} in {concept}. Type its name now; change the concept in the panel.` The prototype keeps it. | `canvas-host.tsx` l. 199–211 | Unchanged. |

### Q1. Item 1: the concept picker

- **The create paths and their concepts today:** F1, F2.
- **`lastConcept()`:** F3. Proposed: remove it.
- **The Entity tool creates on a press, not a drag.** `onPointerDownCapture` (`CanvasModes.tsx` l. 185–187) creates at
  the pointer − (24, 20) on the left button's press and turns the tool off. E only switches the tool. The picker opens at
  that press's screen point. The tool is already off, so the next click on the canvas is an ordinary one, which also
  closes the picker as a click outside.
- **Focus and keys:** F5. The filter field takes the focus. Once a concept is picked, the create runs as today
  (`ui.select`, `openDetails()`, `setNameFocus`), so the name field gets the focus.
- **Inside a concept frame**, nothing changes (the frame under `at + (24, 20)`).
- **The Model tab's "+" and "Create dimension from this…"** are unchanged (B-2).
- **No concept in the workspace:** "No concepts yet. Create one in the Model tab (New concept)." (prototype), in place
  of today's toast "Create a concept first (left panel, New concept)." The picker opens and says so.

### Q2. Item 2 (a) and (b): the requirement picker and its command

- **Today:** F4, F6, F7.
- **The picker:** F5 with `multi`.
  - Items are `{key} {name}`, in the requirements' order. Directly linked ones are checked, disabled, and titled
    "Already linked". Indirect ones are not checked (D-34).
  - The confirm reads "Link" with nothing checked (disabled) and "Link {n}" after.
  - "New requirement…" is in the footer (a), with today's behaviour: create linked, open its panel, its name focused.
- **The command:** F6. One change group; a refusal (a deleted requirement or target) refuses the whole set.
- **The toasts** (with Undo):
  - one link: today's `Linked {key} to the {noun}.`;
  - several: `Linked {n} requirements to the {noun}.`;
  - Link all: `Linked {n} attributes of {entity} to {keys}.` (`Linked 1 attribute of …` for one).
- **Link all attributes (b):** the targets are the entity's live attributes. On a fact or dimension they are its
  dimensional attributes; the panel is the same `EntityPanel`. Its picker checks nothing (no target is "linked" as a
  whole), and an attribute already linked to a chosen requirement is skipped. Its title is "Link all {n} attributes of
  {entity} to…", with the note "Attributes already linked to a chosen requirement are skipped." The button shows only
  for editors on an entity with at least one attribute.
- **D-31:** each link makes the attribute an item. An entity with every attribute linked is in scope through them, and
  "via attribute" in its panel (D-34). No rule changes.

### Q3. Item 3: a found attribute

- **Today:** F11, F13. `?row=` (`page.tsx` l. 374–384) gives a row only when the card is on this canvas, and otherwise
  the attribute's panel. It works on one canvas, which matches item 3 ("stays on the current canvas", section 8).
- **The history place:** `{ t: "row" }` is a place already; Back returns to the previous selection.
- **The details panel:** a hidden one stays hidden (D-54). The row's panel shows when it is visible. On a narrow screen
  `open` already closes the left overlay.
- **The Sources tab** finds tables by their columns ("column {name}"). Item 3 covers attributes (the Model and Cube
  tabs) as the prototype does. Columns are left out and go into `ideas.md`.

### Q4. Item 4: the frame handles

F14 to F17. The handles are elements inside the frame's own `div` in `FrameLayer`, not a new layer. Their pointer
handling joins `onFramePointerDown`'s `"handle"` part with a direction. The cursors: `nwse-resize` (nw, se),
`nesw-resize` (ne, sw), `ns-resize` (n, s), `ew-resize` (w, e). Snapping, the minimum, membership on release, one undo
step "Resize frame", the editors' right (`canvas.edit_items`) and no handle on a collapsed frame are all as today.

### Q5. Item 5: the row's menu and the insert

F18, F19. The renumbering is `reorderAttribute`'s, and the client holds the siblings with `saveRows` as the move does.
No new chain rule.

### Q6. Data and the earlier specs

- **No migration.** No new column or table.
- **No local file format change:** `DEV_DB_FORMAT` stays 13. The commands' new optional inputs are additive, and
  `.strict()` stays.
- **No shared infrastructure** with F12's undo step (not an exception) and F16's note offsets (an existing kind of
  write). Undo, change groups, the save chain, the canvas's layers, the table registry and the local adapter do not
  change. `writeSet.label` is used, not changed.
- **The earlier specs each item touches:**

| Item | Earlier specs | Expected change |
| --- | --- | --- |
| 1 | S1B-07, S1B-14, S2B-12, S3B-02, S3B-10, S5A-04, S6A-01, S6B-02-focus, S9-04, S9-12 (`zoom.ts`), S10A-04, S10B-06, S15-01, S15-04, S15-06, S15-07 (15a and 15b) | Each create outside a concept frame picks a concept (a helper `pickConcept(page, name)`); a create inside a frame is unchanged. S1B-07 and S3B-10 also check the toast, which stays. Step 2 lists every spec actually changed. |
| 2 (a, b) | S4A-06, S4A-11, S4A-13, S4B1-04, S15-15 (they use `select-link-requirement`), S4A-07, S4B1-02 | The select becomes the button and the picker (a helper `linkRequirements(page, keys)`). Undo names "Link requirement" stay for one link. |
| 2 (c) | S4B2-* (cards, drag, the drop from the left panel), S4B2-15-layers, the element counts on "Performance test – requirements" | One element per card at full detail: a new baseline, with the difference stated. Nothing else. |
| 3 | S1A (tree helpers), S11-01, S11-08 (alias hints), S15-06, S15-07, S15-08b, S6B-10 (history), S7A-10 | Hits on a name are unchanged. Tree items gain no test id. |
| 4 | S2B-05, S2B-13, S2C-03, S14A-02 (`frame-resize`), S3A-* (notes in frames), the frame unit tests | The bottom-right handle is unchanged. New unit tests for the rectangle, the label and pinned notes. |
| 5 | S1B-07, S2A-05, S5A-04 (row menus), S16-01, S16-02, S10C-* (the attribute's versions after a paste) | The menu gains one item. Specs that read items one by one are unchanged; a spec comparing the whole list gets the item. |

  The element guard (`S3B-15-elements.spec.ts`) on "Performance test" stays equal with no frame selected, the latest
  baseline being slice-08's per CLAUDE.md.

### Q7. Item 2 (c): the link drag

- **Today's card drag, the left panel's drop and its command:** F8, F10.
- **The line:** F10. It is in the overlay through a store, as the lasso (`useLasso`, `OverlayLayer`). It is not drawn
  the way `ColumnDrag`'s `DraftLines` are, in the line layer's `EdgeLabelRenderer`.
- **The target's mark:** `dropStore` and `DropTargetMark`, so no card re-renders. The prototype's `.rq-tgt` class on
  the element is not used.
- **The handle:** F8.
- **Rights:** editors (`requirement.edit` and the canvas's `editable` are the same three roles). No handle for a
  reviewer or a reader.
- **Below 40 %** the card is a block with no handle, and rows are not drawn. A drag started at 40 % or more that is
  zoomed below it (wheel during the drag) links to cards only, as the left panel's drop.
- **Measures:** step 2 counts canvas commits during a link drag (`__imCanvasCommits`): zero while moving, one at most
  after the drop. It also takes the elements of "Performance test – requirements" against slice-16's.

### The light-path criteria, per item

| Item | Data model or format | Shared infrastructure | Decisions | Verdict |
| --- | --- | --- | --- | --- |
| 1 | none (a browser key removed) | none | D-46 changed (D-72) | light |
| 2 (a, b) | none; a new command | none (`writeSet.label`) | D-72 | light |
| 2 (c) | none | the overlay's existing layer and stores; one element per card | D-72 | light |
| 3 | none | none, **if** the expand is an undo step (F12); "not undone" would need undo, the full path | D-72 | light with F12 |
| 4 | none; optional `x`, `y` in a command | none; pinned notes' offsets written as a frame's move writes notes (F16) | D-72; D-20 kept, or a note (Z4) | light |
| 5 | none; optional `below` | none (`saveRows` as the move) | D-72 | light |

### New user-facing texts (for approval)

| Where | Text | Source |
| --- | --- | --- |
| the concept picker's title | **Concept for the new entity** / **… fact** / **… dimension** | prototype `pickConcept` |
| its field | **Type to filter concepts…** | prototype |
| no concepts | **No concepts yet. Create one in the Model tab (New concept).** | prototype (replaces the toast "Create a concept first (left panel, New concept).") |
| nothing matches (both pickers) | **Nothing matches “{text}”.** | prototype `renderPick` |
| the panel's button | **Link to requirements…** (replaces the select "Link to a requirement…" and its field label) | prototype `reqSection` |
| the requirement picker's title | **Link to requirements** | prototype `openReqPick` |
| its field | **Type to filter requirements…** | prototype |
| a linked item's title | **Already linked** | prototype |
| the confirm | **Link** / **Link {n}** | prototype |
| its footer | **New requirement…** | prototype (was "+ New requirement…") |
| no requirements | **No requirements yet.** | prototype |
| toast, several | **Linked {n} requirements to the {entity, attribute, mapping, table, column}.** | prototype `linkReqs` ("the" as today's one-link toast) |
| the entity panel's button | **Link all attributes…**, title **Link chosen requirements to each attribute of this entity** | prototype |
| its picker's title | **Link all {n} attributes of {entity} to…** | prototype |
| its note | **Attributes already linked to a chosen requirement are skipped.** | prototype |
| its confirm | **Link** / **Link to {n}** | prototype |
| its toast | **Linked {n} attributes of {entity} to {keys}.** (one: **Linked 1 attribute of …**) | prototype `linkAllAttrs` |
| nothing new | **Every attribute is linked already.** | prototype |
| undo of several links | **Link requirements** | proposal (one link keeps "Link requirement") |
| the card's handle title | **Drag onto an attribute, entity, mapping, table or column to link {key}** | prototype |
| a drop elsewhere | **Drop {key} on an attribute, entity, mapping, table or column to link it.** | prototype |
| a drop on a linked target | **{key} is already linked to {name}.** (existing) | app (the prototype says "Already linked.") |
| the menus (F4) | **Link to requirements…** | proposal (the prototype's menus say "Link to a requirement…") |
| the row's menu | **Add attribute below** | prototype |
| the frame handles' title | **Drag to resize** (existing) | prototype |
| undo of a found row's expand | **Show row** | proposal (F12) |

Unchanged: "Link requirement", "Resize frame", "Create attribute", "Linked {key} to {name}.", the create toast (F21).

### D-72 (draft)

> **D-72** Modelling ergonomics (slice 17). A new entity, fact or dimension created outside a concept frame (the Entity
> tool, the toolbox's creates and its search, the Cube tab's New fact and New dimension) takes the concept chosen in a
> picker that opens at the click or under the button, with nothing preselected, filtered by typing; Escape or a click
> outside creates nothing. Inside a concept frame it takes the frame's. No concept is remembered (changes D-46). An
> element panel's Requirements section links several requirements at once from a picker ("Link to requirements…"),
> in one undo step; requirements already linked show checked. An entity panel links all its attributes to chosen
> requirements in one undo step ("Link all attributes…"), skipping existing links. The same picker opens from a card's,
> a row's and a mapping line's menu. A requirement card on the canvas has a link handle for editors: a drag from it
> onto an attribute, entity, mapping, table or column links the requirement as a drop from the left panel does; a drop
> elsewhere links nothing. An entity found through one of its attributes in the object browser's search shows that
> attribute's row, selected and flashed; a collapsed card or a row filter that hides it is opened, one undo step. A
> selected frame is resized from its four edges and four corners as well; the left and top edges move it, and notes
> pinned to it keep their place. An attribute row's menu adds an attribute directly below it.

Notes: D-46, "(Changed by D-72.)" with "the concept comes from the concept frame clicked into, else a picker". D-20
needs none if Z4 is answered "keep their place".

### Differences between the prototype and the app that the slice touches

| # | Prototype | App (proposed) | Why |
| --- | --- | --- | --- |
| P1 | the Cube tab's create takes a concept frame's concept when its free spot lies in one | always the picker | S17-01 (F2, Z1) |
| P2 | the menus say "Link to a requirement…" | "Link to requirements…", and the items are new in the app | F4 (Z2) |
| P3 | the expand and filter reset of a found row are outside undo | one undo step "Show row" | F12 (Z3) |
| P4 | any row filter but All is reset | only a filter that hides the row | PRD (Z3) |
| P5 | a left or top resize moves notes pinned to the frame | they keep their place | D-20 (F16, Z4) |
| P6 | the link drag lights the target with a class and shows no hint | the left panel's drop mark and hint ("Link to {name}") | one way to show a link target (F10) |
| P7 | the handle is three elements and drawn at every zoom | one element, at full detail only | element counts (F8, Z6) |
| P8 | "Already linked." on a linked target | "{key} is already linked to {name}." | the app's existing drop text |
| P9 | the frame's minimum is 240 × 160 | 160 × 96 | "as today" (PRD) |
| P10 | the panel's buttons for everyone ("Link to requirements…") | editors only | F7 |
| P11 | a requirement card's double-click opens its description | none (an idea since slice 4b-2) | F9 |
| P12 | the picker is clamped by reading its size when opened | a `ResizeObserver` | CLAUDE.md: no layout read in a commit (F5) |

### Questions for Łukasz

- **Z1 (item 1):** the Cube tab's New fact and New dimension always open the picker, even when the free spot lies in a
  concept frame (F2, P1)?
- **Z2 (item 2a):** add "Link to requirements…" to a card's header, a row's and a mapping line's menus, as the
  prototype has (F4)? With that text, or the prototype's "Link to a requirement…"?
- **Z3 (item 3):** the expand is one undo step "Show row" (F12), since "not undone" needs undo (the full path). Reset
  the filter only when it hides the row (PRD), or any filter (prototype, P4)? A card in a collapsed frame stays in its
  block, the row selected (F13)?
- **Z4 (item 4):** notes pinned to a frame keep their place on a left or top resize (D-20, proposed), or move with the
  frame's corner (prototype)?
- **Z5 (item 3):** keep the attribute ids in the tree (F11), with step 2 measuring the payload, or find the row by name
  at click time?
- **Z6 (item 2c):** the handle at full detail only and scaled with the card (proposed), or at a constant size on the
  screen as the frame's corner?
- **Z7:** the texts above and D-72's draft.
- **Z8 (runs):** one full run, before the merge, as the light path says. No step touches shared infrastructure.

### Plan for step 2

One step, as the PRD says, in small commits (KB backed up first):

1. **`PickPopover`** (`src/ui/`) with unit tests of its keys and filter. **Item 1:** `createEntityAt` and
   `createFromTab` open it. `lastConcept` goes. S17-01. The earlier specs that create outside a frame get the helper.
2. **Items 2 (a, b):** `linkRequirements` (domain, unit tests: skips, one group, the label, refusals), its action, the
   section's two buttons, the menus' items (per Z2). S17-02. The specs that used the select.
3. **Item 5:** `addAttribute`'s `below` (unit tests: order, label, changed rows only), the row's item. S17-05.
4. **Item 4:** `resizeFrame`'s rectangle, pinned notes per Z4, the label, the handles, `useFrames`' direction (unit
   tests on the rectangle and membership). S17-04. The frame specs.
5. **Item 3:** the tree's ids (the payload measured), `open` with the hit, "Show row". S17-03.
6. **Item 2 (c):** the handle, the drag's stores, the drop. S17-06, the commit count, the element counts on
   "Performance test – requirements" (a new baseline) and the element guard on "Performance test" (equal).
7. **The close:** the docs (D-72 and D-46's note, `ideas.md` with its two entries done and section 8's as later,
   `inventory-prototype-vs-app.md`, README, CLAUDE.md), S17-07, lint, typecheck, unit tests, the slice's and the touched
   specs as single-file checks, then one full run on the final commit. Then stop with the manual acceptance steps.

## Łukasz's answers to step 1 (8 November 2026)

- **Z1:** yes, the Cube tab's New fact and New dimension always open the picker.
- **Z2:** yes, the item in a card header's, a row's and a mapping line's menus, with the text "Link to requirements…"
  (the panel button's). The prototype keeps its old text; that is fine.
- **Z3:** yes, one undo step "Show row". A row filter is reset only when it hides the row (the PRD), not any filter. A
  card in a collapsed frame stays in its block, the row selected with its panel (F13).
- **Z4:** notes pinned to a frame keep their place on a left or top resize (D-20); their offset is corrected in the
  same step.
- **Z5:** first answered "find the row by name at click time", on the condition that attribute names are unique within
  an entity. **They are not** (step 2 checked before any code): `addAttribute` always names a new attribute
  `new_attribute` and checks nothing, `pasteAttribute` only warns (`nameTaken`), no rule or index makes them unique, and
  Łukasz's KB had 2 duplicated names out of 258 attributes (both in Kanton Basel's Building: `AssetCategoryCode` and
  `FacilityTypeCode`, each twice). **Final answer: the attribute ids in the tree** (F11), the row selected by the
  matched attribute's id; the payload reported as one number (step 2). No uniqueness rule in this slice; the duplicates
  go into `ideas.md` under the model validator.
- **Z6:** yes, the handle at full detail only, scaled with the card.
- **Z7:** the texts and D-72's draft are approved as written.
- **Z8:** yes, one full run, on the final commit before the merge.
- **Docs:** the PRD's sentence about a requirement card's double-click goes (it describes the prototype), and its
  section 3 says Q1–Q7.
