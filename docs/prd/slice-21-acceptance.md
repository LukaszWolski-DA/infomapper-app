# Slice 21 – acceptance

PRD: [`slice-21-small-items.md`](slice-21-small-items.md). Branch `slice/21-small-items`.

## Step 1: the PRD checked against the code (9 November 2026)

### The starting point

- **The branch.** `main` was up to date with `origin/main` at `df77f59`, the merge of PR 49 (the e2e run in eight
  parts). `slice/21-small-items` was cut from there.
- **No run in this step.** No dev server, e2e run or test ran. One read-only count ran on KB (Q5): a copy of
  `.data/backups/kb-model-latest.json` (8 November 2026, 22:44) in the scratchpad, counts printed, the copy deleted.
- **The two files from Łukasz's Downloads**, each checked with `cmp` after the copy and with `sha256sum` against the
  prompt's value, and committed with this document:

  | File | SHA-256 | `cmp` |
  | --- | --- | --- |
  | `docs/prd/slice-21-small-items.md` (new, 15,113 bytes) | `8806f79fca85d9a84938d27af37490168677e920a0321bee4139342f13381f18` | equal |
  | `docs/prototype/infomapper-prototype-with-sources.html` (689,592 bytes, replaces slice 20's `035b5663…`) | `a695662b0621b562637d18924bdb6fd56d8c47c897d98b9aaa624ee64bdd4283` | equal |

### Finding P0: the new prototype is built on slice 19's prototype, not slice 20's (stop and ask)

The PRD says the prototype's changes are made "against slice 20's version". They are not. Against slice 20's version
(`a8be130`, 710,238 bytes) the new file adds 44 lines and removes 243. Against **slice 19's** version (`4984e55`,
687,691 bytes) it adds only the slice 21 lines (41 changed lines: `pkNorm`, `pickCreate`, `renderPick`'s create item,
the `data-pkc` click, `pickConcept`'s `create`, `nextConceptColor`, `createEntity`'s `newConcept`, the Model tab's
"New concept" and `gapList`'s `leftSrc`). So the file has **none of slice 20's prototype code**:

- the model checks: `checksDemo`, `modelChecks`, `chkIndex`, the cards' slanted "!", the status bar's "Model checks
  {n}", the panels' "Model checks" box, the Overview's list, the project home's section and its stats link, `goCheck`,
  the CSS after `.im-cons`;
- `copyField` (the attribute panel's "Copy of" stand-in);
- the field fix outside slice 20 (`insChange`, `INS_SWAP`: a field's change saved for the item its panel showed).

The app has all of slice 20 (D-75, tag `slice-20`). CLAUDE.md makes the prototype the source of truth for behaviour and
says to stop when the sources disagree. Committing this file as it is would make the frozen reference say that model
checks do not exist.

**Proposal.** Łukasz makes the slice 21 prototype again from slice 20's version (the 41 lines above apply there
without a conflict: none of them touches slice 20's code), and hands it over with its SHA-256; step 2 starts by
replacing the file. Until then this branch holds the file as handed over (the prompt asked for it to be committed) and
this document reads the slice 21 behaviour from it, which is the same in both bases. **I did not change the file.**

### Summary

The five items are small and the PRD's shape holds. Four of them stay on the light path without a change to an
extension point, shared infrastructure or data. **Item 2 does not, for facts and dimensions:** creating a fact or a
dimension in a new concept in one undo step needs the module's create action to take a new concept instead of a concept
id, and that action's input is an extension point (`EntityCreateInput` in `src/ui/modules.ts`, handed down through
`ModuleView`). As the prompt asks, I stop there for that part of item 2 (F3, question 2). A logical entity in a new
concept needs no extension point.

The PRD is wrong, incomplete or different from the code in these places (each in detail below):

1. **P0, above:** the prototype lacks slice 20.
2. **Item 2, F3:** facts and dimensions need `EntityCreateInput` to change (stop for that part).
3. **Item 2, F4:** the prototype's Enter counts the create item, so "sal" + Enter, which picks Sales today (S17-01, D-72),
   would do nothing. The PRD's sentence ("Enter takes it when it is the only item, as any single item") can be read
   either way.
4. **Item 1, F1:** with InfoCube on and a fact or a dimension on the canvas, a logical row's drag is the module's today.
   InfoMapper must add its own target (a column) to the module's drag without a new extension point: the canvas host
   composes the two. S15-09's veil count changes (5 lit cards become 6 with the table it places).
5. **Item 1, F2:** with InfoCube off the prototype refuses a logical row dropped on another logical row with a text that
   names facts and dimensions (`DIM_MSG.lToL`).
6. **Item 3, F6:** the coverage rule reads `missing_since` only; a retired column counts because a retired column is
   always missing too. The new reason should test both, as the PRD and the prototype do. Slice 20's
   `coverageGapText` already says "reads a column that left the source", but for a mapping in any status.
7. **Item 4, F8:** whether Chromium fires `blur` on a focused field that is removed decides what the spec can observe.
8. **Item 5, F9:** a concept's colour becomes a settings permission (owners, admins) while its name and delete are
   `model.edit` (modelers too). This is what the PRD and the prototype say; I note it.
9. **Q7:** the docs' three discrepancies are confirmed.

### Findings

| # | Item | Finding | Where | Proposal |
| --- | --- | --- | --- | --- |
| F1 | 1 | A logical row starts a drag only when a module returns one: the canvas host's `rowDrag` asks the extensions for an attribute row and returns `null` otherwise. InfoCube returns a drag for a logical row only while a fact or a dimension is on the canvas, with its own facts and dimensions lit and `planDrop` answering `"none"` for a column. `dropRow` hands every drop to the module. | `src/app/_panels/canvas-host.tsx` `rowDrag` (l. 164–181), `registerHost`'s `dropRow` (l. 349–352); `src/modules/infocube/app/canvas-ext.tsx` `rowDrag` (l. 135–149); `src/modules/infocube/domain/mappings.ts` `planDrop` (l. 186–203) | InfoMapper's own drag for a **logical** row, in the canvas host: lit = every table card (plus the module's lit cards), `plan` = `"ok"` on a column, else the module's verdict (or `"none"` without a module drag). No drag while the canvas has no table card and the module offers none. `dropRow`: a column target of a logical row goes to `useMapColumn`'s `mapColumn(columnId, attributeId, at)`, the same function the column's drop calls (D-48's plan, choice and hint, toast, selection); every other drop stays the module's. `CanvasExtension`, `RowDrag`, `CanvasHost` and `ColumnDrag.tsx` keep their shape (docs only: `CanvasHost.rowDrag`'s comment, CLAUDE.md's extension list). A dimensional row keeps InfoCube's refusal on a column (`DIMENSIONAL_TO_COLUMN`). |
| F2 | 1 | With InfoCube off, the prototype's `findDrop` refuses a logical row dropped on another logical row with `DIM_MSG.lToL` ("A logical attribute maps onto a fact or a dimension. …"), which names facts and dimensions in a workspace without them. With InfoCube on the app already refuses it with the same text (`LOGICAL_TO_LOGICAL`). | prototype l. 2886–2890; `mappings.ts` l. 42 | With no module drag (InfoCube off, or no fact or dimension on the canvas): a drop on a logical row or an entity's header does nothing (`"none"`, not marked), as a column dropped on a column today. Question 1. |
| F3 | 2 | A fact or a dimension is created by the module's action `create.action(workspaceId, { conceptId, placement })` (`EntityCreate.action`, `EntityCreateInput` with a required `conceptId`). Creating the concept first would be a second change group (two undo steps, against 2A). Doing both in one write needs that input to carry a new concept. InfoCube's `createCubeEntity` already calls InfoMapper's `createEntity`, so the module needs no concept logic of its own: only its action's input type and the `concepts` in its state. | `src/ui/modules.ts` `EntityCreateInput`, `EntityCreate` (l. 91–111); `src/modules/infocube/app/actions.ts` `create` (l. 52–67); `src/modules/infocube/domain/commands.ts` `createCubeEntity` (l. 40–67); callers `canvas-host.tsx` `createEntityAt` (l. 204–207), `left-panel.tsx` `createIn` (l. 547–558) | **Stop for this part** (prompt). Options for Łukasz: (a) an additive change to the extension point in this slice: `EntityCreateInput` takes `newConcept?: { name }` in place of `conceptId` (exactly one of them), InfoCube's action passes `concepts` into the state and the input on unchanged, and InfoMapper's `createEntity` (F5) builds the concept for both levels; CLAUDE.md's ModuleView entry says so. The light path's list in CLAUDE.md ("Test runs" exception) does not name extension points, but the PRD asks for Łukasz's decision. (b) Item 2 for entities only; the Cube tab's New fact and New dimension and "New fact here" / "New dimension here" keep the picker without the create item, and S21-02's fact moves to a later slice. (c) Item 2 leaves the slice. I recommend (a): a single optional field, the same command underneath, and the Cube tab is where Łukasz's manual acceptance uses it. |
| F4 | 2 | The prototype's Enter takes a button only when the list has exactly one (`btns.length === 1`), and the create item is a button. With "sal" typed, the list is Sales and "+ New concept “sal”": Enter does nothing. Today the app's Enter picks the one enabled item (`enterAction`), and S17-01 types "sal", presses Enter and expects Sales. | prototype `pickpop` keydown; `src/ui/pick.ts` `enterAction`; `e2e/slice-17/S17-01.spec.ts` l. 52–60 | Enter picks the one matching concept when exactly one matches (D-72, S17-01 unchanged), and takes the create item when no concept matches (the create item is then the list's only button, as in the prototype). With two or more matches, Enter does nothing, as today. Question 3. |
| F5 | 2 | The concept and the entity in one group: `createConcept` and `createEntity` are separate commands, each its own write set. `createEntity` checks a live `state.concept` with the input's `conceptId`. | `src/domain/commands/concept.ts` `createConcept` (l. 21–40); `src/domain/commands/entity.ts` `createEntity` (l. 78–110); `src/app/_actions/model.ts` `createEntityAction` (l. 56–73) | `createEntity`'s input takes `newConcept: { name }` (zod: exactly one of `conceptId` and `newConcept`; the name `nameSchema`, extra inner spaces collapsed on the client and again on the server) and its state the live `concepts`. The concept row is the one `createConcept` writes (its colour `nextConceptColor`, its `sort_order` `nextSortOrder`, shared through a small helper so the two cannot drift); the writes are concept, entity, card, frames, in one write set with the label below. The answer adds `conceptId` and the concept's name for the toast. No duplicate check on concept names exists today, and none is added (the item shows only when no concept has the name). |
| F6 | 3 | `lookupModel`'s `counts` treats a mapping as covering nothing when an input has `missing_since`; `retired_since` is not read. A retired column always has `missing_since` too (retiring acts on a column that left the source, and `S7B-04`'s header says so), so D-31's rule holds. `gapReason` returns `calculation`, `type_conflict` or null ("not approved"). Slice 20's `coverageGapText` puts "reads a column that left the source" first, for a mapping in any status. | `src/domain/model/requirements.ts` `counts` (l. 241–247), `gapReason` (l. 281–296), `GAP_REASONS` (l. 429–435); `src/domain/model/checks.ts` `coverageGapText` (l. 358–366); `src/app/_panels/requirement-panel.tsx` l. 86 | A new `GapReason` `column_left`, logical level only, after "calculation" (which needs no approved mapping of its own, so the two never meet) and before `type_conflict`: some **approved** mapping has an input with `missing_since` or `retired_since`. `GAP_REASONS.column_left = "column left the source"`. The requirement panel needs no change (it reads the map). The coverage box keeps the attribute under "mapped but not approved" (counts unchanged, as the PRD says). `coverageGapText` already tests left-source first, so its words do not change. Unit tests: the order (column left before type conflict), retired without missing (a hand-made row, defensive), a draft mapping from a missing column stays "not approved", a dimensional attribute unchanged. |
| F7 | 4 | InfoMapper's rule is a plain `<textarea>` with `useDraft(..., { elementRef: rule, readOnly })`, without `keep`; InfoCube's is a `TextArea` with `keep: { key: fieldKey(m.id, "rule"), field: "Transformation rule", object: "the mapping to …" }`, and InfoMapper's own Note field already has `keep`. | `src/app/_panels/mapping-panel.tsx` l. 166, 320–338, 379; `src/modules/infocube/app/mapping-panel.tsx` l. 243–254; `src/app/_panels/fields.tsx` `useDraft` (l. 109–330) | Add `keep: { key: fieldKey(m.id, "rule"), field: "Transformation rule", object: \`the mapping to ${attribute?.name ?? "?"}\` }` to the rule's `useDraft`, always, as InfoCube does. Edge, unchanged from InfoCube: a draft typed while "Transformation" was chosen but not yet saved (`wantsRule`) or with an input waiting (`pending`) comes back in a mapping that is still a direct copy, so its field is disabled until "Transformation" is chosen again; the draft stays for the page, never saved elsewhere. |
| F8 | 4 | How a spec unmounts the panel while the rule has the focus. A click on the canvas moves the focus first (S20-Q10, Q10's step 1), so the blur saves and `keep` never acts. A synthetic `click` without a press (`locator.dispatchEvent("click")` on a card's name, which selects on `click`) changes the selection and replaces the panel with the field still focused. Not certain from the code: whether Chromium fires `blur` on the removed `<textarea>` and whether React still hands it to `onBlur` (it listens at the root, and the element is gone). | `src/canvas/CardNode.tsx` `onClick` (l. 173–188); `src/app/_panels/inspector.tsx` (`key={sel.id}`) | S21-04 as proposed: type a rule, `dispatchEvent("click")` on another card's name, then select the mapping again. It expects one of two outcomes, and step 2 records which one Chromium gives: the text back in the field, unsaved, or the text stored on its own mapping. In both, nothing is written into another row (S20-Q10's rule). If Chromium saves on removal, `keep` is still right for other browsers and for a field without a blur. Plus S20-Q10 green. |
| F9 | 5 | No command changes a concept's colour today. `concept.color` exists (`#______` CHECK in the migration, palette in the domain: `CONCEPT_PALETTE`, `isConceptColor`), the concept table is in undo. The settings tab is on the workspace home (`/w/{ws}`), which has `UndoProvider` and the top bar's Undo since slice 12a; the page already loads the model. `SettingsForm` is editable with `workspace.edit_settings` (owners, admins; an archived workspace is refused by `checkPermission`). Rename and delete of a concept are `model.edit` (modelers too). | `src/domain/model/concept-colors.ts`; `src/domain/commands/concept.ts`; `src/domain/permissions.ts` l. 42, 56; `src/app/w/[workspaceId]/page.tsx` l. 309–326; `.../_components/settings-form.tsx` | A command `setConceptColor` (concept.ts): `workspace.edit_settings`, `{ conceptId, expectedVersion, color }`, the colour upper-cased and checked with `isConceptColor` (a refusal otherwise), a no-op when unchanged, one update with the label below. An action `setConceptColorAction` returning `Saved`. A box "Concept colours" after the other boxes in `SettingsForm` (as in the prototype), its lines from the page's live concepts in panel order, each swatch a `useChoice` saved through `saveRow(concept, …)` (newest version, no draft, D-66), `aria-pressed` compared ignoring case, `aria-label` "Colour {hex}" as the frame panel's swatches. Owners and admins edit; everyone else, and an archived workspace, sees them disabled. Undo from the workspace home's Undo or any canvas's (one history). The permission differs from a concept's rename (F9 itself; I would keep the PRD's). |
| F10 | 1–5 | Nothing on the canvas is drawn differently: item 1 uses 15c's veil (one SVG path in the overlay, `requestFade`) and `DraftLines`; items 2 to 5 draw nothing new on a canvas. | `src/canvas/ColumnDrag.tsx`; `src/canvas/fade.ts` | No measuring sitting (CLAUDE.md, "When to measure"); the element guard (`S3B-15-elements`, against slice-08's counts) and the canvas commit counts (S2C-12, S3A-14-idle, S3B-15-idle) run in step 2 as the PRD says. |

