# Slice 6a – View-state bar, a top bar that fits, a view that stays put

Status: **draft for step 1**, 21 October 2026. Branch `slice/06a-view-state-bar`, from `main` at tag `slice-05a`
(`93f0df7`).

## 1. Why this slice

Several things can hide or fade parts of a model: Focus, the layer mode, row filters, collapsed cards and frames,
hidden resolved notes, and an active tool. Today the person has to remember which of them are on and where to switch
each one off. D-39 puts them in one place: a view-state bar of chips, each removable, plus “Show all”. Four known
limitations wait for it:
- “Focus without the view-state bar”;
- “Live canvases without the view-state bar”;
- the status bar's missing “Open notes on canvas {n}”;
- 4b-1's “Show everything”.

The slice also closes two layout gaps that 5a found. The top bar cuts off its tools below about 1,100 px. A remembered
canvas view shifts when the left panel has another width than when the view was saved.

Slice 6 is split. **6a** (this PRD) covers the view-state bar, the top bar on narrow windows, and the remembered-view
fix. **6b** covers back and forward (D-38).

This is a **small slice** with the lighter test rule, five steps, and one diagnosis to the screen (section 6). No
measuring sitting: the slice changes nothing in how the canvas draws. Every chip action reuses an existing switch.

Decisions agreed with Łukasz on 21 October 2026:
- **Slice 6 is split** into 6a (view-state bar) and 6b (back and forward, D-38).
- **The narrow top bar is in 6a.** The bar area is rebuilt here anyway, and the chips compete for the same width.
- **The remembered view is fixed in 6a.** The left panel's width is stored with the view, and the view is corrected on
  open.

Proposals in this PRD that are not agreed yet are marked **(proposal)**. Step 1 confirms or changes them.

## 2. Sources

- Prototype:
  - `viewState` (which items count, their labels and order);
  - `renderNavBar` (`data-voff` per chip, `data-vall` for “Show all”);
  - the top bar's breakpoint classes `.lf`, `.ls`, `.hide-l`, `.hide-s`, `.hide-m` and the media queries at 2,100,
    1,300 and 1,000 px;
  - `renderStatus` (“Open notes on canvas {n}”).
