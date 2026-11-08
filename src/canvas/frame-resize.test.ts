import { describe, expect, it } from "vitest";
import { resizedRect, sameRect, shiftedBack } from "./frame-resize";

const start = { x: 400, y: 200, w: 800, h: 600 };

describe("a frame resized from any edge or corner (slice 17)", () => {
  it("the bottom-right corner keeps the top-left, as before", () => {
    expect(resizedRect(start, "se", 101, -37)).toEqual({ x: 400, y: 200, w: 904, h: 560 });
  });

  it("the left edge moves x and narrows it; the right edge stays", () => {
    expect(resizedRect(start, "w", 203, 50)).toEqual({ x: 600, y: 200, w: 600, h: 600 });
    expect(resizedRect(start, "w", -100, 0)).toEqual({ x: 304, y: 200, w: 896, h: 600 });
  });

  it("the top-left corner moves both", () => {
    expect(resizedRect(start, "nw", 80, 40)).toEqual({ x: 480, y: 240, w: 720, h: 560 });
  });

  it("the edges alone change one dimension", () => {
    expect(resizedRect(start, "n", 99, 64)).toEqual({ x: 400, y: 264, w: 800, h: 536 });
    expect(resizedRect(start, "e", 64, 99)).toEqual({ x: 400, y: 200, w: 864, h: 600 });
  });

  it("keeps the minimum size, the far edges fixed", () => {
    expect(resizedRect(start, "nw", 5000, 5000)).toEqual({ x: 1040, y: 704, w: 160, h: 96 });
    expect(resizedRect(start, "se", -5000, -5000)).toEqual({ x: 400, y: 200, w: 160, h: 96 });
  });

  it("compares rectangles and shifts pinned notes back", () => {
    expect(sameRect(start, { ...start })).toBe(true);
    expect(sameRect(start, { ...start, x: 8 })).toBe(false);
    expect(shiftedBack(new Map([["n", { x: 40, y: 10 }]]), 80, -16)).toEqual(new Map([["n", { x: -40, y: 26 }]]));
  });
});
