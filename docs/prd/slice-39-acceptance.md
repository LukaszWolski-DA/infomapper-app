# Slice 39 – InfoCatalog: entry and search: acceptance

Branch `slice/39-infocatalog-entry-and-search`, from `dev` at `b93ebe4`. PRD:
[slice-39-infocatalog-entry-and-search.md](slice-39-infocatalog-entry-and-search.md).

## Step 1: the check against the code (27 November 2026)

No application code, no migration, no change to any data file. The facts below were read on `dev` at `b93ebe4`
(**fact**, with file and line); what I inferred is marked **assumption**. Read: CLAUDE.md; `docs/decisions.md` AD-01,
AD-04, AD-05, AD-19, AD-20 and its notes, AD-33, AD-35, AD-37, D-58 and its notes, D-89, D-90; `docs/data-model-v2.md`
§§ 3–7 and 15; the prototype's `PLAT` block (L11339–12643) and its `pf-` CSS; the code the PRD names and what it leads
to; the e2e helpers and the specs that assert the sign-in target and the top bar.

### 0. The files and the number

| Check | Result |
| --- | --- |
| `docs/prd/slice-39-infocatalog-entry-and-search.md` | copied from Downloads; `cmp` reports no difference; SHA-256 `93a36fc5cb342b4713353482cc9091355cd624eff2bda12829be6ae11902a685`, as given |
| `docs/prototype/infomapper-prototype-with-sources.html` | unchanged; SHA-256 `74c70cd919af6e65eb13f560294de42f6be03fd42d0ff082e546b6d9f0029029`, as given |
| The slice number | 39 is free: no `slice-39` file in `docs/prd/` before this step, no `slice/39…` branch and no `slice-39` tag, local or remote (the last tag is `slice-38`) |
| The checkout | `dev` fast-forwarded from `a1f5d43` to `origin/dev` `b93ebe4` (PR #100), clean; `fix/s32-user-menu` kept |

### 1. What Łukasz needs to decide before step 2

The first option is my recommendation. The details are in the sections named.

| # | Question | Options |
| --- | --- | --- |
| C1 | **How the search reads** (Q1, Q2, § 3). The measurement shows no index is needed. The question is the read's shape. | **(a)** No index, no cache, no stored table: each search is one server request. The port reads the catalog's tables of every readable workspace **in one read-only transaction, one statement per table** (`workspace_id = any($1)`), about 20 statements whatever the number of workspaces. The pure domain builds the items, matches and ranks them, and the server answers the first 200 with the counts per kind. (b) The same with today's `snapshot` per workspace: 37 statements per workspace (296 for 8), measured 0.3 s on a local Postgres at four times KB, more online. (c) The browser receives every item once and searches itself: about 3 MB of JSON at four times KB (**assumption**, about 150 bytes an item), near Vercel's 4.5 MB answer limit, and a reader would receive what the page never shows. |
| C2 | **The Entities tab and InfoCube's kinds** (Q7, § 7). Facts and dimensions are entities (`entity.model_level`). | **(a)** Entities, Attributes and Relationships hold the logical level only, as InfoMapper's lists do (Q4 of slice 15a). With InfoCube on, Facts and Dimensions get their own tabs, with their attributes, Measures (`cube_measure`), Keys (`cube_key`) and Dimensional mappings (`cube_mapping`). (b) Facts and dimensions also count under Entities. |
| C3 | **Classifications and stereotypes** (§ 7). Entities and attributes carry **no** classifications. `classification_link` points to a source table or column only (data model § 6, `types.ts:377-381`). | **(a)** One tab "Classifications and stereotypes", as the PRD says. The drawer drops "classifications" for an entity and an attribute; an attribute shows its own Personal data flag (`is_pii`). Classification names are searched on tables and columns. (b) Two tabs. |
| C4 | **"Documents that include it"** (Q3, § 4). No function answers this today. A document has a scope (projects, concepts, levels, mappings) and sections switched on, so "includes" is not one rule. `canSee` needs a workspace role (`rights.ts:29-30`). | **(a)** A document includes an item when the item is in its scope as the sections read it: entities from `sectionScopeOf`'s `entityIds` and the level drawn; attributes, relationships and mappings through their entity; tables through `tableIds`; requirements through `touchesScope`. That is one pure function in InfoDocumenter's domain, offered through the contribution. A reader without a role in the workspace sees no documents, since in InfoMapper they would see none. (b) Leave documents to slice 40's Impact, as the prototype does (its documents are in Impact only); the tile's third bullet then says "on canvases" only. |
| C5 | **The landing zone at `/`** (Q4, Q10, § 5). Every e2e sign-in waits for `bar-top` (`e2e/slice-00/helpers.ts:13-17`, about 525 files), and nine spec files assert a workspace URL right after sign-in. | **(a)** No seed grants `infocatalog`: `npm run seed`, the e2e seed, `npm run demo` and `pg:seed` stay as they are, so no earlier spec changes. Slice 39's fixtures grant it as test data; on `infomapper-dev` it is `pg:licence` (C8). The landing zone is `/` itself; "Open InfoMapper" is `/?to=workspace`, which redirects as today. (b) The demo seeds grant it, and every earlier sign-in helper learns to pass the landing zone. |
| C6 | **"All apps" in the top bar** (Q4, § 5). The prototype puts it after the left toggle and before the brand, and moves it to the navigation row below 1,360 px (L1751-1752, L12654). | **(a)** Always in the top bar, a 28 px `IconButton`, `flex-none`, directly before the organization switcher, and on the phone too. The switchers already shrink to their 56 / 44 px floors; step 4 proves S38-02's 180 px for a cut name at 1,280 and 1,440 px and S6A-10's widths with the licence. (b) As the prototype: into the navigation row below 1,360 px. |
| C7 | **"← Back to InfoCatalog" and the item's address** (Q4, Q9, § 5). `safeReturnPath` refuses `/catalog` and any free text (`return-path.ts:13-25`). The canvas drops the whole query after an arrival (`ModelCanvas.tsx:1056-1096`). | **(a)** The catalog's state is in its address: `/catalog?q=…&scope=…&kind=…&item={kind}:{workspaceId}:{id}`. An item's own address is the same without `q`. "Open in InfoMapper" stores that address in the tab's `sessionStorage` (`im-catalog-return`, its own validator `safeCatalogPath`) and opens the canvas with its usual arrival parameter plus `from=catalog`. The shell shows "← Back to InfoCatalog" in the navigation row while the tab holds a return address for the workspace shown. It goes when the person opens the catalog again or opens another workspace by hand. (b) The return address in the URL of every InfoMapper page (a parameter carried on every link). |
| C8 | **The licence online** (Q6, § 6). | **(a)** `npm run pg:licence -- grant "<organization name>" infocatalog`, with `devTargetRefusal` (`scripts/lib/pg-env.ts:62-79`) as `pg:kb` has it: grant only, counts and names of the module only, one transaction, idempotent. (b) An SQL statement Łukasz runs in Supabase's editor. |
| C9 | **S39-02's demo cases** (Q11, § 8). No demo member lacks a role in a **live** InfoMate workspace (`seed.ts:131-200`). Piotr has no role in Bank X, which is archived; Kasia, a guest in InfoMate, has none in Sales analytics. | **(a)** The seed does not change. The e2e specs make their own test data through the domain (a new InfoMate workspace in which Anna and Piotr have no role). In step 8 Łukasz creates such a workspace in the app as InfoMate's owner. (b) The seed gains a third InfoMate workspace (an earlier spec that counts workspaces or tiles would change). |
| C10 | **Full runs** (§ 9). "Test runs"' exception: a step that touches the local adapter runs a full run. Step 2 adds a read to both adapters; step 3 adds a column and the file's format step 19. | **(a)** Full runs in steps 2, 3, 4, 7 and 9. (b) As the PRD: 4, 7 and 9. |

Everything else below is a correction or a proposal that I take unless Łukasz says otherwise.

### 2. The measurement (Q1)

**How.** A throwaway script outside the repository (the session's scratchpad, not committed), run from the repository's
root with `npx tsx`. **The model:** the seed with "Performance test" (`scripts/lib/seed-rows.ts`, which builds it with
`src/data/local/large-generator.ts`), whose workspace is cloned with every id remapped into further workspaces of
InfoMate, until the catalog items reach the target. "Performance test" has **2,713 catalog items**: 8 concepts, 41
entities, 779 attributes, 40 relationships, 60 source tables, 1,449 columns, 300 mappings, 12 requirements, 19
classifications and 5 stereotypes. **KB's size** = 2 such workspaces (5,426 items); **four times** = 8 (21,704 items).
That is conservative. KB's 4,871 rows are **rows in all 38 tables** (fact, `slice-31-measurement.md:35`: change events,
canvas items and others included), so KB has fewer catalog items than 4,871. **Postgres:** a cluster of its own
(PostgreSQL 18.3 from scoop, `initdb` in the scratchpad, 127.0.0.1:55439), the migrations applied and the rows loaded by
the contract suite's `preparePostgres` (`tests/contract/shared.ts:204-218`), never `infomapper-dev` and never KB.
**Times:** the reads through `timedStore` with the timing record (`src/data/timing.ts`, AD-37); the items and the search
as pure functions (a sketch of the rule step 2 would write: NFD with ł, ß, ø, đ folded, every word must match, five
tiers). Each figure is the median of 9 after one warm-up.

| What | KB's size, local adapter | KB's size, Postgres | 4 × KB, local adapter | 4 × KB, Postgres |
| --- | --- | --- | --- | --- |
| One workspace's `snapshot` (2,713 items) | 6.4 ms | 48.7 ms | 12.2 ms | 45.9 ms |
| All workspaces' snapshots, one after another | 9.8 ms | 116.9 ms | 67.7 ms | 369.6 ms |
| All workspaces' snapshots, side by side | 9.7 ms | 80.4 ms | 59.8 ms | 303.0 ms |
| Timing record of one read of all | 2 calls, read 14.2 ms | 2 calls, **74 statements**, statements 148.4 ms, wait 0.1 ms, read 77.5 ms | 8 calls, read 61.2 ms | 8 calls, **296 statements**, statements 1,604.8 ms, wait 767.9 ms, read 369.8 ms |
| The items from the snapshots (pure) | 30.6 ms | 19.1 ms | 75.3 ms | 72.3 ms |
| A search (pure), "customer" / "cust id" / "a" (19,040 results at 4 ×) / "qqqq" | 1.1 / 0.7 / 1.8 / 0.4 ms | 0.7 / 0.8 / 1.1 / 0.4 ms | 3.0 / 2.5 / 5.7 / 1.3 ms | 2.7 / 2.5 / 5.0 / 1.2 ms |

The local adapter's first figures in the 4 × run (one snapshot 13.4 ms, all 101–106 ms) were the same file read before
its cache settled; the second run's are in the table. One read of the same 8 workspaces' 19 catalog tables as **one
statement per table** (`workspace_id = any($1)`, `count(*)` in one REPEATABLE READ transaction) took 5.6 ms of server
time once warm (66 ms cold). That shows the statements are cheap. The cost of a snapshot per workspace is its round
trips and its rows' parsing, and much of a snapshot is rows the catalog never shows (canvases, frames, labels, people).

**What dominates.** Matching and ranking cost a few milliseconds even at four times KB. On Postgres the reads dominate,
and with today's `snapshot` they grow with the number of workspaces: 37 statements each, run one after another inside
each transaction (fact, `postgres/store.ts:65-70`), five connections (`pool.ts:22`). On a local database a round trip
costs nothing. Online it costs a few milliseconds from Vercel (fact: the thumbnail's 37 statements took 80–202 ms of
statement time on the preview, `slice-31-measurement.md:57-67`). So 8 workspaces' snapshots online would be about 0.5 to
1 s of reads alone (**assumption**, from those figures), at the bar. From the laptop (`dev:pg`, every statement a round
trip to Frankfurt) they would be several seconds. One statement per table keeps the round trips at about 20 for any
number of workspaces: about 0.1 to 0.2 s online (**assumption**, the same figures).

**Recommendation (C1 a):** no index, no cache and no stored table now. One port read across the readable workspaces, one
statement per table and only the catalog's tables. The items, the matching and the ranking are pure domain code. The
server answers the first 200 results and the counts. The browser sends a search 150 ms after the last keystroke and
drops an answer older than the newest request. The 1 s bar is then met with room at four times KB. Step 7 measures it on
`dev:pg` and on the preview with the timing record, `<TimingRecord />` or `Server-Timing` on the search's route.

### 3. Q2 – the port's shape

Facts:
- No port lists an organization's workspaces. `workspaces.listForUser` gives the workspaces with a member row
  (`ports.ts:103-109`); the only such query is in the loader (`postgres/load.ts:266,270,337`).
- `organizations.listForUser` includes guests (`postgres/store.ts:106-113`); membership is the `organization_member` row
  (`types.ts:58-63`, roles owner / admin / member, `types.ts:10`). The PRD's "nothing is stored for the right" holds: the
  right is derived from stored rows (licence, membership, workspace roles, the switch). But membership itself **is
  stored**. `isGuest` derives the guest from the missing row (`permissions.ts:179-186`).
- `model.load` reads 15 tables (`postgres/store.ts:33-49`), `snapshot` about 37. Requirements are not in `WorkspaceModel`
  (`types.ts:490-518`), only in the snapshot.
- `readTable` takes any WHERE (`postgres/tables.ts:62-68`). `workspaceModelOf` filters rows by workspace itself
  (`workspace-model.ts:75-76`), so the rows of many workspaces can be read at once and split in memory.

Proposal (my call, unless Łukasz objects):
- **The rights:** `catalogReadable(person, organizations, memberships, workspaces, licences, unlocked)` in a new file
  `src/domain/permissions/…`. `src/domain/permissions` is a file today (`permissions.ts`), so it becomes
  `src/domain/catalog-rights.ts` beside it, re-exported from `permissions.ts`. It is pure and gives the readable
  workspaces per licensed organization, each with `hasRole` and `archived`.
- **The port** `catalog` (on `DataStore`, both adapters):
  - `catalog.readable(userId, unlocked)`: the licensed organizations in which the person is a member, and per
    organization its readable workspaces (name, archived, InfoCube's switch, `hasRole`, item counts for the landing
    tile), by the function above inside the adapter.
  - `catalog.rows(userId, unlocked, organizationId, workspaceId | null, moduleTables)`: the catalog's rows of every
    readable workspace in scope (or one), in one read-only transaction, one statement per table, `workspace_id = any($1)`,
    the rights checked in the same transaction. Unreadable workspaces' rows are never read. It returns rows, as
    `snapshot` does; the domain builds the items.
  - `catalog.item(userId, unlocked, workspaceId, …)`: the same read for one workspace (the drawer needs the neighbours,
    canvases, projects, owners), or `null` when the person may not read it. "Not found" is the only answer either way.
- **Where the ranking runs:** in the domain (`src/domain/catalog/`: items, words, tiers, highlight ranges), tested once
  for both adapters. The search itself is `src/compose/catalog.ts` → `src/modules/infocatalog/domain` over the port's
  rows, as `documentStateFor` builds over a snapshot.
- **The contract test** (`tests/contract/catalog.test.ts`): the three reads on the same rows on both adapters, for a
  member with a role, a member without a role with the switch off and on, a guest, an organization without the licence,
  an archived workspace, a locked organization on the local adapter, and "not found" for an item of an unreadable
  workspace.

### 4. Q3 – modules' items (AD-33)

Facts:
- `src/data` may import only `data` and `domain` (`eslint.config.mjs:80`), and only `src/compose` names modules
  (`:12-16, 29, 89`). `src/compose` is imported only by `src/app` (AD-33, CLAUDE.md).
- **The PRD is wrong** where it says "the port takes the composed contributions from `src/compose`" (PRD L74-75). The
  port cannot import `compose`. The precedent is the other way round: the store takes plain table names and rules
  (`StoreSchema`, `rows.ts:38-43`; `snapshot(ws, tables)`), and compose applies the modules' pure functions over what the
  port returned (`documentStateFor`, `compose/documents.ts:49-65`; `moduleFeeds`, `compose/view.ts:139-170`).
- `canSee` (`infodocumenter/domain/rights.ts:29-30`) needs `access.member`, so a reader without a role sees no
  documents. It does not check `workspace.infodoc`; `openRefusal` does (`rights.ts:84-86`).
- No function answers "the documents that include X" (C4).

Proposal: `src/compose/catalog.ts` holds `CATALOG_CONTRIBUTIONS`: per module its tables (passed to `catalog.rows` as names,
as `DOCUMENT_TABLES` is to `snapshot`), its kinds (each kind's tab label, rows → items, searched fields, characteristics,
neighbours, its canvas place; pure) and InfoDocumenter's `documentsIncluding(item, rows, access)` (C4). The type of a
contribution is in InfoMapper's domain (`src/domain/catalog/contribution.ts`), as `DocumentContributions` is. InfoCatalog
gets the joined list from compose through its page (`src/app/catalog/…` → `src/compose/catalog-pages.tsx` → the module's
`app`, as `documents-pages.tsx`). No module imports another. AD-33 needs a note: a module that **reads** other modules'
contributions, and the first module without tables (the registry's records and the cascades stay empty for it).

**Guardrail 4 (shared logic into the domain first):** `sectionScopeOf` and `sourceTablesInScope`
(`infodocumenter/domain/scope.ts:17-61`) stay InfoDocumenter's, offered through its contribution, since only it reads
documents. What InfoCatalog shares with InfoMapper moves into InfoMapper's domain first: the physical path (today three
partial forms: `model-index.ts:83`, `card-data.ts:323`, `upgrade-8.ts:98`) as one `physicalName(system, table, column)`;
the canvas chooser (Q9); the projects and canvases of an entity (`entityImpact`, `impact.ts:73-89`, already domain).

### 5. Q4 – routes and addresses

Facts:
- After sign-in (`src/app/page.tsx:13-35`): the last used workspace (cookie `infomapper_last_workspace`, written only by
  the proxy on `/w/…`, `proxy.ts:82-94`) among the unlocked organizations, else the first; none unlocked → that
  organization's password; none at all → "No workspace yet".
- The dev list and Supabase sign-in go to `/` (`_actions/session.ts:27-35, 140`). **The organization password goes
  straight to a workspace** (`session.ts:112-116`): it would never show the landing zone. Joining by a link goes to the
  workspace (`links.ts:77,94,130`).
- `/catalog` needs a session with no change to the proxy (it is not public, `proxy.ts:38-57`) and writes no preference
  cookie (`preferences.ts:38`).
- `src/app/not-found.tsx` exists (`page-not-found`). `notFound()` is already how the app hides what a person may not
  open (`shell.ts:82,97,193`).
- The top bar's order (`top-bar.tsx:50-77`): left toggle (canvas only), brand (above 1,600 px), organization, workspace
  and project switchers (56–280 px), spacer, working context and Undo / Redo, the save pair, the right toggle, the
  account. Its room is checked by S38-02 (`:46-63`), S6A-10 (`:13-14, 59-71`), S16-08, S38-06, S30-09-room and S5A-06;
  none counts the bar's buttons.
- InfoMapper's shortcuts are mounted by its components (`history-nav.tsx:87-106` in every `AppShell`; `undo.tsx:102-116`
  on the homes and canvas; the canvas's own in `ModelCanvas.tsx`). There is no `/` or Ctrl+K anywhere. A `/catalog` page
  without `AppShell` has none of them, so "shortcuts are off on platform pages" needs no code.

Proposals:
- The landing zone is `/` (C5). "Open InfoMapper" → `/?to=workspace`, today's redirect. The organization password's
  sign-in goes to `/` when the organization it unlocked holds the licence and the form has no `next`; otherwise as today.
  Joining by a link keeps landing on the workspace (AD-40).
- `/catalog` (and `/catalog?…`) answers `notFound()` when no organization of the person (unlocked, as a member) holds
  the licence; an `org` parameter naming an organization without it, or one the person is a guest in, answers the same.
- The addresses in C7. The drawer's item parameter is `{kind}:{workspaceId}:{id}`. An item of a workspace the person may
  not read, or that does not exist, shows the catalog with the toast "That item is not in InfoCatalog." (**assumption**:
  the PRD's "not found" for an item means no drawer and no hint, not the 404 page, which would lose the search; to
  decide if Łukasz means the 404 page).
- "All apps" (C6). With the licence of the **organization shown** (PRD), not of any organization.
- The catalog's header is its own (the apps button, "InfoCatalog", the organization, the account), not `AppShell`'s top
  bar; the account menu is the same component (`UserIndicator`), so the theme and sign-out stay one place.

### 6. Q5, Q6 – the switch and the licence

Facts:
- `LICENSED_MODULES` (`types.ts:66`); **`MODULE_NAMES` is in `src/domain/model/module-switches.ts:8`, not
  `types.ts`** (PRD L93 and L242).
- The licence's CHECK is a local rule too (`local/schema.ts:255-259`, from `LICENSED_MODULES`), so the local adapter
  follows by itself.
- A module switch is a field of `updateWorkspaceSettings` (`commands/workspace.ts:145-224`, strict Zod), with
  `workspace.edit_settings` (owner, admin; an archived workspace is refused by `checkPermission`, `permissions.ts:129-131`).
  It writes one `update` of the `workspace` row with its change event, and `workspace` is **outside undo**
  (`undo.ts:85-92`). The switch follows the same path: a change event, no undo step (Q5 confirmed).
- The local file is format 18 (`local/schema.ts:110`). Slice 25 added `infodoc` as format 17 (`file.ts`, "slice 25
  (F4)"), and tests compare the format (`organization-store.test.ts:90` and others). The switch is **format 19**: every
  workspace `catalog_shown` false, with `upgrade-19.test.ts`. That touches the local adapter, hence C10.
- The settings' boxes are always shown, the check box disabled without the licence (AD-35; `compose/settings.tsx:1-2`).
  **The PRD hides the switch** without the licence, which is a deliberate departure: AD-35 gets a note. The switch is no
  module switch (AD-35: "a module is on when its workspace's switch is"), since InfoCatalog has none per workspace.
- A baseline's content holds four workspace settings (`baseline/content.ts:95`). `catalog_shown` is visibility, not
  model, so it stays **out** of the content (no upgrade step). The workspace's copy and transfer (AD-35's rule for a
  module's switch) do not exist in the app yet (slice 38, B5), so nothing to do; a note says a copy takes the switch off.
- `scripts/licence.ts` is local only (`:12, 18, 27`) and `pg-seed.ts` has no target guard; `devTargetRefusal` is used by
  `pg-kb.ts` and `pg-accounts.ts` only.

Proposals:
- The column `workspace.catalog_shown boolean not null default false` (the PRD's name; `domain` `catalog_shown`, the
  input `catalogShown`). The box "InfoCatalog" in the settings after InfoDocumenter's, shown only while the organization
  holds the licence, through `settingsBoxes` (compose) like the other two. Its text is the PRD's, for Łukasz's wording.
- `pg:licence` (C8): `scripts/pg-licence.ts`, `npm run pg:licence -- grant "<organization>" <module>`: `loadPgEnv`,
  `INFOMAPPER_MIGRATION_URL`, `devTargetRefusal` (so never production until slice D), one live organization by name or
  a refusal, idempotent, the owner as author, no change event (as `licence.ts`), prints "granted" or "held already" and
  the target's host and database only. It runs only on slice 39's branch until the merge (CLAUDE.md, the `pg:` rule).
- E2E: slice 39's fixtures grant the licence to InfoMate as test data (as `grantDocLicence`); Retail Co never holds it,
  which is the "second organization without the licence". The smoke set on Postgres (`e2e/slice-29`) gets no catalog
  spec in this slice. **Assumption:** the online check is Łukasz's step 8.

### 7. Q7 – the kinds

| Kind | Rows | Name shown | Path (Details column) | Searched besides the name | Notes |
| --- | --- | --- | --- | --- | --- |
| Entity | `entity`, logical (C2) | `name` | concept · stereotype's name | `alias`, `definition_text` | no classifications (C3) |
| Attribute | `attribute` of a logical entity | `name` | `Entity / attribute` · type | `alias`, `definition_text`, `calc_rule` | PK / FK / BK and PII are flags (`types.ts:220-244`) |
| Relationship | `relationship` | **no name**: `label`, else "From – To" | cardinality sentence | `label`, roles, `description` | `description` is plain text, no `_text` pair |
| Concept | `concept` | `name` | – | `description_text` | it has a description, not a definition |
| Source table | `source_table`, `object_type` table / view / file | `name` | `{system} / {db}.{schema}.{table}` | full physical name, `comment`, `note_text`, its classifications | views and files are this kind (fact, `types.ts:276`); "Kind" shows View / File |
| Source column | `source_column` | `name` | `{system} / {db}.{schema}.{table}.{column}` · type | full physical name, `comment`, `note_text`, its classifications | the PRD's example `CRM / dbo.customers / cust_no` leaves out the database |
| Mapping | `mapping` | **no name**: "`{columns}` → `{Entity.attribute}`" | kind · status | `rule_expression`, `note_text` | "who approved" is `approved_by`, a person's id (the workspace's people) |
| Requirement | `requirement` | `{key} {name}` | kind · status · priority | `key`, `description_text`, `expression`, `external_ref` | `owner_name` is plain text (shown "from InfoMapper"); the break-down is `parent_id`; "data quality rules" are requirements of kind `dq_rule` with `expression` and `severity`, not a table of their own |
| Classification | `classification`, live, not removed | `name` | scope (table / column) | `code`, `definition` | "how many carry it": its live links |
| Stereotype | `stereotype`, live, not removed | `name` | – | `code`, `definition` | "how many carry it": logical entities with its code (a dimensional entity keeps `object`, unused) |
| Fact, Dimension (InfoCube) | `entity` dimensional + `cube_entity` | `name` | role, type or history (`historyLabel`) | `alias`, `definition_text` | from the contribution |
| Measure | `cube_measure` | its attribute's name | `Fact / attribute` · additivity | its attribute's | one per fact attribute |
| Key | `cube_key` | **no name**: "attribute (fact → dimension)" | – | its attribute's name | read as absent while its attribute is no FK (`cube` types `:88-91`) |
| Dimensional mapping | `cube_mapping` + inputs | **no name**: inputs → attribute | kind (incl. lookup) · status | `rule_expression`, `note` | – |

Corrections and costs:
- **Declared foreign keys** are `source_relationship` (+ columns), shown in a table's details (PRD, confirmed).
- **"Last import"** belongs to the **source system** (`source_import.source_system_id`), not the table: a table's drawer
  shows its system's last import. It is one more table to read (`source_import`). The open changes to resolve
  (`source_change`) are not shown in this slice (**assumption**).
- **Requirements can be on a canvas** (requirement cards, `canvas_item.requirement_id`, data model § 9). The PRD's
  example of an item on no canvas ("a requirement") is wrong for a requirement with a card.
- "External reference" exists on requirements only.
- The kind tabs' order: the PRD's (Entities, Attributes, Relationships, Concepts, Source tables, Source columns,
  Mappings, Requirements, Classifications and stereotypes, then InfoCube's), with the prototype's "All {n}" first and a
  kind with no result disabled (L11547-11548, L12464). The PRD does not mention "All"; I take it from the prototype.
- The drawer reads a mapping's approver and a workspace's owners from its people: the drawer's workspace counts as "the
  workspace shown" under D-58's note (only its people reach the browser).

### 8. Q8 – matching and limits

Facts: no accent-insensitive search exists in the app. The only NFD is `proposedCode` (`stereotypes.ts:120-131`, which
maps ł by hand). Every search today is `toLowerCase().includes` on the whole query (`tree-data.ts:306-323`,
`pick.ts:48-60`). The prototype does not fold accents either (L11446-11465).

Proposals:
- **Folding:** `toLowerCase` after NFD with the combining marks removed, and `ł→l`, `ß→ss`, `ø→o`, `đ→d`, `æ→ae`,
  `œ→oe` (NFD decomposes neither ł nor ß), the same on the text and the query. "zrodlo" finds "źródło", "strasse" finds
  "Straße". One pure function in InfoMapper's domain (`src/domain/text-fold.ts`), tested with Polish and German.
- **Every word** (split on spaces) must be found in one of the item's searched fields together (the words may be in
  different fields). The measurement found that this makes "Wide Customer Profile" match 402 items at KB's size when an
  attribute's searched text includes its entity's name; I propose **not** to search the entity's name in an attribute's
  fields (the path shows it), so a multi-word query narrows as a person expects.
- **The tiers** (A3.1): 1 the name equals the query; 2 the alias or the requirement key equals it; 3 the name starts with
  it; 4 every word in the definition; 5 the rest. **Ties:** the kind tabs' order, then the workspace's name, then the
  kind's model order (`workspaceModelOf`'s: entities by name, attributes by entity and `sort_order`, tables by name,
  columns by ordinal; mappings in their stored order, `byCreation`). The PRD's "model order" is per kind only (fact,
  `workspace-model.ts:48, 75-103`).
