# Fix – The development server logs server actions' arguments

Status: **step 1, reconnaissance** (19 November 2026); no code yet. Branch `fix/dev-action-logging` from `dev` at
`4d920f3`. A fix to shared configuration (`next.config.ts`), outside slices (CLAUDE.md, the slice cycle, 4). Found during
slice 31's manual acceptance (`docs/prd/slice-31-acceptance.md`, step 4, "Found during the acceptance").

## 1. What leaks and where

**The cause.** Next.js 16.4.6's development server logs every Server Function call with its arguments by default:

```
POST /sign-in
  └─ ƒ signInWithAccountAction(…the arguments…) in 230ms src/app/_actions/session.ts
```

Confirmed in the version we run (`node_modules/next`, 16.4.6):

- the bundled docs, `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/logging.md`,
  section "Server Functions": logged by default during development, switched off with `logging.serverFunctions: false`;
- the config's type (`dist/server/config-shared.d.ts`: `serverFunctions?: boolean`, `@default true`) and its default
  (`dist/server/config-shared.js`: `logging: { serverFunctions: true }`);
- the gate (`dist/server/base-server.js`: `logServerFunctions: typeof logging === 'object' &&
  Boolean(logging.serverFunctions)`; `dist/server/app-render/action-handler.js`: only when `NODE_ENV === 'development'`);
