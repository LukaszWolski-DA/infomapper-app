# Fix – The PDF's Source-to-target keeps an unmapped attribute's target type

Status: **step 1 done** (24 November 2026): the cause, the proposal and the proof; no application code. Branch
`fix/pdf-s2t-not-mapped` from `dev` at `215facf`. A visible change of the PDF and the preview, found in Łukasz's
acceptance of slice 34's step 3 and left to him (`docs/ideas.md`, "Slice 34's follow-ups"). No `pg:` script, no
connection to `infomapper-dev`, the local file and its backups not read: the screenshots come from `npm run demo`
(`.data/demo-db.json`), the tests from the demo's seed in memory (`tests/lib/markdown-documents.ts`).

Sources: `docs/prd/slice-34-acceptance.md` (step 4, "The fix (Source-to-target's unmapped attribute)"),
`docs/ideas.md`, `docs/decisions.md` (D-80, D-81, D-86), the prototype's InfoDocumenter (`docs/prototype/`, the
`s2t` section's `render`).

## 1. The fault

With "List attributes that have no mapping" on, Source-to-target writes an unmapped attribute as its name and "Not
mapped" in the next short column. With the app's column order (Target, Target type, System, …) that column is
"Target type", so the target's own type is lost: the demo's "Order management – S2T for the ETL team" shows
`segment_code | Not mapped | | | | |` where the model has `string(3)`; every attribute of an entity with no mapping
(Customer Address, Order Line) loses its type the same way. Since slice 34 the Markdown keeps the type ("Not mapped"
under Source column); the PDF, the pages in the editor and the quick sheet do not.

## 2. The cause

`buildS2T` (`src/modules/infodocumenter/domain/builders.ts`) builds an unmapped attribute's row twice:

- `cells`, which the HTML draws: `[mono(name)]` in Target, `warn("Not mapped")` at `firstShort` (the first column that
  is neither Target nor a long text, i.e. Target type whenever it is chosen), every other cell empty;
- `alignedCells` (slice 34, `DocRow.alignedCells` in `src/domain/document/content.ts`): every value in its own column
  (`unmappedAligned`), read only by the Markdown (`markdown.ts`, `rowCells`); `longTextTable` (`blocks.ts`) cuts it as
  it cuts `cells`. `tests/document-markdown-html.test.ts` strips it to show the HTML unchanged.

`DocumentHtml`'s `Row` (`ui/document-html.tsx`) draws `row.cells` one `<td>` each; there is no spanning cell in the
app's tables except the full-width long text under a row.

**What the prototype does** (it differs from what `docs/ideas.md` says): the prototype's InfoDocumenter section puts the
word at index 1 too (`i === 1 ? notMapped : ""`) and leaves the type empty; with its own default order (Target, System,
Source column, Source type, Target type, …) that is System. The `colspan="3"` "Not mapped" is in the prototype's older
baseline document (`docFromBaseline`, kind `map`: Attribute, Source column, How, Status), not in InfoDocumenter. So no
version of the prototype shows the target type on an unmapped row: keeping it is a change of behaviour on top of both,
which slice 34 already made for the Markdown (D-86: "an unmapped attribute in Source-to-target keeps its target type,
with 'Not mapped' under Source column").

## 3. The proposal

### Option A (recommended): the Markdown's rule, in `cells`

The unmapped row's `cells` become what `unmappedAligned` gives today:

| Columns chosen | Target | Target type | System | Source column | others |
| --- | --- | --- | --- | --- | --- |
| with Source column (the demo, the presets) | `segment_code` | `string(3)` | | Not mapped | empty |
| without Source column | `segment_code` | `string(3)` | Not mapped (the first other short column) | – | empty |
| only Target and Target type | `segment_code` | `string(3)` · Not mapped | – | – | – |

- **One rule, one place:** `alignedCells` has no reason left (`cells` is aligned), so it goes: the field in `DocRow`,
  `longTextTable`'s `aligned` argument and its cuts, `buildS2T`'s second row, the Markdown's `r.alignedCells ??`, and
  the strip line in `tests/document-markdown-html.test.ts`. The Markdown's text does not change (it already read these
  values); `tests/document-markdown.test.ts`' "keeps every value in its own column" passes unchanged.
- **The PDF and the editor's pages, every long-text mode:** an unmapped row has no rule and no note, so
  - *Under the row* (the default): the short columns as in the table above, nothing under the row;
  - *After the table*: no "→ n" reference and no numbered entry for it (as today);
  - *As a column*: Rule and Note stay empty on that row (as today).
