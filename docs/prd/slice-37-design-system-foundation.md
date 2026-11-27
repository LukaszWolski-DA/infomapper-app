# Slice 37 – Design system foundation

Status: **proposed** (26 November 2026). The first of the design system pair (slice 37: the foundation, the look; slice
38: the layout). **Full path** (CLAUDE.md, "The slice cycle", 2), because it touches every screen and the shared UI
components, adds a guard test and a check script, and changes earlier e2e specs' surroundings; it changes no data. Branch
`slice/37-design-system-foundation`, from `dev` (`b79495f` or later). PRD file:
`docs/prd/slice-37-design-system-foundation.md`; step 1 writes `docs/prd/slice-37-acceptance.md`. Test regime:
CLAUDE.md, "Testing". The slice number is an assumption (step 1 confirms it is the next free one).

**Two files in Łukasz's Downloads folder** (The slice cycle, 3):

| File | SHA-256 |
| --- | --- |
| `slice-37-design-system-foundation.md` | given in the prompt |
| `infomapper-prototype-with-sources.html` | `74c70cd919af6e65eb13f560294de42f6be03fd42d0ff082e546b6d9f0029029` |

The prototype accepted by Łukasz on 26 November 2026 replaces `docs/prototype/infomapper-prototype-with-sources.html`
(The slice cycle, 3). It is the dev prototype `6d5b5b7f…c179` with the look of the design system and, besides, the
InfoCatalog prototype (sign-in, landing zone, InfoCatalog; for later slices, not this one) and a canvas in a second
window (later). Its CSS blocks marked `/* Design system step 1 … 4 */` near the end of its `<style>` show this slice's
look and slice 38's layout together; **slice 37 takes the look only** (section 2, "Not in this slice").

Written from the decision rounds of 26 November 2026 (no file in the repository; quoted as "DS1.1" to "DS2.4"), the
audit of 26 November 2026 (quoted as "the audit"; its findings are in section 1), the design system "InfoMate Design
System" (Łukasz's artifact; its tokens and reference CSS are copied into appendices A and B, so this PRD is complete
without it), the prototype and lookups in the code on `dev` at `b79495f` (marked "fact, `b79495f`"). Facts and
assumptions are marked; every assumption is to be checked in step 1.

## 1. Why

Łukasz, 26 November 2026: align InfoMapper with InfoDocumenter, buttons that overlap, an overall review of ergonomics and
good practice for such tools, **one consistent Tailwind and CSS**; he likes the restraint of apple.com (principles, not a
copy). The audit ran the app (`dev` at `b79495f`, `npm run demo`) on 13 screens at 1280, 1440, 1920 and 390 px and found:

1. The left panel's tabs (Model · Sources · Requirements · Cube) in equal 53 px slots while "Requirements" is 78 px wide:
   2 px between words, read as "SourcesRequirements".
2. The top bar at 1440 px and less cuts the path's names to two to four letters (slice 38 moves the canvas's controls).
3. InfoDocumenter's section list (264 px) cuts names; its move and remove arrows are so pale they read as decoration.
4. On a phone (390 px) the workspace's tabs run past the edge with no sign that they scroll; the account button is cut.
5. Click targets under 24 px: the panels' icon buttons are 22 × 22 px, the status bar's buttons 17 px tall.
6. **37 kinds of button** on 13 screens (heights 8 to 32 px, radii 0, 4, 5, 6.4, 7 and 15 px, font sizes 10.5 to 15 px);
   **16 kinds of text field; 5 heights of drop-down** (the drop-down chore: 41 drop-downs with 10 class sets).
7. Grey pages (the homes and the navigation row) where the prototype is white (accepted by Łukasz on 26 November).
8. Three ways to "pick one of a few": segmented buttons, tabs and chips, each with its own size and look.

