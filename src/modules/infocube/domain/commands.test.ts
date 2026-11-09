// New fact and New dimension (slice 15a, B-1, C-5, C-7) and the turn of a fact – dimension relationship (D-67).

import { describe, expect, it } from "vitest";
import { access, archived, concept, entity, ids, makeCtx } from "@/domain/__fixtures__/domain";
import { INFOCUBE_OFF_MESSAGE } from "@/domain/model/levels";
import { createCubeEntity, dimensionEnd } from "./commands";

const on = { infocube: true };
const state = (entities = [entity(ids.customer)]) => ({ concept: concept(ids.conceptSales), entities, canvas: null });
const input = { conceptId: ids.conceptSales };

describe("createCubeEntity", () => {
  it("creates a dimensional entity and its role in one change group: a fact without a grain, a transaction, not factless; a dimension standard, SCD 1 (slice 19)", () => {
    const fact = createCubeEntity(makeCtx(), access("modeler", on), state(), "fact", input);
    if (!fact.ok) throw new Error(fact.error.message);
    expect(fact.writeSet.writes).toMatchObject([
      { kind: "insert", table: "entity", row: { id: fact.value.entityId, model_level: "dimensional", name: "New fact", stereotype: "object" } },
      { kind: "insert", table: "cube_entity", row: { entity_id: fact.value.entityId, role: "fact", grain: null, fact_type: "transaction", is_factless: false, base_fact_entity_id: null, dim_kind: null, history: null, snapshot_period: null } },
    ]);
    expect(new Set(fact.writeSet.events.map((e) => e.change_group_id)).size).toBe(1);
    const dim = createCubeEntity(makeCtx(), access("modeler", on), state(), "dimension", input);
    expect(dim.ok && dim.writeSet.writes[1]).toMatchObject({ row: { role: "dimension", grain: null, fact_type: null, is_factless: null, dim_kind: "standard", history: "overwrite", snapshot_period: null } });
    expect(dim.ok && dim.writeSet.writes[0]).toMatchObject({ row: { name: "New dimension" } });
  });

  it("numbers the default name among dimensional names only", () => {
    const taken = [entity(ids.customer, { name: "New fact" }), entity(ids.salesOrder, { name: "New fact", model_level: "dimensional" })];
    const r = createCubeEntity(makeCtx(), access("modeler", on), state(taken), "fact", input);
    expect(r.ok && r.writeSet.writes[0]).toMatchObject({ row: { name: "New fact 2" } });
  });

  it("makes a fact in a new concept in the same change group, with InfoMapper's undo name (slice 21, D-76)", () => {
    const r = createCubeEntity(makeCtx(), access("modeler", on), { ...state(), concept: null, concepts: [concept(ids.conceptCustomer), concept(ids.conceptSales)] }, "fact", { newConcept: { name: "Retail" } });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.writeSet.writes.map((w) => w.table)).toEqual(["concept", "entity", "cube_entity"]);
    expect(r.writeSet.writes[0]).toMatchObject({ row: { name: "Retail", color: "#C0437A" } });
    expect(new Set(r.writeSet.events.map((e) => e.change_group_id)).size).toBe(1);
    expect(r.writeSet.label).toBe("Create New fact in new concept Retail");
    expect(r.value.concept.name).toBe("Retail");
  });

  it("is refused while InfoCube is off, and keeps InfoMapper's rights and the archive", () => {
    expect(createCubeEntity(makeCtx(), access("modeler"), state(), "fact", input)).toMatchObject({ ok: false, error: { code: "forbidden", message: INFOCUBE_OFF_MESSAGE } });
    expect(createCubeEntity(makeCtx(), access("reviewer", on), state(), "fact", input)).toMatchObject({ ok: false, error: { code: "forbidden" } });
    expect(createCubeEntity(makeCtx(), access("owner", { ...on, ...archived }), state(), "fact", input)).toMatchObject({ ok: false, error: { code: "archived" } });
  });
});

describe("dimensionEnd (D-67)", () => {
  const roles = [
    { entity_id: "f", role: "fact" as const, deleted_at: null },
    { entity_id: "d", role: "dimension" as const, deleted_at: null },
    { entity_id: "d2", role: "dimension" as const, deleted_at: null },
    { entity_id: "gone", role: "dimension" as const, deleted_at: "2026-11-04T10:00:00.000Z" },
  ];
  it("names the dimension between a fact and a dimension, in either order, and nothing otherwise", () => {
    expect(dimensionEnd(roles, "f", "d")).toBe("d");
    expect(dimensionEnd(roles, "d", "f")).toBe("d");
    expect(dimensionEnd(roles, "d", "d2")).toBeNull();
    expect(dimensionEnd(roles, "f", "gone")).toBeNull();
    expect(dimensionEnd(roles, "f", "logical")).toBeNull();
  });
});
