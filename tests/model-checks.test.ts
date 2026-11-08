// Slice 20: the model checks on the composed demo (seed, reset, `npm run demo`), InfoCube's groups through the
// composition root, and InfoCube off (acceptance doc Q12, recounted after step 1's answer 1).

import { describe, expect, it } from "vitest";
import { cubeModuleChecks } from "@/compose/checks";
import { addChecksDemoData, addFullDemoData, addTypesDemoData } from "@/compose/seed";
import type { DevDb } from "@/data/local/schema";
import { buildSeed, SEED_IDS } from "@/data/local/seed";
import { salesStarCanvasId } from "@/modules/infocube/data/sales-star";
import type { InfoCubeDb } from "@/modules/infocube/data/tables";
import { CHECK_MAPPING_KIND } from "@/modules/infocube/domain/checks";
import { CUBE_MAPPING_KIND } from "@/modules/infocube/canvas/lines";
import { cubeRequirementFeeds, mappingIndex } from "@/modules/infocube/domain/mappings";
import { cubePageRows } from "@/modules/infocube/domain/view";
import { checkIndex, lineOf, modelChecks, projectScope, type CheckGroup, type ModelChecks } from "@/domain/model/checks";
import { lookupModel } from "@/domain/model/requirements";
import type { WorkspaceModel } from "@/domain/types";

const WS = SEED_IDS.wsRetailDwh;
type Db = DevDb & InfoCubeDb;

const live = <T extends { deleted_at: string | null; workspace_id: string }>(rows: readonly T[]) => rows.filter((r) => r.deleted_at === null && r.workspace_id === WS);

/** The model as `store.model.load` gives it, for the checks' reads. */
function modelOf(db: Db): WorkspaceModel {
  const attributes = db.attribute.filter((a) => a.workspace_id === WS);
  const byId = new Map(attributes.map((a) => [a.id, a]));
  const lost = [...new Set(live(attributes).flatMap((a) => (a.copied_from_attribute_id && byId.get(a.copied_from_attribute_id)?.deleted_at !== null ? [a.copied_from_attribute_id] : [])))];
  return {
    concepts: live(db.concept),
    entities: live(db.entity).sort((a, b) => a.name.localeCompare(b.name)),
    attributes: live(attributes).sort((a, b) => a.entity_id.localeCompare(b.entity_id) || a.sort_order - b.sort_order),
    relationships: live(db.relationship),
    sourceSystems: live(db.source_system),
    sourceTables: live(db.source_table),
    sourceColumns: live(db.source_column),
    mappings: live(db.mapping),
    mappingInputs: live(db.mapping_input),
    attributeInputs: live(db.attribute_input),
    sourceRelationships: [],
    sourceRelationshipColumns: [],
    classifications: [],
    classificationLinks: [],
    lostOriginals: lost.flatMap((id) => {
      const a = byId.get(id);
      return a ? [{ id, name: a.name, entityName: db.entity.find((e) => e.id === a.entity_id)?.name ?? "?" }] : [];
    }),
  };
}

/** The checks of a project (its canvases' entities) or of the whole model, as the pages build them. */
function checksOf(db: Db, project: string | null, on = true): ModelChecks {
  const model = modelOf(db);
  const rows = cubePageRows(live(db.cube_entity ?? []), live(db.cube_measure ?? []), live(db.cube_key ?? []), live(db.cube_mapping ?? []), live(db.cube_mapping_input ?? []));
  const feeds = cubeRequirementFeeds(mappingIndex({ entities: model.entities, attributes: model.attributes, cubeMappings: rows.cubeMappings as never, cubeMappingInputs: rows.cubeMappingInputs as never }), model.attributes);
  const scope = project ? projectScope(live(db.canvas_item), canvasesOf(db, project)) : null;
  const input = { model, lookup: lookupModel(model, feeds), scope };
  return modelChecks(input, cubeModuleChecks(on, rows, input));
}
const canvasesOf = (db: Db, project: string) => db.project_canvas.filter((l) => l.project_id === project).sort((a, b) => a.sort_order - b.sort_order).map((l) => l.canvas_id);
const counts = (c: ModelChecks) => Object.fromEntries(c.groups.map((g) => [g.id, g.items.length]));
/** A group's items with their words, as a page shows them. */
const linesOf = (g: CheckGroup) => g.items.map(lineOf);
const onCanvas = (db: Db, c: ModelChecks, canvasId: string) => {
  const entityOf = new Map(modelOf(db).attributes.map((a) => [a.id, a.entity_id]));
  const x = checkIndex(c, (id) => entityOf.get(id));
  const lines = x.onCanvas(live(db.canvas_item).filter((i) => i.canvas_id === canvasId && i.entity_id).map((i) => i.entity_id!));
  return { n: lines.length, high: lines.some((l) => l.group.high) };
};
const demo = (): Db => {
  const db = buildSeed() as Db;
  expect(addFullDemoData(db)).toBe(true);
  return db;
};
const attr = (db: Db, entity: string, name: string) => db.attribute.find((a) => a.workspace_id === WS && a.name === name && db.entity.find((e) => e.id === a.entity_id)?.name === entity)!;

