import { describe, expect, it } from "vitest";
import { afterLasso, cardKey, fromKeys, lassoHits, rectBetween, selectedKeys, selectionBounds, toggleCard, type CardBox } from "./selection";

const cards: CardBox[] = [
  { id: "c1", key: "entity:customer", rect: { x: 0, y: 0, w: 256, h: 200 } },
  { id: "c2", key: "entity:order", rect: { x: 400, y: 0, w: 256, h: 120 } },
  { id: "c3", key: "source:customers", rect: { x: 0, y: 400, w: 280, h: 300 } },
];

describe("selection keys (slice 2a)", () => {
  it("names an entity card and a source table card by their element", () => {
    expect(cardKey({ kind: "ent", targetId: "e1" })).toBe("entity:e1");
    expect(cardKey({ kind: "src", targetId: "t1" })).toBe("source:t1");
  });

  it("turns keys into no selection, one card, or several, keeping only cards on this canvas", () => {
    expect(fromKeys([], cards)).toBeNull();
    expect(fromKeys(["entity:customer", "entity:elsewhere"], cards)).toEqual({ t: "card", id: "c1" });
    expect(fromKeys(["entity:customer", "source:customers", "entity:customer"], cards)).toEqual({ t: "multi", keys: ["entity:customer", "source:customers"] });
  });

  it("reads the keys back from a selection; a row or a line holds no card", () => {
    expect(selectedKeys({ t: "card", id: "c2" }, cards)).toEqual(["entity:order"]);
    expect(selectedKeys({ t: "multi", keys: ["entity:order", "source:customers"] }, cards)).toEqual(["entity:order", "source:customers"]);
    expect(selectedKeys({ t: "row", cardId: "c1", id: "a1" }, cards)).toEqual([]);
    expect(selectedKeys(null, cards)).toEqual([]);
  });
});

describe("Shift+click", () => {
  it("adds a card to the selection and takes it out again", () => {
    const two = toggleCard({ t: "card", id: "c1" }, "c2", cards);
    expect(two).toEqual({ t: "multi", keys: ["entity:customer", "entity:order"] });
    const three = toggleCard(two, "c3", cards);
    expect(three).toEqual({ t: "multi", keys: ["entity:customer", "entity:order", "source:customers"] });
    expect(toggleCard(three, "c1", cards)).toEqual({ t: "multi", keys: ["entity:order", "source:customers"] });
    expect(toggleCard(two, "c2", cards)).toEqual({ t: "card", id: "c1" });
    expect(toggleCard({ t: "card", id: "c1" }, "c1", cards)).toBeNull();
  });

  it("starts from nothing when a row or a line was selected", () => {
    expect(toggleCard({ t: "map", id: "m1" }, "c2", cards)).toEqual({ t: "card", id: "c2" });
  });
});

describe("lasso (D-15, D-16)", () => {
  it("catches only cards fully inside, whichever way it was drawn", () => {
    const lasso = rectBetween({ x: 700, y: 250 }, { x: -10, y: -10 });
    expect(lasso).toEqual({ x: -10, y: -10, w: 710, h: 260 });
    expect(lassoHits(cards, lasso)).toEqual(["entity:customer", "entity:order"]);
    // c3 starts at y 400: partly inside is not enough
    expect(lassoHits(cards, { x: -10, y: -10, w: 710, h: 500 })).toEqual(["entity:customer", "entity:order"]);
    // touching the edges counts as inside
    expect(lassoHits(cards, { x: 0, y: 0, w: 256, h: 200 })).toEqual(["entity:customer"]);
  });

  it("replaces the selection, or adds to it when Shift was held at the start", () => {
    expect(afterLasso({ t: "card", id: "c3" }, ["entity:customer", "entity:order"], false, cards)).toEqual({ t: "multi", keys: ["entity:customer", "entity:order"] });
    expect(afterLasso({ t: "card", id: "c3" }, ["entity:customer"], true, cards)).toEqual({ t: "multi", keys: ["source:customers", "entity:customer"] });
    expect(afterLasso({ t: "card", id: "c3" }, [], false, cards)).toBeNull();
  });
});

describe("the selection box", () => {
  it("surrounds the selected cards 12 px out", () => {
    expect(selectionBounds([cards[0]!.rect, cards[1]!.rect])).toEqual({ x: -12, y: -12, w: 680, h: 224 });
    expect(selectionBounds([])).toBeNull();
  });
});
