# Slice 15 – InfoCube, iteration 1: facts and dimensions in the application

Status: **step 1 done and answered** (Łukasz, 4 November 2026); updated to the answers and cut into four sub-slices
(section 0). PRD file: `docs/prd/slice-15-infocube.md`; step 1's review: `docs/prd/slice-15-acceptance.md`. Branch
`slice/15-infocube` for step 1; each sub-slice has its own branch (section 4). Start: `main` at tag `slice-14b`
(A1 holds).

## 0. Answers to step 1 (Łukasz, 4 November 2026)

Where this section and a later one disagree, this section wins; the later sections are updated to it where they are
named. Findings (F), extension points (E), questions (O, Q) and differences (P) are those of `slice-15-acceptance.md`.

- **O1.** `src/compose/` is the only composition root: InfoMapper's layers never name a module; `app` imports
  `compose`, which lists the modules and hands their hooks down as arguments and context. **S15-01** becomes: the lint
  rule fails a file of InfoMapper's that imports the module; the existing specs pass with the module registered and no
  InfoCube data; a unit test checks that every hook returns nothing with an empty registry.
- **O2.** As the prototype: the InfoCube box is always shown in the workspace settings. Without a licence its check box
  is disabled with "{organization} has no InfoCube licence."; modelers (and reviewers, readers) see it disabled.
- **O3.** ~~Undo and redo are let through while InfoCube is off.~~ Dropped by the change to C-7 below.
- **O4.** (Without effect since the change to C-7 below: while InfoCube is off there is no dimensional target.) As the
  prototype: while InfoCube is off the dimensional drag targets still light, and the drop is refused with
  the C-7 message. The spec's "no dimensional drag targets" is a known difference (acceptance doc).
- **O5.** The Sales star is a step for development (`npm run seed`, `reset-dev-data`) and for slice 15's specs only;
  earlier specs' data has no InfoCube data and no licence.
- **O6.** An attribute is pasted within one level only; a paste across levels is refused.
- **O7.** REQ-210 keeps its key; the requirement counter stays at 106.
- **O8.** InfoCube's rows reach the page without `created_*` and `updated_*`, with `version`, as frames and notes do
  (`FrameData`, `NoteData`).
- **O9.** Reviewers approve dimensional mappings (their status), with four-eyes, as for InfoMapper's mappings (AD-05,
  AD-06). A deliberate difference from the prototype (section 8).
- **O10.** Four sub-slices, 15a to 15d (section 4).
- **O11.** AD-33 to AD-36 and D-67 to D-69 are reserved; each enters `docs/decisions.md` at the closing of the sub-slice
  that builds it, one D-decision per sub-slice: AD-33, AD-34, AD-35 and D-67 in 15a (entered 4 November 2026); D-68 in
  15b; D-69 with AD-36 in 15c (Łukasz, 4 November 2026).
- **O12.** D-51's first rule applies to dimensional mappings (15c): a change of inputs, kind or rule sends an approved one
  back to review and clears its approval; a note alone does not. The prototype lacks it (section 8).
- **O13.** ~~The read-only check while InfoCube is off~~ (dropped by the change to C-7 below) refuses writes to dimensional entities and attributes, to
  relationships with a dimensional end, and to InfoCube's description rows (`cube_entity`, `cube_measure`, later
  `cube_mapping`, `cube_mapping_input`). Deletes of dimensional mappings pass only as the cascade of a command on a
  logical object, so S15-04's "deleting a logical entity works" holds. Domain tests cover it.
- **The change to C-7 (Łukasz, 4 November 2026), in place of the read-only mode:**
  - InfoCube is turned off only while the workspace has no facts or dimensions (live dimensional entities); otherwise
    refused, in the panel and by direct call, with (proposal, for Łukasz's approval) "InfoCube can be turned off only
    when this workspace has no facts or dimensions. It has {n}: delete them first."
  - While it is off, every path that creates or brings back a dimensional entity is refused: create, copy, paste, undo
    and redo. Nothing else needs a read-only check (there is no dimensional entity to change), so O3 and O13 are dropped.
  - Ending a licence: no command in this slice (`docs/known-limitations.md`).
  - Copying a workspace and transferring it to an organization without the licence (AD-09): not built; the acceptance
    doc checks what the code allows and proposes a rule.
  - The spec's IC-14 no longer matches (acceptance doc); the spec is not edited.
- **Q16.** The dimension key by the key-name match, as one domain function, listed in `docs/known-limitations.md` until
  role-playing replaces it (15b).
- **On the risks.** 15a starts with the table registry and a guard test: every table in the schema is known to undo and
  to the local adapter, or the build fails. Łukasz's KB file is backed up before the branch's first dev or e2e run; what
  `readDb` on `main` does with a newer format is reported (and listed if it does not refuse).
- **The rest of the acceptance doc's proposals** stand as written there: M1 for dimensional mappings (Q5), the
  extension points E1–E25, the level rules of Q4, F1–F21.

This PRD was written from the docs at slice 14b's closing (3 November 2026), from the InfoCube prototype and from its
behaviour spec, **without reading the code**. It is the largest slice so far and touches almost every part of the
application. Step 1 is therefore mostly an inventory: where InfoMapper's code has to let a module in, what each of those
places costs, and how the work splits into sub-slices that can each be accepted on their own.

## 1. Why this slice

InfoCube is the dimensional modelling module agreed on 31 October 2026 (`docs/ideas.md`, "InfoCube: a dimensional
modelling module"). Its first iteration is built in the prototype and accepted (all of IC-01 to IC-14 pass, 4 November
2026). This slice brings that iteration into the application.

**Agreed with Łukasz (C-1 to C-7, 1 November 2026; to enter `docs/decisions.md` in this slice, section 10):**

- **C-1. One application.** InfoCube is a module of InfoMapper: same repository, same database. Its code sits apart
  (e.g. `src/modules/infocube/`), and InfoMapper's code never imports from it; a lint rule checks this.
- **C-2. Facts and dimensions are InfoMapper entities with a model level.** Their dimensional description (grain,
  measures, SCD) lives only in InfoCube's own data.
- **C-3. The name is "model level",** values *Logical* and *Dimensional*. "Layer" is the canvas's layer mode (D-01,
  D-22). Every existing entity is *Logical*. The level is set at creation and never changes (Q-7 of the spec).
