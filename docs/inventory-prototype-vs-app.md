# Inventory: what the prototype has that the app does not (24 October 2026, updated at slice 8's close)

Written at slice 7a's close. It compares the reference prototype `docs/prototype/infomapper-prototype-with-sources.html`
(the reference since 22 October 2026) with the app on `slice/07a-source-import`; at slice 7b's close (25 October 2026)
every item planned for 7b was removed, as slice 7b delivered it (`docs/prd/slice-07b-acceptance.md`); at slice 7c's close
(27 October 2026) every item planned for 7c was removed, as slice 7c delivered it (`docs/prd/slice-07c-acceptance.md`); at
slice 8's close (28 October 2026) "New organization" and the People tab's changes were updated, as slice 8 delivered
them in their development form (`docs/prd/slice-08-acceptance.md`). The earlier inventory (15 October 2026,
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
| Sources | only ideas: relationships between source tables on the canvas; slice 7c's ideas (see Sources) | idea |
| Labels and notes | rich text in notes | known limitation |
| Projects and workspace | baselines; workspace export, export and delete, duplicate, transfer; deleting a project | baselines: decision only (AD-03, AD-14); the rest: – |
| Settings and roles | inviting people by e-mail (slice 8 adds them at once instead) | database (AD-04) |

## Canvas

Nothing missing since slice 7b, which brought the Changes view (a fade with its bar and chip, D-39), the new,
changed and retired row marks.

**Present since the earlier inventory:** requirement markers, coverage colours and Focus (4b-1); requirement cards and
trace lines (4b-2); showing, hiding and resizing the side panels (5a); the view-state bar and the narrow top bar (6a);
a missing column's row and mapping line marks (7a); a zoom typed in the top bar (9, D-60).

**Deliberate differences:**
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

## Model

| Item | What it is | Where in the prototype | Planned |
| --- | --- | --- | --- |
| Data Vault 2.0 hints | the entity panel's hub or link name, business key, satellites by source system, unmapped attributes | `dvSection` (`settings.dv2`) | idea ("Data Vault hints in the entity panel"; not part of 7c, P12) |
| Mixed-systems hint for combined mappings | a combined mapping across source systems suggests a business rule in a later layer (D-50) | **(uncertain)**: no function of its own found | decision only |

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
| Relationships between source tables on the canvas | grey lines between table cards ("shown later" in the prototype) | the review's text only | idea |
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
| Delete a project | "Deleted the project {name}…" | `openProjMenu` | – **(uncertain** where the entry sits) |
| A project's name and description on its home | editable fields | `renderHome` (`data-pf`) | **done** (slice 9, D-59) |

**Present:** workspaces, projects and canvases as in the earlier inventory; the empty workspace's next steps name
importing sources (7a); "New organization…" in the organization menu (slice 8, item 9), with a password, the first
workspace's name and a summary; the new workspace keeps "First project" and "First canvas" (F6) and has no concept
"General".

## Settings and roles

| Item | What it is | Where in the prototype | Planned |
| --- | --- | --- | --- |
| Inviting people | an e-mail and a role, an invitation e-mail, a pending row; guests from the e-mail's domain | the People tab, `data-wa="invite"` | database (AD-04); guests from other organizations: idea (AD-01) |

**Present:** the People tab, settings (four-eyes, Data Vault 2.0 mode), archived and read-only workspaces; importing
and re-importing only for owners, admins and modelers in a workspace that is not archived (7a, item 40). Since slice 8,
in the development form (D-58): "Add a person" (name, e-mail, role, a summary; the account at once, reached through the
organization's link and password), the role select and Remove per member for owners and admins, and the "Organization
access" box (the link, changing the password).

**Deliberate differences (slice 8, PRD section 8):** a start page with signing in and creating an organization; adding
makes the account at once instead of an invitation; Remove asks first and says when the person leaves the organization;
the last owner keeps the role, only an owner gives or takes Owner, an admin cannot change or remove an owner, and nobody
changes their own row (F12); every people change follows the app's roles, archive and change log.

## Not product features

- **"Demo data restored" and "Reset the prototype's demo data":** the prototype's own reset. The app has
  `npm run reset-dev-data`.
- **The importer's sample links and its fixed date and person:** prototype only (P10, PRD 7a section 8).
- **"Signing out is not part of the prototype.":** the app signs out.
