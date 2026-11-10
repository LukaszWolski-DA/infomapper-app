# Slice 24 – Entity stereotypes

Status: **proposed** (Łukasz, 10 November 2026). **Full path** (CLAUDE.md, "The slice cycle", 2): a data model change
(a new table of the workspace's stereotypes; `entity.stereotype`'s CHECK replaced by the workspace's list). Branch
`slice/24-entity-stereotypes`, from `main` (after tag `slice-23`). PRD file: `docs/prd/slice-24-entity-stereotypes.md`;
step 1 writes `docs/prd/slice-24-acceptance.md`. Test regime: CLAUDE.md, "Testing".

Written from the docs after slice 23 (D-78) and the prototype changed for this slice, which Łukasz accepted on
10 November 2026, **without reading the code**. **The prototype is the source of truth for behaviour; where this PRD and
the prototype differ, ask.**

## 1. Why

An entity's stereotype (Object, Link, Dictionary, Context, Informative) says what the entity is in the method. Today the
five are fixed in the code: their names are English, nobody can say what they mean, and a team whose method needs
another kind of entity cannot add it. Slice 23 left "entity stereotypes' names and definitions" for later (D-78);
`docs/ideas.md`'s "Metadata conventions: what comes later" lists it with what slice 23's step 1 (Q8) found: a CHECK on
the five values, and four places that show a stereotype's name. Łukasz expects new stereotypes and may rename the
existing ones as his method settles, and wants to control both in the Metadata conventions tab.

Decisions taken with Łukasz (10 November 2026):
- **1.** The stereotypes become **the workspace's list**: the five **built-in** ones with fixed codes (`object`, `link`,
  `dictionary`, `context`, `informative`) and the workspace's **own** ones. An entity keeps a stereotype's code.
- **2.** A built-in one can be **renamed and defined, never removed**: `object` is a new entity's stereotype and every
  fact's and dimension's (C-5).
- **3.** An own one has a name, a definition and a **code, required**, proposed from the name, set when it is added and
  never changed (an entity refers to its stereotype by code).
- **4.** **Removing an own one:** unused, at once with Undo; used, a dialog says how many entities have it and asks which
  stereotype they get instead; one undo step for both.
- **5.** Names and codes are unique in D-78's comparison (case, spaces, `_`, `-` and `/` ignored), in either direction;
  a code is never given twice, also after its add is undone.
- **6.** The list's order: the built-in ones in today's order, then own ones in the order they were added. Reordering,
  hiding an unused built-in one and another default stereotype are later.
- **7.** A workspace gets the built-in names and definitions in its documentation language when it is created (as
  D-78); existing workspaces keep their names (the English ones) and get the definitions in their language.
- **8.** The names show wherever a stereotype is shown; the entity panel's select also shows the chosen one's
  definition. Documents print them later (InfoDocumenter).
- **9.** D-57's roles and one undo step per change, as the classification list (D-78).
- **Assumptions accepted with the prototype:** the default names and definitions (Appendix A) are proposals; Łukasz
  will change them in the tab as his method settles. The German texts are to be reviewed.

## 2. What to build

### The tab

1. Metadata conventions gets a box **"Entity stereotypes"** between Classifications and Concept colours, with the
   prototype's sentence ("What an entity is in the model. Names and definitions are the workspace's; codes never
   change, …").
2. A table: **Name** (a text field), **Code**, **Definition** (a text area), **Used** ("n entities", "1 entity" or
   "unused"; logical entities only, facts and dimensions show their role), and **Remove** for own ones. Own ones carry
   the chip "own".
3. **Renaming:** saves on leaving the field (D-66), trimmed; empty or unchanged writes nothing; a name taken (another
   stereotype's name or code, item 5's comparison) is refused with "That name is taken." The toast: "Renamed to {name};
   entities keep the stereotype." One undo step.
4. **A definition:** plain text, saves on leaving, trimmed, empty clears it. One undo step.
5. **Adding:** a name field ("New stereotype, e.g. Event"), a code field ("Code, e.g. event") and Add, with "The code is
   proposed from the name; letters, digits and _, starting with a letter. It cannot change later."
   - While the name is typed, the code field proposes the name in lower case, diacritics removed, other characters as
     `_`, at most 30 characters, until the code field is edited by hand.
   - The code: `^[a-z][a-z0-9_]{0,29}$` ("Letters, digits and _; starting with a letter"); unique per item 5 against
     every code and name of the list and every code ever given in the workspace ("That code is taken").
   - The toast: "Stereotype “{name}” added ({code})." One undo step.
