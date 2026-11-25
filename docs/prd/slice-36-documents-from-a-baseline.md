# Slice 36 – Documents from a baseline

Status: **proposed** (25 November 2026). Proposed by Łukasz on 24 November 2026 as the second of the Baselines pair
(slice 35: baselines, merged; slice 36: documents from a baseline). **Full path** (CLAUDE.md, "The slice cycle", 2),
because it widens a CHECK (a migration), opens InfoDocumenter's `baseline` source, adds a section type and a preset on
both adapters. Branch `slice/36-documents-from-a-baseline`, from `dev` (`b9db4e5` or later). PRD file:
`docs/prd/slice-36-documents-from-a-baseline.md`; step 1 writes `docs/prd/slice-36-acceptance.md`. Test regime:
CLAUDE.md, "Testing".

**No prototype change in this slice's files:** the prototype accepted by Łukasz on 24 November 2026 for slices 35 and 36
together is already on `dev` (`docs/prototype/infomapper-prototype-with-sources.html`, SHA-256
`6d5b5b7f5f00c739f3c799961ec2b6198e3ec407601595fe63c47a400ecdc179`; fact, `b9db4e5`). One file in Łukasz's Downloads
folder (The slice cycle, 3):

| File | SHA-256 |
| --- | --- |
| `slice-36-documents-from-a-baseline.md` | given in the prompt |

Written from the decision rounds of 24 November 2026 (no file in the repository; quoted as "B3.1" to "B4.6"), D-87 and
its note (slice 35), D-80 to D-86 (InfoDocumenter), AD-03, AD-14, the prototype and lookups in the code on `dev` at
`b9db4e5` (marked "fact, `b9db4e5`"). Facts and assumptions are marked; every assumption is to be checked in step 1.

## 1. Why

Slice 35 made baselines and their comparison (D-87). A baseline's second purpose (AD-03) is documentation **exactly as
the model was** at a sign-off: the client signs a document from "Stage 2 sign-off" and it never changes after, whatever
happens to the live model. And the comparison becomes a document to send: "what changed since stage 1".

Decisions taken before this PRD (Łukasz, 24 November 2026, on Claude's recommendations):
- **B3.1 (b):** a document from a baseline is made in the editor's "Model state" (the live model or a baseline) and by
  "New document from it" in a baseline's row.
- **B3.2 (a):** the source can be changed at any time, by whoever may change the document.
- **B3.3 (a):** a baseline's figures draw its canvases and frames as they were (its own layout), not today's; label
  canvases are not drawn from a baseline.
- **B3.4:** no "DRAFT · live model" watermark by default; the footer's source "Baseline “{name}” of {date time}" in the
  document's language; Markdown's front matter names the baseline.
- **B3.5 (a):** a document whose baseline was deleted shows a message instead of its content; Print / PDF and Markdown
  are disabled; it never falls back to the live model.
- **B4.1 (b):** "Changes since" defaults to the previous baseline. **B4.2 (b):** old → new, long texts "(changed)", one
  rule with the Baselines tab's dialog. **B4.3 (a):** the section follows the document's scope. **B4.4:** the same kinds
  as the dialog. **B4.5:** the sign-off preset. **B4.6 (c):** "Make a document" in the Compare dialog.

## 2. What to build

### A document's source (S36-01)

- **"Model state"** in the editor's Document panel (the prototype's `data-dsrc` select): "Live model (changes as people
  work)" and each live baseline of the workspace, newest first, "Baseline “{name}” ({date time})" (the time in the
  browser's time zone, as slice 35). Whoever may change the document may switch it at any time (B3.2): live → a
  baseline, one baseline → another, and back. The switch is an ordinary saved change of the document (its version,
  D-59), outside undo as InfoDocumenter's other document changes are (*assumption:* as today; step 1 says).
- **"New document from it"** in each baseline's row of the Baselines tab, for whoever may make documents (the button's
  rights as "New document"'s): it makes a private document from the sign-off preset with that baseline as its source and
  opens it in the editor.
- `document_definition.source_kind` accepts `baseline` with a live `baseline_id` of the same workspace (fact, `b9db4e5`:
  `SOURCE_KINDS` has both, `ACCEPTED_SOURCE_KINDS` only `live`; `document_definition_source_ck` already allows
  `baseline`). A `baseline_id` of another workspace, or a deleted one at the time of the write, is refused.
