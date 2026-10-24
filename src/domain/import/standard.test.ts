import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MAX_LENGTH } from "../model/type-check";
import { MAX_IMPORT_ROWS, NOT_READ_YET, readStandard, STANDARD_FIELDS, STANDARD_TEMPLATE, TYPE_KEPT, type StandardRead } from "./standard";

const sample = (name: string) => readFileSync(new URL(`./samples/${name}`, import.meta.url), "utf8");
const HEAD = STANDARD_FIELDS.join(",");
const ok = (text: string, name = "test.csv"): StandardRead => {
  const r = readStandard(text, name);
  if (r.errors.length) throw new Error(r.errors.join(" "));
  return r;
};
const table = (r: StandardRead, name: string) => r.tables.find((t) => t.name === name)!;
const column = (r: StandardRead, t: string, c: string) => table(r, t).columns.find((x) => x.name === c)!;
const typeOf = (r: StandardRead, t: string, c: string) => {
  const { data_type, type_length, type_precision, type_scale } = column(r, t, c);
  return [data_type, type_length, type_precision, type_scale];
};

describe("readStandard: the samples (S7A-01)", () => {
  it("reads the CRM sample: tables, types, keys, a foreign key, comments and classifications", () => {
    const r = ok(sample("crm_snapshot_2026-10-20.csv"), "crm_snapshot_2026-10-20.csv");
    expect(r.tables.map((t) => `${t.database}.${t.schema}.${t.name}`)).toEqual([
      "crmprod.dbo.customers",
      "crmprod.dbo.customer_addresses",
      "crmprod.dbo.customer_consents",
      "crmprod.stage.customers_load",
    ]);
    expect(r.columnCount).toBe(24);
    expect(table(r, "customers")).toMatchObject({ objectType: "table", fileFormat: null, rowCount: 184120, comment: "Customer master" });
    expect(column(r, "customers", "cust_id")).toMatchObject({ ordinal: 1, data_type: "int", is_primary_key: true, is_nullable: false, comment: null });
    expect(column(r, "customers", "cust_no")).toMatchObject({
      type_length: 25,
      is_nullable: false,
      is_business_key: true,
      is_pii: false,
      classifications: ["BK"],
      comment: "Customer number shown to the customer",
    });
    expect(column(r, "customers", "email_addr")).toMatchObject({ is_pii: true, type_length: 255 });
    expect(typeOf(r, "customers_load", "payload")).toEqual(["nvarchar", MAX_LENGTH, null, null]);
    expect(column(r, "customer_addresses", "cust_id")).toMatchObject({ is_foreign_key: true });
    expect(table(r, "customer_addresses").foreignKeys).toEqual([
      { name: "FK_customer_addresses_customers", toSchema: "dbo", toTable: "customers", pairs: [{ from: "cust_id", to: "cust_id" }] },
    ]);
    // P11: only Business key and PII are read; the others are listed once per table
    expect(r.warnings).toEqual([
      NOT_READ_YET("TECH", "dbo.customers"),
      NOT_READ_YET("Effective date", "dbo.customer_consents"),
      NOT_READ_YET("Load date", "stage.customers_load"),
      "Row 26: stage.customers_load.batch_ref has no data_type. Column skipped.",
    ]);
  });

  it("reads the HR sample, with a foreign key to its own table", () => {
    const r = ok(sample("hr_snapshot_2026-10-20.csv"));
    expect(r.tables.map((t) => t.name)).toEqual(["employees", "departments"]);
    expect(table(r, "employees").foreignKeys.map((f) => `${f.name} → ${f.toTable}`)).toEqual([
      "FK_employees_departments → departments",
      "FK_employees_manager → employees",
    ]);
    expect(r.warnings).toEqual([]);
  });

  it("reads the flat files sample: object type file, the format, logical types", () => {
    const r = ok(sample("reference_files.csv"));
    expect(r.tables.map((t) => [t.name, t.objectType, t.fileFormat])).toEqual([
      ["country_codes", "file", "xlsx"],
      ["fx_rates", "file", "csv"],
      ["product_hierarchy", "file", "json"],
      ["sales_targets", "file", "txt"],
    ]);
    expect(typeOf(r, "country_codes", "iso_code")).toEqual(["string", 2, null, null]);
    expect(typeOf(r, "fx_rates", "rate_to_pln")).toEqual(["decimal", null, 18, 6]);
    expect(column(r, "product_hierarchy", "category.code")).toMatchObject({ type_length: 10 });
    expect(r.warnings).toEqual([NOT_READ_YET("Effective date", "ref_data.fx_rates")]);
  });

  it("reads the template", () => {
    const r = ok(STANDARD_TEMPLATE);
    expect(r.tables.map((t) => [t.name, t.objectType, t.comment, t.columns.map((c) => [c.name, c.ordinal, c.is_business_key])])).toEqual([
      ["customers", "table", "Customer master", [["cust_no", 2, true]]],
      ["country_codes", "file", "Country list kept by Finance", [["iso_code", 1, true]]],
    ]);
  });
});

