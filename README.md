# InfoMapper

A data-modeling tool for data warehouse work: logical entities, physical source tables and the mappings between them, on one canvas.

**Status:** slices 0 to 29 are built, and so are the e2e reliability, CI e2e, eight-part, nine-part and ten-part e2e chores, the Next.js 16.4 updates and the fixes since; each slice is merged and tagged (`slice-NN`) when Łukasz accepts it. On a React Flow canvas: slice 0's sign-in, organizations, workspaces, projects and
canvases; slice 1a's model (concepts, entities, attributes, relationships, source systems, tables and columns, and
mappings with one or more inputs); slice 1b's modeling on the canvas (drag a column onto an attribute to map it, draw
relationships, create entities with the Entity tool or the right-click toolbox, reorder attributes, widen cards, see a
row's connections by hovering, place feeding sources beside a card, undo and redo every change); slice 2a's selection
of several cards, group actions, canvas look and layers; slice 2p's measuring tools; and slice 2b's frames, which
stand for a concept, a source system or just an area, with membership, the concept question, label chips, “Put in a
new frame” and “Arrange into frames”; slice 2c's collapsed frames: a frame collapses into one block listing its cards,
the lines to and from them are bundled per pair of ends with a count, a bundle's panel shows what it holds, “Collapse
all” / “Expand all”, and reviewers and readers collapse in their own tab only; slice 3a's working labels (tickets and
change requests on entities, attributes, mappings, tables and columns, kept apart from the model, with marks on the
canvas, a label panel and pins on the project home) and notes on the canvas (free or pinned to a card or frame, open or
resolved, in the selection, counted on cards, blocks, the canvas overview and the project home); slice 3b's active
working context (while it is on, everything you create or change in the model gets its label in the same undo step)
and live label canvases (a label's own canvas that shows exactly what carries it, with context cards for partly
labeled entities and tables, follows every labeling, and adds or removes the label when a card is added or removed
there, after a question), and the notes in the Overview's miniature; slice 4a's requirements everywhere but the canvas (a Requirements tab, the
requirement panel with coverage computed from the mappings, Requirements sections in the element panels, the project
home and the status bar, reviewers setting the status as their approval, four-eyes) and the rich-text editor for
definitions and descriptions; slice 4p's performance review: the hover and selection marks on an overlay of their own
(C-10 from about 120 ms to about 19 ms), the fading mechanism slice 4b's Focus and requirement lens will use, and error
pages with a boundary around the canvas; slice 4b-1's requirements on the canvas: requirement markers on
cards, coverage colours when a requirement is selected (blue covered, orange gaps; a dot below 40 % and on collapsed
blocks), Focus on any selection from the toolbar, the menus and a chip, entity links as items of their own, and figures
measured to the screen; slice 4b-2's requirement cards: a violet card per requirement with a three-part coverage bar
and dashed trace lines to what it is linked to, placed from the requirement's panel and the element panels (beside the
element, never over a frame), a requirement dragged from the left panel onto a row, a card or a mapping line linked to
it at once, Focus lighting the cards whose scope holds the focused element, and the project home opening the canvas that
shows most of a requirement; slice 5a's side panels: the toolbar's buttons at its two ends show and hide the object browser
and the details panel, their inner edges resize them (a guide line while dragging, double-click to reset, the arrow
keys), the layout is remembered per person, the model stays in place when the left panel changes, and up to 1000 px
wide the panels slide over the canvas; slice 6a's view-state bar: chips at the end of the breadcrumbs row for everything
that hides or fades things on the canvas (Focus, the layer, row filters, collapsed cards and frames, hidden resolved
notes, the active tool; a live canvas's “Live: {name}” first), each removed with its ×, “Show all” as one undo step for
the layout part, chips that do not fit folded into “+{n}”, “Open notes on canvas {n}” in the status bar, a top bar that
fits every width from 800 to 2,560 px (short labels, then “More” for Focus, the notation and the tools), and a
remembered view that stays put beside another left panel; slice 6b's back and forward: two buttons before the
breadcrumbs, Alt+←/→, the browser's back and the mouse's buttons walk one history, the browser's own, in which pages and
single selections are places (going back selects the item, centres it when it is off screen and never opens a hidden
details panel; a place that no longer exists says so); slice 7a's source import: “Import sources…” describes a system
from a file in InfoMapper's source standard, a catalog query's result (SQL Server, PostgreSQL, Oracle) or DDL scripts,
and re-imports it; a review shows every new, changed, renamed, missing and returning table, column and relationship and
the approved mappings that go back to review before anything is written, and the import is one undo step; missing
tables and columns are marked in the Sources tab, on the canvas and in the panels, and each system has a panel with its
imports; slice 7b's changes to resolve: every source change an import finds that needs a decision (a column or table
that left, a new column or table, an approved mapping sent back for a type conflict, a business key change or a
rewritten rule) waits on the system's and the table's panels, counted in the tree and the status bar, with actions
that show their consequences first and are one undo step each (retire as historical, move the mappings, delete with
what goes with it and the coverage change, map, not needed, approve again under four-eyes, approve again all), the
review's callouts before the import, model consistency on the project home and the canvas's Changes view, which fades
what source changes do not touch; slice 7c's classifications and notes: one list of classifications per workspace (19
built in, general and Data Vault 2.0 ones, and its own; each renamed, removed with its uses and what stops shown first,
and restored), toggled on table and column panels, read by the app's rules through their fixed codes (BK, PII, LK…),
the modeller's note on tables and columns beside the source's read-only comment, an import that reads every
classification a file names, suggests Business key and Link key and never changes the modeller's on a re-import, and,
in Data Vault 2.0 mode, a table's Data Vault reading (hub, links, satellites; hints only); slice 8's organizations and
sign-in in their development form: a start page to sign in (e-mail, organization, its password) or create an
organization, each organization's link, a password asked once per organization in a session, "New organization…" in
the organization menu, and on the People tab adding a person, changing roles, removing people and the organization's
access (its link and password); slice 9's saves in panels without false conflicts (one save per object at a time, each
with the newest version known), a project's name and description edited on its home, and a zoom typed in the top bar;
slice 10a's canvas writes on the same save chain as the panels, and a relationship from an entity to itself ("Relate to
itself" in the card's menu), drawn as a loop; slice 10b's relationships between source tables drawn as grey lines between the table cards (D-62); slice 10c's copy and paste of an attribute into any entity, the copy following its original's type and Personal data (D-63); slice 11's aliases of entities and attributes, shown on each canvas by its two check boxes with exceptions per card, and found by the search (D-64); slice 12a's Undo and Redo on the workspace and project home pages, pins as undo steps, and deleting a project from its home with a preview of the canvases it takes (D-65); slice 12b's thumbnails on the canvas tiles and the workspace home's project tiles, drawn from their own address with the page's colours, and the tiles' frame count (D-29, AD-32); slice 13's fields that keep what the person typed across fresh pages and after any refusal, with a conflict line ("Use this", "Keep mine"), "Not saved" and Escape (D-66). Slice 14a brings the same to notes and frames: a note's draft on the canvas with its "Not saved" mark, in its panel and in the panels' lists, and a frame's name with the conflict line (D-66). Slice 14b saves the canvas's own row on the same chain (its look, the names switch, a rename in its tab with the conflict line inside the tab, its delete), holds the panel saves of a change's tables while a change-to-resolve action is on its way, and asks the browser to warn before a page with unsaved text is reloaded or closed (D-66). Slice 15a starts the InfoCube module (AD-33): an organization's licence and a workspace's switch in the settings (AD-35), facts and dimensions as entities of the dimensional level with their role on the card and in the panel, a Cube tab with New fact and New dimension (also in the canvas's toolbox), relationships and paste within one level, source columns mapped only to logical attributes (AD-34), and the Sales star in the demo data (`npm run demo`). Slice 15b describes facts and dimensions in their panels (a fact's grain, measures with their additivity and Σ marks on the card, its dimensions with the keys that carry them, "Add key" and hints; a dimension's SCD type and the facts that use it) and gives every relationship a role name per end, shown in its sentences and on its line's pill, so one dimension plays several roles (the star's Order date and Ship date); parallel relationships and loops are 20 px apart. Slice 15c feeds facts' and dimensions' attributes from logical attributes through dimensional mappings: lines between rows, drawn by a drag in either direction with the other level lit, a mapping's panel (its inputs, target, kind, rule, status and note), approval by reviewers with four-eyes and D-51's first rule, "fed" coverage on the card and in the Overview, the delete previews with what loses its feed, and "Create dimension from this…" on a logical card. Slice 15d traces requirements to facts and dimensions: a requirement's scope runs through dimensional mappings to the logical attributes and their sources, its coverage follows D-31's rule at both levels, the lens colours the feeding rows and Focus lights the requirement's own dimensional lines; a fact's or a dimension's panel shows "Fed from concepts"; the Cube tab's "Bus matrix" shows facts against dimensions with one dot per relationship; the demo's REQ-210 is traced to the Sales star. Slice 16 adds "Add attribute" to an entity card header's menu; moves a canvas among its project's tabs (Move left, right, to the start, to the end, one undo step, in the tab's and the tile's menu); shows or hides relationship lines by kind (between entities, between source tables) per canvas, with a chip in the view-state bar; keeps the browser's context menu out of the app except on text fields, the description editor, links and selected text; and fixes the right-button pan on Linux and macOS, the top bar at 1,201 px and the view's save. Slice 17 asks for a new entity's, fact's or dimension's concept in a picker outside a concept frame; links several requirements at once from an element panel, and all of an entity's attributes in one step; links a requirement by a drag from its card's handle; shows a found attribute's row; resizes a selected frame from every edge and corner; and adds an attribute below a row from its menu. Slice 18 calculates an attribute from others of its entity with a plain-text rule ("Calculated from", the row's "=" and its square), counts it as mapped or fed and covers its requirements through its inputs everywhere, lights its inputs and users under Focus and names it in an input's delete; and gives InfoCube's dimensional mappings a third kind, Lookup, through a relationship of a dictionary with a value for no match. Slice 19 gives a fact a type (Transaction, Periodic snapshot, Accumulating snapshot), marks it factless or an aggregate of another fact (never in a cycle), gives a dimension a kind (Standard, Junk) and a history (SCD 0, 1, 2 or Snapshot with its period), derives outriggers from relationships between two dimensions, and names all of it in the role chip, the Cube tab and the bus matrix (D-74). Slice 20 checks the model as it stands, read only (D-75): duplicate attribute names, attributes calculated and also mapped, copies whose original was deleted, keys copied without a relationship or the wrong way, relationships without a copied key, and with InfoCube every fact's hints and the approved feeds that the logical model no longer supports; the project home lists them after Model consistency with a link in its stats, a slanted "!" marks the card's header and the row, the status bar counts a canvas's lines and opens them in the details panel, and the entity, attribute, relationship and dimensional mapping panels show their own. Slice 21 closes five small gaps (D-76): a logical row dropped onto a source column maps them as the opposite drag does, InfoCube on or off; the concept picker creates a new concept with the entity, fact or dimension in one undo step; a requirement gap says "column left the source"; InfoMapper's mapping rule keeps its draft when its panel goes; and the workspace settings set a concept's colour from the palette. Slice 22 gives a dimension its unknown member (D-77): on for every dimension unless turned off, a value per attribute with defaults by type (an Integer primary key −1, a String "Unknown"), a typed value that does not fit its type marked with why, "no match → {value}" in a fact's Dimensions, the value as a lookup's "When no match" placeholder, and two model checks. Slice 23 gives a workspace's conventions one place, the workspace home's "Metadata conventions" tab (D-78): the classification list (slice 7c's dialog moved there) with a definition for every classification and an optional code for own ones, which the import matches; the concepts' colours (moved from Settings); and the naming conventions, plain text. A new workspace's built-in classifications are named and defined in the documentation language chosen when it is created (English, Polish, German). Slice 24 makes the entity stereotypes the workspace's list in that tab (D-79): the five built-in ones renamed and defined, own ones added with a code and removed with their entities moved, the names on cards, in the Model tab and in the entity panel, where the chosen one's definition shows. Slice 25 starts the InfoDocumenter module (D-80): an organization's licence and a workspace's switch; the workspace home's Documentation tab with documents made from three presets, private or shared; a document's form on one page (title page, scope, sections); and the document page laid out in A4 pages in the browser (Paged.js) with a title page, contents with page numbers, the running header and footer and the watermark, printed to PDF by the browser: a data dictionary of the logical model, a source-to-target mapping and InfoCube's dimensional model, with the labels in English, Polish or German. Slice 26
replaces the form with InfoDocumenter's editor (D-81): the sections on the left (added, removed, moved, renamed, turned
off), a preview in the middle that lays out real pages while that is quick and otherwise shows a quick sheet until you
update the pages, and every option on the right; the prototype's sections without figures (overview, readiness with the
model checks, conventions, source tables with the Data Vault reading, the classification register, requirements,
traceability, data quality rules, InfoCube's bus matrix); the dictionary's three layouts and its facts and dimensions;
and a style per document: its own language, Standard, Formal (IBM Plex Serif) or Compact, an accent, black and white,
A4 or A3, portrait or landscape, numbering, banded rows and header and footer fields. Slice 27 draws figures in
documents (D-82): canvases and frames drawn from the model's own data as images in IBM Plex, never screenshots, as on
the canvas or adjusted (rows, line kinds, status marks), whole or in parts, upright or turned, with their captions; the
Diagrams and Figure sections, Model overview's figures, the dictionary's concept frames, InfoCube's star diagram per
fact, numbering and a list of figures, the smallest names in diagrams; the page outline for documentation in a
canvas's look, showing the pages a canvas takes; and the editor's side panels resized by their handles. Slice 28 makes
the editor easier to work in (D-83): its side panels are hidden and shown as the canvas's, with the canvas's widths; a
double-click on a section shows its options and focuses the first; the Document panel folds its parts, with Header and
footer and Cover shut at first and Sharing last; every control is named for screen readers; short labels keep choices on
one line; and an option that is ticked while nothing in the document uses it says why.
Slice 29 is the database program's walking skeleton (AD-37), with no change to how the app behaves on the local adapter:
- a Postgres adapter that reads every port as the local adapter does and refuses every write, the pages then read only;
- Supabase Auth with a password per person;
- the Supabase project `infomapper-dev` and a protected Vercel preview in Frankfurt;
- a timing record per request and the first measurement ([slice 29's figures](docs/prd/slice-29-measurement.md)).
Slice 30 makes Postgres take writes (AD-38): each write in one transaction with the workspace's lock, the access read
again and six count rules checked inside it on both adapters; a lasting undo history on Postgres (`undo_step`, D-59's
note); imports gzipped by the browser to fit a Vercel function's request; a save indicator and a server badge in the top
bar (D-84); and "Add person" disabled online until the people slice (D-58's note; slice 33 replaced it).
Slice 31 copies Łukasz's own model (organization KB) into `infomapper-dev` (AD-39): from a copy of a backup of his local
file, again or removed by one command, with his own Supabase account, backup and restore by script, and a reset that
refuses while it is there; the lock timeout becomes 15 s; the measuring specs take their workspace and account from
variables. The local file was the model's master until Łukasz's switch on 20 November 2026; since then the online copy is the master and the local file a backup.
Slice 32 lets a person choose the theme (D-85, an exception to AD-31's "no new feature slices"): Light, Dark or
System (the default) in the person's menu, remembered per browser in a cookie the server reads, so the first paint is
right; no data changes.
Slice 33 brings people online (AD-40): an Owner or Admin invites by a link they copy and send themselves (7 days, once;
pending invitations with New link and Revoke), the person joins on `/invite/<token>` and sets their own password;
"Change password…" in the person's menu and a one-time "Password reset link" for 24 hours, online only. "Invite person"
replaces "Add person" on both adapters; the server makes Supabase accounts with the secret key, read only by
`src/app/_lib/supabase-admin.ts`.
Slice 34 gives InfoDocumenter's editor "Markdown" beside "Print / PDF" (D-86; feature slices return, AD-31's note): the
document as one Markdown file, with the same sections and language as its PDF, built at the click, with Copy and
Download .md; its figures are Mermaid `erDiagram` blocks that Mermaid 9.4.3, 10.9.5 and 12.3.0 parse, for any Markdown
tool that draws Mermaid.
Slice 35 builds baselines (D-87): the workspace home's "Baselines (n)" tab, where owners, admins and modelers take a
named, immutable baseline of the model, rename it, and owners and admins delete it; every member compares a baseline
with Now or with another baseline (Added, Changed, Removed, with a filter and a kind), on the server, references compared
by id and shown by name.
Slice 36 makes documents from a baseline (D-88): the editor's "Model state" chooses the live model or a baseline, a
document from a baseline shows the model exactly as it was (its footer and draft mark name it), the section "Changes since
a baseline" lists what was added, changed and removed in the document's scope, the sign-off preset makes a package for
the client, the Baselines tab has "New document from it" and "Make a document", and a document whose baseline is deleted
stays and says so.
Acceptance:
[slice 0](docs/prd/slice-00-acceptance.md), [slice 1a](docs/prd/slice-01a-acceptance.md),
[slice 1b](docs/prd/slice-01b-acceptance.md), [slice 2a](docs/prd/slice-02a-acceptance.md),
[slice 2p](docs/prd/slice-02p-acceptance.md), [slice 2b](docs/prd/slice-02b-acceptance.md),
[slice 2c](docs/prd/slice-02c-acceptance.md), [slice 3a](docs/prd/slice-03a-acceptance.md), [slice 3b](docs/prd/slice-03b-acceptance.md), [slice 4a](docs/prd/slice-04a-acceptance.md), [slice 4p](docs/prd/slice-04p-acceptance.md), [slice 4b-1](docs/prd/slice-04b1-acceptance.md), [slice 4b-2](docs/prd/slice-04b2-acceptance.md), [slice 5a](docs/prd/slice-05a-acceptance.md), [slice 6a](docs/prd/slice-06a-acceptance.md), [slice 6b](docs/prd/slice-06b-acceptance.md), [slice 7a](docs/prd/slice-07a-acceptance.md), [slice 7b](docs/prd/slice-07b-acceptance.md), [slice 7c](docs/prd/slice-07c-acceptance.md), [slice 8](docs/prd/slice-08-acceptance.md), [slice 9](docs/prd/slice-09-acceptance.md), [slice 10a](docs/prd/slice-10a-acceptance.md), [slice 10b](docs/prd/slice-10b-acceptance.md), [slice 10c](docs/prd/slice-10c-acceptance.md), [slice 11](docs/prd/slice-11-acceptance.md), [slice 12a](docs/prd/slice-12a-acceptance.md), [slice 12b](docs/prd/slice-12b-acceptance.md), [slice 13](docs/prd/slice-13-acceptance.md), [slice 14a](docs/prd/slice-14a-acceptance.md), [slice 14b](docs/prd/slice-14b-acceptance.md), [slice 15](docs/prd/slice-15-acceptance.md) (15a to 15d), [slice 16](docs/prd/slice-16-acceptance.md), [slice 17](docs/prd/slice-17-acceptance.md), [slice 18](docs/prd/slice-18-acceptance.md), [slice 19](docs/prd/slice-19-acceptance.md), [slice 20](docs/prd/slice-20-acceptance.md), [slice 21](docs/prd/slice-21-acceptance.md), [slice 22](docs/prd/slice-22-acceptance.md), [slice 23](docs/prd/slice-23-acceptance.md), [slice 24](docs/prd/slice-24-acceptance.md), [slice 25](docs/prd/slice-25-acceptance.md), [slice 26](docs/prd/slice-26-acceptance.md), [slice 27](docs/prd/slice-27-acceptance.md), [slice 28](docs/prd/slice-28-acceptance.md), [slice 29](docs/prd/slice-29-acceptance.md), [slice 30](docs/prd/slice-30-acceptance.md), [slice 31](docs/prd/slice-31-acceptance.md), [slice 32](docs/prd/slice-32-acceptance.md), [slice 33](docs/prd/slice-33-acceptance.md), [slice 34](docs/prd/slice-34-acceptance.md), [slice 35](docs/prd/slice-35-acceptance.md), [slice 36](docs/prd/slice-36-acceptance.md).

## Getting started

Requires Node.js 22 and npm.

```
npm install
npx playwright install chromium   # once, for the end-to-end tests
npm run seed                      # demo data in .data/dev-db.json
npm run dev                       # http://localhost:3000
```

Open http://localhost:3000. The start page signs in with an e-mail address and the organization's password, or creates
an organization; below it, the development list of test users signs in with one click, as before, with every
organization of that user unlocked. **The demo organizations' password is `demo-pass`** (InfoMate and Retail Co; a
data file from before slice 8 gets it when it is first read, with one log line). The demo data mirrors the prototype,
including its model (concepts Customer, Sales, Product, Reference data; sources CRM, WEB, ERP) on the canvases of
Retail Co – DWH and Sales analytics, and the prototype's five requirements (REQ-101 to REQ-105) in Retail Co – DWH.
The demo's sources record no import (“not imported yet”). To try the import, use the test files in
`src/domain/import/samples/` (the prototype's CRM, HR and flat-file samples, its DDL scripts, and catalog-query results
of the demo's systems; see the README there): “Import sources…” at the top of the Sources tab.

| Organization | Workspace | People |
| --- | --- | --- |
| InfoMate | Retail Co – DWH (projects Customer 360 and Order management) | Łukasz owner, Anna Nowak modeler, Piotr Wiśniewski reviewer, Kasia Zielińska reader (guest) |
| InfoMate | Bank X – Risk DWH (archived) | Łukasz owner, Anna Nowak modeler |
| Retail Co | Sales analytics | Marek Lis owner, Łukasz reviewer (guest) |

On the local adapter, data lives in a JSON file on the server, and sign-in means picking a test user (AD-29) or an
organization's shared password (D-58). All of it exists only in development: a production build refuses it. The session
is a signed cookie; its secret is `INFOMAPPER_SESSION_SECRET` (`.env.local`, at least 32 characters) or else
`.data/session-secret`, made on first use.

## Environments (slice 29)

| # | Environment | Adapter and sign-in | Where its values live |
| --- | --- | --- | --- |
| 1 | `npm run dev` on the laptop | the local adapter (`.data/dev-db.json`, `.data/demo-db.json`), the development sign-in | `.env.local` (none needed) |
| 2 | `npm run dev:pg` on the laptop | Postgres on `infomapper-dev`, Supabase Auth | `.env.postgres.local` (git-ignored), read only by `npm run dev:pg` and the Postgres scripts |
| 3 | The Vercel preview of `dev` (its branch address, `infomapper-app-dev-git-dev-lukaszs-projects-9ffbc132.vercel.app`) | Postgres on `infomapper-dev`, Supabase Auth; it takes writes from `dev`'s first deployment with slice 30 | Vercel's Preview environment, scoped to that branch |
| 4 | Production (slice D) | its own Vercel project `infomapper-app` and Supabase project `infomapper-prod` | – |

- **The switch** is `INFOMAPPER_DATA` (`local` by default, `postgres` set by `npm run dev:pg`, the Postgres scripts, CI's
  Postgres jobs and Vercel). It is never in `.env.local`, which Next.js loads for `npm run dev`. The two never mix: on
  Postgres the local adapter and its files refuse to start; on the local adapter no connection is opened.
- **Environments 2 and 3 share `infomapper-dev`.** Since slice 30 a write in one shows in the other, and a
  `pg:seed -- --reset` from the laptop changes what the preview shows at once (the undo histories too). Since slice 31
  `infomapper-dev` may hold a copy of Łukasz's model (AD-39); the reset then refuses until it is backed up and removed.
- **Run a `pg:` script only from a checkout whose code is the one its docs describe** (slice 31): another branch's script
  may lack a guard.
- **The server badge** says `Online · {INFOMAPPER_SERVER_NAME}` on Postgres (`dev` in `.env.postgres.local` and in
  `dev`'s Preview variables), `Local` on the local adapter.
- **Running against Postgres:** put the values in `.env.postgres.local` (the names are in `.env.example`), then
  `npm run pg:check`, `npm run pg:migrate`, `npm run schema:check -- --existing`, `npm run pg:seed` (`-- --reset` to start
  over), `npm run pg:accounts`, `npm run dev:pg`. The demo people sign in with their e-mail addresses (the table above)
  and `INFOMAPPER_DEMO_PASSWORD`.

## Branches (chore/dev-branch)

- **`dev`** is the integration branch and the repository's default: slice, `fix/` and `chore/` branches start from it
  and merge into it after their full run (CLAUDE.md, "Test runs"). A slice's tag (`slice-30`, …) is on its merge commit
  into `dev`.
- **`main`** takes only releases: a pull request from `dev`, merged with a merge commit, tagged `release-YYYY-MM-DD`
  (`-2`, `-3` for a second or third the same day). It needs no full run of its own when `dev` holds exactly the tested
  tree. A hotfix path into `main` comes with production (slice D).
- **Both are protected by rulesets:** no direct pushes or deletions, and the checks CI `check` and Schema `migrations`
  and `smoke` required. The E2E workflow's jobs are named `e2e-*`, so none shares a name with them.

## Hosting (slice 29, AD-22's note)

- **Vercel project `infomapper-app-dev`** (Pro, functions in `fra1` beside Supabase's Frankfurt; Fluid compute; Node.js
  22.x set explicitly, since Vercel's default is newer than `package.json`'s `engines`). Production in slice D gets its
  own project, `infomapper-app`, and Supabase `infomapper-prod`.
- **Only `dev` deploys** (since chore/dev-branch; `slice/29-database-skeleton` before), as a Preview, by two layers that
  say the same: `vercel.json`'s `git.deploymentEnabled` and the project's Ignored Build Step. Why both: Vercel reads
  `vercel.json` from the commit it builds, so a branch without the file would deploy. `dev` is reached at its branch
  address, `infomapper-app-dev-git-dev-lukaszs-projects-9ffbc132.vercel.app`, a preview domain that Standard Protection
  covers. The project's Production Branch stays `main`, which never deploys here; the repository's default branch is
  `dev`.
- **To preview another branch,** change three things together: `deploymentEnabled`, the Ignored Build Step's branch name
  and the variables' branch scope.
- **Never delete the project's last Production deployment.** While a project has none, Vercel classifies any build as
  Production, even from a preview branch, on the public domain without the Preview variables (seen twice on 17 November
  2026; community reports, no official answer). The current one is an inert bootstrap: an empty commit built without
  variables, whose local mode refuses to start. The same care applies to the production project's first deployment in
  slice D.
- **Importing the repository:** the wizard detects `spikes/canvas-react-flow` as a second Next.js app and offers a
  "multi-service" project with a prompt for a `services` key. Import a standalone project (root `./`, Next.js) and ignore
  the prompt.
- **Variables:** Preview only, scoped to the branch. The database URL (the transaction pooler), `SUPABASE_URL` and
  `SUPABASE_PUBLISHABLE_KEY` as Secret; `INFOMAPPER_DATA=postgres`, `INFOMAPPER_TIMING=1` and (slice 30)
  `INFOMAPPER_SERVER_NAME=dev` as plain values.
  - `SUPABASE_SECRET_KEY` (slice 33, AD-40): Preview, scoped to `dev`, Sensitive, holding a key of its own
    (`vercel_dev_preview` in Supabase, so it can be revoked apart from the laptop's). It bypasses Row Level Security;
    the app reads it only in `src/app/_lib/supabase-admin.ts`. The variable already existed before slice 33 (when and
    why is not known); since slice 33 it holds this key.
  - **Never in Vercel:** `INFOMAPPER_MIGRATION_URL` (the scripts' only) and `INFOMAPPER_DEMO_PASSWORD`.
  - The Protection Bypass for Automation secret lives only in `.env.postgres.local`
    (`VERCEL_AUTOMATION_BYPASS_SECRET`), for the measuring spec and the probe script.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Local app with hot reload on http://localhost:3000 |
| `npm run build` / `npm start` | Production build and server (no development sign-in, no local data) |
| `npm run lint` | ESLint, including the layer rules (AD-19) |
| `npm run typecheck` | Route types, then TypeScript (strict) |
| `npm test` | Vitest unit tests (`src/**/*.test.ts`, `tests/`) |
| `npm run ui:check -- --label <name>` | Slice 37: the automatic UI check on a dev server (127.0.0.1:3400) and a data file (`.data/ui-check-db.json`) of its own: every screen of its list at 1280, 1440 and 1920 px light and dark and at 390 px, listing overlaps, text out of its control, words run together, targets under 24 px, cut text and pages wider than the screen, with the kinds of control, into `.data/ui-check/<name>-<time>/`; `--only <screens>`, `--widths`, `--themes`, `--url <server>`; `-- --compare <before> <after>` writes a side-by-side page. Not in the e2e run or CI |
| `npm run e2e` | Playwright end-to-end tests (`e2e/`) in eleven parts by folder (`e2e/parts.ts`), each with its own fresh dev server on port 3200 and `.data/e2e-db.json`, freshly seeded before every test; one merged result (`playwright-report/`), failure traces in `test-results/part-<n>/`. It refuses to start while something listens on port 3200 |
| `npm run e2e -- --part <n>` | One part on its own; `npm run e2e -- <files or folders>` is one run as before |
| `npm run e2e -- --list` | Each part's files, as CI runs them (`--part <n>`: one part); starts no server |
| `gh workflow run e2e.yml --ref <branch>` | **The full run:** the workflow "E2E" (`.github/workflows/e2e.yml`) runs the eleven parts side by side on GitHub's Linux runners, each with its own fresh dev server, no retries, and merges their reports (about 12 minutes). Also by the label `full-e2e` on a pull request; never on a push. The run's page has the summary (each part's time, heap peak and restarts) and, for 14 days, the artifacts `report` (merged HTML report with traces), `part-<n>` (traces, `server.log`, memory log) |
| `gh workflow run e2e.yml --ref <branch> -f files="e2e/<folder>/<spec>.ts" -f rounds=3` | A single-file check: `rounds` jobs side by side, each with a fresh dev server, each running the files once (artifacts `check-round-<n>`). The input `parts` (e.g. `1 7`) runs some parts only, for trying the workflow: not a full run |
| `E2E_MEMORY_LOG=1 npm run e2e` | The same with a memory log: the e2e server's heap and resident memory and the machine's available memory, page file and paging every 5 s, per part in `.data/e2e-memory-<time>-part<n>.*`; read it with `npx tsx scripts/e2e-memory-report.ts .data/e2e-memory-<time>-part<n>` |
| `npm run seed` | Creates the demo data in `.data/dev-db.json` if it does not exist yet |
| `npm run reset-dev-data` | Replaces `.data/dev-db.json` with fresh demo data |
| `npm run demo` | The demo data (with slice 15a's Sales star) in a file of its own, `.data/demo-db.json`, seeded if missing, served by a second dev server on http://127.0.0.1:3001 beside `npm run dev`; `npm run demo -- --reset` starts the file over. It never reads or writes `.data/dev-db.json` (refused by name) and builds into `.next-demo`; open it at 127.0.0.1, not localhost, so its sign-in keeps its own cookie. Another file: `INFOMAPPER_DEMO_DB=<path>`. Any command that reads the data file takes `INFOMAPPER_DEV_DB=<path>` as well (e.g. `INFOMAPPER_DEV_DB=.data/demo-db.json npm run reset-dev-data`) |
| `npm run seed:large` | Adds the workspace “Performance test” for Łukasz (the canvas spike's 100-card data set, with 8 frames since slice 2b, and labels and 24 notes since slice 3a, and PERF-2's live canvas since slice 3b, and since slice 4b-2 the canvas “Performance test – requirements”: the same layout with 12 requirement cards and 126 trace lines; since slice 7c classifications without a canvas mark on one column in ten and one table in five) to `.data/dev-db.json`; a file that has it already is left alone (`npm run reset-dev-data` first). Works on a file holding module rows (the seed's Sales star). It writes into `.data/dev-db.json` by default: on Łukasz's test model only on his command, after a backup; `INFOMAPPER_DEV_DB` points it at another file |
| `MEASURE=1 npx playwright test e2e/slice-01a/S1A-14.spec.ts` | The canvas performance measurement (S1A-14) in installed Google Chrome, headed; results in `test-results/S1A-14.json` |
| `MEASURE=1 npx playwright test e2e/slice-01b/S1B-09.spec.ts` | Card resize on “Performance test” (C-09), same way; results in `test-results/S1B-09.json` |
| `MEASURE=1 npx playwright test e2e/slice-01b/S1B-10.spec.ts` | Hover delay (C-10) and three pan-and-zoom runs against slice 1a's median, same way; results in `test-results/S1B-10.json` |
| `MEASURE=1 npx playwright test e2e/slice-02a/S2A-14.spec.ts` | Group drag and the selection marks after a lasso on “Performance test” (S2A-14), same way; results in `test-results/S2A-14.json`, `S2A-14-lasso.json` |
| `npm run measure:canvas` | Every canvas performance figure (pan and zoom, C-08, C-09, C-10, drags, lasso marks) in the measurement build, A/B against the tag `slice-02a` (`--against`, `--rounds`, `--drop`, `--prepare-only`, `--quick`); summary table in `.data/measure/<sitting>/summary.md` (slice 2p). Slice 2b's quick round: `npm run measure:canvas -- --rounds 1 --against slice-02p`. Slice 2c's (S2C-12): `npm run measure:canvas -- --quick --rounds 1 --against slice-02b`, then the same with `--branch-diag collapsed` (every frame collapsed on this branch's side). Slice 3a's (S3A-14): `npm run measure:canvas -- --quick --rounds 1 --against slice-02c`, then the same with `--branch-diag collapsed`. Slice 3b's (S3B-15 b): a discarded warm-up run first, then `npm run measure:canvas -- --quick --rounds 2 --against slice-03a` and the same with `--branch-diag collapsed`. Slice 4b-1: `--to-screen` measures interactions to the GPU present and pans as presented frames (traced, both sides), `--only fading,pan,c10,lasso,c08,colours` a subset; a side whose quiet check fails drops its round and a replacement follows |
| `npm run measure:canvas -- --to-screen --only s4b2pans,c10,lasso,c08,s4b2focus,s4b2screen,s4b2drag --rounds 3 --no-build --against slice-04b1` | Slice 4b-2's closing sitting: S4B2-10 and S4B2-14's pans (`e2e/slice-04b2/S4B2-10.spec.ts`, both sides), C-10, the lasso and C-08 (both sides), S4B2-11 to S4B2-13 (this branch); `--prepare-only` first makes both builds |
| `MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-04b2/S4B2-15-layers.spec.ts` | S4B2-15's reads (slice 4b-2): drawing layers, their megapixels and viewport elements on “100 cards” and “Performance test – requirements”, and requirement cards moved over a frame; copy the spec into the reference worktree for `slice-04b1`'s side |
| `MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-05a/S5A-08.spec.ts` | Slice 5a's diagnosis to the screen: hiding and showing each side panel and a resize on release, on “Performance test” at 30 % and 100 % dense, with a LayerTree read (`test-results/S5A-08.json`) |
| `MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-06a/S6A-09.spec.ts` | Slice 6a's diagnosis to the screen: Focus through its chip, “Show all” against the controls, a chip appearing (`HAND_ONLY=1`: only that pair), with a LayerTree read (`test-results/S6A-09.json`) |
| `MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-06a/S6A-09-hand.spec.ts` | A chip appearing, phase by phase (script, style, layout, paint), with and without the bar (`test-results/S6A-09-hand.json`) |
| `npx tsx scripts/to-screen.ts <folder>` | Analyses saved traces again (slice 4b-1): every switch to the screen (median, p95, max, the split into main thread, GPU raster and rest, the switches not settled) and every pan's presented frames |
| `MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-03b/S3B-15-elements.spec.ts` | S3B-15 (a): the elements in the viewport of “Performance test” at 100 % and 30 %, frames expanded and collapsed; with `ELEMENTS_BASELINE=<file>` they must equal the previous tag's (`test-results/S3B-15-elements.json`) |
| `MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-03b/S3B-15-live.spec.ts` | S3B-15 (c): pan and zoom at 100 % on PERF-2's live canvas against “Performance test”, in turns (`test-results/S3B-15-live.json`) |
| `MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-04a/S4A-14-elements.spec.ts` | S4A-14: the viewport counts of “Performance test” must equal `slice-03b`'s (`.data/measure/s4a14-baseline/slice-03b.json`, or `ELEMENTS_BASELINE=<file>`) |
| `npx tsx scripts/bench-import-read.ts` / `bench-import-plan.ts` / `bench-import-write.ts` | Slice 7a's import figures on synthetic files: reading the standard and translating DDL (20,000 and 100,000 column rows), planning a re-import with 5 % changed, and writing, re-importing and undoing through the local adapter on a copy of the demo data (`bench-import-write.ts 20000`) |
| `MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-07a/S7A-14-review.spec.ts` | Slice 7a: switching the review's filters on a 20,000-column file and its re-import (`test-results/S7A-14-review.json`) |
| `npx tsx scripts/bench-consistency.ts` | Slice 7b: model consistency's computation after a re-import of 20,000 columns with 5 % changed (bar 50 ms) |
| `npm run seed:large -- --changes` | Slice 7b: `seed:large` plus an import into each system of “Performance test” with 16 changes to resolve on 9 of its 60 tables (the Changes view's figure; without the flag the workspace stays as the element guard counts it) |
| `MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-07b/S7B-16-changes.spec.ts` | Slice 7b: the Changes view on and off, its select and Focus to the screen at 100 % and 30 %, and the project home's load (`test-results/S7B-16.json`, `S7B-16-home.json`) |
| `npx tsx scripts/bench-import-plan.ts --no-coverage` / `bench-import-write.ts 20000` | Slice 7c: the plan with classifications and suggestions, and the classification index (bar 20 ms); the write bench also removes Business key from 2,000 columns (bar 1 s; `ONLY_REMOVE=1` for only that) |
| `COMMITS=1 npx playwright test e2e/slice-07c/S7C-14-commits.spec.ts` | Slice 7c: canvas commits per classification toggle (Personal data, Business key), on demand; run it on both tags to compare (3 per toggle on `slice-07b` and 7c) |
| `MEASURE=1 MEASURE_BUILD=production ELEMENTS_BASELINE=.data/measure/s7c14-baseline/slice-07b.json npx playwright test e2e/slice-03b/S3B-15-elements.spec.ts` | Slice 7c's element guard (S7C-14): the viewport counts of “Performance test” equal `slice-07b`'s |
| `npx tsx scripts/bench-thumbnails.ts` | Slice 12b: the project home's and the workspace home's server work, split, and what the thumbnails add (index, shapes, paths, bytes, 20 thumbnail requests, the keys) on the seed, “Performance test” and its 20-canvas project, on a copy of the demo data (not a gate) |
| `npx tsx scripts/bench-checks.ts` | Slice 20: the model checks on a synthetic model of about 23,000 attributes, “Performance test” and the demo: the marks and counts, and the project home with every line's words (bar 50 ms in Node) |
| `npx tsx scripts/bench-checks-browser.ts` | Slice 20: the same in headless Chromium with the split (the marks and counts: a reference of 25 ms, not a gate) |
| `npx tsx scripts/count-checks.ts <copy of a backup>` | Slice 20: a read-only count of a data file's check lines per workspace and project (counts only; refuses `.data/dev-db.json`) |
| `MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-12b/S12B-10.spec.ts` | Slice 12b: both home pages' load (TTFB, FCP, LCP and its element, HTML size, the thumbnails' requests, warm and cold) on the seed, “Performance test” and its 20-canvas project; `LABEL=` names a run for an A/B |
| `MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-12b/S12B-bytes.spec.ts` | Slice 12b: the project home's document, its RSC payload and three writes' answers, and the thumbnails' share of them |
| `BROWSERS=1 npx playwright test e2e/slice-12b/S12B-browsers.spec.ts` | Slice 12b: a thumbnail's shapes take the page's tokens in Chromium, Firefox and WebKit, light and dark (on demand) |
| `SCREENS=<folder> npx playwright test e2e/slice-13/S13-screens.spec.ts` | Slice 13: the marks under a field after a refusal (a conflict on a short field, a long text in the rich-text dialog, "Not saved", "Cleared meanwhile."), light and dark |
| `MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-13/S13-head-elements.spec.ts` | Slice 13: what `<head>` and `<body>` hold on "Performance test" at 30 %, to compare page totals between two builds |
| `SCREENS=<folder> npx playwright test e2e/slice-14a/S14A-screens.spec.ts` | Slice 14a: a note with its "Not saved" mark (45 % and 100 %), its panel with the conflict line, a frame's name with the line, a read-only note; light and dark |
| `COMMITS=1 SIDE=branch npx playwright test e2e/slice-14a/S14A-13-commits.spec.ts` | Slice 14a: canvas commits while a note is written, saved, refused, marked and dropped (dev server, on demand; the same file runs on `slice-13` for an A/B) |
| `MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-14a/S14A-13-layers.spec.ts` | Slice 14a: drawing layers with 20 notes without and with the mark (20 real refusals) |
| `SCREENS=<folder> npx playwright test e2e/slice-14b/S14B-screens.spec.ts` | Slice 14b: a canvas's tab after a refused rename (the conflict line, "Not saved", read-only); light and dark |
| `npx tsx scripts/bench-source-hold.ts` | Slice 14b: holding a change-to-resolve action's rows on the save chain, 20,000 columns (bar 20 ms) |
| `npx tsx scripts/licence.ts grant "<organization name>" infocube [--file <db>]` | Slice 15a: grants an organization a module's licence in the local data file (development only; no change event); `--file` names another file than `INFOMAPPER_DEV_DB` or `.data/dev-db.json` |
| `MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-15a/S15-layers.spec.ts` | Slice 15a: drawing layers and viewport elements on the Sales star with its roles and fact edges, then the same cards without them (`test-results/S15-layers.json`) |
| `MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-15b/S15B-layers.spec.ts` | Slice 15b: drawing layers and viewport elements on the Sales star with its Σ marks and role pills, then without them |
| `SCREENS=<folder> npx playwright test e2e/slice-15a/S15A-screens.spec.ts` | Slice 15a: the Sales star, the Cube tab, the Role, Dim Date's delete preview, the InfoCube box (licensed, refused, without the licence); light and dark |
| `npx tsx scripts/bench-requirement-index.ts` | Builds the requirement index 30 times on a synthetic model (500 requirements, 5,000 attributes, 2,000 mappings, 3,000 links) and prints the median (slice 4a, not a gate); since slice 15d also with 1,000 dimensional attributes, 1,500 feeds and 300 more links, and the difference (bar: at most +25 %) |
| `MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-04p/S4P-fading.spec.ts` | Slice 4p's fading scenarios on “Performance test” (Focus and four lenses, 100 % and 30 %, frames expanded and collapsed): switching on and off, pan and zoom with fading on and off (`test-results/S4P-fading.json`); `npm run measure:canvas` runs it on both sides |
| `npx tsx scripts/measure-trials.ts --rounds 3 --against slice-04a --sides <ref,ref,…>` | Slice 4p's sitting for several trial branches against a reference, each in its own worktree, in turns (`--prepare-only`, `--no-build`, `--add-round`, `--drop`); summary in `.data/measure/trials-<time>/summary.md` |
| `MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-04p/S4P-10-c08.spec.ts` | Slice 4p's C-08 diagnosis: five traced cold loads, split by kind; raw traces in `.data/measure/s4p10-traces/<time>/` (never committed), broken down with `npx tsx scripts/c08-waiting.ts <folder>` |
| `MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-04p/S4P-11-index.spec.ts` | Slice 4p: the requirement index's build time in the browser (demo data and the synthetic model) |
| `SCREENS=<folder> npx playwright test e2e/slice-04p/S4P-04-screens.spec.ts` | Slice 4p's screenshots (the hover, Focus and the lenses, beside the prototype) into `docs/prd/slice-04p-screens/<folder>/` |
| `npx tsx scripts/measure-ab.ts` | S2A-14's pan and zoom: `main` and this branch in turns, dev server and measurement build, medians compared (within 5 %); `main` in `../infomapper-ab-main`; results in `test-results/S2A-14-ab.json` |
| `npm run measure:build` / `npm run measure:start` | The measurement-only production build on the local adapter (AD-31), on http://127.0.0.1:3300 with `INFOMAPPER_MEASURE=1`; `MEASURE=1 MEASURE_BUILD=production npx playwright test <spec>` measures against it |
| `DIAG=nolines` or `DIAG=blocks` with `MEASURE_BUILD=production` | Measurement-only diagnosis (slice 2a): the canvas without its line layer, or every card as its below-40 % block; results get `-diag-…` in their name. Slice 2b: `DIAG=noframes`, `DIAG=nolabels`; slice 2c: `DIAG=collapsed` (every frame shown collapsed, nothing saved; what needs drawn cards is recorded as not applicable); slice 3a: `DIAG=nonotes` (no notes), `DIAG=nolabelmarks` (no label marks) |
| `npm run schema:check` | Applies `supabase/migrations/` to a Postgres and compares the schema with the domain's tables (AD-31; CI runs it); `-- --existing` compares a migrated database and applies nothing, and requires Row Level Security on every table (slice 29) |
| `npm run dev:pg` | The laptop's dev server on `infomapper-dev` (environment 2, `.env.postgres.local`) on http://localhost:3000 |
| `npm run pg:check` | One parameterized query through the transaction pooler with full TLS verification (`-- --migration`: the session pooler) |
| `npm run pg:migrate` | Applies the migrations `infomapper-dev` has not had yet (`-- --dry-run` lists them); the only way to migrate it (slice 30: `undo_step`) |
| `npx tsx scripts/pg-lock-check.ts` | Slice 30: the writes' lock and a count rule through `.env.postgres.local`'s database, in a workspace of its own that it soft-deletes at the end (timings and answers only) |
| `npm run pg:seed` | The demo and "Performance test" into Postgres in one transaction, counts checked (`-- --reset` empties every table first, refused while an organization the seed does not make is there; never a JSON file) |
| `npm run pg:accounts` | A Supabase Auth account per person of the seed's organizations with `INFOMAPPER_DEMO_PASSWORD`, linked by `auth_user_id` (after `pg:seed`); `-- --kb` only Łukasz's own account (`INFOMAPPER_KB_EMAIL`, `INFOMAPPER_KB_PASSWORD`, slice 31) |
| `npm run pg:kb -- <file under .data/backups/>` | Slice 31: Łukasz's model from a copy of a backup of the local file into `infomapper-dev`, in one transaction, counts checked (again: replaces it as a whole; `-- --remove` removes it) |
| `npm run pg:backup` / `npm run pg:restore -- <file>` | Slice 31: the model's rows from `infomapper-dev` into a new `.data/backups/pg/kb-<yyyymmdd-hhmm>.json`, and back from such a file (counts only); since slice 35 with each baseline's content inline. Run by hand before every `pg:migrate`, and before a merge into `dev` when the model changed since the last backup; Supabase's own backups otherwise (AD-39's note of 24 November 2026) |
| `npx tsx scripts/bench-baselines.ts` | Slice 35: taking, listing and comparing baselines on the demo and "Performance test" (reference figures, no bar) |
| `npx tsx scripts/kb-counts.ts <file under .data/backups/>` | Slice 31: a read-only count of the model in a copy of a backup (counts and schema names only) |
| `npx tsx scripts/pg-auth-check.ts` | Checks Auth on `infomapper-dev`: the Data API off, sign-ups off, the admin API, sign-in, `getClaims` (statuses only) |
| `npx tsx scripts/pg-snapshot-size.ts` | The editor's snapshot per workspace through the Postgres adapter: its bytes against Vercel's 4.5 MB |
| `npx tsx scripts/preview-probe.ts <preview> [paths]` | A protected preview's status, redirect and regions, with the bypass header |
| `npx playwright test --config playwright.pg.config.ts` | The smoke set on Postgres (`e2e/slice-29`): against `npm run dev:pg`, or `PG_BASE_URL=<preview>` (the bypass header, no traces); `PG_SERVE=1` in CI. `MEASURE=1 … S29-08` is the measurement (`docs/prd/slice-29-measurement.md`); `MEASURE=1 … S30-measure` slice 30's writes (S30-05, S30-13). The smoke writes (`S30-smoke-writes`) run only against a database on this machine |

**Tests per step** (CLAUDE.md, "Testing"): after each step the specs of what it touched plus CI, a full run in a step
that touches shared infrastructure, and one full run before a merge (it also counts for a later commit whose diff
from the tested one touches only Markdown files in `docs/` and the repository root). The full run is the workflow's run on the commit
the report names; the local `npm run e2e` (about 95 minutes on the laptop) is the fallback when GitHub is down.

Optional variables are listed in `.env.example`.

## The theme (slice 32, D-85)

- **The cookie:** `im-theme`, `light` or `dark`, written by the browser when a person chooses in the person's menu
  (`src/ui/theme.ts`, `src/ui/theme-sync.tsx`); System deletes it, any other value reads as System. One choice per
  browser, not per person: it stays after signing out and the sign-in page follows it. The root layout reads it and
  renders `data-theme` on `<html>`, so the first paint needs no script. It holds no personal data and writes nothing.
- **Dark values in CSS:** write them under Tailwind's `dark` variant (`@variant dark { … }` inside the rule, or a
  `dark:` utility), never under `@media (prefers-color-scheme: dark)`: the variant in `src/app/globals.css` is the one
  place that reads it, and it writes each dark value for System (the media query) and for Dark (the attribute). A CSS
  file other than `globals.css` takes the variant with `@reference "../app/globals.css";` (as `src/canvas/canvas.css`).
  `tests/theme-css.test.ts` fails any other reader of `prefers-color-scheme` and checks the compiled rules.
- **In tests:** with no cookie a page is at System, and Playwright emulates a light system, so earlier specs see the
  page as before. A spec chooses a theme with the cookie on the context or the menu (`e2e/slice-32/helpers.ts`), and
  every test starts in a fresh context, so a choice never leaks into another test. `emulateMedia({ colorScheme })` still
  sets System's side.

## Fonts

IBM Plex Sans and IBM Plex Mono are hosted with the app (`src/app/fonts/ibm-plex/`, loaded through `next/font/local`
in `src/app/layout.tsx`): no build or start fetches fonts from the network. The files are IBM's own WOFF2 fonts,
unmodified, under the SIL Open Font License 1.1 (`LICENSE.txt` beside them). "Plex" is a Reserved Font Name, so the
files are never subset or otherwise changed; the folder's `README.md` lists their packages and checksums.

## Repository layout

| Folder | What's in it |
| --- | --- |
| `src/domain` | Pure TypeScript: types, commands, permissions, validation, business rules |
| `src/data` | Repository interfaces (`ports.ts`) and adapters (`local/`, the JSON file; `postgres/`, reads since slice 29 and writes since slice 30); the only layer that touches stored data |
| `src/app` | Next.js App Router routes, server actions, screens |
| `src/ui` | Shared UI components (shadcn/ui, toasts) |
| `src/canvas` | The modeling canvas (React Flow, AD-24): cards, line layer, Overview, geometry |
| `e2e/` | Playwright acceptance tests, one folder per slice, one file per criterion |
| `tests/` | Repository-level checks (the layer rules) |
| `docs/` | Decisions, data model, PRDs, acceptance, ideas, known limitations, and the prototype (the reference for behaviour) |
| `supabase/migrations/` | Database migrations, applied to `infomapper-dev` by `npm run pg:migrate` |
| `spikes/` | Throwaway experiments; not part of the application |

How we work and the architecture rules are in `CLAUDE.md`.
