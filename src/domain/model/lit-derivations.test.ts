// Slice 18 (item 3, F10): Focus on an attribute lights its calculation's inputs and the attributes calculated from it,
// one level: their source mappings with their tables, and the logical cards that feed them.

import { describe, expect, it } from "vitest";
import { attribute, ids, mapping, mappingInput, sourceColumn } from "../__fixtures__/domain";
import type { AttributeInput } from "../types";
import { targetLit, type LitModel } from "./lit";

const full = "01900000-0000-7000-8000-0000000054a1";
const fed = "01900000-0000-7000-8000-0000000054a2";
const T = "2026-11-08T10:00:00.000Z";
const input = (attribute_id: string, input_attribute_id: string, id: string): AttributeInput => ({
  id, workspace_id: ids.ws, attribute_id, input_attribute_id, sort_order: 0, version: 1, created_at: T, created_by: ids.actor, updated_at: T, updated_by: ids.actor, deleted_at: null,
});

// Customer: email (mapped from crm.email), full = email; fed (Customer) = full; orderId (Sales Order) feeds `fed`
const model: LitModel = {
  attributes: [attribute(ids.email), attribute(full, { name: "full", is_calculated: true }), attribute(fed, { name: "fed", is_calculated: true }), attribute(ids.orderId)],
  mappings: [mapping()],
  mappingInputs: [mappingInput()],
  attributeInputs: [input(full, ids.email, "01900000-0000-7000-8000-0000000054b1"), input(fed, full, "01900000-0000-7000-8000-0000000054b2")],
  relationships: [],
  sourceColumns: [sourceColumn(ids.colEmail)],
};

describe("Focus on a calculated attribute and on an input (slice 18, F10)", () => {
  it("a calculated attribute lights its inputs' mappings and their tables", () => {
    const lit = targetLit(model, { t: "attribute", id: full });
    expect([...lit.mappings]).toEqual([ids.mapEmail]);
    expect([...lit.tables]).toEqual([ids.crmCustomer]);
  });

  it("an input lights the attributes calculated from it, one level, and their feeds' cards", () => {
    const lit = targetLit(model, { t: "attribute", id: full }, { [fed]: [{ id: "01900000-0000-7000-8000-0000000054c1", approved: true, typeConflict: false, inputs: [ids.orderId] }] });
    // full's user is `fed`, whose feed reads Sales Order's order_id
    expect(lit.entities.has(ids.salesOrder)).toBe(true);
    // one level only: Focus on `fed` lights its input full, which has no mapping, and not email's mapping two levels down
    const top = targetLit(model, { t: "attribute", id: fed });
    expect(top.mappings.size).toBe(0);
  });

  it("an attribute without a calculation lights as before", () => {
    const lit = targetLit(model, { t: "attribute", id: ids.email });
    expect([...lit.mappings]).toEqual([ids.mapEmail]);
    expect([...lit.entities]).toEqual([ids.customer]);
  });
});
