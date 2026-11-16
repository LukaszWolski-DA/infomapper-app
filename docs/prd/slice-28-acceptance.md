# Slice 28 – acceptance

PRD: [`slice-28-editor-ergonomics.md`](slice-28-editor-ergonomics.md). Branch `slice/28-editor-ergonomics`.

## Step 1: the PRD checked against the code (16 November 2026)

### The starting point

- **The branch.** `slice/28-editor-ergonomics` was cut from `main` at `e658184` (the merge of PR 63, slice 27), which was
  also the newest commit on `origin/main` when step 1 started.
- **The two files from Łukasz's Downloads.** There was one copy of each, with no `(1)` copy. Each was checked with
  `cmp` after copying and with `sha256sum` against the prompt's value:

  | File | Bytes | SHA-256 | `cmp` |
  | --- | --- | --- | --- |
  | `docs/prd/slice-28-editor-ergonomics.md` (new) | 11,054 | `e3f09fc4f21f3a2a48ae36883a02269def7e37744c8fdeaf7453aa8e27ab1974` | equal |
  | `docs/prototype/infomapper-prototype-with-sources.html` (replaces slice 27's `b0ba221e…`, 955,142 bytes) | 957,615 | `f3abaa2f14921e07476852b90b575f8fdf5fdd38e7b78876cf7ad98009fd6118` | equal |

- **The prototype is slice 27's plus the editor's panels hidden and shown.** A `diff` against slice 27's file has 8
  hunks, all of them in the PRD's section 4:
  - the CSS of `.de-body`, with the new defaults 264 and 340 and the classes `nol` and `nor` (0 wide, `visibility:
    hidden`, no handle; up to 1,100 px `display: none`);
  - `PANELS`, with the canvas's limits and `hidden`, `cls`, `toggle` and `show`, and the flags kept in the same
    localStorage object as the widths;
  - the two toggles in `drawEditor`'s top bar (`data-de="togl"` before "← Documentation", `"togr"` after
    "Generate version");
  - `PANELS.show("r")` in the double-click handler;
  - "Fit width" drawn again 200 ms after a `de-panels` event.

  Nothing else differs.
- **What ran in this step.**
  - The demo on its own file (`npm run demo -- --reset`, `.data/preview-27.json`, port 3001), measured in headless
    Chromium at 1,500 × 950 with the options panel at 340 px.
  - The script added the missing section types to the demo's dictionary document. A later `--reset` restores the file.
  - No lint, typecheck, unit tests or e2e: this step has no application code.
  - `.data/dev-db.json` and the KB backups were neither read nor written.
- **The review of 16 November 2026.** The PRD's section 2 quotes its findings 1 to 12 from the report given in the
  conversation that day. The numbering below is the PRD's. The screenshots are in `.data/measure/editor-review/`
  (git-ignored).

### Summary

1. **Q1, shared state: the editor keeps its own state** (a small hook beside `PanelHandles`). The limits, defaults and
   cookie format come from the canvas's one module, `src/ui/side-panels-cookie.ts`, which is imported and not changed.
   - `SidePanelsProvider` is not reusable as it stands. It reads `CanvasUiCtx.shiftView` and has the 1,000 px overlay
     and the guide line, all of which the editor must not have.
   - Factoring it out would change the canvas's code against the PRD's "the canvas page's side panels (unchanged)".
   - So step 2 does not touch shared infrastructure and **needs no full run**. The closing run is enough.
2. **Q2, the cookie.** Same name, `im-doc-panels.{user}`, in the canvas's format `l1.r1.264.340`. Slice 27's
   `250.330` is read as both panels shown with those widths. The server draws a hidden panel from the first paint.
3. **Q3, folds.** The canvas's `Fold` (`fields.tsx`) is reused. It needs two small additions:
   - a fold that starts shut (Header and footer, Cover), since `Fold` today always starts open;
   - an optional key prefix (`doc:`), so the editor's titles never share a remembered state with a panel's titles.
