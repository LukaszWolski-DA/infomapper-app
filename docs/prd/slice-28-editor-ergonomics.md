# Slice 28 – InfoDocumenter: the editor's ergonomics

Status: **proposed** (Łukasz, 16 November 2026). **Light path** unless step 1 finds otherwise (CLAUDE.md, "The slice
cycle", 2): the editor's own code, no table, no change of the local file's format; a full run only at the closing,
unless step 1 chooses to share the canvas's side-panel state (item 1). Branch `slice/28-editor-ergonomics`, from `main`
(`e658184` or later). PRD file: `docs/prd/slice-28-editor-ergonomics.md`; step 1 writes
`docs/prd/slice-28-acceptance.md`. Test regime: CLAUDE.md, "Testing".

Written from Łukasz's tests on KB (Kanton Basel), the read-only review of 16 November 2026 (no file in the repository;
its findings are quoted below) and the prototype changed for this slice, which Łukasz accepted on 16 November 2026,
**without reading the code**. **The prototype is the source of truth for behaviour; where this PRD and the prototype
differ, ask.** Items 3 and 4 are deliberate differences from the prototype (round E4): the prototype is not changed for
them, and the closing lists them in `docs/inventory-prototype-vs-app.md`.

## 1. Why

Łukasz's first tests of InfoDocumenter on his own model: long names need room, and the editor's side panels cannot be
hidden as the canvas's can; the Note column of Source-to-target looks dead; the right panel takes long scrolling and
cuts off its choices. The review measured it: the Document panel is three screen heights, 21 inputs and 7 segment
groups have no accessible name, three figure selects show "As on the ca", "Whole, as la", "As the docu".

Decisions taken with Łukasz (round E, 16 November 2026):
- **1 (E1).** **The editor's side panels are hidden and shown as the canvas's (D-54):** a toggle at each end of the
  editor's top bar (the canvas's icons, `aria-pressed`); a hidden panel is 0 wide and inert, without its handle;
  selecting never opens a hidden options panel, an action that leads to it on purpose does (a double-click on a section,
  D-81); "Fit width" follows. **Limits and defaults are the canvas's:** sections 200–520 px (264), options 280–640 px
  (340). The hidden flags are kept with the widths in the editor's cookie, which still reads slice 27's widths-only
  value. Up to 1,100 px wide the editor keeps its stacked layout (no overlay as the canvas's), and a hidden panel is
  not shown there either. **The code:** step 1 says whether the canvas's side-panel state can be shared (one rule in
  one place; shared infrastructure and a full run) or the editor keeps its own with the limits from one constant.
- **2 (E2).** **A hint where an option shows nothing because of the data or a filter:** under Source-to-target's
  Columns while Note is ticked: "No mapping in this document has a note." or "{n} notes are on draft mappings, which
  Mappings included leaves out."; step 1 lists the other options that can look dead the same way.
- **3 (E3).** **The review's findings 1 to 12**, as section 2 lists them.
- **4 (E5).** **`docs/ideas.md`:** the line "The canvas page's resizable side panels (slice 27, C6: …)" is wrong; the
  canvas has had resizable panels since slice 5a (D-54). The closing removes it, and notes the one real difference left:
  the editor resizes live, the canvas moves a guide line and applies on release.

## 2. What to build

### Side panels (item 1)

As the prototype's editor: the two toggles (left: before "← Documentation", "Show or hide the sections panel"; right:
at the bar's end, "Show or hide the options panel"), the hidden panel 0 wide and inert, its handle gone, `aria-pressed`
on the toggles, the widths and the hidden flags kept for the person, a double-click on a section in the preview opening
a hidden options panel, the preview's "Fit width" laid out again after a resize or a toggle.

### The right panel (item 3)

| # | Finding | Change |
| --- | --- | --- |
| 1 | Controls without an accessible name | Every field, select and segment group in the editor's panels named (`<label htmlFor>` or `aria-labelledby`) |
| 2 | Note looks dead | Item 2's hint |
| 3 | Figure selects cut off | View and size on one row, orientation on the next; the star's size as wide as its row |
| 4 | Three-option segments wrap | Short labels, the full sentence in the hint under them: Mappings included "All", "Not drafts", "Approved"; Long texts "Under row", "Numbered", "Column"; the dictionary's Layout likewise (step 1 proposes the words) |
| 5 | The Document panel is three screens | Scope, Sharing, Style, Header and footer and Cover as folds, as the canvas's details panel folds its sections (remembered per title, D-35); Header and footer and Cover folded at first |
| 6 | One "Long texts (definitions, descriptions, rules, notes)" label | A label per section naming its own long texts ("Long texts (rule, note)" in Source-to-target, "Long texts (notes)" in Source tables, …) |
| 7 | "Its classifications", "The modeller's note" with nothing to refer to | A group label "For each table" in Source tables |
| 8 | Two vocabularies for long texts | One set of words across the sections; the dictionary keeps its blocks |
| 9 | "empty" in the header and footer fields | A grey hint, never a value that looks stored |
| 10 | The figure entry's summary line on the box's edge | Its padding |
| 11 | Heading and "Start on a new page" first in every section's panel | Moved to the end of the section's panel |
| 12 | Sharing between Scope and Style | Moved to the end of the Document panel, after Cover; the top bar's Shared or Private badge stays a badge |

