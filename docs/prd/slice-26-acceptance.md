# Slice 26 – acceptance

PRD: [`slice-26-infodocumenter-editor.md`](slice-26-infodocumenter-editor.md). Roadmap (until the closing moves it into
`docs/ideas.md`): [`slice-26-roadmap.md`](slice-26-roadmap.md). Branch `slice/26-infodocumenter-editor`.

## Step 1: the PRD checked against the code, and the measurement (12 November 2026)

### The starting point

- **The branch.** `slice/26-infodocumenter-editor` was cut from `main` at `1f7cb28` (the merge of PR 57, slice 25), which
  is tag `slice-25`.
- **The three files from Łukasz's Downloads.** Each was checked with `cmp` after the copy and with `sha256sum` against
  the prompt's value, then committed (`ff2578c`):

  | File | Bytes | SHA-256 | `cmp` |
  | --- | --- | --- | --- |
  | `docs/prd/slice-26-infodocumenter-editor.md` (new) | 19,587 | `a2d4c5af049ccb94cf636fcdc7fc85ab33a4819f45ca0648e03259a0327a0558` | equal |
  | `docs/prd/slice-26-roadmap.md` (new, from `infodocumenter-roadmap.md`) | 4,998 | `d268ed5da4c16834236a81eda512c6f54144ca0ae95120fdefa1830478656a61` | equal |
  | `docs/prototype/infomapper-prototype-with-sources.html` (replaces slice 25's `f58ec6bb…`, 950,304 bytes) | 951,539 | `7a06cb13d8bb71e0f2eb54dfaa624deb605c364f324132936b1fd2e0dd3ddfc0` | equal |

  **The prototype's file name.** The first attempt found no file of this size in Downloads, so step 1 stopped. Łukasz
  then saved it as `infomapper-prototype-with-sources.html`, the prompt's name, and that file was copied. Its
  `(1)`-named neighbour is slice 25's prototype.
- **The prototype is slice 25's plus the adaptive preview.** It has 4 `diff` hunks against slice 25's file (+14 lines,
  −7), all on the PRD's list (section 4):
  - the debounce goes from 260 ms to 500 ms (`touch`);
  - the mode select's title and its option "Auto";
  - `LAYOUT_MS` (`window.__docLayoutMs ?? 1000`) and the layout timed in `paginate` (`ST.lastMs`);
  - `drawPreview`: `slow`, `exact`, the note "Pages out of date…" with "Update pages", and a running layout dropped by
    its token when the quick sheet takes over.

  Nothing else differs.
- **What ran in this step.**
  - The measuring set (Q3, below): the measurement build (`npm run measure:build`) and a Playwright spec on it.
  - No lint, typecheck, unit tests or e2e run: there is no application code in this step.
  - `.data/dev-db.json` and the KB backups were not read or written. The measurement used the e2e data file
    (`.data/e2e-db.json`), reseeded by the fixtures.
- **The measuring scripts are uncommitted:**
  - `scripts/s26-measure/playwright.config.ts`: the repository's config with its own test folder.
  - `scripts/s26-measure/S26-measure.spec.ts`: the spec.
  - Run: `MEASURE=1 MEASURE_BUILD=production npx playwright test --config scripts/s26-measure/playwright.config.ts`.
  - Its JSON results are in `test-results/s26-measure/` (git-ignored).
- **The prototype's inventory.** The editor, sections, style, presets and texts were read from the prototype's `DOC`
  module (lines 8976–10339). The full inventory is a working note outside the repository. What matters for this slice
  is quoted below.

### Summary

The PRD holds in its shape:
- slice 25's foundations carry the editor;
- the module table's own `upgrade` and `defaults` take the recipe's new fields **without a change to the local file's
  format** (AD-33, slices 18 and 19);
- every rule the new sections read is pure and already in the app.

The measurement confirms the PRD's assumptions: Paged.js always lays out the whole document, and it runs on the main
thread. A large document's layout holds up typing.

Eight things change the slice's cost or need Łukasz's answer:

1. **F1. The preview needs the draft, not the stored recipe.**
   - The PRD says the preview refreshes about 500 ms after the last keystroke. D-66's fields save when they are left.
   - Today the tree is built on the server from the stored recipe (`pages.tsx`, `DocumentViewPage`).
   - The preview therefore needs (a) a typing callback on the panels' fields (`useDraft`, `TextField`, `TextArea` have
     none: shared code every text field uses) and (b) the tree built from a recipe that is not stored yet.
   - Proposal: the editor page sends the document's snapshot to the browser once, and the browser builds the tree.
2. **D1. The PRD's dictionary layouts are not the prototype's.**
   - The prototype's dictionary has "Definition under each row", "Definition as a column" (with its width) and "One
     block per attribute".
   - "Under each row / After the table, numbered / As a column" is the long-text choice of five other sections.
3. **D2. The presets differ** from the prototype's.
4. **F4 and D3. The texts of model checks and of the Data Vault reading are English only** (`CHECK_TEXTS`, InfoCube's checks,
   `readingText`). The prototype prints them in all three languages.
5. **Q6. The dictionary's dimensional entities need one contribution, not two.** The feeds are already InfoMapper's
   (`AttributeFeeds` in `DocumentState.feeds`); only the role's words come from InfoCube.
