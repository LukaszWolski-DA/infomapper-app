# Slice 25 – InfoDocumenter: documents from the live model

Status: **proposed, version 2** (Łukasz, 11 November 2026: step 1's findings answered, see section 7). **Full path** (CLAUDE.md, "The slice cycle", 2): a new module with its
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
  registers the **Dimensional model** section in this slice, so documents cover both levels: the data dictionary covers
  the logical level, the Dimensional model section the dimensional one (facts and dimensions with their roles,
  attributes and feeds). InfoCube also gives its section's words (fact types, histories, additivity, kinds) in the
  three documentation languages.
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
- **10 (R2-4b, changed after step 1).** **Rights:** every member makes **private** documents, readers and guests
  included; a private document is seen and changed only by its author. Owners, admins and modelers make **shared** ones;
  a shared document is seen by every member, changed by owners, admins and modelers, deleted by owners, admins or its
  author (also an author whose role was lowered). **Every member opens and prints** the documents they see, guests
  included: a print button cannot stop the browser's own print, so a guests' restriction comes with versions and links
  (slice D), where it can be enforced. A shared document whose author is no longer a member cannot be made private. An
  archived workspace's documents are read only and can still be opened and printed. This is the first write a reader may
  make: AD-05 gets an exception for **a module's own objects outside the model**, through one generic core permission
  action and the module's own rules (step 1, F14).
- **Assumptions accepted with the prototype:** the presets' contents, the column choices and the German labels are
  proposals; the German labels are to be reviewed.

## 2. What to build

### The Documentation tab (workspace home)

- Shown when InfoDocumenter is on in the workspace; its count is the documents the current person can see.
- An introduction line and **New document** (everyone except in an archived workspace), which asks for a preset,
  creates the document and opens its form (D13).
- **Shared documents** and **Your private documents**: one row each with the name, the audience, "live model", the
  number of sections, the language, A4, and for a shared one its author; buttons **Edit** (or **Open** without the
  right to change it), **Duplicate** (into a private copy of the current person's), **Delete** (with the rights of item
  10). A private document of someone else's is never listed.
- Not in this slice: generated versions, links, "act as" (a prototype-only control). The tab's own texts: step 1's list
  (D10).

### The document form

Opened from a row, on one page with no preview (D5). Fields in this order:
- **Name**, **Audience** (free text), **Shared with the workspace** (a check box, owners, admins and modelers only;
  turning it off makes it the author's private document again, at once and without a question, D4; refused while the
  author is no longer a member, F17), **Model state** shown as text ("Live model (changes as people work)").
- **Title page:** title (defaults to the name), subtitle, version label, status text (e.g. "Draft for review"), prepared
  by (defaults to the author's name, D11). The organization, the client and the workspace's name are printed from the
  workspace (D12).
- **Scope:** projects (none chosen = the whole model; a project means the entities on its canvases), concepts (none
  chosen = all), levels (logical, dimensional), mappings shown (all; all but drafts; approved only).
- **Sections**, in the preset's order, each with an on/off switch and its options:
  - **Text:** a heading (defaults to "Introduction") and plain text, paragraphs kept (D8). The other sections have
    their language's default heading (D6).
  - **Data dictionary** (the logical level): entities grouped by concept; above each entity's table the fields chosen from stereotype,
    definition, mapping coverage, requirements, relationships (after the attributes); the attribute columns chosen from
    attribute, type, keys, nullable, personal data, definition, mapped from, calculation, requirements. One layout: the
    definition under each row. Dimensional entities are not in the dictionary; the Dimensional model section covers them.
  - **Source-to-target mapping:** columns chosen from target, target type, system, source column, source type, rule,
    status, type check, note, requirements; grouped by target entity or by source system; optionally the attributes
    with no mapping. Long texts (rule, note) under the row (D9).
  - **Dimensional model** (InfoCube's, only while InfoCube is on): facts (type, grain, their dimensions with role, key,
    "no match" value and definitions, measures with additivity), dimensions (history, unknown member, relationships),
    each dimensional attribute's feed, with InfoCube's words in the document's language. No star diagram and no
    figures (slice C).
- **Open document** opens the document page; **Print** opens it and the browser's print dialog.
- A member without the right to change a document sees the form read only, with "Duplicate as my document", and can
  open and print.

### The document page

- Built from the definition and the live model when opened; nothing is stored.
- Laid out in A4 pages by Paged.js: the title page (title, subtitle, organization, client, workspace, model state "Live
  model on {date}", version, status, prepared by), **contents** with page numbers, the sections (each on a new page,
  D6), the running header and footer as the prototype lays them out (D3), with page numbers "Page n of m".
- The watermark "DRAFT · live model" on every page except the title page (D2).
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
  | `author_id` | uuid | no | FK `app_user`: the author (F15) |
  | `shared` | boolean | no | default false |
  | `audience` | text | yes | |
  | `preset` | text | no | `dictionary`, `s2t`, `blank` |
  | `source_kind` | text | no | `live` or `baseline`; this slice accepts `live` only |
  | `baseline_id` | uuid | yes | null in this slice |
  | `scope` | jsonb | no | projects, concepts, levels, mapping filter |
  | `cover` | jsonb | no | title, subtitle, version, status, prepared by |
  | `sections` | jsonb | no | ordered list: type, on, heading, options |

  `scope`, `cover` and `sections` are one recipe, read and written whole and never searched: jsonb, and AD-18 gets a
  fourth place for JSON (step 1, F5 a). A section type registered by a module is stored by its type name (`cube.dim`); a definition
  holding a type whose module is off or unknown keeps it and skips it when rendering, with a note on the page.
- **`workspace.infodoc`** boolean, default false, outside undo (as `workspace.infocube`); the licence in
  `organization_licence` with the module `infodoc` (as InfoCube's). A core column: the local file's format 17 (F4); KB's
  file is upgraded only on Łukasz's command.
- **The demo** gets the licence, the switch and three live documents (two private, one shared dictionary), outside
  `addFullDemoData` (F31, F32).
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
   extension points (module sections, the workspace home's module tab), the pure `workspaceModelOf` and the one snapshot
   store method (F1), unit tests. **A full run in this step** (the local adapter, the file's format, a module table
   outside undo).
3. **Content tree.** The pure functions that build the tree for each section from the model, through the existing
   indexes and rules; InfoCube's section and its words registered through the extension point; unit tests on the demo
   model and on "Performance test" (a reference figure, no bar: Łukasz decides after seeing it, Q-P1).
4. **Interface.** The Documentation tab, the form, the document page with Paged.js, print, Settings' box; S25 specs.
5. **Close.** The docs and the decisions quoted for approval (section 8); one full run on the final commit. Stop with the
   manual acceptance steps. Merge and tag `slice-25` only on Łukasz's command.

Steps 2 and 3 stay apart (step 1's plan).

## 6. Acceptance criteria

Tests in `e2e/slice-25/`, one file per criterion, fresh seed each.

| ID | Criterion |
| --- | --- |
| S25-01 | **Switch and licence.** InfoDocumenter's box in Settings; without the licence it says "{organization} has no InfoDocumenter licence." and the switch is disabled; with it, an owner turns it on and the Documentation tab appears; a modeler cannot. Turning it off with documents is allowed, the tab goes, the documents stay and come back when it is on again. |
| S25-02 | **Rights.** An owner makes a shared document; a modeler changes it, cannot delete another's shared one, deletes their own; a reader (an InfoMate reader added for this) makes, changes and deletes a private one and opens and prints the shared one, read only; a guest (Kasia) makes a private one and prints; nobody sees another's private document; a shared document whose author left cannot be made private; an archived workspace's documents open and print, read only. |
| S25-03 | **Presets and form.** Each preset makes a document with its sections; a change in the form is saved with a version (a stale save refused, D-59) and is a change event; Duplicate makes a private copy; Undo does not touch documents. |
| S25-04 | **Data dictionary.** On the demo: logical entities grouped by concept, the chosen columns, the definition under the row, the coverage line by the app's rule whatever the mapping filter (Q-L3); a renamed stereotype prints with its new name; scope by project and by concept narrows it. |
| S25-05 | **Source-to-target.** The chosen columns; grouped by entity and by system; "approved only" hides drafts and reviews; the attributes with no mapping listed when chosen. |
| S25-06 | **Dimensional model.** With InfoCube on: facts with grain, dimensions with role and key, unknown member, measures, feeds, InfoCube's words in the document's language; with InfoCube off the section is skipped and the page says so; the dimensional level out of scope removes the section's content. |
| S25-07 | **Pages.** The document page has a title page, contents with page numbers that match the pages, the running header and footer, "Page n of m", the watermark on every page but the title page, each section on a new page; print uses A4 portrait. |
| S25-08 | **Languages.** A Polish and a German workspace print headings and labels in their language; names and definitions unchanged. |
| S25-09 | **Content tree.** Unit tests: the tree for each section on the demo; no section reads a store; the time on "Performance test" reported (reference figure). |
| S25-10 | CI, the full run before the merge (and one in step 2 if step 1 says so); the element guard; every earlier test changed, with its reason. |

**Manual acceptance (demo and KB):** the demo: a dictionary and an S2T document from presets, the scope narrowed to a
project, the document page with contents and page numbers, a PDF from the browser's print, a reader's private document,
turning InfoDocumenter off and on. KB: only if the local file's format changes and only on Łukasz's command, after the
backup "Łukasz's test model" requires; then a dictionary of Kanton Basel.

## 7. Step 1's findings and Łukasz's answers (11 November 2026)

Step 1's questions and findings are in `docs/prd/slice-25-acceptance.md`. Łukasz's answers:
- **F1** yes; **F5** (a); **F8–F10** the content tree's types and the section contract in `src/domain/document/` and
  the home-tab point: yes; the dictionary's two contributions from InfoCube: **no** (the dictionary covers the logical
  level only; item 3); **F14** (b); **F15** yes; **F16** changed: guests print, no print CSS line; S25-02 with Kasia as
  the guest and an added InfoMate reader; **F17** (a) and (b) yes; **F22** yes.
- **Q-L3** yes; **Q-L4** three languages, given by InfoCube with its section; **F31, F32** yes; **F27** yes;
  **Q-P1** reference figures only.
- **D1–D13** as step 1 proposes, except **D4**: the check box without a question. Presets' text for the dictionary:
  "Definitions and personal data of the logical model's entities, for the business." The texts dropped: the unsharing
  question and "Guests cannot print documents in this workspace."
- The German labels, InfoCube's new words included, stay marked for Łukasz's review.

## 8. Decisions (proposals) and docs

- **D-80 (proposal), InfoDocumenter: documents from the live model (slice 25).** "InfoDocumenter is a module
  (AD-33, AD-35) that generates documents from the model, never from screenshots. A document is a stored definition: a
  name, an audience, its source (the live model; a baseline later), a scope (projects, concepts, levels, the mappings
  shown), a title page and an ordered list of sections with their options, made from a preset and changed in a form.
  Opening it builds a content tree from the model through the app's own indexes and rules and lays it out in pages in
  the browser (Paged.js): a title page, contents with page numbers, a running header, page numbers and, for the live
  model, the watermark 'DRAFT · live model'; the browser's print makes the PDF. Headings and labels are in the
  workspace's documentation language. Sections: text, data dictionary, source-to-target mapping and, from InfoCube, the
  dimensional model; the dictionary covers the logical level and the dimensional model InfoCube's. Every member makes
  private documents, seen and changed only by their author; owners, admins and modelers make shared ones, seen by every
  member, changed by owners, admins and modelers and deleted by owners, admins or their author; every member opens and
  prints the documents they see. Definitions are outside undo, saved with a version, each save a change event; an
  archived workspace's documents are read only and can be printed."
- **AD-33 (addition).** Two extension points: **document sections** (a module registers section types, a pure view of
  its data and its words in the documentation languages; the content tree's types and the section contract are in
  InfoMapper's domain, `src/domain/document/`; InfoDocumenter renders them without importing the module) and **the
  workspace home's module tab** (CLAUDE.md's list of extension points).
- **AD-18 (addition).** A fourth place for JSON: a document's recipe (`document_definition.scope`, `cover`,
  `sections`), read and written whole and never searched.
- **AD-35 (addition).** "A module whose objects are outside the model (InfoDocumenter's documents) can be turned off
  while it has objects; they are kept and hidden, and come back when it is turned on again."
- **AD-05 (addition).** "A member of any role may create, change and delete a module's own objects outside the model
  that only they see (InfoDocumenter's private documents)."
- **Baselines (round 1, 11 November 2026):** not a decision of this slice. The closing step writes the agreed design into
  `docs/ideas.md` as the entry "Baselines: the design agreed for their slice" (the text Łukasz gives in the closing
  prompt), so that it is not lost before that slice.

Docs: `decisions.md`, `data-model-v2.md`, `ideas.md` (InfoDocumenter: done items, the later ones of section 9),
`inventory-prototype-vs-app.md`, `known-limitations.md`, README and CLAUDE.md (status, the extension point).
`docs/ideas_infodocumenter.md` (Łukasz's notes): only two sentences at its top, saying it is historical and that the
decisions in force are D-80 and this PRD; its text unchanged.

## 9. Left for later

- **Slice B:** the dictionary's dimensional entities through InfoCube's contributions (if needed), the editor with a live
  preview, section order, adding and removing sections, the style (paper,
  orientation, theme, templates, header and footer fields, logos), the sections overview, conventions and notation,
  readiness, sources, classification register, requirements, traceability, data quality, the dictionary's other layouts.
- **Baselines** (their own slice, before the first that reads one): the snapshot as agreed on 11 November 2026 (R1);
  then documents from a baseline and "changes since a baseline".
- **Slice C:** figures (canvases, frames, the star diagram drawn from the model), the canvas's page outline.
- **Slice D:** versions (the generated file stored), links for people outside the workspace (a new AD for access
  without a session), guests' restriction on versions and links (the export setting), where PDF files are made (browser or server).
- **Slice E:** Markdown export (metadata instead of images; one file or several).
- Live label canvases in documents from a baseline (option a of 11 November 2026); a workspace transfer with baselines
  holding InfoCube rows.
