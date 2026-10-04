# InfoMapper

A data-modeling tool for data warehouse work: logical entities, physical source tables and the mappings between them, on one canvas.

**Status:** slice 1a (the model, visible) – on top of slice 0's sign-in, organizations, workspaces, projects and
canvases: concepts, entities, attributes, relationships, source systems, tables and columns, and mappings with one or
more inputs, shown on a React Flow canvas with mapping and relationship lines and edited in the left and right panels.
Modeling on the canvas itself (dragging mappings, drawing relationships, undo) is slice 1b. Acceptance:
[slice 0](docs/prd/slice-00-acceptance.md), [slice 1a](docs/prd/slice-01a-acceptance.md).

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

Until the Supabase slice, data lives in a JSON file on the server and sign-in means picking a test user (AD-29). Both
exist only in development: a production build refuses them.

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
| `npm run seed:large` | Adds the workspace “Performance test” for Łukasz (the canvas spike's 100-card data set) to `.data/dev-db.json` |
| `MEASURE=1 npx playwright test e2e/slice-01a/S1A-14.spec.ts` | The canvas performance measurement (S1A-14) in installed Google Chrome, headed; results in `test-results/S1A-14.json` |

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
| `supabase/migrations/` | Database migrations (Supabase arrives in its own slice) |
| `spikes/` | Throwaway experiments; not part of the application |

How we work and the architecture rules are in `CLAUDE.md`.
