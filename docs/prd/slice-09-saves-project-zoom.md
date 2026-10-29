# Slice 9 – Saving in panels, the project's name, typing the zoom

Status: **step 1 answered** (29 October 2026; Łukasz's answers in `docs/prd/slice-09-acceptance.md`), first draft 28 October 2026. Branch `slice/09-saves-project-zoom`, from `main` at tag `slice-08` with `fix/panel-field-focus` merged (assumption A1). PRD file: `docs/prd/slice-09-saves-project-zoom.md`. Test regime: a small slice (CLAUDE.md, "Testing"), plus one full e2e run after step 2, because it changes how every panel saves (P2). Step 1 checks this PRD against the code (CLAUDE.md, "How we work").

## 1. Why this slice

Slice 9 takes the three quick notes from slice 8's manual acceptance (`docs/ideas.md`, "Notes from slice 8's manual acceptance", "Quick"), so that building a model by hand (Łukasz's test model KB, "Kanton Basel") runs without false conflicts:

- **A second save in a panel within about a second is no longer refused as a conflict.** Since `fix/panel-field-focus` the panels' fields keep the focus (`fieldKey`, `src/app/_panels/fields.tsx`), so a person can leave one field and save the next before the page shows the first save's new version (about 0.9 s on the e2e dev server). The second save then carries the old version and gets "Someone changed this meanwhile. Reload to see the latest version." although nobody else changed anything.
- **A project's name and description are edited on its home**, as in the prototype (`renderHome`, `data-pf`). Today a project is named only when it is created (`docs/inventory-prototype-vs-app.md`, "Projects and workspace").
- **The zoom can be typed** next to − and +. Not in the prototype: a decision (D-60).

The slice changes no data model and no local data file format: Łukasz's `.data/dev-db.json` stays as it is.

**Decisions agreed with Łukasz on 28 October 2026:**

- **P1. Scope.** The three items above, as a small slice. The larger ideas (thumbnails, copying an attribute, aliases, a relationship from an entity to itself, source relationships on the canvas) wait; a slice "Relationships" is proposed next (section 9).

**Proposed, to confirm in step 1:**

- **P2. Tests.** The small-slice regime, plus one full e2e run after step 2: item 1 changes the save path of every panel, and many earlier specs save in panels (`expectPanelVersion`).
- **P3. Item 1 is a fix, not a decision.** It changes neither the prototype's behaviour (the prototype has no versions) nor the data model. A real conflict stays refused exactly as today (S0-08).

## 2. Sources

**Prototype** (`docs/prototype/infomapper-prototype-with-sources.html`):

| Function or place | What it gives this slice |
| --- | --- |
| `renderHome` | the project home's name field (`.ph-name`, `data-pf="name"`, aria label "Project name") and description field (`.ph-desc`, `data-pf="desc"`, placeholder "What is this project about?", aria label "Project description") above the stats |
| the home's `change` handler | saves on change; an empty name is not saved and the field is drawn again with the stored name (no toast); the value is trimmed |
| the home's `keydown` handler | Enter in the name leaves the field (and saves) |
| the home's `input` handler and the end of `renderHome` | the description grows with its text (`scrollHeight`; the app must not read layout in a render, item 12) |
| `#zoomv`, `zoomBy`, the wheel handler | the zoom shown as "{n}%" between − and +; − and + zoom by 1.2 around the viewport's centre; the range is 10–300 % (`clamp(…, 0.1, 3)`) |

**Decisions:** D-12 and D-22 (canvas look and view state outside undo), D-29 (no undo outside canvases), D-38 (history places), D-54 (side panels), AD-05 (roles), AD-09 (archive), AD-12 (versions), AD-13 (change events), AD-23 (writes), AD-24 (canvas rules).

**Data model:** `docs/data-model-v2.md`, section 9 (`project.name`, `project.description`, standard columns with `version`).

**Earlier slices:** slice 0 (S0-04 projects and canvases, S0-06 a reviewer's rights, S0-07 archive, S0-08 "Someone changed this meanwhile"); slice 3b (`mergeFresh`, `src/canvas/fresh.ts`: the versions the canvas sends only grow); slice 4a and 7c (`data-version` on the requirement panel and the note field, `expectPanelVersion`); slice 5a (`ZoomControls` subscribes to React Flow's store; the canvas's size comes from React Flow's `ResizeObserver`); slice 6a (the top bar's breakpoints: the zoom group is never in "More"; "nothing above the canvas reads layout during a commit"); slice 6b (Alt+←/→ outside text fields); slice 7c's known limitation "Escape in dialogs" (the canvas listens for Escape and one-letter shortcuts on the whole window); `fix/panel-field-focus` (`fieldKey`, `e2e/fixes/panel-field-focus.spec.ts`); `docs/ideas.md` ("Notes from slice 8's manual acceptance").

## 3. What to build

Texts in quotes are proposals; step 1 may adjust them, and the step that builds them lists every new user-facing text for approval.

### Saving in panels (P3)

1. **A save sends the newest version the page knows** of its object: the larger of the version the last answered save of that object returned and the version in the latest fresh page (versions only grow, as `mergeFresh` does for cards, frames and notes since slice 3b). Step 1 checks this against undo and redo (Q2).
2. **Saves to one object from one page go one after another.** A save started while an earlier save of the same object is still on its way waits for that answer and then sends the version it returned. Saves to different objects do not wait for each other. The version and the patch are read when the save is sent, not when it is started; the order is kept by the app's own chain per object, not only by Next.js's queue of actions (F2). Every save action of the panels returns the row's new version in one shape, `{ version, … }` (F3).
2a. **A save sends only what changed** (F1): the attribute's type command takes only the changed parameters (absent: keep the stored one, `null`: clear it, a value: set it); changing the data type clears the parameters the new type does not have, as today.
2b. **Undo and Redo wait for the panels' saves on their way** (F5); Ctrl+Z in a text field stays the field's own undo.
3. **A refused save stops the queue of its object** when it is refused for a stale version, a permission or the archive: the saves of that object waiting behind it are not sent, and one toast shows the refusal's message. A validation refusal stops nothing: the saves behind it are sent (Q3). Each field behaves on a refusal as it does today (F6: no change in this slice).
4. **A real conflict stays refused** as today: another session or another browser tab that saved meanwhile makes the save fail with "Someone changed this meanwhile. Reload to see the latest version." and each field behaves as it does today (S0-08 unchanged; F6). Keeping the typed value on a conflict, and the same behaviour on a refusal in every field, are ideas (section 9).
5. **Where:** every field on a page that saves with an object's version: the panels the fix named (attribute, entity, mapping, requirement, frame, note, relationship, classification), and any other found in step 1 (source system, table and column panels, the workspace settings, the project home's new fields). Step 1 lists them (Q1). Where the code allows, the rule lives in one place used by all fields, not once per panel.
6. **Test waits stay valid:** the panels' `data-version` keeps meaning the version the panel shows. Earlier specs that wait with `expectPanelVersion` keep working; new specs check that a quick second save succeeds without waiting.

### The project's name and description (D-59)

7. **The project home** shows the project's name as an editable heading and its description as a plain-text field below it, as the prototype (aria labels "Project name" and "Project description", placeholder "What is this project about?"). Test ids `field-project-name` and `field-project-description` (proposal; named after what they edit).
8. **Saving:** the name on Enter or on leaving the field; the description on leaving the field (Enter in the description adds a line, as the prototype's text area). Values are trimmed. Escape returns the field to the stored value and leaves it, if the panels' fields do so today (Q5); otherwise as the panels do.
9. **An empty name** is not saved (D-59, option (i) or (ii)). An empty description is saved as empty (null).
10. **Lengths and duplicates:** as when a project is created (`createProject`, `nameSchema`): no length rule, and two projects may have the same name (F9).
11. **The command** follows `renameCanvas` (`docs/ideas.md`): a domain command that checks the role and the archive, validates with Zod at the boundary, checks `version`, and writes the project row and its change event in one change group (AD-12, AD-13, AD-23). The save follows items 1–3, so saving the name and at once the description is not refused.
12. **Where the name shows:** the breadcrumbs, the project switcher, the workspace home's list of projects and any other place found in step 1 (Q5) show the new name after the save; other open pages show it on their next load. Nothing on the project home reads layout in a render or a layout effect: the description grows with its text through CSS or in its own input event (the project home has no canvas, but the rule from CLAUDE.md is kept for every bar and field the slice adds).
13. **Roles and archive:** owners, admins and modelers edit; reviewers and readers see the name and the description as text, not as fields; an archived workspace shows them as text and the server refuses the write (proposal: the same roles as renaming a canvas, S0-06; Q5).
14. **Undo:** per D-59 (iii) or (iv).
15. **History (D-38):** renaming adds no place; the project home stays one place.

### Typing the zoom (D-60)

16. **The zoom value between − and + becomes a field.** It shows the current zoom as today (e.g. "100%"), keeps the zoom group's width (128 px in slice 6a's measurements), so the top bar's breakpoints and the "More" menu do not change. Test id `value-zoom`, kept from the text it replaces (Q8; earlier specs read it with `toHaveValue`). Every role and an archived workspace may use it (view state).
17. **Editing:** a click or Tab into the field selects its text. The field takes a whole number with an optional "%" and spaces; a decimal is rounded. Enter applies; Escape goes back to the current zoom and leaves the field; leaving the field otherwise is D-60 (vi). A value outside the range is D-60 (vii). A value that is not a number goes back to the current zoom without a toast.
18. **Applying:** zoom around the centre of the canvas's view, as − and + do, in one `setViewport`; the canvas's size comes from React Flow's store (its own `ResizeObserver`), never from `getBoundingClientRect` or a similar read. The range is the canvas's (the prototype's 10–300 %; step 1 states the app's, Q7). Below 40 % the cards draw their plain blocks as after any zoom (AD-24 rule 1).
19. **The field follows the zoom:** after the wheel, a pinch, − and +, Fit, opening a canvas and going Back to a place, the field shows the new zoom; while the person is typing in it, it does not overwrite their text.
20. **Keys in the field act on the field only:** the canvas's one-letter shortcuts (F, M, E, H, A, N, V), Escape (which today also clears the canvas selection), Ctrl+Z and Alt+←/→ do nothing on the canvas while the field has the focus; the selection and the details panel stay (Q7).
21. **The remembered view** is saved after a typed zoom as after any zoom (`infomapper:view:<canvas id>`, `{ x, y, zoom, left }`). Typing the zoom is view state, never an undo step (D-22).
22. **Nothing above the canvas reads layout during a commit** (CLAUDE.md, slice 6a): the field reads no size in a render or a layout effect; its width is fixed in CSS; typing re-renders only the zoom controls, never `ModelCanvas` (AD-24). The field is not on the canvas: no element is added to cards or the canvas's viewport, and no drawing layer (the element guard and the layer reads stay as they are, item 26's criteria).

