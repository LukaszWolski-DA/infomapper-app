# Slice 0 – Acceptance

Branch `slice/00-skeleton` · PRD: [slice-00-skeleton.md](slice-00-skeleton.md) · Status: ready for acceptance by Łukasz

Every end-to-end test starts from freshly seeded data (an automatic fixture in `e2e/slice-00/fixtures.ts` resets
`.data/e2e-db.json` before each test), so no test depends on another. Results are from the run of 3 October 2026:
`npm run lint`, `npm run typecheck`, `npm test` (124 unit tests) and `npm run e2e` (20 tests) all pass.

## Criteria and tests

| ID | Criterion | Test(s) | Result |
| --- | --- | --- | --- |
| S0-01 | Without a session, any page redirects to `/sign-in`. Choosing Łukasz lands on the Retail Co – DWH workspace home. Sign-out returns to `/sign-in`. | e2e `S0-01.spec.ts`: "without a session every page redirects to /sign-in; Łukasz lands on Retail Co – DWH; sign-out returns to /sign-in", "after sign-in the last used workspace opens (AD-07)", "a cookie with an unknown user is not a session"; unit `src/app/_lib/dev-session.test.ts` (cookie refused in production) | Pass |
| S0-02 | The top bar shows `InfoMate / Retail Co – DWH / …`. Switching to the Retail Co organization opens Sales analytics; switching workspace opens its home. | e2e `S0-02.spec.ts`: "the top bar shows organization / workspace / project, and the switchers navigate" | Pass |
| S0-03 | The user indicator shows "Owner" (neutral) in Retail Co – DWH, "Reviewer · guest" (amber) in Sales analytics and "Archived" (red) in Bank X; its menu states the role and what it allows. | e2e `S0-03.spec.ts`: "the user indicator shows the role, coloured by what it allows, and its menu explains the role", "a reader is shown in red" | Pass |
| S0-04 | As Łukasz in Retail Co – DWH: create project "Finance", open it, create canvas "Invoices". It appears as a tile and as a tab; the canvas page shows the empty placeholder. ("Finance" ends up with "First canvas" and "Invoices".) | e2e `S0-04.spec.ts`: "Łukasz creates project Finance and canvas Invoices; Finance has First canvas and Invoices as tiles and tabs", "a canvas can be renamed from its tile menu and by double-clicking its tab" | Pass |
| S0-05 | A canvas can be added to a second project and removed from one; a canvas shared by two projects survives removal from one of them (D-28). | e2e `S0-05.spec.ts`: "a canvas can be added to a second project and removed from one; a shared canvas survives removal (D-28)", "a canvas that is only in one project cannot be taken out of it"; unit `src/domain/commands/canvas.test.ts` ("canvas in several projects (D-28)") | Pass |
| S0-06 | As Piotr (reviewer) the UI offers no way to create projects or canvases or edit settings, **and** calling those server actions directly is refused with a permission error. | e2e `S0-06.spec.ts`: "a reviewer gets no way to create projects or edit settings, and the server refuses direct calls", "a reviewer gets no way to create, rename or move canvases, and the server refuses direct calls"; unit `src/domain/permissions.test.ts` | Pass |
| S0-07 | In Bank X (archived) all writes are refused, with the archived banner visible. Łukasz unarchives it; writes work again. | e2e `S0-07.spec.ts`: "in an archived workspace all writes are refused; after the owner unarchives it, writes work again", "only the owner can archive; an admin sees the button disabled with a hint"; unit `permissions.test.ts` ("archived workspace (AD-09)") | Pass |
| S0-08 | Two sessions open Retail Co – DWH settings; the first saves a new name; the second saves with the old version and gets "Someone changed this meanwhile. Reload to see the latest version." Nothing is overwritten. | e2e `S0-08.spec.ts`: "of two sessions saving settings from the same version, the second is refused and nothing is overwritten", "an empty name is refused with the domain's message"; unit `store.test.ts` ("refuses a stale version and writes nothing (S0-08)", "serialises concurrent writes") | Pass |
| S0-09 | Every successful write adds `change_event` rows sharing one `change_group_id`, with before and after images; refused writes add none. (Checked through the adapter in a test.) | e2e `S0-09.spec.ts`: "every successful write adds change events sharing one change group, with before and after images; refused writes add none"; unit `src/data/local/store.test.ts` ("writes the rows and their change events with one change group (S0-09)", "applies all or nothing"), command tests in `src/domain/commands/*.test.ts` | Pass |
| S0-10 | After stopping and restarting the dev server, created projects and canvases are still there. | e2e `S0-10.spec.ts`: "after stopping and restarting the dev server, created projects and canvases are still there" (starts, stops and restarts its own dev server on port 3201) | Pass |
| S0-11 | Breadcrumbs show where you are on every page, and each part navigates. | e2e `S0-11.spec.ts`: "breadcrumbs show where you are on every page, and each part navigates", "pages of a workspace you are not a member of do not exist" | Pass |
| S0-12 | `npm run lint`, `typecheck`, `test` and `e2e` pass; adding `import "../data/ports"` to a file in `src/domain` makes lint fail. | The four commands (run of 3 October 2026); unit `tests/layer-rules.test.ts` ("refuses an import from src/data in src/domain", "refuses React and Next.js in src/domain"); checked by hand with a probe file in `src/domain` | Pass |