Decisions taken before this PRD (Łukasz, 26 November 2026, on Claude's recommendations):
- **DS1.1:** two slices; **slice 37 the foundation** (tokens, shared components on every screen, the drop-down chore,
  targets ≥ 24 px, one radius, white pages; **no layout change**: nothing is clicked in a new place); slice 38 the layout.
- **DS1.2:** the visible changes, all accepted as seen in the prototype (section 2, "Tokens").
- **DS1.3:** acceptance with before / after screenshots, the automatic check's report, then Łukasz's usual acceptance.
- **DS2.1:** the order of the build steps (section 5). **DS2.2:** InfoDocumenter's drop-downs get a focus ring; toolbar
  controls 26 → 28 px. **DS2.3:** generated documents, the canvas's cards and any layout change are not touched. **DS2.4:**
  the phone only as far as the components bring it.
- **Claude's technical calls** (quoted at the closing): token names stay `im-*`; components in `src/ui/components` on the
  shadcn / Radix already in use, no new library; a guard test against local control styles; the modules use the same
  components (the layer rules already allow it).
- **The typeface:** IBM Plex Sans and Plex Mono stay (Łukasz, 26 November).
- A consequence noted with criterion 3: the left panel's tabs at their natural width come with the tab row component in
  this slice (not in slice 38).

## 2. What to build

### Tokens (S37-01)

In `src/app/globals.css` (fact, `b79495f`: `:root` holds `--im-*` light values, `@variant dark` the dark ones, and
`@theme inline` maps them to `--color-im-*`; shadcn's variables are mapped onto them). **Names stay; values change as
below; new tokens are added.** The design system's names are given for reference (appendix A).

| `--im-*` | Design system | Light: now → new | Dark: now → new | Why |
| --- | --- | --- | --- | --- |
| `ink-3` | `ink-3` | `#7c8998` → `#667383` | `#798595` → `#8a96a6` | labels 4.8:1 (was 3.6:1) |
| `map` | `mapping` | `#0b8a72` → `#087a65` | `#3ecfae` (same) | 5.3:1 on white |
| `warn` | `warn` | `#c2410c` → `#b33c0b` | `#ff8b4e` (same) | 5.9:1 on white |
| `line` | `line` | `#d6dce3` → `#e2e6eb` | `#2f3944` (same) | hairlines quieter; controls get their own edge |
| `line-control` (new) | `line-control` | `#8a95a3` | `#6b7787` | edges of fields, drop-downs, check boxes: 3:1 (WCAG 1.4.11) |

Everything else keeps its value (`surface`, `panel`, `canvas`, `ink`, `ink-2`, `logical` (the design system's
`accent`), `physical` `#a0660f` (4.8:1), `req`, `rel`, the `-soft` fills, `review`, `shadow`). **The canvas's cards keep
their edge** (fact, `b79495f`: `src/canvas/canvas.css` draws cards, headers, the overview and labels with `--im-line`):
the canvas keeps today's value for its own drawing (e.g. a canvas-scoped `--im-line` or a new `--im-card-line`; Claude's
technical call, step 1 proposes the exact form), so the cards are drawn as before (DS2.3, S37-06).

New, in `@theme` (names are proposals for step 1): **control sizes** `control-md` 32 px (pages, forms, dialogs),
`control-sm` 28 px (panels, toolbars, rows), the top bar's 30 px, `target-min` 24 px; **radii** `radius-sm` 4 px (chips,
badges, cells), `radius-md` 8 px (every control), `radius-lg` 12 px (cards, dialogs, pop-overs, menus), `radius-full`;
**type** six styles (page title 24/30 600, section 15/22 600, body 13/20 400 and 500, small 12/16, the uppercase label
11/16 500 +0.06em for kinds only, code 12.5/18 mono). *Assumption:* `--radius` (0.5 rem) and its derived `sm`/`md`/`lg`/
`xl` are re-pointed to these values rather than kept beside them (Q2).

**White pages** (accepted 26 November): the workspace and project homes and the navigation row on `im-surface` (today
`im-canvas` or `im-panel`, fact to check in step 1); side panels white; only the canvas grey.

### Shared components (S37-02)

