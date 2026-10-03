// The local adapter for the model tables (slice 1a, step 2): the demo model, reads, the data model's checks,
// domain commands applied end to end, and seed:large.

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildWriteSet, type CommandContext, type Write } from "@/domain/changes";
import { createConcept } from "@/domain/commands/concept";
import { createEntity, deleteEntity } from "@/domain/commands/entity";
import { addMappingInput, setMappingStatus } from "@/domain/commands/mapping";
import { uuidv7 } from "@/domain/ids";
import { entityImpact } from "@/domain/model/impact";
import { lastContentEditor } from "@/domain/model/mapping-rules";
import { checkMappingTypes } from "@/domain/model/type-check";
import type { WorkspaceAccess } from "@/domain/permissions";
import type { CanvasItem, Entity } from "@/domain/types";
import type { DataStore, WorkspaceModel } from "../ports";
import { seedDevData, seedLargeData } from "./dev-data";
import { readDb } from "./file";
import { buildSeed, SEED_IDS } from "./seed";
import { LARGE_IDS } from "./seed-large";
import { seedId } from "./seed-model";
import { createLocalDataStore } from "./store";

let dir: string;
let file: string;
let store: DataStore;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "infomapper-model-"));
  file = path.join(dir, "dev-db.json");
  await seedDevData(file);
  store = createLocalDataStore(file);
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const RETAIL = SEED_IDS.wsRetailDwh;
const ctxFor = (actorId: string): CommandContext => ({ actorId, now: new Date().toISOString(), newId: () => uuidv7() });

async function accessAs(userId: string, workspaceId: string = RETAIL): Promise<WorkspaceAccess> {
  return { workspace: (await store.workspaces.get(workspaceId))!, member: await store.workspaces.getMember(workspaceId, userId) };
}

const byName = <R extends { name: string }>(rows: readonly R[], name: string): R => {
  const row = rows.find((r) => r.name === name);
  if (!row) throw new Error(name);
  return row;
};

function attributesOf(m: WorkspaceModel, entityName: string) {
  const e = byName(m.entities, entityName);
  return m.attributes.filter((a) => a.entity_id === e.id);
}

