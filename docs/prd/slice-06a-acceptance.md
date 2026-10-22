# Slice 6a – Acceptance

Status: **step 5 (closing): full e2e run done; waiting for Łukasz's manual acceptance and his merge command.** Branch `slice/06a-view-state-bar`, from `main` at the tag
`slice-05a` (`93f0df7`). PRD: `docs/prd/slice-06a-view-state-bar.md`. The PRD stays as written; this file is its
amendment (Łukasz, 21 October 2026).

## Łukasz's answers to step 1 (21 October 2026)

Step 1 accepted.

1. **Lens:** no lens chip; “lens” leaves D-39.
2. **Role/archived chip:** left out; the bar is on canvas pages only.
3. **Overflow:** “+{n}” with “Live: {name}” and “Show all” always visible, the breadcrumbs shrinking first. The fold has
   a small hysteresis, so a chip at the edge cannot flip between the row and “+{n}” on every observation.
4. **Undo:** the new command; one step per chip (filters, collapsed cards, collapsed frames) and one for “Show all”'s
   layout part. The command is **all or nothing**: if any row's version check fails, nothing is written and the person
   gets a toast; a unit test covers it. The DoD is corrected as proposed (draw a frame first; Ctrl+Z after “Show all”
   brings back the layout part only).
5. **Readers and reviewers:** the filter and collapsed-card chips have no ×; their tooltip ends with “Only editors can
   change this.”
6. **Delete on a chip:** dropped (item 7 keeps only the buttons in tab order).
7. **Narrow top bar:** the rule is **nothing cut off at any width from 800 to 2,560 px, both panels shown**. The
   prototype's label steps are the starting point; the widths at which Focus and notation, then Entity, Frame, Note and
   Hand, move into “More” are set by measurement in step 4, above 1,000 px if needed (the reference laptop is 1,536 px
   and cuts off today). The layer switch, the working context, undo, zoom, the details button and the user indicator are
   never hidden or cut off. S6A-10 also checks 1,536 and 1,880 px.
8. **“Show all” from two items, “Open notes on canvas {n}” counting open notes only**, as the prototype. Tooltips as
   proposed; no tool chip while drawing a relationship; “Entity tool” gets its text (the prototype's “undefined” is a
   deliberate difference, for the inventory).
9. **Remembered view:** the canvas's left edge on the screen, corrected in the one `setViewport` call.
10. **D-39 and D-54:** direction approved; the final wording comes in step 5.

When “The top bar on narrow windows” closes in step 5, it states the measured figure (about 1,700 px), not 1,100.

## Step 1: questions (21 October 2026)

Start checks: `main` at `93f0df7` contains the tag `slice-05a` and equals `origin/main`; the working tree was clean;
no node, dev server, Playwright or measurement server was running. For Q4 I started the preview dev server
(`.data/preview-db.json`) once to measure the top bar, and stopped it again.

### Q1. The prototype's `viewState`

`viewState()` (and `renderNavBar`, the `#navbar` click handler) in the prototype:

| Order | Chip text | Shown when | × does | Undo in the prototype |
| --- | --- | --- | --- | --- |
| – | `Live: {name}` (dashed, no ×, title “This canvas follows the label”) | a live canvas | – | – |
| 1 | `Archived · read-only`, or `{role} · can approve and add notes` / `· read-only` | archived workspace, or a role below full edit; **also on home pages** | opens the workspace home (overview or people) | – |
| 2 | `Lens: {REQ-key}` | a requirement selected | clears the selection | – |
| 3 | `Focus` | Focus on | Focus off | – |
| 4 | `Mappings only` / `Relationships only` | layer not “Everything” | layer “Everything” (saved per canvas) | – |
| 5 | `{n} card(s) filtered` | entity or source cards with a row filter; a live canvas's Labeled not counted | every filter to All (Labeled kept on a live canvas) | one step (`mutate`) |
| 6 | `{n} card(s) collapsed` | collapsed cards | every card expanded | one step |
| 7 | `{n} frame(s) collapsed` | collapsed frames | every frame expanded | one step |
| 8 | `Resolved notes hidden` | resolved notes hidden **and** the canvas has a resolved note | resolved notes shown | – |
| 9 | `Hand tool` / `Frame tool` / `Note tool` | a tool on | back to selecting | – |

- **“Show all”** (`data-vall`, title “Remove everything that hides or fades things on this canvas”) shows **when two
  or more items are listed** (`vsItems.length > 1`), not from one. It turns off Focus, the layer, hidden notes, the
  tool and a requirement selection, clears filters (Labeled kept on a live canvas), card and frame collapse, and does
  not touch the role/archived item. It pushes **one undo step, and only when filters or collapse changed**, and toasts
  “Showing everything on this canvas.” (with Undo when that step exists).
- **Tooltips:** the chips have none; each × has the title “Remove”.
- **Keyboard:** no handling on the chips. The only keys are Alt+←/→ for back and forward (slice 6b).
- **Overflow:** `#navbar` is 32 px high with `overflow: hidden`; the breadcrumbs keep at least 240 px; `.vstate` is
  `overflow: hidden`. Chips that do not fit are clipped at the right, “Show all” first. No “+{n}”.
- A prototype bug: the Entity tool (`V.tool === "entity"`) has no text in the tool map, so its chip reads “undefined”.

**The lens:** the app has no lens state left. Slice 4b-1 removed it (`src/canvas/fade.ts`: “Slice 4b-1 removed the lens
(`{ lens }`)”); a selected requirement only colours its scope (`CoverageLayer`, D-32), and fading is always Focus.
Nothing a requirement selection does hides or fades. **Proposal:** no lens chip, and D-39 loses “lens” from its list
(quoted below).

### Q2. The breadcrumbs row and where the chips go

- `src/app/_components/breadcrumbs.tsx`: a server component, `h-8` (32 px, as the prototype), `overflow-hidden`,
  rendered by `AppShell` on every page: workspace pages under the top bar; project and canvas pages inside the centre
  column, under the canvas tabs and above the canvas's `<main>`. It holds only the breadcrumbs.
- **Place: confirmed.** The prototype's `#navbar` holds back/forward, the breadcrumbs and `.vstate` (pushed right by
  `margin-left: auto`). The chips go to the right end of the breadcrumbs row; 6b adds back and forward at its left.
- The row's height is already fixed (32 px), so chips never move the canvas vertically; S6A-06 checks it stays so.
- **Home pages:** in the prototype the bar also shows there, with the role/archived chip only. **Proposal:** the bar on
  canvas pages only, as the PRD says, and no role/archived chip anywhere: D-39 does not list it, and the user indicator
  already shows the role and “Archived” in colour (slice 0). The bar is a client slot that only the canvas page passes
  to `Breadcrumbs` (as it passes `tools` and `status` to `AppShell`), so home pages render as today.

