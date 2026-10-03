# Slice 0 – Skeleton

Status: ready to build · Branch: `slice/00-skeleton` · Decisions: AD-01, AD-05 – AD-07, AD-09, AD-11 – AD-13,
AD-19 – AD-23, AD-25, AD-29, D-27 – D-29, D-38

## Goal

A running InfoMapper application that a person can sign in to (development sign-in), move around
**organization → workspace → project → canvas**, and create workspaces, projects and canvases, with roles and the
archive enforced on the server. No modeling yet: the canvas is an empty placeholder.

This slice proves the foundations every later slice builds on: the code layers, server-side writes through domain
commands, record versions, the change log and permissions, all on the local data adapter (AD-29).

## Reference

- Behaviour: `docs/prototype/infomapper-model-prototype.html`. Use it for the top bar, the user indicator, the
  workspace home, the project home and the canvas tabs. Everything else in the prototype is **not** part of this slice.
- Data: `docs/data-model-v2.md`, tables `app_user`, `organization`, `organization_member`, `workspace`,
  `workspace_member`, `project`, `canvas`, `project_canvas`, `change_event`. Use the same names and columns in the
  domain types and the JSON file, so the Supabase adapter can later map them one to one.

## In scope

1. Project scaffold with the agreed layers, tooling and scripts.
2. Domain foundation: ids, types for the tables above, roles and permissions, write commands with version checks
   and change events.
3. Local JSON-file adapter behind repository interfaces, plus seed data.
4. Development sign-in and sign-out.
5. App shell and screens: top bar with switchers and user indicator, breadcrumbs, workspace home (Overview, People,
   Settings), project home, canvas page with tabs and an empty canvas.
6. Writes in this slice: create workspace, edit workspace settings, archive and unarchive, create project,
   create canvas, rename canvas, add an existing canvas to another project.

## Out of scope

Real authentication and Supabase (own slice, AD-29) · the canvas engine and anything on the canvas (AD-24) ·
concepts, entities, sources, mappings, labels, notes, requirements · baselines · invitations, transfer, duplicate
and delete of workspaces · navigation history and the view-state bar (D-38, D-39) · left and right panels beyond
empty placeholders.

## Steps (stop after each one and report)

### Step 1 – Scaffold
- Next.js (App Router, TypeScript strict), Tailwind, shadcn/ui, ESLint, Vitest, Playwright; `npm` as package manager.
- Folders `src/domain`, `src/data`, `src/app`, `src/ui`, `src/canvas`, `e2e/slice-00`.
- An ESLint rule that enforces the import direction from `CLAUDE.md` (e.g. `eslint-plugin-boundaries`); a file in
  `src/domain` importing from `src/data` or React must fail `npm run lint`.