describe("readStandard: the catalog queries' results (S7A-02, S7A-16's files)", () => {
  it("reads SQL Server's result as SSMS copies it: tabs, NULL cells, the length in its own column", () => {
    const r = ok(sample("crm_sqlserver_catalog.tsv"));
    expect(r.delimiter).toBe("\t");
    expect(r.fields.has("file_format")).toBe(false);
    expect(r.tables.map((t) => [t.name, t.rowCount, t.comment])).toEqual([
      ["customer_addresses", 240118, null],
      ["customers", 182340, null],
    ]);
    expect(typeOf(r, "customers", "cust_no")).toEqual(["varchar", 20, null, null]);
    expect(typeOf(r, "customers", "created_ts")).toEqual(["datetime2", null, 7, null]);
    expect(column(r, "customers", "fname")).toMatchObject({ comment: null, classifications: [] });
    expect(r.warnings).toEqual([]);
  });

  it("reads PostgreSQL's result as psql writes it", () => {
    const r = ok(sample("web_postgres_catalog.csv"));
    expect(typeOf(r, "web_users", "email")).toEqual(["varchar", 255, null, null]);
    expect(typeOf(r, "web_users", "user_id")).toEqual(["uuid", null, null, null]);
  });

  it("reads Oracle's result as SQL Developer exports it: quoted, upper case, number and its scale", () => {
    const r = ok(sample("hr_oracle_catalog.csv"));
    expect(typeOf(r, "EMPLOYEES", "EMP_ID")).toEqual(["number", null, 10, 0]);
    expect(typeOf(r, "EMPLOYEES", "SALARY")).toEqual(["number", null, 12, 2]);
    expect(typeOf(r, "EMPLOYEES", "EMP_NO")).toEqual(["varchar2", 10, null, null]);
    expect(typeOf(r, "EMPLOYEES", "UPDATED_AT")).toEqual(["timestamp with time zone", null, 6, null]);
    // Oracle's INTEGER: NUMBER with scale 0 and no precision; a CLOB
    const more = ok('"database","schema","table","column","data_type","precision","scale"\n"ORCL","HRLEG","T","GRADE","NUMBER","",0\n"ORCL","HRLEG","T","NOTES","CLOB","",""');
    expect(typeOf(more, "T", "GRADE")).toEqual(["number", null, null, 0]);
    expect(typeOf(more, "T", "NOTES")).toEqual(["clob", null, null, null]);
    expect(table(r, "EMPLOYEES")).toMatchObject({ comment: "Employees, current and former", rowCount: 2140 });
    expect(table(r, "EMPLOYEES").foreignKeys).toEqual([
      { name: "FK_EMP_DEPT", toSchema: "HRLEG", toTable: "DEPARTMENTS", pairs: [{ from: "DEPT_ID", to: "DEPT_ID" }] },
    ]);
  });
});

