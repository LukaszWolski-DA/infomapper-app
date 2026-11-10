# CLAUDE.md – InfoMapper

Read this file at the start of every session. It is short on purpose; the details are in `docs/`.

## What this is

InfoMapper is a data-modeling application for data warehouse work. Business analysts model concepts, entities and
attributes, describe physical source tables and columns (by hand, or imported and re-imported from a file, a catalog
query's result or DDL scripts, slice 7a), map columns to attributes, and trace requirements to all of it. A re-import
turns every source change that needs a decision into a change to resolve, settled on the system's panel with one undo
step per action (slice 7b, D-56). Source tables and columns carry the workspace's classifications (built-in ones with
fixed codes the rules read, and the workspace's own) and the modeller's notes; an import reads and suggests
classifications, and in Data Vault 2.0 mode a table panel shows its Data Vault reading (slice 7c, D-57). One workspace
holds one model; projects and canvases organise the work on it. Organizations are silos: in development people sign in
with an organization's shared password or the test users' list, create organizations, and owners and admins add,
change and remove people (slice 8, D-58). Panels save one object at a time, each save with the newest version known; a project's name
and description are edited on its home, and a zoom is typed in the top bar (slice 9, D-59, D-60). An attribute can be
copied and pasted into any entity; the copy follows its original's type and Personal data (slice 10c, D-63). Entities
and attributes have an alias; each canvas shows names or aliases in two dimensions, with exceptions per card (slice 11,
D-64). Both home pages have the canvas pages' Undo and Redo on the same history, and a project is deleted from its home
with the canvases only it uses, one undo step (slice 12a, D-65). Canvas tiles show a thumbnail of the canvas's layout and
count its frames, and the workspace home's project tiles show their first canvas's (slice 12b, D-29, AD-32). A text
field keeps what the person typed across fresh pages and after any refusal; a conflict shows the other value under it
with "Use this" and "Keep mine" (slice 13, D-66). Notes and frames
follow the same rule: a note's text keeps its draft on the canvas, in its panel and in the panels' lists, with a "Not
saved" mark after a refusal; a frame's name has the conflict line (slice 14a, D-66). The canvas's own row saves on the
same chain (its look, the names switch, a rename in its tab, its delete), a refused rename keeps the typed name in the
tab with the conflict line, the change-to-resolve actions hold the panel saves of their change's tables, and a page
with unsaved text asks the browser to warn before it is reloaded or closed (slice 14b, D-66). InfoCube is the first
module (slice 15a, AD-33 to AD-35): an organization's licence and a workspace's switch, facts and dimensions as entities
of the dimensional level with a role, a Cube tab, relationships and paste within a level, and source columns mapped to
logical attributes only. A fact has a grain, measures (Σ marks on its rows) and its dimensions with the keys that carry
them; a dimension has an SCD type; every relationship has a role name per end, on its pill, so one dimension plays
several roles (slice 15b, D-68). Dimensional mappings feed a fact's or a dimension's attributes from logical attributes:
lines between rows, drawn by a drag in either direction, with their own panel, approved by reviewers with four-eyes and
sent back to review by D-51's first rule; a dimensional entity's coverage counts what is fed, and "Create dimension from
this…" makes a dimension from a logical entity (slice 15c, AD-36, D-69). Requirements link to facts, dimensions and
their attributes; their scope and coverage run through dimensional mappings (D-31's rule at both levels), the lens and
Focus follow them, a fact's or a dimension's panel shows "Fed from concepts", and the Cube tab's "Bus matrix" shows
facts against dimensions, one dot per relationship (slice 15d, D-70). An entity card header's menu adds an attribute; a
canvas tab's menu (also a tile's on the project home) moves the canvas in its project's order, one undo step, and hides
relationship lines by kind (between entities, between source tables) with a chip in the view-state bar; the browser's
context menu is not shown in the app outside text fields, the description editor, links and selected text; a right drag
pans without a toolbox on every platform, the top bar never scrolls, and the canvas stores its view at once after its own
changes (slice 16, D-71). Outside a concept frame a new entity's, fact's or dimension's concept is chosen in a picker;
element panels link several requirements at once and an entity panel all its attributes; a requirement card links by a
drag from its handle; an entity found by an attribute shows that row; a selected frame resizes from every edge and
corner; an attribute row's menu adds an attribute below it (slice 17, D-72). An attribute may be calculated from others
of its entity with a plain-text rule, counted as mapped or fed and covered through its inputs everywhere, with "=" and a
square on its row; a dimensional mapping may be a Lookup through a dictionary's relationship (slice 18, D-73). A fact has
a type (Transaction, Periodic snapshot, Accumulating snapshot), may be factless and may be an aggregate of another fact; a
dimension has a kind (Standard, Junk) and a history (SCD 0, 1, 2 or Snapshot with its period); an outrigger is derived
from a relationship between two dimensions; the role chip names them (slice 19, D-74). The model is checked as it stands, read only:
duplicate names, calculations also mapped, lost originals, copied keys and relationships without them, and with InfoCube
the facts' hints and the approved feeds the logical model no longer supports; the project home lists them, cards carry a
slanted "!", the status bar counts them and the panels show their own (slice 20, D-75). A logical row dropped onto a source
column maps them as the opposite drag does; the concept picker makes a new concept with the entity, fact or dimension in
one undo step; a requirement gap says "column left the source"; the mapping rule keeps its draft; the settings set a
concept's colour (slice 21, D-76). A dimension has an unknown member, on unless turned off, with a value per attribute
(defaults by type, a value that does not fit its type marked), shown in a fact's Dimensions and as a lookup's placeholder,
with two model checks (slice 22, D-77).

The product owner is Łukasz. He accepts every slice. He reads Polish and English; code, comments, commit messages
and docs in the repository are in English.

## Sources of truth (read before changing behaviour)

| What | Where |
| --- | --- |
| How the product behaves | `docs/prototype/infomapper-prototype-with-sources.html` (open it in a browser and use it) |
| Why it behaves that way | `docs/decisions.md` (`D-xx` UX, `AD-xx` architecture) |
| Tables, columns, rules | `docs/data-model-v2.md` and `supabase/migrations/` |
| What to build now | `docs/prd/slice-XX-*.md`, the current slice only |

If these disagree, stop and ask. Do not resolve a conflict silently.

## How we work (AD-25)

- **One slice at a time.** Build only what the current PRD asks for. Do not add features, screens or options that
  are not in it, even small ones. Put ideas in `docs/ideas.md` and mention them at the end of your answer.
- **Work in the steps the PRD lists, and stop after each step** with a short summary of what changed and how to
  check it. Wait for Łukasz before the next step unless he said to continue.
- **Step 1 checks the PRD against the code.** A PRD is a proposal to verify, not a specification: it is written
  without reading the code (The slice cycle, 1). In step 1, check every item, decision and acceptance
  criterion against the code, `docs/decisions.md` and the earlier slices' acceptance docs, and write into
  `docs/prd/slice-XX-acceptance.md` where the PRD is wrong, contradicts the code or a decision, duplicates what the app
  already has, misses what the code needs, or costs more than it assumes (data model, undo, change events,
  performance), each with the files and functions behind it and a proposal. List the differences between the
  reference prototype and the app that the slice touches. No application code in step 1; Łukasz answers before step 2.
- **One branch per slice** (`slice/00-skeleton`, …), small commits in Conventional Commits style
  (`feat:`, `fix:`, `test:`, `docs:`, `chore:`). Never push to `main` directly.
- **Done means:** the PRD’s acceptance tests pass, `npm run lint`, `npm run typecheck` and `npm test` pass, the full
  run (Testing, "Test runs") passes, and you have described anything you assumed.
- **When unsure, ask.** A question costs less than a wrong guess.

### The slice cycle (Łukasz, 9 November 2026)

1. **Decisions, prototype, PRD.** A slice starts with design decisions (options and a recommendation; Łukasz decides),
   then the prototype is changed and Łukasz accepts it, then the PRD is written from the docs and the accepted
   prototype, without reading the code. Step 1 checks it against the code.
2. **Two paths.** The PRD says which. The light path (two steps: step 1, then build and close) is for a small slice
   that changes no data and no shared infrastructure (the list in "Test runs"' exception). The full path (three or four
   steps) is for a slice that changes the data model, the local file's format or shared infrastructure; changing shared
   infrastructure as the PRD plans it is allowed in a slice, with a full run in that step (the same exception).
3. **Files from Łukasz.** A PRD or prototype he hands over is in his Downloads folder. Copy it into the repository, check
   it with `cmp` and against the SHA-256 the prompt gives, and stop if either differs. The prototype in
   `docs/prototype/` is replaced by the version accepted for the slice, under the same file name
   (`infomapper-prototype-with-sources.html`).
4. **A defect in shared infrastructure is fixed outside slices** (the list in "Test runs"' exception): repairing a
   defect found during a slice goes to its own `fix/…` branch from `main`, one thing per branch, with its own PR and its
   own full run. The slice reports it and does not fix it. Changing shared infrastructure as a PRD plans it is allowed
   in a slice (the full path, 2).
5. **CI early.** Open a draft PR for the slice's branch at step 2, so CI runs on every push. Never add the label
   `full-e2e` or start the E2E workflow unless the step or Łukasz says so. The exceptions are explicit: the single-file
   check for a failing test, and the full runs the "Test runs" rules require.
6. **Stop rather than decide.** Stop and report when: a performance bar is missed (a gate, Testing, "When to measure";
   report the split, do not optimise further or add deferred or incremental computation on your own); more earlier specs
   change than the acceptance doc lists; a measuring sitting cannot start (never close or change Łukasz's programs); KB
   would need a write (the local file's format upgrade on KB happens only in Łukasz's own manual acceptance, after the
   backup "Łukasz's test model" requires). KB is read only on a copy of a backup, printing counts only.
7. **Closing.** The last step updates the docs and quotes every new or changed decision (D-, AD-) in full for Łukasz's
   approval; the full run goes ahead on the final commit without waiting for it (a later commit keeps the run valid as
   "Test runs" allows). It ends with the manual acceptance steps. Merge and tag only on his command; that command's
   prompt holds the merge and only what he asks for, and first checks that the approved decision texts are committed and
   CI passed on the last commit, stopping if not.

## Architecture rules

**Layers (AD-19).** Code lives in `src/`:

```
src/domain   pure TypeScript: types, commands, validation, business rules. No React, no Next.js, no database.
src/data     repository interfaces and their adapters: a local JSON-file adapter now (AD-29), Supabase later.
             Only this layer touches stored data.
src/app      Next.js App Router routes, server actions, route handlers, screens.
src/ui       shared UI components (shadcn/ui based).
src/canvas   the modeling canvas.
tests/       repository-level checks outside the layers (e.g. the layer rules). Not application code.
```

Imports go one way: `app` → `canvas` → `ui` → `domain`; `app` and `canvas` may also skip a step (e.g. `canvas` → `domain`);
`app` → `data` → `domain`. `ui` never imports from `canvas`. `domain` imports nothing from the other layers.
`npm run lint` enforces this (`eslint.config.mjs`).

**Modules (AD-33, slice 15a).** A module's code is in `src/modules/<module>/` in the same five parts (`domain`, `data`,
`ui`, `canvas`, `app`), each under its layer's rules; a module part may import InfoMapper's layers, **InfoMapper's layers
never import a module** (lint, with probes in `tests/layer-rules.test.ts`). `src/compose/` is the **composition root**:
the only code that names the modules, imported only by `src/app` (it may import `domain`, `data`, `ui`, `canvas` and the
modules, never `app`). A module reaches InfoMapper only through these extension points (AD-33 names the first two and points here: keep this
list up to date in each sub-slice):
- **Tables:** the table registry (`src/compose/tables.ts`: `UNDO_TABLES`, `STORE_SCHEMA`, `ComposedDb`). The build fails
  when a module's table is missing from undo, the local adapter's rules or the data file's shape;
  `tests/table-registry.test.ts` (the guard test) checks every table the migrations create against them, and a table
  that is not registered is refused loudly, never skipped. Since slice 18 a module's column added after its table had
  rows has a default (`TableRules.defaults`, read by the store's `modules.list` and `loadForUndo` through `readRows`) and
  an undo image default (`ModuleUndoTable.defaults`), with no file format (AD-33). Read a module's table only through a store made with
  `getDataStore(STORE_SCHEMA)` (the default store knows InfoMapper's tables only and throws).
- **Cascades:** `moduleCascade` (`src/domain/commands/module-cascade.ts`, run by `runCommand`): a module's rows that
  point to a deleted InfoMapper row go in the same change group; the parents are the ones the module registered for undo.
  Since slice 15c a table may also go whole with a row that points to it (`goesWhole` in its undo registration, Q-5):
  a dimensional mapping goes when the cascade deletes one of its inputs; an input removed on purpose leaves it. Since
  slice 18 a row may outlive a row it points to (`follows: [column, table, rule]`, F16): when that row is deleted, the
  module's pure rule changes it in the same change group or leaves it (InfoCube: an approved lookup whose relationship
  goes is sent back to review, keeping the id; since slice 19 an aggregate's base is cleared when its base fact goes).
- **Older rows and reverts** (slice 19): a module changes its own rows' shape with `TableRules.upgrade` (pure,
  idempotent), which the local adapter runs on every row of the table when the file is loaded, before any read, check or
  write (`upgradeRows`; InfoCube's `scd_type` became `history`). A module refuses a revert with
  `ModuleUndoTable.revertRefusal`, called by undo for each table the revert touches, beside InfoMapper's own checks
  (InfoCube: no aggregate of itself, at any depth, and no aggregate of a deleted fact).
- **Rules InfoMapper's commands take as arguments** (`src/compose/model.ts`, e.g. `relationshipOneEnd`) and the level
  rules on every write set (`src/domain/model/levels.ts`: `levelWritesRefusal`, `mappingWritesRefusal`).
- **Pages:** `ModuleView` (`src/ui/modules.ts`, built by `moduleView` in `src/compose/view.ts`): plain data and server
  actions (an entity's role, left panel tabs, creates for the tab and the toolbox; since slice 21 a create's
  `EntityCreateInput` takes `newConcept: { name }` in place of `conceptId`, exactly one of them, and the module passes it
  on to InfoMapper's `createEntity`, which makes the concept in the same change group and names the undo step), handed down through
  `ModulesProvider`, `buildTree` and `buildCards`; delete previews (`moduleEntityDependents`); the settings' boxes
  (`settingsBoxes`); the module's CSS (`src/compose/styles.ts`); its demo data (`src/compose/seed.ts`). Since slice
  15b `ModuleView` also has `rowMarks` (classes on an attribute's card row by attribute id, through `buildCards`' last
  argument to `CardRow.mark`; `withClips` counts `ROW_MARK`), `attributeDeletes` (what an attribute's delete takes
  along, for its second click: `also` and `then`, joined by `attributeDeleteParts` in `src/app/_panels/fields.tsx`, the
  panel's and the canvas menu's) and `data` (each module's own rows for its panel sections, keyed by the module,
  without `created_*` and `updated_*`; InfoMapper never reads it). Since slice 15c:
  - `rowFeeds` (by attribute id: `n` inputs, the row dot's `title`, the entity panel's `list` text): a module's own
    coverage of a row, read by the card's dot, the Mapped filter, the coverage bar, the entity panel, the Overview
    (`coverage` in `stats.ts`) and the thumbnails; `EntityRole.feed` gives the words ("fed", "no feed", the titles).
    The homes and the thumbnail route read it through `moduleRowFeeds` (`src/compose/view.ts`, the composed store);
  - `AttributeDelete.toast` (the delete toast's parts, P10);
  - `moduleView` takes the page's change events: a module's four-eyes reads its own change log with
    `lastContentEditor(row, events, log)` (`MappingLog`, `src/domain/model/mapping-rules.ts`).
  - Since slice 18 `relationshipDeletes` (by relationship id: the `then` parts of a relationship's second click), read
    by the relationship panel and the line's menu; without it a relationship is deleted at once.
- **Canvas lines and objects** (slice 15c): `CanvasLines.modules` (`ModuleLineData`, `src/canvas/line-data.ts`; built
  by `moduleLines` in `src/compose/view.ts`): lines between entity rows, drawn from what the module says (a class, a
  colour, an end mark, a chip). Code that does not know them leaves them out (as `sources`); hover, Focus, the Changes
  view, collapsed frames and the miniature handle them. Their selection is `{ t: "ext", kind, id }`, a history place.
  `CANVAS_EXTENSIONS` (`src/compose/canvas.ts`, apart from the index): per kind a `CanvasExtension`: `useHandlers`, a
  hook the canvas host calls once per render with `CanvasExtContext` (its line's text when gone, its menu, Delete, a
  row's drag with what it lights and its drops (since slice 21 a logical row's drop on a column is InfoMapper's: the
  canvas host composes its own target, the table cards, with the module's drag; `canvas-host.tsx` `rowDrag`, `dropRow`), `cardMenu` items before "Delete from model…", an `overlay` such as its
  own dialog), and its `Panel` in the details panel (`src/canvas/extensions.ts`).
- **Panel sections** (slice 15b): `PANEL_SECTIONS` (`src/compose/panels.ts`): the entity, attribute and relationship
  panels render every module's section of their kind (the entity's after its definition, the attribute's before it,
  the relationship's before its actions) and pass only the panel's own props. A module's section saves on the chain
  (`saveRow`, `saveRows`, `useChoice`, `TextField` with `keep`) through its own actions. Since slice 15c
  `attributeFeeds`: after InfoMapper's "Comes from", which a dimensional attribute does not show (its feeds are the
  module's).
- Server actions a module's `app` part needs from InfoMapper live outside "use server" files (`src/app/_lib/model-command.ts`):
  every export of a "use server" file is a server action. `CREATE_ACTIONS` is in `src/compose/actions.ts`, apart from
  the index, so tests that import `@/compose` never load server-only code.
- **Requirements and the Cube tab's dialogs** (slice 15d):
  - `AttributeFeeds` (`src/domain/model/requirements.ts`): what feeds a dimensional attribute (`{ id, approved,
    typeConflict, inputs }` per mapping), an optional last argument of `lookupModel`, `buildRequirementIndex`,
    `requirementScope`, `requirementCoverage`, `requirementsOf` and `coverageDelta`; without it every result is the old
    one. The module builds it (`cubeRequirementFeeds`); a canvas page derives it from `ModuleView.data` with
    `requirementFeeds` (`src/compose/feeds.ts`, pure), and `ModulesProvider` (with the page's `model`) provides it to
    the browser as `RequirementFeedsCtx` (`src/canvas/fade-canvas.tsx`, `useRequirementFeeds`): the canvas, the
    inspector and the import review read it. The homes and `sourceDeleteImpactAction` read it with `moduleFeeds`
    (`src/compose/view.ts`; `moduleRowFeeds` is its `rowFeeds`). **A later caller of the requirement index** passes the
    feeds.
  - The scope's `feeding` and `feeds` (present only with a feed), the index's `attributeCoverage`, `gapReason`
    (`GAP_REASONS`, one set at both levels) and `isDimensional`; `Lit.lines` (a requirement's Focus lights only its own
    module lines; `litModules`).
  - `ModuleTab.actions` (`src/ui/modules.ts`): buttons after a tab's creates, for every role, that open the dialog
    `TAB_DIALOGS[key]` (`src/compose/tab-dialogs.ts`) with `TabDialogProps` (`openEntity`, `openRelationship`); the bus
    matrix reads its rows on demand through `modelRead` (`src/app/_lib/model-command.ts`: session, membership, an
    unlocked organization, a read only).
  - `PANEL_SECTIONS.entityFeeds`: where a logical entity's "Feeding sources" are, which a fact or a dimension does
    not show ("Fed from concepts").
- **Model checks** (slice 20, D-75): InfoMapper's rules and the index are `src/domain/model/checks.ts` (`modelChecks`,
  `checkIndex`, `projectScope`, `coverageGapText`, `CHECK_TEXTS`); a rule gives `CheckItem`s (what it opens, the panels
  that list it, its marks, the entities it names) whose words are built by `text()` only where they are shown
  (`lineOf`). A module adds `ModuleChecks` (its groups, its topic and its empty-text part) through `src/compose/checks.ts`:
  `cubeModuleChecks`, `pageModuleChecks` (a canvas page, from `ModuleView.data`), `pageCheckIndex` (the browser's index),
  `extEntities` and `extGoneText` (`?ext=`); the home's one read of a module's rows is `moduleHomeData`
  (`src/compose/view.ts`). The rules read the requirement index's `lookup` (`RequirementIndex.lookup`) and a cube index
  passed in. A canvas page's index lives in `ModulesProvider` (with the page's one requirement index,
  `RequirementIndexCtx`, `ChecksCtx`, `src/canvas/checks.ts`). **A later rule** is a group of `CheckItem`s, its texts in
  `text()`; **a later caller of the requirement index** on a canvas page uses the page's (`usePageRequirementIndex`).
- **A new module** adds its folder, its name to `modules` in `eslint.config.mjs`, its tables to the registry's three
  records and a migration, and its pieces to `src/compose/`; InfoMapper's code does not change.

**Writes (AD-23).**
- Every write goes through the server (server actions or route handlers) and then through a `domain` command.
  The browser never writes to the database and never holds the service-role key.
- A write command: checks permissions (role, archive, four-eyes; AD-05, AD-06, AD-09), validates input (Zod at the
  boundary), checks `version` (optimistic concurrency, AD-12), writes the rows **and** their `change_event` records in
  one transaction (AD-13), and returns the new state.
- Deletes are soft (`deleted_at`). Cascades are done by the domain, not the database.

**Data (AD-10 – AD-18).**
- Ids are UUID v7 created in the application (`src/domain/ids.ts`). The database never generates ids.
- Every model and work table has `workspace_id`; every query filters on it.
- Closed value lists are `text` with a `CHECK` constraint. No enum types, triggers, stored functions or arrays in
  the core schema.
- Rich text: store sanitized HTML in `*_html` and the server-derived plain text in `*_text` (AD-17). Sanitize on the
  server even if the client already did.
- Migrations: new file in `supabase/migrations/` named `YYYYMMDDHHMMSS_description.sql`. **Never edit a migration
  that has been applied**; write a new one. Every new table gets `alter table … enable row level security;`.

**UI (AD-20).** Tailwind and shadcn/ui; Tiptap for rich text. Match the prototype’s layout, wording and behaviour;
visual polish may improve, behaviour may not change without a decision.

**Canvas (AD-24).** React Flow with the named workarounds listed under AD-24 in docs/decisions.md. Follow them in all canvas work; the spike in spikes/canvas-react-flow shows how.

**Local adapter and development sign-in (AD-29).** Until the database slice (last, AD-31), data lives in a JSON file
on the server (`.data/dev-db.json`, git-ignored) and people sign in by picking a test user. Both exist only in
development: a production build must refuse to start them. The local adapter enforces the same rules as a real database would:
versions, change events in the same write, uniqueness and the “exactly one target” checks from the data model.

## Testing (AD-21)

- `domain`: Vitest unit tests next to the code (`*.test.ts`). Every business rule gets a test.
- Each slice: Playwright end-to-end tests in `e2e/slice-XX/`, one per acceptance criterion in the PRD, named after
  the criterion id. They run against a seeded local database, never against production.
- **Test runs** (Łukasz, 4 November 2026; one regime for every slice, replacing slice 4b-2's and 5a's; the full run and
  the single-file check in GitHub Actions since chore CI e2e, 6 November 2026):
  - After each step: the slice's specs, the earlier specs of what the step touched, and CI (lint, typecheck, unit
    tests). A failing test is run three times on its own to tell a flake from a bug: the single-file check below.
  - **Exception:** a step that touches shared infrastructure (undo and change groups, the save chain, the canvas's
    layers, the table registry, the local adapter) runs one full e2e run in that step, and its report says why.
  - Before a merge: one full e2e run. It also counts for a later commit when the diff from the tested commit touches
    only Markdown files in `docs/` and the repository root; the report shows it with `git diff --stat <tested>..HEAD`
    (Łukasz, 7 November 2026).
  - **The full run is the workflow "E2E" (`.github/workflows/e2e.yml`) on the commit the report names:** its eight parts
    (`e2e/parts.ts`) side by side on GitHub's Linux runners, each with its own fresh dev server, no retries; one job
    merges their reports. Start it by hand (`gh workflow run e2e.yml --ref <branch>`, or "Run workflow" on the Actions
    page) or with the label `full-e2e` on the pull request (it tests the branch's head commit). A push starts none; a
    second full run for the same branch cancels the first. A run with the input `parts` (e.g. `1 7`) is for trying the
    workflow and is **not a full run** (its summary says so).
  - **The single-file check:** `gh workflow run e2e.yml --ref <branch> -f files="e2e/<folder>/<spec>.ts ..." -f
    rounds=3`: `rounds` jobs side by side, each with its own fresh dev server, each running the files once (paths under
    `e2e/` only, checked before a server starts).
  - **What a run leaves** (14 days, on the run's page): the job summary (the commit, counts, failed tests, each part's
    time, heap peak against the runner's restart threshold, lowest available memory and restarts printed, and the folder
    times); the artifact `report` (the merged HTML report with the failures' traces, and `report.json`); per part
    `part-<n>` (`test-results/part-<n>/`: traces, `server.log` with the dev server's output, the memory log
    `e2e-memory-ci-part<n>.*.jsonl`, `part.json`); per check round `check-round-<n>`. Download with
    `gh run download <run id> -n <artifact>`. Never upload `.data/` (it holds the session secret).
  - Report each full run's link, commit, wall-clock, its parts' times and heap peaks, and passed / failed / skipped /
    expected failures. Expected failures are `test.fail` with a condition and a known limitation, only on Łukasz's
    decision (none since slice 16, which fixed S2B-06's right drag off Windows and S6A-10 at 1,201 px on Linux). PRDs no
    longer call a slice small or large.
  - **The local run is the fallback** when GitHub is down: `npm run e2e` (from scratch, no dev server running) runs the
    same parts one after another on the laptop (about 95 minutes); a single-file check is the same `npm run e2e --
    <file>` three times, one after another, each with a fresh server. Keep a failing local run's traces
    (`test-results/part-<n>/`) and log before any rerun. The e2e run has been run in Europe/Warsaw only (the workflow
    sets `TZ`).
- **A race in a test** (Łukasz, 9 November 2026): find its cause. The test waits for a state the user can observe
  (a text, a class, a count), never for a fixed time, and its assertions stay as they are. If the cause is in the
  application, fix it and report it as a bug, unless the cause is shared infrastructure (The slice cycle, 4).
- **When to measure** (Łukasz, 9 November 2026): a measuring sitting only in a slice that changes how the canvas is
  drawn (cards, lines, layers), as that slice's performance gate; otherwise the element guard, LayerTree and the commit
  counts are enough. The bench bars listed under "Commands" stay gates (they came from decided PRDs); a new bench has a
  bar only when Łukasz approves one (usually in step 1), and without one it reports a reference figure.
- Use `data-testid` attributes for elements tests need; name them after the components (e.g. `card-entity`,
  `panel-inspector`, `nav-breadcrumbs`).
- **Łukasz's test model** (since slice 8's manual acceptance, 28 October 2026): the organization KB with the workspace
  "Kanton Basel" in his `.data/dev-db.json` is a real business model he builds by hand to test and give feedback; later
  acceptance sessions use it. Never run `npm run reset-dev-data` on that file without a fresh backup and his OK; back it
  up on request and before a slice that changes the local file's format (`.data/backups/dev-db-<yyyymmdd-hhmm>.json`,
  the newest also `.data/backups/kb-model-latest.json`; git-ignored). It holds his real e-mail and KB's password hash,
  so it is never committed; it stays on his disk only (his decision, 28 October 2026).

## Security

- Secrets only in `.env.local` (git-ignored). Keep `.env.example` up to date with every variable, without values.
- The Supabase service-role key is used on the server only. Row Level Security stays on for every table with no
  public policies unless a decision says otherwise.
- Never log personal data or rich-text content.

## Things not to touch

- `docs/prototype/` – the frozen reference: changed only by replacing it with the version Łukasz accepted for a slice
  (The slice cycle, 3).
- `spikes/` – throwaway evaluations; only change them when asked.
- `docs/decisions.md` and `docs/data-model-v2.md` – change only together with Łukasz, in the same pull request as the
  code that needs the change. Decisions are taken before the prototype (The slice cycle, 1) and written into
  `docs/decisions.md` at the closing (7); a change to the process alone may change `docs/decisions.md` without code, on
  Łukasz's explicit instruction.

## Commands

```
npm run seed             # demo data into .data/dev-db.json (only if it does not exist yet)
npm run reset-dev-data   # replace .data/dev-db.json with fresh demo data
npm run demo             # the demo data with the Sales star in .data/demo-db.json (seeded if missing; -- --reset), on http://127.0.0.1:3001 beside npm run dev; never touches .data/dev-db.json
npx tsx scripts/licence.ts grant "<organization name>" infocube [--file <db>]   # slice 15a: a module's licence in a local file (development only)
npm run seed:large       # add the workspace "Performance test" (the spike's 100 cards, labels and notes; slice 4b-2: a second canvas with 12 requirement cards) to .data/dev-db.json
npm run dev              # local app on http://localhost:3000; sign in at /sign-in by picking a test user
npm run build            # production build (npm start serves it; no dev sign-in, no local data)
npm run measure:build    # measurement-only production build in .next-measure (AD-31)
npm run measure:start    # serve it on http://127.0.0.1:3300 with INFOMAPPER_MEASURE=1 (local adapter, dev sign-in)
npm run lint             # ESLint, including the layer rules (eslint-plugin-boundaries)
npm run typecheck        # next typegen && tsc --noEmit
npm test                 # Vitest: src/**/*.test.ts and tests/
npm run e2e              # Playwright: e2e/; own dev server on port 3200, .data/e2e-db.json reseeded before every test
npm run e2e -- --part 2   # one of the full run's eight parts (e2e/parts.ts); `npm run e2e -- <files>` is one run as before
npm run e2e -- --list    # each part's files, as CI runs them (--part <n>: one part); starts no server
gh workflow run e2e.yml --ref <branch>                                          # the full run in GitHub Actions (or the label full-e2e on the pull request)
gh workflow run e2e.yml --ref <branch> -f files="e2e/slice-06a/S6A-07.spec.ts" -f rounds=3   # a single-file check: 3 jobs side by side, each with a fresh server
gh run download <run id> -n report                                              # a run's merged HTML report and report.json (also part-<n>, check-round-<n>)
E2E_MEMORY_LOG=1 npm run e2e   # with the e2e server's and the machine's memory every 5 s (.data/e2e-memory-<time>-part<n>.*; scripts/e2e-memory-report.ts)
MEASURE=1 npx playwright test e2e/slice-01a/S1A-14.spec.ts   # canvas performance in headed Chrome (S1A-14)
MEASURE=1 npx playwright test e2e/slice-01b/S1B-09.spec.ts   # card resize (C-09), same way
MEASURE=1 npx playwright test e2e/slice-01b/S1B-10.spec.ts   # hover delay (C-10), pan and zoom against slice 1a's median
MEASURE=1 npx playwright test e2e/slice-02a/S2A-14.spec.ts   # group drag and lasso marks (S2A-14)
npm run measure:canvas                                        # every canvas figure, production build, A/B vs slice-02a (slice 2p)
npm run measure:canvas -- --rounds 1 --against slice-02p     # one quick round against slice 2p (slice 2b, S2B-14)
npm run measure:canvas -- --quick --rounds 1 --against slice-02b                            # S2C-12, frames expanded
npm run measure:canvas -- --quick --rounds 1 --against slice-02b --branch-diag collapsed    # S2C-12, all frames collapsed
npm run measure:canvas -- --quick --rounds 1 --against slice-02c                            # S3A-14, labels and notes on
npm run measure:canvas -- --quick --rounds 1 --against slice-02c --branch-diag collapsed    # S3A-14, all frames collapsed
npm run measure:canvas -- --quick --rounds 2 --against slice-03a                            # S3B-15 (b), balanced, frames expanded
npm run measure:canvas -- --quick --rounds 2 --against slice-03a --branch-diag collapsed    # S3B-15 (b), all frames collapsed
MEASURE=1 MEASURE_BUILD=production ELEMENTS_BASELINE=<file> npx playwright test e2e/slice-03b/S3B-15-elements.spec.ts  # S3B-15 (a) element counts
MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-03b/S3B-15-live.spec.ts     # S3B-15 (c) a live canvas against Performance test
MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-04a/S4A-14-elements.spec.ts # S4A-14 viewport counts against slice-03b's (+1, slice 4p's overlay)
MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-04p/S4P-fading.spec.ts      # slice 4p's fading scenarios (measure:canvas runs it on both sides)
npx tsx scripts/measure-trials.ts --rounds 3 --against slice-04a --sides perf/4p-trial-a,perf/4p-trial-f1  # trial branches in one sitting
MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-04p/S4P-10-c08.spec.ts     # C-08 diagnosis, traced (never in a timed sitting)
npx tsx scripts/c08-waiting.ts .data/measure/s4p10-traces/<time>                           # C-08's waiting after the document, from the raw traces
MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-04p/S4P-11-index.spec.ts   # the requirement index in the browser
SCREENS=<folder> npx playwright test e2e/slice-04p/S4P-04-screens.spec.ts                   # screenshots beside the prototype
npx tsx scripts/bench-requirement-index.ts                    # the requirement index on 500 requirements, 5,000 attributes (not a gate); slice 15d: also with 1,500 feeds (bar +25 %)
npm run measure:canvas -- --to-screen --rounds 3 --no-build --against slice-04p             # slice 4b-1: interactions to the screen, pans as presented frames (traced)
npm run measure:canvas -- --to-screen --only fading,pan,c10,lasso,c08,colours --rounds 1 --no-build --against slice-04p  # a subset
npx tsx scripts/to-screen.ts <folder>                         # analyse saved traces again: switches to the screen, pans as presented frames
MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-04b1/S4B1-09.spec.ts       # coverage colours to the screen (always traced)
npm run measure:canvas -- --to-screen --only s4b2pans,c10,lasso,c08,s4b2focus,s4b2screen,s4b2drag --rounds 3 --no-build --against slice-04b1  # slice 4b-2's sitting
MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-04b2/S4B2-15-layers.spec.ts # S4B2-15's layer and element reads
MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-05a/S5A-08.spec.ts         # slice 5a: side panels to the screen, layers
MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-06a/S6A-09.spec.ts         # slice 6a: chips and "Show all" to the screen (HAND_ONLY=1: a chip appearing)
MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-06a/S6A-09-hand.spec.ts    # slice 6a: a chip appearing, phase by phase
npx tsx scripts/bench-import-read.ts                          # slice 7a: read the standard, translate DDL (20,000 and 100,000 column rows)
npx tsx scripts/bench-import-plan.ts                          # slice 7a: plan a re-import, 5 % changed (and P8's digest)
npx tsx scripts/bench-import-write.ts 20000                   # slice 7a: import, re-import and undo through the local adapter, on a copy
MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-07a/S7A-14-review.spec.ts  # slice 7a: the review's filters on 20,000 columns
MEASURE=1 MEASURE_BUILD=production ELEMENTS_BASELINE=.data/measure/s7a14-baseline/slice-06b.json npx playwright test e2e/slice-03b/S3B-15-elements.spec.ts  # S7A-14's element guard
npx tsx scripts/bench-consistency.ts                          # slice 7b: model consistency on 20,000 columns, 5 % changed (bar 50 ms)
npx tsx scripts/bench-import-plan.ts --no-coverage            # slice 7c: the plan with classifications and the classification index (bar 20 ms)
ONLY_REMOVE=1 npx tsx scripts/bench-import-write.ts 20000     # slice 7c: only removing Business key from 2,000 columns (bar 1 s); without it the whole write bench
COMMITS=1 npx playwright test e2e/slice-07c/S7C-14-commits.spec.ts   # slice 7c: canvas commits per classification toggle (on demand; 3 on slice-07b and 7c)
MEASURE=1 MEASURE_BUILD=production ELEMENTS_BASELINE=.data/measure/s7c14-baseline/slice-07b.json npx playwright test e2e/slice-03b/S3B-15-elements.spec.ts  # S7C-14's element guard; slice 8 too (page total +1, see below)
MEASURE=1 MEASURE_BUILD=production ELEMENTS_BASELINE=.data/measure/s9-14-baseline/slice-08.json npx playwright test e2e/slice-03b/S3B-15-elements.spec.ts   # the element guard (S9-14, S10A-12, S10B-10, S10C-11), against slice-08's own counts (slices 9 to 10c matched them; slice 11's page total is +6, the names' check boxes, S11-13)
MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-10a/S10A-12-loops.spec.ts   # slice 10a: 20 loops against 20 relationships, layers and pans (branch only)
MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-10b/S10B-10-lines.spec.ts   # slice 10b: 20 source lines against 20 relationships, layers and pans (branch only)
SCREENS=<folder> npx playwright test e2e/slice-10b/S10B-screens.spec.ts                   # slice 10b: D-62's drawing, light and dark
COMMITS=1 npx playwright test e2e/slice-11/S11-13-commits.spec.ts                         # slice 11: commits of a names switch against the layer switch (dev server, on demand)
MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-11/S11-13.spec.ts         # slice 11: a names switch to the screen, the layer switch beside it, the LayerTree read
SCREENS=<folder> npx playwright test e2e/slice-11/S11-screens.spec.ts                     # slice 11: names and aliases, mixed, exceptions, More, the panel field
SCREENS=<folder> npx playwright test e2e/slice-12a/S12A-screens.spec.ts                   # slice 12a: the delete section (shared and own canvases, armed, the only project), the homes' Undo, light and dark
SCREENS=<folder> npx playwright test e2e/slice-12b/S12B-screens.spec.ts                   # slice 12b: the tiles (seed, empty canvas, collapsed frame, live canvas, workspace home, Performance test) beside the prototype's, light and dark
SCREENS=<folder> npx playwright test e2e/slice-13/S13-screens.spec.ts                     # slice 13: a conflict on a short field, a long text in the rich-text dialog, Not saved, Cleared meanwhile; light and dark
MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-13/S13-head-elements.spec.ts  # slice 13: <head> and <body> on Performance test at 30 %, to compare page totals between builds
SCREENS=<folder> npx playwright test e2e/slice-14a/S14A-screens.spec.ts                   # slice 14a: a note with its mark (45 % and 100 %), its panel's line, a frame's name's line, a read-only note; light and dark
SCREENS=<folder> npx playwright test e2e/slice-14b/S14B-screens.spec.ts                   # slice 14b: a canvas's tab after a refused rename (the line, Not saved, read-only); light and dark
npx tsx scripts/bench-source-hold.ts                          # slice 14b: holding a change's rows on the save chain, 20,000 columns (bar 20 ms; the whole source missed it)
COMMITS=1 SIDE=branch npx playwright test e2e/slice-14a/S14A-13-commits.spec.ts           # slice 14a: canvas commits while a note is written, saved, refused, marked, dropped (dev server; the same file runs on slice-13 for an A/B)
MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-14a/S14A-13-layers.spec.ts # slice 14a: drawing layers with 20 notes without and with the mark (20 real refusals)
MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-15a/S15-layers.spec.ts       # slice 15a: layers and elements on the Sales star with and without roles
MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-15b/S15B-layers.spec.ts      # slice 15b: layers and elements on the Sales star with and without the Σ marks and role pills
SCREENS=<folder> npx playwright test e2e/slice-15a/S15A-screens.spec.ts                   # slice 15a: the star, the Cube tab, the Role, a delete preview, the InfoCube box; light and dark
COMMITS=1 npx playwright test e2e/slice-16/S16-11-commits.spec.ts                         # slice 16: commits of the relationship kinds' switches against the layer switch (dev server, on demand)
MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-16/S16-11.spec.ts         # slice 16: the switches to the screen beside the layer switch, layers and elements with a kind hidden
MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-12b/S12B-10.spec.ts      # slice 12b: both homes' load, three data sets; LABEL=<name> for an A/B run, LOADS=<n>, COLD=<n> first visits
MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-12b/S12B-bytes.spec.ts   # slice 12b: the project home's document, RSC payload and write answers; the thumbnails' share
BROWSERS=1 npx playwright test e2e/slice-12b/S12B-browsers.spec.ts                         # slice 12b: the thumbnails' token colours in Chromium, Firefox and WebKit (on demand)
npx tsx scripts/bench-thumbnails.ts                           # slice 12b: the homes' server work and the thumbnails' cost (index, shapes, paths, bytes, 20 requests, keys; not a gate)
SCREENS=<folder> npx playwright test e2e/slice-22/S22-screens.spec.ts                     # slice 22: the unknown member's section (a value, a value that does not fit, off), Fact Sales' Dimensions; light and dark
SCREENS=<folder> npx playwright test e2e/slice-10c/S10C-screens.spec.ts                   # slice 10c: copies in the panels, the delete, D-47's row, the paste item
npx tsx scripts/bench-checks.ts                               # slice 20: the model checks (marks and counts, the home with its lines; bar 50 ms in Node), synthetic, Performance test, demo
npx tsx scripts/bench-checks-browser.ts                       # slice 20: the same in headless Chromium, with the split (the marks: reference 25 ms, not a gate)
npx tsx scripts/count-checks.ts <copy of a backup>             # slice 20: a read-only count of the check lines per workspace and project (counts only, never .data/dev-db.json)
npm run measure:canvas -- --to-screen --only s20 --rounds 2 --against slice-19   # slice 20's sitting: pans at 100 % and 30 % on Performance test, a mark's write and its undo
MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-20/S20-layers.spec.ts   # slice 20: layers and elements on the Sales star without and with the marks
npm run seed:large -- --changes                               # slice 7b: also an import with changes into "Performance test" (16 changes on 9 tables)
MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-07b/S7B-16-changes.spec.ts # slice 7b: the Changes view and Focus to the screen; the home's load
MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-06b/S6B-10.spec.ts         # slice 6b: selection places, the buttons, the background refresh, phase by phase
BROWSERS=1 npx playwright test e2e/slice-06b/S6B-browsers.spec.ts                          # slice 6b: smoke in Chromium, Firefox and WebKit (on demand; needs `npx playwright install firefox webkit`)
SCREENS=<folder> npx playwright test e2e/slice-04b1/S4B1-06-screens.spec.ts               # slice 4b-1's coverage colour screenshots
npx tsx scripts/measure-ab.ts                                 # S2A-14 pan and zoom: main and this branch in turns, dev and measurement build
npm run measure:build && MEASURE=1 MEASURE_BUILD=production npx playwright test <spec>   # the same in the measurement build
DIAG=nolines MEASURE=1 MEASURE_BUILD=production npx playwright test <spec>   # diagnosis: no line layer (or DIAG=blocks)
DIAG=collapsed MEASURE=1 MEASURE_BUILD=production npx playwright test <spec> # every frame shown collapsed (slice 2c)
DIAG=nonotes,nolabelmarks MEASURE=1 MEASURE_BUILD=production npx playwright test <spec> # no notes, no label marks (slice 3a)
```

- e2e tests import `test`/`expect` from `e2e/slice-XX/fixtures.ts` (fresh seed per test); shared steps are in
  `helpers.ts`. One file per acceptance criterion, named after its id (`S0-04.spec.ts`, `S1A-07.spec.ts`). Slice 1a's
  helpers read the model from the e2e data file (`loadModel`) and open a canvas at a given view (`openCanvas`).
  Slice 1b's add a real-mouse drag (`dragTo`), the toolbox (`toolboxAt`), an empty spot (`emptySpot`) and test data
  made through the domain (`asLukasz`, `asUser`); its measurement steps are in `e2e/slice-01b/measure.ts`. Slice 2a's add
  a real-mouse lasso (`lasso`), canvas points on the screen (`screenPoint`), the canvas tab menu (`openCanvasMenu`) and
  `expectDrawnAt` (right after a write or an undo the page may still lag the data: wait before clicking by position). Slice
  2b's add frames as test data made through the domain (`makeFrame`, `place` for a card), frames on the page and in the
  data (`frameEl`, `loadFrames`, `item`), a point on a frame's name or an empty spot inside it (`namePoint`, `emptyIn`),
  `toolboxLabels` (a frame's toolbox items have their own test ids) and the view `FRAMED` (room above a frame's name at
  the top). Slice 2c's add rectangles around the seed's cards (`AROUND`; the e2e data file between tests is not the
  seed, so read positions from the seed), collapsing as test data (`collapse`, `collapsedFrame`), blocks and bundles on
  the page (`blockEl`, `blockHeadPoint`, `bundles`, `bundleWithCount`, `relBundle`, `mappingLines`), a mapping by its
  column and attribute (`mappingId`) and `removeCard`. Slice 3a's add the demo working layer from the data file
  (`loadLabels`, `loadLinks`, `loadPins`, `loadNotes`, `noteWithText`, `rawDb` with deleted rows), the demo notes' texts
  (`DEMO_NOTES`), the Labels field (`labelsField`, `typeLabel`, `chipNames`), a note on the page (`noteEl`, `notePoint`),
  `removeLabel` as test data and `undo`. Slice 3b's write test data as the server does (`liveWrite`: the command, then
  the live step that labels placed cards and syncs live canvases; plain `asUser` skips it), make a label's live canvas
  (`openLiveFor`, `liveUrl`), put a label on an item (`labelItem`), switch the working context on in the browser
  (`contextOn`, its cookie), and read back live cards (`liveCards`), a label's items (`linkedTo`), the newest change
  group (`lastGroup`) and the commit counters (`canvasCommits`, `miniatureCommits`). Slice 4a's read the requirements
  (`loadRequirements`, `loadRequirementLinks`, `requirementByKey`, `tracesOf`), write test data as any person through the
  domain (`asPerson`), switch four-eyes (`setFourEyes`), open the Requirements tab and a requirement's panel
  (`openRequirementsTab`, `requirementRow`, `openRequirement`), wait for the panel to show a requirement's stored version
  before the next edit (`expectPanelVersion`, the panel's `data-version`), read an element panel's Requirements section
  (`sectionRows`) and open an entity from the Model tab (`openEntityFromTree`). Slice 4p's read the canvas's, the
  miniature's and the fading layer's commit counters (`counters`). Slice 4b-2's find requirement cards on the page and in
  the data (`reqCard`, `reqNode`, `reqCardData`), place them and link requirements as test data (`placeReqCards`,
  `linkReq`), and read trace lines (`tracesOfCard`, `traceEnds`); its measuring steps on “Performance test –
  requirements” are in `e2e/slice-04b2/measure.ts` (S4B2-10 keeps its own, as it runs in the `slice-04b1` worktree too).
  Slice 5a's switch the side panels (`togglePanel`, `toggle`, `panel`, `expectShown`, `expectHidden`), drag and read
  the grips (`dragGrip`, `grip`, `guide`, `guideX`, `panelWidth`), read the canvas's width and a card's place on the
  screen (`expectCanvasWidth`, `cardAt`, `expectCardAt`), the layout cookie (`panelsCookie`) and the view's transform
  (`viewportTransform`). Slice 6a's read the view-state bar (`viewBar`, `chip`, `chipOff`, `chipTexts`, `expectChips`,
  `breadcrumbsRow`) and set a card's row filter or collapse as test data (`setCard`). Slice 6b's walk the history
  (`backButton`, `forwardButton`, `altArrow`, `buttonsEnabled`, `expectAt`, `WS_HOME`, `projectPath`) and read the
  selection from the details panel, hidden or not (`selected`, `expectSelected`, `clickCard`; a system panel reads
  `system:<name>` since slice 7a). Slice 7a's open the wizard (`openWizard`), pick its target (`target`), hand a file to
  a drop zone (`giveFile`), go to the review (`reviewFile`), import (`importNow`), read the filters and rows
  (`filterCount`, `reviewRow`), the test files (`sample`, from `src/domain/import/samples/`; `crmPartial`) and the
  imports (`imports`, `systemNamed`). Slice 7c's open a column's or a table's panel (`openColumn`, `openTable`), press
  and read the classification toggles (`toggle`, `groups`, `expectPressed`), open the list dialog and read a row
  (`openList`, `listRow`), read and write classifications as test data (`classesOf`, `classification`, `classify`,
  `renameBuiltin`, `removeBuiltin`, `columnId`, `tableId`), switch Data Vault 2.0 mode (`setDataVault`) and write a
  file in the standard (`fileOf`). Slice 8's sign in through the start page with an organization's password
  (`signInWithPassword`; the demo password is `DEMO_PASSWORD`, `demo-pass`), write an organization, a person or a role
  as test data through the domain (`createOrganization`, `addPerson`, `changeRoleAs`) and open the People tab
  (`openPeople`, `personRow`); the earlier slices' helpers keep signing in through the test users' list (`signInAs`),
  which unlocks every organization. Slice 9's helpers do the following:
  - record every toast a page shows (`recordToasts`, then `toasts`);
  - read a row's change groups (`groupsOf`);
  - open and read the project home (`projectHome`, `loadProject`, `C360`);
  - wait for hydration (`hydrated`), which matters because typing before it can lose a field's selection. Call it after
    `goto` or `reload` and before typing.

  Slice 10a's helpers do the following:
  - open a line's menu and pick an item (`mappingLine`, `relationshipLine`, `lineMenu`, `toolboxItem`, `menuOn`);
  - read the canvas commits once they settle (`settledCommits`);
  - make a self-relationship as test data (`selfRelationship`) and read an entity's relationships (`relationshipsOf`);
  - click a line or a loop at its middle (`clickLine`) in the view with room for Customer's loops (`LOOP_VIEW`).

  Slice 10b's helpers do the following:
  - find source lines on the page (`sourceLines`, `sourceLine`, `sourceRelationshipId`; `FK_ORDER` is the seeded key on
    "Customer & orders") and read a line's ends, arrow and cards on the screen (`sourceShape`);
  - find a point of a source line that is not under a card, to hover or click it (`freePointOn`);
  - import keys into ERP as test data (`keysFile` with named keys, `employeesFile` for keys to itself, `importKeys`) and
    set a card's width (`setWidth`).

  Slice 10c's helpers do the following:
  - read an attribute by its entity and name (`attributeOf`), an entity's attributes in order (`attributesOf`) and a
    stored row, deleted or not (`rawAttribute`);
  - write copies as test data through the domain: a paste (`pasteAs`), a length the copies follow (`setLengthAs`) and a
    delete (`deleteAs`);
  - press “Copy” on a row (`copyRow`, its toast `COPY_TOAST`) and “Paste attribute” on a card's header (`pasteOn`,
    `headOf`), and read what the attribute panel shows (`attributeShown`, `expectAttributeShown`);
  - hold back a server action's answer (`holdAnswer`): a Playwright route on the test's page passes the request to the
    server at once and gives the browser its answer later, so a second save starts before the first one's answer
    arrives (S10C-09). It lives in the test only: the app has no switch for it in any build.

  Slice 11's helpers do the following:
  - write aliases and names as test data through the domain: an entity's or an attribute's alias (`setEntityAlias`,
    `setAttributeAlias`), a canvas's mode (`setNamesAs`) and a card's exception (`setException`); read them back
    (`canvasRow`, `exceptionsOf`);
  - find a card by its canvas item, since its header may show an alias (`cardOf`, `headerOf`, `rowTextOf`, `idsOf`);
  - read the check boxes (`entityBox`, `attributeBox`, `expectBox` with the DOM's `checked` and `indeterminate`), pick a
    card menu's segment (`pickSegment`) and read the tints (`tintOf`);
  - views: `HALF` (50 %, every card's rows drawn) and `FULL` (100 %).

  Slice 11's specs run in a 1,536 × 864 window (`e2e/slice-11/fixtures.ts`): up to 1,300 px the check boxes are in
  “More”. Its measuring steps (`e2e/slice-11/measure.ts`) alias every entity and attribute of “Performance test” in the
  e2e data file (`aliasEverything`, prefix `PL `).

  Slice 12a's helpers do the following:
  - press the top bar's Undo and Redo (`undoButton`, `redoButton`) and the keys outside a field (`key`);
  - move a card up by its header and read its stored y (`moveCardUp`, `yOf`);
  - name Order management's home and canvases (`OM_HOME`, `OM`, `OWN` only its own, `SHARED` with Customer 360) and
    give its own canvas a frame, a note, a requirement card and CR-23's pin as test data (`furnishOrderManagement`);
  - read every row on a canvas, deleted or not (`rowsOn`), and the delete section (`deleteSection`, `deleteButton`,
    `deleteText`).

  Go between a project's pages by the app's links (`tab-home`, tiles) when a test then uses Back: after a typed address
  Back restores a whole earlier document from the browser's back-forward cache, which no page code sees
  (`docs/known-limitations.md`). Toasts of a tab in the background are read with `recordToasts`.

  Slice 12b's helpers do the following:
  - read a tile's thumbnail from the file its `<use>` refers to (`tileOf`, `thumbnailHref`, `thumbnailOf`,
    `parseThumbnail`: kinds, colours, rectangles, lines, the cache header);
  - compare it with the data without the domain's rules: the scale and offset from the outer edges, every expected
    shape at its place and width (`expectDrawn`, `expectedOf`, `canvasData`, `mappedPairs`, `conceptColorOf`; `CO`,
    `OL`);
  - write test data through the domain: deletes (`deleteEntityAs`, `deleteRequirementAs`, `deleteFrameAs`,
    `deleteNoteAs`) and a free or pinned note (`addNote`).

  "Performance test – 20 canvases" (`scripts/lib/many-canvases.ts`, `addManyCanvases`) is written only into the e2e
  data file or the bench's copy, never into the seed or `.data/dev-db.json`.

  Slice 13's helpers do the following:
  - hold a server action's answer until the test releases it (`holdUntil`: `held`, `release`, `given`; slice 10c's
    `holdAnswer` with a release instead of a fixed time) and read a field's caret (`caretOf`, `expectCaretAtEnd`);
  - write as another session through the domain, so the page does not know: `changeEntityAsAnna`,
    `changeTableNoteAsAnna`, `changeRequirementAsAnna`, `changeProjectAsAnna`, `changeSettingsElsewhere` (as Łukasz,
    since Anna is no admin); read an entity by name (`entityNamed`);
  - read a field's mark (`conflictLine`, `otherValue`, `notSaved`) and press its buttons (`useThis`, `keepMine`).

  Slice 14a's helpers do the following:
  - write as another session through the domain: a frame (`changeFrameAsAnna`: name, colour, kind and concept), a
    card collapsed or expanded (`toggleCardAsAnna`), a note's text, colour or status (`changeNoteAsAnna`), a note's
    delete (`deleteNoteAsAnna`); read a frame's or a note's stored row (`frameRow`, `noteRow`);
  - open a frame's panel from its name (`openFrame`);
  - find a note on the canvas by its id, since its text may be a draft (`noteBox`, `noteMark` for its "Not saved",
    `noteEditor`, `notePanelText`), select it by its header (`selectNote`), edit it with a double-click (`editNote`) and
    write it with Ctrl+Enter (`writeNote`); open the demo canvas with a note in view (`openWithNote`, for the pinned
    note, which lies below `WHOLE_CO`'s view).

  A refusal's fresh page brings the newest versions of every note: to get one refusal per note, Anna changes each note
  just before the page writes it (`S14A-13-layers.spec.ts`). The toast is a drawing layer of its own while visible:
  read LayerTree once `[data-testid="toast"][data-visible="true"]` is gone.

  Slice 14b's helpers do the following:
  - read a canvas's stored row (`canvasStored`); start and write a rename in a tab (`startRename`, `renameInTab`) and
    find the tab being renamed (`renamingTab`);
  - change a canvas as another session through the domain: its name (`renameCanvasElsewhere`) and its look
    (`changeCanvasLookElsewhere`), as Anna;
  - close the page as a closed tab does (`page.close({ runBeforeUnload: true })`) and expect the browser's warning
    (`leaveAsks`, the dialog dismissed so the test goes on) or none (`leaveAsksNothing`, the page closes);
  - wait until the page has a save's answer (`answerOf`: the response read to its end and the card showing the new
    name). The e2e data file is written before the answer reaches the page: a stored row alone does not mean the save
    is no longer on its way (the page still asks before it is left).

  Playwright dismisses a dialog it has no handler for: a spec that reloads or leaves a page with unsaved text (a refused
  draft, a kept draft of a closed panel, a save on its way) handles the `beforeunload` dialog (`S13-14`).

  Slice 15a's fixtures add the Sales star (`addModuleDemoData`: InfoMate's licence, InfoCube on in "Retail Co – DWH",
  the canvas "Sales star" with five facts and dimensions); `test.use({ star: false })` starts from the plain seed every
  earlier spec uses. Its helpers do the following:
  - read InfoCube's rows and the model through the composed store (`cubeStore`, `cubeEntities`, `liveEntityNamed`,
    `workspaceRow`), and the star's ids and view (`STAR`, `starUrl`, `STAR_VIEW`, `entityIdOf`);
  - read the settings' box (`settingsUrl`, `infocubeBox`, `infocubeCheck`) and a card's role (`roleOf`);
  - run a domain command as a person without the page (`refusalAs`, `switchRefusal`), grant the licence as test data
    (`grantLicence`) and delete an entity through its impact dialog (`deleteFromModel`).

  Slice 17's helpers do the following:
  - pick a concept in the concept picker (`pickConcept`, in slice 1b's helpers, for every spec that creates an entity
    outside a concept frame) and read it (`conceptPicker`, `expectConceptPicker`: shown, titled, nothing selected, the
    filter focused);
  - link requirements from an element panel's picker (`linkFromPanel`, with `all` for "Link all attributes…") and
    create one from its footer (`newRequirementFromPanel`; both in slice 4a's helpers, which the earlier specs use);
  - drag with the real mouse from an element by an offset or onto another (`dragBy`, `dragOnto`, which may hold the
    button to read the drag's line and mark), read an entity's attribute order (`attributeOrder`) and a frame's row
    (`frameRow`).
  The seed has REQ-104's card on "Customer & orders" already; a right click inside a frame opens the frame's menu, so a
  create inside a concept frame uses the Entity tool.

  Slice 18's fixtures reseed with the star and its derivations (`addDemoData`). Its helpers do the following:
  - read calculations from the e2e data file (`liveModel`, `attributeNamed`, `inputsOf`) and write them as test data
    through the domain (`addAttributeAs`, `calculateAs`, `deleteMappingAs`);
  - use the section and its picker (`calcSection`, `calcPicker`, `pickItem`, `pickInputs`), wait for the panel's stored
    version (`expectAttributePanelAt`), and read a card's count and the Overview's line (`cardCount`, `overviewLine`).

  Slice 19's fixtures reseed with `addTypesDemoData` (the star, slice 18's derivations and slice 19's types,
  `addInfoCubeTypesDemoData`; slice 15's and 18's fixtures do not). Its
  helpers do the following:
  - read InfoCube's rows (`cubeRow`, `typeEntity`, `GROUPS`) and run a domain command through the composed store
    (`asCube`; slice 1b's `asUser` writes InfoMapper's tables only);
  - write the file's rows back in slice 18's shape (`writeOlderCubeRows`);
  - find the panels' new fields (`factTypeSeg`, `factlessFlag`, `baseSelect`, `kindSeg`, `historySeg`, `periodField`,
    `segment`, `cubeItem`).
  A create's rows are in the data file before its answer reaches the page: wait for what the answer does on the page (the
  new name focused) before the next step (S17-01, slice 19).

  Slice 20's fixtures reseed with `addFullDemoData`: slice 19's demo and slice 20's checks demo (`addChecksDemoData`,
  `src/data/local/seed-checks.ts`: the demo model's keys as copies, Customer.last_order_id, Product.country_code and
  Product_Name, Sales Order.total_amount calculated, Customer Address.country_code no foreign key), which the seed, the
  reset and `npm run demo` also run; no earlier fixture does, and the plain e2e seed has no check line. Its helpers do the
  following:
  - name the demo's objects (`demoAttr`, `demoEntity`, `demoRel`, `OM_HOME`, `C360_HOME`);
  - read the home's section (`checksSection`, `checkGroup`, `checkLines`, `groupCounts`);
  - read a card's marks (`headLine`, `rowType`, `markOf`, `expectMark`, `markTitleOf`: a mark's title is set on hover);
  - read the status bar's count, the details panel's group and the panels' box (`statusChecks`, `canvasChecks`,
    `canvasCheckItems`, `checksBox`, `boxItems`).
  React's development mode runs effects twice: a request handled in an effect is marked handled where it is acted on
  (in its animation frame), or the second run finds it done (the status bar's jump, slice 20).

  Slice 22's fixtures reseed with `addFullDemoData`, as slice 20's. Its helpers do the following:
  - find the section's parts (`unknownFlag`, `unknownSentence`, `unknownItems`, `unknownInput`, `unknownBad` by
    "{star key}.{attribute}") and type a value (`typeValue`);
  - read the stored values (`storedValue`, `rawValues` with deleted rows, `unknownOnOf`) and write them as test data
    through the domain (`setValueAs`, `setUnknownAs`);
  - write the e2e file as slice 21 left it (`writeBeforeSlice22`) and with InfoCube off beside its facts and dimensions
    (`writeInfoCubeOff`, which the app never does: C-7).
  Call `recordToasts` before the page is opened: it is an init script (S22-02).

  Slice 15b's fixtures are 15a's (the star). Its helpers do the following:
  - read the star's ids and InfoCube's rows (`relId`, `attrId`, `liveKeys`, `liveMeasures`, `cubeRowOf`, `model`,
    `keyOf`) and add a third Dim Date – Fact Sales relationship as test data (`thirdDateRelationship`);
  - open the star and a panel (`openStar`, `openEntity`, `openAttribute`, `openRelationshipFromFact`) and read the
    sections (`factSection`, `hints`, `hintsOk`, `dimensionRows`, `dimensionRow`, `usedByRows`, `measureRows`);
  - read a line's pill and where it starts (`pillOf`, `pillCentre`, `pathStart`).
  A field located by its label matches the whole label: a role's label ("Role at the right end") contains the end's
  ("At the right end", S10A-10).

  The undo history lives in the server's memory and is empty again after each reseed.
