# Slice 18 – Derivations: calculated attributes and lookups

Status: **proposed** (Łukasz, 8 November 2026). **Full path**: it changes the data model, the domain's commands and
the coverage rule. Branch `slice/18-derivations`, from `main` at tag `slice-17`. PRD file:
`docs/prd/slice-18-derivations.md`; step 1 writes `docs/prd/slice-18-acceptance.md`. Test regime: CLAUDE.md,
"Testing".

Written from the docs at slice 17's closing, Łukasz's testing of 7 November 2026 (items 3 and 6) and the prototype
changed for this slice, which Łukasz accepted on 8 November 2026, **without reading the code**. **The prototype is the
source of truth for behaviour; where this PRD and the prototype differ, ask.**

## 1. Why

Two business rules have no place in the model today, so modellers write them as free text or work around them:

- **A value computed from other attributes of the same entity**, e.g. `net_amount = quantity * unit_price *
  (1 - discount_pct)` or `OfferValueInCurrency = OfferValue * CurrencyRate`. Without it the attribute counts as
  unmapped, and its lineage and the impact of a change to its inputs are invisible.
- **A descriptive value taken from a dictionary through a code**, e.g. DimBuilding's `AssetCategory` from
  `AssetCategory.AssetCategoryName`, looked up by `Building.AssetCategoryCode`, "Unbekannt" when there is no match.
  Today it is a transformation rule in words; in Łukasz's KB the codes were added to Building a second time.

Decisions taken with Łukasz (8 November 2026): **1a** a calculated attribute is covered when all its inputs are
covered (changes D-31); **2a** a calculation and its own mapping or feed may coexist, with a warning in the panel;
**3a** the "no match" value belongs to the lookup mapping (a dimension's unknown member comes later, with InfoCube's
types); **4a** lookups only in dimensional mappings.

## 2. What to build

1. **Calculated attributes, both levels.** An attribute's panel gets a section "Calculated from".
   - Not calculated: a sentence and "Calculate from attributes…", which opens the slice 17 picker (several at once)
     listing the other attributes of the same entity; choosing makes the attribute calculated from them and focuses
     the rule field.
   - Calculated: its inputs in order, each with its state (mapped / fed / calculated / not mapped / not fed), a link to
     it and × to remove it; "Add inputs…"; the rule (plain text, monospace); a coverage note ("Covered: every input
     is mapped." or "Not covered yet: x, y are not mapped."); a warning when it is also mapped or fed directly
     (decision 2a); "Stop calculating". "Used by …" lists the attributes calculated from this one.
   - The picker never offers the attribute itself, an input it already has, or an attribute calculated from it at any
     depth (no cycles).
   - On the canvas the row shows a mark "=" (its title is the rule), and the status dot of a row covered only through
     its calculation is a small square, filled when every input is covered, hollow otherwise.
   - Readers and reviewers see the section without its controls.
2. **Coverage through calculations (changes D-31).** An attribute counts as mapped (logical) or fed (dimensional) when
   it is, or when it is calculated and every input counts, recursively, cycles excluded. This holds for every count:
   the card's progress, the overview, the status bar, frames, project home, requirement coverage (a calculated
   attribute is covered when every input is covered) and requirement scope (a calculation's inputs and their mappings
   join the scope of a requirement linked to it). Step 1 lists every count (Q3).
3. **Dependents.** Focus on an attribute lights its inputs and the attributes calculated from it. Deleting an attribute
   that is an input shows it in the delete preview ("The calculation of x loses this input") and removes it from the
   calculation in the same change group; deleting a calculated attribute removes its inputs' rows. One undo step.
4. **Lookups in dimensional mappings.** "How the value is carried" gets a third choice, **Lookup**, next to Direct copy
   and Transformation.
   - A lookup reads exactly one logical attribute: the dictionary's value (a direct copy's rule, AD-26). Choosing
     Lookup with several inputs is refused with a toast; adding a second input to a lookup makes it a transformation,
     as for a direct copy.
   - **Through relationship:** a logical relationship of the input's entity with another entity, listed as
     "Building → AssetCategory (classifies)". When exactly one exists, choosing Lookup selects it. Without any, a
     warning says to draw one first.
   - **When no match:** plain text, optional ("Unknown", "Unbekannt").
   - A sentence explains it: "Each Building row finds its AssetCategory by AssetCategoryCode and takes
     AssetCategoryName; when the code is empty or has no match, the value is “Unbekannt”."
   - The line's chip is "L"; its title names the relationship; panels list it as "lookup ·".
   - Changing the kind, the relationship or the no-match value sends an approved mapping back to review (D-51's first
     rule); a note alone does not.
   - Deleting the relationship clears the lookup's relationship in the same change group, sends an approved lookup
     back to review, and the panel says "The relationship it went through is gone. Choose another."; the delete
     preview lists the lookups going through it.
