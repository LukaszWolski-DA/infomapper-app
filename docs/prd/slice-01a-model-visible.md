# Slice 1a – The model, visible

Status: ready to build · Branch: `slice/01a-model-visible` · Builds on: slice 0 (tag `slice-00`)
Decisions: D-01, D-02, D-22, D-27, D-35 – D-37, D-46, D-47, D-49, AD-05, AD-06, AD-11 – AD-13, AD-17, AD-19, AD-21,
AD-23, AD-24, AD-26 – AD-28, AD-29, AD-30

## Goal

The model of a workspace becomes visible and editable: concepts, entities, attributes, relationships, source systems,
tables and columns, and mappings with one or more inputs. A canvas shows entity and source cards with their rows,
mapping lines and relationship lines, drawn with React Flow under the AD-24 rules. Editing happens in the left and
right panels; editing **on** the canvas (dragging a column onto an attribute, drawing relationships, the Entity tool,
undo) is slice 1b (AD-30).

## Reference

- Behaviour: `docs/prototype/infomapper-model-prototype.html`. For this slice look at: cards and rows, mapping and
  relationship lines, the left panel (Model and Sources tabs), the right panel for entity, attribute, mapping,
  relationship, source table and column, the overview panel when nothing is selected, the status bar, notation
  (crow’s foot / UML), the Overview minimap, zoom and fit.
- Canvas: AD-24 in `docs/decisions.md`, and the spike in `spikes/canvas-react-flow` (`geometry.rowEnd`, `LineLayer`).
  Reuse its ideas and code where they fit; the spike itself stays untouched.
- Data: `docs/data-model-v2.md`, tables `concept`, `entity`, `attribute`, `relationship`, `source_system`,
  `source_table`, `source_column`, `mapping`, `mapping_input`, `canvas_item`.

## In scope

1. CI on GitHub Actions.
2. Domain types, rules and commands for the model tables above.
3. The local adapter extended to these tables; demo model from the prototype; a large generated workspace for
   performance checks.
4. The canvas: cards, rows, mapping lines (including combined mappings), relationship lines, detail by zoom level,
   pan and zoom, fit, Overview minimap, notation switch, selection, moving cards, collapsing cards, row filters.
5. Left panel: Model and Sources tabs, search, folding groups, add to and remove from the canvas, “+” per concept and
   “New concept” (D-46, panel part only), concept rename and delete (D-47).
6. Right panel: details and editing for every element in scope, including mapping inputs (D-49, panel part),
   adding a mapping from the attribute panel, a simple manual “New source table”, deleting an entity with its impact
   dialog (D-47).
7. Status bar: mapped attributes on this canvas, mappings and drafts, type problems, relationships.

## Out of scope (slice 1b or later)

Dragging a column onto an attribute and the D-48 choice · “new attribute from column” by drag · drawing relationships
· the Entity tool and the canvas toolbox · reordering attributes (D-36) · card width resize (D-37, C-09) · hover
highlight and its row dots (C-10) · split and merge of mappings · undo and redo · lasso and multi-selection ·
frames · several projects’ canvas tabs beyond what slice 0 has · labels, notes, requirements, live canvases ·
rich-text editor (definitions are plain text, AD-30) · import of sources · Supabase.

## Rules to implement in the domain

- **Permissions:** model edits need owner, admin or modeler; reviewers may change mapping status (approve) only;
  readers and archived workspaces change nothing (AD-05, AD-09).
- **Four-eyes (AD-06):** when the workspace has it on, the person who last changed a mapping’s inputs, kind or rule
  cannot set its status to `approved`. Message: “Four-eyes is on: someone else has to approve your change.”
- **Mapping inputs (AD-26, D-49):** a `direct` mapping has exactly one input; adding a second input turns it into a
  `transform` and requires a rule before it can be saved; removing inputs down to one keeps it a `transform` until
  the user switches it back to `direct`.
- **Type check (D-01, AD-27):** compare the attribute’s logical type and parameters with each input column; a
  `transform` with a rule is never a type problem. Rules: string ← text types (length check when both have one),
  integer ← integer types, decimal ← decimal or integer (precision and scale checks), date/datetime ← date and time
  types, boolean ← bit/boolean, json ← json or text. Anything else is a type problem with a short reason.
