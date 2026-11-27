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

## Step 2: the canvas toolbar (27 November 2026)

**The before run** of the check script on `dev`'s look (the branch before any application code): every screen, 1,280,
1,440 and 1,920 px light and dark and 390 px, in `.data/ui-check/before-20261127-1327/`, kept for the side-by-side page.

**What changed:**
- **The toolbar** (`src/canvas/CanvasToolbar.tsx`): a strip over the canvas's area in `AppShell`'s `<main>` (the new
  slot `canvasTools`, before the page's content), outside React Flow, `pointer-events: none` except on the toolbar; the
  toolbar centred 12 px from the top, radius 12, `shadow-pop`, 4 px inside, 28 px controls, a hairline between groups,
  `role="toolbar"` named "Canvas". Its order: the layer switch (All · Maps · Rels, the full names in the titles) |
  Focus, Changes | Hand, Entity, Note, Frame (the criterion's and the prototype's order) | IE · UML | “Names ▾” | zoom
  (−, the value, +, Fit) | “More”. Icons only (`toolButtonVariants({ size: "toolbar" })`, 28 px), each with an
  `aria-label` from its title before the colon; every title, test id and shortcut as before. The top bar keeps the
  path, the working context, Undo and Redo, the save pair, the toggles and the user (`TopBarTools`).
- **“Names ▾”** (`NamesMenu.tsx`, B1): a Radix pop-over in a portal with slice 11's two check boxes, their states, titles,
  rights and test ids; its content stays in the page while shut (`forceMount`, hidden).
- **“More” by the toolbar's room** (`more-breakpoints.ts`, B2): a container query on the strip for each group's wrapper,
  and for the menu's items (in a portal) the strip's width from a `ResizeObserver` (`toolbar-room.ts`). The widths
  measured as an editor with every tool: 631 px with everything, 591 without “Names ▾” (with “More”), 440 without Focus,
  Changes and the notation, 313 without the tools. **The breakpoints** (the strip's content width from which a group
  stays): “Names ▾” 635 px; Focus, Changes and the notation 595 px; the tools 444 px. Below 313 px the toolbar scrolls
  sideways. At 1,280 px with both panels at their defaults the strip offers 652 px: every control in the toolbar, 21 px to
  spare. The layer switch and zoom always stay.
- **The room** (F10): `TOOLBAR_TOP_ROOM` 70 px (`geometry.ts`); `fitViewport` takes it (the first view, Fit); zoom to
  frame and the four “bring into view” calls go through `showBounds` (React Flow's `fitBounds` with the room,
  `boundsViewport`); placements read the view below it (`placeRect`: a requirement's card, “Add to this canvas”, a placed
  card's stack, “New entity”'s free spot, requirement cards beside an element).
- **Under the toolbar** (F9): the Changes bar and the frame's concept question at 58 px (the toolbar's bottom + 8).
- **The toolbar scrolls only below 313 px of room** (the phone): a scroller is a composited layer of its own (below).

