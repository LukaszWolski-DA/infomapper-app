# Slice 30 – Database B: step 1, reconnaissance and check

Step 1 of [the PRD](slice-30-database-writes.md) (19 November 2026). No application code, no migration, no test
changed; no connection to `infomapper-dev`; `.data/` not read.

**Setup.** Branch `slice/30-database-writes` from `dev` at `6da6c05` (clean). Copied from Łukasz's Downloads folder,
each checked with `cmp` (identical) and SHA-256:

| File | SHA-256 | Expected |
| --- | --- | --- |
| `docs/prd/slice-30-database-writes.md` | `0590e65103967b98fed86c52f7d4b12ec7c25660832e1f6d5fc3fbddc363a368` | as the prompt gave |
| `docs/prototype/infomapper-prototype-with-sources.html` (replaced) | `04e647bc738b851b4dfffd0cc64d8108993bc1f45a7ca1e88a0fc0381d3da2ed` | as the PRD gave |
| the previous prototype (before replacing it) | `f3abaa2f14921e07476852b90b575f8fdf5fdd38e7b78876cf7ad98009fd6118` | as the prompt gave |

How to read this file: **F** numbers are findings (where the PRD is wrong, contradicts the code or a decision,
duplicates, misses something, or costs more than it assumes), each with a proposal; **Q** sections answer the PRD's
section 7; **L** numbers are the questions for Łukasz, collected at the end.

---

## The findings first (the PRD's mistakes and costly assumptions)

**F1. Undo's refusal does not read row versions only (PRD section 2, "Lasting undo"; Q4; S30-03).** The PRD assumes "a
revert is refused … when a row it would write has changed since (row versions)". `revertChangeGroup`
(`src/domain/commands/undo.ts:378`) compares each row's **content** with the step's after-image, `version` and
`updated_*` aside (`unchangedSince`, :539), so a row changed and changed back counts as unchanged; then it checks the
model stays consistent (`consistent`, :552: live parents, no live children of what goes, a card not twice on its canvas,
D-28's links, the last project), the requirement key, classification and stereotype names, calculation cycles and each
module's `revertRefusal`. Only the write itself carries the current version, so a change arriving between the read and
the write is refused by `apply`. *Proposal:* no change to the rule; S30-03 tests the content case (another person's
definition change) and the race case (a change between `loadForUndo` and `apply`, as stale).

**F2. Undo reads the whole workspace on every Ctrl+Z (cost the PRD does not count).** `undoAction`
(`src/app/_actions/undo.ts:84`) calls `store.model.loadForUndo`, which on Postgres reads **every undoable table of the
workspace with its deleted rows** (`schema.undoable`, about 35 statements in one transaction,
`src/data/postgres/store.ts:164`). It is the slice's largest read per write. *Proposal:* keep it in this slice (no
read fixes, DB7; the read fixes slice owns it), and measure it apart in S30-13 (the Undo median with its statement
count). An idea for the read fixes slice: read only the rows the step's events name and their parents.

**F3. The undo history as the PRD stores it would read thousands of change events on every page (Q4).** In memory a
step holds its change group's **events** (`UndoStep.events`, `src/domain/model/undo-history.ts:11`). Every workspace
home, project home and canvas page calls `store.undoHistory.get` (`w/[workspaceId]/page.tsx:43`,
`p/[projectId]/page.tsx:66`, `c/[canvasId]/page.tsx:105`) and uses only `undo.length > 0` and `redo.length > 0`
(:108, :113, :126). Stored on Postgres with the events read back, a page would read every event of 50 steps (an import
step alone is tens of thousands of events). And the local adapter's `withKnown` reads the workspace's whole change log
on every `get` (`src/data/local/store.ts:56`). *Proposal:* split the port: `undoHistory.state(ws, user)` answers
`{ canUndo, canRedo }` (Postgres: two `exists`), and `undoHistory.next(ws, user, mode)` answers the next step with its
events (read by `change_group_id`, indexed: `change_event_group_ix`). `undo_step` stores the step's `label` (it comes
from `writeSet.label` or `changeLabel` and cannot always be rebuilt from the events). The pages change three lines.

**F4. "Written in the same transaction" needs a new argument to `apply` (Q1, Q4).** Today the history is written
**after** `apply`, in a call of its own (`remember`, `run-command.ts:258`; `undo.ts:97`). For one transaction, `apply`
takes the history change with the write set: `apply(writeSet, { history?: { userId, change: "record" | "undone" |
"redone", step } })`. A refused step's drop (`dropNextUndo`, `undo.ts:77`) writes no rows; it stays a port call of its
own, made atomic by a compare (`delete … where` it is still the person's next step). The local adapter applies the same
change in its serialised write, so the port behaves the same on both.

**F5. Two of the PRD's five counts are not in the local adapter (B4, "each replacing the local adapter's recount").**
The local adapter recounts three things inside its write (`src/data/local/store.ts:274-285`): the last owner
(`workspaceWithoutOwner`), the last project (`workspaceWithoutProject`) and InfoCube off (`offWithDimensional`). It does
**not** recount D-28's links (confirmed: `docs/known-limitations.md`, "At least one canvas can race"; the commands check
them from what they read, `removeCanvasFromProject` and `deleteCanvas`, `src/domain/commands/canvas.ts:179-200,
385-393`; undo checks them in `consistent`), nor **an organization owner's last workspace** (D-58, checked only by
`checkRemove`, `src/domain/commands/people.ts:280`). A sixth count the PRD misses: **a person's organization membership
goes with their last workspace there** (P7, `removePerson`, people.ts:250): two removals of the same person from their
last two workspaces at once each see the other workspace, and the person keeps neither while their `admin`/`member` row
stays. *Proposal:* the count rules become one pure rule in the domain (`src/domain/model/count-rules.ts`): from a write
set, which checks it needs (`last_owner` of a workspace, `last_project`, `infocube_off`, `canvas_links` of a canvas and
a project, `org_owner_workspace` and `org_membership` of a person in an organization) and their messages. Each adapter
counts them **after its writes, before it commits** (the local adapter on its next state, as today; Postgres by queries
in the transaction, which see its own writes). Both adapters then check all six, so they agree (the PRD's assumption on
D-28, confirmed, extended to the two people counts).

