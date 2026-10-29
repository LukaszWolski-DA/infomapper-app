# Slice 10a – acceptance

Status: **step 1 (critical review) done, waiting for Łukasz's answers.**

- `main` was at `84ff767` (tag `slice-09`), as A1 says. Branch `slice/10a-save-chain-self-relationship` was made from that tag.
- The PRD is copied unchanged from `~/Downloads/slice-10a-save-chain-self-relationship.md` (33,348 bytes, 29 October 2026; the only file with that name). Commit "docs: slice 10a PRD".
- `.data/dev-db.json` (KB) was not touched. No seed or reset was run.

Step 1 checks every item, decision, assumption and criterion against the code, `docs/decisions.md` and the earlier slices' acceptance docs. It writes no application code.

## Summary

| # | Finding | Proposal |
| --- | --- | --- |
| F1 | **The list of off-chain writes is longer than six** (Q1). Besides the six of `known-limitations.md`, these send an existing row's rendered version through `run` while a panel field saves the same row: the mapping panel's **merge** (several mappings), the entity's **"Delete from model…"** dialog, the column panel's **"Mark as needed"**, the table panel's **delete**, the label panel's **delete**, the classification list's **remove** and **restore**, the concept's **delete** dialog, the workspace's **archive / unarchive**, and the canvas's **rename** and **delete** (next to the look's own queue). | Join the chain in 10a: the six, plus merge, "Delete from model…", "Mark as needed", the table's delete and the label's delete (same object, same panel or one click away). Leave for later, with a line in `known-limitations.md`: the classification list, the concept dialog, archive, the canvas tab and menu. Q1 has the table; question 1. |
| F2 | **Some writes bump a row without sending its version.** They are never refused, but the chain does not learn the new version, so the *next* panel save of that row is refused until the page refreshes ("canvas first" only). They are: D-05's drop into another concept's frame (`moveCards`/`placeCard` with `moveToConcepts`, `frame.ts` and `canvas-item.ts`: the entity row), `reorderAttribute`'s renumbered siblings, and the change-to-resolve actions (`source-change.ts`: they check only the change's own version and write the table, columns and mappings). | The answer of each such write carries the versions it wrote, and the browser feeds them to `rowSaves.answer` (as undo does). Proposal (b) in Q2: a helper in `run-command.ts` that collects `update` versions for the tables panels save, used per action (opt-in, so an import never returns 20,000 versions). |
| F3 | **Moving an attribute needs a save over several rows** (Q2). `reorderAttribute` checks only the moved attribute's version and rewrites its siblings unchecked. A sibling's panel save started while the move is on its way reads its version at once (Next.js takes the arguments when the action is called), so feeding `answer` after the move is too late for it. | `rowSaves.saveRows(rows, send)`: waits for every listed row, holds them all until its answer, sends the checked rows' newest versions, and feeds back every version written. `save` becomes its one-row case. The same primitive serves merge (F1) and D-05's drop (F2). Sketch and unit tests in Q2. |
| F4 | **Undo does not wait for the canvas host's writes today** (item 6). `ui.settled()` (`ModelCanvas.tsx`, `settled`) waits for the card queue only, and `rowSaves.exclusive` waits for `rowSaves` only. The line menu's writes are ordered before an undo only by Next.js's sequential dispatch, which it calls an implementation detail. `known-limitations.md`'s "Undo and Redo do wait for both kinds" is about panel saves and card writes, not these. | Item 6 becomes "Undo and Redo wait for these writes once they are on the chain". S10A-06 would pass today too, through Next.js's order. So `row-saves.test.ts` gets the real check (an `exclusive` step after a `saveRows` on its way), and S10A-06 stays as the end-to-end proof. |
| F5 | **A save queued behind a delete of the same row gets its own toast** (Q3). The delete answers; the save behind it is refused as `not_found` ("This mapping does not exist."), which is not a cutting code (`CUTS` in `row-saves.ts`). | Add `not_found` to `CUTS`: a row that is not found stays not found for the saves already waiting (an undo that brings it back runs `exclusive`, after them). One line, panels gain it too. Question 4. |
| F6 | **Relationship lines have no end dots** (items 11 and 13, S10A-08). `RelPath` (`LineLayer.tsx`) draws the crow's foot or UML marks at every zoom; only mapping lines lose their dots below 40 % (`dots = !lod`). | Item 11's "Below 40 %" line and S10A-08's "Below 40 % no end dots" become: "below 40 % the loop keeps its end marks, as every relationship line does". The screenshot at below 40 % stays. |
| F7 | **A hovered relationship line is not drawn in the overlay** (item 12). `HoverLines` draws only mappings; a relationship's hover is CSS (`.lnk:hover .s`) in the line layer. Lit relationship lines are drawn in the overlay (`LitLines`, `FadeLayer.tsx`). | Item 12: "Hovered, it thickens by CSS as other relationship lines do; lit, it is drawn again in the overlay by `RelPath`." The loop comes for free in both, since both call `RelPath` → `relGeom`. |
| F8 | **The panel's title is "{from} and {to}"**, in the app and in the prototype (`insRel`). "{from} – {to}" is the prototype's breadcrumb and the app's line menu heading (`canvas-host.tsx`); the app has no selection crumb (item 14, S10A-10). | Keep the panel title as it is: "Employee and Employee". S10A-10 checks that. Question 5. |
| F9 | **The panel's two cardinality fields would have the same label.** Today they are "At the {from} end" and "At the {to} end" (`relationship-panel.tsx`, as the prototype). On a self-relationship both read "At the Employee end". The two sentences read "Each Employee manages 0..n Employee. Each Employee belongs to 0..1 Employee." | For a self-relationship only: "At the parent end" and "At the child end", as D-61 names the ends (the parent end is `from`). Swap exchanges the ends, so the labels stay and the values change. A new text; question 6. |
| F10 | **Swap on a self-relationship with equal ends writes nothing new.** `swapRelationship` has no "nothing to change" check, because for two entities the ids always change. With 0..1 at both ends it writes a new version identical to the old one: a change group and an undo step that change nothing. | `swapRelationship` refuses with "Nothing to change." (`nothingToChange`) when the swapped row equals the old one. A domain rule with a unit test. |
| F11 | **Where the loop fits is small** (Q5). `buildLines` already numbers parallel relationships per card pair (`offset`, key `[from, to].sort()`), so loops on one card get 0, 16, 32 … for nesting. `bundleLines` already leaves out a relationship with both ends in one collapsed frame (`if (fa && fa === fz) continue`). The change is a branch in `relGeom` (`geometry.ts`) for `fromCardId === toCardId`, about 20 lines, plus its tests. | Item 11 as written, with `offset` as the nesting step. No change to `LineLayer.tsx` beyond passing that the ends are one card. |
| F12 | **The miniature would draw a zero-length line.** `Overview.tsx` draws each relationship as a `<line>` between card centres; a self-relationship gives one line from a point to itself (an element, nothing seen). | Leave self-relationships out of the miniature. Not in the PRD; one line. |
| F13 | **"Its panel opens" is not what relate does today.** `relate` (`canvas-host.tsx`) selects the new relationship and does not call `openDetails()`, so a hidden details panel stays hidden (D-54, slice 5a). | "Relate to itself" is a menu action that leads to the details on purpose, so it calls `openDetails()` (as "Edit name and cardinality…" does). The relate button stays as it is. Question 7. |
| F14 | **The impact preview and the working context count the entity once already** (Q6). `entityImpact` and `deleteEntity` filter relationships with `from === id \|\| to === id`; `contextTargets` keys by `entity:{id}` in a Map. Focus's lit sets are Sets. | No code. S10A-11 proves it. |
| F15 | **No migration and no adapter rule refuse a self-relationship** (Q4, A2). The only refusals are `createRelationship` (`relationship.ts`) and the host's `relate` (`canvas-host.tsx`). The `relationship` table has CHECKs on min and max only. | A2 holds: no migration. The data model gets item 10's sentence. `docs/data-model-v2.md` section 11 has no line on relationship ends today, so nothing moves there. |
| F16 | **`splitMappingAction` and `mergeMappingsAction` return no version.** The panel's split is already on the chain (slice 9) but its answer feeds nothing back. | With F2's helper they return the versions they wrote. Split from the line menu then joins the chain with the same answer. |
| F17 | **The A/B sitting has little to measure** (Q8). The seed has no self-relationship (item 16), and item 1 changes only the version sent. Without loops the line layer draws the same elements by the same code. | A short sitting, as slice 9's: `--only pan,c08` (`--rounds 2`, one discarded warm-up), the element guard, the commit count. The loop's own cost and the LayerTree read are branch-only. Question 8. |

