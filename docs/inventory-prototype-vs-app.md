# Inventory: what the prototype has that the app does not (24 October 2026, updated at slice 22's close)

Written at slice 7a's close. It compares the reference prototype `docs/prototype/infomapper-prototype-with-sources.html`
(the reference since 22 October 2026) with the app on `slice/07a-source-import`; at slice 7b's close (25 October 2026)
every item planned for 7b was removed, as slice 7b delivered it (`docs/prd/slice-07b-acceptance.md`); at slice 7c's close
(27 October 2026) every item planned for 7c was removed, as slice 7c delivered it (`docs/prd/slice-07c-acceptance.md`); at
slice 8's close (28 October 2026) "New organization" and the People tab's changes were updated, as slice 8 delivered
them in their development form (`docs/prd/slice-08-acceptance.md`). At slice 10a's close (30 October 2026) its deliberate differences were added (`docs/prd/slice-10a-acceptance.md`); at slice 10b's close (30 October 2026) relationships between source tables on the canvas moved from "Still missing" to the deliberate differences (`docs/prd/slice-10b-acceptance.md`); at slice 10c's close (30 October 2026) copying an attribute was added to them (`docs/prd/slice-10c-acceptance.md`). At slice 12a's close (31 October 2026) deleting a project and Undo on the home pages were marked done, with their deliberate differences (`docs/prd/slice-12a-acceptance.md`). At slice 12b's close (1 November 2026) the canvas tiles' thumbnails and frame count were marked done, with their deliberate differences (`docs/prd/slice-12b-acceptance.md`). At slice 13's close (2 November 2026) the saving of fields was added to the deliberate differences (`docs/prd/slice-13-acceptance.md`). At slice 14a's close (3 November 2026) notes and frames joined them (`docs/prd/slice-14a-acceptance.md`); at slice 14b's close (3 November 2026) the canvas's rename in its tab and the warning on leaving a page (`docs/prd/slice-14b-acceptance.md`). At slice 15a's close (4 November 2026) the section InfoCube was added: the prototype was replaced in slice 15 by its version with the InfoCube module (`docs/prd/slice-15-infocube.md`, section 1), and 15a delivered its first part (`docs/prd/slice-15-acceptance.md`); at slice 15b's close (5 November 2026) the fact's and dimension's descriptions and role-playing dimensions were marked present, with their deliberate differences; at slice 15c's close (5 November 2026) dimensional mappings and "fed" coverage were marked present, with their deliberate differences. At slice 16's close (6 November 2026) the prototype was replaced by its version with the canvas menus (`docs/prd/slice-16-canvas-menus.md`), and its items 1 to 3 and 7 were marked present, with their deliberate differences (`docs/prd/slice-16-acceptance.md`). At slice 17's close (8 November 2026) the prototype was replaced by its version with the modelling ergonomics (`docs/prd/slice-17-modelling-ergonomics.md`), and its five items were marked present, with their deliberate differences (`docs/prd/slice-17-acceptance.md`, P1 to P12). At slice 18's close (8 November 2026) the prototype was replaced by its version with derivations (`docs/prd/slice-18-derivations.md`): calculated attributes and lookups were marked present, with their deliberate differences (`docs/prd/slice-18-acceptance.md`, P1 to P13). The earlier inventory (15 October 2026,
against `infomapper-model-prototype.html` at slice 4b-1's start) is in git history.

**How it was checked**
- **The new prototype is the old one plus the source importer.** Slice 7a's step 1 compared the two files hunk by hunk
  (`docs/prd/slice-07a-acceptance.md`, "Differences between the old and the new prototype outside the importer"):
  the module `IMP` and its CSS, and changes in the main prototype listed there. Nothing else changed.
- **Items of the earlier inventory** were updated from what the slices since then delivered (4b-1, 4b-2, 5a, 6a, 6b,
  7a; their acceptance docs) and checked again in the app's source (`src/`) by their wording, test id or command.
- **The importer's items** come from PRD 7a's sections 8 and 9 and the decisions of steps 1–7, checked against the code.
- Items marked **(uncertain)** were not settled by reading the code.

**What the "Planned" column means:** **Database:** the database
slice, last (AD-31), with real sign-in (AD-04). **Decision only:** a decision in `docs/decisions.md` describes it, but no
slice has it yet. **Idea:** in `docs/ideas.md`. **–:** nothing found that plans it.

**Out of scope here:** what the app has beyond the prototype, and the deliberate differences recorded in acceptance
docs (some are repeated below where they explain an item).

## Summary

| Area | Missing in the app | Planned |
| --- | --- | --- |
| Panels and navigation | "Show its requirements (n)" in the row and card menus; editing a requirement's description from its card | idea |
| Model | Data Vault 2.0 hints in the entity panel | idea (P12 of slice 7c; AD-08) |
| Mappings | suggested mappings; re-pointing a mapping to another attribute | – |
| Sources | only ideas: slice 7c's ideas (see Sources) | idea |
| Labels and notes | rich text in notes | known limitation |
| Projects and workspace | baselines; workspace export, export and delete, duplicate, transfer | baselines: decision only (AD-03, AD-14); the rest: – |
| Settings and roles | inviting people by e-mail (slice 8 adds them at once instead) | database (AD-04) |

## Canvas

Nothing missing since slice 7b, which brought the Changes view (a fade with its bar and chip, D-39), the new,
changed and retired row marks.

**Present since the earlier inventory:** requirement markers, coverage colours and Focus (4b-1); requirement cards and
trace lines (4b-2); showing, hiding and resizing the side panels (5a); the view-state bar and the narrow top bar (6a);
a missing column's row and mapping line marks (7a); a zoom typed in the top bar (9, D-60); "Add attribute" in an entity
card header's menu, a canvas tab's Move left, Move right, Move to start and Move to end, the tab menu's "Relationship
lines" with the chips "Entity relationships hidden" and "Source relationships hidden", and no browser context menu in
the app's own surfaces (16, D-71); the concept picker for a new entity, fact or dimension, the requirement picker with
several links at once and "Link all attributes…", a requirement card's link drag, a found attribute's row, a frame
resized from every edge and corner, and "Add attribute below" (17, D-72); calculated attributes ("Calculated from", the
row's "=" and square, counted as mapped or fed and covered through their inputs, Focus and the delete's second click) and
InfoCube's lookups (the kind, its relationship, its value for no match, the chip "L") (18, D-73); the model checks: the project home's section and its stats' link, the card
marks, the status bar's count, the details panel's group and the panels' box (20, D-75); a dimension's unknown member: the
panel's section with the flag and a value per attribute, a fact's Dimensions' "no match → {value}", a lookup's
placeholder and the two checks (22, D-77).

**Deliberate differences:**
- **Slice 22 (D-77):**
  - Eight attribute types, not six: Datetime follows Date's rule with its own sentence, and a Custom type takes any
    value; both default to empty.
  - Readers, reviewers and an archived workspace see the values in read-only fields (the text can be selected); the
    prototype disables them.
  - A value keeps its draft (D-66): after a refused save the field shows the conflict line or "Not saved", and the page
    asks before it is left; the prototype saves at once.
  - A value whose attribute is deleted goes with it in the same undo step; the prototype drops it when it builds its
    index.
  - The two groups stand among InfoCube's by severity (High first): feeds, unknown member values, fact hints, dimensions
    without an unknown member, not yet covered.
- **Slice 20 (D-75):**
  - A copy of a copy counts by the key at the end of its chain, and a foreign key with the primary key's name counts as
    its copy for "no copied key"; the prototype reads only a copy's first link.
  - `lost` is checked at both levels; the prototype checks the logical level only.
  - The type conflict is the app's rule (Integer → Decimal and a lookup can conflict); the prototype's `cmTypeIssue`
    accepts the first and skips the second.
  - "Not yet covered" follows D-31's rule with calculations, with two more reasons (an approved mapping with a type
    conflict, a calculation's input); the prototype's `srcOk` is the direct rule.
  - The row's "!" is the type's `::after`, put before a measure's Σ; the prototype's is `::before`.
  - The details panel's group has D-35's filter; a mark's title is set on hover; the name keeps its own title.
  - A line without a canvas that shows its entities opens the project's first canvas.
  - The demo is a seed step (`checksDemo`); the prototype's "Copy of" field stands in for D-63's copies, which the app
    has.
- **Slice 19 (D-74):**
  - Many-to-many between two dimensions gives no outrigger; the prototype makes the `from` end one.
  - Undo refuses a cycle of aggregates or a base that is a deleted fact; the prototype reads such a base as none.
  - A long role chip is cut with "…" (the concept text first), its full text in the title; the prototype's is never cut.
  - "Aggregate of" offers the facts in the model's order of entities (the Cube tab's), not InfoCube's row order.
  - The panel's Role has the card's title, "(InfoCube)" included; the prototype's panel title has none.
  - The demo is a seed step, not applied on every load (`cubeDemoV5`, `cubeDemoV6`).
