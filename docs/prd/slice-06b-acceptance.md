# Slice 6b – Acceptance

Status: **accepted by Łukasz (manual acceptance passed, 22 October 2026); merged on his command, tag `slice-06b`.** Branch `slice/06b-back-and-forward`, from `main` at
the tag `slice-06a` (`80241ef`). PRD: `docs/prd/slice-06b-back-and-forward.md`. The PRD stays as written; this file is
its amendment (Łukasz, 22 October 2026).

## Łukasz's answers to step 1 (22 October 2026)

Step 1 accepted.

1. **Section 8:** option A; places in `sessionStorage` under `navigation.currentEntry.key`; `history.state` left to
   Next. Keys whose entry is no longer in `navigation.entries()` are pruned.
2. **Browsers without the Navigation API: no fallback.** The API is Baseline since January 2026 (Chrome and Edge 102,
   Firefox 147, Safari 26.2). Without it the buttons are hidden and our handler is off; the browser's own back still
   works for pages. One line in `known-limitations.md`. A smoke spec for Firefox and WebKit if Playwright's builds are
   installed here (pages and one selection place).
3. **Places** as proposed. **The workspace home's tab is not a place** (prototype): the tabs replace the entry instead of
   pushing one. Bundles, deselection and multi-selection are not recorded (deliberate differences, for the inventory). A
   selection made on arrival is written into the page's own entry.
4. **Centering** as proposed.
5. **Gone places** as proposed; a deleted project goes to the workspace home for **every** arrival (a typed URL too).
6. **Stale pages:** a background refresh after Back/Forward lands on another page; it must not move the view or change the
   selection, and never runs for a step within one page. Part of step 3's trace.
7. **Keys:** our own Alt+←/→ handler outside text fields, with `preventDefault`, so one press is one step on Windows too.
   The mouse buttons are left to the browser (manual acceptance).
