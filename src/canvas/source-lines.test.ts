import { describe, expect, it } from "vitest";
import { canvasItem, entity, ids, relationship, sourceRelationship, sourceTable } from "@/domain/__fixtures__/domain";
import type { WorkspaceModel } from "@/domain/types";
import { buildCards } from "./card-data";
import { arrowHead, ARROW, relGeom, type Rect } from "./geometry";
import { buildLines, type CanvasLines, type SourceLineData } from "./line-data";
import { bundleLines } from "./line-geometry";

// Relationships between source tables (slice 10b, D-62): order_line → order_header, two keys between the same two
// tables, order_line → product (no card), a key from employees to itself (twice), a missing one.
const T = {
  line: "01900000-0000-7000-8000-00000000e001",
  header: "01900000-0000-7000-8000-00000000e002",
  product: "01900000-0000-7000-8000-00000000e003",
  employees: "01900000-0000-7000-8000-00000000e004",
};
const C = { line: "01900000-0000-7000-8000-00000000e101", header: "01900000-0000-7000-8000-00000000e102", employees: "01900000-0000-7000-8000-00000000e104" };
const R = {
  lineHeader: "01900000-0000-7000-8000-00000000e201",
  lineHeader2: "01900000-0000-7000-8000-00000000e202",
  lineProduct: "01900000-0000-7000-8000-00000000e203",
  manager: "01900000-0000-7000-8000-00000000e204",
  mentor: "01900000-0000-7000-8000-00000000e205",
  headerLine: "01900000-0000-7000-8000-00000000e206",
};

const model: WorkspaceModel = {
  concepts: [],
  entities: [entity(ids.customer)],
  attributes: [],
  relationships: [relationship()],
  sourceSystems: [],
  sourceTables: Object.entries(T).map(([name, id]) => sourceTable({ id, name })),
  sourceColumns: [],
  mappings: [],
  mappingInputs: [],
  sourceRelationships: [
    sourceRelationship(R.lineHeader, T.line, T.header),
    sourceRelationship(R.lineHeader2, T.line, T.header, { missing_since: "2026-10-30T00:00:00.000Z" }),
    sourceRelationship(R.lineProduct, T.line, T.product),
    sourceRelationship(R.manager, T.employees, T.employees),
    sourceRelationship(R.mentor, T.employees, T.employees),
    sourceRelationship(R.headerLine, T.header, T.line),
  ],
  sourceRelationshipColumns: [],
  classifications: [],
  classificationLinks: [],
};
const items = [
  canvasItem(ids.itemCustomer, { x: 400, y: 0 }),
  canvasItem(C.line, { source_table_id: T.line, x: 0, y: 0 }),
  canvasItem(C.header, { source_table_id: T.header, x: 600, y: 0 }),
  canvasItem(C.employees, { source_table_id: T.employees, x: 0, y: 600 }),
];
const lines = buildLines(model, buildCards(model, items));

describe("source lines in buildLines (slice 10b, D-62)", () => {
  it("draws a key when both table cards are on the canvas, from the table with the key to the referenced one", () => {
    expect(lines.sources?.find((s) => s.id === R.lineHeader)).toEqual({ id: R.lineHeader, fromCardId: C.line, toCardId: C.header, offset: 0 });
    // product has no card
    expect(lines.sources?.some((s) => s.id === R.lineProduct)).toBe(false);
  });

  it("spaces keys between the same two tables 16 px apart, in either direction, and marks a missing one", () => {
    const between = lines.sources!.filter((s) => s.fromCardId !== s.toCardId);
    expect(between.map((s) => [s.id, s.offset, !!s.missing])).toEqual([
      [R.lineHeader, 0, false],
      [R.lineHeader2, 16, true],
      [R.headerLine, 32, false],
    ]);
  });

  it("draws a key to itself on one card, nested by its offset (D-61's loop)", () => {
    const loops = lines.sources!.filter((s) => s.fromCardId === s.toCardId);
    expect(loops.map((s) => [s.id, s.fromCardId, s.offset])).toEqual([
      [R.manager, C.employees, 0],
      [R.mentor, C.employees, 16],
    ]);
  });

  it("leaves relationships between entities and mappings as they were, and the list out with no key drawn", () => {
    expect(lines.relationships).toEqual([]); // the relationship's second entity has no card
    expect("sources" in buildLines({ ...model, sourceRelationships: [] }, buildCards(model, items))).toBe(false);
  });
});

describe("source lines through bundling (slice 10b, F3)", () => {
  const src = (id: string, fromCardId: string, toCardId: string): SourceLineData => ({ id, fromCardId, toCardId, offset: 0 });
  const all: CanvasLines = { mappings: [], relationships: [], sources: [src("s1", "a", "b"), src("s2", "b", "c"), src("s3", "c", "c")] };

  it("keeps the lines whose cards are drawn when an unrelated frame is collapsed", () => {
    expect(bundleLines(all, (card) => (card === "z" ? "F" : null)).sources?.map((s) => s.id)).toEqual(["s1", "s2", "s3"]);
  });

  it("leaves out a line with either card in a collapsed frame, and never bundles it", () => {
    const out = bundleLines(all, (card) => (card === "b" ? "F" : null));
    expect(out.sources?.map((s) => s.id)).toEqual(["s3"]);
    expect(out.bundles).toEqual([]);
    // a key to itself inside a collapsed frame: not drawn
    expect("sources" in bundleLines(all, (card) => (card === "b" || card === "c" ? "F" : null))).toBe(false);
  });

  it("follows the layer mode: hidden in Mappings", () => {
    expect("sources" in bundleLines(all, () => "F", "mappings")).toBe(false);
    expect(bundleLines(all, (card) => (card === "z" ? "F" : null), "relationships").sources).toHaveLength(3);
  });
});

describe("the arrow (slice 10b)", () => {
  const A: Rect = { x: 0, y: 0, w: 260, h: 200 }, B: Rect = { x: 600, y: 0, w: 260, h: 200 };

  it("has its tip at the referenced card's edge and points into it", () => {
    const g = relGeom(A, B, 0);
    expect(g.pb.x).toBe(B.x);
    // the referenced card is on the right: the base lies left of the tip, outside the card
    expect(arrowHead(g.pb, g.nb)).toBe(`M${B.x},${g.pb.y}L${B.x - ARROW.length},${g.pb.y - ARROW.half}L${B.x - ARROW.length},${g.pb.y + ARROW.half}Z`);
  });

  it("on a loop, sits on the top edge pointing down", () => {
    const g = relGeom(A, A, 0, true);
    expect(g.pb.y).toBe(A.y);
    expect(arrowHead(g.pb, g.nb)).toBe(`M${g.pb.x},0L${g.pb.x + ARROW.half},${-ARROW.length}L${g.pb.x - ARROW.half},${-ARROW.length}Z`);
  });
});