- **C-4. One-way dependency.** InfoMapper knows an entity's model level but not what the dimensional level means.
  InfoCube's data points to InfoMapper's, never the other way. The model level is the one InfoMapper column InfoCube
  needs.
- **C-5. A dimensional entity has a role,** Fact or Dimension, instead of a stereotype.
- **C-6. Levels meet only through dimensional mappings.** A relationship joins two entities of the same level.
- **C-7. Licence and activation.** An organization holds the licence; an owner or admin turns InfoCube on per workspace
  (beside Data Vault 2.0 mode). Off by default. Off never deletes anything: facts and dimensions stay, read-only, and
  InfoCube still reports its dependencies in InfoMapper's delete previews. **Changed on 4 November 2026** (section 0):
  InfoCube is turned off only without facts or dimensions, and while off nothing creates or brings one back.

**Principles from `docs/ideas.md` that this slice must keep:** InfoMapper works without InfoCube (principle 2);
impact analysis crosses the modules through one extension point (principle 3); requirements and concepts are shared
(principle 5). Principle 4 (LDM changes reaching InfoCube as changes to resolve) is **not** in this slice (section 9).

## 2. Sources

**Behaviour (the source of truth for this slice):**

- **The prototype with InfoCube:** `docs/prototype/infomapper-prototype-with-sources.html`, replaced in this slice by
  the version from Łukasz's project knowledge (637,514 bytes, SHA-256
  `6e8e9b95ef5c5bae2c53817e0d2aa734fef3511018a1e68fae6491dd151b37d3`). Its InfoCube code: `isDimE`, `cubeOn`,
  `cubeLicensed`, `CUBE_OFF`, `MODULES.deps`, `moduleDependents`, `cubeDependents`, `relatedDims`, `factKeys`,
  `factHints`, `cubeEntitySection`, `cubeMeasureSection`, `cubeAttrSection`, `insCmap`, `cubeDemo`, `cubeDemoV2`,
  `cubeIndex`, `createCubeMap`, `askDimFrom`, `createDimFrom`, `createRel`, `cubeTouched`, `permitChange`, `cubeTree`,
  `openBusMatrix`, the dimensional lines in the line layer (the `cmap` group, `.cube-end`), and the requirement scope
  lines (`sc.up`, `sc.cmaps`, `attrOk`, `attrFed`).
- **The behaviour spec:** `infocube-iteration-1-spec.md` (18,790 bytes, SHA-256
  `f9647a12375c4cda2c2c690b619c75cc3e5a696b908d03b51b16a7d5c0002033`), to be put into the repository in step 1 (Q1
  proposes where). Its sections are referred to below as B-1 to B-8, X-1 to X-6, IC-01 to IC-14, Q-1 to Q-8.

**Known differences between the spec and the prototype** (checked in headless Chromium, 4 November 2026; the prototype
wins, CLAUDE.md):

- **IC-10's expected text is out of date.** Deleting Order Line shows "**6** dimensional mappings – deleted, 4 of them
  approved" and "**Fact Orders, Fact Sales** lose their feed from the logical model"; the spec was written before
  Fact Orders (`cubeDemoV2`) fed `line_count` from Order Line. S15-12 uses the prototype's figures.
- **B-5 has one more variant in the prototype:** "{dimension} is related, but this fact has no foreign key for it (the
  dimension has no primary key yet)."
- **A prototype bug not to copy:** with two relationships between one fact and one dimension, `cubeDependents` lists
  the fact twice ("3 facts – lose this dimension: Fact Sales, Fact Orders, Fact Sales"). The application lists each
  fact once. (Two such relationships are role-playing, section 9; they can be drawn today.)

**Decisions:** D-01, D-07 (bundles), D-22, D-36, D-37, D-38 (history places), D-46, D-47, D-48, D-49, D-51, D-52, D-61,
D-63, D-64, D-66; AD-05, AD-06, AD-08, AD-09, AD-12, AD-13, AD-14, AD-15, AD-18, AD-19, AD-23, AD-24, AD-26, AD-29,
AD-31.

