// The dimensional mapping whose panel puts the cursor in its rule when it shows (slice 15c, P20, X2): "Edit
// transformation rule…" in the line's menu, a second input, Transformation chosen. A value store, so asking never
// re-renders the canvas.

import { createValueStore } from "@/canvas/value-store";
import type { Uuid } from "@/domain/ids";

export const ruleFocus = createValueStore<Uuid | null>(null);
