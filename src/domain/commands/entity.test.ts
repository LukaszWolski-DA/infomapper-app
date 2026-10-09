import { describe, expect, it } from "vitest";
import {
  access,
  archived,
  attribute,
  canvas,
  canvasItem,
  concept,
  entity,
  frame,
  ids,
  link,
  makeCtx,
  mapping,
  mappingInput,
  NOW,
  project,
  relationship,
} from "../__fixtures__/domain";
import { entityImpact } from "../model/impact";
import { createEntity, deleteEntity, duplicateNameWarning, updateEntity } from "./entity";

const { conceptCustomer, conceptSales, customer, salesOrder, canvas1, canvas2 } = ids;

describe("createEntity (D-46)", () => {
  const state = { concept: concept(), entities: [entity(customer), entity(salesOrder)], canvas: canvas() };

  it("creates “New entity” in the concept and places its card, in one change group", () => {
    const r = createEntity(makeCtx(), access("modeler"), state, { conceptId: conceptCustomer, placement: { canvasId: canvas1, x: 240, y: 80 } });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value).toMatchObject({ warning: null });
    expect(r.writeSet.writes).toMatchObject([
      { kind: "insert", table: "entity", row: { id: r.value.entityId, name: "New entity", concept_id: conceptCustomer, stereotype: "object" } },
      { kind: "insert", table: "canvas_item", row: { id: r.value.canvasItemId, canvas_id: canvas1, entity_id: r.value.entityId, source_table_id: null, x: 240, y: 80, row_filter: "all" } },
    ]);
    expect(new Set(r.writeSet.events.map((e) => e.change_group_id)).size).toBe(1);
  });

  it("numbers the default name when it is taken", () => {
    const taken = [...state.entities, entity(ids.projectA, { name: "new entity" }), entity(ids.projectB, { name: "New entity 2" })];
    const r = createEntity(makeCtx(), access("owner"), { ...state, entities: taken }, { conceptId: conceptCustomer });
    expect(r.ok && r.writeSet.writes).toMatchObject([{ row: { name: "New entity 3" } }]);
    expect(r.ok && r.value.canvasItemId).toBeNull();
  });

  it("warns about a duplicate name but creates the entity (B-25)", () => {
    const r = createEntity(makeCtx(), access("owner"), state, { conceptId: conceptCustomer, name: "customer" });
    expect(r).toMatchObject({ ok: true, value: { warning: duplicateNameWarning("customer") } });
    expect(duplicateNameWarning("customer")).toBe("Another entity is already called “customer”. Rename one of them if they mean different things.");
  });

  it("refuses an unknown concept or canvas", () => {
    expect(createEntity(makeCtx(), access("owner"), { ...state, concept: null }, { conceptId: conceptCustomer })).toMatchObject({ ok: false, error: { code: "not_found" } });
    expect(createEntity(makeCtx(), access("owner"), { ...state, canvas: canvas(canvas1, { deleted_at: NOW }) }, { conceptId: conceptCustomer, placement: { canvasId: canvas1, x: 0, y: 0 } })).toMatchObject({
      ok: false,
      error: { code: "not_found", message: "This canvas does not exist." },
    });
  });

  it("is refused to reviewers and readers, and in an archived workspace", () => {
    for (const role of ["reviewer", "reader"] as const) {
      expect(createEntity(makeCtx(), access(role), state, { conceptId: conceptCustomer })).toMatchObject({ ok: false, error: { code: "forbidden" } });
    }
    expect(createEntity(makeCtx(), access("owner", archived), state, { conceptId: conceptCustomer })).toMatchObject({ ok: false, error: { code: "archived" } });
  });
});

