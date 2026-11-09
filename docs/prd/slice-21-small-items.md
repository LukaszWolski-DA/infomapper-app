# Slice 21 – Small items: a row onto a column, a new concept in the picker, a gap's reason, the rule's draft, concept colours

Status: **proposed** (Łukasz, 9 November 2026). **Light path** (CLAUDE.md, "The slice cycle", 2): no data model change,
no change to the local file's format, no change to shared infrastructure. Branch `slice/21-small-items`, from `main`
(after PR #49). PRD file: `docs/prd/slice-21-small-items.md`; step 1 writes `docs/prd/slice-21-acceptance.md`. Test
regime: CLAUDE.md, "Testing".

Written from the docs after slice 20 and PRs #48 and #49, `docs/ideas.md` (slice 17's, slice 20's and the 15c entries
named below) and the prototype changed for this slice, which Łukasz accepted on 9 November 2026, **without reading the
code**. **The prototype is the source of truth for behaviour; where this PRD and the prototype differ, ask.** If step 1
finds that an item needs shared infrastructure, a new extension point or a data change, stop: the item leaves the slice
or the slice moves to the full path, on Łukasz's decision.

## 1. Why

Five small gaps, each found in Łukasz's testing or left by an earlier slice: a mapping can be drawn from a column onto
an attribute but not the other way (X1, `docs/ideas.md`, slices 1b and 15c); a concept missing from the concept picker
(slice 17, D-72) sends the modeller to the Model tab and back; the requirement panel says "not approved" for an approved
mapping whose column left the source (R6, slices 15d and 20); InfoMapper's mapping rule has no `keep`, as InfoCube's has
(slice 20, Q10); a concept's colour, chosen automatically, cannot be changed (the prototype's "Concept colours" in the
workspace settings is missing from the app and from `docs/inventory-prototype-vs-app.md`).

Decisions taken with Łukasz (9 November 2026):
- **1A.** The slice holds items 1–5 below. The requirement card's link handle at a constant size at low zoom is left for
  a slice that changes how the canvas is drawn anyway (it would need a measuring sitting); an entry in `docs/ideas.md`.
- **2A.** "New concept “{text}”" is the picker's last item while the typed text matches no concept's name exactly; it
  creates the concept and the entity, fact or dimension in one undo step; the colour is chosen automatically.
- **3A.** "column left the source" is a requirement gap's reason at the logical level only; the counts are unchanged.
- **4A.** A logical row dropped onto a column behaves exactly as the column dropped onto the row, D-48's choice included.
- **5A.** The workspace settings' "Concept colours", as in the prototype; each change is one undo step.

## 2. What to build

### Item 1 – A logical row dropped onto a source column (X1, D-48)

1. Dragging a **logical** attribute's row on the canvas and dropping it on a **source column's** row maps the column to
   the attribute with the same command, rules and result as dropping that column onto that attribute (slice 1b): a
   direct mapping when the attribute has none; otherwise D-48's choice ("Separate mapping (alternative source)" / "Add
   to mapping …", the same hint, Enter confirms, Esc cancels). One undo step, the same toast. The prototype's
   `findDrop` returns the same target kind (`{t:"row"}`) for both directions and `createMapping(col, attr)` serves both.
2. It works with InfoCube off and on. With InfoCube on, everything 15c's row drag does today stays as it is (a logical
   row onto a fact's or a dimension's row or header; a dimensional row onto a logical row; the refusals with their
   texts, `DIM_MSG`). A dimensional row onto a column keeps its refusal ("Facts and dimensions are fed from the logical
   model, not from source columns.").
3. While a logical row is dragged, the columns that can take it are lit and the rest dimmed, as 15c's veil does for its
   targets. Only those who may edit the model can drag (AD-05); a reader's or a reviewer's press starts nothing.

### Item 2 – "New concept" in the concept picker (D-72)

4. The concept picker (slice 17: the Entity tool and the toolbox's creates outside a concept frame, the Cube tab's New
   fact and New dimension) gets a last item "+ New concept “{text}”" while the filter holds text that equals no
   concept's name, comparing without case and extra spaces (the prototype's `pkNorm`). With an empty filter, or an exact
   match, there is no such item. It is reached with the arrow keys; Enter takes it when it is the only item, as any
   single item.
