# Slice 33 – People: invitations by link and passwords online

Status: **proposed** (20 November 2026). The "people" slice of the database program (AD-31's amendments: after slice C,
before slice D). **Full path** (CLAUDE.md, "The slice cycle", 2): a migration, the session and sign-in (Supabase Auth
with the secret key on the server), both adapters, new public pages. Branch `slice/33-people`, from `dev` (`b4c7a96` or
later). PRD file: `docs/prd/slice-33-people.md`; step 1 writes `docs/prd/slice-33-acceptance.md`. Test regime:
CLAUDE.md, "Testing". Slice number 33 is an assumption (the next free number); step 1 confirms.

It has a **prototype change**, accepted by Łukasz on 20 November 2026. Both files are in Łukasz's Downloads folder (The
slice cycle, 3):

| File | SHA-256 |
| --- | --- |
| `slice-33-people.md` | given in the prompt |
| `infomapper-prototype-with-sources.html` | `c282cb41136473dc30bfb7ad49cfd19f96c63b62252e2e6ba704ad32625d1ab3` |

Written from the decision rounds of 20 November 2026 (no file in the repository; quoted as "P1", "P2", "PT1" to "PT9"),
the earlier recommendations of slice 30's rounds (Q4 to Q9, "Left for the people slice"), the prototype and a few
lookups in the code on `dev` at `b4c7a96` (marked "fact, `b4c7a96`"). Facts and assumptions are marked; every
assumption is to be checked in step 1. **Łukasz's own KB lives in `infomapper-dev` since 20 November 2026 (AD-39's
note): every rule of that note applies to this slice** (backups before acceptance, migration and merge; acceptance with
demo accounts only; no test touches KB).

## 1. Why

Since slice 30 "Add person" is disabled online, because it would make an `app_user` without a Supabase Auth account who
could never sign in (Łukasz asked explicitly for it to be fixed in this slice). This slice makes adding people work
online: an Owner or Admin invites a colleague by a link they copy and send themselves; the person sets their own
password. People can change their own password, and an Owner or Admin can give a forgotten-password link.

Decisions taken before this PRD (Łukasz, 20 November 2026):
- **P1.1:** people of the inviter's own organization, into a workspace, with the roles Admin to Reader; built and
  checked on the demo accounts (no real person to invite yet). **Guests from other organizations (Q6, AD-01) are not in
  this slice.**
- **P1.2 (a): a one-time invitation link the inviter copies** and sends himself (e-mail, Teams). No e-mail from the app
  (it may come with slice D).
- **P2.1 (a): Owners and Admins of a workspace invite**, with Admin, Modeler, Reviewer or Reader. Owner is never given by
  an invitation (today's transfer stays the way).
- **P2.2 (a): a link works 7 days and once.** Pending invitations are listed in "People", where they can be revoked or a
  new link made.
- **P2.3: everyone changes their own password** in the person's menu; **a forgotten password** (Claude's call, Łukasz
  delegated it): an Owner or Admin makes a one-time link to set a new password, copied like an invitation. Recovery by
  e-mail with slice D.
- **No release to `main`** in this slice (`main` deploys nowhere; slices 30 to 33 go to `main` with slice D).

**Hosting fact:** `dev`'s preview has Vercel's Standard Protection, so a person outside Łukasz's Vercel team cannot open
it: two gates today (Vercel's, then the app's own sign-in). On production (slice D) only the app's sign-in stays, and
invited people come in there. This slice is checked with demo accounts behind the Vercel gate; nothing here changes the
protection.

## 2. What to build

### Inviting (the prototype)

- **"People" tab** of the workspace home: the box **"Invite person"** (replaces "Add person" on both adapters, PT7) with
  an e-mail field, a role (Admin, Modeler, Reviewer, Reader; Modeler preselected) and **"Create invitation link"**. Shown
  only to the workspace's Owners and Admins. The text: "You get a link to copy and send yourself (e-mail, Teams). It
  works once, for 7 days. The person sets their own password."
