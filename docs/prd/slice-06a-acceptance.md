# Slice 6a – Acceptance

Status: **step 1 (questions) done, waiting for Łukasz.** Branch `slice/06a-view-state-bar`, from `main` at the tag
`slice-05a` (`93f0df7`). PRD: `docs/prd/slice-06a-view-state-bar.md`.

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