## 4. Steps

Stop after each step with a short summary of what changed and how to check it; wait for Łukasz before the next.

1. **Critical review** (section 7): check every item, decision and criterion against the code, `docs/decisions.md` and the earlier slices' acceptance docs; answer Q1–Q9 in `docs/prd/slice-09-acceptance.md`. No application code. Stop.
2. **Saving in panels** (items 1–6): the rule, its unit tests, specs S9-01 to S9-05, the earlier specs of the panels touched, CI, and one full e2e run (P2). Stop.
3. **The project's name and description** (items 7–15): the domain command and its tests, the server action, the home's fields. Specs S9-06 to S9-10, slice 0's specs (S0-04, S0-06, S0-07, S0-11), CI. D-59's text quoted for approval. Stop.
4. **Typing the zoom** (items 16–22): the field in the zoom controls. Specs S9-11 to S9-14, the touched earlier specs (slice 5a's and 6a's top bar and zoom specs), the element guard, CI. D-60's text quoted for approval. Stop.
5. **Closing:** docs (section 10), one full e2e run, Łukasz's manual acceptance. Merge only on his command; tag `slice-09`.

## 5. Acceptance criteria

Tests in `e2e/slice-09/`, one file per criterion, each from a fresh seed; unit tests next to the domain code.

| ID | Criterion |
| --- | --- |
| S9-01 | The case found in slice 8: in an attribute's panel, type Precision, Tab, type Scale, Enter at once (without waiting for the page): both values are stored, no toast, two change groups. |
| S9-02 | Three saves to one object in a row, each before the page shows the previous one's version: all stored in order; the last typed value is the stored one; one change group each. |
| S9-03 | A real conflict: two sessions on one attribute; the first saves; the second's save (quick or not) is refused with "Someone changed this meanwhile. Reload to see the latest version.", its field behaves as today (F6), nothing is overwritten, and the saves of that object waiting behind it are not sent (item 3); after a validation refusal they are sent. S0-08 passes unchanged. |
| S9-04 | Every field listed in step 1 (Q1): a second save of the same object right after the first is stored without a toast (one spec, one case per panel or field kind). |
| S9-05 | Save, undo, save again in one panel without waiting: the second save is stored. Undo and Redo pressed while a panel save is on its way wait for it, so they undo and redo that save (item 2b); Ctrl+Z in a text field changes only the field's text. |
| S9-06 | The project's name: edit, Enter: the breadcrumbs, the switcher and the workspace home show the new name; one change event in one change group; the empty name per D-59; length and duplicate rules per item 10. |
| S9-07 | The description: several lines, saved on leaving the field, shown after a reload; emptied, it is stored empty. |
| S9-08 | Roles and archive: reviewers and readers see text, not fields; the server refuses a direct call from a reviewer; an archived workspace shows text and refuses the write. |
| S9-09 | Undo per D-59: (iii) a renaming is undone from a canvas of the project; or (iv) it is in no undo history. |
| S9-10 | The name, then at once the description: both stored, no toast (items 1–3 on the project home). |
| S9-11 | The zoom field: "95" and Enter gives 95 %, the point at the view's centre stays there; "95%" and " 95 % " work too; a value above or below the range per D-60 (vii); "abc" goes back without a toast; Escape goes back; leaving the field per D-60 (vi); the field follows the wheel, − and +, Fit and Back. |
| S9-12 | Keys in the zoom field: E, F, H, Escape, Ctrl+Z and Alt+← typed there change nothing on the canvas; the selection and the details panel stay; after leaving the field the shortcuts work again. |
| S9-13 | The remembered view: after a typed zoom and a reload, the canvas opens at that zoom; a typed zoom is no undo step (Ctrl+Z after it undoes the model change before it). |
| S9-14 | Performance (section 6): typing in the field adds no canvas commit (`window.__imCanvasCommits`); applying adds the same commits as − or + to the same zoom; the element guard's viewport counts equal against `slice-08`; the top bar fits from 800 to 2,560 px as in S6A-10. |
| S9-15 | CI and the runs of the test regime (P2); changed earlier tests listed with the reason. |

