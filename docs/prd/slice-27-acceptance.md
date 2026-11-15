# Slice 27 – acceptance

PRD: [`slice-27-infodocumenter-figures.md`](slice-27-infodocumenter-figures.md). Branch `slice/27-infodocumenter-figures`.

## Step 1: the PRD checked against the code, and the measurement (14 November 2026)

### The starting point

- **The branch.** `slice/27-infodocumenter-figures` was cut from `main` at `d6f4f89` (the merge of PR 62,
  chore/heap-findings), the newest commit on `origin/main` when step 1 started.
- **The two files from Łukasz's Downloads.** Downloads holds one copy of each (no `(1)` copy). Each was checked with
  `cmp` after the copy and with `sha256sum` against the prompt's value:

  | File | Bytes | SHA-256 | `cmp` |
  | --- | --- | --- | --- |
  | `docs/prd/slice-27-infodocumenter-figures.md` (new) | 14,852 | `dbb12c02383f48421a4d263fcb7fdfa82b9cc66edc9a5635d1ef91f6df7187fe` | equal |
  | `docs/prototype/infomapper-prototype-with-sources.html` (replaces slice 26's `7a06cb13…`, 951,539 bytes) | 955,142 | `b0ba221e128c50aaac64eb77f8d8165c5e5a78ad1110e2782527a4aa41660adb` | equal |

- **The prototype is slice 26's plus the resizable side panels.** `diff` against slice 26's file gives 3 hunks, all
  the PRD's (section 4): the CSS of `.de-body` with `--dl` and `--dr` and the handles `.de-rz` (hidden up to 1,100 px),
  the module `PANELS` (prototype lines 8992–9017), and the handles in `drawEditor` (line 10130). Nothing else differs.
  Everything about figures and the page outline was already in slice 26's file.
- **What ran in this step.**
  - The two measurements (Q2, Q3, below), in headless Chromium 153 (Playwright 1.63's `chromium_headless_shell`).
  - No lint, typecheck, unit tests or e2e run: there is no application code in this step.
  - `.data/dev-db.json` and the KB backups were not read or written. "Performance test" and the demo were built in
    memory from the seed (`buildSeed`, `addLargeWorkspace`, `addFullDemoData`), as `scripts/bench-documents.ts` does.
- **The measuring files are not committed.**
  - In the repository, uncommitted: `scripts/s27-measure/figure-draft.ts` (a **draft** of a figure's SVG on the app's
    own `buildCards`, `buildLines` and `geometry.ts`, for size and time only), `build.tsx` (the s2t preset's document
    rendered as the app renders it, and a figure per canvas) and `browser-entry.ts` (the draft bundled for Chromium with
    esbuild). Run: `npx tsx scripts/s27-measure/build.tsx <folder>`.
  - Outside the repository, in this session's scratchpad: `probe.js` and `split.js` (Q2: a standalone page with Paged.js
    0.4.3's `dist/paged.js` and an SVG in each way), `measure.js` (Q3: the layouts), their JSON results and the PDFs.
- **The prototype's inventory.** The figures were read from the prototype's `DOC` module: `diagramFigures`,
  `drawGroup`, `rowsSVG`, `entSVG`, `srcSVG`, `blockSVG` (lines 9289–9452), `pageBox` and `layoutFig` (9454–9472), the
  image and its summary (9474–9478), `FIG0`, `figsOf`, `figureHTML`, `figEditor`, `SCALES`, the types Diagrams and
  Figure, `legend` (9537–9606), Model overview (9529–9535), the Data dictionary's `conFig` (9613, 9628), `starFigure`
  and the Dimensional model (9850–9897), the list of figures (9937), the Style panel (10208–10209), `canvasBox`,
  `pageArea` and `pageCtl` (10344–10370), the labels (`LBL`, 9026–9140) and the presets (9210–9248). What matters for
  this slice is quoted below.

### Summary

The PRD holds in its shape: a figure as a new kind of the content tree, built in the browser by a pure function from the
canvas's rows, with the app's own card and line rules. The measurement confirms the font risk and gives the ways out.

Ten things change the slice's cost or need Łukasz's answer:

1. **F1. The figure builder cannot live where the PRD's Q1 suggests without moving code.** A document section's `build`
   is domain code (InfoDocumenter's and InfoCube's `domain` parts), and the renderer is a module's `ui` part. Neither
   may import `src/canvas` (CLAUDE.md, layers), where `buildCards`, `buildLines`, `geometry.ts`, `text-fit.ts` and
   `frame-data.ts` live. They are pure; the proposal moves them down into `src/domain` (the canvas re-exports them),
   which changes the canvas's layers: **step 2 has a full run.**
2. **F2. The document's snapshot has no canvases, frames or labels.** `workspaceSnapshotOf` reads cards
   (`canvasItems`) and the project links, not the `canvas` rows (name, look, names), `frame` rows, or the labels a live
   canvas needs. The snapshot, the local adapter's `snapshot` and `browserSnapshot` grow (shared infrastructure: the
   local adapter).
3. **Q2. An SVG in an `<img>` does not use the page's fonts: confirmed.** Its text falls back to Arial and Consolas on
   this laptop (to whatever the system has on Linux). The PDF keeps the text as text in every variant, so it stays
   searchable. Embedding IBM Plex's unmodified files in each figure works and costs about 0.3 MB of source and 14–90 ms
   of layout per figure; a subset is ruled out by the font's licence and CLAUDE.md ("never subset or change the
   files"). An inline SVG uses the page's fonts and **Paged.js did not cut it** (the PRD's premise), but it is out for
   another reason: Q3.
4. **Q3. A large canvas is a large figure.** "Performance test"'s 100-card canvas makes an SVG of 595 KB (101 cards,
   2,228 rows, 340 lines), built in 13 ms. Whole on a page its names are about **1 pt**; at 6 pt it takes **36 parts**.
   With `<img>` the s2t preset with Diagrams lays out in 5.05 s (4.84 s without); inline, in 23.2 s with one 12.9 s
   task; in parts as the prototype makes them (the whole SVG per part), with a 61.6 MB source. The demo stays under Auto's
   1,000 ms in every way, so the threshold needs no change.
5. **D1. The prototype's sizes are six, the PRD's three.** `SCALES` also has "100 %, in parts", "75 %, in parts" and
   "50 %, in parts". The smallest names have four values (5, 6, 7, 8 pt), the PRD three.
6. **D2. The prototype draws notes and requirement cards in "As on the canvas"**, which decision 4 (C4) excludes for
   notes; requirement cards are not the working layer (`types.ts`, "Working layer": labels, notes, pins).
7. **D3. The prototype leaves out what is outside the document's scope; it has no muted look.** (Q8.)
8. **D4. The prototype's smallest-names rule is weaker than the PRD's.** It never draws a figure larger: it turns an
   "as large as fits" figure when that is clearly bigger, and otherwise only warns in the editor.