describe("readStandard: reading rules (item 8)", () => {
  it("matches headers ignoring case and spaces, with the aliases, in any order; other columns are ignored", () => {
    const r = ok("Column_Name;Table Name;Schema_Name;DB;Type;Is Nullable;PK;Ordinal Position;Comment;Tags;Owner\nid;t;s;d;int;no;yes;3;The key;BK;Ann");
    expect(r.delimiter).toBe(";");
    expect(column(r, "t", "id")).toMatchObject({ ordinal: 3, is_nullable: false, is_primary_key: true, comment: "The key", is_business_key: true });
    expect([...r.fields].sort()).toEqual(["classifications", "column", "column_comment", "data_type", "database", "nullable", "ordinal", "primary_key", "schema", "table"]);
  });

  it("drops a leading BOM and reads NULL cells as empty", () => {
    const r = ok(`﻿${HEAD}\nd,s,t,NULL,NULL,NULL,NULL,c,NULL,varchar,40,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL`);
    expect(table(r, "t")).toMatchObject({ objectType: "table", rowCount: null, comment: null });
    expect(column(r, "t", "c")).toMatchObject({ ordinal: 1, type_length: 40, is_nullable: true, comment: null });
  });

  it("takes length, precision and scale from their own columns when the type has none; max and -1 are max", () => {
    const r = ok("database,schema,table,column,data_type,length,precision,scale\nd,s,t,a,varchar,max,,\nd,s,t,b,varbinary,-1,,\nd,s,t,c,decimal,,18,2\nd,s,t,e,varchar(10),20,,");
    expect(typeOf(r, "t", "a")).toEqual(["varchar", MAX_LENGTH, null, null]);
    expect(typeOf(r, "t", "b")).toEqual(["varbinary", MAX_LENGTH, null, null]);
    expect(typeOf(r, "t", "c")).toEqual(["decimal", null, 18, 2]);
    expect(typeOf(r, "t", "e")).toEqual(["varchar", 10, null, null]);
  });

  it("gives datetime2 and timestamp their default precision; a precision column replaces it, 0 included (step 6)", () => {
    const r = ok("database,schema,table,column,data_type,precision\nd,s,t,a,datetime2,\nd,s,t,b,datetime2,3\nd,s,t,c,datetime2,0\nd,s,t,e,timestamp,\nd,s,t,f,time,\nd,s,t,g,datetimeoffset(2),5");
    expect(typeOf(r, "t", "a")).toEqual(["datetime2", null, 7, null]);
    expect(typeOf(r, "t", "b")).toEqual(["datetime2", null, 3, null]);
    expect(typeOf(r, "t", "c")).toEqual(["datetime2", null, 0, null]);
    expect(typeOf(r, "t", "e")).toEqual(["timestamp", null, 6, null]);
    expect(typeOf(r, "t", "f")).toEqual(["time", null, null, null]);
    expect(typeOf(r, "t", "g")).toEqual(["datetimeoffset", null, 2, null]); // written in the type: the column is not read
  });

  it("reads SQL Server's timestamp as rowversion when the query channel says SQL Server; a file keeps timestamp (step 7)", () => {
    const text = "database,schema,table,column,data_type\nd,dbo,t,ver,timestamp\nd,dbo,t,at,datetime2";
    const sqlServer = readStandard(text, "pasted query result", { vendor: "sqlserver" });
    expect(typeOf(sqlServer, "t", "ver")).toEqual(["rowversion", null, null, null]);
    expect(typeOf(sqlServer, "t", "at")).toEqual(["datetime2", null, 7, null]);
    // PostgreSQL's and Oracle's timestamp is a date with fractional seconds
    for (const vendor of ["postgres", "oracle"] as const) expect(typeOf(readStandard(text, "q", { vendor }), "t", "ver")).toEqual(["timestamp", null, 6, null]);
    // a file in the standard cannot tell the vendor (known-limitations.md)
    expect(typeOf(ok(text), "t", "ver")).toEqual(["timestamp", null, 6, null]);
  });

  it("keeps fractional seconds as precision; a type it cannot read stays as written, with a warning", () => {
    const r = ok("database,schema,table,column,data_type\nd,s,t,a,datetime2(7)\nd,s,t,b,timestamp(3)\nd,s,t,c,integer[]\nd,s,t,e,varchar(0)");
    expect(typeOf(r, "t", "a")).toEqual(["datetime2", null, 7, null]);
    expect(typeOf(r, "t", "b")).toEqual(["timestamp", null, 3, null]);
    expect(typeOf(r, "t", "c")).toEqual(["integer[]", null, null, null]);
    expect(r.warnings).toEqual([TYPE_KEPT("integer[]", "s.t.c"), TYPE_KEPT("varchar(0)", "s.t.e")]);
    expect(TYPE_KEPT("integer[]", "loyalty.points_txn.tags")).toBe(
      "Type “integer[]” of loyalty.points_txn.tags is kept as written; the type check cannot judge mappings from this column.",
    );
  });

  it("reads yes and no in their forms; nullable defaults to yes, and to no for a key", () => {
    const rows = ["y", "true", "1", "T", "no", "N", ""].map((v, i) => `d,s,t,c${i},int,${v},`);
    const r = ok(`database,schema,table,column,data_type,nullable,primary_key\n${rows.join("\n")}\nd,s,t,k,int,,yes`);
    expect(table(r, "t").columns.map((c) => c.is_nullable)).toEqual([true, true, true, true, false, false, true, false]);
  });

  it("uses the file order when there is no ordinal; the first non-empty table comment and row count count", () => {
    const r = ok("database,schema,table,column,data_type,table_comment,row_count\nd,s,t,a,int,,\nd,s,t,b,int,First,12\nd,s,t,c,int,Second,99");
    expect(table(r, "t").columns.map((c) => c.ordinal)).toEqual([1, 2, 3]);
    expect(table(r, "t")).toMatchObject({ comment: "First", rowCount: 12 });
  });

  it("groups tables by database, schema and name ignoring case", () => {
    const r = ok("database,schema,table,column,data_type\nD,S,T,a,int\nd,s,t,b,int");
    expect(r.tables).toHaveLength(1);
    expect(r.tables[0]).toMatchObject({ key: "d|s|t", database: "D", name: "T" });
  });

  it("makes a table with a file format a file; view and file object types", () => {
    const r = ok("database,schema,table,column,data_type,object_type,file_format\nd,s,v,a,int,VIEW,\nd,s,f,a,string,,.CSV\nd,s,g,a,string,file,");
    expect(r.tables.map((t) => [t.name, t.objectType, t.fileFormat])).toEqual([["v", "view", null], ["f", "file", "csv"], ["g", "file", null]]);
  });

  it("reads a column in two foreign keys from two rows: the second adds to its keys", () => {
    const r = ok(
      "database,schema,table,column,data_type,fk_name,fk_ref_table,fk_ref_column\n" +
        "d,s,line,order_id,int,FK_line_order,orders,id\nd,s,line,order_id,int,FK_line_shipment,shipments,order_id\nd,s,line,product_id,int,,,",
    );
    expect(table(r, "line").columns.map((c) => [c.name, c.is_foreign_key])).toEqual([["order_id", true], ["product_id", false]]);
    expect(table(r, "line").foreignKeys.map((f) => [f.name, f.toSchema, f.toTable, f.pairs])).toEqual([
      ["FK_line_order", "s", "orders", [{ from: "order_id", to: "id" }]],
      ["FK_line_shipment", "s", "shipments", [{ from: "order_id", to: "order_id" }]],
    ]);
    expect(r.warnings).toEqual([]);
  });

  it("reads a key over two columns from two rows", () => {
    const r = ok("database,schema,table,column,data_type,fk_name,fk_ref_schema,fk_ref_table,fk_ref_column\nd,s,t,a,int,FK_t_u,x,u,ua\nd,s,t,b,int,FK_t_u,x,u,ub");
    expect(table(r, "t").foreignKeys).toEqual([{ name: "FK_t_u", toSchema: "x", toTable: "u", pairs: [{ from: "a", to: "ua" }, { from: "b", to: "ub" }] }]);
  });

  it("reads classifications by code or name, separated by ; or |", () => {
    const r = ok('database,schema,table,column,data_type,classifications\nd,s,t,a,int,"BK; PII"\nd,s,t,b,int,Business key|personal data\nd,s,t,c,int,pii');
    expect(table(r, "t").columns.map((c) => [c.is_business_key, c.is_pii])).toEqual([[true, true], [true, true], [false, true]]);
  });
});

