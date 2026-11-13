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

## Łukasz's answers (12 November 2026)

All thirteen questions as proposed, with these additions:

1. **D1:** yes. The dictionary's three layouts as the prototype ("Definition under each row", "Definition as a column"
   with its width, "One block per attribute"); "Under each row / After the table, numbered / As a column" for long texts
   in the five other sections.
2. **D2:** yes, the presets as the prototype's **without Diagrams, Figure and Changes since a baseline**, with the two
   reworded descriptions.
3. **D3:** yes. The Data Vault reading in the document's language; model checks in English for now. **Also noted in
   `slice-26-roadmap.md`, "Follow-ups outside the slices":** the model checks' texts in Polish and German (about 40 texts
   in the core), with the German words' review.
4. **D4, D5:** yes. Overview as the prototype (no "what is on no canvas"); weak definitions as InfoDocumenter's own rule.
5. **D6:** yes. `{page}`, `{pages}` and `{pagelabel}` are dropped from the header's left part, with the prototype's hint.
6. **D7:** yes, the tree built in the browser from a snapshot the editor's page sends once (the editor only; `/view`
   unchanged). **Also:** confirm that the snapshot holds nothing about people beyond what the app's pages already show
   (no e-mail addresses unless a page shows them to this member), and measure its size and the time to build the tree in
   the browser on "Performance test" and the demo (reference figures, no bar). Step 2's report gives both.
7. **D8:** yes, the quick sheet's footer from the footer fields.
8. **D9:** yes, double-click focuses "Heading" (no inline rename).
9. **D10:** yes, at most 50 sections.
10. **D11:** yes, Text stays plain text (D-80). **Also noted in `slice-26-roadmap.md`, "Later, noted":** light markup in
    Text.
11. **Q3:** yes, Auto's threshold 1,000 ms; a running layout is stopped when a newer change arrives.
12. **Q8:** yes, a new document stores the workspace's language; older and seeded ones follow the workspace (null).
13. **F8:** yes, a full run in step 2.

## Step 2: the editor and the preview (13 November 2026)

### What was built

- **The recipe** (F9 to F11, Q8):
  - `style` (`DocumentStyle`), with its defaults (`STYLE_DEFAULTS`) and its save patch (`stylePatch`), in
    `src/modules/infodocumenter/domain/style.ts`.
  - Each section entry gets `heading` and `newPage`. Text's heading moved from its options to its entry.
  - A new document stores the workspace's documentation language. Slice 25's recipes and the seeded demo documents have
    `language: null` and follow the workspace.
  - `upgradeDocument` is the module's `TableRules.upgrade` (pure, idempotent). The local file's format stays 17, and a
    read writes nothing.
  - The migration `20261113120000_document_style.sql` adds the column and extends `document_definition_recipe_ck`.
- **The commands** (F12, D10, Q9):
  - `updateDocument` takes the style and a section's heading and page break.
  - `addDocumentSection` is refused for a type no module knows, for a module's type while the module is off, and past
    50 sections.
  - `removeDocumentSection` and `moveDocumentSection`.
  - Each is a save with the row's version and a change event, outside undo, with slice 25's `editRefusal`.
