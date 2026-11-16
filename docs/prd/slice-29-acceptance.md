# Slice 29 – Database A: step 1, reconnaissance and check

Step 1 of `docs/prd/slice-29-database-skeleton.md` (16 November 2026). No application code. Nothing connected to
`infomapper-dev`; no migration applied; no Vercel project made.

- **Branch:** `slice/29-database-skeleton`, cut from `main` at `c05dc33` (equal to `origin/main` when cut).
- **The PRD:** `~/Downloads/slice-29-database-skeleton.md`, one copy (no "(1)"). Copied to
  `docs/prd/slice-29-database-skeleton.md`; `cmp` equal; SHA-256 `8ccf22a3d4726330edb470d8e14c1925f4a27871e5f2e823122df878f723d6c7`, as given.
- **The report of 16 November** is in the session "Database migration readiness report". Two of its figures differ in
  the PRD:
  - The report says "15 to 30 repository calls" per page; the PRD says "about 35". The ~60 queries match.
  - Counted again here: the canvas page makes 15 calls in its `Promise.all` alone, plus `loadShell` and
    `loadProjectView`. `loadShell` makes one `getMember` per workspace of the organization and one
    `listLinksOfProject` per project. With `model.load` as 15 table reads, today's pattern is about 60–80 SQL
    statements on the demo (F3).
- **`.env.local`:** it does not exist, so none of the proposed variables (Q4) is present.
- **Platform facts:** read on 16 November 2026 in the official documents. Each one cites its page; "not confirmed"
  means the documents do not say it.

Findings are numbered F1…; each has its files and a proposal. **Questions for Łukasz** are at the end (L1…).

---

## Q1. The adapter

**Where:** `src/data/postgres/` (`store.ts`, `pool.ts`, `types.ts`, `read.ts`), the `DataStore` of `src/data/ports.ts`
with all 14 repositories and `snapshot`.

**How the reads map to SQL.** Every port reads whole tables of one workspace: `select * from t where workspace_id = $1`,
plus `deleted_at is null` where the port's rule allows it. The **local adapter's pure rules then run on those rows**, so
no rule is copied:

- `model.load` reads the model's 15 tables (concept … stereotype) into a partial `StoredRows`, then calls
  `workspaceModelOf` (`src/domain/model/workspace-model.ts`). That rule gives the live filter, the orders, the removed
  classifications and stereotypes, and `lostOriginalsOf`, which needs the deleted attributes and entities, so `entity`
  and `attribute` are read with their deleted rows.
- `snapshot` reads the tables `workspaceSnapshotOf` names and calls it.
- `requirements.listLinks` and `getLink` call `liveRequirementLinksOf`. The guard needs the live ids of five target
  tables, so it takes six reads, or one query with `exists` (F4).
- `canvases.listLinksOfProject` and `listLinksOfCanvas` call `liveProjectCanvasesOf` and `byTabOrder`.
- `users.listForWorkspace` calls `workspacePeopleOf`, with `change_event` read as `select distinct user_id`. The rule
  only reads `workspace_id` and `user_id`.
- `labels.listLinks` and `listPins`: the label-link guard is today an inline closure in `src/data/local/store.ts`. It
  moves to the domain beside `liveRequirementLinksOf`, as `liveLabelLinksOf`, so both adapters call it (a small move,
  F1).
- `modules.list`, `snapshot`'s module tables and `loadForUndo` go through `readRows` (defaults) and `upgradeRows`
  (`TableRules.upgrade`). The seed writes current rows, so these are no-ops on Postgres, but they run anyway: one rule.
- `undoHistory.get` answers the empty history without a query, because no write exists to undo. `update` throws:
  it is only reached after a successful `apply`, which never happens.
- `changeEvents.*` use the same filters in SQL. `listForMapping` reads `after_image->>'mapping_id'` and
  `before_image->>'mapping_id'` (jsonb).

**F1. The shared pieces live in the local adapter today.** These are the schema type and the row rules: `LocalSchema`,
`localSchema`, `readRows`, `upgradeRows` and `rowsOf` in `src/data/local/schema.ts`. `src/compose/tables.ts` imports
`STORE_SCHEMA` from there, and `getDataStore(schema?: LocalSchema)` takes it.
*Proposal:* move the schema type and the two row rules to `src/data/rows.ts` (`StoreSchema`, with `LocalSchema` kept
as an alias). `RULES`, the integrity checks and the format stay local. Behaviour does not change, but this touches the
local adapter and the table registry, so step 2 needs a full run.

**F2. Order: "the same results" includes the file's order, which Postgres does not have.** Ports without a sort return
rows in the file's order, which is creation order: `projects.list`, `canvases.list`, `canvasItems.list`, `frames`,
`labels`, `notes`, `requirements.list`, `relationships`, `mappings`, members, licences. Callers rely on it.
`loadShellFor` takes `projectRows[0]` as the project to show; the top bar lists projects in that order; tiles and lists
too.
*Proposal:* each such port gets an **explicit order on both adapters**: `created_at`, then `id` (UUID v7, AD-11). The
local adapter sorts the same way, which matches the file for every row the app made. Seed rows with fixed ids keep
their place, because the sort is by `created_at` first. The contract suite checks each port's order. Two rules:
- Text is never ordered in SQL. Sorting by name uses `localeCompare` in the shared rules. A Postgres collation
  (`en_US.UTF-8` or `C`) would order differently.
- ISO timestamps compare the same as text and as `timestamptz`.

