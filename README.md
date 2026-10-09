# InfoMapper

A data-modeling tool for data warehouse work: logical entities, physical source tables and the mappings between them, on one canvas.

**Status:** slice 2b (frames). On a React Flow canvas: slice 0's sign-in, organizations, workspaces, projects and
canvases; slice 1a's model (concepts, entities, attributes, relationships, source systems, tables and columns, and
mappings with one or more inputs); slice 1b's modeling on the canvas (drag a column onto an attribute to map it, draw
relationships, create entities with the Entity tool or the right-click toolbox, reorder attributes, widen cards, see a
row's connections by hovering, place feeding sources beside a card, undo and redo every change); slice 2a's selection
of several cards, group actions, canvas look and layers; slice 2p's measuring tools; and slice 2b's frames, which
stand for a concept, a source system or just an area, with membership, the concept question, label chips, “Put in a
new frame” and “Arrange into frames”. Acceptance:
[slice 0](docs/prd/slice-00-acceptance.md), [slice 1a](docs/prd/slice-01a-acceptance.md),
[slice 1b](docs/prd/slice-01b-acceptance.md), [slice 2a](docs/prd/slice-02a-acceptance.md),
[slice 2p](docs/prd/slice-02p-acceptance.md), [slice 2b](docs/prd/slice-02b-acceptance.md).

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
Retail Co – DWH and Sales analytics:

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
| `npm run seed:large` | Adds the workspace “Performance test” for Łukasz (the canvas spike's 100-card data set, with 8 frames since slice 2b) to `.data/dev-db.json` |
| `MEASURE=1 npx playwright test e2e/slice-01a/S1A-14.spec.ts` | The canvas performance measurement (S1A-14) in installed Google Chrome, headed; results in `test-results/S1A-14.json` |
| `MEASURE=1 npx playwright test e2e/slice-01b/S1B-09.spec.ts` | Card resize on “Performance test” (C-09), same way; results in `test-results/S1B-09.json` |
| `MEASURE=1 npx playwright test e2e/slice-01b/S1B-10.spec.ts` | Hover delay (C-10) and three pan-and-zoom runs against slice 1a's median, same way; results in `test-results/S1B-10.json` |
| `MEASURE=1 npx playwright test e2e/slice-02a/S2A-14.spec.ts` | Group drag and the selection marks after a lasso on “Performance test” (S2A-14), same way; results in `test-results/S2A-14.json`, `S2A-14-lasso.json` |
| `npm run measure:canvas` | Every canvas performance figure (pan and zoom, C-08, C-09, C-10, drags, lasso marks) in the measurement build, A/B against the tag `slice-02a` (`--against`, `--rounds`, `--drop`, `--prepare-only`, `--quick`); summary table in `.data/measure/<sitting>/summary.md` (slice 2p). Slice 2b's quick round: `npm run measure:canvas -- --rounds 1 --against slice-02p` |
| `npx tsx scripts/measure-ab.ts` | S2A-14's pan and zoom: `main` and this branch in turns, dev server and measurement build, medians compared (within 5 %); `main` in `../infomapper-ab-main`; results in `test-results/S2A-14-ab.json` |
| `npm run measure:build` / `npm run measure:start` | The measurement-only production build on the local adapter (AD-31), on http://127.0.0.1:3300 with `INFOMAPPER_MEASURE=1`; `MEASURE=1 MEASURE_BUILD=production npx playwright test <spec>` measures against it |
| `DIAG=nolines` or `DIAG=blocks` with `MEASURE_BUILD=production` | Measurement-only diagnosis (slice 2a): the canvas without its line layer, or every card as its below-40 % block; results get `-diag-…` in their name |
| `npm run schema:check` | Applies `supabase/migrations/` to a Postgres and compares the schema with the domain's tables (AD-31; CI runs it) |

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
