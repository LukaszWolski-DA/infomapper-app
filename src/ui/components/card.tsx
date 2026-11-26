// Slice 37 (S37-02): a page block or a list item. A hairline, radius 12, no shadow (appendix B's `.im-card`); `quiet`
// on `panel` without an edge. Not the canvas's cards, which the canvas draws (DS2.3).
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/ui/lib/utils"

export const cardVariants = cva("rounded-lg", {
  variants: {
    tone: {
      plain: "border border-im-line bg-im-surface",
      quiet: "border border-transparent bg-im-panel",
    },
    pad: {
      md: "p-4",
      none: "",
    },
  },
  defaultVariants: { tone: "plain", pad: "md" },
})

/** A tile that adds one (New project, New canvas): a card's size, a dashed-looking inner line, the accent on hover. */
export const ADD_TILE =
  "grid min-h-[200px] place-items-center rounded-lg bg-transparent font-medium text-im-ink-2 shadow-[inset_0_0_0_1.5px_var(--im-line)] hover:text-im-logical hover:shadow-[inset_0_0_0_1.5px_var(--im-logical)] data-[state=open]:text-im-logical"

function Card({ className, tone, pad, ...props }: React.ComponentProps<"div"> & VariantProps<typeof cardVariants>) {
  return <div data-slot="card" className={cn(cardVariants({ tone, pad }), className)} {...props} />
}

export { Card }
