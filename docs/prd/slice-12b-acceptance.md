# Slice 12b – acceptance

Status: **step 4 stopped after its byte check (1 November 2026): the thumbnails are in the document twice, and the
20-canvas project's HTML grows by 384 KB (bar: 350 KB); waiting for Łukasz's decision before the rest of step 4.**

- Branch `slice/12b-canvas-thumbnails`, made on 1 November 2026 from `main` at `98e107a` (the start commit), which is
  the tag `slice-12a` itself; `origin/main` is at the same commit, so there is no difference to check.
- The PRD is copied unchanged from `~/Downloads/slice-12b-canvas-thumbnails.md` (21,436 bytes, identical byte for byte:
  `cmp` and SHA-256 `86ae2682cc29fb1fb1c671fd571492c4e1e03e5d29b61af81268d0e9ec1e77f2`). Commit "docs: add slice 12b PRD
  and acceptance".
- `.data/dev-db.json` (KB) is not changed: step 1 only counted its canvases and cards, read-only, without names (F21).

Step 1 checks P1–P8, items 1–12, sections 6 and 8–10, A1–A4 and S12B-01 to S12B-12 against the code,
`docs/decisions.md` and the earlier acceptance docs. The PRD's main worry does not hold: the project home already reads
every row a thumbnail needs, so a thumbnail adds computation and markup, not reads (F1). What the PRD misses:
- the canvas already has pure height rules in `domain`, and they differ from the prototype's (F5);
- the tiles are a client component, so the SVG travels twice on every load and again in every write's answer on the
  home (F4);
- `loadProjectView` is shared with the canvas page (F3);
- S12B-08 tests something the app cannot do (F8).

## Step 1: findings

