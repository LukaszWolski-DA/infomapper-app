import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MAX_LENGTH } from "../model/type-check";
import { ddlSummaryText, ddlToStandard, readDdl, skippedText, tokenizeSql, typeString } from "./ddl";
import type { StandardRead } from "./standard";

const sample = (name: string) => readFileSync(new URL(`./samples/${name}`, import.meta.url), "utf8");
const table = (r: StandardRead, name: string) => r.tables.find((t) => t.name === name)!;
const column = (r: StandardRead, t: string, c: string) => table(r, t).columns.find((x) => x.name === c)!;
const types = (r: StandardRead, t: string) =>
  table(r, t).columns.map((c) => [c.name, c.data_type, c.type_length, c.type_precision, c.type_scale, c.is_nullable, c.is_primary_key]);
const one = (sql: string, opts = {}) => readDdl(sql, opts);

describe("readDdl: the samples (S7A-03)", () => {
  it("reads the SQL Server script: USE, GO, brackets, a computed column, keys, extended properties, a skipped view", () => {
    const { translation, read } = readDdl(sample("billing.sql"), { fileName: "billing.sql" });
    expect(translation.databases).toEqual(["billing"]);
    expect(translation.defaultSchema).toBe("dbo");
    expect(read.fileName).toBe("billing.sql (translated)");
    expect(read.tables.map((t) => `${t.database}.${t.schema}.${t.name}`)).toEqual(["billing.dbo.invoice", "billing.dbo.invoice_line"]);
    expect(types(read, "invoice")).toEqual([
      ["invoice_id", "bigint", null, null, null, false, true],
      ["invoice_no", "varchar", 20, null, null, false, false],
      ["cust_no", "varchar", 20, null, null, false, false],
      ["issued_on", "date", null, null, null, false, false],
      ["amount", "decimal", null, 12, 2, false, false],
      ["currency", "char", 3, null, null, false, false],
      ["status", "tinyint", null, null, null, true, false],
      ["full_ref", "computed", null, null, null, true, false],
    ]);
    expect(column(read, "invoice_line", "note")).toMatchObject({ type_length: MAX_LENGTH });
    expect(table(read, "invoice_line").columns.filter((c) => c.is_primary_key).map((c) => c.name)).toEqual(["invoice_id", "line_no"]);
    expect(table(read, "invoice_line").foreignKeys).toEqual([
      { name: "FK_invoice_line_invoice", toSchema: "dbo", toTable: "invoice", pairs: [{ from: "invoice_id", to: "invoice_id" }] },
    ]);
    expect(table(read, "invoice").comment).toBe("Invoice header, one row per invoice");
    expect(column(read, "invoice", "cust_no").comment).toBe("Customer number as in CRM");
    expect(translation.summary).toMatchObject({ tables: 2, columns: 14, keys: 3, comments: 2 });
    expect(ddlSummaryText("billing.sql", translation.summary)).toBe("billing.sql: 2 tables, 14 columns, 3 keys, 2 comments");
    expect(skippedText(translation.summary.skipped)).toBe(
      "Skipped: 2 SET statements, 1 CREATE INDEX, 1 default, 1 other ALTER TABLE statement",
    );
    expect(read.warnings).toEqual([
      "Line 16: dbo.invoice.full_ref is a computed column; its type is not in the DDL, so it is imported as “computed”. Set the type in the standard if you need it.",
      "Line 46: view dbo.v_open_invoices skipped. A DDL script does not give the types of a view’s columns; use the catalog query or add the view to the standard.",
    ]);
  });

  it("reads the PostgreSQL dump: COMMENT ON, ALTER TABLE … ADD CONSTRAINT, arrays, the Database field", () => {
    const { translation, read } = readDdl(sample("loyalty_schema.sql"), { fileName: "loyalty_schema.sql", database: "loyaltydb" });
    expect(translation.databases).toEqual(["loyaltydb"]);
    expect(read.tables.map((t) => `${t.database}.${t.schema}.${t.name}`)).toEqual(["loyaltydb.loyalty.member", "loyaltydb.loyalty.points_txn"]);
    expect(types(read, "member")).toEqual([
      ["member_id", "int", null, null, null, false, true],
      ["card_no", "varchar", 16, null, null, false, false],
      ["cust_no", "varchar", 20, null, null, true, false],
      ["joined_at", "timestamptz", null, null, null, false, false],
      ["tier", "text", null, null, null, true, false],
      ["points_balance", "numeric", null, 12, 0, true, false],
    ]);
    // fractional seconds stay (step 1, answer 4); an array keeps its brackets
    expect(column(read, "points_txn", "booked_at")).toMatchObject({ data_type: "timestamp", type_precision: 3 });
    expect(column(read, "points_txn", "tags")).toMatchObject({ data_type: "text[]" });
    expect(column(read, "points_txn", "reason")).toMatchObject({ data_type: "char", type_length: 4 });
    expect(table(read, "member").comment).toBe("Loyalty programme members");
    expect(column(read, "member", "card_no").comment).toBe("Number printed on the card");
    expect(table(read, "points_txn").foreignKeys).toEqual([
      { name: "points_txn_member_fk", toSchema: "loyalty", toTable: "member", pairs: [{ from: "member_id", to: "member_id" }] },
    ]);
    expect(skippedText(translation.summary.skipped)).toBe(
      "Skipped: 2 SET statements, 1 CREATE SCHEMA, 2 other ALTER TABLE statements, 1 CREATE SEQUENCE, 1 CREATE INDEX, 1 GRANT statement",
    );
    expect(read.warnings).toEqual([
      "Line 31: view loyalty.v_balances skipped. A DDL script does not give the types of a view’s columns; use the catalog query or add the view to the standard.",
    ]);
  });

  it("reads the Oracle export: quoted upper-case names, NUMBER, VARCHAR2 with units, a timestamp with time zone", () => {
    const { read } = readDdl(sample("hrleg_ddl.sql"), { fileName: "hrleg_ddl.sql", database: "ORCL" });
    expect(read.tables.map((t) => `${t.database}.${t.schema}.${t.name}`)).toEqual(["ORCL.HRLEG.DEPARTMENTS", "ORCL.HRLEG.EMPLOYEES"]);
    expect(types(read, "EMPLOYEES")).toEqual([
      ["EMP_ID", "number", null, 10, 0, false, true],
      ["EMP_NO", "varchar2", 10, null, null, false, false],
      ["LAST_NAME", "varchar2", 50, null, null, true, false],
      ["HIRED_ON", "date", null, null, null, true, false],
      ["SALARY", "number", null, 12, 2, true, false],
      ["DEPT_ID", "number", null, 10, 0, true, false],
      ["UPDATED_AT", "timestamptz", null, 6, null, true, false],
    ]);
    expect(table(read, "EMPLOYEES").foreignKeys).toEqual([
      { name: "FK_EMP_DEPT", toSchema: "HRLEG", toTable: "DEPARTMENTS", pairs: [{ from: "DEPT_ID", to: "DEPT_ID" }] },
    ]);
    expect(table(read, "EMPLOYEES").comment).toBe("Employees, current and former");
    expect(column(read, "EMPLOYEES", "EMP_NO").comment).toBe("Personnel number");
    expect(read.warnings).toEqual([]);
  });

  it("gives the translated standard as CSV that reads back to the same tables", () => {
    const { translation, read } = readDdl(sample("billing.sql"), { fileName: "billing.sql" });
    const header = translation.standard.split("\n", 1)[0];
    expect(header).toBe("database,schema,table,object_type,file_format,row_count,table_comment,column,ordinal,data_type,length,precision,scale,nullable,primary_key,fk_name,fk_ref_schema,fk_ref_table,fk_ref_column,column_comment,classifications");
    expect(translation.standard).toContain("billing,dbo,invoice_line,table,,,,note,6,nvarchar(max),");
    expect(read.columnCount).toBe(14);
  });
});

