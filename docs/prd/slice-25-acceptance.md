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
