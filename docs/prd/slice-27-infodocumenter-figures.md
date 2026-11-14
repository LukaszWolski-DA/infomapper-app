# Slice 27 – InfoDocumenter: figures drawn from the model

Status: **proposed** (Łukasz, 14 November 2026). **Full path** (CLAUDE.md, "The slice cycle", 2): a new kind in the
content tree, figures drawn from the canvas's geometry, a change on the canvas page (the page outline), new options in
the recipe. Branch `slice/27-infodocumenter-figures`, from `main` (`d6f4f89` or later). PRD file:
`docs/prd/slice-27-infodocumenter-figures.md`; step 1 writes `docs/prd/slice-27-acceptance.md`. Test regime:
CLAUDE.md, "Testing".

Written from the docs after slice 26 (D-81) and the prototype changed for this slice, which Łukasz accepted on
14 November 2026, **without reading the code**. **The prototype is the source of truth for behaviour; where this PRD and
the prototype differ, ask.** The plan beyond this slice is in `docs/ideas.md` (InfoDocumenter, "Later").

## 1. Why

A data model is read through its diagrams. Slices 25 and 26 print every table a team needs, but the business signs
off a model it has seen drawn, and an ETL developer finds a mapping faster on the canvas than in a list. Today people
paste screenshots into documents, and the screenshots are out of date the day after. The prototype draws figures from
the model's own data: a canvas or a frame, drawn again each time the document is laid out, never a screenshot.

Decisions taken with Łukasz (round C, 14 November 2026):
- **1 (C1 b).** The whole of the prototype's figures: the **Diagrams** section, the **Figure** section, figures in
  **Model overview**, the **star diagram** in the **Dimensional model**, the **list of figures**, the style's **smallest
  attribute names**, the **page outline on the canvas**, and **resizable side panels** in the editor (item 6).
- **2 (C2).** A figure is an **SVG drawn by a pure function from the canvas's geometry**, the same way as the canvas's
  thumbnails (AD-32: `buildCards`, `geometry.ts`), as a new kind in the content tree. It is built in the browser in the
  editor and on the document page, and placed on the page as an image (`<img>` with the SVG), since Paged.js splits an
  SVG placed inline. **Risk for step 1 (assumption):** an SVG shown through `<img>` cannot use the page's fonts, so its
  text would fall back to another font; step 1 measures the ways out (a subset of IBM Plex embedded in the SVG, text
  turned into paths) on size and layout time.
- **3 (C3).** Sizes and orientation **as the prototype**: "Whole, as large as fits", "Whole, upright", "Page width, in
  parts"; "As the document", "Portrait", "Landscape, turned" (the figure turned 90° on a portrait page, since Paged.js
  has no mixed page sizes). A canvas is never cut, unless "in parts" is chosen.
- **4 (C4).** **No working layer** on figures: no notes, labels' marks, selection or highlights. A live label canvas of
  the live model draws as it shows.
- **5 (C5).** **The page outline on the canvas**, as the prototype's "Page outline for documentation" in "Canvas look"
  (Off, A4, A3; Portrait, Landscape; 6, 7, 8 pt), is in this slice, as its last step: it changes the canvas page (shared
  infrastructure, a full run).
