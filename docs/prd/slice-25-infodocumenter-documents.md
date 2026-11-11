# Slice 25 – InfoDocumenter: documents from the live model

Status: **proposed** (Łukasz, 11 November 2026). **Full path** (CLAUDE.md, "The slice cycle", 2): a new module with its
own table, a workspace switch and a new extension point in the composition root. Branch
`slice/25-infodocumenter-documents`, from `main` (after tag `slice-24` and the merge of PR 56, `e987f82`). PRD file:
`docs/prd/slice-25-infodocumenter-documents.md`; step 1 writes `docs/prd/slice-25-acceptance.md`. Test regime:
CLAUDE.md, "Testing".

Written from the docs after slice 24 (D-79) and the prototype changed for this slice, which Łukasz accepted on
11 November 2026, **without reading the code**. **The prototype is the source of truth for behaviour; where this PRD and
the prototype differ, ask.** The prototype shows the whole of InfoDocumenter (an editor with a live preview, figures,
versions, links, documents from a baseline); this slice builds the part section 2 lists. Everything else in the
prototype's Documentation tab is later (section 9).

## 1. Why

A warehouse team hands its model to people who never open InfoMapper: the business signs off definitions, ETL
developers build from the source-to-target mapping, a client receives the model at the end of a stage. Today they get
screenshots or hand-made Word files that are out of date the day after. InfoDocumenter generates documents from the
model, never from screenshots: the tables come from the model's objects, so a document is right at the moment it is
made.

`docs/ideas_infodocumenter.md` (7 November) is background only: it still describes a separate product with Word first.
That changed in the design rounds below.

Decisions taken with Łukasz (round 2, 11 November 2026):
- **1 (R2-1a).** This slice generates documents from the **live model** only, with a watermark "DRAFT · live model" and
  the date. A document's definition has a **source** field from the start (`live`, or `baseline` with its id); only
  `live` can be chosen in this slice. Baselines get their own slice right before the first slice that reads one
  (section 9 and `docs/ideas.md`).
- **2 (R2-2a).** InfoDocumenter is a **module** (AD-33) in `src/modules/infodocumenter/`, licensed per organization and
  turned on per workspace (AD-35). When it is on, the workspace home has a **Documentation** tab.
- **3 (R2-2b1).** **Other modules contribute sections** through a new extension point in `src/compose/`: a module
  registers section types and a pure view of its data; InfoDocumenter renders them without knowing the module. InfoCube
  registers the **Dimensional model** section in this slice, so documents cover both levels.
- **4 (R2-2c2).** **Turning InfoDocumenter off is always allowed** and deletes nothing: the definitions are kept and
  hidden, and come back when it is turned on again. This completes AD-35 for a module whose objects are outside the
  model.
- **5 (R2-3a2).** Sections in this slice: **Text** (introduction), **Data dictionary**, **Source-to-target mapping**,
  **Dimensional model** (InfoCube), and a **title page**. Contents with page numbers and page numbers in the footer come
  with the paged output (item 6).
- **6 (R2-3b1).** The output is **a document page in the app**, laid out in pages by Paged.js in the browser; **PDF by the
  browser's print**. No server-side rendering, no file storage.
- **7 (R2-3c).** Generation has **three layers**: the definition (the recipe), a **neutral content tree** (headings,
  paragraphs, tables, cells), built by pure domain functions from the model and the app's existing rules (never copies of
  them), and an **HTML renderer**. A later PDF on the server, Markdown or Word export is another renderer of the same
  tree.
