# Slice 23 – Metadata conventions

Status: **proposed** (Łukasz, 10 November 2026). **Full path** (CLAUDE.md, "The slice cycle", 2): a data model change
(a column on `classification`, a code for own classifications, a column on `workspace`, built-in texts per
documentation language). Branch `slice/23-metadata-conventions`, from `main` (after tag `slice-22`). PRD file:
`docs/prd/slice-23-metadata-conventions.md`; step 1 writes `docs/prd/slice-23-acceptance.md`. Test regime: CLAUDE.md,
"Testing".

Written from the docs after slice 22 (D-77) and the prototype changed for this slice, which Łukasz accepted on
10 November 2026, **without reading the code**. **The prototype is the source of truth for behaviour; where this PRD and
the prototype differ, ask.**

## 1. Why

A workspace's conventions are scattered or missing. The classification list lives in a dialog (slice 7c, D-57), the
concepts' colours in Settings, and naming rules nowhere. No classification says what it means, which people outside the
team, documents and exports (InfoDocumenter, Markdown for AI agents) need. A workspace documented in Polish or German
renames all 19 built-in classifications by hand, and an own classification has only its name, so an import file breaks
when it is renamed. `docs/ideas.md` holds two of these (slice 7c, PRD section 9): "Built-in classification names per
documentation language" and "Own classifications with a code".

Decisions taken with Łukasz (10 November 2026):
- **1.** This slice is **one tab, "Metadata conventions", as the only place to edit the classification list** (slice
  7c's dialog moves into it), with **definitions** of classifications, an optional **code** for own classifications,
  **built-in names and definitions per documentation language**, the **concepts' colours** (moved from Settings) and the
  workspace's **naming conventions**.
- **2.** A definition is **plain text**, like a note (D-57).
- **3.** An own classification's code is **optional, set when it is added, and never changed**: it exists so import
  files stay stable while the name changes.
- **4.** A workspace gets the built-in names and definitions in its **documentation language when it is created**
  (`en`, `pl`, `de`). Changing the language later renames nothing and rewrites no definition.
- **5.** The naming conventions are **plain text** on the workspace, in this slice.
- **6.** **Later:** entity stereotypes' names and definitions (the five fixed codes keep their codes; a workspace names
  and defines them). Own stereotypes are an idea after that.
- **7.** **Later:** the map from physical to logical types, after a decision on what a changed map does to approved
  mappings (D-51).
- **8.** **Later:** an organization's default conventions.
- **Assumptions accepted with the prototype:** the German and Polish texts (Appendix A) are proposals to review; the
  English built-in name of `PII` is "Personal data" as in the app (D-57); the prototype's earlier "PII" was its own.

## 2. What to build

### The tab

1. The workspace home gets a tab **"Metadata conventions"** between People and Settings, for every member. Those who may
   edit the classification list (D-57: owners, admins and modelers) edit it; reviewers, readers and an archived
   workspace see it read only.
2. Its first line: "The workspace's conventions, in one place. The import matches classifications by their name or code;
   table and column panels set them; documents and exports print their definitions."
3. **Classifications** (box), with the prototype's sentence, then two tables, **"For source columns"** and **"For source
   tables"**. Columns: **Name** (a text field), **Code**, **Definition** (a text area), **Used** ("used n×" or "unused"),
   and **Remove**.
   - A Data Vault one carries the chip "Data Vault 2.0"; while the mode is off its row is dimmed and the chip adds
     "· hidden while the mode is off" (it stays editable here; D-57 keeps it hidden in the panels and the reading).
   - An own one carries the chip "own"; an own one without a code shows "—" in Code, titled "No code: an import file
     names it by its name".
4. **Renaming** any classification, built-in or own: the field saves on leaving it (D-66), trimmed; an empty or
   unchanged name writes nothing (the field shows the name again); a name taken per D-57 (per scope, against every name
   and built-in code, ignoring case, spaces, `_`, `-` and `/`) is refused with "That name is taken." Each rename is one
   undo step.
5. **A definition:** the text area saves on leaving it, trimmed; empty clears it (null). One undo step. Its length cap
   as a note's (step 1 confirms).