- **The editor** at `/w/{ws}/d/{id}` (`app/editor.tsx`) replaces slice 25's form (`form.tsx` removed). It has:
  - the top bar;
  - the left panel: Document, the sections with their switch, up, down and remove, and "+ Add section" with every
    registered type (a module's type is disabled while its module is off);
  - the preview;
  - the right panel: for Document, the model state, scope, sharing, audience and cover; for a section, its heading,
    "Start on a new page" and its options;
  - the read-only bar with "Duplicate as my document".

  The style's panel is step 4. This step stores and reads the style: the page frame's fields and the language.
- **`onType`** on `useDraft`, `TextField` and `TextArea` (F1 a).
  - It is called with the element's text on the element's own `input` event, and when the field writes its element
    itself: a stored value taken, Escape, "Use this", a trim.
  - Every other field is unchanged.
- **The tree in the browser** (D7).
  - The editor reads the snapshot once, when it opens (`documentSnapshotAction`).
  - It builds the document state once per snapshot, and the tree on each change.
  - The tree comes from the stored recipe with the text fields' drafts applied (`ui/drafts.ts`): 500 ms after the last
    keystroke for typing, and when the save's page arrives for any other change.
  - A change that draws the same recipe builds nothing.
- **The preview** (`app/preview.tsx`; F2, F3, F7, D8):
  - the modes Auto (1,000 ms), Exact pages and Quick preview, kept per tab for the session;
  - "Pages out of date…" with "Update pages";
  - a layout runs off screen and is swapped in when done, so the old pages (or the quick sheet) stay meanwhile;
  - a newer change stops the running layout;
  - the quick sheet (`DocumentHtml` with `quick`): one sheet per page break, the watermark, and the footer fields with
    "–" for the page numbers;
  - the zoom: Fit width (from a `ResizeObserver`), 75 %, 100 %;
  - the sync: a click on a row scrolls the preview to the section and outlines it, a click in the preview selects its
    section, and a double-click goes to the section's Heading (D9);
  - Print / PDF lays out real pages first when the quick sheet shows.
- **The page frame** from the style's fields (F9, D6):
  - The tokens are `{org}`, `{title}`, `{client}`, `{workspace}`, `{version}`, `{status}`, `{state}`, `{date}` and
    `{author}`; `{page}`, `{pages}` and `{pagelabel}` become the pages' counters.
  - An empty field shows the grey example.
  - The header's left part drops the page tokens.
  - With the running header off, the header is empty.
  - The watermark prints only while it is on.
  - The defaults draw slice 25's frame (top left, top centre, bottom left, bottom right).

### Where the build differs from step 1's plan, and what I assumed

1. **The snapshot comes with a read when the editor opens, not in the page's props.**
   - A save revalidates the page. In the props, the snapshot (2.2 MB on "Performance test") would come again with every
     save; read once, it is sent once, as D7 says.
   - The cost: model changes that others make while the editor is open reach the preview only after a reload.
2. **Stopping a layout** (F7).
   - Paged.js 0.4.3's `chunker.stop()` does not end a layout: its flow starts again from the break.
   - Instead, the editor makes the stopped layout's next page fail (its `renderAsync`), which ends the flow, and destroys
     the layout once the flow has ended.
   - Paged.js also keeps a `ResizeObserver` on each page after a layout. Moving the pages into view or zooming them re-ran
     its underflow check on an ended flow, which threw (page errors in the dev overlay). The editor disconnects these
     observers when a layout is done.
   - `/view` is unchanged.
3. **"Who sees this document"** is the prototype's segmented choice (Private, Shared with the workspace), shown to every
   member.
   - For a member who may not share it is disabled, with "Only modelers, admins and owners share documents.".
   - When only the author may make the document private, it shows slice 25's reason.
   - Slice 25's check box is gone.
4. **"Model levels" stays shown with InfoCube off**, as slice 25's form had it. The prototype shows it only while
   InfoCube is on; I did not change it without a decision.
5. **The skipped sections' note** is one line per module above the preview, "Skipped while {module} is off:
   {sections}.", as the prototype has it. The document keeps slice 25's per-section notes in its contents.
6. **Paper and orientation are not in the preview yet.** Step 4 brings their CSS and F7's "give way at once".

### D7: the snapshot and the tree in the browser (reference figures, no bar)

**The method.**
- The machine: the laptop (Intel Core i7-8550U, 8 logical processors, 7.9 GB, Windows 11).
- The app: the measurement build in headless Chromium 153, on the e2e data file reseeded by the fixtures.
- Per document: one warm-up load of the editor, then 5 loads. Medians, with the fastest and the slowest in brackets.
- The script is uncommitted: `scripts/s26-measure/S26-D7.spec.ts`, run as step 1's with
  `--config scripts/s26-measure/playwright.config.ts S26-D7`.

| Document | Pages | Snapshot received (decoded) | Document state | Tree | First layout |
| --- | --- | --- | --- | --- | --- |
| Performance test, dictionary | 42 | 131 KB (2.24 MB) | 3.3 ms (2.5–8.7) | 7.7 ms (5.3–13.5) | 2.72 s (2.64–4.89) |
| Performance test, source-to-target | 69 | 131 KB (2.24 MB) | 4.1 ms (3.2–5.4) | 4.3 ms (3.9–5.0) | 3.09 s (2.91–3.30) |
| Demo, data dictionary | 6 | 17 KB (193 KB) | 2.0 ms (1.2–2.3) | 1.5 ms (0.9–1.8) | 0.14 s (0.13–0.17) |
| Demo, S2T with the Dimensional model | 9 | 17 KB (193 KB) | 1.4 ms (1.0–2.5) | 2.7 ms (1.8–3.5) | 0.29 s (0.27–0.33) |
| Demo, Anna's dictionary | 6 | 17 KB (193 KB) | 1.4 ms (0.8–2.2) | 1.1 ms (0.6–4.3) | 0.13 s (0.12–0.14) |

- "Received" is the network's count of the compressed answer; "decoded" is the answer's text.
- **People in the snapshot** (`app/snapshot.ts`, `browserSnapshot`):
  - each person's id and name only; e-mail and last sign-in are blanked;
  - no member rows (roles);
  - the organization's row: its name and versions (its password hash is in another table, never in a snapshot).

  The measurement searched every answer for an e-mail address and found none. The rest of the snapshot is the
  workspace's model, requirements, projects, the canvases' cards and the module rows, which the member already sees on
  the canvas pages and the homes.
- Building the tree is not the cost: it takes under 10 ms on "Performance test". The layout is the cost (Q3).

### Earlier specs and tests changed in step 2

| Spec or test | Why |
| --- | --- |
| `e2e/slice-25/S25-02` | The editor's "Who sees this document" (segmented, shown to everyone) replaces the check box `check-shared`; new documents open the editor (`page-document-editor`). The rights it checks are unchanged. |
| `e2e/slice-25/S25-03` | The editor replaces the form; the sections are rows on the left (`editor-section`); a section's options are in the right panel once it is selected; Blank's Text has its heading on its entry (F10). |
| `e2e/slice-25/S25-05` | S2T's "Group by" is in the right panel once the section is selected. |
| `e2e/slice-25/S25-06` | The "off" tag is on the section's row on the left. |
| `e2e/slice-25/S25-screens` | The editor's screenshot replaces the form's. |
| `e2e/slice-25/helpers.ts` | `sharedChoice`, `sharedButton`, `expectShared` and `setShared` for the editor's choice. |
| `tests/document-tree.test.ts`, `tests/document-html.test.ts`, `scripts/bench-documents.ts` | The recipe has `style`; entries have `heading` and `newPage` (slice 25's are read through `upgradeSection`); the frame has its four fields. |
| `src/modules/infodocumenter/domain/documents.test.ts` | Entries have `heading` and `newPage`. |
| `tests/infodocumenter-store.test.ts` | The recipe check with `style`; a slice 25 row read with the upgrade, the file unchanged. |

- New in this step:
  - `e2e/slice-26/`: S26-01 to S26-03, S26-screens, the helpers and the fixtures;
  - `domain/editor.test.ts`;
  - `ui/drafts.test.ts`.
- `e2e/slice-26/` joins part 8 of the full run (the recut rule; `PART_STARTS` is unchanged).

### The full run (F8: `useDraft` changed)

- **The first full run failed:** https://github.com/LukaszWolski-DA/infomapper-app/actions/runs/43388262282 on `1955445`,
  with one failure in part 8, S26-02 "Exact always lays out real pages".
  - The cause was in the application. Switching the preview's mode re-ran the layout effect, so choosing "Exact pages"
    laid out the same pages again, and the test's layout count was off by one, depending on timing.
  - Fix `2d7dda1`: a mode switched on the same document shows its pages without a new layout. The spec checks it.
  - A single-file check passed 3 of 3: https://github.com/LukaszWolski-DA/infomapper-app/actions/runs/43390860726.
- **The full run on `2d7dda1` passed:** https://github.com/LukaszWolski-DA/infomapper-app/actions/runs/43390880513.
  - 773 passed, 0 failed, 0 flaky, 5 skipped, 0 expected failures.
  - Wall-clock 14 min 15 s, from 08:08:24 to 08:22:39.

  | Part | Time | Heap peak |
  | --- | ---: | ---: |
  | 1 | 6 min 20 s | 954 MB |
  | 2 | 7 min 24 s | 1,396 MB |
  | 3 | 9 min 6 s | 1,046 MB |
  | 4 | 9 min 56 s | 1,207 MB |
  | 5 | 11 min 29 s | 1,215 MB |
  | 6 | 10 min 49 s | 1,199 MB |
  | 7 | 8 min 27 s | 1,196 MB |
  | 8 | 12 min 17 s | **2,088 MB** |

  - Nothing restarted; part 8's peak is 33 % of the runner's threshold.
- **Part 8's heap is past CLAUDE.md's 2 GB mark** ("move the cuts or add a part"), with slice 26's 12 specs in it. It is
  also the longest part, 48 s ahead of part 5, under the recut rule's minute.
  - A recut is shared infrastructure: it goes to a `chore/` branch, not this slice. The roadmap's follow-up already
    names it.
- **The element guard passed** on the measurement build (`S3B-15-elements` against `slice-08.json`): viewport 4,508 /
  19,305 / 1,465 / 4,907, page totals 6,137 / 20,934 / 3,004 / 6,446. The editor is not a canvas page.

## Łukasz's answers to step 2 (13 November 2026)

- The snapshot read once when the editor opens, and the stopped layout made to fail, stay as built. Both go into
  `known-limitations.md` at the closing; the second goes beside the Paged.js alias (check both at a Paged.js upgrade).
- "Model levels" is hidden while InfoCube is off, as the prototype; done in step 3.

## Step 3: the sections (13 November 2026)

### What was built

- **The content tree's new kinds** (F6; `src/domain/document/content.ts`, InfoMapper's domain, so InfoCube builds them too):
  - **Runs:**
    - a chip (`plain`, `pii`, `bk`, `key`);
    - a mark in a circle ("ƒ", "!");
    - a concept's swatch;
    - a coverage bar;
    - a relationship end in a notation;
    - a mapping line in its status's dash;
    - the fed and not-fed dots;
    - a passed check's tick;
    - a moved text's reference.
  - **Nodes:**
    - `list`: bullets, numbered, in two columns, or plain;
    - `cards`: one block per attribute or per requirement;
    - `group`: an entity's block, with its concept's mark, kept together when step 4's keep-rows says so;
    - a table's `style`: `narrow`, `fixed` (with the columns' widths), `checks`, `legend`, `matrix` (with vertical
      headers);
    - a heading's swatch.
  - The renderer (`ui/document-html.tsx`) draws them from the prototype's classes, with React elements only (no HTML
    from strings). The small drawings are React SVG.