## Manual checklist (S0-01 to S0-08)

Start with fresh data and the dev server:

```
npm run reset-dev-data
npm run dev
```

Open http://localhost:3000. Use a second browser window (or a private window) where a step needs two sessions.

**S0-01 – Sign-in**
- [ ] http://localhost:3000 and http://localhost:3000/w/anything both go to `/sign-in`, with the "Development sign-in" banner.
- [ ] Choose Łukasz: you land on the Retail Co – DWH workspace home.
- [ ] User indicator (top right) → Sign out: you are back on `/sign-in`.

**S0-02 – Top bar**
- [ ] Sign in as Łukasz. The top bar reads `InfoMate / Retail Co – DWH / Customer 360`.
- [ ] Organization menu → Retail Co: Sales analytics opens.
- [ ] Organization menu → InfoMate, then workspace menu → Bank X – Risk DWH: its workspace home opens.
- [ ] Project menu → Order management: its project home opens.

**S0-03 – User indicator**
- [ ] Retail Co – DWH: "Owner" in neutral grey/blue; its menu says "In Retail Co – DWH you are Owner." and what an owner can do.
- [ ] Sales analytics: "Reviewer · guest" in amber; the menu mentions "a guest from InfoMate".
- [ ] Bank X – Risk DWH: "Archived" in red; the menu says the workspace is archived and read-only.

**S0-04 – Project and canvas**
- [ ] In Retail Co – DWH, project menu → type "Finance" → Enter. The Finance project home opens with the tile "First canvas".
- [ ] Click "New canvas", type "Invoices" in the tab, press Enter.
- [ ] Finance has "First canvas" and "Invoices" as tabs and, on Home, as tiles. The canvas page shows "The canvas is empty / The canvas arrives in slice 1."

**S0-05 – A canvas in several projects**
- [ ] Customer 360 project home → "Add a canvas from another project" → "Order lines & products". It is now a tile in both projects ("Also in Order management").
- [ ] Order management project home → ⋯ on "Customer & orders" → untick "Order management". The tile disappears from Order management.
- [ ] Customer 360 still has "Customer & orders" and it opens.

**S0-06 – Reviewer**
- [ ] Sign out, sign in as Piotr Wiśniewski. Retail Co – DWH shows the reviewer banner, no "New project" tile, no lifecycle box; the project menu has no "New project" field.
- [ ] Settings tab: all fields are greyed out.
- [ ] A project home: no "New canvas", no "Add a canvas…", no ⋯ menus; double-clicking a tab does not rename it.
- (The refusal of direct server calls is covered by the e2e test.)

**S0-07 – Archive**
- [ ] As Łukasz, open Bank X – Risk DWH: the banner "This workspace is archived. Everything is read-only.", no "New project", settings greyed out.
- [ ] Click "Unarchive" in the banner: the toast "Bank X – Risk DWH is editable again.", the banner goes away and "New project" appears.
- [ ] Workspace lifecycle → Archive: the toast "Archived Bank X – Risk DWH. It is read-only now." and the banner is back.

**S0-08 – Someone changed this meanwhile**
- [ ] Open Retail Co – DWH → Settings as Łukasz in two windows.
- [ ] Window 1: change the name, press Enter. Toast "Settings saved."
- [ ] Window 2 (not reloaded): change the name, press Enter. Toast "Someone changed this meanwhile. Reload to see the latest version."; the field goes back.
- [ ] Reload window 2: it shows window 1's name.

