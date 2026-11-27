# Slice 38 – Design system layout: acceptance

Branch `slice/38-design-system-layout`, from `dev` at `15f6ba0` (the PRD names `ed5e934`; the three commits since are
slice 36's S36-list fix, a spec and its acceptance note, nothing this slice touches). PRD:
[slice-38-design-system-layout.md](slice-38-design-system-layout.md).

## Step 1: the check against the code (27 November 2026)

No application code. The facts below were read on `dev` at `15f6ba0`: the canvas page, the top bar, "More", the names'
check boxes, the fit and the shell by hand; the prototype's layout blocks, the homes, InfoDocumenter's bar and list rows,
and every e2e spec under `e2e/` (600 files) by a search of each, then checked against the code where a finding rests on
it. Widths marked "about" are estimates from the classes; step 2 measures them in the browser.

### 0. The files

| File | `cmp` | SHA-256 |
| --- | --- | --- |
| `docs/prd/slice-38-design-system-layout.md` | same as Downloads | `f8a82552…c91288`, as given |
| `docs/prototype/infomapper-prototype-with-sources.html` | not copied (unchanged since slice 37) | `74c70cd9…9029`, as given |

The slice number is free: no `slice-38` file in `docs/prd/` before this step, and no such branch or tag, local or remote.

### 1. What Łukasz needs to decide before step 2

Each item is explained further down (the F-numbers in section 11). The first option is my recommendation.

| # | Question | Options |
| --- | --- | --- |
| B1 | **"Names ▾".** The prototype has no "Names ▾" (and no names check boxes in its toolbar); DS3.1 decided it, so the app builds it without a prototype to match. Slice 11's specs read the check boxes' `checked`, `indeterminate` and `data-state` directly. (F1) | **(a)** A pop-over button "Names ▾" holding the two native check boxes with their test ids, states, titles and rights unchanged; its content stays in the page while closed (hidden, two inputs), so the specs' reads still work, and slice 11's `entityBox` / `attributeBox` open it before a click. (b) A Radix menu with check-box items: the states become `data-state`, and every slice 11 spec that reads `indeterminate` or calls `check()` is rewritten. |
| B2 | **"More".** The prototype has no "More": its toolbar scrolls sideways when it does not fit. The PRD keeps "More", by the canvas's width. With both panels at their default widths a 1,280 px window leaves the canvas 676 px, and about 45 earlier specs click Focus, the notation or the tools in the bar at 1,280 px. (F2) | **(a)** "More" by the toolbar's own width (a container query on a strip over the canvas that contains no canvas element), its breakpoints chosen so that at 1,280 px with both panels at their default widths every control is in the toolbar (the icon-only toolbar is about 620 px, measured in step 2); the same order of leaving as today (the names, then Focus, Changes and the notation, then the four tools). The 45 specs stay as they are. (b) As the prototype: no "More", the toolbar scrolls sideways with a fade wherever it does not fit; slice 6a's "More" tests are rewritten. (c) "More" by the window's width, as today. |
| B3 | **The homes' "moved" lists do not exist.** The workspace home has no side panels today (it never had), and the project home's panels show only two placeholders ("Open a canvas to …"). "Other workspaces in …", "Other projects" and "The model is shared by all n projects…" are only in the prototype's panels. (F3) | **(a)** Add them to the pages as the prototype shows them, from data the shell already reads (`shell.workspaces`, `shell.projects` with their canvas counts): new content on the pages, no new read. (b) Leave them out; the homes only lose the placeholder panels. |
| B4 | **The panel toggles on a page.** S38-03 says the top bar's toggles still open a panel on a page. On the project home the only panels are the two placeholders, so a toggle would open "Open a canvas to …". (F4) | **(a)** The project home becomes a page as the workspace home is: no panels and no toggles; the layout cookie is not touched there; S5A-02's home part is rewritten. (b) As the criterion and the prototype (`pshowL` / `pshowR`): the toggles open the placeholder panel beside the page. |
| B5 | **Four lifecycle cards.** The app has one, Archive (`lifecycle.tsx`); the prototype's Duplicate, Transfer and Export and delete are not built. (F5) | **(a)** The grid takes four in a row (`minmax(260px,1fr)`), with today's one card; no card is added. (b) Leave the grid as it is. |
| B6 | **The toolbar is a new layer over the canvas.** CLAUDE.md, "When to measure": a slice that changes the canvas's layers has a measuring sitting as its gate. The PRD has none. (F6) | **(a)** In step 2: a LayerTree read and the element guard on the dense view with the toolbar, and pan and zoom to the screen at 30 % and 100 % against `slice-37`, bar: within 3 % of `slice-37` (a new bar, for Łukasz's approval). (b) LayerTree and the element guard only, pan and zoom as a reference figure. |
| B7 | **Full runs.** The PRD has them in steps 3, 7 and 9. Step 2 changes the canvas's layers, which is on "Test runs"' list of shared infrastructure. (F7) | **(a)** Full runs in steps 2, 3, 7 and 9. (b) As the PRD. |
| B8 | **The canvas tabs.** Slice 37 left one exception in the control-style guard, the canvas tabs, "slice 38's layout"; the PRD does not mention them, and at 390 px they scroll without a fade. (F8) | **(a)** Step 6 draws them with the tab variants and the fade, and the exception goes. (b) Leave them to a later slice. |

