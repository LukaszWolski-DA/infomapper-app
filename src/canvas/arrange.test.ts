import { describe, expect, it } from "vitest";
import { arrange } from "./arrange";

const cards = [
  { id: "a", rect: { x: 400, y: 120, w: 256, h: 203 } },
  { id: "b", rect: { x: 43, y: 40, w: 280, h: 150 } },
  { id: "c", rect: { x: 800, y: 600, w: 256, h: 100 } },
];
const all = (mode: Parameters<typeof arrange>[0]) => Object.fromEntries(arrange(mode, cards));

describe("arrange (slice 2a; prototype arrange, on the 8 px grid)", () => {
  it("aligns to the leftmost edge, rounded to the grid", () => {
    expect(all("left")).toEqual({ a: { x: 40, y: 120 }, b: { x: 40, y: 40 }, c: { x: 40, y: 600 } });
  });

  it("aligns to the topmost edge", () => {
    expect(all("top")).toEqual({ a: { x: 400, y: 40 }, b: { x: 40, y: 40 }, c: { x: 800, y: 40 } });
  });

  it("stacks in a column sorted by y, 32 px apart at least, every position on the grid", () => {
    // b (y 40, h 150) → next at 40 + 150 + 32 = 222 → 224; a (h 203) → 224 + 203 + 32 = 459 → 464
    expect(all("column")).toEqual({ b: { x: 40, y: 40 }, a: { x: 40, y: 224 }, c: { x: 40, y: 464 } });
  });

  it("lines up in a row sorted by x, 64 px apart", () => {
    // b (x 43 → 40, w 280) → 40 + 280 + 64 = 384; a (w 256) → 384 + 256 + 64 = 704
    expect(all("row")).toEqual({ b: { x: 40, y: 40 }, a: { x: 384, y: 40 }, c: { x: 704, y: 40 } });
  });

  it("stacks a frame as one unit and leaves 64 px after it (slice 2b)", () => {
    const units = [
      { id: "F", rect: { x: 40, y: 40, w: 600, h: 300 }, frame: true },
      { id: "a", rect: { x: 400, y: 900, w: 256, h: 200 } },
      { id: "b", rect: { x: 0, y: 1300, w: 256, h: 100 } },
    ];
    // F (h 300) → 40 + 300 + 64 = 404 → 408; a (h 200) → 408 + 200 + 32 = 640
    expect(Object.fromEntries(arrange("column", units))).toEqual({ F: { x: 40, y: 40 }, a: { x: 40, y: 408 }, b: { x: 40, y: 640 } });
    // a row keeps 64 px after a frame too
    expect(Object.fromEntries(arrange("row", units))).toEqual({ b: { x: 0, y: 1304 }, F: { x: 320, y: 1304 }, a: { x: 984, y: 1304 } });
  });

  it("leaves nothing to do for no cards", () => {
    expect(arrange("left", []).size).toBe(0);
  });
});