**F6. Count after the writes, not before (B3, B4: "then the counts; then the rows").** Counting before the rows means
predicting what the rows will do; the local adapter counts on the state after them (`next`). Under the lock, counting
after the writes in the same transaction is the same rule and needs no prediction. *Proposal:* the order inside `apply`
is: the locks; the role and the archive read again; the rows; the change events and the history; the counts; commit
(or roll back with the count's message).

**F7. B3's "read again" has nothing to compare with (B3).** The domain checks permissions against the `access` its
loader read (`loadAccess`, `src/app/_lib/model-command.ts:17`, and three other loaders), and the write set does not say
what was checked. Under the lock `apply` can read the role and the archive, but cannot tell whether the write is still
allowed without knowing the command's action. *Proposal:* `runCommand` passes the access the command was built with
(`{ workspaceId, userId, role, archived }`, recorded by wrapping `workspaces.get` and `workspaces.getMember` of the
store it hands to `build`; for a workspace's create, the organization role) and `apply` refuses when either differs
under the lock: role changed → `forbidden` with a new message "Your role in {workspace} changed meanwhile, so nothing
was saved."; archived or unarchived meanwhile → `archived` with the archive's message. Both codes already cut, bring the
fresh page and show D-66's read-only draft. A promotion meanwhile is refused too (one save again, rare); **L1**.
Undo and redo pass theirs the same way (`undo.ts:63`). The local adapter does the same check in its serialised write.

**F8. Foreign keys are checked per statement, and none is deferrable (Q1).** The 198 foreign keys in the migrations are
`NOT DEFERRABLE` (no `deferrable` anywhere in `supabase/migrations/`), so Postgres checks each at the end of each
statement; the local adapter checks after the whole write set (`findViolation`, `store.ts:287`). A write set whose
rows come in an order where a child precedes its parent, or an insert takes a unique name a later update frees, is
refused on Postgres and accepted locally. Deferrable keys would fix the first, but SQL Server has none (AD-18) and
partial unique indexes cannot be deferred. *Proposal:* `apply` runs a write set in phases, with one statement per table
and phase: (1) removes and soft-deletes; (2) inserts, tables in key order (`tablesInKeyOrder`,
`src/data/postgres/load.ts`, shared with the loader); (3) the other updates. The contract suite runs every command family
on both adapters, so an order this misses shows as a difference there.

**F9. An update must not write a row's time column back (Q3).** `apply`'s update writes the whole row; the domain holds
`created_at` in milliseconds (the pool's parser truncates, `config.ts`), so writing it back would wipe the stored
place's microseconds and move the row in its millisecond. *Proposal:* updates never set the time column
(`created_at`, `added_at`, `occurred_at`, `changed_at`); an undo that brings back a removed link row inserts it with its
image's time (milliseconds) and a place by its position in the write set, like any insert.

**F10. Link rows have no version: a whole-row compare (Q1).** The local adapter checks a link row's update or remove by
comparing the stored row with the write's `before` as JSON (`applyWrite`, `store.ts:382`). On Postgres the same compare
is `where` every column equals the `before`, with timestamps compared in milliseconds and `jsonb` by value.

**F11. The import's review is built in the browser; only the request is large (PRD "The review's answer"; Q5).** The
wizard reads the file and plans against the page's own model in the browser (`import-wizard.tsx:15-19`, `buildPlan`);
the server answers only `ImportOutcome`, a summary of a few hundred bytes (`src/domain/commands/import.ts:65`). There is
no large answer to check. The one large message is the upload's request body (`POST /w/{ws}/import`, the text and the
choices, `import-wizard.tsx:122`).

**F12. The 4.5 MB limit binds less than the PRD assumes, and gzip may remove the need for Storage (Q5).** An import
takes at most 30,000 column rows (`MAX_IMPORT_ROWS`, `standard.ts:74`); the standard's rows are about 96 bytes
(`crm_snapshot_2026-10-20.csv`: 2,399 bytes, 25 rows). S30-05's 10,000 columns are about 1 MB and the cap about 3 MB:
**under 4.5 MB without any change**. Only large DDL scripts with comments (the 20 MB text limit) go over. The samples
compress 2.4 to 4.6 times with gzip even at 1 to 2 KB; repetitive catalogue files compress about 10 times. A browser can
gzip the body (`CompressionStream`, every current browser) and the route can inflate it with a 25 MB cap. Q5 has the
options; **L2**.

**F13. The smoke set also runs against the preview (Q10).** `playwright.pg.config.ts` runs against `dev:pg` or
`PG_BASE_URL=<preview>`, both on `infomapper-dev`. A smoke set with writes would write into the shared database there.
*Proposal:* the write specs run only against Supabase's local stack in CI (a guard in the config: writes need a
localhost database), and reseed there through the loader (`loadRows`, as the contract suite does); against the preview
and `dev:pg` only the read specs run, unless Łukasz runs the writes there by hand.

**F14. The prototype's "Not saved" text contradicts D-66 for fields (PRD "The save indicator"; Q6).** The prototype's
tooltip says "Your last change was not saved: the server did not answer. It was taken back here; make it again." and
the toast "…Your change was taken back." That is the canvas's optimistic writes (a move rolls back). A text field's
refused save keeps its draft (D-66), and most refusals are answers (stale, permission, archive), not silence. *Proposal:*
the tooltip by kind of failure, Q6.

**F15. "Add person" is not in the new prototype (PRD B5; S30-08).** The prototype has no "Add person" (its People tab
still shows its "Invite someone" box), so the disabled button and its explanation have no prototype to match; the
wording is to decide (**L6**). Changing a role and removing a person need no Auth account: they write `workspace_member`
(and, for a removal from the last workspace, `organization_member`) only (`changeRole`, `removePerson`, people.ts:189,
250).

**F16. The document editor shows two top bars in the app (Q6).** The prototype's editor is a full-screen overlay
(`#dedit`, `position:fixed`) that covers the main bar, so it has one pair (badge and indicator). The app's editor page
is inside `AppShell` (`src/modules/infodocumenter/app/pages.tsx:87`), with its own bar below
(`editor.tsx:364-407`). A pair in both bars would show twice on one page. *Proposal:* on the editor's page the main top
bar leaves the pair out (an `AppShell` prop) and the editor's bar shows it before its options panel's toggle.

**F17. The save indicator cannot read one place today (Q6).** `track` (`src/ui/leave-guard.ts:52`) counts what
`rowSaves` and the canvas's queue send, but not the outcome, and it has no subscription; about 80 `run(...)` calls in 33
files (creates, people, the working context, labels, InfoDocumenter's creates), seven direct canvas creates
(`ModelCanvas.tsx:1165, 1269, 1342, 2191`, `GroupActions.ts:524`, `useFrames.ts:657`, `useNotes.ts:365`) and the
import's `fetch` go round it. Nothing has a timeout. Q6 has the design; it touches the save chain and the canvas's
queue (shared infrastructure: a full run in step 4).

**F18. A long write holds an instance's connections (Q2, S30-05).** Every write locks its workspace row. While a large
import holds the lock, another save in that workspace waits **on a pool connection**; the pool has 5 per instance
(`pool.ts`), so five waiting saves on one instance stall that instance's reads of every workspace. *Proposal:*
`set local lock_timeout` in `apply` (a value from S30-05's figures, **L7**), whose refusal is the unexpected one, "The
workspace is busy saving a large change. Try again in a moment.", with the draft kept (its code `unexpected` keeps D-66's
draft editable). Measured in S30-05 as the PRD plans.

**F19. Things the PRD says already exist or are not needed.**
- InfoDocumenter has no count rule: AD-35's note lets it be turned off with documents (they are hidden). Only InfoCube's
  C-7 is counted.
- No write touches several workspaces: there is no workspace copy or transfer (`docs/known-limitations.md`, "A
  workspace's copy and transfer"). The only cross-workspace counts are the two people counts of F5 (the organization
  row, B4's order).
- The counts need no new index: `project_workspace_ix`, `workspace_member`'s key and `workspace_member_user_ix`,
  `project_canvas`'s key and `project_canvas_canvas_ix`, `entity_workspace_ix` cover them.
- A store revision is not needed now (Q8).

---

## Q1. Writes in `apply`

**Where:** `src/data/postgres/write.ts` (new), called by `store.ts`'s `apply`. Every write already goes through
`apply`: `run-command.ts:102` and `:143`, `undo.ts:89` (and the script `seed-large-changes.ts`, local only).

**One transaction per write set** (`begin` … `commit`, READ COMMITTED; the default), on one pool client:
1. **Locks** (Q2): `select … for update` on the organization row when the write set needs it, then the workspace row
   (or, for a workspace's create, only the organization row: the workspace does not exist yet). `set local lock_timeout`
   (F18).
2. **The access read again** (F7): the actor's `workspace_member.role` (or `organization_member.role`) and
   `workspace.archived_at`, compared with what the command checked.
3. **The rows, in phases** (F8), one statement per table and phase, the rows as JSON through `json_populate_recordset`
   (one parameter, the loader's way, any number of rows; portable SQL that converts the types):
   - inserts: `insert into t select * from json_populate_recordset(null::t, $1)`, with each row's time column stamped
     with its place (the loader's `stampPlaces`, shared);
   - updates of versioned rows: `update t set … from json_populate_recordset(…) v where t.id = v.id and t.version =
     v.version - 1 returning t.id`; fewer rows returned than sent means a stale version or a missing row: one more
     `select id` tells them apart (`stale_version` or `not_found`, the local adapter's codes and messages);
   - link rows (F10): a whole-row compare in the `where`;
   - the time column is never in an update's `set` (F9).
4. **The change events** in one insert, `occurred_at` stamped by place (Q3), `context_label_id` as written.
5. **The history** (F4): `undo_step` rows.
6. **The counts** (F5, F6), only those the write set needs.
7. **Commit.**

**Errors to the local adapter's refusals:** Postgres's `23505` (unique) → `conflict` "This already exists ({table}:
{detail})."; `23503` (foreign key) → `not_found` "This refers to something that does not exist (…)."; `23514` (check)
→ `invalid` "A data rule was broken (…).", as `violationError` (`store.ts:389`). The message's detail differs (the
constraint's name against the local rule's): the contract suite compares the code and the message's first sentence.
Anything else rolls back and throws; `runCommand` answers "Something went wrong. Nothing was saved." (`run-command.ts:121`).

**What is shared, so no rule is copied:** `tablesInKeyOrder`, `stampPlaces`, `timeColumnOf` (`load.ts`, `tables.ts`),
the count rules (F5, `src/domain/model/count-rules.ts`), the history's pure changes (`recordChange`, `afterUndo`,
`afterRedo`, `undo-history.ts`), the error messages (from `store.ts` into `src/data/rows.ts`). Each adapter keeps only
how it stores.

**Batching for an import:** five to eight statements whatever the row count (source tables, columns, relationships and
their columns, classification links, mapping updates, changes to resolve, the import, its events). A 20,000-row JSON
parameter is about 10 MB to the pooler; the pooler and Postgres take it (no documented limit below 1 GB for a
parameter), and S30-05 measures it. An insert of more than about 10,000 rows may be cut into statements of 5,000 if the
measurement says so.

**The 4.5 MB request limit for other writes:** server actions take 1 MB (Next.js's default `bodySizeLimit`, unchanged
in `next.config.ts`; "the maximum size of the request body sent to a Server Action is 1MB",
[serverActions](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions)), below Vercel's "4.5 MB"
for "the request body or the response body" ([limitations](https://vercel.com/docs/functions/limitations)), so only
the import route is affected (F11). The response limit "doesn't apply to streamed responses" (same page); whether a
server action's RSC answer counts as streamed is still not documented (slice 29's known limitation on the editor's
snapshot stays).

**Timeouts.** The app connects as `postgres` through the pooler; Supabase caps it at the global 2 minutes
([timeouts](https://supabase.com/docs/guides/database/postgres/timeouts)), and a session-level `statement_timeout`
"cannot be used … with Supavisor in Transaction mode" (same page), so `apply` sets `set local statement_timeout` and
`lock_timeout` inside its transaction (`SET LOCAL` is not named there; it lasts only for the transaction, so it should
work: checked first in step 2).

## Q2. The lock and the counts

**B4's order, by kind of write** (the rule is pure: from the write set, `src/domain/model/count-rules.ts`):

| Kind of write | Locks | Counts after the rows |
| --- | --- | --- |
| Every write in a workspace (model, layout, labels, notes, requirements, settings, documents, modules, undo, redo) | the workspace row | only the counts its writes can break |
| Deleting a project, an undo or redo that deletes one | the workspace row | `last_project` |
| Removing a canvas from a project, deleting a canvas, deleting a project, an undo or redo touching `project_canvas` | the workspace row | `canvas_links` (each touched canvas keeps a project, each touched live project a canvas) |
| InfoCube's switch; creating, pasting, undoing or redoing an entity | the workspace row | `infocube_off` |
| Changing a role | the workspace row | `last_owner` |
| Removing a person | **the organization row, then the workspace row** | `last_owner`, `org_owner_workspace`, `org_membership` |
| Creating a workspace (top bar) | the organization row | none |
| Changing the organization's password (local adapter only; D-58's note) | the organization row | none |
| Creating an organization (local adapter only) | none (new rows) | none |

**Which writes need the organization row** is decided before locking, from the write set alone (a `workspace_member`
removal, an `organization_member` write, a workspace insert), so the order is always organization, then workspace.

**The queries** (after the rows, in the transaction):
- `last_owner`: `select 1 from workspace_member where workspace_id = $1 having count(*) > 0 and count(*) filter (where
  role = 'owner') = 0` → "{workspace} needs at least one owner." (`LAST_OWNER`).
- `last_project`: `select not exists (select 1 from project where workspace_id = $1 and deleted_at is null)` →
  `LAST_PROJECT_MESSAGE`.
- `infocube_off`: the workspace's `infocube` and `select count(*) from entity where workspace_id = $1 and deleted_at
  is null and model_level = 'dimensional'` → `turnOffRefusedMessage(n)` or `INFOCUBE_OFF_MESSAGE`, as
  `offWithDimensional`.
- `canvas_links`: for each touched live canvas, a link to a live project; for each touched live project, a link to a
  live canvas → the commands' messages ("A canvas belongs to at least one project.", "This project would have no canvas
  left.").
- `org_owner_workspace`: a person whose `organization_member.role` is `owner` has a `workspace_member` row in a live
  workspace of that organization → "{person} owns {organization}, so they keep at least one workspace there."
- `org_membership`: a person with an `admin` or `member` row and no workspace left there → that row goes in the same
  write (or the write is refused with the stale refusal, so it is built again from fresh data; to decide in step 2,
  the simpler one).

**Concurrency:** every write in a workspace waits for the one before it, so a count sees the other's rows once it has
the lock (READ COMMITTED reads the newest committed rows in each statement after the lock; a `for update` that waited
locks "the updated version of the row",
[transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html)). **The transaction pooler:**
"Transaction mode returns your connection to the pool after each transaction" and loses "session-level advisory locks"
([connecting](https://supabase.com/docs/guides/database/connecting-to-postgres)); a row lock inside `begin` … `commit`
is not named, but one transaction keeps one server connection, so it holds (inferred; step 2's first concurrency test on
the CI container shows the rule, and one probe on `infomapper-dev` before the preview's acceptance, read only apart from
a lock released by rollback, on Łukasz's OK). No advisory locks (they would be session state). `for no key update`
serialises the writes the same way and does not block foreign key checks of a script's inserts; proposed instead of
`for update`.

## Q3. The order (round 1)

**Only inserts crowd a millisecond.** Every row of a write set shares `ctx.now` (`run-command.ts:82`, `undo.ts:82`);
updates (soft deletes, cascades, a mapping sent back to review, settles, `followOriginals`, a look on all canvases) keep
their time column (F9), so only a write set's inserts and their change events take places.

**Round 1's assumption holds within one write set.** `uuidv7` is strictly increasing within one process, borrowing the
next millisecond on overflow (`src/domain/ids.ts:19-31`); `buildWriteSet` makes the change events' ids after the rows'
(`changes.ts:115-131`), and the rebuilt write sets (`withModuleCascades`, `withSettledChanges`, `completeLiveWrites`)
call it again over the joined writes. Every table checked below makes its ids in the order it writes them, so past the
999th place the key gives the same order. **Where it does not hold:**
1. **The seed's ids** are SHA-1 hashes and fixed constants (`seedId`, `seed-model.ts:82-86`; `SEED_IDS`, `LARGE_IDS`)
   and a workspace's rows share one time (`seed-large.ts:72`): past the 999th they come back in hash order (the known
   L9 case; slice C's copy of KB has the same shape). Proposal: the loader gives each crowded millisecond's overflow the
   next millisecond (`stampPlaces`), as `uuidv7` does; the domain reads milliseconds only, so a seed row's time moves by
   at most a few ms. **L8.**
2. **Two write sets in one millisecond** (two people, two instances): each stamps its places from 0, so their rows
   interleave by id; the local adapter keeps commit order. Only the reads marked below care, and they get their own sort.
3. **Undo inserts a removed link row again with its original key and time** (`undo.ts:433-436`): `project_canvas` goes
   back to its old place on Postgres and to the end of the file locally. Its one read sorts by `sort_order`, then
   `added_at` (`byTabOrder`), so only a full tie differs. Proposal: the tie broken by `canvas_id`.

**Tables one write set can fill with more than 1,000 rows, and their reads:**

| Table | Which write | Reads in the stored order | Matters? | Sort |
| --- | --- | --- | --- | --- |
| `source_column` | an import (20,000 in the benches, `commands/import.ts:140`) | `workspaceModelOf` sorts by table, `ordinal` (`workspace-model.ts:76`) | ties only | add `name`, then `id` |
| `source_table` | an import with over 1,000 new tables | sorted by `name` (`:75`) | ties: one name in two schemas or systems (Model tab, documents) | `name`, `database_name`, `schema_name`, `id` |
| `source_relationship` | an import | **unsorted** (`:80`): parallel source lines' offsets (`line-data.ts:172-178`), the table panel's list (`model-index.ts:41-44`, `source-panels.tsx:77, 174`), the Data Vault reading's name ties (`data-vault-reading.ts:51`) | **yes** | the lines `(created_at, id)`; the lists `name`, then `id` |
| `source_relationship_column` | an import | `sort_order` (`:78`) | no | – |
| `classification_link` | an import (file classes and ticked hints) | unsorted (`:86`), but every use sorts (`byListOrder`, `classifications.ts:303`) or counts | no | – |
| `source_change` | an import | `oldestChangeFirst` (`order.ts:10`), with an id tie-break | no | – |
| `canvas_item`, `frame` | `duplicateCanvas` (`canvas.ts:319-341`), `openLiveCanvas` on a large label (`live.ts:387-402`) | the ports, unsorted: **the drawing order** (which card is on top); `buildCards` sorts by kind only, stable (`card-data.ts:334`) | **yes** | `(created_at, id)` in the domain |
| `requirement_link` | "Link all attributes…" over 1,000 attributes (`requirement.ts:342-361`) | the link guards, then lists by requirement | no (sets) | – |
| `attribute`, `cube_mapping`, `cube_mapping_input` | "Create dimension from this…" on over 1,000 attributes (`infocube/domain/mappings.ts:764-789`) | `attribute`: entity, `sort_order` (`:72`); the cube tables are indexed by id | no | – |
| `change_event` | every large group (an import, a large delete with its cascades, a project's delete, a classification removed from 2,000 columns, a look on all canvases, their undo and redo) | `list`, `listForMapping`, `listForRequirement` "oldest first": four-eyes' `lastContentEditor` (`mapping-rules.ts:56-63`) and `lastRequirementEditor` (`requirements.ts:512-521`); within one group every event has the same person, so the result is the same; two groups of two people in one millisecond tie (C2) | **yes, across groups** | `(occurred_at, change_group_id, id)`, and the later group by commit: the history reads below |
| `change_event` of one group (Q4's history read) | – | `revertChangeGroup` walks the events in reverse (`undo.ts:409`); no command writes one key twice in a group, so the rows are the same in any order; `changeLabel` takes the first of a table (`change-label.ts:96-255`) | the step's name could change | read a group's events `order by occurred_at, id` |

`relationship` (between entities) is read unsorted too (`:73`, the parallel lines' offsets), but nothing inserts 1,000
at once. `project_pinned_label` is read as a set. **The explicit sorts go into the domain** (`workspaceModelOf`, the
cards' order), so both adapters give the same order without relying on the stored one; step 2's contract cases check
each. The tie between two groups of two people in one millisecond (four-eyes' author) is accepted: it needs two people's
writes within one millisecond, and the rule then names one of them (**L8**).

## Q4. Undo

**How it works today.** Per person and workspace, in the server's memory (`src/data/local/store.ts:34`, on
`globalThis`): `undo` and `redo`, oldest first, each step `{ changeGroupId, label, events }`
(`undo-history.ts`). A new step: `recordChange` (the last 50, the redo list emptied), after `apply`
(`run-command.ts:258`), only for undoable writes (`isUndoable`: not settings, people or a look). Undo: the next step's
events are reverted (`revertChangeGroup`, F1), the revert's change group goes to `redo` (`afterUndo`); redo the other
way (`afterRedo`), so redo reverts the undo's group. A refused step (`conflict`, or `stale_version`, `conflict`,
`not_found` from `apply`) is dropped with its toast, and the next Ctrl+Z goes further back; other refusals (archive,
role) keep it (`undo.ts:77-91`). A project's delete is one step like any other (D-65). Steps whose change group is no
longer in the change log are left out (`withKnown`, `store.ts:58`; after a reseed).

**`undo_step`, the final shape (proposal):**

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `workspace_id` | uuid | no | PK part, FK `workspace` |
| `user_id` | uuid | no | PK part, FK `app_user` |
| `list` | text | no | PK part; `undo`, `redo` (CHECK) |
| `position` | integer | no | PK part; grows within a list; the next step is the highest |
| `change_group_id` | uuid | no | the group to revert; unique per workspace (one list at a time) |
| `label` | text | no | the toasts' name of the step (F3) |
| `created_at` | timestamptz | no | |

No `version`, no change event, no `deleted_at` (a step leaves by a hard delete, as a history is not model data; the
first hard delete outside a workspace's own delete, AD-09: **L3**). RLS enabled. Its events are read by
`change_group_id` from `change_event` (indexed). At most 50 per list: the oldest deleted in the same transaction. Outside
the model: the table registry gets a class for it (not undoable, not a module), the guard test knows it, the local
adapter's file gets no table (Q4 (a)).

**The port** (F3, F4): `state`, `next`, `drop` (atomic compare), and the history change as `apply`'s argument.

**The local adapter: (a), recommended.** It keeps its history in memory, the port's behaviour the same within one
server's life; no format change (which on KB happens only in Łukasz's manual acceptance). (b) would put 50 steps per
person into the JSON file with every write, for a development adapter. Its known limitation stays, for the local
adapter only.

**What does not change:** each person undoes only their own steps (`revertChangeGroup` refuses another's,
undo.ts:396); the refusals and their texts; the 50 (D-59, Łukasz).

## Q5. Imports through Storage

**What the platform's documents say** (checked 19 November 2026):
- A signed upload URL needs **insert on `storage.objects`**, not the service role: "`objects` table permissions:
  `insert`" ([Python reference](https://supabase.com/docs/reference/python/storage-from-createsigneduploadurl); the JS
  page does not list the permissions). Without a policy Storage takes no upload ("By default Storage does not allow any
  uploads to buckets without RLS policies", [access control](https://supabase.com/docs/guides/storage/security/access-control));
  a service key "entirely bypass[es] RLS policies" (same page).
- The URL is "valid for 2 hours"
  ([createSignedUploadUrl](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl)); no
  documented option shortens it.
- A plain `PUT` to the URL without the Supabase client is **not documented**; storage-js's source sends `PUT
  /storage/v1/object/upload/sign/{bucket}/{path}?token=…` with `content-type` and `x-upsert`. CORS for a browser's
  direct upload is not documented either (community reports of preflight errors).
- Standard uploads are "ideal for small files that are not larger than 6MB"; above it TUS is recommended
  ([standard uploads](https://supabase.com/docs/guides/storage/uploads/standard-uploads)). Pro allows a global file limit
  up to 500 GB ([file limits](https://supabase.com/docs/guides/storage/uploads/file-limits)).
- **Storage with the Data API off: not documented.** The hardening page says only that "none of the auto-generated REST
  endpoints respond" ([hardening the Data API](https://supabase.com/docs/guides/api/hardening-data-api)); Storage is its
  own service, so it most likely keeps working, unconfirmed.
- The new keys: a secret key acts as `service_role` (BYPASSRLS) and "doesn't work in a browser"; a publishable key with
  a user's JWT acts as `authenticated` ([API keys](https://supabase.com/docs/guides/api/api-keys)). The page does not
  name Storage.
- A bucket is made by SQL (`insert into storage.buckets`), the dashboard or `createBucket`; locally by `config.toml`'s
  `[storage.buckets.<name>]` ([creating buckets](https://supabase.com/docs/guides/storage/buckets/creating-buckets),
  [CLI config](https://supabase.com/docs/guides/local-development/cli/config)). The smoke job excludes `storage-api`
  today (`schema.yml:80`); it would start it.

**The options** (after F11 and F12: only the request is large, and only DDL scripts above about 4 MB reach the limit):

| Option | What it costs | Risk |
| --- | --- | --- |
| (a) The person's session, a Storage policy on their own folder (`auth.uid()` as the first path part: insert, select, delete) | three Supabase-only policies outside the portable migrations (AD-18 allows them there); the server makes the upload URL with the person's token, the browser `PUT`s (undocumented without the client; CORS to check), the server reads the file with the person's token and deletes it after the import; Storage in the smoke's local stack (about a minute more a run); the bucket in `infomapper-dev` (a script, or the dashboard by Łukasz) | Storage with the Data API off unconfirmed; a policy is the first non-deny RLS rule, for the `authenticated` role on `storage.objects` only (B2 says the core tables) |
| (b) The secret key on Vercel | the least code (upload URL and read by the service role) | changes the rule that the secret key is the accounts script's only; a leaked server variable gives the whole project (Auth admin, every table) |
| (c) No Storage, the file in parts under 4.5 MB | parts must be put together across requests and instances: a table of parts in the database (a write outside commands) | the most code, for the rare case |
| **(d) No Storage: the browser gzips the body** (`CompressionStream`), the route inflates it (`zlib`, capped at today's 25 MB, so a small body cannot expand without limit) | about 30 lines in `import-wizard.tsx` and the route; the 4.5 MB checked on the compressed body, with today's "too large" message | a DDL script that is still over 4.5 MB compressed (over about 20 MB of text, the text limit) is refused, as today's 25 MB is; Storage stays an option for later |

**Recommendation: (d).** It keeps every rule (no secret on Vercel, no Storage policy, no bucket, no new service in CI),
S30-04 and S30-05 work (a 10,000-column file is about 1 MB, the 30,000-row cap about 3 MB before compression), and the
local adapter takes the same compressed body. It changes the PRD's "imports through Storage" (B1's wording, AD-31's
proposed amendment): **L2**. If Łukasz keeps Storage: (a), after a check on a scratch project that Storage answers with
the Data API off.

**The answer's size, the duration, the files:** the review's answer is the browser's own (F11), the import's answer a
summary. A 20,000-column import's write is a few statements (Q1); the route's default 300 s on Pro
([duration](https://vercel.com/docs/functions/configuring-functions/duration)) is set explicitly with `export const
maxDuration = 300` in the import route, measured in S30-05. Under (a) the file is deleted by the server after the
import, success or refusal (nothing in the model points to it; `source_import.source_label` keeps its name).

## Q6. The screen

**What the app has for the save state** (F17): `track` and `savesOnTheWay` (`src/ui/leave-guard.ts:52, 69`; e2e's
`window.__imSavesOnTheWay`, `src/ui/save-hook.tsx`) count what `rowSaves` (`saveRow`, `saveRows`, `exclusive`: undo
and redo) and the canvas's queue (`enqueue`, `enqueueGroup`, `ModelCanvas.tsx:703, 713`) send; outcomes are known per
call (`SaveOutcome`, `src/ui/row-saves.ts:24`; `CanvasSave`, `save-cuts.ts:21`), but nothing gathers them. The toasts
(`src/ui/components/toast.tsx`) and D-66's marks (`DraftLine`, the note's `.nt-mark`) stay as they are.

**Proposal: one store, `src/ui/save-state.ts`** (`subscribe`, `getSnapshot`, read with `useSyncExternalStore` by
`SaveIndicator`; nothing above the canvas re-renders but the indicator, and it reads no layout):
- `report(promise, outcomeOf)`: counts the write on its way; on settle, `ok` or not by the result (`ok: false` with any
  code but `cut` is a failure; a thrown promise is a failure);
- called by `track` (kept for the leave guard: creates still do not hold it, slice 14b), by `run` in `use-action.ts:38`
  (only where it is not inside `saveRow`, so a write counts once), by the seven direct canvas creates and by the
  import's `fetch`; the canvas queue's writes resolve to their `CanvasSave` or `ok` so the queue can report;
- "no answer": a write still on its way after 30 s shows "Not saved" (**L5**), which turns back into "Saved" if its answer
  comes and succeeds.

**Which writes it follows:** every write the page sends (the PRD's list); not the reads called as actions (impact
previews, the bus matrix, the editor's snapshot, the checks) and not `storeView` (local storage).

**The texts** (the prototype's, F14 adapted):
- "Saving…"; "Saved" with a check, fully visible about 1.8 s, then a 0.6 s fade (the prototype's 450 ms delay before
  "Saved" is its simulation: in the app "Saved" shows when the answer comes);
- "Not saved" with a warning triangle, `--im-warn`, `font-weight:500`, until the next successful save; its tooltip by
  kind:
  - a refusal with a draft kept (stale, cut, permission, archive, locked): "Your last change was not saved: {the
    refusal's message} Your text is kept where you typed it.";
  - a refusal of a canvas change (a move, a resize, a create): "Your last change was not saved: {message} It was taken
    back here; make it again.";
  - no answer or a thrown action: the prototype's "Your last change was not saved: the server did not answer. It was taken
    back here; make it again. If this repeats, check your connection and reload the page." where the change rolled back,
    and "…Your text is kept where you typed it. If this repeats, …" for a field.
  The toasts stay as today (one per refusal); the prototype's own toast "Not saved: the server did not answer. Your change
  was taken back." only for the no-answer case. **L5.**
- `role="status"` and `aria-live="polite"` as the prototype.

**The badge:** "Local" / "Online · dev" (short "dev" up to 1,500 px), its dot `--im-ink-3`, `.dev` the physical
colour; tooltips the prototype's: "Local server: changes are saved in a file on this computer (development and the
demo)." and "Online, development server: changes are saved in the database infomapper-dev, for everyone in this
workspace. Not production."

**The top bar's room, the prototype against the app** (`top-bar.tsx`, the canvas page's tools
`c/[canvasId]/page.tsx:431-454`, `src/canvas/more-breakpoints.ts`):

| Rule | Prototype (new) | App today | Change |
| --- | --- | --- | --- |
| Labels of Hand, Entity, Note, Frame | hidden up to 2,100 px | hidden up to 1,880 px (`min-[1881px]:inline`, `HandToolButton.tsx:30` and the three others) | the four to `min-[2101px]:inline` |
| Focus, Changes, the working context's label | hidden up to 1,880 px | the same | none |
| Brand | hidden up to 1,600 px | hidden up to 1,300 px (`top-bar.tsx:41`) | `max-[1601px]:hidden` |
| Path names | 260 → 150 (2,100) → 128 (1,500) → 110 (1,300), min 56 | 260 → 150 → 110, min 52 (`top-bar.tsx:67`) | the 1,500 step (128 px) and min 56: an older difference, **not** from this change; proposed with it as it is the room the badge needs |
| The user's role label | hidden up to 1,500 px | always shown | an older difference too; proposed with it |
| Badge's short label | "dev" up to 1,500 px | – | new |
| "More" (Focus and the notation up to 1,200, the four tools up to 1,100, the names' check boxes up to 1,300) | none (the prototype has no "More") | slice 6a, 11, 16 | stays; the app's rule comes first |

The pair sits after `bar-tools` and before the details panel's toggle (canvas and project pages), and before the user
indicator on the workspace pages, which have no toggle; `flex-none`, outside `bar-tools`'s shrink. S6A-10's rule
(nothing cut off from 800 to 2,560 px with both panels) is checked again with the pair's 66 + about 90 px.

**The document editor** (F16): the pair between Print and the options panel's toggle (`editor.tsx:403-406`); the main
top bar leaves it out on that page. Its `text-pages` is already a status region; the indicator is a second, polite one.

**The read-only pieces go** on Postgres (`readOnly` of the store, `roles.ts:17`'s text, the indicator's "Read only"
`top-bar.tsx:309`, the home's banner `w/[workspaceId]/page.tsx:134`, the editor's `badge-read-only` `editor.tsx:377`,
`READ_ONLY_SERVER_MESSAGE`): about 30 files read `readOnly` through the shell and the panels; the flag stays for the
archive and the role, only the store's part goes.

**"Add person"'s explanation** (F15): proposed "People are added by an administrator on this server for now." as the
button's tooltip and a line under the disabled button (the PRD's "On this server people are added by an administrator
for now." reads as well). **L6.**

## Q7. The badge's value

**Proposal:** the server says it in `ShellData` (`shell.ts`): `server: { kind: "local" } | { kind: "online", name }`,
from the adapter (`dataMode()`) and a plain variable `INFOMAPPER_SERVER_NAME` (`dev` on Vercel's Preview, in
`.env.postgres.local` for `dev:pg`; `.env.example` lists it without a value). On Postgres without the variable the badge
says "Online" alone. Not from Vercel's own `VERCEL_ENV` (it says "preview", not which database) nor from the connection
string (never read for display). `dev:pg` shows `Online · dev`, as it writes to the shared database (the PRD's
proposal, agreed). Production's name is slice D's.

## Q8. A store revision

**Not needed in this slice.** A late page is a page this browser asked for that arrives after a newer one; another
person's writes never send this browser a page (no polling, D-66), so several people do not make it more likely. Next.js
sends a page's server actions one at a time (known-limitations.md, "The change-to-resolve actions…"), and each answer
renders after its own commit, on Postgres without read replicas, so it sees its own write. What several people do add:
a page's 30 to 50 port calls are separate reads, so one page may show another person's write half (a card's name before
and its row after). The next fresh page shows it whole; a store revision would not change that. *Proposal:* no store
revision; S30-01's two-browser test shows the second person's view after a reload, which is what D-66 promises.

## Q9. Sessions during writes

The proxy refreshes an expiring token before the request reaches the action (`src/proxy.ts:45-63`); the action then runs
with the fresh claims and writes as usual. The answer carries `Set-Cookie`, so Next.js refreshes the page, as a write's
`revalidatePath` does anyway. For the save indicator the action resolves normally: "Saved". D-66's drafts survive any
fresh page (a stored value never replaces a draft or a focused field). A **failed** refresh (token revoked, Auth down)
makes `getClaims` fail: the proxy redirects, and the action's call rejects in the browser, caught as "unexpected" by
`run` and the canvas sites (`use-action.ts:45`, F17's list), so the draft is kept editable and the indicator shows
"Not saved". *Proposal:* a smoke spec on the local stack with a short JWT expiry (`supabase/config.toml`'s
`[auth] jwt_expiry`, if the local stack takes a short value, to try in step 4) saves across a refresh. Not a blocker.

## Q10. Tests

- **The contract suite** (`tests/contract/writes.test.ts`, new, beside `reads.test.ts`): the same rows on both adapters
  (the loader on Postgres, a temporary file locally), then one case per command family through the domain command and
  `apply` (model, sources, mappings, requirements, working layer, projects and canvases, people, settings, documents,
  InfoCube, an import), undo and redo of each, every refusal kind (stale, not found, unique, foreign key, check, the six
  counts); after each, every read of `reads.test.ts` compared. The write tests of the seven files slice 29 kept local
  (`store`, `model-store`, `live-store`, `organization-store`, `requirement-store`, `working-layer-store`,
  `infodocumenter-store`) move where they test the port (each case listed in step 2's report); the file-format tests stay.
- **Concurrency** (Postgres only, the Schema workflow's container): two pools, a barrier (both transactions hold their
  reads, then both call `apply`), for each of the six counts and for the same row saved twice with one version; at most
  one succeeds, the other gets the message, and the data keeps the thing counted. Plus a deadlock probe (the
  organization row and the workspace row from two kinds of write at once).
- **The smoke set** (F13): writes on Supabase's local stack only, reseeded by the loader before each write spec;
  S29-03 (the read-only refusal) is replaced by the write specs; S29-06's read-only expectations change.
- **e2e on the local adapter** (`e2e/slice-30/`): the badge `Local`, the indicator's three states (a held answer for
  "Saving…", `holdUntil`; a stale refusal for "Not saved"; the fade), in the top bar and the editor; the room rules at
  2,101/2,100, 1,601/1,600 and 1,501/1,500 px.
- **Earlier specs the steps touch:** S6A-01 to -04, -08, -10 (the top bar's widths), S6B-09, S11-screens, S12A-screens,
  S16's top bar (never scrolls, 1,201 px), S25-02 and S26-01 (the editor's bar), S29-03 and S29-06 (read-only), the
  element guard (MEASURE only: page totals change with the two elements), every spec that waits on
  `__imSavesOnTheWay` (`e2e/settle.ts`: unchanged if `track` stays its source).
- **Full runs:** steps 2, 3 and 4 touch shared infrastructure (the local adapter and the table registry; undo; the save
  chain and the canvas's queue), so each has one; step 5's on the final commit.

## Q11. The preview during the slice

| Option | What it costs | What it gives |
| --- | --- | --- |
| (a) The slice's branch deploys too, beside `dev` | `vercel.json`'s `deploymentEnabled` gets the branch (mine, in the repository); Łukasz adds the branch to the Ignored Build Step and adds the four variables a second time scoped to the branch (Vercel scopes a Preview variable to one branch); the same three removed at the closing | the measurement and the acceptance on the real preview before the merge; `dev`'s preview keeps deploying (its code still refuses writes); both on `infomapper-dev` |
| (b) `dev:pg` before the merge, the preview after | nothing to configure | the laptop's latency to Frankfurt (each statement a round trip from Poland), so S30-13's figures do not compare with slice 29's preview figures; the acceptance twice |
| (c) Merge first, accept on the preview after | nothing to configure | `dev` gets unaccepted code; every fix after it a `fix/` branch with its own full run |

**Recommendation: (a)**, as an addition rather than a switch, so `dev` never stops deploying and nothing has to be
switched back in a hurry. Care (AD-22's note): the project's bootstrap Production deployment stays. **L4.**

## Q12. Shared infrastructure and risks

- **Touched:** `apply` and the `DataStore` port (both adapters), undo and its history port (F3, F4), the change groups
  (unchanged in shape), the table registry (`undo_step`'s class), `getDataStore` (unchanged), the shell's read-only flag
  (the store's part goes), the save chain, `use-action.ts` and the canvas's queue (the indicator), the top bar.
- **The shared `infomapper-dev`:** from this slice the laptop's `dev:pg`, the branch's preview and `dev`'s preview write
  to one database; a `pg:seed -- --reset` empties every table, the histories included (slice C's guard comes later).
  The concurrency tests and the smoke's writes never reach it (F13).
- **Risks:** F8's statement order (the contract suite is the guard); F18's lock waits on 5 connections; the 10 MB JSON
  parameter of a large import (S30-05); Supavisor and `for update` (not documented, inferred, Q2).
- **What changes this plan:** F3/F4 (the history port), F5 (six counts on both adapters), F7 (the access passed to
  `apply`), F11/F12 (Storage may not be needed).

---

## The prototype against the app (what this slice touches)

The new prototype's diff (126 lines) is only this change: the indicator (`.savest`, NEW:878-895, markup NEW:1585), the
badge (`.srvb`), the room rules (NEW:888-892), the editor's pair (NEW:10209), the state machine `SAVE` (NEW:6466-6504)
and the user menu's "Prototype only" section (NEW:6521-6531, not built). Differences with the app:
1. The four tools' labels: 2,100 px in the prototype, 1,880 px in the app (Q6's table).
2. The brand: 1,600 px against 1,300 px.
3. Path names: the prototype's 1,500 px step and 56 px minimum (an older difference, already in the old prototype).
4. The user's role label hidden up to 1,500 px (older too).
5. The editor: an overlay with one bar in the prototype, a page with two bars in the app (F16); the prototype's
   "Generate version" button is not in the app (older).
6. "Add person": not in the prototype (F15); its "Invite someone" box is the people slice's.
7. "Not saved"'s texts assume a rollback (F14).
8. The app's "More" menu has no prototype counterpart (since slice 6a); its rules stay first.
9. The prototype's indicator never fails on Undo, Redo or the editor; in the app they can be refused, and the indicator
   follows them like any write.

## The acceptance criteria checked

| ID | Against the code | Change proposed |
| --- | --- | --- |
| S30-01 | the writes as Q1; a second person sees them after a reload (no polling, Q8) | none |
| S30-02 | needs F3 and F4; "a new deployment" is the stored history | none |
| S30-03 | the refusal is by content, not version (F1) | the test covers both cases |
| S30-04 | "through Storage" depends on L2 | "imports online" if (d) |
| S30-05 | 10,000 columns are about 1 MB, under 4.5 MB even without a change (F12); the lock's wait as F18 | none |
| S30-06 | D-66's line comes from the stale refusal and the fresh page, unchanged | none |
| S30-07 | six counts, not five (F5) | the tests name all six |
| S30-08 | "Add person" has no prototype (F15) | the wording by L6 |
| S30-09 | the editor's pair once (F16); the tooltips by kind (F14) | as L5 |
| S30-10 | the contract suite for writes and the concurrency tests (Q10) | none |
| S30-11 | Q3's table | none |
| S30-12 | the full run; KB untouched (no format change under Q4 (a)) | none |
| S30-13 | Undo includes `loadForUndo` (F2): its statements reported apart | none |
| S30-14 | under (d) no bucket; under (a) the bucket private and its three policies the only non-deny rules | by L2 |
| S30-15 | the earlier tests of Q10 | none |

**The decisions the PRD cites, checked:** B2 (rights in the domain) holds: every write passes a domain command
(`runCommand`, `undoAction`). B3 needs F7. B4's order holds, with counts after the rows (F6) and six counts (F5). B5
matches the code (`AddPersonBox`, `people.tsx:40`, shown only with `people.edit`, `page.tsx:293`). DB4's 50 is
`UNDO_LIMIT` (`undo-history.ts:9`). DB6's `pg` through the transaction pooler holds (Q2). Round 1's option B holds
within a write set (Q3), with L8's three points. D-65's personal history and a project's delete as one step hold (Q4).
AD-23 holds under (d) and (a); (b) keeps it too, but changes AD-04's note on the secret key.

## The plan for steps 2 to 5

**Step 2, the writes** (a full run: the local adapter and the table registry).
- `src/data/postgres/write.ts`: `apply` (Q1), the locks and the access (Q2, F7), the phases (F8), the time columns
  (F9, F10), the error mapping.
- `src/domain/model/count-rules.ts` (F5, F6), used by both adapters; the local adapter gets D-28's and the two people
  counts.
- The access passed from `runCommand` and `undoAction` (F7).
- The explicit sorts of Q3.
- Read-only gone on Postgres; "Add person" disabled there (B5, L6).
- `tests/contract/writes.test.ts` and the concurrency tests in the Schema workflow; the seven files' write tests moved.
- Earlier tests: `src/data/local/store.test.ts`, `tests/infocube-c7.test.ts`, `reads.test.ts`'s refusal case, S29-03,
  S29-06.
- The draft PR into `dev` (The slice cycle, 5).

**Step 3, lasting undo and imports** (a full run: undo).
- `undo_step`: migration, `data-model-v2.md` §10, the registry's class, the schema check (RLS).
- The history port (F3, F4) on both adapters; the pages' three lines; the local adapter (a).
- The import as L2 decides: gzip (and the route's inflate with its cap), or Storage (bucket, the key, the upload
  address, the server's read, the file deleted after the import).
- Earlier tests: the undo specs (slice 1b, 12a, 7a's import undo), `S7A-04-route`, the unit tests of the history.

**Step 4, the screen, the preview and the measurement** (a full run: the save chain and the canvas's queue). **Stop**
with the figures.
- `src/ui/save-state.ts`, `SaveIndicator`, the badge (Q7's `ShellData.server`), the top bar's room, the editor's bar.
- `e2e/slice-30/` (badge, indicator, room); the earlier specs of Q10.
- The smoke set with writes on the local stack (F13).
- The preview (L4); the measurement (S30-05, S30-13) in `docs/prd/slice-30-measurement.md`.

**Step 5, close.** The docs and the decisions quoted in full (PRD section 8, corrected below); one full run on the final
commit. Merge and tag only on Łukasz's command.

**Corrections to section 8's proposals:** AD-38's text says "the counts in the transaction, after the rows" and names
six counts; D-59's note names the history port; AD-12's note adds "an update never writes a row's time column"; D-84
includes the indicator's texts by kind (L5) and the editor's single bar (F16).

## Questions for Łukasz

- **L1 (F7).** Under the lock, refuse a write when the actor's role differs in any way from what the command checked
  (recommended: simple, a promotion meanwhile costs one save again), or only when the new role no longer allows it
  (needs each write's action in `apply`)?
- **L2 (Q5, F12).** The import's upload: gzip the request in the browser, no Storage (recommended), or Storage with the
  key from Q5's options?
- **L3 (Q4).** `undo_step` rows are hard-deleted when they leave the history (recommended; not model data), rather than
  soft-deleted?
- **L4 (Q11).** The preview: option (a), the branch deploying beside `dev` (recommended), (b) or (c)?
- **L5 (Q6, F14).** The indicator's tooltips by kind and the 30 s "no answer" limit, as proposed?
- **L6 (F15).** "Add person"'s wording: "People are added by an administrator on this server for now." or the PRD's?
- **L7 (F18).** A `lock_timeout` in `apply`, its value set after S30-05's figures, with the busy refusal as proposed?
- **L8 (Q3).** The explicit sorts in the domain as Q3's table lists them; the loader moving a crowded millisecond's
  overflow into the next millisecond (so seed rows keep their order); four-eyes' tie between two people's groups in one
  millisecond accepted?

### Łukasz's answers (19 November 2026)

All as step 1 recommended.

- **L1.** Decided: under the lock, a write is refused when the actor's role differs in any way from what the command
  checked (F7: `runCommand` passes the access it checked; `apply` compares).
- **L2.** Decided: (d), the browser gzips the import's request and the route inflates it, capped at today's 25 MB; no
  Storage. The PRD's "imports through Storage" is replaced by this everywhere (B1's wording and AD-31's proposed
  amendment at the closing). The import itself is step 3.
- **L3.** Decided: `undo_step` rows are hard-deleted when they leave the history (step 3).
- **L4.** Decided: (a), the slice's branch deploys beside `dev`. Łukasz sets Vercel up before step 4; `vercel.json`
  changes in step 4.
- **L5.** Decided: the indicator's tooltips by kind of failure and the 30 s "no answer" limit, as Q6 proposes (step 4).
- **L6.** Decided: "People are added by an administrator on this server for now." as the tooltip and the line under
  the disabled "Add person".
- **L7.** Decided: a `lock_timeout` in `apply` with the busy refusal as proposed; a provisional value in step 2, the
  final value after S30-05's figures.
- **L8.** Decided: the explicit sorts in the domain as Q3's table lists them; the loader moves a crowded millisecond's
  overflow into the next millisecond; two people's groups in one millisecond accepted (a known limitation at the
  closing).
- **Also decided:** F3 (the history port split, step 3), F5 (six counts as one pure rule in the domain, checked by both
  adapters), F6 (count after the rows), F8 (write phases), F9 (an update never writes a row's time column back), F13
  (write specs only on the local stack in CI, never against the preview), F16 (one pair in the editor, step 4), Q8 (no
  store revision).

---

## Step 2: the writes (19 November 2026)

### What was built

- **`apply` on Postgres** (`src/data/postgres/write.ts`): one transaction per write set on one connection, READ
  COMMITTED; `set local lock_timeout = '10s'` (L7, provisional); the organization's row `for update` when the write can
  break a count across workspaces (`needsOrganizationLock`: a `workspace_member` or `organization_member` write) or makes
  a workspace, then the workspace's row `for update`; the access read again (L1); the rows in three phases (F8: removes and
  soft deletes, inserts in the tables' key order, other updates), one statement per table and phase through
  `json_populate_recordset`, a key written twice in a later statement; versioned rows only from the version read, link and
  other unversioned rows only from the whole row read (times compared in milliseconds, F10); an update never sets the time
  column (F9); inserts and change events stamped by place (`stampPlaces`); a field no column holds refused loudly; the
  counts after the rows; the database's `23505`, `23503`, `23514`, `23502` mapped to the local adapter's refusals,
  `55P03` to the busy refusal.
- **The count rules** (`src/domain/commands/count-rules.ts`, F5, F6): `countChecks` (which checks a write set needs),
  `countRefusal` (the refusal on the state after the write), `needsOrganizationLock`; the six rules with the commands'
  messages (D-28's two now constants in `canvas.ts`). The local adapter's three recounts are replaced by it; Postgres
  reads, per check, only the rows it needs.
- **The access read again** (`src/domain/commands/access-check.ts`, `src/app/_lib/checked-access.ts`): `runCommand`
  builds the command with a store that records the workspace's archive, the actor's role and organization role as first
  read, and passes them to `apply` (`ApplyOptions.access`); `undoAction` passes its own. Any difference refuses: the role
  with "Your role in {workspace} changed meanwhile, so nothing was saved." (`forbidden`), archived meanwhile with the
  archive's refusal, unarchived meanwhile as stale, the workspace gone as not found. Both adapters check before the rows.
- **The explicit sorts** (Q3, L8): `byCreation` (`workspace-model.ts`) for relationships, source relationships, cards
  (`buildCards`) and frames (`buildFrames`); source tables by name, database, schema; source columns by ordinal, then
  name; `byTabOrder` ends with the canvas id; four-eyes' last editor by time, then the change group's id (`laterOrSame`,
  `mapping-rules.ts`); the table panel's relationship list by name.
- **The loader's overflow** (L8): `spreadCrowded` (`load.ts`) moves a crowded millisecond's rows past the 999th into the
  following milliseconds, 999 a millisecond (the loader counts place 999 as crowded); `apply` never moves a time.
- **Read-only gone on Postgres:** `DataStore.readOnly`, `ShellData.workspace.readOnly`, `READ_ONLY_SERVER_TEXT`,
  `READ_ONLY_SERVER_MESSAGE`, the home's `banner-read-only` and the indicator's "Read only" for the server are gone;
  standing, creates and switches follow the role and the archive only. `ShellData.server.kind` (`local` or `online`)
  keeps what online still lacks: no "New organization…" (D-58's note), "Add person" disabled.
- **"Add person" online** (B5, L6): the box shows, its Continue is disabled with "People are added by an administrator
  on this server for now." as its tooltip and as a line under it (`text-add-person-online`); both actions refuse online
  (`forbidden`, the same text).
- **Tests:** `tests/contract/writes.test.ts` (S30-10: a scenario of 25 steps on both adapters, answers and every read
  compared; S30-07: seven concurrency cases, on the local adapter in `npm test` and on Postgres in the Schema workflow,
  each from fresh rows); `tests/contract/shared.ts` (the rows, the reads and the Postgres preparation, moved from
  `reads.test.ts`); unit tests `count-rules.test.ts` and `access-check.test.ts`; the loader's overflow in
  `reads.test.ts`.

### Where step 2 differs from the plan, or assumed something

- **`count-rules.ts` is in `src/domain/commands/`, not `src/domain/model/`:** it uses the commands' messages
  (`LAST_OWNER`, `LAST_PROJECT_MESSAGE`, D-28's), which live there.
- **Creation order is `created_at` with a stable sort, not `(created_at, id)`:** the seed's rows share one time and their
  ids are hashes, so an id tie-break would reorder the demo's cards, frames and lines on both adapters (F2 of slice 29,
  where the same sort was tried and withdrawn). With the stable sort, ties keep the stored order, which is the file's
  locally and the write set's place on Postgres (and, past the 999th, the key: monotonic ids for the app's rows).
- **The busy refusal's code is `invalid`, not `unexpected`:** a store's refusal is a `DomainError`, whose codes have no
  `unexpected`. `invalid` behaves as Q6 proposed: the draft stays editable, nothing is cut, no fresh page; an undo keeps
  its step.
- **`org_membership`** refuses the racing removal as stale (it is built again from fresh data and then removes the
  organization row with the last workspace), rather than adding the row's removal inside the adapter.
- **`for update`, as the step asked**, not step 1's proposed `for no key update`.
- **No undo on Postgres until step 3:** its history is still empty there (`undoHistory.update` keeps nothing, `get`
  answers none), so Undo is off online and a recorded step is dropped. Before this step `update` threw (unreachable
  then).
- **The seven local test files were not moved:** their write tests drive the local file (its format, its stamp, its
  queue), so they stay; the contract suite covers the port's write behaviour on both adapters with its own cases.
- **Not checked on Supabase itself:** `set local lock_timeout` and `for update` through the transaction pooler. CI's
  Postgres is plain; the first write on the preview (step 4) shows them.
- **"Add person":** the inputs stay usable; only Continue (the start of an addition) is disabled.

### Earlier tests changed, with their reasons

- `src/data/local/store.test.ts`, "removes a link row with a null after image": it removed a link that left its project
  with no canvas, which D-28 forbids and the local adapter now refuses inside the write (F5); it removes a link whose
  project keeps another canvas.
- `tests/contract/reads.test.ts`: the read-only refusal case (S29-03) goes; the rows are spread as the loader spreads them
  (L8); the shared pieces moved to `shared.ts`.
- `e2e/slice-29/S29-03.spec.ts` removed (the read-only refusal no longer exists; step 4's smoke writes replace it, on the
  local stack only, F13).
- `e2e/slice-29/S29-06.spec.ts`: no "Read only", no banner, standing `full`, the new-project tile shown; it still only
  reads, so it can run against the preview.

### The branch's Preview variables (L4, for Łukasz before step 4; names only)

Step 1's report said four; there are five today, and step 4 adds a sixth:
- Secret: `INFOMAPPER_DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`;
- plain: `INFOMAPPER_DATA`, `INFOMAPPER_TIMING`, and from step 4 `INFOMAPPER_SERVER_NAME` (Q7).
Each scoped to `slice/30-database-writes`, beside the existing entries for `dev`.

### Checks (on `69168bf`)

- CI (`check`) and Schema (`migrations` with the contract suite on Postgres, 26 tests; `smoke`) passed.
- **The full run:** [run 44487217521](https://github.com/LukaszWolski-DA/infomapper-app/actions/runs/44487217521) on
  `69168bf`, which contains `dev`'s head (`6da6c05`): 839 passed, 0 failed, 0 flaky, 16 skipped; wall-clock 17 min
  14 s. Why: the step touches the local adapter (its write and its counts) and shared infrastructure (`apply`'s port,
  `runCommand`). Parts (time, heap peak): 1 9.2 min, 1,155 MB; 2 11.0 min, 1,024 MB; 3 6.7 min, 1,407 MB; 4 10.0 min,
  1,125 MB; 5 10.5 min, 1,223 MB; 6 9.5 min, 1,574 MB; 7 9.8 min, 1,121 MB; 8 6.8 min, 1,407 MB; 9 11.9 min, 1,602 MB.
  Later commits on the branch touch only `docs/` (`git diff --stat 69168bf..HEAD`).

---

## Step 3: lasting undo and the gzipped import (19 November 2026)

Step 2 accepted (Łukasz, 19 November 2026).

- **Q4.** Decided: (a), the local adapter keeps its undo history in memory; `undo_step` is on Postgres only.
- **The lock.** Decided: `for no key update` on the workspace's and the organization's rows, as step 1 proposed (step 2
  used `for update` because the step's prompt copied the PRD); the order stays the organization's row first.

### What was built

- **`undo_step`** (migration `20261119120000_undo_step.sql`, `data-model-v2.md` §10): Q4's table, key `(workspace_id,
  user_id, list, position)`, `list` CHECK `undo`/`redo`, a unique index on `(workspace_id, change_group_id)`, RLS
  enabled. **The registry's class:** `POSTGRES_ONLY_TABLES` (`src/data/postgres/undo-history.ts`), the store's own
  bookkeeping, outside the domain's tables, the local file and undo; the guard test leaves it out of the registry and
  the schema check reads its row type (`PostgresOnlyTables`) beside the domain's (44 tables, RLS on every one).
- **The history port** (F3, F4): `state` (two answers, no events; the three pages read only this), `next` (the step
  reverted next, its events read by its change group in their stored order), `drop` (only while it is still the next
  one). A step is recorded, undone or redone only through `apply`'s `history` (`HistoryChange`): on Postgres in the
  write's transaction under the workspace's lock (a new step empties the redo list; a list keeps its last 50, the oldest
  hard-deleted in the same transaction, L3); on the local adapter in its serialised write, in memory (Q4 (a)), by the
  same pure rule (`withChange`). `runCommand` and `undoAction` pass it; undo and redo are on again online.
- **The lock** is `for no key update` on both rows.
- **The import** (L2): the wizard gzips the review's input (`gzipJson`, `src/ui/import-upload.ts`) and refuses a body
  over 4,400,000 bytes before sending it; the route takes only `application/gzip`, refuses a compressed body over the
  same limit (413) and inflates with `maxOutputLength` 25 MB (413 past it), both with today's message; `maxDuration =
  300`. The same route and body on both adapters; the import is still one change group and one undo step.
- **Tests:** `writes.test.ts` gains the undo history on both adapters: S30-02 (two steps, a new process (on Postgres a new
  pool, locally a new store on the file), undo twice in reverse order, redo, a new step empties redo), the 50 steps (52
  recorded, 50 undone, the oldest two gone), S30-03's content case (another person's later change: refused with its
  message, nothing written) and its race (an undo and another write built from one read, at once: one stored, the other
  stale, nothing overwritten); `compare-schema.test.ts` reads `undo_step`'s type; `store.test.ts`'s history case uses
  the new port.

### Sizes (L2)

| File | Columns | Text | Upload body | Gzipped | Ratio |
| --- | --- | --- | --- | --- | --- |
| `crm_snapshot_2026-10-20.csv` (the largest sample) | 24 | 2,399 B | 2,760 B | 767 B | 3.6× |
| generated (`syntheticStandard`, 1,000 tables) | 10,000 | 769,075 B | 803,292 B | 82,224 B | 9.8× |

At that ratio the 4.4 MB limit holds about 43 MB of such text, so the 25 MB inflated cap binds first.

### Where step 3 differs from the plan, or assumed something

- **The local adapter's history test of a "new process"** is a new store on the same file in the same process: its
  history is in memory (Q4 (a)), so a real new process starts with none, as its known limitation says.
- **Plain JSON to the route is refused (415):** every body is gzipped now, the e2e specs' direct posts included.
- **`next` on Postgres drops a step whose change group has no events** (only after a reset that kept the steps, which
  `pg:seed -- --reset` does not: it empties every table), as the local adapter leaves such steps out.

### Earlier tests changed, with their reasons

- `src/data/local/store.test.ts`, "keeps a history per person and workspace…": the port's `update` and `get` are gone;
  the step is recorded with its write and read with `next` and `state`.
- `tests/contract/shared.ts`: reads `undoHistory.state` instead of `get`.
- `e2e/slice-07a/S7A-04-route.spec.ts`: posts gzipped JSON (`postImport`); the size case checks the inflated cap, a dense
  compressed body (413) and plain JSON (415).
- `e2e/slice-07a/S7A-14-counts.spec.ts`: posts gzipped JSON.
- `scripts/bench-import-write.ts`, `scripts/bench-thumbnails.ts`: the new port (benches, not tests).

### Checks (on `bedb0da`)

- CI (`check`) and Schema (`migrations`: the schema check with `undo_step`, 44 tables, RLS on every one, and the contract
  suite on Postgres, the undo history's four cases included; `smoke`) passed.
- **The full run:** [run 44500070325](https://github.com/LukaszWolski-DA/infomapper-app/actions/runs/44500070325) on
  `bedb0da`, which contains `dev`'s head (`6da6c05`): 839 passed, 0 failed, 0 flaky, 16 skipped; wall-clock 16 min
  38 s. Why: undo and its history, `runCommand` and the local adapter's write are shared infrastructure. Parts (time,
  heap peak): 1 7.8 min, 1,261 MB; 2 7.4 min, 1,382 MB; 3 9.8 min, 1,165 MB; 4 7.0 min, 1,193 MB; 5 8.3 min, 1,739 MB;
  6 13.5 min, 1,243 MB; 7 6.7 min, 1,392 MB; 8 8.2 min, 1,335 MB; 9 13.9 min, 1,407 MB. Later commits touch only
  `docs/`.

---

## Step 4: the screen, the check on dev:pg, the measurement prepared (19 November 2026)

Step 3 accepted (Łukasz, 19 November 2026).

- **L4.** Decided, changed to (b): Łukasz's acceptance runs on `npm run dev:pg` on the laptop before the merge; the
  measurement (S30-05, S30-13) runs on `dev`'s preview after the merge. No `vercel.json` change; the Ignored Build Step
  stays on `dev` only (Łukasz set it back). After the merge Łukasz adds one plain Preview variable for `dev`:
  `INFOMAPPER_SERVER_NAME=dev`.
- **"Add person" online.** Decided: the whole box disabled (the fields too, not only Continue), with L6's line under
  it. Temporary: a known limitation that the people slice removes when it brings a working way to add people online.

### Step 3's question: the two timeouts and parts 6 and 9

**The two tests `bedb0da` gave a timeout** are Vitest unit tests (`npm test`, CI's `check`), not e2e specs: they are in
no full run. Both were new in step 3, so `dev`'s runs have neither.

| Test | CI `82ceaa4` | CI `bedb0da` | Schema `bedb0da` (Postgres) | The laptop, all 193 files at once |
| --- | --- | --- | --- | --- |
| `writes.test.ts`, "keeps the last 50 steps" (local adapter) | 3,665 ms | 2,669 ms | 2,182 ms (Postgres's own case) | 5,329 ms: over Vitest's 5 s |
| `compare-schema.test.ts`, "reads the tables only the Postgres adapter has" | 1,330 ms | 839 ms | – | 5,186 ms: over Vitest's 5 s |

**The cause:** the work each test does, on a laptop running 193 test files side by side. The first records 52 steps and
undoes 50, each a write that rewrites the local file of the demo and "Performance test" plus a `loadForUndo` read: about
100 file writes. The second builds a TypeScript program over `src/data/postgres/undo-history.ts` and its imports, as the
schema check does. Neither waits for anything: the timeout is Vitest's budget for a test's own work, so CLAUDE.md's rule
on waiting for a state (an e2e rule) is not touched. Alone on the laptop both run under 5 s.

**Parts 6 and 9 of 44500070325** are slower because their runners were, not the app. Every folder of a part moves
together (the tests' own durations, summed per folder from each run's `report.json`):

| Folder | 44343842242 (`dev`, chore/dev-branch) | 44398359250 (`dev`, fix/smoke-port) | 44487217521 (step 2) | 44500070325 (step 3) |
| --- | --- | --- | --- | --- |
| slice-10a | 174 s | 198 s | 180 s | 250 s |
| slice-10b | 46 | 52 | 48 | 66 |
| slice-10c | 66 | 71 | 65 | 92 |
| slice-11 | 58 | 63 | 57 | 85 |
| slice-12a | 75 | 77 | 70 | 102 |
| slice-12b | 39 | 39 | 38 | 56 |
| slice-13 | 91 | 99 | 84 | 124 |
| **part 6** | **549** | **599** | **542** | **775** |
| slice-22 to slice-28 (**part 9**) | **814** | **649** | **683** | **803** |

- Part 6's seven folders are all 30 to 45 % slower in 44500070325, among them slice-10b (source lines) and slice-12b
  (thumbnails), which use neither undo nor the import. In the same run, part 7's folders (slice-14a to slice-15d) are
  faster than in every other run. A whole part moving one way is the runner it got.
- Part 9 in 44500070325 equals `dev`'s run 44343842242 (803 s against 814 s); 44487217521 was the fast one.
- **The app did not become slower:** the folders that exercise undo, the history port and the import are as fast as on
  `dev` or faster in 44500070325: slice-01b (undo's first specs) 114 s against 129 and 140; slice-12a (the homes' Undo, a
  project's delete) 102 s, inside part 6's slowdown; slice-07a (the import through the gzipped route) 128 s against 134
  and 138.

### What was built

- **The save state** (`src/ui/save-state.ts`, Q6, L5): one store per tab; writes come in through `reportSave` where they
  leave the page: the save chain (`rowSaves.saveRows`, so every row's save, the canvas's look and the document editor's
  saves included), `useAction`'s `run` (creates and other writes; the five previews it reads are marked `read`), undo
  and redo, the canvas's action props (wrapped once in `ModelCanvas`, `reportedAll`) and the import's upload. "Saving…",
  "Saved" (1.8 s, then a 0.6 s fade), "Not saved" after a refusal (not a cut save), a thrown write or 30 s without an
  answer, until the next write starts; its tooltip by kind (`failureText`): a row's save "…{reason} A text you typed is
  kept in its field.", a canvas change "…{reason} It was taken back here; make it again.", another change "…Make it
  again.", no answer "…the server did not answer. … If this repeats, check your connection and reload the page.", and
  the busy refusal its own: "Your last change was not saved: The workspace is busy saving a large change. Try again in a
  moment." (`BUSY_MESSAGE`, now in `src/domain/errors.ts`).
- **The badge** (Q7): `ShellData.server` (`local`, or `online` with `INFOMAPPER_SERVER_NAME`); `Local`, `Online · dev`,
  `Online · {name}` or `Online`, the prototype's tooltips; up to 1,500 px the short label (`dev`). `.env.example` lists
  the variable.
- **The pair** (`src/app/_components/save-indicator.tsx`, `group-save`): in the top bar before the details panel's
  button (the user indicator where there is none); in the document editor's bar after Print, before its options
  panel's button, and not in the top bar above it (F16, `AppShell`'s `savePair`).
- **The room** (Q6's table): the Hand, Entity, Note and Frame labels from 2,101 px; the brand from 1,601 px; the path
  names' 1,500 px step (128 px) and 56 px minimum; the user's role label from 1,501 px.
- **"Add person" online:** every field and Continue disabled, L6's line under them, the actions refusing.
- **The timing record for writes** (S30-13, S30-05, `INFOMAPPER_TIMING=1` only): `apply` adds its lock wait and its
  transaction (`countWrite`); `runCommand`, `undoAction` and the import route log one line of numbers each
  (`timing {"route":"write"|"undo"|"redo"|"import",…}`); the import's answer carries `Server-Timing` (statements, wait,
  lock, apply, inflate, total); a `withTiming` inside another counts into the outer record.
- **The check script** `scripts/pg-lock-check.ts` (below) and **the measurement spec** `e2e/slice-29/S30-measure.spec.ts`.
- **Tests:** `src/ui/save-state.test.ts`; `e2e/slice-30/` (S30-09: the badge, the three states, the room; the editor's
  single pair); the smoke writes `e2e/slice-29/S30-smoke-writes.spec.ts` (a rename and an attribute stored and shown
  after a reload, Undo and Redo from a new session, the badge `Online`, "Add person" disabled), skipped unless the
  database is on this machine (F13): CI's local stack only.

### Where step 4 differs from the plan, or assumed something

- **"Not saved" until the next write starts, not until the next one succeeds:** the accepted prototype's `begin()` shows
  "Saving…" at the next write; a failing one shows "Not saved" again.
- **A row's save says "A text you typed is kept in its field."** rather than "Your text is kept where you typed it.":
  the save chain also carries switches (a canvas's look, a classification) that have no text.
- **The start page and the local "New organization…" dialog are not followed** (their own `run`; known limitation).
- **The smoke writes need no reseed:** each smoke job loads a fresh stack, and the read specs beside them count
  projects, canvases and cards, which the writes leave as they are.
- **`undo_step` is not yet on infomapper-dev:** `npm run pg:migrate` is the only way to migrate it and was not run in
  this step (step 2 of the manual acceptance below).

### Earlier tests changed, with their reasons

- `e2e/slice-06a/S6A-10.spec.ts`: the prototype's new steps (the brand from 1,601 px, Hand's label from 2,101 px) and the
  save pair among the controls always there (`group-save`).

### The check on dev:pg (19 November 2026)

- **The connection:** `npm run dev:pg` reads `INFOMAPPER_DATABASE_URL` from `.env.postgres.local`: a Supabase pooler host
  (`*.pooler.supabase.com`), port **6543**, the transaction pooler; the migration URL is the session pooler, port 5432.
  That is the kind and port slice 29 set for the preview's variable (Vercel keeps it write-only, so its value cannot be
  compared).
- **Through it**, `npx tsx scripts/pg-lock-check.ts` (the app's domain commands and the Postgres adapter's `apply`):

| Check | Time | Answer |
| --- | --- | --- |
| 1. One write (`for no key update`, `set local lock_timeout`) | 411 ms | stored |
| 2. A write while another session holds the workspace's row for 2 s | 2,297 ms | stored after the wait |
| 3. A write while another session holds it for 13 s (past 10 s) | 10,251 ms | refused: busy (`invalid`), the name unchanged |
| 4. Two sessions delete the workspace's last two projects at once | 701 ms | one stored, the other "A workspace needs at least one project."; one project left |

- **Written into infomapper-dev:** the workspace "Slice 30 lock check" in InfoMate (with its member, two projects, a
  canvas, the built-in classifications and stereotypes, and their change events), renamed and deleted as above, then
  soft-deleted: its rows stay, hidden everywhere (known limitation, "A check workspace in infomapper-dev"). Nothing else;
  no reset.

### The line for .env.postgres.local

`INFOMAPPER_SERVER_NAME=dev`

### The measurement, prepared (run on dev's preview after the merge)

`e2e/slice-29/S30-measure.spec.ts`, as S29-08: `MEASURE=1 PG_BASE_URL=<dev's preview> npx playwright test --config
playwright.pg.config.ts S30-measure`, with `INFOMAPPER_TIMING=1` on the preview.
- **S30-13:** per kind (a rename in the entity panel, an attribute added there, a card moved, Undo) 2 discarded and 10
  counted writes, from the action to the indicator's "Saved"; medians, with the refreshed page's statements
  (`im-timing`). The write's own split (statements, lock wait, transaction) from the server's `timing` log lines in
  Vercel's runtime logs.
- **S30-05:** a 10,000-column file (1,000 tables) through the wizard: the review (file to review shown), the import
  (click to toast) with the route's `Server-Timing`, and Anna's rename sent meanwhile in a second browser: its time and
  its answer.
- It writes into the demo's "Retail Co – DWH" and puts Product's and Customer's names back; the import's new system
  "Synth {time}" stays (Undo removes it). Results in `.data/measure/s30/`; the report goes to
  `docs/prd/slice-30-measurement.md`.

### Łukasz's manual acceptance on dev:pg

Before: stop `npm run dev` (it uses port 3000 too). The two demo people are **Łukasz** and **Anna Nowak** (their demo
addresses are in `e2e/slice-29/helpers.ts`, `PEOPLE`; the password is `INFOMAPPER_DEMO_PASSWORD` in
`.env.postgres.local`). Browser 1 is your usual one, browser 2 another browser or a private window. Everything happens in
the demo's "Retail Co – DWH", never KB.

1. Add the line `INFOMAPPER_SERVER_NAME=dev` to `.env.postgres.local`.
2. `npm run pg:migrate -- --dry-run`: it lists `20261119120000_undo_step.sql` only. Then `npm run pg:migrate`.
3. `npm run dev:pg`, and open http://localhost:3000 in both browsers.
4. **S30-09 (badge).** Browser 1: sign in as Łukasz, open "Retail Co – DWH", its first project, its first canvas. The top
   bar's right corner shows the badge `Online · dev` before the details panel's button; its tooltip: "Online,
   development server: changes are saved in the database infomapper-dev, for everyone in this workspace. Not
   production." Make the window narrower than 1,500 px: the badge says `dev`.
5. **S30-08.** The user indicator shows your role ("Owner"), not "Read only"; the workspace home has no read-only banner;
   the canvas's tools and creates are there. On the workspace home, People tab: "Add a person" is shown, its fields and
   Continue disabled, with "People are added by an administrator on this server for now." under them.
6. **S30-01 and S30-09 (indicator).** Browser 1, the canvas: in the Model tab open Product; rename it to "Product A"
   (Enter). The indicator shows "Saving…", then "✓ Saved", which fades after about 2 s. Click "Add attribute" in its
   panel: a new attribute. Place a new entity with the Entity tool (pick a concept), and drag a column of a source table
   onto one of its attributes (a mapping). Each shows "Saving…" and "Saved". Reload: all of it is there.
7. **S30-01 (second person).** Browser 2: sign in as Anna Nowak, open the same canvas: "Product A", the new entity and
   its mapping are there (a reload shows anything made after the page opened).
8. **S30-06.** Both browsers: open Product A's panel. Browser 2 (Anna): change its definition to "Anna's text", leave the
   field: "Saved". Browser 1 (Łukasz), without reloading: change the definition to "Łukasz's text", leave the field: the
   field shows "Changed meanwhile to: Anna's text" with "Use this" and "Keep mine"; the indicator says "Not saved" with
   the reason in its tooltip. Click "Keep mine": saved; Anna sees "Łukasz's text" after a reload.
9. **S30-02.** Browser 1: close it (or sign out), sign in again as Łukasz: the top bar's Undo is enabled. Undo several
   times: your steps go back newest first (the definition, the mapping, the new entity, the attribute, the rename), each
   with its toast "Undone: …". Redo brings them back. Anna's change is not among them.
10. **S30-03.** Browser 1: rename Product A to "Product B". Browser 2: rename it to "Product C". Browser 1: Undo: refused,
    "Couldn't undo “Rename entity” because it was changed afterwards. Ctrl+Z again goes further back."; the entity stays
    "Product C".
11. **S30-04.** Browser 1: the Sources tab, "Import sources…", a new system "CRM check", the sample file
    `src/domain/import/samples/crm_snapshot_2026-10-20.csv`, Next, Next, "Import into CRM check": the tables and
    columns appear; the indicator shows "Saving…" then "Saved". Reload: they are there. Undo: the whole import goes in
    one step.
12. **Afterwards:** the entity's name and definition as you want them (Product); the import undone. Nothing in KB was
    touched.

### Checks (on `05fd339`)

- CI (`check`) and Schema (`migrations`; `smoke` with the smoke writes on Supabase's local stack: 14 passed, the
  measurement specs skipped) passed.
- **The full run:** [run 44511289154](https://github.com/LukaszWolski-DA/infomapper-app/actions/runs/44511289154) on
  `05fd339`, which contains `dev`'s head (`6da6c05`): 844 passed (slice 30's five specs added), 0 failed, 0 flaky, 16
  skipped; wall-clock 22 min 29 s. Why: the top bar, the save chain (`rowSaves`, `run`) and the canvas's writes are
  shared. Parts (time, heap peak): 1 11.9 min, 969 MB; 2 9.2 min, 1,145 MB; 3 6.9 min, 1,235 MB; 4 8.9 min, 1,056 MB;
  5 12.0 min, 1,206 MB; 6 10.8 min, 1,230 MB; 7 10.2 min, 1,108 MB; 8 8.1 min, 1,480 MB; 9 14.8 min, 1,450 MB (it now
  holds slice 30's folder, as the recut rule says). Later commits touch only `docs/`.
