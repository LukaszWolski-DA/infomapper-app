# Ideas

Ideas that came up while building a slice and are not part of its PRD (AD-25). Each one needs a decision before it
is built.

## Settings: keep the typed value on a stale-version conflict (slice 0, step 5b)

Today, when a save is refused because someone else changed the record meanwhile ("Someone changed this meanwhile.
Reload to see the latest version."), the field goes back to the last value this page saved, and the typed value is
lost. Better: keep the user's typed value in the field and show the current server value next to it, so the user can
choose which to keep (or copy parts of theirs) instead of retyping.

## Panels: one behaviour for a refused save in every field (slice 9, step 1, F6)

After a refused save most panel fields keep the refused text (the field is keyed by its stored value, which did not
change); the requirement panel shows the stored values again (its reset counter) and the workspace settings go back to
the last saved value. One behaviour for every field would be clearer: either all go back, or all keep the typed text
with the stored value beside it (the idea above). Łukasz kept today's behaviour in slice 9 (29 October 2026).

## Mapping by drag: from the attribute side too (slice 1b, step 2)

The prototype also starts a mapping drag from an attribute row and drops it on a column row. The slice 1b PRD asks
only for a column dragged onto an attribute or an entity's header, so this is not built. (Auto-scroll near the canvas
edge, mentioned here before, was built in step 2 at Łukasz's request.)

## Feeding sources: drag from the panel onto the canvas (slice 1b, step 5)

In the prototype, a feeding source (or fed entity) in the right panel can also be dragged onto the canvas and lands
where it is dropped. The slice 1b PRD asks for a click (placed beside the card) and “Add the N missing”, so dragging
from the right panel is not built; the left panel's drag onto the canvas works as before.

## “Undo” in more toasts (slice 1b, step 5)

The prototype offers “Undo” in almost every toast after a change (a new mapping, a relationship, cards placed beside
a card). The slice 1b PRD asks for it on destructive actions only (deletes, remove from canvas), so that is what is
built; Ctrl+Z and the top bar's Undo work for every change.

## Undo and redo on the project and workspace home pages (slice 1b, acceptance)

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

## “Link all attributes” in an entity panel (slice 4b-1, step 8)

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

## Relationships between source tables as lines on the canvas (slice 7a, step 5)

The prototype's review promised "Shown later as a grey line between the table cards on a canvas" for a new
relationship; slice 7a left the sentence out. Lines between table cards for declared relationships, in the line layer
(AD-24 rule 3), with their own layer switch, would show the source's structure next to the mappings.

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

## Built-in classification names per documentation language (slice 7c, PRD section 9)

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

## Own classifications with a code (slice 7c, PRD section 9)

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
  waits for the refresh before it saves.
- **Renaming a project** (and its description). The prototype edits both on the project home (`renderHome`,
  `data-pf`); the app names a project only when it is created (`docs/inventory-prototype-vs-app.md`). The pattern is
  `renameCanvas`: a domain command with its change event, one undo step, a field on the home.
- **Typing the zoom** (e.g. 95 %) next to + and −. Not in the prototype, so a decision: the range (the canvas's minimum
  and maximum), Enter applies, Esc goes back. One `setViewport`, no re-render of `ModelCanvas` (AD-24).

### Later

- **Thumbnails on the project home's canvas tiles.** The prototype draws them (`thumb`); the app has an empty strip
  since slice 0 ("no thumbnails yet"). The Overview's miniature can draw them, but the home would read every canvas's
  layout: measure the home's load first.
- **Copying an attribute to another entity** ("copy to", picking an entity on the canvas), e.g. a primary or business
  key that becomes a foreign key elsewhere. Decide: a plain copy, or a foreign key tied to a relationship (with the
  self-relationship below); what happens to its classifications and mappings; whether the copy follows the original.
- **An alias for entities and attributes**, with a switch to show the alias instead of the name on the canvas. A data
  model change (`docs/data-model-v2.md`, the local file's next format), the cards' text fit and the element guard; decide
  whether the import reads an alias.
- **A relationship from an entity to itself** (parent and child). Refused today on purpose, as in the prototype
  (`createRel`: "Pick a different entity to relate to."; `createRelationship` and its test). Allowing it changes the
  prototype's behaviour (a decision) and needs a loop drawn in the line layer (AD-24, measured).
