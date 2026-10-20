import { describe, expect, it } from "vitest";
import { requirementCardSpots } from "./requirement-placement";

const view = { x: 0, y: 0, w: 1000, h: 800 };

describe("requirementCardSpots (slice 4b-2, PRD item 15; prototype placeReqCards)", () => {
  it("goes 80 px right of the element, at its top, on the grid", () => {
    expect(requirementCardSpots({ x: 100, y: 43, w: 256, h: 200 }, view, [94], [], [])).toEqual([{ x: 440, y: 40 }]);
  });

  it("goes down in 16 px steps to the first place 20 px clear of what is there", () => {
    const occupied = [{ x: 440, y: 0, w: 256, h: 100 }];
    // 0 → the card would reach into the box (and its 20 px); the first free top is 120 (100 + 20)
    expect(requirementCardSpots({ x: 100, y: 0, w: 256, h: 50 }, view, [94], occupied, [])).toEqual([{ x: 440, y: 128 }]);
  });

  it("stacks several with 24 px between them, each clear of the others", () => {
    expect(requirementCardSpots({ x: 0, y: 0, w: 200, h: 50 }, view, [94, 111], [], [])).toEqual([
      { x: 280, y: 0 },
      { x: 280, y: 118 },
    ]);
  });

  it("without an element: the view's top centre", () => {
    expect(requirementCardSpots(null, view, [94], [], [])).toEqual([{ x: 384, y: 80 }]);
  });

  it("keeps frames clear like cards: an element in a frame gets its card below the frame (Łukasz after step 7)", () => {
    // the element at the frame's top left; the frame 600 high (its name strip included): down from 40 in 16 px steps,
    // the first top at least 620 (600 + 20) is 632
    const frame = { x: 0, y: 0, w: 800, h: 600 };
    expect(requirementCardSpots({ x: 40, y: 40, w: 256, h: 200 }, view, [94], [], [frame])).toEqual([{ x: 376, y: 632 }]);
    // without the frame, beside the element as before
    expect(requirementCardSpots({ x: 40, y: 40, w: 256, h: 200 }, view, [94], [], [])).toEqual([{ x: 376, y: 40 }]);
  });
});