9. **D5. The PRD omits figure options the prototype has**: Diagrams' legend, notation and warning size; Model
   overview's "Where the figures go"; the Data dictionary's figure of each concept's frame; the Dimensional model's
   star options (dimension cards' rows, size, orientation, at most 6–24 dimensions) and its "Figures from canvases".
10. **Q6. The page outline is InfoDocumenter's on InfoMapper's canvas.** The prototype shows it only while
    InfoDocumenter is on. InfoMapper's canvas cannot import the module, so it needs a small extension point and the
    page geometry (paper, margins, the figure's box) in InfoMapper's domain, shared with the figures.

### Q2: fonts in an `<img>` SVG (the probe)

**The method.**
- The machine: the laptop (Intel Core i7-8550U at 1.80 GHz, 7.9 GB RAM, Windows 11, Node 22.20.0), on mains power,
  nothing else measured. IBM Plex is not installed on the system (`C:\Windows\Fonts` has none).
- A standalone page (`probe.js`, outside the repository): Paged.js 0.4.3's `dist/paged.js`, the page's `@font-face`
  for IBM Plex Sans (400, 600) and Mono from the repository's unmodified WOFF2 files, A4 portrait with 18 mm margins.
- A document of ten figures with two paragraphs before each: one of 100 cards × 8 rows and nine of 12 cards × 7 rows,
  every fourth turned 90° ("Landscape, turned" as the prototype draws it), each fitted to 174 × 220 mm.
- Four ways of placing a figure:
  - **img:** `<img>` with the SVG as a `data:` URI; the SVG asks for 'IBM Plex Sans' by name;
  - **img, font by URL:** the same with an `@font-face` in the SVG pointing to the font file;
  - **img, fonts embedded:** an `@font-face` in the SVG with the three WOFF2 files as `data:` URIs;
  - **inline:** the `<svg>` element in the figure, using the page's fonts.
- Per way: 1 warm-up layout and 5 timed ones (from `preview()` to the last image decoded), the pages, whether a figure
  was split, and a PDF (`page.pdf`) read with zlib: the fonts it names (`/BaseFont`) and its text operators (`Tj`,
  `TJ`) and `ToUnicode` maps. The fonts were read once more from a PDF holding one figure and no other text.
- `split.js`: an inline `<svg>` (also inside a sized `<div>`) and an `<img>` starting 200 mm down an A4 page, 85, 255 and 300 mm tall, with and
  without `break-inside: avoid`.

| Way | Source for 10 figures | Layout, median of 5 (fastest–slowest) | PDF | Fonts in the PDF of one figure | Text in the PDF |
| --- | --- | --- | --- | --- | --- |
| img | 615 KB | **447 ms** (427–499) | 155 KB | ArialMT, Arial-BoldMT, Consolas | text, searchable |
| img, font by URL | 623 KB | 424 ms (417–447) | 155 KB | ArialMT, Arial-BoldMT, Consolas: **the URL is not loaded** | text |
| img, fonts embedded | **3,733 KB** | **770 ms** (673–897) | 242 KB | IBMPlexSans, IBMPlexSans-SmBld, IBMPlexMono | text |
| inline | 470 KB | **934 ms** (833–968) | 121 KB | IBMPlexSans, IBMPlexSans-SmBld, IBMPlexMono | text |

**What the probe shows.**
- **The assumption holds.** An SVG shown through `<img>` is a document of its own: it does not see the page's
  `@font-face`, and it loads nothing by URL. Its text falls back to the system's fonts (Arial and Consolas here;
  GitHub's Linux runners and a Mac would show others), so the figure would look different on every machine.
- **Chromium prints an `<img>` SVG as vector and its text as text** (with `ToUnicode`), in every way: a figure's names
  are searchable in the PDF without doing anything. Only text turned into paths would lose that.
- **Embedding the fonts works**: the figure is in IBM Plex on screen and in the PDF. Its cost:
  - about **312 KB more per figure** in the source (three WOFF2 files, 179 KB, as base64 inside an SVG that is itself
    base64), and in every copy the editor and Paged.js make of it;
  - about **32 ms more layout per figure** (each image decodes its own fonts; nothing can be shared between `<img>`
    documents, so "once per document" is not possible with `<img>`);
  - only the faces a figure uses need embedding (Mono only with source tables).
- **A subset of IBM Plex is ruled out.** "Plex" is a Reserved Font Name (OFL 1.1): a subset is a Modified Version and
  must be renamed; CLAUDE.md says "never subset or change the files" (P3 B), and `docs/ideas.md` keeps a renamed Latin
  subset as a later option for the web fonts. Embedding the unmodified files, as the app already serves them, is
  allowed.
- **Text as paths was not measured**: the repository has no font parser (opentype.js, fontkit), and installing one is a
  download that needs your OK. It would also lose the searchable text, and a glyph's outline is about 0.1–0.4 KB, so a
  canvas of 2,228 rows of about 20 characters would grow by megabytes. Not proposed.
- **Paged.js did not cut an inline SVG.** In all 14 cases of `split.js` the inline `<svg>` stayed one element with
  all its text, exactly as the `<img>`: a figure that fits a page moves whole to the next page, with or without
  `break-inside: avoid`; one taller than a page overflows its page in both ways (no figure is ever taller: "in parts"
  cuts it). The PRD's reason for `<img>` (C2) did not show here. An inline SVG has two costs of its own:
  - Paged.js walks every node of it: **+49 ms per figure** in the probe (934 against 447 ms for ten), growing with the
    rows;
  - its ids (`clipPath`, markers) repeat in every copy (the hidden source, the laid-out pages, the editor's swap), so a
    figure must use none.

**Proposal (Q2): `<img>` with IBM Plex's unmodified files embedded in each figure**, only the faces it uses, as C2
decided. Inline SVG is no fallback: on "Performance test" it holds the thread for 12.9 s (Q3). The text in the PDF is
searchable either way.

### Q3: the measurement

**The method.**
- The machine as Q2's; headless Chromium 153 (Playwright 1.63).
- **The data.** "Performance test" and the demo ("Retail Co – DWH" with the star, `addFullDemoData`), built in memory
  from the seed by `scripts/s27-measure/build.tsx`; never `.data/dev-db.json` or a KB backup.
- **The figure** is the draft (`figure-draft.ts`): the app's `buildCards` and `buildLines`, then the cards with their
  header and every visible row (PK, FK, name, type, dot), frames with names, relationships with crow's feet
  (`relGeom`, `ieMarker`), mapping curves (`rowEnd`, `curve`) and source lines (`arrowHead`). The real builder draws a
  little more (pills, chips, badges, InfoCube's lines, requirement cards), so its SVG will be somewhat larger.
- **Its build** in Chromium: the draft bundled with esbuild, on the largest canvas, 1 warm-up and 9 timed calls; in
  Node the same, 9 calls per canvas.
- **The document**: the app's own s2t preset ("Source-to-target specification for ETL": conventions, S2T, source
  tables, the Dimensional model with InfoCube on, data quality rules), built by `buildDocument`, rendered by
  `DocumentHtml` with `renderToStaticMarkup` and laid out with `documentCss` (the app's pages). This is the prototype's
  longest preset with Diagrams that this slice can make (the sign-off preset needs baselines). A Diagrams section is put
  where the prototype's ETL preset has it, after the conventions: one figure per canvas of the workspace, "As on the
  canvas", "Whole, as large as fits", A4 portrait. The page's fonts are IBM Plex's files through `@font-face`.
- **The layouts**: per way, a fresh page, Paged.js 0.4.3's `preview()` until every image is decoded; 1 warm-up, then 5
  timed (demo) or 3 timed ("Performance test", 5 s to 23 s each); the main thread's longest task (`longtask`) per
  layout. Ways: no Diagrams; `<img>` (fallback fonts); `<img>` with the fonts embedded; inline `<svg>`; and the same
  figures cut into parts at 6 pt names ("in parts"): `<img>` per part with the whole SVG (the prototype), a blob URL per
  figure with each part's `#svgView(viewBox(…))` (F10; checked: a part shows its own region), and the same with fonts
  embedded.
- Medians, the fastest and the slowest in brackets.

**The figures** (draft SVG, no fonts embedded).

| Canvas | Cards | Rows drawn | Lines | Canvas size (px) | SVG | Build in Node | Build in Chromium |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Performance test, "100 cards" | 101 | 2,228 | 340 | 6,160 × 7,266 | **595 KB** | 18.5 ms | — |
| Performance test, "Performance test – requirements" | 101 | 2,228 | 340 | 6,160 × 7,266 | 595 KB | 16.4 ms | **13.1 ms** (9.3–15.2) |
| Performance test, "PERF-2" | 22 | 659 | 29 | 1,208 × 6,756 | 162 KB | 4.3 ms | — |
| Demo, "Customer & orders" | 7 | 48 | 17 | 1,432 × 832 | 16 KB | 0.6 ms | — |
| Demo, "Order lines & products" | 4 | 23 | 2 | 776 × 592 | 8 KB | 0.4 ms | — |
| Demo, "Sales star" | 13 | 72 | 12 | 1,756 × 1,004 | 26 KB | 0.7 ms | **1.1 ms** (0.7–2.4) |

- **Names on the page.** "Performance test"'s 100-card canvas whole on an A4 page: scale 0.107, names **about 1 pt**.
  At 6 pt it needs 6 × 6 = **36 parts** (each part a page). The demo's canvases fit whole at 5–8 pt.
- Building a figure is not a cost: 13 ms for the largest canvas in the browser.

**The layouts** (the s2t preset; with the Diagrams section).

| Document, way | Pages | Source | Layout | Longest task | PDF |
| --- | --- | --- | --- | --- | --- |
| Demo, no Diagrams | 14 | 47 KB | **465 ms** (425–489) | 57 ms | – |
| Demo, `<img>` | 16 | 114 KB | **489 ms** (478–501) | 79 ms | 170 KB |
| Demo, `<img>`, fonts embedded | 16 | 1,072 KB | **530 ms** (522–554) | 124 ms | 143 KB |
| Demo, inline | 16 | 98 KB | 589 ms (588–613) | 105 ms | 116 KB |
| Demo, in parts, `<img>` each with the whole SVG | 18 | 171 KB | 563 ms (541–580) | 93 ms | 181 KB |
| Demo, in parts, blob and view fragments | 18 | 48 KB | 524 ms (518–527) | 50 ms | 178 KB |
| Demo, in parts, blob, fonts embedded | 18 | 48 KB | 604 ms (603–606) | 63 ms | 203 KB |
| Performance test, no Diagrams | 108 | 491 KB | **4.84 s** (4.72–4.95) | 168 ms | – |
| Performance test, `<img>` | 111 | 2.3 MB | **5.05 s** (5.02–5.20) | **431 ms** | 1.2 MB |
| Performance test, `<img>`, fonts embedded | 111 | 3.3 MB | **5.32 s** (5.20–5.85) | 414 ms | 1.1 MB |
| Performance test, inline | 111 | 1.9 MB | **23.2 s** (22.4–24.6) | **12.9 s** | 1.1 MB |
| Performance test, in parts, `<img>` each with the whole SVG | 192 | **61.6 MB** | 14.3 s (13.2–14.6) | **11.7 s** | 2.2 MB |
| Performance test, in parts, blob and view fragments | 192 | 515 KB | **13.4 s** (13.0–14.1) | 349 ms | 2.1 MB |
| Performance test, in parts, blob, fonts embedded | 192 | 515 KB | 14.6 s (14.5–14.9) | 289 ms | 2.8 MB |

(The source of the blob ways does not count the blobs: 1.4 MB of SVG for "Performance test" and 50 KB for the demo, held
once per figure. "Performance test"'s "no Diagrams" took 4.59 s in a first run of the same script, so a run's drift is
about 5 %.)

**What the layouts show.**
- **Inline SVG is out.** On "Performance test" Paged.js walks the large figures' nodes in one task of **12.9 s** (the
  whole layout 23.2 s against 5.05 s with `<img>`). On the demo it is the slowest way too. This settles Q2's fallback:
  `<img>` (C2), for the cost of the layout and not for splitting.
- **`<img>` adds little to a layout:** +24 ms on the demo, +0.21 s on "Performance test". Its longest task (431 ms)
  is the large image's decode, about the first layout's longest task in slice 26 (390–423 ms).
- **Embedding the fonts** adds +41 ms (demo, 3 figures) and +0.27 s ("Performance test", 3 figures) to the `<img>`
  way, about 14–90 ms per figure, and about 0.3 MB of source per figure.
- **Parts must not repeat the whole SVG** (F10): the prototype's way makes "Performance test"'s source 61.6 MB and holds
  the thread for 11.7 s. One blob per figure with view fragments keeps the source at 515 KB and the tasks under
  0.35 s; the time then is the 84 more pages (13.4 s for 192 pages, as slice 26's 117 pages took 6.4 s).
- **The Auto threshold (1,000 ms) needs no change.** The demo's S2T with Diagrams lays out in 0.49–0.60 s, under it
  in every way, so Auto keeps real pages while one types. "Performance test" was above it before (4.8 s) and goes to the
  quick sheet as today. A demo document with all its canvases in parts would still be under 1 s (0.52–0.60 s).
- **The PDF** keeps the figures' text as text in every way (Q2), and it stays small: 1.1–1.2 MB for "Performance test"
  whole, about 2.1–2.8 MB in parts.

**Proposal (Q3).** `<img>` with the faces embedded, one blob URL per figure (revoked with its layout) and parts as view
fragments of it; the editor's reference figures with figures in step 2 (F9) on these two data sets; no bar unless
Łukasz sets one; Auto's threshold unchanged.

### Answers to the PRD's questions

**Q1. The SVG builder.**
- **What exists, and where.**
  - The thumbnails (`src/domain/model/thumbnail.ts`, AD-32) draw frames, collapsed frames' blocks, card rectangles and
    one straight line per mapped table–entity pair, in 400 units. They draw **no text, no rows, no relationship or
    source lines, no mapping curves, no marks, no frame names**. Their heights come from the domain's
    `cardHeightOf` and `blockHeight` (`card-size.ts`, `frames.ts`), checked against the canvas's `cardHeight(buildCards
    (…))` by `tests/thumbnail-heights.test.ts`.
  - Everything else a figure needs is pure TypeScript in **`src/canvas`**, depending on stored rows only, never on the
    DOM:
    - `buildCards` (`card-data.ts`: rows, PK/FK/PII/BK, types, the calculation's "=" and square, the dot's
      `mappings`, `line1`/`line1b`, the role, `applyNames`, the row filters, collapsed cards; with the modules' `roles`,
      `rowMarks` and `rowFeeds`);
    - `buildLines` (`line-data.ts`: mappings with their inputs, relationships with their offsets, source lines,
      `pillText`);
    - `geometry.ts` (`rowEnd`, `curve`, `fNode`, `relGeom` with the loop, `arrowHead`, `ieMarker`, `umlMarker`,
      `multText`; `HEAD_H` 54, `ROW_H` 26, `BODY_PAD` 6, `CARD_W` 256);
    - `text-fit.ts` (IBM Plex Sans's estimated character widths, `rowNeedsClip`, the marks' widths);
    - `frame-data.ts` (`frameShape`, `frameColor`, `memberCounts`);
    - `line-geometry.ts`'s `mapGeom`, `moduleGeom` and `bundleGeom` (their bodies are pure; they look cards up in React
      Flow's `InternalNode`s);
    - InfoCube's `cubeLines` (`src/modules/infocube/canvas/lines.ts`).
- **Where the figure's builder must live.** A section's `build` is domain code (InfoDocumenter's `domain`, InfoCube's
  `domain` for the star) and the renderer `document-html.tsx` is InfoDocumenter's `ui`. Neither may import
  `src/canvas` (`ui` never imports `canvas`; `domain` imports nothing). So the builder lives in **`src/domain`**, and
  the pure code above moves down with it (F1).
- **Proposal.**
  - `src/domain/canvas/` (new folder) holds what moves: `card-data.ts`'s pure part, `geometry.ts`'s functions and
    constants, `text-fit.ts`, `line-data.ts`, `frame-data.ts`'s shapes and colours, and a data-only form of `mapGeom`
    and `bundleGeom` (a lookup of placed cards instead of `InternalNode`s). The canvas's files re-export them, so no
    caller changes. `EntityRole` and `RowFeed` (`src/ui/modules.ts`) and `ModuleLineData` move to the domain as types.
  - `src/domain/document/figure.ts` (new): `figureOf(canvas rows, model, options, contributions)` → the figure's groups
    (one for a canvas or a frame): their bounds and one SVG string each, drawn in canvas pixels. Pure, no store.
  - `src/domain/document/page.ts` (new): the paper sizes, margins and the figure's box on a page, the size and
    orientation rule (`layoutFig`) and the page outline's pages (`pageArea`). The canvas page and InfoDocumenter's CSS
    both read it (Q6).
  - InfoCube's lines and marks go through `DocumentContributions` (`state.ts`): `cardRoles`, `rowMarks`, `rowFeeds` and
    `lines` for a canvas's dimensional mappings; InfoCube's `cubeLines` moves from its `canvas` part to its `domain`
    part (it is pure), and the canvas keeps using it through `src/compose`.
  - **No copy of a canvas rule:** the figure draws from the same `CardData`, `CanvasLines` and geometry as the canvas.
    A test like `thumbnail-heights.test.ts` compares the figure's card rectangles and row anchors with the canvas's.
- **What a figure draws that the thumbnail does not:** the cards with their header (stereotype or role, concept,
  name or alias, the fed count with status marks), their rows (PK, FK, name or alias, "=", PII or BK badge, type, the
  dot or square), frames with their names, collapsed frames' blocks, relationship lines with crow's foot or UML and
  their pills, mapping curves with the ƒ node, their status dashes and chips (ƒ, !, a count on a bundle), source lines
  with their arrow, dimensional mappings with their diamond and chips (L, ƒ).
- **What it draws as the canvas does not:** the notation is the document's (the canvas's notation is a setting of the
  browser, `infomapper:notation` in `CanvasProvider.tsx`, not of the canvas); the colours are the prototype's figure
  palette (`PAL.color`, `PAL.mono` for black and white), not the canvas's CSS tokens, which an `<img>` cannot read.
- **The draft** (`scripts/s27-measure/figure-draft.ts`) shows the reuse works: it builds a canvas's SVG from
  `buildCards`, `buildLines`, `relGeom`, `ieMarker`, `curve`, `rowEnd` and `arrowHead` unchanged.

**Q2. Fonts in an `<img>` SVG.** Above: the assumption holds; embed IBM Plex's unmodified files per figure (only the
faces used); no subset (the licence and CLAUDE.md), no text as paths; inline SVG is not cut by Paged.js but is out
for its layout time (Q3).

**Q3. Measurement.** Above.

**Q4. Sizes, parts, orientation** (the prototype's `pageBox`, `layoutFig`, `figureHTML`).
- **The box.** A figure gets the page's width less the margins; its height is the page's less the margins and 48 mm for
  the heading and the caption (`H0 - 2·MARG - 20 - 12 - 16`). Turned, the width is the page's height less the margins
  and 36 mm, the height the page's width less the margins. The prototype's margin is 18 mm on every side; **the app's
  pages are 18 mm with 20 mm at the bottom** (`pageCss`, `document-css.ts:61`): the box takes the app's.
- **Scale.** 1 canvas pixel = 0.2646 mm × the figure's scale; attribute names are 12.5 px, so 9.375 pt × the scale
  (`ROW_PT`).
- **The sizes** (`SCALES`; D1: six in the prototype):
  - "Whole, as large as fits" (`auto`): the whole figure in the box, never above 100 %. With orientation "As the
    document", it is **turned** when upright names would be under the smallest size and turned is more than 8 % larger.
  - "Whole, upright" (`page`): the same, never turned.
  - "Page width, in parts" (`width`): the figure at the box's width; cut into rows of parts as tall as the box.
  - "100 %, in parts", "75 %, in parts", "50 %, in parts": that scale, cut into columns and rows of parts.
- **Parts.** Equal parts of the figure, each overlapping its neighbours by 16 canvas pixels; a part with no card,
  frame or requirement card in it is left out. Each part is its own `<figure>`, captioned "Figure {n}{a}. {caption}
  (part {i} of {n})" (letters a, b, …), and only the first carries the figure's anchor (`fg-{n}`) for the list of
  figures; the parts get a thin dashed outline (`.dtile`).
- **"Landscape, turned".** The image is turned −90° inside a wrapper with the turned size (`.drotw`: width = the image's
  height, height = its width, `overflow: hidden`; the image `translateY(width) rotate(-90deg)` from its top left). The
  page stays portrait: Paged.js has one page size per document. The caption stays upright under it.
- **The smallest names** (D4). The prototype's code: they (a) turn an "as large as fits" figure as above, and (b) give
  the editor's line under the figure: "{n} figure(s) [in {p} parts] · names {pt} pt [(whole on one page: {x} pt)] ·
  upright | turned on the page | some turned on the page [· smaller than {min} pt: try one figure per frame, A3 paper,
  or the page outline on the canvas]". They never scale a figure up and never cut it. The Style panel's hint says more
  than the code does ("A canvas that would be smaller at page width is split into parts."). Diagrams may set its own
  size for the warning ("Warn when names are smaller than": the document's, 5, 6, 7, 8 pt).

**Q5. The star diagram** (`starFigure`).
- **From the model, not a canvas.** The fact's dimensions are the fact's keys' dimensions in scope (`factKeys`), at most
  `maxDims` (6, 8, 12 by default, 16, 24). Up to 6 stand left and right of the fact, alternately; more go left, right,
  top and bottom in turn. The fact card is 260 px wide with all its rows; each dimension 220 px with its keys or all its
  attributes ("Dimension cards in the star": "Keys only" by default, "All attributes"). Columns are centred on the
  fact's middle, 100 px from it, 30 px apart; the top and bottom rows 70 px from it, 40 px apart.
- **Drawn as a figure:** a synthetic canvas with only these cards, "Adjusted" view, relationship lines only (with their
  role pills), no status marks, the size and orientation of the section's "Size of the star diagrams". Its caption is
  "Star schema of {fact}", with " ({a} of {b} dimensions shown; all are in the table below)" beyond the limit.
- **Where:** in the Dimensional model, after each fact's type and grain table, before its Dimensions table, when "Star
  diagram, drawn from the model (no canvas needed)" is ticked (on by default).
- **In the app.** InfoCube's section (`src/modules/infocube/domain/document-section.ts`, `buildCubeSection`) already
  builds the cube index and reads `ix.factKeys(fact)`. It places the cards itself, by the prototype's rule, as canvas
  items in memory, and calls InfoMapper's `figureOf` (Q1) with them: the figure is InfoMapper's content-tree kind, so
  InfoDocumenter renders it without naming InfoCube (AD-33). The cards' rows and heights come from `buildCards`, not from
  an estimate (the prototype's `est`).

**Q6. The page outline** (`canvasBox`, `pageArea`, `pageCtl`).
- **What the prototype does.** Under "Canvas look", only while InfoDocumenter is on: "Page outline for documentation"
  with Off, A4, A3; then Portrait, Landscape and 6, 7, 8 pt. The canvas's box (every card, frame with its name strip,
  note and requirement card, 20 px around) is cut into pages of the figure's box at that size; each page is a dashed
  rectangle behind the cards with a label above its top left: page 1 "{A4} {portrait} at {7} pt · fits on one page"
  (green) or "… · needs {n} pages: move cards into page 1 to keep it whole", the others "page {n}" (orange, thinner).
  The hint under the controls: "Keep the cards inside page 1 and this canvas prints whole, with attribute names at least
  {pt} pt." The setting is on the canvas (`d.page`), for everyone.
- **Where it is stored. Proposal: in the canvas's look** (`canvas.look`, JSON, AD-16), as `pageOutline: { paper,
  orientation, pt }`, present only while on (as slice 16's hidden kinds). No column, **no change to the local file's
  format**: a look without the key reads as off, and the SQL default too. `lookInput` (`canvas.ts:429`, strict) and
  `CanvasLookPatch`, `applyLookPatch` and `sameLook` (`canvas-look.ts`) take it. Readers and reviewers change it in
  their browser only, as the rest of the look (`look.tsx`). "Use this look on all canvases" copies background and grid
  only (`src/app/_actions/canvas.ts:204`), so not the outline.
- **InfoDocumenter's setting on InfoMapper's page.** InfoMapper's canvas never imports a module; the control shows
  while InfoDocumenter is on. Proposal: the look's key is InfoMapper's (a canvas setting), its control and layer are
  InfoMapper's, and `ModuleView` gets a flag `pageOutline` that InfoDocumenter's part of `moduleView`
  (`src/compose/view.ts`) sets while its switch is on (a new extension point, listed in CLAUDE.md). The page geometry
  is `src/domain/document/page.ts` (Q1), so the outline and the figures cannot disagree.
- **What the outline counts.** The prototype counts notes too, which no figure draws (D2). Proposal: the outline counts
  what a figure "As on the canvas" draws (the same bounds function).
- **The layer.** Behind the cards, in the viewport, beside `FrameLayer` (z −1). Off: **no element** (not an empty
  group). On: one element per page (its label as a `::before` with `content: attr(…)`, as slice 3a's marks), so a
  canvas that fits takes one element. It never shows on a thumbnail (the route draws from rows, not the look) or a
  figure (the figure does not read the key).
- **Following the cards.** The prototype redraws it after each change. Proposal: from the stored rows, so it moves when
  a card is dropped (not during a drag), through a value store, never re-rendering `ModelCanvas` (AD-24; slice 2c's
  commit counters).
- **Shared infrastructure** (the canvas's layers): step 4 has a full run, and the element guard
  (`e2e/slice-03b/S3B-15-elements.spec.ts`) with the outline off must equal `slice-26`'s counts; with it on, the counts
  are reported.

**Q7. The side panels.**
- **The app today** (`src/modules/infodocumenter/app/editor.tsx`): the body is `grid-cols-[250px_minmax(0,1fr)_330px]`
  (line 364); `EDITOR_CSS` (834–843) stacks up to 1,100 px (220 px and the preview, the options below) and up to 720 px
  (one column) – the prototype's breakpoints.
- **The prototype's handles:** `PANELS` with bounds 200–480 (left, 250) and 280–560 (right, 330), widths in
  `localStorage` (`infodoc.panels`), `.de-rz` 8 px wide over the border, `role="separator"`, `aria-orientation=
  "vertical"`, `tabindex="0"`, `aria-label` "Width of the sections panel" and "Width of the options panel", title
  "Drag to widen; double-click for the default width"; ←/→ 16 px, with Shift 64 px; Home and a double-click give the
  default back; hidden up to 1,100 px.
- **"Fit width" already follows** the preview's width in the app: `preview.tsx` watches the scroller with a
  `ResizeObserver` (lines 156–165) and computes the zoom from its width (329). The prototype redraws only on the
  window's `resize`, so it does not follow a dragged panel; the app's way is what the PRD asks. No change needed beyond
  a test.
- **Screen readers.** The prototype's separator has no value. Proposal: `aria-valuenow` (the width in px),
  `aria-valuemin`, `aria-valuemax` and `aria-controls` (the panel), as WAI-ARIA's focusable separator wants.
- **Setting the widths.** CSS variables `--dl`/`--dr` on `.de-body`, which holds the preview and its pages, not the
  canvas (CLAUDE.md's rule about CSS variables is about the canvas); the stacked layouts ignore them.
- **The first paint.** The server cannot read `localStorage`: a page drawn with stored widths shows the defaults until
  it hydrates, then jumps. Slice 5a's side panels avoided that with a cookie the server reads (`im-panels.<userId>`).
  Proposal: `localStorage` as the PRD says (the key `infomapper:doc-panels`, as `infomapper:view:` and
  `infomapper:notation`), set in a layout effect; or a cookie like slice 5a's (Question 9).

**Q8. Scope on figures** (D3).
- **The prototype** (`diagramFigures`) deletes every entity and table outside the document's scope from its copy of the
  canvas before drawing: they are **left out**, with their rows and lines; there is no muted look. Mapping lines follow
  the scope's mappings (approved, not drafts, or all) and dimensional mappings the same; a figure with nothing left
  says "Nothing from this canvas is in the document's scope."
- **Proposal: as the prototype, left out.** A muted look would be a new drawing rule (and colours for black and white)
  that the prototype does not have; the PRD offers it as a choice for step 1. Leaving them out keeps a figure about the
  document's scope; the page outline (Q6) still shows the whole canvas.

**Q9. Earlier specs and fixtures:** listed below (Earlier specs and fixtures each step touches). The demo's documents
get the figure sections of their presets (the dictionary: Diagrams with keys only; the S2T: Diagrams as on the canvas),
which changes their sections, page counts and `tests/documents-demo.test.ts`.

### Findings

**Differences between the PRD and the prototype (D: Łukasz decides; the prototype is the source of truth for
behaviour, so each is a question).**

- **D1. Sizes and the smallest names.** The prototype's `SCALES` has six sizes: the PRD's three and "100 %, in parts",
  "75 %, in parts", "50 %, in parts". The Style panel's "Smallest attribute names in diagrams" has 5, 6, 7 and 8 pt
  (default 6), the PRD 6, 7, 8; the page outline has 6, 7, 8 pt (default 7). Proposal: the prototype's six sizes and
  four values (C1 b: "the whole of the prototype's figures").
- **D2. What "As on the canvas" draws.** The prototype draws the canvas's **notes** (as `foreignObject`) and its
  **requirement cards** with their dashed trace lines, frames as they are (collapsed ones as blocks), the canvas's
  hidden kinds, all mappings, dimensional mappings and status marks. Decision 4 (C4) says no notes. Proposal: no notes
  (C4); **requirement cards and their trace lines drawn** (they are model content, not the working layer, and the
  prototype draws them), drawn without `foreignObject` (an SVG card like the others: `<foreignObject>` HTML in an `<img>`
  does not reach the page's fonts or print reliably). "Adjusted" never draws requirement cards (as the prototype).
- **D3. Out of scope: left out**, not muted (Q8).
- **D4. The smallest names do not scale a figure up** in the prototype (Q4). The PRD says a figure that would need
  smaller text "is drawn larger, in parts if its size allows it, or says why it cannot". Options:
  - (a) the prototype's code: an "as large as fits" figure turns when that helps; otherwise the editor's line warns,
    and nothing in the document says so;
  - (b) also the Style panel's hint: "Page width, in parts" draws at the box's width **or** at the smallest names'
    scale, whichever is larger, so its names never fall under the size (and it may then cut into columns too).
  Proposal: (b): it makes the style's hint true and costs one line in the size rule; the warning stays for the "whole"
  sizes. The document itself shows no warning (as the prototype).
- **D5. Figure options the PRD does not list** (all the prototype's; C1 b includes them):
  - **Diagrams:** "Legend under the figures" (on), "Notation" (Document's, Crow's foot, UML), "Warn when names are
    smaller than" (the document's, 5, 6, 7, 8 pt); a canvas's name as a sub-heading before its first figure;
  - **Model overview:** "Where the figures go" ("Below the section's content", "Right after the description");
  - **Data dictionary:** "Figure of the concept's frame at its start (from the first canvas that has one)", under "Group
    by concept";
  - **Dimensional model:** "Dimension cards in the star" (Keys only, All attributes), "Size of the star diagrams" (the
    six sizes and three orientations), "Dimensions drawn per star, at most" (6, 8, 12, 16, 24) with its hint, each
    star's editor line, and "Figures from canvases".
- **D6. The figure's view "As on the canvas" and the canvas's layer.** In the prototype the layer switch is a person's
  view state (`V.layer`) and figures ignore it; in the app it is stored in the canvas's look (`layer`). Proposal: "As on
  the canvas" follows the hidden kinds (as the prototype) and **not** the layer (a working switch).
- **D7. "Dimensional" in the line kinds.** The prototype shows the check box always; the PRD "while InfoCube is on".
  Proposal: the PRD's (nothing to draw otherwise).
- **D8. The figure selected in the editor.** The PRD says "the figure's preview outlined when its figure is selected";
  the prototype has no figure selection: figures are edited in their section's options, and the section is outlined.
  Proposal: leave it out (not in the prototype), or ask for its behaviour.
- **D9. Diagrams' figures when the section is made.** The prototype makes Diagrams' figures on its first drawing: one
  per canvas in the scope (`figsOf`, the scope's canvases), with the preset's view; then they are the section's own.
  The business preset's `split: "frames"` is read by nothing (`figureHTML` always draws whole canvases). Proposal: the
  figures are stored when the section is made (a preset's document, "+ Add section"), one per canvas of the scope's
  projects in their tab order, each a whole canvas; a later change of the scope does not change them.
- **D10. The list of figures** stands on its own sheet after the contents ("List of figures", one line per figure with
  its number, its caption and its page; a figure in parts once). In the quick sheet without page numbers (as the
  contents).
- **D11. The prototype's English-only texts in a document.** "(canvas no longer exists)" and "(frame no longer
  exists)" (a figure whose canvas or frame was deleted, printed as a warning) are English in every language.
  Proposal: three languages, as `LBL`'s other words (German for Łukasz's review).
- **D12. The page outline's pages and the figure's box** use the prototype's 18 mm margins; the app's bottom margin is
  20 mm (Q4). Proposal: the app's.

**Findings in the code (F).**

- **F1. The builder's place** (Q1): moving the canvas's pure code into `src/domain/canvas/`. Files: `src/canvas/
  card-data.ts`, `geometry.ts`, `text-fit.ts`, `line-data.ts`, `frame-data.ts`, `line-geometry.ts` (its pure bodies),
  `src/ui/modules.ts` (`EntityRole`, `RowFeed`), `src/modules/infocube/canvas/lines.ts`; lint's layer rules and
  `tests/layer-rules.test.ts` unchanged. The canvas's files keep their exports. **Shared infrastructure (the canvas's
  layers): a full run in step 2.** The cost is mostly moving and re-exporting; `mapGeom` and `bundleGeom` get a
  data-only form beside their `InternalNode` wrappers.
- **F2. The snapshot.** `WorkspaceSnapshot` (`src/domain/model/workspace-model.ts:125`) adds the live `canvas` rows
  (name, look, names, `live_label_id`), `frame` rows and, for live canvases (C4: "a live label canvas draws as it
  shows"), the labels and their links that `liveMembership` reads. `store.snapshot` in the local adapter reads them
  in the same state; `browserSnapshot` (`app/snapshot.ts`) keeps them (no people's data). The editor's snapshot grows by
  these rows (the D7 measurement in step 2 gives the new size). Notes are not read (C4).
- **F3. The content tree's figure kind** (`src/domain/document/content.ts`): `figure` with its number (set by
  `buildDocument`), its caption, its anchor, its parts (each: the SVG string, the width and height in mm, turned or
  not) and the editor's summary line. The renderer (`document-html.tsx`) draws `<figure class="dfig">` with an `<img>`
  whose `src` is the SVG as a `data:` URI built in React from the string (React escapes the attribute; the SVG's text is
  escaped by the builder: a test as slice 25's escaping test). The quick sheet draws the same.
- **F4. The fonts in the SVG.** The builder writes `@font-face` rules with the WOFF2 files as `data:` URIs. The files are
  `src/app/fonts/ibm-plex/` (unmodified); the browser cannot read them as base64 without fetching them. Proposal: the
  editor and the document page fetch the three files once (`/_next/static/media/…`, the same `next/font/local` URLs, or
  a route) and hand the base64 to the renderer; the domain builder takes them as an argument, so the tree stays pure and
  unit tests run with an empty font set. Size: 179 KB of fonts per figure, about 240 KB as base64.
- **F5. Black and white.** The style's "Black and white" (`colours: "mono"`) gives the figure the prototype's
  `PAL.mono`; the accent colour is not used in figures (as the prototype).
- **F6. Numbering across sections.** Figures are numbered in document order by `buildDocument` after the sections are
  built (Diagrams, Figure, Model overview, the Dictionary's concept frames, the stars), so a module's section does not
  number them itself. The list of figures reads the same numbers.
- **F7. The Figure section starts on the same page** (the prototype's `page: false`): a new entry of type `figure` has
  `newPage: false` (`newSection`, `presets.ts:77`, sets `true` for every type today).
- **F8. The recipe** (`src/modules/infodocumenter/domain/style.ts`, `sections.ts`): the figure's fields in the options
  of Diagrams, Figure, Model overview and `cube.dim` (`figures`: a list of at most, say, 50 per section, each `{ id, on,
  canvasId, frameId, view, rows, lines, status, size, orientation, caption }`), Diagrams' `legend`, `notation`,
  `warnPt`, Overview's `figuresAt`, the Dictionary's `conceptFigures`, `cube.dim`'s `star`, `starRows`, `starSize`,
  `starOrientation`, `starMax`; the style's `listOfFigures` (false) and `smallestPt` (6). Stored recipes read with the
  defaults through `upgradeSection` and `upgradeDocument` (the table's row upgrade): **no file format**. A figure's
  options are saved as the section's `options` like the others (`opt({ figures })`, the whole list per change).
- **F9. The preview's cost with figures.** The editor renders the tree with React into a hidden source and Paged.js
  copies it (slice 26). An `<img>` with a 0.8–1.1 MB `data:` URI (the largest canvas with its fonts) is copied in each:
  three copies during a swap. Measured in step 2 (the editor's D7 figures, with figures); a blob URL per figure (`URL.
  createObjectURL`, revoked when its layout is destroyed) keeps the DOM small, measured beside it.
- **F10. Parts as images.** The prototype makes one `<img>` per part with the **whole** SVG and its own `viewBox`: 36
  parts of "Performance test"'s canvas would carry the 0.8 MB figure 36 times (29 MB). Proposal: one blob URL per
  figure and each part an `<img>` of it with an SVG view fragment (`#svgView(viewBox(x,y,w,h))`), measured in Q3; or
  each part's SVG holding only the cards and lines that reach it.
- **F11. The star's cards** are measured by `buildCards` (heights from the rows), not estimated, so a dimension with a
  long name or many keys is placed as drawn.
- **F12. Requirement cards** (D2) on a figure need the requirement's coverage (the requirement index is in the document
  state, `state.ts`: `requirements`), drawn as an SVG card of the canvas's size (`REQUIREMENT_CARD_WIDTH`, 94 high).
- **F13. The page outline's extension point** (`ModuleView.pageOutline`, Q6) and the look's key: `CanvasLook`
  (`src/domain/types.ts:531`), `lookInput`, `applyLookPatch`, `sameLook`, `look.tsx`, the view-state bar's "Show all"
  (it must not clear the outline: the outline is not a filter).
- **F14. Live canvases.** A live label canvas's cards are stored rows (`syncLiveCanvas`), so a figure draws them as
  stored; its `labeled` row filter needs `liveMembership` (F2). A live canvas that is a working label's view is still a
  canvas of the project, so Diagrams offers it.
- **F15. The editor's figure line** (the prototype's `ST.figInfo`) is computed while the tree is built and shown in the
  section's options; the tree carries it (F3), so no second build.

**What the PRD assumes that holds.**
- No new table; the recipe's JSON takes the new options (AD-18's note).
- The content tree is InfoMapper's domain; a figure kind there lets InfoCube's star be drawn without InfoDocumenter
  naming InfoCube (AD-33).