describe("the demo (step 1, Q12, recounted after answer 1)", () => {
  it("gives Order management 15 lines and Customer 360 9", () => {
    const db = demo();
    expect(counts(checksOf(db, SEED_IDS.projOrderManagement))).toEqual({ wrong: 1, dup: 1, calc: 1, norel: 1, nokey: 1, under: 10 });
    expect(counts(checksOf(db, SEED_IDS.projCustomer360))).toEqual({ wrong: 1, calc: 1, under: 7 });
    const c = checksOf(db, SEED_IDS.projOrderManagement);
    // the "under" lines follow the targets' order in the model; compared as a set
    const shown = c.groups.map((g) => [g.id, linesOf(g).map((l) => `${l.name} · ${l.detail}`).sort()]);
    expect(shown).toEqual([
      ["wrong", ["Customer.last_order_id · copy of Sales Order.order_id, but Customer is the one side of “places”"]],
      ["dup", ["Product: product_name, Product_Name · 2 attributes, one name"]],
      ["calc", ["Sales Order.total_amount · calculated from 0, also 1 mapping"]],
      ["norel", ["Product.country_code · copy of Country.country_code; Product and Country are not related"]],
      ["nokey", ["Country – Customer Address (locates) · Customer Address has no copy of country_code"]],
      [
        "under",
        [
          "Sales Order.customer_id → Fact Orders.customer_key · customer_id is not mapped",
          "Sales Order.customer_id → Fact Sales.customer_key · customer_id is not mapped",
          "Order Line.product_id → Fact Sales.product_key · product_id has no approved source mapping",
          "Order Line.quantity → Fact Sales.quantity · quantity is not mapped",
          "Order Line.unit_price → Fact Sales.unit_price · unit_price is not mapped",
          "Order Line.discount_pct → Fact Sales.discount_pct · discount_pct is not mapped",
          "Customer.segment_code → Dim Customer.segment_code · segment_code is not mapped",
          "Product.sku → Dim Product.sku · sku is not mapped",
          "Product.product_name → Dim Product.product_name · product_name is not mapped",
          "Product.category_code → Dim Product.category_code · category_code is not mapped",
        ].sort(),
      ],
    ]);
  });
  it("counts each canvas's lines (the status bar, answer 4)", () => {
    const db = demo();
    const c = checksOf(db, null);
    expect(onCanvas(db, c, SEED_IDS.canvasCustomerOrders)).toEqual({ n: 9, high: true });
    expect(onCanvas(db, c, SEED_IDS.canvasOrderLines)).toEqual({ n: 9, high: false });
    expect(onCanvas(db, c, salesStarCanvasId(WS))).toEqual({ n: 15, high: true });
  });
  it("runs once, in Retail Co – DWH only", () => {
    const db = demo();
    expect(addChecksDemoData(db)).toBe(false);
    const other = db.attribute.filter((a) => a.workspace_id !== WS && a.copied_from_attribute_id);
    expect(other).toEqual([]);
  });
});

describe("the plain seed and the earlier fixtures (answer 1 (b), answer 11)", () => {
  it("has no line in the plain e2e seed: its hand-typed foreign keys carry the keys", () => {
    const db = buildSeed() as Db;
    expect(checksOf(db, SEED_IDS.projOrderManagement).count).toBe(0);
    expect(checksOf(db, null).count).toBe(0);
  });
  it("gives slice 19's fixture data only the star's uncovered feeds", () => {
    const db = buildSeed() as Db;
    addTypesDemoData(db);
    expect(counts(checksOf(db, SEED_IDS.projOrderManagement))).toEqual({ under: 10 });
  });
});

