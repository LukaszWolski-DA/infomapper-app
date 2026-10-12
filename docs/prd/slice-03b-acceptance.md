# Slice 3b – Acceptance

Status: **step 2 done, waiting for Łukasz**. Branch `slice/03b-context-and-live-canvases`, pull request #10 (draft). Steps are
reported one by one (below); criteria, runs and the manual checklist come in step 5.

## Step 0 (12 October)

- **handlebars:** `eslint-plugin-boundaries` is still 7.2.0 and `@boundaries/elements` 3.1.1 pins `handlebars` 4.7.9; no
  fix shipped. Nothing changed; checked again at step 5 (from 19 October).
- **Late refresh race:** found for frames and cards too (moves and resizes do not refresh the page, so a page started by
  an earlier write could put a card or frame back and lower its version). Fixed in step 1 (below).
- **Answers to the PRD's questions (Łukasz, after step 0):** Q1 as proposed; Q2 only the moved attribute is labeled;
  Q3 no migration and no “Newly labeled” frame (new cards to the right of the content; the prototype's frame is in
  `docs/ideas.md`); Q4 no migration (`canvas_live_label_uq` exists), a domain rule and the adapter's check; Q5 as proposed
  without the frame part; Q6 and Q7 as proposed. The PRD was updated in its own commit.

### S3B-15 (a) baseline: elements on `slice-03a`

`e2e/slice-03b/S3B-15-elements.spec.ts` (measurement build only, left out of the normal run), run on `slice-03a`
(`8a52155`) in `../infomapper-ab-main`, headed Chrome, 1536 × 864, S1A-14's 100 % view (src:57 at 768, 300) and 30 %
around the same point, 2 s after the canvas is ready. Counts in `.data/measure/s3b15-baseline/slice-03a.json`.

| View | Whole page | `.react-flow__viewport` |
| --- | --- | --- |
| 100 %, frames expanded | 20,679 | 19,295 |
| 30 %, frames expanded | 5,882 | 4,498 |
| 100 %, frames collapsed | 6,209 | 4,905 |
| 30 %, frames collapsed | 2,767 | 1,463 |

S3B-15 (a) compares the viewport column. The whole page also counts the tab bar, and `seed:large` gives “Performance
test” a second tab from step 1 on (PERF-2's live canvas), so the page column will differ by that tab's elements.

## Step 1 (domain and data, 12 October)

What was built: the late refresh race fixed (`mergeFresh` in `src/canvas/fresh.ts` for notes, frames and cards, the page's
`readAt`, versions that only grow); the card height as one domain rule (`src/domain/model/card-size.ts`, with the
`labeled` filter); the adapter's checks (foreign keys from `canvas.live_label_id` and `change_event.context_label_id` to
`label`, one live canvas per label, live levels only on live canvases); the pure rules (`src/domain/model/live.ts`:
`liveMembership`, `syncLiveCanvas`, `liveRemoveQuestion`, `contextTargets`); the commands (`src/domain/commands/live.ts`:
`openLiveCanvas`, `removeFromLiveCanvas`, and `completeLiveWrites`, the step every write passes through); the live rules in
label rename and delete, duplicate layout and the card commands; PERF-2's live canvas in `seed:large`.

Checks: lint, typecheck, 809 unit tests (765 before), one full e2e run 124/124 (20.6 min; “The destination stream
closed early” 16 times, known noise).

### Assumptions

1. **One place for the live rules.** `completeLiveWrites` runs in `runCommand` after every command, and after undo and
   redo, when the writes can matter (`touchesLiveCanvases`: label links, labels and canvases always; model rows and
   cards when created, deleted or restored, or when what ties them together changes). Moving a card or renaming an
   attribute does not load the live state. A sync update of a row the action already writes becomes part of that write
   (one version step), so the adapter's version check holds.
2. **A card placed on a live canvas labels its element** in the same change group, whatever placed it (a drop, a click
   in the left panel, the Entity tool, a feeding source). The question before it (D-11) is the client's (step 3); the
   Entity tool asks none (PRD item 10). Cards the live rules make (opening, sync) carry their level and are not
   labeled again. Bulk adds (`placeManyOnCanvas`) and a plain “Remove from this canvas” (one or several cards) are
   refused on a live canvas with the domain's messages; removing goes through `removeFromLiveCanvas` (unlabel).
3. **Undo and the sync.** Undo reverts the whole change group, sync rows included; then the live step runs on the
   revert too, so a live canvas opened after the change still follows an undo of it. Redo reverts the undo's group the
   same way.
4. **The working context in the domain only.** `completeLiveWrites` takes the context label (refused when the label is
   gone, `CONTEXT_LABEL_GONE`, or the person may not change labels) and writes it into every event of the group, layout
   changes included (they get no label link). The client sending it is step 2.
5. **Q2's main target** travels on the write set (`mainTargets`); only `reorderAttribute` sets it. An attribute update
   whose only change is `sort_order` is not labeled otherwise.
6. **What a mapping change labels:** inserting, changing or removing one of its inputs labels the mapping (it changed);
   a deleted item is never labeled, nor a relationship that was deleted.
7. **Where new cards go** (Q3): 160 px to the right of everything on the canvas (cards and frames), from the top of the
   content, 32 px apart, snapped to 8, tables first then entities, each by name. A context card's height counts its
   relevant rows.
