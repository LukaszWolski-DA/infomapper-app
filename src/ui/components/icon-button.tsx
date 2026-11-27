// Slice 37 (S37-02, S37-03): the icon button, the button's fifth role. 28 px in panels and toolbars; 24 px (`xs`) only
// where a dense row allows no more; no edge, no fill until hovered. `label` is its accessible name (`aria-label`); a
// `title`, when given, is passed through word for word (A4: the e2e specs read titles; shortcuts come later).
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/ui/lib/utils"

export const iconButtonVariants = cva(
  "inline-grid shrink-0 place-items-center rounded-md border border-transparent bg-transparent text-im-ink-2 transition-colors outline-none enabled:hover:bg-im-hover enabled:hover:text-im-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-im-logical disabled:cursor-default disabled:opacity-30 aria-pressed:bg-im-logical-soft aria-pressed:text-im-logical [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      size: {
        sm: "size-control-sm",
        xs: "size-target rounded-[6px]",
      },
    },
    defaultVariants: { size: "sm" },
  },
)

function IconButton({
  label,
  size,
  className,
  type = "button",
  ...props
}: Omit<React.ComponentProps<"button">, "aria-label"> & VariantProps<typeof iconButtonVariants> & { label: string }) {
  return <button data-slot="icon-button" type={type} aria-label={label} className={cn(iconButtonVariants({ size }), className)} {...props} />
}

export { IconButton }