6. **F6. The content tree needs new node kinds**: lists, chips, swatches, notation marks and a coverage bar. These are
   InfoMapper's domain types that InfoCube's section also builds (AD-33's document sections).
7. **Q4 and F7. Several layouts in one page work and leave nothing behind:** Paged.js's styles are removed on destroy, and
   the DOM is back to its count. One risk: while new pages are laid out, the old ones take on the new `@page` rules
   (paper, orientation).
8. **F8. Step 2 changes `useDraft`**, which every text field in the app uses (D-66, the leave guard). **Step 2 has a
   full run.** The recipe's upgrade needs none on its own: it uses the existing hook.

### Q3: the measurement (Paged.js on slice 25's document page)

**The method.**
- The machine: the laptop (Intel Core i7-8550U at 1.80 GHz, 7.9 GB RAM, Windows 11, Node 22.20.0), on mains power, with
  nothing else measured.
- The app: the measurement build (`npm run measure:build`, AD-31) on the e2e data file, in headless Chromium 153.
- Per document:
  - **Loads:** one warm-up load of `/w/{ws}/d/{id}/view`, then 5 loads. Each gives:
    - Paged.js's layout (the page's `data-layout-ms`: from starting Paged.js, its dynamic import included, to its last
      page);
    - the main thread's long tasks (over 50 ms, `PerformanceObserver` "longtask") that overlap the layout: the
      longest, their sum and their count.
  - **Typing:** 5 more loads with typing. Once the first page is drawn, a text field outside React's tree is added to
    the page, and keys are typed into it at 40 ms intervals while the layout runs. For each key, Event Timing gives its
    input delay (from the key to its handler) and its duration (to the next paint); only keys of 16 ms or more are
    reported.
  - **Re-layouts:** in the same page, 8 more layouts with a second copy of Paged.js 0.4.3 (the package's own
    `dist/paged.js`) into a fresh container, each destroyed as the page does (`polisher.destroy()`,
    `chunker.destroy()`). Each gives its time, its long tasks, the `<style>` count in `<head>`, and the JS heap and DOM
    nodes after a forced garbage collection (CDP). This is what the editor would do on each change.
- Medians, with the fastest and the slowest in brackets.

**The documents.**
- **"Performance test" dictionary:** a full data dictionary (every field and column, all mappings), as slice 25's
  `S25-layout`.
- **"Performance test" source-to-target:** every column, the attributes with no mapping too.
- **The demo's three documents** ("full" seed, the star on):
  - "Retail Co – data dictionary";
  - "Order management – S2T for the ETL team" (with the Dimensional model);
  - "Anna's working dictionary".

| Document | Pages | First layout in the page | Longest task | Long tasks' sum (count) | Re-layout in the same page | Its longest task |
| --- | --- | --- | --- | --- | --- | --- |
| Performance test, dictionary | 42 | **4.36 s** (3.64–4.52) | **390 ms** (310–409) | 3.68 s (35) | **3.23 s** (2.90–4.41) | 163 ms (144–311) |
| Performance test, source-to-target | 69 | **4.50 s** (4.37–6.17) | **423 ms** (392–517) | 2.25 s (21) | **3.17 s** (3.09–3.57) | 99 ms (94–167) |
| Demo, data dictionary | 6 | **0.21 s** (0.19–0.25) | none over 50 ms | 0 | 0.17 s (0.14–0.19) | none (0–51) |
| Demo, S2T with the Dimensional model | 9 | **0.54 s** (0.47–0.62) | 70 ms (62–77) | 0.12 s (2) | 0.30 s (0.29–0.40) | 65 ms |
| Demo, Anna's dictionary | 6 | **0.22 s** (0.19–0.32) | none | 0 | 0.14 s (0.12–0.18) | none |

**Typing while "Performance test" is laid out.**
- **The dictionary:** 75 keys typed during the layouts; 58 took 16 ms or more. Input delay median **66 ms** (5–242);
  from key to paint median **168 ms** (24–424).
- **The source-to-target:** 100 keys typed; 98 took 16 ms or more. Input delay median **43 ms** (0–104); to paint
  median **112 ms** (16–224).
- **The demo's documents:** a layout ends before the first key can be typed (6 and 9 pages). No key took 16 ms.

**Several layouts in one page (Q4).** After each of the 8 re-layouts and its destroy:
- `<head>` holds the same 3 `<style>` elements as before;
- the DOM node count is back to its value before the layout (80,791 on "Performance test" with the page's own pages);
- the heap grows about 0.1 MB a layout (Performance test: 20.8 → 22.0 MB after 8; demo: 8.9 → 9.9 MB). Part of that is
  the measurement's own list of long tasks. Nothing builds up that a long editing session would notice.

**Whether Paged.js can lay out only part of a document: no.**
- `Chunker.flow` always clears the queue, removes every page and renders from the start
  (`node_modules/pagedjs/src/chunker/chunker.js`, `flow`: `this.q.clear(); this.removePages();`).
- There is no entry point for a later page alone. `target-counter` (the contents' page numbers) needs the whole flow
  anyway.
- **It can be stopped:** `chunker.stop()` makes the next page answer "canceled" (`renderAsync`). The prototype only
  throws a late result away (its token `PJ`).

**Why there are long tasks.**
- Paged.js gives the thread back once per page: its queue runs each page in a `requestAnimationFrame`
  (`src/utils/queue.js`, `run`). A layout is therefore at least one frame per page, and each page is one task.
- The longest tasks are a page with a long table and the first parse of the content and CSS. The first layout in a
  page has the longest one: 390–423 ms, against 99–163 ms for a re-layout.
- A worker is not possible: Paged.js measures the DOM's layout. An idle callback changes nothing, since a page is the
  smallest piece.

**What was not measured, and step 2 measures:**
- building the tree and rendering it with React **in the browser** (F1);
- React's render of the hidden source on every change. In Node the tree of "Performance test" takes 12.8 ms (slice
  25). Its React render of about 1,700 table rows is a cost of its own.

Step 2 gives both as a reference figure on "Performance test" (no bar unless Łukasz sets one).

**Proposal: Auto's threshold 1,000 ms, as the prototype's default.**
- Every demo document lays out in 0.2–0.6 s, with tasks of at most about 70 ms, so Auto keeps real pages while one
  types.
- "Performance test" takes 3–4.5 s and goes to the quick sheet after its first layout.
- A threshold of 1 s also bounds what typing can meet: a document that lays out under 1 s has had tasks under about
  100 ms in every measurement here.

**Does a layout hold up typing? Yes, on a large document.** A key typed during the layout of "Performance test" waits
up to 0.24 s for its handler and up to 0.42 s to be painted. The editor should therefore avoid laying out while the
person types:
- in Auto, by the threshold (a large document goes to the quick sheet);
- in Exact, by the 500 ms debounce: a layout starts only after a pause;
- by **stopping** a running layout (`chunker.stop()`) when a new change arrives, rather than letting it run to the end
  and throwing it away, as the prototype does.

With these, typing in Exact on a large document still meets one page's task (up to about 0.4 s) when a key falls into
a layout that already started. That is the choice of Exact, said in the mode's title.

### Answers to the PRD's questions

**Q1. The editor's place.**
- **Route.** `/w/{ws}/d/{id}` renders the editor in place of `DocumentForm` (`src/modules/infodocumenter/app/form.tsx`,
  427 lines). `pages.tsx`'s `DocumentFormPage` becomes the editor's page, with the same access check and the same return
  to the tab with `?gone=document`.
- **What carries over from the form:**
  - its saves (`saveRow` with `updateDocumentAction`, D-59);
  - its field kinds (`TextField`, `TextArea`, `Seg`, `useChoice`; `Check`, `ListChecks`, `IdChecks`, `SharedBox` move
    to the right panel);
  - its texts (`FORM_TEXTS`) and its read-only banner with "Duplicate as my document".
- **What goes:** the form's layout (one column, "Open document").
- **The document page `/view` stays**, as the reader the tab's "Open" leads to and the page print falls back to.
- **"Print / PDF" in the editor** prints the editor's laid-out pages, as the prototype does. Where the preview shows the
  quick sheet, it lays out real pages first, with "Laying out pages…".
- Slice 25's specs that change are listed under "Earlier specs and fixtures".

**Q2. The recipe.** See F9 to F11. In short:
- **`style`** is a new `jsonb` column (`not null`), checked by a Zod schema in the domain.
- Each section entry gets **`heading`** (string or null) and **`newPage`** (boolean). The PRD's `new_page`: JSON keys
  in the recipe are camelCase already (`preparedBy`, `mappedFrom`).
- Text's `options.heading` moves to the entry.
- Older rows are read through `TableRules.upgrade` (pure, idempotent): `style` with the defaults and the language null,
  the entries' new fields, Text's heading moved. New options of a kind take Zod defaults when they are parsed.
- **No change to the local file's format:** a module's tables are not part of it (AD-33). KB's file is not touched. A
  new migration adds the column.

**Q3.** Above.

**Q4. Paged.js in the editor.**
- **Isolation:** slice 25's (`Previewer.preview(html, [css], container)`, the document's own CSS only) works for every
  re-layout.
