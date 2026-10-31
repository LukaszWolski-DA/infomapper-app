// The local adapter for the model tables (slice 1a, step 2): the demo model, reads, the data model's checks,
// domain commands applied end to end, and seed:large. Frames since slice 2b.

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildWriteSet, type CommandContext, type Write } from "@/domain/changes";
import { pasteAttribute, updateAttribute } from "@/domain/commands/attribute";
import { createConcept } from "@/domain/commands/concept";
import { revertChangeGroup } from "@/domain/commands/undo";
import { createEntity, deleteEntity } from "@/domain/commands/entity";
import { createFrame } from "@/domain/commands/frame";
import { addMappingInput, setMappingStatus } from "@/domain/commands/mapping";
import { uuidv7 } from "@/domain/ids";
import { indexOf } from "@/domain/model/classifications";
import { frameOfCard } from "@/domain/model/frames";
import { noteFrameAt } from "@/domain/model/notes";
import { buildRequirementIndex } from "@/domain/model/requirement-index";
import { entityImpact } from "@/domain/model/impact";
import { lastContentEditor } from "@/domain/model/mapping-rules";
import { checkMappingTypes } from "@/domain/model/type-check";
import type { WorkspaceAccess } from "@/domain/permissions";
import type { CanvasItem, Entity, Frame } from "@/domain/types";
import type { DataStore, WorkspaceModel } from "../ports";
import { seedDevData, seedLargeData } from "./dev-data";
import { readDb } from "./file";
import { buildSeed, SEED_IDS } from "./seed";
import { LARGE_IDS, LARGE_LIVE_LABEL } from "./seed-large";
import { liveMembership } from "@/domain/model/live";
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
    expect(byName(headerCols, "ord_no")).toMatchObject({ data_type: "varchar", type_length: 20 });
    // slice 7c: the prototype's BK flags are Business key links, the 19 built-in classifications are there
    const classes = indexOf(m);
    expect(m.classifications.filter((c) => c.deleted_at === null)).toHaveLength(19);
    expect(m.sourceColumns.filter((c) => classes.has(c.id, "BK")).map((c) => c.name).sort()).toEqual(["cust_no", "cust_no", "item_code", "ord_no"]);
    expect(m.sourceColumns.filter((c) => classes.has(c.id, "PII")).map((c) => c.name).sort()).toEqual(["dob", "email", "email_addr", "fname", "lname", "street_line1"]);

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

  it("has exactly the prototype's two type problems: item_code into Order Line.product_id, web_users.email into Customer.email", async () => {
    // the second since slice 7a gave Customer.email its length 120 (step 1, answer 10): varchar(255) no longer fits
    const m = await store.model.load(RETAIL);
    const problems = m.mappings.filter((x) => {
      const attribute = m.attributes.find((a) => a.id === x.attribute_id)!;
      const columns = m.mappingInputs.filter((i) => i.mapping_id === x.id).map((i) => m.sourceColumns.find((c) => c.id === i.source_column_id)!);
      return !checkMappingTypes(x, attribute, columns).ok;
    });
    expect(problems.map((x) => x.attribute_id).sort()).toEqual([seedId(RETAIL, "attribute:customer.email"), seedId(RETAIL, "attribute:line.product_id")].sort());
    expect(problems.find((x) => x.attribute_id === seedId(RETAIL, "attribute:customer.email"))!.status).toBe("draft");
  });

  it("has the prototype's attribute lengths, two source relationships and datetime2(7) (slice 7a, answer 10, step 6)", async () => {
    const m = await store.model.load(RETAIL);
    const customer = byName(m.entities, "Customer");
    const length = (name: string) => m.attributes.find((a) => a.entity_id === customer.id && a.name === name)!.type_length;
    expect([length("email"), length("first_name"), length("last_name"), length("segment_code"), length("customer_number")]).toEqual([120, 50, 50, 3, null]);
    const tableOf = (id: string) => m.sourceTables.find((t) => t.id === id)!.name;
    expect(m.sourceRelationships.map((r) => `${r.name}: ${tableOf(r.source_table_id)} → ${tableOf(r.to_source_table_id)}`).sort()).toEqual([
      "FK_customer_addresses_customers: customer_addresses → customers",
      "FK_order_line_order_header: order_line → order_header",
    ]);
    expect(m.sourceRelationshipColumns).toHaveLength(2);
    expect(await store.model.listImports(RETAIL)).toEqual([]); // "not imported yet" (item 41)
    const created = m.sourceColumns.find((c) => c.name === "created_ts")!;
    expect([created.data_type, created.type_precision]).toEqual(["datetime2", 7]);
  });

  it("places the cards on the two canvases at the prototype's positions, without frames", async () => {
    const m = await store.model.load(RETAIL);
    // the entity and table cards; REQ-104's requirement card besides them since slice 4b-2
    const all = await store.canvasItems.listOfCanvas(RETAIL, SEED_IDS.canvasCustomerOrders);
    const main = all.filter((i) => i.requirement_id === null);
    const lines = await store.canvasItems.listOfCanvas(RETAIL, SEED_IDS.canvasOrderLines);
    expect(main).toHaveLength(7);
    expect(all).toHaveLength(8);
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
        requirements: buildRequirementIndex(await store.requirements.list(RETAIL), await store.requirements.listLinks(RETAIL), m),
      },
    );
    expect(impact).toMatchObject({ attributes: 8, mappings: 8, approvedMappings: 5, relationships: 2 });
    // slice 4a: the requirements whose scope contains Customer
    expect(impact.requirements.map((r) => r.key)).toEqual(["REQ-101", "REQ-102", "REQ-103", "REQ-105"]);
    expect(impact.canvases.map((c) => c.name)).toEqual(["Customer & orders"]);
    expect(impact.projects.map((p) => p.name)).toEqual(["Customer 360", "Order management"]);
  });

  it("gives Sales analytics the same model and the cards of “Customer & orders”, and leaves Bank X empty", async () => {
    const sales = await store.model.load(SEED_IDS.wsSales);
    expect(sales.entities).toHaveLength(6);
    expect(sales.mappings).toHaveLength(14);
    expect(sales.mappings.find((x) => x.status === "approved")).toMatchObject({ created_by: SEED_IDS.userMarek, approved_by: SEED_IDS.userLukasz });
    // the entity and table cards (REQ-104's card is Retail Co's own, slice 4b-2: Sales analytics has no requirements)
    const retailCards = (await store.canvasItems.listOfCanvas(RETAIL, SEED_IDS.canvasCustomerOrders)).filter((i) => i.requirement_id === null);
    const salesCards = await store.canvasItems.listOfCanvas(SEED_IDS.wsSales, SEED_IDS.canvasSalesFirst);
    const place = (items: CanvasItem[], m: WorkspaceModel) =>
      items
        .map((i) => `${i.entity_id ? m.entities.find((e) => e.id === i.entity_id)!.name : m.sourceTables.find((t) => t.id === i.source_table_id)!.name} ${i.x},${i.y}`)
        .sort();
    expect(place(salesCards, sales)).toEqual(place(retailCards, await store.model.load(RETAIL)));
    expect(salesCards).toHaveLength(7);
    // Different rows: ids are derived per workspace.
    expect(sales.entities.map((e) => e.id)).not.toContain(seedId(RETAIL, "entity:customer"));

    // Bank X: no model, only its built-in classification list (slice 7c)
    const bank = await store.model.load(SEED_IDS.wsBankX);
    expect(Object.entries(bank).every(([k, rows]) => k === "classifications" || rows.length === 0)).toBe(true);
    expect(bank.classifications).toHaveLength(19);
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
    expect((await store.canvasItems.listOfCanvas(RETAIL, SEED_IDS.canvasCustomerOrders)).filter((i) => i.requirement_id === null)).toHaveLength(6);
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

  it("canvas_item: a requirement card, one live card per requirement and canvas (slice 4b-2)", async () => {
    const req = (await store.requirements.list(RETAIL)).find((r) => r.key === "REQ-101")!.id;
    expect(await apply([{ kind: "insert", table: "canvas_item", row: card({ requirement_id: req }) }])).toEqual({ ok: true });
    expect(await apply([{ kind: "insert", table: "canvas_item", row: card({ requirement_id: req }) }])).toMatchObject({ ok: false, error: { code: "conflict" } });
    expect(await apply([{ kind: "insert", table: "canvas_item", row: card({ requirement_id: req, canvas_id: SEED_IDS.canvasCustomerOrders }) }])).toEqual({ ok: true });
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

describe("frames (slice 2b)", () => {
  const anna = SEED_IDS.userAnna;
  const apply = (writes: Write[]) => store.apply(buildWriteSet(ctxFor(anna), RETAIL, writes));
  const now = new Date().toISOString();
  const frameRow = (over: Partial<Frame> = {}): Frame => ({
    id: uuidv7(),
    workspace_id: RETAIL,
    version: 1,
    created_at: now,
    created_by: anna,
    updated_at: now,
    updated_by: anna,
    deleted_at: null,
    canvas_id: SEED_IDS.canvasCustomerOrders,
    name: "Area",
    kind: "free",
    concept_id: null,
    source_system_id: null,
    color: "#7C8998",
    x: 0,
    y: 0,
    width: 400,
    height: 300,
    collapsed: false,
    ...over,
  });

  it("frame: a concept frame has a concept, a source frame a system, a free frame neither (frame_ref_ck)", async () => {
    const m = await store.model.load(RETAIL);
    const concept = m.concepts[0]!.id;
    const system = m.sourceSystems[0]!.id;
    const refused = { ok: false, error: { code: "invalid", message: expect.stringContaining("frame_ref_ck") } };
    expect(await apply([{ kind: "insert", table: "frame", row: frameRow({ kind: "concept" }) }])).toMatchObject(refused);
    expect(await apply([{ kind: "insert", table: "frame", row: frameRow({ concept_id: concept }) }])).toMatchObject(refused);
    expect(await apply([{ kind: "insert", table: "frame", row: frameRow({ kind: "source_system", source_system_id: system, concept_id: concept }) }])).toMatchObject(refused);
    expect(await apply([{ kind: "insert", table: "frame", row: frameRow({ kind: "area" as "free" }) }])).toMatchObject({ ok: false, error: { message: expect.stringContaining("frame_kind_ck") } });
    expect(await apply([{ kind: "insert", table: "frame", row: frameRow({ width: 0 }) }])).toMatchObject({ ok: false, error: { message: expect.stringContaining("frame_size_ck") } });
    expect(await apply([{ kind: "insert", table: "frame", row: frameRow({ kind: "concept", concept_id: concept, color: null }) }])).toEqual({ ok: true });
    expect(await apply([{ kind: "insert", table: "frame", row: frameRow({ kind: "source_system", source_system_id: system, color: null }) }])).toEqual({ ok: true });
  });

  it("frame: refers to a canvas and a concept that exist", async () => {
    expect(await apply([{ kind: "insert", table: "frame", row: frameRow({ canvas_id: uuidv7() }) }])).toMatchObject({ ok: false, error: { code: "not_found" } });
    expect(await apply([{ kind: "insert", table: "frame", row: frameRow({ kind: "concept", concept_id: uuidv7() }) }])).toMatchObject({ ok: false, error: { code: "not_found" } });
  });

  it("canvas_item: its frame exists and is on the card's canvas (the rule the SQL cannot express)", async () => {
    const elsewhere = frameRow({ canvas_id: SEED_IDS.canvasOrderLines });
    const here = frameRow();
    expect(await apply([{ kind: "insert", table: "frame", row: elsewhere }, { kind: "insert", table: "frame", row: here }])).toEqual({ ok: true });
    const card = (await store.canvasItems.listOfCanvas(RETAIL, SEED_IDS.canvasCustomerOrders))[0]!;
    const into = (frameId: string) => apply([{ kind: "update", table: "canvas_item", before: card, row: { ...card, version: card.version + 1, frame_id: frameId } }]);
    expect(await into(elsewhere.id)).toMatchObject({ ok: false, error: { code: "invalid", message: expect.stringContaining("canvas_item_frame_on_canvas") } });
    expect(await into(uuidv7())).toMatchObject({ ok: false, error: { code: "not_found" } });
    expect(await into(here.id)).toEqual({ ok: true });
  });

  it("a frame drawn through the domain is read back with the card it took, and is part of the undo rows", async () => {
    const access = await accessAs(anna);
    const canvas = (await store.canvases.get(RETAIL, SEED_IDS.canvasCustomerOrders))!;
    const items = await store.canvasItems.listOfCanvas(RETAIL, canvas.id);
    const first = [...items].sort((a, b) => a.x - b.x || a.y - b.y)[0]!;
    const r = createFrame(ctxFor(anna), access, { canvas, frames: [], items }, {
      canvasId: canvas.id,
      x: first.x - 32,
      y: first.y - 40,
      width: 256 + 64,
      height: 2000,
      cards: items.map((i) => ({ canvasItemId: i.id, expectedVersion: i.version, height: 200 })),
    });
    if (!r.ok) throw new Error(r.error.message);
    expect(await store.apply(r.writeSet)).toEqual({ ok: true });
    expect(await store.frames.listOfCanvas(RETAIL, canvas.id)).toMatchObject([{ id: r.value.frameId, name: "New frame", kind: "free" }]);
    expect(await store.frames.listOfCanvas(RETAIL, SEED_IDS.canvasOrderLines)).toEqual([]);
    expect((await store.canvasItems.get(RETAIL, first.id))!.frame_id).toBe(r.value.frameId);
    expect((await store.model.loadForUndo(RETAIL)).frame).toHaveLength(1);
  });
});

describe("file format", () => {
  it("refuses a slice 0 file and says how to fix it", async () => {
    await writeFile(file, JSON.stringify({ ...(await readDb(file)), format: 1 }), "utf8");
    await expect(store.model.load(RETAIL)).rejects.toThrow('Run "npm run reset-dev-data"');
  });

  it("reads a slice 1a to 2p file (format 2) as one without frames", async () => {
    const old: Record<string, unknown> = { ...(await readDb(file)), format: 2 };
    delete old.frame;
    await writeFile(file, JSON.stringify(old), "utf8");
    expect(await store.frames.list(RETAIL)).toEqual([]);
    expect((await store.model.load(RETAIL)).entities).toHaveLength(6);
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
    const cards = await store.canvasItems.listOfCanvas(ws, LARGE_IDS.canvas);
    expect(cards).toHaveLength(101);
    // The spike's 8 frames, as free frames; every card is in the frame the header-middle rule gives (D-05).
    const frames = await store.frames.listOfCanvas(ws, LARGE_IDS.canvas);
    expect(frames).toHaveLength(8);
    expect(frames.every((f) => f.kind === "free")).toBe(true);
    for (const c of cards) expect(c.frame_id).toBe(frameOfCard(frames, { x: c.x, y: c.y, width: c.width ?? 256 })?.id ?? null);
    expect(cards.filter((c) => c.frame_id).length).toBeGreaterThanOrEqual(8 * 6);
    // Labels and notes (slice 3a, S3A-14): labels on 50 rows and 30 mappings, at least 20 notes, half of them pinned.
    const wl = await readDb(file);
    const links = wl.label_link.filter((l) => l.workspace_id === ws);
    expect(links.filter((l) => l.attribute_id || l.source_column_id)).toHaveLength(50);
    expect(links.filter((l) => l.mapping_id)).toHaveLength(30);
    const notes = wl.note.filter((n) => n.canvas_id === LARGE_IDS.canvas);
    expect(notes.length).toBeGreaterThanOrEqual(20);
    expect(notes.filter((n) => n.pin_canvas_item_id || n.pin_frame_id).length).toBe(notes.length / 2);
    expect(notes.filter((n) => n.frame_id).length).toBeGreaterThan(0);
    expect(notes.some((n) => n.status === "resolved")).toBe(true);
    // free notes belong to the frame the drop rule gives
    for (const n of notes.filter((n) => !n.pin_canvas_item_id && !n.pin_frame_id)) expect(n.frame_id).toBe(noteFrameAt(frames, n));
    // The live canvas of PERF-2 (slice 3b, S3B-15 c): the project's second tab, exactly what PERF-2 marks, in frames.
    const perf2 = wl.label.find((l) => l.workspace_id === ws && l.name === LARGE_LIVE_LABEL)!;
    const liveCanvas = wl.canvas.find((c) => c.live_label_id === perf2.id)!;
    expect(liveCanvas.name).toBe("PERF-2");
    // slice 4b-2: “Performance test – requirements” is the third tab
    expect((await store.canvases.listLinksOfProject(ws, LARGE_IDS.project)).map((l) => l.canvas_id)).toEqual([LARGE_IDS.canvas, liveCanvas.id, LARGE_IDS.canvasRequirements]);
    const liveCards = await store.canvasItems.listOfCanvas(ws, liveCanvas.id);
    const membership = liveMembership(perf2.id, { ...m, links });
    expect(liveCards).toHaveLength(22);
    expect(liveCards).toHaveLength(membership.entities.size + membership.tables.size);
    for (const c of liveCards) {
      const level = c.entity_id ? membership.entities.get(c.entity_id) : membership.tables.get(c.source_table_id!);
      expect([c.live_level, c.row_filter]).toEqual([level, level === "full" ? "all" : "labeled"]);
      expect(c.frame_id).not.toBeNull();
    }
    // The fading scenarios' lenses (slice 4p): two requirements without cards; the small one six attributes of one entity,
    // one of them without a mapping (a gap), the large one four whole entities.
    const requirements = await store.requirements.list(ws);
    expect(requirements.filter((r) => ["REQ-101", "REQ-102", "REQ-103"].includes(r.key)).map((r) => [r.key, r.name]).sort()).toEqual([["REQ-101", "Lens, small"], ["REQ-102", "Lens, large"], ["REQ-103", "Lens, dense area"]]);
    // slice 4b-2: REQ-104 to REQ-112 for the requirements canvas
    expect(requirements).toHaveLength(12);
    expect((await store.workspaces.get(ws))!.requirement_key_next).toBe(113);
    const lenses = buildRequirementIndex(requirements, await store.requirements.listLinks(ws), m);
    const byKey = (key: string) => requirements.find((r) => r.key === key)!.id;
    const small = lenses.coverage(byKey("REQ-101")), large = lenses.coverage(byKey("REQ-102"));
    expect([small.total, small.notMapped.length]).toEqual([6, 1]);
    // REQ-102 links every attribute of ent:3, ent:4, ent:7 and ent:19 (slice 4b-1: an entity link no longer brings them)
    expect(lenses.linksOf(byKey("REQ-102")).every((k) => k.attribute_id)).toBe(true);
    // the dense area's lens: the four tables in S1A-14's 100 % view, no attributes in scope
    const dense = lenses.linksOf(byKey("REQ-103"));
    expect(dense.map((k) => k.source_table_id).sort()).toEqual(["src:1", "src:29", "src:47", "src:57"].map((c) => seedId(ws, `table:${c}`)).sort());
    expect(lenses.coverage(byKey("REQ-103")).total).toBe(0);
    expect([large.total, large.parts.attributes]).toEqual([5 + 8 + 21 + 12, 5 + 8 + 21 + 12]);
    expect(cards.some((c) => c.requirement_id)).toBe(false);
    // “Performance test – requirements” (slice 4b-2, PRD item 26): the same cards, frames and notes, plus 12 requirement
    // cards, none in a frame; their requirements touch only cards that carry a marker on “100 cards” already (REQ-101 to
    // REQ-103's), so that canvas's marks change their numbers only
    const copy = await store.canvasItems.listOfCanvas(ws, LARGE_IDS.canvasRequirements);
    expect(copy.filter((c) => !c.requirement_id).map((c) => [c.entity_id, c.source_table_id, c.x, c.y]).sort()).toEqual(cards.map((c) => [c.entity_id, c.source_table_id, c.x, c.y]).sort());
    const reqCards = copy.filter((c) => c.requirement_id);
    expect(reqCards).toHaveLength(12);
    expect(reqCards.every((c) => c.frame_id === null)).toBe(true);
    expect(await store.frames.listOfCanvas(ws, LARGE_IDS.canvasRequirements)).toHaveLength(8);
    expect(wl.note.filter((n) => n.canvas_id === LARGE_IDS.canvasRequirements)).toHaveLength(notes.length);
    const all = buildRequirementIndex(requirements, await store.requirements.listLinks(ws), m);
    const marked = (keys: string[]) => {
      const out = new Set<string>();
      for (const k of keys) {
        const sc = all.scope(byKey(k));
        for (const id of [...sc.entities, ...sc.tables]) out.add(id);
      }
      return out;
    };
    const before = marked(["REQ-101", "REQ-102", "REQ-103"]);
    expect([...marked(requirements.map((r) => r.key))].every((id) => before.has(id))).toBe(true);
    expect(requirements.reduce((n, r) => n + all.linksOf(r.id).length, 0) - 6 - 46 - 4).toBe(126 - 56);
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

describe("the deleted originals of live copies (slice 10c, F6)", () => {
  it("names each deleted original a live copy points to, with its entity's name, and nothing else", async () => {
    const db = await readDb(file);
    const ws = db.attribute[0]!.workspace_id;
    const [original, copy, liveOriginal, liveCopy, gone, goneCopy] = db.attribute.filter((a) => a.workspace_id === ws && a.deleted_at === null);
    const at = "2026-10-30T12:00:00.000Z";
    const link = (id: string, to: string) => {
      db.attribute.find((a) => a.id === id)!.copied_from_attribute_id = to;
    };
    link(copy!.id, original!.id);
    link(liveCopy!.id, liveOriginal!.id);
    link(goneCopy!.id, gone!.id);
    // the original deleted; another deleted original whose copy is deleted too names nothing
    db.attribute.find((a) => a.id === original!.id)!.deleted_at = at;
    db.attribute.find((a) => a.id === gone!.id)!.deleted_at = at;
    db.attribute.find((a) => a.id === goneCopy!.id)!.deleted_at = at;
    await writeFile(file, JSON.stringify(db), "utf8");

    const entityName = db.entity.find((e) => e.id === original!.entity_id)!.name;
    expect((await store.model.load(ws)).lostOriginals).toEqual([{ id: original!.id, name: original!.name, entityName }]);
    // a workspace without copies has none
    const other = db.workspace.find((w) => w.id !== ws)!.id;
    expect((await store.model.load(other)).lostOriginals).toEqual([]);
  });
});

describe("copies through the adapter (slice 10c)", () => {
  it("a paste, a followed type change and its undo apply, the copy in step at each point", async () => {
    const anna = SEED_IDS.userAnna;
    const access = await accessAs(anna);
    let m = await store.model.load(RETAIL);
    const original = m.attributes.find((a) => a.is_primary_key)!;
    const target = m.entities.find((e) => e.id !== original.entity_id)!;
    const pasted = pasteAttribute(ctxFor(anna), access, { entity: target, original, attributes: m.attributes }, { entityId: target.id, attributeId: original.id });
    if (!pasted.ok) throw new Error(pasted.error.message);
    expect(await store.apply(pasted.writeSet)).toEqual({ ok: true });

    m = await store.model.load(RETAIL);
    const before = m.attributes.find((a) => a.id === original.id)!;
    const changed = updateAttribute(ctxFor(anna), access, { attribute: before, attributes: m.attributes, entities: m.entities }, { attributeId: before.id, expectedVersion: before.version, type: { dataType: "string", length: 77 } });
    if (!changed.ok) throw new Error(changed.error.message);
    expect(await store.apply(changed.writeSet)).toEqual({ ok: true });
    const copyNow = () => store.model.load(RETAIL).then((x) => x.attributes.find((a) => a.id === pasted.value.attributeId)!);
    expect(await copyNow()).toMatchObject({ data_type: "string", type_length: 77, copied_from_attribute_id: original.id });

    const undone = revertChangeGroup(ctxFor(anna), access, { events: changed.writeSet.events, rows: await store.model.loadForUndo(RETAIL) }, "undo");
    if (!undone.ok) throw new Error(undone.error.message);
    expect(await store.apply(undone.writeSet)).toEqual({ ok: true });
    expect(await copyNow()).toMatchObject({ data_type: before.data_type, type_length: before.type_length });
  });
});
