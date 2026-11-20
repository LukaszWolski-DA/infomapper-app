# Slice 32 – The theme: Light, Dark or System chosen in the app

Status: **proposed** (20 November 2026). Proposed by Łukasz on 19 November 2026 (`docs/ideas.md`, "A light, dark or
system theme chosen in the app"). **Full path** (CLAUDE.md, "The slice cycle", 2): shared infrastructure (the root
layout, `globals.css`, `canvas.css`, Tailwind's `dark` variant, the top bar's person menu). Branch `slice/32-theme`, from
`dev` (`6a6e7d7` or later), with the idea's commit `5980313` from `chore/ideas-theme-switch` brought in. PRD file:
`docs/prd/slice-32-theme.md`; step 1 writes `docs/prd/slice-32-acceptance.md`. Test regime: CLAUDE.md, "Testing". Slice
number 32 is an assumption (the next free number); step 1 confirms.

**An exception to AD-31** ("no new feature slices during the database program"), Łukasz, 20 November 2026: the theme
touches no data layer, so it does not interfere with the program; the people slice and slice D follow it.

It has a **prototype change**, accepted by Łukasz on 20 November 2026. Both files are in Łukasz's Downloads folder (The
slice cycle, 3):

| File | SHA-256 |
| --- | --- |
| `slice-32-theme.md` | given in the prompt |
| `infomapper-prototype-with-sources.html` | `08a70d3b5a3fbe3f44acd90204d0ed63e4fcac2e9af9291c16b96ef9d670d1d1` |

Written from the decision rounds of 20 November 2026 (no file in the repository; quoted as "T1"), the idea, the
prototype and a few lookups in the code on `dev` at `6a6e7d7` (marked "fact, `6a6e7d7`"). Facts and assumptions are
marked; every assumption is to be checked in step 1.

## 1. Why

Today the app follows the system's or the browser's theme only: there is no control in the app. Łukasz works in KB online
every day since the switch (AD-39's note) and wants to choose the theme himself, independently of Windows' setting.

Decisions taken before this PRD (round T1, Łukasz, 20 November 2026):
- **T1.1 (a): the choice is in the person's menu** (`menu-user` in the top bar): a section "Theme" with Light / Dark /
  System. No room is taken in the full top bar.
- **T1.2 (a): remembered by a cookie per browser that the server reads**, as the idea says (like the side panels'), so
  the first paint is right. No data change, no migration; another browser or device starts at System.
- **System is the default** and behaves as the app does today.

## 2. What to build

### The choice (the prototype)

- In the person's menu, between "Workspace home" and "Sign out", separated by rules: a small heading "Theme" and a
  segmented control with three buttons **Light**, **Dark**, **System** (`aria-pressed` on the chosen one; a group named
  "Theme"). As the prototype: the menus' small section heading and their segmented control.
- A click applies the theme at once to the whole page (no reload, no round trip needed to see it), writes the cookie and
  **keeps the menu open**. Escape and a click outside close it as today.
- Wherever the person's menu exists (every page with the top bar, the document editor's top bar included if it has the
  menu; step 1 lists them). The sign-in page has no menu but follows the cookie.

### How it works (the idea, proposals for step 1 to confirm)

- **`<html>` carries the choice:** `data-theme="light"` or `data-theme="dark"`; none for System. Rendered by the root
  layout from the cookie on the server, so the first paint is right (no flash) and no script runs before paint.
- **The dark values** keep their media query for System and gain the same values under the attribute, as the prototype
  does: `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { … } }` and
  `:root[data-theme="dark"] { … }`. Fact, `6a6e7d7`: six places use the media query (`src/app/globals.css` lines 6, 44,
  81, 185; `src/canvas/canvas.css` lines 319, 446), line 6 being Tailwind's `dark` variant
  (`@custom-variant dark (@media (prefers-color-scheme: dark))`). Proposal: the variant becomes "the attribute dark, or
  the media query while the attribute is not light", so every `dark:` utility follows the choice without being rewritten.
  One source for the values (no copy that can drift): step 1 proposes how (a shared block, a mixin, or the variant).
- **`color-scheme`** on `:root` follows the choice (`light`, `dark`, or `light dark` for System), so native form
  controls, lists and scroll bars match (criterion 3).
- **The cookie:** one cookie per browser, not per person (the sign-in page has no person). Proposal: `im-theme`, values
  `light` / `dark` (System = the cookie deleted), `Path=/`, `SameSite=Lax`, a year's `Max-Age`, written by the browser
  (as the side panels' and the document panels' cookies, fact `6a6e7d7`: `src/ui/side-panels-cookie.ts`,
  `src/modules/infodocumenter/ui/panels-cookie.ts`); any other value is ignored as System. Not `HttpOnly` (the browser
  writes it). The proxy writes no preference cookie on resource paths (AD-32): unchanged.

### The special places (criterion 3)

- **Thumbnails (AD-32):** a canvas thumbnail is a route's drawing, cached for good under a key of its content. **Risk
  (assumption):** if a page shows it as an `<img>`, it cannot read the page's attribute and follows the system through
  its own media query, not the choice; if it is drawn through `<use>` into the page (the idea's note), it takes the
  page's tokens and follows the choice. Step 1 says which, and proposes the smallest change if it does not follow (for
  example the theme in the address as part of the key, or the drawing's colours as the page's variables).
- **InfoDocumenter's pages** (the editor's pages, the print preview, print and PDF) stay light in every theme. Fact,
  `6a6e7d7`: `src/modules/infodocumenter/ui/document-css.ts` sets `color-scheme:light` on the page; step 1 checks that
  no dark token reaches a page under `data-theme="dark"` (the editor around the pages follows the theme).
