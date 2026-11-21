# Fix – A blank page after sign-in (slice 33's acceptance)

Status: **step 1, reconnaissance** (20 November 2026); decisions in section 7 (21 November 2026); step 2 builds them. Branch `fix/blank-page-after-sign-in` from
`dev` at `bc5329d` (slice 33's merge). A fix outside slices (CLAUDE.md, the slice cycle, 4): the session's forms are
shared by slices 8, 29 and 33.

Sources: `docs/known-limitations.md` ("A blank page after signing in on `dev:pg`"), `docs/ideas.md` ("A full page load
after an action that changes the session"), `docs/prd/slice-33-acceptance.md` (step 5, "Seen during the acceptance"),
`docs/decisions.md` AD-04's notes and AD-40.

Nothing here connected to `infomapper-dev`, ran a `pg:` script or read `.data/dev-db.json` or its backups. The probes in
section 3 ran on the e2e dev server (port 3200) and its own data file, `.data/e2e-db.json`.

## 1. What was seen

In slice 33's acceptance on `dev:pg`, signing in as Test Person on `/sign-in` left the page blank on `/`, with Next.js's
development badge "Rendering", until Ctrl+F5. The server log showed the workspace's page answered **twice**, without an
error. It was seen once and not reproduced then.

## 2. How the session's forms move on (facts, from the code)

Every form that changes the session calls a server action, gets `{ href }` back and then calls `router.push(href)`:

| Form | File | Action | Writes the session | `href` | Where |
| --- | --- | --- | --- | --- | --- |
| Sign in, step by step | `src/app/sign-in/start-forms.tsx` `SignInSteps` | `signInWithPasswordAction` | `writeSession` | `/w/{id}` (or `next`) | local |
| An organization's link | same file, `OrganizationLinkForm` | `signInWithPasswordAction` | `writeSession` | `/w/{id}` (or `next`) | local |
| Sign in with an account | same file, `AccountSignInForm` | `signInWithAccountAction` | Supabase's cookies (`write: true`) | **`/`** (or `next`) | Postgres |
| Create an organization | same file, `CreateOrganizationForm` | `createOrganizationAction` | `writeSession` | `/w/{id}`, with a toast | local |
| New organization… | `src/app/_components/new-organization-dialog.tsx` | `createOrganizationFromMenuAction` | `writeSession` | `/w/{id}`, with a toast | local |
| Join, Sign in and join | `src/app/_components/link-page.tsx` `useLinkAction` | `joinAction` | `writeSession` / Supabase's cookies | `/w/{id}` (`/sign-in` if the sign-in fails) | both |
| Set password | same file, `ResetForm` | `setPasswordAction` | Supabase's cookies | **`/`** (`/sign-in` if the sign-in fails) | Postgres |

The development list of test users is different: `signInAsDevUser` calls `redirect("/")` inside the action, so Next.js
navigates from the action's own answer; nothing races there.

What Next.js 16.4.6 does with such an action (read in `node_modules/next/dist/client/components/`):

1. **An action that sets a cookie counts as a revalidation.** Its answer carries `x-action-revalidated: 1` (seen in
   every probe below) and the Flight data of the page it was called from. The action's reducer
   (`router-reducer/reducers/server-action-reducer.js`) **resolves the action's promise first** and only then applies its
   own refresh of the current page (`FreshnessPolicy.RefreshAll`).
2. **So the form's `router.push` arrives while the action is still the router's pending action.** A navigation preempts
   it (`app-router-instance.js`, `dispatchAction`): the action is marked `discarded`, its state is never applied, and
   because it revalidated, the queue sets `needsRefresh` and dispatches an `ACTION_REFRESH` of whatever page is current
   once the queue is idle.
3. **On Postgres the sign-in lands on `/`**, which redirects on the server to the workspace (`src/app/page.tsx`). In the
   probe below with that landing, the browser then **asks for the workspace's page twice at the same moment**: the push's
   redirect and the queued refresh. That is the "answered twice" of the acceptance. With a landing straight on
   `/w/{id}` (the local sign-in, Join) the page is asked for once. Set password lands on `/` too.
4. The proxy (`src/proxy.ts`) plays no part in the race: `/sign-in` and the links' pages pass without `getClaims`, and
   on `/` and `/w/{id}` the new cookies are already in the request, so nothing is refreshed or redirected to `/sign-in`.

## 3. Reproducing it (what was tried)

**Not reproduced.** A temporary probe (a Playwright spec on the local adapter, not committed) signed in through
`SignInSteps` and delayed the router's requests with `page.route`; for the Postgres-like landing a temporary, reverted
line made `signInWithPasswordAction` answer `href: "/"`. 18 runs, all landed with the top bar:

| Case | Runs | Requests after the action | Result |
| --- | --- | --- | --- |
| Landing `/w/{id}`, every RSC answer 4 s late | 3 | one `/w/{id}` | top bar shown |
| Landing `/`, every RSC answer 4 s late | 3 | `/`, then **two `/w/{id}` at once** | top bar shown after both |
| Landing `/`, one of the two 5 s late, the other 0.3 s | 6 | the same | top bar shown after the slower one |
| Landing `/`, one of the two failing in the browser (each order) | 6 | the same | top bar shown (a failed one falls back to a browser navigation) |

So the double request is a fact and reproducible on demand; the blank page is not. Not tried: `dev:pg` itself (no
connection to `infomapper-dev` in this step), the preview's production build, and Turbopack compiling the workspace's
route for the first time while the two requests are on their way (on `dev:pg` the first visit of a route after a start
compiles it; the probes ran on a warmed-up server).

**Assumption (not proven):** the blank page is a rare interleaving of the push, the server's redirect and the queued
refresh in Next.js's router (two navigations to the same page racing, one of them applying a tree whose page segment
never arrives), made likelier by `dev:pg`'s 3 to 5 s pages and a route's first compile. On the preview (a production
build) the same router code runs, so the same race is possible there, without the badge; it has not been seen there.

**How Łukasz could try to reproduce it by hand** (only if he wants it; not needed for the fix): restart `npm run dev:pg`,
open `/sign-in` in a fresh private window with DevTools' Network panel open, sign in with a demo account, and look for the
two `/w/…?_rsc=…` requests. Several tries after a fresh start (so the workspace's route compiles during the sign-in) are
the most likely to show it.

## 4. The fix (proposal)

**A full page load after an action that changes the session** (`docs/ideas.md`), instead of `router.push`:
`window.location.assign(href)` in one small helper (`src/ui/after-session-change.ts`, one line and its comment), called
by the forms that change the session. The next page then starts as a new document from the new cookies: no discarded
action, no queued refresh, no second request, nothing of the old router's state (on Postgres `/` answers a plain 307 to
the workspace, then one document). It removes every condition section 2 found, whether or not the assumption in section
3 is the exact interleaving. Its cost is one full document load after signing in or joining, which a person does rarely.

Smaller alternatives, not recommended:
- **The action redirects itself** (`redirect(href)` in the action, as `signInAsDevUser` does): one answer, no race. But
  the forms' `try`/`catch` (`useStartAction`, `useLinkAction`) would catch the redirect as an error and show "Something
  went wrong", so every form changes anyway; and a redirect to `/` from an action renders `/`, which redirects again.
- **Online, answer `/w/{id}` instead of `/`** (the landing computed in the action): removes the double request, not the
  discarded action and its refresh. Narrower than the cause.

**Which forms** (Łukasz decides, D1 below):
- (a) **the session forms only:** `SignInSteps`, `OrganizationLinkForm`, `AccountSignInForm`, Join and "Sign in and join"
  (`useLinkAction`), Set password. The three actions the idea names, both adapters.
- (b) (a) and the two that create an organization (`CreateOrganizationForm`, "New organization…"). They change the
  session cookie too, but they show a toast ("Organization created …") that a full load would lose, so the toast would
  have to cross the load (for example in `sessionStorage`, read once by the next page). Local adapter only (D-58's note:
  no organization is created online).

Recommended: (a). (b)'s two forms are local only, where pages are fast and nothing was seen, and carrying a toast across
a load is new machinery for no observed fault; they go to `docs/ideas.md`.

CLAUDE.md's rule "the app never navigates after a save's answer" is about a save whose page the person may have left
meanwhile. These forms navigate after their answer today already, and that navigation is their purpose: the sign-in and
link pages have nothing else to go to while the button waits. The full load keeps that.

## 5. The proof (tests that fail on today's code)

The blank page itself cannot be shown failing (section 3). The test shows the conditions are gone: **after the form, the
landing page is a new document**, and the browser **never asks for the landing's RSC payload**.

- **`e2e/fixes/session-change-full-load.spec.ts`** (local adapter, joins the full run's last part): for `SignInSteps`,
  `OrganizationLinkForm` and a local Join: set a marker on `window` once the form is shown; after the click, wait for
  the top bar; expect the marker gone (a new document) and no `GET` with `rsc: 1` to `/w/…` after the action's answer.
  On today's code the marker survives and the workspace's RSC payload is fetched: **fails**. With the fix: passes.
- **The same check online** in the smoke set (`e2e/slice-29/`, Supabase's local stack in CI's Schema workflow):
  `AccountSignInForm` (landing on `/`: also exactly one document request for `/w/{id}`) and Set password, as a case in
  `S33-smoke-people.spec.ts` or a spec of its own beside it. Set password writes an Auth account, so it runs only
  against a database on this machine (F13), as `S33-smoke-people` does; the sign-in case writes nothing and runs
  against any target.
- Step 2 shows each new test failing on `dev`'s code first (run before the fix is committed, its output in the report).

The existing specs that sign in this way keep passing unchanged (`signInWithPassword` in `e2e/slice-08/helpers.ts`,
`joinByLink` in slice 8's helpers, slice 33's specs and the smoke set wait for the top bar, which a full load shows too).

## 6. The plan

- **Step 2:** the helper and the forms (D1's set); the local spec and the smoke case, each shown failing first on
  today's code; `docs/known-limitations.md`'s entry rewritten (the cause as found, the fix) and `docs/ideas.md`'s entry
  removed (with (b)'s remainder added if Łukasz chooses (a)); the draft PR into `dev` (CI runs on every push);
  `npm run lint`, `npm run typecheck`, `npm test`; slice 8's, 29's smoke (in CI) and 33's specs; **one full run**, since
  the forms are shared by slices 8, 29 and 33 (the report says why). Then a stop with the run's link, commit, times and
  counts, and the manual check for Łukasz: sign in, Join and Set password on `dev:pg` with the demo accounts.
- **Closing prompt (Łukasz's command):** the merge only. Before it: `dev` merged into the branch if it moved (and a full
  run again unless only Markdown changed), CI green on the last commit, `pg:backup` per the backup rule (nothing here
  migrates, so only if KB changed since the last one). No tag (a fix branch has none).

## 7. Decided (Łukasz, 21 November 2026; Claude's calls, for his approval at the closing)

- **D1: (a), the session forms only:** the three sign-in forms (`SignInSteps`, `OrganizationLinkForm`,
  `AccountSignInForm`), Join and "Sign in and join" (`useLinkAction`'s `JoinForm`) and Set password (`ResetForm`). The two
  forms that create an organization (`CreateOrganizationForm`, "New organization…") stay as they are, with
  `router.push` and their toast; they go to `docs/ideas.md`.
- **D2: neither:** no reproduction on `dev:pg` before the fix, by Claude or by hand. The tests show the conditions gone
  (section 5).

## 8. Step 2 (21 November 2026)

**The fix:** `afterSessionChange(href)` (`src/ui/after-session-change.ts`, `window.location.assign`), called by
`SignInSteps`, `OrganizationLinkForm`, `AccountSignInForm` (`src/app/sign-in/start-forms.tsx`) and `useLinkAction`
(`src/app/_components/link-page.tsx`: Join, "Sign in and join", Set password). In `useLinkAction` the button stays
disabled after a success until the next page (`leaving`), as it did while `router.push` ran inside the transition. The
two forms that create an organization are unchanged (D1); the idea is in `docs/ideas.md`.

**The tests, failing first on `dev`'s code** (commit `7309686`, tests only):
- `e2e/fixes/session-change-full-load.spec.ts`: the single-file check, run 44877699955: 3 failed (each with the marker
  still set, one RSC request to the landing and no document request). Locally the same.
- `e2e/slice-29/fix-smoke-session-full-load.spec.ts` in the Schema workflow's smoke job, run 44877695763: the account
  form and Join failed the same way; Set password did not run (the "writes" block is serial and needs Join's person),
  so it was not shown failing on its own.

**Earlier specs that changed** (not foreseen in section 5): after a full load the top bar is drawn by the server before
the page's code runs, so a click right after it could go nowhere. S33-04 failed so (the workspace switcher opened no
menu). The helpers that end with these forms now wait for the page to hydrate (`landed`, `e2e/session-full-load.ts`:
the top bar and Back enabled, as slice 9's `hydrated`): slice 8's `signInWithPassword` and `joinByLink`, slice 29's
`signIn`, and four places in `S33-smoke-people.spec.ts` that click or sign out right after Join, Set password or a
sign-in. No assertion changed.

**Seen on the laptop, not from this fix:** S0-10 (the dev server restarted, then the development list's sign-in) failed
locally on this branch and on `dev`'s code alike (the bar never showed after the restart); `signInAsDevUser` is not
touched here. The full run in CI decides.