### Q1. X1: the row drag

- **Where it lives.** The gesture is `useColumnDrag` (`src/canvas/ColumnDrag.tsx`): a press on `.card.src .row` or
  `.card.ent .row` asks `rows.drag(from)`; `ModelCanvas` (l. 418–429) passes `ui.host()?.rowDrag(from)` and falls back
  to the column's old drag. The canvas host (`canvas-host.tsx`) answers: a column's drag is InfoMapper's (lit: logical
  cards and tables while a fact or a dimension is on the canvas; a drop on a dimensional row or header refused with
  `MAPPING_TO_DIMENSIONAL_MESSAGE`); an attribute row's is the first extension's (`CANVAS_EXTENSIONS`, `useHandlers`'
  `rowDrag`). The release (`up`) calls `onDrop` for a column's drag and `rows.drop` → `host.dropRow` for an entity row's.
- **With InfoCube off** a logical row starts nothing: the only extension returns `null`. It also returns `null` with
  InfoCube on while no fact or dimension is on the canvas.
- **What starting it in InfoMapper needs:** only the canvas host (F1). `ColumnDrag.tsx` already handles a drag from an
  entity row onto a column's row (`findDrop` returns `{ columnId }` for a source row; the verdict decides) and calls
  `host.dropRow` with that target. The `CanvasExtension` contract does not change: the host reads the module's drag
  and adds InfoMapper's target. No new extension point, no shared infrastructure.
