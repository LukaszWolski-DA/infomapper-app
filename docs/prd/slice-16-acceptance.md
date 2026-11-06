# Slice 16 – acceptance

PRD: [`slice-16-canvas-menus.md`](slice-16-canvas-menus.md). Branch `slice/16-canvas-menus`.

## Step 1: the PRD checked against the code (6 November 2026)

### The starting point

- **`main` is at tag `slice-15d`:** `main`, `origin/main` and the tag all point to `573920e` (the merge of PR 40). The
  working tree was clean. The branch `slice/16-canvas-menus` was cut from the tag and has no upstream.
- **KB was backed up before any run:** `.data/backups/dev-db-20261106-1924.json` and `.data/backups/kb-model-latest.json`,
  both checked with `cmp` against `.data/dev-db.json`. No dev or e2e server and no script ran in this step.
- **The two files from Łukasz's Downloads**, committed on their own (`4a29cd3`):

  | File | SHA-256 | `cmp` |
  | --- | --- | --- |
  | `docs/prd/slice-16-canvas-menus.md` (new, 20,226 bytes) | `92a6e68bf9881190d90dce0b1a2136fef0c8018e4f32fed6b0b6b56f6c90b905` | equal |
  | `docs/prototype/infomapper-prototype-with-sources.html` (650,798 bytes, replaces `bf2251d9…`) | `4c0bf2d536beeaf27fa86ec4f0b58837f68ca327da87891fefa5ea4502a85997` | equal |

  - The first prompt carried the hashes of an earlier version, before item 7 was added. Łukasz confirmed these two hashes
    (6 November 2026). No "(1)" copy of either file exists.
- **The prototype's slice-16 code:**
  - `addAttr` l. 1686;
  - "Add attribute" in `ctxFor` l. 4114, after "Fit width to names" and "Show its requirements", before "Link to a
    requirement…";
  - `srcRect` and the source lines in `renderLines` l. 1851, 2119–2129;
  - `moveDia` l. 3262;
  - `relHidden` l. 3266;
  - `openMenu` l. 3267–3280: the move items after "Duplicate layout", and "Relationship lines" after "Use this look on all
    canvases";
  - the switches' click l. 3295–3297;
  - the document's `contextmenu` listener l. 3449–3455;
  - the chips in `viewState` l. 5026–5027 and "Show all" l. 5062.

### Summary

The PRD is right about the shape of the slice, and A1 to A3 hold. It is wrong or incomplete in eleven places:

1. **Item 1's place in the menu.** The app's card header menu has no "Link to a requirement…" (F1).
2. **Item 2's undo.** Today's undo cannot revert a changed `project_canvas` link: a "Move canvas" step would be undone
   by deleting the link (F4). Fixing it touches undo, which is shared infrastructure.
3. **Item 2's reach.** The tab menu is also the project home tiles' menu. The tab order also decides the workspace
   home's thumbnail and the canvas that labels and the consistency links open (F5, F6).
4. **Item 3's look keys.** `canvas.look` has three keys hard-wired in seven places, and S2A-08 compares the look
   exactly (F8).
5. **Item 3 and the miniature.** The miniature does draw entity relationships, so S16-11's bar of "no miniature
   commit" cannot hold for "Between entities" (F10).
6. **Item 3's measurement.** S6A-09 does not time the layer switch; S11-13 does (F11).
7. **Item 3 and reviewers.** Reviewers and readers get no tab menu, so P7's "a reviewer's choice is their own" has no
   way in except the chip's × (F9).
8. **Item 6's method.** "`onMoveEnd` saves only after the person's own moves", told apart by React Flow's `null`
   event, would stop saving the Hand tool, the zoom field and buttons, the miniature and Zoom to frame, and would break
   S9-13 (F15). A different fix is proposed.
