# Slice 32 – acceptance notes (step 1: the PRD checked against the code)

Branch `slice/32-theme`, from `dev` at `6a6e7d7`, with the idea's commit `5980313` from `chore/ideas-theme-switch`
brought in by a cherry-pick (`05c7f69`, no conflict in `docs/ideas.md`). Step 1 only: no application code. Written on
20 November 2026.

## The files

| File | `cmp` with Downloads | SHA-256 | Expected |
| --- | --- | --- | --- |
| `docs/prd/slice-32-theme.md` | same | `b1e5dca0fa207e6456e34dad567dbb2971c620e3beb928f6db78f0309ec9a916` | the prompt's, equal |
| `docs/prototype/infomapper-prototype-with-sources.html` | same | `08a70d3b5a3fbe3f44acd90204d0ed63e4fcac2e9af9291c16b96ef9d670d1d1` | the PRD's, equal |

The first check found the previous prototype in Downloads: the file was the same as `dev`'s (`04e647bc…`). Step 1 stopped
until Łukasz copied the accepted file; the second check passed. The prototype's change against `dev`'s is in its script
only (`THEMES`, `setTheme`, the person's menu's section and its click, 9 lines added and 2 changed): its dark tokens were
already under both selectors (`:root:not([data-theme="light"])` inside the media query, and `:root[data-theme="dark"]`).

**Slice number:** 32 is free. `docs/prd/` ends at slice 31, there is no branch `slice/32-*` locally or on `origin`, no tag
`slice-32` and no pull request for it; `e2e/` ends at `slice-30` (slice 31 has no e2e folder).

## Q4 first: thumbnails

**They follow the choice today, with no change.** A tile draws a thumbnail as an inline `<svg>` with an **external
`<use>`** (`src/ui/canvas-thumbnail.tsx`: `<use href="/w/{ws}/thumbnail/{canvas}?v={key}#t">`), not an `<img>` or an
`<object>`. The route's file (`thumbnailSymbolFile`, `src/ui/thumbnail-svg.ts`) writes the colour roles as the palette's
tokens (`var(--im-map)`, `var(--im-physical)`, `var(--im-req)`) and has **no media query and no colour values of its own**
for them; the shapes in the `<use>`'s shadow tree inherit the page's custom properties. So whatever sets the tokens on
`<html>` sets the thumbnails' colours, at once and without a request. Under a dark system with Light chosen they take the
light tokens.

The stored colours keep their values in both themes: concept and frame colours (`#RRGGBB`) and the notes' `NOTE_MINI`.
They are the same in light and dark today and in the prototype's `thumb`. **AD-32's cache and key are not affected:** the
file holds no colour values that depend on the theme, so one cached file serves both themes and the key stays a key of
what is drawn. The PRD's risk does not apply. **The smallest change is none.** Step 2 adds an e2e check (S32-03): a
thumbnail's path takes the chosen theme's `--im-map` under the opposite emulated system, before and after a switch
without a reload. `S12B-browsers.spec.ts` (on demand, Chromium, Firefox and WebKit) already checks that the shapes take
the page's tokens under both emulated schemes.

## Answers to Q1–Q8

### Q1. Every dark value and every `dark:` utility

- **The media queries:** exactly the six the PRD lists (fact, still true on `6a6e7d7`):
  - `globals.css:6`: Tailwind's variant, `@custom-variant dark (@media (prefers-color-scheme: dark))`;
  - `globals.css:44`: the palette's 27 dark tokens;
  - `globals.css:81`: the canvas looks' white, blue and warm (`[data-bg]`);
  - `globals.css:185`: the rich text's `.tc-warn`, `.tc-attn`, `.tc-ok` and `.tc-info`;
  - `canvas.css:319`: the coverage fills' `fill-opacity: .16`;
  - `canvas.css:446`: the five notes' paper colours (`--np`, `--npe`).

  No other CSS file has one (`infocube.css` has no dark rule). No `.ts` or `.tsx` in `src/` writes CSS with one,
  InfoDocumenter's `document-css.ts` included.
- **`dark:` utilities:** five, all in shadcn's generated components: `src/ui/components/button.tsx` (the
  `destructive`, `outline` and `ghost` variants) and `src/ui/components/dropdown-menu.tsx` (the destructive item). The
  app's own code uses tokens, never `dark:`.
