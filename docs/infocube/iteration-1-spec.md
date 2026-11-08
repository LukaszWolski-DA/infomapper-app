# InfoCube – prototype iteration 1: behaviour spec

Łukasz · 1–4 November 2026 · status: iteration 1 built in the prototype

## Purpose and status

This spec records what the first InfoCube iteration of the prototype shows and why. It was accepted by Łukasz before
the prototype was built, then kept in step with the build; where the two ever disagree, the prototype wins (CLAUDE.md).

- **What it is for.** The prototype (`docs/prototype/infomapper-prototype-with-sources.html`) is the source of truth
  for behaviour. This iteration extends that same file with InfoCube, on the same demo data.
- **What it is not.** It is not an app slice PRD. No migration, no app code. The data model section describes the
  prototype's in-memory model and the intended direction for the app; the app's tables are designed when InfoCube
  becomes a slice.
- **Language.** English, as every document in the repository.

## Decisions

All seven decisions are taken (1 November 2026): C-1 and C-2 in the discussion, C-3 to C-6 when Łukasz accepted this
spec's proposals, C-7 when InfoCube became a paid option. They belong in `decisions.md` before the slice.

| # | Decision |
| --- | --- |
| C-1 | **One application.** InfoCube is a module of the InfoMapper application, in the same code repository and database. Its code sits apart (e.g. `src/modules/infocube/`), and InfoMapper's code never imports from it; a lint rule checks this. |
| C-2 | **Facts and dimensions are InfoMapper entities with a model level.** Their dimensional description (grain, measures, SCD) lives only in InfoCube's own data. |
| C-3 | **The name is "model level"**, values *Logical* and *Dimensional*. "Layer" is already the canvas's layer mode (D-01, D-22). Every existing entity is *Logical*. |
| C-4 | **Principle 2 reworded:** "InfoMapper knows an entity's model level but not what the dimensional level means. InfoCube's data points to InfoMapper's, never the other way." The model level is the one InfoMapper column InfoCube needs. |
| C-5 | **A dimensional entity has a role, Fact or Dimension, instead of a stereotype.** The LDM stereotypes do not apply to it; the role takes the stereotype's place on the card and in the panel. |
| C-6 | **Levels meet only through dimensional mappings.** A relationship joins two entities of the same level. Lineage from LDM to the dimensional model is a mapping from a logical attribute to a dimensional one. |
| C-7 | **Licence and activation.** InfoCube is a paid option: an organization holds the licence; an owner or admin turns it on per workspace (workspace settings, beside Data Vault 2.0 mode). Off by default. Not per project: a project is a view of the workspace's one model. |

**C-7, what "off" means.** Turning InfoCube off, or a licence ending, never deletes anything:

- The Cube tab, New fact, New dimension and dimensional drag targets disappear.
- Facts and dimensions stay on their canvases, **read-only**: a hatched header, a note in their panels, and every
  change to them, their attributes, their relationships or InfoCube's data is refused with one message. Moving cards
  is layout and stays allowed.
- InfoCube **still reports its dependencies** in InfoMapper's delete previews, so deleting from the logical model
  never breaks dimensional mappings unseen.

In the prototype the licence is `org.licences` containing `"infocube"`, the activation is `ws.settings.infocube`, and
a "Prototype: grant / end licence" button in the InfoCube box stands in for buying or ending it. InfoMate holds the
licence; only Retail Co – DWH has InfoCube on, and only it has the demo star.

## Scope

**Iteration 1 (built):**

- Facts and dimensions as dimensional entities: created, edited, deleted, on any canvas.
- A fact's grain (text) and its measures with additivity (additive, semi-additive, non-additive).
- Dimension keys in a fact: an attribute flagged as foreign key, with a fact – dimension relationship.
- A dimension's SCD type (0, 1 or 2), for the whole dimension, with no technical SCD columns.
- Dimensional mappings: logical attribute(s) → a dimensional attribute, direct or with a rule, with the mapping
  statuses.
- InfoCube's dependencies in InfoMapper's delete previews (entity and attribute).
- Hints in a fact's panel.
- Beyond the original plan: the bus matrix, and C-7.

**Next, agreed:** role-playing dimensions (a role name per relationship end, and an explicit link from a fact's key
to its role, replacing the key-name match below).

**Backlog, wanted (Łukasz, 1 November 2026):** junk, bridge and outrigger dimensions; the fact type (transaction,
periodic snapshot, accumulating snapshot); factless and aggregate facts; hierarchies in dimensions.

**Out, on purpose:** changes to resolve from LDM (principle 4) and the model validator as a panel (later); dimensional
mappings straight from a source column; SCD type per attribute, SCD types beyond 0–2, technical SCD columns; reading
LDM from another workspace; DDL or any physical design; a separate canvas type for InfoCube.

## Prototype data model