- In development the canvas counts its commits in `window.__imCanvasCommits` (slice 2c): `S2C-12.spec.ts` checks that
  nothing re-renders a canvas with collapsed frames while it is idle or panned and zoomed, `S3A-14-idle.spec.ts` the same
  with notes below 40 % zoom (a note measured while drawn plain once grew on every round), `S3B-15-idle.spec.ts` on a
  live canvas. Keep it when changing `ModelCanvas.tsx`; a render loop once cost a collapsed canvas a third of its frames.
  The Overview's miniature counts its commits in `window.__imMiniatureCommits` (slice 3b): `S3B-13.spec.ts` checks that
  panning and zooming do not redraw it and a note's drag redraws it once, on the drop. Since slice 11 the Overview keys
  its lists on a string of what it draws (each node's rectangle and fill, `drawnKey`), not on React Flow's nodes array:
  a card change that moves or recolours nothing (a names switch) does not redraw it (S11-13: one canvas commit, no
  miniature commit).
- **Test hooks** (slice 4p): the canvas page installs them only where `areTestHooksOn()` (the e2e dev server, which sets
  `INFOMAPPER_TEST_HOOKS=1`, and the measurement build): `window.__imFade({ focus } | { lit, key } | null)` switches
  fading (`focus`: an entity id, or a `FocusTarget` such as `{ t: "requirement", id }`; slice 4b-1 removed `{ lens }`), `window.__imCanvasThrow()` throws inside the canvas's error boundary, `window.__imIndexTiming("page" |
  "synthetic")` times the requirement index. A plain `npm run dev` and a normal production build never have them.
- **Overlay and fading** (slice 4p, AD-24; slice 4b-1): the hover, the row marks, the selection marks and the lasso are
  drawn in `OverlayLayer` (its own compositing layer); the hover and the lasso rectangle are value stores, so they never
  re-render `ModelCanvas`. Fading is `FadeLayer` (F4, slice 4b-1): one veil with holes at the lit cards, blocks,
  pinned notes and requirement cards, as one SVG path in the overlay, and the lit lines and lit trace lines (solid, slice 4b-2) above it; since
  slice 4b-2 (T3) the veil has no layer of its own and paints into the overlay's layer (Focus adds one drawing layer, not
  two); switch it with `requestFade` (`src/canvas/fade.ts`), never through the nodes array. **Focus** (`src/canvas/Focus.tsx`) is the store
  `focusOn`; `FocusDriver` turns it and the selection into the request, so switching Focus never re-renders
  `ModelCanvas`. **Coverage colours** of a selected requirement are `CoverageLayer`, in the overlay: a faint fill (text
  keeps 4.5:1, the overlay lies above it) and a bar in the full colour; below 40 % a dot. `window.__imFadeCommits`
  (development) counts the fading's commits; `S4P-12.spec.ts` and `S4B1-06.spec.ts` check that switching, panning,
  zooming and dragging with fading on, and switching Focus, add no canvas or miniature commit.
- Measure with tracing only in a diagnosis, never in a timed sitting: traced runs are slower and drift (slice 4p's notes
  trial looked like a gain traced and was none untraced). **Except to the screen** (slice 4b-1, step 0's method):
  interactions are measured from a settled screen (1.2 s pause) to the first GPU present after the compositor activates
  their commit, and pans as presented frames, both traced and both sides traced alike; the in-page time and the untraced
  rAF pan stay as the breakdown and the trace's own cost. `TO_SCREEN=1` switches the measuring specs (S1A-14, S1B-10,
  S2A-14's lasso, S4P-fading, S4P-10) to it; the shared code is `e2e/measure/` (`trace.ts`, `switches.ts`) and
  `scripts/lib/to-screen.ts` (anchor, settled check, split, presented frames; `tests/to-screen.test.ts`). Raw traces go
  to `.data/measure/` (git-ignored, never committed).
- **Side panels** (slice 5a): `src/app/_components/side-panels.tsx`; the layout is a cookie per person
  (`im-panels.<userId>`, `src/ui/side-panels-cookie.ts`) the server reads, so the first paint is right. Hiding,
  showing or resizing the left panel moves the view in the same event (`ui.shiftView`); `ModelCanvas` does not
  subscribe to the pane's size (S5A-07 checks zero commits). Never set a CSS variable or a page-wide class on an
  element that contains the canvas: it restyles every card (S5A-08 found 75–140 ms per switch in the dense view); the
  grid gets its columns directly. Actions that lead to details on purpose call `openDetails()`; a selection never does.
  A canvas's remembered view (`infomapper:view:<canvas id>`) carries the canvas's left edge on the screen (`left`,
  slice 6a); on open the one `setViewport` moves `x` by the difference, so a view opens in place beside another left
  panel; a view without `left` opens as stored.
- **View-state bar** (slice 6a, D-39): `src/app/_components/view-state-bar.tsx`, at the end of the breadcrumbs row on
  canvas pages (`AppShell`'s `viewState`). It reads the canvas through stores and the canvas context (`focusOn`,
  `viewCounts` in `src/canvas/view-counts.ts`, which `ModelCanvas` publishes from an effect, `ui.mode`), never re-renders
  `ModelCanvas` (S6A-08), and never reads layout in a commit: the fold into “+{n}” takes its widths from a
  `ResizeObserver` (`src/ui/fit-chips.ts`, 16 px hysteresis). The breadcrumbs row is `contain: strict` (static). The
  filter and collapsed-card chips and the layout part of “Show all” are one undo step each through `resetCanvasView`
  (`src/domain/commands/canvas.ts`). The top bar's narrow steps are classes on the tools' own elements; “More”
  (`src/canvas/MoreTools.tsx`) takes the names' check boxes up to 1,300 px (`MORE_NAMES`, slice 11; “More” shows from
  there, and the working context's label is cut at 90 px from 1,201 to 1,300 px), Focus and the notation up to
  1,200 px and the four tools up to 1,100 px
  (`src/canvas/more-breakpoints.ts`, a plain module the server page and the client menu share). Tailwind's `min-[N]` and
  `max-[N]` meet at N: the app writes the prototype's “up to N px” as `max-[N+1px]`.
- **Nothing above the canvas reads layout during a commit** (slice 6a, S6A-09-hand): no `offsetWidth`,
  `getBoundingClientRect` or similar in a render or a layout effect of anything that sits above or beside the canvas
  (bars, rows, panels). When the canvas restyles in the same commit (a tool's class), the read forces that restyle (about
  20,000 elements in the dense view) and a layout of the page synchronously. Take sizes from a `ResizeObserver`, which
  reports after the browser's own layout. Later PRDs: say so for every element they add above the canvas.
- **Back and forward** (slice 6b, D-38): the browser's own history is the only one. Pages are the entries Next.js
  makes; a single selection on a canvas is an entry pushed **without a URL** (`history.pushState(null, "")`: no route, no
  request, no render) and its place is kept in `sessionStorage` under the Navigation API's entry key
  (`src/ui/history-places.ts`), **never in `history.state`**, which Next.js rewrites after every router update.
  `src/app/_components/history-nav.tsx` draws Back and Forward (from `canGoBack`/`canGoForward`; hidden without the API),
  handles Alt+←/→ outside text fields, and keeps the tab's one traversal watcher (`currententrychange`, “traverse”): a
  listener on a page does not hear the traversal that leaves it (Next.js draws the next page first). It blurs a focused
  text field **on traversals only** (the `navigate` event, `navigationType` “traverse”): a traversal blurs the field
  itself when it starts and that blur never reaches the save, while a push (a selection) must not take the focus (a new
  element's name is typed straight away). `src/canvas/SelectionHistory.tsx` records and applies places through
  `ui.showPlace` (`ModelCanvas`), which selects as a click does, centres off-screen items at the same zoom and reports a
  place that no longer exists. **A later slice that adds something selectable:** decide whether it is a place (a single
  item usually is; extend `placeOf` if not), whether `showPlace` centres it (it has a place on the canvas) and how it
  checks it still exists, and add its toast to `GONE` in `SelectionHistory.tsx`; its specs walk it back and forward.
- **A few milliseconds: compare phase traces, not medians** (slice 6a, S6A-09): once a UI addition costs a few
  milliseconds, compare phase traces with and without it (script, style with its element count, layout with its dirty
  and total objects, paint, layerize; as `S6A-09-hand.spec.ts` does) rather than unprepared medians to the screen, whose
  run-to-run spread (up to 12 ms in slice 6a) is larger than what is measured.
- Never run `npm run e2e` while your own dev server runs: stop it first.
- **The full run in eight parts** (chore e2e reliability, P2 B; seven since chore CI e2e; eight since chore e2e eight
  parts): `npm run e2e` (`scripts/e2e.ts`) runs the folders in eight parts (`e2e/parts.ts`, `PART_STARTS`: from
  `slice-02a`, `slice-03b`, `slice-04p`, `slice-07b`, `slice-10a`, `slice-13`, `slice-15d`; `tests/e2e-parts.test.ts`),
  each with its own fresh dev server, one
  after another locally and side by side in CI, and merges their blob reports into one result (`playwright-report/`);
  failure traces and the server's output (`server.log`, `scripts/e2e-server.ts`) are in `test-results/part-<n>/`.
  `npm run e2e -- --list` prints each part's files (`--part <n>`: one part); CI runs exactly these. A server's heap
  grows about 6 MB a test, and on 8 GB RAM a heap of 2 GB or more under paging timed out sign-ins; Next.js restarts the
  server at 80 % of its heap limit (half the RAM: 3,255 MB on the laptop, 6,431 MB on GitHub's 16 GB runner). In chore
  CI e2e's runs each part peaked at about 0.9 to 1.4 GB and took 5 to 11 minutes on the runner. When a part's heap
  (`E2E_MEMORY_LOG=1`; the summary in CI) comes near 2 GB, move the cuts or add a part. The local full run refuses to
  start while port 3200 is in use. **Recut rule** (Łukasz, 9 November 2026): a new slice's folder joins the last part;
  when the last part is the longest by more than about a minute on the median of the last three full runs (the tests'
  times in each part's memory log), recut `PART_STARTS` in folder order.
- **Fonts** (P3 B): IBM Plex is hosted in `src/app/fonts/ibm-plex/` (IBM's unmodified WOFF2 files, OFL 1.1, `README.md`
  with their checksums) and loaded through `next/font/local`; no build or start fetches fonts. "Plex" is a Reserved Font
  Name: never subset or change the files; replace them only with other unmodified files from IBM.
- Measure canvas performance only with `MEASURE=1` (headed Chrome, visible window), on the dev server or, with
  `MEASURE_BUILD=production` after `npm run measure:build`, on the measurement-only production build (AD-31: starts only
  with `INFOMAPPER_MEASURE=1`, on 127.0.0.1; a normal production build still refuses the local adapter). Keep the AD-24
  CSS rules, including no `overflow: hidden` on repeated card elements unless the text may not fit
  (`src/canvas/text-fit.ts`). The `DIAG` switches (`?diag=nolines`, `blocks`, `noframes`, `nolabels`, `collapsed`,
  `nonotes`, `nolabelmarks`) work only in that measurement build (`isMeasurementBuild()`, `INFOMAPPER_MEASURE=1`); a dev
  or normal production run ignores them. Every element in the viewport costs paint and layerize time on each pan and
  zoom frame: keep repeated marks to one element (slice 3a's label marks are CSS masks); `S3B-15-elements.spec.ts`
  counts them against the previous tag. It compares the viewport's counts; the page totals it prints include `<head>`.
  **Since slice 8 the page total is one higher than `slice-07b`'s baseline** (5,994 / 20,791 / 2,861 / 6,303): one more
  JavaScript chunk's `<script>` in `<head>` (the top bar's new code), nothing drawn (Łukasz, slice 8 step 5); read a
  later total against that. A sitting is balanced (`--rounds 2`, each side first once) and starts with one
  discarded warm-up run after the builds, before the counted rounds (e.g. `npm run measure:canvas -- --prepare-only`,
  then one `--quick --rounds 1` sitting that is not counted): the first side measured after the builds ran slow in
  slice 3b, and the laptop's state drifted within a sitting in slice 3a (`docs/prd/slice-03b-acceptance.md`).
- e2e servers use their own build folders (`.next-e2e`, `.next-e2e-restart`) via `NEXT_DIST_DIR`, because Next.js
  refuses a second dev server on the same folder. Next.js adds them to `tsconfig.json`'s `include`; keep that.
  They run without Turbopack's dev cache and start empty each run (`scripts/clean-e2e-build.ts`); the global setup
  warms the server up. See `docs/known-limitations.md` (end-to-end tests).
- Next.js 16 notes for agents are in `AGENTS.md` (managed by `next dev`; keep it committed). Read
  `node_modules/next/dist/docs/` before using a Next.js API you have not used here yet (e.g. `proxy.ts`, not middleware).
- shadcn/ui components go to `src/ui/components` (`npx shadcn add <name>`); colours come from the prototype palette in
  `src/app/globals.css` (`bg-im-surface`, `text-im-ink-2`, …).
- **Source import** (slice 7a, D-55): the readers and the engine are pure domain code (`src/domain/import/`:
  `standard.ts`, `ddl.ts`, `plan.ts`, `apply.ts`, `compare.ts`); the wizard (`src/app/_panels/import/`) reads and plans in
  the browser; “Import into” sends the text and the choices to the upload route `POST /w/{workspace}/import`
  (`src/app/_lib/import-sources.ts`, `runCommand` and `importSources`), where the server reads and plans again and writes
  only when the plan's fingerprint matches the review's (P8). Anything that changes how a file is read (a reader's
  option, such as the query channel's vendor) must be sent too, or the server plans differently and refuses. The test
  files in `src/domain/import/samples/` are read only by tests (an ESLint rule; P10: no samples in the app). Missing
  marks on the canvas are classes on existing elements (`row.gone`, `path.s.gone`; AD-24); a source system is a
  selection `{ t: "element", kind: "source_system" }` and a history place (`GONE.source_system`).
- **Line kinds in the line layer** (slice 10b, D-62): `buildLines` (`line-data.ts`) returns mappings, relationships and,
  as a list of their own, `sources` (relationships between source tables with both table cards on the canvas; absent
  without one). Code that does not know `sources` leaves them out (the miniature, bundles, the line menu, Delete).
  `bundleLines` keeps the list and drops a line with a card in a collapsed frame; Mappings hides it. `SourcePath`
  (`LineLayer.tsx`) draws one with `relGeom` (the loop for a key to itself): 4 elements (group, hit target, path, the
  arrow from `arrowHead`), class `lnk srel` (`src` is the source card's), painted first. Their shared `<g>` is drawn
  only when the canvas has a source line: an empty group was one element more in every canvas's viewport (S10B-10). A
  click selects the table with the key (`{ t: "card" }`). Under Focus and in the Changes view `litSources`
  (`fade-canvas.tsx`) lights a line whose two cards are lit, drawn again in `LitLines`; no domain change.
- **Copies of attributes** (slice 10c, D-63): `attribute.copied_from_attribute_id` links a copy to the attribute it was
  pasted from (a copy itself or not); the local data file's format 10 added it as null. **One rule in one place:**
  `followOriginals` (`src/domain/model/copies.ts`) brings every live copy below the written attributes in step with its
  own original (type, parameters, Personal data: `FOLLOWED_COLUMNS`), in the same change group; `updateAttribute` and
  `revertChangeGroup` (undo and redo) call it, so an undo never leaves a copy out of step. The copies only following
  wrote are the write set's `followers`, which the working context leaves out (`contextTargets`). `updateAttribute`
  refuses a followed field on a copy with a link (its original live or deleted) and clears the link on `stopFollowing`.
  The link is not in undo's `PARENTS`. `model.load` returns `lostOriginals` (a deleted original's name and its entity's)
  for the copy's panel. In the browser: the clipboard is a value store of the page (`src/app/_components/
  attribute-clipboard.ts`: workspace and attribute id only); the panel saves a followed field through `saveRows` with the
  attribute checked and every copy below it held (`copiesBelow`), and `updateAttributeAction` answers with every version
  written. An attribute's delete asks a second click when it has mappings or copies (`ConfirmDelete`'s `then`,
  `armedDeleteText`, `copiesStopFollowing`); D-47's dialog has the row `copiesImpactRow`. **A later command that writes
  an attribute's type or Personal data:** pass its write set through `followOriginals`.
- **Names and aliases** (slice 11, D-64): `entity.alias` and `attribute.alias` (format 11 added them and the four mode
  columns as null; a paste copies the alias once, it is not followed). A canvas's modes are `canvas.entity_names` and
  `attribute_names` (null = name; names stored as null), a card's exceptions `canvas_item.entity_names` and
  `attribute_names` (null = follow; a choice equal to the mode is stored as null; entity cards only). **The rules in one
  place:** `src/domain/model/aliases.ts` (`canvasMode`, `cardMode`, `exceptionFor`, `namesControl`, `cardShownNames`).
  The commands: the alias in `updateEntity`/`updateAttribute`; `setCanvasNames` (`canvas.ts`, shaped like
  `resetCanvasView`: clears every exception in that dimension, checks the cards' versions, not the canvas row's); the
  exceptions in `updateCanvasItem`. Undo names come from the write set's `label`. **What a card shows:** cards keep
  `name` for toasts and questions; `CardData`/`CardRow` carry `alias` and, only when it differs, `shown`, and a card its
  exceptions only when set; `applyNames(card, canvasNames)` (`card-data.ts`) sets the shown texts and the clips again
  (`withClips` reads `shownText`), returning the same card when nothing changes. `buildCards` applies it for the first
  paint, `ModelCanvas` on node builds, `patchCard`, fresh pages and a switch. **Read `shownText`, never `name`, for
  anything drawn on a card** (header, rows, low-zoom block, a collapsed frame's list, their titles, fit width, the drop
  hint). **The switch:** `ui.setNames` → `ModelCanvas.setNames` shows the modes and the cleared exceptions in one
  commit, then `setCanvasNamesAction` on the canvas's queue (`enqueueGroup`), holding the canvas's row on the save
  chain while it is on its way (`rowSaves.saveRows`, slice 14b); its answer's versions go to the chain. A fresh page brings the names keyed on the canvas row's version too
  (`names.version`): the switch's own page may be replaced by a later one. The check boxes (`NamesSwitch.tsx`, “More”)
  read `namesState` (`names-state.ts`), which `ModelCanvas` publishes from an effect with `namesControl`, as
  `viewCounts`. The tint is the class `alt` on `.c-head` and on `.c-body`/`.c-lod` (`--im-alias-soft`). The search
  matches aliases in `tree-data.ts` (`show`; the hint “alias {alias}” or “attribute {name} · {alias}”).
- **Undo on the home pages and a project's delete** (slice 12a, D-65): both homes wrap their page in `UndoProvider`
  (no canvas) and show `UndoButtons` as the top bar's only tool (`AppShell`'s `tools`); the loaders read the history.
  One undo queue serves the tab; toasts take "Undo" from the canvas, else from `useUndoNow` (a stable context, so
  nothing re-renders when the undo state changes). `deleteProject` (`project.ts`) shares a canvas's soft-delete with
  `deleteCanvas` (`canvasDeletionWrites`); steps are named by their commands (`writeSet.label`: "Create project",
  "Delete project {name}", "Pin label {label}"). Undo refuses a revert that leaves no live project, and the local
  adapter counts again (`workspaceWithoutProject`). **One place for a missing project or canvas:** `missingCanvasWay`
  (`src/app/_lib/missing-canvas.ts`) through `leaveMissingCanvas` (`shell.ts`), used by `loadShell` and by the canvas
  page when its own read misses the canvas; your own action that removed the project (the delete, an undo or a redo)
  remembers it for a minute (`gone-project.ts`, like `next-canvas.ts`), so its page goes to the workspace home without
  "That project no longer exists.". A step that writes a project is not "on" a canvas in the undo toast
  (`changeCanvasId`).
- **Canvas thumbnails** (slice 12b, D-29, AD-32):
  - **The rules in one place:** `src/domain/model/thumbnail.ts` (`thumbnailIndex` once per page, `canvasThumbnail`,
    `canvasThumbnails`, `thumbnailDrawing`: one path per kind and colour in 400 units). Card heights are the canvas's
    (`cardHeightOf`, `liveMembership`, `blockHeight`); `tests/thumbnail-heights.test.ts` compares them with
    `cardHeight(buildCards(…))`.
  - **Drawn from a route:** a home computes the drawings and their keys (`src/app/_lib/thumbnails.ts`) and the tile
    draws `<svg><use href="/w/{ws}/thumbnail/{canvas}?v={key}#t"/></svg>` (`src/ui/canvas-thumbnail.tsx`). The route
    (`src/app/w/[workspaceId]/thumbnail/[canvasId]/route.ts`) answers `thumbnailSymbolFile` (`src/ui/thumbnail-svg.ts`),
    painted with the page's tokens, which the `<use>` inherits; never copy token values into it.
  - **Access** is `workspaceAccess` (`shell.ts`), shared with `loadShellFor`.
  - **The proxy's exception:** without a session a thumbnail's path answers 401 instead of the redirect, and the proxy
    writes no preference cookie on it (`THUMBNAIL_PATH` in `src/proxy.ts`). A later resource the browser fetches for a
    page follows AD-32 and needs the same exception.
  - **F3:** nothing of the thumbnails goes into `loadProjectView` or the canvas page.
  - `NOTE_MINI` is in `src/ui/note-colors.ts` and `NO_CONCEPT_COLOR` in `src/domain/model/concept-colors.ts`, shared
    with the canvas.
- **InfoCube** (slice 15a, AD-33 to AD-35):
  - **The level** (`entity.model_level`, set on create, never changed) and its rules are InfoMapper's
    (`src/domain/model/levels.ts`): relationships and paste within a level, names compared within a level, a mapping's
    target a logical attribute, and while InfoCube is off nothing creates or brings back a dimensional entity (C-7 as
    changed: it is turned off only without facts or dimensions; the local adapter counts again). The texts are there.
  - **InfoMapper's lists and counts are logical only** (Q4): the Model tab, the stats, consistency, the import review,
    the pickers; canvas tiles and tab counts count every card. **A later list or count that reads entities decides its
    level** and says so in its PRD.
  - **The role on a card** is `CardData.role` (`buildCards`' roles from `ModuleView`): the text where the stereotype
    stands, the cube a CSS mask on `.stereo.role.cube::before`, a fact's edge a class (`dimn fact`); `withClips` counts
    the mark's 14 px (`ROLE_MARK`). No element more (S15-layers).
  - **15b** (D-68): the actions are in `src/modules/infocube/app/actions.ts`, the sections in `sections.tsx` (they derive
    their rows in the browser from the model and `ModuleView.data` with `cubeIndex`, once per data version), the page's
    rows in `view.ts` (`cubePageRows`, `measureMarks`, `attributeDeletes`). The Σ marks are the row's classes `meas add`,
    `meas semi`, `meas non` and a `::before` on its type span (`infocube.css`), no element (S15B-layers). Roles are
    InfoMapper's (`relationship.from_role`, `to_role`; `roleLabel` and the sentences in `relationship-panel.tsx`, the
    pill `pillText` in `line-data.ts`); a key link (`cube_key`) is written only to an existing foreign key and kept,
    inactive, while its attribute is no foreign key. Parallel relationships and nested loops are `RELATIONSHIP_GAP`
    (20 px) apart; source relationships keep 16 px.
  - **15c** (AD-36, D-69): dimensional mappings are `cube_mapping` and `cube_mapping_input` (logical attribute(s) →
    dimensional attribute), their commands in `src/modules/infocube/domain/mappings.ts` (one undo step each; the header
    drop is "Create attribute and its mapping", Create dimension "Create dimension"), the lines in `canvas/lines.ts`,
    the hook `useCubeCanvas` (`app/canvas-ext.tsx`: the row drag and drops, the veil, the menu, "Create dimension from
    this…"), the panel `mapping-panel.tsx`, the attribute sections `feeds.tsx`. D-51's first rule and four-eyes are
    InfoMapper's (`BACK_TO_REVIEW_MESSAGE`, `checkFourEyes`, `CUBE_MAPPING_LOG`). A dimensional attribute has no source
    mapping; its "Mapped" filter, dot and coverage read `rowFeeds`. A new card beside another goes in the canvas's free
    spot (`ui.besideSpot`, `besideSpots`).
  - **15d** (D-70): the coverage rule and the reasons in `requirements.ts` (`lookupModel`'s `coverageOf`, `gapReason`;
    `hasTypeConflict` in the module, 15c's `typesDiffer`), the lens in `coverage-colours.ts` (`scope.feeding`) and
    `lit.ts` (`Lit.lines`), "Fed from concepts" (`fedFromConcepts`, `CubeEntityFeeds` in `app/feeds.tsx`), the bus
    matrix (`domain/bus-matrix.ts`, `busMatrixAction`, `app/bus-matrix-dialog.tsx`; a snapshot when it opens), REQ-210
    in `addSalesStar` (its key as given, the counter untouched).
  - **The star** is written only by `npm run seed`, `npm run reset-dev-data`, `npm run demo` and slice 15a's fixtures,
    never by the e2e reseed of earlier slices, so their specs and the element guard stay comparable.
- **InfoMapper's canvas and menus** (slice 16, D-71):
  - **Add attribute** in an entity card header's menu (`addAttributeTo`, `canvas-host.tsx`), directly before "Paste
    attribute": the panel's command, the row selected, `openDetails()`, the name focused (`setNameFocus`).
  - **Tab order:** `moveCanvas` (`src/domain/commands/canvas.ts`, `movedOrder`; `moveCanvasAction`): the project's links
    numbered 0…n−1 in the new order, only the changed ones written, label "Move canvas", `canvas.edit_projects`. **Undo
    reverts an update of a link-table row** as a rule for every link table (`revertChangeGroup`, `undo.ts`: both images,
    the row as the step left it, its earlier columns back; the local adapter compares the whole row). The menu
    (`canvas-menu.tsx`) is the tab's and the project home tile's.
  - **Relationship lines by kind:** `canvas.look`'s `hideEntityRelationships` and `hideSourceRelationships`, present as
    `true` only while hidden, so older looks and the SQL default read as shown. **The rules in one place:**
    `src/domain/model/canvas-look.ts` (`applyLookPatch`, `isHidden`, `sameLook`), used by `setCanvasLook`, `look.tsx`
    (reviewers and readers change the layer and the kinds in their browser only), the menu and the chips
    (`HIDDEN_KINDS` in `view-state-bar.tsx`; "Show all" clears them with the layer in one patch). The canvas filters them
    in the layer's `useMemo` (`ModelCanvas.tsx`), so bundles, Focus, the Changes view, hover and the miniature follow.
  - **No browser menu:** `keepsBrowserMenu` (`src/ui/browser-menu.ts`: text fields, selects, `contenteditable`, links,
    selected text) is the one rule for `NoBrowserMenu` (the root layout's document listener), the canvas's
    `onContextMenu` and the toolbox. **A new surface with a menu of its own** opens it on `contextmenu` and calls
    `preventDefault` itself; a new text field needs nothing.
  - **The right button** (`CanvasModes.tsx`): a `contextmenu` while the right button is down waits for its `pointerup`
    (`rightPending`); Windows, the keyboard and touch keep the old path.
  - **The view's save** (`storeView`, `ModelCanvas.tsx`): the view and the left edge of one moment; the app's own changes
    store at once; `onMoveEnd` stores only a changed view (`lastStored`); `pagehide` and the unmount store a changed
    view; nothing before the first view, once the canvas is gone, or while the fit animates (`animatingUntil`). **A later view change made by the app** calls
    `storeView` with the view it sets.
- **Modelling ergonomics** (slice 17, D-72):
  - **The picker** (`src/ui/pick.ts` for its rules, `src/ui/pick-popover.tsx`): one for the page, opened with
    `openPick` and drawn by `PickHost` in the root layout; it opens hidden, a `ResizeObserver` on itself keeps it on the
    screen, then it shows and its filter takes the focus (no layout read in a commit). The concept picker is
    `pickConcept` (`src/app/_panels/concept-pick.ts`), used by `createEntityAt` (`canvas-host.tsx`, the click's or the
    toolbox's screen point) and `createFromTab` (`left-panel.tsx`, under the button). No concept is remembered. Since slice 21 (D-76) a picker may have a create item (`PickOptions.create`, `createText`,
    test id `picker-create`): last, while the typed text names no item (case and extra spaces ignored, `pickNorm`, which
    the filter uses too); Enter takes it only when no item is left (D-72's Enter). The concept picker's makes the concept
    with the entity (`createEntity`'s `newConcept`, shared with `createConcept` through `newConcept()`).
  - **Several links:** `linkRequirements` (`requirement.ts`): every pair without a live link, one change group, "Link
    requirements" for more than one; `allOf` for "Link all attributes…" (its toast and "Every attribute is linked
    already."). The menus' "Link to requirements…" opens the panel's picker through `focusDetails` (`data-pop`).
  - **The link drag** (`LinkDrag.tsx`, `startLinkDrag` in `ModelCanvas.tsx`): the handle `.rq-lk.nodrag` (one element,
    a mask, full detail, editors); the line and the target are value stores (`linkStore`, the left panel's `dropStore`),
    drawn in the overlay; the drop links through `linkDropped`, shared with the left panel's drop.
  - **A found row:** the tree keeps attribute ids (`fieldIds`, `FieldAlias.id`); `show` returns `hitId`; `open`
    (`left-panel.tsx`) calls `ui.showRow`, which opens a collapsed card or a hiding filter as one step "Show row"
    (`updateCanvasItem`'s `showRow`) and selects the row; `ui.place` answers the placed card's id.
  - **Frame handles:** the bottom-right one on every frame, the others on the selected frame only (`FrameLayer.tsx`);
    `resizedRect` (`frame-resize.ts`); `resizeFrame` takes `x` and `y`, writes the offsets of notes pinned to the frame
    so they keep their place (D-20), and is named "Resize frame".
  - **"Add attribute below":** `addAttribute`'s `below` renumbers the entity's attributes in the same group ("Create
    attribute"); the client holds them all (`saveRows`).
- **Derivations** (slice 18, D-73):
  - **The rules in one place:** `src/domain/model/derivations.ts`: the index (`derivationIndex`: a calculated
    attribute's live inputs of its own entity, in order, and its users), cycles (`reaches`, `closesCycle`), counting
    through a calculation (`throughCalculation`, `countsAsMapped`; the direct rule is the caller's), the gaps, the rows'
    squares (`derivedRows`, `rowCounts`) and the texts. `attribute.is_calculated` and `calc_rule`, `attribute_input`
    (format 14).
  - **The commands** (`src/domain/commands/derivation.ts`): "Calculate attribute", "Add calculation inputs", "Remove
    calculation input", "Change calculation rule", "Stop calculating"; undo and redo refuse a revert that closes a cycle
    (`calculationCycle`, `undo.ts`); `deleteAttribute` and `entityCascade` take the input rows (their states require
    `attributeInputs`).
  - **Two rules** (acceptance F1, F2): "mapped" and "fed" count any mapping or feed, any status (the row's dot, its
    square, `CardData.mapped`, the filters, frames, the Overview, the status bar, the project home, the thumbnails, all
    through `rowCounts` or `countsAsMapped`); "covered" is `lookupModel.coverageOf` (requirements), both through a
    calculation. **A later count of mapped or fed rows** uses them, never a mapping count of its own.
  - **The canvas:** `CardRow.calc` (rule, square) from `buildCards` on the server; the "=" mark is one element on
    calculated rows only (`text-fit`'s `CALC_MARK`), the square classes on the dot. Focus on an attribute lights its
    inputs' and users' mappings and the logical cards that feed them (`targetLit`'s `feeds`). The lens colours
    `scope.inputs`.
  - **InfoCube's lookups:** `cube_mapping.kind` `lookup`, `lookup_relationship_id` (may point to a deleted
    relationship), `lookup_default`; `lookupRelationships`, `lookupSentence`, `lookupRelationshipGone`, the chip "L".
  - **The demo:** `addDemoData` (`src/compose/seed.ts`) adds `addStarDerivations` after the star, for the seed, the reset,
    `npm run demo` and slice 18's fixtures; slice 15's fixtures keep `addModuleDemoData`.
- **InfoCube types** (slice 19, D-74): `cube_entity`'s `fact_type`, `is_factless`, `base_fact_entity_id`, `dim_kind`,
  `history` (replacing `scd_type`) and `snapshot_period`. **The rules in one place:** `aggregates.ts` (`aggregateIndex`:
  a base that is not a live fact reads as none; `reaches`, `baseChoices`), `outriggers.ts` (1:N the "1" end, 1:1 the
  `from` end, M:N none), `view.ts` (`historyLabel`, `tabMeta`, `cubeTitle`, `roleTitle`, `typeContext`) and `factHints`'
  four new hints (`TYPE_HINTS`). One command, `updateCubeEntity`, with an undo name per field. The role chip is
  `moduleView`'s `roles` text and title; a long one is cut in CSS (`infocube.css`; flex shrink factors of at least 1,
  since a factor below 1 hands out only that fraction of the overflow). **A later reader of a dimension's history** uses
  `historyLabel`, never an "SCD n" of its own.
- **InfoCube's unknown member** (slice 22, D-77): `cube_entity.has_unknown_member` (true for a dimension, null for a
  fact; older rows through `upgradeCubeEntity`) and the table `cube_attribute` (one live row per attribute while it
  holds a typed value; parent `attribute`, so it goes with its attribute and undo refuses it on a deleted one). **The
  rules in one place:** `src/modules/infocube/domain/unknown-member.ts` (`unknownDefault`, `unknownFit` for the eight
  types, `unknownValueOf`, `lookupPlaceholder`, the texts); the cube index answers `unknownOn` and `unknownOf` when it
  is built with `cubeAttributes`. The flag is `updateCubeEntity`'s; a value is `setUnknownValue`: it checks the row the
  page knows, its id and version, or that there is none, and a row gone or replaced is a stale version (so D-66's line
  shows). The panel (`UnknownMember` in `sections.tsx`) saves a value with its attribute held (`saveRows`) and sends the
  row of the last answer while the page still shows what it showed then. `TextField` has an optional `invalid`
  (`aria-invalid`, the warning border, its title). The checks `unkval` and `nounk` read the stored values from the
  rows (`CubeCheckRows.cubeAttributes`), not from a cube index passed in. A fact's Dimensions show the no-match part on
  a line of its own under the shared row, in that list only. **A later reader of the unknown member's value** uses
  `unknownValueOf`, never a default of its own.
- **Changes to resolve** (slice 7b, D-56): `source_change` rows, raised and settled by the import engine
  (`src/domain/import/`) and by the action commands (`src/domain/commands/source-change.ts`, the rules in
  `src/domain/source-changes/`); any command that deletes or decides the object of an open change settles it with a
  resolution (`settle.ts`), never silently. The cards are `src/app/_panels/source-changes.tsx`. Historical means every
  input retired (`isHistorical`): out of coverage, type problems and model consistency. Model consistency
  (`consistency.ts`) is computed on the project home's every load; its lines open objects with `?map=`, `?row=`,
  `?system=`. The Changes view (`src/canvas/Changes.tsx`, `changes-view.ts`; what it lights: `touched.ts`) is a fade
  request like Focus, and the two turn each other off; each driver clears only its own request (`lit:changes:` keys).
- **Classifications** (slice 7c, D-57): `src/domain/model/classifications.ts` holds the codes the rules read
  (`CLASSIFICATION_CODES`: `BK`, `PII`, `LK`, `DCK`, `DK`, `MAK`, `EFF`, `TECH`, `LDTS`, `RSRC`, `T_HUB`…), the 19
  built-in rows, the name rule and the index: `classificationIndex(list, links)`, built once per load (`ModelIndex`, the
  canvas's `buildCards`, the plan), answers `of(id)` and `has(id, code)`. Rules read codes only, never a name or the
  dropped column flags (`is_business_key`, `is_pii` on `source_column` are gone; the attribute's stay); their texts
  name the role. A new rule on a classification adds its "what stops" text (`WHAT_STOPS`). The only canvas mark is the
  BK badge on source rows; the PII badge is the attribute's. The local data file's format 8 (`src/data/local/upgrade-8.ts`)
  wrote the 19 rows per workspace, turned the flags into links and moved hand-typed column comments into notes; it lists
  them in `.data/upgrade-8-<file>.txt` (column paths only) with one log line. Notes are plain text like a mapping's
  (`setSourceNote`); a column's comment is the source's and read-only.
- **Session and unlocked organizations** (slice 8, D-58, F1, F3): the session is a signed cookie
  (`src/app/_lib/dev-session.ts`, HMAC with `INFOMAPPER_SESSION_SECRET` or `.data/session-secret`) holding the person
  and the organizations unlocked in it; `getSession()` (`src/app/_lib/session.ts`) refuses an unsigned or edited
  cookie. The test users' list unlocks every organization of that user; a password unlocks one. A page of a locked
  organization the person belongs to redirects to its link's form (`loadShell`), then back to the page if
  `safeReturnPath` accepts it (F14); `runCommand`, undo and the impact reads refuse a locked organization's writes
  ("Unlock {organization} first: …"). "Belongs" means has a workspace there. The hash lives in `organization_access`
  only, never reaches the browser and never a change event (`SECRET_COLUMNS`); pages send only the shown workspace's
  people (`workspacePeople`, F10). The last owner is checked again inside the local adapter's write.
- Writes: a server action calls `runCommand()` (`src/app/_lib/run-command.ts`), which runs the domain command and
  applies its write set through the adapter; refusals come back with the domain's message and are shown as toasts.
- **Saving in panels** (slice 9, P3): a field that saves an object's row calls `saveRow(row, (expectedVersion) => action(…))`
  (`useAction`, `src/app/_components/use-action.ts`), never `run` with `row.version`. `rowSaves` (`src/ui/row-saves.ts`)
  sends one save per object at a time, each with the newest version known when it is sent (the last answered, or the
  shown one if newer); a stale version, a permission or the archive cuts the saves waiting behind it (one toast), an
  invalid input does not. Every panel save action returns `Saved<T>` (`{ version, … }`); undo and redo run as
  `rowSaves.exclusive` and feed back the versions they wrote. A command takes only the fields that changed (an
  attribute's type: absent keeps, `null` clears). Fields are keyed by object and field (`fieldKey(id, field)`), never
  by their stored value (slice 13).
  **Slice 10a:**
  - **Canvas writes are on the chain:** a line's status, split, swap and delete, an attribute's delete, a column dropped
    on a mapping, "move to the frame's concept", and the panels' writes on rows their fields save (deletes, "Mark as
    needed", a classification's remove and restore, archive and unarchive) go through `saveRow`.
  - **`saveRows(rows, send)`** is for a write over several rows known before it is sent: an attribute's move (its
    siblings are renumbered), a merge, a concept deleted with "move to", the D-05 drop. A row with `shown` is checked:
    `send` gets its newest version. A row without it is held: its version is not sent. All listed rows wait for the
    write, and the answer's `versions` (`runCommand`'s option `{ versions: true }`, `writtenVersions`) reach every row.
  - **Held rows:** a cut on a held row does not stop a several-row save; only a cut on a checked row does. Since slice
    14b a refusal cuts only its checked rows' waiting saves, not the held rows' (their version was not sent; a held
    row's save is sent after it with the newest version known). A held row's version is not sent and the server reads it as it stands, so the save cannot overwrite anyone's change; the move
    (or a concept's "move to") is a separate intent of the person (Łukasz, slice 10a).
  - **Cuts:** "not found" cuts like a stale version, and a write with `{ deletes: true }` that succeeds cuts the saves
    of its rows waiting behind it, with no toast (they would be refused as not found). A cut delete shows no Undo toast.
  - **Rows only the server knows:** the change-to-resolve actions return `versions`, and since slice 14b run through
    `saveRows` (`useChangeRun` in `source-changes.tsx`): the change's row checked, the rows of its table held
    (`src/domain/source-changes/held.ts`, below). Still off the chain: only the role select (`docs/known-limitations.md`).

  **Slice 13 (D-66):**
  - **The draft:** a text field is uncontrolled and keeps what was typed (`useDraft` in `src/app/_panels/fields.tsx`; the
    rules in `src/ui/field-draft.ts`, `FieldDraft`). A stored value is written into the element in an effect only
    while the field has neither the focus nor a draft. Leaving it compares with the value on its way, else with the
    stored one (no "Nothing to change."). Every field's `onSave` returns its save's answer (`FieldSave`). **A new text
    field that saves a row uses `TextField`, `TextArea` or `useDraft` and returns the save.** Choice fields use
    `useChoice`: no draft, the newest stored value after a refusal.
  - **A refusal that cuts brings the fresh page:** `runCommand` revalidates after `stale_version`, `forbidden`,
    `archived` and `not_found`, and `useAction`'s `saveRow` and `saveRows` answer such a refusal only once the transition
    that applies its page has committed (`afterPage`), so the field sees the newest value and version; a plain `run`
    answers at once (a paste's refusal empties the clipboard with its toast, S10C-08). A locked organization's refusal
    has its own code `locked` (`lockedRefusal`): it cuts, but brings no fresh page (the password form).
  - **The mark** (`DraftLine`): after a stale or cut refusal, the conflict line ("Changed meanwhile to: …", "Use this",
    "Keep mine") when the field's stored value differs from its draft's base, else "Not saved"; while the line shows,
    leaving the field saves nothing. A permission or archive refusal: read-only, "Not saved. You can still copy it.";
    `locked`: "Not saved", editable; `not_found`: the draft goes. Escape puts the stored value back. Rich-text fields
    show the line in their dialog (`RichConflict`, the editor's `notice` and `replace`). Folds use `line-clamp`, never
    a measured height.
  - **A closed panel's draft:** a field with `keep` (`DraftKeep`: its `fieldKey`, field and object names) leaves its
    draft in `src/ui/field-drafts.ts`, the page's memory for its path; it comes back when the field mounts again.

  **Slice 14a (D-66 on the canvas's queue):**
  - **The canvas's queue and refusals:** the note and frame actions answer `ActionResult` with its code (`runCommand`,
    slice 13's fresh page after a cutting refusal); the canvas's result types keep `code`. Only a note's saves
    (`useNotes.save`) and a frame's `updateFrame` use it (`src/canvas/save-cuts.ts`): they answer `CanvasSave`
    (`{ ok }` or `{ ok: false, code }`), a cutting refusal (stale, forbidden, archived, not found, `locked`) cuts the same
    note's or frame's saves waiting behind it (`SaveCuts`: `cut`, not sent, no toast), and a refusal that brings the
    fresh page is answered once its rows are merged (`FreshWaits`, 3 s at most, as `afterPage`). `enqueue`,
    `enqueueGroup` and every other canvas write are unchanged.
  - **A note's text draft:** `src/canvas/note-drafts.ts` (`NoteDrafts`, one per note for the page; `draftRefusal`,
    `inConflict`, `onLeave`; `useNoteDraft`, a per-note subscription). A note's text never goes into its data before it
    is stored (`saveText`); a refusal keeps the draft with its kind, a stored save ends it, a deleted note drops it
    (`retain`). The status, colour, width, moves and pins stay optimistic with their rollback. **Read a note's text
    through its draft wherever it is shown** (the note, its panel, `NoteRow`); `NoteData.text` is the stored text.
  - **The mark:** `NoteLayer`'s `.nt-mark` button "Not saved" in the note's header, drawn only on a refused draft
    (titles `MARK_TITLE`, `MARK_TITLE_READ_ONLY`); its click selects the note and opens details (`CanvasHost.openDetails`).
    Escape in the note's editor drops a refused draft; leaving it during a conflict keeps the text unsaved.
  - **The panel:** `useDraft`'s option `outside` (`OutsideDraft`: a draft kept elsewhere, shown with its refusal's mark
    while the field has neither the focus nor its own text; "Use this" and Escape call its `drop`); the note panel's
    `TextArea` passes `ui.noteDrafts()`'s draft. The lists ("Notes on this canvas", a card's or frame's "Notes", the
    selection's) render `NoteRow` (`src/app/_panels/note-row.tsx`): each row reads only its own note's draft and says
    "Not saved" for a refused one. A frame's name has `keep`.

  **Slice 14b (the canvas's row, the source hold, leaving a page):**
  - **The canvas's row is one chain:** the look of the open canvas (`look.tsx`, `rowSaves.save` with the newest page's
    version; after a refusal the newest page's look shows), a non-open canvas's look and its delete from the tab menu
    (`saveRow`), "Use this look on all canvases" (`saveRows` over every canvas, `{ versions: true }`), the names switch
    (holds the row, above) and the tab's rename. A label's rename and delete answer with the versions they wrote (the
    live canvas's).
  - **The rename in the tab** (`TabRename`, `canvas-tabs.tsx`): `useDraft` (trimmed, `required`: an empty name goes
    back with "Enter a name."), saved with `saveRow`; the field stays until its answer and shows the line inside the
    tab, on one row after the field: `DraftLine`'s compact form (`inline`, `InlineDraftLine`: the same texts and test
    ids, the other value cut to 180 px with its title, 22 px buttons). A click in the tab's menu (a portal) reaches the
    tab's `onClick` through React's tree: only a click on the tab itself opens its canvas.
  - **The source hold** (`held.ts`): `tableRowIds` (the change's tables, their columns, the mappings reading them with
    all their inputs) and `mappingRowIds`. The whole source was over the 20 ms bar on 20,000 columns
    (`scripts/bench-source-hold.ts`); a later rule that holds more rows measures it the same way.
  - **Leaving a page** (`src/ui/leave-guard.ts`): a source holds the guard under its own key while it has unsaved text
    (`hold`, `release`, `guard(key, unsaved)`, `track(key, promise)` for saves); the `beforeunload` listener is on
    `window` only while something holds; nothing renders for it. Sources: `useDraft` (a refused draft, or the focus with
    typed text, from the element's own `input`, `focus` and `blur` events), kept drafts for the page shown
    (`field-drafts.ts`), `NoteDrafts` (released by `close` with the canvas), the note editor, the rich-text editor, and
    every save on `rowSaves` (with undo and redo) and on the canvas's queue. **A new text field that saves a row** gets
    it through `useDraft`; a new store of unsaved text calls `guard`; a new kind of write outside the chain and the
    canvas's queue is `track`ed. Fields that create something, search boxes and the zoom do not hold.
  - **A draft that leaves with its page is not kept** (`useDraft`'s unmount compares the address with the one it
    mounted on): Next.js changes the address before the old page's fields unmount, so a draft kept then would count as
    the next page's. No "Not saved: ... Open it again" toast for it (D-66: the draft goes with the page).
  - **The app never navigates after a save's answer** (`router.push`, `router.replace` in a save's callback): by then
    the person may have clicked a link, and the address still shows the old page until the link's page commits, so no
    check of `window.location` can tell. Example, S0-06 in slice 14b: the tab's rename dropped `?rename=1` with
    `router.replace` when its answer came; a person who had already clicked Home was taken back to the canvas. The drop
    now happens when the field is first left, before the save is sent (`leftRename`). Do what a page change needs
    before the save is sent, or leave it to the server's answer (its fresh page). Next.js's own late page is a separate
    case: `docs/known-limitations.md`, "Back right after a save can lose Forward".