describe("updateEntity", () => {
  const state = { entity: entity(customer), entities: [entity(customer), entity(salesOrder)], concept: concept(conceptSales) };
  const ref = { entityId: customer, expectedVersion: 1 };

  it("changes name, stereotype, concept and the plain-text definition (AD-30)", () => {
    const r = updateEntity(makeCtx(), access("modeler"), state, { ...ref, name: "Client", stereotype: "context", conceptId: conceptSales, definition: "A person who buys." });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value.entity).toMatchObject({
      name: "Client",
      stereotype: "context",
      concept_id: conceptSales,
      definition_html: "<p>A person who buys.</p>",
      definition_text: "A person who buys.",
      version: 2,
    });
    expect(r.value.warning).toBeNull();
  });

  it("warns when the new name is taken by another entity", () => {
    expect(updateEntity(makeCtx(), access("owner"), state, { ...ref, name: "SALES ORDER" })).toMatchObject({
      ok: true,
      value: { warning: duplicateNameWarning("SALES ORDER") },
    });
  });

  it("refuses an unknown stereotype, an empty name, an unknown concept and no change", () => {
    expect(updateEntity(makeCtx(), access("owner"), state, { ...ref, stereotype: "hub" })).toMatchObject({ ok: false, error: { code: "invalid" } });
    expect(updateEntity(makeCtx(), access("owner"), state, { ...ref, name: " " })).toMatchObject({ ok: false, error: { code: "invalid" } });
    expect(updateEntity(makeCtx(), access("owner"), { ...state, concept: null }, { ...ref, conceptId: conceptSales })).toMatchObject({ ok: false, error: { code: "not_found" } });
    expect(updateEntity(makeCtx(), access("owner"), state, { ...ref, name: "Customer" })).toMatchObject({ ok: false, error: { message: "Nothing to change." } });
  });

  it("refuses a stale version and reviewers", () => {
    expect(updateEntity(makeCtx(), access("owner"), state, { entityId: customer, expectedVersion: 3, name: "X" })).toMatchObject({ ok: false, error: { code: "stale_version" } });
    expect(updateEntity(makeCtx(), access("reviewer"), state, { ...ref, name: "X" })).toMatchObject({ ok: false, error: { code: "forbidden" } });
  });
});

