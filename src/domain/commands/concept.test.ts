import { describe, expect, it } from "vitest";
import { access, archived, concept, entity, frame, ids, makeCtx, NOW } from "../__fixtures__/domain";
import { STALE_VERSION_MESSAGE } from "../errors";
import { createConcept, deleteConcept, renameConcept } from "./concept";

const { conceptCustomer, conceptSales, customer, salesOrder } = ids;

describe("createConcept (D-46)", () => {
  const state = { concepts: [concept(conceptCustomer), concept(conceptSales)] };

  it("creates a concept last, in the first unused palette colour", () => {
    const r = createConcept(makeCtx(), access("modeler"), state, { name: " Product " });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.writeSet.writes).toMatchObject([
      { kind: "insert", table: "concept", row: { id: r.value.conceptId, name: "Product", color: "#C0437A", sort_order: 2, version: 1, workspace_id: ids.ws } },
    ]);
    expect(r.writeSet.events).toMatchObject([{ operation: "create", object_type: "concept", change_group_id: r.writeSet.changeGroupId }]);
  });

  it("ignores deleted concepts when picking colour and order", () => {
    const r = createConcept(makeCtx(), access("owner"), { concepts: [concept(conceptCustomer, { deleted_at: NOW })] }, { name: "X" });
    expect(r.ok && r.writeSet.writes[0]).toMatchObject({ row: { color: "#2F7DD1", sort_order: 0 } });
  });

  it("is refused to reviewers, readers and in an archived workspace; needs a name", () => {
    for (const role of ["reviewer", "reader"] as const) {
      expect(createConcept(makeCtx(), access(role), state, { name: "X" })).toMatchObject({ ok: false, error: { code: "forbidden" } });
    }
    expect(createConcept(makeCtx(), access("owner", archived), state, { name: "X" })).toMatchObject({ ok: false, error: { code: "archived" } });
    expect(createConcept(makeCtx(), access("owner"), state, { name: "" })).toMatchObject({ ok: false, error: { code: "invalid" } });
  });
});

describe("renameConcept", () => {
  it("renames and logs before and after", () => {
    const r = renameConcept(makeCtx(), access("admin"), { concept: concept() }, { conceptId: conceptCustomer, expectedVersion: 1, name: "Party" });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value.concept).toMatchObject({ name: "Party", version: 2, updated_by: ids.actor });
    expect(r.writeSet.events).toMatchObject([{ operation: "update", before_image: { name: "Customer" }, after_image: { name: "Party" } }]);
  });

  it("refuses a stale version and a deleted concept", () => {
    expect(renameConcept(makeCtx(), access("owner"), { concept: concept() }, { conceptId: conceptCustomer, expectedVersion: 2, name: "X" })).toEqual({
      ok: false,
      error: { code: "stale_version", message: STALE_VERSION_MESSAGE },
    });
    expect(
      renameConcept(makeCtx(), access("owner"), { concept: concept(conceptCustomer, { deleted_at: NOW }) }, { conceptId: conceptCustomer, expectedVersion: 1, name: "X" }),
    ).toMatchObject({ ok: false, error: { code: "not_found" } });
  });
});