describe("readDdl: database and schema (item 16)", () => {
  const sql = "CREATE TABLE t (a int);";

  it("database from USE, else three-part names, else the field, else the file name, else “database”", () => {
    expect(one("USE [sales]\nGO\nCREATE TABLE t (a int)\nGO", { database: "field" }).read.tables[0]!.database).toBe("sales");
    expect(one("CREATE TABLE erp.inv.items (a int);", { database: "field" }).read.tables[0]).toMatchObject({ database: "erp", schema: "inv" });
    expect(one(sql, { database: "field", fileName: "x.sql" }).read.tables[0]!.database).toBe("field");
    expect(one(sql, { fileName: "warehouse.ddl" }).read.tables[0]!.database).toBe("warehouse");
    expect(one(sql).read.tables[0]!.database).toBe("database");
  });

  it("unqualified schema: the field, else dbo or public from the script's signs, else default", () => {
    expect(one(sql, { schema: "ref" }).translation.defaultSchema).toBe("ref");
    expect(one("CREATE TABLE t (a int IDENTITY(1,1));").translation.defaultSchema).toBe("dbo");
    expect(one("CREATE TABLE [dbo].[t] ([a] int);\nCREATE TABLE u (b int);").read.tables.map((t) => t.schema)).toEqual(["dbo", "dbo"]);
    expect(one("CREATE TABLE t (a serial, b text DEFAULT 'x'::text);").translation.defaultSchema).toBe("public");
    expect(one(sql).read.tables[0]!.schema).toBe("default");
  });
});

