# Slice 15 – acceptance

- Branch: `slice/15-infocube`
- Start: `main` at tag `slice-14b`, `3f037dfe6f4e9a69d623387c9c9cdf11b233f655` (main was not further; assumption A1 holds)
- Date: 4 November 2026
- PRD: `docs/prd/slice-15-infocube.md`; spec: `docs/infocube/iteration-1-spec.md`; prototype:
  `docs/prototype/infomapper-prototype-with-sources.html`. All three are copied unchanged from Łukasz's Downloads in commit
  `e6116b7` (Q1).

## Step 1: the PRD checked against the code (4 November 2026)

Read: the PRD and the spec; `docs/decisions.md` (D-07, D-38, D-46 to D-52, D-61, D-63, D-64, D-66, AD-05, AD-06,
AD-08 to AD-15, AD-19, AD-23, AD-24, AD-26, AD-29, AD-31, AD-32); CLAUDE.md; `docs/known-limitations.md` ("The
requirement index is rebuilt on every write"); `docs/ideas.md` (the InfoCube concept, the plan); the prototype's diff
`slice-14b..e6116b7` (566 lines added, 47 changed or removed), function by function.

Code, by area:
- **Domain:** `src/domain/permissions.ts`, `commands/shared.ts`, `entity.ts`, `attribute.ts`, `relationship.ts`,
  `mapping.ts`, `concept.ts`, `workspace.ts`, `organization.ts`, `undo.ts`, `canvas-item.ts`, `frame.ts`, `label.ts`,
  `requirement.ts`, `live.ts`; `model/impact.ts`, `copies.ts`, `mapping-rules.ts`, `mapping-choice.ts`,
  `requirements.ts`, `requirement-index.ts`, `lit.ts`, `thumbnail.ts`, `change-label.ts`, `undo-history.ts`;
  `source-changes/*`; `import/*`; `changes.ts`, `types.ts`.
- **Data:** `src/data/ports.ts`, `index.ts`; `local/schema.ts`, `file.ts`, `store.ts`, `seed.ts`, `seed-model.ts`,
  `seed-requirements.ts`, `dev-data.ts`, `seed-large.ts`; `supabase/migrations/*`; `scripts/check-schema.ts`;
  `tests/schema/*`.
- **App and UI:** `src/app/_lib/run-command.ts`, `shell.ts`, `unlock.ts`, `project-view.ts`; `_actions/model.ts`,
  `mapping.ts`, `workspace.ts`; `_panels/left-panel.tsx`, `tree-data.ts`, `entity-panel.tsx`, `attribute-panel.tsx`,
  `mapping-panel.tsx`, `inspector.tsx`, `delete-entity-dialog.tsx`, `delete-concept-dialog.tsx`, `fields.tsx`,
  `canvas-host.tsx`, `map-column.tsx`, `model-index.ts`, `stats.ts`, `status-bar.tsx`, `overview-panel.tsx`,
  `source-panels.tsx`, `classifications.tsx`; `_components/settings-form.tsx`, `use-action.ts`; the canvas page and both
  homes.
- **Canvas:** `card-data.ts`, `CardNode.tsx`, `canvas.css`, `line-data.ts`, `line-geometry.ts`, `LineLayer.tsx`,
  `ColumnDrag.tsx`, `CanvasModes.tsx`, `ModelCanvas.tsx`, `context.ts`, `FadeLayer.tsx`, `fade-canvas.tsx`,
  `CoverageLayer.tsx`, `HoverOverlay.tsx`, `Overview.tsx`, `BlockNode.tsx`, `SelectionHistory.tsx`, `Focus.tsx`,
  `save-cuts.ts`.
- **Repository:** `eslint.config.mjs`, `tests/layer-rules.test.ts`, `e2e/parts.ts`, `e2e/global-setup.ts`, and the e2e
  specs listed under Q15.

No application code was changed.

### Summary of what step 1 found

1. **The PRD's model is sound.** Facts and dimensions as entities with a level (C-2) fit the code well: requirement
   links, label links, canvases, aliases, cards and panels work for them unchanged, because they are `entity` and
   `attribute` rows.
2. **The application has no extension mechanism today.** There is no registry and no slot anywhere in `src`. Every
   extension point in Q3 is new code in InfoMapper. The hardest ones are not in the UI. They are the **data layer and
   undo, which name every table in closed lists** (F5). A module table cannot exist without InfoMapper knowing it, so
   the slice needs a table registry first.
3. **The C-7 read-only rule cannot be one check per command.** About 25 commands and 10 indirect paths write entities,
   attributes and relationships, and most do not have the entity's row (F3). One check on the **write set**, in
   `runCommand` and in undo, catches them all (F4).
4. **Q5: M1 (InfoCube's own mapping tables).** M2 would touch about 50 InfoMapper sites and the `mapping_input` type
   (about 120 lines in 45 files). It would also hide two bugs, and it would make InfoMapper tell the levels apart in
   imports and changes to resolve. M1 needs about 8 hooks, most of which the spec asks for anyway.
5. **Proposed split: four sub-slices, not three** (Q14). The PRD's 15a carries nearly all the infrastructure plus most
   of the visible behaviour. That is too large to accept as one step.
6. **Conflicts to decide** (section "Open questions for Łukasz"):
   - Is the setting shown without a licence? The PRD says no; the prototype shows it disabled.
   - Do drag targets stay lit while InfoCube is off? The spec says no; the prototype keeps them lit and refuses at the
     drop.
   - Is undo refused while off? The PRD says every change is refused; the prototype lets undo through.
   - Who approves a dimensional mapping? The prototype allows editors only, with no four-eyes; InfoMapper's mappings let
     reviewers approve, with four-eyes.
   - Where does the demo star go?

### Findings

| # | Finding | Files and functions | Proposal |
| --- | --- | --- | --- |
| F1 | **The repository's docs are not all at slice 14b's closing.** The README's status line still says slice 14b "is on its branch, waiting for the manual acceptance". `docs/ideas.md` still says "Next: InfoCube, starting with a concept document" (the PRD knew this one). The latest acceptance doc is `slice-14b-acceptance.md`, which is complete. | `README.md` l. 5; `docs/ideas.md` l. 63 | Fix both in 15a's closing, with the slice status. Step 1 changes no other doc. |
| F2 | **There is no registry or extension mechanism anywhere in `src`.** The canvas, the panels, the left panel, the delete previews, the domain and the data layer are all closed: hard-coded tab arrays, `switch` statements on selection kinds, closed table lists. Every one of the PRD's "named extension points" is new code in InfoMapper. | Q3 lists each one | Build each extension point in the sub-slice that first needs it (Q14), and only the ones InfoCube uses. |
| F3 | **No single domain guard sees which entity a write touches.** `begin` (`shared.ts` l. 18) knows only the workspace and the action. About 25 commands write entities, attributes, relationships or mappings, and most of them hold only the attribute, relationship or mapping, not the entity. Indirect writers add to this: `followOriginals` (copies), a concept's "move to" and `moveToConcepts` (`entity.concept_id`), label and requirement links, `completeLiveWrites`, the import and the change-to-resolve actions. | `permissions.ts` `checkPermission` l. 105; `shared.ts` `begin`; Q3 (b) | No per-command check. Use one pure domain function, `checkLevelWrites(writeSet, model, workspaceOn)`, on the finished write set (F4). |
| F4 | **The C-7 check fits on the write set,** in `runCommand` after `build` and before `store.apply`, and in `undoAction` before the revert is applied. It refuses a write set that inserts, updates or soft-deletes a dimensional `entity` or `attribute` row, or a `relationship` with a dimensional end. It lets these through: `canvas_item`, `frame`, `note`, label and requirement links, and the module's rows, which the module's own commands check (C-7) and which also arrive as cascades of logical deletes (F8). It does **not** mutate and roll back, as the prototype's `permitChange` does. | `run-command.ts` l. 77–93; `_actions/undo.ts` l. 65–82 | As described. One guard covers direct calls (S15-04) and every indirect writer (F3). A refusal gives the C-7 message with code `forbidden`, which cuts on the save chain like a permission refusal (slice 13). Question O3 covers undo while off. |
| F5 | **Module tables cannot exist without InfoMapper naming them.** These all name every table: `WritableRows` (`types.ts` l. 607), `UNDOABLE_TABLES` and `PARENTS` (`undo.ts` l. 37, 73), `keyOf`, `NOUN` (`change-label.ts` l. 6), `loadForUndo` (`store.ts` l. 200), `DevDb`, `emptyDb` and `RULES: Record<DevTable, …>` (`schema.ts` l. 87–511), `DataStore` (`ports.ts` l. 168), and the schema check's domain tables (`tests/schema/domain-tables.ts`). A write set with an unknown table is silently **not undoable** (`isUndoable` l. 142). If `deleteEntity` wrote a `cube_entity` row that undo does not know, every entity delete in the workspace would lose its undo without any error. | as listed | **A table registry first (15a):** `ModuleTable` = `{ name, rowType, rules: TableRules, parents: Record<column, table>, noun }`. The adapter, undo, the change labels and the schema check iterate InfoMapper's tables plus the registered ones. `WritableRows` stays an open interface that the module extends by declaration merging (types only). This is the largest structural change of the slice. A unit test: with a registered table, a group with its rows is undoable, and `findViolation` checks its rules. |
| F6 | **Undo writes a missing image column as null.** `unchangedSince` (`undo.ts` l. 298) and the revert (l. 276) treat a column absent from an old image as null (slice 7a's rule). For a NOT NULL `entity.model_level` with a CHECK, an old entity event would look "changed afterwards", and a revert would write null and break the CHECK. In practice the undo history lives in memory and is empty after a restart, so after the file's upgrade no older step exists. S15-02 still asks for the rule, and the database slice will keep events. | `undo.ts` `unchangedSince`, `revertChangeGroup` | An `IMAGE_DEFAULTS` map in undo, `{ entity: { model_level: "logical" } }`: an absent column reads as its default, both when comparing and when reverting. This is a unit test, not an e2e criterion. |
| F7 | **`entityImpact` is a server action; the attribute's second click is computed in the browser.** The entity dialog gets `[what, happens]` rows from `entityImpactAction` (`_actions/model.ts` l. 111) through `entityImpact` (`impact.ts` l. 68). The attribute's second click builds its text in the browser, from the page's index (`attribute-panel.tsx` l. 94, `canvas-host.tsx` l. 600, `armedDeleteText`). It is one line, not a table. X-3 asks for a **dialog** with a table for an attribute that feeds something ("Delete {a}?", "What / What happens"). The app has no attribute delete dialog. Relationships and concepts have no preview. | `impact.ts`, `delete-entity-dialog.tsx` l. 56–70, `fields.tsx` `armedDeleteText` l. 648 | Entity: `moduleDependents("entity", id, state)` adds rows on the server in `entityImpactAction`. Attribute: the same function runs in the browser on the page's module rows (the page has them when the workspace has any, Q10). It opens a new dialog when it returns rows, and otherwise keeps today's first or second click, so earlier specs are unchanged. Relationships and concepts get no preview: deleting a concept is refused while it holds entities, and a relationship's delete has no module dependency. |
| F8 | **Cascades should be a post-step in `runCommand`, not code in each delete.** `runCommand` already appends writes into the same change group after `build`: `withSettledChanges` (l. 175), which rebuilds the events with the same `change_group_id`. A module cascade hook, `moduleCascades(writeSet, state) => Write[]`, runs there. It reads the soft-deleted attributes and entities in the write set and returns the module rows to soft-delete. That covers `deleteEntity`, `deleteAttribute`, a merge, undo's own reverts and every later delete, without touching each command. | `run-command.ts` l. 151–184 | As described, plus one rule: a dimensional mapping goes whole when any input goes (Q-5). Undo restores it through `PARENTS` (F5). The prototype prunes orphans while indexing; here the command writes them (PRD item 8). |
| F9 | **There is no Data Vault section on the entity panel.** The only Data Vault reading is on a source table's panel (`source-panels.tsx` l. 183, `classifications.tsx` `DataVaultReading`). X-6's "Data Vault hints absent on dimensional entities" is therefore already true in the app. Only the stereotype is left (C-5). | as listed | S15-17 drops the Data Vault part (nothing to test), or keeps it as an absence check. |
| F10 | **The duplicate-name warning compares across the whole workspace,** and so does default naming. `hasDuplicate` (`entity.ts` l. 26) runs on create (l. 98) and update (l. 158), and `freeDefaultName` (l. 31) numbers "New entity" the same way. The prototype compares within one level only on create and on "Create dimension from this…". Its rename handler still compares across levels, which is a prototype bug. | `entity.ts` `duplicateNameWarning`, `hasDuplicate`, `freeDefaultName` | Within one level everywhere: create, rename, default names ("New fact", "New dimension" numbered among dimensional entities) and "Dim {entity}". One rule in `hasDuplicate` with the level passed in. |
| F11 | **The relationship command checks nothing but the ends' existence.** `createRelationship` (`relationship.ts` l. 20–47) only uses `found()`. The default ends are from 1..1 → to 0..n, so "the dimension is the 1..1 end" means the dimension is `from`. `swapRelationship` (l. 105) and `updateRelationship` (l. 76) can turn it back afterwards. | `relationship.ts` | The level rule comes after l. 32. The turn swaps the ids at create when `from` is a fact and `to` a dimension. It needs the role, so the module adds it through a hook, `relationshipEnds(from, to) => { swap?: true } \| { refuse }`, and InfoMapper itself knows only the level rule (C-4). Swapping back later stays allowed, as in the prototype. Q8 covers self-relationships. |
| F12 | **Pasting a logical attribute into a dimension would make it a follower** (D-63). `pasteAttribute` (`attribute.ts` l. 244) has no entity rule. `followOriginals` (`copies.ts` l. 65) then writes the dimensional copy whenever the original's type or Personal data changes. While InfoCube is off, F4's guard would refuse an ordinary **logical** edit because of its dimensional follower. The prototype has no paste. | `attribute.ts` `pasteAttribute`; `canvas-host.tsx` `pasteInto` l. 209 | **Paste within one level only** in iteration 1. A paste across levels is refused with a toast that points to the dimensional mapping. Question O6. |
| F13 | **A column dropped on a dimensional card would create a source mapping onto it.** `createAttributeFromColumn` (`attribute.ts` l. 356) and `createMapping` accept any attribute. B-6 refuses a column onto a fact or dimension in the browser. The domain must refuse it too, because a direct call would otherwise succeed. | `attribute.ts`, `mapping.ts` `createMapping`, `addMappingInput` | The domain refuses a source mapping onto a dimensional attribute (a level check InfoMapper may do, C-4: it knows the level). The column panel's "Map to an attribute" list (`model-index.ts` `attributeOptions` l. 137) shows logical attributes only, as the prototype's `attrOptions(sel, dim)` does. |
| F14 | **The workspace setting lives on the workspace home, not in a modal.** `dv2_mode` and `four_eyes` are on the Settings tab (`w/[workspaceId]/page.tsx`, `settings-form.tsx` l. 139–155), saved through `saveRow` → `updateWorkspaceSettings` (`workspace.ts` l. 147, owner and admin). The prototype's InfoCube box sits after Data Vault in a settings modal. There are no organization pages, and `Organization` has only its name. | as listed | The InfoCube switch goes in the "Methodology" card after Data Vault 2.0. It is a `useChoice` saved like `dv2Mode` (`infocube?: boolean`); the domain checks the licence. Turning it on or off is outside undo, as the other settings are. |
| F15 | **Making an existing type "aware" of the level is cheap; the selection kinds are not.** `Selection` (`line-data.ts` l. 149) is matched in about 8 places: `onHoverOver`, `CanvasModes.onContextMenu`, the Delete key, `showPlace`, `GONE`, `focusTargetOf`, `relatedLines` and `inspector.tsx`'s panel switch. A dimensional mapping is a new kind in every one of them. | as listed | One generic arm, `{ t: "ext"; kind: string; id: string }`, with a registered handler per kind (`exists`, `gone` text, `panel`, `related`, `menu`). InfoMapper's switches gain one `case "ext"` each, rather than one per module kind. |
| F16 | **The demo LDM for the Sales star is complete in the seed.** All six entities, all 17 attributes the star reads, and the four concepts exist (`seed-model.ts` l. 75–139). Customer.segment_code, Order Line.quantity, unit_price and discount_pct have **no** source mappings in the seed, so REQ-210's coverage of 0/3 holds in the app as it does in the prototype. The seed has REQ-101 to REQ-105, with the next key 106. | `seed-model.ts`, `seed-requirements.ts` l. 17 | REQ-210 keeps its key, written with the key explicitly (the counter stays 106). Question O7. |
| F17 | **e2e reseeds from the same seed as `npm run seed`.** `e2e/global-setup.ts` and every slice's fixtures call `resetDevData`. Adding the star to the seed adds a canvas to Order management, five entities to the workspace and the licence to InfoMate in every earlier spec's data. | `e2e/global-setup.ts` l. 10, 28; `src/data/local/dev-data.ts` | Q13: the star as a domain-written step that the dev seed runs and that e2e runs only for slice 15's specs. |
| F18 | **The left panel at its minimum width (200 px) has room for three tabs.** The prototype tightened the tabs' font (12.5 to 12 px, with an ellipsis) to fit "Cube". | `left-panel.tsx` l. 501 | The same in the app, checked at 200 px with screenshots. This is a visual change to every page's tab bar while InfoCube is off too, unless the font changes only when four tabs show. Proposal: only with four tabs. |
| F19 | **The Overview's "Mapping coverage" counts source mappings.** The prototype counts dimensional entities as "fed" there ("Attributes fed from the logical model"). The PRD does not list it. | `overview-panel.tsx` l. 53 | It joins B-3's coverage rule in the sub-slice with the lines (15c), as a difference the PRD missed. |
| F20 | **Starting the branch's dev server upgrades Łukasz's KB file in place, with no way back.** `readDb` upgrades on read and writes back (`file.ts` l. 58). A file at format 12 makes `main`'s code throw (`readDb` refuses an unknown format). | `file.ts` `readDb`, `upgradeDb` | Back up KB (`.data/backups/dev-db-<yyyymmdd-hhmm>.json` and `kb-model-latest.json`) before the **first** dev or e2e run of 15a, not only before the manual acceptance (A3). Going back to `main` means restoring that backup. |
| F21 | **The prototype has no "Relate to itself" (D-61 is the app's, slice 10a).** The same-level rule allows it on a dimensional entity. | `relationship.ts` l. 40 | Allowed on facts and dimensions, as on logical entities (Q8). |

### Q1. The starting point

- **git** (4 November 2026, before any change):
  - `git status`: clean, on `main`, up to date with `origin/main` after a fetch.
  - `git log -1 --format='%H %s' main`: `3f037dfe6f4e9a69d623387c9c9cdf11b233f655 Merge pull request #35 from
    LukaszWolski-DA/slice/14b-canvas-row-and-leaving`.
  - Tag `slice-14a` (annotated, object `d6d9235…`) → commit `797dd62f9a774d55f84d12b6a65621c1c4f1063f` (PR 34's merge).
  - Tag `slice-14b` (annotated, object `2bfad39…`) → commit `3f037dfe6f4e9a69d623387c9c9cdf11b233f655` = `main`.
  - Slice 14b is merged and tagged. `slice/15-infocube` was created from `slice-14b`.
  - Open branches: every earlier slice branch, the `perf/4p-*` trials, `chore/*`, `docs/*` and `spike/canvas-follow-up`
    still exist locally and on `origin`. Nothing is unmerged that the slice depends on. They are left as they are.
- **Docs:** see F1. The README's status line and `docs/ideas.md`'s "Next" are behind; the acceptance docs are up to
  date.
- **The prototype:**

  | Copy | Bytes | SHA-256 | InfoCube code |
  | --- | --- | --- | --- |
  | Repository at `slice-14b` | 584,023 | `5957d79ef1b57ba6a3d690d603096b4ab68592dfc7c4ea43b8d74c5675477510` | none: 0 matches for "infocube" |
  | Łukasz's (Downloads) | 637,514 | `6e8e9b95ef5c5bae2c53817e0d2aa734fef3511018a1e68fae6491dd151b37d3` | 29 lines match "infocube"; the diff is 566 added and 47 changed or removed lines |

  Replaced in commit `e6116b7`. `cmp` reports the copy identical to the download, and the committed blob's SHA-256 is
  the one above. Every file is LF only, so `.gitattributes` (`text=auto eol=lf`) changes no byte.
- **The spec** lives at **`docs/infocube/iteration-1-spec.md`**: it is a module's behaviour spec, not a slice PRD, and
  later iterations (role-playing) get their own file next to it. 18,790 bytes, SHA-256
  `f9647a12375c4cda2c2c690b619c75cc3e5a696b908d03b51b16a7d5c0002033`, `cmp` identical, unchanged. The IC-10 difference
  is recorded here, not in the spec: the prototype shows "6 dimensional mappings – deleted, 4 of them approved" and
  "Fact Orders, Fact Sales – lose their feed from the logical model", the spec "5 …" and "Fact Sales loses its feed…".
  S15-12 uses the prototype's figures.
- **The PRD:** `docs/prd/slice-15-infocube.md`, 32,210 bytes, SHA-256
  `26aae0ab2b71c3a7e5829411680b165f95645266b64ac05188587f718541309a`, `cmp` identical.

### Q2. The module in the layers

**Proposal: the module mirrors the layers inside its own folder,** and one composition root wires it in.

```
src/modules/infocube/domain   pure: types, commands, rules (hints, keys, bus matrix, cascades, dependents)
src/modules/infocube/data     its table registrations (ModuleTable, F5) and its repository part
src/modules/infocube/ui       components without the canvas
src/modules/infocube/canvas   card decorations, the line kind, the drop resolver
src/modules/infocube/app      server actions, panels, the Cube tab, the bus matrix dialog
src/compose/                  the composition root: the only code that imports a module
```

**Why not `src/domain/modules/infocube/` and so on:** the module's code would sit inside InfoMapper's layers, and C-1's
lint rule ("InfoMapper never imports it") would have to tell the folders apart within one layer. A folder of its own
makes the rule one pattern.

**The composition root.**
- `src/compose/server.ts` lists the server-side hooks: tables, the write guard's module part, cascades, dependents,
  relationship ends, requirement feeds, card decorations and lines, which `buildCards` and `buildLines` run on the
  server.
- `src/compose/client.tsx` lists the browser-side hooks: the line kind's drawing, drop resolvers, toolbox items,
  selection kinds, panel sections and the left tab.
- InfoMapper's `app` layer imports `@/compose` and hands the hooks down **as arguments and through context**:
  - to `runCommand` and undo;
  - to `buildCards`, `buildLines` and `lookupModel` as a parameter;
  - to the canvas and the panels through a `ModulesProvider` in `layout.tsx` and props.
- **No global registry filled by import side effects:** the order in which Next.js evaluates server and client chunks
  would decide whether a hook is there. It is also invisible in tests.

**Read literally, C-1 is kept by `src/compose/` alone:** `app → compose → modules`. InfoMapper's layers (`domain`,
`data`, `ui`, `canvas`, `app`) never name a module path. They only define the extension points' types, and `app` takes
the list from `compose`. Question O1 asks Łukasz to confirm this reading.

**The lint rules (`eslint.config.mjs`), in words:**
1. **New elements:**
   - `ic-domain`, `ic-data`, `ic-ui`, `ic-canvas`, `ic-app` for `src/modules/infocube/<layer>/**`;
   - `compose` for `src/compose/**`.
   - Until they are elements, `src/modules/**` is not checked at all (the plugin ignores non-elements).
2. **InfoMapper's five policies stay as they are.** With `default: "disallow"` they already forbid importing any `ic-*`
   or `compose` element. The one change: `app` may also import `compose`.
3. **The module follows the same directions, inside itself and towards InfoMapper:**
   - `ic-domain` → `domain`, `ic-domain`;
   - `ic-data` → `data`, `domain`, `ic-data`, `ic-domain`;
   - `ic-ui` → `ui`, `domain`, `ic-ui`, `ic-domain`;
   - `ic-canvas` → `canvas`, `ui`, `domain`, and the module's `canvas`, `ui` and `domain` parts;
   - `ic-app` → every InfoMapper layer and every `ic-*`.
4. `compose` → `ic-*` and InfoMapper's extension-point types (`domain`, `canvas`, `ui`, `app`).
5. **Domain purity for `ic-domain`:** the `pureDomain`, `noStorage` and `noOtherLayers` blocks are applied to
   `src/modules/*/domain/**` too. `noOtherLayers` gains `modules` and `compose` in its pattern, so `@/modules/…` from
   `src/domain` is caught by both rules.
6. **The import-samples rule** covers `src/modules/**`.
7. **S15-01's test:** `tests/layer-rules.test.ts` gets probes in its existing style (`lintText` with a virtual
   `filePath`):
   - a file in `src/canvas/` importing `@/modules/infocube/canvas/x` gives `boundaries/dependencies`;
   - so does one in `src/domain/` importing `@/modules/infocube/domain/x`, plus `no-restricted-imports`;
   - `src/modules/infocube/domain/` importing `react` is refused;
   - `src/modules/infocube/app/` importing `@/app/_lib/run-command` is allowed.

   Today the test probes only the domain and only `no-restricted-imports`. The new probes add `boundaries/dependencies`.

**The module's app part imports `src/app`.** The field kit (`useDraft`, `TextField`, `TextArea`, `useChoice`,
`DraftLine` in `_panels/fields.tsx`) and the save chain (`saveRow` and `saveRows` in `_components/use-action.ts`) are in
`src/app`. That is why `ic-app` may import every InfoMapper layer, as `app` may. They stay where they are (Q9).

### Q3. The extension points: the inventory

Each row gives its sub-slice (Q14). Costs: **S** is one insertion; **M** is a refactor of one component or function;
**L** spans several files.

| # | Place | Today (file, function) | What InfoCube needs | Smallest hook | Cost | Sub-slice |
| --- | --- | --- | --- | --- | --- | --- |
| E1 | Module tables, undo, adapter, schema check | `WritableRows` (`types.ts` l. 607), `UNDOABLE_TABLES`/`PARENTS`/`actionFor` (`undo.ts`), `NOUN` (`change-label.ts`), `DevDb`/`emptyDb`/`RULES` (`schema.ts`), `loadForUndo` (`store.ts`), `DataStore` (`ports.ts`), `domainTables` (`tests/schema`) | `cube_entity`, `cube_measure`, later `cube_mapping`/`cube_mapping_input`: stored, checked, undone, compared | `ModuleTable` registrations iterated by each (F5) | L | 15a |
| E2 | C-7 write guard | `runCommand` (`run-command.ts` l. 77–93), `undoAction` | refuse writes to dimensional rows while off | `checkLevelWrites` (InfoMapper: the level and the switch) plus the module's commands checking their own rows (F4) | M | 15a |
| E3 | Module on, cheaply | `loadShellFor` (`shell.ts` l. 58) already reads the whole workspace; `ShellData.workspace` is `{ id, name, archived }` | is InfoCube licensed and on, on every page | `ShellData.modules: { infocube: { licensed, on } }` (`on` = setting **and** licence, as the prototype's `cubeOn`); one read of `organization_licence` per shell | S | 15a |
| E4 | Workspace settings | `settings-form.tsx` Methodology card; `updateWorkspaceSettings` (`workspace.ts` l. 132–175) | the switch, shown to owners and admins, with the licence checked | the switch beside Data Vault 2.0; `infocube?: boolean` in the input, refused without a licence | S | 15a |
| E5 | Entity create, level and names | `createEntity` (`entity.ts` l. 67), `createEntityAction`, `freeDefaultName`, `hasDuplicate` | `model_level` on create; names within a level (F10) | an optional `level` input; the module's "New fact" action calls InfoMapper's command and writes its `cube_entity` row in the same write set (a module command wrapping `createEntity`) | S | 15a |
| E6 | Left panel tabs | `LeftTab` (`panels-context.tsx` l. 14), `TAB_NAMES`, the tab array and ternary (`left-panel.tsx` l. 496–513), `allGroups` (`tree-data.ts` l. 304) | a fourth tab "Cube" when on; the Model tab logical only | a tab descriptor list `{ id, name, render, groups }` with InfoMapper's three built in; the logical filter in `buildTree` (l. 151); export `TreeItem` and `GroupHead` | M | 15a |
| E7 | Card header and rows | `buildCards` (`card-data.ts` l. 209–246), `CardNode` (`line1`, `.c-head`, `Row`), `withClips` | role and cube instead of the stereotype; fact edge; hatch when off; Σ marks; "fed" coverage | `cardDecorators: (entity, model) => CardExt` run in `buildCards`; `CardData.ext?` and `CardRow.mark?` (absent = unchanged); `CardNode` renders them (Q11) | M | 15a (role, edge, hatch), 15b (Σ marks), 15c (coverage) |
| E8 | Collapsed frames' blocks, the miniature | `BlockMember` (`ModelCanvas.tsx` l. 1423), `BlockNode` `span.bk`; `Miniature` | the role in a block row | `role?` on `BlockMember`, a class on `span.bk` | S | 15a |
| E9 | Relationship ends | `createRelationship` (l. 20); `CanvasHost.relate` (`canvas-host.tsx` l. 168) | same level; turn fact → dimension | InfoMapper's level rule plus `relationshipEnds` (F11); the toast comes from the domain's refusal | S | 15a |
| E10 | Entity panel | `entity-panel.tsx`: Stereotype select l. 86, Definition l. 121–132, "Attributes and their sources" l. 136, "Feeding sources" l. 211 | Role (read-only); the InfoCube section after Definition; "Attributes and their logical feed"; no "Feeding sources" | `entitySections` slot after l. 132; a `roleOf` hook for the cell and the tree's `meta`; the two folds chosen by level | M | 15a (role), 15b (section), 15c (logical feed) |
| E11 | Attribute panel | `attribute-panel.tsx`: "Comes from" l. 286, "Copies" l. 317, the delete l. 332 | a Measure section (attributes of a fact); "Comes from the logical model" (dimensional); "Feeds facts and dimensions" (logical) | `attributeSections` slots after "Comes from" and after "Copies"; a level-chosen "Comes from" | S | 15b (Measure), 15c (mappings) |
| E12 | Inspector routing | `inspector.tsx` l. 196–222 | the dimensional mapping's panel | the `{ t: "ext" }` selection's `panel` handler (F15) | M | 15c |
| E13 | Delete previews | entity: `entityImpactAction`, `entityImpact`, `delete-entity-dialog.tsx` l. 56; attribute: `armedDeleteText` in the browser | X-1 to X-4 rows; X-3's dialog | `moduleDependents(kind, id, state) => [what, happens][]` (F7), always registered (C-7: also when off) | M | 15a (dimensional objects' own rows), 15c (mappings' rows, X-3's dialog) |
| E14 | Cascades | `deleteEntity`, `deleteAttribute`, `entityCascade` (`impact.ts` l. 31) | module rows deleted in the same group | `moduleCascades` post-step in `runCommand` (F8) | M | 15a (cube_entity, cube_measure), 15c (mappings) |
| E15 | Line layer | `buildLines` (`line-data.ts` l. 71), `CanvasLines`, `LineLayer` (l. 284, groups l. 470), `MapPath` | the dimensional line, its diamond, colour, dashes, ƒ | `CanvasLines.ext?: Record<kind, ExtLine[]>` built by `lineKinds[k].build`; drawn by the kind's `draw` in its own `<g>`, present only when not empty (as `sources`, slice 10b) | L | 15c |
| E16 | Hover, lit lines, Focus, the lens, bundles, the miniature | `onHoverOver` (`ModelCanvas.tsx` l. 2217), `hoverRows`/`relatedLines` (`line-data.ts` l. 183, 204), `HoverLines`, `LitLines` (`LineLayer.tsx` l. 560), `litSources` (`fade-canvas.tsx` l. 129), `CoverageLayer` l. 114, `bundleLines`/`bundleGeom` (`line-geometry.ts` l. 117, 187), `Miniature` (`Overview.tsx` l. 217) | the new kind in each | the line kind's `related`, `lit` (lit when both rows' cards are lit, like `litSources`), `bundle` (a `t: "ext"` bundle; `bundleLines` is generic over cards and rows), `miniPairs` (a prop to `Miniature`, outside `drawnKey`) | L | 15c |
| E17 | Dragging | `useColumnDrag` (`ColumnDrag.tsx` l. 37, starts only on `.card.src .row`), `findDrop` l. 28, `ColumnDrop` (`context.ts` l. 281), `host.dropColumn` → `map-column.tsx` | a drag from an entity row; dimmed non-targets; refusals; both directions | `rowDrag`: `dragStarts(rowEl)` and `resolveDrop(from, el) => { target } \| { refuse }`; `CanvasHost.dropRow` dispatches to the module. Dimming is one class on the canvas root plus a kept class on targets: no page-wide class (S5A-08), no opacity on repeated elements | M | 15c |
| E18 | Menus | `canvas-host.tsx`: canvas toolbox l. 385–405, card header `cardItems` l. 272–335, rows l. 576–620, mapping l. 407–450 | "New fact here", "New dimension here"; "Create dimension from this…"; the line's menu | `toolboxItems(target, api) => ToolboxItem[]` appended per section, before the danger items | S | 15a (toolbox), 15c (header item, line menu) |
| E19 | History places (D-38) | `placeOf` (`SelectionHistory.tsx` l. 39) takes any single selection; `GONE` l. 22; `showPlace` (`ModelCanvas.tsx` l. 1814); `focusTargetOf` (`Focus.tsx` l. 27) | Back and Forward to a dimensional mapping | `{ t: "ext" }`'s `exists` and `gone` text: "That mapping no longer exists." (the mappings' text) | S | 15c |
| E20 | Requirement scope and coverage | `lookupModel` (`requirements.ts` l. 143), `scopeOfLinks` l. 215, `coverageOf` l. 189, `countsForCoverage` l. 321; `requirementFocusLit` (`lit.ts` l. 78) | scope through dimensional mappings; X-5's coverage | `feedsOf(attributeId) => { id, approved, inputs }[]` passed into `lookupModel`; coverage recursive with a memo and a cycle guard; scope adds the inputs to `scope.attributes`, not to `attributeItems`; `Lit` gets `lines: Set<id>` for the dimensional lines | M | 15d |
| E21 | Requirement index | `buildRequirementIndex` (`requirement-index.ts` l. 42, `of` l. 87) | (optional) "via dimensional mapping" for a logical attribute | none in iteration 1; the prototype has none | – | – |
| E22 | Model consistency, thumbnails | `modelConsistency` (`consistency.ts` l. 75), `thumbnailIndex` (`thumbnail.ts` l. 81) | consistency: logical only; thumbnails: dimensional cards drawn as entity cards, no dimensional lines | the level filter only; no hook | S | 15a |
| E23 | Live label canvases, labels | `liveMembership` (`live.ts` l. 46), `MEMBERSHIP_COLUMNS` (`commands/live.ts` l. 179) | a dimensional entity or attribute with a label becomes a live card as any entity; a dimensional mapping cannot carry a label under M1 (`label_link` → `cube_mapping` would point the wrong way, C-4) | none | – | – |
| E24 | Baselines, workspace copy, transfer, export (AD-09, AD-14) | **none exist in the code**; the `baseline` table is in the initial migration only (`NOT_IN_DOMAIN_YET`) | – | none now. When they come, they iterate E1's registry, and a transfer checks the receiving organization's licence (otherwise read-only, C-7) | – | later |
| E25 | Homes' counts, status bar | `workspaceStats`, `projectStats`, `canvasStatus`, `cardsPerCanvas` (`stats.ts`) | X-6 and Q4 | level filters (Q4), no hook | S | 15a |

