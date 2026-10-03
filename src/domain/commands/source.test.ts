import { describe, expect, it } from "vitest";
import { access, archived, ids, makeCtx, NOW, sourceSystem, sourceTable } from "../__fixtures__/domain";
import { createSourceTable } from "./source";

const input = { systemName: "crm", databaseName: "crmprod", schemaName: "dbo", name: "address", columns: "addr_id int\nline1 varchar(255)\namount decimal(18,2)" };
const state = { systems: [sourceSystem()], tables: [sourceTable()] };

describe("createSourceTable (S1A-13)", () => {
  it("creates the table and its columns with types and lengths, reusing the system by name", () => {
    const r = createSourceTable(makeCtx(), access("modeler"), state, input);
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value).toMatchObject({ sourceSystemId: ids.crm, createdSystem: false });
    expect(r.writeSet.writes).toMatchObject([
      {
        kind: "insert",
        table: "source_table",
        row: { id: r.value.sourceTableId, source_system_id: ids.crm, database_name: "crmprod", schema_name: "dbo", name: "address", object_type: "table" },
      },
      { table: "source_column", row: { name: "addr_id", ordinal: 1, data_type: "int", type_length: null, source_table_id: r.value.sourceTableId } },
      { table: "source_column", row: { name: "line1", ordinal: 2, data_type: "varchar", type_length: 255 } },
      { table: "source_column", row: { name: "amount", ordinal: 3, data_type: "decimal", type_precision: 18, type_scale: 2 } },
    ]);
    expect(new Set(r.writeSet.events.map((e) => e.change_group_id)).size).toBe(1);
  });

  it("creates the system when there is none with that name", () => {
    const r = createSourceTable(makeCtx(), access("owner"), state, { ...input, systemName: "ERP" });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value.createdSystem).toBe(true);
    expect(r.writeSet.writes[0]).toMatchObject({ kind: "insert", table: "source_system", row: { id: r.value.sourceSystemId, name: "ERP" } });
    expect(r.writeSet.writes[1]).toMatchObject({ table: "source_table", row: { source_system_id: r.value.sourceSystemId } });
  });

  it("refuses a table that already exists in the same system, database and schema", () => {
    expect(createSourceTable(makeCtx(), access("owner"), state, { ...input, name: "customer" })).toMatchObject({
      ok: false,
      error: { code: "conflict", message: "CRM / crmprod.dbo.customer already exists." },
    });
    expect(createSourceTable(makeCtx(), access("owner"), { ...state, tables: [sourceTable({ deleted_at: NOW })] }, { ...input, name: "customer" }).ok).toBe(true);
    expect(createSourceTable(makeCtx(), access("owner"), state, { ...input, name: "customer", schemaName: "stage" }).ok).toBe(true);
  });

  it("passes on a column line that cannot be read", () => {
    expect(createSourceTable(makeCtx(), access("owner"), state, { ...input, columns: "a int\nb" })).toMatchObject({
      ok: false,
      error: { code: "invalid", message: expect.stringMatching(/^Line 2:/) },
    });
  });

  it("needs every name and is refused to reviewers and in an archived workspace", () => {
    expect(createSourceTable(makeCtx(), access("owner"), state, { ...input, schemaName: "" })).toMatchObject({ ok: false, error: { code: "invalid" } });
    expect(createSourceTable(makeCtx(), access("reviewer"), state, input)).toMatchObject({ ok: false, error: { code: "forbidden" } });
    expect(createSourceTable(makeCtx(), access("owner", archived), state, input)).toMatchObject({ ok: false, error: { code: "archived" } });
  });
});
