# Slice 8 – Organizations and sign-in

Status: **draft for step 1**, 27 October 2026. Branch `slice/08-organizations`, from `main` at tag `slice-07c`. PRD file: `docs/prd/slice-08-organizations.md`. Test regime: a small slice (CLAUDE.md, "Testing"), plus one full e2e run after the step that changes the sign-in page (P1). Step 1 checks this PRD against the code (CLAUDE.md, "How we work").

## 1. Why this slice

Slice 8 makes InfoMapper startable from nothing. A person creates an **organization** with themselves as its owner and an **empty first workspace**, adds the people who work with them, and those people sign in through the organization's **link and password**. Organizations are silos: nobody sees another organization's workspaces, names or data. This rehearses how a licensee would start, on the local adapter and in development only; real accounts arrive with the database slice, which stays last (AD-29, AD-31).

The guiding principle of slices 7a–7c stays: the modeller stays in control and sees what will happen before it happens; nothing changes silently. Every action that creates or changes access shows a summary first. People changes are not undo steps (as on the home pages, known limitation "No undo outside canvases"); a role change or Remove takes them back.

The prototype has no sign-in page ("Signing out is not part of the prototype"), so the start page is new UX and gets a decision of its own (D-58). The prototype gives "New organization" in the organization menu and the People tab's role change and Remove. Where the app has its own conventions (change events, permissions, archive, toasts), they win over the prototype's code.

**Decisions agreed with Łukasz on 27 October 2026:**

- **P1. Size and tests.** A medium slice in the small-slice test regime, plus one full e2e run after the step that changes `/sign-in`, because every e2e test signs in through it.
- **P2. The start page.** `/sign-in` has two paths, "Sign in" and "Create an organization". Below them, in development only, the current list of test users stays as it is, so the existing tests keep signing in the same way. An organization's link (`/sign-in?org={id}`) opens the sign-in for that organization directly.
- **P3. Signing in.** E-mail, then the organizations that person belongs to, then the chosen organization's password. A list of all organizations is never shown. That an e-mail address reveals its organizations' names is accepted as a known limitation.
- **P4. Several organizations.** A session unlocks each organization with its password, once per session. The switcher asks for the password only the first time. Without this, the owner of organization B could add a member of A to B, sign in as that person with B's password and switch into A.
- **P5. Creating an organization.** A form with the organization's name, your name, your e-mail, the password twice (at least 8 characters) and the first workspace's name (default "First workspace"). A summary before anything is written. An e-mail address that already has an account is refused with a hint to sign in and create the organization from the organization menu; a signed-in person creates further organizations there, as in the prototype. The first workspace is empty apart from the 19 built-in classifications (slice 7c); no project.
- **P6. People.** The People tab gets "Add a person" (name, e-mail, role) in place of the prototype's "Invite someone", plus the prototype's role change and Remove, for the workspace's owners and admins. The last owner cannot be removed or lose the role. An e-mail that already has an account joins under that account's name, and the summary says so.
- **P7. Organization membership.** A person belongs to an organization while they have at least one workspace in it. Removing them from their last one ends the membership, and the confirmation says so. The creator is the organization's owner; added people are members.
- **P8. Organization access.** A box "Organization access" on the People tab, for the organization's owners and admins: the link with Copy, and changing the password. Changing it does not sign out people who are signed in (a known limitation).
- **P9. Data.** `organization.access_hash` (scrypt from `node:crypto`, server only, no new dependency) and `organization.access_changed_at`; a migration; `docs/data-model-v2.md`; a new local data file format. The demo organizations get the password `demo-pass`, written in the README.
- **P10. History.** Creating an organization, adding a person, changing a role, removing a person and changing the password write change events in a workspace's change group (AD-13). They are not undo steps.
- **P11. Development only.** Everything runs on the local adapter in development (AD-29, AD-31). Known limitations: one shared password per organization (the change log and four-eyes assume people sign in as themselves), an e-mail reveals its organizations, a password change keeps sessions.
- **P12. Decisions.** A new D-58 "Organizations and sign-in"; notes to AD-01 (guests from other organizations later) and AD-04 (until the database slice, an organization password in development).

## 2. Sources

**Prototype** (`docs/prototype/infomapper-prototype-with-sources.html`):

