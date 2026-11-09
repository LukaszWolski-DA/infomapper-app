# Slice 20 – Model checks: a validator on the project home, the canvas and the panels

Status: **proposed** (Łukasz, 8 November 2026). **Full path**: no data model change, but a new extension point, a new
derived index and a change to how cards are drawn (AD-24). Branch `slice/20-model-checks`, from `main` at tag
`slice-19`. PRD file: `docs/prd/slice-20-model-checks.md`; step 1 writes `docs/prd/slice-20-acceptance.md`. Test
regime: CLAUDE.md, "Testing".

Written from the docs at slice 19's closing, `docs/ideas.md` ("A model validator", InfoCube's principle 4, slice 18's
decision 2a) and the prototype changed for this slice, which Łukasz accepted on 8 November 2026, **without reading the
code**. **The prototype is the source of truth for behaviour; where this PRD and the prototype differ, ask.**

## 1. Why

The model accepts things that are probably wrong and says so nowhere, or only in one panel: two attributes of one
entity with one name, an attribute calculated and mapped at once, a copied key with no relationship or on the wrong
side, a copy whose original is gone, a fact's hints that nobody opens, and an approved dimensional mapping that the
logical model no longer supports (InfoCube's principle 4: the LDM is InfoCube's upstream). Model consistency (slice 7b)
covers what sources did; nothing covers what the modeller did.

Decisions taken with Łukasz (8 November 2026):
- **Rules** R1 duplicate names, R2 calculated and mapped, R3a–d copies and keys, R4 the facts' hints gathered, R5 the
  logical model under approved dimensional mappings, **computed from the model as it stands (4a)**, split into a High
  group (type conflict) and a Normal group (inputs not covered).
- **Out:** R3e (a foreign key flag without a copy: noise in a hand-built model), R6 ("not approved" for a mapping from a
  column missing from the source: a requirement gap reason, for the slice of small items), 4b (changes read from the
  change log since an approval).
- **Where (B1):** a section of its own, "Model checks", on the project home after Model consistency; consistency is
  unchanged.
- **Marks and panels (Z1–Z9):** a slanted "!" on the card header and on the attribute row, orange for High and grey for
  Normal, drawn on existing elements; a "Model checks" section at the top of the entity, attribute, relationship and
  dimensional mapping panels; on the canvas and in the panels the checks are the whole model's.
- **Reaching them (A, C, F):** a count in the canvas's status bar that opens the details panel at a "Model checks" group
  of the panel without a selection; a link in the project home's stats.
- Nothing is stored, dismissed or changed by a check (read only).

## 2. What to build

### Rules

Every rule reads the model as it stands. A rule's **scope** is a set of entities: on the project home, the live
entities on the project's canvases (as model consistency's scope, Q1); on a canvas and in the panels, the whole model.
Groups are shown High first, then Normal, each in the order below. Texts are the prototype's (`modelChecks`); a line
has a name (`n`) and a detail (`m`).

| Group (id) | Severity | A line for | Line: name · detail | Marks |
| --- | --- | --- | --- | --- |
| **Keys copied the wrong way** (`wrong`) | High | an attribute of the "one" end's entity of a logical relationship whose original is a primary key of the "many" end's entity | `{Entity}.{attribute}` · "copy of {E}.{a}, but {Entity} is the one side of “{verb phrase}”" | its row |
| **Approved feeds broken by the logical model** (`feeds`, InfoCube) | High | an approved dimensional mapping with a type conflict by the app's rule (15c, 15d) | `{inputs} → {target}` · "type conflict: {E.a} is {T}, {E.b} is {T}" | the target's row |
| **Duplicate attribute names** (`dup`) | Normal | each set of two or more attributes of one entity, any level, whose names are equal ignoring case and spaces (Q8) | `{Entity}: {names}` · "{n} attributes, one name" | each row |
| **Calculated and mapped** (`calc`) | Normal | a calculated attribute with a direct mapping (logical) or a feed (dimensional) of its own, any status | `{Entity}.{attribute}` · "calculated from {n}, also {k} mapping(s)" / "feed(s)" | its row |
| **Copies whose original was deleted** (`lost`) | Normal | a copy whose original is deleted (D-63, `lostOriginals`) | `{Entity}.{attribute}` · "copy of {E}.{a}, which was deleted" | its row |
| **Keys copied without a relationship** (`norel`) | Normal | a copy of a primary key in another entity, with no relationship between the two entities (not to itself) | `{Entity}.{attribute}` · "copy of {E}.{a}; {Entity} and {E} are not related" | its row |
| **Relationships without a copied key** (`nokey`) | Normal | a logical relationship between two entities, one end at most one and the other many, whose "many" end holds no copy of each primary key of the "one" end (1:1, many-to-many and self relationships are not checked) | `{one} – {many} ({verb phrase})` · "{many} has no copy of {keys}" | the "many" end's header |
| **Facts to check** (`facts`, InfoCube) | Normal | each hint of each fact in scope (`factHints`, D-68 and D-74) | `{fact}` · the hint's text | the fact's header, or the row the hint names |
| **Approved feeds over logical attributes not yet covered** (`under`, InfoCube) | Normal | an approved dimensional mapping with an input that is not covered by D-31's rule | `{inputs} → {target}` · per input: "{a} reads a column that left the source", "{a} has no approved source mapping" or "{a} is not mapped" | **none** |

