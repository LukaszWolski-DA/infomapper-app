import { describe, expect, it } from "vitest";
import { attribute, entity, ids, NOW } from "../__fixtures__/domain";
import { attributeCopiesImpact, copiesImpactRow, entityImpact, requirementsImpactRow } from "./impact";

describe("the delete dialog's requirements row (slice 4a, after step 3)", () => {
  it("names the requirements that lose the entity from their scope, singular and plural", () => {
    expect(requirementsImpactRow(["REQ-101", "REQ-102", "REQ-103", "REQ-105"])).toEqual(["4 requirements", "lose it from their scope: REQ-101, REQ-102, REQ-103, REQ-105"]);
    expect(requirementsImpactRow(["REQ-104"])).toEqual(["1 requirement", "loses it from its scope: REQ-104"]);
    expect(requirementsImpactRow([])).toEqual(["0 requirements", "–"]);
  });

  it("names the first five keys and counts the rest", () => {
    const keys = Array.from({ length: 8 }, (_, i) => `REQ-${101 + i}`);
    expect(requirementsImpactRow(keys)).toEqual(["8 requirements", "lose it from their scope: REQ-101, REQ-102, REQ-103, REQ-104, REQ-105 and 3 more"]);
    expect(requirementsImpactRow(keys.slice(0, 5))[1]).toBe("lose it from their scope: REQ-101, REQ-102, REQ-103, REQ-104, REQ-105");
  });
});

describe("copies in the delete previews (slice 10c, F7, F8)", () => {
  const { customer, salesOrder, customerId, email } = ids;
  const C1 = "01900000-0000-7000-8000-0000000c0001";
  const C2 = "01900000-0000-7000-8000-0000000c0002";
  const C3 = "01900000-0000-7000-8000-0000000c0003";
  const entities = [entity(customer), entity(salesOrder)];
  const attributes = [
    attribute(customerId),
    attribute(email),
    attribute(C1, { entity_id: salesOrder, name: "customer_id", copied_from_attribute_id: customerId }),
    // a copy in Customer itself goes with Customer
    attribute(C2, { entity_id: customer, name: "parent_id", copied_from_attribute_id: customerId }),
    // a deleted copy loses nothing
    attribute(C3, { entity_id: salesOrder, name: "old_id", copied_from_attribute_id: email, deleted_at: NOW }),
  ];

  it("lists an attribute's live copies for its delete, by entity and name", () => {
    expect(attributeCopiesImpact(attributes, entities, customerId).map((c) => c.label)).toEqual(["Customer.parent_id", "Sales Order.customer_id"]);
    expect(attributeCopiesImpact(attributes, entities, email)).toEqual([]);
  });

  it("lists in an entity's impact only the copies in other entities", () => {
    const impact = entityImpact({ entity: entity(customer), attributes, entities, mappings: [], mappingInputs: [], relationships: [], canvasItems: [] }, { canvases: [], projects: [], projectCanvases: [] });
    expect(impact.copies).toEqual([{ id: C1, label: "Sales Order.customer_id" }]);
    expect(impact.attributes).toBe(3);
  });

  it("words D-47's row for copies, singular and plural, five named and the rest counted, no row without copies", () => {
    expect(copiesImpactRow(["Order.customer_id"])).toEqual(["1 copy", "loses its original: Order.customer_id"]);
    expect(copiesImpactRow(["Invoice.customer_id", "Order.customer_id"])).toEqual(["2 copies", "lose their original: Invoice.customer_id, Order.customer_id"]);
    const many = Array.from({ length: 7 }, (_, i) => `E${i}.customer_id`);
    expect(copiesImpactRow(many)).toEqual(["7 copies", "lose their original: E0.customer_id, E1.customer_id, E2.customer_id, E3.customer_id, E4.customer_id and 2 more"]);
    expect(copiesImpactRow([])).toBeNull();
  });
});