describe("demo model (slice 1a PRD, demo data)", () => {
  it("Retail Co – DWH has the prototype's concepts, entities, attributes, sources, mappings and relationships", async () => {
    const m = await store.model.load(RETAIL);
    expect(m.concepts.map((c) => c.name)).toEqual(["Customer", "Sales", "Product", "Reference data"]);
    expect(m.entities.map((e) => e.name).sort()).toEqual(["Country", "Customer", "Customer Address", "Order Line", "Product", "Sales Order"]);
    expect(attributesOf(m, "Customer").map((a) => a.name)).toEqual([
      "customer_id", "customer_number", "first_name", "last_name", "email", "birth_date", "segment_code", "created_at",
    ]);
    expect(attributesOf(m, "Customer")[0]).toMatchObject({ is_primary_key: true, is_nullable: false, data_type: "integer" });
    expect(attributesOf(m, "Customer").filter((a) => a.is_pii).map((a) => a.name)).toEqual(["first_name", "last_name", "email", "birth_date"]);
    expect(byName(m.entities, "Order Line")).toMatchObject({ stereotype: "link" });
    expect(byName(m.entities, "Customer")).toMatchObject({ definition_text: "A person or organisation that buys from us.", definition_html: "<p>A person or organisation that buys from us.</p>" });

    expect(m.sourceSystems.map((s) => s.name)).toEqual(["CRM", "ERP", "WEB"]);
    expect(m.sourceTables.map((t) => t.name).sort()).toEqual(["customer_addresses", "customers", "items", "order_header", "order_line", "web_users"]);
    const header = byName(m.sourceTables, "order_header");
    const headerCols = m.sourceColumns.filter((c) => c.source_table_id === header.id);
    expect(headerCols.map((c) => c.name)).toEqual(["ord_id", "ord_no", "cust_ref", "ord_dt", "ord_total", "curr", "ord_status"]);
    expect(byName(headerCols, "ord_total")).toMatchObject({ data_type: "decimal", type_precision: 12, type_scale: 2 });
    expect(byName(headerCols, "ord_no")).toMatchObject({ is_business_key: true, data_type: "varchar", type_length: 20 });
    expect(m.sourceColumns.filter((c) => c.is_business_key).map((c) => c.name).sort()).toEqual(["cust_no", "cust_no", "item_code", "ord_no"]);

    expect(m.mappings).toHaveLength(14);
    expect(m.mappingInputs).toHaveLength(14);
    const count = (s: string) => m.mappings.filter((x) => x.status === s).length;
    expect([count("approved"), count("review"), count("draft")]).toEqual([9, 2, 3]);
    expect(m.mappings.filter((x) => x.kind === "transform").map((x) => x.rule_expression).sort()).toEqual([
      "CAST(created_ts AS date)",
      "Decode with the ERP status dictionary (ref.order_status)",
    ]);
    expect(m.mappings.filter((x) => x.status === "approved").every((x) => x.approved_by === SEED_IDS.userPiotr && x.approved_at)).toBe(true);
    expect(m.relationships).toHaveLength(5);
  });

  it("has exactly the prototype's one type problem: item_code varchar(30) into Order Line.product_id integer", async () => {
    const m = await store.model.load(RETAIL);
    const problems = m.mappings.filter((x) => {
      const attribute = m.attributes.find((a) => a.id === x.attribute_id)!;
      const columns = m.mappingInputs.filter((i) => i.mapping_id === x.id).map((i) => m.sourceColumns.find((c) => c.id === i.source_column_id)!);
      return !checkMappingTypes(x, attribute, columns).ok;
    });
    expect(problems.map((x) => x.attribute_id)).toEqual([seedId(RETAIL, "attribute:line.product_id")]);
  });

  it("places the cards on the two canvases at the prototype's positions, without frames", async () => {
    const m = await store.model.load(RETAIL);
    const main = await store.canvasItems.listOfCanvas(RETAIL, SEED_IDS.canvasCustomerOrders);
    const lines = await store.canvasItems.listOfCanvas(RETAIL, SEED_IDS.canvasOrderLines);
    expect(main).toHaveLength(7);
    expect(lines).toHaveLength(4);
    const customerCard = main.find((i) => i.entity_id === byName(m.entities, "Customer").id);
    expect(customerCard).toMatchObject({ x: 496, y: 40, collapsed: false, row_filter: "all", frame_id: null, width: null });
    const ordline = main.find((i) => i.source_table_id === byName(m.sourceTables, "order_line").id);
    expect(ordline).toMatchObject({ x: 1176, y: 600 });
  });

  it("gives Customer the impact S1A-10 expects: 8 attributes, its mappings, 2 relationships, one canvas in two projects", async () => {
    const m = await store.model.load(RETAIL);
    const customer = byName(m.entities, "Customer");
    const impact = entityImpact(
      { entity: customer, ...m, canvasItems: await store.canvasItems.list(RETAIL) },
      {
        canvases: await store.canvases.list(RETAIL),
        projects: await store.projects.list(RETAIL),
        projectCanvases: await store.canvases.listLinksOfCanvas(RETAIL, SEED_IDS.canvasCustomerOrders),
      },
    );
    expect(impact).toMatchObject({ attributes: 8, mappings: 8, approvedMappings: 5, relationships: 2 });
    expect(impact.canvases.map((c) => c.name)).toEqual(["Customer & orders"]);
    expect(impact.projects.map((p) => p.name)).toEqual(["Customer 360", "Order management"]);
  });

  it("gives Sales analytics the same model and the cards of “Customer & orders”, and leaves Bank X empty", async () => {
    const sales = await store.model.load(SEED_IDS.wsSales);
    expect(sales.entities).toHaveLength(6);
    expect(sales.mappings).toHaveLength(14);
    expect(sales.mappings.find((x) => x.status === "approved")).toMatchObject({ created_by: SEED_IDS.userMarek, approved_by: SEED_IDS.userLukasz });
    const retailCards = await store.canvasItems.listOfCanvas(RETAIL, SEED_IDS.canvasCustomerOrders);
    const salesCards = await store.canvasItems.listOfCanvas(SEED_IDS.wsSales, SEED_IDS.canvasSalesFirst);
    const place = (items: CanvasItem[], m: WorkspaceModel) =>
      items
        .map((i) => `${i.entity_id ? m.entities.find((e) => e.id === i.entity_id)!.name : m.sourceTables.find((t) => t.id === i.source_table_id)!.name} ${i.x},${i.y}`)
        .sort();
    expect(place(salesCards, sales)).toEqual(place(retailCards, await store.model.load(RETAIL)));
    expect(salesCards).toHaveLength(7);
    // Different rows: ids are derived per workspace.
    expect(sales.entities.map((e) => e.id)).not.toContain(seedId(RETAIL, "entity:customer"));

    const bank = await store.model.load(SEED_IDS.wsBankX);
    expect(Object.values(bank).every((rows) => rows.length === 0)).toBe(true);
  });

  it("keeps the same ids on every seed", () => {
    const a = buildSeed(new Date("2026-01-01T00:00:00Z"));
    const b = buildSeed(new Date("2026-06-01T00:00:00Z"));
    expect(a.entity.map((e) => e.id)).toEqual(b.entity.map((e) => e.id));
    expect(a.mapping.map((e) => e.id)).toEqual(b.mapping.map((e) => e.id));
    expect(a.entity.find((e) => e.workspace_id === RETAIL && e.name === "Customer")!.id).toBe(seedId(RETAIL, "entity:customer"));
  });
});

