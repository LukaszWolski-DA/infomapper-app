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

## Step 2: rules and index (8 November 2026)

### What changed

- **InfoMapper's rules and the index** (`src/domain/model/checks.ts`, pure). The six groups and their texts
  (`CHECK_TEXTS`):
  - `wrong` (High), then `dup`, `calc`, `lost`, `norel` and `nokey`;
  - `nameKey` (trimmed, runs of white space as one, case ignored);
  - `keyOfCopy`: a copy's key at the end of its chain; a lost link or a cycle gives none;
  - `oneAndMany`: from `from_max` and `to_max`; 1:1 and M:N give none, and self relationships are skipped;
  - `projectScope`: the entities with a live card on the project's canvases.

  `modelChecks` puts High first, InfoMapper's groups before the modules' within a severity, and drops empty groups.
  `checkIndex` reads the lines by panel ref, by mark and by canvas:
  - an entity's panel also lists its attributes' lines;
  - a row's mark also marks its header;
  - fact hints are counted (`hintsOf`), never listed.

  `markTitle` and `coverageGapText` are the five "not yet covered" texts in their order. The requirement index exposes
  its `lookup`, so the checks make no second pass over the model.
- **"No copied key" (answer 1 (b)).** On the many side, a copy of the key (at the end of its chain) counts, or a foreign
  key whose name is the key's by `nameKey`. That also collapses runs of inner spaces, beyond the answer's "trimmed,
  case ignored", so a name means the same here and for duplicates.
- **InfoCube's rules** (`src/modules/infocube/domain/checks.ts`):
  - `cubeChecks` gives `feeds` (High), `facts` and `under`, with the module's own texts, its tag, its topic
    ("InfoCube") and its empty-text part ("so do facts and their feeds");
  - built on `cubeIndex`, `factHints`, `mappingIndex`, `hasTypeConflict`, `typesDiffer` and InfoMapper's
    `coverageGapText`;
  - a dimensional mapping is `{ t: "ext", kind: "cube_mapping" }`. The kind is a constant in the module's domain (it
    may not import its canvas part), and a test keeps it equal to `CUBE_MAPPING_KIND`.
- **The extension point** (`src/compose/checks.ts`). `cubeModuleChecks(on, rows, input)`, and `pageModuleChecks(view,
  input)` for a canvas page, from `ModuleView.data`, only while the Cube tab is there. InfoMapper's code never names
  the module.
- **One read on the home** (`moduleHomeData` in `src/compose/view.ts`, F19). One read of the five InfoCube tables, which
  returns `rowFeeds`, `feeds` and `checks(input)`. Nothing is read without a fact or a dimension. The project home now
  uses it for its feeds; it shows no checks yet (step 3). `moduleFeeds` stays for the workspace home and the
  source-change action.
- **The shell's workspace has `infocube`** (`src/app/_lib/shell.ts`). The home's checks need the switch.
- **The demo** (`src/data/local/seed-checks.ts`, `addChecksDemo`; `src/compose/seed.ts`):
  - `addChecksDemoData`, in "Retail Co – DWH" only;
  - `addTypesDemoData` (what `addFullDemoData` was);
  - `addFullDemoData` = `addTypesDemoData` + checks, for the seed, the reset and `npm run demo`.

  Slice 19's fixtures and `tests/infocube-types.test.ts` read `addTypesDemoData`. The plain e2e reseed and slices
  15's and 18's fixtures are unchanged.
- **Tests:**
  - `src/domain/model/checks.test.ts` (20): every rule and its edges, as listed in the plan;
  - `tests/model-checks.test.ts` (13): the composed demo and the plain seed; S20-01's three changes as the rules see
    them; InfoCube's Integer → Decimal, a transformation with a rule, an approved lookup and a draft; the scope through
    inputs; InfoCube off.
- **Scripts:**
  - `scripts/bench-checks.ts`;
  - `scripts/count-checks.ts`: read-only, refuses `dev-db.json`, prints counts only;
  - `scripts/lib/checks-model.ts`.

### The demo, recounted after answer 1

Unit tests confirm the numbers by reading. With answer 1 (b) the plain e2e seed has **no line** (its hand-typed
foreign keys carry the keys), so no earlier spec's data changes. Slice 19's fixture data has only the star's 10 `under`
lines, as before slice 20.

| Where | wrong | dup | calc | norel | nokey | under | total |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Order management's home | 1 | 1 | 1 | 1 | 1 (Country – Customer Address) | 10 | **15** |
| Customer 360's home | 1 | 0 | 1 | 0 | 0 | 7 | **9** |
| "Customer & orders" | | | | | | | **9**, orange |
| "Order lines & products" | | | | | | | **9**, grey |
| "Sales star" | | | | | | | **15**, orange |