### Q3. View state or model change, per item

| Item | Stored where | For whom | Undo today |
| --- | --- | --- | --- |
| Focus | `focusOn` store (`src/canvas/fade.ts`), never saved | this tab; off on reload and canvas switch (D-22) | no |
| Layer mode | `canvas.look.layer`; editors save it, others keep it in the tab (`src/canvas/look.tsx`) | per canvas, for everyone (editors) | no (D-12: the look is outside undo) |
| Row filter | `canvas_item.row_filter` (`updateCanvasItem`) | per canvas, for everyone; editors only (card buttons and menu) | yes, one step per card |
| Collapsed card | `canvas_item.collapsed` | the same | yes, one step per card |
| Collapsed frame | `frame.collapsed` (`setFrameCollapsed`, `setAllFramesCollapsed`) | editors save it; reviewers and readers in their tab only (slice 2c, item 11) | yes for editors; “Collapse all” is one step |
| Resolved notes hidden | `localStorage` `infomapper:notes:hide-resolved:<user>` (`CanvasProvider`) | per person in this browser, every canvas | no (slice 3a, item 12) |
| Tool | `ui.mode` (`entity`, `relate`, `hand`, `frame`, `note`) | this tab | no |

**How “Show all” becomes one undo step:** one change group is one undo step (`src/domain/commands/undo.ts`), and
there is no command today that changes several cards' filters or collapse at once. **Proposal:** one new domain command
(working name `resetCanvasView`) that, in one change group, sets the canvas's card filters to All (Labeled kept on a live
canvas), expands its cards and expands its frames, each part optional, with version checks on every row it writes. The
filter chip, the collapsed-cards chip and the layout part of “Show all” all use it, so each is one step, as in the
prototype; the frames chip may use the existing `setAllFramesCollapsed`. Focus, the layer, hidden notes and the tool are
switched in the browser as today and are not part of the step (as in the prototype). The command gets unit tests
(permissions, archive, versions, the Labeled rule, “nothing to change”).

### Q4. The top bar today and the prototype's breakpoints

**The app already has breakpoints of its own** (Tailwind classes on each tool, set in slices 1a–4b-1), not the
prototype's: the layer labels shorten below 2,100 px (as the prototype); notation shortens below 1,280 and hides below
640 (prototype: shortens at 2,100, hides at 1,000); tool and Focus labels hide below 1,024 (prototype: 1,880); the
working context's label below 1,400 (prototype: 1,880); the brand hides below 640 and the path separators below 768
(prototype: both at 1,300).

