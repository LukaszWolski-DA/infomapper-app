# Slice 25 – acceptance

PRD: [`slice-25-infodocumenter-documents.md`](slice-25-infodocumenter-documents.md). Branch
`slice/25-infodocumenter-documents`.

## Step 1: the PRD checked against the code (11 November 2026)

### The starting point

- **The branch.** `slice/25-infodocumenter-documents` was cut from `main` at `e987f82` (the merge of PR 56,
  `fix/seed-large-module-tables`), which is after tag `slice-24`.
- **No run in this step.** No dev server, e2e run, unit test, lint, typecheck or bench ran. `.data/dev-db.json` and the
  KB backups were not read or written.
- **The two files from Łukasz's Downloads.** Each was checked with `cmp` after the copy and with `sha256sum` against the
  prompt's value, then committed with this document:

  | File | Bytes | SHA-256 | `cmp` |
  | --- | --- | --- | --- |
  | `docs/prd/slice-25-infodocumenter-documents.md` (new) | 24,327 | `4eb3d8f93ee0c72172a850f8d595b53ce45397d3d0f88ea0eb71a934c96283e8` | equal |
  | `docs/prototype/infomapper-prototype-with-sources.html` (replaces slice 24's `190d9ea9…`, 745,060 bytes) | 950,304 | `f58ec6bb117cc910882ec4bffa6eb253482807f31d23cc82c650c061d622fa19` | equal |

  **The prototype's file name in Downloads.** Downloads has two files of interest:
  - `infomapper-prototype-with-sources.html` is slice 24's file (745,060 bytes, `190d9ea9…`), the same as the
    repository's.
  - The file with the prompt's size and SHA-256 is **`infomapper-prototype-with-sources (1).html`**: the browser's name
    for a second download of the same name.

  The second file was copied. Its checksum identifies it, so nothing is in doubt, but the name differs from the
  prompt's.
- **The prototype is built on slice 24's.** It has 13 `diff` hunks against `HEAD`'s file (+1,690 lines, −6), and every
  one is on the PRD's list (section 4):
  - the head: IBM Plex Serif (400, 500, 400 italic) from Google Fonts, and Paged.js 0.4.3 from jsDelivr;
  - the CSS block "InfoDocumenter (module)", with its iterations 2 to 9 and its print CSS;
  - the canvas's page outline (`DOC.pageArea()` in `renderCards`, `DOC.pageCtl` in the Overview): later;
  - the workspace home:
    - the Documentation tab after Overview, shown while `DOC.on()`, and the fallback to Overview while it is off;
    - the tab's body;
    - "New document from it" on a baseline, which replaces "Mapping specification" and "Data dictionary";
    - InfoDocumenter's box after InfoCube's, before "Process";
    - the click and change hooks;
  - `CONV`'s exports: `bName`, `def` (`clsDef`), `naming`, `removed`, `clsList`;
  - the `DOC` module (`MODULES.docSections`, the presets, `LBL` with the German labels, the rights, the tab, the editor,
    the renderer, `DOC_IC`).

  Nothing else differs. Two side notes, neither of which reaches the app:
  - The old baseline handlers (`docFromBaseline`, `data-bl="map"`/`"dict"`) stay in the file as dead code.
  - The header comment says "prototype iteration 1", but the module runs to iteration 9.

### Summary

The PRD's shape holds: a module, a table outside undo, a switch and a licence as InfoCube's, pure builders and an HTML
renderer. InfoCube built most of the patterns it reuses:
- the table registry already takes a module table "outside undo" (`ModuleTableClass`);
- the schema check already maps object-typed columns to `jsonb`;
- `scripts/licence.ts` already reads `LICENSED_MODULES`;
- every index and rule the sections need is pure (`stereotypeIndex`, `classificationIndex`, `derivationIndex`,
  `countsAsMapped`, `lookupModel`, `buildRequirementIndex`, `checkMappingTypes`, `cubeIndex`, `historyLabel`,
  `unknownValueOf`, `projectScope`, …).

There are 34 findings below. Five of them change the slice's cost:

1. **F1, one consistent read.** The baseline check of 11 November holds. `store.model.load`'s live filter, sort orders
   and `lostOriginals` sit in the local adapter (`src/data/local/store.ts` 184–211, 60–74). A document needs, on top of
   that, InfoCube's six tables, the requirements and their links, the project canvases' cards and the people's names.
   Today that takes 1 + 6 + n separate store reads, and each one may see a different file. The fix needs a new store
   method and a pure model builder that both the store and the method use: shared infrastructure (the local adapter).
2. **F8, the extension point is larger than the PRD says.**
   - Modules may not import each other (`noOtherModuleParts`, `eslint.config.mjs`), so the content tree's node types and
     the section contract cannot live in InfoDocumenter's domain, as Q6 assumes. They must sit in InfoMapper's domain,
     as `AttributeFeeds` and `ModuleView` do.
   - The data dictionary also needs InfoCube's per-entity role and per-attribute feed (two more contributions).
   - The workspace home needs a module tab, a second new point.
3. **F14, rights.**
   - Modules cannot add permission actions (`WORKSPACE_ACTIONS` is a closed union, `src/domain/permissions.ts`).
   - `workspace.view`, the only action every role has, is allowed in an archived workspace.
   - Guests exist in the seed: Kasia, the demo's only reader in "Retail Co – DWH", is a guest (a Retail Co member in an
     InfoMate workspace), and so is Łukasz in "Sales analytics". S25-02's reader therefore cannot print, and its "guests
     cannot be invited yet" is wrong.
   - A Print button cannot stop the browser's own print.
4. **F4 and F5, the data.**
   - `workspace.infodoc` is a core column, so it needs **the local file's format 17** (as `infocube` needed format 12).
     KB's file is upgraded only on Łukasz's command.
   - Three `jsonb` columns contradict AD-18 ("Only three places use JSON"), which the PRD's section 8 does not amend.
5. **F33, the plan.** Step 2 changes the local adapter (F1), the local file's format (F4) and undo's first module table
   outside undo (F3), so **step 2 has a full run**. Steps 2 and 3 should **not** merge: the content tree has four
   sections in three languages plus InfoCube's section through the new point.

### Findings

**Data and the store (Q1, Q2)**

- **F1. One consistent read of the model state (Q6, Q8; the baseline check confirmed).**
  - Where things are computed today:
    - `store.model.load` (`src/data/local/store.ts` 184–211) filters live rows (`live`, line 19) and sorts in the data
      layer:
      - concepts by `sort_order`, then name;
      - entities by name;
      - attributes by entity, then `sort_order`;
      - systems and tables by name;
      - columns by `ordinal`;
      - inputs by `sort_order`.
    - `classifications` and `stereotypes` keep their removed rows.
    - `lostOriginals` is a closure in the store (60–74).
  - No pure domain function builds a `WorkspaceModel` from rows. `scripts/lib/checks-model.ts` `modelOf` is a partial
    copy: it does not sort, and it returns no classifications or stereotypes.
  - Module rows come one table at a time (`store.modules.list`, 146–151). Each call is a separate `load()`
    (`readDbCached` checks the file's stamp each time), so a write in between gives a document whose mapping points to
    an attribute it does not have.
  - The canvas page reads in two batches: `model.load`, then `moduleView`'s six lists (`src/compose/view.ts` 53–63).
    The project home reads through two different store instances (`getDataStore()` and `moduleHomeData`'s
    `getDataStore(STORE_SCHEMA)`).
  - **Proposal:**
    - (a) A pure `workspaceModelOf(rows, workspaceId)` in `src/domain/model/` holds the live filter, the sort orders and
      `lostOriginals`. The store's `model.load` calls it, so there is one rule.
    - (b) A new store method `snapshot(workspaceId, moduleTables)` reads the file once and returns:
      - the model through (a);
      - requirements and links;
      - projects, project-canvas links and canvas items;
      - workspace members with their display names;
      - the named module tables, through `readRows`, so their defaults and upgrades apply.

    The documents' page and the tab use (b). Nothing else changes in this slice. The later baselines slice would freeze
    the same snapshot. This changes the local adapter (shared infrastructure): a full run in step 2.
- **F2. The table `document_definition`: what the registry needs.**
  - `INFODOC_UNDO = { document_definition: "outside undo" }` in the module's `domain/tables.ts`, and
    `INFODOC_RULES` / `InfoDocDb` in its `data/tables.ts`. Both are spread into `src/compose/tables.ts`, and
    `ComposedDb extends DevDb, InfoCubeDb, InfoDocDb`. `MODULE_TABLES_IN_FILE` and the `Record<ModuleTable, …>` types
    make the build fail if one is missing.
  - `TableRules`:
    - foreign keys `workspace_id → workspace` and the author → `app_user`;
    - checks: name not empty after trimming, `preset` one of three values, `source_kind` one of two, and
      `source_kind = 'live'` while baselines do not exist (F6).
  - The local file's format: none. A module's table appears with its first row (AD-33, `schema.ts` 102 and 209–217).
  - The migration `create table document_definition …`, with `alter table … enable row level security;` and an index on
    `(workspace_id) where deleted_at is null`.
  - `tests/table-registry.test.ts` then checks it against the migrations with no change of its own. Proposal: add an
    assertion that `document_definition` is in `UNDO_TABLES.outside`.
- **F3. Outside undo for a module table works, but nothing has used it yet.**
  - `undoTables` (`src/domain/commands/undo.ts` 224–253) puts an `"outside undo"` table into `outside`, and `isUndoable`
    then records no step for a group that writes it (`remember`, `run-command.ts` 254–260).
  - `loadForUndo` reads only `STORE_SCHEMA.undoable`, so undo never loads the documents.
  - Every write still gets its `change_event` (`buildWriteSet`, `src/domain/changes.ts` 115–133), as AD-13 asks.
  - Undo and the registry are shared infrastructure, so step 2 has a full run. Proposal: a unit test that a document
    save leaves the person's undo history as it was, and that an undo after it reverts the step before it (S25-03's
    "Undo does not touch documents").
- **F4. `workspace.infodoc` needs the local file's format 17 (Q1).**
  - `workspace` is a core table. `infocube` came with format 12 (`file.ts` 174–177, `w.infocube ??= false`) and
    `naming_conventions` with format 15 (191–198).
  - Proposal:
    - `DEV_DB_FORMAT = 17` with an inline `w.infodoc ??= false`, and `upgrade-17.test.ts`;
    - the migration `alter table workspace add column infodoc boolean not null default false;`;
    - `Workspace.infodoc` in `src/domain/types.ts`;
    - `ShellData.workspace` gets `infodoc`, as it has `infocube` (`src/app/_lib/shell.ts`).
  - **KB:** the upgrade happens when a server of this branch opens his file. Per CLAUDE.md (since 10 November 2026) that
    is only on Łukasz's command, after the backup. Before step 2's commit, check that no dev server of his serves this
    checkout (slice 24, step 3).
  - **Alternative (not recommended):** a one-row module table `infodoc_setting`, which needs no format. It would break
    AD-35's pattern (the switch on `workspace`) and the shell's flags.
- **F5. `jsonb` for `scope`, `cover` and `sections` contradicts AD-18 (Q2).**
  - `data-model-v2.md` §2: "Only three places use JSON: `canvas.look`, `baseline.snapshot` and the before/after images
    in `change_event`. Everything that is queried, filtered or joined is a real column." The PRD's section 8 has no
    AD-18 change.
  - The machinery fits:
    - the schema check maps an object-typed column to `jsonb` (`tests/schema/domain-tables.ts` 87,
      `compare-schema.ts` 28);
    - the local adapter stores any JSON value and checks nothing inside it, as for `canvas.look`;
    - RLS is per table.
  - The recipe is read and written whole and never queried, filtered or joined.
  - **Proposal (a), recommended:** keep the three `jsonb` columns, validated by the module's Zod schemas on every
    command (the boundary), and add to AD-18 and §2 "…and InfoDocumenter's document recipe (`document_definition.scope`,
    `cover`, `sections`), read and written whole". The cost: ids inside `scope` (projects, concepts) have no foreign key;
    see F7 and Q10.
  - **Proposal (b):** `cover` as five text columns, `scope`'s levels and mapping filter as columns, projects and concepts
    as two link tables, and sections as rows with an options `jsonb`. That is more tables, more registry entries, more
    writes per save, and still `jsonb` for the options.
