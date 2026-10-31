# Slice 11 – Aliases of entities and attributes, shown by the canvas

Status: **step 1 answered (Łukasz, 31 October 2026)**; the PRD is updated to the answers (`slice-11-acceptance.md`, F1–F17). Branch `slice/11-aliases`, from `main` at tag `slice-10c` (`72ef24b`, assumption A1). PRD file: `docs/prd/slice-11-aliases.md`; step 1 writes `docs/prd/slice-11-acceptance.md`. Test regime: a small slice (CLAUDE.md, "Testing"), plus the local data file's upgrade tests, a measurement sitting, and one full e2e run at the closing. Step 1 checks this PRD against the code (CLAUDE.md, "How we work").

This PRD was written from the docs at slice 10a's state and from what slices 10b and 10c changed, as recorded in the conversation with Łukasz. Step 1 checks every reference against the docs in the repository, which are at slice 10c's state.

## 1. Why this slice

A modeller often needs a second name for an entity or an attribute: the Polish name beside the English one, a technical name, a short name for a workshop. Today there is one name. The canvas should be able to show either, without changing the model.

**Agreed with Łukasz on 30 October 2026:**

- **P1. The name stays primary.** The alias is an extra field of an entity and of an attribute, free text with no fixed meaning, and it may be empty.
- **P2. The alias is part of the object.** It is stored once on the entity or the attribute and is the same on every canvas. The canvas decides what it shows, in its own context.
- **P3. Outside the canvas the name is shown:**
  - breadcrumbs;
  - panel titles;
  - delete previews;
  - the "Copies" list;
  - lists in the object browser.

  The alias is an ordinary field in the entity's and the attribute's panel.
- **P4. Two independent dimensions:** entity names and attribute names. Each can show the name or the alias.
- **P5. The canvas controls each dimension,** and a card can make an exception for its own entity name or attribute names.
  - **The canvas's control has three states, as a "select all" check box in a spreadsheet:**
    - name;
    - alias;
    - mixed, when a card has an exception in that dimension.
  - **Clicking the canvas's control** sets the canvas's mode and clears the cards' exceptions in that one dimension.
- **P6. A card with an exception is tinted where the difference is:**
  - its header for the entity name;
  - its attribute rows' area for the attribute names.

  The tint is a CSS class, not an element.
- **P7. With no alias, the name is shown,** with nothing to tell them apart.
- **P8. Undo covers both:**
  - clicking the canvas's control is one undo step, which also restores the cards' exceptions it cleared;
  - a card's exception is one undo step.

  Clearing the exceptions would otherwise lose the modeller's work.
- **P9. Imports carry no alias.** A source is what it is; aliases belong to the model. Source tables and columns get none.
- **P10. A copied attribute** (D-63) gets its original's alias once; it does not follow it.
- **P11. The object browser's search** also matches aliases.
- **P12. Long aliases** are truncated by the same rule as names (D-37).

**Proposed, to confirm in step 1:**

- **P13. The data.**
  - `entity.alias` and `attribute.alias` (text, null).
  - Two nullable columns on `canvas` for the canvas's modes, `entity_names` and `attribute_names` (null = name). Not
    in `canvas.look`: the look is outside undo (D-12), and the modes are undo steps (P8; step 1, F1).
  - Two columns on `canvas_item` for a card's exceptions, as `row_filter` is a card's own display setting.
  - The local data file's next format (assumed format 11; Q7), with a step that backs up Łukasz's KB model first.
- **P14. Measured.** Switching a mode changes the text on every card at once. A measurement sitting checks its cost and that nothing else got slower (section 6).

## 2. Sources

**Prototype:** it has no aliases. Every behaviour here is D-64.

