// The canvas toolbar's room (slice 38, B2): the width its strip offers it (the strip's content box, the width the
// toolbar's container queries read), reported by a `ResizeObserver` after the browser's own layout. “More”'s menu reads
// it, since its items live in a portal outside the strip where no container query reaches. Client code only.

import { createValueStore } from "./value-store";

/** The strip's content width in px, or null until the first report. */
export const toolbarRoom = createValueStore<number | null>(null);