8. **Edits in progress:** blur on every Back/Forward; its own spec (a field focused, `page.goBack()`, the edit saved).
9. **DoD step 5:** as proposed (remove the source table's card on Customer & orders, Back, then Forward).

## Step 1: questions (22 October 2026)

Start checks: `main` at `80241ef` contains the tag `slice-06a` and equals `origin/main`; the working tree was clean; no
node process, dev server, Playwright or measurement server (a Chrome was open, not a Playwright one). For section 8 I
started the preview dev server once (`.data/preview-db.json`, development build, Chromium) and stopped it again.

### Section 8 first: option A works, with one change

**Measured** on Customer & orders in the dev build (Next.js 16.3.8), with the canvas's commit counter and a resource
observer:

| Action | Canvas commits | Requests | Our state |
| --- | --- | --- | --- |
| `history.pushState({ im: … }, "")`, **no URL** | 0 | none | kept, next to Next's `__NA` and tree |
| `history.back()` onto the entry before it | 0 | none | – |
| `history.forward()` onto the pushed entry | 0 | none | kept (`popstate` gives it back) |
| a write that refreshes the page (the layer saved), with our entry current | – | the action's | **gone**: the entry's state is `{ __NA, tree }` only |

Why, from the router's source (`next/dist/client/components/app-router.js`, `segment-cache/navigation.js`):
- Next patches `pushState`/`replaceState`. Called **without a URL**, it only copies its own fields into our data; it
  dispatches nothing, so no route change, no request, no render. With a URL it dispatches a restore action, so a
  selection entry must never pass a URL.
- On `popstate`, Next runs a traverse with the entry's own tree: from the client cache, no request, and it keeps custom
  state (`preserveCustomHistoryState: true`).
- After every other router update (a navigation, or the refresh after a server action) Next calls `replaceState` with
  `{ __NA, tree }` and **drops custom state** (`preserveCustomHistoryState: false`). So `history.state` does not hold a
  selection reliably: the first write after selecting wipes it.

**The change (proposal):** keep option A (the browser's history is the only history), but keep each place in
`sessionStorage`, keyed by the **Navigation API's entry key** (`navigation.currentEntry.key`). The key belongs to the
history slot: it stayed the same through `replaceState` and through the write above. `history.state` then carries
nothing of ours. A selection entry is `history.pushState(null, "")` (no URL) plus `sessionStorage[place:<key>]`. The
Navigation API also answers item 10 natively (Q3).

Availability: the Navigation API is in Chrome and Edge (verified here, Chromium). Firefox and Safari could not be
checked here. *Proposal:* where it is missing, pages still go back and forward through the browser, selections are not
recorded and the buttons follow `history.length` (Back) and stay enabled (Forward); a known limitation, not built
beyond that.

### Q1. The prototype's history (`navState`, `navRecord`, `navGo`, `renderNavBar`)

- **A place** is `{ ws, wsHome, project, dia (canvas), home, sel }`, `sel` any single selection: entity, source,
  attribute, column, mapping, relationship, frame, note, requirement, label, bundle. A multi-selection is stored as
  `sel: null`. **The workspace home's tab is not part of it** (`wsTab` is left out).
- **Recorded** on every render of the navigation row (after any selection or rebuild), unless the new state equals the
  last one (`sameNav`). So clicking the background (deselect) and a multi-selection **are recorded**, as “the canvas,
  nothing selected”. Duplicates are not recorded. A new place cuts off everything ahead of the current one. At most
  **120**, the oldest dropped. Switching workspace clears the list.
- **Going back to a selection** selects it (`select`, which never opens the details panel on a wide screen) and moves the
  view **only when the item is off screen**, and only for cards and rows (entities, tables, attributes, columns): frames,
  notes, lines and panels-only items never move it.
- **Deleted places:** a place whose project or canvas is gone is **skipped silently** (the next one in that direction is
  taken); a gone selection becomes “nothing selected”, **no toast**; a place in another workspace stops the walk.
- **Buttons:** `data-nav="-1"` / `"1"`, titles “Back (Alt ←)” and “Forward (Alt →)”, chevron icons, disabled at the
  list's ends.
- **Keys:** Alt+←/→ on `keydown` in the capture phase, not with Ctrl or ⌘, not in a text field; `preventDefault` and
  `stopImmediatePropagation`. **The mouse's back and forward buttons are intercepted** (`mouseup`, buttons 3 and 4,
  `preventDefault`) and walk the app's list.

### Q2. How the app moves between places today

- **Pushes an entry:** every `<Link>` (breadcrumbs, the switchers' menus, the workspace home's tabs, project tiles) and
  `router.push` (canvas tabs, “On canvases”, a requirement's canvas, new canvas/project/workspace, the live canvas
  button). **Replaces:** the canvas tabs dropping `?rename=1`; `ModelCanvas` and the moved notice dropping `?card`,
  `?label`, `?req`, `?note`, `?moved` with `window.history.replaceState(null, "", pathname)` (Next turns that into a
  restore of the same page). **Server redirects** (the root to a workspace; a canvas no longer in its project to the
  project's first canvas with `?moved=1`; sign-in) replace.
- **`history.state`:** nothing of ours; only the `replaceState(null, …)` calls above.
- **Next.js and `pushState`:** see section 8. `useSearchParams` and `usePathname` follow a `pushState` only when it
  passes a URL; without one they do not react, and nothing re-renders.

### Q3. Knowing whether there is somewhere to go

With the Navigation API, `navigation.canGoBack` and `navigation.canGoForward` say it directly, and
`navigation.entries()` lists only this tab's same-origin entries, so **entries from another site count as “nowhere to
go”** without any bookkeeping. They survive a reload (the browser keeps the tab's entries) and the server render does not
touch them. Another tab has its own entries and its own `sessionStorage`. The buttons listen to `currententrychange` and
re-render only themselves. **So item 10's own index is not needed** (proposal). The places map in `sessionStorage` is
pruned to the keys in `navigation.entries()` on every record (Chromium keeps at most 50 entries per tab).

### Q4. Alt+←/→ and the mouse's buttons today

- **Alt+←/→:** in Chrome and Edge on Windows the browser goes back and forward itself, also in a text field. No app
  handler swallows them: the canvas's handlers return on `altKey` for ←/→ (`ModelCanvas.tsx`: the nudge and the main key
  handler); Alt+↑/↓ (moving an attribute, D-36) stays. A side panel's focused grip handles ←/→ **without checking
  Alt**, so Alt+← there would resize the panel as well. On macOS Option+← moves by a word and is not back (⌘[ is); I
  cannot test macOS here. Playwright's keys go to the page, not to the browser's own shortcuts, so they cannot reach the
  browser's Alt+←.
- **Mouse buttons:** the browser goes back and forward on buttons 4 and 5 itself; nothing in the app handles them (React
  Flow pans with the middle and right buttons only). Playwright cannot press them.
- **Proposal:** our own Alt+←/→ handler as the prototype's (capture phase on `window`, not with Ctrl or ⌘, not in a text
  field; `preventDefault`, `stopImmediatePropagation`, then `history.back()`/`forward()`). It gives the same keys on
  macOS, keeps a focused grip from resizing, and makes S6B-08 testable. In a text field the browser's own behaviour
  applies (Windows: back; macOS: a word). The mouse buttons: left to the browser (item 12), checked in the manual
  acceptance.

### Q5. An edit in progress when the person navigates

The details panel's fields save on `blur` (`fields.tsx`: `TextInput`, `TextArea`; the attribute panel's fields).
- Clicking anything (a breadcrumb, a tab, the new Back button) moves the focus first, so the field saves.
- **But a navigation that is not a click loses the edit**: measured, when the selection changed while a panel field had
  the focus, the field was removed without a `blur` event, so `onSave` never ran. That is today's Alt+← in a field on
  Windows and the mouse's back button, and will be every traversal to another selection.
- **Proposal (item 11):** on every traversal (`popstate`, and before our own `back()`/`forward()`), blur the focused
  field first, if it is a text field, a text area or an editor; it saves as on any click. Notes being written on the
  canvas save the same way (their editor saves on blur).

### Q6. Earlier tests

- No spec uses `page.goBack()`, `goForward()`, `history.length` or a fixed number of entries.
- `S3B-03` presses Alt+↓ (moving an attribute): untouched by an Alt+←/→ handler.
- Touched by step 2's row: the breadcrumb specs (S0-04, S0-11), S5A-06, S6A-06 (the fold: the buttons take room before
  the breadcrumbs, so the fold must count them), S6A-10, S6A-01. By step 3: the selection specs and 5a's “on purpose”
  specs (S5A-03, S5A-04), and the arrival links (`?card`, `?note`, `?req`, `?label`: S2A-12, S3A-12, S4A-10, S4B2-08).