| # | Finding | Code behind it | Proposal |
| --- | --- | --- | --- |
| F1 | **Q1: the project home already reads everything a thumbnail needs.** In one `Promise.all` the page reads the whole model (concepts with their colours, entities, attributes, tables, columns, mappings and their inputs, classifications), every live `canvas_item`, `frame` and `note` of the workspace, the canvases and the requirements. P2 needs nothing else. Through the local adapter every call is an in-memory filter over the cached, frozen file (`readDbCached`, which reads the file again only when its stamp changes). The file is not read on every request. | `src/app/w/[workspaceId]/p/[projectId]/page.tsx` (`ProjectHomePage`), `src/data/local/store.ts` (`model.load`, `canvasItems.list`, `frames.list`, `notes.list`), `src/data/local/file.ts` (`readDbCached`) | No new repository call: one read per page serves every tile. The thumbnails cost computation (per-page indexes, then shapes) and markup, and step 2's bench measures exactly those. The comment in `S7B-16-changes.spec.ts` ("the local adapter reads the whole file on every request") is out of date since slice 1a's cache: slice 7b's 227 ms are mostly the page's own work. |
| F2 | **Today's home already has costs that grow with the number of canvases.** `usedOn` calls `projectLabels(… labelContext(model, itemsOf([c.id])))` once per canvas, and each `labelContext` builds maps over every attribute, column and mapping in the workspace. `loadProjectView` awaits `listLinksOfCanvas` once for each canvas in the workspace, one after another. | `page.tsx` (`labelContext`, `usedOn`), `src/app/_lib/project-view.ts` (`loadProjectView`) | Step 2 reports both as part of "today" on the 20-canvas project. They are not touched in this slice unless the figures call for it. The A/B in step 5 separates them from the thumbnails. |
| F3 | **`loadProjectView` is shared with the canvas page.** It feeds the canvas tabs, and on both pages `ProjectView` is passed to client components, so anything added to it costs every canvas load. | `src/app/w/[workspaceId]/p/[projectId]/c/[canvasId]/page.tsx` (line 87), `project-view.ts` | Leave `loadProjectView` unchanged (P3, S12B-11). The home page works out the tiles' extra data from what it has already read and passes it to the tiles: for each canvas, the frame count (P7) and the thumbnail. |
| F4 | **The tiles are a client component, so the SVG travels twice, and again after every write on the home.** `CanvasTiles` is `"use client"`, so whatever the server renders for it goes into the HTML and again into the same document's RSC payload. Every write on the home (a pin, the name or description saved field by field, Undo, Redo) calls `revalidatePath("/", "layout")`, so the action's answer carries the whole home again, thumbnails included. | `project-tiles.tsx`, `src/app/_actions/*.ts` (`revalidatePath`), `src/app/_components/undo.tsx` | Render the SVG in a server component and pass it to the tile as a slot, so the client component gets no shape data. Step 2's bench reports the bytes per canvas and per page for three forms: SVG elements as React nodes; one SVG string (`dangerouslySetInnerHTML`, one escaped string in the payload instead of an element tree); either of them with coordinates rounded to whole units of a normalized space. The figures decide (P5). |
| F5 | **Q3: the canvas has pure height rules in `domain`, and they are not the prototype's.** `cardHeightOf` honours the row filter: a header of 54, padding of 2 × 6, 26 per shown row and at least one row; a collapsed card is its header. A live context card (`labeled`) needs the label's relevant rows (`liveMembership`, `liveCardHeight`). A collapsed frame's block is `blockHeight(members)`, not 280 × 160: 280 wide, 22 px per member up to six, one row for "and N more", and a 30 px footer. A requirement card is `requirementCardHeight(nameLines)`, which is 94 px for a one-line name; counting the lines needs `text-fit` (canvas layer, font metrics), which `domain` may not import. A note's height is not stored: the canvas measures it and falls back to 80. | `src/domain/model/card-size.ts` (`cardHeightOf`, `rowShown`), `src/domain/model/live.ts` (`liveMembership`, `liveCardHeight`), `src/domain/model/frames.ts` (`BLOCK`, `blockHeight`), `src/canvas/requirement-card-data.ts`, `src/canvas/ModelCanvas.tsx` (`miniNotes`: `s.height ?? 80`) | **Use the canvas's rules instead of P6's copy:**<br>- cards: `cardHeightOf`, with rows built once per page (mapping counts per attribute and column, `is_primary_key`, `is_foreign_key`, Business key through the classification index, and for each live canvas the relevant rows through `liveMembership`);<br>- a collapsed frame: `blockHeight(members)`;<br>- a requirement card: 94;<br>- a note: 80.<br>The thumbnail then has the same rectangles as the canvas and the Overview. Cost: per-page indexes in O(model), then O(rows on the project's canvases). Step 2's bench times this and P6's rule. A unit test compares the heights with `cardHeight(buildCards(…))` on the seed and on "Performance test", so the two rules cannot drift apart. |
| F6 | **Q4: where the function lives.** `domain` can hold the shapes, as it already holds every size rule above. `canvas` would also be allowed for the app but carries React Flow types. `frameColor` and `NOTE_MINI` live in the canvas layer (`frame-data.ts`, `Overview.tsx`), so `domain` cannot use them. The Overview draws from React Flow's nodes (positions change live during a drag, `drawnKey`), so it cannot simply call a function of stored rows. | `eslint.config.mjs` (layer rules), `src/canvas/frame-data.ts` (`frameColor`), `src/canvas/Overview.tsx` (`NOTE_MINI`, `Miniature`) | Two files:<br>- `src/domain/model/thumbnail.ts`: pure; it turns one canvas's rows and a per-page index into shapes, colour roles and bounds. A role is a concept's stored `#RRGGBB`, a free frame's colour, "physical", "map", "req" or a note colour's name.<br>- `src/ui/canvas-thumbnail.tsx`: the SVG, renderable on the server, no hooks; it maps the roles to tokens.<br>Both homes import the component, and the Overview could later (`canvas` → `ui` is allowed). Sharing it with the Overview stays an idea, not this slice. |
| F7 | **Q2: the workspace home reads the model but no canvas rows.** On every tab it reads the model, the requirements and their links, the members and the history. P8 adds `canvasItems.list`, `frames.list`, `notes.list`, the per-page indexes and each project's first canvas. `listLinksOfProject` gives the first canvas; `loadShellFor` already calls it for each project but keeps only the count. Its tiles are server-rendered `Link`s, so the SVG goes into the HTML and into the payload once each, with no client component in between. | `src/app/w/[workspaceId]/page.tsx`, `src/app/_lib/shell.ts` (`loadShellFor`, `canvasCount`) | If P8 is accepted, read the canvas rows only on the Overview tab, and take each project's first canvas from the same calls. Step 2 measures it, and the figures decide. |
| F8 | **S12B-08's "first canvas changes order" cannot happen in the app.** No command reorders a project's canvases: `sort_order` is only ever appended. The first canvas changes only when it is removed from the project or deleted. Also, "a project without a canvas cannot happen" is `removeCanvasFromProject`'s rule ("This project would have no canvas left."), not D-65's. | `src/domain/commands/canvas.ts` (`nextSortOrder`, `removeCanvasFromProject`) | Reword S12B-08: "each project tile shows its first canvas's thumbnail; after the first canvas is removed from the project, the tile shows the next one's." |
| F9 | **Q5: the tile today.** The strip is an empty `span` (`block h-[140px] border-b border-im-line bg-im-canvas`) inside the tile's `Link`. "{n} cards" counts only entity and table cards (`cardsPerCanvas`; requirement cards and notes are not counted, as in the prototype), with its plural. "Also in" and the ⋯ menu stay. The text "no thumbnails yet" is not in the code; only `docs/ideas.md` uses it. | `project-tiles.tsx`, `src/app/_panels/stats.ts` (`cardsPerCanvas`) | The SVG fills the strip, 100 % × 100 %. The strip keeps its fixed 140 px, so nothing shifts. "Empty canvas" becomes an HTML `span` centred in the strip (12 px, `text-im-ink-3`), not scaled SVG text: in the prototype the text's size follows the tile's width. Like the SVG it is `aria-hidden`, since "0 cards" already says it. The frame count counts the canvas's live frames, expanded and collapsed (prototype `d.frames.length`). |
| F10 | **Q6: the colours exist as tokens.** `--im-physical`, `--im-map`, `--im-req` and `--im-canvas` are defined for light and dark (`globals.css`). The notes' paper colours are `NOTE_MINI` in `Overview.tsx`, not exported. An entity without a concept is `#888899` in the Overview, and a concept frame without a colour uses `FREE_FRAME_COLORS[0]`. The Overview's opacities are a little lower than the prototype's `thumb` (entities .55 against .65, tables .5 against .55). | `src/app/globals.css`, `src/canvas/Overview.tsx`, `src/canvas/canvas.css` (`.overview-svg`), `src/domain/model/frames.ts` (`FREE_FRAME_COLORS`) | Take the opacities of the prototype's `thumb`. Move `NOTE_MINI` into one shared module (`src/ui/`) and import it in the Overview. The move changes nothing the Overview draws, and S12B-11 checks the canvas. Without the move the colours would be copied (question 6). |
| F11 | **Q7: S7B-16 measures too little for the bars.** Its home test reads only `responseEnd` and `DOMContentLoaded`, over seven loads after one warm-up load, on "Performance test" with an import's changes. It gives no TTFB, HTML size, FCP, LCP or p95, and no split of the server's time. That split cannot come from the page without changing the application, and step 2 changes none. An inline `<svg>` is not an LCP candidate, so LCP will be a block of text, and the thumbnails can affect it only through the HTML's size and parsing. | `e2e/slice-07b/S7B-16-changes.spec.ts`, `playwright.config.ts` (`testIgnore`, the measurement build's server) | **A new spec, `e2e/slice-12b/S12B-10.spec.ts`**, in the measurement build only (added to `testIgnore` like the other measuring specs). For each page and data set: 2 discarded loads, then 15. It reads the navigation timing (TTFB = `responseStart − requestStart`, `responseEnd`, `DOMContentLoaded`), FCP from the paint entries, LCP through a buffered `PerformanceObserver`, and the HTML's decoded size, and reports median and p95.<br>**The server's split comes from the bench** (`scripts/bench-thumbnails.ts`). Like `bench-consistency.ts`, it runs the page's reads and computations through the same store calls: reads, project view, labels, requirement index, consistency, thumbnails.<br>**The 20 canvases:** a helper in `e2e/slice-12b/` copies "100 cards" 20 times (frames, cards and notes, with their references moved, as `addLargeRequirementCards` does) into a new project, "Performance test – 20 canvases", in the "Performance test" workspace. It writes `E2E_DB` after `seedLargeData`, through `readDb`/`writeDb`, with ids from `seedId`. It never touches the seed or `.data/dev-db.json`. 20 fits the local adapter: it adds about 2,000 cards, 160 frames and 320 notes, and the cache parses the file once after the write.<br>The A/B in step 5 needs the spec and the helper copied into a `slice-12a` worktree, as the element checks' baselines were made. |
| F12 | **Q8: nothing caches the home.** The pages read the session cookie, so they are dynamic, and the code has no `"use cache"`, `revalidate` or `unstable_cache`. Every write calls `revalidatePath("/", "layout")`. So Undo on the home (D-65) redraws the home with fresh thumbnails in the action's answer, and Back to the home through the app's links refreshes it (`history-nav.tsx`). The known exception stays: a page that the browser restores whole from its back-forward cache after a full load (slice 12a's limitation). | `src/app/_actions/*.ts`, `src/app/_components/history-nav.tsx`, `docs/known-limitations.md` ("Back onto a page restored from the browser's back-forward cache") | Items 10 and 11 hold without work. Every write on the home also recomputes all the thumbnails (F4). Step 2 counts that as one page render. |
| F13 | **Q9: earlier tests and docs.** No spec reads the strip or the exact "{n} cards" text. `S0-05` checks `toContainText("Also in Order management")`, which stays true with ", {m} frames" in front of it. The tile specs (S0-04, S0-05, S0-06, S3B-08, S6B-01, S6B-05, S6B-06, S6B-08-edit, S9-06, S12A-05, S12A-08, S12A-09) click the tile's link or its menu. Since the SVG and "Empty canvas" are `aria-hidden`, the link's accessible name does not change. | `e2e/slice-00/…`, `e2e/slice-03b/S3B-08.spec.ts`, `e2e/slice-06b/…`, `e2e/slice-09/S9-06.spec.ts`, `e2e/slice-12a/…` | In step 4, run them as the PRD says (slices 0, 2a, 9 and 12a), plus S3B-08 and the S6B tile specs. The docs are PRD section 10's, plus two: `docs/inventory-prototype-vs-app.md` has no row for the tiles yet (add one), and S7B-16's stale comment (F1). |
| F14 | **Notes: the prototype and the canvas disagree.** The prototype's `thumb` draws every unpinned note, also one in a collapsed frame, and it fits its bounds to a note 90 high but draws it 80 high. The canvas hides a free note while its frame is collapsed (`noteVisible`), and hides resolved notes only when the person chooses to. | prototype `thumb`, `src/domain/model/notes.ts` (`noteVisible`) | Draw the free notes the canvas shows with resolved notes not hidden (`noteVisible(…, false)` and not pinned), 80 high in the bounds and in the drawing (question 5). |
| F15 | **Mapping lines and collapsed frames.** The prototype draws no line to a card in a collapsed frame. The Overview draws it to the frame's block (`blockOf`), as the canvas bundles it (D-07). The prototype ignores the layer mode, while the canvas hides mapping lines under "Relationships". | prototype `thumb`, `src/canvas/Overview.tsx` (`centre`, `blockOf`), `src/canvas/ModelCanvas.tsx` (layer mode) | Follow the prototype: no line into a collapsed frame, and the layer mode ignored (question 4). |
| F16 | **S12B-05's deleted rows never reach the page.** Deleting an entity or a requirement soft-deletes its cards in the same write, and a note pinned to a removed card becomes a free note at its place (D-20). The store lists live rows only. | `src/domain/commands/entity.ts` (cascade, `releaseNotes`), `src/domain/commands/requirement.ts`, `store.ts` (`live`) | Keep S12B-05, and keep the guard that `buildRequirementCards` has (a card whose requirement is gone is left out). Add one check: a note pinned to a deleted entity's card is drawn as a free note. |
| F17 | **S12B-09 mixes a test and a review.** "Present with JavaScript off" can be tested, through a context with `javaScriptEnabled: false` and the session's cookie, or by fetching the page's HTML with the cookie. "The home's code contains no layout read" cannot be tested in e2e. | – | S12B-09 becomes: the thumbnails are in the server's HTML response, and a reader and a reviewer get the same SVG as an owner. "No layout read and no client code for the thumbnail" moves to step 4's review (a grep, listed in this document). |
| F18 | **The seed has no frames for S12B-01.** On the seed, "Customer & orders" has 3 entity cards, 4 table cards, 1 requirement card, 3 notes and no frames. | `src/data/local/seed*.ts` | S12B-01 checks cards, the requirement card, notes and lines on the seed. S12B-01 and S12B-02 make frames and blocks as test data (`makeFrame`, `collapse`, from slices 2b and 2c). |
| F19 | **Requirement card height.** 94 px is the canvas's height for a one-line name; each further line adds 17 px. | `src/canvas/requirement-card-data.ts` (`REQ_CARD`, `requirementCardHeight`) | Always 94 (P6, prototype): `domain` cannot measure text, and the difference is a few pixels in a 140 px strip (question 2). |
| F20 | **P4 holds.** Everything comes from existing columns: `canvas_item` (x, y, width, collapsed, row filter, frame, live level), `frame` (x, y, size, collapsed, kind, concept, colour), `note` (x, y, width, colour, pins, frame, status), `concept.color`, attributes, columns, mappings, classification links and requirements. Nothing is written, so there are no change events and no undo steps. The local file stays at format 11. | `src/data/local/schema.ts` (`DEV_DB_FORMAT = 11`), `src/domain/types.ts` | A2 confirmed. No backup step before the closing's usual one. |
| F21 | **KB is small.** Read-only counts, without names: every workspace in KB has one or two canvases per project, with at most 8 cards on a canvas. | `.data/dev-db.json` (read, not changed) | The bars protect against growth, not today's KB. |

## Differences between the prototype and the app that the slice touches

| What | Prototype | App today | After this slice (proposal) |
| --- | --- | --- | --- |
| A canvas tile's strip | `thumb(d)` | empty strip | the thumbnail |
| A canvas tile's text | "{n} cards, {m} frames. Also in …" | "{n} cards. Also in …" | as the prototype (P7) |
| A project tile on the workspace home | its first canvas's `thumb` | empty strip | as the prototype, if P8 is accepted |
| Card heights | header, padding and one row per attribute or column, whatever the filter | – | the canvas's rule, with the row filter (F5, question 1) |
| A collapsed frame | block 280 × 160 | (canvas: `blockHeight(members)`) | as the canvas (F5) |
| A requirement card | 230 × 94 | (canvas: by its name's lines) | 230 × 94 (F19) |
| Notes in a collapsed frame | drawn; bounds 90 high | (canvas: hidden) | hidden; 80 high (F14) |
| "Empty canvas" | SVG text, scaled with the tile | – | HTML text, 12 px (F9) |
| Opacities | `thumb`'s | (the Overview's are lower) | `thumb`'s (F10) |
| The strip's background | the page's `--canvas` | the page's `--im-canvas` | unchanged (question 7) |
| Drawing | in the browser on every render | – | SVG rendered on the server |

## New user-facing texts (for approval)

- "Empty canvas", in the strip of an empty canvas.
- The tile's line: "{n} card" or "{n} cards", then ", {m} frame" or ", {m} frames" when the canvas has frames, then
  ". Also in {projects}" as today. For example: "7 cards, 1 frame. Also in Order management".

There is no other text: the SVG has no text and no title.

## Questions for Łukasz

1. **Card heights (P6, F5):** should the thumbnail use the canvas's rules (row filter, live context cards, the block's
   real height) instead of the prototype's copy? Recommended: the canvas's rules; step 2's bench times both.