**Definition of done (scenario for the manual acceptance, on Łukasz's model KB).** Back up `.data/dev-db.json` first (CLAUDE.md). In "Kanton Basel", open an attribute with a decimal type: type a precision, Tab, a scale, Enter, at your usual speed: no toast, both values stored. Do the same in an entity panel (name, Tab, definition) and a mapping's note. Open the same attribute in a second window, save there, then save in the first: the conflict toast, as before. Open a project home: rename the project, write a two-line description, reload; check the breadcrumbs and the switcher. Empty the name and leave the field (D-59). On a canvas, type 95 in the zoom field and Enter; type 5, then 500 (D-60); press E and Escape inside the field: nothing happens on the canvas. Reload: the canvas opens at the zoom you typed.

## 6. Performance

The slice touches the canvas only through the zoom field, which is above it. Bars are proposals to confirm in step 1.

| What | How | Bar |
| --- | --- | --- |
| Typing in the zoom field | `window.__imCanvasCommits` while typing three digits | 0 commits |
| Applying a typed zoom | commits for Enter against − or + to the same zoom, same canvas | equal |
| Viewport elements on a canvas page | `S3B-15-elements.spec.ts` with `ELEMENTS_BASELINE` from `slice-08` | viewport counts equal; a page total that differs is explained (as slice 8's +1 script) |
| A queued save | the second save's answer time on the e2e dev server, median of 5 | reported, no bar (it waits for the first answer only) |
| The project home's load | as slice 7b's home load measure, against `slice-08` | equal within the run-to-run spread |

**Nothing above the canvas reads layout during a commit** (CLAUDE.md): the zoom field (items 16–22) takes no size in a render or a layout effect; its width is fixed in CSS and the view's size comes from React Flow's store. The project home's fields (item 12) follow the same rule, although that page has no canvas. **No new element on the canvas:** nothing in this slice is drawn on cards or in the canvas's viewport, so it adds nothing to the element guard and no drawing layer (AD-24); S9-14 checks it. If a change in a few milliseconds has to be judged, compare phase traces, not medians (slice 6a).

## 7. Questions for step 1

**The rule (CLAUDE.md, "How we work"):** a PRD is a proposal to verify, not a specification; this one was written from the prototype and the docs without reading the code. In step 1, check every item, decision and acceptance criterion against the code, `docs/decisions.md` and the earlier slices' acceptance docs, and write into `docs/prd/slice-09-acceptance.md` where the PRD is wrong, contradicts the code or a decision, duplicates what the app already has, misses what the code needs, or costs more than it assumes (data model, undo, change events, performance), each with the files and functions behind it and a proposal. List the differences between the reference prototype and the app that the slice touches. No application code in step 1; Łukasz answers before step 2.

- **Q1. Where saves get their version.** Every field in the app that saves with an object's version (panels, settings, home pages); how the version reaches the field today (`fieldKey`, `data-version`, the fresh page) and what each server action returns; whether items 1–3 can live in one place (e.g. beside `fieldKey` in `src/app/_panels/fields.tsx`) or need a change per panel; whether any field saves several columns of one object at once (e.g. a type's length, precision and scale) or several objects in one action.
- **Q2. Undo, redo and versions.** Does an undo or a redo write a new, higher version, or restore the version of the image? If the latter, item 1's "the larger of" would send a version that is too high after an undo; propose the rule (e.g. the fresh page wins when it is newer than the last save's answer).
- **Q3. A refused save in a queue.** Item 3's proposal against what the fields do today on a refusal (which value they go back to, which toast); whether a validation refusal of the first save should stop a queued save of a different field of the same object.
- **Q4. The fresh page and the panels.** How a panel takes the fresh page today (does it use `mergeFresh` or its own rule); whether a late fresh page can still show an older value in a field after item 1 (known limitation "A late fresh page could show an older state").
- **Q5. Projects today.** The command that creates a project and its rules (empty, length, duplicates, who may); the canvas renaming command and its permission (S0-06) as the model for item 11; every place a project's name is shown (breadcrumbs, switcher, workspace home, document title, toasts such as the history's `GONE`); how the panels' fields treat Escape.
- **Q6. Undo on the home pages.** How a canvas created on a project home enters the undo history today; what D-59 (iii) costs, and what (iv) needs (a change group that is not an undo step, as a pin, D-29).
- **Q7. The zoom controls today.** `ZoomControls`: what it shows and subscribes to, how − and + zoom (factor, centre), the canvas's minimum and maximum zoom, the value's format; how the canvas decides that a key was typed in a text field (shortcuts, Escape, Ctrl+Z, Alt+←/→ in `history-nav.tsx`) and whether an `<input>` in the top bar is covered.
- **Q8. The element guard and the top bar.** Whether replacing the zoom value with an input changes the guard's viewport counts or page totals; the zoom group's width at each of slice 6a's breakpoints.
- **Q9. Earlier tests and docs.** Specs that change (S0-08, S0-04, S0-06, slice 6a's top bar specs, specs that read the zoom value); the known limitations this slice touches ("No undo outside canvases", "A late fresh page could show an older state"); the README's and the inventory's status lines.

## 8. Differences from the prototype (deliberate)

- The zoom value is a field you can type into; in the prototype it is text (D-60).
- The project's name and description follow the app's roles, archive, versions and change log, and the undo rule of D-59; the prototype has one permission check and its own undo.
- The description grows with its text without a layout read during a render; the prototype reads `scrollHeight` while drawing the home.
- Saves carry versions and wait for each other per object (items 1–3); the prototype has no versions.

## 9. Left for later

- **Ideas (`docs/ideas.md`):** keeping the typed value on a stale-version conflict (slice 0); undo and redo on the project and workspace home pages; deleting a project (inventory, "Projects and workspace").
- **Writes started from the canvas on a panel's row** (step 2, Łukasz's question): the mapping and relationship line menus (status, split, swap, delete) and the attribute row's delete in `src/app/_panels/canvas-host.tsx`, moving an attribute (`src/app/_panels/move-attribute.ts`, `useMoveAttribute`; `reorderAttribute` renumbers the siblings too), a column dropped on a mapping (`src/app/_panels/map-column.tsx`, `addMappingInputAction`) and the frame panel's `moveToFrameConcept` (`src/app/_panels/frame-panel.tsx`) run through `run` with the rendered version, not through `saveRow`. A quick panel save and one of these, in either order, can still be refused as a false conflict until the page refreshes. They do not read `Saved<T>`, and `mergeFresh` covers only cards, frames and notes. Not fixed in this slice; see `docs/known-limitations.md`, "Writes started from the canvas are not on a row's save chain".
- **Proposed next, slice 10 "Relationships"** (one measurement sitting for the line layer, AD-24 rule 3): a relationship from an entity to itself, copying an attribute as a foreign key tied to a relationship, relationships between source tables as lines on the canvas.
- **Later still:** an alias for entities and attributes (a data model change); thumbnails on the project home's canvas tiles (measure the home's load first).
- **Łukasz's test model KB (A2):** it stays in his local `.data/dev-db.json` only, never committed and never a fixture in the repository (CLAUDE.md, "Łukasz's test model"); manual acceptance sessions run on it.

