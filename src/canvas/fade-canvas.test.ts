import { describe, expect, it } from "vitest";
import type { InternalNode } from "@xyflow/react";
import type { Lit } from "@/domain/model/lit";
import { fadeKey, focusTarget } from "./fade";
import { isLitCard, isLitReqCard, litNodeIds, litSources, litTraces } from "./fade-canvas";
import type { TraceData } from "./trace-data";
import { roundRect } from "./FadeLayer";

const lit = (over: Partial<Lit> = {}): Lit => ({ entities: new Set(), tables: new Set(), rows: new Map(), mappings: new Set(), relationships: new Set(), ...over });
const card = (id: string, kind: "ent" | "src", targetId: string, over: { hidden?: boolean; frameId?: string | null } = {}) =>
  [id, { id, type: "card", hidden: over.hidden ?? false, data: { card: { id, kind, targetId, frameId: over.frameId ?? null } } } as unknown as InternalNode] as const;
const req = (id: string, requirementId: string) => [id, { id, type: "req", hidden: false, data: { card: { id, requirementId } } } as unknown as InternalNode] as const;
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

describe("requirement cards under Focus (slice 4b-2, PRD items 20–21)", () => {
  const lookup = new Map([req("r1", "Q1"), req("r2", "Q2"), card("c1", "ent", "E1"), card("c2", "src", "T1", { hidden: true, frameId: "F1" }), block("F1"), card("c3", "ent", "E2")]);
  const l = lit({ entities: new Set(["E1"]), tables: new Set(["T1"]), mappings: new Set(["M1"]), requirements: new Set(["Q1"]) });

  it("a lit requirement's card gets a hole; another's does not; no requirements, none", () => {
    expect(litNodeIds(lookup, l)).toEqual(new Set(["r1", "c1", "block:F1"]));
    expect(isLitReqCard(lookup.get("r2")!, l)).toBe(false);
    expect(isLitReqCard(lookup.get("r1")!, lit())).toBe(false);
  });

  it("a trace line is lit only with both ends lit: the card, a row's card, a hidden card's, a mapping", () => {
    const t = (id: string, reqCardId: string, target: TraceData["target"]): TraceData => ({ id, reqCardId, target });
    const traces = [
      t("a", "r1", { t: "card", cardId: "c1" }),
      t("b", "r1", { t: "row", cardId: "c3", rowId: "x" }),
      t("c", "r1", { t: "row", cardId: "c2", rowId: "y" }),
      t("d", "r1", { t: "map", mappingId: "M1" }),
      t("e", "r1", { t: "map", mappingId: "M2" }),
      t("f", "r2", { t: "card", cardId: "c1" }),
      t("g", "r1", { t: "card", cardId: "gone" }),
    ];
    expect(litTraces(traces, lookup, l).map((x) => x.id)).toEqual(["a", "c", "d"]);
    expect(litTraces(traces, lookup, lit({ entities: new Set(["E1"]) }))).toEqual([]);
  });
});

describe("relationships between source tables under Focus and in the Changes view (slice 10b, D-62)", () => {
  const lookup = new Map([card("t1", "src", "T1"), card("t2", "src", "T2"), card("t3", "src", "T3")]);
  const src = (id: string, fromCardId: string, toCardId: string) => ({ id, fromCardId, toCardId, offset: 0 });
  const lines = { sources: [src("s12", "t1", "t2"), src("s13", "t1", "t3"), src("s11", "t1", "t1"), src("sx", "t1", "gone")] };

  it("a line is lit only with both cards lit; a key to itself with its card", () => {
    expect(litSources(lines, lookup, lit({ tables: new Set(["T1", "T2"]) }))).toEqual(new Set(["s12", "s11"]));
    expect(litSources(lines, lookup, lit({ tables: new Set(["T2"]) }))).toEqual(new Set());
    expect(litSources({}, lookup, lit({ tables: new Set(["T1"]) }))).toEqual(new Set());
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
