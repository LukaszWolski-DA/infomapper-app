# Slice 8 – Acceptance

Status: **step 3 (data, session and server), waiting for Łukasz.** Branch `slice/08-organizations`, from `main` at `bbc16c5` (tag
`slice-07c`). PRD: `docs/prd/slice-08-organizations.md`. The PRD stays as written; this file is its amendment.

## Answers from Łukasz (step 1) (27 October 2026)

These answers and the accepted findings amend the PRD.

1. **F1:** yes, a signed session cookie; the secret from `INFOMAPPER_SESSION_SECRET`, else `.data/session-secret` made
   once. The secret file must be git-ignored. *Checked:* `.gitignore` line 22 ignores `.data/` as a whole
   (`git check-ignore -v .data/session-secret` → `.gitignore:22:.data/`).
2. **F5:** yes, a separate table `organization_access`.
3. **F6:** yes, keep "First project" and "First canvas". "No project" is dropped from P5, and item 7's summary says so
   (the text below).
4. **F8:** yes. "Belongs" = has a workspace there, for signing in and unlocking; `organization_member` keeps the role
   and the home/guest distinction; the seed's guests stay guests; people added in slice 8 get a `member` row.
5. **F9:** refuse. An organization owner cannot be removed from their last workspace in that organization: "{name} owns
   {organization}, so they keep at least one workspace there." Admins and members leave the organization as P7 says.
6. **F10:** yes, fixed in this slice with `workspacePeople(store, workspaceId)`. People of another organization never
   reach the browser; removed people who have change events in the workspace keep their names in history.
7. **F11:** yes. The name is shown only if the person is already in this organization; otherwise "already has an
   account; they keep their own name."
8. **F12:** yes. Admins cannot change or remove owners; nobody changes or removes their own row; the server refuses
   both.
9. **F17:** yes, no password change from an archived workspace.
10. **F18:** yes, the format 9 upgrade writes no change events; one server log line instead.
11. **F15:** yes, unlocking from the switcher goes through the page's redirect; no dialog in the top bar; the lock icon
    stays.
12. **Section 6:** yes, provided the PRD's bars stay (verifying a password under 200 ms, creating an organization under
    1 s) and +10 ms applies per reseed. Step 2's report quotes section 6's final table.

The other findings (F2, F3, F4, F7, F13, F14 and the ones not answered above: F16, F19, F20, F21) are accepted as
recommended.

### The PRD as amended

| PRD place | Amended to |
| --- | --- |
| P5, item 8 | The first workspace has "First project" with "First canvas" and the 19 built-in classifications (F6); no "no project". |
| Item 7 | The summary names "a first project and canvas" (text list in step 2). |
| P7 | "Belongs" = has a workspace there (sign-in, the link, unlocking). Adding a person writes a `member` row when they have none in the organization; removing them from their last workspace there deletes their row (admins and members). An organization's owner cannot be removed from their last workspace there (F9). The seed's guests stay guests (F8). |
| P9, items 14, 18 | A table `organization_access` (`organization_id`, `access_hash`, `changed_at`, `changed_by`, `version`) instead of two columns (F5). |
| Item 4 | The session is a signed cookie with the unlocked organizations (F1). The lock sits at five places (F3). `next` returns only to a page of the organization's workspaces (F14). |
| Item 2 | AD-07 per organization: the last workspace cookie when it lies in the chosen organization, else its first workspace (F13). |
| Item 5 | No dialog: the switcher links as today and the page redirects to the link's form; the lock icon and its tooltip stay (F15). |
| Item 10 | An existing account's name is shown only when the person already has a workspace in this organization (F11). |
| Items 11, 12 | Admins cannot change or remove owners; nobody changes or removes their own row (F12). |
| Item 13 | No password change from an archived workspace (F17). |
| Item 18 | The upgrade writes no change events; one log line (F18). |
| Section 6 | The PRD's bars stay; a reseed bar of +10 ms is added (F7). The final table is in step 2's report below. |
| `/sign-in` and the e2e fixtures | Creating an organization from the start page runs through `runCommandAs` (F2); the development list keeps signing in as before. |

### Where each finding goes

| Finding | Step | What |
| --- | --- | --- |
| F1 | 3 | The signed cookie, the secret, `getSession()`; S0-01's fourth case (an unsigned cookie with a known id). |
| F2 | 3 | `runCommandAs` and the start page's server action; the `app_user` e-mail conflict mapped to the domain's text. |
| F3 | 3, 4 | `runCommand`, `undoRedoAction` and the three impact reads (3); `loadShellFor`'s redirect and `Landing` (4). |
| F4 | 2, 3 | The domain's half in step 2 (`WritableRows`, `LINK_TABLES`, `objectId`); the adapter's removal tests in `store.test.ts` (3). |
| F5 | 2, 3 | The type, `WritableRows` and the adapter's empty table in step 2; the migration, the data model and `getAccessHash` (3). |
| F6 | 2 | `newWorkspaceRows`, shared by `createWorkspace` and creating an organization. |
| F7 | 3 | The precomputed `demo-pass` hash in the seed and the upgrade, with its unit test; the reseed bar. |
| F8 | 2, 4 | The membership rows in adding and removing (2); "belongs" in the sign-in steps (4). |
| F9 | 2 | The refusal in `removePerson`. |
| F10 | 3 | `workspacePeople(store, workspaceId)` for the canvas page and the workspace page, with its unit test. |
| F11 | 2, 5 | The summary and toast texts (2); the People tab (5). |
| F12 | 2, 5 | The rules (2); owners' rows as text for admins and the new role wording (5). |
| F13 | 4 | The landing after signing in and unlocking. |
| F14 | 2, 4 | `safeReturnPath`, a pure function (2); used by the unlock form (4). |
| F15 | 4 | The switcher's lock icon and the redirect. |
| F16 | 6 | The known limitation and D-58 name D-29 as the precedent (decision texts quoted in step 3). |
| F17 | 2, 5 | The refusal (2); the box hidden in an archived workspace (5). |
| F18 | 3 | The format 9 upgrade: no change events, one log line. |
| F19 | 2, 3 | The `PasswordHasher` interface in `src/data/ports.ts` (2); the scrypt adapter in `src/data/password.ts` (3). |
| F20 | 3, 6 | D-58's text (3); the known limitation (6). |
| F21 | 4, 6 | "guest" in the sign-in step's list (4); the known limitation (6). |

## Step 1: start checks (27 October 2026)

- **Working tree:** clean.
- **Refs:** local `main` was at `408c3c0` (the merge of PR 20, slice 7b), 36 commits behind `origin/main`; Łukasz had
  it fast-forwarded (`git pull --ff-only`, no merge commit) to `bbc16c5` before the branch was made. After that, `main`,
  `origin/main` and the tag `slice-07c` all point to `bbc16c5`.
