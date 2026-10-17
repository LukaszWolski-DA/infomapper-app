import { describe, expect, it } from "vitest";
import type { InternalNode } from "@xyflow/react";
import type { Lit } from "@/domain/model/lit";
import { fadeKey, focusTarget } from "./fade";
import { isLitCard, litNodeIds } from "./fade-canvas";
import { roundRect } from "./FadeLayer";

const lit = (over: Partial<Lit> = {}): Lit => ({ entities: new Set(), tables: new Set(), rows: new Map(), mappings: new Set(), relationships: new Set(), ...over });
const card = (id: string, kind: "ent" | "src", targetId: string, over: { hidden?: boolean; frameId?: string | null } = {}) =>
  [id, { id, type: "card", hidden: over.hidden ?? false, data: { card: { id, kind, targetId, frameId: over.frameId ?? null } } } as unknown as InternalNode] as const;
const block = (frameId: string) => [`block:${frameId}`, { id: `block:${frameId}`, type: "block", hidden: false, data: { frame: { id: frameId } } } as unknown as InternalNode] as const;

describe("what fading lights on the canvas (slice 4p)", () => {
  it("lights the cards of lit entities and tables, by their kind", () => {
    const lookup = new Map([card("c1", "ent", "E1"), card("c2", "src", "T1"), card("c3", "ent", "T1"), card("c4", "src", "E1")]);
    const l = lit({ entities: new Set(["E1"]), tables: new Set(["T1"]) });
    expect(litNodeIds(lookup, l)).toEqual(new Set(["c1", "c2"]));
    expect(isLitCard(lookup.get("c3")!, l)).toBe(false); // an entity card whose id happens to be a lit table's
  });

  it("a lit card hidden in a collapsed frame lights the frame's block instead (prototype: a frame is lit when a member is)", () => {
    const lookup = new Map([card("c1", "ent", "E1", { hidden: true, frameId: "F1" }), card("c2", "ent", "E2", { hidden: true, frameId: "F2" }), block("F1"), block("F2")]);
    expect(litNodeIds(lookup, lit({ entities: new Set(["E1"]) }))).toEqual(new Set(["block:F1"]));
  });

  it("nothing lit, no hole", () => {
    expect(litNodeIds(new Map([card("c1", "ent", "E1")]), lit())).toEqual(new Set());
  });
});

describe("the veil's holes (slice 4b-1, F4)", () => {
  it("a hole is a rounded rectangle, its corners no larger than half a side", () => {
    expect(roundRect({ x: 0, y: 0, w: 100, h: 50 }, 10)).toBe("M10,0H90A10,10 0 0 1 100,10V40A10,10 0 0 1 90,50H10A10,10 0 0 1 0,40V10A10,10 0 0 1 10,0Z");
    expect(roundRect({ x: 0, y: 0, w: 8, h: 50 }, 10)).toContain("A4,4");
  });
});

describe("the fading request (slice 4p, the capability for 4b)", () => {
  it("a lit set given directly is named by its key", () => {
    expect(fadeKey({ lit: lit(), key: "REQ-101+REQ-102" })).toBe("lit:REQ-101+REQ-102");
  });

  it("Focus: an entity keeps slice 4p's key in both forms; a requirement is named as such (slice 4b-1)", () => {
    expect(fadeKey({ focus: "E1" })).toBe("focus:E1");
    expect(fadeKey({ focus: { t: "entity", id: "E1" } })).toBe("focus:E1");
    expect(fadeKey({ focus: { t: "requirement", id: "R1" } })).toBe("focus:requirement:R1");
    expect(focusTarget("E1")).toEqual({ t: "entity", id: "E1" });
    expect(fadeKey(null)).toBe("");
  });
});