2. **Requirement cards (F19):** always 94 px high? Recommended: yes.
3. **The SVG's form (P5, F4):** choose after step 2's byte figures (React nodes or one string, rounded coordinates)?
   Recommended: yes, together with the bars.
4. **Lines into a collapsed frame, and the layer mode (F15):** follow the prototype (no line into a collapsed frame,
   layer mode ignored)? Recommended: yes.
5. **Notes (F14):** hide free notes in a collapsed frame as the canvas does, and draw resolved ones? Recommended: yes.
6. **`NOTE_MINI` (F10):** move it into one shared module in `src/ui/` and import it in the Overview (nothing it draws
   changes)? Recommended: yes. The alternative is a copy.
7. **The strip's background:** keep the page's canvas colour (as the prototype does), not each canvas's own background
   (`look.background`)? Recommended: keep it, and put the canvas's own background in `docs/ideas.md`.
8. **The 20 canvases (F11):** a separate project, "Performance test – 20 canvases", in the "Performance test"
   workspace, written by the spec into the e2e data file only? Recommended: yes. "Performance test" itself keeps its
   two canvases, so its figures stay comparable with slice 7b's.
9. **S12B-05, S12B-08 and S12B-09 (F16, F8, F17):** accept them as reworded above?
10. **P8:** decided after step 2, as the PRD says; the figures will cover both homes.

