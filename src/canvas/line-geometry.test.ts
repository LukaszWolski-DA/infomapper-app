import { describe, expect, it } from "vitest";
import type { CardData } from "./card-data";
import { curve, HEAD_H, type Placed } from "./geometry";
import type { CanvasLines, MapLineData, RelLineData } from "./line-data";
import { blockEnd, bundleGeom, bundleLines, bundleLook, bundleWidth } from "./line-geometry";

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
  labels: null,
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

  it("a bundle counts distinct mappings: two inputs of one mapping in the same pair of ends put it in once (Łukasz, step 1 answer 1)", () => {
    const both2: CanvasLines = {
      mappings: [map("mc", [{ cardId: "crm1", columnId: "c-first" }, { cardId: "crm2", columnId: "c-last" }], { cardId: "line", attributeId: "l-name" }, { kind: "transform", ruled: true })],
      relationships: [],
    };
    expect(bundleLines(both2, inS).bundles).toEqual([
      { key: "m|f:S|r:l-name", t: "map", a: { key: "f:S", frameId: "S" }, z: { key: "r:l-name", cardId: "line", rowId: "l-name" }, ids: ["mc"] },
    ]);
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

describe("drawing a bundle (slice 2c, prototype “Semantic zoom”)", () => {
  // S collapsed (block at 0,0) and C collapsed (block at 1000,0); cust and line drawn as cards.
  const card = (rows: string[]): Placed["card"] => ({ rows: rows.map((id) => ({ id, mappings: 1 })) as unknown as CardData["rows"], collapsed: false, rowFilter: "all", width: null });
  const drawn: Record<string, Placed> = {
    cust: { x: 600, y: 0, card: card(["a-id", "a-mail"]) },
    line: { x: 600, y: 400, card: card(["l-no", "l-name"]) },
  };
  const placed = (id: string) => drawn[id] ?? null;
  const blocks = new Map([
    ["S", { x: 0, y: 0, w: 280, h: 118 }],
    ["C", { x: 1000, y: 0, w: 280, h: 96 }],
  ]);
  const byId = new Map(lines.mappings.map((m) => [m.id, m]));
  const bundleOf = (collapsed: (c: string) => string | null, key: string) => bundleLines(lines, collapsed).bundles.find((b) => b.key === key)!;

  it("two or more mappings: one line from the block's facing side to the row, with the count, width and look", () => {
    const g = bundleGeom(bundleOf(inS, "m|f:S|r:a-id"), placed, blocks, byId)!;
    expect(g).toMatchObject({ kind: "map", count: 2, draft: false, warn: false });
    expect(g.kind === "map" && g.width).toBeCloseTo(2.9);
    // from the middle of the block's right side to the row's left edge
    expect(g.kind === "map" && g.d.startsWith("M280,59 ")).toBe(true);
    expect(g.kind === "map" && g.d.endsWith(` 600,${HEAD_H + 6 + 13}`)).toBe(true);
  });

  it("a group of one keeps its mapping: its line, its ends and its chip (! for a type problem, ƒ for a transform)", () => {
    const warn = bundleGeom(bundleOf(inS, "m|f:S|r:a-mail"), placed, blocks, byId)!;
    expect(warn).toMatchObject({ kind: "single", line: { id: "m3" }, geom: { chip: { text: "!" }, part: false } });
    expect(warn.kind === "single" && warn.geom.dots).toHaveLength(2);
    // the combined mapping m6 with its S input collapsed: no ƒ node, the ƒ chip on its line (Łukasz, step 1 answers 2, 3)
    const f = bundleGeom(bundleOf(inS, "m|f:S|r:l-name"), placed, blocks, byId)!;
    expect(f).toMatchObject({ kind: "single", line: { id: "m6" }, geom: { chip: { text: "ƒ" } } });
    expect(f.kind === "single" && f.geom.paths).toHaveLength(1);
    const plain = bundleGeom(bundleOf(inS, "m|f:S|r:l-no"), placed, blocks, byId)!;
    expect(plain.kind === "single" && plain.geom.chip).toBeNull();
  });

  it("between two blocks: from block to block", () => {
    const g = bundleGeom(bundleOf(both, "m|f:S|f:C"), placed, blocks, byId)!;
    expect(g).toMatchObject({ kind: "map", count: 3, warn: true });
    expect(g.kind === "map" && g.d.startsWith("M280,59 ") && g.d.endsWith(" 1000,48")).toBe(true);
  });

  it("relationships: one line between the block and the entity card, labelled with the count", () => {
    const g = bundleGeom(bundleOf(inC, "r|e:line|f:C"), placed, blocks, byId)!;
    expect(g).toMatchObject({ kind: "rel", label: "3 relationships" });
    const one = bundleGeom({ key: "r|e:line|f:C", t: "rel", a: { key: "e:line", cardId: "line" }, z: { key: "f:C", frameId: "C" }, ids: ["r2"] }, placed, blocks, byId)!;
    expect(one).toMatchObject({ kind: "rel", label: "1 relationship" });
  });

  it("is not drawn when an end is not on the canvas", () => {
    expect(bundleGeom(bundleOf(inS, "m|f:S|r:a-id"), () => null, blocks, byId)).toBeNull();
    expect(bundleGeom(bundleOf(inS, "m|f:S|r:a-id"), placed, new Map(), byId)).toBeNull();
  });
});
