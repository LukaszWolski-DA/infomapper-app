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
- **D-03** The canvas is unbounded; the minimap is called “Overview”. The Overview's miniature also draws the visible notes in their paper colour, under the cards.
- **D-36** Attribute order belongs to the model (same on every canvas). Ctrl/Alt + ↑/↓ moves an attribute, Shift to top/bottom; drag in the entity panel. Source columns keep their physical order.
- **D-37** Card width (200–600 px) belongs to the canvas. Long names are truncated in the middle, keeping the part after the last underscore (`customer_addr…_line2`).
- **D-46** New entities: Entity tool (E) and toolbox on the canvas; “+” per concept in the left panel; “New concept”. The concept comes from the concept frame clicked into, else the last used. Duplicate names warn, do not block.
- **D-48** Dragging a column onto an attribute without mappings creates a direct mapping. If the attribute already has a mapping, a choice appears: “Separate mapping (alternative source)” or “Add to mapping …”, pre-selected by a hint (same table: add; other system: separate). Enter confirms, Esc cancels.
- **D-49** A combined mapping: input lines meet in an ƒ node next to the attribute, one line continues; its status colours all its lines. The mapping panel has an Inputs section (order, add, remove); more than one input requires a rule, into which columns are inserted by click. Actions “Split into separate mappings” and “Merge mappings”. The attribute panel shows one row per mapping.
- **D-50** A combined mapping may use columns from different source systems; in Data Vault 2.0 mode the hints warn that it mixes systems (suggest a business rule in a later layer).
- **D-51** Changing an approved mapping's inputs, kind or rule sends it back to review and clears the approval; approval belongs to a version of the mapping. Changing only the note keeps the status.
- **D-52** A row's right-click menu shows only that row's actions; card actions are only in the card header's menu, so deleting an attribute can't be mistaken for deleting its entity.
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
- **D-10** A live label canvas shows only labeled elements, with context cards for partly labeled ones. A label has at most one live canvas. Opening it makes a canvas named after the label in the current project, its elements arranged into frames by concept and system; elements that become labeled later land to the right of the content (no “Newly labeled” frame yet). Deleting the label turns its live canvas into a normal canvas in the same undo step; Duplicate layout of a live canvas gives a normal canvas.
- **D-11** Adding or removing a card on a live canvas changes the label, always after confirmation. Adding a card there labels its element in the same undo step (the Entity tool without a question); removing one takes the label off the element, or off the rows and mappings that bring it there when it is a context card. Bulk adds and removing several cards are not offered. Owners, admins and modelers do this; reviewers and readers see a live canvas read-only.
- **D-20** Notes belong to the canvas and the working layer. Free notes join the frame they are dropped in; pinned notes follow their card or frame with a dashed tether. Duplicate layout copies no notes. A note joins a frame only when dropped in it (drawing, resizing or fitting a frame never moves or claims notes). A note whose card or frame leaves the canvas stays as a free note at its place, in no frame.
- **D-21** Notes are open or resolved; resolved ones can be hidden, a preference kept per person in their browser only (not on the server, not an undo step); an empty new note disappears. Every note change is one undo step; anyone who may write notes edits any note, and its panel names who wrote it.
- **D-24** Labels extend to mappings, tables and columns; the active context comes after that, as an option. Merging mappings keeps the labels of the merged ones on the mapping that stays.
- **D-25** Live canvases include tables (fully labeled ones whole, others as context) and fade unlabeled mappings. Context cards have a dashed outline, a light header and “context only”, and show their relevant rows (the Labeled filter); relevant rows are bold; mappings without the label are faded by colour, never opacity.
- **D-26** An active working context labels every model change (entities, attributes, mappings; relationships through their entities), not layout changes, in the same undo step. It stays on after reload until switched off. The context is a per-person, per-workspace preference in the browser, sent with every write; the server checks it (the label exists, the person may change labels) and records it on every change event of the group. Only owners, admins and modelers have the switch. Moving an attribute labels only the moved attribute. Deletions are not labeled; source tables, columns and concepts are not labeled by the context. A change the context would label is refused when its label is gone, and the browser switches the context off; undo and redo never label.
- **D-53** A count of notes (a card's header, a collapsed frame's block) shows the notes you would see: open ones, and resolved ones while they are shown. Notes take part in the selection: a lassoed frame stands for its free notes, Ctrl+A takes the free notes outside frames, and a pinned note moves with its card or frame, never twice.

