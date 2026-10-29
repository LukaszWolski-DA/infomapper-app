# Slice 10a – acceptance

Status: **step 1 answered (29 October 2026); step 2a next.** Łukasz's answers are at the end of this file.

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

## Łukasz's answers (29 October 2026)

**F1. Wider than proposed.** The rule: a write off the chain joins it when it writes a row that a field already on the chain also writes. In 10a:
- the six from `known-limitations.md`;
- merge, "Delete from model…", "Mark as needed", deleting a source table, deleting a working label;
- removing and restoring a classification (its rename is on the chain), deleting a concept (its rename is on the chain), archiving and unarchiving the workspace (the settings form is on the chain).

Renaming and deleting a canvas wait, because the canvas tab's rename is not on the chain either. They become one line in `known-limitations.md`.

**What the added writes cost beyond wrapping them in `saveRow`** (checked before building, as asked):

| Write | Row | Beyond the wrap |
| --- | --- | --- |
| Merge (`mapping-panel.tsx`, `merge`) | the mapping and the chosen others | several rows: `saveRows`; `mergeMappingsAction` returns `{ mappingId }` and gains the versions |
| "Delete from model…" (`delete-entity-dialog.tsx`) | entity | nothing: the cascade deletes the other rows, and their saves are cut by "not found" (F5) |
| "Mark as needed" (`source-panels.tsx`) | source column (the note is on that row: `SourceNote` gets `c.version`) | `markColumnNeededAction` returns `{ name }`; it gains the version, so a note typed right after is not refused |
| Delete a source table (`source-panels.tsx`, `remove`) | source table (the table's note is on that row) | nothing |
| Delete a working label (`label-panel.tsx`) | label | nothing |
| Remove a classification (`classifications.tsx`) | classification | nothing |
| Restore a classification (same) | classification | `restoreClassificationAction` returns `{ name }`; it gains the version, so a rename right after is not refused |
| Delete a concept (`delete-concept-dialog.tsx`) | concept; **with "move to" it rewrites every entity of the concept unchecked** (`deleteConceptAction` → `{ movedEntities }`) | **the one that costs more:** `saveRows` with the concept checked and its entities held, and the entities' versions returned. The entities are known before it is sent (the concept's entities in the page's model) |
| Archive, unarchive (`lifecycle.tsx`) | workspace; the settings form already saves it with the row id `workspaceId` | the archive box reads `version` from the page, the settings form from its own state; on the chain both send the newest. Unarchive must return its version, so the settings form's next save is not refused. After archiving, the settings saves are refused as "archived" anyway |

**F2. Yes, opt-in per action.** Where an action knows its rows before it is sent, it uses `saveRows` (F3). Where it does not, it returns the versions it wrote and they go to `rowSaves.answer`.

| Group | Actions |
| --- | --- |
| **One row, `saveRow`**, the answer's `version` | mapping status, split, add to mapping (D-48), delete mapping; swap, delete relationship; delete attribute; "move to the frame's concept"; "Delete from model…"; "Mark as needed"; delete a source table; delete a label; remove, restore a classification; archive, unarchive. Split, "Mark as needed", restore and unarchive start returning `version` (F16 and above) |
| **Several rows known before, `saveRows`**, the answer's `versions` | moving an attribute (the moved one checked, the entity's other attributes held); merge (all chosen mappings checked); deleting a concept with "move to" (the concept checked, its entities held); D-05's drop into another concept's frame (the entities asked about, held only, since the drop sends no entity version; called from `src/canvas`) |
| **Rows not known before, `versions` to `rowSaves.answer`** | the change-to-resolve actions (retire, move, delete, map, not needed, decide column by column, approve again, leave in review, acknowledge, approve again all): the server decides which tables, columns and mappings it writes. Their change row has no panel field, so they send its version as today |

**F3. Yes**, `rowSaves.saveRows` as sketched, with `save` as its one-row case. A cutting refusal of a several-row save (stale version, permission, archive, not found) cuts the waiting saves of **every row it lists**, with one toast. This replaces the sketch's "only the checked rows". Unit tests:
- holding all rows;
- the order against a one-row save started meanwhile;
- the versions fed back;
- a cut across rows;
- `exclusive` (undo) waiting for it.