- **The long texts** (D1): `longTextTable` in `src/domain/document/blocks.ts` (the prototype's `ltable`). A table's long
  columns go under each row (labelled when there are several), after the table as numbered notes (the row carries
  "→ 1, 2"), or into their own column. Five sections use it: S2T, Source tables, the register, Requirements (table) and
  Data quality rules.
- **The sections**, each pure, each reading the document's state through the app's own rules:
  - **Model overview** (`sections-model.ts`, D4): the workspace's description; the counts in scope (entities of both
    drawn levels, source tables F13, shown mappings with how many are approved, every requirement); the concepts with
    their entities.
  - **Model readiness** (`readiness.ts`):
    - definitions missing, and weak ones by InfoDocumenter's own rule (`isWeakDefinition`, D5);
    - attributes neither mapped nor fed, by the app's rule (`countsAsMapped` with mappings and feeds, slice 18's F1);
    - type problems of the shown mappings (`checkMappingTypes`);
    - every mapping not approved;
    - requirements touching the scope that are not covered (`coverage`);
    - the model's own checks (`modelChecks` with the scope's entities and the modules' checks, D-75): the groups and
      lines in English (D3), "High" as a pill;
    - at most the chosen number of items per check, then "… and {n} more".
  - **Conventions and notation** (`sections-model.ts`):
    - the four relationship ends: crow's foot until step 4's notation style;
    - the statuses, with their dashes and four-eyes when it is on;
    - the eight marks;
    - the stereotypes the scope's logical entities use, with the workspace's names and definitions (D-79,
      `stereotypeUses`);
    - the classifications the scope's tables use (D-78; Data Vault ones only in Data Vault 2.0 mode);
    - the physical types in the sources with their logical types (`logicalTypeOf`);
    - the workspace's naming conventions, then the document's own.
  - **Source tables** (`sections-sources.ts`), each table in scope (F13) with:
    - its path ("CRM / crmprod.dbo") and classifications;
    - the modeller's note;
    - its columns, with "missing from the source" or "retired", their classifications, what reads them (shown
      mappings) and their notes;
    - in Data Vault 2.0 mode, the Data Vault reading (`dataVaultReading`) in the document's language (D3: the lines are
      structured, only the words are the document's).
  - **Classification register** (`sections-sources.ts`):
    - each chosen classification, in the workspace's list order (a built-in one stored by its code, an own one by its
      id: an own one may have no code, D-78), with its definition;
    - its tables, or its columns with what reads them;
    - under personal data, the scope's logical attributes marked as personal data.
  - **Requirements and coverage** (`sections-requirements.ts`):
    - one block per requirement (its key chip and name, its properties, its parent, its description, a data quality
      rule's expression), or one table;
    - the coverage bar `{covered}/{total}` (D-31's rule at both levels, D-70);
    - only those touching the scope when chosen.
  - **Traceability**: per requirement (non-functional ones left out) its attributes in scope, with:
    - where each is mapped from: a dimensional one through its feeds' inputs and their columns;
    - the dimensional attributes it feeds (a column shown only with the dimensional level drawn);
    - whether it is covered.

    One table per requirement, or one matrix.
  - **Data quality rules**: one table of the rules (requirements of that kind). The rule and the description are long
    texts; "Applies to" lists the attributes, else the entities.
  - **Bus matrix**, InfoCube's second section type (`CUBE_BUS_SECTION`, through the extension point): the scope's
    facts against its dimensions (`busMatrix`), a dot per relationship, and the number of facts per dimension. It has
    nothing to set (`optionNote`).
- **The data dictionary** (`builders.ts`, D1):
  - **The three layouts:**
    - the definition under each row;
    - the definition as a column, with its width; the other columns share the rest by the prototype's weights;
    - one block per attribute.
  - **Long definitions:** over 300 or 600 characters a definition moves to "Definitions in full" at the end, leaving
    "→ note {n}".
  - **Concepts:** grouped by concept or not; each concept on a new page.
  - **Dimensional entities (PRD item 8):**
    - the dimensional entities with their role in InfoCube's words, where a logical entity's stereotype stands;
    - each dimensional attribute's "Mapped from" is its feeds, "Entity.attr + Entity.attr", with the status pill while
      drafts are marked;
    - the coverage line counts fed rows by the app's rule.

  Slice 25's dictionaries keep their look: the new options have defaults.
- **InfoCube's contributions** (Q6, F12; `DocumentContributions` in `src/domain/document/state.ts`):
  - **What it gives:** whether the dimensional level is drawn (InfoCube on), an entity's role in a language
    (`cubeDocumentRoles`: `cubeTitle`'s long text in InfoCube's document words), and its model checks
    (`cubeModuleChecks`).
  - **Wiring:** `documentStateFor` (`src/compose/documents.ts`) joins them; InfoDocumenter never names InfoCube.
  - **A feed's status:** `AttributeFeed` gets an optional `status` for a document's mapping filter, which InfoCube's
    `cubeRequirementFeeds` sets.
- **Source tables in scope** (F13): `sourceTablesInScope` in `scope.ts` (`SectionScope.tableIds`), the prototype's
  rule:
  - the tables with a column a shown mapping reads into an entity in scope;
  - with no concept chosen, also the tables on the scope's canvases;
  - with neither a project nor a concept chosen, every table.

  Source tables, the register, the conventions and the overview use it.
- **The presets** (D2): the prototype's without Diagrams, Figure and Changes since a baseline.
  - **Dictionary preset:** Text, Model overview, Conventions (statuses and types off), Data dictionary, Requirements,
    Data quality rules, Classification register.
  - **S2T preset:** Conventions (stereotypes off), Source-to-target, Source tables, InfoCube's Dimensional model in its
    place while InfoCube is on, Data quality rules; no draft mark.
  - **Blank preset:** Text.

  The descriptions are D2's rewording. The demo's three documents are made by the same rule, so they have these
  sections.
- **The editor:**
  - **Options:** every section's options as the prototype's (`app/section-options.tsx`, one spec per type: checks,
    lists, segmented choices, selects, the conventions' naming text with its draft feeding the preview).
  - **Add list:** the types in the prototype's order.
  - **"Model levels":** shown only while the dimensional level is drawn (your answer).
- **Labels:**
  - **From the prototype:** 113 new keys in English, Polish and German, from its `LBL`.
  - **New words** (the prototype prints them in English in every language):
    - the requirements' kinds, statuses and priorities;
    - the readiness note "Model checks: InfoMapper's validator (D-75), as the project home shows it.".
  - **InfoCube:** the Bus matrix's title and "Fact" in its three languages.

### Differences from the prototype, and what I assumed

1. **Model checks stay in English** in Polish and German documents (D3), including their group titles in readiness's
   table. "High" is translated.
2. **The relationship ends are crow's foot until step 4** brings the style's notation; the end marks are the document's
   own small SVGs (F6).
3. **The register stores classifications by key:** a built-in one by its code ("PII"), an own one by its id (the
   prototype stores codes; an own one may have no code, D-78). One that is gone is kept and ignored.
4. **The overview's counts** are the scope's entities of both drawn levels, the scope's source tables (F13) and the
   shown mappings, as the prototype counts them; the requirements are all of them (the prototype's).
5. **Readiness's "notFed"** reads the app's fed rule (any mapping or feed, any status, or through a calculation), as
   CLAUDE.md requires for every count of mapped or fed rows. The prototype's `rowStat` read the mapping filter.
6. **An empty section prints "None."** in the document's language. The prototype's placeholders ("Tick at least one
   part in the panel on the right.") are English UI words; the panel's hints say what to tick.
7. **A bug found and fixed in the editor, from slice 25's form.** A list of check boxes (a dictionary's columns, the
   scope's projects and concepts) built its stored list anew on every render. `useChoice` shows a choice only while the
   stored value is the same object, so a ticked box went back at once. The lists keep one object while their content
   is the same.

### Reference figures: the longest preset on "Performance test" (no bar)

The method is step 2's D7: the measurement build, headless Chromium 153, the laptop, one warm-up load of the editor,
then 5 loads, medians. "Performance test" with every mapping shown (`scope.mappings` "all").

| Preset | Pages | Document state | Tree | First layout |
| --- | --- | --- | --- | --- |
| Data dictionary for the business (7 sections) | 37 | 4.4 ms (2.8–4.6) | 3.5 ms (3.4–5.0) | 1.24 s (1.10–1.38) |
| Source-to-target specification for ETL (4 sections; InfoCube off there) | 117 | 3.4 ms (2.7–6.7) | 9.9 ms (7.7–16.0) | 6.38 s (5.50–6.76) |

- The tree is still under 20 ms; the layout is the cost.
- The dictionary preset lays out in about 1.2 s, just over Auto's threshold: a change after its first layout shows the
  quick sheet.
- The S2T preset's Source tables (every column of 200 tables) make 117 pages.
- The script is uncommitted: `scripts/s26-measure/S26-D7.spec.ts`, "the longest preset".

### Earlier specs and tests changed in step 3

| Spec or test | Why |
| --- | --- |
| `e2e/slice-25/S25-03` | The presets' sections are D2's; a section is found by its type, not its place. |
| `e2e/slice-25/S25-04`, `S25-05`, `S25-06` | The demo's documents have D2's preset sections; each spec keeps only the section it reads on (`keepOnly`, test data) and finds sections by type. S25-04's dictionary is on the "docs" seed (InfoCube off): logical only, as before. |
| `e2e/slice-25/S25-07` | The contents list D2's dictionary preset. |
| `e2e/slice-25/S25-08` | The Polish and German documents have D2's sections: every heading checked in its language. |
| `e2e/slice-25/S25-layout` | The dictionary section found by its type. |
| `e2e/slice-25/helpers.ts` | `sectionOf`, `keepOnly`. |
| `e2e/slice-26/S26-01` to `S26-03` | Counts from the stored document. S26-02 and S26-03 test the preview on the shared document's Text and dictionary (`keepOnly`). |
| `tests/document-tree.test.ts` | An entity's block is a group node; with InfoCube on and the dimensional level in scope the dictionary lists the facts and dimensions (PRD item 8); "empty" now needs both levels out of scope. |
| `src/modules/infodocumenter/domain/documents.test.ts`, `editor.test.ts`, `tests/infodocumenter-store.test.ts` | D2's presets; the registered kinds; the dictionary's layout is now an option. |

New: `e2e/slice-26/S26-04` to `S26-07`; S26-screens' step 3 part; `tests/document-sections-26.test.ts` (S26-10, 26 tests).

### Not in this step

- The style's effect on the sections: the notation, keep-rows (the group's `keep` is never set yet), banded rows.
  Step 4 brings it.
- **No full run in this step.** It changes no shared infrastructure (undo, the save chain, the canvas's layers, the
  table registry, the local adapter). The changes outside InfoDocumenter are:
  - in InfoMapper's domain, the content tree's kinds, `blocks.ts`, `state.ts`'s contributions and `AttributeFeed`'s
    optional `status`;
  - in InfoCube, its document words, the Bus matrix section and the contributions.

### German words for Łukasz's review (step 3's new labels)

| Key | English | German |
| --- | --- | --- |
| `t_overview` | Model overview | Modellübersicht |
| `t_sources` | Source tables | Quelltabellen |
| `t_reqs` | Requirements and coverage | Anforderungen und Abdeckung |
| `t_ready` | Model readiness | Modellreife |
| `t_conv` | Conventions and notation | Konventionen und Notation |
| `t_trace` | Traceability | Rückverfolgbarkeit |
| `t_dq` | Data quality rules | Datenqualitätsregeln |
| `t_classreg` | Classification register | Klassifikationsverzeichnis |
| `t_longdefs` | Definitions in full | Vollständige Definitionen |
| `defNote` | note | Fußnote |
| `contents` | Model contents | Modellinhalt |
| `count` | Count | Anzahl |
| `entities` | Entities | Entitäten |
| `tables` | Source tables | Quelltabellen |
| `mappings` | Mappings | Mappings |
| `reqN` | Requirements | Anforderungen |
| `rc_entDef` | Entities without a definition | Entitäten ohne Definition |
| `rc_attrDef` | Attributes without a definition | Attribute ohne Definition |
| `rc_weak` | Definitions that repeat the name or have fewer than four words | Definitionen, die den Namen wiederholen oder kürzer als vier Wörter sind |
| `rc_notFed` | Attributes with no mapping or feed | Attribute ohne Mapping oder Befüllung |
| `rc_type` | Mappings with a type problem | Mappings mit Typproblem |
| `rc_open` | Mappings not approved yet | Noch nicht freigegebene Mappings |
| `rc_req` | Requirements not fully covered | Nicht vollständig abgedeckte Anforderungen |
| `chk` | Check | Prüfung |
| `result` | Result | Ergebnis |
| `more` | … and {n} more | … und {n} weitere |
| `readyOk` | Every check passes. | Alle Prüfungen bestanden. |
| `readyIntro` | Checks of the model state this document describes. The items listed were open when it was generated. | Prüfungen des Modellstands, den dieses Dokument beschreibt. Die aufgeführten Punkte waren bei der Erstellung offen. |
| `mchk` | Model checks | Modellprüfungen |
| `high` | High | Hoch |
| `c_notation` | Relationship notation | Beziehungsnotation |
| `c_one` | Exactly one | Genau eins |
| `c_01` | Zero or one | Null oder eins |
| `c_1n` | One or more | Eins oder mehr |
| `c_0n` | Zero or more | Null oder mehr |
| `c_status` | Mapping statuses | Mapping-Status |
| `s_draft` | Proposed; not reviewed yet. | Vorgeschlagen; noch nicht geprüft. |
| `s_review` | Waiting for approval. | Wartet auf Freigabe. |
| `s_approved` | Agreed; counts towards requirement coverage. | Abgestimmt; zählt zur Abdeckung der Anforderungen. |
| `fourEyes` | Four-eyes approval applies: the author of a change does not approve it. | Es gilt das Vier-Augen-Prinzip: Wer eine Änderung macht, gibt sie nicht frei. |
| `c_marks` | Marks in diagrams and tables | Kennzeichen in Diagrammen und Tabellen |
| `mark` | Mark | Kennzeichen |
| `meaning` | Meaning | Bedeutung |
| `m_pk` | Primary key | Primärschlüssel |
| `m_fk` | Foreign key | Fremdschlüssel |
| `m_bk` | Business key in the source | Fachlicher Schlüssel in der Quelle |
| `m_pii` | Personal data | Personenbezogene Daten |
| `m_calc` | Calculated from other attributes of the same entity | Aus anderen Attributen derselben Entität berechnet |
| `m_f` | Transformation rule on the mapping | Transformationsregel im Mapping |
| `m_warn` | The source type does not fit the attribute | Der Quelltyp passt nicht zum Attribut |
| `m_dot` | Row fed (filled) or not yet (ring) | Zeile befüllt (voll) oder noch nicht (Ring) |
| `c_stereo` | Entity stereotypes | Entitätsstereotypen |
| `used` | Used | Verwendet |
| `c_types` | Physical types in the sources and their logical types | Physische Typen in den Quellen und ihre logischen Typen |
| `phys` | Physical type | Physischer Typ |
| `logical` | Logical type | Logischer Typ |
| `c_naming` | Naming conventions | Namenskonventionen |
| `c_cls` | Classifications used | Verwendete Klassifikationen |
| `classif` | Classifications | Klassifikationen |
| `code` | Code | Code |
| `scopeL` | Applies to | Gilt für |
| `appTbl` | Table | Tabelle |
| `appCol` | Column | Spalte |
| `own` | own | eigene |
| `column` | Column | Spalte |
| `usedBy` | Used by | Verwendet von |
| `piiAttrs` | Logical attributes marked personal data | Logische Attribute mit personenbezogenen Daten |
| `noneCls` | Nothing in this document's scope has this classification. | Nichts im Umfang dieses Dokuments hat diese Klassifikation. |
| `dv_title` | Data Vault reading | Data-Vault-Lesart |
| `dv_hub` | Hub on {c} | Hub auf {c} |
| `dv_hubCand` | Marked as a hub candidate, but no column is a business key yet | Als Hub-Kandidat markiert, aber noch keine Spalte ist ein fachlicher Schlüssel |
| `dv_link` | Link to {t} via {c} | Link zu {t} über {c} |
| `dv_notLK` |  (foreign key; not marked Link key) |  (Fremdschlüssel; nicht als Link-Schlüssel markiert) |
| `dv_lkNo` | Link key {c} with no known relationship: which table does it point to? | Link-Schlüssel {c} ohne bekannte Beziehung: auf welche Tabelle verweist er? |
| `dv_dck` | Dependent child key {c}: part of the link's or satellite's key, not a hub | Abhängiger Kindschlüssel {c}: Teil des Schlüssels eines Links oder Satelliten, kein Hub |
| `dv_dk` | Driving key {c}: an effectivity satellite on the link tracks it | Treiberschlüssel {c}: ein Effektivitätssatellit am Link verfolgt ihn |
| `dv_mak` | Multi-active satellite keyed by {c} | Multi-aktiver Satellit mit Schlüssel {c} |
| `dv_eff` | Effective-dated by {c} | Gültig ab {c} |
| `dv_sat` | Satellite with {n} descriptive column(s) | Satellit mit {n} beschreibenden Spalte(n) |
| `dv_satPii` | ; {n} with personal data: consider a separate satellite for {c} | ; {n} mit personenbezogenen Daten: einen eigenen Satelliten für {c} erwägen |
| `dv_none` | No classifications that suggest a Data Vault reading yet. | Noch keine Klassifikationen, die eine Data-Vault-Lesart nahelegen. |
| `dv_hint` | Hints from the classifications and the source's keys; nothing is created. | Hinweise aus den Klassifikationen und den Schlüsseln der Quelle; es wird nichts erzeugt. |
| `key` | Key | Schlüssel |
| `name` | Name | Name |
| `kind` | Kind | Art |
| `prio` | Priority | Priorität |
| `cov` | Coverage | Abdeckung |
| `scope` | Scope | Umfang |
| `desc` | Description | Beschreibung |
| `req` | Requirement | Anforderung |
| `feeds` | Feeds | Befüllt |
| `covered` | Covered | Abgedeckt |
| `noTrace` | Nothing is traced to this requirement yet. | Mit dieser Anforderung ist noch nichts verknüpft. |
| `severity` | On failure | Bei Verstoß |
| `sev_warn` | Warn | Warnen |
| `sev_block` | Block the load | Ladung blockieren |
| `appliesTo` | Applies to | Gilt für |
| `owner` | Owner | Verantwortlich |
| `noDq` | There are no data quality rules in scope. | Im Umfang gibt es keine Datenqualitätsregeln. |
| `mchkNote` | Model checks: InfoMapper's validator (D-75), as the project home shows it. | Modellprüfungen: der Validator von InfoMapper (D-75), wie ihn die Projektseite zeigt. |
| `k_need` | Business need | Geschäftlicher Bedarf |
| `k_data` | Data requirement | Datenanforderung |
| `k_business_rule` | Business rule | Geschäftsregel |
| `k_dq_rule` | Data quality rule | Datenqualitätsregel |
| `k_non_functional` | Non-functional | Nicht-funktional |
| `st_draft` | Draft | Entwurf |
| `st_agreed` | Agreed | Abgestimmt |
| `st_implemented` | Implemented | Umgesetzt |
| `st_verified` | Verified | Verifiziert |
| `pr_must` | Must | Muss |
| `pr_should` | Should | Sollte |
| `pr_could` | Could | Könnte |
| `pr_wont` | Won't | Nicht jetzt |
| (InfoCube) `busTitle`, `fact` | Bus matrix, Fact | Bus-Matrix, Fakt |

## Step 4: the style (13 November 2026)

### Step 3's checkbox fix: where it lives

- **The fix is in InfoDocumenter's own two components, not in shared code:**
  - `ListChecks` in `src/modules/infodocumenter/app/section-options.tsx`: every section's lists of check boxes, the
    dictionary's columns and fields among them;
  - `IdChecks` in `src/modules/infodocumenter/app/editor.tsx`: the scope's projects and concepts.

  Nothing else in the app uses either: they are module-private functions. `useChoice` itself
  (`src/app/_panels/fields.tsx`) was not changed.
- **No other part of the app has the bug:** no other `useChoice` call passes a list built anew on each render (searched:
  `useChoice<readonly …[]>` appears only in these two). No earlier spec outside slices 25 and 26 covers these
  components.

### What was built

- **The Style panel** in the editor's Document options, after Sharing (`app/style-panel.tsx`, the prototype's labels and
  hints):
  - the document's language, showing the language in effect (Q8: a document stored without one follows the
    workspace's);
  - the template (Standard, Formal, Compact, with the hint of each);
  - the accent colour (four swatches; "Black and white overrides the accent.");
  - paper (A4, A3), orientation, colours (colour, black and white), the relationship notation (crow's foot, UML);
  - "Keep a table on one page up to" (never, 10, 15, 25, 40 rows);
  - the six switches.
- **Header and footer:** the four fields with their grey examples and the hint. Each keeps its draft (D-66) and feeds the
  preview while it is typed (`style.header.left` and the others in `ui/drafts.ts`).
- **The style in the document** (`ui/document-css.ts`, `domain/document.ts`, `ui/document-html.tsx`):
  - **Paper and orientation:**
    - Paged.js's named `@page{size:A3 landscape}`, one size per document;
    - the title page's height from the page's (A4 portrait 248 mm, the slice 25 value; A3 portrait 371 mm; landscape
      161 mm; A3 landscape 248 mm);
    - the quick sheet's width and page height, and the preview's "Fit width", follow them too.
  - **The templates** (`styleCss`, the prototype's `tpl-*` rules). They are written without a root class, since
    Paged.js lays out the source's content and not its root element.
    - Formal: IBM Plex Serif for the body text, sans headings, tables and meta lines; a ruled cover; the subtitle in
      italic.
    - Compact: smaller type and tighter tables; its sections run on (`newPage` ignored, and the section's "Start on a
      new page" is disabled with "The Compact template runs sections on.").
  - **Accent, and black and white:** the accent from the prototype's four colours. Black and white sets the accent to
    black and greys the chips, pills, bars, swatches and the concepts' marks; the draft mark prints black too.
  - **Numbered sections and subsections:** "1", "1.1" in the headings and the contents (`DocumentTreeSection.number`,
    a heading's `number`).
  - **Banded rows:** the renderer marks every second row (`tbody.even`), so the bands do not restart where Paged.js
    continues a table.
  - **Keep a table on one page up to N:** an entity's block with at most N attributes is a group that is kept together
    (`.dent.keep`). The sections get `keepRows` and the notation in `SectionBuildInput`.
  - **The notation:** Conventions and notation draw their ends in the document's notation. The dictionary's
    cardinalities print the same in both notations, as the prototype prints them.
  - **The switches:** the title page, the contents (without them, the skipped sections' notes stand before the first
    section), the running header (the header's two parts empty; the footer always prints), the draft mark.
- **Header and footer fields** (D6, D8; built in step 2):
  - the tokens `{org}`, `{title}`, `{client}`, `{workspace}`, `{version}`, `{status}`, `{state}`, `{date}`,
    `{author}`; `{page}`, `{pages}` and `{pagelabel}` become counters;
  - the header's left part drops the page tokens (D6);
  - the quick sheet's footer prints the footer fields with "–" for the page numbers (D8).
- **Every view follows the style:** the document page (`/view`), the preview's pages and the quick sheet, and print.
  On a change of the paper, the orientation or the look, the old pages give way at once instead of taking on the new
  layout's global `@page` rules while it runs (F7).
- **IBM Plex Serif** (your OK on 13 November 2026):
  - **The files:** `npm pack @ibm/plex-serif@2.0.0` (OFL 1.1), three unmodified files from `fonts/complete/woff2/` into
    `src/app/fonts/ibm-plex/`, checked with `cmp`:

    | File | SHA-256 | Bytes |
    | --- | --- | ---: |
    | Regular | `024ebce13cec984b46e350dd85fa7c01105c777e116bfe95f097ad7fa93f39f2` | 69,400 |
    | Medium | `f66376aeb33a5b32116558e0de53b76b48531f6388e352aeeb35ad82ea05cfaa` | 73,052 |
    | Italic | `ba5feed9ebae36e3b6ae3486052c90f4f42a294fa67a7c9415985175d19c4c82` | 73,852 |

    The package's licence text is the one already hosted.
  - **Loading:** `src/app/fonts/plex-serif.ts` (`next/font/local`, variable `--font-plex-serif`), loaded only by the
    editor's and the document page's content. The canvas page keeps its fonts: the element guard's page totals are
    unchanged, `<head>` included.
- **Labels:** step 4 adds no document words. The style's words are the editor's (English, as the app); the document's
  own words ("Page", "of", the headings) were already in three languages. Nothing new for the German review.

### Differences from the prototype, and what I assumed

1. **The title page's height** comes from the page's height less the margins (as the prototype's fixed values: 248, 160,
   370 mm).
2. **The language select** shows the language in effect for a document without its own. Choosing one stores it, so a
   document cannot go back to "the workspace's" (the prototype has no such choice either).
3. **The cover's fields stay in "Cover"** (slice 25), after Style and Header and footer, as in the prototype's order.
4. **The draft mark prints black in black and white.** The prototype keeps it orange in every theme.

### Earlier specs changed in step 4

| Spec | Why |
| --- | --- |
| `e2e/slice-25/S25-04` to `S25-08` | Sections are numbered by default (the prototype's default, `numbers: true`); these specs compare headings' and contents' texts, so their documents get slice 25's look as test data (`unnumbered`). |
| `e2e/slice-25/helpers.ts` | `unnumbered`; `sectionText` finds a heading without its number. |
| `e2e/slice-26/S26-05`, `S26-06` | Their headings and contents carry numbers. |

New: `e2e/slice-26/S26-08.spec.ts`, `S26-09.spec.ts`, S26-screens' step 4 part, and `tests/document-style.test.ts`
(12 tests).

### Checks run

- Lint and typecheck pass; `npm test` passes: 177 files, 2,215 tests.
- The slice 25 and 26 specs pass: 25 passed and 1 skipped in slice 25; all 21 in slice 26.
- The element guard passes on the measurement build with the same counts as steps 2 and 3, page totals included.
- **No full run in step 4.** It changes no shared infrastructure: the fonts are a new file loaded by InfoDocumenter's
  pages only, and the root layout is unchanged.

Screenshots: `docs/prd/slice-26-screens/step-4/` (a Formal A3 landscape title page and dictionary page; a Compact page
in black and white, and its title page).