- Scripts: `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `e2e`, `seed`, `reset-dev-data`.
- `.env.example`, `.gitignore` (including `.data/`), short `README.md`; fill in the Commands section of `CLAUDE.md`.

### Step 2 – Domain foundation (`src/domain`)
- `ids.ts`: UUID v7 generator (AD-11).
- Types for the tables in scope, mirroring `docs/data-model-v2.md`, including the standard columns (AD-12).
- `permissions.ts`: what each role may do (AD-05). Archived workspace: nothing may change except unarchive by the
  owner (AD-09). Guests: derived (member of the workspace, not of its organization).
- Commands for every write in scope. Each command receives the acting user and the expected `version`, checks
  permissions, validates input, and returns the rows to write plus their `change_event` records with one
  `change_group_id` (AD-13). Commands do not touch storage.
- Unit tests for every permission rule and every command, including a stale `version`.

### Step 3 – Local adapter and seed (`src/data`)
- Repository interfaces in `src/data/ports.ts`; the local adapter in `src/data/local/`.
- Storage: one JSON file `.data/dev-db.json`. A write applies all rows and change events of one command together or
  not at all: write to a temp file, then rename. Serialise writes in the process.
- The adapter enforces: unknown ids rejected, `version` must match, unique names where the data model has a unique
  index, soft delete hides rows.
- The adapter refuses to load when `NODE_ENV=production`.
- `npm run seed` creates the demo data below; `npm run reset-dev-data` wipes and seeds again.

Seed data (mirrors the prototype):

| Organization | Workspace | Members |
| --- | --- | --- |
| InfoMate | Retail Co – DWH (2 projects: Customer 360, Order management; canvas “Customer & orders” in both, “Order lines & products” only in Order management) | Łukasz owner, Anna Nowak modeler, Piotr Wiśniewski reviewer, Kasia Zielińska reader (guest from Retail Co) |
| InfoMate | Bank X – Risk DWH, **archived**, DV2 mode and four-eyes on | Łukasz owner, Anna Nowak modeler |
| Retail Co | Sales analytics | Marek Lis owner, Łukasz reviewer (guest from InfoMate) |

Organization members: InfoMate – Łukasz, Anna, Piotr; Retail Co – Kasia, Marek.

### Step 4 – Development sign-in
- `/sign-in` lists the seeded users with their organizations; choosing one sets an http-only session cookie with the
  user id. A visible banner says “Development sign-in”.
- Every other route requires a session; without one it redirects to `/sign-in`. Sign-out clears the cookie.
- In a production build `/sign-in` returns 404 and the session check refuses the development cookie.

### Step 5 – Shell and screens (`src/app`, `src/ui`)
Routes (suggested): `/w/[workspaceId]` (workspace home), `/w/[workspaceId]/p/[projectId]` (project home),
`/w/[workspaceId]/p/[projectId]/c/[canvasId]` (canvas). After sign-in go to the last used workspace, else the first
one (AD-07).

- **Top bar:** `Organization ▾ / Workspace ▾ / Project ▾` switchers as in the prototype; the user indicator on the
  right shows initials and role, coloured: neutral for owner/admin/modeler, amber for reviewer, red for reader or an
  archived workspace; its menu shows name, e-mail, role with one sentence on what it allows, and Sign out.
- **Breadcrumbs** under the top bar, each part clickable.
- **Workspace home**, tabs:
  - *Overview:* stats (projects; the model counts show 0 in this slice), project tiles (no thumbnails yet), “New
    project” for roles that may create, archive/unarchive box for the owner, archived banner when archived.
  - *People:* members with roles and guest badges, read-only in this slice.
  - *Settings:* name, client, description, documentation language, Data Vault 2.0 mode, four-eyes. Editable by owner
    and admin, read-only for others.
- **Project home:** canvas tiles (empty thumbnail), “New canvas”, “Add a canvas from another project”, tile menu with
  rename and “In projects” (membership checkboxes, D-28).
- **Canvas page:** tabs of the project’s canvases plus Home; left panel, canvas area and right panel as empty
  placeholders (“The canvas arrives in slice 1”).
- **Workspace switcher** has “New workspace” (name, then Enter), which creates an empty workspace in the current
  organization with the creator as owner, one project “First project” and one canvas “First canvas”.

All writes call server actions that run the domain command and the adapter. The UI hides or disables what the role
may not do, and the server refuses it anyway.

### Step 6 – Acceptance tests and wrap-up
- Playwright tests for every criterion below in `e2e/slice-00/`, against freshly seeded data.
- Update `README.md` and the Commands section of `CLAUDE.md`. List assumptions and ideas (`docs/ideas.md`).

## Acceptance criteria

| ID | Criterion |
| --- | --- |
| S0-01 | Without a session, any page redirects to `/sign-in`. Choosing Łukasz lands on the Retail Co – DWH workspace home. Sign-out returns to `/sign-in`. |
| S0-02 | The top bar shows `InfoMate / Retail Co – DWH / …`. Switching to the Retail Co organization opens Sales analytics; switching workspace opens its home. |
| S0-03 | The user indicator shows “Owner” (neutral) in Retail Co – DWH, “Reviewer · guest” (amber) in Sales analytics and “Archived” (red) in Bank X; its menu states the role and what it allows. |
| S0-04 | As Łukasz in Retail Co – DWH: create project “Finance”, open it, create canvas “Invoices”. It appears as a tile and as a tab; the canvas page shows the empty placeholder. |
| S0-05 | A canvas can be added to a second project and removed from one; a canvas shared by two projects survives removal from one of them (D-28). |
| S0-06 | As Piotr (reviewer) the UI offers no way to create projects or canvases or edit settings, **and** calling those server actions directly is refused with a permission error. |
| S0-07 | In Bank X (archived) all writes are refused, with the archived banner visible. Łukasz unarchives it; writes work again. |
| S0-08 | Two sessions open Retail Co – DWH settings; the first saves a new name; the second saves with the old version and gets “Someone changed this meanwhile. Reload to see the latest version.” Nothing is overwritten. |
| S0-09 | Every successful write adds `change_event` rows sharing one `change_group_id`, with before and after images; refused writes add none. (Checked through the adapter in a test.) |
| S0-10 | After stopping and restarting the dev server, created projects and canvases are still there. |
| S0-11 | Breadcrumbs show where you are on every page, and each part navigates. |
| S0-12 | `npm run lint`, `typecheck`, `test` and `e2e` pass; adding `import "../data/ports"` to a file in `src/domain` makes lint fail. |

## Definition of done

All acceptance criteria pass, the steps were reported one by one, assumptions are listed, and Łukasz has clicked
through S0-01 to S0-08 himself and accepted the slice.
