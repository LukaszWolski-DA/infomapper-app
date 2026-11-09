# Slice 22 – A dimension's unknown member

Status: **proposed** (Łukasz, 9 November 2026). **Full path** (CLAUDE.md, "The slice cycle", 2): a data model change
(a column on `cube_entity`, a new InfoCube table `cube_attribute`). Branch `slice/22-unknown-member`, from `main` (after
tag `slice-21`). PRD file: `docs/prd/slice-22-unknown-member.md`; step 1 writes `docs/prd/slice-22-acceptance.md`. Test
regime: CLAUDE.md, "Testing".

Written from the docs after slice 21 (D-76) and the prototype changed for this slice, which Łukasz accepted on
9 November 2026, **without reading the code**. **The prototype is the source of truth for behaviour; where this PRD and
the prototype differ, ask.**

## 1. Why

A fact row whose dimension key is empty or finds no row in the dimension is either lost or carries an empty key; the
usual answer is the dimension's **unknown member** (Kimball's −1 row, with values such as "Unknown"). In Data Vault the
information mart's unknown member usually comes from the ghost record. Slice 19 left it for later "with the model
validator" (decision 5b); the validator exists since slice 20 (D-75). The unknown member's values are business rules
("an unknown customer is “Unknown”, its segment “n/a”"), so they belong in the model, next to the lookups' "When no
match" value (slice 18, D-73).

Decisions taken with Łukasz (9 November 2026):
- **B.** A dimension has an unknown member or not, and a value per attribute for its row, with defaults by type; the
  key is simply the primary key's value (no field of its own). Several special rows (Not applicable, Late arriving) are
  later.
- **1b.** On for every dimension, existing and new; it can be turned off.
- **2.** Defaults: an Integer primary key "-1"; a String "Unknown"; every other type empty (NULL). A typed value wins;
  only typed values are stored.
- **3.** Two model checks: a dimension used by a fact without an unknown member (Normal); a typed value that does not
  fit its attribute's type (High).
- **4a.** A lookup's "When no match" shows the unknown member's value as its placeholder; no check compares the two.
- **5.** Shown in the dimension's panel ("Unknown member"), and in a fact's Dimensions as "no match → {key value}";
  nothing on the card except the checks' marks (D-75).
- **The table** is named generally, `cube_attribute`, for later per-attribute settings of a dimensional attribute.
- **Assumptions accepted with the prototype:** the value-fit rule below is new (the app's type rule compares a column's
  type with an attribute's, not a value); a Date's default is empty (no special rule for a date dimension).

## 2. What to build

### The dimension's panel

1. The Dimension section gets, after History (and Snapshot period) and before Used by, a flag button **"Unknown
   member"** (pressed when on) and its sentence:
   - on: "A row for fact rows whose key is empty or has no match, so they are not lost (Kimball's −1 row; in Data Vault,
     usually from the ghost record). Its values; an empty field takes the default shown."
   - off: "No unknown member: a fact row whose key is empty or has no match finds no row here. Turn it on to give it
     one."
2. While on, one line per attribute of the dimension, in the panel's attribute order: its name, under it its type and
   " · PK" for a primary key, and a text field with the stored value, its placeholder the default ("-1", "Unknown", or
   "empty (NULL)"). With no attributes: "No attributes yet." While off, no lines; the stored values stay and come back
   when it is turned on again.
3. A field saves on leaving it (D-66, as a text field): the value trimmed; an empty value deletes the stored one (the
   default applies); an unchanged value writes nothing. Each save is one undo step. A value that does not fit (item 7)
   is stored, its field marked (`aria-invalid`, the warning border) with the sentence under it ("“abc” is not an
   Integer").
4. Turning the flag on or off is one undo step. Only those who may edit the model (AD-05); readers and reviewers see the
   flag and the fields disabled; an archived workspace is read only.

### Elsewhere

5. **A fact's Dimensions:** a row with a key whose dimension has its unknown member on adds " · no match → {value}",
   the dimension's primary key's value (stored or default; "NULL" when both are empty), titled "A fact row whose
   {key} is empty or has no match gets {dimension}'s unknown member". Before the snapshot mark when both show.
6. **A lookup's "When no match":** when its target attribute is in a dimension with the unknown member on and that
   attribute's value (stored or default) is not empty, the placeholder is "{value} (the unknown member's value)";
   otherwise "e.g. Unknown" as now. The stored no-match value is unchanged.