**The smallest set** is E1 to E25 without E21, E23 and E24: 22 points. Seven of them are level filters or a field, not
hooks (E3, E5, E8, E9's level rule, E22, E25, and parts of E10). **The real hooks** are about 14: E1, E2's module part,
E6, E7, E10, E11, E12/E15/E16/E19 (one line kind and selection kind), E13, E14, E17, E18 and E20.

### Q4. The model level wherever InfoMapper lists or counts entities

One domain predicate, `isLogical(e)` and `isDimensional(e)` in `src/domain/model/levels.ts`, used everywhere below.

| Place | Today | Proposed rule |
| --- | --- | --- |
| Model tab | `buildTree` (`tree-data.ts` l. 151): every entity by concept | logical only (B-1); a concept's count follows |
| Search | `show()` (`tree-data.ts` l. 245): name, alias, attribute names and aliases | each tab searches its own level; the Cube tab uses the same `show()` |
| A concept's delete dialog | `delete-concept-dialog.tsx` l. 32, 64: the concept's entities | **every** entity of the concept, both levels: a concept with only facts is not empty. The move to another concept also moves dimensional entities, which F4 refuses while InfoCube is off; then the dialog's refusal names the C-7 message |
| Duplicate-name warning | `hasDuplicate` (`entity.ts` l. 26): the whole workspace | within one level (F10) |
| Data Vault 2.0 reading | source tables only (F9) | nothing to change |
| Stereotype | `stereotype` not null, CHECK in five values; created as `object` (`entity.ts` l. 86) | a dimensional entity keeps `object`, never shown or changed (`updateEntity` refuses a stereotype on it). This needs no change to the CHECK or the column (C-5) |
| Status bar | `canvasStatus` (`stats.ts` l. 36): "Mapped attributes on canvas" = the attributes of entity cards; the mapping counts are the whole model | logical attributes only (X-6). The mapping counts are source mappings, unchanged under M1 |
| Workspace home | `workspaceStats` (`stats.ts` l. 57): `model.entities.length` | "Entities" counts logical ones. Nothing new is shown for facts and dimensions (an idea for `docs/ideas.md`) |
| Project home | `projectStats` (`stats.ts` l. 76): entities and attributes carded on the project's canvases | logical only, as the workspace home |
| Canvas tiles and tab counts | `cardsPerCanvas` (`stats.ts` l. 95); thumbnails | every card, both levels: they are cards on a canvas |
| Model consistency | `modelConsistency` (`consistency.ts` l. 75) | logical entities only (the validator for the dimensional level is out of scope) |
| Import review and suggestions | `impactIndex` (`wizard-model.ts` l. 126); suggestions are classifications | logical only (a source never maps to a dimensional attribute) |
| "Feeding sources" | `feedingSources` (`model-index.ts` l. 102); `fedEntities` l. 153 | the fold is not shown for a dimensional entity (B-4); `fedEntities` is unchanged (no columns feed one) |
| Attribute pickers | `attributeOptions` (`model-index.ts` l. 137); `map-column.tsx` l. 106 (a column dropped on a card, the same-name rule) | logical only (F13) |
| Copy and paste (D-63) | `pasteInto` (`canvas-host.tsx` l. 209), `pasteAttribute` (no rule) | within one level only; a paste across levels is refused with a toast (F12, O6). It is not a mapping: the dimensional mapping by drag is that |
| Aliases (D-64) | `aliases.ts`, the names switch, the search | unchanged: a fact or a dimension and their attributes have aliases like any entity |
| Requirement links, labels | AD-15 link tables | unchanged for dimensional entities and attributes |
| Create dimension: numbered names | – | "Dim {entity}" numbered among dimensional names (prototype) |

### Q5. Q-6 of the spec: where dimensional mappings live

**Recommendation: M1, InfoCube's own `cube_mapping` and `cube_mapping_input`.**

- **`cube_mapping`:** `attribute_id` → the dimensional attribute, `kind`, `rule_expression`, `status`, the note and
  approval columns as `mapping` has them.
- **`cube_mapping_input`:** `cube_mapping_id`, `attribute_id` → a logical attribute, `position`.

**Every reader of `mapping` and `mapping_input` today, and what each option costs:**

| Area | Readers (file, function) | M2 (a nullable `attribute_id` on `mapping_input`) | M1 |
| --- | --- | --- | --- |
| Coverage and requirements | `requirements.ts` `lookupModel` l. 143, `countsForCoverage` l. 321, `scopeOfLinks` l. 215; `requirement-index.ts` `of` l. 87; `lit.ts` `addMapping` l. 60 | **learn:** an approved attribute-input mapping has no column inputs, so today's rule counts it **covered** whatever its logical inputs are (a silent bug if missed) | one hook, `feedsOf` (E20) |
| Cards and stats | `card-data.ts` `buildCards` l. 161–188, 242; `model-index.ts` `indexModel`, `inputColumns`, `typeCheckOf`; `stats.ts` (4 functions) | **learn:** a logical row that feeds a dimension counts as "mapped"; every count must filter by level | the card decorator (E7); stats unchanged |
| Lines and bundles | `line-data.ts` `buildLines` l. 83–111 (inputs on table cards; a mapping with no input card is dropped, l. 97); `LineLayer`, `CoverageLayer`; `ModelCanvas.tsx` l. 950 | **learn:** inputs on entity cards, the diamond and the colour inside `MapPath` | a line kind (E15) |
| D-49 split and merge | `mapping.ts` `splitMapping` l. 326, `mergeMappings` l. 397 | **learn, and a bug:** `mergeMappings` removes duplicates by `source_column_id`; every attribute input has `null`, so all but the first are deleted | the module's own commands |
| D-51 and four-eyes | `mapping-rules.ts` `afterContentChange` l. 17, `checkMappingShape` l. 26, `isContentChange` l. 53 (hard-codes `mapping` and `mapping_input`), `checkFourEyes` l. 69; `store.ts` `changeEvents.listForMapping` l. 257 | reused as they are | reused: `isContentChange` takes its object types as a parameter, so the module reuses `lastContentEditor`; `listForMapping` gets a table parameter |
| Imports | `import/plan.ts` `buildPlan` l. 344, `planMappings` l. 822; `apply.ts` l. 281 | **ignore** attribute inputs in about 6 functions | nothing |
| Changes to resolve | `source-changes/actions.ts` (`mappingsReading`, `canApproveAgain`, `movePlan`, `mapToAttribute`, `decideColumnByColumn`, `approveAllPlan`), `rules.ts` `inputColumnsOf`, `fitsSource`, `delete.ts` `sourceDeleteCascade`, `derive.ts`, `settle.ts` l. 162, `held.ts` `tableRowIds`, `touched.ts` | **ignore** in about 14 functions; `settle.ts` would call `settleMappedColumn(null)` | nothing |
| Suggestions | `mapping-choice.ts` `planMapColumn` l. 24 (D-48) | **ignore** attribute-input mappings in the choice | nothing |
| Deletes and undo | `impact.ts` `entityCascade` l. 31, `entityImpact`; `attribute.ts` `deleteAttribute` l. 301; `undo.ts` `PARENTS.mapping_input` l. 90 | **learn:** the input side of the cascade (Q-5), a new parent | the cascade hook (E14), the impact rows (E13), registered parents (E1): the same work, outside InfoMapper's code |
| Consistency, thumbnails, feeding | `consistency.ts` l. 91–150 (drops mappings without column inputs: dimensional ones vanish quietly), `thumbnail.ts` l. 81, `model-index.ts` `feedingSources`, `fedEntities`, `mappingsOfColumn`, `system-panel.tsx` l. 26 | **ignore** in about 7 functions | nothing |
| Panels | `mapping-panel.tsx` l. 179–309 (inputs as columns, `columnOptions`), `attribute-panel.tsx` l. 118 | **learn** a second input kind, or a separate panel anyway | the module's own panel (B-4's is different: "Reads from the logical model", other texts) |
| Data and schema | `schema.ts` `mapping_input` l. 383 (foreign keys, unique on `(mapping_id, source_column_id)`); the initial migration l. 288–303 (`source_column_id uuid not null`, `mapping_input_uq`) | drop NOT NULL, add the column, an "exactly one input" CHECK, a second partial unique index; `MappingInput.source_column_id: Uuid \| null` breaks the build at about **120 lines in 45 files** | two new tables with RLS, through E1 |
| Live canvases | `commands/live.ts` `MEMBERSHIP_COLUMNS` l. 179, `domain/model/live.ts` | learn or ignore | nothing |

**Totals.** M2 changes about 22 sites that must learn attribute inputs and about 30 that must ignore them. M1 needs
about 8 hook points, all generic ("a module adds lines, feeds, dependents, cascades, tables"), and E13, E14 and E1 are
needed under either option.

**C-4 decides it.**
- Under M2, InfoMapper's own `mapping` table holds rows that exist only for the dimensional level. InfoMapper's imports,
  changes to resolve, counts and coverage would all have to tell them apart by level. That is InfoMapper knowing what
  "dimensional" means.
- Under M1, InfoMapper's mappings stay exactly what they are: source column(s) → attribute.

**The cost of M1:**
- The module has its own mapping commands: create, update, inputs (add, remove, reorder), status, delete. They are built
  on the pure helpers (`checkMappingShape`, `afterContentChange`, `checkFourEyes`). Split and merge are not in B-6.
- No requirement or label link to a dimensional mapping in iteration 1. X-5 does not ask for one; a later link table of
  the module's own would point the right way.
- The decision text for **AD-36:** "Dimensional mappings are InfoCube's own tables (`cube_mapping`,
  `cube_mapping_input`), pointing to InfoMapper's attributes; InfoMapper's `mapping` stays source column(s) →
  attribute."

### Q6. C-7's data and rights

- **Today:**
  - An organization is `{ name }` plus the standard columns (`types.ts` l. 49). Its password hash is in
    `organization_access` (slice 8, never sent to the browser).
  - Workspace settings: `dv2_mode` and `four_eyes`, written by `updateWorkspaceSettings` (`workspace.edit_settings`:
    owner and admin, refused when archived). They are outside undo; defaults are set in `newWorkspaceRows` (l. 78–79).
  - No organization pages exist. The People tab is on the workspace home.