**Measuring (B6):**
- **LayerTree** (`e2e/slice-38/S38-layers.spec.ts`, the measurement build, Performance test at S3B-15's views): with the
  toolbar 49 drawing layers, without it 47, at 30 % and at 100 %; 68.7 against 68.5 and 68.5 against 68.4 megapixels; the
  canvas's viewport elements unchanged (4,508 and 19,305); 61 elements in the toolbar. **Both extra layers are composited
  by overlap** (CDP's compositing reasons): the strip with the toolbar's box over the canvas, and a squashing layer that
  starts at the separator after the layer switch. A constant, never one per card (AD-24). A first build had a third, the
  toolbar's own scroller (`overflow-x: auto`); the toolbar now scrolls only below 313 px. `will-change`, `isolation` and
  `contain: paint` on the toolbar or the strip did not remove the second (tried with `DIAG_CSS`, no build).
- **The element guard** (`S3B-15-elements`, `ELEMENTS_BASELINE` slice 8's counts): passed, every viewport count equal
  (the toolbar is outside React Flow's viewport). Page totals 6,144, 20,941, 3,011 and 6,453.
- **Pan and zoom to the screen against `slice-37` could not be measured.** The reference worktree and both builds are
  ready (`measure:canvas --prepare-only --against slice-37`); the warm-up and the counted sitting (`--to-screen --only
  pan --rounds 2`) dropped every round: the laptop never got below 2 % for 30 s before a side (Spotify, the Claude app,
  Webex and iCloud about 3 % together). CLAUDE.md: a sitting that cannot start is a stop, and Łukasz's programs are not
  closed. **Stopped for Łukasz** (below).

**Checks:**
- `npm run lint`, `npm run typecheck`, `npm test` (217 files, 2,627 tests; new: the fit's room, `boundsViewport`,
  `belowToolbar`, the breakpoints' order and literals).
- **The specs of the screens touched,** locally, one run with nothing beside it: 31 files, 55 passed, 3 failed (S2B-13,
  S5A-06, S16-10: a card's header or a frame's name under the toolbar, below); then those and the rest of the changed
  specs: 18 passed, then 11 passed.
- **The check script on the canvas screens** (`.data/ui-check/step2-20261127-1431/`: the canvas and star screens and the
  two new ones, `canvas-names-menu` and `canvas-narrow-more`): **at 1,280 px and wider nothing** (no overlap, no text out
  of its control, no words run together, nothing past the edge, no failing target, nothing cut). At 390 px 29 overlaps
  against the before run's 50 on the same screens: the top bar's are gone (its tools left it); left are the details
  panel's overlay over the toolbar's right end (Rels, zoom, “More”: the overlay is `z-40`, the toolbar `z-30`), the panel
  over the breadcrumbs, a note's ✓ and the Overview's toggle; `canvas-focus` at 390 px could not click “More” under the
  open details panel. Step 6's (the phone).
- **The full run** on `b8a16ce`, [run 46007612112](https://github.com/LukaszWolski-DA/infomapper-app/actions/runs/46007612112):
  15 min 43 s; 912 passed, **4 failed**, 16 skipped. The traces copied first (`.data/ci-46007612112/part-1`, `part-3`).
  All four are this step's, exact by their numbers, not flakes: S1B-07 (the entity 48 px off: the view 50 px lower,
  snapped to 8), S4B1-07 (499 canvas px at 10 %: the same 50 px), S4B2-02 and S4B2-05 (the placements below the room,
  F10). Fixed in the specs and run alone locally: 11 passed.
- **The full run again** on `557a974`, [run 46011865702](https://github.com/LukaszWolski-DA/infomapper-app/actions/runs/46011865702):
  14 min 27 s wall-clock (12 min 15 s of tests); **916 passed, 0 failed, 16 skipped**, no expected failures. Parts (time
  from `part.json`, the server's heap peak against its 6,431 MB restart threshold, no restarts): 1 11.3 min 1,186 MB;
  2 11.7 min 1,121; 3 11.0 min 1,480; 4 10.7 min 1,117; 5 6.4 min 1,674; 6 9.8 min 1,246; 7 6.2 min 1,454; 8 8.3 min
  1,534; 9 3.9 min 1,125; 10 4.8 min 1,446; 11 10.3 min 1,437.

**The earlier specs changed, with their reasons:**

| Spec | Why |
| --- | --- |
| `playwright.config.ts` (the chromium project) | the e2e window 1280 × 770, 50 px taller than Desktop Chrome's, the toolbar's height (below) |
| `slice-01a/helpers.ts` (`openCanvas`, `TOOLBAR_BOTTOM`, `belowToolbar`) | a spec's view is stored 50 px lower, under the toolbar (below) |
| S6A-10 | the bar from 2,560 to 800 px without the canvas's controls; the toolbar at the same widths: no scroll, each group in it or “More” there |
| S6A-11, S5A-07 | the view shown is the view `openCanvas` stored (`belowToolbar`) |
| S30-09-room | the tools are icons only at every width (F15), their names in `aria-label` |
| `slice-11/helpers.ts` (`clickBox`); S11-02, 03, 05, 06, 07, 10, 11, `fixes/write-after-reseed`, S14B-02 | a click on a names check box opens “Names ▾” first |
| S11-13, S11-13-commits (MEASURE) | the check boxes clicked by a dispatched click with the pop-over shut, as the timing measured before |
| S11-screens (SCREENS) | “More” on a narrow canvas, its screenshot's region |
| S1B-10, S4P-fading, S15-18, `e2e/measure/switches.ts`, S30-measure (MEASURE) | a row picked below the toolbar (60 px, was 10) |
| S1B-07, S4B1-07 | their points from the view under the toolbar (S4B1-07 opens its corners exactly at the pane's corners) |
| S4B2-02, S4B2-05 | the placements below the toolbar's room (F10) |

**Why the e2e window is 50 px taller.** The toolbar covers the canvas's top 50 px over almost its whole width (631 of
676 px at 1,280 px). About 76 specs open a view with y below 40 and then click a card's header or a frame's name there:
under the toolbar, Playwright scrolls `.react-flow` to reach it and the canvas scroll watch fails the test (S5A-06,
S16-10, S2B-13 in the first local run). Storing every spec's view 50 px lower (`openCanvas`) moves those targets below the
toolbar, but then content near the canvas's bottom met the Overview and the toasts, which are anchored to the bottom
(S2B-13's `order_line` under the Overview). A window 50 px taller moves the bottom-anchored things down by the same
50 px: each spec's canvas area shows what it showed before, in the same places against the Overview, the toasts and the
status bar. Specs that set their own window size keep it (none failed).

**Łukasz's answer (27 November 2026):** accepted as a technical call: the e2e window is 1280 × 770 (was Desktop Chrome's
1280 × 720) and `openCanvas` stores each spec's view 50 px lower, both because of the canvas toolbar's height. **For the
closing:** it goes into CLAUDE.md's "Testing".

**The prototype and the app** (section 13): the toolbar is the prototype's `#ctb`; its CSS `top:82px` counts the
prototype's tabs and navigation row, the app's 12 px count from the canvas's `<main>`; “Names ▾” and “More” are not in the
prototype (B1, B2); the separators are 2 px apart (the prototype's 4 px), so everything fits at 1,280 px with both panels.

**Stopped for Łukasz:** the pan-and-zoom sitting (B6's gate: within 3 % of `slice-37` at 30 % and 100 %) needs a quiet
laptop. Once Łukasz has closed or paused Spotify, Webex and the other programs, I run it on the builds already made: one
warm-up round, then `npm run measure:canvas -- --to-screen --only pan --rounds 2 --no-build --against slice-37`.

### Step 2: the pan-and-zoom sitting (27 November 2026, B6's gate)

Łukasz closed Spotify and Webex and paused iCloud. Both sittings ran on the builds already made (this branch at
`69a7541`, `slice-37` at `ed5e934`, the production measurement build, traced to the screen, the laptop on mains), each
with one warm-up round first and then two counted rounds, each side first once; no round was dropped.

**At 30 % and 100 %** (`--only s20`: S20-sitting, Performance test around src:57, 10 s of pan and zoom; sitting
`.data/measure/2026-11-27-15-11/`). Presented fps to the screen (traced), the untraced rAF fps beside it:

| Zoom | Round | slice-37 presented (rAF) | slice 38 presented (rAF) |
| --- | --- | --- | --- |
| 100 % | 1 | 44.0 (45.0) | 45.8 (47.2) |
| 100 % | 2 | 45.1 (46.9) | 45.0 (45.1) |
| 30 % | 1 | 50.2 (52.9) | 52.2 (52.9) |
| 30 % | 2 | 50.1 (50.2) | 51.6 (51.8) |
| **100 %, median** | | **44.5** (46.0) | **45.4** (46.2): **+1.9 %** (+0.4 %) |
| **30 %, median** | | **50.2** (51.5) | **51.9** (52.3): **+3.5 %** (+1.6 %) |

**At the overview (10–13 %) and 100 %** (`--only pan`: S1A-14; sitting `.data/measure/2026-11-27-14-54/`):

| View | Round | slice-37 presented (rAF) | slice 38 presented (rAF) |
| --- | --- | --- | --- |
| Overview | 1 | 52.8 (57.3) | 56.7 (57.4) |
| Overview | 2 | 56.0 (56.8) | 54.0 (57.2) |
| 100 %, dense | 1 | 42.0 (43.9) | 41.9 (46.0) |
| 100 %, dense | 2 | 42.1 (45.0) | 43.3 (46.1) |
| **Overview, median** | | **54.4** (57.0) | **55.4** (57.3): **+1.7 %** (+0.4 %) |
| **100 %, median** | | **42.0** (44.5) | **42.6** (46.0): **+1.3 %** (+3.6 %) |

The initial render (C-08, median of 5): 1,711 ms on `slice-37`, 1,720 ms here (+0.5 %).

**B6 met:** pan and zoom are nowhere slower than `slice-37`; every median is equal or faster, within the rounds' own
spread. The absolute bars the summaries mark "not met" (≥ 50 fps at 100 % in the dense area, no frame over 50 ms, C-08 ≤
1.5 s) are slice 1a's, missed by `slice-37` alike on this laptop (as in every sitting since slice 2p). S20's mark write
and its undo, measured in the same sitting, are slice 20's figures, unchanged in their medians (18 against 18 ms, 20
against 19 ms; their p95 move within 10 settled samples).

## Step 3: the top bar (27 November 2026)

**What changed** (`src/app/_components/top-bar.tsx`, `working-context.tsx`):
- **The bar holds** the left toggle, the path (organization / workspace / project), the working context, Undo and Redo
  (`bar-tools`), the save pair (the indicator and "Local"), the right toggle and the account; the canvas's controls are
  in its toolbar since step 2.
- **The switchers** are at most 280 px (the prototype's `.bar .projbtn`), 240 px up to 1,500 px; at least 56 px, 44 px up
  to 1,000 px. A long name ends with an ellipsis, and **each switcher's title starts with its full name**
  ("{name}: switch workspace, open the workspace home or create a workspace"; no spec read the old titles).
- **The working context's label** has `min-width: 40px` at every width; its maximum 180 px, 120 px up to 1,300 px, 90 px up
  to 1,000 px. The switchers still shrink first (the tools' shrink weight), so the label gives way only once they are at
  their minimum.
- **The window steps the bar no longer needs are gone:** slice 37's 7 px tools gap from 1,001 to 1,300 px, the tools'
  gaps at 2,100 px, the switchers' steps at 2,100 and 1,300 px, the label's step at 1,200 px; the path's separators now
  show above 1,000 px (were above 1,300 px). Kept: the brand above 1,600 px and the user's role above 1,500 px (D-84,
  S30-09-room), the narrow step at 1,000 px and "No working context" in words above 1,880 px.
- **`docs/known-limitations.md`:** "The working context's name at 1,201–1,250 px (slice 37)" closed.

**The widths** (S38-02: the demo with long names, "InfoMate Data Consulting Group", "Retail Co – Data warehouse for every
sales channel", "Customer 360 and loyalty across every sales channel"; both panels, the working context on, "Working on
CR-23"):

| Window | Organization (name shown) | Workspace (name shown) | Project (name shown) | Context label | Bar scrolls |
| --- | --- | --- | --- | --- | --- |
| 1,280 px | 221 px (191, whole) | 240 px (210, cut) | 240 px (210, cut) | 106 px (whole) | no |
| 1,440 px | 221 px (191, whole) | 240 px (210, cut) | 240 px (210, cut) | 106 px (whole) | no |
| 1,920 px | 225 px (191, whole) | 280 px (246, cut) | 280 px (246, cut) | 106 px (whole) | no |

A cut name shows about 30 characters ("Retail Co – Data warehouse for…"). The context's button is 136 px wide from 1,100 px
up (S6A-10, the seed's names).

**S16-08's label widths** (the seed's names, both panels, "Working on CR-23"; the bar never scrolls, the label never runs
past its button, the title names the context):

| Window | 2,560 | 2,100 | 1,880 | 1,600 | 1,536 | 1,300 | 1,250 | 1,201 | 1,200 | 1,101 | 1,100 | 1,000 | 800 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Label | 106 | 106 | 106 | 106 | 106 | 106 | 106 | 106 | 106 | 106 | 106 | 90 (cut) | 90 (cut) |

**The earlier specs changed, with their reasons:**

| Spec | Why |
| --- | --- |
| S16-08 | the label keeps 40 px at every one of the 13 widths (was from 1,300 px up); the check that it is cut at 1,201 px goes (it now has room) |
| S6A-10 | each switcher keeps at least its minimum (56 px, 44 px up to 1,000 px) at every width; its comment names the separators' new step |
| S6A-11 | unchanged in this step: it reads the canvas's place around the panels, not the bar (its view under the toolbar is step 2's) |

New: **S38-02** (the bar's contents, "Local", the switchers' titles, long names at 1,280, 1,440 and 1,920 px).

**Łukasz's answer (27 November 2026):** step 3 accepted. **For the closing:** the switchers' titles now start with the
full name ("{name}: switch …"), a deviation from S38-07's "every control keeps its title", needed for the ellipsis.
**Every later full run reports part 6's heap peak** (1,856 MB in this run).

**Checks:**
- `npm run lint`, `npm run typecheck`, `npm test` (217 files, 2,627 tests).
- **The specs of the screens touched,** locally, one run with nothing beside it: S16-08, S6A-10, S6A-11, S38-01, S38-02,
  S30-09-room, S30-09, S30-09-editor, S12A-01, S5A-06, S8-07, S0-04: 23 passed.
- **The check script on the canvas screens and the homes** (`.data/ui-check/step3-20261127-1726/`: the canvas and star
  screens, the workspace home with every tab, the project home): **at 1,280 px and wider nothing.** At 390 px the homes
  have no overlap, the canvas screens the same 29 as after step 2 (the details panel's overlay over the toolbar, the
  breadcrumbs, a note's ✓, the Overview's toggle) and `canvas-focus` cannot reach “More” under the open details panel:
  step 6's.
- **The full run** on `8d55de8`, [run 46033597542](https://github.com/LukaszWolski-DA/infomapper-app/actions/runs/46033597542):
  16 min 34 s wall-clock (14 min 0 s of tests); **917 passed, 0 failed, 16 skipped**, no expected failures. Parts (time
  from `part.json`, the server's heap peak against its 6,431 MB restart threshold, no restarts): 1 9.5 min 1,406 MB;
  2 9.1 min 1,429; 3 13.6 min 1,262; 4 10.9 min 1,067; 5 6.8 min 1,666; 6 9.5 min 1,856; 7 9.7 min 1,266; 8 9.6 min
  1,590; 9 3.7 min 1,453; 10 3.9 min 1,498; 11 12.0 min 1,474.

## Step 4: the homes as pages (27 November 2026)

**What changed:**
- **The project home is a page** (B4): `AppShell`'s project frame takes `page: true` (`app-shell.tsx`): the canvas tabs
  and the navigation row as before, no `SidePanelsGrid`, no panels' toggles in the top bar, and the panels' cookie is
  neither read nor written there (no `SidePanelsProvider`). The workspace home was a page already; its frame is unchanged.
  The two placeholders "Open a canvas to work with the model, sources and requirements." and "Open a canvas to see the
  details of what you select." are no longer shown on any page.
- **Both homes:** content up to 1,320 px (was 1,180), centred, the gutters `clamp(16px,4vw,48px)` as before; tiles
  `minmax(240px,1fr)` (were 220 px) on both homes.
- **The project home in two columns** above 1,100 px (`minmax(0,1fr) 420px`, 48 px apart): left, model consistency, model
  checks and Canvases at the column's width (their 900 px caps gone); right, Requirements, Labels in this project, Open
  notes, Other projects; the delete section below both, at the content's width. At 1,100 px and less one column, in the
  same order.
- **Requirements' rows** (`project-requirements.tsx`): the kind's icon and the key, the name wrapping (was cut to one
  line), the coverage bar and "covered/total, status"; the kind's name is gone; the list takes its column's width (was at
  most 620 px).
- **The workspace's lifecycle grid** `repeat(auto-fit,minmax(260px,1fr))` (was 320 px), with today's one card (Archive):
  with one card `auto-fit` gives it the row's width, as before.
- **Leaving a home for a canvas:** nothing to change. The canvas opens its remembered view corrected by its left edge
  (D-54), and no home changes the panels any more; S38-03 checks it.

**The new texts on the pages, word for word** (for Łukasz's approval):
- Project home, right column, after Open notes, only when the workspace has another project:
  - heading: **Other projects**
  - hint: **The model is shared by all {n} projects: an entity changed here is changed everywhere.** ({n} counts every
    project of the workspace, this one included, as the prototype's)
  - one row per other project, a link to its home: **{project name}**, and at the right **1 canvas** or **{n} canvases**
- Workspace home, Overview, after Workspace lifecycle, only when the organization has another workspace this person has:
  - heading: **Other workspaces in {organization name}**
  - one row per other workspace, a link to its home: **{workspace name}**, and at the right **archived** when it is
    archived (nothing otherwise: the prototype shows the client there, which the shell does not read; adding it would
    be a new read).

**The earlier specs changed, with their reasons:**

| Spec | Why |
| --- | --- |
| S5A-02, "hidden panels are remembered across a reload, another canvas and the project home" | the project home has no panels and no toggles (B4): it checks that they are absent, that the cookie passes through the home unchanged, and that the canvas after it shows the layout (was: the home's toggles hide and show its panels) |
| S5A-02, "the widths are remembered across a reload, another canvas and the project home, also while hidden" | the same: the widths pass through the home unchanged and the canvas after it shows them; the "hidden keeps its width" part now toggles on a canvas and opens another canvas |

New: **S38-03** (the project home without panels, its two columns at 1,280 px and one at 1,100 px, the right column's
420 px, the requirement row without the kind's name, "Other projects" and its absence with one project, the delete
section below; the workspace home at 1,320 px with 240 px tiles, "Other workspaces in InfoMate" with the archived Bank X,
its absence on another tab and for the only workspace of an organization; the canvas's view after both homes).

**Checks:**
- `npm run lint`, `npm run typecheck`, `npm test` (217 files, 2,627 tests).
- **The specs of the screens touched,** locally, one run with nothing beside it: every spec that opens either home (65
  files): 100 passed, 1 failed, S38-03's own expectation (the seed's Bank X is archived, so its row reads "Bank X – Risk
  DWH archived"); fixed, then S38-03 alone: 3 passed.
- **The check script on both homes at every width** (`.data/ui-check/step4-20261127-1829/`: the workspace home with
  every tab, the project home and the homes' dialogs, at 1,280, 1,440 and 1,920 px light and dark and at 390 px):
  83 views, **nothing found** (no overlap, no text out of its control, no words run together, nothing past the edge, no
  failing target, nothing cut, no page wider than the screen).
- No full run in this step (Łukasz's instruction).

**Łukasz's answer (27 November 2026):** step 4 accepted; the new texts approved word for word ("Other projects", its
hint, "1 canvas" / "{n} canvases"; "Other workspaces in {organization}", "archived"), and the client left out (no new
read).

## Step 5: InfoDocumenter's bar (27 November 2026)

**What changed** (`src/modules/infodocumenter/app/editor.tsx`; `TextField` in `src/app/_panels/fields.tsx`):
- **The document's bar is one row of 48 px** under the app's top bar (which is unchanged: the path, the account), the
  prototype's `.de-top`: `flex-nowrap`, at least 48 px, 8 px between controls, 12 px at the ends. **Nothing is added and
  the order is today's:** the sections' toggle, back ("← Documentation"), the name, Shared / Private, Read only (when read
  only), a spacer, the page count, the preview mode, zoom, Print / PDF, Markdown, the save pair (the indicator and
  "Local"), the options' toggle. Every control keeps its test id and behaviour; the read-only banner stays under the
  bar. Below 900 px the row may wrap (the prototype's step); at 1,280 px and wider it never does.
- **Only the name gives way:** 200 px by default, at least 160, at most 340 (was a fixed `min(340px, 40vw)`); every other
  control keeps its width (`flex: none`).
- **The name's field** shows the browser's ellipsis while it is not being edited and has the full name in its title
  (two optional props on the shared `TextField`, `title` and `ellipsis`; no other field uses them). Focused, the whole
  name is there to edit, as before. A conflict line under the name (D-66) still makes the row taller while it shows.
- **The page count** keeps the width of its longest text, "Laying out pages…" (104 px), so the row does not move while
  pages are laid out.
- The section list and the options panel are as slice 37 left them.

**The bar at 1,280 px with a long name** (S38-04: "Order management – source-to-target mapping of every order table for
the ETL team, second review"; widths in px, all in one row, the bar 48 px high):

| Control | Editor (Łukasz) | Read only (Piotr, the shared document, with the banner) |
| --- | --- | --- |
| `button-toggle-sections` | 32 | 32 |
| `link-documentation` | 122 | 122 |
| `input-document-name` (cut, its title the full name) | 276 | 236 |
| `badge-sharing` | 55 | 55 |
| `badge-read-only` | – | 70 |
| `text-pages` | 104 | 104 |
| `select-preview-mode` | 110 | 110 |
| `select-preview-zoom` | 81 | 81 |
| `button-print` | 80 | 80 |
| `button-markdown` | 78 | 78 |
| `group-save` | 124 | 124 |
| `button-toggle-options` | 32 | 32 |

At 1,536 px the name reaches its 340 px.

**The generated documents:** `npx tsx scripts/document-texts.ts s38-step5` and `diff -r` against slice 37's
`.data/ui-check/documents-before` (18 files: six documents' Markdown, HTML and CSS): **no difference.**

**The earlier specs changed:** none. The bar's order stays, so S28-01 (the order of `editor-top`'s controls), S34-01
(Print / PDF before Markdown) and S30-09-editor (the save pair after Print / PDF, not in the top bar) pass unchanged.
New: **S38-04** (one 48 px row at 1,280 px with a long name, as an editor and read only with the banner; the name's
ellipsis and title; editing shows the whole name).

**Checks:**
- `npm run lint`, `npm run typecheck`, `npm test` (217 files, 2,627 tests; the control-style guard passes).
- **InfoDocumenter's specs,** locally, one run with nothing beside it: slices 25, 26, 27, 28, 34 and 36, S30-09-editor
  and S38-04 (52 files): **104 passed, 12 skipped** (the measuring and screenshot specs), none failed.
- **The check script on the editor at every width** (`.data/ui-check/step5-20261127-1902/`: the editor, the Markdown
  dialog, "+ Add section" and a section's options, at 1,280, 1,440 and 1,920 px light and dark and at 390 px): 28 views,
  **nothing found** (no overlap, no text out of its control, no words run together, nothing past the edge, no failing
  target, nothing cut, no page wider than the screen).
- No full run in this step (Łukasz's instruction).

**Łukasz's answer (27 November 2026):** step 5 accepted.

## Step 6: list rows, the phone and the canvas tabs (27 November 2026)

**List rows (S38-05).** One shape in `src/ui/components/list-row.ts` (`ROW_NAME_WINS`, `ROW_PHYSICAL`, the prototype's
`.li .n:has(+.m.mono)`): the name keeps its own width up to 65 % of the row, then is cut; the physical names take the
rest, right-aligned, cut with an ellipsis, their full text in their title. **The rows changed:** the entity's
"Attributes and their sources" (also a fact's or a dimension's "… and their feeds", the same list), in both its forms:
read only (`Li` with its new `physical` prop) and editable (the reorder row, whose physical names were not cut at all
and could squeeze the name to nothing). Step 1 found no other row of that shape: the source table's "Columns and where
they go" has the physical name on the left and the model's names on the right (`Li` as before), and the rows with a short
detail ("via attribute", "n mappings", a status) keep `Li`'s own shape.

**The phone (S38-06).**
- **The top bar up to 600 px** keeps the panels' toggles, the path and the account; the working context, Undo and Redo
  (`bar-tools`) and the save pair (the indicator and "Local") are hidden (`top-bar.tsx`).
- **The side panels on a narrow screen** (up to 1,000 px, where they slide over the canvas) start at 128 px, below the
  canvas tabs (38), the navigation row (32) and the canvas toolbar's band (58: 12 px from the top, 38 px high, 8 px more)
  (`globals.css`): the details panel no longer covers the navigation row or the toolbar's right end, and "More" is in
  reach on every canvas screen (`canvas-focus` at 390 px clicks it).
- **The canvas toolbar** fits the phone through "More" (at 390 px it has 366 px of room and needs 313); below 313 px of
  room it scrolls sideways with the tab rows' fade at its end (`CanvasToolbar.tsx`). **The tab rows** scroll with the fade
  up to 600 px (the workspace home's and the left panel's since slice 37; the canvas tabs now too, below). No page scrolls
  sideways (the check script's "page wider" is empty on every screen).
- **The check script's rule** (`scripts/ui-check.ts`, `scripts/lib/ui-check-rules.ts`, a unit test): a side panel open
  over the canvas (`data-overlay`) covers what lies under it, as a dialog does, so a control below it is not seen; and a
  control that is not seen is now also left out of "words run together" and "targets under 24 px", as it already was of
  the overlaps. Before, a note's ✓ under the open panel, clipped to 4 × 4 px, counted as a failing target.

**The canvas tabs (B8).** `tabs.tsx` has a third density, `canvas` (the strip, 38 px, the tabs on its bottom line, the
shared fade up to 600 px), and `CANVAS_TAB` / `CANVAS_TAB_ON` (the raised tab and the open one); the tab's menu button is
`IconButton`'s 24 px look, "New canvas" the quiet small button (28 px, was 26), the rename field the small `Input` (28 px,
was 24). **The guard's exceptions: none** (`EXCEPTIONS` is empty; its "to convert" list was empty since slice 37).

**The overlaps at 390 px** (the check script's views at 390 px, light):

| Run | Views | Overlaps |
| --- | --- | --- |
| Before the slice (`before-20261127-1327`, `dev`'s look) | 31 | 50 (canvas 3, canvas-entity 4, canvas-attribute 4, canvas-source-table 4, canvas-mapping 6, canvas-requirement 3, canvas-note 4, canvas-toolbox 3, canvas-focus 4, star 3, star-cube-mapping 6, star-fact 3, star-dimension 3) |
| After step 3 (`step3-20261127-1726`) | 24 | 29, and `canvas-focus` could not reach "More" |
| **After step 6** (`step6-390-20261127-1921`) | **32** | **0** |

**The earlier specs changed:** none. New: **S38-05** (the entity's "email" row with its two sources in a 280 px details
panel, as an editor and as a reviewer: the name whole, at most 65 %, the sources cut with their full text in the title,
nothing out of the row) and **S38-06** (390 px: what the top bar keeps and hides, the details panel below the navigation
row and the toolbar, "More" in reach with the panel open and working, the canvas tabs' and the workspace home's tabs'
fade, no page wider than the screen): 4 passed.

**Checks:**
- `npm run lint`, `npm run typecheck`, `npm test` (217 files, 2,628 tests; the control-style guard passes with no
  exception; the rules' new test).
- **The specs of the screens touched,** locally, one run with nothing beside it: every spec that reads the entity's
  attribute list, the canvas tabs (their menu, the rename field, "New canvas") or runs at 1,000 px or less (53 files):
  **105 passed**, none failed.
- **The check script:** every screen at 390 px (`step6-390-20261127-1921`, 32 views) and the screens with list rows
  (`canvas-entity`, `canvas-source-table`, `star-fact`, `star-dimension`) at every width (`step6-rows-20261127-1923`,
  28 views): **nothing found** (no overlap, no text out of its control, no words run together, nothing past the edge, no
  failing target, nothing cut, no page wider than the screen).
- No full run in this step (Łukasz's instruction).
- **Line ends:** Python edits in steps 2 to 6 wrote the working copies of 43 files with CRLF; git stored them as LF in
  every commit (`.gitattributes`), so the pushed code and both full runs had LF. `tests/theme-css.test.ts` read the working
  copy of `globals.css` and failed once; the working copies are LF again and it passes.

**Łukasz's answer (27 November 2026):** step 6 accepted, with the check script's rule for side panels over the canvas:
a panel open over the canvas, marked `data-overlay` (and only that), covers what lies under it. **For the closing:**
D-89's check script names it.

## Step 7: the after run, the side-by-side page, the documents and the full run (27 November 2026)

**The after run** of the check script (`.data/ui-check/after-20261127-2003/`): every screen it knows, 1,280, 1,440 and
1,920 px light and dark and 390 px, 284 views: **nothing found** (no overlap, no text out of its control, no words run
together, nothing past the edge, no failing target, nothing cut, no page wider than the screen), no screen failed.

**The side-by-side page:** `C:\Users\Lukas\Desktop\Lukasz\infomapper-app\.data\ui-check\slice-38-before-and-after.html`
(`npm run ui:check -- --compare <before> <after> --slice 38`; the script's `--slice` names the page, its runs and the
findings' owner; slice 37's page is written as before without it). Before: step 2's run on `dev`'s look
(`before-20261127-1327`); after: this step's. 42 screens, each at 1,440 px light and dark and at 390 px, before on the
left. The summary over the 271 views both runs have:

| | Before | After |
| --- | --- | --- |
| Overlaps | 50 | **0** |
| Text out of its control | 0 | 0 |
| Words run together | 0 | 0 |
| Past the screen's edge | 0 | 0 |
| Targets under 24 px, failing WCAG | 0 | 0 |
| Targets under 24 px, passing by spacing | 1,004 | 833 |
| Text cut without an ellipsis | 0 | 0 |
| Pages wider than the screen | 0 | 0 |
| Kinds of button / field / drop-down / check box / link (light views) | 60 / 12 / 4 / 4 / 10 | 61 / 12 / 4 / 3 / 12 |

The 13 views added since (`canvas-names-menu`, `canvas-narrow-more`) are after only: 0 overlaps, 0 failing targets,
0 words run together. **Findings left: none.** The kinds: one button kind more (the toolbar's 28 px icon buttons and
"Names ▾"), one check box kind fewer (the names' boxes in their pop-over's 28 px rows), two link kinds more (the homes'
"Other projects" and "Other workspaces" rows, and the canvas tabs' links on the shared tab look).

**The generated documents:** `npx tsx scripts/document-texts.ts s38-after` and `diff -r` against slice 37's
`.data/ui-check/documents-before` (18 files): **no difference.**

**The full run** on `8496b34`, [run 46055221229](https://github.com/LukaszWolski-DA/infomapper-app/actions/runs/46055221229):
15 min 50 s wall-clock (13 min 24 s of tests); 925 passed, **1 failed**, 16 skipped, no expected failures. Parts (time
from `part.json`, the server's heap peak against its 6,431 MB restart threshold, no restarts): 1 12.9 min 1,288 MB;
2 10.9 min 1,304; 3 13.1 min 1,198; 4 7.2 min 1,483; 5 6.4 min 1,711; **6 8.3 min 1,580** (1,856 in step 3's run);
7 9.7 min 1,293; 8 8.5 min 1,641; 9 4.6 min 1,211; 10 4.1 min 1,483; 11 9.4 min 1,576.
- **The failure: `S32-03`** (part 11), "a thumbnail takes the chosen theme against the system, and follows a switch at
  once": the person's menu did not open for the second choice (`indicator-user` stayed `aria-expanded="false"` for
  15 s). The trace was copied first (`.data/ci-46055221229/s32-03-trace-copy/`): Light was chosen and checked, Escape
  closed the menu, and the next click on the account button was swallowed while the closing menu was still in the page
  (Radix keeps the page's pointer events off until its closing animation ends; the helper's comment names the same race
  for a click on an item). **Alone,** the single-file check
  [run 46057245561](https://github.com/LukaszWolski-DA/infomapper-app/actions/runs/46057245561), 3 rounds side by side:
  **3 of 3 passed** in each round. A flake of slice 32's helper `openUserMenu` (it clicks without waiting for the closing
  menu to go), not of this slice: **reported, not fixed here** (a fix waits for the menu to be gone before the click; on
  its own `fix/` branch or here, as Łukasz decides).

## Step 8: Łukasz's acceptance, what to open and where to look

1. **The side-by-side page first:** open
   `C:\Users\Lukas\Desktop\Lukasz\infomapper-app\.data\ui-check\slice-38-before-and-after.html` in a browser (a
   double-click opens it; no server needed). At its top: the summary (overlaps, text out of its control, words run
   together, controls past the edge, small targets, cut text, pages wider than the screen, before and after) and the
   findings left. Below: each screen before (left, `dev`'s look) and after (right), at 1,440 px light and dark and on a
   phone (390 px). A click opens a picture full size; every width (1,280, 1,440 and 1,920 px) is in the two folders next to
   the page.
2. **The app on Postgres** (environment 2, `infomapper-dev`, the demo accounts only; KB is not opened): on the branch
   `slice/38-design-system-layout`, in a terminal in the repository:

   ```powershell
   npm run dev:pg
   ```

   Then open http://localhost:3000 and sign in as the demo's owner **`lukasz@infomate.pl`** with the demo password
   (`INFOMAPPER_DEMO_PASSWORD` in `.env.postgres.local`). Stop the server with Ctrl+C when done. For long names, rename a
   project on its home (e.g. "Customer 360 and loyalty across every sales channel") and put it back with Undo.
3. **The screens and what to look at:**
   1. **A canvas with both panels at 1,280 px** (Retail Co – DWH › Customer 360 › Customer & orders; a window about
      1,280 px wide): the toolbar floating at the canvas's top, centred: All · Maps · Rels | Focus, Changes | Hand,
      Entity, Note, Frame | IE · UML | "Names ▾" | zoom, every control in it, no "More". Open **"Names ▾"**: the two check
      boxes, as before. Press **F** or the Fit button: the highest card stands below the toolbar, never under it. If the
      canvas has a frame, its menu (a right click inside it) › Zoom to frame: the frame below the toolbar too. Turn **Changes** on: its bar under the
      toolbar. Tooltips: every control's title as before.
   2. **The same canvas narrower:** widen the right panel by its edge (or make the window about 1,100 px): first "Names ▾",
      then Focus, Changes and IE · UML, then the four tools go into **"More"** (⋯ at the toolbar's right end), each
      working from there (e.g. More › UML).
   3. **The top bar's path:** the organization, workspace and project switchers with room (up to 240 px at 1,280 and
      1,440 px, 280 px wider); a long name ends with an ellipsis, its full name starting the switcher's tooltip. With a
      working context on ("Working on …"), its label never shrinks below about 40 px; the bar never scrolls. The top bar
      no longer holds the canvas's controls.
   4. **Both homes:** the project home (Home tab): no side panels and no panel buttons; up to 1,320 px wide, centred; two
      columns above 1,100 px (model consistency, model checks and Canvases on the left; Requirements without the kind's
      name, Labels, Open notes and **Other projects** on the right), the delete section below; one column when narrower.
      The workspace home: up to 1,320 px, tiles at least 240 px, **Other workspaces in InfoMate** at the Overview's end
      (Bank X – Risk DWH, archived). Back to a canvas: it opens where it was left.
   5. **InfoDocumenter's bar with a long name** (Documentation › a document; rename it to a long name): the app's top bar
      above it as everywhere; under it one row of 48 px at 1,280 px: the panels' buttons, ← Documentation, the name (an
      ellipsis while not edited, its full name in the tooltip; click to see it whole), Shared / Private, the page count,
      Auto, Fit width, Print / PDF, Markdown, the save state and "Online · dev"; read only (a reviewer on the shared
      document) the same row and the banner under it.
   6. **A phone-width window** (about 390 px; the browser's device toolbar or a narrow window): the top bar with only the
      panels' buttons, the path and your initials; the canvas toolbar with the layer switch, zoom and "More"; open the
      details panel (the right button): it slides in below the tabs, the navigation row and the toolbar, and "More" still
      opens; the canvas tabs and the workspace home's tabs scroll sideways with a fade at their end; no page scrolls
      sideways. In the entity panel's "Attributes and their sources": the attribute's name whole, its source columns cut
      with an ellipsis, their full text in the tooltip.

**Łukasz's answer (27 November 2026), with step 8:** **S32-03 is left as it is** in this slice and known: its fix
(slice 32's helper `openUserMenu` waits for the closing menu to be gone before its click) goes to its own `fix/` branch
from `dev` after this slice's merge, as S36-list's did.

**Step 8, Łukasz's acceptance (27 November 2026):** on `npm run dev:pg` with the demo accounts (KB not opened): the
side-by-side page, then the canvas at 1,280 px and narrower (the toolbar, "Names ▾", a fit, the Changes bar, "More"),
the top bar's path, both homes, InfoDocumenter's bar and a phone-width window. "It looks great", no notes. `dev:pg` is
stopped.

## Step 9: the closing (27 November 2026)

**The docs:**
- `docs/decisions.md`: **D-90 (new)**, the layout, with a note of the calls Łukasz accepted; **notes (slice 38, D-90)**
  on D-54 (the panels on canvas pages only, the overlay below the toolbar), D-60 (the zoom in the toolbar), D-64 (the
  names' check boxes in "Names ▾"), D-84 (the top bar's room), D-89 (the working context's limitation closed, the 7 px gap
  gone), AD-20 (the guard without an exception, the check script's overlay rule and `--slice`) and AD-24 (the toolbar
  outside React Flow, its layers, the fits' room). Slices 6a's, 11's and 16's places of "More", the names' check boxes and
  the working context are PRD items, not D-entries (step 1, section 14): D-90 holds them, and D-64's note covers slice 11's.
- `CLAUDE.md`: slice 38's sentence; "UI components" (the canvas toolbar, the homes as pages, the tab variants' `canvas`
  density, `toolButtonVariants`' `toolbar` size, `list-row.ts`, the guard without an exception, the check script's
  overlay rule and `--slice`); the view-state bar's paragraph ("More" in the toolbar); slice 11's helpers ("Names ▾");
  the side panels on canvas pages only; "Testing": the e2e window 1,280 × 770 px and `openCanvas`' 50 px.
- `docs/inventory-prototype-vs-app.md`: the layout done, the deliberate differences of slice 38.
- `docs/known-limitations.md`: slice 11's "check boxes in More up to 1,300 px" changed (step 3 had closed the working
  context's entry).
- `docs/ideas.md`: slice 38's follow-ups (the scrolling toolbar on touch screens, a working context on the project home,
  the workspace's client in "Other workspaces in …", the unused `SEGMENTED_BAR_*`).
- `README.md`: slices 37 and 38 (slice 37's sentence and acceptance link were missing) and the check script's `--slice`.

**Every deviation from the PRD and every call Łukasz accepted** (D-90's note quotes them): B1 to B8 as recommended, B6's
bar; section 11's corrections (F9, F10, F12, F13, F14, F15, F17); "Generate version" not in the app; the e2e window
1,280 × 770 px and `openCanvas`' 50 px (step 2); the measuring sitting's figures (step 2); the switchers' titles starting
with the full name, a deviation from S38-07 (step 3); the homes' new texts and the client left out (step 4); the check
script's overlay rule (step 6); S32-03 known, fixed on its own branch (step 7).

**The full run** on `b76b63d6b688bea0d9dc62a929dcdfcea7f789d9` (the closing's docs commit, `dev`'s head `15f6ba0`
contained), [run 46067629605](https://github.com/LukaszWolski-DA/infomapper-app/actions/runs/46067629605): 15 min 23 s
wall-clock (13 min 2 s of tests); **926 passed, 0 failed, 0 flaky**, 16 skipped, no expected failures. Parts (time from
`part.json`, the server's heap peak against its 6,431 MB restart threshold, no restarts): 1 9.7 min 1,272 MB;
2 8.2 min 1,481; 3 9.1 min 1,575; 4 7.7 min 1,366; 5 6.6 min 1,656; **6 12.6 min 1,155**; 7 9.8 min 1,207;
8 12.3 min 1,142; 9 4.9 min 1,267; 10 5.5 min 1,146; 11 9.7 min 1,595. S32-03 passed. The commit after it changes only
this file (`git diff --stat b76b63d..HEAD`), so the run counts for it ("Test runs").