5. Taking it creates the concept, named by the typed text with extra spaces removed, and the entity, fact or dimension
   in it, **one undo step** (undo removes both, redo brings both back). The concept takes the first palette colour no
   concept uses, else the next in turn (the prototype's `nextConceptColor`, also used by the Model tab's "New concept";
   if the app's rule differs, step 1 says so). The toast: "Created {name} in the new concept {concept}. …" (the
   prototype's text). Escape or a click outside creates nothing.
6. Texts: the empty list "No concepts yet. Type a name to create one."; the filter's placeholder "Type to filter or name
   a new concept…".

### Item 3 – "column left the source" as a gap's reason (R6, D-70)

7. In the requirement panel's gap list, a **logical** attribute that is not covered and has an approved mapping from a
   column that is missing from the source or retired gets the reason "column left the source" instead of "not
   approved" (D-31 already counts no coverage from such a mapping). It comes before "type conflict" and "not approved".
   Counts and the coverage box are unchanged; a dimensional attribute's reasons are unchanged (D-75 names the column in
   its own line).

### Item 4 – `keep` for InfoMapper's mapping rule

8. InfoMapper's mapping panel's rule keeps its draft as InfoCube's rule does (`keep`, slice 13, D-66): a panel that
   unmounts while the rule has the focus keeps the typed text for that mapping, never saved elsewhere. Nothing visible
   changes otherwise; slice 20's guard `S20-Q10` stays green.

### Item 5 – Concept colours in the workspace settings

9. The workspace settings get the box "Concept colours", as in the prototype: the sentence "Violet is reserved for
   requirements, so it is not offered here." and one line per concept (its name and the eight palette swatches,
   `ALLOWED_CONCEPT_COLORS`; the current one pressed; none pressed for a colour outside the palette). A click sets the
   concept's colour: one undo step, saved with the newest version known (D-59); a choice field keeps no draft (D-66).
10. Who: owners and admins, as the other settings in the prototype; everyone else sees the swatches disabled. An
    archived workspace is read only. Everything coloured by the concept follows (cards, concept frames, the left panel,
    the miniature, thumbnails, dimensional lines); nothing is drawn differently.

**Not in the prototype's behaviour:** its gap list knows only "unmapped" and "not approved"; the app's reasons (D-70,
D-73) stay and item 3 adds one. Its picker's create item is generic (`PK.create`); build it generic only if the app's
picker makes that cheaper, the concept picker being its one user.

## 3. Data model

None: no table, column, migration or file format. Item 2 uses the existing creates of a concept and an entity in one
change group; item 5 writes the existing `concept.color` (`#RRGGBB` from the palette, D-41).

## 4. Sources

- **Prototype:** `docs/prototype/infomapper-prototype-with-sources.html`, replaced in this slice by the version Łukasz
  accepted (689,592 bytes, SHA-256 `a695662b0621b562637d18924bdb6fd56d8c47c897d98b9aaa624ee64bdd4283`), copied in step 1
  with `cmp` and SHA-256. Its changes against slice 20's version: `pkNorm`, `pickCreate`, `renderPick` (the create
  item, `.pk-new`), the picker's click handler (`data-pkc`), `pickConcept` (`create`), `createEntity` (`newConcept`),
  `nextConceptColor`, the Model tab's "New concept" (the shared colour rule), the requirement panel's `gapList`
  (`leftSrc`). Unchanged and to be matched: `findDrop` and the `row` drop (X1), `DIM_MSG`, the settings' "Concept
  colours" box (`data-ccol`).
