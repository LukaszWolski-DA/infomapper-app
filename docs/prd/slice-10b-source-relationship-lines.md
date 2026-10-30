# Slice 10b – Relationships between source tables as lines on the canvas

Status: **step 1 answered, 30 October 2026** (`docs/prd/slice-10b-acceptance.md`, "Łukasz's answers"; this PRD is updated where they change it). Branch `slice/10b-source-relationship-lines`, from `main` at tag `slice-10a` (`82f8e0d`, assumption A1). PRD file: `docs/prd/slice-10b-source-relationship-lines.md`; step 1 writes `docs/prd/slice-10b-acceptance.md`. Test regime: a small slice (CLAUDE.md, "Testing"), with one full e2e run at the closing. Step 1 checks this PRD against the code (CLAUDE.md, "How we work").

## 1. Why this slice

A source system's foreign keys come into InfoMapper with an import (slice 7a) and are listed only in the table panels ("Relationships between source tables"). The prototype's import review promised "Shown later as a grey line between the table cards on a canvas"; slice 7a left that out (`docs/ideas.md`, "Relationships between source tables as lines on the canvas"). Drawing them shows the source's structure next to the mappings: which tables join, and how.

**Source relationships are read-only.** They describe the source system as it is. The modeller never creates, edits or deletes one in InfoMapper; only an import adds one, marks it missing, or removes it (Łukasz, 30 October 2026). So this slice only draws. There is:
- no new write;
- no save chain;
- no undo;
- no role or archive rule;
- no line menu.

**Agreed with Łukasz on 30 October 2026:**

- **P1. Simplicity and minimal impact on the app** guide every choice below. Anything that adds a control, a stored setting, a history place or an element per line is left for later unless it is needed.
- **P2. D-62's options** A–H as proposed (section 10): a line between the table cards, an arrow at the referenced table and no cardinality marks, shown in the layers Everything and Relationships, a click selecting the table with the key, no label, missing relationships dashed, no line and no bundle when either card is in a collapsed frame, and the miniature leaving them out.
- **P3. The loop of slice 10a** (D-61, `loopGeom`) draws a table's key to itself (e.g. `employees.manager_id`).
- **P4. No data model change and no local data file format change.** `source_relationship` and `source_relationship_column` stay as they are.

## 2. Sources

**Prototype** (`docs/prototype/infomapper-prototype-with-sources.html`):

| Function or place | What it gives this slice |
| --- | --- |
| the import review (`r.status === "new" ? "Shown later as a grey line between the table cards on a canvas"`) | the promise this slice keeps: a grey line between table cards |
| `sourceBody` ("Relationships between source tables") | a relationship is listed on both tables' panels, "→ here" on the referenced one, "· missing" when it is missing; its columns as "from cols → table" |
| `srcRelations` (`FK_order_line_order_header`) | the data: from table and columns, to table and columns, `kind: "declared"`, `missingSince` |

The prototype draws no source relationship: every part of the drawing is D-62.

**Decisions:**
- **D-01, D-22:** layer mode per canvas, notation shared.
- **D-07, S2C-11:** collapsed frames, bundles, lines inside one frame left out.
- **D-11:** live canvases.
- **D-38:** history places.
- **D-61:** the loop.
- **AD-24:** canvas rules: rule 3, all lines in one SVG layer; the element guard; the LayerTree read.

**Data model:** `docs/data-model-v2.md`, section 5: `source_relationship` ("Shown in the table panels; not drawn on canvases"), `source_relationship_column`.

**Earlier slices:**
- **7a:** import of foreign keys, the table panels' section, the seed's two declared relationships `FK_order_line_order_header` and `FK_customer_addresses_customers`.
- **7b:** deleting a column or a table removes its relationships.
- **10a:** `relGeom`, `loopGeom`, `RelPath` in `LineLayer.tsx`, `buildLines`, `Overview.tsx`, `S10A-12-loops.spec.ts`.

## 3. What to build

The slice adds no new user-facing text, as far as this draft knows. Step 1 lists any it finds needed.

1. **The canvas gets the source relationships** of the tables whose cards it shows: each relationship's from table, to table and `missing_since`. Its column pairs are not needed for drawing.
   - The canvas page already loads them with the model; `buildLines` (on the server) returns them as a list of their own, `sources`, beside `mappings` and `relationships` (step 1, F1, F2).
