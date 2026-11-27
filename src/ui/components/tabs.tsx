// Slice 37 (S37-02, F8): the tab row, views of one page. Text tabs at their natural width with room between them (no
// more "SourcesRequirements", criterion 3), the selected one with a 2 px accent underline; the row scrolls sideways
// when it does not fit, with a fade at its end on a narrow screen. Plain classes, so a server page's `<Link role="tab">`
// (the workspace home) and a client's `<button role="tab">` (the left panel) draw the same row; both keep `role="tab"`,
// `aria-selected` and their test ids. `page` 40 px tall and 20 px apart; `panel` 30 px and 14 px apart (a 264 px panel,
// the prototype's `aside .tabs`).
import { cva } from "class-variance-authority"

export const tabsListVariants = cva(
  "flex min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden max-[600px]:pr-6 max-[600px]:[mask-image:linear-gradient(to_right,#000_calc(100%-32px),transparent)]",
  {
    variants: {
      density: {
        page: "gap-5 border-b border-im-line",
        panel: "gap-3.5",
        // slice 38 (B8): the canvas tabs' strip, 38 px, its tabs standing on its bottom line
        canvas: "h-[38px] flex-none items-end gap-0.5 overflow-y-hidden bg-im-surface px-2 [background:linear-gradient(var(--im-line),var(--im-line))_bottom/100%_1px_no-repeat,var(--im-surface)]",
      },
    },
    defaultVariants: { density: "page" },
  },
)

export const tabVariants = cva(
  "flex flex-none items-center whitespace-nowrap font-medium text-im-ink-3 shadow-[inset_0_-2px_0_transparent] outline-none hover:text-im-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-im-logical aria-selected:text-im-ink aria-selected:shadow-[inset_0_-2px_0_var(--im-logical)]",
  {
    variants: {
      density: {
        page: "h-10 text-body",
        panel: "h-[30px] text-small",
      },
    },
    defaultVariants: { density: "page" },
  },
)

/** A count after a tab's name, in `ink-3` (the design system's words: "counts after a label"). */
export const TAB_COUNT = "ml-1 font-normal text-im-ink-3"

/**
 * Slice 38 (B8): a canvas tab (the project home's and each canvas's): a raised tab, 31 px, its top corners rounded; the
 * open one on the canvas's colour with its edges (`CANVAS_TAB_ON`). Drawn on `<Link role="tab">`, so plain classes.
 */
export const CANVAS_TAB =
  "relative flex h-[31px] cursor-pointer select-none items-center gap-[7px] whitespace-nowrap rounded-t-[7px] text-im-ink-2 hover:bg-im-hover"
export const CANVAS_TAB_ON = "bg-im-canvas font-medium text-im-ink shadow-[inset_1px_1px_0_var(--im-line),inset_-1px_0_0_var(--im-line)] hover:bg-im-canvas"