## 10. Decisions to accept, and docs in this PR

### D-59 (proposal) Editing a project's name and description

"A project's name and description are edited on its home, by owners, admins and modelers, in a workspace that is not archived; reviewers and readers see them as text. The name saves on Enter or on leaving the field, the description on leaving it; both are trimmed, and the description is plain text. {Empty name.} {Undo.}"

- **Empty name**, choose one:
  - **(i)** the field goes back to the stored name without a toast (the prototype);
  - **(ii)** the field goes back and a toast says "A project needs a name." (recommended: the person sees why nothing was saved). **Chosen by Łukasz, 29 October 2026.**
- **Undo**, choose one:
  - **(iii)** one undo step, in the undo history like a canvas created on the home, undone from a canvas (recommended: the pattern of `renameCanvas`, `docs/ideas.md`; the known limitation "No undo outside canvases" names it); **chosen by Łukasz, 29 October 2026**;
  - **(iv)** a change group that is not an undo step, as a pin (D-29).

### D-60 (proposal) Typing the zoom

"The zoom value between − and + is a field. A whole number, with or without %, applies on Enter around the view's centre, as − and + do; Escape goes back. {Leaving the field.} {Out of range.} The field follows every zoom except while someone types in it; keys typed in it do not reach the canvas. Typing the zoom is view state, outside undo (D-22)."

