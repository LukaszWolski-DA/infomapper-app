# Slice 4a – Requirements, step 1 (without the canvas)

Status: **draft for step 0**, 13 October 2026. Branch `slice/04a-requirements`. Starts from `main` at tag `slice-03b`.

## 1. Why this slice

Requirements are the business metadata the product exists for: needs, data requirements, business rules,
data-quality rules and non-functional requirements, traced to entities, attributes, mappings, tables and columns,
with coverage computed from the mappings (D-30, D-31). This slice brings the requirements layer into the application
**everywhere except the canvas**: the left panel, the requirement panel, the element panels, the project home and
the status bar, plus the rich-text editor that comes with requirements (D-42, D-44, AD-30).

Everything drawn on the canvas waits for slice 4b, which comes **after the performance review**: markers on cards,
the lens, requirement cards with trace lines and dragging a requirement onto an element (D-32, D-34). The lens uses
the same dimming as Focus (in the prototype `applyHighlight()` treats a selected requirement as Focus that is always
on), so it should be built on whatever the performance review decides. This slice must not change what the canvas
draws (criterion S4A-14).

Order agreed with Łukasz on 13 October 2026: **4a → performance review → 4b together with Focus**.

## 2. Sources

- Behaviour: `docs/prototype/infomapper-model-prototype.html`. Requirements code: `RKIND`, `RICON`, `RSTAT`,
  `RPRIO`, `reqScope`, `reqCoverage`, `reqsFor`, `reqTree`, `reqSection`, `insReq`, `newReq`, `linkReq`, the
  `req-del` handler, `projReqs` and the requirements part of `renderHome`, `renderStatus`. Editor: `#rte`,
  `openRichFor`, `richTarget`, `richField`, `sanitizeRich`, `finalizeRich`, `tryCancel`, `RTEMPLATES`,
  `templateHtml`, `insertTemplate`.
- Decisions: D-30, D-31, D-33, D-34 (panel part only), D-42, D-43, D-44, D-45, D-47, AD-05, AD-06, AD-11, AD-12,
  AD-13, AD-15, AD-17, AD-30.
- Data: `docs/data-model-v2.md` sections 3 (`workspace.requirement_key_next`), 7 (`requirement`,
  `requirement_link`) and 10 (`change_event`).

Where the prototype and this PRD differ, this PRD wins; the differences are listed in section 6.

## 3. What to build

### Domain and data

