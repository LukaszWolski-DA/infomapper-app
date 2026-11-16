"use client";

// One field of the editor's panels (slice 28, finding 1): its label tied to its control, so every input, select, text
// area and segment group has an accessible name. A single control takes the field's `id` (`<label htmlFor>`); a group
// (segments, a list of check boxes) takes `aria-labelledby` with the label's id; the hint describes it
// (`aria-describedby`). The editor, the style panel and the sections' options all draw their fields with it.

import { useId, type ReactNode } from "react";

export interface FieldIds {
  /** For a single control: its `id`, which the label names. */
  id: string;
  /** For a group: its `aria-labelledby` (undefined when the field has no label). */
  labelId: string | undefined;
  /** For the control or group: its `aria-describedby` (undefined without a hint). */
  hintId: string | undefined;
}

export function Field({ label, hint, children, testId }: { label?: string; hint?: string; testId?: string; children: ReactNode | ((ids: FieldIds) => ReactNode) }) {
  const id = useId();
  const ids: FieldIds = { id, labelId: label ? `${id}-label` : undefined, hintId: hint ? `${id}-hint` : undefined };
  return (
    <div className="de-wrap mt-3" data-testid={testId}>
      {label && (
        <label id={ids.labelId} htmlFor={id} className="mb-1 block text-[11.5px] text-im-ink-3">
          {label}
        </label>
      )}
      {typeof children === "function" ? children(ids) : children}
      {hint && (
        <div id={ids.hintId} className="mt-1 text-[11.5px] text-im-ink-3">
          {hint}
        </div>
      )}
    </div>
  );
}