**F4.** Item 6 is corrected. A unit test is added that fails without the chain.

**F5. Yes:** "not found" also cuts the saves waiting behind it, in the panels too.

**F6.** Item 11 and S10A-08 are corrected: relationship lines keep their end marks at every zoom. The "below 40 %" line is dropped.

**F8.** Keep "{entity} and {entity}", as the prototype. Item 14, S10A-10 and section 8 are corrected.

**F9. Not "parent" and "child":** swap exchanges the ends' cardinalities, so after a swap "parent end" would show 0..n. For a self-relationship the two fields are named after the loop's drawing: **"At the right end"** (from) and **"At the top end"** (to). Step 4 checks that the loop is drawn with from on the right edge and to on the top edge (Q5's sketch does: `pa`, the from end, on the right edge; `pb`, the to end, on the top edge). If the geometry makes another pairing more natural, step 4 proposes it with the screenshots.

**F10. The clarification.** `swapRelationship` exchanges both entity ids **and** the four cardinality columns (`relationship.ts`). On a self-relationship the ids are the same, so swap already exchanges only the cardinalities, as D-61 says, at no cost. "Equal ends" in F10 meant **equal cardinalities at both ends of a self-relationship**: then the swapped row equals the old one. On a relationship between two entities, equal cardinalities still change the direction, so that swap is not refused. **Answer: yes,** refuse with the domain's "Nothing to change." when the swapped row equals the old one (in practice: a self-relationship with equal cardinalities).

**F12. Yes,** leave self-relationships out of the miniature.

**F13. Yes,** "Relate to itself" opens a hidden details panel (D-54: a menu item that leads to editing a field in the panel). The relate button stays as it is. "Relate opens the details panel" goes to `docs/ideas.md`.

**F14, F15, F16.** Accepted as written. A2 holds: no migration.

**F17. Yes:**
- the short A/B sitting (`--only pan,c08`);
- the loops added in the measuring spec to the e2e data file only;
- `slice-08.json` as the element baseline.

Kept as well, because they are the measurements that see the loop: the branch-only loop cost (20 loops against 20 ordinary relationships on the same cards) and the LayerTree read with 20 loops in view.

**F7 and F11** were not answered separately. They correct what the PRD says about the code (a hovered relationship line thickens by CSS; the loop is a branch in `relGeom`, nested by `offset`) and change no behaviour. The PRD takes them as written; say if not.

**Steps.** Step 2 is split:
- **2a:** the chain's mechanics (`saveRows`, the "not found" cut, the actions returning versions), with unit tests. Stop.
- **2b:** wiring the actions of F1, specs S10A-01 to S10A-06, and the full e2e run. Stop.

## Step 2a: the chain's mechanics (29 October 2026)

**What changed:**
- **`rowSaves.saveRows(rows, send)`** (`src/ui/row-saves.ts`):
  - a row with `shown` is checked (its newest version is sent); a row without is held;
  - it waits for every listed row's saves and any undo, and holds all of them until its answer;
  - it feeds back the answer's `versions` to every row, and `value.version` to the first checked row;
  - a cutting refusal cuts the waiting saves of every listed row;
  - it is not sent when a refusal before it cut one of its checked rows. A held row's cut does not stop it, because its version is not sent. This was not in the sketch; tell me if you want held rows to stop it too;
  - `save` is its one-row case.
- **"Not found" cuts** (`CUTS`), for the panels too (F5).
- **`useAction`** has `saveRows` beside `saveRow` (`use-action.ts`). Nothing calls it yet; that is 2b.
- **Versions from the server:**
  - `writtenVersions(writes)` (`src/domain/changes.ts`): undo's version map, moved into the domain and shared;
  - `runCommand`'s option `versions` puts them on the answer (`ActionResult.versions`), the settled changes' and the live step's writes included;
  - the wrappers `modelCommand`, `mappingCommand` and `onCanvas` (`frame.ts`) pass the option through.
- **The actions:**

  | Action | Now returns |
  | --- | --- |
  | `reorderAttributeAction` | `versions` (the moved attribute and its renumbered siblings) |
  | `mergeMappingsAction` | `versions` |
  | `deleteConceptAction` | `versions` (with "move to", the moved entities) |
  | the change-to-resolve actions (`changeCommand`: retire, move, delete, map, not needed, decide column by column, approve again, leave in review, acknowledge, approve again all) | `versions` |
  | `placeCardAction`, `moveOnCanvasAction` | `versions`, only with `moveToConcepts` (D-05), so an ordinary drag answers as before |
  | `splitMappingAction` | `Saved`: the kept mapping's version |
  | `markColumnNeededAction` | `Saved`: the column's version |
  | `restoreClassificationAction` | `Saved`: the classification's version |
  | `archiveWorkspaceAction`, `unarchiveWorkspaceAction` | `Saved`: the workspace's version (both, so the archive box answers as one row) |

- **`docs/known-limitations.md`:** "Writes still off the save chain (slice 10a)", with the canvas's rename and delete and the change-to-resolve actions (Łukasz's answer).