describe("reads", () => {
  it("filter on the workspace and hide soft-deleted rows", async () => {
    const m = await store.model.load(RETAIL);
    const country = byName(m.entities, "Country");
    const ctx = ctxFor(SEED_IDS.userAnna);
    const gone: Entity = { ...country, deleted_at: ctx.now, version: 2 };
    expect(await store.apply(buildWriteSet(ctx, RETAIL, [{ kind: "update", table: "entity", before: country, row: gone }]))).toEqual({ ok: true });
    expect((await store.model.load(RETAIL)).entities.map((e) => e.name)).not.toContain("Country");
    expect((await store.model.load(SEED_IDS.wsSales)).entities.map((e) => e.name)).toContain("Country");
    expect(await store.canvasItems.get(SEED_IDS.wsSales, (await store.canvasItems.list(RETAIL))[0]!.id)).toBeNull();
  });
});

describe("domain commands applied through the adapter", () => {
  it("“+” on a concept: a new concept, an entity in it and its card, then read back", async () => {
    const anna = SEED_IDS.userAnna;
    const access = await accessAs(anna);
    const concept = createConcept(ctxFor(anna), access, { concepts: (await store.model.load(RETAIL)).concepts }, { name: "Finance" });
    if (!concept.ok) throw new Error(concept.error.message);
    expect(await store.apply(concept.writeSet)).toEqual({ ok: true });

    const m = await store.model.load(RETAIL);
    const entity = createEntity(ctxFor(anna), access, {
      concept: byName(m.concepts, "Finance"),
      entities: m.entities,
      canvas: await store.canvases.get(RETAIL, SEED_IDS.canvasCustomerOrders),
    }, { conceptId: concept.value.conceptId, placement: { canvasId: SEED_IDS.canvasCustomerOrders, x: 900, y: 40 } });
    if (!entity.ok) throw new Error(entity.error.message);
    expect(await store.apply(entity.writeSet)).toEqual({ ok: true });

    const after = await store.model.load(RETAIL);
    expect(byName(after.concepts, "Finance")).toMatchObject({ color: "#B7791F", sort_order: 4 });
    expect(byName(after.entities, "New entity")).toMatchObject({ concept_id: concept.value.conceptId });
    expect(await store.canvasItems.get(RETAIL, entity.value.canvasItemId!)).toMatchObject({ x: 900, y: 40 });
    const events = await store.changeEvents.list(RETAIL);
    expect(events.filter((e) => e.change_group_id === entity.writeSet.changeGroupId).map((e) => e.object_type)).toEqual(["entity", "canvas_item"]);
  });

  it("deleting Customer removes it, its attributes, mappings, inputs, relationships and cards everywhere (D-47)", async () => {
    const anna = SEED_IDS.userAnna;
    const m = await store.model.load(RETAIL);
    const customer = byName(m.entities, "Customer");
    const r = deleteEntity(ctxFor(anna), await accessAs(anna), { ...m, entity: customer, canvasItems: await store.canvasItems.list(RETAIL) }, {
      entityId: customer.id,
      expectedVersion: 1,
    });
    if (!r.ok) throw new Error(r.error.message);
    expect(await store.apply(r.writeSet)).toEqual({ ok: true });

    const after = await store.model.load(RETAIL);
    expect(after.entities.map((e) => e.name)).not.toContain("Customer");
    expect(after.attributes).toHaveLength(m.attributes.length - 8);
    expect(after.mappings).toHaveLength(m.mappings.length - 8);
    expect(after.mappingInputs).toHaveLength(m.mappingInputs.length - 8);
    expect(after.relationships).toHaveLength(3);
    expect(await store.canvasItems.listOfCanvas(RETAIL, SEED_IDS.canvasCustomerOrders)).toHaveLength(6);
    expect(new Set((await store.changeEvents.list(RETAIL)).map((e) => e.change_group_id)).size).toBe(1);
  });

  it("refuses a command built on a version someone else changed meanwhile", async () => {
    const anna = SEED_IDS.userAnna;
    const m = await store.model.load(RETAIL);
    const customer = byName(m.entities, "Customer");
    const state = { ...m, entity: customer, canvasItems: await store.canvasItems.list(RETAIL) };
    const first = deleteEntity(ctxFor(anna), await accessAs(anna), state, { entityId: customer.id, expectedVersion: 1 });
    const second = deleteEntity(ctxFor(anna), await accessAs(anna), state, { entityId: customer.id, expectedVersion: 1 });
    if (!first.ok || !second.ok) throw new Error("expected both to build");
    expect(await store.apply(first.writeSet)).toEqual({ ok: true });
    expect(await store.apply(second.writeSet)).toMatchObject({ ok: false, error: { code: "stale_version" } });
  });

  it("four-eyes in Sales analytics: the change log names Łukasz as the author of his new input, so he cannot approve", async () => {
    const lukasz = SEED_IDS.userLukasz;
    const marek = SEED_IDS.userMarek;
    const m = await store.model.load(SEED_IDS.wsSales);
    const target = m.mappings.find((x) => x.status === "draft" && x.kind === "direct")!;
    const column = m.sourceColumns.find((c) => c.name === "cust_ref")!;
    // Marek (owner) adds an input; then the author is Marek and he may not approve, Łukasz (reviewer) may.
    const added = addMappingInput(ctxFor(marek), await accessAs(marek, SEED_IDS.wsSales), {
      mapping: target,
      inputs: m.mappingInputs,
      column,
    }, { mappingId: target.id, expectedVersion: 1, sourceColumnId: column.id, ruleExpression: "COALESCE(a, b)" });
    if (!added.ok) throw new Error(added.error.message);
    expect(await store.apply(added.writeSet)).toEqual({ ok: true });

    const events = await store.changeEvents.listForMapping(SEED_IDS.wsSales, target.id);
    expect(events.map((e) => e.object_type).sort()).toEqual(["mapping", "mapping_input"]);
    const mapping = (await store.model.load(SEED_IDS.wsSales)).mappings.find((x) => x.id === target.id)!;
    const author = lastContentEditor(mapping, events);
    expect(author).toBe(marek);

    const byMarek = setMappingStatus(ctxFor(marek), await accessAs(marek, SEED_IDS.wsSales), { mapping, contentAuthorId: author }, {
      mappingId: mapping.id,
      expectedVersion: mapping.version,
      status: "approved",
    });
    expect(byMarek).toMatchObject({ ok: false, error: { code: "forbidden" } });
    const byLukasz = setMappingStatus(ctxFor(lukasz), await accessAs(lukasz, SEED_IDS.wsSales), { mapping, contentAuthorId: author }, {
      mappingId: mapping.id,
      expectedVersion: mapping.version,
      status: "approved",
    });
    if (!byLukasz.ok) throw new Error(byLukasz.error.message);
    expect(await store.apply(byLukasz.writeSet)).toEqual({ ok: true });
  });
});

