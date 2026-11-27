// Slice 37 (S37-02, F9, step 6): a check box with its label. A native check box (its edge about 4.5:1, the accent from
// `accent-color` in globals.css); the label is the target, at least 24 px tall. Every other prop goes to the input.
import * as React from "react"
import { cn } from "@/ui/lib/utils"

export const CHECK_LABEL = "flex min-h-target items-center gap-2"

function Check({ label, className, ...props }: Omit<React.ComponentProps<"input">, "type"> & { label: React.ReactNode }) {
  return (
    <label className={cn(CHECK_LABEL, className)}>
      <input type="checkbox" {...props} />
      {label}
    </label>
  )
}

export { Check }