**Unit tests:**
- `src/ui/row-saves.test.ts`: the "not found" cut; and for `saveRows`:
  - it waits for a listed row's save on its way;
  - it holds every row (a one-row save started meanwhile waits and sends the returned version);
  - the versions fed back;
  - a cut across rows, held ones included, other rows going on;
  - a checked row's earlier cut stops it, a held row's does not;
  - a validation refusal cuts nothing;
  - an undo waits for it;
  - a one-row `saveRows` is `save`;
  - an unchecked row's version is refused.
- F4's test: an undo does not wait for a write outside the chain and does wait for the same write on it. Its first half is today's canvas actions.
- `changes.test.ts`: `writtenVersions`. `attribute.test.ts`: a move writes versions of the moved attribute and every renumbered sibling. `concept.test.ts`: deleting with "move to" writes the entities' versions.

**Checks:**
- `npm run lint`, `npm run typecheck`: pass. `npm test`: 108 files, 1,407 tests, pass.
- `row-saves.test.ts` three times on its own: 17 of 17 each time. One test had failed once while I was writing it: it expected two different rows' saves in a fixed order, which the chain does not promise. It now compares them as a set.
- S9-01 to S9-05 and S0-08 (dev server, from scratch, none of mine running): **17 passed, 152 s**. The server log showed "The destination stream closed early" five times, the known line; no test failed.

**Łukasz's answer to step 2a (29 October 2026): held rows.** Kept as built. A cut on a held row does not stop a several-row save; only a cut on a checked row does. The reason: a held row's version is not sent, and the server reads it as it stands, so the save cannot overwrite anyone's change. The move (or a concept's "move to") is a separate intent of the person. This rule and its reason go into CLAUDE.md's "Saving in panels" at the closing.

## Step 2b: the writes on the chain (29 October 2026)

**Wiring, as the F1/F2 table says.** What the canvas shows still waits for the page's refresh (item 3); only the version sent changes.
- `saveRow`: from a mapping line's menu the status, split and delete; from a relationship line's menu the swap and delete (item 1 b, S10A-01); the canvas's attribute delete; "Add to mapping" (D-48, `map-column.tsx`); "Move to the frame's concept" (`frame-panel.tsx`); the entity's delete from the model; a source table's delete and "Mark as needed"; a working label's delete; a classification's remove and restore; archive and unarchive (`lifecycle.tsx`, the workspace's row).
- `saveRows`: an attribute's move (`move-attribute.ts`: the moved attribute checked, its siblings held); a merge (every mapping checked); a concept's delete with "move to" (the concept checked, its entities held); the D-05 drop (`useFrames.ts`, `ModelCanvas.tsx`: the moved entities held, only with `moveToConcepts`).
- `rowSaves.answer`: the change-to-resolve actions, through `run`, which now feeds back every answer's `versions`.
- Canvas rename and delete stay off the chain (known-limitations.md, step 2a).

