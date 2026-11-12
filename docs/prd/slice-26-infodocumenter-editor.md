# Slice 26 – InfoDocumenter: the editor with a live preview, all sections without figures, the style

Status: **proposed** (Łukasz, 12 November 2026). **Full path** (CLAUDE.md, "The slice cycle", 2): the stored recipe's
shape changes, new section builders read the model's rules, the editor replaces slice 25's form. Branch
`slice/26-infodocumenter-editor`, from `main` (tag `slice-25`, `1f7cb28` or later). PRD file:
`docs/prd/slice-26-infodocumenter-editor.md`; step 1 writes `docs/prd/slice-26-acceptance.md`. Test regime: CLAUDE.md,
"Testing".

Written from the docs after slice 25 (D-80) and the prototype changed for this slice, which Łukasz accepted on
12 November 2026, **without reading the code**. **The prototype is the source of truth for behaviour; where this PRD and
the prototype differ, ask.** The plan beyond this slice is in `infodocumenter-roadmap.md` (section 9).

## 1. Why

Slice 25 laid the foundations (module, rights, recipes, one snapshot, the content tree, Paged.js, three languages) and
gave a form with four sections. The prototype has the whole editing of a document: sections added, removed and
reordered, each with its options, a preview that shows the pages while one edits, fourteen kinds of section and a style.
Teams write documents by trying: a section on, a column off, a look at the page. Without the preview and the sections,
InfoDocumenter cannot replace the hand-made documents it is meant to replace.

Decisions taken with Łukasz (12 November 2026):
- **1 (option 2).** This slice brings **the whole editing of the prototype, without figures, versions and logos**: the
  editor, every section that draws no figure, the style. Figures are slice C, versions, links and logos slice D.
- **2 (P1 b).** **The prototype's editor** replaces slice 25's form at `/w/{ws}/d/{id}`: sections on the left, the
  preview in the middle, the options on the right.
- **3 (P2 d).** **The preview is adaptive.** A mode switch with **Auto** (the default), **Exact pages** and **Quick
  preview**. Auto lays out real pages (Paged.js) after each change while the last layout took less than a threshold
  (about 1 s; step 1 sets it by measuring); above it the quick sheet shows at once with "Pages out of date: this
  document took {s} s to lay out, so the preview shows the quick sheet while you edit." and **Update pages**. Exact
  always lays out real pages; Quick never does.
- **4 (P3).** The **quick sheet** is the same renderer and CSS as the pages: page width, one sheet per page break (a
  section that starts a new page starts a new sheet), the title page, the watermark, contents without page numbers.
- **5 (P4).** The preview refreshes about **500 ms after the last keystroke**; the latest change wins; the old pages stay
  visible until the new ones are laid out; a layout still running is dropped when the quick sheet takes over.
- **6 (P5).** A section clicked on the left scrolls the preview to it and marks it; a click in the preview selects its
  section.
- **7 (P6).** **No cache** of the content tree: it is rebuilt on each change (12.8 ms for "Performance test", slice 25).
- **8 (Q6, decided).** The **Data dictionary lists dimensional entities** when the model has them and the dimensional
  level is in scope, as the prototype does: with their InfoCube role instead of a stereotype and each attribute's feed,
  through InfoCube's contributions to the dictionary (the extension point; InfoDocumenter never names InfoCube). This
  changes slice 25's rule that the dictionary covers the logical level only.
- **9 (Q8, decided).** **A document has its own language** (English, Polish, German), defaulting to the workspace's
  documentation language; a recipe stored before this slice uses the workspace's. This amends D-80.
- **Assumptions to check in step 1:** Paged.js lays out the whole document on each call (no partial layout), and it
  runs on the main thread, so a long layout may hold up typing (Q3).

## 2. What to build

### The editor (`/w/{ws}/d/{id}`)

As the prototype's editor, top to bottom:
- **Top bar:** "← Documentation", the document's name (editable), "Shared" or "Private", "Read only" when the person may
  not change it, the "Laying out pages…" / "{n} pages" indicator, the preview mode (Auto, Exact pages, Quick preview),
  the zoom (Fit width, 75 %, 100 %), **Print / PDF**. Not in this slice: "Generate version" (slice D).
