# Slice 39 – InfoCatalog: entry and search

Status: **proposed** (27 November 2026). The first of the InfoCatalog 1 pair (slice 39: entry and search, read only;
slice 40: dependencies and analysis). **Full path** (CLAUDE.md, "The slice cycle", 2): a new module, a new port on both
adapters, a migration, new top-level routes and a change to what sign-in opens. Branch
`slice/39-infocatalog-entry-and-search`, from `dev` (`b93ebe4` or later). PRD file:
`docs/prd/slice-39-infocatalog-entry-and-search.md`; step 1 writes `docs/prd/slice-39-acceptance.md`. Test regime:
CLAUDE.md, "Testing". The slice number is an assumption (step 1 confirms it is the next free one).

**One file in Łukasz's Downloads folder** (The slice cycle, 3): this PRD (SHA-256 given in the prompt). **The prototype
does not change:** the repository's `docs/prototype/infomapper-prototype-with-sources.html` is already the accepted
InfoCatalog prototype (SHA-256 `74c70cd919af6e65eb13f560294de42f6be03fd42d0ff082e546b6d9f0029029`, fact, `b93ebe4`: the
same file as the project's `infomapper-infocatalog-prototype.html`). InfoCatalog is its `PLAT` script block and the CSS
classes `pf-…` (sign-in, `landing()`, `catalog()`, the Search tab, the drawer). **Only parts of it are in this slice**
(section 2, "Not in this slice").

Written from the decision rounds A1 to A6 (`claude/infocatalog-decision-rounds.md`, quoted as "A1.2" etc.), the split
and the criteria agreed with Łukasz on 27 November 2026 (`claude/infocatalog-1-criteria.md`; neither file is in the
repository, so this PRD quotes what it needs), the prototype, and lookups in the code on `dev` at `b93ebe4` (marked
"fact, `b93ebe4`"). Facts and assumptions are marked; every assumption is to be checked in step 1.

## 1. Why

InfoMapper is the modeller's workshop: its metadata (business and technical) is rich but reachable only from inside a
workspace (workspace → project → canvas). InfoCatalog turns this around: start from a question, across the organization,
for business users, data stewards and analysts as well as modellers. Łukasz's principles (25 November 2026): one database
and one source of truth (no copy, no sync); scope the organization and / or one workspace; the model's content changes
only through proposals the modeller accepts (InfoCatalog 3); the catalog's own content in its own fields (InfoCatalog
2); one-way visibility (everything formal in InfoMapper is found in the catalog, nothing of the catalog goes back).

**This slice:** the entry (the landing zone, the licence), who reads what (catalog readers, the switch per workspace),
search across every layer, and an item's details with what it is directly connected to. Read only: nothing is written
by InfoCatalog in this slice.