**One addition to step 2a's mechanics: `deletes`.** A save queued behind a delete that succeeded was still sent and toasted "This … does not exist." (F5's gap: the cut came only on a refusal). With `{ deletes: true }` a success cuts the checked rows' saves waiting behind it, without a toast. Every delete passes it (the panels' deletes too: relationship, attribute, requirement, mapping, entity, concept, table, label, classification). A cut delete shows no Undo toast (item 5); a delete that succeeds keeps it (S1B-13). Unit tests: the `deletes` cut, and an invalid refusal that cuts nothing. `npm test`: 108 files, 1,409 tests.

**Specs `e2e/slice-10a/`:** S10A-01 to S10A-06 (22 cases), named after the action. S10A-04 has one case per added write (12). Proof against step 2a's code (the wiring stashed): 16 of 22 fail. The 6 that pass there:
- S10A-03 "Ctrl+↓, then a sibling's name": the page's refresh came before the name was typed;
- S10A-03 "a sibling's name, then Ctrl+↑": the move does not send the siblings' versions, so it was never refused;
- S10A-04 delete from model, delete a source table, delete a working label, archive: the steps in the browser take longer than the refresh;
- S10A-05's two real-conflict cases, which must pass both ways.

**Canvas commits (PRD section 6), a status from a mapping line's menu, `window.__imCanvasCommits`, development build:** before the wiring **4** (three runs out of three), after **4** (three out of three, and again in the full run). Equal. `S10A-commits.spec.ts` keeps the check.

**Earlier specs of the actions touched** (slices 1b, 2b, 2c, 7b, 7c and 9 with the others listed in Q9, and 10a): **204 passed, 1 skipped (S7C-14-commits, on demand), 0 failed, 1,972 s.** The first try failed in the global setup's warm-up, because the unit tests and the typecheck ran at the same time; run alone, it passed.

**CI:** `npm run lint` clean, `npm run typecheck` pass, `npm test` 1,409 tests pass.

**Full e2e run** (from scratch, no dev server of mine running, 18:31 to 19:49): **408 passed, 1 skipped, 2 failed, 4,646 s** (1 h 17 min), against slice 9's 4,148 s (+12 %). The run has 25 more tests (slice 10a's). Both failures timed out at sign-in (`bar-top` not shown within 15 s), with no slice 10a code on the path:
- `S7A-12`: an archived workspace offers no import;
- `S9-09`: a renaming and a description undone from a canvas.
Each file three times on its own: passed three times out of three (both files together: 1.1 min, 54 s, 52 s). Flakes, not bugs. The server log showed the known "The destination stream closed early".

**New or changed user-visible texts:** none. One text no longer appears: "This … does not exist." after a save that waited behind a successful delete.

## Łukasz's answers to step 2b (29 October 2026)

1. **Swap.** The list in step 2b's record was a slip: "Swap direction" is on a relationship line's menu (a mapping line has none), and it saves through `saveRow` (`canvas-host.tsx`, the relationship line's items; S10A-01's second case). The record above is corrected.
2. **The cases that pass without the wiring.**
   - S10A-05's two real-conflict cases must pass either way.
   - S10A-03 "a sibling's name, Enter, then at once Ctrl+↑ on another row" checks behaviour, not the fix: a move sends no sibling's version, so it was never refused, with or without the chain. It guards that the move and the name are both stored and the order kept.
   - The e2e setup has no way to delay a server action's answer or the page's refresh (no `page.route` on actions, no server-side delay), and none is built in this slice. These cases pass without the wiring because the page's refresh comes first; the fix in them is guarded by `src/ui/row-saves.test.ts` only:

     | Case | Unit test |
     | --- | --- |
     | S10A-03 "Ctrl+↓ on a row, then at once a sibling's name in its panel" | `RowSaves.saveRows` › "holds every row it lists: a one-row save started meanwhile waits for it and sends the version it returned" |
     | S10A-04 "delete from model (card menu), after the entity's name in its panel" | `RowSaves` › "sends a row's second save after the first one's answer, with the version it returned (S9-01's case)" |
     | S10A-04 "delete a source table (table panel), after the table's note" | the same |
     | S10A-04 "delete a working label (label panel), after its name" | the same |
     | S10A-04 "archive and unarchive (workspace home), after the workspace's name in the settings, then the name again" | the same (the archive answers `Saved`, its `value.version`), and `RowSaves` › "sends the version the page shows when it is newer than the last answer" for the name after it |