**Decisions:**
- **D-04, D-37:** layout belongs to the canvas; card width; truncating long names.
- **D-10, D-11, D-25:** live canvases.
- **D-12, D-22:** the canvas's look, layer mode per canvas.
- **D-35:** the object browser's search.
- **D-38:** history places.
- **D-52:** card actions in the card header's menu.
- **D-63:** copying an attribute.
- **AD-05, AD-09:** roles, archive.
- **AD-12, AD-13:** versions, change events.
- **AD-23:** writes.
- **AD-24:** canvas rules: the element guard and the LayerTree read.
- **AD-31:** the schema check.

**Data model:** `docs/data-model-v2.md`:
- section 4: `entity`, `attribute`;
- the canvas section: `canvas.look` (`{ "background": "grey", "grid": "dots", "layer": "all" }`), `canvas_item` (`width`, `collapsed`, `row_filter`, `live_level`);
- the local data file's formats (format 10 in slice 10c).

**Earlier slices:**
- **9, 10a, 10c:** the save chain (`saveRow`, `saveRows`, `rowSaves.answer`).
- **10c:** undo writing a column missing from an old change event as null (F10); format 10's inline upgrade step in `upgradeDb`; `pasteAttribute`.

## 3. What to build

Texts in quotes are proposals. The step that builds them lists every new user-facing text for approval.

### Data

1. **`entity.alias` and `attribute.alias`:** text, null, no uniqueness, trimmed. An empty alias is stored as null.
2. **The canvas's modes:** two columns on `canvas`, `entity_names` and `attribute_names`, text, null, `name` or `alias`. Null reads as `name`. They are ordinary canvas columns, so undo restores them (F1); `canvas.look` and D-12 are unchanged.
3. **A card's exceptions:** `canvas_item.entity_names` and `canvas_item.attribute_names`, text, null, `name` or `alias`. Null means the card follows the canvas.
   - Only entity cards use them; table and requirement cards keep them null.
   - A stored exception always differs from the canvas's mode. Setting a card to the canvas's mode clears it.
4. **A new migration** adds the six columns, with CHECK constraints `in ('name','alias')` on the four mode columns (canvas and card). Applied migrations are never edited. The AD-31 schema check passes.
5. **The local data file's next format** (Q7):
   - The upgrade sets the six new columns to null (entities, attributes, canvases, canvas items).
   - It leaves `canvas.look` as it is.
   - It writes no change events.
   - Step 2 backs up `.data/dev-db.json` before the first run that upgrades it.

### Editing aliases

6. **An "Alias" field** in the entity's panel and in the attribute's panel, under the name, on the save chain (`saveRow`), as any panel field.
   - Rights as for the name.
   - Refused in an archived workspace.
   - One change group per save.
7. **Pasting a copied attribute** (D-63) copies the original's alias once, with the name and definition.

### Showing aliases on the canvas

8. **Two controls for the canvas,** in the top bar right after the layer switch; below 1,200 px they move into "More" with Focus (F7). Proposed:
   - **Two check boxes,** "Entity aliases" and "Attribute aliases";
   - **States:** checked = alias, unchecked = name, indeterminate = mixed (some card has an exception in that dimension).
   - **A click:**
     - unchecked → checked;
     - checked → unchecked;
     - indeterminate → checked (aliases everywhere).

     In each case it clears every card's exception in that dimension, in one change group and one undo step. The command checks the versions of the cards it clears, not the canvas row's: two editors changing the same canvas's mode at once means the last write wins (F2).
   - **Rights:** editors (owners, admins, modelers), not archived. For reviewers and readers the check boxes are disabled and show the saved state (F6).
9. **A card header's menu** (D-52) gets two segments for an entity card, after "Rows", for editors (F5):
   - "Entity name": "Name", "Alias";
   - "Attribute names": "Name", "Alias".

   The segment shows the card's effective mode. A click stores the card's exception, or clears it when the choice equals the canvas's mode. One change group, one undo step.
10. **What a card shows:**
    - **The header:** the entity's alias when the card's effective entity mode is `alias` and the alias is not empty; otherwise the name.
    - **The attribute rows:** the same rule with the attribute mode, row by row.
    - **A collapsed card** shows its header only, so only the entity mode matters.
    - **Live canvases** and their context cards follow the same rules.
    - **Table and requirement cards** are unchanged.
