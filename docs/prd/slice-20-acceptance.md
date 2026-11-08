# Slice 20 – acceptance

PRD: [`slice-20-model-checks.md`](slice-20-model-checks.md). Branch `slice/20-model-checks`.

## Step 1: the PRD checked against the code (8 November 2026)

### The starting point

- **The branch.** `main` was up to date with `origin/main` at `98cd39c`, the merge of PR 46. The tag `slice-19` points
  to that commit. `slice/20-model-checks` was cut from there.
- **No run in this step.** No dev or e2e server ran and no script ran, so KB was not read or backed up. Every number below
  comes from reading the seed and the code. Step 2 checks the numbers with unit tests on the composed seed. KB's numbers
  (Q12) come from a read-only count on a backup copy in step 2, if Łukasz agrees (question 12).
- **The two files from Łukasz's Downloads**, each checked with `cmp` after the copy and committed with this document:

  | File | SHA-256 | `cmp` |
  | --- | --- | --- |
  | `docs/prd/slice-20-model-checks.md` (new, 20,247 bytes) | `bb3531c68279f4b0e680f80cc1f59b35d4e11c0c5520a0b0694ae99c3f48ecb1` | equal |
  | `docs/prototype/infomapper-prototype-with-sources.html` (710,238 bytes, replaces slice 19's `ee2f17b1…`) | `035b566302fd0edcc64c05393ffa96ebd9b395f441f258ad524df9a24af4f88f` | equal |

- **The prototype's slice-20 code.** Against slice 19's version, the diff adds 231 lines and removes 15:
  - the CSS after `.im-cons` (the marks, the status bar's button, the panels' box, the flash);
  - `checksDemo`, `CHK_NAME`, `chkAttr`, `isOneEnd`, `cmTypeIssue`, `modelChecks`, `chkIndex`, `chkSev`, `chkTitle`,
    `chkHeadMark`, `chkRowMark`, `chkSection`, `CHK_SHORT`, `canvasChecks`, `chkOverview`, `openCanvasChecks`,
    `checksHtml`, `goCheck`, `copyField` (a stand-in only) and the click handlers;
  - the calls in `renderHome` (the stats' link, the section), `entCard`, `attrRow`, `insOverview`, `renderStatus`,
    `insEntity`, `insAttr`, `insRel` and `insCmap`;
  - the fix outside the slice: `insChange` and `INS_SWAP` (Q10).

### Summary

The PRD's shape holds. Every rule can be built from what the app already has: copies (D-63), calculations (D-73), the
fact hints (D-68, D-74), the module's type-conflict rule and D-31's coverage. The slice needs no data model change. It
does need a new extension point, a check index, a new kind of card mark, three new arrival addresses and a seed step.
The PRD is wrong, incomplete or different from the code in these places:

1. **"Relationships without a copied key" fires on every hand-built model.** The seed's foreign keys are plain
   attributes, not copies (`seed-model.ts` l. 269). Before slice 10c there were no copies at all, so KB's are probably
   plain too. A strict rule gives five lines in the plain e2e seed. Every earlier spec's canvas, home and panels would
   then show them. This is the same noise R3e was left out for, seen from the other side (F1, question 1).
2. **There is no duplicate-name warning for attributes.** D-46's warning is for entities. It compares with
   `toLocaleLowerCase` within one level and normalises no spaces (`entity.ts` l. 25–30). The PRD's "ignoring case and
   spaces" is not what the prototype does either: `CHK_NAME` trims the name and collapses runs of spaces. It does not
   drop them (F2, Q8).
3. **The row's "!" and a measure's Σ want the same pseudo-element.** Both use `.dt::before` (`infocube.css` l. 27–30). A
   non-numeric measure is a fact hint on its row, so the two marks meet on one row (F8).
4. **The "not yet covered" texts miss two of the app's reasons.** An approved source mapping with a type conflict does
   not cover (`lookupModel`'s `counts`, `requirements.ts` l. 236–242), yet the text would say "has no approved source
   mapping". A calculated input is covered only through its inputs (D-73), which none of the three texts says (F12).
5. **The app's type-conflict rule is not the prototype's.** The app counts Integer → Decimal and a lookup as a
   conflict (`typesDiffer`, `hasTypeConflict`, `mappings.ts` l. 157, 873). The prototype accepts the first and skips the
   second (`cmTypeIssue`). The PRD says to use the app's rule, so the High group can show lines the prototype would not
   (F11).
6. **A copy of a copy is not a copy of the key.** D-63 links a copy to the attribute it was pasted from, which may itself
   be a copy. The prototype reads only that first link. A foreign key pasted on from another foreign key would then miss
   "wrong way" and "no relationship", and would raise "no copied key" (F5).
7. **The panels' lists differ from the prototype in one place.** The prototype lists "Keys copied the wrong way" in the
   relationship's panel too (its `refs`); the PRD lists it in its attribute's only (F14).
8. **The canvas has no arrival address for a relationship, a dimensional mapping or an entity whose card is not on the
   canvas.** Today it has `?card=entity:` (only when the card is there), `?map=`, `?row=` and `?system=`
   (`arrivalSelection`, canvas `page.tsx` l. 374) (F17, Q7).
9. **InfoMapper may not name InfoCube.** The home's sentence "… copied keys and InfoCube" and its empty text "…, and so
   do facts and their feeds" are InfoMapper's texts that name the module. Both must come from the module through the
   extension point (F4).
10. **The project home reads InfoCube's mappings twice.** `moduleFeeds` already reads two of InfoCube's tables; the checks
    need five. One read should serve both (F19).

Q10: the app does **not** have the prototype's bug. A field is left on `mousedown` and saves into its own row before the
`click` that changes the selection, and every save is bound to the panel's own row (Q10).

### Findings

| # | Finding | Files and functions | Proposal |
| --- | --- | --- | --- |
| F1 | **"No copied key" in a hand-built model.** The seed's five logical relationships are all 1:N with plain foreign keys. A strict rule gives 5 lines in the plain e2e seed: Customer – Sales Order, Sales Order – Order Line, Product – Order Line, Customer – Customer Address and Country – Customer Address. Every earlier spec's page would show them: the many-side headers of Sales Order, Order Line and Customer Address would get the "!" mark, the status bar the count, and both homes the section. KB's foreign keys are likely plain too (copies came in slice 10c). | `seed-model.ts` (`ATTRIBUTES`, `RELATIONSHIPS`, l. 269 `copied_from_attribute_id: null`) | **Question 1.** (a) Strict, as the prototype: only a copy counts. (b) **Recommended:** a foreign key of the "many" end whose name equals the primary key's (D-46's comparison, Q8) also counts as the key. This is a check's reading, not a link (D-68's "never matched by name" is about key links), and the plain seed is then clean. With (b) the demo needs another "no copied key" example: Customer Address's hand-typed `country_code` loses its foreign-key flag in the demo step. |
| F2 | **Duplicate names.** No attribute rule exists. The entity warning compares with `toLocaleLowerCase` within a level (`entity.ts` `sameName`, `hasDuplicate`). A paste's `nameTaken` compares with `toLowerCase` (`attribute.ts` l. 317). The prototype's `CHK_NAME` trims, collapses runs of spaces and lower-cases. | `entity.ts`, `attribute.ts` | One helper, `nameKey(name)` = trimmed, runs of white space collapsed to one space, `toLocaleLowerCase`, in `src/domain/model/checks.ts`. Attributes of one entity are compared, both levels (an entity is of one level). The group's hint becomes "…, ignoring case and extra spaces." Q8. |
| F3 | **The extension point.** No module can contribute to a list on InfoMapper's pages today except through `ModuleView`. The InfoCube rules are pure and run on the server and in the browser alike (`factHints` in `keys.ts`, `hasTypeConflict` in `mappings.ts`, `cubeIndex`); the sections already run them in the browser. | `src/compose/view.ts`, `src/ui/modules.ts` | Below, "The extension point and the index". |
| F4 | **The module's words.** The home's sentence and its empty text name InfoCube and its objects. | prototype `checksHtml` | A module's checks carry `topic` ("InfoCube") and `allWell` ("so do facts and their feeds"). InfoMapper joins them into its sentences, and they are present only while the module is on. |
| F5 | **Copies of copies.** `copied_from_attribute_id` names the attribute pasted from, a copy or not (D-63, `copies.ts`). | `copies.ts` | `wrong`, `norel` and `nokey` read a copy's **key**: follow `copied_from_attribute_id` to the first attribute that is not a copy, with a guard against cycles. When a link on the way is lost, there is no key; that copy is a `lost` line already. A line names the key ("copy of Customer.customer_id"). `lost` reads the first link only, as D-63's panel does. Question 5. |
| F6 | **Levels.** The prototype checks `lost` and `norel` at the logical level only, and `wrong` and `nokey` on logical relationships only. The PRD names the level for `dup`, `calc`, `wrong` and `nokey`, but not for `lost` and `norel`. A fact's keys are InfoCube's hints already ("…is related, but no key carries it", "…carries no dimension"). | prototype `modelChecks` | `dup`, `calc` and `lost` at both levels; a dimensional copy whose original is gone is just as stale. `norel`, `wrong` and `nokey` at the logical level only. Question 6. |
| F7 | **Card marks.** `CardData` and `CardRow` carry module classes (`mark`, slice 15b), and `withClips` counts `ROLE_MARK` and `ROW_MARK` (`card-data.ts` l. 328–337, `text-fit.ts`). The header's `c-l2` is a flex row (`canvas.css` l. 43). The name has its own `title` (`CardNode.tsx` l. 244), so hovering the name shows the name, and the checks' title shows on the "!" and the empty parts of the line. Below 40 % the header is still drawn, and so is a collapsed card's (`CardNode.tsx` l. 182–268). | `card-data.ts`, `CardNode.tsx`, `text-fit.ts`, `canvas.css` | `CardData.check?: { high: boolean; title: string }` and `CardRow.check?` alike, only when set. `CardNode` adds the class `chk` (`chk high`) and the title to `.c-l2` and to the row's `.dt`. **No element.** The header's mark is `.c-l2.chk::after` with `order`, as the prototype. `titleNeedsClip` and `rowNeedsClip` count `CHECK_MARK` (about 12 px, measured in step 3), and so does `fitWidth`, so a long name is cut rather than overlapped. A collapsed frame's block and the thumbnails get none (PRD section 9). |
| F8 | **The "!" beside a measure's Σ.** Both marks are `.dt::before`. | `infocube.css` l. 27–30 | The check mark becomes `.row.chk .dt::after`, put first with `.row.chk .dt { display: inline-flex }` and `order: -1` on the `::after`. The order is then "!", Σ, type; CSS only. S15-08 reads `::before`'s content and keeps it. |
| F9 | **The skew.** The prototype draws the "!" with `transform: skewX(-12deg)`. A 2-D transform on a pseudo-element makes no compositing layer, but it is the first transform inside cards. | `canvas.css` | Keep it and read the LayerTree in step 3, as the PRD says. If a layer appears, use the italic face alone. |
| F10 | **The status bar.** Its counts come from the page's props (`model`, `entityIds` from the server's cards) and from `viewCounts` (`status-bar.tsx`). It sits in `AppShell`, inside `ModulesProvider` and `CanvasProvider`. S6A-07 checks the bar's `:scope > span` list exactly. | `status-bar.tsx`, `side-panels.tsx` `openDetails` | The count is a `<button>` (the prototype's `sb-chk`) after "Open notes on canvas", so S6A-07's span list is unchanged. It counts from the page's checks and `entityIds` (a `useMemo`), so `ModelCanvas` gets no commit. Its click calls `ui.select(null)`, then `openDetails()`, then sets a value store `checksJump`. The Overview's group reads the store: its `Fold` opens even when it was folded, scrolls itself into view on the next animation frame (never in a render or a layout effect), and flashes once, CSS only. |
| F11 | **Type conflict.** `hasTypeConflict` (mappings.ts l. 873): a transformation with a rule passes; anything else, lookups included, conflicts when `typeWord` differs. Integer → Decimal conflicts. | `mappings.ts` | As the PRD says: the app's rule, so a line here matches the requirement panel's "type conflict". The detail names the first input that differs: "type conflict: {E.a} is {T}, {E.b} is {T}", with `typeWord`. Noted as a difference (P2). |
| F12 | **Not yet covered.** `lookupModel.coverageOf` (requirements.ts l. 259) also refuses an approved mapping with a type conflict and covers a calculated attribute only through its inputs. | `requirements.ts` `lookupModel`, `gapReason` | Each input that is not covered gets one text, taken in this order: "{a} reads a column that left the source" (a live mapping of it reads a column with `missing_since`); "{a}'s approved source mapping has a type conflict" (**new**); "an input of {a}'s calculation is not covered" (**new**, GAP_REASONS' words); "{a} has no approved source mapping"; "{a} is not mapped". One helper in InfoMapper's domain, `coverageGapText(lookup, attributeId)`, which the module calls. |
| F13 | **The fact hints' targets.** `factHints` returns `go` as grain, entity (the fact, or for slice 19's base hint a dimension), relationship or attribute (`keys.ts` l. 186). | `keys.ts` | `facts` lines: the name is the fact's and the detail the hint's text. The line opens what the hint opens (grain → the fact). Its mark is the row for an attribute target, else the fact's header, as the prototype. |
| F14 | **Panels: "wrong way".** The prototype puts the line in the relationship's panel too (`refs: ["attr:…", "rel:…"]`). | prototype `modelChecks` | As the prototype: the attribute's and the relationship's panel. Question 7. |
| F15 | **Panels' place.** Each InfoMapper panel draws its kind line itself (`entity-panel.tsx` l. 85, `attribute-panel.tsx` l. 153, `relationship-panel.tsx` l. 63), and InfoCube's mapping panel draws its own (`infocube/app/mapping-panel.tsx` l. 152). | as listed | One component, `ChecksBox` (`src/app/_panels/checks-box.tsx`), with `useChecks()` from a page-level `ChecksProvider`. Each panel renders it after its `Kind`. The module's panel imports it, as it imports `fields.tsx` today. It has no actions: readers and reviewers see the same box, and an item that names another object selects it. |
| F16 | **The overview's group.** `OverviewPanel` (l. 54–89) has Mapping coverage, then Needs attention. Long lists use `LongList`, which has a filter and "Show all" over 20 items (D-35). | `overview-panel.tsx`, `fields.tsx` `LongList`, `Fold` | The group "Model checks" goes between the two, as `LongList`, so it gets D-35's filter as well. That is a difference from the prototype (P8). "Show the first 20" is not in `LongList`: keep D-35's behaviour as it is. |
| F17 | **Arrival addresses.** `arrivalSelection` knows `?map=`, `?row=` and `?system=`; `?card=entity:` selects only a card that is on the canvas. The arrival effect centres a row's card or a mapping's card (`ModelCanvas.tsx` l. 1029–1051). | canvas `page.tsx`, `ModelCanvas.tsx` | New: `?entity=<id>` (the card selected and centred when here, else `{ t: "element", kind: "entity" }`), `?rel=<id>` (`{ t: "rel" }`, centred on the first of its two cards here) and `?ext=<kind>:<id>` (`{ t: "ext" }` when a `CANVAS_EXTENSIONS` kind matches; centred on the first card among its line's ends here). `?row=` serves attributes as today. The home picks the canvas as the prototype's `goCheck` does; with none, the project's first canvas, as consistency does (P11). |
| F18 | **Readers' marks and panels.** Nothing in the marks or the box depends on `editable`. | — | Nothing to build; S20-03 and S20-04 check a reader. |
| F19 | **One read on the home.** `moduleFeeds` reads `cube_mapping` and `cube_mapping_input`; the checks also need `cube_entity`, `cube_measure` and `cube_key` for `factHints`. | `compose/view.ts` `moduleFeeds` | `moduleHomeData(workspace, model, store)` reads the five tables once while the model has a fact or a dimension, and returns `rowFeeds`, `feeds` and the module's check groups. `moduleRowFeeds` keeps its signature for the thumbnail route. |
| F20 | **The canvas page's bytes.** The checks are needed on the server (the marks in `buildCards`) and in the browser (the status bar, the Overview, the panels). | canvas `page.tsx` | Build them once on the server per page. Hand the browser the lines as plain data (`ChecksProvider`), and let it build the small by-element maps in a `useMemo`. Building them again in the browser from the model and `ModuleView.data` would add no bytes but run the rules twice. Step 3 reports the page's added bytes on the demo and on "Performance test" (about 40 relationships, so at most about 30 `nokey` lines with option (a)). |
| F21 | **Duplicates of panel warnings.** The attribute panel already warns for "calculated and mapped" (`calculation-section.tsx` l. 199, `note-calc-also`) and names a lost original (`attribute-panel.tsx` l. 195). | as listed | Keep both, as the prototype does: the box is the validator's summary at the top, and the sections say it in place. |
| F22 | **When marks change.** Cards are built on the server; a write's fresh page brings new cards (as the Σ marks and the role chip, slice 19 F10). | — | The marks and the count change with the write's fresh page, not optimistically; S20-03 waits for it. Noted in `known-limitations.md`. |
| F23 | **The demo seed's place.** `addFullDemoData` (seed, reset, `npm run demo`) is also slice 19's fixture (`e2e/slice-19/fixtures.ts` l. 14) and `tests/infocube-types.test.ts` l. 198. | `compose/seed.ts` | InfoMapper's step `addChecksDemo` in `src/data/local/seed-checks.ts`, for "Retail Co – DWH" only (the demo model, never KB and never "Sales"). `addChecksDemoData` goes in `compose/seed.ts`, and `addFullDemoData` = slice 19's + checks. Slice 19's fixtures and its unit test move to a new export `addTypesDemoData` (what `addFullDemoData` is today), so they read what they read now. Q9. |
| F24 | **The demo's copies follow.** Making the four foreign keys copies sets `copied_from_attribute_id`. Their types and Personal data already equal their originals' (`seed-model.ts`), so `followOriginals` would change nothing. | `seed-model.ts`, `copies.ts` | Written directly by the seed step, as the slice 18 and 19 steps write their rows. `Customer.last_order_id` and `Product.country_code` are new copies, flagged as foreign keys and typed as their originals. `Product.Product_Name` is a plain String. `Sales Order.total_amount` gets `is_calculated` and its rule, with no inputs. |
| F25 | **Status bar and `under`.** `under` lines have no mark, but they name entities. On the demo they are 10 of the 15. | — | Question 4 (Q12). |

### Q1. The scope

- **Model consistency's scope** (`modelConsistency`, `consistency.ts` l. 98–115; the home `page.tsx` l. 87): the
  project's canvases in tab order (`view.canvases`) and the workspace's canvas items. A mapping is in scope when its
  attribute's entity or one of its inputs' tables has a live card on one of those canvases. Only the logical level is
  read (l. 86–88).
- **The checks' scope** is entity-based, as the prototype's `projCanvases(p)…d.ent`: the live entities with a live card
  on one of the project's canvases (`projectScope(items, canvasIds)`, the same loop). In scope are:
  - `dup`, `calc` and `lost`: the attributes of those entities;
  - `wrong` and `nokey`: a relationship with either end in scope;
  - `norel`: a copy in scope;
  - `facts`: a fact in scope;
  - `feeds` and `under`: a mapping whose target's entity or any input's entity is in scope.
  On a canvas page and in the panels the scope is the whole model (`null`).
- **AD-34's sentence for checks:** "Model checks (slice 20) read both levels: duplicate names, calculations and lost
  originals at both, copied keys at the logical level, and the modules' groups through the composition root."

### Q2. The extension point and the module's rules

The InfoCube rules are pure and import no data layer: `cubeIndex` and `factHints` (`keys.ts`), and `mappingIndex` and
`hasTypeConflict` (`mappings.ts`). They already run in the browser (`sections.tsx` l. 89, 152; `compose/feeds.ts`) and on
the server (`compose/view.ts`). InfoMapper's rules never name InfoCube: the composition root joins the module's groups
(below). On the canvas page the module's rows are `ModuleView.data.infocube` (`cubePageRows`), already read for the
page. On the home they are read by `moduleHomeData` (F19).

### The extension point and the index as I would build them

**InfoMapper's domain** (`src/domain/model/checks.ts`, pure, tested):

```ts
export type CheckRef =
  | { t: "entity"; id: Uuid } | { t: "attribute"; id: Uuid } | { t: "relationship"; id: Uuid }
  | { t: "ext"; kind: string; id: Uuid };                 // a module's object, e.g. "cube_mapping"
export interface CheckLine {
  go: CheckRef;                                            // what a click opens
  name: string;                                            // the prototype's `n`
  detail: string;                                          // `m`
  panels: CheckRef[];                                      // the panels that list it
  marks: ({ t: "entity" | "attribute"; id: Uuid })[];      // header or row marks
  entities: Uuid[];                                        // what it names: the canvas's count, the home's canvas
  hint?: true;                                             // a fact hint: the panel's box counts it, never lists it
}
export interface CheckGroup {
  id: string;                                              // "wrong", "dup", …, a module's "cube:feeds"
  title: string; short: string; hint: string;
  high: boolean;
  module?: string;                                         // the tag ("InfoCube"); InfoMapper's groups have none
  lines: CheckLine[];
}
export interface ModuleChecks { topic: string; allWell: string; groups: CheckGroup[] }
export interface CheckInput {
  model: WorkspaceModel;                                   // live rows and lostOriginals
  lookup: ModelLookup;                                     // the requirement index's (no second pass)
  scope: ReadonlySet<Uuid> | null;                         // entities in scope; null: the whole model
}
export function modelChecks(input: CheckInput, modules: readonly ModuleChecks[]): ModelChecks;
// InfoMapper's groups (wrong, dup, calc, lost, norel, nokey) and the modules', High first, InfoMapper's before the
// modules' within a severity; groups without lines dropped. ModelChecks = { groups, count, high, topics, allWell }.
export function checkIndex(checks: ModelChecks): CheckIndex;
// panel(ref) → lines; entityMark(id) / rowMark(id) → { high, title } | undefined (a row's marks also mark its
// entity's header); onCanvas(entityIds) → lines, High first. Each line is kept once.
export const markTitle: (lines) => string;   // "Model checks: {n}" and up to six "{group}: {name or hint}", then "…"
export const coverageGapText: (lookup, attributeId) => string;   // F12, for the module's `under`
```

**The module** (`src/modules/infocube/domain/checks.ts`, pure, tested):
`cubeChecks(rows: CubePageRows-like, input: CheckInput): ModuleChecks` with `facts`, `feeds` and `under`, built on
`cubeIndex`, `factHints`, `mappingIndex`, `hasTypeConflict` and `coverageGapText`. `topic` is "InfoCube", and `allWell`
"so do facts and their feeds".

**The composition root** (`src/compose/checks.ts`):
- `pageModuleChecks(view: ModuleView, input)`: from `ModuleView.data`. It runs in a canvas page's server code, and only
  while InfoCube is on (`ModuleView.tabs` holds the Cube tab only then).
- `moduleHomeData(workspace, model, store)` (F19): the home's one read, with `rowFeeds`, `feeds` and the module's
  checks.
- Both return `[]` with no module. **With no module registered, InfoMapper behaves as before** (AD-33).

**The index on a canvas page:** built once per page in `page.tsx`, after the requirement index (whose `lookup` it
reuses; the index exposes it, or `buildRequirementIndex` takes a lookup). Then:
- `buildCards` takes the marks as a new last argument (`checks?: CheckIndex`), as `rowMarks`;
- `StatusBar` and `Inspector` get the groups through `ChecksProvider` (`src/app/_components/checks.tsx`, `useChecks()`),
  which builds the browser's `checkIndex` once per page in a `useMemo`.
**On the home:** `modelChecks` with the project's scope, after `modelConsistency`.

**Cost.** One pass over attributes, relationships, mappings and copies. Building by entity is O(n), with no search per
line. A bench `scripts/bench-checks.ts` (step 2) runs on a synthetic model of 20,000 attributes, 2,000 entities, 2,000
relationships, 3,000 copies and 1,500 dimensional mappings (as slice 15d's bench), on "Performance test" and on the
demo. **Proposed bar:** rules and index within 20 ms on the synthetic model on the laptop, with "Performance test" and
the demo reported. Model consistency takes about 23 ms on 20,000 columns; the requirement index has its own bar.

### Q3. The index on a canvas page

As above: once per page on the server (cards are built there), and once per page in the browser for the by-element maps
(`useMemo` on the page's lines, like `requirementFeeds` in `ModulesProvider`). Bar and bench as above. The page's added
bytes are reported in step 3 (F20).

### Q4. The marks

- **Fields:** `CardData.check` and `CardRow.check` (`{ high, title }`), InfoMapper's own (F7). `ModuleView.rowMarks` stays
  the module's Σ; the module's check lines come through the checks, not through `rowMarks`.
- **CSS:**
  - the header: `.c-l2.chk::after` with `order`;
  - the row: `.row.chk .dt::after`, put first (F8);
  - orange is `.high`, with `var(--im-warn)`, else `var(--im-ink-3)`.
  No element is added; S3B-15-elements and a LayerTree read check it (F9).
- **Widths:** `CHECK_MARK` in `text-fit.ts`, counted by `titleNeedsClip` and `rowNeedsClip` (and so by `fitWidth`) through
  `withClips`, which `applyNames` and the canvas's own patches call again.
- **`shownText`:** the marks do not change what a card shows. The titles name objects by their model names, as toasts
  and questions do (D-64), on an alias canvas too.
- **Below 40 %** the header keeps its mark, and rows are not drawn. A **collapsed card** keeps its header's. **Collapsed
  frames' blocks** and **thumbnails** get none.

### Q5. The status bar

Its counts come from the page's props and `viewCounts` (F10). The checks' count is derived in `StatusBar` from
`useChecks()` and `entityIds` with a `useMemo`, so it changes only with a fresh page. `ModelCanvas` does not re-render
for it, and nothing above the canvas reads layout. The jump scrolls in the details panel, beside the canvas, on the next
animation frame. S20-06 counts `window.__imCanvasCommits` around the click.

### Q6. The panels' section

`ChecksBox` after the kind line in `EntityPanel`, `AttributePanel`, `RelationshipPanel` and InfoCube's `CubeMappingPanel`
(F15). It is InfoMapper's component, not a `PANEL_SECTIONS` entry: the checks are InfoMapper's feature, and the
module's lines arrive through the checks. Readers and reviewers see it; it has no actions. Each item names its group and
its line. On an attribute's own line only the detail shows; an item that names another object selects it through the
panel's `go…` functions. A fact's box lists no hints: it ends with "1 hint in the Fact section below." / "{n} hints in
the Fact section below.", and it shows for those alone.

### Q7. Navigation

- **From the home:** each line has `canvasId`, chosen as the prototype's `goCheck`: the first project canvas, in tab
  order, with the line's first entity, else one with any entity it names, else the project's first canvas. The
  addresses are `?entity=`, `?row=` (attribute), `?rel=` and `?ext=cube_mapping:<id>` (F17). The arrival is selected and
  centred, then the address is cleaned as today (`replaceState`). The details panel opens on arrival, as for `?map=`.
- **From the panel's group:** `ui.select` and `ui.centerOn` (an entity's card, an attribute's card, a relationship's or a
  mapping's first card on this canvas). Every one is a single selection, so a history place (D-38) with nothing new:
  `rel` and `ext` are places already (`SelectionHistory.tsx`, `GONE`).
- **The status bar's click** clears the selection, which is no place.

### Q8. Duplicate names

There is no attribute warning to reuse (F2). D-46's entity warning is case only, within a level. Proposal: `dup` uses
`nameKey` (trimmed, runs of white space collapsed, `toLocaleLowerCase`), per entity, both levels, live attributes only,
one line per set of two or more. The line opens the set's second attribute, as the prototype does. With the demo step,
Product's `product_name` and `Product_Name` are one line.

### Q9. The demo seed

- **Copies today:** none. The seed writes `copied_from_attribute_id: null` for every attribute (`seed-model.ts` l. 269),
  and its foreign keys are plain (`ATTRIBUTES`, "FK").
- **The step:** `addChecksDemo` (F23, F24), in "Retail Co – DWH" only:
  - Sales Order.customer_id, Customer Address.customer_id, Order Line.order_id and Order Line.product_id become copies
    of their primary keys;
  - Customer.last_order_id (Integer, a foreign key) is a copy of Sales Order.order_id;
  - Product.country_code (String, a foreign key) is a copy of Country.country_code;
  - Product.Product_Name is a plain String;
  - Sales Order.total_amount is calculated ("Sum of its order lines' net amounts", no inputs).
  It is false when it ran already.
- **Who sees it:** seed, reset and `npm run demo` (`addFullDemoData`), and slice 20's fixtures. It reaches no earlier
  fixture: the plain e2e reseed has no demo, slices 15 and 18 have their own steps, and slice 19 moves to
  `addTypesDemoData`. The Overview, coverage and the homes' counts change only in the files it writes: Customer gets 9
  attributes, Product 7, and the mapped counts stay as they are.

### Q10. The prototype's field bug in the app (read, not run)

**The case:** a rule typed in a mapping's panel, then a click on another mapping's line, on a card, or on the empty
canvas.

1. **What happens first.** In the pointer mode the canvas's `pointerdown` handlers do not cancel the press
   (`CanvasModes.tsx` l. 157–172 returns before `preventDefault` without a tool; `Lasso.ts` l. 47 only records it).
   React Flow's node and pane presses do not cancel `mousedown` either. A row that may be dragged calls `preventDefault`
   on `pointerdown` (`ColumnDrag.tsx` l. 199). Chrome still moves the focus on such a press; this one is the only step
   that is not certain from the code, and the spec below confirms it. The browser moves the focus on `mousedown`, so
   the rule's `<textarea>` gets `blur` first.
2. **The blur saves.** InfoMapper's rule (`mapping-panel.tsx` l. 331: `onBlur` → `ruleCommit` → `onRuleBlur`) calls
   `write`, which is `saveRow(m, …)` with the panel's own mapping `m` (l. 131–132). InfoCube's rule is a `TextArea` whose
   `onSave` calls `write` → `saveRow(m, …)` (`infocube/app/mapping-panel.tsx` l. 109–110, 248).
3. **Then the selection changes.** A card selects on `click` (`CardNode.tsx` l. 171), a line on `click`
   (`LineLayer.tsx` l. 69, 129, 179) and the empty canvas on `onPaneClick`. Only then does the inspector replace the
   panel, keyed by the selection (`inspector.tsx`, `key={sel.id}`).
4. **The save goes on.** It is bound to its row, so it lands on the first mapping even if its answer arrives after the
   unmount. It is never sent "for the current selection", which is the prototype's bug (`insChange` read `V.sel`).
5. **If a later change ever selected on `pointerdown`** (before the blur), the panel would unmount with the field
   focused. InfoCube's rule has `keep` and would keep its draft for that mapping. InfoMapper's rule has no `keep` and
   would lose the typed text silently, but would still never save it elsewhere.

**Verdict:** the app does not have the bug; no `fix/…` branch is needed. A cheap guard: one spec in slice 20
(`S20-Q10.spec.ts`: the three clicks after typing in each rule, the rule stored on the first mapping only). Question 10
also asks whether InfoMapper's rule should get `keep`, as InfoCube's has. That would be a later small item, not this
slice.

### Q11. InfoCube off

The switch can be turned off only without facts and dimensions (C-7 as changed), and while it is off nothing creates or
brings back a dimensional entity. Then:
- the module's checks return nothing (`pageModuleChecks` while the Cube tab is absent; `moduleHomeData` while there is
  no fact or dimension);
- the home's sentence has no " and InfoCube" and its empty text no ", and so do facts and their feeds" (F4);
- there are no module groups, marks or panel lines.

InfoCube on with no rows gives the sentence with "and InfoCube" and no lines. A workspace without InfoCube rows reads no
module table on the home (as `moduleFeeds`).

### Q12. Where the counts depend on coverage, and the numbers

- **`under` reads D-31's coverage** through `lookupModel.coverageOf` (F12). So it moves when:
  - a logical attribute's source mapping is approved, sent back to review, or gets a type conflict;
  - a source column leaves the source;
  - a calculated input's inputs change (D-73).
  `feeds` reads `hasTypeConflict` only. Nothing else depends on coverage.
- **The demo, by reading** (slices 15, 18 and 19 and the checks step; step 2 checks it with a unit test on the
  composed seed):

  | Where | wrong | dup | calc | norel | nokey | facts | feeds | under | total |
  | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
  | Order management's home | 1 | 1 | 1 | 1 | 1 (Country – Customer Address, either way of F1) | 0 | 0 | 10 | 15 |
  | Customer 360's home | 1 | 0 | 1 | 0 | 0 | 0 | 0 | 7 | 9 |
  | "Customer & orders" (status bar) | 1 | 0 | 1 | 0 | 0 | 0 | 0 | 7 | 9, orange |
  | "Order lines & products" | 0 | 1 | 0 | 1 | 0 | 0 | 0 | 7 | 9, grey |
  | "Sales star" | 1 | 1 | 1 | 1 | 1 | 0 | 0 | 10 | 15, orange |

  The 10 `under` lines are the approved feeds whose logical input has no approved source mapping:
  - Fact Sales: customer_key (from Sales Order.customer_id, not mapped), product_key (from Order Line.product_id, Draft
    only), quantity, unit_price and discount_pct;
  - Fact Orders: customer_key;
  - Dim Customer: segment_code;
  - Dim Product: sku, product_name and category_code.
  Dim Customer.country_name is a Draft lookup since slice 18, so it is no line, which is how the prototype's 10 come
  out. `facts` is 0: both facts have a grain and their keys carried, and Dim Date's two roles are named. Without the
  `under` lines the canvases would count 2, 2 and 5.
- **KB:** not read in this step (no runs). Question 12.

### Differences between the prototype and the app that the slice touches

| # | Prototype | App now | Proposal |
| --- | --- | --- | --- |
| P1 | "Copy of" field, `copyOf` and `copyLabel` | slice 10c's copies, "Copied from" in the attribute panel (D-63) | nothing to build (PRD) |
| P2 | `cmTypeIssue`: Integer → Decimal passes, a lookup is skipped | `hasTypeConflict` (F11) | the app's rule (PRD) |
| P3 | `srcOk`: the direct rule, three texts | `coverageOf` with calculations and type conflicts (F12) | the app's rule, five texts |
| P4 | "wrong way" also in the relationship's panel | — | as the prototype (F14, question 7) |
| P5 | `lost` and `norel` logical only | — | `lost` both levels, `norel` logical (F6, question 6) |
| P6 | a copy's first link only | copies of copies (D-63) | the key at the end of the chain (F5, question 5) |
| P7 | `CHK_NAME`: trim, collapse spaces, lower case | no attribute rule; entities: case only | `nameKey` as the prototype (F2) |
| P8 | the panel's group: 20 lines and "Show all" | `LongList`: a filter and "Show all" over 20 (D-35) | `LongList` (F16) |
| P9 | the home: 20 lines per group, "Show all {n}" / "Show the first 20" | consistency lists every line (`known-limitations.md`) | as the prototype, a small client toggle per group |
| P10 | the row's "!" on `.dt::before` | Σ on `.dt::before` | `.dt::after` put first (F8) |
| P11 | `goCheck` without a canvas shows the entity: stays on the home's canvas | consistency opens the project's first canvas | the project's first canvas, selected as an element (F17) |
| P12 | the name has no title, so the header's title shows everywhere on it | the name has its own title | the checks' title on the "!" and the line's empty parts; the name keeps its title (F7) |
| P13 | checks recomputed on every render | computed per page load | per page; marks change with a write's fresh page (F22) |
| P14 | `checksDemo` on every load, once | — | a seed step (F23) |
| P15 | `INS_SWAP` saves a left field into the item its panel showed | already the app's behaviour (Q10) | nothing to build |
| P16 | "no copied key" counts copies only | — | question 1 (F1) |

### New user-facing texts (for approval)

All are the prototype's unless marked.

| Where | Text |
| --- | --- |
| Group titles (short labels) | Keys copied the wrong way (wrong way) · Approved feeds broken by the logical model (type conflict) · Duplicate attribute names (duplicate name) · Calculated and mapped (calculated and mapped) · Copies whose original was deleted (original deleted) · Keys copied without a relationship (no relationship) · Relationships without a copied key (no copied key) · Facts to check (fact hint) · Approved feeds over logical attributes not yet covered (input not covered) |
| Group hints | **dup** Two attributes of one entity share a name, ignoring case and extra spaces. Rename or delete one. (**changed:** "extra spaces", F2) · **calc** A calculated attribute takes its value from its inputs. Keep the calculation or the mapping, or say in the rule why both. · **lost** The copy keeps its type, but nothing updates it any more. Stop following, or undo the delete. · **norel** A copied key stands for a relationship. Relate the two entities, or delete the copy. · **wrong** A foreign key belongs on the many side of its relationship. Copy the key of the one side instead. · **nokey** The many side should hold a copy of the one side's primary key. Copy it, or check the cardinality. · **facts** The hints from each fact's panel, for the whole project. · **feeds** The type of a logical attribute no longer fits an approved dimensional mapping that reads it. Fix the logical side, or set the mapping back to In review. · **under** The dimensional mapping is approved, but what it reads has no approved source mapping, so it covers no requirement yet. |
| Lines (name · detail) | **wrong** {Entity}.{attribute} · copy of {E}.{a}, but {Entity} is the one side of “{verb phrase}” (“the relationship” without one) · **dup** {Entity}: {names, ", "} · {n} attributes, one name · **calc** {Entity}.{attribute} · calculated from {n}, also {k} mapping / mappings / feed / feeds · **lost** {Entity}.{attribute} · copy of {E}.{a}, which was deleted · **norel** {Entity}.{attribute} · copy of {E}.{a}; {Entity} and {E} are not related · **nokey** {one} – {many} ({verb phrase}) (no brackets without one) · {many} has no copy of {missing keys, ", "} (**changed:** the missing ones only) · **facts** {fact} · the hint's text · **feeds** {E.a} + {E.b} → {E.t} · type conflict: {E.a} is {T}, {E.t} is {T} · **under** the same name · per input, "; ": {a} reads a column that left the source / {a}'s approved source mapping has a type conflict (**new**) / an input of {a}'s calculation is not covered (**new**) / {a} has no approved source mapping / {a} is not mapped |
| Home section | **Model checks** with the count badge · "What the model itself says, for the entities on this project's canvases: names, calculations, copied keys{ and InfoCube}. Computed when this page opens; nothing is stored or changed." · tags **High**, **Normal**, **InfoCube** · **Show all {n}** / **Show the first 20** · empty: "Names, calculations and keys agree{, and so do facts and their feeds}. Nothing to look at." |
| Home stats | "! {n} model check" / "model checks", title "Go to Model checks" |
| Status bar | "Model checks {n}", title "Show the model checks for the cards on this canvas" |
| Overview group | **Model checks** · "For the cards on this canvas. Click one to select it." · each line: "!", the name, the short label, title "{group}: {detail}" · the filter and "Show all" as D-35 (`LongList`) |
| Panel box | **Model checks** {n} · "**{group}.** {name}: {detail}" (an attribute's own line: the detail only) · "1 hint in the Fact section below." / "{n} hints in the Fact section below." |
| Mark titles | "Model checks: {n}", then up to six "{group}: {name}" (a fact hint: "{group}: {hint}"), then "…" |

### Earlier specs and tests each item touches

| Item | Earlier specs and tests | Expected change |
| --- | --- | --- |
| 1, 2 (home) | `S7B-13`, `S7B-14`, `S7B-15`, `S7B-16-changes` (consistency and its links), `S0-02`, `S0-04`, `S0-07`, `S5A-02`, `S12A-05`, `S12A-07`, `S12A-11`, `S14B-10`; measuring `S12B-10`, `S12B-bytes` | none with F1 (b), since the plain seed has no lines; with (a), every home in the plain seed has the section and the stats' link, and specs that read the home as a whole are checked. `S12B-10` and `S12B-bytes` are read again: the home computes more and has a new section |
| 3 (marks) | `S1A-05`, `S1B-12`, `slice-02a/helpers.ts`, `S4B1-06`, `S4B1-07`, `S4B1-08`, `S4B2-07`, `relationship-ends` (they press or measure `.c-l2`); `S15-08` (Σ's `::before`); `S15-22` (hovers `.dt`); `S11-*` (clips); `S3B-15-elements`, `S2C-12`, `S3A-14-idle`, `S3B-15-idle`, `S15-layers`, `S15B-layers`; unit `canvas.test.ts`, `text-fit.test.ts`, `card-names.test.ts`, `tests/thumbnail-heights.test.ts` | none expected (no element, the header's size unchanged); with F1 (a), cards in the plain seed carry marks and the clip of a long name may move |
| 4 (status bar) | `S6A-07` (the span list), `S1A-*` and `S7B-*` (status texts by test id) | none: the count is a button |
| 5 (Overview) | specs reading `inspector-overview`'s folds (coverage, notes, frames, look) | none: a fold between two others |
| 6 (panels) | specs that read a panel's first field or its buttons by name | none expected; with F1 (a), Sales Order's, Order Line's and Customer Address's panels have the box in the plain seed |
| 7 (demo) | `e2e/slice-19/fixtures.ts`, `tests/infocube-types.test.ts` | moved to `addTypesDemoData` (F23) |
| arrivals (F17) | `S7B-15` (`?map=`, `?row=`), `S6B-*` (places) | none: new addresses only |

Steps 2 and 3 list every test actually changed, with its reason.

### Questions for Łukasz

1. **"No copied key" (F1):** (a) strict as the prototype, so the plain seed and likely KB show a line for every 1:N
   relationship with a hand-typed key; or (b), my recommendation, a foreign key of the many side with the primary key's
   name counts as its copy, the demo's example then made by taking the foreign-key flag off Customer
   Address.country_code?
2. **Duplicate names (F2, Q8):** trimmed, runs of spaces collapsed, case ignored, per entity at both levels, and the hint
   "ignoring case and extra spaces"?
3. **The row mark beside Σ (F8):** "!" first, then Σ, then the type, CSS only?
4. **`under` in the status bar (F25, Q12):** count it, as the prototype does, so the count equals the panel's list (the
   demo's canvases 9, 9 and 15)? Or leave it out of the count and the panel's group, so a count means a mark (2, 2 and
   5)? I recommend counting it.
5. **Copies of copies (F5):** read a copy's key at the end of its chain?
6. **Levels (F6):** `dup`, `calc` and `lost` at both levels; `norel`, `wrong` and `nokey` at the logical level?
7. **"Wrong way" in the relationship's panel too (F14),** as the prototype?
8. **"Not yet covered" (F12):** the two new texts and their order?
9. **Addresses (F17):** `?entity=`, `?rel=` and `?ext=<kind>:<id>`, and the project's first canvas when no canvas shows
   the line's entities?
10. **Q10:** no fix branch. Should slice 20 add the guard spec `S20-Q10`? Should InfoMapper's rule get `keep`, as a later
    small item in `ideas.md`?
11. **The demo (F23):** `addChecksDemo` in "Retail Co – DWH" only, slice 19's fixtures moved to `addTypesDemoData`, and
    the PRD's S20-01 counts as the table in Q12?
12. **KB (Q12):** may step 2 count KB's lines with a read-only script on a backup copy (`.data/backups/`), printing
    counts only?
13. **Bench bar:** 20 ms for the rules and the index on the synthetic 20,000-attribute model?
14. **The full run in step 3:** see the plan.

### Plan for steps 2–4

**Step 2. Rules and index** (domain and data only; nothing on a page; small commits).
1. `src/domain/model/checks.ts`:
   - the types, `nameKey`, the copy chain and `projectScope`;
   - the six rules, `modelChecks` and its order, `checkIndex`, `markTitle` and `coverageGapText`;
   - `CHECK_TEXTS`.
   The requirement index exposes its lookup.
2. `src/modules/infocube/domain/checks.ts`: `facts`, `feeds` and `under`.
3. `src/compose/checks.ts` (`pageModuleChecks`) and `moduleHomeData` in `compose/view.ts` (F19).
4. The seed step `addChecksDemo`, `addChecksDemoData`, `addTypesDemoData` and slice 19's fixtures moved (F23). It is
   in step 2 so the rules' tests read the demo.
5. Unit tests:
   - every rule and its edges: levels, self relationships, 1:1, M:N, a composite key, a copy of a copy, a lost link on
     the way, an original's entity deleted, spaces and case, a calculation with no inputs, a transformation with a rule,
     a lookup, Integer → Decimal, the five "not yet covered" texts and the project's scope;
   - InfoCube off;
   - the composed seed's counts (the table in Q12).
6. `scripts/bench-checks.ts` (synthetic, "Performance test", the demo) against the bar; KB's counts if allowed
   (question 12).
7. CI: lint, typecheck and unit tests. Step 2 changes no page, so it runs no e2e spec beyond the slice-19 fixture's
   specs for the moved export (`S19-*`). No shared infrastructure, so no full run.

**Step 3. Home, canvas and panels.**
1. The home's section and the stats' link; arrival addresses (`?entity=`, `?rel=`, `?ext=`) and their centring.
2. The card marks: `CardData.check`, `CardRow.check`, `buildCards`, `CHECK_MARK` in `text-fit.ts` and the CSS.
3. `ChecksProvider`; the status bar's button; `checksJump`; the Overview's group (`LongList`, the fold opened, the
   flash).
4. `ChecksBox` in the entity, attribute, relationship and dimensional mapping panels.
5. `e2e/slice-20/` with its fixtures (`addFullDemoData`): S20-01 … S20-06 (and S20-Q10 if wanted). Slice 20 goes into
   the last part.
6. The checks and readings:
   - the touched earlier specs;
   - the element guard on "Performance test" and the Sales star;
   - a LayerTree read (F9);
   - the commit counters: S2C-12, S3A-14-idle, S3B-15-idle, and the status bar's click;
   - the canvas page's and the home's added bytes;
   - one measuring sitting against `slice-19`: pan and zoom, and a write that adds and removes a mark.
7. **Shared infrastructure?** By CLAUDE.md's list, no: undo, change groups, the save chain, the canvas's layers, the table
   registry and the local adapter are untouched. Cards change markup only by a class and a title. **Recommendation:** no
   full run in step 3 with F1 (b), since earlier specs' pages do not change. With F1 (a), every earlier canvas page
   changes, so one full run in step 3 is the safe choice.

**Step 4. Close.** The docs, with D-75's text quoted for approval:
- `decisions.md` (D-75; AD-34's sentence);
- `ideas.md` (the validator's entry done; section 9 as later; the rule's `keep` if question 10 says so);
- `inventory-prototype-vs-app.md`;
- `known-limitations.md` (marks change with a write's fresh page; checks fresh on each load of the home);
- README and CLAUDE.md (status, the extension point `ModuleChecks` and `moduleHomeData`, `ChecksProvider`, the addresses).
Then one full run on the final commit and the manual acceptance steps. Merge and the tag `slice-20` only on Łukasz's
command.

## Łukasz's answers to step 1 (8 November 2026)

1. **"No copied key" (F1): (b).** On the many side, a foreign key with the primary key's name (trimmed, case ignored)
   also counts, beside a copy (followed to the end of its chain). The demo's example: the foreign-key flag taken off
   Customer Address.country_code.
2. **Duplicate names (F2):** yes. Trimmed, runs of spaces collapsed, case ignored, per entity, both levels; the hint says
   "ignoring case and extra spaces".
3. **The row mark beside Σ (F8):** yes. "!" first, then Σ, then the type; CSS only, no element.
4. **`under` (F25):** counted in the status bar and in the panel's group.
5. **Copies of copies (F5):** yes.
6. **Levels (F6):** yes.
7. **"Keys copied the wrong way"** is also in the relationship's panel, as in the prototype (F14).
8. **"Not yet covered" (F12):** the texts and their order as proposed.
9. **Addresses (F17):** yes, provided every new address is a history place (D-38) and says so when its object is gone
   (`GONE`), as `?map=` and `?row=` do.
10. **Q10:** (a) yes, a guard spec `S20-Q10` in step 3. (b) yes, an entry in `docs/ideas.md`.
11. **The demo (F23):** yes, provided `addChecksDemo` runs only in the seed, the reset, `npm run demo` and slice 20's
    fixtures, never in the earlier slices' fixtures (the plain e2e seed, slices 15 and 18). S20-01's numbers are
    recounted after answer 1.
12. **KB:** yes, on a copy of `.data/backups/kb-model-latest.json`, never `.data/dev-db.json`. The script writes nothing
    and prints counts per group and per project only, no names.
13. **Bench:** 20 ms, Node median, on the synthetic model; "Performance test" and the demo reported without a bar. If it
    is over, report before optimising.
14. **No full run in step 3.** If more earlier specs change than this document lists, stop and ask.