3. **`deletes`: agreed on 29 October 2026.** A delete that succeeds cuts the saves of its rows waiting behind it, with no toast (they would be refused as not found). It goes into CLAUDE.md's "Saving in panels" at the closing, with the held-rows rule.

## Step 3: the self-relationship in the domain and the panels (29 October 2026)

**Domain** (`src/domain/commands/relationship.ts`):
- `createRelationship` allows `from = to`. Its ends are then 0..1 → 0..n (`from_min` 0); between two entities they stay 1 → 0..n. One insert, one change event, so one undo step.
- `swapRelationship` refuses with "Nothing to change." when the swapped row equals the old one: a self-relationship with equal cardinalities at both ends (F10). Between two entities equal cardinalities still swap.
- No migration and no adapter change (Q4, A2).

**Unit tests** (`relationship.test.ts`): the refusal test became the acceptance test (ends 0..1 → 0..n, one insert and one event, refused to a reviewer and in an archived workspace); the unknown or deleted entities keep their own test; a self-relationship's swap exchanges only the cardinalities; the empty swap is refused, and the same ends between two entities still swap. `npm test`: 108 files, 1,412 tests.

**Canvas host** (`canvas-host.tsx`):
- "Relate to itself" in an entity card header's menu, right after "Draw a relationship from here", under the same `editable` (owners, admins, modelers, not archived; live canvases too, Q7). It selects the new relationship, opens a hidden details panel (`openDetails()`, F13) and shows the relate toast.
- The relate button on the same card: the new text (item 9).

**Panel** (`relationship-panel.tsx`): the title is "{entity} and {entity}" already (F8). On a self-relationship the end fields are "At the right end" (from) and "At the top end" (to); other relationships keep "At the {entity} end".

**Specs only, no code** (F14): the delete preview counts the self-relationship once; deleting the entity removes it and undo brings it back; the working context labels the entity once; history (D-38) selects it without moving the view.

**Specs `e2e/slice-10a/`:** S10A-07 (3 cases), S10A-10 (5), S10A-11 (3). Until step 4 draws the loop, they select the self-relationship from the entity panel's list of relationships. New helpers: `selfRelationship` (test data through the domain), `relationshipsOf`, and re-exports of slices 3b, 5a and 6b's. One fix while writing them: Ctrl+Shift+Z does nothing until the page shows a redo, so S10A-07 waits for `button-redo` (as S1B-12 does). S10A-07 then passed three times out of three on its own.

**Earlier specs:** S1A-10 (the delete preview), S1B-06, S1B-07, S1B-12, S1B-13, S1B-14 (relate, toolbox, undo, delete, reviewer), S3B-02, S3B-03 (working context), slices 6b, 9 and 10a: **85 passed, 0 failed, 675 s.** No earlier test changed.

**CI:** lint clean, typecheck pass, `npm test` 1,412 tests pass.

**New user-visible texts (for approval):**
- the menu item "Relate to itself";
- the relate button on the same card: "Pick a different entity, or use “Relate to itself” in the card's menu." (was "Pick a different entity to relate to.");
- the end fields on a self-relationship: "At the right end", "At the top end".

