# Fix – A field shows its typed text after Undo (S23-02)

Status: **diagnosis done** (10 November 2026); **Option 2 chosen by Łukasz and built** (section 5); not merged. Branch `fix/field-draft-after-undo`
from `main` at `10e342e` (tag `slice-24`). A fix to shared infrastructure (the draft rules, `useDraft` and
`FieldDraft`), outside slices (CLAUDE.md, the slice cycle, 4). Łukasz's KB file (`.data/dev-db.json`) was not touched:
every run here used the e2e data file.

Sources: `docs/known-limitations.md` ("A text area whose command trims may keep an untrimmed draft", "Undo right after a
definition's save can leave the typed text in the field"), `docs/prd/slice-23-acceptance.md` (step 4, `TextArea`'s
`prepare`), `docs/prd/slice-24-acceptance.md` ("S23-02 fails now and then locally"), the trace in
`.data/traces/s23-02-20261110/`.

## 1. The cause

**A field learns that its text was stored only from a render in which its `stored` value equals its text.**
`useDraft` (`src/app/_panels/fields.tsx`) hands every new `stored` value to `FieldDraft.receive`
(`src/ui/field-draft.ts`) in an effect keyed on `[stored]`. `receive` ends the draft (`taken = stored`) only when the
element's text equals `stored`; otherwise the text is a draft (`text !== taken`) and is kept. A save's answer
(`FieldDraft.answered`) says nothing about the stored value: on success it only lowers the count of saves on their way.
So the field depends on seeing a render with exactly its own text as `stored`. Two things take that render away:

**(a) The save's page is never drawn on its own (S23-02).** The definition's save answers (its toast shows from the
action's answer in `useAction`'s `run`), but the page it revalidated is applied in a React transition that commits a
little later. When Undo is pressed in that gap (S23-02 presses it as soon as the e2e file has the value, about 0.4 s
after the save was sent), the undo's server action is dispatched while the save's page is not committed yet. React
renders pending transitions together and holds them while an action is pending, so **the save's page and the undo's
page are committed in one commit**. The field goes from `stored = before` straight to `stored = before`: the effect does
not run at all (its dependency did not change), `taken` is still `before`, and the typed text, different from it, stays
as a draft for good. Nothing else in the chain is wrong: every action answers 200, the stored value is right, the
toast is right (the trace in `.data/traces/s23-02-20261110/` shows exactly this).

Shown with a temporary log in `useDraft`'s effect (removed again, not committed): after the save's answer and the
undo's answer the BK definition field's effect never ran again; before them it had run only with the original value.
On GitHub the page renders faster than on the laptop, so the gap was rarely hit there (3/3 passed), locally 3 of 9.