- **The link dialog:** "Invitation link", "Send it to <e-mail>. They join <workspace> as <role>.", the link with **Copy**,
  "It works once, for 7 days. Shown only now: if it gets lost, make a new link.", **Done**. The link is shown only here
  (only its hash is stored).
- **"Pending invitations"** (Owners and Admins): e-mail, "· expires <date>", role, **New link** (the old link stops
  working, a new one is shown in the same dialog, 7 days again) and **Revoke** (the link stops working, the row goes).
  Pending invitations are no longer mixed into the people table. Both tables share the same three columns (person, role,
  actions), the action buttons right after the role (the prototype).
- An e-mail already a member of the workspace, or already invited and pending, is refused with a message. An e-mail is
  stored in lower case (`invitation_email_lower`).
- **Online, before the secret key is set** (PT1): "Invite person" says the server is not set up for invitations yet
  (wording in step 1), and nothing is created. The preview works as today otherwise.

### Accepting (PT3)

- **The page `/invite/<token>`** (public, outside the app shell; the prototype shows it as a dialog): "<inviter> invited
  you to <workspace> in <organization> as <role>." The e-mail is the invitation's, shown and not editable.
  - **No account with that e-mail:** "Your name", "Password", "Password again" (at least 10 characters), **Join**. The
    server makes the Supabase Auth account (confirmed) with the secret key, the `app_user` linked by `auth_user_id`, the
    organization's membership (a plain member, PT8) and the workspace's membership with the role, marks the invitation
    accepted, and signs the person in on the workspace.
  - **An account with that e-mail:** "You already have an account: sign in to add this workspace to yours." Password,
    **Sign in and join**; the membership is added and the person lands on the workspace.
  - **Expired, used or revoked, or an unknown token:** "This invitation link has expired, was already used or was
    revoked. Nothing was changed. Ask the person who invited you for a new link." One message for all four (no hint which).
  - Errors: a name missing; a password too short; the two not the same; a wrong password for an existing account. None
    changes anything.
- **Locally (PT6):** the same page on `localhost`; the local file has no per-person passwords (slice 31's F8), so
  accepting makes the memberships without a password step, and the person signs in as local sign-in works today (step 1
  confirms and proposes if this is wrong).

### Passwords (online only; PT4, PT5)

- **"Change password…"** in the person's menu, above "Sign out", online only: the current password (checked by signing
  in again), the new one twice (at least 10 characters), **Change password**. A wrong current password: "The current
  password is not right. Nothing was changed."
- **"Password reset link"** by each person in "People", for Owners and Admins, online only; not for oneself, not for a
  guest, and **an Admin never for an Owner**. The dialog as the invitation's: "For <name>. They set a new password with
  it and are signed in." "It works once, for 24 hours." The page `/reset/<token>`: "Set a new password", "For <e-mail>.
  This link works once, for 24 hours.", the new password twice, **Set password**; the person is signed in. A new reset
  link for the same person makes the earlier one stop working.

### How it works (proposals for step 1 to confirm)

- **PT1. The secret key:** Supabase's secret (server) key as a server-only variable, proposed name
  `SUPABASE_SECRET_KEY`, never `NEXT_PUBLIC_`; in `.env.postgres.local` on the laptop and as a **secret Preview variable
  scoped to `dev`** in Vercel, which Łukasz adds himself one step at a time, then a Redeploy (step 4). Never printed,
  logged, committed or in an artifact. Read only in the server module that makes Auth accounts and sets passwords.
- **PT2. Our own tokens:** 32 random bytes, base64url in the link; only a hash stored (`token_hash`, proposal SHA-256);
  compared in constant time; the link on the server's own address from the request (no variable). Supabase's own
  generated links are not used (they need its redirect URL settings: clicks in Supabase).
- **PT4. The reset links' table:** proposal `password_reset` (`id`, `app_user_id`, `token_hash`, `created_by`,
  `created_at`, `expires_at`, `used_at`, `revoked_at`), Row Level Security on and deny-all like every table (AD-05's
  note); a migration. Step 1 may propose reusing `invitation` if cleaner.