Decisions taken before this PRD (Łukasz, 26–27 November 2026, on Claude's recommendations):
- **A1.1** InfoCatalog is a module (`src/modules/infocatalog/`) under AD-33 as it stands.
- **A1.2** the guardrails (Claude's technical calls, quoted for approval at the closing): (1) one read port, the catalog
  index, filtered by the reader's rights inside the adapter, with a contract test; (2) the catalog's rights are a core
  concept, one pure function in `src/domain/permissions`; (3) proposals later, as the module's own rows; (4) shared logic
  moves into InfoMapper's domain before reuse; (5) live updates between windows within one browser only; (6) ✦ Ask with
  an AI model is a separate decision; (7) the landing zone is a top-level route, the same sign-in, no new Vercel or
  Supabase project; (8) performance measured in step 1 before building.
- **A2.1** the organization's named users read the catalog of its workspaces, read only, including workspaces where they
  have no role; guests do not; InfoMapper is unchanged. **A2.2** groups later (with Microsoft sign-in). **A2.3** a switch
  per workspace, "Shown in InfoCatalog to everyone in the organization", **off by default** (confirmed 27 November).
- **A3.1** what is searched and the ranking; **A3.2** one detail skeleton for every kind.
- **A6** the landing zone only with the licence; the tile texts; the licence `infocatalog` per organization with no module
  switch per workspace (A2.3's switch plays that part); counting users is a commercial decision for later.
- **The split (27 November):** lineage, impact (A3.6), facets, "has / has no" conditions, the lineage table, Markdown and
  CSV, and the details window for a second screen are **slice 40**. Catalog content and completeness are InfoCatalog 2;
  proposals InfoCatalog 3.

## 2. What to build

### The module and its extension point (S39-06)

- **`src/modules/infocatalog/`** in AD-33's five parts; `"infocatalog"` added to `modules` in `eslint.config.mjs` and to
  `tests/layer-rules.test.ts`. No tables, so nothing in the table registry and no baseline flags (fact, CLAUDE.md, "A new
  module": the registry is for tables).
- **The catalog index port** (A1.2, guardrail 1) in `src/data/ports.ts`, on both adapters. *Assumption, step 1 confirms
  or corrects the shape (Q2):*
  - `catalog.workspacesFor(userId, organizationId)`: the organization's live workspaces the person may read (S39-02),
    each with its name, `archived_at`, InfoCube's switch and whether the person has a role there;
  - `catalog.search(userId, organizationId, query)`: query = text, scope (all readable workspaces or one), kind; returns
    the ranked results and the counts per kind;
  - `catalog.item(userId, workspaceId, kind, id)`: one item's details (S39-04), or "not found" when the person may not
    read it, never a different error that would reveal it exists.
  Rights are applied **inside** the adapter through the domain function below; a screen never filters workspaces itself.
  A contract test in `tests/contract/` runs the same cases on both adapters (readers, guests, the switch, archived).
- **Items from modules** (InfoCube's kinds, InfoDocumenter's documents in the Context section): a module must not import
  another (AD-33), and `src/data` must not import a module. *Assumption (Claude's technical call, Q3):* a new extension
  point **`src/compose/catalog.ts`** where InfoCube contributes its kinds (each kind's rows, searched fields,
  characteristics and neighbours, as plain data and pure functions over its own rows) and InfoDocumenter contributes "the
  documents that include this item, as this person would see them" (its `canSee`, fact, `rights.ts:29`). The port takes
  the composed contributions from `src/compose`; InfoCatalog reads them only through the port. CLAUDE.md's list of
  extension points names it.
- **"May read the catalog"** (A1.2, guardrail 2): one pure function in `src/domain/permissions` (`catalogReadableWorkspaces`
  or as step 1 names it): a person reads a workspace of an organization in the catalog when the organization holds the
  `infocatalog` licence, the person is a member of the organization (not a guest: fact, `isGuest` in `permissions.ts`,
  derived, not stored), and either has a role in the workspace (any role) or its switch is on. **Nothing is stored for the
  right** (fact, D-58: a person belongs to an organization while they have a workspace in it). On the local adapter only
  the organizations the session has unlocked count (fact, D-58 and `session.ts`: online every organization of the person
  is unlocked).
- **Shared components only** (S37's rule, D-89): the screens use `src/ui`'s components. *Assumption:* the drawer is a new
  shared component in `src/ui` (fact, `b93ebe4`: `src/ui/components` has no drawer or sheet), added to the guard's list.

### The licence and the switch (S39-01, S39-02)

- **Migration** `supabase/migrations/2026112…_infocatalog.sql`: `infocatalog` added to `organization_licence_module_ck`
  (fact: the constraint lists `'infocube', 'infodoc'` since `20261111120000_infodocumenter.sql`, which drops and adds it;
  the same pattern), and `workspace.catalog_shown boolean not null default false` (the name is a proposal). The local
  adapter's rules and data file shape follow (the data file's format step, as slice 25's `infodoc`).
- `LICENSED_MODULES` gains `infocatalog`; `MODULE_NAMES` "InfoCatalog".
- **The switch in the workspace's settings** (fact, `src/compose/settings.tsx` draws the modules' boxes): "Shown in
  InfoCatalog to everyone in the organization", a check box with one line under it: "Members of {workspace} always find it
  in InfoCatalog. With this on, everyone in {organization} can find and read it there, but not change it." (wording for
  Łukasz). Set by the workspace's Owner or Admin (as the module switches, AD-35); **hidden while the organization has no
  licence**; refused for an archived workspace as the other settings are. A change event in the workspace's log; not an
  undo step (*assumption:* as the module switches, Q5).
- **Granting the licence online:** fact, `b93ebe4`: `scripts/licence.ts` writes a local data file only; online licences
  came with the seed and `pg:kb`. *Proposal (Q6):* the script gains a Postgres mode (e.g. `npm run pg:licence -- grant
  "<organization name>" infocatalog`), so that after the merge granting KB's organization the licence is one command by
  Łukasz, run only when he decides. For acceptance, the demo organization gets the licence on `infomapper-dev` by the same
  command (Łukasz, one step).

### The landing zone and "All apps" (S39-01)

- **After sign-in** (fact, `src/app/page.tsx`: today it redirects to the last used workspace, else the first one): when
  any of the person's (unlocked) organizations holds the licence, `/` shows the landing zone instead; otherwise the
  redirect stays exactly as today. *Assumption (Q4):* the landing zone is the `/` page itself (no new address), and "All
  apps" links to it with a parameter that skips nothing.
- **Content, as the prototype's `landing()`:** "Good morning / afternoon / evening, {first name}" (the browser's hour);
  the lead line "Two apps on one metadata repository: the model is built in InfoMapper and found, read and described in
  InfoCatalog. A change in one is seen in the other at once."; two tiles:
  - **InfoMapper**, "Model and map": "Build the conceptual, logical and physical model in one place, and map it to the
    sources."; bullets "Entities, attributes, relationships and source tables on canvases" · "Source-to-target mappings
    with review and approval" · "Requirements, baselines and documentation"; count "{n} workspaces you belong to · last:
    {name}"; "Open InfoMapper" (the redirect of today).
  - **InfoCatalog**, "Find and describe" (with the "New" mark): "Search everything the modellers have built, across
    {organization} or in one workspace, and see where each item comes from."; bullets "Entities, attributes, mappings,
    sources, requirements and classifications" · "From the source column to the attribute and the requirement" · **"Where
    each item is used, on canvases and in documents"** (this slice's third bullet, agreed 27 November; the prototype's
    "Descriptions, examples, notes and proposals to the modeller" comes back with InfoCatalog 2 and 3); count "{n} items in
    {m} workspaces of {organization}" (S39-02's readable workspaces); "Open InfoCatalog".
- **Several organizations:** the landing zone shows when any of them holds the licence; the catalog opens on a licensed
  one (the last used workspace's organization when licensed, else the first licensed); InfoCatalog's organization switch
  lists the licensed ones only.
- **"All apps"** in InfoMapper's top bar, only with the licence (the person's current organization's): a 28 px icon button
  with the label "All apps" (the prototype's place: left of the organization; the room it takes is slice 38's top bar's,
  Q4). Keyboard shortcuts of InfoMapper are off while a platform page is open (they are not on those routes).
- **Without the licence**, `/catalog` and every address under it answer "not found" (Next.js `notFound()`, the app's
  not-found page), never a page that says a licence is missing (nothing reveals the module to people without it).
- **A guest** never sees the InfoCatalog tile for an organization where they are a guest (S39-02's function).

### Search (S39-03)

Address `/catalog` (*assumption:* `/catalog?q=…&scope=…&kind=…`, so the state survives a reload and "← Back to
InfoCatalog"; Q4). Layout B of the prototype (iteration 5): one calm centred column (max. 1,100 px).
- **Header:** the apps button (back to the landing zone), "InfoCatalog", the organization (a select when the person has
  more than one licensed), the account (as InfoMapper's).
- **One search field**, `/` puts the cursor in it. No ✦ Ask in this slice.
- **Scope:** "Whole organization (n workspaces)" or "Workspace: …" from S39-02's list; archived workspaces marked
  "Archived".
- **Kind tabs** as quiet text tabs with counts: Entities, Attributes, Relationships, Concepts, Source tables, Source
  columns, Mappings, Requirements, Classifications and stereotypes; when InfoCube is on in a readable workspace, also its
  facts, dimensions, measures, keys and dimensional mappings (from the contribution, section above). *Assumption:* views
  and files are source tables of their kind (fact to check in `data-model-v2.md` § 5, Q7). Declared foreign keys between
  tables and import history are shown in a table's details, not as tabs (*assumption*, Q7).
- **Every word must match** (anywhere in the searched fields, case- and accent-insensitive: "zrodlo" finds "źródło";
  *assumption*, Q8). **Fields searched** (A3.1 less the catalog's own): name, alias, requirement key, definition, the
  full physical name (`db.schema.table.column`), rule expression (calculated attributes, mappings, data quality rules),
  external reference, classification names.
- **Ranking** (A3.1): exact name; alias or requirement key; name starts with the text; in the definition; in a rule or
  another field. Ties in model order (*assumption*). The matches highlighted.
- **Each result** as a plain table row (the prototype's default): the item's name with its definition in one line; kind;
  details (e.g. type, the physical name, cardinality); workspace when more than one is in scope; marks ("Personal data"
  for PII, status, "Archived"). The first 200 results are drawn, with "{n} more: narrow the search" (*assumption*, Q8).
- **An empty field:** example searches (as the prototype) and "Browse all {kind}" for each kind.
- **Performance** (A1.2, guardrail 8; Claude's technical call, threshold accepted by Łukasz): results within **1 second**
  of the last keystroke at KB's size (fact: 4,871 rows); step 1 measures it (the timing record, AD-37) on a model of KB's
  size and of four times that (`src/data/local/large-generator.ts`), both adapters; an index or a stored table only if
  the measurement asks for it, and then behind the port.

### The details drawer (S39-04)

- A click on a result (or Enter) opens the drawer from the right, 560 px; on a screen of 1,100 px or more the column
  moves left so the results stay visible and clickable; narrower, the drawer covers them with a light scrim. ↑ ↓ (or j k)
  move through the results and the drawer follows; Esc closes it.
- **Every item has its own address** (*assumption:* `/catalog/w/{workspaceId}/{kind}/{id}` or a parameter of `/catalog`,
  Q4); a link opens the same item in its drawer; an item the person may not read answers "not found".
- **The skeleton (A3.2, without lineage, impact and catalog content):**
  - **Header:** kind, name, path (e.g. `CRM / dbo.customers / cust_no`, `Customer / email`), workspace, marks, and "From
    InfoMapper · read only".
  - **Characteristics:** the kind's own fields. An entity: stereotype, alias, model level, definition, classifications.
    An attribute: type, PK / FK / BK, PII, nullable, calculated with its rule, definition, classifications. A
    relationship: both entities, roles, cardinality read as a sentence. A concept: definition. A source table (view,
    file): system, physical name, column count, declared foreign keys, last import. A column: physical type, keys,
    missing or retired since. A mapping: source → target, kind, rule, status, who approved. A requirement: kind, status,
    priority, external reference, **its owner marked "from InfoMapper"** (A3.4), for a rule its expression and severity,
    its break-down. A classification or stereotype: its definition and how many items carry it. InfoCube's kinds: from
    the contribution.
  - **Connected items, one step away**, each clickable, opening in the same drawer with "← Back": an entity's attributes,
    relationships and requirements; an attribute's mappings and requirements; a table's columns and the entities it
    feeds; a column's mappings; a mapping's source and target; a requirement's traced items; a concept's entities; a
    classification's items (the first 50, "and {n} more").
  - **Context:** the projects and canvases that show the item (each canvas opens it in InfoMapper, S39-05); the
    InfoDocumenter documents that include it, **only those the reader would see in InfoMapper** (shared in the workspace
    or their own; never someone's private document; through the contribution and InfoDocumenter's `canSee`).
  - **No empty Lineage or Impact sections and no "coming soon":** they arrive in slice 40.

### Open in InfoMapper (S39-05)

- "Open in InfoMapper" opens the item's workspace and a canvas that shows it, the item selected and centred (a mapping: a
  canvas with both ends; a relationship: both entities, the relationship selected; a column: its table's card); the
  canvas is the first in the Context list, and each canvas there opens itself. *Assumption:* InfoMapper's existing
  "select and centre" from a link (the return path, fact: `src/domain/return-path.ts`, Q9) is reused.
- An item on no canvas (a requirement; a column whose table is on none) opens the workspace's home with the line "{name}
  is not on any canvas" (*assumption:* a toast).
- Then InfoMapper's navigation row shows **"← Back to InfoCatalog"**, back to the same search, scope, kind tab and item
  (the catalog's address carried as a return path).
- **A person without a role in that workspace** sees no button; instead: "You have no role in {workspace}. Ask its owner
  for access: {owner names}." (the workspace's Owners, by name; agreed 27 November). AD-05 is unchanged.

### Tests

- **Unit:** the rights function (a member with a role, a member without a role and the switch off / on, a guest, an
  organization without the licence, an archived workspace, the local adapter's unlocked organizations); the ranking and
  the word matching; the connected items per kind.
- **Contract** (both adapters): the port's three reads with the same cases; "not found" for an item of an unreadable
  workspace.
- **Guards:** the layer rules refuse a probe import between `infocatalog` and another module, and from InfoMapper's
  layers into it; the shared-components guard covers the new screens.
- **E2E** (a new folder `e2e/slice-39/`, in a part of the full run step 1 chooses): S39-01 with and without the licence
  (the landing zone, "All apps", `/catalog` not found); S39-02 with the demo accounts (Anna with a role, a member without
  a role and the switch off then on, Kasia the guest); S39-03 (a search per kind, the ranking, every word must match, the
  scope); S39-04 (the drawer, the keyboard, "← Back", an item's address, a private document never shown); S39-05 (open
  on a canvas, "← Back to InfoCatalog", no role).
- **Earlier specs:** sign-in specs that expect the redirect to a workspace run with the demo organization **without**
  the licence, so they do not change (*assumption*, Q10; any that changes is listed with its reason).

### Not in this slice

Lineage and impact in the drawer, the facet filters, the "has / has no" conditions, the query line, the lineage table,
Markdown and CSV, the details window for a second screen (slice 40); saved filters and ✦ Ask; catalog content, stewards,
owners, tags, completeness and the "Catalog editors" right (InfoCatalog 2); proposals and InfoMapper's Proposals tab and
inspector box (InfoCatalog 3); context kinds (projects, canvases, documents, baselines) as kind tabs; the prototype's
Display menu and dark styles of the result blocks; "Open in InfoCatalog" from InfoMapper; a canvas in a second window.

## 3. Data model

- `organization_licence.module`: `infocatalog` added to the CHECK (one migration, drop and add the constraint).
- `workspace.catalog_shown boolean not null default false` (name to confirm in step 1).
- No new table; InfoCatalog stores nothing. No Vercel or GitHub settings. Łukasz runs the migration on
  `infomapper-dev` one step at a time (`pg:backup`, dry run, `pg:migrate`, `pg:backup` again, counts compared).

## 4. Sources

- Decisions: AD-01, AD-04, AD-05 (roles, archive), AD-19 (layers), AD-20's note and D-89 (shared components), AD-33
  (modules, extension points), AD-35 (licences and switches), AD-37 (timing), D-58 (organizations, guests, sign-in),
  slice 38's D-90 (the top bar, the homes).
- Code (fact, `b93ebe4`): `src/app/page.tsx` (after sign-in), `src/app/_lib/session.ts` (`unlocked`),
  `src/domain/permissions.ts` (`isGuest`, `checkPermission`), `src/domain/types.ts` (`LICENSED_MODULES`, `Workspace`),
  `src/domain/model/module-switches.ts`, `src/compose/settings.tsx`, `src/data/ports.ts` (`WorkspaceRepository`,
  `ModelRepository.load`, `ModuleRowRepository`), `src/data/local/large-generator.ts`, `scripts/licence.ts`,
  `src/modules/infodocumenter/domain/rights.ts` (`canSee`), `src/domain/return-path.ts`,
  `supabase/migrations/20261111120000_infodocumenter.sql`, `eslint.config.mjs`, `tests/layer-rules.test.ts`.
- `docs/data-model-v2.md` (§§ 4–7, 15: the kinds and their fields).
- The prototype: the `PLAT` block (`landing()`, `catalog()`, the Search tab, the drawer, keyboard) and its `pf-` CSS.

## 5. Steps

Stop after each step; wait for Łukasz.

1. **Reconnaissance, measurement and check.** Copy this PRD from Downloads into the repository and check it with `cmp`
   and the SHA-256 (stop if it differs); confirm the prototype in the repository is `74c70cd9…9029`. **Measure** search
   (section 2, "Performance") with a throwaway script, no application code: a model of KB's size and four times that,
   both adapters, the time of one search over all readable workspaces. Answer Q1–Q11 in `slice-39-acceptance.md`: every
   place where the PRD is wrong or costs more than it assumes, with a proposal; the plan for steps 2 to 9.
2. **The core and the port:** the rights function, the module's folder and the lint, the extension point, the catalog
   index on both adapters with its contract test (no screen yet). A draft PR into `dev`.
3. **The licence and the switch:** the migration, the local file's shape, the settings' switch, `pg:licence`. **Stop for
   Łukasz's migration** on `infomapper-dev` (one step at a time) and the demo organization's licence.
4. **The landing zone and "All apps".** A full run.
5. **Search.**
6. **The drawer and Open in InfoMapper.**
7. **The after checks:** `npm run ui:check` on the new screens (1,280 and 1,920 px, 390 px), the timing at KB's size on
   `dev:pg`, a full run.
8. **Łukasz's acceptance** on `npm run dev:pg` with the demo accounts (section 6). **Stop** with what he saw.
9. **Close.** The docs and the decisions quoted in full for approval (section 8); one full run on the final commit. Merge
   into `dev` and tag `slice-39` only on Łukasz's command. Granting KB's organization the licence is a separate command,
   only when Łukasz decides.

Each of steps 2 to 6 ends with lint, typecheck, `npm test`, the specs touched as single files (nothing else running).

## 6. Acceptance criteria

Łukasz's criteria (27 November 2026, agreed one at a time).

| ID | Criterion |
| --- | --- |
| S39-01 | **The landing zone, only with the licence.** After sign-in, a person whose organization holds the InfoCatalog licence sees the landing zone: a greeting with their first name, one line on the shared repository, and two tiles, InfoMapper ("Model and map") and InfoCatalog ("Find and describe"), each with three bullets, a count line and "Open …". In InfoMapper's top bar an "All apps" button leads back to it. Without the licence, sign-in goes straight to InfoMapper as today, there is no "All apps" button, and the `/catalog` address answers "not found". A guest (a workspace member from another organization) never sees the InfoCatalog tile for that organization. The InfoCatalog tile's third bullet is "Where each item is used, on canvases and in documents". With several organizations, the landing zone shows when any of them holds the licence, and the catalog lists the licensed ones only. |
| S39-02 | **Who finds what in the catalog.** A member of the organization (not a guest) finds in InfoCatalog, read only, every workspace of the organization where they have a role (any role), and every other workspace of the organization whose switch "Shown in InfoCatalog to everyone in the organization" is on. The switch is in the workspace's settings, set by its Owner or Admin, off by default, hidden while the organization has no licence. A workspace the person may not read appears nowhere: not in results, not in the scope list, not in the landing tile's count, not when an item's address is opened directly. Rights are checked on the server, inside the catalog index. InfoMapper is unchanged. Archived workspaces follow the same rules and are marked "Archived"; organization owners and admins without a role in a workspace find it only when its switch is on. |
| S39-03 | **Search across every layer.** One search field (`/` puts the cursor in it); every word must match; ranking: exact name, alias or requirement key, name starts with, in the definition, in a rule or another field; matches highlighted. Each result: name with a one-line definition, kind, path, workspace (when more than one is in scope), marks ("Personal data" for PII, status). Scope "Whole organization (n workspaces)" or "Workspace: …". Kind tabs with counts: Entities, Attributes, Relationships, Concepts, Source tables, Source columns, Mappings, Requirements, Classifications and stereotypes; with InfoCube on, also facts, dimensions, measures, keys, dimensional mappings. Fields searched: name, alias, requirement key, definition, the full physical name, rule expression, external reference, classification names. An empty field shows example searches and "browse all of one kind". Read only. Results within 1 second of the last keystroke at KB's size. |
| S39-04 | **The details drawer.** A click on a result (or Enter) opens its details in a drawer from the right (560 px); on 1,100 px or more the results move left and stay clickable, narrower the drawer covers them with a light scrim; ↑ ↓ (or j k) move through the results and the drawer follows; Esc closes it. Every item has its own address. Header (kind, name, path, workspace, marks, "From InfoMapper · read only"); characteristics (the kind's own fields); connected items one step away, each clickable, opening in the same drawer with "← Back"; context (projects and canvases showing it; the InfoDocumenter documents including it that the reader would see in InfoMapper, never someone's private draft). No empty Lineage or Impact sections. |
| S39-05 | **Open in InfoMapper.** It opens the item's workspace and a canvas that shows it, the item selected and centred (a mapping: both ends; a relationship: both entities, the relationship selected); the canvas is the first in the Context list, and each canvas there opens itself. An item on no canvas opens the workspace's home with "{name} is not on any canvas". InfoMapper's navigation row then shows "← Back to InfoCatalog", back to the same search, scope, kind tab and item. A person without a role in that workspace sees no button but "You have no role in {workspace}. Ask its owner for access", with the owners' names. |
| S39-06 | **Nothing breaks, no hidden dependencies.** For an organization without the licence InfoMapper looks and works exactly as before; every earlier e2e test passes unchanged or is listed with its reason. InfoCatalog is the third module under AD-33: the lint and the layer-rules test refuse imports between modules and from InfoMapper's layers into it; it reads only through the catalog index port (both adapters, a contract test, rights inside the adapter); "may read the catalog" is one pure function in `src/domain/permissions`; it writes nothing and has no tables of its own; its screens use only the shared components. The one migration adds `infocatalog` to the licence's CHECK and the workspace's switch column (default off); Łukasz runs it one step at a time. No Vercel, GitHub or Supabase settings; after the merge one command grants KB the licence, only when Łukasz decides. |
| S39-07 | CI, the Schema workflow, the full run before the merge; every earlier test changed, with its reason. |

**Manual acceptance:** Łukasz, step 8, on `dev:pg` with the demo accounts, after the demo organization has the licence:
first as `lukasz@infomate.pl` (the landing zone, "All apps", the switch in a workspace's settings); then as Anna (a
workspace with a role, a workspace without one with the switch off, then on); then as Kasia (no InfoCatalog tile, not
found); searches with long names, many results, Polish letters, each kind; the drawer with the keyboard, "← Back", a
link opened in a new tab; Open in InfoMapper and back; an item on no canvas. Then a second organization without the
licence: nothing changed. Give him long names and many items (the lessons of slices 35 and 36: renames, long lists, roles).

## 7. Questions for step 1

- **Q1. The measurement.** Search over all readable workspaces at KB's size and four times that, both adapters (online
  the time to load the models of n workspaces): the times, what dominates, and whether an index or a cache is needed now.
  If so, the smallest one behind the port, with the plan; the timing record (AD-37).
- **Q2. The port's shape.** The three reads (or better ones); where the ranking runs (domain, pure, tested once for both
  adapters: Claude's recommendation); how the adapters load several workspaces' models (`ModelRepository.load` per
  workspace, or one read); what the contract test covers.
- **Q3. The extension point for modules' items.** InfoCube's kinds and InfoDocumenter's documents through
  `src/compose/catalog.ts` without breaking AD-33's rules (`data` never imports a module); the plain data each
  contribution gives; anything in InfoDocumenter's "documents that include an item" that needs logic moved into
  InfoMapper's domain first (guardrail 4).
- **Q4. Routes and addresses.** The landing zone at `/` or its own address; `/catalog`'s address for the search state and
  an item; "not found" without the licence; "All apps" in slice 38's top bar (its room at 1,280 and 1,440 px, the path's
  names not cut more, S38-02's spec); the return path both ways.
- **Q5. The switch.** Its column name; the settings box and its texts; rights, archive, change event, undo (as the module
  switches or not); the local file's format step.
- **Q6. The licence online.** `pg:licence` (or another one-command way) and its safety (never in production by mistake,
  as `assertNotProduction`); how the e2e runs get an organization with and one without the licence.
- **Q7. The kinds.** The list against `data-model-v2.md` (views and files, declared foreign keys, import history,
  stereotypes vs classifications, InfoCube's five kinds); each kind's path, details column and characteristics; what is
  missing or costs more than assumed.
- **Q8. Matching and limits.** Case and accents (Polish and German letters); the full physical name's form; the 200 drawn
  results; the order of ties; highlighting in a definition cut to one line.
- **Q9. Open in InfoMapper.** How a canvas is chosen and the item selected and centred today from a link (the return
  path, the delete impact, the requirement panel's "show on canvas"); a column; an item on no canvas.
- **Q10. Earlier specs.** Which sign-in and top bar specs change (the demo organization with and without the licence in
  the e2e seed); the full run's part for `e2e/slice-39/` and its time.
- **Q11. Risks.** Anything in the prototype the app cannot take; the demo data for S39-02's cases (a workspace where a
  demo member has no role); anything that changes this plan.

## 8. Decisions (proposals) and docs

Quoted in full at the closing for Łukasz's approval; proposals for step 1 to correct.

- **D-91 (new): InfoCatalog, entry and search** (slice 39): the landing zone with the licence and its texts; "All apps";
  who reads the catalog and the switch per workspace (off by default); search, its fields, ranking and kinds; the details
  drawer; Open in InfoMapper and back; no role → the owners' names.
- **AD-41 (new): InfoCatalog's architecture** (A1.1, A1.2): the third module; the catalog index port with rights inside
  the adapter; "may read the catalog" as a pure domain function, derived, not stored; the extension point for modules'
  items; the measurement's result; the guardrails for the later slices (proposals as the module's rows, shared logic into
  the domain before reuse, live updates within one browser, ✦ Ask with an AI model a separate decision).
- **Notes:** AD-33 (the third module, the new extension point); AD-35 (the `infocatalog` licence without a module switch
  per workspace; the workspace's catalog switch); AD-05 (catalog readers read without a role, InfoMapper unchanged); D-58
  (what sign-in opens with the licence); D-90 (the "All apps" button in the top bar).
- Docs: `decisions.md`, CLAUDE.md (the module list, the extension points, the routes), `data-model-v2.md` (the column,
  the CHECK), `inventory-prototype-vs-app.md` (InfoCatalog's part done), `known-limitations.md`, `ideas.md` (the "later"
  points below), README (the licence command).

## 9. Left for later

Slice 40 (lineage and impact in the drawer, facets, "has / has no", the query line, the lineage table, Markdown and CSV,
the details window); InfoCatalog 2 (catalog content, stewards and owners, tags, completeness, "Catalog editors", the tile's
full third bullet, searching the catalog's own fields); InfoCatalog 3 (proposals); context kinds as tabs; saved filters;
✦ Ask; groups from Microsoft sign-in (A2.2); counting catalog readers (A6.4, commercial).