## Assumptions made in this slice

Confirmed with Łukasz during the slice unless marked *open*.

**Scaffold and layers (step 1)**
- `canvas` may import `ui` and `domain`; `ui` never imports `canvas`. Enforced by `eslint-plugin-boundaries` plus a
  `no-restricted-imports` rule for `src/domain` (which also catches imports of files that do not exist yet; as a
  consequence `src/domain` has no folders or files named `data`, `app`, `ui` or `canvas`).
- `AGENTS.md` only points to `CLAUDE.md` and holds the block `next dev` maintains.
- `tests/` holds repository-level checks (the layer rules).
- `npm run typecheck` is `next typegen && tsc --noEmit` (Next.js 16 generates route types first).
- `src/proxy.ts` (Next.js 16's renamed middleware) is outside the layer rules; it only imports `src/app/_lib`.

**Domain (step 2)**
- Archive and unarchive: owner only. Unarchive clears `archived_at` and `archived_by`.
- A new project gets a canvas "First canvas", as in the prototype.
- "A project keeps at least one canvas" and "a canvas belongs to at least one project" apply to every project.
- Link tables without `id` (`project_canvas`, `workspace_member`): `change_event.object_id` is the canvas or the user;
  images hold the full row with both keys; removing a link row logs a `delete` with a null after image (the initial
  migration's check was changed for this, once, before it was ever applied).
- Names are trimmed and must not be empty; there is no maximum length (the data model sets none).
- Any member of an organization may create a workspace in it; guests may not.
- Adding or removing a canvas to or from a project does not change the canvas's or the project's version.

**Local adapter and seed (step 3)**
- Bank X – Risk DWH and Sales analytics each have one project "First project" with one canvas "First canvas".
- Organization roles: Łukasz owns InfoMate, Marek Lis owns Retail Co, everyone else is a member.
- Łukasz is "Łukasz", `lukasz@infomate.pl` (prototype). The prototype's pending invitation is not seeded.
- Seed rows have fixed UUID v7 ids (`SEED_IDS`), so ids survive `reset-dev-data`; rows created in the app get new ids.
- Lists come back in creation order (so Łukasz's first workspace is Retail Co – DWH).
- `INFOMAPPER_DEV_DB` can point the adapter at another file (tests use it).
- Known limitation: the "at least one canvas" rule can race in the local adapter; see
  [known-limitations.md](../known-limitations.md).

**Sign-in (step 4)**
- The session cookie is `infomapper_dev_session` (http-only, ends with the browser session).

**Shell and screens (step 5)**
- The last used workspace and the last project per workspace are kept in browser cookies (data model §12).
- The organization breadcrumb opens that organization's first workspace; the current page's breadcrumb is a link too.
- A workspace you are not a member of (or an unknown id) returns 404.
- Toasts: one at a time, bottom centre; refusals stay 5 s, other messages 2.2 s. Success messages were added where the
  prototype has none ("Created the project …", "Settings saved.", "Created the canvas …", "Renamed the canvas to …").
- Settings save per field (text on blur or Enter, the rest on change) with the version the page loaded; a refused save
  puts the field back to its last saved value (an improvement is in [ideas.md](../ideas.md)).
- The "New project" tile asks for the name first (projects cannot be renamed in slice 0).
- Project and canvas pages use the prototype's three columns; the side panels are placeholders and hide below 1024 px.
- Everything out of scope in the prototype's screens is left out (baselines, invitations, roles editing, duplicate,
  transfer, delete, concept colours, model conventions, requirements, labels, notes, canvas look, navigation history,
  view-state bar).

**Tests (step 6)**
- e2e runs its own dev server on port 3200 with `.data/e2e-db.json` and the build folder `.next-e2e`, so it runs next
  to `npm run dev`. S0-10 starts its own server on port 3201 (`.next-e2e-restart`). Next.js adds these build folders
  to `tsconfig.json`'s `include`; they are also in `exclude`.
- Direct server action calls (S0-06, S0-07, S0-09) replay an action id captured from a real call by Łukasz.
- The admin case of S0-07 needs an admin, which the seed does not have and the UI cannot make in slice 0; the test adds
  Anna as admin to a new workspace through the data adapter as test setup.