## Łukasz's answers to step 1 (1 November 2026)

1. Card heights by the canvas's rules (`cardHeightOf` with the filter, context cards through `liveMembership`,
   `blockHeight` for a collapsed frame), with a test comparing them with `buildCards`. Written into the PRD's section 8
   as a deliberate difference from the prototype.
2. A requirement card is always 94 px high: yes.
3. The SVG's form after step 2's byte figures: yes; F4 (the SVG rendered on the server as the tile's slot) is the
   proposal to compare.
4. No line into a collapsed frame and no layer mode, as in the prototype: yes.
5. Notes in a collapsed frame hidden; resolved ones drawn (hiding them is a preference in the browser, D-21): yes.
6. `NOTE_MINI` into `src/ui/`: yes, as a move of the constant only, with no change to the Overview's behaviour; the step
   that does it runs S3B-13.
7. The strip's background is the page's canvas colour: yes.
8. "Performance test – 20 canvases" as a separate project, in the e2e data file only: yes.
9. S12B-08 as proposed: yes. S12B-05 and S12B-09: accepted as long as each criterion's aim is unchanged; written into
   the PRD, full text shown in step 2's summary.
10. P8 is decided after step 2.

Also:
- **F3 is a rule of the slice:** nothing of the thumbnails or the frame count goes into `loadProjectView` or the canvas
  page.
- **F2:** measured only in step 2 (the labels' cost and `listLinksOfCanvas` per canvas apart, where possible). A fix
  joins 12b only on Łukasz's decision, if the page misses the bars.
- **The new texts** ("Empty canvas", "{n} card(s), {m} frame(s). Also in …") are accepted.

The PRD is updated to these answers (status "step 1 answered"; P2, P3, P5, P6, item 2, item 9, S12B-05, S12B-08,
S12B-09, section 8).

## Assumptions

- **A1** holds: `main` is the tag `slice-12a` (`98e107a`), and `origin/main` is the same commit.
- **A2** holds (F20).
- **A3, A4:** the seed does not change, and only the measuring spec writes the 20 canvases, into `E2E_DB`.

## Step 2: today's load and what the thumbnails would cost

No change to the application. What step 2 adds:
- `e2e/slice-12b/S12B-10.spec.ts`, the measuring spec (measurement build only; added to `testIgnore`), with its
  `fixtures.ts`;
- `scripts/lib/many-canvases.ts`, "Performance test – 20 canvases" (`addManyCanvases`), used by the spec and the bench;
- `scripts/bench-thumbnails.ts`, the bench;
- `scripts/lib/thumbnail-draft.ts`, a draft of the thumbnail for the bench only. Step 3 wrote the real function in
  `src/domain/model/thumbnail.ts` and removed the draft.

How it was run: the development laptop, Chrome 156, headed (`MEASURE=1`), the measurement build (`npm run
measure:build`), nothing else running. Two full runs of S12B-10 (15 loads per page after 2 discarded; raw figures in
`.data/measure/s12b10-step2/`), then the bench (9 rounds after a warm-up; `.data/bench-thumbnails-step2.log`). The
data sets:
- **seed:** Order management's home (2 canvases) and Retail Co – DWH's workspace home.
- **large:** "Performance test" has 3 canvases: "100 cards" (101 cards, 8 frames, 24 notes), the live canvas PERF-2 (22
  cards, 20 of them context cards with the `labeled` filter) and "Performance test – requirements" (113 cards with 12
  requirement cards). Its workspace home has 1 project.
- **many:** "Performance test – 20 canvases", 20 copies of "100 cards". Its workspace home now has 2 projects.

### The pages today (S12B-10, median / p95 in ms; HTML in bytes)

| Page | Run | TTFB | responseEnd | DOMContentLoaded | FCP = LCP | HTML |
| --- | --- | --- | --- | --- | --- | --- |
| seed, project home | 1 / 2 | 18 / 37, 20 / 30 | 22 / 41, 25 / 34 | 54 / 69, 54 / 69 | 92 / 140, 92 / 112 | 62,171 |
| seed, workspace home | 1 / 2 | 14 / 19, 17 / 34 | 17 / 25, 19 / 37 | 44 / 49, 50 / 85 | 72 / 88, 84 / 112 | 33,148 |
| large, project home | 1 / 2 | 53 / 67, 60 / 70 | 60 / 77, 68 / 79 | 122 / 146, 118 / 138 | 208 / 232, 212 / 232 | 449,864 |
| large, workspace home | 1 / 2 | 20 / 29, 25 / 36 | 23 / 32, 27 / 38 | 49 / 65, 51 / 77 | 76 / 92, 80 / 116 | 31,500 |
| many, project home (20 canvases) | 1 / 2 | 111 / 131, 117 / 150 | 124 / 143, 128 / 162 | 227 / 373, 221 / 385 | 324 / 384, 332 / 404 | 1,095,097 |
| many, workspace home (2 projects) | 1 / 2 | 22 / 29, 22 / 31 | 25 / 33, 24 / 34 | 53 / 65, 55 / 66 | 88 / 112, 80 / 164 | 33,186 |

- **LCP is FCP on every page:** the largest paint is a block of text in the first frame. As step 1 expected (F11), the
  thumbnails can reach LCP only through the document's size.
- **The two runs agree within about 8 ms in the medians.** The p95 spreads more, up to 50 ms on the workspace home's
  FCP.
- **What makes today's documents large** (one document of each kind kept with `SAVE_HTML`, the markup outside
  `<script>`; the RSC payload in the scripts carries about as much again):

  | Part of the markup | large, project home | many, project home |
  | --- | --- | --- |
  | the shell (top bar, tabs) | 16 KB | 34 KB |
  | model consistency (232 lines) | 134 KB | 134 KB |
  | the canvas tiles | 6 KB | 30 KB |
  | requirements | 14 KB | 14 KB |
  | labels | 6 KB | 6 KB |
  | open notes | 28 KB (42 notes) | 275 KB (360 notes) |
  | whole document (markup + scripts) | 450 KB | 1,095 KB |

  The project home's size today comes from model consistency (a known limitation: "Model consistency lists every line")
  and from the list of open notes, which grows with every canvas. Neither is this slice's subject (question 4 below).

### The server's work today, split (bench, median in ms)

| Part | seed | large | many |
| --- | --- | --- | --- |
| the shell's reads | 0.7–1.0 | 1.2 | 1.2 |
| the project view's reads | 0.3 | 0.4 | 0.7 |
| **`listLinksOfCanvas` per canvas (F2)** | 0.2 | 0.35 | **3.3** |
| the page's reads | 0.5 | 2.4 | 2.9 |
| stats | 0.1 | 0.9 | 1.3 |
| labels of the project | 0.04 | 0.4 | 0.8 |
| **labels per canvas, `usedOn` (F2)** | 0.06 | 1.0 | **8.7** |
| requirement index | 0.1 | 1.2 | 1.6 |
| model consistency | 0.1 | 1.6–2.4 | 2.6–3.5 |
| open notes | 0.02 | 0.1 | 0.6 |
| **total of the page's own code** | **2.6** | **10.8** | **26.1** |

The workspace home: 1.4 ms (seed), 5.7 ms (large), 8.3 ms (many).

- **The page's own code is a small part of TTFB.** On "many" it is 26 of 111–117 ms; the rest is React rendering and
  serializing the document. That rest grows with the document: 450 KB took 53–60 ms and 1,095 KB took 111–117 ms,
  about 0.09 ms per KB.
- **F2:** on the 20-canvas project, the labels per canvas (8.7 ms) and `listLinksOfCanvas` (3.3 ms) are 12 ms of
  TTFB's 111–117. Not worth a fix in this slice (Łukasz's rule: only if the page misses the bars).

