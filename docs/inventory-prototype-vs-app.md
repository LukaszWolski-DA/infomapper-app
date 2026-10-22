# Inventory: what the prototype has that the app does not (15 October 2026)

Written for Łukasz before slice 4b-1's step 2. It compares the frozen prototype
(`docs/prototype/infomapper-model-prototype.html`) with the app on `slice/04b1-lens-focus` at `2589403` (`main` at the
tag `slice-04p` plus docs).

**How it was checked**
- **From the prototype's code:** its top-level functions, its context-menu entries (`add(…)`), its `data-do` / `data-wa`
  / `data-bl` actions, its toolbar buttons, its view-state fields (`V.*`), its toasts and its keyboard handling.
- **Against the app's source** (`src/`), by searching for each feature's wording, test id or command. Where a search
  could not settle it, the code was read.
- **Not from memory.** Items marked **(uncertain)** were not settled by reading the code. Check them in the app before
  relying on them.

**What the "Planned" column means**
- **4b-1 / 4b-2:** this slice or the next one, from their PRDs.
- **Slice 6:** where earlier acceptance docs and `docs/known-limitations.md` put the navigation history and the
  view-state bar (D-38, D-39).
- **Database:** the database slice, last (AD-31), with real sign-in (AD-04).
- **Decision only:** a decision in `docs/decisions.md` describes it, but no slice has it yet.
- **–:** nothing found that plans it.

**Out of scope here:** what the app has beyond the prototype, and the deliberate differences already recorded in
acceptance docs (for example, other lines not fading on a hover since 4p).

## Summary

| Area | Missing in the app | Planned |
| --- | --- | --- |
| Canvas | requirement cards and dashed traces; markers, coverage colours, Focus; the view-state bar; showing or hiding the side panels | 4b-1, 4b-2; panels: 5a (done); view-state bar: 6a (done) |
| Panels and navigation | back and forward (Alt ←/→), history; requirement cards from panels | slice 6b (D-38); 4b-2 |
| Model | Data Vault 2.0 hints in the entity panel (hub, link, business key, satellites) | decision only (AD-08) |
| Mappings | suggested mappings (the “Suggestions” mode, accept one or all strong matches); re-pointing a mapping to another attribute | – |
| Sources | nothing found missing | – |
| Requirements | markers, colours, Focus (4b-1); cards, traces, “Show its requirements”, “Place its card”, “Add all” (4b-2) | 4b-1, 4b-2 |
| Labels and notes | rich text in notes | known limitation |
| Projects and workspace | baselines (create, compare, mapping specification, data dictionary); workspace export, export and delete, duplicate, transfer; new organization; deleting a project; editing a project's name and description on its home | baselines: decision only (AD-03, AD-14); the rest: – |
| Settings and roles | inviting people, changing a role, removing a member | database (AD-04) |

## Canvas

| Item | What it is | Where in the prototype | Planned |
| --- | --- | --- | --- |
| Requirement markers on cards | a violet dot and a count in an entity's or table's header | `reqMark`, CSS `.rmark` | 4b-1 |
| Coverage colours | a selected requirement's rows blue (covered) or orange (gap) | `applyHighlight`, CSS `.row.rq`, `.row.gap` | 4b-1 (without the prototype's fading) |
| Focus | toolbar toggle, “Focus on this” / “Turn Focus off” in the card menu, the “Focus” chip | `#tFocus`, `focusCtx`, `relatedOf`, the card menu in `ctxFor` | 4b-1 |
| Requirement cards and trace lines | a requirement's card on the canvas, dashed lines to what it traces to, fading by Focus | `renderReqCards`, `reqTraces`, `reqActive`, `placeReqCards`, `showReqCard`, `dropReq` | 4b-2 |
| Requirement card menu | “Edit description…”, “Remove from this canvas (keeps the requirement)” | `ctxFor` (requirement card) | 4b-2 |
| View-state bar | chips for what hides or fades things (lens, Focus, layer, filters, collapsed cards and frames, hidden notes, tool, “Live: {name}”), each with ×, plus “Show all” | `viewState`, `renderNavBar` (`data-voff`, `data-vall`) | 6a (done; differences below) |
| Show or hide the side panels | toolbar buttons for the object browser and the details panel | `#tLeft`, `#tRight`, `applyPanels` | 5a (done; with resizing by the grips, `PANEL`, `.pgrip`) |