Everything else below is a correction or a proposal that I take unless Łukasz says otherwise.

**Łukasz's answers (27 November 2026):**
- **B1 to B8:** all option (a), the recommendations above.
- **B6's bar is approved:** pan and zoom to the screen within 3 % of `slice-37` at 30 % and 100 %.
- **The corrections of section 11 are accepted as proposed:** the Changes bar under the toolbar (F9); every fit and
  placement leaving a fixed 70 px for the toolbar (F10); the document's name with an ellipsis only while it has no focus,
  its full name in its title (F13); the save indicator stays in the document's bar (F13, D-84).

### 2. Q1: the toolbar's host

**Fact.** The canvas page (`c/[canvasId]/page.tsx:431-455`, `CanvasTools`) passes the tools into `AppShell`'s `tools`,
drawn by `TopBar` in `bar-tools` (`top-bar.tsx:63`). They need `CanvasUiCtx` and React Flow's store (`ZoomControls`
calls `useReactFlow` and `useStore`), both from `CanvasProvider` (`CanvasProvider.tsx:178`, `ReactFlowProvider`), which
wraps the whole page, so they work anywhere inside it. The canvas is in `AppShell`'s `<main className="relative …">`
(`app-shell.tsx:74`). The Overview is a React Flow `Panel` at the bottom right (`Overview.tsx:147`). **The Changes view's
bar** (`Changes.tsx:88`, `bar-changes`) is already over the canvas at the top, centred, `top-2.5 z-40`: exactly where the
toolbar goes. The prototype has no such bar.

**Proposal.**
- **Outside React Flow:** a strip `absolute inset-x-0 top-3` in `<main>`, before `ModelCanvas` in the DOM,
  `pointer-events: none`, holding the toolbar (`role="toolbar"`, `aria-label="Canvas"`, `pointer-events: auto`, centred).
  The page passes it as a new `AppShell` slot (`canvasTools`), the server page still naming the client tools as today.
  Not a `Panel`: inside `.react-flow` the toolbar would be part of the element React Flow re-renders and of the canvas
  scroll watch's area, and its pointer events would have to be stopped from reaching the pane one by one.
- **AD-24:** the strip contains no canvas element, so its container query (B2) and its classes restyle nothing of the
  canvas; nothing reads layout in a commit (the breakpoints are CSS, the reserved top is a constant, Q3).
- **Stacking:** the toolbar above the canvas and its overlays (`z-30`), below the menus, pop-overs, dialogs and toasts
  (portals, as today); **the Changes bar moves under the toolbar** (`top` = the toolbar's bottom + 8 px), keeping its
  centring. The Overview, the toolbox, the canvas's error message and the view-state bar (in the navigation row, not on
  the canvas) are unchanged.
- **Tab order:** after the navigation row's chips, before the canvas (S6A-02 reads Tab from the last breadcrumb to the
  first chip's ×: unchanged).
- **Hidden on the homes:** nothing to hide. The homes never get the slot; the toolbar exists only on canvas pages.
- **The canvas's error boundary** (`CanvasErrorBoundary`): the toolbar stays outside it, as the top bar's tools are
  today.

### 3. Q2: "More"

**Fact.** `more-breakpoints.ts`: the names at ≤ 1,300 px, Focus, Changes and the notation at ≤ 1,200 px, the four tools at
≤ 1,100 px, each a class on the tool's own element (`max-[1301px]:hidden`) and on its menu item; "More" shows from
1,300 px. Window widths, measured in slice 6a with the working context on and both panels shown.

**The toolbar's width** (the prototype's `#ctb`: icons only, `.tb` 28 px, the segments' short labels, 2 px gaps, 9 px
separators, 4 px padding): layer switch about 120, Focus and Changes 56, four tools 112, IE · UML about 80, "Names ▾"
about 70, zoom (−, the 42 px field, +, Fit) about 126, separators and padding about 55: **about 620 px**. With both
panels at their defaults the canvas is 676 px at 1,280 px (1,280 − 264 − 340), so everything fits with about 30 px to
spare (the strip keeps 12 px each side).