- **Baseline** (run on `slice/07c-classifications` at `5f2ecc8`, the same code as the tag's merge):
  - `npm run lint`: passes, 1 min 26 s.
  - `npm run typecheck`: passes, 12 s.
  - `npm test`: 99 files, 1,304 tests pass in 22 s (17.1 s in Vitest). The same counts slice 7c closed with.
- **Branch:** `slice/08-organizations` made from the tag `slice-07c`. The PRD was copied unchanged from
  `~/Downloads/slice-08-organizations.md` (byte-identical) and committed as `c3c0996`.

## Step 1: answers to Q1–Q10

### Q1. The session

**Today.**
- `src/app/_lib/dev-session.ts`: the cookie `infomapper_dev_session` is http-only, `sameSite: lax`, and ends with the
  browser session. Its value is the **user id in plain text**. `userIdFromDevCookie()` (line 13) accepts any UUID while
  `isLocalModeAllowed()` is true, and returns null otherwise. So a normal production build refuses the cookie.
- `src/app/_actions/session.ts`: `signInAsDevUser()` writes the chosen id, and `signOut()` deletes the cookie.
- `src/app/_lib/session.ts`: `getSessionUser()` reads the cookie and looks the id up in `users.get`; an unknown id
  is no session (S0-01's third test). `requireSessionUser()` redirects to `/sign-in`.
- `src/proxy.ts`: an optimistic check only. Without the cookie, every path except `/sign-in` redirects there. Since
  Next.js 16 it runs on the Node.js runtime (`node_modules/next/dist/docs/…/proxy.md`), so `node:crypto` is available
  there if it is ever needed.
- **Nothing protects the cookie against editing.** In the browser's devtools, setting the cookie to Łukasz's id
  (`SEED_IDS.userLukasz`) signs you in as Łukasz. With passwords this would make them pointless (F1).

**Proposal.**
- **A signed session cookie.** The value is `base64url(payload) + "." + base64url(HMAC-SHA256(secret, payload))`, with
  payload `{ v: 1, u: <user id>, o: [<unlocked organization ids>], at: <issued at> }`. It is checked with
  `timingSafeEqual`. A cookie whose signature or shape is wrong is no session, the same as an unknown id today.
- **The secret** comes from `INFOMAPPER_SESSION_SECRET` (at least 32 bytes, in `.env.local`, listed in `.env.example`).
  Without it, development and the measurement build use `.data/session-secret`: 32 random bytes written on first use,
  in the git-ignored `.data/`. A new secret file signs everyone out once, and nothing else. The secret is never logged.
- **`getSession()`** returns `{ user, unlocked: Set<Uuid> }`. `getSessionUser()` stays as a thin wrapper, so the ~20
  callers that need only the user do not change.
- **Unlocking:**
  - A password sign-in writes `o: [that organization]`.
  - Unlocking another organization adds its id and signs the cookie again, in the server action.
  - Creating an organization adds it.
  - The development list writes **every organization the test user reaches at sign-in time** (as members and as guests,
    `organizations.listForUser`), as P2/item 4 ask.
  - Sign out deletes the cookie.
- **e2e fixtures.** Every spec signs in through `signInAs()` (`e2e/slice-00/helpers.ts:13`), which clicks the
  development list. The server action writes the signed cookie, so no helper changes. One spec sets the cookie by hand:
  `S0-01.spec.ts:29` writes an unknown id. It stays refused (an unsigned value), and I propose a fourth case: **"an
  unsigned cookie with a known user's id is not a session"**. The new helpers (`signInWithPassword`,
  `createOrganization`, `addPerson`) go through the start page.

### Q2. Where pages and actions decide access

**Pages.**
- `loadShellFor()` (`src/app/_lib/shell.ts:47`) is the only membership check for the three workspace pages
  (workspace home, project home, canvas). It answers `notFound()` when the person is not a member (S0-11).
- `src/app/page.tsx` (`Landing`) picks the last used workspace from `infomapper_last_workspace`, else the first.
- `src/app/sign-in/page.tsx` 404s outside development.

**Writes.**
- Every write goes through `runCommand()` (`src/app/_lib/run-command.ts:40`), the import's route handler too
  (`runImport` in `src/app/_lib/import-sources.ts`).
- The exception is `undoRedoAction` (`src/app/_actions/undo.ts:52`), which applies its own write set.

**Reads that check membership themselves:** `entityImpactAction` (`_actions/model.ts:108`),
`classificationImpactAction` (`_actions/classification.ts:83`) and `sourceDeleteImpactAction`
(`_actions/source-change.ts:146`).

**The other checks.** The ~25 other `workspaces.getMember(…)` calls build the `WorkspaceAccess` that the domain's
`checkPermission()` reads. Every one sits inside a `runCommand` callback.

**AD-07 and the switchers.**
- `src/proxy.ts` remembers `infomapper_last_workspace` (one value per browser, not per organization) and the last
  project per workspace.
- The organization switcher (`top-bar.tsx:104`) links to each organization's first workspace
  (`ShellData.organizations[].firstWorkspaceId`).

**Proposal.** Item 4's lock goes into five choke points, not into the ~25 calls:
1. `loadShellFor`: a member page of a locked organization redirects to
   `/sign-in?org={id}&next={path}`. A non-member still gets `notFound()` (S0-11).
2. `runCommand`: after the command builds its write set, the workspace of its first event must belong to an unlocked
   organization; otherwise it is refused with "Unlock {organization} first: open it and enter its password." (text for
   step 2). Creating an organization from the start page has no session yet and takes its own path (F2).
3. `undoRedoAction`: the same check before it applies anything.
4. The three impact reads: the same check (they answer `not_found` today).
5. `Landing`: it chooses only among workspaces of unlocked organizations. Without one, it sends the person to the
   start page's organization step.

A unit test on the guard, and S8-06's server refusal (a direct action call into a locked organization, as S0-06
replays an action), cover the write path.

**Returning to the page asked for.** `next` is accepted only as a path `/w/{workspace id}[/…]` whose workspace
belongs to that organization. Anything else lands as AD-07 says (F14, no open redirect).

**The switcher** keeps linking to the workspace. That page's redirect is what "asks for the password" (F15).

### Q3. Creating a workspace

**The command.** `createWorkspace()` (`src/domain/commands/workspace.ts:40`) checks `checkCreateWorkspace()` (a home
member of the organization, not a guest) and writes:
- the workspace and the creator's `workspace_member` (owner);
- **"First project" with "First canvas"** and their `project_canvas` link;
- the 19 built-in classifications (slice 7c, `builtinClassificationRows`);

all in one `buildWriteSet(ctx, workspace.id, …)`.

