# Slice 4a – Acceptance

Status: **step 5 done; waiting for Łukasz's manual acceptance** (S4A-14's element counts ran on 14 October and pass).
Branch `slice/04a-requirements`, from `main` at the tag `slice-03b` (`a10899c`), pull request #11
(draft). Steps 0 to 4 were accepted one by one (below).

## Criteria

Each criterion has its Playwright test in `e2e/slice-04a/`, named after its id; every test starts from a freshly seeded
data file (the five demo requirements, key counter 106) and depends on no other. Data a test starts from is written
through the domain (`asPerson`, `setFourEyes`); what the criterion checks goes through the page with the real mouse and
keyboard and is read back from the data file.

| ID | Test | Result |
| --- | --- | --- |
| S4A-01 | `S4A-01.spec.ts`: five groups in kind order with their counts; REQ-104's row with its icon, key, name and bar (“1 of 4 attributes covered”); search “e-mail” leaves REQ-103, “req-105” REQ-105; a folded group stays folded after a reload; “Only on this canvas”: “No requirement has a card on this canvas yet.”; Piotr and Kasia see the five but no “New requirement” | passes |
| S4A-02 | `S4A-02.spec.ts`: REQ-106 (Data requirement, Draft, Should, “New requirement” selected), then REQ-107; one undo removes it; REQ-106 renamed REQ-108 makes the next one REQ-109 (counter 110); “req-101 is already used by another requirement.” and “Enter a name.”, the fields show the stored values | passes |
| S4A-03 | `S4A-03.spec.ts`: on REQ-105 the name, owner, reference, priority, status, “Part of”, kind (Data quality rule: Check and severity warn), check, “When it fails” and the key save and survive a reload; REQ-103 as a Business rule shows Rule with its check and no “When it fails”, back as a Data quality rule both again; REQ-101's “Part of” offers only None and REQ-104; a cycle sent directly: “REQ-103 is already part of REQ-101, so REQ-101 cannot be part of it.”; “Broken down into” opens REQ-102 | passes |
| S4A-04 | `S4A-04.spec.ts`: an empty Business rule opens with its six headings and the first hint, the cursor in it; bold, a colour and a link typed into two sections save with Ctrl+Enter as exactly two headings with their text (no hints, no empty sections), `description_text` the plain text; one undo empties it again; Esc with changes asks, the second Esc discards; sent directly, `onclick`, `<script>` and a `javascript:` link are stripped | passes |
| S4A-05 | `S4A-05.spec.ts`: Order Line's definition stored as plain text before this slice shows and opens as its two paragraphs (with its line break, `a < b & c` as text), no “Insert template”; an attribute's definition the same (“Attribute definition”, “Customer.email”); Sales Order's long definition shows “Show more”, then “Show less” | passes |
| S4A-06 | `S4A-06.spec.ts`: REQ-104 linked from the entity, attribute, mapping, table and column panels with their toasts; the same link sent again: “Already linked.”, no write; “+ New requirement…” on email makes REQ-106 linked to it, one undo removes both; × in the element panel and in Traces to: “Unlinked.”, one undo each | passes |
| S4A-07 | `S4A-07.spec.ts`: email shows REQ-102, REQ-103, REQ-105 and “REQ-101 via entity”; Customer REQ-101 and the others “via attribute”; with REQ-104 on the mapping `customers.email_addr → Customer.email`, the table customers shows “REQ-104 via column”; no × on indirect rows | passes |
| S4A-08 | `S4A-08.spec.ts`: the seed's figures in REQ-101's panel (5 / 8, the three gaps) and every bar; an approved direct mapping with a type conflict (`order_line.item_code` → `Order Line.quantity`) makes quantity “not approved” in REQ-104; a requirement traced only to a table shows 0 / 0; a click on REQ-105's gap selects `birth_date`, approving its mapping makes REQ-105 4 / 4 | passes |
| S4A-09 | `S4A-09.spec.ts`: Traces to lists each element with its type and the mapping as `customers.email_addr → Customer.email`; Customer (card here) is selected with its panel; the mapping opens its panel; on “Order lines & products” `Customer.first_name` opens only its panel: view, cards and selection unchanged | passes |
| S4A-10 | `S4A-10.spec.ts`: deleting REQ-102: “Deleted REQ-102. The model elements it traced to are untouched.”, REQ-103 top level, its links gone, attributes, mappings and inputs unchanged; one undo brings back requirement, links and REQ-103's parent; deleting email takes its three links, its undo brings them back | passes |
| S4A-11 | `S4A-11.spec.ts`: Piotr and Kasia see every field read-only, no Edit, no Link field, no ×, no Delete, no “New requirement”; Piotr sets REQ-103 to Implemented; his update, link, unlink, create and delete sent directly: “As a reviewer you can only change a requirement's status.”; Kasia's status and update sent directly: “As a reader you cannot change requirements.”; Bank X (archived): “No requirements yet.”, no “New requirement”, a create sent directly: the archive message | passes |
| S4A-12 | `S4A-12.spec.ts`: four-eyes on: after Anna's description edit her panel shows the hint and Agreed is refused (“You changed REQ-103 last, so someone else has to agree it.”, still Draft); Piotr agrees it, one change event with him as user and Draft before; four-eyes off: Anna agrees REQ-104 | passes |
| S4A-13 | `S4A-13.spec.ts`: the workspace Overview's “2 of 5 requirements covered”, “3 of 5” after the approval below (step 5 note 5); “5 requirements, 2 covered” and the five rows (“5/8, Agreed” …) on both project homes; from Order management REQ-104 opens the first canvas, after visiting “Order lines & products” REQ-103 opens that one, each with the panel; the status bar goes from “Requirements 5, covered 2” to “covered 3” when `customers.dob`'s mapping is approved; with CR-23 as context, a new requirement and a link record it on every event and CR-23 marks nothing more | passes |
| S4A-14 | `S4A-14.spec.ts` (in every run): requirement panels and an element panel without its card change no card, selection, line class or view, and an idle canvas does not commit; `S4A-14-elements.spec.ts` (measurement build): the viewport counts against `.data/measure/s4a14-baseline/slice-03b.json`; S2C-12, S3A-14's and S3B-15's idle tests and S3B-13 run in every full run | passes (the element counts on `c2c0727`, below) |
| S4A-15 | CI (lint, typecheck, unit tests, the schema check) and three full runs in a row | below |

### Three full runs in a row

`npm run e2e` with no dev server running, each run timed (Łukasz after step 3: above 30 minutes, find the cause before
the merge). After any test or code change the three start again; a known flaky test (S0-10, S2A-10) also restarts them.

| Set | Commit | Runs | What happened |
| --- | --- | --- | --- |
| 1 | `2e8217a` | 3 of 3 passed: 155 tests each (127 files); **26.4, 26.2 and 26.7 min** (wall clock 1,587, 1,575 and 1,608 s); no retries, no flaky test | The server's known “destination stream closed early” lines (23, 26, 26); no Google Fonts error |

