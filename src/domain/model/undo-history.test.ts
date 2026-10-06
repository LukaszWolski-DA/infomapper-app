import { describe, expect, it } from "vitest";
import {
  afterRedo,
  afterUndo,
  doneStepMessage,
  dropNextRedo,
  dropNextUndo,
  emptyHistory,
  historyKey,
  nextRedo,
  nextUndo,
  recordChange,
  refusedStepMessage,
  UNDO_LIMIT,
  type UndoStep,
} from "./undo-history";

const step = (n: number): UndoStep => ({ changeGroupId: `group-${n}`, label: `Step ${n}`, events: [] });

describe("undo history (slice 1b)", () => {
  it("undoes the newest change first and redoes the newest undo first", () => {
    let h = recordChange(recordChange(emptyHistory, step(1)), step(2));
    expect(nextUndo(h)).toEqual(step(2));
    expect(nextRedo(h)).toBeNull();
    h = afterUndo(h, step(-2));
    expect(nextUndo(h)).toEqual(step(1));
    expect(nextRedo(h)).toEqual(step(-2));
    h = afterRedo(h, step(22));
    expect(nextUndo(h)).toEqual(step(22));
    expect(nextRedo(h)).toBeNull();
  });

  it("forgets what could be redone after a new change", () => {
    const h = recordChange(afterUndo(recordChange(emptyHistory, step(1)), step(-1)), step(2));
    expect(nextRedo(h)).toBeNull();
    expect(h.undo).toEqual([step(2)]);
  });

  it(`keeps the last ${UNDO_LIMIT} steps`, () => {
    let h = emptyHistory;
    for (let n = 1; n <= UNDO_LIMIT + 5; n++) h = recordChange(h, step(n));
    expect(h.undo).toHaveLength(UNDO_LIMIT);
    expect(h.undo[0]).toEqual(step(6));
    expect(nextUndo(h)).toEqual(step(UNDO_LIMIT + 5));
  });

  it("is kept per person and workspace", () => {
    expect(historyKey("ws-1", "user-1")).not.toBe(historyKey("ws-1", "user-2"));
    expect(historyKey("ws-1", "user-1")).not.toBe(historyKey("ws-2", "user-1"));
  });

  it("drops a refused step, so the next Ctrl+Z goes further back (and the next redo further on)", () => {
    const h = recordChange(recordChange(emptyHistory, step(1)), step(2));
    expect(nextUndo(dropNextUndo(h))).toEqual(step(1));
    const undone = afterUndo(afterUndo(h, step(-2)), step(-1));
    expect(nextRedo(dropNextRedo(undone))).toEqual(step(-2));
    expect(dropNextUndo(emptyHistory)).toEqual(emptyHistory);
  });

  it("says which step was dropped", () => {
    expect(refusedStepMessage("undo", "Rename entity")).toBe("Couldn't undo “Rename entity” because it was changed afterwards. Ctrl+Z again goes further back.");
    expect(refusedStepMessage("redo", "Rename entity")).toBe("Couldn't redo “Rename entity” because it was changed afterwards. Ctrl+Shift+Z again goes further on.");
  });
});

describe("undo and redo toasts (slice 1b)", () => {
  it("name the step, and the canvas when it is another one", () => {
    expect(doneStepMessage("undo", "Delete mapping", null)).toBe("Undone: Delete mapping");
    expect(doneStepMessage("redo", "Move card", "Order lines & products")).toBe("Redone: Move card on Order lines & products");
  });
});