6. **Removing an own one:**
   - unused: removed at once, toast "{name} removed." with Undo;
   - used: a dialog "Remove {name}?" with "{n} entities have this stereotype. Choose the one they get instead:", a select
     of every other stereotype, the note "One undo step brings back the stereotype and every entity's." and
     "Remove and move {n} entities"; the toast "{name} removed; {n} entities are now {other}."
7. Read only for reviewers, readers and an archived workspace (D-57's roles).
8. The tab's last line: "Later, in their own slices: the map from physical to logical types, an organization's default
   conventions." Its first line mentions that entity panels offer the stereotypes.

### Elsewhere

9. **Every place that shows a stereotype** shows the workspace's name for its code (slice 23's Q8 found four; step 1
   lists them). The entity card's stereotype label has the definition as its title.
10. **The entity panel's select:** the workspace's list in item 6's order, each option's value the code and its text
    the name; under the select, the chosen stereotype's definition (when it has one). Choosing writes the code, as now.
11. **Settings' "Model conventions" box** (D-78): "Classifications, entity stereotypes, concept colours and naming
    conventions are edited in [Metadata conventions]."
12. **Anything that reads a stereotype's code** (a rule, a filter, an import or an export) keeps reading the code, so a
    rename changes nothing there. The prototype's one example is its Data Vault hint in the entity panel (`Link`), which
    the app does not have; step 1 lists the app's.

### Not in this slice

Reordering the list, hiding an unused built-in one, another default stereotype for new entities, a colour or an icon per
stereotype, naming rules per stereotype, documents printing the definitions.

## 3. Data model

- **`stereotype`** (new table, per workspace), in the undo history as the classification list (D-57):

  | Column | Type | Null | Notes |
  | --- | --- | --- | --- |
  | standard columns | | | |
  | `workspace_id` | uuid | no | FK `workspace` |
  | `code` | text | no | the five built-in codes, or an own one (`^[a-z][a-z0-9_]{0,29}$`); never changed; unique per workspace in item 5's comparison among **all** rows, deleted ones included |
  | `name` | text | no | unique per workspace among live rows, compared as D-57's `name_key` (and against codes) |
  | `name_key` | text | no | written by the server, as `classification.name_key` |
  | `definition` | text | yes | plain text, trimmed, never empty |
  | `origin` | text | no | `builtin`, `own`; built-in rows cannot be deleted |

- **`entity.stereotype`** stays a text column holding a code. The CHECK on the five values goes; the domain checks the
  code against the workspace's live stereotypes (or a composite FK on `(workspace_id, code)`, step 1 proposes). A
  dimensional entity keeps `object` (C-5).
- **Creation:** a new workspace gets the five rows with names and definitions in its `doc_language` (Appendix A), as
  slice 23 does for classifications.
