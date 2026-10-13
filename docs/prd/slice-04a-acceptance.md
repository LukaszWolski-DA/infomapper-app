# Slice 4a – Acceptance

Status: **step 0 done; waiting for Łukasz** (answers to the questions below, the S4A-14 baseline run). Branch
`slice/04a-requirements`, from `main` at the tag `slice-03b` (`a10899c`).

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

### S4A-14 baseline (not run yet)

The element counts on `slice-03b` with `S3B-15-elements.spec.ts` in the measurement build. Proposed commands, after
Łukasz has prepared the laptop, in `../infomapper-ab-main` (now at `slice-03a`, `8a52155`) as for S3B-15 (a); the tag
has the spec itself:

```bash
git -C ../infomapper-ab-main checkout --detach slice-03b
cd ../infomapper-ab-main && npm ci && npm run measure:build
MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-03b/S3B-15-elements.spec.ts
mkdir -p ../infomapper-app/.data/measure/s4a14-baseline && cp test-results/S3B-15-elements.json ../infomapper-app/.data/measure/s4a14-baseline/slice-03b.json
```

At step 5 the same spec runs on this branch with `ELEMENTS_BASELINE=.data/measure/s4a14-baseline/slice-03b.json`;
it must report identical counts.