11. **The tint (P6):**
    - a card with an entity exception gets a tinted header;
    - a card with an attribute exception gets tinted attribute rows.

    Both are CSS classes on existing elements, with a colour token for light and dark mode. The colour is chosen with step 4's screenshots.
12. **Truncation:** an alias is truncated by the same function and rule as a name (D-37).
13. **Other names on the canvas** (step 1, Q3): the header, the rows, the low-zoom block, a collapsed frame's block list and their tooltips follow the card. Mapping tooltips on rows keep the model's names. Toasts and questions about a card keep the name (P3).

### Search

14. **The object browser's search** (D-35) also matches an entity's or an attribute's alias.
    - A row found by an alias names it in the existing hint line (F13): "alias Klient" for the entity's own alias, "attribute customer_id · Numer klienta" for an attribute's.
    - A row found by its name is unchanged.

### Unchanged

15. **Unchanged:**
    - imports and source tables and columns;
    - mappings;
    - requirements;
    - relationships;
    - the Data Vault reading;
    - every place outside the canvas, which shows the name (P3).

## 4. Steps

Stop after each step with a short summary of what changed and how to check it. Wait for Łukasz before the next. A new Claude Code session may start at a step's boundary, never inside a step; it starts by reading CLAUDE.md, this PRD and `slice-11-acceptance.md`.

1. **Critical review** (section 7). Check every item, decision and criterion against the code, `docs/decisions.md` and the earlier slices' acceptance docs. Answer Q1–Q11 in `docs/prd/slice-11-acceptance.md`. No application code. Stop.
2. **Data** (items 1–5).
   - **Before anything opens the local file,** copy `.data/dev-db.json` to `.data/backups/dev-db-<date-time>-before-format-11.json` (local only). Report its path and size, and that it is byte-identical.
   - **Build:** the migration, the domain types, the look's validation, the format's upgrade and its tests, the AD-31 schema check. CI.
   - **Upgrade KB** only after Łukasz's go.

   Stop.