- **F6. `source_kind` and `baseline_id` before baselines exist.**
  - The `baseline` table exists in SQL (`initial_schema.sql` 593), but it is on `NOT_IN_DOMAIN_YET`
    (`tests/schema/compare-schema.ts` 106), so the local adapter has no such table to point a key to.
  - Proposal:
    - in SQL, `baseline_id` with a foreign key to `baseline` and a CHECK
      `(source_kind = 'live') = (baseline_id is null)`;
    - in the local adapter, no foreign key, and a check that refuses `baseline` in this slice;
    - in the domain, Zod accepts `live` only.

    The baselines slice lifts the refusal. Listed in `known-limitations.md`.
- **F7. References inside the recipe.**
  - `scope.projects` and `scope.concepts` hold ids. A project's or a concept's delete (an undo step) leaves the ids
    there, and an undo brings the project back, so the scope is right again.
  - Proposal: the builder ignores ids that are not live, and the form lists only live projects and concepts. No
    cascade, no `moduleCascade` registration (the table points only to `workspace` and `app_user`).

**The extension point and the module's place (Q1, Q5)**

- **F8. Where the content tree and the section contract live.**
  - A module part may import InfoMapper's layers and itself only (`modulePolicies`, `noOtherModuleParts`,
    `eslint.config.mjs` 22–47). InfoCube's `cube.dim` section therefore cannot build InfoDocumenter's nodes if their
    types are in `src/modules/infodocumenter/domain`.
  - Proposal:
    - **The content tree's vocabulary and the section contract go in InfoMapper's domain:** `src/domain/document/`, with
      the node types and `DocumentSectionType`. The precedents are `AttributeFeeds` (`src/domain/model/requirements.ts`)
      and `ModuleView` (`src/ui/modules.ts`).
    - InfoDocumenter's domain keeps its own sections (text, dictionary, source-to-target), the presets, the rights, the
      labels and the commands.
    - InfoCube's domain implements `cube.dim`.
    - `src/compose/documents.ts` joins them (`DOCUMENT_SECTIONS`).
  - The contract:
    ```
    DocumentSectionType {
      type: "cube.dim"
      module: "infocube"
      tables: ModuleTable[]
      available(workspace)
      defaults()
      options (a Zod schema)
      label(language)
      build({ model, rows, scope, options, language }): DocNode[]
    }
    ```
    `build` is pure. It gets the snapshot's rows for `tables` (F1), never a store.
  - Lint: `src/domain/document/` is InfoMapper's domain, already covered. New probes in `tests/layer-rules.test.ts`:
    InfoCube's domain refuses `@/modules/infodocumenter/...`, the reverse is refused too, and `src/domain` refuses both
    modules. The existing probes name `infocube` only.
- **F9. The data dictionary needs two contributions besides the section type.**
  - PRD: "Dimensional entities appear … with their InfoCube role instead of a stereotype". In the prototype, a
    dimensional attribute's "Mapped from" shows its feed, and "mapping coverage" of a fact or a dimension counts its fed
    rows (D-69).
  - InfoDocumenter cannot ask InfoCube. Proposal: the contract adds
    `entityFacts({ rows, language }): { role(entityId), feedOf(attributeId) }` and the requirement feeds. These already
    exist as pure functions:
    - `cubeRequirementFeeds` (`src/modules/infocube/domain/mappings.ts` 884);
    - the row feeds that `moduleFeeds` builds (`src/compose/view.ts` 132–141);
    - `cubeTitle` (`src/modules/infocube/domain/view.ts` 75).
  - The requirements column and the coverage line then pass the feeds to `buildRequirementIndex` and `countsAsMapped`,
    as CLAUDE.md requires ("a later caller of the requirement index passes the feeds").
- **F10. The workspace home has no module point; the Documentation tab needs one.**
  - `TABS` is static (`src/app/w/[workspaceId]/page.tsx` 28), and `?tab=` falls back to Overview for anything else
    (33–35). `ModuleView.tabs` is the canvas's left panel.
  - Proposal: `homeTabs(store, access, session)` in `src/compose/home.tsx` returns
    `{ id, label, count, body }[]`, placed after Overview as the prototype does. The page accepts their ids in `?tab=`.
    While InfoDocumenter is off, `?tab=docs` falls back to Overview, as in the prototype.
  - This is a third extension point for CLAUDE.md's list (after sections and contributions).
- **F11. The settings boxes.**
  - `settingsBoxes` (`src/compose/settings.tsx`) returns one `<InfoCubeBox>`, rendered in the Methodology box after
    "Data Vault 2.0 mode" and before "Process" (`settings-form.tsx` 175).
  - Proposal: it returns both boxes in a fragment, InfoDocumenter's after InfoCube's. That matches the prototype and the
    PRD ("below InfoCube's").
- **F12. The switch is InfoCube-specific in InfoMapper's core.**
  - `updateWorkspaceSettings` (`src/domain/commands/workspace.ts` 173–209) takes `InfoCubeSwitchState`. The licence
    test `l.module === "infocube"` is written in `src/app/_actions/workspace.ts` 27–39 and in
    `src/compose/settings.tsx` 15. The texts are in `src/domain/model/levels.ts` 17–23.
  - Proposal:
    - generalise the argument to `Partial<Record<LicensedModule, { licensed; organizationName; offRefusal: string | null }>>`
      and `infodoc` in the input;
    - turning it off is always allowed, so its `offRefusal` is null;
    - turning it on without the licence is refused with "{organization} has no InfoDocumenter licence." (PRD S25-01);
    - the adapter's C-7 recount (`offWithDimensional`, `store.ts` 360–372) stays InfoCube's.
  - `LICENSED_MODULES` gets `infodoc` (`src/domain/types.ts` 61), and a migration drops and re-adds
    `organization_licence_module_ck`. `scripts/licence.ts` then takes `infodoc` with no change but its usage text.
- **F13. While it is off, AD-35's "nothing creates or brings back one of its objects".**
  - The PRD says what turning off keeps, not what refuses.
  - Proposal: every document command (create, save, share, duplicate, delete) refuses while `workspace.infodoc` is false:
    "InfoDocumenter is off in this workspace." The document's pages answer "not found" for it.
  - No adapter recount is needed: a save that lands just after the switch went off keeps a hidden row hidden, and a
    later "on" shows it.

**Rights (Q3)**

- **F14. Modules cannot add permission actions, and `workspace.view` passes in an archived workspace.**
  - `WORKSPACE_ACTIONS` and `ROLE_PERMISSIONS` are closed (`src/domain/permissions.ts` 8–64). InfoCube reuses
    `model.edit` and `mapping.set_status`.
  - `ALLOWED_WHEN_ARCHIVED = {workspace.view, workspace.unarchive}` (67). So a command that only checks `workspace.view`
    would write in an archived workspace.
  - The PRD's proposal names four `document.*` actions in InfoMapper's core, which AD-33's "InfoMapper's code never
    names a module" argues against.
  - **Proposal (b), recommended:**
    - **One generic core action `module.own_objects`** ("a member's own objects outside the model", every role, not in an
      archived workspace) carries AD-05's addition.
    - The module's pure rights (`src/modules/infodocumenter/domain/rights.ts`) decide the rest from it, from
      `can(access, "model.edit")` (owners, admins and modelers: share, change a shared document) and from the role
      (owners and admins delete any shared one), with the author's own rights on top:

      | Action | Rule |
      | --- | --- |
      | create, duplicate | `module.own_objects` |
      | change a private one | its author, with `module.own_objects` |
      | share, unshare | `model.edit`, and the document is shared or the author's |
      | change a shared one | `model.edit` |
      | delete a shared one | owner, admin or its author, with `module.own_objects` |
      | delete a private one | its author |
      | open | shared, or its author |
      | print | not a guest (F16) |

    - Unit tests cover every role × shared or private × author or not × archived × guest.
  - Proposal (a), the PRD's: four core actions. That is simpler to read, but it names the module in the core.
- **F15. Ownership is a new kind of rule.**
  - No command checks "author only" today. Notes have no author rule, and `created_by` is read only as four-eyes'
    fallback (`mapping-rules.ts` 50–62).
  - A document's author is not `created_by`: Duplicate makes the person who duplicates it the author, and a later
    workspace copy may keep an author who did not create the row. Proposal: a column `author_id` (FK `app_user`), not
    the PRD's `owner_id`, which reads as the Owner role in every text and test ("owner" is a role, AD-05).
  - Private documents never reach another person's browser: the tab's loader and the pages filter on the server, as
    `workspacePeople` does (F10, slice 8). A private document of someone else's answers "not found", never "forbidden",
    so its existence is not told.
- **F16. Guests and print.**
  - Guests exist (`isGuest`, `permissions.ts` 161–168: a member with no `organization_member` row in the workspace's
    organization). In the seed:
    - **Kasia, the reader of "Retail Co – DWH", is a guest** (a Retail Co member, `seed.ts` 131 and 143);
    - **Łukasz is a guest reviewer in "Sales analytics"** (Retail Co, 199).
  - So S25-02's "a reader … opens and prints the shared one" fails with the seed's only reader, and "Domain tests cover a
    guest … since guests cannot be invited yet" is wrong: the e2e can use Kasia.
  - A Print button cannot stop the browser's own print (Ctrl+P). Proposal:
    - guests have the document page without Print;
    - for a guest, the page's `@media print` shows one line instead of the pages: "Guests cannot print documents in this
      workspace.";
    - S25-02 checks it with `page.emulateMedia({ media: "print" })`;
    - S25-02's printing reader is a reader who is an InfoMate member, added as test data (`addPerson`), and Kasia is the
      guest.
- **F17. Edge cases the PRD leaves open.**
  - (a) **An author no longer in the workspace.** Removing a person keeps their documents. Their private ones are seen by
    nobody, and their shared ones stay shared. Unsharing one would hide it from everyone. Proposal: unsharing refuses
    while the author is not a member ("{author} is no longer a member of this workspace, so the document stays
    shared."), and the orphaned private documents go in `known-limitations.md`.
  - (b) **An author whose role went down** (a modeler now a reader) may still delete their shared document (the PRD's
    "or its author"), but cannot change it. Proposal: as the PRD says.
  - (c) **Unsharing by someone who is not the author** makes it the author's private document, and the person who
    unshared it loses sight of it. Proposal: the question says so (the PRD's "asked first"; the prototype asks nothing,
    see D4).
- **F18. Change events hold private content.** Every save writes the whole row, recipe included, twice (before and after,
  `changes.ts` 112). No page lists change events, but a later history or export must filter private documents by
  author. Proposal: a line in `known-limitations.md`; the Text body is limited to 20,000 characters (`plainTextSchema`).

**The form and saving (D-59, D-66)**

- **F19. Saves follow the panels' chain and D-66.**
  - CLAUDE.md: "A new text field that saves a row uses `TextField`, `TextArea` or `useDraft`, returns the save and passes
    the shown version", and "a command takes only the fields that changed".
  - Proposal: one command `updateDocument(id, expectedVersion, patch)`. The patch names fields: name, audience, the five
    cover fields, the scope's projects, concepts, levels and mapping filter, and a section's `on`, heading, body and
    options. The command merges the patch into the stored recipe and checks the row's version.
  - The form saves each field on leaving it through `saveRow`. Text fields get the conflict line and "Not saved"; check
    boxes and selects use `useChoice`.
  - The cost: two people changing two fields of one shared document refuse each other's second save once (one row, one
    version), as two fields of one entity do today.
- **F20. Duplicate, create and delete.**
  - Duplicate: "{name} (copy)", the person as author, private (the prototype).
  - Create from a preset: name = the preset's label, private, the source live, the scope empty, the language the
    workspace's.
  - Delete: soft (`deleted_at`), outside undo. With no Undo, a confirmation is needed (the prototype's dialog; its text
    mentions versions and links: D10).

**Content (Q6, Q7, Q9)**

- **F21. The functions each section reads.** All are pure; none reads a store or the session:

  | Section | Reads |
  | --- | --- |
  | Data dictionary | `projectScope` (`checks.ts` 196); the concept and entity order (F23); `stereotypeIndex` (`stereotypes.ts` 177: `name`, `definition`); `derivationIndex` and `countsAsMapped` (`derivations.ts` 38, 178); `lookupModel` (`requirements.ts` 204: `mappingsOfAttribute`, `inputsOf`, `calculationInputs`); `buildRequirementIndex` with feeds (`requirement-index.ts` 55); `formatAttributeType` (`type-check.ts` 75); `shownHtml`/the `*_text` columns for definitions; InfoCube's contributions (F9) |
  | Source-to-target | `lookupModel` (mappings, inputs, columns, tables, systems); `checkMappingTypes` (`type-check.ts` 162); `formatColumnType`; the requirement index; the mapping filter on `Mapping.status` |
  | Dimensional model | `cubeIndex` (`keys.ts` 93: `factKeys`, `dimensionsOf`, `keyOf`, `unknownOn`/`unknownOf`); `factHints` not printed; `unknownValueOf` (`unknown-member.ts` 24); `historyLabel` (`view.ts` 32); `cubeTitle` (75); `mappingIndex` and `lookupSentence` (`mappings.ts` 108, 243); `aggregateIndex` |
  | Title page | `workspace.name`, `client_name`, `doc_language`; the organization's name |

  The only gaps are `lostOriginals` and the sort orders, which are in the data layer (F1).