All three under 30 minutes, so no cause to look for (step 2's 32.8-minute run stayed an exception). Before the runs:
`npm run lint`, `npm run typecheck` and `npm test` (920 tests in 64 files) pass; only docs changed after `2e8217a`.

### Step 5 notes

1. **The four-eyes note** (Łukasz's point 1 after step 4): the mapping panel keeps its status buttons enabled, the
   server refuses, and its note sits below Status. Requirements behaved the same but showed the note above Status; it
   moved below (`d46ae68`). No other change.
2. **Empty key or name** now go to the server, which refuses them with “Enter a key.” / “Enter a name.” (S4A-02); before,
   the field put the stored value back without a message. A deliberate difference from PRD item 2 (below).
3. **The requirement panel carries `data-version`** so a test can wait for the page to show a saved version before the
   next edit (several quick edits in a row otherwise meet a stale version, as in the prototype's own panel).
5. **The workspace Overview's “{covered} of {total} requirements covered”** was hard-coded as “0 of 0” since slice 0
   (Łukasz, 14 October). It now reads the whole workspace's figures from the requirement index, as the canvas status bar
   does (prototype `renderWsHome`); S4A-13 checks “2 of 5” on the demo data and “3 of 5” after `customers.dob`'s mapping
   is approved. The three full runs start again after this change.
6. **The project home's side panels** no longer say that model, sources and requirements “arrive in a later slice”:
   “Open a canvas to work with the model, sources and requirements.” and “Open a canvas to see the details of what you
   select.” (Łukasz, 14 October; text only, no test checked the old texts). The project home without panels, the status
   bar without “Open notes on canvas” and the tiles without a frame count are in `docs/known-limitations.md`.
4. **Google Fonts in the e2e server:** twice in this step the e2e dev server could not build `next/font/google`'s IBM
   Plex (a network answer it could not read); the next run was fine. Not a change of the app; recorded in case it comes
   back during the three runs.

### Deliberate differences from the PRD

- **Empty key or name (item 2).** The PRD says the field shows the previous value “as the prototype does”, and the
  prototype puts it back silently. The app does put the previous value back, but first sends the empty value to the
  server, which refuses it with “Enter a key.” / “Enter a name.” (the step 0 wording table) as a toast; nothing is
  written. So the person sees why their edit did not stick, and the domain's rule is the only one. Checked on `c2c0727`
  (14 October) with a one-off Playwright test, not kept: on REQ-101 an emptied key (Enter, and a blank key left by a
  click elsewhere) and an emptied name each toast their message, the field shows `REQ-101` / “Single view of the
  customer” again, and the requirement's version is unchanged. S4A-02 checks the empty name the same way.

### S4A-14: element counts (14 October)

`S4A-14-elements.spec.ts` on `c2c0727` in the measurement build, no other server running, against
`.data/measure/s4a14-baseline/slice-03b.json`. It counts elements, not frames, so no laptop preparation.

bash:

```bash
npm run measure:build && MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-04a/S4A-14-elements.spec.ts
```

PowerShell (the two variables stay set in that window; `Remove-Item Env:MEASURE, Env:MEASURE_BUILD` afterwards):

```powershell
npm run measure:build; if ($?) { $env:MEASURE="1"; $env:MEASURE_BUILD="production"; npx playwright test e2e/slice-04a/S4A-14-elements.spec.ts }
```

Passed (24.6 s). Counts in `test-results/S4A-14-elements.json`:

| View | Whole page, slice-03b → 4a | `.react-flow__viewport`, slice-03b → 4a |
| --- | --- | --- |
| 100 %, frames expanded | 20,721 → 20,726 (+5) | 19,295 → 19,295 |
| 30 %, frames expanded | 5,924 → 5,929 (+5) | 4,498 → 4,498 |
| 100 %, frames collapsed | 6,237 → 6,242 (+5) | 4,905 → 4,905 |
| 30 %, frames collapsed | 2,795 → 2,800 (+5) | 1,463 → 1,463 |

Every viewport count is identical. The whole page has five more elements in every view, all outside the canvas: a
one-off dump of every element outside the viewport (30 %, collapsed) on both measurement builds (`slice-03b` in
`../infomapper-ab-main`, and this branch) differs in exactly these:

- the left panel's third tab, `button#tab-requirements` (1);
- the status bar's “Requirements 0, covered 0” (`span#status-requirements` with its two `b`; 3; “Performance test”
  has no requirements);
- one more `<script>` in the head (1): the canvas page has five entry chunks instead of four (the panels' new client
  code; the editor itself still loads only with its dialog, step 2).

### Changed earlier tests (whole slice)

- `e2e/slice-01a/S1A-10.spec.ts`: the entity delete dialog has the requirements row, “4 requirements — lose it from
  their scope: REQ-101, REQ-102, REQ-103, REQ-105” (step 3, wording after step 3).
- No other earlier end-to-end test changed: none typed a definition, none relied on a go-to link doing nothing without
  a card, none counted change events or rows the seed's requirements changed.
- Unit tests: `entity.test.ts` and `attribute.test.ts` send rich text for definitions (step 2); `entity.test.ts`,
  `model-store.test.ts` (the delete impact's requirements), `requirements.test.ts` (imports `requirementsOf` from the
  index), `working-layer-store.test.ts` (data file format 5), `frame.test.ts` and `undo.test.ts` (the undoable rows include
  the two new tables), `permissions.test.ts`, the schema check's table list.

## Manual checklist (Łukasz)

Fresh demo data in the preview file, then the app on it:

PowerShell:

```powershell
$env:INFOMAPPER_DEV_DB=".data/preview-db.json"; npm run reset-dev-data; npm run dev
```

bash:

```bash
export INFOMAPPER_DEV_DB=.data/preview-db.json && npm run reset-dev-data && npm run dev
```

Sign in at http://localhost:3000/sign-in as **Łukasz**; open Retail Co – DWH → Customer 360 → Customer & orders.

| # | Steps | Expected |
| --- | --- | --- |
| 1 | Open the left panel's **Requirements** tab. Look at the status bar. | Five groups (Business need … Non-functional), REQ-101 to REQ-105, each with a coverage bar (hover: “5 of 8 attributes covered” on REQ-101). Status bar: “Requirements 5, covered 2”. |
| 2 | On the Customer card click the row **segment_code**; in its panel, Requirements → “Link to a requirement…” → **+ New requirement…**. Type `Customer segment`, Enter. | REQ-106 opens, Data requirement, Draft, Should, the name selected; after Enter the name is saved. Traces to: `Customer.segment_code`, attribute. Coverage 0 / 1, gap “Customer.segment_code unmapped”. |
| 3 | Description → **Edit**. In “Data needed” type a sentence with one bold word (Ctrl+B), then **Ctrl+Enter**. | The editor opens with the Data requirement template (seven headings, grey hints). After Ctrl+Enter: “Saved.”; the panel shows only “Data needed” with your sentence, the word bold; the other headings and hints are gone. |
| 4 | Open **Customer** (Model tab). Then open the project home (Customer 360 in the breadcrumbs). | Customer's Requirements section lists REQ-106 “via attribute”. Home: “6 requirements, 2 covered”; REQ-106 with “0/1, Draft”. A click on it opens Customer & orders with REQ-106's panel. |
| 5 | Drag the column **customers.segment** onto **segment_code** on the Customer card. Open REQ-106 again (Requirements tab). | A mapping is made (draft). REQ-106: coverage 0 / 1, gap “Customer.segment_code not approved”. |
| 6 | Click the gap, then the mapping under “Comes from”; set its status to **Approved**. Open REQ-106 again. | REQ-106: 1 / 1, no gaps, its bar full. Status bar: “Requirements 6, covered 3”. |
| 7 | In REQ-106's panel click **Delete requirement**, then **Undo** in the toast. | “Deleted REQ-106. The model elements it traced to are untouched.”; REQ-106 leaves the tab and segment_code's section. After Undo it is back with its description and its link. |
| 8 | Sign in as **Piotr Wiśniewski**, open REQ-103; then as **Kasia Zielińska**. | Piotr: only Status can be changed (every other field read-only, no Edit, no ×, no Delete, no “New requirement”). Kasia: nothing can be changed. |

## Łukasz's answers to step 0 (13 October)

1. **Migration: approved.** The key is unique among non-deleted requirements, case-insensitively (a unique index on
   `lower(key)` per workspace `where deleted_at is null`). `severity` is allowed for every kind (`warn`, `block` or
   null); the domain decides when to show it. New rule: undoing a requirement's delete when its key is used by
   another requirement by then is refused with “REQ-104 is used by another requirement now, so the deleted one cannot
   come back.” (unit test and adapter check). `docs/data-model-v2.md` is updated in this pull request, with the
   migration (step 1).
2. **Go-to links: approved**, the new selection that names an element without a card, with the helpers falling back
   to it. It only opens the element's panel: no pan, no card added, no canvas switch. The slice 1a limitation leaves
   `docs/known-limitations.md` in the step that builds it; every changed earlier test is listed below.
3. **“Only what this project uses”** on the Requirements tab follows the project home's rule (PRD item 30); with
   “on this canvas” also on, that filter wins.
4. **Wording table: approved** as proposed, including case-insensitive keys.
5. **S4A-14 baseline:** run on 13 October (below); it counts elements, so no laptop preparation.
6. **`docs/decisions.md`: approved** and applied (`0887e4b`): AD-05 “Reviewers change a requirement's status only.”;
   AD-06 “For requirements, setting Agreed is the approval; the author is whoever last changed its content (kind,
   name, description, expression, severity).”

The PRD carries these answers (`dc094bc`, section 7a and items 2, 4, 9, 10, 20, 27).

## Step 0 (13 October)

- `git remote -v`: `origin https://github.com/LukaszWolski-DA/infomapper-app.git`. `main` = `origin/main` =
  `slice-03b` = `a10899c` (merge of pull request #10). Branch `slice/04a-requirements` made from it; the PRD is
  committed as `docs/prd/slice-04a-requirements.md` (`d3ee4f7`).
- **handlebars:** unchanged. `eslint-plugin-boundaries` is still 7.2.0 (last change 9 August 2026) and
  `@boundaries/elements` 3.1.1 still pins `handlebars` 4.7.9. Per Łukasz's decision of 13 October the override comes as
  a separate small pull request from 19 October (`docs/known-limitations.md`); nothing changes in this slice.

### Answers to section 7

**Q1. Migrations.** `requirement`, `requirement_link`, `workspace.requirement_key_next` (default 101) and
`canvas_item.requirement_id` (with its “exactly one target” check and the unique index per canvas) are all in
`supabase/migrations/20261002000000_initial_schema.sql` (lines 52, 306–365, 501–526); RLS is on for both tables
(`20261002000100_enable_rls.sql`). The local adapter does not have the two tables yet (`src/data/local/schema.ts:240`
says so; the domain types have `requirement_key_next` and `CanvasItem.requirement_id` only). Two differences from this
PRD:

1. **The key index counts deleted rows.** `requirement_key_uq on requirement (workspace_id, key)` has no
   `where deleted_at is null`, but item 2 says unique among non-deleted requirements. A deleted REQ-104's key could
   not be used again, and an undo of a delete could collide. **Proposed:** a new migration that replaces it with a
   partial unique index `… where deleted_at is null` (as `mapping_input_uq` and the canvas item indexes do), and the
   data model's line for `key` says “among non-deleted rows”.
2. **The severity check forbids item 4.** `requirement_severity_ck` is `severity is null or (kind = 'dq_rule' and
   severity in ('warn', 'block'))`, so changing REQ-103 from Data quality rule to Business rule while keeping its
   severity (item 4, S4A-03) would break the check. **Proposed:** the same migration relaxes it to `severity is null
   or severity in ('warn', 'block')`; the data model's note for `severity` becomes “shown for `dq_rule`; kept when the
   kind changes”.

No other change: `requirement_link` has no unique index per target, and the domain refuses a second link (“Already
linked.”, item 6), as `label_link` does. The local adapter gets both tables with the same rules (exactly one target,
the partial unique key, the FKs) and the data file format goes up by one; older files are read with no requirements.

**Q2. Sanitizer.** Nothing exists yet; entity and attribute definitions are stored today through
`plainTextPair` (`src/domain/model/plain-text.ts`: escaped text as `<p>`/`<br>`, the text as it was). **Proposed:**
`src/domain/model/rich-text.ts`, a pure function `sanitizeRich(html) → { html, text }` with the allow-list of item 11,
`finalizeRich`'s clean-up and the plain-text derivation, built on **`htmlparser2` 12.0.0** (MIT, pure JavaScript and
ESM, no DOM, published 20 March 2026; dependencies `domhandler`, `domutils`, `domelementtype`, `entities`). It is
small enough for the domain, and the lint rules let the domain import external packages (`eslint.config.mjs:31`).
`sanitize-html` (2.17.7) was the alternative; it brings `postcss` and more, and its allow-list model does not do
item 11's “drop with content” list and the class rule more simply than our own walk. The function runs in every
command that stores a `*_html` (requirement description, entity and attribute definitions), whatever the client sent.

**Q3. Four-eyes author.** Mappings read it from the change log, not from `updated_by`:
`lastContentEditor(mapping, events)` in `src/domain/model/mapping-rules.ts:41` takes the latest `change_event` that
created the mapping or changed its kind or rule, or any of its `mapping_input` events; without one (seeded data) the
creator is the author. The action passes it in (`src/app/_actions/mapping.ts:107`), the canvas page computes it for the
panel's hint (`src/app/w/[workspaceId]/p/[projectId]/c/[canvasId]/page.tsx:97`), and `checkFourEyes` refuses
(`mapping-rules.ts:63`). **Proposed:** `lastRequirementEditor(requirement, events)` the same way: the latest event that
created the requirement or changed `kind`, `name`, `description_html`, `expression` or `severity`; the creator when
there is none. Status, priority, owner, reference, parent, key and links do not count.

**Q4. Left panel.** No placeholder: `src/app/_panels/left-panel.tsx:46` has `type Tab = "model" | "sources"` and the
header comment (line 7) says “The Requirements tab comes with requirements.” The open tab is component state (not
kept). Fold state is a browser preference: the set of folded group keys in `localStorage` under
`infomapper:tree-shut` (`SHUT_KEY`, line 42) through `readPreference`/`writePreference`; “Only on this canvas” and
“Only what this project uses” are preferences beside it. The Requirements groups get keys of their own in the same
set (`req:{kind}`), so folding survives a reload as in S4A-01. **Open:** the PRD says nothing about “Only what this
project uses” on the Requirements tab. Proposed: it keeps the requirements whose scope has an entity or table on one of
the project's canvases, the same rule as the project home's list (item 30).

**Q5. Entity delete dialog.** `src/app/_panels/delete-entity-dialog.tsx:54` shows five rows: attributes, mappings
(with the approved count), relationships, canvases, projects (from `entityImpact`, `src/domain/model/impact.ts`).
Nothing about requirements. The prototype's dialog has a row “{n} requirement(s) — lose this from their scope:
REQ-101, REQ-102” for every requirement whose scope contains the entity. **Proposed:** that row, after canvases and
before projects, with the prototype's wording, from the domain's scope function; `–` when there are none.

**Q6. Go-to links.** The panels use `goEntity`, `goAttribute`, `goMapping`, `goTable`, `goColumn` from the panel
context (`src/app/_panels/inspector.tsx:82–146`). They select the card or its row on the open canvas (and centre a
card); **when the card is not here they do nothing**, except `goMapping`, which selects the mapping by itself. This is
the accepted limitation “Panel links only reach rows whose card is on this canvas”
(`docs/known-limitations.md`, slice 1a). Item 27's “otherwise its panel opens” needs what that entry calls “Later”: a
selection that names an element without a card (`src/canvas/line-data.ts:117`; slice 3a added `{ t: "label" }` the
same way). **Proposed:** add `{ t: "element"; kind: "entity" | "attribute" | "source_table" | "source_column"; id }`,
nothing selected on the canvas, the element's panel in the right panel (the panels read the model, not the card), and
let the five go-to helpers fall back to it. This also lifts the slice 1a limitation for every existing panel link;
the limitation entry is updated. The alternative is to leave the fallback out and keep item 27 to cards on the open
canvas; that would change S4A-08 and S4A-09.

**Q7. Seed names.** Every name of item 15 exists in `src/data/local/seed-model.ts`: Customer's `first_name`,
`last_name`, `email`, `birth_date` (lines 54–57), Sales Order's `total_amount` (74), Order Line's `quantity`,
`unit_price`, `discount_pct` (82–84). The definition of done's `segment_code` (58) and `customers.segment` (102) exist
too. Nothing to replace. The descriptions are the prototype's (`infomapper-model-prototype.html:1075–1079`), stored
as one paragraph each.

**Q8. Tiptap.** Not installed (dependencies: `@xyflow/react`, `radix-ui`, `zod`, …). The newest release older than 14
days is **3.31.3** (4 September 2026; 3.32.0 came out today). Proposed, all pinned to `3.31.3`: `@tiptap/react`,
`@tiptap/pm`, `@tiptap/starter-kit` (paragraph, bold, italic, lists, hard break, heading, link, undo history; the parts
we do not offer — strike, code, code block, blockquote, horizontal rule, underline — switched off),
`@tiptap/extension-superscript`, `@tiptap/extension-subscript`; the four colours are a small mark of our own that
renders `<span class="tc-…">`, and the template hints a decoration (never in the document). **Loading:** the dialog's
editor is a `next/dynamic` import (`ssr: false`) loaded on the first open, so the canvas page's first load gets none of
it; step 2 reports the canvas page's first-load JavaScript before and after from `next build`, and the editor chunk's
size (not measured yet: the packages are not installed in step 0).

### Messages the PRD leaves open (proposed wording)

| Where | Proposed |
| --- | --- |
| Empty key | “Enter a key.” (as `nameSchema`'s “Enter a name.”, `src/domain/validation.ts:10`) |
| Empty name | “Enter a name.” (existing) |
| Linking to an element or requirement that was deleted meanwhile | “That element no longer exists.” / “That requirement no longer exists.” |
| Unlinking a link that is already gone | “Already unlinked.” (no write) |
| Setting the status it already has, or a field to its value | nothing (no write, no toast), as the panels do today |
| Four-eyes hint in the requirement panel (as the mapping panel's `note-four-eyes`) | “You changed REQ-103 last, so someone else has to agree it.” shown above Status while four-eyes is on and the person is the author; Agreed stays clickable and the domain refuses with the same text |
| Entity delete dialog | “{n} requirement(s)” — “lose this from their scope: REQ-101, REQ-102” (prototype) |
| Left panel search with no match on the Requirements tab | “Nothing matches “{q}”.” (existing) |
| Requirements tab without any requirement | “No requirements yet.” followed by “New requirement” for those who may edit |
| “+ New requirement…” and “New requirement” | no toast (prototype: the panel opens with the name selected) |
| Save in the editor with nothing changed | closes, no write, no toast |

### Other things step 0 found

- **Key comparison.** Proposed: keys are trimmed and compared case-insensitively for uniqueness (`req-104` is taken
  when REQ-104 exists), stored as typed. The counter only looks at keys of the form `REQ-{number}`.
- **The undo of a model delete** replays the whole change group, so once the delete commands put the
  `requirement_link` rows into their write set (as they do for mappings and label links today), undo restores them;
  item 10 needs the cascade, not a new undo mechanism.
- **The context (item 14)**: requirement and requirement link objects are not label targets, so
  `completeLiveWrites` labels nothing for them; their events record the context like layout writes do today.

### S4A-14 baseline: elements on `slice-03b` (13 October)

`e2e/slice-03b/S3B-15-elements.spec.ts` in the measurement build of `slice-03b` (`a10899c`) in `../infomapper-ab-main`
(`npm ci`, `npm run measure:build`, then `MEASURE=1 MEASURE_BUILD=production npx playwright test
e2e/slice-03b/S3B-15-elements.spec.ts`), no other server running. Counts in
`.data/measure/s4a14-baseline/slice-03b.json`.

| View | Whole page | `.react-flow__viewport` |
| --- | --- | --- |
| 100 %, frames expanded | 20,721 | 19,295 |
| 30 %, frames expanded | 5,924 | 4,498 |
| 100 %, frames collapsed | 6,237 | 4,905 |
| 30 %, frames collapsed | 2,795 | 1,463 |

The viewport counts equal slice 3a's and slice 3b's step 3. The whole page has 24 / 10 more elements than at 3b's step 3:
step 4's notes in the Overview's miniature, outside the viewport. At step 5 the same spec runs on this branch with
`ELEMENTS_BASELINE=.data/measure/s4a14-baseline/slice-03b.json`; every viewport count must be identical.

## Łukasz's answers after step 1 (13 October)

Step 1 accepted. Item 7: option 1, coverage follows `checkMappingTypes`; PRD item 7 and S4A-08 updated (`2146100`). The
cycle message reworded (assumption 3); the key counter under two creates (assumption 14); splitting a mapping
(assumption 13).

## Step 1 (domain and data, 13 October)

PRD items 1–15, no screens. Commits `b97d022` (dependency), `46cde25` (domain), `5a42186` (adapter, migration, seed,
delete actions), `c06e65f` (data model).

- **Domain.** `src/domain/types.ts` (`Requirement`, `RequirementLink`, the closed lists);
  `src/domain/model/requirements.ts` (names of kinds, statuses and priorities; key counter `nextRequirementKey`,
  `requirementWithKey`; `withDescendants`, `canBeParent`; `requirementScope`, `requirementCoverage`,
  `countsForCoverage`; `requirementsOf` with “via entity / attribute / column”; `lastRequirementEditor`; the
  messages); `src/domain/model/rich-text.ts` (`sanitizeRich`, on `htmlparser2` 12.0.0, pinned);
  `src/domain/commands/requirement.ts` (`createRequirement` with an optional link, `updateRequirement` one field,
  `setRequirementStatus` with four-eyes, `deleteRequirement`, `linkRequirement`, `unlinkRequirement`,
  `softDeleteRequirementLinks`); permissions `requirement.edit` (owner, admin, modeler) and `requirement.set_status`
  (and reviewer) with the PRD's two refusals; undo (`commands/undo.ts`) and the undo history's wording
  (`model/change-label.ts`: Create, Rename, Delete requirement, Link and Unlink requirement, Set requirement status).
- **Cascade (item 10).** Deleting an entity, an attribute, a mapping or a source table (with its columns) soft-deletes
  the requirement links on them in the same change group; merging mappings moves the links of the mappings that go to
  the one that stays, as labels do (D-24). The server actions for these deletes pass the links (`src/app/_actions/model.ts`,
  `mapping.ts`); no screen changed.
- **Data.** `src/data/ports.ts` (`RequirementRepository`, `changeEvents.listForRequirement`);
  `src/data/local/schema.ts` (both tables with the schema's rules: key unique by `lower(key)` among live rows, kind,
  status, priority, severity for any kind, not its own parent, exactly one link target, the foreign keys;
  `canvas_item.requirement_id` now a foreign key, requirement cards still refused until 4b); data file **format 5**
  (a format-2 to 4 file is read with the missing tables empty); `src/data/local/store.ts`; `tests/schema` lists both
  tables as built.
- **Migration** `supabase/migrations/20261013200000_requirement_key_and_severity.sql`: `requirement_key_uq` on
  `(workspace_id, lower(key)) where deleted_at is null`; `requirement_severity_ck` for any kind. `docs/data-model-v2.md`
  updated (key, severity, the counter, the domain rules).
- **Seed** `src/data/local/seed-requirements.ts`: REQ-101 to REQ-105 in “Retail Co – DWH” as item 15, 13 links,
  `requirement_key_next` 106, no requirement card; “Performance test” unchanged.
- **Tests.** `npm test`: 899 tests in 60 files (820 before): `model/requirements.test.ts` (19), `model/rich-text.test.ts`
  (11), `commands/requirement.test.ts` (26), `data/local/requirement-store.test.ts` (11), and additions to
  `permissions.test.ts`, `change-label.test.ts`, the schema test. `npm run lint` and `npm run typecheck` pass.
- **End-to-end.** The seed and the delete actions change under every earlier test (requirements in the demo data,
  requirement links deleted with their elements), so the full suite ran once on `c06e65f`, no dev server running:
  141 passed (26.1 min), no retries.

### The seed's coverage (the end-to-end tests use these figures)

`requirement-store.test.ts` checks them on the demo data.

| Requirement | Covered / in scope | Mapped, not approved | Not mapped | Covered |
| --- | --- | --- | --- | --- |
| REQ-101 Single view of the customer (Customer) | 5 / 8 | birth_date, created_at | segment_code | no |
| REQ-102 Contact data for every active customer | 3 / 3 | – | – | yes |
| REQ-103 E-mail is unique per customer | 1 / 1 | – | – | yes |
| REQ-104 Order total equals the sum of its lines | 1 / 4 | – | quantity, unit_price, discount_pct | no |
| REQ-105 Personal data is encrypted at rest | 3 / 4 | birth_date | – | no |

Status bar: **“Requirements 5, covered 2”.** As expected from the prototype, REQ-104 and REQ-105 are not covered. Where
the app's seed differs from the prototype's: Customer has eight attributes here (`customer_number` and `created_at`
too), so REQ-101's scope is 8; `birth_date` (from `dob`) and `created_at` (a transformation) are in review, not approved;
Order Line's `quantity`, `unit_price` and `discount_pct` have no mapping in the seed (only `product_id` does), so REQ-104
is 1 / 4.

### Question for Łukasz (answered: option 1)

**A type conflict on one input of an approved composite mapping (item 7, S4A-08, your test list).** The app's type
check (`checkMappingTypes`, `src/domain/model/type-check.ts:131`, the mapping panel's) treats a transformation with a
rule as handling the conversion, so it never reports a conflict for it; and a composite mapping always has a rule
(AD-26, D-49). So “an approved composite mapping with a type conflict on one input” cannot occur with today's rule, and
coverage counts such a mapping as covering. Coverage uses the panel's check, so the panel and the coverage never
disagree; the unit tests show the composite case with a rule (covered) and without a working rule (a gap). Options:

1. **Keep it** (proposed): coverage follows the mapping panel's type check; S4A-08's composite case becomes “a direct
   approved mapping with a type conflict is a gap”, and the composite case shows that every input is checked when the
   rule is missing (unit test only, since the app refuses to save such a mapping).
2. **Check every input regardless of the rule** for coverage only: the panel says “the rule handles the conversion”
   while the requirement lists the attribute as not approved. This changes the meaning of the type check, so it would
   need a decision.

### Assumptions (step 1)

1. **The key counter is never wound back.** Creating a requirement raises `workspace.requirement_key_next` in the same
   write; undoing the creation removes the requirement but keeps the counter, so a key is not given out twice (REQ-106
   undone, the next one is REQ-107). The counter's write alone is not an undo step. It also raises the workspace row's
   version, so a workspace settings change open at the same moment is refused as stale.
2. **Undoing a key change back to a key someone took meanwhile** is refused with “REQ-104 is already used by another
   requirement.”; bringing back a deleted one with item 9's message.
3. **Cycle message** (Łukasz, after step 1): choosing REQ-104 as the parent of REQ-101, which REQ-104 is already part
   of, says “REQ-104 is already part of REQ-101, so REQ-101 cannot be part of it.” Choosing itself: “A requirement
   cannot be part of itself.”
4. **Merging mappings** moves the requirement links of the mappings that go to the one that stays, without a second link
   (as labels, D-24); the PRD does not say.
5. **Demo requirements only in “Retail Co – DWH”.** “Sales analytics” has the same model but no requirements.
6. **Lengths:** key up to 40 characters, name 300, owner and reference 2,000, expression 5,000, description 100,000.
7. **Keys** are stored trimmed as typed and compared trimmed and case-insensitively; the counter only reads
   `REQ-{number}`.
8. **Reviewers' undo:** a reviewer can undo their own status change; nothing else (their other writes are refused
   anyway).
9. **Sanitizer:** `b`, `i` and `div` become `strong`, `em` and `p`, as in the prototype; a table or another block element
   closes the paragraph before it, as in a browser, and its cells keep their text.
10. **The context:** requirement and link writes are not label targets, so the context records itself on their events
    and labels nothing; with the context's label deleted they are saved without the context (the slice 3b rule for
    writes it would not label).
11. **The entity delete dialog's requirements row** (item 10, Q5) comes with the panels in step 3; step 1 has the scope
    function it needs.
12. **Columns** are deleted only with their table today, so a column's links go with its table's delete.
13. **Splitting a mapping** writes no requirement link: the links stay on the mapping that keeps its id; the new direct
    mappings get none (Łukasz confirmed; `requirement.test.ts`).
14. **Two creates at the same moment** both succeed with different keys: the browser sends no workspace version for a
    create, so a create whose counter write comes back stale is built again from fresh data, at most three times
    (`runCommand`'s `freshOnStale`, `src/app/_lib/fresh-retry.ts`; `fresh-retry.test.ts` runs two creates read at the
    same moment against the local adapter: REQ-106 and REQ-107, counter 108). A settings dialog open at that moment is
    refused as stale (Łukasz: fine).

## Step 2 (rich-text editor, 13 October)

PRD items 16–19. Commits `db9d0dd` (Tiptap), `2cdd5d3` (editor, definitions).

- **Dependencies:** `@tiptap/core`, `@tiptap/pm`, `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extensions`,
  `@tiptap/extension-superscript`, `@tiptap/extension-subscript`, all pinned to **3.31.3** (4 September 2026).
  `fast-equals`, which `@tiptap/react` asks for as `^5.3.3`, resolved to 5.4.4 (8 October, younger than 14 days); an
  `overrides` entry keeps it at 5.4.3 (20 September) under `@tiptap/react` only. `npm audit` unchanged (the 12 findings
  in `braces` and `handlebars`).
- **Editor** (`src/ui/rich-text/`): `extensions.ts` (the schema: StarterKit without code, code block, blockquote,
  horizontal rule, strike and underline, headings h4 only, links http/https/mailto opened in a new tab; superscript,
  subscript; a colour mark that renders `<span class="tc-…">`; the template hint as a paragraph attribute shown by the
  placeholder decoration); `rich-text-editor.tsx` (toolbar as the prototype: Bold, Italic, the four colours, Clear
  formatting, Link with the inline URL field, bulleted and numbered list, superscript, subscript, “Insert template” on
  the right for requirement descriptions; footer “Ctrl + Enter saves, Esc cancels”, Cancel, Save; the unsaved-changes
  warning; an empty description opens with its kind's template and the cursor in the first empty section);
  `rich-text-dialog.tsx` (the dialog: subtitle and title, the editor loaded with `React.lazy` the first time a dialog
  opens; every key event stops at the dialog, so Delete, Ctrl+Z, arrows, Space, E and H never reach the canvas or the
  app's undo; a click outside counts as Cancel, as in the prototype); `rich-text-field.tsx` (the panel field: the text
  formatted and shortened, “Edit”, “Show more” only when cut, a click opens the editor; empty shows the hint; without
  edit rights no “Edit” and a click opens nothing; Save toasts “Saved.”).
- **Templates** (`src/domain/model/requirement-templates.ts`): the prototype's `RTEMPLATES` per kind and `templateHtml`.
  The requirement panel that uses them comes in step 3.
- **Definitions:** `updateEntity` and `updateAttribute` take rich text and sanitize it (`sanitizeRich`); the entity and
  attribute panels use the field (“What this entity means for the business. Click to write it.”, “… this attribute …”,
  dialog subtitle “Entity definition” / “Attribute definition”, title the entity's name / `Entity.attribute`). Plain
  definitions stored before were already kept as paragraphs (`plainTextPair`), so they open as their paragraphs. Notes
  stay plain text.
- **Tests:** `npm test` 907 in 62 files (899 before; `requirement-templates.test.ts`, the two definition tests now send
  rich text); lint and typecheck pass.
- **End-to-end:** the full suite once on `2cdd5d3`, no dev server running: 141 passed (32.8 min), no retries.

### Bundle sizes (`next build`, Turbopack)

Next 16 no longer prints first-load sizes, so they are summed from the build's manifests: the root chunks plus the
canvas route's entry chunks (`page_client-reference-manifest.js`), raw and gzip (level 9).

| | Canvas page first-load JS | Editor chunk (loaded on first open) |
| --- | --- | --- |
| Before (`de241a0`) | 1,059.7 KiB raw, 321.7 KiB gzip (8 files) | – |
| After (`2cdd5d3`) | 1,063.2 KiB raw, 322.9 KiB gzip (8 files) | 386.5 KiB raw, 120.6 KiB gzip (one chunk) |

The first load grows by 3.5 KiB (1.2 KiB gzip): the field and the dialog shell. No first-load chunk contains
ProseMirror or Tiptap, and no browser chunk contains the server's HTML parser.

### Checked in the browser (dev server, fresh seed)

As Łukasz on “Customer & orders”, Customer's definition: the editor opens with the stored paragraph and the cursor at
the end; typing E, H, Space, arrows, Delete and Ctrl+Z in it leaves the canvas alone (tool, cards and selection
unchanged; Ctrl+Z undoes inside the editor); bold, a colour and a link (“example.com/crm” → `https://example.com/crm`)
save with Ctrl+Enter and the toast “Saved.”; one Ctrl+Z on the page brings the previous text back (“Undone: Change
entity”); Esc with changes shows the warning, the second Esc discards. A paste of Word-like HTML (an h1, inline styles,
underline, strike, a table, an image, a `javascript:` link, a blockquote, `pre`) keeps only bold, the list and the safe
link, the rest as plain text. As Piotr: the definition shows formatted, no “Edit”, a click opens nothing. No console
errors.

### Changes to earlier tests

- No earlier end-to-end test types a definition (none uses the old definition textarea), so none changed.
- Unit tests: `entity.test.ts` and `attribute.test.ts` send rich text for the definition and check the sanitized result.

### Assumptions (step 2)

1. **The panel shows the stored HTML as the server sanitized it**, without sanitizing it again in the browser, so the
   HTML parser stays out of the browser bundle (AD-17 puts the sanitizing on the server).
2. **Ctrl+Z inside the editor** undoes in the editor (its own history); outside, the app's undo takes the whole save as
   one step.
3. **Save with nothing changed** closes the dialog, no write and no toast (wording table, step 0).
4. **A click outside the dialog** counts as Cancel (warning first when there are changes), as in the prototype.
5. **Lists** are stored as `<li><p>…</p></li>` (Tiptap's list items hold paragraphs); the sanitizer keeps it and the
   panel shows it as the prototype's lists.
6. **Text colours in dark mode** follow `prefers-color-scheme`, as the rest of the app (the prototype also has a manual
   theme switch the app does not have).
7. **The undo toast** names a definition save as the generic “Change entity” / “Change attribute”.

### Not matched from the prototype's editor

- **Clear formatting** also removes a link in the selection; the prototype's `removeFormat` keeps links.
- **A line break typed at the very end of a paragraph** (Shift+Enter) is stored as typed (`<br>` before `</p>`); the
  prototype's `finalizeRich` keeps it too, but its browser editor rarely produced it.
- **The prototype's `<font color>`** from `execCommand` is not read on paste (the app never stored it).

## Łukasz's answers after step 2 (13 October)

Step 2 accepted. (1) Server-sanitized HTML shown without a browser sanitizer: approved, provided every write path goes
through the server; checked below. (2) Clear formatting keeps links: fixed. (3) A click outside the dialog with unsaved
changes warns first: confirmed, and fixed so the focus stays in the text (below). (4) Record each e2e run's time in step
5; above 30 minutes, find the cause before the merge. (5) The `fast-equals` override is in `docs/known-limitations.md`
with a review date (22 October 2026). (6) A trailing line break stored as typed: accepted (assumption 8 of step 2).

**Every write of a `*_html` column** goes through `sanitizeRich` (entity and attribute definitions, requirement
descriptions) or `plainTextPair`, which escapes plain text into paragraphs (notes, mapping notes, attributes made from
a column's comment, the seeds). The panel field shows `shownHtml(html, text)`: the stored HTML, or for a row with only
its plain text, that text escaped; `plain-text.test.ts` checks `a < b & <img src=x onerror=alert(1)>` both ways (stored
before slice 4a as escaped paragraphs, and as plain text only).

**Point 3 in the browser:** a click outside the dialog with unsaved changes shows “Unsaved changes. Press Esc or Cancel
again to discard them.” and keeps the dialog open, as Esc and Cancel do. The click had taken the focus to the page,
so a key typed next would have reached the canvas and Ctrl+Enter did nothing; now the editor takes the focus back and
Ctrl+Enter saves from anywhere in the dialog (a Delete typed after the click went into the text, the canvas kept its
four cards).

## Step 3 (requirements in the panels, 13 October)

PRD items 20–29, the entity delete dialog's requirements row (item 10, Q5) and the go-to links' fallback (item 27, Q6).
Commit `5db0c92`.

- **Requirement index** (`src/domain/model/requirement-index.ts`): built once per data version from the requirements,
  their links and the model: live requirements in the left panel's order, each one's live links, scope, coverage and
  children, and for every element its direct and indirect requirements. The server builds it once per page for the
  left panel's rows (`tree-data.ts`); the right panel builds it once per data version in the browser (`useMemo` on the
  server's arrays) and every panel reads from it; nothing works out a scope while rendering. Scope and coverage share
  one model lookup (`lookupModel`), so each attribute's coverage state is worked out once.
- **Left panel** (`left-panel.tsx`): a third tab Requirements; groups by kind (Business need, Data requirement, Business
  rule, Data quality rule, Non-functional) with the diamond dot and count, folding remembered with the other groups
  (`req:{kind}`); rows with the kind icon, key, name and coverage bar (tooltip “{ok} of {total} attributes covered”);
  search by key and name; “Only what this project uses” keeps requirements whose scope has an entity or table on one of
  the project's canvases; “Only on this canvas” shows “No requirement has a card on this canvas yet.” and wins; without
  any requirement “No requirements yet.”; “New requirement” for owner, admin and modeler. A click opens the
  requirement's panel; rows are not dragged.
- **Requirement panel** (`requirement-panel.tsx`): as item 23–26; refusals put the stored value back in the field;
  “Part of” offers None and every requirement that is not this one or below it; the coverage grid and the gaps
  (unmapped first, then not approved; a click goes to the attribute); Traces to with each element's type, a mapping as
  `column → Entity.attribute`, × to unlink; “Delete requirement” (toast with Undo).
- **Element panels** (`requirements-section.tsx`): entity, attribute, mapping, table and column get a Requirements
  section: direct rows with ×, indirect rows with “via entity / attribute / column”; “Link to a requirement…” lists every
  requirement not linked directly, then “+ New requirement…”, which creates it linked to the element and opens its
  panel with the name selected. Toasts “Linked REQ-104 to the attribute.” (and the other nouns), “Unlinked.”
- **Delete dialog** (`delete-entity-dialog.tsx`, `impact.ts`): the row “{n} requirement(s) — lose this from their scope:
  REQ-…” after canvases, “–” when none.
- **Go-to fallback** (`inspector.tsx`, `line-data.ts`): two new selections, `{ t: "req" }` and `{ t: "element" }`;
  `goEntity`, `goAttribute`, `goTable` and `goColumn` select the card or row when it is on the open canvas, otherwise
  open the element's panel only: no pan, no card added, no canvas switch. Neither selection emphasises or fades any line
  (`relatedLines` returns nothing), so the canvas draws exactly what it drew before. Panels without a card hide what
  needs one (notes pinned to the card, its frame, “Remove from this canvas”, “Add all to this canvas”). Slice 1a's
  limitation “Panel links only reach rows whose card is on this canvas” is removed from `docs/known-limitations.md`.
- **Server actions** (`src/app/_actions/requirement.ts`): create (with `freshOnStale`), change a field, set the status
  (the author from the change log), delete, link, unlink.
- **Tests:** `npm test` 917 in 63 files (907 before): `requirement-index.test.ts` (the index agrees with computing each
  requirement alone), `tree-data.test.ts` (the tab's rows and filters), `plain-text.test.ts` (`shownHtml`), the impact
  tests. Lint and typecheck pass.

### Benchmark: building the index

`npx tsx scripts/bench-requirement-index.ts` (not part of `npm test`, not a gate): a synthetic model of 500 requirements
(five kinds, chains of parents), 5,000 attributes on 500 entities, 3,000 columns in 300 tables, 2,000 mappings (every
fifth a transformation with two inputs, a third of them drafts) and 3,000 links (entities, attributes, mappings, tables,
columns). 30 builds after a warm-up, on the laptop: **median 25.5 ms**, fastest 18.3 ms, slowest 40.8 ms (an earlier
run: median 23.7 ms).

### Checked in the browser (dev server, fresh seed)

As Łukasz: the tab lists REQ-101 to REQ-105 by kind with 5/8, 3/3, 1/4, 1/1 and 3/4; REQ-104's panel shows every field,
coverage 1 / 4 with three unmapped gaps and four traces; the canvas draws nothing differently. On “Order lines &
products” (no Customer card) REQ-102's trace `Customer.first_name` opens the attribute's panel without moving the view
or adding a card; its section lists REQ-102 and REQ-105 directly and REQ-101 “via entity”; “+ New requirement…” there
makes REQ-106 linked to `first_name`, its panel open with the name selected; the description opens with the Data
requirement template, and a save keeps only the written section. Customer's delete dialog lists “5 requirements — lose
this from their scope: REQ-101, REQ-102, REQ-103, REQ-105, REQ-106”. As Piotr: the status works, every other field is
read-only, no Edit, no ×, no Delete, no “New requirement”.

### End-to-end run and changed earlier tests (step 3)

The full suite once on `5db0c92`, no dev server running: **140 passed, 1 failed, 26.6 min** (wall clock 26 min), no
retries. The failure was expected: `e2e/slice-01a/S1A-10.spec.ts` checks the entity delete dialog's rows exactly, and
the dialog now has the requirements row. Changed: S1A-10 expects
“4 requirements — lose this from their scope: REQ-101, REQ-102, REQ-103, REQ-105” after the canvases row; run alone
afterwards it passes. No other earlier test depended on a go-to link doing nothing without a card. Unit tests changed:
`entity.test.ts` and `model-store.test.ts` (the impact's requirements), `requirements.test.ts` (imports
`requirementsOf` from the index).

### Assumptions (step 3)

1. **An element's panel without its card** hides what needs the card (notes pinned to it, its frame, “Remove from this
   canvas”, “Add all to this canvas”); a feeding source or fed entity clicked there is placed in a free spot of the
   view instead of beside the card. The prototype's “Add to this canvas” button for such a panel is not added (not in
   the PRD).
2. **“Link to a requirement…”** lists every requirement not linked directly, including those that reach the element
   indirectly (as the prototype).
3. **Link, unlink and delete** toast with Undo; “New requirement” and “+ New requirement…” toast nothing (step 0's
   wording).
4. **Kind and “Part of”** save as soon as they change (selects), as the other panels' selects do.
5. **The Requirements tab has no footer hint** (the Model and Sources tabs' “Drag onto the canvas …” does not apply).
6. **The delete dialog's requirements row** sits after canvases and before projects (the prototype has no projects
   row).
7. **Gaps** list unmapped attributes first, then those not approved (the prototype's order).

### Not matched from the prototype's panels

- The lens sentence under Coverage, “Place its card on this canvas” and dragging requirements (slice 4b, PRD).
- “Part of” in the prototype only leaves out the requirement and its direct children; the app leaves out everything
  below it (PRD item 5).
- The prototype's requirement rows in element panels say “Click to place its card next to this element”; here a click
  opens the requirement's panel (4b places cards).

## Łukasz's answers after step 3 (14 October)

Step 3 accepted, its assumptions too. Before step 4: the previous session ended with a background command running.
It was the Monitor that followed slice 3b's three e2e runs (`tail -f` on their progress file), not a build or a test;
no `node`, Playwright browser or `tail` process was left, ports 3000/3001/3200/3300 were free, the tree was clean at
`0a6b3c9`. Points, commit `b9d35d4`:

1. **The delete dialog's requirements row** (`requirementsImpactRow`, `src/domain/model/impact.ts`): “4 requirements” —
   “lose it from their scope: REQ-101, REQ-102, REQ-103, REQ-105”; one: “1 requirement” — “loses it from its scope:
   REQ-104”; more than five: the first five keys, then “and 3 more”; none: “–”. S1A-10 and `impact.test.ts` updated.
2. **`docs/ideas.md`:** “Add to this canvas” on a panel without its card, a candidate for 4b.
3. **`docs/known-limitations.md`:** “The requirement index is rebuilt on every write” (median 25.5 ms at 500
   requirements and 5,000 attributes), for the performance review: an incremental rebuild.

## Step 4 (project home, status bar, roles, four-eyes, 14 October)

PRD items 30–31 and 12–14 across the slice. Commit `eb4c456`.

- **Project home** (`page.tsx`, `_components/project-requirements.tsx`, `projectRequirements` in `stats.ts`): the
  statistic “{n} requirements, {m} covered” after the open notes, and a Requirements section between Canvases and
  Labels: every requirement whose scope has an entity or table on one of the project's canvases, with its kind icon,
  key, name, kind, coverage bar and “{ok}/{total}, {status}”; empty: “No requirement touches this project's canvases
  yet.” A click opens the project's last opened canvas, else its first, with `?req=<id>`, which opens the
  requirement's panel on arrival (`ModelCanvas`'s `focusRequirementId`, like `?label=`).
- **Last opened canvas** (`src/app/_lib/last-canvas.tsx`): a browser preference per project
  (`infomapper:last-canvas:{projectId}`), written when a canvas page opens; one that is no longer in the project falls
  back to the first canvas.
- **Status bar:** “Requirements {n}, covered {m}” after Relationships, for the whole workspace, from the server's
  requirement index; every write refreshes the page, so a mapping approved elsewhere changes it.
- **Roles across the slice:** owner, admin and modeler change everything; a reviewer only a requirement's status (every
  other field read-only, no Edit, no “Link to a requirement”, no ×, no Delete, no “New requirement”); a reader nothing;
  an archived workspace nothing (`standingOf`: archived means no edit and no status rights). The server refuses the
  same writes when sent directly (step 1's domain tests; S4A-11 in step 5).
- **Four-eyes** in the requirement panel: with four-eyes on, the person who last changed a requirement's content sees
  “You changed REQ-103 last, so someone else has to agree it.” above Status while it is not Agreed (the authors come
  from the change log, `lastRequirementEditor`, computed on the server only when four-eyes is on); Agreed stays
  clickable and the server refuses with the same message.
- **The working context:** requirement and link writes record it on their change events and label nothing (step 1's
  `completeLiveWrites` test; the action path is `runCommand` as for every write).
- **Tests:** `npm test` 920 in 64 files (917 before): `impact.test.ts`, `projectRequirements` in `stats.test.ts`.
  Lint and typecheck pass.
- **End-to-end:** the full suite once on `eb4c456`, no dev server running: **141 passed, 23.2 min** (wall clock 23
  min), no retries. No earlier test changed in step 4 (S1A-10's new wording came with the points above, `b9d35d4`).

### Checked in the browser (dev server, fresh seed, four-eyes on in the verify file only)

As Anna: the canvas status bar reads “Requirements 5, covered 2”; after opening Order management's “Order lines &
products”, the project home shows “5 requirements, 2 covered” and REQ-101 to REQ-105 with “5/8, Agreed”, “3/3, Agreed”,
“1/4, Draft”, “1/1, Draft”, “3/4, Agreed”; a click on REQ-103 opens “Order lines & products” (the last opened, not the
first) with REQ-103's panel; Anna, the seeded requirements' creator, sees the four-eyes hint, and Agreed is refused
with the same message (status stays Draft).

### Assumptions (step 4)

1. **The last opened canvas is remembered in the browser**, per project, like the other panel preferences; on another
   browser the first canvas opens.
2. **The project's statistic counts the requirements in its list** (prototype `projReqs`), the status bar the whole
   workspace's.
3. **The four-eyes hint** shows only to those who may set the status, and not once the requirement is Agreed.
4. **The seeded requirements' author is their creator (Anna)** for four-eyes until someone changes their content.

### Not matched from the prototype

- The prototype opens the canvas that shows most of the requirement's scope; the PRD (item 30) asks for the last opened
  canvas, else the first.
- The prototype's project home also counts requirement cards on the project's canvases; there are none until 4b.