5. **Demo seed.** As the prototype's `cubeDemoV4`: Dim Customer's `country_name` a lookup from Country through
   Customer Address → Country ("Unknown", draft); Fact Sales' `net_amount` calculated from quantity, unit_price and
   discount_pct. Only the demo; never Łukasz's KB.

## 3. Data model (proposal; step 1 confirms against the code)

- **`attribute`**: `calc_rule` text, null, and whether it is calculated: either implied (a live row in
  `attribute_input` or a non-null `calc_rule`) or an explicit `is_calculated` boolean. Step 1 recommends one (Q1).
- **`attribute_input`** (new): `attribute_id` FK `attribute` (the calculated one), `input_attribute_id` FK
  `attribute`, `sort_order`; standard columns; one live row per pair (unique index); the domain checks the same entity
  and no cycle. In the undo history (parent `attribute`).
- **`cube_mapping`**: `kind` CHECK adds `lookup`; `lookup_relationship_id` uuid, null, FK `relationship`;
  `lookup_default` text, null; a CHECK that a lookup has exactly one input is the domain's (as for direct, AD-26).
- **Local data file:** step 1 says whether this needs a new format version (today 13) or follows slice 15's rule C1
  (the rows appear with their first use) (Q2).
- **Cascades** (AD-23): an attribute's delete soft-deletes its `attribute_input` rows on both sides; a relationship's
  delete clears `lookup_relationship_id` on its lookups.

## 4. Sources

- **Prototype:** `docs/prototype/infomapper-prototype-with-sources.html`, replaced in this slice by the version Łukasz
  accepted (676,065 bytes, SHA-256 `124207eb1f8d4f77280b1241ff91cc2385e9e484aa4ad9f34e6afb102caf0fba`), copied in
  step 1 with `cmp` and SHA-256. Its new code: `idx`'s `I.calcUsers`, `directFed`, `isFed`, `usesCalc`, `calcGaps`,
  `calcSection`, `openCalcPick`, the handlers `calc-on`, `calc-add`, `calc-rm`, `calc-off` and `attr.calcrule`,
  `attrRow`'s mark and status, `relatedOf`, `askDeleteAttr`, `attrOk`/`attrFed`/`reqScope` (items 1–3);
  `lookupRels`, `relText`, `lookupFields`, `insCmap`'s third kind, the `cmap.kind`, `cmap.via` and `cmap.unknown`
  handlers, the cube line's chip and title (item 4); `cubeDemoV4` (item 5).
- **Decisions:** D-31, D-35, D-51, D-56, D-69, D-70, D-72, AD-23, AD-24, AD-26, AD-36, Q-5, C1 (slice 15).
- **`docs/data-model-v2.md`**, sections `attribute`, `cube_mapping`, `cube_mapping_input`.

## 5. Steps

Stop after each step; wait for Łukasz. A new session starts only at a step's boundary, reading CLAUDE.md, this PRD and
the acceptance doc.

1. **Reconnaissance and check.** Read the code of the areas this slice touches; answer Q1–Q8 in
   `slice-18-acceptance.md`; list every place where the PRD is wrong or differs from the code, a decision or the
   prototype, with a proposal each; the prototype's differences the slice touches; every new UI text and undo name;
   the earlier specs each item touches; a plan for steps 2–4. Copy the prototype and the PRD. No application code.
2. **Data and domain.** The migration, the table registry, the local adapter and file format, the domain's commands
   (calculate, add and remove inputs, change the rule, stop calculating; the lookup's kind, relationship and no-match
   value), the checks (same entity, no cycle, one input for a lookup), the cascades, D-51 for lookups, unit tests.
   Shared infrastructure: **one full run** at the end of this step.
3. **Panels and canvas.** Items 1, 4 and 5 in the UI: the sections, the picker, the row's mark and status, the
   lookup's fields and line chip, the demo seed. The slice's specs and the touched ones, CI.
4. **Coverage and dependents, close.** Items 2 and 3: every count, requirement coverage and scope, Focus, the delete
   previews; the element guard; the docs and D-73's text quoted for approval; then **one full run** on the final
   commit (the run before the merge). Stop with the manual acceptance steps. Merge and tag `slice-18` only on
   Łukasz's command.

## 6. Acceptance criteria

Tests in `e2e/slice-18/`, one file per criterion, fresh seed each.

