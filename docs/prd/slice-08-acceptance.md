# Slice 8 – Acceptance

Status: **step 1 (critical review), waiting for Łukasz's answers.** Branch `slice/08-organizations`, from `main` at
`bbc16c5` (tag `slice-07c`). PRD: `docs/prd/slice-08-organizations.md`. The PRD stays as written; this file is its
amendment.

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
