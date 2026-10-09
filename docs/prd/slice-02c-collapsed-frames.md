# Slice 2c – Collapsed frames

Status: ready once Łukasz confirms it · Branch: `slice/02c-collapsed-frames` · Builds on: slice 2b (`main` at
`2e95478`, tag `slice-02b`)
Decisions: D-07, D-17, D-19, D-22, D-52, AD-12, AD-13, AD-23, AD-24 (incl. the zoom-variable rule)

## Goal

Let a large canvas be read at the level of its areas: a frame collapses into one block that lists what is inside, the
lines to and from its cards merge into one line per other end with a count, and a click on such a bundle shows what
it holds. The layout stays as it is (D-07): collapsing moves nothing, expanding puts everything back where it was.

## Reference

- Behaviour: `docs/prototype/infomapper-model-prototype.html`: `setCollapsed`, `blockCard`, `blockH`, `blockRect`,
  `isHidden`, `endOf` (line ends at a collapsed frame), the bundle building in the line drawing (“Semantic zoom”),
  `insBundle` (the bundle panel), the bundle and frame entries of the toolbox (`ctxFor`), the drop on a collapsed block
  in `afterCardDrop`, “Collapse all” / “Expand all” in the canvas overview, and how hidden cards are treated by the
  lasso, the drop targets, row hover, search and centring.
- Data: `frame.collapsed` exists in the data model and the local adapter; slice 2b kept it false.
- Line geometry: `src/canvas/line-geometry.ts` (slice 2p) computes all line ends; bundles are computed there too.

## In scope

1. **Collapsing and expanding.** A collapse button on the frame's label, a double-click on the frame's name, the
   toolbox (“Collapse into one block” / “Expand”) and the frame panel (“Collapse frame” / “Expand frame”). A double-click
   on a block's header or its “Expand” button expands it. Toasts: “Collapsed {name}. Its lines are bundled; click a
   bundle to see what is inside.” / “Expanded {name}.” Each is one undo step. Nothing else on the canvas moves; the
   frame keeps its size and its cards keep their positions for when it is expanded.
2. **The block.** Drawn at the frame's top-left corner with the prototype's fixed width and computed height. Header:
   the kind (“Concept”, “Source system”, “Free area”), “collapsed, N cards”, an “Expand” button, the name. Body: up to
   six member rows (a marker for entity or table, the name, mapped or used count as “n/m”), then “and N more”, or
   “Empty frame”. Footer: the frame's chips (mapped, used, type, drafts). A click on a member row expands the frame and
   selects that card.
3. **Hidden cards.** The cards of a collapsed frame are not drawn and cannot be hovered, lassoed, dropped on or
   reached by the Entity tool or the toolbox. Selecting one from elsewhere (a panel link, “On canvases”, search in the
   left panel) selects the card, shows its panel and centres the view on the block.
4. **The block as a frame.** Dragging the block's header moves the frame (and, with it, its hidden cards), one undo
   step. Clicking it selects the frame; a lasso that fully contains the block selects the frame (D-17); it takes part
   in group drag, nudge, align, stack and line up as a unit with the block's size. Right-click opens the frame toolbox:
   “Expand” replaces “Collapse into one block”, “Fit frame to its content” is not offered and “Select its cards” is
   disabled. Resizing is not possible while collapsed.
