# Slice 7b – Consequences of source changes

Status: **draft for step 1**, 22 October 2026. Branch `slice/07b-source-changes`, from `main` at tag `slice-07a`. PRD file: `docs/prd/slice-07b-source-changes.md`. A large slice: the full e2e run after each step that changes pages (CLAUDE.md, "Tests per step"). Step 1 checks this PRD against the code (CLAUDE.md, "How we work").

## 1. Why this slice

Slice 7a brought the import: a re-import marks what left the source and sends approved mappings back to review, but it leaves the modeller to find the consequences alone. Slice 7b turns every source change that needs a decision into a **change to resolve**: listed where the modeller looks, with what it affects and the actions that settle it. It also adds the two overviews the prototype has: **model consistency** on the project home and the **Changes view** on the canvas.

The guiding principle of slice 7a stays (D-55): the modeller stays in control and sees what will happen before it happens. Nothing changes silently; everything can be undone.

**Decisions agreed with Łukasz on 22 October 2026:**

- **P1. Changes are visible from the start.** Every import raises its changes to resolve at once. The review shows them before the import ("After the import, {n} changes to resolve, {h} of them high: …"), and right after the import they show in the tree, the status bar and the system's panel.
- **P2. Nothing from slice 7a is lost.** The migration derives open changes from what imports in 7a stored: columns and tables missing from source, mappings an import sent back to review, and, where the import's change group allows it, new tables and columns (Q1). The derived changes say so ("Raised when slice 7b was installed").

**Further decisions, following the principle (all agreed with Łukasz on 22 October 2026):**

- **P3. A change to resolve is stored, not computed (agreed).** It records what happened at the time of the import (kind, severity, the object, a detail text and a label that survives a later rename or delete), and how it was settled (resolution, who, when). Resolved changes stay as history on the system's panel.
- **P4. Seven kinds, two severities (agreed).** Column left the source, table left the source, new column to decide, new table to decide, mapping no longer fits the source, business key column changed, rule updated for a renamed column. **High** when an approved mapping is affected (a column or table that left with an approved mapping on it, a new type conflict, a business key type change); **normal** otherwise.
- **P5. Every action shows its consequences first and is one undo step (agreed).** Delete shows what goes with it and how requirement coverage changes (D-47); moving mappings shows that approved ones go back to review; the toast offers Undo.
- **P6. Retire keeps history; delete removes it (agreed).** A retired column or table stays as historical: struck through in grey, its mappings kept with a `valid_until` date and not counted toward coverage (as missing ones already are, D-31). In Data Vault the column stays in its satellite. Delete removes the column or table with its mappings and relationships.
- **P7. Changes settle themselves when the source settles them (agreed).** A column that comes back settles its "left the source" change ("Back in the source on {date}"); a new column that leaves before a decision settles its "new column" change; moving mappings onto a new column settles that column's change; deleting settles every change on the object. Each such settlement is written in the history, never silently dropped.
- **P8. Approving again respects four-eyes (agreed).** "Approve the mapping again" is offered only when the mapping fits the source again, and follows the workspace's four-eyes setting (AD-06, D-51). "Leave it in review" settles the change and leaves the mapping in review.
- **P9. Approve again in bulk (agreed)** (Łukasz, slice 7a). On the system's panel, "Approve again all {n}" approves the mappings one import sent back to review, after showing their reasons. With four-eyes on, it skips the ones the person may not approve and says how many and why.
- **P10. "Not needed" can be taken back (agreed).** A column or table marked not needed shows "not needed" in the columns list; its column panel offers "Mark as needed" (one undo step). Nothing about a column's need is final.
- **P11. The Changes view is a view, not an edit (agreed).** It fades everything that open changes (or one import) do not touch, through the canvas's fade layer and with a view-state chip (D-39); it changes no data and no layout.

## 2. Sources

