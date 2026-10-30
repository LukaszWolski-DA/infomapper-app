# Slice 10a – Canvas actions on the save chain, a relationship from an entity to itself

Status: **step 1 answered, 29 October 2026** (`docs/prd/slice-10a-acceptance.md`, "Łukasz's answers"; this PRD is updated where they change it). Branch `slice/10a-save-chain-self-relationship`, from `main` at tag `slice-09` (`84ff767`, assumption A1). PRD file: `docs/prd/slice-10a-save-chain-self-relationship.md`; step 1 writes `docs/prd/slice-10a-acceptance.md`. Test regime: a small slice (CLAUDE.md, "Testing"), plus one full e2e run after step 2b, because it changes how the canvas's actions save (P3). Step 1 checks this PRD against the code (CLAUDE.md, "How we work").

## 1. Why this slice

Slice 10 "Relationships" was proposed at the end of slice 9 (PRD 9, section 9). It is split, and this is its first part. Two things change, both in the same canvas actions (`src/app/_panels/canvas-host.tsx`, the relationship line's menu and creating a relationship):

- **Writes started from the canvas join a row's save chain.** Since slice 9 a panel's saves of one row go one after another, each with the newest version known (`saveRow`, `rowSaves`). Some canvas actions write the same rows through plain `run` with the rendered version. So a quick panel save next to one of them, in either order, can still be refused as a false conflict until the page refreshes (`docs/known-limitations.md`, "Writes started from the canvas are not on a row's save chain"). Łukasz made the fix slice 10's first candidate (29 October 2026; `docs/ideas.md`).
- **An entity can be related to itself** (a parent and its children: an employee and their manager, a product category and its subcategories). Refused today on purpose, as in the prototype (`createRel`: "Pick a different entity to relate to."; the app's `createRelationship` and its test). Allowing it changes the prototype's behaviour (D-61) and needs a loop drawn in the line layer (AD-24 rule 3, measured).

The slice changes **no data model and no local data file format** (A2): `relationship` already has `from_entity_id` and `to_entity_id`, and `docs/data-model-v2.md` states no rule that they differ. Łukasz's `.data/dev-db.json` stays as it is.

**Decisions agreed with Łukasz on 29 October 2026:**

- **P1. Scope and order.** Slice 10a is this PRD. The rest of slice 10 and the slices after it are reordered as follows:
  - **10b:** relationships between source tables as lines on the canvas. No data model change; it reuses the loop for a table's own key, e.g. `employees.manager_id`.
  - **10c:** copying an attribute to another entity as a foreign key tied to a relationship. This is a data model change, so it gets a backup step for KB.
  - **11:** an alias for entities and attributes. Also a data model change; it comes right after 10c, so the two file format changes are adjacent.
  - **12 "Home pages":** undo on the home pages, then deleting a project, then canvas thumbnails (the home's load is measured first).
  - **13:** one behaviour for a refused save in every field (F6), together with keeping the typed value on a conflict.
- **P2. D-61's options:** "Relate to itself" is an item in the card header's menu, and the relate button clicked on the same card still refuses (option ii). A new self-relationship has the ends 0..1 → 0..n. Swap is kept (section 10).
- **P4. Writes found in step 1.** A write started outside a panel that sends a row's version and is not on the chain joins it in this slice, if step 1 confirms it. The list in `known-limitations.md` names six. Q1 names two more candidates: dropping an entity into another concept's frame (D-05), and the change-to-resolve actions on the system's panel.

**Proposed, to confirm in step 1:**

- **P3. Tests.** The small-slice regime, plus one full e2e run after step 2b: item 1 changes the save path of the canvas's line menus, attribute moves and drops, and many earlier specs use them (slices 1b, 2c, 7b).
- **P5. Item 1 is a fix, not a decision.** It changes neither the prototype's behaviour (the prototype has no versions) nor the data model. A real conflict stays refused exactly as today (S0-08, S9-03).

## 2. Sources

**Prototype** (`docs/prototype/infomapper-prototype-with-sources.html`):

| Function or place | What it gives this slice |
| --- | --- |
| `createRel` | the refusal of a relationship to the same entity (changed by D-61); a new relationship's ends 1..1 → 0..N; "Relationship added. Name it and set the cardinality on the right." and the new relationship selected |
| `insRel` | the relationship panel (label, the two ends' cardinality, swap) |
| the selection's breadcrumb (`out.push([… from.name + " – " + … to.name …])`) | a relationship is named "{from} – {to}" |
| the line bundling (`b.t === "rel"`, `V.layer`) | relationships hidden in the Mappings layer, shown in Relationships and Everything; lines into a collapsed frame bundle |
| the Delete key on a selected relationship | deleting it at once, with Undo in the toast |
| the import's sample file (`FK_employees_manager`, `employees` → `employees`) | a source's own self-referencing key; slice 10b draws it with the same loop |

The prototype has no self-relationship and no loop shape: both are D-61.

**Decisions:** D-01 (layers), D-05 (dragging into another concept's frame), D-07 (collapsed frames and bundles), D-22 (notation, layer, Focus), D-26 (the working context labels relationships through their entities), D-38 (a relationship is a history place, selected without moving the view), D-47 (the impact preview before deleting an entity), D-48 (a column dropped on a mapped attribute), D-52 (card actions only in the card header's menu), D-56 (changes to resolve), AD-05 (roles), AD-09 (archive), AD-12 (versions), AD-13 (change events), AD-23 (writes), AD-24 (canvas rules: 1 detail by zoom, 3 all lines in one SVG layer, the element guard and the LayerTree read).

**Data model:** `docs/data-model-v2.md`, section 4 (`relationship`: `from_entity_id`, `to_entity_id`, `from_min`, `from_max`, `to_min`, `to_max`, `label`).

**Earlier slices:**
- **1b:** S1B-06 relate, S1B-08 attribute order, S1B-13 deleting with Undo in the toast, S1B-14 a reviewer's rights.
- **2c:** bundles; S2C-11, "lines inside one frame left out" (`src/canvas/line-geometry.test.ts`).
- **4p and 4b-1:** the overlay's hovered and lit lines; Focus.
- **6b:** history places.
- **7b:** the change-to-resolve actions.
- **9:** `saveRow`, `rowSaves`, `Saved<T>`, `rowSaves.answer` and `exclusive`; the known limitation and the ideas entry this slice closes; S9-03 and S9-05.

## 3. What to build

Texts in quotes are proposals. Step 1 may adjust them, and the step that builds them lists every new user-facing text for approval.

### Canvas actions on the save chain (P4, P5)

1. **These writes go through `saveRow`** (`src/app/_components/use-action.ts`), as a panel field does:
   - **a)** a mapping line's menu: status, split, delete (`setMappingStatusAction`, `splitMappingAction`, `deleteMappingAction` through `deleteLine`);
   - **b)** a relationship line's menu: swap, delete (`swapRelationshipAction`, `deleteRelationshipAction` through `deleteLine`);
   - **c)** an attribute row's menu: delete the attribute (`deleteAttributeAction`);
   - **d)** a column dropped on a mapping with a rule, the D-48 choice "Add to mapping …" (`addMappingInputAction` in `src/app/_panels/map-column.tsx`);
   - **e)** the frame panel's "move to the frame's concept", one save per entity (`moveToFrameConcept`, `updateEntityAction`, `src/app/_panels/frame-panel.tsx`);
   - **f)** moving an attribute (item 2);
   - **g)** the writes step 1 added (F1; the rule: a write off the chain joins it when it writes a row that a field already on the chain also writes): merge (`mapping-panel.tsx`), "Delete from model…" (`delete-entity-dialog.tsx`), "Mark as needed" and deleting a source table (`source-panels.tsx`), deleting a working label (`label-panel.tsx`), removing and restoring a classification (`classifications.tsx`), deleting a concept (`delete-concept-dialog.tsx`), archiving and unarchiving the workspace (`lifecycle.tsx`).

   Names confirmed in step 1. Renaming and deleting a canvas stay off the chain (the tab's rename is off it too), as one line in `known-limitations.md`.

   **How each one saves (F2):**
   - **one row, `saveRow`**, with the answer's `version`: a)–e), "Delete from model…", "Mark as needed", deleting a table or a label, removing or restoring a classification, archiving and unarchiving. `splitMappingAction`, `markColumnNeededAction`, `restoreClassificationAction` and `unarchiveWorkspaceAction` start returning `version`;
   - **several rows known before it is sent, `saveRows`** (item 2), with the answer's `versions`: moving an attribute, merge, deleting a concept with "move to" (the concept checked, its entities held), D-05's drop into another concept's frame (the entities asked about, held only; called from `src/canvas`);
   - **rows not known before, their versions to `rowSaves.answer`:** the change-to-resolve actions (`source-change.ts`), which write tables, columns and mappings the server decides on.
2. **Moving an attribute** (`useMoveAttribute` in `src/app/_panels/move-attribute.ts`, `reorderAttributeAction`; the row menu, Ctrl/Alt+↑/↓ on the card, the attribute and entity panels' move buttons). The command `reorderAttribute` renumbers the moved attribute's siblings too.
   - **The answer:** the action returns the new version of every row it wrote (proposal: `Saved<T>` with a `versions` map, as undo returns `versions`). They are fed to `rowSaves.answer`, so a sibling's next panel save sends its new version.
   - **The order:** a panel save of a sibling that is on its way when the move starts must not be refused. Neither may a sibling's save started while the move is on its way. The move waits for the saves on their way of every attribute of that entity, and saves of those rows started meanwhile wait for it (step 1, F3: feeding `answer` alone is too late, because a save reads its version when it is called).
   - **`rowSaves.saveRows(rows, send)`** (F3) does that: it waits for every listed row's earlier saves and any undo, holds every listed row until its answer, sends the checked rows' newest versions, and feeds back every version in the answer's `versions`. `save` is its one-row case. A cutting refusal (stale version, permission, archive, not found) cuts the waiting saves of every row it lists, with one toast. `useAction` gets `saveRows` beside `saveRow`.
3. **What the canvas shows after its own write** stays as today: it waits for the page's refresh (`revalidatePath`, then the model through `ModelIndex`). Only the version sent changes. `mergeFresh` keeps covering cards, frames and notes only.
4. **A refused canvas write behaves as a refused panel save** (slice 9, item 3):
   - a refusal for a stale version, a permission, the archive or a row not found cuts the saves of that row waiting behind it, with one toast, the refusal's message ("not found" is new, for the panels too: F5);
   - a validation refusal cuts nothing;
   - a cut write shows no toast of its own.
5. **Deletes keep their Undo link in the toast** (S1B-13). A delete that is cut shows no "Undo" toast, because nothing was deleted.
6. **Undo and Redo wait for these writes once they are on the chain** (`rowSaves.exclusive`). Today they do not: `ui.settled()` waits for the canvas's card queue only, and only Next.js's sequential dispatch keeps these writes before an undo (step 1, F4). A unit test in `row-saves.test.ts` fails without the chain; S10A-06 is the end-to-end proof.
7. **Creating rows from the canvas stays as it is:** new entities, relationships, mappings and attributes, and requirement or label links. They send no version of an existing row.

### A relationship from an entity to itself (D-61)

8. **Creating one.** "Relate to itself" is an item in an entity card header's menu (D-52: card actions only there).
   - **Who:** owners, admins and modelers, in a workspace that is not archived, as the relate button (S1B-14). Reviewers and readers do not see the item, and the server refuses a direct call.
   - **The new relationship:** `from_entity_id = to_entity_id`, with the ends `from_min` 0, `from_max` 1 (the parent) and `to_min` 0, `to_max` n (the children). An empty label.
   - **Afterwards:** the new relationship is selected and its panel opens, a hidden details panel included (`openDetails()`, D-54: the item leads to editing a field in the panel; step 1, F13; the relate button stays as it is), with the relate toast ("Relationship added. Name it and set the cardinality on the right.").
   - **Undo:** one change group, one undo step.
   - **Live canvases:** the same rule as relating there today (Q7).
9. **The relate button clicked on the same card** still refuses. Proposed text: "Pick a different entity, or use “Relate to itself” in the card's menu." (today "Pick a different entity to relate to.").
10. **The domain** allows `from_entity_id = to_entity_id`, in `createRelationship` and in every other check that refuses it today (validation, the local adapter's rules, a migration's CHECK if there is one; Q4). If a CHECK exists, a new migration drops it. Applied migrations are never edited. The local file's format stays the same: no stored row changes.
11. **The loop.** A self-relationship is drawn in the existing relationship line layer (AD-24 rule 3), as one path like any relationship line, with no new layer, element type on cards or handle (rule 2).
    - **Shape (a proposal; step 4 shows screenshots for approval):** it leaves the card's right edge at the header's middle (the `from` end) and comes back through the card's top edge, near the right corner (the `to` end). The two ends meet the card at right angles, so both notations' end marks (crow's foot, UML; D-22) draw as on any line. If the geometry makes another pairing of ends and edges more natural, step 4 proposes it with the screenshots (item 14's field names follow it).
    - **Where in the code (step 1, F11):** a branch in `relGeom` (`src/canvas/geometry.ts`) when both ends are one card. `RelPath` (`LineLayer.tsx`) draws it, in the line layer and in the overlay's lit lines alike.
    - **Size:** fixed in canvas units, so it zooms with the card. A second or third loop on the same card nests outside the first, by the parallel-relationship `offset` that `buildLines` already gives (16 px apart).
    - **The label** sits at the loop's outer point.
    - **What it follows:** card moves, width changes (D-37) and a collapsed card. The header is always there, so the loop never depends on the rows.
    - **End marks:** kept at every zoom, as on every relationship line (only mapping lines lose their end dots below 40 %; step 1, F6).
    - **The miniature** (`Overview.tsx`) leaves self-relationships out (step 1, F12).
12. **Selecting, hover, menu:** a click on the loop selects the relationship and opens its panel. Hovered, it thickens by CSS in the line layer, as other relationship lines do; lit (Focus), it is drawn again in the overlay by the same `RelPath` (step 1, F7). Its right-click menu is the relationship line's (swap, delete), on the chain (item 1 b).
13. **Layers, frames, Focus:**
    - **Layers:** shown in Everything and Relationships, hidden in Mappings.
    - **Collapsed concept frame:** a member's loop is a line inside one frame, so it is not drawn and not counted in a bundle, as other lines inside one frame (S2C-11).
    - **Focus:** on the entity, it lights the loop. Focus on anything that leaves the entity faded fades it.
    - **Requirement traces** do not reach relationships (D-32). Nothing changes there.
14. **The panel and swap:**
    - **The panel** is the relationship panel as it is, titled "{entity} and {entity}", as the prototype's `insRel` and the app title every relationship (step 1, F8). The label and both ends are edited as today, on the chain.
    - **The two ends' fields** are named after the loop's drawing on a self-relationship: "At the right end" (`from`) and "At the top end" (`to`), instead of "At the {entity} end" twice (step 1, F9). Other relationships keep "At the {from} end" and "At the {to} end".
    - **Swap** exchanges the two ends' cardinalities and is one undo step. `swapRelationship` already does that on a self-relationship: it exchanges the entity ids (the same) and the cardinalities (step 1, F10). When the swapped row equals the old one (equal cardinalities at both ends), it is refused with the domain's "Nothing to change.".
15. **Everything else as for any relationship:**
    - **Delete:** at once, with Undo in the toast (S1B-13).
    - **History:** a place of its own, selected without moving the view (D-38). Nothing new in `SelectionHistory.tsx` unless step 1 finds that `placeOf` or `GONE` treats a relationship by its two entities (Q6).
    - **Deleting the entity:** the impact preview (D-47) counts the self-relationship once, not twice. Deleting the entity deletes it, and undoing the deletion brings it back.
    - **Working context (D-26):** the context labels the entity once.
    - **Live canvases:** a context card draws its own loop as it draws other relationship lines (Q6).
16. **The demo seed is not changed.** No self-relationship is added to it or to "Performance test", so the element guard's counts stay comparable (A4). Tests create self-relationships through the domain. Measuring adds them on a copy (section 6).

## 4. Steps

Stop after each step with a short summary of what changed and how to check it. Wait for Łukasz before the next.

1. **Critical review** (section 7). Check every item, decision and criterion against the code, `docs/decisions.md` and the earlier slices' acceptance docs; answer Q1–Q9 in `docs/prd/slice-10a-acceptance.md`. No application code. Stop.
2. **Canvas actions on the save chain** (items 1–7), in two parts (Łukasz's answer to step 1):
   - **2a. The chain's mechanics:** `rowSaves.saveRows` with `save` as its one-row case, the "not found" cut, `useAction`'s `saveRows`, and the actions returning `version` or `versions` (item 1's groups). Unit tests in `src/ui/row-saves.test.ts`: holding all rows, the order against a one-row save started meanwhile, the versions fed back, a cut across rows, `exclusive` (undo) waiting for it, and the test that fails without the chain (item 6); the domain's tests for what the actions return. CI. Stop.
   - **2b. Wiring:** the actions of item 1 onto the chain, specs S10A-01 to S10A-06, the earlier specs of the actions touched, CI, and one full e2e run (P3). Stop.
3. **The self-relationship in the domain and the panels** (items 8–10, 14, 15). The domain change and its unit tests (`relationship.test.ts`: the refusal test becomes an acceptance test), the menu item, the relate button's text, the panel, swap, the impact preview, the context. Specs S10A-07, S10A-10, S10A-11, and slice 1b's relate and delete specs. On this step the loop may still be drawn as the line layer draws it today; S10A-08 waits for step 4. Stop.
4. **The loop** (items 11–13, 16). Its geometry in the line layer and the overlay, its unit tests (beside `line-geometry.test.ts`), specs S10A-08 and S10A-09, slice 2c's bundle specs, slice 4b-1's Focus specs. Screenshots of the loop in both notations, at 100 % and below 40 %, collapsed card, two nested loops, for Łukasz's approval of D-61's drawing and of which end is on which edge (item 14's field names). Stop.
5. **The measurement sitting** (section 6, S10A-12). The element guard, the LayerTree read, the A/B sitting against `slice-09`, the loop's cost on the branch. Stop.
6. **Closing:** docs (section 10), one full e2e run, Łukasz's manual acceptance on KB after a backup. Merge only on his command; tag `slice-10a`.

## 5. Acceptance criteria

Tests in `e2e/slice-10a/`, one file per criterion, each from a fresh seed; unit tests next to the code. The ids follow the slices' pattern (`S4B1-…`, `S7A-…`), so `S10A-…`.

| ID | Criterion |
| --- | --- |
| S10A-01 | **Panel first, then the canvas.** A mapping's note typed in its panel, then at once a status from the mapping line's menu: both stored, no toast, two change groups. The same for a relationship's label in its panel, then at once swap from its line's menu. |
| S10A-02 | **The canvas first, then the panel.** A status from the mapping line's menu, then at once the mapping's note in its panel: both stored, no toast. The same for swap from the line, then at once the label in the relationship panel. |
| S10A-03 | **Moving an attribute** (item 2). Ctrl+↓ on a card's row, then at once a sibling's name in its panel: both stored, no toast, the new order kept. Reversed (a sibling's name, Enter, then at once Ctrl+↑ on another row): both stored. The moved attribute's own panel saved right after the move: stored. |
| S10A-04 | **The other actions** (item 1 c, d, e and g), one case each. An attribute's name saved in its panel, then at once deleted from its row's menu: deleted, no conflict. A mapping's rule saved, then at once a column dropped with "Add to mapping …": the input added. An entity's name saved, then at once the frame panel's "move to the frame's concept": moved. And for item 1 g: a mapping's note, then merge; an entity's name, then "Delete from model…"; a column's note, then "Mark as needed", then the note again; a table's note, then its delete; a label's name, then its delete; a classification's name, then remove, and restore, then its name; a concept's name, then its delete with "move to", then a moved entity's name; the workspace's name in the settings, then archive; unarchive, then the name. Each: stored, no false conflict. A drop into another concept's frame with "Move to …", then at once the entity's name in its panel: both stored. |
| S10A-05 | **A real conflict stays refused.** Another session changes a mapping. The status set from its line's menu is refused with "Someone changed this meanwhile. Reload to see the latest version." once, and the saves of that mapping waiting behind it are not sent. A cut delete shows no Undo toast (item 5). A save queued behind a delete of the same row is not sent and shows no toast of its own (F5). S0-08 and S9-03 pass unchanged. |
| S10A-06 | **Undo waits.** A status from the line's menu, then Ctrl+Z at once: that status change is undone, and the next save goes through without a conflict. The same for an attribute move (its siblings' order is restored). This would pass today through Next.js's order (F4); the unit test of item 6 is the check that fails without the chain. |
| S10A-07 | **Creating a self-relationship.** "Relate to itself" in a card header's menu creates one relationship with the entity at both ends, ends 0..1 → 0..n, one change group, its panel open (also when the details panel was hidden), the toast. Ctrl+Z removes it, Ctrl+Shift+Z brings it back. The relate button clicked on the same card shows item 9's toast and creates nothing. As a reviewer the item is not in the menu and a direct call is refused; in an archived workspace the write is refused. |
| S10A-08 | **The loop.** At 100 % the loop leaves the card's right edge and returns through its top edge; both notations draw their end marks, at 100 % and below 40 % alike; the label sits at the outer point. The miniature draws no line for it. A click on the loop selects the relationship. Its right-click menu offers swap and delete. A second self-relationship nests outside the first. The loop follows a card move, a width change and a collapsed card. |
| S10A-09 | **Layers, frames, Focus.** Mappings hides the loop; Relationships and Everything show it. With the entity in a collapsed concept frame there is no loop and no bundle counts it. Focus on the entity lights the loop; Focus on another entity fades it. |
| S10A-10 | **Panel, swap, history.** The panel is titled "{entity} and {entity}", its end fields "At the right end" and "At the top end". Label and both ends are saved. Swap exchanges the ends' cardinalities in one undo step; with equal cardinalities it is refused with "Nothing to change." and writes nothing. Selecting the loop, then a card, then Back selects the self-relationship again without moving the view (D-38). |
| S10A-11 | **Deleting and the context.** The entity's delete preview counts the self-relationship once. Deleting the entity removes it, and undo brings it back with its loop. With a working context on, creating it labels the entity once. Deleting the self-relationship is immediate with Undo in the toast. |
| S10A-12 | **Performance** (section 6): the element guard's viewport counts are equal against `slice-09` (baseline `slice-08.json`); the LayerTree read shows no new drawing layer with 20 loops in view; the A/B sitting is within its bars; the loop's cost on the branch is within its bar. |
| S10A-13 | CI and the runs of the test regime (P3); changed earlier tests listed with the reason (at least `relationship.test.ts`'s refusal). |

**Definition of done (scenario for the manual acceptance, on Łukasz's model KB).** Back up `.data/dev-db.json` first (CLAUDE.md).

1. In "Kanton Basel", type a mapping's note in its panel and set its status from the line's menu at once; then the other way round. Expect no toast.
2. Rename an attribute and press Ctrl+↓ on another row of the same card at once. Expect no toast and the order kept.
3. On an entity that has a parent–child meaning, choose "Relate to itself" in its card's menu. Name it and check the ends 0..1 → 0..n. Swap it, then undo the swap.
4. Look at the loop in crow's foot and UML, below 40 %, with the card collapsed, and with the concept frame collapsed.
5. Delete the entity and check the preview, then undo.

## 6. Performance

The save chain adds nothing to the page. The loop is a new shape in the existing line layer: one path per self-relationship, like any relationship line (AD-24 rule 3). Bars are proposals to confirm in step 1.

| What | How | Bar |
| --- | --- | --- |
| Viewport elements on a canvas page | `S3B-15-elements.spec.ts` with `ELEMENTS_BASELINE=.data/measure/s9-14-baseline/slice-08.json`: slice 9's closing found its counts equal to `slice-08`'s, page totals too (seed unchanged, item 16; step 1, F17) | viewport counts equal; a page total that differs is explained (as slice 8's +1 script) |
| Drawing layers | the LayerTree read (as `S4B2-15-layers.spec.ts`) on a copy of "Performance test" with 20 loops in view, against the same view without them | no drawing layer more |
| Pan and zoom and the first render, without loops | `npm run measure:canvas -- --to-screen --only pan,c08` against `slice-09` (step 1, F17: without loops in the seed the line layer draws the same elements by the same code), one discarded warm-up run after the builds, then `--rounds 2` (balanced) | within the sitting's run-to-run spread (slice 4b-2: pan within 2.3 %) |
| The loop's own cost | on the branch only, the same view of "Performance test" with 20 self-relationships against 20 ordinary relationships added on the same cards (the measuring spec writes them into the e2e data file before the page opens, as `S4B2-15-layers.spec.ts` does; never `.data/dev-db.json`, no `seed:large` option), pan and zoom as presented frames; `slice-09` cannot hold a self-relationship (it refuses it, and a row written into the file by hand would be drawn as a degenerate curve) | within 2 % of the ordinary relationships |
| Canvas commits | `window.__imCanvasCommits` for a status from a line's menu, before and after item 1 | equal (the chain changes the version sent, not the render) |

**Nothing above the canvas reads layout during a commit** (CLAUDE.md): this slice adds no element above or beside the canvas. The menu item is in the existing card menu, and the panel is the existing relationship panel. Item 1 adds no element anywhere.

**New elements on the canvas (AD-24):**
- A loop is one path in the relationship line layer, plus the same hit target and end marks as any relationship line: 5–7 elements in crow's foot, 6 in UML, 3 more with a label (step 1, Q5). So the element guard counts it as a relationship line, and the seed has none.
- Hovered and lit loops are drawn in the overlay (its own compositing layer), with no new layer.
- If a change of a few milliseconds has to be judged, compare phase traces, not medians (slice 6a).

## 7. Questions for step 1

**The rule (CLAUDE.md, "How we work"):** a PRD is a proposal to verify, not a specification; this one was written from the prototype and the docs without reading the code. In step 1, check every item, decision and acceptance criterion against the code, `docs/decisions.md` and the earlier slices' acceptance docs. Write into `docs/prd/slice-10a-acceptance.md` where the PRD is wrong, contradicts the code or a decision, duplicates what the app already has, misses what the code needs, or costs more than it assumes (data model, undo, change events, performance), each with the files and functions behind it and a proposal. List the differences between the reference prototype and the app that the slice touches. No application code in step 1; Łukasz answers before step 2.

- **Q1. Every write with a row's version outside `saveRow`.** Start from `known-limitations.md`'s table. For each write anywhere in the app that sends an existing row's `expectedVersion` (or equivalent) through `run`, give the file, the function, the action, the row and whether the action returns `Saved<T>`. In particular:
  - dropping an entity into another concept's frame (D-05);
  - "Delete from the model" in a card header's menu;
  - the change-to-resolve actions on the system's and table's panels (`src/app/_panels/source-changes.tsx`: retire, move, approve again, approve all, not needed, map);
  - live canvas actions;
  - the left panel;
  - the canvas tabs and menu (slice 9 left them off the chain as "not panels": say whether any of them can race a panel save).

  Per P4, propose which join the chain.
- **Q2. Moving an attribute.** What `reorderAttribute` takes and writes (the moved attribute's version only, or the siblings' too), what `reorderAttributeAction` returns, and whether item 2's order needs a save over several rows in `rowSaves` (a sketch of its interface and unit tests), or whether feeding `rowSaves.answer` is enough. Say what happens with the entity panel's drag reorder.
- **Q3. Deletes on the chain.** Whether the delete actions send a version, what a cut delete does to the toast and its Undo link (S1B-13), and whether a save queued behind a delete of the same row is refused as today ("deleted") without a second toast.
- **Q4. Where the self-relationship is refused today.** Every place: `createRelationship`, Zod schemas, the canvas's relate interaction, the local adapter's checks, `supabase/migrations/` (a CHECK on `relationship`), the seed's validation. Say whether item 10 needs a migration.
- **Q5. The line layer today.** How a relationship line is built (`src/canvas/line-geometry.ts` and the line layer component): its anchor points, its end marks per notation, its label, its hit target, and the elements one line has in the DOM. How the overlay draws hovered and lit lines (the same geometry or its own). What happens today when both ends are the same card (a degenerate path). How S2C-11's "lines inside one frame left out" decides it. Where a loop fits, and the size of the change.
- **Q6. The self-relationship elsewhere.**
  - What `swapRelationship` writes when both ids are equal.
  - The panel's title and the breadcrumbs.
  - The history's `placeOf` and `GONE` for a relationship.
  - The impact preview's relationship count (D-47: both directions, so possibly twice).
  - The working context's labeling through the entities (D-26: possibly two label writes for one entity).
  - How a live canvas's context cards draw relationship lines.
  - Lit sets in Focus (`lit.ts`) for a relationship whose ends are one card.
- **Q7. The card header's menu.** Where "Relate to itself" goes in it, how the menu decides by role and archive, and the rule for relating on a live canvas today (D-11: adding a card there labels its element; whether relating is offered there at all).
- **Q8. The measurement.** The `measure:canvas` `--only` keys that cover the line layer's cost. How to add 20 self-relationships and 20 ordinary relationships to a copy of "Performance test" (an option of `seed:large`, or test data through the domain in the measuring spec). Which LayerTree spec to reuse. Whether `slice-09`'s element counts need to be taken again (`.data/measure/…-baseline/slice-09.json`).
- **Q9. Earlier tests and docs.** Specs that change: slice 1b's S1B-06, S1B-08 and S1B-13, slice 2c's bundles, 4b-1's Focus specs, the 7b specs that use line menus, and `relationship.test.ts`. The known limitation this slice closes. The README's and the inventory's status lines.

## 8. Differences from the prototype (deliberate)

- An entity can be related to itself (D-61). The prototype refuses it (`createRel`).
- A new self-relationship has the ends 0..1 → 0..n; a relationship between two entities keeps the prototype's 1..1 → 0..N.
- The relate button's refusal on the same card names "Relate to itself" (item 9).
- A self-relationship is drawn as a loop; the prototype has no such shape. The miniature leaves it out.
- A self-relationship's panel keeps the prototype's title, "{entity} and {entity}", but names its end fields after the loop: "At the right end" and "At the top end" (the prototype's "At the {entity} end" would show twice).
- Swap on a self-relationship with equal cardinalities is refused with "Nothing to change.".
- Canvas writes carry versions and wait for each other per row (items 1–7); the prototype has no versions.

## 9. Left for later

- **Slice 10b:** relationships between source tables as lines on the canvas (`docs/ideas.md`; the prototype's review text "Shown later as a grey line between the table cards on a canvas").
  - It reuses this slice's loop for a table's own key.
  - Open questions: its own layer switch, history places for a source relationship, its bundles in collapsed system frames, a missing relationship's mark (`missing_since`), and the Changes view.
- **Slice 10c:** copying an attribute to another entity as a foreign key tied to a relationship (`docs/ideas.md`, "Notes from slice 8's manual acceptance", "Later").
  - Data model and local file format change, so it gets a step with a backup of KB.
  - Decide what happens to classifications and mappings, and whether the copy follows the original.
  - The self-relationship gives it the hierarchy case: a key copied onto its own entity.
- **Slice 11:** an alias for entities and attributes (data model change).
- **Slice 12 "Home pages":** undo on the home pages, deleting a project, canvas thumbnails (measure the home's load first).
- **Slice 13:** one behaviour for a refused save in every field (F6), with keeping the typed value on a conflict.
- **Ideas from this PRD (for `docs/ideas.md`):**
  - **Role names per relationship end** (e.g. "manager" and "reports"), useful above all on a self-relationship. A data model change.
  - **A mark on a collapsed frame's block** for its members' self-relationships, which item 13 leaves undrawn.

## 10. Decisions to accept, and docs in this PR

### D-61 (proposal) A relationship from an entity to itself

"An entity can be related to itself (a parent and its children). Owners, admins and modelers create it with “Relate to itself” in the card header's menu, in a workspace that is not archived, and its panel opens; the relate button clicked on the same card asks for a different entity and names that item. A new one has the ends 0..1 (the parent) and 0..n (the children). It is drawn as a loop on its card, from the right edge to the top edge, with both ends in the chosen notation at every zoom; several loops on one card nest; the miniature leaves it out. Its panel names the ends “At the right end” and “At the top end”. Inside a collapsed frame it is a line inside one frame: not drawn and not counted in a bundle. Swap exchanges its two ends' cardinalities, and is refused when they are equal. Otherwise it behaves as any relationship: label and cardinality in its panel, delete with Undo, layers, Focus, a history place, counted once in an entity's delete preview."

- **Creating it:**
  - **(i)** the relate button clicked on the same card creates it;
  - **(ii)** an item "Relate to itself" in the card header's menu, and the relate button still refuses on the same card. **Chosen by Łukasz, 29 October 2026.**
- **A new one's ends:**
  - **(iii)** as any new relationship, 1..1 → 0..n;
  - **(iv)** 0..1 → 0..n, a hierarchy with an optional parent. **Chosen by Łukasz, 29 October 2026.**
- **Swap:** kept, exchanging the ends' cardinalities. **Chosen by Łukasz, 29 October 2026.**
- **The loop's drawing** (shape, size, nesting, label place): approved with step 4's screenshots.

The text is quoted for approval in step 4, with the drawing.

### AD-24 (addition, proposal after step 5)

One sentence under rule 3, with the sitting's figures: "A self-relationship is a loop in the same SVG layer (slice 10a): one path, no new layer; pan and zoom with 20 loops within {x} % of 20 ordinary relationships."

### Assumptions to confirm

- **A1.** The slice starts from `main` at tag `slice-09` (`84ff767`).
- **A2.** No data model change and no new local data file format. If Q4 finds a CHECK on `relationship`, a new migration drops it, and `docs/data-model-v2.md` section 4 states that both ends may be the same entity. No stored row changes either way.
- **A3.** Łukasz's test model KB stays local: no fixture, nothing of it committed. It is backed up before the manual acceptance (CLAUDE.md). No upgrade runs.
- **A4.** The demo seed and "Performance test" get no self-relationship. Tests create them through the domain, and the measurement adds them on a copy (item 16, Q8).

### Docs in this PR

- **`docs/decisions.md`** (only with Łukasz's approval of the quoted texts, steps 4 and 5): D-61; AD-24's addition.
- **`docs/data-model-v2.md`:**
  - section 4, `relationship`: "`from_entity_id` and `to_entity_id` may be the same entity (a self-relationship, slice 10a, D-61)";
  - section 11, if a rule moves there.
- **`supabase/migrations/`:** only if Q4 finds a CHECK (A2).
- **`docs/inventory-prototype-vs-app.md`:** deliberate differences: the self-relationship and its loop (D-61).
- **`docs/known-limitations.md`:** "Writes started from the canvas are not on a row's save chain" fixed (kept with its fix, or removed, as Łukasz prefers); one line: renaming and deleting a canvas are not on the chain (the tab's rename, the menu's delete; the look has its own queue).
- **`docs/ideas.md`:**
  - "Canvas actions on a row's save chain" done;
  - "A relationship from an entity to itself" done;
  - the plan of P1 (10b, 10c, 11, 12, 13) recorded;
  - section 9's two new ideas;
  - "The relate button opens the details panel" (step 1, F13: today it selects the new relationship only).
- **README and CLAUDE.md:**
  - the slice's status;
  - CLAUDE.md's "Saving in panels": canvas writes on the chain, `saveRows` for writes over several rows, versions through `rowSaves.answer` for writes whose rows only the server knows, and "not found" as a cut;
  - the new e2e helpers;
  - the element guard's command against `slice-09`.
