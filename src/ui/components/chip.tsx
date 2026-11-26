// Slice 37 (S37-02): the chip, a mark (never a button unless it says so). 22 px, radius 4, in a tone that means
// something: `neutral`, `pii` (warn: personal data), `ok` (mapping: approved), `req` (requirement), `src` (physical: a
// source), `sel` (the accent: selected). The filter chip is a button: 28 px, a pill, `on` in the accent.
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

export const chipVariants = cva("inline-flex h-[22px] items-center gap-1 whitespace-nowrap rounded-sm px-2 text-small font-medium", {
  variants: {
    tone: {
      neutral: "bg-im-hover text-im-ink-2",
      pii: "bg-im-warn-soft text-im-warn",
      ok: "bg-im-map-soft text-im-map",
      req: "bg-im-req-soft text-im-req",
      src: "bg-im-physical-soft text-im-physical",
      sel: "bg-im-logical-soft text-im-logical",
    },
  },
  defaultVariants: { tone: "neutral" },
})

export const filterChipVariants = cva(
  "inline-flex h-control-sm items-center gap-1 whitespace-nowrap rounded-full border px-3 text-small font-medium outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-im-logical disabled:cursor-not-allowed disabled:opacity-45",
  {
    variants: {
      on: {
        true: "border-im-logical bg-im-logical-soft text-im-logical",
        false: "border-im-line bg-im-surface text-im-ink-2 enabled:hover:bg-im-hover",
      },
    },
    defaultVariants: { on: false },
  },
)

function Chip({ className, tone, ...props }: React.ComponentProps<"span"> & VariantProps<typeof chipVariants>) {
  return <span data-slot="chip" className={cn(chipVariants({ tone }), className)} {...props} />
}

export { Chip }