- The thumbnails' rules stay as they are; the figure is a second, richer drawer of the same card and frame rules, and
  AD-32 gets a note only if they share code (they share `card-size.ts` and `frames.ts`).

### Every new UI text

The prototype's exact texts. The editor's texts are English (as the app); the document's words in three languages come
from the prototype's `LBL` (German for Łukasz's review, as in slices 25 and 26).

**"+ Add section": the new types and the changed line.**
- "Diagrams": "Figures of whole canvases or single frames, each with its own view, size and caption. Tick what goes
  into the document."
- "Figure": "One or more figures of a canvas or a frame, placed wherever you put this section."
- "Dimensional model" (InfoCube), its line back to the prototype's: "Facts with grain, type, a star diagram, dimensions
  and measures; dimensions with history; every dimensional attribute's feed; figures from canvases."

**The figure editor** (in Diagrams, Figure, Model overview and the Dimensional model).
- Its label per section: "Figures" (Diagrams, Figure), "Figures (e.g. the logical data model)" (Model overview),
  "Figures from canvases" (Dimensional model).
- Its hint: Diagrams "Untick a figure to leave it out; add a canvas or one of its frames below. Size: a figure is never
  cut unless you choose a size “in parts”."; Figure "A canvas, or one frame of it."; Dimensional model "Shown at the
  start of the section, e.g. a star you arranged on a canvas."; Model overview none.