- **F22. Classifications have no place in this slice's sections.**
  - The PRD's S25-04 checks that "a renamed classification prints with its new name". In the prototype, classifications
    print only in the "Conventions" and "Classification register" sections (`DOC`, lines ~9675 and ~9773 of the
    prototype), which are later.
  - The dictionary's "Personal data" is the attribute's `is_pii`, not a classification (D-57: "the PII badge belongs to
    attributes"). The source-to-target columns have none either.
  - Proposal: S25-04 checks a renamed stereotype only, and the PRD's "names of … classifications are the workspace's"
    moves to the later sections.
- **F23. Order and levels (Q7).**
  - The Model tab groups by concept in the store's order (`sort_order`, then name), lists logical entities by name and
    attributes by `sort_order` (`src/app/_panels/tree-data.ts` 197–203).
  - Proposal: the dictionary uses the same order and puts dimensional entities after the logical ones of their concept.
    That decides the list's level as CLAUDE.md asks ("a later list or count that reads entities decides its level"):
    - **the dictionary:** both levels by the scope's levels, dimensional ones only while InfoCube is on;
    - **source-to-target:** logical only (a mapping's target is logical, AD-34);
    - **the dimensional model:** dimensional only.
  - Projects: `projectScope` over the union of the chosen projects' canvases (live label canvases included, as their
    items are real rows).
- **F24. Mapping coverage against the mapping filter.**
  - CLAUDE.md (slice 18): "a later count of mapped or fed rows uses them (`rowCounts` or `countsAsMapped`), never a
    mapping count of its own", and those count any status.
  - With "Approved only", the entity's line "{a} of {b} attributes mapped" would then count drafts that the document
    does not show.
  - Proposal: the line counts by the app's rule (any status) whatever the filter, so a document and the app agree, and
    the filter hides rows only. Question Q-L3.
- **F25. InfoCube's words are English only.**
  - `cubeTitle`, `historyLabel` ("SCD 2"), the fact types and the additivity words have no Polish or German. The
    prototype prints them in English in every language.
  - S25-08 asks for every heading and label in the language. Proposal: `cube.dim`'s builder and InfoCube's dictionary
    contribution (F9) take their words from InfoCube's own three-language table (`DOC_WORDS`), next to the app's
    English. Codes stay as they are: "PII", "PK", "FK", "✓". Question Q-L4.
- **F26. Labels (Q9).**
  - The prototype's `LBL` (keys listed under "Every new UI text") goes to `src/modules/infodocumenter/domain/labels.ts`
    as `Record<DocLanguage, Record<LabelKey, string>>`, as `BUILTIN_TEXTS` is (`classifications.ts` 91).
  - The language is `workspace.doc_language` (`src/domain/types.ts` 93), read when the document is opened; changing it
    changes every document's labels.
  - The prototype keeps a language per document (`style.lang`). The PRD fixes it to the workspace's: D7.

**The document page (Q8)**

- **F27. Route, loading and access.**
  - No route renders a page outside the shell today (`src/app/w/[workspaceId]/` has the home, `p/…`, `import`,
    `thumbnail`).
  - Proposal:
    - `src/app/w/[workspaceId]/d/[documentId]/page.tsx` for the form;
    - `…/d/[documentId]/view/page.tsx` for the document;
    - both in `AppShell`, with `@media print` hiding the shell.
  - Each page:
    - calls `loadShell`, checks the rights (F14, F15) and refuses while InfoDocumenter is off (F13);
    - makes one `snapshot` (F1), builds the tree on the server and renders it to HTML;
    - Paged.js lays it out in the browser, in a container React does not render into.

    Private documents and the model never reach the browser as data, only the HTML of the shown document.
  - `loadShell`'s locked-organization redirect rebuilds `next` from `/w/{ws}[/p/…][/c/…]` only (`shell.ts` 76–79). It
    must take `/d/{id}[/view]` too, or a locked person comes back to the home.
  - The proxy's preference cookie (`idsFromPath`, `src/app/_lib/preferences.ts` 37–42) sets the last workspace, which is
    right for these pages.
- **F28. Paged.js is not a dependency; IBM Plex Serif is not hosted.**
  - `package.json` has no `pagedjs`. The prototype loads 0.4.3 from jsDelivr.
  - Proposal: `pagedjs` pinned at exactly `0.4.3` (MIT), imported dynamically in the browser only (it needs
    `document`), never on the server. There is no CSP to change (`next.config.ts` has no headers).
  - `src/app/fonts/ibm-plex/` has Sans (400, 500, 600) and Mono (400, 500), no Serif (P3 B: "no build or start fetches
    fonts"). Proposal: Serif Regular, Medium and Italic as IBM's unmodified WOFF2 files (`@ibm/plex-serif`), their
    checksums in the README, and loaded with `next/font/local` on the document pages only.
  - Paged.js's limits (mixed page sizes, inline SVG) do not matter in this slice: A4 portrait only, no figures.
  - The risk to check early in step 4: Paged.js 0.4.3 dates from 2022 and has a few rough edges with React 19 and
    Next.js 16 styles (it copies the page's stylesheets). Proposal: hand it the document's own CSS only
    (`Previewer.preview(html, [css], container)`).
- **F29. Print.**
  - "Print" opens the view with `?print=1`, which calls `window.print()` after Paged.js's `after` event. "Laying out
    pages…" shows meanwhile (the prototype's text).
  - A4 portrait with `@page { size: A4 portrait }`. Paged.js sets the page margins itself, so Chrome prints no margins
    of its own when its "Margins" setting is Default. The browser's own headers and footers are the person's setting.
  - S25-07 checks the pages' size and count in the DOM (Paged.js's `.pagedjs_page` elements), not a PDF.

**Seed, specs, performance (Q10–Q12)**

- **F30. Copy, transfer, export (Q10).**
  - None is built (no `copyWorkspace` or `transferWorkspace` in `src`). The definitions need, for those slices:
    - `author_id` (F15), kept when the author is a member of the target, else the person copying;
    - private documents of others never copied;
    - the scope's ids remapped with the copied projects and concepts (F7, since `jsonb` has no keys);
    - a transfer's licence check by AD-35, also while the switch is off (the documents go along, hidden).
  - Proposal: nothing more in this slice; these points go in `docs/ideas.md`'s InfoDocumenter entry.
- **F31. Seed and fixtures (Q11).**
  - The plain seed sets `infocube: false` and no licence (`src/data/local/seed.ts` 98). InfoCube's licence and switch
    come with the star (`src/modules/infocube/data/sales-star.ts` 252–288), only for `npm run seed`, `reset-dev-data`,
    `demo` and slice 15a's and later fixtures.
  - Proposal:
    - `addDocumentsDemoData` in `src/compose/seed.ts` gives InfoMate the `infodoc` licence, turns it on in "Retail Co –
      DWH", and seeds the prototype's live documents (F32);
    - it is called by `scripts/seed.ts`, `reset-dev-data.ts` and `demo.ts` after `addFullDemoData`, **not inside
      `addFullDemoData`**, so slice 20's and 22's fixtures and `bench-checks.ts` stay as they are;
    - slice 25's fixtures add it.
  - So no earlier spec sees a Documentation tab. S23-01's exact tab list (`e2e/slice-23/S23-01.spec.ts` 18) stays.
- **F32. The demo's documents.**
  - The prototype seeds "Retail Co – stage 1 documentation" (shared, from a baseline: later), "Order management – S2T for
    the ETL team" (Łukasz's private, scope Order management) and "Anna's working dictionary" (Anna's private).
  - Proposal: the two private ones, plus one shared live dictionary in place of the baseline one ("Retail Co – data
    dictionary", by Łukasz). Question Q-S1.
- **F33. Steps.** See "The plan for steps 2 to 5": step 2 has a full run, and steps 2 and 3 stay apart.
- **F34. Performance (Q12).**
  - No reference time can come from step 1 (no runs).
  - "Performance test" (`src/data/local/large-generator.ts`): 41 entities (40 with 5–25 attributes and one with 200,
    about 800 attributes), 60 source tables and 300 mappings, no InfoCube rows. A full dictionary is roughly 40–70 A4
    pages.
  - Proposal:
    - step 3 adds `scripts/bench-documents.ts` (the pattern of `bench-checks.ts`: one warm-up, nine rounds, median) for
      the snapshot's model, the tree of each section and the HTML, on the demo, "Performance test" and InfoCube's
      synthetic set (`scripts/lib/synthetic-checks.ts`, 1,500 dimensional mappings);
    - step 4 measures Paged.js's layout of the full dictionary in headless Chromium (from navigation to "{n} pages").
  - Both are reference figures. **Question Q-P1:** does Łukasz want a bar? A proposal to decide on: the tree under
    200 ms in Node on "Performance test", and no bar for the layout, which is the browser's and Paged.js's.

### Answers to the PRD's questions

- **Q1. The module.**
  - Five parts in `src/modules/infodocumenter/`, used in this slice:
    - `domain`: types, rows, rights, presets, labels, commands, the three sections;
    - `data`: rules;
    - `ui`: the renderer to HTML, if it has no React state;
    - `app`: actions, the tab, the form, the view, the box.
    - `canvas` is empty.
  - In `src/compose/`: `tables.ts` (F2), `settings.tsx` (F11), `home.tsx` (F10), `documents.ts` (F8), `seed.ts` (F31),
    `styles.ts` if the module has CSS.
  - The switch is `workspace.infodoc` and the licence is `organization_licence.module = 'infodoc'` (F12).
  - The module's table needs no format; `workspace.infodoc` needs format 17 (F4).
  - `eslint.config.mjs` gets `modules = ["infocube", "infodocumenter"]`.
- **Q2. The table.**
  - `jsonb` fits the store and the schema check but needs AD-18 amended (F5).
  - It is outside undo through `"outside undo"` (F3).
  - Every save writes a `change_event` with whole images (F3, F18).
  - The version is the row's own (D-59 as for a project's name), checked in the command and again by the adapter
    (`store.ts` 433–435). `owner_id` becomes `author_id` (F15).
- **Q3. Rights.** One core action `module.own_objects` plus the module's pure rules (F14). The author's rights (F15),
  guests (F16), archived (no write through `ALLOWED_WHEN_ARCHIVED`, open and print allowed), and the edge cases (F17).
- **Q4. Turning off with objects.**
  - AD-35's rule is InfoCube's code: `updateWorkspaceSettings`' `dimensionalEntities` and the adapter's
    `offWithDimensional`. Nothing generic declares that a module's objects are outside the model.
  - Proposal: the switch's per-module state carries `offRefusal` (F12): InfoCube's is the count's message,
    InfoDocumenter's is always null.
  - AD-35's addition (PRD section 8) then says that a module whose objects are outside the model can be turned off with
    them. While it is off, its commands refuse (F13).
- **Q5. The extension point.** `DocumentSectionType` and the content tree's types are in `src/domain/document/` (F8),
  with the dictionary's contributions (F9). `DOCUMENT_SECTIONS` is in `src/compose/documents.ts`, beside
  `PANEL_SECTIONS`, `CANVAS_EXTENSIONS` and `TAB_DIALOGS`. New lint probes, and CLAUDE.md's list gets three points
  (sections, contributions, home tabs).
- **Q6. The content tree.**
  - Its types are in InfoMapper's domain (F8, not InfoDocumenter's). The builders are in InfoDocumenter's domain (text,
    dictionary, source-to-target) and InfoCube's (`cube.dim`).
  - Node kinds, proposed:
    - `heading` (level, text, an anchor for the contents);
    - `paragraph` (text runs, with `mono`, `muted` and `warn`);
    - `meta` (a line of joined parts);
    - `table` (columns with their keys and widths, rows of cells, and an optional full-width row under a row);
    - `pill` (status);
    - `note` (a skipped section's line);
    - `pageBreak`;
    - the title page and the contents.
  - The functions are in F21. Only the model's ordering and `lostOriginals` need a pure entry point (F1).
- **Q7. Levels and lists.** See F23. The order is the Model tab's, with dimensional entities after logical ones per
  concept, and the level is decided per section.
- **Q8. The document page.** The route, the one read, Paged.js pinned, local Serif, print CSS, the watermark and the
  limits are in F27–F29. The watermark and the running header are questions D2 and D3.
- **Q9. Labels.** In InfoDocumenter's domain from the prototype's `LBL` (F26), and InfoCube's words in InfoCube's
  domain (F25). The language is `workspace.doc_language`.
- **Q10. Copy, transfer, export.** See F30.
- **Q11. Earlier specs and fixtures.** See F31 and "Earlier specs and fixtures each step touches". The demo gets the
  licence, the switch and documents; the plain e2e seed does not.
- **Q12. Performance.** See F34. No figure in step 1; there are two reference benches, and the bar is Q-P1.

### Differences between the prototype and the PRD on what this slice builds (to decide)

The prototype is the source of truth for behaviour. Where it and the PRD disagree on a part this slice builds, the
proposal comes first:

- **D1. The presets.**
  - The prototype's are "Data dictionary for the business", "Source-to-target specification for ETL" and "Blank
    document", each with sections that are later (overview, conventions, diagrams, requirements, data quality,
    classification register, sources).
  - Proposal: the prototype's labels and descriptions, each preset with this slice's sections only (codes `dictionary`,
    `s2t`, `blank`):
    - **`dictionary`:** audience "Business", mapping filter Approved only, Text with the prototype's body, and the
      dictionary with columns Attribute, Type, Personal data, Definition and the entity's definition only;
    - **`s2t`:** audience "ETL developers", filter Approved and in review, source-to-target with columns Target, Target
      type, System, Source column, Source type, Rule, Status, Type check, "attributes with no mapping" on, then the
      Dimensional model **only when InfoCube is on at the creation**;
    - **`blank`:** a Text section with an empty body.
  - The descriptions name later content ("with key-only diagrams", "source tables; full diagrams"). Proposal: shortened
    to what the slice prints (texts under "Every new UI text").