### Where the PRD's guesses were wrong

| PRD | Found |
| --- | --- |
| Item 1: a workspace home is a place with its tab (prototype) | the prototype leaves the tab out; in the app each tab is a `<Link>`, so it is already an entry (keep: a deliberate difference) |
| Item 1: places are a card, a line, a frame, a note, a requirement | the prototype also records attributes and columns (rows), labels and bundles |
| Item 2: an empty selection and a multi-selection record nothing | the prototype records both, as “the canvas, nothing selected” |
| Item 4: the selection in `history.state` | Next drops custom state on every router update (a write's refresh): `sessionStorage` keyed by the Navigation API's entry key instead |
| Item 6: center the item when off screen (prototype checked) | the prototype centers only cards and rows, and only when off screen |
| Item 7: deleted places with a toast and the nearest home | the prototype skips gone pages silently, a gone selection becomes nothing selected, no toast; the app already sends a canvas no longer in its project to the project's first canvas with the “moved” notice, and a deleted project gives the 404 page |
| Item 8: the browser keeps the entries | yes, but Chromium keeps at most 50 per tab (the prototype 120) |
| Item 10: an own index for the buttons | not needed with the Navigation API (`canGoBack`, `canGoForward`) |
| Item 11: the browser already does Alt+←/→ | on Windows yes, not on macOS, and Playwright cannot reach it: an own handler (Q4) |
| Item 12: the mouse buttons need nothing | right for Windows; not testable by Playwright: manual acceptance |

### My view on the proposals

- **Item 2, a multi-selection is not a place: yes**, and neither is a deselection (as the PRD says, unlike the
  prototype). With the browser's history each click on the background would otherwise add an entry. After a
  deselection the current entry stays the last selection; Back goes to the entry before it.
- **Item 4, the browser's history as the only history: yes**, with the places in `sessionStorage` keyed by the entry
  (section 8).
- **Item 5, the selection outside the URL: yes.** A reload keeps the page and, since the entry and its key survive a
  reload, the app can even select the place again; *proposal:* do not, as the PRD says (a reload starts without a
  selection, as today).
- **Item 6, centering when off screen: yes**, for anything with a place on the canvas: cards, rows (their card),
  frames, notes and requirement cards, the view moved to centre it at the same zoom; lines and panel-only selections
  (a label, a requirement without a card, an element not on the canvas) do not move the view.
- **Item 8, no cap: yes** (the browser's 50).
- **Item 10, the own index: drop it** (the Navigation API; fallback above).

### Other points in the PRD

1. **Which selections are places (item 1).** *Proposal:* a card, a row (attribute or column), a mapping, a relationship,
   a frame, a note, a requirement (card or panel), a label (its panel) and the go-to fallback element; not a bundle (its
   key is made from the frames' state and may not exist when the person comes back).
2. **A selection made on arrival** (`?card`, `?note`, `?req`, `?label`) belongs to the page's own entry: it is written
   into the current entry's place, not pushed, so Back leaves the page as before.
3. **Selections the app makes** (a new entity, a placed card, “Show” links in panels) are places like a click, as the
   prototype records every change; the same item twice is one place.
4. **Gone places (item 7).** *Proposal:* a gone selection: the canvas without a selection and a toast naming the kind
   (“That card is no longer on this canvas.”, “… note …”, “… frame …”, “That requirement no longer exists.”); a canvas no
   longer in its project: as today (the project's first canvas, the “moved” notice); a deleted project: today the 404
   page; *proposal:* the workspace home with a toast, as for canvases (a small change in `shell.ts`, for every visit, not
   only history).
5. **The router's cache on Back.** A traverse restores a page from Next's client cache, so a canvas changed or deleted
   since could show as it was. *Proposal:* after a traversal that lands on another page, refresh it in the background
   (`router.refresh()`, one request; the canvas already merges fresh data without remounting, `readAt`); a traversal
   between selections of the same page stays without a request (S6B-03). Checked by S6B-06 in step 2.
6. **The fold (6a).** The two buttons sit before the breadcrumbs, fixed width; the fold must take their width from the
   same `ResizeObserver` (no layout read in a commit).
7. **DoD step 5** “Delete the selected card on the live canvas, then go back to it”: on a live canvas removing a card asks
   whether to take the label off, and after a delete the current entry is that card's place, so “going back to it” is
   Back, then Forward. *Proposal:* remove the source table's card on Customer & orders, press Back, then Forward: the
   canvas without a selection and the toast.
8. **The titles:** “Back (Alt+←)” and “Forward (Alt+→)” as the PRD (the prototype writes “Alt ←”); accessible names
   “Back” and “Forward”.
9. **S6B-08 and the mouse:** tests press Alt+←/→ (our handler) and use `page.goBack()`; the mouse buttons only in the
   manual acceptance.

### Docs plan (section 9)

- **`docs/decisions.md`** (quoted for Łukasz's approval in the closing step, in this PR): D-38 extended with what a
  place is (the list above; not panning, a deselection, a multi-selection or view state), the browser's history as the
  one history, places kept per history entry (not in the URL, not in `history.state`), going back never opens a hidden
  details panel, gone places.
- **`docs/inventory-prototype-vs-app.md`:** “Back and forward” done; the deliberate differences: the browser's history
  (no 120 cap, the browser's 50), the workspace tab as a place, no record for a deselection or a multi-selection, no
  bundle places, centering also frames and notes, gone places with a toast, the mouse buttons left to the browser.
- **`docs/known-limitations.md`:** browsers without the Navigation API (no selection places; the buttons approximate);
  macOS not tested.
- **README and CLAUDE.md:** the slice's status; how places are recorded (`sessionStorage` per entry key, `pushState`
  without a URL, never `history.state`), so later slices that add selectable things know where to add them; the e2e
  helpers.

### Questions for Łukasz

1. **Section 8:** option A with the places in `sessionStorage` keyed by the Navigation API's entry key, and
   `history.state` left to Next? *Proposal: yes.*
2. **Browsers without the Navigation API:** pages only, buttons approximate, a known limitation? *Proposal: yes.*
3. **Places:** card, row, mapping, relationship, frame, note, requirement, label, element; no bundle, no deselection, no
   multi-selection; arrival selections into the page's entry? *Proposal: yes.*
4. **Centering:** cards, rows, frames, notes and requirement cards when off screen, at the same zoom? *Proposal: yes.*
5. **Gone places:** the toasts per kind; a deleted project to the workspace home with a toast instead of the 404 page?
   *Proposal: yes.*
6. **The router's cache:** a background refresh after a traversal to another page? *Proposal: yes.*
7. **Keys:** our own Alt+←/→ handler outside text fields; the mouse buttons left to the browser? *Proposal: yes.*
8. **Edits in progress:** blur the focused field on every traversal so it saves? *Proposal: yes.*
9. **DoD step 5** changed as above? *Proposal: yes.*

## Step 2: page places, the buttons, the keys (22 October 2026)

What changed:
- **`src/ui/history-places.ts`** (+ 5 unit tests): the places store, `sessionStorage` under
  `infomapper:place:<navigation entry key>`, pruned to the keys in `navigation.entries()` on every save and on every
  `currententrychange`. `navigationApi()` and the small typed part of the Navigation API the app uses (TypeScript 5.9's
  DOM lib has none). Step 3 writes the selection places into it.
- **`src/app/_components/history-nav.tsx`**: Back and Forward at the left end of the breadcrumbs row on every page with
  the row (24 px each, never folded), titles “Back (Alt+←)” / “Forward (Alt+→)”, names “Back” / “Forward”, enabled from
  `navigation.canGoBack` / `canGoForward` through a store that re-renders only the buttons; hidden without the
  Navigation API. Alt+←/→ in the capture phase on `window`, outside text fields, with `preventDefault` and
  `stopImmediatePropagation` (one press, one step; a focused grip does not resize). After a traversal that lands on
  another page, `router.refresh()` once (never for a step within one page).
- **The blur (answer 8):** measured in step 2, **a traversal blurs the focused field itself when it starts, and an edit
  blurred that way never reaches its save** (no request at all; a plain blur saves). The Navigation API's `navigate`
  event comes before that blur: the app blurs the field there (`navigationType === "traverse"`), and again on `popstate`
  as a backstop, so the edit saves as on a click. S6B-08-edit passes with `page.goBack()` and with an in-page
  `history.back()` (what Alt+← in a field on Windows and the mouse's back button do).
- **The workspace home's tabs** replace the entry (`<Link replace>`): a tab is not a place (answer 3).
- **A project that no longer exists** (or was never in the workspace) redirects to the workspace home with
  `?gone=project` for every arrival (`shell.ts`), and the page shows “That project no longer exists.” once
  (`gone-notice.tsx`) and drops the parameter. The app cannot delete projects yet, so the specs use an unknown id.
- **The 6a fold** counts the buttons' width (from the same `ResizeObserver`; nothing reads layout in a commit).

**Firefox and WebKit:** Playwright's Firefox and WebKit builds are not installed here (only Chromium 1208 and 1243 in
`ms-playwright`), so there is no smoke spec for them. Installing them is a download of about 200 MB (`npx playwright
install firefox webkit`); *proposal:* Łukasz installs them if he wants the two smoke specs, and I add them in step 3.

Tests (`e2e/slice-06b/`): S6B-01 (four page places, Back three times by the button, Alt+← and `page.goBack()`, Forward
twice by the button and Alt+→; the tab replaces), S6B-06 (the project part: a typed unknown project, then Back and
Forward around it), S6B-07 (a fresh tab: both disabled; after a breadcrumb, Back only; after Back, Forward only; a reload
keeps it; titles and names), S6B-08 (Alt+←/→ on a home page and the canvas, one step per press; nothing in a text field;
a focused grip goes forward and keeps its width), S6B-08-edit (the edit saved after `page.goBack()`), S6B-09 (from 2,560
to 800 px with chips on: the buttons 24 px, before the breadcrumbs, nothing past the row, 32 px; a state change of the
buttons adds 0 canvas and 0 miniature commits).

**Changed earlier test:** `S6A-08`'s fold test expected Focus to push exactly one more chip into “+{n}”; with the buttons
taking room, the narrow Focus chip now fits where a wider one did not, so the count stays. It now checks that the row's
chips change (Focus first, “+{n}” shown) and come back, with 0 commits; 3 of 3 passed.

Runs: lint, typecheck, unit tests (80 files, 1,045 tests) pass. The slice's specs: 6 passed, 1.1 min. Earlier specs of
what the step touched (slice 6a whole; S0-04, S0-06, S0-07, S0-10, S0-11 breadcrumbs, tabs and switchers; S2A-10,
S2A-11, S3B-08, S3B-12, S3B-15 canvas tabs; S4B1-06; S5A-06; S4P-09 the not-found page): 35 passed, 1 failed
(S6A-08's fold test, above), 6.1 min. No earlier spec uses `page.goBack()`.

Łukasz accepted step 2 (22 October 2026), the S6A-08 change included. Firefox and WebKit installed by him; their smoke
specs on demand only. The `navigate` blur is limited to traversals (`navigationType` "traverse"), and the `popstate`
backstop fires for traversals only (it never comes for a `pushState`); a spec checks that a new entity's name field keeps
the focus while its selection pushes a place.

## Step 3: selection places, the diagnosis (22 October 2026)

What changed:
- **`src/canvas/SelectionHistory.tsx`** (on canvas pages): a single selection that is a place (a card, a row, a mapping,
  a relationship, a frame, a note, a requirement, a label, an element) pushes an entry without a URL and is kept under the
  new entry's key; the same place again records nothing; a deselection, several items and a bundle record nothing. A
  selection made on arrival (`?card`, `?label`, `?req`, `?note`) is written into the page's own entry. Back or Forward
  onto an entry applies its place, or nothing for the page's own entry; a traversal is never recorded again.
- **`ui.showPlace`** (`ModelCanvas`): checks the place still exists, selects it as a click does (the details panel never
  opens, D-54) and centres it at the same zoom when it is off screen: cards, rows by their card (a card in a collapsed
  frame by its block), frames, notes, requirement cards. A gone place: nothing selected and a toast per kind (“That card
  is no longer on this canvas.”, “That row …”, “That frame …”, “That note …”; “That mapping no longer exists.”, “That
  relationship …”, “That requirement …”, “That label …”, “That element …”).
- **`src/canvas/canvas-ready.ts`**: the canvas publishes its own `ready` (view set, nodes there) in a store, so a place
  arriving with a traversal from another page is applied only once it can be found.
- **Two things found while building it, both fixed:**
  - Next.js draws the page a traversal lands on before `popstate` reaches the page it left (it starts at the
    Navigation API's `navigate` event), so a listener on the page left never ran (measured: no `popstate` handler call
    at all). The tab now has **one traversal watcher** at module level (`history-nav.tsx`, `currententrychange` with
    `navigationType` "traverse"): it notes the entry landed on (`traversal.key` in `history-places.ts`; the canvas drawn
    for it applies its place) and the page left (for the background refresh). Without it, Back across canvases and the
    background refresh did not work.
  - The `popstate` listeners that remain (the blur backstop, a step within one canvas) are registered in the capture
    phase, ahead of Next.js's own.
- **A deleted canvas** is the app's existing handling: Back restores it from Next's cache, the background refresh asks
  the server, which sends the project's first canvas with the “moved” notice.
- **Firefox and WebKit smoke** (`e2e/slice-06b/S6B-browsers.spec.ts`; `playwright.config.ts` adds the `firefox` and
  `webkit` projects and runs the spec only with `BROWSERS=1`; CI and the full run stay Chromium-only). **Not run in
  Firefox and WebKit:** Playwright 1.63 looks for `firefox-1543` and `webkit-2359` in
  `%LOCALAPPDATA%\ms-playwright`, which holds only Chromium (`chromium-1208`, `chromium-1243`) on this laptop; in
  Chromium the spec passes. *Proposal:* `npx playwright install firefox webkit` from the project folder (it installs
  the builds this Playwright version expects), then `BROWSERS=1 npx playwright test e2e/slice-06b/S6B-browsers.spec.ts`.

Tests (`e2e/slice-06b/`): S6B-02 (five places walked back in reverse, then the page's own entry; the same card twice,
a deselection, a multi-selection and view state record none), S6B-02-focus (a new entity from the toolbox: its name typed
without a click keeps the focus, saved with Enter, one place), S6B-03 (no route change, no RSC or action request; Back
costs at most the click's canvas commits: measured 1 against 3), S6B-04 (a hidden details panel stays hidden; off screen:
centred at the same zoom; on screen: the view stays ±1 px), S6B-05 (Back across canvases: the canvas at its remembered
view, the card selected), S6B-06 (a card removed: no selection, the toast, Forward works; a deleted canvas: the project's
first canvas with the notice, Forward works), S6B-08-edit updated (the card's selection is a place, so Back lands on the
canvas without a selection, which removes the field: the edit is still saved).

### S6B-10: the diagnosis (phase traces)

Measurement build, headed Chrome, no laptop preparation (diagnostic), 7 traced switches each (medians, ms; style as
elements; layout as dirty / total objects; forced = style or layout inside a script call):

| Case | script | style | layout | paint | layerize | forced |
| --- | --- | --- | --- | --- | --- | --- |
| 30 % (ent:23, ent:28): a click on X | 29.7 | 2.5 (383) | 2.7 (347 / 7,444) | 6.9 | 5.8 | 2 |
| 30 %: Back to X | 26.7 | 1.4 (310) | 2.7 (351 / 7,444) | 7.2 | 5.2 | 2 |
| 100 % dense (src:29, src:1): a click on X | 72.2 | 5.0 (562) | 3.4 (241 / 27,623) | 19.6 | 9.7 | 2 |
| 100 % dense: Back to X | 40.4 | 0.9 (212) | 2.5 (245 / 27,623) | 18.5 | 10.2 | 2 |
| 30 %, X off screen: Back (centred) | 41.4 | 12.9 (718) | 12.6 (601 / 52,108) | 23.5 | 37.4 | 2 |
| 30 %, X off screen: the left panel's click (select and centre) | 38.1 | 17.9 (548) | 11.5 (336 / 59,552) | 42.3 | 50.5 | 1 |
| A button's state change (an entry pushed without a URL) | 0.1 | 0 | 0 | – | 0.01 | 0 |

- **Back to a selection on the same canvas costs no more than a click** (script −3.0 ms at 30 %, −31.8 ms dense: a
  click also runs its pointer handlers). Bar (≤ 2 ms more script): met. The canvas commits (S6B-03, development
  counters): Back 1, the click 3.
- **Off screen:** Back +3.3 ms script against the left panel's select-and-centre, with less style, paint and layerize;
  both move the view the same way.
- **A button's state change:** 0.1 ms of script, no style, no layout, nothing forced. The 2 forced style or layout
  passes in both a click and Back are the selection's own (the details panel), present either way.
- **The background refresh after Back to the canvas from the project home** (dense view, 5 runs): the refresh request
  took 25, 33, 31, 66 and 39 ms; **the view and the selection were unchanged in 5 of 5** (the transform read when the
  canvas was ready and after the refresh, the selection before leaving and after). The main thread in the 3 s after Back
  (script 641.7, style 80.3, layout 83.6, paint 73.1 ms) is mostly the canvas page drawn from Next's cache; this trace
  does not separate the refresh's merge from it. *Proposal:* accept as diagnostic; if Łukasz wants the refresh's own
  share, a run with the refresh switched off by a measurement-only `DIAG` switch would give it.

Runs: lint, typecheck, unit tests (80 files, 1,045 tests) pass. The slice's specs and the earlier specs that select
things, open details on purpose or arrive with a link (slices 1b, 2a, 2b, 3a, 4a, 4b-1, 4b-2, 5a, 6a and 6b whole):
**159 passed, 24.4 min**. S6B-10 in the measurement build: passed, 5.4 min. S6B-browsers in Chromium: passed.

Łukasz accepted step 3 (22 October 2026); the focus risk had been covered already. He ran `npx playwright install
firefox webkit` from the project folder and asked for the smoke, and for two checks with no new switches.

## Step 4: closing (22 October 2026)

### The browsers smoke

**Not run in Firefox and WebKit:** after Łukasz's install, `%LOCALAPPDATA%\ms-playwright` still holds only
`chromium-1208`, `chromium-1243` and their headless shells (no `firefox-1543`, no `webkit-2359`, which Playwright 1.63
asks for), and no other Playwright browser folder exists on the laptop (`PLAYWRIGHT_BROWSERS_PATH` unset). The install
may have gone to another place or not finished. In Chromium the spec passes. *Proposal:* run it once more and check its
last lines (`npx playwright install firefox webkit`), then `BROWSERS=1 npx playwright test
e2e/slice-06b/S6B-browsers.spec.ts`; I run it as soon as the two folders are there.

### Check 1: the background refresh's commits

Dev server (`.data/e2e-db.json` with “Performance test”), development counters; four runs per view, each Back from
“Performance test – requirements” onto “100 cards” (the canvas restored from Next's cache, then the refresh):

| View | Canvas and miniature commits until the refresh's response | Commits the refresh's merge added |
| --- | --- | --- |
| 30 % around ent:23 | 5 and 6, in every run | 3 and 3, in every run |
| 100 % dense | 5 and 6 (one run 8 and 9) | 3 and 3 (that run 0 and 0: its merge came before the response was read) |

So the refresh adds **3 canvas and 3 miniature commits** after Back lands on another canvas, the same in both views; the
view and the selection stay (S6B-10).

### Check 2: Back to another canvas against its tab

The same set-up, four runs each, the time from the click to the canvas ready on “100 cards” and to its last commit
(a settled screen: 600 ms without a commit), development build (both sides alike; figures are diagnostic):

| View | Back: ready / settled (ms) | Its tab: ready / settled (ms) |
| --- | --- | --- |
| 30 % | 3,657 / 3,645 · 4,023 / 4,012 · 3,041 / 3,030 · 4,035 / 4,024 | 5,608 · 4,843 · 5,977 · 4,580 (ready = settled) |
| 100 % dense | 5,158 / 5,141 · 5,031 / 5,014 · 5,296 / 5,281 · 5,762 / 5,726 | 8,589 · 5,162 · 5,921 · 6,972 (ready = settled) |

**Back is not slower:** it is ready about 1–2 s sooner at 30 % and as soon or sooner in the dense view (the canvas comes
from Next's cache; the tab asks the server for the page). Its refresh's three commits land before the screen settles.
A first version of this check measured the tab from the old canvas's ready flag (about 250 ms); with the page checked
too, the figures above.

### Docs

- `docs/known-limitations.md`, new section “Back and forward (slice 6b)”: browsers without the Navigation API (buttons
  hidden, our keys off, pages through the browser's own back); the mouse's buttons tested by hand only; at most 50
  entries per tab (Chromium); a reload starts without a selection (the entry keeps its place: Back and Forward select it
  again).
- `docs/inventory-prototype-vs-app.md`: “Back and forward” done, with the deliberate differences (the browser's history,
  no cap of the app's own; no place for a deselection, a multi-selection or a bundle; the tab not a place; centring also
  for frames, notes and requirement cards; toasts for gone places; the mouse's buttons the browser's).
- README: status and the slice's summary. CLAUDE.md: the commands (S6B-10, the browsers smoke), the e2e helpers, and a
  “Back and forward” paragraph (pushes without a URL, places in `sessionStorage` under the entry key, never
  `history.state`; the tab's one traversal watcher and why; the traverse-only blur and why; what a later slice must do
  when it adds something selectable: place or not, centred or not, its existence check and its toast).
- `docs/decisions.md`: not written yet; D-38's text below waits for Łukasz's approval.

**D-38, proposed final wording** (replaces the current line):

> **D-38** Back and forward walk one navigation history, the browser's own: the two buttons before the breadcrumbs,
> Alt+←/→ outside text fields, the browser's back and the mouse's back and forward buttons; the breadcrumbs stay
> clickable. A place is a workspace home, a project home, a canvas, or one item selected on a canvas (a card, a row, a
> mapping, a relationship, a frame, a note, a requirement, a label, an element shown by its panel); panning and zooming,
> the workspace home's tab, a deselection, several items, a bundle, view state and the side panels are not. A selection
> is a history entry of its own without an address: its place is kept for the browser tab under the entry, not in the
> URL, and a reload starts without a selection. Going back to a selection selects it as a click would, never opens a
> hidden details panel (D-54), and centres it at the same zoom when it is off screen; one on another canvas opens that
> canvas at its remembered view first. A place that no longer exists shows what still does, with a toast: the canvas
> without a selection; for a canvas no longer in its project, the project's first canvas; for a project that no longer
> exists, the workspace home. (Changed in slice 6b.)

### Runs

Lint, typecheck, unit tests (80 files, 1,045 tests) pass. Step 4 touched docs only, no code; the slice's specs: 13 passed, 6.5 min. The full run waits for Łukasz's approval of D-38 and his go.

### Łukasz's answers (22 October 2026)

Both checks accepted, nothing to change. D-38 approved with four edits (what is centred and what is selected without
moving the view; a plain name for the go-to element; “A field being edited is saved before Back or Forward leaves it.”;
the repo's spelling “centred”); written into `docs/decisions.md`.

**The browsers smoke, after the install:** `npx playwright install firefox webkit` from the project folder (in the shell
the tests run from) downloaded Firefox 155.0 (playwright firefox v1543, 122 MiB) to
`C:\Users\Lukas\AppData\Local\ms-playwright\firefox-1543` and WebKit 26.6 (playwright webkit v2359, 59.8 MiB) to
`C:\Users\Lukas\AppData\Local\ms-playwright\webkit-2359`. `BROWSERS=1 npx playwright test
e2e/slice-06b/S6B-browsers.spec.ts`: **3 passed** (Chromium 13.0 s, Firefox 30.4 s, WebKit 20.5 s), 1.9 min: the
buttons are there, and a selection place and a page place go back and forward in all three.


### The full e2e run (22 October 2026)

`npm run e2e` from scratch, no dev server, the laptop quiet (Łukasz); the measurement specs (S6B-10 among them) and the
browsers smoke excluded as configured: **242 passed, 0 failed, 46.1 min** (17:22–18:08). GitHub CI on the PR (check,
migrations): passed.

### Manual acceptance (Łukasz)

Start the app on the preview data (it has CR-23's live canvas):

PowerShell:

```powershell
$env:INFOMAPPER_DEV_DB = ".data/preview-db.json"; npm run dev
```

bash:

```bash
INFOMAPPER_DEV_DB=.data/preview-db.json npm run dev
```

Sign in at http://localhost:3000/sign-in as Łukasz; open Retail Co – DWH › Customer 360 › Customer & orders, the window
at least 1,600 px wide.

| # | Do | Expected |
| --- | --- | --- |
| 1 | On Customer & orders select Customer, then a mapping from it (click its line), then the table customers. | Each selection shows in the details panel; Back (the ← before the breadcrumbs) is enabled. |
| 2 | Open the CR-23 tab (the live canvas) and select a card. | The card is selected. |
| 3 | Press Back four times, mixing the ← button, Alt+← (nothing focused) and the mouse's back button. | 1: CR-23's canvas with nothing selected (its own entry); 2: Customer & orders with customers selected; 3: the mapping; 4: Customer. Each time the details panel stays as it was (shown or hidden). |
| 4 | Press Forward twice (the → button, Alt+→ or the mouse's forward button). | The mapping, then customers. |
| 5 | Right-click customers' card and choose “Remove from this canvas”. Press Back, then Forward. | Back: the mapping. Forward: the canvas with nothing selected and the toast “That card is no longer on this canvas.” (Ctrl+Z, clicking an empty spot first, brings the card back.) |
| 6 | Hide the details panel (the toolbar's right button), select Customer, then Sales Order, pan until neither shows, press Back. | Customer selected and centred at the same zoom; the details panel stays hidden. |
| 7 | Select Customer, click its name in the details panel, add “ X” without leaving the field, press Alt+←. | The browser goes back (Windows: Alt+← in a field is the browser's); Forward to Customer: its name is “Customer X” (saved). Put the name back. |
| 8 | Narrow the window to 1,100 px. | Back and Forward still at the row's left end, nothing in the top bar or the row cut off. |
| 9 | Firefox: open http://localhost:3000 in Firefox, sign in, repeat steps 1 and 3 with the buttons (and the mouse's back button). | The same as in Chrome or Edge. |

Łukasz: manual acceptance passed (22 October 2026), all steps, including the mouse's back and forward buttons, Alt+← in a field (the edit saved) and Firefox; merge on his command.