describe("the data model's checks on the model tables", () => {
  const anna = SEED_IDS.userAnna;
  const apply = (writes: Write[]) => store.apply(buildWriteSet(ctxFor(anna), RETAIL, writes));
  const std = () => {
    const now = new Date().toISOString();
    return { id: uuidv7(), workspace_id: RETAIL, version: 1, created_at: now, created_by: anna, updated_at: now, updated_by: anna, deleted_at: null };
  };
  const card = (over: Partial<CanvasItem>): CanvasItem => ({
    ...std(),
    canvas_id: SEED_IDS.canvasOrderLines,
    entity_id: null,
    source_table_id: null,
    requirement_id: null,
    x: 0,
    y: 0,
    width: null,
    collapsed: false,
    row_filter: "all",
    frame_id: null,
    live_level: null,
    ...over,
  });

  it("canvas_item: exactly one target", async () => {
    const m = await store.model.load(RETAIL);
    const customer = byName(m.entities, "Customer").id;
    const items = byName(m.sourceTables, "items").id;
    expect(await apply([{ kind: "insert", table: "canvas_item", row: card({ entity_id: customer, source_table_id: items }) }])).toMatchObject({
      ok: false,
      error: { code: "invalid", message: expect.stringContaining("canvas_item_one_target_ck") },
    });
    expect(await apply([{ kind: "insert", table: "canvas_item", row: card({}) }])).toMatchObject({ ok: false, error: { code: "invalid" } });
    expect(await apply([{ kind: "insert", table: "canvas_item", row: card({ entity_id: customer }) }])).toEqual({ ok: true });
  });

  it("canvas_item: one live card per element and canvas", async () => {
    const m = await store.model.load(RETAIL);
    const product = byName(m.entities, "Product").id;
    expect(await apply([{ kind: "insert", table: "canvas_item", row: card({ entity_id: product }) }])).toMatchObject({ ok: false, error: { code: "conflict" } });
    expect(await apply([{ kind: "insert", table: "canvas_item", row: card({ entity_id: product, canvas_id: SEED_IDS.canvasCustomerOrders }) }])).toEqual({ ok: true });
  });

  it("canvas_item: width between 200 and 600, known row filters", async () => {
    const product = byName((await store.model.load(RETAIL)).entities, "Customer").id;
    expect(await apply([{ kind: "insert", table: "canvas_item", row: card({ entity_id: product, width: 120 }) }])).toMatchObject({ ok: false, error: { code: "invalid" } });
    expect(await apply([{ kind: "insert", table: "canvas_item", row: { ...card({ entity_id: product }), row_filter: "some" as "all" } }])).toMatchObject({
      ok: false,
      error: { code: "invalid" },
    });
  });

  it("source_system: unique name among live rows", async () => {
    const m = await store.model.load(RETAIL);
    const crm = byName(m.sourceSystems, "CRM");
    expect(await apply([{ kind: "insert", table: "source_system", row: { ...std(), name: "CRM", description: null } }])).toMatchObject({
      ok: false,
      error: { code: "conflict" },
    });
    // Another workspace may use the name; after a soft delete it is free again.
    expect(await apply([{ kind: "update", table: "source_system", before: crm, row: { ...crm, version: 2, deleted_at: new Date().toISOString() } }])).toEqual({ ok: true });
    expect(await apply([{ kind: "insert", table: "source_system", row: { ...std(), name: "CRM", description: null } }])).toEqual({ ok: true });
  });

  it("source_column: unique name per table; mapping_input: a column once per mapping", async () => {
    const m = await store.model.load(RETAIL);
    const col = m.sourceColumns[0]!;
    expect(await apply([{ kind: "insert", table: "source_column", row: { ...col, ...std(), source_table_id: col.source_table_id } }])).toMatchObject({
      ok: false,
      error: { code: "conflict" },
    });
    const input = m.mappingInputs[0]!;
    expect(await apply([{ kind: "insert", table: "mapping_input", row: { ...input, ...std(), sort_order: 1 } }])).toMatchObject({ ok: false, error: { code: "conflict" } });
  });

  it("value lists and the attribute type rules", async () => {
    const m = await store.model.load(RETAIL);
    const e = m.entities[0]!;
    expect(await apply([{ kind: "update", table: "entity", before: e, row: { ...e, version: 2, stereotype: "hub" as "object" } }])).toMatchObject({ ok: false, error: { code: "invalid" } });
    const a = m.attributes[0]!;
    expect(await apply([{ kind: "update", table: "attribute", before: a, row: { ...a, version: 2, data_type: "custom" } }])).toMatchObject({
      ok: false,
      error: { message: expect.stringContaining("attribute_custom_type_ck") },
    });
    expect(await apply([{ kind: "update", table: "attribute", before: a, row: { ...a, version: 2, type_scale: 2 } }])).toMatchObject({
      ok: false,
      error: { message: expect.stringContaining("attribute_type_params_ck") },
    });
  });

  it("mapping: a transform needs a rule, approved needs approved_at", async () => {
    const m = await store.model.load(RETAIL);
    const draft = m.mappings.find((x) => x.status === "draft" && x.kind === "direct")!;
    expect(await apply([{ kind: "update", table: "mapping", before: draft, row: { ...draft, version: 2, kind: "transform" } }])).toMatchObject({
      ok: false,
      error: { message: expect.stringContaining("mapping_rule_ck") },
    });
    expect(await apply([{ kind: "update", table: "mapping", before: draft, row: { ...draft, version: 2, status: "approved" } }])).toMatchObject({
      ok: false,
      error: { message: expect.stringContaining("mapping_approval_ck") },
    });
  });

  it("foreign keys: an attribute of an entity that does not exist", async () => {
    const a = (await store.model.load(RETAIL)).attributes[0]!;
    expect(await apply([{ kind: "insert", table: "attribute", row: { ...a, ...std(), entity_id: uuidv7() } }])).toMatchObject({ ok: false, error: { code: "not_found" } });
  });

  it("writes nothing when one row of a write set breaks a rule", async () => {
    const m = await store.model.load(RETAIL);
    const e = m.entities[0]!;
    const result = await apply([
      { kind: "update", table: "entity", before: e, row: { ...e, version: 2, name: "Renamed" } },
      { kind: "insert", table: "concept", row: { ...std(), name: "Bad", description_html: null, description_text: null, color: "blue", sort_order: 9 } },
    ]);
    expect(result).toMatchObject({ ok: false });
    expect((await store.model.load(RETAIL)).entities.find((x) => x.id === e.id)!.name).toBe(e.name);
    expect(await store.changeEvents.list(RETAIL)).toEqual([]);
  });
});