- **Script:** no `matchMedia("(prefers-color-scheme…)")` anywhere in `src/` (the only `matchMedia` is the side panels'
  narrow width) and no `getComputedStyle` or `getPropertyValue` that reads a token. React Flow is used without
  `colorMode` (its default, the light class); the app paints the canvas with its own tokens, as today. The miniature,
  the figures, the thumbnails and the canvas read no theme in script.
- **Coverage of today's dark values:** they cover the app as it is under a dark system today, so "no new colours" holds.
  Places that stay the same in both themes, today as after the slice, none of them new:
  - the development sign-in's banner (`sign-in/page.tsx`: `bg-amber-50 text-amber-900`, development only);
  - `--im-review-strong` (the review standing's avatar circle with white initials);
  - the dialogs' fixed overlays (`rgba(15,20,30,.45)`, `bg-black/…`);
  - `#fff` on the concept question's "Yes";
  - the stored concept, frame and note colours.

  None needs a change. **One real gap:** no `color-scheme` is set anywhere outside InfoDocumenter's pages, so under a dark
  system today native controls are light: scroll bars, `<select>` lists (36 `<select>`s), check boxes (20) and the date
  field. See Q3 and proposal P1.

### Q2. One source for the values

**Proposal: Tailwind's variant is the one place that says what "dark" means, and every dark block is written once under
`@variant dark`.**

```css
@custom-variant dark {
  @media (prefers-color-scheme: dark) {
    &:where(:root:not([data-theme="light"]), :root:not([data-theme="light"]) *) { @slot; }
  }
  &:where([data-theme="dark"], [data-theme="dark"] *) { @slot; }
}
:root { @variant dark { --im-canvas: #13181e; /* … the 27 tokens, unchanged */ } }
```

Tried in the scratchpad with the repository's Tailwind (4.3.3, `@tailwindcss/node`'s `compile`), not in the app.
Tailwind expands each block into both rules, the media query with `:not([data-theme="light"])` and the attribute,
with the values written once in the source. The five `dark:` utilities expand the same way, unrewritten.

`:where()` adds no specificity, so each dark rule keeps its light rule's specificity and wins by coming later, as
today. `canvas.css` takes the variant with `@reference "../app/globals.css"` (tried: it then expands `@variant dark` by
the variant in `globals.css`; without the reference the directive is unknown).

What changes in the two files: line 6's variant; the four blocks in `globals.css` and the two in `canvas.css` lose
their `@media` wrapper and gain `@variant dark { … }` inside their own selectors; `canvas.css` gains one `@reference`
line. No value changes.

**A guard test** (`tests/theme-css.test.ts`, proposal) fails a CSS file in `src/` that contains `prefers-color-scheme`
outside the variant's definition, so a later dark rule cannot bypass the choice.

The alternative I considered is CSS `light-dark()` with `color-scheme` per theme. It also needs no copy, but it rewrites
every value into pairs and cannot carry `fill-opacity` (not a colour). Not recommended.

### Q3. The first paint

- **The attribute:** the root layout (`src/app/layout.tsx`) reads the cookie with `cookies()` and renders
  `data-theme="light"` or `"dark"` on `<html>`, none for System. The tokens and `color-scheme` are plain CSS on that
  attribute, so the first paint is right with no script before it.
- **What becomes dynamic:** almost nothing new. The builds' `prerender-manifest.json` (`.next`, 7 November, and
  `.next-measure`, 17 November) list only `/_global-error`, `/_not-found` and `/favicon.ico` as static. `/sign-in`
  already calls `connection()`, and every other page reads the session's cookies. Only `/_not-found` would render per
  request: no measurable cost. `/favicon.ico` is not a page. `/_global-error` does not use the root layout (see P4).
- **Hydration:** the server renders the attribute and the client hydrates the same markup, so there is no mismatch and
  no `suppressHydrationWarning`. After a click the browser sets the attribute itself. React does not watch the DOM, and
  it touches `<html>`'s props again only when the root layout renders again (`router.refresh()`, which every refused or
  revalidated write triggers). That render reads the cookie the click already wrote, so React and the DOM agree in
  every order of clicks I traced (dark → light → refresh, light → system → refresh, and so on). **Rule for step 2:** the
  click writes the cookie before it changes the attribute.
