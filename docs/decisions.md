# InfoMapper – Decisions

Condensed record of the decisions taken while designing the prototype (UX, `D-xx`) and the application
(architecture, `AD-xx`). Status as of 2 October 2026. The working documents with full discussion live in Claude;
**this file is the copy the code follows**. When a decision changes, update this file in the same pull request.

Behaviour reference: `docs/prototype/infomapper-model-prototype.html`. Data reference: `docs/data-model-v2.md`.

---

## UX decisions (D-xx)

### Canvas and mappings
- **D-01** The core of the canvas is mapping a source column to an attribute; layers (mappings, relationships) are toggled on one canvas.
- **D-02** A mapping is a model object, independent of any canvas. Removing a card does not remove its mappings.
- **D-03** The canvas is unbounded; the minimap is called “Overview”.
- **D-36** Attribute order belongs to the model (same on every canvas). Ctrl/Alt + ↑/↓ moves an attribute, Shift to top/bottom; drag in the entity panel. Source columns keep their physical order.
- **D-37** Card width (200–600 px) belongs to the canvas. Long names are truncated in the middle, keeping the part after the last underscore (`customer_addr…_line2`).
- **D-46** New entities: Entity tool (E) and toolbox on the canvas; “+” per concept in the left panel; “New concept”. The concept comes from the concept frame clicked into, else the last used. Duplicate names warn, do not block.
- **D-48** Dragging a column onto an attribute without mappings creates a direct mapping. If the attribute already has a mapping, a choice appears: “Separate mapping (alternative source)” or “Add to mapping …”, pre-selected by a hint (same table: add; other system: separate). Enter confirms, Esc cancels.
- **D-49** A combined mapping: input lines meet in an ƒ node next to the attribute, one line continues; its status colours all its lines. The mapping panel has an Inputs section (order, add, remove); more than one input requires a rule, into which columns are inserted by click. Actions “Split into separate mappings” and “Merge mappings”. The attribute panel shows one row per mapping.
- **D-50** A combined mapping may use columns from different source systems; in Data Vault 2.0 mode the hints warn that it mixes systems (suggest a business rule in a later layer).
- **D-51** Changing an approved mapping's inputs, kind or rule sends it back to review and clears the approval; approval belongs to a version of the mapping. Changing only the note keeps the status.
- **D-47** Deleting an entity from the model first shows its impact (attributes, mappings incl. approved ones, relationships, canvases, projects, requirements). A concept with entities is deleted only after its entities are moved to another concept; no cascade. Concept frames become free frames.

### Canvases, frames, selection
- **D-04** Frames belong to a canvas, not the model. One model, many canvases.
- **D-05** Dragging an entity into another concept’s frame asks explicitly; membership by drop position; one level of frames.
- **D-06** Drawing or resizing a frame does not take cards from other frames.
- **D-07** A collapsed frame becomes a block; its lines merge into one line per target with a count; layout is unchanged.
- **D-12** Canvas look (background, grid) is per canvas and outside undo.
- **D-14** A frame moves by dragging its name or any empty spot inside it.
- **D-15** Dragging empty canvas draws a lasso. Pan with scroll, Space, middle button; Shift+drag inside a frame draws a lasso.
- **D-16** The lasso selects only elements fully inside it.
- **D-17** A lassoed frame stands for its cards in the selection.
- **D-18** Right-drag pans; the Hand tool (H) pans with the left button.
- **D-19** Right-click without moving opens the toolbox for what is under the pointer (Ctrl+click on Mac, menu key). Right-clicking an unselected item selects it first.
- **D-22** Layer mode is per canvas; notation (crow’s foot / UML) is shared; Focus is momentary and not saved.
- **D-23** No nested frames for now.