- **The highlight:** each word's matches in the name, the path and the one-line definition, from ranges the domain gives
  on the folded text mapped back to the original (no `dangerouslySetInnerHTML`). A definition cut to one line starts
  about 50 characters before its first match when the match is past character 70 (the prototype's rule, L11476-11482),
  and ends with "…" at 180 characters.
- **200 drawn:** the server sends the first 200 and the counts. Below them: "{n} more: narrow the search" (the PRD's),
  where the prototype says "{n} results, the first 200 shown". I take the PRD's.

### 9. Q9 – Open in InfoMapper

Facts:
- The canvas page selects and centres on arrival with `?card=`, `?map=`, `?row=` (an attribute's or a column's row),
  `?rel=`, `?entity=`, `?req=`, `?system=`, `?ext=` (`c/[canvasId]/page.tsx:178-183, 384-429`;
  `ModelCanvas.tsx:1047-1095`). A mapping centres on its source card, else its entity card (`:1077-1090`). A relationship
  centres on its first end.
- Every chooser today works within one project: model checks (`project-checks.ts:63-77`), consistency (both ends' cards
  first, `consistency.ts:109-115`), requirements (`bestCanvasId`, `stats.ts:199-216`). No chooser picks a canvas across
  the workspace.
- `?gone=` and `HOME_GONE` give a home's toast (`w/[workspaceId]/page.tsx:134-136`, `compose/home.tsx:45-47`).

Proposals:
- **The canvas:** a pure `canvasesShowing(item)` in InfoMapper's domain: the canvases with the item's card (an entity's,
  a table's for a column, a requirement's card); for a mapping or a relationship, those with both ends first, then one
  end; in project order then tab order (`diagramCanvases`' order). The first is the drawer's first Context line and
  "Open in InfoMapper"'s target, through the existing arrival parameters (`?row=` for an attribute or a column,
  `?map=`, `?rel=`, `?card=`, `?req=`, `?ext=` for InfoCube's). A mapping with both ends selects the mapping; with one
  end it selects that end's row.
- **On no canvas:** the workspace's home with `?gone=canvas&item={kind}:{id}`, whose toast names the item by its name
  read on the server: "{name} is not on any canvas." (a `HOME_GONE` entry; the name never travels in the address).
- **No role:** no button, the line "You have no role in {workspace}. Ask its owner for access: {owners}." with the
  workspace's Owners by display name, read with the item.

### 10. Q10 – earlier specs and the run

| Step | Earlier specs that change | Why |
| --- | --- | --- |
| 2 | none | a new port and the rights; nothing on a screen |
| 3 | `upgrade-*` and store tests that compare `DEV_DB_FORMAT` (e.g. `organization-store.test.ts:90`; unit tests, not e2e), `tests/table-registry.test.ts` / the schema check for the column | format 19 and the column |
| 4 | none, if C5 (a) holds: no seed grants the licence, so every earlier spec signs in, lands and sees the top bar as before | the landing zone and "All apps" show only with the licence |
| 5–6 | none | new routes only; the canvas's arrival parameters are reused unchanged |

The spec files that assert a workspace right after sign-in (`S0-01:12,25`, `S0-06:20`, `S8-01:15`, `S8-04:28,40`,
`S8-05:17`, `S8-06:16,39`, `fixes/session-change-full-load.spec.ts:18,28,38`; online `S29 fix-smoke-session-full-load`,
`S33-smoke-people`) and the top bar's room specs (above) run without the licence and stay. **The part:** `e2e/slice-39/`
joins the last part (part 11, from `slice-27`), by the recut rule. **Its time (assumption):** about 25 specs at 15–25 s,
6–10 minutes; part 11 is now the longest, so the closing checks the recut rule on the last three full runs.

### 11. Q11 – risks and what the prototype has that the app cannot take

- **The prototype's rights are not the PRD's.** It lists only member workspaces and falls back to "Reader" (L11362-11366):
  the no-role reader, the switch and the no-role line are the PRD's alone.
- **"Open in a window", Lineage, Impact, Display, Markdown, ✦ Ask, Catalog editors, the filters row:** out (PRD § 2).
  The landing's bar title "InfoMate apps" (L11507) and the sign-in card "One account for InfoMapper and InfoCatalog"
  (L11495-11503) are not in the PRD; I propose the title "InfoMate apps" on the landing's bar (it names nothing new) and
  no change to the sign-in page.
- **The drawer is a new shared component** (`src/ui/components/drawer.tsx`, from shadcn's Sheet on the tokens, D-89 gets
  a note). The PRD's "added to the guard's list" is wrong: the guard has no list of components, it refuses a styled
  control outside `src/ui` (AD-20's note, `tests/lib/control-style.ts`); the drawer is used through its exports. The kind
  tabs are the existing `tabVariants` with a new quiet density (or `chipVariants` with `aria-pressed`, as the prototype);
  step 5 picks the one whose look matches the prototype's layout B and says so.
- **AD-05's note** ("owners and admins … see a workspace's content only with a role") becomes "in InfoMapper"; the
  catalog is a read-only exception decided in A2.1, and the note says that read is no sixth role. **D-58:** what sign-in
  opens with the licence is new content. **D-90:** "All apps" and "← Back to InfoCatalog" (its navigation row). All
  quoted at the closing.
- **The landing tile's counts:** "{n} workspaces you belong to · last: {name}" counts the unlocked organizations'
  workspaces with a role (the prototype counts all organizations, L11505); "{n} items in {m} workspaces of {organization}"
  needs the item count per workspace: `catalog.readable` gives it from a `count(*)` per table (one statement each), not
  the search's read.
- **Live updates between windows** (guardrail 5) are not in this slice's criteria: a search is read on each request, so
  a change made in InfoMapper shows on the next search. The landing's lead line ("A change in one is seen in the other at
  once") is then true on the next search; I take that unless Łukasz wants a live refresh.
- **The local adapter's unlocked organizations:** a catalog of an organization the session has not unlocked shows
  nothing of it; the organization select lists only unlocked ones, and the landing tile counts them only (fact,
  `session.ts:29-32`; online every organization is unlocked, `:47-48`).

### 12. The plan for steps 2 to 9

Each step ends with lint, typecheck, `npm test`, the touched specs as single files, and the report (CLAUDE.md).

2. **The core and the port.** `src/domain/text-fold.ts`; `src/domain/catalog/` (the items of InfoMapper's kinds, the
   words, the tiers, the highlight ranges, the contribution's type, `canvasesShowing`, `physicalName`); the rights
   function; the port `catalog` on both adapters (one statement per table) and `tests/contract/catalog.test.ts`;
   `src/modules/infocatalog/` with its five parts and `"infocatalog"` in `eslint.config.mjs` and
   `tests/layer-rules.test.ts`; `src/compose/catalog.ts` with InfoCube's and InfoDocumenter's contributions; a bench
   `scripts/bench-catalog.ts` (the measurement above on the real code, a reference figure). Draft PR into `dev`. Full
   run (C10).
3. **The licence and the switch.** Migration `20261127…_infocatalog.sql` (the CHECK, `workspace.catalog_shown`), format
   19 with its upgrade test, `LICENSED_MODULES`, `MODULE_NAMES`, `updateWorkspaceSettings`' field, the settings' box,
   `scripts/licence.ts` for `infocatalog`, `pg:licence`. Full run. **Stop for Łukasz's migration** on `infomapper-dev`
   (`pg:backup`, `pg:migrate -- --dry-run`, `pg:migrate`, `pg:backup`, counts compared) and `pg:licence` for InfoMate.
4. **The landing zone and "All apps".** `/` with the licence, `/?to=workspace`, the password sign-in's target, the button
   in the top bar, `/catalog`'s `notFound()`, S39-01's and S39-02's specs (the tile's counts, the guest). Full run.
5. **Search.** `/catalog`, its header, the field, the scope, the kind tabs, the rows, the highlight, the empty state,
   the 200, the address; S39-03's specs; the timing record on the route.
6. **The drawer and Open in InfoMapper.** The drawer component, the keyboard, "← Back", the item's address, the Context
   lines, the documents (C4), Open in InfoMapper and "← Back to InfoCatalog", the no-role line, "not on any canvas";
   S39-04's and S39-05's specs.
7. **The after checks.** `npm run ui:check` on the landing zone, the catalog and the drawer (1,280, 1,440 and 1,920 px
   light and dark, 390 px), the bench, the timing on `dev:pg` with the demo and "Performance test" (never KB from a
   spec), a full run.
8. **Łukasz's acceptance** on `dev:pg` with the demo accounts (PRD § 6), with a workspace he makes without Anna and
   Piotr (C9). **Stop.**
9. **Close.** D-91 and AD-41 and the notes (AD-05, AD-33, AD-35, D-58, D-89, D-90) quoted in full; CLAUDE.md (the third
   module, the extension point, the routes, `pg:licence`), `data-model-v2.md`, `inventory-prototype-vs-app.md`,
   `known-limitations.md`, `ideas.md`, README; one full run on the final commit. Merge and tag `slice-39` only on
   Łukasz's command; KB's licence a separate command when he decides.

### 13. Ideas (for `docs/ideas.md`, not in this slice)

- A guard in `pg:seed` like `devTargetRefusal` (today only `pg:kb` and `pg:accounts` have one).
- The database's own search (`unaccent` and trigram indexes) when a model outgrows the read per search; not now.

**Łukasz's answers:** (to come)
