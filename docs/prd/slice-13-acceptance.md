# Slice 13 – acceptance

Status: **step 1 answered (1 November 2026); step 2 (the shared mechanism) in progress.**

- Branch `slice/13-field-saves`, made on 1 November 2026 from `main` at `e66cc42` (the start commit,
  `e66cc42c4c1fefd9514f3c9a09cc67c7051136d3`), the merge of PR 32 (chore e2e reliability, merged 1 November 2026,
  20:12 UTC); `origin/main` is at the same commit (A1 holds).
- The PRD is copied unchanged from `~/Downloads/slice-13-field-saves.md` (21,637 bytes, identical byte for byte: `cmp`
  and SHA-256 `735ba9b4a88b57391a7c45fbc4f04f9e2cf358495b3c88f889016c976fda4cc0`). Commit "docs: add slice 13 PRD and
  acceptance".
- `.data/dev-db.json` (KB) is not read or changed in step 1; nothing was run against it.

## Step 1: the PRD checked against the code

Step 1 checks items 1–13, R1–R8, D-66, A1–A4 and S13-01 to S13-13 against the code, `docs/decisions.md` and the
acceptance docs of slices 0, 9, 10a, 10c and 12a.

**The PRD's direction holds:** a draft per field, never replaced by a fresh page, and kept after a refusal. Most of it
is cheaper than it looks. The panels' fields are uncontrolled (`defaultValue`), so the draft already lives in the DOM.
Typing renders nothing, and items 3 and 4 come down to a stable key plus one rule for when a field takes the stored value
(F7).

**What the PRD misses:**
- **A refusal brings no fresh page today** (F3). The page never learns the newest stored value. Saving again is refused
  again until something else refreshes the page, so "Reload" is the only way out today. The conflict line, "Keep mine"
  and the read-only state after an archive all need the page to refresh after the refusal. That is one line in
  `runCommand`.
- **The entity has no description** (F1). Its long text is the definition, a rich-text dialog with a Save button (F4),
  so S13-01, S13-03 and S13-05 need other fields.
- **A conflict is per row, the line is per field** (F5). A stale refusal often concerns a field nobody else changed.
- **There are more than three behaviours today** (F2): at least seven.
- **Notes and frames save through the canvas's own queue** (F12), so item 1 contradicts item 13 ("the canvas
  unchanged").

**What costs more than assumed:**
- every panel's `onSave` must return the save's answer: about 35 call sites (F24);
- rich-text fields need the line inside their dialog (F4);
- choice fields come in three kinds (F9);
- keeping a draft after its panel closed, or after a delete, needs a page-level store (F15, F16).

**A2 is confirmed:** no data model change and no new local file format. Drafts live in the browser's memory, "Keep mine"
is an ordinary save, the newest value comes from the fresh page, and "by {person}" would read the existing `updated_by`
(F20).

### Findings

