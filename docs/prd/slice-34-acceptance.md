# Slice 34 – acceptance: step 1 (the PRD checked against the code)

Step 1 of `docs/prd/slice-34-markdown.md`, 21 November 2026, on `slice/34-markdown` from `dev` at `76b4bfb` (the merge
of fix/blank-page-after-sign-in, after `bc5329d`). No application code; no `pg:` script, no connection to
`infomapper-dev`; neither `.data/dev-db.json` nor a backup was read. "Fact" is read in the code at `76b4bfb`;
"assumption" is not verified yet and says how it will be.

## 0. The files and the number

| File | `cmp` with Downloads | SHA-256 | Expected (prompt) |
| --- | --- | --- | --- |
| `docs/prd/slice-34-markdown.md` | equal | `9ad2b53b4c9b18e7837e17939ec2d8a7add7f9ef43d05df8d511b33d9bbac2cd` | equal |
| `docs/prototype/infomapper-prototype-with-sources.html` | equal | `92b78b95141a10d557adddc620b695b0cbce640f1e6e27a2310e5dba3291f439` | equal (also the PRD's) |
| `docs/prd/slice-34-sample.md` (from `sample-retail-co-stage-1-documentation.md`) | equal | `2b94f1ed5ffe082ebe9567574da34a878699251d5a7c435198adfac0a80cfca4` | equal (also the PRD's) |

**34 is the next free number:** the newest tag is `slice-33`; `docs/prd/` ends at slice 33; no branch `slice/34*` existed
locally or on `origin`. The prototype's diff against slice 33's is 69 lines in, 1 out: the `#mdDlg` styles, the dialog
element, the `MD` module (`make`, `open`, `mermaid`) and the "Markdown" button with its click (section 4).

## 1. Q3 and Q4 first: what Mermaid can and cannot show

### Q3. Figures

**How a figure selects what it draws (fact).** Not in `src/modules/infodocumenter/domain/figures.ts` (which holds the
figures' words, the kit `documentFigures`, the Figure and Diagrams sections and the concept frame's figure), but in
InfoMapper's `src/domain/document/figure.ts`, `figureDrawing(input, spec)`, shared with InfoCube's star
(`sectionFigures(...).placed`, `figure-node.ts`). In one pass it:
- keeps the canvas's live items in the document's scope (`inScope`: an entity in `scope.entityIds` of a drawn level, a
  source table in `scope.tableIds`), of the one frame when the figure shows a frame;
- "Adjusted" sets each card's rows (`rows`: canvas, keys, all, none = collapsed);
- filters the mappings by the document's mapping filter (`statusShown`), builds the cards with the canvas's own
  `buildCards` and `applyNames` (names or aliases as the canvas shows them, hidden rows by the card's filter);
- takes the frames holding a drawn card (or the one asked), collapsed blocks "As on the canvas" of a whole canvas;
- the lines: relationships and source keys by the canvas's hidden kinds (or the figure's chosen kinds), mappings,
  InfoCube's dimensional mappings (`modules.lines`, while that level is drawn), bundles into collapsed frames;
- requirement cards and their trace lines only "As on the canvas" of a whole canvas (D-82, D2);
- never notes, labels' marks, selection or highlights.

**What the tree keeps of it (fact, the gap).** `figureNodes` puts only `DocFigure` into the tree: the SVG text, its faces,
its parts, the caption, the number and the editor's line (`src/domain/document/content.ts`). **The entities, rows and
lines a figure drew are not in the tree**, so a Markdown renderer "from the same document tree" cannot know them, and
must not re-select them (rule 1 is exactly the fault of re-selecting: the prototype's `MD.mermaid()` takes the first 12
logical entities of the model for every figure). See F1: `figureDrawing` also returns what it drew as plain data
(`DocFigure.content`), from the same pass, so the Markdown shows exactly what the SVG shows. The star needs nothing of its
own: it is drawn by the same function from its placed cards (the fact and its dimensions in scope, up to its limit).

**What Mermaid can show of a figure, and what goes to a list under the block** (Mermaid's limits are Q4's):

| On the figure | In the `erDiagram` block | Under the block (a list) |
| --- | --- | --- |
| An entity card (logical, fact, dimension) | an entity, its shown name (name or alias, as the figure) | its role when it has one (see roles) |
| Its rows as the figure shows them (all, keys only, none) | attribute lines `type name PK, FK "comment"` | – |
| PK, FK | the keys `PK`, `FK` (both: `PK, FK`) | – |
| PII, BK, calculated (`=`) | the attribute's comment (`"PII"`, `"BK"`, `"= calculated"`) | – |
| A relationship drawn | `A ||--o{ B : "label"`, ends from `from_min/max`, `to_min/max` (IE always, see F18); the label is the pill's text (`pillText`: label and roles) | – |
| Several relationships between two entities, an entity to itself | several lines; a self-line (Q4) | – |
| A source table card | an entity (its columns with their types, PK, FK, BK in the comment) | – |
| A source key between two source tables | a relationship `}o--||` labelled with its columns (assumption: an FK is many-to-one; the model stores no cardinality for it) | – |
| A mapping line (column → attribute), its status, ƒ | **no** (an `erDiagram` has no line between attributes) | "Mappings": `customers.cust_id → Customer.customer_id (Draft)`, ƒ and the rule for a transformation, a type problem as a word |
| InfoCube's dimensional mapping | **no** | "Dimensional mappings": `Customer.customer_id → Dim Customer.customer_key (In review)` |
| A frame (concept, source system, free area) | **no** (`erDiagram` has no grouping; subgraphs are `flowchart`'s) | "Frames": **Customer** (Concept): Customer, Customer Address |
| A collapsed frame's block | its members as entities without attributes (all of them, not cut at six), their relationships to their real ends | "Frames": **Reference data** (Concept, collapsed): Country |
| A bundle of relationships into a collapsed frame | the bundled relationships as single lines to the members | – |
| A requirement card and its trace lines | **no** (PRD: never in a diagram) | "Requirements": REQ-101 Single view of the customer → Customer, Customer.email |
| The status marks (dots, squares, counts `6/7`) | **no** (rule 4: no icons); the coverage is the dictionary's and readiness's | – |
| Colours (concept bands, frame colours), the legend | **no** (rule 5) | – |
| Roles of facts and dimensions | the shown name only | "Roles": Fact Sales: Transaction fact; Dim Customer: Dimension, SCD 2 (the card's role text, `CardData.line1`, in the document's language) |
| A figure cut in parts, its size, orientation | one block for the whole figure (parts are layout) | – |
| "(canvas no longer exists)", "Nothing from this canvas is in the document's scope." | – | the line itself (it is already a paragraph in the tree) |

The caption follows the list, in italics: `*Figure 2. Customer & orders*` (the number from `buildDocument`, no part
letter). A list part with nothing in it is left out; a figure with neither frames nor lines has no list.

**The star** (InfoCube, one per fact): an `erDiagram` suffices (the fact, its dimensions with their keys or all rows as
the section's options say, the fact–dimension relationships with their cardinalities and role names); no `flowchart`.
Its caption keeps "({a} of {b} dimensions shown; all are in the table below)" beyond its limit, as the PDF.

### Q4. Mermaid

Read on 21 November 2026. "Tested" means `mermaid.parse()` run in plain Node on the npm versions 9.4.3, 10.4.0, 10.9.5,
11.4.1, 11.6.0, 11.12.0, 11.16.1 and 12.3.0 (scratch files outside the repository). That proves what each parser
accepts, not what GitHub or Azure DevOps draw; step 3's acceptance is that proof for GitHub.

**The renderers.**
- **GitHub: Mermaid 12.3.0** (fact, read today: the viewer `viewscreen.githubusercontent.com/markdown/mermaid` loads a
  bundle that calls `draw(…, "12.3.0")`). It moves often: 11.4.1 in April 2025, 11.16.1 in August 2026, 12.2.0 on
  8 November 2026 (https://github.com/orgs/community/discussions/70672, https://github.com/orgs/community/discussions/37498).
  It renders in issues, pull requests, discussions, wikis and Markdown files
  (https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/creating-diagrams); gists are
  not named there (assumption: they render; step 3 checks it). It keeps `maxTextSize` at the default **50,000
  characters**; past it the diagram becomes "Maximum text size in diagram exceeded" (fact, 12.3.0). `maxEdges` (500)
  limits only flowcharts.
- **Azure DevOps** (fact, Microsoft's release notes): the wiki accepts both `::: mermaid … :::` and the ```` ```mermaid ````
  fence since Sprint 274, May 2026, "wiki pages, pull requests, and work items"
  (https://learn.microsoft.com/en-us/azure/devops/release-notes/2026/sprint-274-update); `erDiagram` "in wiki pages and file
  preview" since Sprint 259, July 2025 (https://learn.microsoft.com/en-us/azure/devops/release-notes/2025/sprint-259-update);
  Mermaid in the Repos file browser and pull requests since Sprint 246, October 2024
  (https://learn.microsoft.com/en-us/azure/devops/release-notes/2024/sprint-246-update). Microsoft calls its support
  "limited" (https://learn.microsoft.com/en-us/azure/devops/project/wiki/markdown-guidance?view=azure-devops#work-with-mermaid-diagrams).
  **Its Mermaid version is published nowhere** (assumption: older than GitHub's). The fence in a Repos file preview, as
  opposed to the wiki: assumption, untested.

**So the renderer writes only what every tested version accepts** (the floor is the oldest version that passes, so an
older Azure DevOps still draws it):

| Need | Syntax written | Why (tested) |
| --- | --- | --- |
| Entity names with spaces, Polish, German letters (rule 8) | the name quoted as the entity: `"Customer Address" { … }`, `"Zamówienie" ||--o{ "Pozycja" : "zawiera"` | quoted names pass on **every** version from 9.4.3; aliases `e1["Customer Address"]` fail on 10.4.0 (pass from 10.9.5); unquoted non-ASCII fails up to 11.4.1. **Rule 8 holds with no underscores**: no fallback needed |
| A `"` in an entity name or a label | replaced by `'`, the real name in a `%%` comment on its own line before the block's first use | a `"` inside quotes fails on every version |
| A `%%` comment | only on a line of its own | a trailing `%%` fails on 10.4.0 to 12.3.0 |
| An attribute's type | one word: the type's name with its length (`string(100)`, `integer`, `date`); a type with a comma (`decimal(18,2)`) as its name only (`decimal`), the full type in the comment | `string(100)` passes everywhere; `decimal(18,2)` fails up to 11.12.0; spaces and a leading digit fail everywhere |
| An attribute's name | as the model has it when it is letters, digits, `_` and `-` starting with a letter; otherwise each other character `_` (a leading digit prefixed `a_`) and the real name in the comment | spaces and a leading digit fail everywhere, even quoted; non-ASCII unquoted only from 11.6.0 |
| PK, FK | `PK`, `FK`, `PK, FK` | pass everywhere |
| PII, BK, calculated, the full type, the real name | the comment: `"decimal(18,2) · PII · BK · ="`, parts joined by ` · ` | a comment passes everywhere; `# ; : %` inside it pass; `"` fails (replaced by `'`) |
| An entity without attributes (headers only, a collapsed frame's member) | the quoted name alone on its line | a bare entity and `{ }` pass everywhere |
| A relationship's label | always present: the pill's text quoted, or `""` | a missing label fails everywhere; `: ""` passes |
| Cardinalities | `||`, `|o`, `}|`, `}o` on the left, `||`, `o|`, `|{`, `o{` on the right, `--` (identifying: the app has no non-identifying kind) | all markers pass everywhere |
| A self-relationship, two relationships between the same pair | written as they are | pass everywhere |
| Styling, subgraphs, `%%{init}%%`, front matter in a block | never | `classDef` only from 11.6.0, subgraphs from 11.17.0, both against rule 5 and the frames list (Q3) |

The from end's `from_min`/`from_max` give the left marker, the to end's the right one, as the canvas draws `ieMarker` at
each end (fact, `figure.ts`): a Customer (1) placing Sales Orders (0..*) is `"Customer" ||--o{ "Sales Order" : "places"`.

**Size.** A block over 50,000 characters does not draw on GitHub (F19). A dense card is about 40 characters a row, so
roughly 1,200 rows in one figure; the demo's canvases are far below it, a whole "Performance test" canvas may not be
(step 2 measures).

**The parser for the tests (F22).** `mermaid` itself, as a dev dependency: `mermaid.parse()` runs in plain Node, with no
jsdom, on 10.9.5, 11.x and 12.3.0 for ordinary `erDiagram`s (tested; vitest's environment is `node`, fact). Only paths that
call DOMPurify throw in Node (a `subgraph` on 12.3.0, front matter up to 10.4.0), and the renderer writes neither.
`@mermaid-js/parser` (2.0.1, Langium) does **not** cover `erDiagram` (fact, its `index.d.ts`), so it is not an option.
**Proposal:** two pinned versions side by side as npm aliases: `mermaid@12.3.0` (GitHub's today) and `mermaid@10.9.5` (a
floor for an older Azure DevOps; assumption that it is older); every block of every test document must parse on both. A
later GitHub upgrade is caught by step 3's check, not by CI.

## 2. The answers (Q1–Q8)

### Q1. The document tree

**Fact.** The tree's types are InfoMapper's (`src/domain/document/content.ts`, `DocNode`), since InfoCube's sections build
nodes too; `buildDocument` (`src/modules/infodocumenter/domain/document.ts`) returns `DocumentTree`: `language`, `cover`
(organization, title, subtitle, six rows), `contents` (entries with anchor, text, number), `figures` (every figure in
document order), `listOfFigures`, `frame` (header, footer, watermark), `style`, `sections` (id, type, anchor, heading,
`newPage`, `number`, `nodes`) and `skipped` (a note per section skipped). `ui/document-html.tsx` walks it with plain React:
`DocumentHtml` → `Nodes` → `Node` per kind → `Runs` → `Run` per flag.

The node kinds and where the things the PRD names sit:

| Kind | Holds | Markdown |
| --- | --- | --- |
| `heading` (levels 1–4, `number`, `swatch`) | a section's subsections | `###` … by depth, never skipping (F3); numbers and swatches left out (MT2, rule 5) |
| `paragraph` (`placeholder`) | text; an editor's hint when `placeholder` | a paragraph; a placeholder is left out (F15) |
| `meta` (parts) | a line of parts ("Object · 6 of 7 attributes mapped") | one line, parts joined by ` · ` |
| `table` (`columns`, `rows`, `style`; a column `vertical`; a row's `below`) | every table; **long texts under the row in `below`** | a Markdown table; `below` per F2 |
| `list` (`ordered`, `columns: 2`, `plain`, an item's `label`, `muted`) | readiness's items, numbered notes, "Definitions in full", the overview's concepts (`plain`) | `-` or `1.` items; a label in bold before the text |
| `cards` (`attribute`, `requirement`) | the dictionary's "Blocks" layout, the requirements' blocks | F5 |
| `group` (`keep`, `mark`) | an entity's or a requirement's nodes together | its nodes (keep and mark are print-only) |
| `figure` (`DocFigure`) | the SVG and parts; **no content** (Q3) | F1 |
| `legend` | Diagrams' legend | left out (rule 5) |
| `note` | a skipped section's line | a quote `> …` |
| `pageBreak` | the dictionary's concept on a new page | nothing |

**Runs (`DocRun`)** carry the icons and statuses as flags: `mono`, `muted`, `warn`, `strong`, `pill` with `status` (a
mapping's status, readiness's "High"), `lineBreak`, `chip` (a code, PII, BK, a requirement's key), `circle` ("ƒ", "!"),
`swatch` (a concept's colour, no text), `bar` (a coverage bar and its text), `end` (a relationship end in a notation, no
text), `line` (a mapping line's dash, no text), `dots` (no text), `ok` ("✓"), `ref` ("→ note 2"). The runs with **no text**
(`end`, `line`, `dots`, `swatch`) are the sample's empty cells (rule 4); F4 gives each its text.

**Whether a second renderer fits without changing the tree:** for everything but three things, yes: the renderer walks
the same nodes and runs, and the rules 3, 4, 6 and 9 are decided in the renderer alone (F3 to F6). Three additions to the
tree are needed, all additive (the HTML renderer reads none of them, so the PDF cannot change):
1. **The figure's content** (F1): `DocFigure.content`, from `figureDrawing`'s own pass.
2. **The long texts' column labels** (F2): under the row, `below` holds the text without its column's label when a table
   has one long column (`longTextTable`, `blocks.ts`; the dictionary's definition under the row, `builders.ts`; InfoCube's
   dimension definitions, `document-section.ts`), so a Markdown column cannot be named. The table gets its long columns
   (`long`) and each row its long texts by column (`longCells`), beside `below`.
3. **A module line's status** (F20): `ModuleLineData` (`src/domain/canvas/line-data.ts`) has the status only inside its
   CSS class (`cls: "cmap draft"`); an optional `status` lets the figure list a dimensional mapping's status without
   parsing a class.

### Q2. Section types

Fifteen types (fact: `INFODOC_SECTION_TYPES` in `builders.ts`, `CUBE_SECTION` and `CUBE_BUS_SECTION`, joined in
`src/compose/documents.ts`). **Every one has a Markdown form**, so the PRD's fallback ("a heading and a line saying so")
is needed for none; a section whose module is off or whose type is unknown stays a note (`tree.skipped`).

| Type | What it builds | Markdown form | Needs |
| --- | --- | --- | --- |
| `text` Introduction | paragraphs, line breaks kept | paragraphs, a line break kept as a hard break (F11) | escaping (F11) |
| `overview` Model overview | description, a counts table, the concepts as a `plain` list with swatches, figures | the counts table; the concepts as `- **Customer**: Customer, Customer Address` (rule 3); figures (F1) | F1, F5 |
| `dict` Data dictionary | per concept (heading, frame figure) each entity's group: meta, definition, attributes in three layouts, relationships, "Definitions in full" | tables; "Under row" definitions as a column (F2); "Blocks" per F5; the frame figure (F1) | F1, F2, F3, F5 |
| `s2t` Source-to-target | per entity or system a table; rule and note long texts in three modes | rule and note as columns (F2; the sample's "Direct copy" fake rows); status as its word; type check "✓" or its message | F2 |
| `sources` Source tables | per table: heading 3, path and classifications, note, columns table, Data Vault reading list | as is, headings normalised (F3) | F2, F3 |
| `classreg` Classification register | per classification: heading 2, definition, a table (note long text), PII attributes under heading 4 | as is, headings normalised (F3) | F2, F3 |
| `reqs` Requirements | blocks (key chip, name, props, parent, expression, description) or a table | blocks per F5 (a heading per requirement, props joined by ` · `); the table with its long texts per F2 | F2, F3, F5 |
| `ready` Model readiness | intro, a checks table (count or "✓", "High" pill), items in two-column lists | the table ("High" in brackets, F6); the lists one column | – |
| `conv` Conventions | notation (`end` runs), statuses (`line` runs and pills), marks (chips, circles, `dots`), stereotypes and classifications (definitions under the row, fixed), types, naming | notation in Mermaid's markers (F17); the statuses' dash column left out (rule 4); `dots` as "● ○"; definitions as a column (F2) | F2, F4, F17 |
| `trace` Traceability | per requirement a group (heading 3, meta, description, table) or one matrix | as is; "✓" and "–" stay; the matrix's empty first cells of a requirement's later rows stay (not icons) | F3 |
| `dq` Data quality rules | one table, rule and description long texts | rule and description as columns (F2; the sample's fake rows) | F2 |
| `diagrams` Diagrams | per canvas a heading 2, its figures, the legend | figures (F1); the legend left out (rule 5) | F1 |
| `figs` Figure | figures, or the placeholder | figures (F1); the placeholder left out (F15) | F1, F15 |
| `cube.dim` Dimensional model (InfoCube) | figures, facts (type and grain, the star, dimensions with definitions under the row, measures), dimensions (history, unknown member, relationships), feeds | the star (F1); definitions as a column (F2) | F1, F2 |
| `cube.bus` Bus matrix (InfoCube) | a `matrix` table: facts × dimensions, "●", a last row of counts with an empty first cell | the same table, headers plain (no vertical); the counts row named (F21, a new word) | F21 |

**No natural form:** the readiness checks have none of the PRD's feared icons (their result is a number or "✓", text
already); the bus matrix's marks are "●" (text); the classification chips are their codes (text). What has no text is the
four run kinds above (F4) and the figures (F1).

### Q3, Q4

Section 1.

### Q5. Labels and language

**What stays in English:** the dialog is the editor's, and the editor's own texts are English in every document language
(fact: `EDITOR_TEXTS`, `PREVIEW_TEXTS` in `editor.tsx`, the app's language); the front matter's keys and the value of
`source` (`live model`) are fixed English for tools (proposal; the document's words in its language are the headings
and labels).

**The dialog (English, the prototype's):** "Markdown" (the button and the title), "This document as one Markdown file:
the same sections and language as the PDF; diagrams as Mermaid blocks, page layout left out. For people (a wiki, Git)
and for AI.", "{n} lines · {size} KB · {file}" (the prototype's line; the PRD's "{file}.md" is the same, the file name
having its `.md`), "Copy", "Download .md", the close button's name "Close", the toast "Markdown copied." and one new toast
(F25): "The browser did not allow copying. Select the text and copy it."

**New words in the document's language** (`labels.ts`; German marked for Łukasz's review, as every German label is):

| Key (proposal) | English | Polish | German (pending review) |
| --- | --- | --- | --- |
| `md_frames` | Frames | Ramki | Rahmen |
| `md_mappings` | Mappings | Mapowania | Mappings |
| `md_cube` | Dimensional mappings | Mapowania wymiarowe | Dimensionale Mappings |
| `md_srcKeys` | Foreign keys between source tables | Klucze obce między tabelami źródłowymi | Fremdschlüssel zwischen Quelltabellen |
| `md_reqs` | Requirements | Wymagania | Anforderungen |
| `md_roles` | Roles | Role | Rollen |
| `md_busUsers` (F21, InfoCube's words) | Used by facts | Używany w faktach | In Fakten verwendet |
| `md_tooLarge` (F19, only if Łukasz takes it) | This diagram is too large for Mermaid: attributes are left out. | Ten diagram jest za duży dla Mermaid: atrybuty pominięto. | Dieses Diagramm ist für Mermaid zu groß: Attribute sind weggelassen. |

Existing labels serve the rest: "Rule", "Note", "Definition", "Description", "Scope" (the long texts' columns, already
each section's), "Mark" (`mark`, for the conventions' notation column whose PDF header is empty), "collapsed",
"Concept", "Source system", "Free area" (a figure's words), "Figure", "Contents". The PRD's "Rule" is not new.

### Q6. The snapshot

**Fact.** The editor reads one snapshot when it opens (`documentSnapshotAction`, `app/snapshot.ts`: people as id and
name only), builds the state once (`documentStateFor`) and the tree on each change of what is drawn (`buildDocument`
with the recipe and the text fields' drafts, `withDrafts`); the preview and **Print / PDF print that same tree**
(`preview.current?.print()`), so the PDF from the editor shows the model as the editor read it on opening (D-81:
"changes others make to the model reach it after a reload"). The snapshot holds everything the Markdown needs: the tree
is built from it, and F1's figure content comes from the same snapshot rows the SVG does.

**Proposal (D1):** the Markdown is built **in the browser, with no request**, from the tree of the click: at the click
`buildDocument` runs once more on the recipe with the drafts as they stand (as `redraw` does, without its 500 ms pause),
so the last keystroke is in it; the renderer turns that tree into the text. "The model at the click" then means what
the PDF's rule means: the model as the editor read it when it opened, with the document as it stands at the click. A
fresh read at the click (a second `documentSnapshotAction`) would make the Markdown show what the preview does not, and
costs the snapshot's read again (on Postgres the editor's largest read); not proposed. **S34-01's sentence becomes "The
Markdown shows the document as the editor shows it at the click (the model as read when the editor opened, D-81)."**
`generated` is the click's time in the browser (F10); the tree's own date ("Live model on {d}") is the server's day the
page was loaded, as the PDF's.

### Q7. The rules as tests

Every rule is checked by a function over the Markdown text (no snapshot of the whole text, so a later label change does
not break them), in a new `tests/document-markdown.test.ts`, on: the demo's three documents (`addSeedDemoData`: the
shared dictionary, the S2T specification with InfoCube's Dimensional model, Anna's dictionary with "all" mappings); a
document with **every section type on** with every layout and long-text mode in turn (`setSections` as the slice 26
tests do); the same in **Polish** and **German**; and the star (`addFullDemoData`).

| Rule | The check |
| --- | --- |
| 1. Each figure its own content | for each figure: the block's entities equal the figure's `content` cards, its relationship lines the content's relationships; two figures of different canvases differ; the star's block has exactly the fact and its dimensions shown; a frame's figure has only that frame's cards |
| 2. No fake row | no table row whose cells after the first are all empty (a row of only "–" or "✓" is not empty); "Direct copy", "Transformation: …", stereotype and classification definitions and data quality rules found in a column named "Rule", "Definition", "Description" or in a list under the table |
| 3. No glued values | no cell where two model values meet without a separator: every pair of the cell's runs from different values is split by ", ", " · ", " + ", " → " or a line of its own; checked on the runs (the renderer's join) and on the text against the model's names (`customers.email_addr` and `web_users.email` both found with a separator between) |
| 4. No empty icon cells | no run without text reaches the text as nothing (every `end`, `line`, `dots`, `swatch` mapped or its column dropped); no column whose cells are all empty |
| 5. No legend | no legend's words in the text; the conventions' notation table holds `||`, `|o` / `o|`, `}|` / `|{`, `}o` / `o{` |
| 6. Headings never skip | every heading's level at most one more than the one before it, over the whole text (contents and front matter included) |
| 7. The source named | the front matter is `key: "value"` lines between `---` (each value read with `JSON.parse`, which a double-quoted YAML scalar with `\"` and `\\` escapes is a subset of; no `yaml` package is installed, fact, and none is added) and has `document`, `workspace`, `organization`, `language`, `source: "live model"`, `generated`, `generator` |
| 8. Names keep their spaces | every entity of the model with a space, a Polish or a German letter appears in a block under its real name (Q4's syntax) |
| 9. Status in brackets | a draft mapping reads `customers.cust_id (Draft)`, an approved one without a word, in the dictionary, traceability, the register and a figure's list |
| Mermaid | every block parses with Mermaid's parser (Q4) |
| Markdown | every table has its header, its separator and the same number of cells in each row; a `|` in a model text is escaped; a model text with `*`, `_`, `<`, `#` reads as text (F11) |
| PDF unchanged | the existing `tests/document-*.test.ts` and `src/modules/infodocumenter/domain/*.test.ts` pass unchanged; the HTML of the demo's three documents is equal before and after the tree's additions (a test that renders `DocumentHtml` to a string on both, as `tests/document-html.test.ts` does) |

Unit tests of the renderer's parts beside it (`markdown.test.ts`: escaping, the heading stack, a table, a list, each run
kind; `mermaid.test.ts`: names, types, cardinalities, a self-relationship, an empty entity).

### Q8. Risks and shared infrastructure

- **The HTML and the PDF.** The tree's three additions are fields the HTML renderer never reads; `figureDrawing` keeps
  its SVG byte for byte (the content is collected beside the strings it already builds). The PDF test above proves it.
  None of CLAUDE.md's shared infrastructure (undo and change groups, the save chain, the canvas's layers, the table
  registry, the local adapter) changes; the canvas's drawing rules in `src/domain/canvas/` are read, not changed. The
  module extension point `ModuleLineData` gets one optional field (F20): CLAUDE.md's list is updated at the closing.
- **The e2e parts** (the last full run, `44880173545` on `77ea32d`, 21 November 2026, read from its artifacts): heap peaks
  part 1 1,199 MB, part 5 **1,876 MB**, part 6 1,459 MB, part 7 1,132 MB, part 9 1,561 MB (the PRD's 1,868 MB for part 6
  is from another run). A new folder joins the last part (part 9, the recut rule), not 5 or 6. Slice 34's specs (about
  six, the editor and one dialog) add little: part 9 stays well under 2 GB (expected about 1.6 GB). **But part 9 is the
  longest part by more than a minute**: 887 s against part 1's 736 s in that run, and the longest job in two of the last
  three full runs (`44880173545`: 972 s against 819 s; `44812118780`: 1,076 s against 979 s; `44777998674`: part 7 was
  longer). By the recut rule (the tests' times in the memory logs, median of the last three runs) a recut of
  `PART_STARTS` is due or nearly due: a decision for Łukasz (section 7), outside this slice's code (`chore/` branch,
  The slice cycle, 4) or as a step of its own here.
- **The clipboard in e2e.** Chromium needs `clipboard-read` and `clipboard-write` granted to the context to read the
  clipboard back (Playwright's `grantPermissions`); a new fixture option, not a change to `e2e/settle.ts`.
- **Mermaid's own limits** (Q4) are the main risk to S34-03's "every block draws without an error" on GitHub and Azure
  DevOps: the parser in the tests is a newer Mermaid than some renderers (Q4), so step 3's acceptance on GitHub stays the
  proof for GitHub; Azure DevOps cannot be checked by CC (section 7).
- **Nothing else in the code changes the plan.** No data change, no migration, no `pg:` script; the Markdown is pure and
  built in the browser, so both adapters give the same text as soon as they give the same snapshot, which
  `tests/contract/reads.test.ts` already proves (`snapshot` is one of its reads).

## 3. Where the PRD is wrong or costs more (with proposals)

**F1. A figure's content is not in the tree** (Q3; rule 1, "Diagrams"). The PRD says the Markdown is built "from the same
document tree the HTML is drawn from" and each figure shows its own content "through the figures' own selection in
`domain/figures.ts`". The selection is `figureDrawing` in `src/domain/document/figure.ts`, and its result reaches the tree
only as SVG text. **Proposal:** `figureDrawing` also returns `content` (plain data: the drawn cards with their shown names,
kinds, role texts and shown rows with type, PK, FK, PII, BK, calculated; the frames and collapsed blocks with their members;
the drawn relationships with both ends' cardinalities and the pill's text; the source keys with their columns; the drawn
mappings with their inputs, target, status, kind, rule and type problem; the module lines with their inputs, target and
status; the requirement cards with their key, name and traced elements), collected in the same loops that write the SVG;
`figureNodes` puts it on `DocFigure.content`. The Markdown's Mermaid block and list read only it. Cost: one more object per
figure in the browser; no second selection, no new rule.

**F2. Long texts under the row lose their column's name** (rule 2). The sample's fake rows come from `below`, which the
tree has (fact); but with one long column `longTextTable` puts the bare text in `below` (its label only when there are
several), and the dictionary's "definition under each row" and InfoCube's dimension definitions write `below` directly.
**Proposal:** a table node gets `long?: DocColumn[]` (its long columns in order) and a row `longCells?: DocRuns[]` (aligned,
empty where none), written by `longTextTable`, the dictionary and InfoCube beside `below`. **The Markdown's rule (D2, for
Łukasz):** "Under row" becomes **its own column at the table's end** (the long text stays in its row: an agent reads one
row whole, and GitHub wraps a long cell); "Numbered" stays the numbered list after the table (the tree has it, with
"→ 1, 2" in the row); "Column" stays a column. The alternative, "Under row" as a list under the table
(`- **customer_id**: Direct copy`), keeps tables narrow for people but splits a row for an agent. A document's choice is
not changed; the Markdown reads it.

**F3. Headings skip levels in the tree itself** (rule 6). Fact: the dictionary without concepts puts an entity's heading at
level 3 right after the section's (1); Source tables at 3; the register 2 then 4; traceability 3; InfoCube 2, 3, 4; the
requirement blocks' titles are drawn as `h4` with no level. The PDF has the same skips (h2 → h4), unseen on paper.
**Proposal:** the renderer maps them by a stack (a heading takes one more than the nearest heading before it with a
smaller tree level; siblings stay siblings): `#` the title, `##` a section, then by depth. The tree and the PDF stay as
they are. Requirement blocks become headings one below the section's current depth.

**F4. Icons with no text** (rule 4). `end`, `line`, `dots` and `swatch` runs have empty text; `bar`, `circle`, `ok`, `chip`
have text. **Proposal, the renderer's table:** `end` → Mermaid's marker in backticks (F17); `line` → nothing, and a column
whose cells come out empty in every row is left out (the conventions' statuses table loses its dash column; its Status
column says the word); `dots` → "● ○"; `swatch` → nothing (rule 5); `bar` → its text ("4/7"); `circle` → its text ("ƒ",
"!"); `ok` → "✓"; `chip` → its text in backticks for a code, plain for a requirement's key; `ref` → its text ("→ note 2").
An empty column header (the conventions' notation column) takes the existing label "Mark". A type problem is a word
already (the type check's message, `warn`).

**F5. Values that run together** (rule 3). Fact: the HTML separates many values only by layout: `lineBreak` runs (a second
mapping in "Mapped from", "Used by", "Applies to"), the requirement blocks' props (each its own `<span>`), the overview's
concepts (`plain` list, `.dcon` blocks), the attribute blocks' props and lines. The sample's glued texts
(`customers.email_addrweb_users.email`, `REQ-101Single view…`, "Kind: Business needStatus: Agreed…", "**Customer**Customer,
Customer Address") come from walking the rendered HTML; the tree has the boundaries. **Proposal:** in a table cell a
`lineBreak` becomes ", " (rule 3's comma; `<br>` is HTML in Markdown and an agent reads it as markup); in a paragraph a
hard line break (F11); `meta` parts and a requirement block's props join with " · "; the overview's concepts are a list
`- **Customer**: Customer, Customer Address`; an attribute block (the dictionary's "Blocks") is a list item
`- **customer_id** · Integer · PK · PII` with its definition and labelled lines as indented lines under it; a requirement
block is a heading (`### REQ-101 Single view of the customer`, the tree's chip and name with the tree's space), its props
line, its parent line (`↳ REQ-101 …`), its expression in a code span and its description. The requirement's key chip and
name already have a space in the tree (`text(" ")`), unlike the prototype's HTML.

**F6. The status in brackets** (rule 9) **is the renderer's, by position.** Fact: a mapping's status in a cell is a `pill`
run after the columns' runs (`mappedFromRuns`, traceability, InfoCube's feeds), only for statuses other than approved
and only while the document shows drafts (`marksStatus`); in S2T's Status column and the conventions it is a pill alone.
**Proposal:** a pill after other text in its cell or line → `(Draft)` / `(In review)`; a pill alone → its word. Readiness's
"High" pill reads "Mappings with a type problem (High)". No tree change.

**F7. There is no export right.** The PRD says "the same rights and the same disabled state and title (`can.exp()` in the
prototype; the app's export right, step 1 names it)". Fact: the app's Print / PDF has no right of its own: every member
who can open the document prints it, guests included and in an archived workspace (D-80, `openRefusal` in
`rights.ts`), and the button is disabled only until the tree is built (`disabled={!built}`, no title; `editor.tsx`). The
prototype's `can.exp()` with the workspace setting `docGuests` is not in the app (section 4). **Proposal:** "Markdown" is
enabled and disabled exactly as Print / PDF (`!built`), with no title, read-only documents included (S26-01 checks Print
there).

**F8. "The model at the click"** (Q6, D1): built from the editor's tree at the click, no request; S34-01's sentence
reworded.

**F9. Title and file name.** The PRD's dialog takes the file name "from the document's name"; S34-01 says "named from the
document's title". In the app a document has a name and a cover title (`cover.title`, empty = the name; `tree.cover.title`).
**Proposal:** the first `#` heading is the cover's title (the PDF's title); the file name comes from the document's
**name** (what the Documentation tab lists, the prototype's `d.name`): lower case, letters and digits, everything else one
hyphen, **Polish and German letters transliterated** (ą→a, ł→l, ß→ss, ä→a; the prototype's rule turns "Słownik danych"
into `s-ownik-danych.md`), `document.md` when nothing is left. S34-01 says "named from the document's name".

**F10. The front matter's values** (MT1). Facts: the app has only the live model as a source (`baseline_id` is always null);
the language is a code (`en`, `pl`, `de`). **Proposal:** every string value in double quotes with `\` and `"` escaped (valid
YAML for any name); `language: "en"` (the code, as the page's `lang`); `source: "live model"`; `generated` as ISO 8601 with
the browser's offset (`2026-11-21T09:05+01:00`); `generator: "InfoMapper (InfoDocumenter)"`. **For Łukasz (D3):** the
cover's other fields are content, not layout: `subtitle`, `client`, `version`, `status` and `prepared_by` in the front
matter when set (as on the title page; "–" when empty is left out). Proposed yes: an agent and a wiki both read them; MT2
leaves out the cover page, not what it says.

**F11. Markdown escaping is not in the PRD** (MT3 names only `|`). A model text may hold `*`, `_`, `` ` ``, `[`, `<`, a
leading `#`, `-`, `1.` or `>`; unescaped it becomes markup (a definition `a_b_c` in italics, `<b>` as HTML in VS Code's
preview). **Proposal:** every text run escapes Markdown's punctuation (`\*`, `\_`, `\<`…), a line's leading block marker
too; a `mono` run becomes a code span with a backtick fence longer than any run of backticks inside; in a table cell `|`
→ `\|` and any newline → ", " (F5); a paragraph's line break → a trailing backslash (CommonMark's hard break; GitHub and
VS Code render it; Azure DevOps: assumption, not documented). Cost: a small function and its tests.

**F12. The contents' links.** The headings' anchors are the renderer's (Markdown has no ids): GitHub's rule (lower case,
spaces → "-", punctuation dropped, a repeated heading "-1", "-2"), computed over every heading of the text. **Assumption:**
Azure DevOps's wiki and VS Code use close but not equal rules (not documented); a link that misses opens the page's top. Checked in
step 3 on GitHub and VS Code. The contents list the sections only (`##`), as the PDF's.

**F13. The list of figures** (MT2 does not say). **Proposal:** left out: it is the PDF's page numbers; each figure keeps its
number and caption under its block.

**F14. Skipped sections** (`tree.skipped`: "InfoCube is off in this workspace…") as a quote after the contents, as in the
PDF's contents.

**F15. Editor hints are not content.** The Figure and Diagrams sections without a figure print "Add a figure in the panel
on the right." (`placeholder: true`, English, the editor's words). **Proposal:** left out of the Markdown (the section's
heading stays, empty).

**F16. Requirement cards are drawn in the PDF.** The PRD says "Requirement cards and notes never in a diagram (as the PDF:
notes never drawn; requirement cards: step 1 says)". Fact: a figure "As on the canvas" of a whole canvas draws its
requirement cards and trace lines (D-82). **Proposal:** never in the Mermaid block; listed under it ("Requirements:
REQ-101 Single view of the customer → Customer, customers.cust_id → Customer.customer_id"), so the content is the same.

**F17. The notation.** Mermaid draws only crow's foot. **Proposal:** the conventions' notation table in the Markdown always
shows Mermaid's markers (both sides: `||`, `|o` / `o|`, `}|` / `|{`, `}o` / `o{`) with the meanings, whatever the style's
notation (rule 5: "the cardinality notation stays (Mermaid's markers …)"); the relationships tables keep their "1 : 0..*"
text as the PDF.

**F18. A UML document's figures** are crow's foot in Mermaid (the PDF's "1..*" labels are not Mermaid's). A known limitation.

**F19. Large figures.** A whole canvas of "Performance test" (100 cards) is one block of several thousand lines; Mermaid
has a text-size limit (Q4) past which a renderer shows an error instead of the diagram. **Proposal (D4, for Łukasz):** step 2
measures the demo's and Performance test's blocks; a block over the limit is drawn with headers only (entities and
relationships, no attributes) and the line "This diagram is too large for Mermaid: attributes are left out." under it, and
if still over, without the block (the list stays). The alternative is no fallback (a known limitation).

**F20. A dimensional mapping's status** (F1's module lines): an optional `status` on `ModuleLineData` (InfoCube's
`cubeFigureContributions` sets it); without it a module line is listed without a status. An extension point's change:
CLAUDE.md's "Canvas lines and objects" gets the field at the closing.

**F21. The bus matrix's counts row** has an empty first cell (fact, `buildBusSection`); in Markdown it reads as a fact
without a name. The renderer cannot name it (it does not know the row's meaning), so naming it means writing the words
into the tree, which the PDF would then print too. **Proposal (D5, for Łukasz):** leave the cell empty in both (not an
icon; the check of rule 4 allows it), since S34-04 says the PDF looks as today; the alternative is "Used by facts"
(InfoCube's words, Q5) in the tree and so in the PDF too.

**F22. The test dependency** (PRD "a dev dependency; step 1 proposes which package and version"): Q4.

**F23. Both adapters** (S34-04). The renderer is pure and the editor builds the tree in the browser from the snapshot.
**Proposal:** one case in the contract suite (`tests/contract/reads.test.ts`, the Schema workflow, both adapters on the
same rows): the demo's three documents' Markdown from each store's `snapshot` equal, with a fixed `generated`. No smoke
spec on Postgres (no new read or write).

**F24. "Generate version"** stands in the prototype's bar after "Markdown"; the app has none yet (baselines are later).
Not touched.

**F25. Copy when the browser refuses.** The prototype toasts "Markdown copied." even when `clipboard.writeText` fails.
**Proposal:** the toast only after it succeeded; else the refusal toast (Q5) and the text stays selectable in the box.

**F26. The PRD's note on AD-31** ("pauses after slices C (31), the people slice (33) and the theme (32)") and the CLAUDE.md
housekeeping (the local file an untouched archive) are the closing's (step 4), as the PRD says; nothing in steps 2 and 3.

## 4. The prototype against the app (what this slice touches)

| Prototype | App | In this slice |
| --- | --- | --- |
| Top bar: "Print / PDF", **"Markdown"**, "Generate version", save slots, the options toggle | "Print / PDF", the save pair, the options toggle (no Generate version) | "Markdown" between Print / PDF and the save pair (F24) |
| `can.exp()`: guests only with `docGuests`; the title `whyNot.exp()` | no export right: Print for everyone who opens, disabled until built, no title (D-80) | as the app's Print (F7) |
| `#mdDlg`, a native `<dialog>` with `.whead`, `.setbody`, a `<pre>` | the app's `src/ui/components/dialog.tsx` (shadcn) | the app's dialog (PRD) |
| The text from the rendered HTML (`walk`), Mermaid from the model's first 12 logical entities (`mermaid()`) | the tree (MT4) and each figure's content (F1) | rule 1, the PRD's |
| Front matter: `language: English`, `source: live model` or `baseline`, `generated: 2026-11-21 08:05` | `language` a code; live model only | F10 |
| `# {name}`, file from the name (`[^a-z0-9]+` → `-`) | cover title, name; Polish letters | F9 |
| Contents from the `##` headings with GitHub-like slugs | the same, with repeated headings counted | F12 |
| Copy toasts "Markdown copied." on a refusal too | toast after success only | F25 |
| The sample's faults (rules 1 to 9) | – | the rules |

Nothing else of the prototype changed for this slice.

## 5. Earlier specs and tests, by step

- **Step 2** (the tree's additions and the renderer): unit tests `tests/document-tree.test.ts`, `document-figures.test.ts`,
  `document-figures-3.test.ts`, `document-figure-html.test.ts`, `document-html.test.ts`, `document-sections-26.test.ts`,
  `document-style.test.ts`, `document-hints-28.test.ts`, `src/domain/document/page.test.ts`,
  `src/modules/infodocumenter/domain/*.test.ts`, `tests/layer-rules.test.ts` (a new domain file), the contract suite
  (F23). **Expected changes: none** (the additions are new fields; a test comparing a whole `DocFigure` or table node
  with `toEqual` would need the new field: none found by a search for whole-node comparisons, checked again in step 2).
  e2e: InfoDocumenter's `e2e/slice-25` to `slice-28` and InfoCube's star (`S27-05`) cover the PDF; they must pass
  unchanged.
- **Step 3** (the button and the dialog): `e2e/slice-26/S26-01.spec.ts` (Print in a read-only document),
  `e2e/slice-28/S28-01.spec.ts`, `S28-02.spec.ts` (the bar's toggles at its ends), `S28-06.spec.ts` (every control named),
  `e2e/slice-30/S30-09-editor.spec.ts` (the save pair in the editor's bar), `e2e/slice-32/*` (the theme around the
  editor), `e2e/slice-25/S25-02.spec.ts`, `S25-07.spec.ts` (the editor's bar). **Expected changes: none** (the button goes
  between existing ones in a bar that wraps; no test counts the bar's buttons).

## 6. The plan for steps 2 to 4

**Step 2 – the renderer and its tests** (a draft PR into `dev` at its start, CLAUDE.md).
1. The tree's additions: `DocFigure.content` (F1, `figure.ts`, `figure-node.ts`, `content.ts`), the long columns (F2,
   `blocks.ts`, `builders.ts`, InfoCube's `document-section.ts`), `ModuleLineData.status` (F20, `line-data.ts`, InfoCube's
   `canvas/lines.ts`); the PDF-unchanged test first (it fails on nothing, then guards).
2. The renderer: `src/modules/infodocumenter/domain/markdown.ts` (the tree to text: front matter, title, contents,
   sections, runs, tables, lists, escaping, the heading stack) and `mermaid.ts` (a figure's content to an `erDiagram`
   block and its list), pure, in InfoDocumenter's domain; InfoCube's words through its section's words (no module named).
3. Mermaid's parser as a dev dependency (Q4), and the tests of Q7; F19's measurement on the demo and Performance test.
4. A full run (the PRD's step 2; the step changes how every figure is built, if not what it draws). Report: the specs, CI,
   the full run's link and figures, the sizes of the demo's Markdown and of the largest block.

**Step 3 – the button and the dialog.**
1. "Markdown" in the editor's bar (F7), the dialog with the app's `Dialog`: the sentence, the monospaced box, the line,
   Copy (F25), Download .md (F9's name, `text/markdown;charset=utf-8`), the close button; built at the click (D1).
2. e2e `e2e/slice-34/` (one spec per criterion: S34-01 the button, its state as Print's in a read-only document and
   while building, the dialog, Copy with the clipboard read back, Download's name and content; S34-02 and S34-03 the
   dialog's text against the rules on the demo's documents, a sample of what the unit tests check fully).
3. A full run. Then **Łukasz's acceptance** on `npm run dev:pg` with a demo account: the three demo documents' Markdown,
   Copy into a text editor, the file in VS Code's preview and on GitHub (a secret gist) with every diagram drawn. **Stop**
   with what he saw.

**Step 4 – the closing.** D-86 and AD-31's note quoted in full; CLAUDE.md (the extension point's field, the renderer's
place, the test regime's new folder, "Łukasz's test model" housekeeping); `ideas.md`, `known-limitations.md` (Mermaid's
limits, F12, F18, F19), `inventory-prototype-vs-app.md`, README. One full run on the final commit. Merge and tag
`slice-34` only on Łukasz's command (`pg:backup` before the merge only if KB changed since the last backup).

**Full runs:** steps 2, 3 and 4, as the PRD lists them. Strictly by "Test runs" none of the steps touches shared
infrastructure, so step 2 would need only the InfoDocumenter folders; the PRD's full run in step 2 is kept because a
change in `figureDrawing` reaches every figure and the e2e runs are cheap in CI.

## 7. For Łukasz to decide

1. **D1 (Q6, F8):** the Markdown from the editor's tree at the click, no request ("the model as read when the editor
   opened", as Print), and S34-01 reworded accordingly. Recommended: yes.
2. **D2 (F2):** "Under row" long texts become a column at the table's end in the Markdown (recommended), or a list under
   the table.
3. **D3 (F10):** the cover's subtitle, client, version, status and prepared-by in the front matter when set. Recommended:
   yes.
4. **D4 (F19):** a block too large for Mermaid drawn with headers only and a line saying so (recommended), or a known
   limitation.
5. **D5 (F21):** the bus matrix's counts row named "Used by facts" in the tree, so in the PDF too (a visible change of the
   PDF), or left empty in both. Recommended: left empty (S34-04 says the PDF looks as today).
6. **The tree's three additions** (F1, F2, F20): they change InfoMapper's content tree and one extension point of
   InfoCube, additively; the PRD assumed no change ("without changing the tree", Q1). OK?
7. **F9:** the file name from the document's name with Polish and German letters transliterated, and S34-01's "title"
   read as "name". OK?
8. **The e2e recut** (Q8): part 9 is the longest by more than a minute; a `chore/recut-e2e-parts` branch from `dev` before
   step 3 (recommended: the slice's folder then lands in the recut part), or after the slice.
9. **Azure DevOps** (S34-02, S34-03 name it): can you open the Markdown in an Azure DevOps wiki or repository in step 3?
   CC cannot; without it, Azure DevOps rests on Q4's documented syntax and version only (a known limitation).

## 8. Łukasz's answers (21 November 2026)

Łukasz decided D2, D3, D4, D5, F7, F9, F18 and the purpose; the technical calls (D1, the three tree additions, the
parsers, F11, F13, F15, F16, F17, F23, F25 and the e2e recut) are CC's, quoted for his approval at the closing.

- **The purpose (Łukasz):** the `.md` file is for exchange: he gives it to someone who renders it in their own tool (VS
  Code, Obsidian, Typora, GitLab, Notion, a Confluence plugin, mermaid.live). **GitHub and Azure DevOps are not targets.**
  The Mermaid must be as portable as possible: only syntax that parses on old and new versions. Item 9 (Azure DevOps)
  falls away.
- **The parsers:** `mermaid@9.4.3`, `mermaid@10.9.5` and `mermaid@12.3.0` as dev dependencies (npm aliases); every block
  must parse on all three (replaces Q4's proposal of two).
- **D4: yes**, with a threshold sensible for any tool, not GitHub's (step 2 proposes it).
- **A line under the title**, in the document's language: "Diagrams are Mermaid code blocks: open the file in any
  Markdown tool that renders Mermaid (VS Code, Obsidian, GitLab, mermaid.live)."
- **S34-02 and S34-03:** "reads well and renders in common Mermaid tools; every block parses on old and new Mermaid", in
  place of naming GitHub and Azure DevOps.
- **D1: yes**, from the editor's tree at the click, no request; S34-01 reworded to match.
- **D2:** a column at the table's end. **D3:** yes. **D5:** the count row unnamed, the PDF as it is.
- **The three tree additions (F1, F2, F20): accepted**, with a test that the HTML is unchanged.
- **F9: yes**; S34-01's "title" becomes "name". **F7, F11, F13, F15, F16, F17, F18** (a known limitation), **F23, F25:
  accepted.**
- **The e2e recut:** on its own `chore/` branch with its own full run, before step 3; CC says so before starting it.
- **Step 3's acceptance:** VS Code's Markdown preview with a Mermaid extension, and mermaid.live (demo data only).

## 9. Step 2: the renderer and its tests (21 November 2026)

**What was built.**
- **The tree's three additions** (F1, F2, F20), read by no HTML code:
  - `DocFigure.content` (`FigureContent` in `src/domain/document/content.ts`) is filled by `figureDrawing` (`figureContent`
    in `figure.ts`) from the same cards, frames and lines as the SVG. It holds:
    - the cards with their shown names, roles and rows (none for a collapsed card or a collapsed frame's member);
    - the frames;
    - the relationships (a bundle as its single relationships) and the source keys with their columns;
    - the mappings with status, transformation, rule and type problem;
    - the module lines;
    - the requirement cards with what their trace lines reach.
  - A table's `long` and a row's `longCells` come from `longTextTable` (in "Under row" mode), from the dictionary's
    definitions and from InfoCube's dimension definitions. InfoCube's words gain `definition` (Definition, Definicja,
    Definition).
  - `ModuleLineData.status` is optional and set by InfoCube's `cubeLines`.
- **The renderer:**
  - `src/modules/infodocumenter/domain/markdown.ts`: `documentMarkdown`, `markdownFileName`, `localTimestamp`,
    `escapeText`, `codeSpan`.
  - `mermaid.ts`: `erDiagram`, `figureDiagram`, `MERMAID_MAX_CHARS`, `attributeWord`, `typeWord`, `mermaidMarkers`.
  - Both are pure and in InfoDocumenter's domain.
  - New words in `labels.ts`: `md_note`, `md_frames`, `md_mappings`, `md_cube`, `md_reqs`, `md_roles`, `md_entities`,
    `md_typeProblem`, `md_tooLarge` and `md_tooLargeAll`. The German ones are for Łukasz's review.
- **The parsers:** dev dependencies `mermaid-v9` (9.4.3), `mermaid-v10` (10.9.5) and `mermaid-v12` (12.3.0), as npm
  aliases. Each one's `parse` runs in Vitest's Node environment, with no DOM.
- **The tests:**
  - `tests/document-markdown.test.ts` (33 tests): the nine rules as checks over the text. They run on:
    - the demo's three documents;
    - every section type in each dictionary layout and long-text mode (9 documents);
    - Polish and German;
    - requirements as a table with traceability as a matrix;
    - frames with Polish names, in English and Polish;
    - the sample's stage 1 document;
    - Performance test's 100 cards (D4).

    Every block is parsed on all three versions, and a refused block proves the check can fail.
  - `tests/document-markdown-html.test.ts`: the HTML, both the pages and the quick sheet, is equal with and without the
    additions on 13 documents.
  - `tests/contract/reads.test.ts`: the demo documents' Markdown from each adapter's snapshot is equal (F23; on Postgres in
    the Schema workflow).
  - The shared documents are in `tests/lib/markdown-documents.ts`.
- **The PDF against `dev`'s own code:** a one-off run rendered the HTML of 14 documents, as pages and quick sheet, both
  with `dev` at `76b4bfb` (a temporary worktree) and on this branch. All 28 SHA-256 values were equal.
- **The output:** `docs/prd/slice-34-output.md`. It is the sample's "Retail Co – stage 1 documentation" on the demo data:
  the sample's sections in its order, with Diagrams showing every canvas as on the canvas.

**D4's threshold (proposal for Łukasz): 40,000 characters a block.**
- Why that number: Mermaid's `maxTextSize` is 50,000 by default in every version. The tools that render Mermaid keep the
  default, and above it a tool draws an error instead of the diagram. 40,000 leaves room for a tool that counts the
  fence or the line ends.
- Over 40,000, the block is written with headers only, and the line `md_tooLarge` stands under it. If even that is over,
  there is no block: the line `md_tooLargeAll` and a list of the entities take its place.
- Measured:
  - every demo block is under 25,000 (the largest is PERF-2 with all rows, 24,589);
  - Performance test's 100-card canvas is 79,396 with attributes and 4,390 with headers only, so it is written with
    headers only.
  - The demo's every-section document is 44 KB and takes 14 ms; Performance test's figures are 165 KB and take 24 ms.

**Where the build differs from the plan.**
1. **`d3` pinned for the parsers:** `overrides.d3 = "7.9.0"` in `package.json`.
   - Why: Mermaid's newest `d3` (7.9.2) requires the newer patch versions of nine `d3-*` packages. React Flow uses those
     packages, so npm moved the canvas's `d3-zoom`, `d3-selection`, `d3-drag` and others (e.g. 3.0.0 to 3.0.1).
   - With the override, no package of the app's tree changes version. A script compared the lockfile's entries before and
     after: 0 changed. `npm ci` passes.
2. **A `"` in a Mermaid name** becomes `'`. The plan also wrote the real name in a `%%` comment; I left that out, because
   the apostrophe reads the same.
3. **The front matter** has a `title` when the cover's title differs from the document's name (MT1 names only
   `document`).
4. **The line on Mermaid** stands under the title in every document, as decided, including one without a figure.
5. **`md_busUsers`** was not added (D5: the count row stays unnamed). The planned `md_srcKeys` is unused: source keys are
   relationships inside the block, so no list is needed.
6. **A dimensional mapping's chip** is written as the figure draws it: "· ƒ", and "· L" for a lookup.
7. **Mermaid's markers in a table** are code with `|` escaped. Without the escape, a `|` inside code still splits a GFM
   cell.
8. **The output file** cannot be "the demo's 'Retail Co – stage 1 documentation'": the demo has no such document (its
   three are the dictionary, S2T and Anna's). I built it from the sample's section list, with "Changes since …" left out
   (baselines come later).
9. **A type with a comma** (`decimal(18,2)`) is written as its name (`decimal`), the full type in the attribute's comment.
   The same holds for `varchar(max)`: the length has to be digits.

**Earlier tests changed:** none. The whole unit suite passes unchanged (2,468 tests), and the contract suite's local
part passes (9 tests).
