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

## Step 2: data and domain (8 November 2026)

KB (`.data/dev-db.json`) and the demo file were backed up first (`.data/backups/dev-db-20261108-1559.json`,
`kb-model-latest.json`, `demo-db-20261108-1559.json`).

### What changed

- **The migration** `20261108130000_infocube_types.sql`, as approved: the six columns, the conversion of `scd_type`, the
  checks and `cube_entity_base_ix`.
- **The local adapter's module row upgrade (F1):** `TableRules.upgrade` and `upgradeRows` (`src/data/local/schema.ts`).
  The store runs it on the loaded file before any read, check or write (`store.ts`: `load` and `applyToFile`), once per
  cached read. The file holds the new shape after its next write. InfoCube's `upgradeCubeEntity`
  (`src/modules/infocube/data/tables.ts`): a fact `transaction`, not factless, no base; a dimension `standard`, 0/1/2 →
  keep/overwrite/history; `scd_type` dropped; null for a current row. The local rules mirror the new checks.
- **Types** (`types.ts`): `FACT_TYPES`, `DIM_KINDS`, `HISTORIES` (replacing `SCD_TYPES`), `SCD_NUMBER`, `typeColumns`.
- **Rules:**
  - `aggregates.ts`: `aggregateIndex` (`baseOf` reads a base that is not a live fact as none), `reaches`, `baseChoices`
    and the texts.
  - `outriggers.ts`: 1:N gives the "1" end, 1:1 the `from` end, M:N none; loops and deleted relationships are skipped.
  - `CubeIndex` gains `aggregates()`, `outriggers()` and `dimensionsOf()`.
- **The command:** `updateCubeEntity` takes `factType`, `isFactless`, `baseFactEntityId`, `dimKind`, `history` and
  `snapshotPeriod` (no more `scdType`), with the approved refusals and undo names. The action reads every `cube_entity`
  row and the entities for the base's checks. `createCubeEntity` writes the defaults.
- **The cascade (F7):** `cube_entity.follows = [["base_fact_entity_id", "entity", aggregateLosesBase]]`. The comments in
  `module-cascade.ts` and `ModuleUndoTable.follows` now say a rule may change any column.
- **Undo (F6):** a new extension point, `ModuleUndoTable.revertRefusal` (`ModuleRevertRefusal`, `UndoTables.revertRefusals`),
  called after InfoMapper's own checks for each table a revert touches. InfoCube's `aggregateRevertRefusal` refuses a
  fact that would be an aggregate of itself (at any depth), or of a deleted fact.