- **Business key (AD-28):** attribute flag; the panel suggests it when an input column is marked BK.
- **Deleting (D-47):** an entity soft-deletes its attributes, their mappings and inputs, and its relationships, in
  one change group; the impact dialog lists attributes, mappings (and how many approved), relationships and the
  canvases and projects it is on. A concept can be deleted directly when empty; otherwise its entities move to a
  chosen concept first. The last concept holding entities cannot be deleted.
- **Duplicate names:** entity names warn (“Another entity is already called …”), never block.
- **Concept colours:** from the workspace palette, never violet (D-41).
- Every command checks the `version`, writes `change_event` rows with one change group, and is unit-tested.

## Demo data

Replace slice 0’s empty model in **Retail Co – DWH** with the prototype’s model: concepts Customer, Sales, Product,
Reference data; entities Customer, Customer Address, Sales Order, Order Line, Product, Country with their attributes,
types, keys and PII flags; source systems CRM, WEB, ERP with their tables and columns (including the BK columns);
the prototype’s mappings with their statuses and rules; its relationships. Place the cards on the two seeded canvases
as the prototype does, without frames (frames come in slice 2). Sales analytics gets the same model; Bank X keeps an
empty model. Keep fixed seed ids (slice 0 rule).

`npm run seed:large` creates an extra workspace “Performance test” for Łukasz with the spike’s generator: 100 cards
(60 source tables, 40 entities), one entity with 200 attributes, 300 mappings, 40 relationships.

## Steps (stop after each one and report)

### Step 0 – CI and the decision record
- GitHub Actions workflow on pull requests and on `main`: `npm ci`, `lint`, `typecheck`, `test`. (End-to-end tests in
  CI come later.)
- Add AD-30 to `docs/decisions.md`, under the stack decisions, with this text:
  “**AD-30** Slice 1 is split: 1a makes the model visible (CI, model in domain and data, demo data, the React Flow
  canvas with cards and lines, editing in the panels); 1b brings modeling on the canvas (dragging mappings with the
  D-48 choice, drawing relationships, creating and deleting on the canvas, attribute order, card width and hover
  highlight C-09 and C-10, undo). Undo is in 1b. The rich-text editor (D-42) comes with requirements; until then
  definitions are plain text stored in the `*_html` and `*_text` columns.”

### Step 1 – Domain
Types for the tables in scope, the rules above as functions, the commands for every panel edit in scope, and their
unit tests (permissions, four-eyes, input counts, type check table, delete impact, concept deletion).

### Step 2 – Data and seed
The local adapter for the new tables with the data model’s checks (unique names where indexed, “exactly one target”
for `canvas_item`, value lists, foreign keys). The demo model and `seed:large`. Adapter tests.

### Step 3 – Canvas display
- React Flow under the AD-24 rules: one node per card; no handle per row; row positions from data; all mapping lines in
  one SVG layer reading positions from React Flow’s store; the report’s CSS rules.
- Entity card: concept colour, stereotype, name, mapped count bar, rows with key badge (PK, FK, both), name (middle
  truncation, D-37), type, PII and BK badges, mapped dot. Source card: system path, table name, rows with type and
  BK badge. Collapsed card shows the header only; row filters All / Mapped / Unmapped / Keys.
- Mapping lines coloured by status as in the prototype; a combined mapping draws its inputs into an ƒ node next to the
  attribute and one line on (D-49). A line whose row is hidden re-anchors to the card header.
- Relationship lines with crow’s foot or UML ends and the label; the notation switch in the top bar (shared, D-22).
- Detail by zoom level below 40%. Pan, zoom 10–300%, fit, and the Overview minimap.
- Clicking a card, a row or a line selects it; the selected element’s lines are emphasised and the rest fade (as the
  prototype does on selection; hover highlight is 1b).
- Dragging a card moves it; the new position is saved through a server action when the drag ends.