- `docs/decisions.md`:
  - D-39 (the bar), D-22 (layer mode per canvas, Focus momentary), D-07 (collapsed frames);
  - D-20 and D-53 (notes and their counts), D-32 (a requirement's colours, Focus fades), D-54 (side panels);
  - AD-24 (rule 4 as extended in 5a; “Overlay and fading”; “Measuring”).
- `docs/known-limitations.md`:
  - “Focus without the view-state bar”;
  - “Live canvases without the view-state bar”;
  - “The status bar has no ‘Open notes on canvas {n}’”;
  - “The top bar on narrow windows”;
  - “A remembered canvas view and a different left panel”.
- `docs/ideas.md`: “A top bar that fits narrow windows”.
- `docs/inventory-prototype-vs-app.md`: the rows “View-state bar” and “View-state items for notes and live canvases”.
- `docs/prd/slice-03b-acceptance.md` (S3B-08, S3B-09: the live chip and the Labeled filter);
  `docs/prd/slice-04b1-acceptance.md` (the “Show everything” question).
- App:
  - the top bar: `src/app/_components/top-bar.tsx`, with `CanvasTools` in
    `src/app/w/[workspaceId]/p/[projectId]/c/[canvasId]/page.tsx`;
  - the page frame: `app-shell.tsx`, `side-panels.tsx`, `breadcrumbs.tsx`;
  - the status bar: `src/app/_panels/status-bar.tsx`;
  - the canvas: `src/canvas/context.ts`, `CanvasProvider.tsx`, `Focus.tsx`, `fade.ts`, `FadeLayer.tsx`;
  - the toolbox menus: `src/app/_panels/canvas-host.tsx`;
  - the view memory: `infomapper:view:<canvas id>`; `ui.shiftView`.

## 3. What to build

### The view-state bar

1. **Place: in the breadcrumbs row, to the right of the breadcrumbs (guess; Q2).** In the prototype the row
   (`renderNavBar`) holds the breadcrumbs and the chips, and 6b will put back and forward at its left end. The bar
   shows only on canvas pages; on home pages the row keeps the breadcrumbs only.
2. **Fixed height.** Chips appearing or disappearing never change the row's height, so the canvas never moves
   vertically. When the chips need more width than the row has, the ones that do not fit go into a “+{n}” chip whose
   menu lists them with their ×. **(proposal; Q2 checks what the prototype does)**
3. **Items, in the prototype's order and wording (Q1 reads `viewState`).** One chip per item that is active on the
   current canvas:
   - Live: {name}: first, on a live canvas only, **not removable** (D-39);
   - Focus: removable; moves here from the status bar (4b-1 item 20);
   - the layer mode when it is not “Everything” (D-22): × returns to “Everything”;
   - row filters: × clears the row filters. A live canvas's Labeled filter is not counted (D-39, S3B-09);
   - collapsed cards and frames: × expands them;
   - hidden resolved notes: × shows them;
   - the active tool, when one other than Select is on: × returns to Select;
   - the lens: only if the app still has a lens state after 4b-1 (Q1). 4b-1 changed a selected requirement to
     colours without fading, and fading is always Focus (D-32).
4. **Counts where the prototype has them** (for example how many cards are filtered or collapsed). Each chip has a
   tooltip naming what it hides or fades, and its × has an accessible name (“Turn off {item}”).
5. **“Show all”** at the bar's end, shown when at least one removable item is active. It removes every removable item
   in one action. It keeps “Live: {name}” and the Labeled filter. It turns Focus off. This is 4b-1's “Show everything”.
6. **Undo.** A chip's × and “Show all” undo like the switches they reuse. Where several changes are made at once
   (“Show all”), one Ctrl+Z undoes them all. **(proposal; Q3: which of these items are model changes in the undo
   history today, and which are view state)**
7. **Keyboard.** The chips and “Show all” are buttons in tab order after the breadcrumbs; Delete or Backspace on a
   focused chip works like its ×. **(proposal; the prototype has no shortcut, Q1)** No new global shortcuts.
8. **Status bar:**
   - the “Focus” chip leaves the status bar;
   - the status bar gains “Open notes on canvas {n}” after Requirements, counting as D-53 does: open notes, and
     resolved ones while they are shown.

### The top bar on narrow windows

9. **Labels shorten as in the prototype:** at 2,100 and 1,300 px the long labels give way to short ones (`.lf`, `.ls`).
   Up to 1,000 px some tools hide (`.hide-*`). Q4 lists which tools, and where each hidden tool is still reachable (a
   menu, the toolbox, a key). A tool that would be unreachable goes into a “More” menu at the bar's right end instead
   of hiding. **(proposal)**
10. **Nothing is cut off** between 800 and 2,560 px wide (guess at the lower bound; Q4). The details-panel button and
    the user indicator stay visible, as since 5a.
11. **AD-24 rule 4:** the shortening is done by media or container queries on the top bar's own elements. No class
    and no variable on `body`, the page grid or any other element that contains the canvas.

### The remembered view

12. **The view is saved with the left panel's width**: the shown width, or 0 when the panel is hidden or the window
    is up to 1,000 px wide, since overlays do not take width from the pane.
13. **On open**, the view's x is corrected by the difference between the saved width and the current one, so the
    model stands where it stood on the screen. This happens before the first paint of the canvas, with no visible
    jump and no second canvas commit (Q5).
14. **Views saved before this slice** (no width stored) open as today, with no correction.

## 4. Steps (stop after each one)

1. **Questions** (section 7) answered in a new `docs/prd/slice-06a-acceptance.md`, with the docs plan. No code. Stop.
2. **The bar and its chips** (items 1–4, 7, 8). With its tests. Slice specs, the earlier specs of what it touched, CI.
   Stop.
3. **“Show all” and undo** (items 5, 6), and the diagnosis (section 6). With its tests. Slice specs, earlier specs, CI.
   Stop.
4. **Layout:** the top bar (items 9–11) and the remembered view (items 12–14). With its tests. Slice specs, earlier
   specs, CI. Stop.
5. **Closing:** docs, one full e2e run on a quiet laptop, Łukasz's manual acceptance, merge on his command, tag
   `slice-06a`.

**Test rule (small slice, CLAUDE.md):**
- after each step, the slice's specs, the earlier specs of what the step touched, and CI (lint, typecheck, unit
  tests);
- a failing test is run three times on its own to tell a flake from a bug;
- one full e2e run before the merge;
- each e2e test is kept to about four page loads.

## 5. Acceptance criteria

Tests in `e2e/slice-06a/`, one file per criterion.

