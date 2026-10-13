# Slice 3b – Acceptance

Status: **step 5 done, waiting for Łukasz's manual acceptance**. Branch `slice/03b-context-and-live-canvases`, pull
request #10 (draft). Steps 0 to 4 were accepted one by one (below).

## Criteria

Each criterion has its Playwright test in `e2e/slice-03b/`, named after its id; every test starts from a freshly seeded
data file (the demo labels CR-23 and JIRA-481, no live canvas) and does not depend on another. Data a test starts from is
written as the server writes it (`liveWrite`: the command, then the live step; a label's live canvas with `openLiveFor`,
a label on an item with `labelItem`); what the criterion checks goes through the page with the real mouse and keyboard
and is read back from the data file.

| ID | Test | Result |
| --- | --- | --- |
| S3B-01 | `S3B-01.spec.ts`: the menu's heading, help, field and labels (CR-23 “4 items”, JIRA-481 “2 items”); “Create “cr-99”” first, Enter creates the label and turns the context on; button “Working on cr-99” (`aria-pressed`), the toast, “Working on cr-99, items labeled 0”; on after a reload; “cr-99 … active” first in the menu; “Stop working on cr-99”: “Working context switched off.”, off after a reload | passes |
| S3B-02 | `S3B-02.spec.ts`: with CR-23 on, renaming `customer_id` (labeled, every event of the group carries CR-23, one undo takes name and label away), adding `promo_code`, the mapping made by dragging `customers.segment` onto `segment_code`, `first_name`'s mapping made a transformation with a rule, a relationship drawn from Customer to Sales Order (Sales Order labeled, Customer not twice) and the Entity tool's new entity each get CR-23 | passes |
| S3B-03 | `S3B-03.spec.ts`: with CR-23 on, moving Customer (the context recorded, no label), “Fit width to names”, collapsing a frame, writing a note and deleting `segment_code` add no label; Alt+↓ on `first_name` labels `first_name` only, not the attribute renumbered around it (Q2) | passes |
| S3B-04 | `S3B-04.spec.ts`: Piotr and Kasia have no switch and no status part; Piotr's page clears a stale context, and his approval sent directly with CR-23 as context is refused (“As a reviewer you cannot change labels.”), status and links unchanged; JIRA-481 deleted by Anna while Łukasz works on it: his next change is refused and the fresh page switches the context off with “The working context JIRA-481 was deleted, so it is off now.”; deleting the active context's own label in its panel: “Deleted the label CR-23; the working context is off.”, Undo brings the label back, the context stays off | passes |
| S3B-05 | `S3B-05.spec.ts`: “Open as live canvas” in CR-23's panel makes one canvas CR-23 (toast), Customer full, web_users context with the labeled filter, a concept and a source frame holding every card; “Open live canvas” on the project home goes to it; from Order management “Go to its live canvas” adds it there (“Added the live canvas CR-23 to Order management.”) and opens it; still one live canvas | passes |
| S3B-06 | `S3B-06.spec.ts`: on CR-23's open live canvas, CR-23 put on the mapping into `customer_id` in its panel brings customers as context, to the right of the content and in no frame, with “Added from CR-23: customers.”; customers labeled directly becomes full with the filter `all`, one undo makes it context again; the mapping's label taken off: customers leaves with “No longer labeled: customers.”, one undo brings it back (an attribute panel opens only for a card on the canvas, so the element brought in is a table) | passes |
| S3B-07 | `S3B-07.spec.ts`: CR-23 put on `order_line.qty` on Customer & orders, and with the context on, `Sales Order.order_date` renamed there: the live canvas (not open) gets order_line and Sales Order as context; opened afterwards it shows both without the “Added from” toast | passes |
| S3B-08 | `S3B-08.spec.ts`: the live canvas's tab icon with its tooltip (one tab only), the overview's box with its text and “Open label” (opens the label's panel), the project home's tile icon (one tile only); on Customer & orders none of them | passes (the view-state bar's chip: slice 6) |
| S3B-09 | `S3B-09.spec.ts`: Sales Order as context: class `ctx`, `data-live="context"`, filter `labeled`, the tooltip, “context only”, a dashed outline, opacity 1; customers full (no `ctx`); `order_date` bold (class `lab`, weight 600); the mapping into `customer_id` faded (class `ctxline`, another stroke than the labeled mapping's, opacity and stroke opacity 1); “Labeled” in Customer's toolbox on the live canvas, not on Customer & orders | passes (“not counted as filtered”: slice 6) |
| S3B-10 | `S3B-10.spec.ts`: Order Line dropped from the left panel asks “Label Order Line with CR-23? It then appears on this live canvas.” (“Add CR-23”); “Cancel” changes nothing; Sales Order dropped and added: “Sales Order is now labeled CR-23.”, labeled, full, placed where dropped; the Entity tool asks nothing and its toast ends “, labeled CR-23”; on LIVE-1's live canvas (only Customer) “Add all” answers “On a live canvas, add cards one at a time: each one gets the label first.” and places nothing | passes |
| S3B-11 | `S3B-11.spec.ts`: Customer's toolbox “Remove from this canvas (unlabel)…” asks “Take the label CR-23 off Customer? It stays here as context, because 2 attributes and 1 mapping of it carry CR-23.” (“Remove CR-23”): the label comes off, Customer stays as context, one undo makes it full again; Delete on web_users asks “web_users is here because 1 mapping carries CR-23. Take the label off it?” (“Remove from 1 mapping”): the mapping's label comes off, web_users leaves, one undo brings it back | passes |
| S3B-12 | `S3B-12.spec.ts`: CR-23 renamed CR-24 renames its live canvas (tab); deleted: “Deleted the label CR-24. Its live canvas became a normal canvas.”, no live label, no live levels, no labeled filter; Undo brings label, links and live canvas back; Duplicate layout: “CR-24 (copy)” is a normal canvas with every card, the original stays live | passes |
| S3B-13 | `S3B-13.spec.ts` (2 tests): the miniature draws exactly the notes the canvas shows, by colour; without the resolved one when resolved notes are hidden; pans and zooms do not redraw it; a note's drag redraws it once, on the drop; a note in a collapsed frame is not drawn | passes |
| S3B-14 | `S3B-14.spec.ts`: Piotr and Kasia: “Open live canvas” on the project home opens CR-23's live canvas, NEW-1 (no live canvas) offers nothing; a click in the left panel and Delete ask nothing, the toolbox has no unlabel; the add, remove and open actions called directly are refused (“As a reviewer/reader you cannot …”) and change nothing | passes |
| S3B-15 | (a) `S3B-15-elements.spec.ts`, (b) the balanced sitting, (c) `S3B-15-live.spec.ts`, all in the measurement build (below); `S3B-15.spec.ts` checks the data (c) measures (PERF-2's 22 cards as `openLiveCanvas` makes them, drawn) and `S3B-15-idle.spec.ts` (d) the idle guard on a live canvas (canvas and miniature, at 100 % and 30 %) | (a) identical viewport counts; (b) +11.9 % at 100 % (level or 1–3 % faster read with the reference's second run), collapsed +23.3 %; (c) 59.3 against 48.2 fps; (d) passes, with S2C-12, S3A-14's idle test and S3B-13 |
| S3B-16 | CI (lint, typecheck, unit tests, the schema check), three full e2e runs in a row | below |

### Three full runs in a row

`npm run e2e` with no dev server running. The rule: three passing runs in a row, and after any test change the three
start again.

| Set | Commit | Runs | What happened |
| --- | --- | --- | --- |
| 1 | `3992e3f` | 3 of 3 passed: 141 tests each (113 files), 24.9, 24.9 and 25.1 min; no retries, no flaky test | The server's known “destination stream closed early” lines (23, 22, 16) |

Before the runs: `npm run lint`, `npm run typecheck` and `npm test` (820 tests in 56 files) pass.

## Manual checklist (Łukasz)

Fresh demo data, then the app on the preview data file:

PowerShell:

```powershell
$env:INFOMAPPER_DEV_DB=".data/preview-db.json"; npm run reset-dev-data; npm run seed:large; npm run dev
```

bash:

```bash
export INFOMAPPER_DEV_DB=.data/preview-db.json && npm run reset-dev-data && npm run seed:large && npm run dev
```

Sign in at http://localhost:3000/sign-in by picking a test user: **Anna Nowak** (modeler) unless a check says
otherwise, **Piotr Wiśniewski** (reviewer), **Kasia Zielińska** (reader). Retail Co – DWH → Customer 360 → Customer &
orders, unless a check says otherwise.

| ID | As | Steps | Expected |
| --- | --- | --- | --- |
| S3B-01 | Anna | Click the tag button left of Undo; type `cr-99`; Enter. Reload the page. Open the menu again, click “Stop working on cr-99”. Reload. | The menu: “Working context”, the help text, “Find or create a label, e.g. CR-23”, CR-23 and JIRA-481 with their item counts, then “Create “cr-99”” first. After Enter: the button reads “Working on cr-99” with a dot, the toast “Working on cr-99: everything you create or change …”, the status bar “Working on **cr-99**, items labeled **0**”. After the reload still on. After “Stop”: “Working context switched off.”, the button back to the tag icon; after the reload still off. |
| S3B-02 | Anna | Turn the context on for CR-23 (menu). Rename Customer's `customer_id` in its panel; Ctrl+Z. Add an attribute to Customer; drag `customers.segment` onto `segment_code`; make `first_name`'s mapping a transformation with a rule; draw a relationship from Customer to Sales Order (relate button on Customer's header, click Sales Order); create an entity with the Entity tool (E). | After each change the item carries CR-23 (its Labels field, the tag mark on the row or header, the line's tag; the relationship: Sales Order's header). Ctrl+Z after the rename takes the name and the label away together. The status bar's count grows. |
| S3B-03 | Anna | With CR-23 on: move a card, “Fit width to names”, draw a frame and collapse it, write a note, delete an attribute without mappings, move an attribute with Alt+↓. | Only the moved attribute gets CR-23; nothing else gets a label (status count +1 at the end only). |
| S3B-04 | Piotr, Kasia, Anna, Łukasz | As Piotr and as Kasia: open the canvas. As Łukasz: turn the context on for JIRA-481; as Anna (another browser or private window) delete JIRA-481 in its panel; as Łukasz rename an attribute. As Łukasz: turn the context on for CR-23, open CR-23's panel (a label chip → open), “Delete label”, then Undo in the toast. | Piotr and Kasia: no tag button left of Undo, nothing about a context in the status bar. Łukasz's rename is refused and the toast “The working context JIRA-481 was deleted, so it is off now.” appears; the button is off. Deleting CR-23: one toast “Deleted the label CR-23; the working context is off.” with Undo; Undo brings CR-23 back, the context stays off. |
| S3B-05 | Anna | Open CR-23's panel; “Open as live canvas”. Go to the project home; “Open live canvas” on CR-23's row. Open Order management → Order lines & products, open CR-23's panel (from its label list on the home, or a chip), “Go to its live canvas”. | A new tab CR-23 with the tag icon opens with the toast “Live canvas for CR-23. It follows the label: …”: Customer (full) and web_users (dashed, “Labeled” filter) in a concept frame and a source frame. The home's button goes to the same canvas. From Order management: “Added the live canvas CR-23 to Order management.” and the canvas opens there; there is still only one CR-23 canvas. |
| S3B-06 | Anna | On CR-23's live canvas: select Customer's `customer_id` row, open its mapping, add CR-23 in the mapping's Labels field. Then select the new customers card and add CR-23 in its Labels field; Ctrl+Z. Then take CR-23 off the mapping again (×); Ctrl+Z. | customers appears to the right of the content, dashed, with “Added from CR-23: customers.” Labeled directly it becomes solid with all rows; Ctrl+Z makes it dashed again. Without the mapping's label it leaves with “No longer labeled: customers.”; Ctrl+Z brings it back. |
| S3B-07 | Anna | With CR-23's live canvas made (S3B-05), go to Customer & orders: add CR-23 to `order_line.qty`; turn the context on for CR-23 and rename `Sales Order.order_date`. Then open the CR-23 tab. | The live canvas shows order_line and Sales Order (dashed, to the right), and no “Added from” toast when it opens. |
| S3B-08 | Anna | Look at CR-23's live canvas with nothing selected, its tab, the project home's tiles; then at Customer & orders. | The tab has the tag icon (“Live canvas: shows everything labeled CR-23”); the right panel starts with the dashed box “This is the live canvas for CR-23. …” and “Open label” (opens the label); the CR-23 tile has the tag icon. Customer & orders has none of them. (The view-state bar's chip comes with slice 6.) |
| S3B-09 | Anna | On CR-23's live canvas after S3B-06/07: look at a context card, its rows and the lines; hover a context card; right-click an entity card (Rows). Right-click an entity card on Customer & orders. | Context cards: dashed outline, light header, “context only” (entities), the tooltip “Context: the entity itself is not labeled CR-23, only some of its attributes are”; labeled rows bold; mappings without CR-23 lighter in colour (not see-through); “Labeled” among the Rows choices on the live canvas only. |
| S3B-10 | Anna | On CR-23's live canvas: drag Order Line from the left panel onto the canvas, “Cancel”; drag Sales Order (if not there) onto the canvas, “Add CR-23”. Use the Entity tool once. Open a live canvas of a label only on Customer (e.g. put a new label on Customer, “Open as live canvas”), select Customer, “Add all” in its feeding sources. | The question “Label Order Line with CR-23? It then appears on this live canvas.”; Cancel changes nothing. Add: “Sales Order is now labeled CR-23.” and the card where it was dropped. The Entity tool asks nothing; its toast ends “, labeled CR-23”. “Add all”: “On a live canvas, add cards one at a time: each one gets the label first.” |
| S3B-11 | Anna | On CR-23's live canvas: right-click Customer's header, “Remove from this canvas (unlabel)…”, “Remove CR-23”; Ctrl+Z. Select web_users, press Delete, “Remove from 1 mapping”; Ctrl+Z. | Customer: “Take the label CR-23 off Customer? It stays here as context, because 2 attributes and 1 mapping of it carry CR-23.”; Customer turns dashed; Ctrl+Z makes it solid. web_users: “web_users is here because 1 mapping carries CR-23. Take the label off it?”; it leaves; Ctrl+Z brings it back. |
| S3B-12 | Anna | Open CR-23's panel, rename it to CR-24. “Delete label”; Undo in the toast. Duplicate the live canvas's layout (tab menu “Duplicate layout”). | The tab becomes CR-24. Deleting: “Deleted the label CR-24. Its live canvas became a normal canvas.”; the tab loses its icon, dashed cards turn normal with all rows. Undo: label, marks and the live canvas back. The copy “CR-24 (copy)” has no tag icon and no dashed cards. |
| S3B-13 | Anna | On Customer & orders look at the Overview (bottom right); untick “Show resolved notes on the canvas”; pan and zoom; drag a note. Collapse a frame that holds a free note. | The miniature shows the notes as small coloured rectangles under the cards; the resolved one goes when hidden; panning does not flicker it; the dragged note moves in the miniature when dropped; a note in a collapsed frame is not drawn. |
| S3B-14 | Piotr, Kasia | Project home: CR-23's row and a label without a live canvas. Open CR-23's live canvas; click an entity in the left panel; right-click a card; select a card and press Delete. | “Open live canvas” on CR-23's row (it opens the live canvas), nothing on the other row; no question on the click, no “unlabel” in the toolbox, nothing on Delete. |

**Scenario (PRD's Definition of done).** As **Łukasz**: turn the context on for CR-23; create an entity with the Entity
tool, add an attribute to it, map a column onto it by dragging, draw a relationship from it to Customer; open CR-23's
panel and “Open as live canvas”. Go to Customer & orders and label `order_line.qty` CR-23 there; back on the CR-23 tab
it is there, to the right of the content. On the live canvas drag Order Line from the left panel and “Add CR-23”, then
right-click it and “Remove from this canvas (unlabel)…”. Open CR-23's panel, “Delete label” (one toast: deleted, the
context off, the live canvas normal), Undo. Finally look at the notes in the Overview of Customer & orders.

## Proposed changes to `docs/decisions.md` (not applied; for Łukasz to approve)

- **D-10** (append): “A label has at most one live canvas. Opening it makes a canvas named after the label in the
  current project, its elements arranged into frames by concept and system; elements that become labeled later land to
  the right of the content (no “Newly labeled” frame yet). Deleting the label turns its live canvas into a normal canvas
  in the same undo step; Duplicate layout of a live canvas gives a normal canvas.”
- **D-11** (append): “Adding a card there labels its element in the same undo step (the Entity tool without a question);
  removing one takes the label off the element, or off the rows and mappings that bring it there when it is a context
  card. Bulk adds and removing several cards are not offered. Owners, admins and modelers do this; reviewers and readers
  see a live canvas read-only.”
- **D-25** (append): “Context cards have a dashed outline, a light header and “context only”, and show their relevant
  rows (the Labeled filter); relevant rows are bold; mappings without the label are faded by colour, never opacity.”
- **D-26** (append): “The context is a per-person, per-workspace preference in the browser, sent with every write; the
  server checks it (the label exists, the person may change labels) and records it on every change event of the group.
  Only owners, admins and modelers have the switch. Moving an attribute labels only the moved attribute. A change the
  context would label is refused when its label is gone, and the browser switches the context off; undo and redo never
  label.”
- **D-39** (append): “A live canvas's “Live: {name}” chip and its Labeled filter (not counted as filtered, kept by “Show
  all”) belong to the view-state bar.”
- **D-03** (append): “The Overview's miniature also draws the visible notes in their paper colour, under the cards.”
- **AD-13** (append): “A change group's change events carry the active working context's label (`context_label_id`).”

## Step 5 (acceptance tests and wrap-up, 13 October)

1. **handlebars:** `eslint-plugin-boundaries` is still 7.2.0 (last change 9 August) and `@boundaries/elements` 3.1.1 still
   pins `handlebars` 4.7.9; no fix, before 19 October: nothing changed (Łukasz decides between waiting and a small pull
   request after the merge).
2. **The warm-up rule** (CLAUDE.md, measuring): a sitting starts with one discarded run after the builds, then balanced
   rounds. The two cases: in slice 3b's balanced sitting after step 4 the first side measured after the builds
   (`slice-03a`, round 1) was slow at the overview too (48.6 against 58.6 fps in its second run) and made the branch look
   12 % faster at 100 %; in slice 3a the laptop's state drifted within a sitting (C-08 1502 ms on the reference, 1512 ms
   on the branch, then 1701 and 1761 ms in the runs that followed), which put the side measured second behind. A
   warm-up and balanced rounds address both.
3. **S3B-06's element** is a table brought in through a mapping's Labels field, not an entity through an attribute's: an
   attribute panel opens only for a card on the canvas (`S3B-06.spec.ts` says so).
4. **Test data through the live step:** slice 3a's `asUser` applies a command's writes as they are; data that must
   follow live canvases is written with `liveWrite` (the command, then `completeLiveWrites`, as `runCommand` does).
5. **The context in tests** is switched on as the browser does it, by its cookie (`contextOn`); S3B-01 checks the switch
   itself.

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

17. **No view-state bar yet** (Łukasz after step 3). The “Live: {name}” chip and “the Labeled filter is not counted as
    filtered, Show all leaves it” (items 8, 9) belong to the view-state bar slice (slice 6, D-39); the PRD, S3B-08,
    S3B-09 and `docs/known-limitations.md` say so.
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

### After step 3: the jump to the workspace home (review, 12 October)

Observed once in the browser after a removal on a live canvas; not seen again, neither in my second try nor in Łukasz's
manual tests on the preview data (removals by Delete, toolbox and panel, direct and context cards, a fast add then
remove, a live canvas emptied card by card, with undo). The server log showed `GET /` (307) and then the workspace home.

Code review of every way to the workspace home:

| Where | What | When | Could a removal on a live canvas cause it? |
| --- | --- | --- | --- |
| `src/app/page.tsx` | `redirect(workspaceHref(…))` | a visit of `/`: the last workspace (cookie), else the first | only if something goes to `/`; nothing in the app links or pushes to `/` |
| `src/app/_actions/session.ts` | `redirect("/")` | after signing in as a test user | no (only the sign-in page calls it) |
| `src/app/_lib/session.ts`, `src/proxy.ts` | redirect to `/sign-in` | no session | no, and it goes to the sign-in page, not the home |
| `src/app/_lib/shell.ts` | `notFound()` | unknown workspace, not a member, unknown project, canvas not found | a 404 page, never a redirect; the removal and its sync change cards and label links only, never the canvas, its project link or the project |
| `src/app/_lib/shell.ts` | redirect to a canvas of the project (`?moved=1`, or the next canvas after one's own action) | the canvas is not in the project | no: the live canvas keeps its project link (removing a card never removes it) |
| top bar and breadcrumbs | links to the workspace home (“Workspace home”, the workspace and organization crumbs) | a click | only by a click |
| client router pushes | canvas pages only (tabs, canvas menu, “On canvases”, open live canvas, new project or canvas) | after the person's action | no push goes to `/` or a workspace home |
| error boundaries | none (`error.tsx`, `not-found.tsx`, `global-error.tsx` do not exist) | – | – |

No plausible path from a removal was found. Most likely the browser tool caused it (the request was `/` itself, which
only a sign-in or a typed address asks for). Kept in view in the step 5 runs.

### After step 3: S3B-15 (a) and the quick round (12 October, at `35bd0f3`)

**S3B-15 (a), elements** (measurement build of the branch, the same spec as the baseline; `.data/measure/s3b15-step3/branch.json`):

| View | Viewport: `slice-03a` | Viewport: branch | Whole page: `slice-03a` | Whole page: branch |
| --- | --- | --- | --- | --- |
| 100 %, frames expanded | 19,295 | 19,295 | 20,679 | 20,697 |
| 30 %, frames expanded | 4,498 | 4,498 | 5,882 | 5,900 |
| 100 %, frames collapsed | 4,905 | 4,905 | 6,209 | 6,227 |
| 30 %, frames collapsed | 1,463 | 1,463 | 2,767 | 2,785 |

The viewport counts are equal: met. The whole page has 18 more elements in each view, PERF-2's tab in the tab bar.

**Quick round** (`npm run measure:canvas -- --quick --rounds 1 --against slice-03a`, sitting `.data/measure/2026-10-12-19-53`):

| Figure | Bar | slice-03a | This branch | Change |
| --- | --- | --- | --- | --- |
| Pan and zoom at the overview | ≥ 50 fps | 56.4 | 59.1 | +4.8 % |
| – frames over 50 ms | 0 | 0 | 0 | – |
| Pan and zoom at 100 %, dense area | ≥ 50 fps | 40.7 | 32.4 | −20.4 % |
| – frames over 50 ms | 0 | 9 | 15 | – |
| Initial render (C-08), median of 5 | ≤ 1500 ms | 2115 | 1919 | −9.3 % |
| Hover (C-10), median of 40 | ≤ 100 ms | 143 | 116 | −18.8 % |
| Lasso marks, median of 20 | ≤ 100 ms | 31 | 46 | +46.2 % |

**Reading: disturbed, not usable.** `slice-03a` itself is far below every earlier sitting (100 %: 40.7 against
48.6–52.5; C-08: 2115 against 1384–1512 ms), so the laptop was slower in this sitting; a one-round sitting measures the
reference first and the branch second, so a machine that slows down puts the branch behind (slice 3a's lesson). My
browser pane still held a tab (hidden, its server stopped); closed now. The element counts in the viewport are equal,
and the code a normal canvas runs while panning did not change in this slice; still, the round says nothing either way.
Reported to Łukasz before going on.

## Step 4 (miniature and permissions, 12 October)

**Item 15, notes in the miniature.** The Overview draws each note the canvas shows (not hidden resolved ones, not those
in a collapsed frame) as a rounded rectangle in its paper colour (prototype `NOTE_MINI`), under the cards: one element
per visible note, outside the canvas viewport. The miniature's data stays stable while panning and zooming (the notes
come from the canvas's shown notes, which only change when a note or what it is pinned to changes); while anything is
dragged it keeps the notes as they were, and it takes them again only when they look different, so a note's drag
redraws it once, on the drop (the save's new version alone does not). In development each commit of the miniature is
counted in `window.__imMiniatureCommits`.

**The check** (`e2e/slice-03b/S3B-13.spec.ts`, two tests, written now as S3B-13's test): on Customer & orders the
miniature draws exactly the notes the canvas shows, by colour; unticking “Show resolved notes” takes the resolved one
out; six wheel pans and eight Ctrl+wheel zoom steps leave the commit count unchanged; a note dragged with the real
mouse leaves it unchanged during the drag and raises it by exactly one after the drop; a free note in a collapsed frame
is not drawn. Both pass.

**Item 16, permissions.** Already in place from steps 1 and 3 (domain refusals: making a live canvas needs “create
canvases”, adding it to a project “change a canvas's projects”, labeling and unlabeling “change labels”, placing a
card “change what is on a canvas”; reviewers and readers may go to a live canvas the project has; the label panel and
the home show only what the person may do). Added now: on a live canvas a reviewer's or reader's click in the left
panel, drop or Delete opens no question (the canvas offers no add or remove there). The step 5 test S3B-14 checks it
end to end.

**S3B-15 (c), a measuring spec** (`e2e/slice-03b/S3B-15-live.spec.ts`, measurement build only, left out of the normal
run): 10 s of S1A-14's pan and zoom at 100 % on PERF-2's live canvas (centred on its content) and on “Performance test”
(S1A-14's dense area), in turns (Performance test, live, live, Performance test), medians to
`test-results/S3B-15-live.json`. A smoke run on the unprepared laptop worked (22 cards; 57.5 against 40.4 fps, not to be
read).

Checks: lint, typecheck, 820 unit tests, one full e2e run 126/126 (24.3 min, the known noise 14 times).

## S3B-15 (b) and (c): the balanced sitting after step 4 (13 October, at `f15fe1c`)

Łukasz prepared the laptop (restarted, idle 10 minutes, mains power, Best performance, Windows Update and OneDrive
paused, Settings and Task Manager closed, idle CPU checked). Production measurement builds, headed Chrome, 1536 × 864;
`slice-03a` (`8a52155`) in `../infomapper-ab-main`; two rounds per sitting, each side first once.

**Frames expanded**, sitting `.data/measure/2026-10-13-05-39`:

| Figure | Bar | slice-03a | This branch | Change | Result |
| --- | --- | --- | --- | --- | --- |
| Pan and zoom at the overview | ≥ 50 fps | 53.6 (48.6–58.6) | 59.3 (59.0–59.5) | +10.5 % | met |
| – frames over 50 ms | 0 | 1 | 0 | – | met |
| Pan and zoom at 100 %, dense area | S3B-15 (b): no more than 3 % below | 44.0 (39.8–48.2) | 49.3 (48.8–49.7) | +11.9 % | met |
| – frames over 50 ms | 0 | 12 | 9 | – | not met (as before) |
| Initial render (C-08), median of 5 | ≤ 1500 ms | 1536 | 1510 | −1.7 % | not met (both sides, as before) |
| Hover (C-10), median of 40 | ≤ 100 ms | 118 | 117 | −0.6 % | not met (as before) |
| Lasso marks, median of 20 | ≤ 100 ms | 27 | 27 | +1.1 % | met |

By round (100 %, fps / frames over 50 ms): round 1 `slice-03a` 39.8 / 12, branch 48.8 / 9; round 2 branch 49.7 / 9,
`slice-03a` 48.2 / 12. `slice-03a`'s first run was the first side of the sitting, right after the builds, and was slow
at the overview too (48.6 against 58.6 in its second run): a warm-up. Read with its second run only, the branch is
level with `slice-03a` or slightly faster (+1 to +3 %), not 12 %; either way S3B-15 (b) is met.

**All frames collapsed** (`--branch-diag collapsed`), sitting `.data/measure/2026-10-13-05-57`:

| Figure | slice-03a (expanded) | This branch (collapsed) | Change |
| --- | --- | --- | --- |
| Pan and zoom at the overview | 59.3 | 60.0 | +1.2 % |
| Pan and zoom at 100 % | 48.7 (9 long frames) | 60.0 (0) | +23.3 % |

Collapsed matches slice 2c and 3a: met.

**S3B-15 (c), PERF-2's live canvas** (`e2e/slice-03b/S3B-15-live.spec.ts`, the branch's build of the expanded sitting,
`.data/measure/s3b15-live/2026-10-13.json`): in turns, Performance test 49.5 fps (5 frames over 50 ms), live 59.4 (0),
live 59.3 (0), Performance test 46.9 (5). Medians: **live 59.3 against Performance test 48.2 fps**: met (the live
canvas has 22 cards).

**S3B-15 (d)**: S2C-12, S3A-14's idle test and the miniature's check (S3B-13) passed in the full runs; the idle test on
a live canvas comes with step 5.

## Changes to earlier tests

- `src/canvas/notes.test.ts`: the tests of `mergeServerNotes` moved to `src/canvas/fresh.test.ts` (`mergeFresh`), unchanged
  in what they check (step 1).
- `src/domain/commands/label.test.ts` and `src/data/local/working-layer-store.test.ts`: `deleteLabel`'s result also names
  the live canvas it made normal (`liveCanvasId: null` there) (step 1).
- `src/data/local/model-store.test.ts`: `seed:large` also checks PERF-2's live canvas (step 1).
- `src/canvas/canvas.test.ts`: “shows a stored 'labeled' filter as All until labels exist” is now “… outside a live
  canvas” (step 3).
- `e2e/slice-03b/S3B-15-elements.spec.ts`: compares only the viewport counts with the baseline (step 3).
- `playwright.config.ts`: the normal run also leaves out `S3B-15-live.spec.ts` (step 4).
