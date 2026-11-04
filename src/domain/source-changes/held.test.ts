import { describe, expect, it } from "vitest";
import { mappingRowIds, tableRowIds } from "./held";

// Slice 14b, O4 (narrow hold, step 3): the rows a change-to-resolve action holds while it is on its way.
const rows = {
  columns: [
    { id: "c1", source_table_id: "t1" },
    { id: "c2", source_table_id: "t1" },
    { id: "c3", source_table_id: "t2" },
  ],
  mappingInputs: [
    { id: "i1", mapping_id: "m1", source_column_id: "c1" },
    // m2 reads two tables: held with both of its inputs
    { id: "i2", mapping_id: "m2", source_column_id: "c2" },
    { id: "i3", mapping_id: "m2", source_column_id: "c3" },
    { id: "i4", mapping_id: "m3", source_column_id: "c3" },
  ],
};

describe("tableRowIds", () => {
  it("holds the tables, their columns, the mappings reading them and all those mappings' inputs", () => {
    expect(tableRowIds(rows, ["t1"]).sort()).toEqual(["c1", "c2", "i1", "i2", "i3", "m1", "m2", "t1"]);
  });

  it("leaves out another table's columns and mappings", () => {
    expect(tableRowIds(rows, ["t2"]).sort()).toEqual(["c3", "i2", "i3", "i4", "m2", "m3", "t2"]);
  });

  it("holds a move's two tables together, each id once", () => {
    const ids = tableRowIds(rows, ["t1", "t2"]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.sort()).toEqual(["c1", "c2", "c3", "i1", "i2", "i3", "i4", "m1", "m2", "m3", "t1", "t2"]);
  });
});

describe("mappingRowIds", () => {
  it("holds the mappings and all their inputs (approve all)", () => {
    expect(mappingRowIds(rows, ["m2"]).sort()).toEqual(["i2", "i3", "m2"]);
  });
});