- **The quick sheet** is the same renderer (`DocumentHtml` with `quick`): the same cells.
- **No CSS, no renderer change, no data change**; the word keeps its warning colour (`warn`, class `dwarn`).
- The section's "Mapped from" in the dictionary, the requirements and InfoCube's "Fed from" already put "Not mapped" in
  its own column (slice 34's step 4 checked every builder): nothing else changes.

### Option B: "Not mapped" spanning the source's columns

The target type kept and one cell spanning System, Source column and Source type (whichever of them are chosen and
side by side), as the prototype's baseline document spans its three.

- Needs a new content-tree field (a cell's span) that `DocumentHtml` draws as `colSpan`, a rule for which columns it
  covers when the chosen columns are not side by side (Rule as a column sits after Source type, Status after it), and
  its cut in `longTextTable` for each long-text mode.
- The Markdown cannot span: it keeps option A's rule, so the PDF and the Markdown would differ again (two rules for one
  fact), which slice 34's fix was meant to end.
- More code, a renderer change and a wider HTML test change for a look that only saves two empty cells.

**Recommendation: A.** It makes the PDF say exactly what D-86 already says for the Markdown, removes the slice-34
workaround instead of adding a second one, and touches only the builder and the tree's plumbing.

### What needs Łukasz's word

1. **A or B** (and, with A, the word under Source column, as above).
2. **The decision text** (proposed; it changes the PDF's behaviour, CLAUDE.md "UI"): a note under D-80 –
   "Note (fix/pdf-s2t-not-mapped, 24 November 2026): in Source-to-target an attribute with no mapping keeps its target
   type; 'Not mapped' stands under Source column, else in the first other short column, else after the type
   ('string(3) · Not mapped'); the PDF, the preview and the Markdown say the same (D-86)." – and D-86's sentence "The PDF
   and the preview stay as they were" gets "(except Source-to-target's unmapped attribute, D-80's note)".

## 4. The proof

**The test first** (written in step 1, kept out of the commit until step 2): `tests/document-s2t-not-mapped.test.ts`
renders the demo's S2T section with `DocumentHtml` (`renderToStaticMarkup`, as the HTML-unchanged test does), reads
every table whose header holds Target and Target type, and checks:

- every long-text mode (Under the row, After the table, As a column) and the quick sheet: `segment_code` reads
  `string(3)` under Target type, nothing under System, "Not mapped" under Source column; no row has "Not mapped" under
  Target type;
- without Source column (Target, Target type, System, Status): `string(3)`, "Not mapped" under System, Status empty;
  with only Target and Target type: "string(3) · Not mapped".

On today's code (`215facf`) all five cases fail, e.g.:

```
- Expected
+ Received
-   "Source column": "Not mapped",
+   "Source column": "",
-   "Target type": "string(3)",
+   "Target type": "Not mapped",
```

With option A's one-line change in `buildS2T` (tried in step 1, reverted) the five pass, and
`tests/document-markdown.test.ts` and `tests/document-markdown-html.test.ts` still pass (52 tests).

**The HTML-unchanged test** (`tests/document-markdown-html.test.ts`) compares the HTML of each tree with and without
slice 34's additions; it holds no expected HTML of its own. Its only change in step 2 is the removed `alignedCells`
strip line (and its header comment): the HTML change is shown by the new test, not hidden in it.

**e2e:** `e2e/slice-25/S25-05.spec.ts` counts the "Not mapped" marks (`td .dwarn`, more than 0): unchanged, still
true. No other spec reads that cell.

**Screenshots** (the demo's S2T document on its page, before and after; in step 1's report): today Customer's
`segment_code` and `last_order_id` and all of Customer Address show "Not mapped" under Target type; with A they show
`string(3)`, `integer`, `string` and the word under Source column.

## 5. The plan

**Step 2: the fix and its test.**
- The test above into `tests/`, shown failing on the branch first (its output in the step's report), then the fix:
  `buildS2T`'s unmapped row is `unmappedAligned`; `alignedCells` removed (`content.ts`, `blocks.ts`, `builders.ts`,
  `markdown.ts`, the HTML-unchanged test's strip line).
- A draft PR into `dev`; `npm run lint`, `npm run typecheck`, `npm test`; S25-05 and slice 34's specs; one full run
  (the change touches no shared infrastructure, but a merge into `dev` needs one: CLAUDE.md, "Test runs").
- The docs: D-80's note and D-86's sentence (as approved), `docs/ideas.md` (the follow-up done), slice 34's acceptance
  doc unchanged (history). Screenshots of the demo's row after the fix.
- Stop for Łukasz's manual check: the demo's S2T document on `npm run demo` (or `dev:pg` with a demo account), Customer
  and Customer Address, in Exact pages and Quick preview.

**Then a closing prompt with the merge only** (CLAUDE.md, the slice cycle 7: the approved decision text committed, CI
green on the last commit, `pg:backup` before the merge into `dev`).
