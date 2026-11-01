# Slice 12b – Thumbnails on the canvas tiles

Status: **step 2 answered** (Łukasz, 1 November 2026; `slice-12b-acceptance.md`, "Łukasz's answers to step 1" and "Łukasz's answers to step 2"). Branch `slice/12b-canvas-thumbnails`, from `main` at tag `slice-12a` (`98e107a`, assumption A1). PRD file: `docs/prd/slice-12b-canvas-thumbnails.md`; step 1 writes `docs/prd/slice-12b-acceptance.md`. Test regime: a small slice (CLAUDE.md, "Testing"), plus two measurement steps (the home's load before and after) and one full e2e run at the closing. Step 1 checks this PRD against the code (CLAUDE.md, "How we work").

This PRD was written from the docs at slice 12a's state (`CLAUDE.md`, `docs/decisions.md`, `docs/data-model-v2.md`, `docs/known-limitations.md`, `docs/ideas.md`, `docs/inventory-prototype-vs-app.md`, `slice-12a-acceptance.md`) and from the prototype's `thumb`, `renderHome` and `renderWsHome`, without reading the code.

## 1. Why this slice

D-29 promises canvas tiles with thumbnails on the project home. The app has shown an empty strip since slice 0 ("no thumbnails yet"). A thumbnail lets a modeller recognise a canvas before opening it, which matters once a project has more than a handful of canvases.

The idea has waited for one reason (`docs/ideas.md`, "Thumbnails on the project home's canvas tiles"): to draw a thumbnail the home has to read every canvas's layout, and nobody has measured what that costs. So this slice **measures the home's load first**, proposes bars from the figures, and only then builds.

**Agreed with Łukasz (the plan after slice 10a, and 1 November 2026):**

- **P1. Measure before building.** Step 2 measures the project home's load as it is today and the cost of the data a thumbnail needs, on the seed, on "Performance test" and on a project with many canvases. Łukasz approves the bars and the approach (P5) before step 3 builds anything.
- **P2. A thumbnail is a sketch of the canvas's layout, as in the prototype (`thumb`):**
  - frames as tinted rectangles in their colour; a collapsed frame as its block, with its cards not drawn;
  - entity cards as rounded rectangles in their concept's colour; table cards in the physical colour; a collapsed card as its header;
  - one straight line per source table and entity pair on the canvas joined by at least one mapping, in the mapping colour, from centre to centre; no line to a card in a collapsed frame, and the canvas's layer mode is ignored, as in the prototype (step 1, answer 4);
  - free notes in their paper colour as the canvas shows them: not while their frame is collapsed (`noteVisible`); resolved notes are drawn, as hiding them is a preference in the browser (D-21) (step 1, answer 5); pinned notes are not drawn;
  - requirement cards in the reserved violet;
  - no text, no relationship lines, no source relationship lines, no marks;
  - fitted into the tile's strip with a 6 % margin, keeping the proportions;
  - an empty canvas says "Empty canvas".
- **P3. Nothing on the canvas changes.** The thumbnail is drawn on the home pages only. AD-24 does not apply; S12B-11 checks the canvas page is unchanged. **A rule of the slice (step 1, F3):** nothing of the thumbnails or the frame count goes into `loadProjectView` or the canvas page; the home page computes them from what it already reads and passes them to the tiles. The one change in the canvas layer is moving the constant `NOTE_MINI` to `src/ui/` (answer 6), with no change to what the Overview draws; the step that does it runs S3B-13.
- **P4. No data model change and no new format of the local data file.** A thumbnail is computed from rows that exist (`canvas_item`, `frame`, `note`, the cards' entities and tables, their attribute and column counts, mappings, concept colours). No KB backup step before the closing's usual backup.

**Proposed, to confirm in step 1 and after step 2:**

- **P5. Computed when the page loads, on the server, as static SVG in the page's HTML.** No script, no layout read, no React Flow on the home. The SVG is rendered by a server component and handed to the (client) tile as a slot (step 1, F4); **Its form (step 2, answered):** one `<path>` per class and colour, whole numbers in a 400-unit space, as React elements (no `dangerouslySetInnerHTML`), rendered by a server component passed to the tile as a slot. It is fresh on every load, so a change on a canvas or an undo on the home (D-65) shows on the next draw of the home. **Fallback if step 2's figures miss the bars:** a stored thumbnail per canvas, written with the canvas's layout changes. That is a data model change and a new decision; it is not built in this slice without Łukasz's approval.
- **P6. Card heights follow the canvas's rules** (step 1, F5 and answer 1): `cardHeightOf` with the card's row filter (`src/domain/model/card-size.ts`), a live canvas's context cards through `liveMembership` (`labeled`), a collapsed card as its header; a collapsed frame's block is `blockHeight(members)` (280 wide). Widths are the card's stored width (default 256). A requirement card is always 230 × 94 (answer 2), a free note its width × 80 (its height is not stored). A unit test compares the heights with the canvas's `cardHeight(buildCards(…))` on the seed and on "Performance test".
- **P7. The frame count on a tile** ("{n} cards, {m} frames. Also in …", prototype), closing the known limitation "Canvas tiles have no frame count". The data is read for the thumbnail anyway.
- **P8. The workspace home's project tiles** show the thumbnail of the project's first canvas, as the prototype does (`renderWsHome`, `thumb(cs[0])`). It reads one canvas per project. **Alternative:** leave the workspace home without thumbnails (section 9). Step 2 measures both homes; Łukasz decides with the figures. **Accepted** (step 2).

## 2. Sources

**Prototype:** `thumb` (what is drawn, the bounds, the margin, the colours, "Empty canvas"), `renderHome` (the tile: `.th` 140 px high, the name, "{n} cards, {m} frames. Also in …"), `renderWsHome` (a project tile with its first canvas's thumbnail), `NOTE_MINI` (notes' paper colours), the CSS of `.tile` and `.th`.

**Decisions:**
- **D-03:** the Overview's miniature draws visible notes in their paper colour, under the cards.
- **D-04, D-07, D-20, D-37, D-41:** frames, collapsed frames as blocks, notes and pins, card width, requirement cards (reserved violet).
- **D-29:** the project home's canvas tiles with thumbnails.
- **D-65:** undo on the home pages (a fresh home after an undo).
- **AD-24:** the canvas rules; "nothing above the canvas reads layout during a commit" (CLAUDE.md), which the home follows as well.
- **AD-31:** the measurement-only production build.

**Data model:** `docs/data-model-v2.md` section 9 (`canvas`, `canvas_item`, `frame`), section 8 (`note`), section 4 (`concept.color`, entities, attributes), section 5 (tables, columns), section 6 (mappings).

**Earlier slices:**
- **0:** the tiles and their empty strip.
- **2b, 2c:** frames and collapsed frames (blocks).
- **3b:** the Overview's miniature and its commit counter.
- **4b-2:** requirement cards.
- **7b:** S7B-16, which measures "the home's load" (CLAUDE.md, the measuring commands); model consistency computed on each load of the home.
- **11:** the miniature keyed on what it draws (`drawnKey`).
- **12a:** the home pages drawn again after an undo; `loadProjectView`.

**Known limitations:** "Canvas tiles have no frame count"; "Model consistency is fresh on each load, not while the home is open"; "The project home's model consistency lists every mapping…".

## 3. What to build

Texts in quotes are proposals. The step that builds them lists every new user-facing text for approval.

### Measuring first (step 2)

1. **The home's load today,** in the measurement build (AD-31), for the project home and the workspace home:
   - the server's time to answer the page (the loader's own time, split if the code allows: the shell, the project view, model consistency);
   - the HTML's size;
   - first contentful paint and the largest contentful paint in the browser;
   - each as a median and p95 over a stated number of loads, after a discarded warm-up.
2. **On three data sets:**
   - the seed's project with "Customer & orders";
   - "Performance test" (`npm run seed:large`: 100 cards, labels and notes; a second canvas with 12 requirement cards);
   - a project with many canvases: the measuring spec copies "Performance test"'s canvas layout into **20 canvases** of a separate project, "Performance test – 20 canvases", in the "Performance test" workspace, in the e2e data file only (not the seed, never `.data/dev-db.json`; answer 8).
3. **The thumbnail's cost before building it:** a bench script (as `scripts/bench-*.ts`) that reads what P2 needs for every canvas of a project through the same repository calls the page would use and computes the shapes, on the three data sets; time and the SVG's size per canvas and per page.
4. **The proposal for Łukasz:** the figures, the bars for step 5 (proposal: the project home's server time and LCP at most +20 % and at most +50 ms on "Performance test", the 20-canvas project's at most +100 ms, the page's HTML growth stated in bytes), and P5 or its fallback.

### Thumbnails (steps 3 and 4, after the decision)

5. **One pure function** builds a canvas's thumbnail shapes from its data (P2, P6): a list of rectangles and lines with their colours, plus the bounds. It lives where the layer rules allow the home pages and a later Overview to share it (`domain` or `canvas` without React Flow; Q4). Unit tests for every rule in P2 and P6.
6. **The project home's tiles** draw it as SVG in the existing strip (`project-tiles.tsx`), server-rendered, with `preserveAspectRatio="xMidYMid meet"` and a viewBox from the bounds plus 6 %. Colours come from the palette's tokens (`--im-…`), so light and dark mode both work; concept colours are the stored `#RRGGBB`. The SVG is decorative (`aria-hidden`); the tile's name stays its accessible name.
7. **"Empty canvas"** in the strip when the canvas has nothing P2 draws.
8. **The tile's text:** "{n} cards, {m} frames. Also in …" with singular and plural as the prototype (P7); without frames as today.
9. **The workspace home's project tiles** (only if P8 is accepted after step 2): the strip shows the project's first canvas's thumbnail by the same function, in tab order; a project's tile without a canvas cannot happen (`removeCanvasFromProject`: "This project would have no canvas left."; step 1, F8).
10. **What is read.** The home reads what the thumbnails need in the same requests as today's page data, once per page load, never per tile in the browser. Deleted rows are never drawn: a card whose entity, table or requirement is deleted, a deleted frame or note. Live canvases (D-10) are drawn as any canvas, context cards included.
11. **Freshness.** The thumbnail is as fresh as the page: every load, and every redraw after a write or an undo on the home (D-65). Nothing is cached between loads.

### Unchanged

12. **Unchanged:** the canvas page and the canvas; the Overview's miniature (it is not rewritten to use item 5's function in this slice, Q4); the tiles' menus, "Also in", "Add to {project}", "New canvas"; the data model; roles (anyone who sees a home sees its thumbnails).

## 4. Steps

Stop after each step with a short summary of what changed and how to check it. Wait for Łukasz before the next. A new Claude Code session may start at a step's boundary, never inside a step; it starts by reading CLAUDE.md, this PRD and `slice-12b-acceptance.md`.

1. **Critical review** (section 7). Check every item, decision and criterion against the code, `docs/decisions.md` and the earlier slices' acceptance docs. Answer Q1–Q9 in `docs/prd/slice-12b-acceptance.md`, with the differences from the prototype the slice touches and every new text proposed. No application code. Stop.
2. **The measurement of today's load** (items 1–4): the measuring spec and the bench script, both outside the normal e2e run; the figures; the proposed bars and approach. No change to the application. Stop for Łukasz's decision on P5, P8 and the bars.
3. **The thumbnail function** (item 5) with its unit tests (including the heights against `buildCards`), the move of `NOTE_MINI` to `src/ui/` with S3B-13; the bench's draft replaced by the real function. CI. Stop.
4. **The tiles** (items 6–11): the project home, the frame count, the workspace home if P8 is accepted. Specs S12B-01 to S12B-09, the earlier specs of both home pages (slice 0, 2a, 9, 12a) and CI. Screenshots beside the prototype's tiles: the seed, "Performance test", an empty canvas, a collapsed frame, a live canvas, light and dark. Every new text listed. Right after the tiles: the thumbnails' bytes in the document and in the embedded RSC payload, and in a write's answer (a pin, a rename, Undo) on "Performance test" and the 20-canvas project; if they are there twice, a proposal before step 5. Stop.
5. **The measurement after** (S12B-10): the same spec and data sets as step 2, A/B against `slice-12a` in one balanced sitting (`--rounds 2`, a discarded warm-up), against the bars Łukasz approved. S12B-11's element check. Stop.
6. **Closing:**
   - the docs (section 10);
   - one full e2e run, keeping a failing test's error output and trace before rerunning it;
   - CI and the pull request with both GitHub checks;
   - a backup of KB (`.data/backups/dev-db-<yyyymmdd-hhmm>.json` and `kb-model-latest.json`);
   - the manual acceptance scenario.

   Merge and tag `slice-12b` only on Łukasz's command.

## 5. Acceptance criteria

Tests in `e2e/slice-12b/`, one file per criterion, each from a fresh seed; unit tests next to the code. Specs read the SVG's shapes against the data (count, kind, colour, relative position), never pixels.

| ID | Criterion |
| --- | --- |
| S12B-01 | **The seed's tiles.** On the seed's project home every canvas tile shows a thumbnail: one shape per entity card in its concept's colour, per table card in the physical colour, per frame, per free note, per requirement card, and one line per table and entity pair with a mapping; their order left to right and top to bottom matches the canvas's layout. |
| S12B-02 | **Collapsed.** A collapsed frame is drawn as its block and its cards are not drawn; a collapsed card is drawn as its header's height. |
| S12B-03 | **Empty.** A new canvas's tile says "Empty canvas". After a card is placed on it and the home is loaded again, it shows the card. |
| S12B-04 | **Fresh after an undo.** Move a card on a canvas, open the project home, press Undo there: the thumbnail shows the card at its old place (D-65). |
| S12B-05 | **Deleted things.** A card of a deleted entity, a deleted frame, a deleted note and a deleted requirement's card are not drawn; a pinned note is not drawn; a note that was pinned to the deleted entity's card is drawn as a free note at its place (D-20; step 1, F16). |
| S12B-06 | **Live canvas.** A label's live canvas has a thumbnail with its full and context cards. |
| S12B-07 | **The frame count.** A tile reads "{n} cards, {m} frames. Also in …" with singular and plural, and "{n} cards" without frames. |
| S12B-08 | **The workspace home** (if P8 is accepted): each project tile shows its first canvas's thumbnail; after the first canvas is removed from the project, the tile shows the next one's (the app has no reordering of canvases; step 1, F8). |
| S12B-09 | **In the server's HTML.** The thumbnails are in the server's HTML response (present in a page with JavaScript off); a reader and a reviewer get the same SVG as an owner. That the thumbnail has no layout read and no client code is checked in step 4's review (a grep, listed in the acceptance; step 1, F17). |
| S12B-10 | **The home's load** (section 6), against the bars approved after step 2. |
| S12B-11 | **Nothing on the canvas changes.** `S3B-15-elements.spec.ts` against `.data/measure/s9-14-baseline/slice-08.json`: the viewport counts equal; the page totals as slice 12a's (+6), or each difference explained. |
| S12B-12 | CI and the runs of the test regime; changed earlier tests listed with the reason. |

**Definition of done (scenario for the manual acceptance, on Łukasz's model KB, after the backup).**

1. Open "Kanton Basel"'s project homes: each canvas is recognisable from its thumbnail; frames are counted on the tiles.
2. Collapse a frame on a canvas, go back to the home: the thumbnail shows the block.
3. Move a card, undo it on the home: the thumbnail follows.
4. Open the workspace home (if P8): each project shows its first canvas.
5. Switch to dark mode and look at the tiles.

## 6. Performance

The slice adds nothing to the canvas. It adds a read and static SVG to the home pages.

| What | How | Bar |
| --- | --- | --- |
| The project home's load | a measuring spec (`e2e/slice-12b/S12B-10.spec.ts`, measurement build only, as S7B-16 measures the home's load), on the seed, "Performance test" and the 20-canvas project: server time, HTML size, FCP, LCP; median and p95 | step 2's bars, approved (below) |
| The workspace home's load | the same spec, if P8 is accepted | the same |
| The thumbnail's data and shapes | a bench script (`scripts/bench-thumbnails.ts`), the three data sets | reported, not a gate |
| The canvas page | S12B-11's element check | unchanged |

**The bars (approved after step 2):** S12B-10 against `slice-12a` in one sitting, each side twice in turns (A B A B), medians of 15 loads; p95 reported, not a gate. If a bar is missed, stop and describe it; the bars do not change after the measurement.

| Page | TTFB | FCP (= LCP) | HTML |
| --- | --- | --- | --- |
| seed, project home | ≤ +20 % or ≤ +10 ms, whichever is larger | the same | ≤ +5 KB |
| "Performance test", project home | ≤ +20 % and ≤ +50 ms | ≤ +20 % and ≤ +50 ms | ≤ +50 KB |
| "Performance test – 20 canvases", project home | ≤ +100 ms | ≤ +100 ms | ≤ +350 KB |
| workspace homes | ≤ +20 ms | ≤ +20 ms | ≤ +20 KB per project shown |

**Step 4 checks the bytes right after the tiles are built** (step 2's answer): whether the thumbnails are in the document once or a second time in the embedded RSC payload, and what they add to a write's answer on the project home (a pin, a rename, Undo), on "Performance test" and the 20-canvas project. If there are two copies, step 4 proposes how to avoid them before step 5.

**Nothing reads layout.** The SVG's viewBox comes from the data's bounds; no size is measured in the browser. The tile's strip keeps its fixed height (prototype: 140 px), so the SVG does not change the page's layout when it arrives.

**New elements on the canvas (AD-24):** none.

## 7. Questions for step 1

**The rule (CLAUDE.md, "How we work"):** a PRD is a proposal to verify, not a specification; this one was written from the docs without reading the code. In step 1, check every item, decision and acceptance criterion against the code, `docs/decisions.md` and the earlier slices' acceptance docs. Write into `docs/prd/slice-12b-acceptance.md` where the PRD is wrong, contradicts the code or a decision, duplicates what the app already has, misses what the code needs, or costs more than it assumes (data model, undo, change events, performance), each with the files and functions behind it and a proposal. List the differences between the reference prototype and the app that the slice touches. No application code in step 1; Łukasz answers before step 2.

- **Q1. The project home's data today.** `loadProjectView` and the page's other reads (the shell, the stats, requirements, labels, open notes, model consistency): what each reads through the local adapter, what it costs, and what a thumbnail adds (canvas items, frames, notes, attribute and column counts, mappings, concept colours). Whether one read per page can serve every tile.
- **Q2. The workspace home's data today,** and what P8 adds.
- **Q3. Card heights.** Whether the canvas computes a card's height from data (AD-24 rule 2) in a pure function the home may import, and whether it honours the row filter, live context cards and collapsed cards. Propose P6's rule or that function, with the cost of each.
- **Q4. Where the function lives.** The layer rules (`app` → `canvas` → `ui` → `domain`) and the Overview's miniature (`drawnKey`, React Flow's nodes): whether the thumbnail function can sit beside it without React Flow, and whether the miniature should later share it (an idea, not this slice).
- **Q5. The tile today.** `project-tiles.tsx`: the strip's element and size, the "{n} cards" text and its plural, "Also in", the menu; the workspace home's tile. What the server-rendered SVG needs there.
- **Q6. The colours.** The tokens for the physical colour, the mapping colour, the requirement violet and the canvas background in light and dark mode; the notes' paper colours (D-03, the miniature); concept colours as stored.
- **Q7. Measuring the home.** What S7B-16 measures of the home's load and how; whether its method gives server time, HTML size, FCP and LCP, or what the smallest new spec is; how to write 20 canvases into the e2e data file for the spec only; the measurement build's behaviour with the local adapter (the whole-file write, CLAUDE.md).
- **Q8. Freshness after a write.** Which writes redraw the project home (`revalidatePath`) and whether the thumbnail data comes with every redraw; whether anything caches the page between loads.
- **Q9. Earlier tests and docs.** Specs that read the tiles ("no thumbnails yet", "{n} cards"), the docs to update.

## 8. Differences from the prototype (deliberate)

- **Card heights follow the canvas, not the prototype's `thumb`** (P6; step 1, answer 1): the row filter counts (the prototype draws every row), a live canvas's context cards show their relevant rows, and a collapsed frame's block is as high as on the canvas (`blockHeight(members)`, the prototype 160). A requirement card stays 230 × 94 as in the prototype (the canvas grows it by its name's lines).
- **Notes in a collapsed frame are not drawn** (the prototype draws them), and a note is 80 high in the bounds too (the prototype fits 90); step 1, F14.
- **"Empty canvas"** is HTML text of a fixed size in the strip, not SVG text scaled with the tile (step 1, F9).
- **Colours come from the app's tokens,** so dark mode works; the prototype's variables are the same in spirit.
- **Thumbnails are server-rendered** static SVG; the prototype draws them in the browser on every render.