- **Left:** "Document" (model state, scope, style, cover) and the **sections**: each with its on/off box, its name
  (double-click to rename: the section's heading), up and down, remove; **+ Add section** with the section types this
  workspace can use (a module's type is listed with the module's name and disabled while the module is off, "{module} is
  off in this workspace.").
- **Middle:** the preview (section 1, items 3 to 6), with the notes on skipped sections.
- **Right:** the options of what is selected. For "Document": model state (shown as text: "Live model (changes as people
  work)"; baselines come later), scope, sharing and audience, the style (below), the title page. For a section: its
  heading, "Start on a new page" and its options.
- A member without the right to change the document sees everything read only, with "Duplicate as my document".
- Every change saves as slice 25's form does (each part with the row's version, D-59, a change event, outside undo).

### Sections

Slice 25's four (Text, Data dictionary, Source-to-target mapping, InfoCube's Dimensional model) plus, as the prototype
draws them without figures:

| Type | Section | Reads (through the app's existing rules) |
| --- | --- | --- |
| `overview` | Model overview | the counts of the model in scope, by concept; what is on no canvas |
| `ready` | Model readiness | the model checks (D-75) in scope and the definition's own checks (definitions missing or weak, attributes not fed, type problems, mappings not approved, requirements not covered, facts without grain) |
| `conv` | Conventions and notation | relationship notation, mapping statuses, marks, entity stereotypes in use (D-79), classifications in use (D-78), physical and logical types found in the sources, naming conventions, four-eyes |
| `sources` | Source tables | tables and columns with their classifications, notes, missing or retired columns, the Data Vault reading when on |
| `classreg` | Classification register | each classification in use with its definition and where it is used; logical attributes with personal data |
| `reqs` | Requirements and coverage | requirements with their descriptions, kind, priority and coverage |
| `trace` | Traceability | each requirement's elements and what feeds them |
| `dq` | Data quality rules | the DQ requirements with expression, severity, owner, what they apply to |
| `cube.bus` | Bus matrix (InfoCube) | facts against dimensions, the conformed ones |

The Data dictionary lists dimensional entities as item 8 says, and gets the prototype's **three layouts** (long texts under the row, after the table, in a column)
and "long definitions at the end". Every section gets a heading and "Start on a new page" (default on).

Not in this slice: Diagrams, Figure, the star diagram in the Dimensional model (slice C), Changes since a baseline
(after the baselines slice).

### Style

As the prototype's "Style" panel, without what needs figures or files:
- **Language of the document** (English, Polish, German), defaulting to the workspace's documentation language (item 9).
- **Template:** Standard (sans serif, each section on a new page), Formal (serif body text, ruled title page: IBM Plex
  Serif comes back, hosted as slice 25 step 4 did), Compact (smaller type, banded tables, sections run on).
- **Accent colour**, **Colours** (colour, black and white), **Paper** (A4, A3), **Orientation** (portrait, landscape),
  **Relationship notation** (crow's foot, UML) as the tables and the conventions print it.
- **Keep a table on one page up to** (never, 10, 15, 25, 40 rows).
- Switches: title page, contents, numbered sections and subsections, banded table rows, running header, "Draft" mark
  when from the live model.
- **Header and footer:** the prototype's fields with their tokens ({org}, {title}, {client}, {workspace}, {version},
  {status}, {state}, {date}, {author}, {page}, {pages}, {pagelabel}) and its rules where {page} may stand.
- Not in this slice: logos and "also in the page header" (slice D, file storage), the smallest attribute names in
  diagrams and the list of figures (slice C).

### Presets

The three presets of slice 25 get the prototype's sections that this slice has (the dictionary preset: overview,
conventions, dictionary, classification register; the S2T preset: readiness, S2T, sources, dimensional model, bus
matrix when InfoCube is on; Blank: title page and text). Step 1 lists them against the prototype's presets.

### The document page (`/view`) and print

The page and print use the style: paper, orientation, template, header and footer, numbering, keep-rows. The
watermark follows the style's switch.

## 3. Data model

- `document_definition` gets **`style`** jsonb (no null; the defaults for a recipe stored before this slice) and the
  section entries get `heading`, `new_page` and their options per type. Recipes stored before this slice are read with
  the defaults (step 1: a module row upgrade or defaults, as AD-33's TableRules allow; no change to the local file's
  format if none is needed).
- The AD-18 note of slice 25 (the recipe) gets `style`.
- No new table.

## 4. Sources