- **`color-scheme`:** in the same CSS, `:root { color-scheme: light dark }`, `:root[data-theme="light"] { color-scheme:
  light }`, `:root[data-theme="dark"] { color-scheme: dark }`. This changes System under a dark Windows: P1.

### Q4. Thumbnails

They follow the choice with no change (above).

### Q5. InfoDocumenter

**No token reaches the pages.** The pages and the quick sheet (`.dpages`, `.pagedjs_page`, `.dpages.dquick`) set their
own tokens (`--paper`, `--dink`, `--dink2`, `--dink3`, `--dline`, `--dacc`, `--dsoft`) and `color-scheme:light`
(`document-css.ts:130–131`), and the rest of their colours are fixed values. `document-css.ts` and `document-html.tsx`
read no `--im-*` token. A laid-out page's and a quick sheet's background is `#fff`.

The figures are SVG blobs in `<img>` (`ui/figure-images.ts`), drawn with `FIGURE_PALETTE`'s fixed colour or black and
white values (`src/domain/document/figure.ts`), so a page's variables cannot reach them. Print shows the pages alone on
`#fff` (`@media print`, `html,body{background:#fff!important}`).

The tokens a page could inherit are only `* { border-color: var(--border) }` from the base layer, for a border without a
colour of its own. The one such rule, `table.dt th{border-bottom-width:.8px}`, gets its colour from
`border-bottom:… var(--dacc)` (line 106).

So under `data-theme="dark"` the pages behave exactly as they do under a dark system today, and the editor's panels,
bars and preview around them follow the theme. No change is needed. Step 2 checks it in e2e (S32-03): a laid-out page's
background, ink and a table header's colour under Dark equal those under Light, and the editor's options panel's surface
differs.

### Q6. The menu

- **Where it is:** `UserIndicator` in `src/app/_components/top-bar.tsx` (`menu-user`), rendered by `TopBar` through
  `AppShell` on:
  - the workspace home;
  - the project home;
  - the canvas page;
  - InfoDocumenter's editor (`/w/{ws}/d/{id}`, `AppShell` with `savePair={false}`; the editor's own bar is below the top
    bar and has no person's menu);
  - the document page (`/view`, print included).

  No top bar: `/` (a redirect), `/sign-in` (with the organization's password form), `not-found` (inside the root
  layout, so it follows the cookie) and `global-error` (P4).
- **The components:** the app's menus' section heading is `DropdownMenuLabel` with `sectionClass` (11 px, semibold,
  `ink-2`), the prototype's `.menu.ctx .msec`. The segmented control is `Seg` (`src/app/_panels/fields.tsx`: buttons with
  `aria-pressed`, a group named by `labelledBy`). It is `inline-flex`, while the prototype's `.menu .seg` fills the menu
  with equal buttons, so it needs a full-width form (a `className` or a layout option).
- **Keeping it open:** Radix closes the menu on a `DropdownMenuItem`'s select, not on a plain `<button>` inside the
  content, so plain buttons keep it open, as the PRD wants. **But Radix's menu takes only its items into the keyboard
  order:** arrow keys move among items, and Tab is prevented inside the content. So three plain buttons cannot be reached
  without the mouse. Proposal P2.
- **Wording:** as the prototype: the heading "Theme", the buttons "Light", "Dark", "System", between "Workspace home"
  and "Sign out", with a separator on each side (the existing one before "Sign out" and a new one before the heading).

### Q7. The cookie

- **Name and value:** `im-theme`, `light` or `dark`; System deletes it (`max-age=0`). Any other value reads as System.
  `Path=/`, `SameSite=Lax`, a year's `Max-Age` (`SIDE_PANELS_COOKIE_MAX_AGE`'s 365 days), not `HttpOnly`. It is not per
  person: the sign-in page has no person. Its rules (name, parse, the cookie's text) go into a pure module,
  `src/ui/theme.ts`, read by the root layout and written by the menu, with a unit test.
- **How the browser writes it:** as the side panels, the document panels and the working context do
  (`document.cookie = …; path=/; max-age=…; samesite=lax`; there is no shared helper, each writes its own line). The menu
  writes its own line, so no `Set-Cookie` comes from a server action (which would make Next.js refresh the page).
- **Who else touches it:** nobody.
  - The proxy (`src/proxy.ts`) writes only the last-workspace and last-project preference cookies and Supabase's, and
    reads only the session's, so `im-theme` passes through, on the thumbnail's path too (AD-32: no `Set-Cookie` there,
    unchanged).
  - Sign-out deletes only the development session cookie, or Supabase's through `auth.signOut()`
    (`src/app/_actions/session.ts`), so the choice stays after signing out, as S32-02 wants; e2e checks it.
  - `isSupabaseAuthCookie` does not match the name.
- **The e2e runs:** Playwright gives every test a fresh browser context and the configs set no `storageState`, so a
  spec's cookie never reaches another test. The four specs that add cookies (S0-01, slice 3b's helpers, S5A-02, S28-01)
  add their own names only. The default emulated scheme is light, so with no cookie every earlier spec sees today's
  page.

