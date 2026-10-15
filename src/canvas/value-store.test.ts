import { describe, expect, it, vi } from "vitest";
import { createValueStore } from "./value-store";

describe("a value store (slice 4p, trial A)", () => {
  it("notifies only when the value changes, by its own comparison", () => {
    const s = createValueStore<{ id: string } | null>(null, (a, b) => a?.id === b?.id);
    const seen = vi.fn();
    const off = s.subscribe(seen);
    s.set({ id: "r1" });
    s.set({ id: "r1" });
    s.set(null);
    expect(seen).toHaveBeenCalledTimes(2);
    expect(s.get()).toBeNull();
    off();
    s.set({ id: "r2" });
    expect(seen).toHaveBeenCalledTimes(2);
    expect(s.get()).toEqual({ id: "r2" });
  });
});