describe("deleting an entity (D-47)", () => {
  // Customer: 8 attributes, 3 mappings (one approved, one on another entity), 2 relationships, on two canvases.
  const attrs = Array.from({ length: 8 }, (_, i) => attribute(`01900000-0000-7000-8000-0000000051${String(i).padStart(2, "0")}`, { entity_id: customer, sort_order: i }));
  const orderAttr = attribute(ids.orderId);
  const maps = [
    mapping({ id: "01900000-0000-7000-8000-00000000a101", attribute_id: attrs[0]!.id, status: "approved", approved_at: NOW, approved_by: ids.someoneElse }),
    mapping({ id: "01900000-0000-7000-8000-00000000a102", attribute_id: attrs[1]!.id }),
    mapping({ id: "01900000-0000-7000-8000-00000000a103", attribute_id: attrs[2]!.id, deleted_at: NOW }),
    mapping({ id: "01900000-0000-7000-8000-00000000a104", attribute_id: orderAttr.id }),
  ];
  const inputs = maps.map((m, i) => mappingInput(`01900000-0000-7000-8000-00000000b10${i}`, { mapping_id: m.id }));
  const rels = [
    relationship(),
    relationship({ id: "01900000-0000-7000-8000-000000006002", from_entity_id: salesOrder, to_entity_id: customer, label: "is billed to" }),
    relationship({ id: "01900000-0000-7000-8000-000000006003", from_entity_id: salesOrder, to_entity_id: ids.projectA }),
  ];
  const items = [
    canvasItem(ids.itemCustomer),
    canvasItem("01900000-0000-7000-8000-00000000c003", { canvas_id: canvas2, entity_id: customer }),
    canvasItem(ids.itemCrmCustomer),
  ];
  const rows = { entity: entity(customer), attributes: [...attrs, orderAttr], mappings: maps, mappingInputs: inputs, relationships: rels, canvasItems: items };

  it("shows the impact: attributes, mappings with the approved count, relationships, canvases, projects (S1A-10)", () => {
    const impact = entityImpact(rows, {
      canvases: [canvas(canvas1), canvas(canvas2)],
      projects: [project(ids.projectA), project(ids.projectB)],
      projectCanvases: [link(ids.projectA, canvas1), link(ids.projectB, canvas1), link(ids.projectB, canvas2)],
    });
    expect(impact).toEqual({
      attributes: 8,
      mappings: 2,
      approvedMappings: 1,
      relationships: 2,
      canvases: [
        { id: canvas1, name: "Customer & orders" },
        { id: canvas2, name: "Order lines & products" },
      ],
      projects: [
        { id: ids.projectA, name: "Customer 360" },
        { id: ids.projectB, name: "Order management" },
      ],
    });
  });

  it("soft-deletes the entity, its attributes, mappings, inputs, relationships and cards in one change group", () => {
    const r = deleteEntity(makeCtx(), access("modeler"), rows, { entityId: customer, expectedVersion: 1 });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value).toEqual({ attributes: 8, mappings: 2, relationships: 2 });
    const byTable = (t: string) => r.writeSet.writes.filter((w) => w.table === t).map((w) => (w.kind === "update" && "id" in w.row ? w.row.id : null));
    expect(byTable("mapping_input")).toEqual([inputs[0]!.id, inputs[1]!.id]);
    expect(byTable("mapping")).toEqual([maps[0]!.id, maps[1]!.id]);
    expect(byTable("attribute")).toEqual(attrs.map((a) => a.id));
    expect(byTable("relationship")).toEqual([rels[0]!.id, rels[1]!.id]);
    expect(byTable("canvas_item")).toEqual([items[0]!.id, items[1]!.id]);
    expect(byTable("entity")).toEqual([customer]);
    expect(r.writeSet.writes.every((w) => w.kind === "update" && "deleted_at" in w.row && w.row.deleted_at === NOW)).toBe(true);
    expect(r.writeSet.events.every((e) => e.operation === "delete" && e.change_group_id === r.writeSet.changeGroupId)).toBe(true);
    expect(r.writeSet.events).toHaveLength(8 + 2 + 2 + 2 + 2 + 1);
  });

  it("refuses a stale version, reviewers and an archived workspace", () => {
    expect(deleteEntity(makeCtx(), access("owner"), rows, { entityId: customer, expectedVersion: 2 })).toMatchObject({ ok: false, error: { code: "stale_version" } });
    expect(deleteEntity(makeCtx(), access("reviewer"), rows, { entityId: customer, expectedVersion: 1 })).toMatchObject({ ok: false, error: { code: "forbidden" } });
    expect(deleteEntity(makeCtx(), access("admin", archived), rows, { entityId: customer, expectedVersion: 1 })).toMatchObject({ ok: false, error: { code: "archived" } });
  });

  it("refuses an entity that is already deleted", () => {
    expect(deleteEntity(makeCtx(), access("owner"), { ...rows, entity: entity(customer, { deleted_at: NOW }) }, { entityId: customer, expectedVersion: 1 })).toMatchObject({
      ok: false,
      error: { code: "not_found" },
    });
  });
});

describe("createEntity on a canvas with frames (D-46, slice 2b)", () => {
  const state = { concept: concept(), entities: [], canvas: canvas(), frames: [frame(ids.frameA, { width: 400, height: 300 })] };

  it("the new card joins the frame it lands in, which grows to hold it", () => {
    const r = createEntity(makeCtx(), access("modeler"), state, {
      conceptId: conceptCustomer,
      placement: { canvasId: canvas1, x: 80, y: 200, height: 200, frames: [{ frameId: ids.frameA, expectedVersion: 1 }] },
    });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.writeSet.writes).toMatchObject([
      { table: "entity" },
      { table: "canvas_item", row: { frame_id: ids.frameA } },
      { table: "frame", row: { height: 200 + 200 + 24 } },
    ]);
  });

  it("needs the version of the frame that grows", () => {
    expect(createEntity(makeCtx(), access("modeler"), state, { conceptId: conceptCustomer, placement: { canvasId: canvas1, x: 80, y: 200, height: 200 } })).toMatchObject({
      ok: false,
      error: { code: "stale_version" },
    });
  });
});