### What the thumbnails would add

**Server time** (draft, the canvas's height rule): the index once per page, 0.1 ms (seed), 1.0–2.2 ms (large) and
1.3 ms (many); the shapes 0.07 ms (2 canvases), 5–6 ms (3 canvases) and 26 ms (20 canvases), about 1.3 ms per "100
cards" canvas. The draft filters every item of the workspace once per canvas; step 3 groups them by canvas once, which
should bring the 20 canvases well under 26 ms. **The prototype's height rule is no faster**: 24 ms on 20 canvases, 2.6
ms on 3. On "large" it differs in height for **20 of 224 cards**, exactly PERF-2's context cards; on the copies of
"100 cards", none (no row filters there).

**Shapes per thumbnail:** "100 cards" has 400: 8 frames, 60 tables, 41 entities, 12 notes and **279 lines** (70 %). On
the 20-canvas project that is 8,000 shapes per page.

**Bytes** (HTML markup + the RSC payload's estimate, for the whole page):

| Form | seed, project (2) | large, project (3) | many, project (20) | large, workspace (P8, 1) | many, workspace (P8, 2) |
| --- | --- | --- | --- | --- | --- |
| an element per shape (`<rect>`, `<line>`) | 3.4 KB | 126 KB | 1,161 KB | 58 KB | 116 KB |
| the same as one string | 3.3 KB | 123 KB | 1,130 KB | 57 KB | 113 KB |
| an element per shape, whole numbers in 400 units | 3.1 KB | 119 KB | 1,091 KB | 55 KB | 109 KB |
| the same as one string | 3.0 KB | 116 KB | 1,061 KB | 53 KB | 106 KB |
| **one `<path>` per class and colour, whole numbers in 400 units** | **1.9 KB** | **34 KB** | **298 KB** | **15 KB** | **30 KB** |

- **A string (`dangerouslySetInnerHTML`) saves only 3 % over React elements, and whole numbers about 6 %.** Most of
  the bytes are one element per shape.
- **One `<path>` per class and colour is about 3.9 times smaller.** A rectangle is written `M x y h w v h h -w z` and a
  line `M x y L x y`, in a 400-unit space (sub-pixel in a 140 px strip). The corners are not rounded (under a pixel at
  this size), and each thumbnail has a handful of elements, so React elements and a string cost the same. Tests read
  the shapes from the paths' subpaths (one `M` per shape; class and fill tell the kind and colour).
- **What it means for the page:** with paths, "many" grows from 1,095 KB to about 1,393 KB (+27 %), "large" from 450 KB
  to about 484 KB (+7 %). At about 0.09 ms per KB, plus the shapes, that is about **+35 to +55 ms TTFB on "many"** and
  about **+5 to +10 ms on "large"**. With an element per shape, "many" would double (+1.1 MB, about +100 ms TTFB before
  parsing), and that would miss the bars.

### Proposed bars for step 5

S12B-10 against `slice-12a` in one sitting, each side run twice in turns (A B A B), medians of 15 loads; p95 reported,
not a gate (its spread is too wide for one).

| Page | TTFB | FCP (= LCP) | HTML |
| --- | --- | --- | --- |
| seed, project home | ≤ +20 % or ≤ +10 ms, whichever is larger | the same | ≤ +5 KB |
| large, project home | ≤ +20 % and ≤ +50 ms (the PRD's) | ≤ +20 % and ≤ +50 ms | ≤ +50 KB |
| many, project home (20 canvases) | ≤ +100 ms (the PRD's) | ≤ +100 ms | ≤ +350 KB |
| workspace homes (if P8) | ≤ +20 ms | ≤ +20 ms | ≤ +20 KB per project shown |

### Recommendation

- **P5: build it as proposed: computed on the server on each load, static SVG.** The fallback (a stored thumbnail, a
  data model change) is not needed: the computation is about 1 ms per canvas, and the cost lies in the bytes, which the
  form solves.
- **The SVG's form: one `<path>` per class and colour, whole numbers in a 400-unit space, as React elements** (no
  `dangerouslySetInnerHTML`; React escapes the attributes), rendered by a server component and passed to the tile as a
  slot (F4).
- **P8: accept it.** The workspace home today is 31–33 KB and 20–25 ms TTFB. With paths it adds about 15 KB and 2–4 ms
  per project shown.
- **F2: no fix in this slice** (12 ms of 111–117 on the 20-canvas home).

### Questions for Łukasz after step 2

1. P5 as recommended (no stored thumbnail)?
2. The SVG's form: paths per class and colour, in 400 units, as React elements?
3. P8: accept?
4. The bars as proposed? Should the large parts of today's home (model consistency's 134 KB, the open notes' 275 KB on
   20 canvases) go into `docs/ideas.md` (folding or a limit, as the consistency limitation suggests), with no work in
   12b?

## Łukasz's answers to step 2 (1 November 2026)

1. **P5:** yes. Computed on the server on every load; no stored thumbnail.
2. **The SVG's form:** one `<path>` per class and colour, whole numbers in a 400-unit space, as React elements (no
   `dangerouslySetInnerHTML`), in a server component passed to the tile as a slot.
3. **P8:** accepted.
4. **The bars for step 5:** as proposed (PRD section 6), on medians; p95 only reported. If a bar is missed, stop and
   describe it; the bars do not change after the measurement.
5. **Model consistency (134 KB) and the open notes (275 KB with 360 notes):** only an entry in `docs/ideas.md` with
   these figures, no work in 12b.
6. **F2:** no fix. The figures stay here: on the 20-canvas project the labels per canvas (`usedOn`) take 8.7 ms and
   `listLinksOfCanvas` per canvas 3.3 ms, 12 ms of TTFB's 111–117 ms; on "Performance test" 1.0 and 0.35 ms.
7. **To check in step 4, right after the tiles are built:** whether the thumbnails' bytes are in the document once or a
   second time in the embedded RSC payload, and what they add to a write's answer on the project home (a pin, a
   rename, Undo), with figures for "Performance test" and the 20-canvas project. If there are two copies, propose how
   to avoid them before step 5.

