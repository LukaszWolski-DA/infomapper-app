# Slice 3b – Acceptance

Status: **step 3 done, waiting for Łukasz** (the S3B-15 element count and quick round after his OK). Branch `slice/03b-context-and-live-canvases`, pull request #10 (draft). Steps are
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

12. **Where the context is kept (Q1).** A cookie per person and workspace: its name holds both ids
    (`im-ctx.{user id}.{workspace id}`, path `/`), its value the label id and its name. Two workspaces in one browser
    (or two test users) keep separate contexts, because the server reads only the cookie named after the signed-in
    person and the workspace of the write. Written only by the browser, so every server action carries it without each
    call passing it; read in `runCommand` (`src/ui/working-context-cookie.ts`). Never written by the server, not in the
    data. Undo and redo ignore it.
13. **Which writes it covers, and the switch on canvas pages only.** Every write through `runCommand` while it is on. No
    write outside canvas pages creates or changes entities, attributes, mappings or relationships (Łukasz's question
    after step 2): the workspace home creates workspaces and projects and changes settings, the project home creates,
    renames, adds, removes, duplicates and deletes canvases and pins labels; the model is edited only in the canvas
    page's panels and canvas. So the switch stays on canvas pages, next to Undo, as in the prototype. A layout-only
    write with the context on loads only the labels (to check the context and record it), not the whole live state.
14. **A deleted context label** (changed after step 2). Only a write the context would label is refused
    (`CONTEXT_LABEL_GONE`, or the role may not label); any other write is saved without the context, so pages without
    the switch (the homes) never get stuck. The refused write refreshes the page; the browser sees the label gone and
    switches the context off with “The working context {name} was deleted, so it is off now.” Deleting the context's
    own label in its panel switches the context off first, quietly, and shows one toast: “Deleted the label {name}; the
    working context is off.” with Undo; Undo (the button or Ctrl+Z) brings the label back, the context stays off.
    Checked in the browser; the app types the menu's search once (the doubled “cr-99cr-99” of step 2 was my browser
    tool typing a second time after a screenshot taken before the menu had rendered).
15. **Roles.** Only owners, admins and modelers get the switch (they change labels, AD-05); a reviewer's or reader's
    stale cookie is cleared by the page. An archived workspace has no switch.
16. **The menu.** Opens in a portal under the button (the top bar would clip it). “Create “{name}”” creates the label
    (one undo step) and turns the context on.

## Step 3 (live canvases, 12 October)

What was built (PRD items 5–14): “Open as live canvas” / “Go to its live canvas” in the label panel and “Open as live
canvas” / “Open live canvas” on the project home's label list, with the prototype's toasts (made, or added to this
project); the tag icon with “Live canvas: shows everything labeled {name}” on the canvas tab and the project tile; the
overview's dashed box with “Open label”; context cards (a class on the card: dashed outline, light header, “context
only”, the tooltip), relevant rows bold (a class on the row), the Labeled filter for a live canvas's entity cards (card
button and the toolbox's Rows), mappings that do not carry the label faded by colour (`color-mix`, no opacity); adding
a card asks “Label {name} with {label}? …” (a drop places it where dropped, a click in the left panel or a single
feeding source labels the element and the sync places it to the right; toast “{name} is now labeled {label}.” with
Undo), the Entity tool labels at once (toast “…, labeled {name}”); “Remove from this canvas (unlabel)…” (toolbox,
panel, Delete) asks the direct or context question and unlabels (toasts as the prototype, with Undo); bulk adds answer
the prototype's toast and “Show its sources”, “Add sources of selected entities” and removing several cards are not
offered; the sync's “Added from {label}: …. No longer labeled: ….” on the open live canvas only; deleting a label with
a live canvas adds “Its live canvas, if any, became a normal canvas.”

Checks: lint, typecheck, 820 unit tests, one full e2e run 124/124 (22.5 min, the known noise 14 times). Browser check on
the preview data: CR-23's live canvas opened from its panel (WEB and Customer frames, web_users as a context card with
the Labeled filter and the tooltip, Customer full, its mapping not faded, `email` and `segment_code` bold), Customer
Address added by a click (question, label, placed to the right of the frames), taken off with Delete (question, label
off, card gone). Once, after a removal, the tab went to the workspace home; it did not happen again in a second try with
the same steps (no error in the console or the server log; likely my browser tool), to watch in the step 5 tests.

### Assumptions

17. **No view-state bar yet.** The PRD's “Live: {name}” chip in the view-state bar and “not counted as filtered / Show
    all leaves it” (items 8, 9) need the view-state bar (D-39), which earlier PRDs put in slice 6; it does not exist.
    Not built; question for Łukasz.
18. **Who may open.** Anyone who sees the workspace may go to a live canvas the project has; adding it to this project
    needs “change a canvas's projects”, making one “create canvases” (owners, admins, modelers). The label panel's and
    the home's buttons show only what the person may do.
19. **The remove question is the page's.** For each card of a live canvas the page computes once (domain:
    `liveRemoveQuestion`) whether the label is on the element and what of it carries the label; the canvas only shows
    it. The answer runs `removeFromLiveCanvas` on the data as it is then.
20. **The sync's toast** comes from the server's memory of what this person's writes changed on live canvases in the
    last minute (`src/app/_lib/live-notices.ts`, like the undo history); the open live canvas shows notices newer than
    those it found when it opened, so a canvas opened later shows none (S3B-07). Right after the person's own add or
    remove on that canvas it is left out (that action has its own toast).
21. **Placement of a click-add** is the sync's (to the right of the content), as the PRD says (“where dropped, else
    through the sync”); the card is selected only by a drop.
22. **The S3B-15 count spec** compares the viewport counts with the baseline; the whole page differs by the second tab
    `seed:large` now has (PERF-2's live canvas).

## Changes to earlier tests

- `src/canvas/notes.test.ts`: the tests of `mergeServerNotes` moved to `src/canvas/fresh.test.ts` (`mergeFresh`), unchanged
  in what they check (step 1).
- `src/domain/commands/label.test.ts` and `src/data/local/working-layer-store.test.ts`: `deleteLabel`'s result also names
  the live canvas it made normal (`liveCanvasId: null` there) (step 1).
- `src/data/local/model-store.test.ts`: `seed:large` also checks PERF-2's live canvas (step 1).
- `src/canvas/canvas.test.ts`: “shows a stored 'labeled' filter as All until labels exist” is now “… outside a live
  canvas” (step 3).
- `e2e/slice-03b/S3B-15-elements.spec.ts`: compares only the viewport counts with the baseline (step 3).
