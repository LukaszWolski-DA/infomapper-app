// The notes' paper colours in small drawings (prototype NOTE_MINI): the Overview's miniature (slice 3b) and the canvas
// thumbnails on the home pages (slice 12b), one table for both (step 1, F10 and answer 6).

import type { NoteColor } from "@/domain/types";

/** A note's paper colour in a miniature or a thumbnail. */
export const NOTE_MINI: Record<NoteColor, string> = { yellow: "#E9C94F", blue: "#7FA9E0", green: "#7CC197", pink: "#E59BB6", grey: "#A9B0BA" };