| Function or place | What it gives this slice |
| --- | --- |
| `openOrgMenu` | "New organization name, then Enter"; the new organization with you as Owner and an empty "First workspace"; the toast "Created {name} with an empty first workspace." |
| `openWsMenu` | a new workspace in the organization, empty, you as Owner; "Created the workspace {name}." |
| `renderWsHome`, People tab | the members table, the role select per member for admins (your own row as text), "Remove", the "Invite someone" box (e-mail and role, default Modeler), the table "What each role can do" |
| the workspace home's click and change handlers (`data-wa="invite"`, `data-role`, `data-rm`) | the toasts "Enter an e-mail address.", "{name} is now {role}.", "{name} no longer has access."; people outside the model's undo history |
| the help text "Signing out is not part of the prototype." | the prototype has no sign-in page: the start page is new UX (D-58) |

**Decisions:** D-27 (one model per workspace; isolation between clients), D-29 (no undo outside canvases), D-55 (the principle), AD-01 (organizations, guests), AD-04 (sign-in), AD-05 (roles), AD-06 (four-eyes needs real identities), AD-07 (landing on the last workspace), AD-09 (archive is read-only), AD-12, AD-13 (change events), AD-23 (writes through the server), AD-29 and AD-31 (local adapter and development sign-in until the database slice).

**Data model:** `docs/data-model-v2.md`, section 3 (Tenancy and access: `app_user`, `organization`, `organization_member`, `workspace`, `workspace_member`, `invitation`) and section 10 (`change_event`).

**Earlier slices:** slice 0's PRD and acceptance (the development sign-in and its cookie `infomapper_dev_session`, the switchers, the People tab, permissions, "any member of an organization may create a workspace; guests may not", organization roles in the seed, S0-01 to S0-11); slice 7c's acceptance (a new workspace holds the 19 built-in classifications in its creation's change group, S7C-01; the local data file's format 8 and its upgrade); `docs/known-limitations.md` ("No undo outside canvases", "The undo history lives in server memory").

## 3. What to build

Texts in quotes are proposals; step 1 may adjust them, and step 2 lists every new user-facing text for approval.

### The start page and signing in (P2–P4)

