# InfoMapper

A data-modeling tool for data warehouse work: logical entities, physical source tables and the mappings between them, on one canvas.

**Status:** slices 0 to 7b are merged. On a React Flow canvas: slice 0's sign-in, organizations, workspaces, projects and
canvases; slice 1a's model (concepts, entities, attributes, relationships, source systems, tables and columns, and
mappings with one or more inputs); slice 1b's modeling on the canvas (drag a column onto an attribute to map it, draw
relationships, create entities with the Entity tool or the right-click toolbox, reorder attributes, widen cards, see a
row's connections by hovering, place feeding sources beside a card, undo and redo every change); slice 2a's selection
of several cards, group actions, canvas look and layers; slice 2p's measuring tools; and slice 2b's frames, which
stand for a concept, a source system or just an area, with membership, the concept question, label chips, “Put in a
new frame” and “Arrange into frames”; slice 2c's collapsed frames: a frame collapses into one block listing its cards,
the lines to and from them are bundled per pair of ends with a count, a bundle's panel shows what it holds, “Collapse
all” / “Expand all”, and reviewers and readers collapse in their own tab only; slice 3a's working labels (tickets and
change requests on entities, attributes, mappings, tables and columns, kept apart from the model, with marks on the
canvas, a label panel and pins on the project home) and notes on the canvas (free or pinned to a card or frame, open or
resolved, in the selection, counted on cards, blocks, the canvas overview and the project home); slice 3b's active
working context (while it is on, everything you create or change in the model gets its label in the same undo step)
and live label canvases (a label's own canvas that shows exactly what carries it, with context cards for partly
labeled entities and tables, follows every labeling, and adds or removes the label when a card is added or removed
there, after a question), and the notes in the Overview's miniature; slice 4a's requirements everywhere but the canvas (a Requirements tab, the
requirement panel with coverage computed from the mappings, Requirements sections in the element panels, the project
home and the status bar, reviewers setting the status as their approval, four-eyes) and the rich-text editor for
definitions and descriptions; slice 4p's performance review: the hover and selection marks on an overlay of their own
(C-10 from about 120 ms to about 19 ms), the fading mechanism slice 4b's Focus and requirement lens will use, and error
pages with a boundary around the canvas; slice 4b-1's requirements on the canvas: requirement markers on
cards, coverage colours when a requirement is selected (blue covered, orange gaps; a dot below 40 % and on collapsed
blocks), Focus on any selection from the toolbar, the menus and a chip, entity links as items of their own, and figures
measured to the screen; slice 4b-2's requirement cards: a violet card per requirement with a three-part coverage bar
and dashed trace lines to what it is linked to, placed from the requirement's panel and the element panels (beside the
element, never over a frame), a requirement dragged from the left panel onto a row, a card or a mapping line linked to
it at once, Focus lighting the cards whose scope holds the focused element, and the project home opening the canvas that
shows most of a requirement; slice 5a's side panels: the toolbar's buttons at its two ends show and hide the object browser
and the details panel, their inner edges resize them (a guide line while dragging, double-click to reset, the arrow
keys), the layout is remembered per person, the model stays in place when the left panel changes, and up to 1000 px
wide the panels slide over the canvas; slice 6a's view-state bar: chips at the end of the breadcrumbs row for everything
that hides or fades things on the canvas (Focus, the layer, row filters, collapsed cards and frames, hidden resolved
notes, the active tool; a live canvas's “Live: {name}” first), each removed with its ×, “Show all” as one undo step for
the layout part, chips that do not fit folded into “+{n}”, “Open notes on canvas {n}” in the status bar, a top bar that
fits every width from 800 to 2,560 px (short labels, then “More” for Focus, the notation and the tools), and a
remembered view that stays put beside another left panel; slice 6b's back and forward: two buttons before the
breadcrumbs, Alt+←/→, the browser's back and the mouse's buttons walk one history, the browser's own, in which pages and
single selections are places (going back selects the item, centres it when it is off screen and never opens a hidden
details panel; a place that no longer exists says so); slice 7a's source import: “Import sources…” describes a system
from a file in InfoMapper's source standard, a catalog query's result (SQL Server, PostgreSQL, Oracle) or DDL scripts,
and re-imports it; a review shows every new, changed, renamed, missing and returning table, column and relationship and
the approved mappings that go back to review before anything is written, and the import is one undo step; missing
tables and columns are marked in the Sources tab, on the canvas and in the panels, and each system has a panel with its
imports; slice 7b's changes to resolve: every source change an import finds that needs a decision (a column or table
that left, a new column or table, an approved mapping sent back for a type conflict, a business key change or a
rewritten rule) waits on the system's and the table's panels, counted in the tree and the status bar, with actions
that show their consequences first and are one undo step each (retire as historical, move the mappings, delete with
what goes with it and the coverage change, map, not needed, approve again under four-eyes, approve again all), the
review's callouts before the import, model consistency on the project home and the canvas's Changes view, which fades
what source changes do not touch. Acceptance:
[slice 0](docs/prd/slice-00-acceptance.md), [slice 1a](docs/prd/slice-01a-acceptance.md),
[slice 1b](docs/prd/slice-01b-acceptance.md), [slice 2a](docs/prd/slice-02a-acceptance.md),
[slice 2p](docs/prd/slice-02p-acceptance.md), [slice 2b](docs/prd/slice-02b-acceptance.md),
[slice 2c](docs/prd/slice-02c-acceptance.md), [slice 3a](docs/prd/slice-03a-acceptance.md), [slice 3b](docs/prd/slice-03b-acceptance.md), [slice 4a](docs/prd/slice-04a-acceptance.md), [slice 4p](docs/prd/slice-04p-acceptance.md), [slice 4b-1](docs/prd/slice-04b1-acceptance.md), [slice 4b-2](docs/prd/slice-04b2-acceptance.md), [slice 5a](docs/prd/slice-05a-acceptance.md), [slice 6a](docs/prd/slice-06a-acceptance.md), [slice 6b](docs/prd/slice-06b-acceptance.md), [slice 7a](docs/prd/slice-07a-acceptance.md), [slice 7b](docs/prd/slice-07b-acceptance.md).