| # | Finding | Files and functions | Proposal |
| --- | --- | --- | --- |
| F1 | **The entity has no description.** Its fields are name, alias, stereotype, concept and definition, and the definition is a rich-text dialog (`RichTextField`), where Enter adds a line. S13-01 ("type, press Enter, click back and type more"), S13-03 and S13-05 name an entity's description. | `entity-panel.tsx` (`EntityPanel`); `src/ui/rich-text/rich-text-field.tsx` | S13-01: the entity's **name** (a `TextField`, Enter saves) and, for a long text, a **source table's note** (`SourceNote`, a `TextArea`, left with Tab). S13-03: the entity's **name** or the table's note. S13-05: **name and alias**. The rich-text case goes to S13-04 (F4). |
| F2 | **Seven behaviours after a refusal today, not three.** (a) `fieldKey` fields keep the typed text, but only until the next fresh page that changes that field's stored value: it remounts them and the text is lost. (b) The requirement panel shows the stored values after *any* refusal, validation and cut included (`setReset`); its description dialog closes and the rich text is lost. (c) The settings form reverts (`revert()`). (d) The label panel is keyed by `label.id:version:reset` and goes back after a refusal; the version key is also the Tab-focus bug that PR 23 fixed elsewhere. (e) `Seg`, `Flag` and the settings check boxes are controlled by the stored value, so they show it again. (f) A note's text rolls back (`useNotes.save`, `back`). (g) The concept's rename field in the tree closes before the answer, so a refused name is lost. Rich-text dialogs outside the requirement panel stay open with the draft. | `fields.tsx`; `requirement-panel.tsx:38,54,101`; `settings-form.tsx` (`save`, `revert`); `label-panel.tsx:40,70,117`; `useNotes.ts:156` (`save`); `left-panel.tsx:176` (`renameConcept`) | The inventory below (Q1). Every one joins the common rule except notes and frames (F12). |
| F3 | **A refusal brings no fresh page.** `modelCommand` and the other wrappers call `revalidatePath` only on success. After a stale refusal the page keeps the old value and the old version, and saving again sends that version and is refused again. Only an unrelated write or a navigation refreshes the page, and that remounts the field and loses the text (F2 a). "Reload to see the latest version" is therefore the only way out today. | `src/app/_actions/model.ts:46` (`modelCommand`) and the other wrappers; `run-command.ts` (`runCommand`: the `CONTEXT_LABEL_GONE` branch already revalidates on a refusal) | **In `runCommand`, revalidate after a refusal that cuts** (`stale_version`, `forbidden`, `archived`, `not_found`): one line beside the existing `CONTEXT_LABEL_GONE` branch, with the page in the same response. Then the conflict line reads the newest value from the page (Q4). "Keep mine" is `saveRow` with the version the fresh page shows (Q8). A field cut behind a conflict compares its own stored value (item 8). After an archive or a role change the page turns read-only (Q7). It applies to every write, the canvas's included. The canvas already merges fresh pages (`mergeFresh`), so its code does not change, but its refused drags and deletes then bring a fresh page too. **Question 1.** Exception: a locked organization (F17). |
| F4 | **Rich-text fields are dialogs, and the conflict line needs to be inside the dialog.** The entity's and attribute's definition and the requirement's description edit in a modal dialog with Save (`RichTextDialog`). On a refusal the dialog stays open with the draft; only the requirement panel's `reset` closes it. With F3's fresh page, today's key (`fieldKey(id, "definition", html)`) would remount `RichTextField` and close the dialog on every conflict. | `rich-text-field.tsx` (`save`); `rich-text-dialog.tsx`; `entity-panel.tsx:120`, `attribute-panel.tsx:266`, `requirement-panel.tsx:125` | The stable key (F7) for `RichTextField` too. **The line goes inside the dialog**, under the editor: "Changed meanwhile to:" with the other text formatted (`shownHtml`) and folded by CSS, then "Use this" (the editor takes the stored text and the dialog stays open) and "Keep mine" (saves the editor's text on the newest version). Leaving the dialog keeps its two-step Esc. S13-04 (the requirement's description) tests it. **Question 2.** |
| F5 | **A conflict is per row, the line per field.** The version is the row's (AD-12). S9-03's case: the first session changes Precision, the second's **name** is refused although nobody changed the name. "Changed meanwhile to: unit_price" would show the value the person started from. | `src/domain/commands/shared.ts` (the version check); `row-saves.ts` | The field remembers the stored value its draft started from (its **base**). After a stale refusal and the fresh page: if its own stored value still equals the base, it shows "Not saved" as a cut field does (item 8) and saves on Enter or on leaving. Only if the stored value differs from the base does it show the conflict line. Alternative (b): send it once more by itself on the newest version, which is a field-level merge the domain does not do today. Recommended: the first. **Question 3.** |
| F6 | **While the line shows, leaving the field must not save.** After F3's fresh page the field's row shows the newest version. An ordinary blur would save the draft over the other person's value without "Keep mine". | `TextField` and `TextArea` (`onBlur`) | While a conflict line shows, Enter and leaving the field save nothing; only "Keep mine" saves. Typing more in the draft keeps the line. |
| F7 | **The draft (Q2): a stable key and one rule for the stored value.** | `fields.tsx` (`fieldKey`, `TextField`, `TextArea`); `attribute-panel.tsx` (`ParamField`) | See Q2: the key `${id}:${field}`; the field stays uncontrolled. One small hook in `fields.tsx` keeps the base, the last value sent, the refusal state and the line. The stored value is written into the element in an effect, without a render, when the field has neither a draft nor the focus. Typing renders nothing, as today. |
| F8 | **A repeated save is refused as "Nothing to change."** The blur compares the text with the stored value from the last render. Enter, then a click back and Enter again before the answer, sends the same text a second time. The domain refuses it as `invalid` (slice 9 F7 proposed dropping it; it was not built). Item 4 makes this case common. | `fields.tsx` (`TextField.onBlur`); `shared.ts` (`nothingToChange`) | The field compares with the **last value it sent** while that save is on its way, and with the stored value otherwise. Unit test. |
| F9 | **Choice fields come in three kinds (R4).** Selects are uncontrolled and keyed (entity stereotype and concept, attribute type, requirement kind and parent, frame concept and system), so after a refusal they keep the choice. `Seg` (mapping kind and status, relationship ends, requirement severity, status and priority, frame kind, note status) and `Flag` (attribute flags) are controlled by the stored value and show it again. The settings form's check boxes and select revert. A choice saves on the click, so its draft lives only during the round trip. | `fields.tsx` (`Seg`, `Flag`); the panels | (a) **The PRD (R4):** a local chosen value in `Seg`, `Flag` and the check boxes, and the line with "Use this" and "Keep mine" under each. (b) **Recommended:** after a refusal a choice field shows the newest stored value (F3's fresh page) with the toast. A choice is one click to repeat, so nothing typed is lost; selects join this through the stable key. S13-08 then checks that the newest choice shows and nothing is overwritten. **Question 4.** |
| F10 | **The settings form is keyed by `workspace.version` and is not an undo step.** Every save remounts the whole form: Tab to the next field loses the focus, and text typed during the round trip is lost in every field. Creating a requirement raises the workspace's key counter and therefore its version. Workspace settings are not undo steps (`remember`: "settings, people and a canvas's look cannot"), so item 7's and R3's "Keep mine … an ordinary undo step" does not hold here. | `w/[workspaceId]/page.tsx:306-307` (`key={workspace.version}`); `settings-form.tsx` (`version` state, `saved` ref, `revert`); `run-command.ts` (`remember`); `undo.ts:34` | Drop the form's key; per-field stable keys through the shared hook (F7). The form takes the version from the page and `rowSaves`, not its own state. "Keep mine" in the settings is a save without an undo step, and D-66 says so. |
| F11 | **The label panel is a fourth behaviour.** It is keyed by `label.id:version:reset`, so a save of the name remounts it (the pre-PR 23 Tab-focus bug), and a refusal goes back. S3A-04 asserts that it goes back. | `label-panel.tsx:40,70,117` | It joins the common rule: the stable key, no `reset`. |
| F12 | **Notes and frames save through the canvas's queue.** The note panel's text, status and colour and the note's text edited on the canvas (`NoteLayer`) go through `ui.updateNote` → `useNotes.update`, optimistic, with a rollback on a refusal. The frame panel's fields go through `ui.updateFrame` → `useFrames.updateFrame` (`enqueueGroup`, not `rowSaves`). Item 1 names both panels; item 13 says the canvas does not change. | `useNotes.ts:156,350`; `useFrames.ts:936`; `NoteLayer.tsx`; `note-panel.tsx`; `frame-panel.tsx` | **Recommended:** notes and frames stay as they are (beside R5), listed in known limitations; the frame panel's fields get only the stable key, which needs no canvas code. Alternative: a note's text keeps its draft (no rollback of `text`), which changes `useNotes` and needs S13-12's commit count for notes. **Question 5.** |
| F13 | **The concept's rename in the tree closes before its answer.** `renameConcept` calls `setRenaming(null)` first, so a refused name is lost. It has Escape (cancel). | `left-panel.tsx:176` (`renameConcept`), `NameInput` | The field stays open, read-only, until the answer. On a refusal it keeps the draft with the line or "Not saved"; on success it closes. Small. |
| F14 | **R1 ("no field goes back on its own") contradicts D-59 and `required`.** An empty project name goes back with D-59's toast. `TextField required` (entity, attribute and label names) puts the stored name back on an empty blur, in the browser, without a save. The server refuses an empty settings name, requirement name or key ("Enter a name."), and S0-08 and S4A-02 assert that the field goes back. | `project-heading.tsx` (name `onBlur`); `fields.tsx` (`TextField`, `required`); `S0-08.spec.ts:30-40`; `S4A-02.spec.ts:36-45` | Keep D-59's rule and `required` as the one exception: **an empty required name goes back** (it was never a draft worth keeping). Extend it to the fields where the server refuses it (the settings' name, the requirement's name), so all names behave as D-59. Other validation refusals keep the draft (item 9). **Question 6.** |
| F15 | **A refusal after its field is gone (Q3).** Clicking another card blurs the field (the save starts), then the panel unmounts; a refusal that arrives later finds no field and only toasts. The same applies to leaving a page by a link. Item 1's promise does not hold in this case. | `inspector.tsx` (panels keyed by object); `use-action.ts` (`run`) | (a) A toast only, as today, recorded in known limitations. (b) A page-level store of refused drafts (`src/app/_components/field-drafts.ts`, a value store like `attribute-clipboard.ts`, keyed `object:field`): the field reads it on mount, so reopening the panel shows the draft with its line, and the toast says so. About 60 lines, one text, one spec. Recommended: (b), as it is the slice's promise. **Question 7.** |
| F16 | **A deleted object (Q6).** On a `not_found` refusal the panel stays (no fresh page) until the next one, then the Inspector shows the Overview, silently. D-38's toast belongs to Back and Forward only (`SelectionHistory`'s `GONE`), not to a panel. | `inspector.tsx` (`body`); `SelectionHistory.tsx` | With F3 the fresh page comes at once, and the panel goes with the toast "This entity does not exist." (the domain's). Keeping the draft would need F15 (b)'s store plus an Inspector branch for a gone object with read-only drafts (about 80 lines, two texts, one spec). Recommended: as the PRD, the draft goes with the object. **Question 8.** |
| F17 | **Read-only after a refusal (Q7).** With F3's fresh page, `editable` turns false. `TextField` and `TextArea` become `readOnly`; with a stable key the DOM keeps the draft, selectable. Selects become `disabled` and keep the chosen value. The project home then renders text (`<h1>`, `<p>`) and the draft is lost. The settings use `disabled`, whose text cannot be selected. **A locked organization**: a fresh page redirects to its password form (`loadShell`), so the draft is lost; it happens after signing in in another tab with a password that unlocks only another organization (the cookie is replaced). | `project-heading.tsx` (`!editable`); `settings-form.tsx` (`disabled={dis}`); `unlock.ts` (`lockedRefusal`, code `forbidden`) | A field with a draft stays an input, `readOnly`, marked "Not saved", until the person leaves the panel or the page: the project heading keeps its inputs while a field has a draft, and the settings switch to `readOnly` there. No fresh page after `lockedRefusal`: it gets its own code `locked` in `ActionResult` (app level; the domain unchanged), the toast says "Unlock {organization} first: …" as today, and the draft stays editable. |
| F18 | **S13-09: another session's save shows only on this page's next fresh page.** No page polls (`router.refresh` is called only in `history-nav.tsx` and the import wizard). | — | S13-09 makes the other session's write, then an own write of another field (or a navigation) brings the fresh page: the untouched field shows the new value, and the field with a draft keeps it. |
| F19 | **S13-12's "0 canvas commits" for a conflict line.** With F3 the conflict's fresh page reaches the canvas like any fresh page, and the other person's change may be on a card (a name). Typing (0) and "Use this" (0) hold. | `ModelCanvas.tsx` (`__imCanvasCommits`) | S13-12: typing 20 characters **0**; "Use this" **0**; the conflict's fresh page as many commits as a fresh page from an own save of the same field (measured both ways, recorded). |
| F20 | **"by {person}" (Q5).** The canvas page and the workspace home load `workspacePeople`; the project home does not. `updated_by` names the row's last writer, which may be of another field, an undo, a copy following its original (`followOriginals`), an import or a change to resolve; a removed person's seed rows have no name. | `canvas/[canvasId]/page.tsx:104`; `w/[workspaceId]/page.tsx:37`; `types.ts` (`VersionedColumns.updated_by`) | Recommended: **leave "by {person}" out** in slice 13 (an idea for later, with the field's own author from change events). |
| F21 | **"Show all" is the long lists' text** ("Show all ({n})", `LongList`); the rich-text field folds with "Show more" / "Show less". | `fields.tsx` (`LongList`); `rich-text-field.tsx` | The folded other value uses **"Show more" / "Show less"**, CSS `line-clamp` (three lines), with no measuring: the button shows when the text has more than three lines or more than about 240 characters, counted from the text. |
| F22 | **`holdAnswer` holds for a fixed time** (2 s) and matches the request body. S13-01 needs to type while the answer is held and then release it. | `e2e/slice-10c/helpers.ts:103` | `e2e/slice-13/helpers.ts`: `holdAnswer` with a release function the test calls (`holdUntil`); the same route mechanism, test only, no switch in the app. |
| F23 | **The conflict message is one domain constant for every write** (`STALE_VERSION_MESSAGE`): panel fields, canvas drags and deletes, the canvas tab's rename (off the chain), the look. | `src/domain/errors.ts:12`; e2e: `S0-08`, `S0-09`, `slice-09/helpers.ts` (`STALE`, re-exported up to slice 12a) | With F3 for every write, "Reload to see the latest version" no longer applies anywhere, so the constant becomes **"Someone changed this meanwhile."** Unit tests import the constant; three e2e places change. Without F3 everywhere, the field saves would need their own text. Part of question 1. |
| F24 | **The panels' `onSave` returns nothing.** `onSave={(name) => void save({ name })}` throws the answer away, so a field cannot know whether it was refused, why, or that it was cut. | about 35 call sites in the panels, the project heading, the settings | Every field's `onSave` returns the save's promise (`ActionResult`: `ok`, `code`, `cut`). Mechanical, but in every panel; step 2's specs cover them. |
| F25 | **`RichTextField` measures in a layout effect** (`scrollHeight` against `clientHeight`, to show "Show more"). It sits beside the canvas, which CLAUDE.md's rule ("nothing above the canvas reads layout during a commit") covers. It has done so since slice 4a; slice 13 does not change it. | `rich-text-field.tsx` (`useLayoutEffect`) | Not changed. The conflict line reads no layout (F21). An idea: the same rule for this field. |
| F26 | **The domain refuses a stale version only where the command checks it.** Every panel field's action checks `expectedVersion`; the role select (`changeRoleAction`) sends none (last write wins), and the classification toggles and label links write link rows. | `people.tsx` (`RoleSelect`); `classifications.tsx` (`toggle`); `labels-field.tsx` | They stay out (no draft, no conflict). Listed in Q1. |
| F27 | **Escape (Q3) does nothing in the panels', the project home's and the settings' fields today.** It cancels in the tree's name field, the canvas tab's rename and the zoom; in a rich-text dialog it asks before discarding. The canvas's Escape skips text fields (`isTyping`). | `fields.tsx`; `left-panel.tsx` (`NameInput`); `ZoomControls.tsx` | Escape in a text field with a draft puts the stored value back and ends the draft. The focus stays, nothing is saved, and a second Escape does nothing. While a line shows, Escape is "Use this". Choice fields: nothing. |

### Q1. The inventory

The legend for "Today after a refusal":
- **K:** keeps the typed text. Not refreshed, so it stays until the next fresh page that changes this field's stored
  value, which remounts the field and loses the text.
- **B:** shows the stored value again.
- **L:** lost.
- "c" = cut (a cutting refusal before it): no toast of its own.

Unless a row says otherwise, validation keeps nothing cut (Q3 of slice 9), and stale, forbidden, archived and not found
cut the saves waiting behind (slice 9, 10a).

| Page / panel | Field | Component | Saves through | Key today | Today after a refusal (validation · stale/c · forbidden/archived · not found) | Slice 13 |
| --- | --- | --- | --- | --- | --- | --- |
| Entity (`entity-panel.tsx`) | name (`required`) | `TextField` | `saveRow` `updateEntityAction` | `fieldKey` | K · K · K, still editable · K, then Overview | in |
| | alias | `TextField` | same | `fieldKey` | K · K · K · K | in |
| | stereotype, concept | `<select>` uncontrolled | same | `fieldKey` | K (the refused choice) | in (F9) |
| | definition | `RichTextField` (dialog) | same | `fieldKey` by HTML | dialog open with the draft | in (F4) |
| Attribute (`attribute-panel.tsx`) | name (`required`), alias | `TextField` | `saveRow` `updateAttributeAction` | `fieldKey` | K | in |
| | type | `<select>` | `saveRows` (`saveFollowed`, copies held) | `fieldKey` | K | in (F9) |
| | length, precision, scale | `ParamField` (number) | `saveRows` | `fieldKey` | K | in |
| | custom type | `TextField` mono | `saveRows` | `fieldKey` | K | in |
| | five flags | `Flag` (controlled) | `saveRow`; Personal data `saveRows` | none | B | F9 |
| | definition | `RichTextField` | `saveRow` | `fieldKey` | dialog open | in (F4) |
| Mapping (`mapping-panel.tsx`) | kind | `Seg` + local `wantsRule` | `saveRow` (`write`) | none | B | F9 |
| | rule | own `<textarea>` (`onRuleBlur`) | `saveRow` | `fieldKey` | K | in |
| | status | `Seg` | `saveRow` `setMappingStatusAction` | none | B | F9 |
| | note | `TextArea` | `saveRow` | `fieldKey` | K | in |
| | the pending input's rule ("Save") | the rule field + button | `saveRow` `addMappingInputAction` | — | K (`pending` stays) | in (the rule field) |
| Relationship (`relationship-panel.tsx`) | label | `TextField` | `saveRow` | `fieldKey` | K | in |
| | the two ends | `Seg` | `saveRow` | none | B | F9 |
| Requirement (`requirement-panel.tsx`) | key, name, owner, ref | `TextField` | `saveRow` `updateRequirementAction` | `fieldKey` + `reset` | **B on every refusal, cut included** | in (R6) |
| | kind, parent | `<select>` | same | `fieldKey` + `reset` | B | in (F9) |
| | description | `RichTextField` | same | `fieldKey` + `reset` | **dialog closes: L** | in (F4) |
| | rule / check | `TextArea` code | same | `fieldKey` + `reset` | B | in |
| | severity, priority | `Seg` | same | none | B | F9 |
| | status | `Seg` | `saveRow` `setRequirementStatusAction` | none | B | F9 |
| Source table / column (`classifications.tsx`) | note | `TextArea` (`SourceNote`) | `saveRow` `setSourceNoteAction` | `fieldKey` | K | in |
| | classification toggles | buttons | link rows, no version | — | B | out (F26) |
| Classification list (`classifications.tsx`, `Row`) | name | own `<input>` + an error line under it | `saveRow` `renameClassificationAction` | `fieldKey` | K, with the message under the field **and** a toast | in |
| Working label (`label-panel.tsx`) | name (`required`) | `TextField` | `saveRow` `renameLabelAction` | **`id:version:reset`** | B (F11) | in |
| Concept (left panel tree) | rename | `NameInput` | `saveRow` `renameConceptAction` | — (closes first) | **L** (F13) | in |
| Frame (`frame-panel.tsx`) | name | `TextField` | canvas queue `ui.updateFrame` | `fieldKey` | K | key only (F12) |
| | kind | `Seg` | canvas queue | none | B | out (F12) |
| | concept, system | `<select>` | canvas queue | `fieldKey` | K | key only (F12) |
| Note (`note-panel.tsx`, `NoteLayer.tsx`) | text | `TextArea` / the note on the canvas | canvas queue `ui.updateNote`, optimistic | `fieldKey` | **B (rollback)** | out (F12, question 5) |
| | status, colour | `Seg`, buttons | same | none | B | out |
| Project home (`project-heading.tsx`) | name | own `<input>` | `saveRow` `updateProjectAction` | `fieldKey` | K (empty: back, D-59) | in |
| | description | own `<textarea>` | same | `fieldKey` | K | in |
| Workspace settings (`settings-form.tsx`) | name, client, description | own inputs | `saveRow` `updateWorkspaceSettingsAction` | **form keyed by `workspace.version`** | **B (`revert`)**; every save remounts the form (F10) | in (R6) |
| | language | `<select>` | same | same | B | in (F9) |
| | Data Vault, four-eyes | check boxes | same | same | B | F9 |
| Workspace home, lifecycle | archive, unarchive | button | `saveRow` | — | — | out (no field) |
| People (`people.tsx`) | role | `<select>` controlled | `run`, no version | — | B | out (F26; D-58) |
| | add person, organization password | forms | `run` | — | — | out (sign-in and password fields) |
| Canvas tab | rename | own input | `run` with the page's version | — | — | out (R5) |
| Canvas menu | look | menu | own queue (`look.tsx`) | — | — | out (R5) |
| Top bar | names check boxes (`NamesSwitch`) | check boxes | canvas queue (`enqueueGroup`) | — | — | out (canvas; not named by R5: add) |
| Top bar | zoom | `ZoomControls` | no row | — | — | out |
| Changes to resolve (`source-changes.tsx`) | the forms' selects, the actions | local state + buttons | `run` (versions back) | — | — | out (R5) |
| Import wizard, new source table, new project, new organization, toolbox, labels field, requirement links, overview check box | — | — | create or link rows, or view state | — | — | out (no stored row's field) |

Not named by the PRD: the mapping rule, the pending input's rule, the classification list's name, the working label's name,
the concept's rename in the tree, the attribute's custom type and parameters, the requirement's rule. All are in. The
names check boxes and the role select are out, and R5 should list them.

### Q2. The draft instead of `fieldKey`

- **Key:** `${id}:${field}`, stable for the object's life. The `fix/panel-field-focus` fix needs only that no field's key
  changes when another field's save answers, and that holds: the version key was the bug, and a value key is not needed.
  Both `panel-field-focus.spec.ts` cases stay as they are.
- **The value stays uncontrolled** (`defaultValue`): typing renders nothing, so no canvas commit (S13-12) and no panel
  render per key.
- **One hook in `fields.tsx`** (`useDraft(stored, save)`), used by `TextField`, `TextArea`, `ParamField` and the bespoke
  fields (the mapping rule, the classification name, the project heading, the settings, the tree's `NameInput`, the
  selects through the same key). In refs, no render:
  - `base`: the stored value when the draft started (focus or first input);
  - `sent`: the value on its way;
  - whether the element has a draft (its value differs from the stored one).

  In state, which renders only that field: the outcome of the last save (`saved`, `notSaved`, `conflict`) and whether the
  field is read-only with a draft.
- **Taking a stored value:** in an effect on `stored`. If the element neither has the focus nor a draft, it sets
  `el.value = stored`. This is a DOM write after the commit, not a layout read (AD-24). A focused field or a field with a
  draft keeps its text (items 3 and 4).
- **Leaving the field:**
  - while a line shows: nothing (F6);
  - otherwise it saves when the text differs from `sent` (while a save is on its way) or from `stored` (F8). The draft
    ends when the answer's stored value equals the element's text.
- **After a refusal** (F24's answer):
  - `invalid`: the draft stays;
  - `cut`, or `stale_version` with the stored value still equal to `base`: "Not saved" (F5);
  - `stale_version` with the stored value different from `base`: the line;
  - `forbidden` or `archived`: read-only, "Not saved" (F17);
  - `not_found`: the panel goes (F16).
- **Where the newest value comes from:** the page, refreshed by F3. The hook reads `stored` after the refusal's answer;
  the fresh page arrives in the same response.
- **What goes:** `fieldKey`, the requirement panel's `reset`, the label panel's version key and `reset`, the settings
  form's key, `version` state, `saved` ref and `revert`.

### Q3. Escape and leaving

- **Escape today:** see F27. Proposal there.
- **The panel's selection changes, or the panel closes:**
  - the mousedown blurs the field first, so its save starts (as today);
  - Back and Forward blur on a traversal (D-38, `history-nav.tsx`), as today;
  - a refusal that comes after the panel unmounted: F15.
- **Leaving the page:** a link click blurs first, as today. A refusal arriving on the next page is F15. The PRD's
  `beforeunload` stays in section 9.
- **Proposal, as the PRD:** a draft is saved when its field is left; nothing new on leaving the page. With F15 (b), a
  refused draft also comes back when its panel is opened again on the same page.

### Q4. The newest stored value and the fold

- **From the page:** F3's revalidation after a cutting refusal brings the page in the same response. The refusal itself
  carries no row, and the domain stays unchanged (item 13).
- **The alternative,** the refusal's answer carrying the row's newest field values, needs a change in every
  `nextVersion` refusal or one extra read in `runCommand`. It is not recommended.
- **The fold:** F21.

### Q5. The author

The canvas page and the workspace home know the people; the project home does not, and `updated_by` is the row's last
writer, not the field's (F20). Proposal: leave "by {person}" out.

### Q6. A deleted object

Today: the domain's toast "This {entity} does not exist."; the panel stays until the next fresh page, then the Overview
(F16). Keeping the draft costs F15 (b)'s store plus an Inspector branch (about 80 lines, two texts, one spec).
Proposal: as the PRD, the draft goes with the object (D-66's last bullet unchanged).

### Q7. Permission, archive, locked organization

Today a refused field stays editable until some later fresh page; only then the panels turn `readOnly` (text fields),
`disabled` (selects, `Seg`, `Flag`), the project home renders text and the settings fields `disabled`. With F3 the
fresh page comes at once. Keeping the draft readable needs:
- the stable key (the DOM keeps it);
- the project heading keeping its inputs while a draft exists;
- the settings using `readOnly` for a field with a draft;
- the "Not saved" mark;
- no fresh page after a locked organization's refusal (F17).

Small: part of step 4.

### Q8. The save chain

- `rowSaves` needs no change. `saveRow` already resolves with the action's `ActionResult`, whose `code` tells the kind,
  and with `CUT` (`code: "cut"`) for a cut save.
- The fields need that answer (F24) and the fresh page (F3).
- **"Keep mine" is `saveRow(row, …)` as it stands:** it sends `max(answered, shown)`, and after the fresh page `shown` is
  the newest version. It is an ordinary save, with its change event, its undo step (not in the settings, F10) and D-26's
  label.
- Typing while a save is on its way needs only the stable key and F8.
- **Unit tests:** the hook's rules as a pure module (`src/ui/field-draft.ts`: what a refusal turns into; when a stored
  value is taken; what leaving saves).

### Q9. Earlier tests and docs

**Specs whose expectations change:**

| Spec | Today | After |
| --- | --- | --- |
| `S0-08` (first case) | the refused name goes back to "Pricing"; the toast with "Reload…" | the field keeps "Pricing (old)" with the line "Changed meanwhile to: Pricing 2026"; the new toast (S13-06 replaces this part) |
| `S0-08` (second case) | an empty name goes back | unchanged if question 6 extends D-59 to the settings name; else the field keeps it empty |
| `S0-09:59-60` | an owner's stale Enter, the toast with "Reload…" | the new toast; that page has refreshed after the refusal, so it shows the newest values |
| `S3A-04:27-33` | a refused label name (taken) goes back to "CR-23" | the field keeps "jira-481" (a validation refusal) |
| `S4A-02:36-45` | a refused requirement key and name go back | the key keeps "req-101"; the empty name goes back if question 6 extends D-59 |
| `S9-03` (first case) | the toast `STALE`; the name keeps its text | the new toast. The name shows "Not saved", or the line, depending on question 3; the scale shows "Not saved" (cut) |
| `slice-09/helpers.ts` `STALE` (used by S9-03, S9-05, S10A-03 to S10A-06, S10C-09, S12A-02) | "… Reload to see the latest version." | "Someone changed this meanwhile." (F23) |
| `S10A-05` | a mapping line's conflict: the toast `STALE` | the new toast; the line's status as the fresh page shows it |

**Earlier specs to run unchanged, as step 2 touches what they test:**
- `e2e/fixes/panel-field-focus.spec.ts`;
- S9-01 to S9-06 and S9-09;
- S10A-01 to S10A-06;
- S10C-09;
- S11-01 (aliases), S12A-02 (undo on the project home);
- the panel specs of slices 1a, 1b, 2b, 3a, 4a and 7c (the PR 23 set);
- S0-08 and S0-09.

The specs that wait for `data-version` before the next edit (S7C-07, S11-01, `expectPanelVersion` in slice 4a) still
pass; the wait is no longer needed and stays.

**Docs:**
- CLAUDE.md "Saving in panels": `fieldKey`, the draft, the line, F3's fresh page after a refusal.
- `docs/known-limitations.md`:
  - "Typing into a field while its save is on its way" removed;
  - "Writes still off the save chain" with notes and frames (F12) and the names check boxes;
  - F15 if (a);
  - the false conflict of the change-to-resolve actions stays.
- `docs/ideas.md`: the two entries done; "by {person}" (F20); F25.
- `docs/decisions.md`: D-66 with F5, F6, F10, F14.

### Q10. Test hooks

- **Holding an answer:** `holdAnswer` (slice 10c) holds for a fixed time. S13-01 and S13-02 need a release the test
  calls (F22), a new helper in `e2e/slice-13/helpers.ts`, test only.
- **A second session's save first:** two browser contexts as in S9-03 (`newContext`, `signInAs`), or the domain as test
  data (`asLukasz`, `asPerson`), which writes the e2e data file without the page knowing. Both exist.
- **Archive and role:** `changeRoleAs` (slice 8) and an archive through the domain as test data
  (`archiveWorkspace`, as slice 7a's S7A-12 does in the browser).
- **A locked organization:** two sessions through the start page with passwords (`signInWithPassword`, slice 8).
- Nothing in the app needs a switch.

## Items, decisions and criteria checked

| Item / decision / criterion | Verdict |
| --- | --- |
| Item 1 (which fields) | Holds with the inventory (Q1): seven fields more than named; notes and frames per question 5 (F12); the names check boxes and the role select out. |
| Items 2–4 | Hold: the stable key, the adopt rule and F8 (Q2). |
| Item 5 | Escape is new in the panels (F27). |
| Items 6–8 | Hold with F3 (a fresh page after a refusal), F5 (per field) and F6 (no save while the line shows). |
| Item 9 | Validation holds. Stale holds with F5. Permission and archive hold with F17; a locked organization needs its own code. Not found: F16. |
| Item 10 (R4) | Question 4 (F9). |
| Item 11 (R6) | Holds; the settings form also loses its key (F10); the label panel joins too (F11). |
| Item 12 (R8) | The texts below. |
| Item 13 | "The canvas" unchanged in code, but with F3 it gets a fresh page after its own refusals (question 1); notes and frames (F12). |
| R3 | "An ordinary undo step" does not hold for the settings (F10). |
| R5 | Add the names check boxes, the role select, notes and frames (F12, F26). |
| R7 | Agreed: a small slice with two full runs. |
| D-66 (proposal) | Needs F5 (per field), F6, the settings' undo (F10), D-59's exception (F14) and the answers to questions 4, 5, 7 and 8. |
| A1 | Holds: `e66cc42`. |
| A2 | **Confirmed:** no data model change, no new local file format. |
| A3, A4 | Hold. |
| S13-01 | The entity has no description (F1): the entity's name, and a source table's note for a long text; a held answer with a release (F22). |
| S13-02 | Holds; the description saves on leaving (Enter adds a line, D-59). |
| S13-03 | The entity's name or a table's note (F1); a stale refusal where only another field changed gives "Not saved" (F5). |
| S13-04 | The requirement's description is a rich-text dialog: the line inside the dialog (F4). |
| S13-05 | The name and the alias (F1). |
| S13-06 | Holds; "Keep mine" is no undo step there (F10). |
| S13-07 | Holds for text fields; the choice fields per question 4. |
| S13-08 | Depends on question 4. Recommended field: the entity's stereotype or the attribute's type (a select). The mapping's kind needs a rule for "transform" (`chooseKind`). |
| S13-09 | Needs this page's fresh page after the other session's write (F18). |
| S13-10 | Holds with F17; the role through `changeRoleAs`. |
| S13-11 | Per question 8. |
| S13-12 | Typing 0 and "Use this" 0 commits; the conflict's fresh page as an own save's (F19). The element guard: the panels are outside the canvas's viewport, so the viewport counts are equal and the page totals are as slice 12b's while no line shows. |
| S13-13 | Holds. |

## Differences between the prototype and the app that the slice touches

- **No conflicts, drafts or refusals in the prototype** (PRD section 8): everything in items 6–11 is new.
- **The prototype's inspector fields have no Escape;** its in-place renames and notes cancel with Escape. F27 adds
  Escape to the panels' text fields.
- **The prototype's rich-text editor** has "Ctrl + Enter saves, Esc cancels" and the two-step Esc. The app has both, and
  F4 adds the line inside the dialog.
- **The settings form** saves each field on change in the prototype too; the app's revert on a refusal goes (R6).
- Nothing else in the slice changes what the prototype shows.

## New and changed user-visible texts (proposals, for approval)

| Where | Text | Note |
| --- | --- | --- |
| Under a field, on a conflict | "Changed meanwhile to: {value}" | {value} as the field shows values: a choice by its label, a rich text formatted |
| Under a field, the other value empty | "Cleared meanwhile." | the PRD has no text for an empty other value |
| The line's buttons | "Use this", "Keep mine" | as the PRD |
| A long other value | "Show more", "Show less" | instead of "Show all" (F21) |
| A cut save, a stale refusal of an unchanged field, permission, archive | "Not saved" | as the PRD |
| Read-only with a draft (permission, archive) | "Not saved. You can still copy it." | new; the PRD's "Not saved" alone does not say why the field is read-only |
| The conflict toast | "Someone changed this meanwhile." | the domain's `STALE_VERSION_MESSAGE` for every write (F23) |
| A refused draft whose field is gone (F15 b) | "Not saved: {field} of {object}. Open it again to see your text." | only with question 7 (b) |
| The rich-text dialog's line | the same texts as under a field | F4 |
| "by {person}" | left out | F20 |

## Questions for Łukasz

1. **A fresh page after every cutting refusal** (F3, F23)? It applies to every write in `runCommand`, the canvas's
   included (its code does not change), and the conflict toast loses "Reload to see the latest version" everywhere.
   Recommended: yes.
2. **Rich-text fields** (F4): the conflict line inside the editor dialog, "Use this" puts the stored text into the
   editor and leaves it open? Recommended: yes.
3. **A stale refusal of a field nobody else changed** (F5): "Not saved", saved again on Enter or on leaving (a), or sent
   once more by itself (b)? Recommended: (a).
4. **Choice fields** (F9): the line with "Use this" and "Keep mine" for selects, `Seg`, flags and check boxes (a), or
   the newest stored value with the toast (b)? Recommended: (b); then S13-08 checks that the newest choice shows and
   nothing is overwritten.
5. **Notes and frames** (F12): out of slice 13, with the frame panel's fields only on the stable key (a), or a note's
   text keeps its draft too (b)? Recommended: (a).
6. **Empty names** (F14): an empty required name goes back everywhere (D-59's rule also for the settings' and the
   requirement's name)? Recommended: yes.
7. **A refused draft whose field is gone** (F15): a toast only (a), or kept on the page and shown again when its panel
   opens (b)? Recommended: (b).
8. **A deleted object** (F16): the draft goes with it, as the PRD proposes? Recommended: yes.
9. **"by {person}"** (F20): left out? Recommended: yes.
10. **Escape** (F27): puts the stored value back in a text field with a draft and is "Use this" while a line shows?
    Recommended: yes.
11. **The texts** in the table above, in particular "Cleared meanwhile." and "Not saved. You can still copy it."
12. **Steps:** with these answers step 2 is the hook, the stable keys, F3, F8, F24, and the settings form and requirement
    panel without their resets. Step 3 is the line, "Keep mine", F5, F6 and F4. Step 4 is F17, F16 and F15. Agreed?

## Łukasz's answers to step 1 (1 November 2026)

1. **Yes:** the fresh page after every refusal that cuts (`runCommand`), and the toast "Someone changed this meanwhile.".
2. **Yes:** the conflict line inside the rich-text dialog.
3. **"Not saved"**, saved again by the person; no automatic retry.
4. **Choice fields:** after a refusal the newest stored value, with the toast (R4 changed in the PRD).
5. **Notes and frames are out of slice 13;** frames get only the stable key. A known limitation (a note's text rolls
   back after a refusal) and an entry in `docs/ideas.md` as a candidate for the next scope after 13.
6. **Yes:** an empty required name goes back to the stored name everywhere (D-59).
7. **Yes:** a draft of a closed panel's field stays in the page's memory (no `localStorage`), comes back when a panel of
   that object opens again, and is gone when the page is left. If that is more than a small change, stop and describe
   the cost; then a toast is enough.
8. **Yes:** the draft goes with a deleted object.
9. **Yes:** no "by {person}"; the idea with the field's last change event goes to `docs/ideas.md`.
10. **Yes:** Escape puts the stored value back; while a line shows it is "Use this".
11. **The texts** in the table are accepted, "Cleared meanwhile." and "Not saved. You can still copy it." included.
12. **Steps 2–4 as proposed;** a full e2e run (three parts) after the shared mechanism's step and at the closing.

**F1:** S13-01, S13-03 and S13-05 use fields that exist (proposed in the PRD). **F10:** the settings are not undo steps;
"Keep mine" there is an ordinary save without an undo step.

**Done with the answers:** the PRD is updated (status "step 1 answered", R1–R8, items 1, 5, 5a, 7–13, steps, S13-01 to
S13-14, section 9, D-66). `docs/ideas.md` has the three entries (notes and frames, "by {person}", F25's layout read) and
the plan's line; `docs/known-limitations.md` has "A note's text rolls back after a refused save". Item 5a is built in
step 4, which stops there if it is more than a small change.

## Ideas (not built)

Both are in `docs/ideas.md` since the answers: "by {person}" from the field's own last change event (F20), and
`RichTextField`'s "Show more" without a layout read (F25).

## Step 2: the shared mechanism (1 November 2026)

### What changed

- **The draft's rules** are `src/ui/field-draft.ts` (`FieldDraft`, `choiceShown`, `storedBy`), pure and unit-tested
  (`field-draft.test.ts`, 9 tests):
  - a stored value is taken only without the focus and without a draft;
  - a text equal to the stored value ends the draft;
  - leaving the field compares with the value on its way, else with the stored one (F8);
  - any refusal, a cut included, keeps the text and lets leaving the field save it again.
- **`useDraft`** (`src/app/_panels/fields.tsx`):
  - the element stays uncontrolled with its mount value as `defaultValue`, so typing renders nothing;
  - an effect writes a fresh stored value into the element when `FieldDraft.receive` says so: a DOM write, never a
    layout read;
  - `commit` on leaving the field trims or parses (`prepare`) and saves;
  - an empty `required` field goes back, with `onEmpty` (F14, D-59);
  - it returns `{ bind, defaultValue, commit }`. A returned `ref` made React Compiler's `react-hooks/refs` rule flag
    every use, so call sites destructure it.
- **`useChoice`** (R4, answer 4): a select or check box shows its choice from the click until the stored value changes;
  after a refusal it shows the stored value from the fresh page. It needs no effect, since the choice remembers the
  stored value it was made on.
- **`fieldKey(id, field)`**: stable keys everywhere, the third argument (the stored value) is gone.
  - Every text field's `onSave` returns its save's answer (F24): entity, attribute, mapping, relationship, requirement,
    source note, classification name, label name, project heading, settings.
  - `TextField`, `TextArea` and `ParamField` use `useDraft`. So do the bespoke fields: the mapping's rule, the
    classification list's name, the project's name and description, the settings' name, client and description.
  - `useChoice` serves the entity's stereotype and concept, the attribute's type, the requirement's kind and parent, the
    frame's concept and system, and the settings' language and two check boxes.
- **The fresh page after a cutting refusal** (F3, answer 1):
  - `runCommand` revalidates after `stale_version`, `forbidden`, `archived` and `not_found`, except a locked
    organization's refusal;
  - `STALE_VERSION_MESSAGE` is "Someone changed this meanwhile." (F23).
- **The resets go** (R6):
  - the requirement panel's `reset` counter: an empty name goes back with "Enter a name.";
  - the label panel's `id:version:reset` key;
  - the settings form's key on the workspace's version, its `version` state, `saved` ref and `revert`: the version
    comes from the page and `rowSaves`, and an empty name goes back with "Enter a name.".
- **The concept's rename in the tree** (F13) stays open until its answer; a refused name stays in the field to try again
  or cancel with Escape (`NameInput`'s `onDone` returns whether it was stored).
- **Smaller changes:**
  - `NAME_REQUIRED` ("Enter a name.") is exported from `src/domain/validation.ts`, with the same text as before;
  - the project description has `data-version`, so tests can wait for a save's fresh page.
- **Not changed:**
  - `rowSaves` (Q8);
  - notes (their text still rolls back, R5);
  - `Seg` and `Flag` (controlled already, so they show the stored value after a refusal, as R4 wants);
  - the rich-text fields beyond their stable key: their dialog keeps the draft, and a refusal no longer closes the
    requirement's.

### Specs

| ID | Spec | Result |
| --- | --- | --- |
| S13-01 | `S13-01.spec.ts`: (a) the entity's name, Enter, typed on while the answer is held (`holdUntil`), released: all the text, the focus and the caret at the end; Enter saves the rest; two change groups in order; one undo takes back the second; (b) a source table's note, left with Tab, typed on, released: the same, two versions | passed; **both cases fail on the code before step 2** (`git stash` of `src`) |
| S13-02 | `S13-02.spec.ts`: the project's description, left, typed on (a new line) while held, released: all the text, focus, caret; leaving saves the rest | passed; fails before step 2 (the code before has no `data-version` on the description, so the first check fails there) |
| S13-09 | `S13-09.spec.ts`: (1) an undo on the project home shows the stored name, and the description stays as stored; (2) Anna renames the project as another session; this page's description save is refused (the new toast), and its fresh page shows Anna's name in the name field (no draft, no focus) while the description keeps the draft; leaving it again stores it | passed |

**Earlier specs changed** (Q9):
- `S0-08`: the refused name is kept, and the switcher shows the stored name from the refusal's fresh page; the toast is
  the new text. The empty name still goes back, now in the browser with "Enter a name.".
- `S0-09` and `slice-09/helpers.ts` (`STALE`): the new toast text.
- `S3A-04`: a refused label name is kept.
- `S4A-02`: a refused requirement key is kept; the empty name goes back with "Enter a name.". The spec's title is
  adjusted.

**Runs:**
- Slice 13 with the changed specs and `panel-field-focus.spec.ts` (dev server, from scratch, none of mine running):
  13 passed, 1 failed, 2.6 min. The failure was S4A-02: my edit had changed the wrong `REQ-109` line. Fixed, and the
  file passed 3 of 3 alone (39 s, 39 s, 45 s).
- S13-01's note case first failed on its toast check alone. The recorder counts a repeated text once
  (`recordToasts`), so the two identical "Note saved on customers" toasts read as one; the check now expects one.
- CI: `npm run lint` clean, `npm run typecheck` pass, `npm test` 120 files, 1,564 tests, pass.

### New or changed user-visible texts

- The conflict toast is "Someone changed this meanwhile." (approved, answer 1).
- "Enter a name." now also shows in the browser when an empty settings or requirement name goes back (the server's text
  before).
- No other text yet: the line, "Not saved" and the rest are steps 3 and 4.
