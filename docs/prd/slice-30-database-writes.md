# Slice 30 – Database B: the writes (saving on Postgres, lasting undo, imports through Storage)

Status: **built** (slice 30, steps 1 to 5, 19 November 2026; accepted on `npm run dev:pg` by Łukasz; the decisions await his approval, the measurement runs on `dev`'s preview after the merge). Proposed by Łukasz on 19 November 2026. **Full path** (CLAUDE.md, "The slice cycle", 2): the Postgres
adapter's writes, a new table, shared infrastructure (undo and change groups, the save chain, the table registry).
Branch `slice/30-database-writes`, from `dev` (`6da6c05` or later). PRD file: `docs/prd/slice-30-database-writes.md`;
step 1 writes `docs/prd/slice-30-acceptance.md`. Test regime: CLAUDE.md, "Testing".

The second slice of the database program (AD-31 as amended; AD-37 was slice A). It has a **prototype change**: the
server badge and the save indicator in the top bar's right corner, accepted by Łukasz on 19 November 2026. Both files
are in Łukasz's Downloads folder (The slice cycle, 3):

| File | SHA-256 |
| --- | --- |
| `slice-30-database-writes.md` | given in the prompt |
| `infomapper-prototype-with-sources.html` | `04e647bc738b851b4dfffd0cc64d8108993bc1f45a7ca1e88a0fc0381d3da2ed` |

Written from the decision rounds of 18 November 2026 (no file in the repository; quoted below as "round 1" and "round
2"), slice 29's PRD, acceptance and measurement docs, `docs/decisions.md`, `docs/data-model-v2.md` and
`docs/known-limitations.md`, **without reading the code**. Facts and assumptions are marked; every assumption is to be
checked in step 1.

## 1. Why

Slice 29 put the reads on Postgres and the app on a protected Vercel preview; every write there is refused and the
pages read only. This slice makes the model **editable online**: writes on Postgres with the same rules as the local
adapter, an undo history that survives a restart and several server instances, the count rules checked inside the
write's transaction, and imports that do not pass through a Vercel function's 4.5 MB body limit. It is what slice C
needs (KB copied to `infomapper-dev` and edited on the preview).

Decisions taken before this PRD:
- **DB4 (round DB, 16 November 2026).** Undo becomes lasting: per person and workspace, 50 steps, in the write's
  transaction. (Łukasz, 19 November 2026: the limit stays 50, the number the app has today, D-59.)
- **DB6.** `pg` directly through Supabase's transaction pooler; writes lock the workspace row (`for update`).
- **Round 1, L9 (18 November 2026): option B.** No new mechanism and no schema change for rows past the 999th of one
  millisecond: where an order means something (a page, a rule, an export) the domain or the port sorts explicitly;
  elsewhere the fallback to the key is accepted. Rejected: A, spreading a write set over the following milliseconds; C,
  a stored-order column in every table.
- **Round 2 (18 November 2026; Łukasz delegated the technical calls to Claude and accepted them as a whole):**
  - **B1. The split (amends AD-31).** Slice B is **the writes only**: writes on Postgres, lasting undo, the count rules
    in the write's transaction, imports through Storage. Invitations, organization roles, guests from other
    organizations and the in-app password work move to a **"people" slice** after slice C and before slice D, with
    e-mail, the base URL and the secret key question. Until then accounts are made by `scripts/accounts.ts`
    (`npm run pg:accounts`).
  - **B2 (Q1 a). Rights are enforced in the domain only,** on both adapters (AD-19, data-model-v2 §11). Row Level
    Security stays deny-all against the API roles; the Data API stays off. A dedicated login role with DML rights only
    comes in slice D, next to slice 29's F13 revokes. Known risk: a bug in a domain check is not stopped by the
    database; the domain tests and the contract suite are the guard.
  - **B3 (Q2 a).** Inside `apply`, under the lock, the actor's role and the workspace's archive are **read again**, as
    the local adapter recounts owners. A role removed or a workspace archived meanwhile refuses the write.
  - **B4 (Q3 a). The counts in the write's transaction** (the last owner, an organization owner's last workspace, the
    last project, InfoCube off, a canvas's last project link) by `select … for update` on the workspace row, and on the
    organization row where a count crosses workspaces. **Always in one order: the organization row first, then the
    workspace row**, so two writes cannot deadlock. No SERIALIZABLE and no retry loop.
  - **B5. "Add person" on Postgres is refused:** visible but disabled, with an explanation (it would make an
    `app_user` without an Auth account, who could never sign in). The local adapter keeps it as it is.
  - **B6 (Q7 b), a principle for the read fixes slice:** organization owners and admins will manage the organization
    but get no access to a workspace's content without a role in that workspace (the silo stays; one membership per
    workspace). Recorded here; nothing to build in this slice.
- **Acceptance criteria agreed with Łukasz (18 November 2026),** in his words of what he sees: section 6 turns them
  into S30-xx.

## 2. What to build

### The Postgres adapter's writes

- **`apply` writes a command's write set** in one transaction: the rows, their `version` checks (AD-12; a stale
  version is refused with the same error and the same fresh page as on the local adapter, so D-66's lines work
  unchanged), and the change group's `change_event` rows with their images and `context_label_id` (AD-13), in the same
  transaction.