5. **Dropping a card on a block.** The card joins the frame and is filed at the bottom of the frame (x = frame's x +
   32, y = frame's bottom − 8), the frame grows to hold it, toast “{card} added to the collapsed frame {frame}.” The
   concept question of slice 2b applies as for any drop into a concept frame.
6. **Bundled lines.** Every mapping or relationship with an end in a collapsed frame (and not both ends in the same
   one) is grouped per pair of ends, where an end is a collapsed frame or a row (mappings) or an entity (relationships).
   A line ends at the middle of the block's facing side.
   - A group of one mapping keeps its own identity: its status style, its ƒ or type-problem chip, selectable and
     deletable as a mapping.
   - A group of two or more mappings is one line whose width grows with the count, with a count chip in its middle;
     drawn as draft if all are drafts, in the warning colour if any has a type problem.
   - Relationships between the same ends are one line with the label “N relationship(s)”.
   - Lines with both ends inside the same collapsed frame are not drawn.
   - Layer mode applies to bundles (Mappings hides relationship bundles, Relationships hides mapping bundles).
   - Hovering or selecting a row whose mappings are in a bundle emphasises the bundle, as for a single line.
7. **The bundle panel.** Clicking a bundle selects it. Mapping bundle: “Bundled mappings”, “N mappings”, “From {end}
   to {end}”, the status counts (“2 approved, 1 in review, 3 draft”, with type problems in the warning colour), the
   mappings grouped under “Into {entity}”, each a link to the mapping, and an “Expand {frame}” button per collapsed end.
   Relationship bundle: “Bundled relationships”, “N relationships”, “Between {end} and {end}”, each relationship with
   its multiplicities as a link, and the “Expand” buttons. The bundle's toolbox offers the same “Expand {frame}” actions.
8. **Collapse all / Expand all.** In the canvas overview's “Frames on this canvas”, shown when the canvas has frames.
   Toasts “All frames collapsed. Lines between them are bundled.” / “All frames expanded.” One undo step each.
9. **The rest of the canvas knows about blocks.** Fit everything and content bounds, free-spot placement and “Add the
   N missing” (a placed card never lands on a block), the Overview minimap (draws the block, not the hidden cards),
   the selection box and lasso marks, and the 40% detail level (below 40% the block draws its header and a plain body).
10. **Duplicate layout** copies the collapsed state of each frame.
11. **Permissions.** Collapsing and expanding are saved for everyone, so they need edit rights, like any layout change.
    Reviewers and readers can collapse and expand in their own browser tab only, not saved, as with the layer mode in
    slice 2a; everything else about blocks and bundles (panels, links, selection) works for them.

## Out of scope

Notes in or on frames and their count on the block (slice 3) · the view-state bar listing collapsed frames (D-39,
slice 6) · nested frames (D-23) · collapsing single cards differently from today.

## Rules for the domain and data

- Commands: set collapsed for one frame; set collapsed for all frames of a canvas; the drop on a block uses the
  existing drop command with the filing position. Each checks permission, archive and version and writes change events
  in the same write (AD-12, AD-13, AD-23); collapse is an undo step.
- Bundles are computed, never stored. The grouping and the line ends at a block are pure functions in
  `line-geometry.ts` (or next to it) with unit tests: grouping keys, single-mapping identity, same-frame lines left out,
  layer mode, both-ends-collapsed bundles, relationship bundles.
- No change to `docs/data-model-v2.md` or the migrations is expected. If one is needed, stop and ask first.

## Canvas rules for this slice

- Bundled lines are drawn by the existing SVG line layer (AD-24); the block is drawn like a card in the frame layer's
  stacking order rules of slice 2b (above frames, with the cards).
- The block's text keeps its size like a card's (it scales with the canvas); any zoom-dependent CSS variable is set
  only on the elements that use it (AD-24 rule 4).
- Hidden cards are not mounted, or are mounted without rows; whichever is cheaper, measured in Step 5.

## Steps (stop after each one and report)

### Step 0 – Housekeeping
The new `handlebars` finding from `npm install` (critical, only through `eslint-plugin-boundaries`, a lint tool):
check whether a fixed version of the plugin, or an `overrides` entry for `handlebars`, solves it without breaking lint
and the layer rules. Propose the change before making it; otherwise record it in `docs/known-limitations.md` next to
`braces`.

### Step 1 – Domain and geometry
The commands and the bundle functions with unit tests.

### Step 2 – Blocks
Items 1, 2, 3, 4, 5 and 10.

### Step 3 – Bundles
Items 6 and 7.

### Step 4 – Overview, placement, permissions
Items 8, 9 and 11.

### Step 5 – Acceptance tests and wrap-up
Playwright tests for every criterion (`e2e/slice-02c/`), independent of each other; three full e2e runs in a row with
no dev server running (after a test change, start the three again); one quick `measure:canvas` round (S2C-12). Write
`docs/prd/slice-02c-acceptance.md` (results, the round, manual checklist S2C-01 to S2C-10, assumptions, changes to
earlier tests). Update README and CLAUDE.md commands.

## Acceptance criteria

| ID | Criterion |
| --- | --- |
| S2C-01 | Collapsing a frame (label button, double-click on its name, toolbox, panel) shows its block with kind, card count, up to six member rows with counts, “and N more” and the chips; no other card moves; expanding brings every card back to its place; each is one undo step. |
| S2C-02 | The cards of a collapsed frame cannot be hovered, lassoed, dropped on or targeted; selecting one from a panel link selects it and centres on the block; a click on a member row expands the frame and selects the card. |
| S2C-03 | The block moves with its frame and hidden cards, is selected by click and by a lasso around it, and takes part in group drag and align as a unit; its toolbox offers “Expand” and no resize or fit. |
| S2C-04 | A card dropped on a block joins the frame at its bottom, the frame grows, and the toast names both; a concept frame asks the concept question. |
| S2C-05 | With a source frame collapsed on Customer & orders, its mappings to each attribute of another card are one line per attribute (one line per pair of ends), with a count chip when there are two or more; a single mapping keeps its status style, chip and selection; lines inside one collapsed frame are not drawn. |
| S2C-06 | With two frames collapsed, the lines between them are one bundle per direction with the right count; relationship bundles show “N relationships”; layer mode hides the matching bundles. |
| S2C-07 | Clicking a bundle opens its panel with the counts by status, the mappings grouped by entity as links and an “Expand” button per collapsed end; the bundle's toolbox offers the same expands. |
| S2C-08 | “Collapse all” and “Expand all” work in one undo step each; Fit everything, “Add the N missing” and new-card placement never put a card on a block; the Overview draws blocks. |
| S2C-09 | Duplicate layout keeps each frame's collapsed state. |
| S2C-10 | As Piotr (reviewer): collapsing and expanding work in his tab and are not saved (a reload shows the saved state); bundle panels and links work; the collapse commands called directly are refused. |
| S2C-11 | Unit tests cover the bundle grouping and the line ends at a block. |
| S2C-12 | One quick `measure:canvas` round on “Performance test” against `slice-02b`: pan and zoom with all 8 frames expanded no more than about 10% below `slice-02b`, and with all 8 collapsed recorded (expected faster). |
| S2C-13 | CI passes; lint, typecheck, unit and all e2e suites pass three times in a row locally. |

## Definition of done

All criteria pass, steps were reported one by one, assumptions are listed, and Łukasz has collapsed the source frames
on Customer & orders after “Arrange into frames”, read the bundles and their panels, dropped a card on a block,
expanded everything and undone it, then accepted the slice.
