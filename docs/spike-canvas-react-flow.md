# Spike brief: canvas engine (React Flow)

Oct 2, 2026 · @Lukasz

## Goal and timebox

Find out whether React Flow (xyflow) can carry the InfoMapper modeling canvas, before any product code depends on the choice. This is architecture decision AD-24: React Flow is chosen only if it meets the must-have criteria below; otherwise we build our own engine modeled on the prototype.

- **Timebox:** two working days. Stop when every criterion has a measured result, even if some fail.
- **Nature:** throwaway code in its own folder (`/spikes/canvas-react-flow`). Nothing from the spike is merged into the application as is.
- **Output:** a short report with measured results and a recommendation (React Flow, own engine, or a stated hybrid).

## Context: what the canvas must do

InfoMapper is a data-modeling tool for data warehouse work. Its canvas shows logical entities and physical source tables as cards with one row per attribute or column, and lines between them. The [clickable prototype](https://claude.ai/artifact/ByB8DG57n9kJL3thEW8ZF4) is the reference for every behavior below; open it next to the spike.

- **Cards with rows.** An entity card lists its attributes, a source card its columns. Cards can be 200–600 px wide (D-37), collapsed to the header, or filtered to a subset of rows.
- **Row-to-row lines.** A mapping connects one source column row to one entity attribute row (D-02). Lines must leave and enter at the row, on the side facing the other card, and follow the cards while they move.
- **Relationships.** Lines between entity cards with crow’s-foot or UML end markers and an optional label.
- **Frames.** Named areas that group cards; dragging a frame moves its cards (D-14). A frame can collapse into a block; lines from its cards then merge into one line per target with a count (D-07).
- **Selection.** Dragging on empty canvas draws a lasso that selects only cards fully inside it (D-15, D-16); Shift-click adds to the selection; the group moves together.
- **Navigation.** Unbounded canvas, pan with scroll, Space or right-drag, zoom 10–300%, an overview minimap.
- **Highlight.** Hovering or selecting a row lights up its lines and the rows at the other end; everything else fades (Focus).

## What to build

One Next.js page with React Flow, fed by a seeded generator so every run shows the same canvas. No backend; state in memory.

**Synthetic data (fixed seed):**

- 60 source tables (8–40 columns each) and 40 entities (5–25 attributes each), so 100 cards in total.
- One extra entity with **200 attributes**, to test tall cards.
- 300 mappings, each from a column row to an attribute row, spread over the cards.
- 40 relationships between entities with crow’s-foot markers and labels.
- 8 frames holding 6–15 cards each.

**Interactions to wire up:**

1. Custom node for a card: header plus one row per attribute or column, with a connection point (handle) on both sides of every row.
2. Custom edge for a mapping: a curve from row to row that picks the facing sides; re-anchors to the card header when its row is hidden by collapse or a filter.
3. Relationship edge with crow’s-foot end markers and a label.
4. Frames as group nodes: drag the frame to move its cards; collapse to a block, with the frame’s lines merged into one line per target card showing a count; expand back to the same layout.
5. Lasso that selects only fully enclosed cards, Shift-click, group drag, arrow-key nudge.
6. Card width resize by dragging its right edge (200–600 px); lines follow live.
7. Row hover and selection highlight its lines and the rows at the other end; everything else fades.
8. Pan, zoom 10–300%, minimap.
9. A small FPS readout on screen, used for the measurements below.

## Acceptance criteria

Twelve criteria: eight must pass, four should. Measure on a typical business laptop in Chrome, with the full synthetic data set loaded, and record the numbers in the report.

| ID | Criterion | How to measure | Priority |
| --- | --- | --- | --- |
| C-01 | Smooth pan and zoom with 100 cards and 340 lines | FPS readout and Chrome Performance panel during a 10-second pan and zoom; at least 50 fps on average, no frame longer than 50 ms | Must |
| C-02 | Smooth drag of one card and of a 15-card group, lines following live | Same tools during dragging; at least 45 fps | Must |
| C-03 | Lines attach to the exact row, on the facing side, at every zoom level | Visual check at 25%, 100% and 300%; Playwright check that each line end lies within its row’s bounds | Must |
| C-04 | The 200-row card renders and scrolls the canvas without lag; its lines stay attached | FPS and visual check while panning past it | Must |
| C-05 | Hidden rows (collapse, filter) re-anchor their lines to the card header | Collapse a card and filter another; check line ends | Must |
| C-06 | Frame drag moves its cards; collapse merges lines per target with a count; expand restores the exact layout | Scripted collapse and expand; compare card positions before and after | Must |
| C-07 | Lasso selects only fully enclosed cards; Shift-click and group move work | Playwright scenario | Must |
| C-08 | Initial render of the full data set | Time from navigation to first stable frame; under 1.5 s | Must |
| C-09 | Card width resize with live line updates | Drag the right edge of a card with 20 mapped rows | Should |
| C-10 | Row hover highlights its lines and far-end rows; the rest fades | Visual check; no visible delay on hover | Should |
| C-11 | Crow’s-foot and UML end markers and edge labels | Visual check against the prototype | Should |
| C-12 | Practical fit: license, bundle size, server rendering in Next.js, theming, keyboard access | Note the facts in the report | Should |

## Out of scope

The spike answers one question, so everything else stays out:

- Saving data, a database, login, users or permissions.
- The inspector panels, left-hand trees, project and workspace screens.
- Creating or editing mappings, entities or attributes by hand.
- Labels, notes, requirements, undo, history.
- Visual polish beyond what is needed to judge the criteria.

## Deliverables and decision rule

**Deliverables:**

1. The spike code in `/spikes/canvas-react-flow`, runnable with one command and described in a short README.
2. Playwright scripts for C-03, C-06 and C-07, so the results can be repeated.
3. A report (`/spikes/canvas-react-flow/REPORT.md`) with: a results table (criterion, measured value, pass or fail), screenshots of the 200-row card and of a collapsed frame, workarounds used and how fragile they are, and a recommendation.

**Decision rule:**

- **All eight must-haves pass:** use React Flow for the application.
- **A must-have fails, but a workaround is small and stable:** use React Flow with that workaround, named in the report.
- **A must-have fails without a reasonable workaround** (most likely C-01, C-03 or C-06): build our own engine modeled on the prototype, and reuse what the spike taught us.

Łukasz takes the decision after reading the report; it is then recorded as an update to AD-24.

## References

- [Model workspace prototype](https://claude.ai/artifact/ByB8DG57n9kJL3thEW8ZF4): the reference for every behavior. Its HTML file goes into the repository at `/docs/prototype/`.
- [Backlog and UX decisions](https://claude.ai/artifact/P6ZgiuTVmoWGSfozfEX877): D-02 (mapping is a model object), D-07 (collapsed frames merge lines), D-14 (frame drag), D-15 and D-16 (lasso), D-37 (card width).
- [Architecture decision map](https://claude.ai/artifact/Y9hbgoJfx4aMUkxWpZwZvw): AD-19 (code layers, the canvas sits in its own layer), AD-24 (this spike), AD-25 (slice-by-slice work).
