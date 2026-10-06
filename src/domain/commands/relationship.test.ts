import { describe, expect, it } from "vitest";
import { access, archived, entity, ids, makeCtx, NOW, relationship } from "../__fixtures__/domain";
import { createRelationship, deleteRelationship, swapRelationship, updateRelationship } from "./relationship";

describe("createRelationship (relate button on an entity card, slice 1b)", () => {
  const ends = { from: entity(ids.customer), to: entity(ids.salesOrder) };
  const input = { fromEntityId: ids.customer, toEntityId: ids.salesOrder };

  it("creates a relationship with the default ends 1 to 0..n and no label", () => {
    const r = createRelationship(makeCtx(), access("modeler"), ends, input);
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value.relationship).toMatchObject({
      from_entity_id: ids.customer, to_entity_id: ids.salesOrder, label: null, from_min: 1, from_max: "1", to_min: 0, to_max: "n", version: 1, deleted_at: null,
    });
    expect(r.writeSet.writes).toMatchObject([{ kind: "insert", table: "relationship" }]);
    expect(r.writeSet.events).toMatchObject([{ operation: "create", object_type: "relationship" }]);
  });

  it("refuses relating an entity to itself, and unknown or deleted entities", () => {
    expect(createRelationship(makeCtx(), access("owner"), ends, { fromEntityId: ids.customer, toEntityId: ids.customer })).toMatchObject({
      ok: false, error: { code: "invalid", message: "Pick a different entity to relate to." },
    });
    expect(createRelationship(makeCtx(), access("owner"), { ...ends, to: null }, input)).toMatchObject({ ok: false, error: { code: "not_found" } });
    expect(createRelationship(makeCtx(), access("owner"), { ...ends, from: entity(ids.customer, { deleted_at: NOW }) }, input)).toMatchObject({ ok: false, error: { code: "not_found" } });
  });

  it("is refused to reviewers and in an archived workspace", () => {
    expect(createRelationship(makeCtx(), access("reviewer"), ends, input)).toMatchObject({ ok: false, error: { code: "forbidden" } });
    expect(createRelationship(makeCtx(), access("owner", archived), ends, input)).toMatchObject({ ok: false, error: { code: "archived" } });
  });
});

const ref = { relationshipId: ids.relPlaces, expectedVersion: 1 };
const state = { relationship: relationship() };

describe("relationships in the right panel", () => {
  it("changes the label and the cardinality of both ends", () => {
    const r = updateRelationship(makeCtx(), access("modeler"), state, { ...ref, label: "orders", fromMin: 0, toMin: 1, toMax: "1" });
    expect(r).toMatchObject({ ok: true, value: { relationship: { label: "orders", from_min: 0, from_max: "1", to_min: 1, to_max: "1", version: 2 } } });
  });

  it("clears an empty label", () => {
    expect(updateRelationship(makeCtx(), access("owner"), state, { ...ref, label: "  " })).toMatchObject({ ok: true, value: { relationship: { label: null } } });
  });

  it("refuses values outside the lists", () => {
    expect(updateRelationship(makeCtx(), access("owner"), state, { ...ref, toMax: "many" })).toMatchObject({ ok: false, error: { code: "invalid" } });
    expect(updateRelationship(makeCtx(), access("owner"), state, { ...ref, fromMin: 2 })).toMatchObject({ ok: false, error: { code: "invalid" } });
  });

  it("swaps the direction: entities and cardinalities change places", () => {
    expect(swapRelationship(makeCtx(), access("modeler"), state, ref)).toMatchObject({
      ok: true,
      value: { relationship: { from_entity_id: ids.salesOrder, to_entity_id: ids.customer, from_min: 0, from_max: "n", to_min: 1, to_max: "1", label: "places" } },
    });
  });

  it("deletes softly", () => {
    const r = deleteRelationship(makeCtx(), access("modeler"), state, ref);
    expect(r.ok && r.writeSet.writes).toMatchObject([{ table: "relationship", row: { deleted_at: NOW, version: 2 } }]);
  });

  it("is refused to reviewers, in an archived workspace and with a stale version", () => {
    expect(swapRelationship(makeCtx(), access("reviewer"), state, ref)).toMatchObject({ ok: false, error: { code: "forbidden" } });
    expect(deleteRelationship(makeCtx(), access("owner", archived), state, ref)).toMatchObject({ ok: false, error: { code: "archived" } });
    expect(updateRelationship(makeCtx(), access("owner"), state, { relationshipId: ids.relPlaces, expectedVersion: 5, label: "x" })).toMatchObject({
      ok: false,
      error: { code: "stale_version" },
    });
  });
});