- **The canvas** (React Flow, `canvas.css`), its menus, dialogs, panels, toasts and the minimap follow the theme.

### Tests

- **e2e (the local adapter):** the menu's section and its three states; a click changes the page's tokens at once and
  keeps the menu open; the cookie written; **a reload paints the chosen theme at once** (the first paint's tokens, read
  before any script; a measurable check, not a screenshot); the sign-in page follows the cookie; System follows the
  emulated `prefers-color-scheme` in both directions, Light stays light under a dark system and Dark stays dark under a
  light one; a thumbnail and InfoDocumenter's page as criterion 3 says; `color-scheme` follows.
- **Unit:** the cookie's parsing (unknown values as System).
- **Earlier specs** that emulate a colour scheme or read colours: listed in step 1, changed only with a reason.
- The smoke set on Postgres: nothing new needed (no data); step 1 confirms.

### Not in this slice

The choice stored in the account (T1.2 (b)); new colours or a redesign of the dark values; a theme for InfoDocumenter's
pages; a keyboard shortcut; anything in the data, schema or adapters.

## 3. Data model

**None.** No table, column, migration or adapter change. KB and the demo are not touched; no `pg:migrate`.

## 4. Sources

- **Decisions:** AD-32 (thumbnails, the proxy's resource paths), AD-31 (the exception), D-84 (the top bar's right
  corner and its room rules); round T1 above.
- **The idea:** `docs/ideas.md` on `chore/ideas-theme-switch` (`5980313`).
- **Code (fact, `6a6e7d7`):** `src/app/layout.tsx` (`<html>`), `src/app/globals.css`, `src/canvas/canvas.css`,
  `src/app/_components/top-bar.tsx` (`menu-user`), `src/ui/side-panels-cookie.ts`,
  `src/modules/infodocumenter/ui/document-css.ts`, `src/app/w/[workspaceId]/thumbnail/[canvasId]/route.ts`.
- **The prototype:** the person's menu (`#tUser`, `THEMES`, `setTheme`) and its dark tokens under both selectors.

## 5. Steps

Stop after each step; wait for Łukasz.

1. **Reconnaissance and check.** Copy this PRD and the prototype from Downloads into the repository and check both with
   `cmp` and the SHA-256 (stop if either differs). Bring in `5980313` from `chore/ideas-theme-switch`. Answer Q1–Q8 in
   `slice-32-acceptance.md`; every place where the PRD is wrong or costs more than it assumes, with a proposal; the
   differences between the prototype and the app this slice touches; the earlier specs and tests each step touches; the
   plan for steps 2 to 4. No application code.
2. **The theme:** the attribute from the cookie in the root layout, the dark values under both selectors, Tailwind's
   variant, `color-scheme`, the menu's section, the cookie; the special places (Q4, Q5); the tests. A draft PR into
   `dev`. A full run.
3. **Łukasz's acceptance** on `npm run dev:pg` with a demo account (AD-39's note: acceptances use demo accounts only),
   and on `npm run dev` locally; **`pg:backup` before it** (AD-39's note). **Stop** with what he saw.
4. **Close.** The docs and the decisions quoted in full for approval (section 8); one full run on the final commit.
   Merge into `dev` and tag `slice-32` only on Łukasz's command, with `pg:backup` before the merge (AD-39's note).

## 6. Acceptance criteria

Łukasz's criteria 1 to 4 (20 November 2026).

