import { describe, expect, it } from "vitest";
import { figureBoxOf } from "./figure";
import { figureBox, figureLayout, figureSummary, MM_PER_PX, outlineLabel, outlinePages, PART_OVERLAP, ROW_PT } from "./page";

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

describe("the page outline on the canvas (slice 27, step 4, Q6)", () => {
  it("cuts the figure's box into pages of the figure's room at the scale of the smallest names, row by row", () => {
    const spec = { paper: "A4", orientation: "landscape", pt: 7 } as const;
    const room = figureBox({ paper: "A4", orientation: "landscape" }, true);
    expect(room.rot).toBe(false);
    const w = room.w / (MM_PER_PX * (7 / ROW_PT)), h = room.h / (MM_PER_PX * (7 / ROW_PT));
    const one = outlinePages({ x: 10, y: 20, w: w - 1, h: h - 1 }, spec);
    expect(one.pages).toEqual([{ n: 1, x: 10, y: 20, w, h }]);
    const four = outlinePages({ x: 0, y: 0, w: w + 10, h: h + 10 }, spec);
    expect([four.cols, four.rows]).toEqual([2, 2]);
    expect(four.pages.map((p) => [p.n, p.x, p.y])).toEqual([
      [1, 0, 0],
      [2, w, 0],
      [3, 0, h],
      [4, w, h],
    ]);
    // a larger size of the names: smaller pages on the canvas
    expect(outlinePages({ x: 0, y: 0, w: w - 1, h: h - 1 }, { ...spec, pt: 8 }).pages.length).toBeGreaterThan(1);
  });

  it("labels page 1 with the paper, orientation, size and whether the canvas fits; the others by number", () => {
    const spec = { paper: "A3", orientation: "portrait", pt: 6 } as const;
    expect(outlineLabel(spec, 1, 1)).toBe("A3 portrait at 6 pt · fits on one page");
    expect(outlineLabel(spec, 1, 4)).toBe("A3 portrait at 6 pt · needs 4 pages: move cards into page 1 to keep it whole");
    expect(outlineLabel(spec, 3, 4)).toBe("page 3");
  });

  it("takes a figure's box: what is drawn with a 20 px margin, none without anything drawn", () => {
    expect(figureBoxOf([{ x: 100, y: 50, w: 256, h: 120 }, { x: 400, y: 300, w: 230, h: 94 }])).toEqual({ x: 80, y: 30, w: 570, h: 384 });
    expect(figureBoxOf([])).toBeNull();
  });
});
