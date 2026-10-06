import { describe, expect, it } from "vitest";
import { ids, mapping, mappingInput, sourceColumn } from "../__fixtures__/domain";
import { attributeNamedAfter, planMapColumn } from "./mapping-choice";

const otherTable = "01900000-0000-7000-8000-000000008002";
const webEmail = sourceColumn("01900000-0000-7000-8000-000000009010", { name: "email", source_table_id: otherTable });
const columns = new Map<string, ReturnType<typeof sourceColumn>>([ids.colEmail, ids.colFirstName, ids.colCustId].map((id) => [id, sourceColumn(id)]));
columns.set(webEmail.id, webEmail);
const columnOf = (id: string) => columns.get(id);

describe("planMapColumn (D-48)", () => {
  it("creates a direct mapping when the attribute has none", () => {
    expect(planMapColumn(sourceColumn(ids.colEmail), [], [], columnOf)).toEqual({ kind: "create" });
  });

  it("finds the mapping that already reads the column", () => {
    expect(planMapColumn(sourceColumn(ids.colEmail), [mapping()], [mappingInput()], columnOf)).toEqual({ kind: "exists", mappingId: ids.mapEmail });
  });

  it("pre-selects “Separate mapping” for a column of another table (alternative source)", () => {
    expect(planMapColumn(webEmail, [mapping()], [mappingInput()], columnOf)).toEqual({
      kind: "choose",
      options: [{ kind: "separate" }, { kind: "add", mappingId: ids.mapEmail }],
      preselected: 0,
    });
  });

  it("pre-selects “Add to mapping” for the mapping that reads a column of the same table", () => {
    const other = "01900000-0000-7000-8000-00000000a002";
    const plan = planMapColumn(
      sourceColumn(ids.colFirstName),
      [mapping({ id: other }), mapping()],
      [mappingInput("01900000-0000-7000-8000-00000000b002", { mapping_id: other, source_column_id: webEmail.id }), mappingInput()],
      columnOf,
    );
    expect(plan).toEqual({
      kind: "choose",
      options: [{ kind: "separate" }, { kind: "add", mappingId: other }, { kind: "add", mappingId: ids.mapEmail }],
      preselected: 2,
    });
  });
});

describe("attributeNamedAfter (a column dropped on an entity's header)", () => {
  const attributes = [{ id: "a", name: "Customer_Number" }, { id: "b", name: "email" }];

  it("finds the attribute named like the column, ignoring case", () => {
    expect(attributeNamedAfter(attributes, { name: "customer_number" })?.id).toBe("a");
  });

  it("finds nothing when no attribute has the column's name", () => {
    expect(attributeNamedAfter(attributes, { name: "lname" })).toBeUndefined();
  });
});