- **Existing workspaces:** a migration (and the local file's upgrade, format 15 → 16 if a core table is added) creates
  the five rows with the English names and the definitions in the workspace's `doc_language`.
- `docs/data-model-v2.md` gets the table and the column's change.

## 4. Sources

- **Prototype:** `docs/prototype/infomapper-prototype-with-sources.html`, replaced by the version Łukasz accepted
  (745,060 bytes, SHA-256 `190d9ea9ef08b4f232f9af37a8d0cee0342ffb17a9c6c3762d625748e30b28da`), built on slice 23's
  (736,807 bytes, `bf7cbb6a…`). Its changes:
  - `CONV`: the stereotypes' list (`S.conv.st`, seeded once in the documentation language), `stSection` (the box),
    adding with the proposed code, renaming, definitions, `stRemove` (the dialog with its select), the codes ever given
    (`S.conv.stCodes`), `stName`, `stDef`, `stList`;
  - the entity card's label, the model tree's row, the entity panel's select (value and text, the definition under it),
    the baseline view, Settings' box (its static chips gone);
  - **prototype storage is not the app's model:** the prototype's keys for the built-in ones are their English names
    (`Object`…), shown as the app's codes (`object`…); own ones use their code. The app keeps codes everywhere.
- **Decisions:** AD-05, AD-15, C-5, D-57, D-59, D-64, D-66, D-78.
- **`docs/ideas.md`:** "Metadata conventions: what comes later" (the stereotypes' entry and its prerequisites).

## 5. Steps

Stop after each step; wait for Łukasz. A new session starts only at a step's boundary, reading CLAUDE.md, this PRD and
the acceptance doc.

1. **Reconnaissance and check.** Answer Q1–Q9 in `slice-24-acceptance.md`; every place where the PRD is wrong or
   differs from the code, a decision or the prototype, with a proposal; every new UI text; the earlier specs and
   fixtures each step touches; the plan for steps 2 to 4. Copy the prototype and the PRD. No application code, no runs.
2. **Data and domain.** Draft PR at the start. The table, its undo registration, the CHECK's replacement, the creation
   and the migration (the local file's upgrade), the commands (rename, define, add with a code, remove with the move of
   its entities), the names' and codes' rules, unit tests. A full run here if step 1 finds the step changes shared
   infrastructure (the local file's format and undo are on the "Test runs" exception list).
3. **Interface.** The box, the remove dialog, every place that shows a stereotype, the entity panel's select and its
   definition, Settings' sentence; S24 specs. The element guard and the canvas commit counts (the card's label changes
   its text only); no measuring sitting unless step 1 finds the card's render changes.
4. **Close.** The docs and D-79 quoted for approval; one full run on the final commit. Stop with the manual acceptance
   steps. Merge and tag `slice-24` only on Łukasz's command.

## 6. Acceptance criteria

Tests in `e2e/slice-24/`, one file per criterion, fresh seed each.

| ID | Criterion |
| --- | --- |
| S24-01 | **Data.** Every seeded workspace has the five built-in stereotypes with names and definitions in its documentation language ("Sales analytics" Polish); a file written before slice 24 loads with the five rows, English names, definitions in its language (unit or fixture); an entity with an unknown code is refused by the domain. |
| S24-02 | **The box.** Retail Co – DWH's tab: the five rows with codes, definitions and uses ("4 entities" on Object on the demo); a reviewer, a reader and an archived workspace read only. |
| S24-03 | **Rename and define.** Link renamed "Association" and defined: one undo step each, undo and redo; Order Line's card label and the model tree say "Association", its panel's select shows it selected with the definition under it; the entity's code stays `link`; a taken name (another's name or a code such as "OBJECT") refused. |
| S24-04 | **Own.** "Event" added: the code proposed `event`, edited by hand to `business_event`; a bad code and a taken one (`link`, an earlier own one, one whose add was undone) refused; the new one is last in the panel's select and can be chosen. |
| S24-05 | **Remove.** An unused own one removed at once with Undo; a used one opens the dialog, its entities moved to the chosen stereotype, one undo step brings back both; a built-in one has no Remove. |
| S24-06 | **Languages.** A new workspace in Polish has "Obiekt" … and their definitions, in German "Objekt" …; changing the language later renames nothing. |
| S24-07 | **Codes elsewhere.** Every reader of a stereotype's code that step 1 lists works the same after renaming every built-in one (filters, imports, exports, InfoCube's `object` for facts and dimensions). |
| S24-08 | CI, the full run before the merge (and one in step 2 if step 1 says so); the element guard; every earlier test changed, with its reason. |

**Manual acceptance (demo and KB):** the demo: the box, a rename seen on a card and in the panel, an own stereotype with a
code chosen on an entity, removing it with its entities moved, a new Polish workspace. KB: after the backup "Łukasz's test
model" requires, its five stereotypes have the English names and definitions, and its entities keep theirs.

## 7. Questions for step 1

- **Q1.** The table: its place among the core tables, its undo registration (as `classification`), the uniqueness of
  codes in item 5's comparison among all rows (deleted ones too), `name_key`.
- **Q2.** `entity.stereotype`: the CHECK's replacement (a domain check, or a composite FK on `(workspace_id, code)`),
  every path that writes it (create, the panel, the toolbox, InfoCube's create paths, imports, copies, transfer and
  duplicate of a workspace), and an unknown code coming from a file.