In `src/ui/components` (fact, `b79495f`: there are `button.tsx`, `dialog.tsx`, `dropdown-menu.tsx`, `toast.tsx`; button
is imported by **one** file of 167 `.tsx`). One component per control; every screen uses them; their look is appendix B
(the design system's reference CSS) translated to Tailwind classes on the tokens.

| Component | Variants and sizes | Replaces |
| --- | --- | --- |
| `Button` | roles `primary`, `secondary` (default), `quiet`, `danger`; sizes `md` 32 px, `sm` 28 px, `bar` 30 px (top bar); disabled at 45 % | local `<button className="…">` strings (37 kinds) |
| `IconButton` | 28 px in panels and toolbars, 24 px only where a row allows no more (e.g. inline in a dense list), a label for screen readers, the shortcut in its tooltip | the 22 px icon buttons |
| `Input`, `Textarea` | `md` 32 px, `sm` 28 px; `line-control` edge; focus: accent edge + 3 px `accent-soft` ring; read-only on `panel` | 16 kinds of text field |
| `Select` | a **native `<select>`** styled (Claude's technical call: 98 `selectOption` calls in `e2e/`, fact, `b79495f`, keyboard and screen readers as today); `md` 32, `sm` 28, `bar` 30; one focus ring; one disabled look | the drop-down chore: 40 native selects with 10 class sets |
| `Segmented` | 2–4 options, the track on `hover`, the chosen one white with a light shadow, 28 px (24 px inner buttons) | Draft · In review · Approved, All · Maps · Rels, IE · UML, the document options' choices |
| `Tabs` | a row of text tabs, natural width, gap 20–24 px (14 px in a 264 px panel), the selected with a 2 px accent underline, scrolls sideways with a fade at the edge when it does not fit | the workspace home's tabs, the left panel's tabs, InfoDocumenter's tabs |
| `Chip` | marks: neutral, PII (`warn`), approved (`map`), requirement, source, selected; 22 px, radius 4; the filter chip (a button) 28 px, pill | the marks' local styles |
| `Card` | hairline, radius 12, no shadow; `quiet` on `panel` | page blocks and list items' local styles |
| `Field` | label above (12/16 500 `ink-2`), hint and error lines (12/16) | the inspector's and dialogs' label + control pairs |

The existing `dialog.tsx`, `dropdown-menu.tsx` and `toast.tsx` take the tokens (radius 12, `shadow-pop`). *Assumption:*
shadcn's `button.tsx` is adapted to the roles above rather than replaced (Q3).

### The drop-down chore (S37-02, DS2.2)

From the handover (Claude's audit of `dev` at `b79495f`): menus are one `DropdownMenu` (consistent); the native
`<select>`s carry 10 class sets, 9 defined locally: 32 px forms (`inputClass` in `_panels/fields.tsx`, 19 uses, the
pattern), InfoDocumenter's `h-8` without a focus style (8), copies in baselines and settings (3, settings with
`disabled:opacity-60`), 30 px dialogs and sign-in (2), the top bar's organization switch (1), 28 px in People and
Invitations (2), the figure editor (2, 12 px), 26 px in the document editor's bar and the canvas's Changes (3, two
definitions), and the import's review step with no height (1). All become `Select` in its three sizes; visible changes
accepted: InfoDocumenter's focus ring, 26 → 28 px in toolbars.

### Targets and collisions (S37-03)

Every click target at least 24 × 24 px; icon buttons in panels 28 px; the status bar's buttons 24 px (the bar is 28 px;
fact, `b79495f`, to check); the navigation row's path buttons 24 px; collapsible section headers in the inspector at
least 28 px. The left panel's tabs at their natural width (fits 263 px at 1280 px in the prototype). Exceptions, named:
the canvas's cards (they scale with zoom) and links inside a sentence (WCAG's inline exception).

### InfoDocumenter, InfoCube, the pages outside a workspace (S37-04)

InfoDocumenter's editor: its bar's controls 28 px (`Button sm`, `Select sm`), its drop-downs with the focus ring; the
section list's move up, move down and remove as `IconButton` 28 px, shown on hover, on the selected section and on
keyboard focus, clearly dimmed (`opacity .3`) when not possible, the section's name using the row's full width otherwise
(the prototype's step 2); the options panel's choices as `Segmented`; fields 32 px. **The bar's layout stays** (slice
38). InfoCube's panels and dialogs: the same components. Sign-in, invitation, password reset, change password and the
error pages: `Input` and `Button` md.

### The automatic check (S37-03)

A Playwright script in the repository (name proposed: `scripts/ui-check.ts`, `npm run ui:check`; step 1 proposes) that
opens the demo (`npm run demo`, the local adapter, the development sign-in as the test user) and visits: the workspace
home's tabs, the project home, the canvas with nothing selected and with an entity, an attribute, a source table, a
mapping, a requirement, a note and an InfoCube mapping selected, the left panel's four tabs, InfoDocumenter's editor
(a document and a section selected), InfoCube's panels; at 1280, 1440 and 1920 px, light and dark, and at 390 px. On
each screen it lists: controls overlapping another by more than 2 px (one not inside the other); controls past the
screen's edge; buttons smaller than 24 × 24 px; text cut without an ellipsis (`overflow` hidden or clip, `scrollWidth`
over `clientWidth`, `text-overflow` not ellipsis); a page wider than the screen; and an inventory of every control's
height, font size, radius and border, grouped into kinds. It writes a Markdown report and the screenshots. The rules are
those of Claude's audit script (Q6). **It is not part of the e2e run** (no shared infrastructure changes); CC runs it
before and after the slice and attaches both reports.

