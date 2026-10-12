# Slice 3b – Active working context and live label canvases

Status: draft, waiting for Łukasz · Branch: `slice/03b-context-and-live-canvases` · Builds on: slice 3a (`main` at
`8a52155`, tag `slice-03a`)
Decisions: D-10, D-11, D-21, D-24, D-25, D-26, D-29, D-36, D-39, D-46, D-47, AD-05, AD-13, AD-15, AD-16, AD-23,
AD-24 (all rules, the slice 3a finding on elements in the viewport), AD-31

## Goal

Let an analyst work **on a ticket** instead of labeling by hand: while an **active working context** (e.g. `CR-23`)
is on, every model change they make gets that label in the same undo step (D-26). And let them **see a ticket's
footprint**: a **live label canvas** shows exactly what carries the label, with context cards for entities and
tables that are only partly labeled, and adding or removing a card there changes the label after an explicit question
(D-10, D-11, D-25). The Overview miniature also starts drawing notes (from `docs/ideas.md`, Łukasz before this PRD).

## Reference

- Behaviour: `docs/prototype/infomapper-model-prototype.html`:
  - active context: `autoLabel` (called from `mutate`), `renderCtxBtn`, `setCtx`, `renderCtxList`, `pickCtx`, the
    `#tCtx` button and its menu, the `ctxw` part of the status bar (`renderStatus`), the entity tool's toast
    (`createEntityAt`, “…, labeled {name}”);
  - live canvases: `hasLbl`, `rowRelevant`, `liveRequired`, `estH`, `syncLive` (called from `idx`), `openLive`,
    `liveAdd`, `liveRemove`, the `labeled` row filter (`rowsOf`, the card's filter button, the card toolbox's “Rows”),
    `.ctx` cards (`entCard`, `srcCard`), `.row.lab`, `.ctxline` mappings (`renderLines`), the live note in the canvas
    overview (`insOverview`), the tab icon (`renderTabs`), “Live: {name}” in the view-state bar (`renderNav`,
    `viewState`, “Show all”), “Open as live canvas” / “Go to its live canvas” (`insLabel`), the project home's label
    list (`renderHome`, `data-hlive`), label rename and delete (`label.name`, `lbl-del`), `addToCanvas`,
    `placeNear`, `removeCard`, the toolbox entries hidden on live canvases (`ctxFor`), and `dupDia`;
  - miniature: the notes in `renderMini` (`NOTE_MINI`).
- Data: `canvas.live_label_id`, `canvas_item.live_level`, `canvas_item.row_filter = 'labeled'` and
  `change_event.context_label_id` in `docs/data-model-v2.md` and the migration.
- Where the prototype draws with `opacity` (`.map.ctxline .s{opacity:.28}`), this slice uses colours (AD-24 rule 4).

## In scope

### Active working context (D-26)

1. **The switch.** A toolbar button left of the undo buttons: “No working context” with the tag icon, or a dot and
   “Working on {name}” when on (`aria-pressed`). A click opens a menu: the heading “Working context”, the help text
   “While a context is on, everything you create or change in the model gets its label, and shows up on its live
   canvas. Layout changes are not labeled.”, a search field “Find or create a label, e.g. CR-23”, at most 8 labels
   (the active one first, then by items marked, each with “active” or “N items”), “Create “{name}”” first when no
   label has the typed name (normalised as in slice 3a), and “Stop working on {name}” when on. Enter picks the first
   entry, Esc closes. Toasts: “Working on {name}: everything you create or change in the model gets this label. Layout
   changes don't.” and “Working context switched off.” The status bar shows “Working on **{name}**, items labeled
   **N**” (N = items the label marks).
2. **What gets labeled.** In the same change group as the change (one undo step), the active label is linked to every
   entity, attribute and mapping the action **creates or changes**, and to both entities of a relationship the action
   creates or changes. Not labeled: deletions, layout (positions, widths, collapse, row filters, frames, notes,
   canvases, look), labels and label links themselves, concepts, source tables and columns (as in the prototype). An
   item that already carries the label gets no second link. Every change event of that group carries
   `context_label_id`.