4. **The PRD is wrong or incomplete in seven places** (F1 to F7 below):
   - "Fit width" is a scale, not a new layout;
   - view and size on one row still cut "Whole, as large as fits";
   - the Note hint's second text is wrong under "Approved only";
   - the double-click's focus target collides with finding 11;
   - a sixth segment group wraps (Model overview's "Where the figures go");
   - finding 10's cause is a class Tailwind never generates;
   - the element guard in S28-08 measures nothing this slice changes.
5. **Questions for Łukasz before step 2**: at the end, Q-A to Q-F.

### Answers to the PRD's questions

#### Q1: sharing the side panels' state

What `src/app/_components/side-panels.tsx` and `src/ui/side-panels-cookie.ts` hold, and what the editor can use:

| Piece | Where | Usable by the editor as it stands? |
| --- | --- | --- |
| Limits and defaults `PANEL_LIMITS` (200–520 / 264, 280–640 / 340), `clampWidth` | `side-panels-cookie.ts` | **Yes.** It is a plain module with no React and no canvas, and a module's `app` part may import InfoMapper's `ui`. |
| The cookie's state `SidePanelsState` and `formatSidePanelsCookie` / `parseSidePanelsCookie` (`l1.r0.264.340`) | `side-panels-cookie.ts` | **Yes**, with the editor's own cookie name (Q2) |
| `SidePanelsProvider` (`toggle`, `openDetails`, `setWidth`, `openRight`) | `side-panels.tsx` | **No.** It calls `ui.shiftView` from `CanvasUiCtx` on every left-panel change and keeps the narrow overlay below 1,000 px (`NARROW`, `overlay`, `closeLeftOverlay`). The editor keeps its stacking up to 1,100 px and has no overlay (PRD, "Not in this slice"). |
| `SidePanelsGrid` | `side-panels.tsx` | **No.** It sets the grid's columns inline (AD-24's rule against CSS variables above the canvas). The editor's body holds the preview and sets `--dl` and `--dr` (slice 27), which `PanelHandles` writes directly during a live drag. |
| `Grip` | `side-panels.tsx` | **No.** It moves a guide line and applies the width on release, and its double-click shows a toast. The editor resizes live (PRD item 4: this is the one difference left). |
| `PanelToggle` | `side-panels.tsx` | **No.** It reads `useSidePanels()` and the overlay. Its markup (the icon, `aria-pressed`, the classes) is 15 lines. |

**The two ways:**

- **(a) Share.** Make `shiftView` an optional callback, parametrise the breakpoint and the overlay, pass the cookie name
  and limits in, and split the guide line from the live drag.
  - Files: `side-panels.tsx`, `app-shell.tsx`, `top-bar.tsx`, and their slice 5a and 6a specs (S5A-01 to S5A-12,
    S6A's view-state bar reads the shell).
  - The canvas's resize and hide paths would run through the new parameters. Slice 5a measured them (S5A-08), and that
    measurement would have to be repeated.
  - A full run in step 2. Cost: **M to L**.
- **(b) Own state, shared rule. Proposed.**
  - `panel-handles.tsx` gets a hook (`useDocPanels`): `{ left, right, leftWidth, rightWidth }`, `toggle(side)`,
    `show(side)`, `setWidth`.
  - It imports `PANEL_LIMITS`, `clampWidth`, `formatSidePanelsCookie` and `parseSidePanelsCookie` from
    `src/ui/side-panels-cookie.ts`.
  - `src/modules/infodocumenter/ui/panels-cookie.ts` keeps only the cookie's name, its age and the reading of slice
    27's value (Q2). `DOC_PANEL_LIMITS` and its tests go: there is one constant for both pages.
  - The toggle is the editor's own button, with the canvas's icon paths and classes copied (15 lines).
  - No canvas file changes, so there is no full run in step 2. Cost: **S to M**.

#### Q2: the cookie

- **Name.** It stays `im-doc-panels.{user}`. The canvas keeps `im-panels.{user}`, so a panel hidden on the canvas stays
  shown in the editor and the other way round. The PRD's "kept for the person" does not say the two are one setting,
  and D-54 says "on every page with the panels". This is **Q-A**.
- **Format.** The canvas's `l{0|1}.r{0|1}.{left}.{right}`, written by `formatSidePanelsCookie` and clamped by
  `clampWidth`. Example: `l1.r0.264.340` is the sections shown and the options hidden.
- **Reading slice 27's value.** A value matching `^\d{1,4}\.\d{1,4}$` (slice 27's `250.330`) reads as
  `{ left: true, right: true }` with its two widths, clamped by the new limits. Anything else goes to
  `parseSidePanelsCookie`, whose fallback is the defaults.
  - Slice 27's widths all fall within the new limits (200–480 inside 200–520, 280–560 inside 280–640), so nobody's
    width changes.
  - **Edge case.** Slice 27 wrote the cookie only after a drag, a key or a double-click. A person who double-clicked
    back to slice 27's defaults has `250.330` stored and keeps 250 and 330, not the new 264 and 340. The PRD's
    "still opens with its widths" says exactly that, so this doc proposes no mapping. The first write rewrites the
    cookie in the new format.
