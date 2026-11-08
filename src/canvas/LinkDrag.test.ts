import { describe, expect, it } from "vitest";
import { linkLinePath, linkLineStart } from "./LinkDrag";

describe("a requirement's link drag line (slice 17)", () => {
  it("starts at the header's middle on the card's side nearer the pointer", () => {
    expect(linkLineStart({ x: 100, y: 40 }, { x: 600, y: 0 })).toEqual({ x: 330, y: 54 });
    expect(linkLineStart({ x: 100, y: 40 }, { x: 150, y: 400 })).toEqual({ x: 100, y: 54 });
  });

  it("curves out horizontally and into the pointer", () => {
    expect(linkLinePath({ from: { x: 0, y: 0 }, to: { x: 100, y: 50 } })).toBe("M0 0 C50 0 50 50 100 50");
  });
});
