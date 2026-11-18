import { describe, expect, it } from "vitest";
import { intersect, minus, visiblePart } from "../e2e/canvas-click";

// The geometry of e2e's `clickVisible` (fix/e2e-visible-clicks): the part of an element a click may aim at.

const column = { x: 264, y: 100, width: 676, height: 500 };

describe("clickVisible's visible part", () => {
  it("is the whole element when it lies inside the column", () => {
    const el = { x: 300, y: 200, width: 120, height: 20 };
    expect(visiblePart(el, column, [])).toEqual(el);
  });

  it("is the part inside the column when the element runs under a side panel", () => {
    expect(visiblePart({ x: 900, y: 200, width: 120, height: 20 }, column, [])).toEqual({ x: 900, y: 200, width: 40, height: 20 });
    expect(visiblePart({ x: 200, y: 200, width: 120, height: 20 }, column, [])).toEqual({ x: 264, y: 200, width: 56, height: 20 });
  });

  it("leaves out the Overview and keeps the largest remaining part", () => {
    const overview = { x: 712, y: 400, width: 216, height: 188 };
    // a row whose right half lies under the Overview: its left part is what remains
    expect(visiblePart({ x: 600, y: 450, width: 200, height: 20 }, column, [overview])).toEqual({ x: 600, y: 450, width: 112, height: 20 });
    // a card whose lower part is under it: the band above it is the largest
    expect(visiblePart({ x: 720, y: 300, width: 100, height: 200 }, column, [overview])).toEqual({ x: 720, y: 300, width: 100, height: 100 });
  });

  it("is none when the element lies outside the column or shows less than 4 × 4 px", () => {
    expect(visiblePart({ x: -500, y: 200, width: 120, height: 20 }, column, [])).toBeNull();
    expect(visiblePart({ x: 937, y: 200, width: 120, height: 20 }, column, [])).toBeNull(); // 3 px wide
    expect(visiblePart({ x: 800, y: 450, width: 100, height: 20 }, column, [{ x: 712, y: 400, width: 216, height: 188 }])).toBeNull();
  });

  it("takes an element thinner than 4 px when it is wholly in view, and only then (a card's width handle, S2A-05)", () => {
    const handle = { x: 611, y: 146, width: 3.99, height: 123 };
    expect(visiblePart(handle, column, [])).toEqual(handle);
    expect(visiblePart({ ...handle, y: 580 }, column, [])).toBeNull(); // its lower part below the canvas
    expect(visiblePart({ ...handle, x: 714 }, column, [{ x: 712, y: 200, width: 216, height: 20 }])).toBeNull(); // partly under the Overview
  });

  it("intersects and subtracts boxes", () => {
    expect(intersect({ x: 0, y: 0, width: 10, height: 10 }, { x: 10, y: 0, width: 5, height: 5 })).toBeNull();
    expect(minus({ x: 0, y: 0, width: 10, height: 10 }, { x: 20, y: 20, width: 5, height: 5 })).toEqual([{ x: 0, y: 0, width: 10, height: 10 }]);
    expect(minus({ x: 0, y: 0, width: 10, height: 10 }, { x: 0, y: 0, width: 10, height: 10 })).toEqual([]);
  });
});