- **The server's first paint.**
  - `DocumentEditorPage` (`pages.tsx:114`) already parses the cookie and passes `panels`.
  - With the flags, the editor draws:
    - a hidden panel's column at `0px`;
    - the body's classes `nol` and `nor` (the prototype's names);
    - `inert` on `#editor-left` or `#editor-right`;
    - `aria-pressed` on the toggles.
  - Everything comes from the props on the server and in the browser alike, so there is no flash and no hydration
    difference.
- **Narrow screens** (S28-04). The rule `@media (max-width:1100px)` in `EDITOR_CSS` (`editor.tsx:901`) sets the
  columns with `!important`. It needs the prototype's two additions:
  - `.de-body.nol` gets one column;
  - a hidden panel is `display: none`.

  Below 720 px the single column stays. The handles are already hidden up to 1,100 px (`HANDLE_CSS`).
- **A hidden panel's handle** is `display: none`. `PanelHandles` keeps its `aria-valuenow` from its own ref, so
  showing the panel again brings back the width it had.

#### Q3: folds

- **`Fold`** (`src/app/_panels/fields.tsx:803`) is a heading button with `aria-expanded` and a chevron. Its body is
  `hidden`, so its fields stay mounted and keep their drafts (D-66). The remembered state is one localStorage set of
  *shut* titles (`infomapper:sections-shut`, `sectionKey` replaces digits with `#`). D-35 says "remembered per
  title".
- **What it lacks for this slice:**
  1. **Starting shut.** Every fold starts open, and only a title in the set is shut. The PRD wants Header and footer
     and Cover folded at first.
     - Proposal: an optional `startShut`.
     - For such a fold, the remembered set is a second one, `infomapper:sections-open` (titles opened by hand).
     - The first state is shut, so the server and the browser draw the same thing.
     - The other folds behave exactly as now.
  2. **Keys.** The titles "Scope", "Sharing", "Style", "Header and footer" and "Cover" match none of the 35 canvas
     folds today (all titles were checked). But a later canvas section called "Scope" would share the editor's
     remembered state.
     - Proposal: an optional `storeKey` prefix, `doc:`, giving keys such as `doc:Scope`.
     - The title shown is unchanged.
- **Where:**
  - In `editor.tsx`, the Document panel's `H` headings Scope and Sharing become folds.
  - In `style-panel.tsx`, Style and Header and footer become two folds. `StylePanel` gets split, or renders them
    itself.
  - Cover becomes a fold.
  - "Model state" stays a plain heading: it is one line.
- **Look.** `Fold`'s heading is 12 px in `text-im-ink-2` with the chevron, while the editor's `H` is 13 px in ink. The
  folds bring the canvas panel's look (the review's consistency point).
- **Earlier specs.** A fresh browser context has an empty localStorage, so every spec that types into Cover or into the
  header and footer fields first has to open its fold (see "Earlier specs").

#### Q4: texts

See "Every changed and new UI text" below. The short segment labels follow the PRD and add a hint for "Mappings
included", which has none today.

#### Q5: options that can look dead

What each option prints when the data or a filter leaves nothing. This was read in the builders; the ones marked
"verified" were also seen on the demo.

