# Slice 6b – Back and forward

Status: **draft for step 1**, 22 October 2026. Branch `slice/06b-back-and-forward`, from `main` at tag `slice-06a`
(`80241ef`).

## 1. Why this slice

Modeling work jumps between places. A person follows a mapping from an entity to its source table, opens the requirement
it serves, checks another canvas, and then wants to get back to where they started. Today the browser's back button
covers page changes only, and nothing covers a selection. D-38 asks for one navigation history:
- it covers the workspace, project and canvas pages, the home screens, and selections (not panning);
- it is reached through Alt+←/→, the mouse's back and forward buttons, and the clickable breadcrumbs (done since
  slice 0).

The prototype has the history (`navState`, `navRecord`, `navGo`) and two buttons before the breadcrumbs (`data-nav`).
Slice 6a left room for them at the left end of the breadcrumbs row.

This is a **small slice** with the lighter test rule, four steps, and one diagnosis to the screen (section 6). No
measuring sitting: the slice changes nothing in how the canvas draws.

**Guesses about the app** are marked *(guess)*. Step 1 checks every one. Proposals that are not agreed yet are marked
**(proposal)**.

## 2. Sources

- Prototype:
  - `navState`, `navRecord`, `navGo`: what counts as a place, when one is recorded, how many are kept (the inventory
    says 120), what happens to a place that no longer exists;
  - `renderNavBar` (`data-nav`): the two buttons, their titles and disabled states;
  - the key handler for Alt+←/→.
- `docs/decisions.md`: D-38; D-54 (a selection never opens a hidden details panel); D-39 (the bar shares the row);
  AD-24 (rule 4, "Measuring").
- `docs/inventory-prototype-vs-app.md`: the row "Back and forward".
- `CLAUDE.md`: `openDetails()`, the view-state bar's rule (reads stores, never re-renders `ModelCanvas`, never reads
  layout in a commit), the lesson on phase traces.
- `docs/prd/slice-06a-acceptance.md`: the breadcrumbs row (32 px, `contain: strict`, breadcrumbs shrink first).
- App:
  - the breadcrumbs row: `src/app/_components/breadcrumbs.tsx`;
  - the routes: `src/app/_lib/paths.ts` (`workspaceHref` with `?tab=`, `projectHref`, `canvasHref`);
  - the links that open details on purpose (`?card`, `?label`, `?req`, `?note`) and `openDetails()`;
  - the selection: `src/canvas/context.ts` (`Selection`, `select`), `CanvasHandle.centerOn`;
  - the canvas's key handler in `src/canvas/ModelCanvas.tsx`.

## 3. What to build

### What a place is