### Q8. Tests and risks

- **Earlier specs that emulate a scheme:** the `*-screens` specs (slices 10b, 11, 12a, 12b, 13, 14a, 14b, 15a, 22, 23,
  24; on demand with `SCREENS`, not in the full run) and `S12B-browsers` (on demand, `BROWSERS=1`). They set no cookie,
  so they keep System and follow the emulated scheme as today. No change.
- **Specs that read colours** (about 30 with `getComputedStyle`, `toHaveCSS` or `rgb(`): all under Playwright's light
  default with no cookie, so their values stay. No change expected.
- **Specs on the person's menu:** S0-03 (`menu-user` contains the e-mail, `menu-user-role`), slice 0's sign-out helper
  (clicks `button-sign-out`), S6A-10 (the indicator always visible), S8-08 and S30-09-room (the role label). A section
  added between the links and "Sign out" changes none of these. No change expected.
- **No earlier test is changed**, unless step 2 finds one; then it is listed with its reason.
- **The new specs** (`e2e/slice-32/`, joining the last part, from `slice-22`, by the recut rule):
  - S32-01: the section and its three states, System pressed by default with no attribute on `<html>`; Dark and Light
    each change `--im-surface` and the canvas's background at once, under the opposite emulated system, on the canvas
    page with a panel and a dialog open; the menu stays open after each click; System follows `emulateMedia` both ways.
  - S32-02: the cookie written and deleted; **the first paint** in a context with JavaScript disabled
    (`javaScriptEnabled: false`), where the body's background and `--im-surface` on a reload are the chosen theme's,
    which proves no script is needed; the choice kept after sign-out and on `/sign-in`, in a second workspace and in a
    new context with the cookie only; a fresh context is at System; the e2e data file unchanged by a choice (no write,
    no change event).
  - S32-03: a thumbnail's shapes take the chosen theme's tokens before and after a switch (Q4); InfoDocumenter's laid-out
    page and the quick sheet keep their light colours under Dark while the editor's panels turn dark (Q5); `color-scheme`
    on `<html>` and a `<select>`'s computed colour scheme follow the choice.
  - S32-04: with no cookie, the root's tokens equal the palette's light values and, under a dark emulated system, its
    dark values, exactly as before the slice.
  - S32-05: CI, the Schema workflow and the full run, from the report.
  - **Unit:** `src/ui/theme.test.ts` (parse: `light`, `dark`, anything else and none as System; the cookie's text for
    each choice) and the guard test from Q2.
- **The smoke set on Postgres:** no data is involved, so nothing is required. P9 proposes one small check there anyway.
- **Full runs:** step 2 (the root layout and the shared CSS, as the PRD plans; the CSS change restyles every page) and
  step 4 (the closing commit). Steps 1 and 3 need none.
- **Risks found in the code:** the other tabs and Back from the browser's cache (P3), the keyboard in the menu (P2),
  `color-scheme` under a dark Windows (P1), and the restyle on a click (P10).

## Where the PRD is wrong, incomplete or costs more, with proposals

- **P1. `color-scheme` and "System looks as today" contradict each other under a dark Windows.** Today no
  `color-scheme` is set, so under a dark system the scroll bars, `<select>` lists and check boxes are light. The PRD's
  `light dark` for System makes them dark there too. That is a visible change for System under a dark Windows (S32-01,
  S32-04: "looks as today"), though it is what S32-03 wants for Dark ("no white fields in Dark").
  **Proposal:** `light dark` for System as the PRD says, recorded as the one intended change to System. Under a light
  Windows nothing changes. **Łukasz decides** (decision 1).