- **D2. The watermark.** The prototype has a switch for it (the `s2t` preset turns it off) and draws it on every page
  but the cover. The PRD says "on every page" of a live document, with no switch. Proposal: the PRD's (no switch, a
  live document is always a draft), on every page but the title page, as the prototype draws it.
- **D3. The running header and footer.** The prototype has:
  - top-left "{organization} · {title}" (with the logo: later);
  - top-centre the watermark;
  - bottom-left "{workspace} · {model state}";
  - bottom-right "Page n of m";
  - nothing on the title page.

  The PRD has a header with the title and a footer "Page n of m". Proposal: the prototype's, without the logo.
- **D4. Sharing.** The prototype has two segmented buttons, "Private" / "Shared with the workspace", which a person
  without the right sees and gets a toast for, and turning sharing off asks nothing. The PRD has a check box for owners,
  admins and modelers, and turning it off is asked first. Proposal: the PRD's check box, shown only to those who may
  share, and the question "Make this document private? Only {author} will see it." (F17 (c)).
- **D5. The form's order and its fields.**
  - Prototype: the name in the top bar, Model state, Scope, Sharing with Audience, (Style, Logo, Header and footer:
    later), Cover. Sections are in a left panel, their options in a right panel, beside a live preview.
  - PRD: Name, Audience, Shared, Title page, Scope, Sections, then "Open document" and "Print".
  - Proposal: the PRD's order and fields on one page with no preview, as the PRD decides (R2-3d2). Model state is shown
    as text ("Live model"; the source field cannot be chosen), and the cover field is labelled "Version label" as in the
    prototype.
- **D6. The heading of every section.** The prototype gives every section a "Heading" (empty means the language's
  default) and "Start on a new page". The PRD gives a heading to Text only. Proposal: the PRD's. Every section starts on
  a new page, the prototype's default.
- **D7. The language.** The prototype stores one per document, copied from the workspace and changeable. The PRD fixes
  it to the workspace's. Proposal: the PRD's (F26).
- **D8. Text.** The prototype reads "- " as a list and `**bold**`, `_italic_`. The PRD says plain text, paragraphs kept.
  Proposal: the PRD's.
- **D9. Source-to-target's long texts.** The prototype prints Rule and Note **under the row** by default, as the
  dictionary's definitions are. The PRD lists them as columns. Proposal: the prototype's (one layout for long texts in
  both tables). The "attributes with no mapping" rows are only for grouping by entity, as in the prototype.
- **D10. The tab's texts.** The prototype's introduction and delete dialog mention versions and links. Proposal: this
  slice's own sentences (below). The row's meta line drops "changed {date}" and "Generate version" is not drawn. The
  sections count counts sections that are on, including a skipped one.
- **D11. "Prepared by" when empty.** The prototype falls back to the person viewing, so each reader sees their own name.
  Proposal: the author's name.
- **D12. The title page's organization.** The prototype shows the organization's name (with its initials in place of a
  logo). The PRD's list does not have it. Proposal: the organization's name above the title, with no initials.
- **D13. New document.** The prototype opens the editor at once. Proposal: create, then open the form.

### Differences between the prototype and the app that the slice touches

| Place | Prototype | App today | After this slice |
| --- | --- | --- | --- |
| Workspace home tabs | Overview, Documentation (n), Baselines (n), People (n), Metadata conventions, Settings | Overview, People (n), Metadata conventions, Settings | Documentation (n) after Overview while InfoDocumenter is on; no Baselines tab (later) |
| Settings, Methodology box | InfoCube's box, InfoDocumenter's box, then Process | InfoCube's box, then Process | both boxes; the box's "Modelers may share links", "Guests may…" and the logos later |
| Settings, the licence | "Prototype: grant licence" button | `scripts/licence.ts` | the script takes `infodoc` (no button, AD-35) |
| A baseline's buttons | "New document from it" | no baselines | later |
| Canvas | the page outline | none | later |
| Fonts | Plex Serif from Google Fonts | Sans and Mono hosted | Serif hosted (F28) |
| Scripts | Paged.js from jsDelivr | none | `pagedjs@0.4.3` from npm (F28) |
| "Act as" | a prototype control | not applicable | not built |

### Every new UI text

English is the app's language. The document's own labels are in three languages (F26).

**The Documentation tab**
- Tab: "Documentation ({n})".
- Introduction (proposal, D10): "Documents are generated from the model: their tables come from its objects, so a
  document is right at the moment it is opened. A **document** is the recipe; print it to make a PDF."
- "New document"; its dialog:
  - title "New document";
  - "Start from a preset; everything can be changed afterwards. A new document is private until you share it.";
  - the presets (D1):
    - "Data dictionary for the business": "Definitions and personal data of the entities in scope, for the business."
    - "Source-to-target specification for ETL": "Every mapping with its rule, types and status, and the dimensional
      model when InfoCube is on."
    - "Blank document": "A title page and an empty introduction."
- Headings: "Shared documents", "Your private documents".
- Empty states:
  - "None yet. Open a document and set it to Shared." (the second sentence only for those who may share);
  - "None. Private documents are seen only by their author, so readers and guests can make their own."
- A row's meta line: "{audience} · live model · {n} sections · {language} · A4 · by {author}" ("by …" for shared ones
  only).
- Buttons: "Edit" / "Open", "Duplicate", "Delete".
- Delete dialog:
  - title "Delete document";
  - "Delete **{name}**? It cannot be brought back." (proposal, D10);
  - "Cancel", "Delete".
- Toasts:
  - "Document deleted.";
  - "Duplicated as your private document “{name} (copy)”."

**The form**
- "← Documentation".
- Badges: "Shared", "Private", "Read only".
- Read-only lines:
  - "This workspace is archived, so documents are read-only.";
  - "A shared document is changed by modelers, admins and owners. Duplicate it to make your own copy.";
  - "Only its author changes a private document.";
  - "Duplicate as my document".
- Fields:
  - "Name" (empty: "A document needs a name.");
  - "Audience (for your own orientation)", placeholder "e.g. Business, ETL developers, Client";
  - "Shared with the workspace";
  - "Model state": "Live model (changes as people work)".
- Title page:
  - "Title" (placeholder: the name);
  - "Subtitle";
  - "Version label" ("e.g. 1.0");
  - "Status" ("e.g. Draft for review");
  - "Prepared by" (placeholder: the author's name).
- Scope:
  - "Projects": "None ticked: the whole model. Otherwise what the projects' canvases show.";
  - "Concepts": "None ticked: every concept.";
  - "Model levels": "Logical", "Dimensional (InfoCube)";
  - "Mappings included": "All, drafts marked", "Approved and in review", "Approved only".
- Sections:
  - "Text", "Heading", "Text";
  - "Data dictionary": "Above each entity" (Stereotype, Definition, Mapping coverage, Requirements, "Relationships (after
    the attributes)") and "Columns" (Attribute, Type, Keys, Nullable, Personal data, Definition, Mapped from,
    Calculation, Requirements);
  - "Source-to-target mapping":
    - "Columns" (Target, Target type, System, Source column, Source type, Rule, Status, Type check, Note, Requirements);
    - "Group by": "By target entity", "By source system";
    - "List attributes that have no mapping";
  - "Dimensional model": "Facts: type, grain, dimensions, measures", "Dimensions: history and attributes",
    "Relationships of each dimension", "Attributes with their feed from the logical model".
  - The tag "off", titled "InfoCube is off in this workspace".
- "Open document", "Print".
- Unsharing:
  - the question (D4) "Make this document private? Only {author} will see it." with "Make private" / "Cancel";
  - the refusal (F17) "{author} is no longer a member of this workspace, so the document stays shared.";
  - for those without the right: "Only modelers, admins and owners share documents.".
- Refusals (domain):
  - "InfoDocumenter is off in this workspace." (F13);
  - "Only its author changes a private document.";
  - "A shared document is changed by modelers, admins and owners.";
  - "A shared document is deleted by owners, admins or its author.";
  - the archive's existing message.

**The document page**
- "Laying out pages…", "{n} pages".
- "Skipped while InfoCube is off: Dimensional model."
- A section type no module knows: "Skipped: this section's module is not installed ({type})." (PRD section 3, new).
- For guests' print: "Guests cannot print documents in this workspace." (F16).

**Settings**
- Box heading "InfoDocumenter".
- "Documents generated from the model: data dictionary, mappings and the dimensional model. Turning it off deletes
  nothing: the documents are kept and come back when it is turned on again." (shortened from the prototype's
  "diagrams, requirements").
- "Use InfoDocumenter in this workspace".
- "Licensed for {organization}." / "{organization} has no InfoDocumenter licence."
- Toasts:
  - "InfoDocumenter is on: see the Documentation tab.";
  - "InfoDocumenter is off. Its {n} document is kept for when it is on again." / "…Its {n} documents are kept…";
  - "InfoDocumenter is off.".