**Proposal (B2 (a)).**
- `container-type: inline-size` on the strip; `more-breakpoints.ts` keeps its three groups and its idea (a class on the
  tool's element and on its menu item, nothing on the page) with `@container` breakpoints instead of the window's.
  The values are measured in step 2: the names leave first, at the toolbar's full width plus a margin; Focus, Changes
  and the notation next; the four tools last. "More" shows only when something is in it, at the toolbar's right end.
- **"More" holds "Names ▾"'s two items** as it holds the names' check boxes today (`more-entity-aliases`,
  `more-attribute-aliases`, indeterminate, disabled for readers).
- Unit tests: the groups and their order, and that each item's two classes are complementary (as today's pairs).
- **Tested at:** 1,280, 1,440 and 1,920 px with both panels, one panel, none; the left panel at 520 and the right at 640
  (their maxima) at 1,280 px, where "More" must show.

### 4. Q3: the fit and the toolbar's room

**Fact.** `fitViewport` (`src/domain/canvas/geometry.ts:64`, pure, `pad` 40, 250 px on the right with the Overview open)
is called by `fitView` (`ModelCanvas.tsx:476`) for **the first view of a canvas with no remembered one**
(`ModelCanvas.tsx:1853`) and for **Fit** (`fit`, `:527`: the F key, the Fit button, the toolbox's "Fit everything on
screen", `canvas-host.tsx:551`). Two more view changes use React Flow's `fitBounds` with their own padding: **Zoom to
frame** (`useFrames.ts:820`) and **bringing new source tables into view** (`GroupActions.ts:537`). Placements read the
view's rectangle (`viewRect`, `:1000`): **a requirement's card at the view's top centre, 60 canvas px down** (`:1303`),
which at 50 % lies under a toolbar, and "Add to this canvas" at the upper third (`:1707`).

The prototype reserves the toolbar's measured bottom + 20 px (at least 40) in its `fitRect`, and defers a fit while the
page is in `pagemode`.

**Proposal.**
- **A constant, not a measurement:** the toolbar's box is fixed (12 px from the top, 4 + 28 + 4 px and its edge: its
  bottom at 50 px), so the reserved top is `TOOLBAR_TOP_ROOM` = 70 px (bottom + 20), in `geometry.ts` beside `pad`. No
  layout read; the canvas page knows it has a toolbar.
- `fitViewport` takes the top room as an argument (default 40, the other callers unchanged); `fitView` passes 70. Zoom to
  frame and the source tables' "into view" compute their view with the same function instead of `fitBounds`, so all
  four fits leave the room; their animation stays (`setViewport` with `duration: 250`, AD-24's note).
- **Placements** take the view's rectangle below the room (`viewRect` gets an option for it; the requirement card's
  60 px and the upper third count from there). The view-state bar, the selection's centring (`showPlace`, the screen's
  middle) and remembered views are unchanged: a remembered view opens as stored (D-54).
- **"Leaving a page, the canvas comes back at its own width, never shifted":** in the app the canvas is its own page, and
  a remembered view is corrected by the left edge in the one `setViewport` that opens it (`ModelCanvas.tsx:1846-1856`,
  D-54). The prototype's problem (one page whose canvas is narrowed by `pagemode`) does not exist here. With B4 (a) no
  home changes the layout cookie, so nothing changes the canvas's width while one is away. The spec checks it: a canvas's
  view, the workspace and project homes, back by a link, the view as stored.
- The unit tests: `fitViewport`'s reserved top, and the fit's bounds lying below the room.

### 5. Q4: the top bar's widths