1. **Places** *(guess at the prototype's list; Q1)*:
   - a workspace home, with its tab (`?tab=`);
   - a project home;
   - a canvas;
   - a selection on a canvas: one card, one line (mapping or relationship), one frame, one note, or one requirement
     selected from the left panel.
2. **Not places:**
   - panning and zooming (D-38);
   - an empty selection: clicking the background or Esc records nothing;
   - a multi-selection (Shift+click, marquee) **(proposal)**;
   - view state (Focus, layer, filters, collapse, hidden notes, tool), because the view-state bar owns it (D-39);
   - opening or closing a side panel;
   - the details panel's field focus.
3. **No duplicates:** a place equal to the current one is not recorded again. Selecting the same card twice records
   it once.

### One history: the browser's

4. **The browser's history is the only history (proposal; the main decision of this slice, see section 8).** Each
   place is one browser history entry:
   - page places are the entries Next.js already makes;
   - a selection becomes an entry through `history.pushState` with the selection in `history.state`, without a route
     change and without a server request.

   Because of this, the browser's back button, the mouse's back and forward buttons, Alt+←/→, and the app's buttons all
   walk the same list. Nothing has to be kept in step between two histories.
5. **The selection is not in the URL (proposal).** The links `?card`, `?label`, `?req` and `?note` open the details
   panel on purpose (D-54). If going back to a selection reused them, a selection would open the details panel. A
   selection entry keeps the page's URL and carries the selection in `history.state` only. A reload keeps the page and
   loses the selection, as today.
6. **Going back or forward to a selection** selects the item and:
   - leaves the view as it is when the item is on screen;
   - moves the view to center it when it is not *(proposal; the prototype's behaviour checked in Q1)*.

   The details panel does not open (D-54). Going back to a selection on another canvas opens that canvas with its
   remembered view (6a), then selects the item.
7. **A place that no longer exists** (a deleted card, note, frame or requirement; a deleted canvas or project): the
   history moves to the place and shows what still exists. A deleted selection becomes the canvas without a selection;
   a deleted canvas or project becomes the nearest home that exists. A toast says what is gone ("That card is no
   longer on this canvas."). The entry stays where it is: the browser cannot remove entries.
8. **Size:** the browser keeps the entries; the app does not cap them. The prototype's 120 is not needed
   **(proposal)**.

### The buttons and the keys

9. **Two buttons, Back and Forward,** at the left end of the breadcrumbs row on every page that has the row, before
   the breadcrumbs (prototype `data-nav`). Icons ← and →, titles "Back (Alt+←)" and "Forward (Alt+→)", and accessible
   names. Each is disabled when there is nowhere to go.
10. **Knowing whether there is somewhere to go:** the browser does not tell a page whether a forward entry exists. The
    app keeps its own position (an index in `history.state` and in `sessionStorage` for this tab) to enable and disable
    the buttons **(proposal; Q3)**. Entries from before the app was opened (another site) count as "nowhere to go".
11. **Alt+←/→** go back and forward, also on a canvas *(guess: the browser already does this on Windows and Linux; Q4
    checks whether the app needs its own handler, on macOS too)*. In a text field, the browser's own behaviour applies
    (on macOS, Option+← moves by a word). A field being edited is saved or kept as when any other navigation happens
    (Q5).
12. **The mouse's back and forward buttons** work through the browser (item 4), with nothing to build *(guess; Q4)*.
13. **The row:**
    - the buttons are fixed-width and never shrink or fold;
    - the breadcrumbs still shrink first and the chips fold after them (D-39);
    - enabling and disabling a button re-renders only the buttons;
    - nothing reads layout in a commit (CLAUDE.md), and the row keeps `contain: strict`.

## 4. Steps (stop after each one)

1. **Questions** (section 7) answered in a new `docs/prd/slice-06b-acceptance.md`, with the docs plan. No code. Stop.
2. **Page places, the buttons and the keys** (items 1–4, 8–13 for pages). With its tests. Slice specs, the earlier
   specs of what it touched (breadcrumbs, workspace tabs, canvas tabs, S5A-06, S6A-06, S6A-10), CI. Stop.
3. **Selection places** (items 1–3, 5–7 for selections) and the diagnosis (section 6). With its tests. Slice specs,
   earlier specs (selection, the details panel's "on purpose" specs from 5a), CI. Stop.
4. **Closing:** docs, one full e2e run on a quiet laptop, Łukasz's manual acceptance, merge on his command, tag
   `slice-06b`.

**Test rule (small slice, CLAUDE.md):**
- after each step, the slice's specs, the earlier specs of what the step touched, and CI;
- a failing test is run three times on its own;
- one full e2e run before the merge;
- each e2e test is kept to about four page loads.

## 5. Acceptance criteria

Tests in `e2e/slice-06b/`, one file per criterion.

| ID | Criterion |
| --- | --- |
| S6B-01 | Page places: workspace home (each tab), project home, canvas. Moving through four of them, then Back three times and Forward twice, lands on the expected place each time, through the app's buttons, Alt+←/→ and the browser's back (`page.goBack()`). |
| S6B-02 | Selection places: selecting a card, a mapping, a frame, a note and a requirement records five places; Back walks them in reverse, each selected; the same card twice records one place; an empty selection, a multi-selection and view-state changes record none. |
| S6B-03 | A selection place makes no route change and no server request (no RSC fetch in the network log). |
| S6B-04 | Going back to a selection never opens the details panel when it is hidden (D-54); an item off screen is centered, one on screen does not move the view (±1 px). |
| S6B-05 | Across canvases: a selection on canvas A, then canvas B, then Back: canvas A at its remembered view with the item selected. |
| S6B-06 | Gone places: a deleted card, a deleted canvas; Back shows what still exists, with the toast, and Forward still works. |
| S6B-07 | Buttons: disabled at the start of the app's history and at its end; enabled after Back; a reload keeps their state (`sessionStorage`); titles and accessible names. |
| S6B-08 | Keys: Alt+←/→ on a canvas and on a home page; in a text field the browser's own behaviour applies, and the field's edit is not lost (Q5). |
| S6B-09 | The row: from 800 to 2,560 px nothing in the row is cut off, the buttons never fold, the row stays 32 px; a button's state change adds 0 canvas and 0 miniature commits. |
| S6B-10 | Diagnosis to the screen (section 6), in the measurement build only, run on demand like S5A-08 and S6A-09. |
| S6B-11 | CI and one full e2e run before the merge; changed earlier tests listed. |

**Definition of done (scenario for the manual acceptance).** As Łukasz, in the preview data:
1. On "Customer & orders", select an entity, then a mapping from it, then the source table.
2. Open CR-23's live canvas and select a card.
3. Press Back four times with the button, Alt+← and the mouse's back button mixed. Each step shows the previous place
   with its item selected, and the details panel stays as it was.
4. Press Forward twice.
5. Delete the selected card on the live canvas, then go back to it: the canvas without a selection and the toast.
6. Narrow the window to 1,100 px: the buttons are still there and nothing is cut off.

## 6. Performance

A selection place must cost what a click on the item costs.

**One diagnosis in step 3**, without laptop preparation (figures are diagnostic, AD-24 "Measuring"). Following the
6a lesson, it compares **phase traces**, not unprepared medians to the screen:
- Back to a selection on the same canvas against clicking the same item, in the dense view at 100 % and at 30 %: the
  same canvas commits and no more than 2 ms more script;
- Back to a selection whose item is off screen against `centerOn` plus a click: the same commits;
- a button's state change: 0 canvas commits, no forced layout.

A miss stops the step with the trace.

## 7. Questions for step 1

- **Q1.** The prototype's `navState`, `navRecord` and `navGo`:
  - what counts as a place;
  - whether a multi-selection or an empty selection is recorded;
  - duplicates, and the 120 cap;
  - what going back to a selection does with the view;
  - deleted places;
  - the buttons' titles and disabled states.
- **Q2.** How the app moves between places today:
  - which navigations push a browser entry and which replace one (canvas tabs, workspace tabs, `?card` links,
    redirects);
  - whether anything already uses `history.state`;
  - how Next.js (our version) handles `history.pushState` with its own state, and whether `useSearchParams` or the
    router react to it.
- **Q3.** Item 10's position index: how it survives a reload and a page's server render, and what happens with entries
  from another site or another tab.
- **Q4.** Alt+←/→ and the mouse's buttons today, on Windows (Chrome, Edge) and, if you can, macOS:
  - which already work through the browser;
  - whether the canvas's key handler or any field swallows them;
  - whether the app needs its own handler.
- **Q5.** What happens today to an edit in progress (a name in the details panel, a note being typed) when the person
  navigates away: saved, kept, or lost. Does item 11 need anything?
- **Q6.** Which earlier tests change, and which assume a fixed number of browser entries (`page.goBack()` in earlier
  specs).

## 8. The main decision: one history or two

| Option | How | For | Against |
| --- | --- | --- | --- |
| **A. The browser's history (proposed)** | Pages as today; selections through `pushState` with `history.state` | One list for the browser's back, the mouse buttons, Alt+←/→ and the app's buttons; nothing kept in step; per tab for free | The browser hides whether a forward entry exists (item 10); a selection entry stays even when its item is deleted (item 7); depends on how Next.js treats `pushState` (Q2) |
| **B. The app's own history, as the prototype** | A list of up to 120 places in the app; the buttons and Alt+←/→ walk it | Full control (removing gone places, a list of places later) | The browser's back and the mouse's buttons walk a different list than the app's buttons; with selections recorded only in the app, the browser's back skips them: two histories that disagree |

D-38 names the mouse's back and forward buttons. Under option B they would have to be intercepted too, and the
browser's own back button cannot be. That is the reason for A. Step 1 confirms A is workable in our Next.js version
(Q2) before any code.

## 9. Docs in this PR

- `docs/decisions.md` (only with Łukasz's approval of the quoted text): D-38 extended with what a place is, the
  browser's history as the one history, and the selection outside the URL.
- `docs/inventory-prototype-vs-app.md`: "Back and forward" done; the deliberate differences (no 120 cap, the browser's
  history, what happens to gone places).
- `docs/known-limitations.md`: anything step 1 finds that stays (for example macOS behaviour if it cannot be tested).
- README and CLAUDE.md: the slice's status; how places are recorded (for later slices that add selectable things).
