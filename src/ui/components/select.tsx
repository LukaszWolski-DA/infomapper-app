// Slice 37 (S37-02, the drop-down chore, DS2.2): the drop-down. A native `<select>` (Q4): the e2e specs' `selectOption`,
// the keyboard and screen readers work as before, and its list follows `color-scheme` (D-85). One look in three heights,
// `md` 32 px, `sm` 28 px, `bar` 30 px (the top bar); the fields' edge and focus ring (InfoDocumenter's drop-downs had
// none); disabled at 45 %. Every other prop (test id, id, aria-*, value, onChange, ref) is passed through. Outside
// `src/ui` a native `<select>` is refused by the guard (tests/control-style-guard.test.ts): use this one.
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { FIELD_LOOK } from "./input"

export const selectVariants = cva(`${FIELD_LOOK} cursor-pointer pl-2 pr-1`, {
  variants: {
    size: {
      md: "h-control-md text-body",
      sm: "h-control-sm text-[12.5px]",
      bar: "h-control-bar text-small",
    },
  },
  defaultVariants: { size: "md" },
})

type SelectProps = Omit<React.ComponentProps<"select">, "size"> & VariantProps<typeof selectVariants>

function Select({ className, size, ...props }: SelectProps) {
  return <select data-slot="select" className={cn(selectVariants({ size }), className)} {...props} />
}

export { Select }