3. **Persistence and checks.** The context stays on after a reload until switched off (D-26), per person and
   workspace (see the questions). The client sends the context with each write; the server checks that the label
   exists and that the person may change labels; otherwise the write is refused with the domain's message. A deleted
   label switches the context off with the toast “The working context {name} was deleted, so it is off now.”
4. **Who sees it.** Only owners, admins and modelers get the switch (AD-05: only they change labels). Reviewers and
   readers do not see it.

### Live label canvases (D-10, D-11, D-25)

5. **Membership** (prototype `liveRequired`). For a label L:
   - an entity is **full** when L is on the entity, **context** when L is only on one of its attributes or on a
     mapping into one of its attributes;
   - a source table is **full** when L is on the table, **context** when L is only on one of its columns or on a
     mapping from one of its columns (for a combined mapping: every input column's table);
   - a row is **relevant** when L is on the row itself or on one of its mappings (`rowRelevant`).
6. **Opening.** “Open as live canvas” in the label panel and on the project home's label list (“Go to its live
   canvas” / “Open live canvas” when it exists). A label has at most one live canvas. Opening creates a canvas named
   after the label in the current project, places the full items with the row filter `all` and the context items
   with `labeled`, arranges them with the existing “Arrange into frames by concept and system” (slice 2b), and shows
   the toast “Live canvas for {name}. It follows the label: what you label appears here, what you unlabel
   disappears.” When the live canvas exists but not in this project, it is added to the project (“Added the live
   canvas {name} to {project}.”) and opened.