## Getting started

Requires Node.js 22 and npm.

```
npm install
npx playwright install chromium   # once, for the end-to-end tests
npm run seed                      # demo data in .data/dev-db.json
npm run dev                       # http://localhost:3000
```

Open http://localhost:3000 and pick a test user on the development sign-in page. The demo data mirrors the prototype,
including its model (concepts Customer, Sales, Product, Reference data; sources CRM, WEB, ERP) on the canvases of
Retail Co – DWH and Sales analytics, and the prototype's five requirements (REQ-101 to REQ-105) in Retail Co – DWH.
The demo's sources record no import (“not imported yet”). To try the import, use the test files in
`src/domain/import/samples/` (the prototype's CRM, HR and flat-file samples, its DDL scripts, and catalog-query results
of the demo's systems; see the README there): “Import sources…” at the top of the Sources tab.

| Organization | Workspace | People |
| --- | --- | --- |
| InfoMate | Retail Co – DWH (projects Customer 360 and Order management) | Łukasz owner, Anna Nowak modeler, Piotr Wiśniewski reviewer, Kasia Zielińska reader (guest) |
| InfoMate | Bank X – Risk DWH (archived) | Łukasz owner, Anna Nowak modeler |
| Retail Co | Sales analytics | Marek Lis owner, Łukasz reviewer (guest) |

Until the database slice (last, AD-31), data lives in a JSON file on the server and sign-in means picking a test user
(AD-29). Both exist only in development: a production build refuses them.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Local app with hot reload on http://localhost:3000 |
| `npm run build` / `npm start` | Production build and server (no development sign-in, no local data) |
| `npm run lint` | ESLint, including the layer rules (AD-19) |
| `npm run typecheck` | Route types, then TypeScript (strict) |
| `npm test` | Vitest unit tests (`src/**/*.test.ts`, `tests/`) |
| `npm run e2e` | Playwright end-to-end tests (`e2e/`). Starts its own dev server on port 3200 with `.data/e2e-db.json`, freshly seeded before every test, so it runs next to `npm run dev` |
| `npm run seed` | Creates the demo data in `.data/dev-db.json` if it does not exist yet |
| `npm run reset-dev-data` | Replaces `.data/dev-db.json` with fresh demo data |
| `npm run seed:large` | Adds the workspace “Performance test” for Łukasz (the canvas spike's 100-card data set, with 8 frames since slice 2b, and labels and 24 notes since slice 3a, and PERF-2's live canvas since slice 3b, and since slice 4b-2 the canvas “Performance test – requirements”: the same layout with 12 requirement cards and 126 trace lines) to `.data/dev-db.json`; a file that has it already is left alone (`npm run reset-dev-data` first) |
| `MEASURE=1 npx playwright test e2e/slice-01a/S1A-14.spec.ts` | The canvas performance measurement (S1A-14) in installed Google Chrome, headed; results in `test-results/S1A-14.json` |
| `MEASURE=1 npx playwright test e2e/slice-01b/S1B-09.spec.ts` | Card resize on “Performance test” (C-09), same way; results in `test-results/S1B-09.json` |
| `MEASURE=1 npx playwright test e2e/slice-01b/S1B-10.spec.ts` | Hover delay (C-10) and three pan-and-zoom runs against slice 1a's median, same way; results in `test-results/S1B-10.json` |
| `MEASURE=1 npx playwright test e2e/slice-02a/S2A-14.spec.ts` | Group drag and the selection marks after a lasso on “Performance test” (S2A-14), same way; results in `test-results/S2A-14.json`, `S2A-14-lasso.json` |
| `npm run measure:canvas` | Every canvas performance figure (pan and zoom, C-08, C-09, C-10, drags, lasso marks) in the measurement build, A/B against the tag `slice-02a` (`--against`, `--rounds`, `--drop`, `--prepare-only`, `--quick`); summary table in `.data/measure/<sitting>/summary.md` (slice 2p). Slice 2b's quick round: `npm run measure:canvas -- --rounds 1 --against slice-02p`. Slice 2c's (S2C-12): `npm run measure:canvas -- --quick --rounds 1 --against slice-02b`, then the same with `--branch-diag collapsed` (every frame collapsed on this branch's side). Slice 3a's (S3A-14): `npm run measure:canvas -- --quick --rounds 1 --against slice-02c`, then the same with `--branch-diag collapsed`. Slice 3b's (S3B-15 b): a discarded warm-up run first, then `npm run measure:canvas -- --quick --rounds 2 --against slice-03a` and the same with `--branch-diag collapsed`. Slice 4b-1: `--to-screen` measures interactions to the GPU present and pans as presented frames (traced, both sides), `--only fading,pan,c10,lasso,c08,colours` a subset; a side whose quiet check fails drops its round and a replacement follows |
| `npm run measure:canvas -- --to-screen --only s4b2pans,c10,lasso,c08,s4b2focus,s4b2screen,s4b2drag --rounds 3 --no-build --against slice-04b1` | Slice 4b-2's closing sitting: S4B2-10 and S4B2-14's pans (`e2e/slice-04b2/S4B2-10.spec.ts`, both sides), C-10, the lasso and C-08 (both sides), S4B2-11 to S4B2-13 (this branch); `--prepare-only` first makes both builds |
| `MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-04b2/S4B2-15-layers.spec.ts` | S4B2-15's reads (slice 4b-2): drawing layers, their megapixels and viewport elements on “100 cards” and “Performance test – requirements”, and requirement cards moved over a frame; copy the spec into the reference worktree for `slice-04b1`'s side |
| `MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-05a/S5A-08.spec.ts` | Slice 5a's diagnosis to the screen: hiding and showing each side panel and a resize on release, on “Performance test” at 30 % and 100 % dense, with a LayerTree read (`test-results/S5A-08.json`) |
| `MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-06a/S6A-09.spec.ts` | Slice 6a's diagnosis to the screen: Focus through its chip, “Show all” against the controls, a chip appearing (`HAND_ONLY=1`: only that pair), with a LayerTree read (`test-results/S6A-09.json`) |
| `MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-06a/S6A-09-hand.spec.ts` | A chip appearing, phase by phase (script, style, layout, paint), with and without the bar (`test-results/S6A-09-hand.json`) |
| `npx tsx scripts/to-screen.ts <folder>` | Analyses saved traces again (slice 4b-1): every switch to the screen (median, p95, max, the split into main thread, GPU raster and rest, the switches not settled) and every pan's presented frames |
| `MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-03b/S3B-15-elements.spec.ts` | S3B-15 (a): the elements in the viewport of “Performance test” at 100 % and 30 %, frames expanded and collapsed; with `ELEMENTS_BASELINE=<file>` they must equal the previous tag's (`test-results/S3B-15-elements.json`) |
| `MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-03b/S3B-15-live.spec.ts` | S3B-15 (c): pan and zoom at 100 % on PERF-2's live canvas against “Performance test”, in turns (`test-results/S3B-15-live.json`) |
| `MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-04a/S4A-14-elements.spec.ts` | S4A-14: the viewport counts of “Performance test” must equal `slice-03b`'s (`.data/measure/s4a14-baseline/slice-03b.json`, or `ELEMENTS_BASELINE=<file>`) |
| `npx tsx scripts/bench-import-read.ts` / `bench-import-plan.ts` / `bench-import-write.ts` | Slice 7a's import figures on synthetic files: reading the standard and translating DDL (20,000 and 100,000 column rows), planning a re-import with 5 % changed, and writing, re-importing and undoing through the local adapter on a copy of the demo data (`bench-import-write.ts 20000`) |
| `MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-07a/S7A-14-review.spec.ts` | Slice 7a: switching the review's filters on a 20,000-column file and its re-import (`test-results/S7A-14-review.json`) |
| `npx tsx scripts/bench-consistency.ts` | Slice 7b: model consistency's computation after a re-import of 20,000 columns with 5 % changed (bar 50 ms) |
| `npm run seed:large -- --changes` | Slice 7b: `seed:large` plus an import into each system of “Performance test” with 16 changes to resolve on 9 of its 60 tables (the Changes view's figure; without the flag the workspace stays as the element guard counts it) |
| `MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-07b/S7B-16-changes.spec.ts` | Slice 7b: the Changes view on and off, its select and Focus to the screen at 100 % and 30 %, and the project home's load (`test-results/S7B-16.json`, `S7B-16-home.json`) |
| `npx tsx scripts/bench-requirement-index.ts` | Builds the requirement index 30 times on a synthetic model (500 requirements, 5,000 attributes, 2,000 mappings, 3,000 links) and prints the median (slice 4a, not a gate) |
| `MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-04p/S4P-fading.spec.ts` | Slice 4p's fading scenarios on “Performance test” (Focus and four lenses, 100 % and 30 %, frames expanded and collapsed): switching on and off, pan and zoom with fading on and off (`test-results/S4P-fading.json`); `npm run measure:canvas` runs it on both sides |
| `npx tsx scripts/measure-trials.ts --rounds 3 --against slice-04a --sides <ref,ref,…>` | Slice 4p's sitting for several trial branches against a reference, each in its own worktree, in turns (`--prepare-only`, `--no-build`, `--add-round`, `--drop`); summary in `.data/measure/trials-<time>/summary.md` |
| `MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-04p/S4P-10-c08.spec.ts` | Slice 4p's C-08 diagnosis: five traced cold loads, split by kind; raw traces in `.data/measure/s4p10-traces/<time>/` (never committed), broken down with `npx tsx scripts/c08-waiting.ts <folder>` |
| `MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-04p/S4P-11-index.spec.ts` | Slice 4p: the requirement index's build time in the browser (demo data and the synthetic model) |
| `SCREENS=<folder> npx playwright test e2e/slice-04p/S4P-04-screens.spec.ts` | Slice 4p's screenshots (the hover, Focus and the lenses, beside the prototype) into `docs/prd/slice-04p-screens/<folder>/` |
| `npx tsx scripts/measure-ab.ts` | S2A-14's pan and zoom: `main` and this branch in turns, dev server and measurement build, medians compared (within 5 %); `main` in `../infomapper-ab-main`; results in `test-results/S2A-14-ab.json` |
| `npm run measure:build` / `npm run measure:start` | The measurement-only production build on the local adapter (AD-31), on http://127.0.0.1:3300 with `INFOMAPPER_MEASURE=1`; `MEASURE=1 MEASURE_BUILD=production npx playwright test <spec>` measures against it |
| `DIAG=nolines` or `DIAG=blocks` with `MEASURE_BUILD=production` | Measurement-only diagnosis (slice 2a): the canvas without its line layer, or every card as its below-40 % block; results get `-diag-…` in their name. Slice 2b: `DIAG=noframes`, `DIAG=nolabels`; slice 2c: `DIAG=collapsed` (every frame shown collapsed, nothing saved; what needs drawn cards is recorded as not applicable); slice 3a: `DIAG=nonotes` (no notes), `DIAG=nolabelmarks` (no label marks) |
| `npm run schema:check` | Applies `supabase/migrations/` to a Postgres and compares the schema with the domain's tables (AD-31; CI runs it) |

**Tests per step:** a large slice runs one full e2e run after each step and two before the merge; a small slice (since
5a) runs the tests of what the step touched plus CI after each step and one full run before the merge (CLAUDE.md).

Optional variables are listed in `.env.example`.

## Repository layout

| Folder | What's in it |
| --- | --- |
| `src/domain` | Pure TypeScript: types, commands, permissions, validation, business rules |
| `src/data` | Repository interfaces (`ports.ts`) and adapters (`local/` now); the only layer that touches stored data |
| `src/app` | Next.js App Router routes, server actions, screens |
| `src/ui` | Shared UI components (shadcn/ui, toasts) |
| `src/canvas` | The modeling canvas (React Flow, AD-24): cards, line layer, Overview, geometry |
| `e2e/` | Playwright acceptance tests, one folder per slice, one file per criterion |
| `tests/` | Repository-level checks (the layer rules) |
| `docs/` | Decisions, data model, PRDs, acceptance, ideas, known limitations, and the prototype (the reference for behaviour) |
| `supabase/migrations/` | Database migrations (Supabase arrives with the database slice, last, AD-31) |
| `spikes/` | Throwaway experiments; not part of the application |

How we work and the architecture rules are in `CLAUDE.md`.