Every changed text is listed in step 1, with its old and new wording, in English (the app's language).

### Not in this slice

The canvas page's side panels (unchanged), the narrow screens' overlay, keyboard shortcuts for the toggles (neither the
canvas nor the editor has them), any change to what a document prints.

## 3. Data model

None. The editor's cookie gets the hidden flags (step 1: its format, read back from slice 27's).

## 4. Sources

- **Prototype:** `docs/prototype/infomapper-prototype-with-sources.html`, replaced by the version Łukasz accepted
  (957,615 bytes, SHA-256 `f3abaa2f14921e07476852b90b575f8fdf5fdd38e7b78876cf7ad98009fd6118`), built on slice 27's
  (955,142 bytes, `b0ba221e…`). Its one change: the editor's panels hidden and shown (`PANELS.toggle`, `show`,
  `hidden`, `cls`; the toggles `data-de="togl"` and `"togr"`; the classes `nol`, `nor`), the canvas's limits and
  defaults, "Fit width" following (`de-panels`). The prototype keeps its widths and flags in localStorage; the app keeps
  them in its cookie (slice 27).
- **The review of 16 November 2026** (read only, on the demo): findings 1 to 12 and the side panels' comparison, as
  section 1 and 2 quote them.
- **Decisions:** D-35, D-54, D-80 to D-82.
- **Slices 25 to 27:** their PRDs and acceptance docs.

## 5. Steps

Stop after each step; wait for Łukasz.

1. **Reconnaissance and check.** Answer Q1–Q5 in `slice-28-acceptance.md`; every place where the PRD is wrong, differs
   from the code, a decision or the prototype, or costs more than it assumes, with a proposal; every changed and new UI
   text with its old wording; the earlier specs each step touches; the plan for steps 2 and 3. Copy the prototype and
   the PRD. No application code.
2. **Build:** the side panels, then the right panel's items 1 to 12, with their specs.
3. **Close.** The docs and the decision quoted for approval (section 8); one full run on the final commit. Stop with
   the manual acceptance steps. Merge and tag `slice-28` only on Łukasz's command.

## 6. Acceptance criteria

Tests in `e2e/slice-28/`, one file per criterion, fresh seed each.

| ID | Criterion |
| --- | --- |
| S28-01 | **Hide and show.** Each toggle hides and shows its panel; a hidden panel is 0 wide, inert, without its handle; `aria-pressed` follows; kept after a reload; a cookie from slice 27 (widths only) still opens with its widths. |
| S28-02 | **Selection and Fit width.** Selecting a section keeps a hidden options panel hidden; a double-click on a section in the preview opens it; "Fit width" lays the pages out again after a toggle and a resize. |
| S28-03 | **Limits.** Drag and keys within 200–520 and 280–640 px; a double-click or Home gives 264 and 340 px. |
| S28-04 | **Narrow screens.** Up to 1,100 px the stacked layout, a hidden panel not shown, no handles. |
| S28-05 | **Note's hint.** The two texts on the demo, and no hint when a shown mapping has a note. |
| S28-06 | **Accessible names.** Every input, select and segment group of the editor's panels has a name (an axe check or a list from the accessibility tree). |
| S28-07 | **The right panel.** Figure selects show their whole choice; segments on one line at 340 px; the Document panel's folds, Header and footer and Cover folded at first and remembered; Heading and page at the end of a section's panel; Sharing after Cover. |
| S28-08 | CI, the full run before the merge (and one in step 2 if step 1 shares the canvas's panel state); the element guard; every earlier test changed, with its reason. |

**Manual acceptance:** on the demo, then on KB with Łukasz (KB read only: he writes to it only in the app).

## 7. Questions for step 1

- **Q1. Sharing the side panels' state.** What of `SidePanelsProvider`, `side-panels.tsx` and the cookie `im-panels`
  can the editor use without the canvas (the review found it reads `CanvasUiCtx` for `shiftView`); the cost of factoring
  it out against the editor keeping its own state with the limits from one constant. Propose one.
- **Q2. The cookie.** Its new format (hidden flags and widths), reading slice 27's widths-only value, the server's first
  paint with a panel hidden.
- **Q3. Folds.** Reuse of the canvas details panel's `Fold` (`fields.tsx`) and its remembered state (D-35) in the
  editor; their keys.
- **Q4. Texts.** Every changed and new text, old and new; the short segment labels (finding 4) and the long-text labels
  per section (findings 6 and 8).
- **Q5. Dead-looking options.** Which other options can show nothing because of the data or a filter (e.g. a
  requirement column with no linked requirement, the bus matrix with no fact in scope); propose which get a hint.

## 8. Decisions (proposals) and docs

- **D-83 (proposal), InfoDocumenter: the editor's ergonomics (slice 28).** Written at the closing from what the slice
  built: the side panels hidden and shown as the canvas's, the canvas's limits and defaults (amending D-82's 200–480,
  280–560, 250, 330), the hints for options that show nothing, the right panel's order, folds and labels.
- Docs: `decisions.md`, `inventory-prototype-vs-app.md` (the deliberate differences of item 3), `ideas.md` (item 4),
  `known-limitations.md` if anything is left, README and CLAUDE.md.

## 9. Left for later

The canvas page's resizable side panels need nothing (they exist since slice 5a). The narrow screens' overlay for the
editor, keyboard shortcuts for the toggles. The rest of `docs/ideas.md`, InfoDocumenter, "Later".