InfoMapper's entity gets one field; everything else dimensional lives in one InfoCube object that points to
InfoMapper's objects.

**InfoMapper (one change):**

| Object | Field | Values | Notes |
| --- | --- | --- | --- |
| entity | `level` | missing (= logical), `"dimensional"` | Set when the entity is created; never changes (Q-7). |

**InfoCube (`S.cube`):**

| Part | Fields | Rule |
| --- | --- | --- |
| `ents` | `entityId`, `role` (`fact` / `dimension`), `grain` (text, facts), `scd` (0 / 1 / 2, dimensions; default 1) | Exactly one row per dimensional entity. |
| `measures` | `attributeId`, `additivity` (`additive` / `semi` / `non`), `semiNote` ("not additive across …") | Only on attributes of a fact. An attribute with a row is a measure. |
| `maps` | `id`, `from` (logical attribute ids, ordered), `to` (dimensional attribute id), `kind` (`direct` / `transform`), `rule`, `status` (`draft` / `review` / `approved`), `note` | As AD-26: `direct` has exactly one input, `transform` at least one. |

Rows whose InfoMapper object is gone are dropped when the model is indexed; a mapping goes whole when any of its
inputs goes (Q-5).

**Derived, not stored:**

- A **dimension key** is a fact attribute flagged as foreign key. **Built rule, to be replaced by role-playing:** it
  belongs to a dimension when the fact relates to that dimension and the key has the dimension's primary key name
  (`customer_key` → Dim Customer). The fact panel, the hints and the bus matrix use this match.
- A **degenerate dimension** is any other non-measure attribute of a fact (e.g. `order_number`).
- A fact's dimensions are the dimensions it has a relationship with.

**For the app (open, Q-6):** whether dimensional mappings become InfoCube's own table or a second input type on
`mapping_input` (a nullable `attribute_id` beside `source_column_id`, in the style of AD-15).

## Behaviour

InfoCube reuses InfoMapper's cards, panels, drag and undo. Every change is one undo step and needs the rights to edit
the model (owners, admins, modelers; not in an archived workspace) and InfoCube on (C-7).

### B-1 Left panel: the Cube tab

- A fourth tab, **Cube**, shown only when InfoCube is on. It lists Facts, then Dimensions, each grouped by concept,
  with the same row actions as the Model tab; the row's hint says "grain set" / "no grain" or the SCD type.
- At its top: **New fact**, **New dimension**, **Bus matrix**.
- The **Model tab lists logical entities only**.

### B-2 Creating

- **New fact / New dimension** (Cube tab, and the canvas's right-click toolbox: "New fact here", "New dimension
  here") creates a dimensional entity with the name selected for typing.
- **Create dimension from this…** in a logical entity card's context menu: a dialog with the name ("Dim {entity}",
  numbered if taken) and the entity's attributes, all ticked. Create makes a dimension in the same concept with a
  surrogate key `{entity}_key` (Integer, primary key) first, a copy of each ticked attribute, and a direct Draft
  dimensional mapping from each original to its copy; its card lands to the right of the entity.

### B-3 The card

- The role (**Fact** or **Dimension**) with a small cube mark stands where the stereotype stands on a logical card.
- A fact's header has a thicker left edge in the concept colour.
- A fact's measures show **Σ** (additive), **Σ~** (semi) or **∅Σ** (non-additive) on their row.
- The coverage bar counts attributes fed from the logical model ("fed"), not from sources.

### B-4 Panels

A dimensional entity's panel: Role (read-only) instead of Stereotype; no Data Vault section; no "Feeding sources";
"Attributes and their logical feed" instead of "Attributes and their sources"; and an InfoCube section after
Definition.

- **Fact section:** Grain; Measures (each with its additivity); Dimensions (each related dimension with the key that
  carries it, or "no key" in orange); Hints (B-5).
- **Dimension section:** SCD type (0 · keep, 1 · overwrite, 2 · history) with one sentence on the chosen type and a
  note that technical columns are physical; Used by (the facts relating to it, each with its key).
- **Attribute of a fact:** a Measure section: the Measure toggle (a new measure is Additive for Integer and Decimal,
  Non-additive otherwise), Additivity, and "Not additive across" for semi-additive. Non-numeric type: a warning. A
  foreign key turned into a measure: a toast.
- **Attribute of a dimensional entity:** "Comes from the logical model" (its dimensional mappings) and "Add a logical
  attribute" instead of the source sections.
- **Attribute of a logical entity:** "Feeds facts and dimensions", only when it feeds something.
- **Dimensional mapping:** inputs (add, remove), target attribute, Direct copy / Transformation, rule, status, note,
  Delete. Adding a second input makes it a transformation and moves to the rule.

### B-5 Hints in a fact's panel

Read only, each linking to its place; nothing is enforced.