- **The content (S36-06):** a document from a baseline is built from the baseline's content alone; the live model is not
  read for its content. *Assumption:* the content (D-87: a projection of `store.snapshot`, `baselineContentOf`) is turned
  back into the `WorkspaceSnapshot` shape the builders read (`DocumentState`), through slice 35's upgrade chain; the
  organization's name and the people's names (the author on the title page) come from the live workspace as today, as
  they are outside a content. Step 1 says how (Q1).
- **Figures (B3.3):** the figures and the Diagrams section draw the baseline's canvases, items and frames in their layout
  at that time; a label canvas is not drawn from a baseline (labels are outside the content): a figure or section that
  points to one shows *assumption:* the app's existing "not available" text for a figure whose canvas is gone, with the
  reason "Label canvases are not drawn from a baseline." (Q2).
- **The editor's note** under "Model state" while the source is a baseline: "Tables and diagrams come from the baseline
  as it was taken. Label canvases are not drawn from a baseline."
- **The footer's source** (fact, `b9db4e5`: `labels.ts` `live: "Live model on {d}"`): a new label "Baseline “{name}” of
  {date time}" in English, Polish and German. *Assumption:* the date and time in the browser's time zone in the editor
  and the PDF; in Markdown with the UTC offset (S36-04).
- **The watermark** (fact, `b9db4e5`: `wm: "DRAFT · live model"`, D-81's switch): off by default for a document from a
  baseline; switched on it reads "DRAFT · baseline {name}" in the document's language.
- **Print / PDF** prints a document from a baseline as its preview shows it.

### The section "Changes since …" (S36-02)

- A new section type `changes` ("Changes since a baseline", "What was added, changed and removed since a baseline you
  choose.") in "+ Add section", in every document, live or from a baseline.
- **Option "Compared with":** empty by default, meaning "Previous baseline: {name} ({date time})": the newest live
  baseline older than the document's source (for a live document, the newest baseline); or any live baseline chosen.
  The older state is always the start (slice 35's `olderFirst`).
- **Heading:** "Changes since “{name}”" in the document's language ("Changes since …" while there is none).
- **Body:** groups Added, Changed, Removed (empty ones left out), each a table Kind / Item / What changed, by slice 35's
  comparison (`compareBaselines`, references by id, D-87) and its words (`COMPARE_WORDS`): kinds, field names,
  yes / no and closed lists in the document's language. **Polish and German words are written in this slice** (fact,
  `b9db4e5`: `COMPARE_WORDS = { en: EN, pl: EN, de: EN }`), listed in the acceptance document for Łukasz's review.
- **Scope (B4.3):** only the items in the document's scope (projects, concepts, levels); an item counts when it is in
  scope on either side, so an entity removed from a scoped project still shows. *Assumption:* the scope is resolved on
  each side's own state (the baseline's projects and concepts for the older side). If step 1 finds it complex, Claude
  comes back with "the whole workspace" and the criterion changes (Q4).
- "No changes." when nothing differs; "Nothing to compare with yet." when there is no older baseline; "The baseline this
  section compared with no longer exists." when a chosen one was deleted (S36-05).
- **Where it runs:** *assumption:* on the server, as slice 35's Compare (the contents never go to the browser), the
  section receiving its list of changes; step 1 says how this fits the editor, which builds documents in the browser
  today (Q3).
- **Markdown** shows the same section as the PDF (tables as Markdown tables, slice 34's rules).

### The sign-off preset (S36-03)

- A fourth preset `signoff`, "Sign-off package for the client" ("From a baseline: cover, introduction, overview,
  diagrams, dictionary, mappings, requirements and changes."), after "Source-to-target specification for ETL" and before
  "Blank document" (fact, `b9db4e5`: `DOCUMENT_PRESETS = ["dictionary", "s2t", "blank"]`).
- A document from it: source the newest live baseline; audience "Client"; every mapping (`all`); no watermark; sections
  in order: Text (body "Scope of this stage: …", "Assumptions: …", "Open points: …" as the prototype's), Conventions and
  notation, Model overview with the first project's first canvas in tab order as its figure, Model readiness, Diagrams,
  Data dictionary, Source-to-target mapping, Requirements and coverage, Traceability, Data quality rules, Source tables,
  Classification register, Changes since a baseline (empty "Compared with", so the previous baseline). Each section's
  options as the prototype's preset (`PRESETS.signoff`), or the app's defaults where the prototype has none.
- While the workspace has no live baseline the preset is greyed out with "Create a baseline first." and cannot be
  chosen. Everything can be changed afterwards.
- **Migration:** `document_definition_preset_ck` widened to allow `signoff` (fact, `b9db4e5`: it allows `dictionary`,
  `s2t`, `blank`). *Assumption:* the preset is stored on the row as today.

### "Make a document" from the comparison (S36-04)

- In slice 35's Compare dialog, for whoever may make documents: "Make a document" makes a private document named
  "Changes since “{older}” to “{newer}”" ("Changes since “{older}”" when compared with Now), whose source is the newer
  state (that baseline, or the live model), with one section "Changes since" the older baseline (chosen, not
  "previous"); it opens in the editor. The dialog's filters are not carried; the section follows the document's scope
  (the whole workspace for a new document).
- *Assumption:* made from the blank preset with its one Text section replaced by the changes section; step 1 says how the
  preset stays `blank` on the row.

### Markdown from a baseline (S36-04)

- The same sections as the PDF; the front matter (slice 34's MT1; fact, `b9db4e5`: `markdown.ts` writes `["source",
  "live model"]`) becomes `source: "baseline"`, `baseline: "{name}"` and `baseline_taken: "{yyyy-mm-ddThh:mm±hh:mm}"` for
  a document from a baseline; unchanged for a live one.

### A document whose baseline is gone (S36-05)

- **Slice 35's delete dialog** gains the documents' line: "One document is made from it. It stays and says that the
  baseline no longer exists; its author can choose another source." / "{n} documents are made from it. They stay and
  say that the baseline no longer exists; their authors can choose another source.". The count includes documents the
  person cannot see (a number only, never their names; counted on the server).
- **Such a document**, in the editor and on its page: "This document points to a baseline that no longer exists."
  instead of its content; "Model state" shows "Baseline no longer exists: choose another source"; Print / PDF and
  Markdown are disabled with that reason as their title. It never falls back to the live model. Choosing another source
  makes it work as before.
- **A section whose chosen baseline is gone** says "The baseline this section compared with no longer exists." in place
  of its table; the rest of the document prints. With "Previous baseline" it takes the next older one or says "Nothing to
  compare with yet.".
- The Documentation tab's list: *assumption:* a document whose baseline is gone shows a small "baseline gone" mark beside
  its name (the prototype has none; step 1 proposes or drops it).

### Reading (S36-06)

Opening the Baselines tab or the Documentation tab reads no content. A content is read, by id (AD-14's note), only when
a document from it is opened, previewed, printed or exported, or a "Changes since" section or Compare needs it.

### Rights

No new actions: changing a document's source is changing the document (InfoDocumenter's rights, D-81); "New document
from it" and "Make a document" are making a document; reading a baseline's content for a document needs only that the
person may read the document and is a member of the workspace (every member may read baselines, D-87).

### The demo

The local demo's "Stage 1 sign-off" (D-87) is the baseline for the e2e specs. *Assumption:* one demo document from it is
not needed (the specs make their own); step 1 says whether the demo's documents should include one. None online.

### Tests

- Unit: the source's rules (accepted kinds, a baseline of another workspace refused, a deleted one refused at write);
  building a document from a content (each section type; the figures from the content's canvases; a label canvas left
  out); the footer's and watermark's texts in three languages; the changes section (default, chosen, older first,
  scope on either side, the three messages); the preset (sections in order, options, disabled without a baseline);
  Markdown's front matter; the words in Polish and German (every key present).
- Contract suite on both adapters: a document's source set to a baseline (and a refused one), the sign-off preset's row,
  the documents' count for a baseline (with other people's private documents).
- E2E (`e2e/slice-36/`): S36-01 to S36-05 as written, with demo accounts; a live-document spec unchanged.

### Not in this slice

A version (one document frozen as rendered, "Generate version"); Restore of a baseline; comparing classifications,
stereotypes or InfoCube's own rows; carrying the Compare dialog's filters into a document; a filter option in the
changes section; freezing labels for label canvases (the design's option a); German words review (Łukasz, any time).

## 3. Data model

- `document_definition_preset_ck` widened with `signoff` (one migration; fact, `b9db4e5`). `source_kind` and
  `baseline_id` exist (fact). *Assumption:* no foreign key from `baseline_id` to `baseline` is added or changed, since a
  baseline is soft-deleted (step 1 says what exists, Q6).
- **Local adapter:** the preset accepted in the data file's rules; no format step expected (Q6).
- `data-model-v2.md`'s `document_definition` updated.
- On `infomapper-dev` Łukasz runs `npm run pg:migrate` himself after `npm run pg:backup` (AD-39's note of 24 November
  2026), with KB's row counts before and after (4,871 at `kb-20261124-1924.json`, unless Łukasz has worked in KB since).
  No test or step makes a baseline or a document in KB.

## 4. Sources

- **Decisions:** D-87 and its note, AD-03, AD-14 (and its slice 35 note), D-80 to D-86 (InfoDocumenter: rights, style,
  watermark, figures, Markdown), D-59, AD-39.
- **Code (fact, `b9db4e5`):** `src/modules/infodocumenter/domain/types.ts` (`SOURCE_KINDS`, `ACCEPTED_SOURCE_KINDS`,
  `DOCUMENT_PRESETS`), `presets.ts`, `commands.ts` (new document: `source_kind: "live"`), `document.ts`
  (`BuildDocumentInput`, the footer, `frameOf`'s watermark), `labels.ts` (`live`, `wm`), `markdown.ts` (front matter),
  `sections.ts` (the section kinds), `figures.ts`; `src/modules/infodocumenter/app/actions.ts` (the editor's snapshot via
  `store.snapshot` and `browserSnapshot`); `src/domain/document/state.ts` (`DocumentState`); slice 35's
  `src/domain/baseline/` (`content.ts`, `upgrade.ts`, `compare.ts`, `words.ts`), `src/compose/baselines.ts`,
  `src/app/_actions/baselines.ts`, the Baselines tab and its dialogs.
- **The prototype:** InfoDocumenter's Model state (`data-dsrc`), `goneBl`, `expOff`, the changes section (`prevBl`,
  `againstOf`, `reg(CORE, {type:"changes"…`), `PRESETS.signoff`, the preset picker's disabled state, `DOC.fromChanges`,
  `askDeleteBaseline`'s documents' line, the baseline row's "New document from it".

## 5. Steps

Stop after each step; wait for Łukasz.

1. **Reconnaissance and check.** Copy this PRD from Downloads into the repository and check it with `cmp` and the
   SHA-256 (stop if it differs); check the prototype on `dev` is `6d5b5b7f…c179`. Answer Q1–Q10 in
   `slice-36-acceptance.md`; every place where the PRD is wrong or costs more than it assumes, with a proposal; the
   differences between the prototype and the app this slice touches; the earlier specs and tests each step touches; the
   plan for steps 2 to 6. No application code, no connection to `infomapper-dev`.
2. **The domain and the data:** the source's rules, a document built from a content, the changes section's builder and
   words (PL, DE), the preset, Markdown's front matter, the documents' count, the migration, both adapters, the contract
   suite. A draft PR into `dev`.
3. **The pages:** Model state, the note, "New document from it", the preset picker, the changes section's options,
   "Make a document", the gone baseline's messages and disabled buttons, the delete dialog's line; the e2e specs. A full
   run.
4. **Łukasz's migration, one step at a time:** `pg:backup`, KB's counts, `pg:migrate` on `infomapper-dev`, KB's counts
   again. **Stop.**
5. **Łukasz's acceptance** on `npm run dev:pg` with demo accounts: S36-01 to S36-05. **Stop** with what he saw.
6. **Close.** The docs and the decisions quoted in full for approval (section 8); the housekeeping (section 8); one full
   run on the final commit. Merge into `dev` and tag `slice-36` only on Łukasz's command, with `pg:backup` before the
   merge only if KB changed since the last backup.

## 6. Acceptance criteria

Łukasz's criteria 1 to 6 (24 November 2026).

| ID | Criterion |
| --- | --- |
| S36-01 | **A document from a baseline.** In the document editor, "Model state" offers "Live model (changes as people work)" and each baseline ("Baseline “{name}” ({date time})", newest first); whoever may change the document may switch it at any time, live to a baseline, one baseline to another and back. Each baseline's row in the Baselines tab has "New document from it", which makes a document from the sign-off preset with that baseline as its source and opens it in the editor. A document from a baseline shows the model exactly as it was when the baseline was taken: every section's tables and every figure, the canvases and frames drawn in their layout at that time (label canvases are not drawn); changing the live model afterwards changes nothing in it. Its footer's source reads "Baseline “{name}” of {date time}" in the document's language; the watermark is off by default, and when switched on it reads "DRAFT · baseline {name}" (not "DRAFT · live model"). The editor says "Tables and diagrams come from the baseline as it was taken. Label canvases are not drawn from a baseline." Print / PDF prints it as the preview shows it. (Criterion 1.) |
| S36-02 | **The section "Changes since …".** "+ Add section" offers "Changes since a baseline" in every document, live or from a baseline. Its option "Compared with" is "Previous baseline: {name} ({date time})" by default, the newest baseline older than the document's source (for a live document, the newest baseline), or any baseline chosen; the older state is always the starting point. Its heading is "Changes since “{name}”" in the document's language. It lists Added, Changed and Removed as tables of Kind, Item and What changed, by the same rule as the Baselines tab's "Compare…" (S35-04: the same kinds, old → new values, long texts as "(changed)"), with headings, kinds and field names in the document's language. It covers only the document's scope (projects, concepts, levels): an item counts when it is in scope on either side, so an entity removed from a scoped project still shows. "No changes." when nothing differs; "Nothing to compare with yet." when there is no older baseline. Markdown shows the same section as the PDF. (Criterion 2.) |
| S36-03 | **The sign-off preset.** "New document" offers a fourth preset, "Sign-off package for the client" ("From a baseline: cover, introduction, overview, diagrams, dictionary, mappings, requirements and changes."), after "Source-to-target specification for ETL" and before "Blank document". A document made from it has the newest baseline as its source, the audience "Client", every mapping included, no watermark, and these sections in order: Text (with "Scope of this stage: …", "Assumptions: …" and "Open points: …" to fill in), Conventions and notation, Model overview with the first canvas as its figure (the first project's first canvas in tab order), Model readiness, Diagrams, Data dictionary, Source-to-target mapping, Requirements and coverage, Traceability, Data quality rules, Source tables, Classification register and Changes since the previous baseline. While the workspace has no baseline the preset is shown greyed out with "Create a baseline first." and cannot be chosen. Everything in the document can be changed afterwards, as in any other. (Criterion 3.) |
| S36-04 | **From the comparison to a document; Markdown from a baseline.** The Baselines tab's "Compare…" dialog has "Make a document" for whoever may make documents. It makes a private document named "Changes since “{older}” to “{newer}”" ("Changes since “{older}”" when compared with Now): its source is the newer state (that baseline, or the live model), its one section is "Changes since" the older baseline, and it opens in the editor, ready to print or export. The dialog's filters are not carried into the document; the section follows the document's scope. Markdown of a document from a baseline has the same sections as its PDF, and its front matter names the source as `source: "baseline"` with `baseline: "{name}"` and `baseline_taken:` its date and time with the offset from UTC, instead of `source: "live model"`. (Criterion 4.) |
| S36-05 | **A document whose baseline is gone.** When a baseline is deleted, the documents made from it stay. The Baselines tab's delete dialog says how many: "One document is made from it. It stays and says that the baseline no longer exists; its author can choose another source." ("{n} documents are…" for more), counting documents the person cannot see as a number only, never their names. Such a document, in the editor and on its page, shows "This document points to a baseline that no longer exists." instead of its content; "Model state" shows "Baseline no longer exists: choose another source"; Print / PDF and Markdown are disabled with that reason. It never falls back to the live model. Once whoever may change it chooses another source, it works as before. A "Changes since" section whose chosen baseline is gone says so in place of its table ("The baseline this section compared with no longer exists.") and the rest of the document prints; with "Previous baseline" (the default) it takes the next older one or says "Nothing to compare with yet.". (Criterion 5.) |
| S36-06 | **Nothing breaks.** Live documents print, preview and export to Markdown as today, the demo's documents unchanged; the full run passes and the contract suite compares the new commands (a document's source set to a baseline, the sign-off preset, the documents' count for a baseline) on both adapters. A document from a baseline is built from the baseline's snapshot alone and the live model is not read for its content. Opening the Baselines tab or the Documentation tab reads no snapshot; a snapshot is read when a document from it, a "Changes since" section or "Compare…" needs it. Online the migration (the sign-off preset) passes in CI; on `infomapper-dev` Łukasz runs `pg:migrate` after `pg:backup`, with KB's row counts the same before and after, and no test makes a baseline or a document in KB. Acceptance on `dev:pg` with demo accounts. No Vercel, GitHub or Supabase settings. (Criterion 6.) |
| S36-07 | CI, the Schema workflow, the full run before the merge; every earlier test changed, with its reason. |

**Manual acceptance:** Łukasz, step 5: S36-01 to S36-05 on `dev:pg` with demo accounts (a baseline taken by hand
online, as in slice 35); S36-06 from CC's report and his own check of KB's counts. Lesson from slice 35's step 5: give
him long lists (the changes section with many rows) and renames to try.

## 7. Questions for step 1

- **Q1. Building from a content.** How a baseline's content becomes the `WorkspaceSnapshot` / `DocumentState` the
  builders read (the inverse of `baselineContentOf`, through slice 35's upgrade chain); what a content lacks that a
  section or the title page reads (people, organization, labels, notes, members) and where each comes from; whether the
  editor's browser snapshot (`browserSnapshot`) is the right path for a content too (the same data class as the live
  model's, so D-87's "the contents never go to the browser" is about Compare) or the document is built on the server.
- **Q2. Figures.** The canvases, items and frames in a content; how a figure or the Diagrams section draws from them; a
  label canvas from a baseline (what the figure shows); a figure pointing to a canvas that is not in the baseline.
- **Q3. The changes section.** Where it runs (server or browser), how it gets one or two contents (the document's source
  and the compared baseline, or the live model), and its cost; the "previous baseline" rule's ties (two baselines in the
  same minute: `created_at` to the millisecond).
- **Q4. Scope on either side.** How `sectionScopeOf` resolves projects, concepts and levels on a content; the rule "in
  scope on either side" for added, changed and removed items; its cost; or the proposal "the whole workspace" if complex.
- **Q5. Words.** Polish and German for every key of `COMPARE_WORDS` and every new label (footer, watermark, headings,
  messages), listed for Łukasz's review.
- **Q6. The migration and the local adapter.** `document_definition_preset_ck`, any foreign key on `baseline_id`, the
  local data file's rules; the Schema workflow.
- **Q7. The source's writes.** Changing the source: its command, version, history, undo (as InfoDocumenter's other
  document changes); refusals (another workspace's baseline, a deleted one, an archived workspace).
- **Q8. The documents' count.** How the delete dialog counts every document pointing to a baseline, other people's
  private ones included, without exposing names; on both adapters.
- **Q9. Reading.** That the Baselines tab, the Documentation tab and the workspace home read no content; when the editor
  reads it, and how often (debounced previews: once per open, not per keystroke).
- **Q10. Risks and shared infrastructure.** The three lines that still say "ten parts" (the header comment in
  `scripts/e2e.ts`, CLAUDE.md's "Test runs" bullet and its `--part 2` line: fix them in this slice's closing, after
  chore PR 94's eleven parts); the e2e parts' heap (slice 36's folder in part 11); the full run's time; the Markdown and
  PDF paths (D-86); anything that changes this plan.

## 8. Decisions (proposals) and docs

Quoted in full at the closing for Łukasz's approval; the texts below are proposals for step 1 to correct.

- **D-88 (new): Documents from a baseline** (slice 36): the source, the content as the source of tables and figures, the
  footer and watermark, the changes section and its rules, the sign-off preset, "Make a document", Markdown's front
  matter, the gone baseline.
- **D-87 (note):** the Compare dialog's "Make a document" and the delete dialog's documents' line; `COMPARE_WORDS` in
  Polish and German.
- **D-80 / D-81 / D-86 (notes):** the fourth preset; the watermark's text for a baseline; Markdown's front matter.
- **AD-39 (note):** Supabase's backup retention, if Łukasz has given it.
- Docs: `decisions.md`, `data-model-v2.md` (`document_definition`), `ideas.md`, `known-limitations.md`,
  `inventory-prototype-vs-app.md`, README and CLAUDE.md (with Q10's "ten parts" lines).

## 9. Left for later

A version ("Generate version"); Restore of a baseline; comparing classifications, stereotypes and InfoCube's own rows;
"who changed it and when between two baselines"; a history view; impact analysis; the Compare dialog's filters in a
document; freezing labels for label canvases.