1. **Requirement** with the columns of `data-model-v2` section 7. Kinds `need`, `data`, `business_rule`,
   `dq_rule`, `non_functional` (shown as “Business need”, “Data requirement”, “Business rule”, “Data quality rule”,
   “Non-functional”); statuses `draft`, `agreed`, `implemented`, `verified` (“Draft”, “Agreed”, “Implemented”,
   “Verified”); priorities `must`, `should`, `could`, `wont` (“Must”, “Should”, “Could”, “Won't”).
2. **Key.** A new requirement gets `REQ-{requirement_key_next}` and the counter goes up by one. The key can be
   edited. It is unique per workspace among non-deleted requirements (AD-11); a duplicate is refused with
   “REQ-104 is already used by another requirement.” If the generated key is already taken (someone typed it),
   the counter skips forward to the next free number. An empty key or name is refused and the field shows the
   previous value (as the prototype does).
3. **Commands**, each one write with its `change_event` records and one undo step (AD-13): create (optionally with
   one link, for “+ New requirement…” in an element panel), update one field, set status, delete, link, unlink.
4. **Kind change** keeps `expression` and `severity` stored; they are shown only for the kinds that use them
   (Rule for `business_rule`, Check for `dq_rule`, “When it fails” for `dq_rule`). Severity defaults to `warn` when
   a requirement becomes a `dq_rule` and has none.
5. **Parent.** “Part of” may not create a cycle at any depth (the prototype only blocks itself and its direct
   children). Refused with “REQ-101 is part of REQ-103 already, so it cannot contain it.”
6. **Links** (`requirement_link`, exactly one target, AD-15) to an entity, attribute, mapping, source table or
   source column. A second link to the same target is refused with “Already linked.” (no write).
7. **Scope and coverage** (D-31), pure functions in `domain`, as in the prototype's `reqScope` and `reqCoverage`:
   - scope: linked entities with all their attributes; linked attributes with their entity; linked mappings with
     their attribute, its entity, every input column and its table; linked tables; linked columns with their table;
   - an attribute in scope is **covered** when it has at least one mapping with status `approved` that has no type
     conflict on **any** of its inputs (composite mappings, AD-26); **mapped, not approved** when it has mappings but
     none counts as covered; **not mapped** when it has none;
   - a requirement is covered when its scope has at least one attribute and all of them are covered. A requirement
     traced only to tables or columns has 0 attributes in scope and is not covered;
   - coverage is computed on read and never stored.
8. **Direct and indirect requirements of an element** (prototype `reqsFor`): an attribute shows its own links plus
   its entity's (“via entity”); an entity shows its own plus every requirement whose scope contains it
   (“via attribute”); a table shows its own plus every requirement whose scope contains it (“via column”); a column
   and a mapping show their own only.
9. **Delete** (prototype behaviour, no impact dialog): the requirement is soft-deleted, its links are deleted, its
   children become top level, model elements are untouched. One undo brings back all of it. Toast: “Deleted REQ-104.
   The model elements it traced to are untouched.”
10. **Deleting model elements** soft-deletes the `requirement_link` rows pointing at them in the same write, and the
    undo of that delete restores them. The entity delete dialog (D-47) lists the requirements whose links go
    (step 0 checks what it shows today).
11. **Rich text** (AD-17): the server sanitizes every `*_html` it stores, whatever the client sent, and derives
    `*_text` from it. Allow-list as the prototype's `sanitizeRich`: `p`, `br`, `strong`, `em`, `ul`, `ol`, `li`,
    `sup`, `sub`, `h4`, `a` (only `http:`, `https:`, `mailto:`; saved with `target="_blank" rel="noopener"`) and
    `span` with one of the classes `tc-warn`, `tc-attn`, `tc-ok`, `tc-info` (D-43). Everything else keeps its text
    and loses the element; `script`, `style`, `iframe`, `object`, `embed`, `svg`, `math`, `template`, `noscript` are
    dropped with their content. Template hints are never stored; headings followed by nothing are removed
    (`finalizeRich`). Empty content stores `null` in both columns.
12. **Permissions** (AD-05, AD-09), checked in the domain and shown in the UI:
    - owner, admin, modeler: everything in this slice;
    - reviewer: only the status of a requirement (that is their approval); nothing else;
    - reader: nothing; archived workspace: nothing;
    - refusals: “As a reviewer you can only change a requirement's status.”, “As a reader you cannot change
      requirements.”, the existing archive message.
13. **Four-eyes** (AD-06), when the workspace has it on: setting a requirement to **Agreed** is its approval. The
    person who last changed its content (kind, name, description, expression, severity) cannot set it to Agreed:
    “You changed REQ-103 last, so someone else has to agree it.” The author is read from `change_event` (step 0,
    Q3). Every status change is in `change_event` already, which is the approval log. Other statuses have no
    four-eyes rule. Editing an agreed requirement does **not** send it back to Draft in this slice (`ideas.md`).
14. **Active working context** (D-26): requirement writes and link writes record `context_label_id` in their events
    like any write, and label nothing. Requirements have no labels in this slice (`ideas.md`, moved to step 2).
15. **Demo data** (`npm run seed`, `reset-dev-data`, the e2e seed): the prototype's five requirements and links,
    matched to the seed's elements by name:
    - REQ-101 need “Single view of the customer”, agreed, must, owner “Head of CRM” → entity Customer;
    - REQ-102 data, part of REQ-101, “Contact data for every active customer”, agreed, must, “Data owner CRM” →
      Customer's `first_name`, `last_name`, `email`;
    - REQ-103 dq_rule, part of REQ-102, “E-mail is unique per customer”, draft, should, “Data steward”, check
      `COUNT(DISTINCT customer_id) per lower(email) = 1`, severity warn → `email`;
    - REQ-104 business_rule “Order total equals the sum of its lines”, draft, must, “Finance controller”, reference
      `JIRA-481`, rule `total_amount = SUM(quantity * unit_price * (1 - discount_pct / 100))` → Sales Order's
      `total_amount`, Order Line's `quantity`, `unit_price`, `discount_pct`;
    - REQ-105 non_functional “Personal data is encrypted at rest”, agreed, must, “DPO”, reference `GDPR` → Customer's
      `first_name`, `last_name`, `email`, `birth_date`;
    - descriptions as in the prototype, stored as one paragraph; `requirement_key_next` 106;
    - no requirement card on any canvas (the prototype's REQ-104 card comes in 4b); “Performance test” unchanged.
    Where a name does not exist in the app's seed, step 0 reports it and proposes the nearest element.

### Rich-text editor (D-42, D-44)

16. One editor dialog (Tiptap, AD-20) as the prototype's `#rte`: subtitle and title, toolbar (Bold, Italic, the four
    colours, Clear formatting, Link with an inline URL field, bulleted and numbered list, superscript, subscript),
    “Insert template” on the right for requirement descriptions only, footer “Ctrl + Enter saves, Esc cancels”,
    Cancel and Save. Esc or Cancel with unsaved changes first shows “Unsaved changes. Press Esc or Cancel again to
    discard them.”; the second press discards. Keys typed in the dialog never reach the canvas. Save is one undo step
    and toasts “Saved.”
17. **Templates** per kind as `RTEMPLATES` (section headings are content, grey hints vanish when typing and are not
    saved, empty sections are removed on save). An empty requirement description opens with its kind's template;
    “Insert template” appends it to existing text and puts the cursor in the first empty section.
18. **Where it is used in this slice:** requirement descriptions, entity definitions, attribute definitions. A plain
    text definition stored before this slice opens as paragraphs (blank lines split paragraphs, single line breaks
    become `<br>`). **Notes stay plain text** (section 6).
19. **In panels** (`richField`): the text shown formatted and shortened, with “Edit” and “Show more” when it is cut;
    a click on the text opens the editor; empty shows a hint (“No description yet. Click to write it; a business
    rule template guides you.” for requirements, the prototype's wording for definitions). Reviewers and readers see
    the text without “Edit” and a click opens nothing.

### Left panel

20. A third tab **Requirements** after Model and Sources. Groups by kind in the order of item 1, each with the
    requirements' colour dot and count, foldable like the other groups (fold state in the browser); a group with no
    match is not shown. A row: kind icon (`RICON`), key, name, coverage bar (“{ok} of {total} attributes covered”
    as its tooltip). Search filters by key and name. “New requirement” at the end for owner, admin and modeler.
21. A click on a row selects the requirement and opens its panel. **No lens** (4b). Rows are not draggable (4b).
22. With the left panel's “on this canvas” filter on, the tab shows no requirements, because no requirement has a
    card on a canvas until 4b; it shows “No requirement has a card on this canvas yet.”

### Requirement panel (prototype `insReq`)

23. Kind label “Requirement”; ID and Kind; Name; Description (item 19); Rule or Check (code field) and “When it
    fails” (Warn / Block the load) by kind; Status and Priority as segmented buttons; Owner and External reference
    (placeholder “e.g. JIRA-481”); “Part of” (None (top level) and every requirement that would not make a cycle);
    “Broken down into REQ-…, REQ-…” with links that open those requirements.
24. **Coverage**: “Attributes in scope {ok} / {total}”, “Mapped and approved”, “Mapped, not approved yet”,
    “Not mapped”, then the list of gaps (attribute, “unmapped” or “not approved”); a click on a gap goes to that
    attribute (item 27). It updates as soon as a mapping's status or inputs change.
25. **Traces to**: one row per link (element name, its type “entity”, “attribute”, “mapping”, “table”, “column”;
    a mapping as `column → Entity.attribute`), × to unlink for those who may edit. Empty: “Nothing yet. Link it from
    the panel of an entity, attribute, mapping, table or column.”
26. **Delete requirement** at the end (owner, admin, modeler). The prototype's “Place its card on this canvas” and
    the lens sentence under Coverage are not shown (4b).
27. A link to an element (Traces to, gaps) behaves as the app's existing go-to links: if its card is on the open
    canvas, it is selected there and its panel opens; otherwise its panel opens (step 0 names the existing helper).

### Element panels (D-34, panel part)

28. Entities, attributes, mappings, tables and columns get a **Requirements** section (prototype `reqSection`): direct
    requirements with × to unlink, then indirect ones with “via entity”, “via attribute” or “via column” and no ×.
    Empty: “Not linked to any requirement yet.” A click on a row opens that requirement's panel (placing its card
    is 4b; the rows are not draggable; no “Add all to this canvas”).
29. Below it, for owner, admin and modeler: “Link to a requirement…” listing every requirement not linked directly
    (“REQ-101  Single view of the customer”), then “+ New requirement…”, which creates a requirement linked to this
    element and opens its panel with the name selected (one undo step). Linking toasts “Linked REQ-104 to the
    attribute.” (“the entity”, “the mapping”, “the table”, “the column”); unlinking toasts “Unlinked.”

### Project home and status bar

30. The project home's statistics get “{n} requirements, {m} covered” and a **Requirements** section before
    “Labels in this project”: every requirement whose scope has an entity or table on one of the project's canvases
    (prototype `projReqs`, without the card part), with key, name, kind, coverage bar and “{ok}/{total}, {status}”.
    Empty: “No requirement touches this project's canvases yet.” A click opens the project's last opened canvas (else
    its first) with the requirement selected and its panel open.
31. The canvas status bar gets “Requirements {n}, covered {m}” for the whole workspace, after Relationships.

## 4. Steps (stop after each one)

0. **Check and questions.** `git remote -v`, branch, last commit; `main` at the `slice-03b` tag. handlebars status
   (`known-limitations.md`, from 19 October). Answer section 7's questions with what the code shows, propose the
   wording of any message this PRD leaves open. Take the S4A-14 baseline: the element counts on `slice-03b`.
1. **Domain and data.** Items 1–15: types, Zod schemas, commands, scope and coverage, key counter, permissions,
   four-eyes, sanitizer and `_text`, cascade from deleted elements, seed. Unit tests for every rule (coverage with
   composite mappings and type conflicts, cycles, key collisions, four-eyes author, sanitizer allow-list). Report the
   seed's coverage figures; the e2e tests use them.
2. **Rich-text editor.** Items 16–19, with entity and attribute definitions switched over. Update the earlier tests
   that type into definitions (section 8).
3. **Requirements in the panels.** Items 20–29.
4. **Project home, status bar, roles.** Items 30–31, the reviewer, reader and archive behaviour across the slice,
   four-eyes in the UI.
5. **Acceptance tests and wrap-up.** One e2e test per criterion, S4A-14, three full runs, docs (section 9), the
   manual checklist for Łukasz.

## 5. Acceptance criteria

Tests in `e2e/slice-04a/`, one file per criterion, each from a fresh seed. Data a test starts from is written through
the domain; what the criterion checks goes through the page and is read back from the data file.

| ID | Criterion |
| --- | --- |
| S4A-01 | Left panel tab Requirements: groups in kind order with counts, rows with icon, key, name and coverage bar (tooltip); search “e-mail” leaves REQ-103 only; folding a group survives a reload; with “on this canvas” on, the empty text; Piotr and Kasia have no “New requirement”. |
| S4A-02 | “New requirement” creates REQ-106 (Data requirement, Draft, Should, “New requirement”, name selected); the next one is REQ-107; one undo removes it. A key typed as REQ-108 makes the next generated key REQ-109. A duplicate key and an empty name are refused with their messages and the fields show the previous values. |
| S4A-03 | Requirement panel: every field of item 23 saves and survives a reload; switching REQ-103 to Business rule hides “When it fails” and shows Rule, switching back shows the stored check and severity; “Part of” does not offer REQ-102's descendants for REQ-101 and the domain refuses a cycle sent directly; “Broken down into” on REQ-101 links to REQ-102. |
| S4A-04 | Editor on an empty Business rule description: template headings with grey hints; typing in two sections and saving stores only those headings and text (no hints, no empty sections), `description_text` is the plain text; bold, a colour and a link survive; Ctrl+Enter saves, Esc with changes needs a second Esc; one undo restores the previous text. Sent directly, `<script>` and an `onclick` attribute and a `javascript:` link are stripped on the server. |
| S4A-05 | Entity and attribute definitions open in the editor without “Insert template”; a seeded plain-text definition opens as its paragraphs; the panel shows the saved text formatted, shortened with “Show more” when long. |
| S4A-06 | Linking from each of the five element panels with “Link to a requirement…” (toast per type); the same link twice: “Already linked.” and no write; “+ New requirement…” on `email` creates REQ-106 linked to it (one undo removes both); × in the element panel and in Traces to unlink (“Unlinked.”, one undo each). |
| S4A-07 | Indirect requirements: `email` shows REQ-102, REQ-103 and REQ-105 directly and REQ-101 “via entity”; Customer shows REQ-101 directly and REQ-102, REQ-103, REQ-105 “via attribute”; a table under a mapping linked to a requirement shows it “via column”; indirect rows have no ×. |
| S4A-08 | Coverage: the seed's figures (from step 1) in the panel and the left panel's bars; approving a draft mapping into a gap attribute moves it from “not approved” to covered in the open panel; a type conflict on one input of an approved composite mapping makes its attribute a gap; a requirement traced only to a table shows 0 / 0 and is not covered; a click on a gap goes to the attribute (item 27). |
| S4A-09 | Traces to: rows with type and the mapping written as `column → Entity.attribute`; a click on an element whose card is on the open canvas selects it there; on a canvas without it, its panel opens. |
| S4A-10 | Deleting REQ-102: toast, REQ-103 becomes top level, its links are gone, Customer's attributes and mappings are unchanged; one undo brings back the requirement, its links and REQ-103's parent. Deleting the attribute `email` deletes its links and its undo brings them back. |
| S4A-11 | Roles: Piotr changes REQ-103's status and nothing else (fields read-only, no Edit, no Link field, no ×, no Delete); his other writes sent directly are refused with the reviewer message; Kasia changes nothing (reader message); in the archived workspace nothing changes. |
| S4A-12 | Four-eyes on: Anna edits REQ-103's description, then cannot set it to Agreed (message, status unchanged); Piotr sets it to Agreed; the status change is in `change_event` with Piotr as user. With four-eyes off Anna can. |
| S4A-13 | Project home: the statistic and the Requirements section of “Customer 360” and “Order management” with their figures; a click opens the right canvas with the requirement's panel; the status bar shows “Requirements 5, covered {m}” and updates after a mapping is approved. With the context on, creating and linking a requirement labels nothing and records the context in the events. |
| S4A-14 | The canvas is unchanged: element counts in “Performance test” identical to `slice-03b` (`S3B-15-elements.spec.ts`'s method, measurement build); S2C-12, S3A-14 idle, S3B-15 idle and S3B-13 pass. No balanced performance sitting in this slice. |
| S4A-15 | CI (lint, typecheck, unit tests, the schema check) and three full e2e runs in a row. |

**Definition of done (scenario for the manual acceptance).** As Łukasz: open “Customer 360”, open the Requirements
tab, create a data requirement from `segment_code`'s panel with “+ New requirement…”, write its description from the
template with one bold word, see it in Customer's panel “via attribute” and in the project home's list as not covered,
map `customers.segment` onto `segment_code` by dragging, approve the mapping and see the coverage change, then delete
the requirement and undo.

## 6. Differences from the prototype (deliberate)

- No lens, markers, requirement cards, trace lines or dragging (4b). Selecting a requirement opens its panel only.
- Linking only from panels; the empty “Traces to” text says so.
- Notes stay plain text until after the performance review (their text is drawn on the canvas; D-42 not complete;
  `known-limitations.md`).
- Reviewers may change a requirement's status (the prototype has no role rules for requirements).
- Four-eyes for Agreed (the prototype has none for requirements).
- Parent cycles blocked at any depth.
- Project home's requirement list ignores requirement cards (none exist yet).

## 7. Questions for step 0

- **Q1.** Do the migrations already have `requirement`, `requirement_link`, `workspace.requirement_key_next` and
  `canvas_item.requirement_id` as in `data-model-v2`? Proposed: no new migration; if something is missing, a new
  migration and the data model updated in this PR.
- **Q2.** Server sanitizer: which library (pure JavaScript, no DOM in `domain`), and does it sit in `domain` (pure
  function) or `data`? Proposed: a small allow-list sanitizer in `domain` built on a maintained HTML parser, pinned
  to a version older than 14 days.
- **Q3.** How does the mapping's four-eyes rule find the author today? Proposed: the same way for requirements; if
  it reads `updated_by`, use the latest `change_event` that changed a content field instead, so a status change by
  someone else does not make them the author.
- **Q4.** Does the left panel have a placeholder for the Requirements tab, and where does the fold state live?
- **Q5.** What does the entity delete dialog (D-47) show about requirements today?
- **Q6.** Which helper do existing go-to links use (item 27)?
- **Q7.** Seed names (item 15): anything missing?
- **Q8.** Tiptap: which packages and versions (pinned, older than 14 days), and its bundle size on the canvas page.
  Load the editor only when the dialog opens.

## 8. Changes to earlier tests

Expected: tests that type entity or attribute definitions into a textarea (slices 1a and 1b) move to the editor
dialog; the left panel's tab tests (if any) get the third tab. List every changed test in the acceptance file.

## 9. Docs in this PR

- `docs/known-limitations.md`: notes are plain text; requirements not on the canvas until 4b; Agreed requirements
  stay Agreed when edited.
- `docs/ideas.md`: “Labels on requirements” moved to requirements step 2 (with D-33's promotion); “Editing an agreed
  requirement sends it back to Draft” (like D-51) for step 2.
- `docs/decisions.md`, only with Łukasz's approval at step 0: add to AD-06 “For requirements, setting Agreed is the
  approval; the author is whoever last changed its content (kind, name, description, expression, severity).” and to
  AD-05 “Reviewers change a requirement's status only.”
- `CLAUDE.md`: the slice 4a helpers and commands, as for earlier slices.
- `docs/prd/slice-04a-acceptance.md`: criteria, steps, assumptions, the three runs, the manual checklist.