7. **The value-fit rule** (a domain function, one for the panel and the checks): Integer `-?digits`; Decimal
   `-?digits` with an optional point and digits; Boolean `true` or `false`, any case; Date `YYYY-MM-DD`, optionally
   with ` HH:MM[:SS]` or `THH:MM[:SS]`; JSON parses; String not longer than its length when it has one. Its sentences:
   "“{v}” is not an Integer", "… is not a Decimal", "… is not a Boolean", "… is not a Date (YYYY-MM-DD)", "… is not
   JSON", "“{v}” is longer than String({n})".
8. **Model checks** (D-75), with InfoCube on, in the module's checks after "Approved feeds broken by the logical model":
   - `unkval` **"Unknown member values that do not fit"**, High, hint "A value of a dimension's unknown member does not
     fit its attribute's type. Change the value or the type.": one line per stored value that does not fit, of a
     dimension with its unknown member on; the line `{Dimension}.{attribute}`, "unknown member: {sentence}"; it opens
     the attribute; marks the attribute's row (and so the card's header); shown in the attribute's and the entity's
     panels.
   - `nounk` **"Dimensions without an unknown member"**, Normal, hint "A fact row whose key is empty or has no match
     finds no row. Turn on the dimension's unknown member, or say in its description why not.": one line per dimension
     with it off that a fact relates to (a relationship, not a self relationship), the line its name, "used by {facts}";
     it opens the dimension; marks its header.
   Both follow D-75's scope (the project's canvases), order (High first), counts and navigation; nothing else in the
   validator changes.
9. **Deletes and changes:** deleting an attribute deletes its stored value in the same undo step (its delete preview
   need not name it); deleting a dimension takes its rows. Changing an attribute's type or primary key flag keeps the
   stored value (the check says when it no longer fits) and changes the default shown.

### Not in this slice

The card shows nothing new besides the checks' marks; no SQL or dbt is generated; no special rows other than Unknown.

## 3. Data model

