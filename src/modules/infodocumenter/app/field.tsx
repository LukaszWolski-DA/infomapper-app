"use client";

// One field of the editor's panels (slice 28, finding 1): its label tied to its control, so every input, select, text
// area and segment group has an accessible name. A single control takes the field's `id` (`<label htmlFor>`); a group
// (segments, a list of check boxes) takes `aria-labelledby` with the label's id; the hint describes it
// (`aria-describedby`). The editor, the style panel and the sections' options all draw their fields with it.
// Slice 37 (step 6, F11): `src/ui`'s `Field` (its label 12/16 500 in `ink-2`), with the editor's wrapper class (`de-wrap`,
// which the editor's CSS reads) and its margin.

import type { ReactNode } from "react";
import { Field as UiField, type FieldIds } from "@/ui/components/field";

export type { FieldIds };

export function Field({ label, hint, children, testId }: { label?: string; hint?: string; testId?: string; children: ReactNode | ((ids: FieldIds) => ReactNode) }) {
  return (
    <UiField label={label} hint={hint} testId={testId} className="de-wrap mt-3">
      {children}
    </UiField>
  );
}