9. **Item 7 and the canvas.** Inside the canvas a text field (a note's editor, the Changes view's select, the
   toolbox's search) never gets the browser's menu. The canvas cancels it first, so a document listener alone cannot
   give the planned exceptions there (F17).
10. **S16-10's tiles.** A home page's tile is a link, which item 7 keeps (F18).
11. **The test regime.** Items 4 and 6 change how 34 spec files open the toolbox on Linux and when the view is saved.
    Item 2 changes undo. Two full runs, not one (Q7).

### Findings

| # | Finding | Files and functions | Proposal |
| --- | --- | --- | --- |
| F1 | **No "Link to a requirement…" in the app's card menu.** It is a `<select>` in the panel's Requirements section (`requirements-section.tsx` l. 130–147). The header menu (`cardItems`) runs: Show its sources, Draw a relationship from here, Relate to itself, Paste attribute, Rows, Entity name, Attribute names, Collapse card, Fit width to names, Add a note to this, Put in a new concept frame, Focus, then the separator, Remove, the modules' items and Delete from model. | `canvas-host.tsx` `cardItems` l. 328–392 | **"Add attribute" right after "Fit width to names"** (l. 375), before "Add a note to this". That is the prototype's neighbour, since the prototype's "Link to a requirement…" comes right after it. Same rights as the block at l. 350 (`isEnt && editable`). Alternative: beside "Paste attribute" (l. 359). Question Y1. |
| F2 | **Item 1 is "Paste attribute" with another action.** `pasteInto` (l. 255–272) runs the action, selects `{ t: "row", cardId, id }`, calls `openDetails()` (D-54: an action that leads to a name typed in the panel) and `setNameFocus`. The panel's button does the same without `openDetails` (`entity-panel.tsx` l. 75–81). The command is `addAttribute` (`attribute.ts` l. 88–126): `new_attribute`, `string`, last, `model.edit` (EDITORS), refused when archived (`permissions.ts` l. 111–113). It has no undo label of its own, so the name is "Create attribute" (`change-label.ts` l. 238–243). No toast. | as listed | A `useCallback` beside `pasteInto`, reusing `addAttributeAction`. No domain change. |
| F3 | **A collapsed card or a hiding filter needs nothing.** The row selection opens `AttributePanel` whether the row is drawn or not (`inspector.tsx` l. 197–203). `showPlace` takes a row in `card.rows` filtered or not (`ModelCanvas.tsx` l. 1863–1866). The card stays collapsed or filtered, as with "Paste attribute" today. | `card-data.ts` `visibleRows` l. 345–348 | As the PRD says: the panel opens, and the card is not changed. |
| F4 | **`project_canvas` is a link table with no id and no version, and undo reverts its rows only by insert and remove.** `revertChangeGroup` treats an event with an `after_image` as "the link was added" and removes it (`undo.ts` l. 379–392). A move's update would be undone by deleting the link. The local adapter already accepts an update on a row without a version: it compares the whole stored row (`store.ts` l. 427–436, used today by `workspace_member`, `people.ts` l. 210). | `undo.ts` `revertChangeGroup`; `changes.ts`; `store.ts` `apply` | **`moveCanvas`** (`canvas.ts`), input `{ projectId, canvasId, to: "left" \| "right" \| "start" \| "end" }`. It reads the project's links in tab order, moves the canvas, renumbers 0…n−1 and writes an update for each link whose `sort_order` changes. Label "Move canvas". Permission `canvas.edit_projects`, the action undo already names for this table (l. 306). "Nothing to change." when the stored order would not move. **Undo learns the link update:** with both images, the current row must equal `after_image`, and an update writes `before_image` back. It gets unit tests: undo, redo, and "changed afterwards" refused. **This is undo, shared infrastructure** (CLAUDE.md): a full run in that step. The alternative, a remove and an insert per link, needs no undo change but records a move as deletes and creates, so it is not proposed. |
| F5 | **The tab menu is also the project home's tile menu** (`project-tiles.tsx` l. 70–89 renders the same `CanvasMenu`). The move items and the switches would show on the tiles too. | `canvas-menu.tsx` l. 122–187 | **Show both on the tiles too:** the tiles are in tab order, and the look is already in that menu. Question Y2. |
| F6 | **Tab order decides more than the tabs.** The workspace home shows each project's first canvas's thumbnail (`w/[workspaceId]/page.tsx` l. 81–96). A label and a consistency line open on the first canvas (`p/[projectId]/page.tsx` l. 69, 88–89). A deleted open canvas is followed by the next one (`canvas-menu.tsx` l. 96–100). `canvasAfterStep` finds a duplicate's original by equal `sort_order` (`next-canvas.ts` l. 11–18). | as listed | No code change. "Move to start" changes the workspace home's thumbnail, which follows. S16-03 checks that tile. A renumbered order ends the tie between a duplicate and its original. The tie matters only to the undo of the duplicate itself, which comes after the move's undo in the same history. |
| F7 | **Two quick moves need no save chain.** `project_canvas` has no version, so it is not on `rowSaves` (keyed on `id` and `version`). The duplicate, "In projects" and "Add a canvas from another project" use `run`. The menu closes on each click, and the server computes every move from the stored order (writes are serialised per data file, `store.ts` l. 24–30). | `canvas-menu.tsx` `toggle`; `use-action.ts` | `run` with no toast, as the prototype. The page's order comes from the fresh page. |
| F8 | **`canvas.look`'s three keys are hard-wired.** The places: `lookInput` is `.strict()` (`canvas.ts` l. 372–380); `setCanvasLook` rebuilds the three keys (l. 401–405) and `sameLook` compares them (l. 441); the actions' types (`_actions/canvas.ts` l. 157–188); `look.tsx` rebuilds them after a fresh page and a refusal (l. 69–73, 96–97) and keeps only `layer` local for non-editors (l. 77–80); S2A-08 checks `copy.look` with `toEqual` (l. 47); `data-model-v2.md` l. 531 documents the default. The SQL column has no check (`initial_schema.sql` l. 437). Undo already treats the whole `look` as outside undo (`undo.ts` l. 253–255, 401, 430). | as listed | **Two optional keys, stored only while a kind is hidden:** `hideEntityRelationships: true` and `hideSourceRelationships: true`. Showing a kind removes its key. Then an old file and the SQL default read as "both shown", S2A-08 holds for the seed's canvases, and nothing needs an upgrade (Q8). The seven places learn the keys. `data-model-v2.md` l. 531 gets one line (with Łukasz, in this PR). |
| F9 | **Reviewers and readers have no tab menu** (`canvas-tabs.tsx` l. 112–139: a spacer instead; `project-tiles.tsx` l. 70). They can change the layer locally (`LayerSwitch` in the top bar). They could remove a chip with its × (`view-state-bar.tsx` l. 62), but could never hide a kind. | `look.tsx` l. 77–80 | Keep the menu for editors. A reviewer's or reader's chip × shows the kind in their browser only, as the layer chip does. Question Y3 (whether a reviewer should get the two switches somewhere). |
| F10 | **One check per kind already exists in effect: the layer's data filter.** `ModelCanvas.tsx` l. 349–361 filters `allLines` by the layer. Every consumer reads the filtered `lines`: `LineLayer`, the bundles (`bundleLines`), `FadeLayer` and `LitLines` (Focus, the Changes view), `CoverageLayer`, hover, `related` and the miniature. Dimensional relationships are in `relationships` (no level on the line), self loops too (`fromCardId === toCardId`), and bundles are built from the filtered list. **The miniature draws entity relationships** (`Overview.tsx` l. 226–230), not only the frames. | `ModelCanvas.tsx`; `Overview.tsx`; `line-geometry.ts` `bundleLines` | Filter in the same `useMemo`: no `relationships` when entities are hidden, no `sources` when source tables are hidden. Then the bundles, Focus, the Changes view and hover follow, and so does the miniature, which loses the entity relationships as it does in Mappings. **The PRD's "the miniature is unchanged" is true only for source lines.** A selected relationship stays selected while hidden, as with the layer today (its panel shows; Delete works). Thumbnails draw no relationships (`thumbnail.ts` l. 1–9). A live canvas has nothing special. |
| F11 | **S6A-09 does not time the layer switch.** It times Focus, Show all, collapse and the Hand tool (header l. 1–11). The layer switch is timed to the screen in `S11-13.spec.ts`, and its commits are counted in `S11-13-commits.spec.ts`. The switch re-renders `ModelCanvas` (a data filter, not a class). | `e2e/slice-11/` | Model S16-11's spec on S11-13: the two switches beside the layer switch, to the screen, at 30 % and 100 % on "Performance test" with 20 source lines added as `S10B-10-lines.spec.ts` adds them. **Bars:** one canvas commit per switch; no miniature commit for "Between source tables"; one for "Between entities" (F10), as the layer switch has; time within the layer switch's. |
| F12 | **Item 4: the smallest change keeps Windows untouched.** `onContextMenu` (`CanvasModes.tsx` l. 198–268) cancels first, then opens unless the mouse moved more than `CLICK_SLOP` (5 px, l. 26–27) since `rightDown` (l. 148–153). On Linux and macOS the event comes while the button is still down. | `CanvasModes.tsx` | In `onContextMenu`, when `e.buttons & 2` (the right button still down: Linux, macOS), remember the target and return. A window `pointerup` with `button === 2` (`pointerup`, not `mouseup`: d3-zoom swallows mouse events, `zoom.js` l. 286, 298) then opens the toolbox for that target, if the pointer moved no more than `CLICK_SLOP`. On Windows `buttons` is 0 by then and today's path runs unchanged. Keyboard and touch long-press have no right press and keep today's path. Step 2 first checks in Chromium on Linux (the runner) that `buttons` is 2 on that event. The fallback is "a right press with no `pointerup` yet". |
| F13 | **The keyboard's context menu key is not handled anywhere** (no `ContextMenu` or `F10` in `src`). A keyboard `contextmenu` reaches the canvas only when the focus is inside it, and today it opens the toolbox at the event's coordinates. No spec tests it. | `CanvasModes.tsx` | S16-07's keyboard part says "unchanged": step 2 records what Chromium does today on Windows and Linux and writes the check to match. It does not assert "opens". |
| F14 | **Item 5: the label is not flexible today, and its tooltip is not its name.** `button-context` and its wrapper are `flex-none` (`working-context.tsx` l. 113, 160). The label has fixed caps of 180, 90 (≤ 1,300), 56 (≤ 1,200) and 40 px (≤ 1,000) (l. 173). The `title` is a fixed help text (l. 166). The bar's only slack is the three switchers (`top-bar.tsx` l. 64), already at their 52 px minimum at 1,201 px. | `top-bar.tsx`, `working-context.tsx` | The wrapper and the button get `min-w-0` and may shrink; the label keeps its caps as maximums and gets a minimum of 40 px. Nothing looks different where there is room, and Linux's extra pixels come out of the label. **The title, while a context is on**, becomes a new text (Y5): "Working on {name}. Everything you create or change in the model gets this label." With no context on, today's text stays. S6A-10 loses its `test.fail` (l. 114); its loop's `if (width !== 1201)` (l. 57) goes too. |
| F15 | **Item 6: React Flow's `null` event cannot tell the person's moves from the app's.** `onMoveEnd` gets `null` for every `setViewport` and `fitBounds` (`@xyflow/react` index.mjs l. 527–556; d3-zoom `Gesture` l. 185). That includes moves the person makes through the app: the Hand tool (`CanvasModes.tsx` l. 93), the miniature (`Overview.tsx` l. 123), the zoom buttons and field (`ZoomControls.tsx` l. 28), Zoom to frame (`useFrames.ts` l. 784), the row drag's auto-scroll (`ColumnDrag.tsx` l. 122) and `centerOnRect` (`ModelCanvas.tsx` l. 934). **S9-13 expects a typed zoom stored and kept after a reload** (l. 20–31). The fault itself is narrower: `onMoveEnd` stores the viewport React Flow captured at the move's end with the left edge read 150 ms later (l. 464–470; the timer in `@xyflow/system` l. 2882–2889). | `ModelCanvas.tsx` `onMoveEnd`, the first view l. 1720–1731, `fit` l. 449–452, `shiftView` l. 454–460 | **Two changes, no event test:** (a) the first view, `shiftView` and the fit store the view at once (`rf.getViewport()` and the left edge, one helper `storeView`); (b) `onMoveEnd` ignores its argument and calls `storeView` too, which reads the viewport and the left edge at the same moment, and does nothing once the canvas is unmounted (`rootRef.current` null: the page being left). A late save is then always a consistent pair and can no longer put the old `x` beside a new left. Every move the person makes is still saved. S6A-11's `savedWithLeft` (l. 12–13) relies on the open's save and still holds. Question Y6 on the PRD's wording. |
| F16 | **The `viewStored` waits stay** (`e2e/slice-05a/helpers.ts` l. 76–87): S5A-07 l. 45 and S6A-11 l. 28, 47, 54. After (a) they pass at once. They still describe what the tests wait for: React Flow's late `onMoveEnd` after the open can still store the view again, now as a consistent pair, so a test that removes the key must wait for it first. S16-09 adds the 1,000 px case without the wait. | as listed | As the PRD says: keep the helpers. |
| F17 | **Inside the canvas no text field gets the browser's menu today.** `onContextMenu` cancels unconditionally (`CanvasModes.tsx` l. 200), so a note being edited (`NoteLayer.tsx` l. 219) and the Changes view's select (`Changes.tsx` l. 90) get none. React Flow's pane cancels too, because of `panOnDrag={[1, 2]}` (`@xyflow/react` l. 1462–1468). The toolbox cancels on its own search field (`toolbox.tsx` l. 120, 134). A document listener runs after React's (the root is hydrated on `document`) and can only add cancels, never remove them. The prototype also cancels everything inside the canvas (l. 3446). | `CanvasModes.tsx`, `toolbox.tsx` | One predicate `keepsBrowserMenu(event)` in `src/ui/` (text field, `select`, `contenteditable`, `a[href]`, a right click on selected text), used by the document listener, `onContextMenu` (return before cancelling) and the toolbox. A note's editor then gets paste and spelling, as the PRD's rule says, unlike the prototype. Question Y7. |
| F18 | **Several surfaces S16-10 lists as cancelled are links.** A home page's tile (`project-tiles.tsx` l. 52; `w/[workspaceId]/page.tsx` l. 198), the breadcrumbs (`breadcrumbs.tsx` l. 46) and the Home tab are `<Link>`, so they keep the browser's menu. The other canvas tabs are `div`s (`canvas-tabs.tsx` l. 82–93) and lose it, including "Open in new tab". | as listed | S16-10 right-clicks a tile's **name area outside its link** if there is one, otherwise the home page's header. It checks that a tile link and a breadcrumb **keep** the menu. |
| F19 | **Where the listener goes.** The root layout is a server component (`layout.tsx` l. 31–38). Its only client child on every page is `ToastProvider` (`src/ui/components/toast.tsx`), which also covers sign-in. `AppShell` and `HistoryNav` miss sign-in and the landing page. `global-error.tsx` replaces the whole document. | `src/app/layout.tsx` | A small client component `NoBrowserMenu` in `src/ui/`, mounted in the root layout beside `ToastProvider`. `global-error` stays without it (a crash page). |

### Q1. Item 1: "Add attribute" in a card header's menu

- **The menu:** `cardItems` in `src/app/_panels/canvas-host.tsx` l. 328–392. A right-click selects a card header as
  `{ kind: "card" }` and a row as `{ kind: "row" }` (`CanvasModes.tsx` l. 218, 245–254). The row menu is built
  separately (l. 642–688) and a source column's at l. 690. So "header only" and "not on table cards" come from `isEnt`
  in `cardItems`.
- **Where:** F1. The modules' items stay where they are (l. 385, "before Delete from model…").
- **The command:** `addAttributeAction` (`_actions/model.ts` l. 135–139), then `addAttribute` (`attribute.ts`
  l. 88–126): one insert, one change group, undo "Create attribute".
- **Dimensional entities:** `addAttribute` checks no level, and the level rules (`levelRefusal`, `run-command.ts`
  l. 182–195) only look at entity writes and mapping targets. A fact or a dimension already gets attributes from its
  panel, so S16-01's dimension part works with no change.
- **Collapsed or filtered:** F3.
- **Rights:** `editable` is `standing === "full"` (`page.tsx` l. 165): owner, admin or modeler in a workspace that is
  not archived. That matches the command's `model.edit` and the panel's button. A reviewer and a reader get no item. A
  direct call is refused as `forbidden`; an archived workspace as `archived`.
- **Proposal:** F2's callback; no domain or data change.

### Q2. Item 2: the tabs' order

- **Read:** `listLinksOfProject` in tab order (`store.ts` l. 21–22, 175–178; `ports.ts` l. 103–104), then
  `project-view.ts` l. 36, 57–60. The tabs (`canvas-tabs.tsx` l. 79) and the tiles (`project-tiles.tsx` l. 42) render
  `view.canvases` in that order, so the tiles follow with no change.
- **Written today:**
  - `createCanvas` (`canvas.ts` l. 74), `addCanvasToProject` (l. 163) and `openLiveCanvas` (`live.ts` l. 365) put the
    canvas last;
  - `duplicateCanvas` gives the copy its original's order (l. 257);
  - a new project and a new workspace write 0.

  Nothing reorders today.
- **The command, undo and the label:** F4.
- **Two quick moves:** F7.
- **The project home and the workspace home:** F5, F6.
- **Rights (P7):** today renaming needs `canvas.rename`, and the menu needs `view.canEdit` (`can(…, "canvas.create")`,
  `project-view.ts` l. 54). Both are EDITORS and refused when archived. **P7 confirmed, corrected:** the command checks
  `canvas.edit_projects` (also EDITORS), the action undo already uses for `project_canvas`. The menu items show where
  the menu shows (`view.canEdit`).
- **The disabled items and one canvas:** computed from `view.canvases` (the page's order). The server refuses a move
  that the stored order would not make ("Nothing to change.").

### Q3. Item 3: relationship lines by kind

- **`canvas.look` and its validation:** F8.
- **The layer:** stored in `look.layer` per canvas (`types.ts` l. 484–490). Editors save it on the canvas row's chain
  (`look.tsx` l. 83–90, `rowSaves.save`). Reviewers and readers switch it in their browser only (l. 77–80; the resync
  keeps their choice, l. 72, 97). Not an undo step (`undo.ts` l. 253–255).
- **P7 for the switches, confirmed with F9:** an editor's choice is saved with the canvas. A reviewer's or reader's chip
  × is their own, in the browser only. They have no menu to hide a kind.
- **P8 confirmed:**
  - "Use this look on all canvases" copies `background` and `grid` only, keeping each canvas's other keys
    (`canvas.ts` l. 433–436). It copies neither the layer nor the switches.
  - "Duplicate layout" copies `{ ...canvas.look }` (l. 248), so it copies the switches with no change.
- **Where lines are drawn:**
  - relationships, self loops and pills: `RelPath`, `LineLayer.tsx` l. 101–145;
  - source lines: `SourcePath`, l. 151–163;
  - bundles: `BundlePath`, from `bundleLines`, `line-geometry.ts` l. 153–201;
  - lit lines: `LitLines`, l. 628–714.

  One filter covers them all (F10).
- **The view-state bar:** `useViewChips` (`view-state-bar.tsx` l. 46–90) puts the layer chip third, after Focus and the
  Changes view.
  - **The two new chips come right after the layer chip**, in the prototype's order (l. 5025–5027).
  - Their × calls `setLook` with the key removed, as the layer chip's does (l. 62).
  - "Show all" (`useShowAll` l. 98–113) clears both in the same call as the layer. It stays outside the undo step,
    which holds only the layout part.
  - "Show all" appears from two removable chips, so two hidden kinds alone bring it (S16-06's "with both off").
- **The Changes view and Focus:** `LitLines` draws only lit relationships and source lines that are in the filtered
  `lines` (l. 664–679), so a hidden kind stays hidden under the veil. The model's Focus sets still include them, which
  changes nothing visible.
- **A live canvas:** nothing special (its look is an ordinary look, `live.ts` l. 384).
- **Proposal:** F8, F10, the chips as above, and the switches in `CanvasMenu` after "Use this look on all canvases" as
  `menuitemcheckbox` items with ☑/☐ (as "In projects", l. 156–175), staying open on a click.

### Q4. Item 4: a right-button pan

- **The code:** F12.
- **The keyboard:** F13.
- **Touch and pen:**
  - The canvas has no `pointerType` checks. A touch long-press has no right press, so it keeps today's path and opens
    the toolbox at once.
  - A pen's barrel button reporting `button === 2` behaves as a mouse.
  - Nothing changes for either, and they are not tested (no device in CI).
- **Windows:** unchanged (F12). S2B-06's right drag loses its `test.fail` (l. 83) and runs on Windows and Linux.
- **A hidden case it fixes:** S2A-07 l. 59–63 right-drags, then middle-drags, then expects no toolbox. On Linux the
  middle press probably closes a toolbox the right press opened (`toolbox.tsx` l. 79), which would hide the bug. After
  the fix the check means what it says.
- **What changes for the 34 spec files that open the toolbox by a right click** (`toolboxAt`, `toolboxLabels`, direct
  `{ button: "right" }`): on Linux the toolbox now opens on the release instead of the press. Playwright's `click`
  presses and releases, so they should pass unchanged, but it is a change under every one of them (Q7).

### Q5. Item 5: the top bar

- **The steps** (`top-bar.tsx`, `working-context.tsx`, `more-breakpoints.ts`):

  | Width | What changes |
  | --- | --- |
  | ≤ 2,100 px | The switches show short labels and the switchers are capped at 150 px. |
  | ≤ 1,880 px | The tools show their icons only. |
  | ≤ 1,300 px | The brand and the separators go; the switchers are capped at 110 px; the context label at 90 px; the names' check boxes go to "More". |
  | ≤ 1,200 px | Focus, Changes and the notation go to "More"; the label is capped at 56 px. |
  | ≤ 1,100 px | The four tools go to "More". |
  | ≤ 1,000 px | The gaps shrink and the label is capped at 40 px. |

- **The proposal:** F14. The steps stay; only the label becomes shrinkable.
- **Specs that measure widths:**
  - `S6A-10.spec.ts`: its widths from 2,560 to 800 px (l. 12), the loop (l. 45–109) and the 1,201 px test
    (l. 111–123). `button-context`'s text checks use `toContainText` (S3B-01, S3B-02, S3B-04, S6A-10 l. 42), which CSS
    truncation does not affect.
  - S6B-09 measures the breadcrumbs row, not the top bar.

### Q6. Item 6: the view's save

- **What calls the save:**
  - `onMoveEnd` (`ModelCanvas.tsx` l. 464–470) is the only writer of `infomapper:view:<id>`, apart from `copyView`
    (`views.ts` l. 6–13, Duplicate layout).
  - React Flow calls it after every viewport change, its own and the app's, 150 ms later because of `panOnScroll`.
    The wheel has its own 150 ms timer (`@xyflow/system` l. 2813–2816).
- **The `null` event assumption:** true, but not usable (F15).
- **The proposal:** F15, with F16 for the specs.
- **The specs of D-54's remembered view:** S5A-03, S5A-07, S6A-06, S6A-11, S6B-04, S6B-05, S6B-10 and S9-13. Some
  measuring specs set the key before opening (`openCanvas`, `e2e/slice-01a/helpers.ts` l. 35–42); a view without
  `left` still opens as stored.

### Q7. Tests and runs

| Item | Earlier specs it touches | Expected change |
| --- | --- | --- |
| 1 | S1A-07, S1A-11 (no button for readers), S1B-07 (header items with `toContain`), S1B-12, S1B-13, S3B-02 | none; S1B-07 checks items one by one, not the whole list |
| 2 | S0-05, S0-06, S2A-08, S2A-10, S2A-13 (the menu), S12B-* (the tiles), the undo unit tests | none expected; new unit tests for `moveCanvas` and the link update in undo |
| 3 | S2A-08 (`copy.look`), S2A-11, S2A-13 (the layer), S6A-01 to S6A-03 (the chips, "Show all"), S10B-* (source lines), S10A-* (loops), S2C-* (bundles), S15-* (the star's relationships), S3B-13 (the miniature's commits) | S2A-08 unchanged (no keys while shown); the rest unchanged |
| 4 | S2B-06 (`test.fail` removed), S2A-07, the 34 files that open the toolbox by a right click | the toolbox opens on release on Linux |
| 5 | S6A-10 (`test.fail` and the 1,201 skip removed), S3B-01, S3B-02, S3B-04 | none beyond S6A-10 |
| 6 | S5A-03, S5A-07, S6A-06, S6A-11, S6B-04, S6B-05, S6B-10, S9-13; the measuring specs that seed the key | none |
| 7 | none reads `defaultPrevented`; the right clicks above target the canvas | none |

**Full runs: two, not one.**

- **Step 2** changes how 34 spec files open the toolbox on Linux (item 4) and when every canvas page stores its view
  (item 6). Both are under most canvas specs. Proposed: one full run at the end of step 2. It replaces nothing: the
  single-file checks on the runner (`rounds 3`) for S2B-06, S6A-10, S5A-07, S6A-11 and the new specs stay, as does
  S2B-06 once locally on Windows.
- **Step 3** changes undo (F4), which is shared infrastructure (CLAUDE.md), and the line layer's input. It is the run
  before the merge, as the PRD plans.

### Q8. Data

- **No migration.** `project_canvas.sort_order` exists (`initial_schema.sql` l. 452). `canvas.look` is `jsonb` with no
  check, and its default keeps its three keys.
- **No local file format change** (`DEV_DB_FORMAT` stays 13).
  - With the keys stored only while a kind is hidden (F8), an old file reads as "both shown".
  - The local adapter has no rule on `look` (`schema.ts` l. 253–262).
  - The upgrade code never touches `look` (`file.ts` l. 92–177).
- **`lookInput`'s change is additive:** two optional booleans, still `.strict()`.
- **`data-model-v2.md` l. 531** names the two keys, with Łukasz, in this PR.
- KB needs no upgrade. It was backed up anyway (above).

### Q9. Texts and decisions

#### New user-facing texts (for approval)

| Where | Text | Source |
| --- | --- | --- |
| an entity card header's menu | **Add attribute** | prototype `ctxFor` (the panel's button already says it) |
| undo of that step | **Create attribute** (existing) | `change-label.ts` |
| a canvas tab's (and tile's) menu | **Move left**, **Move right**, **Move to start**, **Move to end** | prototype `openMenu` |
| undo of a move | **Move canvas** (Undo's title: "Undo Move canvas") | PRD item 2 |
| a move the stored order would not make | **Nothing to change.** (existing) | domain |
| the menu's section | **Relationship lines** | prototype |
| its two check items | **Between entities**, **Between source tables** | prototype |
| the chips | **Entity relationships hidden**, **Source relationships hidden** | prototype `viewState` |
| the chips' titles (new; the prototype has none) | "Lines between entities are hidden on this canvas" and "Lines between source tables are hidden on this canvas" | proposal, after the layer chip's "The other lines are hidden" |
| the working context's title while on (F14) | "Working on {name}. Everything you create or change in the model gets this label." | proposal; today's help text stays while off |

Item 4, item 6 and item 7 add no text.

#### D-71 (draft)

> **D-71** The canvas's tabs, relationship lines by kind, the header's "Add attribute", the browser's menu, and the
> view's save (slice 16). A canvas tab's menu, and a canvas tile's on the project home, move the canvas: Move left,
> Move right, Move to start, Move to end, after Duplicate layout. They act in the current project's order only (a
> canvas may be in several, D-28), each one undo step "Move canvas", for those who may edit; an item that would not move
> it is disabled, and with one canvas they are not shown. The tab order is also the tiles' order and decides the
> project's first canvas (the workspace home's thumbnail, D-29). The same menu, after "Use this look on all canvases",
> shows or hides relationship lines by kind: Between entities (logical and dimensional, self loops and the bundles of
> collapsed frames) and Between source tables (D-62). They are kept per canvas with its look, outside undo (D-12). They
> filter within the layers that show relationships, and the miniature follows them as it follows the layer. "Use this
> look on all canvases" does not copy them; "Duplicate layout" does. A hidden kind is a chip in the view-state bar
> (D-39), "Entity relationships hidden" or "Source relationships hidden", in every layer, removed by its × or by "Show
> all"; people who cannot edit the canvas remove it in their browser only. An entity card header's menu adds an
> attribute as its panel does, after "Fit width to names", for those who may edit the model; its name is selected in
> the details panel, which opens (D-54). The browser's own context menu is not shown in the app, except on text fields,
> selects, the description editor, links and selected text, also inside the canvas; where the app has a menu a right
> click opens it, on the right button's release when the button is still down at the browser's event. The canvas stores
> its remembered view at once after its own view changes (the first view, the left panel, the fit), and after any move
> with the view and the left edge of the same moment.