- **`cube_entity.has_unknown_member`** boolean: a dimension's, **true** by default and for every existing dimension row;
  null for a fact. `cube_entity_shape_ck` extended: a dimension has it, a fact has none. Rows of the local data file
  written before slice 22 read it as true (`TableRules.defaults` or `upgrade`, as slice 19 did; module tables are not
  part of the file's format, AD-33).
- **`cube_attribute`** (new InfoCube table), in the undo history (parent `attribute`):

  | Column | Type | Null | Notes |
  | --- | --- | --- | --- |
  | standard columns | | | |
  | `attribute_id` | uuid | no | FK `attribute` (of a dimension); unique among live rows |
  | `unknown_value` | text | yes | the unknown member's value as typed, trimmed, never empty; null when not set |

  A row exists only while it holds a value; clearing the last value deletes the row (step 1 confirms against how
  `cube_measure` rows come and go). Named generally for later per-attribute settings of a dimensional attribute.
- Migrations as the earlier InfoCube ones; `docs/data-model-v2.md` gets both.

## 4. Sources

- **Prototype:** `docs/prototype/infomapper-prototype-with-sources.html`, replaced by the version Łukasz accepted
  (718,294 bytes, SHA-256 `3b77c53a256a7492cfe80c510dd6f5afcda14d1d1dd0f86b5490a4641480c128`), built on slice 21's
  (`2c135f3a…`). Its changes: `cubeIndex` (`C.uvals`, `X.uv`), `unkOn`, `unkDefault`, `unkValue`, `unkFit`,
  `unkSection` (and its CSS `.uvlist`, `.uvrow`, `.uvbad`), `cubeEntitySection` (the section's place; the Dimensions
  row), `insChange` (`cube.uv`), the flag (`cube.unk`), `lookupFields` (the placeholder), `modelChecks` (C6: `unkval`,
  `nounk`). It also brings the prototype up to the app after slice 21 (D-76; `docs/inventory-prototype-vs-app.md`'s two
  lines): `pickVisible` ignores extra spaces; a row's press first ends a panel field's editing. These two need no
  application change; the closing removes the inventory's two lines.
- **Decisions:** AD-05, AD-33, D-59, D-66, D-67, D-68, D-73, D-74, D-75, D-76.
- **`docs/ideas.md`:** "A dimension's unknown member" (slices 18, 19 and 20's entries).

## 5. Steps

Stop after each step; wait for Łukasz. A new session starts only at a step's boundary, reading CLAUDE.md, this PRD and
the acceptance doc.

1. **Reconnaissance and check.** Answer Q1–Q9 in `slice-22-acceptance.md`; every place where the PRD is wrong or
   differs from the code, a decision or the prototype, with a proposal; every new UI text; the earlier specs and
   fixtures each step touches; the plan for steps 2 to 4. Copy the prototype and the PRD. No application code, no runs.
2. **Data and domain.** Draft PR at the start. The migration(s), the module's table and undo registration, the local
   file's defaults for old rows, the domain (the value-fit rule, the commands: set the flag, set or clear a value; the
   deletes in the same change group), the checks' rules, unit tests. A full run here only if step 1 finds the step
   changes shared infrastructure (the "Test runs" exception list).
3. **Interface.** The panel's section, the fact's Dimensions, the lookup's placeholder, the checks' groups with their
   marks and panels; S22 specs. The element guard and the canvas commit counts; the checks' bench within its bar; no
   measuring sitting (no new element on a card; the marks are D-75's).
4. **Close.** The docs and D-77 quoted for approval; one full run on the final commit. Stop with the manual acceptance
   steps. Merge and tag `slice-22` only on Łukasz's command.

## 6. Acceptance criteria

Tests in `e2e/slice-22/`, one file per criterion, fresh seed each.

| ID | Criterion |
| --- | --- |
| S22-01 | **Data.** Every seeded dimension has its unknown member on and no stored value; a file written before slice 22 loads with it on (unit or fixture); a fact row has none (the CHECK). |
| S22-02 | **The panel.** Dim Customer's section after History: the flag pressed, the sentence, five lines with "-1" and "Unknown" placeholders; " n/a " saved as "n/a", one undo step, undo and redo; cleared back to the default (the row gone); an unchanged value writes nothing; "abc" in customer_key stored, the field marked and its sentence; off hides the lines and keeps the values, on brings them back, one undo step each. |
| S22-03 | **Value fit.** Unit tests of the rule for every type and the String length (and the sentences); the panel's sentence for an Integer and a Date. |
| S22-04 | **Fact and lookup.** Fact Sales' Dimensions show "no match → -1" for each key, before "snapshot" where both show; nothing for a dimension turned off; the lookup's placeholder "Unknown (the unknown member's value)", "e.g. Unknown" when off. |
| S22-05 | **Checks.** A stored "abc" in Dim Customer.customer_key gives one High `unkval` line (the row's and the header's marks, the attribute's and the entity's panels, the project home); Dim Product off gives one Normal `nounk` line naming its facts; undo takes each away; InfoCube off shows neither. |
| S22-06 | **Deletes and roles.** Deleting an attribute with a stored value takes it in one undo step, undo brings both; changing the attribute's type keeps the value and adds or removes the `unkval` line; a reader and a reviewer see the flag and the fields disabled; an archived workspace read only. |
| S22-07 | CI, the full run before the merge (and one in step 2 if step 1 says so); the element guard; the checks' bench; every earlier test changed, with its reason. |

**Manual acceptance (demo and KB):** the demo's Sales star: Dim Customer's section, a value, a bad value and its check,
Dim Product off and its check, Fact Sales' Dimensions, a lookup's placeholder. KB: after the backup "Łukasz's test model"
requires, its dimensions load with the unknown member on.

## 7. Questions for step 1

- **Q1.** `cube_entity`: the column, the shape CHECK, the local file's defaults for old rows (`TableRules.defaults` or
  `upgrade`), the demo seed and `seed-large`; whether every path that creates a dimension (Cube tab, toolbox, "Create
  dimension from this…", the Entity tool with a role) sets it.
- **Q2.** `cube_attribute`: the table, its registration (AD-33, `ModuleUndoTable`), undo parents, a row deleted when
  its value is cleared or kept with null (against `cube_measure`), the store, and whether the table registry itself
  changes (then the step has its full run).
- **Q3.** The commands: setting the flag, setting and clearing a value (version, D-59; the length cap of a text field);
  the deletes of an attribute and an entity taking the rows in the same change group; undo refusing a value on a deleted
  attribute.
- **Q4.** The value-fit rule: where it lives (InfoCube's domain), whether the app has a similar rule to reuse (a
  lookup's no-match value, a default), the type names the app uses (`LTYPES`), the String length's source.
- **Q5.** The panel: InfoCube's dimension section (`PANEL_SECTIONS`), a text field with `useDraft` and `keep` per
  attribute, the attribute order, readers and reviewers.
- **Q6.** The fact's Dimensions row and the lookup's placeholder: where they are built, and what the module reads
  (the dimension's primary key, the target's dimension).
- **Q7.** The checks: the module's checks through the composition root (D-75's extension point), the two groups' place
  and order, marks and panels, the bench on "Performance test" (its dimensions and their attributes).
- **Q8.** Earlier specs and fixtures: the Dimension section's specs (15b, 19), Fact Sales' Dimensions (15b, 19), the
  lookup panel (18), the checks' counts on the demo (20: the home's and the status bar's numbers must not change with
  every dimension on and no stored value), exports and copies of a dimension (whether a copied entity copies its values).
- **Q9.** KB, read only on a copy of a backup, counts only: dimensions, their attributes, facts relating to them.

## 8. D-77 (proposal) and docs

"**A dimension's unknown member (slice 22).** A dimension has an unknown member, on by default for every dimension,
existing and new, and can be turned off: the row a fact row gets when its key is empty or has no match (Kimball's −1
row; in Data Vault usually from the ghost record). Its values are one per attribute; only typed values are stored, each
trimmed, and an empty field takes the default: an Integer primary key −1, a String \"Unknown\", any other type empty.
The key is the primary key's value. A typed value that does not fit its attribute's type (Integer, Decimal with a point,
Boolean, Date as YYYY-MM-DD, JSON, String within its length) is kept and marked. The dimension's panel shows the flag and
the values after History; a fact's Dimensions say \"no match → {key}\"; a lookup's \"When no match\" shows the unknown
member's value as its placeholder. Two model checks (D-75): values that do not fit (High), and dimensions used by a fact
without an unknown member (Normal). Deleting an attribute takes its value in the same undo step; turning the flag off
keeps the values. Every change is one undo step for those who may edit the model (AD-05)."

Docs: `decisions.md` (D-77), `data-model-v2.md` (the column and the table), `ideas.md` (the unknown member done; special
rows later), `inventory-prototype-vs-app.md` (the section; D-76's two lines removed), `known-limitations.md`, README and
CLAUDE.md (status; the module's tables).

## 9. Left for later

- Special rows besides Unknown: Not applicable (−2), Late arriving (−3), with their values.
- A date dimension's default (e.g. 1900-01-01 or 19000101) and a rule per role.
- Generating the unknown member's row (SQL, dbt seed) and the ghost record in Data Vault; exports and documents that list
  it (InfoDocumenter).
- A check comparing a lookup's no-match value with the unknown member's (decision 4b, not taken).
- Per-attribute history (SCD per attribute) in `cube_attribute`.
- The requirement card's link handle at a constant size at low zoom (slice 21's 1A); the snapshot ("Show full
  context"); hierarchies and bridge dimensions.