### The guard (S37-05)

A test (like `tests/class-placeholder-guard.test.ts`) scans `src/**/*.tsx` outside `src/ui/` and refuses: `rounded-[…]`
and `h-[…px]` on `<button>`, `<input>`, `<select>`, `<textarea>`; a `<select>` that is not the shared `Select`. A probe
file it must refuse ships with it (as `tests/layer-rules.test.ts` does, AD-33). Exceptions are listed in the test with
their reason (the canvas's cards and nodes; anything step 1 finds). CLAUDE.md gets a short section: the components, the
rule, the check script.

### Before / after screenshots (S37-01)

The check script's screenshots at the start of step 2 (before) and at the end of step 8 (after), same screens, same
demo data, light and dark; CC puts them side by side in one Markdown page (not committed; attached to the report, or a
folder in `.data/`, step 1 proposes) for Łukasz.

### Tests

- Unit: the guard (and its probe); the components' variants (classes per role and size), `Select`'s sizes and its
  disabled and focus states; the theme test (`tests/theme-css.test.ts`) still passes with the new dark values.
- Snapshot of generated documents: the demo's documents' Markdown and the HTML behind their PDF compared as text before
  and after (S37-06); *assumption:* a test of this kind exists for Markdown (step 1 says, Q7).
- E2E: no new spec is needed for the look; every earlier spec passes; a spec changed only for a class or a structure,
  listed with its reason (S37-06).

### Not in this slice

The canvas toolbar and the slim top bar; InfoDocumenter's bar in one row of 48 px; the homes without side panels and in
two columns; list rows where the name wins; the top bar on a phone (all slice 38). The canvas's cards. Generated
documents' styles. InfoCatalog (its own slices). A canvas in a second window. A "?" sheet of shortcuts (the audit, item
12; later).

## 3. Data model

None. No migration, no change to the local file, no Vercel, GitHub or Supabase settings.

## 4. Sources

- **Decisions:** AD-19 (layers), AD-20 (Tailwind and shadcn), AD-21, AD-33 (modules, the layer rules' test), D-85 (the
  theme: dark values written once under `@variant dark`, `tests/theme-css.test.ts`).
- **Code (fact, `b79495f`):** `src/app/globals.css`, `src/canvas/canvas.css`, `components.json`, `src/ui/components/*`,
  `src/app/_panels/fields.tsx` (`inputClass`), `src/app/_components/top-bar.tsx`, `src/app/_panels/status-bar.tsx`,
  the left panel's tabs, InfoDocumenter's editor (`src/modules/infodocumenter/ui/…`), InfoCube's panels
  (`src/modules/infocube/ui/…`), the sign-in pages (`src/app/sign-in`, `invite`, `reset`), `tests/class-placeholder-guard.test.ts`,
  `tests/layer-rules.test.ts`, `tests/theme-css.test.ts`.
- **The prototype:** its `<style>`'s blocks `/* Design system step 1 … 4 */` (the look; layout parts are slice 38's),
  `.btn`, `.tb`, `.seg`, `.ib`, `.fld`, `#status .sb-chk`, `aside .tabs`, `.de-sa`, `.dseg`.
- **Appendices A and B:** the design system's tokens and reference CSS.

## 5. Steps

Stop after each step; wait for Łukasz.

1. **Reconnaissance and check.** Copy this PRD and the prototype from Downloads into the repository (the prototype
   replaces `docs/prototype/infomapper-prototype-with-sources.html`) and check both with `cmp` and the SHA-256 (stop if
   either differs). Answer Q1–Q10 in `slice-37-acceptance.md`: the inventory of controls per screen (how many of each
   kind, where), the plan of components and the files each step touches, every place where the PRD is wrong or costs
   more than it assumes, with a proposal; the earlier specs each step touches; the plan for steps 2 to 10. No
   application code.