- **Prototype** (`docs/prototype/infomapper-prototype-with-sources.html`, module `IMP`):
    - raising changes: the `issue(...)` and `settle(...)` calls in `applyPlan`, `approvedOn`, `importSummary` ("{n} to resolve ({h} high)");
    - the list and its actions: `KIND`, `ACTS`, `issuesHtml`, `issueImpact`, `issueCard`, `pendingHtml`, `deleteObj`, `resolveIssue`, `issueAction`, `confirmPending`;
    - the review: `reqBox` and `issBox` in `stepReview`;
    - where the count shows: `sourcesTree`, `insSystem` ("Changes to resolve ({n})", resolved history, "Show what it touched on the canvas"), `sourceHead`, `colRow` (`im-new`, `im-chg`, `im-old`), the status bar ("Source changes to resolve {n}");
    - retired and not needed: `retiredSince`, `notNeeded`, the mapping's `until` (`mapLine`), the tree's `im-old`, the panels' "Retired: historical since {date}";
    - model consistency: `consistency`, `consistencyHtml`, `goTo`, its place on the project home;
    - the Changes view: `#tChg`, `chgSet`, `hit`, `renderChgBar`, the `im-hit` and `im-chgmode` classes.
- **`docs/prd/slice-07a-source-import.md` and `docs/prd/slice-07a-acceptance.md`:** what 7a built and every answer that amends it; the handovers.
- **`docs/decisions.md`:** D-26, D-31 (coverage), D-39 (view-state chips), D-47 (show what goes with a delete), D-49 to D-51, D-55, AD-05, AD-06, AD-08, AD-10 to AD-18, AD-23, AD-24, AD-26.
- **`docs/known-limitations.md`:** "Source import" (imports raise no changes to resolve yet), which this slice closes.
- **`docs/ideas.md`:** "Approve again all {n}" (P9).
- **App:** the import engine and command (`src/domain/import/`), the type check, the requirement index and coverage (slice 4a, D-31), the fade layer and Focus (slices 4p, 4b-1), the view-state bar (D-39), the project home (slice 4a), delete with what goes with it (D-47), history places (slice 6b).

## 3. What to build

### Data (one migration; `docs/data-model-v2.md` in the same PR)