- **Proposed shape:**
  - **`organization_licence`:** the standard columns, `organization_id` (FK), `module` text with CHECK in
    (`infocube`), unique among live rows on (`organization_id`, `module`). It has no `workspace_id`: like
    `organization_access`, it is an organization's row, not a workspace's (an exception to AD-10, as slice 8's table
    was). RLS on, no policies. Outside undo. No change events, as `organization_access` has none. Ending a licence
    soft-deletes the row.
  - **`workspace.infocube`:** boolean, not null, default false.
  - **On** means `workspace.infocube` **and** a live licence (the prototype's `cubeOn`). A licence that ends turns every
    workspace off without writing them.
- **Granting a licence in development:**
  - **the seed** grants InfoMate (the prototype's `cubeRootMigrate`: only InfoMate holds it);
  - **a script**, `npx tsx scripts/licence.ts grant|end <organization name> infocube [--file <db>]`, for KB.
  - No control in the app, so no "Prototype: grant licence" button (PRD section 8). The database slice replaces the
    script with whatever sells the licence.
- **Rights:**
  - owners and admins turn it on and off (`workspace.edit_settings`), and not in an archived workspace;
  - the domain refuses `infocube: true` without a licence, and refuses any change by a modeler or below (the existing
    permission);
  - turning it off is always allowed;
  - S15-03's "a direct call is refused" are unit tests plus one e2e call through the action.
- **How the page knows:** E3, `ShellData.modules.infocube = { licensed, on }`, from the workspace the shell already
  reads plus one read of the licences. Pages pass it to the panels and the canvas. Nothing reads InfoCube's tables to
  know it.
- **Conflict: whether the setting shows without a licence.**
  - The PRD (item 9, S15-03): not shown without a licence.
  - The prototype: the InfoCube box always shows, with a disabled check box and "{organization} has no InfoCube
    licence."
  - Question O2.

### Q7. Cascades and undo

- **Deletes today:**
  - `deleteEntity` (`entity.ts` l. 182) soft-deletes in one change group: mapping inputs, mappings, attributes,
    relationships (both ends), canvas items, the entity, label links and requirement links. Notes pinned to its cards
    become free notes. Copies elsewhere keep their link (a "lost original").
  - `deleteAttribute` (`attribute.ts` l. 305): its inputs, mappings, the attribute, label and requirement links.
- **Module rows join the same change group** through the post-step (F8): `moduleCascades` appends soft-deletes, and
  `buildWriteSet` makes one event per write with the same `change_group_id` (`withSettledChanges`' pattern).
  - Deleting a fact soft-deletes its `cube_entity` row and its measures.
  - Deleting a dimensional attribute soft-deletes its measure and the dimensional mappings onto it.
  - Deleting a logical attribute soft-deletes every dimensional mapping it is an input of, whole (Q-5), with their
    inputs.
  - An entity's delete does all of these for each of its attributes.
- **Undo of a group with module rows:**
  - `revertChangeGroup` walks the events in reverse, as today, once E1 makes the module tables known.
  - `consistent()` checks the registered parents: a restored `cube_mapping_input` needs its logical attribute live; a
    restored `cube_entity` needs its entity.
  - X-4's "one undo step brings everything back" follows.
- **Q-5 as a rule:** a `cube_mapping` is deleted when its target or any input is deleted. This is a unit test on the
  module's cascade function, plus S15-12 and S15-13.
- **An old change event without module rows** undoes as today: it has none to revert. An old entity event without
  `model_level` reads as `logical` (F6).
- **A risk the PRD did not name:** the post-step also runs for undo's own reverts (an undo of "Create dimension from
  this…" deletes entities). Undo builds its write set itself, so the cascade hook is called there too, or undo relies on
  the step's events already holding every row. Proposal: undo reverts only what the step wrote, as today (the step's
  events are complete because the cascade ran when the step was made), and does **not** run the cascade again. A unit
  test on "create dimension from, undo, redo".

### Q8. Relationships

- **Where it validates:** `createRelationship` (`relationship.ts` l. 20–47), with `found()` only. The canvas's relate
  mode refuses only picking the same card twice, unless the action is "Relate to itself" (`canvas-host.tsx` l. 168).
- **The same-level rule:** in the domain, after l. 32: "Facts and dimensions relate to each other. To trace a fact to
  the logical model, map its attributes." This is InfoMapper's rule (it knows the level, C-4). The canvas shows the
  domain's refusal as today; there is no browser check, because the text is the domain's and one round trip is enough.
  The prototype refuses in the browser.
- **The turn:** the module's `relationshipEnds` (F11) swaps the ends at create when a fact is `from` and a dimension is
  `to`. The result is dimension 1..1 – fact 0..N (the defaults). Swapping back later (`swapRelationship`) stays allowed,
  as in the prototype.
- **Fact – fact and dimension – dimension:** allowed (prototype).
- **Self-relationships (D-61) on dimensional entities:** allowed. A dimension related to itself is the hierarchy the
  backlog names, and the same-level rule holds. The prototype has no "Relate to itself" (F21).
- **While InfoCube is off:** a relationship with a dimensional end is refused by F4 (S15-04: "drawing a relationship to
  a dimension").

### Q9. The save chain and drafts

- **New text fields**, all through `useDraft`, `TextField` or `TextArea` (slice 13), keyed `fieldKey(id, field)`, with
  `keep` so a closed panel's draft comes back:
  - grain (`cube_entity`);
  - "Not additive across" (`cube_measure.semi_note`);
  - the transformation rule and the note (`cube_mapping`).
- **New choices**, through `useChoice` (no draft; the newest stored value after a refusal): the SCD type, the Measure
  toggle and additivity, Direct copy / Transformation, the status.
- **The rows each write holds:**

  | Write | `saveRow` / `saveRows` | Checked | Held |
  | --- | --- | --- | --- |
  | Grain, SCD | `saveRow` | `cube_entity` | – |
  | Measure on/off, additivity, semi note | `saveRow` | `cube_measure` (on/off: the attribute, as the create or delete has no row yet) | – |
  | Dimensional mapping fields | `saveRow` | `cube_mapping` | – |
  | Add or remove an input | `saveRows` | `cube_mapping` | its inputs |
  | Drag onto a dimensional row | `run` (creates; like `createMappingAction` today) | – | – |
  | Drag onto a dimensional header (a new attribute) | `saveRows` | – | the entity's attributes (the new one is appended; nothing is renumbered, but the entity's attribute list is written) |
  | New fact / dimension, Create dimension from this… | `run` (creates) | – | – |
  | Delete a logical attribute that feeds | `saveRow` with `deletes: true` | the attribute | the cube mappings it feeds (their panels' saves wait) |

- **No canvas write uses the canvas's queue except layout:**
  - Model writes on the canvas (a mapping by drag, "New entity here") go through the page's `run` and `saveRow` today
    (`canvas-host.tsx`, `map-column.tsx`). The new ones follow them.
  - Only the card placed by "Create dimension from this…" (to the right of the entity) is a layout write, placed in the
    same server action as "New entity here" does.
- **The fields live in `src/app`**, so the module's panels are in `ic-app` (Q2).

### Q10. The page's data

- **Today:**
  - The canvas page calls `store.model.load(ws)` (the whole `WorkspaceModel`) and about 14 more reads.
  - It builds cards, lines, the tree and frames on the server, and sends the whole `model` once as an RSC prop to the
    inspector, the status bar and the canvas's `fadeData`.
  - Each write's answer revalidates the page.
  - Precedents for measuring this: slice 10c's F20 (about 32 bytes per attribute for `copied_from_attribute_id`, +24,928
    bytes on "Performance test") and `e2e/slice-12b/S12B-bytes.spec.ts`.
- **What InfoCube adds:**
  - **`model_level` on every entity:** `"model_level":"logical",` is 24 bytes per entity, on every page of every
    workspace, InfoCube or not. On KB that is 24 bytes times its entities; "Performance test" is measured in 15a.
  - **The module's rows** go as a separate prop, `modules.infocube`, only when the workspace has any module rows. They
    are **not** added to `WorkspaceModel`, so InfoMapper's own payload is unchanged when there are none. When the
    workspace has rows but InfoCube is off, they are still sent: the cards stay read-only with their marks and lines,
    and the delete previews need them (C-7).
  - **The Sales star** has 5 `cube_entity` rows, 9 `cube_measure`, about 26 `cube_mapping` and about 30 inputs. At about
    300 to 350 bytes per row with the standard columns, that is **about 20 to 25 KB** per page of "Retail Co – DWH".
    That is measured in 15c with S12B-bytes' method, not assumed.
- **KB with InfoCube off and no rows** adds only `model_level`.
- **Proposal:** drop the standard columns the browser never reads from the module's prop (`created_*`, `updated_*`):
  those are about half of each row. But the model's rows send them today, and the panels show "changed by" for
  InfoMapper's rows. B-4 shows no such line for dimensional rows, so the module's prop keeps `id`, `version` and its
  content only. Question O8.

### Q11. The canvas and AD-24

**New elements and classes** (element counts as `S3B-15-elements` counts them):

| Element | Proposal | Elements |
| --- | --- | --- |
| Role and cube mark | the role's text in `.stereo`, the cube as a CSS mask on `.stereo.cube::before` (the prototype draws an inline 11 px SVG, about 4 elements). The class `cube` changes `withClips`' width by the mark's 14 px | 0 more than a stereotype |
| Fact edge | `.ent.fact .c-head::before { width: 8px }` and its padding, as the prototype | 0 |
| Hatch while off | a class `cubeoff` on the card, `background` on `.c-head` (a repeating gradient, no opacity) | 0 |
| Σ, Σ~, ∅Σ | one `<i class="meas …">` per measure row, the glyph as content; gone below 40 % (rows become `.c-lod`) | +1 per measure row |
| Dimensional line | `g`, hit path, stroke path, one diamond `path` (as a source line's arrow, slice 10b), the start dot as today's mappings have it above 40 %; ƒ as today's chip (+3) | 5 per input (the mappings' count), +3 with ƒ |
| The line kind's group | drawn only when the canvas has a dimensional line (slice 10b's rule: an empty group was one element more on every canvas) | 0 on a canvas without one |
| Colour | the target card's concept colour as an inline `stroke` and `--lc` on the line's `g` (the prototype's way); no class per concept | 0 |
| Dashes | `.cmap.draft .s`, `.cmap.review .s` (`stroke-dasharray`) | 0 |

**Drawing layers.** None of these elements may get its own compositing layer. The dimensional lines are in the line
layer's SVG, and the marks are classes and one `<i>`. Two checks:
- a LayerTree read on the Sales star against "Customer & orders" (slice 4b-1's method): the layer count does not grow
  with the cards;
- the element guard on "Performance test" against `slice-08.json`: **equal viewport counts**, since it has no
  dimensional content (A4).

**Page totals** (which include `<head>`) may grow by a JavaScript chunk's `<script>`, as slice 8's did (+1). That would
be read against the baseline and reported, not hidden.

**The prototype's CSS has a page-wide selector while dragging** (`from-attr .ent.dimn` on `body`). The app dims with one
class on the canvas root plus a kept class on the targets (E17, S5A-08's rule).

**A dense dimensional canvas:**
- **Recommended:** a generated "Performance test – star", written only into the e2e data file or a bench's copy (like
  `addManyCanvases`, never into the seed or `.data/dev-db.json`), with 20 facts, 30 dimensions, 200 logical cards and
  300 dimensional lines.
- Measured once in 15c, branch only: layers and pans against the same canvas with the dimensional lines drawn as
  ordinary mappings (S10A-12's and S10B-10's pattern: 20 loops against 20 relationships).
- **Why:** the line kind is the one new thing in the pan path. The Sales star (5 dimensional cards, about 30 lines) is
  too small to show a cost.

### Q12. The local data file

- **Today:**
  - `DEV_DB_FORMAT = 11` (`schema.ts` l. 85), unchanged by slices 12a to 14b.
  - `upgradeDb` (`file.ts` l. 82–156) runs inline steps; format 10 → 11 is l. 148–154.
  - `readDb` (l. 40–68) upgrades and writes back when `2 <= was < DEV_DB_FORMAT` (l. 58), and throws if the format is
    still not current.
- **Format 12 (15a):**
  - every entity gets `model_level ??= "logical"`;
  - every workspace gets `infocube ??= false`;
  - new empty tables `organization_licence`, `cube_entity`, `cube_measure`;
  - no change events, no log lines with personal data.
  - Tests in `upgrade-11.test.ts`' pattern: a file at format 11 (`asFormat11` strips the new columns and tables) →
    every row has its default, counts are equal, `change_event` is unchanged, `findViolation` is null, the file is
    written back, a file at 12 is read as it is with its mtime unchanged, and it is not repeated.
- **Format 13 (15c):** `cube_mapping` and `cube_mapping_input`, empty. A second format keeps each sub-slice's upgrade its
  own. The alternative is all four tables in 15a, which would create tables that 15a never uses.
- **KB's backup:** see F20. Before the first dev or e2e run on 15a (the upgrade writes the file back on the first read),
  and again before 15c's first run.
  - Files: `.data/backups/dev-db-<yyyymmdd-hhmm>.json` and `.data/backups/kb-model-latest.json`, git-ignored.
  - Restoring the backup is the only way back to `main`.

### Q13. Seed and e2e data

- **The demo LDM is complete** (F16): Retail Co – DWH has the six entities, the 17 attributes and the four concepts;
  REQ-210's feeds have no source mappings.
- **Organizations:** InfoMate (Łukasz, Anna, Piotr) holds "Retail Co – DWH"; Retail Co holds "Sales analytics". The
  prototype gives InfoMate the licence and turns InfoCube on only in "Retail Co – DWH".
- **Where the star goes**, as e2e reseeds from the same seed (F17):
  - **(a) In the seed, as in the prototype:** a canvas "Sales star" in Order management, 5 entities, about 26
    dimensional mappings, 7 relationships, REQ-210, the licence and the switch on. Every earlier spec's data then has it.
    About 20 specs need checking (Q15). Some change their counts:
    - S12A's Order management delete: the star canvas is its own, so it is deleted with the project;
    - S12B's tiles, a project home's counts, REQ numbering and requirement rows in S4A and S4B1.
  - **(b) Recommended:** the star is a domain-written step, `addSalesStar(db)` in `src/data/local/seed-sales-star.ts`,
    run by `npm run seed` and `reset-dev-data` for the development file. It is **not** in `resetDevData`'s e2e path:
    slice 15's fixtures add it, as slice 12b's specs add "Performance test – 20 canvases".
    - Earlier specs are unchanged.
    - The development file and the prototype match.
    - The licence and the switch are part of the step; without it, InfoMate has no licence in e2e.
    - Some slice 15 specs (S15-03, the licence) start from the seed without the star.
  - **(c)** The star in its own workspace: not the prototype's place; rejected.
- **The element guard** runs on "Performance test" (`seed-large.ts`), which gets no dimensional content under any option
  (A4).
- **REQ-210's key** (F16): written with its key; the counter stays 106, so a new requirement is still REQ-106. Question
  O7.
- **Question O5:** (a) or (b).

### Q14. The split

The PRD's 15a holds every piece of infrastructure (the boundary, the table registry, the guard, the level, the licence)
and most visible behaviour (tab, create, card, panels, hints, relationships, previews). Its acceptance would be as large
as slices 7a or 10a together. **Proposal: four sub-slices.**

| Sub-slice | Content | Needs | Data | Extension points | Criteria | Regime | Size (rough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **15a – Boundary, level, licence, facts and dimensions as entities** | the module's folder, `src/compose/`, the lint rules (Q2); the table registry (E1); `model_level`; `cube_entity`; the licence and the switch; the C-7 guard; the Cube tab and the Model tab's filter; New fact / New dimension (tab and toolbox); the card's role, cube, fact edge and hatch; the panel's Role, the off note; relationships within a level and the turn; level rules (Q4); a dimensional entity's delete preview and cascade of its `cube_entity`; the star's entities, roles and relationships (option b) | – | format 12; one migration (`model_level`, `workspace.infocube`, `organization_licence`, `cube_entity`, `cube_measure`) | E1–E9, E13 (own rows), E14 (own rows), E18 (toolbox), E22, E25 | S15-01, 02, 03, 04 (without mappings), 06, 07, 10, 14 (without mappings), 17 | **large** (touches every part; two full runs before the merge) | about 45 files, 12 specs |
| **15b – The dimensional description** | the fact section (grain, measures, dimensions with their keys, hints with the key-name match, Q16), the dimension section (SCD, used by), the Measure section, Σ marks, the hints' links | 15a | no format change (`cube_measure` comes in 15a) | E7 (marks), E10, E11 (Measure) | S15-08; S15-07's hints | **small** | about 15 files, 3 specs |
| **15c – Dimensional mappings** | `cube_mapping`, `cube_mapping_input` (M1); drag in both directions, dimming, refusals; the line kind with hover, Focus, bundles and the miniature; the mapping panel; the line's menu and Delete; history places; "Create dimension from this…"; "Comes from the logical model", "Feeds facts and dimensions"; X-2, X-3 (the attribute dialog), cascades and undo; the card's "fed" coverage and the Overview's (F19); the star's mappings; the dense canvas measurement | 15a, 15b (the panel's sections) | format 13; one migration | E7 (coverage), E11, E12, E13, E14, E15–E17, E18 (header, line), E19 | S15-05, 09, 11, 12, 13, 14 (the mappings' rows), 18 | **large** (the line layer, the pan path) | about 40 files, 7 specs and a measurement |
| **15d – Requirements and the bus matrix** | X-5 (scope, coverage, the lens); B-8; REQ-210 in the star; `docs/decisions.md` (AD-33 to AD-36, D-67); README, CLAUDE.md, ideas, limitations, inventory | 15c | none | E20 | S15-15, 16, 19 | **small** | about 12 files, 3 specs |

**Each leaves the app consistent:**
- **15a:** facts and dimensions with no description and no feed. Their panels say nothing about grain. The card's
  coverage bar shows "0 of n" against sources, as for any entity, until 15c.
- **15b:** the hints are complete, with no mappings. The fact section links only to fields that exist.
- **15c:** the lens does not yet follow dimensional mappings. The requirement scope stays logical, as today.

The decisions go in with 15a (AD-33, AD-34, AD-35, D-67) and 15c (AD-36), each with the code that needs it (CLAUDE.md:
"in the same pull request as the code").

### Q15. Earlier tests and docs

- **Specs that change under option (a) of Q13**, and that need a re-run under (b) (the Model tab's filter, the guard,
  the new menu items):

  | Change | Specs |
  | --- | --- |
  | Model tab lists logical entities | S1A-07, S1A-10, S2B-12, S4A-06, S4A-07, S4B1-02, S4B1-04, S4P-09, S6B-10, S7A-10, S7A-11, S10A-04, S11-01, S11-08, S11-screens, S13-14. Under (b) none changes: the seed has no dimensional entity |
  | Entity panel's Stereotype | S1A-11, S9-04, S13-05, S13-08, S13-14, S13-screens, S14B-09: unchanged (logical entities keep it) |
  | Exact menu lists (`toolboxAt`, `toolboxLabels`) | S1B-07 l. 61, 67; S1B-14 l. 71 (the empty canvas's toolbox: "New fact here" is added only when InfoCube is on, so unchanged under (b)), l. 75, 84; S2A-05 l. 22–32; S2A-13 l. 103; S2B-06 l. 68; S2B-13 l. 108; S2C-07 l. 59. The card header's "Create dimension from this…" shows only when on: unchanged under (b) |
  | Relationship refusals | none asserts one today |
  | Workspace settings | S0-06 l. 34 (a fixed list of disabled controls; the new switch joins it when licensed), S0-09, S1A-12, S7C-09 (`text-methodology`'s exact text, l. 22: the Methodology card gets the switch only when licensed), S13-06 |
  | Delete previews | S1A-10 l. 19–27 (exact six rows), S10A-11, S10C-06, S12A-07: unchanged (no module rows without the star) |
  | Under (a) only | S12A-* (Order management's own canvases), S12B-* (tiles, the homes' counts), S4A-07 and S4B1-02 (requirement rows), S1A-01 (card names on a canvas: not on the star) |

- **Unit tests:** `tests/layer-rules.test.ts` (new probes); `tests/schema/compare-schema.test.ts` (new tables);
  `upgrade-12.test.ts`, `upgrade-13.test.ts`; `undo.test.ts` (registered tables, `IMAGE_DEFAULTS`); `entity.test.ts`
  (names within a level); `relationship.test.ts` (the level rule, the turn).
- **`e2e/parts.ts`:** `slice-15*` sorts after `slice-10a` and joins part 4, which has slices 10a to 14b today. Part 4
  then grows by about 25 specs. Proposal: watch its time and heap at 15a's closing and add a fifth part if it passes
  26 minutes or 1.6 GB (CLAUDE.md's rule).
- **Docs per sub-slice:** as PRD section 10. In addition:
  - CLAUDE.md gets a section "Modules and extension points" (the composition root, the lint rule, E1's registry, the
    guard, "a later module adds itself here");
  - `docs/known-limitations.md` gets the key-name match, Q-5, "no links to dimensional mappings" (M1) and "the
    workspace home counts logical entities only".

### Differences between the prototype and the app that the slice touches

The prototype is the source of behaviour; these are the places where the app differs or will differ, by necessity or by
proposal.

| # | Prototype | App (today, or as proposed) | Why |
| --- | --- | --- | --- |
| P1 | Settings in a modal; the InfoCube box after Data Vault | the workspace home's Settings tab, Methodology card (F14) | the app's settings live there |
| P2 | The box shows without a licence ("{org} has no InfoCube licence.", disabled) | PRD: not shown without a licence | **O2** |
| P3 | "Prototype: grant / end licence" button | a script and the seed (Q6) | PRD section 8 |
| P4 | `permitChange` mutates, compares JSON and rolls back; undo and redo bypass it | a write-set guard in the domain, before anything is written (F4); undo checked too | AD-23; **O3** for undo |
| P5 | Drag targets stay lit while off; the drop is refused with the C-7 message | spec and PRD: no dimensional drag targets while off | **O4** |
| P6 | Reviewers cannot change a dimensional mapping's status; no four-eyes | InfoMapper's mappings: reviewers set the status as their approval (AD-05), four-eyes (AD-06), D-51 | **O9** |
| P7 | Orphans dropped when indexing (`cubeIndex`); a missing `cube_entity` row is added as a dimension | deleted by the cascade in the same change group (F8); "exactly one row" kept by the commands | PRD item 8 |
| P8 | `cubeDependents` lists a fact twice with two relationships | each fact once | PRD section 2 |
| P9 | The rename's duplicate warning compares across levels (create compares within one) | within one level everywhere (F10) | X-6 |
| P10 | `deleteAttr`'s toast counts source mappings only | the toast counts both kinds ("… with {n} mappings and {m} dimensional mappings") | the PRD lists every new text in its step |
| P11 | The cube mark is an inline SVG | a CSS mask (Q11) | AD-24, element counts |
| P12 | Page-wide drag classes (`from-attr`, `from-dattr`, `from-col` on `body`) | one class on the canvas root (E17) | S5A-08 |
| P13 | Relationship levels refused in the browser (`createRel`) | refused by the domain; the canvas shows its refusal (Q8) | AD-23, S15-10 "also by direct call" |
| P14 | No "Relate to itself" | D-61's "Relate to itself" allowed on dimensional entities (Q8) | the app has it (slice 10a) |
| P15 | No copy and paste of attributes | paste within one level only (F12) | D-63; **O6** |
| P16 | The column panel's attribute list filters by level (`attrOptions(sel, dim)`) | the same (F13) | – |
| P17 | Overview "Mapping coverage": dimensional entities count "fed" | the same, in 15c (F19); the PRD did not list it | – |
| P18 | The tabs' font 12.5 → 12 px for four tabs | only when four tabs show (F18) | no change while off |
| P19 | The card's context menu has "Create dimension from this…" before "Delete from model…" | the card header's menu (D-52), same place | – |
| P20 | "Edit transformation rule…" in the line's menu makes the mapping a transformation silently | the same, with the toast the panel gives ("It is a transformation now. Describe the rule.") | a silent kind change; the text is for approval in 15c |
| P21 | IC-10: 6 mappings, "Fact Orders, Fact Sales" | the prototype's figures (S15-12) | PRD section 2 |
| P22 | B-5's extra variant "(the dimension has no primary key yet)" | built (15b) | PRD section 2 |
| P23 | `SCD_L` defined, unused | – | dead code |
| P24 | Entity panel: "Data Vault" section hidden for dimensional entities (`dvSection`) | the app has none on entities (F9) | – |
| P25 | REQ-210 is a free key | written with its key, the counter unchanged (F16) | **O7** |
| P26 | New facts and dimensions take "the last concept used" (Q-8) | `createEntity`'s concept rule (D-46: the frame clicked into, else the last used), unchanged | – |

### Assumptions A1–A4

- **A1** holds: `main` = `slice-14b` = `3f037df`.
- **A2** changes:
  - **two** formats (12 and 13) and **two** migrations, one each for 15a and 15c;
  - the column `workspace.infocube`;
  - the table `organization_licence` with no `workspace_id` (Q6);
  - no change to `entity.stereotype`'s CHECK (Q4);
  - otherwise as the PRD says.
- **A3** is extended: KB is backed up before the **first** run of 15a's and of 15c's code, not only before the
  acceptance (F20).
- **A4** holds under every option of Q13.

### Open questions for Łukasz

- **O1. C-1's reading.** InfoMapper's layers never name a module; one composition root, `src/compose/`, imported by
  `app`, lists the modules and hands their hooks down as arguments and context (Q2). Is `app → compose → modules`
  acceptable as "InfoMapper never imports it"? S15-01's "without the module's registration the existing specs pass
  unchanged" would then mean: the existing specs pass with the module registered and no licence or InfoCube data in
  their seed, plus a unit test that runs InfoMapper's hooks with an empty module list. A build without the module would
  need a switch the PRD does not ask for.
- **O2. The setting without a licence.** Not shown (PRD, S15-03), or shown disabled with "{organization} has no
  InfoCube licence." (prototype)? Recommended: the PRD's (no upsell inside a customer's workspace), recorded as a
  difference.
- **O3. Undo while InfoCube is off.** Refused for a step that writes a dimensional entity, attribute or relationship,
  with the C-7 message (PRD: "every change … is refused"), or let through (prototype)? Recommended: refused. A step
  that only deleted module rows as the cascade of a logical delete undoes, so "deleting a logical entity works" stays
  true with its undo.
- **O4. Drag targets while off.** None (spec, PRD) or lit and refused at the drop (prototype)? Recommended: none, and a
  dimensional row dragged while off does not start a drag.
- **O5. The demo star** in the seed for every spec (a), or a step for development and slice 15's specs only (b)?
  Recommended: (b).
- **O6. Pasting across levels.** Refused in iteration 1 (recommended), or a paste into a dimension that makes a copy
  without following (no `copied_from`)?
- **O7. REQ-210.** Keep its key with the counter at 106 (recommended), or make it REQ-106 in the app's seed?
- **O8. The module's page data without `created_*` and `updated_*`.** Recommended: yes, as it halves the bytes. A
  "changed by" line for dimensional rows would then need a later change.
- **O9. Who approves a dimensional mapping, and does four-eyes apply?** InfoMapper's mappings let reviewers approve,
  with four-eyes and D-51's return to review. The prototype allows editors only, with no four-eyes. Recommended:
  InfoMapper's rules, by reusing `checkFourEyes` and `afterContentChange` ("with the mapping statuses", spec scope).
  This is a difference from the prototype.
- **O10. The split** into four sub-slices (Q14) instead of three.
- **O11. Decision numbers:** AD-33 to AD-36 and D-67 are free (the last are AD-32 and D-66). AD-36's text is in Q5.
- **Q16 (the PRD's).** The key-name match as one domain function, `dimensionKeyOf(fact, dimension)`, listed as a known
  limitation until role-playing replaces it. Recommended: build it (15b).

### Largest risks

1. **The table registry (E1)** reaches the adapter, undo, the change labels and the schema check. A mistake there makes
   every delete quietly not undoable (F5). It is 15a's first piece and needs unit tests before anything uses it.
2. **The C-7 guard's coverage (F3, F4).** Indirect writers (copies, a concept's "move to", cascades, undo) must be
   caught or deliberately allowed. Unit tests are needed per writer, not only per command.
3. **Wiring hooks through Next.js's server and client without global registration (Q2).** This threads hooks through
   `runCommand`, `buildCards`, `buildLines`, `lookupModel` and context. It is wide, and easy to get half done.
4. **KB's file** is upgraded on the first read and cannot go back to `main` without the backup (F20).
5. **The new line kind in the pan path (15c).** Measured on a dense generated canvas (Q11); the Sales star alone is too
   small to show a cost.
6. **Requirement coverage through feeds (E20)** becomes recursive. The requirement index is rebuilt on every write
   (known limitation), so `bench-requirement-index` is re-run in 15d with feeds.

## Łukasz's answers to step 1 (4 November 2026)

O1 yes (`src/compose/` the only composition root; S15-01 reworded); O2 as the prototype (the box always shown, disabled
without a licence); O3 as the prototype (undo and redo pass while off; a known limitation); O4 as the prototype (targets
light while off, the drop refused with the C-7 message); O5 (b); O6 paste within one level only; O7 REQ-210 keeps its
key; O8 yes (see below); O9 reviewers approve with four-eyes (a difference from the prototype); O10 four sub-slices;
O11 the numbers reserved, each entering at its sub-slice's closing; Q16 the key-name match as one function. New: O12
(D-51's first rule for dimensional mappings, 15c) and O13 (the read-only check's scope, domain tests). The PRD's section
0 holds them in full.

- **The spec's difference (O4).** The spec (C-7, "what off means") says the dimensional drag targets disappear while
  InfoCube is off; the app follows the prototype: they light, and the drop is refused with the C-7 message. The spec is
  not changed (it is copied unchanged).
- **O8's condition holds:** frames' and notes' page data already drop the audit columns and keep `version`
  (`FrameData` in `src/canvas/frame-data.ts` l. 11, `NoteData` in `note-data.ts` l. 12; a note keeps `createdAt` and
  `createdBy` for its "Created … by …" line). InfoCube's rows reach the page the same way.
- **P2, P4, P5 and P6** are answered: P2 and P5 as the prototype, P4's undo as the prototype, P6 as InfoMapper's
  mappings (PRD section 8).

## 15a step 2: the table registry, the model level, licences and InfoCube's tables (4 November 2026)

Commits `158a8f0` (data, registry, migrations, format 12) and `2fe6c66` (lint rules for modules and the composition
root), on `slice/15a-boundary-level-licence`.

### What changed

- **The registry (the risk's guard).** Undo's tables are `undoTables(modules)` (`src/domain/commands/undo.ts`): the
  core's undoable tables, `OUTSIDE_UNDO` (people, organizations, licences, workspaces; a compile check that every core
  table is in one of the two), and each module's tables with their parents, noun, defaults. The local adapter's rules are
  `localSchema(moduleRules, undoable)` (`src/data/local/schema.ts`). `src/compose/tables.ts` fills both from typed
  records over `ModuleTable` (a module table missing from either does not compile) and exports `UNDO_TABLES` and
  `STORE_SCHEMA`, which `runCommand` and the undo action use. An unknown table is refused loudly: undo throws, the store
  refuses before writing ("The store does not know the table …"), `findViolation` reports `unknown_table`.
  `tests/table-registry.test.ts` fails when the migrations' tables and the schema's differ, or a table is neither in undo
  nor outside it; it also checks that the empty registry equals the core (O1) and undoes and redoes a module row.
- **The model level and licences:** `entity.model_level` (`logical`/`dimensional`, CHECK), `workspace.infocube`
  (false), table `organization_licence` (unique live module per organization, CHECK on the module). Undo reads an old
  image without `model_level` as logical (`IMAGE_DEFAULTS`).
- **InfoCube's tables** in `src/modules/infocube/`: `cube_entity` (role, grain, SCD type; shape CHECK) and
  `cube_measure` (additivity, note), their rules and undo parents; the module augments `WritableRows` by declaration
  merging, so the core names no module table.
- **Migrations** `20261104100000_model_level_and_licences.sql`, `20261104100100_infocube_entities.sql` (RLS on every
  new table). The schema check (AD-31) reads `ComposedDb`: on a temporary Postgres "The schema matches the domain: 36
  tables, 480 columns".
- **Format 12** of the local file: entities logical, workspaces off, an empty `organization_licence`; no module table in
  the file until a module writes one (`upgrade-12.test.ts`).
- **Lint (S15-01):** module parts `infocube-<layer>` follow the layers' directions; no InfoMapper layer imports a module
  or the composition root, only `src/app` imports `src/compose`; a module's domain part is pure (`tests/layer-rules.test.ts`).
- `docs/data-model-v2.md`: `organization_licence`, `workspace.infocube`, `entity.model_level`, section 15 (modules).

### Earlier tests changed, and why

- The hard-coded format 11 became 12: `organization-store.test.ts`, `requirement-store.test.ts`, `upgrade-8.test.ts`,
  `working-layer-store.test.ts`, `e2e/slice-07b/S7B-12.spec.ts`, `e2e/slice-07c/S7C-02.spec.ts`.
- `upgrade-11.test.ts`: the file now goes on to format 12, so it compares with `DEV_DB_FORMAT`.
- `frame.test.ts`: its `Rows` type maps `WorkspaceRows`, whose module keys are optional (`NonNullable`).
- `tests/schema/compare-schema.test.ts`: the expected tables include the three new ones.
- Row creators give `model_level: "logical"` and `infocube: false` (seeds, fixtures, `createEntity`, new workspaces).

### KB

Backed up before the branch's first run: `.data/backups/dev-db-20261104-0921.json` and `kb-model-latest.json`, both
identical to `.data/dev-db.json` (format 11). Nothing on this branch has opened the KB file yet; the dev server's first
read will upgrade it to 12.

**main on a format-12 file:** `readDb` (main's `src/data/local/file.ts`) upgrades nothing and throws before writing:
"… has format 12, expected 11. Run "npm run reset-dev-data"." It refuses, so the file is safe. The hint is the risk:
`reset-dev-data` wipes the file and seeds it again without a backup, so following it on KB's file loses the model. The way
back is the backup above. Proposal (an idea, `docs/ideas.md`): a newer format's message says "made by a newer branch;
switch back to it or restore a backup" and never suggests the reset; no known-limitations entry needed, as main refuses.

### Checks

- `npm run lint`, `npm run typecheck`: clean. `npm test`: 128 files, 1,618 tests passed.
- Full e2e run (from scratch, 09:43–11:15): 555 passed, 3 skipped, 1 failed; total 91 min 57 s. Part 1: 24 min 58 s;
  part 2: 23 min 53 s; part 3: 19 min 12 s; part 4: 23 min 54 s.
- The failure: `S13-12` (canvas commits of a conflict against an own save): own save 0, conflict 6, where it expects
  equal counts. The log and the trace are kept in `.data/e2e-15a-step2-failure/`. Run three times on its own: passed 3 of
  3 (own save 3, conflict 3 each time). The failing run's sum is the same 6: the own save's fresh page committed late,
  inside the conflict's window. A timing flake of the measurement under the full run's load, not a change of this step
  (nothing on the canvas or the save path changed). Not recorded before; if it comes back, the spec should wait for the
  own save's page to settle (`settledCommits`) before writing as Anna.

## Before step 3: the branch's start and the upgrade's change events (4 November 2026)

- **Where `slice/15a-boundary-level-licence` started:** at `f2a08e3` ("docs: slice 15 PRD updated to step 1's answers,
  cut into 15a-15d"), the tip of `slice/15-infocube` (its reflog: "Created from HEAD" at `f2a08e3`). It carries the PRD
  (`e6116b7`, updated in `f2a08e3`), the spec and the prototype (`e6116b7`) and this acceptance doc (`bac163a`,
  answers in `f2a08e3`). `slice/15-infocube` has no commit after it.
- **The format-12 upgrade writes no change event:** the step from 11 (`upgradeDb` in `src/data/local/file.ts`) sets
  `model_level` and `infocube` on the rows and adds the empty `organization_licence`, and nothing else;
  `upgrade-12.test.ts` checks that `change_event` is equal before and after and that nothing is logged.

## The change to C-7 (Łukasz, 4 November 2026)

In place of the read-only mode: InfoCube is turned off only while the workspace has no facts or dimensions, and while it
is off nothing creates or brings one back (create, copy, paste, undo, redo). O3 and O13 are dropped; O4 has no effect
(no dimensional target exists while off). The PRD is updated (section 0, C-7's note, items 2 and 9, the steps, S15-04,
the definition of done, section 8, AD-35's text).

- **The spec's IC-14 no longer matches.** IC-14 turns InfoCube off with Fact Sales in place and expects the Cube tab
  gone, hatched dimensional headers and the rename refused with the C-7 message. In the app turning off is refused while
  Fact Sales exists ("… It has {n}: delete them first."); once the facts and dimensions are deleted it is turned off,
  and then there is nothing to hatch or rename. S15-04 replaces IC-14 for the app; the spec is not edited.
- **What goes from the prototype:** the hatch (`cubeoff`), the panels' off note, `CUBE_OFF` as the refusal of edits and
  drops (l. 1414, 2572), undo and redo passing while off. PRD section 8 lists it.
- **Q6's "on = the switch and a live licence" no longer holds:** a licence that ends would turn a workspace with facts
  off without writing it, which the new rule forbids. **Proposal:** InfoCube is on when `workspace.infocube` is (the
  domain reads only that); the licence is read when it is turned on. Q6's development script grants only (`licence.ts
  grant`, no `end`), and ending a licence is not a command in this slice (`docs/known-limitations.md`, "Ending a licence
  has no command").

### Copying a workspace and transferring it (AD-09): what the code allows, and a proposal

- **Today:** neither exists. AD-09 names "create (empty or copy) … transfer to another organization", but no command,
  action or screen copies or transfers a workspace (`grep` for copy, duplicate, clone, transfer in `src/` finds only the
  roles table's wording "incl. delete and transfer" on the workspace home, `page.tsx` l. 288). `docs/ideas.md` keeps the
  lifecycle for later (l. 570), and step 1's E24 says a transfer must check the receiving organization's licence.
- **Proposed rule (not built):**
  - **A copy** stays in its organization and copies `infocube` with the facts and dimensions; a copy into another
    organization follows the transfer's rule.
  - **A transfer** (or a copy into another organization) of a workspace with InfoCube on is refused unless the receiving
    organization holds the licence: "{organization} has no InfoCube licence. Delete this workspace's facts and dimensions
    and turn InfoCube off, or transfer it to an organization with the licence." A workspace with InfoCube off transfers
    freely (it has no facts or dimensions).
  - Both commands iterate the table registry (E1), so a module's rows go with the workspace.

## 15a step 3: the domain (4 November 2026)

### What changed

- **C-7** (`src/domain/model/levels.ts`, `updateWorkspaceSettings`):
  - `updateWorkspaceSettings` takes `infocube` and, from the action, `InfoCubeSwitchState` (the licence, the
    organization's name, the live facts and dimensions). On needs the licence ("{organization} has no InfoCube
    licence.", `forbidden`); off is refused while the workspace has facts or dimensions (`invalid`, Łukasz's text with
    {n}); owners and admins only, not archived (the settings' right). Without the state a change is refused.
  - `levelWritesRefusal(workspace, writes)`: while InfoCube is off, an entity inserted or brought back (deleted to live)
    at the dimensional level is refused with "InfoCube is off in this workspace, so no fact or dimension can be added or
    brought back. An owner or admin can turn it on in the workspace settings." (proposal, `forbidden`). It runs on every
    command's writes in `runCommand` (reading the workspace only when the writes touch an entity) and inside
    `revertChangeGroup`: the refused undo or redo keeps its step, for when InfoCube is on again (a `conflict` would have
    dropped it).
  - The local adapter counts again in its serialised write (`offWithDimensional`), as for the last owner: a turn-off and
    a new fact sent at once (`docs/known-limitations.md`).
  - "Copy" in Łukasz's list: no command copies an entity today (`createEntity` is the only insert of an entity); 15c's
    "Create dimension from this…" will go through the same check.
- **Level rules:**
  - The level is set at creation: `createEntity` takes `CreateEntityOptions { level, defaultName }` from code, never
    from the input (the input stays strict). No command changes it, and `levelWritesRefusal` refuses any write that
    would (`invalid`); an old image without the column is logical.
  - Relationships (`createRelationship`): both ends of one level, else the prototype's text ("Facts and dimensions
    relate to each other. To trace a fact to the logical model, map its attributes.", `invalid`). With `oneEnd` the
    relationship starts there; the action reads it through the composition root (`relationshipOneEnd`, InfoCube's
    `dimensionEnd`): between a fact and a dimension, the dimension is the 1..1 end. **Swap direction is not checked:**
    the prototype swaps any relationship, and only creation turns it.
  - Paste (`pasteAttribute`): the state has the original's entity; a paste across levels is refused with "An attribute
    is pasted within one level only: a logical entity's into a logical entity, a fact's or dimension's into a fact or
    dimension." (proposal, `invalid`).
  - Names: the default name's numbering and the duplicate-name warning compare within one level (create and rename).
  - A stereotype on a fact or dimension is refused ("A fact or dimension has a role, not a stereotype.", Q4).
  - **Data Vault 2.0 readings on logical entities only:** the app has no reading of entities. Its Data Vault reading is
    a source table's (`data-vault-reading.ts`, slice 7c, F9); the prototype's entity panel hints (l. 5172, "Data Vault
    hints read the logical model only") were never built. So the rule holds with no code; whoever builds entity hints
    filters by `isLogical`.
- **Cascades** (`src/domain/commands/module-cascade.ts`, E14): after any command, `runCommand` soft-deletes every live
  module row whose registered parent (`UndoTables.parents`, the same registration undo checks) the writes delete, in the
  same change group (`withModuleCascades`, shaped as `withSettledChanges`); only the module tables that can follow are
  read (`store.modules.list`). Deleting a fact takes its `cube_entity` and its attributes' `cube_measure`; deleting a
  measure's attribute takes its `cube_measure`; one undo brings everything back. The undo history still names the step
  by the entity ("Delete entity …"). 15c's rule that a mapping goes whole with any input is the module's own.
- **InfoCube's command** `createCubeEntity` (`src/modules/infocube/domain/commands.ts`): `createEntity` at the
  dimensional level ("New fact", "New dimension", numbered among dimensional names) and the `cube_entity` row (a fact
  without a grain, a dimension of SCD type 1), refused while off. Its action and buttons are step 4.
- **Store:** `organizations.listLicences` and `modules.list(workspaceId, table)` (`ports.ts`, the local store).
- **Not in this step:** the key-name match (15b), dimensional mappings' cascades (15c), the Q4 level filters of what
  screens list and count (the Model tab, the counts in `src/app/_panels/stats.ts`, pickers, consistency; step 4 with
  their screens), the actions for New fact and New dimension (step 4).

### S13-12 (test change only)

The full run's failure in step 2 (own save 0, conflict 6) came from `settledCommits` returning before the own save's
fresh page arrived: the counter had been still for 500 ms while the server answered under load. The spec now waits for
the card's row to show the saved name (and Anna's name after the conflict), both drawn only by the fresh page, then for
the counter to settle. Run three times on its own: 3 of 3 passed, own save 3, conflict 3 each time.

### The newer-format message (moved from `docs/ideas.md`)

`readDb` now refuses a file a newer branch wrote with "{file} has format {n}, newer than this branch's 12: a newer branch
wrote it. Nothing was changed. Switch back to that branch, or restore a backup of the file from .data/backups/ that has
this branch's format." (`newerFormatMessage`); an older file no upgrade reaches keeps its hint to run `npm run
reset-dev-data`. `model-store.test.ts` checks the text, that it never names the reset, and that the file is unchanged.
It helps from this branch on: `main` still has the old text until 15a is merged.

### Earlier tests changed, and why

- Paste's state has the original's entity: `aliases.test.ts`, `attribute.test.ts`, `undo.test.ts`,
  `model-store.test.ts`, `e2e/slice-10c/helpers.ts` (`pasteAs`).
- `tests/table-registry.test.ts`: its modeler has InfoCube on, and its file's workspace too, since a dimension is now
  refused where InfoCube is off.
- `e2e/slice-13/S13-12.spec.ts` (above).

### Checks (4 November 2026)

- `npm run lint` and `npm run typecheck`: clean.
- `npm test`: 132 files, 1,653 tests passed.
- `e2e/slice-13/S13-12.spec.ts` on its own, three times: 3 of 3 passed (own save 3, conflict 3 each time).
- Full e2e run (`npm run e2e`, from scratch, no dev server running): 556 passed, 3 skipped (the measuring specs),
  90 min 41 s. Part 1 (to `slice-02c`) 24 min 40 s, part 2 (`slice-03a` to `slice-06b`) 23 min 9 s, part 3 (`slice-07a`
  to `slice-09`) 18 min 54 s, part 4 (`slice-10a` to `slice-14b`) 23 min 58 s. S13-12 in the run: own save 3, conflict
  3. The server's "The destination stream closed early." lines (182) are the ones step 2's run had too (180): a test
  leaving a page while it streams.

## Łukasz's answers after step 3 (4 November 2026)

- **Q6:** InfoCube is on when the workspace's switch is on; the licence is checked only when someone turns it on.
- **Copy and transfer:** the rule above is accepted as a rule, not built; it is in the PRD's section 9 and in AD-35's
  proposed text, with its message.
- **Swap direction:** not checked, as the prototype.
- **Messages:** approved as proposed, except a paste across levels, which is now "An attribute can be pasted only within
  one level: logical into logical, fact or dimension into fact or dimension." (`CROSS_LEVEL_PASTE_MESSAGE`).

## 15a step 4: the interface (4 November 2026)

### What changed

- **How a module reaches the pages (E3, E6, E7, E13, E18):** `src/ui/modules.ts` defines what a page gets as plain data
  and server actions (`ModuleView`: each dimensional entity's role, the left panel's module tabs, the entities a module
  creates; `DependentRow` for a delete preview). The composition root builds it: `moduleView` (`src/compose/view.ts`,
  reading InfoCube's rows only when the model has a dimensional entity), `CREATE_ACTIONS` (`src/compose/actions.ts`, apart
  from the index so the domain's and the store's callers never load server actions), `settingsBoxes`
  (`src/compose/settings.tsx`), the module's CSS (`src/compose/styles.ts`, loaded by the root layout) and the star
  (`src/compose/seed.ts`). The canvas page hands it to `ModulesProvider` (`src/app/_components/modules.tsx`), `buildTree`
  and `buildCards`. InfoMapper's layers name no module (the lint rule passes).
  - The canvas page and the entity's impact read through the composed store (`getDataStore(STORE_SCHEMA)`): with
    InfoMapper's tables alone `modules.list` refuses InfoCube's tables.
  - `modelCommand` moved from `_actions/model.ts` to `_lib/model-command.ts`: an export of a "use server" file is a
    server action itself, and InfoCube's actions (`src/modules/infocube/app/actions.ts`) use it.
- **Workspace settings (O2):** the InfoCube box after Data Vault 2.0 mode (`InfoCubeBox`, `src/modules/infocube/app/`),
  shown to everyone; its check box enabled for owners and admins with the licence; "{organization} has no InfoCube
  licence." or "Licensed for {organization}."; a refusal stays under the check box (`text-infocube-refusal`) and shows no
  toast (`useAction`'s new `quiet` option); it saves the workspace's row on the settings' chain.
- **The Cube tab (B-1):** a fourth tab while InfoCube is on, its title "InfoCube: facts and dimensions"; New fact and New
  dimension at its top for editors; Facts, then Dimensions, each by concept (one step in), with "grain set"/"no grain"
  and "SCD {n}" on the right; the Model tab's click, drag, presence dots, search (within the tab's level), folding and
  "Only on this canvas". Four tabs are 12 px (P18). A tab that goes (InfoCube turned off) shows the Model tab.
  **The Model tab lists logical entities only**; a concept's delete dialog still counts both levels (Q4).
- **New fact here, New dimension here (B-2)** in the canvas's toolbox after "New entity here", only while on. Both
  creates place the card as "New entity here" does (the concept of a concept frame, else the last used), select it, open
  the details and select the name; one undo step each (`createCubeEntity`).
- **The card (B-3, part):** the role ("Fact", "Dimension") where the stereotype stands, the cube as a CSS mask on the
  span's `::before`, the classes `dimn fact`/`dimn dimension` on the card, a fact's 8 px edge and 18 px padding
  (`src/modules/infocube/canvas/infocube.css`); `withClips` counts the mark's 14 px (`ROLE_MARK`).
- **The entity panel:** Role (read only, with the cube) in place of Stereotype for a fact or dimension; "Feeding sources"
  is not shown for one (Q4: no column feeds it).
- **The relationship refusal** between levels: the domain's message as the canvas's toast (`relate` shows every refusal).
- **Delete preview (X-4, without 15c's mappings):** a fact's "Fact – deleted" or "its grain (“…”) deleted"; a
  dimension's "Dimension – SCD type {n} deleted" and "{n} facts – lose this dimension: …", each fact once; "{n}
  measures – deleted"; after InfoMapper's rows (`entityImpactAction`'s `modules`).
- **The Q4 level filters:**

  | Place | Done |
  | --- | --- |
  | Model tab, its search | logical only (`buildTree`); the Cube tab searches its own entities |
  | A concept's delete dialog | every entity of the concept, both levels |
  | Duplicate-name warning, stereotype | step 3 (domain); the toolbox's "Create entity “…”" offer compares logical names |
  | Status bar | "Mapped attributes on canvas" counts logical cards' attributes (`canvasStatus`) |
  | Workspace home, project home | "entities" and the project's attributes count logical entities (`workspaceStats`, `projectStats`) |
  | Canvas tiles and tab counts | unchanged: every card |
  | Model consistency | logical attributes only (`modelConsistency`) |
  | Import review | logical entities and attributes only (`impactIndex`) |
  | Feeding sources | not shown for a dimensional entity |
  | Attribute pickers | logical only (`attributeOptions`, "Map to an attribute") |
  | Paste | step 3 (domain); the toast is its refusal |
  | Data Vault 2.0 readings | nothing to do (step 3) |

- **The Sales star (O5, Q13 (b)):** `addSalesStar` (`src/modules/infocube/data/sales-star.ts`): Fact Sales, Fact Orders,
  Dim Customer, Dim Product, Dim Date with the prototype's attributes, roles, grains and SCD types; the five relationships
  with each dimension at the 1..1 end; the canvas "Sales star" in Order management with the six logical and five
  dimensional cards at the prototype's places; InfoMate's licence; InfoCube on in "Retail Co – DWH". No measures,
  dimensional mappings or REQ-210 (15b to 15d). `npm run seed` and `npm run reset-dev-data` add it; the e2e reseed does
  not (`resetDevData`'s new `extra`); slice 15a's fixtures add it (`test.use({ star: false })` for the plain seed). It
  writes no change event.
- **`scripts/licence.ts grant "<organization name>" infocube [--file <db>]`:** adds the licence row (no change event,
  refuses production, an unknown module or an ambiguous name); grants only.

### New user-facing texts (for approval)

| Where | Text |
| --- | --- |
| Settings box, heading | "InfoCube" |
| Settings box, text | "Dimensional modelling on top of the logical model: facts, dimensions, and mappings from logical attributes. It can be turned off only while the workspace has no facts or dimensions." (the prototype's second sentence was "Turning it off keeps everything; facts and dimensions become read-only.") |
| Settings box, check box | "Use InfoCube in this workspace" (prototype) |
| Settings box, licence line | "Licensed for {organization}." / "{organization} has no InfoCube licence." (prototype) |
| Toast, turned on | "InfoCube is on: facts and dimensions are in the Cube tab." (prototype) |
| Toast, turned off | "InfoCube is off." (the prototype's "InfoCube is off. Facts and dimensions stay, read-only.") |
| Refusal under the check box | step 3's "InfoCube can be turned off only when this workspace has no facts or dimensions. It has {n}: delete them first." |
| Left panel tab | "Cube", title "InfoCube: facts and dimensions" (prototype) |
| Cube tab | "New fact", "New dimension", "Facts", "Dimensions", "No facts yet." / "No dimensions yet." with " Use New fact above." / " Use New dimension above." for editors, "grain set", "no grain", "SCD {n}" (prototype) |
| Toolbox | "New fact here", "New dimension here" (prototype) |
| Toast after a create | InfoMapper's "Created {name} in {concept}. Type its name now; change the concept in the panel." |
| Default names | "New fact", "New dimension", numbered within the level (step 3) |
| Card role | "Fact", "Dimension"; titles "A fact: one row per its grain (InfoCube)", "A dimension (InfoCube)" (the prototype's without "is off here: read-only") |
| Entity panel | "Role" |
| Delete preview | "Fact" – "deleted" / "its grain (“{grain}”) deleted"; "Dimension" – "SCD type {n} deleted"; "{n} fact(s)" – "lose this dimension: {names}"; "{n} measure(s)" – "deleted" (prototype) |
| Script | "{organization} holds the infocube licence now. Turn it on per workspace in its settings." and its refusals |

### Not in this step, and why

- **A collapsed frame's block rows (E8)** show no role: the PRD's step 4 list and Łukasz's list name the card only.
- **The details panel's canvas summary** counts every card ("11 entities … on Sales star") and its "Mapping coverage"
  lists facts and dimensions with "0 of n": the coverage of a dimensional entity is "fed" (P17), built in 15c with the
  dimensional mappings.
- **A column dropped on a fact or dimension** is not refused yet: the refusal and its toast are B-6's (15c).
- **The page's bytes** (`model_level` on every entity, PRD section 6) stay for step 5.
- **S15-02** is unit tests only (`upgrade-12.test.ts`, `table-registry.test.ts`): nothing of it is on a page.

### Tests

- **Unit:** `tests/infocube-star.test.ts` (the star against the store's rules, once, no change events, not in the plain
  seed; `moduleView` while on and off; a dimension's preview rows, each fact once); `tree-data.test.ts` (the Model tab
  logical only, a module tab's groups, search and folding); `canvas.test.ts` (a card's role, the mark's width in the clip);
  `stats.test.ts` (logical counts); `model-index.test.ts` (pickers).
- **e2e** (`e2e/slice-15a/`, the star by default): S15-01 (plain seed: three tabs, no roles, no InfoCube toolbox items,
  the preview unchanged), S15-03 (box without and with the licence, owner, modeler, admin, direct calls), S15-04 (the
  turn-off refused with 5, the deletes, off; no tab, no creates, a direct create refused; the undo refused and kept, the
  logical delete; on again, the two undos), S15-06, S15-07, S15-10, S15-14, S15-17.
- **Measurement** (`S15-layers.spec.ts`, the measurement build): see Checks.
- **Screenshots:** `SCREENS=step-4 npx playwright test e2e/slice-15a/S15A-screens.spec.ts` →
  `docs/prd/slice-15a-screens/step-4/` (the star at 50 % and 100 %, the Cube tab, the Role, Dim Date's preview, the box
  licensed, refused and without the licence; light and dark).
- **Earlier tests changed:** none. `playwright.config.ts` leaves `S15-layers.spec.ts` out of the normal run.

### Checks (4 November 2026)

- `npm run lint` and `npm run typecheck`: clean.
- `npm test`: 133 files, 1,667 tests passed.
- `e2e/slice-15a/` alone: 8 of 8 passed (after fixing three of the new specs' own mistakes: the canvas tabs counted with
  the left panel's, a refusal's wording, a second identical toast that the recorder does not count again).
- **Element guard** (`S3B-15-elements.spec.ts`, measurement build, against `slice-08.json`): passed; viewport counts
  equal (4,508 / 19,305 / 1,465 / 4,907); page totals 6,000 / 20,797 / 2,867 / 6,309, the same as since slice 11 (slice
  8's +1 and slice 11's +6 against `slice-07b`): nothing of InfoCube is on "Performance test".
- **Layers** (`S15-layers.spec.ts`, measurement build): the Sales star at 50 % with its five roles and two fact edges:
  11 drawing layers, 4.2 MP, 775 viewport elements; the same cards without roles: 11, 4.2 MP, 775. The marks add no
  element and no layer (AD-24).
- **Full e2e run** (`npm run e2e`, from scratch, no dev server running): 564 passed, 3 skipped, 94 min 33 s; part 1
  26 min 18 s, part 2 23 min 43 s, part 3 19 min 0 s, part 4 (slice-10a to slice-15a) 25 min 31 s. No failure.

## Łukasz's answers after step 4 (4 November 2026)

- Step 4 accepted; every new text approved as listed.
- **A mapping's target:** a source column mapped to a dimensional attribute is refused in the domain now, with the
  prototype's toast, so that no such mapping exists on `main` before 15c; dimmed targets and the rest of B-6 stay in 15c.
- **A safe way to look at the Sales star** without touching KB: proposed and documented in this step.
- **A collapsed frame's block without the role:** an entry in `docs/ideas.md`.
- **Step 5 is measurement and closing** (the PRD's steps 5 and 6 in one).

## 15a step 5: measurement and closing (4 November 2026)

### What changed

- **A mapping's target is a logical attribute** (`src/domain/model/levels.ts`): `MAPPING_TO_DIMENSIONAL_MESSAGE` is the
  prototype's B-6 text, "Source columns map to the logical model. Map the column to a logical attribute, then that
  attribute to the fact or dimension." (approved with step 4's list, as the prototype's).
  - The commands refuse it: `createMapping` ("Add a source column"; its state carries the attribute's entity),
    `createAttributeFromColumn` (a column dropped on a header, also onto an attribute of the column's name) and
    `mapToAttribute` ("Map to an attribute" of a change to resolve).
  - **The guard on every write set:** `runCommand` reads the model when a write set adds a mapping or points one at
    another attribute (`writesMappingTargets`) and refuses it with the same text (`mappingWritesRefusal`; an attribute
    the same writes insert counts). So a later command cannot add such a mapping by mistake. Undo needs no check: a
    level never changes, so no stored mapping points at a dimensional attribute.
  - Tests: `levels.test.ts` (3: the two commands, the guard), `actions.test.ts` (1: "Map to an attribute"),
    `e2e/slice-15a/S15-mapping.spec.ts` (the toast through a fact's attribute panel; nothing written).
- **`npm run demo`** (`scripts/demo.ts`): the demo data with the Sales star in `.data/demo-db.json` (seeded if missing,
  `-- --reset` starts it over), served by a second dev server on **http://127.0.0.1:3001** beside `npm run dev`.
  - It refuses `.data/dev-db.json` by name, builds into `.next-demo` (Next.js refuses a second dev server on one build
    folder; git-ignored, in `tsconfig.json` and lint's ignores) and listens on 127.0.0.1 only: cookies are kept per host
    name, so signing in there never replaces the session of http://localhost:3000.
  - Any other command reads another file through the existing `INFOMAPPER_DEV_DB`
    (`INFOMAPPER_DEV_DB=.data/demo-db.json npm run reset-dev-data` works too); `INFOMAPPER_DEMO_DB` names another demo file.
  - Checked: the server started, the test users' list signed in, and "Sales star" showed its 11 cards; KB's file was
    unchanged (1,565,772 bytes, 3 November 08:41). README's command table has the row.
- **`docs/ideas.md`:** "A fact's or a dimension's role in a collapsed frame's block".

### The page's bytes

Measured as slice 10c's F20 and S12B-bytes count them: the canvas page's document as the server sends it (markup and
RSC payload), fetched in the signed-in page, its size plain and gzipped, and the bytes of every `model_level` in it
(`,\"model_level\":\"logical\"`, escaped in the payload). The dev server (`npm run dev` on copies), so the absolute sizes
are a development build's; what the column adds is the same bytes in a production build. **KB was read from a raw copy
only** (`cp`; the app never opened `.data/dev-db.json`), and the copy was deleted afterwards.

| Page | Entities in the workspace | Document | gzip | `model_level` | its share | gzip share |
| --- | --- | --- | --- | --- | --- | --- |
| KB, Kanton Basel – LDM (InfoCube off) | 8 | 283,794 B | 31,838 B | 224 B (8 × 28) | 0.08 % | 15 B |
| Sales star (InfoCube on, 6 logical + 5 dimensional) | 11 | 320,107 B | 34,988 B | 328 B | 0.10 % | 27 B |
| Customer & orders, same workspace | 11 | 313,716 B | 35,334 B | 328 B | 0.10 % | 27 B |

**What InfoCube adds besides the column** (A/B on the same copy: the five facts and dimensions made logical, their
InfoCube rows deleted, InfoCube off, as `S15-layers` does; the same cards and lines):

| Page | InfoCube on | Without | Difference | gzip difference |
| --- | --- | --- | --- | --- |
| Sales star | 320,107 B | 318,215 B | +1,892 B (0.6 %) | +539 B |
| Customer & orders (no fact or dimension on it) | 313,716 B | 312,513 B | +1,203 B (0.4 %) | +465 B |

- The five roles (a role's text, title, class and mark per entity), the Cube tab's rows and the two creates go with
  every canvas page of a workspace with InfoCube on, also a canvas without facts or dimensions (`moduleView` reads the
  whole model's roles; the tab lists the workspace's). On the star the cards' roles add the rest.
- **The data file:** KB's raw copy upgraded by the app to format 12: 1,565,772 → 1,566,346 bytes (+574: 20 entities ×
  24 bytes of `"model_level":"logical",`, 4 workspaces × 17 of `"infocube":false,`, and `"organization_licence":[],`);
  every table's row count the same; every entity logical, every workspace off, no licence. This is a rehearsal of KB's
  upgrade at the manual acceptance.
- No bar was set (PRD section 6: measure, not gate). Nothing here needs a change.

### The decisions' final text (for Łukasz's approval; not yet in `docs/decisions.md`)

Each follows the PRD's proposal (section 10) and adds what 15a built. **D-67's first part** (O11: the roles and the
level rule of relationships, built in 15a) is drafted too; Łukasz decides whether it enters now or with 15c.

> **AD-33** InfoCube is a module of the one application (slice 15a). Its code lives in `src/modules/infocube/`, in
> InfoMapper's five parts (domain, data, ui, canvas, app), each under its layer's rules; InfoMapper's layers never import
> a module, and `npm run lint` checks it, with probes. `src/compose/` is the composition root: the only code that names
> the modules, imported only by `src/app`. A module enters InfoMapper only through named extension points, each plain
> data or a function the composition root hands over: its tables (the table registry: undo, the local adapter's rules and
> the data file's shape; the build fails when a module's table is missing from one of them, and a guard test checks
> every table the migrations create against them), the cascade of its rows when an InfoMapper row they point to is
> deleted (same change group), rules InfoMapper's commands take as arguments, dependencies in delete previews, what a
> page shows of it (a role per entity, left panel tabs, creates in a tab and the canvas's toolbox), a box in the
> workspace settings, its stylesheet and its demo data. A module's tables point to InfoMapper's, never the other way.
> With no module registered, InfoMapper behaves as before.

> **AD-34** An entity has a model level, `logical` or `dimensional`, set when it is created and never changed; a write
> that would change it is refused. Facts and dimensions are dimensional entities; their dimensional description (role,
> grain, SCD type, measures) lives only in InfoCube's tables, which point to InfoMapper's. The model level is the one
> InfoMapper column InfoCube needs. InfoMapper's rules read it: a relationship joins two entities of one level, an
> attribute is pasted within one level, the duplicate-name warning compares within one level, and a source column maps
> only to a logical attribute (dimensional attributes are fed from the logical model, AD-36). InfoMapper's lists and
> counts are of the logical level (the Model tab, the homes' and the status bar's counts, model consistency, the import
> review, the attribute pickers); canvas tiles and tab counts count every card.

> **AD-35** Modules are licensed per organization and turned on per workspace by an owner or admin, off by default;
> turning one on needs the organization's licence. A module is on when its workspace's switch is; the licence is read
> only when it is turned on. A module is turned off only while the workspace has none of its objects, so turning it off
> deletes nothing; while it is off, nothing creates or brings back one of its objects (a create, copy, paste, undo or
> redo). The settings show the module's box to everyone; without the licence it says "{organization} has no InfoCube
> licence." and its check box is disabled. Granting and ending a licence are not commands yet: in development a script
> grants one. A workspace's copy stays in its organization and takes the module's switch and objects with it; a
> transfer, or a copy into another organization, of a workspace with a module on is refused unless that organization
> holds the module's licence ("{organization} has no InfoCube licence. Delete this workspace's facts and dimensions and
> turn InfoCube off, or transfer it to an organization with the licence."); a workspace with the module off moves
> freely.

> **D-67** (first part, slice 15a) A dimensional entity has a role, Fact or Dimension, in place of the stereotype: on its
> card where the stereotype stands, with a cube mark, a fact's card with a thicker left edge, and in its panel as Role.
> A relationship joins two entities of the same level; between a fact and a dimension the dimension is at the one end.
> The levels meet only through dimensional mappings, logical attribute(s) → dimensional attribute (15c). The left
> panel's Cube tab lists facts, then dimensions, by concept, with New fact and New dimension; the Model tab lists logical
> entities.

### Docs changed in this step

- `docs/data-model-v2.md`: `organization_licence` as Q6 changed it (on with the switch; the licence read when turned
  on); `mapping.attribute_id` a logical entity's attribute only.
- `docs/known-limitations.md`: the licence (with `npm run demo`); a workspace's copy and transfer not built; what 15a
  leaves to 15b to 15d (the details panel's coverage, B-6's dimmed targets, a block's role, the page's roles on every
  canvas).
- `docs/inventory-prototype-vs-app.md`: a section InfoCube (missing, planned 15b to 15d; present; deliberate
  differences) and its summary row.
- `README.md`: the status line, 15a's sentence, the acceptance list, `npm run demo`, the licence script, the measuring
  and screenshot specs.
- `CLAUDE.md`: "What this is"; **Modules (AD-33)** under the architecture rules (the boundary, the composition root,
  the table registry and its guard test, the extension points, server actions outside "use server" files, how a new
  module is added); the commands; slice 15a's fixtures and helpers; an InfoCube note (the level, logical-only lists, the
  role on a card, where the star is written).
- `docs/decisions.md`: **not yet**, until Łukasz approves the text above.

### 15a's definition of done: Łukasz's manual acceptance on KB

**Before:** stop every dev server; back up KB (`.data/backups/dev-db-<yyyymmdd-hhmm>.json` and
`.data/backups/kb-model-latest.json`). The newest backup, `dev-db-20261104-0921.json`, equals KB today (SHA-256
`8a0d7c8f…`); a fresh one is taken right before the session in case KB changed. The branch upgrades KB to format 12 when
the app first reads it (every entity logical, every workspace off, no licence; as rehearsed on the copy above).

1. `npx tsx scripts/licence.ts grant "KB" infocube` (the organization's name as KB's file has it). Expected: "KB holds the
   infocube licence now. Turn it on per workspace in its settings."
2. `npm run dev`; sign in as Lukasz_KB; Kanton Basel → Settings: the InfoCube box says "Licensed for KB."; tick "Use
   InfoCube in this workspace". Expected: the toast "InfoCube is on: facts and dimensions are in the Cube tab."
3. Open a canvas (LDM); the left panel has the Cube tab. **Create a fact** (Cube tab → New fact, or the canvas's toolbox
   → New fact here) and **a dimension** (New dimension). Expected: each card shows its role with the cube, the fact a
   thicker left edge; the name is selected; the panel shows Role; each is one undo step.
4. **Relate them:** draw a relationship between the fact and the dimension. Expected: it is made with the dimension at
   the one end.
5. **Relate a logical entity to the fact.** Expected: refused with "Facts and dimensions relate to each other. To trace
   a fact to the logical model, map its attributes."
6. **Turn InfoCube off** in Settings. Expected: refused under the check box with "InfoCube can be turned off only when
   this workspace has no facts or dimensions. It has 2: delete them first."; the box stays ticked.
7. **Delete both** (each from its panel, through the impact dialog: the fact's "Fact – deleted"; the dimension's
   "Dimension – SCD type … deleted" and "1 fact – lose this dimension: …" if the fact is still there).
8. **Turn InfoCube off.** Expected: "InfoCube is off."; the Cube tab and the toolbox's two items are gone.
9. **Undo the delete** (the top bar's Undo, or Ctrl+Z on the canvas). Expected: refused with "InfoCube is off in this
   workspace, so no fact or dimension can be added or brought back. An owner or admin can turn it on in the workspace
   settings."; nothing comes back.

**After:** KB keeps the licence and the switch off; the model is as before step 3, apart from the change events of the
session. If anything is not as expected, KB can be restored from the fresh backup.

### Checks (4 November 2026)

- `npm run lint` and `npm run typecheck`: clean.
- `npm test`: 133 files, 1,671 tests passed (four new: the mapping refusal in `levels.test.ts` three times, the change to
  resolve's "Map to an attribute" in `source-changes/actions.test.ts`).
- `e2e/slice-15a/S15-mapping.spec.ts` alone: passed.
- **Full e2e run** (`npm run e2e`, from scratch, no dev server running; 16:43 to 18:13): 565 passed, 3 skipped (the
  on-demand specs), none failed, none flaky; 89 min 25 s. Part 1 (fixes to slice-02c) 22 min 38 s, part 2 (slice-03a
  to slice-06b) 22 min 28 s, part 3 (slice-07a to slice-09) 19 min 12 s, part 4 (slice-10a to slice-15a) 25 min 7 s.
  Log: `.data/e2e-15a-step5.log`.
- Before the merge: two full runs in a row (CLAUDE.md).

## Łukasz's answers after step 5 (4 November 2026)

- **Test regime** (replaces slice 4b-2's and 5a's, for every slice): after each step the slice's specs, the earlier
  specs of what the step touched, and CI; a failing test run three times on its own; one full e2e run in a step that
  touches shared infrastructure (undo and change groups, the save chain, the canvas's layers, the table registry, the
  local adapter), with the reason in its report; before a merge one full run. In `CLAUDE.md`'s Testing section and the
  PRD's section 4; PRDs no longer call a slice small or large.
- **Decisions entered in `docs/decisions.md`:** AD-33 shortened to the principle, the composition root, the lint rule
  (its probes named) and the two extension points that bind every module (the table registry with its guard test, the
  cascade in the same change group); the others are listed in `CLAUDE.md`. AD-34 with "fed from the logical model
  through dimensional mappings". AD-35 as quoted. D-67 as quoted, without "first part": one D-decision per sub-slice,
  D-68 for 15b, D-69 with AD-36 for 15c (the PRD's O11 and section 10).
- **No new e2e run:** docs only; step 5's full run (565 passed) is 15a's run before the merge. The merge waits for the
  manual acceptance on KB.

## Manual acceptance on KB (4 November 2026)

Łukasz ran 15a's definition of done on his KB model (after a backup): the licence granted with `scripts/licence.ts`,
InfoCube turned on, a fact and a dimension created and related, a logical entity's relationship to the fact refused,
turning InfoCube off refused, both deleted, InfoCube turned off, the delete's undo refused. **Passed.** Slice 15a is
accepted; it is merged into `main` and tagged `slice-15a`. 15b starts only with Łukasz's go.

## 15b step 1: grain, measures and role-playing against the code (4 November 2026)

No application code in this step. Łukasz's brief: 15b builds grain, SCD, measures and their hints as planned, plus
role-playing dimensions from `docs/infocube/role-playing-spec.md` (RQ-3, option 2); the key-name match (Q16) is never
built; the bus matrix's dots (R-8, RP-10) stay with the bus matrix in 15d.

### The starting point

- Branch `slice/15b-grain-measures-roles` from tag `slice-15a` (`2bdeb10`, the merge of PR 36); the working tree was
  clean.
- Łukasz's two files, checked before copying: `infomapper-prototype-with-sources.html`, 646,126 bytes, SHA-256
  `bf2251d9…5c71`; `infocube-role-playing-spec.md`, 11,939 bytes, SHA-256 `991efcdc…a54a`. Both as given.
- They were copied unchanged to `docs/prototype/infomapper-prototype-with-sources.html` and
  `docs/infocube/role-playing-spec.md`, checked with `cmp` and SHA-256 after the copy and on the staged blobs (no CR in
  either file, so `.gitattributes`' `eol=lf` keeps the bytes). One commit, `fa8f5d9` (`docs:`).
- The PRD is updated for 15b: section 0 (RQ-3, Q16 never built), section 2 (the two files), section 3 (`cube_key`, the
  relationship's roles, items 14 and 14a), section 4 (15b and its steps), section 5 (RP-01 to RP-14), section 9, section
  10 (D-68).

### The prototype's changes against 15a's copy

The diff is 178 lines. What 15b takes from it:

- **Role-playing:**
  - `roleAt`, `asRole`;
  - `factKeys`, now one row per relationship;
  - `addKey`, `linkKey`;
  - the R-4 hints in `factHints`;
  - the fact's Dimensions rows, which open the relationship;
  - the dimension's "Used by", one row per relationship;
  - the "Carries" field in `cubeMeasureSection`;
  - `relKeySection`;
  - `insRel`'s two role fields and its sentences;
  - the swap, which swaps the roles too;
  - the key row of an attribute in `cubeDependents`;
  - the one-time link by name in `cubeIndex`;
  - `cubeDemoV3`, the star's roles, Ship date and links;
  - the pill, which shows the roles, else the verb;
  - 20 px between two relationships of one pair of cards (was 16).
- **The bus matrix's dots** (R-8): stay with the bus matrix in 15d.
- **C-7 (R-10), now as 15a built it.** The read-only mode is gone: the hatched header, the panels' note and
  `cubeTouched` are removed. `cubeOn` is the switch alone. Turning InfoCube off with facts or dimensions is refused
  under the check box with 15a's text, and the toast "InfoCube is off." Create, undo and redo of a dimensional entity
  are refused while off (`dimsAdded`) with 15a's message, and a refused undo keeps its step. The settings text and the
  cards' titles are 15a's. **One detail differs:**
  - The prototype's check box shows the switch as stored and stays enabled for an owner or admin while InfoCube is on,
    even without the licence, so it can be turned off.
  - 15a's `InfoCubeBox` (`src/modules/infocube/app/infocube-box.tsx` l. 54–55) shows `on && licensed` and is disabled
    without the licence.
  - This only shows when a licence row disappears while InfoCube is on. Ending a licence is not a command (AD-35), so
    today that happens only by editing the file by hand.
  - **Proposal (R1):** align the box with the prototype in 15b step 4. It is two conditions; otherwise it is a listed
    difference.
- **The prototype's licence button** ("The InfoCube licence for … ended. Workspaces using InfoCube keep it on; …") is
  prototype-only, as in 15a.

### Where the spec meets the code

**1. The relationship (RP-A): InfoMapper's.**

- **Today's code:**
  - `Relationship` (`src/domain/types.ts` l. 181) has no roles.
  - `updateRelationship` (`src/domain/commands/relationship.ts` l. 93) writes only the changed columns of `COLUMNS`
    (l. 84).
  - The panel is `relationship-panel.tsx`: its sentences at l. 56–61, the verb phrase as a `TextField` with `keep`
    (slice 13) at l. 63.
- **Proposal:**
  - Add `from_role` and `to_role` (text, null) to the type, `fromRole`/`toRole` to `updateRelationshipInput`
    (`optionalTextSchema`: trimmed, empty = null) and two entries to `COLUMNS`.
  - The panel gets two `TextField`s after the verb phrase, with `keep` like the verb phrase: one undo step per edit, the
    draft rules of D-66, no new save path.
  - The sentences add " as {role}" after the entity it belongs to (R-1).
  - **On a relationship to itself** the panel names its ends after the loop ("At the right end", "At the top end",
    slice 10a). The prototype's "Role of {from}" and "Role of {to}" would read the same name twice there, so the
    proposal (R2) is "Role at the right end" and "Role at the top end".
  - `createRelationship` writes both as null.
  - InfoMapper's other places that show a relationship stay as they are, as in the prototype: the entity panel's
    "Relationships" fold (`entity-panel.tsx` l. 268), the bundle panel's rows (`bundle-panel.tsx` l. 59) and the delete
    dialog's count.
- **Swap** (`swapRelationship`, l. 122):
  - It moves the entities and cardinalities; it must move the roles too (`from_role` ↔ `to_role`), as the prototype
    does.
  - **Its "nothing to change" check (l. 133) must count the roles.** On a relationship to itself with equal
    cardinalities and two different roles, a swap does change something.
  - The key link points to the relationship's id, so a swap keeps it with no extra write (RP-B: "Turning a relationship
    keeps the link").
- **The canvas:**
  - `buildLines` (`src/canvas/line-data.ts` l. 115–131) gives each relationship `label: r.label`.
  - `RelPath` draws the pill from `line.label` (`LineLayer.tsx` l. 123–137).
  - **Proposal:** `buildLines` sets the pill's text to "{from role} / {to role}", one role alone, else the verb phrase
    (R-7). The memo's `sig` already changes with the text, and the pill keeps its `rect` and `text`: **no element
    more** (RP-D, AD-24).
  - The offset becomes `(n - 1) * 20` for relationships only. Source relationships (l. 143, slice 10b) keep 16 px: the
    spec and the prototype change only relationships, and a source line has no pill.
  - Bundles' "n relationships", the miniature and the thumbnails do not draw the pill, so they are unchanged.
- **Earlier specs to rerun for the 20 px:**
  - slice 1b's relationships;
  - slice 10a's self-relationships: `clickLine`, `LOOP_VIEW`, `relationshipLine`;
  - S10A-12 (branch only), if loops take the offset (`relGeom`'s loop spacing).
  - The element guard is not affected ("Performance test" has relationships, but counts, not positions, are compared).

**2. The key link (RP-B): InfoCube's table `cube_key`.**

- The module's third table, beside 15a's two (`src/modules/infocube/domain/types.ts`, `tables.ts`, `data/tables.ts`).
  Columns: `relationship_id` and `attribute_id` (both not null), the standard columns and `workspace_id`.
- **The table registry** (AD-33):
  - the type in `InfoCubeRows`;
  - `INFOCUBE_UNDO`: `parents: [["relationship_id", "relationship"], ["attribute_id", "attribute"]]`, noun "key link";
  - `INFOCUBE_RULES`: `unique: [{ columns: ["relationship_id"], live: true }, { columns: ["attribute_id"], live: true }]`
    (one key per relationship, one relationship per attribute);
  - `ComposedDb`;
  - a migration with the two foreign keys, two partial unique indexes (`where deleted_at is null`) and RLS.
  - The guard test (`tests/table-registry.test.ts`) fails until all four are there. The schema check passes.
- **What the rules check beyond uniqueness:**
  - The relationship joins a fact and a dimension, and the attribute belongs to that fact.
  - These are the module's commands' checks, not the adapter's, as `cube_measure`'s "only on attributes of a fact" is
    in 15a (`commands.ts`).
- **The page:**
  - `moduleView` (`src/compose/view.ts` l. 23) reads `cube_entity` only. 15b adds `cube_measure` and `cube_key` for the
    panels and the Σ marks.
  - It reads them only when the workspace has a dimensional entity, as today.
  - The rows go with `id`, `version` and their content, without `created_*`/`updated_*` (O8).
  - Measured in step 5 (page bytes on the star).

**3. Linking, Add key and the attribute's FK flag.**

- **Linking** (R-1's select) is a module command:
  - `linkKey(relationshipId, attributeId | null)`: soft-delete the relationship's link and the attribute's other link,
    insert the new one.
  - It sets `is_foreign_key` only when the attribute did not have it. The select offers only the fact's foreign keys
    that carry nothing else, so normally nothing is written to the attribute.
  - One change group, saved on the chain with the relationship's link held and the attribute checked.
- **Add key** (R-3) is a module command:
  - It inserts an attribute through InfoMapper's `addAttribute` rules, named `{role}_{pk}`, without repeating the
    shared word. The rule is in one domain function with its tests: Ship date + `date_key` → `ship_date_key`; Bill to +
    `customer_key` → `bill_to_customer_key`.
  - The name is numbered if taken, with `_2` as the prototype does.
  - The type is the dimension's primary key's (all five type columns), FK on, not nullable.
  - It is placed after the fact's last key attribute, renumbering the siblings as `reorderAttribute` does
    (`attribute.ts` l. 428).
  - It inserts the `cube_key` row.
  - One change group: "One undo removes the attribute and the link; the role stays" (RP-04). The siblings are held on
    the chain, as an attribute's move is (`saveRows`, slice 10a).
  - Refused while the dimension has no primary key ("{dimension} has no primary key yet.").
  - The toast is "Added {name}, the key of {dimension}{ as role}.".
- **The FK flag cleared** (RP-06). InfoMapper's `updateAttribute` (`attribute.ts` l. 173) writes `is_foreign_key`, and
  must not know InfoCube.
  - The link's removal is a module rule on an update, not a delete, so `moduleCascade`
    (`src/domain/commands/module-cascade.ts`, deletes only) does not cover it.
  - **Proposal (R3), a new extension point: module follow-ups.**
    - A function per module, `(writes, rows) => Write[]`, registered in `src/compose/model.ts`.
    - It runs in `runCommand` after the cascade (`withModuleCascades`, `run-command.ts` l. 201) and returns
      soft-deletes for InfoCube's links whose attribute is no longer a foreign key (or no longer the fact's), in the
      same change group.
    - It is also passed to `revertChangeGroup` (undo and redo), as `followOriginals` is (`undo.ts` l. 398).
  - **Why undo needs it too:** an older step "turn FK on" undone after that attribute was linked in a later step. The
    link did not write the attribute, so undo's version check (`undo.ts` l. 2: refused when a row changed since) lets the
    revert through, and without the follow-up the link would survive on an attribute that is no longer a key.
  - `CLAUDE.md`'s list of extension points gets it (AD-33).
- **Deletes** (RP-07, RP-08):
  - The link goes with its relationship or its attribute through `moduleCascade`, once `cube_key` registers both
    parents: deleteRelationship, deleteAttribute, deleteEntity (its relationships and attributes, `entityCascade`) and
    a concept's delete.
  - One undo brings both back: `revertChangeGroup` restores the group's rows, and the parents are live again first.
  - The relationship and the attribute stay when only the link goes.
  - "The relationship no longer joins a fact and a dimension" **cannot happen in the app**: no command changes a
    relationship's ends (swap keeps the pair), the model level never changes (AD-34), and a `cube_entity`'s role is
    never changed. So no rule is needed for it, beyond the commands' checks on link.
- **Undo's uniqueness:** an undo that brings back a link while its relationship or attribute has another live link is
  refused by the adapter's unique rule with the undo conflict message ("…changed since"), as 15a's `cube_entity`.
- **Paste** (`pasteAttribute`, l. 247) copies a primary key as a foreign key (l. 279). A dimension's `date_key` pasted
  into a fact is a foreign key with no link, so R-4 shows "date_key is a foreign key but carries no dimension." This is
  RP-C: no match by name.

**4. Grain, SCD, measures (as planned for 15b).**

- These are module commands on 15a's tables:
  - `setGrain`: text, trimmed, empty = null; the grain is a `TextField` with `keep`, as D-66 asks;
  - `setScdType`: 0 to 2;
  - `setMeasure` on or off: the row inserted, or soft-deleted;
  - `setAdditivity`: semi keeps the note, any other clears it;
  - `setSemiNote`: a `TextField`.
- Each is one change group on the chain, saved with its `cube_entity` or `cube_measure` row checked (`saveRow`).
- A new measure is Additive for Integer and Decimal, Non-additive otherwise. A foreign key made a measure gets the
  toast "{attribute} is a foreign key. A dimension key is usually not a measure."
- Turning a measure off and on again inserts a new row; the live unique rule allows it.
- The rights are InfoMapper's `model.edit`, so reviewers cannot edit (S15-08). C-7 needs nothing here: while off there
  is no dimensional entity.

**5. Derived rows and hints, in the module's domain (no data).**

- `factKeys(fact)`: one row per relationship between the fact and a dimension, `{ relationship, dimension, role, key }`.
  The role is the one at the dimension's end.
- `usedBy(dimension)`: the same rows from the dimension's side.
- `factHints(fact)`: B-5's grain and measure hints, and R-4's key hints in the prototype's order.
- They are pure functions with unit tests, run in the browser from the model and the module's rows, as the panels
  derive InfoMapper's sections today.
- The Cube tab's "grain set" and "no grain" already follow the row (`tabMeta`).

**6. Delete previews (R-9).**

- **A dimension** ("{n} facts – lose this dimension", each fact once) is in 15a (`entityDependents`), covered by
  S15-14 and RP-09.
- **An attribute** has no preview dialog in the app.
  - Its delete asks a second click when it has mappings or copies (`attribute-panel.tsx` l. 334–342,
    `armedDeleteText`; the canvas's Delete in `canvas-host.tsx` l. 611).
  - The prototype opens a dialog (`askDeleteAttr`) whenever a module reports dependents. In 15b those are the measure's
    "1 measure – deleted" and the key's "Carries {dimension} as {role} – the link is deleted; the relationship stays".
  - 15c's X-3 needs the same dialog for a logical attribute that feeds a dimensional one.
  - **Proposal (R4):** in 15b, an attribute with module dependents opens a dialog like the entity's (`delete-entity-dialog.tsx`,
    the prototype's text "Other parts of the model depend on it. You can undo it right after.", a table of rows,
    "Cancel" and "Delete {name}"). It is fed by a new `moduleAttributeDependents` beside `moduleEntityDependents`
    (`src/compose/view.ts` l. 47).
  - Without module rows the delete stays as it is.
  - The alternative is the second click with the rows in its text, then the dialog in 15c.
- **A relationship:** no dialog, as today; its link goes in the same undo step.

**7. The Σ marks on the card (B-3).**

- Step 1 of the slice (Q11) proposed one `<i class="meas">` per measure row (+1 element per measure row). The
  prototype draws a `span.meas` with a title.
- **Proposal (R5): no element.** A class on the row (`meas add`, `meas semi`, `meas non`) and the glyph as `::after`
  content, as 15a's role mark is a mask on an existing span (CLAUDE.md, the InfoCube note). The tooltip goes on the
  row's existing title, if it has one, and is otherwise dropped.
- `withClips` counts the glyph's width, as `ROLE_MARK`.
- The marks come to the cards from `ModuleView` (`rowMarks` by attribute id, as `roles`), through `buildCards`.
- Below 40 % the rows are not drawn, so neither are the marks.
- Measured in step 5: S15-layers on the star (layers and elements) and the element guard ("Performance test" has no
  measures: equal counts).

### The one-time link from names (RP-C's migration, RP-13)

- **What the prototype does:** once per saved model (`C.kv`), for every fact–dimension relationship without a link: if
  the fact has exactly one foreign key named as the dimension's primary key, and it carries nothing else, link them.
- **What the app has to work with:**
  - **The seed's star** (`src/modules/infocube/data/sales-star.ts`, `addSalesStar`) is written by `npm run seed`,
    `reset-dev-data`, `npm run demo` and slice 15a's fixtures.
    - **Proposal:** it writes the roles, the second Fact Sales – Dim Date relationship (Ship date), `ship_date_key`
      after `date_key`, and the three links explicitly, as `cubeDemoV3` does: no name rule.
    - The e2e star is fresh in every test, so slice 15a's specs see it.
    - **Two of them change:** S15-14 now counts Dim Date's relationships with the Ship date one, and S15-layers has one
      line and pill more. They are listed in step 2.
  - **The format upgrade** (12 → 13, `upgradeDb` in `src/data/local/file.ts` l. 91) is InfoMapper's data layer. It adds
    `from_role` and `to_role` as null.
    - It cannot apply InfoCube's rule: it would have to read `cube_entity`, and InfoMapper's layers never name a module
      (AD-33).
    - `readDb(file)` (l. 45) and its cache (`readDbCached`, l. 195) take no schema, so a module step passed through
      `STORE_SCHEMA` would run only when the composed store happened to read the file first. When InfoMapper's default
      store reads it first, it writes format 13 back without the links, for good.
  - **The files that have fact–dimension relationships today** (read 4 November 2026):
    - `.data/demo-db.json` (the 15a star, 5 dimensional entities) and `.data/e2e-db.json` (reseeded per test).
    - KB's `.data/dev-db.json` has **none**: 0 live dimensional entities after the manual acceptance deleted both.
    - Every other file under `.data/` has none either.
- **Proposal (R6):**
  - The rule is one pure module function, `keysFromNames(model, cube rows)` → new `cube_key` rows, with RP-13 as its
    unit test (the prototype's three conditions, and no role invented).
  - It is applied **by a development script**: `npx tsx scripts/infocube-keys.ts link-by-name [--file <db>]`, like
    `scripts/licence.ts`. It refuses production, writes no change event and is not an undo step, as the spec says ("Logged
    nowhere, not an undo step"). It prints how many links it made.
  - The format upgrade adds only the null roles.
  - `npm run demo -- --reset` gives the demo file the new star with its explicit links; without `--reset`, the 15a
    star there shows the R-4 hints until the script is run or the keys are picked.
  - This holds while every file is local (AD-29). The database slice gets a SQL migration with the same rule, written
    then.
- **The alternative (R6 b):**
  - A module upgrade hook in the data layer, registered by the composition root and run by every `readDb`.
  - It needs a registry the data layer reads without importing a module, plus a guard that no store reads a file before
    the registration. That is a new extension point with an ordering rule, for one file Łukasz can reset.
  - Not recommended.

### Undo, change events, the table registry: summary

| Change | Where | Undo | Registry |
| --- | --- | --- | --- |
| `from_role`, `to_role` | `relationship` (InfoMapper), format 13, migration | one step per field; old change events without them are undone as null (`IMAGE_DEFAULTS`, `undo.ts` l. 130, as `model_level` in 15a) | InfoMapper's table, no change |
| `cube_key` | InfoCube, migration | in the history; parents relationship and attribute | `UNDO_TABLES`, `STORE_SCHEMA`, `ComposedDb`, the guard test |
| Link, Add key, grain, SCD, measures | module commands | one step each (Add key: the attribute, its siblings' order, the link) | – |
| FK cleared, relationship or attribute deleted | follow-up (R3) and `moduleCascade` | in the same step; undo and redo run the follow-up | – |

**Step 2 touches the table registry and the local adapter, and step 3 touches change groups and undo (the follow-up
in `runCommand` and in `revertChangeGroup`).** By the test regime each of them gets a full e2e run.

### Differences between the prototype and the app that 15b touches

| # | What | Prototype | App (proposal) |
| --- | --- | --- | --- |
| R1 | InfoCube box without the licence while on | checked, enabled for owners and admins | today: unchecked, disabled; proposal: as the prototype |
| R2 | Role fields on a relationship to itself | "Role of {name}" twice | "Role at the right end", "Role at the top end" (slice 10a's names of the ends) |
| R4 | Attribute delete with module rows | a dialog (`askDeleteAttr`) | proposal: the same dialog, built in 15b for 15c's X-3 too |
| R5 | Σ marks | a `span` with a title per measure row | a class and `::after`, no element |
| R6 | One-time link by name | on load, once per model | a development script with the same rule as a unit-tested function |
| R7 | Source relationships' offset | not changed (no pill) | stays 16 px |
| R8 | Missing links after a hand-made change | dropped while indexing (`cubeIndex`) | deleted by the commands in the change group (cascade, follow-up), never on read |
| R9 | Measure off | the row removed | soft-deleted (AD-23) |

The prototype's remaining InfoCube-off texts are 15a's, so nothing else differs there.

### Proposed steps

**Step 2 – data** (a full e2e run: the table registry, the local adapter):

- `relationship.from_role`/`to_role`: the type, the local schema, format 13 and its upgrade (null, no change event,
  not repeated), undo's image defaults, the migration.
- `cube_key`: the type, the registry's three records, the rules, the migration, the guard test.
- The star with roles, Ship date, `ship_date_key` and three links.
- KB's backup before the branch's first dev or e2e run (format 13).
- Earlier tests that change (S15-14, the star's counts), with the reason.

**Step 3 – domain** (a full e2e run: change groups and undo):

- The roles in `updateRelationship` and `swapRelationship` (with the self-relationship's check).
- InfoCube's commands: grain, SCD, measure, additivity, semi note, link, Add key (with the name rule).
- The follow-up (R3) in `runCommand` and undo.
- `factKeys`, `usedBy`, `factHints`, `keysFromNames` and the script.
- `moduleAttributeDependents`.
- Domain tests for every rule, including RP-13.

**Step 4 – interface:**

- The relationship panel's roles, sentences and InfoCube section.
- The fact's and the dimension's sections.
- The attribute's Measure section and "Carries".
- The pill and the 20 px.
- The Σ marks.
- The attribute's delete dialog (R4).
- The box (R1, if accepted).
- The specs, and the screenshots light and dark.

**Step 5 – measurement and closing:**

- The element guard against `slice-08.json`.
- S15-layers on the star with the marks and the second pill.
- The page's bytes with the module's rows.
- D-68's text for approval.
- The docs: `data-model-v2.md`, `known-limitations.md`, the inventory, README, CLAUDE.md's extension points and
  commands.
- One full run before the merge; the manual acceptance on KB.

### Proposed criteria and their tests

| ID | What | Test |
| --- | --- | --- |
| S15-07 (hints) | A new fact's panel shows "No grain yet. …" and "No dimension keys. …" | e2e `S15-07.spec.ts` (extends 15a's) |
| S15-08 | Grain cleared → its hint, undo; `quantity` semi-additive across "Date" → Σ~ and in Measures; `order_number` as a measure → the type hint; a foreign key as a measure → the toast; each one undo step; a reviewer sees them read-only | e2e |
| S15-08b | SCD type 0/1/2 with its sentence; the Cube tab's "SCD n" and "grain set"/"no grain" follow | e2e |
| RP-01 | The star: two lines Dim Date – Fact Sales, pills "Order date" and "Ship date", 20 px apart | e2e |
| RP-02 | Fact Sales' Dimensions, one row per relationship with its key; no key hints | e2e |
| RP-03 | A third relationship Dim Date → Fact Sales: "Dim Date is related 3 times. Name each role." and "Dim Date is related, but no key carries it." | e2e |
| RP-04 | Role "Payment date", Add key → `payment_date_key` (Integer, FK) after the last key, linked, hints gone; one undo removes the attribute and the link, the role stays; redo | e2e + unit (name rule) |
| RP-05 | The Ship date key select: `ship_date_key` selected, `date_key` not offered | e2e |
| RP-06 | FK cleared on `ship_date_key` → link gone, its hint; undo restores both (and the older-step undo case of R3) | e2e + unit |
| RP-07 | Delete `ship_date_key`: the preview row "Carries Dim Date as Ship date – the link is deleted; the relationship stays"; undo | e2e |
| RP-08 | Delete the Ship date relationship: line gone, "ship_date_key is a foreign key but carries no dimension."; undo restores both | e2e |
| RP-09 | Delete Dim Date: "2 facts – lose this dimension: Fact Sales, Fact Orders", each once | e2e (S15-14 as changed) |
| RP-11 | Dim Date's Used by: three rows, per relationship, with keys | e2e |
| RP-12 | Rename Dim Date's `date_key` to `date_sk`: links unchanged, no key hints | e2e |
| RP-13 | A model with 15a's star and no links → `keysFromNames` links by the old rule, nothing else changes | unit (and the script on a copy) |
| RP-14 | A logical relationship with the role "billing": the pill, the sentences, no InfoCube section; swap moves the role | e2e |
| S15-19 | CI, the full runs of steps 2 and 3 and before the merge; earlier tests changed, with reasons | – |
| S15-18 (15b part) | Element guard equal; layers on the star with marks and pills; page bytes | measurement |

RP-10 (the bus matrix's dots) goes to 15d with S15-16.

### New user-facing texts (for approval in step 4; all the prototype's)

- **Relationship panel:** "Role of {entity}" (R2 on a relationship to itself), placeholder "e.g. Ship date"; the
  sentences "… {entity} as {role}."; "InfoCube"; "Key in {fact}"; "None"; "Add key"; "{dimension} has no primary key
  yet."; the toast "Added {name}, the key of {dimension}{ as role}."
- **Fact section:**
  - "Grain", placeholder "One row per … e.g. one order line";
  - "Measures", with "None yet. Open a numeric attribute and turn on Measure.";
  - "Dimensions": rows "{dimension}{ as role}" with "key {name}" or "no key", and "None yet. Draw a relationship to a
    dimension.";
  - "Hints", with "Nothing to check: grain, keys and measures look complete.";
  - the hints of B-5 (grain, measure type) and R-4.
- **Dimension section:**
  - "Slowly changing dimension type": "0 · keep", "1 · overwrite", "2 · history";
  - the sentences "Values never change once loaded.", "A change overwrites the old value; no history.", "A change adds
    a new version; the old one stays with its validity.", and "Technical columns (valid from, valid to, current) are a
    physical matter and are not modelled here.";
  - "Used by": rows "{fact}{ as role}" with "key {name}" or "no key", and "No fact uses it yet."
- **Attribute of a fact:**
  - "Carries": a row "{dimension}{ as role}" with "relationship", or "No dimension. Pick this key in a relationship to a
    dimension.";
  - "Measure": "Measure"; "A foreign key carries a dimension's key; it is not a measure."; "Not a measure: a degenerate
    dimension or a descriptive value of the fact.";
  - "Additivity": "Additive", "Semi-additive", "Non-additive";
  - "Not additive across", placeholder "e.g. Date (a balance)";
  - "Its type is {type}. Measures are usually Integer or Decimal.";
  - the toast "{attribute} is a foreign key. A dimension key is usually not a measure."
- **Delete previews:**
  - "Carries {dimension}{ as role}" – "the link is deleted; the relationship stays";
  - "{n} measure(s)" – "deleted";
  - for R4's dialog: "Delete {name}?", "Other parts of the model depend on it. You can undo it right after.", "Cancel",
    "Delete {name}".

### Questions for Łukasz

- **R1.** Align the InfoCube box with the prototype (checked and enabled while on, even without the licence)?
  Recommended: yes, in step 4.
- **R2.** On a relationship to itself, "Role at the right end" and "Role at the top end"? Recommended: yes.
- **R3.** The new extension point "module follow-ups" (after the cascade in `runCommand`, and in undo and redo) for the
  link's removal when the FK flag is cleared? Recommended: yes. The alternative, InfoMapper's `updateAttribute`
  refusing to clear the flag of a linked key, would make InfoMapper know about links.
- **R4.** An attribute's delete with module rows: the prototype's dialog now, for 15c too? Or the second click with the
  rows in its text? Recommended: the dialog.
- **R5.** The Σ marks as a class with `::after`, the prototype's title folded into the row's or dropped? Recommended:
  yes (0 elements).
- **R6.** The one-time link by name as a unit-tested function run by a development script, the format upgrade adding
  only the null roles? Recommended: yes (KB has no fact–dimension relationship; `npm run demo -- --reset` gives the
  demo the explicit links).
- **R7.** Source relationships keep 16 px? Recommended: yes.
- **D-68 and the data:** the roles on InfoMapper's relationship are a data model change for every workspace (two
  columns). D-68 covers the behaviour; `docs/data-model-v2.md` gets the columns and `cube_key` in step 5. A separate
  AD is not proposed (AD-34's "the one InfoMapper column InfoCube needs" stays true: the roles are InfoMapper's own,
  generic, RP-A). Confirm.

## Łukasz's answers to 15b step 1 (4 November 2026)

- **R1:** yes, the InfoCube box as the prototype (ticked and enabled while on, even without the licence).
- **R2:** yes, on one condition: the role fields use the same words as the cardinality fields on a relationship to
  itself (D-61). Those say "At the right end" and "At the top end" (`relationship-panel.tsx`, D-61's text), so the roles
  are "Role at the right end" and "Role at the top end".
- **R3:** not as proposed. **A key link whose attribute is not a foreign key is inactive:** panels, hints and the key
  select ignore it, nothing deletes it. RP-06 behaves the same for the person, and undo needs nothing. Turning the flag
  back on brings the link back: a deliberate difference from the prototype (PRD section 8). What it means for the
  commands:
  - an inactive link still holds its relationship's and its attribute's live unique rule, so linking another key to
    that relationship, Add key on it, and linking that attribute elsewhere soft-delete the inactive link in the same
    change group (as an active one);
  - the delete preview's "Carries …" row and the attribute panel's "Carries" read active links only;
  - deleting the relationship or the attribute still takes the link along (`moduleCascade`).
  - **Does 15c need follow-ups anyway (Łukasz asked)?** Not for this, but for Q-5: "a dimensional mapping goes whole
    when any of its inputs goes". `moduleCascade` deletes a module row whose *parent* is deleted. A
    `cube_mapping_input` goes with its logical attribute that way, but its `cube_mapping` is that input's parent, not its
    child, so the mapping itself would stay with one input fewer. 15c needs a module rule for it. Either:
    - `moduleCascade` learns "a row goes when any of its registered children goes" (a second kind of parent, in the
      same registration), which needs no follow-ups; or
    - InfoCube's deletes write the whole mapping themselves; that does not cover a logical attribute deleted by
      InfoMapper's command.
    The first is proposed for 15c's step 1; it is a delete cascade, not an update rule. **No update follow-up is needed
    in 15c** as specified.
- **R4:** reuse the delete with its second click (D-47, slice 10c) for an attribute that is a measure or carries a key;
  no new dialog. **As read here:** the attribute's `ConfirmDelete` (`attribute-panel.tsx` l. 334–342, `armedDeleteText`'s
  `also`/`then`, and the canvas's Delete in `canvas-host.tsx` l. 611) asks the second click whenever InfoCube reports
  rows, and its text names them ("Click again to delete, with 1 measure; Fact Sales loses its key for Dim Date as Ship
  date" or similar, proposed with the texts in step 4). If the rows do not fit, a screenshot goes to Łukasz before
  anything else is built there.
- **R5:** yes (a class and `::after`, no element).
- **R6:** no script and no function: only the demo and e2e files have facts, and both are seeded explicitly. **RP-13 is
  dropped** from the app's criteria; it stays a prototype scenario. `.data/demo-db.json` has 15a's star without links:
  `npm run demo -- --reset` gives it the new star (README, step 5).
- **R7:** yes, source relationships keep 16 px.
- **D-68** covers grain, SCD, measures, hints and role-playing; it describes role names as an InfoMapper feature of every
  relationship, which InfoCube reads. At 15b's closing AD-34 gets one sentence: "InfoCube also reads relationship roles,
  which InfoMapper keeps for every relationship (D-68)." Both texts are quoted to Łukasz then.

**Found while recording the answers (for Łukasz, step 4): D-61 and the prototype's 20 px.** D-61 says a relationship to
itself's "further loops on one card nest outside it, their ends 16 px further from the corner". The app's loops take the
same offset as the lines (`relGeom` → `loopGeom(A, off)`, `src/canvas/geometry.ts` l. 270–271; `line-data.ts` l. 130), and
so does the prototype's `relGeom(r, (n - 1) * 20)`, so the prototype nests loops 20 px apart too. Proposal: 20 px for
lines between two cards (R-7's reason, two pills), loops keep D-61's 16 px; or 20 px for both with D-61 changed in 15b's
PR. Nothing in step 2 depends on it.


## 15b step 2: the data (4 November 2026)

### What changed

- **`relationship.from_role`, `to_role`** (RP-A, D-68): text, null when not named, on InfoMapper's relationship.
  - The type is `Relationship` (`src/domain/types.ts`), and the migration is
    `20261104110000_relationship_roles.sql`.
  - The local file's **format 13** (`upgradeDb`, `src/data/local/file.ts`) adds both as null on every relationship,
    with no change event and no log line. It is written back at once and not repeated.
  - Undo reads an older change event's image without them as null (`IMAGE_DEFAULTS`, `undo.ts`, as `model_level` in
    15a).
  - Everything that writes a relationship today writes them as null: `createRelationship`, the seed, the large seed
    and the fixtures. No command sets them yet (step 3).
- **`cube_key`** (RP-B): InfoCube's third table.
  - Registered in all three of the registry's records:
    - `INFOCUBE_UNDO`: parents relationship and attribute, noun "key link";
    - `INFOCUBE_RULES`: foreign keys, plus one live link per relationship and one per attribute;
    - `InfoCubeDb`, the file's shape.
  - The migration is `20261104110100_infocube_keys.sql` (two partial unique indexes, RLS), with the schema check's
    list.
  - A link goes with its relationship or its attribute in the same change group through 15a's `moduleCascade`, and
    one undo brings both back. Clearing the attribute's FK flag writes nothing of InfoCube's (R3: the link stays,
    inactive).
- **The Sales star** (`addSalesStar`, RP-F):
  - Dim Date's role "Order date" on its relationships to Fact Sales and Fact Orders.
  - A second Fact Sales – Dim Date relationship, "Ship date", with `ship_date_key` (Integer, FK) after `date_key`.
  - Every one of the six relationships linked explicitly to its fact's key (RP-C).
  - The facts' measures as the prototype's demo has them: `quantity`, `net_amount`, `total_amount`, `line_count`
    additive; `unit_price` and `discount_pct` non-additive.
- **KB:** backed up before the branch's first run (`.data/backups/dev-db-20261104-2113.json` and
  `kb-model-latest.json`, equal to `.data/dev-db.json`). The app upgrades KB to format 13 when it first reads it: two
  null columns on each of its relationships. KB has no facts, so nothing else changes.
- **`.data/demo-db.json`** (15a's star, format 12, no links) is upgraded the same way when `npm run demo` reads it. Its
  links and roles come only with `npm run demo -- --reset` (R6: no link by name).

### Earlier tests changed, and why

- **The "current format" checks** in `organization-store.test.ts`, `requirement-store.test.ts`, `upgrade-8.test.ts`,
  `working-layer-store.test.ts` and `upgrade-12.test.ts` said `12`. They now read `DEV_DB_FORMAT`, so the next format
  does not touch them again. `upgrade-12.test.ts` strips the roles from its format-11 file too, since the file now goes
  on to 13.
- **`tests/infocube-star.test.ts`:**
  - the star's six relationships with roles and keys, the key attributes' order, and the measures;
  - the dimension's preview tested on the star's own two Dim Date – Fact Sales relationships, in place of one added by
    the test;
  - Fact Sales' preview now has 15a's "4 measures – deleted" row.
- **`e2e/slice-15a/S15-14.spec.ts`:** Dim Date's preview says "3 relationships – deleted" (was 2: the Ship date one is
  new). It also checks that the three key links go with the delete and come back with the undo.
- **To be read in step 5:** `S15-layers.spec.ts` (measurement only), whose star now has one line and one pill more.

### New tests

- `src/data/local/upgrade-13.test.ts` covers the upgrade: null roles, counts, no change event, written back, not
  repeated with roles set.
- `tests/infocube-keys.test.ts` covers:
  - the link cascades with its relationship and with its attribute, and one undo brings it back;
  - an FK flag cleared writes only the attribute (R3);
  - the store's two live unique rules and the foreign key;
  - a 15a star file upgraded to 13: InfoCube's rows as they were, no link by name (R6).

### Checks (4 November 2026)

- `npm run lint` and `npm run typecheck` clean; `npm test` 135 files, 1,679 tests passed.
- The slice-15a specs: 9 passed (S15-14 after its update above).
- **One full e2e run** (`npm run e2e`, from scratch, no dev server running), because the step touches the table
  registry (`cube_key` in undo, the local adapter's rules and the data file's shape) and the local adapter (format 13):
  563 passed, 3 skipped, 2 failed, 91 min 37 s (part 1: 23 min 6 s; part 2: 23 min 21 s; part 3: 19 min 25 s; part 4:
  25 min 44 s). The two failures, kept with the log in `.data/e2e-15b-step2-fail/` (git-ignored):
  - S7B-12 and S7C-02 expected the file written back as format 12, a literal, as the seven unit tests changed above.
    Not a flake and no product bug: both now read `DEV_DB_FORMAT`, and each passed three times on its own (with lint and
    typecheck clean).

## Łukasz's answers to 15b step 2 (4 November 2026)

- **Step 2 accepted.**
- **The line offset:** 20 px for lines between two cards and for loops. D-61's 16 px becomes 20 px at 15b's closing, its
  text quoted to Łukasz then. If e2e specs check loops at 16 px and the change spreads widely, stop and tell him; loops
  then keep 16 px. **Checked in step 3:** one spec checks a relationship's loop at 16 px (`S10A-08.spec.ts` l. 144,
  `expectLoopAt(b, 16)`); `S10B-02`'s 16 px is a source key, which keeps 16 px (R7). The change is small and goes ahead
  in step 4.
- **Every literal file format in the tests reads `DEV_DB_FORMAT`** (step 3, below).

## 15b step 3: the domain (4 November 2026)

### What changed

- **The literal file formats in the tests.** What a test expects after a read now reads `DEV_DB_FORMAT`:
  - `src/data/local/upgrade-13.test.ts`: `upgraded.format` and `onDisk.format` (`13`); the check
    `DEV_DB_FORMAT === 13` is removed;
  - `tests/infocube-keys.test.ts`: the 15a file's upgraded `format` (`13`);
  - with step 2's (seven unit tests, `e2e/slice-07b/S7B-12.spec.ts` and `e2e/slice-07c/S7C-02.spec.ts`), no test
    expects a format number any more. The old formats the upgrade tests write as their input (`format: 6`, `7`, `10`,
    `11`, `12` …) describe the old files and stay.
- **Roles (InfoMapper, RP-A):** `updateRelationship` takes `fromRole` and `toRole` (trimmed, empty = none, absent =
  unchanged; any level). `swapRelationship` swaps the roles with their ends. On a relationship to itself, "Nothing to
  change." also needs equal roles. A key link stays with a swapped relationship (it points to the relationship).
- **InfoCube's commands** (`src/modules/infocube/domain/commands.ts`), each one change group and one undo step, with
  InfoMapper's rights and the archive (`model.edit`):
  - `updateCubeEntity`: a fact's grain (trimmed, empty = none) or a dimension's SCD type (0, 1, 2), on InfoCube's row at
    its version. Refused: a grain on a dimension ("Only a fact has a grain."), a type on a fact ("Only a dimension has
    an SCD type.").
  - `setMeasure`: on makes an attribute of a fact a measure, Additive for Integer and Decimal, Non-additive otherwise.
    It answers the toast for a foreign key ("{name} is a foreign key. A dimension key is usually not a measure."); the
    measure is made all the same, as the prototype does. Off soft-deletes the measure at its version. Refused on
    another attribute: "Only an attribute of a fact can be a measure."
  - `updateMeasure`: the additivity and "Not additive across". Leaving semi-additive clears the note. A note on another
    additivity is refused: "Only a semi-additive measure has “Not additive across”."
  - `linkKey` ("Key in {fact}", R-1):
    - links a foreign key of the relationship's fact, or none;
    - picking another key replaces the relationship's live link in the same change group, an inactive one too (R3);
    - an attribute that carries another relationship is refused: "{attribute} already carries {dimension as role}.
      Pick another key.";
    - not a foreign key of the fact: "{attribute} is not a foreign key of {fact}.";
    - a relationship that does not join a fact and a dimension: "This relationship does not join a fact and a
      dimension.";
    - nothing is written on the attribute.
  - `addKey` (R-3), one change group:
    - a new attribute of the fact, named by `keyName`, of the primary key's type and parameters, a foreign key, not
      nullable;
    - placed after the fact's last key attribute (primary or foreign); the attributes are renumbered 0..n-1, only the
      changed rows written;
    - its link; an inactive link of the relationship is deleted in the same group;
    - the working context labels the new attribute only (as `reorderAttribute`);
    - toast "Added {name}, the key of {dimension as role}.";
    - refused while the relationship has an active key ("{fact} already has a key for {dimension as role}: {key}.") or
      the dimension has no primary key ("{dimension} has no primary key yet.").
  - **The link's optimistic check.** A link is never updated, only made or deleted, so `linkKey` and `addKey` take the
    relationship's live link as the page knows it (`currentKeyId`, null for none). Any other live link is a stale
    version.
  - **`linkKey` requires a foreign key.** It writes nothing on the attribute; the prototype sets the flag when it
    links. The select offers foreign keys only, and a direct call with another attribute is refused, so the flag is
    always on already.
- **The derived reads** (`src/modules/infocube/domain/keys.ts`, `cubeIndex` built once per read):
  - **Active links only.** A link counts while its relationship and attribute are live and the attribute is a foreign
    key of the relationship's fact. An inactive link (R3) is ignored everywhere and active again with the flag.
  - `factKeys`: one row per relationship to a dimension, in the model's order, with the role at the dimension's end
    (whichever way the relationship runs), the active key and the dimension's primary key.
  - `factHints`: B-5's grain, "no dimension keys" and measure-type hints, and R-4's key hints, in the prototype's order,
    each with its target (the grain, the fact, a relationship, an attribute). `NO_HINTS` is the "Nothing to check" line.
  - `usedBy`: one row per relationship, the facts in the order they first relate. `carries`: what a foreign key
    carries.
  - `attributeDependents`: an attribute's delete preview rows. "Carries {dimension as role} – the link is deleted; the
    relationship stays" (active links only) and "1 measure – deleted".
  - `keyName`: R-3's naming rule as a function of its own.
- **C-7:** nothing new. While InfoCube is off there are no facts or dimensions, so none of these commands finds
  anything to write.

### Not done in step 3 (step 4)

- The server actions and their loaders: which rows a command reads (`KeyState` is the workspace's model and InfoCube's
  rows), and the rows a save holds on the chain.
- `ModuleView`'s new data for the panels, and the attribute's delete preview through the composition root.
- The 20 px offset.

### New and changed tests

- `src/modules/infocube/domain/keys.test.ts` (18 tests):
  - `keyName`;
  - `factKeys`: order, the role's end, an inactive link and its flag back, a deleted link;
  - every hint, with RP-03, RP-06, RP-08 and RP-12;
  - `usedBy` (RP-11) and `carries`;
  - the delete preview rows (RP-07), none for an inactive link.
- `src/modules/infocube/domain/description-and-keys.test.ts` (23 tests): grain and SCD, measures and their refusals,
  `linkKey` (RP-05; replacing an inactive link), and `addKey` (RP-04: name, type, place, renumbering, link, one change
  group; the numbered name; the inactive link; its refusals).
- `src/modules/infocube/domain/__fixtures__/star.ts`: a small star for those tests.
- `tests/infocube-keys.test.ts`:
  - Add key on the real star, through the composed undo registry: one undo removes the attribute and the link and
    restores the order (the relationship and its role stay), and a redo brings both back;
  - RP-06's flag cleared and undone, read through the index.
- `src/domain/commands/relationship.test.ts`: roles set, trimmed and cleared (RP-14), swapped with their ends, and a
  relationship to itself whose ends differ only in their roles.

### Checks (4 and 5 November 2026)

- `npm run lint` and `npm run typecheck`: clean.
- `npm test`: 137 files, 1,720 tests passed.
- One full e2e run (`npm run e2e`, from scratch, no dev server running). It was run because step 3 touches change
  groups and undo (Add key's group, the swap). Result: 565 passed, 3 skipped (the measuring and on-demand specs), no
  failures, no retries. Total 90 min 3 s:
  - part 1, fixes to slice-02c: 24 min 31 s;
  - part 2, slice-03a to slice-06b: 22 min 54 s;
  - part 3, slice-07a to slice-09: 18 min 5 s;
  - part 4, slice-10a to slice-15a: 24 min 33 s.

## Łukasz's answers to 15b step 3 (5 November 2026)

- Step 3 accepted. The differences from the prototype are accepted and recorded in the PRD's section 8: linking needs an
  existing foreign key; a measure on a foreign key is allowed with its warning; a new measure's additivity by its type;
  leaving semi-additive clears the note.

## 15b step 4: the interface (5 November 2026)

### What changed

- **Actions** (`src/modules/infocube/app/actions.ts`): `updateCubeEntityAction` (grain, SCD type), `setMeasureAction`,
  `updateMeasureAction`, `linkKeyAction`, `addKeyAction` (answers every version it wrote: the renumbered attributes).
- **What the page gets** (`ModuleView`, `src/ui/modules.ts`; built in `src/compose/view.ts`), three new fields:
  - `rowMarks`: classes on an attribute's row by attribute id (the Σ marks, `measureMarks`);
  - `attributeDeletes`: what an attribute's delete takes along, for its second click (`attributeDeletes` in the
    module's `view.ts`);
  - `data`: each module's own rows for its panel sections, without `created_*` and `updated_*` (O8, `cubePageRows`).
    InfoMapper never reads it.

  They are read only when the workspace has a dimensional entity, as 15a's roles.
- **The panels' sections, a new extension point** (`src/compose/panels.ts`, `PANEL_SECTIONS`): the entity, attribute and
  relationship panels render every module's section of their kind where the prototype has InfoCube's, and know nothing
  else of them. InfoCube's are `src/modules/infocube/app/sections.tsx`; each derives its rows in the browser from the
  model and `data` (`cubeIndex`, `factHints`, `usedBy`), once per data version.
  - **Fact** (after the definition): Grain (`TextField` with `keep`, D-66), Measures, Dimensions one row per
    relationship with "Add key" on a row without a key (disabled with its title while the dimension has no primary
    key), Hints (each opens what it names: Grain gets the cursor, a relationship or an attribute its panel).
  - **Dimension**: the SCD segment with its sentence, Used by (a row opens its fact).
  - **A fact's attribute** (after the flags): Carries (a foreign key only), Measure with Additivity, "Not additive
    across" (semi-additive only) and the type hint.
  - **A fact – dimension relationship** (after the cardinalities): "InfoCube", "Key in {fact}", Add key.
  - Every write is on the save chain: grain, SCD and additivity with their row checked; a measure turned on with its
    attribute held, turned off with the measure's row (`deletes`); a key's link with the relationship and the picked
    attribute held; Add key with the relationship and the fact's attributes held (they are renumbered).
- **Roles on every relationship** (InfoMapper's, `relationship-panel.tsx`): two `TextField`s with `keep` after the verb
  phrase, "Role of {entity}", and on a relationship to itself (R2) the cardinality fields' words. **What those say on a
  relationship to itself (D-61, slice 10a):** "At the right end" (the from end) and "At the top end" (the to end); so
  the roles are "Role at the right end" and "Role at the top end". The sentences add " as {role}" after the entity the
  role belongs to.
- **The pill and 20 px** (`line-data.ts`): `pillText` gives the line's pill the roles ("{from} / {to}", one alone), else
  the verb phrase; parallel relationships and nested loops are 20 px apart (`RELATIONSHIP_GAP`); source lines keep
  16 px (R7). The comments in `line-data.ts` and `geometry.ts` say so. Step 2's check holds: only S10A-08's loop
  (l. 144) changed, to 20.
- **The Σ marks (R5)**: the row's classes `meas add`, `meas semi`, `meas non` (`CardRow.mark`, through `buildCards`' new
  `rowMarks`), the glyph in the module's CSS as a pseudo-element; `rowNeedsClip` counts its 18 px (`ROW_MARK`). **One
  difference from R5's wording:** the glyph is `::before` on the row's type span, not `::after`. The prototype draws the
  mark just before the type, and the type is the one span of the row that is never cut (a `::after` on the name would
  go with a long name's ellipsis). Still no element.
- **An attribute's delete (R4)**: the panel's and the canvas menu's second click add InfoCube's rows through
  `attributeDeleteParts` (`fields.tsx`): "with 1 measure", and "the link to {dimension}{ as role} is deleted, the
  relationship stays". **The rows fit** (checked on the star at 1,440 × 900: the armed button wraps to two lines, as
  slice 10c's copies text does), so no screenshot was needed before building it.
- **The InfoCube box (R1)**: ticked and enabled while InfoCube is on, licence or not.
- **A fix in a shared field (found by RP-05):** `useChoice` (slice 13) kept a choice made on value A after it was stored
  as B, so an undo back to A showed B again. It now forgets a stored choice (`choiceLanded`, `src/ui/field-draft.ts`,
  unit-tested). This affected InfoMapper's own choice fields too (e.g. a stereotype changed and undone).

### New user-facing texts (for approval)

All are the prototype's unless a prototype text is given beside them.

| Where | Text | Prototype |
| --- | --- | --- |
| Relationship panel | "Role of {entity}", placeholder "e.g. Ship date" | same |
| Relationship to itself | "Role at the right end", "Role at the top end" (R2) | "Role of {name}" twice |
| Sentences | "Each {from} {verb} {phrase} {to}{ as role}.", "Each {to} belongs to {phrase} {from}{ as role}." | same |
| Relationship's section | "InfoCube", "Key in {fact}", "None", "Add key", "{dimension} has no primary key yet." | same |
| Add key's toast | "Added {name}, the key of {dimension}{ as role}." | same |
| The pill | "{from role} / {to role}", one role alone, else the verb phrase | same |
| Fact | "Fact", "Grain", placeholder "One row per … e.g. one order line" | same |
| Fact | "Measures", rows "{name}" with "{Σ mark} {Additivity}{, note}"; "None yet. Open a numeric attribute and turn on Measure." | same |
| Fact | "Dimensions", rows "{dimension}{ as role}" with "key {name}" or "no key", "Add key"; "None yet. Draw a relationship to a dimension." | same |
| Fact | "Hints", "Nothing to check: grain, keys and measures look complete.", and step 3's hint texts | same |
| Dimension | "Dimension", "Slowly changing dimension type", "0 · keep", "1 · overwrite", "2 · history" | same |
| Dimension | "Values never change once loaded.", "A change overwrites the old value; no history.", "A change adds a new version; the old one stays with its validity.", each followed by "Technical columns (valid from, valid to, current) are a physical matter and are not modelled here." | same |
| Dimension | "Used by", rows "{fact}{ as role}" with "key {name}" or "no key"; "No fact uses it yet." | same |
| A fact's attribute | "Carries", a row "{dimension}{ as role}" with "relationship"; "No dimension. Pick this key in a relationship to a dimension." | same |
| A fact's attribute | "Measure" (section and flag), "A foreign key carries a dimension's key; it is not a measure.", "Not a measure: a degenerate dimension or a descriptive value of the fact." | same |
| A fact's attribute | "Additivity", "Additive", "Semi-additive", "Non-additive"; "Not additive across", placeholder "e.g. Date (a balance)" | same |
| A fact's attribute | "Its type is {Type}. Measures are usually Integer or Decimal." | same ("not set" without a type cannot happen in the app) |
| Measure on a foreign key | toast "{attribute} is a foreign key. A dimension key is usually not a measure." (accepted in step 3) | none |
| An attribute's second click | "Click again to delete, with 1 measure"; "…; the link to {dimension}{ as role} is deleted, the relationship stays" (joined with the mappings and copies as before) | a dialog "Delete {name}?" with the rows "1 measure – deleted" and "Carries {dimension}{ as role} – the link is deleted; the relationship stays" |

The commands' refusals (step 3: "Only a fact has a grain.", "Only an attribute of a fact can be a measure.",
"{attribute} already carries {dimension}{ as role}. Pick another key.", …) reach the page only by a direct call or a
concurrent change; the panels never offer what they refuse.

### Other differences from the prototype in this step

- The sections are InfoMapper's folds ("Fact", "Dimension", "Measure", "InfoCube"), each with a box like the
  prototype's `.cubebox`; the prototype's are plain `h3` headings.
- A Σ mark has no tooltip (R5); its additivity is in the attribute's panel and the fact's Measures.

### Not in this step

- Screenshots light and dark (step 1 proposed them for step 4; step 4's go did not ask for them). They can go with
  step 5.
- `CLAUDE.md`'s list of extension points (the panels' sections, `rowMarks`, `attributeDeletes`, `data`) and the other
  docs: step 5, with D-68, the AD-34 sentence and D-61's 20 px.
- RP-09 is slice 15a's S15-14 (passes); RP-10 is 15d's; RP-13 is dropped (R6).

### Tests

- **e2e, `e2e/slice-15b/`** (one file per criterion; fixtures and helpers built on 15a's):
  - `S15-03.spec.ts` (R1): on without a licence, the box ticked and enabled with the no-licence line;
  - `S15-07.spec.ts` (hints): a new fact's two hints; the grain hint focuses Grain;
  - `S15-08.spec.ts`: grain cleared and undone; `quantity` semi-additive across "Date" (Σ~ on the row and in Measures,
    two undo steps); `order_number` as a measure with its type hint; `customer_key` as a measure with the toast; a
    reviewer read-only;
  - `S15-08b.spec.ts`: SCD 0 → 2 → 1 with the sentences and the Cube tab's "SCD n", two undos; "grain set" and "no
    grain";
  - `RP-01` (pills, 20 px), `RP-02` (Dimensions), `RP-03` (a third relationship's hints), `RP-04` (role, Add key, undo,
    redo), `RP-05` (the key select, None, undo), `RP-06` (FK cleared: the inactive link kept), `RP-07` (the second
    click, delete, undo), `RP-08` (the relationship deleted, undo), `RP-11` (Used by), `RP-12` (a primary key renamed),
    `RP-14` (a logical relationship's role, swap, undo, redo; R2 on a loop).
- **Changed earlier test:** `e2e/slice-10a/S10A-08.spec.ts` l. 144: the second loop at 20 px (was 16), and its end more
  than 19 px from the first's (was 15).
- **Unit:** `lines.test.ts` (20 px, `pillText`), `tests/infocube-star.test.ts` (the module view's marks, deletes and page
  rows; the empty view's new fields), `field-draft.test.ts` (`choiceLanded`).
- **Measurement (asked for in this step):**
  - the element guard (`S3B-15-elements.spec.ts` against `slice-08.json`): passes, viewport counts equal; page totals
    6,000 / 20,797 / 2,867 / 6,309, as since slice 11;
  - `e2e/slice-15b/S15B-layers.spec.ts` (new, measurement build only, in `playwright.config.ts`'s list): the star with
    its six Σ marks and the role pills, then with the measures deleted and the roles cleared: **10 drawing layers,
    4.2 MP and 791 viewport elements both times**. 15a's `S15-layers` on the same build: 10, 4.2 and 791 with and
    without roles.

### Checks

- `npm run lint` and `npm run typecheck` clean; `npm test` 137 files, 1,723 tests pass.
- The slice's specs (`e2e/slice-15a/`, `e2e/slice-15b/`) and the earlier specs the step touched pass.
- **One full run** (`npm run e2e`, from scratch), because the step touches shared infrastructure: the line layer (20 px)
  and `useChoice` (every choice field). 581 passed, 3 skipped, 1 failed in 96 min 38 s: part 1 27 min 21 s, part 2
  23 min 35 s, part 3 19 min 10 s, part 4 26 min 31 s. The failure was `S10A-10` l. 36: its label helper matched by
  substring, so "At the right end" also found the new "Role at the right end" (two labels). Not a flake: the helper now
  matches the whole label; `S10A-10` passed three times on its own (15 of 15). Traces and log kept in
  `test-results/kept-15b-step4/`.

## Łukasz's answers to 15b step 4 (5 November 2026)

- Step 4 accepted: every new text approved, the Σ mark as a `::before` on the type span accepted, the other differences
  accepted (recorded in the PRD's section 8). No screenshots. Step 4's full run is 15b's run before the merge unless
  step 5 changes code.

## 15b step 5: closing (5 November 2026)

### RP-09

Covered by slice 15a's `S15-14` as changed in step 2: the star has two relationships from Dim Date to Fact Sales
(Order date, Ship date), and the preview's row must read exactly "2 facts lose this dimension: Fact Orders, Fact Sales"
(either order), so a fact listed twice fails it. No new spec.

### Docs

- `CLAUDE.md`: the summary paragraph; the extension points (`ModuleView`'s `rowMarks`, `attributeDeletes`, `data`; the
  panels' sections `PANEL_SECTIONS`); InfoCube's 15b notes; slice 15b's helpers and the whole-label rule (S10A-10); the
  layers command.
- `docs/data-model-v2.md`: `relationship.from_role`, `to_role` (format 13); `cube_key`; a measure's additivity by type.
- `docs/known-limitations.md`: "What slice 15b leaves for later".
- `docs/inventory-prototype-vs-app.md`: 15b's items present, its deliberate differences.
- `README.md`: the status (15a merged, 15b on its branch), what 15b brings, the layers command.
- `docs/ideas.md`: the plan (15a and 15b done, next 15c and 15d); the open question decided by C-2.
- The PRD's section 8: the Σ mark's `::before`, the folds, R2's labels, 20 px.

No code changed in step 5, so no new full run: step 4's (581 passed; S10A-10's locator fixed, 3 of 3 on its own) is
15b's run before the merge.

### Decisions for approval (not yet in `docs/decisions.md`)

- **D-68 (new):** see the chat report; the text entered is the one Łukasz approves.
- **AD-34 (one sentence appended):** "InfoCube also reads relationship roles, which InfoMapper keeps for every
  relationship (D-68)."
- **D-61 (16 px → 20 px):** "Further loops on one card nest outside it, their ends 20 px further from the corner."

### Manual acceptance (15b's definition of done)

KB was backed up before it: `.data/backups/dev-db-20261105-0925.json` and `kb-model-latest.json` (format 12).

**On the demo** (`npm run demo -- --reset`, http://127.0.0.1:3001, the Sales star in "Retail Co – DWH"):
1. Dim Date – Fact Sales shows two lines with the pills "Order date" and "Ship date", 20 px apart.
2. A third Dim Date – Fact Sales relationship (draw it): Fact Sales' Hints name it; give it a role in its panel; "Add
   key" writes the key with its toast; one Undo takes the key back.
3. Fact Sales: Grain typed and saved; a measure's Additivity changed (the Σ mark on the row follows); a measure turned
   on and off.
4. Dim Date: the SCD type changed with its sentence; Used by lists Fact Sales twice (Order date, Ship date) and Fact
   Orders.
5. `ship_date_key` in Fact Sales: Delete, the second click names "the link to Dim Date as Ship date is deleted, the
   relationship stays"; delete; Undo brings the attribute and its link back.

**On KB** (`npm run dev`, http://localhost:3000):
1. The first page upgrades the file to format 13 (the relationships' roles, null); nothing else changes.
2. A logical relationship: a role typed shows in its sentences (" as {role}") and on the line's pill.
3. Undo takes the role back.

## Łukasz's answers to 15b step 5 (5 November 2026)

- AD-34's sentence and D-61's 20 px approved as written; D-68 approved with its hints sentence changed to the list
  `factHints` gives (there is no "fact without measures" hint). All three entered in `docs/decisions.md`. The merge
  waits for his manual acceptance.

## 15b's manual acceptance (5 November 2026)

- **Passed** (Łukasz, 5 November 2026): on the demo (`npm run demo -- --reset`) the Order date and Ship date pills; a
  third Dim Date – Fact Sales relationship with a role, Add key and undo; grain and measures in Fact Sales; SCD type and
  Used by in Dim Date; `ship_date_key` deleted with its second click, then undo. On KB (backed up first,
  `.data/backups/dev-db-20261105-0925.json`): the upgrade to format 13; a role on a logical relationship in its pill and
  sentences; undo.

## 15c step 1: dimensional mappings against the code and the prototype (5 November 2026)

### The starting point

- `main` = tag `slice-15b` = `608e283` (merge of PR 37, `ddfd96f` and `2bdeb10`); branch
  `slice/15c-dimensional-mappings` from the tag. The working tree was clean.
- The prototype is 15b's copy (role-playing version, PRD section 2); 15c needs no new copy. Its dimensional mappings:
  `S.cube.maps` (prototype l. 1398), `cubeIndex` l. 1600–1624, `createCubeMap` l. 2538, `createDimAttrFrom` l. 2547,
  `findDrop` l. 2643–2665, the lines in `renderLines` l. 2130–2143, `insCmap` l. 2340–2358, `cubeAttrSection`
  l. 2359–2369, `askDimFrom`/`createDimFrom` l. 5623–5648, `cubeDependents` l. 1426–1451, the card's bar l. 2024–2033,
  the Overview l. 2275–2278, the line menu l. 3985–3990.
- The PRD's 15c part is section 3, items 4 (dimensional mappings), 8 (Q-5), 11 ("Create dimension from this…"), 12 (the
  bar), 13, 15, 18; section 4's 15c bullet; S15-05, 09, 11, 12, 13, 14 (the mappings' rows), 18. Earlier answers that
  bind it: M1 (Q5), O4, O9, O12, E7, E11–E19, F7, F8, F15, F19, P6, P10, P17, P20, P21.

### Findings

| # | Finding | Files and functions | Proposal |
| --- | --- | --- | --- |
| C1 | **No format 13 or 14 for 15c.** The PRD's 15c bullet says "format 13"; 13 is 15b's (relationship roles). A module's tables are not part of the local file's format (AD-33, `schema.ts` l. 96): a file without `cube_mapping` simply has none of its rows yet, as `cube_key` in 15b (`db.cube_key ??= []` in `sales-star.ts`). 15c changes no InfoMapper column. | `src/data/local/schema.ts` `DEV_DB_FORMAT = 13`; `file.ts` `upgradeDb` | **No format bump**; KB is not upgraded by 15c's code (it is backed up anyway before the first run, A3). The PRD is corrected. |
| C2 | **The cascade goes from parent to child only.** `moduleCascade` (`module-cascade.ts` l. 49) soft-deletes a module row whose registered parent is deleted, to a fixed point (it already follows `cube_mapping_input` → `cube_mapping` chains, l. 30). Q-5 needs the other direction: an input deleted with its logical attribute takes its **mapping** along, whole. Nothing can express that today (the header comment, l. 7–8, leaves it to 15c). Undo's `consistent` (`undo.ts` l. 420–470) also refuses a parent deleted with live children, so the mapping's delete must take all its inputs. | `module-cascade.ts`; `run-command.ts` `withModuleCascades` l. 201; `undo.ts` `consistent` | One declarative field on a module's undo table, `goesWhole: [["cube_mapping_input", "mapping_id", "attribute_id"]]` on `cube_mapping`: "this row goes when a row of that table pointing to it goes **because its parent `attribute_id` went**". `moduleCascade` applies it in its loop; the existing parent rule then takes the other inputs. An input removed on purpose (the panel's ×) leaves the mapping. Unit tests: one input of three deleted with its attribute (all go), the panel's remove (the mapping stays), the target deleted (all go), an entity's delete, undo and redo. |
| C3 | **Nothing else needs a follow-up after a command.** Checked: D-51 belongs to the module's own content commands (as `afterContentChange` in InfoMapper's); copies (`followOriginals`) never reach a dimensional attribute (paste within one level, O6, and "Create dimension from this…" makes plain attributes, not D-63 copies, C9); changes to resolve (`withSettledChanges`, `SETTLING_TABLES`) settle only source objects; a level never changes (AD-34), so no mapping becomes invalid by an entity's edit; a logical attribute's type change only shows the panel's type warning (derived, prototype l. 2344); live canvases add cards, never module rows. | `copies.ts`, `run-command.ts` l. 214, `levels.ts` | None beyond C2. |
| C4 | **The drag starts only from a source column's row.** `useColumnDrag` (`ColumnDrag.tsx` l. 133) closes on `.card.src .row[data-row]`; `findDrop` (l. 28) returns any entity row or card; the only mark is `.drop` on the element under the mouse (l. 53–59) and `body.connecting`. Nothing dims or lights targets today. A column dropped on a dimensional attribute is lit and then refused by the server (`mappingWritesRefusal`, `levels.ts` l. 53). | `ColumnDrag.tsx`; `context.ts` `ColumnDrop` l. 281, `dropColumn` l. 324; `canvas-host.tsx` l. 257; `map-column.tsx` | A row drag from an entity row too (`.card.ent .row[data-row]`) while the canvas has a dimensional card and the person may edit the model; the drop is resolved by the module (`resolveDrop(from, target)` → create, create on the header, or a refusal text), through the host as `dropColumn` is. A column's drag keeps its code path. |
| C5 | **Dimming by restyling cards would cost what S5A-08 found** (75–140 ms per switch on the dense view for one class above every card). The prototype dims with a page-wide class (`from-attr .ent.dimn`, l. 353–364). | `fade.ts` `requestFade`, `FadeLayer` | **Dim with the fading veil:** at a drag's start, `requestFade({ lit })` with the cards that can take the drop (one SVG path in the overlay, holes at the targets, slice 4b-1), cleared at the drop or Escape; Focus or the Changes view are put back after it. No card restyles; measured in the canvas step (the drag's start to the screen on the dense canvas). The column's drag gets it too while the canvas has a dimensional card (the dimensional cards are not holes). |
| C6 | **D-48's choice does not apply.** The prototype has none for dimensional mappings: a drop onto an attribute with an identical single-input mapping selects it ("That mapping already exists. It is selected now."), any other drop makes a separate mapping (l. 2540–2546); inputs are added in the panel only. | `map-column.tsx` `confirm` l. 73; `mapping-choice.ts` `planMapColumn` | As the prototype: no choice. D-48 stays about columns. |
| C7 | **Every line structure assumes a mapping's inputs are source columns.** `MapLineData.inputs` (`line-data.ts` l. 24), `buildLines` (input cards only from `src` cards, l. 86–104), `bundleLines` keys (`r:${columnId}`, `line-geometry.ts` l. 117), the miniature (`Overview.tsx` l. 218), `lit.ts` `lookup` l. 47, `hoverRows`/`relatedLines` (`line-data.ts` l. 193–214), `deleteLine` and the Delete key (`map`/`rel` only, `ModelCanvas.tsx` l. 553). Slice 10b's `sources` is the precedent for an optional list that code which does not know it leaves out. | as listed | **A generic row-to-row line list, `CanvasLines.modules`** (absent when empty): each line `{ kind, id, inputs: [{ attributeId, cardId }], target: { attributeId, cardId }, cls, colour, endMark: "diamond", chip?: "ƒ" }`, built in the browser by the module's pure builder from the page's rows (passed to the canvas by the app, as `PANEL_SECTIONS`). `LineLayer` draws it with `mapGeom` per input (`ModulePath`: group, hit path, stroke, start dot, the diamond; ƒ on the first input, prototype l. 2140), in its own `<g>` drawn only when the list is not empty (slice 10b's rule, S10B-10). Its look is the module's CSS (`.cmap.draft`, `.cmap.review`, `--lc`). InfoMapper knows "a line between two rows with a class and an end mark", not what it means (C-4). |
| C8 | **The selection has no arm for a module's object.** `Selection` (`line-data.ts` l. 159–182) is matched in about 8 places: `inspector.tsx` l. 194–231, `SelectionHistory.tsx` `placeOf` l. 39 and `GONE` l. 22, `showPlace` (`ModelCanvas.tsx` l. 1814–1860), `focusTargetOf` (`Focus.tsx` l. 27), `CanvasModes.tsx` l. 210–232 (right-click), the click at `ModelCanvas.tsx` l. 2223, the Delete key. | as listed | F15's generic arm, `{ t: "ext"; kind: string; id: string }`, with the module's handlers registered in `src/compose/` (`exists`, `gone` text "That mapping no longer exists.", `panel`, `menu`, `delete`). A history place (D-38) selected without moving the view, as mappings are. Focus on it lights its rows' cards and the line (`focusTargetOf` → `{ t: "ext" }`, lit by the module's `lit`). |
| C9 | **"Create dimension from this…" needs a header-menu hook and a dialog.** `cardItems` (`canvas-host.tsx` l. 276–336) has no module hook; the module only adds toolbox creates (l. 394). A copy through `pasteAttribute` would make a D-63 follower across levels (F12). | `canvas-host.tsx` `cardItems`; `attribute.ts` `pasteAttribute`; `entity.ts` `freeDefaultName` | `ModuleView.cardItems` (by entity id: label and the module's action), consumed in `cardItems` before "Delete from model…" (P19); the dialog is the module's (`src/modules/infocube/app/`), opened by the host. The command wraps `createEntity` (level dimensional, the same concept), writes `{entity}_key` (Integer, PK, not nullable, "Surrogate key of the dimension.") first, plain copies of the ticked attributes (name, type and parameters, Personal data, description; not PK; nullable; no `copied_from_attribute_id`), a direct Draft mapping per copy, its `cube_entity` (dimension, SCD 1) and its card to the right (`x + width + 80`) when the entity is on the canvas: one write set, one undo step. Names within the level (`Dim {entity}`, then 2, 3…). |
| C10 | **The panels need two module places InfoMapper still draws itself.** A dimensional attribute shows InfoMapper's "Comes from" with "Add a source column" (`attribute-panel.tsx` l. 297–325, l. 313); a dimensional entity shows "Attributes and their sources" (`entity-panel.tsx` l. 155). | `attribute-panel.tsx`, `entity-panel.tsx`, `src/compose/panels.ts` | InfoMapper hides its source sections for a dimensional attribute and entity (it knows the level, AD-34); the module's sections take their place: "Comes from the logical model" (with "Add a logical attribute") and "Feeds facts and dimensions" (`PANEL_SECTIONS.attribute`), "Attributes and their logical feed" (`PANEL_SECTIONS.entity`). The mapping's own panel is the `ext` arm's `panel` (C8). |
| C11 | **Four-eyes reads the change log for InfoMapper's mappings only.** `isContentChange` (`mapping-rules.ts` l. 53, not exported) and `changeEvents.listForMapping` (`ports.ts` l. 165, `store.ts` l. 273) are fixed to `mapping`/`mapping_input`; the canvas page computes `contentAuthors` for `model.mappings` only (`page.tsx` l. 126). `checkFourEyes`, `afterContentChange` and `lastContentEditor` are generic. | as listed | `isContentChange` and `listForMapping` take the object types (`["cube_mapping", "cube_mapping_input"]`), exported; InfoMapper's callers pass theirs (no change in behaviour). The module's status command reuses `checkFourEyes`; its page rows carry each mapping's last content editor (computed in `moduleView`), so the panel's four-eyes note works as `fourEyesBlocks` does. Undo: `INFOCUBE_UNDO.cube_mapping.action` = `mapping.set_status` for a status-only event, else `model.edit` (as `actionFor`'s `mapping` case, `undo.ts` l. 281), so a reviewer undoes their own approval. |
| C12 | **The card's coverage bar and the Overview count source mappings only.** `buildCards` (`card-data.ts` l. 172–195, `mapped` l. 258/293, `rowState` "Not mapped yet" l. 236) and `coverage` (`stats.ts` l. 14) used by `overview-panel.tsx` l. 53–68: a dimensional card shows "0 of n attributes mapped". `canvasStatus` already counts logical attributes only (15a). | as listed | `ModuleView.rowFeeds` (dimensional attribute id → number of dimensional mappings, any status, prototype l. 2024) read by `buildCards` for dimensional rows (the row's state and title, the card's count) and by the Overview's coverage for dimensional entities: "{n} of {m} fed", title "Attributes fed from the logical model" (P17, F19). Status bar unchanged. |
| C13 | **Labels and requirement links cannot point to a dimensional mapping** (`LABEL_TARGET_KINDS`, `labels.ts` l. 21; `LabelLink` has five fixed columns, `types.ts` l. 577). The prototype has neither (l. 1659, l. 4666). | as listed | None, as answered in 15a (E23): no working label and no requirement link on a dimensional mapping; dimensional entities and attributes carry labels as any. A known limitation. |
| C14 | **InfoMapper's entity preview asks the module only for dimensional entities.** `moduleEntityDependents` (`src/compose/view.ts` l. 103–107) returns `[]` for a logical entity (l. 104); the attribute's second click has `ModuleView.attributeDeletes` (15b). | `compose/view.ts`; `modules/infocube/domain/view.ts` `entityDependents` l. 103, `attributeDeletes` l. 121; `fields.tsx` `attributeDeleteParts` l. 654 | X-2: the module's rows for a logical entity too (`{n} dimensional mappings` – "deleted, {k} of them approved"; `{entities}` – "lose their feed from the logical model" / "loses its feed …"), each entity once. X-3: the second click (R4) names "{n} dimensional mappings" and "{entities} lose(s) their feed from the logical model". X-4: a dimensional entity's and attribute's rows gain their mappings (`{n} dimensional mappings` – "deleted"). The delete toast counts both kinds (P10). |
| C15 | **The measuring data has no dimensional content.** "Performance test" has InfoCube off and logical entities only (`seed-large.ts` l. 79, 173); the star has 5 dimensional cards and about 20 lines. | `seed-large.ts`, `scripts/lib/many-canvases.ts` (the pattern) | A generated canvas "Performance test – star" written only into the e2e file or a bench's copy (as `addManyCanvases`): 20 facts and 30 dimensions (8 attributes each), 50 logical cards from the large model, 300 dimensional lines (60 of them transformations with ƒ and two inputs). Measured once on the branch, measurement build. See "Measurement" below. |

### The data (M1, AD-36)

- **`cube_mapping`** (InfoCube's): standard columns, `workspace_id`; `attribute_id` → the dimensional target; `kind`
  (`direct`, `transform`); `rule_expression` (text, null); `status` (`draft`, `review`, `approved`); `note` (plain
  text, null: the prototype's note is a plain field, as a source note in 7c, `setSourceNote`); `approved_by`,
  `approved_at` (as `mapping`, AD-06: every approval logged). No `review_reason` (no import sends it back).
- **`cube_mapping_input`**: standard columns, `workspace_id`; `mapping_id` → `cube_mapping`; `attribute_id` → a
  logical attribute; `sort_order`. Unique `(mapping_id, attribute_id)` among live rows.
- **The registry** (`src/compose/tables.ts`, three records, the guard test): undo parents `cube_mapping`:
  `[["attribute_id", "attribute"]]`; `cube_mapping_input`: `[["mapping_id", "cube_mapping"], ["attribute_id",
  "attribute"]]`; nouns "dimensional mapping", "dimensional mapping input"; `goesWhole` on `cube_mapping` (C2); `action`
  (C11). Rules in `INFOCUBE_RULES`: the foreign keys and the live-unique input. The domain checks what the CHECKs cannot:
  inputs logical, target dimensional, `direct` with exactly one input (AD-26).
- **A migration** `…_infocube_mappings.sql` (two tables, CHECKs on `kind` and `status`, indexes on `workspace_id`, the
  partial unique index, RLS on both). No format bump (C1).
- **The star's mappings** in `addSalesStar`: the prototype's 20 (`cubeDemo` l. 1556–1565, `cubeDemoV2` l. 1580–1599),
  every one approved except Fact Sales.net_amount (three inputs, In review), Dim Customer.city (Draft, with its note)
  and Fact Orders.line_count (Draft). Unfed: Dim Date's attributes, the two dimension keys, `ship_date_key`. Their
  rules quoted from the prototype. IC-10's figures follow (6 mappings from Order Line, 4 approved; Fact Orders and Fact
  Sales lose their feed).
- **AD-36** (Q5's text, for the closing): "Dimensional mappings are InfoCube's own tables (`cube_mapping`,
  `cube_mapping_input`), pointing to InfoMapper's attributes; InfoMapper's `mapping` stays source column(s) → attribute."
  Proposed addition: "A dimensional mapping goes whole when one of its inputs goes with its attribute (Q-5); it carries
  no working label and no requirement link."

### Q-5 and follow-ups

As C2 and C3. The undo step of a logical attribute's delete holds every mapping and input the cascade took; undo
restores them (the parents check passes: the attribute comes back in the same revert). Undo does not run the cascade
again (15a's Q7). Redo deletes them again from the step's events.

### Drag (B-6) in both directions

| From → onto | Prototype (l. 2649–2664) | App |
| --- | --- | --- |
| logical row → dimensional row | a direct Draft mapping, selected; "Mapped {E.a} to {E.b}" (". The types differ ({t1} → {t2})." when they do) | the same (module command, one undo step) |
| logical row → dimensional header | a new attribute copied from it, mapped; or mapped to the one with that name; "Added {a} to {E}, fed from {E.a}. Rename it on the right." | the same; the copy is a plain attribute (C9), last; the card's row filter goes to All when it hides it |
| dimensional row → logical row | the same mapping, logical → dimensional | the same |
| logical row → logical row | "A logical attribute maps onto a fact or a dimension. To relate two logical entities, draw a relationship." | the same |
| dimensional row → dimensional row | "A dimensional attribute is fed from the logical model. Drag a logical attribute onto it." | the same |
| dimensional row → column | "Facts and dimensions are fed from the logical model, not from source columns." | the same |
| column → dimensional row or header | "Source columns map to the logical model. Map the column to a logical attribute, then that attribute to the fact or dimension." | the same (B-6's toast is 15a's `MAPPING_TO_DIMENSIONAL_MESSAGE`); now also refused in the browser, before the server |
| logical row → column | an ordinary source mapping | **not added**: a logical row's drag onto a column is not in B-6 and today's mapping starts from a column only. Question X1 |
| identical mapping exists | "That mapping already exists. It is selected now." | the same |
| while InfoCube is off | `CUBE_OFF` | cannot happen in the app: off means no dimensional entity (C-7 as changed) |

Dimming (C5): from a logical row, the dimensional cards are the holes; from a dimensional row, the logical cards; from a
column, every card but the dimensional ones. The row under the mouse keeps `.drop`. A drag starts only for people who
may edit the model, not in an archived workspace, above 40 % zoom (as the column's, `lod`).

### The line kind (C7)

- **Drawn:** one path per input from the logical row to the dimensional row (`mapGeom`), stroke in the target's concept
  colour (`--lc`, prototype fallback `#889`), a start dot, a diamond at the target; Draft `6 4`, In review `10 3 2 3`,
  Approved solid; ƒ on the first input's path for a transformation. In the mappings layer (Everything, Mappings), not
  in Relationships.
- **Hover:** a row lights its dimensional lines both ways (`hoverRows`, prototype l. 1874); a line's hover lights its rows
  and cards (`relatedLines`).
- **Overlay and Focus:** lit lines under Focus and the Changes view when both cards are lit (`litSources`' rule);
  selecting a mapping thickens it, as the prototype (l. 2066: a selected dimensional mapping fades nothing).
- **Collapsed frames (D-07):** a line with a card in a collapsed frame is **not drawn, not bundled, not counted**, as the
  prototype (l. 2136) and slice 10b's source lines. A collapsed card or a hidden row: the end at the header's middle, as
  mappings.
- **The miniature:** left out, as the prototype (l. 5817) and source lines.
- **Delete, menu:** the Delete key and the line's menu (status items for those who may set it, "Edit transformation
  rule…", "Delete mapping"), the menu's header "{inputs} → {target}"; no "Link to a requirement…" (C13).
- **AD-24:** no layer per line (the line layer's SVG), no element when the canvas has none; 5 elements per input as a
  mapping's, +3 with ƒ (15a's Q11).

### Measurement (S15-18)

| What | How | Bar (proposal) |
| --- | --- | --- |
| Viewport elements | the element guard on "Performance test" against `slice-08.json` | equal viewport counts (no dimensional content there) |
| Drawing layers | LayerTree on "Performance test – star" with and without its 300 dimensional lines; on the Sales star | the lines add no drawing layer |
| Elements of the kind | the same read | 5 per input, +3 per ƒ, +1 group; nothing else |
| Pans | presented frames (slice 4b-1's method) on "Performance test – star": 300 dimensional lines against the same canvas with 300 relationships between the same cards (S10A-12's and S10B-10's pattern) | within the sitting's run-to-run spread of the relationships' variant |
| A drag's start and dimming | the start to the screen on the dense canvas, phase trace (script, style with its element count, layout, paint) | style recalculates no card (the veil, C5); under 50 ms to the screen |
| Hover of a row with lines | to the screen, as C-10 | within the spread of a mapped row's hover on "100 cards" |

### The mapping panel

- **Sections as the prototype (`insCmap`):** "Dimensional mapping" with the InfoCube badge; the trace (input pills,
  target pill); the type warning for a direct copy whose types differ; "Reads from the logical model" (one row per
  input, × "Stop reading this attribute" with more than one); "Add a logical attribute" (logical attributes only; "It
  already reads that attribute."; the second input makes it a transformation, "It reads {E.a} too, so it is a
  transformation now. Describe the rule."); "Target attribute" (dimensional only; "Re-pointed to {E.a}"); "How the
  value is carried" (Direct copy / Transformation; "A direct copy reads one attribute. Remove the others first.");
  "Transformation rule"; "Status"; "Note"; "Delete mapping".
- **Reviewers and four-eyes (O9):** reviewers set the status (`mapping.set_status`), nothing else; with four-eyes on the
  last content editor cannot approve (`checkFourEyes`, the panel's note as `fourEyesBlocks`); `approved_by` and
  `approved_at` set and cleared.
- **D-51's first rule (O12):** a change of inputs, kind, rule or target on an approved mapping sends it to In review and
  clears the approval (`afterContentChange`); a note alone keeps the status. The target is content too (proposal: the
  prototype has no D-51; a re-pointed approved mapping reads differently).
- **Fields on the chain (slice 13):** rule and note are `TextField`/`TextArea` with `keep`; kind, status and target are
  `useChoice`; inputs and every write `saveRow` on the mapping's row (its inputs held while they are written).
- **History places (D-38):** C8. **Working labels:** none (C13).

### "Create dimension from this…" and "Feeds facts and dimensions"

- The menu item in a logical card's header menu, before "Delete from model…", for those who may edit the model while
  InfoCube is on (P19). The dialog as the prototype (`askDimFrom`): "{concept} · InfoCube", "Create a dimension from
  {entity}", "The dimension gets a surrogate key and a copy of each ticked attribute, mapped from the original (direct,
  Draft). Nothing changes in {entity}.", Name ("Dim {entity}", numbered), every attribute ticked with "{type} · PK",
  Cancel, Create dimension. The command as C9; the toast "Created {name} with {n} attributes fed from {entity}, plus its
  key {key}." The new card is
  selected and centred, as the prototype.
- "Feeds facts and dimensions" (a logical attribute that feeds something): one row per mapping, its status dot, the
  target "E.a", "ƒ " and the status; a click selects the mapping. "Comes from the logical model" (a dimensional
  attribute): the same rows with the inputs, or "Not fed yet. Drag a logical attribute onto this row, or pick one
  below.", then "Add a logical attribute".

### Coverage (P17)

C12: the bar counts dimensional attributes with any dimensional mapping (prototype: any status), "{n} of {m}
attributes fed from the logical model"; the Overview's "Mapping coverage" row "{n} of {m} fed". A dimensional card's
row filter "Mapped"/"Not mapped" reads the same feeds (the prototype reads source mappings only, so "Mapped" shows no
row on a dimensional card: question X4).

### What stays for 15d

X-5 (requirement links to dimensional entities and attributes, scope through dimensional mappings to the logical
attributes and their sources, coverage through approved feeds, the lens), the bus matrix (B-8) with RP-10's dots,
REQ-210 in the star, S15-15, S15-16, and the requirement index's bench with feeds. 15c's lens stays logical, as 15a's
Q14 said: a requirement's scope does not yet follow a dimensional mapping.

### Proposed steps

1. **Step 1** (this): the review. No application code.
2. **Step 2 – data:** `cube_mapping`, `cube_mapping_input` (types, registry with parents, nouns, `goesWhole`, `action`,
   rules, migration, schema check); `goesWhole` in `moduleCascade` with unit tests; `isContentChange` and
   `listForMapping` by object type; the star's 20 mappings; KB backed up. **A full run** (the table registry, the
   cascade, the change log's port).
3. **Step 3 – domain:** the module's commands (create by drag and on a header, inputs, target, kind, rule, note, status
   with four-eyes and D-51, delete, create dimension from an entity) and refusals; the derived rows (feeds, row feeds,
   the previews' rows X-2 to X-4, the lines' builder); domain tests. A full run only if it changes shared code beyond
   step 2's.
4. **Step 4 – canvas:** the line kind, hover, Focus, collapsed frames, the `ext` selection with its history place,
   Delete and menu; the drag from entity rows, the veil, the refusals; the card's fed bar and row states. **A full run**
   (the canvas's layers, the line layer, the drag). The measurement (S15-18).
5. **Step 5 – panels and dialogs:** the mapping panel, the attribute and entity sections, the Overview's coverage,
   "Create dimension from this…", the previews (X-2 to X-4) and the delete toast; every new text listed for approval.
6. **Step 6 – closing:** AD-36, D-69, the docs (CLAUDE.md's extension points: `CanvasLines.modules`, the `ext`
   selection, `ModuleView.cardItems` and `rowFeeds`, `goesWhole`), one full run, manual acceptance on the demo and KB.

### Proposed criteria

| ID | Criterion | Test |
| --- | --- | --- |
| S15-05 | The Sales star: dimensional lines from logical rows to dimensional rows, their colours, dashes, diamonds and ƒ; Σ and ∅Σ marks | e2e |
| S15-09 | Product.list_price onto Dim Product's header: a new attribute and a Draft line, one undo removes both; a column onto a dimensional attribute and Dim Product.sku onto Dim Customer.city refused with their toasts; the reverse direction maps | e2e |
| S15-11 | Create dimension from Product with two attributes unticked: Dim Product 2, `product_key` first, the copies, a Draft direct mapping per copy, the card to the right; one undo | e2e |
| S15-12 | Order Line's preview: "6 dimensional mappings – deleted, 4 of them approved", "Fact Orders, Fact Sales – lose their feed from the logical model"; undo | e2e |
| S15-13 | Customer.segment_code's second click names its dimensional mapping and Dim Customer's feed; after the delete Dim Customer.segment_code stays, unfed; an attribute that feeds nothing deletes as before; Q-5 with net_amount's three inputs | e2e + unit |
| S15-14 | Dim Date's and Dim Customer's previews with their mappings' rows | e2e (S15-14 as changed) |
| S15-18 | The measurement above | measurement |
| S15-20 | The mapping panel: inputs added and removed, the kind, rule and note, the target re-pointed; each one undo step; D-51's first rule on an approved mapping; the note alone keeps it | e2e + unit |
| S15-21 | A reviewer approves; with four-eyes the last editor cannot, another person can; a reviewer edits nothing else | e2e + unit |
| S15-22 | The line: hover both ways, Focus lights it, a collapsed frame leaves it out, the miniature leaves it out, Delete and undo, the line menu's items, Back and Forward to a selected mapping, "That mapping no longer exists." | e2e |
| S15-23 | Coverage: the fed bar on Dim Customer, the Overview's "{n} of {m} fed", after a mapping's delete and undo | e2e |

Changed earlier specs: none expected (no dimensional content in earlier specs' data); `S15-14` gains its mappings' rows;
`S15-05`'s 15a part (marks) is extended.

### Differences from the prototype expected in 15c

1. Reviewers approve with four-eyes; D-51's first rule (O9, O12; the PRD's section 8).
2. Q-5 by the command (the cascade, one undo step), not by indexing (P7).
3. Dimming with the fading veil, not a page-wide class (C5, P12).
4. An approval is logged (`approved_by`, `approved_at`); the prototype keeps only the status.
5. The note is plain text (as the prototype's field; InfoMapper's mappings' note is rich text).
6. "Edit transformation rule…" says "It is a transformation now. Describe the rule." (P20).
7. The attribute's delete names dimensional mappings on its second click, no dialog (R4, X-3); the toast counts both
   kinds (P10).
8. The target is content for D-51 (proposal, X5); re-pointing onto a target that already has the identical mapping is
   refused with "That mapping already exists." (the prototype re-points without a check).
9. No "Map from a column…" in a dimensional row's menu (the prototype offers it and focuses a field that is not there,
   l. 4041); no "Add a source column" in a dimensional attribute's panel.
10. A dimensional card's "Mapped" filter reads its feeds (question X4).
11. "Create dimension from this…" makes plain attributes, not D-63 copies (C9; the prototype has no copies).

### Questions for Łukasz

- **X1.** A logical row dragged onto a source column: the prototype makes an ordinary source mapping (a column → attribute
  mapping started from the attribute). The app's mapping drag starts only from a column. Add it in 15c (it is
  InfoMapper's behaviour, not InfoCube's), or leave it out (recommended: out, as an idea)?
- **X2.** Q-5 (C2): a mapping goes whole only when one of its inputs goes **with its attribute**; removing an input in
  the panel keeps the mapping. Agreed?
- **X3.** Dimming with the veil (C5), also for a column's drag on a canvas with dimensional cards. Agreed, or the
  prototype's dimmed bodies (a class on the cards, measured first)?
- **X4.** A dimensional card's "Mapped"/"Not mapped" filter counts dimensional mappings (recommended), or source mappings
  as the prototype (so "Mapped" shows no row on a dimensional card)?
- **X5.** Re-pointing the target counts as content for D-51 (recommended), and re-pointing onto an identical mapping is
  refused?
- **X6.** Collapsed frames: dimensional lines not drawn and not bundled, as the prototype and source lines (recommended),
  or bundled as D-07 bundles mappings?
- **X7.** The dense canvas "Performance test – star" and the bars above.
- **X8.** The new criteria S15-20 to S15-23 and the six steps.
- **X9.** AD-36 with the proposed sentence on Q-5, labels and requirement links.

## Łukasz's answers to 15c step 1 (5 November 2026)

The recommendations are accepted, with these details:

- **X1:** out of 15c; a logical row dragged onto a source column is an InfoMapper idea (`docs/ideas.md`).
- **X2:** yes. The × is not offered on a mapping's last input ("Delete mapping" does that). **A second input on a direct
  mapping** switches it to a transformation, as the prototype does (l. 2980: `if (m.from.length > 1) m.kind =
  "transform"`), with "It reads {E.a} too, so it is a transformation now. Describe the rule." and the cursor in the
  rule; the prototype shows the × only with more than one input (l. 2350), so the app matches it.
- **X3:** the veil, also for a column's drag on a canvas with dimensional cards.
- **X4, X5, X6:** yes.
- **X7:** yes, with these bars: the pans on "Performance test – star" within the sitting's run-to-run spread of the same
  cards joined by 300 relationships; the veil at a drag's start at a **median under 16 ms**.
- **X8:** yes. In addition, the domain step changes the change-log function behind four-eyes (`isContentChange`,
  `listForMapping`), which InfoMapper's own approvals use, so **step 3 gets a full e2e run too**; the function moves
  from step 2 to step 3.
- **X9:** yes (AD-36's added sentence, quoted at the closing).
- The 11 expected differences from the prototype are accepted.

## 15c step 2: the data (5 November 2026)

### What changed

- **`cube_mapping` and `cube_mapping_input`** (M1; `src/modules/infocube/domain/types.ts`): a mapping's target
  (`attribute_id`), `kind` (`direct`, `transform`), `rule_expression`, `status` (`draft`, `review`, `approved`), a
  plain-text `note`, `approved_by` and `approved_at`; an input's `mapping_id`, logical `attribute_id` and `sort_order`.
- **The registry** (`src/modules/infocube/domain/tables.ts`, `data/tables.ts`; joined in `src/compose/tables.ts` as
  15a's and 15b's tables):
  - undo parents: a mapping's target; an input's mapping and logical attribute; nouns "dimensional mapping" and
    "dimensional mapping input";
  - `action`: a status-only change needs `mapping.set_status` (reviewers, O9), as on InfoMapper's mappings
    (`statusOnlyEvent`, exported from `undo.ts`), anything else `model.edit`;
  - the local rules: the foreign keys, `cube_mapping_kind_ck`, `cube_mapping_status_ck`, `cube_mapping_approval_ck`
    (approved exactly when `approved_at` is set, as `mapping_approval_ck`), one live input per attribute and mapping.
    No rule check: the prototype's second input makes a transformation with an empty rule and asks for it (X2).
- **Q-5 (X2): `goesWhole`**, a new optional field of a module's undo table (`ModuleUndoTable`, `undo.ts`), applied by
  `moduleCascade` (`module-cascade.ts`). `cube_mapping` registers `[["cube_mapping_input", "mapping_id",
  "attribute_id"]]`: a mapping goes when the cascade deletes one of its inputs **because the input's attribute went**;
  its other inputs then go by `parents`. An input removed on purpose leaves its mapping. Undo does not run the cascade
  again (15a's Q7); the step's events hold every row.
- **The migration** `20261105110000_infocube_mappings.sql`: both tables, the three CHECKs, indexes on `workspace_id`
  and the attributes, the partial unique index on `(mapping_id, attribute_id)`, RLS on both.
- **No format bump** (C1): a module's tables are not part of the local file's format; KB's file is unchanged by this
  step (backed up first: `.data/backups/dev-db-20261105-1030.json`, format 13).
- **The star's 20 mappings** (`sales-star.ts`, `MAPPINGS`): the prototype's `cubeDemo` and `cubeDemoV2`, with their
  rules and Dim Customer.city's note; approved ones with `approved_by` (Anna, the star's author) and `approved_at`.
- `isContentChange` and `listForMapping` are **not** changed in this step: they move to step 3 (X8).

### Tests

- `module-cascade.test.ts`: four new cases for `goesWhole` (one input of three with its attribute, an input removed on
  purpose, the target, two inputs at once).
- `tests/infocube-mappings.test.ts` (new), through the composition root's registry: the star's 20 mappings (statuses,
  kinds, inputs, approvals, IC-10's figures, the unfed attributes, every input logical and every target dimensional);
  Order Line.quantity's delete takes its direct mapping and net_amount's three-input mapping whole, one change group,
  undo and redo; Dim Customer.city's delete takes its mapping; Order Line's delete takes six; an input removed on
  purpose leaves its mapping; the star's file read at the current format with no violation, a second live input and an
  approval without its date refused.
- `tests/table-registry.test.ts` and `tests/schema/compare-schema.test.ts`: the two tables in their lists; an empty
  registry has no `goesWhole`.

### Checks

- `npm run lint` and `npm run typecheck`: clean. `npm test`: 138 files, 1,733 tests (+10: four `goesWhole` tests in
  `module-cascade.test.ts`, six in `tests/infocube-mappings.test.ts`).
- Full e2e run in four parts, from scratch, on 02964c1 (the step touches shared infrastructure: the table registry, the
  module cascade and undo's module registration): 582 passed, 3 skipped, 0 failed, 1 h 34 min (10:39 to 12:13).
  Parts: 21 min 50 s (111 passed), 24 min 7 s (135 passed), 19 min 8 s (140 passed, 1 skipped), 28 min 31 s (196
  passed, 2 skipped).
- KB backed up before the step (`.data/backups/dev-db-20261105-1030.json`, `kb-model-latest.json`, format 13); the
  local file's format is unchanged (module tables are not part of it).

## 15c step 3: the domain (5 November 2026)

### What changed

- **Four-eyes reads any kind of mapping's change log** (C11, X8):
  - `MappingLog` (`src/domain/model/mapping-rules.ts`) names a mapping's table, its inputs' table and the columns whose
    change is content.
  - `MAPPING_LOG` is InfoMapper's (`mapping`, `mapping_input`; kind and rule). It is the default of
    `lastContentEditor`, `isContentChange` (now exported) and `changeEvents.listForMapping` (`src/data/ports.ts`,
    `src/data/local/store.ts`), so InfoMapper's callers are unchanged.
  - InfoCube's is `CUBE_MAPPING_LOG` (`cube_mapping`, `cube_mapping_input`; kind, rule and the target, X5).
- **InfoCube's mapping commands** (`src/modules/infocube/domain/mappings.ts`). Each is one change group and one undo
  step, under `model.edit` (InfoMapper's rights and the archive) unless said otherwise:
  - `createCubeMapping`: a logical attribute onto a dimensional one, as a direct Draft mapping with one input. Toast:
    "Mapped {E.a} to {E.b}", with ". The types differ ({t1} → {t2})." when the types differ.
  - `createOnHeader`: a logical attribute onto a fact's or dimension's header.
    - It makes a plain copy, placed last: the name, the type and its parameters, Personal data and the definition; no
      key, nullable, no `copied_from_attribute_id`. The mapping is made with it.
    - The card it was dropped on opens, and its row filter goes to All unless it is already All or Mapped (the
      prototype).
    - When the entity already has an attribute of that name (case ignored), the drop maps onto that attribute instead.
    - Toast: "Added {a} to {E}, fed from {E.a}. Rename it on the right." The working context labels the new attribute.
  - `addCubeMappingInput`: adds the attribute as the last input.
    - **A second input on a direct copy makes it a transformation (X2).**
    - Toast: "It reads {E.a} too, so it is a transformation now. Describe the rule." (otherwise "It reads {E.a} too.").
    - It returns `becameTransform`, so the panel can put the cursor in the rule.
  - `removeCubeMappingInput`: refused on the last input; a transformation stays one.
  - `updateCubeMapping`: the kind, the rule (trimmed) and the note (plain text, trimmed).
    - Direct with more than one input is refused.
    - A transformation may have no rule yet, as in the prototype; the store has no rule check (step 2).
  - `retargetCubeMapping`: another dimensional attribute as the target; toast "Re-pointed to {E.a}". Re-pointing onto
    the identical mapping (the same inputs in the same order) is refused: "That mapping already exists." (difference 8).
  - `setCubeMappingStatus`: runs under `mapping.set_status`, so reviewers may set it (O9).
    - With four-eyes on, the last content editor cannot approve (`checkFourEyes`: "Four-eyes is on: someone else has to
      approve your change.").
    - Approving records `approved_by` and `approved_at`; leaving Approved clears both.
  - `deleteCubeMapping`: the mapping and its inputs.
  - **D-51's first rule (O12)** (`cubeAfterContentChange`):
    - a change of inputs (added or removed), kind, rule or target sends an approved mapping to In review and clears its
      approval, with InfoMapper's notice "This mapping was approved; your change sends it back to review.";
    - a note alone keeps the approval;
    - undo brings the approval back with who and when.
- **The refusals, with the prototype's texts:**
  - a dimensional input: "A dimensional attribute is fed from the logical model. Drag a logical attribute onto it.";
  - a logical target: "A logical attribute maps onto a fact or a dimension. To relate two logical entities, draw a
    relationship.";
  - the identical mapping on a create: "That mapping already exists. It is selected now." (`conflict`; the page selects
    the existing one);
  - a duplicate input: "It already reads that attribute.";
  - direct with more than one input: "A direct copy reads one attribute. Remove the others first.";
  - a source column onto a dimensional attribute: unchanged, 15a's `MAPPING_TO_DIMENSIONAL_MESSAGE`.
- **The drop's plan** (`planDrop`, the prototype's `findDrop`, step 1's drag table): a drag from either end gives one of
  these, and the canvas uses it in step 4:
  - a mapping, always logical → dimensional;
  - a copy on a header;
  - the existing mapping (`exists`);
  - a refusal's toast;
  - nothing: a logical row on a column (X1), a logical row on a logical header, a dimensional row on a header.
- **"Create dimension from this…"** (`createDimensionFrom`, B-2), one change group:
  - the entity at the dimensional level in the original's concept, with InfoCube's row (dimension, SCD type 1), made
    through `createCubeEntity`, which now takes the default name's base;
  - its name: the dialog's, or "Dim {entity}", numbered within the level ("Dim Product 2");
  - its definition: "From {entity}:" followed by the original's, when the original has one (the prototype);
  - `{entity}_key` first: Integer, primary key, not nullable, "Surrogate key of the dimension.";
  - a plain copy of each ticked attribute in the original's order, each with a direct Draft mapping from its original;
  - its card at the original card's height, 80 px to the right of it, when the original is on the dialog's canvas;
  - toast: "Created {name} with {n} attributes fed from {entity}, plus its key {key}."; a typed name that is already
    taken gets InfoMapper's duplicate-name warning.
- **The derived reads** (`mappingIndex`, built once per read):
  - `feedsOf` ("Feeds facts and dimensions") and `fedFrom` ("Comes from the logical model", with the inputs joined by
    " + ");
  - `rowFeeds`: each dimensional attribute with at least one dimensional mapping, of any status, and how many. In
    step 4 the card's bar, its row states and the Mapped / Not mapped filter (X4) read it;
  - `fedCount`: the Overview's "{n} of {m} fed";
  - `mappingDependents` (X-2, X-4):
    - "{n} dimensional mappings – deleted, {k} of them approved";
    - for a logical entity or attribute also "{facts and dimensions} – lose their feed from the logical model" ("loses
      its feed …" for one), the names sorted;
    - `entityDependents` now takes these rows for both levels; before, a logical entity's preview had no InfoCube rows;
  - `mappingAttributeDeletes` (X-3): the second click's "{n} dimensional mappings" and "{E} loses its feed from the
    logical model", joined to 15b's measure and key link in `attributeDeletes`;
  - `entityDependents` and `attributeDeletes` take the index as a new last argument. `src/compose/view.ts` passes it in
    step 5, so nothing shows in the app yet.

### Not done in step 3

- Step 4: the lines' builder (it needs the canvas's card ends and collapsed frames), the `ext` selection and the drag.
- Step 5:
  - the server actions with their loaders, and the rows a save holds on the chain;
  - `ModuleView`'s mapping rows;
  - `rowFeeds` and the previews through the composition root;
  - the panels and the dialog.

### New texts (for approval in step 5, with the panel)

- "A mapping reads at least one attribute. Delete the mapping instead." (removing the last input; the panel offers no ×
  there).
- "A dimension is created from a logical entity." (a guard: the menu item is on logical cards only).

### Tests

`tests/infocube-mapping-commands.test.ts` (19 tests) runs on the Sales star through the composed undo registry:

- **Create:** the rows, and the toast with and without the types. The refusals: a dimensional input, a logical target,
  the identical mapping, a reviewer, the archive.
- **`planDrop`:**
  - in both directions;
  - onto a header, new and same-named;
  - the existing mapping;
  - each refusal;
  - the drops that do nothing.
- **A header drop:** the copy and its place, the card opened, one change group, one undo removes both.
- **The panel's edits:**
  - inputs: X2, the duplicate, a dimensional input, a stale version;
  - the last input;
  - kind, rule and note;
  - re-pointing: a logical target, the identical mapping;
  - delete with undo.
- **D-51:** each kind of content change sends the mapping back to review, the note does not. Its undo restores who and
  when; redo sends it back again.
- **Status:**
  - a reviewer sets the status and nothing else, and may undo their own approval;
  - four-eyes through the change log with `CUBE_MAPPING_LOG`: a note is no content, InfoMapper's log reads none of
    InfoCube's events, and a re-point and an added input count as content.
- **Create dimension from Product:**
  - Dim Product 2 with `product_key`, the copies, the mappings and the card to the right, nothing changed in Product;
  - a typed name;
  - no card without a placement;
  - a dimensional entity refused;
  - undo and redo.
- **The derived reads:**
  - feeds both ways;
  - the cards' feeds: 20 fed attributes, Dim Customer 4 of 5;
  - S15-12's figures: 6 dimensional mappings, 4 approved; "Fact Orders, Fact Sales – lose their feed from the logical
    model";
  - Country's one mapping;
  - Dim Customer's preview with its 4 mappings, and Dim Date's without any;
  - the second clicks of Customer.segment_code, Order Line.quantity and a fact's measure.

### Checks

- `npm run lint` and `npm run typecheck`: clean.
- `npm test`: 139 files and 1,752 tests passed. Before the step it was 1,733; the new file adds 19.
- The step changes the change-log read that four-eyes uses (X8), and it changes change groups and undo, so it got a full e2e run (`npm run e2e`, from scratch, no dev server running):
  - **582 passed, 3 skipped, 0 failed**, in 1 h 38 min (12:48:57 to 14:26:25);
  - part 1 took 25:02, part 2 24:12, part 3 19:32 and part 4 28:38.

## Łukasz's answers to 15c step 3 (5 November 2026)

Step 3 accepted; both new texts approved ("A mapping reads at least one attribute. Delete the mapping instead.", "A
dimension is created from a logical entity."). For step 5: the Create dimension dialog proposes a numbered name when
"Dim {entity}" is taken, and warns on a duplicate, as the prototype does. **Test regime for step 4:** e2e specs for the
canvas criteria; no full run in step 4 (the slice's specs and every earlier spec folder that touches the canvas, named
below); the full run comes once, at the end of step 5, and counts as 15c's run before the merge if step 6 changes docs
only. The PRD's step list says so (section 4); step 1's "Proposed steps" above gave step 4 a full run.

## 15c step 4: the canvas (5 November 2026)

### What changed

- **A module's lines in InfoMapper's line layer** (C7): `CanvasLines.modules` (`ModuleLineData` in
  `src/canvas/line-data.ts`): a line from one or more entity rows to another entity row, with the module's kind, classes,
  colour, end mark and chip. InfoMapper draws it and knows nothing of its meaning:
  - `moduleGeom` (`line-geometry.ts`): one curve per input, row to row (a collapsed card or a hidden row at the header's
    middle, `part`), the chip on the first curve;
  - `ModulePath` (`LineLayer.tsx`): a group per line with `--lc`; per input a hit target, the stroke, a start dot and a
    diamond (one path); the chip's three elements. The dots and diamonds are left out below 40 %, as a mapping's dots.
    Their own `<g>`, drawn only when the canvas has one (slice 10b's rule);
  - the layers (D-22): Relationships hides them, Mappings keeps them;
  - collapsed frames (X6): a line with any card in a collapsed frame is left out, not bundled, not counted
    (`bundleLines`);
  - the miniature draws none (it reads mappings and relationships only).
- **InfoCube's lines** (`src/modules/infocube/canvas/lines.ts`, `cubeLines`): every dimensional mapping whose target's
  card and at least one input's card are on the canvas; classes `cmap draft|review|approved`, the target's concept
  colour (InfoMapper's `NO_CONCEPT_COLOR` without one), the diamond, ƒ for a transformation. Their CSS is InfoCube's
  (`infocube.css`: Draft `6 4`, In review `10 3 2 3`, Approved solid). The page builds them on the server next to
  InfoMapper's (`moduleLines` in `src/compose/view.ts`, from `ModuleView.data`, which now carries the mapping rows).
- **Hover and selection** (C7, C8): a row lights its dimensional lines both ways and the rows at their ends; a line's
  hover lights its rows (`relatedLines`, `hoverRows`, `HoverLines`). A row's selection emphasises them as it does a
  mapping's. A selected dimensional line is thicker and fades nothing (prototype l. 2066).
- **The `ext` selection** (F15, C8): `{ t: "ext"; kind; id }`.
  - The click on a line selects it.
  - The right-click opens its menu (`ToolboxTarget` `ext`), and the Delete key deletes it.
  - The details panel shows the module's panel (`CANVAS_EXTENSIONS` in `src/compose/canvas.ts`). Step 4's panel is its
    kind, the InfoCube badge and its trace ("Order Line.quantity + … → Fact Sales.net_amount"); step 5 adds its fields.
  - It is a history place (D-38): `placeOf` takes it as it is. `showPlace` asks the module whether it still exists
    (`host.extGone`), and `SelectionHistory` shows the module's text ("That mapping no longer exists.").
- **Focus** (C8): Focus on a selected line lights its cards (`FocusTarget` `ext`). A dimensional line is lit when every
  card it touches is lit (`litModules`, as `litSources`): under Focus, in the Changes view and in the veil.
- **The extension point** (`src/canvas/extensions.ts`, `CanvasExtension`): a module registers a kind with a hook
  (`gone`, `menu`, `remove`, `rowDrag`, `drop`) and its panel. The canvas host (`canvas-host.tsx`) calls the hooks in
  the registry's fixed order. The host's new handlers are `rowDrag`, `dropRow`, `deleteExt` and `extGone`.
- **The drag** (B-6, C4, C5, X3; `ColumnDrag.tsx`):
  - A drag now starts from an entity's attribute row too, when the page allows it (`host.rowDrag`).
  - InfoCube allows it from a logical row while a fact or a dimension is on the canvas, and from a dimensional row
    always.
  - Each target under the mouse (an attribute row, a card's header, a column's row) is planned by the module
    (`planDrop`). Only a target that maps gets `.drop`; a refusal is its toast on the release.
  - The drop:
    - a mapping onto a row: `createCubeMappingAction`, then the new line is selected;
    - onto a header: `createOnHeaderAction` on the card's queue (`ui.withCard`, new: it sends the card's version and
      takes the answer's), then the new attribute is selected;
    - onto the existing mapping: it is selected, with "That mapping already exists. It is selected now.".
  - **The veil**: from the drag's start, `requestFade({ lit })` keeps the cards that can take it lit (from a logical
    row the facts and dimensions, from a dimensional row the logical cards). The fading asked for before comes back
    after it (Focus, the Changes view).
  - **A column's drag** keeps InfoMapper's path. On a canvas with facts or dimensions the veil keeps every other card
    lit, and a drop on a dimensional row or header is refused in the browser with B-6's toast (15a's text).
- **Server actions** (InfoCube's `app/actions.ts`; the drag and the menu need them in this step):
  `createCubeMappingAction`, `createOnHeaderAction`, `setCubeMappingStatusAction` (four-eyes from InfoCube's change
  log), `updateCubeMappingAction`, `deleteCubeMappingAction`. The delete and the status are on the save chain with the
  mapping's row checked (`saveRow`). The delete's undo step is named "Delete dimensional mapping" (the first row it
  writes is an input).
- **The line's menu** (prototype l. 3985–3990):
  - its head "{inputs} → {target}";
  - Draft, In review and Approved for those who may set the status (reviewers too, O9);
  - "Edit transformation rule…": a direct mapping becomes a transformation, with the toast "It is a transformation now.
    Describe the rule." (P20). The details panel opens; the cursor goes into the rule in step 5;
  - "Delete mapping" (Del).
- **A dimensional row's menu** has no "Map from a column…" (difference 9).
- **The cards' feeds** (C12, P17, X4):
  - `ModuleView.rowFeeds` gives every dimensional attribute's count and tooltip ("from Customer.segment_code",
    "Not fed from the logical model"). `buildCards` reads it in place of source mappings for those rows.
  - The card's bar says "{n} of {m} attributes fed from the logical model" (`EntityRole.coverage`).
  - Mapped and Not mapped on a dimensional card read the feeds.

### Differences from the prototype in this step (for your decision)

1. **No tooltip on a dimensional line.** The prototype has a `<title>` "{E.a} → {E.b} (dimensional mapping)" on each
   input's group. It would be one more element per line (AD-24). InfoMapper's mapping lines have none either. The menu's
   head and the panel name the mapping.
2. **Focus on a selected line** lights its two cards and every dimensional line between them (the "both cards lit"
   rule, as source lines). The prototype lights that one mapping. On the star: Customer.customer_number's and
   segment_code's lines when segment_code's is focused.
3. **A header drop's undo step** is named by its first row: "Undone: Create attribute" (the prototype has no step
   names).

### Not done in step 4

- Step 5: the mapping panel's fields, the rule's cursor after "Edit transformation rule…", the Overview's "{n} of {m}
  fed", the delete previews (X-2 to X-4) and the delete toast, "Create dimension from this…".
- **A finding for step 5:** a home's thumbnail draws a dimensional card under Mapped or Not mapped with InfoMapper's
  source mappings (`thumbnailIndex` counts them), so its height can differ from the canvas's. The thumbnails get the
  feeds with the homes' other module reads in step 5.

### New user-facing texts

- "Delete dimensional mapping": the undo step's name ("Undone: Delete dimensional mapping").
- Every other text is the prototype's or already approved: the menu's items and head, "Mapping deleted", "That mapping
  no longer exists.", "Not fed from the logical model", "from {inputs}", "{n} of {m} attributes fed from the logical
  model", "Dimensional mapping" with "InfoCube", "It is a transformation now. Describe the rule." (P20), and B-6's
  toast for a column (15a).

### Measurement (S15-18, X7; measurement build)

- **"Performance test – star"** (`scripts/lib/star-canvas.ts`, written only into the e2e data file by the spec):
  - 40 logical cards and 50 facts and dimensions. Step 1 planned 50 logical cards; the large model has 41 logical
    entities, and the one with 200 attributes is left out.
  - Either 300 dimensional lines (60 transformations with two inputs) or 300 relationships between the same cards.
  - At 50 %, the lines' variant has 25 drawing layers, 13.0 MP and 10,691 viewport elements; the relationships'
    variant 25, 12.8 MP and 10,570. `e2e/slice-15c/S15-18.spec.ts`.
- **Pans as presented frames** (balanced, one discarded warm-up per variant, 4 rounds):

  | Variant | fps per round | Median |
  | --- | --- | --- |
  | lines | 56.8, 57.4, 56.7, 51.5 | 56.8 |
  | relationships | 58.0, 57.6, 58.3, 56.0 | 57.8 |

  The relationships' run-to-run spread is 56.0 to 58.3. The lines' median and three of their four rounds are inside
  it; one round is low (51.5).
  An earlier sitting without a warm-up gave 51.3 / 54.0 / 55.4 against 56.7 / 54.1 / 54.9.
- **The veil at a drag's start** (20 drags, from a settled screen, traced to the screen):

  | Build | In page (median) | To the screen (median) | Main thread |
  | --- | --- | --- | --- |
  | first | 67 ms | 75 ms | 63 ms |
  | final | 18.7 ms | 29.3 ms | 17.9 ms |

  The release went from 59 ms to 21 ms (15.3 ms of main thread). **The bar (a median under 16 ms) is not met.**
  - Two causes were found and fixed. The drag's line was `ModelCanvas` state, so every move re-rendered all cards: it
    is now a value store (`DraftLines`). The class `connecting` on `body` restyled every row at the start and the
    end: the crosshair is now the dragged row's, with the pointer captured on it.
  - What is left, per drag start: layerize 7.6 ms (the canvas's ~10,700 elements), the drop target's hit test 3.6 ms,
    script 3.6 ms, commit 2.3 ms; style 12 elements. The release, which draws no veil, costs nearly the same, so the
    veil's own share is small. The rest is this canvas's cost of any frame.
- **Sales star** (`e2e/slice-15c/S15C-layers.spec.ts`), with the 20 lines against without them:
  - 7 drawing layers against 10, 4.2 MP both times (Chrome groups the star into fewer layers with the lines);
  - 921 viewport elements against 791. The +130 are exactly the kind's: 1 group, 20 lines, 4 × 22 inputs, 3 × 7 ƒ.
- **Element guard** (`S3B-15-elements` against `slice-08.json`) on "Performance test": equal viewport counts (4,508 /
  19,305 / 1,465 / 4,907; page totals 6,000 / 20,797 / 2,867 / 6,309, as since slice 11).

### Tests

- **New e2e specs** in `e2e/slice-15c/` (fixtures: 15a's star; helpers listed in `helpers.ts`):
  - `S15-05` (the lines, colours, dashes, diamonds, ƒ, the layers);
  - `S15-09` (three tests: the header drop with its undo; the reverse direction, an existing mapping, the refusals;
    the veil and a column's refusal);
  - `S15-22` (two tests: hover, Focus, collapsed frames, the miniature; the menu, Delete with Undo, history places);
  - `S15-23` (the fed bar, the dots, Mapped and Not mapped, after a delete and its undo).
  - The measuring specs are `S15-18` and `S15C-layers` (measurement build only, in `playwright.config.ts`'s list).
- **New unit tests:** `tests/infocube-lines.test.ts` (7): the star's lines, cards left out, the composition root, a
  row's lines both ways, collapsed frames and layers, Focus on a line, the feeds on cards.
- **Changed:** `tests/infocube-star.test.ts`. The role now has `coverage` and the view `rowFeeds`.

### Checks

- `npm run lint`, `npm run typecheck`: clean. `npm test`: 140 files, 1,759 tests.
- Slice 15c's specs: 7 passed. One failed on its first run: a mapping deleted outside the page was still the page's
  until a reload. The spec now reloads before Back; the page reads the same data as InfoMapper's own places. Then 2 of
  2 passed.
- **The earlier spec folders that touch the canvas**, after the last change (no full run, Łukasz's regime for step 4):

  | Run | Folders | Covers | Result |
  | --- | --- | --- | --- |
  | 1 | `slice-01a`, `slice-01b`, `slice-02a`, `slice-02b`, `slice-02c`, `slice-03b`, `slice-04p`, `slice-04b1` | lines, the column's drag, hover, layers, frames and bundles, the miniature, the overlay and fading, Focus | 123 passed, 27 min 37 s |
  | 2 | `slice-06b`, `slice-07b`, `slice-10a`, `slice-10b`, `slice-15a`, `slice-15b`, `slice-15c` | history places, the Changes view, line menus, source lines, InfoCube | 135 passed, 19 min 28 s |

  No failure.

## Łukasz's answers to 15c step 4 (5 November 2026)

Step 4 accepted.

- **The veil's bar.** The 16 ms bar was meant to rule out a restyle of every card (slice 5a: 75–140 ms), and that is
  met. It is replaced in the PRD (section 6) by a relative bar: **the veil adds at most 5 ms to a drag frame without
  the veil on the same canvas.** Step 4's figures, recorded: the drag's start 18.7 ms in the page (median), 29.3 ms to
  the screen, 17.9 ms of main thread; the release, a drag frame that draws no veil, about 15 ms (15.3 ms of main
  thread). Against the release the veil adds about 2.6 ms of main thread: within the new bar. The pans' one low round
  (51.5 fps with the lines, against the relationships' spread of 56.0 to 58.3) stays on record; the median (56.8) and
  the other three rounds are inside the spread.
- **Differences accepted:** no hover tooltip on dimensional lines; Focus lights every dimensional line between two lit
  cards (step 1's "both cards lit" rule).
- **Texts:** "Delete dimensional mapping" approved. The header drop's undo step is renamed **"Create attribute and its
  mapping"** (done in step 5: `createOnHeader` names its write set).

## 15c step 5: panels and dialogs (5 November 2026)

### What changed

- **Step 4's answers:** the PRD's section 6 has the veil's relative bar; the header drop's undo step is "Create attribute
  and its mapping" (`createOnHeader` names its write set).
- **Server actions** (InfoCube's `app/actions.ts`): `addCubeMappingInputAction`, `removeCubeMappingInputAction`,
  `retargetCubeMappingAction`, `createDimensionFromAction`, beside step 4's.
- **The rows a save holds** (slice 9, 10a): every panel write of a mapping is `saveRow` with the mapping's row checked;
  × on an input is `saveRows` with the mapping checked and the input held (it is soft-deleted). The note and the rule
  are `TextArea`s with `keep` (slice 13); the kind, the status and the target `useChoice`.
- **The module's page data** (`moduleView`, `src/compose/view.ts`):
  - `ModuleView.data.infocube.contentAuthors`: each mapping's last content editor from InfoCube's change log, only
    while four-eyes is on (the canvas page passes its events, as for InfoMapper's `contentAuthors`);
  - `attributeDeletes` with the mapping index (X-3), `moduleEntityDependents` for logical entities too (X-2, X-4);
  - `EntityRole.feed` (the Overview's word and title, the entity panel's list title and "no feed") and
    `RowFeed.list` (the entity panel's row text);
  - `moduleRowFeeds` for the homes' thumbnails.
- **The dimensional mapping's panel** (`src/modules/infocube/app/mapping-panel.tsx`, prototype `insCmap`):
  - "Dimensional mapping" with the InfoCube badge; the trace (input pills → target pill, each opens its attribute);
  - "The types differ: … Use a transformation, or change one of the types." on a direct copy whose types differ;
  - "Reads from the logical model": one row per input, × "Stop reading this attribute" only while it has more than
    one (X2); "Add a logical attribute" (logical attributes, those on this canvas first, then "(not on canvas)");
  - "Target attribute" (dimensional attributes; re-pointing is content, X5); "How the value is carried"; the rule
    (open only for a transformation); "Status" (reviewers too, O9) with InfoMapper's four-eyes note beforehand; "Note";
    "Delete mapping";
  - **the rule's cursor:** "Edit transformation rule…" in the line's menu, a second input on a direct copy and
    choosing Transformation put the cursor in the rule (`ruleFocus`, a value store, so asking never re-renders the
    canvas).
- **An attribute's sections** (`feeds.tsx`, prototype `cubeAttrSection`, C10), through a new panel slot
  `PANEL_SECTIONS.attributeFeeds` after InfoMapper's "Comes from":
  - a fact's or a dimension's attribute: InfoMapper's "Comes from" (source columns) is not shown; "Comes from the
    logical model" lists its mappings (status dot, inputs, "ƒ", status) or "Not fed yet. Drag a logical attribute onto
    this row, or pick one below.", then "Add a logical attribute";
  - a logical attribute that feeds something: "Feeds facts and dimensions", one row per mapping with its target;
  - a row's click selects the mapping (its line, its panel).
- **The entity panel** of a fact or dimension: "Attributes and their logical feed", each row with its input
  ("Customer.segment_code", "ƒ 3 attributes" for a transformation) or "no feed" (prototype `insEntity`).
- **The Overview** (P17, F19): a fact's or dimension's "Mapping coverage" row says "{n} of {m} fed", titled
  "Attributes fed from the logical model"; logical entities unchanged (`coverage` in `stats.ts` takes the modules'
  roles and feeds).
- **Delete previews:**
  - X-2: a logical entity's preview adds "{n} dimensional mappings – deleted, {k} of them approved" and "{facts and
    dimensions} – lose their feed from the logical model" (each once, by name);
  - X-3: an attribute's second click names "{n} dimensional mappings" and "{E} loses its feed from the logical model";
    its toast counts both kinds (P10): "Attribute deleted together with 2 mappings and 1 dimensional mapping";
  - X-4: a fact's or dimension's preview adds its mappings' row.
- **"Create dimension from this…"** (B-2, P19): in a logical card's header menu before "Delete from model…", for those
  who may edit the model while InfoCube is on. The extension point is the canvas extension's `cardMenu` and `overlay`
  (`src/canvas/extensions.ts`), not step 1's proposed `ModuleView.cardItems`: the item opens the module's own dialog,
  a client component, which plain page data cannot carry. The dialog (`create-dimension-dialog.tsx`, prototype
  `askDimFrom`):
  - "{concept} · InfoCube", "Create a dimension from {entity}", the prototype's sentence;
  - Name: "Dim {entity}", numbered while a fact or dimension has that name ("Dim Product 2"; `proposedDimensionName`);
    a typed name that is taken shows InfoMapper's duplicate-name warning under the field at once, and the same
    warning comes as a toast after the create (Łukasz, 15c step 3);
  - every attribute ticked, with "{type}" and " · PK"; Cancel, Create dimension;
  - the new card is selected and centred, its panel open.
- **The homes' thumbnails** (the step 4 finding): `thumbnailIndex` takes the modules' `rowFeeds`, so a fact's or a
  dimension's card filtered to Mapped or Not mapped has the canvas's height (both homes and the thumbnail route).

### Tests

- **New e2e specs** (`e2e/slice-15c/`): S15-11 (Create dimension from Product, two attributes unticked, "Dim Product 2"
  and the duplicate warning, one undo), S15-12 (Order Line's preview: 6 dimensional mappings, 4 approved; Fact Orders
  and Fact Sales lose their feed), S15-13 (segment_code's second click and toast, Dim Customer's attribute unfed, an
  attribute that feeds nothing deletes at once, Q-5 with discount_pct), S15-14 (Dim Customer's preview: 4 mappings, 3
  approved; Dim Date none), S15-20 (the panel: the note keeps the approval, a second input with one toast and the
  cursor in the rule, ×, the kind and the rule, re-pointing; one undo each), S15-21 (four-eyes: Anna refused, Piotr
  approves and edits nothing else, his undo); S15-23 gained the Overview's "{n} of {m} fed".
- **Unit tests:** `tests/infocube-panels.test.ts` (the numbered name, the Overview's coverage and words, the row's
  feed text, `contentAuthors` only with four-eyes, the thumbnails' heights with filtered cards); updated
  `infocube-lines`, `infocube-mapping-commands` (the toast's counts, "Create attribute and its mapping") and
  `infocube-star` (the previews' new rows).
- **Earlier specs changed, with the reason:**
  - `e2e/slice-15b/RP-07.spec.ts`: quantity's second click now also names its dimensional mapping ("Click again to
    delete, with 1 measure and 1 dimensional mapping"), X-3.
  - `e2e/slice-15a/S15-mapping.spec.ts`: it picked a column in a fact attribute's "Add a source column", which 15c
    replaces with "Comes from the logical model" (the spec's own comment expected this). It now checks the panel offers
    no source column and no such mapping exists; B-6's toast on the canvas's path is S15-09's.

### New user-facing texts

The prototype's texts unless a difference is named.

| Where | Text | Prototype |
| --- | --- | --- |
| Mapping panel | "Dimensional mapping", "Reads from the logical model", "Stop reading this attribute", "Add a logical attribute", "Choose an attribute…", "(not on canvas)", "Target attribute", "How the value is carried", "Direct copy", "Transformation", "Transformation rule", "e.g. a key lookup, a date key, or plain words", "Status", "Note", "Why this mapping, open questions, who decided", "Delete mapping" | same |
| Mapping panel | "The types differ: {t1} → {t2}. Use a transformation, or change one of the types." | same |
| Mapping panel toasts | "Re-pointed to {entity}.{attribute}", "Mapping deleted" | same |
| Mapping panel toast | the panel's own text followed by D-51's notice in one toast, e.g. "It reads Customer.customer_number too, so it is a transformation now. Describe the rule. This mapping was approved; your change sends it back to review." | two separate toasts (the second replaced the first) |
| Attribute panel | "Comes from the logical model", "Not fed yet. Drag a logical attribute onto this row, or pick one below.", "Feeds facts and dimensions" | same |
| Entity panel | "Attributes and their logical feed", "no feed", "ƒ {n} attributes" | same |
| Overview | "{n} of {m} fed", title "Attributes fed from the logical model" | same |
| Card menu | "Create dimension from this…" | same |
| Dialog | "{concept} · InfoCube", "Create a dimension from {entity}", the sentence, "Name", "{type} · PK", "Cancel", "Create dimension" | same |
| Dialog, toast | "Created {name} with {n} attributes fed from {entity}, plus its key {key}." | same |
| Dialog, toast | InfoMapper's "Another entity is already called “{name}”. Rename one of them if they mean different things." (live under the field, and as a toast after the create) | "Another fact or dimension is already called {name}. Rename one of them if they differ." |
| Entity delete preview | "{n} dimensional mappings – deleted, {k} of them approved", "{names} – lose(s) their feed from the logical model" | same |
| Attribute delete, second click | "Click again to delete, with … and {n} dimensional mapping(s); {E} loses its feed from the logical model" | new (the prototype has no second click for it) |
| Attribute delete, toast | "Attribute deleted together with {n} mappings and {m} dimensional mappings" (P10) | new |
| Undo steps | "Create dimensional mapping", "Change dimensional mapping" (inputs, kind, rule, note, target, status), "Create entity" (Create dimension), "Create attribute and its mapping" | none (the prototype has no undo names) |

Reused unchanged: the four-eyes note and refusal, D-51's notice, the step 3 texts.

### Not done, deviations

- The card menu's item comes through the canvas extension (`cardMenu`, `overlay`), not `ModuleView.cardItems`
  (above). CLAUDE.md's extension points get `attributeFeeds`, `cardMenu` and `overlay`, `moduleRowFeeds` and
  `RowFeed.list` in step 6.
- The new dimension's card is placed as the prototype places it (right of its original, 80 px apart); on the star it
  can overlap a card already there (Dim Product beside Product). No layout search: not in the PRD.
- The duplicate warning is InfoMapper's text (table above), not the prototype's.

### Checks

- `npm run lint`, `npm run typecheck`: clean. `npm test`: 141 files, 1,763 tests passed.
- 15c's specs: all passed (after the fixes below); RP-07 and S15-mapping passed.
- **Full e2e run** (shared infrastructure: the attribute panel, the delete toasts, the Overview, the homes):
  594 passed, 2 failed, 3 skipped; 131 min 14 s (part 1 40 min 57 s, part 2 28 min 50 s, part 3 20 min 54 s,
  part 4 40 min 33 s). Traces and log kept in `.data/e2e-failures/15c-step5-full/`.
  - `S2C-03` (the block's click and move): the sign-in timed out (`bar-top` not shown); passed three times on its own.
    A flake.
  - `S15-mapping` (15a): a real change of behaviour, the spec rewritten (above); passed.
- Two earlier runs of 15c's specs failed and are kept (`.data/e2e-failures/15c-step5-run1`, `-run2`): run 1 crashed
  every home (the homes read InfoCube's rows through the default store; `moduleRowFeeds` now takes the composed one);
  run 2 had three spec errors (the menu item's role, an attribute that is mapped, the toast replaced by the notice).
- Verified in the browser on the demo (port 3001): the panel, adding and removing an input, the card menu, the dialog
  with "Dim Product 2" and the warning, the entity's and the attribute's sections.