8. **Opening a live canvas** creates it in the current project as the last tab, named after the label (canvas names are
   not unique), with the arranged frames of slice 2b (heights from the domain). A label with nothing marked opens an
   empty live canvas. When it exists in another project it is linked to this one (`canvas.edit_projects`).
9. **The `labeled` filter** is saved only on a live canvas (`updateCanvasItem` refuses it elsewhere). The sync gives it to
   context cards of tables too (as the prototype); the toolbox offers it for entity cards only (step 3).
10. **`seed:large`'s live canvas is PERF-2's.** “Performance test” spreads its labels over five labels (PERF-1 to PERF-5,
    round robin over 50 rows, 30 mappings and 10 headers), not one. Łukasz after step 1: the label with the largest
    footprint, without changing which items carry labels (so the S3B-15 (a) baseline stays comparable). Footprints (each
    label: 10 labeled rows, 6 labeled mappings, 1 full entity, 1 full table):

    | Label | Context entities | Context tables | Cards | Relevant rows |
    | --- | --- | --- | --- | --- |
    | PERF-1 | 9 | 9 | 20 | 21 |
    | **PERF-2** | 10 | 10 | **22** | **22** |
    | PERF-3 | 9 | 10 | 21 | 22 |
    | PERF-4 | 7 | 10 | 19 | 22 |
    | PERF-5 | 10 | 8 | 20 | 22 |

    Its live canvas is made by `openLiveCanvas` itself.
11. **The race fix** keeps the model's content on cards as the page has it and only the layout (place, width, collapse,
    row filter, frame) as the canvas has it, when the canvas is newer. A frame created here uses the browser's clock
    for `createdAt` until the page brings the server's (the create refreshes the page).

## Before step 2: undo and redo with the context on (Łukasz, after step 1)

Undo and redo already linked nothing: the undo action called the live step without a context, and a revert only
inserts link rows (`project_canvas`, `project_pinned_label`, `workspace_member`), never cards. To keep it so once every
write carries the context, `completeLiveWrites` got an explicit `revert` mode (only the sync), used by the undo action.
Tests through the local adapter (`live-store.test.ts`): an attribute created with CR-23 on, undone (attribute and its
CR-23 link gone, no other label change, no context on the undo's events) and redone (both back, nothing more); a card
move on CR-23's live canvas with the context on, undone (no label change).

## Step 2 (active working context, 12 October)

What was built: the switch left of Undo (“No working context” with the tag icon, or a dot and “Working on {name}”,
`aria-pressed`) with its menu (heading, help text, “Find or create a label, e.g. CR-23”, at most 8 labels, the active
one first then by items marked, “active” or “N items”, “Create “{name}”” first when no label has the typed name,
“Stop working on {name}”; Enter picks the first entry, Esc closes); the two toasts; the status bar's “Working on
{name}, items labeled N”; the server side (`runCommand` reads the context and the live step labels and records it); a
deleted label switches the context off with its toast; `createLabel` for “Create”. Owners, admins and modelers only.

Checks: lint, typecheck, 817 unit tests, one full e2e run 124/124 (19.6 min; “The destination stream closed early” 13
times). Browser check on the preview data: “cr-99…” created from the menu, the Entity tool's new entity labeled in the
same step (chip, header mark, status 1), one undo took both away (events of the create carry the context, the undo's
none), the context stayed on after a reload, deleting the label switched it off with the toast, Piotr (reviewer) has no
switch.

### Assumptions

12. **Where the context is kept (Q1).** A cookie per person and workspace (`im-ctx.{user}.{workspace}`, the label id and
    its name), written only by the browser, so every server action carries it without each call passing it; the server
    reads it in `runCommand` (`src/ui/working-context-cookie.ts`). It stays a browser preference: never written by the
    server, not in the data. Undo and redo ignore it.
13. **Which writes it covers.** Every write through `runCommand` while it is on, on every page of the workspace (the
    switch itself is on canvas pages, next to Undo, as in the prototype). A layout-only write with the context on loads
    only the labels (to check the context and record it), not the whole live state.
14. **A deleted context label.** The refused write (`CONTEXT_LABEL_GONE`) refreshes the page; the browser sees the label
    gone from the fresh page and switches the context off with “The working context {name} was deleted, so it is off
    now.” Deleting the context's own label is not refused (the label is checked as it was when the action started).
    The toasts share one place, so that toast replaces “Deleted the label {name}.” and its Undo link (Ctrl+Z still
    undoes it).
15. **Roles.** Only owners, admins and modelers get the switch (they change labels, AD-05); a reviewer's or reader's
    stale cookie is cleared by the page. An archived workspace has no switch.
16. **The menu.** Opens in a portal under the button (the top bar would clip it). “Create “{name}”” creates the label
    (one undo step) and turns the context on.

## Changes to earlier tests

- `src/canvas/notes.test.ts`: the tests of `mergeServerNotes` moved to `src/canvas/fresh.test.ts` (`mergeFresh`), unchanged
  in what they check (step 1).
- `src/domain/commands/label.test.ts` and `src/data/local/working-layer-store.test.ts`: `deleteLabel`'s result also names
  the live canvas it made normal (`liveCanvasId: null` there) (step 1).
- `src/data/local/model-store.test.ts`: `seed:large` also checks PERF-2's live canvas (step 1).