- the printer (`dist/server/dev/log-requests.js`, `formatArgs` in `dist/server/dev/server-action-logger.js`: every
  argument stringified, depth 2, 3 items per level, so a sign-in's e-mail and password are printed whole).

`next.config.ts` sets no `logging`, so the default holds.

**Where it lands:**

| Where | What it held | Who can read it |
| --- | --- | --- |
| The laptop's terminal of `npm run dev:pg` (environment 2) | the e-mail and password typed into the account sign-in, i.e. a real password valid on `infomapper-dev`'s Supabase Auth, and every other action's arguments (model text) | the laptop; and any agent session that read that terminal (its transcript) |
| The laptop's terminal of `npm run dev` / `npm run demo` (environment 1) | the organization passwords typed into the start page, the development users' sign-in, model text | the laptop |
| The e2e workflow's `part-<n>` artifacts, `server.log` (public repository, 14 days) | the e2e data's action arguments, incl. the seed's development password `demo-pass` (4 lines in a part) | anyone |
| The e2e workflow's `check-round-<n>` artifacts | the same `server.log` when a check's part writes one (see 3) | anyone |

**Not affected:** production builds (the Vercel preview of `dev`, the Schema workflow's smoke job with `next start`,
`npm run build`/`start`, the measurement build): the gate is `NODE_ENV === 'development'`. Vercel's runtime logs
therefore never held arguments.

## 2. Anything else that prints a server action's arguments or a password

Searched `src/`, `scripts/`, `e2e/`, the Playwright configs and the workflows:

- **Our own `console.*` in `src/`:** none prints an argument. The write and undo failures print `e.name: e.message`
  only (`run-command.ts:131,160`, `undo.ts:112`); a Postgres message may quote one value for a type error (e.g. an
  invalid uuid), never a password: passwords never reach our SQL (Supabase Auth checks the account's, the local adapter
  checks the organization's hash with scrypt). The timing lines print numbers only (`INFOMAPPER_TIMING=1`). The local
  file's upgrade lines print counts. `signInWithAccountAction` (`src/app/_actions/session.ts:131`) logs nothing.
- **Next.js's other development logs:** `incomingRequests` prints method, path and status only (we put no personal data
  in URLs); `browserToTerminal` defaults to `'warn'` (the browser's warnings and errors in the terminal): our client
  code's `console.error`/`warn` print Paged.js and font messages only. Both stay.
- **Playwright traces and reports** (`report`, `blob-part-<n>`, `check-round-<n>`): a trace records each server action's
  request body, so a failing test's trace holds the e2e sign-in's `demo-pass` too (public). Every Playwright report also
  carries the commit's git metadata (author and committer name and e-mail), which is how the real e-mail reaches the
  reports (section 3). This is Playwright's, not the dev server's, and is not changed by this fix.
- **Scripts:** `pg:accounts` prints every person's e-mail (on `dev`; demo people only there, and the Schema workflow's
  smoke job prints the demo e-mails in its public job log). Slice 31's branch changes it for KB (its F3); nothing to do
  here. Every other script names a database as host/database only (`targetName`).

## 3. The CI artifacts (scanned 19 November 2026)

The repository is public. GitHub keeps the workflows' artifacts 14 days; on 19 November 1,536 were live, from 138 runs
(6 to 19 November): 655 `part-<n>`, 639 `blob-part-<n>`, 80 `report`, 162 `check-round-<n>`; no `smoke-report` (the
Schema workflow uploads it only on failure). The repository has **no Actions secrets, variables or environments**:
nothing valid outside a runner is handed to a job.

Every artifact was downloaded and searched (every file, zips inside zips, gzip, the HTML report's embedded base64 data),
for each value raw, URL-encoded and JSON-escaped, against the laptop's values, printing labels only:

| Value (from the laptop) | `part` | `blob-part` | `report` | `check-round` |
| --- | --- | --- | --- | --- |
| `INFOMAPPER_DEMO_PASSWORD` (valid on `infomapper-dev`) | not found | not found | not found | not found |
| `INFOMAPPER_KB_PASSWORD` | not found | not found | not found | not found |
| `SUPABASE_SECRET_KEY` | not found | not found | not found | not found |
| `SUPABASE_PUBLISHABLE_KEY` | not found | not found | not found | not found |
| `SUPABASE_URL` | not found | not found | not found | not found |
| `INFOMAPPER_DATABASE_URL` (and its password part) | not found | not found | not found | not found |
| `INFOMAPPER_MIGRATION_URL` (and its password part) | not found | not found | not found | not found |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | not found | not found | not found | not found |
| The laptop's `.data/session-secret` | not found | not found | not found | not found |
| The real e-mail (= `INFOMAPPER_KB_EMAIL`) | not found | **found**, 81 of 81 runs | **found**, 80 of 80 runs | **found**, 54 of 54 runs |
| `demo-pass` (public: the seed's development password, in the repository) | **found**, 81 of 84 runs (`server.log`) | **found**, 80 of 81 | **found**, 79 of 80 | not found |
| `smoke-demo-password-29` (public: `schema.yml`) | not found | not found | not found | not found |

- **The real e-mail** comes from Playwright's git metadata in every report (the commit's author and committer), not
  from the dev server. It is public anyway: it is the author e-mail of every commit in the public repository's history.
- **`demo-pass`** in the parts is the dev server's `server.log` (the sign-in through the start page). It is the seed's
  password, committed in the repository and valid only on a local data file; the laptop's `INFOMAPPER_DEMO_PASSWORD`
  is a different value.
- Two `check-round` artifacts of run 44056177332 (about 200 MB each) failed through the API and were scanned after
  `gh run download`: the same result as the other check rounds. All 1,536 were scanned.

**Conclusion:** no secret valid anywhere outside a runner reached an artifact. What the artifacts hold is the e2e data
and the seed's public password. The only real leak is the laptop's terminal (section 1).

## 4. The fix

`next.config.ts`:

```ts
// fix/dev-action-logging: the development server logs every Server Function call with its arguments by default
// (a sign-in's password included, slice 31's acceptance); request lines and the browser's warnings stay.
logging: { serverFunctions: false },
```

Not `logging: false`, which also drops the request lines that `server.log` is read for in a failing run.

## 5. The test that keeps it

`tests/dev-logging.test.ts` (Vitest, in `npm test`): loads the config **as Next.js does** (`loadConfig` from
`next/dist/server/config` with `PHASE_DEVELOPMENT_SERVER`, so the defaults are merged) and checks Next's own rule:
`typeof logging === "object" && Boolean(logging.serverFunctions)` is false. On the unfixed `next.config.ts` it fails
(the merged default is `true`); step 2 shows that run before the fix is committed. A later change to `logging` (e.g.
adding `fetches`) that drops the key fails it again.

Also in step 2, once: the full run's `server.log` files are searched for the `└─ ƒ` line (expected none) and for
`demo-pass` (expected none), counts only.

A guard in `scripts/e2e.ts` that fails a part whose `server.log` has a `└─ ƒ` line would also catch it; it changes the
e2e runner (shared infrastructure) for a check the unit test already makes, so it is **not proposed**.

## 6. Decisions for Łukasz

1. **Delete the old artifacts?** Not needed for secrets (section 3); they hold the public `demo-pass` and the e-mail
   that the commit history shows anyway. They expire by themselves within 14 days (the newest on 3 December).
   - Leave them: 0 clicks.
   - Delete: one command I run on your OK (`gh api -X DELETE` per artifact, all 1,536, or only the `part-<n>` ones with
     `server.log`, 655), 0 clicks for you; by hand it is about 3 clicks per run on 138 run pages.
   - Proposal: leave them.
2. **Rotate a secret?** Nothing in CI needs rotating (section 3). The laptop's terminal printed the password of the
   account you signed in with on `dev:pg`:
   - If you already changed that password (the advice in slice 31's acceptance): nothing more.
   - If not: change it in Supabase's dashboard (Authentication → Users → the user → "Send password recovery" or set a
     new one; about 4 clicks) and put the new value into `.env.postgres.local` (`INFOMAPPER_KB_PASSWORD` if it is KB's
     account; `INFOMAPPER_DEMO_PASSWORD` and `npm run pg:accounts` if it was a demo person, which also re-sets every
     demo account's password). If an agent session ever read that terminal, the value is in its transcript: a reason to
     change it either way.
3. **Playwright's git metadata in reports** (the real e-mail): unchanged by this fix and public anyway; turning it off
   would be a separate `chore/` (proposal: leave it).

### Łukasz's answers (19 November 2026)

1. **Old artifacts:** left as they are (no secrets; they expire by 3 December).
2. **Playwright's git metadata:** left as it is (the commits already show the e-mail).
3. **The leaked password:** Łukasz changes it himself after this fix is merged, on `slice/31-kb-copy`, with
   `pg:accounts -- --kb` and a new `INFOMAPPER_KB_PASSWORD`; nothing for this branch.
4. **For the record:** in this checkout, on this branch, Łukasz ran `npm run pg:accounts -- --kb`. `dev`'s version of the
   script does not know `--kb` (slice 31's F3 adds it), so it gave every person in `infomapper-dev`, the KB account
   included, `INFOMAPPER_DEMO_PASSWORD`, and printed the e-mails in his terminal. On this branch no `pg:` script is run;
   Łukasz fixes the KB account after this branch is merged.

## 7. Plan

- **Step 1 (this document):** reconnaissance, no code. Committed and pushed; no PR yet.
- **Step 2:** the test first (shown failing on the unfixed config), then the fix (`next.config.ts`); lint, typecheck,
  `npm test`; a draft PR into `dev`; the full run (a change to shared configuration: every e2e server reads it), with
  its `server.log` files searched as in section 5; a short note in `docs/known-limitations.md` is not needed (nothing
  remains limited). Report and stop.
- **Closing:** a prompt with the merge into `dev` only, on Łukasz's command.

## 8. Step 2 (19 November 2026)

- Commits: `80107ce` (the test, failing on the unfixed config: "expected true to be false"; the request-lines case
  passed), `eec30dd` (the fix; both cases pass). `npm run lint`, `npm run typecheck` and `npm test` (195 files, 2,370
  passed, 4 skipped) pass. Draft PR 83 into `dev`: CI's `check`, Schema's `migrations` and `smoke` pass.
- The full run: E2E run 44613791701 on `eec30dd` (which contains `dev`'s head `4d920f3`): 844 passed, 0 failed, 0 flaky,
  16 skipped; 18 min 37 s wall-clock. Parts (minutes, heap peak from the memory logs): 1: 12.3, 1,011 MB; 2: 10.8,
  894 MB; 3: 8.9, 1,030 MB; 4: 7.6, 1,209 MB; 5: 12.3, 1,288 MB; 6: 8.8, 1,723 MB; 7: 7.7, 1,374 MB; 8: 8.3, 1,387 MB;
  9: 14.6, 1,478 MB.
- Its nine `server.log` files (10,499 lines): 0 server action lines (`└─ ƒ`), 0 `demo-pass`, 0 of the laptop's
  `INFOMAPPER_DEMO_PASSWORD` or `INFOMAPPER_KB_PASSWORD`; 9,840 request lines remain. Before the fix, 81 of 84 runs'
  `part` artifacts held `demo-pass` in `server.log` (section 3).
