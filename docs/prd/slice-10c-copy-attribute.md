# Slice 10c – Copying an attribute to another entity

Status: **step 1 answered, 30 October 2026** (Łukasz's answers in `docs/prd/slice-10c-acceptance.md`; the items, criteria and D-63 below are updated to them). Branch `slice/10c-copy-attribute`, from `main` at tag `slice-10b` (`6d1a251`, assumption A1). PRD file: `docs/prd/slice-10c-copy-attribute.md`; step 1 writes `docs/prd/slice-10c-acceptance.md`. Test regime: a small slice (CLAUDE.md, "Testing"), plus the local data file's upgrade tests, and one full e2e run at the closing. Step 1 checks this PRD against the code (CLAUDE.md, "How we work").

This PRD was written from the docs at slice 10a's state and from what slice 10b changed as Łukasz described it. Step 1 checks every reference against the docs in the repository, which are at slice 10b's state.

## 1. Why this slice

A modeller often needs the same attribute in another entity:
- a primary key that becomes a foreign key elsewhere (`Customer.customer_id` → `Order.customer_id`);
- a key copied onto its own entity for a hierarchy (`Employee.employee_id` → `Employee.manager_id`; slice 10a's self-relationship);
- any other attribute repeated on purpose.

Today the attribute has to be retyped with its type and parameters, and nothing records that the two belong together. A copy that remembers its original gives two things:
- **consistency:** the copy's type follows the original's;
- **business metadata:** where an attribute was copied to, and what is lost when the original goes.

That is impact analysis at the attribute level.

**Agreed with Łukasz on 30 October 2026:**

- **P1. A copy is a full attribute** of its entity: its own row, with its own name, definition, mappings, requirement links and labels, like any attribute.
- **P2. The copy follows its original** in what must stay consistent: the data type with its parameters, and Personal data. Everything else is copied once and is then the copy's own (section 3, item 6).
- **P3. Only the attribute is copied.** Mappings, requirement links and labels are not: in modelling they can be entirely separate things.
- **P4. One attribute at a time,** by copy and paste:
  - "Copy" in an attribute row's menu;
  - "Paste attribute" in an entity card header's menu.

  Any attribute can be copied, not only a key. Composite keys are built by copying their attributes one by one: that is modelling and validating work.
- **P5. A copy is not tied to a relationship.** The sides of a relationship are not checked when copying. Whether keys and relationships fit together is a model validator's work (section 9; `docs/ideas.md`).
- **P6. Losing the original leaves a lasting trace, not only a toast.**
  - Deleting an original with copies first asks for a second click that names the copies (F7).
  - The copy's panel keeps showing that its original was deleted.
  - Undo brings the link back.
- **P7. A copy's lost reference shows in its panel only,** with no mark on the canvas. A mark on the card rows is left to the validator.
- **P8. Foreign key flag at paste:** a copy of a primary key gets `is_foreign_key = true`; any other copy gets `false`. The modeller can change it.
- **P9. "Stop following"** is in this slice: the modeller can detach a copy on purpose.
- **P10. One slice.** No split into 10c and 10d.

**Proposed, to confirm in step 1:**

- **P11. The data model gets one column.** `attribute.copied_from_attribute_id` (nullable, FK `attribute`). The local data file gets its next format (assumed format 10; Q7), with a step that backs up Łukasz's KB model first.
- **P12. Nothing new on the canvas.** No element guard change is expected, and there is no A/B sitting. The element guard runs once at the closing to prove it.

## 2. Sources

**Prototype:** it has no copy and paste of attributes. Every behaviour here is D-63.

**Decisions:**
- **D-01:** type checking of mappings against the attribute's type.
- **D-11:** live canvases.
- **D-36:** attribute order belongs to the model.
- **D-38:** history places.
- **D-47:** the impact preview before deleting an entity.
- **D-52:** card actions only in the card header's menu.
- **D-54:** the details panel.
- **D-61:** the self-relationship.
- **AD-05:** roles.
- **AD-09:** archive.
- **AD-12:** versions.
- **AD-13:** change events and change groups.
- **AD-23:** writes.
- **AD-27, AD-28:** type parameters, the business key.
- **AD-31:** the schema check.

**Data model:** `docs/data-model-v2.md`:
- section 4, `attribute` (`data_type`, `custom_type`, `type_length`, `type_precision`, `type_scale`, `is_primary_key`, `is_foreign_key`, `is_business_key`, `is_pii`, `is_nullable`, `definition_html`, `definition_text`, `sort_order`);
- the local data file's formats (format 9 in slice 8).

**Earlier slices:**
- **1b:** S1B-08, attribute order; S1B-13, deleting with Undo in the toast; S1B-14, a reviewer's rights.
- **7c:** `is_pii` as the attribute's PII badge.
- **8:** format 9's upgrade, no change events, one log line.
- **9 and 10a:** the save chain: `saveRow`, `saveRows`, `rowSaves.answer`, actions returning versions.
- **10a:** the self-relationship.

## 3. What to build

Texts in quotes are proposals. The step that builds them lists every new user-facing text for approval.

### Data

1. **`attribute.copied_from_attribute_id`** (uuid, null, FK `attribute`): the attribute this one was copied from.
   - Null for every attribute today and for any attribute not made by paste.
   - It may point to a soft-deleted attribute: that is the lost reference (item 9). No other column records it.
   - A new migration adds it. Applied migrations are never edited, and the AD-31 schema check passes.
   - The local adapter checks it as a foreign key that may point to a deleted row. Undo's parent check (`PARENTS`) leaves it out (F9).
   - Undo writes a column that an older change event's image lacks as null (F10).
2. **The local data file's format 10** (Q7, F11) adds the column as null to every attribute, as an inline step in `upgradeDb`, with an upgrade test.
   - The upgrade writes no change events, as format 9's did, and no log line.
   - `readDb` writes an upgraded file back at once (the check moves to `was < DEV_DB_FORMAT`).
   - Step 2 backs up `.data/dev-db.json` before the first run that upgrades it (section 4).

### Copy and paste (P4)

3. **"Copy"** in an attribute row's menu (on the card; Q2), for owners, admins and modelers.
   - It puts the attribute in a clipboard of the page, not the system's clipboard: the attribute's id, name and entity.
   - The clipboard keeps the last copied attribute until the next "Copy" or a reload. It survives switching canvases within the workspace (Q3).
   - Proposed toast: "Copied “{attribute}”. Paste it with “Paste attribute” in an entity card's menu."
4. **"Paste attribute “{attribute}”"** in an entity card header's menu (D-52).
   - **When it shows:** only while the clipboard holds an attribute of this workspace. Same rights as adding an attribute; refused in an archived workspace.
   - **On a live canvas:** the same rule as adding an attribute there (Q2).
   - **What it creates:** one change group, one undo step. The new attribute goes last on the entity, and its panel opens with the name field focused (D-54).
   - **The same entity is allowed:** the hierarchy case.
   - **Pasting again:** the same attribute can be pasted into several entities, or again into the same one.
   - **An original deleted since the copy:** proposed refusal "The copied attribute no longer exists.", and the clipboard empties.
5. **What a paste copies:**
   - **copied once,** then the copy's own: the name (Q1 for a clash), the definition and `is_nullable`;
   - **followed** (item 6): `data_type`, `custom_type`, `type_length`, `type_precision`, `type_scale` and `is_pii`;
   - **set:** `is_primary_key` false, `is_business_key` false, `is_foreign_key` equal to the original's `is_primary_key` (P8), `copied_from_attribute_id` the original's id;
   - **not copied:** mappings, requirement links, labels (P3).

   **A copy of a copy** points to the attribute that was copied, not to the first original. The followed fields reach it through the chain.

### Following (P2)

6. **A change of a followed field on an original** writes the same value to every live copy, and to their copies, in the same change group: one undo step for all.
   - **In a copy's panel,** the followed fields are read-only, with "Follows {entity}.{attribute}." beside them.
   - **Other fields** stay the copy's own: name, definition, nullable, keys, mappings.
   - **Mappings:** a type change that now mismatches a copy's mapping is shown by D-01's type check as for any attribute.
   - **The save chain:** a followed-field save on an original goes through `saveRows`, the original checked and its copies held; the action returns the versions it wrote (`{ versions: true }`), so a copy's save is never refused as a false conflict (F4).
   - **One rule in one place:** `followOriginals` (`src/domain/model/copies.ts`), called by `updateAttribute` and by undo and redo (`revertChangeGroup`), writes the copies in the same change group; a visited set guards the walk (F1, F17).
   - **The domain refuses** a followed field on a copy with a link, whatever calls it (F5).
   - **The working context** labels the original only; copies written by following are left out (F3).
7. **The panels show the link:**
   - **An original:** "Copies" lists every live copy as "{entity}.{attribute}", each selecting that attribute (a history place, D-38).
   - **A copy:** "Copied from {entity}.{attribute}", selecting the original.

### Losing the original (P6, P7)

8. **Deleting an attribute that has live copies** asks for a second click, the existing pattern of an attribute with mappings (`ConfirmDelete` in the panel, `confirm` in the row's menu; F7). The second click's text names the copies (texts in the acceptance doc, F7).
   - **Without mappings and copies** the delete stays immediate, with Undo in the toast (S1B-13); with mappings only it asks as today.
   - **Deleting an entity:** D-47's preview gains a line for copies in other entities whose originals go with it.
   - **Deleting a copy** is an ordinary delete.
9. **A copy whose original is deleted** keeps its link.
   - **Its panel says** "Copied from {entity}.{attribute}, which was deleted."
   - **Its followed fields** stay read-only; only "Stop following" makes them editable (F2).
   - **Its panel names the deleted original** from a small list the page loads (`lostOriginals` in `model.load`, F6).
   - **Undo** of the delete restores the original, and the copy follows again; it writes the copy only if the two differ (F1).
   - **The original's later changes** reach nothing while it is deleted.
10. **"Stop following"** in a copy's panel, live original or deleted, clears `copied_from_attribute_id`. One change group, one undo step. The fields stay as they are and become editable.

### Unchanged

11. **The canvas:** no new element, line or badge. A copy of a primary key shows the foreign key flag as any attribute with that flag does today (Q8).
12. **Unchanged behaviours:** relationships, mappings, requirements, imports and the Data Vault reading. Nothing reads the new column except what this slice adds (Q9).

## 4. Steps

Stop after each step with a short summary of what changed and how to check it. Wait for Łukasz before the next.

1. **Critical review** (section 7). Check every item, decision and criterion against the code, `docs/decisions.md` and the earlier slices' acceptance docs. Answer Q1–Q10 in `docs/prd/slice-10c-acceptance.md`. No application code. Stop.
2. **Data** (items 1, 2).
   - **Before anything runs against the local file,** copy `.data/dev-db.json` to a dated backup in `.data/backups/`, local only, and report its path.
   - **Build:** the migration, the domain type, the local file's upgrade and its tests, the AD-31 schema check. CI.
   - **Upgrade KB** only after Łukasz's go: report the format before and after, and the attribute count unchanged.

   Stop.
3. **The domain** (items 4–6, 8–10, as commands). Paste, following, Stop following, the delete consequences, the versions returned. Unit tests. Stop.
4. **The interface** (items 3–5, 7–9, 11). Copy, the clipboard, the paste item, the panels, the previews. Specs S10C-01 to S10C-10. The earlier specs of attribute rows, attribute and entity panels and deletes. CI. Every new text listed for approval, and D-63's text quoted. Stop.
5. **Closing:**
   - the element guard against `slice-08.json` (expected equal);
   - docs (section 10);
   - one full e2e run, keeping a failing test's error output before rerunning it;
   - CI, the pull request, a backup of KB, the manual acceptance scenario.

   Merge and tag `slice-10c` only on Łukasz's command.

## 5. Acceptance criteria

Tests in `e2e/slice-10c/`, one file per criterion, each from a fresh seed; unit tests next to the code.

| ID | Criterion |
| --- | --- |
| S10C-01 | **Copy and paste.** "Copy" on `Customer.customer_id` (a primary key), then "Paste attribute “customer_id”" on Order. Order gets `customer_id` last: same type and parameters, definition and nullable; `is_foreign_key` true, PK and BK false; no mappings, requirement links or labels. Its panel opens with the name focused. One undo step removes it; redo brings it back. A copy of an attribute that is not a primary key has `is_foreign_key` false. |
| S10C-02 | **The same entity and again.** Pasting `employee_id` into Employee creates a second attribute there (Q1's naming). The same clipboard pastes into two more entities. The clipboard survives switching canvases and is empty after a reload. The paste item is absent while the clipboard is empty. |
| S10C-03 | **Following.** Changing the original's type or length, and then Personal data, changes every copy and a copy of a copy, in one change group. One undo restores all. In a copy's panel the type fields and Personal data are read-only with "Follows Customer.customer_id."; its name, definition, nullable and keys are editable and do not change the original. |
| S10C-04 | **The panels.** The original's panel lists "Copies" with each copy; a click selects it, and Back returns. The copy's panel shows "Copied from Customer.customer_id"; a click selects the original. |
| S10C-05 | **Deleting the original.** With two copies, deleting `Customer.customer_id` asks for a second click whose text names both copies; the button disarms after 4 s or on leaving it, and nothing is deleted. The second click removes it, and each copy's panel says its original was deleted, with its followed fields still read-only and "Stop following". Undo restores the original, and the copies follow again. An attribute without copies is still deleted at once, with Undo in the toast (S1B-13). |
| S10C-06 | **Deleting an entity.** Deleting Customer shows D-47's preview with the copies in other entities that lose their original. |
| S10C-07 | **Stop following.** On a copy, "Stop following" clears the link: its fields become editable, and the original's panel no longer lists it. One undo restores the link. The same works on a copy whose original is deleted. |
| S10C-08 | **Refusals and rights.** Pasting after the original was deleted (in another session) is refused with item 4's text, and the clipboard empties. As a reviewer there is no "Copy" and no paste item, and a direct call is refused. In an archived workspace paste is refused. |
| S10C-09 | **The save chain.** The original's length changed in its panel, then at once a copy deleted from its row's menu: both stored, no false conflict (the copies' versions reach `rowSaves.answer`). |
| S10C-10 | **Data.** The migration and the schema check pass. The local file's upgrade sets the new column to null on every attribute, keeps every count, and writes no change event (unit test). A file already at the new format is not upgraded again. An undo of a change recorded before format 10 writes the column as null (F10). |
| S10C-11 | **The canvas is unchanged:** the element guard is equal to `slice-08.json` in all four views. |
| S10C-12 | CI and the runs of the test regime. Earlier specs pass unchanged in behaviour; code that builds attribute rows gains the column (F18). |
| S10C-13 | **Undo keeps copies in step.** Undo of a type change made before a paste, redo of a paste after a type change, and undo of Stop following after a type change: every copy shows its original's type (unit tests; one e2e for the first case). |
| S10C-14 | **The working context.** With a context on, a followed change labels the original only (unit). |

**Definition of done (scenario for the manual acceptance, on Łukasz's model KB, after the backup and the upgrade).**

1. In "Kanton Basel", copy a primary key and paste it into two other entities. Check the copies' fields and that the foreign key flag is set.
2. Change the original's length. Both copies follow. Undo.
3. Paste a key into its own entity and rename the copy.
4. Delete the original and read the consequences. Check a copy's panel. Undo.
5. Stop following on one copy. Undo.

## 6. Performance

Nothing new is drawn on the canvas (P12). So there is:
- no LayerTree read;
- no A/B sitting.

The element guard runs once at the closing (S10C-11), expected equal.

The attribute row grows by one column. Step 1 says whether the page's data grows measurably (Q9).

**Following** writes one row per copy in one action. With the number of copies an attribute has in practice (a handful), no measurement is proposed. Step 1 says if the code makes it more than linear.

**Nothing above the canvas reads layout during a commit:** the only new elements are in the details panel and a confirmation.

## 7. Questions for step 1

**The rule (CLAUDE.md, "How we work"):** a PRD is a proposal to verify, not a specification; this one was written from the docs without reading the code, and from docs older than the repository's. In step 1, check every item, decision and acceptance criterion against the code, `docs/decisions.md` and the earlier slices' acceptance docs. Write into `docs/prd/slice-10c-acceptance.md` where the PRD is wrong, contradicts the code or a decision, duplicates what the app already has, misses what the code needs, or costs more than it assumes (data model, undo, change events, performance), each with the files and functions behind it and a proposal. List the differences between the reference prototype and the app that the slice touches. No application code in step 1; Łukasz answers before step 2.

- **Q1. Names.** Must attribute names be unique in an entity? The data model says nothing.
  - If they must: propose how a paste names a clash (e.g. "{name}_copy", then the panel's name field focused).
  - If they need not: say whether the domain warns on duplicates, as it does for entities (B-25).
- **Q2. Menus and rights.**
  - Where an attribute row's menu and a card header's menu are built.
  - How they decide by role and archive.
  - The rule for adding an attribute on a live canvas (D-11).
  - Whether an attribute's own panel should also offer "Copy". The PRD proposes the row menu only.
- **Q3. The clipboard.**
  - Where client state that survives switching canvases lives (the UI store).
  - Whether switching workspaces must clear it.
  - What a paste sends: the original's id; the server reads the rest.
- **Q4. Following.**
  - Which commands change the followed fields (`updateAttribute` or others, e.g. a type change from a mapping or an import suggestion).
  - Where the propagation belongs in the domain (AD-23).
  - How it walks copies of copies, and that it cannot loop.
  - The change group and undo.
  - The versions returned for `rowSaves.answer`.
  - Whether a followed field can be written to a copy by any other path, which must then be refused.
- **Q5. Deleting.**
  - That deletes are soft everywhere: no purge removes an attribute row that a copy points to.
  - How undo restores an original.
  - Whether the FK from `attribute` to itself needs anything in the migration, the local adapter or the seed.
- **Q6. The previews.**
  - How an attribute is deleted today (immediate, with Undo; from the row menu and the panel).
  - How to show item 8's consequences without changing deletes that have no copies.
  - Where D-47's entity preview is built and how a line is added to it.
- **Q7. The local data file.**
  - The current format number (format 9 in slice 8: is there a later one?).
  - The upgrade module's pattern (`src/data/local/upgrade-N.ts`).
  - Whether a column added as null needs an upgrade at all, or whether the adapter can read an absent field as null. In either case the format number moves, so that an older app refuses a newer file.
- **Q8. The canvas.** Does an attribute row show a foreign key badge from `is_foreign_key`? If so, a copied key shows it, as any attribute with that flag would: no new element type. Confirm the element guard's expectation (equal; the seed gets no copies).
- **Q9. Other readers of attributes:**
  - exports;
  - the Data Vault reading;
  - business key suggestions (AD-28);
  - imports;
  - search;
  - the page's model on the canvas.

  Which of them must know about the new column, and what the column adds to the page's data.
- **Q10. Earlier tests and docs.**
  - Specs that change: S1B-13, D-47's preview specs, attribute panel and row menu specs.
  - The docs to update.

## 8. Differences from the prototype (deliberate)

- Copying and pasting an attribute, with a copy that follows its original's type and Personal data (D-63). The prototype has neither.
- Deleting an attribute with copies first shows its consequences. In the prototype an attribute is always deleted at once.

## 9. Left for later

- **A model validator** (to `docs/ideas.md`, agreed with Łukasz on 30 October 2026):

  "**A model validator (slice 10c, PRD section 9).** Copies of attributes are not tied to relationships (slice 10c), so a check across the model would report what does not fit:
  - a copy of a primary key in an entity with no relationship to the original's entity;
  - a relationship with no copied key on its "many" side;
  - a copy whose original is deleted ("reference lost");
  - a foreign key flag without a copy;
  - keys copied in the wrong direction (from the "many" side to the "one" side).

  The results as a list in a panel, each linking to the place; later a mark on the card rows (an element guard and a measurement). The validator reads only; it changes nothing."
- **A mark on the card row** of a copy whose original was deleted (with the validator).
- **Copying several attributes at once** (a whole composite key), and Ctrl+C / Ctrl+V on a selected attribute row.
- **Pasting into another workspace.**
- **Copying with mappings,** as an option.
- **Slice 11:** an alias for entities and attributes (a data model change).
- **Slices 12 and 13:** as in `docs/ideas.md`, "The plan after slice 10a".

## 10. Decisions to accept, and docs in this PR

### D-63 (proposal) Copying an attribute

"An attribute can be copied to any entity, its own included:
- "Copy" in its row's menu, then "Paste attribute" in an entity card header's menu, one attribute at a time, by owners, admins and modelers in a workspace that is not archived.
- The copy is a full attribute of its entity. It starts with the original's name, definition and nullable, which are then its own. It gets no mappings, requirement links or labels.
- A copy of a primary key is flagged as a foreign key; nothing ties a copy to a relationship (a validator's work, later).
- The copy follows its original's data type with its parameters and Personal data, which are read-only in its panel while it is a copy, also when its original is deleted. A change of them on the original, or an undo or redo, reaches every copy and their copies in the same step.
- Deleting an original that has copies asks for a second click that names them. The copies stay, and each copy's panel keeps saying its original was deleted until Undo brings it back.
- "Stop following" detaches a copy."

**Choices by Łukasz, 30 October 2026:**
- **The trigger:** copy and paste, one attribute at a time.
- **What follows:** the type with its parameters, and Personal data.
- **What is copied:** the attribute only.
- **The foreign key flag:** from the original's primary key.
- **A lost reference:** shown in the panel only.
- **"Stop following":** in this slice.

The text is quoted for approval in step 4.

### Assumptions to confirm

- **A1.** The slice starts from `main` at tag `slice-10b` (`6d1a251`).
- **A2.** One column and the local file's next format (Q7). No other data model change.
- **A3.** Łukasz's KB model is backed up before the first run that upgrades it (step 2), and again before the manual acceptance. It stays local.
- **A4.** The seed gets no copies, so the element guard stays comparable. Tests make copies through the domain.

### Docs in this PR

- **`docs/decisions.md`** (only with Łukasz's approval): D-63.
- **`docs/data-model-v2.md`:**
  - section 4, `attribute`: `copied_from_attribute_id`;
  - the local data file's new format and what its upgrade does;
  - section 11, the rules: following, no loops.
- **`supabase/migrations/`:** the new migration.
- **`docs/inventory-prototype-vs-app.md`:** section 8's differences.
- **`docs/ideas.md`:**
  - "Copying an attribute to another entity" done;
  - the validator entry of section 9;
  - section 9's other entries;
  - the plan updated: 10c done, as copy and paste, not tied to a relationship; next 11.
- **`docs/known-limitations.md`:** anything steps 1–4 find and Łukasz accepts.
- **README and CLAUDE.md:**
  - the slice's status;
  - the clipboard;
  - following and its versions;
  - the new format's upgrade;
  - the new e2e helpers.