**Data model:** `docs/data-model-v2.md`: `organization`, `workspace` (`dv2_mode`, `four_eyes`), `entity`
(`stereotype`), `attribute`, `relationship`, `mapping`, `mapping_input`, the requirement links (AD-15), the local data
file's formats.

**Earlier slices:** 1b (drag to map, relationships, undo), 2c (bundles), 4a, 4b-1, 4b-2 (requirement scope, coverage,
lens, cards), 7a and 7b (mappings sent back to review, changes to resolve), 7c (Data Vault reading), 8 (organizations,
owners and admins), 10a (self-relationships, the save chain for canvas writes), 10c (copy and paste of an attribute,
the delete preview's second click), 11 (aliases), 13 to 14b (drafts on the save chain).

## 3. What to build

Behaviour is the prototype's and the spec's unless this section says otherwise. Texts in quotes are the prototype's.
The steps that build them list every new user-facing text for approval.

### Module boundary (C-1, C-4)

1. **InfoCube's code in a folder of its own** (proposed `src/modules/infocube/`), with InfoMapper's code never
   importing from it. A lint rule in `eslint.config.mjs` checks this, as it checks the layers (AD-19). Step 1 proposes
   how the module's own code follows the layers (Q2).
2. **One registration point** where the application wires the module in (the composition root), and **named extension
   points** in InfoMapper for everything InfoCube adds to it: delete previews (X-1), panel sections, the left panel's
   tab, marks on cards, a line kind, drag targets and refusals, menu items, the requirement scope, C-7's
   check on what adds or brings back a fact or dimension. Without the registration InfoMapper behaves exactly as before. Step 1 lists them and proposes the smallest
   set (Q3).

### Data

3. **`entity.model_level`** (proposal): text, not null, default `logical`, CHECK in (`logical`, `dimensional`). Set on
   create, never changed by any command. The only InfoMapper column InfoCube needs (C-4). A dimensional entity's
   `stereotype` is not shown or used (C-5); step 1 says what it should hold (Q4).
4. **InfoCube's tables** (proposal; names to confirm in step 1), each with the standard columns and `workspace_id`
   (AD-10, AD-12):
   - `cube_entity`: `entity_id` (FK, unique among non-deleted rows), `role` (`fact`, `dimension`), `grain` (text,
     facts), `scd_type` (smallint 0, 1, 2, dimensions; default 1). Exactly one row per dimensional entity.
   - `cube_measure`: `attribute_id` (FK, unique), `additivity` (`additive`, `semi`, `non`), `semi_note` (text). Only on
     attributes of a fact.
   - **Dimensional mappings:** logical attribute(s) → a dimensional attribute, `kind`, `rule_expression`, `status`,
     note, approval. **Their table is Q-6 of the spec, to be decided in step 1** (Q5): InfoCube's own pair
     (`cube_mapping`, `cube_mapping_input`) or a second input type on `mapping_input`.
5. **Licence and activation (C-7):** the organization's licences (proposal: `organization_licence` with
   `organization_id`, `module` CHECK in (`infocube`)) and `workspace.infocube` (boolean, default false, beside
   `dv2_mode`). Step 1 proposes the shape and how a licence is granted in development (Q6).
6. **A new migration;** applied migrations are never edited; every new table enables row level security; the AD-31
   schema check passes.
7. **The local data file's next format:** every entity `model_level = 'logical'`, every workspace `infocube = false`,
   no licences, empty InfoCube tables; no change events; a backup of Łukasz's KB model before the first upgrade.
8. **Cascades in the domain (AD-23):** deleting an entity or attribute soft-deletes the InfoCube rows that point to it in
   the same change group, so one undo brings everything back. A dimensional mapping goes whole when any of its inputs
   goes (Q-5 of the spec). Where the prototype drops orphans when indexing, the application deletes them in the command.

### Behaviour (B-1 to B-8, X-1 to X-6)

9. **Licence and activation (C-7, as changed on 4 November 2026):** the setting in workspace settings for owners and
   admins, always shown, disabled without the licence (O2). Turning it on needs the organization's licence; turning it
   off is refused while the workspace has facts or dimensions, with "InfoCube can be turned off only when this workspace
   has no facts or dimensions. It has {n}: delete them first." (proposal), in the panel and by direct call. Off: no Cube
   tab, no New fact or New dimension, and no fact or dimension exists; every path that would create or bring one back
   (create, copy, paste, undo, redo) is refused by the domain with "InfoCube is off in this workspace, so no fact or
   dimension can be added or brought back. An owner or admin can turn it on in the workspace settings." (proposal).
   Delete previews list InfoCube's rows (a fact's delete while InfoCube is on).
10. **The Cube tab (B-1)** with New fact, New dimension, Bus matrix; facts, then dimensions, by concept, with the Model
    tab's row actions. **The Model tab lists logical entities only.**
