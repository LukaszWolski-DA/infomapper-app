# Slice 16 – InfoMapper's canvas and menus

Status: **proposed** (Łukasz, 6 November 2026). Branch `slice/16-canvas-menus`, from `main` at tag `slice-15d`
(assumption A1). PRD file: `docs/prd/slice-16-canvas-menus.md`; step 1 writes `docs/prd/slice-16-acceptance.md`. Test
regime: CLAUDE.md, "Testing" (a full run is the GitHub Actions workflow's run on the commit the report names). Step 1
checks this PRD against the code (CLAUDE.md, "How we work").

This PRD was written from the docs at slice 15d's closing and from the prototype changed for this slice, **without
reading the code**. The prototype (`docs/prototype/infomapper-prototype-with-sources.html`) comes with this PRD in its
new version: it shows items 1 to 3 and 7.

## 1. Why this slice

Seven items from Łukasz's testing of slice 15c and of this slice's prototype, and from the first full runs in GitHub
Actions (`docs/ideas.md`, "InfoMapper's canvas and menus: a slice after slice 15"). Four are small features a modeller
misses every day; three are bugs found on Linux, known limitations since chore CI e2e. All seven are InfoMapper's, work
at every model level, and need no new table and no new local file format.

**Agreed with Łukasz on 6 November 2026:**

- **P1. One slice, not split.** The items are small; a split would only add runs.
- **P2. The prototype shows items 1 to 3 and 7;** items 4 to 6 are the app's bugs and need no prototype change.
- **P3. The relationship switches sit in a canvas tab's menu,** beside the look (background, grid), with a chip in the
  view-state bar (D-39) for a hidden kind. The top bar has no room (item 5).
- **P4. The switches only filter within the layer modes that show relationships** (Everything, Relationships). The
  layer modes stay as they are (D-22); Mappings stays without relationship lines. The idea "Source relationships: a
  layer switch of their own" (slice 10b, `docs/ideas.md`) is closed as replaced by item 3.
- **P5. Tab order is an undo step;** it is the project's data (`project_canvas.sort_order`), not a view.
- **P6. The fixes of items 4 to 6 as the known limitations propose them** (`docs/known-limitations.md`, "A right-button
  pan opens the toolbox on Linux and macOS", "The top bar overflows by 1 px at 1,201 px on Linux", "The canvas saves
  its view about 150 ms late").

- **P10. No browser context menu in the app's own surfaces** (item 7; Łukasz, 6 November 2026: the browser's Back,
  Reload and the like break the app's concept). It stays where it helps: text fields and the description editor (paste,
  spelling suggestions), selected text (copy) and links (open in a new tab).

**Proposed, to confirm in step 1:**

- **P7. Rights.** "Add attribute" for those who may edit the model (as the entity panel's button). Moving a tab for
  those who may rename a canvas. The relationship switches as the layer: an editor's choice is saved with the canvas,
  a reviewer's or reader's is their own and not saved, if that is how the layer works today (Q3).
- **P8. "Use this look on all canvases" does not copy the switches,** as it does not copy the layer (to check, Q3).
  "Duplicate layout" copies them, as it copies the layer.
- **P9. A chip shows whenever a kind is switched off,** also in the Mappings layer where no relationship line shows:
  the chip says what the canvas keeps hidden, so switching back to Everything holds no surprise.

## 2. Sources

- **Prototype** (new version, with this PRD): the card header's menu (`ctxFor`, "Add attribute" above "Link to a
  requirement…"; `addAttr`), a canvas tab's menu (`openMenu`: "Move left" to "Move to end", section "Relationship
  lines"; `moveDia`, `relHidden`), the lines (`renderLines`: `srel`, `srcRect`), the view-state bar (`viewState`, "Show
  all"). The prototype now draws source relationships, simplified (no self loop, no live canvas), only so that the second
  switch can be tried: the app's lines follow D-62.
- **Decisions:** D-12 (the look outside undo), D-22 (layer modes per canvas), D-28 (a canvas in several projects), D-39
  (the view-state bar), D-54 (side panels, the remembered view), D-61 (self relationship), D-62 (source relationships on
  the canvas), D-70 (dimensional relationships are relationships between entities at their level).
- **`docs/known-limitations.md`:** the three entries of items 4 to 6, with files and lines.
- **`docs/prd/chore-ci-e2e-acceptance.md`:** the diagnoses of S2B-06, S6A-10, S5A-07 and S6A-11 (step 2, the late save).
- **`docs/ideas.md`:** the slice's entry; "Source relationships: a layer switch of their own" (slice 10b).

## 3. What to build

1. **"Add attribute" in a card header's menu.** On an entity card's header menu (logical and dimensional), above "Link
   to a requirement…": the same command as the entity panel's "Add attribute", a new attribute with its name selected
   for typing in its panel, one undo step. Not in an attribute row's menu, not on table cards, not for those who may not
   edit the model, refused in an archived workspace. A collapsed card or a row filter that would hide the new row does
   not stop it: the panel opens on the new attribute.
2. **The canvas tabs' order from a tab's menu.** "Move left", "Move right", "Move to start", "Move to end", after
   "Duplicate layout"; an item that would not move the tab is disabled; with one canvas in the project the four items
   are not shown. It changes `project_canvas.sort_order` in the current project only (a canvas may be in several, D-28),
   one undo step each ("Move canvas"). The project home's canvas tiles follow the same order.
3. **Relationship lines shown or hidden by kind.** A canvas tab's menu, after "Use this look on all canvases", gets a
   section "Relationship lines" with two check items, "Between entities" and "Between source tables".
   - "Between entities": every relationship between entities at either level (logical and dimensional), the self loop
     (D-61) and the relationship bundles of collapsed frames.
   - "Between source tables": the source lines of D-62.
   - Kept per canvas as two keys in `canvas.look` (D-12: outside undo, as the layer). A hidden kind is a chip in the
     view-state bar, "Entity relationships hidden" or "Source relationships hidden", removed by its × or by "Show all".
   - They filter within Everything and Relationships; in Mappings no relationship line shows anyway (P4, P9).
   - Requirement trace lines, mappings and dimensional mappings are unaffected. The miniature is unchanged (it already
     leaves source lines out).
4. **A right-button pan never opens the toolbox** (Linux, macOS). The toolbox opens on the right button's release when
   the press did not move more than `CLICK_SLOP`; a `contextmenu` that comes before the release is ignored for the
   toolbox. Windows behaves as today. The keyboard's context menu key (and Shift+F10) still opens the toolbox where it
   does today. S2B-06's split test loses its `test.fail`.
5. **The top bar does not depend on font metrics.** The working context's label (`button-context`,
   `working-context.tsx`) becomes the bar's flexible item: it may shrink and the browser truncates it, the full name
   stays its tooltip, instead of the fixed `max-w-[90px]` step. S6A-10's split test loses its `test.fail`; nothing is cut
   off from 800 to 2,560 px (slice 6a's rule).
6. **The canvas saves its view without the late save.** The app's own view changes (the first view on open, `shiftView`
   with the left panel, the fit) save the view at once, with the left edge of that moment; `onMoveEnd` saves only after
   the person's own moves. The helpers `viewStored` stay in S5A-07 and S6A-11 (they still describe what the tests wait
   for). The known limitation is closed.
