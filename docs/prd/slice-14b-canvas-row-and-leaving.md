# Slice 14b – The canvas's own row on the save chain, the change-to-resolve actions, and leaving a page with a draft

Status: **proposal for step 1.** Branch `slice/14b-canvas-row-and-leaving`, from `main` at tag `slice-14a` (`797dd62`, assumption A1). PRD file: `docs/prd/slice-14b-canvas-row-and-leaving.md`; step 1 writes `docs/prd/slice-14b-acceptance.md`.

Test regime: a small slice (CLAUDE.md, "Testing"), with one full e2e run, in four parts, at the closing (O8). Step 1 checks this PRD against the code (CLAUDE.md, "How we work").

This PRD was written from the docs at slice 14a's state, without reading the code:
- `CLAUDE.md`, `docs/decisions.md` (D-12, D-28, D-66, AD-16);
- `docs/known-limitations.md`, `docs/ideas.md`;
- `slice-14a-acceptance.md`.

**Łukasz's guiding rule for this slice: consistent, clear, intuitive and simple.** Where an item could be done in a richer way, this PRD takes the plainer one and reuses what slices 13 and 14a built: their texts, their line, their marks.

## 1. Why this slice

Slices 13 and 14a made every field and note keep what a person typed (D-66). Four gaps are left (`docs/ideas.md`, "The plan after slice 13"; `docs/known-limitations.md`, "Writes still off the save chain"):

- **The canvas's row has three writers with three versions.**
  - The look (grid, background, layer) saves through its own queue (`look.tsx`).
  - The names switch saves through the canvas's queue and hands its version to the look's provider (`noteVersion`).
  - A canvas's rename in its tab and its delete from its menu send the version the page had (`canvas-tabs.tsx`, `canvas-menu.tsx`).

  So a rename right after a layer switch is refused as a conflict until the page refreshes, and a refused name has no draft.
- **The change-to-resolve actions** (`source-changes.tsx`) write rows only the server knows. A table's or column's note saved in a panel while such an action is on its way sends the version it knows and is refused. Since slice 13 the person sees "Not saved" and can save again, but nobody else changed anything, so the message is wrong.
- **Leaving a page loses drafts silently.** D-66 keeps drafts in the page's memory, so a reload or a closed tab drops them, with no warning.
- **The full e2e run's part 3 is near its limit:** a heap of 1,788 MB at slice 14a's closing, against 2 GB, where sign-in timeouts began (`docs/ideas.md`, "A fourth part for the full e2e run").

**Agreed with Łukasz on 3 November 2026 (O1–O8):**

- **O1. One newest version for the canvas's row.** Its writes go on the save chain (`rowSaves`) keyed on the canvas's row: the look, the names switch, the rename and the delete. Each hands its answer's version to the chain, so none is refused because of another.
- **O2. A conflict on a canvas's rename** keeps the typed name in the tab's field and shows slice 13's line in a small form under the tab ("Changed meanwhile to: …" with "Use this" and "Keep mine"; Escape is "Use this").
- **O3. The look after a refusal** shows the newest stored value with the toast, as choice fields do (D-66).
- **O4. The change-to-resolve actions hold the panel saves** of their source's tables, columns and mappings while they are on their way. Those saves are sent after the answer with the new versions. The browser cannot know which rows an action writes, but it knows the source, so the whole source is held.
- **O5. The page warns before it is left** (reload, closed tab, another site) when it has:
  - a refused draft (a conflict line or "Not saved");
  - a note's draft not yet saved;
  - a save on its way;
  - a focused field with typed text not yet sent.
- **O6. Only the browser's own warning** (`beforeunload`, its fixed text). Navigation inside the app (links, breadcrumbs, the project switcher, Back and Forward between the app's pages) gives no warning; it becomes a known limitation.
- **O7. The full e2e run in four parts,** as its first change (`PART_STARTS`), checked in the closing's run.
- **O8. A small slice:** one full run at the closing; no canvas measurement beyond the element check, as nothing new is drawn on the canvas.

## 2. Sources

**Decisions:**
- **D-12:** the canvas's look, per canvas and outside undo.
- **D-28:** canvases in projects; a project's last canvas cannot be deleted.
- **D-38:** a place that no longer exists.
- **D-64:** aliases and the names switch.
- **D-66:** a field's draft and a refused save, with notes and frames (slice 14a).
- **AD-12, AD-13:** versions, change events, undo steps.
- **AD-16:** the look as JSON on the canvas's row.

**Docs:**
- **CLAUDE.md:** "Saving in panels":
  - the chain, the cuts;
  - "Rows only the server knows";
  - slice 13's draft (`useDraft`, `field-draft.ts`) and slice 14a's queue answers (`save-cuts.ts`, `note-drafts.ts`);
  - the names switch (`setCanvasNamesAction`, `noteVersion`, `names.version`).
