// What hides things on the open canvas, as numbers (slice 6a): the view-state bar's chips and the status bar's open
// notes read them. `ModelCanvas` publishes them from an effect whenever one changes, into a store outside React state,
// so the bars re-render and the canvas never does (S6A-08). Null while no canvas is mounted.

import { createValueStore } from "./value-store";

export interface ViewCounts {
  /** Entity and source cards with a row filter; a live canvas's Labeled filter is not counted (D-39). */
  filtered: number;
  collapsedCards: number;
  /** Frames shown collapsed: saved, or in this tab only for those who cannot edit (slice 2c). */
  collapsedFrames: number;
  /** Resolved notes on the canvas, shown or hidden. */
  resolvedNotes: number;
  /** Open notes on the canvas, shown or hidden (prototype `renderStatus`). */
  openNotes: number;
}

const same = (a: ViewCounts | null, b: ViewCounts | null) =>
  a === b ||
  (!!a &&
    !!b &&
    a.filtered === b.filtered &&
    a.collapsedCards === b.collapsedCards &&
    a.collapsedFrames === b.collapsedFrames &&
    a.resolvedNotes === b.resolvedNotes &&
    a.openNotes === b.openNotes);

export const viewCounts = createValueStore<ViewCounts | null>(null, same);
