// The Sales star for development and slice 15's specs (slice 15a, O5) and what the composition root gives the pages
// from it (E6, E7, E13): it is consistent with the store's rules, it is added once, the plain e2e seed has none of it,
// and a canvas page's module view lists the star's roles, the Cube tab and its creates only while InfoCube is on.

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { moduleEntityDependents, moduleView, STORE_SCHEMA } from "@/compose";
import { addModuleDemoData } from "@/compose/seed";
import { resetDevData } from "@/data/local/dev-data";
import { readDb } from "@/data/local/file";
import { findViolation, type DevDb } from "@/data/local/schema";
import { buildSeed, SEED_IDS } from "@/data/local/seed";
import { createLocalDataStore } from "@/data/local/store";
import type { InfoCubeDb } from "@/modules/infocube/data/tables";
import { FEED_WORDS } from "@/modules/infocube/domain/view";

const WS = SEED_IDS.wsRetailDwh;
const ACTIONS = { fact: async () => ({ ok: false as const, message: "" }), dimension: async () => ({ ok: false as const, message: "" }) };
const named = (db: DevDb, name: string) => db.entity.find((e) => e.workspace_id === WS && e.name === name)!;

describe("the Sales star (O5)", () => {
  it("is consistent with every rule of the store, InfoCube's included, and writes no change event", () => {
    const db = buildSeed();
    const events = db.change_event.length;
    expect(addModuleDemoData(db)).toBe(true);
    expect(findViolation(db, undefined, STORE_SCHEMA)).toBeNull();
    expect(db.change_event.length).toBe(events);
  });

  it("adds five dimensional entities with their roles, six relationships with their roles and keys, the measures, the canvas, the licence and the switch, once", () => {
    const db = buildSeed() as DevDb & Partial<InfoCubeDb>;
    addModuleDemoData(db);
    expect(addModuleDemoData(db)).toBe(false);
    const dims = db.entity.filter((e) => e.workspace_id === WS && e.model_level === "dimensional").map((e) => e.name);
    expect(dims).toEqual(["Fact Sales", "Dim Customer", "Dim Product", "Dim Date", "Fact Orders"]);
    expect(db.cube_entity!.map((c) => [db.entity.find((e) => e.id === c.entity_id)!.name, c.role, c.grain, c.history])).toEqual([
      ["Fact Sales", "fact", "One order line", null],
      ["Dim Customer", "dimension", null, "history"],
      ["Dim Product", "dimension", null, "overwrite"],
      ["Dim Date", "dimension", null, "keep"],
      ["Fact Orders", "fact", "One sales order", null],
    ]);
    const fact = named(db, "Fact Sales");
    // every dimension is the 1..1 end of its relationships to the facts (D-67); slice 15b: Dim Date plays two roles in
    // Fact Sales, each relationship carried by its own key, linked explicitly (RP-F, RP-C)
    const name = (id: string) => db.entity.find((e) => e.id === id)?.name ?? db.attribute.find((a) => a.id === id)?.name;
    const keyOf = (relationshipId: string) => name(db.cube_key!.find((k) => k.relationship_id === relationshipId && k.deleted_at === null)!.attribute_id);
    expect(db.relationship.filter((r) => r.to_entity_id === fact.id).map((r) => [name(r.from_entity_id), r.from_max, r.to_max, r.from_role, r.to_role, keyOf(r.id)])).toEqual([
      ["Dim Customer", "1", "n", null, null, "customer_key"],
      ["Dim Product", "1", "n", null, null, "product_key"],
      ["Dim Date", "1", "n", "Order date", null, "date_key"],
      ["Dim Date", "1", "n", "Ship date", null, "ship_date_key"],
    ]);
    const orders = named(db, "Fact Orders");
    expect(db.relationship.filter((r) => r.to_entity_id === orders.id).map((r) => [name(r.from_entity_id), r.from_role, keyOf(r.id)])).toEqual([
      ["Dim Customer", null, "customer_key"],
      ["Dim Date", "Order date", "date_key"],
    ]);
    expect(db.cube_key).toHaveLength(6);
    // the key attributes are the facts' foreign keys, ship_date_key right after date_key
    expect(db.attribute.filter((a) => a.entity_id === fact.id).sort((x, y) => x.sort_order - y.sort_order).map((a) => [a.name, a.is_foreign_key]).slice(0, 4)).toEqual([
      ["date_key", true],
      ["ship_date_key", true],
      ["customer_key", true],
      ["product_key", true],
    ]);
    // the facts' measures (prototype cubeDemo, cubeDemoV2)
    expect(db.cube_measure!.map((m) => [name(m.attribute_id), m.additivity, m.semi_note])).toEqual([
      ["quantity", "additive", null],
      ["unit_price", "non", null],
      ["discount_pct", "non", null],
      ["net_amount", "additive", null],
      ["total_amount", "additive", null],
      ["line_count", "additive", null],
    ]);
    const canvas = db.canvas.find((c) => c.name === "Sales star")!;
    expect(db.project_canvas.find((l) => l.canvas_id === canvas.id)?.project_id).toBe(SEED_IDS.projOrderManagement);
    expect(db.canvas_item.filter((i) => i.canvas_id === canvas.id)).toHaveLength(11);
    expect(db.organization_licence.map((l) => [l.organization_id, l.module])).toEqual([[SEED_IDS.orgInfoMate, "infocube"]]);
    expect(db.workspace.filter((w) => w.infocube).map((w) => w.id)).toEqual([WS]);
  });

  it("is not in the plain seed that every earlier spec starts from", () => {
    const db = buildSeed();
    expect(db.entity.some((e) => e.model_level === "dimensional")).toBe(false);
    expect(db.organization_licence).toEqual([]);
    expect(db.workspace.some((w) => w.infocube)).toBe(false);
  });
});