**Callers.**
- `createWorkspaceAction` (`_actions/workspace.ts:29`, the workspace switcher's "New workspace").
- `domain/commands/workspace.test.ts`.
- `e2e/slice-07c/S7C-01.spec.ts`, through the switcher.

The seeds do not call it: `seed.ts` writes rows directly and adds the classifications with
`addBuiltinClassifications`.

**Reuse in one change group** works, but not by calling the command as it is:
- It builds its own write set with its own change group.
- Its permission check needs the organization membership, which does not exist yet when the organization is being
  created.

*Proposal:* extract the rows into `newWorkspaceRows(ctx, organizationId, name, ownerId)`, which `createWorkspace` and
the new `createOrganization` both use. `createOrganization` then makes one `buildWriteSet(ctx, workspace.id, [app_user?,
organization, organization_member, …workspace rows])`.

**Rows without `workspace_id`** need the following, none of which exists today:
- `app_user`, `organization` and `organization_member` added to `WritableRows` (`types.ts:562`).
- Their key rules in the local adapter's `keyOf` and in `objectId()` (`changes.ts:58`). `organization_member` has no
  `id`, so `object_id` = the user, as for `workspace_member`.
- `organization_member` and `workspace_member` added to `LINK_TABLES` (`types.ts:595`), so they can be removed (F4).

The change group itself only needs a `workspace_id` for its events (Q4).

**The project.** P5 and item 8 say "no project", but the command and the prototype make "First project" with "First
canvas" (the prototype's `emptyModel()`). See F6.

### Q4. Change events for organization rows

**Today.**
- `change_event.workspace_id` is required: `buildWriteSet` takes one workspace, and the local schema has a foreign key
  to `workspace` (`schema.ts:479`).
- `isUndoable()` (`domain/commands/undo.ts:137`) is true only when **every** event's table is in `UNDOABLE_TABLES`.
  `workspace`, `workspace_member`, `app_user`, `organization` and `organization_member` are not, so a group with any of
  them is never an undo step, and undo never replays such a row. `loadForUndo` reads only undoable tables.
- Change events never reach the browser. The canvas page and `approveImportAgainAction` read them on the server for
  four-eyes and pass only author ids.

**Proposal (as P10 and item 17).**

| Action | Change group's workspace |
| --- | --- |
| Creating an organization | its first workspace (made in the same write set, so the foreign key holds) |
| Adding, changing or removing a person | that workspace (the `organization_member` row a removal or an addition writes goes in the same group) |
| Changing the password | the workspace whose People tab was used (F17 for the archive) |

- `object_id` for `organization_member` is the user.
- **The marker.** `buildWriteSet` replaces every secret column in both images with the string `"(changed)"` when the
  value differs between before and after, and `"(unchanged)"` otherwise. It never writes the value. The secret columns
  live in one constant in `changes.ts` (`SECRET_COLUMNS`), so a later column cannot forget it. A unit test checks that no
  image of any write set contains a value that looks like a hash (`scrypt$`).
- **The upgrade** to the new format writes no change events (F18).
- Making `change_event.workspace_id` nullable for organization-level events is the alternative. It contradicts AD-10
  ("every work table has `workspace_id`") and the data model, and is not proposed.

### Q5. Roles today

**The permissions module.** `src/domain/permissions.ts`: `WORKSPACE_ACTIONS` and `ROLE_PERMISSIONS` (line 37) have
**no people actions**. `checkPermission()` handles a non-member, the archive (only `view` and `unarchive` pass) and
the role. Archive and unarchive are owner only; settings are owner and admin.

**The People tab.** `src/app/w/[workspaceId]/page.tsx:191` shows a read-only table (person, e-mail, "Guest from …"
badge, role) and the table "What each role can do", with Admin's row "invite, roles, settings". There is no select,
Remove or invite.

**The role texts.** `src/app/_lib/roles.ts` `ROLE_CAN.admin` says "invite people". It and the role table need new
wording (text list in step 2).

**Proposal.**
- New actions `people.edit` (owner, admin) and `organization.edit_access`. The latter is checked against the
  organization role (owner, admin), not the workspace role, by its own function next to `checkCreateWorkspace`.
- **Giving or taking Owner is for owners only.** The prototype offers Owner in every admin's select
  (`renderWsHome`); the PRD's assumption is stricter, and I support it.
- It also needs one more rule (F12): **an admin cannot change or remove an owner**, since a removal takes the role too.
  An admin sees an owner's row as text with no Remove.
- Nobody changes or removes their own row, which the server refuses too.
- The last-owner rule is per workspace.
- AD-05 gets a note in step 3 if Łukasz agrees.

### Q6. Organization members and guests

**How membership is written and read.**
- `organization_member` is written only by the seed (`seed.ts:124–125`). InfoMate has Łukasz (owner), Anna and Piotr
  (members); Retail Co has Marek (owner) and Kasia (member).
- `organizations.listForUser` (`store.ts:90`) returns an organization the person is a member of **or reaches through a
  workspace** (a guest's).
- `isGuest()` derives the guest marker from the missing `organization_member` row (data model §3).
- `checkCreateWorkspace` refuses guests.

**The seed's guests.**
- **Łukasz** is a reviewer in Sales analytics (Retail Co) without Retail Co membership. S0-02 picks "Retail Co guest",
  and S0-03 expects "Reviewer · guest" and "…a guest from InfoMate."
- **Kasia** is a reader in Retail Co – DWH (InfoMate) without InfoMate membership. S0-03 expects "Reader · guest".
- **Kasia also has no workspace in Retail Co**, the organization she is a member of. P7 says she does not belong to it.
  Signing in to Retail Co would land her on "No workspace yet". See F8.

**Proposal (F8).**
- "Belongs to an organization" is read as **has at least one workspace in it**. That covers the sign-in step's list,
  the link's check, and unlocking. Kasia sees InfoMate only, and Łukasz sees both.
- The guests stay as they are, so S0-02 and S0-03 do not change. A guest unlocks a guest organization with that
  organization's password.
- `organization_member` keeps the role (owner, admin, member) and the home/guest distinction.
- Adding a person writes a `member` row when they have none in this organization, so people added in slice 8 are never
  guests (PRD section 8: no new guests).
- P7's removal deletes that row when the last workspace goes, for the role `member` (F9 for owners and admins).

**Organization names** are unique nowhere: no index in `schema.ts:193` or in the migration, and no domain check. The
PRD's assumption holds.

### Q7. Where organization rows reach the browser

**Every read of an organization row today:**

| Where | What reaches the browser |
| --- | --- |
| `sign-in/page.tsx:20` (development list) | `name` and the guest flag |
| `_lib/shell.ts:54` (`ShellData`) | `organization: { id, name }` and `organizations[]: { id, name, guest, workspaceCount, firstWorkspaceId }`, explicitly picked |
| `w/[workspaceId]/page.tsx:39` | `organizations.get` per member's organization, server-side; only the name reaches the page ("Guest from …") |
| `_actions/workspace.ts:32` | `organizations.get` for the permission check; the action returns only `href` |

No client component receives a whole organization row, and no action returns one.

**But the hash would still reach the server code that reads organizations.** Every `organizations.get` and
`listForUser` caller would get it, and every future update of an organization (a rename later) would have to carry it
(F5). The proposal keeps it out of the `Organization` type altogether.

**A silo leak that exists today (F10).** The canvas page reads `store.users.list()`
(`c/[canvasId]/page.tsx:101`) and passes **every person's display name in the system** to the browser as `people`
(line 252, for note authors and approvals). Across organizations, that breaks P11's silo ("nobody sees another
organization's … names").

**The scrypt adapter.**
- `node:crypto` `scrypt` with N = 2^15, r = 8, p = 1, a 16-byte random salt, a 32-byte key and `maxmem` 64 MiB. It is
  stored as one string, `scrypt$15$8$1$<salt b64url>$<key b64url>`, and compared with `timingSafeEqual`.
- The parameters are chosen to meet section 6's bar on the reference laptop; step 3 measures them and lowers N to 2^14
  if the median is over 200 ms.
- The interface `PasswordHasher { hash(plain): Promise<string>; verify(plain, stored): Promise<boolean> }` goes in
  `src/data/ports.ts`, with the adapter in `src/data/password.ts` (`server-only`). Reasons:
  - The domain never calls it: its commands are pure and synchronous.
  - The format 9 upgrade (`src/data/local`) needs it, and `data` may not import `app`.
  - `app` imports `data` already (AD-19).
- The domain validates the plain password's rules (length, both equal) in a pure function. The server action hashes
  only after that passes and hands the opaque hash to the command (F19).

### Q8. The local data file and the schema

**The next format is 9** (`schema.ts:79`, `DEV_DB_FORMAT = 8`; `file.ts:74` `upgradeDb` chains 2 → 8).

**Format 9's upgrade:**
- It writes the access hash of `demo-pass` for every organization without one, in the new table or columns (F5). The
  hash is the precomputed constant the seed uses (F7), so loading an old file costs no scrypt.
- It writes no change events (F18).
- It logs one line: "Slice 8 upgrade: {n} organizations got the development password (see README)." No password and
  no hash in the line.
- There is no report file. Unlike 7c's, there is nothing per row to list.

**The migration** is `supabase/migrations/2026102…_organization_access.sql`, DDL only:
- Either F5's table `organization_access` (`organization_id` uuid primary key references `organization`, `access_hash`
  text not null, `changed_at` timestamptz not null, `changed_by` uuid references `app_user`, `version`), with
  `enable row level security`;
- or the PRD's two nullable columns on `organization`.

**`npm run schema:check`** (`scripts/check-schema.ts`, `tests/schema/`) reads the row types of `DevDb`. Either choice
needs the type in `schema.ts`:
- F5's table: a new `OrganizationAccess` interface.
- The PRD's columns: a stored-row type `StoredOrganization = Organization & { access_hash; access_changed_at }` used
  only by `DevDb`.

`compare-schema.test.ts` gets the new table or columns.

### Q9. People rows

**`app_user`** (`types.ts:41`): `id`, `email`, `display_name`, `created_at`, `last_seen_at`. It has no
`version`, `created_by` or `deleted_at`.
- The local schema has a unique index on `email` and the check `email = lower(email)` (`schema.ts:187`); the migration
  has `app_user_email_uq` too.
- There is no write path today: only the seed writes users.

**A new person:**
- `display_name` is the name typed, trimmed and not empty.
- `email` is trimmed and lower-cased, and checked against a simple form (the prototype's regex in `renderWsHome`'s
  invite: `^[^@\s]+@[^@\s]+\.[^@\s]+$`).
- `last_seen_at` is null; nothing writes it in slice 8.

**Two writers racing on one e-mail** would get the adapter's "This already exists (app_user: email)". `runCommand`
maps a conflict on `app_user` to the domain's "This e-mail address already has an account…" (part of F2).

**"Last changed by".** These read names from `users.list()` by id, never from memberships:
- the note's author and "resolved by";
- the mapping's approver;
- four-eyes' last editor;
- a change to resolve's "who".

`app_user` rows are never deleted, so a removed person's name stays readable everywhere. F10's fix must keep that: it
takes the names of everyone who has a change event in the workspace, not only current members.

### Q10. Earlier tests and docs

**Specs that change or need a look:**

| Spec | Why |
| --- | --- |
| `S0-01` | The sign-in page gets the two paths above the list. Its test ids `page-sign-in`, `banner-dev-sign-in` and `list-dev-users` stay. Add the forged-signature case (Q1). |
| `S0-02` | Unchanged if the development list unlocks everything (no lock icon). The menu hint "Retail Co guest" stays (F8). |
| `S0-03` | Unchanged under F8 (guests kept). |
| `S0-06` | Gains the reviewer's People tab: no Add, no select, no Remove. The new assertions are S8-12's, so S0-06 itself need not change. |
| `S0-07` | Its admin case adds Anna through the adapter (`e2e/slice-00/helpers.ts:77`, a `workspace_member` insert through `buildWriteSet`). It still works with the new link-table rule. |
| `S0-11` | A non-member's 404 stays. A member of a locked organization is S8-06's case. |
| `S6B-01` | Clicks `tab-people`. The tab's label "People ({n})" stays. |
| `e2e/global-setup.ts` | Warms up through the development list. Unchanged. |

Unit tests that change:
- `dev-session.test.ts` (the signed format);
- `permissions.test.ts` (people actions);
- `workspace.test.ts` (the extracted rows);
- `store.test.ts` (writable tenancy tables, link-table removal);
- `changes` tests (the secret marker);
- an `upgrade-9.test.ts`.

**Known limitations this slice touches:**
- "No undo outside canvases" (the right precedent is D-29's pin, F16).
- "The undo history lives in server memory" (unchanged).
- New entries:
  - the shared organization password;
  - an e-mail reveals its organizations and that it has an account;
  - a password change keeps sessions;
  - no limit on failed sign-ins;
  - the development list signs in as anyone, so the silo is a rehearsal (F20);
  - development only.

**Status lines and docs:**
- The README's status line names slices 0–7b as merged and 7c as waiting. It needs 7c merged and slice 8.
- `docs/inventory-prototype-vs-app.md` lines 34–35 and 175 ("new organization", "Settings and roles": "database
  (AD-04)").
- `CLAUDE.md`'s helper paragraph.

## Step 1: findings from the critical review

**F1. The session cookie can be edited into any person (contradicts P4 and P11; misses what the code needs).**
`infomapper_dev_session` holds the raw user id (`dev-session.ts:13`, `session.ts:9`), so the session cannot carry
unlocked organizations safely. Today anyone can become anyone by editing the cookie.
*Recommendation:* Q1's signed cookie, with the secret from `INFOMAPPER_SESSION_SECRET` or `.data/session-secret`.

**F2. Creating an organization from the start page has no session, and `runCommand` needs one (misses what the code
needs).** `runCommand()` returns "Your session has ended" without a session user (`run-command.ts:40`). Its context's
`actorId` is the signed-in user, but here the actor is the person being created.
*Recommendation:* a sibling `runCommandAs(actorId, build)` in `run-command.ts`, used only by `createOrganization` from
the start page. It runs the same steps (no live canvases, no settling: no such tables) and records nothing in the undo
history (`isUndoable` is false). The server action then writes the signed cookie and redirects. It also maps an
`app_user` e-mail conflict to the domain's message.

**F3. The lock has no single place in the code (costs more than it assumes).** Item 4 reads as one check, but
membership is checked at about 25 call sites. *Recommendation:* Q2's five choke points (pages, `runCommand`, undo, three
impact reads, landing), each with a test. The PRD's "the server checks every one" becomes S8-06's direct action call.

**F4. The write path cannot write tenancy rows yet (misses what the code needs).**
- `app_user`, `organization` and `organization_member` are not in `WritableRows` (`types.ts:562`).
- `workspace_member` and `organization_member` are not in `LINK_TABLES` (`types.ts:595`), so a removal cannot be
  expressed. The data model already says their `delete` event has a null after image.
- A role change is an `update` of `workspace_member`, which has no `version`. The local adapter then compares the whole
  stored row (`store.ts:331`), which works as the version check (two admins changing one role at once: the second gets
  "Someone changed this meanwhile").

*Recommendation:*
- Add the three tables to `WritableRows` and the two link tables to `LINK_TABLES`.
- Add `objectId` rules (user id for both link tables).
- Add the matching `keyOf` in the local adapter.
- Add unit tests in `store.test.ts`.

**F5. `organization.access_hash` on the organization row would travel with every read of an organization (contradicts
item 15's intent, costs more than it assumes).**
- Every `organizations.get` and `listForUser` caller would hold the hash.
- The local adapter writes whole rows (`store.ts:334`), so any later update of an organization (a rename, AD-09's
  transfer) would have to carry the hash through the domain.

*Recommendation:*
- A separate table **`organization_access`** (`organization_id` primary key, `access_hash`, `changed_at`, `changed_by`,
  `version`), with RLS on and no public policies.
- It is read only by `OrganizationRepository.getAccessHash(organizationId)`, server-side.
- The `Organization` type stays as it is.
- Its change events carry Q4's marker.
- `access_changed_at` becomes `organization_access.changed_at`.

This changes P9's wording (two columns become a table). If Łukasz prefers the columns, the fallback is a stored-row
type in the adapter, with the repository stripping the hash and a separate update write for it.

**F6. "No project" contradicts the command and the prototype (PRD wrong).** P5 and item 8 want the first workspace
empty "apart from the 19 built-in classifications (slice 7c); no project", through "the existing command that creates a
workspace". That command makes "First project" with "First canvas" (`workspace.ts:40`), and so does the prototype's new
organization (`openOrgMenu` → `emptyModel()`: "First project", "First canvas", plus a concept "General" that the app
never made).

Without a project, the workspace home shows no project tile and the top bar's project switcher shows "Project" with
nothing in it. That is a state no page has been tested in.
*Recommendation:* keep "First project" and "First canvas", as the command and the prototype do. The summary says "the
workspace {workspace} with a first project and canvas and the 19 built-in classifications". "Empty" stays true for the
model.

**F7. Hashing in the seed would slow every e2e test (costs more than it assumes).** `resetDevData()`
(`dev-data.ts:15`) seeds before **every** e2e test. One scrypt per organization at ~100 ms adds about 0.2 s per test,
over 800 tests a full run, which is minutes.
*Recommendation:*
- The seed and the format 9 upgrade write one **precomputed constant** for `demo-pass` (a fixed salt; the hash string in
  `seed.ts`).
- A unit test verifies the constant against `demo-pass` with the real adapter, so it cannot drift.
- Section 6 gets a bar on the reseed time.

**F8. P7 does not match the seed (contradicts the code, the seed and S0-02/S0-03).**
- Kasia is a Retail Co member with no Retail Co workspace.
- Łukasz and Kasia are guests (workspace members without organization membership), which slice 0's specs check.

Read literally, P7 makes Kasia a non-member of Retail Co and Łukasz a member of Retail Co.
*Recommendation:* Q6's reading:
- "Belongs" = has a workspace there, for signing in and unlocking.
- `organization_member` keeps the role and the home/guest distinction.
- The seed's guests stay guests.
- People added in slice 8 get a `member` row.

**F9. P7's removal can leave an organization without its owner (misses a case).** Removing InfoMate's owner, Łukasz,
from his last InfoMate workspace (by another workspace owner) would end his organization membership. InfoMate would
then have no owner, and nobody could change its password (item 13).
*Recommendation:* P7 ends the membership only for the role `member`. An organization's owners and admins keep theirs,
and the confirmation leaves out the "they leave {organization}" sentence for them. (The alternative: refuse removing an
organization owner from their last workspace.)

**F10. The canvas page sends every person's name in the system to the browser (a silo leak today).**
`c/[canvasId]/page.tsx:101` and `:252` pass `users.list()` as `people`. `_actions/note.ts:44` uses the full list
server-side only.
*Recommendation:* in this slice (it is what P11 promises), the canvas page passes only the people who are members of
the workspace or have a change event in it. A small helper `workspacePeople(store, workspaceId)` is shared with the
workspace page. A unit test checks that a user of another organization is absent.

**F11. "Add a person" would reveal another organization's person's name (contradicts P11).** Item 10's summary "{e-mail}
already has an account as {account name}" tells an admin of A the display name of a person who is only in B. It also
confirms that the e-mail has an account.
*Recommendation:*
- Show the account's name only when that person is already in this organization.
- Otherwise: "{e-mail} already has an account; the name they chose stays." The toast then names the e-mail, not a
  name: "Added {e-mail} to {workspace} as {role}."
- The account's existence stays revealed, as P3's e-mail step does: a known limitation.

**F12. Admins and owners (misses rules).** Item 11 lets only owners give or take Owner, but item 12 lets admins remove
anyone, an owner included, which takes the role too.
*Recommendation:*
- An admin cannot change or remove an owner (the row shows the role as text, with no Remove).
- Nobody changes or removes their own row; the server refuses it too.
- The texts that say "invite" (`ROLE_CAN.admin`, the role table's "invite, roles, settings") get new wording in step 2's
  list.

**F13. AD-07 per organization (the PRD assumes what the code does not keep).** "Lands on the person's last used
workspace in that organization": the cookie `infomapper_last_workspace` holds one workspace for the whole browser
(`preferences.ts`).
*Recommendation:* use it when it lies in the chosen organization, else the first workspace there (creation order, as
today). No new cookie.

**F14. The return path after unlocking (a security gap to avoid).** Item 4's "then opens the page asked for" needs a
`next` parameter, and an unchecked one is an open redirect.
*Recommendation:* accept only `/w/{id}…` paths whose workspace belongs to the organization being unlocked.

**F15. The switcher's unlock (cheaper than the PRD).** Item 5's "choosing one asks for its password" needs no dialog in
the top bar. The menu item links to the workspace as today, and the page redirects to the link's form (item 4).
*Recommendation:* that, plus item 5's lock icon and tooltip on locked items. The top bar gains one icon per locked
item, inside the menu (rendered only while it is open), with no size read.

**F16. The PRD's precedent for "not undo steps" (wording).** The known limitation "No undo outside canvases" says
home-page changes **are** in the undo history (undoable from a canvas). The right precedent is D-29's pin, which
writes a change group but is no undo step. The code already behaves as P10 wants (`isUndoable` is false for every
table involved). *Recommendation:* the known-limitations entry and D-58 name D-29 as the precedent.

**F17. The password change, the archive and the organization role (misses rules).** Item 13 shows the box to the
organization's owners and admins, on any workspace's People tab, whatever their role in that workspace. Item 17 writes
its change event in that workspace.
*Recommendation:* the box is not shown in an archived workspace, and the server refuses it there (no writes into an
archived workspace's log, AD-09). Showing it to organization owners and admins whatever their workspace role is fine.

**F18. The upgrade's change events (misses a choice).** Format 9's upgrade has no workspace for an organization's
event. Slice 7c's upgrade signed its events with the workspace's creator, an open point in known-limitations.
*Recommendation:* the upgrade writes no change events. The development password is a rehearsal artefact, and the data
model slice decides on a system author anyway.

**F19. Where the password port lives (layers, AD-19).** The PRD puts it "behind a port on the server, never in
`domain`" (item 14) and lists "the password port as an interface" under step 2's domain work.
*Recommendation:* the interface goes in `src/data/ports.ts` and the adapter in `src/data/password.ts`, written in step
3. Step 2's commands take an already computed hash as opaque input, and validate the plain password's rules in a pure
function.

**F20. Sign-in with the development list beside passwords (a known limitation to name).** P2 keeps the list, and
everything in slice 8 runs only in development, so anyone can sign in as anyone anyway. P4's protection and S8-06 are a
rehearsal of what the database slice makes real.
*Recommendation:* say so in the known limitations and in D-58.

**F21. Two small text points.**
- Item 2's sign-in list shows "the number of their workspaces there". For a guest organization this is their guest
  workspaces; I would show "guest" instead, as the switcher does.
- Item 6's e-mail refusal tells an unauthenticated visitor that an e-mail has an account. It belongs to the same known
  limitation as F11 and P3.

## Differences between the reference prototype and the app that the slice touches

Besides PRD section 8's deliberate list:

| Place | Prototype | App now | Slice 8 as proposed |
| --- | --- | --- | --- |
| Signing in | none ("Signing out is not part of the prototype.") | the development list | two paths above the list (D-58) |
| New organization | org menu: name, Enter; "First workspace" with "First project", "First canvas" and a concept "General" | not offered | a dialog with name, password ×2 and workspace name, then a summary; "First project" and "First canvas" kept (F6), no concept "General" (the app's new workspaces never had one) |
| People: role select | every admin, Owner among the options, own row as text | read-only role | owners and admins; Owner only for owners; owners' rows text for admins (F12) |
| People: Remove | immediate, any admin, not on own row | none | after a confirmation; not for owners by admins; never the last owner |
| People: invite box | "Invite someone": e-mail and role; "Invitation sent to {e-mail}."; a pending row | none | "Add a person": name, e-mail, role; a summary; an account at once |
| Guests | derived from the e-mail's domain | derived from a missing organization membership (seed) | unchanged for the seed's guests; no new guests (F8) |
| Role table | Admin: "invite, roles, settings" | the same text | wording for "add" (step 2's text list) |
| Organization switcher | name and "{n} workspaces" or "guest" | the same | plus a lock on locked organizations (F15) |
| Organization access | none | none | new box (P8) |
| Baselines tab | present | absent (AD-03, later) | unchanged |

## Plan for section 6's figures

| What | How | Bar (proposal) |
| --- | --- | --- |
| Verifying a password | `scripts/bench-password.ts`: the scrypt adapter's `verify`, 20 runs after 2 warm-ups, median and max, with the parameters printed | median under 200 ms; reported with the parameters |
| Creating an organization | `scripts/bench-create-organization.ts`: the command plus hashing through the local adapter on a copy of the demo data (as `bench-import-write.ts` copies), 5 runs, median; once more on a copy with `seed:large`'s workspace | under 1 s on the demo data; the large file reported |
| Reseeding for e2e (F7) | time `resetDevData()` 20 times on this branch and on `slice-07c` (a worktree), median | no more than +10 ms |
| Viewport elements on a canvas page | `S3B-15-elements.spec.ts` with `ELEMENTS_BASELINE=.data/measure/s7c14-baseline/slice-07b.json` (slice 7c's counts equalled 7b's, S7C-14), so no build of the tag is needed | equal |
| Nothing above the canvas reads layout | the lock icon sits in the closed menu; review in step 4 | no new read (CLAUDE.md) |

The benches go into README's command table and CLAUDE.md's command list in step 6.

## Questions for Łukasz

1. **F1:** a signed session cookie, secret from `INFOMAPPER_SESSION_SECRET`, else `.data/session-secret` made once?
2. **F5:** a separate table `organization_access` instead of two columns on `organization`?
3. **F6:** keep "First project" and "First canvas" in a new organization's workspace?
4. **F8:** "belongs" = has a workspace there; the seed's guests stay guests; added people become members?
5. **F9:** organization owners and admins keep their membership when they leave their last workspace (or: refuse that
   removal)?
6. **F10:** fix the canvas page's list of names in this slice?
7. **F11:** hide an existing account's name unless that person is already in this organization?
8. **F12:** admins cannot change or remove owners, and nobody changes or removes their own row?
9. **F17:** no password change from an archived workspace?
10. **F18:** the format 9 upgrade writes no change events?
11. **F15:** unlocking from the switcher through the page's redirect, with no dialog in the top bar?
12. **Section 6:** the bars above, including the reseed bar (+10 ms)?

## Step 2: the domain (27 October 2026)

Lint (36 s), typecheck (8 s) and unit tests pass: 103 files, 1,353 tests in 17 s (4 new files, 49 new tests; 99 files
and 1,304 tests before). No e2e run in this step (PRD: step 4 has the full run).

### What changed

- **Types** (`src/domain/types.ts`): `OrganizationAccess` (F5). `WritableRows` gains `app_user`, `organization`,
  `organization_member` and `organization_access`; `LINK_TABLES` gains `workspace_member` and `organization_member`, so a
  removal is a `remove` write with a null after image (F4).
- **Change sets** (`src/domain/changes.ts`): `objectId` names the person for both membership tables and the
  organization for `organization_access`. `SECRET_COLUMNS` (`organization_access.access_hash`): both images carry
  `"(changed)"` or `"(unchanged)"`, never the hash (Q4, item 15).
- **Permissions** (`src/domain/permissions.ts`): `people.edit` for owners and admins (refusal "As a {role} you cannot
  change who has access."; the archive refuses it as every change). `checkOrganizationAccess`: the organization's owners
  and admins, by their organization role, as members of the workspace whose People tab is used, never from an archived
  workspace (F17).
- **Workspaces** (`commands/workspace.ts`): `newWorkspaceRows` extracted from `createWorkspace` (Q3, F6); the command
  writes the same rows as before.
- **Organizations** (`commands/organization.ts`):
  - `checkCreateOrganizationForm` and `checkNewOrganizationForm`: the form's checks and the summary (items 6, 7, 9),
    writing nothing; `checkNewPassword` (at least 8 characters, both equal); `normalizeEmail` and `emailSchema`.
  - `createOrganization` (the start page, item 8): the person, the organization, its access, the owner's organization
    membership and the first workspace's rows, in one change group in that workspace. `ctx.actorId` is the new person's
    id (F2). An e-mail with an account is refused with the hint.
  - `createOrganizationForUser` ("New organization…", item 9): the same without the person.
  - `changeOrganizationPassword` (item 13): updates, or for an organization without one inserts, the access row;
    `expectedVersion` is the access row's version, or null.
  - The commands take the hash as opaque input; the password never enters them (F19).
- **People** (`commands/people.ts`):
  - `checkAddPerson` and `addPerson` (item 10, F8, F11): Admin to Reader (default Modeler); the account if new, a
    `member` row in the organization if the person has none there, and the workspace membership. The summary and the
    toast name the account's name only when the person already has a workspace in this organization.
  - `changeRole` (item 11, F12).
  - `checkRemovePerson` and `removePerson` (item 12, P7, F9, F12): the confirmation's lines; from their last workspace in
    the organization, an admin's or member's organization row goes too; the organization's owner is refused.
  - `ROLE_LABEL` moved here; `src/app/_lib/roles.ts` re-exports it, so the app's labels and the domain's texts are one
    list.
- **The return path** (`src/domain/return-path.ts`, F14): `safeReturnPath(next, organizationWorkspaceIds)` accepts only
  `/w/{id}`, `/w/{id}/p/{id}` and `/w/{id}/p/{id}/c/{id}` with an optional query of plain characters, for a workspace of
  that organization.
- **The password port** (`src/data/ports.ts`, F19): `PasswordHasher { hash, verify }`, an interface only; the scrypt
  adapter comes in step 3.

**Outside the domain, only what the types needed:** the local adapter knows `organization_access` (`DevDb`,
`emptyDb`, `RULES`: key `organization_id`, foreign keys to `organization` and `app_user`); `upgradeDb` adds the table
empty to a file that lacks it, with no format change (format 9 and `demo-pass` are step 3's); `compare-schema.test.ts`
lists the new table.

### Decisions I took (please check)

1. **The table exists before its format.** Until step 3 no organization has a password and nothing reads one; the app
   behaves as on `slice-07c`. Nothing is pushed, so `schema:check` (no migration yet) does not run.
2. **The start page's actor** is the person being created: the caller makes the id and passes it as `ctx.actorId`, so
   every change event of the creation is signed by them (F2).
3. **Lengths:** a password up to 200 characters (it bounds the hashing work a typed password can ask for), names up to
   200, an e-mail address up to 254. Each has a text below.
4. **The marker on a new row:** a created access row's after image says `"(changed)"`.
5. **"Already in this organization" for F11** follows answer 4: the person has a live workspace there. A person with an
   organization row but no workspace there (the seed's Kasia in Retail Co) is shown by e-mail only.
6. **Adding a guest of this organization** (the seed's Łukasz to another Retail Co workspace) writes a `member` row for
   them, as answer 4 says for everyone added in slice 8. From then on Łukasz is a Retail Co member, also in Sales
   analytics, where S0-03 shows him as a guest today. No spec does this; see question 2.
7. **Removing a guest from their last workspace** shows the "they leave {organization} too" line (they no longer
   belong, answer 4) and deletes no organization row (they have none).
8. **Choosing the same role** is refused: "{name} is {role} already." The select will not send it; the server text is a
   defence.
9. **The last-owner check** stays in both commands although "nobody changes their own row" makes it unreachable through
   the page (an owner can only demote another owner, so at least two exist). It guards the server.
10. **The password box** needs a membership of the workspace (it sits on that workspace's page) besides the organization
    role.
11. **Field messages:** the password rule goes on the field `password`, "The passwords differ." on `passwordAgain`, the
    account refusal on `email`, so the forms can show each next to its field.

### Every new or changed user-facing text

Texts used in later steps are listed too, so the whole slice's wording is approved once. "Step" says where it appears.

| Where | Text | Step |
| --- | --- | --- |
| Form checks | Enter the organization's name. · Enter your name. · Enter the first workspace's name. · Enter a name. (adding a person) · This name is too long. | 2, 4, 5 |
| Form checks | Enter an e-mail address. (the prototype's) · Enter a valid e-mail address. · This e-mail address is too long. | 2, 4, 5 |
| Form checks | The password needs at least 8 characters. · The passwords differ. · This password is too long. | 2, 4, 5 |
| Account refusal | This e-mail address already has an account. Sign in and create the organization from the organization menu. | 2, 4 |
| Create summary (start page) | You are creating the organization {organization} with you ({name}, {e-mail}) as its owner, and the empty workspace {workspace} with a first project and canvas and the 19 built-in classifications. People sign in to {organization} with its link and this password. | 2, 4 |
| Create summary (menu) | You are creating the organization {organization} with you as its owner, and the empty workspace {workspace} with a first project and canvas and the 19 built-in classifications. People sign in to {organization} with its link and this password. | 2, 4 |
| Create toast | Created {organization} with an empty first workspace. (the prototype's) | 2, 4 |
| Add summary, new account | {name} ({e-mail}) gets the role {role} in {workspace}. They sign in with the link of {organization} and its password. | 2, 5 |
| Add summary, account in this organization | {account name} ({e-mail}) gets the role {role} in {workspace}. They sign in with the link of {organization} and its password. / {e-mail} already has an account as {account name}; that name stays. | 2, 5 |
| Add summary, account from elsewhere (F11) | {e-mail} gets the role {role} in {workspace}. They sign in with the link of {organization} and its password. / {e-mail} already has an account; they keep their own name. | 2, 5 |
| Add refusal | {name} is already in {workspace}. | 2, 5 |
| Add toast | Added {name} to {workspace} as {role}. (F11: Added {e-mail} to {workspace} as {role}.) | 2, 5 |
| Role change | {name} is now {role}. (the prototype's) · {name} is {role} already. | 2, 5 |
| Removal confirmation | {name} loses access to {workspace}. / They are in no other workspace of {organization}, so they leave {organization} too. | 2, 5 |
| Removal toast | {name} no longer has access. (the prototype's) | 2, 5 |
| People refusals | {workspace} needs at least one owner. · You cannot change your own role. · You cannot remove yourself. · Only an owner can make someone an owner. · Only an owner can change an owner's role. · Only an owner can remove an owner. · {name} owns {organization}, so they keep at least one workspace there. (yours, F9) | 2, 5 |
| Role refusal | As a modeler / a reviewer / a reader you cannot change who has access. | 2 |
| Password change | Only the owners and admins of {organization} can change its password. · People who are signed in stay signed in; the next sign-in needs the new password. · Changed the password of {organization}. · Link copied. | 2, 5 |
| Role texts (F12), changed | Admin, "You can …" (`ROLE_CAN.admin`): "You can edit the model, approve, add people, change their roles and change settings." (was "… approve, invite people and change settings.") | 5 |
| Role texts (F12), changed | The role table's Admin row, "People and settings": "add people, roles (not owners), settings" (was "invite, roles, settings") | 5 |
| Sign-in | Sign in · Create an organization · No organization uses this e-mail address. · That password does not open {organization}. · {n} workspaces / guest (the organization step's list, F21) | 4 |
| Lock | Asks for the password once (the switcher's tooltip) · Unlock {organization} first: open it and enter its password. (a write into a locked organization, F3) | 3, 4 |
| Upgrade log line | Slice 8 upgrade: {n} organizations got the development password (see README). | 3 |

### Tests

New files: `commands/organization.test.ts` (13: the form's checks and their fields, the account refusal, both
summaries, the creation's rows and change group with the marker, the menu's creation, the password change with its
marker, first password, stale form, roles, archive, another organization), `commands/people.test.ts` (18: adding a new
person, an account of this organization, an account from elsewhere with its name hidden, someone already in, the roles
offered, roles and archive, the form's checks; changing a role with F12's rules, own row, last owner; removing with the
last-workspace line for members and admins, a guest, F9, F12, own row, last owner, roles and archive),
`return-path.test.ts` (3: the workspace's pages, another organization, 16 unsafe paths), `changes.test.ts` (4: the
marker on update and insert, unchanged, the row untouched; membership removals).

Added to: `permissions.test.ts` (11: the matrix gains `people.edit` for each of the five roles, plus 6: the people
refusal, the archive, the password change's roles, membership, organization and archive).

Changed earlier tests, with the reason: `tests/schema/compare-schema.test.ts` (the stored tables include
`organization_access`). `workspace.test.ts` is unchanged and passes on the extracted rows.

### Section 6's figures (the final table, as approved)

| What | How | Bar |
| --- | --- | --- |
| Verifying a password | `scripts/bench-password.ts`: the scrypt adapter's `verify`, 20 runs after 2 warm-ups, median and max, with the parameters printed | median under 200 ms (the PRD's bar); reported with the parameters |
| Creating an organization | `scripts/bench-create-organization.ts`: the command plus hashing through the local adapter on a copy of the demo data, 5 runs, median; once more on a copy with `seed:large`'s workspace | under 1 s on the demo data (the PRD's bar); the large file reported |
| Reseeding for e2e (F7) | time `resetDevData()` 20 times on this branch and on `slice-07c` (a worktree), median | no more than +10 ms per reseed |
| Viewport elements on a canvas page | `S3B-15-elements.spec.ts` with `ELEMENTS_BASELINE=.data/measure/s7c14-baseline/slice-07b.json` | equal |
| Nothing above the canvas reads layout | the lock icon sits in the closed menu; review in step 4 | no new read (CLAUDE.md) |

Step 2 has nothing to measure: the commands are pure, and hashing and the reseed come with step 3.

### How to check

- `npm test`, or only this step's files: `npx vitest run src/domain/commands/organization.test.ts
  src/domain/commands/people.test.ts src/domain/return-path.test.ts src/domain/changes.test.ts
  src/domain/permissions.test.ts`.
- Nothing to see in the app yet (decision 1).

### Open for step 3

The migration, the data model, the format 9 upgrade with the precomputed `demo-pass` hash (F7, F18), the scrypt adapter
and its bench, the signed session (F1), `runCommandAs` (F2), the lock in `runCommand`, undo and the impact reads (F3),
the adapter's removal tests (F4), `getAccessHash` (F5), `workspacePeople` (F10), the server actions, the seeds and the
e2e helpers, and the decision texts for approval.

### Questions for Łukasz

1. The texts above: approve, or change any? In particular F12's two role texts.
2. Decision 6: adding a guest of this organization makes them a member (answer 4 read literally). Keep that, or keep
   guests as guests when they are added to another workspace of the same organization?
3. Decision 5: is "has a workspace here" the right test for showing an existing account's name (Kasia in Retail Co is
   shown by e-mail only)?
4. Decision 3: the 200-character password limit, with its text?

## Answers from Łukasz (step 2) (27 October 2026)

1. **Texts:** F12's two admin texts are approved ("You can edit the model, approve, add people, change their roles and
   change settings."; the role table's Admin row "add people, roles (not owners), settings"). The other texts wait for
   his answer after he has read the step 2 table.
2. **Guests stay guests.** Adding a guest of this organization (a workspace here, no `organization_member` row) to
   another of its workspaces adds only the workspace membership. A `member` row goes to new people and to accounts from
   other organizations added here for the first time. This replaces decision 6.
3. **An existing account's name is shown** when the person has any link to this organization: an `organization_member`
   row or a workspace in it. Kasia's name shows in Retail Co. This replaces decision 5; the summary row "account in this
   organization" in the text table means "linked to this organization".
4. **Passwords:** at least 8 and at most 200 characters, with the texts as listed.

**The name limit.** The 200-character limit ("This name is too long.") applies only to this slice's new forms: the
organization's name, the person's name and the first workspace's name when creating an organization
(`commands/organization.ts`, `named`), and the person's name in "Add a person" (`commands/people.ts`). `nameSchema`
(`src/domain/validation.ts`) is unchanged, so `createWorkspace` and every existing rename keep slice 0's "no maximum
length". (Requirement names keep slice 4a's 300.)

### The texts (27 October 2026)

All texts of step 2's table are approved, with five changes, made in the domain and its tests:

1. Both create summaries: "…and the workspace {workspace} with an empty first project and canvas, and the 19 built-in
   classifications."
2. Role change: "{name} is already {role}."
3. Length checks name the limit: "This name is too long; use at most 200 characters.", "This password is too long; use
   at most 200 characters.", "This e-mail address is too long; use at most 254 characters."
4. The organization step's list (step 4): "1 workspace" / "{n} workspaces".
5. People changes in an archived workspace use slice 0's archive text, not a new one: **"This workspace is archived, so
   it is read-only."** It is `ARCHIVED_MESSAGE` in `src/domain/errors.ts` (commit `9b3cab2`, "feat: domain foundation for
   slice 0"), returned by `checkPermission` for every action but viewing and unarchiving. `people.edit` goes through
   `checkPermission`, and `checkOrganizationAccess` returns the same constant, so adding, changing, removing and the
   password change all use it; step 2 added no archive text.

### Changes after these answers

- `addPerson` writes the `member` row only when the account has neither a row in this organization nor a workspace
  there; `addPersonPreview` shows the name when the account has either.
- `people.test.ts`: two new tests (a guest stays a guest and is named; a member row without a workspace is named), 20 in
  all. Lint, typecheck and unit tests pass: 103 files, 1,355 tests.

## Step 3: data, session and server (27 October 2026)

Lint (82 s), typecheck (17 s) and unit tests pass: 106 files, 1,371 tests in 28 s (3 new files, 16 new tests; 103 files
and 1,355 tests after step 2). Slice 0's e2e specs: 21 passed in 4.2 min (one new case in S0-01).

### What changed

- **Texts** (answers to step 2): the create summaries, "{name} is already {role}.", and the length checks with their
  limits, in the domain and its tests. People changes in an archived workspace already use slice 0's
  `ARCHIVED_MESSAGE` (see the answers above).
- **Migration** `supabase/migrations/20261027200000_organization_access.sql` (DDL only): the table
  `organization_access` (F5) with row level security on and no policies.
- **Local adapter, format 9** (`schema.ts`, `file.ts`): `organization_access` with its rules; a format-8 file gives
  every organization without a password the precomputed `demo-pass` hash, writes no change events (F18), is written back
  at once and logs one line, "Slice 8 upgrade: {n} organizations got the development password (see README)." (no
  password, no hash). Step 2's stopgap (the table filled on read without a format) is gone.
- **Write rules (F4):** removals of `workspace_member` and `organization_member` and the versioned update of
  `organization_access` go through the adapter's existing key and version checks (tested in
  `organization-store.test.ts`).
- **Reads:** `users.getByEmail`, `users.listForWorkspace` (members and authors, F10), `organizations.getAccess` (the
  only read that carries the hash, server only).
- **The scrypt adapter** (`src/data/password.ts`, F19): `scryptHasher` behind `PasswordHasher`, N = 2^15, r = 8, p = 1,
  16-byte salt, 32-byte key, `maxmem` 64 MiB; `scrypt$15$8$1$<salt>$<key>`; `timingSafeEqual`; it refuses malformed
  strings and parameters it would never write.
- **The demo password (F7):** `src/data/local/demo-password.ts` holds `demo-pass`'s hash with a fixed salt; the seed
  and the upgrade write it, and `password.test.ts` checks it against the password with the adapter.
- **The session (F1)** (`src/app/_lib/dev-session.ts`, `session.ts`, `src/data/local/session-secret.ts`): the cookie
  keeps its name and is `base64url(payload).base64url(HMAC-SHA256)`, payload `{ v, u, o, at }`, checked in constant
  time. The secret is `INFOMAPPER_SESSION_SECRET` (at least 32 characters, in `.env.example`) or `.data/session-secret`,
  made once (`.data/` is git-ignored). `getSession()` returns the person and the unlocked organizations;
  `getSessionUser()` stays for the pages; `writeSession()` signs a new cookie. Production still refuses the cookie and
  `/sign-in` (`isLocalModeAllowed`, unchanged; tested).
- **The development list** unlocks every organization the test user reaches (`signInAsDevUser`), so every existing spec
  signs in as before.
- **The lock (F3), step 3's places:** `runCommand` refuses a write into an organization the session has not unlocked
  ("Unlock {organization} first: open it and enter its password."; a write that creates an organization is allowed and
  unlocks it), and so do `undoRedoAction`, the three impact reads (`entityImpactAction`, `classificationImpactAction`,
  `sourceDeleteImpactAction`) and the people previews. `src/app/_lib/unlock.ts`, tested.
- **`runCommandAs` (F2)** in `run-command.ts`: the start page's write without a session; no live canvases, settling or
  undo history; an e-mail address taken meanwhile comes back as the domain's account refusal.
- **Server actions** (their callers come in steps 4 and 5):
  - `_actions/session.ts`: `organizationsForEmailAction` (the sign-in's organization step: the organizations the e-mail
    has a workspace in, with the count or "guest"), `signInWithPasswordAction` (signs in to, or unlocks, one
    organization; lands on `next` when `safeReturnPath` accepts it, else on the last workspace when it lies there, else
    the first: F13's rule, in the action).
  - `_actions/organization.ts`: the start page's preview and create (hash, `runCommandAs`, a session with the new
    organization unlocked), the menu's preview and create (unlocks the new organization), the password change.
  - `_actions/people.ts`: preview and add, change a role, preview and remove; all through `runCommand`.
- **F10:** `workspacePeople(store, workspaceId)` (`src/app/_lib/people.ts`) replaces `users.list()` on the canvas page
  and the workspace page. The note action's single author name and the development list (`/sign-in`, development only,
  F20) are the remaining `users.list()` readers.
- **e2e:** `e2e/slice-08/helpers.ts` with `createOrganization` and `addPerson` (test data through the domain and the
  adapter, as `asPerson` does); S0-01 gains "an unsigned cookie with a known user's id is not a session".
- **Benches:** `scripts/bench-password.ts`, `scripts/bench-reseed.ts`, `scripts/bench-create-organization.ts`.

### Where the step 3 findings are

| Finding | Done in step 3 | Left |
| --- | --- | --- |
| F1 | signed cookie, secret, `getSession`, S0-01's new case | – |
| F2 | `runCommandAs`, `createOrganizationAction` | the start page (4) |
| F3 | `runCommand`, undo, the three impact reads, the people previews | `loadShellFor`'s redirect and `Landing` (4) |
| F4 | adapter removals and the versioned access update, tested | – |
| F5 | migration, adapter table, `getAccess` | `docs/data-model-v2.md` (6, with Łukasz) |
| F7 | precomputed hash in the seed and the upgrade, its test, the reseed bench | – |
| F10 | `workspacePeople` on the canvas and workspace pages, tested in the adapter | – |
| F13 | the rule inside `signInWithPasswordAction` | `Landing` for a session with locked organizations (4) |
| F18 | no change events, one log line | – |
| F19 | `scryptHasher` | – |
| F20 | the decision text below | the known limitation (6) |

### Decisions I took (please check)

1. **`signInWithPassword` (the e2e helper) comes with step 4.** It must drive the start page (a server action's id is
   only known from a click, `captureActionId`), and the page is step 4's. `createOrganization` and `addPerson` are test
   data through the domain, as slice 4a's `asPerson`.
2. **A password sign-in as another person** replaces the session (only that organization unlocked); as the same person
   it adds the organization.
3. **A write that creates an organization** passes the lock (it is new, and creating it unlocks it).
4. **The upgrade's access rows** are signed (`changed_by`) by each organization's creator, as slice 7c's upgrade signed
   its rows; `changed_at` is the upgrade's time.
5. **`docs/data-model-v2.md` and the README's `demo-pass` line** wait for step 6 with the other docs: the data model
   changes only with Łukasz, and both read better once the decision texts are approved.
6. **The secret file** is written with `wx` (exclusive create), so the e2e server and a test process starting together
   end up with the same secret.
7. **`src/app/_lib/unlock.ts`** has no `server-only` import, so its unit test can import it; it touches only the
   repository interface.

### Section 6's figures

| What | Result | Bar |
| --- | --- | --- |
| Verifying a password (`bench-password.ts`, N = 2^15, r = 8, p = 1) | median 123.5 ms, max 126.1 ms (20 runs); again 123.6 / 129.9 ms | median under 200 ms: passes |
| Creating an organization (`bench-create-organization.ts`, demo data) | median 135.5 ms, max 143.9 ms (5 runs) | under 1 s: passes |
| Reseeding for e2e (`bench-reseed.ts`, three turns against `slice-07c` in a temporary worktree, removed afterwards) | slice-07c 11.9 / 11.7 / 11.6 ms; slice 8 10.7 / 11.9 / 11.4 ms (medians of 20) | at most +10 ms: level (−0.2 ms, median of medians) |
| Viewport elements on a canvas page | not run: step 3 adds no canvas element (the people list is data) | equal (step 4 or 6) |

### Proposed decision texts (for `docs/decisions.md`, after your approval)

**D-58 Organizations and sign-in (slice 8).** InfoMapper starts from nothing: on the start page a person creates an
organization, with themselves as its owner and a workspace with an empty first project and canvas and the 19 built-in
classifications, or signs in. Signing in asks for the e-mail address, then the organizations it has a workspace in (a
list of all organizations is never shown), then the chosen organization's password; an organization's link opens its
sign-in directly. A session unlocks each organization with its password once; until then its pages ask for the
password and the server refuses writes into it, so adding someone to a second organization never opens the first. A
signed-in person creates further organizations from the organization menu. Workspace owners and admins add people
(name, e-mail, role Admin to Reader), change roles and remove people, each after a summary; only an owner gives, takes
or changes the Owner role, nobody changes or removes their own row, a workspace keeps at least one owner, and an
organization's owner keeps at least one workspace there. A person belongs to an organization while they have a
workspace in it; removing a member or an admin from their last one ends their membership, and guests stay guests. An
existing account keeps its name, shown only to an organization it is already linked to. The organization's owners and
admins see its link and change its password from a People tab; people who are signed in stay signed in. People changes
and password changes are change events in the workspace's log, never with the hash; like a pin (D-29) they are not undo
steps. An archived workspace refuses people and password changes. Everything here runs on the local adapter in
development only (AD-29, AD-31): one shared password per organization, an e-mail address reveals its organizations, a
password change keeps sessions, no limit on failed sign-ins, and the development list of test users still signs in as
anyone, so the silo is a rehearsal of what the database slice makes real.

**Note to AD-01:** Until guests from other organizations are built (later, `docs/ideas.md`), a guest is a workspace
member without a row in the workspace's organization; slice 8 adds no new guests, and adding a guest to another
workspace of the same organization keeps them a guest (D-58).

**Note to AD-04:** Until the database slice, sign-in in development is an organization's shared password, scrypt on the
server, with a signed session cookie that carries the organizations unlocked in it (D-58); Supabase Auth with a password
per person replaces it.

**Note to AD-05:** Owners and admins add people, change roles and remove people; only an owner gives, takes or changes
the Owner role, and nobody changes or removes their own row (slice 8, D-58).

### How to check

- `npm test`; the step's own files: `npx vitest run src/data/password.test.ts src/data/local/organization-store.test.ts
  src/app/_lib/dev-session.test.ts src/app/_lib/unlock.test.ts`.
- `npx playwright test e2e/slice-00` (no dev server of your own running).
- The benches: `npx tsx scripts/bench-password.ts`, `npx tsx scripts/bench-create-organization.ts`,
  `npx tsx scripts/bench-reseed.ts`.
- In the app (`npm run dev`): an existing `.data/dev-db.json` is upgraded on first read, with the log line; signing in
  through the development list works as before; in the browser's devtools, replacing the cookie's value with a user id
  signs you out.

### Open for step 4

The start page (two paths, the organization step, the link's form), `loadShellFor`'s redirect to the link's form with
`next`, `Landing` among unlocked organizations, the switcher's lock, "New organization…", `signInWithPassword`, the
slice's specs for items 1–9 and the full e2e run (P1).

### Questions for Łukasz

1. The decision texts above: approve, or change any?
2. Decision 1: `signInWithPassword` in step 4, with the page?
3. Decision 5: `docs/data-model-v2.md` and the README line in step 6?
