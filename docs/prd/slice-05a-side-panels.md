# Slice 5a – Side panels: show, hide, resize

Status: **draft for step 1**, 20 October 2026. Branch `slice/05a-side-panels`, from `main` at tag `slice-04b2`.

## 1. Why this slice

Working on a large model needs every pixel of canvas. Łukasz's plan (backlog, “Plan plastrów po 4p”) puts the
ergonomics of daily modelling before the database; the side panels come first because they matter most when working
with a model. The inventory (`docs/inventory-prototype-vs-app.md`) lists showing and hiding the side panels as missing;
resizing them is not listed as missing, so it is probably there already (Q1 confirms).

This is a small slice: no measuring sitting, the lighter test rule, four steps.

Decisions agreed with Łukasz on 20 October 2026:

- **Hidden panels are remembered** per user in the browser, like the panel widths (the prototype forgets them on a
  reload).
- **While a resize grip is dragged, only a guide line moves**; the panel and the canvas change size once, on release.
- **A hidden right panel stays hidden when something is selected.** It opens from its toolbar button, or from an action
  that leads to details on purpose (Q4 lists them).
- **The canvas content does not jump**: hiding, showing or resizing the left panel keeps the model where it is on the
  screen (not in the prototype).
- **Narrow screens (up to 1000 px)** work as in the prototype: panels hidden by default, sliding over the canvas.
- **No new keyboard shortcuts** (as in the prototype).

## 2. Sources

- Prototype: `#tLeft`, `#tRight` (toolbar buttons and their handlers), `PANEL` (min, max, default widths), `applyPanels`,
  the grips `#gripL`, `#gripR` (`.pgrip`, `role="separator"`, double-click to reset), CSS `main.noleft`, `main.noright`,
  `main.mleft`, `main.mright` and the `@media (max-width:1000px)` block.
- `docs/inventory-prototype-vs-app.md`: “Show or hide the side panels”.
- `docs/decisions.md`: AD-24 (rules 1–4, “Measuring”), AD-19.
- `docs/known-limitations.md`: “How canvas figures are measured since slice 4b-1”.
- App: `src/app/_components/app-shell.tsx`, the canvas page's toolbar, the left panel and the inspector.

## 3. What to build

### Showing and hiding

1. **Toolbar buttons:** “Show or hide the object browser” at the toolbar's left end and “Show or hide the details
   panel” at its right end, with the prototype's icons and `aria-pressed` showing whether the panel is shown.
2. **Hiding** a panel gives its width to the canvas; its grip is hidden with it. Both panels can be hidden at once.
3. **Remembered** per user in the browser across reloads and pages, together with the widths (Q1: where the widths are
   kept today). Storage errors are ignored and the panels then show (try/catch).
4. **All pages with the side panels** (canvas pages and the project home's empty panels) follow the same state.
5. **A hidden right panel stays hidden on selection.** It opens on its toolbar button and on the actions from Q4 that
   lead to an element's details on purpose (for example a “go to” link). Opening it that way keeps it open (and
   remembered) until hidden again.
6. **No jump:** hiding or showing the left panel moves the canvas's viewport by the panel's width, so the model stays
   where it was on the screen. The right panel needs no correction (the canvas grows or shrinks on its right).

### Resizing

7. **Grips** on the inner edge of each panel (`role="separator"`, `aria-orientation="vertical"`, focusable, title “Drag
   to resize; double-click to reset”). Limits: left 200–520 px (default 264), right 280–640 px (default 340).
8. **While dragging:** a thin guide line follows the pointer within the limits; the panel and the canvas keep their size.
   The canvas does not commit or redraw during the drag.
9. **On release:** the panel takes the new width, the canvas resizes once, and the left panel's change is corrected as
   in item 6. **Double-click** resets the panel to its default width, also with item 6's correction.
10. **Keyboard on a focused grip:** as the prototype does (Q1); if it has none, Left and Right arrows change the width by
    16 px within the limits and Home resets it, each applied at once.
11. Widths are remembered as in item 3.

### Narrow screens (up to 1000 px)

12. Both panels are hidden by default and the canvas takes the full width; the remembered state applies only above
    1000 px.
13. A toolbar button slides its panel over the canvas (with a shadow), without resizing the canvas; opening one closes
    the other; the same button closes it. No grips on a narrow screen.

## 4. Steps (stop after each one)

