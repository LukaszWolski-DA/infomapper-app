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
change and remove people (slice 8, D-58).

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
- **Step 1 checks the PRD against the code.** A PRD is a proposal to verify, not a specification: it may be written
  from the prototype and the docs without reading the code. In step 1, check every item, decision and acceptance
  criterion against the code, `docs/decisions.md` and the earlier slices' acceptance docs, and write into
  `docs/prd/slice-XX-acceptance.md` where the PRD is wrong, contradicts the code or a decision, duplicates what the app
  already has, misses what the code needs, or costs more than it assumes (data model, undo, change events,
  performance), each with the files and functions behind it and a proposal. List the differences between the
  reference prototype and the app that the slice touches. No application code in step 1; Łukasz answers before step 2.
- **One branch per slice** (`slice/00-skeleton`, …), small commits in Conventional Commits style
  (`feat:`, `fix:`, `test:`, `docs:`, `chore:`). Never push to `main` directly.
- **Done means:** the PRD’s acceptance tests pass, `npm run lint`, `npm run typecheck`, `npm test` and
  `npm run e2e` pass, and you have described anything you assumed.
- **When unsure, ask.** A question costs less than a wrong guess.

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
- **Full e2e runs** (Łukasz, slice 4b-2): after each step one full run (`npm run e2e`, from scratch, no dev server
  running); if a test fails, run that file three times on its own to tell a flake from a bug. Before a merge: two full
  runs in a row. Report each run's time.
- **Small slices** (Łukasz, slice 5a): after each step the slice's specs and the earlier specs of what the step
  touched, plus CI (lint, typecheck, unit tests); a failing test run three times on its own; one full e2e run before
  the merge. The PRD says which kind a slice is.
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

- `docs/prototype/` – the frozen reference.
- `spikes/` – throwaway evaluations; only change them when asked.
- `docs/decisions.md` and `docs/data-model-v2.md` – change only together with Łukasz, in the same pull request as the
  code that needs the change.

## Commands

```
npm run seed             # demo data into .data/dev-db.json (only if it does not exist yet)
npm run reset-dev-data   # replace .data/dev-db.json with fresh demo data
npm run seed:large       # add the workspace "Performance test" (the spike's 100 cards, labels and notes; slice 4b-2: a second canvas with 12 requirement cards) to .data/dev-db.json
npm run dev              # local app on http://localhost:3000; sign in at /sign-in by picking a test user
npm run build            # production build (npm start serves it; no dev sign-in, no local data)
npm run measure:build    # measurement-only production build in .next-measure (AD-31)
npm run measure:start    # serve it on http://127.0.0.1:3300 with INFOMAPPER_MEASURE=1 (local adapter, dev sign-in)
npm run lint             # ESLint, including the layer rules (eslint-plugin-boundaries)
npm run typecheck        # next typegen && tsc --noEmit
npm test                 # Vitest: src/**/*.test.ts and tests/
npm run e2e              # Playwright: e2e/; own dev server on port 3200, .data/e2e-db.json reseeded before every test
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
npx tsx scripts/bench-requirement-index.ts                    # the requirement index on 500 requirements, 5,000 attributes (not a gate)
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
  which unlocks every organization. The undo history lives in the server's memory and is empty again after each
  reseed.
- In development the canvas counts its commits in `window.__imCanvasCommits` (slice 2c): `S2C-12.spec.ts` checks that
  nothing re-renders a canvas with collapsed frames while it is idle or panned and zoomed, `S3A-14-idle.spec.ts` the same
  with notes below 40 % zoom (a note measured while drawn plain once grew on every round), `S3B-15-idle.spec.ts` on a
  live canvas. Keep it when changing `ModelCanvas.tsx`; a render loop once cost a collapsed canvas a third of its frames.
  The Overview's miniature counts its commits in `window.__imMiniatureCommits` (slice 3b): `S3B-13.spec.ts` checks that
  panning and zooming do not redraw it and a note's drag redraws it once, on the drop.
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
  (`src/canvas/MoreTools.tsx`) takes Focus and the notation up to 1,200 px and the four tools up to 1,100 px
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
