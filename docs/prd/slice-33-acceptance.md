# Slice 33 – acceptance: step 1 (the PRD checked against the code)

Step 1 of `docs/prd/slice-33-people.md`, 20 November 2026, on `slice/33-people` from `dev` at `b4c7a96`. No application
code; no `pg:` script, no connection to `infomapper-dev`; neither `.data/dev-db.json` nor a backup was read.

## 0. The files and the number

| File | `cmp` with Downloads | SHA-256 | Expected |
| --- | --- | --- | --- |
| `docs/prd/slice-33-people.md` | equal | `7ea5ced4da3ac0a160443849874744185494f3ab0e1bf4f5fd009afd8a2dd358` | the prompt's: equal |
| `docs/prototype/infomapper-prototype-with-sources.html` | equal | `c282cb41136473dc30bfb7ad49cfd19f96c63b62252e2e6ba704ad32625d1ab3` | the PRD's and the prompt's: equal |

**33 is the next free number:** the newest tag is `slice-32`; `docs/prd/` ends at slice 32; no branch `slice/33*` exists
locally or on `origin`. The prototype's diff against slice 32's is 83 lines in, 8 out, all in "People", the person's menu
and the new `PPL` dialogs (section 4).

## 1. Q3 and Q9 first: what Łukasz clicks

### Q3. The secret key

**What exists (fact).** The project uses Supabase's new keys: `SUPABASE_PUBLISHABLE_KEY` for sign-in and
`SUPABASE_SECRET_KEY` for the admin API. The secret key is **already in `.env.postgres.local`**: `pg:accounts` and
`scripts/pg-auth-check.ts` read it, and `npm run dev:pg` passes the whole file to the dev server
(`scripts/dev-pg.ts`: `env: { ...process.env, … }`). So **on the laptop nothing is needed**; the PRD's step 4 item "the
secret key in `.env.postgres.local`" is already done.

**What this slice reverses (F1).** Today the key is "used by the accounts script only, never by the app and never in
Vercel" (CLAUDE.md "Security" and "Hosting rules", `.env.example`'s comment, AD-04's note "accounts are made with the
secret key by script"). The PRD needs it in the app and in Vercel without saying it changes those rules. **Proposal:** AD-04
gets a note and CLAUDE.md's two places change (the app's server module may read it; Vercel's Preview, scoped to `dev`,
Sensitive). The other "never in Vercel" variables stay.

**The admin calls** (`@supabase/supabase-js` 2.118.0, already a dependency): `auth.admin.createUser({ email, password,
email_confirm: true, app_metadata })`, `auth.admin.updateUserById(id, { password })`, `auth.admin.deleteUser(id)` (an
account made by a Join whose rows then fail), `auth.admin.listUsers` (paged, only to find an unlinked account an earlier
failed Join left, F10). Checking a current password: `signInWithPassword` on a client without cookies (publishable key,
`persistSession: false`), whose session is ended at once, so the person's own cookies are never touched.

**The module:** `src/app/_lib/supabase-admin.ts` with `import "server-only"`, the only reader of `SUPABASE_SECRET_KEY` in
`src/`. It exports `invitationsReady()` (local adapter: always; Postgres: the variable is set) and the four calls; it
never logs the key, an e-mail or a password (an error is logged by its `code` only, as `pg-accounts.ts` does).

**Proof that it is not in the browser:** `server-only` fails the build if a client component imports it; and a check
after `npm run build` in CI's smoke job (where the value is the local stack's key) scans `.next/static/**` for the
variable's name and value and fails on either (`scripts/check-client-bundle.ts`). The full run's `server.log` and the
smoke report are scanned the same way.

**Not set up yet (PT1):** on Postgres without the variable the box "Invite person" shows with its fields and button
disabled and the line **"This server is not set up for invitations yet."**; the actions refuse with "This server is not
set up for invitations yet, so nothing was created." The same line replaces "Password reset link"'s dialog. "Change
password…" needs the key too (F16): its dialog says the same. Everything else works as today.

**What Łukasz clicks (step 4), one at a time:**

1. *(Recommended, D2)* A key of its own for Vercel, so either can be revoked without the other: Supabase dashboard →
   project `infomapper-dev` → **Project Settings** → **API Keys** → under **Secret keys**, **New secret key** (the
   label may read "Add new secret key"), name `vercel-dev-preview` → **Create**, then reveal and copy it. *(Without D2:
   copy the existing secret key from the same page.)*