1. **Questions** (section 7) answered in a new `docs/prd/slice-05a-acceptance.md`; the docs plan. No code. Stop.
2. **Show and hide** (items 1–6, 12–13): with its tests. Tests of the files it touches, CI. Stop.
3. **Resize** (items 7–11): with its tests, and the diagnosis (section 6). Tests of the files it touches, CI. Stop.
4. **Closing:** docs, one full e2e run, Łukasz's manual acceptance, merge on his command, tag `slice-05a`.

**Test rule for small slices** (agreed 20 October 2026): after each step, the tests of the files it touches plus CI
(lint, typecheck, unit tests); a failing test is run three times on its own to tell a flake from a bug; one full e2e run
before the merge.

## 5. Acceptance criteria

Tests in `e2e/slice-05a/`, one file per criterion.

| ID | Criterion |
| --- | --- |
| S5A-01 | Showing and hiding: each toolbar button hides and shows its panel, `aria-pressed` follows, the canvas takes the width; both hidden at once. |
| S5A-02 | Remembered: hidden panels and widths survive a reload and a move to another canvas and to the project home; a storage error leaves the panels shown. |
| S5A-03 | No jump: a card's screen position is unchanged (±1 px) after hiding and showing the left panel, after a left resize and after a double-click reset. |
| S5A-04 | A hidden right panel stays hidden when a card, a row or a line is selected; it opens on its button and on each action from Q4, and stays open afterwards. |
| S5A-05 | Resizing: the guide line moves within the limits while dragging and the panel keeps its width; on release the width is applied; double-click resets; the keyboard per item 10. |
| S5A-06 | Narrow screen (1000 px wide window): panels hidden by default, slide over the canvas, one at a time, no grips, the canvas keeps its width. |
| S5A-07 | No canvas commit while a grip is dragged (`__imCanvasCommits`, `__imMiniatureCommits`); hiding, showing and the release each cause at most the commits of one canvas resize (Q3 states how many). |
| S5A-08 | Diagnosis to the screen (section 6): hiding or showing a panel and a resize on release, ≤ 100 ms median. |
| S5A-09 | CI (lint, typecheck, unit tests, schema check) and one full e2e run before the merge; changed earlier tests listed. |

**Definition of done (scenario for the manual acceptance).** As Łukasz, on “Customer 360”: hide the left panel and see
the model stay in place; hide the right panel, select a card and see the panel stay hidden; open an element's details
from a “go to” link and see the panel come back; widen the left panel with the grip, see only the guide line move until
release; reload and see the same layout; narrow the window under 1000 px and slide each panel over the canvas.

## 6. Performance

No measuring sitting: the slice adds no element to the canvas and does not change how it draws, only its size. One
diagnosis to the screen in step 3, without laptop preparation (figures are diagnostic, AD-24 “Measuring”): hiding and
showing each panel and a resize on release, 10 settled pairs each, on “Performance test” at 30 % and at the dense view
at 100 %, frames expanded. A median over 100 ms stops the step with the figures. A LayerTree read confirms the slice
adds no drawing layer to the canvas.

## 7. Questions for step 1

- **Q1.** What the app has today: grips, widths, limits, double-click reset, keyboard, where widths are stored; what
  the prototype's grips do with the keyboard.
- **Q2.** The toolbar: where the two buttons go in the app's toolbar, and what the project home (which has no canvas
  toolbar) offers instead, if anything.
- **Q3.** How a canvas resize reaches React Flow today (ResizeObserver, commits per resize), and how item 6's viewport
  correction is applied without a second commit.
- **Q4.** The actions that lead to an element's details on purpose and should open a hidden right panel (go-to links,
  “Open its panel”, others), and the ones that should not.
- **Q5.** The narrow-screen layout in the app today, and what items 12–13 change.
- **Q6.** Which earlier tests change (layout, widths, screenshots).

## 8. Differences from the prototype (deliberate)

- Hidden panels are remembered across reloads.
- Resizing moves a guide line; the size changes on release.
- The model does not jump when the left panel is hidden, shown or resized.

## 9. Docs in this PR

- `docs/decisions.md` (only with Łukasz's approval of the quoted text): a new D-entry “Side panels” with the decisions
  of section 1.
- `docs/inventory-prototype-vs-app.md`: “Show or hide the side panels” done.
- README and CLAUDE.md: the slice's status; the test rule for small slices.
