import { describe, expect, it } from "vitest";
import type { Selection } from "./line-data";
import { selectionHolder } from "./selection-now";

// fix/late-selection-remaining: the provider's one holder of the selection; `selectMade` answers whether it took
function holder(initial: Selection = null) {
  const drawn: Selection[] = [];
  return { h: selectionHolder((s) => drawn.push(s), initial), drawn };
}

describe("selectionHolder", () => {
  it("knows a selection at once, before React draws it", () => {
    const { h, drawn } = holder();
    h.select({ t: "card", id: "c1" });
    expect(h.now()).toEqual({ t: "card", id: "c1" });
    expect(drawn).toEqual([{ t: "card", id: "c1" }]);
  });

  it("selectMade takes and answers true when the selection is still the one sent", () => {
    const { h, drawn } = holder({ t: "card", id: "c1" });
    const sent = h.now();
    const made = { t: "row", cardId: "c1", id: "a-new" } as const;
    expect(h.selectMade(sent, made)).toBe(true);
    expect(h.now()).toBe(made);
    expect(drawn).toEqual([made]);
    // from nothing selected, too
    const empty = holder();
    expect(empty.h.selectMade(null, made)).toBe(true);
    expect(empty.h.now()).toBe(made);
  });

  it("selectMade answers false and changes nothing when something else was selected meanwhile", () => {
    const { h, drawn } = holder({ t: "card", id: "c1" });
    const sent = h.now();
    h.select({ t: "card", id: "c2" });
    expect(h.selectMade(sent, { t: "row", cardId: "c1", id: "a-new" })).toBe(false);
    expect(h.now()).toEqual({ t: "card", id: "c2" });
    expect(drawn).toEqual([{ t: "card", id: "c2" }]);
  });

  it("selectMade answers false when the selection was cleared meanwhile (Escape, the empty canvas)", () => {
    const { h } = holder({ t: "card", id: "c1" });
    const sent = h.now();
    h.select(null);
    expect(h.selectMade(sent, { t: "rel", id: "r-new" })).toBe(false);
    expect(h.now()).toBeNull();
  });

  it("selectMade compares by what is named: an equal selection made again meanwhile counts as unchanged", () => {
    const { h } = holder({ t: "row", cardId: "c1", id: "a1" });
    const sent = h.now();
    h.select({ t: "row", cardId: "c1", id: "a1" });
    expect(h.selectMade(sent, { t: "req", id: "q-new" })).toBe(true);
  });

  it("selectMade answers true when what was made is what is selected already", () => {
    const sel = { t: "card", id: "c1" } as const;
    const { h } = holder(sel);
    expect(h.selectMade(sel, sel)).toBe(true);
  });

  it("deselectDeleted clears only a selection that points at a deleted row", () => {
    const { h } = holder({ t: "card", id: "c2" });
    h.deselectDeleted(["c1"]);
    expect(h.now()).toEqual({ t: "card", id: "c2" });
    h.deselectDeleted(["c2"]);
    expect(h.now()).toBeNull();
  });
});