Reused, not new: the relate toast, "Nothing to change." (now also from the panel's swap), the panel title "{entity} and {entity}".

## Łukasz's answers to step 3 (29 October 2026)

- **Texts approved:** "Relate to itself"; "Pick a different entity, or use “Relate to itself” in the card's menu."; "At the right end" and "At the top end", on condition that step 4 draws the loop from the right edge (from) to the top edge (to). He confirms them finally with step 4's screenshots.
- **A correction to step 2b's answer 2:** the unit test named for the four cases guards the chain's mechanism, not that those actions use it. The wiring of delete from model, delete a source table, delete a working label and archive is guarded by review only. Nothing is built for it.

## Step 4: the loop (29 October 2026)

**Geometry** (`src/canvas/geometry.ts`, `loopGeom`, a branch of `relGeom` when both ends are one card):
- the from end leaves the right edge at the header's middle (27 px below the top), the to end comes back through the top edge 32 px left of the corner; normals (1, 0) and (0, −1), so `ieMarker` and `umlMarker` draw as on any line, at every zoom (F6);
- one cubic Bézier, its control points 128 px straight out of each end; the label at t = 0.5, the outer point, up and to the right of the corner;
- a further loop (`offset` 16, 32 … from `buildLines`, F11) moves both ends 16 px further from the corner, as parallel lines are spaced, and its control points 80 px further out, so its outer point lies 22 px further out on both axes: the loops nest and their labels (18 px high) do not overlap;
- on a collapsed card the from end stays on the card (at most 6 px above its bottom edge). With three or more loops on a collapsed card the from ends can come closer than 16 px; nothing else changes.
- Fixed in canvas units, so it zooms with the card, and it follows moves, widths and collapsing, since it reads the card's rectangle like any line.

A first try scaled each further loop about the corner; its ends came only 12 px apart, so the end marks and labels overlapped. The screenshots below are of the version described above.

**Drawing:** `RelPath` (`LineLayer.tsx`) passes `fromCardId === toCardId`, so the line layer, the overlay's lit lines (F7) and the hit target (`path.hit`, `pointer-events: stroke`) share the geometry. A click inside the loop's empty area selects nothing. The hover thickens it by CSS (`.lnk:hover .s`). The miniature (`Overview.tsx`) leaves self-relationships out (F12). Layers and collapsed frames need no code: `bundleLines` drops relationships in Mappings, and a line with both ends in one collapsed frame (`fa === fz`).

**Unit tests** (`src/canvas/loop-geometry.test.ts`, beside `line-geometry.test.ts`, 10 tests): the ends' points and directions, the right angles, the label outside the card, the curve outside the card, nesting (ends 16 px apart, outer points 22 px, every point further from the corner), a move, a width and a collapsed card, two cards unchanged, the collapsed-frame exclusion (no loop, no bundle counts it), and the layer modes. `npm test`: 109 files, 1,422 tests.

**Specs:**
- S10A-08 (5 cases): the ends on the right and the top edge at 100 % and 30 %, the marks of both notations, the label at the outer point; the miniature's line count unchanged; a click inside selects nothing, the hover thickens it, a click selects it, the menu offers swap and delete; two loops nest with their labels apart; a move, a width change and a collapsed card.
- S10A-09 (3 cases): Mappings hides it, Relationships and Everything show it; in a collapsed concept frame no loop and the bundle reads "1 relationship"; Focus on Customer lights it, Focus on Sales Order leaves it under the veil.
- S10A-07, -10 and -11 now select the loop on the canvas (`clickLine`, `LOOP_VIEW`); S10A-07 also checks that the new loop is drawn. One fix while writing S10A-08: the collapsed-card case waits for the drag and the width to be stored before collapsing the card as test data.
- All 19 cases of S10A-07 to S10A-11 pass.

**Earlier specs:** S1A-06 (notation), slice 1b, slice 2c, S3B-13 (the miniature's commits), slice 4b-1 and slice 10a: **105 passed, 0 failed, 854 s.** No earlier test changed.

**CI:** lint clean, typecheck pass, `npm test` 1,422 tests pass.

**A4:** no self-relationship in the demo seed or "Performance test"; the specs make them through the domain.

**Screenshots** (`docs/prd/slice-10a-screens/step-4/`, from `SCREENS=step-4 npx playwright test e2e/slice-10a/S10A-08-screens.spec.ts`, on "Customer & orders" with "refers" on Customer):

| File | What |
| --- | --- |
| `loop-ie-100.png`, `loop-uml-100.png` | crow's foot and UML at 100 % |
| `loop-ie-30.png`, `loop-uml-30.png` | the same at 30 % |
| `loop-collapsed-card.png` | Customer collapsed |
| `loops-nested.png` | "refers" and "replaces" nested |
| `loop-selected-panel.png` | the loop selected, its panel with "At the right end" and "At the top end" |
| `loop-focus-entity.png` | Focus on Customer: its loops and lines lit |
| `loop-focus-loop.png` | Focus on the loop: the loop and Customer lit, every other line and card faded (the other loop too) |

The drawing matches the condition on the field names: from on the right edge, to on the top edge.

**D-61, the final text proposed for approval:**

"An entity can be related to itself (a parent and its children). Owners, admins and modelers create it with “Relate to itself” in the card header's menu, in a workspace that is not archived, and its panel opens; the relate button clicked on the same card asks for a different entity and names that item. A new one has the ends 0..1 (the parent) and 0..n (the children). It is drawn as a loop at its card's top right corner: from the right edge at the header's middle to the top edge near the corner, meeting both edges at right angles, with both ends in the chosen notation at every zoom and the label at the loop's outer point. Further loops on one card nest outside it, their ends 16 px further from the corner. The loop follows the card's moves, width and collapsing; the miniature leaves it out. Its panel names the ends “At the right end” and “At the top end”. Inside a collapsed frame it is a line inside one frame: not drawn and not counted in a bundle. Swap exchanges its two ends' cardinalities, and is refused with “Nothing to change.” when they are equal. Otherwise it behaves as any relationship: label and cardinality in its panel, delete with Undo, layers (hidden in Mappings), Focus, a history place, counted once in an entity's delete preview."

Changed against the PRD's proposal: the loop's place and shape, the nesting, the label place and what the loop follows are written out; "refused" names its text; "layers" says Mappings hides it.

## Łukasz's answers to step 4 (29 October 2026)

- **D-61:** approved as quoted; written into `docs/decisions.md`, accepted on 29 October 2026 (slice 10a).
- **Three or more loops on a collapsed card:** accepted; one entry in `docs/known-limitations.md`.
- **The loop's drawing:** approved on condition that two more screenshots show no problem (below).

### The two more screenshots

Both are in `docs/prd/slice-10a-screens/step-4/` (the second test of `S10A-08-screens.spec.ts`):
- `loop-in-frame.png`: Customer in a concept frame fitted to its cards ("Fit frame to its content"), with "refers";
- `loop-fit-view.png`: "Fit everything on screen" on "Customer & orders", Customer a topmost card with the loop.

**How far a loop reaches out of its card** (from the geometry, in canvas units): the first loop 50.6 px above the top edge and 49.6 px right of the right edge; the second 82.5 and 81.5; the third 114.3 and 113.3. Its label's pill lies inside that reach.

**The frame: a problem.** A frame is its cards' box plus 40 px at the top and 32 px at the sides (`FRAME_PADDING`, `frameAround`). The loop reaches 50.6 px up and 49.6 px right, so it crosses the frame's top border by about 11 px and its right border by about 18 px. The label "refers" sits on the right border. The frame's title is not crossed: it stands at the frame's left. A second loop reaches out of the frame by about 50 px.

**Fit everything: no problem in this screenshot, but one at higher zooms.** Here the fit is set by the canvas's height (46 %): the loop reaches about 23 px into the 40 px screen margin and is not cut. The fit's bounds are the cards' box (`contentBounds`), and the margin is 40 screen px (`fitViewport`). So the first loop is cut at the screen's edge when the fit zooms above 79 % (40 / 50.6), and a second loop above 48 %. A small canvas fits at up to 110 % (`FIT_MAX_ZOOM`), so a canvas with a few cards and a loop on its topmost or rightmost card shows the loop cut.

**The smallest fix proposed (nothing built):** the loop's reach joins the bounds.
- A card with self-relationships counts as its rectangle grown upwards and to the right by its outermost loop's reach (50.6 + 32 per further loop, rounded up to 8), in one function beside `loopGeom`.
- It is used in `contentBounds` (Fit everything, Zoom to frame), and in `frameAround` where a frame is sized by its cards: "Fit frame to its content" (`useFrames.ts`, `fitFrame`), a new frame around cards and "Arrange into frames" (`src/domain/commands/frame.ts`). The domain then needs the self-relationship count per card. The model is already in those commands' state, and the canvas has it in the lines.
- Membership does not change: it is decided by the middle of a card's header (D-05), not by the frame's size.
- Cost: about 20 lines, unit tests beside `loop-geometry.test.ts` and `frames.test.ts`, one spec case each in S10A-08. No data change, no change events beyond the frame's size the commands already write.

The other way is to accept both as known limitations.
