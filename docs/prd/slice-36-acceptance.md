# Slice 36 – acceptance: step 1 (the PRD checked against the code)

Step 1 of `docs/prd/slice-36-documents-from-a-baseline.md`, 25 November 2026, on `slice/36-documents-from-a-baseline`
from `origin/dev` at `b9db4e5` (the merge of PR 94, chore/e2e-parts-recut). No application code; no `pg:` script, no
connection to `infomapper-dev`; neither `.data/dev-db.json` nor a KB backup was read. "Fact" is read in the code at
`b9db4e5` (file and line); "assumption" is not verified yet and says how it will be. The figures in Q3 and Q9 come from
a throwaway script in the session's scratchpad, outside the repository and not committed, on a fresh demo seed
(`buildSeed` + `addSeedDemoData`) written to a temporary file and read through the local adapter.

## 0. The files

| File | Bytes | `cmp` with Downloads | SHA-256 | Expected (prompt) |
| --- | --- | --- | --- | --- |
| `docs/prd/slice-36-documents-from-a-baseline.md` | 28,272 | equal | `bfd4f4d8e9997e3f8c7ae0fc84e91093cdb4be9c6025cf79d2ee5b7728cca7c4` | equal |
| `docs/prototype/infomapper-prototype-with-sources.html` (on the branch, unchanged) | 990,528 | – | `6d5b5b7f5f00c739f3c799961ec2b6198e3ec407601595fe63c47a400ecdc179` | equal (also the PRD's) |

Downloads held one file of that name, no "… (1)" copy. The prototype's slice 36 hunks were listed in slice 35's step 1
(`slice-35-acceptance.md`, section 0, hunks 1, 10, 15–22); section 4 below compares them with the app.

## 1. The answers (Q1–Q10)

### Q1. Building from a content

**What the builders read (fact).** Every section's `build` reads `DocumentState` only (`src/domain/document/state.ts`),
built by `documentStateFor(snapshot)` (`src/compose/documents.ts:49`) from a `WorkspaceSnapshot<ModuleTable>`
(`src/domain/model/workspace-model.ts:160-182`). `buildDocument` (`src/modules/infodocumenter/domain/document.ts:94`)
reads besides the state: `snapshot.workspace` (name, `client_name`, `doc_language`, and each type's
`available(workspace)`, i.e. `infocube`), `snapshot.organization.name` and `snapshot.people` (the author's name).

**A content is that snapshot without some fields (fact).** `BaselineContent` (`src/domain/baseline/content.ts:40-51`)
keeps `WorkspaceSnapshot`'s field names: `model`, `requirements`, `requirementLinks`, `projects`, `projectCanvases`,
`canvasItems`, `canvases`, `frames`, `modules`, plus `settings` (`dv2_mode`, `four_eyes`, `naming_conventions`,
`infocube`). It lacks `workspace`, `organization`, `labels`, `labelLinks`, `members`, `people`. Its module tables are
`BASELINE_MODULE_TABLES`, which equal `DOCUMENT_TABLES` today (both InfoCube's six; checked by the script), so a content
has every module row a document reads. `store.baselines.content(ws, id)` already returns it in the current shape
(upgrade chain plus the modules' row rules, `src/data/baselines.ts`, `shapedBaselineContent`).

**The inverse (recommendation).** A pure `snapshotOfContent(content, live)` in `src/domain/baseline/` (beside
`baselineContentOf`, so InfoMapper's domain owns both directions):

| Field | From | Why |
| --- | --- | --- |
| `model`, `requirements`, `requirementLinks`, `projects`, `projectCanvases`, `canvasItems`, `canvases`, `frames`, `modules` | the content | the model as it was |
| `workspace` | the live row with the content's four `settings` over it | name, client, documentation language and archive state are the workspace's now; Data Vault mode, naming conventions and InfoCube on/off are the model's then (Data Vault reading, Conventions, the dimensional level) |
| `organization`, `people` | live (as today, through `browserSnapshot` for the browser) | outside a content; the title page's author and organization are today's |
| `labels`, `labelLinks` | `[]` | labels are "out"; a label canvas is not drawn (Q2) |
| `members` | `[]` | as `browserSnapshot` already does |

The live part is one small read (workspace, organization, people), not a second `store.snapshot`: the action reads
`store.workspaces.get`, the organization and `users.listForWorkspace`, then the content. *Assumption:* InfoCube's
availability follows the content's `infocube` setting (a section `cube.dim` in a document from a baseline taken while
InfoCube was off is skipped with its note). The licence stays live: InfoDocumenter itself must be on to open the
document at all (`openRefusal`).

**Where the document is built: in the browser, as every document in the editor is (recommendation).** The editor
builds the tree in the browser from one snapshot read when it opens (D-81; `editor.tsx:199-254`,
`documentSnapshotAction`, `actions.ts:161-168`), rebuilding it on every change and every keystroke's pause. A document
from a baseline takes the same path: `documentSnapshotAction` answers `browserSnapshot(snapshotOfContent(content,
live))` instead of `browserSnapshot(store.snapshot(...))` for a document whose source is a baseline. Nothing else in the
editor, the preview, Print / PDF or Markdown changes. Why not on the server: the editor's rebuild per keystroke would
become a round trip per change, and the document page would need a second renderer. Cost (Q9): the same bytes as the
live snapshot (191 KB against 199 KB on the demo).

**D-87's "the contents never go to the browser"** was written for Compare (the comparison runs on the server; the
browser gets the changes). With this recommendation a document's own source content does reach the browser, as the live
model does today, in the snapshot shape and through `browserSnapshot` (no e-mail, no roles). Every member may read every
baseline (D-87), so nothing new is exposed, but the sentence changes: proposal for D-87's note, "A document from a
baseline gets its content as the editor gets the live model (D-81); a comparison's contents stay on the server." (For
Łukasz to decide, 1.)

**The document page** (`/view`, `pages.tsx:126-153`) builds on the server today (`buildDocument` there). For a baseline
it does the same with `snapshotOfContent`. Its one problem is the time, F7.

### Q2. Figures

**What a content holds (fact):** `canvases` (live, every column: name, look, names, `live_label_id`), `canvasItems`
(live, places, filters, collapse), `frames`, `projects` and `projectCanvases` in tab order (`content.ts:55-80`). On the
demo's "Stage 1 sign-off": 3 canvases, 25 items, 0 frames (slice 35's Q2 table).

**How a figure draws (fact):** `figureDrawing` (`src/domain/document/figure.ts:189-232`) reads `snapshot.canvases`,
`frames`, `canvasItems`, `model`, `labels`, `labelLinks` only. Fed with `snapshotOfContent`, every figure, Diagrams,
the overview's figures, the dictionary's concept frames and InfoCube's star draw the baseline's canvases in their layout
then. A figure whose canvas is not in the baseline shows D-82's existing line "(canvas no longer exists)"
(`figure-node.ts:38-53`), as for a deleted canvas today.

**A label canvas (F5):** the content keeps a live label canvas's row and its items (they are ordinary `canvas_item`
rows), but no labels. `figureDrawing` then finds no label (`figure.ts:229`, `liveLabel` undefined) and draws the items
as a plain canvas: **not** "not drawn", as B3.3 wants. A rule is needed (recommendation): a canvas with `live_label_id`
in a document from a baseline is `{ kind: "label" }`, drawn as a warning line "{canvas}: label canvases are not drawn
from a baseline." in the document's language (a new figure word, Q5). The state needs to know it is a baseline's:
`DocumentState.source` (Q3).

**Making figures from a baseline (F6):** a new Diagrams (the sign-off preset, "+ Add section") gets one figure per canvas
of the scope from the **live** projects today (`scopeCanvases`, `actions.ts:63-69`, used by `createDocumentAction:71`
and `addDocumentSectionAction:121`). For a document from a baseline it must read the baseline's projects and links
(from the content), and leave label canvases out (otherwise the preset makes figures that only say "not drawn").

**Saving a figure (F6):** `updateDocumentAction` refuses a figure added on a canvas or frame that is not live now
(`actions.ts:84`, `FIGURE_CANVAS_REFUSAL`, `commands.ts:131`). For a document from a baseline the check must read the
baseline's canvases and frames (from its content), or a figure of a canvas deleted since cannot be chosen, though the
figure editor offers it (its list comes from the snapshot, `editor.tsx:267-276`).

### Q3. The changes section

