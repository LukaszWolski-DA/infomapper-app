# Slice 19 – acceptance

PRD: [`slice-19-infocube-types.md`](slice-19-infocube-types.md). Branch `slice/19-infocube-types`.

## Step 1: the PRD checked against the code (8 November 2026)

### The starting point

- **The branch.** `main` was up to date with `origin/main` at `de20b83`, the merge of PR 45. The tag `slice-18` points
  to that commit. `slice/19-infocube-types` was cut from there.
- **No run in this step.** No dev or e2e server ran and no script ran, so KB was not backed up. Step 2 backs it up first,
  because it changes how InfoCube's rows are stored (Q2). KB's `.data/dev-db.json` does hold InfoCube rows (`role` and
  `scd_type` appear about 40 times there, counting the change log's images), so reading older rows matters for real data.
- **The two files from Łukasz's Downloads**, each checked with `cmp` after the copy and committed with this document:

  | File | SHA-256 | `cmp` |
  | --- | --- | --- |
  | `docs/prd/slice-19-infocube-types.md` (new, 13,560 bytes) | `4f68d2e018201fe804bf6fc55abefeba0d6579e0852f1e3f484ebdb6f82f7e58` | equal |
  | `docs/prototype/infomapper-prototype-with-sources.html` (687,691 bytes, replaces slice 18's `124207eb…`) | `ee2f17b1f0b7a304ff417aa7b3cbf9212adb817d135a1d8f1b81d9415c2c255f` | equal |

- **The prototype's slice-19 code.** Against slice 18's version, the diff adds 101 lines and removes 13:
  - the CSS `.seg.g2` (four choices in two rows);
  - `FTYPE_L`, `FTYPE_S`, `FTYPE_D`, `DKIND_D`, `cubeTitle`, `scdLabel`, `aggregatesOf` and `baseChain`;
  - `cubeDependents`' history text and its "loses its base fact" row;
  - `factHints`' four new hints;
  - `cubeEntitySection` for a fact (Fact type, Factless fact, Aggregate of, Aggregated by, the factless Measures text,
    "· snapshot" on a dimension's key) and for a dimension (Kind, Outrigger of, Outriggers, History, Snapshot period, the
    "reached through" text);
  - `cubeDemoV5` and `cubeDemoV6`;
  - `cubeIndex`'s defaults (`type`, `factless`, `base`, `kind`) and the derived `outOf` and `outs`;
  - the card's chip and title (`entCard`), the panel's Role (`insEntity`), the Cube tab's text (`cubeTree`) and the bus
    matrix's column label (`openBusMatrix`);
  - the handlers `cube.snap`, `cube.base`, `cube.scd` (with "snapshot"), `cube.ftype`, `cube.dkind` and `cube.factless`.

### Summary

The PRD's shape holds, and the slice is on the full path, as its status line says. It needs a migration, two new kinds of
module support in shared code (the local adapter and undo), and a seed step. The PRD is wrong, incomplete or different
from the code in these places:

1. **An older row cannot be read with slice 18's `TableRules.defaults`.** A default is one fixed value, so it cannot turn
   `scd_type` 2 into `history` "history". The adapter's checks also read the stored rows raw: an older `cube_entity` row
   would fail the new shape check on the next write to that table, which would refuse every InfoCube save in KB (F1).
2. **Undo can make a cycle of aggregates, or point a fact to a deleted base.** `revertChangeGroup` has a cycle check for
   calculations only, and no module can add one (F6).
3. **The outrigger rule for many-to-many is not stated.** The prototype makes the `from` end the outrigger whenever the
   `to` end is not the only "one", so M:N counts too (F8).
4. **The card's chip is never cut.** `.clip-l1` cuts only the concept text after it, so "Fact · Accumulating · Factless ·
   Aggregate" would push the header on a narrow card (Q7, F11).
5. **The texts that already exist change in the prototype**, beyond what the PRD names: the card's title, the History
   sentences ("SCD 0: …"), the technical-columns sentence (with "snapshot date"), and the Cube tab's text, which gains
   "factless", "aggregate", "junk" and "outrigger" (P1 to P4). Earlier specs read some of them.
6. **Slice 18's fixtures use `addDemoData`.** If slice 19's demo joins it, slice 18's specs get it too, and the PRD says
   they should not (F14).
7. **The PRD cites C-7 for the rights.** C-7 is about turning InfoCube off. The right to edit is AD-05's `model.edit`,
   which every InfoCube command already checks (F16).
8. **S19-03 says "a relationship from Fact Orders to Dim Order Flags".** D-67 turns a relationship between a fact and a
   dimension so that it starts at the dimension. Only the wording changes; the test draws it either way (F17).

### Findings

| # | Finding | Files and functions | Proposal |
| --- | --- | --- | --- |
| F1 | **Reading older rows.** `readRows` (`src/data/local/schema.ts` l. 597) adds a module's fixed `defaults` to a row that lacks a column. `findViolation` (l. 623–675) runs every check of a written table on **every stored row** through `rowsOf`, not `readRows`. An older dimension row (`scd_type` 1, no `history`) would fail the new `cube_entity_shape_ck`, so the first InfoCube save would be refused with a broken-data error. A fixed default cannot convert 0/1/2 either. | `schema.ts` `TableRules`, `readRows`, `findViolation`; `store.ts` `load`, `modules.list`, `loadForUndo`; `infocube/data/tables.ts` | **A module's row upgrade:** `TableRules.upgrade?: (row) => row \| null` (null: already current). It is pure, it is the module's own, and the adapter runs it on every row of the table **when the file is loaded**, before any read or check. The file holds the new shape after its next write. InfoCube's upgrade gives a fact `fact_type` "transaction" and `is_factless` false; gives a dimension `dim_kind` "standard" and `history` keep/overwrite/history from `scd_type` 0/1/2 (1 when absent); sets the other new columns to null; and drops `scd_type`. It is idempotent and tested on KB's shapes. Slice 18's `defaults` stay. This touches shared infrastructure (the local adapter), so step 2 does a full run. Question 1. |
| F2 | **Undo images of the old shape.** `unchangedSince` (`undo.ts` l. 470) compares a row with a step's after-image key by key. The undo history lives in the server's memory (`store.ts` l. 286, `histories`), so it is empty after the restart that brings the new code. No image of the old shape reaches undo. | `undo.ts`, `store.ts` | No image upgrade. In the one case left (a dev server that reloads code without a restart), such a step is refused as "changed since", which is safe. Noted in `known-limitations.md`. |
| F3 | **One command for the row.** `updateCubeEntity` (`infocube/domain/commands.ts` l. 80–100) takes `grain` and `scdType`, refuses each on the wrong role (`GRAIN_ON_DIMENSION`, `SCD_ON_FACT`) and writes one update. Its undo name is InfoMapper's default "Change fact or dimension" (`change-label.ts` l. 240, the noun from `INFOCUBE_UNDO`). | `commands.ts`, `app/actions.ts` `updateCubeEntityAction` | `updateCubeEntity` takes `factType`, `isFactless`, `baseFactEntityId` (nullable), `dimKind`, `history` and `snapshotPeriod` beside `grain`, each optional, each refused on the wrong role (Q6). `scdType` goes. The state gains the workspace's live `cube_entity` rows, for the base's checks (F5). Each save sends one field, and its `writeSet.label` names it (see the undo names below). The grain keeps its label. |
| F4 | **The new row's defaults.** `createCubeEntity` (l. 38–45) writes `grain: null` and `scd_type: 1` for a dimension. "Create dimension from this…" (`mappings.ts` l. 713) goes through it. | `commands.ts`, `types.ts` `DEFAULT_SCD_TYPE` | A fact: `fact_type` "transaction", `is_factless` false, base null. A dimension: `dim_kind` "standard", `history` "overwrite", period null. `SCD_TYPES` and `ScdType` become `HISTORIES` and `History`; `FACT_TYPES` and `DIM_KINDS` are new (`types.ts`). |
| F5 | **The base's checks.** Nothing in the code knows aggregates. | new, `infocube/domain/aggregates.ts` | The rules live in one place, and they are pure: `baseOf(index, factId)` (a live fact other than itself, otherwise none: the prototype's `cubeIndex`), `aggregatesOf`, `reachesBase(from, to)` (the prototype's `baseChain`, with a visited set) and `baseChoices(factId)` (the select's options: the other live facts in the model's order of entities, minus any whose chain reaches this fact). `updateCubeEntity` refuses the fact itself, a base that is not a live fact, and a base that closes a cycle (texts below). `CubeIndex` gains `baseOf` and `aggregatesOf`. |
| F6 | **Undo and the base.** Two cases. (a) Anna clears Fact Orders' base, someone makes Fact Sales an aggregate of Fact Orders, and Anna undoes her step: the result is a cycle. (b) Anna clears a base, someone deletes that base fact, and Anna undoes: the base now points to a deleted fact. `revertChangeGroup` (`undo.ts` l. 433–435) knows parents, key clashes and calculation cycles; a module cannot add a check. The prototype does not handle this. | `undo.ts`, `ModuleUndoTable`; `infocube/domain/tables.ts` | **A module's revert check:** `ModuleUndoTable.revertRefusal?: (rows, touched) => string \| null`, a pure rule that undo calls beside `calculationCycle`, given the rows after the revert. InfoCube refuses (a) "Undoing this would make {fact} an aggregate of itself." and (b) "Undoing this would make {fact} an aggregate of a deleted fact." The readers still treat a base that is not a live fact as none (F5), as a second line of defence. This touches shared infrastructure (undo), so it is in step 2's full run. Question 2. |
| F7 | **A fact's delete with aggregates.** Slice 18's `follows` (`module-cascade.ts`, last loop; `ModuleUndoTable.follows`) is the right tool: `cube_entity.follows = [["base_fact_entity_id", "entity", () => ({ base_fact_entity_id: null })]]`. When a write soft-deletes the base fact's entity, each live aggregate's row is updated in the same change group, and one undo brings both back. An aggregate deleted in the same write (a concept's delete) is skipped, because the loop skips rows already written. `follows`' comment says the column keeps its id; InfoCube's lookups do that, and this rule clears the column. | `module-cascade.ts`, `undo.ts` (comment only), `infocube/domain/tables.ts` | Register it. Correct the comment: the rule may change any column, the pointer included. The base is not a parent (an aggregate does not go with its base), so `parents` does not change. A role change does not exist: a role is set on create and the panel shows it read only (spec l. 132, D-67), so there is nothing to handle there. |
| F8 | **Outriggers, derived.** Relationships store `from_max` and `to_max` as "1" or "n" (`types.ts` l. 126, 201–204). In the star the dimension is the `from` end with `from_max` "1" (`sales-star.ts` l. 192–195), so `from_max` is the multiplicity at the `from` end. The prototype's rule (`cubeIndex`): the `to` end is the outrigger when `to_max` is "1" and `from_max` is not; otherwise the `from` end, which covers 1:1 (as the PRD says) and also M:N (not in the PRD). A loop is skipped. Roles at the ends do not matter. | new, `infocube/domain/outriggers.ts` | `outriggers(index, relationships)`: `outOf` (an outrigger's dimensions) and `outs` (a dimension's outriggers), live relationships between two different dimensions only. 1:N gives the "1" end; 1:1 gives the `from` end; **M:N gives none** (that is a bridge, which this slice leaves for later). Nothing is stored, and a relationship's delete or undo changes it at once. `CubeIndex` gains them. Question 3. |
| F9 | **The relationship panel.** InfoCube's relationship section (`CubeRelationshipSection`, `sections.tsx` l. 328; the prototype's `relKeySection`) shows only for a fact – dimension relationship. The prototype says nothing about outriggers there. | `sections.tsx` | Nothing in the relationship panel: the two dimensions' panels name it. Question 4. |
| F10 | **The chip's text is built in the composition root.** `moduleView` (`src/compose/view.ts` l. 60) sets each role's `text` (`ROLE_NAMES`) and `title` (`ROLE_TITLES`, `infocube/domain/view.ts` l. 14). `buildCards` puts the text in `line1` (`card-data.ts` l. 273), and the entity panel's Role shows `role.text` and `role.title` (`entity-panel.tsx` l. 93–99). | `view.ts` (domain and compose) | `cubeTitle(index, outriggers, entityId)` in the module's `view.ts` returns `{ short, long }` as the prototype does: `text` is the short form, and `title` is the long form plus " (InfoCube)" on both the card and the panel. `moduleView` builds the outriggers once per page from `model.relationships`. The chip changes after a save's fresh page, as the Σ marks do; step 3 verifies this for a relationship drawn or deleted on the canvas. |
| F11 | **Cutting the chip.** `lineNeedsClip` already measures `line1` with `ROLE_MARK` (`card-data.ts` l. 335), so `clip-l1` is set when the header's first line does not fit. But `canvas.css` l. 35 cuts only the second span (`in {concept}`). `.stereo.role.cube` is `inline-flex` (`infocube.css` l. 12). | `infocube.css`, `canvas.css` | Under `.clip-l1`, the role chip is cut too: `min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap` on its text, and the cube's `::before` stays (`flex: none`). The concept text is cut first: it gets `flex-shrink` 1 and the chip a smaller one. The full text is in the title. CSS only, no element (AD-24: the clip only where the text may not fit). Question 5. |
| F12 | **The Cube tab's text.** `tabMeta` (`view.ts` l. 25) gives "grain set" / "no grain" or "SCD n". `cubeSections` takes no relationships. | `view.ts`, `compose/view.ts` | As the prototype's `cubeTree`. A fact: `[Snapshot or Accumulating, "factless", "aggregate", "grain set" or "no grain"]`. A dimension: `[history label, "junk", "outrigger"]`. Each is joined with " · ". `cubeSections` takes the outriggers. A plain fact or dimension keeps today's text, so S15-06 stays as it is. |
| F13 | **The bus matrix and the delete preview.** `busMatrix` gives each dimension a numeric `scd` (`bus-matrix.ts` l. 82), and `BUS_MATRIX_TEXTS.scd` writes "SCD n" (l. 19). `entityDependents` writes "SCD type n deleted" (`view.ts` l. 63). | `bus-matrix.ts`, `bus-matrix-dialog.tsx`, `view.ts` | One `historyLabel(row)`, the prototype's `scdLabel`: "SCD 0", "SCD 1", "SCD 2", or "Snapshot · {period}" ("Snapshot" without a period). The matrix's dimension gets `history: string` in place of `scd`. The preview writes "SCD type n deleted", or for a snapshot "its history (Snapshot · Month-end) deleted". A fact with aggregates gets the row "{names}" – "loses its base fact" / "lose their base fact". The bus matrix's counts do not change. A dimension no fact uses (an outrigger, a junk dimension not yet related) shows "unused", as in the prototype (Q5). |
| F14 | **The demo's place.** `addDemoData` (`src/compose/seed.ts` l. 18) is the star plus the derivations, run by seed, reset, `npm run demo` **and slice 18's fixtures** (`e2e/slice-18/fixtures.ts` l. 15) and one unit test (`tests/infocube-lookups.test.ts` l. 230). Slice 15's fixtures use `addModuleDemoData` (the star only). | `compose/seed.ts`, `infocube/data/sales-star.ts`, `e2e/slice-18/fixtures.ts` | A module step `addStarTypes` in `sales-star.ts`: Fact Orders an aggregate of Fact Sales; Dim Category (concept Product) with category_key (Integer, PK), category_code and category_name, and its relationship "groups", Dim Category 1..1 → Dim Product 0..n, so Dim Category is the outrigger; Dim Order Flags (concept Sales, junk) with order_flags_key (Integer, PK), payment_type, channel and is_gift (Boolean); Dim Product a snapshot, "Month-end". The two new cards go on "Sales star" in free spots (the prototype puts them below Dim Product and at the top right). `addDemoData` = star + derivations + types. Slice 18's fixtures and that test move to a new export `addDerivationsDemoData` (star + derivations), so they stay as they are. Never KB. Question 6. |
| F15 | **Slice 15's measuring data.** `scripts/lib/star-canvas.ts` l. 71 and the unit fixture `infocube/domain/__fixtures__/star.ts` l. 58 write `scd_type`. | as listed | Both use the new columns. The S15-layers figures do not change: the chip is the same "Fact" or "Dimension". |
| F16 | **The rights.** The PRD writes "the rights to edit the model (C-7)". C-7 is about InfoCube being off. Every InfoCube command checks `model.edit` through `begin` (AD-05), and the sections are read only when `!p.editable`. | — | Read it as AD-05. While InfoCube is off nothing new can be written: no fact or dimension exists then (C-7 as changed). |
| F17 | **The direction in S19-03.** The test makes the relationship between Fact Orders and Dim Order Flags. D-67 stores it from the dimension. | — | The spec draws it either way and reads the hint. |
| F18 | **The History segment.** `Seg` (`fields.tsx` l. 514) is one `inline-flex` row; the prototype puts four choices in a 2 × 2 grid (`.seg.g2`). | `fields.tsx` | `Seg` gets a `columns?: 2` prop (classes only). Its test id stays `seg-cube-scd`, so S15-08b keeps its locator; the buttons' texts are unchanged for 0, 1 and 2. |
| F19 | **The snapshot period.** The prototype focuses an empty period field when Snapshot is chosen, and keeps the period when another value is chosen. | `sections.tsx` | A `TextField` with `keep` (slice 13), trimmed, empty → null, `optionalTextSchema`'s limit, saved with `saveRow`. It shows only while the history is Snapshot, and after Snapshot is chosen it is focused when empty. Readers see it read only. |

### Q1. The history column

- **`history text`** replaces `scd_type`, as decision A says: `keep`, `overwrite`, `history`, `snapshot`. The CHECK is
  `cube_entity_history_ck` (null or one of the four) inside the shape check. The conversion is 0 → keep, 1 → overwrite,
  2 → history, in the migration's `update` and in the adapter's upgrade (F1).
- **Every reader of `scd_type`** (all found with `grep`):
  - domain: `types.ts`, `commands.ts`, `view.ts` (`tabMeta`, `entityDependents`), `bus-matrix.ts`;
  - data: `data/tables.ts` (`shapeFits`), `sales-star.ts`;
  - UI: `sections.tsx` (`SCD_OPTIONS`, `SCD_SENTENCE`, `DimensionSection`), `bus-matrix-dialog.tsx`;
  - tests and scripts: `commands.test.ts`, `description-and-keys.test.ts`, `__fixtures__/star.ts`,
    `tests/infocube-mapping-commands.test.ts`, `tests/infocube-requirements.test.ts`, `tests/infocube-star.test.ts`,
    `tests/table-registry.test.ts`, `scripts/lib/star-canvas.ts`;
  - e2e: `slice-15a/S15-07`, `S15-14`, `slice-15b/S15-08b`.
- Documents (InfoDocumenter, `.data/exports/docs/tools`) are outside the repository's code, and no exporter in `src/`
  reads `scd_type`. Łukasz's documentation tools read the local file and need their own update, outside this slice.
- **Recommendation:** as the PRD says, with the labels "SCD 0", "SCD 1", "SCD 2" and "Snapshot · {period}" from one
  helper (F13).

### Q2. Older files and older rows

InfoCube's tables are not part of the file's format (slice 15, C1). Slice 18's `TableRules.defaults` cannot convert a
value, and the adapter's checks read raw rows (F1). **Recommendation:** a module's row upgrade, run when the file is
loaded (F1), with no format number for the module and InfoMapper's format unchanged (14). No InfoMapper column changes.
The undo history needs nothing (F2). The change log keeps the old images as they were (it is history).

### Q3. A fact's delete with aggregates, and a role change

Clear `base_fact_entity_id` through slice 18's `follows`, in the same change group (F7). The preview gets one row from
`entityDependents` (F13), and one undo brings back the fact and its aggregates' base. A role change does not exist in the
app (F7). Undo gets InfoCube's revert check for cycles and deleted bases (F6).

### Q4. Outriggers

The rule is in the domain (`outriggers.ts`, F8). It reads `from_max` and `to_max`, ignores the minimums and the roles,
and skips loops. **Recommendation:** M:N gives none, and InfoMapper's relationship panel says nothing (F9).

### Q5. The hints and the counts

All four hints are in `factHints` (`keys.ts` l. 197–227), after the existing ones, in the prototype's order and with its
texts. Each opens what it names, as the existing hints do:

| Hint | Condition | Opens |
| --- | --- | --- |
| factless with measures | `is_factless` and at least one measure | the first measure's attribute |
| periodic, additive | fact type periodic: one hint per additive measure | that attribute |
| accumulating, one date | fact type accumulating and no dimension related twice or more | the fact itself |
| aggregate, extra dimension | a base, and a dimension related to this fact but not to the base: one hint per dimension | that dimension |

The accumulating hint counts relationships per dimension, as the prototype's `byDim` does. A fact with no dimensions gets
it beside "No dimension keys…". `NO_HINTS` stays. No count in the Cube tab or the bus matrix changes. Requirements,
coverage and the thumbnails do not read any of the new fields.

### Q6. Commands, undo names, the shape check

One command, `updateCubeEntity`, takes each field (F3). The wrong-role refusals are below; the local adapter's
`cube_entity_shape_ck` backs them. Undo names, one step each:

| Change | Undo name |
| --- | --- |
| fact type | Change fact type |
| factless on / off | Mark fact factless / Unmark fact factless |
| base set or changed / cleared | Set aggregate base / Clear aggregate base |
| dimension kind | Change dimension kind |
| history | Change history |
| snapshot period | Change snapshot period |
| grain | unchanged: "Change fact or dimension" |

### Q7. The chip

The text is built in `moduleView` (F10). Its width is measured in `lineNeedsClip` with `ROLE_MARK`. **Recommendation:**
cut it with an ellipsis on one line, the concept text first, with the full text in the title (F11). Wrapping would change
the header's height, and with it `cardHeight`, the thumbnails and the miniature, for a tooltip's worth of words.

### Q8. The demo seed and the earlier fixtures

As F14. Fixtures that read Dim Product's history or Fact Orders: slice 15's (`addModuleDemoData`, unchanged), slice 18's
(moved to `addDerivationsDemoData`, so unchanged) and `tests/infocube-star.test.ts` (reads `addModuleDemoData`'s star:
only the column names change). Fact Orders' grain, measures and keys stay as they are.

### The data model (for approval)

Migration **`20261108130000_infocube_types.sql`** (DDL with the conversion; AD-31: no database holds data yet):

```sql
alter table cube_entity add column fact_type text;
alter table cube_entity add column is_factless boolean;
alter table cube_entity add column base_fact_entity_id uuid references entity (id);
alter table cube_entity add column dim_kind text;
alter table cube_entity add column history text;
alter table cube_entity add column snapshot_period text;

update cube_entity set fact_type = 'transaction', is_factless = false where role = 'fact';
update cube_entity set dim_kind = 'standard',
  history = case scd_type when 0 then 'keep' when 2 then 'history' else 'overwrite' end
  where role = 'dimension';

alter table cube_entity drop constraint cube_entity_shape_ck;
alter table cube_entity drop column scd_type;

alter table cube_entity add constraint cube_entity_fact_type_ck
  check (fact_type is null or fact_type in ('transaction', 'periodic', 'accumulating'));
alter table cube_entity add constraint cube_entity_dim_kind_ck check (dim_kind is null or dim_kind in ('standard', 'junk'));
alter table cube_entity add constraint cube_entity_history_ck
  check (history is null or history in ('keep', 'overwrite', 'history', 'snapshot'));
alter table cube_entity add constraint cube_entity_base_ck check (base_fact_entity_id is null or base_fact_entity_id <> entity_id);
alter table cube_entity add constraint cube_entity_shape_ck check (
  (role = 'fact' and fact_type is not null and is_factless is not null
     and dim_kind is null and history is null and snapshot_period is null)
  or (role = 'dimension' and grain is null and fact_type is null and is_factless is null
     and base_fact_entity_id is null and dim_kind is not null and history is not null));
create index cube_entity_base_ix on cube_entity (base_fact_entity_id);
```

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `fact_type` | text | yes | a fact's: `transaction` (new and existing facts), `periodic`, `accumulating`; null for a dimension |
| `is_factless` | boolean | yes | a fact's, false by default; null for a dimension |
| `base_fact_entity_id` | uuid | yes | FK `entity`: a fact's base when it is an aggregate. Not itself (CHECK); a live fact and no cycle are the domain's checks; cleared when the base is deleted (`follows`) |
| `dim_kind` | text | yes | a dimension's: `standard` (new and existing), `junk`; null for a fact |
| `history` | text | yes | a dimension's: `keep`, `overwrite` (new), `history`, `snapshot`; replaces `scd_type` 0/1/2; null for a fact |
| `snapshot_period` | text | yes | a dimension's, plain text ("Month-end"), kept whatever the history; null for a fact |

The local rules (`infocube/data/tables.ts`) mirror the checks: `shapeFits` for the new shape, `oneOf` for the three
lists, the base check, and `base_fact_entity_id: "entity"` in `foreignKeys` (a deleted entity's id still exists, as the
lookups' relationship). `INFOCUBE_UNDO.cube_entity` gains `follows` (F7) and `revertRefusal` (F6). The upgrade is F1's.
`docs/data-model-v2.md` § `cube_entity` is rewritten in step 3 with D-74.

### Earlier specs and tests each item touches

| Item | Earlier specs and tests | Expected change |
| --- | --- | --- |
| data (F1, F4) | e2e `slice-15a/S15-07` (`scd_type: null`, `scd_type: 1`), `S15-14` (`scd_type: 0`), `slice-15b/S15-08b` (`scd_type` 2, 1, 0); unit `commands.test.ts`, `description-and-keys.test.ts`, `infocube-mapping-commands.test.ts`, `infocube-requirements.test.ts`, `infocube-star.test.ts`, `table-registry.test.ts`, `__fixtures__/star.ts`; `scripts/lib/star-canvas.ts` | the row reads use the new columns and values (`history: "keep"` …) |
| 1, 2, 3, 4 (chip, title) | `S15-07` (15a: the title "A fact: one row per its grain (InfoCube)"), `S15-01` (chip text), `S15-layers`, `S15A-screens`; unit `canvas.test.ts` l. 341, `infocube-star.test.ts` l. 110 | the title becomes "Transaction fact (InfoCube)" / "Dimension (InfoCube)" (P2); the chip stays "Fact" / "Dimension" |
| 6 (History) | `S15-08b` (the label, the sentences, `TECHNICAL`), `S15-08` (reviewer, read only) | the label "History"; the sentences "SCD 0: values never change once loaded." …, and the technical sentence with "snapshot date" (P3) |
| 6 (labels) | `S15-06` (Cube tab), `S15-16` (bus matrix), `S15-14` in 15a and 15c (the preview) | none: slice 15's star has only plain facts and dimensions with SCD 0, 1 and 2 |
| 2 (Measures) | `S15-07` (15b: "None yet. Open a numeric…") | none: only a factless fact gets the new text |
| 8 (demo) | slice 18's fixtures and `tests/infocube-lookups.test.ts` l. 230 | moved to `addDerivationsDemoData`, so no change in what they read (F14) |
| infrastructure | `store.test.ts`, `undo.test.ts`, `module-cascade.test.ts`, `tests/table-registry.test.ts`, the schema check (`check-schema`) | new cases for the upgrade, the revert check and the base's `follows` |

Step 2 and step 3 list every test actually changed, with its reason.

### New user-facing texts (for approval)

All from the prototype unless marked.

| Where | Text |
| --- | --- |
| Fact section | **Fact type** · segments **Transaction**, **Periodic**, **Accumulating** |
| its sentence | **Transaction.** One row per event or business transaction, written once. |
| | **Periodic snapshot.** One row per period and its dimensions (e.g. a month-end balance), whether or not anything happened. |
| | **Accumulating snapshot.** One row per process instance (e.g. an order), updated as it passes its milestones; usually several dates. |
| toggle | **Factless fact** |
| its sentence | on: It records that something happened, or could happen, with no amounts: counting its rows is its measure. · off: Turn on when the fact deliberately has no measures (an event or a coverage). |
| select | **Aggregate of** · first option **Not an aggregate** |
| its sentence | It summarises **{base}** at a coarser grain: its dimensions should be {base}'s or fewer. ({base} is a link) |
| list | **Aggregated by** · each row: {fact}, meta its grain or "no grain" |
| Measures, factless | None: a factless fact. Count its rows. |
| Dimensions, a snapshot dimension's key | "key {name} · snapshot", "snapshot" titled "{dimension} is a snapshot dimension: the fact joins it by the snapshot date" |
| hints | It is marked factless but has measures: {names}. Turn off one or the other. · {name} is additive. In a periodic snapshot, balances and levels are usually semi-additive across the date. · An accumulating snapshot usually carries several dates of its process: a date dimension in several roles. · {dimension} is not a dimension of {base}, its base. An aggregate has the base's dimensions or fewer. |
| Dimension section | **Kind** · **Standard**, **Junk** |
| its sentence | Standard: A dimension of one business object or topic. · Junk: Low-cardinality flags and indicators gathered in one dimension instead of many small ones on the fact. |
| list | **Outrigger of** · each row: {dimension}, meta "from the relationship"; below: A dimension referenced by another dimension, not by a fact. It follows from the relationship. |
| list | **Outriggers** · each row: {dimension}, meta "outrigger" |
| field | **History** (was "Slowly changing dimension type") · **0 · keep**, **1 · overwrite**, **2 · history**, **Snapshot** |
| its sentence | SCD 0: values never change once loaded. · SCD 1: a change overwrites the old value; no history. · SCD 2: a change adds a new version; the old one stays with its validity. · Snapshot: each snapshot keeps the whole dimension as it was on that date (in Data Vault, usually from a PIT table); a row is the business key and the snapshot date. Facts join it by the snapshot date. |
| after it | Technical columns (valid from, valid to, current, snapshot date) are a physical matter and are not modelled here. |
| field | **Snapshot period** · placeholder "e.g. Month-end, Daily" |
| Used by, an outrigger | No fact uses it directly; it is reached through {dimensions}. |
| chip | Fact · Snapshot / · Accumulating / · Factless / · Aggregate; Dimension · Junk / · Snapshot / · Outrigger (in that order) |
| chip's title | e.g. "Periodic snapshot fact, factless, aggregate of Fact Sales (InfoCube)", "Junk dimension, snapshot (Month-end), outrigger of Dim Product (InfoCube)"; a plain one "Transaction fact (InfoCube)", "Dimension (InfoCube)" |
| Cube tab | fact: "Snapshot · factless · aggregate · grain set"; dimension: "Snapshot · Month-end · junk · outrigger" (each part only when it applies) |
| bus matrix, preview | Snapshot · {period}; "its history (Snapshot · {period}) deleted"; "{fact} loses its base fact" / "{facts} lose their base fact" |
| refusals (new) | Only a fact has a fact type. · Only a fact can be factless. · Only a fact can be an aggregate. · Only a dimension has a kind. · Only a dimension has a history. (replaces "Only a dimension has an SCD type.") · Only a dimension has a snapshot period. · A fact is not an aggregate of itself. · Choose a fact as the base. · {base} is an aggregate of {fact}, so {fact} cannot be an aggregate of it. |
| undo refusals (new) | Undoing this would make {fact} an aggregate of itself. · Undoing this would make {fact} an aggregate of a deleted fact. |
| undo names | as in Q6 |

### Differences between the prototype and the app that the slice touches

| # | Prototype | App now | Proposal |
| --- | --- | --- | --- |
| P1 | The Cube tab shows factless, aggregate, junk and outrigger as well as the fact type and history | "grain set" / "SCD n" | as the prototype (F12); the PRD names only the fact type and the snapshot |
| P2 | The card's and the panel's title are the long text ("Transaction fact", …); the panel's has no "(InfoCube)" | "A fact: one row per its grain (InfoCube)", the same on the panel | the long text with " (InfoCube)" on both, one string (F10) |
| P3 | The History sentences start "SCD n:"; the technical sentence adds "snapshot date" | the old texts | as the prototype |
| P4 | The base select offers facts in InfoCube's row order | — | the model's order of entities, as the Cube tab (F5) |
| P5 | M:N between two dimensions makes the `from` end an outrigger | — | none (F8, question 3) |
| P6 | Undo can make a cycle of aggregates; a base that is not a fact reads as none | — | the revert refused (F6); the read is the same as the prototype's |
| P7 | The chip is never cut | — | cut with an ellipsis (F11) |
| P8 | The demo is applied on every load, once (`cubeDemoV5`, `cubeDemoV6`) | — | a seed step (F14) |
| P9 | The accumulating hint opens the fact itself | the "No dimension keys" hint does the same | the same |

### Questions for Łukasz

1. **Older rows (F1, Q2):** the local adapter runs a module's row upgrade when the file is loaded, before reads and
   checks, so KB's InfoCube rows read as the new shape and the shape check never meets an old row?
2. **Undo (F6):** a new module revert check, so undo refuses a cycle of aggregates or a base that is a deleted fact? Or
   tolerate both and read such a base as none, as the prototype does?
3. **Outriggers (F8):** no outrigger for a many-to-many relationship between two dimensions (the prototype makes the
   `from` end one)?
4. **Relationship panel (F9):** nothing about outriggers there, as in the prototype?
5. **The chip (F11, Q7):** cut with an ellipsis on one line, the concept text first, the full text in the title?
6. **The demo (F14):** slice 19's demo in `addDemoData`, with slice 18's fixtures and its unit test moved to
   `addDerivationsDemoData`, so slice 18's specs stay as they are?
7. **Changed texts (P2, P3):** the card's and the panel's title become "Transaction fact (InfoCube)" and so on, and the
   History sentences "SCD 0: …", as the prototype? S15-07 (15a) and S15-08b change.
8. **Texts and undo names:** as in the two tables above, the refusals included?
9. **The data model:** as above, with the migration `20261108130000_infocube_types.sql`, `is_factless` nullable as the
   PRD says?
10. **Runs:** one full run at the end of step 2 (local adapter, undo, module cascade) and one on the final commit of step
    3, as the PRD says; between them, the slice's specs and the touched specs as single-file checks?

### Plan for steps 2–3

**Step 2. Data and domain.** KB and the demo file backed up first (`.data/backups/`); small commits.
1. The migration; `types.ts` (`FACT_TYPES`, `DIM_KINDS`, `HISTORIES`); the local rules and `shapeFits`; the
   table-registry and schema checks.
2. The adapter's module row upgrade (`TableRules.upgrade`, run on load) with InfoCube's upgrade, tested on the old
   shapes (fact, dimensions 0/1/2, missing `scd_type`) and for idempotence; a store test that a write to `cube_entity`
   passes with older rows in the file.
3. `aggregates.ts` and `outriggers.ts` with unit tests (self, cycle at depth, a deleted base, 1:N, 1:1, M:N, loop).
4. `updateCubeEntity`'s new fields, refusals and labels; `createCubeEntity`'s defaults; the action's input.
5. `follows` for the base, with the cascade test (delete Fact Sales: Fact Orders' base cleared in the same group; undo,
   redo; a concept delete with both).
6. Undo's module revert check (`revertRefusal`) and InfoCube's rule, with undo tests for both cases of F6.
7. The four hints in `factHints`; `historyLabel`, `tabMeta`, `cubeTitle`, `entityDependents`, `busMatrix`, with tests.
8. CI (lint, typecheck, unit tests), the touched e2e specs that read rows (S15-07, S15-14, S15-08b), and **one full run**
   (shared infrastructure: the local adapter, undo, the module cascade).

**Step 3. Panels, canvas, seed and close.**
1. The fact section (Fact type, Factless, Aggregate of, Aggregated by, Measures' text, "· snapshot" on a key) and the
   dimension section (Kind, Outrigger of, Outriggers, History in a 2 × 2 `Seg`, Snapshot period, "reached through");
   readers and reviewers read only.
2. The chip and its title from `moduleView`; the cut chip in CSS; the panel's Role.
3. The Cube tab's text and the bus matrix's label.
4. The seed step `addStarTypes`; `addDerivationsDemoData` for slice 18's fixtures; slice 19's fixtures.
5. `e2e/slice-19/S19-01` … `S19-07`; the touched earlier specs; `slice-19` goes into the last part (from `slice-14a`),
   with its heap read in the summary; the element guard against `slice-08`'s counts; the commit counters idle and panned
   on the Sales star.
6. The docs: D-74 quoted for approval, `data-model-v2.md`, the InfoCube spec, `ideas.md` (the backlog's done items, and
   section 9 as later), `inventory-prototype-vs-app.md`, `known-limitations.md` (F2), README, CLAUDE.md (status and the
   two new extension points: `TableRules.upgrade` and `ModuleUndoTable.revertRefusal`).
7. **One full run** on the final commit, then the manual acceptance steps. Merge and the tag `slice-19` only on Łukasz's
   command.

## Łukasz's answers to step 1 (8 November 2026)

1. **Older rows:** yes. The local adapter converts InfoCube's older rows when it loads the file, before any read or
   check; the migration does the same in Postgres (F1).
2. **Undo:** yes. Undo refuses a cycle of aggregates and a base that is a deleted fact, through a revert check InfoCube
   supplies, as slice 18 does for calculations (F6).
3. **Outriggers:** yes. A many-to-many relationship between two dimensions gives no outrigger (F8).
4. **Relationship panel:** yes. It says nothing about outriggers (F9).
5. **The chip:** yes. A chip that does not fit is cut with "…", the concept text first, the full text in the tooltip
   (F11).
6. **The demo: differently.** Slice 18's fixtures stay as they are. Slice 19's demo is a function of its own,
   `addInfoCubeTypesDemoData`, called after `addDemoData` by seed, reset and `npm run demo`, and by slice 19's fixtures.
   This works with how `addDemoData` is used: `seedDevData` and `resetDevData` take one function, so the three scripts
   pass one that calls `addDemoData` and then `addInfoCubeTypesDemoData`; slice 18's fixtures and
   `tests/infocube-lookups.test.ts` keep calling `addDemoData` alone. No `addDerivationsDemoData` (F14 as changed).
7. **Changed texts:** yes. The card's and the panel's titles and the "SCD 0: …" sentences follow the prototype; S15-07
   and S15-08b change, with the reason recorded.
8. **Texts, refusals and undo names:** approved as listed.
9. **The data model:** as proposed, migration `20261108130000_infocube_types.sql`.
10. **Runs:** one full run at the end of step 2, one on the final commit, single-file checks in between.

Also taken: the two PRD corrections. The rights are AD-05's `model.edit` (F16), and S19-03's relationship is stored from
the dimension (D-67, F17).
