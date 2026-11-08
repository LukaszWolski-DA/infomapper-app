# Slice 19 – InfoCube types: facts, dimensions and their history

Status: **proposed** (Łukasz, 8 November 2026). **Full path**: it changes `cube_entity` and InfoCube's domain.
Branch `slice/19-infocube-types`, from `main` at tag `slice-18`. PRD file: `docs/prd/slice-19-infocube-types.md`;
step 1 writes `docs/prd/slice-19-acceptance.md`. Test regime: CLAUDE.md, "Testing".

Written from the docs at slice 18's closing, InfoCube's backlog in `docs/ideas.md` and the prototype changed for this
slice, which Łukasz accepted on 8 November 2026, **without reading the code**. **The prototype is the source of truth
for behaviour; where this PRD and the prototype differ, ask.**

## 1. Why

InfoCube iteration 1 (slice 15) knows a fact's grain and a dimension's SCD type, nothing more. A modeller cannot say
what kind of fact it is, that a fact is deliberately without measures, that one fact summarises another, that a
dimension is a junk dimension, or that a dimension is kept as snapshots (Data Vault's PIT-based information marts).
The backlog (ideas.md, 1 and 5 November 2026) names all of these.

Decisions taken with Łukasz (8 November 2026):
- **1a** Fact type Transaction / Periodic snapshot / Accumulating snapshot; every fact, existing or new, starts as
  Transaction.
- **2a** "Factless fact" is an explicit flag, not derived from having no measures.
- **3a** An aggregate fact points to its base fact ("Aggregate of").
- **4a** A dimension's kind Standard / Junk is stored; **an outrigger is derived** from a relationship between two
  dimensions, never stored.
- **5b** A dimension's unknown member comes later, with the model validator.
- **Snapshot, A**: a dimension's history gains a fourth value, Snapshot, with a snapshot period; `scd_type` becomes one
  text column for the four values.
- Out of scope: bridge dimensions and hierarchies (slices of their own).

## 2. What to build

1. **Fact type** in a fact's panel, section Fact: a segmented choice Transaction / Periodic / Accumulating with the full
   name and a sentence below it. Shown in the card's role chip (Transaction adds nothing: "Fact"; others "Fact ·
   Snapshot", "Fact · Accumulating"), in the Cube tab's row hint and in the chip's title (full text).
2. **Factless fact**: a toggle with a sentence. A factless fact without measures shows "None: a factless fact. Count its
   rows." in Measures; the chip adds "Factless".
3. **Aggregate of**: a select of the other facts ("Not an aggregate" first), never offering a fact that is, at any
   depth, an aggregate of this one (no cycles). With a base, a sentence names it with a link; the base fact's panel lists
   "Aggregated by". The chip adds "Aggregate". Deleting the base fact clears the aggregates' base in the same change
   group; the delete preview says "{fact} loses its base fact" / "{facts} lose their base fact".
4. **Dimension kind**: Standard / Junk with a sentence; the chip adds "Junk".
5. **Outriggers, derived**: in a relationship between two dimensions, the "one" end is an outrigger of the other
   (with 1:1, the relationship's `from` end). The outrigger's panel lists "Outrigger of" with a sentence; the other
   lists "Outriggers"; the chip adds "Outrigger"; "Used by" on an outrigger without facts says it is reached through
   its dimension. Deleting the relationship removes it all; nothing is stored.
6. **History** (the former "Slowly changing dimension type"): 0 · keep, 1 · overwrite, 2 · history, Snapshot, in a
   two-by-two grid, with a sentence per value. **Snapshot** shows a "Snapshot period" field (plain text, e.g.
   "Month-end"), kept when another value is chosen and back again. Every place that shows "SCD n" shows the snapshot as
   "Snapshot · {period}": the Cube tab, the bus matrix, the delete preview, the chip ("Dimension · Snapshot"). A fact's
   Dimensions list adds "· snapshot" to a snapshot dimension's key, its title "{dimension} is a snapshot dimension: the
   fact joins it by the snapshot date".
7. **Hints** (D-68's fact hints, read only):
   - a factless fact with measures: "It is marked factless but has measures: {names}. Turn off one or the other.";
   - a periodic snapshot's additive measure: "{name} is additive. In a periodic snapshot, balances and levels are
     usually semi-additive across the date.";
   - an accumulating snapshot whose dimensions each play at most one role: "An accumulating snapshot usually carries
     several dates of its process: a date dimension in several roles.";
   - an aggregate related to a dimension its base is not: "{dimension} is not a dimension of {base}, its base. An
     aggregate has the base's dimensions or fewer."
8. **Demo seed**, its own step as in slice 18 (seed, reset, `npm run demo`, slice 19's fixtures; not slice 15's or
   18's): Fact Orders an aggregate of Fact Sales; a new Dim Category (category_key, category_code, category_name) with a
   relationship "groups" to Dim Product, so an outrigger; a new junk Dim Order Flags (order_flags_key, payment_type,
   channel, is_gift); Dim Product a snapshot, "Month-end". Only the demo; never Łukasz's KB.

Every change is one undo step and needs the rights to edit the model (C-7); readers and reviewers see the values
without controls.

## 3. Data model (proposal; step 1 confirms against the code)

`cube_entity` (migration name in step 1):

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `fact_type` | text | yes | `transaction`, `periodic`, `accumulating`; a fact's, null for a dimension; existing facts get `transaction` |
| `is_factless` | boolean | yes | a fact's (default false), null for a dimension |
| `base_fact_entity_id` | uuid | yes | FK `entity`, a fact's base when it is an aggregate; not itself, no cycle (domain) |
| `dim_kind` | text | yes | `standard`, `junk`; a dimension's (existing get `standard`), null for a fact |
| `history` | text | yes | replaces `scd_type`: `keep`, `overwrite`, `history`, `snapshot`; a dimension's, null for a fact; 0/1/2 converted |
| `snapshot_period` | text | yes | plain text; kept whatever the history |

CHECK `cube_entity_shape_ck` extended: a fact has a fact type and no dimension fields; a dimension has a kind and a
history and no fact fields. The local data file: InfoCube's tables are not part of the format (slice 15, C1), so step 1
says how an older file's `scd_type` is read (Q2). The cascade: a fact's delete clears `base_fact_entity_id` on its
aggregates (slice 18's `follows`, Q3).

## 4. Sources

- **Prototype:** `docs/prototype/infomapper-prototype-with-sources.html`, replaced in this slice by the version Łukasz
  accepted (687,691 bytes, SHA-256 `ee2f17b1f0b7a304ff417aa7b3cbf9212adb817d135a1d8f1b81d9415c2c255f`), copied in
  step 1 with `cmp` and SHA-256. Its new code: `FTYPE_L`, `FTYPE_S`, `FTYPE_D`, `DKIND_D`, `cubeTitle`, `scdLabel`,
  `aggregatesOf`, `baseChain`; `cubeIndex`'s defaults and `outOf`/`outs`; `cubeEntitySection` (fact and dimension);
  `factHints`' four new hints; the handlers `cube.ftype`, `cube.factless`, `cube.base`, `cube.dkind`, `cube.scd`,
  `cube.snap`; `cubeDependents`; the Cube tab's hint, the bus matrix's label, the card's chip; `cubeDemoV5`,
  `cubeDemoV6`; the CSS `.seg.g2`. The prototype stores the history in `scd` (0, 1, 2 or "snapshot"); the app uses the
  text column of section 3.
- **Decisions:** C-5, C-7, D-66, D-67, D-68, D-69, D-70, D-73, AD-18, AD-23, AD-24, RP-B.
- **`docs/data-model-v2.md`**, section `cube_entity`; `docs/infocube/iteration-1-spec.md` (or wherever step 1 finds
  InfoCube's spec).

## 5. Steps

Stop after each step; wait for Łukasz. A new session starts only at a step's boundary, reading CLAUDE.md, this PRD and
the acceptance doc.

1. **Reconnaissance and check.** Read the code of the areas this slice touches; answer Q1–Q8 in
   `slice-19-acceptance.md`; every place where the PRD is wrong or differs from the code, a decision or the prototype,
   with a proposal each; the data model as you would build it; every new UI text and undo name; the earlier specs each
   item touches; a plan for steps 2–3. Copy the prototype and the PRD. No application code, no runs.
2. **Data and domain.** The migration and the conversion of `scd_type`, the table rules and defaults, reading older
   files, the commands (fact type, factless, base, kind, history, snapshot period), the checks (no self or cyclic base;
   the shape), the cascade on a fact's delete, outriggers derived in the domain, the hints' rules, unit tests. Shared
   infrastructure: **one full run** at the end of this step.
3. **Panels, canvas, seed and close.** Items 1–8 in the UI; the slice's specs and the touched ones; the element guard;
   the docs and D-74's text quoted for approval; then **one full run** on the final commit (the run before the merge).
   Stop with the manual acceptance steps. Merge and tag `slice-19` only on Łukasz's command.

## 6. Acceptance criteria

Tests in `e2e/slice-19/`, one file per criterion, fresh seed each.

| ID | Criterion |
| --- | --- |
| S19-01 | **Data.** The migration converts `scd_type` 0/1/2 to keep/overwrite/history and gives facts `transaction`, dimensions `standard`; an older local file reads with the same values; every new field survives a save, a reload, undo and redo. |
| S19-02 | **Fact type and factless.** Fact Sales: Periodic shows the chip "Fact · Snapshot", the Cube tab's hint and the additive-measure hints; Accumulating with Dim Date in two roles shows no "several dates" hint, Fact Orders does; Factless with measures shows its hint, without measures the Measures text. One undo each. |
| S19-03 | **Aggregate.** Fact Orders (demo) shows "Aggregate of Fact Sales", Fact Sales "Aggregated by Fact Orders"; Fact Sales' select does not offer Fact Orders; a relationship from Fact Orders to Dim Order Flags gives the base hint; deleting Fact Sales: the preview names Fact Orders, after it Fact Orders has no base; one undo restores both. |
| S19-04 | **Kind and outrigger.** Dim Order Flags is Junk (chip, panel); Dim Category is an outrigger of Dim Product (chip, both panels, "Used by" text); deleting the relationship "groups" removes the outrigger everywhere; undo brings it back. |
| S19-05 | **Snapshot.** Dim Product (demo): History Snapshot, period "Month-end"; the Cube tab and the bus matrix show "Snapshot · Month-end"; Fact Sales' Dimensions list marks it; switching to 2 · history hides the period and back shows it again; the delete preview names its history. |
| S19-06 | **Rights.** A reader and a reviewer see every value and no control; the domain refuses a base that is the fact itself or closes a cycle. |
| S19-07 | CI, the element guard (no change on "Performance test"), commit counts while idle and panned unchanged, the two full runs; every earlier test changed, with its reason. |

**Manual acceptance (demo and KB):** the demo's examples; in the KB, the fact types of DimBuilding's facts, a junk or
snapshot dimension if the model has one.

## 7. Questions for step 1

- **Q1.** The history column: `history` text replacing `scd_type` (decision A), its CHECK, the conversion, and every
  reader of `scd_type` (domain, UI, bus matrix, documents, tests).
- **Q2.** Reading an older local file and an older module row: where InfoCube's defaults live (slice 18's
  `TableRules.defaults`), and whether anything else needs a format number.
- **Q3.** A fact's delete with aggregates: clearing `base_fact_entity_id` through slice 18's `follows`, the preview, undo;
  and a fact turned into a dimension, if the app allows a role change.
- **Q4.** Outriggers: where the rule lives (domain), the cardinality fields it reads, roles and self relationships, and
  whether InfoMapper's relationship panel should say anything.
- **Q5.** The four hints in D-68's code; their texts; whether any counts in the Cube tab or the bus matrix change.
- **Q6.** The commands and undo names; the shape CHECK when a value is set for the wrong role.
- **Q7.** Where the card's chip text is built and its width on narrow cards (long chips such as "Fact · Accumulating ·
  Factless · Aggregate"); recommend truncation or wrapping.
- **Q8.** The demo seed step and the earlier fixtures that read Dim Product's SCD type or Fact Orders.

## 8. D-74 (proposal) and docs

"**InfoCube types (slice 19).** A fact has a type (transaction, periodic snapshot, accumulating snapshot; transaction by
default), may be marked factless, and may be an aggregate of another fact (never of itself or in a cycle; deleting the
base clears it). A dimension has a kind (standard or junk) and a history: SCD 0 keep, 1 overwrite, 2 history, or a
snapshot with a period, the whole dimension kept per snapshot date; one text column replaces the SCD type. An outrigger
is derived, not stored: the "one" end of a relationship between two dimensions. Hints flag a factless fact with
measures, additive measures in a periodic snapshot, an accumulating snapshot with a single date, and an aggregate with a
dimension its base lacks."

Docs: `decisions.md` (D-74), `data-model-v2.md` (`cube_entity`), InfoCube's spec, `ideas.md` (the backlog's done
items; section 9 as later), `inventory-prototype-vs-app.md`, README and CLAUDE.md status.

## 9. Left for later

- Bridge dimensions (many-to-many with a weighting factor) and hierarchies in dimensions: slices of their own.
- A dimension's unknown member (decision 5b), with the model validator.
- Mini-dimensions and other SCD types (4–7).
- Checking an aggregate's grain or measures against its base beyond the dimension hint.