describe("readDdl: what it reads (item 16)", () => {
  it("column and table constraints, inline references and references to a primary key", () => {
    const { read } = one(
      "CREATE TABLE a (id int PRIMARY KEY, code varchar(5) NOT NULL);\n" +
        "CREATE TABLE b (id int NOT NULL, a_id int REFERENCES a, a_code varchar(5) CONSTRAINT fk_code REFERENCES a(code), PRIMARY KEY (id));",
    );
    expect(table(read, "a").columns.map((c) => [c.name, c.is_primary_key, c.is_nullable])).toEqual([["id", true, false], ["code", false, false]]);
    expect(table(read, "b").foreignKeys).toEqual([
      { name: "FK_b_a_id", toSchema: "default", toTable: "a", pairs: [{ from: "a_id", to: "id" }] },
      { name: "fk_code", toSchema: "default", toTable: "a", pairs: [{ from: "a_code", to: "code" }] },
    ]);
  });

  it("ALTER TABLE … ADD a column, several columns, a key; COMMENT on a column in its definition (MySQL)", () => {
    const { read } = one(
      "CREATE TABLE t (a int COMMENT 'The a');\nALTER TABLE t ADD COLUMN b varchar(3);\nALTER TABLE t ADD (c date, d date);\nALTER TABLE t ADD CONSTRAINT pk_t PRIMARY KEY (a);",
    );
    expect(table(read, "t").columns.map((c) => [c.name, c.is_primary_key])).toEqual([["a", true], ["b", false], ["c", false], ["d", false]]);
    expect(column(read, "t", "a").comment).toBe("The a");
  });

  it("separates statements by ; GO and / on their own line; reads backticks; skips comments", () => {
    const { read } = one("/* header */\nCREATE TABLE `x` (`a` int) -- note\n/\nCREATE TABLE y (b int)\nGO\n");
    expect(read.tables.map((t) => t.name)).toEqual(["x", "y"]);
  });

  it("an unnamed MS_Description with positional arguments", () => {
    const { read } = one(
      "CREATE TABLE [dbo].[t] ([a] int)\nGO\nEXEC sp_addextendedproperty N'MS_Description', N'Table t', N'SCHEMA', N'dbo', N'TABLE', N't'\nGO\nEXEC sp_addextendedproperty N'Other', N'x', N'SCHEMA', N'dbo', N'TABLE', N't'\nGO",
    );
    expect(table(read, "t").comment).toBe("Table t");
  });

  it("keeps type parameters, Oracle's * precision and max; reads aliases as the catalog names them", () => {
    const { read } = one("CREATE TABLE t (a datetime2(3), b NUMBER(*,0), c varchar(MAX), d character varying(9), e integer, f bool);");
    expect(types(read, "t").map((r) => r.slice(0, 5))).toEqual([
      ["a", "datetime2", null, 3, null],
      ["b", "number", null, 38, 0],
      ["c", "varchar", MAX_LENGTH, null, null],
      ["d", "varchar", 9, null, null],
      ["e", "int", null, null, null],
      ["f", "boolean", null, null, null],
    ]);
  });
});