- Per figure: the check box "In the document" (its label and title); the figure's name, "{canvas}" or "{canvas} ·
  {frame}"; "(canvas no longer exists)", "(frame no longer exists)"; the buttons "Move up", "Move down", "Remove".
- The selects: "As on the canvas", "Adjusted"; "Whole, as large as fits", "Whole, upright", "Page width, in parts",
  "100 %, in parts", "75 %, in parts", "50 %, in parts" (D1); "As the document", "Portrait", "Landscape, turned"; with
  "Adjusted": "Rows as on canvas", "Keys only", "All rows", "Headers only".
- With "Adjusted": "Relationships", "Mappings", "Source FKs", "Dimensional" (D7), "Status marks".
- The caption field: placeholder "Caption: {figure's name}", label "Caption".
- The figure's line: "{n} figure" / "{n} figures", " in {p} parts", " · names {pt} pt", " (whole on one page: {x}
  pt)", " · upright" / " · turned on the page" / " · some turned on the page", " · smaller than {min} pt: try one figure
  per frame, A3 paper, or the page outline on the canvas".
- Off: "Not in the document."; none: "None yet.".
- Adding: the select "Canvas or frame to add" (its label; a frame as " › {frame}"), the button "Add figure".

**Section options.**
- Diagrams: "Legend under the figures", "Notation" ("Document's", "Crow's foot", "UML"), "Warn when names are smaller
  than" ("Document's ({pt} pt)", "5 pt", "6 pt", "7 pt", "8 pt").
