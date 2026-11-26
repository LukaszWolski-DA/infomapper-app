// Slice 37 (S37-02, D-89 as proposed): the button. One shape in four roles and three heights, on the design system's
// tokens (appendix B's `.im-btn`): `primary` (the accent), `secondary` (the default: an edge on white), `quiet` (no edge,
// no fill) and `danger` (the warning colour); `md` 32 px on pages, in forms and dialogs, `sm` 28 px in panels and
// toolbars, `bar` 30 px in the top bar (`xs`, 24 px, only inside a 28 px row). `buttonVariants` is the look alone (no
// display or alignment), so a `<Link>` or a row can take it, and so `fields.tsx`' class constants re-export it without
// changing how their buttons lay out their content. The fifth role, the icon button, is `IconButton` (icon-button.tsx).
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/ui/lib/utils"
import { Slot } from "radix-ui"

export const buttonVariants = cva(
  "shrink-0 whitespace-nowrap rounded-md border font-medium transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-im-logical disabled:cursor-default disabled:opacity-45 aria-disabled:cursor-default aria-disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "border-im-logical bg-im-logical text-im-on-accent enabled:hover:brightness-108",
        secondary: "border-im-line bg-im-surface text-im-ink enabled:hover:bg-im-hover",
        quiet: "border-transparent bg-transparent text-im-ink-2 enabled:hover:bg-im-hover enabled:hover:text-im-ink",
        danger: "border-im-line bg-im-surface text-im-warn enabled:hover:bg-im-warn-soft",
      },
      size: {
        md: "h-control-md px-3.5 text-body",
        sm: "h-control-sm px-2.5 text-small",
        bar: "h-control-bar px-2.5 text-body",
        // 24 px, only inside a 28 px row that has no room for more (the conflict line in a canvas tab, slice 14b)
        xs: "h-target px-2 text-small",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
)

/** What a `Button` adds to the look: its content in one centred row. */
export const BUTTON_LAYOUT = "inline-flex items-center justify-center gap-1.5 [&_svg:not([class*='size-'])]:size-4"

export type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>["variant"]>
export type ButtonSize = NonNullable<VariantProps<typeof buttonVariants>["size"]>

function Button({
  className,
  variant,
  size,
  asChild = false,
  type,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"
  return (
    <Comp
      data-slot="button"
      // a button never submits a form by accident; a submit button says so
      type={asChild ? type : (type ?? "button")}
      className={cn(BUTTON_LAYOUT, buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
}

export { Button }