describe("readStandard: errors stop the import (item 9)", () => {
  it("an empty file", () => {
    expect(readStandard("", "x.csv").errors).toEqual(["The file is empty."]);
    expect(readStandard("﻿ \n\n", "x.csv").errors).toEqual(["The file is empty."]);
  });

  it("a missing required column, or several", () => {
    expect(readStandard("database,schema,column,data_type\nd,s,c,int", "x.csv").errors).toEqual([
      "The file has no “table” column. Name the columns as in the standard below.",
    ]);
    expect(readStandard("name,type\na,int", "x.csv").errors).toEqual([
      "The file has no “database”, “schema”, “table”, “column” columns. Name the columns as in the standard below.",
    ]);
  });

  it("no usable rows: only a header, or every row skipped", () => {
    expect(readStandard(HEAD, "x.csv").errors).toEqual(["The file has no usable rows."]);
    const r = readStandard("database,schema,table,column,data_type\nd,s,t,,int\nd,s,t,c,", "x.csv");
    expect(r.errors).toEqual(["The file has no usable rows."]);
    expect(r.warnings).toHaveLength(2);
  });

  it("more rows than one import takes (item 12)", () => {
    const text = `database,schema,table,column,data_type\n${Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => `d,s,t,c${i},int`).join("\n")}`;
    expect(readStandard(text, "x.csv").errors).toEqual(["The file has 30,001 rows; one import takes up to 30,000. Split it by database or schema."]);
    expect(readStandard(text, "x.csv", { maxRows: Infinity }).errors).toEqual([]);
  });
});