| ID | Criterion |
| --- | --- |
| S32-01 | **The choice.** The person's menu has a section "Theme" with Light / Dark / System; System is chosen by default and the app looks as today. Dark makes the whole app dark at once without a reload (the canvas, panels and dialogs included); Light makes it light even when Windows is dark; System follows Windows. The menu stays open after a click. The same locally and on the preview. (Criterion 1.) |
| S32-02 | **Remembered.** After choosing Dark, a reload is dark from the first moment, with no flash of light. The choice stays after closing and reopening the browser, after signing out, on the sign-in page and in every workspace. Another browser or device starts at System. The choice changes nothing in the data or in KB. (Criterion 2.) |
| S32-03 | **The special places.** Canvas thumbnails on the workspace and project homes show the chosen theme's colours, not the system's, and do not keep old colours after a change. InfoDocumenter's pages (the editor's pages and the print preview) stay light in every theme; print and PDF look as today. Form fields, drop-down lists and scroll bars match the theme (no white fields in Dark). (Criterion 3.) |
| S32-04 | **Nothing breaks.** With no choice everything looks as today (System by default) and the full run passes; new e2e tests cover the three choices and the remembered choice, with no flash after a reload (the right theme from the first paint); no change in the data, schema or adapters, KB and the demo untouched, no `pg:migrate`; Łukasz accepts on `npm run dev:pg` with a demo account, with `pg:backup` before the acceptance and before the merge. (Criterion 4.) |
| S32-05 | CI, the Schema workflow, the full run before the merge; every earlier test changed, with its reason. |

**Manual acceptance:** Łukasz, step 3: S32-01 to S32-03 on `dev:pg` with a demo account and on `npm run dev`; S32-04
from CC's report.

## 7. Questions for step 1

- **Q1. Every dark value and every `dark:` utility.** The six media queries, every `dark:` class in `src/`, any colour
  read from `matchMedia('(prefers-color-scheme: dark)')` in script (the canvas, charts, figures, the minimap); whether
  today's dark values cover the whole app (the assumption behind "no new colours"), with the places they miss.
- **Q2. One source for the values.** How the values sit under both selectors without a copy that can drift (Tailwind
  v4's `@custom-variant`, a shared block); the proposal and what it changes in the two CSS files.
- **Q3. The first paint.** The root layout reading the cookie (it makes every page dynamic: which pages are static
  today, the sign-in page among them, and what that costs); the attribute and `color-scheme` on `<html>` before any
  script; React's hydration with the attribute changed by a click (no mismatch warning).
- **Q4. Thumbnails.** How a page shows a thumbnail (`<img>`, an `<object>`, `<use>` of an external file, inline), how
  its colours are set, whether it follows the choice today under a dark system; the smallest change if not, and its
  effect on AD-32's cache and key.
- **Q5. InfoDocumenter.** The editor's pages, the print preview, print and the PDF figures under `data-theme="dark"`;
  any token that reaches them.
- **Q6. The menu.** The person's menu in every top bar (the document editor's too); the menus' heading and segmented
  control in the app's components; keeping the menu open on a click (Radix's `DropdownMenu` closes on select by
  default); the wording.
- **Q7. The cookie.** Name, attributes and parsing; how the browser writes it (the side panels' helper); whether the
  proxy or any route touches it; the e2e runs' cookies (a spec's theme must not leak into another).
- **Q8. Tests and risks.** Earlier specs that emulate a colour scheme or compare colours or screenshots; the new specs;
  which steps need a full run; anything in the code that changes this plan.

## 8. Decisions (proposals) and docs

Quoted in full at the closing for Łukasz's approval; the texts below are proposals for step 1 to correct.

- **AD-31 (note):** "Slice 32 (the theme) is an exception to "no new feature slices during the database program"
  (Łukasz, 20 November 2026): it touches no data layer. The people slice and slice D follow it."
- **D-85 (new): the theme.** Light, Dark or System (the default) in the person's menu; a cookie per browser the server
  reads; `data-theme` on `<html>` from the first paint; the dark values under the media query for System and under the
  attribute; `color-scheme` follows; thumbnails follow the choice; InfoDocumenter's pages stay light.
- Docs: `decisions.md`, `ideas.md` (the idea done), `known-limitations.md` (the choice per browser, not per account;
  anything step 1 finds), `inventory-prototype-vs-app.md` (the menu's section), README and CLAUDE.md (the cookie, the
  theme in tests).

## 9. Left for later

The choice in the person's account (follows across devices); a keyboard shortcut; a dark theme for InfoDocumenter's
pages.