2. Vercel → project `infomapper-app-dev` → **Settings** → **Environment Variables** → **Add New**: Key
   `SUPABASE_SECRET_KEY`, Value: paste; **Environments: Preview only** (untick Production and Development);
   **Branch: `dev`**; **Sensitive: on** → **Save**.
3. **No Redeploy** (F3): the variable waits; the merge into `dev` (step 6) starts a new deployment that has it. A
   Redeploy is needed only if the variable is added after the merge.

Nothing else: no GitHub secret, no Supabase setting (sign-ups stay off; `createUser` with the secret key works with them
off, as `pg:accounts` shows), no redirect URLs (our own tokens, PT2).

### Q9. How CI runs Supabase Auth

**Today (fact, `.github/workflows/schema.yml`, job `smoke`):** Supabase's CLI 2.122.0 starts the local stack on the
runner with Postgres and Auth only (`start -x …`, mailpit excluded); `supabase status -o env` gives `API_URL`,
`PUBLISHABLE_KEY`, `SECRET_KEY` and `DB_URL`, which the job writes into `GITHUB_ENV` as `SUPABASE_URL`,
`SUPABASE_PUBLISHABLE_KEY`, **`SUPABASE_SECRET_KEY`** and the two database URLs; then `pg:migrate`, `schema:check --
--existing`, `pg:seed`, `pg:accounts`, `npm run build`, and Playwright with `playwright.pg.config.ts` (`PG_SERVE=1`:
`next start` on 127.0.0.1:3400, whose environment inherits the job's). **So the app in the smoke job already has a
secret key: the local stack's throwaway one, never `infomapper-dev`'s.** Nothing to click; no change to the workflow
except the bundle check after the build (Q3).

- The new Postgres specs go into `e2e/slice-29/` (the Postgres folder, `POSTGRES_ONLY_FOLDERS`), named
  `S33-smoke-*.spec.ts`. They write, so they run only against a database on this machine (F13 of slice 30, the guard in
  `S30-smoke-writes.spec.ts`): skipped against `dev:pg` and the preview, so they never make an account in
  `infomapper-dev`. They change only the passwords of the people they invite, never a demo account's (the other specs sign
  in with the demo password). Never KB, never `INFOMAPPER_KB_EMAIL` (`tests/own-model-guard.test.ts` stays as it is).