describe("the pages' module view from the star (E6, E7, E13)", () => {
  let dir: string;
  let file: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "im-star-"));
    file = path.join(dir, "db.json");
    await resetDevData(file, addModuleDemoData);
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("gives every role, the Cube tab with facts then dimensions, and New fact and New dimension while on", async () => {
    const store = createLocalDataStore(file, STORE_SCHEMA);
    const [workspace, model] = await Promise.all([store.workspaces.get(WS), store.model.load(WS)]);
    const view = await moduleView(store, workspace!, model, ACTIONS);
    const db = await readDb(file);
    expect(view.roles[named(db, "Fact Sales").id]).toEqual({ text: "Fact", title: "Transaction fact (InfoCube)", card: "dimn fact", mark: "cube", coverage: "fed from the logical model", feed: FEED_WORDS });
    expect(view.roles[named(db, "Dim Date").id]).toMatchObject({ text: "Dimension", card: "dimn dimension" });
    expect(view.roles[named(db, "Customer").id]).toBeUndefined();
    expect(view.tabs.map((t) => [t.id, t.name, t.sections.map((s) => [s.title, s.entities.map((e) => e.meta)])])).toEqual([
      ["cube", "Cube", [["Facts", ["grain set", "grain set"]], ["Dimensions", ["SCD 2", "SCD 0", "SCD 1"]]]],
    ]);
    expect(view.creates.map((c) => [c.button, c.here])).toEqual([
      ["New fact", "New fact here"],
      ["New dimension", "New dimension here"],
    ]);
  });

  it("gives the Σ marks, an attribute's delete with InfoCube's rows and the module's page rows (slice 15b, R4, R5, O8)", async () => {
    const store = createLocalDataStore(file, STORE_SCHEMA);
    const [workspace, model] = await Promise.all([store.workspaces.get(WS), store.model.load(WS)]);
    const view = await moduleView(store, workspace!, model, ACTIONS);
    const attr = (entity: string, name: string) => model.attributes.find((a) => a.name === name && a.entity_id === model.entities.find((e) => e.name === entity)!.id)!.id;
    expect(Object.keys(view.rowMarks)).toHaveLength(6);
    expect(view.rowMarks[attr("Fact Sales", "quantity")]).toBe("meas add");
    expect(view.rowMarks[attr("Fact Sales", "unit_price")]).toBe("meas non");
    // slice 15c (X-3, P10): its dimensional mapping too, which the delete's toast counts
    expect(view.attributeDeletes[attr("Fact Sales", "quantity")]).toEqual({ also: ["1 measure", "1 dimensional mapping"], then: [], toast: ["1 dimensional mapping"] });
    expect(view.attributeDeletes[attr("Fact Sales", "ship_date_key")]).toEqual({ also: [], then: ["the link to Dim Date as Ship date is deleted, the relationship stays"] });
    // no measure and no key, but fed (slice 15c, X-3)
    expect(view.attributeDeletes[attr("Fact Sales", "order_number")]).toEqual({ also: ["1 dimensional mapping"], then: [], toast: ["1 dimensional mapping"] });
    expect(view.attributeDeletes[attr("Dim Date", "date_key")]).toBeUndefined();
    const rows = view.data.infocube as { cubeEntities: object[]; cubeMeasures: object[]; cubeKeys: object[] };
    expect([rows.cubeEntities.length, rows.cubeMeasures.length, rows.cubeKeys.length]).toEqual([5, 6, 6]);
    for (const r of [...rows.cubeEntities, ...rows.cubeMeasures, ...rows.cubeKeys]) expect(Object.keys(r).some((k) => k.startsWith("created_") || k.startsWith("updated_"))).toBe(false);
  });

  it("gives nothing for a workspace with InfoCube off and no facts or dimensions", async () => {
    const store = createLocalDataStore(file, STORE_SCHEMA);
    const [workspace, model] = await Promise.all([store.workspaces.get(SEED_IDS.wsBankX), store.model.load(SEED_IDS.wsBankX)]);
    expect(await moduleView(store, workspace!, model, ACTIONS)).toEqual({ roles: {}, tabs: [], creates: [], rowMarks: {}, attributeDeletes: {}, rowFeeds: {}, relationshipDeletes: {}, data: {} });
  });

  it("lists a dimension's own rows in its delete preview, each fact once (X-4)", async () => {
    // the star has two relationships between Dim Date and Fact Sales (Order date, Ship date; slice 15b): the fact is
    // listed once
    const db = await readDb(file);
    expect(db.relationship.filter((r) => r.from_entity_id === named(db, "Dim Date").id && r.to_entity_id === named(db, "Fact Sales").id)).toHaveLength(2);
    const store = createLocalDataStore(file, STORE_SCHEMA);
    const model = await store.model.load(WS);
    expect(await moduleEntityDependents(store, WS, named(db, "Dim Date").id, model)).toEqual([
      ["Dimension", "SCD type 0 deleted"],
      ["2 facts", "lose this dimension: Fact Sales, Fact Orders"],
    ]);
    expect(await moduleEntityDependents(store, WS, named(db, "Fact Sales").id, model)).toEqual([
      ["Fact", "its grain (“One order line”) deleted"],
      ["4 measures", "deleted"],
      // slice 15c (X-4)
      ["8 dimensional mappings", "deleted, 7 of them approved"],
    ]);
    // a logical entity's (slice 15c, X-2): the mappings reading its attributes and what loses its feed
    expect(await moduleEntityDependents(store, WS, named(db, "Customer").id, model)).toEqual([
      ["2 dimensional mappings", "deleted, 2 of them approved"],
      ["Dim Customer", "loses its feed from the logical model"],
    ]);
  });
});
