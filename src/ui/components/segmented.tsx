"use client"

// Slice 37 (S37-02, F2): pick one of two to four. `fields.tsx`' `Seg` (prototype .seg; slices 19 and 28) moved here with
// its props and its semantics unchanged: a `role="group"` of buttons with `aria-pressed` (the e2e specs read both and the
// group's test id), named by `labelledBy` and described by `describedBy`; `columns={2}` lays the choices out in two
// columns. The look is the design system's (appendix B's `.im-seg`): the track on `hover`, 28 px with 24 px buttons,
// the chosen one white with a light shadow.
import { cn } from "@/ui/lib/utils"

export const SEGMENTED_TRACK = "rounded-md bg-im-hover p-0.5 gap-0.5"
export const SEGMENTED_BUTTON =
  "min-h-6 whitespace-nowrap rounded-[6px] px-2.5 text-[12.5px] font-medium text-im-ink-2 outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-im-logical enabled:hover:text-im-ink disabled:cursor-not-allowed aria-pressed:bg-im-surface aria-pressed:text-im-ink aria-pressed:shadow-[0_1px_2px_rgba(22,32,48,0.12),0_0_0_1px_var(--im-line)]"

/**
 * The top bar's segmented switches (the layer, the notation; step 4, F15): the track without the gap and buttons 26 px in
 * the bar's own text, so each switch keeps its width; the chosen one as `SEGMENTED_BUTTON`'s.
 */
export const SEGMENTED_BAR_TRACK = "rounded-md bg-im-hover p-0.5"
export const SEGMENTED_BAR_BUTTON =
  "h-[26px] whitespace-nowrap rounded-[6px] px-2.5 text-im-ink-2 outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-im-logical enabled:hover:text-im-ink aria-pressed:bg-im-surface aria-pressed:text-im-ink aria-pressed:shadow-[0_1px_2px_rgba(22,32,48,0.12),0_0_0_1px_var(--im-line)]"

export function Segmented<V extends string>({
  value,
  options,
  onChange,
  disabled,
  testId,
  columns,
  labelledBy,
  describedBy,
  className,
}: {
  value: V
  options: readonly (readonly [V, string])[]
  onChange: (v: V) => void
  disabled?: boolean
  testId?: string
  /** The choices in a grid of two columns (prototype .seg.g2, slice 19). */
  columns?: 2
  /** The group's name and description, by the ids of its label and hint (slice 28). */
  labelledBy?: string
  describedBy?: string
  /** Layout only (margin, width). */
  className?: string
}) {
  const layout = columns === 2 ? "grid grid-cols-2" : "inline-flex"
  return (
    <div className={cn(layout, SEGMENTED_TRACK, className)} role="group" aria-labelledby={labelledBy} aria-describedby={describedBy} data-testid={testId}>
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          aria-pressed={v === value}
          disabled={disabled}
          onClick={() => v !== value && onChange(v)}
          className={SEGMENTED_BUTTON}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
