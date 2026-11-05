// InfoCube's lines on a canvas and what InfoMapper's line code does with a module's lines (slice 15c step 4, C7, C8,
// X4, X6, C12): the Sales star's 20 dimensional mappings as module lines (inputs, colours, dashes, ƒ), a row's lines
// both ways for a hover and a selection, a selected line, collapsed frames leave them out unbundled, the layers, Focus
// on a selected line, and the cards' row states and coverage from the feeds (the Mapped / Not mapped filter).

import { describe, expect, it } from "vitest";
import { moduleLines } from "@/compose";
import { addModuleDemoData } from "@/compose/seed";
import { buildCards } from "@/canvas/card-data";
import { focusTargetOf } from "@/canvas/Focus";
import { bundleLines } from "@/canvas/line-geometry";
import { hoverRows, relatedLines, type CanvasLines, type ModuleLineData } from "@/canvas/line-data";
import { buildSeed, SEED_IDS } from "@/data/local/seed";
import { rowShown } from "@/domain/model/card-size";
import { NO_CONCEPT_COLOR } from "@/domain/model/concept-colors";
import type { CanvasItem, WorkspaceModel } from "@/domain/types";
import { cubeLines, CUBE_MAPPING_KIND } from "@/modules/infocube/canvas/lines";
import { mappingIndex } from "@/modules/infocube/domain/mappings";
import type { CubeMapping, CubeMappingInput } from "@/modules/infocube/domain/types";
import { cubePageRows, cubeRowFeeds, FED_COVERAGE, NOT_FED } from "@/modules/infocube/domain/view";
import { salesStarCanvasId } from "@/modules/infocube/data/sales-star";
import { NO_MODULES } from "@/ui/modules";

const WS = SEED_IDS.wsRetailDwh;
type Db = Record<string, Record<string, unknown>[]>;

function star() {
  const db = buildSeed() as unknown as Db;
  addModuleDemoData(db as never);
  const of = <T>(table: string) => (db[table] ?? []).filter((r) => r.workspace_id === WS && r.deleted_at === null) as T[];
  const model = {
    concepts: of("concept"),
    entities: of("entity"),
    attributes: of("attribute"),
    relationships: of("relationship"),
    mappings: of("mapping"),
    mappingInputs: of("mapping_input"),
    sourceSystems: of("source_system"),
    sourceTables: of("source_table"),
    sourceColumns: of("source_column"),
    sourceRelationships: of("source_relationship"),
    classifications: of("classification"),
    classificationLinks: of("classification_link"),
  } as unknown as WorkspaceModel;
  const items = of<CanvasItem>("canvas_item").filter((i) => i.canvas_id === salesStarCanvasId(WS));
  const cubeMappings = of<CubeMapping>("cube_mapping");
  const cubeMappingInputs = of<CubeMappingInput>("cube_mapping_input");
  const cards = buildCards(model, items);
  const index = mappingIndex({ entities: model.entities, attributes: model.attributes, cubeMappings, cubeMappingInputs });
  const entity = (name: string) => model.entities.find((e) => e.name === name)!;
  const attr = (e: string, a: string) => model.attributes.find((x) => x.entity_id === entity(e).id && x.name === a)!;
  const card = (e: string) => cards.find((c) => c.targetId === entity(e).id)!;
  return { model, items, cards, cubeMappings, cubeMappingInputs, index, entity, attr, card };
}

describe("the Sales star's dimensional lines (C7)", () => {
  it("draws every mapping with its inputs, the target's concept colour, its status and ƒ for a transformation", () => {
    const s = star();
    const lines = cubeLines(s.model, s, s.cards);
    expect(lines).toHaveLength(20);
    expect(lines.reduce((n, l) => n + l.inputs.length, 0)).toBe(22);
    for (const l of lines) {
      expect(l.kind).toBe(CUBE_MAPPING_KIND);
      expect(l.endMark).toBe("diamond");
      const m = s.cubeMappings.find((x) => x.id === l.id)!;
      expect(l.cls).toBe(`cmap ${m.status}`);
      expect(l.chip).toBe(m.kind === "transform" ? "ƒ" : undefined);
      const target = s.index.attribute(m.attribute_id)!;
      expect(l.target).toEqual({ rowId: target.id, cardId: s.cards.find((c) => c.targetId === target.entity_id)!.id });
      const concept = s.model.concepts.find((c) => c.id === s.model.entities.find((e) => e.id === target.entity_id)!.concept_id);
      expect(l.colour).toBe(concept?.color ?? NO_CONCEPT_COLOR);
    }
    const net = lines.find((l) => l.target.rowId === s.attr("Fact Sales", "net_amount").id)!;
    expect(net.cls).toBe("cmap review");
    expect(net.inputs.map((i) => i.rowId)).toEqual(["quantity", "unit_price", "discount_pct"].map((a) => s.attr("Order Line", a).id));
    expect(lines.filter((l) => l.cls === "cmap draft").map((l) => s.index.label(l.target.rowId)).sort()).toEqual(["Dim Customer.city", "Fact Orders.line_count"]);
  });

  it("leaves out inputs without a card and lines without a target's card or any input's card", () => {
    const s = star();
    const withoutOrderLine = s.cards.filter((c) => c.targetId !== s.entity("Order Line").id);
    const lines = cubeLines(s.model, s, withoutOrderLine);
    expect(lines.some((l) => l.inputs.some((i) => i.rowId === s.attr("Order Line", "quantity").id))).toBe(false);
    expect(lines.length).toBeLessThan(20);
    const withoutDimCustomer = s.cards.filter((c) => c.targetId !== s.entity("Dim Customer").id);
    expect(cubeLines(s.model, s, withoutDimCustomer).some((l) => s.index.attribute(l.target.rowId)!.entity_id === s.entity("Dim Customer").id)).toBe(false);
    expect(cubeLines(s.model, { cubeMappings: [], cubeMappingInputs: [] }, s.cards)).toEqual([]);
  });

  it("comes to the page through the composition root from the page's rows, none without them", () => {
    const s = star();
    const view = { ...NO_MODULES, data: { infocube: cubePageRows([], [], [], s.cubeMappings, s.cubeMappingInputs) } };
    expect(moduleLines(view, s.model, s.cards)).toEqual(cubeLines(s.model, s, s.cards));
    expect(moduleLines(NO_MODULES, s.model, s.cards)).toEqual([]);
  });
});

