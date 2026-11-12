# Ideas

Ideas that came up while building a slice and are not part of its PRD (AD-25). Each one needs a decision before it
is built.

## Settings: keep the typed value on a stale-version conflict (slice 0, step 5b): done in slice 13

Today, when a save is refused because someone else changed the record meanwhile ("Someone changed this meanwhile.
Reload to see the latest version."), the field goes back to the last value this page saved, and the typed value is
lost. Better: keep the user's typed value in the field and show the current server value next to it, so the user can
choose which to keep (or copy parts of theirs) instead of retyping.

## Panels: one behaviour for a refused save in every field (slice 9, step 1, F6): done in slice 13

After a refused save most panel fields keep the refused text (the field is keyed by its stored value, which did not
change); the requirement panel shows the stored values again (its reset counter) and the workspace settings go back to
the last saved value. One behaviour for every field would be clearer: either all go back, or all keep the typed text
with the stored value beside it (the idea above). Łukasz kept today's behaviour in slice 9 (29 October 2026).

## Canvas actions on a row's save chain (slice 9, after step 2): done in slice 10a

The canvas's writes on a model row, and the panels' other writes on rows their fields save, run through `saveRow` or
`saveRows`, and actions whose rows only the server knows feed `rowSaves.answer` (`docs/prd/slice-10a-acceptance.md`).
What is still off the chain is in `docs/known-limitations.md` ("Writes still off the save chain (slice 10a)").

## The plan after slice 10a (Łukasz, 30 October 2026)

- **10b: relationships between source tables as lines on the canvas**, reusing the loop for a table that refers to
  itself. **Done in slice 10b** (D-62).
- **10c: copying an attribute to another entity.** **Done in slice 10c** (D-63), as copy and paste of one attribute at
  a time, not tied to a relationship; the copy follows its original's type and Personal data. A data model and local
  file format change (format 10), with backups of Łukasz's KB model.
- **11: an alias for entities and attributes.** **Done in slice 11** (D-64): an alias field in the entity and
  attribute panels; each canvas shows names or aliases in two dimensions, with exceptions per card; the search finds
  aliases. A data model and local file format change (format 11), with a backup of Łukasz's KB model.
- **12: the home pages,** split in two (slice 12a's PRD):
  - **12a: undo and redo on the home pages, and deleting a project.** **Done in slice 12a** (D-65): the canvas pages'
    Undo and Redo on both home pages, on the same history; pins are undo steps; "Delete this project" at the end of a
    project's home, with a preview of the canvases it takes, one undo step. No data model change.
  - **12b: the canvas tiles' thumbnails.** **Done in slice 12b** (D-29, AD-32): a sketch of each canvas's layout on
    its tile, drawn from a route through an external `<use>` with the page's colours; the frame count; each project's
    first canvas on the workspace home. No data model change.
- **13: done in slice 13** (D-66): a field keeps its draft across fresh pages and after any refusal, with the conflict
  line ("Use this", "Keep mine"), "Not saved", Escape, a closed panel's draft for the page, read-only drafts after a
  permission or the archive; choice fields show the newest stored value. No data model change. The plan after it is
  below ("The plan after slice 13").
- **13: one behaviour for a refused save in every field** (F6, above), with the typed value kept on a conflict (the
  first entry). Also keep text typed into a field while its save is on its way: the save's answer replaces the field
  (keyed by its stored value) and the typed text and focus are lost (`docs/known-limitations.md`, slice 10c).

## The plan after slice 13 (Łukasz, 1 November 2026)

- **14a: done in slice 14a** (D-66): notes and frames on slice 13's rule through the canvas's queue; a note's draft with
  its "Not saved" mark on the canvas, shown in the panels' lists; no data model change. Next: 14b. The plan was:
  saving notes and frames by slice 13's rule: their canvas queue (`useNotes`, `useFrames`, the note on
  the canvas in `NoteLayer`) keeps a refused draft with the conflict line instead of rolling it back; AD-24's rules for
  the canvas, with canvas commit counts and measurements (below, "Notes and frames on slice 13's rule").
- **14b: done in slice 14b** (D-66): the canvas's row on one chain (look, look on all canvases, names switch, rename,
  delete, the live canvas's writes), the rename's line inside the tab, the change-to-resolve actions holding their
  change's tables, the browser's warning before a page with unsaved text is left; no data model change. The plan was:
  a canvas's name in its tab, the change-to-resolve actions, and the canvas's look (`docs/known-limitations.md`,
  "Writes still off the save chain"); a warning when leaving a page with a draft not saved (`beforeunload`).
- **InfoCube, iteration 1** (`docs/prd/slice-15-infocube.md`): **15a done** (the module boundary, facts and dimensions,
  the licence and the switch; AD-33 to AD-35, D-67), **15b done** (grain, measures, SCD type, role-playing dimensions;
  D-68), **15c done** (dimensional mappings and "fed" coverage, "Create dimension from this…"; AD-36, D-69), **15d done**
  (requirements on facts and dimensions, "Fed from concepts", the bus matrix; D-70): **InfoCube iteration 1 is done.**
- **InfoMapper's canvas and menus: done in slice 16** (D-71). Then slices 17 (modelling ergonomics, D-72), 18
  (derivations, D-73) and 19 (InfoCube types, D-74), from the InfoCube backlog (`docs/prd/slice-15-infocube.md`,
  section 9) and Łukasz's testing.
- **Chore CI e2e: done** (6 November 2026): the full e2e run and the single-file check in GitHub Actions, seven parts
  side by side in about 12 minutes (`.github/workflows/e2e.yml`, `docs/prd/chore-ci-e2e-acceptance.md`); the local run
  is the fallback.
  Left for later: Playwright's own container image pinned to 1.63.0 (dependencies preinstalled) instead of
  `playwright install --with-deps`, whose Ubuntu mirror once took about 9.5 minutes in one job per run
  (`docs/known-limitations.md`); validate it with S6A-10's text drawing.
- **Chore e2e eight parts** (9 November 2026): eight parts, cut in folder order by the median folder times of five full
  runs; a new slice joins the last part, recut by the rule in CLAUDE.md. Left for later:
  - **A script for the cuts:** read the `part-<n>` artifacts of the last full runs (`gh run download`, each part's
    `e2e-memory-ci-part<n>.tests.jsonl`), sum each folder's test times, take the median per folder and print the best
    in-order cuts for the current part count (the lowest longest part), with each part's expected time.
  - **Why slice-00 to slice-02a cost about twice as much per test** as later folders (about 8 to 11 s against 4 to 5 s
    on the runner): the older helpers, sign-in per test, slice 17's concept picker in slice 1b's create helpers, or
    waits that later slices no longer need.
- **The model validator: done in slice 20** (D-75; below, "A model validator").
- **The database slice last** (AD-31).

## A field's draft: what comes later (slice 13, PRD section 9)

- **A warning when leaving a page with a draft not saved** (`beforeunload`): done in slice 14b for a reload, a closed
  tab and another site.
- **A warning on navigation inside the app** (slice 14b, O6's alternative): a link, the breadcrumbs, the project
  switcher, Back and Forward with a draft on the page ask first, with the app's own dialog (Next.js has no hook for
  it; the links and the history watcher would ask `leave-guard.ts`'s `asksToStay`). Not built: the browser's own
  warning only (O6).
- **Back right after a save keeps Forward** (slice 14b, `docs/known-limitations.md`): Back in the 50 to 150 ms after a
  save's answer reaches the page, before its page commits, loses the entry Forward led to. A fix would hold Back (the
  breadcrumbs row's button and Alt+←) until the router's pending action has committed, or report it to Next.js; the
  browser's own Back button cannot be held.
- **A field-level merge** of two texts, showing the differences, beyond "Use this" and "Keep mine".
- **Drafts kept across a reload,** in the browser's storage (slice 13 keeps them in the page's memory only, answer 7).
- **The import wizard's progress across a reload** (slice 14b, step 1 answer 5): a reload or a closed tab in the middle
  of the wizard loses the file, the choices and the review, and slice 14b's warning on leaving does not cover the wizard
  (it is not a field that saves a row). Either the wizard joins the warning while it has a file, or its state is kept for
  the tab.
- **The concept's rename in the tree with slice 13's line** (slice 14b, step 1 answer 8, decided in step 3): since
  slice 13 (F13) a refused name stays in the tree's field to try again or cancel, without the line. The tab's compact
  line (one row after the field) does not fit the left panel's narrow field ("Changed meanwhile to: …" with two buttons
  is wider than the panel); the tree would need the panels' line under the field and `NameInput` moved to `useDraft`
  for renames only (it also creates concepts), with its own specs. Worth doing with the next change to the tree.