**F3. The query count is higher than "one query per port call".** `model.load` reads 15 tables, `snapshot` about 25,
and the two link guards 6 each. With the PRD's DB7 (no read fix yet), the honest port is **one statement per table a
call reads**. A call reading several tables runs them on one connection inside one read-only transaction, so its rows
come from one state. That is required for `snapshot` and recommended for `model.load` for slice B. The measurement
counts calls and statements separately (Q9).

**F4. Types: what `pg` returns differs from the file.** The fix is a type parser per pool (`pg.types.setTypeParser` on
the pool's own `types`, not the global):

| Postgres type | `pg` by default | The domain expects | Parser |
| --- | --- | --- | --- |
| `timestamptz` (OID 1184; 130 columns) | a `Date` | an ISO string with `Z` and milliseconds | `new Date(v).toISOString()`, the same text the app wrote, since it writes milliseconds |
| `numeric` (OID 1700: `x`, `y`, `width`, `height` and 4 more) | a string | a number | `Number(v)` |
| `bigint` (OID 20: `source_table.row_count`) | a string | a number | `Number(v)` |

- `jsonb` and `json` are parsed already.
- **`jsonb` reorders object keys** and drops duplicate keys. This affects `canvas.look`, `cover`, `style`, change
  images and the recipe's `sections` objects. Deep equality is unaffected. Anything that hashes `JSON.stringify` of a
  stored object would differ, for example a thumbnail key or `sameLook`. Step 2 greps for such hashes, and the contract
  suite compares a look's thumbnail key on both adapters.
- `uuid` comes back lower case, like the app's ids.

**F5. `getDataStore` is made many times per request** (about 30 call sites).
*Proposal:* the Postgres store object is cheap. The pool is one per server instance on `globalThis`, as the local
store keeps its undo map today. No change at the call sites.

## Q2. Connections

- **The app on Vercel: the shared pooler (Supavisor) in transaction mode, port 6543.** Supabase recommends it for
  "Serverless or edge function"; it is IPv4 on every plan and "Prepared statements aren't supported"
  ([connecting-to-postgres](https://supabase.com/docs/guides/database/connecting-to-postgres)).
  - node-postgres prepares a named statement only for a query with a `name`
    ([node-postgres queries](https://node-postgres.com/features/queries)). The adapter never passes `name`; lint can
    enforce it.
  - Unnamed parameterized queries (the extended protocol's unnamed statement) are not discussed in Supabase's page.
    **Not confirmed**: step 2's first act is one parameterized query through the transaction pooler.
  - Transactions (`snapshot`, `model.load`; slice B's `for update`) work: one transaction stays on one server
    connection.
  - Session state (`SET`) does not survive a transaction. Use `SET LOCAL` inside one, or none.
- **The dedicated pooler (PgBouncer, Pro)** supports prepared statements, but sits at `db.[REF].supabase.co:6543`. That
  is the direct host's name, IPv6 unless the IPv4 add-on is bought. Not proposed.
- **The pool per instance.** Supabase's serverless advice is pool size 1. Vercel's is to "Avoid max pool size of 1",
  with a pool at module scope, an idle timeout of about 5 s, and `attachDatabasePool` from `@vercel/functions` so idle
  clients are released before an instance suspends
  ([Vercel KB](https://vercel.com/kb/guide/connection-pooling-with-functions),
  [@vercel/functions](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package)). The two
  pages contradict each other.
  - *Proposal:* `max: 5`, `idleTimeoutMillis: 5000`, `attachDatabasePool(pool)` on Vercel.
  - The canvas page's 15 parallel calls then queue on 5 connections. The measurement reports the waiting.
  - Micro allows 200 pooler clients and a pool size of 15 per role
    ([compute-and-disk](https://supabase.com/docs/guides/platform/compute-and-disk)): about 40 instances × 5 fit.
- **Migrations and the seed loader: the session pooler, port 5432, not the direct connection.** The direct host
  (recommended for migrations) is IPv6 only without the add-on. Łukasz's laptop network is most likely IPv4 only:
  **L1**.
- **New dependencies:** `pg` moves from `devDependencies` to `dependencies` (`@types/pg` stays). Add
  `@vercel/functions`. `pg` is in Next.js's built-in server-external list (checked in
  `node_modules/next/dist/lib/server-external-packages.json`), so Turbopack does not bundle it.

**F6. TLS is not in the PRD.** Supabase's pooler certificate chains to Supabase's own root CA. node-postgres 8 treats
`sslmode=require` in a URL as full verification. Without the CA the connection fails; with `no-verify` the TLS is
unchecked.
*Proposal:* Supabase's root certificate goes into the repository (`src/data/postgres/supabase-ca.crt`). It is public,
not a secret. The pool passes it as `ssl: { ca, rejectUnauthorized: true }`; the URL carries no `sslmode`. To check in
step 2.

## Q3. Auth

- **`@supabase/ssr` with Next.js 16.** The guide covers `proxy.ts` ("Next.js renamed this file in version 16"):
  `createServerClient` with `getAll` and `setAll`, a session refreshed in the proxy, and `setAll` passing cache headers
  to apply ([server-side/nextjs](https://supabase.com/docs/guides/auth/server-side/nextjs)).
- **Checking the session on each request: `getClaims()`.** Use `getClaims` to protect pages; never trust `getSession()`
  in server code.
  - With **asymmetric signing keys**, `getClaims` checks the token locally against the cached JWKS: no network call.
  - With the legacy **symmetric** secret, it "always sends a request to the Auth server"
    ([auth-getclaims](https://supabase.com/docs/reference/javascript/auth-getclaims)).
  - Asymmetric (ES256) keys are recommended; HS256 is "not recommended for production"
    ([signing-keys](https://supabase.com/docs/guides/auth/signing-keys)).
  - **Not confirmed** that a project made now has asymmetric keys by default: **L2**.
- **`getSession()` in `src/app/_lib/session.ts` on Postgres:** `getClaims()`, then the person by `auth_user_id`
  (1 query), then `unlocked` = the organizations the person reaches (`organizations.listForUser`, 1 query).
  - "Every organization they belong to unlocked" (DB5) then needs no change in the 18 files that read
    `session.unlocked`.
  - A Server Component cannot write cookies, so its `setAll` swallows the write (the guide's pattern). The refresh
    happens in the proxy.
- **Linking accounts.** **F7: the PRD contradicts `docs/data-model-v2.md` §3**, which says "With Supabase, `id` equals the
  id of the Supabase Auth user; there is deliberately no foreign key into the `auth` schema". The PRD proposes
  `app_user.auth_user_id`.
  - `auth.admin.createUser` does take an `id`, but only in the SDK's types (`AdminUserAttributes.id`, "Allows you to
    overwrite the default `id`"), not in the reference page
    ([admin-createuser](https://supabase.com/docs/reference/javascript/auth-admin-createuser)).
  - *Proposal:* **`app_user.auth_user_id`** (uuid, null, unique; no foreign key into `auth`, as §3 wants). This relies on
    nothing undocumented. Slice C copies KB's people without changing their ids, and the column keeps the app's ids
    independent of the identity provider.
  - Cost: a migration and §3's sentence changed (`data-model-v2.md` with Łukasz, per CLAUDE.md). **L3.**
- **The demo's accounts by script** (`scripts/accounts.ts`, development only):
  - For each person in the seed it runs `auth.admin.createUser({ email, password, email_confirm: true })`, or finds the
    existing account and sets the password. It then writes `auth_user_id`.
  - This is the script's one write, outside the app's refused `apply`.
  - The password comes from `INFOMAPPER_DEMO_PASSWORD` and is never printed.
  - **Not confirmed** that `admin.createUser` works with sign-ups off: the documents say only that "only existing users
    can sign in" ([general-configuration](https://supabase.com/docs/guides/auth/general-configuration)). Step 3 tries it
    first.
- **The secret key.** `sb_secret_…` acts as `service_role` and "doesn't work in a browser" (a User-Agent check). The
  legacy `anon` and `service_role` keys are deprecated "by the end of 2026"
  ([api-keys](https://supabase.com/docs/guides/api/api-keys)), confirming the PRD.
  - The documents do not name the admin API with the new keys. **Not confirmed**; step 3 checks it.
  - **The app at run time needs only the publishable key.** The secret key is for the accounts script, so it is not
    stored in Vercel in this slice (S29-09).
- **Auth and Storage with the Data API off.** The documents say only that the REST endpoints stop answering
  ([securing-your-api](https://supabase.com/docs/guides/api/securing-your-api)). Auth is its own service (`/auth/v1`),
  so it should keep working, but no page says so. **Not confirmed**: step 3's first sign-in shows it. Storage waits for
  slice B.
- **Limits.**
  - The built-in mail sends "2 emails per hour". This slice sends none: accounts are confirmed by the script; no reset,
    no invitation.
  - `/token` (password sign-in and refresh) allows 150 requests per 5 minutes per IP
    ([rate-limits](https://supabase.com/docs/guides/auth/rate-limits)). Enough for a manual check and a measurement.
    The CI smoke uses its own local Auth (Q8).
- **No sign-in form in the browser bundle.** Sign-in is a server action (`signInWithPassword` on the server client),
  and sign-out calls `signOut()` there. No Supabase client goes to the browser, so no `NEXT_PUBLIC_` variable exists
  and nothing Supabase is inlined into a local build.

**F8. The start page is the development page.** `src/app/sign-in/page.tsx` answers `notFound()` unless
`isDevSignInEnabled()`. On it are the e-mail → organization → password steps, "Create an organization" and the test
users' list.
*Proposal:* in Postgres mode, `/sign-in` renders its own small form (e-mail, password, "Sign in") and nothing else:
no organization step, no "Create an organization", no list. The slice 8 pieces stay for the local adapter.

**F9. The proxy and AD-32.**
- The Supabase guide refreshes the session in the proxy on every matched request, which can write `Set-Cookie`. AD-32
  requires that a thumbnail's answer never carries `Set-Cookie`, and the proxy does not touch it today (`THUMBNAIL_PATH`).
  - *Proposal:* the proxy skips the refresh on `THUMBNAIL_PATH`, exactly as it skips the preference cookies.
  - The route checks `getClaims()` itself. An expired token answers 401 for the image. The page's own request has
    just refreshed it, so this is rare.
- `src/proxy.ts` notes that a cookie written during a server action makes Next.js refresh the page. A token refresh
  during an action (about once an hour) does the same. Accepted for reads; noted for slice B.
- The proxy only checks the cookie's presence today. Next.js says to "verify authentication … inside each Server
  Function" ([proxy](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)), which `getSession()` already
  does in every action.

## Q4. The switch and the environment (with Łukasz's addition)

**The switch.** One variable, **`INFOMAPPER_DATA`**: `local` (the default, also when unset) or `postgres`.
- **`getDataStore`:** with `postgres` it returns the Postgres store and never builds the local one. With `local` it
  returns the local store and never builds a pool.
- **The development sign-in** (`isDevSignInEnabled`) becomes `isLocalModeAllowed() && mode === "local"`.
- **What refuses the local adapter in production today:** `assertNotProduction()` (`src/data/local/file.ts`) through
  `isLocalModeAllowed()` (`src/data/local/measure-mode.ts`). It allows development, and a production build only with
  `INFOMAPPER_MEASURE=1`. It stays as it is.
- **In Postgres mode** the local store's constructor also throws, even in development. So **the two can never mix**:
  - Postgres mode reads no JSON file, offers no test users' list and writes no `.data/` file.
  - Local mode opens no connection.
  - The scripts that write JSON files (`seed`, `reset-dev-data`, `seed:large`, `demo`) refuse to run when
    `INFOMAPPER_DATA=postgres` is set.

**F10. `DATABASE_URL` must not be the switch or the app's URL.** It already means "an empty database for
`npm run schema:check`" (`.env.example`, `schema.yml`), and the check refuses a database with tables. If the app read
it, a developer's schema-check URL in `.env.local` would point the app at a scratch database. *Proposal:* the app's
variables are new names; `DATABASE_URL` keeps its one meaning.

**The variables (names only).** "Scripts" means the migrations, the seed loader and the accounts script, run from the
laptop.

| Variable | Read by | Env 1: local | Env 2: local on Postgres (`.env.local`) | Env 3: Vercel Preview (branch only) | Env 4: production (slice D) | CI |
| --- | --- | --- | --- | --- | --- | --- |
| `INFOMAPPER_DATA` | the app, the scripts | unset | set by the command only, never in `.env.local` | `postgres` | – | `postgres` in the smoke job |
| `INFOMAPPER_DATABASE_URL` | the app (transaction pooler, 6543) | – | yes | yes | – | the container's |
| `INFOMAPPER_MIGRATION_URL` | the scripts (session pooler, 5432) | – | yes | **no** | – | the container's |
| `SUPABASE_URL` | the app, the accounts script | – | yes | yes | – | the local stack's |
| `SUPABASE_PUBLISHABLE_KEY` | the app | – | yes | yes | – | the local stack's |
| `SUPABASE_SECRET_KEY` | the accounts script only | – | yes | **no** | – | the local stack's |
| `INFOMAPPER_DEMO_PASSWORD` | the accounts script, the smoke specs, the measuring spec | – | yes | **no** | – | a fixed test value |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | the measuring spec on the laptop | – | yes | (Vercel sets it) | – | – |
| `INFOMAPPER_TIMING` | the app (Q9) | – | optional | `1` | – | – |
| `DATABASE_URL` (as today) | `schema:check` only | as today | as today | – | – | the container's |
| `INFOMAPPER_SESSION_SECRET` (as today) | the local sign-in only | as today | – | – | – | – |

- The table follows Łukasz's four environments; slice D adds its own column of values.
- No `NEXT_PUBLIC_` names (Q3). `.env.example` gets every new name, without values.
- The local stack's keys in CI are made by the Supabase CLI on the runner. They are not `infomapper-dev`'s.

**Łukasz's addition, compared with what I found.**
1. **Environment 1 stays as today**, with no new variable. Agreed.
   - Difference: Next.js loads `.env.local` for every `next dev`, so environment 2's values are also present while
     environment 1 runs. They are inert, because nothing reads them without the switch.
   - The switch itself therefore must not be in `.env.local`, or `npm run dev` would become environment 2.
   - If Łukasz prefers environment 2's values not present at all in environment 1, they can go in their own file
     (`.env.postgres.local`, git-ignored), read only by `dev:pg`. **L4.**
2. **Environment 2 by one command: `npm run dev:pg`.**
   - Proposal: a small `scripts/dev-pg.ts` sets `INFOMAPPER_DATA=postgres` and starts `next dev` (cross-platform, no
     `cross-env`). It runs on port 3000 like `npm run dev`, so the two cannot run at once.
   - It uses its own build folder (`NEXT_DIST_DIR=.next-pg`): Next.js refuses a second dev server on one folder, and
     the caches stay apart.
3. **Environment 3**, as planned: this branch only, `fra1`, Deployment Protection, `infomapper-dev`, values in
   Vercel's Preview environment scoped to the branch.
   - Difference: not every value of environment 2 goes there. The secret key, the migration URL and the demo password
     stay on the laptop (S29-09).
4. **Production (slice D):** no variables now. Q6 says why `main` makes no deployment.

- **CI:** as planned for the contract tests (a throwaway Postgres container) and the full run (local adapter).
  - Difference: the smoke set signs in with Supabase Auth, which a plain Postgres container does not have. *Proposal:*
    the smoke job runs the Supabase CLI's local stack (`supabase start`, Postgres and Auth only) on the runner.
  - This is still throwaway containers, never `infomapper-dev` (Q8, F14).
- **Environments 2 and 3 share `infomapper-dev`.** Agreed. Besides writes from slice B, the **seed loader's reset and
  the accounts script** run from the laptop and change what the preview shows at once. The loader prints that before
  it starts.

## Q5. Read-only on Postgres

- **The refusal.** `apply` refuses every write set with code **`archived`** and its own message,
  `READ_ONLY_SERVER_MESSAGE` = "This server is read-only for now, so nothing was saved." (or the PRD's wording; **L5**).
- **Why reuse the code:** every client rule for a refusal keys on it, so the archive's behaviour comes for free:
  - `REFRESHING_REFUSALS` in `run-command.ts` and `use-action.ts`: the fresh page;
  - `READ_ONLY` in `fields.tsx` and `note-drafts.ts`: the draft stays, read-only, "Not saved. You can still copy it.";
  - `CUTS` and `CUTTING_REFUSALS` in `row-saves.ts` and `save-cuts.ts`.
  - A new code would have to be added to all six sets.
- **Every write goes through `apply`.** Exactly three call sites exist: `run-command.ts:102`, `run-command.ts:143`,
  `undo.ts:89`. `seed-large-changes.ts` is a script. `undoHistory.update` comes only after a successful `apply`.
- **The pages show it by the archive's mechanism, not its words.**
  - `ShellData.workspace` gets `readOnly` (from the store's `readOnly: true`, a new `DataStore` field).
  - `standingOf(role, archived || readOnly)` gives `none`, so no tool, create or editor is offered, as for an archived
    workspace.
  - The top bar's indicator says "Read only" with the popover "This server shows the workspace read-only for now."
    It does not say "Archived".
  - "Archive" and "Unarchive" are not offered, because `standing` is `none`.
- **No prototype change needed.** The popover's text is the only new wording: **L5**.

## Q6. Vercel (with Łukasz's addition)

- **Region:**
  - New projects default to `iad1`. `fra1` is set in `vercel.json` (`"regions": ["fra1"]`) or in the project's
    settings ([region](https://vercel.com/docs/functions/configuring-functions/region)).
  - Proposal: `vercel.json` in the repository, so it is reviewed.
  - Supabase's Central EU (Frankfurt) is AWS `eu-central-1`, like `fra1`.
- **The proxy may run outside `fra1`.** The region page reads as if the proxy is deployed to every region. If so, a
  token refresh from another region travels to Frankfurt. `getClaims()` with asymmetric keys needs no network call (L2).
  Step 4 reads the proxy's region from the response headers.
- **Fluid compute** has been on by default for new projects since 23 April 2025
  ([fluid-compute](https://vercel.com/docs/fluid-compute)).
- **Function limits on Pro** ([limitations](https://vercel.com/docs/functions/limitations)): 300 s default and 800 s
  maximum duration, 2 GB / 1 vCPU default memory, and a **4.5 MB request and response body** (streamed responses
  excepted), confirming the PRD.
  - **F11:** the editor's snapshot was 2.2 MB on "Performance test" (slice 26, step 4). That is under the limit but
    only 2× from it, if a server action's answer counts as not streamed (not confirmed).
  - Imports (up to 25 MB, `proxyClientMaxBodySize`) cannot reach a Vercel function. They are writes, refused in this
    slice anyway, and slice B moves them to Storage, as planned.
- **Node:** Vercel offers 26.x (default), 24.x and 22.x
  ([node-js-versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)). `package.json`'s
  `engines` (`>=22 <23`) selects 22.x, matching `.nvmrc` and CI.
- **Next.js 16 and Turbopack:**
  - `next build` uses Turbopack by default, and `turbopack.resolveAlias` is top-level
    ([upgrading to 16](https://nextjs.org/docs/app/guides/upgrading/version-16)). This is what `npm run build` does
    today.
  - The `pagedjs` alias is a relative path into `node_modules`; the fonts are local files. No Vercel caveat is
    documented.
  - Step 4 checks that no page is prerendered at build time, which would read the database during the build. The pages
    call `cookies()` or `connection()`, so they should be dynamic.
- **Deployment Protection:** Standard Protection with Vercel Authentication, on all plans, protects every domain except
  production ([deployment-protection](https://vercel.com/docs/deployment-protection)).
  - For the measuring script: **Protection Bypass for Automation**, sent as the header `x-vercel-protection-bypass`,
    with `x-vercel-set-bypass-cookie` for a browser
    ([bypass](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation)).
  - Its secret stays in Łukasz's `.env.local` and is never printed.
- **Which deployments Vercel makes until slice D: this branch's previews only.**
  - `vercel.json`'s `git.deploymentEnabled` set to `{ "**": false, "slice/29-database-skeleton": true }` (minimatch;
    a branch matching any `true` rule deploys,
    [git-configuration](https://vercel.com/docs/project-configuration/git-configuration)).
  - `main` makes no Production deployment, other branches none either, until slice D changes the rule.
  - A pull request from this branch gets its preview link.
- **Environment variables:** Production, Preview and Development, and a Preview variable can be scoped to one branch
  ([environment-variables](https://vercel.com/docs/environment-variables)).
  - Proposal: environment 3's values as **Preview, scoped to `slice/29-database-skeleton`**, typed as Secret
    (write-only, [sensitive](https://vercel.com/docs/environment-variables/sensitive-environment-variables)).
  - Nothing in Production. Changes apply only to new deployments.
- **Who does what:** Łukasz makes the Vercel project and types the values himself, as with `.env.local`. I give the
  settings as a checklist in step 4 and never see a value. I can read the deployments' state with `gh` and Vercel's
  checks on the pull request.

## Q7. Seeding

- **The loader** (`scripts/pg-seed.ts`, development only) **reads no JSON file**. It builds the rows in memory with the
  same functions `npm run seed` uses (`addSeedDemoData`: the demo, the star, the documents, slice 20's checks), then
  `addLargeWorkspace` ("Performance test"), into an empty `ComposedDb`.
  - So it cannot meet KB: no path to `.data/` is read.
  - The PRD's "counts per table against the JSON" becomes counts against that in-memory build. It is the same rows
    `npm run seed` writes; one test compares it with `seedDevData`'s output.
- **Order of tables.** The 45 tables' foreign keys have no cycle between tables (checked in the migrations). Two
  tables refer to themselves: `attribute.copied_from_attribute_id` and `requirement.parent_id`.
  - The loader inserts tables in topological order (from the store's `foreignKeys`, the same graph) and, within those
    two, parents first.
  - No deferred constraints and no `session_replication_role`. Whether Supabase's `postgres` role may set it was not
    checked; the order makes it unnecessary.
- **One transaction, one statement per table:** `insert into t select * from json_populate_recordset(null::t, $1)`. It
  converts the types (F4), is portable SQL, and is fast enough for "Performance test".
- **Built-in rows:** the 19 classifications and 5 stereotypes per workspace come with the seed's rows, as the PRD says.
  `organization_access`'s demo hash comes too, so counts stay equal; it is the committed demo hash and unused on
  Postgres.
- **Reset:** `scripts/pg-seed.ts --reset` truncates every public table in one transaction before loading.
  - It refuses without `--reset` when any table has rows.
  - It refuses when `INFOMAPPER_MIGRATION_URL` is missing.
  - It names the target as `host/database` only, never the URL.
- **Then the accounts script**, after the loader, since it writes `auth_user_id`.
- **In CI** the same loader seeds the container for the contract tests and the local stack for the smoke.

**F12. Applying the migrations and the schema check do not fit together as the PRD says.** `npm run schema:check`
applies every migration itself and refuses a database whose `public` schema has tables.
*Proposal:* `infomapper-dev` gets its migrations from the Supabase CLI. It records them in
`supabase_migrations.schema_migrations`, keyed by timestamp, from `supabase/migrations`
([db push](https://supabase.com/docs/reference/cli/supabase-db-push)).
- The CLI's `--db-url` works in v3 and is removed in v4, where the target is `--remote=<url>`. The CLI is pinned as
  a dev dependency (`supabase`), and `scripts/pg-migrate.ts` passes the URL from `INFOMAPPER_MIGRATION_URL` without
  printing it.
- The schema check gets a **compare-only mode** (`npm run schema:check -- --existing`) that reads an existing
  database's tables and applies nothing.
- `db push` needs no Docker.

**F13. RLS and the API roles.**
- Every one of the 45 tables gets `enable row level security` in the migrations (checked). With no policies, `anon`
  and `authenticated` see nothing.
- With "expose new tables" off, Supabase still leaves `truncate`, `references`, `trigger` and `maintain` to the API
  roles on new tables
  ([securing-your-api](https://supabase.com/docs/guides/api/securing-your-api)).
- With the Data API off, nothing can use them. *Proposal:* nothing in this slice; slice D (production) revokes them in a
  Supabase-only script outside the portable migrations (AD-18). The plain Postgres in CI has no such roles.

## Q8. Tests

- **The contract suite** (`tests/contract/reads.test.ts`, with shared cases in `tests/contract/cases.ts`):
  - **Fixtures:** given rows (an in-memory `ComposedDb`: the seed, plus small hand-made cases for deleted rows, guards,
    defaults, upgrades and order), each adapter gets them in its own way. The local adapter gets a temporary JSON file;
    Postgres gets the loader in a fresh database.
  - **Then** every read of the 14 repositories and `snapshot` must give equal results, with order checked (F2), and
    `apply` is refused on Postgres.
  - It runs on the local adapter in `npm test`.
  - On Postgres it runs when `INFOMAPPER_CONTRACT_DB` is set: in the "Schema" workflow, against a second database in
    the same container (`createdb`), after the schema check.
- **Which existing files become it.** The PRD's "20 local-adapter test files" are 17 in `src/data`, plus
  `tests/infodocumenter-store.test.ts`. Of these, only the **read parts** of seven files move into the contract cases:
  `store`, `model-store`, `live-store`, `organization-store`, `requirement-store`, `working-layer-store` and
  `infodocumenter-store`.
  - Their write tests stay local, because `apply` refuses on Postgres until slice B.
  - The 9 `upgrade-*` tests, `measure-mode` and `password` stay as they are: they test the file format.
  - Moving cases changes no assertion. Each moved case is listed in step 2's report.
- **Postgres on the laptop:** Docker is not installed (`docker` not found), so the contract suite's Postgres side and
  the smoke run in CI only, unless Łukasz installs Docker Desktop or a native Postgres 17. **L6.**
- **The smoke set on Postgres** (`e2e/slice-29/`, 5 specs: S29-06's four pages and S29-05's sign-in and sign-out):
  - It runs in a new job of the "Schema" workflow: `supabase start` with only Postgres and Auth (the other services
    excluded), migrations, loader, accounts.
  - The app runs as a **production build** (`next build`, `next start`, `INFOMAPPER_DATA=postgres`), as on Vercel.
    That also shows a production build refusing the local adapter.
  - It is not part of `e2e/parts.ts` or the full run, which stays on the local adapter.
  - `npm run e2e`'s global setup reseeds `.data/e2e-db.json`; the smoke has its own config
    (`playwright.pg.config.ts`) and never touches `.data/`.
- **F14. The local stack in CI costs about 2–3 minutes per run** (image pulls, cached on the runner where possible). It
  runs on pull requests that touch `src/`, `supabase/`, `scripts/` or `e2e/slice-29/`.
- **The full run:** unchanged and on the local adapter, in steps 2, 3, 4 and 6 (Q10).

## Q9. Measurement

**F15. Pages cannot send `Server-Timing`.**
- In a Server Component, `headers()` is read-only, and once a page streams, its status and headers are fixed
  ([headers](https://nextjs.org/docs/app/api-reference/functions/headers),
  [streaming](https://nextjs.org/docs/app/guides/streaming)).
- Server actions (the editor's snapshot) cannot set response headers either.
- Only route handlers can, which among the five is the thumbnail route.
- The proxy runs before the page and cannot see its reads. No Next.js or Vercel page mentions `Server-Timing`.

*Proposal:* one timing record per request, in two outlets:
- **A counting store:** with `INFOMAPPER_TIMING=1`, `getDataStore` wraps the store. An `AsyncLocalStorage` keeps one record
  per request (pages, actions and route handlers alike), which counts port calls, SQL statements, the time in reads and the time spent waiting for a connection.
- **The thumbnail route** sends it as a real `Server-Timing` header (`db;dur=…;desc="n calls, m statements"`,
  `total;dur=…`).
- **The three pages** render a hidden `<script type="application/json" data-testid="im-timing">` with the record, only
  while timing is on. The measuring spec reads it; nothing is drawn.
- **The snapshot action** logs one line per call: the route's pattern and the figures, no ids, no names (CLAUDE.md,
  Security).
- **"Render" on the server** is the browser's TTFB and `responseEnd` minus the reads. The browser's Navigation and
  Resource Timing give these, as an observation rather than a server clock.

**The method:**
- A Playwright spec (`e2e/slice-29/S29-08-measure.ts`, `MEASURE=1`, headed Chrome on the laptop) runs against the
  preview with the bypass header. It signs in as a demo person with `INFOMAPPER_DEMO_PASSWORD`.
- **The pages:** the canvas page, the project home, the workspace home, the thumbnail route and the editor's snapshot.
- **The data sets:** the demo and "Performance test".
- **Warm:** the median of 10 loads after 2 discarded ones.
- **Cold:** the median of 5 first loads after a fresh deployment or more than 15 minutes idle. Fluid compute keeps
  instances warm, so cold loads are few and named as such.
- **The columns:** total in the browser, TTFB, server read time and wait, calls and statements. The same spec runs
  against the local adapter in `npm run measure:start` (production build, AD-31).
- **Optionally a third column:** environment 2 (the laptop on `infomapper-dev`), which shows the network's share.
- No bars until Łukasz has seen the figures (DB7).

## Q10. Shared infrastructure and risks

**What this slice touches that every slice uses:**
- `getDataStore` (`src/data/index.ts`).
- The table registry's schema type (F1).
- `src/proxy.ts`.
- `getSession` and `src/app/sign-in/page.tsx`.
- `ShellData` and `standingOf`.
- The pool on `globalThis`.

**The full runs (CLAUDE.md, "Test runs"):**

| Step | Full run | Why |
| --- | --- | --- |
| 2 | yes | the store's switch and the schema type (local adapter, table registry) |
| 3 | yes | the proxy and the session reach every page and every spec, though they are not on the exception's list |
| 4 | yes | the counting store wraps every read when on, and is code on the read path when off |
| 5 | yes, if ordered | the read fixes change the port's calls |
| 6 | yes | on the final commit, before the merge |

**Risks:**
- **F2 (order).** The likeliest source of "same reads" failures; the contract suite exists to find them.
- **F6 (TLS) and the transaction pooler with unnamed parameterized queries.** Both are tried first in step 2, on
  `infomapper-dev`.
- **L2 (signing keys).** With HS256, every request makes one call to Auth, which changes the measurement.
- **F11 (4.5 MB).** The snapshot on larger models, later.
- **`localeCompare` with no locale** sorts by the runtime's default locale: probably en-US on Vercel, maybe Polish on
  the laptop. The comparison with the local adapter could show different orders for names with Polish letters. An
  existing behaviour, not this slice's; noted for `docs/ideas.md` at the closing.
- **The proxy's region** (Q6).

---

## Differences from the PRD, collected

| # | What the PRD says | What I found | Proposal |
| --- | --- | --- | --- |
| F1 | the shared pieces are reused | they live in `src/data/local/schema.ts` | move the schema type, `readRows` and `upgradeRows` to `src/data/rows.ts` |
| F2 | same ordering | file order is implicit and relied on | an explicit `created_at, id` order on both adapters |
| F3 | one query per port call | 15 to 25 tables per call | one statement per table, in one read-only transaction |
| F4 | – | `timestamptz`, `numeric` and `bigint` come back in other types; `jsonb` reorders keys | type parsers per pool; check the hashes |
| F6 | – | TLS needs Supabase's CA | commit the public CA, verify fully |
| F7 | `auth_user_id` | `data-model-v2.md` §3 says the ids are equal | `auth_user_id`, §3 changed (L3) |
| F8 | the dev sign-in is not offered | the whole start page is the dev page | a Postgres-only form on `/sign-in` |
| F9 | refresh in the proxy | conflicts with AD-32 on thumbnails | skip the thumbnail path |
| F10 | the database URLs | `DATABASE_URL` already means the schema check's database | new names |
| F11 | 4.5 MB confirmed | the snapshot is 2.2 MB on "Performance test" | watch it |
| F12 | migrations by CLI, then the schema check | the check applies the migrations itself | `db push`, plus a compare-only check |
| F14 | the smoke against the container | it needs Auth | the Supabase local stack in CI |
| F15 | `Server-Timing` on five pages | only route handlers can send it | a timing record in the page or log; the header on the thumbnail route |
| – | the platform facts of section 4 | the 4.5 MB body limit, 800 s on Pro, `iad1` by default, the new keys by the end of 2026 and transfers only within a region ([project-transfer](https://supabase.com/docs/guides/platform/project-transfer)) are all confirmed | – |

**Prototype:** no difference. The slice adds no behaviour; the read-only indicator's words are new (L5).

## Earlier specs and tests each step touches

| Step | What | Earlier specs and tests |
| --- | --- | --- |
| 2 | `src/data/rows.ts`, `getDataStore`'s switch, the Postgres adapter, `READ_ONLY_SERVER_MESSAGE`, `ShellData.readOnly`, the loader, the migration, the compare-only check, the contract suite, the CI jobs | the 7 store test files (cases moved), `tests/table-registry.test.ts` (the schema type's import), `tests/layer-rules.test.ts` (`src/data/postgres` is the data layer), `tests/schema/*`; e2e: S0-* (the shell), S8-* (standing), the full run |
| 3 | `session.ts`, `proxy.ts`, `/sign-in` in Postgres mode, sign-out, the accounts script | S0-01 to S0-11 (sign-in, redirects), S8-01 to S8-13 (the start page, unlock), S12B-01 to S12B-06 (the thumbnail's 401 and no `Set-Cookie`), `src/app/_lib/unlock.test.ts`, `dev-session` tests; the full run |
| 4 | `vercel.json`, the counting store, the timing outlets, the measuring spec | S12B-bytes (the thumbnail's headers), S0-* (the store wrapper is off by default); the full run |
| 5 | if ordered: the read fixes | the contract suite; the full run |
| 6 | the docs | the full run on the final commit |

## The plan for steps 2 to 6

2. **The adapter's reads and the data.**
   - F1's move first, with its own commit.
   - The Postgres adapter with F2 to F6.
   - The switch, Q4's refusals and the refused `apply` (Q5).
   - The `auth_user_id` migration, if L3 says so.
   - `scripts/pg-migrate.ts` and `schema:check --existing` (F12).
   - The loader (Q7), the contract suite and the CI jobs (Q8).
   - **On `infomapper-dev`** (with Łukasz's values in `.env.local`, never printed): migrate, check, seed the demo and
     "Performance test", and print the counts.
   - Draft PR opened. Full run. Stop.
3. **Sign-in.**
   - `@supabase/ssr`, the proxy (F9), `getSession` on Postgres, the Postgres start page (F8), sign-out.
   - `scripts/accounts.ts`: its first run checks `admin.createUser` with sign-ups off and the secret key.
   - `npm run dev:pg` (environment 2), checked by hand: sign-in, the silo, sign-out, a wrong password.
   - The smoke set green in CI. Full run. Stop.
4. **The preview and the measurement.**
   - `vercel.json` (`fra1`, `deploymentEnabled`) and the checklist for Łukasz's Vercel project and variables.
   - The first preview deployment, then the counting store and the timing outlets.
   - The measurement report (`docs/prd/slice-29-measurement.md`) with Q9's columns. Full run.
   - **Stop with the figures** (DB7).
5. **The read fixes,** only if Łukasz orders them: one read per page, links in one query, measured again. Full run.
   Stop.
6. **Close.**
   - `decisions.md`: the PRD's section 8, with every new or changed text quoted in full for approval.
   - `data-model-v2.md` §3 (L3), `known-limitations.md`, `ideas.md`, README, CLAUDE.md (the adapters, the environments,
     the commands, how to run against Postgres), `.env.example`.
   - Full run on the final commit; the manual acceptance steps. Merge and tag only on Łukasz's command.

## Questions for Łukasz

- **L1.** Is your laptop's network IPv4 only? If so, the migrations and the loader use the session pooler (5432), not the
  direct connection. The IPv4 add-on is not needed.
- **L2.** In `infomapper-dev`'s dashboard (Project Settings, JWT Keys), is the current signing key asymmetric (ES256 or
  RS256) or the legacy HS256 secret? With HS256, I propose switching to an asymmetric key before step 3, so
  `getClaims()` checks sessions without a call to Auth.
- **L3.** `app_user.auth_user_id` (my recommendation), or equal ids as `data-model-v2.md` §3 says today (relies on
  `createUser`'s undocumented `id`)?
- **L4.** Environment 2's values in `.env.local`, as you planned (present but unused in environment 1), or in their own
  `.env.postgres.local`, read only by `npm run dev:pg`?
- **L5.** The read-only wording: the refusal "This server is read-only for now, so nothing was saved." and the indicator
  "Read only" with "This server shows the workspace read-only for now." Or the PRD's "This workspace is read only on
  this server."?
- **L6.** Docker Desktop (or a native Postgres 17) on the laptop, so the contract suite and the smoke also run locally?
  Without it they run in CI only.
- **L7.** The Supabase local stack in CI for the smoke (F14, about 2–3 minutes a run): agreed?
- **L8.** The explicit `created_at, id` order for the ports without one, on the local adapter too (F2): agreed? It changes
  no order the app has made, and the full run checks it.

## Łukasz's answers (16 November 2026)

- **F1 to F15:** as proposed. F13's revoke of the API roles' leftover privileges waits for slice D.
- **L1:** always the session pooler (5432) for the migrations and the loader; the network does not matter.
- **L2:** Łukasz checks `infomapper-dev`'s signing key before step 3 and says which it is.
- **L3:** `app_user.auth_user_id`; `docs/data-model-v2.md` §3 changes accordingly.
- **L4:** environment 2's values in `.env.postgres.local`, read only by `npm run dev:pg` and the Postgres scripts;
  confirmed git-ignored (`.gitignore`'s `.env*`) before anything reads it. Environment 1 never loads it.
- **L5:** the proposed wording: the refusal "This server is read-only for now, so nothing was saved."; the indicator
  "Read only" with "This server shows the workspace read-only for now."
- **L6:** no Docker for now: the Postgres side of the contract suite and the smoke run in CI only.
- **L7:** yes, Supabase's local stack in CI for the smoke.
- **L8:** yes, the explicit `created_at, id` order on both adapters.
- **`localeCompare`'s locale:** noted for `docs/ideas.md` at the closing.
