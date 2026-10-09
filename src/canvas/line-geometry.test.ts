import { describe, expect, it } from "vitest";
import { curve } from "./geometry";
import type { CanvasLines, MapLineData, RelLineData } from "./line-data";
import { blockEnd, bundleLines, bundleLook, bundleWidth } from "./line-geometry";

// Cards: crm1, crm2 (tables of a source frame S), web (a table in no frame), cust and order (entities of a concept
// frame C), line (an entity in no frame). Collapsing S or C hides their cards.
const map = (id: string, from: { cardId: string; columnId: string }[], to: { cardId: string; attributeId: string }, over: Partial<MapLineData> = {}): MapLineData => ({
  id,
  status: "approved",
  kind: "direct",
  ruled: false,
  warn: false,
  inputs: from,
  inputCount: from.length,
  attributeId: to.attributeId,
  cardId: to.cardId,
  ...over,
});
const rel = (id: string, fromCardId: string, toCardId: string): RelLineData => ({ id, fromCardId, toCardId, label: null, fromMin: 1, fromMax: "1", toMin: 0, toMax: "n", offset: 0 });

const lines: CanvasLines = {
  mappings: [
    map("m1", [{ cardId: "crm1", columnId: "c-id" }], { cardId: "cust", attributeId: "a-id" }),
    map("m2", [{ cardId: "crm2", columnId: "c-id2" }], { cardId: "cust", attributeId: "a-id" }, { status: "draft" }),
    map("m3", [{ cardId: "crm1", columnId: "c-mail" }], { cardId: "cust", attributeId: "a-mail" }, { warn: true }),
    map("m4", [{ cardId: "web", columnId: "w-mail" }], { cardId: "cust", attributeId: "a-mail" }),
    map("m5", [{ cardId: "crm1", columnId: "c-no" }], { cardId: "line", attributeId: "l-no" }),
    // a combined mapping (D-49): one input in S, one not
    map("m6", [{ cardId: "crm2", columnId: "c-first" }, { cardId: "web", columnId: "w-first" }], { cardId: "line", attributeId: "l-name" }, { kind: "transform", ruled: true }),
  ],
  relationships: [rel("r1", "cust", "order"), rel("r2", "cust", "line"), rel("r3", "order", "line"), rel("r4", "line", "cust")],
};
const inS = (card: string) => (card === "crm1" || card === "crm2" ? "S" : null);
const inC = (card: string) => (card === "cust" || card === "order" ? "C" : null);
const both = (card: string) => inS(card) ?? inC(card);

