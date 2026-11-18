// The canvas's selection as it is now (fix/late-selection-remaining): the one place that changes it. `CanvasProvider`
// keeps one holder and hands its `select` out as `ui.select`, so every path that selects (a click on a card, a row, a
// line, a frame, a note or the empty canvas, a lasso, Ctrl+A, Escape, the tree, the go-to links, the checks, Focus, a
// found row, Back and Forward, `deselectDeleted`, `selectMade`) goes through it, and `now()` is never behind a click
// the page has not drawn yet. React's state follows it (`onChange`); nothing reads the holder during a render.

import type { Selection } from "./line-data";
import { selectionAfterAnswer, selectionDeleted } from "./selection";

export interface SelectionHolder {
  /** The selection as it is now, also between a click and the render that draws it. */
  now: () => Selection;
  select: (sel: Selection) => void;
  /**
   * An answer that selects what it made: `made` only if the selection is still `sent` (`selectionAfterAnswer`).
   * Answers whether it took, so the answer's other effects (the details panel, a name's focus, the view) follow it.
   */
  selectMade: (sent: Selection, made: Selection) => boolean;
  /** After a delete's answer: cleared only if it points at a deleted row (`selectionDeleted`). */
  deselectDeleted: (deleted: readonly string[] | undefined) => void;
}

export function selectionHolder(onChange: (sel: Selection) => void, initial: Selection = null): SelectionHolder {
  let current = initial;
  const select = (sel: Selection) => {
    current = sel;
    onChange(sel);
  };
  return {
    now: () => current,
    select,
    selectMade: (sent, made) => {
      // the rule decides; it took when it gave `made` (also when `made` names what is selected already)
      const took = selectionAfterAnswer(current, sent, made) === made;
      if (took) select(made);
      return took;
    },
    deselectDeleted: (deleted) => {
      if (!deleted?.length) return;
      if (selectionDeleted(current, new Set(deleted))) select(null);
    },
  };
}