- **Commands in the domain** (AD-19, both adapters): create, revoke and renew an invitation; accept it (new person,
  existing person); create a reset link; set a password by a reset link; change one's own password. Rights in the domain
  (Q1 (a) of slice 30's rounds): Owner or Admin of that workspace; an Admin not for an Owner. Each write as today (one
  transaction, change events where people changes have them today; step 1 says which).
- **Auth account and rows in one go:** the Supabase account is made first; if the database write then fails, the
  account is removed again (or step 1 proposes the safe order). A person never ends with an account and no membership
  or the reverse without a message.
- **Signing in after Join or a reset:** with the password just set, through the existing sign-in path (`@supabase/ssr`,
  AD-04's note); no new session mechanism.
- **"Add person" online's disabled state, its known limitation and D-58's note** go (PT7).

### Tests

- **e2e (local adapter):** the box, the dialog, pending invitations, New link, Revoke; the invite page's four states;
  roles that see nothing; the e-mail refusals.
- **Contract suite (both adapters):** every new command; the same results on both.
- **Postgres with Auth:** the new person's account, sign-in after Join, an existing account joining, change password, a
  reset link; how CI's Schema workflow runs Supabase Auth today (step 1 says; proposal: the same way as slice 29's sign-in
  smoke). Never KB, never `INFOMAPPER_KB_EMAIL`.
- **Security checks:** an altered token, a used one, an expired one (clock moved), a revoked one; an Admin's reset link
  for an Owner refused; the secret key never in the browser's bundle (a check on the built client files) or a log.
- **Earlier specs** that use "Add person" or its disabled state: listed in step 1, changed with a reason.

### Not in this slice

Guests from other organizations (Q6); organization roles and managing an organization's people (Q7's principle stays:
no content without a workspace role); e-mail from the app, recovery by e-mail, the base URL as a setting; Microsoft,
Google or SSO sign-in; changing Vercel's protection; a release to `main`.

## 3. Data model