- Model overview: "Where the figures go": "Below the section's content", "Right after the description".
- Data dictionary: "Figure of the concept's frame at its start (from the first canvas that has one)".
- Dimensional model: under "For each fact", "Star diagram, drawn from the model (no canvas needed)"; "Dimension cards
  in the star": "Keys only", "All attributes"; "Size of the star diagrams" (the sizes and orientations above);
  "Dimensions drawn per star, at most" (6, 8, 12, 16, 24); the hint "Up to 6 dimensions stand left and right of the
  fact; more go above and below too. Beyond the limit the figure says how many are shown; the fact's table lists them
  all."; per fact "{fact}: {the figure's line}".
- The preview's placeholders: "Tick or add a figure in the panel on the right." (Diagrams), "Add a figure in the panel
  on the right." (Figure).

**Style.**
- "Smallest attribute names in diagrams": "5 pt", "6 pt", "7 pt", "8 pt"; hint "A canvas that would be smaller at page
  width is split into parts." (true only with D4 b).
- The switch "List of figures" (between "Contents" and "Numbered sections and subsections").

**The editor's side panels.** The handles' labels "Width of the sections panel", "Width of the options panel"; their
title "Drag to widen; double-click for the default width".

**Canvas look** (the canvas page, while InfoDocumenter is on).
- "Page outline for documentation": "Off", "A4", "A3"; "Portrait", "Landscape"; "6 pt", "7 pt", "8 pt".
- The hint: "Keep the cards inside page 1 and this canvas prints whole, with attribute names at least {pt} pt."
- On the canvas: "{A4|A3} {portrait|landscape} at {pt} pt · fits on one page", "{A4|A3} {portrait|landscape} at {pt}
  pt · needs {n} pages: move cards into page 1 to keep it whole", "page {n}".

**Refusals (domain).** Proposed: "A section holds at most 50 figures." (as D10's 50 sections); "That canvas is not in
this workspace." (a figure's canvas or frame of another workspace, or none).

**Document labels (three languages, `LBL`).** English / Polish / German, as the prototype:
- `t_diagrams` "Diagrams" / "Diagramy" / "Diagramme"; `t_figs` "Figures" / "Rysunki" / "Abbildungen" (the Figure
  section's default heading); `lof` "List of figures" / "Spis rysunków" / "Abbildungsverzeichnis";
- `fig` "Figure" / "Rysunek" / "Abbildung"; `part` "part {i} of {n}" / "część {i} z {n}" / "Teil {i} von {n}";
- `legend` "Legend" / "Legenda" / "Legende"; `empty` "Nothing from this canvas is in the document's scope." / "Nic z
  tej kanwy nie mieści się w zakresie dokumentu." / "Nichts von dieser Arbeitsfläche liegt im Umfang des Dokuments.";
  `other` "Cards outside frames" / "Karty poza ramkami" / "Karten außerhalb von Rahmen" (not used by this slice's
  figures: it names a figure per frame's rest, which no size makes);
- the legend's lines `lg_rel`, `lg_ok`, `lg_rev`, `lg_dr`, `lg_warn`, `lg_f`, `lg_cube`, `lg_src`, `lg_dot` (e.g.
  "Relationship (crow's foot: many; bar: one; circle: optional)", "Row fed (filled) or not (ring)"), in the three
  languages as the prototype's lines 9042–9044, 9079–9081, 9116–9118; with UML the relationship's line needs its own
  wording (the prototype's names crow's foot only): proposed "Relationship (UML multiplicities)" / "Relacja (krotności
  UML)" / "Beziehung (UML-Multiplizitäten)";
- `star` "Star schema of {n}" / "Schemat gwiazdy: {n}" / "Sternschema von {n}"; `starPart` "{a} of {b} dimensions
  shown; all are in the table below" / "pokazano {a} z {b} wymiarów; wszystkie są w tabeli poniżej" / "{a} von {b}
  Dimensionen gezeigt; alle stehen in der Tabelle darunter";
- new (D11): "(canvas no longer exists)", "(frame no longer exists)" in Polish and German, proposed "(kanwa już nie
  istnieje)", "(ramka już nie istnieje)", "(Arbeitsfläche existiert nicht mehr)", "(Rahmen existiert nicht mehr)".
- Inside a figure (the cards' words): the stereotype's name and the concept's come from the model, "PK", "FK", "PII",
  "BK" as on the canvas. The canvas's own words on a card are English ("in {concept}", a role's text from InfoCube's
  canvas words); proposed: "in" / "w" / "in" and the role in InfoCube's document words (`document-words.ts`,
  `entityRole`), so a Polish document's figure has no English word but the model's.

### Earlier specs and fixtures each step touches