**Fact.** `top-bar.tsx`: the switchers `min-w-[56px]` and at most 260, 150 (≤ 2,100), 128 (≤ 1,500) and 110 px
(≤ 1,300), 44 px minimum at ≤ 1,000; the brand hidden at ≤ 1,600 px; `bar-tools` shrinks with a weight of 0.001 so the
switchers reach their minimum first. The working context (`working-context.tsx:181`): its label at most 180, 90
(≤ 1,300), 56 (≤ 1,200) and 40 px (≤ 1,000), minimum 0 since slice 37 (24 px target), so at 1,201–1,250 px it is cut to its
icon (`known-limitations.md`). The working context is a canvas-page tool only (its provider is the canvas page's).

**What stays in the bar on a canvas page:** the left toggle, the path, the working context, Undo and Redo, the save pair
(`group-save`), the right toggle, the user indicator. **About 520 px at 800 px** (toggles 64, three switchers at 44, the
context at 40 + its icon and padding, Undo and Redo 60, the save pair about 110, the user 36, the gaps), so the bar has
room at every width.

**Proposal.**
- The switchers at most 280 px (the prototype's `.bar .projbtn`) down to 1,500 px, then 200 px to 1,300 px, then 160 px;
  56 px minimum, 44 px at ≤ 1,000 px. The step 3 measurement settles the values against "no name cut to a few letters at
  1,280 and 1,440 px" with the check script's long names (the demo's longest project and workspace names, and the script's
  long ones).
- The working context's label: `min-width: 40px` at every width, its maximum as today; the switchers shrink first
  (their weight stays), and the label then keeps 40 px. The 7 px tools gap goes (D-89's note).
- `bar-tools` stays the slot for the working context and Undo / Redo (the homes keep Undo and Redo there: S12A-01's
  "two buttons in `bar-tools`" holds).
- **S6A-10** checks the bar from 2,560 to 800 px: nothing cut, nothing outside, no scroll, and the path's names at least
  their minimum; and the toolbar at the same widths with both panels: nothing cut, "More" holding exactly what does not
  fit. **S6A-11** reads the canvas's place around the panels and the window's crossing of 1,000 px, not the bar: it
  stays (the PRD's list names it; the specs' search found nothing in it that reads the bar). **S16-08** goes back to its
  first rule: the label at least 40 px at the 13 widths from 2,560 to 800 px, inside its button, the bar never scrolling.

### 6. Q5 and Q6: the homes

**Fact.**
- **The workspace home** renders `AppShell` without `project` (`w/[workspaceId]/page.tsx:131`): no side panels, no
  toggles, and the layout cookie is not read. It is already a page; only its width changes.
- **The project home** passes `project` without `left` or `right` (`p/[projectId]/page.tsx:114`): the panels hold
  `PanelPlaceholder`s, "Open a canvas to work with the model, sources and requirements." and "Open a canvas to see the
  details of what you select." (`app-shell.tsx:67-68`). The toggles change the grid and the cookie only (`shiftView` is
  the default context's no-op there). The cookie is shared with the canvas pages.
- Both homes: `px-[clamp(16px,4vw,48px)]`, inner `max-w-[1180px]`, one column; tiles `minmax(220px,1fr)`.
- **The project home's sections:** the heading and description, the stat chips, model consistency (`max-w-[900px]`),
  model checks (`max-w-[900px]`), Canvases (tiles), Requirements (`max-w-[620px]`; each row: the kind's icon, the key,
  the name cut to one line, **the kind's name**, the coverage bar, "covered/total, status"), Labels in this project,
  Open notes, the delete section (`ProjectDelete`).
- **The workspace home's Overview:** the stats, the empty banner, Projects (tiles), Workspace lifecycle (admins:
  **one card**, `ArchiveBox`, grid `minmax(320px,1fr)`).
- Nothing on either home reads the side panels' context or `openDetails`.

**The prototype** (`pagemode`, `.pg-cols`, `.pg-more`): `.ph,.wh{max-width:1320px}`, the gutters `clamp(16px,4vw,48px)`;
the project home's children from the stats to "Requirements" in `.pg-main` (consistency, checks, Canvases), from
"Requirements" to the danger zone in `.pg-side` (Requirements, Labels, Open notes, "Other projects"), the danger zone
below at full width; `grid-template-columns: minmax(0,1fr) 420px; gap: 0 48px`, one column at ≤ 1,100 px; tiles
`minmax(240px,1fr)`; in `.pg-side` the requirement's kind hidden and the name wrapping; "Other workspaces in {org}" at
the Overview's end.

**Proposal** (with B3 (a), B4 (a), B5 (a)):
- **The project home without panels:** `AppShell` gets a page mode for a project page (the canvas tabs and the navigation
  row as today, no `SidePanelsGrid`, no toggles, the cookie not read). The workspace home is unchanged in its frame.
- **Width:** content up to 1,320 px, centred, the gutters as the prototype (`clamp(16px,4vw,48px)`; the PRD's "32 px" is
  the clamp's value at about 800 px, not a fixed gutter). Tiles `minmax(240px,1fr)` on both homes.
- **The project home in two columns** at > 1,100 px: left, consistency, checks and Canvases, each the column's width (the
  900 px caps go inside the column); right (420 px), Requirements (the kind's icon kept, its name dropped, the name
  wrapping), Labels, Open notes, Other projects; the delete section below, full width. One column at ≤ 1,100 px, in the
  same order.
- **"Other projects"** (project home, right column, after Open notes): "The model is shared by all {n} projects: an entity
  changed here is changed everywhere." and the other projects as links with their canvas counts, from `shell.projects`;
  with one project, the section is not shown (as the prototype's list would be empty). **"Other workspaces in {org}"**
  (workspace home, Overview's end): the other workspaces as links, "archived" where archived, from `shell.workspaces`;
  not shown when there is none. Their wording is taken from the prototype in step 4 and quoted in its report.
- **Lifecycle:** `repeat(auto-fit,minmax(260px,1fr))`.

### 7. Q7: InfoDocumenter's bar

**Fact.** The editor's page (`infodocumenter/app/pages.tsx:94`) draws `AppShell` without panels and with `savePair`
off: the app's top bar (the path, the user) and the navigation row (Documentation › the name) stay. The editor's bar
(`editor.tsx:447-504`, `editor-top`) is `flex flex-wrap … px-3.5 py-2`, 48 px plus its edge, and wraps. Its controls in
order: `button-toggle-sections` (about 32 px), `link-documentation` (about 110), **the name as a field**
(`input-document-name`, D-66's draft, in a fixed `w-[min(340px,40vw)]`, no ellipsis, a title only when invalid),
`badge-sharing` (about 58), `badge-read-only` (about 65, only when read only), a spacer, `text-pages` (45 to 100: empty,
"12 pages", "Laying out pages…"), `select-preview-mode` (about 105), `select-preview-zoom` (about 80), `button-print`
(about 75), `button-markdown` (about 70), `group-save` (about 120, D-84), `button-toggle-options` (about 32). The
read-only banner is the page grid's second row (`banner-document-read-only`, `button-duplicate-mine`). **At 1,280 px:
about 1,230 px**: a writable document fits; read only, or "Laying out pages…", wraps to a second row today.

**The prototype's `.de-top`** replaces the app's top bar (`#dedit` is fixed over the whole window); the PRD (DS3.3) keeps
the app's bar above it. That is a deliberate difference from the prototype, which section 13 names. The prototype's bar
also has "Generate version" (not in the app; the PRD's correction).

**Proposal.**
- One row, `flex-wrap: nowrap`, 48 px, as today's order (so S28-01's order, S34-01's Print → Markdown and S30-09-editor's
  save pair after Print hold). The PRD's list leaves out the save pair; it stays (D-84).
- **The name field flexible:** `flex: 1 1 200px`, at least 160 px, at most 340 px. A field cannot show an ellipsis while
  typed in; **while it has no focus** it shows the browser's `text-overflow: ellipsis` on the `<input>` (Chromium draws it;
  step 5 checks Firefox and WebKit with the browsers' smoke, `BROWSERS=1`) and **its title is the full name**. The draft's conflict line (D-66) is drawn under the bar as today.
- `text-pages` gets a fixed width for its longest text ("Laying out pages…"), so the row does not jump while pages are
  laid out.
- Below 900 px the row may wrap (the prototype's `@media (max-width:900px)`); at 1,280 px and wider never.
- The read-only banner stays where it is. The generated documents are compared as in slice 37 (`scripts/document-texts.ts`,
  `diff -r` against `documents-before`).

### 8. List rows (S38-05)

**Fact.** The prototype's rule (`.li .n:has(+.m.mono){max-width:65%}`, the `.m.mono` meta cut with an ellipsis) has one
producer: the entity's "Attributes and their sources". In the app that list has two forms (`entity-panel.tsx:174-233`):
read only, the shared `Li` (`fields.tsx:628-649`: the name `flex-1 truncate`, the meta at most 60 %, cut, no title since
the meta is an element); **editable, a row of its own whose meta is not cut at all** (`:229`: long physical names squeeze
the attribute's name to nothing and may run out of the row; no title). Other rows with physical names on the right:
the source table's "Columns and where they go" (`source-panels.tsx:152-171`, `Li`, meta the mapped attributes).

**Proposal.** One shape in `src/ui` for "name left, physical names right": the name whole up to 65 %, the physical names
cut with an ellipsis and their full text in the title. Used by both forms of "Attributes and their sources". The source
table's columns list keeps `Li` (its left side is the physical name, its right side the model's names: not this shape).
Rows with a short detail ("via attribute", "n mappings", a status) are unchanged.

### 9. The phone (S38-06)

**Fact.** Slice 37's after run (`.data/ui-check/after-20261127-0732/`): 50 overlaps, all on the 13 canvas screens at
390 px (the editor and the homes have none). On every canvas screen the top bar's working context, Undo and Redo run
over the right toggle and the user indicator (the bar is `overflow-hidden`). On the mapping and the cube mapping screens
the details panel's rows lie over the breadcrumbs: at ≤ 1,000 px a panel is an overlay `absolute top-0` inside the
grid that holds the canvas tabs and the navigation row (`globals.css:270-278`). The rest: the Overview's toggle under a
panel field, a note's ✓ under a panel field, the canvas tabs scrolling 768 px without a fade. The PRD's "28 overlaps"
are slice 37's step 10 count over 77 views; the before / after page compares the after run's 50.

**Proposal.**
- The top bar at ≤ 600 px: the toggles, the path and the user; the working context, Undo and Redo and the save pair
  hidden (as the prototype's `@media (max-width:600px)`).
- The overlay panels at ≤ 1,000 px start under the navigation row (their `top` the tabs' and the row's heights, fixed
  classes, no measurement), so the details panel no longer covers it.
- The toolbar at ≤ 600 px: the strip's full width less 8 px each side, scrolling sideways with the tab rows' fade
  (`tabsListVariants`' mask); "More" still takes what its breakpoints say.
- The canvas tabs with the fade (B8 (a)).
- The page: `overflow-x: clip` on `html, body` at ≤ 1,100 px (the prototype's rule; the app has none, and no page is
  wider than the screen today, so it is a safeguard).
- Whatever the after run still reports at 390 px is listed with its reason in step 6.

### 10. Q8: the earlier specs, by step

The search found about 22 files that break and none at 390 px. With B1 (a), B2 (a) and B4 (a):

| Step | Spec | Why it changes |
| --- | --- | --- |
| 2 | `slice-11/helpers.ts` (`entityBox`, `attributeBox`) | open "Names ▾" before a click; carries S11-02 to S11-07, S11-11, `fixes/write-after-reseed`, S14B-02 |
| 2 | S11-10 | the read-only title on the check boxes is read inside "Names ▾" |
| 2 | S11-screens (SCREENS), S11-13 and S11-13-commits (MEASURE) | the check boxes under "Names ▾"; "More" at 1,150 px by the canvas's width |
| 2 | S6A-10, its "More" part | "More" by the toolbar's width, its items read with the panels set, not the window |
| 2 | S30-09-room | the tools' labels from 2,101 px: the toolbar shows icons only (the prototype's `#ctb .tb span{display:none}`) |
| 2 | S16-10 (to be checked) | its right click in the pane must not land on the toolbar |
| 2 | the row pickers of S1B-10, S4P-fading, S15-18, `e2e/measure/switches.ts`, S30-measure (checked) | they pick a row below `pane.top + 10`, which may be under the toolbar |
| 3 | S6A-10, its top bar part | the bar's contents and widths |
| 3 | S16-08 | the label's 40 px at every width again |
| 3 | S5A-06, S30-09 (checked) | the toggles' and the save pair's places; expected to pass unchanged |
| 4 | S5A-02 | the project home has no panels and no toggles (B4 (a)); the remembered layout is checked on two canvases instead |
| 4 | S9-07, S12A-01 (checked) | the project home's description field is wider; Undo and Redo stay in `bar-tools` |
| 5 | none expected | the order stays (S28-01, S34-01, S30-09-editor, S28-06 checked) |
| 6 | none | no spec runs at 390 px |

The MEASURE-only specs that click the tools by test id (S6A-09, S6A-09-hand, S16-11) keep working; the element guard's
counts change (the toolbar's elements are in the viewport, the names' check boxes in a closed pop-over): its baseline is
read again in step 2 and the difference named (section 12). With B2 (b) or (c) about 45 more specs change (the specs'
list is in the search's notes; I give it if Łukasz picks one).

**New specs** (one per criterion, `e2e/slice-38/`): S38-01 (the toolbar's groups, every control's test id and shortcut,
"Names ▾" with its states and rights, "More" at a narrow canvas, the fit's room and Zoom to frame, the Changes bar under
the toolbar), S38-02 (the bar's contents, the path at 1,280 and 1,440 px with long names, the label's 40 px at the 13
widths), S38-03 (both homes without panels, the two columns and one column, the moved lists, the canvas's view after
the homes), S38-04 (one row at 1,280 px with a long name, read only and while laying out; the title), S38-05 (both forms
of the list), S38-06 (390 px: what the bar keeps, the panel under the navigation row, no sideways page scroll, the
toolbar's scroll), S38-07 (the check script's report, the documents' compare). Unit: the breakpoints' groups, the fit's
reserved top, the placements' view.

### 11. Where the PRD is wrong, contradicts the code, or costs more than it assumes

**F1. "Names ▾" is not in the prototype** (B1). The PRD says the prototype's script blocks show it; they do not: `#ctb`
holds the layer switch, Focus and Changes, the four tools, the notation and zoom (and the second window's button). The
names' check boxes are a decision (DS3.1), drawn in the toolbar's look. **Proposal:** B1 (a).

**F2. The prototype has no "More"** (B2). The PRD's "the same groups move into 'More'", "Q2: … a container query or a
resize observer" and "the tools (…, More tools)" describe the app's "More", not the prototype's, whose toolbar scrolls
(`overflow-x:auto`, a fade at ≤ 600 px). "More tools" is today's "More" itself (`button-more-tools`), not a tool.
**Cost:** by the canvas's width with today's thresholds, a 1,280 px window with both panels would put Focus, the notation
and the four tools in "More" and break about 45 specs. **Proposal:** B2 (a); "More" at the toolbar's right end.

**F3. The homes' side panels** (B3). The PRD's fact "both homes render inside the app shell with the side panels" is
wrong for the workspace home, and the right panel says nothing on either home: "Other workspaces in …" and "Other
projects" are new content. **Proposal:** B3 (a), from the shell's data; their texts from the prototype.

**F4. "The toggles still open a panel on a page"** (B4) opens a placeholder. **Proposal:** B4 (a); D-54's "on every page
with the panels" then means the canvas pages.

**F5. "The workspace's lifecycle cards four in a row"** (B5): one card exists. **Proposal:** B5 (a).

**F6. No performance gate** (B6). The toolbar is a new element over the canvas with its own shadow, above a
`will-change` layer: by overlap it becomes a composited layer of its own (the Overview, a `Panel` in the same position
kind, is one today). The zoom field re-renders on every zoom step as it does in the bar today. **Proposal:** B6 (a) in
step 2, the measuring spec `e2e/slice-38/S38-layers.spec.ts` and a `measure:canvas` sitting
(`--to-screen --only pan,c10 --rounds 2 --against slice-37`, after the warm-up run).

**F7. Full runs** (B7): step 2 is shared infrastructure ("the canvas's layers"). **Proposal:** B7 (a).

**F8. The canvas tabs** (B8): slice 37's guard exception names slice 38. **Proposal:** B8 (a), in step 6.

**F9. The Changes bar and the toolbar share a place** (Q1). Not in the PRD (the prototype has no such bar).
**Proposal:** the Changes bar under the toolbar.

**F10. Four fits, not one** (Q3). The PRD names `fitViewport`; Zoom to frame and the source tables' "into view" use
React Flow's `fitBounds`, and two placements put new cards in the view's top part. **Proposal:** all of them leave the
toolbar's room (section 4); a constant, not a measurement.

**F11. "Leaving a page, the canvas comes back at its own width, never shifted"** describes the prototype's single page.
In the app it holds already (D-54's left-edge correction); with B4 (a) no home can change it. **Proposal:** a spec, no
code.

**F12. "32 px side gutters"** (S38-03's section): the prototype's gutters are `clamp(16px,4vw,48px)`, as the app's.
**Proposal:** keep the clamp.

**F13. InfoDocumenter's name is a field** (S38-04): "a long name shortens with an ellipsis" applies while it has no
focus; the title gives the full name. The PRD's list leaves out the save pair (D-84), which stays. The prototype puts the
bar in place of the app's top bar; the PRD keeps the app's bar (DS3.3): a deliberate difference. **Proposal:** section 7.

**F14. "Requirements without their kind"**: the app shows the kind twice (its icon and its name). **Proposal:** the name
goes, the icon stays (the key's colour code, as on the canvas).

**F15. Shortcuts and labels in the toolbar.** The prototype's toolbar shows icons only; S38-01 says every control keeps
its title. Today the tools' labels show in the bar from 2,101 px (slice 30's S30-09-room). **Proposal:** icons only, the
titles unchanged, `aria-label` from the title where a control has no text (the PRD's rule); S30-09-room rewritten. The
layer switch shows its short labels ("All · Maps · Rels"), the notation "IE · UML".

**F16. "28 overlaps at 390 px"** is slice 37's step 10 count over 77 views; the after run has 50 over 271 views, all at
390 px on canvas screens. **Proposal:** the before / after page counts the after run's views on both sides.

**F17. The working context lives on canvas pages only.** S38-02's list is the canvas page's bar; on the homes the bar
has the path, Undo and Redo, the save pair (workspace home) and the user, as today. **Proposal:** no working context on
the homes (it would be a new feature).

**F18. D-60 and D-64 name the top bar.** "The zoom value … in the top bar" (D-60, and `typedZoom`'s comment) and the
names' check boxes "in the top bar after the layer switch (in 'More' on narrow screens)" (D-64). **Proposal:** notes on
both at the closing (section 14).

### 12. Q9: risks

- **The full run:** about 7 new spec files and the changes above; about one minute more in the last part (part 11, the
  longest at 12.9 min in slice 37's last run). The recut rule is checked after step 3's run.
- **The element guard** (MEASURE-only, never in the full run): the toolbar's controls move into the canvas's viewport
  (about 40 elements); the names' two check boxes stay in the page, closed. The difference is read in step 2 against
  slice 37's counts and named, as slice 8's one script tag was.
- **Container queries** are new in the app (none in `src/` today; Chrome 105, Firefox 110, Safari 16). They apply to the
  strip only.
- **The prototype's layout the app cannot take as is:** the toolbar's `top:82px` counts the prototype's tabs and
  navigation row inside one `#center`; in the app the canvas's `<main>` starts under them, so the toolbar is 12 px from
  its top. `.de-top` over the whole window (F13). Its toolbar's scrolling instead of "More" (B2).
- **What could change the plan:** B2 (b) or (c) adds about 45 spec changes to step 2; B4 (b) keeps the project home's
  panels and the cookie there; B6 (a)'s sitting may miss its bar, and then I stop and report (The slice cycle, 6).

### 13. The prototype and the app, where this slice touches them

| Prototype | App after slice 38 | Why |
| --- | --- | --- |
| `#ctb` scrolls when it does not fit | "More" by the toolbar's width (B2 (a)) | slice 6a's "More", the 45 specs |
| No "Names ▾" | "Names ▾" (B1) | DS3.1 |
| No Changes bar | the Changes bar under the toolbar | the app's Changes view (slice 7b) |
| `.de-top` replaces the top bar | under the app's top bar | DS3.3 |
| "Generate version" | not built | not in the app (PRD's correction) |
| Four lifecycle cards | one card in the same grid | the others are not built |
| The panel toggles on a home open a panel | no toggles on the homes (B4 (a)) | the panels are placeholders there |
| Second window button in `#ctb`, "All apps", "Proposals", InfoCatalog | not built | not in this slice |

### 14. The plan for steps 2 to 9

| Step | What | Checks |
| --- | --- | --- |
| **2** | The before run of the check script on `dev`'s look (`--label before`). The toolbar: the strip, the slot, the groups, "Names ▾", "More" by `@container`, the Changes bar under it, the fits and placements with the room; the specs of section 10's step 2. The measuring spec and sitting (B6). A draft PR into `dev`. | lint, typecheck, `npm test`, the touched specs as single files, the check script on the canvas screens; **a full run** (B7) |
| **3** | The top bar: what stays, the switchers' widths, the label's 40 px, the gap; S6A-10, S16-08. | as above; **a full run** |
| **4** | The project home as a page, both homes 1,320 px, the two columns, "Other projects", "Other workspaces in …", the lifecycle grid, the requirements' rows; S5A-02. | as above, the check script on the homes at 1,280 and 1,920 px |
| **5** | InfoDocumenter's bar in one row, the name field, `text-pages`' width. | as above, the documents' compare |
| **6** | List rows; the phone (the bar, the overlay panels under the navigation row, the toolbar's scroll, `overflow-x: clip`); the canvas tabs and the guard's exception (B8). | as above, the check script at 390 px |
| **7** | The after run, `--compare` into `slice-38-before-and-after.html`, the documents' compare, **a full run**. | |
| **8** | Łukasz's acceptance on `npm run dev:pg` with the demo accounts (section 6 of the PRD). **Stop.** | |
| **9** | Close: `decisions.md` (D-90 new; notes on D-89, D-54, D-60, D-64 and AD-24 for the toolbar's host; quoted in full), CLAUDE.md ("UI components", the canvas toolbar, "More"'s breakpoints, the homes as pages), `inventory-prototype-vs-app.md`, `known-limitations.md` (the label's entry closed; the narrow top bar's entry from slice 5a closed), `ideas.md`. A full run on the final commit. Merge and tag `slice-38` only on Łukasz's command. | |

**The decisions' texts:** there is no decision for "More" or the working context's width (slice 6a's item 9 and slice
16's item 5 are PRD items, not D-entries); D-90 takes them, and the notes go to D-54 (the toggles on the homes), D-60
(the zoom in the toolbar), D-64 (the names under "Names ▾"), D-89 (the label's limitation closed, the 7 px gap gone)
and AD-24 (the toolbar outside React Flow, its container query, the fits' room).

### 15. Ideas for `docs/ideas.md` (not built)

- The prototype's sideways-scrolling toolbar as an option for touch screens (B2 (b)), if "More" turns out awkward there.
- A working context on the project home (F17).