describe("readStandard: warnings do not stop it (item 10, P11)", () => {
  it("a row without database, schema, table or column is skipped", () => {
    const r = ok("database,schema,table,column,data_type\n,s,t,c,int\nd,,t,c,int\nd,s,,c,int\nd,s,t,,int\nd,s,t,ok,int");
    expect(r.warnings).toEqual([2, 3, 4, 5].map((n) => `Row ${n}: database, schema, table and column are required. Row skipped.`));
    expect(r.columnCount).toBe(1);
  });

  it("a column without data_type is skipped", () => {
    const r = ok("database,schema,table,column,data_type\nd,s,t,a,\nd,s,t,b,NULL\nd,s,t,c,int");
    expect(r.warnings).toEqual(["Row 2: s.t.a has no data_type. Column skipped.", "Row 3: s.t.b has no data_type. Column skipped."]);
  });

  it("a column twice in a table: the second row is skipped", () => {
    const r = ok("database,schema,table,column,data_type\nd,s,t,a,int\nd,s,t,A,varchar(5)");
    expect(r.warnings).toEqual(["Row 3: s.t.A appears twice. Second row skipped."]);
    expect(typeOf(r, "t", "a")).toEqual(["int", null, null, null]);
  });

  it("names the file's line, also after blank lines and a quoted line break", () => {
    const r = ok('database,schema,table,column,data_type,column_comment\n\nd,s,t,a,int,"two\nlines"\nd,s,t,,int,');
    expect(r.warnings).toEqual(["Row 5: database, schema, table and column are required. Row skipped."]);
  });

  it("a classification other than Business key and PII: listed once per table, not read (P11)", () => {
    const r = ok("database,schema,table,column,data_type,classifications\nd,s,t,a,int,TECH\nd,s,t,b,int,tech;BK\nd,s,u,a,int,TECH");
    expect(r.warnings).toEqual([NOT_READ_YET("TECH", "s.t"), NOT_READ_YET("TECH", "s.u")]);
    expect(NOT_READ_YET("TECH", "s.t")).toBe("Classification “TECH” on s.t is not read yet: only Business key and PII are read for now.");
    expect(column(r, "t", "b")).toMatchObject({ is_business_key: true, classifications: ["BK"] });
  });
});

describe("readStandard: P2, the fields the file has", () => {
  it("lists only the standard's columns the file has", () => {
    const r = ok("database,schema,table,column,data_type,extra\nd,s,t,a,int,x");
    expect([...r.fields].sort()).toEqual(["column", "data_type", "database", "schema", "table"]);
  });
});
