# Slice 5a – Acceptance

Status: **step 2 (show and hide).** Branch `slice/05a-side-panels`, from `main` at the tag `slice-04b2`
(`1bd3a13`). PRD: `docs/prd/slice-05a-side-panels.md`.

## Łukasz's answers to step 1 (20 October 2026)

Step 1 accepted.

1. **Cookie** per person, as the working context does, so the server draws the right layout from the start (P1).
2. **No `ModelCanvas` re-render on a size change** (P2); S5A-07 is checked against zero canvas and zero miniature
   commits. The first view after a load must still be placed correctly: a check of its own (S5A-07).
3. **Narrow screens:** a selection does not open the details overlay; clicking an entity or a table in the left
   overlay closes it.
4. **The two Q4 lists** as written.
5. **Yes to all four** (mounted when hidden, the saved view accepted, the test rule's reading, the toasts), with an
   addition: a hidden panel stays in the page but is **inert** (not reachable by Tab, hidden from screen readers),
   and that is tested.

**The PRD's note that resizing probably exists is wrong** (section 1, item 3): the app has fixed widths and no grips;
step 3 builds the grips, their limits, double-click, keyboard and stored widths from scratch.

D-54: the final text is quoted in step 4, where Łukasz approves it.

## Step 2: show and hide (items 1–6, 12–13)

**What changed**
- `src/ui/side-panels-cookie.ts`: the layout cookie `im-panels.<userId>` (`l1.r0.264.340`: shown or hidden, both
  widths), the prototype's limits; an unreadable value gives the defaults. Unit tests next to it.
- `src/app/_components/side-panels.tsx`: `SidePanelsProvider` (state, cookie, narrow screens, `openDetails`,
  `closeLeftOverlay`), `SidePanelsGrid` (the three columns; a hidden panel keeps its content, `visibility: hidden` and
  `inert`), `PanelToggle` (the prototype's icons and titles, `aria-pressed`). `AppShell` reads the cookie on the server
  and wraps project and canvas pages in the provider; `TopBar` puts the buttons at its two ends.
- `src/app/globals.css`: `.im-panels`; up to 1000 px the panels lie over the canvas (300 px, shadow), one at a time.
- No jump: the left button calls `ui.shiftView(±width)` in the same click (`ModelCanvas`'s new `shiftView`, a
  `setViewport` without duration, which React Flow applies at once).
- P2: `ModelCanvas` subscribes only to “the pane has a size”, not to the size; the first view reads the size from the
  store.
- Q4: `canvas-host.tsx` (the six menu items, “Show what is inside”, the Entity tool, “New entity here”, a new frame)
  and `left-panel.tsx` (“+”, “New requirement”, a requirement's click) call `openDetails`; an entity's or a table's
  click calls `closeLeftOverlay`. `focusField` waits until the panel is no longer inert. A canvas opened with `?card`,
  `?label`, `?req` or `?note` is drawn by the server with the panel shown, and the browser remembers it.

**Found in the browser:** at 900–1,000 px the canvas page's top bar is about 1,080 px wide, so the new right button
(and the user indicator, already before) lay outside the window. Playwright still clicked it, as it scrolls a clipped
bar. The canvas tools now sit in a container that is cut off first (`top-bar.tsx`); S5A-06 checks that both buttons
are inside the window. Making the tools fit is in `docs/ideas.md`.

**Tests** (`e2e/slice-05a/`): S5A-01 (buttons, widths, both hidden; inert: Tab and the accessibility tree), S5A-02
(reload, another canvas, the project home, per person, an unreadable cookie, blocked cookies), S5A-03 (hide and show at
100 % and 35 %, ±1 px), S5A-04 (selections; the four links; the six menu items with the field focused; creating;
requirements), S5A-06 (1000 px window), S5A-07 (0 canvas and 0 miniature commits for four switches; the first view
after a load, remembered and fitted, with the left panel hidden). The grips' parts of S5A-02, -03, -05, -06 and -07
come in step 3.

**Runs (step 2):** lint, typecheck, unit tests (1,028) pass. `e2e/slice-05a` 19 of 19. The earlier specs for what the
step touched: `slice-00` (all), S1B-03, S1B-07, S2B-01, the commit-counter specs S2C-12, S3A-14-idle, S3B-15-idle,
S3B-13, S4P-12, S4B1-06, and S4A-01, S4A-02, S4A-11: 37 of 37 (6.6 min). After the top-bar fix: `slice-05a`,
`slice-00`, S1B-07, S2B-01 again, 41 of 41 (6.8 min). No test failed, so none was run three times. S1B-03's
`setPanelWidth` still works unchanged (it sets the grid's columns inline); it changes with the grips in step 3.

## Answers to the PRD's questions (step 1)

Checked in the code on `1bd3a13` and in the prototype's source, not from memory.

### Q1. What the app has today

- **Nothing to resize.** `src/app/_components/app-shell.tsx` is a grid with fixed columns `264px 1fr 340px`
  (Tailwind `lg:grid-cols-[264px_1fr_340px]`). No grips, no limits, no double-click, no keyboard, no stored widths.
  The PRD's guess (section 1, item 3) does not hold: step 3 builds the grips from scratch.
- **Prototype:** `PANEL` = left 200–520 (default 264), right 280–640 (default 340). The grips (`#gripL`, `#gripR`,
  `.pgrip`, 8 px wide, a 2 px line on hover, focus and drag) resize live on every pointer move; double-click resets and
  toasts “Left panel width reset.” / “Right panel width reset.”. **Keyboard:** ← / → by 16 px, **Shift by 64 px**,
  Home resets; on the right grip → narrows the panel (the edge moves right). Widths are saved with the rest of the
  prototype's state in `localStorage`; the hidden panels (`noleft`, `noright`) are not.
- So item 10 follows the prototype: ←/→ 16 px, Shift+←/→ 64 px, Home to the default, applied at once.

### Q2. The toolbar

- The app's toolbar is `TopBar` (`src/app/_components/top-bar.tsx`), rendered by `AppShell` on workspace, project and
  canvas pages; canvas pages pass their tools (`CanvasTools`) before the user indicator.
- **Left button:** first in the bar, before “InfoMapper” (prototype `#tLeft`, before `.brand`). **Right button:** after
  the canvas tools, before the user indicator (prototype `#tRight`). Both with the prototype's icons and titles and
  `aria-pressed`; test ids `button-toggle-left`, `button-toggle-right`.
- **Project home:** it has the same `TopBar` and the same two (empty) panels through `AppShell`, so it gets the same two
  buttons; no canvas tools, nothing else. **Workspace pages** have no side panels and get no buttons.

### Q3. How a canvas resize reaches React Flow

- React Flow 12.12 watches its wrapper with a `ResizeObserver` (`useResizeHandler`) and writes `width`/`height` into its
  store. Subscribers today: `ModelCanvas` (`src/canvas/ModelCanvas.tsx:316`), `Overview`, `ZoomControls`, `FadeLayer`.
  The miniature itself does not read the size (its commits come from nodes and notes), so a resize is **one canvas
  commit and no miniature commit** today.
- `ModelCanvas` reads the size **only** to place the first view (`readView(canvasId) ?? fitView(width, height)`, line
  1466). **Proposal P2:** read it from the store API in that effect (`storeApi.getState()`, with a subscription until
  the first view is placed) instead of `useStore`, so a later resize causes **no** canvas commit. S5A-07 then states:
  hiding, showing, a release and a double-click each cause **0 canvas commits and 0 miniature commits** (the Overview's
  frame and the zoom controls still re-render; they are small and outside the canvas).
- **Correction without a second commit (item 6):** the button, the grip's release, the double-click and the keyboard
  change the panel state and call `setViewport({ x: x ± Δ, y, zoom })` in the same event handler. React batches the
  panel's re-render and the transform; the browser lays out the new grid, the `ResizeObserver` runs before paint, so
  the new size and the moved viewport reach the screen in one frame. Δ is the left panel's width change (hide: +width,
  show: −width, resize: new − old). The right panel needs nothing. On narrow screens the panels lie over the canvas and
  nothing moves.

### Q4. Actions that open a hidden right panel

**Open it** (they lead to details on purpose):
- arriving on a canvas through a link that names what to show: `?card=` (“On other canvases” in an element's panel),
  `?label=` (the project home's labels), `?req=` (the project home's requirements), `?note=` (the project home's notes);
- menu items that put the cursor in a panel field: “Edit transformation rule…”, “Merge mappings…”, “Edit name and
  cardinality…”, a frame's “Rename…”, a row's “Map from a column…” and “Map to an attribute…”; and a bundle's
  “Show what is inside”;
- creating something whose name is then typed in the panel (`setNameFocus`): the Entity tool, “New entity here”, “+”
  per concept and “New requirement” in the left panel, drawing a new frame;
- clicking a requirement in the left panel's Requirements tab (its panel is the only place it is shown).

**Leave it hidden:** selecting by click (card, row, line, frame, block, bundle, note, requirement card), the lasso,
Ctrl+A, clicking an entity or a table in the left panel's Model and Sources tabs (it selects or places the card),
undo and redo, Focus, the working context, toasts' Undo.

An action that opens the panel shows it the same way as its button does (remembered until hidden again).

### Q5. Narrow screens today

- Below Tailwind's `lg` (**1024 px**) both panels are `hidden` and the grid has one column. There is no way to open
  them; the toolbar is unchanged.
- Items 12–13 change: the breakpoint becomes the prototype's **1000 px** (`max-width: 1000px`), so windows of
  1001–1023 px get the panels back. Up to 1000 px both are hidden by default; a button slides its panel over the canvas
  (absolute, full height, **300 px** as in the prototype, with its shadow), opening one closes the other, the same
  button closes it; no grips; the canvas keeps its size. The narrow state is not remembered.
- **Prototype detail the PRD leaves open (question 1 below):** on a narrow screen the prototype also opens the details
  overlay on **every** selection (`select()`, `setMulti()`) and closes the left overlay after an item is clicked in it.

### Q6. Earlier tests that change

- `e2e/slice-01b/S1B-03.spec.ts`: its `setPanelWidth` writes the grid's `gridTemplateColumns` by hand. It will set the
  width through the right grip's keyboard (or the stored width) instead; the checks stay.
- No other spec depends on the panel widths or the breakpoint: the default layout (both shown, 264 / 340 px) is
  unchanged, the e2e viewport is 1280 × 720 and the measuring specs use 1536 × 864, both above 1000 px, and every test
  starts with an empty browser profile. The screenshot specs (`S4P-04`, `S4B1-06`, only with `SCREENS`) are not gates.
- If P2 is taken, `ModelCanvas` changes: the commit-counter specs `S2C-12`, `S3A-14-idle`, `S3B-15-idle`, `S3B-13`,
  `S4P-12` and `S4B1-06` run in that step.

## What is wrong, unclear or costly in the PRD, with proposals

1. **Remembered in `localStorage` means a flash and a jump on every load** (items 3, 11). The server renders the
   default layout, the browser then hides a panel after mount: the canvas resizes once, the first view is placed for
   the wrong size, and a hidden panel flashes. **Proposal P1:** keep the state in a **cookie** per person
   (`im-panels.<userId>`: left and right shown, both widths), written by the browser and read by the server, as the
   working context does (`src/ui/working-context-cookie.ts`). It is still “in the browser”; the first paint is right.
   A missing or malformed cookie, or a blocked `document.cookie`, gives the defaults with both panels shown (S5A-02's
   storage error: a malformed value and a throwing `document.cookie` setter).
2. **S5A-07's bound** (“at most the commits of one canvas resize”): with P2 it becomes 0 canvas and 0 miniature commits.
3. **Narrow screens and selection** (question 1 below).
4. **Hidden panels stay mounted**, with `visibility: hidden`, `inert` and width 0 (as the prototype keeps them in the
   DOM): the left panel's folds, search and scroll and the inspector's state survive hiding.
5. **A saved canvas view and a different left panel.** Each canvas remembers its last view in pane coordinates
   (`infomapper:view:<id>`). A view saved with the left panel shown and opened with it hidden is 264 px further left on
   the screen than it was. Item 6 covers the moment of hiding, not this. **Proposal:** accept and note it in
   `docs/known-limitations.md`.
6. **The test rule's “tests of the files it touches”.** `AppShell` is on every page, so read literally it means the
   whole suite. **Proposal:** after each step, the slice's own specs, the specs listed in Q6 for what the step changed,
   and CI; the full run only before the merge, as agreed.
7. **Item 9's double-click**: the prototype toasts “Left panel width reset.” / “Right panel width reset.”. **Proposal:**
   keep the toasts (prototype wording); not on Home.

## Questions for Łukasz

1. **Narrow screens and selection.** The prototype opens the details overlay on every selection and closes the left
   overlay after a left-panel click. **Proposal:** item 5 holds on narrow screens too (selection does not open the
   overlay; the Q4 actions do), but a click on an entity or table in the left overlay closes it, so the card it placed
   or selected is visible.
2. **P1, the cookie** instead of `localStorage`. **Proposal:** yes.
3. **P2, `ModelCanvas` without a size subscription,** and S5A-07 at 0 canvas and 0 miniature commits. **Proposal:** yes.
4. **The Q4 lists** as written. **Proposal:** yes.
5. **Items 4–7 of the list above** (mounted when hidden, the saved view accepted, the test rule's reading, the toasts).
   **Proposal:** yes to all.

## Docs plan (PRD section 9)

| File | Change | When |
| --- | --- | --- |
| `docs/decisions.md` | new **D-54 “Side panels”** under “Projects and navigation”, text below, only with your approval of it | step 4 (with the code's PR) |
| `docs/inventory-prototype-vs-app.md` | “Show or hide the side panels”: done in 5a; the canvas row's “panels: –” | step 4 |
| `docs/known-limitations.md` | the saved view and a different left panel (answer 5); “The project home has no left panel or inspector” gets a line: the empty panels follow the same state | step 4 |
| `README.md` | status: slices 0 to 4b-2 merged, 5a's side panels; the small-slice test rule in one line | step 4 |
| `CLAUDE.md` | Testing: the test rule for small slices; the panel cookie and the new e2e helpers (`togglePanel`, `dragGrip`, …) in the helpers list | step 4 |
| `docs/prd/slice-05a-acceptance.md` | this file: answers, step reports, the step 3 diagnosis, the manual checklist | every step |
| `docs/ideas.md` | anything that comes up and is not in the PRD | when it comes up |

**Proposed D-54** (for your approval, wording open):

> - **D-54** Side panels: the object browser and the details panel are shown or hidden by the toolbar's buttons at its
>   two ends and resized by dragging their inner edge (left 200–520 px, default 264; right 280–640 px, default 340;
>   double-click or Home resets, ←/→ 16 px, Shift 64 px). While dragging only a guide line moves; the panel and the
>   canvas change size once, on release. Hidden panels and widths are remembered per person in the browser. Selecting
>   does not open a hidden details panel; actions that lead to details on purpose do (links that name what to show,
>   menu items that edit a field in the panel, creating an element whose name is typed there). Hiding, showing or
>   resizing the left panel keeps the model where it is on the screen. Up to 1000 px wide both panels are hidden and
>   slide over the canvas, one at a time.