| Spec or test | Step | Why |
| --- | --- | --- |
| `tests/thumbnail-heights.test.ts`, the moved files' tests (`src/canvas/text-fit.test.ts`, `frame-data.test.ts`, `line-geometry.test.ts`, `lines.test.ts`, `loop-geometry.test.ts`, `card-names.test.ts`) | 2 | Imports move to `src/domain/canvas/` (re-exports keep them working); a new test compares the figure's cards and row anchors with the canvas's, like this one. |
| `tests/layer-rules.test.ts` | 2 | Unchanged rules; a probe that `src/domain/canvas/` imports neither `canvas` nor `ui`. |
| `tests/document-tree.test.ts` | 2, 3 | The snapshot's new rows (F2); `DOCUMENT_TABLES` unchanged; the figure kind and numbering; "no store" holds. |
| `tests/document-html.test.ts` | 2 | The figure's `<img>` and escaping (a canvas or frame name with markup in a caption and inside the SVG). |
| `tests/infodocumenter-store.test.ts` | 2, 3 | The row upgrade with the style's `listOfFigures`, `smallestPt` and the sections' figure options. |
| `src/modules/infodocumenter/domain/documents.test.ts` | 3 | The presets' sections (l.110–131): the dictionary gets Diagrams after the conventions, the S2T Diagrams after the conventions (D9; the prototype's ETL preset). The Figure type's `newPage: false`. |
| `tests/documents-demo.test.ts` | 3 | The demo's three documents get their presets' Diagrams (and their figures from the scope's canvases). |
| `tests/document-sections-26.test.ts` | 3 | Its headings list (l.69) adds Diagrams and Figure in three languages. |
| `tests/document-style.test.ts` | 3 | The list of figures, the figure's CSS. |
| `e2e/slice-25/S25-03` | 3 | Its preset sections (l.40: `[conv, s2t, sources, dq]`) get `diagrams`. |
| `e2e/slice-25/S25-06`, `S25-07` | 3 | The S2T preset's document has a Diagrams section: page counts and contents change; the checks of the text stay. |
| `e2e/slice-26/S26-01` | 2, 3 | "+ Add section" lists Figure (step 2) and Diagrams (step 3). |
| `e2e/slice-26/S26-02`, `S26-03` | 2 | The layout times with a figure; they may need Exact pages or a smaller document if the demo's documents cross Auto's 1,000 ms (Q3). |
| `e2e/slice-26/S26-08` | 3 | The style panel's two new controls. |
| `e2e/slice-26/S26-10-figures.spec.ts` | 2 | The D7 reference figures with the snapshot's new rows and with figures (its name is "figures" as measurements, not this slice's). |
| `e2e/slice-26/S26-screens`, `e2e/slice-25/S25-screens` | 3 | The editor and the documents with figures. |
| `e2e/slice-16/*` (the look, the kinds' chips, "Show all") | 4 | The look's new key: "Show all" must keep the outline; the look's patch. |
| `e2e/slice-14b` (the look on the save chain, "Use this look on all canvases") | 4 | The look's save with the new key; "all canvases" copies background and grid only. |
| `e2e/slice-12b/*` (thumbnails) | 4 | The outline never on a thumbnail (unchanged code; checked by S27-09). |
| `e2e/slice-03b/S3B-15-elements.spec.ts` | 4 | The element guard: with the outline off, `slice-26`'s counts; on, reported. |
| `e2e/slice-02c/S2C-12`, `e2e/slice-03a/S3A-14-idle`, `e2e/slice-03b/S3B-15-idle` (commit counters) | 4 | An outline on must not re-render `ModelCanvas` while idle, panned or zoomed. |
| `e2e/parts.ts`, `tests/e2e-parts.test.ts` | 2 | `e2e/slice-27/` joins the last part (the recut rule, from `slice-20`). |
| Fixtures | 2 | `e2e/slice-27/fixtures.ts` from slice 26's (`seed` "docs", "plain", "full"); the star needs "full". No earlier fixture changes; the demo's documents change through their presets (step 3). |

### The plan for steps 2 to 5

- **Step 2: a figure.**
  - The move (F1): the canvas's pure code into `src/domain/canvas/`, re-exported; `cubeLines` into InfoCube's domain.
  - The snapshot's rows (F2) in `workspaceSnapshotOf`, the local adapter's `snapshot` and `browserSnapshot`.
  - `src/domain/document/page.ts` (paper, margins, the box, the size and orientation rule, the parts) and `figure.ts`
    (the SVG from a canvas or a frame with the figure's options; requirement cards per D2; scope per D3; the fonts as an
    argument, F4); the content tree's `figure` kind (F3); numbering in `buildDocument` (F6).
  - The renderer: `<img>` with the fonts embedded (Q2), turned figures, parts (F10); the quick sheet.
  - The figure editor in a section's options; the Figure section (`newPage: false`, F7); its options in the recipe and
    the row upgrade (F8).
  - The editor's resizable side panels (Q7).
  - Specs S27-01, S27-02, S27-03, S27-07, S27-08, S27-10's unit tests for the builder; the D7 figures with figures (F9).
  - **A full run** (F1: the canvas's layers; F2: the local adapter).
- **Step 3: sections and the star.**
  - Diagrams (its figures made with the section, D9; legend, notation, warning size), Model overview's figures and
    "Where the figures go", the Dictionary's concept frames' figures, the Dimensional model's star (Q5, through
    `figureOf` from InfoCube's domain) and its options and "Figures from canvases".
  - The list of figures (D10), the smallest names (D4), the style's two controls.
  - The labels in three languages; the presets (Diagrams in the dictionary and the S2T, as the prototype's) and the
    demo's documents.
  - Specs S27-04, S27-05, S27-06; earlier specs as listed. CI and the slices' specs; no full run unless step 2's move
    needs more (none expected).
- **Step 4: the page outline on the canvas.**
  - The look's key, `ModuleView.pageOutline`, the control in "Canvas look", the layer behind the cards from
    `page.ts`'s pages (Q6).
  - Spec S27-09; the element guard and the commit counters.
  - **A full run** (the canvas's layers).
- **Step 5: closing.** As the PRD's section 8: D-82 and the notes (AD-32 if the figure shares the thumbnails' code,
  AD-33 for the new extension point and the moved code, AD-18 for the recipe's new JSON) quoted for approval; the docs
  (`decisions.md`, `data-model-v2.md`, `ideas.md`, `inventory-prototype-vs-app.md`, `known-limitations.md`, README,
  CLAUDE.md's extension points and commands); one full run on the final commit; the manual acceptance steps.

### Questions for Łukasz before step 2

1. **F1:** move the canvas's pure code (cards, lines, geometry, text fit, frames' shapes) into `src/domain/canvas/`,
   re-exported from the canvas, so a document section can draw a figure; a full run in step 2?
2. **F2:** the document's snapshot reads the canvases, frames and (for live canvases) labels and their links; no notes?
3. **Q2:** `<img>` with IBM Plex's unmodified files embedded per figure (the faces it uses), no subset, no text as
   paths, no inline SVG (Q3: 12.9 s in one task); one blob URL per figure, its parts as view fragments of it (F10)?
4. **D1:** the prototype's six sizes (with "100 %", "75 %", "50 %, in parts") and the smallest names at 5–8 pt?
5. **D2:** "As on the canvas" without notes (C4) but with requirement cards and their trace lines (the prototype draws
   both)?
6. **D3 / Q8:** objects out of scope left out, as the prototype (no muted look)?
7. **D4:** the smallest names as the prototype's code, plus "Page width, in parts" never under the smallest size (the
   style's hint made true), or the prototype's code only?
8. **D5:** the figure options the PRD does not list (Diagrams' legend, notation and warning size; Overview's "Where the
   figures go"; the Dictionary's concept-frame figure; the star's rows, size, orientation and limit; the Dimensional
   model's figures from canvases), all in this slice?
9. **Q7:** the panels' widths in `localStorage` (a jump from the default width at the first paint of a page) or in a
   cookie the server reads, as the canvas page's side panels (slice 5a)? And `aria-valuenow/min/max` on the handles?
10. **D6, D7, D8:** "As on the canvas" follows the hidden kinds but not the layer switch; "Dimensional" only while
    InfoCube is on; no "figure selected" outline (not in the prototype)?
11. **D9:** Diagrams' figures stored when the section is made (one per canvas of the scope, whole), not following later
    scope changes?
12. **D11 and the cards' words:** "(canvas no longer exists)", "(frame no longer exists)", "in {concept}" and the roles
    in the document's language?
13. **Q6:** the page outline in the canvas's look (no format change), shown while InfoDocumenter is on through a new
    `ModuleView` flag, counting what a figure draws (not notes), moving on a drop; a full run in step 4?
14. **Q3:** no change to Auto's 1,000 ms threshold (below)?

### Łukasz's answers (14 November 2026)

1. **F1:** yes. The canvas's pure code (`buildCards`, `buildLines`, the geometry) moves to `src/domain/canvas/`, the
   canvas re-exporting it: one drawing rule for the canvas, the thumbnails and the figures. A full run in step 2.
2. **F2:** yes. The document's snapshot gets the canvases, canvas items, frames, labels and label links; never notes.
   Its new size is measured on "Performance test" and the demo (reference figures), and it still holds nothing about
   people beyond id and name.
3. **Q2:** IBM Plex's unmodified files embedded in each figure's SVG, only the faces and weights that figure uses; no
   subset, no text as paths; a figure's text stays searchable in a PDF. **Inline SVG is out:** figures are `<img>`.
   **Q3 (parts):** one blob per figure, each part showing its own region of it.
4. **D1:** as the prototype: six sizes, the smallest names 5–8 pt.
5. **D2:** requirement cards are drawn, with their trace lines; notes never (C4). A deliberate difference from the
   prototype, to be written into D-82.
6. **D3 / Q8:** objects out of scope are left out, as the prototype (no muted look).
7. **D4:** as the prototype's code only (option a): a figure is never drawn larger.
8. **D5:** the prototype's extra figure options, all in this slice.
9. **Q7:** the panels' widths in a cookie the server reads (as slice 5a's side panels), and `aria-valuenow`,
   `aria-valuemin` and `aria-valuemax` on the handles.
10. **D6:** "As on the canvas" follows the hidden relationship kinds, not the layer switch. **D7:** "Dimensional" only
    while InfoCube is on. **D8:** no figure-selected outline.
11. **D9:** Diagrams' figures are stored when the section is made, one whole canvas each per canvas of the scope's
    projects in tab order, and do not follow later scope changes.
12. **D11:** "(canvas no longer exists)", "(frame no longer exists)", "in {concept}" and the roles in the document's
    three languages.
13. **Q6:** the page outline in the canvas's look, no change of the local file's format, shown while InfoDocumenter is
    on through a `ModuleView` flag (step 4); it counts only what a figure draws (not notes), follows drops, and step 4
    has a full run.
14. **Q3 (Auto):** the threshold stays 1,000 ms.

The measuring files (`scripts/s27-measure/`) stay uncommitted until the closing.

## Step 2: a figure (14 November 2026)

### What was built

- **The move (F1).** The canvas's pure drawing rules moved to `src/domain/canvas/`: `card-data.ts`, `geometry.ts`,
  `text-fit.ts`, `line-data.ts`, `line-geometry.ts` (its geometry; React Flow's lookups stay in `src/canvas/line-geometry.ts`
  as wrappers), `frame-data.ts`, `requirement-card-data.ts`, `trace-data.ts`, with the types `EntityRole`, `RowFeed`
  (`module-marks.ts`) and `SelectionKey` (`selection-key.ts`). InfoCube's `cubeLines` moved to its domain part. The
  canvas's files re-export them: no caller changed. `src/domain/canvas` is imported as `@/domain/canvas/…` (a relative
  `../canvas` is refused by the layer rule, `eslint.config.mjs`'s note); `tests/layer-rules.test.ts` has a probe.
- **The snapshot (F2).** `WorkspaceSnapshot` has the live canvases, frames, labels and label links (`workspaceSnapshotOf`,
  so the local adapter's `snapshot` too); never notes. Measured on the editor's snapshot as the browser receives it
  (`browserSnapshot`, JSON; reference figures, `scripts/s27-measure/snapshot-size.ts`):

  | Data set | Before | After | Added | Canvases | Frames | Labels | Label links |
  | --- | --- | --- | --- | --- | --- | --- | --- |
  | Performance test | 2,190.3 KB | 2,251.3 KB | +61.0 KB (+2.8 %) | 3 (1.4 KB) | 27 (14.0 KB) | 5 (1.7 KB) | 90 (43.9 KB) |
  | Demo (Retail Co – DWH, full) | 186.6 KB | 191.7 KB | +5.0 KB (+2.7 %) | 3 (1.4 KB) | 0 | 2 (0.7 KB) | 6 (2.9 KB) |

  People: still id and name only (`email` blank, `last_seen_at` null, no member rows); no person's e-mail anywhere in
  either snapshot. The new rows carry people only as ids (`created_by`, `updated_by`), as every other row does.
- **The figure** (`src/domain/document/figure.ts`, pure): the canvas's cards from `buildCards` (names or aliases as the
  canvas shows them), its frames (collapsed ones as blocks, their lines bundled by `bundleLines`), relationships with
  crow's foot or UML ends and their pills, mappings (`mapGeom`: the ƒ node, chips, status dashes), source keys,
  InfoCube's dimensional mappings (through `DocumentContributions.figures`, AD-33) and the requirement cards with their
  trace lines (D2), in the prototype's figure palette (`PAL`; black and white, F5). As on the canvas follows its hidden
  relationship kinds, not the layer switch (D6); Adjusted takes the rows, the line kinds ("Dimensional" while the level
  is drawn, D7) and the status marks; out of scope is left out (D3); no notes or label marks (C4). Words on a figure in
  the document's language (D11). Every model text escaped.
- **The page** (`src/domain/document/page.ts`): the papers and margins (18 mm, 20 mm at the bottom; the documents' CSS
  reads them from here now), the figure's box, the six sizes and three orientations, the turn of "as large as fits", the
  parts with their 16 px overlap, the editor's line (the prototype's `sumFig`; D4 as the prototype).
- **The content tree** (`content.ts`): the kind `figure` (`DocFigure`: its SVG, faces, parts, words, the editor's line),
  numbered in document order by `buildDocument` (F6), which also lists `figures` (number, caption, anchor, the editor's
  line); a paragraph may be a `placeholder`. Shared node builder: `figure-node.ts` (`figureNodes`, `figureName`).
- **In the pages and the quick sheet** (`document-html.tsx`, `ui/figure-images.ts`, `app/figure-fonts.ts`): each figure's
  SVG once in a hidden holder; in the browser it becomes one blob URL with IBM Plex's unmodified files embedded for the
  faces it uses (Q2), and each part's `<img>` shows its region (`#svgView(viewBox(…))`, Q3). The holders are taken out of
  the copy Paged.js lays out; the pages count as done once their images are decoded (print waits for them). The fonts are
  fetched once per page by their bundled URLs (`new URL(…, import.meta.url)`), so nothing new is served.
- **The Figure section** (`figure`, after Model overview in "+ Add section"): its figures, or "Add a figure in the panel
  on the right." in a dashed box; a new one starts on the same page (F7, `DocumentSectionKind.samePage`); heading
  "Figures" / "Rysunki" / "Abbildungen". The figure editor (`app/figure-editor.tsx`): In the document, Move up, Move down,
  Remove, the view, size, orientation, rows, line kinds, status marks, the caption (its draft kept, D-66), the line,
  "Canvas or frame to add" (the projects' canvases in tab order, then the rest, each followed by its frames) and "Add
  figure"; the whole list saved as one choice.
- **The recipe (F8).** A figure: `{ id, on, canvasId, frameId, view, rows, lines, status, size, orientation, caption }`,
  each with the prototype's default (`FIG0`), at most 50 per section ("A section holds at most 50 figures."). A figure
  added, or changed to another canvas or frame, must be of this workspace ("That canvas is not in this workspace."; the
  action reads the canvases and frames only for a save of figures). The style's `listOfFigures` (off) and `smallestPt`
  (6) read with their defaults through `upgradeDocument`; no file format. The list of figures and the style's two
  controls are drawn in step 3.
- **The side panels** (item 6, Q7): `app/panel-handles.tsx` and `ui/panels-cookie.ts`: drag, ←/→ 16 px, Shift 64 px,
  Home and a double-click to the default, bounds 200–480 and 280–560; a separator with `aria-valuenow`, `-valuemin`,
  `-valuemax` and `aria-controls`; the widths in the cookie `im-doc-panels.{user}` (`250.330`), which the editor's page
  reads, so the first paint has them; written to the element during a drag (no render per move); hidden up to 1,100 px.

### Assumed (say if not)

- A figure's caption is not drawn into the preview while it is typed (the Heading and Text are): the preview follows
  when the caption is saved.
- A frame's figure draws no requirement cards (the prototype's; only a whole canvas "As on the canvas" does).
- The editor's reference figures with figures (S26-10, F9) are measured in step 3, with Diagrams' figures in the presets.

### Checks

- `npm run lint`, `npm run typecheck`, `npm test` (2,248 tests, 180 files) pass. New unit tests:
  `tests/document-figures.test.ts`, `src/domain/document/page.test.ts`, `tests/document-figure-html.test.ts`.
- Slice 27's specs: S27-01, S27-02 (2 tests), S27-07, S27-08 (2 tests) pass locally.
- Slices 25 and 26: 46 passed, 8 skipped (the measuring specs). The thumbnails' and the moved code's canvas specs
  (slices 1a, 1b, 2c, 4b-2, 10a, 10b, 12b): 141 passed.
- **The element guard** on the measurement build (`S3B-15-elements` against `slice-08.json`): viewport 4,508 / 19,305 /
  1,465 / 4,907, page totals 6,137 / 20,934 / 3,004 / 6,446: slice 26's counts exactly.
- **The full run** (the move changes the canvas's layers; the snapshot the local adapter): workflow "E2E" run
  43647381268 on `703ef4a`, 12 min 25 s wall-clock: 793 passed, 0 failed, 0 flaky, 12 skipped, no expected failures.

  | Part | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
  | --- | --- | --- | --- | --- | --- | --- | --- | --- |
  | Time | 8.6 min | 8.9 min | 10.5 min | 7.8 min | 9.3 min | 8.2 min | 8.3 min | 9.6 min |
  | Heap peak | 1,365 MB | 1,419 MB | 927 MB | 1,214 MB | 1,521 MB | 1,277 MB | 1,433 MB | 1,258 MB |

  No server restarted (the runner's threshold is 6,431 MB).

## Step 3: sections, the star and the list of figures (15 November 2026)

Łukasz's answers to step 2's assumptions (15 November 2026): a frame's figure draws no requirement cards (as the
prototype), and the editor's timings move to this step: accepted. **The caption refreshes the preview while it is
typed**, as the Heading and Text do (D-81: about 500 ms after the last keystroke): done in this step.

### What was built

- **A section's figures, for every section** (`SectionBuildInput.figures`, `src/domain/document/figure-node.ts`,
  `sectionFigures`): `list` draws a section's stored figures (Diagrams' own notation, its warning size, the canvases'
  names before their figures), `placed` draws cards a section placed itself as a canvas in memory (the star). The kit
  is made by `buildDocument` in the document's words (`documentFigures`, InfoDocumenter's `figures.ts`), so a module's
  section draws figures without naming InfoDocumenter, and InfoDocumenter draws InfoCube's without naming InfoCube
  (AD-33). It is made when a section first draws a figure: a document without figures reads nothing for them. The
  figure entry and its schema moved to InfoMapper's domain (`src/domain/document/figure-entry.ts`), since InfoCube's
  section holds figures too.
- **Diagrams** (`diagrams`, after Model overview in "+ Add section"; "Diagrams" / "Diagramy" / "Diagramme"): its
  figures that are on, each canvas's name as a numbered subsection before its first figure (the prototype's `h3`), the
  legend under them ("Legend under the figures", on), "Notation" (Document's, Crow's foot, UML: its figures and its
  legend's first line), "Warn when names are smaller than" (Document's ({pt} pt), 5 to 8 pt: the figures' lines, in
  place of the style's); "Tick or add a figure in the panel on the right." while none is on. **Its figures are made with
  the section** (D9): one whole canvas each, as on the canvas, per canvas of the document's scope (the chosen projects',
  or every project's; the projects in the order they were made, each project's canvases in tab order, a shared canvas
  once: `diagramCanvases`), by "+ Add section" (the action reads the projects and their links) and by New document;
  later scope changes leave them. **The legend** is a node of the content tree (`legend`: its title, its marks and
  words), drawn as small inline SVG samples by React (the prototype's `legend`): the relationship in the section's
  notation ("Relationship (UML multiplicities)" with UML, step 1's proposal), the mappings by status, the ƒ rule, the
  dimensional mapping while that level is drawn, the source key, the rows' dots; black and white with the style's.
- **Model overview's figures** ("Figures (e.g. the logical data model)") and "Where the figures go": "Below the
  section's content" (default) or "Right after the description".
- **The Data dictionary's concept frame**: "Figure of the concept's frame at its start (from the first canvas that has
  one)" under "Group by concept" (off by default): the first concept frame of the concept on the scope's canvases in
  their order, as on the canvas, after the concept's heading.
- **The star diagram** (InfoCube, `src/modules/infocube/domain/star.ts`, `starLayout`): per fact, after its type and
  grain, before its Dimensions, of its dimensions in scope (each once, a role-playing dimension once with both role
  pills); the prototype's rule (up to 6 left and right in turn, more above and below too; the fact 260 px with all its
  rows, the dimensions 220 px with their keys or all attributes; columns 100 px from the fact and 30 px apart, rows
  70 px and 40 px), the cards' heights the canvas's (`cardHeightFor`, F11). Drawn through `figures.placed`
  (relationships with their pills, no status marks). Caption "Star schema of {fact}", and beyond "Dimensions drawn per
  star, at most" (6, 8, 12 default, 16, 24) " ({a} of {b} dimensions shown; all are in the table below)", in the three
  languages. The options: "Star diagram, drawn from the model (no canvas needed)", "Dimension cards in the star", "Size
  of the star diagrams" (the six sizes and three orientations), the limit with its hint, each fact's line ("{fact}:
  {line}"), and "Figures from canvases" at the section's start. **A module's options as plain fields** (`optionFields`,
  `SectionOptionField`: check, segments, select, group label, hint, a figure editor, a placed figure's size and the
  placed figures' lines, each with `when`), drawn by the editor's `ModuleOptions`; `optionChecks` reads as check boxes.
- **Numbering and the list of figures** (F6, D10): figures numbered in document order whatever section drew them, each
  key unique in the document (`{section}:{figure}`); with the style's "List of figures" (between Contents and Numbered
  sections) and a figure drawn, "List of figures" on its own sheet after the contents, one line per figure with its
  number, caption and page (the contents' `target-counter`), no page numbers on the quick sheet.
- **The smallest names** in the Style panel: "Smallest attribute names in diagrams" 5, 6, 7, 8 pt with the prototype's
  hint (D1); as D4 (a): a figure is never drawn larger, its line warns.
- **The caption's draft** in the preview (`fig:{section}:{figure}`, `ui/drafts.ts`).
- **The presets** (the figure sections slice 26 left out): the business dictionary gets **Diagrams** after Conventions,
  adjusted (keys only, relationships only, no status marks); the ETL specification gets **Diagrams** after
  Conventions, as on the canvas; their descriptions are the prototype's again ("…, with key-only diagrams. No technical
  mapping detail."; "…; source tables; full diagrams with mapping lines."). Not here: the sign-off preset (with
  baselines), its Overview figure "Logical data model" and Changes since a baseline. The demo's three documents get
  their presets' Diagrams with the scope's canvases (the S2T: Order management's).
- **Words** (D11): "(canvas no longer exists)", "(frame no longer exists)", "in {concept}" and the roles were in three
  languages since step 2; step 3 adds "Diagrams", "List of figures", "Legend", the legend's lines, the star's caption
  and note. **German for Łukasz's review:** "Diagramme", "Abbildungsverzeichnis", "Legende", the legend's lines
  (`labels.ts`), "Sternschema von {n}", "{a} von {b} Dimensionen gezeigt; alle stehen in der Tabelle darunter"
  (`document-words.ts`), "Beziehung (UML-Multiplizitäten)".
- **A defect of slice 26 fixed here** (InfoDocumenter's own CSS, not shared infrastructure): on the editor's quick sheet
  the contents showed "0" for every page number, since Paged.js rewrites the pages' `target-counter()` rule for the
  whole document. The list of figures would show the same, so `quickSheetCss` now hides them there (D10: no page numbers
  on the quick sheet, as the contents); S27-06 checks both.

### Assumed (say if not)

- **D4 (a) and S27-06.** The PRD's criterion "text never under the chosen size" is checked as your answer to D4 makes
  it: a figure is never drawn larger; its line in the editor says " · smaller than {pt} pt: try one figure per frame, A3
  paper, or the page outline on the canvas", and "as large as fits" turns a figure when that helps. The style's hint
  stays the prototype's ("A canvas that would be smaller at page width is split into parts."), which is true of "Page
  width, in parts" only.
- **Diagrams' warning size** is read by the figures' lines only (the prototype stores it and reads nothing); the turn
  of "as large as fits" follows the style's smallest names, as the prototype's.
- **The scope's canvases** (D9, the concept frame): the projects in the order they were made; a canvas in no project
  is not in a scope (as the document's scope, slice 25), so Diagrams never makes its figure; "Canvas or frame to add"
  still offers it.
- **A legend's page.** The legend is kept whole (the prototype's `break-inside: avoid`); after a figure that fills a
  page it stands alone at the top of the next.
- **The star's lines** run as on a canvas (`relGeom`): a dimension's relationship meets the fact on the side the
  canvas's rule picks, so on the star the left dimensions' lines may reach the fact's top corner.

### Reference figures (Q3, F9; no bar)

The longest preset with Diagrams: the business dictionary, its Diagrams made from the scope's canvases as New document
makes them (keys only, relationships only), every mapping shown; beside it the same document with Diagrams' figures
taken out. **In the browser** (`e2e/slice-27/S27-10-figures.spec.ts`, measurement build, headless Chromium 153, 5 loads
after a warm-up, medians):

| Data set | Figures | Pages | Snapshot (decoded) | State | Tree | First layout | After a change, Auto shows |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Demo | 3 | 17 | 197,953 B | 1.1 ms | 7.9 ms | 393 ms | the pages |
| Demo, no figures | 0 | 14 | 197,953 B | 1.6 ms | 3.6 ms | 297 ms | the pages |
| Performance test | 3 | 41 | 2,305,438 B | 3.4 ms | 54.2 ms | 1,342 ms | the quick sheet |
| Performance test, no figures | 0 | 39 | 2,305,438 B | 2.7 ms | 3.8 ms | 1,333 ms | the quick sheet |

**In Node** (`scripts/s27-measure/bench-figures.ts`, 9 rounds after a warm-up, medians): Performance test (236 cards on
3 canvases): the tree 29.4 ms with figures, 1.2 ms without (the figures 28.2 ms; their SVGs 96.3, 21.5 and 96.3 KB);
the demo: 3.8 ms against 0.5 ms (3.3 ms; 8.5, 5.3 and 17.2 KB).

**Auto's threshold behaves as in slice 26.** The demo's layout stays well under 1,000 ms with its figures (+96 ms for
three figures), so Auto keeps laying out pages. "Performance test"'s dictionary was over the threshold before figures
(1,333 ms), so Auto shows the quick sheet after a change with or without them; the figures add 9 ms there, as their
images are decoded once per figure. The threshold stays 1,000 ms (your answer to Q3).

### Checks

- `npm run lint`, `npm run typecheck`, `npm test` (2,263 tests, 181 files) pass. New unit tests:
  `tests/document-figures-3.test.ts` (14), and one in `src/modules/infodocumenter/domain/documents.test.ts`.
- Slice 27's specs: S27-01 to S27-08 pass locally (S27-03, S27-04 (2), S27-05 (2), S27-06 (2) new).
- Slices 25 and 26, after the changes below: 53 passed and 8 skipped (the measuring specs) in one run with slice 27;
  the six that failed on the presets' new Diagrams were changed and pass (15 passed).
- **Earlier specs changed, with their reason** (the presets' Diagrams, the Dimensional model's line):
  - `e2e/slice-25/S25-03`: the dictionary preset has Diagrams after Conventions (8 sections), the S2T's too;
  - `e2e/slice-25/S25-06`: the S2T's sections with Diagrams;
  - `e2e/slice-25/S25-07`: the contents list Diagrams (its page numbers still match);
  - `e2e/slice-25/S25-08`: "Diagramy" and "Diagramme" in the Polish and German headings;
  - `e2e/slice-26/S26-01`: the Dimensional model's line in "+ Add section" is the prototype's again;
  - unit tests `tests/infodocumenter-store.test.ts` and `documents.test.ts`: the kinds' order and the presets.
- **The element guard** on the measurement build (`S3B-15-elements` against `slice-08.json`): viewport 4,508 / 19,305 /
  1,465 / 4,907, page totals 6,137 / 20,934 / 3,004 / 6,446: unchanged.
- **No full run in this step:** it changes no shared infrastructure (no undo, save chain, canvas layer, table registry
  or local adapter code; the demo's documents and the content tree are InfoDocumenter's and the document domain's).
  Step 4 and the closing have theirs.

## Step 4: the page outline on the canvas (15 November 2026)

### Step 3's assumptions, as Łukasz answered (15 November 2026)

- **The style's hint for the smallest names** is now true of D4 (a): "A figure whose names come out smaller shows a
  warning in its line; “Whole, as large as fits” turns it on the page when that makes them larger." The example in the
  answer ("'Page width, in parts' uses this size to choose how many parts") would not be true: with D4 (a), "Page width,
  in parts" draws at the page's width whatever the smallest names are (`figureLayout`); the size is read only by the
  warning and by the turn of "as large as fits".
- **Diagrams' warning size** for the warning lines only, and **the legend never split**: accepted, unchanged.
- **A canvas in no project:** with no project ticked ("the whole model"), Diagrams also makes figures of the canvases in
  no project, after the projects' canvases (`diagramCanvases`'s last argument; New document, "+ Add section" and the
  demo). A canvas in no project has no tab, so they come **in the order they were made**. With no project ticked the
  document's scope holds every live canvas (`SectionScope.canvasIds`), so the Data dictionary's concept frame may come
  from such a canvas too; the entities and source tables in scope do not change (they read the canvases only with a
  project ticked). Checked by `tests/document-figures-3.test.ts` and S27-04 (a canvas in no project comes last).

### What was built

- **The look's key** (Q6): `CanvasLook.pageOutline` (`{ paper: "A4" | "A3", orientation: "portrait" | "landscape", pt:
  6 | 7 | 8 }`), present only while on, so a look stored earlier and the column's SQL default read as off: **no change of
  the local file's format**. `applyLookPatch` takes `pageOutline` (null for off) and keeps it through every other patch
  (Show all's too); `sameLook` compares it (`sameOutline`); `setCanvasLook`'s input checks it (`strict`, the prototype's
  values only); "Use this look on all canvases" still copies background and grid only. Not an undo step, as the look.
- **The extension point:** `ModuleView.pageOutline` (`src/ui/modules.ts`), set by `moduleView` (`src/compose/view.ts`)
  while InfoDocumenter is on; the canvas page hands it to `CanvasLookProvider` (`outlines`). The key, the control and
  the layer are InfoMapper's; InfoMapper's code does not name InfoDocumenter. While InfoDocumenter is off the control is
  not there and nothing is drawn, though the look keeps its key.
- **The control** (`PageOutlineControls`, `src/canvas/look.tsx`) under "Canvas look" in the canvas's panel, for those
  who may change the look (as its other controls): "Page outline for documentation" with Off, A4, A3; while on,
  Portrait, Landscape and 6 pt, 7 pt, 8 pt, and "Keep the cards inside page 1 and this canvas prints whole, with
  attribute names at least {pt} pt." Turned on, it starts at portrait, 7 pt (the prototype's).
- **The layer** (`src/canvas/PageOutline.tsx`), behind the frames (z −2 beside `FrameLayer`'s −1): the pages a whole
  canvas takes, from InfoMapper's page geometry (`outlinePages`, `outlineLabel`, `src/domain/document/page.ts`: the
  figure's room on such a page, upright, at the scale that draws the names at the chosen size), laid from the figure's
  box (`figureBoxOf`, now shared with the figure builder). Page 1 "{A4} {landscape} at {7} pt · fits on one page" (green)
  or "… · needs {n} pages: move cards into page 1 to keep it whole" (blue), the others "page {n}" (orange, thinner), as
  the prototype's. **It counts what a figure "As on the canvas" draws** (Q6): the cards shown, the expanded frames
  holding a card with their name strip, the collapsed frames' blocks and the requirement cards; never notes. **Off: no
  element** (the layer is not mounted). On: the layer and one element per page, its label a `::before`.
- **Following the cards:** the layer reads the cards' places from React Flow's store, worked out again only when the
  nodes change (never on a pan or a zoom), and keeps its pages while a card is dragged: they follow the drop. It never
  re-renders `ModelCanvas` (it is mounted beside the frames and subscribes itself).
- **Never on a figure or a thumbnail:** the figure builder and the thumbnail route do not read the key.

### Assumed (say if not)

- **Who changes it:** those who may change the canvas's look (owners, admins, modelers), as its other controls; readers
  and reviewers see the outline but have no control (the prototype's "for everyone" is about who sees it).
- **Off forgets the orientation and size** (the key is present only while on, your answer to Q6): turned on again, it
  starts at portrait, 7 pt, as the prototype's first time.
- **The labels scale with the zoom** (13 px on the canvas, as the prototype's), unlike the frames' names.
- **A frame's drag** moves the frame and its cards without React Flow's drag flag, so the outline follows it as it
  moves; a card's drag keeps the pages until the drop.

### Checks

- `npm run lint`, `npm run typecheck`, `npm test` (2,269 tests, 181 files) pass. New unit tests: the look's key
  (`canvas-look.test.ts`), the command (`canvas.test.ts`), the pages, labels and the figure's box (`page.test.ts`), the
  canvases in no project (`document-figures-3.test.ts`).
- **S27-09** (3 tests): the choices, the stored key, the pages and labels, off with no element, kept after a reload;
  the outline follows a drop and not a drag, a note moved far away changes nothing; the figure and the thumbnail of
  the canvas are the same byte for byte with the outline on; with InfoDocumenter off no control and no outline.
- Locally, S25, S26, S27, slice 16 (the look's kinds and Show all), slice 14b (the look on the save chain), slice 12b
  (thumbnails) and the commit counters (S2C-12, S3A-14-idle, S3B-15-idle): 119 passed, 13 skipped (measuring specs).
- **The element guard** on the measurement build (`S3B-15-elements` against `slice-08.json`), InfoDocumenter off: viewport
  4,508 / 19,305 / 1,465 / 4,907, page totals 6,137 / 20,934 / 3,004 / 6,446: unchanged. **With InfoDocumenter on**
  (`e2e/slice-27/S27-09-elements.spec.ts`, the same four views):

  | View | Outline off: viewport | On (A4 landscape, 7 pt): viewport | Pages | Page total off / on |
  | --- | --- | --- | --- | --- |
  | 30 %, expanded | 4,508 | 4,569 | 60 | 6,143 / 6,213 |
  | 100 %, expanded | 19,305 | 19,366 | 60 | 20,940 / 21,010 |
  | 30 %, collapsed | 1,465 | 1,526 | 60 | 3,010 / 3,080 |
  | 100 %, collapsed | 4,907 | 4,968 | 60 | 6,452 / 6,522 |

  Off, the viewport equals the baseline; the page total is 6 higher with InfoDocumenter on: the control in the panel
  (outside the canvas). On: the layer and one element per page (+61; "Performance test" takes 60 A4 landscape pages at
  7 pt), the spec checks that sum.
- **The full run** (the canvas page's layers): workflow "E2E" run 43696491179 on `a212c64`, 14 min 32 s wall-clock:
  803 passed, 0 failed, 0 flaky, 16 skipped (S27-10's four measuring tests are new among them), no expected failures.

  | Part | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
  | --- | --- | --- | --- | --- | --- | --- | --- | --- |
  | Time | 9.8 min | 12.4 min | 10.8 min | 10.2 min | 11.5 min | 7.6 min | 12.9 min | 9.6 min |
  | Heap peak | 1,343 MB | 993 MB | 851 MB | 1,040 MB | 1,147 MB | 1,421 MB | 1,066 MB | 1,836 MB |

  No server restarted (threshold 6,431 MB). **Part 8's peak, 1,836 MB, is near the 2 GB at which CLAUDE.md says to add
  a ninth part** (it was 1,258 MB in step 2's run; slices 25 to 27's document specs are there). Not changed here: e2e
  parts are shared infrastructure, a `chore` of its own; the recut rule does not apply (part 7 is the longest).

## Step 5: the closing (15 November 2026)

Łukasz's answers to step 4 (15 November 2026): the style's hint as worded in step 4 (his example was not true); the
outline changed only by those who may change the look, its settings forgotten when it is turned off, its labels scaling
with the zoom, following a frame while dragged and a card only on drop: all accepted.

### Decisions

- **D-82** (new): InfoDocumenter: figures (slice 27), written from what the slice built. It **amends D-81**: the editor's
  snapshot holds the canvases, frames, labels and label links (never notes; people still id and name only); the presets
  have their Diagrams; figures are no longer later; the quick sheet shows no page numbers in the contents. D-81 is marked
  "(Changed by D-82.)".
- **AD-19**, a note (slice 27): the canvas's pure drawing rules live in `domain` (`src/domain/canvas/`), re-exported by
  the canvas; `@/domain/canvas/…` inside the domain.
- **AD-33**, a note (slice 27): the extension points the slice added (the sections' figure kit, a module's figure
  contributions, a module's options as plain fields, the page outline offered through `ModuleView`).
- **AD-32 is not amended:** the thumbnails keep their route and their own drawing; figures are built in the page from the
  editor's snapshot (the editor) or the page's read (the document page), not fetched from a route, and the outline never
  reaches a thumbnail. **AD-18** needs no note: the look was JSON already, and the recipe's JSON (slice 25's note) takes
  the new options.

The texts are quoted in full in the step's report for Łukasz's approval; D-82 says "Proposed on 15 November 2026 for
Łukasz's approval" until he approves it.

### Docs

`docs/decisions.md` (D-82, the notes to AD-19 and AD-33, D-81 marked), `docs/data-model-v2.md` (`canvas.look`'s
`pageOutline`, the recipe's `listOfFigures`, `smallestPt` and the sections' figure options), `docs/inventory-prototype-vs-
app.md` (slice 27's prototype; figures, the star, the list of figures, the smallest names, the page outline and the side
panels present; the deliberate differences), `README.md` (slice 27, its acceptance), `CLAUDE.md` (the status,
`src/domain/canvas/` and its import rule, the figures' extension points, the page outline, the commands, slice 27's
helpers), `docs/known-limitations.md` (InfoDocumenter, slices 25 to 27: a figure's fonts, never drawn larger, the outline's
settings and following, part 8's heap), `docs/ideas.md` (InfoDocumenter: done in slice 27; "Later, noted": the canvas
page's resizable side panels, the outline remembering its settings; the German words of slices 25 to 27 still awaiting
Łukasz's review; part 8).

### The measuring files

Kept, committed: `scripts/bench-figures.ts` (on demand, `npx tsx scripts/bench-figures.ts`, as `bench-documents.ts`:
the dictionary preset with Diagrams' figures, the figures' share of the tree, their SVGs' size; no bar). The browser's
measurements were committed in steps 3 and 4 as specs skipped unless `MEASURE=1`: `e2e/slice-27/S27-10-figures.spec.ts`
and `e2e/slice-27/S27-09-elements.spec.ts`. Deleted: the rest of `scripts/s27-measure/` (step 1's probes and drafts,
the screenshot and preparation scripts of steps 2 to 4). Nothing stays uncommitted.

### Manual acceptance (PRD section 6)

**On the demo** (`npm run demo -- --reset`, http://127.0.0.1:3001; nothing of KB is read or written):
1. Sign in as Łukasz. In Retail Co – DWH open Documentation, New document, "Data dictionary for the business": it has
   Diagrams after Conventions, one figure per canvas of the workspace (the projects' canvases in tab order), adjusted
   to keys and relationships. In the editor the right panel's handles resize the side panels; reload: the widths stay.
2. Select Diagrams: the canvases' names stand before their figures, the legend under them; set Notation to UML (the
   figures' ends and the legend change); untick a figure (it leaves, the next is renumbered).
3. Add a Figure section ("+ Add section", Figure); add "Customer & orders" whole, then one of its frames (draw a frame
   on the canvas first if it has none); for each, try the six sizes and the three orientations; type a caption and see
   the preview follow about half a second after the last key.
4. Style: List of figures on; Smallest attribute names 8 pt: the lines of figures with smaller names warn.
5. Open "Order management – S2T for the ETL team": the Dimensional model shows a star per fact (Fact Orders, Fact
   Sales) after the type and grain; set "Dimensions drawn per star, at most" and "Dimension cards in the star".
6. Open the document page (`/view`): the list of figures after the contents, its page numbers the figures' pages;
   print to PDF (Chrome, "Save as PDF"): the figures are sharp, their text is IBM Plex and can be searched and copied.
7. A canvas: with nothing selected, Canvas look in the right panel, "Page outline for documentation": A4, Landscape,
   7 pt: dashed pages behind the cards, page 1 labelled; drag a card past page 1: the outline grows on the drop; Off:
   the outline goes. A thumbnail on the project home shows no outline.
8. Settings: turn InfoDocumenter off: the canvas's control and outline go; turn it on again.

**On KB (Kanton Basel), with Łukasz** (only Łukasz writes to KB, in the app; I read nothing of it):
9. Back up `.data/dev-db.json` first (CLAUDE.md, "Łukasz's test model"). KB's file needs no format upgrade for slice 27.
   If KB's organization has no InfoDocumenter licence or its workspace's switch is off, Łukasz grants and switches it on
   himself (`npx tsx scripts/licence.ts grant "<organization>" infodoc`, then the settings).
10. In Kanton Basel: a dictionary from the business preset (its Diagrams from KB's canvases), a whole canvas and a frame
    in each size, the list of figures on, a PDF; a star diagram if KB has InfoCube's facts; the page outline on a KB
    canvas in A4 and A3, portrait and landscape.

### The full run on the final commit

Workflow "E2E" run 43698544457 on `03a7cba` (the closing's commit), 14 min 36 s wall-clock: 803 passed, 0 failed, 0
flaky, 16 skipped, no expected failures; no server restarted (threshold 6,431 MB).

| Part | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Time | 12.8 min | 9.6 min | 7.1 min | 10.2 min | 10.2 min | 7.7 min | 10.7 min | 11.1 min |
| Heap peak | 1,106 MB | 1,193 MB | 1,318 MB | 1,131 MB | 1,423 MB | 1,460 MB | 1,055 MB | 1,603 MB |

Part 8's peak, 1,603 MB, is under 1.95 GB (1,836 MB in step 4's run): no ninth part is due now. Commits after the
tested one change Markdown files in `docs/` only (`git diff --stat 03a7cba..HEAD`).
