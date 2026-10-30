# Slice 10b – acceptance

Status: **step 1 answered (Łukasz, 30 October 2026; "Łukasz's answers" below); step 2 next.**

- Tag `slice-10a` and `origin/main` are at `82f8e0d`, as A1 says. The local `main` was still at `84ff767` (slice 9); it was not moved. Branch `slice/10b-source-relationship-lines` was made from the tag.
- The PRD is copied unchanged from `~/Downloads/slice-10b-source-relationship-lines.md` (19,340 bytes, 30 October 2026; the only file with that name). Commit "docs: slice 10b PRD".
- `.data/dev-db.json` (KB) was not touched. No seed or reset was run.

Step 1 checks every item, decision, assumption and criterion against the code, `docs/decisions.md` and the earlier slices' acceptance docs. It writes no application code. Nothing found needs a write, a stored setting or a new control.

## Summary

| # | Finding | Proposal |
| --- | --- | --- |
| F1 | **The canvas page already has the source relationships** (Q1). The page loads the whole model (`getDataStore().model.load`, `store.ts`: `sourceRelationships`, deleted rows left out by `live()`), and `buildLines` runs on the server in the canvas page (`page.tsx`). `ModelIndex` is the panels' index in the browser (`model-index.ts`, it has `relationshipsOf` since 7a), not the canvas's. The model is already in the page's payload twice (the inspector's `model`, the canvas's `fadeData`). | `buildLines` also returns the source lines. Nothing new is loaded. The payload grows by about 100 bytes per drawn line. C-08 is unchanged on "Performance test", which has none (F5). |
| F2 | **A line kind of its own, not a kind of relationship** (Q2). In `relationships`, a source relationship would reach everything that reads that array: the miniature, the bundles and their counts, Focus's `lit.relationships`, the Delete key (`selection.t === "rel"`), the line menu (`data-relationship` in `onContextMenu`), the relationship panel. | An optional third array `sources?: SourceLineData[]` in `CanvasLines` (`line-data.ts`): `{ id, fromCardId, toCardId, offset, missing? }`, offsets per card pair as `relationships` have them. Code that does not know the field leaves the lines out (F8, F18). Drawn by a small `SourcePath` in `LineLayer.tsx` (a group, its hit path, its path) that calls `relGeom` (and so the loop); `RelPath` stays as it is, the geometry is shared. Their own `<g>` first in the layer, so they paint below the other lines. The layer filter in `ModelCanvas.tsx` (the `lines` memo) hides them in Mappings and under `diag=nolines`. |
| F3 | **Every source line would vanish when any frame is collapsed.** The line layer gets `bundled ?? lines` (`ModelCanvas.tsx`), and `bundleLines` (`line-geometry.ts`) returns a new object with `mappings`, `relationships` and `bundles` only. | `bundleLines` passes `sources` through and leaves out those with an end in a collapsed frame. (The layer would skip them anyway, since `placedOf` is null for a hidden card, but the filter makes item 6 a unit test.) They never enter `add`, so no bundle and no count changes. |
| F4 | **The arrow can be one shared marker, with four conditions** (Q2). The app has no `<marker>` or `<defs>` today: each relationship draws its own marks (`ieMarker`, `umlMarker` in `geometry.ts`, one `mk` path in `RelPath`). A path from `relGeom` runs from the table with the key to the referenced table, the loop too (its to end is the top edge), so `marker-end` lands at the referenced table. The conditions: (a) the marker is drawn only while the canvas draws a source line, or every canvas gains its elements (F5); (b) `markerUnits="userSpaceOnUse"`, or the arrow grows with the hover and selection widths; (c) a marker does not take its line's state: on a selected mapping or relationship the layer dims the other lines (`.dimmed .lnk:not(.hl) .s`), and the arrowheads would stay at full strength; (d) its id is document-wide, so the lit copy in the overlay's own `<svg>` can use it. | A shared marker (marker and its path, two elements per canvas), plus a second, faded marker that the dimmed state picks by CSS (`marker-end` is a CSS property), unless `context-stroke` works in Chromium (step 2 checks it; then one marker). The alternative, one arrow path per line like the `mk` path, costs one element per line and takes every state from the existing CSS. Question 1. |
| F5 | **The element guard does not see the seeded lines** (Q3). `S3B-15-elements.spec.ts` counts only "Performance test" (`seedLargeData`), which has no source relationships (`seed-large.ts` writes none). The demo canvases are not in its four views. | The expected difference from `slice-08.json` is **zero in all four views**, given F4 (a). Item 12 and S10B-10: "no change in the element guard". Where the seeded line appears: Q3. |
| F6 | **Focus needs a little code** (Q6). Above the veil, `LitLines` draws again only the lines in `lit.mappings` and `lit.relationships` (`FadeLayer.tsx`, the domain's `lit.ts`). Everything else stays under the veil, so without code a source line always fades. Also, Focus on a table (`tableLit`) lights that table, its mappings and their entities, never another table: Focus on `order_line` alone never lights `order_header`. | `FadeLayer` gives `LitLines` the source lines whose two cards are lit (`isLitCard`), drawn by `SourcePath`. No domain change. A line is then lit by a Focus on both cards (a selection of several), a requirement whose scope has both tables, or an entity fed by both (none in the seed). S10B-07 is reworded (criteria table). The Changes view goes through the same `FadeLayer`, so it would light a line between two touched tables. Question 2. |
| F7 | **The click is a card's selection, with two corrections to S10B-06** (Q5). The line's `onClick` calls `select({ t: "card", id: fromCardId })`, as `RelPath` calls `select`. A card is a D-38 place already: no new place, no change to `SelectionHistory.tsx` or `GONE`, and the view does not move. (a) "Opens its panel": a selection never opens a hidden details panel (D-54, slice 5a). (b) Delete after the click acts on the selected card. On an ordinary canvas that does nothing, but on a live canvas an editor's Delete on a selected card asks to take its label off (D-11; `ModelCanvas.tsx`, the keydown handler, `removeLiveRef`). | (a) "shows its panel in the details panel; a hidden details panel stays hidden". (b) "Delete with the line hovered removes nothing; after a click, Delete acts on the selected card as on a card's click (on a live canvas, the label question)". Question 3. |
| F8 | **A right-click opens the canvas's toolbox.** `onContextMenu` (`CanvasModes.tsx`) looks for `data-note`, `data-mapping`, `data-relationship`, `data-bundle`, `data-card` and `data-frame`. The source line has none of these, so a right-click ends in `{ kind: "canvas" }` (the empty canvas's toolbox, and the selection is cleared). | Keep it: no line menu, no code. The line gets its own test id and data attribute (`line-source`, `data-source-relationship`), which no handler reads. Question 4. |
| F9 | **Hover needs no code.** `.lnk:hover .s` (`canvas.css`) thickens any line in the layer. The hover store holds only rows and mappings (`onHoverOver`), so `HoverLines` never draws a source line. | Item 7 holds as written. "Thinner": its own stroke width (e.g. 1.2 against 1.6); the hover's 2.6 applies as to every line. |
| F10 | **Relationships between entities are grey already.** `--im-rel` is `#556273` (dark mode `#95a2b2`). | A lighter grey from the palette, `--im-ink-3` (`#7c8998`, defined for dark mode too; about 3.5:1 on the canvas, above WCAG 1.4.11's 3:1). No new token. The arrow takes the same colour. |
| F11 | **Live canvases: as relationships** (Q5). `buildLines` gets every card of a live canvas, context cards included. Relationship lines are never faded there; only mappings that do not carry the label are (`liveMappings`, the `ctxline` class). | The same rule for source lines: drawn between any two table cards on a live canvas, context cards included, never faded. Item 10 holds. |
| F12 | **Missing and removed** (Q7). An import sets `missing_since` (`apply.ts`; `plan.ts`, `planRelationships`, item 32) when the file has the table with the key but no longer declares the key, or when either table is missing. "Back" clears it. Retiring (7b) does not touch relationships. Deleting a table takes its relationships in both directions, and deleting a column takes every relationship with a pair on it (`source-changes/delete.ts`, `sourceDeleteCascade`). Undoing an import soft-deletes the relationships it wrote. Deleted rows never reach the model (`live()` in `store.ts`). A missing relationship is not a `source_change` (`SOURCE_CHANGE_KINDS` has no relationship kind). | Nothing to add. A missing table whose card is still on the canvas keeps its dashed line. A deleted relationship is never drawn. The Changes view does not light a missing relationship (section 9 keeps it for later). |
| F13 | **The seeded line runs mostly behind two entity cards.** On "Customer & orders" (`DEMO_LAYOUT.customerOrders`): `ordline` at (1176, 600), `ordhdr` at (40, 584), Order at (496, 568), Line at (840, 568). The line runs side to side at header height, so it shows only in the three gaps. Its 12 px hit target takes clicks there. `emptySpot` skips it (it looks for the pane under the point), but a spec that clicks or lassos at a fixed point there may change. | Keep the seed (A4). Step 3's screenshots show it. Step 2 runs the earlier specs of both canvases with the line ("Customer & orders" and Sales' "First canvas") and lists any change with its reason (S10B-11). Question 5. |
| F14 | **A collapsed table card shares one point.** A mapping line from a hidden row ends at the header's middle on the card's side (`rowEnd`), and a side-to-side source line ends there too. | No change. The colour and the arrow tell them apart. |
| F15 | **Test data for S10B-02 and S10B-03 exists.** The HR sample `hr_snapshot_2026-10-20.csv` declares `FK_employees_manager` (`employees.manager_id` → `emp_id`), a real key to itself. | S10B-02 imports it and places the card (`place`). It adds a second key with a file in the standard (`fileOf`, slice 7c). S10B-03 re-imports the file without the key row. The samples are test-only (ESLint rule), which is allowed in e2e. |
| F16 | **No command writes a source relationship** (Q8). Only the import does. The A/B sitting (`pan` = S1A-14, `c08` = S4P-10) runs on "Performance test", which has none, so it shows only the cost of the empty path. No `measure:canvas` key covers source lines. | The lines' own cost in a branch-only spec, as `S10A-12-loops.spec.ts` does (`e2e/slice-10b/S10B-10-lines.spec.ts`). Its 20 relationships come from a write set built in the spec and applied through the local adapter (`store().apply`), with change events as the import writes them, in the e2e data file only (A4). The A/B sitting is short, as slice 10a's F17 was: `--only pan,c08`, `--rounds 2`, one discarded warm-up. Question 6. |
| F17 | **Earlier tests barely change** (Q9). With `sources` optional, every `CanvasLines` literal stays valid. The specs that count `line-relationship` or `line-mapping` stay, because the new line has its own test id. `S4B2-07` reads every `path.s` under points on "Customer & orders" and may see the new line; step 3 checks it. | Listed under Q9. `buildLines` tests are in `lines.test.ts`, not `line-geometry.test.ts`, which holds `bundleLines`'s tests. |
| F18 | **The miniature leaves them out with no code.** `Overview.tsx` draws `lines.relationships` (and mappings' pairs) only. | Item 11 holds. S10B-08's "the same with and without source relationships" becomes "the miniature draws its relationship lines as before and none for a source relationship". |
| F19 | **Names in the PRD.** `relGeom` and `loopGeom` are in `geometry.ts`, not `LineLayer.tsx`. `loopGeom` is private and is reached through `relGeom(A, A, off, true)`. `lit.ts` is `src/domain/model/lit.ts`. The canvas's "loader" is the canvas page (`src/app/w/[workspaceId]/p/[projectId]/c/[canvasId]/page.tsx`). | Confirmed as named: `RelPath`, `LitLines`, `HoverLines` (`LineLayer.tsx`); `buildLines`, `relatedLines` (`line-data.ts`); `bundleLines`, `bundleGeom` (`line-geometry.ts`); `Overview.tsx`; `S10A-12-loops.spec.ts`; `RelationshipLi` (`source-panels.tsx`); `line-geometry.test.ts`, `loop-geometry.test.ts`. |

## Q1. Data

- **Today:** yes. `model.load` returns `sourceRelationships` (live rows only), and the canvas page builds the lines on the server: `buildLines(model, cards, labelNames, liveMappings)`. `buildLines` reads only `model.relationships` and the mappings now.
- **The smallest way:** a loop in `buildLines` over `model.sourceRelationships`, kept where both `source_table_id` and `to_source_table_id` have a table card (`tableCard`, already built there). A key to itself has one card at both ends (as 10a's loop). The offset counter is the relationships' (`pairs`, key: the two card ids sorted), kept separately for source lines. The column pairs are not read.
- **Cost:** no new load and no new read. The page's payload grows by about 100 bytes per drawn line (none on "Performance test"). The loop is linear in the workspace's source relationships, on the server, once per page.

## Q2. Lines

- **Anchoring:** `relGeom(A, B, off)` (`geometry.ts`) works on two card rectangles (`cardRect`). Side to side when the cards are 24 px apart horizontally, at the header's middle plus `off`; otherwise top to bottom, at the middle plus `off`. With `self`, it draws 10a's loop. Table cards are cards like entity cards, so `relGeom` fits unchanged.
- **New line kind:** F2. It needs `SourcePath` (three elements: the group, the hit path, the path), not `RelPath`, because `RelPath` always draws end marks and a label. The geometry is not forked. The cache key in `LineLayer` follows the relationship's (`cardKey` of both cards; `placedSig` in the signature), so moves, widths, collapsed cards and row filters redraw it (item 9).
- **Markers:** none shared today; each line draws its own marks (F4).
- **The arrow as one `marker-end`:** yes, with F4's conditions. Question 1.
- **Dashed:** a class on the path (`.src.missing .s { stroke-dasharray: … }`), no element. Missing lines are few. Dashed curves cost raster: slice 4b-2 measured about 32 ms per Focus switch at 30 % for many dashed trace lines. A marker is not dashed by the line's dash array, so the arrow stays whole.

## Q3. The seed

| Relationship | Its two tables' cards | Drawn on |
| --- | --- | --- |
| `FK_order_line_order_header` (`ordline` → `ordhdr`) | both on `DEMO_LAYOUT.customerOrders` | "Customer & orders" (Retail DWH) and "First canvas" (Sales, the same layout) |
| `FK_customer_addresses_customers` (`addr` → `customers`) | `addr` has no card on any demo canvas | nowhere |

- "Order lines & products" has `ordline` and `items` only, so no line.
- **Per line:** three elements (the group, the hit path, the path). A relationship line has five to seven, and three more with a label.
- **Per canvas with a line:** the marker's two elements (four with F4's faded marker).
- **The element guard:** zero difference from `slice-08.json` in all four views (100 % and 30 %, frames expanded and collapsed), because "Performance test" has no source relationship (F5). That needs F4 (a): a marker drawn on every canvas would add its two elements to every view.

## Q4. Collapsed frames and bundles

- **Today:** `bundleLines` sends a relationship with neither end in a collapsed frame to `relationships`. It leaves out one with both ends in the same collapsed frame (`fa && fa === fz`), and bundles the rest per pair of ends (`r|…|…`).
- **The smallest rule:** F3. `bundleLines` passes `sources` with neither card in a collapsed frame and drops the rest. They never reach `add`, so no bundle, key or count changes.

## Q5. Selection and live canvases

- **A click on a line today:** the group's `onClick` calls `select({ t: "rel" | "map", id })`. For the source line it calls `select({ t: "card", id: fromCardId })` (F7).
- **No menu and no Delete:** the Delete key acts on `selection.t` `"map"` or `"rel"` only, and the source line never sets either. After the click, Delete is a card's Delete (F7 b). The right-click: F8.
- **Live canvases:** F11. A context card counts, as for relationships.

## Q6. Focus and the Changes view

- **`lit.ts`:** a Focus target becomes a `Lit` (`entities`, `tables`, `rows`, `mappings`, `relationships`). An entity's Focus lights its relationships and both their entities. A table's Focus lights the table and its columns' mappings with their ends. `FadeLayer` cuts the veil's holes at lit cards and draws the lit mappings and relationships again above it through `LitLines`.
- **Without code:** the source lines stay under the veil and always fade. With F6's few lines they are lit when both cards are lit.
- **Missing relationships:** not a `source_change` row (F12).
- **The Changes view:** its request (`ChangesDriver`, `touchedBy`) goes through the same `FadeLayer`. With F6, a source line is lit when both of its tables are touched, and faded otherwise. Keeping it always faded there would take a check per request kind. Question 2.

## Q7. Missing and removed

F12.

## Q8. The measurement

- **Test data:** F16. A write set in the spec through `store().apply`: one `source_relationship` and one `source_relationship_column` row each, with their change events. Twenty pairs of table cards in the view around `ent:23`, as S10A-12 picks its cards.
- **Against what:** 20 ordinary relationships between entity cards in the same view (the PRD's bar, within 2 %). The cards differ (tables against entities), so the view is chosen to hold 20 of each. Step 4 states the counts.
- **LayerTree:** as S10A-12's `layers(page)`, with none against 20.
- **`measure:canvas` keys:** `pan` (S1A-14) and `c08` (S4P-10) cover the line layer's pan, zoom and first render. Neither has a source line (F16).

## Q9. Earlier tests and docs

| Test | Change |
| --- | --- |
| `src/canvas/lines.test.ts` (`buildLines`) | new tests: source lines, both cards needed, offsets, a key to itself, `missing` |
| `src/canvas/line-geometry.test.ts` (`bundleLines`) | new tests: passed through, left out at a collapsed frame, no bundle, layer mode |
| `src/canvas/loop-geometry.test.ts` | none (`relGeom`'s loop reused) |
| slice 2c's bundle specs (S2C-*) | none expected; run in step 3 |
| element guard (`S3B-15-elements.spec.ts`) | none; zero difference (F5) |
| slice 7a's table panel specs | none (no panel change) |
| `S10A-12-loops.spec.ts` | none |
| `S4B2-07.spec.ts` | may see the new path on "Customer & orders"; checked in step 3 (F17) |
| specs that click by position on "Customer & orders" or Sales' "First canvas" | run in step 2 (F13) |

**Docs:** as the PRD's section 10, plus:
- `src/canvas/README.md`, if it lists the line kinds;
- `docs/known-limitations.md`, for F13 if Łukasz accepts it.

## Items, decisions and criteria checked

| What | Result |
| --- | --- |
| P1 | Held: no write, no setting, no control, no history place, no element per line beyond the line's own (F4). |
| P2 | Options A–H hold in the code, with F6 (Focus) and F7 (click) worded more exactly. |
| P3 | Confirmed: `relGeom(A, A, off, true)`, nesting by `offset` (F2). |
| P4, A2 | Confirmed: `source_relationship` and its columns as they are; no format change. |
| Item 1 | F1, Q1 (`ModelIndex` is not the canvas's; F19). |
| Item 2 | F2, F4, F10; parallel offsets as `buildLines` gives them. |
| Item 3 | Confirmed: the right edge is the from end (the table with the key), the top edge the to end (the arrow). |
| Item 4 | A class (Q2). |
| Item 5 | The `lines` memo in `ModelCanvas.tsx` (F2). |
| Item 6 | F3. |
| Item 7 | F7, F8, F9. "A click inside a loop's empty area selects nothing": confirmed, the hit path takes the stroke only (`pointer-events: stroke`), so the click goes to the pane. |
| Item 8 | F6. |
| Item 9 | Confirmed by the line layer's cache keys (Q2). |
| Item 10 | F11. |
| Item 11 | F18. |
| Item 12 | F5, F13. |
| D-01, D-22 | Layer mode per canvas, hidden in Mappings; notation is not read. |
| D-07, S2C-11 | F3. |
| D-11 | F7 (b), F11. |
| D-38 | No new place; the card's place (F7). |
| D-54 | F7 (a). |
| D-61 | Reused unchanged. |
| AD-24 | Rule 3 kept (same `<svg>`); rule 4 kept (no `opacity`; dashed and faded by stroke properties); no new drawing layer expected (step 4 reads it). |
| A1 | Confirmed (`82f8e0d`). |
| A3, A4 | Confirmed; F16 for the measuring data. |
| S10B-01 | As written, on "Customer & orders". |
| S10B-02, -03 | As written (F15). |
| S10B-04, -05, -09 | As written. |
| S10B-06 | "Opens its panel" and Delete reworded (F7). Right-click: the canvas's toolbox (F8). |
| S10B-07 | Reworded: "Focus on `order_line` alone fades the line (it never lights `order_header`); Focus on both cards lights it" (F6). |
| S10B-08 | Miniature wording (F18). |
| S10B-10 | Element guard: no change (F5); the lines' own cost branch-only (F16). |
| S10B-11 | As written. |

## Differences between the prototype and the app that the slice touches

| Place | Prototype | App today | After 10b |
| --- | --- | --- | --- |
| Source relationships on a canvas | not drawn; the review promises "Shown later as a grey line between the table cards on a canvas" | not drawn | a grey line with an arrow, a loop for a key to itself, dashed when missing (D-62) |
| The import review, a new relationship | "Shown later as a grey line between the table cards on a canvas" | no text (`review-step.tsx`; only "No longer declared in the source" for a missing one) | unchanged, unless Łukasz wants the text (question 7) |
| The table panel's "Relationships between source tables" (`sourceBody`) | "from cols → table", "→ here", "· missing" | the same (`RelationshipLi`) | unchanged |
| A missing relationship | the panel's "· missing" only | the same | also dashed on the canvas |

## New user-visible texts (proposals)

None needed. One optional text (question 7): in the import review, a new relationship could say "Drawn as a grey line between the table cards on a canvas", the prototype's sentence without "later".

## Questions for Łukasz

1. **The arrow (F4):** a shared marker, with a second faded marker for the dimmed state and drawn only when the canvas has a source line (recommended)? Or one arrow path per line?
2. **Focus and the Changes view (F6):** is a line lit only when both of its cards are lit, for Focus and the Changes view alike (recommended, no domain change)? That means Focus on one table fades its source lines. Or should Focus on a table also light its source relationships and the other tables (a change in `lit.ts`)?
3. **Click and Delete (F7):** a click shows the table's panel only where the details panel is shown, and Delete after the click is the card's Delete (the label question on a live canvas). Is that right?
4. **Right-click (F8):** the empty canvas's toolbox, with no code (recommended)? Or nothing at all?
5. **The demo canvas (F13):** keep the seed, with the line mostly behind Order and Line on "Customer & orders"?
6. **The measurement (F16):** 20 source relationships written through the local adapter in the spec only, and a short A/B sitting (`pan,c08`)?
7. **The review's text:** leave it empty for a new relationship, or "Drawn as a grey line between the table cards on a canvas"?
8. **Look (F9, F10):** `--im-ink-3`, 1.2 px wide (relationships 1.6)?

## Łukasz's answers (30 October 2026)

1. **The arrow (F4):** one arrow path per line, not a shared marker. It matches how relationships draw their own end marks, fades with its line and works above the Focus veil with no special cases. The cost of one element per line is accepted. Item 2, section 6 and D-62's text are corrected.
2. **Focus and the Changes view (F6):** a line is lit only when both of its cards are lit, in both. No domain change. S10B-07 has a case where both tables are lit (Focus on an entity whose mappings read both) and a case where only one is.
3. **Click and Delete (F7):** accepted. A click selects the table with the key; its panel shows only where the details panel is shown (D-54). Delete after the click is the card's own Delete (D-11 on a live canvas). S10B-06 is reworded.
4. **Right-click (F8):** the empty canvas's toolbox, no code.
5. **The seed (F13):** kept as it is (A4). The manual acceptance on KB shows the lines better.
6. **The measurement (F16):** 20 relationships written through the local adapter into the e2e data file, in the measuring spec only; the short A/B sitting (`pan`, `c08`), as in slice 10a. The lines' own cost is kept against 20 ordinary relationships.
7. **The import review:** no new text.
8. **The look (F9, F10):** `--im-ink-3`, 1.2 px. Łukasz confirms it with step 3's screenshots, in both notations and in dark mode (the app has one: `globals.css`, `prefers-color-scheme: dark`).
9. **F2, F3, F19:** accepted. F3 gets a unit test and a case in S10B-05 with an unrelated frame collapsed.

With one arrow path per line, a source line has four elements (the group, the hit path, the path, the arrow). The element guard's expected difference from `slice-08.json` stays zero in all four views (F5): "Performance test" has no source relationship.