describe("deleteConcept (D-47)", () => {
  const both = [concept(conceptCustomer), concept(conceptSales)];

  it("deletes an empty concept directly", () => {
    const r = deleteConcept(makeCtx(), access("modeler"), { concept: concept(conceptSales), concepts: both, entities: [] }, { conceptId: conceptSales, expectedVersion: 1 });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.writeSet.writes).toMatchObject([{ kind: "update", table: "concept", row: { id: conceptSales, deleted_at: NOW, version: 2 } }]);
    expect(r.writeSet.events).toMatchObject([{ operation: "delete" }]);
  });

  it("moves the entities to the chosen concept and deletes, in one change group", () => {
    const entities = [entity(customer), entity(salesOrder, { concept_id: conceptCustomer })];
    const r = deleteConcept(makeCtx(), access("modeler"), { concept: concept(), concepts: both, entities }, {
      conceptId: conceptCustomer,
      expectedVersion: 1,
      moveToConceptId: conceptSales,
    });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value.movedEntities).toBe(2);
    expect(r.writeSet.writes).toMatchObject([
      { table: "entity", row: { id: customer, concept_id: conceptSales, version: 2 } },
      { table: "entity", row: { id: salesOrder, concept_id: conceptSales } },
      { table: "concept", row: { id: conceptCustomer, deleted_at: NOW } },
    ]);
    expect(new Set(r.writeSet.events.map((e) => e.change_group_id))).toEqual(new Set([r.writeSet.changeGroupId]));
  });

  it("does not delete a concept with entities without a target", () => {
    expect(deleteConcept(makeCtx(), access("owner"), { concept: concept(), concepts: both, entities: [entity(customer)] }, { conceptId: conceptCustomer, expectedVersion: 1 })).toMatchObject({
      ok: false,
      error: { code: "invalid", message: "Customer holds 1 entity. Choose a concept to move them to first." },
    });
  });

  it("refuses to delete the only concept while it holds entities", () => {
    expect(
      deleteConcept(makeCtx(), access("owner"), { concept: concept(), concepts: [concept()], entities: [entity(customer), entity(salesOrder, { concept_id: conceptCustomer })] }, {
        conceptId: conceptCustomer,
        expectedVersion: 1,
        moveToConceptId: conceptSales,
      }),
    ).toMatchObject({ ok: false, error: { message: "Customer is the only concept and holds 2 entities. Create another concept to move them to first." } });
  });

  it("refuses moving to itself, to a deleted or unknown concept", () => {
    const s = { concept: concept(), concepts: [concept(), concept(conceptSales, { deleted_at: NOW })], entities: [entity(customer)] };
    const base = { conceptId: conceptCustomer, expectedVersion: 1 };
    expect(deleteConcept(makeCtx(), access("owner"), { ...s, concepts: both }, { ...base, moveToConceptId: conceptCustomer })).toMatchObject({ ok: false, error: { code: "invalid" } });
    expect(deleteConcept(makeCtx(), access("owner"), { ...s, concepts: [...s.concepts, concept(ids.projectA, { name: "Other" })] }, { ...base, moveToConceptId: conceptSales })).toMatchObject({
      ok: false,
      error: { code: "not_found" },
    });
  });

  it("is refused to reviewers", () => {
    expect(deleteConcept(makeCtx(), access("reviewer"), { concept: concept(conceptSales), concepts: both, entities: [] }, { conceptId: conceptSales, expectedVersion: 1 })).toMatchObject({
      ok: false,
      error: { code: "forbidden", message: "As a reviewer you cannot edit the model." },
    });
  });
});

describe("deleteConcept and its frames (D-47, slice 2b)", () => {
  const sales = concept(conceptSales);
  const salesFrame = frame(ids.frameA, { kind: "concept", concept_id: conceptSales, name: "Sales", color: null });
  const other = frame(ids.frameB, { kind: "concept", concept_id: conceptCustomer, name: "Customer", color: null, canvas_id: ids.canvas2 });

  it("turns its concept frames on every canvas into free frames in its colour, in the same change group", () => {
    const r = deleteConcept(makeCtx(), access("modeler"), { concept: sales, concepts: [concept(conceptCustomer), sales], entities: [], frames: [salesFrame, other] }, {
      conceptId: conceptSales,
      expectedVersion: 1,
    });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.writeSet.writes.map((w) => w.table)).toEqual(["frame", "concept"]);
    expect(r.writeSet.writes[0]).toMatchObject({ row: { id: ids.frameA, kind: "free", concept_id: null, color: sales.color, name: "Sales", x: 0, y: 0 } });
  });

  it("does the same when it moves its entities first, and keeps a frame's own colour", () => {
    const coloured = { ...salesFrame, color: "#2F7DD1" };
    const r = deleteConcept(makeCtx(), access("modeler"), { concept: sales, concepts: [concept(conceptCustomer), sales], entities: [entity(salesOrder)], frames: [coloured] }, {
      conceptId: conceptSales,
      expectedVersion: 1,
      moveToConceptId: conceptCustomer,
    });
    expect(r.ok && r.writeSet.writes.map((w) => w.table)).toEqual(["entity", "frame", "concept"]);
    expect(r.ok && r.writeSet.writes[1]).toMatchObject({ row: { kind: "free", color: "#2F7DD1" } });
  });
});