## 9. Left for later

- **A stored thumbnail per canvas** (P5's fallback), if a real workspace grows past the bars.
- **The workspace home's thumbnails,** if P8 is not accepted.
- **The Overview's miniature on the shared function** (Q4).
- **A thumbnail as a link to a place on the canvas** (clicking a frame opens the canvas there).
- **The prototype's left panel and inspector on the project home** (known limitation "The project home has no left panel or inspector").
- **Slice 13:** one behaviour for a refused save in every field (F6), with the typed text kept on a conflict and while a save is on its way.

## 10. Decisions to accept, and docs in this PR

### D-29 (addition, proposal)

"A canvas tile's thumbnail is a sketch of its layout drawn on the server when the home loads: frames, collapsed frames as blocks, entity and table cards in their colours, one line per table and entity pair with a mapping, free notes and requirement cards; no text. An empty canvas says so. The tile counts the canvas's cards and frames. (Slice 12b.)" Plus, if P8 is accepted: "A project's tile on the workspace home shows its first canvas's thumbnail."

### AD-24 (addition, proposal after step 5)

None expected (P3). If the measurement shows the home's load matters for later work, one sentence with the figures goes into `docs/known-limitations.md` instead.

### Assumptions to confirm

- **A1.** The slice starts from `main` at tag `slice-12a` (`98e107a`).
- **A2.** No data model change and no new format of the local data file (P4).
- **A3.** Łukasz's KB model is backed up before the manual acceptance; it is not reset or seeded. The measuring spec's 20 canvases are written into the e2e data file only.
- **A4.** The seed is not changed.

### Docs in this PR

- **`docs/decisions.md`** (only with Łukasz's approval): D-29's addition.
- **`docs/known-limitations.md`:** "Canvas tiles have no frame count" removed if P7 is built; the home's load figures if Łukasz wants them kept; anything else steps 1–5 find and Łukasz accepts.
- **`docs/ideas.md`:** "Thumbnails on the project home's canvas tiles" done; section 9's entries; the plan: 12b done, next 13.
- **`docs/inventory-prototype-vs-app.md`:** the thumbnails and the frame count; section 8's differences.
- **README and CLAUDE.md:** the slice's status; the thumbnail function; the measuring spec and the bench script in the commands list; the new e2e helpers.
