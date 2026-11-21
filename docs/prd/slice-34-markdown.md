# Slice 34 – InfoDocumenter E: a document as Markdown

Status: **proposed** (21 November 2026). Proposed by Łukasz on 21 November 2026 (InfoDocumenter's roadmap in
`docs/ideas.md`: "Slice E – Markdown export: metadata instead of images (an AI agent or Mermaid draws the diagrams); one
file or a set of files (open)"). **Full path** (CLAUDE.md, "The slice cycle", 2), because it adds a
renderer beside the document's HTML in the module's domain and a test dependency. Branch `slice/34-markdown`, from `dev`
(`bc5329d` or later). PRD file: `docs/prd/slice-34-markdown.md`; step 1 writes `docs/prd/slice-34-acceptance.md`. Test
regime: CLAUDE.md, "Testing". Slice number 34 is an assumption (the next free number); step 1 confirms.

**The database program pauses here** (Łukasz, 21 November 2026): slice D (production) waits until someone besides
Łukasz must work in the app; feature slices return. Recorded as a note on AD-31 at this slice's closing (section 8).

It has a **prototype change**, accepted by Łukasz on 21 November 2026 **with nine rules from his review of its sample**
(section 2, "The rules"). Files in Łukasz's Downloads folder (The slice cycle, 3):

| File | SHA-256 |
| --- | --- |
| `slice-34-markdown.md` | given in the prompt |
| `infomapper-prototype-with-sources.html` | `92b78b95141a10d557adddc620b695b0cbce640f1e6e27a2310e5dba3291f439` |
| `sample-retail-co-stage-1-documentation.md` (the prototype's output, with its faults; for reference) | `2b94f1ed5ffe082ebe9567574da34a878699251d5a7c435198adfac0a80cfca4` |

Written from the decision rounds of 21 November 2026 (no file in the repository; quoted as "M1", "M2", "MT1" to "MT4"
and "the rules"), InfoDocumenter's PRDs (slices 25 to 28, D-80 to D-83), the prototype and a few lookups in the code on
`dev` at `bc5329d` (marked "fact, `bc5329d`"). Facts and assumptions are marked; every assumption is to be checked in
step 1.

## 1. Why

Łukasz wants his model's documentation as text: for people (a wiki, Git, dbt's docs) and for AI (an agent that reads the
model and, for example, drafts dbt models or reviews it). A PDF serves neither: its tables are not text an agent reads
reliably and its diagrams are images. Markdown keeps the document's structure, its tables as tables, and its diagrams as
Mermaid, which GitHub and Azure DevOps draw and an agent reads.

Decisions taken before this PRD (Łukasz, 21 November 2026):
- **M1.1 (c):** for people and for AI.
- **M1.2 (a):** the source is an InfoDocumenter document: the same sections, presets, scope and language as its PDF.
- **M1.3 (a):** one `.md` file.
- **M1.4 (a):** diagrams as Mermaid blocks.
- **M2.1 (a):** a button "Markdown" beside "Print / PDF" in the document editor opens a dialog with the text, **Copy**
  and **Download .md**.
- **M2.2 (a):** only from the editor; Markdown of a generated version later (with baselines).

## 2. What to build

### The button and the dialog (the prototype)

- **"Markdown"** in the editor's top bar, right after "Print / PDF", with the same rights and the same disabled state
  and title (`can.exp()` in the prototype; the app's export right, step 1 names it).
- **The dialog "Markdown":** "This document as one Markdown file: the same sections and language as the PDF; diagrams as
  Mermaid blocks, page layout left out. For people (a wiki, Git) and for AI."; the text in a scrolling, monospaced box;
  a line "{n} lines · {size} KB · {file}.md"; **Copy** (the whole text to the clipboard; a toast "Markdown copied.") and
  **Download .md** (primary; the file named from the document's name in lower case with hyphens, e.g.
  `retail-co-stage-1-documentation.md`); a close button. Built with the app's dialog component.
- The text shows the model at the moment of the click (the editor's snapshot as it stands, or a fresh read: step 1
  proposes; the PDF's own rule is the guide).

### The content

- **The same document as its PDF** (M1.2): the sections that are on, in their order, with their headings and options,
  the document's language for every label, its scope and its presets. Section types that have no Markdown form yet:
  step 1 lists them and proposes (a heading and a line saying so is the fallback).
- **MT1. Front matter (YAML)** on top: `document`, `workspace`, `organization`, `language`, `source` (the live model;
  a baseline's name and date once baselines exist, rule 7), `generated` (date and time), `generator: InfoMapper
  (InfoDocumenter)`. Values quoted where YAML needs it.
- **MT2. Print-only options left out:** paper, orientation, size, watermark, running header and footer, the cover page,
  page numbers, keep-rows, the draft mark, the page outline. The contents (when the document has them) become a list of
  links to the headings; heading numbers are left out. The title is the first `#` heading.
- **MT3. Tables stay Markdown tables** (with `|` escaped), lists stay lists, a requirement's text stays text.
- **MT4. Built in the module's domain** from the same document tree the HTML is drawn from (fact, `bc5329d`:
  `src/modules/infodocumenter/domain/` builds the tree, `ui/document-html.tsx` draws HTML), as a pure function beside
  the HTML renderer: no browser, no DOM, the same result on both adapters, testable in unit tests.

### The rules (from Łukasz's review of the prototype's sample, accepted 21 November 2026)

The sample (`sample-retail-co-stage-1-documentation.md`) shows each fault; the app must not:
1. **Each figure shows its own content** (its canvas or frame, as in the PDF, through the figures' own selection in
   `domain/figures.ts`); InfoCube's star as the fact and its dimensions. The sample repeats the whole model four times.
2. **A long text never becomes a fake table row** (the PDF's "under the row" option): it becomes its own column (e.g.
   "Rule", "Description", "Transformation") or a list under the table. ("Direct copy", "Transformation: …", stereotype
   and classification descriptions, data quality rules.)
3. **Values never run together:** lists, commas or ` · ` between them (`customers.email_addr` and `web_users.email`;
   `REQ-101` and its name; "Kind", "Status", "Priority", "Coverage").
4. **No empty cells left by icons:** an icon becomes text or a symbol (a status as its word, a transformation as `ƒ`,
   a type problem as a word); a column with nothing in it is left out.
5. **The colour and line legend is left out;** the cardinality notation stays (Mermaid's markers `||`, `|o`, `}|`, `}o`).
6. **Headings never skip a level** (the sample's Requirements went from `##` to `####`).
7. **The front matter names the source** (MT1).
8. **Mermaid names keep their spaces** through quoted aliases where the renderers allow it (assumption: step 1 checks
   Mermaid's syntax and the versions GitHub and Azure DevOps render); otherwise underscores, and the real name in the
   block's comment.
9. **A mapping's status in brackets:** `customers.cust_id (Draft)`; an approved mapping without a word.

### Diagrams (rule 1)

- **Figures of canvases and frames** (slice 27's figures, D-82): an `erDiagram` block with the figure's entities and the
  relationships between them; each entity with its attributes as the figure shows them (all, keys only, or none, by the
  figure's own options), `PK` and `FK` marks; cardinalities by the relationship's ends (IE). Captions as italic text under
  the block ("*Figure 2. Customer & orders*"), the figures' numbering kept.
- **InfoCube's star** (one per fact): the fact and its dimensions as an `erDiagram` (or a `flowchart` if `erDiagram`
  cannot show it; step 1 proposes).
- **Requirement cards and notes** never in a diagram (as the PDF: notes never drawn; requirement cards: step 1 says).
- Mapping lines and source tables on a figure: step 1 proposes (an `erDiagram` has no mapping line; a list under the
  block is the fallback).
- **The Diagrams section's legend** is left out (rule 5).

### Tests

- **Unit tests** of the Markdown renderer on the demo's three documents and each section type: the nine rules as
  checks (no row whose other cells are all empty, no two values glued, no empty column, no skipped heading level, the
  front matter's keys, the status in brackets), and figures with their own entities.
- **Every Mermaid block parses** with Mermaid's own parser (a dev dependency; step 1 proposes which package and
  version, matching what GitHub renders as closely as known).
- **Both adapters:** the same text from the same document (the contract suite or a unit test over both stores' reads).
- **e2e:** the button and its rights (disabled where "Print / PDF" is), the dialog, Copy (the clipboard's text equals
  the box's), Download (the file's name and content).
- **The PDF unchanged:** the existing InfoDocumenter specs pass unchanged.

### Not in this slice

A set of files or a zip (M1.3); Markdown of a generated version or a baseline (M2.2); images in Markdown; Word or HTML
export; a public link; the dbt channel.

## 3. Data model

**None.** No table, column, migration, format step or adapter change. KB and the demo are not touched; no `pg:migrate`.

## 4. Sources

- **Decisions:** D-80 to D-83 (InfoDocumenter), AD-31 (the program and its pause), AD-39 (KB online, backups).
- **Code (fact, `bc5329d`):** `src/modules/infodocumenter/domain/` (`document.ts`, `sections*.ts`, `figures.ts`,
  `tables.ts`, `labels.ts`, `types.ts`), `ui/document-html.tsx`, `app/editor.tsx`, `app/snapshot.ts`; the canvas's
  drawing rules in `src/domain/canvas/`.
- **The prototype:** the editor's top bar (`data-de="md"`), the dialog (`#mdDlg`, `MD.open`, `MD.make`).
- **The sample:** `sample-retail-co-stage-1-documentation.md` (faults to avoid, the rules).

## 5. Steps

Stop after each step; wait for Łukasz.

1. **Reconnaissance and check.** Copy the PRD, the prototype and the sample from Downloads into the repository (the
   sample into `docs/prd/`, as a reference) and check all three with `cmp` and the SHA-256 (stop if any differs).
   Answer Q1–Q8 in `slice-34-acceptance.md`; every place where the PRD is wrong or costs more than it assumes, with a
   proposal; the differences between the prototype and the app this slice touches; the earlier specs and tests each
   step touches; the plan for steps 2 to 4. No application code.
2. **The renderer and its tests:** Markdown from the document tree, every section type, figures as Mermaid, the rules
   checked, the Mermaid parser in the tests. A draft PR into `dev`. A full run.
3. **The button and the dialog:** "Markdown", the dialog, Copy, Download; the e2e specs. A full run. Then **Łukasz's
   acceptance** on `npm run dev:pg` with a demo account (AD-39: demo accounts only; no backup needed for an acceptance):
   the three demo documents' Markdown, Copy into a text editor, the downloaded file opened in VS Code's preview and on
   GitHub (a gist or a repository's file view) to see the diagrams drawn. **Stop** with what he saw.
4. **Close.** The docs and the decisions quoted in full for approval (section 8), the housekeeping (section 8); one full
   run on the final commit. Merge into `dev` and tag `slice-34` only on Łukasz's command, with `pg:backup` before the
   merge only if KB changed since the last backup (AD-39's backup note).

## 6. Acceptance criteria

Łukasz's criteria 1 to 4 (21 November 2026).

| ID | Criterion |
| --- | --- |
| S34-01 | **The button and the dialog.** "Markdown" beside "Print / PDF" in the document editor opens a dialog with the document's text, its number of lines, size and file name, Copy and Download .md. Copy puts the whole text on the clipboard (pasted into a text editor or Claude, it is complete); Download saves a file named from the document's title. Whoever can print the document sees the button, on the same rights as "Print / PDF". The Markdown shows the model at the click. (Criterion 1.) |
| S34-02 | **The content.** The same sections, order and language as the document's PDF, without what serves printing only (cover, page numbers, watermark, running header and footer). The front matter names the document, workspace, organization, language, source and the time it was made. Tables are valid Markdown tables; long texts are a column or a list under the table; values never run together; no empty columns left by icons; headings never skip a level; a mapping's status in brackets. The file reads well in VS Code, GitHub and Azure DevOps. (Criterion 2.) |
| S34-03 | **Diagrams.** Each figure of the PDF has its own Mermaid block with the same content: a canvas's or frame's entities and relationships, InfoCube's star as the fact and its dimensions; the caption under the block. Entities with their attributes and PK / FK marks, relationships with IE cardinalities; names keep their spaces where the renderers allow; no colour legend. Pasted to GitHub or Azure DevOps, every block draws without an error. (Criterion 3.) |
| S34-04 | **Nothing breaks.** The PDF and the document preview look as today and the full run passes; the Markdown's tests on the demo's documents check the rules, every Mermaid block passes Mermaid's parser, and both adapters give the same text; no database or data change, KB untouched, no `pg:migrate`; Łukasz accepts on `dev:pg` with a demo account. At the closing: AD-31's note and CLAUDE.md's rules on the local file. (Criterion 4.) |
| S34-05 | CI, the Schema workflow, the full run before the merge; every earlier test changed, with its reason. |

**Manual acceptance:** Łukasz, step 3: S34-01 to S34-03 on `dev:pg` with a demo account; S34-04 from CC's report.

## 7. Questions for step 1

- **Q1. The document tree.** Its node types per section, how the HTML renderer walks it, where long texts, icons,
  statuses, legends and figure placeholders sit in it; whether a second renderer fits beside it without changing the
  tree (and what must change if not).
- **Q2. Section types.** Every section type (InfoMapper's and InfoCube's) and its Markdown form; the ones with no
  natural form (e.g. the readiness checks' icons, the bus matrix's marks, the classification register's chips).
- **Q3. Figures.** How a figure selects its entities, relationships, attributes and options (`domain/figures.ts`, the
  canvas's rules); what Mermaid can show of it (relationships, attributes, keys, mappings, source tables, frames,
  InfoCube's roles) and what goes to a list under the block; the star.
- **Q4. Mermaid.** The syntax for names with spaces (quoted aliases in `erDiagram`), the versions GitHub and Azure
  DevOps render (fact or assumption, with sources), the parser package for tests (dev dependency only, no browser), and
  characters that break a block (quotes, brackets, Polish and German letters, long names).
- **Q5. Labels and language.** Every new word (the dialog's, column headings that are new, e.g. "Rule") in English,
  Polish and German; the German words' pending review.
- **Q6. The snapshot.** Whether the editor's snapshot holds everything the Markdown needs, whether the Markdown is built
  in the browser from it (no request) or on the server, and what "the model at the click" means for an open editor.
- **Q7. The rules as tests.** How each of the nine rules is checked automatically, on which documents (the demo's three,
  a document with every section on, a Polish one).
- **Q8. Risks and shared infrastructure.** Anything that changes the HTML or the PDF; the e2e parts' heap (part 5 at
  1,876 MB, part 6 at 1,868 MB) and a recut if a new folder pushes one past 2 GB; anything in the code that changes this
  plan.

## 8. Decisions (proposals) and docs

Quoted in full at the closing for Łukasz's approval; the texts below are proposals for step 1 to correct.

- **D-86 (new): a document as Markdown** (InfoDocumenter's slice E): the button and dialog; one file; the content rules
  (MT1 to MT4, the nine rules); Mermaid for figures; built in the module's domain from the document tree.
- **AD-31 (note):** "The database program pauses after slices C (31), the people slice (33) and the theme (32): Łukasz
  works alone on `dev`'s preview with KB online as the master. Slice D waits until someone else must join; feature
  slices return from slice 34 (Łukasz, 21 November 2026)."
- **CLAUDE.md, "Łukasz's test model" (housekeeping):** the local file `.data/dev-db.json` is an untouched archive since
  21 November 2026 (Łukasz no longer works on it; option a); the rules about reading it on a copy of a backup stay for
  the archive; the rules about the local KB as a working model go.
- Docs: `decisions.md`, `ideas.md` (slice E done; a set of files, Markdown of versions, the dbt channel left),
  `known-limitations.md` (Mermaid's limits found in step 1), `inventory-prototype-vs-app.md`, README and CLAUDE.md.

## 9. Left for later

A set of files or a zip (e.g. for dbt); Markdown of a generated version and of a baseline; the dbt channel; Word or HTML
export.