### Step 4 – Left panel and the canvas contents
Model tab (concepts with folding groups, counts, sticky headers, search including attribute names, on-canvas dots,
“+” per concept, “New concept”, rename by double-click, the ⋯ menu with delete) and Sources tab (systems and
database.schema groups, search including column names). Click or drag an item to place it on the canvas; “Remove from
this canvas” from the right panel. “Only on this canvas” filter. Entity creation from “+” places the card in a free
spot near the middle of the view and focuses its name (D-46).

### Step 5 – Right panel and editing
- Nothing selected: overview of this canvas (mapping coverage per entity, type problems to look at).
- Entity: name, stereotype, concept, definition (plain text), attributes with their sources, feeding sources,
  relationships, “Add attribute”, “Remove from this canvas”, “Delete from model…” with the impact dialog.
- Attribute: name, type with parameters, flags (PK, FK, BK with suggestion, PII, nullable), definition, mappings
  (“Comes from”) with “Add a source column” to create a mapping, delete.
- Mapping: source and target, Inputs section (order, add, remove; D-49), kind, rule (code field), status, note, type
  check message, delete.
- Relationship: label, cardinality on both ends, swap direction, delete.
- Source table and column: path, type, flags, comment, where it is mapped. “New source table” (system, database,
  schema, name, and columns as lines like `cust_id int` or `email varchar(255)`).
- Panel sections fold and long lists filter (D-35).
- Status bar as listed in scope.

### Step 6 – Acceptance tests, performance check and wrap-up
Playwright tests for every criterion below (`e2e/slice-01a/`), independent of each other. The performance check on
`seed:large` repeats the spike’s C-01 measurement inside the application. Write `docs/prd/slice-01a-acceptance.md`
(results table, manual checklist for S1A-01 to S1A-10, assumptions), update README and CLAUDE.md commands.

## Acceptance criteria

| ID | Criterion |
| --- | --- |
| S1A-01 | Retail Co – DWH › Customer 360 › Customer & orders shows the prototype’s cards and lines: entity and source cards with their rows, mapping lines in status colours, relationship lines. |
| S1A-02 | Every mapping line starts at its column’s row and ends at its attribute’s row, on the facing sides, at 25%, 100% and 300%; a combined mapping shows its ƒ node. |
| S1A-03 | Below 40% zoom cards show header and a plain block, lines keep their ends at the right rows. |
| S1A-04 | Collapsing a card and filtering rows re-anchors hidden rows’ lines to the header. |
| S1A-05 | Dragging a card moves it and its lines; after reload it is still there. |
| S1A-06 | The notation switch changes relationship ends between crow’s foot and UML on every canvas. |
| S1A-07 | From the left panel: create a concept, add an entity with “+”, rename it, add attributes in the right panel, place a source table, add a mapping from the attribute panel; everything persists after reload. |
| S1A-08 | A mapping gets a second input: it becomes a transform and cannot be saved without a rule; with a rule it saves and shows the ƒ node. |
| S1A-09 | Type check: a `varchar(255)` column into a `string(100)` attribute is a type problem with a reason, counted in the status bar; a transform with a rule is not. |
| S1A-10 | Deleting Customer shows the impact dialog (8 attributes, mappings with the approved count, 2 relationships, canvases, projects); confirming removes it everywhere. A concept with entities is deleted only after moving them. |
| S1A-11 | As Piotr (reviewer): no edit controls except the mapping status; approving works; every other edit called directly on the server is refused. |
| S1A-12 | Four-eyes on: the person who changed a mapping’s rule cannot approve it; another modeler can. |
| S1A-13 | “New source table” with columns typed as lines creates the table and its columns with types and lengths. |
| S1A-14 | Performance on `seed:large`, Chrome, same laptop as the spike: pan and zoom at least 50 fps on average with no frame over 50 ms, at overview and at 100%; initial canvas render under 1.5 s. |
| S1A-15 | CI runs on the pull request and passes; lint, typecheck, unit and e2e tests pass locally. |

## Definition of done

All criteria pass, steps were reported one by one, assumptions are listed, Łukasz has clicked through S1A-01 to
S1A-10 and accepted the slice.
