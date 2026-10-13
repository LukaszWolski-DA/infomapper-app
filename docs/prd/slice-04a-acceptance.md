# Slice 4a – Acceptance

Status: **step 1 done; waiting for Łukasz** (one question below). Branch `slice/04a-requirements`, from `main` at the
tag `slice-03b` (`a10899c`), pull request #11 (draft).

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

### Question for Łukasz

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
3. **Cycle message:** the PRD's sentence with the roles as they are: choosing REQ-104 as the parent of REQ-101, which
   REQ-104 is already part of, says “REQ-104 is part of REQ-101 already, so it cannot contain it.” Choosing itself:
   “A requirement cannot be part of itself.” (not in the PRD).
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