- `invitation` exists (fact, `b4c7a96`, initial migration): `workspace_id`, `email` (lower case), `role`
  (`invitation_role_ck`: admin, modeler, reviewer, reader), `token_hash`, `invited_by`, `created_at`, `expires_at`,
  `accepted_at`, `revoked_at`; Row Level Security on. Assumption: enough as it is; step 1 checks (an index on
  `token_hash`; the local adapter's place for it).
- New: `password_reset` (PT4), one migration. On `infomapper-dev` Łukasz runs `npm run pg:migrate` himself, after
  `npm run pg:backup` (AD-39's note), with KB's counts before and after (4,871 rows today).
- The local file: invitations and reset links in the file's shape (a format step if needed; step 1 says).

## 4. Sources

- **Decisions:** AD-01 (guests, later), AD-04 (sign-in; its notes), AD-05 (Row Level Security), AD-19 (layers), AD-31
  (the program), AD-37, AD-38 (writes), AD-39 (KB in the database; the switch's rules); D-58 (organizations and sign-in;
  "Add person"'s note).
- **slice 30's rounds:** "Left for the people slice" (Q4 to Q9) and the disabled "Add person".
- **Code (fact, `b4c7a96`):** `supabase/migrations/20261002000000_initial_schema.sql` (`invitation`),
  `src/app/_lib/roles.ts`, `src/app/w/[workspaceId]/_components/people.tsx`, `src/app/_actions/people.ts`,
  `src/domain/commands/people.ts`, `src/app/_lib/supabase.ts`, `src/app/_lib/session.ts`, `scripts/pg-accounts.ts`.
- **The prototype:** "People" (the invite box, `PPL.link`, pending invitations, `data-pr`), the person's menu
  ("Change password…"), the prototype-only invitation and reset pages (`PPL.join`, `PPL.reset`).

## 5. Steps

Stop after each step; wait for Łukasz.

1. **Reconnaissance and check.** Copy this PRD and the prototype from Downloads into the repository and check both with
   `cmp` and the SHA-256 (stop if either differs). Answer Q1–Q10 in `slice-33-acceptance.md`; every place where the PRD
   is wrong or costs more than it assumes, with a proposal; the differences between the prototype and the app this slice
   touches; the earlier specs and tests each step touches; the plan for steps 2 to 6. No application code, no
   connection to `infomapper-dev`.
2. **The domain and the data:** the commands, the migration, both adapters, the contract suite. A draft PR into `dev`.
3. **The screens and Auth:** "Invite person", the dialog, pending invitations, the invite and reset pages, "Change
   password…", the reset link, the secret key's server module; the e2e and Postgres tests. A full run.
4. **Łukasz's settings, one step at a time:** `pg:backup`, `pg:migrate` on `infomapper-dev` (counts before and after),
   the secret key in `.env.postgres.local` and as a Preview variable in Vercel, scoped to `dev`. No Redeploy yet (the
   code is not on `dev`); the variable waits for the merge. **Stop.**
5. **Łukasz's acceptance** on `npm run dev:pg` with demo accounts, `pg:backup` first: invite a made-up person with a test
   address, accept in a private window, see them in "People", change a password, a reset link, revoke and renew, the
   expired message (clock or a short-lived invitation in a test), then remove the made-up person; locally on
   `npm run dev`, looking only. **Stop** with what he saw.
6. **Close.** The docs and the decisions quoted in full for approval (section 8); one full run on the final commit.
   Merge into `dev` and tag `slice-33` only on Łukasz's command, with `pg:backup` before the merge; then the Redeploy
   on Vercel (the merge deploys `dev` with the variable already there; step 6 checks that the preview's "Invite person"
   works).

## 6. Acceptance criteria

Łukasz's criteria 1 to 5 (20 November 2026).

| ID | Criterion |
| --- | --- |
| S33-01 | **The invitation.** As an Owner or Admin I click "Invite person" in "People", give an e-mail and a role (Admin, Modeler, Reviewer or Reader) and get a link with a Copy button, shown once. The invitation is listed as pending with its expiry date; I can revoke it or make a new link. Modelers, Reviewers and Readers do not see "Invite person". (Criterion 1.) |
| S33-02 | **Accepting.** The person opens the link and sees the organization, the workspace and their role; the e-mail is filled in and cannot be changed. A new person gives a name and a password (twice, at least 10 characters), is signed in and sees the workspace with the role given. A person with an account signs in with their password and gets this workspace beside their others. A link used again, after 7 days or after revoking shows a clear message and changes nothing. The inviter sees the person among the people, and the invitation leaves the pending list. (Criterion 2.) |
| S33-03 | **Passwords.** "Change password…" in the person's menu: the current password and the new one twice; afterwards the new one works and the old one does not; a wrong current password gives a message and changes nothing. A forgotten password: an Owner or Admin clicks "Password reset link" by the person and gets a one-time link valid 24 hours with a Copy button; the person sets a new password with it and is signed in. An Admin cannot reset an Owner's password. Both online only; locally not shown. (Criterion 3.) |
| S33-04 | **Security and KB.** A link works once and only within its time; a guessed or altered address gives no access. An invited person sees only the workspace they were invited to, not KB nor the organization's other workspaces. The secret key is only on the server: not in the browser, the repository, logs or CI artifacts. No test invites into KB or resets Łukasz's password; the KB account is untouched and his password works as before. (Criterion 4.) |
| S33-05 | **Nothing breaks.** Locally people and roles work as before and "Invite person" replaces "Add person"; the full run passes and the contract suite compares the new commands on both adapters. The migration passes in CI; on `infomapper-dev` Łukasz runs `pg:migrate` after `pg:backup`, KB's 4,871 rows before and after. Łukasz adds the secret variable in Vercel one step at a time; until then the preview works as today and "Invite person" online says the server is not set up yet. Acceptance on `dev:pg` with demo accounts, `pg:backup` before it and before the merge; a made-up person invited, accepted in a private window, then removed. (Criterion 5.) |
| S33-06 | CI, the Schema workflow, the full run before the merge; every earlier test changed, with its reason. |

**Manual acceptance:** Łukasz, step 5: S33-01 to S33-03 on `dev:pg` with demo accounts; S33-04 and S33-05 from CC's
report and his own checks of KB's counts and his KB sign-in.

## 7. Questions for step 1

- **Q1. Today's people commands and screens.** What "Add person", role changes and removal do on both adapters; which
  change events they write; the disabled state online (slice 30's L6, D-58's note); what this slice replaces.
- **Q2. Sign-in today.** Local sign-in (the organization's password, D-58) and Postgres sign-in (Supabase Auth, AD-04's
  note, `@supabase/ssr`); how a person is matched to `app_user` (`auth_user_id`, e-mail); how the session lands on a
  workspace; what accepting and a reset must call to sign the person in. PT6's local behaviour confirmed or corrected.
- **Q3. The secret key.** Which Supabase key the project has (secret / service role), the admin calls needed (create a
  confirmed user, update a password, delete a user on failure), the server module that holds it, how the build proves it
  is not in the client bundle, and the "not set up yet" path.
- **Q4. `invitation` and `password_reset`.** Whether `invitation` is enough (indexes, uniqueness of one pending
  invitation per e-mail and workspace); `password_reset` or reusing `invitation`; the migration; the local file's shape
  and format step; Row Level Security.
- **Q5. Tokens.** Generation, hashing, constant-time comparison, the link's address from the request (Vercel's forwarded
  host), expiry checks against the database's clock; what "New link" does to the old row.
- **Q6. Accepting.** The order of the Auth account and the rows, and the undo on failure; the existing-account path; the
  organization's membership (plain member, PT8); what the person sees on landing; the four refused states' one message.
- **Q7. Passwords.** Change password (re-check the current one), the reset page, Supabase's own password rules against
  ours (10 characters), what happens to the person's other sessions after a change.
- **Q8. Rights.** Owner and Admin of the workspace only; Admin not for an Owner; guests (none made here, but existing
  guest rows: what "Password reset link" does for them: hidden, as the prototype).
- **Q9. Tests in CI.** How the Schema workflow runs Supabase Auth today; where the new Postgres tests run; the e2e
  folder and part (the parts' heap: part 9 peaked at 1,854 MB in slice 32); a recut if needed.
- **Q10. Risks and shared infrastructure.** The session, the proxy (the new public pages `/invite/*` and `/reset/*` must
  pass without a session), `pg:accounts` (unchanged?), KB and AD-39's rules, the shared `infomapper-dev`, anything in the
  code that changes this plan.

## 8. Decisions (proposals) and docs

Quoted in full at the closing for Łukasz's approval; the texts below are proposals for step 1 to correct.

- **AD-40 (new): invitations and passwords online** (slice 33): the link copied by the inviter, 7 days, once; our own
  tokens (hash only); the accept page and its two paths; the reset link (24 hours, once; Admin not for an Owner); change
  password; the secret key on the server only; no e-mail until slice D; local behaviour (PT6).
- **AD-04 (note):** accounts online are made by invitations (AD-40); passwords set by the person; recovery by a link from
  an Owner or Admin until e-mail.
- **AD-01 (note):** guests from other organizations still later (not in slice 33).
- **D-58 (note):** "Add person" is "Invite person" on both adapters; its disabled state online is gone.
- Docs: `decisions.md`, `data-model-v2.md` (`password_reset`), `known-limitations.md` (remove "Add person" online; add:
  links copied by hand, no e-mail; Vercel's gate on the preview), `ideas.md`, `inventory-prototype-vs-app.md`, README and
  CLAUDE.md (`SUPABASE_SECRET_KEY` in the secrets list and never in a log; the new pages; the tests).

## 9. Left for later

Guests from other organizations; organization roles; e-mail invitations and recovery by e-mail; SSO; production and
Vercel's protection (slice D).