- **P2. The menu's buttons and the keyboard.** Plain buttons keep the menu open but are unreachable from the keyboard
  inside Radix's menu (arrows move among items only; Tab is prevented). **Proposal:** three Radix radio items
  (`DropdownMenuRadioGroup` with `DropdownMenuRadioItem`, `onSelect` calling `preventDefault()` so the menu stays open),
  drawn as the segmented control, the group named by the "Theme" heading. Arrows reach them, Enter or Space chooses, and
  Escape closes as today. The difference from the prototype is in ARIA only: `menuitemradio` with `aria-checked`, not
  buttons with `aria-pressed` (an `aria-pressed` on a `menuitem` is not valid ARIA). Tests read `aria-checked`.
  The alternative, the prototype's buttons with `aria-pressed`, would be reachable by the mouse only. **Łukasz decides**
  (decision 2).
- **P3. Other tabs and Back from the browser's cache.**
  - **Another tab** stays in its old theme until it loads a page again. Since the root layout renders again on
    `router.refresh()`, which follows a refused write, that tab would switch suddenly in the middle of the work after
    such a write. Its menu would also still mark its old choice if the menu kept the choice as state.
  - **Back to a page restored from the browser's back-forward cache** (after a typed address,
    `docs/known-limitations.md`) shows the theme the page had when it was left.

  **Proposal:**
  - one small client listener in the root layout that applies the cookie's value to `<html>` on `pageshow` (restored
    from the cache) and on `visibilitychange` (the tab shown again). It renders nothing and is not a re-render of the
    canvas;
  - the menu reads the current attribute each time it opens, not a value held since the page loaded.

  The alternative is to leave both as known limitations. **Łukasz decides** (decision 3); I recommend the listener.
- **P4. `global-error` has its own `<html>`** (Next.js's root error page, a client component). It cannot read the cookie
  on the server and so shows System. **Proposal:** leave it (it shows only when the root layout itself fails), and note it
  in `known-limitations.md`. No code.
- **P5. The selectors' form.** The PRD writes `:root:not([data-theme="light"]) { … }` inside the media query and
  `:root[data-theme="dark"] { … }`. The variant gives `:where(…)` forms with the same effect. The values have one source
  without a copy (Q2), with the guard test. `canvas.css` needs one `@reference` line, which the PRD does not mention.
- **P6. Thumbnails need no change** (Q4). The PRD's risk and its suggested changes (the theme in the address, the
  colours as variables) do not apply: the colours are already the page's variables. Only the test is new.
- **P7. The first paint's test.** "Read before any script" is measured most simply with JavaScript disabled in the
  test's context: the server's HTML and CSS alone must paint the chosen theme. This replaces timing the first paint.
- **P8. "A group named Theme":** `DropdownMenuLabel` names nothing by itself; the group gets `aria-labelledby` with the
  heading's id (with P2's radio group, or `Seg`'s `labelledBy`).
