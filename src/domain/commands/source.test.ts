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
import { createSourceTable, deleteSourceTable, NOTE_REMOVED, NOTE_SAVED, setSourceNote } from "./source";

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
    expect(r.value).toEqual({ columns: 3, mappings: 0 });
    expect(r.writeSet.writes.map((w) => w.table)).toEqual(["canvas_item", "source_column", "source_column", "source_column", "source_table"]);
    expect(r.writeSet.writes[0]).toMatchObject({ row: { id: ids.itemCrmCustomer, deleted_at: NOW } });
    expect(r.writeSet.events.every((e) => e.operation === "delete" && e.change_group_id === r.writeSet.changeGroupId)).toBe(true);
  });

  it("deletes the mappings that read its columns with it (slice 7b, Q7: one cascade with the change's Delete…)", () => {
    const custMap = mapping({ id: "01900000-0000-7000-8000-00000000a002", attribute_id: ids.customerId });
    const used = {
      ...free,
      mappings: [mapping(), custMap],
      mappingInputs: [mappingInput(), mappingInput("01900000-0000-7000-8000-00000000b002", { mapping_id: custMap.id, source_column_id: ids.colCustId })],
      attributes: [attribute(ids.email), attribute(ids.customerId)],
      entities: [entity(ids.customer)],
    };
    const r = deleteSourceTable(makeCtx(), access("owner"), used, ref);
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value).toEqual({ columns: 3, mappings: 2 });
    const deleted = r.writeSet.writes.filter((w) => w.table === "mapping" || w.table === "mapping_input").map((w) => [w.table, w.row.id, w.row.deleted_at]);
    expect(deleted).toEqual(
      expect.arrayContaining([
        ["mapping", ids.mapEmail, NOW],
        ["mapping", custMap.id, NOW],
        ["mapping_input", ids.inEmail, NOW],
        ["mapping_input", "01900000-0000-7000-8000-00000000b002", NOW],
      ]),
    );
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

describe("the modeller's note on a table or column (slice 7c, P8, item 15, S7C-07)", () => {
  const table = sourceTable();
  const column = sourceColumn(ids.colEmail);

  it("saves a note as plain text, markup stored escaped, as a mapping's note is", () => {
    const r = setSourceNote(makeCtx(), access("modeler"), { column }, { target: { kind: "source_column", id: column.id }, expectedVersion: 1, note: "Values <b>A</b> & B\n\nsecond" });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value).toEqual({ name: "email", removed: false });
    expect(r.writeSet.writes).toEqual([
      expect.objectContaining({ kind: "update", table: "source_column", row: expect.objectContaining({ note_text: "Values <b>A</b> & B\n\nsecond", note_html: "<p>Values &lt;b&gt;A&lt;/b&gt; &amp; B</p><p>second</p>", version: 2 }) }),
    ]);
    expect(NOTE_SAVED("email")).toBe("Note saved on email");
  });

  it("clears a note on a table; refuses nothing to change and a stale version", () => {
    const noted = { ...table, note_html: "<p>Owned by Finance</p>", note_text: "Owned by Finance" };
    const r = setSourceNote(makeCtx(), access("owner"), { table: noted }, { target: { kind: "source_table", id: table.id }, expectedVersion: 1, note: "  " });
    expect(r.ok && r.value).toEqual({ name: "customer", removed: true });
    expect(r.ok && r.writeSet.writes[0]).toMatchObject({ row: { note_html: null, note_text: null } });
    expect(NOTE_REMOVED("customer")).toBe("Note removed from customer");
    expect(setSourceNote(makeCtx(), access("owner"), { table: noted }, { target: { kind: "source_table", id: table.id }, expectedVersion: 1, note: "Owned by Finance" })).toMatchObject({ ok: false, error: { message: "Nothing to change." } });
    expect(setSourceNote(makeCtx(), access("owner"), { table: noted }, { target: { kind: "source_table", id: table.id }, expectedVersion: 4, note: "x" })).toMatchObject({ ok: false, error: { code: "stale_version" } });
  });

  it("is read-only for reviewers, readers and in an archive (S7C-13)", () => {
    for (const a of [access("reviewer"), access("reader"), access("owner", archived)]) {
      expect(setSourceNote(makeCtx(), a, { column }, { target: { kind: "source_column", id: column.id }, expectedVersion: 1, note: "x" }).ok).toBe(false);
    }
  });
});