- **6 (C6, Łukasz's request).** **The editor's two side panels are resizable**: a handle between each side panel and
  the preview; drag it, or the arrow keys (16 px, with Shift 64 px), within bounds (sections 200–480 px, options
  280–560 px); a double-click (or Home) gives the default width back (250 and 330 px); the widths are kept in this
  browser (localStorage), never stored on the server. Below 1,100 px wide, where the layout stacks, there are no
  handles. **The canvas page's side panels are not in this slice** (a separate entry in `docs/ideas.md`).

## 2. What to build

### A figure

As the prototype's figure editor (`figEditor`), one figure is:
- **what:** a canvas, or one frame of a canvas (chosen from "Canvas or frame to add"), and its **caption**;
- **in the document** (on or off) and its place among the section's figures (move up, move down, remove);
- **view:** "As on the canvas" (the canvas's own layout, names, look, hidden kinds) or "Adjusted", which opens:
  - **rows:** "Rows as on canvas", "Keys only", "All rows", "Headers only";
  - **lines:** "Relationships", "Mappings", "Source FKs", "Dimensional" (the last while InfoCube is on);
  - **status marks** on or off;
- **size:** "Whole, as large as fits", "Whole, upright", "Page width, in parts";
- **orientation:** "As the document", "Portrait", "Landscape, turned".

A figure is numbered ("Figure n") and listed in the **list of figures** when the style's switch is on. Text on a
figure is never smaller than the style's **smallest attribute names** (6, 7 or 8 pt): a figure that would need smaller
text is drawn larger, in parts if its size allows it, or says why it cannot (the prototype's rule and text). Model
objects outside the document's scope are drawn as on the canvas, muted (the prototype's "out of scope" look), or
step 1 proposes otherwise.

### Sections

- **Diagrams:** a list of figures (the prototype's "Figures of whole canvases or single frames, each with its own view,
  size and caption").
- **Figure:** one or more figures placed wherever the section stands.
- **Model overview:** its figures (the prototype's `figs`).
- **Dimensional model:** "Star diagram, drawn from the model (no canvas needed)" per fact, with the prototype's limit
  of dimensions shown ("{a} of {b} dimensions shown; all are in the table below"), and its figures.
- The presets get the prototype's figure sections that slice 26 left out (step 1 lists them).

### Style

The switch **list of figures** and **smallest attribute names in figures**, as the prototype's Style panel.

### The editor

- The side panels' handles (item 6). The preview's "Fit width" follows the middle panel's width when a panel is
  resized.
- The figure editor in a section's options; the figure's preview outlined when its figure is selected.

### The canvas page

"Page outline for documentation" in "Canvas look", as the prototype (`pageArea`, `pageCtl`): the outline of the pages a
whole canvas would take at the chosen paper, orientation and smallest names, with its hint. It is a canvas setting
(stored as the canvas's look, or step 1 proposes otherwise), drawn behind the cards, never printed on a figure.

### Not in this slice

Documents from a baseline and "changes since a baseline" (after the baselines slice), versions, links, logos (slice
D), Markdown export (slice E), figures' step 2 (a requirement's path from source to dimensional model, a canvas with a
requirement's lens, cross-references), the canvas page's resizable side panels.

## 3. Data model

- The section entries of `document_definition.sections` get their figures (the prototype's figure fields), and
  `style` gets `lof` and `minPt`. Recipes stored before this slice read with the defaults through the module's row
  upgrade (as slice 26).
- The page outline: on the canvas (its look, or a column; Q6). Whether the local file's format changes is Q6.
- No new table expected.

## 4. Sources

- **Prototype:** `docs/prototype/infomapper-prototype-with-sources.html`, replaced by the version Łukasz accepted
  (955,142 bytes, SHA-256 `b0ba221e128c50aaac64eb77f8d8165c5e5a78ad1110e2782527a4aa41660adb`), built on slice 26's
  (951,539 bytes, `7a06cb13…`). Its one change: the editor's resizable side panels (`PANELS`, the handles `.de-rz`, the
  widths as `--dl` and `--dr`). Everything about figures and the page outline was already in the prototype.
  - **What the prototype shows beyond this slice** (versions, links, logos, baselines as a source, "Generate version",
    "act as") is later, not a difference to report.
  - Prototype storage is not the app's model.
- **Decisions:** D-80, D-81 and the notes to AD-05, AD-18, AD-33, AD-35; AD-16, AD-18, AD-32 (thumbnails), D-75.
- **Slices 25 and 26:** their PRDs and acceptance docs; `docs/known-limitations.md`, "InfoDocumenter" (Paged.js's
  internals, the layout figures).

## 5. Steps

Stop after each step; wait for Łukasz.

1. **Reconnaissance, check and measurement.** Answer Q1–Q9 in `slice-27-acceptance.md`; every place where the PRD is
   wrong, differs from the code, a decision or the prototype, or costs more than it assumes, with a proposal; every new
   UI text; the earlier specs and fixtures each step touches; the plan for steps 2 to 5. **Measure** (Q2, Q3). Copy the
   prototype and the PRD. No application code.
2. **A figure:** the content tree's figure kind, the pure SVG builder from the canvas's geometry with the figure's
   options, the fonts as step 1 decides, its rendering in the pages and the quick sheet, the Figure section, the
   resizable side panels.
3. **Sections and the star:** Diagrams, the figures in Model overview, the star diagram in the Dimensional model
   (through the document sections extension point), numbering, the list of figures, the smallest names, the presets.
4. **The page outline on the canvas.**
5. **Close.** The docs and the decisions quoted for approval (section 8); one full run on the final commit. Stop with
   the manual acceptance steps. Merge and tag `slice-27` only on Łukasz's command.

## 6. Acceptance criteria

Tests in `e2e/slice-27/`, one file per criterion, fresh seed each.

| ID | Criterion |
| --- | --- |
| S27-01 | **A figure.** A canvas and a frame drawn in the pages and the quick sheet, never a screenshot; its caption and number; a change on the canvas (a card moved, an attribute renamed) shows in the figure after the editor's reload and at once on the document page. |
| S27-02 | **Options.** As on the canvas against Adjusted; the four row choices; the line kinds; status marks; the three sizes and three orientations, with page size checked under print media emulation; "in parts" cuts, the others never do. |
| S27-03 | **Working layer and scope.** No notes, label marks or selection on a figure; objects out of the document's scope drawn as step 1 decides. |
| S27-04 | **Sections.** Diagrams, Figure, Model overview's figures; Figure placed between two other sections. |
| S27-05 | **Star diagram.** One per fact while InfoCube is on and the dimensional level is in scope; the limit of dimensions shown and its note; none while InfoCube is off. |
| S27-06 | **Numbering, list of figures, smallest names.** Figures numbered in order; the list of figures with page numbers that match; text never under the chosen size. |
| S27-07 | **Fonts.** The text on a figure is in IBM Plex, in the pages and in a printed PDF (as step 1 decides how). |
| S27-08 | **Side panels.** Drag and keys within bounds, double-click to the default, kept after a reload, no handles below 1,100 px; "Fit width" follows. |
| S27-09 | **Page outline.** On the canvas in "Canvas look": paper, orientation, smallest names; the outline follows the cards; it never shows on a figure or a thumbnail. |
| S27-10 | **Content tree and figures.** Unit tests for the SVG builder (rows, lines, sizes, parts, the smallest names) on the demo; no store read; reference figures on "Performance test" (Q3). |
| S27-11 | CI, the full run before the merge (and in step 4, the canvas page); the element guard (the canvas page with the outline off must not change); every earlier test changed, with its reason. |

**Manual acceptance:** on the demo, then on KB (Kanton Basel) with Łukasz: a dictionary preset with Diagrams, figures of
a whole canvas and a frame in each size, a star diagram, the list of figures, a PDF; the page outline on a KB canvas.
KB only reads; nothing is written to it except what Łukasz does in the app.

## 7. Questions for step 1

- **Q1. The SVG builder.** Where it lives (InfoMapper's canvas or domain layer, as the thumbnails), what of
  `buildCards`, `cardHeight`, `relGeom`, the frames, the lines' routes and the canvas look it reuses, and what the
  thumbnail route (AD-32) draws that a figure must draw more of (text, keys, marks). No copy of a canvas rule.
- **Q2. Fonts in an `<img>` SVG.** Confirm or correct the assumption; measure the ways out (a subset of IBM Plex
  embedded as a data URI per figure or once per document, text as paths, SVG inline in a single-page wrapper Paged.js
  does not split): bytes per figure, layout time, how it prints, how it reads in a PDF (text searchable or not).
  Propose one.
- **Q3. Measurement.** On "Performance test" and the demo, in headless Chromium: the SVG's build time and size for the
  largest canvas, and the first layout's time of the prototype's longest preset with Diagrams. Reference figures; does
  it change the Auto threshold's behaviour (slice 26)?
- **Q4. Sizes, parts, orientation.** How "in parts" cuts (overlap, labels of the parts), how "Landscape, turned"
  rotates in Paged.js, how the smallest names drive the size; the prototype's rules.
- **Q5. The star diagram.** Drawn from InfoCube's index through the document sections extension point; its layout
  rule from the prototype (`starFigure`); InfoDocumenter never names InfoCube.
- **Q6. The page outline.** Where it is stored (the canvas's look, a column), whether the local file's format changes,
  the canvas layer it touches (shared infrastructure), the element guard with the outline off and on.
- **Q7. The side panels.** The editor's layout (slice 26) against the prototype's handles; "Fit width" on resize;
  keyboard and screen reader (role separator, its label, its value).
- **Q8. Scope on figures.** What the prototype draws for objects out of the document's scope; a proposal.
- **Q9. Earlier specs and fixtures:** the demo's documents with figures (as the prototype's presets), slices 25 and 26
  specs, the thumbnails' specs, the canvas page's specs for the outline.

## 8. Decisions (proposals) and docs

- **D-82 (proposal), InfoDocumenter: figures (slice 27).** Written at the closing from what the slice built: figures
  drawn from the canvas's geometry as images, never screenshots; their options, sizes and orientations; the sections
  and the star diagram; numbering and the list of figures; the smallest names; no working layer; how fonts are drawn;
  the page outline on the canvas; the editor's resizable side panels.
- AD-32 (a note) if the figures share the thumbnails' builder.
- Docs: `decisions.md`, `data-model-v2.md`, `ideas.md` (InfoDocumenter: done items; "the canvas page's resizable side
  panels" under "Later, noted"), `inventory-prototype-vs-app.md`, `known-limitations.md`, README and CLAUDE.md.

## 9. Left for later

As `docs/ideas.md` says: baselines and documents from a baseline with "changes since a baseline", slice D (versions,
links, guests' restriction, logos, where PDFs are made), slice E (Markdown export), figures' step 2, the canvas page's
resizable side panels, light markup in Text, the model checks' texts in Polish and German, the German words' review.