- **Slice 18 (D-73):**
  - Every count follows a calculation, the Mapped filter included; the prototype's filter reads source mappings only.
  - A feed reading a calculated logical attribute counts through that calculation, and a calculation's inputs join a
    requirement's scope at any depth; the prototype's are one level, and its feeds read only directly mapped inputs.
  - Deleting a relationship with lookups through it asks a second click and sends an approved lookup back to review; the
    prototype deletes it at once and leaves the lookup's status.
  - Focus on an attribute lights its inputs' and users' mappings and lines, not their rows (the app's Focus is
    card-level).
  - A dimensional line has no title; the lookup's relationship is in its panel.
  - "Not calculated. Mark it when …" is for editors; readers and reviewers see the section only when it has content.
  - An input's delete names the calculations on its second click; the prototype asks in a dialog.
  - A lookup's relationship or value, once changed, sends an approved lookup back to review (D-51), as the prototype does
    not.
  - The section's state says "Every input is mapped." or "Not yet: …"; the prototype says "Covered: …" and "Not covered
    yet: …" ("covered" is D-31's word).
- **Slice 17 (D-72):**
  - The Cube tab's New fact and New dimension always open the concept picker; the prototype takes a concept frame's
    concept when the free spot it picks lies in one.
  - The menus' item says "Link to requirements…", as the panel's button; the prototype's menus keep "Link to a
    requirement…". The panel's buttons are for those who may edit, as the select was.
  - A found row's card is opened as one undo step "Show row", and a row filter is reset only when it hides the row; the
    prototype resets any filter, outside undo.
  - A resize from the left or top keeps notes pinned to the frame in place (D-20); the prototype moves them with the
    frame's corner. The frame's minimum stays 160 × 96 (the prototype's is 240 × 160).
  - The link drag lights its target with the left panel's drop mark and hint ("Link to {name}"); a linked target says
    "{key} is already linked to {name}.". The handle is one element (a mask), drawn at full detail only. A requirement
    card has no double-click.
- **Slice 16 (D-71):**
  - "Add attribute" stands directly before "Paste attribute", not before "Link to a requirement…", which the app's card
    menu does not have.
  - The move items and the relationship switches are also in the project home tile's menu, the same menu as the tab's.
  - The switches are `canvas.look` keys, present only while a kind is hidden; the prototype keeps `hideRels` beside the
    layer.
  - Inside the canvas the prototype cancels every right click; the app's text fields there (a note's editor, the Changes
    select, the toolbox's search) keep the browser's menu, as item 7's rule says.
  - The prototype draws source relationships simplified (no self loop, no live canvas, no context cards); the app's
    lines follow D-62.
  - The chips have titles ("Lines between entities are hidden on this canvas", "Lines between source tables are hidden
    on this canvas").
- **Slice 11 (D-64):** entities and attributes have an alias, edited in their panels; the prototype has none. A canvas
  shows names or aliases in two dimensions, set by "Entity aliases" and "Attribute aliases" in the top bar after the
  layer switch (in "More" up to 1,300 px), with exceptions per card from its header's menu ("Entity name" and "Attribute
  names" segments after "Rows") and a tint on cards with an exception. The object browser's search also finds aliases,
  naming the alias in the row's hint.
- **Slice 10c (D-63):** an attribute can be copied and pasted into any entity, its own included (“Copy” in its row's
  menu, “Paste attribute “…”” in a card header's menu); the copy follows its original's data type and Personal data,
  read-only in its panel, which names its original and lists an original's copies. The prototype has neither.
- **Slice 10c:** deleting an attribute that has copies asks for a second click naming them, as one with mappings does
  since slice 1b; the prototype deletes an attribute at once.
- **Slice 10b (D-62):** relationships between source tables are drawn on canvases, where the prototype only promised
  it ("Shown later as a grey line…"): a grey line between the table cards, lighter and thinner than a relationship
  between entities, with an arrow at the referenced table and no cardinality marks or label, painted below the other
  lines. A key from a table to itself is slice 10a's loop. A relationship the source no longer declares is dashed (its
  arrow solid); the prototype marks it only in the panel. A click selects the table with the key; no line menu.
- **Slice 10a:** a relationship from an entity to itself is drawn as a loop at its card's top right corner, from the
  right edge to the top edge; the prototype has no such shape. The miniature leaves it out (D-61).
- **Slice 10a:** canvas writes on a model row (a line's status, split, swap and delete, an attribute's move and delete,
  a column dropped on a mapping, the frame panel's "move to the frame's concept", and the panels' other writes on rows
  their fields save) carry the newest version known and wait for each other per row (`saveRow`, `saveRows`); the
  prototype has no versions.
- **Slice 9:** the zoom value between − and + is a field, where the prototype shows text (`#zoomv`): a typed zoom applies
  on Enter or on leaving the field, clamped to 10–300 % (D-60).
- **Slice 7a:** a missing column's row is muted by colour, not by opacity, and a line segment by its stroke opacity
  (AD-24: no opacity on repeated elements); on a combined mapping only the missing input's segment is marked (F29).
- **Slice 6a** (view-state bar): no lens chip; no role or archived chip; chips that do not fit fold into "+{n}"; the
  top bar's "More" menu (`docs/prd/slice-06a-acceptance.md`).

## Panels and navigation

| Item | What it is | Where in the prototype | Planned |
| --- | --- | --- | --- |
| "Show its requirements (n)" | places the cards of an element's requirements next to it, from the attribute row and card menus | `ctxFor` (`reqsFor`) | idea ("Requirement cards: what the prototype has besides") |
| A requirement card's "Edit description…" and double-click | open the description editor from the card | `ctxFor` (requirement card) | idea (same entry) |

**Present since the earlier inventory:** back and forward with Alt+←/→ (6b; differences in its acceptance doc); a
source system's panel as a selection and a history place (7a).

**Slice 13, deliberate differences from the prototype (PRD section 8, D-66):** the prototype is a one-person app with
no save conflicts, drafts across saves or refusals. In the app every text field keeps its draft across fresh pages and
after a refusal: a conflict shows the other value under the field (in a rich-text field inside its editor) with "Use
this" and "Keep mine"; a cut or unchanged field shows "Not saved"; a permission or archive refusal leaves the draft
readable to copy; Escape in a text field puts the stored value back (the prototype's inspector fields have no Escape).
Fields look as before apart from these marks.

**Slice 14a, deliberate differences from the prototype (PRD section 8, D-66):** notes and frames follow slice 13's
rule. A note's text keeps its draft on the canvas and in its panel; a note with a refused draft shows a "Not saved"
button in its header, which opens its panel with the conflict line, and the panels' lists of notes show the draft with
"Not saved"; a frame's name has the line in its panel. The prototype has none of these. Also different: the prototype
starts editing a note on a second press of a selected note (`secondPress`); the app on a double-click (`docs/ideas.md`).

**Slice 14b, deliberate differences from the prototype (PRD section 8, D-66):** the prototype has no save conflicts and
no warning on leaving. A refused rename of a canvas keeps the typed name in its tab's field with slice 13's line in a
compact form inside the tab, on one row after the field ("Changed meanwhile to: …", "Use this", "Keep mine"), or "Not
saved"; an empty canvas name goes back with "Enter a name." (the prototype keeps the old name silently). A page with
unsaved text asks the browser to warn before it is reloaded or closed, with the browser's own text; navigation inside
the app gives no warning.

## Model

| Item | What it is | Where in the prototype | Planned |
| --- | --- | --- | --- |
| Data Vault 2.0 hints | the entity panel's hub or link name, business key, satellites by source system, unmapped attributes | `dvSection` (`settings.dv2`) | idea ("Data Vault hints in the entity panel"; not part of 7c, P12) |
| Mixed-systems hint for combined mappings | a combined mapping across source systems suggests a business rule in a later layer (D-50) | **(uncertain)**: no function of its own found | decision only |

**Deliberate differences (slice 10a, D-61):**
- An entity can be related to itself; the prototype refuses it (`createRel`). "Relate to itself" in the card header's
  menu creates one with the ends 0..1 → 0..n; a relationship between two entities keeps the prototype's 1..1 → 0..N.
- The relate button clicked on the same card still refuses, and its text names that item: "Pick a different entity, or
  use “Relate to itself” in the card's menu." (the prototype: "Pick a different entity to relate to.").
- A self-relationship's panel keeps the prototype's title, "{entity} and {entity}", but names its end fields after the
  loop: "At the right end" and "At the top end" (the prototype's "At the {entity} end" would show twice).
- Swap on a self-relationship with equal cardinalities is refused with "Nothing to change.".

**Not a gap:** the new prototype's attribute panel has a "Length" field for String attributes; the app has type
parameters (AD-27).

## Mappings

| Item | What it is | Where in the prototype | Planned |
| --- | --- | --- | --- |
| Suggested mappings | the "Suggestions" mode: candidates drawn as dotted lines, accept one, reject one or accept all strong matches | `#tSug`, `suggestions`, `insSuggest` | – |
| Re-pointing a mapping | changing a mapping's attribute in its panel | the inspector's `change` handler (`map.attr`) | – |

**Present:** as before (drag to map, combined mappings, split and merge, statuses, rules, the type check); since 7a the
type check knows the Oracle and PostgreSQL names, `max` lengths and `rowversion`, and an import sends an approved mapping
back to review with its reason, shown under its status (D-51).

## Sources

Slice 7a brought the importer (`IMP`): the wizard with its three steps and four channels (dbt disabled, as the
prototype), the engine, missing and back statuses, the import history, relationships between source tables, the Sources
tab's marks, the table, column and system panels' sections listed in PRD 7a item 33–39. Slice 7b brought the changes
to resolve with their actions, counts and history, the review's two callouts, retired and not needed, and model
consistency on the project home (D-56).

Slice 7c brought classifications and notes on tables and columns, the workspace's classification list, the import
reading every classification and suggesting some, and the Data Vault reading of a source table (D-57).

**Still missing (ideas only):**

| Item | What it is | Where in the prototype | Planned |
| --- | --- | --- | --- |
| Readings that use Link candidate and Satellite source | the prototype lists both table classifications; its reading reads neither | `DEFAULT_CLASSES` | idea |

Beyond the prototype, slice 7c's other ideas are in `docs/ideas.md`: a panel-only write that does not redraw the canvas,
rich text for all notes at once, built-in names per documentation language, a `table_classifications` column in the
source standard, own classifications with a code (and, under Model, the entity panel's Data Vault hints).

**Deliberate differences (slice 7a, PRD section 8 and `docs/prd/slice-07a-acceptance.md`):**
- mappings have inputs (AD-26): conflicts, business key changes and rule rewrites are judged per input;
- the server builds the plan again and writes only what the review showed; otherwise the review refreshes (P8);
- no sample links in the app (P10); the samples are test files in `src/domain/import/samples/`;
- the column's comment is the source's and read-only, "From the source:", as on tables (slice 7c, P9; it was editable in
  7a, answer 8); the review shows every overwrite;
- a real date, time and person on each import; a size limit of 30,000 column rows per import (a limit of the local
  adapter);
- types keep their parameters (fractional seconds as precision; `datetime2` read as `datetime2(7)`, `timestamp` as
  `timestamp(6)`; `max` as -1); SQL Server's `timestamp` is `rowversion` in the query and DDL channels;
- the catalog queries return fractional seconds; the prototype's queries do not;
- names that differ only in case leave their table out of the import with a reason;
- a relationship is matched by name, then by what it joins;
- after an import the system's panel opens with the Sources tab (an action that leads to details on purpose);
- no "Reset the prototype's demo data" link (prototype only; `npm run reset-dev-data`);
- "New source table" stays below "Import sources…" (answer 14).

**Deliberate differences (slice 7c, PRD section 8 and `docs/prd/slice-07c-acceptance.md`):**
- built-in classifications can be renamed, removed and restored (P1); the rules read their fixed codes, so a renamed one
  keeps working and a removed one is absent; the prototype fixes them;
- Effective date is a general classification, not a Data Vault one (P2);
- the built-in `PII` is named "Personal data" (the app's label since slice 1a); a file's "PII" and "Personal data" both
  match (answer F14);
- classifications are rows and links (AD-15, AD-18), not code arrays on the objects;
- removing a classification in use, or a built-in one a rule reads, shows its uses and what stops first, and is one
  undo step (D-47); the prototype asks with `confirm()`;
- notes are plain text, saved as a mapping's note (answer F7), as in the prototype; hand-typed column comments moved
  into notes when slice 7c was installed, listed in the upgrade's report (P9, Q4);
- only source rows carry the BK badge, read from the classifications; the PII badge stays on attribute rows (answer
  F2), as in the prototype;
- Data Vault values in a file are read and marked in the review while the mode is off (P5); the prototype reads them
  silently;
- switching Data Vault 2.0 mode off says how many Data Vault classifications stay stored; the settings text names the
  table panels' reading, not entity panel hints (answers F16, F17);
- the import's warnings come once per value and table (answer F13); a table classification named on a column is warned
  about and ignored;
- the Business key suggestion also checks the table's stored columns (answer F12); the suggestions' ticks are part of
  what the review showed (slice 7a, P8);
- a column whose file names other classifications shows under "all changes" with "The file says …" and counts as no
  change; its table reads "same" (answers to step 5);
- the Data Vault reading also leaves out retired and not needed columns, and says "with personal data" where the
  prototype says "PII";
- every write follows the app's roles, archive and change log; the prototype has one permission check.

## Requirements

Nothing missing since slice 7b (the review's coverage callout).

**Present since the earlier inventory:** markers, colours and Focus (4b-1); requirement cards, traces, "Place its card",
"Add all to this canvas" and dragging a requirement onto an element or the canvas (4b-2); an approved mapping from a
column missing from source covers no requirement (7a, D-31), as in the new prototype.

## Labels and notes

| Item | What it is | Where in the prototype | Planned |
| --- | --- | --- | --- |
| Rich text in notes | "Edit with formatting…" on a note | the note menu in `ctxFor`; `openRichFor` | known limitation "Notes stay plain text" |

**Present:** labels and their marks, the label panel, pins, live canvases, the working context (an import labels
nothing, D-26), notes, and their chips in the view-state bar (6a).

## Projects and workspace

| Item | What it is | Where in the prototype | Planned |
| --- | --- | --- | --- |
| Baselines | a named frozen snapshot; "Compare with now", "Mapping specification", "Data dictionary", delete | `wsTab` "baselines", `diffModels`, `compareBaseline`, `docFromBaseline` | decision only (AD-03, AD-14) |
| Workspace export | the whole workspace as one JSON file | `data-wa="export"` | – |
| Export and delete a workspace | delete after showing the full export (Owner only) | `data-wa="delete"` | – |
| Duplicate a workspace | a copy of the workspace | `data-wa="dup"` | – **(uncertain** what the copy includes) |
| Transfer to another organization | hand the model over (Owner only) | `data-wa="transfer"` | – |
| Delete a project | "Delete this project" at the end of the project home, two clicks; "Deleted the project {name}…" | `renderHome` (`data-hdel`) | **done** (slice 12a, D-65) |
| Undo and Redo on the home pages | the top bar's `#tUndo`, `#tRedo` on both home pages | `mutate`, `doUndo`, `doRedo` | **done** (slice 12a, D-65) |
| A project's name and description on its home | editable fields | `renderHome` (`data-pf`) | **done** (slice 9, D-59) |
| Thumbnails on the canvas tiles | a sketch of each canvas's layout in its tile's strip; "Empty canvas" | `thumb`, `renderHome` | **done** (slice 12b, D-29, AD-32) |
| A canvas tile's frame count | "{n} cards, {m} frames. Also in …" | `renderHome` | **done** (slice 12b, D-29) |
| A project tile's thumbnail on the workspace home | the project's first canvas | `renderWsHome` (`thumb(cs[0])`) | **done** (slice 12b, P8) |

**Present:** workspaces, projects and canvases as in the earlier inventory; the empty workspace's next steps name
importing sources (7a); "New organization…" in the organization menu (slice 8, item 9), with a password, the first
workspace's name and a summary; the new workspace keeps "First project" and "First canvas" (F6) and has no concept
"General".

**Slice 12a, deliberate differences from the prototype (PRD section 8):** after a project's delete the app shows the
workspace home (D-38), the prototype another project's home; the app's preview names the canvases deleted and staying,
the prototype's text is general; the undo toast names the step ("Undone: Delete project …"), the prototype says
"Undone"; a page of a deleted project leads to the workspace home with a toast; the server refuses the last project,
also under concurrent writes and undo. The home pages show only Undo and Redo of the canvas's top bar; the prototype
keeps the whole bar. The delete section is left out for reviewers, readers and an archived workspace; the prototype
draws it for everyone and refuses the change. The armed button disarms after 4 s or on blur (`ConfirmDelete`).

**Slice 12b, deliberate differences from the prototype (PRD section 8):**
- **Card heights:** a thumbnail's cards take the heights the canvas gives them: the row filter, a live canvas's
  context cards with their relevant rows, a collapsed frame's block. The prototype counts every row.
- **Notes:** a free note in a collapsed frame is not drawn, as on the canvas, and notes are drawn 80 high (the
  prototype fits its bounds to 90).
- **"Empty canvas"** is HTML text in the strip, not SVG text.
- **Corners:** none are rounded; at this size they would be under a pixel.
- **How it is drawn:** from its own address through an external `<use>`, so it follows dark mode through the page's
  tokens (AD-32).

## Settings and roles

| Item | What it is | Where in the prototype | Planned |
| --- | --- | --- | --- |
| Inviting people | an e-mail and a role, an invitation e-mail, a pending row; guests from the e-mail's domain | the People tab, `data-wa="invite"` | database (AD-04); guests from other organizations: idea (AD-01) |

**Present:** the People tab, settings (four-eyes, Data Vault 2.0 mode), archived and read-only workspaces; importing
and re-importing only for owners, admins and modelers in a workspace that is not archived (7a, item 40). Since slice 8,
in the development form (D-58): "Add a person" (name, e-mail, role, a summary; the account at once, reached through the
organization's link and password), the role select and Remove per member for owners and admins, and the "Organization
access" box (the link, changing the password). Since slice 21 (D-76): the settings' "Concept colours" box (prototype
`data-ccol`), for those who may edit the model, one undo step per change. Still missing from the settings: the
prototype's "Model conventions" box (stereotypes, column classification, type mapping chips) and its "Statuses" and
"Requirement templates" lines.

**Deliberate differences (slice 8, PRD section 8):** a start page with signing in and creating an organization; adding
makes the account at once instead of an invitation; Remove asks first and says when the person leaves the organization;
the last owner keeps the role, only an owner gives or takes Owner, an admin cannot change or remove an owner, and nobody
changes their own row (F12); every people change follows the app's roles, archive and change log.

## InfoCube

| Item | What it is | Where in the prototype | Planned |
| --- | --- | --- | --- |
| A role in a collapsed frame's block | the block lists a fact or dimension without its role | the frame's block | idea |

**Present (slice 15a):** the InfoCube box in the workspace settings (the licence line, the check box for owners and
admins with the licence, the turn-off refusal in place); the Cube tab with New fact and New dimension, facts and then
dimensions by concept with "grain set"/"no grain" and "SCD {n}"; the Model tab with logical entities only; "New fact
here" and "New dimension here" in the canvas's toolbox; a card's role with the cube mark and a fact's edge; the entity
panel's Role; relationships only within a level, with the dimension at a fact's relationship's one end; paste within a
level; a source column maps only to a logical attribute (B-6's toast); the delete preview's InfoCube rows; the Sales star
in the demo data (`npm run demo`).

**Present (slice 15d):** requirements on facts, dimensions and their attributes, their scope through dimensional
mappings to the logical attributes and their sources, coverage by D-31's rule at both levels, the lens's feeding rows
and Focus on a requirement's own dimensional lines; the requirement panel's reasons ("not fed", "logical feed not
covered", "type conflict"); the bus matrix from the Cube tab (facts with their grain, dimensions with their SCD type,
one dot per relationship, conformed and unused); "Fed from concepts" in a fact's and a dimension's panel; REQ-210 in
the Sales star.

**Deliberate differences (slice 15d, PRD section 8):** selecting a requirement colours its scope without fading, and
only Focus fades (P27); a linked fact or dimension brings no attributes, and so no feeds, into the scope (P28); Focus on
a requirement lights only its own dimensional mappings, every other Focus every dimensional line between two lit cards
(P29); no requirement "via" a dimensional mapping in element panels and no marker on the feeding logical cards (P30);
the bus matrix opens a name or a dot by the app's go-to rule without a toast and lists facts and dimensions in the Cube
tab's order (P31); the panel's reasons for an item, also "type conflict" at the logical level (option A); "Fed from
concepts" (not in the prototype); the bus matrix for every role, read when it opens.

**Present (slice 15c):** dimensional mappings on the canvas (lines from logical rows to dimensional rows in the target's
colour, dashed until Approved, a diamond at the target, ƒ on a transformation; hover, Focus, the line's menu, Delete,
Back and Forward); the drag in both directions with the veil, onto a row or a dimensional header, and its refusals; the
mapping's panel (the trace, inputs with Add and ×, the target, the kind, the rule, the status, the note, Delete); "Comes
from the logical model" and "Feeds facts and dimensions" in the attribute panel; "Attributes and their logical feed" in
the entity panel; "fed" coverage on the card, its rows' dots, the Mapped filter, the Overview ("{n} of {m} fed") and the
homes' thumbnails; the delete previews and the attribute's second click with dimensional mappings; "Create dimension
from this…" with its dialog; the Sales star's 20 dimensional mappings.

**Deliberate differences (slice 15c, PRD section 8):** reviewers approve with four-eyes (O9); D-51's first rule sends an
approved mapping back to review (O12); Q-5 by the command in one undo step; dimming with the fading veil; an approval is
logged; a plain-text note; "Edit transformation rule…" says "It is a transformation now. Describe the rule." (P20); the
attribute's delete names dimensional mappings on its second click and its toast counts both kinds (R4, P10);
re-pointing the target is content for D-51 and refused onto an identical mapping; no "Map from a column…" or "Add a
source column" on a dimensional attribute; a dimensional card's Mapped filter reads its feeds; "Create dimension from
this…" makes plain attributes, its card in the canvas's free spot beside the original, InfoMapper's duplicate-name
warning; no tooltip on a dimensional line; Focus lights every dimensional line between two lit cards; one toast with the
panel's text and D-51's notice; the undo steps' names.

**Present (slice 15b):** a fact's section (Grain, Measures, Dimensions one row per relationship with its key and "Add
key", Hints that open what they name); a dimension's section (the SCD type with its sentence, Used by); a fact's
attribute's Carries and Measure (Additivity, "Not additive across", the type hint); the Σ marks on a card's rows; a role
per end of every relationship in its panel, its sentences and its line's pill; a fact – dimension relationship's "Key in
{fact}" and "Add key"; an attribute's delete naming its measure and key link; the Sales star's Order date and Ship date.

**Deliberate differences (slice 15b, PRD section 8):** a key is linked only to an existing foreign key; a measure on a
foreign key is allowed with a warning; a new measure's additivity follows its type; leaving semi-additive clears the
note; an inactive key link is kept and ignored (R3); no one-time link by name (R6); the attribute's delete names
InfoCube's rows on its second click, not in a dialog (R4); the Σ marks have no title and are a `::before` on the type
(R5); the sections are folds; a relationship to itself labels its roles by its ends (R2); parallel relationships and
loops 20 px apart, source relationships 16 px (R7).

**Deliberate differences (slice 15a, PRD section 8):** no "Prototype: grant / end licence" button (a script grants a
licence in development); InfoCube is turned off only while the workspace has no facts or dimensions, and while it is off
nothing creates or brings one back, so there is no read-only mode, hatch or off note (C-7 as changed on 4 November
2026); the box's text and the "off" toast say so; the role titles have no "is off here: read-only"; each fact is listed
once in a dimension's delete preview; paste within one level only (the prototype has no paste).

## The app ahead of the prototype (slice 22)

To be brought into the prototype at its next handover (slice 21's two lines are in the prototype since slice 22's):

- **A fact's Dimensions show "no match → {value}" on a line of its own**, under the dimension's name and its key, so both
  stay whole at the panel's default width (Łukasz, slice 22 step 3); the prototype has it on the key's line.

## Not product features

- **"Demo data restored" and "Reset the prototype's demo data":** the prototype's own reset. The app has
  `npm run reset-dev-data`.
- **The importer's sample links and its fixed date and person:** prototype only (P10, PRD 7a section 8).
- **"Signing out is not part of the prototype.":** the app signs out.