3. **The domain** (items 6–9 as commands, item 14's matching).
   - Setting an alias.
   - The canvas's mode with its cleared exceptions.
   - A card's exception.
   - Their change groups and undo.
   - The alias in `pasteAttribute`.
   - The search's matching.

   Unit tests. Stop.
4. **The interface** (items 6, 8–14).
   - The alias fields, the two check boxes, the card menu items, what cards show, the tint, the search rows.
   - The save chain for the controls (Q1).
   - Specs S11-01 to S11-11, the earlier specs of the cards, panels, look controls and search, and CI.
   - Screenshots: both modes, mixed check boxes, both tints in light and dark mode, a long alias, a search row found by alias.
   - Every new text listed, and D-64's text quoted.

   Stop.
5. **The measurement sitting** (section 6, S11-13). Stop.
6. **Closing:**
   - the docs (section 10);
   - one full e2e run, keeping a failing test's error output and trace before rerunning it;
   - CI and the pull request with both GitHub checks;
   - a backup of KB;
   - the manual acceptance scenario.

   Merge and tag `slice-11` only on Łukasz's command.

## 5. Acceptance criteria

Tests in `e2e/slice-11/`, one file per criterion, each from a fresh seed; unit tests next to the code.

| ID | Criterion |
| --- | --- |
| S11-01 | **Alias fields.** Customer's alias "Klient" and `customer_id`'s alias "Numer klienta" are saved in their panels; each is one undo step. Clearing the field stores no alias. Breadcrumbs, panel titles and the object browser's lists still show the names. A reviewer cannot edit the field, and a direct call is refused; in an archived workspace the write is refused. |
| S11-02 | **Entity aliases on a canvas.** Checking "Entity aliases" shows "Klient" in Customer's header. Entities without an alias show their names. One undo step. The mode stays after a reload. Another canvas with Customer still shows "Customer". |
| S11-03 | **Attribute aliases on a canvas.** Checking "Attribute aliases" shows "Numer klienta" on `customer_id`'s row and names on rows without an alias. The two check boxes are independent. |
| S11-04 | **A card's exceptions.** "Entity name: Alias" in Customer's card menu shows "Klient" while the canvas shows names, and tints Customer's header. "Attribute names: Alias" tints its attribute rows. Choosing the segment that equals the canvas's mode clears the exception and its tint. Each is one undo step. |
| S11-05 | **Mixed.** With one card's entity exception, "Entity aliases" is indeterminate. Clicking it shows aliases on every card and clears the exception (no tint). One undo restores the canvas's previous mode and the card's exception with its tint. The attribute dimension is untouched. |
| S11-06 | **Other cards.** A collapsed card shows the entity alias by the entity mode. A live canvas's context card follows the same rules. Table and requirement cards are unchanged under both modes. |
| S11-07 | **Truncation.** A long alias in a 200 px card is truncated by D-37's rule, like a name of the same length. |
| S11-08 | **Search.** Typing "Klient" in the object browser's search finds Customer with the hint "alias Klient"; typing "Numer" finds it with "attribute customer_id · Numer klienta". Typing "Customer" shows "Customer" unchanged. |
| S11-09 | **Copies.** Pasting a copy of `customer_id` gives it "Numer klienta". A later change of the original's alias does not reach the copy. |
| S11-10 | **Rights and the save chain.** The check boxes and the card segments are for editors; as a reviewer the check boxes are disabled, the segments are not offered, and a direct call is refused. Two quick clicks on a check box store both changes with no false conflict. |
| S11-11 | **Undo of the canvas's control after card exceptions:** three cards with attribute exceptions; checking "Attribute aliases" clears all three; one undo restores all three and their tints; redo clears them again. |
| S11-12 | **Data.** The migration and the schema check pass. The local file's upgrade sets the six new columns to null (entities, attributes, canvases, canvas items), keeps every count, writes no change event, and is not repeated on a file at the new format (unit test). An old change event without the new columns is undone with them as null (slice 10c's rule): a canvas then shows names, a card follows its canvas. |
| S11-13 | **Performance** (section 6). |
| S11-14 | CI and the runs of the test regime; changed earlier tests listed with the reason. |