| Section | Option | What a person sees when nothing qualifies | Hint? |
| --- | --- | --- | --- |
| Source-to-target | Columns: **Note** (verified) | An empty column, or no long text under or after any row. The demo's only two notes are on draft mappings; the S2T document shows "Approved and in review". | **Yes** (item 2) |
| Source-to-target | Columns: **Rule** | The same: rules on drafts are hidden by the filter, and an approved mapping may have none | **Yes**, the same hint naming "rule" (`S2T_BELOW` holds both: `builders.ts:243`) |
| Source-to-target | "List attributes that have no mapping" | Nothing, when every attribute in scope has one (`builders.ts:312`) | No: that is the good case |
| Source tables | "The modeller's note" (a table's) | Nothing for a table without a note (`sections-sources.ts:87`) | Proposed: "No table in this document has a note." |
| Source tables | "Its classifications" | An empty runs list for a table without classifications (`sections-sources.ts:84`) | Proposed, same form |
| Data dictionary | "Figure of the concept's frame at its start" | Nothing, when no canvas in the scope has a frame for the concept (`builders.ts:216`) | Proposed: "No canvas in this document's scope has a concept's frame." |
| Style | "List of figures" | No list, when the document has no figure (`document.ts:150`) | Proposed: "This document has no figures yet." |
| Requirements, Traceability, Data quality rules | "Only … that touch the document's scope" | The section's own "none" line | No: it says so already |
| Dimensional model, Bus matrix | Model levels without Dimensional | The section's own empty text (`document-section.ts:143`, `:332`) | No: it says so already |
| Classification register | A classification with nothing tagged | `noneCls`, printed | No |

**Proposal:** the hint for Source-to-target's Note and Rule (item 2) in step 2. The three "Proposed" rows are left to
Łukasz (**Q-B**), at size S each, with the same mechanism: a pure count over the editor's document state, shown under
the option while it is on.

### Findings: where the PRD is wrong, differs or costs more

**F1. "Fit width" lays the pages out again: wrong for the app.**
- The prototype draws the preview again (`drawPreview` 200 ms after `de-panels`).
- The app scales the laid-out pages: `zoomValue = (width - 48) / pageWidth` from a `ResizeObserver` on the middle
  (`preview.tsx:164`, `:359`). A toggle or a resize changes the middle's width, so "Fit width" already follows, with no
  Paged.js layout.
- Proposal: S28-02 checks that the pages' scale follows the middle's width after a toggle and after a drag, and that
  `data-layouts` does **not** grow. A new layout per toggle would cost seconds on a long document. The PRD's "laid out
  again" is read as "scaled again".

**F2. Finding 3's layout still cuts the size.**
- Measured at a 340 px options panel, a figure entry has about 290 px inside. After F6 adds its padding back, two
  selects with their gap get about 143 px each. The texts need:

  | Select | Text | Width needed |
  | --- | --- | --- |
  | View | "As on the canvas" | about 124 px |
  | Size | "Whole, as large as fits" | about 150 px |
  | Orientation | "As the document" | about 125 px |

- So "view and size on one row" cuts the size by about 7 px.
- **Proposal:** view and orientation on one row, size on its own row at full width. "Rows" (Adjusted only) goes beside
  size, or on the next row when the two do not fit.
- The Dimensional model's star size (`figureSize` in `ModuleOptions`, `section-options.tsx`) gets its own row (151 px
  now, 164 px needed), as the PRD says.