- **Teardown:** the polisher's styles go with `polisher.destroy()`, and the pages with `chunker.destroy()` and the
  container. Measured clean over 8 layouts.
- **New pages off screen, then swapped:** the new pages are laid out off screen and swapped in; the old ones are
  destroyed at the swap.
- **The one risk is a few seconds' wrong look.** Both previewers' styles are global while the new layout runs (Paged.js
  writes `.pagedjs_page` rules into `<head>`). So the old pages take on the new `@page` size, orientation, margins and
  margin texts until the swap.
  - Proposal: when the paper, the orientation or the template change, the old pages give way at once to "Laying out
    pages…". For every other change they stay, as the PRD says. A change of header text shows on the old pages early,
    which does no harm.
  - An `<iframe>` per layout would isolate everything, but it needs the fonts and the click and scroll sync across
    documents. Not proposed unless the swap shows defects in step 2.
- **Zoom:** CSS `zoom` on the pages' container, as the prototype does ("Fit width" from the middle's width through a
  `ResizeObserver`; no layout read in a commit).
- **Memory:** about 0.1 MB a layout (above).

**Q5. The sections.** For each type, what it reads; everything is pure and from the document's state, and none needs a
new pure entry point except the ones named:

| Type | The app's functions it reads | What the prototype prints that the app has no rule for |
| --- | --- | --- |
| `overview` | `workspace.description`; entities in scope (`sectionScopeOf`); source tables; mappings and their statuses; requirements; concepts in order with their colours (`concept-colors.ts`) | The PRD's "what is on no canvas" is **not in the prototype** (D4) |
| `ready` | definitions (entity, attribute); `state.mapped` (`countsAsMapped`) and `state.feeds`; `checkMappingTypes`; mapping status; `requirementCoverage`; **`modelChecks`** with the module's checks (F12) | "Weak definitions" (fewer than four words, or the name itself) is a **new rule** (D5) |
| `conv` | `stereotypeIndex`, `stereotypeUses` (D-79); `classificationIndex` (D-78); `logicalTypeOf` (`type-check.ts`) over the sources' columns; `workspace.naming_conventions`; `workspace.four_eyes` | The notation's end marks as small drawings (F6) |
| `sources` | tables and columns in scope (F13); `classificationIndex`; `note_text`; `missing_since`, `retired_since`; `lookup.mappingsOfColumn` (Used by); `dataVaultReading` with `workspace.dv2_mode` | Its texts in Polish and German (F4) |
| `classreg` | `classificationIndex`; `attribute.is_pii` and its mappings | – |
| `reqs` | requirements; `requirementCoverage`; `requirementScope`; kinds, statuses and priorities | Their words in three languages (labels) |
| `trace` | `requirementScope` (with `feeding`/`feeds`), `lookup.coverageOf`, mappings and feeds | – |
| `dq` | requirements of kind `dq_rule`: `expression`, `severity` (`warn`, `block`), `owner_name`, their links | – |
| `cube.bus` | InfoCube's `busMatrix(cubeIndex, …)`, registered by InfoCube as its second section type | Its words in Polish and German (InfoCube's `document-words.ts`) |

- **Scope for sources (F13).** "In scope" for a source table is not defined in the app. The prototype takes the tables
  whose columns are mapped to entities in scope, or every table when nothing narrows the scope.
- **The bus matrix's "conformed" count** is the prototype's last row: the number of facts per dimension.

**Q6. The dictionary's dimensional entities (decided, item 8).**
- The design is smaller than slice 25's F9 and F10 assumed.
- **The feeds are InfoMapper's already:** `AttributeFeeds` is in InfoMapper's domain, and `DocumentState.feeds` holds
  them, built by the composition root from InfoCube's rows (`documentStateFor`).
- **Only the role's words come from InfoCube.**
  - The extension point: `DocumentContributions.entityRole(state, entityId, language): string | null`, registered
    beside the section types in `src/compose/documents.ts`.
  - InfoCube answers with `cubeTitle(…).long` in its document words.
  - The dictionary prints it where a logical entity's stereotype stands, as the prototype does: no role column.
- **"Mapped from"** of a dimensional attribute prints its feeds (`Entity.attr + Entity.attr`, with the status pill
  while drafts are marked).