**Present in the app and not listed:**
- the toolbox (right-click), including quick add with a “new entity” entry;
- the Hand, Entity, Note and Frame tools; drawing relationships;
- row and card actions: filters (Rows: All, Mapped, Unmapped, Keys, Labeled on live canvases), collapsing a card, fit
  and reset widths, aligning, stacking and lining up;
- frames and their collapsing; bundles; layers; looks and grids;
- the Overview with its miniature; zoom controls; notation (crow's foot / UML); undo and redo with the toasts' Undo.

**View-state bar and top bar: deliberate differences (slice 6a, `docs/prd/slice-06a-acceptance.md`):**
- no lens chip: slice 4b-1 removed the lens (a selected requirement colours, fades nothing; D-32);
- no role or archived chip (the prototype's `Archived · read-only`, `{role} · …`, also on home pages): the user
  indicator shows the role and “Archived”; the bar is on canvas pages only;
- “Entity tool” has its chip text (the prototype's map has no entry for it and shows “undefined”); no chip while drawing
  a relationship;
- the row keeps its height and chips that do not fit fold into “+{n}”, with “Live: {name}” and “Show all” always
  visible (the prototype clips the chips at the right, “Show all” first);
- the filter and collapsed-card chips have no × for those who cannot edit;
- “Show all” shows from two chips this person can remove (the prototype counts every item, the role chip too);
- the top bar: the prototype's label steps at 2,100, 1,880 and 1,300 px, and instead of hiding Focus and the notation at
  1,000 px, a “More” menu takes them up to 1,200 px and the Entity, Frame, Note and Hand tools up to 1,100 px;
- a remembered canvas view is corrected for the left panel's width (D-54).

## Panels and navigation

| Item | What it is | Where in the prototype | Planned |
| --- | --- | --- | --- |
| Back and forward | Alt ←/→ and two buttons before the breadcrumbs; a history of up to 120 places (workspace, project, canvas, home screens, selection) | `navState`, `navRecord`, `navGo`, `renderNavBar` (`data-nav`) | slice 6b (D-38) |
| Element panels: “Show its requirements” | places the cards of an element's requirements next to it | the card menu in `ctxFor` (`reqsFor`) | 4b-2 |

**Present:**
- the left panel's tabs, search, folding and “Only on this canvas”;
- the inspector's sections with folding (D-35);
- long lists with a filter and “Show all” (`fields.tsx`);
- the breadcrumbs; the project and workspace switchers.

## Model

| Item | What it is | Where in the prototype | Planned |
| --- | --- | --- | --- |
| Data Vault 2.0 hints | in Data Vault 2.0 mode, the entity panel shows a section: hub or link name, business key (from columns marked BK), satellites by source system, unmapped attributes. Hints only. | `dvSection`, shown when `settings.dv2` is on | decision only (AD-08). The app has the mode's setting and its badge on the workspace home, but no hints. |
| Mixed-systems hint for combined mappings | in Data Vault 2.0 mode, a combined mapping across source systems suggests a business rule in a later layer (D-50) | **(uncertain)**: not found as a separate function in the prototype; D-50 describes it | decision only |

**Present:**
- concepts (new, rename, delete with its dialog);
- entities: create, stereotype, definition, delete with impact;
- attributes: order, move, PII, business key;
- relationships: name, cardinality, swap direction.

## Mappings

| Item | What it is | Where in the prototype | Planned |
| --- | --- | --- | --- |
| Suggested mappings | the toolbar's “Suggestions” mode: candidates for unmapped attributes on the canvas, from column and attribute names, table names and data types, drawn as dotted lines. The panel accepts one, rejects one, or accepts all strong matches (score ≥ 0.8 with fitting types) as drafts. | `#tSug`, `suggestions`, `insSuggest`, `data-do` `sug-ok`, `sug-no`, `sug-all`, `sug-close`; toast “Accepted {n} suggested mappings as drafts” | – |
| Re-pointing a mapping | changing a mapping's attribute (or its column) in the mapping panel; a duplicate is refused (“That mapping already exists.”) | the inspector's `change` handler (`map.col`, `map.attr`); toast “Re-pointed to …” | –. The app changes a mapping's columns through its inputs (add and remove, D-49), but not its attribute. |

**Present:** dragging a column onto an attribute (with D-48's choice); “Map from a column…” / “Map to an attribute…”;
new attribute from a column; combined mappings with an ƒ node; split and merge; statuses and approval; transformation
rules; the type check.

## Sources

Nothing found missing. Source systems, tables and columns, their panels, the BK and PII marks, “Add sources of
selected entities” and placing feeding sources are in the app.

## Requirements

| Item | What it is | Where in the prototype | Planned |
| --- | --- | --- | --- |
| Lens on selecting a requirement | fading everything outside its scope | `focusCtx` (`V.sel.t === "req"`), the view-state chip “Lens: REQ-x” | changed in 4b-1: colours only, fading through Focus (D-32 changes) |
| Markers, colours, Focus | as under Canvas | as under Canvas | 4b-1 |
| Requirement cards, traces, “Place its card”, “Add all to this canvas”, dragging a requirement onto an element or the canvas | as under Canvas | `placeReqCards`, `linkReq`, `dropReq`, `data-do` `req-card`, `req-cards-all`, `req-uncard` | 4b-2 |

**Present:** the Requirements tab; the requirement panel (fields, rich-text description, Traces to, coverage, gaps);
linking and unlinking from element panels; statuses with four-eyes; break-down (“Part of”); the project home's
requirements; the status bar's figure.

## Labels and notes

| Item | What it is | Where in the prototype | Planned |
| --- | --- | --- | --- |
| Rich text in notes | “Edit with formatting…” on a note | the note menu in `ctxFor`; `openRichFor` | known limitation “Notes stay plain text” (slice 4a). D-42 lists notes among the rich texts. No slice named. |
| View-state items for notes and live canvases | “Resolved notes hidden”, “Live: {name}” as chips | `viewState` | 6a (done) |

**Present:**
- labels, the labels field and its suggestions, label marks, the label panel, pinning labels to a project;
- live canvases; the working context;
- notes (free and pinned, colours, resolved, hidden resolved notes, counts) and the Note tool.

## Projects and workspace

| Item | What it is | Where in the prototype | Planned |
| --- | --- | --- | --- |
| Baselines | a workspace home tab: a named frozen snapshot of the model (with a note). Per baseline: “Compare with now” (added, changed, removed), “Mapping specification” and “Data dictionary” documents as they were, delete. | `wsTab` “baselines”, `data-wa="baseline"`, `data-bl` `cmp`, `map`, `dict`, `del`; `diffModels`, `compareBaseline`, `docFromBaseline`, `showModal` | decision only (AD-03, AD-14) |
| Workspace export | the whole workspace as one JSON file | `data-wa="export"` | – |
| Export and delete a workspace | delete after showing the full export (Owner only); “Keep at least one workspace.” | `data-wa="delete"` | – (slice 0's PRD left deleting workspaces out) |
| Duplicate a workspace | a copy of the workspace | `data-wa="dup"` | – **(uncertain** what the copy includes; its handler was not read) |
| Transfer to another organization | hand the model over, e.g. to the client after the project (Owner only) | `data-wa="transfer"` | –. The app's role texts mention transferring, but there is no action. |
| New organization | “Created {name} with an empty first workspace.” | the organization menu (`openOrgMenu`) | – |
| Delete a project | “Deleted the project {name}…” | the project menu (`openProjMenu`) | – **(uncertain** where exactly the entry sits) |
| A project's name and description on its home | editable fields on the project home | `renderHome`: `data-pf` `name`, `desc` | –. The app shows the description but has no editing. |

**Present:**
- workspaces: create, switch, archive and unarchive, the overview with statistics;
- projects: create, home with tiles, labels, notes and requirements;
- canvases: tabs, new, duplicate, delete, rename, adding a canvas to another project, the last opened canvas.

## Settings and roles

| Item | What it is | Where in the prototype | Planned |
| --- | --- | --- | --- |
| Inviting people | an e-mail and a role; guests from other organizations | the People tab, `data-wa="invite"`, toast “Enter an e-mail address.” | database (AD-04, real sign-in) |
| Changing a role, removing a member | a role menu and “Remove” per member, for admins | the People tab (`data-role`, `data-rm`) | database **(uncertain**: no slice names it; it needs real accounts) |

**Present:**
- the People tab (members, roles, guests, the table of what each role can do);
- settings: name, client, description, documentation language, four-eyes, Data Vault 2.0 mode;
- archived and read-only workspaces; reviewer and reader rights.

## Not product features

- **“Demo data restored”:** the prototype's own reset. The app has `npm run reset-dev-data` for development.
- **“Signing out is not part of the prototype.”:** the app signs out.