### The bench (`npx tsx scripts/bench-checks.ts`; Node, laptop; 9 rounds after a warm-up)

| Model | Size | Lines (JSON) | Checks and index, whole model | Bar |
| --- | --- | --- | --- | --- |
| Synthetic | 2,000 entities, 23,000 attributes, 2,000 relationships, 3,000 copies, 3,000 source and 1,500 dimensional mappings | 4,296 (1.84 MB) | **median 120.8 ms** (fastest 103.0, slowest 200.3) | 20 ms **missed** |
| Synthetic, a project of 200 entities | | | median 72.1 ms | — |
| "Performance test" | 41 entities, 779 attributes, 40 relationships | 21 `nokey` (10 KB) | median 1.6 ms | none |
| Demo | 13 entities, 72 attributes, 19 dimensional mappings | 15 (7 KB) | median 0.5 ms | none |

The lookup is the requirement index's, built anyway, and is not counted: 22.8 ms on the synthetic model.

**Not optimised, as you asked.** A one-off split on the synthetic model (diagnosis only, not kept): InfoMapper's groups
about 80 ms, InfoCube's about 58 ms, the index about 16 ms. The likely costs:
- InfoMapper: `nokey`'s key test runs `keyOfCopy` and `nameKey` again for every key against every attribute of the many
  side;
- InfoCube: building its own two indexes, sorting 23,000 attributes by string, and a `coverageGapText` per input;
- the index: one title per mark.

The synthetic model is also far denser in lines than any real one (about one line per five attributes; KB has 24 on 190
attributes). Its 1.84 MB of lines is the larger question for step 3, where a canvas page carries them to the browser.

### KB, read-only (`scripts/count-checks.ts` on a copy of `.data/backups/kb-model-latest.json`)

The copy's SHA-256 was the same before and after the run. The copy was deleted afterwards. Workspaces and projects are
numbered, not named:

| Workspace | Size | Whole model | Projects |
| --- | --- | --- | --- |
| W1 | 6 entities, 34 attributes, 5 relationships; InfoCube off | 0 | P1 0, P2 0 |
| W2 | empty | 0 | P1 0 |
| W3 | 6 entities, 34 attributes, 5 relationships; InfoCube off | 0 | P1 0 |
| W4 | 29 entities, 190 attributes, 32 relationships; InfoCube on | **24**: `nokey` 6, `facts` 18 | P1 (all 29 entities): 24 |

W4 is the only workspace of KB's size. **The two duplicate names slice 17 found (2 of 258) are not in this backup.** It
has 190 live attributes, so either the backup is older or newer than that count, or the two were renamed. I cannot tell
which without names. The manual acceptance will look at it in the app.

### Differences from step 1's plan

1. **The bench missed its bar** (above); nothing optimised.
2. **The shell's workspace gained `infocube`,** and the project home already reads through `moduleHomeData`. Neither
   was in the plan; neither shows anything new.
3. **The name test for "no copied key" uses `nameKey`** (also collapses inner spaces).
4. **The selection kind is a constant in the module's domain**, kept equal to the canvas's by a test (the domain may
   not import the canvas part).

### Checks