## Step 3: the thumbnail function

What step 3 adds and changes:
- **`src/domain/model/thumbnail.ts`** (pure, no React):
  - `thumbnailIndex(model, { requirements, labels, labelLinks })`: what a page builds once (rows per card with their
    mapping counts as `buildCards` counts them, colour roles, the table and entity pairs joined by a mapping);
  - `canvasThumbnail(canvas, { items, frames, notes }, index)`: the shapes in drawing order (frames, the larger first;
    lines; tables; entities; notes; requirement cards) and their bounds, null for "Empty canvas";
  - `canvasThumbnails(canvases, rows, index)`: the same for several canvases, grouping the workspace's rows by canvas
    once;
  - `thumbnailDrawing(thumbnail)`: one path per kind and colour, whole numbers, the longer side 400 units with the 6 %
    margin (step 2's answer).

  Colours are roles: a stored `#RRGGBB`, `physical`, `req`, a note colour or null (lines). Step 4's
  `src/ui/canvas-thumbnail.tsx` maps them to tokens.
- **The rules, as answered:**
  - card heights by `cardHeightOf` with the row filter; a stored `labeled` filter shows as `all` outside a live
    canvas, and a live canvas is live only while its label exists, as on the canvas page;
  - a collapsed card is its header; a collapsed frame is its block, `blockHeight` of its element cards whose entity or
    table is live (`memberCounts` of the built cards), with its cards, their lines and its free notes left out;
  - a requirement card is 230 × 94 while its requirement is live;
  - free notes are drawn by `noteVisible` with resolved ones shown, at their width and 80 high; pinned notes are not
    drawn;
  - an entity whose concept is not in the model is `#888899`, as on the canvas.
- **Unit tests:**
  - `src/domain/model/thumbnail.test.ts`: 24 tests, one or more per rule of P2 and P6, and the paths;
  - `tests/thumbnail-heights.test.ts`: every entity and table card the thumbnail draws on every canvas of the seed and
    of "Performance test" has the canvas's rectangle (`cardWidth`, `cardHeight(buildCards(…))`, built as the canvas
    page builds it, PERF-2 live), and each collapsed frame's block has the canvas's `frameShape`. The test collapses two
    of "100 cards"'s frames in its own data file, since the seed has none. It lives in `tests/` because `domain` cannot
    import the canvas. A check that it can fail: with the prototype's rule (every row) it fails on PERF-2
    (`256×690` against `256×92`).