- "No grain yet. Write what one row of this fact stands for."
- "No dimension keys. Relate this fact to a dimension and add its key."
- "{attribute} is a foreign key, but no related dimension has a key with that name."
- "{dimension} is related, but this fact has no foreign key called {key}."
- "{attribute} is a measure but its type is {type}. Measures are usually Integer or Decimal."
- None: "Nothing to check: grain, keys and measures look complete."

### Types (slice 19, D-74)

Added after iteration 1 (`docs/prd/slice-19-infocube-types.md`). A fact's section starts with Fact type (Transaction,
Periodic, Accumulating), Factless fact, Aggregate of and Aggregated by; Measures says "None: a factless fact. Count its
rows." for a factless fact; a snapshot dimension's key is marked "· snapshot". A dimension's section starts with Kind
(Standard, Junk), Outrigger of and Outriggers (derived from relationships between two dimensions), and its SCD type is
now History (0 · keep, 1 · overwrite, 2 · history, Snapshot, with its period). Four hints are added to B-5's: a factless
fact with measures, an additive measure in a periodic snapshot, an accumulating snapshot with no dimension in two roles,
an aggregate related to a dimension its base is not. The card's role names the type ("Fact · Snapshot", "Dimension ·
Junk"); the Cube tab and the bus matrix show "Snapshot · {period}". Bridge dimensions, hierarchies and a dimension's
unknown member come later.

### B-6 Dimensional mappings

- **Drag a logical attribute row onto a dimensional attribute row** to map it (direct, Draft). Onto a fact's or
  dimension's header: a new attribute copied from it, mapped (or, if one has that name, mapped to it).
- **A dimensional attribute dragged onto a logical one** maps too, still logical → dimensional, as a column and an
  attribute already map from either end.
- While dragging, what cannot take the drop is dimmed. Refused drops say why in a toast: a logical attribute onto a
  logical one, a source column onto a fact or dimension, a dimensional attribute onto another dimensional one or onto
  a column.
- The line is in the mappings layer, in the **concept colour of the target, ending in a small diamond**; Draft and In
  review are dashed, Approved solid, a transformation shows ƒ. Click, right-click, Delete and undo work as for
  mappings.

### B-7 Relationships

- Between entities of one level only (C-6). Relating a logical card to a dimensional one is refused: "Facts and
  dimensions relate to each other. To trace a fact to the logical model, map its attributes."
- A new fact – dimension relationship is turned so the dimension is the 1..1 end and the fact the 0..N end.

### B-8 Bus matrix

A dialog from the Cube tab: facts (with their grain) in rows, dimensions (with their SCD type) in columns.

- **●** the fact carries the dimension's key; **○** (orange) related, but the key is missing.
- The footer says how many facts use each dimension; used by two or more: **conformed**; by none: **unused**.
- A name opens the entity; a dot opens the relationship. Derived from relationships and keys; nothing is stored.

## Across the modules

InfoMapper asks modules for their dependencies through one function and shows the rows it gets back; it never reads
InfoCube's data itself (principle 3).

- **X-1 The extension point.** `MODULES.deps` holds module functions; `moduleDependents(kind, id)` (kind `entity` or
  `attr`) returns `[what, happens]` rows that InfoMapper's delete dialogs append to their table. Without InfoCube's
  registration, InfoMapper behaves exactly as before.
- **X-2 Deleting a logical entity:** the dialog adds the dimensional mappings fed by its attributes (deleted, with how
  many approved) and the facts and dimensions that lose their feed.
- **X-3 Deleting a logical attribute:** when it feeds a dimensional attribute, a dialog asks first (its source
  mappings, its dimensional mappings, who loses the feed); otherwise it deletes at once, as before.
- **X-4 Deleting a dimensional entity or attribute:** the same dialogs with InfoCube's rows (role and grain or SCD,
  measures, dimensional mappings, for a dimension the facts that lose it). One undo step brings everything back.
- **X-5 Requirements:** link to dimensional entities and attributes as to logical ones. A requirement's scope runs
  through dimensional mappings to the logical attributes and their sources, on the canvas lens too. Coverage: a
  dimensional attribute is covered when an approved dimensional mapping reads only covered logical attributes.
- **X-6 Left out of the dimensional level:** Data Vault hints and stereotypes; the duplicate-name warning compares
  names within one level; the status bar's "Mapped attributes on canvas" counts logical attributes only.

## Demo data (Retail Co – DWH)

On the existing demo LDM, canvas **Sales star** in the Order management project. The demo LDM has no Date entity, so
Dim Date has no logical feed.

