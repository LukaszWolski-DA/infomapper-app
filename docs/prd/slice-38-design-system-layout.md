# Slice 38 – Design system layout

Status: **proposed** (27 November 2026). The second of the design system pair (slice 37: the foundation, the look,
merged on 27 November 2026 as `ed5e9346dced464a96b531b506667b32b39ad66e`, tag `slice-37`, D-89; slice 38: the layout).
**Full path** (CLAUDE.md, "The slice cycle", 2): it moves controls on every canvas screen, changes the homes' layout and
InfoDocumenter's bar, and rewrites earlier e2e specs that read places; it changes no data. Branch
`slice/38-design-system-layout`, from `dev` (`ed5e934` or later). PRD file: `docs/prd/slice-38-design-system-layout.md`;
step 1 writes `docs/prd/slice-38-acceptance.md`. Test regime: CLAUDE.md, "Testing". The slice number is an assumption
(step 1 confirms it is the next free one).

**One file in Łukasz's Downloads folder** (The slice cycle, 3): this PRD (SHA-256 given in the prompt). **The prototype
does not change:** the repository's `docs/prototype/infomapper-prototype-with-sources.html` is already the one accepted
for this pair (SHA-256 `74c70cd919af6e65eb13f560294de42f6be03fd42d0ff082e546b6d9f0029029`, copied in slice 37's step 1).
Its CSS blocks `/* Design system step 1 … 4 */` near the end of its `<style>` and the script blocks after them show this
slice's layout: the canvas toolbar (`#ctb`), the homes as pages (`main.pagemode`, `.pg-cols`, `.pg-more`), InfoDocumenter's
bar (`.de-top`), list rows (`.li .n:has(+.m.mono)`) and the phone (`@media (max-width:600px)`). Not in this slice: the
prototype's InfoCatalog, its "All apps" button, the "Proposals" tab and the canvas in a second window.

Written from the decision rounds DS1 to DS3 and the criteria agreed with Łukasz on 27 November 2026 (no file in the
repository; quoted as "DS3.1" etc.), slice 37's acceptance doc and D-89, the prototype, and lookups in the code on `dev`
at `ed5e934` (marked "fact, `ed5e934`"). Facts and assumptions are marked; every assumption is to be checked in step 1.

## 1. Why

The audit of 26 November 2026 (slice 37's PRD, section 1): **the top bar holds about 20 controls** (the path, the canvas's
view, eight tools, undo and redo, zoom, panels, account) and at 1,440 px and less cuts the path's names to two to four
letters; InfoDocumenter's editor has its own bar under a bare top bar (two header patterns); the homes show side panels
that are empty or repeat the page; on a phone the top bar's controls run into each other. Tools such as Figma, Miro or
Enterprise Architect keep the app's header (where am I, account) apart from the canvas's toolbar (what is shown,
notation, tools, zoom). Slice 37 gave every control one look and changed no place; this slice moves them.

Decisions taken before this PRD (Łukasz, 26–27 November 2026, on Claude's recommendations):
- **DS3.1** the canvas toolbar with "Names ▾"; the top bar keeps the path, the working context, the save state, "Local",
  undo and redo, the panels and the account.
- **DS3.2** the homes as pages (Łukasz's idea 1 of 26 November).
- **DS3.3** InfoDocumenter's bar in one row under the app's top bar.
- **DS3.4** the phone's top bar.
- **DS3.5** a canvas in a second window is not in this slice.
- **From slice 37** (D-89, its known limitation): the working context's label gets at least 40 px again at every width.
- **Correction of fact (Claude, 27 November 2026):** DS3.3 and the criterion S38-04 as agreed list "Generate version" in
  InfoDocumenter's bar. **The app has no such control** (fact, `ed5e934`: `editor.tsx`'s bar holds `link-documentation`,
  the name, `text-pages`, `select-preview-mode`, `select-preview-zoom`, `button-print`, `button-markdown`, and the
  read-only banner with `button-duplicate-mine`; "a version (Generate version)" is an idea in `ideas.md`). The bar holds
  the controls it has today; nothing is added. Łukasz is told in the chat.

## 2. What to build

### The canvas toolbar (S38-01)

Fact, `ed5e934`: the canvas page (`src/app/w/[workspaceId]/p/[projectId]/c/[canvasId]/page.tsx`, `CanvasTools`) passes
into the top bar `LayerSwitch`, `NamesSwitch`, `FocusButton`, `ChangesButton`, `EntityToolButton`, `FrameToolButton`,
`NoteToolButton`, `HandToolButton`, `NotationSwitch`, `WorkingContextButton`, `UndoButtons`, `ZoomControls` and `MoreTools`;
on a narrow window `src/canvas/more-breakpoints.ts` moves the names' check boxes (≤ 1,300 px), Focus and the notation
(≤ 1,200 px) and the four tools (≤ 1,100 px) into "More".

- **A floating toolbar at the canvas's top, centred** (the prototype's `#ctb`; the design system's CanvasToolbar: a white
  box, radius 12, `shadow-pop`, 4 px padding, 28 px controls, a hairline separator between groups). Order: what is shown
  (All · Maps · Rels) | Focus, Changes | the tools (hand, entity, frame, note, More tools) | the notation (IE · UML) |
  **Names ▾** | zoom. *Assumption:* drawn as a React Flow `Panel` (top-center) or as an element over the canvas outside
  React Flow (AD-24's rules; Q1).
- **"Names ▾":** one button opening a small menu with the two check boxes "Entity aliases" and "Attribute aliases"
  (slice 11's `NamesSwitch`, its states and rights unchanged: indeterminate while a card has an exception; editors only;
  its test ids kept on the check boxes).
- **Every control keeps** its shortcut, test id, title and behaviour; `aria-label`s from the titles where a control shows
  only an icon.
- **"More" by the canvas's width,** not the window's: when the toolbar does not fit the canvas (both panels open on a
  narrow window), the same groups move into "More" in the same order (Q2). *Assumption:* a container query on the
  canvas's area replaces `more-breakpoints.ts`' window breakpoints.
- **Fitting the view leaves room for the toolbar:** `fitViewport` (`ModelCanvas.tsx`) reserves the toolbar's height at
  the top, so it never covers a card after a fit (the prototype's `fitRect` override; Q3). The overview keeps its place.
- **Hidden on the homes** (they are pages, no canvas).

### The top bar (S38-02)

Holds: the path (organization / workspace / project switchers), the working context, the save state, "Local", undo and
redo, the panels' toggles, the account. **The working context and undo / redo stay in the top bar** (DS3.1), out of the
canvas's tools. Requirements:
- at 1,280 and 1,440 px no name in the path is cut to a few letters (the switchers' minimum and maximum widths are
  revised now that the bar has room; Q4);
- the working context's label has **at least 40 px at every width from 800 to 2,560 px** (closes D-89's known limitation
  at 1,201–1,250 px; the 7 px tools gap of slice 37 goes);
- the bar never scrolls.
S6A-10, S6A-11 and S16-08 are rewritten to the new bar (S38-02, S38-07), each change listed with its reason.

### The homes as pages (S38-03)

Fact, `ed5e934`: the workspace home (`src/app/w/[workspaceId]/page.tsx`) and the project home
(`src/app/w/[workspaceId]/p/[projectId]/page.tsx`) render inside the app shell with the side panels
(`side-panels.tsx`, `app-shell.tsx`). As the prototype (`main.pagemode`, Łukasz's idea 1 and "wider and aligned"):
- **no side panels** on both homes; the top bar's panel toggles still open a panel on a page (until one leaves the pages);
- what only the right panel said moves onto the page: **"Other workspaces in …"** at the end of the workspace's Overview;
  **"Other projects"** (with "The model is shared by all n projects…") on the project home above its danger zone
  (Q5: what the right panel shows on each home today, item by item);
- content up to **1,320 px**, centred, 32 px side gutters;
- **the project home in two columns** (`minmax(0,1fr) 420px`, the prototype's `.pg-cols`): the work on the left (model
  consistency, model checks, canvases, all one width), the lists on the right (requirements without their kind, names
  wrapping; labels; open notes; other projects); one column below about 1,100 px (Q6);
- the workspace's lifecycle cards four in a row; tiles at least 240 px;
- **leaving a page, the canvas comes back at its own width, never shifted** (the prototype fits only at the canvas's
  real width; Q3).

### InfoDocumenter's bar (S38-04)

The app's top bar stays as everywhere (the path, the account). Under it the document's bar in **one row of 48 px**:
back (`link-documentation`), the document's name, Shared / Private (and Read only), the page count, the preview mode,
zoom, Print / PDF, Markdown, the panels (the correction in section 1: nothing is added). At 1,280 px it never wraps; a
long name shortens with an ellipsis (the full name in its title); controls change places only to fit that one row. The
read-only banner stays where it is (Q7). Generated documents are byte for byte as before (slice 37's compare).

### List rows (S38-05)

In a list row with a name on the left and physical names on the right (the entity's "Attributes and their sources" in
`entity-panel.tsx`, and every row of that shape step 1 finds): the name stays whole up to 65 % of the row, the physical
names shorten with an ellipsis, the full text in their title. Rows with a short detail on the right ("via attribute")
keep today's behaviour.

### The phone (S38-06)

At 390 px (the prototype's `@media (max-width:600px)`): the top bar keeps the panels' toggles, the path and the account;
it hides undo and redo, the working context, the save state and "Local". Nothing overlaps (slice 37's after-report left
28 overlaps at 390 px: the top bar, the path over the canvas's cards, a panel field over a note's ✓); the details panel no
longer covers the navigation row; the canvas toolbar and the tab rows scroll sideways with a fade at the edge; no page
scrolls sideways.

### The check script and the before / after page (S38-07)

Slice 37's `npm run ui:check` (D-89): the **before** run at the start of step 2 on `dev`'s look; the **after** run in
the last build step; one side-by-side page as in slice 37
(`.data/ui-check/slice-38-before-and-after.html`). New screens: the canvas toolbar with "Names ▾" open and with "More"
open on a narrow canvas; both homes at 1,280 and 1,920 px; InfoDocumenter's bar with a long document name. At 1,280 px
and wider it finds nothing.

### Tests

- E2E specs that read a control's place are rewritten, each listed with its reason: S6A-10, S6A-11 (the top bar's
  widths), S16-08 (the working context's label), the "More" specs of slice 6a, slice 11's names specs (the check boxes
  move under "Names ▾"), and the editor's bar specs (slices 26 and 28) where they read positions (Q8 gives the list).
- New: a spec that the toolbar never covers a card after a fit; a spec of "Names ▾"; a spec of the homes without side
  panels (the moved lists present, the toggles still open a panel); a spec of the working context's 40 px at the 13
  widths; a spec of InfoDocumenter's bar in one row with a long name at 1,280 px.
- Unit: the toolbar's grouping and "More" by width; the fit's reserved top.

### Not in this slice

InfoCatalog (its own slices); a canvas in a second window; Łukasz's open point on the left panel's tabs (`ideas.md`,
slice 37); shortcuts in tooltips and a "?" sheet; new controls in InfoDocumenter's bar.

## 3. Data model

None. No migration, no change to the local file, no Vercel, GitHub or Supabase settings.

## 4. Sources

- Decisions: D-89 (slice 37) and AD-20's note (the components, the guard), AD-24 (the canvas engine's rules, "never on
  the page", rule 4), slice 6a's decisions on "More" and the top bar, slice 11's on the names, slice 16's on the working
  context (D-? as `decisions.md` names them).
- Code (fact, `ed5e934`): the canvas page's `CanvasTools`; `src/canvas/more-breakpoints.ts`, `MoreTools.tsx`,
  `NamesSwitch.tsx`, `ModelCanvas.tsx` (`fitView`, `fitViewport`); `src/app/_components/top-bar.tsx`,
  `working-context.tsx`, `undo.tsx`, `side-panels.tsx`, `app-shell.tsx`; the two homes' pages;
  `src/modules/infodocumenter/app/editor.tsx`; `src/app/_panels/entity-panel.tsx`.
- The prototype: `#ctb` and its script block, `main.pagemode`, `.pg-cols`, `.pg-more`, `.de-top`, `.li .n:has(+.m.mono)`,
  `@media (max-width:600px)`.
- Slice 37's acceptance doc (the check script, its rules, the 390 px findings).

## 5. Steps

Stop after each step; wait for Łukasz.

1. **Reconnaissance and check.** Copy this PRD from Downloads into the repository and check it with `cmp` and the
   SHA-256 (stop if it differs); confirm the prototype in the repository is `74c70cd9…9029`. Answer Q1–Q9 in
   `slice-38-acceptance.md`: every place where the PRD is wrong or costs more than it assumes, with a proposal; the
   earlier specs each step changes; the plan for steps 2 to 9. No application code.
2. **The canvas toolbar** (the before run of the check script first): the toolbar, "Names ▾", "More" by the canvas's
   width, the fit's reserved top. A draft PR into `dev`.
3. **The top bar:** what stays, the path's room, the working context's 40 px, the bar's specs rewritten. **A full run.**
4. **The homes as pages.**
5. **InfoDocumenter's bar.**
6. **List rows and the phone.**
7. **The after run,** the side-by-side page, the document compare, a full run.
8. **Łukasz's acceptance** on `npm run dev:pg` with demo accounts: the side-by-side page first, then the screens he
   chooses. **Stop** with what he saw.
9. **Close.** The docs and the decisions quoted in full for approval (section 8); one full run on the final commit.
   Merge into `dev` and tag `slice-38` only on Łukasz's command.

Each of steps 2 to 6 ends with lint, typecheck, `npm test`, the specs of the screens touched as single files (nothing
else running) and the check script on those screens.

## 6. Acceptance criteria

Łukasz's criteria (27 November 2026, agreed one at a time).

| ID | Criterion |
| --- | --- |
| S38-01 | **The canvas has its own toolbar.** The canvas's controls leave the top bar and float in a toolbar at the canvas's top: what is shown (All · Maps · Rels), Focus and Changes; the tools (hand, entity, note, frame, More tools); the notation (IE · UML); "Names ▾", a button holding the "Entity aliases" and "Attribute aliases" check boxes with the same behaviour (indeterminate while a card has an exception; editors only); zoom. Every control keeps its shortcut, test id and behaviour. Fitting the view leaves room for the toolbar, so it never covers a card. The toolbar is hidden on the workspace and project homes. |
| S38-02 | **The top bar says where you are.** With the canvas's controls gone, the top bar holds the path (organization / workspace / project), the working context, the save state, "Local", undo and redo, the panels' toggles and the account. At 1280 and 1440 px no name in the path is cut to a few letters; the working context's label has at least 40 px at every width from 800 to 2,560 px (slice 37's known limitation at 1,201–1,250 px closes); the bar never scrolls. S6A-10, S6A-11 and S16-08 are rewritten to the new bar, each change listed with its reason. |
| S38-03 | **The homes are pages.** The workspace home and the project home show no side panels; what only the right panel said moves onto the page ("Other workspaces in …" at the end of the workspace's Overview; "Other projects" on the project home). The content runs up to 1,320 px, centred; the project home in two columns, the work on the left (model consistency, model checks, canvases) and the lists on the right (requirements with names wrapping, labels, open notes, other projects); the workspace's lifecycle cards four in a row. The top bar's panel toggles still open a panel on a page; leaving a page, the canvas comes back at its own width, never shifted. As in the prototype. |
| S38-04 | **InfoDocumenter's editor follows InfoMapper's pattern.** The app's top bar stays as everywhere (the path, the account); under it the document's bar in one row of 48 px: back, the document's name, Shared / Private, the page preview, zoom, Print / PDF, Markdown, the panels. At 1280 px it never wraps to a second row; a long name shortens with an ellipsis. Controls change places only to fit that one row. Generated documents are byte for byte as before. *(As agreed, the list also named "Generate version"; the app has no such control: section 1's correction.)* |
| S38-05 | **Names win in list rows.** In a list row with a name on the left and physical names on the right (e.g. an attribute with two sources: `email` ← `customers.email_addr, web_users.email`), the name stays whole up to 65 % of the row and the physical names shorten with an ellipsis, the full text in their title. Rows with a short detail on the right ("via attribute") stay as they are. As in the prototype. |
| S38-06 | **A phone shows what matters.** At 390 px the top bar keeps the panels, the path and the account, and hides undo and redo, the working context, the save state and "Local" (the app is not for phones; a phone is for looking). Nothing overlaps (the 28 overlaps slice 37 left at 390 px are gone; the details panel no longer covers the navigation row); the canvas toolbar and tab rows scroll sideways with a fade at the edge; no page scrolls sideways. The check script's report shows it. |
| S38-07 | **Nothing else changes.** Every control does what it did, with its shortcut, test id and title. E2E specs that read a control's place (the top bar's widths, the "More" breakpoints, the editor's bar) are rewritten to the new layout, each listed with its reason; no other spec changes. Generated documents, the canvas's cards and the data are unchanged; no migration, no settings in Vercel, GitHub or Supabase. The check script's before / after page (as in slice 37) shows every screen, and at 1280 px and wider it finds nothing. Łukasz's acceptance on `dev:pg` with the demo accounts. |
| S38-08 | CI, the Schema workflow, the full run before the merge; every earlier test changed, with its reason. |

**Manual acceptance:** Łukasz, step 8: the side-by-side page first; then on `dev:pg` with demo accounts: a canvas with
both panels at his usual width and narrower (the toolbar, "Names ▾", "More", a fit), the top bar's path with long names,
both homes, InfoDocumenter's bar with a long name, a phone-width window. Give him long names and many items.

## 7. Questions for step 1

- **Q1. The toolbar's host.** A React Flow `Panel` (top-center) inside the canvas, or an element over the canvas's area
  outside React Flow; AD-24's rules (no variable set on an element around the canvas; "never on the page"); its stacking
  with the overview, the view-state bar, menus and the Changes bar; the canvas page is a server component and the tools
  are client components.
- **Q2. "More".** How "More" works by the canvas's width (a container query or a resize observer), the groups' order and
  breakpoints measured with both panels at 1,280, 1,440 and 1,920 px; whether `more-breakpoints.ts` goes; the specs that
  read it.
- **Q3. The fit.** How `fitViewport` reserves the toolbar's height (a fixed 56 px or measured); every caller of the fit
  (open, "Fit", a canvas switch, the panels' toggles); the canvas never shifted when it comes back from a page.
- **Q4. The top bar's widths.** The switchers' minimum and maximum now; the working context's 40 px at the 13 widths; the
  save state and "Local"; what S6A-10, S6A-11 and S16-08 will check.
- **Q5. The right panel on the homes.** What it shows on each home today, item by item, and where each goes on the page;
  the left panel on the homes; what the toggles do on a page.
- **Q6. The project home's columns.** Which sections go left and right; the breakpoint for one column; the requirements'
  rows without their kind.
- **Q7. InfoDocumenter's bar.** Its controls' widths at 1,280 px with a long name and the read-only banner; the panels'
  toggles (fact: `editor-left`, `editor-right`); slice 26's and 28's specs that read its layout.
- **Q8. The specs.** The full list of earlier specs this slice changes, by step, with the reason each changes.
- **Q9. Risks.** The full run's time and heap with the new specs; anything in the prototype's layout the app cannot take;
  anything that changes this plan.

## 8. Decisions (proposals) and docs

Quoted in full at the closing for Łukasz's approval; proposals for step 1 to correct.

- **D-90 (new): The design system's layout** (slice 38): the canvas toolbar with "Names ▾" and "More" by the canvas's
  width; the top bar's contents; the working context's 40 px at every width; the homes as pages; InfoDocumenter's bar in
  one row; list rows; the phone.
- **D-89 (note):** the known limitation of the working context's label at 1,201–1,250 px closed; the 7 px tools gap gone.
- **Notes** on slice 6a's, slice 11's and slice 16's decisions where their places change ("More", the names' check boxes,
  the working context), and AD-24's if the toolbar's host touches its rules.
- Docs: `decisions.md`, CLAUDE.md (where it names the top bar's contents or "More"), `inventory-prototype-vs-app.md` (the
  layout done), `known-limitations.md` (the working context's entry closed), `ideas.md`, README if needed.

## 9. Left for later

InfoCatalog's slices (built on these components and this layout); a canvas in a second window; Łukasz's open point on
the left panel's tabs; shortcuts in tooltips and a "?" sheet.