2. **A line per source relationship** whose two table cards are both on the canvas as cards.
   - It is drawn in the existing line layer (AD-24 rule 3), with no new layer, by `SourcePath` (step 1, F2).
   - It is anchored like a relationship between entity cards (`relGeom`). It is not anchored on column rows.
   - **Its look:**
     - grey, thinner than a relationship between entities;
     - no cardinality marks in either notation;
     - the grey is `--im-ink-3`, 1.2 px wide (step 1, answer 8);
     - a small arrow at the referenced table's end;
     - no label.
   - **The arrow:** one arrow path per line, like a relationship's end marks: it fades with its line and is drawn again above the Focus veil (step 1, answer 1).
   - **Several relationships between the same two tables** are spaced as parallel relationships are (`buildLines`'s offsets).
3. **A table's key to itself** is drawn as slice 10a's loop: from the right edge (the table with the key) to the top edge (the referenced table, with the arrow). Several keys to itself on one table nest as loops do.
4. **A missing relationship** (`missing_since` set) is drawn dashed.
5. **Layers:** shown in Everything and Relationships, hidden in Mappings (D-22's layer mode, no new switch).
6. **Collapsed frames:** no line when either card is a member of a collapsed frame. A source relationship never joins a bundle and never changes a bundle's count. `bundleLines` keeps the list and leaves out those lines (step 1, F3).
7. **Interaction:**
   - **Hover** thickens the line by CSS, as other lines.
   - **A click on the stroke** selects the table with the key, as a click on its card does (its history place, D-38). Its panel shows where the details panel is shown; a hidden details panel stays hidden (D-54). It does not move the view.
   - **A click inside a loop's empty area** selects nothing.
   - **No line menu:** a right-click opens the empty canvas's toolbox (step 1, F8). No drag. Delete with the line hovered does nothing; after a click, Delete is the selected card's own Delete (on a live canvas, D-11's question).
   - Every role sees the same lines.
8. **Focus and the Changes view:** a line is lit when both of its cards are lit, and fades otherwise. `FadeLayer` gives these lines to `LitLines`; no domain change (step 1, F6, answer 2). Focus on one table lights no other table, so it fades that table's source lines.
9. **The line follows** card moves, width changes and collapsed cards, as any line does.
10. **Live canvases:** a line is drawn between two table cards that are both on the canvas, by the same rule (Q5).
11. **The miniature** leaves source relationships out.
12. **The seed is not changed.** It already has two declared relationships (slice 7a). `FK_order_line_order_header` appears on "Customer & orders" and Sales' "First canvas"; the other on no canvas. The element guard counts "Performance test", which has none: its counts do not change (step 1, F5).

## 4. Steps

Stop after each step with a short summary of what changed and how to check it. Wait for Łukasz before the next.

1. **Critical review** (section 7). Check every item, decision and criterion against the code, `docs/decisions.md` and the earlier slices' acceptance docs. Answer Q1–Q9 in `docs/prd/slice-10b-acceptance.md`. No application code. Stop.
2. **The lines** (items 1–6, 9, 11, 12). The data on the canvas, the line kind in `buildLines`, the look, the arrow, dashed missing, the loop, layers, collapsed frames, the miniature. Unit tests beside `line-geometry.test.ts`. Specs S10B-01 to S10B-05 and S10B-09. Stop.
3. **Interaction and screenshots** (items 7, 8, 10). Click, hover, Focus, live canvases. Specs S10B-06 to S10B-08. Then slice 2c's bundle specs, slice 4b-1's Focus specs, slice 7a's table panel specs and slice 10a's loop specs, then CI. Screenshots for D-62's drawing (section 10), and D-62's final text for approval. Stop.
4. **The measurement sitting** (section 6, S10B-10). Stop.
5. **Closing:** docs (section 10), one full e2e run, CI, the pull request, a backup of Łukasz's KB model, the manual acceptance scenario. Merge and tag `slice-10b` only on Łukasz's command.

## 5. Acceptance criteria

Tests in `e2e/slice-10b/`, one file per criterion, each from a fresh seed; unit tests next to the code.

| ID | Criterion |
| --- | --- |
| S10B-01 | **A line between two tables.** With the cards of `order_line` and `order_header` on a canvas, `FK_order_line_order_header` is drawn as a grey line between them (`--im-ink-3`, 1.2 px), with the arrow at `order_header`. It has no cardinality marks in crow's foot or UML, and no label. With one of the two cards removed from the canvas, there is no line. |
| S10B-02 | **A key to itself.** After an import with a key from `employees.manager_id` to `employees`, the table's card shows a loop from its right edge to its top edge, with the arrow at the top end. A second key to itself nests outside it. |
| S10B-03 | **A missing relationship.** After a re-import without the key, the line is dashed. The table panel still says "· missing". |
| S10B-04 | **Layers.** Everything and Relationships show the line; Mappings hides it. |
| S10B-05 | **Collapsed frames.** With either table's card in a collapsed frame there is no line, and no bundle's count changes. With an unrelated frame collapsed, the line is still drawn. |
| S10B-06 | **Clicks and hover.** A click on the line selects `order_line` without moving the view; its panel shows in the details panel, and a hidden details panel stays hidden. Back returns to what was selected before. A click inside a loop's empty area selects nothing. Hover thickens the line. A right-click opens the empty canvas's toolbox, not a line menu. Delete with the line hovered removes nothing; after a click, Delete is the card's own (nothing on an ordinary canvas). A reviewer sees the same lines. |
| S10B-07 | **Focus.** Focus on an entity whose mappings read both `order_line` and `order_header` lights the line. Focus on `order_line` alone lights only that table and fades the line. |
| S10B-08 | **Live canvases and the miniature.** On a live canvas with both table cards, the line is drawn, context cards included, and never faded. The miniature draws its relationship lines as before and none for a source relationship. |
| S10B-09 | **Following the card.** The line follows a card move, a width change and a collapsed card. |
| S10B-10 | **Performance** (section 6): the element guard's changes are exactly the seeded lines; no new drawing layer; the A/B sitting within its bars; the lines' own cost within its bar. |
| S10B-11 | CI and the runs of the test regime; changed earlier tests listed with the reason. |

**Definition of done (scenario for the manual acceptance, on Łukasz's model KB).** Back up `.data/dev-db.json` first (CLAUDE.md).

1. On a canvas of "Kanton Basel" with two source tables joined by a key in the source, check the grey line with the arrow at the referenced table.
2. Switch the layers, collapse the system's frame, and use Focus on one of the tables.
3. Click the line and check that the table with the key is selected.
4. If KB has a table with a key to itself, check its loop.

## 6. Performance

The lines are a new kind in the existing SVG line layer. Bars are proposals to confirm in step 1.

| What | How | Bar |
| --- | --- | --- |
| Viewport elements on a canvas page | `S3B-15-elements.spec.ts` with `ELEMENTS_BASELINE=.data/measure/s9-14-baseline/slice-08.json` (slice 9 and 10a matched it) | equal in all four views: "Performance test" has no source relationship (step 1, F5) |
| Drawing layers | the LayerTree read (as `S10A-12-loops.spec.ts`) on a copy of "Performance test" with 20 source relationships in view, against none | no drawing layer more |
| Pan and zoom, first render | `npm run measure:canvas -- --to-screen --only pan,c08 --no-build --against slice-10a`, one discarded warm-up run, then `--rounds 2`, balanced (a short sitting, as slice 10a's: it measures only the empty path) | within the sitting's run-to-run spread |
| The lines' own cost | on the branch only, the same view of a copy of "Performance test", pan and zoom as presented frames: 20 source relationships against 20 ordinary relationships on cards in the same view, written through the local adapter into the e2e data file in the measuring spec only (step 1, answer 6) | within 2 % |

**Nothing above the canvas reads layout during a commit** (CLAUDE.md): this slice adds no element above or beside the canvas.

**New elements on the canvas (AD-24):**
- Four elements per line: its group, one hit target, one visible path and one arrow path; no cardinality marks.
- The arrow is one path per line, like a relationship's end marks (step 1, answer 1).
- A dashed line is a CSS class, not an element.
- Lit lines in Focus are drawn in the overlay with the same geometry (`SourcePath`, `relGeom`).

**If a difference of a few milliseconds has to be judged,** compare phase traces, not medians (slice 6a).

## 7. Questions for step 1

**The rule (CLAUDE.md, "How we work"):** a PRD is a proposal to verify, not a specification; this one was written from the docs without reading the code. In step 1, check every item, decision and acceptance criterion against the code, `docs/decisions.md` and the earlier slices' acceptance docs. Write into `docs/prd/slice-10b-acceptance.md` where the PRD is wrong, contradicts the code or a decision, duplicates what the app already has, misses what the code needs, or costs more than it assumes (data, performance), each with the files and functions behind it and a proposal. List the differences between the reference prototype and the app that the slice touches. No application code in step 1; Łukasz answers before step 2.

- **Q1. Data.** Does the canvas page get source relationships today (`ModelIndex`, the canvas's loader)? If not, what is the smallest way to get them for the tables on the canvas? What does it cost in the page's data and in C-08?
- **Q2. Lines.** How `buildLines` and `relGeom` anchor a line between table cards, and whether a source relationship fits as a new line kind there, drawn by `RelPath`, without forking the code.
  - Does the line layer already have shared SVG marker definitions, or does each line draw its own marks (`ieMarker`, `umlMarker`)?
  - Can the arrow be one shared `marker-end`?
  - The dashed look as a class.
- **Q3. The seed.** On which demo canvases do both cards of `FK_order_line_order_header` or `FK_customer_addresses_customers` appear, in which of the element guard's views, and how many elements each line adds there. The expected difference from `slice-08.json`, per view.
- **Q4. Collapsed frames and bundles.** How `buildLines` decides a line inside one frame and a bundle, and the smallest rule that leaves source relationships out of both.
- **Q5. Selection and live canvases.**
  - What a click on a line does today, and how to make a click on this line select the table with the key (its card's selection, D-38's place).
  - That no line menu and no Delete reach it.
  - How live canvases draw lines between their cards (D-11), and whether a context card counts.
- **Q6. Focus and the Changes view.** How `lit.ts` lights lines between cards, and whether these lines follow it without new code. Whether a missing relationship is a `source_change` row, and whether the Changes view would light it. The PRD's proposal: nothing new there.
- **Q7. Missing and removed.** When an import sets `missing_since` on a relationship; what happens to the relationships of a missing or retired table or column; that deleted ones (slice 7b) are not drawn.
- **Q8. The measurement.** How to write 20 source relationships into a copy of "Performance test" in the measuring spec (as `S10A-12-loops.spec.ts`). Which `measure:canvas` keys cover the line layer.
- **Q9. Earlier tests and docs.** Specs and unit tests that change: `line-geometry.test.ts`, `loop-geometry.test.ts`, slice 2c's bundles, the element guard, slice 7a's table panels, `S10A-12-loops.spec.ts`. The docs to update.

## 8. Differences from the prototype (deliberate)

- Source relationships are drawn on canvases (D-62); the prototype only promised it.
- A key to itself is drawn as slice 10a's loop.
- A missing relationship is dashed; the prototype only marks it in the panel.

## 9. Left for later

- **A layer switch of their own** for source relationships, e.g. to see them in the Mappings layer while mapping. A key in `canvas.look`, a control above the canvas (`docs/ideas.md`, slice 7a's entry).
- **The key's name on hover**, as a tooltip: an element per line.
- **A click scrolling the table's panel** to "Relationships between source tables".
- **Lines anchored on the key's column rows** rather than on the cards.
- **Cardinality** derived from the key (many at the table with the key, one or optional by the columns' nullability). Not drawn now, because the source says nothing about uniqueness beyond the primary key.
- **Source relationships in bundles** of collapsed frames, with their own count.
- **The Changes view lighting** a missing relationship.
- **Slice 10c, 11, 12, 13:** as in `docs/ideas.md`, "The plan after slice 10a".

## 10. Decisions to accept, and docs in this PR

### D-62 (proposal) Relationships between source tables on the canvas

"A foreign key between source tables (from an import) is drawn on a canvas when the cards of both tables are on it: a grey line between the cards, lighter and thinner than a relationship between entities, with a small arrow at the referenced table (its own path, so it fades with the line) and no cardinality marks or label. A key from a table to itself is drawn as the loop of D-61. A relationship the source no longer declares is dashed. Source relationships are read-only: the line has no menu (a right-click opens the canvas's toolbox), and a click on it selects the table with the key, as a click on its card does. They show in the layers Everything and Relationships, are left out when either card is in a collapsed frame (never in a bundle), are lit under Focus and in the Changes view when both cards are lit, and the miniature leaves them out."

**Options chosen by Łukasz on 30 October 2026:**
- **A. Where it ends:** between the table cards, not on column rows.
- **B. End marks:** an arrow at the referenced table (one path per line), no cardinality.
- **C. Layers:** Everything and Relationships, no new switch.
- **D. A click:** selects the table with the key; no new history place.
- **E. Label:** none.
- **F. A missing relationship:** dashed.
- **G. Collapsed frames:** no line, no bundle.
- **H. The miniature:** left out.

The text is quoted for approval in step 3, with the screenshots.

### AD-24 (addition, proposal after step 4)

One sentence under rule 3, with the sitting's figures: the source relationship as a line kind in the same SVG layer, its elements per line, no new layer, its cost against ordinary relationships.

### Assumptions to confirm

- **A1.** The slice starts from `main` at tag `slice-10a` (`82f8e0d`).
- **A2.** No data model change and no new local data file format (P4).
- **A3.** Łukasz's test model KB stays local and is backed up before the manual acceptance. No upgrade runs.
- **A4.** The seed and "Performance test" are not changed. The measurement adds source relationships on a copy, in the measuring spec only.

### Docs in this PR

- **`docs/decisions.md`** (only with Łukasz's approval of the quoted texts, steps 3 and 4): D-62; AD-24's addition.
- **`docs/data-model-v2.md`,** section 5, `source_relationship`: "Shown in the table panels and drawn on canvases between the table cards (slice 10b, D-62)" instead of "not drawn on canvases".
- **`docs/inventory-prototype-vs-app.md`:** the deliberate differences of section 8.
- **`docs/ideas.md`:**
  - "Relationships between source tables as lines on the canvas" done;
  - section 9's entries added;
  - the plan updated (10b done).
- **`docs/known-limitations.md`:** anything step 1 to 4 finds and Łukasz accepts.
- **README and CLAUDE.md:**
  - the slice's status;
  - the line kinds in the line layer;
  - the new e2e helpers;
  - the element guard's command and the expected differences from `slice-08.json`.