- **One text for an empty required name** (slice 14b, step 1 answer 7): canvases, settings and requirements say "Enter a
  name.", a project says "A project needs a name." (D-59). One text everywhere would be a one-line change in
  `src/domain/commands/project.ts` and D-59's wording, with slice 9's specs.

## Aliases: what comes later (slice 11, PRD section 9)

- **Aliases for concepts, frames,** source tables or columns. Not wanted for sources (P9: a source is what it is).
- **Several aliases per object** (by language or audience), with a choice of which to show.
- **A reviewer's own local choice** of names or aliases, as the layer mode works for reviewers and readers today (they
  switch it in their browser only); in slice 11 they see the canvas as saved (F6).
- **Showing an alias outside the canvas** (breadcrumbs, panel titles), as a user setting.
- **Marking a shown name** that stands in for a missing alias.
- **Exceptions per attribute row** rather than per card.
- **Advanced search and grouping** belong to a later, separate tool, outside InfoMapper's scope for now.

## The layer switch at 30 % (slice 11, step 5)

Measure the layer switch at 30 % on slice-10c and earlier: slice 11's sitting found about 650 ms to the screen (240 ms
on the main thread), not touched by slice 11.

## A model validator (slice 10c, PRD section 9): done in slice 20

**Done in slice 20** (D-75): the model checks on the project home, the canvas and the panels, with InfoCube's facts and
feeds. Left out: a foreign key flag without a copy (below, "Model checks: what comes later").

**A model validator (slice 10c, PRD section 9).** Copies of attributes are not tied to relationships (slice 10c), so a
check across the model would report what does not fit:
- a copy of a primary key in an entity with no relationship to the original's entity;
- a relationship with no copied key on its "many" side;
- a copy whose original is deleted ("reference lost");
- a foreign key flag without a copy;
- keys copied in the wrong direction (from the "many" side to the "one" side);
- duplicate attribute names within an entity (adding and pasting allow them; 2 of 258 in Łukasz's KB on 8 November
  2026, slice 17 step 2).

The results as a list in a panel, each linking to the place; later a mark on the card rows (an element guard and a
measurement). The validator reads only; it changes nothing.

## Copies of attributes: what comes later (slice 10c, PRD section 9)

- **A mark on the card row** of a copy whose original was deleted, with the validator (above).
- **Copying several attributes at once** (a whole composite key), and Ctrl+C / Ctrl+V on a selected attribute row.
- **Pasting into another workspace.**
- **Copying with mappings,** as an option.

## The e2e answer delay for slice 10a's cases (slice 10c, step 4)

Use the e2e answer delay (slice 10c) to make the four slice 10a cases guarded by review only (delete from model, delete
a source table, delete a working label, archive) fail without the save chain. `holdAnswer` (`e2e/slice-10c/helpers.ts`)
holds a server action's answer back in the browser while the server has written it, so a second save is started before
the first one's answer arrives.

## Role names per relationship end (slice 10a, PRD section 9)

A name for each end of a relationship ("parent", "child"; "manager", "report"), shown in the panel's sentences and,
perhaps, beside the end marks. Most useful on a self-relationship, whose two ends name the same entity. A data model
change (two columns on `relationship`).

## A mark for self-relationships on a collapsed frame's block (slice 10a, PRD section 9)

A member's loop is a line inside one frame, so a collapsed frame shows nothing of it (D-61). A small mark on the
block's row of that entity, or a count, would tell that the entity relates to itself.

## The relate button opens the details panel (slice 10a, F13)

"Relate to itself" opens a hidden details panel, as it leads to the panel's fields (D-54). The relate button keeps the
panel as it is; doing the same there would make the two consistent.

## Mapping by drag: from the attribute side too (slice 1b, step 2)

The prototype also starts a mapping drag from an attribute row and drops it on a column row. The slice 1b PRD asks
only for a column dragged onto an attribute or an entity's header, so this is not built. (Auto-scroll near the canvas
edge, mentioned here before, was built in step 2 at Łukasz's request.)