7. **Keeping it in sync** (`syncLive`). Every action that changes which items carry L (labeling by hand, the active
   context, removing a label, deleting a label, deleting model items, merging or splitting mappings) updates **every**
   live canvas of L in the same change group, open or not:
   - an item no longer required leaves the canvas;
   - an item that changes between full and context gets `live_level` updated and its row filter switched (`labeled`
     → `all` when it becomes full, `all` → `labeled` when it becomes context; other filters stay);
   - a newly required item lands **to the right of the existing content**, one card under another, in no frame (Q3:
     no “Newly labeled” frame; the prototype's frame is recorded in `docs/ideas.md` as a deviation to revisit).
   On the open canvas the toast reads “Added from {name}: {items}.” and/or “No longer labeled: {items}.” Layout the
   person made is never rearranged.
8. **Looking live.** The canvas tab has the tag icon (“Live canvas: shows everything labeled {name}”); the
   view-state bar starts with the information chip “Live: {name}” (not removable, not part of “Show all”); the canvas
   overview starts with the dashed box “This is the live canvas for {name}. Everything labeled {name} appears here by
   itself. Adding an entity here adds the label; removing one takes the label off.” with “Open label”; the project
   home's canvas tile shows the tag icon.
9. **Context cards and rows.** A context card has a dashed outline and a light header, the entity's line reads
   “context only” instead of “in {concept}”, with the tooltip “Context: the entity itself is not labeled {name}, only
   some of its attributes are” (tables: “…only some of its columns or mappings are”). Relevant rows have a bold name.
   The `labeled` row filter (“Labeled”) is offered on live canvases only, for entity cards, as in the prototype; it is
   not counted as “filtered” in the view-state bar and “Show all” leaves it. Mappings that do not carry L are drawn
   faded **by colour** (not opacity), their end dots too.
10. **Adding a card** (D-11, `liveAdd`). Dropping an entity or table from the left panel, clicking it there, or
    adding it from a panel's feeding sources asks “Label {name} with {label}? It then appears on this live canvas.”
    (“Add {label}” / “Cancel”); yes labels it and places it (where dropped, else through the sync), in one change
    group, toast “{name} is now labeled {label}.” with Undo. The Entity tool on a live canvas labels the new entity
    without a question; its toast ends “, labeled {name}”.
11. **Removing a card** (`liveRemove`). “Remove from this canvas (unlabel)…” (toolbox, panel, Delete) asks:
    - labeled directly: “Take the label {label} off {name}?” plus, when rows or mappings carry it too, “It stays here
      as context, because {N attributes and M mappings} of it carry {label}.”; button “Remove {label}”;
    - context only: “{name} is here because {what} carry {label}. Take the label off them?”; button “Remove from
      {what}”.
    One change group; the toast says what was unlabeled, with Undo.
12. **What a live canvas does not offer.** Adding several cards at once (“Add all”, “Add sources of selected
    entities”, “Show its sources”, “Add the N missing”) is hidden or answers “On a live canvas, add cards one at a
    time: each one gets the label first.”; “Remove from this canvas” for a multi-selection is not offered.
13. **Label rename and delete.** Renaming L renames its live canvas when the canvas still has L's old name. Deleting
    L turns its live canvas into a normal canvas in the same change group (Q5: `live_label_id` and `live_level` are
    cleared and `labeled` row filters become `all`) and the toast reads “Deleted the label {name}.
    Its live canvas, if any, became a normal canvas.” Undo brings both back.
14. **Duplicate layout** of a live canvas makes a normal canvas from the start (Q6: no `live_label_id`, no
    `live_level`, `labeled` row filters copied as `all`); the original stays live.

### Overview miniature

15. **Notes in the miniature** (`renderMini`). The miniature draws each visible note (D-21 hidden resolved notes and
    notes hidden by a collapsed frame are not drawn) as a small rounded rectangle in its paper colour (`NOTE_MINI`),
    under the cards. The miniature is still drawn once per change and not while panning or zooming (S1A-14); a note
    drag redraws it on drop, not on every move.

### Both

16. **Permissions (AD-05).** Opening a live canvas creates a canvas: owners, admins and modelers. Reviewers and
    readers can go to an existing live canvas, see it read-only and get no add, remove or unlabel actions. Direct
    server calls outside a role's rights are refused and change nothing.

## Out of scope

Automatic labeling of source tables, columns and concepts · labeling deletions · a live canvas for a requirement
(B-13, slice 4) · promoting a label to a requirement (D-33) · labels on requirements (D-33, slice 4) · several live
canvases per label · notes on the frame label or in the frame block beyond slice 3a · undo on the project home
(`docs/ideas.md`) · the performance review before the database slice (AD-31).

## Questions before Step 1 (answered by Łukasz on 12 October, after step 0)

Answers: **Q1** as proposed. **Q2** only the moved attribute is labeled: the reorder command names its main target; the
context rule labels main targets and created or changed items, and skips rows whose only change is `sort_order`. **Q3**
no migration and no “Newly labeled” frame: newly required cards land to the right of the existing content, one under
another, and the toast lists them (the prototype's frame goes to `docs/ideas.md`). **Q4** no migration
(`canvas_live_label_uq` exists already): a domain rule and the local adapter's check. **Q5** as proposed, without the
frame part. **Q6** and **Q7** as proposed. Also in step 1: the late refresh race fixed for notes, frames and cards
(`mergeFresh`); the local adapter's foreign keys from `canvas.live_label_id` and `change_event.context_label_id` to
`label`; the card height as one function in `domain/model`.


1. **Where the active context lives.** The prototype keeps it in the browser (`V.ctxLabel`). Proposed: a per-person,
   per-workspace preference in the browser, like hiding resolved notes (data model, section 12); each write sends it,
   the server checks it and writes `context_label_id`. No schema change.
2. **Moving an attribute (D-36) in a context.** The prototype labels every attribute whose position number changed,
   a side effect of how it stores order. Proposed: label only the attribute the person moved.
3. **The “Newly labeled” frame.** The prototype marks it with `sys: "new"`; the data model's `frame.kind` has
   `concept`, `source_system`, `free`. Proposed: a migration adds the value `newly_labeled` to the CHECK on
   `frame.kind` (allowed only on live canvases, at most one per canvas, rules in `domain`). Alternative without a
   migration: no frame; new cards go to the right of the content.
4. **One live canvas per label.** Proposed: a partial unique index on `canvas.live_label_id` among non-deleted rows,
   in the same migration as question 3, plus the domain rule.
5. **When the label is deleted.** The prototype keeps `live_level` and the `labeled` filters, so context cards then
   show “Nothing matches”. Proposed: in the same change group, `live_label_id` and `live_level` are cleared, `labeled`
   filters become `all`, and a “Newly labeled” frame becomes a free frame. Undo restores all of it.
6. **Duplicate layout of a live canvas.** The prototype copies `lv` and the filters. Proposed: as in question 5, the
   copy is a normal canvas from the start; the original stays live.
7. **Toast for changes made elsewhere.** Proposed, as the prototype: the “Added from …/No longer labeled …” toast only
   on the open live canvas; other live canvases change silently.

## Rules for the domain and data

- Pure functions with unit tests: `liveMembership(label)` (full, context, relevant rows), `syncLiveCanvas(canvas)`
  (leave, change level, add to the right of the content; returns the canvas changes),
  `contextTargets(changeSet)` (what an action created or changed that the context labels), the live remove question
  (direct, via rows, via mappings, with counts).
- Commands: open live canvas; add card to live canvas (labels it); remove card from live canvas (unlabels the direct
  link or the row and mapping links). Every existing command that writes model items accepts the active context; every
  command that changes label links or deletes model items runs the sync for the affected labels' live canvases, in
  the same change group. Label rename, label delete and duplicate layout get the rules from items 13 and 14.
- Every command checks permission, archive and version, validates input (Zod at the boundary) and writes its change
  events in the same write (AD-12, AD-13, AD-23).
- `docs/data-model-v2.md` and the migrations change only as answered in questions 3 and 4; the schema check's “not
  built yet” list shrinks for `live_label_id`, `live_level` and `context_label_id`.

## Canvas rules for this slice

- AD-24: no opacity on repeated elements (faded mappings and end dots use colours mixed with the surface); context
  cards use classes on the existing card element (outline, header background), **no new elements per card or row**;
  the relevant-row style is a class on the existing row; nothing zoom-dependent on the canvas root.
- Element budget: a normal canvas has exactly as many elements in the viewport as at `slice-03a`; on a live canvas a
  context card has no more elements than a normal card with the same rows; newly required cards are normal cards in no
  frame. The miniature adds one element per visible note, outside the canvas viewport.
- The `window.__imCanvasCommits` guard, S2C-12 and S3A-14's idle test stay quiet, also on a live canvas.
- Every sync is computed in the domain and written once; the canvas never re-derives membership while rendering.

## Steps (stop after each one and report)

### Step 0 – Housekeeping and inventory
- **handlebars:** from 19 October 2026 (4.7.10 at least 14 days old) or once `eslint-plugin-boundaries` ships a fix,
  add the override, run `npm install`, lint (including a deliberately broken layer rule), typecheck, unit tests and
  `npm audit`, and update `docs/known-limitations.md`. Before that date, say so and check again at Step 5.
- **Late refresh race:** check whether the race fixed for notes in slice 3a can happen for frames and cards (an older
  response overwriting a newer state). The active context labels every change, so it matters more now. Report how it
  shows and a proposed fix before building.
- **Inventory:** what exists for `live_label_id`, `live_level`, `row_filter = 'labeled'` and `context_label_id` in
  SQL, domain, adapter and UI; where writes pass through so the context can be added in one place; how “Arrange into
  frames” can be reused for opening; how the miniature is drawn and when.
- **Baseline:** the element count in the viewport of “Performance test” at 100 % and 30 %, frames expanded and
  collapsed, on `slice-03a` in the measurement build (S3B-15).

### Step 1 – Domain and data
The functions and commands above with unit tests, the migration if questions 3 and 4 say so, the adapter's rules and
undo. `seed:large` gets a live canvas for the label already on 50 rows and 30 mappings of “Performance test”. The demo
seed gets no live canvas (tests make their own).

### Step 2 – Active working context
Items 1 to 4.

### Step 3 – Live canvases
Items 5 to 14. After the step report, one quick `measure:canvas` round (S3B-15), run when Łukasz has prepared the
laptop.

### Step 4 – Miniature and permissions
Items 15 and 16.

### Step 5 – Acceptance tests and wrap-up
Playwright tests for every criterion (`e2e/slice-03b/`), independent of each other; three full e2e runs in a row with
no dev server running (after a test change, start the three again); the balanced sitting for S3B-15. Write
`docs/prd/slice-03b-acceptance.md` (results, the sitting, manual checklist S3B-01 to S3B-14, assumptions, changes to
earlier tests) and the proposed changes to `docs/decisions.md` (D-10, D-11, D-25, D-26 as answered), applied only
after Łukasz approves them, in this pull request. Update README and CLAUDE.md commands.

## Acceptance criteria

| ID | Criterion |
| --- | --- |
| S3B-01 | The switch: “Create “cr-99”” from the menu creates the label and turns the context on; the button, the toast and the status bar show it; after a reload it is still on; “Stop working on …” turns it off. |
| S3B-02 | With CR-23 on: creating an entity, adding an attribute, renaming an attribute, creating a mapping by drag, changing a mapping's rule and drawing a relationship each label what they created or changed (relationship: both entities) in the same undo step; one Ctrl+Z takes change and label away; every change event of the group has `context_label_id`. |
| S3B-03 | With CR-23 on: moving a card, resizing it, collapsing a frame, writing a note, deleting an attribute and moving an attribute (as answered in question 2) add no label beyond what the answers say. |
| S3B-04 | A reviewer and a reader see no context switch; a write sent with a context by a reviewer is refused and changes nothing; a deleted label switches the context off with its toast. |
| S3B-05 | “Open as live canvas” on CR-23 (label panel and project home) makes one canvas named CR-23 with Customer full, the entities and tables of CR-23's attributes, columns and mappings as context cards with the `labeled` filter, arranged into frames; opening again goes to it; from another project it is added there first. |
| S3B-06 | With the live canvas open, labeling an attribute of an entity not on it (panel) adds that entity as context to the right of the existing content with the toast; removing the last label of a context card takes it off; a context entity labeled directly becomes full and its filter `all`; all in the change's undo step. |
| S3B-07 | Labeling made on another canvas (and by the active context) changes the live canvas too; opening it afterwards shows the change without a toast. |
| S3B-08 | The tab icon, “Live: CR-23” in the view-state bar (kept by “Show all”), the overview box with “Open label” and the tile icon on the project home are shown; on a normal canvas none of them. |
| S3B-09 | Context cards have the dashed outline and “context only”, relevant rows are bold, unlabeled mappings are faded by colour without opacity; the `labeled` filter is offered only on live canvases and not counted as “filtered”. |
| S3B-10 | Dropping an entity on the live canvas asks, “Add CR-23” labels and places it where dropped; “Cancel” changes nothing; the Entity tool labels without asking; bulk adds are refused with the prototype's toast. |
| S3B-11 | Removing a directly labeled card that also has labeled rows asks the first question and keeps it as context; removing a context card asks the second and unlabels its rows and mappings; each is one undo step. |
| S3B-12 | Renaming CR-23 renames its live canvas; deleting it makes the canvas normal as answered in question 5 (no `live_label_id`, no `live_level`, `labeled` filters become `all`), with the toast; Undo brings back label, links and live canvas. Duplicate layout of the live canvas gives a normal canvas (question 6). |
| S3B-13 | The miniature draws visible notes in their colours; hidden resolved notes and notes in a collapsed frame are not drawn; panning and zooming do not redraw it; dragging a note redraws it once, on drop. |
| S3B-14 | As Piotr (reviewer) and as a reader: they can go to an existing live canvas and see it, cannot open a new one, add, remove or unlabel; direct calls are refused and change nothing. |
| S3B-15 | Performance, in the measurement build on the reference machine (AD-24): (a) the element count in the viewport of “Performance test” at 100 % and 30 %, frames expanded and collapsed, equals `slice-03a`'s; (b) a balanced sitting against `slice-03a` (two rounds, each side first once), frames expanded and collapsed: pan and zoom at 100 % no more than 3 % below `slice-03a`; (c) on the live canvas from `seed:large` at 100 %, pan and zoom at least as fast as “Performance test” in the same sitting; (d) S2C-12, S3A-14's idle test and a new idle test on the live canvas stay quiet. |
| S3B-16 | CI passes, including the schema check with the columns this slice builds; lint, typecheck, unit and all e2e suites pass three times in a row locally. |

## Definition of done

All criteria pass, steps were reported one by one, assumptions are listed, and Łukasz has worked on CR-23 with the
context on (a new entity, an attribute, a mapping, a relationship), opened its live canvas, seen a change from another
canvas arrive to the right of its content, added and removed a card with the questions, deleted and restored the
label, and seen notes in the miniature, then accepted the slice.