### Working layer (labels, notes, context)
- **D-08** Working labels (e.g. `CR-23`) are stored apart from model tags (BK, PII).
- **D-09** Labels are assigned by hand first; automatic labeling is an option.
- **D-10** A live label canvas shows only labeled elements, with context cards for partly labeled ones.
- **D-11** Adding or removing a card on a live canvas changes the label, always after confirmation.
- **D-20** Notes belong to the canvas and the working layer. Free notes join the frame they are dropped in; pinned notes follow their card or frame with a dashed tether.
- **D-21** Notes are open or resolved; resolved ones can be hidden; an empty new note disappears.
- **D-24** Labels extend to mappings, tables and columns; the active context comes after that, as an option.
- **D-25** Live canvases include tables (fully labeled ones whole, others as context) and fade unlabeled mappings.
- **D-26** An active working context labels every model change (entities, attributes, mappings; relationships through their entities), not layout changes, in the same undo step. It stays on after reload until switched off.

### Projects and navigation
- **D-27** One shared model per workspace; projects organise canvases and context. Isolation between clients comes from workspaces.
- **D-28** A canvas can belong to several projects. Removing a shared canvas only takes it out of the current project; deleting a project deletes only canvases no other project uses.
- **D-29** Opening a project shows its home screen: canvas tiles with thumbnails, stats, labels (pinnable), open notes, requirements.
- **D-35** Left panel groups fold (count, sticky headers, remembered, search opens matches); “Only on this canvas”. Inspector sections fold (remembered per title); page actions always visible; lists over 20 items get a filter and “Show all”.
- **D-38** Navigation history covers workspace, project, canvas, home screens and selection (not panning): Alt+←/→, mouse back/forward, clickable breadcrumbs.
- **D-39** A view-state bar shows everything that hides or fades items (lens, Focus, layer, filters, collapsed cards and frames, hidden notes, active tool), each removable, plus “Show all”.

### Requirements and content
- **D-30** One requirements layer with kinds: business need, data requirement, business rule, data-quality rule, non-functional. Requirements can be broken down (parent).
- **D-31** Coverage is computed: a requirement is covered when every attribute in its scope (direct, via entity, via mapping) has an approved mapping without a type conflict.
- **D-32** On the canvas: markers on cards, a lens when a requirement is selected (covered rows blue, gaps orange), and optional requirement cards with dashed trace lines.
- **D-33** Labels and requirements are separate; a requirement has an external reference; a label can be promoted to a requirement (later).
- **D-34** Element panels list direct and indirect requirements; clicking places the requirement card next to the element; “Add all”.
- **D-41** Requirement card: filled header in a reserved violet (excluded from the concept palette), icon per kind, three-part coverage bar (covered / draft / missing), status badge.
- **D-42** Long texts (requirement descriptions, entity and attribute definitions, notes) use a rich-text editor dialog; panels show them formatted and shortened. Transformation rules and rule expressions stay code fields.
- **D-43** Text colour only from a named palette (warning, attention, confirmed, information).
- **D-44** New requirements get a template per kind: section headings are content, grey hints vanish when typing and are never saved, empty sections are removed on save.
- **D-45** Templates are built in now and editable per workspace later.

### Way of working
- **D-13** UX first, architecture second. Export/import formats follow the data schema.
- **D-40** The application is built from scratch. Nothing from the old InfoMapper is migrated, neither code nor data.

---

## Architecture decisions (AD-xx)

### Organizations, workspaces, access
- **AD-01** A user can belong to several organizations. A workspace belongs to one organization; people from outside are invited to a workspace as guests.
- **AD-02** Workspaces share nothing live; patterns are copied. An organization library comes later.
- **AD-03** Model versions are named baselines (frozen snapshots) to compare with and to generate documents from. No model branches.
- **AD-04** Sign-in with e-mail and password (Supabase Auth) to start; Microsoft/Google/SSO later.
- **AD-05** Five roles per workspace: owner, admin, modeler, reviewer (read, comment, notes, approve), reader.
- **AD-06** Four-eyes approval (the author cannot approve their own change) is a workspace setting, off by default. Every approval is logged.
- **AD-07** After sign-in the user lands on the workspace home. The top bar shows Organization / Workspace / Project.
- **AD-08** Optional Data Vault 2.0 mode per workspace: hints only (hub, business key, satellites by source), nothing enforced.
- **AD-09** Workspace lifecycle: create (empty or copy), archive (read-only), transfer to another organization, delete (owner only, after export).

