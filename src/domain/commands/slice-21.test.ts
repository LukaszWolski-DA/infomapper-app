// Slice 21 (D-76): an entity made with a new concept in one change group (the concept picker's "New concept"), and a
// concept's colour from the workspace settings.

import { describe, expect, it } from "vitest";
import { access, archived, canvas, concept, entity, ids, makeCtx, NOW } from "../__fixtures__/domain";
import { COLOR_NOT_IN_PALETTE, setConceptColor, tidyName } from "./concept";
import { createEntity, newConceptLabel } from "./entity";

const { conceptCustomer, conceptSales, customer, canvas1 } = ids;

describe("createEntity with a new concept (slice 21)", () => {
  const concepts = [concept(conceptCustomer), concept(conceptSales)];
  const state = { concept: null, concepts, entities: [entity(customer)], canvas: canvas() };

  it("writes the concept, the entity and its card in one change group, named for undo", () => {
    const r = createEntity(makeCtx(), access("modeler"), state, { newConcept: { name: "  Fin   ance " }, placement: { canvasId: canvas1, x: 240, y: 80 } });
    if (!r.ok) throw new Error(r.error.message);
    const [c, e, item] = r.writeSet.writes;
    // the first palette colour no live concept uses, last in the list (as “New concept”)
    expect(c).toMatchObject({ kind: "insert", table: "concept", row: { name: "Fin ance", color: "#C0437A", sort_order: 2 } });
    expect(e).toMatchObject({ kind: "insert", table: "entity", row: { name: "New entity", concept_id: r.value.concept.id } });
    expect(item).toMatchObject({ kind: "insert", table: "canvas_item" });
    expect(new Set(r.writeSet.events.map((x) => x.change_group_id)).size).toBe(1);
    expect(r.writeSet.label).toBe("Create New entity in new concept Fin ance");
    expect(r.value.concept.name).toBe("Fin ance");
  });

  it("ignores deleted concepts for the colour and the order", () => {
    const r = createEntity(makeCtx(), access("owner"), { ...state, concepts: [concept(conceptCustomer, { deleted_at: NOW })] }, { newConcept: { name: "X" } });
    expect(r.ok && r.writeSet.writes[0]).toMatchObject({ row: { color: "#2F7DD1", sort_order: 0 } });
  });

  it("takes exactly one of conceptId and newConcept", () => {
    expect(createEntity(makeCtx(), access("owner"), state, {})).toMatchObject({ ok: false, error: { code: "invalid" } });
    expect(createEntity(makeCtx(), access("owner"), { ...state, concept: concept() }, { conceptId: conceptCustomer, newConcept: { name: "X" } })).toMatchObject({
      ok: false,
      error: { code: "invalid" },
    });
    expect(createEntity(makeCtx(), access("owner"), state, { newConcept: { name: "  " } })).toMatchObject({ ok: false, error: { code: "invalid" } });
  });

  it("keeps the old create unchanged: no concept row, no label", () => {
    const r = createEntity(makeCtx(), access("owner"), { ...state, concept: concept() }, { conceptId: conceptCustomer });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.writeSet.writes.map((w) => w.table)).toEqual(["entity"]);
    expect(r.writeSet.label).toBeUndefined();
    expect(r.value.concept).toEqual({ id: conceptCustomer, name: "Customer" });
  });

  it("is refused to reviewers and readers and in an archived workspace", () => {
    for (const role of ["reviewer", "reader"] as const) expect(createEntity(makeCtx(), access(role), state, { newConcept: { name: "X" } })).toMatchObject({ ok: false, error: { code: "forbidden" } });
    expect(createEntity(makeCtx(), access("owner", archived), state, { newConcept: { name: "X" } })).toMatchObject({ ok: false, error: { code: "archived" } });
  });

  it("tidies a name and labels the step", () => {
    expect(tidyName("  a   b \t c ")).toBe("a b c");
    expect(newConceptLabel("Fact Sales", "Retail")).toBe("Create Fact Sales in new concept Retail");
  });
});

describe("setConceptColor (slice 21)", () => {
  const input = (color: string, expectedVersion = 1) => ({ conceptId: conceptCustomer, expectedVersion, color });

  it("sets a palette colour (upper-cased), one update named for undo", () => {
    const r = setConceptColor(makeCtx(), access("modeler"), { concept: concept() }, input("#c0437a"));
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value.concept).toMatchObject({ color: "#C0437A", version: 2 });
    expect(r.writeSet.events).toMatchObject([{ operation: "update", before_image: { color: "#2F7DD1" }, after_image: { color: "#C0437A" } }]);
    expect(r.writeSet.label).toBe("Change colour of Customer");
  });

  it("writes nothing for the same colour, and refuses a colour outside the palette (violet)", () => {
    expect(setConceptColor(makeCtx(), access("owner"), { concept: concept() }, input("#2f7dd1"))).toMatchObject({ ok: false, error: { code: "invalid", message: "Nothing to change." } });
    expect(setConceptColor(makeCtx(), access("owner"), { concept: concept() }, input("#6D4AFF"))).toMatchObject({ ok: false, error: { code: "invalid", message: COLOR_NOT_IN_PALETTE } });
  });

  it("checks the version and the concept", () => {
    expect(setConceptColor(makeCtx(), access("owner"), { concept: concept() }, input("#C0437A", 7))).toMatchObject({ ok: false, error: { code: "stale_version" } });
    expect(setConceptColor(makeCtx(), access("owner"), { concept: null }, input("#C0437A"))).toMatchObject({ ok: false, error: { code: "not_found" } });
  });

  it("is model.edit: modelers yes; reviewers, readers and an archived workspace no", () => {
    for (const role of ["owner", "admin", "modeler"] as const) expect(setConceptColor(makeCtx(), access(role), { concept: concept() }, input("#C0437A")).ok).toBe(true);
    for (const role of ["reviewer", "reader"] as const) expect(setConceptColor(makeCtx(), access(role), { concept: concept() }, input("#C0437A"))).toMatchObject({ ok: false, error: { code: "forbidden" } });
    expect(setConceptColor(makeCtx(), access("owner", archived), { concept: concept() }, input("#C0437A"))).toMatchObject({ ok: false, error: { code: "archived" } });
  });
});
