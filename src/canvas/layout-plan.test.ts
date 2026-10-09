import { describe, expect, it } from "vitest";
import { planLayout, planReframe, type PlanCard } from "./layout-plan";

const frame = (id: string, x: number, y: number, width: number, height: number) => ({ id, x, y, width, height });
const card = (id: string, x: number, y: number, over: Partial<PlanCard> = {}): PlanCard => ({ id, x, y, width: null, height: 200, frameId: null, ...over });

describe("planLayout (the browser's copy of moveOnCanvas)", () => {
  it("moves a frame with its cards; they keep their frame", () => {
    const p = planLayout([frame("f", 0, 0, 800, 600)], [card("a", 100, 100, { frameId: "f" }), card("b", 2000, 0)], { frames: [{ id: "f", x: 80, y: 40 }] });
    expect(p.frames[0]).toMatchObject({ x: 80, y: 40 });
    expect(p.cards.find((c) => c.id === "a")).toMatchObject({ x: 180, y: 140, frameId: "f" });
    expect(p.cards.find((c) => c.id === "b")).toMatchObject({ x: 2000, y: 0 });
    expect([...p.carried]).toEqual(["a"]);
    expect([...p.changed]).toEqual([]);
  });

  it("puts a dropped card in the frame under its header and grows the frame", () => {
    const p = planLayout([frame("f", 0, 0, 400, 300)], [card("a", 2000, 0)], { cards: [{ id: "a", x: 100, y: 200 }] });
    expect(p.cards[0]).toMatchObject({ x: 100, y: 200, frameId: "f" });
    expect(p.frames[0]).toMatchObject({ height: 200 + 200 + 24 });
  });

  it("decides the frame again after a width change, and takes a card out when it lands outside", () => {
    const wider = planLayout([frame("f", 0, 0, 400, 400)], [card("a", 100, 100, { frameId: "f" })], { cards: [{ id: "a", width: 400 }] });
    expect(wider.cards[0]).toMatchObject({ width: 400, frameId: "f" });
    expect(wider.frames[0]!.width).toBe(524);
    const out = planLayout([frame("f", 0, 0, 400, 400)], [card("a", 100, 100, { frameId: "f" })], { cards: [{ id: "a", x: 3000, y: 0 }] });
    expect(out.cards[0]!.frameId).toBeNull();
  });

  it("a card in a moved frame moves with it, whatever position it was given", () => {
    const p = planLayout([frame("f", 0, 0, 800, 600)], [card("a", 100, 100, { frameId: "f" })], { frames: [{ id: "f", x: 8, y: 0 }], cards: [{ id: "a", x: 999, y: 999 }] });
    expect(p.cards[0]).toMatchObject({ x: 108, y: 100 });
  });
});

describe("planReframe", () => {
  it("releases cards left outside and takes free cards inside, never cards of another frame", () => {
    const changes = planReframe(
      [frame("f", 0, 0, 1000, 1000), frame("g", 0, 0, 3000, 3000)],
      [card("in", 600, 100, { frameId: "f" }), card("free", 100, 1200), card("ofG", 200, 1200, { frameId: "g" })],
      frame("f", 0, 0, 500, 1500),
    );
    expect(changes).toEqual([
      { cardId: "in", frameId: "g" },
      { cardId: "free", frameId: "f" },
    ]);
  });
});
