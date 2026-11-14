import { describe, expect, it } from "vitest";
import { figureBox, figureLayout, figureSummary, MM_PER_PX, PART_OVERLAP } from "./page";

// Slice 27 (Q4, D1, D4): a figure's box on the page with the app's margins, its sizes, orientations and parts.

const A4 = { paper: "A4", orientation: "portrait" } as const;
const box = (w: number, h: number) => ({ x: 0, y: 0, w, h });

describe("a figure's box on the page", () => {
  it("is the page less the margins (18 mm, 20 mm at the bottom) and the caption's room; turned, the other way", () => {
    expect(figureBox(A4, false)).toEqual({ rot: false, w: 174, h: 297 - 38 - 48 });
    expect(figureBox(A4, true)).toEqual({ rot: true, w: 297 - 38 - 36, h: 174 });
    expect(figureBox({ paper: "A3", orientation: "landscape" }, true)).toEqual({ rot: false, w: 420 - 36, h: 297 - 38 - 48 });
  });
});

describe("a figure's layout", () => {
  it("draws a small figure whole at 100 %, never larger (D4)", () => {
    const l = figureLayout(box(300, 200), [box(300, 200)], A4, "auto", "doc", 6);
    expect(l.parts).toHaveLength(1);
    expect(l.parts[0]!.wmm).toBeCloseTo(300 * MM_PER_PX);
    expect(l.pt).toBe(9.4);
    expect(l.rot).toBe(false);
  });

  it("turns an 'as large as fits' figure when upright names are too small and turned is clearly larger; never 'Whole, upright'", () => {
    const wide = box(1600, 700);
    expect(figureLayout(wide, [wide], A4, "auto", "doc", 6).rot).toBe(true);
    expect(figureLayout(wide, [wide], A4, "page", "doc", 6).rot).toBe(false);
    // names large enough upright: not turned
    expect(figureLayout(box(700, 300), [box(700, 300)], A4, "auto", "doc", 5).rot).toBe(false);
    expect(figureLayout(box(700, 300), [box(700, 300)], A4, "auto", "landscape", 5).rot).toBe(true);
  });

  it("never cuts a whole size; cuts 'in parts' sizes into equal parts that overlap by 16 px, leaving out empty ones", () => {
    const big = box(4000, 3000);
    expect(figureLayout(big, [big], A4, "auto", "doc", 6).parts).toHaveLength(1);
    expect(figureLayout(big, [big], A4, "page", "doc", 6).parts).toHaveLength(1);
    const full = figureLayout(big, [big], A4, "100", "doc", 6);
    const cols = Math.ceil((4000 * MM_PER_PX) / 174 - 0.001), rows = Math.ceil((3000 * MM_PER_PX) / (297 - 38 - 48) - 0.001);
    expect(full.parts).toHaveLength(cols * rows);
    expect(full.parts[1]!.x).toBeCloseTo(4000 / cols - PART_OVERLAP);
    expect(full.pt).toBe(9.4);
    // drawn only at the top left: the other parts are left out
    const corner = figureLayout(big, [{ x: 20, y: 20, w: 200, h: 100 }], A4, "100", "doc", 6);
    expect(corner.parts).toHaveLength(1);
    const tall = box(1000, 6000);
    const width = figureLayout(tall, [tall], A4, "width", "doc", 6);
    expect(width.parts.every((p) => p.wmm <= 174 + 1e-6)).toBe(true);
    expect(width.parts.length).toBeGreaterThan(1);
  });

  it("says what it did in the editor's line (the prototype's sumFig)", () => {
    const small = figureLayout(box(300, 200), [box(300, 200)], A4, "auto", "doc", 6);
    expect(figureSummary([small], 6)).toBe("1 figure · names 9.4 pt · upright");
    const big = box(2000, 9000);
    const parts = figureLayout(big, [big], A4, "width", "doc", 6);
    expect(figureSummary([parts], 6)).toMatch(/^1 figure in \d+ parts · names [\d.]+ pt \(whole on one page: [\d.]+ pt\) · upright · smaller than 6 pt: try one figure per frame, A3 paper, or the page outline on the canvas$/);
  });
});