### Projects and navigation
- **D-27** One shared model per workspace; projects organise canvases and context. Isolation between clients comes from workspaces.
- **D-28** A canvas can belong to several projects. Removing a shared canvas only takes it out of the current project; deleting a project deletes only canvases no other project uses.
- **D-29** Opening a project shows its home screen: canvas tiles with thumbnails, stats, labels (pinnable), open notes, requirements. Pinning a label to a project is saved with its change event but is not an undo step (no undo outside canvases yet). Roles without label rights see a pinned label's plain ★, not the pin control.
- **D-35** Left panel groups fold (count, sticky headers, remembered, search opens matches); “Only on this canvas”. Inspector sections fold (remembered per title); page actions always visible; lists over 20 items get a filter and “Show all”.
- **D-38** Navigation history covers workspace, project, canvas, home screens and selection (not panning): Alt+←/→, mouse back/forward, clickable breadcrumbs.
- **D-39** A view-state bar shows everything that hides or fades items (lens, Focus, layer, filters, collapsed cards and frames, hidden notes, active tool), each removable, plus “Show all”. A live canvas's “Live: {name}” chip and its Labeled filter (not counted as filtered, kept by “Show all”) belong to the view-state bar.

### Requirements and content
- **D-30** One requirements layer with kinds: business need, data requirement, business rule, data-quality rule, non-functional. Requirements can be broken down (parent).
- **D-31** Coverage is computed from a requirement's items. A linked entity is one item, a linked attribute is one, and a linked mapping makes its attribute one. Links to tables and columns are in scope but are not items, and nothing is pulled in implicitly: an entity link does not bring its attributes. An attribute item is covered when it has an approved mapping without a type conflict. An entity item is covered when at least one of its attributes is covered that way. A requirement is covered when it has at least one item and all of them are covered. Coverage reads “{m} of {n} covered”, its tooltip naming the parts (“1 entity, 3 attributes”). (Changed in slice 4b-1.)
- **D-32** On the canvas: requirement markers on entity and table cards (a violet diamond and the number of requirements the card's panel lists, the list as its tooltip). Selecting a requirement colours its scope without fading anything: attribute items' rows blue when covered and orange when a gap, entity items' headers the same way, linked columns' rows and linked tables' headers blue, and linked mappings' lines drawn lit. Below 40 % a card's summary (orange when any of its items in scope is a gap) stands for its rows, as a dot at the header's right end. In a collapsed frame's block, the member's row carries the same dot. Fading the rest is always Focus (D-22), also for a requirement. (Changed in slice 4b-1.) (Requirement cards with dashed trace lines: slice 4b-2.)
- **D-33** Labels and requirements are separate; a requirement has an external reference; a label can be promoted to a requirement (later).
- **D-34** Element panels list each requirement once: direct ones first, with × to unlink, then indirect ones, without ×. An entity's come via its attributes (“via attribute”) or via mappings onto them (“via mapping”); an attribute's via mappings onto it (“via mapping”); a table's via its columns (“via column”) or via mappings that read them (“via mapping”). Mappings and columns show their own only. There is no “via entity”. Clicking a requirement opens its panel. (Changed in slice 4b-1.) (Placing requirement cards from panels and “Add all”: slice 4b-2.)
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
- **AD-05** Five roles per workspace: owner, admin, modeler, reviewer (read, comment, notes, approve), reader. Reviewers write, resolve, move, pin and delete any note as modelers do; working labels are changed by owners, admins and modelers only; readers read notes and labels. Reviewers change a requirement's status only.
- **AD-06** Four-eyes approval (the author cannot approve their own change) is a workspace setting, off by default. Every approval is logged. For requirements, setting Agreed is the approval; the author is whoever last changed its content (kind, name, description, expression, severity).
- **AD-07** After sign-in the user lands on the workspace home. The top bar shows Organization / Workspace / Project.
- **AD-08** Optional Data Vault 2.0 mode per workspace: hints only (hub, business key, satellites by source), nothing enforced.
- **AD-09** Workspace lifecycle: create (empty or copy), archive (read-only), transfer to another organization, delete (owner only, after export).

### Data (see `docs/data-model-v2.md`)
- **AD-10** Table groups as in the data model; every model and work table has `workspace_id`.
- **AD-11** UUID v7 ids generated by the application; human keys (`REQ-104`) per workspace.
- **AD-12** Every row has `version`, `created_at/by`, `updated_at/by`, `deleted_at` (soft delete).
- **AD-13** Append-only `change_event` log with before/after images and the active context label; one user action = one change group = one undo step. A change group's change events carry the active working context's label (`context_label_id`).
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
- **AD-24** Canvas engine: **React Flow, with named workarounds** (closed 3 October 2026 after the spike and its follow-up; report in `spikes/canvas-react-flow/REPORT.md`). Rules for the canvas: (1) detail by zoom level, below 40% cards draw the header plus a plain block and lines lose their end dots; (2) no React Flow handle per row, row positions are computed from data; (3) all mapping lines in one SVG layer that reads node positions from React Flow's store; (4) the report's CSS rules: no opacity on repeated elements, no React Flow `<Background>` component (a grid is one CSS background on its own element behind the canvas pane, and must pass the pan-and-zoom regression check; slice 2a), `will-change` as in setup B; no `overflow: hidden` on repeated card elements unless the text may not fit; zoom-dependent CSS variables are set only on the elements that use them, never on the canvas root (a variable on the root restyles every card on each zoom step; found in slice 2b, S2B-14). With these, all eight must-haves pass (pan and zoom 58–60 fps). Still open for slice 1, as its acceptance criteria: card resize (C-09) and hover delay (C-10), approach: switch `will-change` off during a resize drag, draw highlights in the overlay layer instead of restyling cards; row-hover dots in the overlay; clicking a card below 40% zoom. Slice 1b met C-09 and C-10 only partly. **Reference machine** (slice 2p, 8 October 2026): performance is judged on the development laptop (i7-8550U, Intel UHD 620, 1536 × 864) in the production measuring build (AD-31), A/B against the previous slice in the same sitting; there is no newer machine to measure on. **The HTML canvas line layer was tried in slice 2p and loses pan and zoom on the reference machine** (about 21–28 fps against about 55 with SVG): its script takes about 3 ms per frame, but the GPU rasterises 340 antialiased, partly dashed curves on every frame, while the SVG layer is rasterised once and moved by the compositor (tag `perf/canvas-lines-trial`, `docs/prd/slice-02p-acceptance.md`). It is no longer the planned next step; the lines stay in one SVG layer (rule 3). **Overlay and fading** (slice 4p, 15 October 2026): the hover highlight, the row marks, the selection marks and the lasso are drawn in one overlay above the cards on its own compositing layer (`will-change: transform`), so they repaint only that layer and not the canvas layer (C-10 120 → 19 ms); the hovered lines are drawn there too, above the cards. Fading (Focus, the requirement lens) is one veil in the canvas layer above the cards, in the canvas background's colour; the lit cards and the notes pinned to them are lifted above it by one stylesheet rule (`z-index … !important`), never by the nodes' own z-index or a canvas re-render; the lit lines and the lens's row colours are drawn again in the overlay. Rejected with figures (`docs/prd/slice-04p-acceptance.md`): a veil with holes on its own compositing layer (tag `perf/4p-trial-f4`: pan and zoom −8.4 to −11.6 % at 30 %, +55 MiB of tiles), and a veil below the cards that fades the other lines on a hover (in `perf/4p-trial-a`: C-10 228–247 ms).
- **AD-29** Order of work: slices 0 and 1 run on a local data adapter (a JSON file on the server, development only) with a development sign-in (pick a test user). The adapter follows the same rules as the real one: record versions, change log, permissions. Supabase (real sign-in, adapter, migrations, environments) is its own slice right after slice 1, before anything about several people working together. AD-04 and AD-22 still apply. (Order changed by AD-31: the database comes last.)
- **AD-25** Work slice by slice: PRD → implementation → end-to-end tests → Łukasz accepts → next slice. The prototype defines behaviour; new ideas go to the backlog, not into the code.
- **AD-30** Slice 1 is split: 1a makes the model visible (CI, model in domain and data, demo data, the React Flow canvas with cards and lines, editing in the panels); 1b brings modeling on the canvas (dragging mappings with the D-48 choice, drawing relationships, creating and deleting on the canvas, attribute order, card width and hover highlight C-09 and C-10, undo). Undo is in 1b. The rich-text editor (D-42) comes with requirements; until then definitions are plain text stored in the `*_html` and `*_text` columns.
- **AD-31** The database comes last. Supabase, real sign-in and environments arrive when the application's features are close to the prototype; until then every slice runs on the local adapter. Safeguards: every slice that changes the model updates docs/data-model-v2.md and the SQL migrations, and CI applies the migrations to a real Postgres and compares the schema with the domain types. Production-build measurements (S1A-14, C-09, C-10) wait; a local production build only for measuring may be considered if performance gets in the way.
  A measurement-only production build may run on the local adapter: it starts only with INFOMAPPER_MEASURE=1, listens on localhost only, and a normal production build still refuses the local adapter and the development sign-in (AD-29).