describe("file format", () => {
  it("refuses a slice 0 file and says how to fix it", async () => {
    await writeFile(file, JSON.stringify({ ...(await readDb(file)), format: 1 }), "utf8");
    await expect(store.model.load(RETAIL)).rejects.toThrow('Run "npm run reset-dev-data"');
  });
});

describe("seed:large (S1A-14)", () => {
  it("adds “Performance test” for Łukasz with the spike's data set on one canvas, once", async () => {
    expect(await seedLargeData(file)).toBe("created");
    expect(await seedLargeData(file)).toBe("exists");
    const ws = LARGE_IDS.workspace;
    expect(await store.workspaces.getMember(ws, SEED_IDS.userLukasz)).toMatchObject({ role: "owner" });
    const m = await store.model.load(ws);
    expect(m.sourceTables).toHaveLength(60);
    expect(m.entities).toHaveLength(41);
    expect(attributesOf(m, "Wide Customer Profile")).toHaveLength(200);
    expect(m.mappings).toHaveLength(300);
    expect(m.relationships).toHaveLength(40);
    expect(await store.canvasItems.listOfCanvas(ws, LARGE_IDS.canvas)).toHaveLength(101);
    // The demo workspaces are untouched.
    expect((await store.model.load(RETAIL)).entities).toHaveLength(6);
  });

  it("seeds the demo data first when there is no file", async () => {
    const other = path.join(dir, "fresh.json");
    expect(await seedLargeData(other)).toBe("created");
    const db = await readDb(other);
    expect(db.workspace.map((w) => w.name)).toContain("Retail Co – DWH");
    expect(db.workspace.map((w) => w.name)).toContain("Performance test");
  });
});