## Q1. Every write with a row's version outside `saveRow`

Every call of `run` that sends an existing row's `expectedVersion`, by area. "Panel field" names the field of a panel that saves the same row through `saveRow`. Without one there is no false conflict to fix.

**The canvas (`src/app/_panels/canvas-host.tsx`, `move-attribute.ts`, `map-column.tsx`, `frame-panel.tsx`):**

| Write | File, function | Action | Row | `Saved<T>`? | Panel field on the row | Proposal |
| --- | --- | --- | --- | --- | --- | --- |
| Mapping status from the line | `canvas-host.tsx`, `items` (`t.kind === "map"`) | `setMappingStatusAction` | mapping | yes | mapping panel | join (item 1 a) |
| Split from the line | same | `splitMappingAction` | mapping | **no** (F16) | mapping panel | join; return versions |
| Delete mapping (menu and Delete key) | `deleteLine` | `deleteMappingAction` | mapping | `null` | mapping panel | join |
| Swap from the line | `items` (`t.kind === "rel"`) | `swapRelationshipAction` | relationship | yes | relationship panel | join (item 1 b) |
| Delete relationship (menu and Delete key) | `deleteLine` | `deleteRelationshipAction` | relationship | `null` | relationship panel | join |
| Delete attribute (row menu) | `items` (`t.kind === "row"`) | `deleteAttributeAction` | attribute | `{ mappings }` | attribute panel | join (item 1 c) |
| Move attribute (row menu, Ctrl/Alt+↑/↓, attribute panel's position, entity panel's list and drag) | `move-attribute.ts`, `useMoveAttribute` | `reorderAttributeAction` | attribute and siblings | `{ position }` | attribute panel | join through `saveRows` (Q2) |
| "Add to mapping …" with a rule (D-48) | `map-column.tsx`, `confirm` | `addMappingInputAction` | mapping | yes | mapping panel | join (item 1 d) |
| "Move to the frame's concept" | `frame-panel.tsx`, `moveToFrameConcept` | `updateEntityAction` | entity | yes | entity panel | join (item 1 e) |
| "Delete from model…" (card menu) | `delete-entity-dialog.tsx`, `confirm` | `deleteEntityAction` | entity | counts | entity panel | join (F1) |

