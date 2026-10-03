import { describe, expect, it } from "vitest";
import { access, archived, ids, makeCtx, NOW, relationship } from "../__fixtures__/domain";
import { deleteRelationship, swapRelationship, updateRelationship } from "./relationship";

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