2. **Tokens, components, the guard and the check script.** The tokens (light and dark), the components with their unit
   tests, the guard with its probe and its exceptions list (the files not yet converted listed as "to convert", emptied
   step by step), the check script; its first run on `dev`'s look (**before**: report and screenshots). A draft PR into
   `dev`.
3. **The side panels and the inspector** (the left panel's tabs, trees, lists, the inspector's fields and sections).
4. **The top bar, the navigation row and the status bar** (look only; no control moves).
5. **The workspace and project homes, settings and dialogs** (white pages included).
6. **InfoDocumenter's editor.**
7. **InfoCube's panels and dialogs.**
8. **Sign-in, invitation, password reset and the error pages;** the guard's "to convert" list empty; the check script
   (**after**: report and screenshots, side by side with step 2's); a full run.
9. **Łukasz's acceptance** on `npm run dev:pg` with demo accounts: the screenshots and the report first, then the screens
   he chooses. **Stop** with what he saw.
10. **Close.** The docs and the decisions quoted in full for approval (section 8); one full run on the final commit.
    Merge into `dev` and tag `slice-37` only on Łukasz's command.

Each of steps 3 to 8 ends with the check script's screenshots of the screens it touched and the unit tests; e2e specs of
the screens touched run in the step (single files), the full run in step 8.

## 6. Acceptance criteria

Łukasz's criteria (26 November 2026, agreed one at a time).

| ID | Criterion |
| --- | --- |
| S37-01 | **One look.** Every screen of InfoMapper, InfoDocumenter, InfoCube and the sign-in pages uses the design system's tokens: white pages and panels, only the canvas light grey; grey labels in `ink-3` (at least 4.5:1 on white); the mapping green and the warning orange as in the design system; field and check box edges in `line-control` (3:1); one corner radius of 8 px for every control, 12 px for cards, dialogs and pop-overs; IBM Plex Sans, Plex Mono for physical names; the same in dark mode. "Before / after" screenshots of the same screens at 1280, 1440 and 1920 px, light and dark, show it. Nothing moves to another place. |
| S37-02 | **The same control looks the same everywhere.** Buttons, fields, drop-downs, segmented controls, tabs, chips and cards come from shared components in `src/ui/components`, used by every screen. Buttons: one shape in five roles (primary, secondary, quiet, danger, icon) and two heights, 32 px on pages, in forms and dialogs, 28 px in panels and toolbars (the top bar keeps 30 px). Drop-downs (the drop-down chore; today 40 native selects with 10 class sets): one component in two sizes (32 and 28 px), the same focus ring and the same disabled look everywhere, InfoDocumenter's included. "Pick one of a few" (e.g. Draft · In review · Approved) is the segmented control; views of one page are the tab row; marks (PII, status, kind) are the chip. CC's report lists the kinds of button, field and drop-down per screen before and after; after, only the design system's variants remain. |
| S37-03 | **Nothing collides, nothing is cut, everything can be hit.** An automatic check runs on the same screens as the audit of 26 November (the workspace's tabs, the project home, the canvas with a selection of each kind, InfoDocumenter's editor, InfoCube's panels) at 1280, 1440 and 1920 px, light and dark. After the slice it finds no control overlapping another (the left panel's tabs no longer read "SourcesRequirements"); no text cut without an ellipsis; every click target at least 24 × 24 px (WCAG 2.2, 2.5.8), icon buttons in panels 28 px, the status bar's buttons 24 px; no page scrolling sideways at 390 px. Exceptions listed by name: cards on the canvas (they scale with zoom) and links inside a sentence. The check is a script in the repository, to run again later; CC attaches its report before the PR. |
| S37-04 | **InfoDocumenter, InfoCube and the sign-in pages too.** The modules and the pages outside a workspace use the same components as InfoMapper. InfoDocumenter's editor: its bar's controls 28 px, its drop-downs with the focus ring they lack today, the section list's move and remove buttons 28 px and clearly dimmed when not possible (today pale arrows that read as decoration), the options panel's choices as segmented controls. InfoCube's panels and dialogs: the same buttons, fields and chips. Sign-in, invitation, password reset and the error pages: the same fields and buttons. The place of every control stays; the layout of InfoDocumenter's bar is slice 38; generated documents (preview, PDF, Markdown) look exactly as before. |
| S37-05 | **It stays this way.** A guard test in the repository refuses a control styled on its own outside `src/ui`: arbitrary corner radii (`rounded-[…]`) and heights (`h-[…px]`) on buttons, inputs and selects, and a native `<select>` that does not use the shared component. A new screen (InfoCatalog's too) must take the shared components. The test ships with a probe file it is expected to refuse, as the layer rules' test does (AD-33); exceptions are listed in it with their reason (e.g. the canvas's cards, drawn by the domain's rules); CLAUDE.md names the components and the rule. |
| S37-06 | **Nothing breaks.** Every control is where it was and does what it did; the e2e tests find them by role, label and test id as before, and every changed test is listed with its reason. Generated documents are byte for byte the same for the demo's documents (Markdown compared as text, the HTML behind the PDF compared as text); the canvas's cards are drawn as before. No migration, no change to the data, no Vercel, GitHub or Supabase settings. Acceptance on `dev:pg` with the demo accounts: Łukasz looks at the before / after screenshots and the automatic report, then clicks through the screens he chooses. |
| S37-07 | CI, the Schema workflow, the full run before the merge; every earlier test changed, with its reason. |

**Manual acceptance:** Łukasz, step 9: the side-by-side screenshots and the two reports first; then on `dev:pg` with demo
accounts the screens he picks (suggested: the canvas with the inspector, the workspace home's tabs, InfoDocumenter's
editor, a dialog, dark mode). Lesson from earlier slices: give him long names and many items to try (KB-like lists).

## 7. Questions for step 1

- **Q1. Inventory.** Every control in `src/**/*.tsx` by kind (button, icon button, input, textarea, select, segmented,
  tabs, chip, card) with its classes, grouped; which component replaces each group; the files each step touches and
  their count. Whether the plan of steps 3–8 is balanced, or a step should split.
- **Q2. Tokens.** The exact form of the new tokens in `@theme` (sizes, radii, type); re-pointing `--radius` and shadcn's
  derived radii; the canvas's own `--im-line` (cards unchanged); every use of `--im-line` and `--im-ink-3` that changes
  meaning (e.g. a control's edge drawn with `--im-line` today must move to `--im-line-control`).
- **Q3. Button.** Adapting shadcn's `button.tsx` (variants `default`, `outline`, `ghost`, `destructive`…) to the roles
  `primary`, `secondary`, `quiet`, `danger` and the sizes; or a new `Button` with shadcn's left as is (and the guard
  pointing to the new one).
- **Q4. Select and Segmented.** That a styled native `<select>` keeps every `selectOption` and keyboard path; the
  segmented control's semantics (`role="radiogroup"` or `aria-pressed` buttons, as today's switches use; keep what the
  e2e specs read).
- **Q5. E2E surroundings.** The specs that locate by class or structure (fact, `b79495f`: about 215 class or structure
  locators in `e2e/`, to classify): which ones the components touch, and how each is kept (a test id, a role) without
  changing what it asserts.
- **Q6. The check script.** Where it lives, how it starts the demo, how it signs in, the screens' list and the way each is
  reached (URL or clicks), its run time, its report's format; that it is outside the e2e parts and CI.
- **Q7. Generated documents unchanged.** How to compare the demo's documents' Markdown and the HTML behind their PDF
  before and after (an existing test, or a one-off compare in the step's report); that the document preview's styles
  do not read the changed tokens (or keep today's values if they do).
- **Q8. Dark mode.** The new dark values under `@variant dark`; `tests/theme-css.test.ts`; contrast of `ink-3`,
  `line-control` on `surface` in dark (design system: 5.1:1 and 3.4:1).
- **Q9. White pages.** Which surfaces are grey today (homes, navigation row, panels' backgrounds) and become `im-surface`;
  that the canvas and its overview stay grey.
- **Q10. Risks.** The PR's size (many files): whether to review it step by step; the e2e run's time and heap (no new
  specs expected); anything in the prototype's look the app cannot take without a layout change (to slice 38); anything
  that changes this plan.

## 8. Decisions (proposals) and docs

Quoted in full at the closing for Łukasz's approval; the texts below are proposals for step 1 to correct.

- **D-89 (new): The design system's foundation** (slice 37): the tokens and their values (light and dark), the shared
  components and their variants, one radius, targets ≥ 24 px, white pages; the drop-down chore done; generated documents
  and the canvas's cards unchanged; the check script.
- **AD-20 (note):** controls are styled only in `src/ui/components`; the guard test refuses local control styles outside
  `src/ui` (S37-05); the components are shadcn / Radix adapted to the design system's tokens; native `<select>` kept.
- **D-85 (note):** the changed dark values (`ink-3`) and the new `line-control`.
- Docs: `decisions.md`, CLAUDE.md (a section "UI components": the components, the guard, `npm run ui:check`),
  `inventory-prototype-vs-app.md` (the look done; the layout for slice 38), `known-limitations.md`, `ideas.md` (the "?"
  sheet of shortcuts), README if it lists scripts. The handover's drop-down chore is closed by this slice.

## 9. Left for later

Slice 38 (the layout: the canvas toolbar with "Names ▾", the slim top bar, InfoDocumenter's bar in one row, the homes
without side panels and in two columns, list rows, the phone's top bar); a canvas in a second window; a "?" sheet of
shortcuts; InfoCatalog's slices (built on these components).

## Appendix A. The design system's tokens (InfoMate Design System, 26 November 2026)

Colours (light / dark): `surface` #ffffff / #1f262f; `panel` #f6f7f9 / #181e25; `canvas` #e8ecf0 / #13181e;
`canvas-grid` #bfc8d2 / #2b343e; `hover` #f1f4f7 / #252d37; `line` #e2e6eb / #2f3944; `line-control` #8a95a3 / #6b7787;
`ink` #18212c / #e5eaf0; `ink-2` #4a5767 / #a8b3c0; `ink-3` #667383 / #8a96a6; `accent` (the app's `logical`) #3346c4 /
#8f9cff; `accent-soft` #e7eafb / #262d55; `on-accent` #ffffff / #11163a; `physical` #a0660f / #e2a74b; `physical-soft`
#f6ecda / #3a2f1c; `mapping` #087a65 / #3ecfae; `mapping-soft` #dcf1eb / #173b33; `requirement` #534ab7 / #afa9ec;
`requirement-soft` #eeedfe / #26215c; `warn` #b33c0b / #ff8b4e; `warn-soft` #fceadd / #3e2518; `relationship` #556273 /
#95a2b2.

Type: IBM Plex Sans, IBM Plex Mono. Page title 24/30 600 (−0.01em); section 15/22 600; body 13/20 400; body-strong
13/20 500; small 12/16 400; label 11/16 500 (+0.06em, uppercase kinds only); code 12.5/18 mono.

Spacing: 4, 8, 12, 16, 24, 32, 48 px. Radii: 4 (chips, cells), 8 (every control), 12 (cards, dialogs, pop-overs), 999
(pills). Sizes: control-md 32, control-sm 28, the top bar 48 with 30 px controls, target-min 24, page-max 1,320,
drawer 560. Shadows: pop-over `0 12px 32px rgba(22,32,48,.16)` (dark `rgba(0,0,0,.5)`); drawer
`-16px 0 44px rgba(22,32,48,.14)`; canvas cards `0 1px 2px rgba(22,32,48,.08)` (dark none); page cards: a hairline, no
shadow.

Principles: white first (only the canvas grey); hairlines, not boxes; one accent; colour means something (warn =
personal data, a gap, danger; mapping = mappings and approved; requirement; physical), never colour alone; two
densities (pages 32 px controls, panels and toolbars 28 px); the same thing looks the same everywhere; every target at
least 24 px, icon buttons 28 px with a label and their shortcut in the tooltip. Words: sentence case; buttons say what
happens; counts after a label in `ink-3`.

## Appendix B. The design system's reference CSS (`components/bundle.css`)

The look of each component in plain CSS on the tokens (`--ink`, `--surface`… are the design system's names; in the app
`--im-ink`, `--im-surface`…, `--accent` is `--im-logical`). To be translated to Tailwind classes in `src/ui/components`.

```css
/* Button: one shape, five roles, two heights */
.im-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:var(--control-md);padding:0 14px;border-radius:var(--radius-md);
  border:1px solid var(--line);background:var(--surface);color:var(--ink);font:500 13px/1 var(--font-sans);cursor:pointer;white-space:nowrap}
.im-btn:hover{background:var(--hover)}
.im-btn:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.im-btn.primary{background:var(--accent);border-color:var(--accent);color:var(--on-accent)}
.im-btn.primary:hover{filter:brightness(1.08)}
.im-btn.quiet{border-color:transparent;background:transparent;color:var(--ink-2)}
.im-btn.quiet:hover{background:var(--hover);color:var(--ink)}
.im-btn.danger{color:var(--warn);border-color:var(--line)}
.im-btn.danger:hover{background:var(--warn-soft)}
.im-btn.sm{height:var(--control-sm);padding:0 10px}
.im-btn.icon{width:var(--control-sm);height:var(--control-sm);padding:0;border-color:transparent;background:transparent;color:var(--ink-2)}
.im-btn.icon:hover{background:var(--hover);color:var(--ink)}
.im-btn[disabled]{opacity:.45;cursor:default}
.im-btn svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}

/* Field: label above, one height per context, a 3:1 edge */
.im-field{display:grid;gap:4px;min-width:0}
.im-field>label{font-size:12px;line-height:16px;font-weight:500;color:var(--ink-2)}
.im-input,.im-select,.im-textarea{width:100%;height:var(--control-md);border:1px solid var(--line-control);border-radius:var(--radius-md);background:var(--surface);
  color:var(--ink);font:400 13px/20px var(--font-sans);padding:0 10px;outline:0}
.im-textarea{height:auto;min-height:76px;padding:6px 10px;resize:vertical}
.im-input:focus,.im-select:focus,.im-textarea:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
.im-input.sm,.im-select.sm{height:var(--control-sm);font-size:12.5px}
.im-input[readonly]{background:var(--panel)}
.im-field .hint{font-size:12px;line-height:16px;color:var(--ink-3)}
.im-field .err{font-size:12px;line-height:16px;color:var(--warn)}

/* Segmented control: pick one of two to four */
.im-seg{display:inline-flex;padding:2px;gap:2px;border-radius:var(--radius-md);background:var(--hover)}
.im-seg button{height:calc(var(--control-sm) - 4px);padding:0 12px;border:0;border-radius:6px;background:transparent;color:var(--ink-2);font:500 13px/1 var(--font-sans);cursor:pointer}
.im-seg button[aria-pressed="true"]{background:var(--surface);color:var(--ink);box-shadow:0 1px 2px rgba(22,32,48,.12)}

/* Tabs: views of one page */
.im-tabs{display:flex;gap:var(--space-6);border-bottom:1px solid var(--line);overflow-x:auto;scrollbar-width:none}
.im-tabs button{flex:none;height:40px;border:0;background:none;padding:0;color:var(--ink-3);font:500 13px/1 var(--font-sans);cursor:pointer;box-shadow:inset 0 -2px 0 transparent}
.im-tabs button[aria-selected="true"]{color:var(--ink);box-shadow:inset 0 -2px 0 var(--accent)}
.im-tabs button:hover{color:var(--ink)}
.im-tabs .n{color:var(--ink-3);font-weight:400;margin-left:4px}

/* Chip: a mark, never a button unless it says so */
.im-chip{display:inline-flex;align-items:center;gap:4px;height:22px;padding:0 8px;border-radius:var(--radius-sm);font:500 12px/1 var(--font-sans);background:var(--hover);color:var(--ink-2);white-space:nowrap}
.im-chip.pii{background:var(--warn-soft);color:var(--warn)}
.im-chip.ok{background:var(--mapping-soft);color:var(--mapping)}
.im-chip.req{background:var(--requirement-soft);color:var(--requirement)}
.im-chip.src{background:var(--physical-soft);color:var(--physical)}
.im-chip.sel{background:var(--accent-soft);color:var(--accent)}
.im-chip.filter{height:var(--control-sm);border-radius:var(--radius-full);padding:0 12px;border:1px solid var(--line);background:var(--surface);color:var(--ink-2);cursor:pointer}
.im-chip.filter.on{border-color:var(--accent);background:var(--accent-soft);color:var(--accent)}

/* Card: a page block or a list item; hairline, no shadow */
.im-card{border:1px solid var(--line);border-radius:var(--radius-lg);background:var(--surface);padding:var(--space-4)}
.im-card h3{margin:0 0 4px;font:600 15px/22px var(--font-sans)}
.im-card p{margin:0;color:var(--ink-2)}
.im-card .acts{display:flex;gap:var(--space-2);margin-top:var(--space-3)}
.im-card.quiet{border-color:transparent;background:var(--panel)}
```

(The canvas toolbar's CSS is slice 38's.)