6. **Adding** an own classification, under each table: a name field, a code field ("Code (optional), e.g. HASH") and
   Add.
   - The name follows item 4's rule ("That name is taken").
   - The code is upper-cased; letters, digits and `_`, starting with a letter, at most 30 characters ("Letters, digits
     and _; starting with a letter"); unique among every code of the workspace, built-in ones included, removed ones
     too ("That code is taken"). Without a code the classification has none.
   - One undo step. The code can never be changed or added later; the panel shows it read only.
7. **Removing** a classification keeps D-57: the confirmation first says where it is used and, for a built-in one a rule
   reads, what stops; its links go with it; one undo step. A removed built-in one is listed under its table as
   "Removed built-in: {name} {CODE} [Restore]"; Restore brings it back unused, and is refused while its name is taken
   ("“{name}” is taken by another classification; rename that one first.").
8. **The dialog goes.** "Edit the list…" in the table and column panels opens the workspace home on this tab. Every other
   way into slice 7c's dialog does too (step 1 lists them).

### Built-in texts per documentation language

9. A workspace **created after this slice** gets its built-in classifications' names and definitions in its
   documentation language (Appendix A). The domain keeps the texts for `en`, `pl` and `de`.
10. A workspace **created before** keeps its names. Its built-in classifications get the definitions in its
    documentation language where they have none (step 1 confirms, Q2). Own classifications get no definition.
11. Changing a workspace's documentation language later renames nothing and rewrites no definition.

### Concept colours

12. A **"Concept colours"** box: a row of swatches per concept, as Settings has now, with "Each concept's colour on
    canvases and in documents. Violet is reserved for requirements, so it is not offered here; a new concept takes the
    first colour no concept uses." Settings loses its box; its "Model conventions" box says "Classifications, concept
    colours and naming conventions are edited in [Metadata conventions]." with a button that opens the tab. The colour
    change itself (its command, D-76's first unused colour) does not change.

### Naming conventions

13. A **"Naming conventions"** box: a plain text area with the prototype's placeholder and sentence ("… Documents print
    them in their conventions section; nothing checks names against them yet."). It saves on leaving it, trimmed; empty
    clears it. Whether it is an undo step or a workspace setting outside undo (as `doc_language`) is Q5.

### Elsewhere

14. **The import** matches a classification by its name or its code: built-in ones as now, and an own one by its code
    too when it has one (D-55, slice 7c's P6). Its report names the classification by its current name.
15. The tab's last line: "Later, in their own slices: entity stereotypes' names and definitions, the map from physical to
    logical types, an organization's default conventions."

### Not in this slice

Stereotypes, the type map and an organization's defaults (decisions 6–8); a check of names against the naming
conventions; an action that resets built-in names to a language's defaults; classifications on attributes; documents
printing the definitions (InfoDocumenter).

## 3. Data model

- **`classification.definition`** text, null: plain text, trimmed, never empty (null when not set). In the undo history
  as the list's other changes (D-57).
- **`classification.code`** for own classifications: optional, set on create, never changed (the domain refuses a
  change). Unique per workspace among **all** rows' codes, deleted and removed ones included, and never a built-in code;
  pattern `^[A-Z][A-Z0-9_]{0,29}$`. Step 1 checks the current unique index and `origin` (`own` with code null today).
- **`workspace.naming_conventions`** text, null: plain text, trimmed, never empty.
- **Built-in texts:** `src/domain/model/classifications.ts` (or where the 19 built-ins are defined) gains a name and a
  definition per documentation language; the workspace's creation uses its `doc_language`.
- **Existing rows:** a migration (and the local file's upgrade) fills `definition` of built-in rows from their
  workspace's `doc_language` where null; names unchanged (Q2).
- **The local data file's format** goes up by one if a column of a core table is added (step 1 confirms with the
  format's rules); `docs/data-model-v2.md` gets every change.

## 4. Sources

- **Prototype:** `docs/prototype/infomapper-prototype-with-sources.html`, replaced by the version Łukasz accepted
  (736,807 bytes, SHA-256 `bf7cbb6af3619699128823f1a1cf635f2ffecdc6f097d8fa8b183927f700c8de`), built on slice 22's
  (718,294 bytes, `3b77c53a…`). Its changes:
  - the module `CONV` (the tab, the classification list with add, rename, remove and restore, definitions, codes, the
    built-in texts per language, the colours box, the naming conventions) and its CSS (`.cv-*`);
  - `IMP`'s `indexClasses` reads the conventions (a built-in's name, removed built-ins), so the panels' toggles and the
    import's matching follow the tab;
  - "Edit the list…" (`data-imx-opencls`) opens the tab instead of `openSettings`;
  - Settings: the colours box is hidden and "Model conventions" points to the tab;
  - `idx()` seeds a workspace's conventions once, in its documentation language.
  - **Prototype storage is not the app's model:** it keeps a built-in's name and definition in `S.conv`, removals in
    `S.conv.removed`, own ones in `S.classes` with a flag for a real code. The app keeps D-57's rows; only the new
    columns of section 3 are new.
  - **Known difference, not this slice's:** the prototype marks Effective date as Data Vault; the app has it general
    (D-57, `inventory-prototype-vs-app.md`).
- **Decisions:** AD-05, AD-08, AD-15, AD-18, D-55, D-57, D-59, D-66, D-76.
- **`docs/ideas.md`:** slice 7c's PRD section 9 entries ("Built-in classification names per documentation language",
  "Own classifications with a code"); the data model review's "Classifications on attributes" (not this slice).

## 5. Steps

Stop after each step; wait for Łukasz. A new session starts only at a step's boundary, reading CLAUDE.md, this PRD and
the acceptance doc.

1. **Reconnaissance and check.** Answer Q1–Q10 in `slice-23-acceptance.md`; every place where the PRD is wrong or
   differs from the code, a decision or the prototype, with a proposal; every new UI text; the earlier specs and
   fixtures each step touches; the plan for steps 2 to 4. Copy the prototype and the PRD. No application code, no runs.
2. **Data and domain.** Draft PR at the start. The migration(s), the built-in texts per language, the commands (a
   definition; an own classification with a code; the naming conventions), the import's matching by an own code, the
   local file's upgrade, unit tests. A full run here only if step 1 finds the step changes shared infrastructure (the
   "Test runs" exception list).
3. **Interface.** The tab and its boxes, the dialog's removal and its entry points, Settings' boxes; S23 specs. The
   element guard and the canvas commit counts; no measuring sitting (nothing on the canvas changes).
4. **Close.** The docs and D-78 quoted for approval; one full run on the final commit. Stop with the manual acceptance
   steps. Merge and tag `slice-23` only on Łukasz's command.

## 6. Acceptance criteria

Tests in `e2e/slice-23/`, one file per criterion, fresh seed each.

| ID | Criterion |
| --- | --- |
| S23-01 | **The tab.** "Metadata conventions" between People and Settings; both tables with every built-in row of the seed, codes, definitions in English, uses ("used 4×" for Business key on the demo); Data Vault rows dimmed with the mode off and not dimmed with it on; a reviewer, a reader and an archived workspace read only. |
| S23-02 | **Rename and define.** Business key renamed and its definition changed, each one undo step, undo and redo; the column panel's toggle shows the new name; an empty and an unchanged name write nothing; a name taken (another name, a built-in code such as "pii", ignoring case and `_`) refused with its text. |
| S23-03 | **Own with a code.** "Hash candidate" with code `hash` added as `HASH`; the code read only afterwards; a bad code and a taken code (`BK`, an earlier own code, a removed one's) refused with their texts; one without a code shows "—". An import file naming `HASH` in its classifications sets it (unit or e2e on the import's reading). |
| S23-04 | **Remove and restore.** Removing a used built-in one shows its uses and what stops (D-57), takes its links, one undo step; listed as removed with Restore; Restore refused while its name is taken, then restored unused. |
| S23-05 | **Languages.** A new workspace with documentation language Polish has "Klucz biznesowy" and its Polish definition; German "Fachlicher Schlüssel"; changing the language afterwards renames nothing. A workspace from before the slice keeps its names and gets definitions in its language (unit or fixture). |
| S23-06 | **Colours and naming.** The colours box changes a concept's colour as Settings did (undo); Settings has no colours box and its button opens the tab; the naming conventions saved, cleared, and read only for a reader. |
| S23-07 | **The dialog is gone.** "Edit the list…" in a table's and a column's panel opens the tab; no other way opens the dialog. |
| S23-08 | CI, the full run before the merge (and one in step 2 if step 1 says so); the element guard; every earlier test changed, with its reason. |

**Manual acceptance (demo and KB):** the demo: the tab, a rename seen in a column's panel, an own classification with a
code used in a test import, a removed and restored built-in one, a new Polish workspace, the colours, the naming
conventions. KB: after the backup "Łukasz's test model" requires, its built-in classifications have definitions in its
documentation language and keep their names.

## 7. Questions for step 1

- **Q1.** `classification`: the new column, the own code (the unique index today, whether removed and deleted rows keep
  their codes in it, `origin`), the code's immutability in the domain, and the pattern as a CHECK or a domain rule.
- **Q2.** The built-ins' creation: where a new workspace gets its 19 rows, whether `doc_language` is known there, the
  texts per language in the domain; for existing workspaces, fill the definitions in their language (proposal) or leave
  them empty.
- **Q3.** Slice 7c's dialog: every way into it, its components and specs; what moves into the tab and what goes.
- **Q4.** The import's classification reading (D-55, P6): matching by name and built-in code today; adding an own code;
  the report's texts.
- **Q5.** `workspace.naming_conventions`: where workspace fields are written, undo or outside it (as `doc_language`),
  the version check (D-59), the length cap; who may edit it (proposal: as the classification list, D-57's roles).
- **Q6.** The colours: Settings' box and its specs; moving the box only, the command unchanged (D-76).
- **Q7.** Roles and the archived workspace: D-57's roles for every field of the tab; the tab for reviewers and readers.
- **Q8.** **What later slices need, answered now, no change:** whether `entity.stereotype` has a CHECK on its values and
  what reads the stereotype codes (import, export, InfoCube's C-5); where the type rule lives (one domain function or
  several) and its callers (import, the mapping panel, D-51); whether the conventions' rows can be copied between
  workspaces by code (an organization's defaults). Anything that this slice would make harder later is reported, with a
  proposal.
- **Q9.** Earlier specs and fixtures: the dialog's (7c), Settings' colours, the import's classifications, the seed's
  classification counts.
- **Q10.** KB, read only on a copy of a backup, counts only: workspaces and their `doc_language`, own classifications,
  removed built-in ones, renamed built-in ones.

## 8. D-78 (proposal) and docs

"**Metadata conventions (slice 23).** A workspace's conventions have one place, the workspace home's tab \"Metadata
conventions\": its classification list (D-57's dialog moved there), its concepts' colours (moved from Settings) and its
naming conventions, plain text. Every classification has an optional definition, plain text. An own classification may
get a code when it is added: letters, digits and `_`, starting with a letter, unique among every code of the workspace,
never changed; the import matches it by its name or its code. A workspace gets its built-in classifications' names and
definitions in its documentation language when it is created (English, Polish, German); changing the language later
renames nothing. Every change keeps D-57's roles and is one undo step (the naming conventions as step 1 settles).
Stereotypes' names and definitions, the type map and an organization's default conventions are later."

Docs: `decisions.md` (D-78), `data-model-v2.md` (the columns), `ideas.md` (the two slice 7c entries done; the later
items below with their prerequisites), `inventory-prototype-vs-app.md` (the tab), `known-limitations.md`, README and
CLAUDE.md (status).

## 9. Left for later

Each with what step 1's Q8 must confirm this slice leaves open:
- **Stereotypes' names and definitions** (decision 6a): a row per workspace and stereotype code; the five codes unchanged;
  every place that shows a stereotype's name reads it. Own stereotypes after that (6b): `entity.stereotype` as a code of
  the workspace's list.
- **The type map** (decision 7): the type rule reads a workspace's map; first a decision on approved mappings whose
  conflict appears or disappears when the map changes (D-51).
- **An organization's default conventions** (decision 8): saved from a workspace and taken over by another, matched by
  code (built-in codes; own codes from this slice).
- **Reset built-in names and definitions to a language's defaults**, as an explicit action with a preview.
- **Classifications on attributes** (the data model review).
- **InfoDocumenter** printing the definitions, the colours and the naming conventions (its own PRDs).

## Appendix A. Built-in names and definitions

**English** (`en`; names as today, `PII` named "Personal data"):

| Code | Name | Definition |
| --- | --- | --- |
| BK | Business key | The column identifies the business object in the source; it survives system changes. |
| PII | Personal data | The column holds personal data in the sense of the GDPR. |
| TECH | Technical / audit | A technical or audit column of the source system; not business content. |
| LDTS | Load date | When the row was loaded. |
| RSRC | Record source | Which system or file the row came from. |
| LK | Link key | A foreign key that becomes a link between hubs. |
| DCK | Dependent child key | Part of the key of a link or a satellite, not a hub of its own. |
| DK | Driving key | The side of a link whose change an effectivity satellite tracks. |
| MAK | Multi-active key | Several rows are valid at the same time for one key. |
| EFF | Effective date | The date from which the row is valid in the business. |
| T_MASTER | Master data | Master data: customers, products, organisational units. |
| T_TXN | Transactions | Business events: orders, payments, movements. |
| T_REF | Reference / code list | Codes and their meanings. |
| T_STG | Staging | A copy for loading, not a source of truth. |
| T_LOG | Log / audit | Logs and audit trails. |
| T_HIST | History (SCD2) | The source keeps history itself (SCD type 2). |
| T_HUB | Hub candidate | Likely the source of a hub. |
| T_LNK | Link candidate | Likely the source of a link. |
| T_SAT | Satellite source | Likely the source of a satellite. |

**Polish** (`pl`):

| Code | Name | Definition |
| --- | --- | --- |
| BK | Klucz biznesowy | Kolumna identyfikuje obiekt biznesowy w źródle; przetrwa zmiany systemu. |
| PII | Dane osobowe | Kolumna zawiera dane osobowe w rozumieniu RODO. |
| TECH | Techniczna / audytowa | Kolumna techniczna lub audytowa systemu źródłowego; nie treść biznesowa. |
| LDTS | Data załadowania | Kiedy wiersz został załadowany. |
| RSRC | Źródło rekordu | Z którego systemu lub pliku pochodzi wiersz. |
| LK | Klucz linku | Klucz obcy, który staje się linkiem między hubami. |
| DCK | Zależny klucz podrzędny | Część klucza linku lub satelity, a nie osobny hub. |
| DK | Klucz wiodący | Strona linku, której zmianę śledzi satelita efektywności. |
| MAK | Klucz wieloaktywny | Dla jednego klucza obowiązuje jednocześnie kilka wierszy. |
| EFF | Data obowiązywania | Data, od której wiersz obowiązuje biznesowo. |
| T_MASTER | Dane podstawowe | Dane podstawowe: klienci, produkty, jednostki organizacyjne. |
| T_TXN | Transakcje | Zdarzenia biznesowe: zamówienia, płatności, ruchy. |
| T_REF | Słownik / lista kodów | Kody i ich znaczenia. |
| T_STG | Staging | Kopia do ładowania, nie źródło prawdy. |
| T_LOG | Log / audyt | Logi i ślady audytowe. |
| T_HIST | Historia (SCD2) | Źródło samo przechowuje historię (SCD typu 2). |
| T_HUB | Kandydat na hub | Prawdopodobnie źródło huba. |
| T_LNK | Kandydat na link | Prawdopodobnie źródło linku. |
| T_SAT | Źródło satelity | Prawdopodobnie źródło satelity. |

**German** (`de`; to be reviewed):

| Code | Name | Definition |
| --- | --- | --- |
| BK | Fachlicher Schlüssel | Die Spalte identifiziert das Geschäftsobjekt in der Quelle; sie überdauert Systemwechsel. |
| PII | Personenbezogene Daten | Die Spalte enthält personenbezogene Daten im Sinne der DSGVO. |
| TECH | Technisch / Audit | Eine technische oder Audit-Spalte des Quellsystems; kein fachlicher Inhalt. |
| LDTS | Ladedatum | Wann die Zeile geladen wurde. |
| RSRC | Datensatzquelle | Aus welchem System oder welcher Datei die Zeile stammt. |
| LK | Link-Schlüssel | Ein Fremdschlüssel, der zu einem Link zwischen Hubs wird. |
| DCK | Abhängiger Kindschlüssel | Teil des Schlüssels eines Links oder Satelliten, kein eigener Hub. |
| DK | Treiberschlüssel | Die Seite eines Links, deren Wechsel ein Effektivitätssatellit verfolgt. |
| MAK | Multi-aktiver Schlüssel | Für einen Schlüssel gelten gleichzeitig mehrere Zeilen. |
| EFF | Gültigkeitsdatum | Das Datum, ab dem die Zeile fachlich gilt. |
| T_MASTER | Stammdaten | Stammdaten: Kunden, Produkte, Organisationseinheiten. |
| T_TXN | Bewegungsdaten | Geschäftsereignisse: Bestellungen, Zahlungen, Bewegungen. |
| T_REF | Referenz / Codeliste | Codes und ihre Bedeutungen. |
| T_STG | Staging | Eine Kopie zum Laden, keine führende Quelle. |
| T_LOG | Log / Audit | Logs und Audit-Trails. |
| T_HIST | Historie (SCD2) | Die Quelle führt selbst Historie (SCD Typ 2). |
| T_HUB | Hub-Kandidat | Wahrscheinlich Quelle eines Hubs. |
| T_LNK | Link-Kandidat | Wahrscheinlich Quelle eines Links. |
| T_SAT | Satellitenquelle | Wahrscheinlich Quelle eines Satelliten. |