- **The lock and the order (B3, B4):** the organization row first when the write's counts cross workspaces, then the
  workspace row, both `for update`; then the actor's role and the workspace's archive read again; then the counts; then
  the rows. Step 1 lists, per kind of write, which rows it locks.
- **The counts in the transaction (B4)**, each replacing the local adapter's recount inside its serialised write
  (`workspaceWithoutOwner`, `workspaceWithoutProject`, `offWithDimensional` in `src/data/local/store.ts`, as
  known-limitations.md names them) with the same message:
  - the last owner of a workspace ("{workspace} needs at least one owner.");
  - an organization owner's last workspace there (D-58);
  - the last project ("A workspace needs at least one project.");
  - a module turned off while it has objects, and an object created while it is off (InfoCube C-7; InfoDocumenter if
    AD-35's note makes the same rule for it: step 1 checks);
  - a canvas's last project link and a project's last canvas (D-28; "At least one canvas" can race,
    known-limitations.md). **Assumption:** the local adapter does not check this one inside its write today; on Postgres
    it is checked, and the local adapter gets the same recount so both adapters agree (step 1 confirms and proposes).
- **The stored order (AD-12's note, round 1):** `apply` sets the microseconds of each row's time column by its place in
  the write set; a command's rows share one millisecond (`ctx.now`); the change events' `occurred_at` the same. Past
  the 999th row the order falls back to the key, and **every read whose order means something sorts explicitly**
  (round 1, option B; step 1's list, Q3).
- **Read-only goes away on Postgres:** `ShellData.workspace.readOnly` is set only by the archive and the role, as on the
  local adapter; the indicator's "Read only", the home's banner and the document editor's refused saves go (S29-03's
  state and its known limitation).
- **Not changed on Postgres:** the start page (the account form only), no "New organization…", no organization
  password (D-58's note); licences by script (AD-35). Creating a workspace from the top bar works as on the local
  adapter, under its rights.

### Lasting undo

- **Today (fact, known-limitations.md "The undo history lives in server memory"):** each person's history in a
  workspace, the last 50 steps, is in the server process's memory, lost on a restart; undo and redo work from every page
  (D-65), and a revert is refused with "This can't be undone because it was changed afterwards." when a row it would
  write has changed since (row versions; assumption that this is the only test, step 1 confirms).
- **On Postgres the history is stored** (proposal: a table `undo_step`, section 3), written in the same transaction as
  the change group it records, and moved between the undo and redo lists in the same transaction as the revert. It
  survives a restart, a new deployment and Vercel's several instances; the next day and later, Undo still undoes the
  person's latest steps in reverse order, up to 50, and Redo brings them back. A new step clears the person's redo list,
  as today.
- **Several people:** each undoes only their own steps (D-65). A revert over a row someone else changed afterwards is
  refused with the message above and overwrites nothing; the step leaves the history, as every refused step does today.
- **The local adapter (Q4):** proposal (a): it keeps its history in memory as today (its known limitation stays), and
  the undo port behaves the same on both adapters within one server's life; (b) store it in the local file too (a
  format change, which on KB happens only in Łukasz's manual acceptance). Step 1 recommends.

### Imports through Storage

- **Fact (slice 29, F11):** an import file (up to 25 MB, `proxyClientMaxBodySize`) cannot reach a Vercel function,
  whose request body limit is 4.5 MB. **On Postgres the file goes to Supabase Storage** (a private bucket for import
  files, outside the portable core, AD-18) and the server reads it from there; the import itself is unchanged (D-55:
  the review shows everything first, the server builds the plan again from the same text and choices and writes only
  when it does what the review showed; one import is one change group and one undo step).
- **The browser never writes to the database (AD-23) and holds no Supabase client** (AD-04's note: no `NEXT_PUBLIC_`
  variable). Proposal: the server gives the browser a short-lived signed upload address and the browser sends the file
  there with a plain request (Q5 has the options and the key question).
- **The review's answer** may itself be large for a large import (about 10,000 columns): step 1 checks it against the
  4.5 MB response limit (Q5).
- **A large import holds the workspace lock** for its write (B4): its time, and how long another person's save in the
  same workspace waits meanwhile, are measured (S30-05). No threshold beforehand.
- The local adapter keeps reading the file from the request, as today.
- Files in the bucket: kept or deleted after the import (step 1 proposes; nothing in the model points to them today:
  `source_import` has `source_label`, not a file).

### The server badge and the save indicator (the prototype)

As the accepted prototype shows; the prototype's own controls (the user menu's "Prototype only" section) are not built.
- **Where:** in the top bar's right corner, before the details panel's button: the save indicator, then the badge;
  the details panel's button and the user indicator stay last (D-54). The document editor's own top bar has the same
  pair before its options panel's button.
- **The badge** names the server: `Local` on the local adapter; `Online · dev` on Postgres on `infomapper-dev` (the
  preview and `npm run dev:pg`); production is decided in slice D. Its tooltip says where changes are saved (the
  prototype's texts). Up to 1,500 px wide `Online · dev` shows `dev`. Where its value comes from (the adapter and a
  plain variable naming the database environment, or Vercel's): Q7.
- **The save indicator** follows every write the page sends (panel saves, the canvas's row chain, the canvas's moves and
  resizes, creates and deletes, undo and redo, imports, the document editor's saves, settings and people writes):
  "Saving…" while any write is on its way, then "✓ Saved", which fades after about 2 s; "⚠ Not saved" after a refused or
  failed write (a refusal, a timeout, no answer), in the warning colour, until the next save succeeds, with the reason
  and what to do in its tooltip. D-66's rules for a field's draft are unchanged. **Assumption:** the app may already
  have parts of this (the panels' save messages, the save chain's pending state); step 1 checks and reuses them (Q6).
- **Room in the top bar** (as in the prototype): up to 2,100 px the four tools (Hand, Entity, Note, Frame) show their
  icons only; up to 1,600 px the brand is hidden; the path names shorten before the bar overflows. The app's own rules
  for narrow windows ("More", slice 16; known-limitations.md "The top bar on narrow windows") come first: step 1 maps
  the prototype's rules onto them and lists the differences (Q6).
- **"Add person" on Postgres (B5):** visible, disabled, with the explanation "On this server people are added by an
  administrator for now." (step 1 may propose a better wording). Changing a role and removing a person stay as the
  rights allow (they write `workspace_member` rows; step 1 confirms they need no Auth account).

### Measurement

- **Saves on the preview,** in the style of slice 29's read measurement (`docs/prd/slice-29-measurement.md`), warm
  medians of 10: a rename, adding an attribute, moving a card, Undo; Server-Timing on the writes (total, statements and
  their time, the lock's wait, the page's refresh after the write).
- **The large import** (about 10,000 columns): upload, review, write; its lock time; another person's save waiting
  meanwhile (two sessions, as S30-07's test does).
- No thresholds beforehand; Łukasz decides after the figures (DB7).

### Tests

- **The contract suite covers every kind of write** (every command family, undo and redo, an import) on the local
  adapter and on Postgres, comparing the results; the write tests of slice 29's seven files that stayed local move into
  it where they test the port.
- **Concurrency on Postgres:** two connections at once for each count rule (the last project, the last owner, the
  organization owner's last workspace, a module off against a create, a canvas's last link): at most one succeeds, the
  other gets the message, and the data is never left without the thing counted; the same element saved twice with the
  same version: the second is refused as stale. In the Schema workflow's container.
- **The smoke set on Postgres** gains writes (sign in, create an entity and an attribute, rename, reload and see them,
  Undo after a new session) against Supabase's local stack; it reseeds where its writes need it (step 1: `e2e/settle.ts`
  or its own).
- **e2e on the local adapter:** the badge (`Local`), the save indicator's three states, and the disabled "Add person"
  is Postgres only (smoke). The full run stays on the local adapter.

### Not in this slice

Invitations, organization roles, guests, the in-app password work and e-mail (the "people" slice); the read fixes
(their own slice after this one, slice 29's measurement); KB on Postgres and a guard on `pg:seed -- --reset` (slice C);
a dedicated database role, production, backups (slice D); a store revision (Q8 decides whether it is needed now);
removing the organization password from the local adapter's code.

## 3. Data model

- **`undo_step`** (proposal; step 1 checks it against the code's undo history and proposes the final shape):
  `workspace_id`, `user_id`, `change_group_id`, `list` (`undo` or `redo`, CHECK), `position` (integer), `created_at`;
  key `(workspace_id, user_id, list, position)` or an `id`; at most 50 per person and workspace in `undo`, the oldest
  deleted in the same transaction. Not a model row: no `version`, no change event. A migration, `data-model-v2.md` §10,
  the table registry (AD-33), the schema check.
- **A Storage bucket for import files** (private, no public policy): Supabase configuration outside the portable core,
  created by a migration or a script (step 1).
- No other table changes. **Assumption:** the five counts need no index beyond the existing keys (step 1 checks with the
  queries).

## 4. Sources

- **Decisions:** AD-04, AD-05, AD-12 (note), AD-13, AD-18, AD-19, AD-22, AD-23, AD-29, AD-31 (amended), AD-33, AD-35,
  AD-37; D-28, D-54, D-55, D-58, D-59, D-65, D-66; round DB (slice 29's PRD), rounds 1 and 2 above.
- **Slice 29:** its PRD, `slice-29-acceptance.md` (F2's stored order, F3's transactions, F7's keys and Storage with the
  Data API off, F9's cookie refresh during an action, F11's body limits, F13's revokes, L9) and
  `slice-29-measurement.md`.
- **`docs/known-limitations.md`:** "The undo history lives in server memory", the count rules under concurrent writes,
  "A late fresh page could show an older state" (the store revision), "Read only: the document editor still offers its
  controls", "More than 1,000 rows in one millisecond are ordered by key", "The editor's snapshot is half of Vercel's
  4.5 MB", "The proxy runs at the edge".
- **`docs/data-model-v2.md`:** §10 (`change_event`), §11 (the rules kept in the domain), `source_import`.
- **Platform facts to check again in step 1:** Supabase Storage's signed upload URLs and the key they need; Storage with
  the Data API off; Vercel's 4.5 MB body limit for requests and for server actions' answers; Vercel's function duration
  (300 s default, 800 s maximum on Pro); the transaction pooler and `for update`.

## 5. Steps

Stop after each step; wait for Łukasz.

1. **Reconnaissance and check.** Copy this PRD and the prototype from Downloads into the repository and check both with
   `cmp` and the SHA-256 (stop if either differs). Answer Q1–Q12 in `slice-30-acceptance.md`, checking the platform's
   current documents for every assumption; every place where the PRD is wrong or costs more than it assumes, with a
   proposal; the differences between the prototype and the app this slice touches; the earlier specs and tests each step
   touches; the plan for steps 2 to 5. No application code, no write to `infomapper-dev`.
2. **The writes:** `apply` on Postgres with the lock, the role and archive read again, the counts and the stored order;
   the explicit sorts from Q3; the contract suite for writes on both adapters and the concurrency tests; read-only gone
   on Postgres; "Add person" disabled there. A full run (the local adapter and the table registry are touched).
3. **Lasting undo and imports:** `undo_step`, its migration and the history on Postgres; the local adapter as Q4
   decided; imports through Storage. A full run.
4. **The screen, the preview and the measurement:** the badge and the save indicator on both adapters, the top bar's
   room, the smoke set with writes; the preview (Q11); the measurement report. **Stop** with the figures.
5. **Close.** The docs and the decisions quoted in full for approval (section 8); one full run on the final commit.
   Merge into `dev` and tag `slice-30` only on Łukasz's command.

## 6. Acceptance criteria

| ID | Criterion |
| --- | --- |
| S30-01 | **Saving online.** On the preview, signed in with a demo account, adding an entity, an attribute and a mapping and renaming something are saved: after a reload they are there, and a second person signed in to the same workspace in another browser sees them after a reload. |
| S30-02 | **Lasting undo.** Each person undoes their own steps. After a reload, a new session and a new deployment, Undo in the top bar still undoes the person's latest steps in reverse order, up to 50, and Redo brings them back. |
| S30-03 | **Undo over someone else's change.** When another person changed the same element after the step, Undo refuses with its message and overwrites nothing. |
| S30-04 | **Importing online.** On the preview, "Import sources…" in the Sources tab imports a sample file through Storage; the tables and columns appear, stay after a reload, and Undo undoes the whole import in one step. |
| S30-05 | **A large import.** About 10,000 columns import without an error or a timeout; the upload, review and write times, the workspace lock's time and another person's save waiting meanwhile are measured and reported. |
| S30-06 | **The same element by two people.** Both change one entity's definition; the second save does not overwrite the first: the second person sees "Changed meanwhile to: …" with "Use this" and "Keep mine" (D-66). |
| S30-07 | **The count rules by two people.** Two people delete the last two projects at the same moment (and, in the tests, every count rule of section 2): at most one succeeds, the other gets the message, and the workspace is never left without a project, an owner or the rest. |
| S30-08 | **The screen on Postgres.** "Read only" and the home's banner are gone; the tools, the creates and the document editor work; "Add person" is visible, disabled, with its explanation. |
| S30-09 | **The badge and the save indicator.** As the prototype: `Local` on the laptop's local adapter, `Online · dev` on the preview; "Saving…" → "Saved" (fading), "Not saved" with its tooltip after a refused or failed write; in the top bar and in the document editor. |
| S30-10 | **Both adapters write the same.** The contract suite passes on both for every kind of write, undo and redo and an import, and the concurrency tests pass on Postgres. |
| S30-11 | **The order.** Every table one write set can fill with more than 1,000 rows is listed with every read of its order, and each read whose order means something sorts explicitly (round 1). |
| S30-12 | **Nothing breaks locally.** The local app and KB work as before: the full run passes; locally the badge shows `Local`. |
| S30-13 | **Saves measured.** The report gives the preview's warm medians for a rename, adding an attribute, moving a card and Undo, with statements and the lock's wait. |
| S30-14 | **Security.** No secret in the repository, the logs, a report or the browser; RLS on every table, the new one included; the Data API off; the Storage bucket private; the browser holds no Supabase client. |
| S30-15 | CI, the Schema workflow (contract, concurrency, smoke), the full run before the merge; every earlier test changed, with its reason. |

**Manual acceptance:** Łukasz, on the preview with two browsers and two demo accounts: S30-01 to S30-04, S30-06 and
S30-08, S30-09 (and `Local` on `npm run dev`); he reads the measurement report (S30-05, S30-13). KB is never read or
written by this slice.

## 7. Questions for step 1

- **Q1. Writes in `apply`.** How a write set becomes SQL (statements per table, batching for an import's thousands of
  rows), the version checks, the change events in the same transaction, the error mapping to the local adapter's
  refusals, what is shared with the local adapter so no rule is copied; the 4.5 MB request limit for any other large
  write.
- **Q2. The lock and the counts.** Per kind of write: which rows it locks (B4's order), where the role and archive are
  read again (B3), each count's query, and whether the local adapter lacks any of them (a canvas's last project link).
  Whether a write that touches several workspaces exists (a copy, a transfer) and how it locks.
- **Q3. The order (round 1).** Every table one write set can fill with more than 1,000 rows (an import's
  `source_column`, `mapping_input`, `classification_link`, `change_event`, …), every read of its order, and the explicit
  sort each meaningful one gets. Check round 1's assumption: ids are given in the order of the rows' places in the write
  set within one process (UUIDv7, slice 29's F2), so the key fallback gives the same order; name every place where they
  are not (rows made before the write set is ordered, seed constants).
- **Q4. Undo.** How the history works today (the 50 steps, the redo list, refused steps, the project's delete as one
  step, steps whose change group is gone); `undo_step`'s final shape; the local adapter (a) or (b) with a
  recommendation; whether the revert's refusal reads only row versions (S30-03).
- **Q5. Imports through Storage.** The upload path with no Supabase client in the browser; **the key it needs:** (a) the
  signed-in person's session with a Storage policy limited to their own folder (no secret key on Vercel), (b) the secret
  key on the server in Vercel (changes the rule that it is used by the accounts script only), (c) no Storage: the file
  in parts through functions under 4.5 MB; recommendation, with Storage's behaviour with the Data API off. The review's
  answer size for about 10,000 columns; the function's duration for the review and the write; the bucket's files after
  the import.
- **Q6. The screen.** What the app already has for the save state (the panels' save messages, the save chain's pending
  state, D-66's marks) and how the indicator reads them; which writes it follows; the top bar's narrow rules against
  the prototype's; the document editor's top bar; the wording of "Add person"'s explanation and the indicator's texts.
- **Q7. The badge's value.** Where the server says what it is (the adapter plus a plain variable, e.g. a name of the
  database environment, or Vercel's environment); `dev:pg` on the laptop shows `Online · dev`, as it writes to the
  shared database (proposal).
- **Q8. A store revision.** With several people, late pages are more likely (known-limitations.md, "A late fresh page
  could show an older state"). Whether this slice needs it, with a test that shows the case or that it does not occur.
- **Q9. Sessions during writes.** A token refresh during a server action makes Next.js refresh the page (slice 29, F9):
  what it does to a write in flight, to the save indicator and to D-66's drafts.
- **Q10. Tests.** Which local write tests move into the contract suite, the concurrency tests' design (two
  connections, a barrier), the smoke set's writes and its reseed, the local e2e specs, which steps need a full run.
- **Q11. The preview during the slice.** Only `dev` deploys (CLAUDE.md, "Hosting rules"), so this branch's writes reach
  the preview only after the merge. Options: (a) the slice's branch deploys for the slice, by the three changes
  CLAUDE.md names, and `dev` again at the closing; (b) step 4's measurement and Łukasz's acceptance run on `npm run
  dev:pg` before the merge and on the preview after it; (c) merge first, accept on the preview after. Recommendation
  with what each costs; Łukasz decides.
- **Q12. Shared infrastructure and risks.** What this slice touches that every slice uses (undo and change groups, the
  save chain, the table registry, `getDataStore`, the shell's read-only flag), the shared `infomapper-dev` (the laptop
  and the preview write to the same database; `pg:seed -- --reset` empties it), and anything in the code that changes
  this plan.

## 8. Decisions (proposals) and docs

Quoted in full at the closing for Łukasz's approval; the texts below are proposals for step 1 to correct.

- **AD-31 (amended again):** "Slice B is the writes only: writes on Postgres, lasting undo, the count rules in the
  write's transaction, imports through Storage. Invitations, organization roles, guests from other organizations and
  the in-app password work are a slice of their own ("people"), after slice C and before slice D, with e-mail, the base
  URL and the secret key question; until then accounts are made by script (DB10)."
- **AD-05 (note, B2 and B6):** "Rights are enforced in the domain on both adapters; Row Level Security stays deny-all
  and the Data API off; a dedicated database role with DML rights comes in slice D. Organization owners and admins will
  manage the organization but see a workspace's content only with a role in that workspace."
- **AD-12 (note, round 1):** "From slice 30 `apply` sets the microseconds of a row's time column by its place in the
  write set; past the 999th row of one millisecond the order falls back to the key, and every read whose order means
  something sorts explicitly."
- **AD-38 (new): the writes on Postgres** as built: one transaction per command; the lock order (organization row,
  then workspace row, `for update`); the role and archive read again; the counts in the transaction; the lasting undo
  history (`undo_step`, 50 steps per person and workspace, written with its change group); imports through Storage.
- **D-59 (note):** the undo history is stored on Postgres (no longer "in the server's memory until the database
  slice").
- **D-58 (note, B5):** "On Postgres "Add person" is disabled with an explanation until the people slice; the local
  adapter keeps it."
- **D-84 (new): the server badge and the save indicator,** as in the accepted prototype (section 2), including the top
  bar's room rules.
- Docs: `decisions.md`, `data-model-v2.md` (`undo_step`, the bucket), `known-limitations.md` (items closed: the undo
  history in memory for Postgres, the count rules, the document editor's read-only controls; new ones from the
  measurement), `ideas.md`, README and CLAUDE.md (writes on Postgres, the bucket, the commands, the environments table:
  the preview no longer read only).

## 9. Left for later

The read fixes (their own slice, after this one); slice C (the demo and then a copy of KB in `infomapper-dev`, after a
guard on `pg:seed -- --reset` and backups); the people slice (invitations, organization roles, guests, passwords,
e-mail; Q4 to Q9 of round 2 as recommended there); slice D (production, the database role, backups, Auth hardening,
GDPR, the production measurements deferred since slice 1a).
