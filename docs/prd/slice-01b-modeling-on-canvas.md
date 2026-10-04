# Slice 1b – Modeling on the canvas

Status: ready once slice 1a is accepted · Branch: `slice/01b-modeling-on-canvas` · Builds on: slice 1a
Decisions: D-01, D-02, D-19, D-36, D-37, D-46 – D-51, AD-12, AD-13, AD-23, AD-24, AD-30

## Goal

Model directly on the canvas, the way the prototype does: drag a source column onto an attribute to map it, draw
relationships, create entities where you click, reorder attributes, widen cards, see what a row is connected to by
hovering, and undo any change. After this slice a person can build a model from scratch without leaving the canvas.

## Reference

- Behaviour: `docs/prototype/infomapper-model-prototype.html`. For this slice: dragging columns onto attributes and onto
  entity headers, the relate button on entity cards, the Entity tool (E), the right-click toolbox, attribute order
  (Ctrl/Alt + ↑/↓, panel drag), card width handle and “fit width to names”, hover highlight, feeding sources with
  “Add all”, the column panel’s “Map to an attribute”, undo and redo.
- Canvas rules: AD-24 in `docs/decisions.md`, the spike report’s follow-up for C-09 and C-10.
- Slice 1a: `docs/prd/slice-01a-acceptance.md` for what exists and its known limitations.

## In scope

1. **Mapping by drag (D-48).** Dragging a column row onto an attribute row creates a direct mapping. If the attribute
   already has a mapping, a small choice appears at the drop point: “Separate mapping (alternative source)” or “Add to
   mapping …” (one entry per existing mapping), pre-selected by the hint: same source table → add; other system →
   separate. Enter confirms, Esc cancels. Adding to a mapping follows the 1a rule for a second input (rule required).
   The same column into the same attribute twice is refused (“That mapping already exists.”).
2. **New attribute from a column.** Dropping a column on an entity card’s header (not on a row) creates an attribute
   named after the column, with the matching logical type and parameters, and a direct mapping from the column.
3. **Map from the column side.** The column panel gets “Map to an attribute” (pick an entity, then an attribute),
   creating a direct mapping or offering the D-48 choice.
4. **Split and merge mappings (D-49).** In the mapping panel and the toolbox: “Split into separate mappings” turns a
   combined mapping into one direct mapping per input; “Merge mappings” combines selected mappings of one attribute
   into one transform (rule required).
5. **Relationships.** The relate button on an entity card (and dragging from it to another entity) creates a
   relationship with default ends 1 to 0..n; the panel opens for the label and cardinality.
6. **Entity tool and toolbox (D-46, D-19).** The Entity tool (E) creates an entity where you click (concept from the
   last used, since frames come in slice 2) with its name ready to type. Right-click without moving opens the toolbox:
   - empty canvas: “Add an entity or table here” (search, with “Create entity …” when the name is new), “New entity
     here”, “Fit everything on screen”;
   - card: show its sources or fed entities, collapse or expand, row filter, “Fit width to names”, remove from canvas,
     delete from model (entity);
   - attribute row: map from a column, move up, down, to top, to bottom;
   - mapping line: status (draft, in review, approved), edit rule, delete;
   - relationship line: edit, swap direction, delete.
   A right-click on an unselected item selects it first. Right-drag still pans.
7. **Attribute order (D-36).** With an attribute selected: Ctrl or Alt + ↑/↓ moves it one place, with Shift to the top
   or bottom; dragging in the entity panel’s attribute list; the attribute panel’s “Position 3 of 8” with arrows. The
   moved row flashes briefly. Order belongs to the model; lines follow.
8. **Card width (D-37, C-09).** A handle on the right edge of entity and source cards, 200–600 px, snapping to 8 px;
   double-click or the toolbox fits the width to the longest name. Saved per canvas. Lines follow live while dragging;
   `will-change` is switched off during the drag (spike follow-up).
9. **Hover highlight (C-10).** Hovering a row highlights its lines and the rows at the other end, and fades the rest;
   drawn in the overlay layer, not by restyling cards. Row dots for connections appear in the overlay.
10. **Below 40% zoom.** Clicking a card’s block selects the card; hovering shows its name.
11. **Feeding sources (B-08).** In the entity panel: “Add the N missing to this canvas” places the missing source
    tables next to the entity’s card, and a single feeding source clicked in the list is placed next to it too
    (left side, free spot). The same for “fed entities” in the source table panel (right side).
12. **Undo and redo.** Every change group (AD-13) of the current person in the current workspace can be undone and
    redone: Ctrl+Z, Ctrl+Shift+Z or Ctrl+Y, and the two buttons in the top bar. Undo applies the before-images of the
    group as a new change group; if any of those rows has changed since (another person, or a later change), undo is
    refused with “This can’t be undone because it was changed afterwards.” History holds the last 50 groups per person
    and workspace, in memory on the server for now. Toasts for destructive actions get an “Undo” link.
