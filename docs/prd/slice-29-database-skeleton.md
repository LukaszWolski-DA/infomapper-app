# Slice 29 – Database A: the walking skeleton (reads on Postgres, Supabase sign-in, a Vercel preview)

Status: **proposed** (Łukasz, 16 November 2026). **Full path** (CLAUDE.md, "The slice cycle", 2): a second data
adapter, a new sign-in, a deployment. Branch `slice/29-database-skeleton`, from `main` (`c05dc33` or later). PRD file:
`docs/prd/slice-29-database-skeleton.md`; step 1 writes `docs/prd/slice-29-acceptance.md`. Test regime: CLAUDE.md,
"Testing".

The first slice of the database program (round DB, 16 November 2026). It changes no behaviour of the app on the local
adapter and has **no prototype change**: the prototype defines behaviour, and this slice adds none. Written from the
read-only report of 16 November 2026 (no file in the repository; quoted below as "the report"), **without reading the
code**.

## 1. Why

The application is close to the prototype. Its next features need a real database (versions and links of documents,
file storage, people outside the workspace, baselines in SQL), every slice adds limitations marked "the database slice",
and the undo history lives in the server's memory, which a serverless deployment cannot keep. Nobody knows yet how the
pages perform over a network: on the local adapter a page makes about 35 repository calls, each an in-memory filter;
ported one to one that may be about 60 queries per page (the report's estimate). This slice puts the thinnest whole path
on the web, **reads only**, to measure before the writes are built.

Decisions taken with Łukasz (round DB, 16 November 2026):
- **DB1.** AD-31 changes: the database program starts now. **No new feature slices during the program**, only fixes.
  After it, every slice writes both adapters, kept in step by contract tests.
- **DB2 (a).** The e2e suite stays on the local adapter; **contract tests** of the ports run on both adapters; a small
  e2e smoke set runs on Postgres, and one manual run on a Vercel preview.
- **DB3.** **The local adapter stays** for development, the demo and the e2e suite.
- **DB4.** Undo becomes lasting (`undo_step`, per person and workspace, 50 steps, in the write's transaction): **slice
  B**, not this one.
- **DB5.** **Supabase Auth** with a password per person replaces the organization's shared password (D-58), which goes
  away; accounts are linked through `app_user.auth_user_id` unless Supabase's admin API takes the application's id
  (Q3). **The development sign-in (test users' list) exists only on the local adapter**, never on Postgres or a preview.
- **DB6.** The Postgres adapter uses **`pg` directly through Supabase's pooler** (no supabase-js data queries, no stored
  functions, AD-18); writes in slice B lock the workspace row (`for update`).
- **DB7.** **Measure first:** Server-Timing on the heavy pages, the report's call pattern measured as it is, then the
  read fixes (one read per page, links in one query) only after Łukasz has seen the figures; bars are set after the
  first measurement.
- **DB8.** Supabase project **`infomapper-dev`** in Łukasz's **Pro** organization, region **Central EU (Frankfurt)**;
  Data API **off**, new tables not exposed, automatic RLS off (the migrations enable RLS on every table); sign-ups off.
  Vercel Pro, functions in Frankfurt (`fra1`). A production project comes in slice D.
- **DB9.** The program: **A** (this slice) the walking skeleton; **B** writes, lasting undo, counts in the transaction,
  imports through Storage, invitations; **C** copying the JSON in (demo, then a copy of KB); **D** production.
- **DB10.** **Sign-up is closed** while testing: organizations and accounts are made by a script (as licences are);
  people join through invitations (slice B); the organization's rights get a short round before slice B; deleting an
  account (GDPR) in slice D.

## 2. What to build

### The Postgres adapter, reads only

- A second implementation of `DataStore` (`ports.ts`) on Postgres: **every read** of the 14 repositories and
  `snapshot`, with the same results as the local adapter for the same rows (ordering, the live filter, `lostOriginals`,
  the requirement-link guard, `readRows`' defaults, module rows' upgrades).
- **`apply` refuses every write** with one domain error ("This workspace is read only on this server." or step 1's
  wording); the pages show their read-only state as for an archived workspace (step 1: the same mechanism or its own).
- **The adapter switch** in `getDataStore`: the local adapter by default, Postgres only when the server is configured
  for it (environment). A production build never uses the local adapter (AD-29); a Postgres build never offers the
  development sign-in.
- `snapshot` in one read-only transaction (REPEATABLE READ), as the report proposes.
- No read fix yet (DB7): the queries follow the ports as they are, so the measurement shows today's pattern.

### Data on the dev database

- The migrations applied to `infomapper-dev` with the Supabase CLI (or `psql`), in order; the schema check run against
  it.
- **A seed loader**: the demo (`npm run seed`'s rows, with the star and InfoDocumenter's documents) and "Performance test"
  written into Postgres in one transaction, checked by counts per table against the JSON. Never KB.
- The built-in rows (classifications, stereotypes) come with the seed's rows.

### Sign-in with Supabase Auth (Postgres mode only)

- E-mail and password per person, sessions through Supabase's cookies (`@supabase/ssr`), refreshed in the proxy;
  verified on each request as cheaply as the current plan allows (Q3).
- **Accounts by script**: for the demo's people, an auth account each with a password from an environment variable
  (dev only), linked to their `app_user`.
- In Postgres mode a signed-in person has every organization they belong to unlocked; the organization's password
  form, "Organization access" and the lock do not apply (DB5). The local adapter keeps its sign-in unchanged.
- Sign-out. No sign-up, no password reset e-mail, no invitations in this slice.

### The Vercel preview

- A Vercel project linked to the repository: functions in `fra1`, the environment variables of the preview
  environment pointing to `infomapper-dev`, Deployment Protection on (previews only for people signed in to Vercel),
  and the branches that deploy (step 1 proposes: this slice's branch only until slice D).
- The build as Next.js 16 with Turbopack (the `pagedjs` alias, local fonts).

### Measurement

- **Server-Timing** on the canvas page, the project home, the workspace home, the thumbnail route and the editor's
  snapshot: total, data reads (count and time), render.
- A measurement report on the preview from Łukasz's laptop: the demo and "Performance test", cold and warm, medians of
  several loads; queries per page; the same pages on the local adapter for comparison.

### Tests

- **Contract tests** of the reads: one suite run against both adapters (the local one in `npm test`; Postgres in the
  "Schema" workflow's container and locally against a Docker Postgres if available).
- **An e2e smoke set on Postgres** (sign in, workspace home, canvas page, project home, a document's page) in CI against
  the container, seeded by the loader.
- The full e2e suite unchanged on the local adapter.

### Not in this slice

Writes, lasting undo, the four count rules in transactions, invitations, password reset e-mails, the read fixes (only
after DB7's figures, as a step Łukasz orders), imports through Storage, KB, the production project, removing the
organization password from the local adapter's code.

## 3. Data model

- `app_user.auth_user_id` (uuid, unique, null) if Q3 needs it: a migration and `data-model-v2.md`.
- No other change.

## 4. Sources

- **The report of 16 November 2026** (read only): the ports, the local adapter's duties, the page reads, the N+1
  loops, sign-in, deployment, tests, the program.
- **Decisions:** AD-04, AD-05, AD-11, AD-18, AD-19, AD-22, AD-23, AD-29, AD-31, AD-32, D-58; round DB above.
- `docs/known-limitations.md`: the items marked for the database slice (most belong to slices B to D).
- **Platform facts checked on 16 November 2026** (to be checked again in step 1): Vercel functions' 4.5 MB request and
  response body limit on every plan, 800 s maximum duration on Pro, the default region `iad1`; Supabase's publishable
  and secret keys replacing `anon` and `service_role` by the end of 2026; projects transferable between organizations
  within one region.

## 5. Steps

Stop after each step; wait for Łukasz.

1. **Reconnaissance and check.** Answer Q1–Q10 in `slice-29-acceptance.md`, checking the platform's current documents
   (Supabase, Vercel, Next.js 16) for every assumption; every place where the PRD is wrong or costs more than it
   assumes, with a proposal; the earlier specs and tests each step touches; the plan for steps 2 to 6. No application
   code, no connection to `infomapper-dev` beyond checking that the environment variables Łukasz set exist (never
   printing a value).
2. **The adapter's reads and the data:** the Postgres reads and `snapshot`, the switch, the refused `apply`, the
   migrations applied to `infomapper-dev`, the seed loader, the contract tests on both adapters, the smoke set in CI.
3. **Sign-in:** Supabase Auth in Postgres mode, the accounts' script, the proxy, sign-out.
4. **The preview and the measurement:** the Vercel project, Server-Timing, the measurement report. **Stop** with the
   figures.
5. **The read fixes** (only if Łukasz orders them after step 4): one read per page and links in one query, measured
   again.
6. **Close.** The docs and the decisions quoted for approval (section 8); one full run on the final commit. Merge and tag
   `slice-29` only on Łukasz's command.

## 6. Acceptance criteria

| ID | Criterion |
| --- | --- |
| S29-01 | **The switch.** Without the Postgres configuration the app runs on the local adapter exactly as before (the full run); with it, every read comes from Postgres and the development sign-in is not offered. |
| S29-02 | **Same reads.** The contract suite passes on both adapters for every read and `snapshot`. |
| S29-03 | **Writes refused.** Every write on Postgres is refused with the read-only error; the pages show their read-only state. |
| S29-04 | **Seed loader.** The demo and "Performance test" in Postgres with the same counts per table as their JSON. |
| S29-05 | **Sign-in.** A demo person signs in with their password, sees only their organizations' workspaces (the silo rule), signs out; a wrong password is refused; no sign-up. |
| S29-06 | **Smoke on Postgres.** Workspace home, canvas page, project home and a document's page open and draw as on the local adapter (the smoke specs in CI). |
| S29-07 | **The preview.** Deployed from the branch in `fra1`, behind Deployment Protection, on `infomapper-dev`; the same smoke by hand. |
| S29-08 | **Measurement.** Server-Timing on the five pages; the report with medians, query counts and the local adapter's figures beside them. |
| S29-09 | **Security.** The secret key and the database URL only on the server; no value in the repository, the logs or a report; RLS on every table; Data API off. |
| S29-10 | CI, the Schema workflow with the contract tests, the full run before the merge; every earlier test changed, with its reason. |

**Manual acceptance:** Łukasz signs in on the preview, opens the demo's canvases, project homes and a document, and
"Performance test"; he reads the measurement report. KB is never read or written by this slice.

## 7. Questions for step 1

- **Q1. The adapter.** How each read maps to SQL (one query per port call as today), the shared pieces with the local
  adapter (`workspaceModelOf`, the guards, defaults, module upgrades) so no rule is copied, and where the adapter lives
  (`src/data/postgres/`).
- **Q2. Connections.** `pg` through Supabase's pooler on Vercel's Fluid compute: transaction or session mode, prepared
  statements, the pool per instance, the connection string for migrations (direct) and for the app (pooler).
- **Q3. Auth.** `@supabase/ssr` with Next.js 16 and the proxy; verifying the session per request (getClaims or the
  current way); linking accounts (`auth_user_id` or a given id); creating the demo's accounts by script; whether Auth
  and Storage need the Data API (it is off); Supabase's default e-mail limits (no e-mail is sent in this slice).
- **Q4. The switch and the environment.** The variables' names (the database URLs, the Supabase URL, the publishable and
  secret keys, the demo password), the switch's rule, what refuses the local adapter in production today.
- **Q5. Read-only on Postgres.** How the pages show it (the archive's mechanism or its own) and its wording.
- **Q6. Vercel.** The project's settings (region, Fluid compute, Node version), Next.js 16 and Turbopack with the
  `pagedjs` alias on Vercel's build, the branches that deploy, Deployment Protection, the environment variables per
  environment.
- **Q7. Seeding.** The loader's design (the seed's rows into Postgres in one transaction, the order of tables for the
  foreign keys), resetting the dev database, its use in CI.
- **Q8. Tests.** The contract suite (which of the 20 local-adapter test files become it), the Postgres in CI and
  locally, the smoke specs, the full run's place.
- **Q9. Measurement.** Server-Timing's fields, the measuring method from the laptop (browser, cold and warm), the pages
  and data sets.
- **Q10. Shared infrastructure and risks.** What this slice touches that every slice uses (the proxy, the session,
  `getDataStore`), which steps need a full run, and anything in the report that changes this plan.

## 8. Decisions (proposals) and docs

- **AD-31 (amended):** the database program starts after slice 28; no new feature slices during it; afterwards both
  adapters, kept in step by contract tests.
- **AD-29 (note):** the local adapter stays for development, the demo and the e2e suite; the development sign-in only
  there.
- **AD-04 and D-58 (notes):** Supabase Auth on Postgres; the organization password goes away (removed from the code in
  a later slice of the program).
- **AD-22 (note):** the dev project and the preview as built; Data API off.
- **D-84 or AD-37 (proposal):** the walking skeleton as built (reads, the switch, sign-in, the preview, the
  measurement), written at the closing.
- Docs: `decisions.md`, `data-model-v2.md` (if `auth_user_id`), `known-limitations.md`, `ideas.md`, README, CLAUDE.md
  (the adapters, the environment, the commands, how to run against Postgres).

## 9. Left for later

Slices B (writes, lasting undo, counts in transactions, the store revision, imports through Storage, invitations, the
organization's rights), C (the JSON copied in, KB on a copy first), D (production, backups, Auth hardening, GDPR, the
production measurements deferred since slice 1a).