- **`docs/known-limitations.md`:** "Writes still off the save chain"; "A field's draft: what slice 13 does not cover".
- **`docs/ideas.md`:** "The plan after slice 13"; "A fourth part for the full e2e run"; "A field's draft: what comes later".

**Earlier slices' acceptance:**
- **Slice 13:** the line, "Not saved", Escape, F13 (a rename field that closed before its answer).
- **Slice 14a:** the canvas's queue with refusal codes, the cuts, the wait for the fresh page (`afterPage`, at most 3 s).
- **Slice 10a:** the save chain, held rows, `{ versions: true }`.
- **Slice 11:** the names switch.
- **The e2e reliability chore:** `e2e/parts.ts`, `scripts/e2e.ts`, `E2E_MEMORY_LOG`.

## 3. What to build

Texts in quotes come from slices 13 and 14a. This slice adds no new user-facing text, unless step 1 finds one is needed; then it is listed for approval.

### The e2e run (step 2, first)

1. **Four parts.** `PART_STARTS` gets one more cut, chosen from slice 14a's closing memory log so that each part ends at a similar heap. Step 1 proposes the cuts. `npm run e2e` runs all four; `--part 4` runs one.

### The canvas's row (step 2)

2. **One chain for the canvas's row (O1).** The look, the names switch, the rename and the delete save through `rowSaves` keyed on the canvas's row:
   - they wait for each other as any saves of one row do;
   - each sends the newest version the chain knows and hands its answer's version back;
   - a fresh page's version reaches the chain as for any row.

   The look stays outside undo (D-12); the names switch and the rename keep their undo steps as today. Step 1 says how the look's own queue and `noteVersion` fold into this (Q1).