1. **`source_change`:** standard columns, `source_system_id`, `source_import_id` (null for a change derived by the migration, P2), `kind` (CHECK: `column_left`, `table_left`, `new_column`, `new_table`, `type_conflict`, `business_key_changed`, `rule_updated`), `severity` (`high`, `normal`; CHECK), `status` (`open`, `resolved`; CHECK), `source_table_id`, `source_column_id`, `mapping_id` (each null where it does not apply; null again after a delete), `label` (e.g. `dbo.customers.email_addr`, kept when the object is renamed or deleted), `detail` (the text written at raise time), `resolution` (text), `resolved_by` (FK `app_user`), `resolved_at`.
2. **`source_table`, `source_column`:** new `retired_since` timestamptz, null; `source_column` new `not_needed` boolean, default false.
3. **`mapping`:** new `valid_until` date, null: set when its column is retired (the date the column left the source); a mapping with `valid_until` is historical.
4. **Local data file:** the new table and columns, the format's version raised with the automatic upgrade (as 5 → 6 in slice 7a); the undo history knows the new table.
5. **The migration derives open changes (P2):** a `column_left` per column with `missing_since` and no `retired_since`, a `table_left` per such table, a `type_conflict`, `business_key_changed` or `rule_updated` per mapping in review with a `review_reason` (kind from the reason's text, as 7a writes it), and, where Q1 shows the import's change group allows it, `new_table` and `new_column`. Detail: as at import, plus "Raised when slice 7b was installed."

### Raising and settling changes (the import engine)

6. **Raised by an import**, as the prototype's `applyPlan`:
    - a table not in the file: `table_left` ("Not in the file. Its {n} columns are marked missing from source."); high when any of its columns has an approved mapping;
    - a column not in the file: `column_left` ("Not in the file. Was {type}, with {n} mappings."); high with an approved mapping on it;
    - a new table in an existing system: `new_table` ("New in the source, {n} columns with no mapping yet."); a first import of a system raises none;
    - a new column in an existing table: `new_column` ("New in the source, {type}.");
    - per mapping that P6 of slice 7a touches: `type_conflict`, `business_key_changed` or `rule_updated` with the mapping, the reasons in the detail; high for the first two;
    - a business key column whose type changed with no mapping on it: `business_key_changed` ("… Hash keys built on it change too.").
7. **Settled by an import (P7):** a column or table back in the source settles its `*_left` change ("Back in the source on {date}"), and loses `retired_since` as well as `missing_since`; a new column that leaves before a decision settles its `new_column` change ("Left the source on {date} before a decision").
8. **The summary** gains "{n} to resolve ({h} high)" (`importSummary`), and `source_import` the counts `changes_raised` and `changes_high`.
9. **The review** (slice 7a item 27) gains, above the tables:
    - "After the import, {n} changes to resolve, {h} of them high. They wait on {system}’s page until you decide: {kinds}." (warning style when any is high);
    - "Requirements whose coverage changes": per requirement its key, name, "{a} of {n} → {b} of {n}" and why, or "No requirement’s coverage changes." on a re-import.

### The actions (one command each, one undo step, P5)

10. **Per kind**, offered on each open change:

| Kind | Actions |
| --- | --- |
| Column left the source | Retire: keep as historical · Move its mappings… · Delete… |
| Table left the source | Retire: keep as historical · Delete… |
| New column to decide | Map to an attribute… · Not needed |
| New table to decide | None of it is needed · Decide column by column |
| Mapping no longer fits / Business key changed / Rule updated | Approve the mapping again · Leave it in review |

11. **Retire (P6):** sets `retired_since` on the column (or the table and its missing columns) and `valid_until` on their mappings. Resolution: "Retired: kept as historical".
12. **Move its mappings…:** a select of the system's present columns, the same table first, each with its type; "Moved approved mappings go back to review; the old column is retired." On Move: every mapping that reads the column reads the chosen one instead (for a combined mapping, that input only, AD-26); approved ones go to review with the reason "moved from {old} after it left the source"; the rule is rewritten as in slice 7a; the old column is retired; the chosen column's `new_column` change is settled. Resolution: "Mappings moved to {table}.{column}".
13. **Delete…:** before anything happens, as D-47: "Delete the column {label} with:" its mappings (attribute and status), relationships, for a table its columns and canvas cards, and each requirement whose coverage changes ("{key} {a} of {n} → {b} of {n}") or "No requirement’s coverage changes.", and "Retiring keeps the history instead; in Data Vault the column stays in its satellite." Delete and Cancel. Settles every open change on the object. Uses the existing delete with its cascade.
14. **Map to an attribute…:** a select of attributes by entity, with types; "The mapping starts as a draft." Creates a draft direct mapping. Resolution: "Mapped to {entity}.{attribute} (draft)".
15. **Not needed / None of it is needed:** sets `not_needed` on the column or every column of the table. Resolution: "Marked not needed". **Decide column by column:** settles the table's change and raises one `new_column` per column.
16. **Approve the mapping again (P8):** offered only while the mapping is in review and fits the source; follows four-eyes like the mapping panel's approval. **Leave it in review:** settles the change only. Resolution: "Approved again" or "Left in review".
17. **Approve again all {n} (P9):** on the system's panel, per import with mappings it sent back to review: a list of those mappings with their reasons, then "Approve {n}". With four-eyes on, the mappings this person may not approve are listed apart ("You changed or imported these last, so someone else has to approve them.") and left in review. One undo step; settles the matching changes.
18. **Mark as needed (P10):** on a column marked not needed, in its panel; clears `not_needed`.
19. **Every action** ends with a toast "{resolution}: {label}" with Undo; the change moves to the resolved history with who and when.

### Where changes show

20. **System panel:** "Changes to resolve ({n})" with the open changes, high first, each as a card: severity tag, kind title, the label as a link to its table, the date, the detail, the impact ("Feeds {entity}.{attribute} ({status})" with requirement keys, "{n} mappings on its columns", "On {canvases}") and the actions; "Nothing to resolve." when none; "{n} resolved changes" folded, each with its resolution, who and when. Each import in "Imports" gains "Show what it touched on the canvas" (item 26).
21. **Table panel:** its open changes, as on the system panel without the history.
22. **Sources tree:** a system with open changes shows their count; a retired table is struck through in grey with the tooltip "Retired, historical."
23. **Status bar:** "Source changes to resolve {n}" in the warning style while any is open.
24. **Canvas rows:** a retired column in grey with the title "Retired: historical"; a column with an open `new_column` change marked new, one with another open change marked changed (classes on existing elements, AD-24). Panels: "Retired: historical since {date}"; the columns list shows "retired" or "not needed"; a mapping with `valid_until` shows "until {date}".

### Model consistency on the project home

25. **A section "Model consistency"** on the project home, scoped to the project's canvases, computed live (independent of imports), with a count badge: "Mappings on columns that left the source" (high if any is approved; hint "Retire the column, move the mapping or delete it from the source’s changes."), "Attributes without an active source" ("its columns left the source" or "historical source only"; "No new data reaches them."), "Type conflicts" (high if any is approved), "Mappings back in review after a source change" (with the reason), "Affected requirements" (key, name, "{a}/{n} covered"), and "Source changes to resolve" per system ("{n} changes to decide"). Each line opens its object on the best canvas of the project (prototype `goTo`). When all is well: "Mappings, types and sources agree. Nothing to look at."

### The Changes view on the canvas

26. **A toolbar button "Changes"** ("Show only what source changes touch") toggles the view. A bar shows "Changes", a select ("All open changes" or "Import into {system}, {date}, {source}" per import), "{n} tables, {m} mappings, {k} attributes" or "Nothing on record", and Close. Everything not touched fades through the fade layer; touched tables, columns, mappings, attributes and entities stay. A view-state chip (D-39) shows while it is on. "Show what it touched on the canvas" opens the view for that import, on the canvas if the person is on a home page.
27. **What "touched" means** (prototype `chgSet`): the objects of the selected changes; for "All open changes" also columns missing from source and not retired, and mappings in review with a reason; every mapping on a touched column, with its attribute and entity.

## 4. Steps (stop after each one)

1. **The critical review against the code and the questions** (section 7) in a new `docs/prd/slice-07b-acceptance.md`; the docs plan; the plan of section 6. No code. Stop.
2. **The domain** (items 6–8, 10–18): raising and settling changes in the import engine, the action commands as pure functions with their consequences (what goes with a delete, coverage before and after), the derivation of P2. Unit tests per kind, per action and per settlement. CI. Stop.
3. **Data and the commands** (items 1–5, 19): the migration with the derivation, the local adapter, undo, permissions and four-eyes, change events. Run the e2e specs of the import, coverage and D-51 that the step touches. Stop.
4. **The review, the list and the actions** (items 9, 17, 20–24): the review's two callouts, the system and table panels with the cards, the pending forms and the history, bulk approval, the tree, the status bar, the canvas row marks, the panels' retired and not-needed texts. One full e2e run. Stop.
5. **Model consistency and the Changes view** (items 25–27): the project home's section, the toolbar button, the bar, the fade and the chip, "Show what it touched on the canvas". The element-count guard and section 6's figure. One full e2e run. Stop.
6. **Closing:** docs (section 10), the inventory, two full e2e runs in a row, Łukasz's manual acceptance. Merge only on his command; tag `slice-07b`.

A new Claude Code session per step or two, with a handover section in the acceptance doc before each switch (slice 7a).

## 5. Acceptance criteria

Tests in `e2e/slice-07b/`, one file per criterion, each from a fresh seed; unit tests next to the domain code. The test files from `src/domain/import/samples/`.

| ID | Criterion |
| --- | --- |
| S7B-01 | Raising: a re-import raises each of the seven kinds with its severity, label and detail; a first import raises none; the summary and `source_import` carry the counts. Unit and e2e. |
| S7B-02 | The review: "{n} changes to resolve, {h} of them high" with the kinds, and "Requirements whose coverage changes" with before and after, or "No requirement’s coverage changes."; both computed over the whole plan, not only what is rendered. |
| S7B-03 | Settling by import (P7): a column and a table that come back settle their changes and lose `retired_since`; a new column that leaves settles its change; each with its resolution in the history. |
| S7B-04 | Retire (P6): the column or table and its mappings with `valid_until`; the grey marks on the canvas, in the tree and the panels; the mapping no longer counts toward coverage. |
| S7B-05 | Move its mappings: a direct and a combined mapping (that input only), approved ones to review with the reason, the rule rewritten, the old column retired, the target's `new_column` change settled. |
| S7B-06 | Delete (P5, D-47): the form lists mappings, relationships, columns and canvas cards, and the coverage change, before anything happens; Cancel changes nothing; Delete removes them and settles every change on the object. |
| S7B-07 | Map, Not needed, None of it is needed, Decide column by column, Mark as needed (P10), each with its resolution. |
| S7B-08 | Approve again and Leave in review (P8): offered only when the mapping fits; four-eyes on refuses the importer and accepts someone else; off accepts the importer. |
| S7B-09 | Approve again all {n} (P9): the list with reasons before approving; four-eyes on lists the ones this person may not approve apart and leaves them in review; one undo step. |
| S7B-10 | Undo: each action and the bulk approval undo in one step, including the change's status and the mappings. |
| S7B-11 | Where changes show: the system panel (open high first, resolved history), the table panel, the tree's count, the status bar, the canvas row marks. |
| S7B-12 | The derivation (P2): a data file from slice 7a with missing columns and mappings in review gets the matching open changes after the upgrade, with "Raised when slice 7b was installed." |
| S7B-13 | Model consistency: each group with its severity and hint, scoped to the project, live after an action; each line opens its object on a canvas; the all-well text. |
| S7B-14 | The Changes view: the button, the bar, the select per import, the counts, the fade, the chip, Close; "Show what it touched on the canvas" from a home page; no data or layout changes. |
| S7B-15 | Roles: a reviewer and a reader see changes, consistency and the view but no action that changes the model; approving follows the approval rights of today; an archived workspace offers no action; the server refuses each. |
| S7B-16 | Performance (section 6) and the element-count guard. |
| S7B-17 | CI and two full e2e runs in a row; changed earlier tests listed. |

**Definition of done (scenario for the manual acceptance).** As Łukasz, in Retail Co – DWH: re-import CRM with the changed test file and read the review's two callouts; after the import see the count in the tree and the status bar, open CRM's panel and see the changes high first; retire one column that left, move another's mapping to its renamed column, mark a new column not needed and then needed again, approve one mapping again, and use "Approve again all" for the rest; open the project home and read model consistency; open the Changes view for the import and close it; undo the last action and see it back in the list.

## 6. Performance

The slice touches the canvas twice: row marks (classes on existing elements, AD-24) and the Changes view (a fade, like Focus). Bars are proposals to confirm in step 1.

| Case | Bar |
| --- | --- |
| Element counts on "Performance test", all four views, whole page | equal to `slice-07a`'s |
| Turning the Changes view on and off, and switching the import in its select, on "Performance test" | within Focus's bar from slice 4b-1 (Q2) |
| Model consistency on a project home after a 20,000-column import with 5 % missing | ≤ 300 ms to the screen |
| Raising changes in an import of 20,000 columns, 5 % changed, renamed or missing | adds ≤ 10 % to slice 7a's plan and apply times |

A miss stops the step with the figures and Łukasz decides.

## 7. Questions for step 1

**Be critical and check against the code** (CLAUDE.md, "How we work"). This PRD was written from the prototype, the slice 7a documents and the decisions, without reading the code. Check every item, decision and criterion; say where it is wrong, contradicts the code or a decision, duplicates what the app has, misses what the code needs, or costs more than it assumes; name the files and functions; propose a better way. The questions below are a minimum.

- **Q1. The derivation (P2):** can the migration tell which tables and columns a 7a import created (its change group, `source_import`)? If not, what can it derive, and what does the detail say?
- **Q2. The fade:** how the Changes view shares the fade layer with Focus and any other view that fades; whether they exclude each other or combine; the chip's text; Focus's bar from slice 4b-1.
- **Q3. Coverage before and after:** can the requirement index compute coverage for a model that is not stored yet (the review, the delete form)? Its cost at 20,000 columns.
- **Q4. Delete:** the existing delete of a source table and column with its cascade and D-47 confirmation; how items 13 and 15 reuse it rather than add a second path.
- **Q5. Move its mappings:** replacing one input of a combined mapping (AD-26), the rule rewrite from slice 7a, and what happens when the target column already feeds the same mapping.
- **Q6. Approvals:** the mapping panel's approval path, four-eyes's "last editor" from the change log (slice 4a, Q3) and from an import (slice 7a, answer 7), and how P8 and P9 reuse them; who may approve under AD-05.
- **Q7. Historical mappings:** where `valid_until` must be honoured (coverage, the type check, consistency, the canvas lines, DV hints) and whether a retired column's mapping should still draw a line.
- **Q8. The project home:** where model consistency sits among its sections, how "the project's canvases" scope is computed today, and whether the existing requirement and status-bar counts already cover part of it.
- **Q9. Labels and history places:** whether a change is a selectable place (slice 6b) or only a card; what a click on the label selects.
- **Q10. Earlier tests** that change (7a's specs, coverage, the status bar, element counts), and the known limitation this slice closes.

## 8. Differences from the prototype (deliberate)

- Mappings have inputs (AD-26): moving mappings replaces only the input that read the column.
- Approving again follows four-eyes (P8); the prototype approves for anyone.
- "Approve again all {n}" (P9) and "Mark as needed" (P10) are new.
- Changes from slice 7a's imports are derived by the migration (P2).
- Delete reuses the app's delete with its cascade and D-47 form; the prototype has its own.
- The Changes view fades through the fade layer with a view-state chip; the prototype uses its own class on the page.
- Kind names in the data are spelled out (`column_left`…); the prototype uses short codes.

## 9. Left for later

- **Slice 7c:** the classification list, notes, suggested classifications, the Data Vault reading (unchanged from slice 7a's section 9).
- **Not planned yet:** a change to resolve as its own history place; notifications of new changes to other people in the workspace; resolving changes from the Changes view's bar.

## 10. Docs in this PR

- **`docs/decisions.md`** (only with Łukasz's approval of the quoted text): a new D-entry "Changes to resolve" with P1–P11; D-55 and D-31 extended where retire and `valid_until` touch them.
- **`docs/data-model-v2.md`:** `source_change`, `retired_since`, `not_needed`, `valid_until`, the import's new counts.
- **`docs/inventory-prototype-vs-app.md`:** "Sources" lists only what 7c still misses.
- **`docs/known-limitations.md`:** remove "imports raise no changes to resolve yet"; add what step 1 finds.
- **`docs/ideas.md`:** remove "Approve again all {n}" (done); add section 9's "not planned yet" items.
- **README and CLAUDE.md:** the slice's status; changes to resolve in the model section.