- **`NOTE_MINI`** moved from `src/canvas/Overview.tsx` to `src/ui/note-colors.ts` (answer 6), with the same values;
  the Overview imports it. **S3B-13: 2 of 2 passed** (45.5 s).
- **The bench** (`scripts/bench-thumbnails.ts`) uses the real function; the draft is removed. Its output is in
  `.data/bench-thumbnails-step3.log` (5 rounds). Median server time of the thumbnails:

  | Data set | index | shapes | paths | bytes (HTML + RSC estimate) |
  | --- | --- | --- | --- | --- |
  | seed, project home (2 canvases) | 0.08 ms | 0.06 ms | 0.04 ms | 2.0 KB |
  | large, project home (3) | 1.5 ms | 1.3 ms | 0.4 ms | 34.6 KB |
  | many, project home (20) | 1.5 ms | 4.6 ms | 3.6 ms | 304.8 KB |
  | many, workspace home (P8, 2 projects) | 1.4 ms | 0.4 ms | 0.2 ms | 30.5 KB |

  The shapes on 20 canvases take 4.6 ms against the draft's 26 ms, because the rows are grouped by canvas once. The
  shapes per "100 cards" canvas are the draft's (8 frames, 279 lines, 60 tables, 41 entities, 12 notes), and the bytes
  are step 2's paths figures.
- **CI:** `npm run lint`, `npm run typecheck` and `npm test` (119 files, 1,555 tests) pass.
- No application page changes yet: the tiles are step 4. `.data/dev-db.json` is not touched.