3. **The delete from the canvas's menu** sends the chain's version. Its refusals (the project's last canvas, D-28; a shared canvas) are unchanged.

### A canvas's rename in its tab (step 3)

4. **The rename keeps its draft (O2).** The tab's field stays open until its answer and keeps the typed name after any refusal (slice 13's rule; as F13 did for a concept's rename):
   - **on a conflict:** a small line under the tab, "Changed meanwhile to: …" with "Use this" and "Keep mine". "Keep mine" saves the typed name on the newest version, as an ordinary undo step. Escape is "Use this"; while the line shows, leaving the field saves nothing;
   - **refused as stale while the name did not change meanwhile:** "Not saved"; leaving the field again saves it;
   - **permission or archive:** the field is read-only and the name stays selectable ("Not saved. You can still copy it.");
   - **locked:** the name stays editable with "Not saved";
   - **not found:** the canvas is gone, and the page goes where D-38 says;
   - **an empty name** goes back to the stored name (D-59's rule).
5. **The line's form.** The same component as slice 13's line, in a compact popover under the tab, not a new design. Nothing on the canvas changes, and no layout is read: the popover is placed by CSS under the tab.

### The look (step 3)

6. **After a refusal (O3)** the look's controls (grid, background, layer) show the newest stored value with the toast.

### The change-to-resolve actions (step 3)

7. **Holding the source's rows (O4).** While a change-to-resolve action is on its way, the panel saves of the tables, columns and mappings of that action's source wait. They are sent after the answer, with the versions the answer brings (`rowSaves.answer`). A person typing meanwhile notices nothing: the field keeps its draft (D-66) and saves when the hold ends. Saves of other sources and other objects are not held.

### Leaving a page with a draft (step 4)

8. **The warning (O5, O6).** While the page has any of the four kinds of unsaved text, it asks the browser to warn before it is left (`beforeunload`). The browser shows its own fixed text; the app adds none. Without any of them it asks nothing. The four kinds:
   - a refused draft (a conflict line or "Not saved") in a field, a note, a frame's name or a canvas's name;
   - a note's draft not yet saved;
   - a save on its way;
   - a focused field with typed text not yet sent.
9. **Navigation inside the app gives no warning** (O6): its drafts go as D-66 says. A known limitation.

### Unchanged

10. **Unchanged:**
    - the domain's commands and messages;
    - D-66's rules for fields, notes and frames;
    - the canvas's other writes (layout through the canvas's queue);
    - the role select (D-58, no version);
    - the data model and the local data file's format;
    - undo and redo;
    - the canvas's drawing.

## 4. Steps

Stop after each step with a short summary of what changed and how to check it. Wait for Łukasz before the next. A new Claude Code session may start at a step's boundary, never inside a step; it starts by reading CLAUDE.md, this PRD and `slice-14b-acceptance.md`.

1. **Critical review** (section 7). Check every item, decision and criterion against the code, `docs/decisions.md` and the earlier slices' acceptance docs. Answer Q1–Q8 in `docs/prd/slice-14b-acceptance.md`, with the e2e cuts proposed, any text the slice must add, and the earlier specs that change. No application code. Stop.
2. **The e2e parts and the canvas's row** (items 1–3): the fourth part (configuration only); the canvas's row on the chain. Unit tests, specs S14B-01 to S14B-03 and S14B-11, the earlier specs of the canvas's tabs, menu, look and names switch (Q7), and CI. Stop.
3. **The rename, the look and the change-to-resolve actions** (items 4–7). Specs S14B-04 to S14B-08, the earlier specs of source changes (Q7), and CI. Screenshots: a tab with the conflict line, with "Not saved", read-only; light and dark. Stop.
4. **Leaving a page** (items 8–9). Spec S14B-09 and CI. Stop.
5. **Closing:**
   - the docs (section 10);
   - S14B-12's element check;
   - one full e2e run in four parts (`E2E_MEMORY_LOG=1`), keeping a failing test's traces before rerunning it, with each part's time and heap peak;
   - CI and the pull request with both GitHub checks;
   - a backup of KB (`.data/backups/dev-db-<yyyymmdd-hhmm>.json` and `kb-model-latest.json`);
   - the manual acceptance scenario.

   Merge and tag `slice-14b` only on Łukasz's command.

## 5. Acceptance criteria

Tests in `e2e/slice-14b/`, one file per criterion, each from a fresh seed; unit tests next to the code. A save's answer is held back with the test-only hook of slices 13 and 14a, never a switch in the application.

| ID | Criterion |
| --- | --- |
| S14B-01 | **Rename after the look.** Switch the layer (and the grid), then at once rename the canvas in its tab: the name is stored, with no conflict and no "Not saved". |
| S14B-02 | **Rename after the names switch.** Switch the names to aliases, then at once rename the canvas: stored, no conflict. |
| S14B-03 | **Delete after the look.** In a project with two canvases, change a canvas's background and at once delete it from its menu: deleted, no refusal. The last canvas's refusal is unchanged. |
| S14B-04 | **A real conflict on a rename.** Two sessions rename one canvas; the second's is refused: its tab's field keeps the typed name with the line under the tab. "Keep mine" stores it (an undo step); in a repeat, "Use this" (and Escape) shows the first's name and stores nothing. |
| S14B-05 | **"Not saved" on a rename.** Another session changes only the canvas's look; a rename sent with the older version is refused as stale: the tab shows "Not saved", and leaving the field again stores it. (If item 2 makes this impossible within one session, step 1 says how the spec makes it happen.) |
| S14B-06 | **Read-only and locked.** A rename refused because the workspace was archived meanwhile keeps the typed name read-only and selectable; a `locked` refusal keeps it editable with "Not saved". |
| S14B-07 | **The look's refusal.** A grid switch refused (archived meanwhile) shows the stored grid with the toast. |
| S14B-08 | **The change-to-resolve actions.** With an action's answer held, type into a note of a column of the same source and leave the field: nothing is sent; after the answer the note is stored with no conflict and no "Not saved". A save of another source's column in the same time is not held. |
| S14B-09 | **Leaving a page.** The page asks for the browser's warning (a `beforeunload` dialog in Playwright) when it has:<br>• a focused field with typed text;<br>• a conflict line;<br>• a "Not saved" field;<br>• a note's draft;<br>• a save held on its way.<br>It asks nothing after the text is saved or dropped ("Use this", Escape), and nothing on a page without drafts. |
| S14B-10 | **Navigation inside the app.** A link inside the app with a draft gives no warning and does not break anything (the draft goes, D-66). |
| S14B-11 | **Four e2e parts.** `npm run e2e -- --part 4` runs one part; the full run prints four parts and one summary. |
| S14B-12 | **Nothing on the canvas changes.** `S3B-15-elements.spec.ts` against `.data/measure/s9-14-baseline/slice-08.json`: the viewport counts equal; the page totals as slice 14a's, or each difference explained. |
| S14B-13 | CI and the runs of the test regime; changed earlier tests listed with the reason. |

**Definition of done (scenario for the manual acceptance, on Łukasz's model KB, after the backup).**

1. On a canvas of "Kanton Basel", switch the layer and rename the canvas at once: it saves.
2. Rename the same canvas in two windows: the second shows the line under the tab; "Keep mine", then Undo.
3. Resolve a source change and type into a column's note of that source at once: it saves without a message.
4. Type into a field and press F5 before leaving it: the browser warns. Leave the field, wait for the save, press F5: no warning.

## 6. Performance

The slice draws nothing new on the canvas. The tab's line is a popover in the top bar, placed by CSS. Nothing reads layout during a commit (AD-24); S14B-12 checks the canvas page. The `beforeunload` listener is added and removed as the page's unsaved state changes, never re-rendering a field or the canvas for it (Q6).

## 7. Questions for step 1

**The rule (CLAUDE.md, "How we work"):** a PRD is a proposal to verify, not a specification; this one was written from the docs without reading the code. In step 1, check every item, decision and acceptance criterion against the code, `docs/decisions.md` and the earlier slices' acceptance docs. Write into `docs/prd/slice-14b-acceptance.md` where the PRD is wrong, contradicts the code or a decision, duplicates what the app already has, misses what the code needs, or costs more than it assumes (data model, undo, change events, performance), each with the files and functions behind it and a proposal. List the differences between the reference prototype and the app that the slice touches. No application code in step 1; Łukasz answers before step 2.

- **Q1. The canvas's row today.** Every write of it:
  - the look (`look.tsx`, its queue);
  - the names switch (`setCanvasNamesAction`, `noteVersion`, `names.version`);
  - the rename (`canvas-tabs.tsx`);
  - the delete (`canvas-menu.tsx`);
  - any other.

  For each: what version it sends, what it answers, and what it does after a refusal. The smallest change that puts them all on one chain for the row, and what becomes of the look's own queue.
- **Q2. The tab's rename field.** How it opens, saves and closes today; whether it closes before its answer (as F13 found for a concept); where slice 13's line can show as a popover under a tab.
- **Q3. Undo.** Which of these writes are undo steps today (the rename, the names switch; the look is not, D-12), and that the chain changes none of them.
- **Q4. The change-to-resolve actions.** What each sends and answers (`versions`); how the panel saves of that source's tables, columns and mappings can be held while it is on its way, and released with the answer's versions; what the browser knows of the action's source.
- **Q5. Unsaved state.** Where the page can learn, without re-rendering fields:
  - that it has a refused draft (`field-drafts.ts`, `note-drafts.ts`, the line's state);
  - a note's draft;
  - a save on its way (`rowSaves`, the canvas's queue);
  - a focused field with typed text not yet sent.
- **Q6. `beforeunload`.** Where the listener goes (both home pages and the canvas page), and how it is added and removed without a render. Whether Next.js's own navigations fire it (they should not, O6).
- **Q7. Earlier tests and docs.** Specs of the tabs, the menu, the look, the names switch and source changes that change; the docs to update; the e2e cuts for four parts, proposed from slice 14a's closing memory log.
- **Q8. The data model.** Confirm or refute: no change, and no new format of the local data file.

## 8. Differences from the prototype (deliberate)

- **The prototype has no save conflicts** and no warning on leaving. The tab's line and the warning are new, in the forms slices 13 and 14a set.

## 9. Left for later

- **A warning on navigation inside the app** (O6's alternative).
- **Drafts kept across a reload** in the browser's storage (`docs/ideas.md`).
- **A field-level merge** of two texts.

## 10. Decisions to accept, and docs in this PR

### D-66 (addition, proposal)

"The canvas's own row follows the same rule (slice 14b):
- its look, the names switch, a rename in its tab and its delete save on one chain with one newest version, so none is refused because of another;
- a refused rename keeps the typed name in the tab, with the conflict line under it;
- the look after a refusal shows the newest stored value.

While a change-to-resolve action is on its way, the panel saves of its source's tables, columns and mappings wait for its answer. A page with unsaved text (a refused draft, a note's draft, a save on its way, a focused field with typed text) asks the browser to warn before it is left; navigation inside the app does not warn."

### Assumptions to confirm

- **A1.** The slice starts from `main` at tag `slice-14a` (`797dd62`).
- **A2.** No data model change and no new format of the local data file (Q8).
- **A3.** Łukasz's KB model is backed up before the manual acceptance; it is not reset or seeded.
- **A4.** The seed is not changed.

### Docs in this PR

- **`docs/decisions.md`** (only with Łukasz's approval): D-66's addition.
- **`docs/known-limitations.md`:**
  - "Writes still off the save chain" reduced to what stays: the role select (D-58);
  - the names check boxes, if step 1 finds they stay off;
  - a new entry: navigation inside the app gives no warning (O6).
- **`docs/ideas.md`:**
  - the plan: 14b done, next the InfoCube concept document;
  - "A fourth part for the full e2e run" done, with the closing's heaps;
  - "A warning when leaving a page" done (the `beforeunload` part).
- **`docs/inventory-prototype-vs-app.md`:** section 8.
- **README and CLAUDE.md:**
  - the slice's status;
  - the canvas's row on the chain;
  - the source hold;
  - the warning;
  - four e2e parts;
  - the new e2e helpers.