| ID | Criterion |
| --- | --- |
| S6A-01 | Each item of item 3 makes its chip appear with the prototype's wording, order and count, and disappear when it is turned off elsewhere (toolbar, menu, status). Nothing active, no chips and no “Show all”. |
| S6A-02 | Each removable chip's × turns its item off, with the same result as the existing switch (the canvas state compared after both). Delete on a focused chip as in item 7. |
| S6A-03 | “Show all” removes every removable item in one action; Focus is off afterwards; on a live canvas “Live: {name}” and the Labeled filter stay. |
| S6A-04 | Live canvas: “Live: {name}” is first and has no ×; the Labeled filter alone shows no filter chip and no “Show all”. Closes the known limitation. |
| S6A-05 | Undo per item 6 (as Q3 settles it): a ×, then Ctrl+Z, restores the item; “Show all”, then one Ctrl+Z, restores all of them. |
| S6A-06 | Fixed height: a card's screen position is unchanged (±1 px) when chips appear and disappear and when the chips overflow into “+{n}”. |
| S6A-07 | Status bar: no “Focus” chip; “Open notes on canvas {n}” counts per D-53 (resolved notes hidden and shown). |
| S6A-08 | No extra canvas commit: a chip appearing or disappearing adds 0 canvas and 0 miniature commits to those of the switch it follows (`__imCanvasCommits`, `__imMiniatureCommits`). A chip's × causes no more commits than its existing switch. |
| S6A-09 | Diagnosis to the screen (section 6) within its limits. |
| S6A-10 | Top bar at 2,560, 2,100, 1,600, 1,300, 1,100, 1,000 and 800 px: no tool cut off (each tool's box inside the bar); short labels from the breakpoints; every tool hidden per item 9 reachable as Q4 states. |
| S6A-11 | Remembered view: saved with the left panel at 264 px and opened hidden, at 520 px and in a 1,000 px window, a card stands at the same screen position (±1 px). A view stored in the old format opens unchanged. |
| S6A-12 | CI (lint, typecheck, unit tests, schema check) and one full e2e run before the merge; changed earlier tests listed. |

**Definition of done (scenario for the manual acceptance).** As Łukasz, on “Customer 360”:
1. Turn on Focus, switch to “Mappings”, filter a card to Unmapped, collapse a frame, hide resolved notes. See one chip
   for each.
2. Remove the filter chip with ×.
3. Press “Show all” and see everything back. Ctrl+Z brings back the three that were left.
4. Open CR-23's live canvas: “Live: {name}” first, no “Show all” for the Labeled filter.
5. Narrow the window to 1,000 px: no tool cut off.
6. Save a view, hide the left panel, reopen the canvas: the model in the same place.

## 6. Performance

The bar sits above the canvas, so the 5a lesson applies: **chips change only their own elements.**
- No CSS variable and no class on any ancestor of the canvas (AD-24 rule 4).
- The bar reads the canvas state through store selectors outside `ModelCanvas` (as Focus does), so a chip never
  re-renders the canvas (S6A-08).

**One diagnosis to the screen in step 3**, without laptop preparation (figures are diagnostic, AD-24 “Measuring”).
Ten settled pairs each, on “Performance test” at 30 % and in the dense view at 100 %, frames expanded:
- Focus on and off through its chip's × against the toolbar button: within 10 ms of each other (medians);
- “Show all” with Focus and a filter on, and with five frames collapsed: reported against the same changes made through
  the existing controls one after another;
- a chip appearing alone (a tool switched on): ≤ 16 ms median to the screen beyond the switch itself.

A miss stops the step with the figures. A LayerTree read confirms the slice adds no drawing layer to the canvas.

## 7. Questions for step 1

- **Q1.** The prototype's `viewState`: its items, their wording, order and counts, which are removable, the tooltip
  texts, keyboard handling on chips. Whether the app has any lens state left after 4b-1 that hides or fades.
- **Q2.** The breadcrumbs row today (height, what it holds on each page). Where the chips go. What the prototype does
  when the chips overflow. The bar on home pages.
- **Q3.** For each item: is it view state or a model change (in the undo history, stored with the canvas)? This covers
  collapsed cards and frames, row filters, hidden notes and the layer mode. How “Show all” becomes one undo step. Which
  items are per person and which are per canvas.
- **Q4.** The top bar today: its tools, their widths at each breakpoint, what the prototype hides at 1,000 px and where
  each hidden tool is still reachable. The lower width bound the app supports.
- **Q5.** How a saved view is applied on open today (before or after the first canvas commit), and how item 13's
  correction fits in without a second commit. The storage format change, and old views.
- **Q6.** Which earlier tests change: Focus's status-bar chip (4b-1), the live canvas specs (S3B-08, S3B-09), the
  top-bar and screenshot specs.

## 8. Differences from the prototype (deliberate)

- The bar's height is fixed; overflowing chips go into “+{n}” (if Q2 confirms the prototype does otherwise).
- “Show all” is one undo step (if Q3 confirms the items are in the undo history).
- A remembered view is corrected for the left panel's width.
- A tool the prototype hides on narrow windows without another way to reach it goes into “More” (if Q4 finds one).

## 9. Docs in this PR

- `docs/decisions.md` (only with Łukasz's approval of the quoted text): D-39 extended with the fixed height, the overflow
  and undo; D-54 extended with the remembered view and the panel width.
- `docs/known-limitations.md`: close the following entries:
  - “Focus without the view-state bar”;
  - “Live canvases without the view-state bar”;
  - “The status bar has no ‘Open notes on canvas {n}’”;
  - “The top bar on narrow windows”;
  - “A remembered canvas view and a different left panel”.
- `docs/ideas.md`: “A top bar that fits narrow windows” done.
- `docs/inventory-prototype-vs-app.md`: the view-state rows done; back and forward stay for 6b.
- README and CLAUDE.md: the slice's status.