11. **Creating (B-2):** New fact and New dimension in the Cube tab and in the canvas toolbox ("New fact here", "New
    dimension here"); "Create dimension from this…" in a logical card's header menu, with its dialog. One undo step
    each.
12. **The card (B-3):** the role with its cube mark where the stereotype stands; a fact's thicker left edge; Σ, Σ~, ∅Σ
    on measure rows; the coverage bar counting rows fed from the logical model.
13. **Panels (B-4)** for dimensional entities, their attributes, logical attributes that feed them ("Feeds facts and
    dimensions"), and dimensional mappings.
14. **Hints in a fact's panel (B-5)**, read only, with the prototype's variants. **The dimension key is derived by the
    key-name match** (the spec's "built rule, to be replaced by role-playing"), in one domain function, so role-playing
    replaces one function; listed in `docs/known-limitations.md`. Q16 asks Łukasz to confirm.
15. **Dimensional mappings (B-6):** drag in both directions, onto rows and headers, dimmed targets and the refusal
    toasts; the line in the target's concept colour with a diamond end, dashed until Approved, ƒ for a transformation;
    click, right-click, Delete and undo as for mappings.
16. **Relationships (B-7):** same level only, with the toast; a new fact – dimension relationship turned so the
    dimension is the 1..1 end. The refusal is the domain's too.
17. **The bus matrix (B-8):** derived, nothing stored.
18. **Delete previews (X-1 to X-4):** InfoCube's rows in the entity and attribute previews; a logical attribute that
    feeds a dimensional one asks before deleting; one undo step. Each fact listed once (section 2).
19. **Requirements (X-5):** links to dimensional entities and attributes; scope through dimensional mappings to the
    logical attributes and their sources, on the lens too; coverage as the spec says.
20. **Left out of the dimensional level (X-6):** Data Vault hints and stereotypes; the duplicate-name warning compares
    within one level; the status bar's "Mapped attributes on canvas" counts logical attributes only. Step 1 lists every
    other place that counts or lists entities and proposes its level rule (Q4).
21. **Demo data:** the Sales star (spec, "Demo data") as a step for development and slice 15's specs only (O5), so
    that earlier specs and the element guard stay comparable; REQ-210 keeps its key (O7).

### Unchanged

- Source systems, tables, columns, imports and changes to resolve: a source column never maps to a dimensional
  attribute (refused, B-6).
- Logical entities, their stereotypes and everything slices 0 to 14b built for them.
- Canvases, frames, notes, labels, projects: a dimensional entity is a card like any other.

## 4. Steps

Stop after each step with a short summary of what changed and how to check it. Wait for Łukasz before the next. A new
Claude Code session may start at a step's boundary, never inside a step; it starts by reading CLAUDE.md, this PRD and
`slice-15-acceptance.md`.

1. **Critical review and inventory** (section 7). Check every item, decision and criterion against the code,
   `docs/decisions.md` and the earlier slices' acceptance docs. Answer Q1–Q15 in `docs/prd/slice-15-acceptance.md`,
   each with the files and functions behind it and a proposal. List the differences between the prototype and the
   application that the slice touches. **Propose the split into sub-slices** (Q14). No application code. The only files
   step 1 may add or change are the acceptance doc, the copied prototype and the copied spec (Q1). Stop.
2. **After Łukasz's answers:** this PRD is updated to them (section 0) and cut into four sub-slices (O10). Each has its
   own branch and tag, and follows the steps below; step 1 (the review) was done once for all four.
   - **15a – Boundary, level, licence, facts and dimensions as entities** (branch `slice/15a-boundary-level-licence`,
     tag `slice-15a`). The module's folder, `src/compose/` and the lint rules
     (acceptance doc Q2); the table registry (E1); `model_level`; `cube_entity`, `cube_measure`; the licence and the
     switch and C-7's check; the Cube tab and the Model tab's filter; New fact and New dimension (tab and
     toolbox); the card's role, cube and fact edge; the panel's Role; relationships within a
     level and the turn; the level rules (Q4); a dimensional entity's delete preview and the cascade of its own rows;
     the star's entities, roles and relationships (O5). Criteria S15-01, 02, 03, 04 (without mappings), 06, 07, 10, 14
     (without mappings), 17. Steps:
     - **15a step 2 – data:** the module's folder, `src/compose/`, the lint rules and their probes; the table registry
       with its guard test; `entity.model_level`, `workspace.infocube`, `organization_licence`, `cube_entity`,
       `cube_measure` (types, local schema rules, migration, the schema check); the local file's format 12 and its
       upgrade; undo's image defaults (F6); KB's backup. No behaviour change.
     - **15a step 3 – domain:** the level on create and names within a level; the licence and the switch; C-7 (turned off
       only without facts or dimensions; nothing adds or brings one back while off) with its domain tests; the relationship rules; the module's commands for facts and dimensions; the
       cascade and dependents of dimensional objects; paste within a level (O6); the level filters of Q4.
     - **15a step 4 – interface:** the settings box; the Cube tab; New fact and New dimension; the card; the panels'
       Role; the delete preview's rows; the star for development and slice 15's specs; the specs.
     - **15a step 5 – measurement:** the element guard, the LayerTree read, the page's bytes (`model_level`).
     - **15a step 6 – closing** (done in step 5): AD-33, AD-34, AD-35, D-67; the docs; one full run; the manual check.
   - **15b – The dimensional description:** the fact section (grain, measures, dimensions with their keys,
     hints with the key-name match, Q16), the dimension section (SCD, used by), the Measure section, the Σ marks.
     Criteria S15-08 and S15-07's hints; D-68.
   - **15c – Dimensional mappings:** `cube_mapping`, `cube_mapping_input` (M1, AD-36), format 13; drag in both
     directions, lit targets and refusals (O4); the line kind with hover, Focus, bundles and the miniature; the mapping
     panel with reviewers' approval and four-eyes (O9) and D-51's first rule (O12); the line's menu, Delete, history
     places; "Create dimension from this…"; "Comes from the logical model", "Feeds facts and dimensions"; X-2, X-3,
     cascades and undo; the "fed" coverage on cards and in the Overview; the star's mappings; the dense canvas
     measurement. Criteria S15-05, 09, 11, 12, 13, 14 (the mappings' rows), 18; D-69 and AD-36.
   - **15d – Requirements and the bus matrix:** X-5 (scope, coverage, the lens), B-8, REQ-210 in the star;
     criteria S15-15, 16, 19.
   - **Tests in every sub-slice** (CLAUDE.md, Łukasz, 4 November 2026; one regime, no small or large slices): after each
     step the sub-slice's specs, the earlier specs of what the step touched, and CI (lint, typecheck, unit tests); a
     failing test run three times on its own. A step that touches shared infrastructure (undo and change groups, the
     save chain, the canvas's layers, the table registry, the local adapter) runs one full e2e run in that step and its
     report says why: in 15c the data step (format 13, `cube_mapping` and `cube_mapping_input` in the registry, undo and
     the cascades) and the line kind (the canvas's layers) do. Before the merge: one full e2e run.

## 5. Acceptance criteria

Tests in `e2e/slice-15*/`, one file per criterion, each from a fresh seed; unit tests next to the code. The sub-slices
take their criteria from this list. Every change is checked with undo and redo.

| ID | Criterion |
| --- | --- |
| S15-01 | **Boundary.** The lint rule fails a test file that imports the module from InfoMapper's code; the existing e2e specs pass with the module registered and no InfoCube data; with an empty registry every hook returns nothing (unit test; O1). |
| S15-02 | **Data.** The migration and the schema check pass. The local file's upgrade sets every entity `logical`, every workspace off, no licences; keeps every count; writes no change event; is not repeated (unit test). An old change event without `model_level` is undone as `logical`. |
| S15-03 | **Licence and activation.** With the licence, an owner and an admin turn the InfoCube setting on; a modeler sees it disabled and a direct call is refused. Without the licence the box shows its check box disabled with "{organization} has no InfoCube licence." and a direct call is refused (O2). |
| S15-04 | **Off (C-7 as changed on 4 November 2026; replaces IC-14).** With InfoCube on and Fact Sales in the workspace, turning InfoCube off is refused with "InfoCube can be turned off only when this workspace has no facts or dimensions. It has {n}: delete them first.", in the settings and by direct call; after deleting every fact and dimension it is turned off. While off: no Cube tab, no New fact or New dimension; a direct call to create a fact or dimension, a paste into one, and the undo of the deleted facts' delete (and the redo of a fact's create) are refused with the C-7 message, and the step stays in the history; deleting a logical entity works. |
| S15-05 | **Open the Sales star (IC-01).** Facts, dimensions and logical cards; dimensional lines from logical rows to dimensional rows; Σ and ∅Σ marks. |
| S15-06 | **Tabs (IC-02).** The Model tab lists the logical entities only; the Cube tab lists facts and dimensions by concept. |
| S15-07 | **New fact (IC-03).** A fact card with its name selected; Role Fact; the hints "No grain yet" and "No dimension keys". One undo removes it. The same from the canvas toolbox, and for a dimension. |
| S15-08 | **Grain and measures (IC-04 to IC-06).** Clearing the grain shows its hint; `quantity` semi-additive across "Date" shows Σ~ and is listed in Measures; `order_number` as a measure shows the type hint. Each is one undo step; reviewers cannot edit. |
| S15-09 | **Dimensional mapping by drag (IC-07, IC-08).** Product.list_price onto Dim Product's header: a new attribute and a Draft line, one undo removes both. A column onto a dimensional attribute and Dim Product.sku onto Dim Customer.city: both refused with their toasts. |
| S15-10 | **Relationships (IC-09).** Customer (logical) to Fact Sales: refused with B-7's toast, also by direct call. A new relationship from Fact Sales to Dim Product is turned to Dim Product 1..1 – Fact Sales 0..N. |
| S15-11 | **Create dimension from this… (B-2).** From Product, with two attributes unticked: Dim Product 2 (numbered), `product_key` first, the ticked copies, a Draft direct mapping per copy, the card to the right. One undo step. |
| S15-12 | **Deleting a logical entity (IC-10).** Order Line's preview adds "6 dimensional mappings – deleted, 4 of them approved" and "Fact Orders, Fact Sales – lose their feed from the logical model". Undo brings everything back. |
| S15-13 | **Deleting a logical attribute (IC-11).** Customer.segment_code: a preview asks first; after Delete, Dim Customer.segment_code stays, unfed. An attribute that feeds nothing deletes at once, as before. |
| S15-14 | **Deleting a dimension (X-4).** Dim Date's preview lists its SCD type, its dimensional mappings and "2 facts – lose this dimension: Fact Sales, Fact Orders", each fact once even with two relationships to one fact. |
| S15-15 | **Requirement lens (IC-12).** REQ-210 lights its dimensional attributes, the logical attributes feeding them and their sources; coverage 0/3. |
| S15-16 | **Bus matrix (IC-13).** Two facts × three dimensions; Dim Customer and Dim Date conformed; names and dots open their objects. |
| S15-17 | **Level rules (X-6, Q4).** Data Vault hints absent on dimensional entities; the duplicate-name warning within one level; the status bar counts logical attributes only; every other place from Q4 as answered. |
| S15-18 | **Performance** (section 6). |
| S15-19 | CI and the runs of the test regime; changed earlier tests listed with the reason. |

**Definition of done (manual acceptance on Łukasz's model KB, after the backup and the upgrade):** turn InfoCube on in
KB's workspace; create a dimension from a logical entity; create a fact, relate it to the dimension, add its key and two
measures; map a logical attribute by drag; open the bus matrix; delete a logical attribute that feeds the fact and
undo; try to turn InfoCube off (refused, with the number of facts and dimensions), delete the facts and dimensions,
turn it off, and try to undo the delete (refused).

## 6. Performance

New elements on the canvas: the role mark in a dimensional card's header, the measure marks on rows, the fact's
header edge (a class), and a new line kind with a diamond end. Bars are proposals to confirm in step 1.

| What | How | Bar |
| --- | --- | --- |
| Viewport elements | `S3B-15-elements.spec.ts` with `ELEMENTS_BASELINE=.data/measure/s9-14-baseline/slice-08.json` | equal counts on the "Performance test" canvas, which has no dimensional entities (Q13) |
| Drawing layers | LayerTree read on the Sales star against a logical canvas of the same size | dimensional marks and lines add no drawing layer per card (AD-24) |
| Pan and zoom, first render | `npm run measure:canvas` as in slice 14b, against `slice-14b` | within the sitting's run-to-run spread |
| A dense dimensional canvas | step 1 proposes whether a measuring canvas with facts, dimensions and dimensional lines is needed (Q11) | – |

**Nothing above the canvas reads layout during a commit** (CLAUDE.md). The Cube tab, the bus matrix dialog and the
panels' InfoCube sections derive everything from the model.

## 7. Questions for step 1

**The rule (CLAUDE.md, "How we work"):** a PRD is a proposal to verify, not a specification. Write into
`docs/prd/slice-15-acceptance.md` where this PRD is wrong, contradicts the code or a decision, duplicates what the
application already has, misses what the code needs, or costs more than it assumes (data model, undo, change events,
performance), each with the files and functions behind it and a proposal.

- **Q1. The starting point.**
  - `git status`, the current branch, `git log -1` on `main`, the tags `slice-14a` and `slice-14b`, open branches. Is
    slice 14b merged and tagged? If not, stop and report.
  - The repository's docs: are they at slice 14b's closing (README's status line, `docs/ideas.md`'s plan, the latest
    acceptance doc)?
  - The prototype: compare the repository's copy with the one Łukasz provides (size, SHA-256 in section 2). Replace it
    only after the comparison, in a commit of its own (`docs:`).
  - The spec: propose where it lives (e.g. `docs/infocube/iteration-1-spec.md` or `docs/prd/`), copy it unchanged, and
    note the IC-10 difference in the acceptance doc, not in the spec.
- **Q2. The module in the layers.** How `src/modules/infocube/` follows AD-19 (its own `domain`, `data`, `ui`,
    `canvas` parts, or a folder per layer such as `src/domain/modules/infocube/`), which layer is the composition root,
    and the exact lint rules: InfoMapper never imports the module; the module imports InfoMapper's layers only in the
    allowed direction. Write the proposed `eslint.config.mjs` rules in words.
- **Q3. The extension points: the main inventory.** For every place below: the file and function today, what InfoCube
    needs there, the smallest hook (a registry of functions, a slot in a component, a domain check), and its cost.
    Group them so that each sub-slice adds only its own.
  - Delete previews and their second click (D-47, slice 10c): entity, attribute; also relationship and concept?
  - The domain's write commands: the C-7 read-only check, where archive (AD-09) and roles (AD-05) are checked today;
    every command that can touch a dimensional entity, attribute, relationship or InfoCube row; moving cards stays
    allowed.
  - Cascades in the domain's deletes, their change groups and `revertChangeGroup` for module tables (AD-13).
  - Panels: entity, attribute, the mapping panel's kind; the Stereotype field's place (C-5).
  - The left panel's tabs and the object browser's search.
  - Cards: header, rows, the coverage bar; collapsed cards and frames' blocks; live label canvases' context cards.
  - The line layer: a new line kind, hover, the overlay's lit lines, Focus, bundles on collapsed frames (D-07), the
    Overview's miniature.
  - Dragging: targets, dimming, refusals, the D-48 choice (does it apply to dimensional mappings?).
  - Menus: the card header's menu (D-52), the canvas toolbox (D-19), the row menu.
  - Requirements: scope, coverage, the lens, requirement cards, the requirement index (`docs/known-limitations.md`,
    "The requirement index is rebuilt on every write").
  - History places (D-38, slice 6b): selecting a dimensional mapping, Back and Forward to it.
  - Working labels and the active working context (slices 3a, 3b): may a dimensional entity, attribute or mapping
    carry a label?
  - Baselines (AD-14): does the snapshot include InfoCube's tables?
  - Workspace copy (AD-09), transfer to another organization (and its licence), export.
  - The project and workspace homes: counts, tiles, model consistency (slice 7b).
- **Q4. The model level everywhere InfoMapper lists or counts entities.** The Model tab, the search, the duplicate-name
    warning (B-25), Data Vault 2.0 readings (slice 7c, AD-08), the status bar, the homes' counts, import suggestions,
    "Feeding sources", copy and paste of an attribute (D-63; the prototype has no paste, so: may a logical attribute be
    pasted into a dimension, and is that a copy or a mapping?), aliases (D-64), the stereotype's value on a dimensional
    entity. For each: today's code and the proposed rule.
- **Q5. Q-6 of the spec: where dimensional mappings live.** Compare (M1) InfoCube's own `cube_mapping` and
    `cube_mapping_input` with (M2) a nullable `attribute_id` on `mapping_input` beside `source_column_id` (AD-15's
    style). For each: every reader of `mapping` and `mapping_input` today (coverage, the line layer and bundles,
    D-49's split and merge, D-51's return to review and its reasons, four-eyes, imports, changes to resolve, the
    suggestions, deletes and undo, the requirement index), what it would have to ignore or learn, and C-4. Recommend.
- **Q6. C-7's data and rights.** Where an organization's data and a workspace's settings are read and written today
    (slice 8's People tab, the workspace settings, `dv2_mode`); the proposed shape of the licence and the setting; how a
    licence is granted in development without a purchase (seed, a development-only control, a script); what owners and
    admins may do; how the page knows the module is on without reading InfoCube's tables.
- **Q7. Cascades and undo.** How the domain deletes an entity and an attribute today (the commands, the change group,
    soft deletes); how module rows join the same change group; Q-5 (a mapping goes whole when one input goes); undo of
    a group with module rows; what an old change event without module rows does.
- **Q8. Relationships.** Where the relationship command validates its ends; adding the same-level rule and the turning
    of a fact – dimension relationship; self-relationships on dimensional entities (D-61): allowed?
- **Q9. Save chain and drafts.** Every new field (grain, semi note, rule, note) on slice 13's rule (`useDraft`, the
    conflict line); every new canvas write (dimensional mapping by drag, New fact here) on the canvas's queue
    (slice 10a); the rows each write holds.
- **Q10. The page's data.** How the canvas page gets the model today and what InfoCube's rows add (bytes per row, as
    slice 10c measured), for the Sales star and for KB with InfoCube off.
- **Q11. The canvas and AD-24.** The new elements and classes (role mark, measure marks, fact edge, the line kind and its
    diamond end); the LayerTree read; whether a measuring canvas with dimensional content is needed.
- **Q12. The local data file.** The current format after slice 14b, the inline upgrade step in `upgradeDb`, `readDb`'s
    write-back check, and KB's backup.
- **Q13. Seed and e2e data.** Whether the seed has the demo LDM the Sales star needs (Retail Co – DWH: Customer, Customer
    Address, Sales Order, Order Line, Product, Country, REQ-210's concepts); where the star goes so that the element
    guard and earlier specs stay comparable; the licence and the setting in the seed.
- **Q14. The split.** Confirm or change section 4's sub-slices: what each needs from the others, its data, its extension
    points, its criteria, its test regime (small or large, CLAUDE.md), and a rough size (files, specs). A sub-slice must
    leave the application consistent on its own (e.g. 15a without dimensional mappings: no lines, panels without
    "Comes from the logical model").
- **Q15. Earlier tests and docs.** Specs that change (the Model tab's lists, the entity panel's fields, the menus' item
    lists, the relationship command's refusals, the workspace settings, delete previews' rows); the docs to update.

**For Łukasz, before step 2:**

- **Q16. The dimension key.** Build the key-name match now as a derived domain function, listed as a known limitation
    until role-playing replaces it (recommended: no data, one function to replace), or leave dimension keys out until
    role-playing is specified?

## 8. Differences from the prototype (deliberate)

- **No "Prototype: grant / end licence" button.** A licence is granted as Q6 proposes.
- **Orphans are deleted by the command, not dropped when indexing** (item 8).
- **Each fact listed once** in a dimension's delete preview (section 2).
- **Reviewers approve dimensional mappings, with four-eyes** (O9), as for InfoMapper's mappings; in the prototype only
  editors change a dimensional mapping's status, and four-eyes does not apply.
- **D-51's first rule for dimensional mappings** (O12): a change of inputs, kind or rule sends an approved one back to
  review and clears its approval; a note alone does not. The prototype keeps the status.
- **Paste within one level only** (O6); the prototype has no paste.
- **No read-only mode** (C-7 as changed on 4 November 2026): the prototype turns InfoCube off with facts and dimensions
  in place, read-only, hatched, with a note in their panels, and lets undo and redo through. The app refuses to turn it
  off while the workspace has facts or dimensions, and while it is off refuses whatever would create or bring one back
  (create, copy, paste, undo, redo); so there is no hatch, no off note and no read-only check. The check is the
  domain's, on the write set (`levelWritesRefusal`, F4), and the local adapter counts again (concurrent writes).
- The rest of the acceptance doc's list P1–P26 as answered there.

## 9. Left for later

- **Role-playing dimensions** (agreed next for InfoCube): a role name per relationship end and an explicit link from a
  fact's key to its relationship, replacing the key-name match. Specified and prototyped separately; Łukasz decides
  its options (role name in InfoMapper's relationship or in InfoCube; the key link's data; the canvas) before it.
- **Backlog (Łukasz, 1 November 2026):** junk, bridge and outrigger dimensions; the fact type (transaction, periodic
  snapshot, accumulating snapshot); factless and aggregate facts; hierarchies in dimensions.
- **Q-5's alternative:** a multi-input mapping that loses one input stays and goes back to review (it would change
  InfoMapper's mappings too).
- **Out on purpose (spec, "Scope"):** LDM changes as changes to resolve (principle 4) and the model validator as a
  panel; dimensional mappings from a source column; SCD per attribute, beyond 0–2, technical SCD columns; reading LDM
  from another workspace; DDL or physical design; a separate canvas type.
- **The "+" per concept in the Cube tab** (Q-8 of the spec, open).
- **Copying and transferring a workspace** (AD-09, not built; the rule accepted by Łukasz on 4 November 2026): a copy
  stays in its organization and copies `workspace.infocube` with the facts and dimensions; a transfer, or a copy into
  another organization, of a workspace with InfoCube on is refused unless the receiving organization holds the licence,
  with "{organization} has no InfoCube licence. Delete this workspace's facts and dimensions and turn InfoCube off, or
  transfer it to an organization with the licence."; a workspace with InfoCube off transfers freely. Both commands
  iterate the table registry (E1), so a module's rows go with the workspace.

## 10. Decisions to accept, and docs in this PR

### Decisions (proposals; numbers to confirm in step 1, the text quoted for approval in the closing)

- **AD-33, AD-34, AD-35 and D-67** were entered in `docs/decisions.md` at 15a's closing (4 November 2026), with the text
  Łukasz approved: AD-33 keeps the principle, the composition root, the lint rule and the two extension points that
  bind every module (the table registry with its guard test, the cascade of a module's rows in the same change group);
  the other extension points are listed in `CLAUDE.md`, kept up to date in each sub-slice. The text there is the one the
  code follows.
- **D-68 (15b)** The dimensional description in the panels: a fact's grain, measures and dimensions with their keys and
  hints; a dimension's SCD type and the facts that use it; a measure's section; the Σ marks. Its final text is quoted
  for approval at 15b's closing.
- **D-69 (15c, with AD-36)** Dimensional mappings on the canvas and in their panel: logical attribute(s) → dimensional
  attribute, drawn in both directions with lit targets and refusals (O4), approved by reviewers with four-eyes (O9),
  sent back to review by D-51's first rule (O12); the "fed" coverage. Its final text is quoted for approval at 15c's
  closing.
- **AD-36 (Q-6)** Dimensional mappings are InfoCube's own tables (`cube_mapping`, `cube_mapping_input`), pointing to
  InfoMapper's attributes; InfoMapper's `mapping` stays source column(s) → attribute (M1, accepted with step 1).

Each enters `docs/decisions.md` at the closing of the sub-slice that builds it, one D-decision per sub-slice (O11).

### Assumptions to confirm

- **A1.** The slice starts from `main` at tag `slice-14b`; slice 14b is merged.
- **A2.** The data model changes of items 3–5 in two formats (12 in 15a, 13 in 15c) and two migrations;
  `organization_licence` has no `workspace_id` (an organization's row, as `organization_access`); `entity.stereotype`
  keeps its CHECK (a dimensional entity holds `object`, unused).
- **A3.** KB is backed up before the branch's first dev or e2e run of 15a and of 15c, and before each manual
  acceptance; it stays local.
- **A4.** The "Performance test" canvas gets no dimensional content, so the element guard stays comparable.

### Docs in this PR (or in each sub-slice's)

- **`docs/decisions.md`** (only with Łukasz's approval): the decisions above.
- **`docs/data-model-v2.md`:** `entity.model_level`; InfoCube's tables in a section of their own; the licence and the
  workspace setting; the new format and its upgrade.
- **`supabase/migrations/`:** the new migrations.
- **`docs/known-limitations.md`:** the key-name match until role-playing (if Q16 says build it); Q-5's rule; anything
  the steps find and Łukasz accepts.
- **`docs/ideas.md`:** the InfoCube section updated (its open question is decided by C-2); the plan: InfoCube iteration
  1 done, next role-playing, then the model validator; the stale line "Next: InfoCube, starting with a concept
  document".
- **`docs/inventory-prototype-vs-app.md`:** section 8's differences.
- **README and CLAUDE.md:** the slice's status, the module boundary and its lint rule, the extension points.