- **Decisions:** AD-05, D-31, D-41, D-46, D-48, D-59, D-66, D-70, D-72, D-73, D-75, AD-24, AD-33, AD-34.
- **`docs/ideas.md`:** "Mapping by drag: from the attribute side too" (X1), "Modelling ergonomics: what comes later",
  "Model checks: what comes later" (R6), "InfoMapper's canvas and menus: what comes later" (R6's first entry), "Keep the
  mapping rule's draft when its panel closes".

## 5. Steps

Stop after each step; wait for Łukasz. A new session starts only at a step's boundary, reading CLAUDE.md, this PRD and
the acceptance doc.

1. **Reconnaissance and check.** Read the code of the areas the items touch; answer Q1–Q7 in
   `slice-21-acceptance.md`; every place where the PRD is wrong or differs from the code, a decision or the prototype,
   with a proposal each; every new UI text; the earlier specs each item touches; a plan for step 2; confirm the light
   path item by item. Copy the prototype and the PRD. No application code, no runs.
2. **Build and close.** Items 1–10, unit tests for the rules (the create item's match, the reason's order), the slice's
   specs and the touched ones; the element guard and the canvas commit counts unchanged (no measuring sitting: nothing
   on the canvas is drawn differently). Draft PR for CI at the start of the step. Then the docs and D-76's text quoted
   for approval; one full run on the final commit. Stop with the manual acceptance steps. Merge and tag `slice-21` only
   on Łukasz's command.

## 6. Acceptance criteria

Tests in `e2e/slice-21/`, one file per criterion, fresh seed each.

| ID | Criterion |
| --- | --- |
| S21-01 | **A row onto a column.** With InfoCube off and on: a logical row dropped on a column of an unmapped attribute makes a direct mapping, one undo step; on a mapped attribute D-48's choice opens with the same hint as the opposite drag, Enter and Esc as there; the lit and dimmed columns; a dimensional row on a column is refused with its text; a reader starts no drag. |
| S21-02 | **New concept in the picker.** The item absent with an empty filter and an exact match (other case, extra spaces), present after the matches otherwise; Enter and a click each create the concept and the entity (and a fact from the Cube tab) in one undo step; undo and redo take both; the colour is the first unused; the toast; Escape creates nothing. |
| S21-03 | **The gap's reason.** A logical attribute in a requirement's scope whose approved mapping reads a missing column, then a retired one, says "column left the source"; the counts unchanged; a dimensional attribute unchanged. |
| S21-04 | **The rule's draft.** As step 1 proposes (Q4): the typed rule kept for its mapping when the panel goes while the field has the focus; `S20-Q10` green. |
| S21-05 | **Concept colours.** An admin changes a concept's colour: its cards, concept frame and left-panel dot follow; one undo step; violet not offered; a modeller and a reader see the swatches disabled; an archived workspace read only. |
| S21-06 | CI, the full run before the merge; every earlier test changed, with its reason. |

**Manual acceptance (demo and KB):** a mapping drawn from a row onto a column; a fact in a new concept from the Cube
tab, then undo; a requirement with a column taken out by a re-import; a concept's colour changed in the settings, then
undone from the canvas.

## 7. Questions for step 1

- **Q1.** X1: where the row drag lives (15c's `rowDrag` and `drop`, `RowDrag` in `src/canvas/context.ts`,
  `ColumnDrag.tsx`); whether a logical row's drag starts with InfoCube off, and if not, what starting it in InfoMapper
  needs without a new extension point (AD-33); the D-48 choice's code and its hint for this direction; the veil's
  targets; what a logical row dropped on a column does today. If X1 needs a change to an extension point or shared
  infrastructure, stop.
- **Q2.** New concept: the concept's and the entity's creates in one change group (as "Create dimension from this…" or
  another command that creates several rows in one step); the app's colour rule and `sort_order` for a new concept; the
  slice 17 picker's code and whether a create item fits it; the toolbox's search create (a typed entity name, then the
  picker with an empty filter); the undo step's name.
- **Q3.** R6: `gapReason` and `lookupModel` in `requirements.ts`; how missing and retired columns are read; the order
  of the reasons; the coverage box's labels for such an attribute.
- **Q4.** `keep`: InfoMapper's rule field against InfoCube's `TextArea` with `keep`; how a spec can unmount the panel
  while the field has the focus, or else a unit or component test.
- **Q5.** Concept colours: whether the app changes a concept's colour anywhere today; the settings page's code and
  roles; whether a write from the settings page is an undo step on the shared history and where it is undone (the
  settings page's own Undo, or the homes' and canvases'); existing colours outside the palette (the demo, the KB:
  counts only, on a copy of a backup).
- **Q6.** The earlier specs each item touches (slice 1b's mapping drags, 15c's row drags, slice 17's picker, 4a's and
  15d's requirement panel, slice 20's `S20-Q10`, the settings' specs).
- **Q7.** The docs' discrepancies to fix at the closing: `docs/inventory-prototype-vs-app.md` lacks the "Concept
  colours" box; README's status lacks the e2e eight parts chore; `docs/ideas.md` lists R6 twice.

## 8. D-76 (proposal) and docs

"**Small items (slice 21).** A logical attribute's row dropped onto a source column maps them as the column dropped onto
the attribute does, D-48's choice included, with InfoCube on or off. The concept picker (D-72) offers "New concept
“{text}”" last while the typed text matches no concept's name, ignoring case and extra spaces; it creates the concept,
coloured automatically, and the entity, fact or dimension in one undo step. In the requirement panel a logical attribute
whose approved mapping reads a column that left the source (missing or retired) says "column left the source" (D-70).
InfoMapper's mapping rule keeps its draft as InfoCube's does (D-66). The workspace settings' "Concept colours" set a
concept's colour from the palette without violet (D-41), for owners and admins, one undo step each."

With "(Changed by D-76.)" added to D-48, D-70 and D-72. Docs: `decisions.md`, `ideas.md` (X1, "New concept…", R6 and
the rule's `keep` done; the link handle's entry), `inventory-prototype-vs-app.md`, `known-limitations.md` (X1's line),
README and CLAUDE.md (status).

## 9. Left for later

- The requirement card's link handle at a constant on-screen size at low zoom (with a measuring sitting).
- Choosing a new concept's colour in the picker.
- Dragging a requirement marker onto another row; multi-row selection; the other items of slice 17's list.
- A dimension's unknown member (slice 19's decision 5b), then the snapshot ("Show full context") or hierarchies and
  bridges.