/** A small canvas: two cards and two module lines, one with two inputs. */
const line = (id: string, inputs: [string, string][], target: [string, string]): ModuleLineData => ({
  kind: "k",
  id,
  inputs: inputs.map(([cardId, rowId]) => ({ cardId, rowId })),
  target: { cardId: target[0], rowId: target[1] },
  cls: "x",
  colour: "#000",
  endMark: "diamond",
});
const LINES: CanvasLines = {
  mappings: [],
  relationships: [],
  modules: [line("m1", [["A", "a1"]], ["B", "b1"]), line("m2", [["A", "a1"], ["C", "c1"]], ["B", "b2"])],
};

describe("a module's lines in InfoMapper's line code (C7, C8, X6)", () => {
  it("a row's lines both ways for a selection and a hover; a line's rows", () => {
    expect(relatedLines({ t: "row", cardId: "A", id: "a1" }, LINES)).toEqual({ maps: new Set(), rels: new Set(), exts: new Set(["m1", "m2"]) });
    expect(relatedLines({ t: "row", cardId: "B", id: "b2" }, LINES)?.exts).toEqual(new Set(["m2"]));
    expect(relatedLines({ t: "ext", kind: "k", id: "m1" }, LINES)?.exts).toEqual(new Set(["m1"]));
    // a row without module lines keeps the old shape
    expect(relatedLines({ t: "row", cardId: "A", id: "zz" }, LINES)).toEqual({ maps: new Set(), rels: new Set() });
    expect(hoverRows({ t: "row", cardId: "B", id: "b2" }, LINES).map((r) => r.rowId).sort()).toEqual(["a1", "b2", "c1"]);
    expect(hoverRows({ t: "ext", kind: "k", id: "m1" }, LINES).map((r) => r.rowId).sort()).toEqual(["a1", "b1"]);
  });

  it("leaves a line out, unbundled, when any of its cards is in a collapsed frame, and in the Relationships layer", () => {
    expect(bundleLines(LINES, (id) => (id === "C" ? "f" : null)).modules?.map((l) => l.id)).toEqual(["m1"]);
    expect(bundleLines(LINES, (id) => (id === "C" ? "f" : null)).bundles).toEqual([]);
    expect(bundleLines(LINES, (id) => (id === "B" ? "f" : null)).modules).toBeUndefined();
    expect(bundleLines(LINES, () => null, "relationships").modules).toBeUndefined();
    expect(bundleLines(LINES, () => null, "mappings").modules).toHaveLength(2);
  });

  it("Focus on a selected line: its cards' entities", () => {
    const cards = [
      { id: "A", kind: "ent" as const, targetId: "eA", frameId: null },
      { id: "B", kind: "ent" as const, targetId: "eB", frameId: null },
      { id: "C", kind: "ent" as const, targetId: "eC", frameId: null },
    ];
    expect(focusTargetOf({ t: "ext", kind: "k", id: "m2" }, cards, LINES)).toEqual({ t: "ext", id: "m2", entities: ["eA", "eB", "eC"] });
    expect(focusTargetOf({ t: "ext", kind: "k", id: "gone" }, cards, LINES)).toBeNull();
  });
});

describe("the cards' feeds (C12, X4, P17)", () => {
  it("a dimensional row counts its dimensional mappings, with their inputs as the tooltip; the bar says fed", () => {
    const s = star();
    const feeds = cubeRowFeeds(s.index, s.model.attributes);
    expect(feeds[s.attr("Dim Customer", "segment_code").id]).toEqual({ n: 1, title: "from Customer.segment_code", list: "Customer.segment_code" });
    expect(feeds[s.attr("Dim Customer", "customer_key").id]).toEqual({ n: 0, title: NOT_FED, list: "" });
    expect(feeds[s.attr("Fact Sales", "net_amount").id]?.title).toBe("from Order Line.quantity + Order Line.unit_price + Order Line.discount_pct");
    // logical attributes are InfoMapper's: not in the feeds
    expect(feeds[s.attr("Customer", "segment_code").id]).toBeUndefined();

    const cards = buildCards(s.model, s.items, undefined, null, [], undefined, {}, {}, feeds);
    const dim = cards.find((c) => c.targetId === s.entity("Dim Customer").id)!;
    expect(dim.mapped).toBe(4);
    expect(dim.rows.filter((r) => rowShown(r, "mapped")).map((r) => r.name)).toEqual(["customer_number", "segment_code", "city", "country_name"]);
    expect(dim.rows.filter((r) => rowShown(r, "unmapped")).map((r) => r.name)).toEqual(["customer_key"]);
    expect(FED_COVERAGE).toBe("fed from the logical model");
    // a logical card is unchanged
    const customer = cards.find((c) => c.targetId === s.entity("Customer").id)!;
    expect(customer.mapped).toBe(s.card("Customer").mapped);
  });
});