**Writes that bump a row without its version (F2):**

| Write | Where | Rows bumped unchecked | Proposal |
| --- | --- | --- | --- |
| D-05: a drag drop into another concept's frame, "Move to …" | `useFrames.ts` (`moveCards`, `moveToConcepts`) → `frame.ts` (`moveCards`); a dropped card from the left panel → `ModelCanvas.tsx` → `canvas-item.ts` (`placeOnCanvas`) | entity (`concept_id`) | return the entity versions; the canvas feeds `rowSaves.answer` and holds the asked entities through `saveRows` while the drop is on its way |
| A move's siblings | `attribute.ts`, `reorderAttribute` | the renumbered attributes | Q2 |
| The change-to-resolve actions: retire, move, delete, map, not needed, decide column by column, approve again, leave in review, acknowledge, approve again all | `source-changes.tsx` (`ChangeCard`, `act`; the bulk button) → `source-change.ts` (`run`: checks the change's version only) | table, columns, mappings, inputs | return the versions; feed `answer`. The change row has no panel field, so these do not join the chain themselves |

The change cards send the `source_change`'s own version. No field saves that row, so no false conflict comes from it. The risk is the table's note on the same panel: retire a table, then type its note at once, and the note is refused until the page refreshes.

**The panels (outside the canvas, F1):**

| Write | File, function | Row | Panel field on the row | Proposal |
| --- | --- | --- | --- | --- |
| Merge mappings | `mapping-panel.tsx`, `merge` | the mapping and the chosen others | mapping panel | join through `saveRows` |
| Mark as needed | `source-panels.tsx`, `SourceColumnPanel` | source column | the column's note (`SourceNote`) | join |
| Delete a source table | `source-panels.tsx`, `remove` | source table | the table's note | join |
| Delete a working label | `label-panel.tsx` | label | its name | join |
| Remove, restore a classification | `classifications.tsx` (list dialog) | classification | its name in the same list | later |
| Delete a concept (dialog) | `delete-concept-dialog.tsx` | concept | the left panel's rename | later |
| Archive, unarchive | `lifecycle.tsx` | workspace | the settings form (name, description …) | later |
| Unlink a requirement | `requirement-panel.tsx`, `requirements-section.tsx` | requirement link | none | no change |
| Remove a label from an item | `labels-field.tsx` | label link | none | no change |
| Change the organization's password | `people.tsx` | organization access | none | no change |

**Live canvases.** `live-canvas.tsx` only opens one. A live canvas's card removal uses the canvas's own versions (`versions.current`, `ModelCanvas.tsx`). Relating, moving attributes and the line menus are the same code as on any canvas. Nothing extra.

**The left panel.** Its rename is on the chain (slice 9). Its other writes create rows (entity, concept, requirement). Nothing extra.

**The canvas tabs and menu** (`canvas-tabs.tsx`, `canvas-menu.tsx`). Rename and delete send `canvas.version` from the page. The look (notation aside: grid, background, layer) has its own queue with its own version (`look.tsx`, `versionRef`), which rename does not read. So rename right after a layer switch can be refused. The window is short (a double-click and typing), and slice 9 left these off on purpose. Proposal: later, with a line in `known-limitations.md`.

## Q2. Moving an attribute

**What the command takes and writes.** `reorderAttribute` (`src/domain/commands/attribute.ts`) takes `{ attributeId, expectedVersion, position }`. It checks only the moved attribute's version. It rewrites every attribute of the entity whose `sort_order` changes, siblings included, without checking their versions. `reorderAttributeAction` returns `{ position }`, no version.

**The cases:**

- **A sibling's save on its way, then the move.** The move does not check the sibling's version, so the move is not refused. Next.js sends the two in order, so the sibling's save is not refused either. Our chain should not rely on that order (slice 9, F2), so the move waits for the siblings' saves on their way.
- **The move on its way, then a sibling's save.** The sibling's version is read when its save is called. Next.js holds the request until the move answers, but the arguments are already taken. The save is refused. Feeding `answer` after the move cannot help, because the version was read before. **So the sibling's save must wait in our chain.**
- **The moved attribute's own panel save right after the move.** The move answers with its version; `answer` is enough.

So item 2 needs a save over several rows. Feeding `answer` alone is not enough.

**Sketch (`src/ui/row-saves.ts`):**

```ts
/** Rows a save writes: `shown` for a row whose version is sent and checked, none for a row it only rewrites. */
type SaveRowsRow = { id: string; shown?: number };

/**
 * Sends a save that writes several rows: after every listed row's earlier saves and any undo on its way; saves of
 * those rows started meanwhile wait for it. `send` gets the newest known version of each checked row. On success every
 * version in the answer's `versions` (else `version`, for the first checked row) is fed back. A cutting refusal cuts
 * only the checked rows' saves waiting behind it.
 */
saveRows<R extends SaveOutcome>(rows: readonly SaveRowsRow[], send: (versionOf: (id: string) => number) => Promise<R>): Promise<R | null>;
```

- `save(id, shown, send)` becomes `saveRows([{ id, shown }], (v) => send(v(id)))`, so slice 9's behaviour and tests stay.
- `useAction` gets `saveRows(rows, action, success?, options?)` beside `saveRow`, with `CUT` as today.
- **Moving:** the rows are the moved attribute (checked) and every attribute of its entity (held). `reorderAttributeAction` returns `{ position, versions }`.
- **Merge:** every chosen mapping, all checked.
- **D-05's drop:** the entities asked about, held only (the drop sends no entity version). This needs `src/canvas` to call `rowSaves`; the layers allow it (`canvas` → `ui`).

**Unit tests (`src/ui/row-saves.test.ts`):**

1. A `saveRows` waits for a save of any listed row on its way.
2. A save of a held row started meanwhile waits for it, and then sends the version from its answer.
3. Its `versions` reach every listed row.
4. A stale refusal cuts the checked rows' waiting saves, not the held rows'.
5. `exclusive` (undo) waits for a `saveRows` on its way (F4).
6. A one-row `saveRows` behaves as `save` (slice 9's tests unchanged).

**The entity panel's drag reorder** calls the same `useMoveAttribute` with a position (`entity-panel.tsx`). It joins with the rest; no own code.

## Q3. Deletes on the chain

- `deleteMappingAction`, `deleteRelationshipAction` and `deleteAttributeAction` all send `expectedVersion`. The panels' deletes already go through `saveRow` (slice 9).
- **A cut delete.** `saveRow` returns `CUT` without calling `run`, so neither the refusal toast nor the "Undo" toast appears. The toast of the refusal that cut it is the only one. Item 5 holds with no extra code.
- **A save queued behind a successful delete of the same row** is refused as `not_found` ("This {mapping} does not exist."), each with its own toast. That is F5: add `not_found` to `CUTS`.
- After a canvas delete the host selects nothing (`ui.select(null)`), so the panel of that row closes. A save behind the delete comes only from a field left by the click itself, so this is rare.

## Q4. Where the self-relationship is refused today

| Place | Refuses? |
| --- | --- |
| `createRelationship` (`src/domain/commands/relationship.ts`): `fromEntityId === toEntityId` → `invalid`, "Pick a different entity to relate to." | **yes** |
| `relationship.test.ts`: the refusal test | yes (becomes an acceptance test) |
| `useCanvasHost.relate` (`canvas-host.tsx`): `from.id === to.id` on card ids → the toast, before any request | **yes** |
| `CanvasModes.tsx`: the relate click and the relate drag call `relate` with whatever card is under the pointer, the same one included | no (the host refuses) |
| Zod schema `createRelationshipInput` | no |
| The local adapter (`src/data/local/schema.ts`, `relationship`): foreign keys and the min and max checks | no |
| `supabase/migrations/20261002000000_initial_schema.sql`: `relationship_min_ck`, `relationship_max_ck` | no |
| The seeds (`seed-model.ts`, `seed-large.ts`), `scripts/check-schema.ts` | no |
| Undo (`undo.ts`, the references to `entity`) | no |
| `docs/data-model-v2.md`, sections 4 and 11 | no rule stated |

**Item 10 needs no migration** (A2 holds). The domain change is one line and its test.

## Q5. The line layer today

**How a relationship line is built.**
- `buildLines` (`src/canvas/line-data.ts`) makes a `RelLineData` per relationship whose two entity cards are on the canvas. Parallel relationships per card pair get `offset` 0, 16, 32 … (key `[from, to].sort()`).
- `bundleLines` (`line-geometry.ts`) keeps a line when neither end is in a collapsed frame. It drops it when both ends are in the same collapsed frame (`fa && fa === fz`). Otherwise it bundles it. Layer `mappings` drops all relationships.
- `RelPath` (`LineLayer.tsx`) calls `relGeom(cardRect(a), cardRect(z), offset)` (`geometry.ts`).
  - Side to side (cards more than 24 px apart horizontally): from the facing edges at the header's middle (`HEAD_H / 2 + off`), with horizontal normals.
  - Otherwise top to bottom: from the middle of the facing top and bottom edges (`w / 2 + off`), with vertical normals.
  - One cubic Bézier; control distance `max(40, 0.4 × distance)`; `mid` is the point at t = 0.5.
- **End marks:** crow's foot `ieMarker(p, normal, min, max)`, a path plus a circle for an optional end; UML `umlMarker` places `multText` ("0..1", "0..*", "1", "1..*"). Drawn at every zoom (F6).
- **Label:** a pill (`rect` and `text`) at `mid`, when the label is set.
- **Hit target:** the same path, `.hit`, 12 px transparent stroke.

**DOM elements of one relationship line:**
- crow's foot: `g`, `path.hit`, `path.s`, `g` of marks, its `path`, and 0–2 `circle`s (one per optional end): **5–7**;
- UML: `g`, `path.hit`, `path.s`, `g` of marks, 2 `text`s: **6**;
- a label adds `g.rlab`, `rect`, `text`: **3 more**.

A loop drawn by `RelPath` has exactly these.

**The overlay's copy.** Lit lines (Focus, coverage) are drawn again by `LitLines` with `RelPath`, so by the same geometry. Hovered relationship lines are not in the overlay (F7). The line layer lies under the cards (`canvas.css`, "one layer under the cards").

**Both ends on one card today.** `relGeom(A, A)`: the side-to-side test fails, so it takes the top-to-bottom branch with `aTop = false`. It runs from the top edge's middle upwards and to the bottom edge's middle downwards. The curve is a vertical line through the card's middle, poking about 40 px out at the top and the bottom. It is under the card, so mostly hidden. The end marks sit at the top and bottom edges. No such row exists in any data file, since the domain refuses it.

**S2C-11's rule** is the `fa && fa === fz` line above. A self-relationship in a collapsed frame has `fa === fz` and is left out, as item 13 wants. No code.

**Where the loop fits.** A branch at the top of `relGeom`, or a `loopGeom` beside it, when the two ends are one card:
- `pa` = right edge at the header's middle, normal (1, 0);
- `pb` = top edge, a fixed distance in from the right corner, normal (0, −1);
- control distance a fixed size plus `offset` (so the second loop nests outside the first);
- `mid` at t = 0.5, the outer point, where the label goes.

`ieMarker` and `umlMarker` take the two points and normals unchanged. `RelPath` passes whether `fromCardId === toCardId`. **Size:** about 20 lines in `geometry.ts`, the unit tests beside `line-geometry.test.ts`, one line in `RelPath`, one in `Overview.tsx` (F12).

## Q6. The self-relationship elsewhere

- **`swapRelationship`** writes `from_entity_id` and `to_entity_id` unchanged (the same id) and exchanges the four cardinality columns. One update, one change group. With equal ends it writes an empty change (F10).
- **The panel's title** is "{from} and {to}" (F8). **The breadcrumbs** have no selection crumb in the app. The line menu's heading is "{from} – {to}" (`canvas-host.tsx`); for a loop it reads "Employee – Employee".
- **History.** `placeOf` keeps `{ t: "rel", id }`. `showPlace` (`ModelCanvas.tsx`) checks the id among the relationships and never centres a relationship (D-38). `GONE.rel` is "That relationship no longer exists." Nothing depends on the two entities. **No change in `SelectionHistory.tsx`.**
- **The impact preview** (`src/domain/model/impact.ts`, `entityImpact`): `from === id || to === id`, so **once**. The delete (`entity.ts`, `deleteEntity`) soft-deletes the same list, so once too, and undo restores it with the entity.
- **The working context** (`contextTargets`, `src/domain/model/live.ts`): a relationship adds `entity:{from}` and `entity:{to}` to a Map, so the entity is labeled **once**.
- **Live canvases.** `buildLines` needs only the entity's card, context card or not. The loop is drawn as on any canvas. Creating it on a live canvas labels nothing unless the working context is on (D-26); D-11 is about cards.
- **Focus** (`src/domain/model/lit.ts`): `entityLit` and the `relationship` case add to Sets, so no doubles. Focus on another entity B does not light A's loop. If A is related to B, A's card is lit but its loop is faded: the veil's hole is the card's rectangle and the loop lies outside it. That is what item 13 says.
- **Requirement scope** (`containsTest`): a relationship is in a scope when either entity is. Unchanged.
- **The Changes view** lights no relationships (`touched.ts`). Unchanged.
- **The bundle panel** (`bundle-panel.tsx`) lists bundled relationships; a loop is never bundled. Unchanged.
- **The entity panel's list of relationships** (`entity-panel.tsx`) filters with `||`, so once: "Employee manages Employee".

## Q7. The card header's menu

- **The menu** is `cardItems` in `canvas-host.tsx`. For an entity with `editable`: "Show its sources", "Draw a relationship from here", Rows, Collapse or Expand, "Fit width to names", "Add a note to this", "Put in a new concept frame", Focus, a separator, "Remove from this canvas", "Delete from model…".
- **Proposal:** "Relate to itself" right after "Draw a relationship from here".
- **Role and archive.** `editable` is the page's `shell.standing === "full"` (owners, admins and modelers, not archived). Reviewers and readers get the other branch (note and Focus only). The server refuses through `model.edit` (`createRelationship`, `begin`).
- **Live canvases.** "Draw a relationship from here" and the relate button are offered on live canvases too (no `!live` guard). So "Relate to itself" is offered there as well, as item 8 says.
- **The action** calls `createRelationshipAction` with the same entity twice. It needs the new ends, so either the action takes optional ends or a new `createSelfRelationship` command sets 0..1 → 0..n. Proposal: `createRelationship` sets those ends itself when the two ids are equal. One command, one rule, one test.

## Q8. The measurement

**The `--only` keys** (`scripts/measure-canvas.ts`, `CRITERIA`) that cover the line layer:
- `pan`: S1A-14, pan and zoom on "100 cards" with its 40 relationships, C-08 untraced;
- `c08`: S4P-10, the first render, traced;
- `c10`: S1B-10, the hover (mapping rows in the overlay);
- `fading`: S4P-fading, branch-only with `--only`;
- `drags`: S2A-14's drags, which redraw the line layer on every node change.

`lasso`, `colours`, `c09` and the `s4b2…` keys do not depend on relationship lines. Without loops in the seed, item 1 and the loop do not change what these draw. Proposal: `--only pan,c08` (F17).

**Twenty loops and twenty ordinary relationships on a copy.** The measuring server reseeds the e2e file (`playwright.config.ts`: `npm run reset-dev-data` with `INFOMAPPER_DEV_DB` = the e2e file), never `.data/dev-db.json`. `S4B2-15-layers.spec.ts` already writes rows into that file before the page opens. Proposal: the measuring spec does the same.
- **Ordinary:** 20 relationships between pairs of entity cards in the measured view.
- **Loops:** 20 self-relationships on the same entities.
- **Two variants of the same file,** one per run.

No `seed:large` option, so the seed and `LARGE_IDS` stay as they are (A4).

**LayerTree.** Reuse `layers()` from `S4B2-15-layers.spec.ts` (copy it, as slice 4b-2 did): loops in view against the same view with ordinary relationships, and against none.

**The element guard's baseline.** `.data/measure/s9-14-baseline/slice-08.json` exists. Slice 9's closing found the counts equal to it, page totals too (`slice-09-acceptance.md`, S9-14). Proposal: use it as `slice-09`'s baseline and say so, rather than build the `slice-09` tag again. Question 8.

**New specs in the measurement build** go into `playwright.config.ts`'s `testIgnore` list for non-production runs (e.g. `**/S10A-12*.spec.ts`).

## Q9. Earlier tests and docs

**Tests that change:**
- `src/domain/commands/relationship.test.ts`: the refusal test becomes the self-relationship's acceptance (ends 0..1 → 0..n), plus F10's test.
- `src/ui/row-saves.test.ts`: Q2's cases; `not_found` cuts (F5).
- `src/canvas/line-geometry.test.ts` or a new `geometry` test: the loop's points and normals, nesting by `offset`, `mid`.

**Specs to run again after step 2** (they use the actions that move onto the chain):
- slice 1b: S1B-07, S1B-08, S1B-12, S1B-13, S1B-14;
- slice 2a: S2A-11, S2A-13; slice 2b: S2B-03; slice 2c: S2C-06;
- slice 3b: S3B-03, S3B-04, S3B-08, S3B-09;
- slice 4a: S4A-08, S4A-13, S4A-14; 4b-1: S4B1-05, S4B1-06; 5a: S5A-04; 6b: S6B-02-focus, S6B-06; 7b: S7B-13;
- slice 9: S9-03, S9-04, S9-05; slice 0: S0-08.

P3's full run after step 2 covers the rest. None of these should change. Any that does is listed with the reason (S10A-13).

- **No e2e spec tests the same-entity refusal today.** S1B-06 relates two entities and is unchanged.
- **Docs:**
  - `known-limitations.md`: "Writes started from the canvas are not on a row's save chain" closes. A new short entry lists F1's "later" writes.
  - `ideas.md`: the two entries the PRD names.
  - The inventory: no line on relationships today beyond sources. It gets the self-relationship as a deliberate difference.
  - README and CLAUDE.md: as section 10 says.

**`e2e/slice-10a/`.** Nothing speaks against it. No config, script or rule parses slice folder names. Slice 4b-1's `e2e/slice-04b1/` with `S4B1-…` ids is the same pattern.

## Items, decisions and criteria checked

| Item or decision | Result |
| --- | --- |
| P1, P2 | Łukasz's; nothing in the code against them. |
| P3 | Agreed: the actions are used by many earlier specs (Q9). |
| P4 | Confirmed, with F1's list and F2's writes without a version. |
| P5 | Agreed. A real conflict stays refused: the domain's `current()` check is untouched. |
| Items 1 a–e | Names confirmed. Corrections: split returns no version (F16); delete returns `null`. |
| Item 1 f, 2 | F3, Q2: `saveRows`. |
| Item 1 g | F1 and F2. |
| Item 3 | Confirmed: `revalidatePath("/", "layout")` in `modelCommand`; `mergeFresh` covers cards, frames and notes. |
| Items 4, 5 | Hold through `saveRow`; F5 for the save behind a delete. |
| Item 6 | F4. |
| Item 7 | Confirmed, except D-05's drop and the siblings, which write existing rows (F2). |
| Item 8 | Q7; F13 (opening the panel). |
| Item 9 | One `toast` in `relate`. |
| Item 10 | Q4: one line, no migration. |
| Item 11 | F6, F11. |
| Item 12 | F7. |
| Item 13 | Confirmed: layers and S2C-11 by `bundleLines`, Focus by `lit.ts`. |
| Item 14 | F8, F9, F10. |
| Item 15 | Confirmed (Q6). |
| Item 16, A4 | Q8. |
| D-61 | Text holds with F9's end names; "loses its end dots" does not occur. |
| AD-24 addition | After step 5. |
| A1, A2, A3 | Confirmed. |
| S10A-01, -02 | Possible as written. Right-clicking a line selects it, which leaves the panel field and saves it. |
| S10A-03 | Possible after `saveRows`. |
| S10A-04 | Add "Delete from model…" and merge (F1). |
| S10A-05 | As written. |
| S10A-06 | Would pass today through Next.js's order (F4); keep it, plus the unit test. |
| S10A-07 | Add: the details panel opens when hidden (F13). |
| S10A-08 | Replace "Below 40 % no end dots" (F6). |
| S10A-09, -11 | As written. |
| S10A-10 | Title "{entity} and {entity}" (F8); the end labels (F9). |
| S10A-12 | Q8; reduced A/B (F17). |
| S10A-13 | As written. |

## Differences between the prototype and the app that the slice touches

| Place | Prototype | App today | After 10a |
| --- | --- | --- | --- |
| A relationship to the same entity | `createRel` refuses: "Pick a different entity to relate to." | the same, in the host and the domain | allowed through "Relate to itself" (D-61) |
| A new relationship's ends | 1..1 → 0..N | 1..1 → 0..n | the same; a self-relationship 0..1 → 0..n |
| The panel's title | "{from} and {to}" (`insRel`) | the same | the same (F8) |
| The ends' field labels | "At the {from} end", "At the {to} end" | the same | for a self-relationship, "At the parent end", "At the child end" (F9) |
| The relationship's name elsewhere | the breadcrumb "{from} – {to}" | no selection crumb; the line menu's heading "{from} – {to}" | the same |
| Swap | exchanges the entities and the cardinalities | the same | on a self-relationship, the cardinalities only; refused when nothing changes (F10) |
| A line to a collapsed frame | hidden (`relGeom` returns null for `A.fr`) | bundled (slice 2c, D-07) | the same; a loop inside a collapsed frame is left out |
| The hover | CSS | CSS for relationships; mappings in the overlay | the same |
| End marks below 40 % | drawn | drawn | drawn (F6) |
| Versions and the save chain | none | panels on the chain (slice 9) | canvas actions too |

## New user-visible texts (proposals)

| Where | Text |
| --- | --- |
| Card header's menu | "Relate to itself" |
| Toast, the relate button released on its own card | "Pick a different entity, or use “Relate to itself” in the card's menu." |
| Toast after "Relate to itself" | "Relationship added. Name it and set the cardinality on the right." (unchanged) |
| Relationship panel, a self-relationship's ends | "At the parent end", "At the child end" (F9) |
| Swap with equal ends | "Nothing to change." (the domain's existing text, F10) |

Nothing else new: the chain's refusals reuse the domain's messages.

## Questions for Łukasz

1. **F1:** in 10a, join the six writes plus merge, "Delete from model…", "Mark as needed", the table's delete and the label's delete? And leave the classification list, the concept dialog, archive and the canvas tab and menu for later, with a line in `known-limitations.md`?
2. **F2:** should writes that bump a row without its version return the versions they wrote, opt-in per action (D-05's drop, a move, split, merge, the change-to-resolve actions)? The alternative is to leave them until the page refreshes.
3. **F3 / Q2:** build `rowSaves.saveRows` as sketched?
4. **F5:** should `not_found` cut the saves waiting behind it, for the panels too?
5. **F8:** keep the panel's title "{entity} and {entity}", as the prototype and the app have it, instead of "{entity} – {entity}"?
6. **F9:** "At the parent end" and "At the child end" on a self-relationship?
7. **F13:** should "Relate to itself" open a hidden details panel? The relate button would stay as it is.
8. **F17 / Q8:** a short A/B (`--only pan,c08`, two balanced rounds after a warm-up), and `slice-08.json` as `slice-09`'s element baseline?
9. **F10:** refuse a swap that changes nothing?