- **D-48's choice for this direction:** `useMapColumn`'s `mapColumn(columnId, attributeId, at)` (`map-column.tsx`
  l. 58–70) with `planMapColumn` (`mapping-choice.ts`): direct when the attribute has no mapping, "That mapping already
  exists. It is selected now." when the column already feeds it, else the choice at the release point with the hint
  (same table: add; otherwise separate). It does not depend on which end was dragged, so the hint is the same.
- **The veil's targets:** today `RowDrag.lit` (cards: entities and tables). For a logical row: every table card, plus
  InfoCube's facts and dimensions when it offers its drag; the dragged row's own card and the other logical cards are
  dimmed (the prototype dims `.ent` and keeps `.dimn` and `.src` lit). Rows are not lit one by one (a column of a
  table can always take it).
- **A logical row dropped on a column today:** nothing (InfoCube's `planDrop` answers `"none"`; with InfoCube off there
  is no drag).
- **Readers and reviewers:** `useColumnDrag`'s `onPointerDown` returns at once without `editable` (`model.edit`), so
  their press starts nothing; the host's `dropColumn` and `mapColumn`'s callers check `editable` again.
- **Item 1 and the rule field (item 4):** every logical row becomes a drag start for editors, and its `pointerdown`
  calls `preventDefault`. S20-Q10 found that Chromium still moves the focus on such a press; S21-04 adds a click on a
  logical row as a fourth way of leaving the rule.

