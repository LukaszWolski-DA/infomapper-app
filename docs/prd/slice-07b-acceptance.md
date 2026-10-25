# Slice 7b – Acceptance

Status: **step 5 done (25 October 2026), waiting for Łukasz; a figure missed its bar (see step 5).** Branch `slice/07b-source-changes`, from
`main` at `dd072b6` (tag `slice-07a`). PRD: `docs/prd/slice-07b-source-changes.md`. The PRD stays as written; this file
is its amendment.

## Łukasz's answers to step 1 (25 October 2026)

The principle stays: the modeller stays in control and sees what will happen before it happens; nothing changes
silently; everything can be undone.

- **Q7, delete:** a new cascade with a confirmation form (D-47) for a source table and a source column, listing
  mappings, relationships, columns, canvas cards and the coverage change before anything happens. “Delete table” in the
  table panel uses the same cascade: one path, not two.
- **Q10, `valid_until`:** worked out from the inputs, not stored. A mapping is historical only when all its inputs are
  retired; a combined mapping with one retired input shows that input as historical (“until {date}” from the column).
  Coming back clears it by itself.
- **Q11, “Approve again all”:** skips mappings that do not fit the source (P8 wins over P9), listed apart with their
  reason (“These don't fit the source yet: …”), so the modeller sees why they were left in review.
- **Q12, settling elsewhere:** when the object of an open change is deleted (entity, attribute, mapping, column, table,
  merge) or the change is decided elsewhere (approving in the mapping panel), the change settles, its resolution saying
  where it came from (“Settled: the mapping was approved in its panel”, “Settled: the attribute was deleted”). Never
  silently dropped (P7).
- **Q13:** mapping changes are raised only for mappings the import sent back from approved. Drafts and mappings already
  in review that get a new conflict or a rewritten rule show in the review's impact and in model consistency, not as
  changes to resolve.
- **Q6:** the Changes view and Focus turn each other off; the chip says which one is on. Touched cards stay lit as a
  whole; the rows are marked with the existing classes. Per-row fading in the Changes view goes to `docs/ideas.md`
  (done).
- **Q3:** new tables and columns are derived from 7a's imports, only those with no mapping yet.
- **The other questions:** the recommendations accepted, including the derivation in the local data file's upgrade to
  format 7 (F1; the answer named it F2, which is `source_import_id` always set, accepted too), `object_label` (F4), the
  URL parameters (F15) and “Show what it touched” only on canvas pages (F16). Any recommendation that conflicts with the
  principle is not applied but listed.
- **Section 6's figures** as planned.

### The recommendations checked against the principle

None conflicts with it. Three come close; each holds as follows, and steps 2–5 build them that way:

1. **Move onto a column the combined mapping already reads (question 8):** the old input is removed rather than
   re-pointed. That holds only if the Move form says so before the click (“{Entity.attribute} already reads {target}; the
   input from {old} is removed.”), as it says that approved mappings go back to review. Built that way.
2. **The derived changes are no undo step (F1):** the upgrade is not a person's action and changes nothing in the model;
   it only adds open changes, each visibly marked “Raised when slice 7b was installed.” and resolvable (and every
   resolution undoable). Nothing is changed silently or irreversibly.
3. **Resolving a change blocks its import's undo (F13):** both stay undoable in order: undoing the resolution first
   brings the change back as the import left it, and then the import can be undone. Only a resolution by someone else
   blocks it, which is 7a's “all or nothing” rule; `known-limitations.md` says so (step 6).

### Left open by the answers

1. **The settlement texts (Q12).** Your two examples set the form “Settled: …”. My list of where a change settles (F8)
   has more cases than the answer names: `removeMappingInput` (a column no longer feeds the mapping), a status other than
   approved set in the mapping panel, and a new column mapped by any path (drag on the canvas, D-48, or the attribute
   panel). I take them as covered (“decided elsewhere”) with: “Settled: the mapping was approved in its panel”,
   “Settled: the mapping was set to {status} in its panel”, “Settled: {column} no longer feeds the mapping”, “Settled:
   mapped to {Entity.attribute} ({status})”, “Settled: the {entity|attribute|mapping|column|table} was deleted”,
   “Settled: the mapping was merged into another”. Step 2 lists every text in one place for you to check.
2. **A combined mapping with one retired input:** the input shows “until {date}” in the panel and its line segment the
   title “Retired: historical” (classes on the existing segment, AD-24). Its coverage is already none (any missing input,
   D-31); it still counts as a type problem only through its live inputs. Say if it should count differently.
3. **“Approve again all” with four-eyes on:** two lists apart, the ones that don't fit (“These don't fit the source yet:
   …”) and the ones this person may not approve (P9's text). A mapping that is both is listed once, under “don't fit”.
4. **Derived new columns (Q3):** “no mapping yet” read as no live mapping input and not missing from source; a derived
   new table: none of its columns mapped.
5. **The decision texts** (D-56 and the D-55, D-51, D-31, D-39 additions) come quoted for your approval in step 3.

### What step 2 starts with

The domain only (PRD items 6–8, 10–18; no data file, no page; CI):

1. `source_change` as a domain type and its rules (kinds, severities, which object each kind names, a resolved change's
   fields; F4, F5), the derived “historical” of an input and a mapping (Q10).
2. The import engine: `ImportModel` with the system's open changes; `buildPlan` returns what it raises and settles
   (items 6–7, Q13); `applyPlan` writes them; the summary and the two counts (item 8); P8's digest with them (F12);
   `materialize` moved from the test fixtures into the domain, and coverage before and after for the review (Q3).
3. The cascades and their impact (Q4, Q7): `sourceColumnCascade`, the table's extended one, coverage before and after.
4. The actions as pure commands (items 10–18), the settle helper and its calls in the other commands (Q12), the Move
   rules (Q5, question 8), approve again and the bulk approval with four-eyes and “fits” (Q6, Q11).
5. The derivation for format 7 as a pure function (`deriveSourceChanges`, Q1, Q3, F1, F2).
6. Unit tests per kind, action and settlement; `bench-import-plan.ts` with raising and coverage (section 6).

## Step 1: start checks (25 October 2026)

- `main` equals `origin/main` and the tag `slice-07a` (all three `dd072b6`, PR #19's merge). The working tree was
  clean (on `slice/07a-source-import` at `3845bb0`, which `main` contains).
- No dev server, Playwright or measurement process: no `node` process at all, ports 3000, 3200, 3201 and 3300 free.
  The only browsers running are Łukasz's own Chrome (profile 2) and the Edge WebView2 processes of Windows apps
  (Search, WhatsApp, Acrobat, Google Drive); none is Playwright's.
- Worktrees still on disk from earlier slices: `infomapper-ab-main`, `infomapper-side-perf-4p-trial-a`, `-f1`, `-f4`
  (detached, used by slice 4p's trials). Left alone; say if they should go.
- Downloads held one copy of the PRD: `slice-07b-source-changes.md`, 26,235 bytes, 25 Oct 2026 20:21. Copied byte for
  byte (`cmp` identical) and committed: `614d0c8 docs: add the slice 7b PRD`.
- The branch was made from `main`; the PRD's header (“from `main` at tag `slice-07a`”) is right this time.

## Step 1: answers to Q1–Q10

### Q1. The derivation (P2)

**Yes, and exactly, through the timestamps an import writes.** `importSources` (`src/domain/commands/import.ts`) runs
with one `ctx`, so `source_import.created_at`, every `missing_since` it sets, every `updated_at` of a mapping it sent
back, and every `created_at` of a table or column it inserted are the same value, and all of its change events carry
one `change_group_id`. So the derivation can find, per change, the import that caused it:

| Change | Derived from | Its import |
| --- | --- | --- |
| `table_left` | a live table with `missing_since` | the system's `source_import` with `created_at = missing_since` |
| `column_left` | a live column with `missing_since` whose table is not missing | the same |
| `type_conflict` / `business_key_changed` / `rule_updated` | a live mapping in review with `review_reason` | the import whose change group holds the mapping's approved → review event |
| `new_table` | a table inserted in an import's group into a system that existed before it | that import |
| `new_column` | a column inserted in an import's group into a table that existed before it | that import |

So `source_import_id` can be set on derived changes too; the PRD's “null for a change derived by the migration” is not
needed (finding F2). Limits:

- **What 7a did not store cannot be derived.** 7a stores `review_reason` only on mappings it moved from approved to
  review (answer 6); a draft or review mapping the import touched (a type conflict, a rewritten rule) has no stored
  trace except its change event. Proposal: derive mapping changes only from `review_reason`.
- **The kind from the reason's text:** `review_reason` is the reasons joined with “; ” (`applyPlan`,
  `src/domain/import/apply.ts:233`), and a rewritten rule may itself contain “; ”. Splitting is unsafe; matching the
  three prefixes is safe (“type conflict, ”, “business key column changed type, ”, “its rule now reads ”). One change per
  mapping, kind by the prototype's priority (`conflict`, then `bk`, then `rule`), the whole reason in the detail.
- **A business key change with no mapping** (prototype's second `bk` issue) left no trace in 7a: not derivable.
- **New tables and columns are decisions the modeller may have taken since** (mapped a column, mapped some of a
  table). See F3 and question 3.
- **The detail** is the text the import would have written, plus “Raised when slice 7b was installed.”; the date is the
  import's.

Where it runs: see F1 (in the local data file's upgrade, not in the SQL migration).

### Q2. The fade

- **One slot.** The fade store (`src/canvas/fade.ts`) holds one `FadeRequest`; `requestFade` replaces it, and
  `FocusDriver` (`src/canvas/Focus.tsx`) writes it whenever Focus is on and clears it when Focus turns off. Two views
  that fade cannot both write it. The request already has the form the Changes view needs: `{ lit, key }`, “a lit set
  worked out elsewhere” (entities and tables for cards, mappings and relationships for lines).
- **Proposal: they exclude each other** (question 6). Turning the Changes view on turns Focus off and vice versa; one
  owner of the request at a time, through a small coordinator next to `FocusDriver` (`ChangesDriver`), so neither
  re-renders `ModelCanvas` (S4P-12, S4B1-06 stay). The key must change when the data changes (`changes:<open|import
  id>:<data version>`), or `requestFade` keeps the old set after an action (it compares keys only).
- **Rows are not faded inside lit cards.** The prototype dims untouched rows in touched cards
  (`body.im-chgmode .card.im-hit .row:not(.im-hit)`); the app's veil (F4, AD-24) has holes per card, block and note, not
  per row, and `Lit.rows` is no longer drawn (slice 4b-1). Proposal: whole cards stay lit; the touched rows carry the
  row marks of item 24 (`new`, `chg`, `old`, `gone`) anyway. Per-row holes would add subpaths per row to the veil:
  not proposed. (F18.)
- **The chip:** D-39's list gains it; the prototype has none (deliberate difference, PRD section 8). Text: “Changes: all
  open” or “Changes: import into {system}, {date}”, ×  turns the view off; every role sees it. “Show all” turns it off
  as it turns Focus off (question 6).
- **Focus's bar from slice 4b-1/4b-2:** F4 switched Focus in 11–88 ms to the screen (slice 4b-1), at most 71 ms with
  requirement cards lit (slice 4b-2, AD-24). Section 6's plan below proposes the Changes view's bar against that.

### Q3. Coverage before and after

- **Yes.** `buildRequirementIndex(requirements, links, model)` (`src/domain/model/requirement-index.ts`) is pure over a
  `ScopeModel`, and `countsForCoverage` (`src/domain/model/requirements.ts:321`) already reads `missing_since` and the
  type check. Coverage after = the index on the model *as the plan leaves it*. The function that builds that model,
  `materialize`, exists only in the test fixtures (`src/domain/__fixtures__/import.ts:36`); it moves into the domain
  (`src/domain/import/`), for the review, and so does a “model after the delete” for item 13's form (the delete's
  cascade applied to an in-memory copy, see F6).
- **Cost:** the index builds in 12.7 ms on 500 requirements and 5,000 attributes in the browser (S4P-11). It is linear
  in the model, so at 20,000 columns a few tens of ms per build, two builds per plan (before is the page's own index).
  The review rebuilds its plan when a rename choice changes; the second build goes with it. Measured in step 2 with
  `bench-import-plan.ts` (section 6, “raising adds ≤ 10 %”), and the review's filter figure from slice 7a is repeated.
- **What can change coverage in an import:** an approved mapping going to review (P6), an input going missing (D-31,
  answer 9), a new type conflict on an approved direct mapping. Nothing else (new columns have no mappings).

### Q4. Delete

**There is no delete that item 13 can reuse as the PRD assumes.**

- **A source table:** `deleteSourceTable` (`src/domain/commands/source.ts:202`) **refuses while any mapping reads one of
  its columns** (“Remove its mappings first. …”). Its cascade takes columns, cards, relationships (both directions), label
  and requirement links, and frees pinned notes; never mappings. The panel's confirmation (`ConfirmDelete` in
  `source-panels.tsx`) lists columns and relationships only, and there is no coverage line.
- **A source column:** **no command deletes one.** Nothing in `src/domain/commands/` or the panels.
- **D-47** is written for entities (`entityImpact`, `src/domain/model/impact.ts`): attributes, mappings incl. approved,
  relationships, canvases, projects, requirements.

Proposal (F6): one cascade per object in the domain, used by both the panel's delete and item 13's action, with an
impact function in the D-47 style that the form reads. `sourceTableCascade` and a new `sourceColumnCascade`:

- the column's mapping inputs: a mapping whose every input goes is deleted with its inputs, label and requirement links
  (`deleteMapping`'s cascade); a combined mapping that keeps other inputs loses only that input, and if approved goes to
  review (D-51) with the reason “{column} was deleted from the source” (question 7);
- relationships one of whose column pairs reads the column: the whole relationship (a key with a missing column is no
  longer that key);
- label and requirement links on the column; for a table also its cards, freed notes, relationships in both directions;
- every open change on the object, settled (P7).

Then `deleteSourceTable` stops refusing mapped tables? **That changes slice 1a's behaviour** (the unit test “refuses
while a mapping reads one of its columns”, `source.test.ts:124`; no e2e spec checks the refusal). Question 7 asks whether the table panel's delete keeps refusing and only the change's “Delete…” cascades
mappings, or both cascade with the D-47 form.

### Q5. Move its mappings

- **Inputs, not mappings (AD-26).** The prototype re-points `mapping.columnId`; the app replaces the
  `mapping_input.source_column_id` of the inputs that read the old column, one per mapping (update the input row in
  place: same id, `sort_order` kept). The mapping's version goes up (inputs bump it, `mapping.ts` header), approved goes
  to review through `afterContentChange` (D-51).
- **The reason:** `afterContentChange` clears `review_reason`; item 12 sets a new one (“moved from {old} after it left the
  source”). That extends answer 6 of slice 7a (“set only when an import moves a mapping from approved to review”) and
  makes the mapping panel's line wrong: it reads “An import sent it back to review: {reason}.” (`mapping-panel.tsx`).
  Proposal: “Sent back to review after a source change: {reason}.”, and D-51's sentence covers this action (F9).
- **The rule:** `rewriteRule` (`src/domain/import/plan.ts`, whole words, ignoring case) on the old name → new name.
  When the target is in another table the rule may name the old table (`customers.created_ts`); only the column name is
  rewritten, as in 7a.
- **Target already an input of the same mapping:** `addMappingInput` refuses a column twice (“This column is already an
  input of the mapping.”). Proposal: the old input is removed instead of re-pointed (the mapping already reads the
  target); approved → review. If it was the only other input, the mapping keeps `transform` and its rule (D-49: a
  transform stays a transform).
- **Target already feeds the same attribute through another direct mapping:** `createMapping` refuses the same mapping
  twice. Proposal: the select marks such columns and Move refuses with “{Entity.attribute} already has a mapping from
  {target}. Delete this one instead.” (question 8).
- **Four-eyes:** the mover becomes the content editor through the `mapping_input` events (`lastContentEditor`), so with
  four-eyes on they cannot approve the moved mapping. No change needed.
- **Label and requirement links** on the old column stay on it (they belong to the column); links on the mapping stay.

### Q6. Approvals

- **One path:** `setMappingStatus` (`src/domain/commands/mapping.ts:268`), action `mapping.set_status` (owners, admins,
  modelers, **reviewers**; `src/domain/permissions.ts`), four-eyes through `checkFourEyes` with the author from
  `lastContentEditor` (`mapping-rules.ts`), which since 7a counts an import's send-back (answer 7). P8 and P9 call it
  per mapping, then settle the change in the same group. No second approval path.
- **“Fits the source”** is a 7b rule only: `setMappingStatus` approves a mapping with a type conflict today, and so does
  the mapping panel. P8 offers “Approve again” only when it fits (prototype `issueCard`: no conflict on the input). The
  check is `checkMappingTypes` per input (`type-check.ts`) plus “no input missing”. **P9 does not say it**; see F11.
- **Who:** under AD-05 reviewers approve. So a reviewer may “Approve again” (and, by the same logic, “Leave it in
  review”, which only answers a review), and the bulk approval. S7B-15 says reviewers get “no action that changes the
  model; approving follows the approval rights of today”: consistent if the two review answers are the reviewer's and
  everything else is `model.edit` (question 9).
- **Undo of a reviewer's approve-again:** undo asks `model.edit` for any event that is not status-only
  (`actionFor`/`statusOnly`, `src/domain/commands/undo.ts`). The action writes a `source_change` row too; without a rule
  for it, a reviewer cannot undo their own approve-again (as F5 was in 7a). Proposal: `source_change` updates that change
  only `status`, `resolution`, `resolved_by`, `resolved_at` of a mapping kind need `mapping.set_status`; the rest
  `model.edit`.
- **The page knows the authors already:** with four-eyes on, the canvas page computes `contentAuthors`
  (`c/[canvasId]/page.tsx`), so P9's list can show, before the click, which mappings this person may not approve.

### Q7. Historical mappings (`valid_until`)

Where it would have to be honoured: coverage (`countsForCoverage`), the type-problem counts (`stats.ts`: status bar,
frame chips, bundle panel), the type warning chips on lines, model consistency, the canvas lines, the panels' “until
{date}”, and the import engine (a retired column that comes back). **There are no Data Vault hints in the app** (AD-08's
hints come with 7c's “Data Vault reading”; only the workspace switch exists), so nothing to honour there.

The data model makes it harder than the PRD assumes (F7):

- **A combined mapping** whose one input is retired: `valid_until` on the mapping makes the whole mapping historical,
  though its other inputs are fine. Retirement belongs to the input's column.
- **Coverage already excludes it:** retiring keeps `missing_since` (prototype: “Retired: historical since
  {missingSince}”), and since 7a an approved mapping with any missing input covers nothing (D-31). `valid_until` adds
  nothing there.
- **Back in the source (item 7)** clears `retired_since` and `missing_since`, but the PRD does not clear `valid_until`;
  the mapping would stay historical on a live column.

Proposal: **no `valid_until` column.** A mapping is historical when every input's column is retired; its “until” is the
latest `missing_since` among them (the prototype's `until = c.missingSince`). Then the line: drawn as today's missing
line (dotted, `s gone`) with the title “Retired: historical”, still drawn (lineage stays visible), and excluded from
type-problem counts and consistency (question 10).

### Q8. The project home

- **Sections today** (`src/app/w/[workspaceId]/p/[projectId]/page.tsx`): the stats line, Canvases, Requirements, Labels
  in this project, Open notes. The prototype puts “Model consistency” **between the stats and Canvases**
  (`renderHome`, `IMP.consistencyHtml(p)`). Proposal: the same.
- **“The project's canvases”:** `loadProjectView` gives the canvases; the page already narrows labels, notes and
  requirements by the canvas items of those canvases (`projectStats`, `projectRequirements`, `labelContext`). The
  prototype's rule (`consistency`): a mapping is in scope when its column's table **or** its attribute's entity has a card
  on a project canvas. The same sets exist on the page (`tablesHere`, `entitiesHere`).
- **Overlap:** “Type conflicts” is the status bar's “Type problems” (`stats.ts`: every mapping failing
  `typeCheckOf`), workspace-wide there and project-scoped here; “Affected requirements” is a subset of the page's
  Requirements section with the same coverage. Not duplicates to remove: the consistency section lists them with links,
  the others count. “Source changes to resolve” per system is workspace-wide in the prototype (systems are not in
  projects); proposal: the same.
- **The page has no side panels and no inspector**, so “each line opens its object on the best canvas” needs a way to
  select on arrival. Today the canvas page reads `?card=`, `?label=`, `?note=` (and `?rename=`, `?moved=`). A mapping,
  a column row, an attribute row and a system need new ones (F15).

### Q9. Labels and history places

- **A change is not a place** (PRD section 9, “not planned yet”) and needs nothing in `SelectionHistory.tsx`.
- **The label's link** selects what it names: a column (the row when its table's card is on the canvas, else
  `{ t: "element", kind: "source_column" }`), a table (its card, else the element), as a click in the tree does. The
  prototype links every label to the table (`data-go="source:tableId"`); the column is more precise and already a place
  (D-38). Both are places, so Back returns to the system panel. Proposal: the column for column kinds and mapping kinds,
  the table for table kinds.
- **A deleted object:** the change's label survives (P3); the link is then plain text (no place to go).

### Q10. Earlier tests and the known limitation

- **The import summary gains “{n} to resolve ({h} high)”** (item 8): every spec that reads a toast or an imports list
  summary after a re-import into an existing system: S7A-05, -07, -08, -09, -10, -11, -16 (“No changes” stays: an
  unchanged file raises nothing), the route spec. First imports of a new system (S7A-04, -17's first step) raise none.
- **The status bar:** a new span only while changes are open; specs counting its spans or reading it whole (S1A-09,
  S6A-07) are checked.
- **The toolbar:** a new “Changes” button changes the narrow steps (“More”, `src/canvas/more-breakpoints.ts`); slice 6a's
  “More” menu spec (S6A-10) and any spec counting top-bar buttons are checked (F17).
- **The project home:** a section above Canvases moves the tiles down; slice 3a's and 4a's home specs (S3A-05, S4A-*)
  locate by test id, checked.
- **Panels:** the system panel gains the changes section; S7A-11 reads its parts. The table panel's columns list
  gains “retired” / “not needed”; S7A-10 reads “missing”. The mapping panel's reason line text (F9): S7A-08, S7A-10.
- **Deleting a source table** (if question 7 makes it cascade mappings): the unit test of the refusal
  (`source.test.ts:124`) changes; no e2e spec clicks `button-delete-table` on a mapped table.
- **Element counts:** `S3B-15-elements.spec.ts` against `slice-07a`'s. “Performance test” has no imports, so its counts
  stay equal unless `seed:large` gains changes (section 6 plan).
- **Coverage specs** (S2C-11, S4A-01/-08/-13, S4B1-*, S4B2-*): unchanged unless retire or delete changes a seeded
  mapping; run in step 3 as the step touching coverage.
- **The known limitation** this slice closes: `docs/known-limitations.md:722`, “Imports raise no changes to resolve
  yet”. Also touched: “An import's undo: all or nothing, and not after a restart” (line 729), which gets worse: see F13.

## Step 1: findings from the critical review

Each: where, the problem, the proposal. “Ask” marks those with a question below.

**F1. The derivation cannot live in the SQL migration (item 5, P2). Ask.** Ids are UUID v7 made by the application
(AD-11, `src/domain/ids.ts`; “the database never generates ids”), and the core schema has no stored functions (AD-18), so
an `insert … select` cannot make the rows. And there is no data in any Supabase database to derive from: the database
comes last (AD-31), all data lives in the local file. *Proposal:* the SQL migration only adds the table and columns; the
derivation runs in TypeScript in the local data file's upgrade (`readDb`, `src/data/local/file.ts`, format 6 → 7, as
5 → 6 in 7a), from a pure domain function (`deriveSourceChanges(model, imports, events)`) with unit tests. The database
slice will carry no 7a data. The derived rows get one change group per workspace with their change events (AD-13),
attributed to the person who ran each import, and no undo step (the undo history is in memory and empty after a
restart anyway).

**F2. `source_import_id` can be set on derived changes (item 1, item 5).** Q1: the import that raised each derived
change is found exactly. *Proposal:* `source_import_id` is not null for every change except those raised by an action
(“Decide column by column” raises `new_column` rows: keep the table change's import, as the prototype does). Then “Show
what it touched” and P9 work for 7a's imports too. Make it `not null`.

**F3. Deriving `new_table` and `new_column` (P2, Q1). Ask.** Derivable exactly (Q1), but a 7a import of a big system
would raise one change per new column and table in an existing system, and some were decided since (mapped). *Proposal:*
derive `new_column` only for a column with no live mapping input that is not missing; `new_table` only for a table with no
mapped column; others are taken as decided and not raised. Alternative: derive none of them (the safer, quieter list).

**F4. The column name `label` (item 1).** The app has working labels (`label`, `label_link`, `labelNames`, D-08); a
`source_change.label` that is not a label invites confusion in code and in `data-model-v2.md`. *Proposal:*
`object_label`.

**F5. Foreign keys that go “null again after a delete” (item 1).** Deletes are soft (AD-12) and undone by writing the
before-image back (`revertChangeGroup`); nulling the change's FKs would need its own writes in every cascade and its own
undo. *Proposal:* the FKs stay (the row stays, soft-deleted); the change reads its `object_label` when the object is not
live. `source_change` gets `source_system` as its only parent in undo's `PARENTS` (the others are informational, so a
resolved change on a deleted column never blocks an undo's consistency check). CHECKs instead: kind ↔ which FKs are set
(column kinds a column; table kinds a table; mapping kinds a mapping, except `business_key_changed` with no mapping);
`status = 'resolved'` ⇔ `resolution`, `resolved_by`, `resolved_at` all set (as `mapping_approval_ck`).

**F6. Delete is not “the existing delete with its cascade” (item 13, S7B-06). Ask.** See Q4: the table delete refuses
mapped tables, no column delete exists, no source delete shows coverage. *Proposal:* `sourceColumnCascade` and an
extended `sourceTableCascade` in the domain with an impact function (D-47 style) and coverage before/after (Q3); one
command per object used by both the panel and the change's action. Cost: a new command and form, about half a step.

**F7. `valid_until` on the mapping (items 3, 11; P6). Ask.** See Q7: wrong grain for combined mappings, redundant with
`missing_since` for coverage, and not cleared when the column comes back. *Proposal:* derived, no column. If you keep
the column: set it only when every input is retired, and item 7 clears it.

**F8. “Settles every change on the object” only on item 13's delete (P7). Ask.** Many commands delete or end the
object a change points at: `deleteSourceTable`, `deleteMapping`, `deleteAttribute` and `deleteEntity` (their mappings),
`mergeMappings` (the merged ones), `removeMappingInput` (a column no longer feeds the mapping), `setMappingStatus` from
the mapping panel (approving or rejecting answers the review the change asks for), `createMapping` and `addMappingInput`
from a column with an open `new_column` (dragging it onto an attribute on the canvas decides it, D-48). Left as the PRD
has it, those changes stay open on objects that are gone or decided, and the list lies. *Proposal:* a rule in the
domain: **a change settles in the same change group when its object is deleted or its question is answered elsewhere**:
“Deleted” (the object went), “Approved in the mapping's panel” / “Status set to {status} in the mapping's panel” (mapping
kinds), “Mapped to {Entity.attribute} ({status})” (a new column given a mapping by any path). One helper
(`settleChangesOf`) called from those commands; their state gains the open changes of their objects. Cost: about ten
commands' states and tests. Alternative: only item 13's delete settles, and the card of a change whose object is gone
reads “{label} was deleted” with one action “Dismiss”.

**F9. The review reason after Move (item 12, D-51, 7a answer 6).** See Q5. *Proposal:* D-51 reads “An import, or moving
a mapping after its column left the source, sends …”; the mapping panel's line becomes “Sent back to review after a
source change: {reason}.”

**F10. Drafts and mappings already in review (item 6, P4, P8). Ask.** The prototype raises a mapping change for every
mapping P6 touches, whatever its status (“The mapping to {attr} (draft): …”); 7a's engine computes those reasons too
(`MappingImpact.reasons`, “a draft or review mapping has them too”). The PRD's actions for mapping kinds are “Approve
again · Leave it in review”, which make no sense for a draft. *Proposal:* raise mapping kinds only for mappings the
import sent back (approved before), which is also what P2 can derive; a draft's or review mapping's new type conflict
shows in model consistency's “Type conflicts” (live) and on the line. Alternative: raise them, with “Leave as draft”
for drafts.

**F11. P9's bulk approval would approve mappings that do not fit (P8, P9, DoD). Ask.** P8 offers “Approve again” only
when the mapping fits; P9 approves all {n} one import sent back. In the definition of done, CRM's re-import sends back
`cust_no` (business key changed, fits again) and `email_addr` (type conflict `varchar(255)` into `string(120)`, does not
fit). After approving `cust_no` by hand, “Approve again all for the rest” would approve the conflicting one, or approve
nothing if it follows P8. *Proposal:* P9 skips mappings that do not fit and lists them apart (“{n} do not fit the source
and stay in review: …”), as it lists those four-eyes refuses; the DoD approves `cust_no` with “Approve again all” and
leaves `email_addr` (fix it by changing Customer.email's length, then approve). See question 11.

**F12. Raising and settling need the open changes in the plan, and P8 must see them.** P7's settlements depend on the
stored open changes (a `column_left` the file brings back, a `new_column` that leaves). The plan is pure over
`ImportModel` (`src/domain/import/model.ts`), which has no changes. *Proposal:* `ImportModel` gains the system's open
changes; `buildPlan` returns `raises` and `settles`; `planDigest` (`compare.ts`) includes them (with the id and version of
every change it settles), so a change resolved by someone between the review and the import makes the server refuse
with P8's text instead of settling a resolved change. The review's callout reads the plan, so it counts the whole plan
(slice 7a step 5's condition holds by construction).

**F13. Resolving a change blocks the undo of its import.** An import's undo is all or nothing and refused when any row
it wrote changed since (7a, F31). Its `source_change` rows are such rows: resolving any change it raised, or a later
import settling one, makes the import impossible to undo. That is right (the decision builds on the import), but
`known-limitations.md`'s entry should say so, and so should the PRD's P5 (each action is one undo step; the import's step
is gone once a change is resolved).

**F14. The working context and live canvases (D-26).** Nothing to change, checked: `contextTargets`
(`src/domain/model/live.ts:238`) labels mappings an action writes (“Map to an attribute” creates one, Move changes
inputs: both labeled by an active context, as any model change); source tables and columns and `source_change` are never
labeled. The import keeps `labelNothing` (P9 of 7a), now with its `source_change` rows. *Proposal:* say in the D-entry
that the actions are model changes (labeled), the import's raising is not.

**F15. Opening objects from the project home (item 25).** The home page has no inspector and the canvas page selects
on arrival only `?card=`, `?label=`, `?note=`. *Proposal:* `?map=<id>`, `?row=<column or attribute id>` and
`?system=<id>` (the system's panel opens, `openDetails()`, an action that leads to details on purpose), read like
`?note=` (`SelectionHistory`'s arrival list `ARRIVAL` gains them). The best canvas: the project's first canvas, in tab
order, with both ends' cards, else one end's, else the project's first canvas (prototype `goTo`); computed on the server.

**F16. “Show what it touched on the canvas” from a home page (item 26).** The imports list exists only in the system
panel, and the system panel only on canvas pages (the inspector); the home pages have no panel. So “from a home page”
has no entry point. *Proposal:* drop that case; on a canvas page the link turns the view on for that import. The only
home-page entry is model consistency's per-system line, which opens the system's panel on a canvas (F15).

**F17. The toolbar button (item 26).** The top bar has narrow steps (`more-breakpoints.ts`: Focus and the notation go
into “More” up to 1,200 px, the four tools up to 1,100 px), and CLAUDE.md's rule: nothing above the canvas reads layout
during a commit. *Proposal:* “Changes” sits right after Focus (prototype: after `#tFocus`, class `hide-s`) and goes into
“More” at the same step as Focus; the button is a class switch only. Its state is a value store (like `focusOn`),
momentary and not saved (as Focus, D-22): off after a reload and when switching canvas, outside undo.

**F18. The Changes view's lit set (items 26, 27).** `chgSet` lights columns, tables, mappings, attributes and entities;
the app's veil lights cards (entities, tables, requirement cards), notes and lines (`Lit`). *Proposal:* touched
tables and entities → their cards; touched mappings → their lines; columns and attributes do not fade inside a lit card
(Q2). Collapsed frames: a block is lit when any member is, as Focus does. Bundles at collapsed frames: lit when any of
their mappings is. A canvas with nothing touched: everything fades, the bar says “Nothing on record” (as the prototype).
P11 holds: a fade request only.

**F19. Severity and the first import (item 6).** The prototype raises `newtable` for every new table, also into a new
system; the PRD raises none on a first import (a deliberate difference not listed in section 8). Agreed with the PRD;
“existing system” means the import's target is `{ systemId }`, so the seed's CRM, never imported, raises `new_table`
and `new_column` on its first import. Mapping kinds: the prototype makes `conflict` and `bk` high whatever the status;
with F10's proposal only approved mappings raise them, so P4's “high when an approved mapping is affected” and item 6
agree.

**F20. `changes_raised` and `changes_high` on `source_import` (item 8).** They could be counted from `source_change`
by `source_import_id`, but “Decide column by column” adds rows with the same import later, so the count would drift.
Kept stored, as the PRD has it; the counts CHECK (`source_import_counts_ck`) gains them. The summary reads them.

**F21. Undo and the local adapter need the new table registered (item 4).** Not in the PRD's list beyond “the undo
history knows the new table”: `WritableRows` (`src/domain/types.ts`), `UNDOABLE_TABLES` and `PARENTS` (F5), `actionFor`
(Q6), `DevDb`, its rules and `DEV_DB_FORMAT` 6 → 7 with `readDb`'s upgrade (`schema.ts`, `file.ts`), the loaders
(`model.load` or a new `sourceChanges.list`), `change-label.ts` (undo labels such as “Retire crmprod.dbo.customers.segment”),
the e2e helpers that read the data file. Same list as 7a's F12.

**F22. Who may resolve (S7B-15, AD-05). Ask.** See Q6. *Proposal:* “Approve the mapping again”, “Leave it in review”
and “Approve again all” need `mapping.set_status` (reviewers too); every other action `model.edit` (owners, admins,
modelers); an archived workspace refuses all (AD-09). The server checks both, per action.

**F23. “Not needed” and later mappings (P10, item 15).** A column marked not needed may later be mapped by drag (D-48).
*Proposal:* the flag stays (nothing about need is final, either way), the columns list shows the mapped attribute first,
as the prototype's order does (retired, missing, mapped, not needed, not used).

**F24. The definition of done.** With F11: approve `cust_no` again (or by “Approve again all”, which approves it and
lists `email_addr` as not fitting); the rest as written. “Move another's mapping to its renamed column” works as the
review leaves `created_ts` “removed” and `created_on` new: moving `created_ts`'s mapping (in review) to `created_on`
rewrites its rule to `CAST(created_on AS date)` and settles `created_on`'s `new_column` change. Retail Co has four-eyes
off; S7B-08 and S7B-09 use Bank X (four-eyes on) or switch it with `setFourEyes`.

**The PRD is right on these (checked):** one change group per action and its undo (`runCommand`, `revertChangeGroup`);
the type check on a column state not stored yet (`checkMappingTypes`, per input); the requirement index on another model
(Q3); the import's labelNothing (F14); a system as a place for the label link's way back (7a, Q8); 7a's `rewriteRule` for
Move; the status bar's warning style (`status-type-problems`); the canvas marks as classes on existing elements (rows:
`buildCards` in `card-data.ts` already passes `missing`; lines: `s gone`).

## Differences between the reference prototype and the app that the slice touches

| Where | Prototype | App | Proposal |
| --- | --- | --- | --- |
| Changes on a new system | `newtable` for every new table | none (PRD) | the PRD (F19) |
| Mapping changes | any status | — | approved only (F10) |
| Approve again | anyone, fits or not checked on the card only | four-eyes (P8) | P8 and F11 |
| Move | `mapping.columnId` | an input (AD-26) | Q5 |
| Delete | its own, hard | none for columns, table refuses mappings | F6 |
| `until` | on the mapping | — | derived (F7) |
| Changes view | page class, rows dimmed in lit cards | fade layer, cards | F18, Q2 |
| Changes chip | none | D-39 chip | Q2 |
| Model consistency | home, after the stats; panels on the home | home without panels | F15 |
| “Show what it touched” | from any page with the inspector | canvas pages only | F16 |
| Resolution's who | not recorded | `resolved_by` | the PRD |
| Issue label link | the table | column or table | Q9 |
| Status bar | “Source changes to resolve {n}” when > 0 | — | the same |

## Docs plan (PRD section 10)

| Doc | What | When |
| --- | --- | --- |
| `docs/decisions.md` | new **D-56 “Changes to resolve”** (P1–P11 as amended here); D-55 (the import raises and settles changes); D-51 (Move's reason, F9); D-31 (retired mappings cover nothing, already true through missing); D-39 (the Changes chip). Quoted text for approval first | step 3 |
| `docs/data-model-v2.md` | `source_change` with its CHECKs (F5), `retired_since`, `not_needed`, the import's two counts; no `valid_until` if F7 is accepted; the derivation in the upgrade (F1) | step 3 |
| `supabase/migrations/` | one new migration, DDL only, RLS on `source_change` | step 3 |
| `docs/known-limitations.md` | remove line 722's entry; extend the import's undo entry (F13); what steps 2–5 find | step 6 |
| `docs/ideas.md` | remove “Approve again all {n}”; add section 9's “not planned yet” items; per-row fading in the Changes view (Q2) if you want it kept | step 6 |
| `docs/inventory-prototype-vs-app.md` | “Sources” lists only 7c's | step 6 |
| `README.md`, `CLAUDE.md` | the slice's status; changes to resolve in “What this is”; a “Changes to resolve” note (domain code, the settle rule, the fade coordinator, the new URL params); new e2e helpers; new bench lines | step 6 |

## Plan for section 6's figures

| Figure | Bar (proposal) | Where | Step | Machine time |
| --- | --- | --- | --- | --- |
| Raising and settling in plan and apply, 20,000 columns, 5 % changed, renamed or missing | ≤ 10 % over 7a's (107 ms plan, 27 ms apply) | Node, `bench-import-plan.ts` | 2 | 5 min |
| The same through the command and the adapter | ≤ 10 % over 7a's 1,085 ms | Node, `bench-import-write.ts` on a copy | 3 | 10 min |
| Coverage before and after in the review (two index builds) | ≤ 100 ms at 20,000 columns | Node, `bench-import-plan.ts` | 2 | included |
| Model consistency's computation, 20,000-column import with 5 % missing | **≤ 50 ms in Node** instead of “≤ 300 ms to the screen” (question 13) | Node, new `bench-consistency.ts` | 5 | 5 min |
| The project home's load with it, same data | information only (the local adapter reads the whole file) | measurement build | 5 | 10 min |
| Element counts, “Performance test”, four views, whole page | equal to `slice-07a`'s | `S3B-15-elements.spec.ts`, baseline from a `slice-07a` worktree | 4, 5 | 25 min incl. builds |
| Changes view on and off, and switching the import, 30 % and 100 % | ≤ 100 ms to the screen, and within 10 % of Focus switching on the same view in the same sitting | measurement build, slice 4b-1's to-screen method, traced both sides | 5 | 45 min incl. build and warm-up |

“Performance test” has no imports, so the Changes view would light nothing there. Proposal: `seed:large` gains a
recorded import with changes on about 10 % of its tables (written through the domain, as its requirements are), so the
view fades a realistic canvas; the element guard then runs without it (the baseline has none) or the baseline is
re-taken with it. About 1.5 hours of machine time; 5–6 hours with the scripts, the seed addition and the write-up,
spread over steps 2, 3 and 5.

## Questions for Łukasz

Each with my recommendation; a short answer is enough.

1. **Where the derivation runs (F1).** In the local file's upgrade (format 7), not in the SQL migration. *Recommend:
   yes.*
2. **`source_import_id` always set (F2).** Derived changes name their import. *Recommend: yes, `not null`.*
3. **Deriving new tables and columns (F3).** Only those still undecided (no mapping), or none. *Recommend: only
   undecided ones.*
4. **Column name (F4).** `object_label` instead of `label`. *Recommend: yes.*
5. **FKs (F5).** Never nulled; CHECKs per kind and for a resolved change. *Recommend: yes.*
6. **Changes view and Focus (Q2, F17, F18).** Exclusive (one turns the other off); whole cards lit, no per-row fading;
   a chip “Changes: …” with ×; “Show all” turns it off; momentary like Focus. *Recommend: yes to all.*
7. **Delete (Q4, F6).** (a) Item 13's “Delete…” cascades mappings (a mapping whose every input goes is deleted; a
   combined one loses that input and goes to review with “{column} was deleted from the source”) with a D-47 form and the
   coverage line. (b) The table panel's “Delete table” keeps refusing mapped tables as in slice 1a, or uses the same
   cascade and form? *Recommend: (a) yes; (b) the same cascade and form, so there is one delete.* A column panel's own
   “Delete column” is not in the PRD; I would not add it.
8. **Move onto a column that already feeds the mapping or the attribute (Q5).** Combined: drop the old input. Direct
   duplicate: refuse with a text. *Recommend: yes.*
9. **Reviewers (Q6, F22).** “Approve again”, “Leave it in review”, “Approve again all” for reviewers too; the rest for
   editors. *Recommend: yes.*
10. **`valid_until` (Q7, F7).** Derived from the inputs' columns (historical when every input is retired), not stored;
    the line still drawn dotted, titled “Retired: historical”; historical mappings out of the type-problem counts and
    consistency. *Recommend: yes.* If you keep the column: set only when every input is retired, cleared on “back”.
11. **P9 and mappings that do not fit (F11, F24).** Skip and list them apart; the DoD changes as in F24. *Recommend:
    yes.*
12. **Changes that settle elsewhere (F8).** A change settles when its object is deleted or its question answered by any
    command, with the texts in F8. *Recommend: yes* (about ten commands; part of steps 2–3). Alternative: “{label} was
    deleted” with “Dismiss”.
13. **Mapping kinds for drafts and mappings already in review (F10).** Raised only for mappings the import sent back.
    *Recommend: yes.*
14. **Move's review reason (F9).** D-51 and the panel's line as in F9. *Recommend: yes.*
15. **Opening from the project home (F15, F16).** New `?map=`, `?row=`, `?system=`; drop “Show what it touched” from
    home pages. *Recommend: yes.*
16. **Model consistency's bar (section 6).** Computation ≤ 50 ms in Node; the page load as information (it is
    dominated by reading the local file). *Recommend: yes.*
17. **`seed:large` gains an import with changes** for the Changes view's figure. *Recommend: yes.*
18. **Tests per step.** The PRD calls 7b large (full e2e after each step that changes pages): steps 2 CI only; step 3
    CI plus the specs it touches (import, coverage, D-51, the source delete if question 7b changes it) and one full run,
    since it changes the data file's format and the import's summary; steps 4 and 5 one full run each; two at the close.
    *Recommend: as written.*

## Łukasz's answers on the open points (25 October 2026)

All as read in "Left open by the answers" and "The recommendations checked against the principle": the Move form says
the old input is removed before the click; derived changes are no undo step and say "Raised when slice 7b was
installed."; a resolution and its import's undo follow 7a's all-or-nothing rule; the extra settlement cases in the
"Settled: …" form; a combined mapping with one retired input shows "until {date}" on that input and the segment's title
"Retired: historical", type problems only through live inputs; "Approve again all" with four-eyes on lists "don't fit"
first, a mapping in both only there; "no mapping yet" as read; the decision texts quoted in step 3. F1 and F2 both
stand.

## Step 2: the domain (25 October 2026)

### What changed

Pure domain code; nothing is written to the data file and no page changes (step 3 brings the commands, step 4 the
pages).

- **Types** (`src/domain/types.ts`): `SourceChange` with its kinds, severities and statuses (F4: `object_label`);
  `retired_since` on `source_table` and `source_column`, `not_needed` on `source_column`; `changes_raised` and
  `changes_high` on `source_import`. Every row builder fills them (seeds, fixtures, "New source table", the import).
  No `valid_until` (Q10). `source_change` is not in `WritableRows` yet: the actions return `Edit`s (a `Write` or a
  `source_change` row), which step 3 registers with the data file.
- **The import engine** (`src/domain/import/`): `ImportModel` takes the workspace's changes; `buildPlan` returns
  `raises` and `settles` (`planChanges`); `MappingImpact` carries the kind of change a send-back raises and the input it
  names; `applyPlan` makes the import's id and returns the raised rows and the settled patches (resolution, who, when),
  and clears `retired_since` with `missing_since` when a table or column is back; `planCounts` and `importSummary` add
  "{n} to resolve ({h} high)"; `planDigest` holds the raises and the settled changes at their versions (F12).
  `materialize` moved from the test fixtures into `src/domain/import/materialize.ts` (Q3).
- **Changes to resolve** (`src/domain/source-changes/`):
  - `texts.ts`: every title, detail, button, resolution and settlement text (the list below), and the review's callout
    (`raisedCallout`).
  - `rules.ts`: `Edit`, `newChange`, `settle`, open and priority order, historical inputs and mappings (`isRetired`,
    `untilOf`, `isHistorical`, `mappingUntil`), `fitsSource` (P8: no input missing and the type check passes),
    `approvalColumns`.
  - `coverage.ts`: `coverageDelta` (two requirement indexes, before and after, with why) and `scopeModelOf`.
  - `delete.ts`: `sourceDeleteCascade`, `sourceDeleteEdits`, `sourceDeleteImpact` for a table or a column (Q4, Q7).
  - `actions.ts`: `actionsFor`, `retire`, `moveTargets`, `movePlan`, `moveMappings`, `deleteForChange`,
    `mapToAttribute`, `markNotNeeded`, `decideColumnByColumn`, `markAsNeeded`, `approveAgain`, `leaveInReview`,
    `noted`, `approveAllPlan`, `approveAllEdits`.
  - `settle.ts`: the settle rules step 3 calls from the other commands (Q12).
  - `derive.ts`: `deriveSourceChanges` for the format-7 upgrade, and `kindOfReason`.
- **Earlier tests changed:** `plan.test.ts`, two expectations: the CRM re-import's counts gain `changes_raised: 9,
  changes_high: 2`, and the missing table's summary gains ", 2 to resolve". The 7a e2e specs that read an import's
  summary change in step 3, when the command writes the changes.

### Decisions I took (please check)

1. **"Delete table" in the panel keeps refusing mapped tables until step 4.** The new cascade exists, but the panel's
   command switches to it only together with its D-47 form, so the app never deletes a mapping without showing it first.
2. **A business key change with no mapping on the column** (the prototype's second `bk`) gets one action, **"Noted"**
   (resolution "Noted"). The PRD's "Approve again · Leave it in review" needs a mapping. Please confirm the word.
3. **Delete's resolutions:** the change acted on reads "Deleted"; other open changes on the same object "Settled: the
   column was deleted" (or table).
4. **Retiring a table** retires its missing columns and settles their own earlier "column left" changes with "Settled:
   the table was retired".
5. **Approving again** (one or all) also settles any other open change on the same mapping: "Settled: the mapping was
   approved again".
6. **"Decide column by column"** raises a change only for columns with no mapping yet that are still in the source (as
   Q3's reading for derived changes).
7. **Move targets:** the system's present columns, the change's table first, then the others by name; never the column
   itself or a column or table missing from source.
8. **The import settles more than item 7 names:** a table that leaves settles its own open "new table" change, and a
   column that leaves inside a missing table settles its "new column" change ("Left the source on {date} before a
   decision"). A column that leaves with its table raises no "column left" of its own (the prototype's rule).
9. **The mapping panel's status settlement** uses the panel's words: "Settled: the mapping's status was set to Draft in
   its panel" (or In review).
10. **Derivation:** a derived change is dated and signed as its import (`created_at`, `created_by`), so its card shows
    the import's date; a missing column whose table left at the same moment gets no change of its own.

### Every resolution and settlement text

From `src/domain/source-changes/texts.ts`; `{date}` is the ISO date (`2026-10-25`).

| When | Text |
| --- | --- |
| Retire (column or table) | Retired: kept as historical |
| Move its mappings | Mappings moved to {table}.{column} |
| Delete (the change acted on) | Deleted |
| Map to an attribute | Mapped to {Entity}.{attribute} (draft) |
| Not needed / None of it is needed | Marked not needed |
| Decide column by column | Split into one decision per column |
| Approve the mapping again (one, or all) | Approved again |
| Leave it in review | Left in review |
| Noted (business key change without a mapping, decision 2) | Noted |
| An import: the column or table is back | Back in the source on {date} |
| An import: a new column or table left before a decision | Left the source on {date} before a decision |
| Deleted elsewhere (entity, attribute, mapping, column, table) | Settled: the {entity, attribute, mapping, column or table} was deleted |
| Merged into another mapping | Settled: the mapping was merged into another |
| Approved in the mapping panel | Settled: the mapping was approved in its panel |
| Another status in the mapping panel | Settled: the mapping's status was set to {Draft or In review} in its panel |
| An input removed from the mapping | Settled: {column} no longer feeds the mapping |
| A new column mapped by a drag or the attribute panel | Settled: mapped to {Entity}.{attribute} ({draft, in review or approved}) |
| A new column a Move mapped onto | Settled: mappings moved here from {old column} |
| A column's own change when its table is retired | Settled: the table was retired |
| Another open change on a mapping approved again | Settled: the mapping was approved again |

The other texts, for reading in one place:

| What | Text |
| --- | --- |
| Titles | Column left the source · Table left the source · New column to decide · New table to decide · Mapping no longer fits the source · Business key column changed · Rule updated for a renamed column |
| Kinds in the review's callout | columns that left · a table that left · new columns · new tables · type conflicts · business key changes · updated rules |
| Buttons | Retire: keep as historical · Move its mappings… · Delete… · Map to an attribute… · Not needed (a table: None of it is needed) · Decide column by column · Approve the mapping again · Leave it in review · Noted |
| Details at import | Not in the file. Its {n} columns are marked missing from source. · Not in the file. Was {type}, with {n} mappings. · New in the source, {n} columns with no mapping yet. · New in the source, {type}. · The approved mapping to {Entity.attribute} went back to review: {reasons}. · Business key column changed type, {before} → {after}. Hash keys built on it change too. |
| Derived (P2), added to the detail | Raised when slice 7b was installed. |
| The review's callout (item 9) | After the import, {n} changes to resolve, {h} of them high. They wait on {system}’s page until you decide: {kinds}. |
| The import summary (item 8) | …, {n} to resolve ({h} high) |
| Move form | Moved approved mappings go back to review; the old column is retired. · {Entity.attribute} already reads {target}; the input from {old} is removed. |
| Move refused | {Entity.attribute} already has a mapping from {target}. Delete this one instead. |
| A moved mapping's review reason | moved from {old} after it left the source |
| Map form | The mapping starts as a draft. |
| Delete: a combined mapping's review reason | {column} was deleted from the model (step 3's answers) |
| Delete form | Retiring keeps the history instead; in Data Vault the column stays in its satellite. · No requirement’s coverage changes. |
| Approve again all | These don't fit the source yet: · You changed or imported these last, so someone else has to approve them. |
| Refusals | This change is already resolved. · This mapping is no longer in review. · This mapping does not fit the source yet, so it cannot be approved again. · That mapping already exists. · Choose a column of the system that is in the source. |
| Why a coverage changes | {column} missing from source · {attribute}: mapping back to review, {reason} · {attribute}: mapping deleted · {attribute}: type conflict |

### Tests

`npm run lint`, `npm run typecheck`: pass. `npm test`: **91 files, 1,212 tests pass** (33 new, in
`src/domain/source-changes/`: `raise.test.ts` 7, `actions.test.ts` 19, `settle.test.ts` 4, `derive.test.ts` 3). One
scenario serves them all (`src/domain/__fixtures__/source-changes.ts`): CRM with customers and orders, approved,
combined and draft mappings, and a re-import in which a business key widens, an approved mapping gets a type conflict,
two columns and a table leave, and two columns and a table are new.

| Criterion | What the unit tests check |
| --- | --- |
| S7B-01 | a first import raises none; each kind with severity, label, detail; the counts and the summary; drafts raise no mapping change (Q13); a business key change without a mapping; a rule rewritten |
| S7B-02 | the callout; coverage before and after over the whole model, with why |
| S7B-03 | back settles "left" and clears `retired_since`; a new column that leaves settles; P8 refuses a plan whose settled change was resolved meanwhile |
| S7B-04 | retire a column and a table; historical inputs and mappings, "until" (Q10) |
| S7B-05 | move: direct and combined, approved to review with the reason, rule rewritten, a draft stays a draft, the old input dropped, a duplicate refused, the target's change settled |
| S7B-06 | delete a column and a table: what goes, the impact with relationships and coverage, every change settled |
| S7B-07 | map, not needed (column, table), decide column by column, mark as needed |
| S7B-08 | approve again only when it fits; four-eyes refuses the last editor and accepts someone else; leave in review; noted |
| S7B-09 | approve again all: don't fit first, four-eyes apart, the approvals and their settlements |
| S7B-12 | the derivation equals what the engine raises for the same import, dated and signed by it, marked; mapped new columns left out; the kind from the reason's words |
| Q12 | every settlement elsewhere, and none twice |

Not yet: S7B-10 (undo) and S7B-15 (roles) need the commands (step 3).

### The plan timing (section 6)

`npx tsx scripts/bench-import-plan.ts` (Node, median of 5 after a warm-up), against the tag `slice-07a` in the same
sitting: three rounds each side, alternating (a worktree at the tag, `../infomapper-base-07a`, its `node_modules` a
junction to this one). The synthetic re-import: 5 % of the columns changed, renamed or missing, a direct approved mapping
on every tenth column.

| Figure | `slice-07a` (3 rounds) | this branch (3 rounds) | Change | Bar |
| --- | --- | --- | --- | --- |
| Plan, 20,000 columns | 108, 105, 109 ms → **108** | 127, 104, 111 ms → **111** | +3 % | ≤ 10 %: met |
| Apply, 20,000 columns | 26, 27, 26 ms → **26** | 25, 32, 30 ms → **30** | +4 ms | |
| Plan and apply, 20,000 | **134** | **141** | +5 % | ≤ 10 %: met |
| Plan, 100,000 columns | 461, 515, 458 ms → **461** | 471, 479, 475 ms → **475** | +3 % | ≤ 10 %: met |
| Apply, 100,000 columns | 129, 131, 132 ms → **131** | 131, 132, 136 ms → **132** | +1 % | |

The plan raises 315 changes (115 high) at 20,000 columns and 1,610 (610 high) at 100,000. A first sitting before a fix
measured +11 % on the plan: the raising built a label for every column of the system; it now skips unchanged columns.

**Coverage before and after** (the review's callout, Q3; a variant with one attribute per mapped column and 500
requirements of four attribute links each; `materialize` plus two requirement indexes):

| Columns | Median (fastest–slowest) | Bar |
| --- | --- | --- |
| 20,000 | 80 ms (66–111) | ≤ 100 ms: met |
| 30,000 (the import limit, `--limit`) | 95 ms (79–148) | ≤ 100 ms: met, close |
| 100,000 (above the limit) | 311 ms (301–325) | missed; no import can be this large |

The review builds it once per plan (a rename choice rebuilds the plan). At the limit it is close to the bar; if step 4's
review feels slow, the "after" index can be limited to the requirements whose scope holds an affected attribute.

### How to check

```
npx vitest run src/domain/source-changes src/domain/import
npx tsx scripts/bench-import-plan.ts
npx tsx scripts/bench-import-plan.ts --limit
```

### Open for step 3

- Register `source_change` (`WritableRows`, the data file's format 7 with the derivation, undo's tables, parents and
  `actionFor`), the migration, and the commands around the actions (permissions per F22, versions, change events, undo
  labels); the import writes its changes; the settle rules called from the other commands; `deleteSourceTable` on the
  cascade together with step 4's form.
- The worktree `../infomapper-base-07a` stays for step 3's write figure (A/B against the tag); its `node_modules` is a
  junction, removed with `rmdir` before `git worktree remove`.

## Łukasz's answers to step 2 (25 October 2026)

Step 2 accepted, with the plan timing and the text list. Two texts changed: the business key change without a mapping
is **"Acknowledge"**, resolution **"Acknowledged: hash keys built on it change"** (half a year later the history must
still say why it mattered); the change a delete acts on reads **"Deleted from the model"** (not "left the source").
Decisions 1–10 as taken: "Delete table" keeps refusing mapped tables until step 4's D-47 form; the import showed "to
resolve" without storing it until step 3. The worktree `../infomapper-base-07a` stays for step 3 and goes at the close.

## Step 3: data and the commands (25 October 2026)

### What changed

- **Texts:** "Acknowledge" / "Acknowledged: hash keys built on it change"; "Deleted from the model" (step 2's answers).
- **Migration** `supabase/migrations/20261025220000_source_changes.sql`: `retired_since` on `source_table` and
  `source_column` (only on what left the source: a CHECK), `not_needed` on `source_column`, `changes_raised` and
  `changes_high` on `source_import` (in its counts CHECK), the table `source_change` with CHECKs for its kind, severity
  and status, a resolved change's three columns together, and the object each kind names (F5), indexes, row-level
  security. No `valid_until` (Q10), no derivation (F1). `npm run schema:check` on a throwaway Postgres 18.3: "The schema
  matches the domain: 30 tables, 408 columns".
- **Local data file format 7** (`src/data/local/schema.ts`, `file.ts`): `source_change` with the same rules; the upgrade
  (`upgradeDb`) reads formats 2–6 as 7, and from 6 runs `deriveSourceChanges` (F1, F2, Q3): the derived changes get
  their change events, one change group per workspace, each signed by the person who ran the import, no undo step; the
  file is written back at once, so the derived rows keep their ids. `model.listChanges`.
- **Undo** (`undo.ts`): `source_change` is undoable; its parents are its system and import only (F5); settling a
  mapping change (status, resolution, who, when) needs `mapping.set_status`, so a reviewer undoes their own
  approve-again (Q6). **Undo labels** (`change-label.ts`): "Retire {label}", "Move the mappings of {label}", "Delete
  {label}", "Map {label}", "Mark {label} not needed", "Decide {label} column by column", "Approve again {label}" or
  "Approve {n} mappings again", "Leave {label} in review", "Acknowledge {label}", "Mark {column} as needed" / "not
  needed". A group whose changes only settle as a side effect keeps its own label.
- **The import** (`importSources`) stores the changes it raises and the settlements, in its change group;
  `importStateOf` takes the workspace's changes; the upload route and the wizard pass them (the canvas page loads
  `listChanges` into `importData`), so the review and the server plan alike (P8).
- **The commands** (`src/domain/commands/source-change.ts`): `retireChange`, `moveChangeMappings`, `deleteChangeObject`,
  `mapChangeColumn`, `markChangeNotNeeded`, `splitChange`, `acknowledgeChange`, `approveChangeAgain`,
  `leaveChangeInReview`, `approveImportAgain` (the count the person saw must match, or stale), `markColumnNeeded`.
  Permissions per F22: approve again, leave in review and approve all need `mapping.set_status` (reviewers too); the
  others `model.edit`; the archive refuses all; the change's version is checked. Four-eyes from `lastContentEditor`.
  Server actions in `src/app/_actions/source-change.ts` (step 4's panels call them).
- **The settle rule** (`settleAfterWrites`, `src/domain/source-changes/settle.ts`): instead of changing a dozen commands,
  `runCommand` runs it after every command, in its change group, as it runs the live canvas rules
  (`withSettledChanges`, `src/app/_lib/run-command.ts`). It reads the writes: a mapping deleted (with its entity, its
  attribute, by itself, or merged into another), a source table or column deleted (the table panel's delete included), a
  status set in the mapping panel (only the status columns, and no input in the same group, so an input change of an
  approved mapping is not taken for the panel's), an input removed, a column given a mapping (a new input or an input
  pointed at it: the D-48 drag, the attribute panel, merge). An import's writes get none. It reads the changes and the
  model only when the writes touch those tables and the workspace has an open change.

### Tests

- `npm run lint`, `npm run typecheck`: pass. `npm test`: **92 files, 1,230 tests pass** (18 new):
  `commands/source-change.test.ts` (9: one change group and its undo label, roles and the archive, stale, four-eyes, undo
  of a delete and of a split, a reviewer's own undo, "Approve again all" with its count, mark as needed),
  `settle.test.ts` (7 more: `settleAfterWrites` on the real commands' writes: the panel's status, deletes of a mapping,
  an attribute and an entity, a merge, an input removed, a column mapped, the table panel's delete),
  `commands/import.test.ts` (1: stored changes and events, a later import settles them, undo in order),
  `requirement-store.test.ts` (1: a format-6 file's derived change, its event, written back once, no rule broken).
- **Earlier tests changed:** the format tests expect 7 (`requirement-store.test.ts`, `working-layer-store.test.ts`);
  the hand-built row sets of `undo.test.ts` and `frame.test.ts` list `source_change`; `compare-schema.test.ts` lists it.
- **e2e, the specs the step touches** (63 tests, 9.7 min): all of `e2e/slice-07a/` (the import); S0-09; S1A-08, S1A-10,
  S1A-11, S1A-12 (D-51, four-eyes, the reviewer); S1B-05, S1B-07, S1B-11, S1B-12, S1B-13 (deletes, merge, split, drags);
  S3A-12; S3B-03, S3B-04 (deletes on live canvases); S4A-01, S4A-08, S4A-10, S4A-12, S4A-13, S2C-11, S4B1-01, -03, -05,
  -06, -08, S4B2-01, -08, -12 (coverage, requirement links on deletes). **62 passed, 1 failed: S7A-05**, not a flake: its
  two toasts now end with the changes to resolve ("…, 2 to resolve" after the partial file; "…, 8 to resolve (2 high)"
  after the CRM file: 2 new tables, 3 new columns, 1 column that left, 2 mappings sent back). Spec updated (`0145ad0`);
  then **3 of 3 passed** on its own (44, 48, 44 s).

### The write timing (section 6)

`npx tsx scripts/bench-import-write.ts 20000` (the server's steps through the local adapter, on copies of the demo
data; median of 5 after a warm-up), against the worktree at `slice-07a` in the same sitting, three rounds each side,
alternating. The bench reads the open changes as the server does now.

| Figure, 20,000 columns | `slice-07a` (3 rounds → median) | this branch (3 rounds → median) | Change | Bar |
| --- | --- | --- | --- | --- |
| First import, with change events | 2,115, 2,109, 2,290 → **2,115 ms** | 2,136, 2,181, 2,186 → **2,181 ms** | +3 % | ≤ 10 %: met |
| Re-import, 5 % changed, renamed or missing | 1,093, 1,106, 1,232 → **1,106 ms** | 1,117, 1,172, 1,154 → **1,154 ms** | +4 % | ≤ 10 %: met |
| Undo the re-import | 506, 517, 571 → **517 ms** | 562, 549, 556 → **556 ms** | +8 % | ≤ 10 %: met |
| Undo the first import | 2,481, 2,451, 2,609 → **2,481 ms** | 2,508, 2,537, 2,483 → **2,508 ms** | +1 % | ≤ 10 %: met |
| Move a card after three large imports | 1,128, 1,137, 1,549 → **1,137 ms** | 1,318, 1,157, 1,150 → **1,157 ms** | +2 % | 7a's known miss (accepted, option 1) |

The re-import raises 300 changes (the columns that leave; the synthetic system has no mappings); the data file is
47 MB after both imports instead of 44, 133 MB after three instead of 128. The undo of the re-import grows most (+39 ms):
it writes the 300 changes back too.

### Proposed decision texts (for docs/decisions.md, after your approval)

> - **D-56** Changes to resolve (slice 7b). Every source change that needs a decision becomes a change to resolve,
>   stored as it was found (kind, severity, the object, a label that survives a rename or a delete, a detail) and
>   settled with a resolution, who and when; resolved changes stay as the system's history. The kinds: a column or a
>   table left the source; a new column or table in a system imported before; and, for a mapping the import sent back
>   from approved, a type conflict, a business key column that changed type or a rule rewritten for a renamed column.
>   A business key column that changed type with no such mapping is a change of its own. High when an approved mapping
>   is affected or a business key changes type; normal otherwise. The review shows the changes and the requirements
>   whose coverage changes before the import; afterwards they wait on the system's and table's panels, counted in the
>   tree and the status bar. Every action shows what it does first and is one undo step: retire keeps a table or
>   column as historical (a mapping is historical only when every input is retired; a retired input shows "until" the
>   day it left); delete removes it from the model with its mappings, relationships and cards after showing them and
>   the coverage change (D-47); move points the inputs that read the column at another; map to an attribute (a draft);
>   not needed, which "Mark as needed" takes back; decide a new table column by column; approve the mapping again,
>   only when it fits the source and following four-eyes; leave it in review; acknowledge a business key change. "Approve
>   again all" approves the mappings one import sent back that fit and that the person may approve, and lists the others
>   apart with the reason. A change settles itself when the source settles it (back in the source, gone before a
>   decision) or when its object is deleted or its question answered elsewhere, each time with a resolution that says so;
>   nothing is dropped silently. Reviewers approve again, leave in review and approve all; the other actions are for
>   owners, admins and modelers. The changes slice 7a's imports left were derived when slice 7b was installed. The
>   project home's model consistency and the canvas's Changes view show what source changes touch; the Changes view
>   only fades, it changes no data or layout.
>
> - **D-55** (added) … An import raises the changes to resolve it finds and settles those the source settles (D-56); a
>   table or column that comes back is no longer retired.
>
> - **D-51** (added) … Moving a mapping's input to another column after its column left the source, and deleting a
>   column that is one input of a combined mapping, send an approved mapping back to review with the reason ("moved from
>   {column} after it left the source", "{column} was deleted from the source"). A change to resolve about a mapping is
>   settled by setting the mapping's status in its panel.
>
> - **D-31** (added) … A retired column has left the source, so its mappings cover no requirement either.
>
> - **D-39** (added) … The Changes view has a chip of its own. The Changes view and Focus exclude each other: turning one
>   on turns the other off, and the chip says which one is on; "Show all" turns the Changes view off.

### How to check

```
npx vitest run src/domain/source-changes src/domain/commands/source-change.test.ts src/domain/commands/import.test.ts src/data
npx playwright test e2e/slice-07a
npx tsx scripts/bench-import-write.ts 20000
```

No page shows the changes yet (step 4). In the browser, an import's toast now ends with "{n} to resolve ({h} high)";
a data file from slice 7a is upgraded on the first read (`.data/dev-db.json` gets format 7 and its derived changes).

### Open for step 4

- The panels, the review's two callouts, the tree, the status bar, the canvas row marks, the forms; "Delete table" on
  the cascade with its D-47 form (then `deleteSourceTable`'s refusal and its unit test go).
- `withSettledChanges` runs in `runCommand` only; the benchmark's own server steps (`bench-import-write.ts`) do not run
  it (imports get none anyway).

## Łukasz's answers to step 3 (25 October 2026)

Step 3 accepted, with the timings and the S7A-05 spec update. The decision texts approved with one edit: in the D-51
addition, "{column} was deleted from the source" becomes **"{column} was deleted from the model"** (the modeller deletes
it from the model, not from the source; consistent with "Deleted from the model"). The code's text changed with it
(`DELETED_INPUT_REASON`, `546c023`); the texts are in `docs/decisions.md` (`a5a6d3e`): D-56 new, D-55, D-51, D-31 and
D-39 extended.

## Handover after step 3 (25 October 2026)

Written for the session that continues with step 4.

### State

- Steps 1–3 done and accepted. Branch `slice/07b-source-changes`, last commits: `546c023` (the reason text), `a5a6d3e`
  (decisions), then this handover. Nothing pushed, no pull request.
- CI green at step 3's close: lint, typecheck, `npm test` 92 files, 1,230 tests; `npm run schema:check` passes. The e2e
  specs step 3 touched pass (S7A-05 updated). No full e2e run yet in this slice.
- **Step 4** (PRD items 9, 17, 20–24): the review's two callouts, the system and table panels with the change cards,
  the pending forms and the history, "Approve again all", the tree, the status bar, the canvas row marks, the panels'
  retired and not-needed texts, and "Delete table" on the cascade with its D-47 form. One full e2e run after it
  (answer 18).

### Only in this conversation so far (now written down)

- **Texts:** every resolution, settlement and form text is in `src/domain/source-changes/texts.ts` and listed in "Every
  resolution and settlement text" (step 2), with step 2's and step 3's changes: "Acknowledge" / "Acknowledged: hash
  keys built on it change", "Deleted from the model", "{column} was deleted from the model". The mapping panel's reason
  line becomes "Sent back to review after a source change: {reason}." (F9, accepted with the other recommendations).
- **The open points accepted after step 1:** the Move form says before the click when an input is removed ("…; the
  input from {old} is removed."); a combined mapping with one retired input shows "until {date}" on that input and its
  line segment the title "Retired: historical", type problems only through live inputs; "Approve again all" with
  four-eyes on lists "These don't fit the source yet:" first, then the four-eyes list, a mapping in both only under the
  first.
- **The worktree `../infomapper-base-07a`** (the tag, for A/B timings) stays until the close. Its `node_modules` is a
  junction to this checkout's: remove it with `cmd /c rmdir ..\infomapper-base-07a\node_modules` **before**
  `git worktree remove ../infomapper-base-07a`, or the real `node_modules` goes with it.
- **The data file:** a format-6 `.data/dev-db.json` is upgraded on its first read and written back as 7 with its derived
  changes. The e2e data is reseeded from the seed, which records no import, so e2e starts with no changes.
- **Tooling on this machine:** Python on Windows writes CRLF in text mode; edit files with `newline=""` (the repository
  is LF). Long Bash heredocs with apostrophes sometimes break in this shell; the Edit and Write tools are safer.
- **Step 5 later:** model consistency, the Changes view (exclusive with Focus, whole cards lit, a chip; F17, F18), the
  URL parameters `?map=`, `?row=`, `?system=` (F15), "Show what it touched" only on canvas pages (F16), `seed:large`
  gaining an import with changes for the Changes view's figure (question 17). Per-row fading is in `docs/ideas.md`.

### What step 4 calls (server actions, `src/app/_actions/source-change.ts`)

Each returns `ActionResult<ChangeOutcome>` with `{ resolution, label }` for the toast "{resolution}: {label}" with Undo
(`useAction`'s `run(…, { undoable: true })`, as other actions). Inputs carry the change's id and version:

| Card action | Server action | Input |
| --- | --- | --- |
| Retire: keep as historical | `retireChangeAction` | `{ changeId, expectedVersion }` |
| Move its mappings… → Move | `moveChangeMappingsAction` | `+ targetColumnId` |
| Delete… → Delete | `deleteChangeObjectAction` | `{ changeId, expectedVersion }` |
| Map to an attribute… → Map | `mapChangeColumnAction` | `+ attributeId` |
| Not needed / None of it is needed | `markChangeNotNeededAction` | `{ changeId, expectedVersion }` |
| Decide column by column | `splitChangeAction` | `{ changeId, expectedVersion }` |
| Approve the mapping again | `approveChangeAgainAction` | `{ changeId, expectedVersion }` |
| Leave it in review | `leaveChangeInReviewAction` | `{ changeId, expectedVersion }` |
| Acknowledge | `acknowledgeChangeAction` | `{ changeId, expectedVersion }` |
| Approve again all {n} → Approve {n} | `approveImportAgainAction` | `{ importId, count }`: the {n} shown; another count is refused as stale |
| Mark as needed (column panel) | `markColumnNeededAction` | `{ sourceColumnId, expectedVersion }` |

What the panels compute in the browser, from the domain (pure, no server call):

- **Which buttons:** `actionsFor(rows, change)` (`source-changes/actions.ts`); labels `ACTION_LABEL`, a new table's
  "Not needed" reads `NONE_NEEDED_LABEL`. Who sees them: approve, leave in review and "Approve again all" need
  `mapping.set_status` (reviewers too); every other action, acknowledge included, needs `model.edit`. The page already
  knows the person's rights (`editable`, and the mapping panel's status rights).
- **The pending forms:** Move: `moveTargets(rows, change)` (groups, same table first, `name · type`) and
  `movePlan(rows, change, targetId)` (per mapping: back to review, the rule after, `note` when an input is removed;
  `MOVE_HINT` under the select). Map: attributes by entity (the existing `GroupedSelect`), `MAP_HINT`. Delete:
  `sourceDeleteCascade` and `sourceDeleteImpact` (below).
- **"Approve again all":** `approveAllPlan(rows, importId, workspace, actorId, authorOf)` gives `approve`, `notFit`
  (with `why`) and `refused`; `NOT_FIT_HEAD`, `FOUR_EYES_HEAD`. With four-eyes on, `authorOf` reads the page's
  `contentAuthors` (the canvas page computes them when four-eyes is on).
- **Card texts:** `KIND_TITLE`, the change's `detail`, `object_label`, the date (`isoDate(created_at)`); resolved:
  `resolution`, `resolved_by`, `resolved_at`. Order: `byPriority` (high first). The impact line ("Feeds
  {Entity.attribute} ({status})" with requirement keys, "{n} mappings on its columns", "On {canvases}") is the review's
  `impactOf` way (`src/app/_panels/import/wizard-model.ts`) over the page's data.
- **Historical:** `isRetired`, `untilOf(column)`, `isHistorical(inputs)`, `mappingUntil(inputs)`, `inputColumnsOf`
  (`source-changes/rules.ts`).

### Where step 4 plugs in

- **The data on the page:** the canvas page (`src/app/w/[workspaceId]/p/[projectId]/c/[canvasId]/page.tsx`) already
  loads `sourceChanges` (`store.model.listChanges`) and passes it to the wizard (`importData.changes`). Pass it to the
  inspector, the left panel's tree and the status bar too; `model.sourceTables` / `sourceColumns` carry
  `retired_since` and `not_needed`.
- **The review's callouts (item 9):** `src/app/_panels/import/review-step.tsx`. The changes callout:
  `raisedCallout(plan.raises, systemName)` (warning style when one is high). The coverage callout: `coverageDelta(
  requirements, requirementLinks, scopeModelOf(state.model), scopeModelOf(materialize(state.model, applied.changes,
  ctx)))` with `applyPlan` on the plan (any `newId`; ids do not matter for coverage), `coverageChangeText(d)` and
  `d.why`; on a re-import with none: `NO_COVERAGE_CHANGE`. Both over the whole plan (7a step 5's condition). Measured:
  95 ms at the 30,000-row limit (step 2); memoise on the plan.
- **System panel (items 17, 20):** `src/app/_panels/system-panel.tsx`: "Changes to resolve ({n})" with the open cards
  (`byPriority`), "Nothing to resolve.", "{n} resolved changes" folded (resolution, who, when); per import in
  "Imports", "Approve again all {n}" when its open mapping changes have mappings in review; "Show what it touched on the
  canvas" is step 5. **Table panel (item 21):** `SourceTablePanel` in `src/app/_panels/source-panels.tsx`, its open
  changes without the history; the kind line's "Retired: historical since {date}" (`untilOf`); the columns list's right
  side "retired" / "not needed" (prototype order: retired, missing, mapped, not needed, not used). **Column panel:**
  `SourceColumnPanel` in the same file: "Retired: historical since {date}", "Marked not needed" and "Mark as needed".
  **Mapping panel:** `src/app/_panels/mapping-panel.tsx:349`, the reason line's new text (F9) and "until {date}" on a
  retired input.
- **The label link** on a card (Q9): a column kind selects the column (its row if its table's card is on the canvas,
  else `{ t: "element", kind: "source_column", id }`), a table kind the table; a deleted object's label is plain text.
- **The tree (item 22):** `src/app/_panels/tree-data.ts` (`buildTree`: tables get `missing`; add `retired` and the
  system's open count) and `left-panel.tsx`'s `sourceTree` (a retired table struck through in grey, tooltip "Retired,
  historical."; the system's count). Slice 7a's lesson: no new element per tree item (41 extra spans, `add7b0a`); the
  count is one element per system.
- **The status bar (item 23):** `src/app/_panels/status-bar.tsx`: "Source changes to resolve {n}" in the warning style,
  only while one is open (prototype), next to `status-type-problems`; test id `status-source-changes`.
- **Canvas row marks (item 24, AD-24):** `src/canvas/card-data.ts` (`buildCards` sets `missing` from `missing_since`,
  line 219): add `retired` (class `old`, title "Retired: historical"), `fresh` for an open `new_column` (class `new`) and
  `changed` for another open change on the column (class `chg`), as the prototype's `colRow` (`im-old` wins over
  `im-gone`, then `im-chg`, then `im-new`). Classes on the existing row element, styles in `src/canvas/canvas.css`; the
  line segment of a retired input keeps `s gone` and gains the title. Then the element-count guard
  (`S3B-15-elements.spec.ts` against `slice-07a`'s baseline, which needs a `slice-07a` measurement build; the worktree
  above serves).
- **"Delete table" on the cascade, with its D-47 form (Q7):** today `deleteSourceTable` (`src/domain/commands/source.ts`)
  refuses mapped tables and the panel's `ConfirmDelete` (`source-panels.tsx`, around line 200) lists columns and
  relationships. Step 4: `deleteSourceTable` builds its writes with `sourceDeleteCascade(rows, { tableId })` and
  `sourceDeleteEdits(ctx, rows, cascade)` (no change acted on; open changes settle as "Settled: the table was deleted"
  through the cascade), its server action (`deleteSourceTableAction`, `src/app/_actions/model.ts`) loads the rows a delete
  reads (as `stateOf` in `_actions/source-change.ts`); the form shows `sourceDeleteImpact(rows, cascade, { canvases,
  requirements, requirementLinks })`: "Delete the table {label} with:" its mappings (attribute, status, "deleted" or
  "loses this input"), relationships, columns, canvas cards (canvases), each requirement whose coverage changes
  ("{key} {a} of {n} → {b} of {n}", `coverageChangeText`) or `NO_COVERAGE_CHANGE`, and `DELETE_RETIRE_HINT` when the
  table left the source; Delete and Cancel. The entity delete dialog (`src/app/_panels/delete-entity-dialog.tsx`,
  `entityImpact`) is the pattern. The change card's "Delete…" shows the same impact in its pending form and calls
  `deleteChangeObjectAction`. The unit test "refuses while a mapping reads one of its columns" (`source.test.ts:124`)
  changes with it.
- **e2e for step 4:** `e2e/slice-07b/`, one file per criterion (S7B-02, -04 to -11 and -15's page parts), from the
  slice 7a helpers (`openWizard`, `giveFile`, `importNow`, `sample`, `crmPartial`); the CRM file after `crmPartial`
  raises 8 changes (2 high), which is the definition of done's scenario.

## Step 4: the review, the list and the actions (25 October 2026)

### What changed

- **The review** (`review-step.tsx`, item 9): above the tables, "Requirements whose coverage changes" (key, name,
  "{a} of {n} → {b} of {n}", why) or, on a re-import, "No requirement’s coverage changes."; then "After the import, {n}
  changes to resolve, {h} of them high. …" (warning style when one is high). Both read the whole plan:
  `planCoverage` (`wizard-model.ts`: `applyPlan`, `materialize`, `coverageDelta`), built once per plan at step 3.
- **Change cards** (`src/app/_panels/source-changes.tsx`): severity, title, the label as a link to its column or table
  (plain text once the object is gone), the date, the detail, the impact ("Feeds {Entity.attribute} ({status})" with
  requirement keys, "{n} mappings on its columns", "On {canvases}") and the actions (`actionsFor`; approve and leave for
  those with the status right, the rest for editors). Move, Map and Delete open a form in the card first. Every action
  ends with "{resolution}: {label}" and Undo.
- **System panel**: "Changes to resolve ({n})", "Nothing to resolve.", "{n} resolved changes" folded (resolution, who,
  when, newest first); per import "Approve again all {n}" with its lists ("These don't fit the source yet:" first, then
  the four-eyes list) and "Approve {k}". **Table panel**: "To resolve ({n})" with its open changes; "Retired: historical
  since {date}"; the columns list "retired" / "not needed" (prototype order). **Column panel**: the retired tag, "Marked
  not needed" with "Mark as needed". **Mapping panel**: "until {date}" on a retired input; the reason line "Sent back to
  review after a source change: {reason}." (F9).
- **Delete** (Q7): `deleteSourceTable` now runs `sourceDeleteCascade` (mapped tables included; the refusal and its unit
  test are gone). The D-47 form (`SourceDeleteForm`) reads the impact on the server (`sourceDeleteImpactAction`) and is
  the same in a change's "Delete…" and the table panel's "Delete table…".
- **Tree**: the system's open count (one element per system); a retired table grey and struck through, "Retired,
  historical." (no missing dot). **Status bar**: "Source changes to resolve {n}" in the warning style while one is open.
- **Canvas** (AD-24): row classes `old` (retired, wins), `gone`, `chg`, `new`; a retired input's line segment keeps
  `s gone` and gets a `<title>` "Retired: historical" (an element only on such a segment). Type problems count only
  live inputs (`typeCheckOf`, the card and line warnings), as answered on Q10.

### Decisions I took (please check)

1. **"Delete table…" shows the form inside the panel**, under the buttons, as a change's "Delete…" does in its card,
   instead of a dialog like the entity's: one form in both places.
2. **The delete form's impact is read on the server** (every canvas's cards, the requirements), like the entity
   delete's; reading needs membership only. The table panel's delete settles its open changes through the settle rule
   of step 3 ("Settled: the table was deleted"), not the cascade's own (no change is acted on).
3. **"Approve the mapping again" shows for the importer with four-eyes on**; the server refuses with the four-eyes
   message (as in the mapping panel). "Approve again all" says it before the click instead (its list).
4. **"Approve again all {n}"** counts every mapping the import sent back that is still in review; the form's button
   says how many it approves ("Approve 1"), disabled at 0.
5. **Texts:** the table panel's section is "To resolve ({n})" (prototype); "Mark as needed"'s toast is "Marked as
   needed: {column}"; a retired column's tag uses the day it left ("historical since" = `missing_since`).
6. **The coverage callout** shows only on a re-import (as the prototype); a new system shows none.

### Tests

- `npm run lint`, `npm run typecheck`: pass. `npm test`: **92 files, 1,233 tests** (3 new: the row marks and live-input
  type problems in `canvas.test.ts`, the tree's count and retired table in `tree-data.test.ts`; `source.test.ts`'s
  refusal test became the cascade's).
- `e2e/slice-07b/`: S7B-01 to -12 and -15, 21 tests. First run 20 passed; S7B-03 failed in the spec (it reloaded the page
  and expected the system panel still open); fixed, then **3 of 3 passed**.
- **Earlier spec changed:** S7A-10 reads the mapping panel's new reason line (F9).
- **One full e2e run** (`npm run e2e`, from scratch, no dev server): **296 passed, 0 failed, 59.6 min** (17:10–18:10).
- **Not done in this step:** the element-count guard (`S3B-15-elements.spec.ts` against `slice-07a`). "Performance
  test" has no changes and no retired column, so no element is added there; I measure it with step 5's Changes view.

### How to check in the browser

`npm run dev`, sign in as Łukasz, Retail Co – DWH, Customer & orders. Re-import CRM twice from the Sources tab: first
`crm_sqlserver_catalog.tsv` without the `segment` and `customer_addresses` lines, then `crm_snapshot_2026-10-20.csv`; read
the review's two callouts. Then: the tree's "9" and the status bar; CRM's panel (high first); retire `segment`, move
`created_ts` to `created_on` (the form shows the rule), mark `customer_segment` not needed and back in its column panel,
approve `cust_no` again or use "Approve again all 2", open "Delete table…" on customers and cancel; Undo after each.

## Łukasz's answers to step 4 (25 October 2026)

Step 4 accepted, with decisions 1, 2, 5 and 6 as taken (the delete form inside the panel, the impact read on the
server, the texts, the coverage callout only on a re-import) and the element-count guard moved to step 5. Two changes,
both from the principle that the modeller sees what will happen before it happens:

1. **Four-eyes on a card** (replaces decision 3): a button the server will refuse is not offered as if it works. When
   the person may not approve, "Approve the mapping again" shows disabled with the reason, e.g. "Someone else approves
   this: your import sent it back, and four-eyes is on.", as the mapping panel's approval behaves under four-eyes.
2. **"Approve again all {n}"** (replaces decision 4): the label does not promise more than the click does. The entry
   reads "Review the {n} sent back…" and opens the list; only the confirm button counts what it approves
   ("Approve {k}", disabled at 0).

## Handover after step 4 (25 October 2026)

Written for the session that continues with step 5.

### State

- Steps 1–4 done and accepted. Branch `slice/07b-source-changes`; step 4's commits `517e571` (Delete table on the
  cascade), `5f7a3d7` (the pages), `5b3afb4` (the tests), `95c11cf` (step 4's write-up), then this handover. Nothing
  pushed, no pull request.
- CI green at step 4's close: lint, typecheck, `npm test` 92 files, 1,233 tests. `e2e/slice-07b/` has S7B-01 to -12 and
  -15 (21 tests). One full e2e run: 296 passed, 59.6 min.
- The worktree `../infomapper-base-07a` (the tag) still stays for the A/B figures; remove its `node_modules` junction
  with `cmd /c rmdir ..\infomapper-base-07a\node_modules` **before** `git worktree remove`.

### First in step 5: the two changes above

1. **The card's approve under four-eyes** (`ChangeCard` in `src/app/_panels/source-changes.tsx`): the page knows the
   authors already (`p.fourEyes`, `p.contentAuthors[mappingId]`, `p.userId`; the mapping panel's rule is
   `fourEyesBlocks`, `mapping-panel.tsx:202`). When it blocks, render `change-action-approve` disabled with the reason
   (a line under the buttons, as the mapping panel shows `note-four-eyes`); the server still refuses. Put the text in
   `src/domain/source-changes/texts.ts`. S7B-08's four-eyes test changes: Łukasz sees the button disabled with the
   reason instead of clicking it and getting the refusal toast.
2. **"Review the {n} sent back…"** (`ApproveAgainAll`, same file): the entry button's text; the form's confirm stays
   "Approve {k}", disabled at 0. S7B-09 clicks `button-approve-all` (test id unchanged; assert its new text there).
   Then re-run S7B-08, -09 and -15 (a failing one three times on its own).

### Only in this conversation so far (now written down)

- **Test data in e2e:** `e2e/slice-07b/helpers.ts` writes imports through the domain as the upload route does
  (`importAs`, no undo step); `crmChanges()` is the definition of done's two CRM files and leaves 9 open changes (2
  high). `card(page, kind, label)` and `act(...)` drive the cards; `openSystem(page, user)` opens CRM's panel. After a
  `page.reload()` the system panel is not open any more (a selection is not kept across a reload): open it again.
- **A verify data file for the browser:** the preview config `infomapper-verify` in `.claude/launch.json` reads
  `.data/verify-db.json`; seed it with the same two imports as `crmChanges()` (a scratch script; nothing committed).
  Stop the preview server before any Playwright run.
- **Shell on this machine:** `cat > file` without a heredoc waits on stdin and hangs a Bash call, and long heredocs
  with apostrophes break. Write files with the Write or Edit tools.
- **Not done:** the element-count guard (`S3B-15-elements.spec.ts` against `slice-07a`), now in step 5. Step 4 adds no
  element on "Performance test" (no changes, nothing retired): the tree's badge, the status bar's span and a retired
  segment's `<title>` appear only with changes.

### What step 5 needs (PRD items 25–27; step 1 answers F15–F18, Q6)

- **The fade layer and Focus:** one slot, `requestFade` in `src/canvas/fade.ts` (`FadeRequest`: `{ focus }` or
  `{ lit, key }`; it compares keys only, so the key must change with the data, e.g. `changes:<open|import id>:<data
  version>`). `focusOn` (a value store, `fade.ts:74`) is Focus's switch; `FocusDriver` (`src/canvas/Focus.tsx:74`)
  writes the request from it and the selection. The Changes view: a value store of its own (momentary, like Focus,
  D-22) and a `ChangesDriver` next to `FocusDriver`; turning one on turns the other off (Q6). Nothing may re-render
  `ModelCanvas` (S4P-12, S4B1-06 count commits). The lit set (F18): touched tables and entities → their cards, touched
  mappings → their lines, a block lit when a member is, a bundle when one of its mappings is; whole cards stay lit and
  the rows keep step 4's classes. The prototype's `chgSet` defines "touched" (item 27); the page has the rows
  (`p.changes`, `isOpen`, `missing_since`, `review_reason`).
- **The toolbar button "Changes":** after Focus (`FocusButton`, `Focus.tsx:102`), into "More" at Focus's step
  (`src/canvas/more-breakpoints.ts`, `src/canvas/MoreTools.tsx`); a class switch only, nothing reads layout in a commit.
- **The view-state bar** (`src/app/_components/view-state-bar.tsx`): the chips are built around line 48 (`focusOn`
  gives the Focus chip); add "Changes: all open" / "Changes: import into {system}, {date}" with ×. "Show all" turns
  Focus off at line 99: turn the Changes view off there too.
- **The view's own bar** ("Changes", the select per import, "{n} tables, {m} mappings, {k} attributes" or "Nothing on
  record", Close): it sits above the canvas, so CLAUDE.md's rule applies (no layout read in a render or layout effect).
- **"Show what it touched on the canvas":** in the system panel's imports list (`src/app/_panels/system-panel.tsx`,
  each `import-entry`), only on canvas pages (F16); it turns the view on for that import.
- **The project home's "Model consistency"** (`src/app/w/[workspaceId]/p/[projectId]/page.tsx`): between the stats
  line and "Canvases" (line ~101). The page has the project's sets (`projectStats`, `projectRequirements`, `items`,
  `view.canvases`) and loads the model and requirements; add `store.model.listChanges`. Each line opens its object on
  the best canvas (F15): the canvas page reads `?card=`, `?label=`, `?req=`, `?note=` (around line 156 of
  `c/[canvasId]/page.tsx`) and `SelectionHistory`'s `ARRIVAL` (`src/canvas/SelectionHistory.tsx:36`); add `?map=`,
  `?row=`, `?system=` there (the system's panel opens with `openDetails`). Historical mappings (every input retired)
  stay out of type problems and consistency (`isHistorical`, `src/domain/source-changes/rules.ts`).
- **Figures (section 6, as planned):** consistency's computation ≤ 50 ms in Node (a new `scripts/bench-consistency.ts`),
  the home page's load as information, the Changes view on and off and switching the import ≤ 100 ms to the screen and
  within 10 % of Focus in the same sitting (measurement build, slice 4b-1's to-screen method), `seed:large` gaining a
  recorded import with changes on about 10 % of its tables (question 17), and the element-count guard against
  `slice-07a`. Then one full e2e run.

## Step 5: model consistency and the Changes view (25 October 2026)

### First: the two changes to step 4

- **Four-eyes on a card** (answer 1): when four-eyes is on and this person changed the mapping last, “Approve the
  mapping again” shows disabled with the reason under the buttons: “Someone else approves this: your import sent it
  back, and four-eyes is on.” (or “… you changed it last, …” when the last change was not the import; the page knows
  who imported, `SystemImport.byId`). The server still refuses. S7B-08 checks the disabled button and the text.
- **“Review the {n} sent back…”** (answer 2): the entry counts every mapping the import sent back that is still in
  review and opens the list; only the confirm button counts what it approves (“Approve {k}”, disabled at 0). S7B-09
  checks both texts.

### What changed

- **Model consistency** (item 25; `src/domain/source-changes/consistency.ts`, the home's
  `_components/project-consistency.tsx`): between the stats line and Canvases, computed on every load of the project
  home (a server component, so it is live after any action). Groups as the prototype: mappings on columns that left the
  source (high when one is approved), attributes without an active source (“its columns left the source” or
  “historical source only”), type conflicts (high when one is approved), mappings back in review after a source change
  (with the reason), affected requirements (key, name, “{a}/{n} covered”) and source changes to resolve per system
  (“{n} changes to decide”, workspace-wide). The badge counts the listed mappings and attributes plus the open changes;
  with nothing: “Mappings, types and sources agree. Nothing to look at.” Historical mappings (every input retired) are
  neither left-the-source nor type conflicts.
- **Opening from the home** (F15): each line is a link to the canvas `modelConsistency` picks (the first project
  canvas with both ends' cards, else one end's, else the first) with `?map=`, `?row=` (an attribute; its element panel
  when its card is not there) or `?system=`; requirements open as the Requirements list does (`?req=`). The canvas page
  turns them into `focusSelection` (`arrivalSelection`), `ModelCanvas` selects it once ready, centres a mapping's
  source card (else its entity's) or the row's card, and drops the parameter; the details panel opens. `SelectionHistory`
  treats them as arrival parameters.
- **The Changes view** (items 26–27): the toolbar button “Changes” after Focus (into “More” at Focus's step; the menu
  has a “Changes” item next to Focus), the bar over the canvas (“Changes”, the select “All open changes” / “Import into
  {system}, {date, time}, {source}”, “{n} tables, {m} mappings, {k} attributes” or “Nothing on record”, Close), the
  chip “Changes: all open” / “Changes: import into {system}, {date}” with ×, and “Show all” turns it off. State in
  `src/canvas/changes-view.ts` (a value store, momentary), `ChangesDriver` next to `FocusDriver` turns it into a
  `{ lit, key }` fade request (`touchedBy` in `src/domain/source-changes/touched.ts`, the prototype's `chgSet`; the key
  holds the lit ids, so a change in the data re-fades). It and Focus turn each other off (two store subscriptions); each
  driver clears only its own request. Whole cards stay lit, no rows (F18). No canvas or miniature commit when switching
  (S7B-14 checks it).
- **“Show what it touched on the canvas”** under each import in the system panel turns the view on for that import
  (F16: the panel is on canvas pages only; from a home page the way is model consistency's system line).
- **`seed:large -- --changes`** (question 17, `src/data/local/seed-large-changes.ts`): an import into each system of
  “Performance test” through the domain; 16 changes on 9 of its 60 tables (7 new columns, 7 columns left, 1 of them
  high, 2 tables left, both high). Without the flag the workspace is as before, so the element guard compares like
  with like.

### Decisions I took (please check)

1. **The four-eyes reason has two wordings:** your answer's text when this person's import sent the mapping back,
   “… you changed it last, …” when the last change was someone's edit after the import.
2. **“Attributes without an active source” is high** when one of its attributes is in an affected requirement's scope
   (the prototype makes it high whenever any requirement is affected at all).
3. **An attribute without an active source** counts every mapping of the attribute, retired inputs included (“no new
   data reaches it”); “historical source only” when one of its mappings is historical. A combined mapping with one
   retired input and the other present is neither “left the source” nor without a source.
4. **A system's line** opens on the first project canvas with one of its tables (else the first canvas); the
   requirements open as the home's Requirements list does.
5. **The Changes button** is coloured in the warning colour while on (the bar's border, as the prototype's); Focus's
   is blue. The chip shows the import's date, the select its date and time and the file.
6. **`seed:large -- --changes`** is a flag, not part of every `seed:large`, so the element guard compares
   “Performance test” as slice 7a counted it; S7B-16 seeds it with the flag.

### Tests

- `npm run lint`, `npm run typecheck`: pass. `npm test`: **93 files, 1,242 tests** (9 new in `consistency.test.ts`:
  the groups and severities, the scope, the canvas each line opens on, live after retiring, the requirements, all
  well, and what the Changes view touches for all open changes and one import).
- `e2e/slice-07b/`: **S7B-13** (4 tests: the groups, hints and badge; each line opening its object with approve and
  retire changing the home; the scope and the all-well text; a reader), **S7B-14** (4 tests: the button, bar, select,
  counts, fade, chip and Close with nothing stored changed and no canvas or miniature commit; Focus and the Changes view
  turning each other off, ×, “Show all”, a reload; “Show what it touched” reached from the home; every role and
  “Nothing on record”). S7B-08 and S7B-09 changed for the two step-4 answers. First run: S7B-13 failed twice in the spec
  (the attribute's name is in an input; approving in the panel settles its change, so the count is 7, not 8), then 3 of
  3 passed; S7B-08, -09, -14, -15 passed first time.
- **Earlier specs the step touches** (the More menu, Focus, the view-state bar, the home, the system panel, history
  places, S4P-12, S4B1-13): slice 6a and 6b whole, S0-02, -04, -07, S3A-05, S4B1-06, -08, -13, S4B2-07, -09, S5A-02,
  S7A-11: **51 passed**. No earlier spec changed.
- **S7B-16** is a measurement spec (`S7B-16-changes.spec.ts`, left out of the normal run like the other measuring
  specs).
- **One full e2e run** (`npm run e2e`, from scratch, no dev server running): **304 passed, 0 failed, 1.1 h**.

### Figures (section 6)

**Model consistency's computation** (`npx tsx scripts/bench-consistency.ts`, Node): 20,000 columns, 300 missing from
source, 2,000 approved mappings, 315 changes raised, 500 requirements: **median 23.4 ms** (fastest 21.4, slowest
31.5), bar 50 ms **met**. The requirement index the page builds anyway: 27.9 ms. (The synthetic file lists 1,619 type
conflicts, as its attributes are all string(50); a real project lists far fewer lines.)

**The project home's load** (information, measurement build, “Performance test” with its 16 changes, 7 loads):
median response end 226.9 ms, DOMContentLoaded 302.5 ms. Mostly the local adapter's read of the whole file.

**Element counts** (`S3B-15-elements.spec.ts`, measurement build; baseline from a `slice-07a` worktree with its own
`npm ci`, `.data/measure/s7b16-baseline/slice-07a.json`):

| View | `slice-07a` page / viewport | this branch page / viewport |
| --- | --- | --- |
| 100 %, frames expanded | 20,785 / 19,305 | 20,790 / 19,305 |
| 30 %, frames expanded | 5,988 / 4,508 | 5,993 / 4,508 |
| 100 %, frames collapsed | 6,297 / 4,907 | 6,302 / 4,907 |
| 30 %, frames collapsed | 2,855 / 1,465 | 2,860 / 1,465 |

The viewport is equal in all four views (the guard passes). The whole page has **+5 in each view: the Changes
button** (button, svg, two paths, the label span). Nothing else: the tree's badge, the status bar's span and the bar
appear only with changes, which “Performance test” has none of without `--changes`.

**The Changes view to the screen** (`S7B-16-changes.spec.ts`, measurement build, “Performance test” with
`--changes`, around ent:23, frames expanded, 10 switches each from a settled screen, traced, one sitting; to the
screen, median / p95, ms):

| View | Changes on | Changes off | Select: import | Select: all open | Focus on | Focus off |
| --- | --- | --- | --- | --- | --- | --- |
| 100 % | 41.4 / 102.9 | 23.7 / 32.4 | 30.5 / 45.7 | 37.8 / 55.2 | 36.2 / 46.4 | 22.5 / 25.3 |
| 30 % | 74.7 / 133.0 | 24.0 / 32.5 | 37.6 / 56.8 | 64.6 / 78.3 | 50.9 / 73.8 | 18.0 / 22.1 |

- **≤ 100 ms to the screen: met** in every case (medians).
- **Within 10 % of Focus: missed.** Turning the view on: +14 % at 100 % (41.4 against 36.2), **+47 % at 30 %** (74.7
  against 50.9); off: +5 % and +33 % (24.0 against 18.0, 6 ms). The split at 30 %, on: main thread 25.2 ms against
  Focus's 17.7, raster 42.1 against 26.8. The two do not light the same: all open changes light 22 cards spread over
  the canvas; Focus on ent:23 lights its neighbours. More holes in the veil and more lit lines mean more to raster
  after the switch; the main thread's extra is the bar and the chip appearing (above the canvas, no layout read in a
  commit) and the lit set's computation. Per the PRD, a miss stops the step: **your decision**. Options: (a) accept
  the ≤ 100 ms bar alone, since the lit sets differ, (b) let me compare against Focus on a selection that lights about
  as many cards (a frame or a multi-selection of the 22), or (c) let me take phase traces of the 30 % case (script,
  style, layout, paint, layerize, as S6A-09-hand does) to find what to cut.

### How to check in the browser

`npm run dev`, sign in as Łukasz, Retail Co – DWH. Re-import CRM twice as in step 4 (first
`crm_sqlserver_catalog.tsv` without the `segment` and `customer_addresses` lines, then `crm_snapshot_2026-10-20.csv`).
- Customer 360's home: “Model consistency 16” between the stats and Canvases; click a mapping line (the mapping's
  panel on Customer & orders), the attribute line, the CRM line (CRM's panel). Approve `email_addr → email` in its
  panel or retire `created_ts` in CRM's panel, then the Home tab: the lines and counts change.
- On the canvas: the triangle button after Focus (“Changes” on a wide window): the bar, the fade, the chip; the select
  per import; Focus turns it off and back; “Show what it touched on the canvas” under each import in CRM's panel.
- With four-eyes on (workspace settings): CRM's card for `cust_no` shows “Approve the mapping again” disabled with the
  reason; the import's entry reads “Review the 2 sent back…”.
