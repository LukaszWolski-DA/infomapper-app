import { describe, expect, it } from "vitest";
import { afterLasso, allKeys, cardKey, fromKeys, lassoHits, rectBetween, selectedCardIds, selectedKeys, selectionBounds, toggleCard, toggleItem, unitsOf, type ItemBox } from "./selection";

const cards: ItemBox[] = [
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

describe("frames in the selection (slice 2b, D-16, D-17)", () => {
  // frame F1 holds c1 and c2; frame F2 holds c4; c3 is in no frame
  const items: ItemBox[] = [
    { id: "F1", key: "frame:F1", rect: { x: -40, y: -40, w: 760, h: 300 } },
    { id: "F2", key: "frame:F2", rect: { x: 1000, y: 0, w: 400, h: 300 } },
    { id: "c1", key: "entity:customer", rect: { x: 0, y: 0, w: 256, h: 200 }, frameId: "F1" },
    { id: "c2", key: "entity:order", rect: { x: 400, y: 0, w: 256, h: 120 }, frameId: "F1" },
    { id: "c3", key: "source:customers", rect: { x: 0, y: 400, w: 280, h: 300 }, frameId: null },
    { id: "c4", key: "entity:line", rect: { x: 1040, y: 40, w: 256, h: 120 }, frameId: "F2" },
  ];

  it("one frame key is the single frame selection, and reads back", () => {
    expect(fromKeys(["frame:F1"], items)).toEqual({ t: "frame", id: "F1" });
    expect(selectedKeys({ t: "frame", id: "F2" }, items)).toEqual(["frame:F2"]);
    expect(fromKeys(["frame:gone", "entity:order"], items)).toEqual({ t: "card", id: "c2" });
  });

  it("Shift+click adds a frame to a card, or a card to a frame, and takes it out again", () => {
    const two = toggleItem({ t: "card", id: "c3" }, "frame:F1", items);
    expect(two).toEqual({ t: "multi", keys: ["source:customers", "frame:F1"] });
    expect(toggleItem(two, "frame:F1", items)).toEqual({ t: "card", id: "c3" });
    expect(toggleCard({ t: "frame", id: "F2" }, "c3", items)).toEqual({ t: "multi", keys: ["frame:F2", "source:customers"] });
  });

  it("a lasso around a whole frame catches the frame, not its cards; a frame partly inside is not caught", () => {
    expect(lassoHits(items, { x: -50, y: -50, w: 800, h: 800 })).toEqual(["frame:F1", "source:customers"]);
    // F1 not whole: its cards fully inside are caught on their own
    expect(lassoHits(items, { x: -10, y: -10, w: 700, h: 300 })).toEqual(["entity:customer", "entity:order"]);
  });

  it("a lasso does not catch a card hidden in a collapsed frame (slice 2c)", () => {
    const collapsed = items.map((i) => (i.id === "F2" ? { ...i, rect: { x: 1000, y: 0, w: 280, h: 118 } } : i.id === "c4" ? { ...i, hidden: true } : i));
    // around c4's place but not the whole block: neither the hidden card nor the frame
    expect(lassoHits(collapsed, { x: 1030, y: 30, w: 300, h: 200 })).toEqual([]);
    // around the whole block: the frame
    expect(lassoHits(collapsed, { x: 990, y: -10, w: 300, h: 200 })).toEqual(["frame:F2"]);
  });

  it("Ctrl+A selects every frame and the cards in no frame", () => {
    expect(allKeys(items)).toEqual(["frame:F1", "frame:F2", "source:customers"]);
  });

  it("units: a selected frame carries its cards, moved once even when also selected; other cards move alone", () => {
    expect(unitsOf(["frame:F1", "entity:order", "source:customers", "entity:line"], items)).toEqual({
      frames: ["F1"],
      cards: ["c3", "c4"],
      members: ["c1", "c2"],
    });
  });

  it("the selected cards themselves, for fit widths, remove and put in a new frame", () => {
    expect(selectedCardIds(["frame:F1", "entity:order", "source:customers"], items)).toEqual(["c2", "c3"]);
  });
});
