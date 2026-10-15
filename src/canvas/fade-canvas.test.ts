import { describe, expect, it } from "vitest";
import type { InternalNode } from "@xyflow/react";
import type { Lit } from "@/domain/model/lit";
import { fadeKey } from "./fade";
import { isLitCard, litNodeIds } from "./fade-canvas";
import { liftRule } from "./FadeLayer";

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

  it("nothing lit, nothing lifted", () => {
    expect(litNodeIds(new Map([card("c1", "ent", "E1")]), lit())).toEqual(new Set());
    expect(liftRule([], [])).toBe("");
  });
});

describe("the lift rule (slice 4p, AD-24)", () => {
  it("lifts the lit nodes and the notes pinned to them above the veil, with !important over React Flow's inline z-index", () => {
    expect(liftRule(["c1", "block:F1"], ["n1"])).toBe(
      '.im-canvas .react-flow__node[data-id="c1"],\n.im-canvas .react-flow__node[data-id="block:F1"],\n.im-canvas .nt[data-note="n1"] { z-index: 2 !important }',
    );
  });

  it("quotes ids safely", () => {
    expect(liftRule(['a"b'], [])).toContain('[data-id="a\\"b"]');
  });
});

describe("the fading request (slice 4p, the capability for 4b)", () => {
  it("a lit set given directly is named by its key", () => {
    expect(fadeKey({ lit: lit(), key: "REQ-101+REQ-102" })).toBe("lit:REQ-101+REQ-102");
  });
});
