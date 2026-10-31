# Slice 11 – acceptance

Status: **steps 1–3 done and answered by Łukasz (31 October 2026); step 4 (the interface) next, in a new session.**

- Tag `slice-10c` is at `72ef24b`, as A1 says. Branch `slice/11-aliases` was made from that tag.
- The PRD is copied unchanged from `~/Downloads/slice-11-aliases.md` (24,332 bytes; the only file with that name; its
  file time is 31 October 2026, 09:46). Commit "docs: slice 11 PRD".
- `.data/dev-db.json` (KB) was not touched. Nothing that opens the local file was run.

Step 1 checks items 1–15, P1–P14, D-64, D-63's addition, A1–A4 and S11-01 to S11-14 against the code, `docs/decisions.md`
and the earlier acceptance docs. The agreed points stand. F1 shows that one of them, undo for the canvas's control,
cannot be built on `canvas.look`, and proposes where the modes live instead.

## Step 1: findings

| # | Finding | Code behind it | Proposal |
| --- | --- | --- | --- |
| F1 | **The modes cannot live in `canvas.look` (P13, item 2) and be undoable (P8).** D-12 puts the look outside undo. `isUndoable` refuses any change group in which a canvas's look changed. `revertChangeGroup` writes a canvas row back with its *current* look. A control that writes the look and clears card exceptions in one group would not be an undo step at all. | `undo.ts`: `isUndoable` (look compared), the write-back (`row.look = current.look`), `matches` (look ignored); `setCanvasLook` (`canvas.ts`), "not an undo step (D-12)"; `run-command.ts` `remember` | Two **columns on `canvas`**: `entity_names` and `attribute_names`, text, null, CHECK `in ('name','alias')`, **null reads as `name`**. They are ordinary canvas columns, so undo restores them with the cleared exceptions in one step. The look, D-12 and the layer mode stay as they are. Null instead of a default keeps slice 10c's rule (F10: undo writes a column missing from an old image as null) valid for canvas rows too. |
| F2 | **The canvas's control and the save chain.** Writes to the canvas row are off the chain today. The look has its own queue and version (`look.tsx`); rename and delete send the page's version (known limitation, slice 10a). A control that sends the canvas's version would race with a look change: a false conflict. | `CanvasLookProvider` (`versionRef`, own `queue`); `known-limitations.md`, "Writes still off the save chain" | **The control's command does not check the canvas row's version.** The row is read as it stands, like a held row in `saveRows` (slice 10a), because the mode is a separate intent. It checks every card version it clears, all or nothing, as `resetCanvasView` does (slice 6a). The browser sends it through the canvas's own queue (`enqueueGroup` in `useFrames.ts`, as `resetView`), with the cards' versions as shown. Its answer gives the canvas's new version to the look provider, so a look change right after it is not refused. |
| F3 | **The pattern exists: `resetCanvasView`** (slice 6a). It writes several cards in one change group, checks each card's version and is one undo step. The control is the same shape plus the canvas row. | `canvas.ts` `resetCanvasView`; `useFrames.ts` `resetView` (optimistic `patchCard`, `enqueueGroup`) | A new command `setCanvasNames(canvasId, dimension, mode, cards[])` modelled on it; `nothingToChange` when the mode is already set and no card has an exception. |
| F4 | **A card's exceptions fit `canvas_item`** and its command. `updateCanvasItem` already saves `collapsed` and `row_filter`, and `setCardView` (`ModelCanvas.tsx`) is the card's optimistic path with its undo patch. | `canvas-item.ts` `updateCanvasItem`; `ModelCanvas.tsx` `setCardView`; `canvas-host.tsx` header menu | Two optional inputs, `entityNames` and `attributeNames` (`"name"`, `"alias"` or `null` to follow). The command stores null when the value equals the canvas's mode (`state.canvas`, already passed for the Labeled filter). Refused on table and requirement cards. |
| F5 | **The card menu has a segment pattern.** "Rows" is a segmented item (`seg`, `options` with `on`). Two segments, **"Entity name: Name / Alias"** and **"Attribute names: Name / Alias"**, show the card's effective mode, and a click on the canvas's mode clears the exception. That is simpler than toggling item texts (item 9) and matches the card menu. Like "Rows", it is for editors only (`if (editable)`), on live canvases too. | `canvas-host.tsx` lines 297–304 (`seg: "Rows"`, `filtersOf`, `FILTER_LABEL`) | Use segments, placed after "Rows". If Łukasz prefers item 9's toggling texts, they go in the same place. |
| F6 | **Reviewers and the layer mode.** Item 8 and S11-10 say "rights as for the layer mode", but S11-10 also says reviewers are not offered the controls. The layer mode *is* offered to reviewers and readers: they switch it in their browser only, unsaved (`look.tsx`). | `CanvasLookProvider.setLook` (`!editable` branch); `LayerSwitch.tsx` | Question Q-A. Proposal: **editors only** (owners, admins, modelers; not archived), as card views are. Reviewers and readers see the check boxes **disabled**, showing the saved state. Local switching would be a second, unsaved path for little gain. |
| F7 | **Where the check boxes go (Q1).** The layer switch is the first tool in the top bar (`CanvasTools`, canvas page). Background and grid are in the canvas tab's menu and in the Overview panel's "Canvas look" fold (editors). The top bar's narrow steps (`more-breakpoints.ts`, widths measured in slice 6a) assume today's tools. | `page.tsx` `CanvasTools`; `canvas-menu.tsx`; `overview-panel.tsx`; `MoreTools.tsx`, `MORE_FOCUS` | **In the top bar, right after the layer switch**, with short labels. Up to 1,200 px they move into "More" with Focus (`MORE_FOCUS`, CSS classes on their own element, no layout read). The narrow steps are checked again with step 4's screenshots. Their indeterminate state is the `indeterminate` DOM property, set in an effect from data, not from layout. |
| F8 | **What a card shows is decided in the browser, at node build.** Cards are built on the server (`buildCards`, canvas `page.tsx`), with clip flags (`withClips`) for the name's width. A switch must show at once, and the clip flags and "Fit width to names" must follow the shown text. | `card-data.ts` `buildCards`, `withClips`; `text-fit.ts` `rowNeedsClip`, `titleNeedsClip`; `CardNode.tsx` | `buildCards` adds `alias` to an entity card and to a row only when set (no bytes otherwise), plus the card's two exceptions. `ModelCanvas` sets `name` to the shown text when it builds nodes, and runs `withClips` again for entity cards on a switch. Header, rows, the low-zoom block, a collapsed frame's block list, text fit, "Fit width to names" and the drop hint then follow with no change of their own. **One `ModelCanvas` commit per switch, as the layer switch has one** (`layer` is read in `ModelCanvas`). |
| F9 | **More canvas places show names than item 13 expects** (Q3). A collapsed frame's block lists its cards by name (`BlockNode`, members from `c.name`). Tooltips (`title`) on rows, the header and the low-zoom block show the name. Mapping tooltips on rows ("from T.c", "to E.a") are built from the model. Toasts and questions on the canvas use `card.name` (a live canvas's unlabel question, drops into collapsed frames, a note's pin name). | `BlockNode.tsx`; `ModelCanvas.tsx` 1304 (members), 974 (live question), 947 (toast), 1788 (pin name); `card-data.ts` 164 (mapping lines) | With F8, everything that reads the card's `name` follows the card: block members, the row, header and block tooltips, toasts and questions about a card. Mapping tooltips keep the model's names; they describe the model, not the card. Question Q-B for the toasts. |
| F10 | **Performance bar (S11-13) is unrealistic.** Switching the layer mode re-renders the line layer only. Switching attribute names re-renders every entity card's rows, which is far more work in the dense view. "Layer mode + 20 %" would very likely fail on correct code. `measure:canvas` has no figure for the layer switch. | `ModelCanvas.tsx` 327–340 (`layer` filters the lines); `measure-canvas.ts` `CRITERIA` (pan, c10, lasso, fading, c08, colours, c09, drags) | A new branch-only measuring spec `S11-13.spec.ts`, to the screen as `S6A-09` does: click to the first presented frame, at 100 % and 30 % on "Performance test" with aliases written into the e2e data file. It reports the layer switch on the same view beside it. **Bars:** a canvas commit count of 1 and 0 miniature commits for a switch; the drawing layers unchanged; the time reported against the layer switch and against "Show all" with row filters (also every card), with no fixed bar until the first figures (question Q-C). |
| F11 | **Undo and a later mode change.** With the modes on the canvas row, a mode change is a canvas change like a rename. An older undo step on the same canvas row (a rename) is then "changed afterwards" and refused, as with any row. Today a look change does not block it. | `undo.ts` `matches` | Accept: it is the general undo rule. A note in `known-limitations.md` if Łukasz agrees. |
| F12 | **Code that builds these rows** gains the columns (as F18 in slice 10c): `newCanvasItem` (`canvas-item.ts`); `duplicateCanvas` (copies the modes and the cards' exceptions, as it copies row filters); `createCanvas`; the live sync's inserts (`live.ts`); `addAttribute`, `createAttributeFromColumn`, `createEntity`; the seeds (`seed-model.ts`, `seed-large.ts`); the fixtures (`__fixtures__/domain.ts`, `import.ts`); `requirement-index-synthetic.ts`; the local schema's checks (`schema.ts`). `applyLookToAllCanvases` stays look-only. | as listed | Step 2 adds the columns everywhere a row is built. A new canvas starts with null (names). |
| F13 | **The search (Q8)** runs in the browser (`tree-data.ts` `show`). The rows are entities and tables only. A match on a field (an attribute's name) shows the entity with a muted second line, the hint ("attribute customer_id"). | `tree-data.ts` `buildTree` (`fieldsOf`), `show`, `filterConcepts`; `left-panel.tsx` `TreeItem` (`hint`) | The smallest change uses the hint. An entity found by its alias gets the hint **"alias Klient"**. An entity found by an attribute's alias gets **"attribute customer_id · Numer klienta"**. A match by name is unchanged. No new row type and no inline "name · alias" (item 14's example), because the hint line exists already. |
| F14 | **Rows have one or two name spans.** `splitName` gives a long name a second span (`b`) for its tail. A long alias in place of a short name adds that span. The element guard runs on the seed without aliases (A4), so it stays equal. | `names.ts` `splitName`; `CardNode.tsx` `Row` | Nothing to build. The PRD's "the same element" is true per row up to that span; noted for S11-13. |
| F15 | **The page's data (Q4).** The panels get the full model (`model.entities`, `model.attributes`), so `"alias":null` adds about 13 bytes per entity and attribute. The cards add an alias only when it is set. | canvas `page.tsx`; `card-data.ts` | Accept. KB's 118 attributes add about 1.6 kB. |
| F16 | **D-12 and D-22 stay true** with F1. D-64's text should say that the names' modes, unlike the look, are undo steps. | `decisions.md` D-12, D-22 | D-64's text below is adjusted. |
| F17 | **The PRD's references are right except:** item 2 and P13 (`canvas.look`, see F1); S11-10 (reviewers, F6); S11-13 (bar, F10); item 9 (segments, F5); item 14 (hint, F13). D-35, D-37, D-38, D-52, D-63, AD-24 and AD-31 are as quoted. The local file is at format 10 (`DEV_DB_FORMAT`). `pasteAttribute` builds the copy's fields in `attribute.ts` (`name`, `definition_*`, `is_nullable`, `copied_from_attribute_id`). | `schema.ts`; `attribute.ts` `pasteAttribute` | Update the PRD to the answers after step 1, as in slice 10c. |

## Answers to Q1–Q11

**Q1. The canvas's look today.**
- **Where:** the layer mode is the top bar's first tool (`LayerSwitch`, always in the bar). Background and grid are in the
  canvas tab's menu (`canvas-menu.tsx`) and in the Overview panel's fold "Canvas look" (`overview-panel.tsx`, editors).
- **Rights:** `canvas.edit_look`, editors (owners, admins, modelers), not archived. Reviewers and readers switch the
  layer mode in their browser only, not saved (`look.tsx`). Live canvases have the same rules.
- **Undo:** each change writes the canvas row with a new version and a change event. It is not an undo step (D-12), and
  undo leaves the look alone.
- **Save chain:** no. The look provider has its own queue and version.
- **Proposal:** the two check boxes in the top bar after the layer switch, moving into "More" up to 1,200 px with Focus
  (F7). Their state comes from data: the canvas's mode and whether any card has an exception, published to the top bar
  through a store, as `viewCounts` is (`view-counts.ts`), so `ModelCanvas` is not re-rendered and nothing reads layout.
  They are undoable (F1) and written through the canvas's queue (F2).

**Q2. The data's shape.**
- The look is `{ background, grid, layer }`, validated by Zod enums in `setCanvasLook`. The modes do not go there (F1).
- A card's exceptions fit `canvas_item` beside `row_filter` (F4).
- A change group holds the canvas row and many `canvas_item` rows as `resetCanvasView` holds frames and cards (F3).
- `saveRows` is not needed: the canvas's own queue covers the cards, and the canvas row is not version-checked (F2).

**Q3. Every place on the canvas that shows an entity's or an attribute's name.**

| Place | Follows the card | Where |
| --- | --- | --- |
| Card header | yes | `CardNode.tsx` `.c-name` |
| Attribute rows | yes | `CardNode.tsx` `Row` (`splitName`) |
| Low-zoom block (title) | yes | `CardNode.tsx` `.c-lod` |
| Collapsed card | header only | `CardNode.tsx` |
| Live context cards | yes | `buildCards` (`live`) |
| A collapsed frame's block list | yes (not in the PRD) | `BlockNode.tsx`; `ModelCanvas.tsx` members |
| Tooltips of header, rows, block | yes | `title` attributes |
| Mapping tooltips on rows ("from …", "to …") | no, the model's names | `card-data.ts` `note` |
| Toasts and questions about a card | yes with F8 (Q-B) | `ModelCanvas.tsx` |
| Overlay (hover, lit rows, selection) | no names drawn | `OverlayLayer`, `HoverOverlay` |
| Requirement cards | requirement names only | `RequirementCardNode.tsx` |
| Frames | frame names only | `FrameLayer` |
| The miniature | no names | `Overview.tsx` |
| Zoom-to-fit labels | do not exist | – |

The truncation is `splitName` (`src/canvas/names.ts`) for rows and the CSS clip (`clip`, from `text-fit.ts`) for the
header (D-37).

**Q4. The page's data.** Server-built cards (`buildCards`) and the full model for the panels. See F15.

**Q5. The card header's menu.** `canvas-host.tsx`, the `card` branch. Rows, Collapse and "Fit width to names" are
offered under `editable` (role and archive from the page), on live canvases too. The two segments go after "Rows"
(F5).

**Q6. Undo and change events.**
- **Alias:** a new optional field `alias` in `updateEntity` and `updateAttribute` (trimmed, empty stored as null, no
  uniqueness). A change of the alias alone does not run `followOriginals` (it is not a followed column).
- **The canvas's control:** `setCanvasNames` (F3). One change group with the canvas row and every card it clears.
- **A card's exception:** `updateCanvasItem` (F4).
- **Names in the undo history:** from `changeLabel(events)` unless a write set sets `label`. Step 3 lists them for
  approval.
- **Restoring cleared exceptions:** `revertChangeGroup` writes back every row of the group to its before-image: the
  canvas row's modes (ordinary columns, F1) and each card's exceptions. No new undo code.
- **Older events:** slice 10c's rule writes a missing column as null. Null means "name" on a canvas and "follow the
  canvas" on a card, so older events undo correctly.

**Q7. The local data file.** The current format is 10 (`DEV_DB_FORMAT`, `src/data/local/schema.ts`). Format 10's step
is inline in `upgradeDb` (`file.ts`). `readDb` writes the file back when `was >= 2 && was < DEV_DB_FORMAT`. Format 11:
`if (format === 10)`, then `alias ??= null` on every entity and attribute, the two columns `??= null` on every canvas
and every canvas item, and `format = DEV_DB_FORMAT`. No change events, no log line. The look is untouched. Tests as
`upgrade-10.test.ts`.

**Q8. The search.** In the browser, names of entities and tables, plus a hint for a field match (F13).

**Q9. Copies.** `pasteAttribute` (`attribute.ts`) builds the copy from the original's fields; `alias: original.alias`
is one more line. It is not a followed column (`FOLLOWED_COLUMNS` stays as is). D-63's addition stands.

**Q10. The measurement.** No layer-switch figure exists. See F10: a branch-only spec `S11-13.spec.ts`, to the screen,
with the layer switch measured beside it. The `--only` keys are pan, c10, lasso, fading, c08, colours, c09 and drags;
the PRD's `--only pan,c08` against `slice-10c` is right for pan and the first render. Aliases are written into the
e2e data file's "Performance test" rows by the spec before the page opens (as slice 7b's specs write test data).

**Q11. Earlier tests and docs.**
- `S1B-07` lists the card header's menu exactly: it gains the two segments.
- `S6A-10` checks that nothing in the top bar is cut off from 2,560 to 800 px and what "More" holds: it gains the
  check boxes, and it is the test that tells whether they fit beside today's tools.
- Panel field lists: no spec lists them exactly (checked for `panel-entity` and `panel-attribute`); the specs use test
  ids.
- Search: no spec reads the hint's text for an alias; nothing changes.
- The element guard's page totals grow by the check boxes' elements (explained per element in step 5).
- Docs: as PRD section 10, with F1's columns instead of the look's keys.

## Differences from the prototype that the slice touches

- The prototype has no aliases. The top bar gains two check boxes after the layer switch (and in "More" on narrow
  windows).
- The card header's menu gains two segments after "Rows".
- The entity and attribute panels gain the field "Alias" under the name.
- The object browser's hint line shows an alias match.

## New user-visible texts (proposals)

- Check boxes: **"Entity aliases"**, **"Attribute aliases"**. Their tooltips: "Show entity aliases on this canvas" and
  "Show attribute aliases on this canvas". Disabled for reviewers: "Only editors change what this canvas shows".
- Card menu segments: **"Entity name"**: "Name", "Alias"; **"Attribute names"**: "Name", "Alias".
- Panel field: **"Alias"**, placeholder "Another name, e.g. in Polish".
- Search hints: **"alias {alias}"**; **"attribute {name} · {alias}"**.
- Undo history names: step 3 lists them.

## D-64 (proposal, adjusted to F1, F5, F6, F13)

"An entity and an attribute may have an alias: free text, an extra name with no fixed meaning (a translation, a
technical or a workshop name), edited in its panel. The name stays primary: everything outside the canvas shows the
name, and the object browser's search also finds aliases, naming the alias in the found row's hint. Imports carry no
alias, and sources have none. A copied attribute gets its original's alias once.

A canvas shows names or aliases in two independent dimensions, entity names and attribute names, each set by a check box
beside the layer switch: checked for aliases, unchecked for names, and indeterminate when a card has an exception. A
card may make an exception in either dimension from its header's menu; its header is tinted for an entity exception,
its attribute rows for an attribute exception. Clicking a check box sets the canvas's mode and clears the cards'
exceptions in that dimension; unlike the canvas's look (D-12), this is one undo step, and undo restores them. Editors
set them; reviewers and readers see the canvas as saved. With no alias the name is shown. Long aliases are truncated as
names are (D-37). Table and requirement cards are unchanged."

## Questions for Łukasz

1. **F1:** the modes as two nullable columns on `canvas` (null = name), not in `canvas.look`?
2. **F2:** the control's command does not check the canvas row's version, only the cards' versions?
3. **Q-A (F6):** editors only, with disabled check boxes for reviewers and readers? Or local switching as the layer
   mode has?
4. **F5:** segments in the card menu ("Entity name: Name / Alias") instead of item 9's toggling texts?
5. **F7:** the check boxes in the top bar after the layer switch, into "More" up to 1,200 px?
6. **Q-B (F9):** toasts and questions about a card name what the card shows (the simplest)? Or always the name?
7. **F13:** the search's hint line instead of an inline "name · alias"?
8. **Q-C (F10):** S11-13 with a commit count of 1, no miniature commit, the same layers, and the switch's time reported
   against the layer switch and "Show all", with the bar set after the first figures?
9. **F11:** accept that a later mode change blocks undo of an older rename of the same canvas?
10. The texts above.

## Łukasz's answers to step 1 (31 October 2026)

- **F1: yes.** The modes are two nullable columns on `canvas`, `entity_names` and `attribute_names` (null = name). The
  PRD is updated: P13, items 2–5, D-64, section 10's data model docs, S11-12.
- **F2: yes.** The control's command checks the versions of the cards it clears, not the canvas row's. Two editors
  changing the same canvas's mode at once: the last write wins, as it is a display setting. The cards' versions are
  still checked, so a card exception set meanwhile refuses the control's write.
- **F6: editors only.** The check boxes are disabled for reviewers and readers. "Left for later" gains a reviewer's own
  local choice of names or aliases, as the layer mode works for them today.
- **F5: yes.** Two segments after "Rows" in the card header's menu.
- **F7: yes.** In the top bar after the layer switch; into "More" below 1,200 px.
- **Q-B: toasts and questions about a card keep the name**, not the alias (P3: everything outside the canvas shows the
  name). So F8 changes: the card keeps `name` (the model's), and a separate shown text drives what the card draws (see
  the handover).
- **F13: yes,** the existing hint line.
- **F10: yes.** The bars: one canvas commit, no miniature commit, the same drawing layers. The time bar is proposed
  after the first figures, for Łukasz's approval. The short A/B sitting (pan, c08) against `slice-10c` stays.
- **F11: accepted.** A later mode change on a canvas blocks undo of an older rename of it; recorded in
  `docs/known-limitations.md` at the closing.
- **The texts:** accepted as proposals; approved finally in step 4, built.

## Handover for the next session

- **State after step 3 (31 October 2026):** branch `slice/11-aliases`, from tag `slice-10c` (`72ef24b`). Not pushed.
  - The last commit is "docs: slice 11 step 3 answered, handover for step 4" (`git log --oneline -10` shows the slice);
    step 3's code is the commit before it, `6fe7a7f` ("feat: slice 11 step 3, …").
  - Steps 1–3 are done and answered. KB is at format 11; step 3 did not open `.data/dev-db.json`.
  - The newest KB backup is `.data/backups/dev-db-20261031-1008-before-format-11.json`, also saved as
    `kb-model-latest.json` (the format-10 file).
- **What step 4 (the interface) must know, beyond the PRD:**
  - **The domain is ready** (step 3 below): the alias in `updateEntity`/`updateAttribute`, `pasteAttribute`'s alias,
    `entityNames`/`attributeNames` in `updateCanvasItem`, `setCanvasNames` (`canvas.ts`), and in
    `src/domain/model/aliases.ts` `canvasMode`, `cardMode`, `exceptionFor`, `namesControl`, `shownName`,
    `cardShownNames`.
  - **Server actions:**
    - `updateEntityAction` and `updateAttributeAction` pass the input through, so `alias` already works through them;
      the panels' field goes through `saveRow` as any field (slice 9).
    - `updateCardAction` (`src/app/_actions/canvas-item.ts`) already takes `entityNames`/`attributeNames` and loads the
      card's canvas for them (the command refuses without it). That file has CRLF line ends in the working copy; edit it
      with the Edit tool, not a script that rewrites line ends.
    - **`setCanvasNames` has no action yet:** add it beside `resetCanvasViewAction` (`src/app/_actions/frame.ts`, the
      `onCanvas` helper) and pass it to the canvas page's `writes` as `resetCanvasView` is
      (`c/[canvasId]/page.tsx`). Send it through the canvas's queue (`enqueueGroup`, `useFrames.ts`, as `resetView`),
      with the cards' versions as shown. Its answer's `versions` holds the canvas's new version: give it to the look
      provider (`src/canvas/look.tsx`, `versionRef`) so a look change right after it is not refused (F2); the cards'
      versions go back as `resetView`'s do.
  - **Undo names come from the commands** (write set `label`), approved: the canvas's control "Show entity aliases",
    "Show entity names", "Show attribute aliases", "Show attribute names"; a card's choice "Show entity alias on
    card", "Show entity name on card", "Show attribute aliases on card", "Show attribute names on card"; an alias alone
    "Change entity alias", "Change attribute alias" (`changeLabel`). The card's label needs `state.canvas`, which the
    action passes.
  - **The search already works once the tree carries aliases:** `buildTree` adds `alias`/`aliases` only when set and
    `show` gives the hints; the left panel's `TreeItem` draws `hint` as it is. Step 4 only checks it on the page
    (S11-08) and takes the screenshot.
  - **The shown text (F8 as changed by Q-B):** cards keep `name` (toasts, questions, pin names). `buildCards`
    (`card-data.ts`) must pass the entity's and each row's `alias` only when set, and the card's two exceptions;
    `ModelCanvas` computes the shown text when it builds nodes (`cardShownNames` with the canvas's modes) and feeds it
    to `CardNode` (header, rows, low-zoom block and their `title`s), `BlockNode`'s member list, `withClips`
    (`text-fit.ts`), "Fit width to names" and the requirement drop hint. Mapping tooltips keep the model's names.
    One `ModelCanvas` commit per switch (S11-13 checks it in step 5).
  - **The check boxes' state:** `namesControl(canvas, items, dimension)` gives `name`, `alias` or `mixed`; publish it
    from `ModelCanvas` in an effect through a store, as `viewCounts` (`src/canvas/view-counts.ts`), and set the
    `indeterminate` DOM property in an effect. A click: `mixed` or `name` → `alias`, `alias` → `name`. Disabled for
    reviewers and readers (F6). Nothing above the canvas reads layout during a commit (CLAUDE.md).
  - **Accepted behaviour (Łukasz, step 3):** switching to names stores null; the control also clears an exception
    equal to the new mode, so after a click nothing is mixed; both of a card's dimensions in one call is "Change
    card" (the menu sends one at a time).
  - **The card menu:** two segments after "Rows" in `canvas-host.tsx` (`seg`, `options`, `on`), under `editable`, on
    entity cards only; the segment shows `cardMode`, a click sends the choice (the command stores null when it equals
    the canvas's mode). `S1B-07` lists the menu exactly and gains them.
  - **Top bar:** the check boxes after the layer switch, into "More" up to 1,200 px with Focus (`MORE_FOCUS`,
    `more-breakpoints.ts`); `S6A-10` decides whether they fit.
  - **Texts approved in step 1, built in step 4 and listed again for final approval:** the check boxes, their
    tooltips and the disabled tooltip, the card segments, the panel field "Alias" and its placeholder, D-64's text.
  - **Tests:** specs S11-01 to S11-11 in `e2e/slice-11/` with their own `fixtures.ts`/`helpers.ts`; aliases written
    as test data through the domain or into the e2e file only (A4: the seed gets none). Earlier specs to run: the cards,
    panels, look controls and search, plus `S1B-07` and `S6A-10`. Stop the preview server before any Playwright run.
- **History, done:** step 2 started with KB's backup before anything opened `.data/dev-db.json`; its shape and runs are
  under "Step 2: data". Step 3's are under "Step 3: the domain".

## Step 2: data (31 October 2026)

**KB's backup, before anything opened the file:**
- Made before any build or run: `.data/backups/dev-db-20261031-1008-before-format-11.json` and
  `.data/backups/kb-model-latest.json`, 1,437,183 bytes each, local only (git-ignored).
- Both are byte-identical to `.data/dev-db.json` (`cmp`; SHA-256 `9074b153…cb6ab1` for all three).
- The file holds format 10 with:
  - 20 entities;
  - 119 attributes (117 live);
  - 6 canvases;
  - 33 canvas items (32 live);
  - 773 change events.

  The counts were read from the backup copy.
- `.data/dev-db.json` was not opened afterwards: same SHA-256 and time (09:14) at the end of the step.

**Built:**
- **Migration** `supabase/migrations/20261031100000_aliases.sql`:
  - `entity.alias` and `attribute.alias`;
  - `canvas.entity_names`, `canvas.attribute_names`, `canvas_item.entity_names` and `canvas_item.attribute_names`;
  - all text and null, with CHECKs `x is null or x in ('name', 'alias')` on the four mode columns
    (`canvas_entity_names_ck`, `canvas_attribute_names_ck`, `canvas_item_entity_names_ck`,
    `canvas_item_attribute_names_ck`). No index.
- **Types** (`src/domain/types.ts`): `NAME_MODES` and `NameMode`, `Entity.alias`, `Attribute.alias`,
  `Canvas.entity_names` and `attribute_names`, `CanvasItem.entity_names` and `attribute_names`.
- **The local adapter** (`src/data/local/schema.ts`): the same four checks (`noneOrOneOf`); `DEV_DB_FORMAT = 11`; the
  format's doc comment.
- **Format 11** inline in `upgradeDb` (`file.ts`):
  - format 9's step now ends at format 10;
  - `if (format === 10)` sets the six columns `?? null` on every entity, attribute, canvas and canvas item;
  - no change events, no log line, the look untouched.

  `readDb`'s write-back check (`was >= 2 && was < DEV_DB_FORMAT`) already covers format 10, so it needed no change.
- **Every place that builds these rows**, with null:
  - commands: `createEntity`, `addAttribute`, `pasteAttribute` (step 3 copies the original's alias, P10),
    `createAttributeFromColumn`, `newCanvasItem`, `createCanvas`, the first canvases of a project and of a workspace
    (`project.ts`, `workspace.ts`), a live canvas (`live.ts`);
  - the seeds (`seed.ts`, `seed-model.ts`, `seed-large.ts`, `seed-large-requirement-cards.ts`, `seed-requirements.ts`);
  - `requirement-index-synthetic.ts` and the test fixtures (`__fixtures__/domain.ts`, `import.ts`,
    `import.test.ts`, `model-store.test.ts`).
- **One exception to "null":** `duplicateCanvas` copies the canvas's two modes. The copied cards keep their exceptions
  (the items are copied with `...i`), so the copy keeps the names they are exceptions to (handover).

**Tests:**
- `src/data/local/upgrade-11.test.ts` (new, 4 tests):
  - a format-10 file gets every new column as null, keeps every row and count, writes no change event or log line,
    and is otherwise equal;
  - it is written back at once;
  - a file at format 11 is read as it is, with an alias and both modes kept, and is not written again;
  - the adapter refuses a mode other than name or alias, on a canvas and on a card.
- `undo.test.ts`, "aliases and the canvases' names (slice 11)": change events whose images lack the new columns are
  undone with them as null, for an entity's rename, a canvas's rename and a card's removal (slice 10c's rule, S11-12).
- `upgrade-10.test.ts`: its format is history now. A format-10 file goes on to format 11 and keeps its links; the test
  that read a format-10 file "as it is" now starts from a real format-10 file.
- The format's number, 10 → 11, in the store tests (`organization-store`, `requirement-store`, `upgrade-8`,
  `working-layer-store`) and in `S7B-12` and `S7C-02`.

**Runs:**
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm test`: 113 files, 1,474 tests, passed.
- **The AD-31 schema check** on a throwaway Postgres 18.3 cluster in the scratchpad (`initdb -E UTF8 --locale=C`):
  every migration applied, "The schema matches the domain: 33 tables, 446 columns" (slice 10c: 440). `pg_constraint`
  shows the four CHECKs; `information_schema` shows the six columns as text, nullable. The cluster was stopped
  afterwards.
- **The two specs whose format check changed** (`S7B-12`, `S7C-02`, on the e2e data file): 2 passed (52.7 s).
  - The first attempt never started its dev server. Next.js's font loader for `IBM_Plex_Sans` (`src/app/layout.tsx`)
    failed with "next/font/google queries have exactly one entry".
  - Google Fonts answered normally a minute later, and the retry passed. No test ran in the failed attempt; the cause
    was outside the app.
- KB was not upgraded.

**KB's upgrade (Łukasz's go, 31 October 2026):**
- **How:** through the app's own path. A one-off `tsx` file, not committed, called `readDb(devDbPath())` with no
  `INFOMAPPER_DEV_DB` set; the upgrade wrote the file back. The file was not edited by hand.
- **Before:** format 10, 1,437,183 bytes; 20 entities, 119 attributes, 6 canvases, 33 canvas items, 773 change events.
  None of the six new columns was in the file.
- **After:** format 11, 1,440,667 bytes (+3,484); 20 entities, 119 attributes, 6 canvases, 33 canvas items, 773
  change events. The new columns are present and null on every row:
  - `alias` on 20 of 20 entities and 119 of 119 attributes;
  - both modes on 6 of 6 canvases and 33 of 33 canvas items.
- **Compared with the backup as JSON**, table by table and row by row, without the format and the new columns:
  0 differences. Every table's count is the same, and no change event was added.
- **The app opens KB:**
  - the dev server (`npm run dev`, port 3000, on `.data/dev-db.json`) started;
  - signed in through the test users' list as Lukasz_KB, which leads to "Kanton Basel";
  - the canvas LDM of "First project" opened with its 8 entity cards (Building, Floor, Room, Parcel, Place,
    RoomType, Flooring, Blind), its 2 source tables and its panels;
  - no browser console message, and no error in the server log (every request 200 or 307);
  - the server was stopped, and the file is unchanged by the visit (SHA-256 `59a5a756…f08b6db8`, 10:22).
- The backup stays as it is: `.data/backups/dev-db-20261031-1008-before-format-11.json` (format 10, SHA-256
  `9074b153…cb6ab1`).

## Step 3: the domain (31 October 2026)

Branch `slice/11-aliases`, from `b22727b` (the handover commit). `.data/dev-db.json` was not opened. No interface yet.

**The shown text and the modes: `src/domain/model/aliases.ts`** (pure, no React):
- `NAME_DIMENSIONS` (`entity`, `attribute`) and `NAMES_COLUMN` (the same column on `canvas` and `canvas_item`).
- `canvasMode` (null reads as name), `cardMode` (the card's exception, or its canvas's mode), `exceptionFor` (a
  choice equal to the canvas's mode is none).
- `namesControl(canvas, items, dimension)`: `name`, `alias` or `mixed` (a live card of the canvas has an exception),
  from the data only, for step 4's check boxes.
- `shownName(named, mode)` and `cardShownNames(item, canvas, entity, attributes)`: the header and the rows, row by row,
  the alias in alias mode when there is one, otherwise the name (F8 as changed by Q-B). Cards keep `name` for toasts
  and questions; step 4 feeds this text to what the card draws.

**Commands:**
- **`updateEntity`, `updateAttribute`:** an optional `alias` (`optionalTextSchema`: trimmed, empty or blank stored as
  null; no uniqueness, no warning). Rights as for the name (`model.edit`, so archived is refused). One change group. An
  attribute's alias is not a followed column: it is allowed on a copy with a link and reaches no copy.
- **`pasteAttribute`:** `alias: original.alias`, once (P10).
- **`updateCanvasItem`:** optional `entityNames` and `attributeNames` (`name`, `alias`, or null to follow). Stored
  through `exceptionFor`, so a choice equal to the canvas's mode is null. Entity cards only; it needs the card's canvas
  (`state.canvas`), so `updateCardAction` now loads it for these two fields too (a two-line change at the server
  boundary). `canvas.edit_items`: editors, not archived.
- **`setCanvasNames(canvasId, dimension, mode, cards[])`** (`canvas.ts`), shaped like `resetCanvasView`:
  - it sets the canvas's column (names stored as null, the default; the row is written only when the mode changes)
    and clears every live card's exception in that dimension, the other dimension untouched;
  - all or nothing on the cards it clears, each at the version the user read; the canvas row carries no version in the
    input and is read as it stands (F2, last write wins);
  - nothing to change: "Nothing to change." (the existing text);
  - it answers `{ canvas, versions, cards }`; `versions` holds the canvas's new version, for the look provider (step 4).
- **No server action for `setCanvasNames` yet:** step 4 adds it with the canvas's queue (F2), as `resetCanvasViewAction`.

**Undo and redo:** no new undo code (F1). The control's group holds the canvas row (look unchanged, so `isUndoable`
accepts it) and the cards; `revertChangeGroup` writes their before-images back. The test undoes three cleared
exceptions and redoes them.

**Search** (`src/app/_panels/tree-data.ts`): a tree entity carries `alias` and `aliases` (its attributes' names and
aliases) only when set, so a model without aliases sends the same data. `show` matches, in this order: the name (no
hint); the entity's alias ("alias Klient"); an attribute's name ("attribute email"); an attribute's alias ("attribute
customer_id · Numer klienta"). The left panel already draws the hint line, so a search by alias works in the browser as
soon as the tree carries aliases; step 4 checks it on the page.

**Tests:**
- `src/domain/commands/aliases.test.ts` (new, 21 tests): the aliases (trim, clear, repeat, rights, archive, stale; a
  copy's own alias); the paste; a card's exception (stored, equal to the mode stored as null, cleared, refused on table
  and requirement cards and without its canvas, rights, archive, stale; a row filter's undo name unchanged); the
  canvas's command (one group, the dimension alone, the mixed case, names as null, nothing to change, the cards'
  versions all or nothing and no canvas version, rights, archive, a deleted canvas); undo and redo with three cleared
  exceptions; undo of a card's exception.
- `src/domain/model/aliases.test.ts` (new, 5 tests): the modes, `exceptionFor`, `namesControl` (deleted cards and other
  canvases do not count), the shown text with and without an alias, both dimensions independent.
- `tree-data.test.ts` (+3): aliases carried only when set; found by the entity's alias and by an attribute's alias with
  their hints; a match by name unchanged, and a name before an alias.

**New user-visible texts (for approval):**
- Refusal on a table or requirement card: **"Only entity cards show aliases."** (only a direct call can reach it; the
  menu offers the segments on entity cards only).
- Undo history names:
  - the canvas's control: **"Show entity aliases"**, **"Show entity names"**, **"Show attribute aliases"**, **"Show
    attribute names"**;
  - a card's exception, by what the card shows afterwards: **"Show entity alias on card"**, **"Show entity name on
    card"**, **"Show attribute aliases on card"**, **"Show attribute names on card"**;
  - an alias alone: **"Change entity alias"**, **"Change attribute alias"** (`changeLabel`; with other fields in the same
    save it stays "Change entity" or "Change attribute").
- Search hints, as approved in step 1: "alias {alias}", "attribute {name} · {alias}".
- Every other refusal is an existing text ("Nothing to change.", the role and archive refusals, the stale version).

**Assumptions:**
- Names are stored as null on the canvas, never as `name` (both read the same; one value keeps a fresh canvas and a
  switched-back one alike).
- A card exception equal to the new mode is cleared by the canvas's control too (it would follow the canvas anyway),
  so after a click no card in that dimension has an exception and the control is not mixed.
- A card's exception with both fields in one call is allowed and named "Change card" (the menu sends one at a time).

**Runs:**
- `npm run lint`: passed. `npm run typecheck`: passed.
- `npm test`: 115 files, 1,503 tests, passed (step 2: 113 files, 1,474).
- **Earlier e2e specs of what the step touched** (one run, 15 tests in 11 files, all passed, 2.7 min):
  - card rows and the row filter: `S1A-02`, `S1A-03`, `S1A-04`;
  - the card header's menu: `S1B-07`;
  - the chips and "Show all" (`resetCanvasView`): `S6A-01` to `S6A-05`;
  - the paste: `S10C-01`, `S10C-02`.
  - The dev server logged one "The destination stream closed early" during `S6A-03`'s live-canvas test, which passed
    (a page left while its response streamed; not an app error).

### Łukasz's answers to step 3 (31 October 2026)

- **The new texts are approved:** the refusal "Only entity cards show aliases."; the eight undo history names of the
  check boxes ("Show entity aliases", "Show entity names", "Show attribute aliases", "Show attribute names") and of a
  card's choice ("Show entity alias on card", "Show entity name on card", "Show attribute aliases on card", "Show
  attribute names on card"); "Change entity alias" and "Change attribute alias".
- **The three assumptions are accepted:**
  - switching a canvas to names stores null;
  - the check box also clears a card exception that equals the new mode;
  - both of a card's dimensions in one call is named "Change card".

## Step 4: the interface (31 October 2026)

Branch `slice/11-aliases`, after `e5c681d`. `.data/dev-db.json` (KB) was not opened: the browser checks ran on a fresh
scratch file, `.data/verify-db.json` (launch configuration `infomapper-verify`), and the specs on the e2e file.

**Built:**
- **Alias fields** (item 6): "Alias" under the name in the entity panel (`input-entity-alias`) and the attribute panel
  (`input-attribute-alias`), placeholder "Another name, e.g. in Polish", on `saveRow` as every field; read-only where
  the name is (`p.editable`: role and archive).
- **The check boxes** (item 8): `src/canvas/NamesSwitch.tsx` in the top bar after the layer switch
  (`check-entity-aliases`, `check-attribute-aliases`, group `switch-names`).
  - Their state is `namesState` (`src/canvas/names-state.ts`), a value store `ModelCanvas` publishes from an effect
    with `namesControl` over its cards' exceptions, as `viewCounts`. `indeterminate` is set in an effect; nothing reads
    layout.
  - Disabled for reviewers and readers, with the tooltip "Only editors change what this canvas shows".
  - A click calls `ui.setNames` → `ModelCanvas.setNames`: the new mode and the cleared exceptions are shown at once (one
    `setState` for the modes and one for the nodes, one commit), then `setCanvasNamesAction` (new, `frame.ts`, as
    `resetCanvasViewAction`) runs on the canvas's queue (`enqueueGroup` over every card) with the cards' versions. Its
    answer gives the cards their versions and the canvas's new version to the look provider (`noteVersion`, new in
    `look.tsx`). A refusal puts the mode and the exceptions back with the domain's message.
  - In "More" (`more-entity-aliases`, `more-attribute-aliases`) with Focus; an indeterminate item shows a dash
    (`dropdown-menu.tsx`'s indicator: `MinusIcon` for `indeterminate`).
- **The card menu** (item 9): two segments after "Rows" on entity cards for editors, "Entity name" and "Attribute
  names" with "Name" and "Alias" (`seg-entity-name`, `seg-attribute-names`; `ToolboxItem`'s segment gained an optional
  `testId`). They show `cardMode`; a click goes through `ui.setCardView` → `change(...)`, shown as an exception unless
  it equals the canvas's mode, and sent as the choice (the server decides the same).
- **What cards show** (items 10, 12, 13; F8 as changed by Q-B):
  - `CardData` and `CardRow` carry `alias` and, only when it differs from the name, `shown`; a card carries its
    exceptions `entityNames`/`attributeNames` only when set. A model without aliases sends the same card data.
  - `applyNames(card, canvasNames)` (`card-data.ts`) sets the shown texts with `cardShownNames` and works the clips out
    again (`withClips` reads `shownText`); the same card comes back when nothing it shows changes. The server applies
    it in `buildCards` (first paint); `ModelCanvas` applies it when it builds nodes, in `patchCard`, on fresh pages and
    on a switch.
  - `shownText` is read by the header, the rows (`splitName`), the low-zoom block and their `title`s (`CardNode`), a
    collapsed frame's block list, "Fit width to names" and the requirement drop hint. Toasts, questions and pin names
    keep `name`.
  - A fresh page brings the canvas's names keyed on the canvas row's version too (`names.version`): the switch's own
    page can be replaced by a later one, so the names alone may not change from one page to the next (found by S11-02
    and S11-05; an older page is ignored).
- **The tint** (item 11): the class `alt` on `.c-head` (entity exception) and on `.c-body`/`.c-lod` (attribute
  exception); token `--im-alias-soft` (`#fbe7f1` light, `#3d2433` dark; a pink no other mark uses). No new element.
- **Search** (item 14): the left panel's hint line draws step 3's hints as it is.

**A change to F7, for approval:** S6A-10 showed that the check boxes (225 px) do not fit in the bar from 1,201 to
1,300 px (working context on, both panels shown). So:
- the check boxes go into "More" **up to 1,300 px** (`MORE_NAMES`), and "More" shows from there; Focus, Changes and
  the notation stay in the bar down to 1,201 px as before (`MORE_FOCUS`, 1,200 px, unchanged);
- "More" beside Focus and the notation was 7 px too wide at 1,201 px, so the working context's label is truncated at
  90 px instead of 100 px from 1,201 to 1,300 px (`working-context.tsx`; the full name stays its tooltip as before);
- the check boxes' labels were tightened (gap and padding 4 px), which made 1,536 px fit.

I first tried moving Focus and the notation to 1,300 px with the check boxes: it fits, but Playwright's 1,280 px
window would then put Focus into "More" for about 25 earlier specs, and it changes slice 6a's step; so I kept F7's
1,200 px for them. S6A-10 checks the new step (the check boxes in "More" at 1,300 px, Focus not; both at 1,200 px).
Slice 11's specs run in a 1,536 × 864 window (`fixtures.ts`), so the check boxes are in the bar.

**Measured in the dev build (not step 5's sitting):** one switch is 1 synchronous canvas commit and 4 in all after the
server's fresh page, the same as a layer switch on the same canvas (4).

**Specs** (`e2e/slice-11/`, helpers in `helpers.ts`): S11-01 to S11-11, 16 tests, plus `S11-screens.spec.ts` (only with
`SCREENS=<folder>`).
- S11-06's context card: a live canvas for a label on one attribute of Order Line (CR-99, test data).
- S11-10's second test also checks that a layer change right after two quick clicks is not refused (the look
  provider's version).

**Earlier specs changed:** `S6A-10` (the check boxes' 1,300 px step above). No other earlier spec changed: `S1B-07` does not list the
segments' texts (it reads items by test id), so it passed unchanged.

**Unit tests:** `src/canvas/card-names.test.ts` (new, 5): no extra data without aliases; aliases on the first paint;
exceptions and the same card back; clips again for the shown text; table cards alone.

**Screenshots** (`docs/prd/slice-11-screens/step-4/`): 1 names, 2 aliases, 3 both check boxes indeterminate, 4 an
entity exception light and dark, 5 an attribute exception light and dark, 6 the card menu's segments, 7 a long alias
truncated, 8 a search by alias, 9 the alias field, 10 "More" at 1,150 px (the check boxes, the attribute one
indeterminate, with Focus and the notation).

**New user-visible texts (for approval):**
- Check boxes: **"Entity aliases"**, **"Attribute aliases"**; tooltips **"Show entity aliases on this canvas"**,
  **"Show attribute aliases on this canvas"**; disabled: **"Only editors change what this canvas shows"**. The same in
  "More".
- Card menu segments: **"Entity name"** and **"Attribute names"**, each **"Name"** / **"Alias"**.
- Panel field: **"Alias"**, placeholder **"Another name, e.g. in Polish"** (entity and attribute panels).
- Search hints (step 3): "alias {alias}", "attribute {name} · {alias}".
- Approved in step 3: the refusal and the undo history's names.

**Runs (small slice):**
- `npm run lint`, `npm run typecheck`: passed. `npm test`: 116 files, 1,508 tests, passed.
- **The final run on the final code:** 53 passed, 8.3 min:
  - slice 11: S11-01 to S11-11 (16 tests) and the screenshots;
  - the cards and rows: S1A-02, S1A-03, S1A-04, S1A-06;
  - the panels: S1A-07, S1A-11, S1B-12;
  - the card menu: S1B-07;
  - row filters and "Show all" (`resetCanvasView`): S6A-01 to S6A-08;
  - the top bar: S6B-02, S6B-09; the search: S2A-02, S4A-01;
  - live canvases: S3B-06 to S3B-09;
  - the paste: S10C-01, S10C-02;
  - canvas commits with fading and collapsed frames: S2C-12, S4P-12, S4B1-06.
- S6A-10 on the final code: passed (37.7 s), by itself.
- **Failures on the way, all fixed before the final run:**
  - S11-01: the field cleared before the panel showed the stored row (the test now waits for `data-version`).
  - S11-02, S11-05: undo of a switch was stored but not drawn (the names' version key above).
  - S11-02: test data put a label on Customer that the seed already had.
  - S6A-10: the top bar (the F7 change above).
  - Ten slice 11 tests while "More" was at 1,300 px for Focus too (the 1,280 px window).
- Before the final run, one earlier-spec run was discarded: the code changed while it ran.
- The dev server's font loader failed once at start (Google Fonts, as in step 2); the rerun passed.
