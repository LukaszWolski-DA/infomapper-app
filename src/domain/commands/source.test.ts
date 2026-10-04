import { describe, expect, it } from "vitest";
import {
  access,
  archived,
  attribute,
  canvasItem,
  entity,
  ids,
  makeCtx,
  mapping,
  mappingInput,
  NOW,
  sourceColumn,
  sourceSystem,
  sourceTable,
} from "../__fixtures__/domain";
import { createSourceTable, deleteSourceTable, updateSourceColumn } from "./source";

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

describe("updateSourceColumn", () => {
  const ref = { sourceColumnId: ids.colEmail, expectedVersion: 1 };
  const state = { column: sourceColumn(ids.colEmail) };

  it("changes BK, PII and the comment", () => {
    expect(updateSourceColumn(makeCtx(), access("modeler"), state, { ...ref, isBusinessKey: true, isPii: false, comment: " Main address " })).toMatchObject({
      ok: true,
      value: { column: { is_business_key: true, is_pii: false, comment: "Main address", version: 2 } },
    });
    expect(updateSourceColumn(makeCtx(), access("modeler"), { column: sourceColumn(ids.colEmail, { comment: "x" }) }, { ...ref, comment: "" })).toMatchObject({
      ok: true,
      value: { column: { comment: null } },
    });
  });

  it("does not change name, type or other flags", () => {
    expect(updateSourceColumn(makeCtx(), access("owner"), state, { ...ref, name: "mail" })).toMatchObject({ ok: false, error: { code: "invalid" } });
    expect(updateSourceColumn(makeCtx(), access("owner"), state, { ...ref, isPrimaryKey: true })).toMatchObject({ ok: false, error: { code: "invalid" } });
  });

  it("refuses no change, a stale version, reviewers and an archived workspace", () => {
    expect(updateSourceColumn(makeCtx(), access("owner"), state, { ...ref, isPii: true })).toMatchObject({ ok: false, error: { message: "Nothing to change." } });
    expect(updateSourceColumn(makeCtx(), access("owner"), state, { sourceColumnId: ids.colEmail, expectedVersion: 3, isPii: false })).toMatchObject({
      ok: false,
      error: { code: "stale_version" },
    });
    expect(updateSourceColumn(makeCtx(), access("reviewer"), state, { ...ref, isPii: false })).toMatchObject({ ok: false, error: { code: "forbidden" } });
    expect(updateSourceColumn(makeCtx(), access("admin", archived), state, { ...ref, isPii: false })).toMatchObject({ ok: false, error: { code: "archived" } });
  });
});

describe("deleteSourceTable", () => {
  const columns = [sourceColumn(ids.colCustId), sourceColumn(ids.colEmail), sourceColumn(ids.colFirstName)];
  const free = {
    table: sourceTable(),
    columns,
    canvasItems: [canvasItem(ids.itemCrmCustomer), canvasItem(ids.itemCustomer)],
    mappings: [],
    mappingInputs: [],
    attributes: [],
    entities: [],
  };
  const ref = { sourceTableId: ids.crmCustomer, expectedVersion: 1 };

  it("deletes a table no mapping reads, with its columns and its cards, in one change group", () => {
    const r = deleteSourceTable(makeCtx(), access("modeler"), free, ref);
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value).toEqual({ columns: 3 });
    expect(r.writeSet.writes.map((w) => w.table)).toEqual(["canvas_item", "source_column", "source_column", "source_column", "source_table"]);
    expect(r.writeSet.writes[0]).toMatchObject({ row: { id: ids.itemCrmCustomer, deleted_at: NOW } });
    expect(r.writeSet.events.every((e) => e.operation === "delete" && e.change_group_id === r.writeSet.changeGroupId)).toBe(true);
  });

  it("refuses while a mapping reads one of its columns, and lists the mappings", () => {
    const custMap = mapping({ id: "01900000-0000-7000-8000-00000000a002", attribute_id: ids.customerId });
    const used = {
      ...free,
      mappings: [mapping(), custMap],
      mappingInputs: [mappingInput(), mappingInput("01900000-0000-7000-8000-00000000b002", { mapping_id: custMap.id, source_column_id: ids.colCustId })],
      attributes: [attribute(ids.email), attribute(ids.customerId)],
      entities: [entity(ids.customer)],
    };
    expect(deleteSourceTable(makeCtx(), access("owner"), used, ref)).toMatchObject({
      ok: false,
      error: { code: "conflict", message: "Remove its mappings first. cust_id → Customer.customer_id; email → Customer.email." },
    });
  });

  it("ignores deleted mappings and inputs", () => {
    const oldMapping = { ...free, mappings: [mapping({ deleted_at: NOW })], mappingInputs: [mappingInput()] };
    expect(deleteSourceTable(makeCtx(), access("owner"), oldMapping, ref).ok).toBe(true);
    const removedInput = { ...free, mappings: [mapping()], mappingInputs: [mappingInput(ids.inEmail, { deleted_at: NOW })] };
    expect(deleteSourceTable(makeCtx(), access("owner"), removedInput, ref).ok).toBe(true);
  });

  it("refuses a stale version, reviewers and an archived workspace", () => {
    expect(deleteSourceTable(makeCtx(), access("owner"), free, { sourceTableId: ids.crmCustomer, expectedVersion: 2 })).toMatchObject({
      ok: false,
      error: { code: "stale_version" },
    });
    expect(deleteSourceTable(makeCtx(), access("reviewer"), free, ref)).toMatchObject({ ok: false, error: { code: "forbidden" } });
    expect(deleteSourceTable(makeCtx(), access("owner", archived), free, ref)).toMatchObject({ ok: false, error: { code: "archived" } });
  });
});