7. **No browser context menu in the app's own surfaces.** One listener on the document cancels the browser's context
   menu everywhere (canvas pages, homes, the top bar, the tab bar, the breadcrumbs row, both panels, dialogs), except
   on text fields, `select`, the description editor (`contenteditable`), links, and a right click on selected text. A
   right click where the app has a menu opens it as today (the canvas's toolbox, a card's or a line's menu); elsewhere
   nothing happens. Back and Reload stay on the keyboard (Alt+←, F5) and in the app's own Back and Forward buttons.
   (Fact, not a choice: Firefox's Shift+right-click still opens its menu.)

## 4. Steps

Stop after each step with a short summary of what changed and how to check it. Wait for Łukasz before the next. A new
Claude Code session may start at a step's boundary, never inside a step; it starts by reading CLAUDE.md, this PRD and
`slice-16-acceptance.md`.

1. **Critical review** (section 7). Answer Q1–Q10 in `docs/prd/slice-16-acceptance.md`. Copy the prototype from
   Łukasz's Downloads (checked with `cmp` and SHA-256). No application code. Stop.
2. **The fixes** (items 4 to 6). Specs: S16-07 to S16-09, the earlier specs of the canvas's pointer modes, the toolbox,
   the top bar's widths, the remembered view and the side panels; CI. Single-file checks on the runner with `rounds 3`
   for S2B-06, S6A-10, S5A-07, S6A-11 and the new specs, and S2B-06 once locally on Windows. No full run. Stop.
3. **The features** (items 1 to 3 and 7), the measurement (section 6), the closing docs (section 10) with D-71's text after
   Łukasz's approval, then **one full run** on the final commit: it counts for the canvas's shared code (items 3, 4 and 6)
   and as the run before the merge. Stop with the manual acceptance steps.
4. **Łukasz's manual acceptance.** A fix found there gets its own full run. Merge and tag `slice-16` only on Łukasz's
   command.

Back up Łukasz's KB (`.data/dev-db.json` to `.data/backups/`) before the first dev or e2e run; no format change is
expected (Q8).

## 5. Acceptance criteria

Tests in `e2e/slice-16/`, one file per criterion, each from a fresh seed; unit tests next to the code.

| ID | Criterion |
| --- | --- |
| S16-01 | **Add attribute from the header.** Customer's header menu shows "Add attribute" above "Link to a requirement…"; it adds `new_attribute` with its name selected in its panel; one undo removes it. The same on a dimension's card (InfoCube on). |
| S16-02 | **Where it is not.** Not in an attribute row's menu, not on a table card, not for a reviewer or a reader (a direct call refused), refused in an archived workspace. |
| S16-03 | **Tab order.** With three canvases, the last tab's "Move to start" puts it first, "Move right" moves it one place; the items that would not move it are disabled; with one canvas the four items are not shown. Each move is one undo step; the order stays after a reload; the project home's tiles follow it. |
| S16-04 | **Order per project.** A canvas in two projects moved in one keeps its place in the other. |
| S16-05 | **Entity relationships hidden.** "Between entities" off hides the logical, dimensional and self relationships and the bundles of a collapsed frame; source lines, mappings and trace lines stay. The chip "Entity relationships hidden" shows; its × brings them back. Not an undo step; kept after a reload; another canvas is unchanged. |
| S16-06 | **Source relationships hidden.** "Between source tables" off hides D-62's lines; the chip "Source relationships hidden" shows. With both off, "Show all" brings both back. In Mappings both chips still show while switched off (P9). "Duplicate layout" copies the switches; "Use this look on all canvases" does not (P8). |
| S16-07 | **Right-button pan** (item 4). On every platform: a right drag inside a frame pans and opens no toolbox (S2B-06 without `test.fail`); a right click without moving opens the toolbox on release; the keyboard's context menu key opens it as today. |
| S16-08 | **Top bar** (item 5). At 1,201 px the bar does not scroll on Linux (S6A-10 without `test.fail`); the working context's label is truncated with its full name as the tooltip; slice 6a's widths from 800 to 2,560 px still cut nothing off. |
| S16-09 | **The view saved in time** (item 6). After the first view on open, after hiding the left panel and after a fit, the stored view (`infomapper:view:<canvas id>`) matches the view shown with the current left edge, without waiting 150 ms; crossing 1,000 px right after an open and reopening the canvas shows the same view (the case of the known limitation). |
| S16-10 | **No browser menu** (item 7). A right click on an empty canvas, a canvas tab, the top bar, the breadcrumbs row, a panel's header or list, and a home page's tile is cancelled (the event's `defaultPrevented`); on the object browser's search field, a panel's name field, the description editor, a link and selected text it is not. The canvas's toolbox and a card's menu still open. |
| S16-11 | **Performance** (section 6). |
| S16-12 | CI, the single-file checks of step 2, the full run of step 3; every earlier test changed, with its reason. |

**Definition of done (Łukasz's manual acceptance, on the demo and on KB):**

1. Add an attribute from a card header's menu, type its name, undo.
2. With three canvases in a project, move tabs with the four items, undo, reload.
3. Hide entity relationships, then source relationships, remove the chips one by one and with "Show all".
4. Pan with the right button inside a frame (Windows: as before).
5. Narrow the window to about 1,200 px: the top bar does not scroll, the working context's name is in its tooltip.
6. Right-click around the app (canvas, tabs, top bar, panels, a home page): no browser menu; in a name field and in
   the description editor the browser's menu still offers paste.

## 6. Performance

No new element on the canvas (AD-24): items 1, 2 and the switches are menu items, the chips are in the view-state bar,
and hiding a kind removes lines. Bars are proposals to confirm in step 1.

| What | How | Bar |
| --- | --- | --- |
| Switching a kind off and on | a branch-only spec as S6A-09 (the layer switch), to the screen, on "Performance test" with source relationships on it, at 100 % and 30 %, the layer switch measured beside it | one canvas commit, no miniature commit; time within the layer switch's |
| Viewport elements | `S3B-15-elements.spec.ts` against the latest baseline | equal with both kinds shown; with a kind hidden, fewer by exactly its lines |
| Pan and zoom, first render | `npm run measure:canvas` as in slice 15's last sitting, on the laptop (AD-24) | within the sitting's run-to-run spread |

**Nothing above the canvas reads layout during a commit** (CLAUDE.md): the tab menu's items and the chips read the
model, not the canvas.

## 7. Questions for step 1

**The rule (CLAUDE.md, "How we work"):** a PRD is a proposal to verify. Check every item, decision and criterion against
the code, `docs/decisions.md` and the earlier slices' acceptance docs; write where the PRD is wrong, misses something
or costs more than it assumes, with files and lines and a proposal. No application code in step 1.

- **Q1. Item 1.** Where the card header's menu is built (`cardItems`, the canvas host) and which command the panel's
  "Add attribute" uses; its change group and undo name; what happens with a collapsed card or a row filter; rights.
- **Q2. Item 2.** Where the tabs' order is read and written (`project_canvas.sort_order`), the save chain for two quick
  moves, the undo name, the project home's tiles, and who may rename a canvas today (P7).
- **Q3. Item 3.** `canvas.look`'s keys and validation; how the layer is kept and whether reviewers and readers change it
  locally (P7); what "Use this look on all canvases" and "Duplicate layout" copy (P8); where relationship lines,
  self loops, bundles and source lines are drawn, so one check per kind hides them; the view-state bar's chips and
  "Show all"; the Changes view and Focus with a hidden kind; a live canvas.
- **Q4. Item 4.** `CanvasModes.tsx` (`onContextMenu`, `rightDown`, `CLICK_SLOP`): the smallest change that opens the
  toolbox on release and ignores an early `contextmenu`; the keyboard's context menu; touch and pen if the canvas
  handles them; what changes on Windows (nothing, proposed).
- **Q5. Item 5.** `top-bar.tsx` and `working-context.tsx`: the label as the flexible item; the steps at 2,100, 1,880
  and 1,300 px; the specs of slice 6a that measure widths.
- **Q6. Item 6.** `ModelCanvas.tsx` (`onMoveEnd`, `shiftView`, the fit, the first view): how to tell the person's moves
  from the app's own (React Flow's event argument, assumed `null` for programmatic changes: to check); what else calls
  the save; the specs of D-54's remembered view.
- **Q7. Tests.** The earlier specs each item touches; which step needs the full run (proposed: one, in step 3).
- **Q8. Data.** Confirm no migration and no local file format change (`sort_order` exists; the switches are `look`
  keys); if `look`'s validation needs a change, whether an old file reads without it.
- **Q9. Texts and decisions**. Every new UI text in English for Łukasz's approval; the changes to D-22, D-39, D-54 and
  D-62 that D-71 makes, as a draft.
- **Q10. Item 7.** Where the app handles `contextmenu` today (the canvas, cards, lines, tabs, the object browser); any
  place that relies on the browser's menu (the rich-text editor's spelling, copy from read-only panels); whether one
  document listener in the app's layout is enough, or the homes and dialogs (portals) need it too; e2e helpers that read
  `defaultPrevented` or open menus with a right click.

## 8. Differences from the prototype (deliberate)

- The prototype keeps the switches beside the canvas's layer in its own state (`hideRels`); the app keeps them in
  `canvas.look`.
- The prototype draws source relationships in a simplified way (no self loop, no live canvas, no context cards); the
  app's lines follow D-62.
- Items 4 to 6 are the app's own bugs; the prototype has nothing to change.

## 9. Left for later

- Dragging canvas tabs to reorder them.
- "Add attribute" from an attribute row's menu (inserted below that row).
- A third switch for dimensional relationships on their own (InfoCube).
- From slice 15d's closing: a mapping from a column missing from the source says "not approved" in the requirement
  panel, though the mapping is approved: a reason of its own, as "type conflict" now.

## 10. Decisions to accept, and docs in this PR

### D-71 (proposal) The canvas's tabs, relationship switches and view save

"A canvas tab's menu moves the tab: Move left, Move right, Move to start, Move to end, in the current project's order
only, each one undo step. It also shows or hides relationship lines by kind, Between entities (logical and dimensional,
self loops and bundles included) and Between source tables (D-62), kept per canvas with its look (outside undo, D-12);
they filter within the layer modes that show relationships, and a hidden kind is a chip in the view-state bar (D-39).
A card header's menu adds an attribute as its panel does. The browser's own context menu is not shown in the app, except
on text fields, the description editor, links and selected text. The canvas saves its remembered view at once after its own
view changes, and after the person's own moves when they end." The text is quoted for approval in step 3.

**Changed by it:** D-22 (the switches beside the layer), D-39 (two more chips), D-54 (the remembered view saved at
once), D-62 (source lines hidden by their switch). Each gets "(Extended by D-71.)".

### Docs

- `docs/decisions.md`: D-71 and the four notes.
- `docs/ideas.md`: the slice done; "Source relationships: a layer switch of their own" closed as replaced (P4); section 9's
  items.
- `docs/known-limitations.md`: the three entries closed (items 4 to 6); Firefox's Shift+right-click (item 7).
- `docs/inventory-prototype-vs-app.md`: items 1 to 3 and 7 present; section 8's differences.
- `README.md`, `CLAUDE.md`: status; anything the fixes change in "Testing" (the two `test.fail` removed).

## 11. Assumptions

- **A1.** `main` is at tag `slice-15d`.
- **A2.** The canvas page already has the data each item needs: the project's canvas order, the canvas's look, source
  relationships.
- **A3.** No new table, no migration, no local file format change (Q8).