- **Prototype:** `docs/prototype/infomapper-prototype-with-sources.html`, replaced by the version Łukasz accepted
  (951,539 bytes, SHA-256 `7a06cb13d8bb71e0f2eb54dfaa624deb605c364f324132936b1fd2e0dd3ddfc0`), built on slice 25's
  (950,304 bytes, `f58ec6bb…`). Its one change: the adaptive preview (the mode switch Auto, Exact pages, Quick preview;
  the layout timed; "Pages out of date" with "Update pages"; 500 ms after the last keystroke; a running layout dropped
  when the quick sheet takes over). `window.__docLayoutMs` is a prototype-only hook for testing the threshold.
  - Everything else of the editor, the sections and the style was already in the prototype (slice 22's documentation
    module, carried onto slice 24's in slice 25's step "prototype").
  - **What the prototype shows beyond this slice** (figures, versions, links, logos, baselines as a source, "Generate
    version", "act as") is later, not a difference to report.
  - **Prototype storage is not the app's model:** the prototype keeps definitions in `w.docs` and its own section
    objects; the app keeps slice 25's table with section 3's additions.
- **Decisions:** D-80 and slice 25's notes to AD-05, AD-18, AD-33, AD-35; AD-12, AD-19, D-59, D-75, D-77, D-78, D-79.
- **Slice 25:** `docs/prd/slice-25-infodocumenter-documents.md`, `docs/prd/slice-25-acceptance.md` (F28 and F29 on
  Paged.js and print), `docs/known-limitations.md` ("Laying out a large document takes seconds").
- **The roadmap:** `infodocumenter-roadmap.md` (Łukasz's file, given with this PRD).

## 5. Steps

Stop after each step; wait for Łukasz.

1. **Reconnaissance, check and measurement.** Answer Q1–Q10 in `slice-26-acceptance.md`; every place where the PRD is
   wrong, differs from the code, a decision or the prototype, or costs more than it assumes, with a proposal; every new
   UI text; the earlier specs and fixtures each step touches; the plan for steps 2 to 5. **Measure** (Q3) on the
   current document page, in headless Chromium, on "Performance test" and the demo. Copy the prototype, the PRD and the
   roadmap. No application code.
2. **The editor and the preview** with slice 25's four sections: the three panels, the sections' management, the
   preview modes and their rules, the sync, the recipe's new fields and their defaults, the domain's commands for them.
3. **The sections** of section 2's table, their builders in the content tree (through the app's rules, never copies,
   and InfoCube's through the extension point), the dictionary's layouts, the presets.
4. **The style:** the style panel, the templates, the header and footer fields, the document page and print with the
   style.
5. **Close.** The docs and the decisions quoted for approval (section 8); the roadmap moved into `docs/ideas.md`; one
   full run on the final commit. Stop with the manual acceptance steps. Merge and tag `slice-26` only on Łukasz's
   command.

Step 1 says whether a full run is needed in step 2 (it is if the recipe's upgrade touches shared infrastructure).

## 6. Acceptance criteria

Tests in `e2e/slice-26/`, one file per criterion, fresh seed each.

| ID | Criterion |
| --- | --- |
| S26-01 | **Editor.** The three panels; a section added, renamed, moved, turned off and removed, each saved with a version and a change event, none an undo step; a module's section type disabled while the module is off; read only for a member who may not change the document, with "Duplicate as my document". |
| S26-02 | **Preview modes.** Auto on the demo lays out pages after a change; with the threshold below the last layout's time, a change shows the quick sheet with "Pages out of date" and Update pages lays out the pages; Exact always lays them out; Quick never does; the old pages stay until the new ones are in. |
| S26-03 | **Refresh and sync.** Typing in a field refreshes once, about 500 ms after the last keystroke; a section clicked on the left scrolls the preview to it; a click in the preview selects the section. |
| S26-04 | **Overview, readiness, conventions.** On the demo, each with its content in scope; readiness lists the model checks and the definition's checks; conventions name the workspace's stereotypes and classifications. |
| S26-05 | **Sources and classification register.** Classifications, notes, missing and retired columns, the Data Vault reading when on; the register's uses and the attributes with personal data. |
| S26-06 | **Requirements, traceability, data quality, bus matrix.** Each on the demo; the bus matrix only while InfoCube is on. |
| S26-07 | **Dictionary layouts and dimensional entities.** Under the row, after the table, in a column; long definitions at the end; with InfoCube on and the dimensional level in scope, the demo's facts and dimensions with their role and feeds; with InfoCube off or the level out of scope, none. |
| S26-08 | **Style.** Template, accent, colours, paper and orientation, numbering, banded rows, keep-rows, running header, the watermark switch, header and footer fields with {page} and {pages}; the document page and print follow them (page size and orientation checked with print media emulation). |
| S26-09 | **Language.** A document in German in a Polish workspace; a recipe from slice 25 opens in the workspace's language. |
| S26-10 | **Content tree.** Unit tests for each new section and layout on the demo, in three languages; no section reads a store; reference figures for the tree and the layout on "Performance test". |
| S26-11 | CI, the full run before the merge (and one in step 2 if step 1 says so); the element guard; every earlier test changed, with its reason. |

**Manual acceptance (demo):** a document made from the dictionary preset, sections added and reordered, the preview
in Auto while typing, the quick sheet with "Update pages" on a large document, a Formal template in landscape A3, a PDF
from the browser's print. KB only if the local file's format changes and only on Łukasz's command, after the backup.

## 7. Questions for step 1

- **Q1. The editor's place.** The editor replacing slice 25's form at `/w/{ws}/d/{id}`: what of the form's components,
  actions and specs stays; slice 25's specs that change (S25-03 and others), each with its reason.
- **Q2. The recipe.** `style` and the sections' new fields: jsonb shape, the domain's schemas per section kind, the
  defaults for slice 25's stored recipes (row upgrade or defaults), whether the local file's format changes.
- **Q3. Measurement.** On the document page as it is: Paged.js's layout time and the main thread's long tasks (the
  longest, their total) during layout, for "Performance test"'s full dictionary and the demo's documents; whether
  Paged.js can lay out only part of a document. Propose the Auto threshold from the figures. Does a layout in the
  editor hold up typing? If it does, propose how (the threshold, an idle callback, a worker if Paged.js allows).
- **Q4. Paged.js in the editor.** Several layouts in one page (the preview replaced on each change): the polisher's
  styles and their removal, memory over many changes, the CSS isolation slice 25 used (`Previewer.preview(html, [css],
  container)`), the zoom.
- **Q5. The sections.** For each section of section 2's table, the app's functions it reads (model checks, coverage,
  classification and stereotype indexes, the Data Vault reading, the requirement index, the bus matrix's helpers),
  which need a pure entry point, and what the prototype prints that the app has no rule for.
- **Q6. The dictionary's dimensional entities (decided, item 8).** The design: what InfoCube contributes to the
  dictionary (an entity's role, an attribute's feed; slice 25 step 1, F9 and F10), the extension point's shape, cost.
- **Q7. Style.** The templates' CSS, IBM Plex Serif back (as slice 25 step 4 hosted it), A3 and landscape with
  Paged.js, the header and footer fields and their rules, the notation switch outside figures, black and white.
- **Q8. Language per document (decided, item 9).** Where it is stored (the recipe's `style`), the default for stored
  recipes, the wording of D-80's change.
- **Q9. Rights and texts.** Nothing new expected; check that adding, removing and reordering sections follow slice 25's
  rules, and list every new UI text.
- **Q10. Earlier specs, fixtures, the demo:** the demo's three documents with the new sections (as the prototype's
  presets), the element guard, the layout reference spec of slice 25.

## 8. Decisions (proposals) and docs

- **D-81 (proposal), InfoDocumenter: the editor, the sections, the style (slice 26).** To be written at the closing
  from what the slice built: the editor's three panels and the sections' management; the adaptive preview (Auto, Exact
  pages, Quick preview, the threshold, Update pages, about 500 ms after the last keystroke, the latest change wins, the
  sync); the sections without figures; the dictionary's dimensional entities through InfoCube's contributions; the
  style; a document's own language, defaulting to the workspace's (amending D-80's language rule and its "the dictionary
  covers the logical level").
- **AD-18 (slice 25's note, amended):** the recipe holds `style` too.
- Docs: `decisions.md`, `data-model-v2.md`, `ideas.md` (InfoDocumenter: done items; **the roadmap moved in as its
  "Later"**, so that `ideas.md` is the one place), `inventory-prototype-vs-app.md`, `known-limitations.md`, README and
  CLAUDE.md.

## 9. Left for later

As `infodocumenter-roadmap.md` says: slice C (figures, the star diagram, the canvas's page outline, list of figures,
the smallest attribute names), baselines and documents from a baseline with "changes since a baseline", slice D
(versions, links, guests' restriction, logos, where PDFs are made), slice E (Markdown export), and the items noted there
(live label canvases in baselines, transfers, copies of documents, module switches as one record, figures' step 2), and
the follow-ups outside the slices (the German words, part 8 of the full run, KB to format 17, the Paged.js alias).