- **P9. The preview.** S32-01 says "the same locally and on the preview", and the e2e run uses the dev server only.
  **Proposal:** one small spec in the smoke set (`e2e/slice-29`, Postgres, a production build in CI's Supabase stack):
  with `im-theme=dark` set, a reload of the workspace home paints dark (the body's
  background), and System is restored. About 30 lines, no data. The alternative is Łukasz's manual check alone, as the
  PRD says. **Łukasz decides** (decision 4).
- **P10. The click restyles the whole page.** CLAUDE.md warns against a page-wide class over the canvas (S5A-08: 75–140 ms
  per switch in the dense view). Here that is the point and happens on a person's rare click, never during work on the
  canvas. **Proposal:** no measuring sitting and no gate ("When to measure": the slice does not change how the canvas is
  drawn), and no reference figure unless Łukasz wants one.
- **P11. The full path's reason.** The PRD's list (the root layout, `globals.css`, `canvas.css`, Tailwind's `dark`
  variant, the top bar's menu) is not on CLAUDE.md's list of shared infrastructure (undo and change groups, the save
  chain, the canvas's layers, the table registry, the local adapter). The full run in step 2 stands because the PRD plans
  it and the CSS change restyles every page. A CSS change of the canvas's dark rules is close to "the canvas's layers" in
  spirit, though it adds no layer.
- **P12. No data, confirmed.** The theme writes no row, no change event and no undo step. It reads no port and touches no
  adapter, migration or schema, so there is no `pg:migrate` and both adapters are equal by construction. The contract
  suite needs no case.

## Differences between the prototype and the app that this slice touches

| # | Prototype | App today | After the slice (proposal) |
| --- | --- | --- | --- |
| 1 | The person's menu: "Theme" and `seg-theme` (Light, Dark, System) between "Workspace home" and "Sign out" | No section | The section, as the prototype; radio items if P2 is accepted |
| 2 | The choice in memory (lost on reload) | – | The cookie `im-theme`, read by the server |
| 3 | Dark tokens under the media query with `:not([data-theme="light"])` and under `[data-theme="dark"]` | Under the media query only | Both, through the variant (Q2) |
| 4 | No `color-scheme` | None (InfoDocumenter's pages `light`) | `light dark` / `light` / `dark` (P1) |
| 5 | `.menu .seg`: full width, equal buttons | `Seg` is `inline-flex` | A full-width form |
| 6 | Buttons with `aria-pressed` | – | `menuitemradio` with `aria-checked` (P2) |
| 7 | The prototype's menu keeps the "Prototype only" items (server name, failing a change) | Not in the app (D-84) | Unchanged |

Not touched: the prototype's dark values themselves (the app's are the same as today; no new colours), the canvas looks,
the notes' papers and the coverage marks.

## The plan for steps 2 to 4

**Step 2. The theme** (one or more commits; a draft PR into `dev` at the start; **a full run** at the end).
1. `src/ui/theme.ts`: `THEME_COOKIE`, `parseTheme`, the cookie's text per choice; `src/ui/theme.test.ts`.
2. `src/app/layout.tsx`: `cookies()`, `data-theme` on `<html>`; if P3 is accepted, the listener (`pageshow`,
   `visibilitychange`), mounted in the root layout beside `NoBrowserMenu`.
3. `globals.css`: the variant with both branches; the four dark blocks under `@variant dark`; `color-scheme` (P1).
   `canvas.css`: `@reference "../app/globals.css"`, its two blocks under `@variant dark`. `tests/theme-css.test.ts`.
4. `top-bar.tsx`: the section in `UserIndicator` (P2's form, P8's name), writing the cookie, then the attribute; it reads
   the attribute when the menu opens.
5. `e2e/slice-32/` (S32-01 to S32-04, fixtures and helpers from slice 0's plain seed; the document parts with slice 25's
   "docs" seed); if P9 is accepted, the smoke spec.
6. The step's report: the slice's specs, the earlier specs it touches (slice 0, S6A-10, S8-08, slice 12b, slices 25 to
   28, S30-09-room), lint, typecheck, unit tests, CI, the Schema workflow and the full run's link and numbers.

**Step 3. Łukasz's acceptance**, with no code unless it finds something:
- on `npm run dev` (the local adapter);
- on `npm run dev:pg` with a demo account, from this branch's checkout, after **`pg:backup`** (AD-39's note; Łukasz runs
  it). `dev:pg` writes to `infomapper-dev`, which `dev`'s preview shares. The theme writes nothing, but anything he edits
  during the acceptance is written there.

The preview runs `dev`'s code only, so the theme reaches it after the merge. Stop with what he saw.

**Step 4. Close:**
- the docs: `decisions.md` (D-85 and AD-31's note, quoted in full for approval), `ideas.md` (the idea done),
  `known-limitations.md` (the choice per browser, not per account; P4; P3 if not accepted), `inventory-prototype-vs-app.md`
  (the menu's section), the README and CLAUDE.md (the cookie, the variant as the one source, the theme in tests, the
  guard test);
- one full run on the final commit, after merging `dev` into the branch;
- the manual acceptance steps.

The merge into `dev` and the tag `slice-32` only on Łukasz's command, with `pg:backup` before the merge.

**Full runs:** step 2 and step 4. Steps 1 and 3: none.

## What Łukasz decides before step 2

1. **P1:** `color-scheme: light dark` for System, so native controls turn dark under a dark Windows (a visible change to
   System there), or System left exactly as today (no `color-scheme` without a choice). Recommended: `light dark`.
2. **P2:** the menu's choice as radio items (keyboard, `aria-checked`) or as the prototype's buttons (`aria-pressed`,
   mouse only). Recommended: radio items.
3. **P3:** the small listener for other tabs and Back from the browser's cache, or both as known limitations.
   Recommended: the listener.
4. **P9:** one smoke spec on Postgres (a production build), or the manual check on the preview alone. Recommended: the
   spec.

Also to confirm: no measuring sitting and no reference figure (P10); `global-error` as a known limitation (P4).

## Łukasz's answers (20 November 2026)

Łukasz decided P1 and P2. P3, P4, P9 and P10 are Claude's technical calls, accepted and to be quoted for his approval
at the closing. The other proposals are accepted as written.

- **P1: yes.** `color-scheme: light dark` for System: native controls follow a dark Windows. The PRD's "System looks as
  today" reads "as today, except native controls, which now match".
- **P2: radio items** for keyboard access, keeping the prototype's look: the three choices in one row as a segmented
  control (`aria-checked`). If that cannot be done cleanly with Radix's menu, stop before building it and show two
  screenshots (the segmented row, and three rows with a check) for him to choose.
- **P3: yes,** the `pageshow` and `visibilitychange` listener.
- **P4: yes,** `global-error` shows System; recorded in `known-limitations.md`.
- **P9: yes,** one small smoke spec on Postgres.
- **P10: yes,** no measuring sitting.

## Decision texts (proposals, to be quoted in full at the closing)

- **AD-31 (note):** as the PRD's section 8.
- **D-85 (new): the theme.** As the PRD's section 8, with the answers above. Light, Dark or System (the default) in the
  person's menu, as a section "Theme" between "Workspace home" and "Sign out", which stays open on a choice. A cookie
  `im-theme` per browser (`light` or `dark`; System deletes it) that the server reads. `data-theme` on `<html>` from the
  first paint. The dark values written once under Tailwind's `dark` variant, which is the media query while no theme is
  chosen and the attribute when one is. `color-scheme` follows the choice. Thumbnails follow it through their `<use>`
  (AD-32 unchanged). InfoDocumenter's pages stay light.

## Step 2: the build against the plan

Built as planned (`src/ui/theme.ts`, the root layout, the two CSS files with the guard test, the menu's section, the
specs and the smoke spec). The differences:

- **The menu's choice is its own component** (`src/app/_components/theme-choice.tsx`), not `Seg`. P2 needs Radix's
  `RadioGroup` and `RadioItem` (`menuitemradio`, `aria-checked`), which `Seg`'s buttons are not. Drawn with `Seg`'s classes
  (the row on `im-hover`, the chosen one on `im-surface` with its line and shadow). The segmented row works cleanly
  in Radix's menu, so no screenshots for a choice were needed.
- **The keyboard moves along the row with ↓ and ↑,** Radix's vertical menu order (Light, Dark, System, then
  "Sign out"), not ← and →: in a Radix menu those open and close submenus. Enter and Space choose; the menu stays open.
- **The focus ring shows on keyboard focus only** (`focus-visible`); a hovered choice only darkens its text, as the
  prototype's.
- **The listener** (`ThemeSync`) and the click (`chooseTheme`, cookie first) are in `src/ui/theme-sync.tsx`, mounted in
  the root layout beside `NoBrowserMenu`. The menu reads the shown theme from `<html>` each time it opens.
- **The CSS build writes `color-scheme` as Lightning CSS's own variables too** (`--lightningcss-light`,
  `--lightningcss-dark`, its fallback for `light-dark()`); the app uses neither. The computed `color-scheme` is as
  planned. It also writes `#ffffff` as `#fff`; the specs compare six-digit hex.
- **The guard test compiles `globals.css`** with `@tailwindcss/node`'s `compile` (the version the build uses), so it checks
  the expanded rules, not only the source. `@tailwindcss/node` comes in through `@tailwindcss/postcss`; it is not in
  `package.json` itself. Proposal: leave it so (the build cannot run without it), or add it to `devDependencies` at the
  same version. Łukasz's choice.
- **The smoke spec** is `e2e/slice-29/S32-smoke-theme.spec.ts` (the smoke set's folder, `POSTGRES_ONLY_FOLDERS`). It
  writes nothing, so it runs against any target (CI's local stack, `dev:pg`, the preview).
- **`known-limitations.md`'s entry for P4** is written in this step, as Łukasz asked, not at the closing.
- **The screenshots** of the menu in Light and Dark are attachments of S32-01's second test (`menu-light`,
  `menu-dark`) in the run's report.
