# Slice 37 – Design system foundation: acceptance

Branch `slice/37-design-system-foundation`, from `dev` at `b79495f` (the merge of PR #96). PRD:
[slice-37-design-system-foundation.md](slice-37-design-system-foundation.md).

## Step 1: the check against the code (26 November 2026)

No application code. Every number below was counted on `dev` at `b79495f` with a TypeScript AST scan of the 167 `.tsx`
files under `src/` (each `<button>`, `<input>`, `<select>`, `<textarea>`, `<Link>` and `<label>` with its `className`), with
`git grep`, and by compiling `src/app/globals.css` with the build's Tailwind (`@tailwindcss/node` 4.3.3). The rendered
kinds (heights in px as drawn, the audit's "37 kinds of button") come from the check script's inventory in step 2. This
step does not count them again.

### 0. The files

| File | `cmp` | SHA-256 |
| --- | --- | --- |
| `docs/prd/slice-37-design-system-foundation.md` | same as Downloads | `6597342c…2200`, as given |
| `docs/prototype/infomapper-prototype-with-sources.html` | same as Downloads' `infomapper-prototype-with-sources (1).html` | `74c70cd9…9029`, as given |

The first copy came from `infomapper-prototype-with-sources.html` in Downloads. That file is slice 35's prototype
(`6d5b5b7f…c179`), so I stopped. On Łukasz's answer I copied the `(1)` file instead (the browser had renamed it). The new
prototype is the old one plus 2,134 lines, with one line changed (the workspace home's tab list gains "Proposals"). The
additions are: the CSS blocks of 26 November (white pages, the drop-downs, design system steps 1 to 4); InfoCatalog's
CSS and script (`PLAT`, `#plat`); the top bar's "All apps" button (`#tApps`); the canvas toolbar (`#ctb`); the homes
without side panels (`pagemode`); and the canvas in a second window (idea 4).

The slice number is free: there is no `slice-37` file in `docs/prd/` before this step, and no such branch.

### 1. What Łukasz needs to decide before step 2

Each item is explained further down. The first option is my recommendation.

| # | Question | Options |
| --- | --- | --- |
| A1 | **The canvas's cards.** The PRD keeps their edge (`--im-line`), but `canvas.css` also draws cards and lines in `--im-ink-3` (27 uses), `--im-map` and `--im-warn`. The prototype changes all four for the cards too. (F5) | **(a)** The cards keep today's edge through their own token (`--im-card-line`). Their colours follow `ink-3`, `map` and `warn`: no shape, size or place changes, and the grey text reaches 4.8:1 (closing the known limitation "Grey text … below WCAG AA"). (b) The canvas keeps all four old values: the cards are pixel for pixel as before, but the panels' mapping green differs from the lines' green. (c) As the prototype: the cards get the lighter edge too. |
| A2 | **Tailwind's radius scale.** `rounded-sm`, `rounded-md` and `rounded-lg` are today 4.8, 6.4 and 8 px (shadcn's `--radius`). Pointing them at 4, 8 and 12 px also turns the 46 uses of `rounded-lg` (8 px today) into 12 px. (F3) | **(a)** Re-point them in step 2. Each step reviews its `rounded-lg` uses: a control becomes `md`, a card or box stays `lg`. (b) New names (`rounded-control`, `rounded-card`) and leave Tailwind's scale as it is. That gives two scales side by side. |
| A3 | **The guard's rule.** The PRD's rule (only `rounded-[…]` and `h-[…px]` on control tags) lets `h-7`, `size-6` and class constants through, and those make most of today's kinds. (F6) | **(a)** An AST guard: a control tag outside `src/ui` may not get a size, radius, edge or fill class from a literal or from a constant in its own file. The raw `<select>` is refused, and the files not converted yet are listed in "to convert". (b) The PRD's rule as written. |
| A4 | **Tooltips with shortcuts** (`IconButton`). 98 assertions read a `title`. (F7) | **(a)** Titles stay word for word in slice 37; the shortcuts go to slice 38 or `ideas.md`. (b) Add shortcuts now and change every spec that reads such a title. |
| A5 | **Full runs.** Step 3 changes `fields.tsx`, which every panel, both homes and both modules draw with. (Q10) | **(a)** A full run in step 3 as well as in step 8. (b) Only in step 8, as the PRD says. |
| A6 | **Step sizes.** Step 3 is the largest: 33 files and about 200 controls. (Q1) | **(a)** Split it into 3a (the field primitives and the inspector's panels, InfoCube's sections included since they draw with the same primitives) and 3b (the left panel, the toolbox and menus, the import wizard, the rich-text field). Step 7 keeps InfoCube's dialogs. (b) Keep the PRD's steps. |
| A7 | **390 px.** S37-03 asks for "no page scrolling sideways at 390 px", but the top bar on a phone is slice 38's (DS2.4). (F20) | **(a)** The page does not scroll sideways (the tab rows scroll with a fade, and `overflow-x: clip` on the page as the prototype has it). The top bar's cut account button is reported and named as slice 38's. (b) Leave 390 px out of the criterion. |
| A8 | **The check script's data.** "Give him long names" (the PRD's lesson). (Q6) | **(a)** The script resets a data file of its own from the demo and adds a few long names (an entity, an attribute, a document section, a project, a canvas) through the domain. (b) The demo alone. |

**Łukasz's answers (26 November 2026):**
- **A1 to A8:** all option (a), the recommendations above.
- **A8, in detail:** the check script's data is a file of its own, `.data/ui-check-db.json`, made from the demo data
  (`addSeedDemoData`) with the long names added. It never reads or writes `.data/dev-db.json` or `.data/demo-db.json`,
  and it is git-ignored (`.data/`).
- **F9:** native check boxes with `accent-color`; S37-01's "check box edges" is read as at least 3:1.
- **F10:** the label above a field is 12/16 500 in `ink-2`, named in the before/after report.

### 2. Q1: the inventory of controls

**By area** (elements in TSX; a list item drawn by `.map` counts once):

| Area (the step that converts it) | Files | `button` | text `input` | `textarea` | `select` | check box / radio | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Inspector panels, `src/app/_panels` (3) | 28 | 130 | 8 | 4 | 12 | 4 | `fields.tsx` holds the de facto shared pieces (below) |
| Import wizard, `_panels/import` (3) | 4 | 18 | 4 | 5 | 2 | 6 | `source-step.tsx` alone has 21 |
| Rich text and the picker, `src/ui` (3) | 4 | 17 | 2 | – | – | – | `rich-text-editor.tsx`, `rich-text-field.tsx`, `pick-popover.tsx` |
| Top bar, navigation row, status bar, canvas chrome (4) | 9 + 17 | 20 + 25 | 4 | 1 | 2 + 1 | 1 | the canvas's 25 include the cards' own (exceptions) |
| Homes, settings, people, baselines (5) | 15 | 45 | 16 | 3 | 6 | 2 | 4 local boxes `rounded-[10px] shadow-[0_0_0_1px…]` |
| InfoDocumenter (6) | 10 | 24 | – | – | 12 | 9 | its own `Field`, `IconButton`, `Chip`, `Badge`, `Check` |
| InfoCube (7) | 5 | 14 | 1 | – | 4 | 2 | uses `fields.tsx`' pieces |
| Sign-in, invitation, reset, errors, change password, new organization (8) | 5 + 3 | 14 + 17 | 10 | – | 2 | – | `link-page.tsx`, `start-forms.tsx` |

In all: **308 `<button>` in 94 files, 77 `<input>`, 13 `<textarea>`, 40 `<select>`**, 5 `<Link>` drawn as buttons
(`breadcrumbs.tsx`, `settings-form.tsx`, `project-notes.tsx`, the workspace home's tabs) and 8 `<label>` drawn as
buttons or chips (`NamesSwitch.tsx`, the import's choice cards, `create-dimension-dialog.tsx`, InfoCube's mapping panel).

**The shared pieces that already exist** (the PRD misses these, F1). Most controls are not styled locally. They take
class constants exported by `src/app/_panels/fields.tsx`:

| Constant or component in `fields.tsx` | Uses | Files | Today | Becomes |
| --- | --- | --- | --- | --- |
| `inputClass` (`min-h-8 … rounded-md border-im-line … read-only:bg-im-panel`) | 57 | 17 | 32 px input, select, textarea | `Input` / `Select` / `Textarea` md |
| `buttonClass` (`h-8 rounded-md border …`) | 49 | 17 | 32 px secondary | `Button` md |
| `smallButtonClass` (`h-[26px] … text-xs`) | 62 | 18 | 26 px secondary | `Button` sm (28) |
| `dangerClass` (`buttonClass` + `text-im-warn`) | 37 | 18 | 32 px danger | `Button` md danger |
| `primaryClass` (`h-8 … bg-im-logical`) | 18 | 9 | 32 px primary | `Button` md primary |
| `inlineButtonClass` (`h-[22px] rounded …`) | – | 1 | 22 px in a row | `Button` sm or `IconButton` 24 |
| `Seg` (`role="group"`, buttons with `aria-pressed`, track `rounded-[7px]`, buttons `h-[26px] rounded-[5px]`) | 13 | InfoMapper, InfoCube, InfoDocumenter | segmented | `Segmented` (moved to `src/ui`) |
| `Flag` (pill, `aria-pressed`) | – | panels | 22 px pill | the filter `Chip` 28 px |
| `Field` (label 11.5 px `ink-3`) | – | panels | label + control | `Field` in `src/ui` |
| `Fold` (a section's heading) | – | panels, editor | heading | heading ≥ 28 px (look only) |
| `TextField`, `TextArea`, `useDraft`, `useChoice` | – | everywhere | D-66's draft logic | **stay in `app`**; draw `src/ui`'s `Input`/`Textarea` |

**Local copies of the same thing** (each is a "kind" in the audit):
- `baselines.tsx` (`smallBtn`, `priBtn`, `smallPriBtn`, `textInput`, `fieldInput`);
- `left-panel.tsx` (`barButton` 28 px icon, `smallButton`);
- InfoDocumenter's `editor.tsx` (`smallButton`, `selectClass` 26 px, its own `IconButton`, `Chip`, `Badge`, `Check`);
- `preview.tsx` (`smallButton`); `markdown-dialog.tsx` (`btnClass`, `primaryClass` 26 px);
- `figure-editor.tsx` (`selectClass` 28 px 12 px text, `iconButton` 24 px);
- `style-panel.tsx` (`selectClass` 32 px);
- `people.tsx` and `invitations.tsx` (`inputClass` 28 px, the same name as `fields.tsx`' with another value);
- `mapping-panel.tsx` (`iconButton` 24 px);
- `error-message.tsx` (`primaryButton`, `text-[12.5px]`);
- `top-bar.tsx` (menus, the organization select 30 px);
- the canvas's switches (`LayerSwitch`, `NotationSwitch`, `Focus`: `aria-pressed` buttons with their own sizes);
- `view-state-bar.tsx` (`Chip`, `chipClass`, `offClass`);
- `review-step.tsx` and `project-consistency.tsx` (`Tag`);
- the workspace home's `Badge`.

**The 40 `<select>`s** (the drop-down chore). The handover's count holds: 40, in **11 class sets**, not 10. Its list
missed `section-options.tsx`' fourth variant (`min-w-0`).

| Class set | Count | Where |
| --- | --- | --- |
| `inputClass` (32 px) | 18 | entity, frame, note, requirement, source changes, import source, invitations¹, people¹, stereotypes, mapping (InfoMapper and InfoCube), InfoCube sections, `fields.tsx` |
| `selectClass` (26 / 28 / 32 px, three different definitions) | 7 | `editor.tsx` 2, `figure-editor.tsx` 2, `style-panel.tsx` 3 |
| `h-8 w-full rounded-md …` without a focus style | 5 | `delete-concept-dialog.tsx`, `editor.tsx`, `section-options.tsx` 3 |
| `input` (a local constant, 30 px) | 2 | `new-organization-dialog.tsx`, `start-forms.tsx` |
| `fieldInput` | 2 | `baselines.tsx` |
| `h-[30px] … text-xs` | 1 | `top-bar.tsx` (the organization switch) |
| `inputClass` + `min-w-[120px]` | 1 | `attribute-panel.tsx` |
| no height (`px-2 py-1`) | 1 | `review-step.tsx` |
| `fieldClass` (with `disabled:opacity-60`) | 1 | `settings-form.tsx` |
| `h-[26px] max-w-[260px] …` | 1 | `Changes.tsx` (the canvas's Changes view) |
| `h-8 w-full min-w-0 …` | 1 | `section-options.tsx` |

¹ `people.tsx` and `invitations.tsx` define their own `inputClass` (28 px). A select drawn with it is 28 px, not 32.

**Radii in TSX:**
- `rounded-md` 161 (6.4 px today), `rounded-lg` 46 (8 px), `rounded` 47 (4 px), `rounded-full` 19, `rounded-sm` 4
  (4.8 px), `rounded-xl` 3 (11.2 px);
- arbitrary values 70: `[10px]` 20, `[5px]` 19, `[7px]` 8, `[3px]` 5, `[2px]` 5, `[14px]` 5, `[11px]` 4, `[15px]` 2,
  `[13px]` 1, `[1px]` 1;
- CSS files: `border-radius` in px 44 times. Most are in `canvas.css` (cards, an exception); `globals.css` has `.rt-view`
  (6 px).

Arbitrary heights `h-[…px]`: 89.

**Is the plan of steps 3 to 8 balanced?** No. Step 3 (the panels, the import, the rich text: 36 files, about 200
controls) is three times step 5 (15 files, 74) and ten times step 7 (5 files, 21). See A6 for the split. Moving the
shared pieces in step 2 converts most uses at once: `fields.tsx`' constants become thin re-exports of `src/ui`'s
variants. Steps 3 to 8 then remove the local copies and the one-off classes, and look at each screen.

### 3. Q2: the tokens

In `src/app/globals.css`:

```css
:root {            /* light; the four changed values and the new ones */
  --im-ink-3: #667383;  --im-map: #087a65;  --im-warn: #b33c0b;  --im-line: #e2e6eb;
  --im-line-control: #8a95a3;    /* new: edges of fields, drop-downs */
  --im-card-line: #d6dce3;       /* new (A1 a): today's --im-line, for the canvas's own drawing */
  --im-on-accent: #ffffff;       /* new: text on a primary button */
  --im-shadow-pop: 0 12px 32px rgba(22, 32, 48, 0.16);  /* new: dialogs, menus, pop-overs */
}
:root { @variant dark { --im-ink-3: #8a96a6; --im-line-control: #6b7787; --im-card-line: #2f3944; --im-on-accent: #11163a;
  --im-shadow-pop: 0 12px 32px rgba(0, 0, 0, 0.5); } }   /* map, warn and line keep their dark values */

@theme {           /* plain values (no var()), so not `inline` */
  --spacing-control-md: 32px;  --spacing-control-sm: 28px;  --spacing-control-bar: 30px;  --spacing-target: 24px;
  --text-title: 24px;    --text-title--line-height: 30px;    --text-title--font-weight: 600;  --text-title--letter-spacing: -0.01em;
  --text-section: 15px;  --text-section--line-height: 22px;  --text-section--font-weight: 600;
  --text-body: 13px;     --text-body--line-height: 20px;
  --text-small: 12px;    --text-small--line-height: 16px;
  --text-label: 11px;    --text-label--line-height: 16px;    --text-label--font-weight: 500;  --text-label--letter-spacing: 0.06em;
  --text-code: 12.5px;   --text-code--line-height: 18px;
}
@theme inline {    /* replaces today's calc(var(--radius) * …) (A2 a) */
  --radius-sm: 4px;  --radius-md: 8px;  --radius-lg: 12px;  --radius-xl: 12px;
  --color-im-line-control: var(--im-line-control);  --color-im-card-line: var(--im-card-line);  --color-im-on-accent: var(--im-on-accent);
  --shadow-pop: var(--im-shadow-pop);
}
```

This gives classes like `h-control-sm`, `size-control-sm`, `min-h-target`, `text-body`, `text-label`, `rounded-md`,
`shadow-pop`, `border-im-line-control`. They are spacing tokens, so `w-`, `min-w-` and `size-` work too. `--radius`
(0.5 rem) goes once nothing reads it: only the derived radii read it today.

shadcn's variables:
- `--background` moves from `im-panel` to `im-surface`. The body and shadcn's `Dialog` (`bg-background`) become white
  in one step (Q9).
- `--primary` moves from `im-map` (green today, read only by shadcn's `Button`, which nothing uses) to `im-logical`.
- `--primary-foreground` moves to `im-on-accent`.
- `--input` moves to `im-line-control`.

**What changes meaning:**
- `--im-line` (254 uses in 76 TSX/TS files, 187 of them `border-im-line`). Hairlines (panel edges, dividers, the
  navigation row, table rules) keep it and get lighter. **Control edges** (`inputClass`, every button constant,
  `selectClass`, `textInput`, the boxes' `shadow-[0_0_0_1px_var(--im-line)]` where they are fields) move to
  `im-line-control` inside the components. The design system draws a secondary button's edge in `line`, not
  `line-control` (appendix B, `.im-btn`), so buttons keep `im-line`.
- `canvas.css` (19 uses of `--im-line`): they become `--im-card-line` (A1 a). That covers the card's edge, the header's
  rule, the coverage bar's track, the overview's edge and the requirement card's bar. No variable is set on an element
  around the canvas (the side panels' rule, CLAUDE.md): it is a token of its own, declared once on `:root`.
- `--im-ink-3` (323 uses). Every use gets darker; none changes role. On `im-hover` the new light `ink-3` reaches 4.38:1
  (under 4.5:1). Hovered rows with `ink-3` text are rows, not labels, but step 3 lists them (Q8).
- Thumbnails draw mapping lines with `var(--im-map)` (AD-32), so they get the new green. That is wanted and asks for no
  change.

### 4. Q3: Button

**Proposal: rewrite `src/ui/components/button.tsx` in place** with the design system's roles. Keep
`buttonVariants(...)` exported, so a `<Link>` that looks like a button takes the classes without becoming a `<button>`
(the workspace home's tabs, the breadcrumbs, `settings-form.tsx`' links). The only importer is `dialog.tsx` (its
footer's `variant="outline"` close button, which becomes `secondary`). Variants:
- `role`: `primary` | `secondary` (default) | `quiet` | `danger`;
- `size`: `md` 32 | `sm` 28 | `bar` 30;
- `IconButton`: its own file, the same `buttonVariants` with `icon` (28; `size="xs"` 24 only in dense rows), `label`
  required (it becomes `aria-label`), `title` passed through unchanged (A4).

Disabled at 45 % opacity. Today's buttons use 50 %, 40 % or 30 %; the section list's dimmed arrows keep 30 % as the
prototype has them (`.de-sa .ib:disabled`).

shadcn's `outline`, `ghost`, `link` and `destructive` variants and its `xs`, `lg` and `icon-*` sizes go. No other file
uses them.

### 5. Q4: Select and Segmented

**Select:** a styled native `<select>`. The 98 `selectOption` calls, `locator("option")` (30) and every keyboard path
stay as they are, because the element stays a `<select>`. The component forwards every prop
(`data-testid`, `id`, `aria-*`, `value`, `onChange`, `disabled`) and its ref. Only `className` is limited to layout
classes (width, margin, flex). Sizes `md`, `sm`, `bar`. The focus ring is the accent edge plus a 3 px `logical-soft`
ring: InfoDocumenter's 5 selects without a focus style get it, as DS2.2 asks. Disabled at 45 %. `appearance` stays
native, with `accent-color` on the page, so the arrow and the list follow `color-scheme` (D-85) as today.
`tests/document-*` do not touch selects.

**Segmented:** `Seg` moves to `src/ui/components/segmented.tsx` with its API (`value`, `options`, `onChange`,
`disabled`, `testId`, `columns`, `labelledBy`, `describedBy`) and its semantics: `role="group"` with `aria-pressed`
buttons. The radio-group semantics stay the theme menu's (`menuitemradio`, D-85). The look follows appendix B: track
`hover`, 28 px with 24 px buttons, radius 8 and 6. The e2e specs read `aria-pressed` (70 uses in `src`; specs use
`toHaveAttribute("aria-pressed", …)`) and the group's test id, so nothing they read changes.

The canvas's own switches (`LayerSwitch` All · Maps · Rels, `NotationSwitch` IE · UML, `Focus`, the look's swatches)
take `Segmented` too in step 4, keeping their test ids and `aria-pressed`. **Risk:** they sit in the top bar, which
S6A-10 checks at 12 widths for no overflow. A 2 px taller control does not widen it; wider padding would. Step 4 keeps
each control's width as it is (F15).

`fields.tsx`' `Seg` stays as a re-export until every import has moved. InfoMapper's layers import `src/ui`, and modules
may too.

### 6. Q5: the e2e specs' surroundings

**How the 713 spec and helper files find things:** `getByTestId` 4,951 times, `getByRole` 191, `getByLabel` 10,
`selectOption` 98, `toHaveAttribute("title", …)` 98, `toHaveClass` 52, `toHaveCSS` and `getComputedStyle` 67,
`boundingBox` 123.

The 278 locators with a CSS class name the canvas (`.c-head` 54, `.react-flow__*` 91, `.row`, `.c-l2`, …) or the
document (`.dt`, `.ddr`, `.dtoc`, …). Neither is touched. `toHaveClass` reads app CSS classes (`sel`, `warn`, `gone`,
`meas`, `cmap`, `ctx`, `ctxline`, …), not Tailwind's. Tailwind classes that specs read:

| Spec or helper | Reads | Kept by |
| --- | --- | --- |
| `slice-01b/helpers.ts:50`, `slice-02b/helpers.ts:126`, `slice-10a/helpers.ts:40`, `S15-22.spec.ts:87` | `span.min-w-0` inside a toolbox item or menu item | the menu and toolbox items keep that span and its class (steps 3b, 4) |

**Structure the components must keep** (a locator by tag or position):

| Spec | Reads | Step |
| --- | --- | --- |
| `S10A-10`, `S16-10`, `RP-04`, `RP-05`, `RP-14` | `label` elements, `label[for=f-rfr]`, `[for=f-rtr]`, `[for=f-rkey]` | 3: `Field` keeps `<label htmlFor>` and the ids |
| `S22-02`, `S22-04` | the unknown member's `label`s; the first `button` of a row and its first `span` (no clipping) | 3 or 7 |
| `S23-03` | `classification-code` > `span` with its `title` | 5 |
| `S11-10` | `switch-names` > first `label` and its `title` | 4 |
| `S30-09-room` | `button-tool-*` > `span` labels; the server badge's `span`s | 4 |
| `S36-list` | `check-style-watermark` > `xpath=..` text | 6: the check box keeps its parent `label` |
| `S28-07` | in `editor-right`: no `select` cut, no `[role=group]` wrapped to a second row; a figure entry's `padding-left` is 8 px | 6: risk with 28 and 32 px controls in a 340 px panel |
| `S33-05` | People's `col` widths 140 px and 236 px; the buttons start their cell | 5: the row's buttons at 28 px must still fit 236 px |
| `S6A-10` | the top bar at 12 widths: nothing past it, nothing overlapping, no scroll | 4 |
| `S26-01`, `S36-03` | `button-section-up`, `-down`, `-remove` clicked | 6: the buttons show on hover, on the selected row and on focus. Proposal: hide them with `opacity` only, without `pointer-events: none`, so a click lands as today |

**Specs that will change** (S37-06's list, known now):
- `e2e/slice-32/helpers.ts`: `TOKENS["--im-map"]` (`#0b8a72` becomes `#087a65`); `BODY_BG` (the body becomes
  `im-surface`: `rgb(255, 255, 255)` and `rgb(31, 38, 47)`);
- `e2e/slice-29/S32-smoke-theme.spec.ts`: `LIGHT_BODY`, the same reason;
- `S32-01`, `S32-02` and `S32-04` read `BODY_BG` through the helpers and change with them. `S32-01` compares the
  inspector's background between themes only, which holds.

No assertion changes, only the expected token values the decision changes.

**Which earlier specs each step runs** (single files, as CLAUDE.md's "after each step" rule). The screens are
everywhere, so this lists folders and the specs above:
- **Step 2** (tokens, components, the guard, nothing converted yet): `slice-32`, `slice-12b` (thumbnails' tokens),
  `S6A-10`, `S5A-06`, and one spec per area as a smoke check (`S0-04`, `S4A-01`, `S26-01`, `S15-01`, `S8-01`).
- **Step 3**: `slice-01b`, `02b`, `04a`, `05a`, `07a`, `07b`, `07c`, `09`, `10a`, `10c`, `13`, `14a`, `15b`, `17`,
  `18`, `20`, `21`, `22`, `24`, `RP-*`, and a full run if A5 (a).
- **Step 4**: `slice-05a`, `06a`, `06b`, `11`, `16`, `30` (save indicator, badge), `32`. The `S4P-*` specs are not
  needed (no canvas change).
- **Step 5**: `slice-08`, `12a`, `12b`, `23`, `24`, `33`, `35`, `S9-*` (project home).
- **Step 6**: `slice-25` to `28`, `34`, `36`.
- **Step 7**: `slice-15a`, `15c`, `15d`, `19`, `22`.
- **Step 8**: `slice-00`, `08`, `33`, then the full run.

### 7. Q6: the check script

- **Where:** `scripts/ui-check.ts`, run with `npm run ui:check` (`tsx`). Helpers go in `scripts/lib/ui-check-rules.ts`
  (pure: overlap, outside, small target, cut text, page width, the inventory's grouping), unit-tested in
  `tests/ui-check-rules.test.ts`. It uses Playwright's library (`chromium.launch`), not the test runner. It is not in
  `e2e/`, not in `e2e/parts.ts`, not in CI and not in any workflow.
- **The server:** its own dev server, started the way `scripts/demo.ts` starts one:
  - `INFOMAPPER_DEV_DB=.data/ui-check-db.json`, reset from `addSeedDemoData` on every run, plus A8's long names;
  - `NEXT_DIST_DIR=.next-ui-check`, `127.0.0.1:3400`, `INFOMAPPER_TEST_HOOKS` off;
  - it refuses to start when port 3400 is in use, and refuses `.data/dev-db.json` as its file (as `demo.ts` does);
  - so it never touches KB, the demo's file or a running `npm run dev`. `--url` points it at a running server instead.
- **Sign-in:** the development sign-in, picking the demo's Łukasz from the test users' list (it unlocks every
  organization, as the e2e helpers do).
- **Screens and how each is reached:**
  - by URL: the workspace home (`?tab=` for each tab shown: overview, documentation, baselines, people, metadata
    conventions, settings), the project home, the canvas "Customer & orders", the Sales star, the document editor (the
    S2T document);
  - by clicks inside the canvas: nothing selected; an entity, an attribute, a source table, a mapping (its line), a
    requirement card, a note, an InfoCube mapping (its line on the star); the left panel's four tabs;
  - the editor with a section selected;
  - InfoCube's panels: a fact, a dimension, the bus matrix dialog;
  - one dialog: the entity's delete impact.

  The script reads ids from the data file it made, never by name from a page.
- **Viewports:** 1280, 1440 and 1920 px × light and dark (the theme cookie `im-theme`), and 390 px light. That is 7 ×
  about 22 states ≈ 150 screenshots.
- **Run time:** an estimate of 6 to 9 minutes with the server's start (measured in step 2).
- **What it lists per screen:**
  - a control overlapping another by more than 2 px (one not inside the other);
  - a control past the viewport's edge;
  - a button or link target under 24 × 24 px (WCAG 2.5.8; inline links in a sentence and canvas cards are skipped);
  - text cut without an ellipsis;
  - a page wider than the viewport;
  - the inventory: each control's height, font size, radius and edge, grouped into kinds and counted per screen.

  The exceptions are named in the script (`.react-flow__node` and its descendants, links inside `p` and `li` text).
- **Its output** (git-ignored, never committed): `.data/ui-check/<label>-<yyyymmdd-hhmm>/` with `report.md` (per
  screen: findings, then the kinds), `report.json` and the PNGs. `--compare <before> <after>` writes
  `compare.html` with the two screenshots side by side and the two inventories' kinds. I can also publish that page as
  a private Artifact for Łukasz if he asks.
- **"Before" on `dev`'s look:** step 2's first commit adds only the script, its rules and their test. The "before" run
  is made on that commit (the app's look is still `dev`'s), then the tokens and components follow. No worktree needed.

### 8. Q7: generated documents unchanged

- The document's CSS (`src/modules/infodocumenter/ui/document-css.ts`) has its own tokens (`--dink`, `--dink2`,
  `--dink3`, `--dline`, `--dacc`, `--dsoft`, `--paper`) and `color-scheme: light`. It reads no `--im-*` token (checked).
  The figures' SVGs are drawn by the domain (`src/domain/document/figure.ts`) and shown as images, so no page CSS reaches
  them. The editor's frame around the pages (`bg-im-canvas`) stays grey.
- Existing tests: `tests/document-html.test.ts`, `document-markdown.test.ts` and `document-markdown-html.test.ts` render
  the demo's documents and every section type (`tests/lib/markdown-documents.ts`). They assert rules, not a fixed text.
  No test compares a document's whole text against a stored one.
- **Proposal:**
  1. `scripts/document-texts.ts` writes each demo document's Markdown (`documentMarkdown`), its HTML
     (`renderToStaticMarkup(DocumentHtml)`) and its CSS (`pageCss` + `styleCss`) to
     `.data/ui-check/documents-<label>/`.
  2. It runs in step 2 before any token change and in step 8. The report shows `diff -r` empty and
     `git diff --stat b79495f -- src/domain/document src/modules/infodocumenter/domain src/modules/infodocumenter/ui/document-*`
     empty.

  It is a one-off compare, not a stored fixture that every later document change would have to update.

### 9. Q8: dark mode

- The new dark values go under `@variant dark` in `:root` (Q2), as D-85 requires. `tests/theme-css.test.ts` compiles
  `globals.css` and checks both selectors and that no other file reads `prefers-color-scheme`. It needs no change and
  must pass. The prototype writes its dark values under `@media (prefers-color-scheme: dark)` (its own rule); the app
  does not copy that form.
- Contrast, computed (WCAG formula):

| Pair | Ratio |
| --- | --- |
| `ink-3` light `#667383` on `surface` / `panel` / `hover` / `canvas` | 4.83 / 4.51 / **4.38** / 4.07 |
| `ink-3` dark `#8a96a6` on `surface` / `panel` | 5.08 / 5.59 |
| `line-control` light `#8a95a3` on `surface` / `panel` | 3.04 / **2.84** |
| `line-control` dark `#6b7787` on `surface` / `panel` | 3.35 / 3.69 |
| `map` light new / old on white | 5.27 / 4.29 |
| `map` on `map-soft` (the approved chip) | 4.48 |
| `warn` light new on white / on `warn-soft` (PII) | 5.89 / 5.03 (was 4.43) |
| `physical` on `physical-soft` (BK) | 4.07 (unchanged) |

  The design system's 5.1:1 and 3.4:1 for dark hold (5.08 and 3.35).
- **Two gaps:**
  1. A field drawn on `panel` (a read-only field is `panel` itself; a field inside a grey box) has a 2.84:1 edge against
     the panel. With white side panels (Q9) the only grey areas left are the read-only fields themselves and
     `bg-im-panel` boxes such as `source-changes`' `pendClass`. Step 3 lists any field inside such a box.
  2. The BK chip stays at 4.07:1. It keeps the known limitation's row, minus the PII line, which the new `warn` fixes.

### 10. Q9: white pages

What is grey today:

| Surface | Today | Becomes |
| --- | --- | --- |
| `body` (`layout.tsx` `bg-im-panel`, and `@layer base` `bg-background`) | panel | surface |
| `AppShell` (`app-shell.tsx`, 2 ×) | panel | surface |
| The workspace home and the project home (`page.tsx`, `bg-im-canvas`) | canvas | surface |
| The navigation row (`breadcrumbs.tsx` `bg-im-canvas`) | canvas | surface |
| The side panels (`side-panels.tsx`, both `aside`s) | panel | surface |
| The left panel's sticky headers (`left-panel.tsx`, 4 ×) | panel | surface (they must stay opaque) |
| The canvas tabs' strip (`canvas-tabs.tsx`) and the selected tab (`bg-im-canvas`) | panel / canvas | surface with a bottom hairline; the selected tab surface (prototype `#dtabs`, `.dtab.on`) |
| shadcn's `Dialog` (`bg-background`) | panel | surface |

What stays grey: the canvas and its overview (`--im-canvas`, `data-bg`); a tile's thumbnail area (`page.tsx:235`);
InfoDocumenter's editor and document page around the pages (`editor.tsx`, `pages.tsx`, `preview.tsx`), which play the
canvas's part; read-only fields (`panel`); quiet cards (`Card quiet`).

**Risk:** a white left panel beside the white navigation row and the white top bar needs its hairlines. The prototype
draws them (`border-r`, `border-l`, the strip's bottom line), and the app already has them.

### 11. Q10: risks

- **The PR's size:**
  - about 110 files change (the 94 with buttons, plus CSS, tests and docs);
  - most of the diff is mechanical, a class string replaced by a component;
  - **proposal:** review it step by step, one commit (or a few) per step, each step's report listing its files; GitHub's
    "Changes from" a commit range shows one step.
- **The e2e run:** no new spec, so its time and heap stay as slice 36's. The components add no element on the canvas
  (its cards are untouched; the element guard is MEASURE-only and is not part of the full run). If a step changes
  anything the canvas draws (A1's colours do not count: no element), I run the element guard by hand on that step and
  say so.
- **What needs a layout change** (to slice 38, not done here):
  - the canvas toolbar (`#ctb`) and the path's room (`.bar .projbtn{max-width:280px}`);
  - InfoDocumenter's bar in one row (`.de-top`, the 48 px row);
  - the homes without side panels (`pagemode`) and in two columns (`.pg-cols`, `max-width:1320px`);
  - list rows where the name wins (`.li .n`);
  - the phone's top bar.

  Two of the prototype's step-2 rules are borderline:
  - the section list's actions shown only on hover (the place stays; only the visibility changes), which the PRD lists
    under slice 37;
  - `.de-sec.sel{padding-right:96px}`, which keeps the name clear of the actions.

  I take both in step 6 as the PRD says.
- **Not in the app and not built:**
  - the top bar's "All apps" button and the workspace home's "Proposals" tab (InfoCatalog);
  - the canvas in a second window.

  These are deliberate differences from the new prototype (section 13).
- **What could change this plan:**
  - A1 (b) would add a canvas-scoped copy of four tokens;
  - A3 (a) changes how step 2's "to convert" list is built;
  - a module importing `src/ui` is allowed today (`eslint.config.mjs`: a module's `ui` part may import `ui`, and its
    `app` part imports `fields.tsx` from InfoMapper's `app` already); step 2 confirms it with `npm run lint`.

### 12. Where the PRD is wrong, contradicts the code, or costs more than it assumes

**F1. The shared components already half exist, in `app`.** `src/app/_panels/fields.tsx` exports the input, button,
danger, primary and small classes, `Seg`, `Flag`, `Field` and `Fold` (§2). "Button is imported by one file" is true,
but most of the 308 buttons are already shared through those constants. **Proposal:**
- `src/ui/components/` gets `button.tsx` (rewritten), `icon-button.tsx`, `input.tsx` (`Input`, `Textarea`),
  `select.tsx`, `segmented.tsx`, `tabs.tsx`, `chip.tsx`, `card.tsx` and `field.tsx`;
- `fields.tsx`' constants become re-exports of the variants until step 8 removes them;
- `TextField`, `TextArea`, `useDraft` and `useChoice` stay in `app` (D-66's logic) and draw `src/ui`'s `Input` and
  `Textarea`. Moving them would move the save chain, which is shared infrastructure (The slice cycle, 4).

**F2. "Segmented replaces Draft · In review · Approved, IE · UML, the document options' choices".** Most of these are
`Seg` already: InfoMapper's and InfoCube's mapping status, InfoCube's types, and every InfoDocumenter option
(`seg-${type}-${key}`, `seg-style-*`, `seg-mappings`). S37-04's "the options panel's choices as segmented controls" is
done except for the look. Only the canvas's own switches (`LayerSwitch`, `NotationSwitch`, `Focus`, the look's
swatches) and the import's radio cards are separate. **Proposal:** move `Seg` to `src/ui` and restyle it; convert the
canvas's switches in step 4. The import's radio cards stay radios (`role="radiogroup"` in `source-step.tsx`), drawn with
`Card`.

**F3. The radius tokens collide with Tailwind's scale** (A2). Today: `rounded` 4 px (Tailwind's own, it does not read
`--radius`), `rounded-sm` 4.8, `rounded-md` 6.4, `rounded-lg` 8, `rounded-xl` 11.2 (shadcn's
`calc(var(--radius) * …)`). The PRD's `radius-sm` 4 / `md` 8 / `lg` 12 reuse the same names. Re-pointing them is the
consistent choice but moves `rounded-lg` (46 uses, some of them controls) from 8 to 12 px. **Proposal:** A2 (a). Each
step's report lists its `rounded-lg` uses and what each became.

**F4. `--background` and `--primary`.** The body and shadcn's `Dialog` are grey through `--background: var(--im-panel)`,
and `--primary` is the mapping green. The PRD does not name either. **Proposal:** re-point both in step 2 (Q2, Q9).

**F5. The canvas's cards are not only `--im-line`** (A1). `canvas.css` draws the cards' grey text in `--im-ink-3` (27
uses), the coverage bar, the mapping lines, the status dots and the "new" rows in `--im-map`, and the PII tag, the high
check mark and the warning lines in `--im-warn`. Changing the three tokens changes the cards' colours unless they are
scoped too. The prototype changes all four for the cards, `--line` included, so on the edge the PRD (DS2.3, "cards are
drawn as before") and the accepted prototype disagree. **Proposal:** A1 (a), "drawn as before" read as the same shapes,
sizes, places and elements. Łukasz decides.

**F6. The guard as specified cannot keep it this way** (A3). Most kinds come from `h-7`, `h-8`, `size-6`, `size-7`,
`text-xs` and class constants, not from `rounded-[…]` or `h-[…px]` on the tag. A text scan of `className="…"` misses
`className={smallBtn}`. **Proposal:**
- `tests/control-style-guard.test.ts` parses `src/**/*.tsx` outside `src/ui` with TypeScript's AST (the inventory's
  method);
- on `<button>`, `<input>` (not `checkbox`, `radio`, `file`, `hidden`), `<select>` and `<textarea>` it refuses a class
  for height or size (`h-*`, `min-h-*`, `size-*`), radius (`rounded*`), edge (`border*`), fill (`bg-*`) or font size
  (`text-xs`, `text-sm`, `text-[…]`), whether the class comes from a literal, a template or a constant in the same file;
- it refuses every `<select>` (the shared `Select` renders the one native select inside `src/ui`);
- layout classes (margin, width, flex, grid, position, gap) are allowed;
- probe sources, one per offence, are checked in memory under a path outside `src/ui` (as `tests/layer-rules.test.ts`
  lints its `__layer_probe__` sources) and must be refused, beside one that passes (a `Button` with layout classes);
- exceptions are listed with their reason: the canvas's cards and nodes (`src/canvas/CardNode.tsx`, `BlockNode.tsx`,
  `NoteLayer.tsx`, `FrameLayer.tsx`, `Overview.tsx`: drawn by the domain's rules and scaled with zoom), the canvas tabs
  (slice 38's), and anything step 2 finds;
- in step 2 the files not yet converted are the "to convert" list, which reaches zero in step 8.

**F7. "The shortcut in its tooltip"** (A4). Icon buttons' `title`s are read by 98 assertions. Adding a shortcut to a
title changes what they read, and neither the prototype nor a decision gives each button's shortcut. **Proposal:**
titles unchanged; `IconButton` passes `title` through; the shortcuts go to `docs/ideas.md`, beside the "?" sheet.

**F8. "InfoDocumenter's tabs"** (the `Tabs` row). InfoDocumenter has no tab row: its tab is the workspace home's
Documentation tab. The workspace home's tabs are `<Link role="tab">` in a server page (`w/[workspaceId]/page.tsx:179`),
the left panel's are `<button role="tab">` (`left-panel.tsx:659`), and the canvas tabs are a third, slice 38's kind with
menus and renaming. **Proposal:** `Tabs` provides `tabsListClass` and `tabClass(selected)` for the server page's links,
and a client `Tabs` for buttons; both keep `role="tab"`, `aria-selected` and the `tab-*` test ids. The canvas tabs are
left out (a guard exception).

**F9. Check boxes' edge in `line-control`.** S37-01 asks for "field and check box edges in `line-control`". A native
check box's edge cannot be coloured without `appearance: none` and drawing it ourselves. That costs 21 check boxes'
states (checked, indeterminate in `S11`'s names, disabled) and changes what `check()` clicks. Chrome's own edge is
about `#767676`, 4.5:1, already above 3:1. **Proposal:** native check boxes with `accent-color: var(--im-logical)`; the
criterion's "check box edges" is read as at least 3:1.

**F10. The label's colour.** Both `Field`s draw the label 11.5 px in `ink-3`; the design system's label is 12/16 500 in
`ink-2`. That is a visible change on every panel. It is in the design system (appendix B), but not in the PRD's list of
visible changes (DS1.2). **Proposal:** take it, as appendix B has it, and name it in the before/after report.

**F11. Two `Field`s.** InfoMapper's (`fields.tsx`: label and `htmlFor`) and InfoDocumenter's (`app/field.tsx`: `useId`,
`labelId`, `hintId`, a render function; slice 28's S28-06 names every control by it). **Proposal:** `src/ui`'s `Field`
takes InfoDocumenter's form (ids, hint, error), and InfoMapper's `Field` becomes a call of it with `htmlFor`, keeping
`label[for=…]` as RP-04, RP-05 and RP-14 read it.

**F12. The handover's drop-down count.** 40 selects in 11 class sets (§2), not 10. `people.tsx` and `invitations.tsx`
shadow `fields.tsx`' `inputClass` with a 28 px one.

**F13. "Every click target at least 24 × 24 px" and the rows.** Tree rows, list rows and menu items are click targets
too. Most are 24 px or more (menu items about 28), but some are smaller: `left-panel.tsx`' rows at `py-[5px]` with
11.5 px text, about 22 px, and `inlineButtonClass` at 22 px. The check script finds them. The PRD's list (icon buttons,
the status bar, the path's buttons, the folds) is not all of them. **Proposal:** fix what the script reports in the step
that owns the screen, by `min-h-target` on the row, without changing its place. A row that cannot grow without a layout
change goes to slice 38 by name.

**F14. The status bar's button** is 17 px (`status-bar.tsx:79`, `-mx-1 rounded px-1`), in a 28 px bar (`h-7`,
confirmed). 24 px fits; done as the prototype's `.sb-chk`.

**F15. The top bar at narrow widths.** S6A-10 and the "More" breakpoints (`more-breakpoints.ts`) were measured with
today's widths. The PRD's "toolbar controls 26 → 28 px" (DS2.2) changes heights only. **Proposal:** step 4 keeps every
top-bar control's width (padding and font as now); S6A-10 must pass unchanged.

**F16. `rt-view` and the rich text.** The rich-text field's view (`.rt-view`, 6 px radius, `--im-line` edge) and the
editor's dialog are controls drawn in CSS in `globals.css` and in `src/ui/rich-text/`. The PRD does not list them.
**Proposal:** step 3, radius 8 and `line-control` edge, as a field.

**F17. Generated documents** need no protection beyond Q7's compare. They read no app token.

**F18. Thumbnails change colour** (AD-32: they use the page's `--im-map`). This is wanted, but not said.
**Proposal:** name it in the report; `S12B-browsers` (on demand) need not run.

**F19. The type scale.** The body is already 13 px (`layout.tsx`, `text-[13px]`). The labels (11.5 px), the small
texts (11, 11.5, 12, 12.5 px) and the buttons (`text-xs`, 12 px; `text-[12.5px]`) vary. **Proposal:** the components
use the six styles; texts outside controls (tree rows, list meta) keep their sizes in slice 37, except where the
prototype's step 1 to 3 blocks set them (the left panel's tabs 12 px, the section list's name 13 px). The rest is slice
38's list rows.

**F20. 390 px** (A7). See section 1.

**F21. The docs.** CLAUDE.md's "UI components" section and the inventory doc are in the PRD. `README.md` lists the
scripts (its "npm run" block, about line 131), so it gets `npm run ui:check` at the closing.

### 13. The prototype and the app, where this slice touches them

| Prototype (26 November) | App after slice 37 | Why |
| --- | --- | --- |
| White pages, panels, navigation row, canvas tabs' strip | the same | taken (Q9) |
| `--ink-3`, `--map`, `--warn`, `--line`, `--line-control` | the same values | taken; the cards per A1 |
| Controls radius 8, icon buttons 28 in panels, 24 elsewhere; `.btn.sm` 28 | the same through the components | taken |
| The left panel's tabs at natural width, 14 px apart, 12 px | the same | taken (criterion 3) |
| Status bar's check 24 px, the path's buttons 24 px, folds ≥ 28 px, swatches 24 px, `.flag` 28 px pill | the same | taken |
| Fields' 3:1 edge, 32 px on pages and in the inspector, 28 px in toolbars | the same | taken |
| InfoDocumenter: section actions on hover, selected and focus, 28 px, dimmed at 30 %; `dseg` look; fields 32 px | the same | taken (step 6) |
| InfoDocumenter's bar in one 48 px row (`.de-top`) | not changed | slice 38 |
| The canvas toolbar (`#ctb`), the path's room | not built | slice 38 |
| Homes without side panels, in two columns, 1,320 px | not built | slice 38 |
| List rows where the name wins (step 4) | not built | slice 38 |
| The phone's top bar (step 4) | not built; the page does not scroll sideways (A7) | slice 38 |
| "All apps" (`#tApps`), the "Proposals" tab, InfoCatalog | not built | InfoCatalog's slices |
| A canvas in a second window | not built | later |
| Dark values under `@media (prefers-color-scheme)` | under `@variant dark` | D-85 |

### 14. The plan for steps 2 to 10

Each step ends with:
- `npm run lint`, `npm run typecheck`, `npm test`;
- the step's specs as single files (§6);
- the check script on the screens the step touched;
- the guard's "to convert" list shorter by the step's files.

| Step | What | Files (about) |
| --- | --- | --- |
| **2** | **(a)** The first commit: `scripts/ui-check.ts`, `scripts/lib/ui-check-rules.ts` and its test, `scripts/document-texts.ts`, `npm run ui:check`, `.gitignore` for `.next-ui-check`. The **before** run: report, screenshots, document texts. **(b)** The tokens (Q2) and shadcn's variables; `button.tsx` rewritten, `icon-button`, `input`, `select`, `segmented`, `tabs`, `chip`, `card` and `field` in `src/ui/components/` with unit tests of their variants (classes per role and size; `Select`'s sizes, disabled and focus; `Segmented`'s `aria-pressed`); `dialog.tsx`, `dropdown-menu.tsx` and `toast.tsx` on the tokens (radius 12, `shadow-pop`); `fields.tsx`' constants re-exporting the variants; `--im-card-line` in `canvas.css`. The guard with its probe, exceptions and "to convert" list. The slice-32 spec changes. Draft PR into `dev`. | ~25 |
| **3a** | The inspector's panels: `fields.tsx` (`Field`, `Seg`, `Flag`, `Fold`, `TextField`, `TextArea` drawing `src/ui`'s), the entity, attribute, mapping, relationship, frame, note, requirement, label, source, system, bundle, overview, selection and calculation panels, source changes, classifications, requirements section, checks box, notes here, the delete and new-table dialogs; InfoCube's `sections.tsx` and `mapping-panel.tsx` (A6). | ~30 |
| **3b** | The left panel (tabs at natural width, trees, lists, `barButton`), the toolbox and the menus (`span.min-w-0` kept), the import wizard (4 files), the rich-text field, editor and dialog (`.rt-view`), the picker. | ~10 |
| **4** | The top bar, the organization select, the user menu, the save indicator, the server badge, undo and redo, history, the working context, the side panels' toggles, the navigation row (path buttons 24 px), the view-state bar's chips, the status bar (24 px check), the canvas's switches (`LayerSwitch`, `NotationSwitch`, `Focus`, `NamesSwitch`, look, swatches, zoom, Changes' select). No control moves; widths kept (F15). | ~20 |
| **5** | The workspace and project homes (white), the tabs as `Tabs` links, tiles, settings, Metadata conventions (classifications, stereotypes, naming), People and Invitations, Baselines, lifecycle, project heading, labels, checks, consistency, delete; the canvas tabs' strip white; `new-organization-dialog`. | ~20 |
| **6** | InfoDocumenter: the editor's bar (28 px `Button sm`, `Select sm` with the ring), the section list (`IconButton` 28, hover, selected and focus, dimmed at 30 %, the name's full width), the options panel, the style panel, the figure editor, the Markdown dialog, the preview's buttons, `tab-actions`, the settings box; its `Field`, `Check`, `Chip` and `Badge` from `src/ui`. | 10 |
| **7** | InfoCube: `create-dimension-dialog`, `bus-matrix-dialog`, `infocube-box`, and what 3a left (A6). | 3–5 |
| **8** | Sign-in (`start-forms`, `page`), `link-page` (invitation, reset), change password, `error`, `global-error`, the canvas's error boundary. The guard's "to convert" list empty; `fields.tsx`' re-exports removed. The **after** run, its side-by-side page against step 2's, the document texts' `diff -r`. A full run on GitHub. | ~10 |
| **9** | Łukasz's acceptance on `npm run dev:pg` with the demo accounts: the side-by-side page and the two reports first, then the screens he picks. Stop with what he saw. | – |
| **10** | Close. `decisions.md` (D-89, AD-20's and D-85's notes, quoted in full); CLAUDE.md ("UI components": the components, the guard, `npm run ui:check`); `inventory-prototype-vs-app.md` (the look done, the layout to slice 38, the deliberate differences in §13); `known-limitations.md` (the contrast row updated; the BK chip; F13's rows left to slice 38, if any); `ideas.md` (the shortcuts and the "?" sheet). A full run on the final commit. Merge and tag `slice-37` only on Łukasz's command. | docs |

**A pg: note:** steps 2 to 8 never connect to `infomapper-dev`; step 9 uses `dev:pg` with the demo accounts only. No
`pg:` script runs in this slice, so no backup is needed (CLAUDE.md: a backup before `pg:migrate` or a merge when KB
changed; this slice migrates nothing).

### 15. The decisions' texts (corrections to section 8's proposals)

- **D-89** gains:
  - "the cards' geometry and elements unchanged; their colours follow `ink-3`, `map` and `warn`" (if A1 a);
  - "the label above a field in `ink-2`";
  - "`Seg` became `Segmented`, its semantics unchanged (`aria-pressed`)";
  - "native selects and check boxes kept".
- **AD-20's note** gains: "`src/ui/components` holds the controls; `TextField` and `TextArea` keep D-66's draft logic in
  `app` and draw them; the guard is an AST check of control tags outside `src/ui`, its exceptions named in it".
- **D-85's note** gains `--im-card-line`, `--im-on-accent` and `--im-shadow-pop` with their dark values.

### 16. Ideas for `docs/ideas.md` (not built)

- Shortcuts in icon buttons' tooltips, with the "?" sheet (F7).
- A drawn check box in `line-control` if the 4.5:1 native one is ever not enough (F9).
- The BK chip's contrast (4.07:1), with the physical colours.

## Step 2: tokens, components, the guard and the check script (26 November 2026)

**(a) The check script** (`npm run ui:check`, `scripts/ui-check.ts`, rules in `scripts/lib/ui-check-rules.ts`, tested in
`tests/ui-check-rules.test.ts`) and `scripts/document-texts.ts`.

Three rules were added to the PRD's after the first trial:
- **Text out of its control:** a control whose own text runs past its box without clipping.
- **Words run together:** the words of two controls side by side less than 8 px apart. This is how today's left panel
  reads "SourcesRequirements": the tabs widen to fit, so neither overlap nor cut text catches it.
- **A control under a panel** lying over the page (its centre covered by something that is not a control) collides with
  nothing.

Screen-reader-only text (1 px wide) is not "cut". The left panel's tabs and the bus matrix are not checked below 1,001 px,
where the left panel is hidden.

**The "before" run** (`.data/ui-check/before-20261126-1349/`, git-ignored): `dev`'s look, served from a worktree of
`1bb5ad9` (the app unchanged), 177 screen views (25 screens at 1280, 1440 and 1920 px in light and dark, 21 at 390 px),
no errors.

| Finding | Views | What |
| --- | --- | --- |
| Overlaps | 54, all at 390 px | the top bar's controls (working context, Undo, Redo, the panel toggle, zoom, the user) run into one another; the details panel lying over the page covers the navigation row |
| Text out of its control | 18 | a mapping row's source text (`fname Customer.preferred_contact_channel…`) runs out of its row at every width; the working context's label at 390 px |
| Words run together | 156 | the left panel's tabs "Sources" and "Requirements" 2 to 7 px apart (every width); the top bar's switchers and the layer switch at 1280 and 1440 px |
| Past the edge, page wider | 0 | |
| Cut without an ellipsis | 0 | |
| Under 24 px, no room around (WCAG fails) | 43 | the concepts' check boxes (13 px, close together), the working context (16 × 30), the navigation row's links (20 px), the overview's toggle (22 × 20), a source table's system chip (19 px), the attribute's entity link (19 px) |
| Under 24 px, with room (WCAG passes by spacing) | 2,135 | the breadcrumbs, the folds' headers (20 px), InfoDocumenter's ↑ ↓ ✕ (22 px), the note's ✓ (17 px), the status bar's "Model checks" (17 px), the check boxes, the bus matrix's dots, React Flow's attribution link |

**Kinds in light at 1280 to 1920 px** (dark has the same number): 49 button shapes plus 5 tab shapes (47 different
height, font and radius combinations); 14 kinds of field; 5 kinds of drop-down (33, 32, 28 and 26 px; radius 6.5 px). The
audit's 37 counted fewer screens.
- **Button heights seen:** 20, 22, 24, 26, 28, 29.5, 30, 31.5, 32 and 37.5 px.
- **Radii seen:** 0, 2, 4, 5, 6, 6.5, 7, 10, 13, 14 and 15 px.
- **Field heights seen:** 25.5, 26, 32, 33.5 and 60 px.

**Generated documents:** `scripts/document-texts.ts before` and again after (b): `diff -r` is empty (the demo's three
documents and three documents of every section type: Markdown, HTML, CSS).

**(b) What changed:**
- **The tokens in `globals.css`:** `ink-3`, `map`, `warn` and `line` (light), `ink-3` (dark); new `line-control`,
  `card-line`, `on-accent`, `shadow-pop`, the size and type scales; one radius scale (4, 8, 12 px); shadcn's
  `--background` → `im-surface` (the body is white), `--primary` → the accent, `--input` → `line-control`; check boxes in
  the accent (F9).
- **The canvas** draws with `--im-card-line` (16 uses in `canvas.css`), so its cards keep their edge (A1).
- **`src/ui/components`:**
  - `button.tsx` rewritten (`primary`, `secondary`, `quiet`, `danger`; `md`, `sm`, `bar`; `buttonVariants` the look
    alone);
  - new `icon-button.tsx`, `input.tsx`, `select.tsx`, `segmented.tsx`, `tabs.tsx`, `chip.tsx`, `card.tsx` and `field.tsx`;
  - `dialog.tsx`, `dropdown-menu.tsx` and `toast.tsx` on the tokens (radius 12, `shadow-pop`; the dialog's close as a
    28 px icon button).
- **`fields.tsx`:** `buttonClass`, `smallButtonClass`, `dangerClass`, `primaryClass` and `inputClass` re-export the
  components' look. Every panel that uses them changes now: 32 and 28 px, radius 8, the 3:1 field edge, the focus ring.
- **The guard** (`tests/control-style-guard.test.ts`, rules in `tests/lib/control-style.ts`):
  - offences: 324 in 81 files before the re-exports, 215 in 67 after;
  - one exception (the canvas tabs, slice 38);
  - 66 files to convert, listed by the step that converts them: 3a 15, 3b 6, 4 16, 5 12, 6 9, 7 1, 8 7.
- **The slice-32 specs:** `e2e/slice-32/helpers.ts` (`TOKENS["--im-map"]` `#087a65`; `BODY_BG` white and `#1f262f`) and
  `e2e/slice-29/S32-smoke-theme.spec.ts` (the body's two colours), because the decision changes those values. Their
  assertions are unchanged.

**Two calls I made in step 2:**
- The small button keeps 12 px text (`text-small`), not appendix B's 13 px, so its width hardly changes (S33-05, S6A-10).
- `Seg` keeps its look until step 3: `Segmented` exists, but `fields.tsx`' `Seg` is not re-pointed yet, because of
  S28-07's no-wrap check in the editor.

**Checks:**
- `npm run lint`, `npm run typecheck` and `npm test` pass (216 files, 2,606 tests).
- The slice-32 specs pass as single files (12 tests).
- A first `npm test` run while the before run and a second dev server loaded the laptop timed out in 8 tests. All of
  them pass on their own and in the next full run.