13. **Delete confirmations with undo in place.** Deleting a mapping or a relationship becomes immediate with an “Undo”
    toast. An attribute with mappings, a table with columns and an entity (impact dialog) keep their confirmation.

## Out of scope

Lasso, multi-selection and group moves (slice 2, with frames) · frames, collapsed frames and Overview frames · several
canvases’ layout features (look, duplicate) · labels, notes, requirements · rich-text editor · import of sources ·
re-pointing a mapping by dragging its line end · Supabase (persistent undo history comes with it).

## Rules to implement in the domain

- Commands: create relationship; create attribute from column; reorder attribute (renumbers the entity’s order in one
  change group); split mapping; merge mappings; undo group; redo group. Every command checks permission, version and
  writes change events, as in 1a.
- Logical type from a physical column type follows the 1a type table in reverse (e.g. `varchar(100)` → string 100,
  `decimal(18,2)` → decimal 18,2, `datetime2` → datetime); anything unknown → custom with the physical name.
- Merge: only mappings of the same attribute; the result is a transform whose inputs are all inputs in order, status
  “review”; the rule is required.
- Undo and redo respect permissions and the archive like any write; a reviewer can undo only their own status changes.

## Steps (stop after each one and report)

### Step 1 – Domain
The commands and rules above with unit tests, including undo refused after a later change.

### Step 2 – Mapping by drag and from the column side
Items 1, 2 and 3. The drop choice is a small popover at the drop point, keyboard first.

### Step 3 – Relationships, Entity tool and toolbox
Items 5, 6 and 10.

### Step 4 – Order, width and highlight
Items 7, 8 and 9, plus split and merge (item 4).

### Step 5 – Feeding sources, undo and delete behaviour
Items 11, 12 and 13.

### Step 6 – Acceptance tests, performance and wrap-up
Playwright tests for every criterion (`e2e/slice-01b/`), independent of each other; three full runs of all e2e suites.
Measure C-09 and C-10 on “Performance test” as in the spike. Write `docs/prd/slice-01b-acceptance.md` (results,
measurements, manual checklist for S1B-01 to S1B-12, assumptions). Update README and CLAUDE.md commands.

## Acceptance criteria

| ID | Criterion |
| --- | --- |
| S1B-01 | Dragging `customers.segment` onto `Customer.segment_code` creates a direct mapping and its line. |
| S1B-02 | Dragging `web_users.email` onto `Customer.email` (already mapped from CRM) shows the choice with “Separate mapping” pre-selected; Enter creates a second mapping. Dragging `customers.lname` onto an attribute mapped from `customers.fname` pre-selects “Add to mapping” and asks for a rule. |
| S1B-03 | Dropping `order_line.price` on the Order Line header creates attribute `price` (decimal with the column’s precision and scale) and a direct mapping. |
| S1B-04 | “Map to an attribute” in the column panel creates the mapping. |
| S1B-05 | Split turns a combined mapping into one mapping per input; merge turns two mappings of one attribute into one transform after a rule is given. |
| S1B-06 | Relate from Customer to Country creates a relationship; the panel sets its label and ends. |
| S1B-07 | The Entity tool and “New entity here” create an entity at the clicked spot with the name ready to type; the toolbox offers the actions listed for each kind of item. |
| S1B-08 | Ctrl+↑ moves an attribute up, Ctrl+Shift+↓ to the bottom; panel drag reorders; lines follow; the order is the same on every canvas and after reload. |
| S1B-09 | Card width changes by dragging the edge and by “Fit width to names”; persists per canvas. On “Performance test”, resize runs at 45 fps or better on average (C-09). |
| S1B-10 | Hovering a row highlights its lines and far-end rows within 100 ms on “Performance test” (C-10); pan and zoom do not regress against slice 1a: the median of three `MEASURE=1` runs is at most 5% below slice 1a’s median, separately for overview (55.6 fps → at least 52.8 fps) and 100% (49.5 fps → at least 47.0 fps). The production-build measurement stays with the Supabase slice. |
| S1B-11 | “Add the N missing to this canvas” places Customer’s missing sources to the left of its card without overlaps. |
| S1B-12 | Undo and redo: create, edit, move, reorder and delete are each undone with Ctrl+Z and redone; undo is refused with the message when another session changed the row afterwards. |
| S1B-13 | Deleting a mapping or relationship is immediate with “Undo” in the toast; an attribute with mappings still asks for confirmation. |
| S1B-14 | A reviewer gets no drag, relate, tool or reorder actions, and can undo only their own status changes; direct server calls are refused. |
| S1B-15 | CI passes on the pull request; lint, typecheck, unit and all e2e suites pass three times in a row. |

## Definition of done

All criteria pass, steps were reported one by one, assumptions are listed, and Łukasz has built a small model from
scratch on an empty canvas using only the canvas, then accepted the slice.