describe("readDdl: what it skips, with a warning (item 17)", () => {
  it("each skip and warning with its text", () => {
    const { read, translation } = one(
      [
        "CREATE VIEW v AS SELECT 1;",
        "CREATE TABLE copy AS SELECT * FROM t;",
        "CREATE TABLE t (a int, a int);",
        "CREATE TABLE t (b int);",
        "ALTER TABLE missing ADD c int;",
        "CREATE TABLE broken (a int;",
      ].join("\n"),
    );
    expect(read.warnings).toEqual([
      "Line 1: view v skipped. A DDL script does not give the types of a view’s columns; use the catalog query or add the view to the standard.",
      "Line 2: default.copy is created from a query (CREATE TABLE … AS SELECT); its columns are not in the DDL. Table skipped.",
      "Line 3: t.a is defined twice; the second definition is skipped.",
      "Line 4: default.t is created twice; the second CREATE TABLE is skipped.",
      "Line 5: ALTER TABLE on missing, which this script does not create. Skipped.",
      "Line 6: the parentheses of default.broken do not close. Table skipped.",
    ]);
    expect(translation.summary.tables).toBe(1);
  });

  it("counts indexes, sequences, grants, defaults and unique, check and index clauses", () => {
    const { translation } = one(
      "CREATE TABLE t (a int, b int, UNIQUE (b), CHECK (a > 0));\nCREATE INDEX i ON t (a);\nCREATE SEQUENCE s;\nGRANT SELECT ON t TO r;\nALTER TABLE t ADD DEFAULT 0 FOR a;\nDROP TABLE old;\nSELECT 1;",
    );
    expect(skippedText(translation.summary.skipped)).toBe(
      "Skipped: 2 unique, check and index clauses, 1 CREATE INDEX, 1 CREATE SEQUENCE, 1 GRANT statement, 1 default, 1 DROP statement, 1 other statement",
    );
  });

  it("a script without a table is an error", () => {
    const { read } = one("CREATE VIEW v AS SELECT 1;\nSET x = 1;");
    expect(read.errors).toEqual(["No CREATE TABLE statement was found in the script."]);
    expect(read.warnings).toHaveLength(1);
  });
});

describe("tokenizeSql and typeString", () => {
  it("reads strings with doubled quotes and N'…' prefixes, and counts lines", () => {
    const toks = tokenizeSql("a 'it''s'\nN'x' -- c\n[b c]");
    expect(toks.map((t) => [t.t, t.v, t.line])).toEqual([
      ["id", "a", 1],
      ["str", "it's", 1],
      ["str", "x", 2],
      ["id", "b c", 3],
    ]);
  });

  it("joins type words, aliases and parameters", () => {
    expect(typeString(["DOUBLE"], null)).toBe("double precision");
    expect(typeString(["timestamp", "with", "time", "zone"], null)).toBe("timestamptz");
    expect(typeString(["text", "[]"], null)).toBe("text[]");
  });

  it("is used through ddlToStandard as well", () => {
    expect(ddlToStandard("CREATE TABLE t (a int);").summary).toEqual({ tables: 1, columns: 1, keys: 0, comments: 0, skipped: {} });
  });
});
