// Slice 37 (S37-03): the check script's rules (scripts/lib/ui-check-rules.ts).
import { describe, expect, it } from "vitest";
import { isCutWithoutEllipsis, kindKey, kinds, overlaps, pastTheEdge, smallTargets, spilling, crowdedTexts, type Box, type Control } from "../scripts/lib/ui-check-rules";

let next = 0;
const look = { height: 28, fontSize: 12, radius: 8, borderWidth: 1, borderColor: "rgb(226, 230, 235)" };
function control(rect: Box, o: Partial<Control> = {}): Control {
  return { id: ++next, kind: "button", tag: "button", testId: null, text: "", rect, visible: rect, inside: [], inline: false, exempt: null, look, spill: 0, textBox: null, ...o };
}

describe("overlaps", () => {
  it("reports two controls covering each other by more than 2 px in both directions", () => {
    const a = control({ x: 0, y: 0, w: 60, h: 24 }), b = control({ x: 50, y: 0, w: 60, h: 24 });
    expect(overlaps([a, b]).map((o) => [o.a.id, o.b.id, o.w, o.h])).toEqual([[a.id, b.id, 10, 24]]);
  });
  it("ignores 2 px or less, a control inside another, one not shown and an exempt one", () => {
    const a = control({ x: 0, y: 0, w: 60, h: 24 });
    const touching = control({ x: 58, y: 0, w: 60, h: 24 });
    const child = control({ x: 10, y: 2, w: 20, h: 20 }, { inside: [a.id] });
    const hidden = control({ x: 0, y: 0, w: 60, h: 24 }, { visible: null });
    const card = control({ x: 0, y: 0, w: 60, h: 24 }, { exempt: "canvas card" });
    expect(overlaps([a, touching, child, hidden, card])).toEqual([]);
  });
  it("compares the shown parts: a control scrolled out of its list does not overlap", () => {
    const a = control({ x: 0, y: 0, w: 60, h: 24 });
    const scrolled = control({ x: 0, y: 0, w: 60, h: 24 }, { visible: { x: 0, y: 30, w: 60, h: 0.5 } });
    expect(overlaps([a, scrolled])).toEqual([]);
  });
});

describe("spilling", () => {
  it("reports a control whose text runs more than 2 px out of its box", () => {
    const tab = control({ x: 0, y: 0, w: 53, h: 24 }, { spill: 25 });
    const fits = control({ x: 60, y: 0, w: 53, h: 24 }, { spill: 1 });
    expect(spilling([tab, fits]).map((c) => c.id)).toEqual([tab.id]);
  });
});

describe("crowded texts", () => {
  it("reports the words of two tabs side by side less than 8 px apart, not those 8 px or more apart or on another line", () => {
    const sources = control({ x: 60, y: 0, w: 53, h: 30 }, { kind: "tab", textBox: { x: 62, y: 8, w: 49, h: 15 } });
    const requirements = control({ x: 115, y: 0, w: 80, h: 30 }, { kind: "tab", textBox: { x: 113, y: 8, w: 78, h: 15 } });
    const cube = control({ x: 197, y: 0, w: 40, h: 30 }, { kind: "tab", textBox: { x: 205, y: 8, w: 30, h: 15 } });
    const below = control({ x: 113, y: 40, w: 40, h: 30 }, { kind: "tab", textBox: { x: 113, y: 48, w: 30, h: 15 } });
    expect(crowdedTexts([sources, requirements, cube, below]).map((c) => [c.a.id, c.b.id, c.gap])).toEqual([[sources.id, requirements.id, 2]]);
  });
});

describe("past the edge", () => {
  it("reports a shown part past the left or right edge, not one inside", () => {
    const inside = control({ x: 0, y: 0, w: 100, h: 24 });
    const right = control({ x: 350, y: 0, w: 60, h: 24 });
    const left = control({ x: -10, y: 0, w: 60, h: 24 });
    expect(pastTheEdge([inside, right, left], 390).map((c) => c.id)).toEqual([right.id, left.id]);
  });
});

describe("small targets", () => {
  it("reports a button under 24 px, with WCAG's spacing exception when its circle touches nothing", () => {
    const lone = control({ x: 0, y: 0, w: 17, h: 17 });
    const crowdedA = control({ x: 100, y: 0, w: 18, h: 18 });
    const crowdedB = control({ x: 120, y: 0, w: 18, h: 18 });
    const big = control({ x: 200, y: 0, w: 28, h: 28 });
    expect(smallTargets([lone, crowdedA, crowdedB, big]).map((s) => [s.control.id, s.spaced])).toEqual([
      [lone.id, true],
      [crowdedA.id, false],
      [crowdedB.id, false],
    ]);
  });
  it("leaves out fields, drop-downs, links inside a sentence and exempt controls", () => {
    const field = control({ x: 0, y: 0, w: 100, h: 20 }, { kind: "field" });
    const inline = control({ x: 0, y: 40, w: 30, h: 16 }, { kind: "link", inline: true });
    const card = control({ x: 0, y: 80, w: 10, h: 10 }, { exempt: "canvas card" });
    expect(smallTargets([field, inline, card])).toEqual([]);
  });
});

describe("cut text", () => {
  it("is clipped, wider than its box and without an ellipsis", () => {
    expect(isCutWithoutEllipsis({ overflowX: "hidden", textOverflow: "clip", scrollWidth: 120, clientWidth: 80 })).toBe(true);
    expect(isCutWithoutEllipsis({ overflowX: "hidden", textOverflow: "ellipsis", scrollWidth: 120, clientWidth: 80 })).toBe(false);
    expect(isCutWithoutEllipsis({ overflowX: "visible", textOverflow: "clip", scrollWidth: 120, clientWidth: 80 })).toBe(false);
    expect(isCutWithoutEllipsis({ overflowX: "clip", textOverflow: "clip", scrollWidth: 81, clientWidth: 80 })).toBe(false);
  });
});

describe("kinds", () => {
  it("groups by what a control is, its height, font size, radius and edge", () => {
    const a = control({ x: 0, y: 0, w: 60, h: 28 });
    const b = control({ x: 0, y: 40, w: 90, h: 28 });
    const c = control({ x: 0, y: 80, w: 60, h: 32 }, { look: { ...look, height: 32 } });
    const f = control({ x: 0, y: 120, w: 60, h: 32 }, { kind: "field", look: { ...look, borderWidth: 0 } });
    expect(kindKey(a)).toBe("button · h 28 · font 12 · radius 8 · edge 1px rgb(226, 230, 235)");
    expect(kindKey(f)).toBe("field · h 28 · font 12 · radius 8 · edge none");
    expect(kinds([a, b, c, f]).map((k) => [k.kind, k.count])).toEqual([
      ["button", 2],
      ["button", 1],
      ["field", 1],
    ]);
  });
});