- **8 (R2-3d2).** A document is a **stored definition**, made from a **preset** ("Data dictionary", "Source-to-target
  specification", "Blank document") and changed in a **form** (no editor with live preview: that is slice B). The style
  is fixed in this slice: A4 portrait, the workspace's documentation language.
- **9 (R2-4a2).** Definitions are **outside undo**, saved with a version (D-59), each save a change event (as the naming
  conventions, D-78).
- **10 (R2-4b).** **Rights:** every member makes **private** documents, readers and guests included; a private document
  is seen and changed only by its author. Owners, admins and modelers make **shared** ones; a shared document is seen by
  every member, changed by owners, admins and modelers, deleted by owners, admins or its author. Printing (PDF) is open to
  every member except guests. An archived workspace's documents are read only and can still be opened and printed. This
  is the first write a reader may make: AD-05 gets an exception for **a module's own objects outside the model**.
- **Assumptions accepted with the prototype:** the presets' contents, the column choices and the German labels are
  proposals; the German labels are to be reviewed.

## 2. What to build

### The Documentation tab (workspace home)

- Shown when InfoDocumenter is on in the workspace; its count is the documents the current person can see.
- An introduction line and **New document** (everyone except in an archived workspace), which asks for a preset.
- **Shared documents** and **Your private documents**: one row each with the name, the audience, "live model", the
  number of sections, the language, A4, and for a shared one its author; buttons **Edit** (or **Open** without the
  right to change it), **Duplicate** (into a private copy of the current person's), **Delete** (with the rights of item
  10). A private document of someone else's is never listed.
- Not in this slice: generated versions, links, "act as" (a prototype-only control).

### The document form

Opened from a row. Fields in this order:
- **Name**, **Audience** (free text), **Shared** (a check box, owners, admins and modelers only; turning it off makes it
  the author's private document again, asked first).
- **Title page:** title (defaults to the name), subtitle, version, status text (e.g. "Draft for review"), prepared by.
  The client and the workspace's name are printed from the workspace.
- **Scope:** projects (none chosen = the whole model; a project means the entities on its canvases), concepts (none
  chosen = all), levels (logical, dimensional), mappings shown (all; all but drafts; approved only).
- **Sections**, in the preset's order, each with an on/off switch and its options:
  - **Text:** a heading (defaults to "Introduction") and plain text, paragraphs kept.
  - **Data dictionary:** entities grouped by concept; above each entity's table the fields chosen from stereotype,
    definition, mapping coverage, requirements, relationships (after the attributes); the attribute columns chosen from
    attribute, type, keys, nullable, personal data, definition, mapped from, calculation, requirements. One layout: the
    definition under each row. Dimensional entities appear when the dimensional level is in scope, with their InfoCube
    role instead of a stereotype.
  - **Source-to-target mapping:** columns chosen from target, target type, system, source column, source type, rule,
    status, type check, note, requirements; grouped by target entity or by source system; optionally the attributes
    with no mapping.
  - **Dimensional model** (InfoCube's, only while InfoCube is on): facts (type, grain, their dimensions with role, key,
    "no match" value and definitions, measures with additivity), dimensions (history, unknown member, relationships),
    each dimensional attribute's feed. No star diagram and no figures (slice C).
- **Open document** opens the document page; **Print** opens it and the browser's print dialog.
- A reader of a shared document (no right to change it) sees the form read only and can open and print.

### The document page

- Built from the definition and the live model when opened; nothing is stored.
- Laid out in A4 pages by Paged.js: the title page (title, subtitle, client, workspace, model state "Live model on
  {date}", version, status, prepared by), **contents** with page numbers, the sections, a running header with the
  document's title and a footer "Page n of m".
- The watermark "DRAFT · live model" on every page.
- Every heading and label in the workspace's documentation language (English, Polish, German, the prototype's labels);
  names and definitions as the model has them.
- Names of stereotypes and classifications are the workspace's (D-78, D-79), read through the existing indexes.
- **Print** prints the pages as laid out (A4 portrait, no browser margins).

### Settings

- InfoDocumenter's box in Settings, below InfoCube's, as InfoCube's (AD-35): the switch for owners and admins, the
  licence line. Its text says that turning it off deletes nothing.
- Not in this slice: "Modelers may share links", "Guests may generate versions, print and share links", the logos.

### Not in this slice

The editor with a live preview, section order and adding or removing sections, the style (paper, orientation, theme,
templates, accent, notation, header and footer fields, minimum font size, keep-rows), logos, the other sections
(overview, conventions, readiness, diagrams and figures, sources, classification register, requirements, traceability,
data quality, changes, bus matrix), the dictionary's other layouts and long definitions moved to the end, documents from a
baseline, versions, links, guests' export setting, Markdown export, the canvas's page outline.

## 3. Data model

- **`document_definition`** (new table, InfoDocumenter's, registered in the table registry), outside undo:

  | Column | Type | Null | Notes |
  | --- | --- | --- | --- |
  | standard columns | | | AD-12, with `version` (D-59) and `deleted_at` |
  | `workspace_id` | uuid | no | FK `workspace` |
  | `name` | text | no | trimmed, not empty; not unique |
  | `owner_id` | uuid | no | FK `app_user`: the author |
  | `shared` | boolean | no | default false |
  | `audience` | text | yes | |
  | `preset` | text | no | `dictionary`, `s2t`, `blank` |
  | `source_kind` | text | no | `live` or `baseline`; this slice accepts `live` only |
  | `baseline_id` | uuid | yes | null in this slice |
  | `scope` | jsonb | no | projects, concepts, levels, mapping filter |
  | `cover` | jsonb | no | title, subtitle, version, status, prepared by |
  | `sections` | jsonb | no | ordered list: type, on, heading, options |

  `scope`, `cover` and `sections` are one recipe read and written whole; step 1 says whether jsonb fits the store's rules
  or rows are needed (Q2). A section type registered by a module is stored by its type name (`cube.dim`); a definition
  holding a type whose module is off or unknown keeps it and skips it when rendering, with a note on the page.
- **`workspace.infodoc`** boolean, default false, outside undo (as `workspace.infocube`); the licence in
  `organization_licence` with the module `infodoc` (as InfoCube's).
- `docs/data-model-v2.md` gets both.

## 4. Sources

- **Prototype:** `docs/prototype/infomapper-prototype-with-sources.html`, replaced by the version Łukasz accepted
  (950,304 bytes, SHA-256 `f58ec6bb117cc910882ec4bffa6eb253482807f31d23cc82c650c061d622fa19`), built on slice 24's
  (745,060 bytes, `190d9ea9…`). Its changes:
  - the module `DOC` (from the comment "InfoDocumenter (module, prototype iteration 1)" to `DOC_IC`) and its CSS (from
    "InfoDocumenter (module)"); Paged.js 0.4.3 and IBM Plex Serif in the head;
  - the workspace home: the Documentation tab, InfoDocumenter's box in Settings, "New document from it" on a baseline
    (the baseline's "Mapping specification" and "Data dictionary" removed, R1-6);
  - `CONV` exports `bName`, `def`, `naming`, `removed` and `clsList`: InfoDocumenter reads classifications and
    stereotypes only from there (no list of its own);
  - German labels for documents; turning InfoDocumenter off is always allowed;
  - the canvas's page outline (`pageArea`, `pageCtl`): later, not in this slice.
  - **Prototype storage is not the app's model:** the prototype keeps definitions in `w.docs`, stereotypes by their
    English names, and a section's options as the prototype's own object; the app keeps section 3's columns.
  - **What the prototype shows beyond this slice** (section 2, "Not in this slice") is the target for later slices, not
    this one.
- **Decisions:** AD-05, AD-09, AD-12, AD-19, AD-31, AD-33, AD-35, C-5, D-57, D-59, D-75, D-77, D-78, D-79; the design
  rounds of 11 November 2026 (section 1; round 1 on baselines in section 9).
- **`docs/ideas.md`:** InfoDocumenter entries in "what comes later" (slices 18 to 24).

## 5. Steps

Stop after each step; wait for Łukasz. A new session starts only at a step's boundary, reading CLAUDE.md, this PRD and
the acceptance doc.

1. **Reconnaissance and check.** Answer Q1–Q12 in `slice-25-acceptance.md`; every place where the PRD is wrong, differs
   from the code, a decision or the prototype, or costs more than it assumes, with a proposal; every new UI text; the
   earlier specs and fixtures each step touches; the plan for steps 2 to 5. Copy the prototype and the PRD. No
   application code, no runs.
2. **Module, data and domain.** Draft PR at the start. The module's skeleton, its table and registry entries, the
   switch and the licence, the rights, the commands (create from a preset, save, share, duplicate, delete), the
   extension point for module sections, unit tests. A full run here if step 1 finds the step changes shared
   infrastructure.
3. **Content tree.** The pure functions that build the tree for each section from the model, through the existing
   indexes and rules; InfoCube's section registered through the extension point; unit tests on the demo model and on
   "Performance test" (a reference time, no bar unless Łukasz approves one in step 1).
4. **Interface.** The Documentation tab, the form, the document page with Paged.js, print, Settings' box; S25 specs.
5. **Close.** The docs and the decisions quoted for approval (section 8); one full run on the final commit. Stop with the
   manual acceptance steps. Merge and tag `slice-25` only on Łukasz's command.

Step 1 may propose merging steps 2 and 3 if the content tree is small.

## 6. Acceptance criteria

Tests in `e2e/slice-25/`, one file per criterion, fresh seed each.

| ID | Criterion |
| --- | --- |
| S25-01 | **Switch and licence.** InfoDocumenter's box in Settings; without the licence it says "{organization} has no InfoDocumenter licence." and the switch is disabled; with it, an owner turns it on and the Documentation tab appears; a modeler cannot. Turning it off with documents is allowed, the tab goes, the documents stay and come back when it is on again. |
| S25-02 | **Rights.** An owner makes a shared document; a modeler changes it, cannot delete another's shared one, deletes their own; a reader makes, changes and deletes a private one and opens and prints the shared one, read only; nobody sees another's private document; an archived workspace's documents open and print, read only. Domain tests cover a guest (no print) since guests cannot be invited yet. |
| S25-03 | **Presets and form.** Each preset makes a document with its sections; a change in the form is saved with a version (a stale save refused, D-59) and is a change event; Duplicate makes a private copy; Undo does not touch documents. |
| S25-04 | **Data dictionary.** On the demo: entities grouped by concept, the chosen columns, the definition under the row; a renamed stereotype and a renamed classification print with their new names; scope by project and by concept narrows it. |
| S25-05 | **Source-to-target.** The chosen columns; grouped by entity and by system; "approved only" hides drafts and reviews; the attributes with no mapping listed when chosen. |
| S25-06 | **Dimensional model.** With InfoCube on: facts with grain, dimensions with role and key, unknown member, measures, feeds; with InfoCube off the section is skipped and the page says so; the dimensional level out of scope removes dimensional entities from the dictionary. |
| S25-07 | **Pages.** The document page has a title page, contents with page numbers that match the pages, the running header, "Page n of m", the watermark; print uses A4 portrait. |
| S25-08 | **Languages.** A Polish and a German workspace print headings and labels in their language; names and definitions unchanged. |
| S25-09 | **Content tree.** Unit tests: the tree for each section on the demo; no section reads a store; the time on "Performance test" reported (reference figure). |
| S25-10 | CI, the full run before the merge (and one in step 2 if step 1 says so); the element guard; every earlier test changed, with its reason. |

**Manual acceptance (demo and KB):** the demo: a dictionary and an S2T document from presets, the scope narrowed to a
project, the document page with contents and page numbers, a PDF from the browser's print, a reader's private document,
turning InfoDocumenter off and on. KB: only if the local file's format changes and only on Łukasz's command, after the
backup "Łukasz's test model" requires; then a dictionary of Kanton Basel.

## 7. Questions for step 1

- **Q1. The module.** Its five parts, its registration in `src/compose/`, the switch (`workspace.infodoc`) and the licence
  as InfoCube's (AD-35), the local file's format if any (a module table needs none since slice 18; does the
  `workspace` column?).
- **Q2. The table.** jsonb for `scope`, `cover`, `sections` against the store's rules (the local adapter's checks, the
  schema compare, RLS); outside undo for a module table (how `OUTSIDE_UNDO` or its equivalent reaches a module's table);
  the change event of a save; the version check (D-59).
- **Q3. Rights.** New permission actions (proposal: `document.create` for every role, `document.share`,
  `document.editShared` for EDITORS, `document.deleteShared` for owners and admins, the author's rights on their own),
  AD-05's exception for a reader's write, guests, archived workspaces (`ALLOWED_WHEN_ARCHIVED`): open and print but no
  write.
- **Q4. Turning off with objects.** AD-35's rule is written for InfoCube ("only while the workspace has none of its
  objects"): where it is enforced, and how a module declares that its objects are outside the model so it can be turned
  off with them.
- **Q5. The extension point for sections.** Its shape (section types with defaults, a pure view of the module's data
  for a model state, a tree builder), its place among `ModuleView`, `PANEL_SECTIONS` and the other points, the lint and
  the probes in `tests/layer-rules.test.ts`, CLAUDE.md's list.
- **Q6. The content tree.** Where it lives (InfoDocumenter's `domain`), its node kinds, and which existing functions each
  section reads: `stereotypeIndex`, `classificationIndex`, `rowCounts`/`countsAsMapped`, `lookupModel`,
  `buildRequirementIndex` with feeds, `checkMappingTypes`, `cubeIndex`, `historyLabel`, `unknownValueOf`, the bus
  matrix's helpers. Name each one that reads a store or the session and needs a pure entry point (the baseline check
  found `store.model.load`'s ordering and `lostOriginals` in the data layer).
- **Q7. Levels and lists.** CLAUDE.md: "a later list or count that reads entities decides its level". How the scope's
  levels and projects map to the app's level and canvas data; the order of entities and attributes (the same as the
  model tree?).
- **Q8. The document page.** Its route, how it loads (one read of the model state, as the baseline check's item 7
  says), Paged.js as a pinned npm package (no CDN), its CSS and fonts (hosted locally, P3 B), print CSS, the watermark,
  and Paged.js's limits (mixed page sizes, inline SVG; no figures in this slice).
- **Q9. Labels.** The document's labels in three languages: where they live (the module's domain, as the built-in
  names of D-78), their source (the prototype's `LBL`), the documentation language read from the workspace.
- **Q10. Copy, transfer, export of a workspace** (not built yet): what the definitions need so that those later slices
  can take them (owners who are not members of the target, private documents).
- **Q11. Earlier specs and fixtures** each step touches: the workspace home's tabs and Settings, the seed (does the demo
  get InfoDocumenter's licence, the switch on and seeded documents, as the prototype's Retail Co – DWH?).
- **Q12. Performance.** A reference time for building the tree and laying out the pages of a full dictionary of
  "Performance test"; whether Łukasz should set a bar.

## 8. Decisions (proposals) and docs

- **D-80 (proposal), InfoDocumenter: documents from the live model (slice 25).** "InfoDocumenter is a module
  (AD-33, AD-35) that generates documents from the model, never from screenshots. A document is a stored definition: a
  name, an audience, its source (the live model; a baseline later), a scope (projects, concepts, levels, the mappings
  shown), a title page and an ordered list of sections with their options, made from a preset and changed in a form.
  Opening it builds a content tree from the model through the app's own indexes and rules and lays it out in pages in
  the browser (Paged.js): a title page, contents with page numbers, a running header, page numbers and, for the live
  model, the watermark 'DRAFT · live model'; the browser's print makes the PDF. Headings and labels are in the
  workspace's documentation language. Sections: text, data dictionary, source-to-target mapping and, from InfoCube, the
  dimensional model. Every member makes private documents, seen and changed only by their author; owners, admins and
  modelers make shared ones, seen by every member, changed by owners, admins and modelers and deleted by owners, admins
  or their author; guests do not print. Definitions are outside undo, saved with a version, each save a change event; an
  archived workspace's documents are read only and can be printed."
- **AD-33 (addition).** The extension point for **document sections**: a module registers section types and a pure view
  of its data; InfoDocumenter renders them without importing the module (CLAUDE.md's list of extension points).
- **AD-35 (addition).** "A module whose objects are outside the model (InfoDocumenter's documents) can be turned off
  while it has objects; they are kept and hidden, and come back when it is turned on again."
- **AD-05 (addition).** "A member of any role may create, change and delete a module's own objects outside the model
  that only they see (InfoDocumenter's private documents)."
- **Baselines (round 1, 11 November 2026):** not a decision of this slice. The closing step writes the agreed design into
  `docs/ideas.md` as the entry "Baselines: the design agreed for their slice" (the text Łukasz gives in the closing
  prompt), so that it is not lost before that slice.

Docs: `decisions.md`, `data-model-v2.md`, `ideas.md` (InfoDocumenter: done items, the later ones of section 9),
`inventory-prototype-vs-app.md`, `known-limitations.md`, README and CLAUDE.md (status, the extension point).
`docs/ideas_infodocumenter.md` is Łukasz's notes file: change it only if he asks in the closing prompt.

## 9. Left for later

- **Slice B:** the editor with a live preview, section order, adding and removing sections, the style (paper,
  orientation, theme, templates, header and footer fields, logos), the sections overview, conventions and notation,
  readiness, sources, classification register, requirements, traceability, data quality, the dictionary's other layouts.
- **Baselines** (their own slice, before the first that reads one): the snapshot as agreed on 11 November 2026 (R1);
  then documents from a baseline and "changes since a baseline".
- **Slice C:** figures (canvases, frames, the star diagram drawn from the model), the canvas's page outline.
- **Slice D:** versions (the generated file stored), links for people outside the workspace (a new AD for access
  without a session), guests' export setting, where PDF files are made (browser or server).
- **Slice E:** Markdown export (metadata instead of images; one file or several).
- Live label canvases in documents from a baseline (option a of 11 November 2026); a workspace transfer with baselines
  holding InfoCube rows.