- **Leaving the field** (a click elsewhere, Tab), choose one:
  - **(v)** applies, as Enter (recommended: Tab to apply is common in zoom fields); **chosen by Łukasz, 29 October 2026**;
  - **(vi)** goes back, only Enter applies.
- **Out of range**, choose one:
  - **(vii)** applies the nearest limit and shows it (recommended: "500" gives the maximum at once); **chosen by Łukasz, 29 October 2026**;
  - **(viii)** goes back with a toast "Type a zoom from {min} to {max} %.".

(S9-11's "per D-60 (vi)" and "(vii)" read as the chosen option.)

### Assumptions to confirm

- **A1.** The slice starts from `main` after `fix/panel-field-focus` is merged; item 1 builds on `fieldKey`.
- **A2.** Łukasz's test model KB stays local: no fixture, nothing of it committed. This slice changes no local data file format, so his file needs no upgrade; a backup before the manual acceptance as CLAUDE.md says.
- **A3.** No data model change and no new local data file format; if step 1 finds that item 10 needs a rule the model does not state (e.g. a length), it goes to `docs/data-model-v2.md` section 11, not to a migration.

### Docs in this PR

- **`docs/decisions.md`** (only with Łukasz's approval of the quoted texts, steps 3 and 4): D-59 and D-60.
- **`docs/data-model-v2.md`:** no change expected (A3); section 11 only if step 1 finds a project name rule to state.
- **`docs/inventory-prototype-vs-app.md`:** "A project's name and description on its home" done.
- **`docs/known-limitations.md`:** "No undo outside canvases" if D-59 (iii); "A late fresh page could show an older state" if Q4 changes what is left.
- **`docs/ideas.md`:** the three quick notes marked done; section 9's slice 10 proposal.
- **README and CLAUDE.md:** the slice's status; in CLAUDE.md a short note on how fields save (the newest known version, one save per object at a time) and the new e2e helpers.