| ID | Criterion |
| --- | --- |
| S18-01 | **Data.** The migration applies and rolls forward on a copy of the demo; a model without calculations or lookups reads and saves unchanged; a calculation and a lookup survive a save, a reload and an undo/redo of each command. |
| S18-02 | **Calculate.** On a new attribute of Order Line: "Calculate from attributes…", two inputs, the rule focused and saved; the row shows "="; "Add inputs…", ×, "Stop calculating", each one undo step. A reader and a reviewer see no controls. |
| S18-03 | **No cycle, same entity.** An attribute calculated from quantity: on quantity's picker it is disabled; the domain refuses a cycle or an input of another entity sent directly. |
| S18-04 | **Coverage.** Fact Sales' `net_amount` (demo) counts as fed on the card, in the overview and in the status bar; with one input's feed deleted it does not, its square is hollow and the panel names the gap; a requirement linked to it is covered only when its inputs are. Logical level: the same with mappings. |
| S18-05 | **Dependents.** Focus on a calculated attribute lights its inputs; on an input, the attributes calculated from it. Deleting an input: the preview names the calculation; after the delete the calculation has one input less; one undo restores both. |
| S18-06 | **Lookup.** On the demo's `country_name`: Lookup with its relationship and "Unknown"; switching to Direct copy and back keeps them; a new lookup on an input with one relationship selects it; two inputs refuse Lookup; the line's chip is "L". An approved lookup goes back to review when its relationship or no-match value changes, not when its note does. |
| S18-07 | **Relationship deleted.** The preview lists the lookup; after the delete the panel says the relationship is gone and an approved lookup is in review; one undo restores both. |
| S18-08 | CI, the element guard (no change on "Performance test", which has no calculated rows), commit counts while idle and panned unchanged, the full runs; every earlier test changed, with its reason. |

**Manual acceptance (demo and KB):** on the demo, the two seeded examples; in the KB, a calculated attribute on a
logical entity and DimBuilding's AssetCategory as a lookup from AssetCategory through Building, "Unbekannt"; then
remove the duplicated codes in Building by hand.

## 7. Performance

- `isFed` recurses through calculations; it must be computed once per index build or cached per render, never per row
  per frame (Q5). The cards' rows gain at most one element (the "=" mark) on calculated rows only, so "Performance
  test" keeps its baseline.
- No new canvas commits while idle or panned (S2C-12, S3A-14-idle, S3B-15-idle). No `measure:canvas` sitting unless a
  step changes how the canvas draws beyond the mark and the chip.

## 8. Questions for step 1

- **Q1.** How "calculated" is stored: inputs or a rule implying it, or an explicit flag (an attribute marked
  calculated with no inputs yet, as right after "Calculate from attributes…" is cancelled, must be representable or
  impossible). Recommend one.
- **Q2.** The local file format: a new version or rule C1; the adapter's tables; the table registry.
- **Q3.** Every place that counts mapped or fed attributes, or decides requirement coverage and scope, and how each
  switches to the shared rule; where the rule lives (domain, not UI).
- **Q4.** The domain's commands and undo names for the calculation and for the lookup's fields; how D-51's first rule
  is applied to the new fields; four-eyes.
- **Q5.** Where coverage is computed for the canvas today, and how the recursive rule stays cheap (an index of
  calculated attributes and their inputs, computed with the model's index).
- **Q6.** The cascades: an input's delete, a calculated attribute's delete, a relationship's delete with lookups, an
  entity's delete; the delete previews; imports that delete attributes (D-56's changes to resolve).
- **Q7.** Exports, reports and documents that list mappings or attributes (if any): whether they show calculations and
  lookups in this slice or later.
- **Q8.** "Fed from concepts" (D-70): whether a dimensional attribute covered through a calculation counts its inputs'
  concepts; recommend.

## 9. D-73 (proposal) and docs

"**Derivations (slice 18).** An attribute, logical or dimensional, may be calculated from other attributes of the same
entity, with a plain-text rule; it counts as mapped or fed when every input does, recursively, cycles excluded
(changes D-31), and a requirement linked to it is covered when its inputs are. A calculation and a direct mapping may
coexist; the panel warns. A dimensional mapping may be a lookup: one attribute of a dictionary read through a logical
relationship of that dictionary, with an optional value for no match; a change of its relationship or no-match value
sends an approved lookup back to review, and deleting the relationship clears it."

Docs: `decisions.md` (D-73, "(Changed by D-73.)" on D-31), `data-model-v2.md`, `ideas.md` (items 3 and 6 of 7 November
done; section 10 as later), `inventory-prototype-vs-app.md`, README and CLAUDE.md status.

## 10. Left for later

- A dimension's unknown member (Kimball's −1 row), with InfoCube's types.
- Lookups in source mappings (decision 4a).
- Structured expressions (parsed rules, functions, type inference); the rule stays plain text.
- A model check for a calculation that is also mapped (decision 2a), in the model validator.
- Suggesting a lookup when a dictionary's attribute is dropped on a dimension.