**Recommendation: the comparison on the server, the section built in the browser from its result.** Reasons:
- D-87: the comparison runs on the server; the older content never needs to reach the browser.
- Size: a document showing one content and comparing with another would hold two contents in the browser; on Performance
  test one content is 2.2 MB of JSON (slice 35's bench), two are near Vercel's 4.5 MB answer limit
  (`scripts/pg-snapshot-size.ts`). The changes themselves are small (740 bytes on the demo).
- The builders stay pure and synchronous: the section reads a ready list from the state.

**How it fits the editor (recommendation):**
- `DocumentState` gets an optional `source` (`{ kind: "live" } | { kind: "baseline", baseline: { id, name, created_at } }`)
  and `baselines` (the live list, names and times only, newest first) and `changes: (sectionId) => ChangesResult`, a
  lookup the caller fills (`ChangesResult`: `{ older, newer, changes } | { none: true } | { gone: true } | { pending:
  true }`). Without them every builder reads as today (the same pattern as `AttributeFeeds`' optional last argument).
- A read action `documentChangesAction({ workspaceId, documentId })` answers the result for every `changes` section of
  the stored recipe: the older and newer state's contents read on the server (`store.baselines.content`, and for a live
  document `baselineContentNow`), `compareBaselines`, then the scope on either side (Q4). `documentSnapshotAction`
  answers the same results with the snapshot (one request when the editor opens; for a live document the "now" side
  comes from the same `store.snapshot` read, so it equals what the other sections show).
- The editor asks again only after a saved change that changes a result: the source, a changes section's "Compared
  with", the scope, a changes section added. All are saves, never keystrokes (no debounce needed). While an answer is on
  its way the section shows its last result; a new section shows "…" and Print / PDF and Markdown wait (`built`
  includes the changes).
- The document page builds the same results on the server in its own render.
- Markdown reads the same tree, so the section is in it (slice 34's tables).

**A small difference for a live document (F8):** after such a re-ask, the "now" side is the model at that request,
while the other sections show the model as read when the editor opened (D-81: others' changes reach it after a reload).
Recommendation: accept it and list it in `known-limitations.md`; the document page always reads both from one moment.

**The previous baseline and ties (recommendation):** the list's own order, `newestBaselineFirst`
(`src/domain/baseline/names.ts:35`: `created_at`, then `id`), is a total order; "previous" is the next one after the
source in that order (for a live document, the first). Two baselines taken in the same millisecond are then still
ordered, by id (UUID v7, so by creation in practice). The prototype's `x.created <= src.created` (line 10046) compares
minutes and would take a baseline of the same minute that was taken later; the app's milliseconds and id avoid it.

**Cost (fact, the demo, local adapter, median of 15 after one warm-up):** reading the content
`store.baselines.content` 2.2 ms (the content file read and shaped each time); `baselineContentNow` 1.6 ms;
`compareBaselines` ("Stage 1 sign-off" → Now, 4 changes: 2 added, 2 changed, 0 removed) 1.1 ms; the scope on both
sides 0.06 ms and narrowing the changes 0.09 ms. One section costs about 5 ms on the server. Reference on Performance
test (slice 35's bench): compare 14.0 ms (83 changes). Nothing here needs a bar.

### Q4. Scope on either side

**What exists (fact):** `sectionScopeOf(scope, snapshot)` (`src/modules/infodocumenter/domain/scope.ts:17-33`) is pure
over a `WorkspaceSnapshot`: projects and concepts by id (deleted ones ignored), the projects' canvases' entities
(`projectScope`), `entityIds`, `canvasIds`, `tableIds` (`sourceTablesInScope`), the levels and the mapping filter. On
`snapshotOfContent` it resolves the baseline's own projects, canvases and concepts with no change.

**The rule (recommendation, not complex):** resolve `sectionScopeOf` on each side's snapshot; a change counts when its
item is in scope on either side, by its kind:

| Kind | In scope when |
| --- | --- |
| Entity | its id is in `entityIds` on either side, and its level is in scope (`logical`, `dimensional`) |
| Attribute | its entity is (the attribute's entity read on the side that has the attribute, both for a changed one) |
| Mapping | its target attribute's entity is |
| Relationship | either end's entity is (the dictionary's `relationshipsBlock` lists a relationship with either end in scope) |
| Requirement | it touches the scope on either side by the Requirements section's own rule (`touchesScope`, `sections-requirements.ts:39`); with no project and no concept chosen, every requirement |
| Source table | it is in `tableIds` on either side |
| Source column | its table is |

The document's "Mappings included" filter is not applied to the changes (B4.3 names projects, concepts and levels;
a change of a draft mapping is a change; for Łukasz to decide, 3). Cost: 0.15 ms on the demo (Q3). With no project and no
concept chosen nothing is narrowed (`sectionScopeOf` gives every entity and table), so "Make a document" (the whole
workspace) shows the Compare dialog's list exactly. **The PRD's criterion stays** (no fallback to "the whole
workspace" needed).

### Q5. Words

**What exists (fact):** `COMPARE_WORDS = { en: EN, pl: EN, de: EN }` (`src/domain/baseline/words.ts:95`); InfoDocumenter's
`labels.ts` is complete in all three languages (`EN`, `PL`, `DE`, lines 8, 225, 432). The prototype has the section's and
the source's words in three languages (lines 9335–9425: `bl`, `t_changes`, `noChanges`, `noBase`, `missing`, `kind`,
`item`, `what`, `added`, `changed`, `removed`); where it has them they are used below.

**New document labels (`labels.ts`), proposed:**

| Key | English | Polish | German |
| --- | --- | --- | --- |
| `bl` (footer, cover's Model state) | Baseline “{n}” of {d} | Baseline „{n}” z dnia {d} | Baseline „{n}“ vom {d} |
| `wmBl` (watermark) | DRAFT · baseline {n} | WERSJA ROBOCZA · baseline {n} | ENTWURF · Baseline {n} |
| `t_changes` (heading) | Changes since {n} | Zmiany od {n} | Änderungen seit {n} |
| `added`, `changed`, `removed` | Added, Changed, Removed | Dodane, Zmienione, Usunięte | Hinzugefügt, Geändert, Entfernt |
| `kind`, `item`, `what` (columns) | Kind, Item, What changed | Rodzaj, Element, Co się zmieniło | Art, Element, Was sich geändert hat |
| `noChanges` | No changes. | Brak zmian. | Keine Änderungen. |
| `noBase` | Nothing to compare with yet. | Na razie nie ma z czym porównać. | Noch nichts zum Vergleichen. |
| `blGoneSection` | The baseline this section compared with no longer exists. | Baseline, z którym ta sekcja porównywała, już nie istnieje. | Die Baseline, mit der dieser Abschnitt verglichen hat, gibt es nicht mehr. |
| `missing` (the document) | This document points to a baseline that no longer exists. | Ten dokument wskazuje na baseline, którego już nie ma. | Dieses Dokument verweist auf eine Baseline, die es nicht mehr gibt. |
| `labelCanvas` (figure line) | {c}: label canvases are not drawn from a baseline. | {c}: kanwy etykiet nie są rysowane z baseline’u. | {c}: Label-Arbeitsflächen werden aus einer Baseline nicht gezeichnet. |
| section label, description (`+ Add section`, English only as every type's) | Changes since a baseline; What was added, changed and removed since a baseline you choose. | – | – |

"Baseline" stays a loan word in Polish and German, as the prototype writes it.

**`COMPARE_WORDS` in Polish and German, proposed** (the app's UI stays English; these are the document's):

| Key | Polish | German |
| --- | --- | --- |
| kinds | Encja, Atrybut, Mapowanie, Relacja, Wymaganie, Tabela źródłowa, Kolumna źródłowa | Entität, Attribut, Mapping, Beziehung, Anforderung, Quelltabelle, Quellspalte |
| groups | Dodane, Zmienione, Usunięte | Hinzugefügt, Geändert, Entfernt |
| name, alias, stereotype, concept, definition | nazwa, alias, stereotyp, koncept, definicja | Name, Alias, Stereotyp, Konzept, Definition |
| type, PK, FK, BK, personal data, nullable, calculated, rule | typ, PK, FK, BK, dane osobowe, dopuszcza puste, wyliczany, reguła | Typ, PK, FK, BK, personenbezogene Daten, nullable, berechnet, Regel |
| status, kind, source columns, target attribute, note | status, rodzaj, kolumny źródłowe, atrybut docelowy, notatka | Status, Art, Quellspalten, Zielattribut, Notiz |
| label, from min, from max, to min, to max | etykieta, od min, od max, do min, do max | Bezeichnung, von min, von max, bis min, bis max |
| role at the left end, role at the right end, description | rola po lewej stronie, rola po prawej stronie, opis | Rolle am linken Ende, Rolle am rechten Ende, Beschreibung |
| priority, severity, owner, external reference, parent, expression | priorytet, waga, właściciel, odwołanie zewnętrzne, nadrzędne, wyrażenie | Priorität, Schweregrad, Verantwortlich, externe Referenz, übergeordnet, Ausdruck |
| system, database, schema, object type, file format, missing from source | system, baza danych, schemat, typ obiektu, format pliku, brak w źródle | System, Datenbank, Schema, Objekttyp, Dateiformat, fehlt in der Quelle |
| classifications, comment, default, not needed | klasyfikacje, komentarz, wartość domyślna, niepotrzebna | Klassifikationen, Kommentar, Standardwert, nicht benötigt |
| mapping status | Szkic, W przeglądzie, Zatwierdzone | Entwurf, In Prüfung, Freigegeben |
| mapping kind | Bezpośrednie, Transformacja | Direkt, Transformation |
| requirement kind | Potrzeba biznesowa, Wymaganie dotyczące danych, Reguła biznesowa, Reguła jakości danych, Niefunkcjonalne | Geschäftsbedarf, Datenanforderung, Geschäftsregel, Datenqualitätsregel, Nicht-funktional |
| requirement status | Szkic, Uzgodnione, Wdrożone, Zweryfikowane | Entwurf, Vereinbart, Umgesetzt, Verifiziert |
| priority | Musi, Powinno, Może, Nie będzie | Muss, Soll, Kann, Nicht |
| severity | Ostrzeżenie, Blokada | Warnung, Blockierend |
| object type | Tabela, Widok, Plik | Tabelle, Sicht, Datei |
| yes, no, none | tak, nie, – | ja, nein, – |
| "{field} (changed)", "{field}: {old} → {new}" | "{field} (zmieniono)", "{field}: {old} → {new}" | "{field} (geändert)", "{field}: {old} → {new}" |

*Assumption:* where InfoDocumenter's `labels.ts` already names a closed value in Polish or German (a mapping's status in
Source-to-target, a requirement's kind in Requirements), step 2 takes that word instead of the table's, so a document
says one word for one thing; a test compares the two. Every key present in all three is a unit test (PRD).

### Q6. The migration and the local adapter

**Facts:** `document_definition_preset_ck check (preset in ('dictionary', 's2t', 'blank'))` and
`document_definition_source_ck` (`(source_kind = 'live' and baseline_id is null) or (source_kind = 'baseline' and
baseline_id is not null)`) in `20261111120000_infodocumenter.sql:38-40`; `baseline_id uuid references baseline (id)`
(line 27): **the foreign key exists**, to the id only, with no `on delete` (a baseline is soft-deleted, so it holds).
It does not tie the workspace: another workspace's baseline is refused by the domain only (Q7). The local adapter:
`INFODOC_RULES` (`src/modules/infodocumenter/data/tables.ts:15-30`) has the key `baseline_id: "baseline"` (accepts a
deleted target, as the SQL does) and a source check stricter than the SQL's (`ACCEPTED_SOURCE_KINDS` and
`baseline_id === null`).

**The migration (recommendation):** one file, `2026112…_document_signoff.sql` (time in step 2): drop and re-add
`document_definition_preset_ck` with `'signoff'`. Nothing else: `source_ck` already allows a baseline. No new index
(the documents' count, Q8, reads the workspace's documents, a few). RLS unchanged.

**Local adapter (recommendation):** `DOCUMENT_PRESETS` gains `signoff` (the check reads it); `ACCEPTED_SOURCE_KINDS`
goes, and the source check becomes the SQL's pairing rule. No format step: the file's rows are unchanged and a
format-18 file (KB's archive) reads as before.

**Schema workflow (fact):** `tests/schema/compare-schema.test.ts:146` checks `baseline_id`'s column; the schema check
compares columns, not CHECK lists, so it passes unchanged; the migration runs in CI's container and in the contract
suite. `npm run pg:migrate` on `infomapper-dev` is step 4 (Łukasz).

### Q7. The source's writes

**Recommendation:** the source is one more field of `updateDocument` (`commands.ts:154`), so it is a save like any other:
the row's version (D-59), its change event, outside undo (`INFODOC_UNDO` "outside undo",
`src/modules/infodocumenter/domain/tables.ts:15`), InfoDocumenter's edit rights (`editRefusal`, which refuses an
archived workspace). Input `source: { kind: "live" } | { kind: "baseline", baselineId }` (Zod); the action reads the
baseline with `store.baselines.get(workspaceId, id)` (live only, the workspace's only) and passes it; a missing one
(deleted, another workspace's, never existed) is refused with slice 35's "This baseline no longer exists."
(`BASELINE_GONE_MESSAGE`, `names.ts:14`), so another workspace's baseline is never told to exist. The same source
again is "Nothing to change." (as every field). The style is not touched (watermark: for Łukasz to decide, 2).

**Other writes that set a source (recommendation):**
- `createDocument` with `signoff`: the newest live baseline (`store.baselines.list`, newest first), refused with
  "Create a baseline first." when there is none (the domain and the dialog both).
- "New document from it" and "Make a document": the create command takes an optional baseline (and for "Make a
  document" the sections), read and checked by the action as above.
- **`duplicateDocument` (F9):** copies `source_kind` and `baseline_id` (`commands.ts:339-340`). A document whose baseline
  was deleted would be duplicated pointing to a deleted baseline: accepted by both adapters (the key accepts a deleted
  row) and consistent with the original (the copy says the same). Recommendation: keep it so (a copy is a copy); the
  refusal "at the time of the write" applies to writes that choose a baseline.

### Q8. The documents' count

**Recommendation:** a pure count in InfoDocumenter's domain (`documentsFromBaseline(rows, baselineId)`: live rows with
`source_kind = "baseline"` and that `baseline_id`, every author's) read through `store.modules.list(ws,
"document_definition")` on both adapters (already contract-tested as a read). **The Baselines tab is InfoMapper's**
(`src/app/w/[workspaceId]/_components/baselines.tsx`) and InfoMapper never imports a module (AD-33, lint), so the count
reaches it through the composition root (F1): the home page (`src/app` may import `src/compose`) asks
`baselineDocumentCounts(store, workspaceId)` (`src/compose/baselines.ts`) with the tab's other data and hands the tab a
number per baseline; only the number reaches the browser, never a name. While InfoDocumenter is off the count is 0 and
the line is not shown (the documents stay). Cost: one read of the workspace's documents when the Baselines tab opens (no
content).

### Q9. Reading

**Facts:** the Baselines tab reads `store.baselines.list` (rows without the content; AD-14's note, `ROW_COLUMNS` on
Postgres, the folder on the local adapter); the Documentation tab reads `visibleDocuments` (`app/load.ts:31`: the
documents and the people); neither reads a content. After this slice the Baselines tab adds one read of the documents
(Q8), still no content; the Documentation tab adds nothing (the gone mark is dropped, section 3, P9).

**When a content is read (recommendation):** the editor: once when it opens (`documentSnapshotAction`, the source's
content) and once per changes result (Q3: older and newer); again only after a saved change of the source, a "Compared
with", the scope or an added changes section; never per keystroke (typing changes no input of a result). The document
page: on each load. "New document from it" and the sign-off preset: once at the create, for Diagrams' and the
overview's figures (F6). Print / PDF and Markdown read nothing (they use the editor's tree).

**Cost (fact, the demo, local adapter, median of 15):**

| Step | Time |
| --- | --- |
| read the content (`store.baselines.content`) | 2.19 ms |
| read the live snapshot (`store.snapshot`, `DOCUMENT_TABLES`), for comparison | 0.38 ms |
| content → `WorkspaceSnapshot` shape | 0.01 ms |
| `documentStateFor` (the builders' state) | 0.66 ms |
| `buildDocument`, the sign-off preset's 12 sections (3 figures in Diagrams) from the content | 8.62 ms |
| the same on the live model (state and tree) | 8.67 ms |
| `documentMarkdown` of that tree | 7.21 ms |
| bytes: the content / the browser's snapshot from it / the live snapshot | 188,954 / 191,397 / 198,786 |

A document from a baseline costs what a live one costs, plus about 2 ms to read the content. The tree's 171 KB of JSON
is the editor's own (never sent).

### Q10. Risks and shared infrastructure

- **"Ten parts"** (fact): `scripts/e2e.ts:2` and CLAUDE.md lines 592 and 790 still say ten; `e2e/parts.ts` and CLAUDE.md's
  "The full run in eleven parts" say eleven. Fixed in this slice's closing (PRD).
- **The e2e parts:** `e2e/slice-36/` joins part 11 (from `slice-27`, the recut rule); a handful of specs, well inside the
  heap's margin of chore PR 94's runs. Its full-run time is checked against the recut rule at the closing.
- **Shared infrastructure touched:** `src/domain/document/state.ts` (the optional `source`, `baselines`, `changes`),
  `figure.ts` (the label canvas's kind), a new composition point for the Baselines tab (F1), and InfoDocumenter's local
  adapter rules (`INFODOC_RULES`, read by the local adapter). By "Test runs"' exception the local adapter's rules count
  as shared infrastructure: **a full run in step 2 too**, not only in step 3 (P10).
- **The Markdown and PDF paths (D-86):** unchanged for a live document; a baseline changes the front matter, the frame's
  texts and the cover's "Model state" row; `tests/document-markdown-html.test.ts` keeps the HTML unchanged for live
  documents.
- **Size online (assumption):** a baseline's content reaches the browser as the live snapshot does; for KB the live
  snapshot's size is known to `scripts/pg-snapshot-size.ts` (not run in this step: it reads `infomapper-dev`). A content
  is about the live snapshot's size, so the same margin under 4.5 MB holds; Łukasz may run the script at step 4.
- **Nothing changes this plan's shape.**

## 2. Where the PRD is wrong or costs more (with proposals)

- **F1. The Baselines tab is InfoMapper's; its new buttons and the delete dialog's line are InfoDocumenter's.**
  "New document from it", "Make a document" and the documents' count cannot be written into
  `src/app/w/[workspaceId]/_components/baselines.tsx` calling InfoDocumenter (AD-33; `eslint.config.mjs`'s module
  rule). *Proposal:* a small extension point, listed in CLAUDE.md's: `BASELINE_EXTENSIONS` in `src/compose/`
  (plain data and server actions, as `ModuleView`): per baseline row an action button (label, test id, whether shown for
  the person), one for the Compare dialog (given the older and newer side), and the delete dialog's count with its
  sentence. The home page builds it; InfoMapper's tab draws what it is given.
- **F2. "Model state" is a plain text today** (`editor.tsx:562-565`, `EDITOR_TEXTS.modelState`); it becomes the
  prototype's select. The PRD does not say the list's source: the page reads `store.baselines.list` (no content).
  S25-03 reads it with `toHaveText` (section 5).
- **F3. Switching the source must read a new snapshot.** The editor reads its snapshot once per document id
  (`editor.tsx:200-212`, "once per document"); after a source change the preview would keep the old model.
  *Proposal:* the snapshot is keyed by the document's source too, read again once per switch (and the changes, Q3).
- **F4. The editor's Scope lists are the live model's** (`pages.tsx:64,110-111`: `store.projects.list`,
  `model.concepts`), and so are the register's classifications (`optionContext`). For a document from a baseline they
  should be the baseline's (a project deleted since is in its scope). *Proposal:* the editor takes the projects,
  concepts and classifications from its snapshot once read (for both kinds of source, so one path); ids are kept as
  today (F7 of slice 25).
- **F5. A label canvas would be drawn from a baseline** as a plain canvas (Q2). *Proposal:* the figure kind "label" with
  its line; label canvases left out of the Diagrams a baseline document is made with.
- **F6. Figures are made and checked against the live canvases** (Q2: `scopeCanvases`, `FIGURE_CANVAS_REFUSAL`).
  *Proposal:* a document from a baseline makes and checks them against its content; the create and the figure save then
  read the content (a few ms, Q9).
- **F7. The time on the document page.** The PRD wants the baseline's time in the browser's time zone (as slice 35,
  never the server's). The editor builds in the browser, so its footer, cover and Markdown are right. The document page
  (`/view`) builds the tree on the server (`pages.tsx:126-131`), on Vercel in UTC. *Proposal:* the tree carries the
  baseline's time as `{taken}` with its ISO instant; `PagedView` (a client component that already receives the frame's
  CSS) and the cover's row fill it in the browser before Paged.js lays the pages out. Nothing else of the page changes.
  Same for the "Compared with" text in the section's heading if it ever carries a time (it does not: only the name).
- **F8. "Now" in a live document's changes section** may be newer than the rest of the editor's preview after a re-ask
  (Q3). *Proposal:* a known limitation, as D-81's "others' changes reach it after a reload".
- **F9. Duplicate keeps a gone baseline** (Q7). *Proposal:* keep it; the PRD's refusal applies to choosing one.
- **F10. "Make a document"'s name can exceed the 200-character name limit:** two names of up to 120 each give up to 265
  characters with the sentence (`SHORT_TEXT_MAX`, `commands.ts:26`). *Proposal:* cut to 200 and trim, as Duplicate does
  (`commands.ts:330`).
- **F11. "Make a document" made from `blank` with its Text replaced:** the row's `preset` stays `blank` (the CHECK allows
  it); the command takes the one section instead of the preset's. *Proposal:* `createDocument`'s input gains an optional
  `changesSince` (older baseline id) and `source`; with them the sections are only the changes section, the audience
  null, the watermark the preset's (`blank`: on; *assumption:* off for a baseline source as the sign-off's, for Łukasz 2).
- **F12. The prototype's changes section compares with the live model even in a document from a baseline**
  (`now = modelPart(S)`, line 10053; `src` only orders the two). The PRD is right ("the document's source"): the app
  follows the PRD, not this line.
- **F13. A chosen baseline newer than the document's own state** (a baseline document compared with a later baseline):
  the older state is the start (B4.2), so the comparison runs from the document's state to the chosen one, and the
  heading "Changes since “{chosen}”" would name the newer one. *Proposal:* the heading always names the older state:
  "Changes since “{older}”" (for Łukasz 4).
- **F14. The documents' count in the delete dialog counts InfoDocumenter's rows from InfoMapper's page** (Q8, F1);
  online the count is a read of the module table through the composed store, no new port.
- **F15. Step 2 needs a full run** (Q10, P10).
- **F16. The PRD's editor note "under Model state"** stands above the preview in the prototype (`de-note`, line 10485),
  and the prototype has a hint under the select the PRD leaves out: "A baseline gives the same document every time; the
  live model always shows today." (line 10509). *Proposal:* the prototype's places and both texts (for Łukasz 5).
- **F17. Print / PDF and Markdown's disabled title:** the prototype's is "This document points to a baseline that no
  longer exists. Choose another source under Model state." (`expOff`, line 9499); the PRD's "that reason". *Proposal:*
  the prototype's (it says what to do).
- **F18. A gone chosen baseline:** the prototype shows "Nothing to compare with yet." (`againstOf` finds none); the PRD
  "The baseline this section compared with no longer exists.". *Proposal:* the PRD's (it says why).

## 3. Smaller points (proposals)

- **P1. "New document from it"'s name:** the PRD does not say; the prototype names it "Documentation of “{name}”"
  (line 10360), the sign-off preset from "New document" by the preset's label. *Proposal:* the prototype's (for Łukasz 6).
- **P2. The groups' headings:** the prototype writes "Added (2)" with the count (line 10055). *Proposal:* with the count.
- **P3. "Compared with"'s hint:** the prototype's "Compares that baseline with the document's own model state; the older
  one is always the starting point." (line 10050), and "Previous baseline (none yet)" when there is none. *Proposal:* both.
- **P4. Prototype order of "Compared with"'s list:** every baseline, the source included (it then shows "No changes.").
  *Proposal:* the same (no special case).
- **P5. The cover's "Model state" row** says the same as the footer's `{state}` ("Baseline “{name}” of {date time}"),
  as the prototype's `srcTxt` (line 10233).
- **P6. The watermark text for a baseline** ("DRAFT · baseline {name}") is the PRD's; the prototype has only "DRAFT ·
  live model" for every source (line 10258). The PRD's is better; its Polish and German in Q5.
- **P7. The sign-off preset's options:** the prototype's `PRESETS.signoff` (line 9533) gives options only to Text and the
  overview's figure ("Logical data model" as its caption); every other section takes the app's defaults. *Proposal:* the
  overview's figure the first project's first canvas in tab order with the prototype's caption in the document's
  language; Diagrams made from the baseline's canvases (F6).
- **P8. The demo:** the prototype seeds a shared "Retail Co – stage 1 documentation" from the sign-off preset (line 9549).
  *Proposal:* no demo document (the PRD's assumption): S36-06 asks for the demo's documents unchanged, and the specs make
  their own (for Łukasz 7).
- **P9. The Documentation tab's "baseline gone" mark:** not in the prototype. *Proposal:* drop it in this slice
  (`docs/ideas.md`); the editor and the page say it (for Łukasz 8).
- **P10. Test runs:** full runs in steps 2, 3 and 6 (step 2 by "Test runs"' exception, F15).
- **P11. Generate version** is disabled for a gone baseline in the prototype; the app has no versions (D-81: later).
- **P12. Deleting a baseline touches no document** (no cascade): InfoDocumenter's table is "outside undo", so it
  registers no parent for `moduleCascade` (`src/domain/commands/module-cascade.ts`). *Assumption*, a unit test in step 2.

## 4. The prototype against the app (what this slice touches)

| Prototype | App today (fact) | In this slice |
| --- | --- | --- |
| Model state select `data-dsrc` with live, each baseline, the gone option (10508) | a plain text (`editor.tsx:562-565`) | the select (F2) |
| hint under it (10509) | – | F16 |
| note above the preview for a baseline (10485) | – | F16 |
| preview's "missing" sheet (10231), Print / Markdown / Generate disabled (10447, 9499) | Print and Markdown enabled when built (`editor.tsx:418-421`) | the message and the disabled buttons (no Generate) |
| footer and cover `bl` (10233) | "Live model on {d}" (`document.ts:101`) | `bl` (Q5), browser time (F7) |
| watermark "DRAFT · live model" for every source | the same (`document.ts:161,180`) | "DRAFT · baseline {name}" (P6) |
| changes section `reg(CORE, {type:"changes"…})` (10048–10055) | no such type | the section (Q3, Q4, F12, F13, F18, P2–P4) |
| `PRESETS.signoff` (9532), disabled without a baseline (10388) | three presets (`presets.ts`) | the fourth (P7) |
| "New document from it" on a baseline's row (10349, 6429) | Compare…, Rename, Delete (`baselines.tsx:126-143`) | via F1 (P1) |
| "Make a document" in Compare (6362, 10391) | Close only | via F1 (F10, F11) |
| delete dialog's documents' line (6342) | "It cannot be brought back here." (`baselines.tsx:364`) | via F1, counted on the server (Q8) |
| seeded shared sign-off document (9549) | three demo documents (`data/demo.ts`) | not seeded (P8) |
| Markdown | `source: "live model"` (`markdown.ts:393`) | the PRD's three keys (S36-04) |

## 5. Earlier specs and tests, by step

**Step 2 (domain and data):**
- `src/modules/infodocumenter/domain/documents.test.ts:115`: loops over `PRESETS` expecting `source_kind: "live"`; the
  sign-off needs a baseline (the loop's case for it changes).
- `tests/infodocumenter-store.test.ts:95-96`: expects a baseline source refused by the check; it becomes accepted with
  a live baseline, refused with none (the key) and refused in its pairing.
- `tests/layer-rules.test.ts:80` imports `DOCUMENT_PRESETS` as a probe: unchanged.
- `tests/baseline-compare.test.ts` reads `COMPARE_WORDS.en`: unchanged; new cases for `pl` and `de`.
- `tests/document-markdown.test.ts`, `tests/document-markdown-html.test.ts`, `tests/document-figures*.test.ts`,
  `tests/document-html.test.ts`: unchanged for live documents (the optional state fields absent); new cases beside them.
- Contract suite (`tests/contract/reads.test.ts`, `writes.test.ts`): new cases (source to a baseline and refused, the
  sign-off row, the count with another person's private document).
- Full run (F15).

**Step 3 (pages):**
- `e2e/slice-25/S25-03.spec.ts:35`: `text-model-state` `toHaveText("Live model (changes as people work)")` becomes the
  select's chosen option (the test id moves to the select; the assertion reads its value).
- `e2e/slice-25/S25-02.spec.ts:37`, `S25-03.spec.ts:8`: the preset buttons by test id; the fourth button does not change
  them. The dialog's text (`S25-03.spec.ts:11`, `toContainText`) is unchanged.
- `e2e/slice-34/S34-02.spec.ts:24`: the front matter of a live document, unchanged.
- `e2e/slice-35/S35-02.spec.ts:86,96,129`: counts of `button-baseline-compare` and the delete text by its own test id;
  the new button and the documents' line get their own test ids, so unchanged (the demo has no document from a
  baseline).
- New `e2e/slice-36/` S36-01 to S36-05 with the demo accounts; S36-06's live part is the earlier specs.

## 6. The plan for steps 2 to 6

2. **Domain and data:** `snapshotOfContent`; `DocumentState.source`, `baselines`, `changes`; the label canvas's figure
   kind; `COMPARE_WORDS` PL and DE and the new labels; the changes section (`changes` type: options, heading, builder,
   scope on either side, three messages); the sign-off preset; the source in `updateDocument`, the create's baseline and
   changes options, the refusals; the frame's and cover's texts, the watermark, Markdown's front matter; the documents'
   count; the migration; `INFODOC_RULES`; the composition (`documentSnapshotAction` for a baseline, `documentChangesAction`,
   `baselineDocumentCounts`, `BASELINE_EXTENSIONS`'s data); unit and contract tests. A draft PR into `dev`; a full run (F15).
3. **Pages:** Model state with its hint and the note; the snapshot per source (F3) and the lists from it (F4);
   "New document from it"; the preset picker's disabled sign-off; the changes section's options; "Make a document"; the
   gone baseline's message and disabled buttons; the delete dialog's line; the document page's time (F7); the e2e specs
   and screenshots beside the prototype; a full run.
4. **Łukasz's migration:** `pg:backup`, KB's counts, `pg:migrate`, KB's counts again. Stop.
5. **Łukasz's acceptance** on `dev:pg` with the demo accounts (a baseline taken by hand; long lists and renames to try).
   Stop.
6. **Close:** the docs (D-88, the notes, `data-model-v2.md`, `known-limitations.md` with F8, `ideas.md` with P9,
   `inventory-prototype-vs-app.md`, README, CLAUDE.md with the extension point and the "ten parts" lines), one full run
   on the final commit.

## 7. For Łukasz to decide

Business questions; each has a recommendation.

1. **D-87's sentence "the contents never go to the browser":** a document from a baseline brings its own content to the
   editor as the live model comes today (Q1). Recommendation: accept, with the note's text in Q1.
2. **The watermark when the source is switched:** recommendation: the switch changes the text ("DRAFT · baseline
   {name}"), never whether it is on; only new documents from a baseline (the sign-off preset, "New document from it",
   "Make a document") start with it off.
3. **The changes section and "Mappings included":** recommendation: not applied; every mapping change in scope is listed.
4. **A chosen baseline newer than the document's state:** recommendation: the heading names the older state ("Changes
   since “{older}”", F13).
5. **The note and the hint (F16):** recommendation: the prototype's places and texts (the note above the preview, the
   hint under the select).
6. **"New document from it"'s name:** recommendation: the prototype's "Documentation of “{name}”" (P1).
7. **A demo document from "Stage 1 sign-off":** recommendation: none (P8).
8. **The Documentation tab's "baseline gone" mark:** recommendation: drop, into `ideas.md` (P9).
9. **The Polish and German words in Q5:** for your review, any time before the closing.

Technical points with my recommendation (no answer needed unless you disagree): build in the browser (Q1), the
comparison on the server with the editor asking per saved change (Q3), the scope on either side (Q4), the extension
point for the Baselines tab (F1), the document page's time filled in the browser (F7), Duplicate keeps the source (F9),
the name cut to 200 (F10), full runs in steps 2, 3 and 6 (F15).

## 8. Łukasz's answers (25 November 2026)

1. **D-87's sentence** (Claude's call, technical): accepted. A document from a baseline gets its content in the editor as
   the live model is today (built in the browser, through `snapshotOfContent` and `browserSnapshot`). D-87's note at the
   closing: "A document from a baseline gets its content as the editor gets the live model (D-81); a comparison's
   contents stay on the server."
2. **The watermark:** a source switch changes only the watermark's text, never whether it is on; new documents from a
   baseline (the sign-off preset, "New document from it", "Make a document") start with it off.
3. **"Mappings included"** is not applied to the changes section.
4. **The heading** always names the older state.
5. **The note and the hint:** the prototype's places and texts (the note above the preview, the hint under the select).
6. **"New document from it"** names the document "Documentation of “{name}”".
7. **No demo document** from "Stage 1 sign-off".
8. **No "baseline gone" mark** in the Documentation tab (into `ideas.md` at the closing).
9. **The words:** the Polish words of Q5 are accepted as proposed, "kanwy etykiet" included; German stays for Łukasz's
   review before the closing. InfoDocumenter's existing word is taken wherever `labels.ts` already names the same closed
   value, with a test comparing the two.

The technical recommendations (Q1 to Q4, F1 to F18, P1 to P9) stand as Claude's calls, to be quoted at the closing.

## 9. Step 2: the domain and the data (25 November 2026)

PR 95 (draft, `slice/36-documents-from-a-baseline` into `dev`), commits `3f1d7e0`, `15fc306` and `3da88a6` after
section 8's `2c8f016`: 32 files, 1,571 lines in, 63 out. No connection to `infomapper-dev`, no `pg:migrate` (step 4 is
Łukasz's). No page shows anything new yet (below, "What differs from the plan", 1).

### What was built, by file

**InfoMapper's domain**
- `src/domain/baseline/content.ts`: `snapshotOfContent(content, live, moduleTables)` (Q1): the content's model,
  requirements, projects, canvases, items, frames and module rows; the live workspace's row with the content's four
  settings over it; today's organization and people; no labels, label links or members. `LiveParts`.
- `src/domain/baseline/words.ts`: `COMPARE_WORDS.pl` and `.de` (Q5; answer 9), every key of English's.
- `src/domain/document/state.ts`: `DocumentState.source` (`DocumentSource`: live, a baseline as `BaselineRef`, or gone)
  and `changes` (`ChangesLookup` by "Compared with", `SectionChanges`: a list with its older and newer state, `none`,
  `gone`, `pending`); `documentStateOf`'s optional `extra` (without it: live, every comparison pending).
- `src/domain/document/sections.ts`: `DocumentSectionType.heading`, a heading from what the section shows (used by
  the changes section), in place of `label` when the entry has none of its own.
- `src/domain/document/figure.ts`, `figure-node.ts`: `FigureInput.fromBaseline`, the drawing kind `label` and its line
  (`FigureNodeWords.labelCanvas`, F5).

**InfoDocumenter**
- `domain/types.ts`: `DOCUMENT_PRESETS` with `signoff` (after `s2t`, before `blank`); `ACCEPTED_SOURCE_KINDS` removed.
- `domain/presets.ts`: the sign-off preset (`fromBaseline`, audience "Client", every mapping, no draft mark, the
  thirteen sections, `SIGNOFF_BODY`); `PresetSection.firstFigure` (the overview's figure, the first canvas, captioned
  "Logical data model" in the document's language); `presetSections`' `language`.
- `domain/sections.ts`: the kind `changes` (`changesOptions`: `against`, a baseline id or null), after `dq`.
- `domain/sections-changes.ts` (new): `changesPlan` (which states: the previous baseline in the list's order, a chosen
  one, the older first, `none`, `gone`), `changesInScope` (Q4's table, either side), `changesRequestKey` (the re-ask
  key: source, projects, concepts, levels, the "Compared with"s; not the name or "Mappings included"),
  `changesHeading` (names the older state, answer 4), `buildChanges` and `changesTables` (groups with their counts,
  P2; Kind, Item, What changed in the document's words; the three messages and "…" while pending).
- `domain/builders.ts`: the type `changes` registered ("Changes since a baseline", its description, heading, builder).
- `domain/commands.ts`: `createDocument` takes the live baselines (the sign-off preset from the newest, "Create a
  baseline first." without one; `baselineId` for "New document from it", named "Documentation of “{name}”", answer 6;
  a baseline gone meanwhile refused; no draft mark from a baseline, answer 2); `createChangesDocument` ("Make a
  document": `blank` on the row, the newer state as source, one section against the older, the name cut to 200, F10,
  F11); `updateDocument`'s `source` and its last argument, the live baselines (a source or a "Compared with" chosen must
  be one of them, "This baseline no longer exists." otherwise; one kept from before may be gone); `BASELINE_TEXTS`;
  `documentsFromBaseline` (Q8).
- `domain/document.ts`: the cover's and the footer's model state "Baseline “{n}” of {d}" with `time` (by default
  `localMinute`, this runtime's time zone, the browser's in the editor; F7's document page passes its own in step 3),
  the draft mark "DRAFT · baseline {n}", a section's `heading` from its type, and for a gone baseline no sections,
  contents or figures with `DocumentTree.missing`; `DocumentTree.source`.
- `domain/markdown.ts`: the front matter's `source: "baseline"`, `baseline` and `baseline_taken` (the reader's offset
  from UTC, `localTimestamp`); a gone baseline's line in place of the content.
- `domain/labels.ts`: `bl`, `wmBl`, `t_changes`, `t_changesType`, `item`, `what`, `noChanges`, `noBase`, `blGone`,
  `missing`, `labelCanvas`, `figLogical` in English, Polish and German (`kind` was there).
- `domain/figures.ts`: the label canvas's words; `fromBaseline` from the state's source.
- `data/tables.ts`: the source check as the SQL's pairing (a baseline's id exactly with a baseline source).
- `app/actions.ts`: `documentModelAction` (the editor's model from the source, as the browser may hold it, with the
  live baselines and the comparisons), `documentChangesAction` (the comparisons alone, the re-ask),
  `createChangesDocumentAction`; `createDocumentAction` with the baselines and a baseline's canvases; the figure save's
  check and a new Diagrams against the source's canvases (F6); the baselines read only when a save chooses one.
  `documentSnapshotAction` stays until step 3 switches the editor.
- `app/tab.tsx`, `app/pages.tsx`: the sign-off preset and the changes type held back from the pages until step 3.

**The composition and the data**
- `src/compose/document-model.ts` (new): `documentModel` (a live document: one `store.snapshot` and its "now" content
  from the same read; a baseline's: its content with the live parts; a gone one: an empty model and `gone`), the
  comparisons (each content read once, `compareBaselines`, `changesInScope` with `sectionScopeOf` on each side),
  `documentChanges`, `documentCanvases` (a baseline's canvases, label canvases left out of its figures),
  `baselineDocumentCounts`, `baselineRefs`. Re-exported for the module's app part by `src/app/_lib/documents.ts`.
- `src/compose/documents.ts`: `documentStateFor`'s optional source and comparisons.
- `supabase/migrations/20261125120000_document_signoff.sql`: `document_definition_preset_ck` with `signoff`.
- `docs/data-model-v2.md`: `document_definition`'s `preset`, `source_kind` and `baseline_id`.

**Tests (new)**
- `src/modules/infodocumenter/domain/baselines.test.ts` (24): the source's switches and refusals (gone, another
  workspace's, nothing to change, archived, a reader, a "Compared with" chosen or kept); the sign-off preset (sections,
  options, the overview's figure, no draft mark) and its refusal; "New document from it"; "Make a document" (either
  order, the name cut to 200); the count; `changesPlan` (previous, ties by the list's order, chosen, newer chosen,
  gone); the re-ask key; the scope on either side (removed from a scoped project, attributes, mappings, relationships,
  columns, levels, the module off); the heading and body in Polish; the three messages; the footer, the cover, the draft
  mark in English and German, the gone baseline's tree, the Markdown front matter.
- `tests/document-baseline.test.ts` (10), on a fresh demo seed through the local adapter: the content alone (no
  `Customer.segment_code`, no REQ-105, today's workspace name and people, no labels); a gone baseline; a live document
  against "Stage 1 sign-off" (S35-04's four changes and the heading); none older, a chosen one gone, the source chosen
  itself; a project's scope a subset, no level in scope; the sign-off preset from the baseline's canvases, built and
  written as Markdown; a label canvas not drawn from a baseline but drawn live; the words' keys in three languages and
  InfoDocumenter's words for the closed values.
- Contract suite: `tests/contract/writes.test.ts` (the sign-off row from the newest baseline, Anna's private document
  from it, the source to the live model and back, the SQL's pairing refused by both adapters, the count with another's
  private document = 2, after the baseline's delete the documents kept and read as gone); `tests/contract/reads.test.ts`
  (every demo document read as made from each live baseline with a changes section: the source, the comparisons and
  the Markdown equal on both adapters, and the counts).

### Earlier tests changed, with the reason

| Test | Change | Why |
| --- | --- | --- |
| `src/modules/infodocumenter/domain/documents.test.ts`, "makes a private document … from each preset" | passes a baseline list; expects the sign-off preset's source to be that baseline | the fourth preset is made from a baseline (S36-03) |
| `src/modules/infodocumenter/domain/editor.test.ts`, "drops the page tokens …" | its hand-made state has `source: { kind: "live" }` | `DocumentState.source` is a required field now |
| `tests/infodocumenter-store.test.ts`, "joins InfoDocumenter's sections and InfoCube's two" | `changes` after `dq` in the kinds' list | the new section type |
| `tests/contract/writes.test.ts`, the baseline's delete and "name free again" | each on a later clock of its own | the new document steps before them took later clocks; on the same earlier clock the two adapters listed the change events in different orders (Schema's first run on `15fc306` failed on it; the app is not involved) |

`tests/infodocumenter-store.test.ts:95-96` (a baseline source with an unknown id) still passes: the key refuses it.
No e2e spec changed.

### The checks and the full run (commit `3da88a6`)

- **CI** `check` (lint, typecheck, unit tests): passed. Locally: 212 files, 2,565 tests passed, 14 skipped.
- **Schema** `migrations` (the schema check, the migration and the contract suite on Postgres) and `smoke`: passed.
  On `15fc306` `migrations` failed once (the clock above), fixed by `3da88a6`.
- **Full run** [45578183343](https://github.com/LukaszWolski-DA/infomapper-app/actions/runs/45578183343) on `3da88a6`
  (F15: shared infrastructure, the local adapter's rules and `DocumentState`): **897 passed, 0 failed, 0 flaky,
  16 skipped, 0 expected failures**; about 16 minutes from start to report (08:39 to 08:55 UTC). The run on `15fc306`
  was cancelled by this one.

| Part | Duration | Heap peak | Peak of threshold (80 %) |
| --- | ---: | ---: | ---: |
| 1 | 9 min 23 s | 1,289 MB | 20 % |
| 2 | 8 min 5 s | 1,439 MB | 22 % |
| 3 | 12 min 37 s | 1,209 MB | 19 % |
| 4 | 7 min 54 s | 1,528 MB | 24 % |
| 5 | 6 min 23 s | 1,544 MB | 24 % |
| 6 | 7 min 57 s | 1,853 MB | 29 % |
| 7 | 6 min 36 s | 1,595 MB | 25 % |
| 8 | 11 min 48 s | 1,191 MB | 19 % |
| 9 | 3 min 57 s | 1,129 MB | 18 % |
| 10 | 4 min 42 s | 1,357 MB | 21 % |
| 11 | 10 min 26 s | 1,248 MB | 19 % |

No restart printed; every part under 2 GB (part 6 the highest, 1,853 MB).

### What differs from the plan

1. **The pages stay as they were.** `PRESETS` and the section types are lists the pages read, so the sign-off preset and
   "Changes since a baseline" would have shown in "New document" and "+ Add section" without their disabled state and
   options; `tab.tsx` and `pages.tsx` hold them back until step 3 (two lines, each with a comment).
2. **New actions beside the old one.** The editor still reads `documentSnapshotAction`; `documentModelAction` (the model
   from the source, the baselines and the comparisons) and `documentChangesAction` are ready for step 3 to switch to.
3. **"Make a document" is its own command** (`createChangesDocument`) instead of an option of `createDocument` (F11):
   its input is the two states, not a preset.
4. **The documents' count does not depend on InfoDocumenter being on** (step 1's Q8 said 0 while it is off): the documents
   stay and say their baseline is gone either way, so the delete dialog says so too.
5. **`DocumentSectionType.heading`** is new in the shared section contract (the changes section's "Changes since
   “{older}”"); a type without it is unchanged.
6. **Words taken from InfoDocumenter's labels** (answer 9) differ from Q5's proposed table where `labels.ts` already had
   them. Polish: a direct mapping "Kopia bezpośrednia" (not "Bezpośrednie"), severity "Blokuje ładowanie" (not "Blokada"),
   priority Won't "Nie teraz" (not "Nie będzie"). German: "Direkte Übernahme", "Geschäftlicher Bedarf", "Abgestimmt",
   "Sollte", "Könnte", "Nicht jetzt", "Warnen", "Ladung blockieren" (Q5 had "Direkt", "Geschäftsbedarf", "Vereinbart",
   "Soll", "Kann", "Nicht", "Warnung", "Blockierend"). `tests/document-baseline.test.ts` compares the two.
7. **One label more than Q5's table:** `t_changesType`, the type's name in "+ Add section" and its default heading
   ("Changes since a baseline"; Polish "Zmiany od baseline’u"; German "Änderungen seit einer Baseline", for Łukasz's
   review).

## 10. Step 3: the pages (25 November 2026)

PR 95 (draft), commit `33ef608` after section 9's `85a6014`. No connection to `infomapper-dev`, no `pg:migrate`.

### What was built, by file

**InfoDocumenter's editor and pages**
- `app/editor.tsx`: the model read through `documentModelAction` once per document and source (F3: again on each switch
  of "Model state"), the tree built only from the current source's model; the changes sections' comparisons asked for
  again with `documentChangesAction` when `changesRequestKey` changes, which only a saved change does (an answer for an
  older key is dropped); the Scope's projects and concepts and the register's classifications, Data Vault mode and
  naming from the document's own snapshot once read (F4); "Model state" as the prototype's select (`ModelState`: the live
  model, each live baseline newest first as "Baseline “{name}” ({time})" in the browser's time zone, the gone option
  "Baseline no longer exists: choose another source"; a save of the document) with the prototype's hint under it; the
  note above the preview for a baseline source; Print / PDF and Markdown disabled for a gone baseline with the
  prototype's title (F17), and until the source's model has come; the changes section's options get the baselines,
  the previous baseline and the browser's minute.
- `app/preview.tsx`: `note`, the prototype's `.de-note` above the pages (left out of print).
- `app/section-options.tsx`: the field kind `choice` (a select of ids, "" for null, a stored id no longer offered shown
  as "Baseline no longer exists"); the changes section's spec ("Compared with": "Previous baseline: {name} ({time})" or
  "Previous baseline (none yet)", then each baseline; the prototype's hint).
- `app/pages.tsx`: the editor gets the document's source and the baselines (names and times only); "+ Add section" lists
  "Changes since a baseline" again (step 2 held it back); the document page builds from `documentModel` (a gone
  baseline's message, never the live model) with each baseline's time left as a token for the browser (F7), and Print
  disabled with the reason for a gone baseline.
- `app/paged-view.tsx`: the tokens written as the browser's minute in the copy and the CSS before Paged.js lays the pages
  out (F7); `printOff`.
- `ui/document-html.tsx`: a gone baseline's document is its one sheet with the line (the prototype's `missing` sheet).
- `app/actions.ts`: `createDocumentFromBaselineAction` (the row's button: the sign-off preset from that baseline);
  `documentSnapshotAction` removed (replaced by `documentModelAction`).
- `app/tab.tsx`, `app/tab-actions.tsx`, `app/load.ts`: the sign-off preset in "New document", greyed out with "Create a
  baseline first." (the line under it and its title) while the workspace has no live baseline; the meta line's source as
  the prototype's ("live model", "from baseline “{name}”", "from baseline (missing)").
- `domain/commands.ts`: the Baselines tab's words (`newFromIt`, `makeDocument`, `makeDocumentTitle`, `documentsLine`).

**InfoMapper, through the composition root (F1)**
- `src/compose/baselines-ui.ts` (new): `BaselineExtensions` (a row's action, the Compare dialog's action, the delete
  dialog's lines by baseline) and `baselineExtensions(store, access)`: InfoDocumenter's buttons for whoever may make
  documents (its own rights: on, not archived), the documents' line counted on the server.
- `src/app/w/[workspaceId]/_components/baselines.tsx`: draws `extensions`: the row's button after "Compare…", "Make a
  document" before "Close" (the two states as the dialog shows them; the command puts the older first), the delete
  dialog's line under "It cannot be brought back here."; a module's answer opens its page.
- `src/app/w/[workspaceId]/page.tsx`: reads the extensions for the Baselines tab only.
- `src/compose/home.tsx`: the Documentation tab knows whether the workspace has a live baseline.
- `src/ui/local-time.ts` (new, pure: `minuteText`, `timeToken`, `localTimes`, `localTimesIn`) and `src/ui/use-minute.ts`
  (new, client: `useLocalTime`, `useMinute`). Slice 35's tab keeps its own copy of the same rule.

**Tests**
- `e2e/slice-36/` (new): `fixtures.ts`, `helpers.ts` (`exactPages` chooses "Exact pages" once the page has hydrated,
  baselines and documents made through the domain, `changesRows`, `changeDb`), and:
  - `S36-01` (2 tests): "New document from it" opens the editor; the name, source, audience and no draft mark; Model
    state chosen with the hint and the note; the footer "Retail Co – DWH · Baseline “Stage 1 sign-off” of 2026-09-15
    10:12"; REQ-105 absent; a rename in the live model afterwards changes nothing; the options newest first; switched to
    the live model (REQ-105, the renamed entity, the live footer, no note), to another baseline and back; the draft mark
    switched on reads "DRAFT · baseline Stage 1 sign-off". A reviewer sees Model state disabled on a shared one.
  - `S36-02` (4): "+ Add section" with its name and description; "Compared with" first "Previous baseline: Stage 1 sign-off
    (2026-09-15 10:12)" and its hint; S35-04's four changes asked for after the section's save, its groups and columns;
    the same section in Markdown. **A rename of an entity with mappings is one change** ("Entity | Client | name:
    Customer → Client", the attribute and mapping labels in the newer names, "Changed (3)"). **A long list** (every
    logical attribute's definition and every source column's comment changed: about seventy rows) scrolled down in the
    preview to its last row. A chosen baseline (Stage 2, then Stage 1), Polish words and heading, a concept's scope
    leaving Customer's changes out, "Nothing to compare with yet." and "No changes.".
  - `S36-03` (2): four presets in order; the sign-off greyed out with its line and title without a baseline; with two,
    made from the newest (as Anna), its thirteen sections in order, the text, the overview's caption, the changes
    section comparing with Stage 1; then changed like any document.
  - `S36-04` (3): "Make a document" against Now (the dialog's filter not carried, the live source, one section, Markdown
    `source: "live model"`); between two baselines opened from the newer row (the older first, the newer as source,
    Markdown `source`, `baseline`, `baseline_taken`); a document from Stage 1: `baseline_taken: "2026-09-15T10:12+02:00"`.
  - `S36-05` (2): the delete dialog's "2 documents are made from it…" counting Anna's private document without naming it;
    after the delete the editor's message, Model state's gone option, Print / PDF and Markdown disabled with the title;
    the document page's message and Print disabled; the live model chosen and it works. A chosen baseline gone: the
    section's message, the rest printed; the previous one takes Stage 1; the option names the gone baseline.
  - `S36-screens` (on demand, `SCREENS=<folder>`).

### Earlier tests changed, with the reason

| Test | Change | Why |
| --- | --- | --- |
| `e2e/slice-25/S25-03.spec.ts:35` | reads the chosen option of `select-model-state` instead of the text `text-model-state` | Model state is the prototype's select now (F2) |
| `e2e/slice-26/S26-10-figures.spec.ts` (comment only) | names `documentModelAction` | the editor's snapshot comes from it (the spec takes the largest action answer, so its measuring is unchanged) |
| `scripts/pg-snapshot-size.ts` (comment only) | the same | the same |

No other earlier spec or test changed.

### The checks and the full run (commit `33ef608`)

- **CI** `check`: passed. Locally: lint, typecheck, 2,565 unit tests passed, 14 skipped; `e2e/slice-36` and S25-03 passed.
- **Schema** `migrations` and `smoke`: passed.
- **Full run** [45593559325](https://github.com/LukaszWolski-DA/infomapper-app/actions/runs/45593559325) on `33ef608`:
  **910 passed, 0 failed, 0 flaky, 16 skipped, 0 expected failures**; about 16 minutes (10:17 to 10:33 UTC).
  `slice-36`: 13 tests (the 3 screenshot tests skipped), 112 s.

| Part | Duration | Heap peak | Peak of threshold (80 %) |
| --- | ---: | ---: | ---: |
| 1 | 9 min 41 s | 1,288 MB | 20 % |
| 2 | 11 min 7 s | 1,165 MB | 18 % |
| 3 | 8 min 51 s | 1,578 MB | 25 % |
| 4 | 7 min 27 s | 1,560 MB | 25 % |
| 5 | 8 min 54 s | 1,403 MB | 22 % |
| 6 | 10 min 46 s | 1,190 MB | 19 % |
| 7 | 6 min 36 s | 1,592 MB | 25 % |
| 8 | 9 min 19 s | 1,560 MB | 24 % |
| 9 | 3 min 46 s | 1,344 MB | 21 % |
| 10 | 4 min 34 s | 1,250 MB | 19 % |
| 11 | 12 min 29 s | 1,363 MB | 21 % |

No part reached 1,850 MB (the highest: part 7, 1,592 MB; part 6, 1,853 MB in step 2's run, is 1,190 MB here). No
restart printed. Part 11 (`slice-27` to `slice-36`) is the longest by 1 min 22 s in this run; the recut rule reads the
median of the last three full runs, which the closing checks.

### The prototype against the app (screenshots at 1440 × 900 in `test-results/s36-screens/`, not committed)

Taken: the editor with a baseline source and its footer, the preset picker with and without a baseline, a changes
section with about seventy rows, the Compare dialog with "Make a document", the delete dialog with its documents' line,
a document whose baseline is gone; and the prototype's Baselines tab, Compare dialog, delete dialog and editor from a
baseline. The prototype's own preset dialog was not reached by the script (its button is drawn elsewhere); its picker
was compared from its code (`pickPreset`, line 10388).

The layout matches: Model state at the top of the Document panel with the hint under it, the note above the pages,
"New document from it" after "Compare…", "Make a document" before "Close", the documents' line as the delete dialog's
second paragraph, the greyed preset with its line in the warning colour, the changes section's groups with their counts
and its three columns. Visible differences, each with its reason:

1. **The draft mark of a document from a baseline** reads "DRAFT · baseline {name}"; the prototype writes "DRAFT · live
   model" for every source. The PRD's text (P6).
2. **A changes section in a document from a baseline** compares with the document's own state; the prototype compares
   with the live model (`modelPart(S)`, line 10053). The PRD's rule (F12).
3. **A chosen baseline that is gone**: the section says "The baseline this section compared with no longer exists." and
   its option "Baseline no longer exists"; the prototype shows "Nothing to compare with yet." and its first option. The
   PRD's text (F18).
4. **The gone baseline's sheet** keeps the running header (Paged.js lays out a real page with the document's frame); the
   prototype's preview sheet has none. The app's pages always have their frame.
5. **No "Generate version"** in the editor's bar: versions come later (D-81).
6. **The cover's logo and the concepts' colour swatches in Scope**, and the page count (30 against 22) are earlier slices'
   differences, unchanged here.
7. **The watermark switch's label** stays "“Draft” mark when from the live model" (the prototype's) though since Łukasz's
   answer 2 the mark can be on for a baseline document too (then naming the baseline).
8. **The Documentation tab's meta line** says "from baseline “{name}”", or "from baseline (missing)" when it is gone, as the
   prototype's (`dr-meta`, line 10319). Step 1's P9 said the prototype had no gone mark: it has none beside the name, but
   its meta line has "(missing)". For Łukasz (below).

### What differs from the plan

1. **Step 1's Q1 said the editor reads the model once per source:** so it does, and the Scope and register lists follow
   it, but the page's server still reads the live projects and concepts for the editor's first paint (before the model
   arrives); they are replaced as soon as it does.
2. **`documentSnapshotAction` is gone** (step 2 kept it beside the new action); nothing else used it.
3. **The browser's minute** is a small shared pair in `src/ui/` (`local-time.ts` pure, `use-minute.ts` the hook):
   Next.js refuses a hook in a file a server page imports, which the first local run showed.
4. **"Exact pages" in the specs** is chosen through `exactPages`, which waits until the choice is stored: a choice made
   before hydration was lost and the preview showed the quick sheet (S36-02's first local run).

### For Łukasz

- **The meta line's "from baseline (missing)"** (difference 8): the prototype's own text, so the app has it; your answer 8
  ("no mark beside its name") is kept. Say if "(missing)" should go too.
- **The watermark switch's label** (difference 7): keep the prototype's, or change it to "“Draft” mark"; a wording change,
  for the closing.
