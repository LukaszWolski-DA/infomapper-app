# Inventory: what the prototype has that the app does not (24 October 2026, updated at slice 7b's close)

Written at slice 7a's close. It compares the reference prototype `docs/prototype/infomapper-prototype-with-sources.html`
(the reference since 22 October 2026) with the app on `slice/07a-source-import`; at slice 7b's close (25 October 2026)
every item planned for 7b was removed, as slice 7b delivered it (`docs/prd/slice-07b-acceptance.md`). The earlier inventory (15 October 2026,
against `infomapper-model-prototype.html` at slice 4b-1's start) is in git history.

**How it was checked**
- **The new prototype is the old one plus the source importer.** Slice 7a's step 1 compared the two files hunk by hunk
  (`docs/prd/slice-07a-acceptance.md`, "Differences between the old and the new prototype outside the importer"):
  the module `IMP` and its CSS, and changes in the main prototype listed there. Nothing else changed.
- **Items of the earlier inventory** were updated from what the slices since then delivered (4b-1, 4b-2, 5a, 6a, 6b,
  7a; their acceptance docs) and checked again in the app's source (`src/`) by their wording, test id or command.
- **The importer's items** come from PRD 7a's sections 8 and 9 and the decisions of steps 1–7, checked against the code.
- Items marked **(uncertain)** were not settled by reading the code.

**What the "Planned" column means:** **7c:** the next slice, from PRD 7a's section 9. **Database:** the database
slice, last (AD-31), with real sign-in (AD-04). **Decision only:** a decision in `docs/decisions.md` describes it, but no
slice has it yet. **Idea:** in `docs/ideas.md`. **–:** nothing found that plans it.

**Out of scope here:** what the app has beyond the prototype, and the deliberate differences recorded in acceptance
docs (some are repeated below where they explain an item).

## Summary

| Area | Missing in the app | Planned |
| --- | --- | --- |
| Panels and navigation | "Show its requirements (n)" in the row and card menus; editing a requirement's description from its card | idea |
| Model | Data Vault 2.0 hints in the entity panel; the Data Vault reading of a source table | decision only (AD-08); 7c |
| Mappings | suggested mappings; re-pointing a mapping to another attribute | – |
| Sources | classifications and notes on tables and columns; suggested classifications; the classification list; the Data Vault reading | 7c |
| Labels and notes | rich text in notes | known limitation |
| Projects and workspace | baselines; workspace export, export and delete, duplicate, transfer; new organization; deleting a project; editing a project's name and description on its home | baselines: decision only (AD-03, AD-14); the rest: – |
| Settings and roles | inviting people, changing a role, removing a member; the workspace's classification list | database (AD-04); 7c |

## Canvas

Nothing missing since slice 7b, which brought the Changes view (a fade with its bar and chip, D-39), the new,
changed and retired row marks.

**Present since the earlier inventory:** requirement markers, coverage colours and Focus (4b-1); requirement cards and
trace lines (4b-2); showing, hiding and resizing the side panels (5a); the view-state bar and the narrow top bar (6a);
a missing column's row and mapping line marks (7a).

**Deliberate differences:**
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
| Data Vault 2.0 hints | the entity panel's hub or link name, business key, satellites by source system, unmapped attributes | `dvSection` (`settings.dv2`) | decision only (AD-08) |
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

**Still missing (slice 7c, and one idea):**

| Item | What it is | Where in the prototype | Planned |
| --- | --- | --- | --- |
| Classifications on tables and columns | toggles from the workspace's list on the table and column panels; a re-import never changes them | `togs`, `sourceBody`, `colSections` | 7c |
| Suggested classifications in the review | hints from names and keys | `plan.hints` | 7c |
| Notes on tables and columns | the modeller's own note, separate from the source's comment | `sourceBody`, `colSections` (`data-imx-note`) | 7c |
| The classification list | built-in, Data Vault and own classifications, by scope, in a settings dialog | `DEFAULT_CLASSES`, `renderSettings`, `#setDlg` | 7c |
| Data Vault reading of a table | hub, link and satellite candidates from a table's keys and classifications | `dvReading` | 7c |
| Relationships between source tables on the canvas | grey lines between table cards ("shown later" in the prototype) | the review's text only | idea |

**Deliberate differences (slice 7a, PRD section 8 and `docs/prd/slice-07a-acceptance.md`):**
- mappings have inputs (AD-26): conflicts, business key changes and rule rewrites are judged per input;
- the server builds the plan again and writes only what the review showed; otherwise the review refreshes (P8);
- no sample links in the app (P10); the samples are test files in `src/domain/import/samples/`;
- only Business key and PII are read from the file's classifications, the others listed as not read yet (P11);
- the column's comment stays editable and the review shows every overwrite (answer 8); the table panel shows the
  source's comment as "From the source:";
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
| New organization | "Created {name} with an empty first workspace." | `openOrgMenu` | – |
| Delete a project | "Deleted the project {name}…" | `openProjMenu` | – **(uncertain** where the entry sits) |
| A project's name and description on its home | editable fields | `renderHome` (`data-pf`) | – |

**Present:** workspaces, projects and canvases as in the earlier inventory; the empty workspace's next steps name
importing sources (7a).

## Settings and roles

| Item | What it is | Where in the prototype | Planned |
| --- | --- | --- | --- |
| Inviting people | an e-mail and a role; guests | the People tab, `data-wa="invite"` | database (AD-04) |
| Changing a role, removing a member | per member, for admins | the People tab (`data-role`, `data-rm`) | database **(uncertain**: no slice names it) |
| The classification list | as under Sources | `#setDlg` | 7c |

**Present:** the People tab, settings (four-eyes, Data Vault 2.0 mode), archived and read-only workspaces; importing
and re-importing only for owners, admins and modelers in a workspace that is not archived (7a, item 40).

## Not product features

- **"Demo data restored" and "Reset the prototype's demo data":** the prototype's own reset. The app has
  `npm run reset-dev-data`.
- **The importer's sample links and its fixed date and person:** prototype only (P10, PRD 7a section 8).
- **"Signing out is not part of the prototype.":** the app signs out.