**(b) The stored value never equals the text (slice 23's trim note).** A command that trims stores `"x"` for a typed
`"  x  "`. A field without `prepare` sends the untrimmed text; the save's page brings `stored = "x"`, `receive("x",
"  x  ")` keeps the text as a draft (`taken` stays the old value). Every later stored value (an undo, another person's
change) is kept out of the field until it is left or Escape is pressed. No race is needed.

**One cause or two?** One rule behind both: the draft ends only by an equal render. (b) is the stored value differing
by the command's normalisation; (a) is the equal render being skipped. `prepare` (slice 23) fixes (b) on a field, never
(a): S23-02's definition already has `prepare`, and the regression test below fails without any spaces in the text.
`TextField` always trims, so every short text field is exposed to (a) too, e.g. S23-02's rename right before it.

## 2. Every field affected

(a) affects **every field built on `useDraft`**: `TextField`, `TextArea` and the direct users (`canvas-tabs.tsx`'s
rename, `project-heading.tsx`'s name and description, `settings-form.tsx`'s three fields, `conventions.tsx`'s and
`stereotypes-box.tsx`'s names, `attribute-panel.tsx`'s number fields, `mapping-panel.tsx`'s rule) whenever a later page
is committed together with the save's page: an Undo or Redo right after a save, or any other action whose page lands
in the same commit. Not affected: the canvas note's text (`NoteDrafts` in `src/canvas/note-drafts.ts` learns from the
save's answer, `drafts.stored(id, stored.text)` in `useNotes.ts`, not from a render), choice fields (`useChoice`).

(b), by reading the commands (not each one run; the column note is, test 2 below):

| Field | Where | The command trims | `prepare` | (b) |
| --- | --- | --- | --- | --- |
| A source table's or column's note | `_panels/classifications.tsx` `SourceNote` → `setSourceNote` | yes (`plainTextPair`) | no | **yes** |
| A mapping's note | `_panels/mapping-panel.tsx` → `updateMapping` | yes (`plainTextPair`) | no | **yes** |
| A mapping's rule | `_panels/mapping-panel.tsx` (`useDraft`) → `updateMapping` | yes (`ruleSchema`) | no | **yes** |
| A calculation's rule | `_panels/calculation-section.tsx` → `setCalculationRule` | yes | no | **yes** |
| A requirement's expression | `_panels/requirement-panel.tsx` → `updateRequirement` | yes (`optionalTextSchema`) | no | **yes** |
| InfoCube's transformation rule and note | `modules/infocube/app/mapping-panel.tsx` → `updateCubeMapping` | yes | no | **yes** |
| A note's text in its panel | `_panels/note-panel.tsx` → `useNotes.saveText` → `updateNote` | yes (`plainTextPair`) | no | **yes**, through `NoteDrafts.stored` (below) |
| A note's text on the canvas | `useNotes.commit` | yes | trailing spaces only (`replace(/\s+$/, "")`) | **yes** for leading spaces or blank lines |
| Classification and stereotype definitions, naming conventions | `conventions.tsx`, `stereotypes-box.tsx` | yes | yes (slice 23, 24) | no |
| Every `TextField`, the project's description, the settings' fields, the canvas rename, the classification and stereotype names | | yes | yes (a trim) | no |

The note's text: `NoteDrafts.stored` ends the draft only when `draft.text === stored`; a typed text with leading spaces
(or a panel text with spaces at either end) stays a draft with no mark, shown on the note and in its panel instead of the
stored text, also after an undo. A requirement's rich-text description and the definitions in the panels go through the
rich-text editor, not `useDraft`: not affected by (b) as listed here (not checked further).

## 3. Ways to fix it

**Option 1 – `prepare` where the command trims, and the note's draft compared after the trim.** Add `prepare` (the
command's own trim) to the seven fields of the table; `NoteDrafts.stored` ends the draft when the text sent is the text
it answered for (or compare trimmed). Fixes (b) only; **S23-02's race (a) stays** and the regression test keeps failing.
Cost: small (seven call sites, one rule in `note-drafts.ts`, their unit tests). Risk: low, but a `prepare` that
differs from its command's normalisation (`plainTextPair` also turns `\r\n` into `\n`) would bring (b) back; each
field has to mirror its command.

**Option 2 (recommended) – the draft learns from its save's answer, by the row's version.** The panel saves answer
`Saved<T>` (`{ version, … }`, slice 9): the version the save wrote. `FieldDraft` remembers its newest stored save
(the text it sent and that version); `useDraft` takes the shown row's `version` beside `stored`, and its effect runs on
`[stored, version]`. The rule: when the field shows the version its save wrote, or a newer one, and the element still
holds the text that save sent (nothing typed since) and has no focus, the stored value is written into the element and
the draft ends: the stored form of its own text (trimmed) or a later value (an undo, another person). The answer and
the page can arrive in either order: the answer checks the version already shown, the effect the answer already given.
With text typed after the save, or the focus, the old rules stay (a draft is never overwritten). Fixes (a) and (b) in
one place, for every `useDraft` field, and makes `prepare` a convenience instead of a requirement. Cost: medium:
`FieldDraft` and its unit tests, `useDraft`, a `version` prop on `TextField` and `TextArea` and at their call sites
(about 30, each already has its row's version for `saveRow`), the direct `useDraft` users; `NoteDrafts.stored` gets the
same rule (end the draft when the answered save's text is the draft's text, whatever the stored form). Risk: medium,
shared infrastructure: a version that does not change with the shown value (a field shown from another row than the
one it saves, e.g. the naming conventions on the workspace's row) must pass the version of the row it saves, and a
field without a version keeps today's behaviour, so nothing gets worse where it is not passed.

Not proposed: answering a successful save only after its page (`afterPage` for successes too): it would delay every
next save of the row until the page is drawn (the save chain waits for the answer) and still needs a signal for "the
same value again".

**Recommendation: Option 2.** It removes the one rule behind both problems rather than one symptom, and the fields
without a version stay as they are.

## 4. Test plan

- **The regression tests** (`e2e/fixes/`, written in this step, failing on `main`):
  - `field-draft-after-undo.spec.ts`: the BK definition's save is held (`holdUntil`, slice 13) until Undo has been
    pressed, so Undo always starts before the save's page commits; the field must show the stored value after the
    undo. Fails deterministically: 5 of 5 local runs (one with the temporary log), each with a fresh server, all with
    the field still showing "The key the business uses." after the toast "Undone: …" and the stored value back.
  - `field-draft-trim.spec.ts`: a column's note typed with spaces, its save drawn (`data-version` 2), Undo; the field
    must show the stored (empty) value. Fails at that last line ("  Values like C-00012.  " kept), with the save's
    page already drawn: (b) without any race.
- **Unit tests** of `FieldDraft` (`src/ui/field-draft.test.ts`): the answer before and after the page, a later version
  with the same value, typing after the send, the focus, a refusal; `note-drafts.test.ts` for the note.
- **The affected specs:** `slice-13` (all, the draft rules), `slice-14a` and `slice-14b` (notes' drafts, the tab's
  rename, the leave guard), `slice-23` and `slice-24` (all), `S7C-02`, `S7C-07`, `slice-09` (the save chain),
  `fixes/panel-field-focus.spec.ts`, and the specs of each field given a version (`S18-*` for the calculation rule,
  `S4A-*` for the requirement panel, `S15C-*` for InfoCube's mapping panel, `S2C`/`S10A` mapping panels).
- **The single-file check** of both regression tests and `S23-02` on GitHub (3 rounds).
- **A full run before the merge** (the workflow "E2E" on the final commit): the draft rules are shared infrastructure.

## 5. The fix (Option 2, Łukasz, 10 November 2026)

**The rule** (`FieldDraft`, `src/ui/field-draft.ts`): `send` remembers the text sent; `answered(n, stored, version)`
remembers the newest save stored with the row's version its answer gives (`versionBy`: a panel action's
`value.version`, a canvas save's `version`); `settle(stored, version, text, focused)` ends the draft on `stored` when the
field shows that version or a newer one, the element still holds the text that save sent and has no focus. Text typed
since ends the rule for that save (the draft stays, as any draft). `receive` takes a fourth argument, the shown version,
and tries `settle` first. Without a version, the field's or the answer's, nothing changes.

**`useDraft`** (`src/app/_panels/fields.tsx`): the option `version`; the effect runs on `[stored, version]`; a save's
answer settles against the stored value and version the field was last drawn with (the page may come first); leaving
the field with the stored save's text untouched takes the stored value and saves nothing (an Undo while the field had
the focus is not undone by leaving it).

**A prop, not a context.** The fields of one panel do not all save one row: InfoCube's sections sit in the entity panel
and save `cube_entity`, `cube_measure` and `cube_attribute` rows; the Metadata conventions tab and the settings mix the
workspace's row with the classifications' and stereotypes'. A context at the panel's level would give those fields the
entity's or the workspace's version without any error; a context per row would need a provider around every section and
still fail silently where one is forgotten. `version` is therefore **required** on `TextField` and `TextArea`
(`number | null`): the compiler lists every call site, and each passes the version of the row its save writes. The
direct `useDraft` users pass it as an option (the canvas's rename in its tab, the project's name and description, the
settings' three fields, the classification and stereotype names, the attribute's length, precision and scale, a
mapping's rule).

**Two deliberate `null`s:** a note's text in its panel (its draft is the canvas's `NoteDrafts`, which the field follows
through `outside`) and InfoCube's unknown member's value (its row comes and goes with the value, and its answer is that
row, not a version): for these two the rules stay as before.

**Answers that had no version:** `renameCanvasAction` now answers the canvas's version; a frame's `updateFrame` answers
`{ ok: true, version }` (`CanvasSave`); the mapping panel's `write` answered a bare `true`, now the action's result when
stored (`false` when refused, as before: its codes stay out of the field, unchanged).

**`NoteDrafts.stored(id, stored, sent)`** (`src/canvas/note-drafts.ts`): the draft ends when the person's text is the
stored text or the text that save sent; `useNotes.save` passes the text it sent.

## 6. Tests of the fix (10 November 2026, locally, `ced0b44`)

- **Unit tests:** `src/ui/field-draft.test.ts` (a newer version with the same value, the same version, an older one,
  no version on either side, the focus held and then the field left, a trimmed value, someone else's value, text typed
  since, the answer after the page, an older save's answer and a refusal, `versionBy`) and `src/canvas/note-drafts.test.ts`
  (a trimmed note, an older answer while newer text is on its way). `npm test`: 165 files, 2,089 tests passed; `npm run
  lint` and `npm run typecheck` pass.
- **The regression specs:** both pass (they failed on `main`, section 4).
- **The affected specs** (one local run, 36.8 min): `fixes`, `slice-04a`, `slice-07c`, `slice-09`, `slice-10a`,
  `slice-13`, `slice-14a`, `slice-14b`, `slice-15c`, `slice-18`, `slice-22`, `slice-23`, `slice-24`: **251 passed, 1
  failed**. The failure: `S14B-09` "a focused field with typed text asks; once it is saved, nothing" timed out waiting
  for the name's save answer to finish (`answerOf`), as in slice 21's first full run on `main`'s code
  (`slice-21-acceptance.md`); its single-file check passed 3/3 locally. Its traces were lost: the rerun cleared
  `test-results/` before I kept them.
- **S23-02 repeated:** 5 of 5 local runs passed (3 of 9 failed before the fix).

## 7. The full runs (workflow "E2E", `64e0532`, all eight parts, no retries)

- **First run** ([42919400613](https://github.com/LukaszWolski-DA/infomapper-app/actions/runs/42919400613), 16 min 33 s):
  738 passed, 1 failed, 4 skipped, 0 flaky. The failure: `S14B-09` "a save held on its way asks; after its answer,
  nothing" timed out in `answerOf` (`e2e/slice-14b/helpers.ts`), the same line as section 6's local failure and slice
  21's. Its trace: the page's held save request ended `net::ERR_ABORTED` at the test's leave check
  (`page.close({ runBeforeUnload: true })`, dialog dismissed); `holdUntil` then fulfilled a request the page no longer
  waited for, so no `response` event came. Chromium aborting a request in flight during the beforeunload check is in the
  test's helpers (`leaveAsks`, `answerOf`), not in the draft rules: the field sends and cancels no request. Not fixed here
  (a defect in shared test infrastructure goes to its own `fix/` branch, the slice cycle, 4); proposed below.
- **Second run** ([42922094935](https://github.com/LukaszWolski-DA/infomapper-app/actions/runs/42922094935), wall-clock
  13 min 17 s): **739 passed, 0 failed, 4 skipped, 0 flaky, 0 expected failures.** No server restarted.

  | Part | Time | Heap peak (limit 8,039 MB) |
  | --- | --- | --- |
  | 1 | 7.5 min | 1,066 MB |
  | 2 | 10.2 min | 1,038 MB |
  | 3 | 8.7 min | 1,005 MB |
  | 4 | 8.1 min | 976 MB |
  | 5 | 10.0 min | 1,412 MB |
  | 6 | 8.7 min | 1,602 MB |
  | 7 | 9.2 min | 1,090 MB |
  | 8 | 11.1 min | 1,741 MB |

- **Proposal for S14B-09** (its own `fix/` branch): the leave check aborts a request on its way now and then (three times
  so far: slice 21, and twice here); `answerOf` should wait for what the page shows (the card's name, the guard's state)
  instead of a `response` event, or the check should run before the save is sent.
