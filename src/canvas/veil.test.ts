import { describe, expect, it } from "vitest";
import { veilMargin } from "./FadeLayer";
import { MIN_ZOOM } from "./geometry";

describe("the veil's margin beyond the content (slice 4b-1, T1)", () => {
  it("is the pane's width and height at the minimum zoom, so the whole view lies inside the veil while any content is in view", () => {
    expect(MIN_ZOOM).toBe(0.1);
    expect(veilMargin(1536, 864)).toEqual([15360, 8640]);
    // the view is at most one pane wide at the minimum zoom: from any content point it cannot reach past the margin
    const [mx, my] = veilMargin(933, 700);
    expect(mx).toBeGreaterThanOrEqual(933 / MIN_ZOOM);
    expect(my).toBeGreaterThanOrEqual(700 / MIN_ZOOM);
  });

  it("is at least one pane of 1 px before React Flow has measured the pane", () => {
    expect(veilMargin(0, 0)).toEqual([10, 10]);
  });
});