1. **`/sign-in`** shows two paths side by side: "Sign in" and "Create an organization". Below them, in development only, the current "Development sign-in" list of test users with its banner, unchanged. Without a session every page still leads to `/sign-in` (S0-01).
2. **Sign in, step by step.** E-mail (trimmed, lower case), then the person's organizations (name and the number of their workspaces there; a single organization skips this step), then that organization's password. Messages: "Enter an e-mail address." (the prototype's); "No organization uses this e-mail address."; "That password does not open {organization}." A right password starts the session and lands on the person's last used workspace in that organization (AD-07), else their first workspace there.
3. **The organization's link** `/sign-in?org={id}` shows the organization's name and asks for the e-mail and the password in one step. An e-mail that is not a member gets the same "No organization uses this e-mail address."
4. **The session** knows the person and the organizations unlocked in it (P4). A sign-in with a password unlocks that organization; creating an organization unlocks it. A sign-in through the development list unlocks every organization of that test user, as today. A page of an organization the person belongs to but has not unlocked asks for its password (the link's form, with the e-mail filled in) and then opens the page asked for. A page of an organization the person does not belong to stays a 404 (S0-11).
5. **The organization switcher** marks organizations not yet unlocked (a lock icon with the tooltip "Asks for the password once"); choosing one asks for its password, then opens its workspace as today. Sign out ends the whole session.

### Creating an organization (P5)

6. **The form** "Create an organization": organization name, your name, your e-mail, password, password again, first workspace name (default "First workspace"). Checks: names not empty after trimming; the e-mail's form; the password at least 8 characters; both passwords equal ("The passwords differ."). An e-mail with an account is refused: "This e-mail address already has an account. Sign in and create the organization from the organization menu." Organization names need not be unique (assumption, Q6).
7. **The summary** before anything is written: "You are creating the organization {organization} with you ({name}, {e-mail}) as its owner, and the empty workspace {workspace} with the 19 built-in classifications. People sign in to {organization} with its link and this password." Buttons "Create" and "Back"; Back keeps what was typed and writes nothing.
8. **Create** writes the person (`app_user`), the organization with its `access_hash`, the owner's organization membership, the workspace through the existing command that creates a workspace (with its 19 classifications, slice 7c) and the owner's workspace membership, in one change group (P10). The person is signed in with the organization unlocked and lands on the workspace home; toast "Created {organization} with an empty first workspace." (the prototype's).
9. **"New organization…"** in the organization menu, for a signed-in person: a dialog with the organization's name, the password twice and the first workspace's name; the same summary (without the person's fields), the same command, the same toast; the new organization is unlocked and opened.

### People (P6–P8)

10. **"Add a person"** on the People tab, for the workspace's owners and admins (not in an archived workspace): name, e-mail, role (Admin, Modeler, Reviewer, Reader; default Modeler, as the prototype). The summary: "{name} ({e-mail}) gets the role {role} in {workspace}. They sign in with the link of {organization} and its password." For an e-mail that has an account: "{e-mail} already has an account as {account name}; that name stays." Someone already in the workspace is refused: "{name} is already in {workspace}." Adding writes the person if new, their organization membership if missing (as a member) and the workspace membership; toast "Added {name} to {workspace} as {role}."
11. **Changing a role**: the prototype's select per member, for owners and admins; your own row stays text. Only an owner gives or takes the Owner role (assumption, Q5). The last owner keeps it: "{workspace} needs at least one owner." Toast "{name} is now {role}." (the prototype's).
12. **Remove** per member, for owners and admins, after a confirmation: "{name} loses access to {workspace}." and, when it is their last workspace in the organization, "They are in no other workspace of {organization}, so they leave {organization} too." Their earlier work keeps their name (change events, authors, approvals). The last owner cannot be removed. Toast "{name} no longer has access." (the prototype's). A removed person can be added again.
13. **"Organization access"**, a box on the People tab for the organization's owners and admins: the organization's link with "Copy" (toast "Link copied.") and "Change the password" (new password twice; the summary "People who are signed in stay signed in; the next sign-in needs the new password."; toast "Changed the password of {organization}.").

### Data and rules (P9–P11)

14. **Data:** `organization.access_hash` (text, null until set) and `organization.access_changed_at` (timestamptz, null). The hash is scrypt with a random salt in one string (parameters, salt and hash), compared in constant time. Hashing lives behind a port on the server, never in `domain` and never in the browser.
15. **Secrets never travel:** the hash never reaches the browser (no page data, no server action result), never appears in a change event's images (they carry a marker instead, Q4), and neither the hash nor any typed password is logged.
16. **Rules in the domain:** the form's checks; who may add, change and remove people (workspace owners and admins; owners only for the Owner role; the last owner); who may change the organization's password (its owners and admins); the archive refuses people changes (AD-09); P7's membership. The server checks every one and refuses with the domain's message, shown as a toast (AD-23).
17. **Change events** (P10): an organization's creation in its first workspace's change group; adding, changing and removing a person in that workspace's; a password change in the workspace whose People tab was used (Q4). None is an undo step.
18. **Local data file:** a new format whose upgrade gives every organization without a password the password `demo-pass` and says so in one server log line (no password in the log). The migration adds the two columns (DDL only).

### Data for tests

19. **Seeds and helpers:** the demo organizations get `demo-pass`; the README says so. New e2e helpers sign in with a password (`signInWithPassword`), create an organization (`createOrganization`) and add a person (`addPerson`); the existing helpers keep signing in through the development list.

## 4. Steps

Stop after each step with a short summary of what changed and how to check it; wait for Łukasz before the next.

1. **Critical review** (section 7): check every item, decision and criterion against the code, `docs/decisions.md` and slices 0 and 7c's acceptance; answer Q1–Q10 in `docs/prd/slice-08-acceptance.md`. No application code. Stop.
2. **The domain** (items 6–7, 10–13 as pure commands, 16–17): creating an organization, a new organization for a signed-in person, adding a person, changing a role, removing a person, changing the password; their checks, permissions and change sets; the password port as an interface. Unit tests; CI. Every new user-facing text listed for approval. Stop.
3. **Data, session and server** (items 4, 8, 14–15, 18–19): the migration, the local adapter's fields, format and upgrade, the scrypt adapter, the session with unlocked organizations, the server actions, the seeds and the e2e helpers. The decision texts quoted for approval (section 10). Unit tests; CI; slice 0's specs. Stop.
4. **The start page and signing in** (items 1–9): `/sign-in`, the link, unlocking, the switcher, "New organization…". The slice's specs for these, the touched earlier specs, CI, and one full e2e run (P1). Stop.
5. **People** (items 10–13): the People tab's additions and the organization access box. The slice's specs, the touched earlier specs (slice 0's People and role specs), CI. Stop.
6. **Closing:** docs (section 10), one full e2e run, Łukasz's manual acceptance. Merge only on his command; tag `slice-08`.

A new Claude Code session when a step's context runs long, with a handover section in the acceptance doc first (slices 7a–7c).

## 5. Acceptance criteria

Tests in `e2e/slice-08/`, one file per criterion, each from a fresh seed; unit tests next to the domain code.

| ID | Criterion |
| --- | --- |
| S8-01 | The start page: without a session every page leads to `/sign-in` with both paths; in development the test users' list signs in as before (S0-01 unchanged). |
| S8-02 | Creating an organization: each check's message; the summary; Back writes nothing and keeps the fields; Create writes the person, the organization with its hash, both memberships and the workspace with its 19 classifications in one change group; the person lands signed in on the empty workspace, with the toast. |
| S8-03 | An e-mail with an account is refused on the start page with its hint; nothing is written. |
| S8-04 | Signing in: the unknown e-mail's message; only the person's own organizations are listed; a wrong password's message; the right one lands on that organization's workspace (AD-07). |
| S8-05 | The organization's link: its name shown, e-mail and password in one step; a non-member gets the unknown e-mail's message. |
| S8-06 | Silos: signed in to A, a page of B (a member) asks for B's password; after it, A and B switch without asking; a workspace of an organization the person is not in is a 404; sign out ends both. P4's case: the owner of B adds a member of A to B, signs in as them with B's password and is asked for A's password when switching to A. |
| S8-07 | "New organization…" from the menu: the dialog's checks, the summary, Create; the new organization opens unlocked; the creator is its owner. |
| S8-08 | Adding a person: the summary for a new and for an existing account; someone already in the workspace refused; the new person signs in with the link and the password and sees only the workspaces they were added to. |
| S8-09 | Changing a role: the select, the toast; the last owner refused; only an owner gives or takes Owner; your own row is text. |
| S8-10 | Removing: the confirmation, with the last-workspace sentence when it applies; Cancel changes nothing; the last owner refused; afterwards the workspace is a 404 for them and, without another workspace there, the organization no longer lists them; their earlier changes keep their name. |
| S8-11 | Organization access: Copy puts the link on the clipboard; after a password change the old password is refused at the next sign-in, the new one works, and a signed-in session stays. |
| S8-12 | Roles and archive: modelers, reviewers and readers see no Add, no role select, no Remove and no access box; the server refuses each of these writes; an archived workspace refuses people changes. |
| S8-13 | Secrets: the hash is in no page's data or action result, in no change event image and in no log line; a unit test on the hash format and the constant-time compare. |
| S8-14 | The upgrade: a data file in the previous format gets `demo-pass` for every organization without a password, with one log line; nothing else changes. |
| S8-15 | CI and the full e2e runs of the test regime; changed earlier tests listed with the reason. |

**Definition of done (scenario for the manual acceptance).** Sign out. On the start page try to create an organization with `lukasz@infomate.pl` and read the hint. Create "Test Org" with a new e-mail and a password; land on its empty workspace, see the 19 classifications in a column panel later. Create a project, import a source file and map a column. Add Anna Nowak (existing account; her name stays) as Modeler and a new "Jan Test" as Reviewer; copy the link. In a private window sign in as Jan through the link: only Test Org's workspace. Change Jan to Reader, then remove him and read the last-workspace sentence. Change the organization's password; sign in again with the old one (refused) and the new one. Sign in as Łukasz to InfoMate with `demo-pass`, create "Second Org" from the organization menu, then switch back to InfoMate without a password and to Test Org with its password.

## 6. Performance

The slice does not touch the canvas; its cost is on the server (hashing) and in the top bar (the switcher's lock). Bars are proposals to confirm in step 1.

| What | How | Bar |
| --- | --- | --- |
| Verifying a password | a unit bench of the scrypt adapter, median of 20 | under 200 ms (enough to slow guessing, short enough to sign in) |
| Creating an organization | through the local adapter on the demo data, median of 5 | under 1 s, reported |
| Viewport elements on a canvas page | `S3B-15-elements.spec.ts` with `ELEMENTS_BASELINE` from `slice-07c` | equal |

Nothing new above the canvas reads layout during a commit (CLAUDE.md): the switcher's lock is an icon on the existing menu items, with no size read.

## 7. Questions for step 1

**The rule (CLAUDE.md, "How we work"):** a PRD is a proposal to verify, not a specification; this one was written from the prototype and the docs without reading the code. In step 1, check every item, decision and acceptance criterion against the code, `docs/decisions.md` and the earlier slices' acceptance docs, and write into `docs/prd/slice-08-acceptance.md` where the PRD is wrong, contradicts the code or a decision, duplicates what the app already has, misses what the code needs, or costs more than it assumes (data model, undo, change events, performance), each with the files and functions behind it and a proposal. List the differences between the reference prototype and the app that the slice touches. No application code in step 1; Łukasz answers before step 2.

- **Q1. The session.** How the development session is made, checked and refused in production today (the cookie `infomapper_dev_session`, `src/proxy.ts`, `src/app/_lib`). Propose the session for item 4: how it carries the unlocked organizations, how it is protected against editing in the browser, how the development list unlocks everything, and what changes for the e2e fixtures.
- **Q2. Where pages decide access.** Every place that checks membership for a page or an action (the 404 for a workspace you are not in, S0-11), the last-workspace cookies (AD-07), the switchers; where item 4's "asks for the password" fits, and how it returns to the page asked for.
- **Q3. Creating a workspace.** The existing command and every caller (the switcher, seeds, fixtures); whether creating an organization can reuse it in one change group with the person, the organization and both memberships; what a change group needs for rows without `workspace_id` (`app_user`, `organization`, `organization_member`).
- **Q4. Change events for organization rows.** `change_event.workspace_id` is required, but an organization spans workspaces. Propose where P10's events go (item 17) and the marker that replaces `access_hash` in the images. Whether any change event or undo path would replay an organization row.
- **Q5. Roles today.** The permissions module (AD-05) and the People tab's components; what an owner and an admin may do now; whether the Owner role in the select fits the module, and who may give it (the PRD assumes owners only).
- **Q6. Organization members and guests.** How `organization_member` is written and read today ("any member may create a workspace; guests may not"); the seed's guest (Łukasz as reviewer in Sales analytics) and its specs (S0-03); how P7's derived membership coexists with that guest. Whether organization names must be unique anywhere in the code.
- **Q7. Where organization rows reach the browser.** Every page, server action result and client component that receives an organization row, so the hash never travels (item 15); the scrypt parameters and where the adapter lives within the layer rules (AD-19).
- **Q8. The local data file and the schema.** The next format number, its upgrade and report; the migration; `npm run schema:check`.
- **Q9. People rows.** `app_user`'s fields and how the local adapter keeps e-mails unique; how a new person's name is written; whether anything in the app shows "last changed by" that P7's removal must keep readable.
- **Q10. Earlier tests and docs.** Specs that change (S0-01's page, S0-02's switcher, S0-03, S0-06, S0-07 and any spec that reads the People tab); the known limitations this slice touches; the README's and the inventory's status lines.

## 8. Differences from the prototype (deliberate)

- A start page with signing in and creating an organization; the prototype has none.
- Adding a person creates their account at once, reached through the organization's link and password; the prototype sends an invitation ("Invitation sent to {e-mail}.", a pending member).
- "New organization…" asks for a password and the first workspace's name and shows a summary; the prototype takes a name and Enter and names the workspace "First workspace".
- No guests from other organizations (AD-01, later); the prototype derives guests from the e-mail's domain.
- The last owner cannot be removed or lose the role, and only an owner gives or takes Owner; the prototype does not check.
- Remove asks first and says when the person leaves the organization; the prototype removes at once.
- "Organization access" (the link and the password) has no counterpart in the prototype.
- Every people change follows the app's roles, archive and change log; the prototype has one permission check.

## 9. Left for later

- **The database slice (last, AD-31):** real accounts with Supabase Auth and a password per person (AD-04); invitations by e-mail through the `invitation` table; signing out other sessions on a password change; password reset; limits on failed sign-ins.
- **Ideas (`docs/ideas.md`):** licences and activation codes for creating an organization; groups of people; SSO (AD-04); guests from other organizations (AD-01); an organization page (rename, delete, transfer a workspace, AD-09); deleting a person's account; a public landing page with the company's promotional material.

## 10. Docs in this PR

- **`docs/decisions.md`** (only with Łukasz's approval of the quoted text, step 3): a new D-58 "Organizations and sign-in" with P2–P8 and P10; notes to AD-01 (guests from other organizations later) and AD-04 (until the database slice, an organization password in development only); AD-05 if step 1 confirms that only owners give the Owner role.
- **`docs/data-model-v2.md`:** `organization.access_hash` and `access_changed_at`; the membership rule (P7); where organization rows' change events go (Q4).
- **`supabase/migrations/`:** one new migration, DDL only.
- **`docs/inventory-prototype-vs-app.md`:** "Settings and roles" (adding people, roles, Remove) and "New organization" done, in the development form.
- **`docs/known-limitations.md`:** the shared organization password; an e-mail reveals its organizations; a password change keeps sessions; no limit on failed sign-ins; development only.
- **`docs/ideas.md`:** section 9's ideas.
- **README and CLAUDE.md:** the slice's status; signing in with `demo-pass`; a short note on the session and unlocked organizations; the new e2e helpers.