- `npm run lint`, `npm run typecheck`: pass.
- `npm test`: 157 files, 1,929 tests, all pass.
- e2e: `e2e/slice-19` (its fixture's export renamed; same data): 11 passed (2.9 min), run locally once (`npm run e2e -- e2e/slice-19`). Not a full run (step 2 touches no shared infrastructure).

### How to check

- `npx vitest run src/domain/model/checks.test.ts tests/model-checks.test.ts`
- `npx tsx scripts/bench-checks.ts`

## Łukasz's decisions on step 2 (8 November 2026)

1. **The 20 ms bar stays.** Remove the three causes found, and nothing else:
   - "no copied key"'s key test once per entity;
   - InfoCube's rules on the existing indexes, without sorting every attribute;
   - no mark titles in the index.
   Measure again. If the synthetic model is still over 20 ms but under 50 ms, stop and report.
2. **No ready-made lines with texts on the canvas page.** The canvas builds the index in the browser from what the page
   already has (as `requirementFeeds`): marks are classes, and texts are built when a panel or the list opens. The
   project home renders only its scope's lines on the server, 20 per group, the rest on "Show all" (D-35). Check what
   the canvas page has, and add one browser figure on the synthetic model, with no gate.
3. **Accepted as differences from the plan:** the name test collapsing runs of spaces, the InfoCube switch in the shell's
   workspace data, and the module's mapping-kind constant kept equal by a test (below).
4. **KB:** Łukasz makes a fresh backup himself; the recount runs on its copy when he says so, under the same conditions.

## Step 2 continued: the three causes removed (8 November 2026)

### What changed

- **"No copied key"** (`checks.ts`):
  - each copy's key is worked out once per page (`copyKeys`), for all the rules that read it;
  - what an entity holds of other entities' keys (its copies' keys and its foreign keys' names) is worked out once per
    entity (`carriedBy`), not once per key and attribute.
- **InfoCube's rules** (`infocube/domain/checks.ts`):
  - `feeds` and `under` read the requirement index's lookup: its feeds are the dimensional mappings, with their
    approval, type conflict and inputs (`cubeRequirementFeeds`);
  - the targets come in the model's order (`lookup.attributesOf` per dimensional entity), so nothing is sorted and no
    second mapping index is built;
  - `cubeChecks` takes an existing `CubeIndex` when its caller has one (third argument).
  So InfoCube's lines need a lookup built with the module's feeds, as every page builds it.
- **The index:**
  - `entityMark` and `rowMark` give only the severity (`{ high }`);
  - `entityLines` and `rowLines` give the lines behind a mark, for `markTitle` where the card is drawn.
- **The benches:**
  - the synthetic model is shared (`scripts/lib/synthetic-checks.ts`);
  - `scripts/bench-checks-browser.ts` bundles the same code with esbuild and runs it in headless Chromium.

### The figures, before and after (Node median, laptop; the lookup not counted)

| Model | Step 2 | After the three causes | Bar |
| --- | --- | --- | --- |
| Synthetic, whole model | 120.8 ms | **107.6 ms** (fastest 93.3) | 20 ms, **missed** |
| Synthetic, a project of 200 entities | 72.1 ms | 46.8 ms | — |
| "Performance test" | 1.6 ms | 1.9 ms | none |
| Demo | 0.5 ms | 0.4 ms | none |
| **Browser:** synthetic, whole model, Chromium 153 headless | — | **60.0 ms** (fastest 46.7, slowest 82.0); the lookup 13.3 ms | no gate |

**It is over 50 ms, so I stopped, as decided.** Step 2's split of InfoMapper's groups was wrong. A split after the change
(diagnosis only, not kept) shows where the time is:

| Part | Time |
| --- | --- |
| InfoMapper's groups | 69 ms |
| InfoCube's groups | 24 ms; 14 ms with a cube index passed in (building one takes 9.5 ms) |
| The index | 16 ms |

The causes left in InfoMapper's groups are spread out, none above about 12 ms:
- maps of entities and attributes rebuilt (9 ms), which the lookup already has (`lookup.attribute`,
  `lookup.attributesOf`);
- the attributes grouped and sorted per entity again (3.5 ms);
- the duplicate rule computing `nameKey` three times per attribute (12 ms; once would be 3.6 ms);
- the copies' keys (5 ms);
- building about 2,000 lines with their texts.

The index's 16 ms is its loops over 4,296 lines. The cost grows with the number of lines, and the synthetic model has
one line per five attributes. "Performance test" has 21 lines, the demo 15 and KB 24.

**Not done** (outside the three causes):
- InfoMapper's groups on the lookup's maps, and `nameKey` once per attribute (estimated −20 ms);
- one cube index shared by the page's sections and the checks (−10 ms).
Even with both, the estimate is about 70 ms on the synthetic model.

### Point 2: what the canvas page already has

**Everything the rules read is on the canvas page already, so it carries 0 bytes more.**
- **The whole model.** The page hands the live `WorkspaceModel` to the browser for the Inspector, the StatusBar and the
  fading (`fadeData.model`, `canvas page.tsx` l. 245, 278, 332). It has `entities`, `attributes`, `relationships`,
  `attributeInputs`, `mappings`, `mappingInputs`, `sourceColumns` and `lostOriginals`, which are all the
  `CheckModel` and the lookup read.
- **InfoCube's rows.** `ModuleView.data.infocube` (`cubePageRows`) carries `cubeEntities`, `cubeMeasures`, `cubeKeys`,
  `cubeMappings` and `cubeMappingInputs` whenever the model has a fact or a dimension. The InfoCube switch is
  `ModuleView.tabs` (the Cube tab only while it is on), which `pageModuleChecks` reads.
- **The requirement feeds and the lookup.** `ModulesProvider` derives the feeds in the browser (`requirementFeeds`),
  and the Inspector builds its requirement index from them; the index now exposes its `lookup`.

**For step 3:**
- one requirement index per page in a provider that the Inspector, the status bar and the checks share, so the lookup
  is not built twice;
- the cards' classes read from the index, which client components also compute during the server's render, so the
  first paint has them;
- the project home renders the first 20 lines per group on the server; "Show all" reads the rest through a read
  action (as the bus matrix's `modelRead`).

### Differences from the plan (accepted, Łukasz's point 3)

1. **The name test for "no copied key" is `nameKey`.** It trims, collapses runs of white space and ignores case: one
   rule shared with duplicate names. D-75 will say so.
2. **The shell's workspace data carries the InfoCube switch** (`ShellData.workspace.infocube`), which the home's checks
   read.
3. **The mapping-kind constant is in the module's domain** (`CHECK_MAPPING_KIND`, `"cube_mapping"`). A test keeps it
   equal to the canvas's `CUBE_MAPPING_KIND`, because the domain may not import the module's canvas part.

### Checks

- `npm run lint`, `npm run typecheck`: pass.
- `npm test`: 157 files, 1,929 tests, all pass (the index's tests read titles through `markTitle`).
- GitHub's CI (`ci.yml`) runs on pull requests and on `main` only. Slice 20 has no pull request yet, so CI has not run
  on GitHub; its three jobs (lint, typecheck, unit tests) pass locally on the pushed commit.

### How to check

- `npx tsx scripts/bench-checks.ts`
- `npx tsx scripts/bench-checks-browser.ts`

## Łukasz's decisions on step 2 continued (8 November 2026)

1. **Remove the remaining duplicated work:**
   - reuse the requirement lookup's maps and per-entity lists;
   - normalise each name once;
   - one cube index, passed in where the caller has one.
2. **Split marks from texts.** After a write the browser computes only the marks (per element its severity and its
   groups) and the counts. Lines with their texts are built only where they are shown:
   - the home's section;
   - the panel group;
   - an element panel's section;
   - a card's title.
   The rules may return compact references.
3. **The bars:**
   - marks and counts: 20 ms in Chromium on the synthetic model, the lookup apart;
   - the project home's whole computation, lines included: 50 ms in Node;
   - "Performance test" and the demo reported without a bar.
   If the marks are still over 20 ms in Chromium, stop and report the split; add no deferred or incremental
   computation.
4. **A draft pull request** so CI runs on every push; no `full-e2e` label, no E2E workflow.

## Step 2 continued, second round: marks apart from texts (8 November 2026)

**Draft pull request:** https://github.com/LukaszWolski-DA/infomapper-app/pull/47 (no label, no E2E run).

### What changed

- **Items, not lines** (`checks.ts`):
  - a rule gives `CheckItem`s: what it opens, the panels that list it, its marks, the entities it names, a fact
    hint's fact, and `text()`, which builds its name and detail only when called;
  - `lineOf(item)` is the item with its words, where it is shown;
  - `CheckGroup.items` replaces `lines`;
  - InfoCube's items do the same: a type conflict's detail and the "not yet covered" words are built in `text()`;
  - whether an input is covered is read from `lookup.coverageOf`, without words.
- **No rebuilt maps:**
  - InfoMapper's rules read `lookup.attribute` and `lookup.attributesOf` (the model's order), with no map or sort of
    their own beyond the entities';
  - one pass over the attributes in scope serves duplicate names, calculated and mapped, lost originals and keys
    without a relationship;
  - each name is normalised once and each copy's key worked out once (`nameKeys`, `copyKeys`);
  - the cube index is passed in: `cubeChecks`' third argument, `cubeModuleChecks` and `pageModuleChecks` take it;
  - the benches build it apart, as the page's sections do.
- **The index** (`checkIndex(checks, entityOf)`):
  - at once: the marks (`{ high, groups }` per entity and per row), `count`, `high` and `countOn(entityIds)`;
  - on the first call: every list (`all`, `panel`, `hintsOf`, `entityItems`, `rowItems`, `onCanvas`);
  - `markTitle(items)` builds a title's words when the card is drawn;
  - a test checks that the marks, the counts and a panel's list build no text.
- **The benches:**
  - `bench-checks.ts` times the lookup and the cube index apart, the marks and counts, and the home with every line's
    words (bar 50 ms);
  - `bench-checks-browser.ts` times the same in Chromium (bar 20 ms for the marks), with a split of its parts.

### The figures

Medians on the laptop; the lookup and the cube index are apart.

| Measure | Before this round | After | Bar |
| --- | --- | --- | --- |
| **Chromium: marks and counts**, synthetic (a canvas after a write) | 60.0 ms (checks and index with texts) | **19.2, 23.4, 22.1, 21.8, 21.8, 31.6 ms** in six sittings | 20 ms: **met once, missed five times** |
| Chromium: every line with its words | — | 20.2–22.1 ms | none |
| Chromium: the lookup / the cube index | 13.3 ms / — | 11.4–13.0 ms / 4.8–5.5 ms | apart |
| **Node: the home, every entity in scope, lines included**, synthetic | 107.6 ms (whole model) | **44.2 ms** | 50 ms: **met** |
| Node: the home, a project of 200 entities, lines included | 46.8 ms | 12.4 ms | — |
| Node: marks and counts, synthetic | — | 46.3 ms | none (the bar is Chromium's) |
| Node: the lookup / the cube index | 24.5 ms / 9.5 ms | 23.5 ms / 10.3 ms | apart |
| "Performance test": marks and counts / the home | 1.9 ms | 0.7 ms / 0.7 ms | none |
| Demo: marks and counts / the home | 0.4 ms | 0.2 ms / 0.2 ms | none |

The synthetic model has 4,296 lines; "Performance test" 21, the demo 15. Node on this laptop is noisier than Chromium.
Node's marks (46 ms) came out above its home with lines (44 ms) in the same sitting.

### The marks are still over 20 ms in Chromium: the split (three sittings, medians)

| Part | Sitting 1 | Sitting 2 | Sitting 3 |
| --- | --- | --- | --- |
| InfoMapper's rules | 15.2 ms | 16.3 ms | 16.2 ms |
| InfoCube's rules (cube index passed) | 3.2 ms | 2.5 ms | 3.4 ms |
| The marks (`checkIndex`) | 1.4 ms | 1.4 ms | 2.1 ms |
| One canvas's count (`countOn`) | 0.3 ms | 0.3 ms | 0.4 ms |
| **Marks and counts, as one** | **21.8 ms** | **21.8 ms** | **31.6 ms** |

InfoMapper's rules are three quarters of it. They make one pass over 23,000 attributes and 2,000 relationships and build
about 2,000 items. As decided, I stopped here: nothing is deferred or computed incrementally.

### Checks

- `npm run lint`, `npm run typecheck`: pass.
- `npm test`: 157 files, 1,930 tests, all pass (one new: no text for marks and counts).
- CI on the draft pull request: see the report in chat.

### How to check

- `npx tsx scripts/bench-checks.ts`
- `npx tsx scripts/bench-checks-browser.ts` (prints the split)

## Step 2 closed (8 November 2026)

- **CI** on `34fde18` (draft pull request #47): CI and Schema passed.
- **The marks' bar becomes a reference** (Łukasz): in Chromium the marks and counts on the synthetic model are a
  reference of **25 ms**, the median of six runs' medians. It is reported at the closing and is not a gate. The six
  runs: 19.2, 23.4, 22.1, 21.8, 21.8 and 31.6 ms (the median of the six is 22.0 ms, under the reference). The split
  (three runs): InfoMapper's rules 15.2–16.3 ms, InfoCube's rules 2.5–3.4 ms, the marks 1.4–2.1 ms, one canvas's count
  0.3–0.4 ms.
- `docs/known-limitations.md`: "The marks cost about 22 ms after each write on a very large model". `docs/ideas.md`:
  "Model checks for much larger models" (deferred and incremental).
- Auto-fix stays off.

## Step 3: home, canvas and panels (8 November 2026)

### What changed

- **One requirement index and one check index per canvas page** (`ModulesProvider`, `src/app/_components/modules.tsx`):
  - the page now gives it its requirements and links;
  - it builds the requirement index and, from it, the check index (`pageCheckIndex` in `src/compose/checks.ts`: the
    whole model, the module's rows, one cube index), once per data version in the browser, with no bytes added;
  - the canvas (`useRequirementIndex`) and the details panel (`Inspector`) use the shared index, and build their own only
    without one;
  - `checksNow` holds the index for what reads it outside a render.
- **Card marks** (`src/canvas/checks.ts`, `ModelCanvas.tsx`, `CardNode.tsx`, `canvas.css`):
  - a card's node carries `check` (its header's and its rows' severity and groups) only when it has one, set from the
    index once per data version as the requirement marker is (one effect, and the nodes' first state), so a card draws
    again only when its marks change;
  - the header's "!" is `.c-l2.chk::after` (with `order`, after the name, before the coverage); a row's is
    `.row.chk .dt::after`, put first, so "!", Σ, then the type;
  - orange with `.high`;
  - no element: the row's `.dt` and the header line get only classes and a `data-chk` attribute;
  - the title is built when the pointer is over a mark (`onPointerOver` on the card sets it from `checkTitle`), never in
    a render;
  - the name's and a row's clip count the mark's width (`CHECK_MARK_HEAD` 14 px, `CHECK_MARK_ROW` 10 px in
    `text-fit.ts`);
  - a collapsed card and a card below 40 % keep the header line, and so its mark.
- **The status bar** (`status-bar.tsx`): "Model checks {n}" after "Open notes on canvas", a `<button>`, so S6A-07's spans
  are as they were. It counts the lines that name an entity with a card here (`countOn`), from the page's index and the
  page's cards, as the bar's other counts, with no canvas commit. It is orange with a High line and absent with none.
  Its click:
  - clears the selection and calls `openDetails()` (hidden or narrow: shown or slid over);
  - asks the group (`checksJump`); the group acts on the request in the next animation frame (marked handled there, so a
    mount undone at once, as React's development double run, leaves it for the next one);
  - the group opens if folded (`Fold`'s `openOn`), scrolls into view and flashes once (900 ms; `Fold`'s `flash`).
- **The details panel without a selection** (`overview-panel.tsx`): "Model checks" between Mapping coverage and Needs
  attention:
  - the sentence, then the lines for this canvas's cards, High first, each with its "!", its name, its group's short
    label and its whole text as title;
  - D-35's `LongList`: a filter and "Show all" over 20;
  - a click selects the object and centres its card.
- **The element panels' box** (`src/app/_panels/checks-box.tsx`): after the kind line in the entity, attribute and
  relationship panels, and in InfoCube's dimensional mapping panel (through InfoMapper's app part):
  - an orange edge with a High line;
  - "{group}. {name}: {detail}"; an attribute's own line gives its detail only;
  - an item naming another object is a button (the panels' go-to links), the object's own is not;
  - a fact's hints are counted: "1 hint in the Fact section below.";
  - read only for every role.
- **The project home** (`src/app/_lib/project-checks.ts`, `_components/project-checks.tsx`, `src/app/_actions/checks.ts`):
  - the section after Model consistency, with its badge, the sentence with the modules' topics, and each group's box
    (severity, the module's tag, title, count, hint);
  - 20 lines per group rendered on the server; "Show all {n}" reads the group through `projectChecksAction` (a read,
    every role) and "Show the first 20" folds it again;
  - the all-well text with the modules' parts;
  - the stats' link "! {n} model checks", orange with a High line, scrolls to the section;
  - each line's address opens the project's first canvas (its order) that shows the line's first entity, else any it
    names, else the first canvas;
  - the home reads InfoCube's rows once (`moduleHomeData`) and uses its requirement index's lookup.
- **Arrival addresses** (canvas `page.tsx`, `ModelCanvas.tsx`, `SelectionHistory.tsx`):
  - `?entity=` selects an entity's card, else its panel;
  - `?rel=` and `?ext={kind}:{id}` select a relationship or a module's object and centre the first card here that it
    names (`focusCenter`; `extEntities` in the composition root);
  - each is in `ARRIVAL`, so it is the page's own history place, and the address is cleaned;
  - a gone object is said with the places' words (`GONE`; a module's own text from the server, `extGoneText`, because
    the canvas host is not registered yet when the page mounts);
  - `?map=` and `?row=` are unchanged.
- **The module's gone text** moved to its domain (`CUBE_MAPPING_GONE`), re-exported where it was.

### New specs (`e2e/slice-20/`, all passed locally, each once)

| Spec | What it checks | Result |
| --- | --- | --- |
| S20-01 | the demo's 15 lines on Order management's home; Customer.segment_code to Integer adds `feeds` (High, after `wrong`); deleting Sales Order.order_id gives 2 `lost` and drops `wrong`; Fact Sales without a grain gives `facts` (tagged InfoCube); the home's Undo takes each back | passed |
| S20-02 | the section after consistency, its badge (36 with 21 test lines), the sentence, High first, 20 of 21 and "Show all 21" / "Show the first 20", the stats' link (orange, scrolls), lines opening an attribute, a relationship and a dimensional mapping on the right canvas, Customer 360's scope, the all-well text on Bank X's project | passed |
| S20-03 | the marks on "Customer & orders" (Customer and last_order_id orange, Sales Order and total_amount grey), their titles on hover, no element, a rename that adds a duplicate's marks and its undo, collapsed, below 40 %, aliases, a reader | passed |
| S20-04 | the box after the kind line in the entity, attribute, relationship and dimensional mapping panels; an item selecting another object; an attribute's own detail; Fact Sales without a grain: "1 hint in the Fact section below."; a reader | passed |
| S20-05 | "Model checks 9" on both demo canvases (orange on "Customer & orders"); a click with a card selected, the panel hidden and the group folded: the panel shown, the group open, in view, flashed once; its lines (High first, short label, title) selecting a row and a mapping; no count on a canvas without lines | passed |
| S20-06 | on the Sales star: no canvas or miniature commit while idle, after a pan, after the count's click, or on a mark's hover | passed |
| S20-07 | `?entity=` (card, or panel without one), `?rel=` and `?ext=`, Back and Forward between them, the address cleaned, and the gone texts | passed |
| S20-Q10 | a rule typed in InfoMapper's and InfoCube's mapping panels, then a click on another mapping, a card or the empty canvas: stored on its own mapping only | passed: the app has no such bug |
| S20-sitting, S20-layers | measurement build only (below) | — |

### Earlier specs run (the acceptance doc's list), and changes

The run covered the slice 00 to 19 files the step 1 table names: `S0-02`, `S0-04`, `S0-07`, `S1A-05`,
`relationship-ends`, `S1B-12`, `slice-02a`, `S2C-12`, `S3A-14-idle`, `S3B-15-idle`, `S4B1-06` to `S4B1-08`, `S4B2-07`,
`S5A-02`, `S6A-07`, `slice-06b`, `slice-07b`, `slice-11`, `S12A-05`, `S12A-07`, `S12A-11`, `S14B-10`, `S15-08`,
`S15-22` and `slice-19`.
- **Result:** 125 passed and 1 skipped (`S11-13-commits`, on demand only) in 25.5 min, locally, once.
- **No earlier spec was changed.** With answer 1 (b) the plain seed has no line, so no earlier page shows a mark.

### Guards (measurement build)

- **The element guard** (`S3B-15-elements`) against slice-08's baseline, which slices 9 to 19 matched.
  - The viewport counts are equal at every view: 4,508 / 19,305 / 1,465 / 4,907.
  - On slice-19's build in the same session, the viewport counts are the same and the page totals are 6,001 / 20,798 /
    2,868 / 6,310. This branch's are 6,135 / 20,932 / 3,002 / 6,444: **+134 at every view**.
  - The +134 are the details panel's new group (Performance test's 21 "no copied key" lines: the filter, 20 lines and
    "Show all"), plus the status bar's button, outside the canvas.
  - Performance test's 21 header marks add no element.
- **LayerTree** (`S20-layers`, the Sales star from slice 19's demo, then three renames that make duplicates):
  - this branch, without marks: 9 drawing layers, 4.3 MP, 1,016 viewport elements;
  - this branch, with 3 header and 6 row marks: the same 9, 4.3 MP and 1,016;
  - slice-19 on the same data: 9, 4.3 MP and 1,016, with no marks.
- **Commit counts:**
  - `S2C-12`, `S3A-14-idle` and `S3B-15-idle` passed in the run above;
  - S20-06: no canvas commit while idle or panned, on the count's click or a mark's hover.

### The measuring sitting (8 November 2026, 21:26)

`npm run measure:canvas -- --no-build --to-screen --only s20 --rounds 2 --against slice-19`
(`e2e/slice-20/S20-sitting.spec.ts`; sitting `.data/measure/2026-11-08-21-26/`). This branch is `fc26fdd`, its
measurement build is from `dda8ac8`, and only specs, the script and docs changed since. The reference is slice-19
`98cd39c` in `../infomapper-ab-main`.

**How it ran:**
- **Balanced:** round 1 reference first, round 2 branch first. The quiet checks waited 34–62 s and none dropped a round.
- **The warm-up:** a discarded round ran before it (sitting `2026-11-08-21-20`).
- **Earlier attempts:** they did not get quiet (sittings `20-40` and `20-51`; peaks up to 8.6 %). One warm-up failed in
  the spec itself, on the reference: its choice of a card in view found none. The write now picks its card from the
  generator's layout and centres on it (`fc26fdd`). The spec was tried once on the branch before the warm-up.
- **The laptop:** Spotify, Word, Chrome, the Xbox app's window and Windows Search's indexing were closed or stopped by
  Łukasz. Background processes of iCloud, Phone Link, Photoshop Express and AdobeCollabSync were still running, on
  Łukasz's decision ("Run it anyway"). In the 3-minute reading before the sitting, the quiet rule's load averaged
  0.62 %, peaked at 2.1 %, and stayed under 2 % for up to 134 s in a row.

| Figure | Bar (AD-24, the script's) | slice-19: median (min–max) | This branch: median (min–max) | Change | Result |
| --- | --- | --- | --- | --- | --- |
| Pan and zoom, 100 % dense area, presented fps (traced) | ≥ 50 fps, ≥ −5 % vs reference | 48.3 (48.0–48.6) | 46.5 (46.0–46.9) | −3.8 % | **change met, absolute not met (on both sides)** |
| – untraced (rAF) | – | 49.2 (48.6–49.7) | 47.7 (47.7–47.7) | −3.0 % | – |
| – frames over 50 ms (rAF, per round) | – | 7, 6 | 8, 7 | – | – |
| Pan and zoom, 30 %, presented fps (traced) | ≥ 50 fps, ≥ −5 % vs reference | 52.1 (52.1–52.1) | 52.8 (52.3–53.4) | +1.4 % | **met** |
| – untraced (rAF) | – | 54.1 (54.0–54.3) | 53.9 (53.0–54.8) | −0.5 % | – |
| – frames over 50 ms (rAF, per round) | – | 2, 3 | 2, 5 | – | – |
| Redo (the mark comes): first present after the key (traced) | median ≤ 300 ms, p95 ≤ 350 ms at 100 % | 69 (66–72), p95 83 | 67 (66–68), p95 79 | −3.4 % | **met** |
| Undo (the mark goes): first present after the key (traced) | median ≤ 300 ms, p95 ≤ 350 ms at 100 % | 68 (67–69), p95 130 | 67 (65–70), p95 110 | −1.9 % | **met** |
| Redo: in page, from the key to the row showing its new name and the next frame | – | 462.8, 456.3 (per round) | 382.8, 393.2 | about −16 % | – |
| Undo: in page, the same | – | 462.0, 437.2 | 481.7, 402.5 | about −2 % | – |

**What the write figures mean:**
- The traced figure (`scripts/lib/to-screen.ts`, `presentAfter`) is the first frame presented after the key. For a write
  that goes to the server, that is the page's first reaction, not the frame with the new marks.
- The in-page time is the write's whole way: the key, the server's undo, the fresh page with the marks computed again,
  the row drawn and the next frame. No figure measures the present of the frame with the mark itself.
- On both measures this branch is not slower than slice-19, although it recomputes the checks and redraws the marks
  after each write.

**The bars:**
- **The pans are within AD-24's ≥ −5 % against the reference** (−3.8 % at 100 %, +1.4 % at 30 %).
- **The absolute 50 fps at 100 % is missed on both sides** (slice-19 48.3, this branch 46.5) on this laptop in this
  sitting; 30 % meets it on both.
- **The writes are within the interaction bars** (median ≤ 300 ms, p95 ≤ 350 ms) as traced.
- **The gate:** the absolute 50 fps bar at 100 % is missed by both sides on this laptop (slice-19 48.3, slice 20 46.5
  fps). The slice's gate is the relative bar, which is met.

### Assumptions

- **Marks change with a write's fresh page**, as the Σ marks and the role chip do (F22). A card placed here before its
  fresh page arrives gets its marks with it.
- **A gone object's toast** is for the new addresses only (`?entity=`, `?rel=`, `?ext=`). `?map=` and `?row=` keep
  today's behaviour (nothing selected, no toast), so no earlier spec changes. Back and Forward onto any gone place still
  say so, as before.
- **The status bar's count uses the page's cards** (`entityIds`), as "Mapped attributes on canvas" does.
- **The home's "Show all"** reads the group again from the model as it stands. A change made meanwhile by someone else
  shows there and on the next load (as consistency, `known-limitations.md`).

### Manual acceptance steps (demo: `npm run demo`, http://127.0.0.1:3001; then KB)

1. **Order management's home:**
   - "Model checks" after Model consistency, badge 15; groups in the order wrong, dup, calc, norel, nokey, under, with
     "InfoCube" on the last;
   - the stats end with an orange "! 15 model checks"; it scrolls to the section;
   - each line opens its canvas: last_order_id's row on "Customer & orders"; Country – Customer Address and a feed on
     "Sales star".
2. **Customer 360's home:** 9 lines (wrong, calc, under 7).
3. **"Customer & orders":**
   - Customer's header and last_order_id's row show an orange slanted "!", Sales Order's header and total_amount's row a
     grey one;
   - hovering a mark shows "Model checks: 1" and its line;
   - the status bar shows an orange "Model checks 9"; with the details panel hidden, its click shows the panel at the
     group, which flashes; a line there selects its row.
4. **Panels:**
   - Customer's panel opens with the box (one wrong-way line); its item opens last_order_id;
   - the relationship "places" lists the same line;
   - a dimensional mapping's line on "Sales star" shows its "not yet covered" line.
5. **On "Sales star":**
   - clear Fact Sales' grain: the panel's box shows only "1 hint in the Fact section below." and the home gets "Facts to
     check";
   - undo from the home.
6. **On a measure with a mark:** to see "!" before Σ, give Fact Sales two attributes of one name.
7. **KB:**
   - its home's section and counts (step 2's count: 6 no copied key and 18 fact hints, on the older backup);
   - a canvas's count and marks;
   - the two duplicate names of slice 17, if they are still there.