- **The coverage line** counts fed attributes by the app's rule (`rowFeeds`'s rule: any feed, any status; slice 18's F1).
- **Cost:** one function, its words in three languages, the builder's branch. Unit tests on the star.

**Q7. Style.**
- **Templates:** the prototype's CSS (lines 1385–1405) moves into `document-css.ts` as classes on the document's root
  (`tpl-formal`, `tpl-compact`, `acc-{accent}`, `th-mono`, `zebra`).
- **IBM Plex Serif:** Regular, Medium and Italic, as IBM's unmodified WOFF2 files beside Sans and Mono in
  `src/app/fonts/ibm-plex/`, their checksums in its README, loaded with `next/font/local`. **Fetching them is a
  download from npm (`@ibm/plex-serif`) or IBM's release, for which step 4 asks Łukasz first.**
- **A3 and landscape:** `@page { size: A3 landscape }` works in Paged.js for one size per document. Mixed sizes are
  slice C's.
  - `document-css.ts` today fixes A4 portrait in two places: `@page` and the cover's `min-height: 248mm`.
  - Both come from the paper's height: the page's height less its top and bottom margins and the cover's padding.
- **Header and footer fields.** The tokens are filled in the domain as plain text (`buildDocument`, the frame).
  - `{page}`, `{pages}` and `{pagelabel}` become `counter(page)` and `counter(pages)` in the margin boxes' CSS, the
    text parts escaped with `cssString`, as today.
  - The prototype's rule: in the header's left part they are dropped (it carries the logo).
  - Without logos in this slice, the rule has no reason yet. D6 asks whether to keep it.
  - An unknown token stays as typed (the prototype).
  - Running header off: the header's two parts are empty; the footer always prints.
- **The notation switch outside figures:**
  - the dictionary's "Cardinality" column prints `1`, `0..1`, `1..*`, `0..*` in both notations (the prototype);
  - only Conventions' "Relationship notation" draws the end marks, as inline SVG chips (crow's foot or UML);
  - the canvas's own drawing of the marks is canvas code, so the document gets its own four small SVGs (F6).
- **Black and white:** `th-mono` (the accent and the status pills in greys, chips monochrome), as the prototype.
- **Banded rows:** the renderer marks every second row with a class. CSS `nth-child` would restart its parity where
  Paged.js continues a table on the next page.
- **Keep a table on one page up to N rows:**
  - an entity's block with N attributes or fewer gets `break-inside: avoid` (the prototype's `.dent.keep`);
  - Paged.js 0.4.3 honours `break-inside: avoid` on a block that fits a page;
  - step 4's S26-08 checks it on the laid-out pages.

**Q8. Language per document (decided, item 9).**
- **Stored as `style.language`:** `"en" | "pl" | "de" | null`. Null reads as the workspace's documentation language.
- **New documents** store the workspace's language at create, as the prototype does
  (`lang: w.lang || "English"`).
- **A recipe from slice 25**, upgraded, and the seeded demo documents have null, so they follow the workspace (S25-08
  keeps passing).
- The select shows the language in effect.
- `buildDocument` reads `style.language ?? workspace.doc_language` in place of `workspace.doc_language`.
- The wording of D-80's change goes into D-81 at the closing: "Headings and labels are in the document's language
  (English, Polish, German), which a new document takes from the workspace's documentation language; a document stored
  before slice 26 follows the workspace's."

**Q9. Rights and texts.**
- **Adding, removing, reordering and renaming sections** follow `editRefusal`: a private document by its author; a
  shared one by owners, admins and modelers; never in an archived workspace or while InfoDocumenter is off. Nothing new.
- **A module's section type while the module is off:**
  - The domain refuses to add it: "{module} is off in this workspace." — the prototype's line, also the add list's.
  - A section already in the recipe is kept and skipped, as slice 25.
  - A type no module knows cannot be added.
- **Style changes** follow the same rule.
- Every new text is listed below.

**Q10. Earlier specs, fixtures, the demo.**
- **The demo's three documents** get the new presets' sections, made by `presetSections` as New document makes them.
  `addDocumentsDemoData` changes, and `tests/documents-demo.test.ts` with it.
- **The element guard (`S3B-15-elements`)** counts a canvas's viewport. The editor is not a canvas page and the shell
  does not change, so the guard is unaffected. It runs once at the closing as a reference.
- **`S25-layout`** stays as slice 25's reference. Slice 26's `S26-10` adds the tree and the layout in the editor on
  "Performance test" as reference figures.

### Findings

**The editor and the preview (Q1, Q3, Q4)**

- **F1. The preview needs the draft, not the stored recipe.**
  - What the PRD asks:
    - item 5: "The preview refreshes about 500 ms after the last keystroke";
    - "Every change saves as slice 25's form does";
    - the fields save when they are left (D-66, `useDraft`).
  - What the code has:
    - slice 25 builds the tree on the server (`DocumentViewPage`: `store.snapshot`, `buildDocument`, `DocumentHtml`);
    - only the HTML reaches the browser.
  - Two pieces are missing:
    - **(a) A typing callback.** `useDraft`, `TextField` and `TextArea` (`src/app/_panels/fields.tsx`) report a value
      only on leave (`onSave`). Proposal: an optional `onType(text)` on `useDraft`, `TextField` and `TextArea`, called
      from the element's own `input` event, which `useDraft` already listens to for the leave guard (slice 14b). Every
      other field is unchanged. This is the code every text field in the app uses (D-66, 14b), so step 2 has a full run
      (F8).
    - **(b) The tree from a recipe not stored yet.** Three ways:
      - **Browser (proposed).** The editor's page sends the document's snapshot (`store.snapshot(ws, DOCUMENT_TABLES)`)
        once; the browser builds the state, the tree and the hidden source from the stored recipe with the drafts
        applied, and Paged.js lays it out.
        - The section builders, `buildDocument`, `documentStateFor`, the labels and `DocumentHtml` are pure and import
          no server code, so they run in the browser as they are.
        - After a save, the page's revalidation brings a fresh snapshot (others' model changes too).
        - Cost: the snapshot's bytes once per page (the model, as a canvas page sends it, plus the requirements, the
          project cards and the module rows). Step 2 measures them on "Performance test".
      - **A server action per change.** It takes the draft recipe and answers the tree: a round trip after every pause,
        and 367 KB of JSON for "Performance test" each time.
      - **Saving on each pause.** This changes D-66's "saved when left" and makes many versions and change events.
    - Question D7.
  - Slice 25's rule "only that HTML reaches the browser, never the model or another document" (`pages.tsx`'s comment)
    changes for the editor only:
    - the model goes to a member who sees it anyway on the canvas pages;
    - other documents never do;
    - `/view` stays as it is.