describe("S20-01's changes, read as the rules see them", () => {
  it("a logical type that no longer fits an approved direct feed is a High line, marked on the target's row", () => {
    const db = demo();
    attr(db, "Customer", "segment_code").data_type = "integer";
    const c = checksOf(db, SEED_IDS.projOrderManagement);
    const feeds = c.groups.find((g) => g.id === "feeds")!;
    expect(linesOf(feeds).map((l) => `${l.name} · ${l.detail}`)).toEqual(["Customer.segment_code → Dim Customer.segment_code · type conflict: Customer.segment_code is Integer, Dim Customer.segment_code is String"]);
    expect([feeds.high, feeds.module, feeds.items[0]!.go.t, (feeds.items[0]!.go as { kind: string }).kind]).toEqual([true, "InfoCube", "ext", CHECK_MAPPING_KIND]);
    expect(c.groups.map((g) => g.id).slice(0, 2)).toEqual(["wrong", "feeds"]);
  });
  it("deleting Sales Order.order_id leaves its two copies lost", () => {
    const db = demo();
    attr(db, "Sales Order", "order_id").deleted_at = "2026-11-08T10:00:00.000Z";
    const lost = checksOf(db, SEED_IDS.projOrderManagement).groups.find((g) => g.id === "lost")!;
    expect(linesOf(lost).map((l) => `${l.name} · ${l.detail}`).sort()).toEqual(["Customer.last_order_id · copy of Sales Order.order_id, which was deleted", "Order Line.order_id · copy of Sales Order.order_id, which was deleted"]);
    expect(checksOf(db, SEED_IDS.projOrderManagement).groups.some((g) => g.id === "wrong")).toBe(false);
  });
  it("a fact without a grain gets a hint line, marked on its header and kept out of the panels' lists", () => {
    const db = demo();
    const sales = db.entity.find((e) => e.workspace_id === WS && e.name === "Fact Sales")!;
    db.cube_entity.find((c) => c.entity_id === sales.id)!.grain = null;
    const c = checksOf(db, SEED_IDS.projOrderManagement);
    const facts = c.groups.find((g) => g.id === "facts")!;
    expect(linesOf(facts).map((l) => [l.name, l.detail, l.go, l.marks, l.hintOf])).toEqual([["Fact Sales", "No grain yet. Write what one row of this fact stands for.", { t: "entity", id: sales.id }, [{ t: "entity", id: sales.id }], sales.id]]);
    const entityOf = new Map(modelOf(db).attributes.map((a) => [a.id, a.entity_id]));
    const x = checkIndex(c, (id) => entityOf.get(id));
    expect([x.hintsOf(sales.id), x.panel({ t: "entity", id: sales.id }).length, x.entityMark(sales.id)?.high]).toEqual([1, 0, false]);
  });
});

describe("InfoCube's feeds by the app's rules (F11, F12)", () => {
  const feedsOf = (db: Db) => checksOf(db, SEED_IDS.projOrderManagement).groups.find((g) => g.id === "feeds")?.items.map((i) => lineOf(i).name) ?? [];
  it("counts Integer → Decimal on a direct copy as a conflict; a transformation with a rule never conflicts", () => {
    const db = demo();
    attr(db, "Fact Sales", "quantity").data_type = "decimal";
    // Fact Sales.date_key is a transformation with a rule from a Date: no line
    expect(feedsOf(db)).toEqual(["Order Line.quantity → Fact Sales.quantity"]);
  });
  it("reads an approved lookup as the app does, and ignores a mapping that is not approved", () => {
    const db = demo();
    const lookup = db.cube_mapping.find((m) => m.workspace_id === WS && m.kind === "lookup")!;
    expect(lookup.status).toBe("draft");
    attr(db, "Country", "country_name").data_type = "integer";
    expect(feedsOf(db)).toEqual([]);
    lookup.status = "approved";
    expect(feedsOf(db)).toEqual(["Country.country_name → Dim Customer.country_name"]);
    const under = checksOf(db, SEED_IDS.projOrderManagement).groups.find((g) => g.id === "under")!;
    expect(linesOf(under).filter((l) => l.name.startsWith("Country.")).map((l) => l.detail)).toEqual(["country_name is not mapped"]);
  });
  it("puts a feed in a project's scope by its target's entity or an input's entity", () => {
    const db = demo();
    // Customer 360 has no star card: its feeds are there through their logical inputs only
    const c = checksOf(db, SEED_IDS.projCustomer360);
    expect(c.groups.find((g) => g.id === "under")!.items.map(lineOf).every((l) => /^(Sales Order|Order Line|Customer)\./.test(l.name))).toBe(true);
  });
});

describe("InfoCube off (Q11)", () => {
  it("adds no group, topic or empty-text part", () => {
    const db = demo();
    const c = checksOf(db, SEED_IDS.projOrderManagement, false);
    expect([c.groups.some((g) => g.module), c.topics, c.allWell]).toEqual([false, [], []]);
    expect(checksOf(db, null, true).topics).toEqual(["InfoCube"]);
  });
  it("names the mapping's selection kind as the canvas does", () => {
    expect(CHECK_MAPPING_KIND).toBe(CUBE_MAPPING_KIND);
  });
});