**Measured** (preview data, Customer & orders, Łukasz, both panels shown; tools' box width / room):

| Window | Tools need / have | Cut off |
| --- | --- | --- |
| 2,560, 2,100 | 1,177 / 1,177 | nothing |
| 1,600 | 1,051 / 943 | zoom group |
| 1,300 | 932 / 689 | working context, undo, zoom |
| 1,100 | 879 / 528 | Hand, notation, working context, undo, zoom |
| 1,000 | 685 / 423 | notation, working context, undo, zoom |
| 800 | 685 / 283 | Note, Hand, notation, working context, undo, zoom |

So tools are cut off from about 1,700 px, not “below about 1,100 px” as the known limitation and the PRD say.

**The prototype** (`.lf`/`.ls`, `.hide-m`, `.hide-l`, `.hide-s`): at 2,100 short labels (All/Maps/Rels, IE), narrower
tool padding, smaller brand; at **1,880** (missing from the PRD) the Focus, Hand, Entity, Note and Frame labels and
“No working context” hide (icons stay); at 1,300 the brand and path separators hide and the switchers narrow to 110 px;
at 1,000 the Focus button and the notation switch hide.

**Where each tool is still reachable without the bar:**

| Tool | Elsewhere |
| --- | --- |
| Entity, Frame, Note, Hand | keys E, A, N, H; the canvas toolbox (“New entity here”, “New frame here”, “Add a note here”, “Hand tool”) |
| Undo, Redo | Ctrl+Z, Ctrl+Shift+Z |
| Zoom, Fit | wheel and pinch, F |
| Focus | only the entity and table card menus (“Focus on this”); not for rows, lines, frames, requirements |
| Notation | nowhere else |
| Working context, layer switch | nowhere else |

**Lower bound:** D-54 designs for windows up to 1,000 px (panels slide over the canvas), so narrower windows are
supported. **Proposal: 800 px**, as the PRD guessed (S6A-10's list stays).

### Q5. How a saved view is applied today

`ModelCanvas` keeps the canvas `visibility: hidden` until `ready`. One effect waits for React Flow's pane to have a size
(`sized`), calls `rf.setViewport(readView(canvasId) ?? fitView(…))` and sets `ready`; that commit is the first one the
person sees. The view is saved on `onMoveEnd` as `{ x, y, zoom }` under `infomapper:view:<canvas id>`.

**Proposal:** save `{ x, y, zoom, left }`, where `left` is the canvas root's left edge on the screen at the moment of
saving (`getBoundingClientRect().left`). That equals the left panel's shown width, and is 0 when it is hidden or up to
1,000 px wide (the overlay takes no width), with no need to read the side panels' state from `ModelCanvas` (S5A-07:
`ModelCanvas` does not subscribe to it). On open, the same effect reads the root's left edge again and passes
`x + (saved left − current left)` to the one `setViewport` it already makes: no second commit, nothing visible before it.
A view without `left` (saved before this slice, and every e2e helper that writes a view) opens as today. `copyView`
(“Duplicate layout”) copies the value as it is, so the copy opens corrected too.

### Q6. Earlier tests that change

- `e2e/slice-04b1/S4B1-06.spec.ts`, `S4B1-08.spec.ts`: the Focus chip moves to the bar. They find it by test id only
  (`chip-focus`, `chip-focus-off`), not inside the status bar; **proposal:** the bar's Focus chip keeps these ids, so
  they pass unchanged; S6A-07 checks the status bar has no Focus chip.
- `e2e/slice-03b/S3B-08.spec.ts`, `S3B-09.spec.ts`: no change; S6A-04 covers the chip and the uncounted Labeled filter,
  and `slice-03b-acceptance.md`'s “slice 6” notes point to it.
- `e2e/slice-05a/S5A-06.spec.ts` (bar at 1,000 px, `scrollLeft` 0) and `e2e/slice-03b/S3B-04.spec.ts` (working context
  button hidden for some roles): rerun in step 4; S5A-06 may need the “More” button.
- `e2e/slice-05a/S5A-02.spec.ts`, `S5A-04.spec.ts`: they reload after changing the left panel; they check widths, not
  card positions, so they should pass, but they are rerun in step 4.
- Status bar specs (`S4A-13`, `S4B1-01`, `S4B1-03`) check single spans by test id; the new span gets its own
  (`status-notes`).
- Specs that write `infomapper:view` (slices 1a–5a helpers and measuring specs) write the old format and are not
  affected.

### Where the PRD's guesses were wrong

| PRD | Found |
| --- | --- |
| Section 1, item 9: the top bar cuts off its tools below about 1,100 px | from about 1,700 px (measured table above); the known limitation's figure was wrong too |
| Section 2, item 9: the prototype's breakpoints are 2,100, 1,300 and 1,000 | also 1,880 (`.hide-m`): tool labels and “No working context” |
| Item 9 implies the app does not shorten labels yet | it does, at its own breakpoints (Q4) |
| Item 2: overflow behaviour unknown | the prototype clips chips at the right, “Show all” first; no “+{n}” |
| Item 4: counts and tooltips “where the prototype has them” | counts yes (cards filtered, cards collapsed, frames collapsed); no tooltips, the × is titled “Remove” |
| Item 5: “Show all” when at least one removable item is active | the prototype shows it from **two** items |
| Item 7: keyboard on chips | the prototype has none |
| Item 8: “Open notes on canvas {n}” counts open notes and resolved ones while shown (D-53) | the prototype counts **open (unresolved) notes only**, hidden or not; D-53 is about counts on cards and blocks |
| Item 3: one chip “collapsed cards and frames” | two chips: `{n} card(s) collapsed`, `{n} frame(s) collapsed` |
| Item 3 is complete | the prototype also has a role/archived chip (proposal: leave it out, Q2) |
| DoD step 3: Ctrl+Z after “Show all” “brings back the three that were left” | only the layout part comes back (filters, collapsed cards and frames); Focus, the layer and hidden notes are outside undo, as in the prototype |
| DoD step 1: collapse a frame on Customer & orders | that canvas has no frame in the seed or the preview data: draw one first |

### My view on the proposals

**Item 2, fixed height with “+{n}”: yes, slightly changed.** The height is already fixed. Clipping as the prototype does
would hide “Show all” first, the one control that clears everything. With every item on, the chips need about 900 px,
and the centre column on the reference laptop (1,536 px, both panels) is about 930 px, so overflow is real. Proposal:
“Live: {name}” stays at the start and “Show all” at the end, always visible; the breadcrumbs shrink first (down to the
current page's crumb), then the last chips fold into “+{n}”, whose menu lists them with their ×. The fold is worked out
by a `ResizeObserver` on the row itself (its own element; AD-24 rule 4). Cost: moderate, one small component and its
test.

**Item 6, “Show all” as one undo step: yes, as the prototype does it.** The layout part (filters, collapsed cards and
frames) is one step through the new command (Q3); Focus, the layer, hidden notes and the tool are not in it. The
filter and collapsed-card chips are one step each too (all cards at once), not one per card. The toast as the
prototype: “Showing everything on this canvas.”, with Undo when the step exists. People who cannot edit change only
what they may: Focus, the layer and frames in their tab, hidden notes and the tool; the filter and collapsed-card chips
show **without ×** for them (they cannot change saved filters today either), and “Show all” counts only what they can
remove.

**Item 7, Delete or Backspace on a focused chip: drop it.** The prototype has none, and the canvas listens for Delete on
`window` (`ModelCanvas.tsx`, the key handler): with a mapping, frame, note or requirement card selected, Delete on a
focused chip would also delete that item unless every chip stops the event, which is easy to break later. The chips' ×
and “Show all” are buttons in tab order after the breadcrumbs; Enter and Space work on them. No new shortcuts.

**Item 9, a “More” menu: yes, for what the prototype hides and the app cannot reach otherwise.** Proposal:
- the prototype's label steps: short labels from 2,100 (notation IE/UML too); icons only for Focus, Hand, Entity, Note
  and Frame and no “No working context” text from 1,880; brand and path separators hidden and switchers narrower from
  1,300;
- up to 1,000 px, Focus and the notation switch move into a “More” (⋯) menu at the tools' right end, since Focus is
  otherwise reachable only from card menus and notation not at all;
- if 800 px still does not fit (my estimate: about 580 px of tools for about 430 px of room), the four tool buttons
  (Entity, Frame, Note, Hand) also move into “More” below a breakpoint measured in step 4; they keep their keys and the
  toolbox. The working context, undo, zoom, the details button and the user indicator stay visible.
- Each step is a class on the tool's own element (as today), never on the bar's ancestors.

### Other points in the PRD

1. **“Show all” from two items (prototype)**, not from one: with one item its × does the same. Proposal: follow the
   prototype.
2. **“Open notes on canvas {n}”:** proposal: the prototype's count (open notes on this canvas, resolved ones never),
   not D-53's; the word “Open” would be wrong for resolved notes.
3. **Tooltips and accessible names (item 4):** the prototype has none on chips. Proposal: keep a short tooltip per chip
   as the PRD asks (an addition with no behaviour change), the × titled “Remove” as the prototype with the accessible
   name “Remove {chip text}”:
   - Focus: “Everything not connected to the selection is faded”;
   - Mappings only / Relationships only: “The other lines are hidden”;
   - cards filtered: “Some rows of these cards are hidden by their row filter”;
   - cards collapsed: “These cards show their header only”;
   - frames collapsed: “These frames show as blocks”;
   - Resolved notes hidden: “Resolved notes are not shown on the canvas”;
   - a tool: the tool button's own title;
   - Live: “This canvas follows the label” (prototype).
4. **Tool chip:** `Entity tool`, `Hand tool`, `Frame tool`, `Note tool`. Proposal: no chip while drawing a relationship
   (`relate`): it is a two-click gesture started from a card, ended by Esc, and its toast already says so.
5. **Live canvases:** “Show all” keeps the Labeled filter and “Live: {name}”; with only Labeled filters on, no filter
   chip and no “Show all” (S6A-04).
6. **How the bar reads the canvas (section 6):** the counts (cards filtered, cards collapsed, frames
   collapsed, resolved notes on the canvas, open notes) live in `ModelCanvas`'s state. Proposal: `ModelCanvas` publishes
   them into a value store (`value-store.ts`, as the hover) from an effect when they change; the bar and the status bar
   read it with `useValue`. Publishing adds no canvas commit; S6A-08 checks it.
7. **The diagnosis (section 6):** fine as written; Performance test has frames to collapse (`seed:large`).
8. **DoD:** corrected scenario for the manual acceptance in step 5 (draw a frame first; Ctrl+Z brings back the collapsed
   frame only; CR-23's live canvas exists in `.data/preview-db.json`, not in a fresh seed).

### Docs plan (section 9)

- **`docs/decisions.md`** (only with Łukasz's approval of the quoted text, in this PR):
  - D-39, proposed:
    > **D-39** A view-state bar at the right end of a canvas page's breadcrumbs row shows everything that hides or
    > fades items (Focus, layer, filters, collapsed cards, collapsed frames, hidden notes, active tool), each removable,
    > plus “Show all” from two items. A live canvas's “Live: {name}” chip and its Labeled filter (not counted as
    > filtered, kept by “Show all”) belong to the view-state bar. The row's height never changes: chips that do not fit
    > go into “+{n}”, whose menu lists them; “Live: {name}” and “Show all” stay visible. Removing the filters, the
    > collapsed cards or the collapsed frames is one undo step, and so is what “Show all” changes of them; Focus, the
    > layer, hidden notes and the tool are view state outside undo. Who cannot edit the canvas sees the filter and
    > collapsed-card chips without ×. (Changed in slice 6a: no lens since slice 4b-1, D-32.)
  - D-54, added at the end:
    > A canvas's remembered view is stored with the left edge of the canvas on the screen (the left panel's width, 0
    > when it is hidden or the window is up to 1000 px wide), and corrected by the difference on open, so the model
    > stands where it stood; views saved before slice 6a open unchanged. (Added in slice 6a.)
  - No decision text for the narrow top bar: its prototype difference (“More”) goes to the inventory.
- **`docs/known-limitations.md`:** close “Focus without the view-state bar”, “Live canvases without the view-state bar”,
  “The status bar has no ‘Open notes on canvas {n}’”, “The top bar on narrow windows”, “A remembered canvas view and a
  different left panel”, each with “Closed in slice 6a” and the PRD link, as earlier slices did.
- **`docs/ideas.md`:** “A top bar that fits narrow windows” marked done in slice 6a.
- **`docs/inventory-prototype-vs-app.md`:** “View-state bar” and “View-state items for notes and live canvases” done;
  the role/archived chip and the lens chip not built (why); back and forward stay for 6b; the top bar's “More” and the
  remembered view's correction as deliberate differences.
- **`docs/prd/slice-03b-acceptance.md`, `slice-04b1-acceptance.md`:** no edits (closed records); the known limitations
  point to this slice.
- **README and CLAUDE.md:** the slice's status, the e2e helpers of `e2e/slice-06a/`, the counts store and the bar's
  rule (reads stores, never re-renders `ModelCanvas`).

### Questions for Łukasz

1. **Lens:** drop the lens chip and “lens” from D-39? *Proposal: yes.*
2. **Role/archived chip** (prototype, also on home pages): leave it out, bar on canvas pages only? *Proposal: yes; the
   user indicator shows it.*
3. **Overflow:** “+{n}” with “Live” and “Show all” always visible, breadcrumbs shrinking first? *Proposal: yes.*
4. **Undo:** the new command, so the filter chip, the collapsed-card chip and “Show all”'s layout part are one step
   each; Focus, layer, notes and tool outside undo; DoD step 3 corrected? *Proposal: yes.*
5. **Readers and reviewers:** filter and collapsed-card chips without ×? *Proposal: yes.*
6. **Delete on a chip:** drop it? *Proposal: yes.*
7. **Narrow top bar:** the prototype's label steps, Focus and notation into “More” up to 1,000 px, the four tool
   buttons too below a breakpoint measured in step 4, lower bound 800 px? *Proposal: yes.*
8. **“Show all” from two items, and “Open notes” counting open notes only**, both as the prototype? *Proposal: yes.*
9. **Remembered view:** store the canvas's left edge on the screen instead of reading the panel's state? *Proposal: yes;
   same result, and `ModelCanvas` stays independent of the panels.*
10. **D-39 and D-54 texts** as quoted above (final wording again in step 5)? *Proposal: approve the direction now.*

## Step 2: the bar and its chips (21 October 2026)

What changed:
- `src/app/_components/view-state-bar.tsx`: the bar at the right end of the breadcrumbs row (canvas pages only, passed
  through `AppShell`'s `viewState` into `Breadcrumbs`). Chips in the prototype's order and wording: “Live: {name}”
  (first, no ×), Focus, Mappings only / Relationships only, `{n} card(s) filtered`, `{n} card(s) collapsed`,
  `{n} frame(s) collapsed`, Resolved notes hidden (only when the canvas has a resolved note), Entity / Frame / Note /
  Hand tool (none while drawing a relationship). Tooltips as agreed; each × is titled “Remove”, named “Remove {chip}”.
- **The fold:** chips that do not fit go into “+{n}” from the end; its menu lists them with their ×. The breadcrumbs
  keep their current crumb and the ones above it shrink to 40 px first. `src/ui/fit-chips.ts` does the arithmetic,
  with 16 px of hysteresis (unit tests). A `ResizeObserver` on the row itself; the chips' widths come from a hidden copy
  inside the bar.
- `src/canvas/view-counts.ts`: `ModelCanvas` publishes the counts (cards filtered, cards collapsed, frames collapsed,
  resolved and open notes) into a value store from an effect when a number changes; the bar and the status bar read it.
- The status bar: the Focus chip left (the bar's Focus chip keeps the test ids `chip-focus`, `chip-focus-off`); “Open
  notes on canvas {n}” after Requirements, open notes only (the page's count until the canvas publishes its own).
- **× in this step:** Focus, the layer (saved for editors, in the tab for others), collapsed frames (the existing
  `setAllFramesCollapsed`: one step for editors, in the tab for reviewers and readers), resolved notes, the tool.
  **The filter and collapsed-card chips have no × yet for anyone**; editors get it with step 3's command (one undo
  step each). For readers and reviewers they stay without ×, their tooltip ending with “Only editors can change this.”

Tests (`e2e/slice-06a/`): S6A-01 (wording, order, counts, off elsewhere), S6A-02 (× against the switches, Tab and
Enter, a reader's chips), S6A-04 (live), S6A-06 (row height, a card's place, “+{n}” and its menu at 1,280 px), S6A-07
(status bar), S6A-08 (commits: Focus adds none; a ×'s canvas and miniature commits never more than its switch's).

Runs: lint, typecheck, unit tests (79 files, 1,033 tests) pass. The slice's specs and the earlier specs this step
touched (S4B1-06, S4B1-08, S3B-08, S3B-09, S4A-13, S4B1-01, S4B1-03): 17 passed, 2.8 min, none changed.

Łukasz accepted step 2 (22 October 2026), with the three assumptions: “Customer 360” is its canvas “Customer &
orders”; “at most” is S6A-08's check for a ×; 2,400 px windows are fine, since S6A-06 forces the fold.

## Step 3: “Show all”, undo, the diagnosis (22 October 2026)

**Runs missing from step 2, done first:** S5A-07 (`ModelCanvas` publishes the counts) and every earlier spec that
checks the breadcrumbs, found by test id (`nav-breadcrumbs`, `breadcrumb`) and text: S0-04, S0-11. 7 passed, 1.3 min.

**Which S6A-08 test checks “0 commits”:** the first, “chips add no canvas or miniature commit; a × costs what its switch
costs”: Focus on (its chip appears) and off through its × (the chip goes), each exactly 0 canvas and 0 miniature
commits. Focus is the one item whose switch commits nothing, so it is where the chip's own share can be read alone.
Step 3 adds a third test, “a chip folding into “+{n}” and coming back adds no canvas or miniature commit”: at 1,280 px
with three chips on, Focus pushes the last chip into “+{n}” and back, again 0 and 0. For the other items, whose switches
commit the canvas themselves, the check is that the × costs at most what the switch costs (the second and fourth tests),
and S6A-09 times a chip appearing against `?diag=noviewbar`.

What changed:
- **`resetCanvasView`** (`src/domain/commands/frame.ts`, with the frame commands' draft and commit): row filters to All
  (a live canvas keeps Labeled), cards expanded, frames expanded, each part optional, one change group. All or nothing:
  one changed row the person did not read at its version refuses the whole write (stale version; the browser puts
  everything back and shows the message as a toast). Nothing to change writes nothing (“Nothing to change.”, no undo
  step). Unit tests in `frame.test.ts`: the three parts, the parts alone, the Labeled rule, all or nothing, nothing to
  change, reviewers, readers, archive, a deleted canvas, and one undo putting all of it back (7 tests).
- `resetCanvasViewAction` (`src/app/_actions/frame.ts`, a fresh page after it, as “Expand all”); `useFrames.resetView`
  shows the change at once and writes it in the frames' queue; reviewers and readers expand frames in the tab only.
  The canvas handle offers it as `ui.resetView`.
- **The filter chip's × and the collapsed-card chip's ×** for editors: one change each over every card (one undo step);
  no toast, as the prototype's chips.
- **“Show all”** (`button-view-show-all`; the source table panel already has a `button-show-all`) at the bar's end,
  always visible, from two chips the person can remove. It turns off Focus, the layer, hidden notes and the tool, and
  sends the layout part through the command only when something changes; the toast “Showing everything on this
  canvas.” has Undo when that step exists. For reviewers and readers it counts and removes only their chips (frames in
  the tab).
- `?diag=noviewbar` (measurement build only, like the other `DIAG` switches): the canvas page without the bar, for
  S6A-09.

Tests: S6A-03 (three tests: an editor's “Show all” and the one-chip case, a live canvas, a reader), S6A-05 (the two ×
and “Show all”, each undone with one Ctrl+Z; Focus does not come back), S6A-08's third test, S6A-09.

### S6A-09: the diagnosis to the screen

Measurement build, headed Chrome 155, 1,536 × 864 (pane 932 × 718), no laptop preparation (diagnostic figures); 10
settled pairs each, to the first GPU present after the switch's commit, medians and p95 in ms. Raw traces in
`.data/measure/traces-2026-10-22-*` (not committed), results in `test-results/S6A-09.json`.

| Scenario | 30 % around ent:23: median / p95 | 100 % dense: median / p95 |
| --- | --- | --- |
| Focus off with the button | 18.7 / 23.4 | 21.5 / 24.3 |
| Focus off with its chip's × | 16.2 / 23.7 | 21.6 / 31.9 |
| (Focus on with the button, both loops) | 42.9 / 61.8, 43.2 / 63.7 | 40.8 / 50.3, 38.4 / 44.4 |
| “Show all”: Focus and a filter | 501.5 / 532.5 | 233.4 / 292.8 |
| The same through the Focus button and the card's filter button | 410.9 / 460.3 | 211.5 / 234.3 |
| “Show all”: five frames collapsed (and the Hand tool) | 849.5 / 867.0 (incl. 1 unsettled switch of 10) | 451.2 / 524.1 |
| The same through “Expand all” and the Hand tool's button | 802.2 / 934.9 (incl. 2 unsettled switches of 10) | 465.6 / 494.4 |
| Hand tool on, with the bar (its chip appears) | 75.0 / 150.7 | 171.8 / 223.1 |
| Hand tool on, without the bar | 67.8 / 161.7 | 157.1 / 205.8 |
| Hand tool off, with the bar | 62.0 / 76.1 | 153.8 / 163.1 |
| Hand tool off, without the bar | 61.5 / 79.7 | 150.1 / 180.9 |

- **Focus through its chip against the button: within 10 ms** (−2.5 ms at 30 %, +0.1 ms at 100 %). Met.
- **A chip appearing: ≤ 16 ms median beyond the switch.** +7.2 ms at 30 %, +14.7 ms at 100 % (Hand on); going: +0.5,
  +3.7 ms. Met, at 100 % close to the limit.
- **“Show all” against the controls one after another** (reported, no limit): with Focus and a filter, +91 ms at 30 % and
  +22 ms at 100 %; the split puts it on the main thread (248 against 50 ms at 30 %), where “Show all” also gets a fresh
  page after its write (`revalidatePath`, as “Expand all”) and the card's filter button does not. With five frames
  collapsed, +47 ms at 30 % and −14 ms at 100 % (both sides get a fresh page). Of the frame pairs at 30 %, 1 and 2 of 10
  did not start from a settled screen (the fresh page's work); the medians include them.
- **LayerTree:** the bar adds no drawing layer. 30 %: 47 drawing layers, 69.2 Mpx without chips, the same without the
  bar; with Focus, Mappings, a filter and the Hand tool on, 50 layers and 610.5 Mpx, the same without the bar. 100 %: 48
  and 68.4, and 51 and 610.3, each the same without the bar. The 3 layers and about 540 Mpx with the four items on come
  from the items themselves (with or without the bar alike), not from the bar.

**Question:** “Show all” costs about 90 ms more than the controls at 30 % with a filter, mostly the fresh page after its
write. *Proposal:* leave it as it is in this slice (it matches “Expand all”, and S6A-09 has no limit for it), and note
in `docs/ideas.md` that the command's fresh page could be dropped when only cards change, since the canvas already shows
the result.

Runs: lint, typecheck, unit tests (79 files, 1,040 tests) pass. The slice's specs, slice 2c's specs (collapsed frames,
“Collapse all”/“Expand all”, which share the frames' queue), S5A-07, S4B1-06 and S4B1-08: 47 passed, 5.3 min.
S6A-09 in the measurement build: passed, 14.6 min (two earlier attempts stopped on the test itself: a click in the
dense view the neighbouring cards covered, then the clash of test ids, both fixed).

Łukasz accepted step 3 (22 October 2026): the fresh page after “Show all” stays, and the idea of dropping it when only
cards change goes to `docs/ideas.md` (done).

## Step 4: layout (22 October 2026)

### Before step 4: three points

**1. Why a chip costs more on a dense canvas.** `S6A-09-hand.spec.ts` (measurement build, on demand) traces seven
single “Hand on” switches per case and sums the main thread's phases in the 300 ms after the click (medians, ms):

| Case | script | style (elements) | layout (dirty / total objects) | paint | layerize |
| --- | --- | --- | --- | --- | --- |
| 30 %, with the bar | 42.0 | 23.3 (5,165) | 2.6 (36 / 15,578) | 5.5 | 20.4 |
| 30 %, without the bar | 15.7 | 28.9 (5,158) | 0 | 6.0 | 20.4 |
| 100 % dense, with the bar | 112.0 | 79.0 (19,957) | 5.9 (36 / 56,148) | 23.8 | 11.2 |
| 100 % dense, without the bar | 34.1 | 81.6 (19,952) | 0 | 20.9 | 11.5 |

- **Style is not the bar's.** The Hand tool's own class on the canvas restyles about 20,000 elements in the dense view
  (5,000 at 30 %), with or without the bar; the chip adds 5 to 7 elements.
- **Layout is the bar's, and it grows with the canvas.** Without the bar the switch has no layout at all. With it, one
  layout with 36 dirty objects runs over a layout tree of 56,148 objects in the dense view (15,578 at 30 %): 5.9 against
  2.6 ms.
- **Where the time goes:** with the bar, script grows by about the style time (about 70 ms dense, 25 ms at 30 %). The
  fold reads the chips' widths (`offsetWidth`) in a layout effect right after the Hand tool's class change, so the
  browser recalculates the 20,000 styles and lays the page out synchronously inside the commit instead of in its own
  frame step. The work moves; it is not done twice.
- **Tried: a static `contain: strict` on the breadcrumbs row** (`breadcrumbs.tsx`; the row's own element, never toggled,
  its height fixed anyway; AD-24 rule 4 holds). The trace still shows one layout with 36 dirty of 56,148 objects
  (4.1 ms dense, 1.9 ms at 30 %, within the drift of the other phases between the two runs: paint moved as much), and
  the forced style stays.
- **S6A-09's Hand pair, before / after the containment** (to the screen, median beyond the same switch without the bar):
  30 % +7.2 → +2.3 ms; dense +14.7 → +10.1 ms (Hand off: +0.5 → +1.1, +3.7 → −0.6). Both within the 16 ms limit.
- **Cause and proposal (not done, as asked):** the remaining growth is the synchronous style and layout that the fold's
  width reads force when a chip appears in the same commit as a canvas restyle. *Proposal:* measure the chips without
  forcing it: take their widths from a `ResizeObserver` on the hidden copy (it reports after the browser's own layout)
  and fold from there, so a chip appearing never reads layout in the commit. The containment stays: static, harmless,
  and it keeps the row's own layout to itself.

**2. S6A-09 is on demand, like S5A-08.** `playwright.config.ts` ignores `S5A-08.spec.ts` and now `S6A-09*.spec.ts`
(S6A-09 and its follow-up `S6A-09-hand`) unless `MEASURE_BUILD=production`, so `npm run e2e` never runs them; both need
`npm run measure:build` and `MEASURE=1 MEASURE_BUILD=production`. `HAND_ONLY=1` runs only S6A-09's Hand pair.

**3. `resetCanvasView` moved to `src/domain/commands/canvas.ts`**, with the canvas-level commands (create, rename, look),
written there on its own rows instead of the frame commands' draft; its 7 tests are in `canvas.test.ts` (the undo test
now carries the card's entity and concept, which the undo's consistency check needs). The frames scenario's medians in
step 3's table are marked as including 1 and 2 unsettled switches.

### The top bar (items 9–11 as amended)

- **The prototype's steps**, each a class on the element itself: up to 2,100 px short labels (All / Maps / Rels, IE /
  UML), narrower tool padding and switchers (150 px); up to 1,880 px icons only for Focus, Hand, Entity, Note and Frame
  and no “No working context” text; up to 1,300 px no brand and no path separators, switchers 110 px, the working
  context's label at most 100 px. Tailwind's `min-[1880px]` includes 1,880 px while the prototype's steps apply at
  ≤ 1,880, so the app's boundaries are written 1 px higher (`max-[1881px]`, `min-[1881px]`).
- **The tools never shrink** (`bar-tools` is `flex-none`): the switchers' names shorten first, down to 52 px (44 px up to
  1,000 px).
- **“More” (⋯)**, `src/canvas/MoreTools.tsx`, at the tools' right end; the widths in `src/canvas/more-breakpoints.ts` (a
  plain module, since the server page and the client menu share them): **up to 1,200 px** Focus and the notation switch
  move there, **up to 1,100 px** the Entity, Frame, Note and Hand tools too. Set by measurement with the working context
  on (its widest state, “Working on CR-23”): at 1,101 px the bar overflowed by 35 px with Focus and the notation still in
  it, and at 1,001 px the switchers were at their minimum with no room left for a longer role label (e.g. “Modeler ·
  guest”), so both steps moved up by 100 px from my first try (1,100 and 1,000). Up to 1,200 px the working context's
  label is at most 56 px, up to 1,000 px 40 px; up to 1,000 px the bar's gaps and the layer switch's padding are smaller.
  The layer switch, the working context, undo, zoom, both panel buttons and the user indicator are never in “More”.

**Measured** (S6A-10, Łukasz on Customer & orders, working context on, both panels shown; scroll = how far the bar
scrolls; switchers organization / workspace / project; px). Before (step 1): tools cut from about 1,700 px (zoom at
1,600; working context, undo and zoom at 1,300; notation, context, undo and zoom at 1,000; Note and Hand too at 800).
After: nothing cut at any width.

| Window | scroll | switchers | tools in the bar |
| --- | --- | --- | --- |
| 2,560 | 0 | 88/131/118 | layer 261, Focus 72, Entity 72, Frame 75, Note 66, Hand 69, notation 136, context 136, undo 56, zoom 128 |
| 2,100 | 0 | 84/127/114 | layer 136, Focus 68, Entity 68, Frame 71, Note 62, Hand 65, notation 83, context 136, undo 56, zoom 128 |
| 1,880 | 0 | 84/127/114 | layer 136, Focus 28, Entity 28, Frame 28, Note 28, Hand 28, notation 83, context 136, undo 56, zoom 128 |
| 1,600 | 0 | 84/127/114 | the same |
| 1,536 | 0 | 84/127/114 | the same |
| 1,300 | 0 | 84/110/110 | the same, context 130 |
| 1,201 | 0 | 58/86/77 | the same (the tightest width: 6, 34 and 25 px above the switchers' minimum) |
| 1,200 | 0 | 84/110/110 | layer 136, Entity 28, Frame 28, Note 28, Hand 28, context 86, undo 56, zoom 128, More 28 |
| 1,101 | 0 | 67/99/90 | the same |
| 1,100 | 0 | 84/110/110 | layer 136, context 86, undo 56, zoom 128, More 28 |
| 1,000 | 0 | 84/110/110 | layer 112, context 70, undo 56, zoom 128, More 28 |
| 800 | 0 | 51/74/67 | the same |

### The remembered view (items 12–14 as amended in Q5)

`ModelCanvas` saves the view as `{ x, y, zoom, left }`, `left` the canvas root's left edge on the screen (rounded), on
every `onMoveEnd` (React Flow also reports the opening view, so a view is in the new format right after a canvas
opens). On open, the one `setViewport` it already makes moves `x` by the saved `left` minus the current one; the canvas
is still hidden then, so there is no second commit and no visible jump. A view without `left` opens as stored.

### Tests and runs

- S6A-10 (above) and S6A-11 (two tests: an old view opens exactly as stored; a view saved with the left panel at 264 px,
  put back as saved, opens with the card at its place, ±1 px, with the panel hidden, at 520 px and in a 1,000 px
  window).
- Lint, typecheck, unit tests (79 files, 1,040 tests) pass.
- The slice's specs, slice 5a's (S5A-02, S5A-04, S5A-06 and the rest), S0-11, and every earlier spec that touches the
  top bar's tools, the switchers, the working context, the viewport size or a copied view (39 files: S0-02 to S0-10,
  S1A-06, S1B-07, S1B-14, S2A-07, S2A-08, S2A-10, S2A-11, S2A-13, S2B-01, S2B-12, S2B-13, S2C-06, S2C-09, S3A-06,
  S3A-11, S3A-13, S3B-01 to S3B-04, S3B-10, S3B-12, S4B1-06, S4B1-08, S4B2-03, S4B2-07, S4B2-09): **93 passed,
  14.5 min**; no earlier spec changed.

Łukasz accepted step 4 (22 October 2026).

## Step 5: closing (22 October 2026)

### 1. The fold without reading layout in a commit

`view-state-bar.tsx` no longer reads `offsetWidth` or `clientWidth`: a `ResizeObserver`, set up again when the chips or
the page change, reports the row's width, its breadcrumbs and the hidden copy's chips after the browser's own layout,
and the fold runs from those sizes (`fit-chips.ts` and its 16 px hysteresis unchanged). The state is now how many chips
are folded from the end, so a chip that appears shows at once (clipped for a frame at most) and folds once measured;
the first version kept a “shown” count, which held a new chip back for one frame and cost a second frame with a full
layerize (24 against 10 ms dense in the trace), so it was changed before the figures below.

`S6A-09-hand` (seven traced “Hand on” switches per case, medians in ms; layout as dirty / total objects):

| Case | script | style | layout | layerize |
| --- | --- | --- | --- | --- |
| dense, with the bar, before (step 4, contained) | 102.3 | 69.8 | 4.1 (36 / 56,148), forced in the commit | 10.8 |
| dense, with the bar, after | 31.8 | 94.6 | 1.4 (24 / 28,063) | 11.2 |
| dense, without the bar | 29.8 | 91.1 | 0 | 10.9 |
| 30 %, with the bar, before (step 4, contained) | 34.4 | 22.4 | 1.9 (36 / 15,578), forced in the commit | 14.8 |
| 30 %, with the bar, after | 14.1 | 21.5 | 0.8 (24 / 7,778) | 15.7 |
| 30 %, without the bar | 15.2 | 32.0 | 0 | 13.2 |

The forced style is gone: with the bar, script equals the case without it (31.8 against 29.8 ms dense). What is left is
one layout of 24 dirty objects in the browser's own frame step, 1.4 ms dense and 0.8 ms at 30 %.

S6A-09's Hand pair (to the screen, median beyond the same switch without the bar; on / off):

| | 30 % | 100 % dense |
| --- | --- | --- |
| Step 3 (no containment) | +7.2 / +0.5 | +14.7 / +3.7 |
| Step 4 (`contain: strict`) | +2.3 / +1.1 | +10.1 / −0.6 |
| Step 5, run 1 (ResizeObserver) | +10.2 / +17.8 | +1.2 / −0.2 |
| Step 5, run 2 | +7.1 / +5.1 | +7.1 / +1.6 |

The two step 5 runs of the same build differ by up to 12 ms (run 1's case without the bar at 30 % ran faster than in any
earlier run: 64.3 / 53.9 against 70–73 / 60–66), while the phase trace shows the same main-thread work with and without
the bar. I read the remaining difference as the sitting's noise (no laptop preparation, AD-24 “Measuring”), not a cost
of the bar.

### 2. The containment

The “+{n}” menu renders in a portal (`DropdownMenuContent` wraps Radix's `DropdownMenu.Portal`,
`src/ui/components/dropdown-menu.tsx`), outside the row; the chips', “Show all”'s and the breadcrumbs' tooltips are
native `title` attributes, drawn by the browser outside the page. Nothing that opens from the row renders inside it, so
`contain: strict` stays.

### 3. Docs

- `docs/known-limitations.md`: “Live canvases without the view-state bar”, “Focus without the view-state bar”, “A
  remembered canvas view and a different left panel”, “The top bar on narrow windows” (with the measured figure, about
  1,700 px, not 1,100) and “The status bar has no ‘Open notes on canvas {n}’” closed in slice 6a, the old text kept.
- `docs/ideas.md`: “A top bar that fits narrow windows” done; “No fresh page after ‘Show all’ when only cards change”
  added (step 3).
- `docs/inventory-prototype-vs-app.md`: the view-state rows done; back and forward for 6b; the deliberate differences
  (no lens chip, no role or archived chip, “Entity tool”, the fold into “+{n}”, “Show all” from two removable chips,
  readers' chips without ×, “More” instead of hiding, the remembered view's correction).
- README: the status and the slice's summary, the two measuring commands. CLAUDE.md: the two measuring commands, the
  slice's e2e helpers, the remembered view, a “View-state bar” paragraph (the counts store, the bar reads stores, never
  re-renders `ModelCanvas`, never reads layout in a commit; `resetCanvasView`; “More” and its breakpoints; Tailwind's
  `max-[N+1px]`), and the lesson for later PRDs: **nothing above the canvas reads layout during a commit; use a
  `ResizeObserver`**.
- `docs/decisions.md`: not written yet; the texts below wait for Łukasz's approval.

**D-39, proposed final wording** (replaces the current line):

> **D-39** A view-state bar at the right end of a canvas page's breadcrumbs row shows everything that hides or fades
> items on the canvas (Focus, layer, filters, collapsed cards, collapsed frames, hidden notes, active tool), each
> removable with its ×, plus “Show all” from two chips the person can remove. A live canvas's “Live: {name}” chip comes
> first, without ×, and its Labeled filter is not counted as filtered and is kept by “Show all”. The row's height never
> changes: chips that do not fit fold into “+{n}”, whose menu lists them with their ×, while “Live: {name}” and “Show
> all” stay visible. Removing the filters, the collapsed cards or the collapsed frames is one undo step, and so is what
> “Show all” changes of them; Focus, the layer, hidden notes and the tool are view state outside undo. Who cannot edit
> the canvas sees the filter and collapsed-card chips without ×. (Changed in slice 6a: no lens since slice 4b-1, D-32; no
> role chip, the user indicator shows the role.)

**D-54, proposed addition** (a sentence before the narrow-window part):

> A canvas's remembered view is stored with the canvas's left edge on the screen (the left panel's width; 0 when it is
> hidden or the window is up to 1000 px wide) and corrected by the difference when the canvas opens, in the same step
> that sets the view, so the model stands where it stood; views saved before slice 6a open unchanged. (Added in slice
> 6a.)

### 4. Runs

Lint, typecheck, unit tests (79 files, 1,040 tests) pass. The slice's specs (S6A-01 to S6A-08, S6A-10, S6A-11), S0-04
and S0-11 (the breadcrumbs row) and S5A-06 (the bar at 1,000 px): **23 passed, 2.9 min**. In the measurement build:
S6A-09-hand and S6A-09 with `HAND_ONLY=1` (twice), all passed.

Next: one full e2e run on a quiet laptop, when Łukasz says so; then the manual acceptance.

### Łukasz's answers (22 October 2026)

Points 1–4 accepted.

- **S6A-09 is met on the trace evidence**: with the bar, the main thread does the same work as without it (script
  31.8 against 29.8 ms dense, 14.1 against 15.2 ms at 30 %; one layout of 24 dirty objects, 1.4 and 0.8 ms, in the
  browser's own frame step). The two Hand-pair runs of step 5 stay as diagnostic figures; their run-to-run spread (up to
  12 ms) is larger than what is measured. CLAUDE.md gets the lesson: once a UI addition costs a few milliseconds,
  compare phase traces with and without it rather than unprepared medians to the screen.
- **D-54** approved as quoted; **D-39** approved with three edits (“hidden resolved notes” in both places; “People who
  cannot edit the canvas see”; the fold sentence: “…chips that do not fit fold into “+{n}”, after the breadcrumbs above
  the current page have shrunk; its menu lists them with their ×, while “Live: {name}” and “Show all” stay visible.”).
  Both written into `docs/decisions.md`.

### 5. The full e2e run (22 October 2026)

`npm run e2e` from scratch, no dev server, the laptop quiet (Łukasz), S6A-09 and S6A-09-hand excluded as configured:
**227 passed, 2 failed, 37.2 min** (11:31–12:08). Each failure run three times on its own:

- **S6A-02** (“a chip's × does what its switch does…”): `EPERM: operation not permitted, rename …e2e-db.json.<id>.tmp
  -> …e2e-db.json` in the local adapter's write (`src/data/local/file.ts`, after its retries), during the test's own
  write: a Windows file lock, not the app. Alone: **3 of 3 passed**. A flake of the local adapter on Windows.
- **S6A-08** (“a chip folding into “+{n}” and coming back…”): Focus off added 3 canvas and 3 miniature commits. Alone:
  **3 of 3 passed**. The layer switch before it is saved on the server and can bring a fresh page; under the full run's
  load it arrived inside the measured switch. Fixed in the test: `commitsOf` now waits until the commit counters have
  not moved for 800 ms (was a fixed 400 ms pause) before it counts; S6A-08 then passed (3 tests).

GitHub CI on the PR (check, migrations): passed.

### 6. Manual acceptance (Łukasz)

Start the app on the preview data (it has CR-23's live canvas):

PowerShell:

```powershell
$env:INFOMAPPER_DEV_DB = ".data/preview-db.json"; npm run dev
```

bash:

```bash
INFOMAPPER_DEV_DB=.data/preview-db.json npm run dev
```

Sign in at http://localhost:3000/sign-in as Łukasz; open Retail Co – DWH › Customer 360 › Customer & orders, the window
at least 1,600 px wide, both panels shown.

| # | Do | Expected |
| --- | --- | --- |
| 1 | Press A (Frame tool) and draw a frame around Sales Order and Order Line; collapse it with the ˄ button on its name. | A block; the bar shows “1 frame collapsed” with ×. |
| 2 | With nothing selected, untick “Show resolved notes on the canvas” in the right panel. Click Customer, press Focus, switch to Mappings, and click Customer's filter button twice (Unmapped). | Chips in this order: Focus · Mappings only · 1 card filtered · 1 frame collapsed · Resolved notes hidden, then “Show all”. The status bar has no Focus chip and ends with “Open notes on canvas 2”. |
| 3 | Remove “1 card filtered” with its ×. | Customer shows all its rows; the chip goes; the others stay. |
| 4 | Press “Show all”. Then Ctrl+Z (click an empty spot on the canvas first). | Every chip goes: Focus off, Everything, the frame expanded, the resolved note back; the toast “Showing everything on this canvas.” with Undo. Ctrl+Z collapses the frame again (“1 frame collapsed”); Focus, Mappings and the hidden notes do not come back (view state). |
| 5 | Open the CR-23 tab (the live canvas). | “Live: CR-23” first, dashed, no ×; its Labeled filters are not counted, so there is no filter chip. (In the preview data two of its frames are collapsed: “2 frames collapsed”, no “Show all” for one chip.) Back on Customer & orders: no live chip. |
| 6 | Narrow the window to 1,536 px, then to 1,100 px (browser window or DevTools' responsive mode). | 1,536: every tool in the bar as an icon, nothing cut off. 1,100: Focus, the notation and the Entity, Frame, Note and Hand tools have left the bar; “⋯” at the tools' end holds them; Hand tool from there gives the “Hand tool” chip. The layer switch, the working context, undo, zoom, the two panel buttons and your indicator stay in the bar. |
| 7 | Back at full width, with four chips on and the window around 1,280 px, if they do not all fit. | The last chips fold into “+{n}” (its menu lists them with ×); “Show all” stays visible; the canvas does not move up or down. |
| 8 | On Customer & orders pan the canvas a little and note where Customer stands. Hide the left panel with the toolbar's left button, then reload (F5). Show the panel again and reload. | Customer stays at the same place on the screen through each step. |
