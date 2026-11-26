// Slice 37 (S37-02): text fields. One look for every input and text area: the `line-control` edge (3:1, WCAG 1.4.11),
// radius 8, white; focused: the accent edge and a 3 px `logical-soft` ring; read only on `panel`; disabled at 45 %.
// `md` 32 px (pages, forms, dialogs, the inspector), `sm` 28 px (toolbars, dense rows). The look is `inputVariants`, so
// a field that keeps its own logic (D-66's `TextField`, `TextArea` and `useDraft` in `src/app/_panels/fields.tsx`)
// draws the same field.
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/ui/lib/utils"

/** The look every field shares: inputs, text areas and drop-downs (select.tsx). */
export const FIELD_LOOK =
  "w-full min-w-0 rounded-md border border-im-line-control bg-im-surface text-im-ink outline-none placeholder:text-im-ink-3 focus:border-im-logical focus:ring-3 focus:ring-im-logical-soft disabled:cursor-not-allowed disabled:opacity-45 read-only:bg-im-panel aria-invalid:border-im-warn"

export const inputVariants = cva(FIELD_LOOK, {
  variants: {
    size: {
      // `min-h`, not `h`: a text area drawn with the same look grows with its text
      md: "min-h-control-md px-2.5 py-[5px] text-body",
      sm: "min-h-control-sm px-2 py-[3px] text-[12.5px] leading-5",
    },
  },
  defaultVariants: { size: "md" },
})

export const textareaVariants = cva(`${FIELD_LOOK} min-h-[76px] resize-y px-2.5 py-1.5 text-body`)

/** A field that reads as text until hovered or focused (the top bar's zoom, step 4): 28 px, its edge only when focused. */
export const QUIET_FIELD =
  "h-control-sm rounded-md bg-transparent text-im-ink-2 outline-none hover:bg-im-hover focus:bg-im-surface focus:text-im-ink focus:shadow-[0_0_0_1px_var(--im-line-control),0_0_0_4px_var(--im-logical-soft)]"

type InputProps = Omit<React.ComponentProps<"input">, "size"> & VariantProps<typeof inputVariants>

function Input({ className, size, type = "text", ...props }: InputProps) {
  return <input data-slot="input" type={type} className={cn(inputVariants({ size }), className)} {...props} />
}

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea data-slot="textarea" className={cn(textareaVariants(), className)} {...props} />
}

export { Input, Textarea }