## Step 4: the tiles (stopped after the byte check)

Łukasz's order for step 4: (1) the colour of an entity without a concept from the canvas's own source, (2) the
thumbnails on the project home and their bytes at once, stopping if they are there twice or come near the 350 KB bar,
(3) the rest.

### 1. An entity without a concept

The canvas has no token and no dark variant for it: `#888899` was written twice as a literal (`CardNode.tsx`, `--cc`;
`Overview.tsx`), like the concept colours, which are stored colours for both modes. Step 4 makes it one constant,
`NO_CONCEPT_COLOR` in `src/domain/model/concept-colors.ts`, which the card, the Overview and the thumbnail import. The
canvas draws exactly what it drew. In practice the case does not happen: `entity.concept_id` is required, and a
concept is deleted only with its entities moved or deleted (D-47).

### 2. The thumbnails on the project home

- `src/ui/canvas-thumbnail.tsx`: a server component with no hooks. It renders `thumbnailDrawing` as an `<svg>` (one
  `<path>` per kind and colour, `data-kind`, `data-color`, paint as inline style: tokens `--im-physical`, `--im-map`,
  `--im-req`, stored concept colours, `NOTE_MINI`; the prototype's opacities), or "Empty canvas" (`aria-hidden`).
- `page.tsx` computes the thumbnails from the rows it already reads (one index, `canvasThumbnails`) and hands each tile
  its `<CanvasThumbnail>` as a slot (`CanvasTiles`'s `thumbnails`). `loadProjectView` and the canvas page are
  unchanged (F3).

### The bytes, against `slice-12a`

How: `e2e/slice-12b/S12B-bytes.spec.ts`, which runs only in the measurement build and is left out of the normal run.
The same file ran on `slice-12a` in `../infomapper-ab-main`. Results are in `.data/measure/s12b-bytes/` (branch) and
in the worktree's `.data/measure/s12b-bytes/` (`slice-12a`). The spec does two things:
- It reads the project home's document as the server sends it, splits off the embedded RSC payload (the
  `self.__next_f.push` scripts), measures the thumbnails' `<svg>` markup, and counts how often each path's `d` occurs.
- It records the answers to three writes on the home: a label's pin, the project's name, Undo.

| | "Performance test" (3 canvases) | "Performance test – 20 canvases" |
| --- | --- | --- |
| document, `slice-12a` | 449,864 B | 1,095,071 B |
| document, branch | 496,611 B | 1,487,913 B |
| **document, growth** | **+46,747 B (+45.7 KB; bar 50 KB)** | **+392,842 B (+383.6 KB; bar 350 KB)** |
| of it, the SVG markup | 21,295 B | 180,760 B |
| of it, the RSC payload | +25,452 B | +212,082 B |
| copies of each path in the document | 2 (markup + payload) | 2 per thumbnail |
| a write's answer, `slice-12a` (pin / name / Undo) | 222,793 / 222,885 / 222,904 B | 545,407 / 545,520 / 545,518 B |
| **a write's answer, growth** | **+23,479 B each (+22.9 KB)** | **+197,463 B each (+192.8 KB)** |
| copies of each path in a write's answer | 1 per thumbnail | 1 per thumbnail |

Notes on the figures:
- "Performance test"'s first path occurs twice in each write's answer because two of its canvases ("100 cards" and the
  requirements canvas) have the same layout.
- **The thumbnails are in the document twice.** This holds for any server-rendered content in the App Router: the
  HTML has the markup, and the embedded RSC payload has the same tree again, as JSON inside a JavaScript string
  (escaped, so a little larger). Where the SVG sits does not change it: a server component inside or outside the
  client tile, and a string through `dangerouslySetInnerHTML`, are each still in both copies.
- Every write on the home re-renders the page (`revalidatePath`), so every answer carries the thumbnails once again.
- **More than step 2's estimate** (298 KB for the 20-canvas project): the paint as inline style on each path, the
  `data-kind`/`data-color` attributes and the payload's escaping. The path data alone is 127 KB of the 384 KB.

### Proposals (before the rest of step 4)

- **A. The thumbnails out of the document: an `<img>` per tile from a route handler** (recommended).
  - The route: `GET /w/{workspace}/thumbnail/{canvas}.svg?v={hash}`. It checks the session and the workspace as
    pages do, computes the same drawing and answers SVG with long caching.
  - The page computes the drawings anyway and puts a short hash of each into the URL, so a change or an undo gives a
    new address (S12B-04).
  - Estimated cost: in the document and in each write's answer, about 150 B per tile in each copy (about 6 KB for 20
    tiles). Each SVG is about 6–9 KB, fetched in parallel after the document, and cached while the canvas does not
    change.
  - Costs:
    - S12B-09 would read "the tiles' `<img>` are in the server's HTML, and their SVG comes from the server" instead of
      "the SVG is in the HTML". The images still show with JavaScript off.
    - One route handler more.
    - LCP must be checked again, since an image in the strip may become the largest paint. If it does, step 5 reads it
      against the bars.
- **B. Keep the SVG inline, but compacter.**
  - Paint by class (`class="e"` and so on; the opacities in `globals.css`), with `fill` only for a stored colour.
  - No `data-` attributes: specs read the class.
  - Relative path commands.
  - Estimate: about +270 KB in the 20-canvas document, still two copies, and about +135 KB on every write's answer. It
    passes the bar, but with less room, and it keeps the cost on every write.
- **C. Fewer shapes:** for example no lines below a size, or one line per pair only up to a limit. This changes what
  the thumbnail shows (P2), so it is a product decision.

Recommendation: A, with B's class paint in the SVG file itself.

