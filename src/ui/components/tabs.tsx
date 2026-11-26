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
