# CLAUDE.md – InfoMapper

Read this file at the start of every session. It is short on purpose; the details are in `docs/`.

## What this is

InfoMapper is a data-modeling application for data warehouse work. Business analysts model concepts, entities and
attributes, describe physical source tables and columns, map columns to attributes, and trace requirements to all
of it. One workspace holds one model; projects and canvases organise the work on it.

The product owner is Łukasz. He accepts every slice. He reads Polish and English; code, comments, commit messages
and docs in the repository are in English.

## Sources of truth (read before changing behaviour)

| What | Where |
| --- | --- |
| How the product behaves | `docs/prototype/infomapper-model-prototype.html` (open it in a browser and use it) |
| Why it behaves that way | `docs/decisions.md` (`D-xx` UX, `AD-xx` architecture) |
| Tables, columns, rules | `docs/data-model-v2.md` and `supabase/migrations/` |
| What to build now | `docs/prd/slice-XX-*.md`, the current slice only |

If these disagree, stop and ask. Do not resolve a conflict silently.

## How we work (AD-25)

- **One slice at a time.** Build only what the current PRD asks for. Do not add features, screens or options that
  are not in it, even small ones. Put ideas in `docs/ideas.md` and mention them at the end of your answer.
- **Work in the steps the PRD lists, and stop after each step** with a short summary of what changed and how to
  check it. Wait for Łukasz before the next step unless he said to continue.
- **One branch per slice** (`slice/00-skeleton`, …), small commits in Conventional Commits style
  (`feat:`, `fix:`, `test:`, `docs:`, `chore:`). Never push to `main` directly.
- **Done means:** the PRD’s acceptance tests pass, `npm run lint`, `npm run typecheck`, `npm test` and
  `npm run e2e` pass, and you have described anything you assumed.
- **When unsure, ask.** A question costs less than a wrong guess.

## Architecture rules

**Layers (AD-19).** Code lives in `src/`:

```
src/domain   pure TypeScript: types, commands, validation, business rules. No React, no Next.js, no database.
src/data     repository interfaces and their adapters: a local JSON-file adapter now (AD-29), Supabase later.
             Only this layer touches stored data.
src/app      Next.js App Router routes, server actions, route handlers, screens.
src/ui       shared UI components (shadcn/ui based).
src/canvas   the modeling canvas.
tests/       repository-level checks outside the layers (e.g. the layer rules). Not application code.
```

Imports go one way: `app` → `canvas` → `ui` → `domain`; `app` and `canvas` may also skip a step (e.g. `canvas` → `domain`);
`app` → `data` → `domain`. `ui` never imports from `canvas`. `domain` imports nothing from the other layers.
`npm run lint` enforces this (`eslint.config.mjs`).

**Writes (AD-23).**
- Every write goes through the server (server actions or route handlers) and then through a `domain` command.
  The browser never writes to the database and never holds the service-role key.
- A write command: checks permissions (role, archive, four-eyes; AD-05, AD-06, AD-09), validates input (Zod at the
  boundary), checks `version` (optimistic concurrency, AD-12), writes the rows **and** their `change_event` records in
  one transaction (AD-13), and returns the new state.
- Deletes are soft (`deleted_at`). Cascades are done by the domain, not the database.

**Data (AD-10 – AD-18).**
- Ids are UUID v7 created in the application (`src/domain/ids.ts`). The database never generates ids.
- Every model and work table has `workspace_id`; every query filters on it.
- Closed value lists are `text` with a `CHECK` constraint. No enum types, triggers, stored functions or arrays in
  the core schema.
- Rich text: store sanitized HTML in `*_html` and the server-derived plain text in `*_text` (AD-17). Sanitize on the
  server even if the client already did.
- Migrations: new file in `supabase/migrations/` named `YYYYMMDDHHMMSS_description.sql`. **Never edit a migration
  that has been applied**; write a new one. Every new table gets `alter table … enable row level security;`.

**UI (AD-20).** Tailwind and shadcn/ui; Tiptap for rich text. Match the prototype’s layout, wording and behaviour;
visual polish may improve, behaviour may not change without a decision.

**Canvas (AD-24).** The engine decision is still open. Do not start canvas work beyond what the current PRD asks.

**Local adapter and development sign-in (AD-29).** Until the Supabase slice, data lives in a JSON file on the server
(`.data/dev-db.json`, git-ignored) and people sign in by picking a test user. Both exist only in development: a
production build must refuse to start them. The local adapter enforces the same rules as a real database would:
versions, change events in the same write, uniqueness and the “exactly one target” checks from the data model.

## Testing (AD-21)

- `domain`: Vitest unit tests next to the code (`*.test.ts`). Every business rule gets a test.
- Each slice: Playwright end-to-end tests in `e2e/slice-XX/`, one per acceptance criterion in the PRD, named after
  the criterion id. They run against a seeded local database, never against production.
- Use `data-testid` attributes for elements tests need; name them after the components (e.g. `card-entity`,
  `panel-inspector`, `nav-breadcrumbs`).

## Security

- Secrets only in `.env.local` (git-ignored). Keep `.env.example` up to date with every variable, without values.
- The Supabase service-role key is used on the server only. Row Level Security stays on for every table with no
  public policies unless a decision says otherwise.
- Never log personal data or rich-text content.

## Things not to touch

- `docs/prototype/` – the frozen reference.
- `spikes/` – throwaway evaluations; only change them when asked.
- `docs/decisions.md` and `docs/data-model-v2.md` – change only together with Łukasz, in the same pull request as the
  code that needs the change.

## Commands

```
npm run dev              # local app on http://localhost:3000
npm run build            # production build (npm start serves it)
npm run lint             # ESLint, including the layer rules (eslint-plugin-boundaries)
npm run typecheck        # tsc --noEmit
npm test                 # Vitest: src/**/*.test.ts and tests/
npm run e2e              # Playwright: e2e/, starts the dev server itself
npm run seed             # demo data into .data/dev-db.json
npm run reset-dev-data   # wipe .data/ and seed again
```

Next.js 16 notes for agents are in `AGENTS.md` (managed by `next dev`; keep it committed).
shadcn/ui components go to `src/ui/components` (`npx shadcn add <name>`).