- The contract suite (`tests/contract`, CI's Postgres container) has no Auth: it runs the new commands' write sets on
  both adapters, which is where they live (the domain gets hashes, never tokens or passwords).
- The local e2e specs go into `e2e/slice-33/` (part 9, from `slice-22`). **Part 9 peaked at 1,854 MB in slice 32**; about
  ten specs at ~6 MB a test bring it near the 2 GB mark (CLAUDE.md, "Heap peaks"). Proposal: read part 9's peak in step 2's
  full run; at about 1.95 GB or more a `chore/` branch from `dev` adds a tenth part before step 3 (The slice cycle, 4).

## 2. The answers (Q1–Q10)

**Q1. Today's people commands and screens.** `src/domain/commands/people.ts`: `addPerson` (an `app_user` if the e-mail
has none, an `organization_member` "member" row for an account with no link to the organization yet, a guest stays a
guest, the `workspace_member` row), `changeRole` (one `workspace_member` update), `removePerson` (the `workspace_member`
row and, from the last workspace there, the `organization_member` row; the organization's owner keeps one). Rights:
`people.edit` (owner, admin; never in an archived workspace); only an owner gives, takes or touches Owner; nobody changes
or removes their own row; the last owner stays. Each writes one change group with change events in the workspace's log
and is no undo step (all those tables are `OUTSIDE_UNDO`, `src/domain/commands/undo.ts`). The actions are
`src/app/_actions/people.ts` (`previewAddPersonAction`, `addPersonAction`, `changeRoleAction`, the remove pair); online
the two add actions return `ONLINE_REFUSAL` with `ADD_PERSON_ONLINE_TEXT` (`src/app/_lib/roles.ts`), and `AddPersonBox`
(`src/app/w/[workspaceId]/_components/people.tsx`) is drawn disabled with that line (slice 30, B5, L6). **This slice
replaces** `AddPersonBox`, the two add actions, `checkAddPerson`/`addPersonPreview` (its summary "They sign in with the
link of {org} and its password" has no place in an invitation), `ADD_PERSON_ONLINE_TEXT` and its known limitation; it
keeps `changeRole`, `removePerson`, their UI and the "Organization access" box (local only, as today).

**Q2. Sign-in today.** *Local:* a signed cookie (`dev-session.ts`) with the person and the organizations unlocked;
`signInWithPasswordAction` (the organization's shared password, scrypt) or the test users' list (`signInAsDevUser`,
unlocks every organization); `getSession` reads the cookie. *Postgres:* `signInWithAccountAction` →
`supabaseServer({ write: true }).auth.signInWithPassword`, then `users.getByAuthUserId(data.user.id)` (an account linked
to nobody is signed out with `ACCOUNT_WITHOUT_PERSON`); `getSession` → `getClaims()` → `sub` → `app_user.auth_user_id`;
every organization of the person is unlocked. A person is matched by `auth_user_id` only, never by e-mail. Landing:
`safeReturnPath(next, workspaces)` or `/`, which picks the last or first workspace. **Accepting and a reset call the same
path:** `signInWithPassword` with the password just set, through `supabaseServer({ write: true })`, then a redirect to
`/w/{invitation's workspace}`; AD-04's note "only the sign-in and sign-out actions write the session's cookies" gets the
two new actions added (F13). **PT6 corrected (F18):** locally the "same as today" sign-in would send a new person to the
organization's shared password they were never given; proposal: Join writes the development session for that person
with only the invitation's organization unlocked (D3).

**Q3.** Section 1.

**Q4. `invitation` and `password_reset`.** `invitation` exists in SQL only: it is on `NOT_IN_DOMAIN_YET`
(`tests/schema/compare-schema.ts`) and has no domain type, no store rules, no local file array, no port and no Postgres
read (F4). Its columns suffice; missing: **one pending invitation per workspace and e-mail** (a partial unique index,
F5). `token_hash` has its unique index (`invitation_token_uq`), which is also the lookup. **`password_reset` as its own
table** (reusing `invitation` would need a nullable role, a person instead of an e-mail and a kind column, and its role
CHECK would have to go): `id`, **`workspace_id`** (F7), `app_user_id`, `token_hash` (unique), `created_by`,
`created_at`, `expires_at`, `used_at`, `revoked_at`; RLS on, no policy. One migration
`supabase/migrations/2026112…_people.sql`: the table, its RLS, the pending index on `invitation`, an index on
`password_reset (app_user_id)`. Both tables `OUTSIDE_UNDO`; `token_hash` in `SECRET_COLUMNS` (F6). The local file:
**format 18** adds `invitation: []` and `password_reset: []` (no change events, no log line) (F29).

**Q5. Tokens.** The server makes 32 random bytes (`crypto.randomBytes`), base64url (43 characters) in the link, and
hands the domain only `sha256(token)` as hex; the token is in the action's answer once and never stored, logged or in a
change event. A link's token is looked up by its hash through the unique index; nothing compares a secret byte by byte,
so a constant-time comparison has nothing to do (F14). The link's address: `x-forwarded-proto` and `x-forwarded-host`
(Vercel sets both), else `host`, from the action's request (`headers()`), plus `/invite/{token}` or `/reset/{token}`; no
variable. Expiry: on the application's clock (`ctx.now`), like every timestamp the commands write; the database's clock
is not used anywhere (F15). **New link** updates the same row: a new `token_hash` and `expires_at` (now + 7 days); the
old token no longer finds a row. A new reset link for the same person sets `revoked_at` on the earlier live one in the
same write.

**Q6. Accepting.** Order (F10): (1) read the invitation by hash and check it (pending, not expired, workspace live and not
archived); (2) *new person:* `createUser` (confirmed, `app_metadata: { invitation: id }`); (3) one write set through
`runCommandAs` (the actor is the new person): `app_user` with `auth_user_id`, `organization_member` "member" unless
already linked (PT8; today's `addPerson` rule), `workspace_member` with the role and `added_by` = the inviter,
`invitation.accepted_at`; the invitation's update is compared as a whole row inside the transaction (it has no version),
so a second Join of the same link is refused there as stale; (4) on any refusal: `deleteUser` of the account step 2
made; if that fails too, the account stays marked by `app_metadata.invitation` and a later Join of a pending invitation
for that e-mail reuses it (the only case `listUsers` is called); (5) `signInWithPassword` and the redirect. *Existing
account:* `signInWithPassword` first (a wrong password changes nothing), check that its `sub` is the `app_user` of the
invitation's e-mail, then the write set without `app_user`. *A person without an Auth account* (`auth_user_id` null:
copied, or before `pg:accounts`) is F9. **The refused states:** unknown, altered, expired, used or revoked token: the
one message of the PRD, the page's title "Invitation", no button (P-l). Landing: the invitation's workspace with the
role given (the home's Overview).

**Q7. Passwords.** *Change:* the current password checked by `signInWithPassword` on a client without cookies, then
`updateUserById` with the secret key (so Supabase's optional "secure password change" setting never matters). *Reset
page:* the hash looked up, the row live and within 24 hours, the person's account → `updateUserById` → the write
(`used_at`) → sign-in. **Our rules:** at least 10 and **at most 72 characters** (F11: Supabase hashes with bcrypt and
refuses longer passwords; ours today allow 200 for the organization's password); the two equal. Supabase's own minimum
(6 by default) is lower; a stricter project setting would come back as `weak_password` and be shown as the field's
message. **Other sessions** (F16): Supabase can end them (`signOut({ scope: "others" })` from the new session), but our
proxy checks access tokens locally (`getClaims`, ES256), so an ended session still works until its access token expires
(at most an hour, Supabase's default). Proposal D4.

**Q8. Rights.** Invitations: `people.edit` (Owner, Admin of that workspace; not archived), roles Admin to Reader
(`invitation_role_ck`). Reset links: hidden and refused for oneself, a guest, an Owner when the actor is an Admin, a
person with no Auth account unless D5 — **and the PRD's rule is not enough (F8, the most important finding):** whoever
makes a reset link can open it themselves and sign in as that person. Proposal D1. Existing guest rows: no
"Password reset link" (the prototype; a guest's organization manages them).

**Q9.** Section 1.

**Q10. Risks and shared infrastructure.**
- *The proxy* (`src/proxy.ts`) passes only `/sign-in` without a session; `/invite/…` and `/reset/…` must pass in both
  modes, on Postgres without `getClaims` and without the preference cookies (F12). Shared infrastructure: its step has a
  full run.
- *The session* (`session.ts`) is unchanged; locally Join calls `writeSession` (D3).
- *The table registry and the local adapter* change in step 2 (new tables, format 18): the exception's full run in step 2
  too (CLAUDE.md, "Test runs").
- *`pg:accounts`* unchanged: an invited person of a seed organization is in its default set, so a later run gives them
  the demo password (development only; acceptable). `pg:seed -- --reset` leaves their Auth accounts behind, unlinked;
  inviting the same e-mail again reuses one only if `app_metadata.invitation` marks it (F10), otherwise "This e-mail
  already has an account on this server that no person uses. Ask the administrator." (D5).
- *KB:* `scripts/lib/organization-rows.ts` copies every row with a `workspace_id` of KB's workspaces, so `pg:backup` and
  `pg:restore` carry KB's invitations and reset links (hashes only) with no code change; `tests/kb-copy.test.ts` and
  `tests/contract/copy.test.ts` get a row of each. A backup made before slice 33 reads as format 17 and is upgraded in
  memory.
- *The shared `infomapper-dev`:* step 5's made-up person keeps an `app_user` and an Auth account after "Remove" (accounts
  are never deleted, D-58); deleting the Auth account in Supabase's dashboard is optional (F23).
- *The local file of Łukasz's* (KB's backup since the switch): format 18 upgrades it when a dev server of his serves this
  checkout (CLAUDE.md, "changed only on his explicit command"): before step 2's commit, check that none does (F29).
- *Nothing in the code changes the plan's order*; the costs the PRD misses are F4 to F7 and F17.

## 3. Where the PRD is wrong or costs more (with proposals)

**F1. The secret key reverses a standing rule** (CLAUDE.md "Security", "Hosting rules": "never by the app and never in
Vercel"; `.env.example`; AD-04's note). *Proposal:* AD-04's note and CLAUDE.md say: read only by
`src/app/_lib/supabase-admin.ts` (server-only) and the scripts; in Vercel as `SUPABASE_SECRET_KEY`, Preview, branch `dev`,
Sensitive; preferably a key of its own (D2).

**F2. Nothing to do on the laptop** (section 1). The PRD's step 4 item goes.

**F3. No Redeploy.** The variable added before the merge is in the deployment the merge starts; the PRD's step 6
"then the Redeploy" goes. Step 6 checks the deployment's "Invite person" (enabled) after the merge.

**F4. `invitation` is not in the domain** (PRD §3: "exists … enough as it is"). Building it costs: the domain type,
`WritableRows`, `OUTSIDE_UNDO`, the local rules (`src/data/local/schema.ts`: key, foreign keys to `workspace` and
`app_user`, the two checks, the unique indexes), the file's arrays and format 18, the Postgres reads (`store.ts`, one
statement per table as the rule says), ports `invitations` (`pending(workspaceId)`, `byTokenHash(hash)`) and
`passwordResets` (`byTokenHash`, `liveFor(userId)`), their cases in `tests/contract/reads.test.ts`, `NOT_IN_DOMAIN_YET`
down to `baseline`, the registry guard, `data-model-v2.md` (§3; `invitation`'s "the token itself is only in the e-mail"
becomes "only in the link shown once"). About as much as slice 31's tables; the PRD assumes none of it.

**F5. One pending invitation per e-mail and workspace** needs a partial unique index (`invitation (workspace_id, email)
where accepted_at is null and revoked_at is null`); the local rule takes the same `where`. The command refuses first with
the prototype's message "{e-mail} is already in this workspace or invited."; the index catches a race.

**F6. Token hashes would land in change events.** `SECRET_COLUMNS` (`src/domain/changes.ts`) gets `invitation:
["token_hash"]` and `password_reset: ["token_hash"]`, so the images carry "(changed)" / "(unchanged)";
`organization-rows.ts`' marker check covers the two tables too.

**F7. `password_reset` without `workspace_id`** breaks "every model and work table has `workspace_id`" and would put its
change events in no log. *Proposal:* `workspace_id` = the workspace whose People tab made the link (the actor's rights
are read there); events in that workspace's log, as D-58's people changes.

**F8. A reset link is an account takeover by its maker** (PRD P2.3 rule "an Admin never for an Owner"). The link works
for whoever opens it, so an Admin of workspace A could take over a Modeler of A who is an Owner of workspace B, the
organization's owner, or a person who belongs to another organization (AD-01). *Proposal (D1):* a reset link only when
the actor already has power over everything the person can reach: (a) the person belongs to no other organization (no
`organization_member` row and no workspace elsewhere); (b) in **every** workspace of the person in this organization the
actor is Owner, or Admin while the person is not Owner there; (c) the person is not the organization's owner or admin.
Otherwise the button is hidden and the server refuses with "Only someone with the same rights in every workspace of
{name} can make this link." AD-40 also says plainly that the inviter can open their own link (a known limitation until
e-mail: an invitation's e-mail is not verified, so an inviter can make an account under any address of their own
organization's invitations).

**F9. A person without an Auth account** (`auth_user_id` null online). The PRD's two Join paths assume either no person or
a person with an account. *Proposal (D5):* Join for such a person shows "Set your password" (their name kept, D-58: an
existing account keeps its name), makes the account and links it; a reset link for them does the same. An Auth account
with the e-mail that no person links and no invitation marks: refused with the message in Q10.

**F10. The order Auth first, rows second** with `app_metadata.invitation` and `deleteUser` on failure (Q6). The PRD's
"or step 1 proposes the safe order": this is it; rows first would leave an `app_user` without an account, the state
slice 30 disabled "Add person" for.

**F11. Password rules.** The existing rule (`PASSWORD_MIN_LENGTH` 8, max 200, "The passwords differ.") is the
organization's password and stays local. The person's: a rule of its own in the domain (`PERSON_PASSWORD_MIN` 10, max 72
for bcrypt), with the prototype's texts: "The password needs at least 10 characters.", "The two passwords are not the
same.", and "The password can have at most 72 characters." (not in the prototype).

**F12. The proxy** lets only `/sign-in` through (Q10). Two paths added; a full run in that step.

**F13. AD-04's note** "only the sign-in and sign-out actions write the session's cookies": Join, "Sign in and join" and
"Set password" join them (`supabaseServer({ write: true })`).

**F14. Constant-time comparison** (PT2): the lookup by SHA-256 through the index needs none. The PRD's line becomes
"looked up by its hash".

**F15. "The database's clock"** (Q5): the application's clock, as every command. Tests move time by writing `expires_at`
in the past (through the domain in the local e2e file; with the smoke helpers' `query` on the local stack).

**F16. "Change password…" needs the secret key too** (the PRD says only invitations do): `updateUserById`; a person's
own `updateUser` would avoid it but depends on Supabase's "secure password change" setting. So "not set up yet" covers it
(Q3). Other sessions: Q7, D4.

**F17. "Add person" replaced on both adapters costs earlier specs and helpers.** The domain's `addPerson` writes test data
in `e2e/slice-08/helpers.ts` (`addPerson`), used by S8-06, S13-10, S14A-01, S14A-12, S14B-06 and
`e2e/slice-25/helpers.ts` (`addReader`). *Proposal:* the membership rule of `addPerson` (organization row, guest stays
guest) moves into the accept command (`joinWrites`, shared); the helper `addPerson` makes an invitation and accepts it
through the domain, so those specs do not change. S8-08, S8-10's UI part, S8-12 and S30-08 change (section 5).

**F18. PT6 locally** (Q2): proposal D3.

**F19. The archive.** Creating, renewing, revoking an invitation and making a reset link are people changes: refused in an
archived workspace (D-58). Joining a workspace archived after the link was made: *proposal* the page says "{workspace} is
archived, so nobody can join it now. Nothing was changed." (not the one expired message: the link is still good).

**F20. The inviter's role changes or they leave.** *Proposal:* the invitation stays valid (it is the workspace's, listed
and revocable by every Owner and Admin there); `invited_by` keeps their name on the page.

**F21. Expired invitations** (not in the PRD or the prototype). *Proposal (D6):* they stay in "Pending invitations" with
"· expired {date}" and both buttons; New link makes a fresh 7 days. Inviting the same e-mail again while one is listed:
the message of F5.

**F22. Signed in as someone else** when opening a link: Join signs in as the invited person, replacing the session. The
prototype has no line for it. *Proposal:* nothing in this slice (an idea in `docs/ideas.md`), unless Łukasz wants the
line "You are signed in as {name}; joining signs you in as {e-mail} instead." (D8).

**F23. The made-up person after the acceptance** (step 5): "Remove" leaves the `app_user` and the Auth account; the
account can sign in and sees no workspace. Optional: Supabase dashboard → Authentication → Users → delete it.

**F24. Part 9's heap** (section 1, Q9).

**F25. The change events' actor.** Accept and a reset's use: the person themself (the new `app_user` is inserted in the
same write set, before the events). Change password writes nothing in the database (Auth only), so no event; the reset
link's creation and use are events with the hash's marker.

**F26. The once-only rule under concurrency** lives in the write (the whole-row comparison, Q6); the contract suite gets
"the same invitation accepted twice at once: one membership" beside slice 30's concurrency cases.

**F27. A step-numbering detail:** the PRD's step 2 touches the table registry and the local adapter, so it needs a full
run too (the exception), not only step 3.

**F28. Mobile width:** the prototype's fixed columns (140 and 236 px) leave the person column narrow below about 600 px;
the app's home pages are desktop pages today. Followed as drawn.

**F29. The local file's format 18** (Q4, Q10).

## 4. The prototype against the app (what this slice touches)

| # | Place | Prototype | App today | Proposal |
| --- | --- | --- | --- | --- |
| P-a | People table | `table-layout: fixed`, columns auto / 140 px / 236 px, actions **left** in their cell right after the role, buttons 6 px apart, the person cell wraps anywhere, the action cell never wraps | no column widths, actions right-aligned (`text-right`), the third column only for managers | as the prototype; the third column stays managers-only |
| P-b | Pending table | shown to every role, with its buttons (a prototype shortcut) | – | Owners and Admins only (PRD) |
| P-c | Role select | offers Owner to admins (old shortcut) | Owner only for owners (F12 of slice 8) | the app's rule stays |
| P-d | Admin texts | ROLE_CAN "…approve, invite people and change settings."; table "invite, roles, settings" | "…approve, add people, change their roles and change settings."; "add people, roles (not owners), settings" | "add people" → "invite people", the app's precision kept |
| P-e | Invite box | "Invite person", the line, e-mail (flex, min 240 px), role (Modeler), primary small "Create invitation link" | "Add a person": name, e-mail, role, Continue, summary | as the prototype; no name (the person types it) |
| P-f | A bad e-mail | toast "Enter an e-mail address." and focus | field message under the field | the app's field message (same text) |
| P-g | Link dialog | title, text, link box (8 px gap, 8/10 px padding, 1 px line, 6 px radius, panel background, code 12 px mono, ellipsis), Copy primary, hint 8 px above, footer right with Done 16 px above; ✕ in the head | – | as the prototype, on the app's `Dialog` |
| P-h | New link | title "New invitation link", "For {e-mail}, as {role}. The earlier link no longer works." | – | as the prototype (the PRD said "the same dialog") |
| P-i | Revoke | no confirmation; toast "The invitation to {e-mail} is revoked; its link no longer works." | – | as the prototype |
| P-j | Expiry | "· expires 27 Nov 2026" (en-GB, 12 px, ink-3), e-mail italic ink-3, header "E-mail" | – | as the prototype (the app's `note-data.ts` date format) |
| P-k | Join pages | dialogs over the app | – | pages outside the shell in the sign-in page's card (PRD), same texts |
| P-l | Refused link | title "Invitation", the two sentences, button "Close" | – | no button (a page has nothing to close) |
| P-m | Wrong password on "Sign in and join" | "The e-mail or the password is not right." | sign-in: "The e-mail address or the password is wrong." | the app's sign-in text (one refusal, AD-04) |
| P-n | Error lines | one line `.pplerr` (12.5 px, warn, 10 px above the footer) and the hint "At least 10 characters." under the fields | field messages under each field (12 px) | the prototype's one line in these dialogs and pages (D9) |
| P-o | Disabled e-mail | opacity .6 | – | as the prototype |
| P-p | Person's menu | "Change password…" right before "Sign out", after the Theme's separator, online only | – | as the prototype |
| P-q | Change password | title "Change password", "For {e-mail}.", three fields, toast "Password changed. Use the new one next time you sign in.", "Enter your current password." | – | as the prototype |
| P-r | Reset button | hidden for oneself, a guest, an Owner when an Admin, locally | – | plus F8's rule and F9 |
| P-s | Reset page | "Set a new password", "For {e-mail}. This link works once, for 24 hours.", "Set password" | – | as the prototype |
| P-t | "Prototype only" menu items | open the four link states | – | not built |

Spacing details found: P-a (the action column's alignment and the fixed widths are the visible change), P-g's link box
and P-n's single error line; the rest matches the app's boxes (`boxClass`, 13.5 px headings).

## 5. Earlier specs and tests, by step

| Step | Spec or test | What changes, why |
| --- | --- | --- |
| 2 | `src/domain/commands/people.test.ts` | `addPerson`'s cases move to the accept command's tests (F17); role and removal unchanged |
| 2 | `src/data/local/organization-store.test.ts` | the add case through the accept command; format 18 |
| 2 | `tests/schema/compare-schema.ts` | `invitation` off `NOT_IN_DOMAIN_YET` |
| 2 | `tests/table-registry.test.ts`, `tests/contract/reads.test.ts`, `writes.test.ts` | the two tables, their reads, the new writes, the concurrency case (F26) |
| 2 | `tests/kb-copy.test.ts`, `tests/contract/copy.test.ts` | a row of each new table copied, backed up and restored; the hash marker (F6) |
| 2 | the local file's upgrade tests | format 17 → 18 |
| 3 | `e2e/slice-08/helpers.ts` (`addPerson`) | invite and accept through the domain; S8-06, S13-10, S14A-01, S14A-12, S14B-06 and `e2e/slice-25/helpers.ts` unchanged (F17) |
| 3 | `e2e/slice-08/S8-08.spec.ts` | rewritten: inviting and accepting locally, the person sees only their workspace; the "already in" refusal; an account from elsewhere keeps its name |
| 3 | `e2e/slice-08/S8-10.spec.ts` | its first test adds Piotr through the box: through the helper instead |
| 3 | `e2e/slice-08/S8-12.spec.ts` | `box-add-person` → `box-invite-person`; the refused write replays the invitation action |
| 3 | `e2e/slice-29/S30-smoke-writes.spec.ts` (S30-08) | replaced: "Invite person" enabled online (or, without the key, the not-set-up line) |
| 3 | `e2e/slice-00/S0-03`, `e2e/slice-32/*`, `S29-05`, `S32-smoke-theme` | the person's menu: read again; locally the menu has no new item, online one more (only S29-05 and S32-smoke run online) |
| 3 | `src/proxy.ts`'s users | the full run (F12) |

## 6. The plan for steps 2 to 6

**Step 2 – the domain and the data** (full run: the table registry and the local adapter). The migration (F4, F5, F7);
domain types, `OUTSIDE_UNDO`, `SECRET_COLUMNS`; the commands in `src/domain/commands/invitations.ts` (create, renew,
revoke, accept new / existing / without account, create a reset link, use it) with the rights of Q8 and F8, the password
rule (F11), the archive (F19); `addPerson`'s membership rule shared (F17); the local rules and format 18; the Postgres
reads and ports; the contract suite; unit tests for every rule. The draft PR into `dev`. Stop.

**Step 3 – the screens and Auth** (full run: the proxy). `supabase-admin.ts`, `invitationsReady`; the actions (the token
made on the server, the link's address); "Invite person", the link dialog, "Pending invitations", New link, Revoke,
"Password reset link"; `/invite/[token]` and `/reset/[token]` outside the shell, the proxy's two paths; "Change
password…"; local Join (D3); "Add person" and its online text removed; the earlier specs of section 5; `e2e/slice-33/`
(S33-01 to S33-05's local parts); `e2e/slice-29/S33-smoke-*` (account made, sign-in after Join, an existing account
joins, change password, a reset link, the four refused states with `expires_at` moved, an Admin's link for an Owner
refused); the bundle and log check in the smoke job. If part 9 needs it, the tenth part first on a `chore/` branch (Q9).
Stop.

**Step 4 – Łukasz's settings, one at a time** (no full run; no code). `npm run pg:backup`; `npm run pg:migrate -- --dry-run`,
then `npm run pg:migrate` with KB's counts before and after (`npx tsx scripts/kb-counts.ts` on a copy of the backup, and
again on a backup after the migration: 4,871 rows both times); section 1's two (or three) clicks; no Redeploy. Run only
on `slice/33-people` (CLAUDE.md: a `pg:` script from the checkout its docs describe). Stop.

**Step 5 – Łukasz's acceptance** on `npm run dev:pg` with demo accounts, `pg:backup` first (as the PRD; locally on
`npm run dev`, looking only). Stop.

**Step 6 – closing** (full run on the final commit). The docs and AD-40, AD-04's, AD-01's and D-58's notes quoted in full;
CLAUDE.md's secret-key rules (F1); `known-limitations.md` (remove "Add person" online; add: links copied by hand, the
maker can open a link (F8), an unverified e-mail, an ended session lasting up to an hour (F16)); `pg:backup` before the
merge; after the merge, the preview's "Invite person" checked (F3).

## 7. For Łukasz to decide

- **D1 (F8): who may make a reset link.** (a) *recommended:* the three conditions of F8; (b) the PRD's rule only (an Admin
  never for an Owner), with the takeover written as a known limitation.
- **D2 (F1, Q3): Vercel's key.** (a) *recommended:* a new secret key of its own (`vercel-dev-preview`); (b) the laptop's key.
- **D3 (F18): locally after Join.** (a) *recommended:* signed in as the new person with only that organization unlocked;
  an existing local account joins without a password, its other organizations stay locked (D-58); (b) no session: the
  person signs in with the organization's link and password, which the inviter would have to send too.
- **D4 (F16): other sessions.** (a) *recommended:* a reset ends the person's other sessions (within the hour), a change of
  one's own password keeps them (as D-58's organization password); (b) both end them; (c) neither.
- **D5 (F9): a person without an Auth account.** (a) *recommended:* Join and a reset link make and link the account; (b)
  refused with a message, accounts for them by script only.
- **D6 (F21): expired invitations** listed with "expired" and both buttons (*recommended*), or dropped from the list.
- **D7 (F19, F20):** the archived workspace's own message on Join (*recommended*); invitations kept when the inviter's role
  changes (*recommended*).
- **D8 (F22):** the "signed in as someone else" line: an idea for later (*recommended*) or in this slice.
- **D9 (P-n):** the prototype's single error line in the new dialogs and pages (*recommended*) or the app's field messages.
- **D10:** the not-set-up wording of Q3 ("This server is not set up for invitations yet.").