**Definition of done (scenario for the manual acceptance, on Łukasz's model KB, after the backup and the upgrade).**

1. In "Kanton Basel", give Polish aliases to two entities and several attributes.
2. On a canvas, switch entity aliases and attribute aliases on and off.
3. Give one card an exception in each dimension, check the tints, then click the canvas's control and undo.
4. Search for an alias.
5. Paste a copy of an aliased attribute.

## 6. Performance

The only new elements are the two check boxes beside the canvas, outside the canvas. The tint is a class, and an alias replaces a name's text in the same element. Bars are proposals to confirm in step 1.

| What | How | Bar |
| --- | --- | --- |
| Viewport elements on a canvas page | `S3B-15-elements.spec.ts` with `ELEMENTS_BASELINE=.data/measure/s9-14-baseline/slice-08.json` | viewport counts equal; the page totals differ only by the two check boxes' elements, explained per element |
| Switching a mode | a branch-only spec `S11-13.spec.ts`, to the screen as `S6A-09`: on "Performance test" with an alias on every entity and attribute, written into the e2e data file by the spec only, from the click on "Attribute aliases" to the first presented frame, at 100 % and 30 %, with the layer switch and "Show all" measured beside it (F10) | one canvas commit, no miniature commit; the time bar proposed after the first figures, for Łukasz's approval |
| Drawing layers | the LayerTree read on the same view with aliases shown and with names shown | the same drawing layers |
| Pan and zoom, first render | `npm run measure:canvas -- --to-screen --only pan,c08 --no-build --against slice-10c`, one discarded warm-up run, then `--rounds 2`, balanced | within the sitting's run-to-run spread |

**Nothing above the canvas reads layout during a commit** (CLAUDE.md). The check boxes and the menu items must not measure the canvas or the cards while the canvas commits. Their indeterminate state comes from the model (any stored exception), not from the DOM.

**New elements on the canvas (AD-24):** none. The tint is a class on the header and on the rows' container. A card's text is the same element whether it shows a name or an alias.

## 7. Questions for step 1

**The rule (CLAUDE.md, "How we work"):** a PRD is a proposal to verify, not a specification; this one was written from the docs without reading the code, and from docs older than the repository's. In step 1, check every item, decision and acceptance criterion against the code, `docs/decisions.md` and the earlier slices' acceptance docs. Write into `docs/prd/slice-11-acceptance.md` where the PRD is wrong, contradicts the code or a decision, duplicates what the app already has, misses what the code needs, or costs more than it assumes (data model, undo, change events, performance), each with the files and functions behind it and a proposal. List the differences between the reference prototype and the app that the slice touches. No application code in step 1; Łukasz answers before step 2.

- **Q1. The canvas's look today.**
  - Where the layer mode, background and grid are set (the control's place, above or beside the canvas, or in a menu).
  - Who may change them (roles, archive, live canvases).
  - Whether a change is a change event and an undo step.
  - Whether it goes through the save chain.

  Propose where the two check boxes go, so that they are visible without opening a menu if that costs no layout read. If the layer mode is not undoable today, say so: P8 makes the names' controls undoable anyway, because they clear exceptions.
- **Q2. The data's shape.**
  - The existing `canvas.look` keys' style and validation.
  - Whether a card's exceptions fit `canvas_item` as `row_filter` does.
  - How a change group holds the canvas row and many `canvas_item` rows.
  - Whether a held-rows save (`saveRows`) is needed for the canvas's control.
- **Q3. Every place on the canvas that shows an entity's or an attribute's name:**
  - the card header;
  - rows;
  - collapsed cards;
  - live context cards;
  - the overlay's copies (hover, lit rows);
  - mapping hover's far-end rows;
  - requirement cards;
  - frames;
  - the miniature;
  - tooltips;
  - the zoom-to-fit labels.

  Which must follow the card's mode, and the function that truncates names (D-37).
- **Q4. The page's data.** How the canvas page gets entities and attributes, and what two alias fields per row add (as slice 10c measured 32 bytes per attribute).
- **Q5. The card header's menu.**
  - Where the two items go.
  - How the menu decides by role and archive.
  - The rule on live canvases (D-11).
  - Whether `row_filter`'s menu item is a pattern to follow.
- **Q6. Undo and change events.**
  - The commands for the alias (part of `updateEntity` and `updateAttribute`), the canvas's mode and a card's exception.
  - Their change groups and names in the undo history.
  - How `revertChangeGroup` restores cleared exceptions.
  - That slice 10c's missing-column rule covers older events.
- **Q7. The local data file.** The current format (10 after slice 10c), the inline step in `upgradeDb`, `readDb`'s write-back check, and the canvas look's absent keys.
- **Q8. The search.**
  - Where D-35's search matches today (client or server, names only).
  - How a row is drawn.
  - The smallest change that matches aliases and shows "name · alias" for a match by alias.
- **Q9. Copies.** Where `pasteAttribute` builds the copy's fields; the alias copied once (P10). D-63's text needs one more clause.
- **Q10. The measurement.**
  - Whether `measure:canvas` has a figure for switching the layer mode, or what the smallest new figure is: click to presented frame, and the canvas's commit count.
  - How to write aliases on every entity and attribute into a copy of "Performance test" in the measuring spec.
  - The `--only` keys.
- **Q11. Earlier tests and docs.**
  - Specs that change: card headers and rows, the look controls, the card menu's item lists (as S1B-07 was in slice 10c), the object browser's search, the panels' field lists.
  - The docs to update.

## 8. Differences from the prototype (deliberate)

- Entities and attributes have an alias, edited in their panels (D-64).
- A canvas shows names or aliases, per dimension, with exceptions per card and a tint on cards with an exception.
- The object browser's search matches aliases.

## 9. Left for later

- **Aliases for concepts,** frames, source tables or columns. Not wanted for sources (P9).
- **Several aliases per object** (by language or audience), with a choice of which to show.
- **A reviewer's own local choice** of names or aliases, as the layer mode works for reviewers and readers today.
- **Showing an alias outside the canvas** (breadcrumbs, panel titles), as a user setting.
- **Marking a shown name** that stands in for a missing alias.
- **Exceptions per attribute row** rather than per card.
- **Advanced search and grouping** belong to a later, separate tool, outside InfoMapper's scope for now.
- **Slices 12 and 13:** as in `docs/ideas.md`.

## 10. Decisions to accept, and docs in this PR

### D-64 (proposal) Aliases of entities and attributes

"An entity and an attribute may have an alias: free text, an extra name with no fixed meaning (a translation, a technical or a workshop name), edited in its panel. The name stays primary: everything outside the canvas shows the name, and the object browser's search also finds aliases, naming the alias in the found row's hint. Imports carry no alias, and sources have none. A copied attribute gets its original's alias once.

A canvas shows names or aliases in two independent dimensions, entity names and attribute names, each set by a check box beside the layer switch: checked for aliases, unchecked for names, and indeterminate when a card has an exception. A card may make an exception in either dimension from its header's menu: its header is tinted for an entity exception, its attribute rows for an attribute exception. Clicking a check box sets the canvas's mode and clears the cards' exceptions in that dimension; unlike the canvas's look (D-12), this is one undo step, and undo restores them. Editors set them; reviewers and readers see the canvas as saved. With no alias the name is shown. Long aliases are truncated as names are (D-37). Table and requirement cards are unchanged."

**Choices by Łukasz, 30 October 2026:**
- **The name is primary;** the alias is an extra field of the object.
- **The canvas controls what is shown,** with exceptions per card.
- **Two independent dimensions.**
- **A tint marks a card's exception.**
- **Undo for the controls.**
- **No aliases from imports.**
- **A copy's alias copied once.**
- **Search matches aliases.**

The text is quoted for approval in step 4.

### D-63 (addition)

"A copy also gets its original's alias once (slice 11)."

### AD-24 (addition, proposal after step 5)

One sentence with the sitting's figures: the names' modes switch text and classes only, with no new element on the canvas; the switch's cost against the layer mode's.

### Assumptions to confirm

- **A1.** The slice starts from `main` at tag `slice-10c` (`72ef24b`).
- **A2.** The data model change of P13 and the local file's next format (Q7). No other data model change.
- **A3.** Łukasz's KB model is backed up before the first run that upgrades it (step 2), and again before the manual acceptance. It stays local.
- **A4.** The seed gets no aliases, so the element guard stays comparable. Tests and the measuring spec add them through the domain or in the e2e data file only.

### Docs in this PR

- **`docs/decisions.md`** (only with Łukasz's approval): D-64; D-63's addition; AD-24's addition.
- **`docs/data-model-v2.md`:**
  - `entity.alias`, `attribute.alias`;
  - `canvas.entity_names` and `canvas.attribute_names`;
  - `canvas_item.entity_names` and `attribute_names`;
  - the new format and its upgrade;
  - section 11's rules (a stored exception differs from the canvas's mode).
- **`supabase/migrations/`:** the new migration.
- **`docs/inventory-prototype-vs-app.md`:** section 8's differences.
- **`docs/ideas.md`:**
  - "An alias for entities and attributes" done;
  - section 9's entries;
  - the plan updated: 11 done, next 12.
- **`docs/known-limitations.md`:** anything steps 1–5 find and Łukasz accepts.
- **README and CLAUDE.md:**
  - the slice's status;
  - the names' modes and exceptions;
  - the new format's upgrade;
  - the new e2e helpers and the measuring command.