**F3. The Note hint's second text is wrong under "Approved only".**
- "{n} notes are on draft mappings, which Mappings included leaves out." holds for "Approved and in review".
- Under "Approved only" the filter also hides notes on mappings in review (`statusShown`, `blocks.ts:79`).
- It has no singular.
- **Proposal:**
  - "1 note is on a mapping that Mappings included leaves out."
  - "{n} notes are on mappings that Mappings included leaves out."
  - The same form for rules (Q5's table).
- The count needs the same set of mappings the section shows: the mappings into the scope's entities. Proposal: a pure
  function beside `buildS2T` in `builders.ts` returns `{ shown, hidden }` for a column, from the document state, the
  scope and the filter, unit tested. The editor calls it only while the S2T panel is open with the column ticked.
  Cost: S to M.

**F4. A double-click's focus and finding 11 pull against each other.**
- D-81 says "A double-click on a section goes to its heading", and the app focuses Heading (`editor.tsx`, `open`,
  `headingRef`; S26-03:80).
- The prototype focuses the first field of the type's own options (`#de-props`) and only falls back to Heading
  (`goTo`, prototype line 10284).
- With Heading moved to the end (finding 11), the app's double-click would scroll the panel to its end, away from the
  options finding 11 brings forward.
- Proposal: follow the prototype (the first option field that takes text or a choice, else Heading), as an amendment of
  D-81 in D-83. **Q-C.**

**F5. A sixth segment group wraps.**
- Measured at 340 px, these segment groups wrap:

  | Segment group | Lines |
  | --- | --- |
  | Mappings included | 2 |
  | Long texts (Source-to-target, Source tables, register, Data quality rules) | 2 |
  | The dictionary's Layout | 3 |
  | **Model overview's "Where the figures go"** ("Below the section's content", "Right after the description") | 2 |

- Every other group fits: Grouping, Notation, the Requirements' and Traceability's Layout, the style's segments,
  Sharing, the star's rows.
- The PRD lists only the first three. Proposal: "Below the content" and "After the description", the full sentences
  in the hint (texts below).

**F6. Finding 10's cause.**
- The entry's class string ends in `p-2${f.on ? "" : " opacity-70"}` (`figure-editor.tsx:134`). Tailwind's scanner
  reads `p-2${f.on` as one token and never generates `.p-2`, so the entry's padding is 0 (computed on the demo: the
  only rule that applies is the preflight's `padding: 0`).
- It is the repository's only class glued to a placeholder.
- The fix is a space or a separate string, which gives the whole entry its padding, not only the summary line. Size S.

**F7. S28-08's element guard measures nothing this slice changes.**
- The element guard (`S3B-15-elements`, `S27-09-elements`) counts the canvas's elements.
- This slice changes neither the canvas nor its panels' DOM: `Fold`'s additions change nothing for an existing fold.
- "When to measure" asks for a measuring sitting only when the canvas's drawing changes.
- Proposal: no element guard. **Q-D.**

**F8. Smaller points.**
- **The double-click in the list as well.** The PRD says "a double-click on a section in the preview". The prototype,
  D-81 and the app's `open` handle a double-click in the sections list and in the preview alike. Proposal: both open a
  hidden options panel, as the prototype does.
- **The right toggle's place.** The app's top bar has no "Generate version" (that is later, slice D), so the right
  toggle goes after "Print / PDF".
- **Other actions leading to the options panel.** "+ Add section" selects the new section without opening a hidden
  panel, as the prototype does: only the double-click calls `PANELS.show`.
- **The toggle's name.** The prototype's `aria-label` is "Sections panel" or "Options panel", with the long title. The
  canvas uses the title as both. Proposal: the canvas's way (consistency), so the accessible names are "Show or hide
  the sections panel" and "Show or hide the options panel".
- **The light path's steps.** CLAUDE.md's light path has two steps. The PRD lists three: step 1, build, close.
  Proposal: the PRD's three. The closing is docs and the full run, which keeps the build's report apart from the
  decision text.
- **Accessible names without a new dependency.** The repository has no axe (`package.json`). S28-06 lists every
  `input`, `select`, `textarea` and `[role=group]` in the two panels and checks each with Playwright's
  `toHaveAccessibleName`. **The cause:** three copies of `Field` (`editor.tsx:869`, `style-panel.tsx`,
  `section-options.tsx`) draw the label as a `<div>`. Proposal: one `Field` (in `editor.tsx`, exported) with `useId`:
  - a `<label htmlFor>` for one control;
  - `aria-labelledby` on a segment group or a check list;
  - `aria-describedby` for the hint.

  The figure editor's caption and selects get `aria-label`s ("Caption", "View", "Size", "Orientation", "Rows").
  Check boxes are already named by their wrapping `<label>`.
- **D-82's numbers** (200–480, 280–560, 250, 330) change. D-83 amends them, as the PRD's section 8 says.

### Differences between the prototype and the app that the slice touches

Items 3 and 4 of the PRD's section 1 are deliberate differences and are not listed here.

| Prototype | App after step 2 (proposed) | Why |
| --- | --- | --- |
| Widths and flags in localStorage (`infodoc.panels`) | A cookie per person the server reads (Q2) | Slice 27; the first paint |
| A hidden panel is `visibility: hidden` inside a 0 column | A 0 column, `inert`, its handle `display: none` | The same for a person, as the canvas does it |
| The right toggle after "Generate version" | After "Print / PDF" | No "Generate version" yet |
| "Fit width" draws the preview again 200 ms after a change | The pages are scaled by a `ResizeObserver`, no new layout | F1 |
| A double-click focuses the first option field | Heading (D-81) unless Q-C changes it | F4 |
| The toggle's `aria-label` is "Sections panel" or "Options panel" | The title as the name, as the canvas's | F8 |
| Labels are `<label>` elements not tied to their inputs | Tied (finding 1) | Deliberate difference (item 3) |

### Every changed and new UI text

In English, the app's language. The old wording is first.

| Where | Old | New |
| --- | --- | --- |
| Top bar, left toggle (new) | – | title and name "Show or hide the sections panel" |
| Top bar, right toggle (new) | – | title and name "Show or hide the options panel" |
| Mappings included, options | "All, drafts marked" · "Approved and in review" · "Approved only" | "All" · "Not drafts" · "Approved" |
| Mappings included, hint (new) | – | all: "All mappings; drafts are marked." · notdraft: "Approved and in review; drafts are left out." · approved: "Approved mappings only." |
| Long texts, options (5 sections) | "Under each row" · "After the table, numbered" · "As a column" | "Under row" · "Numbered" · "Column" |
| Long texts, hints | row: "The row keeps the short properties; each long text gets the full width underneath." · after: "The row carries a number; the texts follow the table as numbered notes." · column: "In their own column. Long texts make rows tall." | row: "Under each row: the row keeps the short properties; each long text gets the full width underneath." · after: "After the table, numbered: the row carries a number; the texts follow the table as numbered notes." · column: "As a column: long texts make rows tall." |
| Long texts, label | "Long texts (definitions, descriptions, rules, notes)" | Source-to-target "Long texts (rule, note)" · Source tables "Long texts (column notes)" · Classification register "Long texts (notes)" · Requirements (as a table) "Long texts (description, scope)" · Data quality rules "Long texts (rule, description)" (each from its `long` columns: `builders.ts:243`, `sections-sources.ts:78`, `:158`, `:179`, `sections-requirements.ts:63`, `:217`) |
| Data dictionary, Layout options | "Definition under each row" · "Definition as a column" · "One block per attribute" | "Under row" · "Column" · "Blocks" |
| Data dictionary, Layout hints | below: "The row keeps the short properties; …" · column: "Every column has a fixed width; …" · cards: "Each attribute is a small block: …" | The same, each beginning with the full name: "Definition under each row: …", "Definition as a column: …", "One block per attribute: …" |
| Model overview, "Where the figures go" (F5) | "Below the section's content" · "Right after the description" | "Below the content" · "After the description"; hints (new): "Below the section's content." · "Right after the description, before the counts and concepts." |
| Source tables, group label (new) | – | "For each table" above "Its classifications" and "The modeller's note" (unchanged) |
| Header, right, placeholder | "empty" | "Nothing by default" |
| Source-to-target, Columns, hint while Note is on (new) | – | "No mapping in this document has a note." · "1 note is on a mapping that Mappings included leaves out." · "{n} notes are on mappings that Mappings included leaves out." (F3) |
| The same for Rule (new, Q5) | – | "No mapping in this document has a rule." · "1 rule is on a mapping that …" · "{n} rules are on mappings that …" |
| Figure entry, names (new; finding 1) | – | `aria-label`s "View", "Size", "Orientation", "Rows", "Caption" |
| Document panel, fold titles | Headings "Scope", "Sharing", "Style", "Header and footer", "Cover" | The same words, as folds |
| Q-B's hints, if chosen | – | "No table in this document has a note." · "No table in this document has a classification." · "No canvas in this document's scope has a concept's frame." · "This document has no figures yet." |

No document text changes: the PRD's "Not in this slice" excludes any change to what a document prints.

### Earlier specs and fixtures each step touches

| Spec | Why | Step |
| --- | --- | --- |
| `e2e/slice-27/S27-08.spec.ts` | Limits 200–480 / 280–560 and defaults 250 / 330 become the canvas's. Its cookie-format check moves to S28-01. | 2 |
| `e2e/slice-25/S25-05.spec.ts` | Clicks "Approved only" by name, which becomes "Approved" | 2 |
| `e2e/slice-26/S26-07.spec.ts` | Clicks the dictionary's Layout by its three old names | 2 |
| `e2e/slice-26/S26-03.spec.ts` | Line 80, the double-click focuses Heading (only if Q-C changes it); it types into Cover's or the header's fields (folded at first) | 2 |
| `e2e/slice-25/S25-02.spec.ts`, `S25-03.spec.ts`, `e2e/slice-26/S26-08.spec.ts`, `S26-screens.spec.ts` | They type into Cover's or the header and footer's fields, which are folded at first. They open the fold first (a helper `openFold`). | 2 |
| `tests/document-figure-html.test.ts` (lines 85–88) | The doc cookie's format, clamping (`100.900` → `200.560`) and defaults change: the new format, slice 27's value read with both panels shown, the canvas's limits. `src/ui/side-panels-cookie.test.ts` is unchanged. | 2 |
| `e2e/slice-05a/*`, `slice-06a/*` | **Not touched** under Q1 (b). They are touched only if Łukasz chooses (a). | – |

Every spec in `e2e/slice-25`, `slice-26` and `slice-27` runs after step 2, because they all open the editor. Slice 28's
folder joins part 8 (`e2e/parts.ts`, the recut rule).

### The plan for steps 2 and 3

**Step 2: build.**
1. **The side panels** (item 1, Q1 (b), Q2):
   - `panel-handles.tsx`: the hook, the toggles, and the handles hidden with their panel.
   - `panels-cookie.ts`: the name and the reading of slice 27's value.
   - `editor.tsx`: the body's classes, `inert`, `0px`, and the narrow CSS.
   - `open` shows the options panel.
   - Specs S28-01 to S28-04 and S27-08.
2. **The right panel** (item 3):
   - one `Field` with its names;
   - the folds (`Fold` with `startShut` and `storeKey`);
   - Sharing after Cover;
   - Heading and "Start on a new page" at the end;
   - the short labels and hints;
   - the long-text labels per section;
   - "For each table";
   - the figure selects (F2) and the entry's padding (F6);
   - "Nothing by default".
   - Specs S28-06 and S28-07, and the earlier specs above.
3. **The hint** (item 2, F3, Q5):
   - the pure count in `builders.ts` with its unit tests;
   - the hint under Columns;
   - S28-05 on the demo, with all three texts.
4. **Checks:** lint, typecheck, unit tests; the slice's specs and slices 25 to 27's specs; CI on the draft PR opened at
   step 2. **No full run in step 2** (no shared infrastructure: Q1 (b)).

**Step 3: the closing.**
- D-83 quoted in full for approval, amending D-81 (the double-click, if Q-C) and D-82 (the limits).
- `docs/inventory-prototype-vs-app.md`: item 3's deliberate differences and the table above.
- `docs/ideas.md`: the line at 994–995 removed, with the live drag against the guide line noted (item 4).
- `known-limitations.md` if needed; README and CLAUDE.md (AD-33's list: no new extension point; the editor's panels
  under InfoDocumenter's notes).
- One full run on the final commit, then the manual acceptance: the demo first, then KB with Łukasz, read only.

### Questions for Łukasz before step 2

- **Q-A.** The editor's hidden flags are its own, apart from the canvas's (`im-doc-panels` against `im-panels`).
  Proposed: separate, since the two pages' panels hold different things. Or should hiding the details panel on the
  canvas also hide the options panel in the editor?
- **Q-B.** Hints for the three other options that can look dead: Source tables' note and classifications, the
  dictionary's concept frames, the style's "List of figures". Proposed: Source-to-target's Note and Rule only in this
  slice, the others to `docs/ideas.md`.
- **Q-C.** A double-click focuses the first option field, as the prototype does (amending D-81), or Heading, which is
  now at the end of the panel? Proposed: the prototype.
- **Q-D.** S28-08 without the element guard (F7)?
- **Q-E.** Q1 (b), the editor's own state with the canvas's constants and cookie format, and no full run in step 2?
- **Q-F.** The short labels and hints in the table above, F2's figure rows ("view and orientation, then size") and F5's
  sixth group?
