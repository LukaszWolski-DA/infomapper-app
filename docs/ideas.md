# Ideas

Ideas that came up while building a slice and are not part of its PRD (AD-25). Each one needs a decision before it
is built.

## Settings: keep the typed value on a stale-version conflict (slice 0, step 5b)

Today, when a save is refused because someone else changed the record meanwhile ("Someone changed this meanwhile.
Reload to see the latest version."), the field goes back to the last value this page saved, and the typed value is
lost. Better: keep the user's typed value in the field and show the current server value next to it, so the user can
choose which to keep (or copy parts of theirs) instead of retyping.

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

## “Approve again all {n}” after an import (slice 7a, step 1; for slice 7b)

One import can send many approved mappings back to review (P6: a new type conflict, a business key column that changed
type, a renamed input in the rule). A button “Approve again all {n}” for the mappings one import sent back, with each
one's reason shown before the click, would spare a solo modeller approving them one by one. It respects four-eyes: with
four-eyes on, the person who ran the import cannot use it for those mappings (Łukasz, 22 October 2026).

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
