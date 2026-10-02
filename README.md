# InfoMapper

A data-modeling tool for data warehouse work: logical entities, physical source tables and the mappings between them, on one canvas.

## Getting started

Requires Node.js 22 and npm.

```
npm install
npx playwright install chromium   # once, for the end-to-end tests
npm run dev                       # http://localhost:3000
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Local app with hot reload |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | ESLint, including the layer rules (AD-19) |
| `npm run typecheck` | TypeScript, strict |
| `npm test` | Vitest unit tests |
| `npm run e2e` | Playwright end-to-end tests (starts the dev server) |
| `npm run seed` | Creates the demo data in `.data/dev-db.json` (slice 0, step 3) |
| `npm run reset-dev-data` | Wipes the local data and seeds again (slice 0, step 3) |

## Repository layout

| Folder | What's in it |
| --- | --- |
| `src/domain` | Pure TypeScript: types, commands, validation, business rules |
| `src/data` | Repository interfaces and adapters; the only layer that touches stored data |
| `src/app` | Next.js App Router routes, server actions, screens |
| `src/ui` | Shared UI components (shadcn/ui) |
| `src/canvas` | The modeling canvas |
| `e2e/` | Playwright acceptance tests, one folder per slice |
| `tests/` | Repository-level checks (e.g. the layer rules) |
| `docs/` | Decisions, data model, PRDs and the prototype (the reference for behaviour) |
| `supabase/migrations/` | Database migrations (Supabase arrives in its own slice) |
| `spikes/` | Throwaway experiments; not part of the application |

How we work and the architecture rules are in `CLAUDE.md`.