- **The hints:** the four new hints in `factHints` (`TYPE_HINTS`), after the existing ones.
- **The texts** (`view.ts`): `historyLabel`, `tabMeta` with the context, `cubeTitle`, `roleTitle` and `typeContext`. They
  are used by `moduleView` (the chip's text and title), the Cube tab (`cubeSections` takes the relationships), the bus
  matrix (`dimensions[].history` replaces `scd`) and `entityDependents` (a snapshot's history; "loses its base fact" /
  "lose their base fact").

### Differences from step 1's plan

- **The chip's text and title are wired in this step** (in `moduleView`), not in step 3. They are pure composition and
  needed no UI code. As a result the title of a plain fact or dimension already reads "Transaction fact (InfoCube)" /
  "Dimension (InfoCube)" (P2, answer 7).
- **The dimension panel is unchanged on screen.** Its three segments now save `history` (keep, overwrite, history), with
  the same labels and sentences, and a snapshot row shows as "1 · overwrite" until step 3 builds the panel. No UI exists
  yet to set the other new fields.
- **The upgrade's unit test is in `tests/infocube-types.test.ts`**, not next to the domain. A module's domain part may
  not import its data part (lint).

### Checks

- `npm run lint`, `npm run typecheck`: clean.
- `npm test`: 155 files and 1,895 tests passed. New: `src/modules/infocube/domain/types.test.ts` (20) and
  `tests/infocube-types.test.ts` (7: the upgrade, the store reading older rows and writing over them, `loadForUndo`, the
  base's delete with one undo, an aggregate deleted in the same write, both undo refusals, an undo that passes).
- **KB, on a copy of the backup in the scratchpad:** its 9 `cube_entity` rows (3 facts; dimensions 2 × SCD 1, 4 ×
  SCD 2) read as transaction, overwrite and history; none keeps `scd_type`; the shape check passes. KB itself was not
  touched.
- **Touched earlier specs, locally** (`npm run e2e`, 12 tests, 2.7 min, all passed): S15-01, S15-06, S15-07 (15a),
  S15-14 (15a), S15-07 (15b), S15-08, S15-08b, S15-14 (15c), S15-16.

### Earlier tests changed, and why

| Test | Change | Why |
| --- | --- | --- |
| e2e `slice-15a/S15-07` | the title "Transaction fact (InfoCube)"; the row read with the new columns | P2, answer 7; `scd_type` is gone |
| e2e `slice-15a/S15-14`, `slice-15b/S15-08b` | `history: "keep"` … in place of `scd_type` 0/1/2 | the column (Q1) |
| `commands.test.ts`, `description-and-keys.test.ts` | the new defaults and the history input; `HISTORY_ON_FACT` | F3, F4 |
| `tests/infocube-star.test.ts`, `src/canvas/canvas.test.ts` | the title text; `history` in the star's rows | P2 |
| `tests/infocube-requirements.test.ts` | the bus matrix's `history` label ("SCD 2"); rows with `typeColumns` | F13 |
| `tests/infocube-mapping-commands.test.ts`, `tests/table-registry.test.ts` | the dimension's new columns | F4 |
| `__fixtures__/star.ts`, `scripts/lib/star-canvas.ts`, `sales-star.ts` | rows written with `typeColumns` | the column |

### The full run (shared infrastructure: the local adapter, undo, the module cascade)

[Run 42494465470](https://github.com/LukaszWolski-DA/infomapper-app/actions/runs/42494465470) on `046ce78`. Wall-clock
13 min 16 s (15:22:15–15:35:31 UTC). **665 passed, 1 failed, 4 skipped, 0 expected failures.**

| Part | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| time | 11:35 | 7:35 | 11:17 | 9:06 | 6:38 | 6:37 | 11:38 |
| heap peak (MB) | 1,073 | 1,349 | 923 | 844 | 1,421 | 1,165 | 1,203 |

No server restarted. **The one failure** was `slice-17/S17-01` ("New fact here" … ask for the concept): the concept
picker's filter was not focused within 15 s. The single-file check
([run 42495693752](https://github.com/LukaszWolski-DA/infomapper-app/actions/runs/42495693752), 3 rounds side by side)
passed all three, so it is a flake. Slice 19 does not touch the picker or its focus (`src/ui/pick-popover.tsx`).

## Łukasz's answers to step 2 (8 November 2026)

Step 2 accepted. No rerun of the full run; step 3's full run on the final commit counts. Find why S17-01 failed (the second
time) and fix it in the test or in the app, reporting the cause either way.

## Step 3: panels, canvas, seed and close (8 November 2026)

### S17-01: the cause

**It was a race in the test, not in the app.** The trace of run 42494465470 shows the order of events:
1. 537,355 ms: the Cube tab's "New dimension" create is sent. It took 165 ms, so its answer arrived at about
   537,520 ms.
2. 537,480 ms: the test clicked "New fact". The test had polled the data file, and the file is written before the
   answer reaches the page.
3. The picker opened, and its filter got the focus.
4. The create's answer then did what it does by design (`createIn`, `left-panel.tsx`: `setNameFocus`): the new
   dimension's name field took the focus, away from the picker's filter.

The toolbox part of the same test had the same race. It also right-clicked the same spot before the new fact's card was
drawn there.

**The fix, in the test only:**
- After each create, the test waits for the new name field's focus. That is the observable result of the answer.
- The toolbox part then takes a fresh empty spot, since the new card now lies at the old one.
- The assertions are unchanged. The test passed 3 of 3 locally and in the final run. CLAUDE.md now names the pattern.

The app's picker focuses its filter in an effect once it is shown, with no timer, so there is nothing to fix there.

### What changed

- **The fact's section** (`sections.tsx`, approved texts):
  - Fact type (Transaction, Periodic, Accumulating, with the full name and its sentence);
  - Factless fact (a flag with its sentence);
  - Aggregate of: a select of `baseChoices`, "Not an aggregate" first; a base no longer offered still shows as chosen;
    with a base, the sentence and a link to it;
  - Aggregated by, with each aggregate's grain;
  - Measures' factless text, and "· snapshot" after a snapshot dimension's key, with its title.
- **The dimension's section:**
  - Kind (Standard, Junk), with its sentence;
  - Outrigger of, with its sentence, and Outriggers;
  - History: the four values in two rows (`Seg`'s new `columns={2}`), each with its sentence and the technical sentence;
  - Snapshot period: a `TextField` with `keep`, shown only for Snapshot, focused when Snapshot is chosen and it is empty;
  - "Used by" for an outrigger: "No fact uses it directly; it is reached through …".
- **Rights:** every control is disabled or read only for readers and reviewers (AD-05).
- **The chip's cut** (`infocube.css`): under `clip-l1` the role is a block with an ellipsis, and the concept text after it
  shrinks first.
  - Checking the demo in the browser found a bug in my first version. The chip's flex shrink factor was 0.0001, and
    flexbox hands out only that fraction of the overflow once the concept text is at 0. The chip did not shrink, and it
    pushed the header's tools out of the card.
  - Now the chip shrinks with factor 1 and the concept text with 10,000. On the demo at 75 %, "Fact · Accumulating ·
    Factless · Aggregate" shows 134 of its 227 px with "…", the concept text is at 0, the line fits, and the short chips
    stay whole.
  - S19-07 checks this.
- **The demo** (answer 6):
  - `addStarTypes` (`sales-star.ts`) and `addInfoCubeTypesDemoData` (`compose/seed.ts`).
  - `addFullDemoData` (`addDemoData`, then the types) is used by `npm run seed`, `npm run reset-dev-data`,
    `npm run demo` and slice 19's fixtures.
  - Slice 18's fixtures and `tests/infocube-lookups.test.ts` keep `addDemoData`.
  - The demo makes Dim Category (Product; category_key, category_code, category_name) at (780, 860), with "groups"
    1..1 → Dim Product 0..n. Dim Order Flags (Sales, junk; order_flags_key, payment_type, channel, is_gift) goes at
    (1500, 40). Fact Orders' base becomes Fact Sales, and Dim Product a snapshot, "Month-end".
  - The full demo file passes every table rule (`findViolation`, no violation).
- **The docs:**
  - D-74 in `decisions.md` (below, for approval);
  - `data-model-v2.md` § `cube_entity`;
  - the InfoCube spec ("Types (slice 19, D-74)");
  - `ideas.md` (the backlog's done items, and section 9 as later);
  - `inventory-prototype-vs-app.md` (slice 19's deliberate differences);
  - `known-limitations.md` (what is left for later, an older undo step, the chip after the fresh page);
  - README (status, the acceptance link);
  - CLAUDE.md: the status paragraph, the two new extension points (`TableRules.upgrade`,
    `ModuleUndoTable.revertRefusal`; `follows` may clear its column), the InfoCube types' rules, and slice 19's
    fixtures and helpers.

### New specs (`e2e/slice-19/`)

| Spec | What it checks |
| --- | --- |
| S19-01 (2 tests) | The file's rows written back in slice 18's shape read as before (Cube tab, chips); a write stores the new shape. Fact type, factless, base, kind, history and period each survive a save, a reload, undo and redo. |
| S19-02 (2) | Periodic: "Fact · Snapshot", its title, the Cube tab's "Snapshot · grain set", the two additive hints (quantity, net_amount), undo. Accumulating: no hint on Fact Sales (Dim Date in two roles), a hint on Fact Orders, undo. Factless with measures: its hint, undo. Without measures (test data): the Measures text, undo. |
| S19-03 | Fact Orders' chip, title, base and sentence; the base hint after Dim Order Flags → Fact Orders (test data, from the dimension); the link to Fact Sales; Aggregated by; the select offers only "Not an aggregate"; the preview row; the base cleared after the delete; one undo brings both back. |
| S19-04 | Dim Order Flags: chip, title, Junk and its sentence. Dim Category: chip, title, Outrigger of, the sentence, Used by. Dim Product: Outriggers. Deleting "groups" removes them everywhere; undo brings them back. |
| S19-05 | Dim Product: Snapshot and its sentence, "Month-end"; the Cube tab and the bus matrix "Snapshot · Month-end"; the "· snapshot" mark and its title in Fact Sales' Dimensions (once); 2 · history hides the period and keeps it, Snapshot shows it again; the delete preview's history row. |
| S19-06 (3) | Kasia (reader) and Piotr (reviewer) see every value, and every control is disabled or read only; the domain refuses a base that is the fact itself or closes a cycle. |
| S19-07 | With Fact Orders an accumulating, factless aggregate: no canvas or miniature commit while idle or after a pan; the long chip cut, the concept text at 0, the line fitting, the full title; every chip one span with no child element. |

### Checks

- `npm run lint`, `npm run typecheck`: clean. `npm test`: 155 files and 1,896 tests passed.
- Locally: slice 19's 15 tests; S15-07 (15b), S15-08 and S15-08b; S17-01 (3 tests).
- **The element guard** (`S3B-15-elements.spec.ts` against `slice-08.json`, measurement build): passed. The viewport counts
  equal the baseline. The page totals are 6,001 / 20,798 / 2,868 / 6,310: slice 11's +6, unchanged. "Performance test"
  has no InfoCube data.
- **Commit counts** on the Sales star with every type: idle and panned unchanged (S19-07). Slice 18's guards are
  unchanged on their canvases (the full run).
- **The demo in the browser** (`infomapper-demo-15b`, its own file `.data/preview-15b.json`, never KB): the chips, the
  panels and the cut as above, no console errors.

### The full run on the final commit

[Run 42498455899](https://github.com/LukaszWolski-DA/infomapper-app/actions/runs/42498455899) on `5667761`. Wall-clock
16 min 16 s (16:09:41–16:25:57 UTC). **677 passed, 0 failed, 4 skipped, 0 expected failures, 0 flaky.**

| Part | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| time | 7:52 | 9:32 | 8:13 | 6:57 | 8:15 | 6:38 | 14:36 |
| heap peak (MB) | 1,264 | 986 | 1,299 | 1,269 | 1,162 | 1,037 | 1,164 |

No server restarted. Part 7 (from `slice-14a`, now with `slice-19`) is the longest at 14:36, up from 11:38 in step 2's run.
Its heap is far from 2 GB, so the cuts stay.

### Earlier tests changed in step 3, and why

| Test | Change | Why |
| --- | --- | --- |
| e2e `slice-17/S17-01` | waits for the new name's focus after each create; a fresh empty spot for the toolbox | the race above; assertions unchanged |
| e2e `slice-15b/S15-08b` | the History's sentences "SCD n: …" and the technical sentence with "snapshot date" | answer 7 |

### Assumptions

- **The undo names of the grain and the slice-15 fields stay InfoMapper's default** ("Change fact or dimension"), as
  approved.
- **"Aggregate of" offers the facts in the model's order of entities** (P4), and a base no longer offered still shows as
  chosen.
- **The snapshot period's field is focused only when Snapshot is chosen and the period is empty**, as in the prototype.
- **The demo's Dim Order Flags has no relationship to a fact**, as in the prototype, so the bus matrix shows it "unused".

### D-74 (as in `docs/decisions.md`, for approval)

> **D-74** InfoCube types (slice 19). A fact has a type: Transaction (every fact, existing or new, starts as one),
> Periodic snapshot or Accumulating snapshot, each with its sentence. It may be marked factless, deliberately without
> measures ("None: a factless fact. Count its rows."). It may be an aggregate of another fact ("Aggregate of"; the base
> lists it under "Aggregated by"): never of itself or in a cycle at any depth, which the select never offers, the domain
> refuses and undo refuses; deleting the base clears its aggregates' base in the same undo step, and the delete preview
> names them. A dimension has a kind, Standard or Junk, and a history that replaces the SCD type: 0 · keep, 1 ·
> overwrite, 2 · history, or Snapshot, the whole dimension kept per snapshot date (in Data Vault usually from a PIT
> table), with a snapshot period kept whatever the history; every place that showed "SCD n" shows a snapshot as
> "Snapshot · {period}", and a fact's Dimensions mark a snapshot dimension's key. An outrigger is derived, never stored:
> in a relationship between two dimensions, the "one" end (with 1:1 the relationship's from end; many-to-many none) is
> an outrigger of the other ("Outrigger of", "Outriggers", and "Used by" says it is reached through its dimension); the
> relationship panel says nothing about it. The card's and the panel's role name the type: "Fact · Snapshot", "Fact ·
> Accumulating", "Factless", "Aggregate", "Dimension · Junk", "Snapshot", "Outrigger"; the title is the long text
> ("Transaction fact (InfoCube)"); a chip that does not fit is cut with "…", the concept text first. The Cube tab's items
> and the bus matrix follow. Four hints are added: a factless fact with measures, an additive measure in a periodic
> snapshot, an accumulating snapshot with no dimension in two roles, an aggregate related to a dimension its base is
> not. Every change is one undo step for those who may edit the model (AD-05); readers and reviewers see the values
> without controls. Accepted by Łukasz, 8 November 2026 (step 1).

### Manual acceptance steps

**The demo** (`npm run demo -- --reset`, then http://127.0.0.1:3001 as Łukasz; never KB). Open Order management →
"Sales star".
1. **Fact Orders** shows "Fact · Aggregate"; its title reads "Transaction fact, aggregate of Fact Sales (InfoCube)".
   - Its panel shows Fact type Transaction and Aggregate of Fact Sales, with the sentence and its link.
   - Fact Sales' panel lists Fact Orders under "Aggregated by", and its select offers only "Not an aggregate".
2. **Fact Sales: Periodic.**
   - The chip reads "Fact · Snapshot", and the Cube tab "Snapshot · grain set".
   - Hints appear for quantity and net_amount.
   - Undo, then Accumulating: no "several dates" hint (Dim Date plays two roles). On Fact Orders, Accumulating gives the
     hint.
3. **Fact Orders: Factless fact.** The hint names total_amount and line_count; the chip reads "Fact · Factless · Aggregate"
   (with Accumulating, cut with "…" on its default width).
4. **Dim Order Flags:** "Dimension · Junk", with Kind Junk and its sentence.
5. **Dim Category:** "Dimension · Outrigger".
   - Its panel shows Outrigger of Dim Product and "No fact uses it directly; it is reached through Dim Product.".
   - Dim Product's panel shows Outriggers: Dim Category.
   - Delete the line "groups": the outrigger disappears everywhere. Undo brings it back.
6. **Dim Product:** History Snapshot, period "Month-end".
   - The Cube tab and the bus matrix show "Snapshot · Month-end".
   - Fact Sales' Dimensions show "key product_key · snapshot", with its title.
   - Choose 2 · history: the period hides. Choose Snapshot: "Month-end" is back.
7. **Delete Fact Sales from the model.** The preview names "Fact Orders – loses its base fact". After the delete, Fact
   Orders' chip is "Fact". One undo brings back both.
8. **As Kasia (reader) or Piotr (reviewer):** the same values show, and nothing can be changed.

**KB** (`npm run dev`, your `.data/dev-db.json`; backed up before step 2 as `kb-model-latest.json`):
1. KB's 9 InfoCube rows convert when the file is loaded:
   - the 3 facts become Transaction;
   - the dimensions keep SCD 1 (2) and SCD 2 (4), now as overwrite and history.
   - The Cube tab and the bus matrix show the same "SCD n" as before.
2. Set the fact types of DimBuilding's facts, and a junk or snapshot dimension if the model has one. Check the chips on
   their usual widths.
3. The file holds the new shape after its first InfoCube save. Its backup holds the old one.

## Łukasz's answer to step 3 (8 November 2026)

D-74 approved as written in `docs/decisions.md`. The manual acceptance follows.