### Q2. New concept in the picker

- **One change group:** as F5 (logical) and F3 (facts and dimensions). "Create dimension from this…" is the model for a
  command that writes several rows in one group (`createDimensionFromAction`), here concept + entity + card (+ frames,
  + the module's `cube_entity`).
- **The colour rule** is the prototype's: `nextConceptColor` (`src/domain/model/concept-colors.ts`) takes the first
  palette colour no live concept uses, else `CONCEPT_PALETTE[n % 8]` with `n` the live concepts (the prototype's
  `S.concepts.length`); the palette equals `ALLOWED_CONCEPT_COLORS`. `sort_order` is `nextSortOrder` (last). The Model
  tab's "New concept" already uses both (`createConcept`).
- **The picker** (`src/ui/pick.ts`, `src/ui/pick-popover.tsx`) is generic and shared with slice 17's requirement
  pickers. A create option fits it: `PickOptions.create?: { label: (text) => string; act: (text) => void }`, a rule
  `createText(items, query)` beside `visibleItems` (the prototype's `pkNorm`: trim, inner spaces collapsed, case
  ignored, against every item's label), the button last in the list with its own test id (`picker-create`, so
  `picker-item` counts in slice 17's specs stay), reached by the arrows (it carries `data-pick-item`), and `enterAction`
  as F4. Generic is not dearer than concept-only here, so I would build it generic (the PRD's note).
- **The toolbox's search create** ("Create entity “Loyalty Card”") calls `createEntityAt` with `name`; the picker
  opens with an empty filter, so the create item shows only after typing. The toast is then the named variant.
- **The undo step's name:** proposed `Create {name} in new concept {concept}` (`writeSet.label`), e.g. "Create New
  entity in new concept Finance". Without a label the group would be named "Create concept" (`PRIORITY` in
  `change-label.ts`).
- **The toast** (the app's existing words with the prototype's addition): "Created {name} in the new concept
  {concept}. Type its name now; change the concept in the panel." (with ", labeled {label}" on a live canvas, as now);
  the toolbox search's: "Created {name} in the new concept {concept}." The app's toast has never said "the fact" / "the
  dimension" as the prototype's does; I would keep that difference.

### Q3. R6: the gap's reason

- `gapReason` and `lookupModel`: F6. Missing and retired are `source_column.missing_since` and `retired_since`
  (`src/domain/types.ts` l. 259–262); `lookupModel` keeps live columns only (`deleted_at`), missing or not.
- **The order** (requirement panel, `coverage.notApproved`): "an input of its calculation is not covered" (no approved
  mapping of its own), then **"column left the source"**, then "type conflict", then "not approved". A dimensional
  attribute: "logical feed not covered", "type conflict", "not approved", as now.
- **The coverage box** (`CoverageBar`, its title "{c} covered, {m} mapped but not approved, {n} not mapped") counts
  such an attribute as "mapped but not approved". Unchanged (3A).
- **Where else the reason is read:** only `checks.ts` (`coverageGapText` compares with `type_conflict`; unchanged by a
  new value) and the requirement index for the browser (`requirement-index.ts` passes `gapReason` through).

### Q4. `keep` for the rule

F7 and F8. A component test is not possible without a DOM test setup the repository does not have (Vitest runs Node
only); the spec is the check.

### Q5. Concept colours

- **Changed anywhere today?** No: a concept gets its colour on create and never again. The only colour writes are a
  frame's (`updateFrame`) and a concept's delete turning its frames free in its colour.
- **The settings page and roles:** F9.
- **Undo:** the write is a concept update, an undo step on the workspace's one history; undone from the workspace home's
  Undo (the settings tab is on it) or from any canvas or project home of the workspace. Proposed label "Change colour of
  {concept}". The settings' own fields stay outside undo (unchanged).
- **Colours outside the palette:** the seed's four concepts and "Performance test"'s are palette colours
  (`seed-model.ts` l. 76–79, `seed-large.ts` l. 96), the star adds no concept. KB, read only on a copy of
  `kb-model-latest.json`: 1 workspace, 4 concepts, 0 outside the palette, 0 in lower case, 4 distinct colours. A colour
  outside the palette would show no swatch pressed (the PRD), and the command would refuse to write one.

### Q6. Earlier specs and tests each item touches

| Item | Specs to run after step 2 | Expected change |
| --- | --- | --- |
| 1 | `S1B-01`, `S1B-02`, `S1B-03`, `S1B-14` (the column's drag, D-48, readers); `S2C-02`, `S10A-04` (D-48 near frames and lines); `S15-09`, `S15-11`, `S15-22` (15c's row drags and veil); `S20-Q10` | `S15-09`'s second test: "a logical row: the five facts and dimensions stay lit" becomes 6 lit cards (the table it places now takes the drop). Its comment says why. |
| 2 | `S17-01` (picker, Enter, Escape), `S1B-07`, `S3B-02`, `S3B-10`, `S5A-04`, `S6B-02-focus` (use `pickConcept` by a click), `S15-07` (15a and 15b) | none if F4's proposal is taken; with the prototype's Enter, S17-01's "sal" + Enter changes |
| 3 | `S4A-08`, `S4B1-01`, `S4B1-03`, `S4B2-01`, `S7B-04`, `S7B-13`, `S15-15`, `S20-04` (a feed's "not yet covered" line in its panel); unit: `requirements*.test.ts`, `tests/infocube-requirements.test.ts`, `checks.test.ts` | none (no spec has an approved mapping from a missing column in a requirement's gap list) |
| 4 | `S20-Q10`, `S1A-08`, `S1A-09`, `S1A-11`, `S1A-12`, `S1B-02`, `S3B-02` (the rule field) | none |
| 5 | `S0-06` to `S0-09`, `S1A-12`, `S7C-04`, `S7C-09`, `S9-04`, `S13-06`, `S15-03` (15a and 15b; the settings form), `S12A-0x` (the homes' Undo); `S15A-screens` on demand | none expected (a box is added after the others) |

The element guard and the commit-count specs (F10) run as the PRD says. The full run before the merge covers the rest.

### Q7. The docs' discrepancies, for the closing

All three are confirmed:
- `docs/inventory-prototype-vs-app.md` has no line for "Concept colours" (the settings section names only inviting
  people); the closing adds it as present.
- `README.md`'s status (l. 5) names the e2e reliability and CI e2e chores but not the eight parts (PR 49).
- `docs/ideas.md` lists R6 twice: under "InfoMapper's canvas and menus: what comes later" (from slice 15d's closing)
  and under "Model checks: what comes later". Both get "Done in slice 21".

Also for the closing: `docs/known-limitations.md` l. 1342 (X1) goes; `planDrop`'s comment ("A logical row's drop on a
column does nothing in 15c (X1)") changes; `docs/ideas.md`'s X1 entries (l. 178–186, l. 811) and "New concept…" (l. 810)
and "Keep the mapping rule's draft…" (l. 840) get "Done in slice 21"; the link handle's entry (1A) is added.

### Differences between the prototype and the app that the slice touches

1. **P0:** the prototype has no model checks, no "Copy of" and not slice 20's field fix (the app has them).
2. **Enter with the create item** (F4): the prototype counts it; proposed: the app keeps D-72's Enter.
3. **A logical row on a logical row with InfoCube off** (F2): the prototype refuses with a text about facts; proposed:
   nothing.
4. **The veil:** the prototype dims cards with classes on `body` (`connecting from-attr`); the app's veil is one path in
   the overlay (X3, AD-24). Same cards lit.
5. **The create toast:** the prototype says "Created the fact …"; the app's toast names no role (since slice 15a).
6. **The gap list:** the prototype knows "unmapped", "not approved" and now "column left the source"; the app's other
   reasons (D-70, D-73) stay (the PRD's note).
7. **Concept colours:** the prototype's click changes the colour with no toast; proposed: the app's undo toast. The
   prototype's swatch is labelled with the hex; the app's frame swatches say "Colour {hex}".
8. **Not touched:** the prototype's settings also have "Model conventions" (stereotypes, column classification, type
   mapping chips), "Statuses" and "Requirement templates" lines; the app has none of them. Not in this slice (no line
   in the PRD); they stay differences.

### New user-facing texts (for approval)

| Where | Text |
| --- | --- |
| Concept picker, last item | "+ New concept “{text}”" (the "+" a separate mark, as `.pk-plus`) |
| Concept picker, no concepts | "No concepts yet. Type a name to create one." (replaces "… Create one in the Model tab (New concept).") |
| Concept picker, filter | "Type to filter or name a new concept…" (replaces "Type to filter concepts…") |
| Toast, create | "Created {name} in the new concept {concept}. Type its name now; change the concept in the panel." / the search's "Created {name} in the new concept {concept}." (", labeled {label}" on a live canvas) |
| Undo step | "Create {name} in new concept {concept}" (proposal) |
| Requirement panel, gap | "column left the source" |
| Settings box | "Concept colours"; "Violet is reserved for requirements, so it is not offered here."; swatch label "Colour {hex}"; with no concept: "No concepts yet." (proposal) |
| Toast, colour | "Changed the colour of {concept}." with Undo (proposal) |
| Undo step | "Change colour of {concept}" (proposal) |
| Refusal | "Choose a colour from the palette." (a colour outside it, from a hand-made request only; proposal) |

### Light path, item by item

| Item | Light path? | Why |
| --- | --- | --- |
| 1 | yes | InfoMapper's canvas host only; the extension contract, `ColumnDrag.tsx` and the canvas's layers keep their shape |
| 2, logical entity | yes | a domain command's option and its action; the picker's generic create option (not shared infrastructure) |
| 2, fact and dimension | **stop** | needs `EntityCreateInput` (an extension point) to take a new concept (F3, question 2) |
| 3 | yes | a domain reason and its text |
| 4 | yes | one option on a field |
| 5 | yes | a domain command and action on an existing column of a table already in undo; a settings box |

No item changes data, the local file's format, undo or change groups, the save chain, the canvas's layers, the table
registry or the local adapter.

### Questions for Łukasz

1. **P0:** will you make the slice 21 prototype again from slice 20's version? (Recommended; step 2 then replaces the
   file first.) Or should the file stay as handed over, with its missing slice 20 noted?
2. **Item 2 for facts and dimensions (F3):** (a) the additive change to `EntityCreateInput` in this slice, on the
   light path (recommended); (b) entities only, facts and dimensions later; (c) item 2 leaves the slice; or (d) the full
   path.
3. **Enter (F4):** D-72's Enter kept (one matching concept is picked; the create item is taken only when nothing
   matches; recommended), or the prototype's (Enter only when the list has one button, create item included)?
4. **A logical row on a logical row with InfoCube off (F2):** nothing (recommended) or the prototype's refusal text?
5. **Item 4's spec (F8):** is the two-outcome spec acceptable, the outcome Chromium gives recorded in step 2?
6. **Item 5's permission (F9):** owners and admins only, as the PRD and the prototype (recommended), though modelers
   rename and delete concepts?
7. **The new texts** in the table above, especially the proposals (the undo names, the colour toast, "No concepts
   yet.", the refusal).

### Plan for step 2 (build and close)

1. **The prototype** (if question 1 says so): replace the file, `cmp` and SHA-256, a `docs:` commit. Draft PR for the
   branch at once (CI on every push).
2. **Item 3:** `column_left` in `requirements.ts` and its text; unit tests (order, retired, draft, dimensional).
3. **Item 4:** `keep` on the rule; S21-04.
4. **Item 2:** the picker's create option and rules (`pick.ts`: `createText`, `enterAction` per question 3; unit
   tests: the match ignoring case and spaces, the item absent on an exact match and an empty filter, Enter);
   `createEntity`'s `newConcept` (unit tests: one group with the concept's colour, order and the entity; undo and redo
   through the local adapter's test store); `createEntityAction`; per question 2 the module's action and
   `EntityCreateInput`; `concept-pick.ts`'s texts and `create`; `createEntityAt` and `createIn`; S21-02.
5. **Item 1:** the canvas host's composed drag and drop (F1, F2); S21-01; S15-09's count with its reason.
6. **Item 5:** `setConceptColor` (unit tests: permission, archive, palette, version, one undo step), the action, the
   box; S21-05.
7. **Checks:** `npm run lint`, `npm run typecheck`, `npm test`; the slice's specs and Q6's list; a failing test three
   times through the single-file check; the element guard and the commit counts (no measuring sitting).
8. **Close:** `decisions.md` (D-76 as approved, "(Changed by D-76.)" on D-48, D-70, D-72; and, with question 2 (a),
   CLAUDE.md's ModuleView entry), `ideas.md`, `inventory-prototype-vs-app.md`, `known-limitations.md`, README and
   CLAUDE.md's status; D-76's text quoted for approval; one full run on the final commit (S21-06); the manual acceptance
   steps. Merge and tag `slice-21` only on Łukasz's command.

## Step 1: Łukasz's answers (9 November 2026; PRD version 2, section 10)

1. **P0:** the prototype rebuilt on slice 20's version. Copied at the start of step 2: 712,576 bytes, SHA-256
   `2c135f3a3ca7a120ada8128c6239cc2f3046e81602172ea737c79e49a85fc389`, `cmp` equal; `modelChecks`, `INS_SWAP` and
   `checksDemo` present. Against slice 20's version it changes 51 lines: the 41 of step 1's P0 and the answers below
   (the picker's Enter, `findDrop` without InfoCube, the "Concept colours" click with its toast and no write for the
   same colour). PRD version 2: 18,901 bytes, SHA-256 `03a7dc0164858356468d66c2ad172b0179c772e7c0f0ae3a8501f8e32c22f62a`,
   `cmp` equal.
2. **Item 2 for facts and dimensions:** (a), the additive `newConcept` in `EntityCreateInput`, on the light path.
3. **Enter:** D-72's Enter kept (F4).
4. **A logical row on a logical row with InfoCube off:** nothing (F2).
5. **Item 4's spec:** one observable outcome (the text shown again, no other mapping changed); the path Chromium took is
   recorded in the report; if it saves on removal, one sentence in `docs/known-limitations.md` that the spec does not
   exercise `keep`.
6. **Item 5's permission:** `model.edit`, as a concept's rename and delete.
7. **The new texts:** the table as proposed, the create toast without a role (the app's).

## Step 2: build and close (9 November 2026)

### What changed

- **Item 3 (R6):** `GapReason` `column_left` in `src/domain/model/requirements.ts`: a logical attribute with an approved
  mapping that reads a missing or retired column, after "calculation" and before "type conflict";
  `GAP_REASONS.column_left = "column left the source"`. The coverage rule is unchanged. Unit tests:
  `requirements-column-left.test.ts`.
- **Item 4:** `keep` on InfoMapper's rule (`mapping-panel.tsx`), as InfoCube's.
- **Item 2:** `createEntity` takes `newConcept: { name }` in place of `conceptId` (exactly one), builds the concept with
  `newConcept()` (shared with `createConcept`, `concept.ts`; `tidyName`), writes it first in the same change group and
  names the step `Create {name} in new concept {concept}` (`writeSet.label`); the answer carries the concept's id and
  name. **The extension point, additively (answer 2a):** `EntityCreateInput.conceptId` is optional beside `newConcept`,
  `EntityCreateResult` carries `concept`; InfoCube's `create` action passes `concepts` and the input on, and
  `createCubeEntity` keeps InfoMapper's undo name when it rebuilds the write set. Nothing more of the module changed. The
  picker (`src/ui/pick.ts`, `pick-popover.tsx`): `PickOptions.create`, `createText`, `pickNorm`, `enterAction`'s create
  (D-72's Enter), the button `picker-create`; `concept-pick.ts`: the texts and `newConcept`; the canvas host's
  `createEntityAt` and the Cube tab's `createIn` pass either. Unit tests: `src/domain/commands/slice-21.test.ts`,
  `src/ui/pick.test.ts`, `src/modules/infocube/domain/commands.test.ts`.
- **Item 1 (X1):** the canvas host composes InfoMapper's drag for a logical row with the module's (`rowDrag`: the table
  cards lit beside the module's; a column `"ok"`, every other target the module's verdict or `"none"`; no drag without
  a table card and the module's) and routes a logical row's drop on a column to `mapColumn` (`dropRow`). The extension
  contract, `RowDrag`, `CanvasHost` and the canvas's layers keep their shape; two comments changed (`context.ts`,
  `planDrop`).
- **Item 5:** `setConceptColor` (`concept.ts`, `model.edit`, the palette, "Nothing to change." for the same colour,
  `Change colour of {concept}`), `setConceptColorAction`, the box "Concept colours" in `settings-form.tsx` (a
  `useChoice` per line on `saveRow` with the undo toast), its rows from the workspace page.

### Two changes beyond the plan (for Łukasz's review)

1. **The picker's filter ignores extra spaces** (`visibleItems` uses `pickNorm`). Found by S21-02: "  reference   DATA "
   is an exact match for the create item's rule but the old filter (`trim` only, as the prototype's `pickVisible`) left
   no item, so the list showed nothing at all. It now shows "Reference data". A difference from the prototype, in its
   favour; slice 17's filter is otherwise unchanged (its specs pass).
2. **A row's drag press leaves a focused panel field first** (`ColumnDrag.tsx` `onPointerDown`). Found by S21-04: the
   press calls `preventDefault` (no text selection while dragging), and in Chromium that also keeps the focus where it
   is, so a click on a logical row replaced the panel with its field still focused; a field without `keep` would lose
   its text. Before this slice that happened only on column rows (and on logical rows while a fact or dimension was on
   the canvas); item 1 made every logical row a drag start for editors. The press now blurs a focused input, textarea,
   select or editable element first, as any other press on the canvas does, and its blur saves it for its own row.
   `ColumnDrag.tsx` is the canvas's gesture code, not in CLAUDE.md's list of shared infrastructure; the full run covers
   it. The column-row half was a latent defect older than this slice (slice 1b): if Łukasz prefers, it can move to a
   `fix/…` branch of its own.

Also: the unit test "a retired column without `missing_since`" was dropped. Coverage reads `missing_since` only (D-31
holds because a retired column is always missing), so such a row would count as covered and give no reason; changing
the coverage rule was out of scope (counts unchanged). The reason itself tests both columns.

### S21-04: the path Chromium took

**Kept as a draft (`keep`).** With the panel replaced by a click event without a press, Chromium did not save the rule
on the field's removal: the stored rule stayed as it was, and with the mapping selected again its field showed the
typed text, which was saved when the field was next left. No sentence for `docs/known-limitations.md` is needed (answer
5: only if it saved on removal).

### Earlier tests changed

- `e2e/slice-15c/S15-09.spec.ts`: "a logical row: the five facts and dimensions stay lit" now expects 6 lit cards: the
  table the test places takes a logical row's drop since slice 21 (X1).
- Unit tests added to `src/ui/pick.test.ts` and `src/modules/infocube/domain/commands.test.ts`; none changed.

### Checks

- `npm run lint`, `npm run typecheck`, `npm test` (159 files, 1,950 tests before the last two additions; all pass).
- `e2e/slice-21`: 10 tests pass (first run: 8 passed, 2 failed, the two findings above; the two files again after the
  fixes: pass).
- Q6's earlier specs and the commit-count guards (54 files, 102 tests, local): 101 passed, 1 failed:
  `S0-07` "only the owner can archive…" timed out at its second session's sign-in (`bar-top` not shown) while the
  measurement build ran beside it; the single-file check (3 rounds) is below.
- The element guard (`S3B-15-elements`, measurement build, against `slice-08.json`): every viewport count equal (4,508,
  19,305, 1,465, 4,907); page totals 6,135, 20,932, 3,002, 6,444 (not compared, `<head>` included). No measuring sitting
  (nothing is drawn differently).