A dimensional mapping is in a project's scope when its target's entity or one of its inputs' entities is. The group
hints (one sentence under each title) are the prototype's. The InfoCube groups exist only while InfoCube is on.

### The project home (B1, F)

1. **"Model checks"** after "Model consistency": the title with a count badge; the sentence "What the model itself
   says, for the entities on this project's canvases: names, calculations, copied keys and InfoCube. Computed when this
   page opens; nothing is stored or changed." (without "and InfoCube" while it is off); one box per group as
   consistency's (severity tag, an "InfoCube" tag on the module's groups, title, count, hint, lines); the first 20 lines
   with "Show all {n}" / "Show the first 20"; with nothing to show "Names, calculations and keys agree, and so do facts
   and their feeds. Nothing to look at." A line opens the project's first canvas (in its order) that shows the line's
   entity, else one that shows any entity it names, and selects the line's object (attribute, entity, relationship,
   dimensional mapping), centring its card.
2. **The stats** of the project home end with "! {n} model checks" (orange "!" when any is High), a button that
   scrolls to the section; absent when there are none.

### The canvas (Z1–Z6, A)

3. **Card marks.** A slanted "!" on the header's name line, after the name and before the coverage bar, for every line
   that marks the entity or one of its attributes; and before an attribute row's type for the lines that mark that row.
   Orange when any of them is High, grey otherwise. Its title: "Model checks: {n}" and up to six lines "{group}: {name}"
   (a fact's hint: "{group}: {hint}"), then "…". **No element is added** (a class and a mask or pseudo-element on
   existing elements, as the role's cube and the Σ marks; Q4); the name's fit counts its width (`withClips`). A collapsed
   card keeps the header's mark; below 40 % the header keeps it. Readers and reviewers see the marks.
4. **The status bar** shows "Model checks {n}" after "Open notes on canvas": the lines that name an entity whose card
   is on this canvas, all groups; orange when any is High; absent when none. A click clears the selection, shows the
   details panel (also when hidden; up to 1000 px it slides over) and scrolls it to the group below, which flashes once.
5. **The panel without a selection** has a group "Model checks" before "Needs attention": "For the cards on this
   canvas. Click one to select it.", then the lines (High first) with the "!", the name and a short label (`wrong way`,
   `duplicate name`, `calculated and mapped`, `original deleted`, `no relationship`, `no copied key`, `fact hint`,
   `type conflict`, `input not covered`), the full text as the title; the first 20 with "Show all {n}". A click selects
   the object and centres its card (for a relationship or a mapping, the first of its entities' cards on the canvas).

### The panels (Z7, Z8)

6. **"Model checks"** at the top of the entity, attribute, relationship and dimensional mapping panels, right after the
   panel's kind line, when the object has lines: a box (orange edge when any is High) with the "!", the title and the
   count; one item per line, "**{group}.** {name}: {detail}" (an attribute's own line shows only the detail), High
   first; an item whose object is another one selects it on click. An entity's box also lists its attributes' lines. A
   fact's hints are not repeated (they stay in the Fact section, D-68): the box ends with "1 hint in the Fact section
   below." / "{n} hints …" and is shown for them alone. A line is listed in the panels of: `wrong`, `calc`, `lost`,
   `norel`, `dup` its attributes; `nokey` the relationship and the "many" entity; `feeds` the mapping, its target and
   its inputs; `under` the mapping only.

### Demo seed

7. Its own step in the demo data, as in slices 18 and 19 (seed, reset, `npm run demo`, slice 20's fixtures; not the
   earlier fixtures, Q9), mirroring the prototype's `checksDemo`: the demo's foreign keys Sales Order.customer_id,
   Customer Address.customer_id, Order Line.order_id and Order Line.product_id as copies of their primary keys (if the
   seed has them as plain attributes); Customer.last_order_id, a copy of Sales Order.order_id (wrong way);
   Product.country_code, a copy of Country.country_code (no relationship); Product.Product_Name (a duplicate name);
   Sales Order.total_amount calculated ("Sum of its order lines' net amounts", no inputs) beside its approved mapping.
   Customer Address keeps a hand-typed country_code (Country – Customer Address: no copied key). Only the demo; never
   Łukasz's KB.

**Not in the prototype's behaviour:** its "Copy of" field and `copyOf` / `copyLabel` stand in for slice 10c's copies,
which the app has (D-63): build nothing for them. Its `cmTypeIssue` is a simplification: use the app's type-conflict
rule. Its `srcOk` is the direct rule: use `lookupModel.coverageOf` (calculations included, D-73).

## 3. Data model

None: no table, column, migration or file format. Everything is derived on read.

## 4. Sources

- **Prototype:** `docs/prototype/infomapper-prototype-with-sources.html`, replaced in this slice by the version Łukasz
  accepted (710,238 bytes, SHA-256 `035b566302fd0edcc64c05393ffa96ebd9b395f441f258ad524df9a24af4f88f`), copied in step 1
  with `cmp` and SHA-256. Its new code: `checksDemo`, `CHK_NAME`, `chkAttr`, `isOneEnd`, `cmTypeIssue`, `modelChecks`,
  `chkIndex`, `chkSev`, `chkTitle`, `chkHeadMark`, `chkRowMark`, `chkSection`, `CHK_SHORT`, `canvasChecks`,
  `chkOverview`, `openCanvasChecks`, `checksHtml`, `goCheck`, `copyField` (stand-in only), the click handlers
  (`data-chk-go`, `data-chk-all`, `data-chk-open`, `data-chk-cv`, `data-chk-jump`); in `renderHome` the section and the
  stats' link, in `entCard` and `attrRow` the marks, in `insOverview` the group, in `renderStatus` the count, in
  `insEntity`, `insAttr`, `insRel`, `insCmap` the section; the CSS after `.im-cons`.
- **A prototype fix outside the slice:** `insChange` and `INS_SWAP` (a field left by a click that selects something else
  saved into the new selection, or failed with none). Q10.
- **Decisions:** D-31, D-35, D-39, D-46, D-54, D-56, D-63, D-68, D-69, D-70, D-73, D-74, AD-23, AD-24, AD-33, AD-34.
- **`docs/ideas.md`:** "A model validator", "InfoCube: a dimensional modelling module" (principle 4), "Derivations"
  (decision 2a).

## 5. Steps

Stop after each step; wait for Łukasz. A new session starts only at a step's boundary, reading CLAUDE.md, this PRD and
the acceptance doc.

1. **Reconnaissance and check.** Read the code of the areas this slice touches; answer Q1–Q12 in
   `slice-20-acceptance.md`; every place where the PRD is wrong or differs from the code, a decision or the prototype,
   with a proposal each; the extension point and the index as you would build them; every new UI text; the earlier specs
   each item touches; a plan for steps 2–4. Copy the prototype and the PRD. No application code, no runs.
2. **Rules and index.** InfoMapper's rules in the domain, InfoCube's in the module, joined through the new extension
   point; one index per model (by group, by element for marks and panels); the project's scope; unit tests for every
   rule and its edges; a bench on "Performance test" and the demo (bar proposed in step 1).
3. **Home, canvas and panels.** Items 1–7; the slice's specs and the touched ones; the element guard, a LayerTree read
   and the canvas commit counts (S2C-12, S3A-14-idle, S3B-15-idle); one measuring sitting against `slice-19` (pan and
   zoom, a write that adds and removes a mark), because cards are drawn differently. A full run here only if step 1
   finds that the step touches shared infrastructure.
4. **Close.** The docs and D-75's text quoted for approval; one full run on the final commit (the run before the merge).
   Stop with the manual acceptance steps. Merge and tag `slice-20` only on Łukasz's command.

## 6. Acceptance criteria

Tests in `e2e/slice-20/`, one file per criterion, fresh seed each.

| ID | Criterion |
| --- | --- |
| S20-01 | **Rules.** On the demo: each group's lines as listed in section 2 (Order management's home: 15 lines; `wrong` 1, `dup` 1, `calc` 1, `norel` 1, `nokey` 1, `under` 10, or what step 1 finds the app's seed and coverage give); changing Customer.segment_code to Integer adds the `feeds` line; deleting Sales Order.order_id gives `lost` lines; clearing Fact Sales' grain gives a `facts` line; one undo each takes it back. |
| S20-02 | **Project home.** The section after Model consistency with its badge, groups High first, "Show all" over 20 lines, the empty text on a project without lines; the stats' link scrolls to it; a line opens the right canvas and selects its object, a relationship and a dimensional mapping included; Customer 360 shows only its own scope. |
| S20-03 | **Card marks.** Customer's header and last_order_id's row orange, Sales Order's header and total_amount grey; the titles; a mark appears and disappears with the write and its undo; a collapsed card and a card below 40 % keep the header's mark; an alias on the canvas keeps it; a reader sees the same marks. |
| S20-04 | **Panels.** The section in the entity, attribute, relationship and dimensional mapping panels with the right lines; an entity lists its attributes' lines; Fact Sales without a grain shows only "1 hint in the Fact section below."; an item naming another object selects it. |
| S20-05 | **Status bar and panel without a selection.** "Model checks {n}" per canvas (its cards' lines), orange with a High line, absent with none; a click with a card selected and the details panel hidden shows the panel at the group; a line in the group selects and centres. |
| S20-06 | **Performance and guards.** The element guard against `slice-19` (no element more on "Performance test" or the Sales star); LayerTree layers unchanged; no canvas or miniature commit while idle, panned or zoomed; the status bar's count adds no `ModelCanvas` commit of its own; the bench within its bar; the sitting's figures within the bars of AD-24. |
| S20-07 | CI, the full run before the merge (and one in step 3 if step 1 says so); every earlier test changed, with its reason. |

**Manual acceptance (demo and KB):** the demo's lines; in the KB, the two duplicate names found in slice 17 (2 of 258)
and whatever copies and facts it has; the home, a canvas's count and the panels.

## 7. Questions for step 1

- **Q1.** Model consistency's scope in the app (the prototype's `inScope`: the project's canvases) and where the home
  computes it; the checks reuse that scope. AD-34's logical-only rule stays for consistency; one sentence for checks.
- **Q2.** The extension point: a module's checks through the composition root (as `moduleFeeds`), InfoMapper's rules
  never naming InfoCube; whether `factHints` and the type-conflict rule can run on the server and in the browser
  (sections derive them in the browser through `cubeIndex` today).
- **Q3.** The index on a canvas page: built once per data version (as `requirementFeeds`), where, and what it costs on
  "Performance test"; the bar.
- **Q4.** The marks: `CardData` / `CardRow` fields (`ModuleView.rowMarks` for the module's rows, InfoMapper's own for its
  rules), a CSS mask or a pseudo-element, the width in `withClips`, `shownText`, the block below 40 %, collapsed frames'
  blocks (no mark there, unless step 1 recommends one), the thumbnails (none).
- **Q5.** The status bar: where its counts come from and how the checks' count gets there without re-rendering
  `ModelCanvas` (as `viewCounts`); nothing above the canvas reads layout.
- **Q6.** The panels' section: InfoMapper's panels and the module's mapping panel (`PANEL_SECTIONS`), its place after the
  kind line, readers and reviewers (no actions in it).
- **Q7.** Navigation from the home and the panel's group: the addresses for a relationship and a dimensional mapping
  (`?map=`, `?row=` today), which canvas opens, history places (D-38).
- **Q8.** The duplicate-name rule: the existing warning's normalisation (D-46) and levels; whether `dup` uses it as is.
- **Q9.** The demo seed: whether the seed's foreign keys are copies today; the step function; which fixtures and earlier
  specs see it (counts, the Overview, coverage).
- **Q10.** The prototype's field bug: in the app, typing a mapping's rule and then clicking another mapping, a card or
  empty canvas. If the app has it, a separate `fix/…` branch, not this slice.
- **Q11.** InfoCube off: no module group, no module marks; a workspace without InfoCube rows.
- **Q12.** Every place the PRD's counts depend on the app's coverage (the `under` group), and whether `under` should
  count in the status bar (it has no marks): report the demo's and the KB's numbers.

## 8. D-75 (proposal) and docs

"**Model checks (slice 20).** The model is checked as it stands, read only, nothing stored: duplicate attribute names in
an entity; an attribute calculated and mapped or fed; copies whose original was deleted, primary keys copied without a
relationship or onto the one side, and relationships whose many side holds no copy of the one side's key; with
InfoCube, every fact's hints, approved dimensional mappings whose logical inputs no longer fit their type (High) or are
not covered (Normal). The project home lists them for its canvases after Model consistency, with a link in its stats.
On a canvas a slanted "!" marks the card's header and the attribute's row, orange for High and grey for Normal; the
status bar counts the canvas's lines and opens them in the details panel; the entity, attribute, relationship and
dimensional mapping panels show their own at the top. A fact's hints stay in its panel's Fact section."

Docs: `decisions.md` (D-75; AD-34's sentence), `ideas.md` (the validator's entry done; section 9 as later),
`inventory-prototype-vs-app.md`, `known-limitations.md`, README and CLAUDE.md (status, the extension point).

## 9. Left for later

- A foreign key flag without a copy (R3e); a reason "column left the source" in the requirement panel (R6, slice of
  small items).
- Checks read from the change log since an approval (4b): an input renamed or retyped after it.
- Dismissing a line, with who and why (needs data).
- A "Show checks" view that fades everything else (as the Changes view); next and previous line on the canvas.
- Marks on relationship and mapping lines; a switch to hide the marks; marks in collapsed frames' blocks.
- Source-side and Data Vault checks; a dimension's unknown member (slice 19's decision 5b).