| Entity | Role, concept | Attributes ← logical feed |
| --- | --- | --- |
| Fact Sales | Fact, Sales; grain "One order line" | `date_key` (FK) ← Sales Order.order_date (transform); `customer_key` (FK) ← Sales Order.customer_id (key lookup); `product_key` (FK) ← Order Line.product_id (key lookup); `order_number` ← Sales Order.order_number; `quantity` Σ, `unit_price` ∅Σ, `discount_pct` ∅Σ ← Order Line; `net_amount` Σ ← transform of quantity, unit_price, discount_pct (In review) |
| Fact Orders | Fact, Sales; grain "One sales order" | `date_key`, `customer_key` (FK); `order_number`; `total_amount` Σ ← Sales Order.total_amount; `line_count` Σ ← COUNT of Order Line.order_line_id (Draft) |
| Dim Customer | Dimension SCD 2, Customer | `customer_key` (PK); `customer_number`, `segment_code` ← Customer; `city` ← Customer Address.city (Draft, with a note: which address?); `country_name` ← Country |
| Dim Product | Dimension SCD 1, Product | `product_key` (PK); `sku`, `product_name`, `category_code` ← Product |
| Dim Date | Dimension SCD 0, Reference data | `date_key` (PK), `calendar_date`, `year`, `month`, `day_of_week`; no feed |

- Relationships: each dimension 1..1 – 0..N to Fact Sales; Dim Customer and Dim Date also to Fact Orders, so the bus
  matrix shows them as conformed.
- **REQ-210** "Net sales by customer segment and month" links Fact Sales.net_amount, Dim Customer.segment_code and
  Dim Date.month. Its coverage is 0/3 on purpose: the logical attributes behind them have no source mappings yet, and
  the lens shows them as gaps.

## Acceptance scenarios

Run by hand in the prototype; each change is checked with Undo and Redo too. All pass (4 November 2026).

| # | Scenario | Expected |
| --- | --- | --- |
| IC-01 | Open the Sales star canvas. | Facts, dimensions and LDM cards; dimensional mapping lines from logical rows to dimensional rows; Σ and ∅Σ marks. |
| IC-02 | Open the Model tab, then the Cube tab. | Model lists the six logical entities only; Cube lists facts and dimensions by concept. |
| IC-03 | Cube tab → New fact. | A fact card with its name selected; Role Fact, the hints "No grain yet" and "No dimension keys". One undo removes it. |
| IC-04 | Fact Sales panel: clear the grain. | The hint "No grain yet" appears; Undo brings the grain back. |
| IC-05 | `quantity`: semi-additive, "Date". | The row mark becomes Σ~; the fact's Measures list shows it. |
| IC-06 | Mark `order_number` as a measure. | The hint "order_number is a measure but its type is String…". |
| IC-07 | Drag Product.list_price onto Dim Product's header. | A new attribute `list_price` on Dim Product and a Draft line from Product.list_price; one undo removes both. |
| IC-08 | Drag a source column onto a dimensional attribute; drag Dim Product.sku onto Dim Customer.city. | Both refused, each with its toast. |
| IC-09 | Relate Customer (logical) to Fact Sales. | Refused with the toast of B-7. |
| IC-10 | Delete Order Line from the model. | The dialog adds "5 dimensional mappings – deleted, 4 of them approved" and "Fact Sales loses its feed…". Undo brings all back. |
| IC-11 | Delete the attribute Customer.segment_code. | A dialog asks first; after Delete, Dim Customer.segment_code stays, unfed. |
| IC-12 | Select REQ-210. | The lens lights its dimensional attributes, the logical attributes feeding them and their sources; coverage 0/3. |
| IC-13 | Cube tab → Bus matrix. | Two facts × three dimensions; Dim Customer and Dim Date conformed; names and dots open their objects. |
| IC-14 | Workspace settings: turn InfoCube off; try to rename Fact Sales. | The Cube tab is gone, dimensional headers are hatched, the rename is refused with the C-7 message; deleting a logical entity still works and its preview still lists InfoCube's rows. |

## Questions and answers

| # | Question | Answer (1 November 2026) |
| --- | --- | --- |
| Q-1 | Accept C-3 to C-6? | Yes. |
| Q-2 | A Cube tab, or a "Dimensional" group in the Model tab? | A Cube tab. |
| Q-3 | "Create dimension from {entity}" in iteration 1? | Yes. |
| Q-4 | Naming of facts and dimensions? | Free names; a convention later. |
| Q-5 | One input of a multi-input mapping deleted? | Iteration 1 deletes the mapping. "Stay and go back to review" would change InfoMapper's mappings too, so later. |
| Q-6 | App table for dimensional mappings? | Open: decide with the slice. |
| Q-7 | Can an entity's model level change? | No; create a dimension from it (B-2). |
| Q-8 | "+" per concept in the Cube tab? | Open; new facts and dimensions take the last concept used, as new entities do. |

## Before the slice

- C-1 to C-7 into `decisions.md`.
- Q-6 decided.
- Into `known-limitations.md`: the key-name match (until role-playing) and Q-5.
