import { describe, expect, it } from "vitest";
import type { CardData } from "./card-data";
import { fadeKey } from "./fade";
import { focusTargetOf } from "./Focus";

const card = (id: string, kind: "ent" | "src", targetId: string, frameId: string | null = null) => ({ id, kind, targetId, frameId }) as Pick<CardData, "id" | "kind" | "targetId" | "frameId">;
const cards = [card("c1", "ent", "e1", "f1"), card("c2", "src", "t1", "f1"), card("c3", "ent", "e2"), card("c4", "ent", "e3", "f2")];

describe("what Focus is on for a selection (slice 4b-1, PRD item 21)", () => {
  it("a card is its entity or table; a row its attribute or column", () => {
    expect(focusTargetOf({ t: "card", id: "c1" }, cards)).toEqual({ t: "entity", id: "e1" });
    expect(focusTargetOf({ t: "card", id: "c2" }, cards)).toEqual({ t: "table", id: "t1" });
    expect(focusTargetOf({ t: "row", cardId: "c1", id: "a1" }, cards)).toEqual({ t: "attribute", id: "a1" });
    expect(focusTargetOf({ t: "row", cardId: "c2", id: "col1" }, cards)).toEqual({ t: "column", id: "col1" });
  });

  it("a mapping, a relationship and a requirement are themselves", () => {
    expect(focusTargetOf({ t: "map", id: "m1" }, cards)).toEqual({ t: "mapping", id: "m1" });
    expect(focusTargetOf({ t: "rel", id: "r1" }, cards)).toEqual({ t: "relationship", id: "r1" });
    expect(focusTargetOf({ t: "req", id: "q1" }, cards)).toEqual({ t: "requirement", id: "q1" });
  });

  it("a frame is its cards; several items are their cards, frames standing for theirs and notes adding nothing", () => {
    expect(focusTargetOf({ t: "frame", id: "f1" }, cards)).toEqual({ t: "several", entities: ["e1"], tables: ["t1"] });
    expect(focusTargetOf({ t: "frame", id: "empty" }, cards)).toBeNull();
    expect(focusTargetOf({ t: "multi", keys: ["entity:e2", "frame:f2", "note:n1", "source:t1"] }, cards)).toEqual({ t: "several", entities: ["e2", "e3"], tables: ["t1"] });
  });

  it("nothing for no selection, a note, a label, a bundle or an unknown card", () => {
    for (const sel of [null, { t: "note", id: "n1" }, { t: "label", id: "l1" }, { t: "bundle", id: "b" }, { t: "card", id: "gone" }] as const) expect(focusTargetOf(sel, cards)).toBeNull();
  });

  it("the request's key names the target: the entity's as in slice 4p, the others by kind", () => {
    expect(fadeKey({ focus: { t: "entity", id: "e1" } })).toBe("focus:e1");
    expect(fadeKey({ focus: { t: "column", id: "col1" } })).toBe("focus:column:col1");
    expect(fadeKey({ focus: { t: "several", entities: ["e1", "e2"], tables: ["t1"] } })).toBe("focus:several:e1,e2|t1");
  });
});
