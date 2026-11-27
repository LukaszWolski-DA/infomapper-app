"use client"

// Slice 37 (S37-02, F10, F11): a field: the label above its control (12/16 500 in `ink-2`, Łukasz's answer to F10),
// then a hint or an error (12/16). InfoDocumenter's form (slice 28, finding 1): a single control takes the field's
// `id` (`<label htmlFor>`), a group takes `aria-labelledby` with the label's id, the hint describes it
// (`aria-describedby`); `children` may be a function of those ids. `htmlFor` names an id the caller already gives its
// control (InfoMapper's panels: `label[for=f-rfr]`, which RP-04, RP-05 and RP-14 read).
import { useId, type ReactNode } from "react"

export const FIELD_LABEL = "mb-1 block text-small font-medium text-im-ink-2"
export const FIELD_HINT = "mt-1 text-small text-im-ink-3"
export const FIELD_ERROR = "mt-1 text-small text-im-warn"

export interface FieldIds {
  /** For a single control: its `id`, which the label names. */
  id: string
  /** For a group: its `aria-labelledby` (undefined when the field has no label). */
  labelId: string | undefined
  /** For the control or group: its `aria-describedby` (undefined without a hint or an error). */
  hintId: string | undefined
}

export function Field({
  label,
  hint,
  error,
  htmlFor,
  testId,
  className,
  children,
}: {
  label?: string
  hint?: string
  error?: string
  htmlFor?: string
  testId?: string
  /** Layout only (the wrapper's margin). */
  className?: string
  children: ReactNode | ((ids: FieldIds) => ReactNode)
}) {
  const own = useId()
  const id = htmlFor ?? own
  const ids: FieldIds = { id, labelId: label ? `${id}-label` : undefined, hintId: hint || error ? `${id}-hint` : undefined }
  return (
    <div className={className} data-testid={testId}>
      {label && (
        <label id={ids.labelId} htmlFor={id} className={FIELD_LABEL}>
          {label}
        </label>
      )}
      {typeof children === "function" ? children(ids) : children}
      {error ? (
        <div id={ids.hintId} className={FIELD_ERROR}>
          {error}
        </div>
      ) : (
        hint && (
          <div id={ids.hintId} className={FIELD_HINT}>
            {hint}
          </div>
        )
      )}
    </div>
  )
}