describe("bundled lines (slice 2c, D-07): grouping per pair of ends", () => {
  it("with nothing collapsed, every line is drawn as before and there are no bundles", () => {
    const b = bundleLines(lines, () => null);
    expect(b.mappings.map((m) => m.id)).toEqual(["m1", "m2", "m3", "m4", "m5", "m6"]);
    expect(b.relationships).toHaveLength(4);
    expect(b.bundles).toEqual([]);
  });

  it("a collapsed source frame: one bundle per attribute it feeds (from the frame to the row), the other lines as before", () => {
    const b = bundleLines(lines, inS);
    expect(b.bundles.map((x) => [x.key, x.ids])).toEqual([
      ["m|f:S|r:a-id", ["m1", "m2"]],
      ["m|f:S|r:a-mail", ["m3"]],
      ["m|f:S|r:l-no", ["m5"]],
      ["m|f:S|r:l-name", ["m6"]],
      ["m|r:w-first|r:l-name", ["m6"]], // the combined mapping's other input keeps its own row
    ]);
    expect(b.bundles[0]).toMatchObject({ t: "map", a: { key: "f:S", frameId: "S" }, z: { key: "r:a-id", cardId: "cust", rowId: "a-id" } });
    expect(b.mappings.map((m) => m.id)).toEqual(["m4"]);
    expect(b.relationships).toHaveLength(4); // no relationship touches the source frame
  });

  it("a group of one keeps its mapping (the caller draws it with its own identity)", () => {
    const single = bundleLines(lines, inS).bundles.find((x) => x.key === "m|f:S|r:a-mail")!;
    expect(single.ids).toEqual(["m3"]);
  });

  it("two collapsed frames: one bundle per direction between them, lines inside one frame left out", () => {
    const b = bundleLines(lines, both);
    const keys = b.bundles.filter((x) => x.t === "map").map((x) => [x.key, x.ids.length]);
    expect(keys).toEqual([
      ["m|f:S|f:C", 3], // m1, m2, m3: all into the Customer frame
      ["m|r:w-mail|f:C", 1],
      ["m|f:S|r:l-no", 1],
      ["m|f:S|r:l-name", 1],
      ["m|r:w-first|r:l-name", 1],
    ]);
    // relationships: cust–order are both in C (left out); C–line twice (r2 and r4, either direction) and order–line once
    const rels = b.bundles.filter((x) => x.t === "rel");
    expect(rels.map((x) => [x.key, x.ids])).toEqual([["r|e:line|f:C", ["r2", "r3", "r4"]]]);
    expect(b.relationships).toEqual([]);
  });

  it("relationship bundles are undirected: line→cust and cust→line are the same pair", () => {
    const b = bundleLines(lines, inC);
    expect(b.bundles.filter((x) => x.t === "rel").map((x) => x.ids)).toEqual([["r2", "r3", "r4"]]);
  });

  it("lines with both ends in the same collapsed frame are not drawn and not bundled", () => {
    const sameFrame: CanvasLines = { mappings: [map("mx", [{ cardId: "crm1", columnId: "c" }], { cardId: "crm2", attributeId: "x" })], relationships: [rel("rx", "cust", "order")] };
    const b = bundleLines(sameFrame, both);
    expect(b).toEqual({ mappings: [], relationships: [], bundles: [] });
  });

  it("layer mode applies: Mappings hides relationship lines and bundles, Relationships hides mapping lines and bundles", () => {
    const maps = bundleLines(lines, both, "mappings");
    expect(maps.relationships).toEqual([]);
    expect(maps.bundles.every((x) => x.t === "map")).toBe(true);
    const rels = bundleLines(lines, both, "relationships");
    expect(rels.mappings).toEqual([]);
    expect(rels.bundles.every((x) => x.t === "rel")).toBe(true);
    expect(rels.bundles).toHaveLength(1);
  });

  it("a bundle is drawn as draft only when all are drafts, in the warning colour when any has a type problem; its width grows with the count", () => {
    const byId = new Map(lines.mappings.map((m) => [m.id, m]));
    const sToC = bundleLines(lines, both).bundles.find((x) => x.key === "m|f:S|f:C")!;
    expect(bundleLook(sToC, byId)).toEqual({ draft: false, warn: true });
    expect(bundleLook({ ...sToC, ids: ["m2"] }, byId)).toEqual({ draft: true, warn: false });
    expect(bundleWidth(1)).toBeCloseTo(1.6);
    expect(bundleWidth(2)).toBeCloseTo(2.9);
    expect(bundleWidth(1000)).toBeCloseTo(5.6); // at most 4 more
  });
});

describe("a line's end at a block (slice 2c, prototype endOf)", () => {
  const block = { x: 100, y: 200, w: 280, h: 118 };

  it("is the middle of the block's facing side", () => {
    const end = blockEnd(block);
    expect(end).toEqual({ x: 100, w: 280, y: 259, cx: 240, hidden: false });
    // the other end to the right: the line leaves the block's right side
    const right = curve(end, { x: 800, w: 256, y: 300, cx: 928, hidden: false });
    expect(right.p0).toEqual({ x: 380, y: 259 });
    // to the left: the left side
    const left = curve({ x: -500, w: 256, y: 300, cx: -372, hidden: false }, end);
    expect(left.p3).toEqual({ x: 100, y: 259 });
  });
});
