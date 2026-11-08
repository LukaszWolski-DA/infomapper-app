# Slice 18 – acceptance

PRD: [`slice-18-derivations.md`](slice-18-derivations.md). Branch `slice/18-derivations`.

## Step 1: the PRD checked against the code (8 November 2026)

### The starting point

- **The branch.** The local `main` was 16 commits behind `origin/main` and was fast-forwarded to `0cf3eb8`, the merge of
  PR 44. The tag `slice-17` (an annotated tag) points to the same commit, `0cf3eb8`. `slice/18-derivations` was cut
  from there.
- **No run in this step.** No dev or e2e server ran and no script ran, so KB was not backed up. Step 2 backs it up first,
  because it changes the local file's format (Q2).
- **The two files from Łukasz's Downloads**, each checked with `cmp` after the copy and committed with this document:

  | File | SHA-256 | `cmp` |
  | --- | --- | --- |
  | `docs/prd/slice-18-derivations.md` (new, 15,069 bytes) | `bd4e36b9b195240b0d667522f553aa040236108a3e1ca816a3f4c0ff8a30d6f2` | equal |
  | `docs/prototype/infomapper-prototype-with-sources.html` (676,065 bytes, replaces slice 17's `1cd443af…`) | `124207eb1f8d4f77280b1241ff91cc2385e9e484aa4ad9f34e6afb102caf0fba` | equal |

- **The prototype's slice-18 code.** The diff against slice 17's version adds 119 lines and removes 25:
  - the CSS `.row .calc`, `.row .st.calc`, `.st.calc.ok` and `.calc-rule` (l. 735–739);
  - `cubeDemoV4`, `directFed`, `isFed`, `usesCalc` and `calcGaps` (l. 1648–1677);
  - `idx`'s `I.calcUsers`, which drops inputs whose attribute is gone or lies in another entity (l. 1728);
  - `relatedOf`'s inputs and users (l. 1969);
  - `attrRow`'s status and its `=` mark (l. 2088–2100);
  - the lookup's chip and title in the line layer (l. 2239–2245);
  - `entCard`, `insOverview`, `renderStatus`, `frameStats` and `renderHome`, which count with `isFed`;
  - the kind segment and `lookupFields` (l. 2459–2475), `lookupRels` and `relText`;
  - "lookup · " in `cubeAttrSection`;
  - `calcSection` and `openCalcPick` (l. 2490–2516);
  - the handlers `attr.calcrule`, `cmap.via`, `cmap.unknown` and `cmap.kind`'s lookup, plus `calc-on`, `calc-add`,
    `calc-rm` and `calc-off`;
  - `askDeleteAttr`'s row;
  - `reqScope`'s inputs and `attrOkR`.

### Summary

The PRD's shape holds, and the slice is on the full path, as its status line says: a migration, a new InfoMapper table,
a new local file format, a new kind of module cascade, and a change to undo's consistency check. The PRD is wrong,
incomplete or different from the code in fourteen places:

1. **"Mapped" and "covered" are two rules in the app, in different code.** "Mapped" and "fed" count any mapping, in
   any status. "Covered" (D-31, D-70) is decided in exactly one place, `lookupModel`. The PRD's item 2 mixes them. Both
   need the calculation, each by its own rule (F1, F2).
2. **Cards are built on the server.** So the recursive rule runs once per page render, not per frame (F3). Q5 is cheap.
3. **Focus in the app lights cards and lines, not rows.** "Focus on an attribute lights its inputs" changes nothing
   visible, because the inputs sit on the same card (F10).
4. **A relationship's delete has no preview.** It goes at once with Undo (F14).
5. **Clearing the lookup's relationship loses the panel's "gone" text.** Once the id is cleared, the panel cannot tell
   "gone" from "never chosen". The prototype keeps the id (F15).
6. **The module cascade can only soft-delete.** A lookup that survives its relationship's delete needs a new kind of
   cascade, which is shared infrastructure (F16).
7. **The app's module lines have no title at all** (F18).
8. **An attribute's delete has no dialog.** It asks a second click with text (F12).
9. **The demo's `net_amount` already has a feed.** It is fed by an In-review transformation from Order Line, which
   slice 15's specs and REQ-210 read. The prototype's `cubeDemoV4` removes it (F20).
10. **The demo's relationship runs Country → Customer Address ("locates")**, not "Customer Address → Country" (F21).
11. **The Mapped row filter**: the prototype's reads source mappings only (F4).
12. **Undo can bring back an input that closes a cycle** (F8).
13. **A new InfoMapper table needs a format bump.** C1 covers only module tables, and a new column on a module table
    is a case C1 does not name (Q2).
14. **`ideas.md` has no list "items 3 and 6 of 7 November"**, which section 9 says to mark done (F22).

### Findings

| # | Finding | Files and functions | Proposal |
| --- | --- | --- | --- |
| F1 | **Rule A, "mapped" and "fed": any mapping in any status.** A logical row counts when it has a mapping row. A dimensional row counts when InfoCube's `cubeRowFeeds` gives `n > 0`. No helper is shared: `buildCards`' `rowState` (`card-data.ts` l. 199), `thumbnailIndex` (`thumbnail.ts` l. 87–103) and `stats.ts`' `isMapped` and `coverage` (l. 12–32) each count on their own. These numbers feed the row's dot, `CardData.mapped` (the card's bar, the frames' stats, the collapsed blocks, the fit width), the Mapped and Unmapped filters (`card-size.ts` `rowShown`), the thumbnails' heights, the Overview, the status bar and the project home. The workspace home counts mapping rows, not attributes. | as listed | **One rule in the domain:** `src/domain/model/derivations.ts` (F5). `derivedRows(index, direct)` gives each calculated row with no direct mapping or feed a state, `"ok"` (every input counts, recursively) or `"gap"`. `buildCards` and `thumbnailIndex` take it as their last argument, beside `rowFeeds`. `CardRow` gets `calc?: { ok: boolean; rule: string \| null }`. `stats.coverage` reads it too. `CardData.mapped`, the Mapped filter and everything after them count a row when `mappings > 0` or `calc.ok` (one helper, `rowCounts`, in `card-size.ts`). The workspace home is unchanged. |
| F2 | **Rule B, "covered" (D-31, D-70): one place.** `lookupModel` (`requirements.ts` l. 187–284) decides it, memoised per attribute (`coverageOf`). The index, the requirement cards and panel, the lens, the tree's counts, the homes' "requirements covered", consistency and `coverageDelta` read it. A dimensional feed already asks its logical inputs for `coverageOf` (l. 240), so a logical calculation reaches facts by itself. `coverageDelta`'s reasons helper `deciding` (`source-changes/coverage.ts` l. 46) copies the rule. | `requirements.ts`; `source-changes/coverage.ts` | `ScopeModel` gains `attributeInputs`. `coverageOf`: covered directly as today, **or** calculated with at least one input and every input `covered` (visited set, a cycle counts as not covered). A calculated attribute that is not covered is a gap with the new reason `"calculation"`, "an input of its calculation is not covered" (Q3). `deciding` reads it. |
| F3 | **Where the canvas computes coverage.** `buildCards` runs on the server once per page render or refresh (`c/[canvasId]/page.tsx` l. 139–154); the browser never recomputes `mappings` or `mapped`. The requirement index is built about four times per load (server, `Inspector`, `ModelCanvas`, `useLit`), each with one `lookupModel`. | as listed | The derivation index is built once with `buildCards` (server) and once inside each `lookupModel`. Nothing runs per row per frame. Step 4 runs `scripts/bench-requirement-index.ts` with 500 calculated attributes added (bar: +10 %, a proposal). |
| F4 | **The prototype's Mapped filter counts source mappings only.** `rowsOf` (l. 1864) reads `I.mA`, not `isFed`. Since slice 15c the app's filter already counts feeds for a dimensional row. | `card-size.ts` `rowShown` | The filter follows Rule A with calculations (F1), as the PRD's "every count" says. This is P1. |
| F5 | **No index of calculations exists.** | new | `src/domain/model/derivations.ts`, pure: `derivationIndex(attributes, inputs)` builds `inputsOf` (ordered, live inputs of live attributes of the same entity) and `usersOf`. On top of it: `reaches(from, to)` for cycles (visited set), `throughCalculation(direct)` (a memoised predicate for Rule A or B), `gaps(id, direct)` (the prototype's `calcGaps`) and `shownState`. Unit tests for every rule. |
| F6 | **Commands.** `updateAttribute` takes fields (`attribute.ts` l. 199). Its undo names come from `changeLabel` ("Change attribute"). Paste (`pasteAttribute`) and InfoCube's `plainCopy` copy fields one by one. | `attribute.ts`, `change-label.ts` | New commands in `src/domain/commands/derivation.ts`, `model.edit`, each one change group with its own `label` (Q4). Paste, "Create dimension from this…" and the header drop copy **no** calculation: its inputs belong to the original's entity (P11). |
| F7 | **Same entity, no cycle.** The PRD checks both in the domain, and the prototype's picker disables `usesCalc` items. | — | Refusals: "An attribute is calculated from attributes of its own entity." · "{input} is calculated from {attribute}, so {attribute} cannot be calculated from it." · "An attribute is not calculated from itself." · "It is calculated from {input} already." The picker marks the same items done, titled "Already an input, or calculated from this attribute" (prototype). |
| F8 | **Undo can close a cycle.** Undoing "Remove input" (a → b) after someone made b calculated from a brings back a loop. `revertChangeGroup`'s `consistent` (`undo.ts` l. 445) knows parents, cards and projects, not cycles. Slice 10c's copies cannot loop (set only on a new row). | `undo.ts` | `consistent` refuses a revert that leaves a cycle among live `attribute_input` rows: "Undoing this would make {a} calculated from itself." This is shared infrastructure, so step 2 does one full run. |
| F9 | **The input rows go with their attributes.** `deleteAttribute` (`attribute.ts` l. 337) and `entityCascade` (`impact.ts` l. 31) soft-delete InfoMapper's rows themselves; `moduleCascade` serves only module tables. | `attribute.ts`, `impact.ts`, `undo.ts` `PARENTS` | Both commands soft-delete the live `attribute_input` rows on either side (`attribute_id` or `input_attribute_id`). `PARENTS.attribute_input = [["attribute_id", "attribute"], ["input_attribute_id", "attribute"]]`, so one undo brings them back and a revert never leaves an input row of a deleted attribute. A calculation that loses its last input **stays calculated**, with no inputs (Q1). Imports never delete attributes (`apply.ts`, `source-changes/delete.ts`), so D-56 needs nothing. |
| F10 | **Focus lights cards and lines, not rows.** `lit.ts` says so in its header ("No row is coloured"). `targetLit`'s attribute case (l. 128) lights the entity and the attribute's source mappings with their tables. For a dimensional attribute it lights only the entity: its dimensional lines light by 15c's rule, when both cards are lit. The inputs and the users share the attribute's card, so the PRD's "lights its inputs" lights nothing new. | `lit.ts` `targetLit` | **Focus on an attribute also lights its inputs' and its users' mappings** (source mappings with their tables, and the dimensional lines through the entities at their other ends). For a dimensional attribute, its own feeds' logical cards are lit too. One level, as the prototype's `relatedOf`. No row mark and no new canvas drawing. S18-05 checks the lit tables and lines (Q-A). |
| F11 | **Requirement scope.** `scopeOfLinks` (l. 287–336) adds a dimensional attribute's feeds and their logical inputs (`feeding`). The prototype adds a calculation's inputs one level deep (`reqScope`, l. 4759). | `requirements.ts` | A calculated attribute in scope brings its inputs **recursively** (coverage is recursive, so scope is too, P3) into `scope.attributes`, in a new `scope.inputs` set (not items, like `feeding`). Their feeds follow by the existing loop, and their source mappings light under Focus (`requirementFocusLit`, every scope attribute's mappings). The lens colours them by their own coverage, as `feeding`. Consistency (`consistency.ts` l. 159) then names a requirement whose calculation input has a source change, which is right. |
| F12 | **An attribute's delete asks a second click, with text.** `attributeDeleteParts` (`fields.tsx` l. 654) joins the `also` parts and the `then` parts; the panel and the row menu use it (`attribute-panel.tsx` l. 103, `canvas-host.tsx` l. 716). The prototype's `askDeleteAttr` is a modal. | `fields.tsx`, `attribute-panel.tsx`, `canvas-host.tsx` | An input with users asks the second click. Its `then` gets "the calculation of {name} loses this input" (several: "the calculations of {a}, {b} lose this input"). A calculated attribute's own inputs go silently. The D-47 entity preview gets no row, since inputs live in the same entity. |
| F13 | **The lookup's checks.** `updateCubeMapping` (`mappings.ts` l. 434) takes kind, rule and note, refuses a direct copy with more than one input (`DIRECT_READS_ONE`), and applies D-51 when kind or rule changed (l. 450). `addCubeMappingInput` turns a direct copy into a transformation (l. 384). `CUBE_MAPPING_LOG.content` is `["kind", "rule_expression", "attribute_id"]`. | `mappings.ts`, `mapping-panel.tsx` | `updateCubeMapping` also takes `lookupRelationshipId` and `lookupDefault` (trimmed, empty → null, 200 characters at most). Kind `lookup` with more than one input is refused: "A lookup reads one attribute, the dictionary's value. Remove the others first." Choosing `lookup` with no relationship set and exactly one candidate sets it, in the domain. The relationship must be live, logical at both ends, not a loop, and have the input's entity at one end: "Choose a relationship of {entity}." A second input turns a lookup into a transformation too (`readsTooToast`'s `wasDirect` becomes "was direct or lookup"). D-51 also counts the two new fields, and both join `CUBE_MAPPING_LOG.content` for four-eyes. A lookup's type check is a direct copy's: `hasTypeConflict` compares the one input with the target. |
| F14 | **A relationship's delete has no preview.** The panel (`relationship-panel.tsx` l. 55) and the line menu (`canvas-host.tsx` l. 326) delete at once, with "Relationship deleted" and Undo. `deleteRelationship` writes one row, and `cube_key` follows by the cascade. | as listed | With lookups through it, both ask a second click (`ConfirmDelete`, as an attribute's), its `also` "the lookup of {Dim Customer.country_name}" (several: "the lookups of …"), its `then` "loses its relationship". This is a new `ModuleView` field `relationshipDeletes` (by relationship id), like `attributeDeletes`. The entity's D-47 preview gets a module row, "{n} lookup(s) – lose their relationship", for the relationships the entity takes along. |
| F15 | **Cleared, the panel cannot say "gone".** The PRD clears `lookup_relationship_id` and says "The relationship it went through is gone." The prototype keeps the id and shows the text when it points to nothing (`lookupFields` l. 2472); it neither clears it nor sends the lookup back to review (P4). | — | **Keep the id**, pointing to the soft-deleted relationship, as `copied_from_attribute_id` keeps a lost original (slice 10c): a plain foreign key, not an undo parent. The panel reads a deleted relationship as gone. The delete sends an approved lookup back to review in the same change group, and one undo brings both back. The other way, clearing as the PRD says, would need a stored reason to say "gone". Question Q-B. |
| F16 | **The module cascade only soft-deletes.** `moduleCascade` (`module-cascade.ts`) deletes a module row whose parent goes, or a whole mapping (`goesWhole`). A lookup must stay and change. | `module-cascade.ts`, `undo.ts` `ModuleUndoTable`, `infocube/domain/tables.ts` | A new registration, `follows: [column, parent, rule]`: when the writes delete a row of `parent` that `column` points to, the module's pure `rule(row)` returns a patch or nothing. InfoCube's rule: approved → `review`, approval cleared; else nothing. InfoMapper still never names the module. Four-eyes: the person who deleted the relationship becomes the lookup's last content editor (D-51's import rule). This is shared infrastructure (cascades, change groups); the full run is in step 2. Add it to CLAUDE.md's extension points. |
| F17 | **The lookup's sentence.** The prototype names the dictionary's primary key ("by AssetCategoryCode") and the relationship's other entity ("Each Building row …"). | `lookupFields` | As the prototype: the first live primary-key attribute of the dictionary; without one, no "by …". For the demo: "Each Customer Address row finds its Country by country_code and takes country_name; when the code is empty or has no match, the value is “Unknown”." |
| F18 | **The app's module lines have no title.** Neither `ModuleLineData` (`line-data.ts` l. 76–91) nor `ModulePath` (`LineLayer.tsx` l. 176–200) draws one; the prototype has a `<title>` on every dimensional line. The chip is `chip: "ƒ"` for a transformation (`lines.ts` l. 51). | `lines.ts`, `LineLayer.tsx` | Chip `"L"` for a lookup, its test id unchanged (`node-f`). **No title**: a `<title>` is one element more per line on every star canvas, and the relationship is in the panel. If Łukasz wants it, it goes on the chip only (one element per lookup). Question Q-C. |
| F19 | **The rule field and readers.** The prototype saves the rule on `change` and disables it for readers. It shows "Not calculated. Mark it when …" to everyone. | `fields.tsx` `TextArea` | The rule is a `TextArea` with `keep` (slice 13's draft, conflict line, leave guard), saved through `saveRow`. The inputs' × and the buttons go through `saveRow` or `saveRows` (the attribute checked, its inputs' rows held). Readers and reviewers see the section **only when the attribute is calculated or used by one**: the sentence is an instruction to an editor (P7). |
| F20 | **The demo's `net_amount`.** `sales-star.ts` l. 83 feeds it by an In-review transformation of Order Line's quantity, unit_price and discount_pct. REQ-210 links it, and slice 15's specs read it (S15-05, S15-12, S15-13's Q-5, S15-20, S15-22, S15-15, RP-04). Fact Sales has quantity, unit_price and discount_pct, each fed by an approved direct copy. Dim Customer's `country_name` is an approved direct copy from Country. | `sales-star.ts`, `compose/seed.ts`, `e2e/slice-15a/fixtures.ts` | **A separate step `addDerivationsDemo`** (InfoCube's data for `country_name`, InfoMapper's calculation for `net_amount`, which the module does not own), run by `npm run seed`, `reset-dev-data`, `npm run demo` and slice 18's fixtures. **Not** run by slice 15's fixtures, so their specs stay as they are. As `cubeDemoV4`: `country_name` a Draft lookup through Country – Customer Address, "Unknown", with its note; `net_amount` calculated from Fact Sales' quantity, unit_price and discount_pct, rule "quantity * unit_price * (1 - discount_pct)", and its transformation deleted. Łukasz's `.data/dev-db.json` (KB) is never touched. The existing demo gets it with `npm run demo -- --reset`. |
| F21 | **The relationship's direction.** The app's seed has Country → Customer Address, "locates" (`seed-model.ts` l. 198). The PRD writes "Customer Address → Country". | — | The text follows the stored direction: "Country → Customer Address (locates)". |
| F22 | **No "items 3 and 6 of 7 November" in `ideas.md`.** Neither `ideas.md` nor any doc lists Łukasz's testing of 7 November by number. | `docs/ideas.md` | Step 4 adds an entry "Derivations: done in slice 18" naming the two needs (section 1 of the PRD), and section 10's items as later. Question Q-D. |
| F23 | **"Covered" in the section's note means Rule A.** The prototype's "Covered: every input is mapped." uses "mapped" in Rule A's sense (any status), while "covered" means D-31 in the requirement panel. | — | Keep the prototype's texts (accepted). Note the two senses in D-73. Question Q-E. |

### Q1. How "calculated" is stored

The prototype allows **a calculated attribute with no inputs**. "Calculate from attributes…" writes nothing until
something is picked, so a cancel leaves no trace. But × removes any input, the last one included, and an input's delete
does too. Afterwards the panel says "Choose the attributes it is calculated from." and the row keeps its "=" mark.

- **Implied** (a live input or a rule): an attribute whose last input goes and has no rule would silently stop being
  calculated, and one with a rule would keep an orphan rule while counting as not calculated. That is not representable.
- **Recommended: an explicit `attribute.is_calculated boolean not null default false`**, beside `calc_rule text`, with
  CHECK `attribute_calc_ck`: `is_calculated or calc_rule is null`. Inputs are the domain's check: only while calculated.
  "Stop calculating" clears all three: the flag, the rule and the inputs.

### Q2. The local file and the registry

- **`attribute_input` is InfoMapper's own table** (both levels), so C1 does not apply. **Format 14:** every attribute
  gets `is_calculated: false` and `calc_rule: null`, and the file gets `attribute_input: []`. As formats 10 to 13: no
  change events and no log line. An upgrade test (`upgrade-14.test.ts`). Step 2 backs up KB first; KB itself gets
  nothing else.
- **`cube_mapping`'s two new columns:** a module's table is not part of the format (AD-33). KB's 0 and the demo's 20 rows
  lack the columns. C1 names only tables that appear with their first row, not columns added later. Proposal: InfoCube
  reads an absent `lookup_relationship_id` or `lookup_default` as null. These are the existing undo `defaults` of
  `ModuleUndoTable` for old images, plus the same default where the module reads its rows. No format number. Step 2
  checks the store's load path and the AD-31 schema check (`scripts/check-schema.ts`) with them.
- **The registry:** `attribute_input` in `UNDOABLE_TABLES` with the parents of F9 and the noun "calculation input". The
  local rules in `RULES`: foreign keys `attribute_id`, `input_attribute_id`; live unique `(attribute_id,
  input_attribute_id)`; CHECK `attribute_input_self_ck`. `cube_mapping` gains the foreign key `lookup_relationship_id →
  relationship` and the kind `lookup` in `CUBE_MAPPING_KINDS`. `tests/table-registry.test.ts` finds the new table in the
  migration.

### Q3. Every count, and where the rule lives

The rule lives in `src/domain/model/derivations.ts` (F5), with two entry points: Rule A for "mapped" and "fed" (F1) and
Rule B for "covered" (F2). The table lists every consumer.

| Count | Today | With slice 18 |
| --- | --- | --- |
| Row dot, title | `buildCards` `rowState` | a calculated row without a direct mapping or feed: a square (`st calc`, `ok` when every input counts), title "Calculated from {inputs}: every input is mapped" (or "fed"; "not every input is … yet"; "no attributes yet") |
| Card bar, `mapped` | `CardData.mapped` from `mappings > 0` | `rowCounts` (F1) |
| Mapped and Unmapped filters, card heights | `card-size.ts` `rowShown` | `rowCounts`; the thumbnails' heights follow, since they share it |
| Frames' stats, collapsed blocks, fit width | `CardData.mapped` | automatic |
| Thumbnails | `thumbnailIndex` | `derivedRows` passed as `rowFeeds` is |
| Overview, status bar, project home | `stats.ts` `coverage` | `rowCounts` with `derivedRows` |
| Entity panel's coverage list | `entity-panel.tsx` `feedOf` | a calculated row says "calculated" (fed or not) |
| Requirement coverage, index, cards, panel, tree, homes | `lookupModel.coverageOf` | F2; the new gap reason |
| Requirement scope, Focus on a requirement, the lens | `scopeOfLinks` | F11 |
| Consistency, `coverageDelta`, delete and import previews | the index; `deciding` | through the index; `deciding` updated |
| Fed from concepts | `fedFromConcepts` | unchanged (Q8) |
| Bus matrix, workspace home | keys; mapping rows | unchanged |

### Q4. Commands, undo names, D-51, four-eyes

| Command | Input | Undo name |
| --- | --- | --- |
| `calculateAttribute` | `attributeId`, `expectedVersion`, `inputIds` (1–50) | **Calculate attribute** |
| `addAttributeInputs` | the same | **Add calculation inputs** |
| `removeAttributeInput` | `attributeId`, `expectedVersion`, `inputId` | **Remove calculation input** |
| `updateAttribute`'s new field `calcRule` | only while calculated | **Change calculation rule** (its own label when it is the only field) |
| `stopCalculating` | `attributeId`, `expectedVersion` | **Stop calculating** |
| `updateCubeMapping`'s `kind: "lookup"`, `lookupRelationshipId`, `lookupDefault` | F13 | "Change dimensional mapping" (unchanged) |

Each write bumps the calculated attribute's version, so the panel's saves stay on the chain. Undo and redo go through
the generic revert, with F8's check. D-51: a change to the kind, the relationship or the no-match value sends an
approved lookup back to review; a note alone does not. Four-eyes: both new columns are content. Calculations have no
status and no four-eyes.

### Q5. Cheap enough

F3: the derivation index is built with the cards on the server and inside each `lookupModel`, memoised, with visited
sets. The row gains one element (the "=" mark, a span with the rule as its title) on calculated rows only, and the
status square is a class on the existing dot. "Performance test" has no calculation: the element guard (S3B-15-elements
against slice-08's counts) stays equal. Idle and pan commits are unchanged (S2C-12, S3A-14-idle, S3B-15-idle). No
`measure:canvas` sitting.

### Q6. The cascades and the previews

- An input's delete: F9, F12. A calculated attribute's delete: its inputs' rows go, silently.
- An entity's delete: every calculation of its attributes goes with them. No calculation reaches across entities.
- A relationship's delete with lookups: F14, F15, F16. An entity's delete that takes such a relationship: the same, in
  its D-47 preview.
- The dictionary's attribute deleted: the lookup goes whole (Q-5), as any dimensional mapping.
- Imports: never delete attributes (F9).

### Q7. Exports, reports, documents

The app has no export or report of mappings or attributes. The documentation pilot's tools live outside the repository
(`.data/exports/docs/tools`), and InfoDocumenter is a separate product. **Recommended: later**, with an entry in
`ideas.md`.

### Q8. "Fed from concepts"

It counts the fact's or dimension's attributes fed directly, per concept, in any status. A calculated attribute's
inputs belong to the same fact or dimension, and their own feeds already bring their concepts. **Recommended: no
change.** Counting a calculation's inputs again would count the same concepts twice.

### The data model (for approval)

Migration **`20261108120000_derivations.sql`** (DDL only, AD-31):

```sql
alter table attribute add column is_calculated boolean not null default false;
alter table attribute add column calc_rule text;
alter table attribute add constraint attribute_calc_ck check (is_calculated or calc_rule is null);

create table attribute_input (
  id                 uuid primary key,
  workspace_id       uuid not null references workspace (id),
  attribute_id       uuid not null references attribute (id),   -- the calculated one
  input_attribute_id uuid not null references attribute (id),   -- same entity, no cycle: the domain's checks
  sort_order         integer not null,
  version, created_at, created_by, updated_at, updated_by, deleted_at   -- standard columns
  constraint attribute_input_self_ck check (attribute_id <> input_attribute_id)
);
create index attribute_input_workspace_ix on attribute_input (workspace_id);
create index attribute_input_attribute_ix on attribute_input (attribute_id, sort_order);
create index attribute_input_input_ix on attribute_input (input_attribute_id);
create unique index attribute_input_ux on attribute_input (attribute_id, input_attribute_id) where deleted_at is null;
alter table attribute_input enable row level security;

alter table cube_mapping drop constraint cube_mapping_kind_ck;
alter table cube_mapping add constraint cube_mapping_kind_ck check (kind in ('direct', 'transform', 'lookup'));
alter table cube_mapping add column lookup_relationship_id uuid references relationship (id);  -- may point to a deleted one (F15)
alter table cube_mapping add column lookup_default text;
create index cube_mapping_lookup_relationship_ix on cube_mapping (lookup_relationship_id);
```

- **No CHECK ties the lookup's columns to the kind.** They are kept when the kind changes, so "switching to Direct copy
  and back keeps them" (S18-06), and are read only for a lookup.
- **`calc_rule` is plain text**, like `rule_expression`, 20,000 characters at most.
- The local file gets format 14 (Q2). `data-model-v2.md` gets `attribute`'s two columns, `attribute_input`, and
  `cube_mapping`'s kind and two columns, with section 11's rules (same entity, no cycle, inputs only while calculated,
  one input for a lookup).

### Earlier specs each item touches

| Item | Earlier specs | Expected change |
| --- | --- | --- |
| 1 (panel, mark) | specs counting a row's elements or reading the attribute panel's sections in order (S1A-08, S1A-09, S10C-*, S15B sections) | none expected: a not-calculated attribute keeps its rows, and its panel gains a section at the end (editors) |
| 2 (counts) | S1B filter specs, S2C (frame stats), S12B thumbnails, overview and status bar specs | none on the plain seed (no calculation) |
| 3 (dependents) | S15-13 (the attribute's second click), S10A-11, RP-08, relationship-ends, S7B-06 (relationship deletes) | none without lookups: no second click is added |
| 4 (lookup) | S15-20, S15-21 (`seg-cube-kind`: a third segment), S3B-02 | a spec reading the segment's whole text gets "Lookup" |
| 5 (demo) | none, since slice 15's fixtures keep the star as it is (F20) | — |
| infrastructure | `tests/table-registry.test.ts`, `undo.test.ts`, `module-cascade` tests, the upgrade tests, `check-schema` | new cases |

Step 2 lists every spec actually changed, with its reason.

### New user-facing texts (for approval)

| Where | Text | Source |
| --- | --- | --- |
| section | **Calculated from** | prototype |
| not calculated | **Not calculated. Mark it when its value is computed from other attributes of {entity}.** | prototype |
| button | **Calculate from attributes…** | prototype |
| picker title | **Calculate {attribute} from…** / **Add inputs to {attribute}** | prototype |
| picker field | **Type to filter attributes…** | prototype |
| picker note | **Attributes of the same entity. One that is calculated from this attribute cannot be chosen.** | prototype |
| done item title | **Already an input, or calculated from this attribute** | prototype |
| picker empty | **This entity has no other attributes.** | prototype |
| picker confirm | **Use** / **Use {n}** | prototype |
| toast, first | **{attribute} is calculated from {a, b}. Write its rule.** (with Undo) | prototype |
| toast, add | **{attribute} reads {n} more attribute(s).** | prototype |
| input state | **mapped** / **fed** / **calculated** / **not mapped** / **not fed** | prototype |
| × title | **Stop reading this attribute** | prototype |
| button | **Add inputs…** | prototype |
| rule label, placeholder | **Rule**, **e.g. {first two inputs joined by " * "}** | prototype |
| no inputs | **Choose the attributes it is calculated from.** | prototype |
| gaps | **Not covered yet: {x, y} are not mapped.** (one: "is"; "fed" at the dimensional level) | prototype |
| covered | **Covered: every input is mapped.** (", directly or through its own calculation" when an input is calculated) | prototype |
| both | **It is also mapped directly. Keep one way to get its value: the calculation or the mapping.** ("fed" / "feed") | prototype |
| button | **Stop calculating**; toast **{attribute} is no longer calculated.** | prototype |
| used by | **Used by {pills}** | prototype |
| row mark title | **Calculated: {rule}** / **Calculated: no rule yet** | prototype |
| dot title | **Calculated from {inputs}: every input is mapped** / **: not every input is mapped yet**; **Calculated from no attributes yet** | prototype |
| refusals | F7's four; F8's "Undoing this would make {a} calculated from itself." | proposal |
| gap reason | **an input of its calculation is not covered** | proposal (F2) |
| delete's second click | **the calculation of {x} loses this input** / **the calculations of {x, y} lose this input** | prototype's row, joined as the app's `then` |
| kind segment | **Lookup** | prototype |
| lookup refusal | **A lookup reads one attribute, the dictionary's value. Remove the others first.** | prototype |
| field | **Through relationship**, **Choose a relationship of {entity}…** | prototype |
| warnings | **{entity} has no relationship to another entity. Draw one in the logical model first.** · **The relationship it went through is gone. Choose another.** | prototype |
| field | **When no match**, placeholder **e.g. Unknown** | prototype |
| sentence | **Each {other} row finds its {dictionary} by {key} and takes {value}; when the code is empty or has no match, the value is “{default}”.** | prototype |
| relationship option | **{from} → {to} ({label})** | prototype `relText` |
| wrong relationship | **Choose a relationship of {entity}.** | proposal (F13) |
| panels' lists | **lookup · {status}** | prototype |
| row title | **lookup of {input}** | prototype |
| chip | **L** | prototype |
| relationship's second click | **the lookup of {target} loses its relationship** / **the lookups of {…} lose their relationship** | proposal (F14) |
| D-47 row | **{n} lookup(s) – lose their relationship** | proposal (F14) |
| undo names | **Calculate attribute**, **Add calculation inputs**, **Remove calculation input**, **Change calculation rule**, **Stop calculating** | proposal (Q4) |

Unchanged: "Change dimensional mapping", "Delete attribute", "Relationship deleted", `BACK_TO_REVIEW_MESSAGE`.

### Differences between the prototype and the app that the slice touches

| # | Prototype | App (proposed) | Why |
| --- | --- | --- | --- |
| P1 | the Mapped filter reads source mappings only | it counts feeds (15c) and calculations | PRD "every count" (F4) |
| P2 | a dimensional feed counts only directly covered logical inputs (`srcOk`) | recursive, so a logical calculation counts | D-70's rule as the app has it (F2) |
| P3 | the scope takes a calculation's inputs one level deep | recursively | coverage is recursive (F11) |
| P4 | a relationship's delete: no preview, the id kept, no review | a second click, the id kept, an approved lookup back to review | PRD item 4 (F14–F16) |
| P5 | Focus lights the inputs' and users' rows | their mappings and lines; no row marks | the app's Focus is card-level (F10) |
| P6 | a title on every dimensional line | none; the chip "L" | element counts (F18) |
| P7 | "Not calculated. Mark it when …" for everyone | for editors; readers see the section when it has content | F19 |
| P8 | the attribute delete is a modal | the second click's text | the app's pattern (F12) |
| P9 | `cmap.via` and `cmap.unknown` keep an approved mapping approved | back to review | D-51, PRD |
| P10 | the rule saved on change | slice 13's draft field | D-66 |
| P11 | no attribute paste | a paste copies no calculation | F6 |
| P12 | the demo's relationship "Customer Address → Country" (rel_5) | "Country → Customer Address (locates)" | the app's seed (F21) |
| P13 | `cubeDemoV4` on every load once | a seed step, slice 18's fixtures only | slice 15's specs (F20) |

### Questions for Łukasz

1. **Q1:** an explicit `is_calculated` flag, so a calculation can be left with no inputs as the prototype allows?
2. **Q-A (item 3):** Focus on an attribute lights its inputs' and users' mappings and lines, not rows (F10, P5)?
3. **Q-B (item 4):** on a relationship's delete, keep the lookup's relationship id pointing to the deleted
   relationship, so the panel can say it is gone (F15), instead of clearing it as the PRD says?
4. **Q-C (item 4):** no title on the lookup's line (F18, P6), or a title on its chip only?
5. **Q-D (docs):** `ideas.md` has no numbered list from 7 November (F22). Write a "done in slice 18" entry instead?
6. **Q-E (texts):** keep the prototype's "Covered: every input is mapped.", where "covered" means Rule A, next to the
   requirement panel's D-31 "covered" (F23)? Or "Fed: every input is mapped."?
7. **Q2:** InfoCube reads an absent `lookup_relationship_id` and `lookup_default` as null, with no format number for the
   module (AD-33), and InfoMapper's format becomes 14?
8. **Q3 and Q8:** the counts as in Q3's table, with "Fed from concepts" unchanged?
9. **F20 (demo):** the derivations as a separate seed step, used by seed, reset, demo and slice 18's fixtures, not by
   slice 15's?
10. **F14:** a relationship with lookups asks a second click (panel and line menu), and the entity's D-47 preview gets
    a lookup row?
11. **Texts and undo names:** as in the table above?
12. **Runs:** a full run at the end of step 2 (undo's check, the new cascade kind, the format), and one at the end of
    step 4, as the PRD says. Step 3's specs as single-file checks.

### Plan for steps 2–4

**Step 2. Data and domain.** KB backed up first; small commits.
1. The migration, `Attribute` and `AttributeInput` types, format 14 with its upgrade test, the local rules, the registry
   (`PARENTS`, noun), the table-registry test, and the schema check.
2. `derivations.ts` with its unit tests: the index, reaches, cycles, Rule A, Rule B, gaps.
3. The commands (Q4), their checks (F7), the labels; the cascades in `deleteAttribute` and `entityCascade` (F9); undo's
   cycle check (F8). Unit tests for each, with undo and redo.
4. InfoCube: the kind `lookup`, the two fields, the candidate rule, D-51, four-eyes and the type check (F13); the
   module's absent-column defaults (Q2); the new cascade kind `follows` (F16) with its unit tests.
5. `lookupModel`'s Rule B and the new reason; `scopeOfLinks`' inputs (F2, F11); `deciding`. Unit tests.
6. CI, then **one full run** (shared infrastructure: undo, the cascade, the format), with its report.

**Step 3. Panels and canvas.**
1. "Calculated from" (F19) with the picker (slice 17's `PickPopover`, `done` items) and the toasts.
2. The row's "=" mark and the square (`CardRow.calc`, CSS as the prototype's).
3. The lookup's fields, sentence and warnings in `mapping-panel.tsx`; "lookup ·" in `feeds.tsx`; the row title; the
   chip "L".
4. `addDerivationsDemo` (F20).
5. S18-02, S18-03 and S18-06, plus the touched specs as single-file checks, and CI.

**Step 4. Coverage and dependents, the close.**
1. Rule A in every count (Q3): `buildCards`, `thumbnailIndex`, `stats`, `rowCounts`, the entity panel.
2. Focus (F10), the second clicks and the D-47 row (F12, F14), the lens and scope in the browser.
3. S18-01, S18-04, S18-05, S18-07 and S18-08; the element guard against slice-08's counts; the idle commit specs; the
   index bench (F3).
4. The docs: D-73 quoted for approval with "(Changed by D-73.)" on D-31, `data-model-v2.md`, `ideas.md`,
   `inventory-prototype-vs-app.md`, README, CLAUDE.md (the new table, the `follows` extension point, the rules in one
   place).
5. **One full run** on the final commit, then the manual acceptance steps. Merge and tag only on Łukasz's command.

## Łukasz's answers to step 1 (8 November 2026)

1. **Q1:** yes, an explicit `is_calculated` flag.
2. **Q-A:** yes, Focus on an attribute lights its inputs' and users' mappings and lines (F10).
3. **Q-B:** yes, the lookup keeps its relationship's id when the relationship is deleted, so the panel can say it is gone;
   an approved lookup still goes back to review (F15).
4. **Q-C:** no title on the lookup's line, as InfoCube's other lines; the panel explains it (F18).
5. **Q-D:** yes, a "done in slice 18" entry in `ideas.md` (F22).
6. **Q-E:** "covered" is not used for a calculation (it is D-31's word for requirements). The section says **"Every
   input is mapped."** / **"Every input is fed."** (with ", directly or through its own calculation" when an input is
   calculated) and **"Not yet: {names} {is/are} not mapped."** / **"… not fed."**. The row dot's titles keep "every
   input is mapped" / "not every input is mapped yet", which do not say "covered".
7. **Q2:** yes: InfoMapper's local format 14; InfoCube reads the two new `cube_mapping` columns as null when missing.
8. **Q3 and Q8:** yes, the counts as in Q3's table; "Fed from concepts" unchanged.
9. **F20:** yes, the demo's two examples as a separate seed step (seed, reset, `npm run demo`, slice 18's fixtures),
   not slice 15's.
10. **F14:** yes: deleting a relationship that lookups go through shows them and asks a second click (only then); an
    entity's delete preview gets a lookup row.
11. **Texts and undo names:** approved as listed, changed as answer 6 says.
12. **Runs:** one full run at the end of step 2, one at the end of step 4; single-file checks in step 3.