**Slice 15c** (X1, Łukasz, 5 November 2026): InfoCube's dimensional mappings start a drag from an entity's row (logical
or dimensional), but a logical row dropped onto a source column stays out of 15c: it is InfoMapper's behaviour, not
InfoCube's. When it is built, it reuses 15c's row drag (the canvas extension's `rowDrag` and `drop`, `RowDrag` in `src/canvas/context.ts`) and the veil that dims what cannot take the drop.

**Done in slice 21** (D-76): a logical row dropped onto a source column maps them as the column dropped onto the row does
(D-48's choice included), InfoCube on or off; InfoMapper's drag is composed with the module's in the canvas host.

## Feeding sources: drag from the panel onto the canvas (slice 1b, step 5)

In the prototype, a feeding source (or fed entity) in the right panel can also be dragged onto the canvas and lands
where it is dropped. The slice 1b PRD asks for a click (placed beside the card) and “Add the N missing”, so dragging
from the right panel is not built; the left panel's drag onto the canvas works as before.

## “Undo” in more toasts (slice 1b, step 5)

The prototype offers “Undo” in almost every toast after a change (a new mapping, a relationship, cards placed beside
a card). The slice 1b PRD asks for it on destructive actions only (deletes, remove from canvas), so that is what is
built; Ctrl+Z and the top bar's Undo work for every change.

## Undo and redo on the project and workspace home pages (slice 1b, acceptance): done in slice 12a

**Done in slice 12a** (D-65): both home pages have the canvas pages' buttons and keys, on the same history.

Undo and redo (the top bar's buttons and Ctrl+Z, Ctrl+Shift+Z) are only on canvas pages (assumption 8 in the slice 1b
acceptance). Changes made on the project and workspace home pages (projects, canvases) are in the undo history too,
but can only be undone from a canvas. Better: the same buttons and keys on those home pages as well.

## Entity tool on a collapsed block (slice 2c, step 4)

The Entity tool creates the new entity exactly where clicked, also on a collapsed frame's block, and the new card does
not join that frame (as in the prototype; Łukasz's decision (i) in step 4). Better: the Entity tool on a collapsed
block files the new entity into the frame like a drop, and takes the concept of a concept frame.

## Labels on requirements (after slice 2c; moved to requirements step 2 in slice 4a)

Labels on requirements: `label_link` gets a `requirement_id` target (a new migration, with the “exactly one target”
check extended to it), and the requirement panel gets a Labels field. D-33 keeps labels and requirements separate today.
Slice 4a builds requirements without labels (PRD item 14); this belongs to requirements step 2, together with D-33's
promotion of a label to a requirement.

## Editing an agreed requirement sends it back to Draft (slice 4a)

As D-51 does for mappings (an approved mapping whose inputs, kind or rule change goes back to review), a change to an
Agreed requirement's content (kind, name, description, expression, severity) could send it back to Draft and clear the
agreement. Slice 4a leaves an Agreed requirement Agreed when edited (PRD item 13, `known-limitations.md`); a candidate for
requirements step 2.

## Notes in the Overview miniature (slice 3a, step 4)

The prototype's miniature (`renderMini`) draws the notes as small rectangles in their paper colour; the Overview in
the bottom-right corner shows none (slice 3a PRD, not listed; Łukasz after step 4). A candidate for slice 3b or the
minimap slice. It needs its own measurement: the miniature is drawn once per change of the cards (S1A-14), and notes
would add to what it draws and to when it draws again.

## The “Newly labeled” frame on live canvases (slice 3b, step 0)

The prototype puts cards that become required on a live canvas into a grey frame “Newly labeled” (`sys: "new"`), made
to the right of the content when missing, grown to fit and removed when empty. Slice 3b leaves it out (Łukasz's answer
to Q3: no migration for a new `frame.kind`): newly required cards land to the right of the existing content, one under
another, in no frame, and the toast lists them. A deviation from the prototype to revisit; it needs `newly_labeled` in
the CHECK on `frame.kind` (or another marker) and a rule so “Arrange into frames” does not rebuild it away.

## “Add to this canvas” on a panel without its card (slice 4a, step 3)

**Resolved in slice 4b-2** ([PRD](prd/slice-04b2-requirement-cards.md), item 16; D-34). The text below is kept as it was
written.

Since slice 4a a go-to link to an element whose card is not on the open canvas opens its panel only. The prototype's
entity and source table panels then offer “Add to this canvas” where “Remove from this canvas” would be. Slice 4a leaves
it out (not in its PRD; Łukasz after step 3); a candidate for slice 4b, which places requirement cards and can place an
element's card from its panel the same way.

## Project home: open the canvas that shows most of the requirement (slice 4a, step 4)

**Resolved in slice 4b-2** ([PRD](prd/slice-04b2-requirement-cards.md), item 23): the canvas with most of the
requirement's entities and tables, plus one for its card; the requirement is selected, so its coverage colours show.
The text below is kept as it was written.

Slice 4a opens a requirement from the project home on the project's last opened canvas, else its first (PRD item 30).
The prototype opens the canvas that shows most of the requirement's scope (its entities, tables and its card) and
lights the scope up with the lens. A candidate for slice 4b, once the lens exists (Łukasz after step 4).

## Entity-level requirements: scope, coverage and panels (slice 4a, manual acceptance)

**Resolved in slice 4b-1** ([PRD](prd/slice-04b1-coverage-focus.md), items 9–12; D-31 and D-34 changed): a link to an
entity is one item, covered when any of its attributes has an approved, type-correct mapping (close to option B,
without the business key); attribute panels have no “via entity”. Option C stays an idea (“Coverage by hierarchy”,
below). The text below is kept as it was written.

To decide with slice 4b. Łukasz's rule for the panels: an entity's panel shows all requirements (its own and its
attributes'); an attribute's panel shows only the attribute's own requirements, with no “via entity” rows. That changes
D-34 for attributes (today an attribute also lists its entity's requirements “via entity”, prototype `reqsFor`).

It is consistent only together with scope: today a link to an entity puts all its attributes in scope (D-31), so a
requirement's gaps would name attributes whose panels do not show that requirement. Options for scope and coverage:

- **A.** Keep D-31: a link to an entity puts all its attributes in scope; only the panels change (and stay
  inconsistent with the gaps, as above).
- **B.** A link to an entity means the entity as a whole: its attributes are not in scope, and the entity is covered
  e.g. through its business key's approved mappings (fits Data Vault 2.0 hubs).
- **C.** Coverage by kind, e.g. a business need is covered when its parts (the requirements below it) are covered.

Changing it changes D-31 and D-34 (`docs/decisions.md`, with Łukasz).

## Palette contrast to WCAG AA (slice 4b-1, step 6)

The grey text (`--im-ink-3`, 3.6:1 on white), the PII tag (4.4:1) and the BK tag (4.1:1) are below WCAG AA's 4.5:1 on a
plain card (`docs/known-limitations.md`, Text contrast). A candidate for the ergonomics slice: darker values for these
three, checked in both colour schemes, with the prototype's look kept as far as possible (Łukasz after step 6).

## Coverage by hierarchy (slice 4b-1, step 8)

A requirement with parts (“Broken down into REQ-102”) could be covered when its parts are covered, instead of (or as
well as) through its own links: e.g. a business need covered when its data requirements are. Today a requirement's
coverage counts only its own items (D-31). Option C of the entity-level idea above; changes D-31.

## “Link all attributes” in an entity panel (slice 4b-1, step 8): done in slice 17

**Done in slice 17** (D-72): “Link all attributes…” in an entity panel's Requirements section, one undo step.


Since slice 4b-1 a link to an entity is one item, not its attributes (D-31). An entity panel's Requirements section
could offer “Link all attributes” to link a requirement to each of the entity's attributes in one step (one undo step),
for requirements that need every attribute sourced.

## Requirement cards: what the prototype has besides (slice 4b-2, step 1)

Left out of slice 4b-2 on purpose (not in its PRD):
- a double-click on a requirement card, and the card menu's “Edit description…”, open the description editor;
- “Show its requirements (n)” in the attribute row and card menus;
- resizing a requirement card (230 px fixed, as the prototype).

## A top bar that fits narrow windows (slice 5a, step 2)

**Done in slice 6a**: the prototype's label steps and a “More” menu; nothing is cut off from 800 to 2,560 px (S6A-10).

Below about 1,100 px the canvas page's top bar has more tools than room. Since slice 5a the tools are cut off at
their right end (the details panel's button and the user indicator stay visible); before, the user indicator was cut
off. The prototype shortens its labels at 2,100 and 1,300 px and hides some tools at 1,000 px (`.lf`, `.ls`,
`.hide-l`, `.hide-s`, `.hide-m`). A later slice could do the same, or move the overflow into a “More” menu.

## No fresh page after “Show all” when only cards change (slice 6a, step 3)

`resetCanvasViewAction` asks for a fresh page after its write, as “Expand all” does. When only row filters and
collapsed cards change, the canvas already shows the result, and the card's own filter and collapse buttons write
without a fresh page. In S6A-09 that refresh made “Show all” with Focus and a filter about 90 ms slower to the screen
than the same changes through the controls at 30 % (22 ms in the dense view). The action could skip the refresh when no
frame changed.

## Per-row fading in the Changes view (slice 7b, step 1)

The prototype's Changes view dims the untouched rows inside a touched card (`body.im-chgmode .card.im-hit
.row:not(.im-hit)`). The app's fade layer (F4, AD-24) has holes per card, block and note, so slice 7b keeps touched cards
lit as a whole and marks the touched rows with the existing row classes. Per-row holes would add a subpath per row to
the veil; to be measured against Focus's switching before it is built (Łukasz, 25 October 2026).

## One file per table in the local adapter (slice 7a, step 4)

The local adapter (AD-29) writes the whole data file on every write; after three 20,000-column imports a card move
takes about 1 s (`docs/known-limitations.md`). With one file per table and the change events appended to a file of their
own rather than rewritten, a write would rewrite only the tables it touches: a card move would be well under 100 ms.
About a day with a full e2e run (the e2e helpers that read the data file whole move to the store). Only if large imports
are ever needed locally; the Supabase adapter writes only the changed rows anyway (Łukasz, 23 October 2026: option 1,
accepted as it is).

## Matching a file's own headers to the standard (slice 7a, PRD section 10)

The standard reads fixed column names and the prototype's aliases (`table_name`, `is_nullable`, `tags`…). A file
with other headers gets "The file has no “{header}” column. Name the columns as in the standard below." A step that
lets the modeller match the file's own headers to the standard's fields once, remembered per system, would spare
renaming them in Excel.

## The dbt, Snowflake and Databricks channels (slice 7a, PRD section 10)

The wizard shows "dbt project" ("catalog.json, later"), "Snowflake (later)" and "Databricks (later)" disabled, as the
prototype does. Each needs its catalog query or its file read into the standard, with the type names of that database
in D-01's table and their fractional seconds (as SQL Server's and PostgreSQL's queries got in slice 7a, step 5).

## Relationships between source tables as lines on the canvas (slice 7a, step 5): done in slice 10b

**Done in slice 10b** (D-62): grey lines with an arrow at the referenced table, the loop for a key to itself, dashed
when missing, in Everything and Relationships (no layer switch of its own; see the next entry).

The prototype's review promised "Shown later as a grey line between the table cards on a canvas" for a new
relationship; slice 7a left the sentence out. Lines between table cards for declared relationships, in the line layer
(AD-24 rule 3), with their own layer switch, would show the source's structure next to the mappings.

## Source relationships: a layer switch of their own (slice 10b, PRD section 9): closed, replaced in slice 16

Source relationship lines show in Everything and Relationships (D-62). A switch of their own would show them in the
Mappings layer while mapping: a key in `canvas.look` and a control above the canvas (which must not read layout during
a commit, CLAUDE.md).

**Closed as replaced** (slice 16, P4, D-71): the layer modes stay as they are, and a canvas tab's menu shows or hides
relationship lines by kind (between entities, between source tables) within the layers that show them.

## Source relationships: the key's name and its columns (slice 10b, PRD section 9)

- **The key's name on hover**, as a tooltip: an element per line (the element guard).
- **A click scrolling the table's panel** to "Relationships between source tables".
- **Lines anchored on the key's column rows** rather than on the cards.

## Source relationships: cardinality from the key (slice 10b, PRD section 9)

Many at the table with the key, one or optional by the columns' nullability. Not drawn now: the source says nothing
about uniqueness beyond the primary key.

## Source relationships at collapsed frames (slice 10b, PRD section 9)

A source line with a card in a collapsed frame is left out (D-62). A bundle of its own, with its count, would show that
the frame's tables join others.

## The Changes view lighting a missing source relationship (slice 10b, PRD section 9)

A missing relationship is not a change to resolve (`SOURCE_CHANGE_KINDS`), so the Changes view lights it only when both
of its tables are touched. Lighting it as a change of its own would need a kind or a rule in `touched.ts`.

## A change to resolve as its own history place (slice 7b, PRD section 9)

A change is a card on the system's and table's panels, not a place of its own: Back after acting on one returns to the
panel, not to the change. Making it a place (D-38) would let a link open one change directly, e.g. from a notification.

## Telling the others about new changes to resolve (slice 7b, PRD section 9)

An import's changes wait on the system's panel, counted in the tree and the status bar, for whoever opens them. A
notice to the other people of the workspace (the modellers who own the affected mappings) would bring them sooner.

## Resolving changes from the Changes view's bar (slice 7b, PRD section 9)

The Changes view only fades (P11). Acting on the lit changes from its bar, without opening the system's panel, would
shorten the way from seeing what a change touches to settling it.

## A requirement card placed by a drop shows at once (slice 7b, step 6)

A requirement dropped on empty canvas gets its card only when the page's refreshed server data arrives after the
action (`placeReqCards` adds no node of its own; `revalidatePath` brings it). Under load that gap was about 2 s
(S4B2-06 with 4× CPU throttling), and a second drop in it tries to place a second card, which the server refuses (one
card per requirement and canvas). Showing the card on the canvas at once (an optimistic node, kept or dropped when the
action answers) would close the gap (Łukasz, 26 October 2026).

## A panel-only write that does not redraw the canvas (slice 7c, answer F4)

A classification toggle, a note or any other write that changes nothing the canvas draws still commits the canvas three
times, as every write does: the page's refreshed server data reaches `ModelCanvas` whole. A write that knows it touches
only a panel (no card, row, line or mark reads what it changed) could refresh the panel's data alone and leave the
canvas's props as they were. Slice 7c measured the toggle against slice 7b's flag toggle (3 commits on both) instead.

## Rich text for all notes at once (slice 7c, answer F7)

The notes on mappings, source tables and source columns are plain text (`plainTextPair` into `note_html`/`note_text`),
while descriptions are rich text (AD-17, D-42). Moving all three notes to the rich-text editor together would keep them
alike; doing one alone would make the panels differ.

## Built-in classification names per documentation language (slice 7c, PRD section 9): done in slice 23

**Done in slice 23** (D-78): a workspace gets the built-in names and definitions in its documentation language (English,
Polish, German), chosen when it is created; a later change of the language renames nothing.

The 19 built-in classifications get English default names ("Business key", "Personal data", …). A workspace documented
in another language renames them by hand (P1). Default names per the workspace's documentation language would save it;
the codes the rules read stay the same.

## A `table_classifications` column in the source standard (slice 7c, PRD section 9)

The import reads column classifications only (P6); table classifications are set by hand. A `table_classifications`
column, read from the table's first row, would let a catalog export carry them too, with the same matching and warnings.

## Data Vault hints in the entity panel (slice 7c, P12)

The prototype's `dvSection` shows, in Data Vault 2.0 mode, an entity's hub or link name, its business key, its
satellites by source system and its unmapped attributes. Slice 7c built only the source table's Data Vault reading
(AD-08 lists both).

## Readings that use Link candidate and Satellite source (slice 7c, PRD section 9)

The prototype lists the table classifications Link candidate (`T_LNK`) and Satellite source (`T_SAT`) but its reading
never reads them; neither does the app's. A reading could, for example, ask about a Link candidate that has fewer than
two relationships, or name a Satellite source's parent hub.

## Own classifications with a code (slice 7c, PRD section 9): done in slice 23

**Done in slice 23** (D-78): an own classification may get a code when it is added, never changed, unique in the
import's comparison; the import matches it by its name or its code.

An import file names an own classification by its current name only; only built-in ones have a code that survives a
rename. An optional code on own classifications would let a team keep its files stable while renaming in the app.

## Data model slice

What slice 7c leaves for the data model review (PRD 7c section 9, amended by Łukasz's answers to steps 1 and 3):

- **Classifications on attributes:** whether attributes get classifications too; then `attribute.is_business_key` and
  `is_pii` become links and AD-28 a suggestion of the Business key classification.
- **One link pattern** for `requirement_link`, `label_link` and `classification_link`.
- **Baselines and export** with classifications (and notes).
- **Indexes** at enterprise scale.
- **F5:** moving the flags' data and seeding the 19 built-in rows in a real database (the migration
  `20261026200000_classifications.sql` is DDL only; the local adapter's format 8 did the data part).
- **F20:** `classification.origin` carries both "built in or own" and the group (`builtin`, `data_vault`, `own`); a
  restored or renamed built-in keeps it. Two columns may read better.
- **A system author for upgrades** (e.g. "InfoMapper upgrade"): the rows and change events slice 7c's upgrade wrote are
  signed by the workspace's creator (known limitation).

## Licences and activation codes for creating an organization (slice 8, PRD section 9)

Today anyone who reaches the start page may create an organization. A licence, or an activation code handed out with
one, could gate that step.

## Groups of people (slice 8, PRD section 9)

Groups within an organization (e.g. "Finance analysts"), added to a workspace at once with one role, instead of person
by person.

## Single sign-on (slice 8, PRD section 9; AD-04)

Signing in through the company's identity provider (SAML or OpenID Connect) instead of a password.

## Guests from other organizations (slice 8, PRD section 9; AD-01)

Slice 8 adds no new guests: an account from another organization added to a workspace becomes a member of this one too
(F8). A guest invited across organizations, with what they may see of their home organization, needs its own decision.

## An organization page (slice 8, PRD section 9; AD-09)

One page per organization: rename it, delete it, list its workspaces and people, transfer a workspace to another
organization (AD-09).

## Deleting a person's account (slice 8, PRD section 9)

Removing a person takes away their access but keeps the account, so their earlier work keeps their name. Deleting an
account (with what it means for their names in history, and for personal data) is a decision of its own.

## A public landing page (slice 8, PRD section 9)

A page before the start page with the company's promotional material. The start page itself has none (D-58).

## A configured base URL for the organization's link (slice 8, Łukasz's answer to step 5)

The "Organization access" box builds the organization's link from the request's host, which is right in development
only. With the database slice, the link (and any other absolute address the app sends, e.g. in invitation e-mails)
comes from a configured base URL (an environment variable in `.env.example`).

## Notes from slice 8's manual acceptance (Łukasz, 28 October 2026)

Seven notes from building a model by hand. The first three are small; the others need a decision or a data model
change first.

### Quick

- **Tab from Precision to Scale lost the focus (a bug): fixed** on `fix/panel-field-focus`. The panels' fields were
  keyed by their object's version, so the save on leaving one field mounted the next one anew; they are now keyed by
  their own value (`fieldKey`, `src/app/_panels/fields.tsx`) in the attribute, entity, mapping, requirement, frame,
  note, relationship and classification panels (`e2e/fixes/panel-field-focus.spec.ts`).
- **A second save in a panel within about a second is refused as a conflict.** Found with the fix above: after a field
  is saved, the panel shows the new version about 0.9 s after the action's response (the e2e dev server). A field
  left before that saves with the old version and gets "Someone changed this meanwhile. Reload to see the latest
  version." although nobody else changed anything (typing "2" in Scale and pressing Enter right after Tab). Before the
  fix the remount hid it by taking the focus. Options: the panel keeps the version each save returns, or the field
  waits for the refresh before it saves. **Done in slice 9** (step 2): one save per object at a time, each with the
  newest version known (`saveRow`, `src/ui/row-saves.ts`).
- **Renaming a project** (and its description). The prototype edits both on the project home (`renderHome`,
  `data-pf`); the app names a project only when it is created (`docs/inventory-prototype-vs-app.md`). The pattern is
  `renameCanvas`: a domain command with its change event, one undo step, a field on the home. **Done in slice 9**
  (step 3, D-59).
- **Typing the zoom** (e.g. 95 %) next to + and −. Not in the prototype, so a decision: the range (the canvas's minimum
  and maximum), Enter applies, Esc goes back. One `setViewport`, no re-render of `ModelCanvas` (AD-24). **Done in
  slice 9** (step 4, D-60).

### Later

- **Thumbnails on the project home's canvas tiles.** **Done in slice 12b** (D-29, AD-32), after measuring the home's
  load: the home already read every row a thumbnail needs. Later steps are in the entries of slice 12b below.
- **Copying an attribute to another entity.** **Done in slice 10c** (D-63): “Copy” and “Paste attribute”, one
  attribute at a time, not tied to a relationship; the copy follows its original's type and Personal data; mappings,
  requirement links and labels are not copied. Later steps are in the entries of slice 10c below.
- **An alias for entities and attributes.** **Done in slice 11** (D-64): the alias in the panels, the canvas's two
  check boxes with exceptions per card, the search; imports carry no alias. Later steps are in the entries of slice 11
  below.
- **A relationship from an entity to itself** (parent and child). **Done in slice 10a** (D-61): "Relate to itself" in
  the card header's menu, drawn as a loop.

## InfoCube: a dimensional modelling module (concept, 31 October 2026)

A colleague asked whether InfoMapper can model facts and dimensions. Agreed with Łukasz: not inside InfoMapper's LDM,
but as a separate module, InfoCube, built later, after the planned slices.

**What it is.** A module for facts and dimensions, built mostly on LDM entities and attributes, sometimes directly on
source columns. It holds its own mappings (LDM attribute → dimensional attribute, sometimes source column →
dimensional attribute) and its own description (grain, measures and their additivity, SCD types, role-playing
dimensions, perhaps bridge and junk dimensions).

**Principles.**
1. **One database, one repository.** InfoCube is an extension of InfoMapper's database and domain with its own tables,
   not a new database or repository. It shares the standard columns, soft deletes, versions (AD-12), change events and
   undo (AD-13), the save chain, the migrations and the local data file's format.
2. **One-way dependency.** InfoCube's tables point to InfoMapper's (entity, attribute, concept, requirement), never the
   other way. InfoMapper works without InfoCube.
3. **Impact analysis crosses the modules through one extension point.** When InfoMapper deletes or changes an object
   that InfoCube uses, its impact preview (D-47, slice 10c's second click) shows InfoCube's dependencies. Modules report
   their dependencies on an object; InfoMapper shows them without knowing their details.
4. **LDM is InfoCube's upstream.** Changes to LDM entities and attributes reach InfoCube as changes to resolve, as source
   imports reach mappings today (D-56). That mechanism should be generalised rather than copied.
5. **Requirements and concepts are shared**, so requirement coverage and "everything about a concept" span both layers:
   source → LDM → dimensional → requirement.

**Open question for the module's design** (decided by C-2 in slice 15: entities of the dimensional level, with
InfoCube's tables for their description). Are facts and dimensions InfoCube's own tables, or InfoMapper entities with a
layer, plus InfoCube's tables for their dimensional description? Own tables give a clean module boundary; entities with a
layer reuse panels, relationships, copied attributes (D-63), aliases (D-64) and the canvas.

**Other open points.** Reading LDM from other workspaces (an organisation-level repository) is a new concept with rights
to design; start within one workspace. Two feeds of one dimensional attribute (from LDM and from a source) are allowed,
and the model validator reports them. Stay at the logical level: technical SCD columns are a dimension's property, not
attributes, unless asked otherwise.

**What already fits.** Concepts as the link across layers; relationships (a fact → dimension relationship is many to
one); copied attributes for dimension keys in a fact (D-63); aliases as business names (D-64); requirements; the model
validator (a fact without a grain, a fact without dimension keys, a non-numeric measure); role names per relationship
end (role-playing dimensions).

**Until then.** No InfoMapper decision should close this path. When generalising changes to resolve or building the
validator, design them for reuse by modules.

**Backlog (Łukasz, 1 November 2026; `docs/prd/slice-15-infocube.md`, section 9):** junk, bridge and outrigger
dimensions; the fact type (transaction, periodic snapshot, accumulating snapshot); factless and aggregate facts;
hierarchies in dimensions.

- **Factless facts and the fact type** (Łukasz, 5 November 2026): a fact without measures is legitimate (a factless
  fact), so there is deliberately no "no measures" hint (D-68's hints, `factHints`). When the fact type is built, the
  Measures section's empty text ("None yet. Open a numeric attribute and turn on Measure.") should change for factless
  facts. **Done in slice 19** (D-74), with an explicit Factless flag.
- **Done in slice 19 (D-74):** junk dimensions (a kind), outrigger dimensions (derived from relationships between two
  dimensions), the fact type, factless and aggregate facts, and a dimension's history with Snapshot. **Still later**
  (slice 19, section 9): bridge dimensions (many-to-many with a weighting factor, so many-to-many gives no outrigger) and
  hierarchies in dimensions, slices of their own; a dimension's unknown member, with the model validator (decision 5b;
  **done in slice 22**, D-77);
  mini-dimensions and other SCD types (4–7); checking an aggregate's grain or measures against its base beyond the
  dimension hint.

## InfoMapper's canvas and menus: a slice after slice 15 (Łukasz, 6 November 2026): done in slice 16

Built in slice 16 (D-71, `docs/prd/slice-16-canvas-menus.md`), with a seventh item: no browser context menu in the
app's own surfaces.

From Łukasz's testing of slice 15c, agreed as a slice of its own after slice 15's closing. All three are InfoMapper's,
work at every model level, and need no new table.

1. **"Add attribute" in a card header's menu**, above "Link to a requirement…", as the entity panel's button: a new
   attribute with its name selected for typing, one undo step; shown to those who may edit the model. The prototype
   has it in the panel only.
2. **The canvas tabs' order from a tab's menu:** "Move left", "Move right", "Move to start", "Move to end", the items
   that would not move the tab disabled. It changes `project_canvas.sort_order` in the current project only (a
   canvas may be in several, D-28), one undo step each. Dragging tabs: later.
3. **Relationship lines shown or hidden by kind:** two switches, "Relationships between entities" (logical and
   dimensional) and "Relationships between source tables" (D-62). They filter within the layer modes that show
   relationships (Everything, Relationships); the modes stay as they are (D-22). Kept per canvas as keys in
   `canvas.look` (not undone, as the layer is not); a hidden kind is a chip in the view-state bar (D-39), cleared by
   its × or "Show all". The switch to the screen is measured on the dense canvas (lines in one SVG layer, AD-24). The
   entry "Source relationships: a layer switch of their own" (slice 10b) is decided with this item in that slice's
   step 1.
4. A right-button pan opens the toolbox on Linux and macOS (S2B-06, known limitation).
5. The top bar overflows by 1 px at 1,201 px with Linux's text drawing (S6A-10, known limitation).
6. The canvas saves its view about 150 ms late, also after its own view changes (known limitation; S5A-07, S6A-11).

The fourth observation of the same testing, the concept of a fact or a dimension, is decided in
`docs/prd/slice-15-infocube.md`, section 0, "Before 15d".

## Deleting a project: what comes later (slice 12a, PRD section 9)

- **From the workspace home:** a menu on a project's tile with "Delete project" (considered for slice 12a, not built: a
  project is deleted from its own home, as in the prototype).
- **A list of deleted projects to restore,** for when the undo history is gone (a restart, more than 50 steps later);
  the rows stay soft-deleted (`docs/known-limitations.md`, "A project's delete: its undo is all or nothing").
- **Moving a project's own canvases to another project** before deleting it, instead of deleting them with it.
- **A live notice** to people who have a deleted project open; today they learn of it on their next load or write.
- **The workspace's lifecycle** from the prototype: duplicate, transfer, export and delete (AD-09).

## Refresh a page restored from the back-forward cache (slice 12a, step 4)

Back onto a page opened by a full page load restores that whole document from the browser's back-forward cache, so a
page of a project or a canvas deleted since shows it as it was until the next action or reload
(`docs/known-limitations.md`, "Back onto a page restored from the browser's back-forward cache"). A `pageshow` listener
that sees `event.persisted` could call `router.refresh()` (or reload), so the page goes through `loadShell` as every
other arrival does (D-38). Measure first that it costs nothing on an ordinary Back within one document.

## Sign-in timeouts in full e2e runs (slice 12a's closing)

The development sign-in times out now and then in full e2e runs: after the click on a test user the top bar does not
show within 15 s (`signInAs`, `e2e/slice-00/helpers.ts`). Seen in slice 7b (S7A-04-route), slice 10a (two tests) and
slice 12a's closing (S9-08, S10C-02, 31 October 2026); each file passed 3 of 3 on its own, and the sign-in runs before
any slice's code. It costs a rerun of the failing files after most full runs. To look at: the sign-in redirect's timing
late in a long run (the traces in `.data/e2e-failures/12a-close-1/` show the sign-in's POST answered and the workspace
page requested), whether a longer wait in `signInAs` only or a sign-in that sets the session cookie directly (as the
domain helpers write test data) would end it, and whether it goes with the dev server's memory growth
(`docs/known-limitations.md`, "The e2e dev server restarts itself at its memory threshold").

**Result** (the e2e reliability chore, 1 November 2026): the cause is the dev server's memory, not the sign-in. In one
measured single run both sign-in failures came with the server's heap at 2 GB and more while the laptop paged hard; in
the run split in three parts (each heap under 1.6 GB) two full runs had none. No test sign-in was added (Łukasz, P4 A).
The chore's acceptance (`docs/prd/chore-e2e-reliability-acceptance.md`, steps 2 and 4) has the figures.

## A fourth part for the full e2e run: done in slice 14b

Done in slice 14b (`PART_STARTS`: `slice-03a`, `slice-07a`, `slice-10a`). Its closing's full run (3 November 2026):
556 passed, 3 skipped, no failure, 96 min 40 s; the parts took 25 min 27 s, 24 min 44 s, 20 min 25 s and 26 min 4 s,
their heaps peaked at 1,247, 1,331, 1,253 and 1,419 MB (38 to 44 % of the threshold). New slices fall into part 4:
watch its end heap at each closing. The entry as it was:

The full e2e run is three parts (`e2e/parts.ts`), each ending at a heap of 1.4 to 1.6 GB (the e2e reliability chore,
step 4). If a sign-in timed out again in a full run, read the memory log (`E2E_MEMORY_LOG=1`) at that test: with the
heap well above 1.5 GB, move the cuts to four parts (one more entry in `PART_STARTS`, each part about 20 minutes, a
server start of about 50 s more); at a low heap, the cause is elsewhere and more parts would not help. New slices fall
into part 3, so it grows first: watch its end heap at each closing. Slice 14a's closing (3 November 2026): part 3's
heap peaked at 1,788 MB (35 min 35 s), no sign-in timeout; parts 1 and 2 at 1,364 and 1,532 MB.

## The project home's own large parts (slice 12b, step 2)

Slice 12b's step 2 measured today's project home (`docs/prd/slice-12b-acceptance.md`, "Step 2"). Two parts of it
outweigh everything else in the document:
- **Model consistency:** 134 KB of markup for 232 lines on "Performance test" (its project home is 450 KB in all).
- **The open notes:** 275 KB with 360 notes on the 20-canvas project "Performance test – 20 canvases" (its home is
  1,095 KB).

The embedded RSC payload roughly doubles what client components receive, and TTFB grows by about 0.09 ms per KB. To
look at: folding the consistency lines by kind with a count (as its known limitation suggests), and a limit on the open
notes shown with "Show all". Measure with S12B-10 before and after.

## Canvas thumbnails: what comes later (slice 12b, PRD section 9)

- **The Overview's miniature on the shared function** (`src/domain/model/thumbnail.ts`): the Overview draws from React
  Flow's nodes, which move live during a drag (`drawnKey`), so it needs the shapes from those positions, not from the
  stored rows; and it draws lines into a collapsed frame's block, which the thumbnail leaves out.
- **A thumbnail as a link to a place on the canvas:** clicking a frame or a card in the strip opens the canvas there.
- **One file of symbols per page** (PRD P5's fallback, described only): one request with the index built once, under
  one key for all of a page's drawings, at the cost of fetching every thumbnail again after any one changes. Only if a
  real workspace's home shows the per-canvas requests delaying something measured (step 5: on 20 canvases the last
  drawing came in before FCP, cold and warm).
- **A stored thumbnail per canvas**, if a real workspace grows past step 5's bars (a data model change).

## A chore before slice 13: steadier full e2e runs (slice 12b's closing)

Slice 12b's closing lost a full run's start to `next/font/google`, and two tests to the dev server's restart at its
memory threshold, the second time after slice 12a (`docs/known-limitations.md`, "The e2e dev server restarts itself at
its memory threshold" and "The e2e server's start may miss its 120 s"). A small chore, before slice 13:
- **Memory:** more for the e2e dev server (Node's `--max-old-space-size` in the e2e `webServer` command), or the full
  run split in two (each half with its own server).
- **The font:** IBM Plex Sans hosted in the repository (`next/font/local`), so no run depends on Google Fonts; or, at
  least, a longer `webServer` start timeout for the e2e run.

Measure a full run's time and failures before and after.

**Done** in the e2e reliability chore (1 November 2026): the full run in three parts, each with its own server, and
IBM Plex hosted with the app (`docs/prd/chore-e2e-reliability-acceptance.md`).


## Why the e2e dev server's heap grows about 6 MB per test (chore e2e reliability, step 2)

In one full run on `main`'s code (1 November 2026) the server child's heap grew steadily, about 33 MB a minute or 6 MB
a test, from 224 MB to the restart threshold (3,255 MB) at test 465 of 497, in every folder
(`docs/prd/chore-e2e-reliability-acceptance.md`, step 2). The chore splits the run in three parts and does not look
into it. To check: whether the application's own structures grow (the undo history in the server's memory, the local
adapter's caches) or Turbopack's and Next.js's (the module graph, compiled pages, request caches). The next step is a
heap snapshot of the child before the threshold (for example `--heapsnapshot-near-heap-limit` or the inspector on a run
of a few folders), read by retainers.

## A Latin subset of IBM Plex under another family name (chore e2e reliability, step 4)

Since the chore the app hosts IBM's complete WOFF2 files, so a first visit downloads 298 KB of fonts instead of the
106 KB of Google's Latin subsets before (`docs/known-limitations.md`, "A first visit carries about 192 KB more fonts").
If that starts to matter (a slow network, a first-visit budget), subset the five files to Latin (and Latin Extended,
for names like Łukasz's) and serve them under another family name, as OFL 1.1 requires for a modified version of a
font with a Reserved Font Name ("Plex"): rename the font's internal family names, keep `LICENSE.txt` with the files and
note the change in `src/app/fonts/ibm-plex/README.md`. Measure the first visit before and after (as the chore's A/B
did). No work now (Łukasz, 1 November 2026).

## Notes and frames on slice 13's rule (slice 13, step 1 answers, F12): done in slice 14a

**Done in slice 14a** (D-66): a note's text keeps its draft on the canvas and in its panel, with the "Not saved" mark,
the panels' lists show it; a frame's name has the conflict line; the canvas's queue answers with the refusal's code.


Slice 13 leaves notes and frames on the canvas's queue (`useNotes`, `useFrames`): a note's text, edited in its panel or
on the canvas, rolls back after a refused save (`useNotes.save`, `back`), and the frame panel's fields only got the
stable key (`docs/known-limitations.md`, "A note's text rolls back after a refused save"). Bring them to D-66: a note's
text keeps its draft with the conflict line, the frame's name too. It changes canvas code (`useNotes`, `NoteLayer`), so
it needs canvas commit counts like S13-12's. A candidate for the next scope after slice 13 (Łukasz, 1 November 2026).

## Notes on the canvas: what slice 14a leaves (slice 14a, step 1 answers 7 and 11)

- **A second press on a selected note edits it,** as in the prototype (`secondPress`, prototype line 2252). The app
  starts editing a note only on a double-click (or "Edit text", "Edit on the canvas"); slice 14a's DoD and S14A-05 use
  the double-click (F11).
- **A new note's text kept after its creation is refused** (F9): today the draft note and its text go with the toast
  (`useNotes.commit`). It could stay on the canvas with its text and the "Not saved" mark and be created again when left
  (about 40 lines, one spec). A known limitation (`docs/known-limitations.md`).

## "by {person}" on a conflict line (slice 13, step 1, F20)

Slice 13's conflict line says "Changed meanwhile to: {value}" without who changed it. A row's `updated_by` names its last
writer, which may have changed another field, or be an undo, a copy following its original, an import or a change to
resolve. The field's own author is in the change events: the newest event of that row whose after-image changed that
column. Reading it needs the change events on the page (today only with four-eyes, `lastContentEditor`) or a read in the
refusal's answer, and the project home needs the workspace's people (`workspacePeople`).

## The rich-text field's "Show more" without a layout read (slice 13, step 1, F25)

`RichTextField` (`src/ui/rich-text/rich-text-field.tsx`) measures its preview in a layout effect (`scrollHeight` against
`clientHeight`) to decide whether "Show more" shows. It sits beside the canvas, which CLAUDE.md's rule "nothing above the
canvas reads layout during a commit" covers. Decide from the text (lines and characters, as slice 13's conflict line
does) or with a `ResizeObserver`, and check with a phase trace that a panel switch costs less.

## A fact's or a dimension's role in a collapsed frame's block (slice 15a, step 4, E8)

- A collapsed frame lists its cards in a block (slice 2c). A fact or a dimension shows its name there like any entity,
  without its role or the cube mark the card has. The block could show the role as the card's header does (one class on
  the row, a CSS mask, no element more; `blockHeight` and the thumbnails unchanged). Łukasz, step 4: an idea for later.

## Requirements through dimensional mappings: what comes later (slice 15d)

- **"Via dimensional mapping"** in element panels (E21, Y4): a logical entity or attribute that feeds a fact's or a
  dimension's attribute in a requirement's scope could list that requirement indirectly, and its card carry the
  marker, as the prototype's `reqsFor` does. Not built (D-34 unchanged, P30).
- **A browser figure for the index with feeds** (`__imIndexTiming` with the synthetic feeds): only Node was measured
  in slice 15d (Y7).

## InfoMapper's canvas and menus: what comes later (slice 16, PRD section 9)

- **Dragging canvas tabs** to reorder them (slice 16 moves them from the tab's menu).
- **"Add attribute" from an attribute row's menu**, inserted below that row. **Done in slice 17** (D-72): "Add
  attribute below".
- **A third switch for dimensional relationships** on their own (InfoCube); "Between entities" covers both levels.
- **From slice 15d's closing:** a mapping from a column missing from the source says "not approved" in the requirement
  panel, though the mapping is approved: a reason of its own, as "type conflict" now. **Done in slice 21** (R6, D-76):
  "column left the source".

## Modelling ergonomics: what comes later (slice 17, PRD section 8 and step 2)

- **"New concept…" inside the concept picker:** creating a concept and an entity in one step. **Done in slice 21**
  (D-76), for facts and dimensions too.
- **X1:** a logical row dragged onto a source column. **Done in slice 21** (D-76).
- **The requirement card's link handle at a constant on-screen size at low zoom** (slice 21, decision 1A): left for a
  slice that changes how the canvas is drawn anyway, as it needs a measuring sitting.
- **Choosing a new concept's colour in the concept picker** (slice 21, PRD section 9): it takes the automatic colour,
  changed afterwards in the settings' "Concept colours".
- **Multi-row selection on the canvas** for linking requirements to several rows at once.
- **Opening another canvas of the project from a search hit** (a found attribute stays on the current canvas).
- **Dragging a requirement marker** from an entity card onto another row.
- **A found column in the Sources tab** showing its row, as a found attribute does (slice 17 covers the Model and
  Cube tabs, as the prototype; step 1, Q3).
- **"Fit frame to its content" and pinned notes:** a fit that moves the frame's top-left moves the notes pinned to it
  (their place is an offset from that corner); a resize from the left or top keeps them in place since slice 17 (D-20).
- **The object browser's tree carries each attribute's id** for item 3 (slice 17, Z5): on "Performance test" (779
  attributes) the tree grew from 61,432 to 92,346 bytes of JSON. A smaller form (an index into `fields`, or ids only
  where a search needs them) if the page's payload matters later.

## Derivations: done in slice 18 (Łukasz's testing of 7 November 2026)

Done in slice 18 (D-73): a value computed from other attributes of the same entity (`net_amount = quantity * unit_price *
(1 - discount_pct)`) is a calculated attribute, counted as mapped or fed and covered through its inputs; a descriptive
value taken from a dictionary through a code (DimBuilding's `AssetCategory`, "Unbekannt") is an InfoCube lookup.

What comes later (slice 18, PRD section 10 and step 1):
- **A dimension's unknown member** (Kimball's −1 row), with InfoCube's types. **Done in slice 22** (D-77).
- **Lookups in source mappings** (decision 4a).
- **Structured expressions:** parsed rules, functions and type inference; the rule stays plain text.
- **A model check for a calculation that is also mapped** (decision 2a), in the model validator (above).
- **Suggesting a lookup** when a dictionary's attribute is dropped on a dimension.
- **Exports and documents** that list calculations and lookups (Q7), with InfoDocumenter.
- **"Fed from concepts" through a calculation's inputs** (Q8): unchanged, as their own feeds already bring their concepts.
- **The Delete key on a relationship with lookups through it** says where to delete it (its menu or its panel) and deletes
  nothing; a two-press Delete if that is too strict.

## A dimension's unknown member: done in slice 22; what comes later

Done in slice 22 (D-77): a dimension has an unknown member unless turned off, with one value per attribute (typed values
stored, defaults otherwise), a fact's Dimensions say "no match → {value}", a lookup's "When no match" takes the value as
its placeholder, and two model checks.

What comes later (slice 22, PRD section 9 and the steps):
- **Special rows besides Unknown:** Not applicable (−2) and Late arriving (−3), each with its values.
- **A date dimension's default** (for example 1900-01-01 or 19000101) and a rule per role.
- **A model check for a primary key whose unknown member value is empty:** a key of a type without a default (a Date
  key) shows "no match → NULL" until a value is typed. KB has two Date keys.
- **Generating the row** (SQL, a dbt seed) and Data Vault's ghost record; exports and documents that list it
  (InfoDocumenter).
- **Per-attribute history** (SCD per attribute) in `cube_attribute`, the table named for such settings.
- **A check comparing a lookup's no-match value with the unknown member's** (decision 4b, not taken).
- **Every primary key's value in a fact's Dimensions row** when a dimension has several (the row shows the first key's).

## Metadata conventions: what comes later (slice 23, PRD section 9; step 1, Q8)

Slice 23 (D-78) gave the conventions one place, the workspace home's "Metadata conventions" tab. Left for later, each
with what step 1 found it needs (`docs/prd/slice-23-acceptance.md`, Q8):
- **Entity stereotypes' names and definitions, and own stereotypes**: done in slice 24 (D-79, the box "Entity
  stereotypes"; `docs/prd/slice-24-acceptance.md`). What comes after it is in "Entity stereotypes: what comes later"
  below.
- **The map from physical to logical types** (decision 7). First a decision on approved mappings whose type conflict
  appears or disappears when the map changes (D-51). The rule is one module, `src/domain/model/type-check.ts`, with the
  classes as module constants (`PHYSICAL_CLASSES`, `CLASS_OF`); a workspace's map is a parameter through its callers:
  `card-data.ts`, `line-data.ts`, `model-index.ts`, `attribute-panel.tsx`, `map-column.tsx`, the requirement index
  (`requirements.ts`), `consistency.ts`, `coverage.ts`, the import's D-51 rules (`rules.ts`), `plan.ts`,
  `standard.ts`, `column-type.ts` and `logicalTypeOf` (an attribute made from a column), as `AttributeFeeds` went
  through the requirement index in slice 15d. InfoCube's `typesDiffer` compares logical types only and reads no map.
- **An organization's default conventions** (decision 8): saved from a workspace and taken over by another, matched by
  code (built-in codes, and since slice 23 own codes; an own one without a code only by name). A removed own
  classification keeps its code for good (F16), so taking over a default whose code a removed row holds must bring that
  row back, not insert a new one: restore, today for built-in ones only, would then take own ones with a code.
- **Reset built-in names and definitions to a language's defaults**, as an explicit action with a preview (decision 4
  keeps a later language change from renaming anything). The texts are in the domain (`BUILTIN_TEXTS`); the action
  would compare each built-in row with them and show what changes.
- **A check of names against the naming conventions** (they are plain text now, D-78).
- **InfoDocumenter** printing the definitions, the colours and the naming conventions (its own PRDs).

## Entity stereotypes: what comes later (slice 24, PRD sections 2 and 9)

Slice 24 (D-79) made the stereotypes the workspace's list, edited in the Metadata conventions tab. Left for later:
- **Reordering the list.** Today the built-in ones come in their fixed order (`BUILTIN_STEREOTYPE_CODES`), then own ones
  by when they were added (`byStereotypeOrder`, `src/domain/model/stereotypes.ts`); an order would be a column of
  `stereotype` and one undo step per move, as a canvas's tab order (`moveCanvas`, slice 16).
- **Hiding an unused built-in one** from the entity panel's select. Built-in rows are never deleted (the CHECK
  `stereotype_builtin_kept_ck`, and the write rule reads no model for a built-in code because of it), so hiding needs a
  column of its own, not a delete.
- **Another default stereotype for new entities.** `createEntity` writes `DEFAULT_STEREOTYPE` (`object`) for both
  levels; a workspace's default would be a workspace setting, with facts and dimensions keeping `object` (C-5).
- **Naming rules per stereotype**, checked by the model checks (D-75), once names are checked against the naming
  conventions at all (D-78's later item).
- **A colour or an icon per stereotype** on cards. Today the label is text with the definition as its title, one
  element (AD-24); a mark would follow slice 3a's rule (a CSS mask on an existing element) and the element guard.
- **Documents printing the definitions** (InfoDocumenter); the type map and an organization's default conventions carry
  the stereotypes by code (D-78's later items).

## Keep the mapping rule's draft when its panel closes (slice 20, step 1 answer 10)

InfoMapper's mapping panel keeps a typed rule across fresh pages and refusals (slice 13), but its field has no `keep`:
if the panel ever unmounted while the rule still had the focus, the text would be lost (never saved elsewhere; slice
20's Q10). InfoCube's rule has `keep`. Give InfoMapper's rule `keep` too, as a small item. **Done in slice 21** (D-76).

## Model checks for much larger models (slice 20, step 2)

The checks' marks and counts are computed again in full after each write: about 22 ms in Chromium on 23,000 attributes
(`docs/known-limitations.md`). For much larger models: compute them **deferred**, after the write's commit has been
painted (the marks of the old state stay until then), and **incrementally**, only for the entities a write touched and
their relationships' other ends. Measure first with `scripts/bench-checks-browser.ts`.

## Model checks: what comes later (slice 20, PRD section 9)

- **A foreign key flag without a copy** (R3e): left out as noise in a hand-built model.
- **"Column left the source" as a requirement gap's reason** (R6), for the slice of small items. **Done in slice 21**
  (D-76).
- **Checks read from the change log since an approval** (decision 4b): an input renamed or retyped after it.
- **Dismissing a line**, with who and why (needs data).
- **A "Show checks" view** that fades everything else, as the Changes view; next and previous line on the canvas.
- **Marks on relationship and mapping lines**; a switch to hide the marks; marks on collapsed frames' blocks.
- **Source-side and Data Vault checks**; a dimension's unknown member (slice 19, decision 5b; done in slice 22, D-77).

## InfoDocumenter: done in slice 25, and what comes later (PRD section 9)

**Done in slice 25** (D-80): InfoDocumenter as a module with its licence and switch; documents as stored recipes from
three presets, private and shared with their rights; the form on one page; the document page laid out in A4 by Paged.js
with a title page, contents with page numbers, the running header and footer and the watermark; sections Text, Data
dictionary (logical level), Source-to-target mapping and InfoCube's Dimensional model; the labels in English, Polish and
German; the two extension points (document sections, the workspace home's module tab); the demo's three documents.

**Later:**
- **Slice B:** the dictionary's dimensional entities through InfoCube's contributions (if needed); the editor with a
  live preview, section order, adding and removing sections; the style (paper, orientation, theme, templates with IBM
  Plex Serif, header and footer fields, logos); the sections overview, conventions and notation, readiness, sources,
  classification register, requirements, traceability, data quality; the dictionary's other layouts and long
  definitions moved to the end.
- **Baselines** (their own slice, before the first that reads one): the snapshot as agreed (the entry below); then
  documents from a baseline and "changes since a baseline".
- **Slice C:** figures (canvases, frames, the star diagram drawn from the model), the canvas's page outline.
- **Slice D:** versions (the generated file stored), links for people outside the workspace (a new AD for access
  without a session), guests' restriction on versions and links (the export setting), where PDF files are made (browser
  or server).
- **Slice E:** Markdown export (metadata instead of images; one file or several).
- Live label canvases in documents from a baseline (option a of 11 November 2026); a workspace transfer with baselines
  holding InfoCube rows.
- For a workspace's copy or transfer (step 1, F30): a document's author kept when they are a member of the target, else
  the person copying; others' private documents never copied; the scope's project and concept ids remapped; the
  licence checked as AD-35 says, also while the switch is off.
- A module's switch states as one record when a third module comes (`docs/known-limitations.md`).

## Baselines: the design agreed for their slice (11 November 2026)

Baselines: the design agreed for their slice (11 November 2026). A baseline's snapshot holds the live rows (for link
tables, both ends live) of the core, sources, classifications and their links, stereotypes, mappings, requirements and
their links, every module's tables, projects and canvases with their items and frames, plus the deleted originals that
live copies point to (id, name, entity name), and the settings dv2_mode, four_eyes, naming_conventions and infocube. It
leaves out labels, label links, project pinned labels, notes, change events, source changes, source imports, people and
access. A per-table snapshot flag in the table registry decides it, so every new table is classified. The snapshot has
its own snapshot_schema with a short pure upgrade chain that reuses the modules' row upgrades; it runs on read,
deterministically (no new ids or times), and never writes back; a slice that changes a stored shape of a snapshot table
adds its step and a fixture test. One store method makes it from one read. Locally each snapshot is its own file in a
folder per data file, written before its row, and KB's backup includes that folder; in SQL it stays jsonb, kept out of
change event images. The first baseline slice builds create (name, note), list, rename and delete: new actions
baseline.create and rename for owners, admins and modelers, baseline.delete for owners and admins; outside undo,
logged; content immutable; soft delete; read only in an archived workspace. Live label canvases are in the snapshot but
not drawn from a baseline; later, freezing the labels and label links that drive them (option a). A document from a
baseline after that slice; a workspace transfer with baselines holding InfoCube rows is a question for the transfer
slice.