- **Q3.** Every place that shows a stereotype (slice 23 found four) and every place that reads a code (rules, filters,
  search, the model tree, imports, exports, baselines, InfoCube's C-5).
- **Q4.** Creation and migration: where a workspace's built-in rows are made (as slice 23's classifications), the local
  file's format, the texts per language in the domain.
- **Q5.** The commands: rename, define, add (code rules, "never given twice"), remove with the move of its entities in one
  change group; the version check (D-59); the delete preview if any.
- **Q6.** The panel's select: its component, the definition under it, readers and reviewers, facts and dimensions (their
  role, unchanged).
- **Q7.** Duplicating, transferring and exporting a workspace: the list goes with it (own codes included).
- **Q8.** Earlier specs and fixtures: those that read a stereotype's English name (cards, the tree, the panel, filters),
  the seed's counts.
- **Q9.** KB, read only on a copy of a backup, counts only: workspaces, entities per stereotype code, any code outside the
  five.

## 8. D-79 (proposal) and docs

"**Entity stereotypes (slice 24).** A workspace keeps a list of entity stereotypes in the Metadata conventions tab: the
five built in (`object`, `link`, `dictionary`, `context`, `informative`), which can be renamed and defined but not
removed, and its own, each with a name, an optional plain text definition and a code. An own stereotype's code is
required, proposed from its name, letters, digits and _, starting with a letter, set when it is added and never changed;
codes and names are unique in D-78's comparison, in either direction, and a code is never given twice. An entity keeps
its stereotype's code, so renaming changes no entity, import or export; every place that shows a stereotype shows the
workspace's name, and the entity panel shows the chosen one's definition. Removing an own stereotype that entities have
moves them to a stereotype chosen in a dialog, in one undo step; an unused one is removed at once, with Undo. A new
workspace gets the built-in names and definitions in its documentation language; existing workspaces kept their names
and got the definitions in their language when slice 24 was installed. D-57's roles; each change is one undo step.
Facts and dimensions keep `object` and show their InfoCube role (C-5)."

Docs: `decisions.md` (D-79; D-78's "later" list without the stereotypes), `data-model-v2.md`, `ideas.md` (the entry
done; reordering, hiding and a default stereotype as later items), `inventory-prototype-vs-app.md`,
`known-limitations.md`, README and CLAUDE.md (status).

## 9. Left for later

- Reordering the stereotypes; hiding an unused built-in one; another default stereotype for new entities.
- Naming rules per stereotype, checked by the validator (D-75).
- A colour or an icon per stereotype on cards.
- Documents printing the stereotypes' definitions (InfoDocumenter).
- The type map and an organization's default conventions (D-78's later items), which carry the stereotypes by code.

## Appendix A. Built-in names and definitions (proposals)

| Code | English | Polish | German (to be reviewed) |
| --- | --- | --- | --- |
| object | **Object**: A business thing with its own identity and life cycle: customer, product, order. | **Obiekt**: Rzecz biznesowa z własną tożsamością i cyklem życia: klient, produkt, zamówienie. | **Objekt**: Ein Geschäftsobjekt mit eigener Identität und eigenem Lebenszyklus: Kunde, Produkt, Bestellung. |
| link | **Link**: Connects objects and takes its identity from them, e.g. an order line. | **Powiązanie**: Łączy obiekty i bierze od nich tożsamość, np. pozycja zamówienia. | **Verknüpfung**: Verbindet Objekte und erhält seine Identität von ihnen, z. B. eine Bestellposition. |
| dictionary | **Dictionary**: A list of codes and their meanings (reference data). | **Słownik**: Lista kodów i ich znaczeń (dane referencyjne). | **Wörterbuch**: Eine Liste von Codes und ihren Bedeutungen (Referenzdaten). |
| context | **Context**: Describes another object in a given context or over time, e.g. a role or a changing set of attributes. | **Kontekst**: Opisuje inny obiekt w danym kontekście lub w czasie, np. rolę albo zmieniający się zestaw atrybutów. | **Kontext**: Beschreibt ein anderes Objekt in einem Kontext oder über die Zeit, z. B. eine Rolle oder wechselnde Attribute. |
| informative | **Informative**: Derived or reported information, not a business object of its own. | **Informacyjna**: Informacja wyliczana lub raportowa, nie samodzielny obiekt biznesowy. | **Informativ**: Abgeleitete oder berichtete Information, kein eigenes Geschäftsobjekt. |
