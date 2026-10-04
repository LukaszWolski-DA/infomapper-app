import { describe, expect, it } from "vitest";
import { afterRedo, afterUndo, emptyHistory, historyKey, nextRedo, nextUndo, recordChange, UNDO_LIMIT, type UndoStep } from "./undo-history";

const step = (n: number): UndoStep => ({ changeGroupId: `group-${n}`, events: [] });

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
});