**Notes on the decisions it changes**, each ending "(Extended by D-71.)":

- **D-22:** "A canvas also keeps two switches beside its layer: relationship lines between entities and between source
  tables, which filter within Everything and Relationships."
- **D-39:** add the two chips to the list ("…layer, hidden relationship kinds, filters…"), and to the view state
  outside undo ("Focus, the layer, the hidden relationship kinds, hidden resolved notes and the tool are view state
  outside undo").
- **D-54:** "The view is stored at once after the canvas's own view changes, and every store takes the view and the
  left edge at the same moment."
- **D-62:** "They show in the layers Everything and Relationships" becomes "…unless the canvas hides relationships
  between source tables".
- **Also proposed (Y8):** D-28, "The order of a project's canvases is the project's own." D-61's "layers (hidden in
  Mappings)" is covered by D-22's note.

### Differences between the prototype and the app that the slice touches

| # | Prototype | App (proposed) | Why |
| --- | --- | --- | --- |
| P1 | "Add attribute" before "Link to a requirement…" | before "Add a note to this" | the app's menu has no requirement item (F1) |
| P2 | the switches in the diagram's own `hideRels` | `canvas.look` keys, present only while hidden | PRD section 8; F8 |
| P3 | inside the canvas every right click is cancelled, text fields included | a note's editor and the Changes select keep the browser's menu | PRD item 7's rule (F17, Y7) |
| P4 | the tab menu only | the tile menu too, which is the same component | F5 (Y2) |
| P5 | the chips have no title | titles proposed | the app's chips all have one |
| P6 | source lines simplified | D-62's lines, unchanged | PRD section 8 |

### Questions for Łukasz

- **Y1 (item 1):** "Add attribute" after "Fit width to names" (the prototype's neighbour, F1), or beside "Paste
  attribute"?
- **Y2 (item 2):** the move items and the switches on the project home's tiles too (F5)? Proposed: yes, the same menu.
- **Y3 (item 3):** reviewers and readers have no tab menu (F9). Keep it so (they can only remove a chip locally), or
  give them the two switches somewhere? Proposed: keep it so.
- **Y4 (runs):** two full runs, at the end of step 2 and of step 3 (Q7)?
- **Y5 (item 5):** the working context's new title while on (F14)?
- **Y6 (item 6):** item 6's method replaced by F15: every save reads the view and the left edge at the same moment, the
  app's own changes save at once, nothing saves once unmounted. Its sentence "`onMoveEnd` saves only after the person's
  own moves" is dropped.
- **Y7 (item 7):** text fields inside the canvas (a note's editor, the Changes select, the toolbox's search) keep the
  browser's menu, against the prototype (F17)?
- **Y8 (decisions):** D-71's draft, the four notes, and the extra note on D-28?
- **Y9 (texts):** the table above.
