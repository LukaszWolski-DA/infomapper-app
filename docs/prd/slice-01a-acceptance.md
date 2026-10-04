# Slice 1a – Acceptance

Branch `slice/01a-model-visible` · PRD: [slice-01a-model-visible.md](slice-01a-model-visible.md) · Pull request #2 (draft) ·
Status: ready for acceptance by Łukasz; **S1A-14 is partly met** (see [Performance](#performance-s1a-14))

Every end-to-end test starts from freshly seeded data (the fixture in `e2e/slice-01a/fixtures.ts` is slice 0's: it
resets `.data/e2e-db.json` before each test), so no test depends on another. Tests that need more data make it
themselves: S1A-02 adds a second input to a mapping through the domain, S1A-14 adds the “Performance test” workspace.

Results from 4 October 2026: `npm run lint`, `npm run typecheck` and `npm test` (363 unit tests) pass, and three full
runs of `npm run e2e` in a row (slice 0 and 1a, 35 tests each) passed 105 of 105 – see
[Three runs in a row](#three-runs-in-a-row).

## Criteria and tests

| ID | Criterion | Test(s) | Result |
| --- | --- | --- | --- |
| S1A-01 | Customer & orders shows the prototype's cards and lines | e2e `S1A-01.spec.ts`: the 3 entity and 4 source cards with all their rows; one mapping line per mapping between cards on the canvas, one relationship line per relationship; status colours (approved solid, draft dashed, in review dash-dot, map colour); unit `src/canvas/canvas.test.ts`, `lines.test.ts` | Pass |
| S1A-02 | Mapping lines start at the column's row and end at the attribute's row, facing sides, at 25%, 100% and 300%; a combined mapping shows its ƒ node | e2e `S1A-02.spec.ts`: every line end measured on screen against its row (row positions read at 100%) and the card edge, facing sides for direct lines, ƒ node for a combined mapping made in the test; unit `lines.test.ts` (geometry) | Pass |
| S1A-03 | Below 40% zoom cards show header and a plain block; line ends stay at the right rows | e2e `S1A-03.spec.ts`: at 30% every card has its header and block and no rows, every line end is at its row's place; at 40% rows are back | Pass |
| S1A-04 | Collapsing a card and filtering rows re-anchor hidden rows' lines to the header | e2e `S1A-04.spec.ts`: collapse, expand, filters Mapped and Unmapped on `customers`; the filter is saved and survives a reload; unit `lines.test.ts` (S1A-04) | Pass |
| S1A-05 | Dragging a card moves it and its lines; after reload it is still there | e2e `S1A-05.spec.ts`: real mouse drag of Customer's header in 10 steps, the card under the cursor at the grab offset at every step (within the 8 px snap; React Flow's drag threshold no longer makes it trail by the first move); its line end moves by the same amount; the new position (snapped to 8 px) is saved and shown after reload | Pass |
| S1A-06 | The notation switch changes relationship ends between crow's foot and UML on every canvas | e2e `S1A-06.spec.ts`: IE ↔ UML on Customer & orders, and the same setting on Order lines & products in the other project (D-22) | Pass |
| S1A-07 | From the left panel: concept, “+” entity, rename, attributes, place a table, mapping from the attribute panel; all persists | e2e `S1A-07.spec.ts`: the whole flow, then reload and a check of the data file | Pass |
| S1A-08 | A second input makes a transform that cannot be saved without a rule; with a rule it saves and shows the ƒ node | e2e `S1A-08.spec.ts`: refusal without a rule, the column put into the rule by a click (D-49), saved with the rule, back to review (D-51), ƒ node; unit `src/domain/commands/mapping.test.ts`, `mapping-rules.test.ts` | Pass |
| S1A-09 | `varchar(255)` into `string(100)` is a type problem with a reason, counted in the status bar; a transform with a rule is not | e2e `S1A-09.spec.ts`: length 100 set in the attribute panel, the reason in the mapping panel, the status bar count up by 2 (both email sources), then a rule: not a problem, count down by 1; unit `type-check.test.ts` | Pass |
| S1A-10 | Deleting Customer shows the impact (8 attributes, mappings with approved count, 2 relationships, canvases, projects) and removes it everywhere; a concept with entities goes only after moving them | e2e `S1A-10.spec.ts`: the dialog's five rows, deletion everywhere (card, lines, tree, model, cards on all canvases), then concept Customer deleted after moving Customer Address to Sales; unit `entity.test.ts`, `concept.test.ts`, `impact.ts` | Pass |
| S1A-11 | As Piotr (reviewer): no edit controls except the mapping status; approving works; other edits called directly are refused | e2e `S1A-11.spec.ts`: no controls in the left panel, on cards, in the entity, attribute and mapping panels; status Approved works; four server actions called directly are refused with the domain's message and change nothing; unit `permissions.test.ts` | Pass |
| S1A-12 | Four-eyes on: whoever changed the rule cannot approve; another modeler can | e2e `S1A-12.spec.ts`: Łukasz turns four-eyes on, changes the rule, sees the message, is refused; Anna approves; unit `mapping.test.ts` (four-eyes) | Pass |
| S1A-13 | “New source table” with columns as lines creates the table and its columns with types and lengths | e2e `S1A-13.spec.ts`: five columns incl. `varchar(255)`, `decimal(18,2)`, `nvarchar(max)` and trailing commas; existing system reused; a bad line refused with its line number; unit `column-lines.test.ts`, `source.test.ts` | Pass |
| S1A-14 | Performance on `seed:large`: pan and zoom ≥ 50 fps, no frame > 50 ms, at overview and 100%; initial render < 1.5 s | e2e `S1A-14.spec.ts` (functional in the normal run; measurement with `MEASURE=1`) | **Partly met**: overview about at the bar, 100% and initial render miss it – see below and [known limitations](../known-limitations.md#s1a-14-is-only-partly-met-and-measured-on-the-dev-server) |
| S1A-15 | CI runs on the pull request and passes; lint, typecheck, unit and e2e pass locally | e2e `S1A-15.spec.ts` (the workflow runs on pull requests and on `main` with the same checks); CI on PR #2 passed on the pushes of steps 3b to 6 (checked each time); local runs above | Pass |

## Performance (S1A-14)

Measured with the spike's method (`tests/measure.spec.ts` of the spike, repeated in `e2e/slice-01a/S1A-14.spec.ts`):
every animation-frame interval is recorded and Chrome's Long Animation Frames API counts frames over 50 ms, while one
wheel event per frame alternates pan, zoom in, pan, zoom out for 10 s. Same laptop as the spike (i7-8550U, Intel UHD
620, 7.9 GB), Google Chrome 154 headed, 1536 × 864 window, DPR 1. Data: the spike's set as the workspace “Performance
test” (101 cards: 60 source tables, 41 entities incl. one with 200 attributes; 300 mappings, 40 relationships).

**One difference to the spike:** the app runs on the dev server (`next dev`). The local data adapter refuses a
production build (AD-29), so a production measurement has to wait for the Supabase slice, or for a decision to allow a
measurement-only production run with local data. As a control, the spike was measured again on the same day, in its
production build **and** under `next dev`: dev mode does not change its pan and zoom (60 fps either way), but doubles its
initial render.

| Measurement | Bar | Spike follow-up (setup B, production) | Spike today, production / dev | App, first measurement | App after fixes 1 and 2 | **App after fix 3 (3 runs)** |
| --- | --- | --- | --- | --- | --- | --- |
| C-01 overview | ≥ 50 fps, 0 frames > 50 ms | 60.0 fps, 0 | 60.1 / 60.0 fps, 0 / 0 | 34.9 fps, 19 frames > 50 ms | 51.8–53.4 fps, 0 frames > 50 ms (longest 34 ms) | **49.8–55.8 fps, 1–3 frames > 50 ms** |
| C-01 100%, dense area | same | 58.3 fps, 0 | 59.9 / 59.6 fps, 0 / 0 | 19.8 fps, 61 frames > 50 ms | 46.3–46.8 fps, 4–5 frames > 50 ms (longest 83 ms) | **41.5–52.5 fps, 1–8 frames > 50 ms** (longest 100 ms) |
| C-08 initial render | < 1.5 s (median of 5 cold loads) | 789 ms | – / 1,721 ms | 4,895 ms | 4,985–5,476 ms | **4,174–6,633 ms** (single loads 3,593–7,201 ms) |

Fix 3 changes only the server, so the spread in pan and zoom between runs (and against the runs before it) is the
laptop's: the same code gave 41.5 and 52.5 fps at 100% within half an hour. The runs after fix 3 were on 4 October
2026, one after the other.

Raw results: `test-results/S1A-14.json` after a run (not committed).

### What was found and fixed

1. **The Overview minimap redrew its whole miniature on every frame** (all cards and lines, as new React elements):
   about a third of each frame during a pan. It now draws the miniature once per change of cards or lines, and the
   visible area as a second SVG on top, so moving the view repaints only that small layer.
2. **Clips on every row made Chrome re-layerize the canvas on every frame.** Each row name had two `overflow: hidden`
   elements for the middle truncation (D-37); card titles, first lines and coverage bars had more. A clip is a node in
   Chrome's paint tree, and with thousands of them the per-frame “Layerize” step took about 25 ms (the spike: about
   10 ms). Names now get the clip and the ellipsis only when they may not fit, from a conservative width estimate
   (`src/canvas/text-fit.ts`, unit-tested). Checked on both canvases: no unclipped name or title overflows; on the large
   canvas 204 of 2,228 rows need the clip. Truncation looks the same as before. AD-24 now names this rule.
3. **The local adapter read and parsed the whole data file for every repository call.** It now keeps the last read in
   memory (frozen) and re-reads the file only when its modification time, size or inode changes, so the seed scripts
   and the e2e reset, which write it from other processes, are still seen (`src/data/local/file.ts`, unit-tested in
   `store.test.ts`). The initial render's best runs went from about 5.0 s to about 4.2 s.

**Tried and not kept:** React Flow's `onlyRenderVisibleElements` (draw only the cards in view). The line layer and the
Overview read positions from the store, so they kept working, but mounting and unmounting cards at the edges of the
view during pan and zoom cost more than it saved: overview 42.9 fps with 22 frames > 50 ms, 100% 45.4 fps with 20,
initial render unchanged (4,154 ms).

### What is left, and why

- **100%: about 42–53 fps, 1–8 frames over 50 ms.** Scripts are now short (the long frames run 6–10 ms of script); the
  rest is Chrome rasterising the large GPU layer during the zoom segments. The app's rows draw more than the spike's
  (key, name in two parts, PII and BK badges, type, mapped dot, web fonts): 18,500 elements in the canvas at 100% against
  the spike's 12,300. Closing the Overview gives about 52 fps. Getting further means drawing less per row, which
  changes the card design – a decision for Łukasz (options: fewer elements per row, or detail by zoom level also
  between 40% and 100%).
- **Initial render about 4–7 s.** Before fix 3 about 2.4 s was the server before the first byte, mostly the local
  adapter reading the 2.5 MB data file again for every repository call; fix 3 removes that, but the split between
  server and browser was not measured again. The browser part was about 2.7 s in dev mode. Neither says much about
  production on Supabase; the spike shows dev mode alone doubles this number. The Supabase slice must measure S1A-14
  in a production build ([known limitations](../known-limitations.md#s1a-14-is-only-partly-met-and-measured-on-the-dev-server)).

## Three runs in a row

Full `npm run e2e` (20 slice 0 tests, 15 slice 1a tests), three times in a row, no other dev server running.

| Round | Run 1 | Run 2 | Run 3 | “destination stream closed early” |
| --- | --- | --- | --- | --- |
| 1 (3 Oct) | 34/35: S0-10 timed out | 35/35 | 34/35: S0-08 | 3 in every run |
| 2 (4 Oct, after fix 1) | 34/35: S0-10 | 10/35: project and canvas pages answered 404 for the whole run | 34/35: S0-10 timed out | 1–4 per run |
| 3 (4 Oct, after fix 2) | 34/35: S0-01 (cold start) | 35/35 | 35/35 | 0, 0, 1 |
| **4 (4 Oct, after fix 3)** | **35/35** | **35/35** | **35/35** | **0** |

What was found and fixed (each with its own commit):

1. **S0-08 and most of the stream traces:** the proxy wrote the last-used workspace and project cookies on every
   request, server actions included. A cookie written during an action makes Next.js mark it as revalidated
   (`x-action-revalidated: 1`, seen in the test's trace) and refresh the page. So every action refreshed the page,
   even a refused one: S0-08's second session received the other session's newer name before the test could see its
   own value restored, and a navigation right after an action cut that refresh off (the trace). The cookies are now
   written on page loads only, and only when they change. In the app this also removes one full page refresh after
   every action, such as saving a dragged card.
2. **S0-10 and the 404s:** e2e dev servers are stopped by force, and a server reusing that build folder (Next.js 16.1+
   keeps Turbopack's dev cache there) answered 404 for whole routes now and then. When S0-10 timed out, its `finally`
   did not run and its server stayed on port 3201 next to the next run's server; a half-written route-types file in its
   folder also broke `tsc`. Now e2e servers run without that cache, each run starts from an empty `.next-e2e`, S0-10
   stops its server in `afterEach` (runs after a timeout too) and removes its folder, and waits up to 60 s on its
   freshly started server.
3. **S0-01 on a cold start:** with an empty build folder the first sign-in compiled for longer than 15 s. The global
   setup now warms the server up (signs in, opens the main pages).

What remains is recorded in [known-limitations.md](../known-limitations.md): the stream trace can still appear after
quick navigation (seen once in round 3, not in round 4).

## Manual checklist (S1A-01 to S1A-10)

Start with fresh data and the dev server:

```
npm run reset-dev-data
npm run dev
```

Open http://localhost:3000, choose Łukasz, open Retail Co – DWH › Customer 360 › Customer & orders.

**S1A-01 – Cards and lines**
- [ ] Entity cards Customer, Sales Order, Order Line; source cards customers, web_users, order_header, order_line, each
  with all their rows (key badges, types, PII and BK badges, mapped dots).
- [ ] Mapping lines between columns and attributes: approved solid, in review dash-dot, draft dashed; type problems
  orange. Relationship lines between the entities with their labels.
- [ ] Compare with the prototype (`docs/prototype/infomapper-model-prototype.html`, same canvas).

**S1A-02 – Line ends**
- [ ] Zoom to 300% (Ctrl + wheel or +): each line leaves its column's row on the side facing the attribute and ends
  at the attribute's row. Same at 100% and 25%.
- [ ] In the panel of Customer.customer_id's mapping, add `customers.cust_no` as an input with a rule: the inputs meet
  in an ƒ node next to the attribute and one line goes on.

**S1A-03 – Detail by zoom**
- [ ] Zoom below 40%: cards show their header and a plain block; lines still end where the rows would be.

**S1A-04 – Collapse and filters**
- [ ] Collapse `customers` (arrow in its header): its lines move to the header. Expand: back to the rows.
- [ ] Click the filter button (All → Mapped → Unmapped → Keys): lines of hidden rows go to the header.

**S1A-05 – Moving a card**
- [ ] Drag Customer by its header: it moves with its lines. Reload: it is still there.

**S1A-06 – Notation**
- [ ] Top bar: switch IE → UML: relationship ends show multiplicities (0..1, 1..*). Open Order management › Order lines
  & products: UML there too. Switch back.

**S1A-07 – Left panel**
- [ ] Model tab → New concept “Loyalty” → Enter. Hover it, “+”: a card “New entity” appears in a free spot, its name is
  ready to type on the right. Type “Loyalty Account”, Enter.
- [ ] “Add attribute” twice, name them. Sources tab → click `items`: its card appears.
- [ ] Click the attribute's row → “Add a source column” → `item_code`: a draft mapping line appears.
- [ ] Reload: everything is still there. Also try: search “email” (attribute and column hits), “Only on this canvas”,
  “Only what this project uses”, folding groups, collapse all / expand all, double-click a concept to rename it.

**S1A-08 – Second input**
- [ ] Customer.first_name → its mapping → “Add an input…” → `lname`: the kind switches to Transformation and a note asks
  for the rule. Save without a rule: refused. Click the new input to put `lname` into the rule, finish the rule, Save:
  two inputs, ƒ node on the canvas, status back to In review (the toast says why).

**S1A-09 – Type check**
- [ ] Customer.email → Data type length 100: the status bar's type problems go up; the web_users.email mapping says
  “varchar(255) does not fit string(100) …”. Switch it to Transformation with a rule: no longer a problem.

**S1A-10 – Deleting**
- [ ] Select Customer → “Delete from model…”: the dialog lists 8 attributes, the mappings with how many are approved,
  2 relationships, 1 canvas, 2 projects. Delete: gone from the canvas, the tree and the other canvas.
- [ ] Concept Customer → ⋯ → Delete concept…: it holds Customer Address; choose Sales and confirm. Customer Address is now
  under Sales.

## Assumptions made in this slice

Accepted by Łukasz during the slice unless marked otherwise.

**Canvas**
- Selecting a card fades no lines; only a selected row or line fades the rest. Card emphasis is Focus mode (later).
- Clicking an item that lands outside the view centres the view on it (the prototype zooms out to fit).
- Names are clipped only when they may not fit (S1A-14, step 6) – **new, for Łukasz to accept**; worth adding to AD-24's
  CSS rules together with “no opacity on repeated elements”.

**Left panel**
- The Requirements tab comes with requirements. Collapse all / expand all and “Only what this project uses” were added
  after step 4.
- A new source table is placed on the canvas right away.

**Right panel**
- Built in step 4 only as far as step 4 needed (entity name, remove from canvas), then completed in step 5.
- Second input without a rule: the input shows as “not saved yet” with Save / Cancel and the rule field opens;
  Transformation without a rule is saved when the rule field is left, or goes back to Direct if it is empty.
- Deleting a mapping, attribute, relationship or table takes a second click (“Click again to delete”) until undo comes
  in slice 1b.
- The prototype's re-point selects (another column or attribute for a mapping) are left out; the domain has no command
  for it. “Map to an attribute” in the column panel goes to slice 1b.
- “Add the N missing to this canvas” under feeding sources is left out; a click places one table in a free spot.
- Panel links reach only attributes and columns whose card is on this canvas (`docs/known-limitations.md`).
- The status bar counts mappings, drafts, type problems and relationships for the whole model, as the prototype does;
  “Mapped attributes on canvas” is for this canvas.
- Own wording where the prototype has none: the BK suggestion (“… is marked as a business key in the source. Is … a
  business key too?”), “Not mapped yet. Pick a source column below.” (the drag hint returns with slice 1b), the delete
  dialog without the undo sentence and the requirements row.

**Domain and data**
- The type check follows the PRD's table, stricter than the prototype (Łukasz, 3 October 2026).
- Four-eyes: the author of a mapping's content is read from the change log, as no column records it (Łukasz,
  3 October 2026); for seeded mappings without such events, the creator.
- Local checks in the browser during development used a separate data file (`.data/preview-db.json`), not
  `.data/dev-db.json`.

**Tests**
- S1A-14 runs in the normal e2e run as a functional check (the large canvas opens completely, detail by zoom at the
  overview) and records numbers without judging them; the bars are asserted only with `MEASURE=1`, in headed Chrome.
- S1A-15 checks the workflow file; that CI passed is recorded here, not tested.