- **F2. Preview modes as the prototype.**
  - Auto is the default and is kept per tab for the session (`sessionStorage`), as the prototype's `ST.pages`.
  - `lastMs` is the last layout of this document in this page: the editor's own layouts and "Update pages".
  - The quick sheet is drawn at once on every change while `slow` (the prototype's `drawPreview`).
- **F3. The quick sheet.**
  - The prototype draws one `.dsheet` per page break with a faint line every page height, and the watermark at the top.
  - The contents print nothing in place of a page number. This agrees with the PRD's item 4; the roadmap's P3 says "–".
    The prototype decides: nothing.
  - **The quick sheet's footer:** the prototype prints one line after the last sheet, "{workspace} · {title} · Version
    {v} · {state}", which ignores the footer fields. Proposal: print the footer fields' text there (the same tokens,
    `{page}` and `{pages}` as "–"), so that what the person types in the footer shows on the quick sheet too. D8.
- **F4. Texts printed in English only.**
  - **Model checks:**
    - `CHECK_TEXTS` (`src/domain/model/checks.ts`), InfoCube's checks and their `text()` functions are English;
    - the prototype's `LBL` has the readiness checks in three languages but takes the D-75 groups' titles as they are;
    - the app's group titles and lines are English.
  - **The Data Vault reading:** `readingText` (`src/domain/model/data-vault-reading.ts`) is English. The prototype has
    its lines in all three languages.
  - **Proposals:**
    - (a) The Data Vault reading's lines are structured (`ReadingLine`). The document builds its words from its own
      labels per language: cheap, no copy of a rule, only of its words.
    - (b) Model checks: print the groups and lines in English in a Polish or German document, with the section's own
      labels translated, until the checks get their languages in a later slice. Giving `text()` a language now means
      every rule's words three times (about 40 texts). D3.
- **F5. Sync, selection, double-click.**
  - Click on a section in the list: scroll the preview to `[data-sec]` and mark it (`outline` in the accent).
  - Click in the preview: select the section. The title page and the contents select "Document".
  - **Double-click: the prototype has no inline rename.** It selects, scrolls and focuses the section's first option
    field, and the name changes in "Heading" (its title "Double-click to edit" points there). The PRD says "double-click
    to rename". D9.