### Data (see `docs/data-model-v2.md`)
- **AD-10** Table groups as in the data model; every model and work table has `workspace_id`.
- **AD-11** UUID v7 ids generated by the application; human keys (`REQ-104`) per workspace.
- **AD-12** Every row has `version`, `created_at/by`, `updated_at/by`, `deleted_at` (soft delete).
- **AD-13** Append-only `change_event` log with before/after images and the active context label; one user action = one change group = one undo step.
- **AD-14** Baselines are JSON snapshots of the model part of a workspace.
- **AD-15** Requirement and label links: one table per kind, one nullable FK per target type, “exactly one” check.
- **AD-16** Canvas layout as rows (`canvas_item`, `frame`, `note`); canvas look as JSON.
- **AD-17** Rich text stored as sanitized HTML plus a plain-text copy.
- **AD-18** Portable core: no enum types, triggers, stored functions or arrays; closed lists as text with CHECK; JSON only for look, snapshots and change images. Postgres/Supabase extras only outside the core.
- **AD-26** A mapping can read several source columns (`mapping` + `mapping_input`); a direct mapping has exactly one input.
- **AD-27** Attribute type = logical type plus optional length, precision, scale; `custom` has a name.
- **AD-28** Business key is also an attribute property, suggested from columns marked BK.

### Stack and delivery
- **AD-19** One Next.js application with layers: `domain` (pure TypeScript: types, commands, validation, business logic; no framework, no database), `data` (repository interfaces + Supabase adapter), `app` (routes, screens), `ui` and `canvas` (components).
- **AD-20** Tailwind and shadcn/ui; Tiptap editor; HTML sanitized on client and server.
- **AD-21** Vitest for `domain`; Playwright end-to-end tests per slice as acceptance criteria.
- **AD-22** GitHub, Vercel previews, two Supabase projects in the EU (dev, prod), SQL migrations in the repository.
- **AD-23** All writes go through the application server; the browser never writes to the database. Permissions, change log and validation live there.
- **AD-24** Canvas engine: **React Flow, with named workarounds** (closed 3 October 2026 after the spike and its follow-up; report in `spikes/canvas-react-flow/REPORT.md`). Rules for the canvas: (1) detail by zoom level, below 40% cards draw the header plus a plain block and lines lose their end dots; (2) no React Flow handle per row, row positions are computed from data; (3) all mapping lines in one SVG layer that reads node positions from React Flow's store; (4) the report's CSS rules: no opacity on repeated elements, no dotted background, `will-change` as in setup B; no `overflow: hidden` on repeated card elements unless the text may not fit. With these, all eight must-haves pass (pan and zoom 58–60 fps). Still open for slice 1, as its acceptance criteria: card resize (C-09) and hover delay (C-10), approach: switch `will-change` off during a resize drag, draw highlights in the overlay layer instead of restyling cards; row-hover dots in the overlay; clicking a card below 40% zoom; a measurement on a newer machine. Slice 1b met C-09 and C-10 only partly on the development laptop, so the Supabase slice measures S1A-14, C-09 and C-10 in a production build, if possible also on a newer machine, and if they still miss, draws the mapping lines on an HTML canvas instead of SVG (the line layer is already isolated).
- **AD-29** Order of work: slices 0 and 1 run on a local data adapter (a JSON file on the server, development only) with a development sign-in (pick a test user). The adapter follows the same rules as the real one: record versions, change log, permissions. Supabase (real sign-in, adapter, migrations, environments) is its own slice right after slice 1, before anything about several people working together. AD-04 and AD-22 still apply.
- **AD-25** Work slice by slice: PRD → implementation → end-to-end tests → Łukasz accepts → next slice. The prototype defines behaviour; new ideas go to the backlog, not into the code.
- **AD-30** Slice 1 is split: 1a makes the model visible (CI, model in domain and data, demo data, the React Flow canvas with cards and lines, editing in the panels); 1b brings modeling on the canvas (dragging mappings with the D-48 choice, drawing relationships, creating and deleting on the canvas, attribute order, card width and hover highlight C-09 and C-10, undo). Undo is in 1b. The rich-text editor (D-42) comes with requirements; until then definitions are plain text stored in the `*_html` and `*_text` columns.
