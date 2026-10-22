# Slice 6b – Acceptance

Status: **step 2 (page places, the buttons, the keys) done, waiting for Łukasz.** Branch `slice/06b-back-and-forward`, from `main` at
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
  frames, notes and requirement cards, the view moved to center it at the same zoom; lines and panel-only selections
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