- **F6. The content tree needs new kinds** (`src/domain/document/content.ts`, InfoMapper's domain; InfoCube builds
  them too):
  - a `list` node (bullets or numbered: the Data Vault reading, the notes after a table, "Definitions in full",
    readiness's items);
  - runs for a chip (`BK`, `PII`, a requirement key), a concept's swatch (its colour), a coverage bar (`{ok}/{total}`),
    a notation mark (`{ notation: "ie" | "uml", end: "one" | "zeroOne" | "many" | "zeroMany" }`) and a mapping line's
    kind;
  - on a table, a `layout`: below, after, column or blocks.
  - The renderer (`document-html.tsx`) draws them; plain data stays plain.
  - CLAUDE.md's "Document sections" gets the kinds.
- **F7. Several layouts in one page:** see Q4. Proposal: stop the running layout (`chunker.stop()`) when a newer change
  arrives, and swap in the new pages off screen.
- **F8. Step 2 has a full run.**
  - **`useDraft`'s typing callback (F1 a):** the code every text field uses, and the leave guard's source. The save
    chain (`rowSaves`) is not changed.
  - **The recipe's upgrade:** a module rule on an existing hook (`TableRules.upgrade`), with no change to the local
    adapter. It would need no run on its own.

**The recipe and the commands (Q2, Q9)**

- **F9. `style`: its shape and its defaults** (the prototype's `newDef`, without figures, logos and baselines):

  ```
  style: {
    language: "en" | "pl" | "de" | null,      // null: the workspace's (Q8)
    template: "standard" | "formal" | "compact",                 // standard
    accent: "indigo" | "teal" | "graphite" | "burgundy",          // indigo
    colours: "colour" | "mono",                                    // colour
    paper: "A4" | "A3",                                            // A4
    orientation: "portrait" | "landscape",                         // portrait
    notation: "ie" | "uml",                                        // ie (crow's foot)
    keepRows: 0 | 10 | 15 | 25 | 40,                               // 15
    cover: boolean, contents: boolean, numbers: boolean,           // true, true, true
    banded: boolean, runningHeader: boolean, watermark: boolean,   // false, true, true
    header: { left: string | null, right: string | null },        // null: "{org} · {title}", empty
    footer: { left: string | null, right: string | null },        // null: "{workspace} · {state}", "{pagelabel}"
  }
  ```

  - Each text field is at most 200 characters (`SHORT_TEXT_MAX`).
  - The ETL preset sets `watermark: false`, as the prototype's.
  - The cover's fields stay in `cover`, as slice 25 has them; the prototype keeps them in its style.
  - The prototype's default status "Draft for review" is not taken: slice 25 left it empty. Recorded, not proposed.
- **F10. Section entries.**
  - `{ id, type, on, heading: string | null, newPage: boolean, options }`.
  - `newPage` defaults to true; the Compact template runs sections on and disables the check box ("The Compact template
    runs sections on.", the prototype).
  - Text's `options.heading` moves to `heading`. `DocumentSectionType.heading` (the hook that let Text name itself) is
    removed: every heading is the entry's, else the type's label in the document's language.
  - `text`'s options schema drops `heading`. Its `.strict()` would refuse an old row, which is why the upgrade moves it
    (F11).
- **F11. Older rows and the migration.**
  - **`INFODOC_RULES.document_definition.upgrade`** (pure, idempotent, run on load as InfoCube's `upgradeCubeEntity`):
    - adds `style` with the defaults and `language: null`;
    - adds `heading: null` and `newPage: true` to every entry;
    - moves Text's `options.heading` to the entry.
  - **New options of the existing kinds** take Zod `.default()` when the builders parse them (`dictionaryOptions.parse`
    is what the builders already call): the dictionary's `layout`, `definitionWidth`, `longDefinitions`, `byConcept`,
    `conceptPage`; S2T's `longTexts`.
  - **The recipe check** (`document_definition_recipe_ck`) adds `style` as an object, in the local rules and in a new
    migration (`alter table document_definition add column style jsonb not null default '{}'::jsonb`, and the check
    replaced). DDL only: no database holds data (AD-31).
  - The local file's format stays 17.
  - `tests/infodocumenter-store.test.ts` gets the upgrade's cases.
- **F12. Commands.**
  - `updateDocument` takes `style` (a partial patch, strict) and, per section, `heading` and `newPage`.
  - **Three new commands**, each a save with the row's version and a change event, outside undo (D-80):
    - `addDocumentSection` (type; at the end, with the kind's defaults; refused for a type no module knows, or one whose
      module is off);
    - `removeDocumentSection` (id);
    - `moveDocumentSection` (id, up or down).
  - **The most sections a recipe holds:** proposal 50 ("A document holds at most 50 sections."). The prototype has no
    limit; the recipe should have a bound. D10.
  - **Model checks need a contribution.** Readiness reads `modelChecks(input, modules)`, and InfoCube's checks come from
    `cubeModuleChecks`, which only `src/compose/` may name. `DocumentContributions` therefore gets `checks(state)` too,
    as the dictionary gets `entityRole` (Q6).
- **F13. Source tables in scope.**
  - The app has no rule for "source tables in scope". The prototype takes the tables with a column mapped to an entity
    in scope, or every table when the scope names no project and no concept.
  - Proposal: that rule, in `scope.ts`, with its unit tests. It is shared by Source tables, the classification register
    and Conventions' types.

**PRD against the prototype on what this slice builds (to decide)**

- **D1. The dictionary's layouts.**
  - The PRD says "under the row, after the table, in a column". The prototype's dictionary has:
    - "Definition under each row" (default);
    - "Definition as a column", with "Width of the definition column" 30 / 40 / 50 / 60 %;
    - "One block per attribute".
  - The PRD's three are the prototype's "Long texts (definitions, descriptions, rules, notes)": "Under each row" /
    "After the table, numbered" / "As a column", in S2T, Source tables, the classification register, Requirements
    (table) and Data quality rules.
  - Proposal: as the prototype. The dictionary has its three; the five others have the long-text choice.
- **D2. The presets.**

  | Preset | PRD | Prototype (without Diagrams) |
  | --- | --- | --- |
  | Data dictionary for the business | overview, conventions, dictionary, classification register | text, overview, conventions (statuses and types off), dictionary, requirements, data quality rules, classification register |
  | Source-to-target specification for ETL | readiness, S2T, sources, dimensional model, bus matrix (InfoCube on) | conventions (stereotypes off), S2T, sources, dimensional model (InfoCube on), data quality rules; watermark off |
  | Blank | title page and text | text |

  - The prototype's descriptions change with them ("Definitions, personal data and requirements, with key-only
    diagrams. No technical mapping detail.", "Every mapping with rules, types and status; source tables; full diagrams
    with mapping lines.", "A cover and an empty introduction. Add the sections you need.").
  - Their "diagrams" parts are slice C's.
  - Proposal: the prototype's, without Diagrams. The descriptions are reworded without diagrams:
    - "Definitions, personal data and requirements. No technical mapping detail."
    - "Every mapping with rules, types and status; source tables."
  - The sign-off preset comes with baselines.
- **D3. Model checks and the Data Vault reading in Polish and German** (F4).
  - Proposal: the Data Vault reading in the document's language.
  - Model checks' groups and lines in English for now, the section's own labels translated; their languages are noted
    in `docs/ideas.md`.
- **D4. Overview's "what is on no canvas".** In the PRD's table, not in the prototype (which prints the description,
  the counts and the concepts with their entities). Proposal: as the prototype.
- **D5. Readiness's "weak definitions".** A new rule of the prototype's: fewer than four words, or the name itself
  (lowercase, `_` as a space, `. , ; :` removed), for entities and attributes.
  - Proposal: InfoDocumenter's own pure rule in its domain (`readiness.ts`), with its unit tests.
  - It is a document check, not a model check (D-75), so the project home does not show it.
- **D6. `{page}` in the header's left part.** The prototype drops `{page}`, `{pages}` and `{pagelabel}` there, since
  that part carries the logo. Without logos in this slice: keep the rule, so slice D adds nothing, or allow them until
  logos come? Proposal: keep the prototype's rule and its hint.
- **D7. Where the preview's tree is built** (F1 b). Proposal: in the browser, from a snapshot sent with the editor page.
- **D8. The quick sheet's footer** (F3). Proposal: the footer fields' text, in place of the prototype's fixed line.
- **D9. Double-click.**
  - The PRD says "double-click to rename"; the prototype focuses the first option field and renames in "Heading".
  - Proposal: as the prototype. Double-click focuses "Heading", which the prototype's title "Double-click to edit"
    suggests, rather than the first option field.
- **D10. A limit of 50 sections** (F12), a new text.
- **D11. Text's light markup.**
  - The prototype's Text has "- " lists, `**bold**` and `_italic_` (hint "A blank line starts a paragraph; lines
    starting with “- ” make a list; **bold**, _italic_.").
  - D-80 says "plain text, paragraphs kept" (slice 25's D8).
  - Not in the PRD. Proposal: keep D-80's plain text in this slice and note the markup in `docs/ideas.md`.

**Differences between the prototype and the app that the slice touches**

- The prototype's sharing has no "only its author makes it private" (the app's, slice 25 step 4b). The app keeps its
  rule.
- The prototype's name field saves on every keystroke (debounced). The app saves on leave (D-66). The preview reads the
  draft (F1).
- The prototype removes a section without a question and has no undo in the editor. The app's documents are outside
  undo (D-80). Proposal: no question, as the prototype; the removed section is gone. Recorded for Łukasz.
- The prototype's quick sheet shows a footer line, never the header fields (F3, D8).
- The prototype's busy text shows the old "{n} pages" during a debounced layout (a quirk). The app shows "Laying out
  pages…" while any layout runs.
- The prototype throws a late layout away. The app stops it (F7).
- The prototype's editor is a full-screen overlay. The app's is a page in the shell (`AppShell` with the breadcrumbs
  "Documentation › {document}"); "← Documentation" stays at the top bar's start.
- The prototype's dictionary option "Figure of the concept's frame at its start" and the Dimensional model's star,
  sizes and figures are slice C's. `cube.dim`'s options stay slice 25's (`relationships` included).
- The prototype's Overview counts all requirements, not those in scope (`overview`). Proposal: as the prototype, since
  it is the model's overview.
- The prototype's "Style" panel carries the cover's title and the logo. The cover stays in "Title page", as slice 25.

### Every new UI text

The prototype's exact texts, English only (the editor's own texts are English, as the app). The document's labels in
three languages come from the prototype's `LBL`. German is marked for Łukasz's review, as in slice 25.

**Editor, top bar and left panel.**
- `← Documentation` (exists).
- "Laying out pages…", "{n} pages" (exist).
- The preview select's title: "Auto: real pages while they lay out quickly, otherwise the quick sheet until you update
  them. Exact: real pages after every change. Quick: one sheet per page break, at once."
- The preview select's options: "Auto", "Exact pages", "Quick preview".
- The zoom: "Fit width", "75 %", "100 %".
- "Print / PDF".
- "Document", "Model state, scope, style, cover".
- "Sections".
- The row buttons' labels: "Include {section}", "Move up", "Move down", "Remove".
- The row's title: "Double-click to edit". A module section's chip shows its module ("InfoCube"); while the module is
  off, the chip "off" with the title "{module} is off in this workspace".
- "+ Add section", with each type's label and its line:
  - "Text": "Your own words: introduction, scope, assumptions, open points. Not stored in the model."
  - "Model overview": "The workspace's description, what the model holds, and its concepts."
  - "Data dictionary": "Entities by concept with the attribute properties you choose."
  - "Source-to-target mapping": "Every mapping from source columns to logical attributes, with rules, types and status."
  - "Source tables": "The source tables in scope: their classifications and notes, their columns with classifications,
    notes and use, and a Data Vault reading."
  - "Classification register": "Every column and table with the classifications you choose, e.g. all personal data in
    the sources and the attributes that carry it."
  - "Requirements and coverage": "Requirements that touch the scope: their description, kind, status, owner and
    coverage by approved mappings."
  - "Model readiness": "What is still open: missing or weak definitions, unmapped attributes, type problems, unapproved
    mappings, uncovered requirements."
  - "Conventions and notation": "How to read the document: relationship notation, mapping statuses, marks, stereotypes,
    type conversions, naming."
  - "Traceability": "From each requirement to the attributes that meet it, their source columns and the facts or
    dimensions they feed."
  - "Data quality rules": "Requirements of the kind data-quality rule: the rule, what happens when it fails, its owner
    and what it applies to."
  - "Dimensional model" (InfoCube): its line without "a star diagram" and "figures from canvases":
    "Facts with grain and type, dimensions and measures; dimensions with history; every dimensional attribute's feed."
  - "Bus matrix" (InfoCube): "Facts against dimensions: which fact uses which dimension, and the conformed ones."
  - A disabled module type: "{module} is off in this workspace."
- **Preview notes:**
  - "Pages out of date: this document took {s} s to lay out, so the preview shows the quick sheet while you edit." with
    "Update pages";
  - "Skipped while InfoCube is off: {sections}." (the prototype's; slice 25's per-section notes stay in the document).

**Right panel, Document.**
- **Model state:** "Live model (changes as people work)" (exists).
- **Scope:** "Projects", "None ticked: the whole model. Otherwise what the projects' canvases show.", "Concepts", "None
  ticked: every concept.", "Model levels", "Logical", "Dimensional (InfoCube)", "Mappings included" and its three
  choices (exist in slice 25's form; checked against the prototype in step 2).
- **Sharing:** "Who sees this document": "Private", "Shared with the workspace"; "Only modelers, admins and owners
  share documents." (exists); "Audience (for your own orientation)", placeholder "e.g. Business, ETL developers,
  Client".
- **Style:**
  - "Language of the document", with "English", "Polski", "Deutsch" and the hint "Headings and labels only. Names and
    definitions come from the model as written."
  - "Template":
    - "Standard": "Sans serif, each section on a new page."
    - "Formal": "Serif body text for reading, ruled cover; for client deliverables."
    - "Compact": "Smaller type, banded tables, sections run on; for working copies."
  - "Accent colour" (indigo, teal, graphite, burgundy), hint "Black and white overrides the accent."
  - "Paper": "A4", "A3". "Orientation": "Portrait", "Landscape". "Colours": "Colour", "Black and white".
  - "Relationship notation": "Crow's foot", "UML".
  - "Keep a table on one page up to": "Never: break anywhere", "10 rows", "15 rows", "25 rows", "40 rows"; hint "A
    shorter entity moves whole to the next page instead of being cut. Headings always stay with what follows them."
  - Switches: "Cover page", "Contents", "Numbered sections and subsections", "Banded table rows", "Running header",
    "“Draft” mark when from the live model".
- **Header and footer:**
  - "Header, left" (placeholder "{org} · {title}"), "Header, right" ("empty"), "Footer, left" ("{workspace} ·
    {state}"), "Footer, right" ("{pagelabel}");
  - the hint without the logo's part: "Empty uses the grey example. Fields: {org} {title} {client} {workspace}
    {version} {status} {state} {date} {author}, and {page} {pages} {pagelabel} (not in the header's left part).
    “Running header” turns the header off." (the prototype's "below" is wrong: the switch is above).
- **Cover:** slice 25's "Title page" fields (exist). The prototype's labels "Version label" (placeholder "e.g. 1.0")
  and "Status" (placeholder "e.g. For sign-off") are checked against slice 25's in step 4.

**Right panel, a section.**
- "Heading", placeholder: the default heading in the document's language; hint "Empty: the default heading in the
  document's language."
- "Start on a new page"; with Compact, "The Compact template runs sections on."
- Each type's options as the prototype (inventory section 3), without its figure options. For example:
  - "Attribute properties", "Order follows this list. Headers are written in the document's language.", "Layout" with
    the dictionary's three and their hints, "Width of the definition column", "Long definitions" with its three and "A
    moved definition leaves a numbered reference in its place.", "Above each entity's table", "Group by concept", "Each
    concept on a new page";
  - "Long texts (definitions, descriptions, rules, notes)" with its three and their hints;
  - readiness's eight checks, "List the open items under the summary", "Items listed per check", and the hint "The
    definition check follows ISO/IEC 11179's advice: a definition says what the thing is, in more words than its name."
    The baseline hint is left out.
  - The other types' options and hints as quoted in the inventory.

**Refusals (domain).**
- "{module} is off in this workspace." (adding a module's section while it is off).
- "This section type is not installed." (adding a type no module knows).
- "A document holds at most 50 sections." (D10).
- "This heading is too long." (exists).

**Document labels (three languages, the prototype's `LBL`).** The new sections' headings, table headers, cover and
contents words, the checks' labels, the conventions' texts, the Data Vault lines, "Definitions in full", "→ note {n}",
"Page {page} of {pages}" ({pagelabel}). They are listed key by key in step 3's report, as slice 25's F26.

### Earlier specs and fixtures each step touches

| Spec or test | Step | Why |
| --- | --- | --- |
| `e2e/slice-25/S25-02` | 2 | The form's `check-shared` and read-only banner move into the editor's right panel ("Who sees this document"; a segmented choice in the prototype). The rights it checks do not change. |
| `e2e/slice-25/S25-03` | 2, 3 | The form's `checks-dict-columns-keys` moves into a section's options; "each preset makes a document with its sections" changes with the presets (D2). |
| `e2e/slice-25/S25-05`, `S25-06` | 2 | They change options in the form (`check-level-dimensional`, S2T's options): the editor's right panel. |
| `e2e/slice-25/S25-07` | 3, 4 | The demo's documents get more sections (contents, page count); Print stays on `/view`; the style's defaults keep slice 25's frame. |
| `e2e/slice-25/S25-04` | 3 | "logical entities only" holds on the "docs" seed (no star); unchanged unless the demo's dictionary preset changes its section's options. |
| `e2e/slice-25/S25-08` | – | Passes as it is: the demo's documents follow the workspace's language (Q8). |
| `e2e/slice-25/S25-screens` | 2 | The form's screenshot becomes the editor's. |
| `e2e/slice-25/helpers.ts` | 2 | Helpers for the editor (open a section, the right panel). `updateDocumentAs` takes the new fields. |
| `tests/document-tree.test.ts` | 2, 3 | Text's heading moves to the entry; "lists the logical entities only" (line 150) changes with decision 8: dimensional entities with InfoCube on and the level in scope. |
| `src/modules/infodocumenter/domain/documents.test.ts` | 2, 3 | The commands' new inputs and the presets' sections. |
| `tests/documents-demo.test.ts` | 3 | The demo's documents' sections. |
| `tests/infodocumenter-store.test.ts` | 2 | The upgrade and the recipe check with `style`. |
| `tests/document-html.test.ts` | 3 | The renderer's new kinds. |
| `e2e/slice-13`, `e2e/slice-14b` (fields, drafts, leaving a page) | 2 | `useDraft`'s typing callback (F1 a): in the full run. |
| `e2e/parts.ts` | 2 | `e2e/slice-26/` joins the last part (the recut rule). Part 8 was the longest in the last two runs (roadmap). |

### The plan for steps 2 to 5

- **Step 2: the editor and the preview** with slice 25's four sections.
  - The recipe's new fields: the domain schemas, the upgrade, the migration, the local rules.
  - The commands: `updateDocument`'s style and section fields; add, remove, move.
  - `useDraft`'s `onType`.
  - The editor's page with its three panels, the snapshot to the browser (D7), the preview modes and their rules, the
    quick sheet, stopping a layout, the sync, the zoom, Print / PDF.
  - Specs S26-01 to S26-03; slice 25's specs as listed.
  - The reference figures: the snapshot's bytes, and the tree with its render in the browser on "Performance test".
  - **A full run** (F8).
- **Step 3: the sections.**
  - The nine types and the content tree's new kinds (F6).
  - The contributions `entityRole` and `checks` (Q6, F12) from InfoCube; `cube.bus` as InfoCube's second section type.
  - The dictionary's layouts and long definitions; the source tables' scope (F13); readiness's weak definitions (D5).
  - The labels in three languages.
  - The presets (D2) and the demo's documents.
  - Specs S26-04 to S26-07, S26-10's unit tests.
- **Step 4: the style.**
  - The style panel; the templates and IBM Plex Serif (download after Łukasz's OK); accent, colours, paper and
    orientation, notation, keep-rows, banded rows, numbering, running header, watermark; the header and footer fields.
  - The document page and print with the style.
  - Specs S26-08, S26-09; screenshots.
- **Step 5: closing.** As the PRD's section 8: D-81 and the AD-18 note quoted for approval; the roadmap moved into
  `docs/ideas.md`; one full run on the final commit; the manual acceptance steps.

### Questions for Łukasz before step 2

1. **D1:** the dictionary's three layouts as the prototype ("under each row", "as a column" with its width, "one block
   per attribute"), and "under / after / column" for long texts in the other five sections?
2. **D2:** the presets as the prototype's, without Diagrams, and the two reworded descriptions?
3. **D3:** the Data Vault reading in the document's language, model checks in English for now?
4. **D4, D5:** Overview as the prototype (no "what is on no canvas"); weak definitions as InfoDocumenter's own rule?
5. **D6:** keep the prototype's rule that `{page}`, `{pages}` and `{pagelabel}` are dropped from the header's left part?
6. **D7:** the preview's tree built in the browser from a snapshot the editor's page sends once (the editor only; `/view`
   unchanged)?
7. **D8:** the quick sheet's footer from the footer fields?
8. **D9:** double-click focuses "Heading" (no inline rename)?
9. **D10:** at most 50 sections in a document?
10. **D11:** Text stays plain text (D-80), markup noted for later?
11. **Q3:** Auto's threshold at 1,000 ms; stop a running layout when a newer change arrives?
12. **Q8:** a new document stores the workspace's language; older and seeded ones follow the workspace (null)?
13. **F8:** a full run in step 2?