**Document labels (en / pl / de, the prototype's `LBL`, German to be reviewed)**
- Title page and contents: `toc`, `client`, `ws`, `state`, `live` ("Live model on {d}"), `ver`, `status`, `by`, `wm`
  ("DRAFT · live model" / "WERSJA ROBOCZA · model bieżący" / "ENTWURF · aktuelles Modell"), `page`, `of`.
- Section titles: `t_text`, `t_dict`, `t_s2t`, `t_cube`.
- Data dictionary: `attribute`, `type`, `keys`, `nullable`, `pii`, `def`, `mappedFrom`, `calc`, `reqs`, `notMapped`,
  `mappedCnt`, `rels`, `related`, `relname`, `cardin`, `outScope`, `yes`, `no`, `none`.
- Source-to-target: `target`, `ttype`, `system`, `srcCol`, `stype`, `rule`, `check`, `note`, `direct`, `transform`,
  `draft`, `review`, `approved`.
- Dimensional model (InfoCube's): `facts`, `dims`, `ftype`, `grain`, `dimension`, `role`, `key`, `noMatch`, `measures`,
  `additivity`, `history`, `unk`, `unkOff`, `value`, `fedFrom`, `lookup`, `factless`, `noDims`, plus the fact types,
  kinds, histories and additivity words in three languages (F25, new: not in the prototype).
- Two of the prototype's English keys (`covered`, `system`) are defined twice; the later value is the one used.

### Earlier specs and fixtures each step touches

| Step | What | Why |
| --- | --- | --- |
| 2 | `tests/table-registry.test.ts` | the new table outside undo (an assertion added) |
| 2 | `tests/layer-rules.test.ts` | new probes between the two modules and from `src/domain` (F8) |
| 2 | `tests/schema/*` (schema check in CI) | the new table and `workspace.infodoc` |
| 2 | `src/data/local/upgrade-*.test.ts`, a new `upgrade-17.test.ts` | format 17 |
| 2 | `src/domain/commands/workspace.test.ts`, the permissions' tests | the switch's per-module state, `module.own_objects` |
| 2 | the store's tests | `snapshot`, `model.load` through `workspaceModelOf` (F1) |
| 2 | `scripts/lib/checks-model.ts` (`modelOf`) | proposal: replaced by `workspaceModelOf`, so the benches read the store's order (bench figures may move a little; reported) |
| 2 | full e2e run | the local adapter, the format, undo's outside module table |
| 3 | no earlier spec | pure builders and their unit tests |
| 4 | `e2e/slice-23/S23-01.spec.ts` (the exact tab list) | unchanged: its fixtures have no InfoDocumenter (F31) |
| 4 | `e2e/slice-15a/S15-03.spec.ts`, `e2e/slice-15b/S15-03.spec.ts`, `e2e/slice-23/S23-06.spec.ts`, `e2e/slice-24/S24-02.spec.ts` | Settings' boxes read by test id; the new box beside them changes no assertion (checked again in step 4) |
| 4 | `S15A-screens`, `S23-screens` | screenshots now show the new box (no assertion) |
| 4 | the element guard (`S3B-15-elements`) | the canvas is unchanged; Paged.js is loaded only on the view, so the canvas page's `<head>` should not grow (S25-10 reports it) |
| 5 | full e2e run | before the merge |

The new fixtures are `e2e/slice-25/fixtures.ts`: the plain seed plus `addDocumentsDemoData`. The star is added for
S25-06; a reader who is an InfoMate member is added as test data (F16); a German workspace is created through the
domain for S25-08 ("Sales analytics" is the seed's Polish one, a Retail Co workspace, so the test grants Retail Co the
licence).

### The plan for steps 2 to 5

1. **Step 2, module, data and domain.**
   - Open the draft PR first.
   - Data and the store:
     - the module's skeleton and lint;
     - `document_definition` (migration, rules, registry);
     - format 17 and `workspace.infodoc`;
     - `LICENSED_MODULES` and the CHECK;
     - `workspaceModelOf` and `snapshot` (F1).
   - Rights and the switch:
     - the switch's per-module state (F12);
     - `module.own_objects` and the module's rights (F14–F17).
   - The commands: create from a preset, update (patch, F19), share and unshare, duplicate, delete, each refused while
     the module is off (F13).
   - The contract types in `src/domain/document/` (F8, F9) and `src/compose/documents.ts`, empty of builders.
   - Unit tests for all of it.
   - **A full run** (the local adapter, the local file's format, undo's first module table outside it).
   - Before the commit that changes the format, check that no dev server of Łukasz's serves this checkout.
2. **Step 3, content tree.**
   - The node types' builders: title page, contents, text, dictionary, source-to-target, and InfoCube's `cube.dim` with
     its contributions and words (F25).
   - The labels in three languages.
   - The HTML renderer (pure: a string).
   - Unit tests on the demo, the star and "Performance test" (S25-09), and `scripts/bench-documents.ts` (reference
     figures, Q-P1).
   - No full run (no shared infrastructure).
3. **Step 4, interface.**
   - The home's tab point and the tab.
   - The form (D-66 fields, the chain).
   - The view with Paged.js and the local Serif, print, the guests' print line, Settings' box.
   - The demo data.
   - S25-01 to S25-08 and S25-10's checks; the earlier specs above; the layout's reference time.
4. **Step 5, close.**
   - The docs: `decisions.md` (D-80, AD-33, AD-35, AD-05, AD-18), `data-model-v2.md`, `ideas.md`,
     `inventory-prototype-vs-app.md`, `known-limitations.md`, README, CLAUDE.md (status, the three extension points).
   - The decisions quoted for approval; the full run on the final commit; the manual acceptance steps.

**Steps 2 and 3 stay apart.** The tree has four sections, InfoCube's through the new point, three languages and a
renderer. It is about as large as step 2.

### Questions for Łukasz before step 2

1. **F1:** a pure `workspaceModelOf` and one `snapshot` store method (changing the local adapter, full run in step 2):
   yes?
2. **F5:** keep `jsonb` for the recipe and amend AD-18 (a), or real columns and link tables (b)? Recommended: (a).
3. **F8–F10:** the content tree's types and the section contract in `src/domain/document/` (InfoMapper's domain), the
   dictionary's two contributions, and a home-tab point in `src/compose/home.tsx`: yes?
4. **F14:** one generic core action `module.own_objects` plus the module's own rules (b), or the PRD's four
   `document.*` actions in the core (a)? Recommended: (b).
5. **F15:** `author_id` instead of `owner_id`?
6. **F16:** guests without Print and with the print line, and S25-02 with Kasia as the guest and an added InfoMate
   reader: yes?
7. **F17:** (a) refuse unsharing while the author is not a member; (b) a demoted author may still delete their shared
   document: yes?
8. **F22:** S25-04 without classifications (none print in this slice's sections)?
9. **Q-L3 (F24):** the coverage line counts by the app's rule (any status) whatever the mapping filter?
10. **Q-L4 (F25):** InfoCube's words (fact types, history, additivity, kinds) in three languages in documents, or in
    English as in the prototype?
11. **D1–D13:** the proposals as written? In particular D1 (the presets, and the Dimensional model only when InfoCube is
    on), D2 (the watermark not on the title page), D3 (the prototype's header and footer), D4 (the check box and the
    question), D9 (long texts under the row) and D12 (the organization on the title page).
12. **F31, F32 (Q-S1):** the demo gets the licence, the switch and three live documents (two private as in the
    prototype, one shared dictionary in place of the baseline one), outside `addFullDemoData`: yes?
13. **F27:** the routes `/w/{ws}/d/{id}` (form) and `/w/{ws}/d/{id}/view` (document)?
14. **Q-P1 (F34):** a bar for building the tree (proposal: 200 ms in Node on "Performance test"), or reference figures
    only?

## Łukasz's answers (11 November 2026)

The answers are in the PRD's version 2, section 7 ("Step 1's findings and Łukasz's answers"): `docs/prd/slice-25-infodocumenter-documents.md`,
24,701 bytes, SHA-256 `5fd356e63fc3a3fc3486a2e8e136ae85aceb54de12cb717734f4a367f0d01d55`, copied from Łukasz's Downloads
(`slice-25-infodocumenter-documents.md`; the only other copy there, `slice-25-infodocumenter-documents_old.md`, is
version 1, `4eb3d8f9…`), checked with `cmp` (equal) and `sha256sum`.

| # | Question | Answer | Changes a proposal? |
| --- | --- | --- | --- |
| 1 | F1, `workspaceModelOf` and `snapshot` | yes | no |
| 2 | F5, `jsonb` and AD-18 | (a) | no |
| 3 | F8–F10 | the types and the contract in `src/domain/document/` and the home-tab point: yes; **the dictionary's two contributions from InfoCube: no** | **yes:** the data dictionary covers the logical level only (PRD item 3); dimensional entities are in InfoCube's Dimensional model section. F9 is dropped, and F23's "dimensional entities after the logical ones" with it: the dictionary is logical only, whatever the scope's levels. The scope's "Dimensional" level now only turns the Dimensional model section's content on or off (S25-06). The dictionary through InfoCube is later (slice B) |
| 4 | F14 | (b): `module.own_objects` and the module's own rules | no |
| 5 | F15, `author_id` | yes | no |
| 6 | F16 | changed | **yes:** guests print as every member does (PRD item 10); no print CSS line, and its text "Guests cannot print documents in this workspace." is dropped. S25-02 uses Kasia as the guest and an added InfoMate reader, as proposed. F14's rights table loses its "print: not a guest" row: every member who sees a document opens and prints it |
| 7 | F17 (a), (b) | yes, yes | no |
| 8 | F22 | yes | no |
| 9 | Q-L3 (F24) | yes | no |
| 10 | Q-L4 (F25) | three languages, given by InfoCube with its section | no (F25's proposal: InfoCube's own word table, `DOC_WORDS`) |
| 11 | D1–D13 | as proposed, except D4 | **yes, D4:** the check box **without a question**: unsharing is at once; its question "Make this document private? Only {author} will see it." is dropped. F17 (c) loses its "the question says so". D1's dictionary preset text becomes "Definitions and personal data of the logical model's entities, for the business." |
| 12 | F31, F32 (Q-S1) | yes | no |
| 13 | F27, the routes | yes | no |
| 14 | Q-P1 (F34) | reference figures only | **yes:** no 200 ms bar; step 3's bench reports figures, Łukasz decides after seeing them |

The German labels, InfoCube's new words included, stay marked for Łukasz's review.

## Step 2: module, data and domain (11 November 2026)

Draft PR: [LukaszWolski-DA/infomapper-app#57](https://github.com/LukaszWolski-DA/infomapper-app/pull/57), opened at the
start of the step. Before the format's upgrade was written, and again before its commit, no `node` process ran on the
laptop, so no dev server of Łukasz's served this checkout. `.data/dev-db.json` and the KB backups were not read or
written.

### What changed

**One model rule and one snapshot (F1).**
- `src/domain/model/workspace-model.ts` (pure):
  - `workspaceModelOf` holds the live filter, the orders and the lost originals that `store.model.load` computed in the
    adapter;
  - `liveRequirementLinksOf`, `liveProjectCanvasesOf`, `byTabOrder` and `workspacePeopleOf` are the store's other rules,
    moved here unchanged;
  - `workspaceSnapshotOf` and `WorkspaceSnapshot` build the snapshot.
- The local store calls them for `model.load`, `requirements.listLinks`, the canvas links and `users.listForWorkspace`,
  so they behave as before (`src/data/local/store.ts`).
- The new port method `DataStore.snapshot(workspaceId, tables)` (`src/data/ports.ts`) reads the file once. It returns
  null for a workspace that is not live, and throws on a table the store does not know, as `modules.list` does.

**The switch, the licence, the table and format 17 (F2, F4–F6, F12).**
- Columns and values:
  - `Workspace.infodoc` (`src/domain/types.ts`);
  - `LICENSED_MODULES = ["infocube", "infodoc"]`;
  - the local file's format 17 sets `infodoc` false in every workspace (`src/data/local/file.ts`, `schema.ts`);
  - the seed, `seed:large` and the domain's fixture have `infodoc: false`.
- `updateWorkspaceSettings` takes `infodoc`. It is turned on only with the licence ("{organization} has no InfoDocumenter
  licence.", `licenceMissingMessage`, `src/domain/model/module-switches.ts`) and off at any time, by owners and admins,
  on the workspace's version, outside undo.
  - **A deviation from F12's proposal:** InfoCube's fourth argument stays as it is, and InfoDocumenter's licence state is
    a fifth (`ModuleLicenceState`), read by the action only when the input changes the switch
    (`src/app/_actions/workspace.ts`). Generalising the arguments into one record would have changed every InfoCube call
    and test for no behaviour.
- `scripts/licence.ts` grants `infodoc` (its usage line lists the modules).
- The migration `supabase/migrations/20261111120000_infodocumenter.sql` has:
  - `workspace.infodoc`;
  - the licence CHECK with `infodoc`;
  - `document_definition`: FKs to `workspace`, `app_user` (author and audit) and `baseline`; CHECKs on the name, the
    preset, the source (`live` without a baseline, `baseline` with one), and the recipe's JSON kinds; two indexes; RLS.
- The local adapter's rules (`src/modules/infodocumenter/data/tables.ts`) mirror it. `baseline_id` has no key while
  `baseline` is not in the domain (F6), and the source check accepts `live` only in this slice.
- The table is registered `"outside undo"` (`src/modules/infodocumenter/domain/tables.ts`): the first module table
  there.

**Rights (F14 b, F15, F17; PRD item 10 as changed).**
- The core action `module.own_objects` (every role, never in an archived workspace) is in `src/domain/permissions.ts`.
- InfoDocumenter's pure rules are `src/modules/infodocumenter/domain/rights.ts`:
  - `canSee`;
  - the refusals `createRefusal`, `editRefusal`, `shareRefusal`, `deleteRefusal` and `openRefusal`;
  - `documentRights`, what the page will offer.
- Another's private document is "not found". A shared document's author whose role was lowered still deletes it.
  Unsharing is refused while the author is no longer a member.
- Every member who sees a document opens and prints it, also in an archived workspace. While InfoDocumenter is off,
  every write and every opening is refused ("InfoDocumenter is off in this workspace.").

**The commands** (`src/modules/infodocumenter/domain/commands.ts`):
- `createDocument` makes a private document from a preset (`presets.ts`, D1 as answered). A module's kind that names the
  preset ends it while it is available, so the source-to-target preset ends with InfoCube's Dimensional model only while
  InfoCube is on.
- `updateDocument` saves the named fields only: name, audience, title page fields, scope parts, one section's switch or
  options. Options are merged into the stored ones and checked against the section kind's schema; the columns are kept
  in their fixed order. A section of a type no module knows keeps its options. The row's version is checked, and
  "Nothing to change." is refused.
- `setDocumentShared` shares or unshares at once (D4 as answered).
- `duplicateDocument` makes "{name} (copy)", the person's private copy.
- `deleteDocument` soft-deletes with the version.
- Each command is one change event and no undo step.

**The extension points (F8, F10).**
- `src/domain/document/content.ts`: the content tree's node types (`DocNode`: heading, paragraph, meta, table with
  full-width rows under a row, note, page break).
- `src/domain/document/sections.ts`: the section contract.
  - It has two halves. `DocumentSectionKind` is the recipe's: type, availability, the presets it ends, defaults, the
    options' schema. `DocumentSectionType` adds the label per language, the tables and the pure `build` from a snapshot,
    which step 3 fills.
  - `sectionKinds` throws on a name registered twice or not in the stored shape.
- InfoDocumenter's own kinds are `text`, `dict` and `s2t` (`src/modules/infodocumenter/domain/sections.ts`), and
  InfoCube's is `cube.dim` (`src/modules/infocube/domain/document-section.ts`). `src/compose/documents.ts` joins them
  (`DOCUMENT_SECTION_KINDS`).
- The home's module tab:
  - `src/ui/home-tabs.ts`: `ModuleHomeTab`, `homeTabOrder`, `chosenHomeTab`;
  - `src/compose/home.tsx`: `HOME_TABS`, `homeTabs`, with the composed store;
  - `src/app/w/[workspaceId]/page.tsx` draws the modules' tabs after Overview and their body while chosen.
  - `HOME_TABS` is empty until step 4 (the Documentation tab is the interface's), so the home looks as before.
- `eslint.config.mjs` has `modules = ["infocube", "infodocumenter"]`.

**Docs.**
- `docs/data-model-v2.md`:
  - `workspace.infodoc`;
  - the licence's values;
  - the JSON paragraph with AD-18's fourth place as proposed;
  - a section "InfoDocumenter: `document_definition`".
- CLAUDE.md's list of extension points: document sections, the home's module tab, one snapshot, a module's own objects
  outside the model and a module table outside undo, plus the licence script's line.

**Not in this step, by the plan:**
- the server actions, the Documentation tab, the form, the document page and Settings' box (step 4);
- the demo's licence, switch and documents (step 4, F31, F32);
- the section builders, the labels and InfoCube's words (step 3).

### Tests

New unit tests:
- `src/modules/infodocumenter/domain/documents.test.ts` (22): the rights matrix (every role on shared, own, another's
  private, a lowered author, archived, off), each preset for every role, the Dimensional model only with InfoCube on,
  saves (named fields, version, stale, empty name, nothing to change, options merged and checked, an unknown type),
  share and unshare (the author gone), duplicate and delete.
- `tests/infodocumenter-store.test.ts` (8), through the composed store:
  - a reader's document is stored with its change event and is not an undo step, and `loadForUndo` leaves it out;
  - the adapter refuses a stale save, a baseline source, a broken recipe, a padded name and an unknown author;
  - the switch: refused without the licence or without its state, for a modeler; documents kept while off;
  - the snapshot equals `model.load`, `workspaceModelOf`, the requirements, links, projects, canvas links, cards,
    members and people as the other reads give them; it leaves out deleted rows and other workspaces' rows; null for a
    missing workspace; it throws on a table the store does not know;
  - the registered kinds and their defaults against their schemas, a name twice, a bad name, and the s2t preset with
    InfoCube on.
- `src/data/local/upgrade-17.test.ts` (2): format 16 to 17 turns InfoDocumenter off everywhere and changes nothing else,
  with no change event and no log line; a current file is read as it is.
- `src/ui/home-tabs.test.ts` (2): the order, and `?tab=` falling back to Overview.
- `src/domain/commands/workspace.test.ts`: a new describe (3) for InfoDocumenter's switch.

**Earlier tests changed, each with its reason:**
- `src/domain/permissions.test.ts`: the role matrix gets `module.own_objects` for every role (the new core action, AD-05's
  addition).
- `tests/schema/compare-schema.test.ts`: the list of stored tables gets `document_definition`, and four column kinds are
  checked (`scope` and `sections` `jsonb`, `baseline_id` nullable `uuid`, `workspace.infodoc` boolean).
- `tests/table-registry.test.ts`: `document_definition` is outside undo and not among the store's undoable tables.
- `tests/layer-rules.test.ts`: a new describe "two modules": InfoDocumenter refused in InfoMapper's layers, each module
  refused in every part of the other, both domains read the contract, the composition root reads both,
  InfoDocumenter's domain stays pure.

No earlier e2e spec changed. `src/data/local/upgrade-16.test.ts`'s test "is not repeated: a file at format 16 is read as
it is" reads the current file (now format 17) and passes unchanged; its wording is older than the file and was left.

Locally, on `87a3cdb`:
- `npm run lint`: no problems;
- `npm run typecheck`: passes;
- `npm test`: 170 files, 2,137 tests passed.

### The full run

The run is local (`npm run e2e`, CLAUDE.md's fallback), because GitHub Actions had a major outage during the step: the
workflow "E2E" started by hand on `87a3cdb` ended in `startup_failure` (run 43098258021), and CI and Schema on
`6d4d196` and `87a3cdb` were still queued after two hours.

- Commit: `87a3cdb`, on the laptop, Europe/Warsaw, from scratch with no dev server running.
- Wall-clock: 113 min 6 s.
- Result: **739 passed, 0 failed, 4 skipped, 0 flaky, no expected failures.**
- Parts:

| Part | Folders | Time |
| --- | --- | --- |
| 1 | fixes to slice-01b | 12 min 51 s |
| 2 | slice-02a to slice-03a | 13 min 24 s |
| 3 | slice-03b to slice-04b2 | 11 min 23 s |
| 4 | slice-04p to slice-07a | 12 min 35 s |
| 5 | slice-07b to slice-09 | 15 min 22 s |
| 6 | slice-10a to slice-12b | 14 min 35 s |
| 7 | slice-13 to slice-15c | 13 min 45 s |
| 8 | slice-15d to slice-24 | 19 min 6 s |

- Heap peaks: not recorded (the run was without `E2E_MEMORY_LOG=1`).
- GitHub's own full run, CI and the Postgres schema check (`schema.yml`, the new migration) are still to run once Actions
  is back.

## Step 3: the content tree (12 November 2026)

Before the step: CI and the Schema check passed on `fdfcd82` (runs 43115169075 and 43115168888, after GitHub Actions came
back), so the migration is checked against Postgres. The local full run on `87a3cdb` stays the step's full run
(`fdfcd82` is docs only). This step changes no shared infrastructure, so it has no full run.

### What changed

**The model state (InfoMapper's domain).**
- `src/domain/document/state.ts`: `DocumentState`, the document's model built once from one snapshot by
  `documentStateOf(snapshot, feeds)`. It holds:
  - the requirement index with the feeds (`buildRequirementIndex`) and its own lookup (`lookupModel`);
  - `derivationIndex`, `stereotypeIndex`;
  - the maps of entities, concepts, tables and systems;
  - `mapped`, the app's coverage rule (`countsAsMapped` over "any live mapping", as `stats.ts` counts it).
- `src/domain/document/blocks.ts`: the runs (name, type, status), the mapping filter's rule (`statusShown`,
  `marksStatus`, the prototype's `mapOk` and `markSt`) and `relationshipsBlock` (the prototype's `relBlock`), which the
  dictionary and InfoCube's section both print, each with its own words.
- The contract (`sections.ts`):
  - `SectionBuildInput` carries `state` instead of the bare snapshot;
  - `DocumentSectionType` gets `module` (the name for the skipped note) and an optional `heading` (Text's);
  - `build` is a method, so a module's type with its own tables registers in the common map.
- `content.ts`: a run may start a new line (`lineBreak`): a second mapping of one attribute, a line of a Text body.

**InfoDocumenter's sections** (`src/modules/infodocumenter/domain/`):
- `labels.ts`: the prototype's `LBL`, only the keys this slice prints, in English, Polish and German (`label(language,
  key, values)`).
- `scope.ts`: `sectionScopeOf`. A project means the entities on its canvases (`projectScope`, the project home's rule),
  then the chosen concepts. Ids no longer live are ignored (F7): a choice whose every id is gone reads as no choice.
- `builders.ts`:
  - **Text:** paragraphs at blank lines, line breaks kept, nothing read as Markdown (D8).
  - **Data dictionary**, logical only:
    - entities grouped by concept in the concepts' order, by name within one;
    - above the table, one line of the stereotype's workspace name (`stereotypeIndex.name`), the coverage line and the
      entity's requirements, then its definition;
    - the chosen columns in their fixed order, the definition under the row, the relationships after.
    - "Mapped from" lists the shown mappings' columns, one line each. It marks a column that left the source, and a
      status other than Approved while drafts or reviews are shown. Without a shown mapping, a calculated attribute
      names its inputs ("= a, b").
    - **The coverage line counts by the app's rule whatever the filter (Q-L3).**
  - **Source-to-target mapping**, logical targets only:
    - every shown mapping, with Rule and Note under the row (D9), labelled when both are chosen;
    - the type check from `checkMappingTypes` ("✓" or its message), and types from `formatColumnType` and
      `formatAttributeType`;
    - grouped by target entity, with the attributes that have no mapping when chosen; or by source system, the systems
      by name (a mapping that reads two systems is listed under both).
  - The requirements of an element are its own links (`RequirementIndex.of(...).direct`, the prototype's `reqKeys`).
- `document.ts`: `buildDocument` makes the whole tree:
  - the title page: organization, title, subtitle, client, workspace, "Live model on {d}", version, status, prepared by
    (the author's name when empty, D11);
  - the contents;
  - the frame's texts: header "{organization} · {title}", footer "{workspace} · {model state}", the watermark, "Page"
    and "of" (D2, D3);
  - every section that is on.
  - A section of a type no module knows, or of a module that is off, is left out of the contents and named in `skipped`:
    - "Skipped while {module} is off: {section}.";
    - "Skipped: this section's module is not installed ({type})."

**InfoCube's section** (`src/modules/infocube/domain/document-section.ts`, `CUBE_SECTION`):
- The Dimensional model, built from InfoCube's own indexes over the snapshot's rows: `cubeIndex`, `mappingIndex`,
  `unknownValueOf`, `unknownFit`, `historyLabel` and `cubeTitle`.
- It prints the facts, then the dimensions, of the scope's dimensional entities.
  - Each: the role's long text, then the definition.
  - A fact: its type (and "factless") and grain; its dimensions with role, key and "No match →" (the unknown member's
    key value), their definitions under the row; its measures with additivity and note.
  - A dimension: its history, its unknown member's values (NULL muted, a value that does not fit marked), or "This
    dimension has no unknown member.", and its relationships.
  - Each entity's attributes with their feed and rule (direct, lookup, the transformation's rule; a calculation's rule
    when it has no feed).
- With the dimensional level out of scope it prints "There are no facts or dimensions in this model state." (S25-06).
- `cubeDocumentFeeds`: the requirement feeds from the snapshot's rows (`cubeRequirementFeeds`), for the document's
  requirement index.
- `document-words.ts` (`CUBE_DOC_WORDS`): InfoCube's words in three languages (Q-L4), including the fact types,
  additivity, histories, kinds and the role's long text.
- **A change to two InfoCube rules, defaults unchanged:**
  - `historyLabel(c, snapshot = "Snapshot")` takes the word for "Snapshot";
  - `cubeTitle(c, x, words = ENGLISH_TITLE_WORDS)` takes the long text's words.

  So the document reads the same rule, never an "SCD n" or a title of its own (CLAUDE.md, slice 19). The card, the panel
  and the bus matrix pass nothing and are as before.

**How the snapshot's tables come from the registry.** `src/compose/documents.ts`:
- `DOCUMENT_SECTION_TYPES` joins `INFODOC_SECTION_TYPES` and `CUBE_SECTION`, and is also `DOCUMENT_SECTION_KINDS`
  for the commands.
- `DOCUMENT_TABLES` is the union of every registered type's `tables` and InfoCube's feed tables (`CUBE_FEED_TABLES`).
  Step 4's page reads `store.snapshot(workspaceId, DOCUMENT_TABLES)`.
- `documentStateFor(snapshot)` builds the state with `cubeDocumentFeeds`.

InfoDocumenter's builders receive the types map and the state. They never name InfoCube or a `cube_` table, and a test
checks their sources for it.

**Not in this step** (by the brief):
- No UI, no server actions, no demo data.
- **The HTML renderer** moves to step 4, with the page and Paged.js. Step 1's plan had it in step 3; the step's brief
  lists the tree only, and the renderer's classes belong with the page's CSS.

### German for Łukasz's review

The prototype's German `LBL` values are used as they are. These words are new:
- InfoDocumenter: "Übersprungen, solange {module} ausgeschaltet ist: {section}.", "Übersprungen: Das Modul dieses
  Abschnitts ist nicht installiert ({type}).";
- InfoCube:
  - fact types: "Transaktion", "Periodischer Snapshot", "Akkumulierender Snapshot";
  - additivity: "Additiv", "Semi-additiv", "Nicht additiv";
  - history: "Snapshot";
  - beside a value that does not fit its type: "passt nicht zum Typ";
  - the role's long text: "Transaktionsfakt", "Fakt (periodischer Snapshot)", "Fakt (akkumulierender Snapshot)", "ohne
    Kennzahlen", "Aggregat von {n}", "Dimension", "Junk-Dimension", "Snapshot ({period})", "Outrigger von {n}".

The Polish ones that are new: "Pominięto, bo {module} jest wyłączony: {section}.", "Pominięto: moduł tej sekcji nie
jest zainstalowany ({type}).", "Transakcyjny", "Migawka okresowa", "Migawka narastająca", "Addytywna", "Częściowo
addytywna", "Nieaddytywna", "Migawka", "nie pasuje do typu", "Fakt transakcyjny", "Fakt – migawka okresowa", "Fakt –
migawka narastająca", "agregat faktu {n}", "Wymiar typu junk", "migawka ({period})", "outrigger wymiaru {n}".

### Tests

`tests/document-tree.test.ts` (23, S25-09) builds every document from a snapshot made of the demo's plain rows
(`buildSeed` and `addFullDemoData`, `workspaceSnapshotOf`), with no file and no store:
- **the document:**
  - the title page, the contents and the frame;
  - "Prepared by" falls back to the author;
  - a section skipped while InfoCube is off, and one of an unknown type, each with its note;
- **Text:** paragraphs and line breaks, no Markdown;
- **the dictionary:**
  - logical only, by concept and name;
  - the meta line, the columns, two mappings on two lines with the draft marked, a definition under its row (written as
    test data: the demo's attributes have none);
  - the relationships;
  - the coverage line the same under "Approved only" (Q-L3), with drafts and reviews hidden in the rows;
  - a calculation's rule and inputs;
  - a renamed stereotype;
  - scope by project and by concept, a deleted project id ignored, "outside this document";
  - logical out of scope;
- **source-to-target:**
  - columns, Rule and Note under the row, the attributes with no mapping;
  - one long text unlabelled, a transformation's rule;
  - grouped by system;
  - the three filters;
- **the Dimensional model:**
  - its tables are the registered ones;
  - facts and dimensions with role, key, "No match →", measures, feeds, history, a snapshot, an aggregate, a junk
    dimension, an outrigger;
  - no unknown member;
  - dimensional out of scope;
  - options off;
  - a project without dimensional entities;
- **the languages:**
  - Polish and German headings, labels and InfoCube's words, with names and definitions unchanged;
  - every key in every language;
- **no store:** the builders' sources import nothing of the data layer, and InfoDocumenter's never name InfoCube or its
  tables.

Earlier tests: none changed. InfoCube's tests of `cubeTitle`, `historyLabel` and the bus matrix pass unchanged (the new
parameters default to the old words).

Locally:
- `npm run lint`: no problems;
- `npm run typecheck`: passes;
- `npm test`: 171 files, 2,160 tests passed.

### The reference figure (Q-P1, no bar)

`npx tsx scripts/bench-documents.ts`, in Node 22.20.0 on the laptop (Intel Core i7-8550U at 1.80 GHz, 7.9 GB RAM,
Windows 11), with no other program measured. One warm-up, then 9 rounds; median (fastest – slowest).

The document is a full one: Text; the dictionary with every field and column; source-to-target with every column and
the attributes that have no mapping; the Dimensional model with every option.

| Model | Snapshot from the rows | State (indexes) | Tree | All three |
| --- | --- | --- | --- | --- |
| "Performance test" (41 entities, 779 attributes, 300 mappings; InfoCube off, so its section is skipped): dictionary 859 table rows, source-to-target 839 | 1.0 ms (0.9–1.4) | 1.7 ms (1.4–3.5) | 12.0 ms (9.5–13.5) | **12.8 ms** (11.0–14.5) |
| Demo (Retail Co – DWH with the star: 13 entities, 72 attributes; all four sections) | 0.1 ms | 0.7 ms | 1.1 ms | **1.6 ms** (1.4–2.6) |

The tree of "Performance test" is 367 KB as JSON. The snapshot's figure starts after the file is read and parsed:
`store.snapshot` adds one read of the file, which the cache skips while the file's stamp is the same. Step 4 adds the
HTML and Paged.js's layout in the browser, measured there.

## Step 4: the interface (12 November 2026)

CI and the Schema check passed on step 3's `879e99b`. `.data/dev-db.json` and the KB backups were not read or written: the
pages were tried on a scratch demo file (`.data/preview-25.json`) and the specs on the e2e file.

### What changed

**The HTML renderer (step 3's deviation).**
- `src/modules/infodocumenter/ui/document-html.tsx` renders the content tree as React elements with the prototype's
  classes: the title page, the contents, each section. Every text from the model, a definition or the recipe is a text
  node that React escapes; no HTML is built from strings and nothing uses `dangerouslySetInnerHTML`.
- **How a test proves it:**
  - `tests/document-html.test.ts` renders a document whose title, subtitle, Text heading and body, entity definition
    and attribute definition hold `<img src=x onerror=…><script>…</script><b>bold</b>`, and an attribute named
    `<i>email</i>`. The output has no `<img`, `<script`, `<b>bold` or `<i>email`, and holds the escaped text six times.
  - `e2e/slice-25/S25-04.spec.ts` (first test) does the same in the browser. It writes such a definition into the
    data, opens the laid-out dictionary and checks that the row below shows the markup as text, that the pages hold no
    `<img>` and no `<b>`, and that the `onerror` code did not run.
- The frame's texts (the organization, the title, the workspace) go into CSS strings, escaped by `cssString` (unit
  test).

**The Documentation tab** (through the home's module tab point, `HOME_TABS` in `src/compose/home.tsx`):
- "Documentation ({n})" after Overview while InfoDocumenter is on; n is the documents the person sees.
- The introduction and New document. Its dialog offers the three presets with their texts; a click creates the
  document and opens its form (D13).
- "Shared documents" and "Your private documents", each row with:
  - the name;
  - the meta line "{audience} · live model · {n} sections · {language} · A4 · by {author}", with "by …" only for shared
    ones;
  - Edit or Open, Duplicate, and Delete with its dialog "Delete {name}? It cannot be brought back."
- The toasts as step 1 listed them. No Undo: documents are outside undo.
- Another's private document never reaches the page: the list is filtered on the server (`visibleDocuments`).

**The form** (`/w/{ws}/d/{id}`), one page as D5:
- Name, Audience, "Shared with the workspace" (owners, admins and modelers; at once, no question, D4), Model state;
- the title page's five fields;
- the scope: projects, concepts, levels, the mappings segment;
- the sections in their order with their switch and options;
- Open document and Print.
- Each field saves its own part on the row's chain (`saveRow`):
  - text fields keep their draft and show the conflict line after a stale refusal (D-66);
  - choices use `useChoice`.
- Read only, with the banner and "Duplicate as my document", in an archived workspace and for a shared document the
  person may not change.
- F17's refusal stays under the check box: "{author} is no longer a member of this workspace, so the document stays
  shared."
- A module's section draws its options from its registration (`optionChecks`, InfoCube's four check boxes), so the form
  does not name InfoCube's options. A section whose module is off shows the tag "off", titled "{module} is off in this
  workspace".

**The document page** (`/w/{ws}/d/{id}/view`):
- It makes one snapshot of the workspace (`store.snapshot(ws, DOCUMENT_TABLES)`) and builds the tree on the server. The
  rendered HTML waits in a hidden source.
- `PagedView` hands a copy of that source and the document's CSS to Paged.js 0.4.3, which lays out the pages in
  `document-host`.
- What the pages show:
  - A4 portrait;
  - the title page as a named page with nothing in its margins;
  - the contents with page numbers (`target-counter`);
  - top left "{organization} · {title}", top centre the watermark "DRAFT · live model", bottom left "{workspace} · Live
    model on {date}", bottom right "Page n of m" (D2, D3);
  - each section on a new page (D6);
  - the skipped sections' notes under the contents.
- "Laying out pages…" meanwhile, "{n} pages" after, and Print. `?print=1` (the form's Print) opens the print dialog once
  the pages are ready.
- In print, everything but the pages is hidden and their ancestors are unclipped.
- **Paged.js** is pinned at exactly 0.4.3 (`package.json`, no CDN). `next.config.ts` points `pagedjs` at its own
  bundled ES module (`dist/paged.esm.js`): its source build failed under Turbopack ("contains.call is not a function",
  `es5-ext` through `event-emitter`). The alias affects nothing else.
- **IBM Plex Serif:** Regular, Medium and Italic, IBM's unmodified files from `@ibm/plex-serif` 2.0.0, with their
  SHA-256 in `src/app/fonts/ibm-plex/README.md` (the licence is the same OFL text).
  - It is loaded by `next/font/local` on the document page only; the canvas page's head has the same five font
    preloads as before.
  - **Used for the title page's title and subtitle.** The prototype's default template prints in Sans and uses Serif in
    its "formal" template; since this slice has no templates and the brief asks for Serif hosted, I used it where the
    formal template does. Say if you want the title in Sans.
- `loadShell` takes the path after `/w/{ws}` (`rest`), so a locked organization's sign-in returns to the document page
  (F27).

**Settings:**
- InfoDocumenter's box sits below InfoCube's, with the text, the switch for owners and admins and the licence line.
- Toasts:
  - "InfoDocumenter is on: see the Documentation tab.";
  - "InfoDocumenter is off. Its {n} document(s) is/are kept for when it is on again.";
  - "InfoDocumenter is off." with none.
- `settingsBoxes` reads the documents through the composed store.

**The server actions** (`src/modules/infodocumenter/app/actions.ts`): create, save, share or unshare, duplicate and
delete, over step 2's commands through `runCommand`.
- The rights are the domain's: guests make and print private documents; an archived workspace's documents are read only.
- Saves answer the row's version for the chain. The registry reaches the module through `src/app/_lib/documents.ts`,
  since a module never imports `src/compose/`.

**The demo** (F31, F32): `addDocumentsDemoData` (`src/compose/seed.ts`, the module's `data/demo.ts`):
- InfoMate's licence and InfoDocumenter on in "Retail Co – DWH";
- "Retail Co – data dictionary" (shared, Łukasz's; subtitle "For the business", version 1.0, "Draft for review");
- "Order management – S2T for the ETL team" (Łukasz's private, scope Order management; it ends with the Dimensional model
  where InfoCube is on);
- "Anna's working dictionary" (Anna's private, all mappings).

`npm run seed`, `reset-dev-data` and `demo` write it after `addFullDemoData` (`addSeedDemoData`); `addFullDemoData` is
unchanged, so earlier fixtures and the benches read the demo as before. The seed's attributes are unchanged.

**What the routes leave as they are:** the breadcrumbs on the document pages say "Workspace home" (the shell's
workspace page). A shared document unshared by someone who is not its author leaves that person on a page they may no
longer see: its fresh page answers 404 (D4 as answered, no question).

### If about ten demo attributes got definitions

The demo's attributes have no definitions today, so the dictionary prints none under its rows. Definitions written in
`src/data/local/seed-model.ts` (the plain seed, which every e2e reseed uses) would change these:
- **`e2e/slice-04a/S4A-05.spec.ts`**: it expects Customer.email's panel to show the empty definition's placeholder
  ("What this attribute means for the business. Click to write it."). It changes only if Customer.email is one of the
  ten; choosing others leaves it as it is.
- **`tests/document-tree.test.ts`** (this slice): one test expects only the definition it writes itself under Customer's
  rows. It would read the seeded ones.
- **`e2e/slice-25/S25-04.spec.ts`**: its first test finds the row under Customer.email by its text, so it stays as it
  is. It also expects only that row to be under one.
- **`scripts/bench-documents.ts`**: a slightly larger tree; its figures would move a little.
- Nothing else reads an attribute's definition from the seed:
  - the canvas never draws definitions;
  - the model checks have no definition rule;
  - S10C-01 compares a copy's definition with its original's, so it holds either way;
  - the element guard counts canvas elements only.

Written only in the documents' demo (`addDocumentsDemoData`), they would change no earlier spec or fixture, only
`npm run seed`, `reset-dev-data` and `demo`, and this slice's specs that use the "docs" or "full" seed.

### Tests

**New specs** (`e2e/slice-25/`, one file per criterion, fresh seed each; the fixture's `seed` option: "docs", "plain",
"full"):

| Spec | Tests | What |
| --- | --- | --- |
| S25-01 | 3 | the box without and with the licence, a modeler's disabled switch, off with documents and on again |
| S25-02 | 5 | owner shares; modeler changes, cannot delete another's (also the domain's refusal), deletes her own; an InfoMate reader (added) makes, changes, deletes, opens and prints the shared one read only; Kasia (guest) makes and prints; nobody sees another's private document (the list, and 404 on its pages); the author gone; archived |
| S25-03 | 3 | each preset's sections; a save with its version and change event; a stale save with the conflict line; Duplicate; the home's Undo stays off |
| S25-04 | 3 | concepts and entities in order, the columns, the definition under the row, a renamed stereotype, markup as text; the coverage line equal under "Approved only" and "All" (Q-L3); scope by project and by concept |
| S25-05 | 2 | the columns, the rule under the row, the attributes with no mapping; Approved only; by source system |
| S25-06 | 4 | facts, dimensions, role, key, no-match value, measures, unknown member, feeds; Polish words; InfoCube off: skipped with its note and the form's tag; dimensional out of scope |
| S25-07 | 2 | the title page and its empty margins; header, watermark, footer and "Page n of m" on every other page; the contents' numbers equal the pages their sections start on, each section first on its page; print media: A4 (Paged.js's last page size rule), every page 793.7 × 1122.5 px, the top bar and the buttons hidden, no watermark on page 1 |
| S25-08 | 2 | a Polish workspace ("Sales analytics", Łukasz a guest there) and a German one: contents, section titles, title page labels, column heads, watermark, "Strona … z …"; names and definitions unchanged |

Also new:
- `S25-layout.spec.ts`, the figure below, which runs only with `MEASURE=1`;
- `S25-screens.spec.ts`, which runs only with `SCREENS=<folder>`;
- `tests/document-html.test.ts` (3 unit tests).

**Runs, locally:**
- `e2e/slice-25`: 24 tests. The first run had 22 passed and 2 failed, both in S25-07 on the test's own reading: the
  contents' counter is on the link's `::after`, and Paged.js writes its default `letter` before the document's `a4`.
  With those two reads corrected, S25-07 passed 2 of 2. After the last CSS change (the paper's variables on the pages)
  the folder ran again: **24 passed, 1 skipped** (S25-layout, `MEASURE=1` only), 4.1 min.
- Earlier specs the home, Settings and `loadShell` touch: step 1's list (`S15-03` of 15a and 15b, `S23-01`, `S23-06`,
  `S24-02`) and the whole folders `slice-00`, `slice-08`, `slice-12a`, `slice-23` and `slice-24`, 83 tests: 82 passed.
  - **S0-10** (it restarts the dev server) failed once: its first sign-in after the cold restart did not show the top
    bar within 15 s.
  - Alone three times it passed twice and failed once, the same way. Its passing rounds took 1.1 and 1.2 min, as in
    step 2's full run (1.2 min), so the cold compile did not grow.
  - It is the flake slice 13's acceptance doc describes (and slices 8 and 10c), with the same symptom. I report it and
    changed nothing.
- **The element guard**, against slice 8's counts on the measurement build: the viewport's counts are equal (4,508,
  19,305, 1,465, 4,907).
  - The page totals are 6,136, 20,933, 3,003 and 6,445, **one more than slice 24's** (6,135 …).
  - `S13-head-elements` shows `<head>` with 29 children: one more JavaScript chunk than before. The font preloads are
    still the five Sans and Mono files, so Serif is not loaded there. Nothing drawn changed.
- `npm run lint` no problems, `npm run typecheck` passes, `npm test` 172 files, 2,163 tests passed.

**Earlier tests changed:** none. `tests/document-tree.test.ts` (step 3) gets the pill's `status` field.

### The reference figure (Q-P1, no bar)

The method:
- `MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-25/S25-layout.spec.ts`, on the measurement build in
  headless Chromium 153;
- the laptop as in step 3 (i7-8550U, 7.9 GB, Windows 11);
- "Performance test" added to the e2e file, with a full data dictionary there: every field and column, all mappings;
- one warm-up load, then 5 loads.

**42 pages.** From the navigation's start to "{n} pages": median **5.8 s** (5.7–6.8). Paged.js's part alone (from its
start to the last page): median **4.3 s** (4.1–5.3). The rest is the page's load and the server's snapshot, tree and
HTML (step 3's tree: about 13 ms).

### Screenshots

`docs/prd/slice-25-screens/step-4/`:
- `1-documentation-tab.png`;
- `2-form.png`;
- `3-title-page.png`;
- `4-dictionary-page.png` (page 4, the dictionary's first).

The pages are taken in print media at 900 × 1200, so each is whole.

## Step 4b: small fixes (12 November 2026)

Łukasz's answers to step 4, built in `94f9ef1`:

1. **The title page in IBM Plex Sans,** as the prototype's default template. The Serif files, their loader and their
   README rows are removed; templates and Serif come with slice B.
2. **Breadcrumbs** on the form and the document page: "{organization} › {workspace} › Documentation › {document}".
   - `AppShell` takes a `trail` after the workspace; it was "Workspace home" before.
   - The organization stays first, as on every page.
   - "Documentation" links to the tab.
3. **Only its author makes a shared document private.**
   - `shareRefusal` refuses anyone else with "Only {author} can make it private." (`forbidden`). F17's refusal stays,
     first, while the author is no longer a member.
   - The form shows the check box disabled for everyone but the author, with the reason under it (the F17 text while the
     author is gone).
   - A document the person can no longer open (form or page; gone, made private by its author, another's private one,
     InfoDocumenter off) redirects to the Documentation tab with `?gone=document`. The home shows "This document is no
     longer available to you." (`HOME_GONE`), never a 404.
   - Tests: the domain's matrix gets `unshare`, and the unsharing tests cover the author and every other role.
     S25-02's tests now check the author-only rule and the return to the tab, the author-left case, and the redirect
     where step 4 expected a 404.
4. **Twelve attribute definitions,** written by the documents' demo layer only (`DEMO_ATTRIBUTE_DEFINITIONS` in
   `src/modules/infodocumenter/data/demo.ts`; `seed-model.ts` unchanged), and only where an attribute has none. They
   are:
   - Customer: `customer_id`, `birth_date`, `segment_code`;
   - Customer Address: `postal_code`;
   - Sales Order: `order_number`, `order_date`, `total_amount`, `status_code`;
   - Order Line: `quantity`, `discount_pct`;
   - Product: `sku`, `list_price`.

   **No earlier spec changed:** every earlier fixture reads `addFullDemoData`, which writes none of them
   (`tests/documents-demo.test.ts` checks both).
5. **Paged.js and the extra chunk, from the build's output** (the measurement build):
   - **Paged.js** is the chunk `2ug013kwm7s6u.js` (498,070 bytes, "Paged.js v0.4.3"). Only `1b-r-kf2ofutg.js`
     references it (the dynamic import's loader), and only the two document pages' client manifests
     (`/w/[workspaceId]/d/[documentId]` and `…/view`) reference that loader. No chunk in the canvas page's `<head>`
     contains `pagedjs`.
   - **The extra element:** I built `main` (`e987f82`) in the same checkout and read the canvas page's `<head>` on both
     builds: 28 children on `main`, 29 on the branch.
     - Main's chunk `10890hq23d_1a.js` (520,219 bytes) is on the branch two chunks, `1nmbhsl8bzt1u.js` (329,395) and
       `3o9yk2iz-4a4w.js` (196,216), 5.4 KB more in all.
     - The rest of `<head>`'s scripts have the same names; the first stylesheet's name changed (new classes); the font
       preloads are the same five.
     - The only InfoDocumenter text in a canvas chunk is the workspace settings schema's `infodoc` switch (step 2).
     - So the extra element is one chunk split in two by the bundler, not Paged.js.

**Runs:**
- `npm run lint` no problems, `npm run typecheck` passes, `npm test` 173 files, 2,165 tests passed;
- `e2e/slice-25`: **25 passed, 1 skipped** (S25-layout);
- the element guard on the measurement build: viewports equal slice 8's (4,508, 19,305, 1,465, 4,907), page totals
  6,136, 20,933, 3,003, 6,445, as in step 4;
- no earlier spec changed.
- The screenshots in `docs/prd/slice-25-screens/step-4/` are retaken with the Sans title page.

## Closing (12 November 2026)

### Docs

- `docs/decisions.md`: **D-80** (a new section "InfoDocumenter"), marked as proposed and awaiting Łukasz's approval, and
  notes "(slice 25)" on **AD-05**, **AD-18**, **AD-33** and **AD-35**; quoted in the report.
- `docs/data-model-v2.md`: written in step 2 (`workspace.infodoc`, the licence's values, AD-18's fourth place,
  `document_definition`); nothing changed since.
- `docs/inventory-prototype-vs-app.md`: a summary row and a section "InfoDocumenter" (what the prototype has beyond the
  slice, what is present, the deliberate differences).
- `README.md` and `CLAUDE.md`: the status; CLAUDE.md's extension points (document sections, `optionChecks`, a module's
  own pages, the home's module tab, one snapshot, a module's objects outside the model), slice 25's helpers and the
  commands.
- `docs/known-limitations.md`: a section "InfoDocumenter (slice 25)":
  - module switches and licences as positional arguments;
  - the `pagedjs` alias;
  - the layout's reference figure, with a live preview needing another approach;
  - the German labels and InfoCube's German words awaiting review;
  - the plain seed's attribute definitions;
  - a removed author's private documents;
  - change events holding the whole recipe.
- `docs/ideas.md`: "InfoDocumenter: done in slice 25, and what comes later" (PRD section 9, and F30's copy and transfer
  points), and "Baselines: the design agreed for their slice (11 November 2026)" as Łukasz gave it.
- `docs/ideas_infodocumenter.md`: two sentences at its top; its text unchanged.

### Manual acceptance (PRD section 6)

On the demo (`npm run demo -- --reset`, http://127.0.0.1:3001; never `.data/dev-db.json`):
1. Sign in as Łukasz; Retail Co – DWH; the Documentation tab shows "Retail Co – data dictionary" (shared) and "Order
   management – S2T for the ETL team" (private).
2. **New document → Data dictionary for the business:** the form opens. Give it a name and a title; under Scope tick
   the project "Customer 360"; Open document. "Laying out pages…", then "{n} pages":
   - a title page without header or footer;
   - contents whose page numbers match;
   - the header, the footer, "Page n of m" and "DRAFT · live model" from page 2;
   - only Customer, Order Line and Sales Order in the dictionary;
   - the definitions under their rows (Customer.customer_id, Sales Order.order_date…).
3. **New document → Source-to-target specification for ETL:** it ends with the Dimensional model (InfoCube is on).
   Open it: the mappings by entity with "Rule" under each row, then Facts and Dimensions with grain, roles, keys, "No
   match →", measures and feeds.
4. **Print** (the page's button, or the form's Print): the browser's dialog shows A4 portrait pages without the app
   around them. Save as PDF and look at it.
5. Sign in as **Kasia (reader, guest)** in another browser: she sees the shared document only, opens it read only, and
   makes and prints a private one.
6. As **Anna**, open the shared dictionary: "Shared with the workspace" is disabled, "Only Łukasz can make it private."
   As Łukasz, untick it. Anna's open page, reloaded, returns to the tab with "This document is no longer available to
   you."
7. **Settings → InfoDocumenter:** turn it off. The toast names the documents kept, and the tab goes. Turn it on: they
   are back.
8. Settings → Documentation language **Deutsch** (or Polski): open a document; the headings, labels and InfoCube's words
   are in that language. **Review the German words** (step 3's list).

KB: the local file's format changed in step 2 (17). Upgrading Łukasz's file happens only on his command, after the
backup "Łukasz's test model" requires; then a dictionary of Kanton Basel.

### The full run

See the report: the workflow "E2E" on the final commit.
