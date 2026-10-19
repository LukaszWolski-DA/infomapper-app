# CLAUDE.md – InfoMapper

Read this file at the start of every session. It is short on purpose; the details are in `docs/`.

## What this is

InfoMapper is a data-modeling application for data warehouse work. Business analysts model concepts, entities and
attributes, describe physical source tables and columns, map columns to attributes, and trace requirements to all
of it. One workspace holds one model; projects and canvases organise the work on it.

The product owner is Łukasz. He accepts every slice. He reads Polish and English; code, comments, commit messages
and docs in the repository are in English.

## Sources of truth (read before changing behaviour)

| What | Where |
| --- | --- |
| How the product behaves | `docs/prototype/infomapper-model-prototype.html` (open it in a browser and use it) |
| Why it behaves that way | `docs/decisions.md` (`D-xx` UX, `AD-xx` architecture) |
| Tables, columns, rules | `docs/data-model-v2.md` and `supabase/migrations/` |
| What to build now | `docs/prd/slice-XX-*.md`, the current slice only |

If these disagree, stop and ask. Do not resolve a conflict silently.

## How we work (AD-25)

- **One slice at a time.** Build only what the current PRD asks for. Do not add features, screens or options that
  are not in it, even small ones. Put ideas in `docs/ideas.md` and mention them at the end of your answer.
- **Work in the steps the PRD lists, and stop after each step** with a short summary of what changed and how to
  check it. Wait for Łukasz before the next step unless he said to continue.
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
- Use `data-testid` attributes for elements tests need; name them after the components (e.g. `card-entity`,
  `panel-inspector`, `nav-breadcrumbs`).

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
  miniature's and the fading layer's commit counters (`counters`). The undo history lives in the server's memory and is
  empty again after each reseed.
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
  pinned notes and requirement cards, as one SVG path in the overlay, and the lit lines and lit trace lines above it; since
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
- Never run `npm run e2e` while your own dev server runs: stop it first.
- Measure canvas performance only with `MEASURE=1` (headed Chrome, visible window), on the dev server or, with
  `MEASURE_BUILD=production` after `npm run measure:build`, on the measurement-only production build (AD-31: starts only
  with `INFOMAPPER_MEASURE=1`, on 127.0.0.1; a normal production build still refuses the local adapter). Keep the AD-24
  CSS rules, including no `overflow: hidden` on repeated card elements unless the text may not fit
  (`src/canvas/text-fit.ts`). The `DIAG` switches (`?diag=nolines`, `blocks`, `noframes`, `nolabels`, `collapsed`,
  `nonotes`, `nolabelmarks`) work only in that measurement build (`isMeasurementBuild()`, `INFOMAPPER_MEASURE=1`); a dev
  or normal production run ignores them. Every element in the viewport costs paint and layerize time on each pan and
  zoom frame: keep repeated marks to one element (slice 3a's label marks are CSS masks); `S3B-15-elements.spec.ts`
  counts them against the previous tag. A sitting is balanced (`--rounds 2`, each side first once) and starts with one
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
- Writes: a server action calls `runCommand()` (`src/app/_lib/run-command.ts`), which runs the domain command and
  applies its write set through the adapter; refusals come back with the domain's message and are shown as toasts.
