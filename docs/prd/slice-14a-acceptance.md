# Slice 14a – acceptance

- Branch: `slice/14a-notes-frames-saves`
- Start: `main` at tag `slice-13`, `3befbf09f36cacc41fff2ab6287e63dd73d7ea44` (main was not further; assumption A1 holds)
- Date: 3 November 2026
- PRD: `docs/prd/slice-14a-notes-frames-saves.md`, copied unchanged from Łukasz's Downloads (`cmp` identical; SHA-256
  `e26ff10184009899a8651d82843c2ac26e2134d47db8920aa976b576fd158944` for both)

## Step 1: the PRD checked against the code (3 November 2026)

Read: the PRD; `docs/decisions.md` (D-03, D-04, D-07, D-20, D-21, D-38, D-66, AD-12, AD-13, AD-24); CLAUDE.md ("Saving in
panels", the canvas's queue); `docs/known-limitations.md` ("A note's text rolls back…", "A field's draft: what slice 13
does not cover", "Writes still off the save chain"); `docs/ideas.md` ("The plan after slice 13", "Notes and frames on
slice 13's rule"); `slice-13-acceptance.md` (F2, F3, F9, F12, the inventory, S13-12, the answers to step 1). Code:
`src/canvas/ModelCanvas.tsx` (`enqueue`, `enqueueGroup`, `change`, `setNames`, the card removes, `NoteLayer`'s props),
`useNotes.ts`, `useFrames.ts`, `GroupActions.ts`, `NoteLayer.tsx`, `FrameLayer.tsx`, `fresh.ts`, `value-store.ts`,
`canvas.css` (`.nt`); `src/app/_actions/note.ts`, `frame.ts`; `src/app/_lib/run-command.ts`;
`src/app/_components/use-action.ts`; `src/app/_panels/fields.tsx` (`useDraft`, `DraftLine`, `useChoice`, `TextField`,
`TextArea`), `note-panel.tsx`, `frame-panel.tsx`, `canvas-host.tsx`; `src/ui/field-draft.ts`, `field-drafts.ts`;
`src/domain/commands/note.ts` (`updateNote`), `frame.ts` (`updateFrame`); the e2e specs that touch notes and frames;
the prototype (`startEditNote`, the frame panel).

**In short.** Items 1 and 2 already exist since slice 13: every note and frame write goes through `runCommand`, which
answers the refusal's code and brings the fresh page (F1). What is missing is smaller and elsewhere: the canvas's code
throws the code away, its queue never cuts (F2), its refusals arrive before their fresh page (F3), and a note's text has
two editors that share one optimistic value (F4). The proposal keeps every other write on the queue exactly as it is.
A2 holds: no data model change, no new local file format (Q9).

### Findings

| # | Finding | Files and functions | Proposal |
| --- | --- | --- | --- |
| F1 | **Items 1 and 2 exist already.** The note and frame actions run through `runCommand`, whose `ActionResult` carries `code` (`stale_version`, `forbidden`, `archived`, `not_found`, `invalid`, `locked`, …) and the written row (its version). Since slice 13 (F3) a refusal for a stale version, a permission, the archive or a row not found revalidates the pages; a `locked` refusal does not (`lockedRefusal`), nor does an invalid input. The canvas only narrows the answer to `{ ok: false; message }` in its own types and ignores the code. | `src/app/_actions/note.ts` (`noteCommand`), `frame.ts` (`onCanvas`, `refreshed`); `run-command.ts` (`REFRESHING_REFUSALS`); `useNotes.ts:28` (`WriteResult`), `useFrames.ts` (`WriteResult`, `FAILED`), `GroupActions.ts`, `ModelCanvas.tsx` (`SaveCardResult`) | **Step 2 is smaller than the PRD assumes:** the canvas's result types carry `code` (types only for every write); only a note's own saves and the frame's `updateFrame` use it (F2, F3, F7). No change to `enqueue`/`enqueueGroup`, `runCommand` or the domain. S14A-01 checks the frame name's answer reaching its field (the line, "Not saved", no fresh page after `locked`) instead of "the queue answers with its kind". |
| F2 | **The canvas's queue never cuts.** After a cutting refusal the canvas does not change `versions.current`, and `grownVersions` skips a row with writes on their way, so every write waiting for the same row is sent with the old version and refused on its own, each with its toast. A note's text save waiting behind its refused status save is refused as stale too (D-66's "Not saved" holds by slice 13's F5, with a second toast). | `ModelCanvas.tsx:611` (`enqueue`), `:620` (`enqueueGroup`); `fresh.ts` (`grownVersions`); `useNotes.ts:156` (`save`) | **(a) Recommended:** the canvas records a cutting refusal per row id (any write on the queue that gets one), and only a note's save (`useNotes.save`) and `updateFrame` waiting behind it answer `cut` without sending and without a toast (as `rowSaves`). Card moves, sizes, frames' layout, the names switch and the deletes are sent as today (N2). (b) No cut: two toasts in S14A-06's case. |
| F3 | **The answer comes before its fresh page.** The canvas calls the actions directly (not through `useAction`'s transition), so a refusal is handled before the fresh page commits (slice 13 found the same for panels and added `afterPage`). D-66's mark compares the field's stored value with its base: answered first, it shows "Not saved" and turns into the conflict line only when the page lands; "Keep mine" pressed in between would send the old version (`versions.current` grows only with the page, `grownVersions`). | `useNotes.ts` (`save`), `useFrames.ts:936` (`updateFrame`); `use-action.ts` (`afterPage`, 3 s); `useNotes.ts:138` and `useFrames.ts` (the fresh-page effects with `mergeFresh`) | A note's and a frame's **refusal that brings a fresh page is answered once the next `initialNotes` / `initialFrames` has been merged** (3 s at most, as `afterPage`). Small: a list of waiting answers flushed at the end of the fresh-page effect. |
| F4 | **A note's text has two editors and one optimistic value.** The canvas's editor (`NoteEditor`) is mounted only while editing; the panel's `TextArea` whenever the note is selected and the details panel shows, so both are mounted while a note is edited on the canvas. `commit` and `update` write the typed text into the note's data at once (`patch`), and that value is also the panel field's stored value. After a refusal nothing keeps the base the draft started from, and with the rollback removed the panel field would take the page's value as stored (it has no draft of its own when the text was typed on the canvas). | `useNotes.ts:295` (`commit`), `:350` (`update`), `:156` (`save`, `back`); `NoteLayer.tsx` (`NoteEditor`); `note-panel.tsx:40` (`TextArea`, `value={n.text}`) | **One draft per note, kept by the canvas:** a value store in `useNotes` (`noteDrafts`: text, base, refusal kind), written when a text save starts and cleared when it is stored. The note's data keeps the **stored** text; the canvas shows the draft's text instead (N4's "optimistic" is the draft on its way). The panel's text field adopts it through a new `useDraft` option (a draft given from outside, taken when the field has neither the focus nor a draft of its own; "Use this", "Keep mine" and Escape clear or send it through the canvas). The rule stays in `field-draft.ts` with unit tests. About 150–200 lines; `useDraft` is shared by every panel field, so the option is additive and the slice 13 specs run in step 3. **Question 4.** |
| F5 | **Q3: how a draft stays on the canvas without redrawing others.** Notes are not React Flow nodes: one `NoteLayer` in a `ViewportPortal`, a memoised `NoteBox` per note, placed from data (`noteAt`). `useNotes` lives in `ModelCanvas`, so every note change today is a canvas commit (the optimistic patch, the answer's `setNotes`, a rollback). Typing in `NoteEditor` is uncontrolled: 0 commits. | `ModelCanvas.tsx:1319` (`useNotes`), `:1623` (`shownNotes`), `:2295` (`NoteLayer`); `NoteLayer.tsx` (`NoteBox`, `memo`); `value-store.ts` | Each `NoteBox` reads its own note's draft from the store with `useSyncExternalStore` and a snapshot of that note only, so a mark, "Use this" or "Keep mine" redraws that note's box and **no canvas commit**. Leaving the editor keeps today's commit (`setEditing`) without the optimistic patch; a stored save keeps its `setNotes`; a refusal's rollback commit goes. S14A-13's bar holds or improves; measured in step 4. |
| F6 | **Where the mark goes.** `.nt-head` holds the pin label (`on {card}` or "Note") and the ✓ (`margin-left: auto`). The head is drawn at every zoom (below 40 % the body is a plain block). The note's text on the canvas is `user-select: none`. A press on a button inside a note is not a drag (`onNotePointerDown` returns for `button`). | `NoteLayer.tsx` (`NoteBox`); `canvas.css:408-430` | A `<button class="nt-mark">` "Not saved" in `.nt-head` before the ✓, drawn **only** on a note with a refused draft: one element, colours from tokens (`--im-warn`), no opacity, no `will-change`, placed by CSS (no layout read). A click selects the note and opens the details panel on purpose (`openDetails`, CLAUDE.md "Side panels"; a selection is a history place, D-38). The read-only draft is copyable in the panel only (the canvas's text cannot be selected); item 9 already says "not editable" for the canvas. |
| F7 | **Q2: a frame's name is edited in its panel only.** "Rename…" in the frame's toolbox and a new frame focus `#f-fn`; a double-click on the frame's label collapses it (as in the prototype). The name's `TextField` saves through `ui.updateFrame`, which resolves `true`/`false`: `useDraft` reads `false` as a refusal without a code (`refusalOf("")`), so no line and no "Not saved". The frame is not optimistic (`patchFrames` after success), so the field keeps the typed text (slice 13's stable key). The name has no `keep` (slice 13's list of kept fields). | `frame-panel.tsx:98` (`TextField`, `update`); `useFrames.ts:936` (`updateFrame`); `context.ts:152` (`updateFrame: … => Promise<boolean>`); `canvas-host.tsx:505` ("Rename…"); `FrameLayer.tsx:135` | `updateFrame` resolves the action's answer (`{ ok, code }`, plus `cut` from F2), after the fresh page (F3). Then slice 13's line, "Not saved", Escape and "Keep mine" work in the frame panel **with no further code**. S14A-09 has no canvas part. **Question 6:** add `keep` (a closed panel's draft, as every other name). |
| F8 | **N3 mostly holds today.** A frame's kind (`Seg`, `f.kind`, not optimistic) and its concept and system (`useChoice`) show the stored value after a refusal, then the fresh page's. A note's status and colour are optimistic and roll back to the earlier value (`back`); the fresh page then brings the newest stored one (`mergeFresh`: the page's row has the higher version). The "earlier value" shows only between the answer and the page. Also changed from the canvas: the ✓ (`toggleNoteStatus`) and the toolbox's colours. | `frame-panel.tsx:51,110`; `useNotes.ts:350` (`update`); `ModelCanvas.tsx:2188`; `canvas-host.tsx:562,566`; `fresh.ts` | Keep the status's and colour's rollback (needed for `invalid`, `locked` and `unexpected`, which bring no page); with F3 the rollback and the page land together. S14A-08 becomes a check of what holds, not new code. |
| F9 | **A new note's text is not on the queue and is lost on any refusal.** `commit` of the draft note calls `createNote` directly; a refusal drops the draft note and its text, with the toast. The PRD covers saved notes only. | `useNotes.ts:299-329` (`commit`, `DRAFT_NOTE`) | **Recommended:** out of this slice, a known limitation (a create is not a row's save; D-66 speaks of rows). Alternative: keep the new note on the canvas with its text and the mark, saved again on leaving (about 40 lines, one spec). **Question 7.** |
| F10 | **Q4: leaving and Escape on the canvas today.** Ctrl+Enter or a click outside (blur) ends editing and saves a changed text; Escape cancels: editing ends, nothing is saved, the stored text shows (S3A-07). Enter alone is a new line. The canvas's own Escape does not reach the editor (`stopPropagation`). | `NoteLayer.tsx` (`NoteEditor`); `useNotes.ts` (`commit`, `cancel`); `e2e/slice-03a/S3A-07.spec.ts:33-37` | Escape without a refused draft: unchanged (it already "puts the stored text back"). With one: Escape ends editing and drops the draft ("Use this"). Leaving the editor while a conflict is marked saves nothing (slice 13, F6) and keeps the draft; with "Not saved" it saves again. |
| F11 | **"Click back at once to go on typing" (item 7, DoD 4).** On the canvas, leaving ends editing; a **double-click** (or "Edit text", "Edit on the canvas") starts it again. The prototype also starts editing on a second press of a selected note (`secondPress`, prototype line 2252); the app does not (not this slice). A second edit while a save is on its way starts from `n.text` (today the optimistic text). `commit` compares with the stored text, so once the optimistic patch is gone, leaving again with the same text while the first save is on its way would send it twice and get "Nothing to change.". | `NoteLayer.tsx:142` (`onDoubleClick`); `useNotes.ts:332` (`text.trim() === n.text.trim()`); `domain/commands/note.ts:157` (`nothingToChange`) | The editor starts from the draft's text; `commit` compares with the text on its way or, with none, the stored one (`FieldDraft.shouldSave`, slice 13's F8). DoD 4 says "double-click back". S14A-05 on the canvas: a double-click while the answer is held. |
| F12 | **Q6: read-only on the canvas.** `canNote` is the page's (`shell.standing !== "none"`); after a permission's or the archive's fresh page it is false: no drag, no ✓, no double-click. The panel's `can` turns false and its `TextArea` read-only, which keeps a draft readable (slice 13's "copy" mark, once the field knows the refusal). | `c/[canvasId]/page.tsx:162`; `NoteLayer.tsx` (`canNote`); `note-panel.tsx:24` | The store keeps the refused draft as read-only ("copy") until the page is left; the canvas shows its text with the mark; the panel shows "Not saved. You can still copy it.". Nothing else needed. |
| F13 | **Q5: pinned notes** are drawn by the same `NoteLayer`/`NoteBox` (`data-pinned`), placed at their card's or frame's offset (`noteAt`), edited the same way. A note pinned to a card in a collapsed frame, or a resolved note while resolved notes are hidden (`hideResolved`), is not drawn: its mark does not show. | `ModelCanvas.tsx:1623` (`noteShown`); `NoteLayer.tsx` | Nothing special for pinned notes. A hidden note keeps its draft in the store and shows the mark when drawn again; a known limitation. **Question 9.** |
| F14 | **Item 12: a closed panel.** With F4 the canvas's store keeps the draft for the page, so the note's text needs no `keep` from `field-drafts.ts`, and the canvas shows the mark. Slice 13's toast on closing a panel with a refused draft ("Not saved: {field} of {object}. Open it again to see your text.") would repeat what the mark says. | `fields.tsx` (`useDraft`'s cleanup, `notSavedAway`); `field-drafts.ts` | No toast when the note's panel closes with a refused draft (the mark shows it). **Question 8.** |
| F15 | **S14A-13's 20 notes with the mark** need 20 refused drafts. No test hook makes one today, and slice 13's rule is no switch in the app. | `e2e/slice-13/helpers.ts` (`holdUntil`, `changeEntityAsAnna`); `TestHooks.tsx` | Real refusals: the measuring spec changes 20 notes of "Performance test" as Anna through the domain, then edits each on the canvas (about 20 s). No hook. New helpers `changeNoteAsAnna`, `changeFrameAsAnna`. **Question 10.** |
| F16 | **S14A-02 ("the same toasts as before")** holds by construction with F1 and F2 (a): card moves, frame resizes and the rest are not changed. | — | Keep S14A-02 as a regression spec (a card move and a frame resize refused as stale and after the archive). |
| F17 | **The element guard.** The seed has no refused draft, so no mark: the viewport counts stay equal; a page total may differ by a JavaScript chunk, as in slice 8. | `S3B-15-elements.spec.ts`; `.data/measure/s9-14-baseline/slice-08.json` | As the PRD; a difference explained in step 4. |

### Q1. The writes through the canvas's queue

Every write through `enqueue` (one row) or `enqueueGroup` (several rows; after every write on its way for any of them).
The version sent is `versions.current` (the last answer, or a fresh page's grown version) or the row's own: in effect
`rowSaves`' "newest known", so it can be compared the same way. Every answer is an `ActionResult` with `code` (F1); every
refusal shows the domain's message as a toast, and a stale, permission, archive or not-found refusal brings the fresh
page (slice 13), merged by `mergeFresh`. "With the proposal" assumes F1 to F3 (a).

| Write | Where | Queue | Optimistic | Answer on success | After a refusal today | With the proposal |
| --- | --- | --- | --- | --- | --- | --- |
| A card's collapse, row filter, names exception (`change` → `saveCard`) | `ModelCanvas.tsx:744` | `enqueue` | yes | version | the card back, toast | unchanged (types) |
| The names switch (`setNames` → `setCanvasNames`) | `ModelCanvas.tsx:791` | `enqueueGroup` (every card) | yes | versions | names and exceptions back, toast | unchanged |
| Remove a card from a live canvas (`removeLive`) | `ModelCanvas.tsx:~1090` | `enqueue` | no | name, label | toast | unchanged |
| Remove a card (`remove`: the left panel, Delete) | `ModelCanvas.tsx:~1112` | `enqueue` | no | — | toast | unchanged |
| Remove a requirement card | `ModelCanvas.tsx:~1168` | `enqueue` | no | — | toast | unchanged |
| Remove the selection | `GroupActions.ts:461` | `enqueueGroup` | no | — | toast | unchanged |
| Moves, widths, drops, align, arrange, fit widths, requirement card moves, D-05's question (`saveLayout` → `moveOnCanvas`) | `useFrames.ts:350` | `enqueueGroup` (frames, cards, notes, requirement cards) | yes | versions | cards, frames, notes, requirement cards back, toast | unchanged |
| A frame's resize | `useFrames.ts:589` | `enqueueGroup` | yes | versions | size and memberships back, toast | unchanged |
| Delete a frame | `useFrames.ts:709` | `enqueueGroup` | no | versions | toast | unchanged |
| Fit a frame to its content | `useFrames.ts:752` | `enqueueGroup` | yes | versions | back, toast ("Nothing to change." silent) | unchanged |
| Collapse or expand a frame | `useFrames.ts:811` | `enqueueGroup` | yes | version | back, toast | unchanged |
| Collapse or expand all | `useFrames.ts:847` | `enqueueGroup` | yes | versions | back, toast | unchanged |
| "Show all"'s layout part (`resetView` → `resetCanvasView`) | `useFrames.ts:906` | `enqueueGroup` | yes | versions | cards and frames back, toast | unchanged |
| **A frame's name, kind, concept, system, colour (`updateFrame`)** | `useFrames.ts:943` | `enqueueGroup([frame])` | no | the frame | toast; resolves `false` | **resolves `{ ok, code }` after its fresh page (F3); cut behind a cutting refusal (F2)** |
| Arrange into frames | `useFrames.ts:978` | `enqueueGroup` | no | versions | toast | unchanged |
| Put in a new frame | `useFrames.ts:1054` | `enqueueGroup` | no | frame, versions | toast | unchanged |
| **A note's text, status, colour (`commit`, `update` → `save` → `updateNote`)** | `useNotes.ts:295,350` | `enqueue` | yes | the note | `back` (text, status or colour), toast | **text: a draft instead of the rollback (F4); status, colour: the rollback as today (F8); cut (F2); answered after its fresh page (F3)** |
| A note's width, move, pin, unpin (`save`) | `useNotes.ts:362-475` | `enqueue` | yes | the note | `back`, toast | cut behind a cutting refusal of the same note (F2) |
| Notes of a selection moved together (`saveMoves` → `moveNotes`) | `useNotes.ts:192` | `enqueueGroup` | yes | versions | back, toast | unchanged |
| Delete a note (`remove`) | `useNotes.ts:391` | `enqueue` | yes (hidden at once) | — | put back, toast | unchanged |
| Create a note (`commit` of the draft note → `createNote`) | `useNotes.ts:299` | none | — | the note | the new note and its text dropped, toast | unchanged (F9, question 7) |
| Create a frame (`createFrame`) | `useFrames.ts:611` | none | no | frame, versions | toast | unchanged |

Off the queue and out of this slice: the canvas's look (`look.tsx`, its own queue) and a canvas's rename in its tab
(slice 14b, N5).

### Q2. Frames

See F7: the panel only. The name is a `TextField` (stable key since slice 13), the kind a `Seg`, the concept and system
`useChoice` selects, a free frame's colour buttons. All save through `ui.updateFrame` → `useFrames.updateFrame` →
`updateFrameAction`, one at a time per frame, not optimistic.

### Q3. Notes on the canvas

See F4 to F6. In short: the notes are one layer in React Flow's viewport portal, not nodes; the draft becomes a value
store read per note by its memoised box (no canvas commit for the mark, "Use this" or "Keep mine"); the note's data keeps
the stored text; the mark is one button in the note's header, drawn only with a refused draft, so no new layer.

### Q4. Escape and leaving

See F10 and F11.

### Q5. Pinned notes

See F13: the same component; nothing extra.

### Q6. Read-only

See F12.

### Q7. Slice 13's pieces to reuse

- **The conflict line and "Not saved":** `DraftLine` as it is, in both panels.
- **The draft's rules:** `useDraft` and `FieldDraft` (`field-draft.ts`). The frame's name uses them unchanged (F7). The
  note's text needs one additive option, a draft given from outside (F4); `TextArea` passes it on.
- **`field-drafts.ts`:** for the frame's name if question 6 says `keep`; not for the note's text (F14).
- **The fresh page after a refusal:** exists for every write (`runCommand`); the canvas adds only the wait (F3).
- **The hold of a save's answer:** `holdUntil` (`e2e/slice-13/helpers.ts`) matches any server action by its body, so it
  holds `updateNoteAction` and `updateFrameAction` too (by the note's or frame's id).
- **The note panel's text field** stays slice 13's `TextArea`, with the draft option; the frame's `TextField` as it is.

### Q8. Earlier tests and docs

**No earlier spec expects a note's rollback or a frame's kind going back** (searched: every spec that uses the notes'
and frames' fields: `S2B-*`, `S2C-03`, `S3A-*`, `S9-04`, `slice-06b/helpers.ts`, `S13-*`). Expected to pass unchanged:

| Spec | What it checks that the slice touches |
| --- | --- |
| `S3A-07` | a note's text in place: Ctrl+Enter saves, undo; **Escape cancels** (F10); width; colour from the toolbox and the panel |
| `S3A-05`, `S3A-06`, `S3A-10` | pinning, notes in frames, the note panel |
| `S3A-13` | a reviewer writes notes, a reader only reads; direct commands refused |
| `S3A-14-idle`, `S2C-12`, `S3B-15-idle`, `S4P-12`, `S3B-13` | canvas and miniature commits (the draft store must add none) |
| `S2B-01`, `S2B-03`, `S2B-08`, `S2B-13`, `S2C-03` | the frame panel's name, kind, concept, system; a reviewer's frames |
| `S9-04` | the frame and note panels' saves since slice 9 |
| `S13-01` to `S13-12`, `e2e/fixes/panel-field-focus.spec.ts` | `useDraft` gets an option (F4): every field's draft rules |
| `S6B-*` (note places) | the mark's click selects a note: a history place |

**Run in step 2:** S14A-01, S14A-02, S14A-09; S2B-01, S2B-03, S2B-08, S2B-13, S2C-03, S9-04; the canvas's write specs of
slices 1b, 2a, 2b and 10a (moves, sizes, removes: the types change); then the full run (N6).
**Run in step 3:** S14A-03 to S14A-08, S14A-10 to S14A-12; the slice 3a specs, S6B's note places, S13-01 to S13-12,
`panel-field-focus`, the commit specs above.

**Docs:** CLAUDE.md ("Saving in panels": notes and frames on the canvas's queue with their answers, the cut and the wait;
the draft store; the mark; the new helpers); `docs/known-limitations.md` (remove "A note's text rolls back…"; add F9 if
question 7 says (a), and F13); `docs/ideas.md` (the entry done, the plan, section 9's entries, the prototype's second
press, F11); `docs/decisions.md` (D-66, AD-24's note, with your approval); `docs/inventory-prototype-vs-app.md`; README.

### Q9. The data model

**A2 confirmed.** A note's draft and its refusal live in the page's memory (the canvas's store), never in a row or the
browser's storage (D-66). No new column, no new table, no new kind of change event; `DEV_DB_FORMAT` stays 11
(`src/data/local/schema.ts`); the seed is not changed (A4).

## Items, decisions and criteria checked

| Item / decision / criterion | Result |
| --- | --- |
| Item 1 (refusal kinds) | exists (F1); the canvas's types narrow it |
| Item 2 (fresh page; none after `locked`; invalid cuts nothing) | the page exists (F1); the cut does not (F2); the order (F3) |
| Item 3 (the other writes unchanged) | holds with F1 and F2 (a): types only (Q1) |
| Items 4–7 | need F4, F5, F11 |
| Item 8 (Escape) | as today without a draft; with one, "Use this" (F10) |
| Item 9 (other refusals) | F12; `locked` and invalid keep the draft editable; `not_found`: the fresh page removes the note and its draft goes |
| Items 10, 14 (choices) | mostly hold (F8) |
| Item 11 (pinned) | the same code (F13) |
| Item 12 (closed panel) | the store (F14) |
| Item 13 (frame name) | panel only (F7) |
| Item 15 (unchanged) | holds; `useDraft` gets an additive option (F4) |
| N1 | F6; the click opens details on purpose |
| N2 | with F1 and F2 (a) |
| N3 | F8 |
| N4 | the draft is what shows at once (F4) |
| N5, N6, N8 | as agreed |
| N7 | F5, F15, F17 |
| D-20, D-21 | unchanged: a draft is not a new note; every stored change is still one undo step |
| D-38 | the mark's click is a selection, a history place; a gone note: `SelectionHistory`'s toast as today |
| D-66 | F3, F10, F14; its sentence on notes and frames replaced as the PRD proposes |
| AD-12, AD-13 | unchanged: one save, one change event, one undo step; "Keep mine" an ordinary save |
| AD-24 | F5, F6: no layer, no opacity, no layout read; the LayerTree read in step 4 |
| S14A-01 | restated (F1): the frame name's answer reaches its field; `locked` without a fresh page; an invalid name (too long) cuts nothing |
| S14A-02 | a regression check (F16) |
| S14A-03, S14A-04, S14A-07, S14A-10 | as written |
| S14A-05 | on the canvas with a double-click back (F11) |
| S14A-06 | one toast needs F2 (a); else two |
| S14A-08 | a check of what holds (F8) |
| S14A-09 | panel only (F7) |
| S14A-11 | the canvas's text cannot be selected (F6) |
| S14A-12 | as written; the deleted note leaves the canvas with the fresh page |
| S14A-13 | 20 real refusals (F15) |
| S14A-14 | as written |

## Differences between the prototype and the app that the slice touches

- **No save conflicts in the prototype** (PRD section 8): the mark and the lines are new.
- **A second press on a selected note starts editing** in the prototype (`secondPress`, line 2252); the app needs a
  double-click (F11). Not changed here; an entry for `docs/ideas.md`.
- A frame's name is edited in the panel in both (`#f-fn`, "Rename…"); a double-click on its label collapses it in both.

## New and changed user-visible texts (proposals, for approval)

| Where | Text | New / reused |
| --- | --- | --- |
| The note's mark on the canvas | "Not saved" | new |
| Its title and accessible name, editable | "Your text is not saved. Click to see it in the note's panel." | new |
| Its title and accessible name, read-only | "Not saved. Open the note's panel to copy your text." | new |
| The note panel's text, the frame panel's name | "Changed meanwhile to:", "Cleared meanwhile.", "Use this", "Keep mine", "Show more", "Show less", "Not saved", "Not saved. You can still copy it." | reused (slice 13) |
| The conflict toast | "Someone changed this meanwhile." | reused |
| A frame's name kept for a closed panel (if question 6) | "Not saved: Name of {frame}. Open it again to see your text." | reused pattern (`notSavedAway`) |

No existing text changes.

## Questions for Łukasz

1. **Step 2's scope** (F1, F16): items 1–2 exist; step 2 becomes the canvas's types, the note's and frame's answers with
   the cut and the wait (F2, F3) and the frame name's line (F7), with S14A-01 restated and the full run (N6). Agreed?
2. **The cut** (F2): (a) only a note's and a frame's own saves are cut behind a cutting refusal (one toast); every other
   write as today. Or (b) no cut (two toasts). Recommended: (a).
3. **Waiting for the fresh page** (F3) before a note's or frame's refusal is answered (3 s at most)? Recommended: yes.
4. **One draft per note in the canvas's store**, the panel's field adopting it through a new `useDraft` option (F4)?
   Recommended: yes. (The alternative, mounting the panel's field anew when a canvas draft is refused, breaks slice 13's
   stable keys.)
5. **The mark** (F6): a "Not saved" button in the note's header before the ✓, only on a refused note; the texts above?
6. **The frame's name keeps its draft when its panel closes** (`keep`, F7), as every other name? Recommended: yes.
7. **A new note refused** (F9): out of the slice, a known limitation (a), or kept on the canvas with the mark (b)?
   Recommended: (a).
8. **No toast when the note's panel closes with a refused draft** (F14), since the canvas shows the mark? Recommended:
   yes.
9. **A hidden note** (in a collapsed frame, or resolved while those are hidden) shows its mark only when drawn again
   (F13): accepted as a known limitation? Recommended: yes.
10. **S14A-13 with 20 real refusals** (F15), no test hook? Recommended: yes.
11. **DoD step 4 and S14A-05 on the canvas:** "double-click back" to go on typing (F11)? The prototype's second press is
    an idea for later.
12. **Steps:** step 2 as question 1; step 3 the note's draft (F4–F6, F10–F14), the choices check (F8), S14A-03 to
    S14A-08 and S14A-10 to S14A-12; step 4 the measurements; step 5 the closing. Agreed?

## Ideas (not built)

- The prototype's second press on a selected note to edit it (F11).
- A new note's text kept after a refusal, if question 7 says (a).

## Łukasz's answers to step 1 (3 November 2026)

1. **Yes:** step 2 in F1's scope.
2. **The cut only for a note's saves and `updateFrame`,** one toast.
3. **Yes:** a refusal is answered after its fresh page, 3 s at most (as `afterPage` in slice 13).
4. **Yes:** one draft per note in the canvas's value store, and an option in `useDraft`.
5. **Yes:** the "Not saved" mark as a button in the note's header, drawn only after a refusal; the texts in the table
   are accepted.
6. **Yes:** `keep` for the frame's name.
7. **A new note's text after a refused creation:** a known limitation, out of the slice.
8. **Yes:** no toast when the note's panel closes with a refused draft.
9. **Yes:** a hidden note (a collapsed frame, hidden resolved notes) shows its mark when it is drawn again; added to the
   known limitation of answer 7.
10. **Yes:** S14A-13 on 20 real refusals, no test hook.
11. **Yes:** a double-click in DoD step 4 and S14A-05; the prototype's second press on a selected note goes to
    `docs/ideas.md`.
12. **Yes:** steps 2–5 as in this file.

**N6 changed:** step 2 changes the canvas's other writes only in their types, so there is no full e2e run after step 2.
Each step runs the canvas's, notes' and frames' specs from Q8; one full run (three parts, `E2E_MEMORY_LOG=1`) at the
closing. If step 2 turns out wider than F1, it stops and the full run after step 2 comes back.

**Done with the answers:** the PRD is updated (status "step 1 answered", N6, items 1–3a, 7, 12–14 and "Out of this
slice", step 2, S14A-01, S14A-02, S14A-05, S14A-06, S14A-09, S14A-13, DoD step 4, section 9, the docs). `docs/ideas.md`
has both ideas; `docs/known-limitations.md` has "A new note's text, and a note that is not drawn".

## Step 2: the canvas's queue (3 November 2026)

Commit `98298e6`. Step 2 stayed within F1: the canvas's other writes changed only in their result types (and their
`FAILED` constant got the code `unexpected`), so there was no full run after it (N6).

### What changed

- **`src/canvas/save-cuts.ts`** (new, pure): `SaveCuts` (a cutting refusal per row: stale version, permission, archive,
  not found, `locked`; a save marks the count when it is queued and is cut when it grew meanwhile) and `FreshWaits` (an
  answer held until the next fresh page's rows are merged, at most 3 s; answered at once when a page was merged since the
  save was sent). `CanvasSave` is what a note's or frame's save answers: `{ ok: true }` or `{ ok: false, code }`.
- **`useNotes.save`** (text, status, colour, width, move, pin, unpin) answers `CanvasSave`: a refusal records its cut,
  puts `back` and shows its toast as before, and answers after the fresh page when it brings one; a save waiting behind a
  cutting refusal of the same note is not sent, puts its `back`, shows no toast and answers `cut`. `update` returns that
  answer. The rollback of the note's text is unchanged until step 3 (the draft store).
- **`useFrames.updateFrame`** answers `CanvasSave` the same way (no rollback: frames are not optimistic). The fresh-page
  effects of both hooks end with `fresh.merged()`.
- **Types:** `CanvasUiApi.updateFrame` resolves `CanvasSave`, `updateNote` resolves `CanvasSave | undefined`
  (`context.ts`, `CanvasProvider.tsx`); `WriteResult` in `useNotes.ts` and `GroupActions.ts` carries `code`.
- **The frame panel's name** gets slice 13's line, "Not saved", Escape and "Keep mine" from the answer, and `keep`
  (answer 6). Its concept and system (`useChoice`) read the same answer. The note panel's text still discards the answer
  (a comment says so) until step 3.
- **Not changed:** `enqueue`, `enqueueGroup`, `runCommand`, the domain, every other canvas write's handling.

**One behaviour change for notes beyond the panels:** a note's saves waiting behind a cutting refusal of the same note
(e.g. a move behind a refused text) are no longer sent and refused one by one; they are put back with no toast of
their own (answer 2). A note's save waiting behind a refused group write (`saveLayout`, `saveMoves`) is not cut, as only
the note's own saves record cuts.

### Specs

| Spec | Result |
| --- | --- |
| S14A-01: stale name, the line, the canvas shows Anna's name | passed |
| S14A-01: a name save cut behind a refused colour: "Not saved", one toast; leaving saves it | passed |
| S14A-01: a locked organization: no fresh page, editable, "Not saved" | passed |
| S14A-02: a card's move refused (stale; archived) | passed (2) |
| S14A-02: a frame's resize refused (stale; archived) | passed (2) |
| S14A-09: the line, "Keep mine" one undo step, Escape takes Anna's | passed |
| S14A-09: "Use this"; a refused name kept while the panel is closed comes back with its line and the toast | passed |
| Earlier: `e2e/slice-01b`, `slice-02a`, `slice-02b`, `slice-03a`, `slice-10a`, `S2C-03`, `S9-04` | 117 passed (23.0 min), one run |
| Unit tests (`npm test`) | 1,576 passed, 9 new in `save-cuts.test.ts` |
| `npm run lint`, `npm run typecheck` | passed |

The nine slice 14a tests passed at the first run (1.7 min). I did not run S14A-01 and S14A-09 against the code before
the change; their assertions (the line, "Not saved", `keep`) need the answer's code, which `updateFrame` did not give
(it resolved `true`/`false`). S14A-02 passes before the slice by design (a regression check).

**S14A-01's "an invalid input cuts nothing"** cannot be reached from the frame panel: an empty name goes back in the
browser (D-59) and a frame's name has no length limit (`nameSchema`). It is covered by the unit test ("an invalid input,
an unexpected error or a cut save cuts nothing"), and the spec's header says so. Proposal: accept the
unit test for this part.

### How to check

- In two windows of a canvas with a frame: rename the frame in the first, then in the second type another name in its
  panel and press Enter: the toast, the line "Changed meanwhile to: …" with "Use this" and "Keep mine".
- Close that panel with Escape outside the field: the toast "Not saved: Name of {frame}. …"; select the frame again: your
  name with its line.
- Notes behave as before in the panel and on the canvas (their draft comes in step 3).

### New or changed user-visible texts

None new. The frame panel shows slice 13's texts ("Changed meanwhile to:", "Use this", "Keep mine", "Not saved", "Not
saved: Name of {frame}. Open it again to see your text.").

## Łukasz's answers to step 2 (3 November 2026)

- **Step 2 accepted.**
- **S14A-01's "an invalid input cuts nothing"** is checked by the unit test (`src/canvas/save-cuts.test.ts`): accepted.
- **S14A-01 and S14A-09 were not run against the code before the change:** accepted, as recorded above (they need the
  answer's code, which `updateFrame` did not give).
- **Step 3** as the PRD and the answers to step 1 say; a note's saves cut behind a refusal of the same note no longer
  roll back: they keep the draft as "Not saved" in the panel and with the mark on the canvas (PRD item 6), replacing
  step 2's interim rollback. A canvas commit count while typing in a note on the canvas as a quick check (the full
  S14A-13 in step 4).

## Step 3: notes and frames (3 November 2026)

Commit `19b76aa`.

### What changed

- **`src/canvas/note-drafts.ts`** (new): one text draft per note, kept by the canvas for the page (`NoteDrafts`: text,
  base, the value on its way, the refusal's kind), with its rules as pure functions (`draftRefusal`, `inConflict`,
  `onLeave`) and `useNoteDraft`, a per-note subscription (`useSyncExternalStore`), so a draft, its mark, "Use this" and
  "Keep mine" never re-render the canvas. Unit tests: `note-drafts.test.ts` (8).
- **`useNotes`:** a note's text is no longer written into the note's data before it is stored; it is the note's draft
  (`saveText`, for the canvas and the panel alike). A refusal keeps the draft with its kind (`mark` for a stale version or
  a cut, `locked`, `copy` for a permission or the archive; unmarked after an invalid input); a note not found takes it
  with it; a stored save ends it, keeping text typed after it. **Cut text saves no longer roll back** (step 2's interim
  rollback is gone, step 2 answers). The status, colour, width, moves and pins roll back as before, and the fresh page
  then shows the newest stored value (F8). A note deleted elsewhere drops its draft with the fresh page (`retain`).
- **Leaving the canvas's editor** (`commit`, `onLeave`): saves a changed text; with a conflict it keeps the typed text as
  the draft and saves nothing (D-66, F6 of slice 13); typed back to the stored text it drops the draft. **Escape**
  (`cancel`) drops a refused draft ("Use this"); without one it cancels as before (S3A-07).
- **`NoteLayer`:** a note shows its draft's text (the editor starts from it, answer 11) and, after a refusal, the
  button "Not saved" in its header before the ✓ (`.nt-mark`: token colours, no opacity, no `will-change`, only on a
  refused note), titled for an editable or a read-only draft. A click selects the note and opens the details panel
  (`CanvasHost.openDetails`, a new host function the canvas host registers).
- **`useDraft`'s option `outside`** (`fields.tsx`, additive): a draft kept outside the field is shown, with its refusal's
  mark, while the field has neither the focus nor its own different text; "Use this" and Escape drop it. The note
  panel's `TextArea` passes the canvas's draft (`ui.noteDrafts()`), and its save answers again. No `keep` for the note's
  text, no toast when its panel closes (answer 8).
- **Frames:** nothing more than step 2 (the name's line, `keep`; the kind, concept and system show the stored value).

### Specs

| Spec | Result |
| --- | --- |
| S14A-03: the panel's conflict line, the canvas's draft with the mark, Keep mine one undo step; Use this | passed |
| S14A-04: the conflict on the canvas, the mark opens the panel's line, Keep mine | passed |
| S14A-05: typing while the save is held, on the canvas (double-click back) and in the panel | passed (2) |
| S14A-06: a text save cut behind a refused status: Not saved, the mark, one toast; leaving saves it | passed |
| S14A-07: Escape on the canvas and in the panel, without and with a refused draft | passed (2) |
| S14A-08: a note's colour and a frame's kind refused: the newest stored value with the toast | passed (2) |
| S14A-10: a pinned note's conflict (the view moved so the note is in it, `openWithNote`) | passed |
| S14A-11: archived meanwhile: the draft with the read-only mark, not editable; the panel read-only and selectable | passed |
| S14A-12: a locked organization (editable, Not saved); a note deleted meanwhile (the note and its draft go) | passed (2) |
| One run: `e2e/slice-14a` (S14A-01 to S14A-12), `slice-03a`, `slice-02b`, `slice-13`, `fixes/panel-field-focus`, S2C-03, S2C-12, S9-04, S6B-02, S3B-13, S3B-15-idle, S4P-12 | 90 passed, 1 skipped (the commit check, on demand), 15.4 min |
| Unit tests (`npm test`) | 1,584 passed |
| `npm run lint`, `npm run typecheck` | passed |

**The quick commit check** (`COMMITS=1`, `e2e/slice-14a/S14A-13-commits.spec.ts`, the dev server, the demo's free note):

| Phase | Canvas commits |
| --- | --- |
| Double-click to edit | 4 |
| Typing 20 characters (one line) | **0** |
| Typing 20 more | 0 in the second run; **1** in the first, where the text wrapped to a new line: the note's measured height (`onHeight`, since slice 3a), not the draft |
| Leaving the editor, the save stored | 4 |
| Leaving the editor, the save refused (the mark and the fresh page) | 6 |
| The mark clicked (the note selected, its panel open) | 1 |
| "Use this" | **0** |

The comparison with slice 13's numbers for the same phases (S14A-13's bar "no commits beyond what the note's own save
adds today") is step 4's, A/B on both builds.

### Screenshots

`docs/prd/slice-14a-screens/step-3/`, light and dark: `note-mark-*` (the note with its mark on the canvas, at 45 %),
`note-panel-conflict-*` (its panel with the line), `note-read-only-mark-*` and `note-panel-read-only-*` (after the
archive), `frame-name-conflict-*` (the frame panel's name with the line).

### How to check

1. Open "Customer & orders" in two windows. Change the free note's text in the first (panel or canvas).
2. In the second, double-click the same note, type other text, Ctrl+Enter: the toast, the text stays, "Not saved" in
   the header. Click it: the panel with "Changed meanwhile to: …"; "Keep mine", then Undo.
3. Repeat and press Escape in the note's editor (or "Use this" in the panel): the other text shows, the mark goes.
4. Archive the workspace in the first window, then write in a note in the second: the mark stays, the note no longer
   opens its editor; the panel shows the text read-only with "Not saved. You can still copy it.".

### New and changed user-visible texts (the whole slice)

| Where | Text | New / reused |
| --- | --- | --- |
| A note's mark on the canvas | "Not saved" | new |
| Its title and accessible name, editable | "Your text is not saved. Click to see it in the note's panel." | new |
| Its title and accessible name, read-only | "Not saved. Open the note's panel to copy your text." | new |
| The note panel's text, the frame panel's name | "Changed meanwhile to:", "Cleared meanwhile.", "Use this", "Keep mine", "Show more", "Show less", "Not saved", "Not saved. You can still copy it." | reused (slice 13) |
| A frame's name refused while its panel closes | "Not saved: Name of {frame}. Open it again to see your text." | reused (`notSavedAway`) |
| The conflict toast | "Someone changed this meanwhile." | reused |

No existing text changed.

### Not done in step 3

- S14A-13 in full (the A/B commit bar, the element guard, the LayerTree read with 20 marks): step 4.
- The docs (CLAUDE.md, D-66, known limitations, ideas, inventory, README): step 5.

## Łukasz's answers to step 3 (3 November 2026)

- **Step 3 accepted.**
- **N4:** list every place that reads a note's text from the canvas's data, whether it shows the draft or the stored
  value, and whether the person writing sees the difference; record it as a deliberate change of N4, and stop if the
  person writing would see the old text anywhere.
- **A screenshot of a note with its mark at 100 %,** light and dark.
- **Step 4** (S14A-13, A/B against slice-13 in one sitting, the measuring build) after that.

### N4: where a note's text is read (step 3's change, checked 3 November 2026)

Since step 3 a note's text reaches the note's data (`NoteData.text`, `useNotes`) only once it is stored; until then, and
after a refusal, it is the note's draft (`note-drafts.ts`). Before slice 14a the typed text was written into the data at
once and rolled back after a refusal.

| Place | Reads | Shows | Seen by the person writing? |
| --- | --- | --- | --- |
| The note on the canvas (`NoteLayer`, `NoteBox`: its text, the editor's start) | the draft, else the data | **the draft** | the draft, as typed |
| The note's height (the tether, the plain body below 40 %, Fit) | the drawn box (`ResizeObserver`, `onHeight`) | the draft's height | — |
| The note panel's text (`note-panel.tsx`, `TextArea` with `outside`) | the draft, else the stored text | **the draft**, with its line or "Not saved" | the draft |
| The note's toolbox (`canvas-host.tsx`) | no text | — | — |
| The Overview's miniature, fading and Focus (`miniNotes`, `fadeNotes`), the tethers | places and colours only | — | — |
| The left panel's search (`tree-data.ts`) | notes are not searched | — | — |
| The panels' redraw key (`notesKey`, `ModelCanvas.tsx`) | the stored text | — (not drawn) | — |
| **The canvas's overview panel, "Notes on this canvas"** (`overview-panel.tsx`, `ui.notesView()`, first line) | the stored text | **the stored text** | **yes**, see below |
| **A card's or frame's panel, "Notes"** for its pinned notes (`notes-here.tsx`, `ui.notesView()`) | the stored text | **the stored text** | **yes**, see below |
| **The selection panel's list** with several items (`selection-panel.tsx`, `ui.noteView().note.text`) | the stored text | **the stored text** | **yes**, see below |

**Where the person writing sees the old text (stopped here, as asked):** the three lists show a note's first line from
the stored text. Two moments:

1. **While a save is on its way** (usually 0.1–0.3 s): the lists still show the earlier text (before slice 14a the
   typed one, at once). Hardly visible: while a note is written, the note itself is selected and its panel shows, not
   one of these lists.
2. **After a refusal, while the draft stays:** the canvas and the note's panel show the person's draft with "Not saved",
   but the overview panel's list (nothing selected), the pinned note's card or frame panel and a several-item selection
   show the stored text: the other person's after a conflict, the earlier text after a cut, a permission, the archive or
   a locked organization. Before slice 14a these lists showed the same stored text, since the draft was lost; now the
   canvas and the lists differ.

**Proposals:**
- **(a) The lists show the draft** too, as the canvas does: `notesView` and the selection panel take a note's draft's
  text when it has one, and the three lists subscribe to the drafts (they are panels beside the canvas, so no canvas
  commit; nothing reads layout). A refused draft's row gets the meta "not saved" (a fourth new text) so the list says it
  is not stored. About 30 lines and one spec (S14A-04 extended: the overview's list shows the draft).
- **(b) The lists stay on the stored text,** recorded as a deliberate part of N4: they list what is stored; the canvas
  and the note's panel show what was typed. A known limitation.

Recommended: (a), since D-66 says the person's text stays where they see it.

### Screenshots at 100 %

`docs/prd/slice-14a-screens/step-3/note-mark-100-light.png` and `note-mark-100-dark.png` (the screenshot spec's new
case "a note with its mark at 100 %").

## Łukasz's answer on N4 (3 November 2026): (a), done

**(a):** the three lists ("Notes on this canvas", a card's or frame's "Notes", the selection's list) show the note's
draft as the canvas does; a row with a refused draft says "Not saved", the same text as the note's mark (no new text);
each row reads only its own note's draft, so typing never redraws a whole list and adds no canvas commit.

**Done** (part of N4 from now on):
- `src/app/_panels/note-row.tsx` (new): `NoteRow`, a list row that reads its own note's draft (`useNoteDraft`), shows
  its first line (else the stored text's) and, for a refused draft, "Not saved" (`note-row-not-saved`) in place of its
  meta. A draft changes when a save starts or is answered, never while typing.
- `overview-panel.tsx`, `notes-here.tsx`, `selection-panel.tsx` use it; the overview's filter still searches the stored
  text.
- The N4 table above changes for those three rows: they now show **the draft**, with "Not saved" after a refusal. The
  person writing no longer sees the old text anywhere except while a save is on its way in a list that is not shown
  then (the note being written is selected, so its panel shows).
- **S14A-04** extended: with a refused draft the canvas's overview list (nothing selected) and the selection's list
  (the note and a card) show the draft with "Not saved", and after "Keep mine" the overview's row shows it without.
  **S14A-10** extended: the pinned note's card panel ("Notes") shows the draft with "Not saved".

## Step 4: measurements (S14A-13; 3 November 2026)

**Builds:** this branch at `4c5f3d5` (step 3 with N4's lists) and the tag `slice-13` (`3befbf0`) in a worktree
(`../infomapper-ab-13`, its own `npm ci`, removed after the reading). Commits are counted on each side's e2e dev server
(the counter exists only in development); the element guard and the LayerTree read run on this branch's measurement
build (`npm run measure:build`, `MEASURE=1 MEASURE_BUILD=production`). The machine is the reference laptop (AD-24).

### Canvas commits, A/B (`e2e/slice-14a/S14A-13-commits.spec.ts`, `COMMITS=1`, the same file on both sides)

The demo canvas, its free note; each phase read once the counter settles. Two runs per side (the branch first, then
slice 13); both runs of a side gave the same numbers.

| Phase | slice 13 | branch |
| --- | --- | --- |
| Double-click to edit | 4 | 4 |
| Typing 20 characters (one line) | **0** | **0** |
| Leaving the editor, the save stored | 5 | **4** |
| Leaving the editor, the save refused (the toast, the fresh page; on the branch the draft and its mark) | 9 | **6** |
| Escape, then the mark clicked (the note selected, its panel open) | — | 2 |
| "Use this" in the panel | — | **0** |
| A refusal answered while nothing is selected and the overview lists the note (its answer held, Escape, then released) | 6 | **4** |

- **Typing adds nothing** on either side. A new line adds one commit on both, by the note's measured height
  (`onHeight`, since slice 3a; step 3's first quick check).
- **The stored save costs one commit less** (5 → 4): the text is no longer written into the note's data before it is
  stored (the draft shows it), so that commit is gone; the answer's `setNotes` stays.
- **A refusal costs three fewer** (9 → 6): no optimistic text, no rollback; the draft and its mark change only the
  note's box and the list rows (the store), not the canvas. The rest is the fresh page.
- **The mark's click is 2** (Escape's deselection and the click's selection: a selection is a canvas commit); "Use this"
  is 0. **Under the overview's list** the refusal is 4 against 6: the list's row reads the draft by itself (`NoteRow`).
- **Bar met:** no phase adds commits beyond what slice 13's note save adds; three phases have fewer.

### Element guard (`S3B-15-elements.spec.ts`, `ELEMENTS_BASELINE=.data/measure/s9-14-baseline/slice-08.json`)

| View | Page | Viewport | `slice-08.json` | slice 13's page |
| --- | --- | --- | --- | --- |
| 30 %, expanded | 5,999 | 4,508 | 5,994 / 4,508 | 5,999 |
| 100 %, expanded | 20,796 | 19,305 | 20,791 / 19,305 | 20,796 |
| 30 %, collapsed | 2,866 | 1,465 | 2,861 / 1,465 | 2,866 |
| 100 %, collapsed | 6,308 | 4,907 | 6,303 / 4,907 | 6,308 |

**Passed:** the viewport counts equal slice 8's, and the page totals equal slice 13's (no new element, no new script
chunk on "Performance test", which has no refused draft).

### Drawing layers (`e2e/slice-14a/S14A-13-layers.spec.ts`, measurement build)

20 free notes on "Customer & orders" (test data in the e2e data file), at 60 %, all in the view. Three reads in one
sitting: without a mark; with the mark on all 20 (20 real refusals: Anna changed each note just before this page wrote
it on the canvas, no test hook); and again without it, after Escape dropped each draft. Two runs, the same numbers:

| Read | Drawing layers | Megapixels | Viewport elements | Marks |
| --- | --- | --- | --- | --- |
| Without the mark | 13 | 5.2 | 769 | 0 |
| With the mark (20 refused drafts) | **13** | 5.2 | 789 | 20 |
| Without it again | 13 | 5.3 | 769 | 0 |

- **No drawing layer more:** the mark is one element per refused note (+20), painted with the note.
- A first run read 14 layers with the marks: the last refusal's toast was still showing (a layer of its own above the
  page, outside the canvas). The spec now waits until no toast is visible before each read.
- **Pan and zoom were not measured**, as the LayerTree read shows no change (PRD section 6, N7).

### AD-24 (proposed sentence, for your approval)

"A refused note's draft (slice 14a) adds one element to that note only, its "Not saved" mark in the header, and no
drawing layer (20 marked notes in view: 13 layers, as without them); the draft lives outside React's state, so a mark
or "Use this" adds no canvas commit, and a note's save costs one commit less than before (4 against 5, a refusal 6
against 9)."

### Other

- `S14A-13-layers.spec.ts` is ignored outside the measurement build (`playwright.config.ts`, as S11-13).
- Results: `test-results/S14A-13-commits-<side>.json`, `test-results/S14A-13-layers.json` (git-ignored).

## Łukasz's answers to step 4 (3 November 2026)

- **Step 4 accepted,** with the AD-24 sentence (accepted on the day of the merge).
- **Step 5** as the PRD says: the docs, one full e2e run, CI, the branch pushed with a pull request, KB's backup, the
  manual acceptance scenario. Merge and the tag `slice-14a` only on Łukasz's command.

## Step 5: the closing (3 November 2026)

### Docs

- **`docs/decisions.md`:** D-66's sentence on notes and frames replaced (the text below); "Changed in slice 14a (notes
  and frames); accepted by Łukasz on the day of slice 14a's merge." added to its acceptance; AD-24's sentence on a
  refused note's mark after slice 11's.
- **`docs/known-limitations.md`:** "A note's text rolls back after a refused save; a frame's fields have no line"
  removed; "A new note's text, and a note that is not drawn" stays (step 1 answers 7 and 9); the list of fields that
  keep a closed panel's draft names a frame's name and the canvas's notes.
- **`docs/ideas.md`:** "Notes and frames on slice 13's rule" done; the plan's 14a done, next 14b.
- **`docs/inventory-prototype-vs-app.md`:** slice 14a's deliberate differences (the mark, the lists, a frame's line; the
  prototype's second press to edit a note).
- **README:** the status, the slice's line, the acceptance link, the three new commands.
- **CLAUDE.md:** the slice in the opening paragraph; "Saving in panels" with slice 14a (the canvas's queue with refusal
  codes, `save-cuts.ts`, `note-drafts.ts`, the mark, `useDraft`'s `outside`, `NoteRow`); slice 14a's e2e helpers and
  how 20 refusals and a LayerTree read are made; the three commands.

**D-66's changed part (for your acceptance):**

> Notes and frames follow the same rule through the canvas's queue (slice 14a): a note's text keeps its draft, one per
> note for the page, in its panel and on the canvas; on the canvas a note with a refused draft shows a "Not saved" mark
> in its header, which selects the note and opens its panel with the conflict line; the panels' lists of notes (the
> canvas's overview, a card's or frame's "Notes", the selection's list) show the draft too, with "Not saved" after a
> refusal; a frame's name has the conflict line in its panel and keeps its draft when the panel closes; a note's status
> and colour and a frame's kind, concept and system show the newest stored value after a refusal; a refusal that cuts
> cuts the note's or the frame's own saves waiting behind it (one toast), while the canvas's other writes (layout, the
> names switch, removes) keep their behaviour. A note never saved loses its text when its creation is refused.

### Backup of KB

`.data/backups/dev-db-20261103-1200.json` and `.data/backups/kb-model-latest.json`, both byte for byte equal to
`.data/dev-db.json` ("Kanton Basel" in it); git-ignored, never committed. Nothing was reset or seeded over it (A3).

### Manual acceptance (on your model KB, "Kanton Basel", after the backup)

Start `npm run dev` (no e2e run at the same time) and sign in. Use a canvas of "Kanton Basel" with a free note, a note
pinned to a card and a frame (add them first if the canvas has none). Two windows on the same canvas: the second
window's page does not know what the first one saves until it saves something itself.

1. **A conflict on the canvas.** In window A change a note's text (double-click it, type, Ctrl+Enter). In window B
   double-click the same note, type other text, Ctrl+Enter: the toast "Someone changed this meanwhile.", your text
   stays on the note, and "Not saved" shows in its header.
2. **The lists.** In window B press Escape (nothing selected): "Notes on this canvas" in the right panel lists the note
   by your text with "Not saved". For the pinned note, select its card: the card's "Notes" shows the same.
3. **The mark.** Click "Not saved" on the note: the note is selected, its panel shows your text and "Changed meanwhile
   to: …" with A's text. Press "Keep mine": stored, the mark and the line go. Press Undo (Ctrl+Z): A's text is back.
4. **In the panel, Use this.** Repeat step 1's change in A; in B type into the note panel's text and leave it (Tab):
   the line shows; press "Use this": A's text, nothing stored. Repeat once more and press Escape in the field: the same.
5. **Escape on the canvas.** Make another conflict on the canvas (step 1), then double-click the note in B and press
   Escape: A's text shows, the mark goes.
6. **Typing while a save is on its way.** Type a long text into a note, Ctrl+Enter, double-click it again at once and
   go on typing: nothing is lost; Ctrl+Enter saves the rest.
7. **A frame's name.** Rename a frame in A (its panel); in B type another name in its panel and press Enter: the line
   with A's name. Press Escape outside the field to close the panel: the toast "Not saved: Name of {frame}. …"; select
   the frame again: your name with its line.
8. **Choices.** Change a note's colour in A, then another colour in B: B shows A's colour, with the toast. The same for
   a frame's "Stands for".
9. **Optional, read-only:** archive the workspace in A (the workspace home), then write in a note in B: the toast, the
   mark stays, the note no longer opens its editor; the mark opens the panel with "Not saved. You can still copy it.".
   Unarchive afterwards.
