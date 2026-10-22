import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  allOf,
  attributeNamed,
  columnNamed,
  editColumn,
  emptyModel,
  importInto,
  LATER,
  systemNamed,
  tableNamed,
  withEntity,
  withMapping,
} from "../__fixtures__/import";
import { applyPlan } from "./apply";
import { readDdl } from "./ddl";
import type { ImportModel } from "./model";
import { buildPlan, importSummary, planCounts, rewriteRule, type ImportPlan, type PlanColumn } from "./plan";
import { readStandard } from "./standard";

const sample = (name: string) => readFileSync(new URL(`./samples/${name}`, import.meta.url), "utf8");
const read = (name: string) => readStandard(sample(name), name);
const csv = (body: string) => readStandard(`database,schema,table,column,ordinal,data_type,nullable,primary_key,column_comment\n${body}`, "test.csv");

const planTable = (plan: ImportPlan, name: string) => plan.tables.find((t) => (t.file?.name ?? t.existing!.name) === name)!;
const planColumn = (plan: ImportPlan, table: string, name: string): PlanColumn =>
  planTable(plan, table).columns.find((c) => c.file?.name === name || c.existing?.name === name)!;
const statuses = (plan: ImportPlan, table: string) => planTable(plan, table).columns.map((c) => `${c.file?.name ?? c.existing!.name}:${c.status}`);
const noChanges = (c: ReturnType<typeof importInto>["changes"]) =>
  [c.tables.insert, c.tables.update, c.columns.insert, c.columns.update, c.relationships.insert, c.relationships.update, c.relationshipColumns.insert, c.relationshipColumns.remove, c.mappings].every(
    (l) => l.length === 0,
  );

/** The demo CRM as the SQL Server catalog gives it, imported into a new system “CRM”. */
function demoCrm() {
  return importInto(emptyModel(), read("crm_sqlserver_catalog.tsv"), { newName: "CRM" }).model;
}

/** The demo CRM with the demo's mappings on customers (seed-model.ts) and Customer's attributes with step 1's lengths. */
function demoCrmWithMappings() {
  let model = demoCrm();
  model = { ...model, columns: model.columns.map((c) => (c.name === "cust_no" ? { ...c, is_business_key: true } : c)) };
  model = withEntity(model, "Customer", [
    { name: "customer_number", type_length: 20 },
    { name: "email", type_length: 120 },
    { name: "birth_date", data_type: "date" },
    { name: "created_at", data_type: "date" },
    { name: "first_name", type_length: 50 },
    { name: "last_name", type_length: 50 },
    { name: "full_name" },
  ]);
  const col = (name: string) => columnNamed(model, "customers", name).id;
  const map = (attr: string, cols: string[], over?: Parameters<typeof withMapping>[3]) => {
    const r = withMapping(model, attributeNamed(model, attr).id, cols.map(col), over);
    model = r.model;
    return r.mappingId;
  };
  const ids = {
    custNo: map("customer_number", ["cust_no"]),
    email: map("email", ["email_addr"]),
    dob: map("birth_date", ["dob"], { status: "review" }),
    created: map("created_at", ["created_ts"], { status: "review", rule: "CAST(created_ts AS date)" }),
    fullName: map("full_name", ["fname", "lname"], { rule: "CONCAT(fname, ' ', lname)" }),
  };
  return { model, ids };
}

describe("a first import (S7A-04)", () => {
  it("HR into a new system: every table, column and relationship is new", () => {
    const { plan, changes, model } = importInto(emptyModel(), read("hr_snapshot_2026-10-20.csv"), { newName: "HR" });
    expect(plan.tables.map((t) => [t.file!.name, t.status])).toEqual([["employees", "new"], ["departments", "new"]]);
    expect(plan.tables.flatMap((t) => t.columns).every((c) => c.status === "new")).toBe(true);
    expect(plan.relationships.map((r) => [r.name, r.status, r.toLabel])).toEqual([
      ["FK_employees_departments", "new", "dbo.departments"],
      ["FK_employees_manager", "new", "dbo.employees"],
    ]);
    expect(changes.system).toMatchObject({ name: "HR", isNew: true });
    expect(changes.tables.insert).toHaveLength(2);
    expect(changes.columns.insert).toHaveLength(10);
    expect(changes.relationships.insert).toHaveLength(2);
    expect(importSummary(changes.counts)).toBe("2 new tables, 10 new columns, 2 new relationships");
    // BK and PII from the file on new columns (P11)
    expect(columnNamed(model, "employees", "emp_no")).toMatchObject({ is_business_key: true, is_pii: false });
    expect(columnNamed(model, "employees", "first_name")).toMatchObject({ is_pii: true });
    const manager = model.relationships.find((r) => r.name === "FK_employees_manager")!;
    expect(manager.source_table_id).toBe(manager.to_source_table_id);
    expect(manager.columns.map((p) => [p.from_column_id, p.to_column_id])).toEqual([
      [columnNamed(model, "employees", "manager_id").id, columnNamed(model, "employees", "emp_id").id],
    ]);
  });

  it("refuses a name another system has, in any case", () => {
    const model = demoCrm();
    const plan = buildPlan(model, read("hr_snapshot_2026-10-20.csv"), { newName: " crm " }, allOf(read("hr_snapshot_2026-10-20.csv")));
    expect(plan.errors).toEqual(["A system named crm already exists. Pick it under “An existing system”."]);
    expect(applyPlan(model, plan, { now: LATER, newId: () => "x" })).toEqual({ ok: false, errors: plan.errors });
  });
});

describe("re-importing an unchanged file shows no changes (S7A-16)", () => {
  for (const name of ["crm_sqlserver_catalog.tsv", "web_postgres_catalog.csv", "hr_oracle_catalog.csv", "hr_snapshot_2026-10-20.csv", "reference_files.csv", "crm_snapshot_2026-10-20.csv"]) {
    it(name, () => {
      const first = importInto(emptyModel(), read(name), { newName: "S" });
      const again = importInto(first.model, read(name), { systemId: systemNamed(first.model, "S").id });
      expect(again.plan.tables.every((t) => t.status === "unchanged")).toBe(true);
      expect(again.plan.relationships.every((r) => r.status === "unchanged")).toBe(true);
      expect(noChanges(again.changes)).toBe(true);
      expect(importSummary(again.changes.counts)).toBe("No changes");
    });
  }

  it("the same type spelled another way is no change", () => {
    const first = importInto(emptyModel(), csv("d,s,t,a,1,integer,yes,no,\nd,s,t,b,2,VARCHAR(20),yes,no,\nd,s,t,c,3,timestamp with time zone,yes,no,"), { newName: "S" });
    const again = importInto(first.model, csv("d,s,t,a,1,int,yes,no,\nd,s,t,b,2,varchar (20),yes,no,\nd,s,t,c,3,timestamptz,yes,no,"), { systemId: systemNamed(first.model, "S").id });
    expect(statuses(again.plan, "t")).toEqual(["a:unchanged", "b:unchanged", "c:unchanged"]);
    expect(noChanges(again.changes)).toBe(true);
  });
});

describe("importing from a DDL script, then from the catalog query (step 2, decision 6)", () => {
  it("Oracle: the matching catalog result shows no changes and sends no mapping to review", () => {
    const ddl = readDdl(sample("hrleg_ddl.sql"), { fileName: "hrleg_ddl.sql", database: "ORCL" }).read;
    const first = importInto(emptyModel(), ddl, { newName: "HR legacy" });
    let model = withEntity(first.model, "Employee", [{ name: "salary", data_type: "decimal", type_precision: 12, type_scale: 2 }, { name: "updated_at", data_type: "datetime" }]);
    model = withMapping(model, attributeNamed(model, "salary").id, [columnNamed(model, "EMPLOYEES", "SALARY").id]).model;
    model = withMapping(model, attributeNamed(model, "updated_at").id, [columnNamed(model, "EMPLOYEES", "UPDATED_AT").id]).model;
    const again = importInto(model, read("hr_oracle_catalog.csv"), { systemId: systemNamed(model, "HR legacy").id });
    expect(again.plan.tables.map((t) => [t.file!.name, t.status])).toEqual([["DEPARTMENTS", "unchanged"], ["EMPLOYEES", "unchanged"]]);
    expect(again.plan.relationships.map((r) => r.status)).toEqual(["unchanged"]);
    expect(again.plan.mappings).toEqual([]);
    expect(importSummary(again.changes.counts)).toBe("No changes");
    // the script gives no row counts; the catalog's are written, not counted as changes
    expect(again.changes.tables.update.map((u) => u.patch)).toEqual([{ row_count: 38 }, { row_count: 2140 }]);
    expect(again.changes.columns.update).toEqual([]);
  });

  it("SQL Server: only what the script could not tell differs, a computed column's type and a view", () => {
    const ddl = readDdl(sample("billing.sql"), { fileName: "billing.sql" }).read;
    const first = importInto(emptyModel(), ddl, { newName: "Billing" });
    let model = withEntity(first.model, "Invoice", [{ name: "amount", data_type: "decimal", type_precision: 12, type_scale: 2 }]);
    model = withMapping(model, attributeNamed(model, "amount").id, [columnNamed(model, "invoice", "amount").id]).model;
    const again = importInto(model, read("billing_sqlserver_catalog.tsv"), { systemId: systemNamed(model, "Billing").id });
    expect(again.plan.tables.map((t) => [t.file!.name, t.status])).toEqual([["invoice", "changed"], ["invoice_line", "unchanged"], ["v_open_invoices", "new"]]);
    expect(planColumn(again.plan, "invoice", "full_ref").changes).toEqual([{ field: "type", before: "computed", after: "varchar(24)" }]);
    expect(planTable(again.plan, "invoice").columns.filter((c) => c.status !== "unchanged").map((c) => c.file!.name)).toEqual(["full_ref"]);
    expect(again.plan.relationships.map((r) => r.status)).toEqual(["unchanged"]);
    expect(again.plan.mappings).toEqual([]);
  });
});

describe("a re-import of a changed file (S7A-05)", () => {
  it("CRM: new, changed, unchanged and gone columns, positions, table meta, a new relationship", () => {
    const { model } = demoCrmWithMappings();
    const file = read("crm_snapshot_2026-10-20.csv");
    const plan = buildPlan(model, file, { systemId: systemNamed(model, "CRM").id }, allOf(file));
    expect(plan.tables.map((t) => [t.key, t.status])).toEqual([
      ["crmprod|dbo|customers", "changed"],
      ["crmprod|dbo|customer_addresses", "changed"],
      ["crmprod|dbo|customer_consents", "new"],
      ["crmprod|stage|customers_load", "new"],
    ]);
    expect(statuses(plan, "customers")).toEqual([
      "cust_id:unchanged",
      "cust_no:changed",
      "fname:unchanged",
      "lname:unchanged",
      "email_addr:changed",
      "date_of_birth:rename",
      "updated_ts:unchanged",
      "consent_flag:new",
      "created_on:new",
      "customer_segment:new",
      "segment:missing",
      "created_ts:missing",
    ]);
    expect(planColumn(plan, "customers", "cust_no").changes).toEqual([
      { field: "type", before: "varchar(20)", after: "varchar(25)" },
      { field: "nullable", before: "yes", after: "no" },
      { field: "comment", before: "–", after: "Customer number shown to the customer" },
    ]);
    // a position change is written and shown, not a change (step 1, answer 11)
    expect(planColumn(plan, "customers", "updated_ts")).toMatchObject({ status: "unchanged", position: { before: 9, after: 7 } });
    expect(planTable(plan, "customers").meta).toEqual([{ field: "comment", before: "–", after: "Customer master" }]);
    expect(planTable(plan, "customers").rows).toEqual({ before: 182340, after: 184120 });
    expect(planColumn(plan, "customer_addresses", "city").changes).toEqual([{ field: "type", before: "nvarchar(60)", after: "nvarchar(80)" }]);
    expect(plan.relationships.map((r) => [r.name, r.status])).toEqual([
      ["FK_customer_addresses_customers", "unchanged"],
      ["FK_customer_consents_customers", "new"],
    ]);
    // the file's classifications differ from the column's: shown, kept (item 11, P1)
    expect(planColumn(plan, "customers", "email_addr").fileClassifications).toEqual(["PII"]);
    expect(planColumn(plan, "customers", "cust_no").fileClassifications).toBeNull();
    expect(plan.warnings).toContain("Row 26: stage.customers_load.batch_ref has no data_type. Column skipped.");
    expect(planCounts(plan)).toEqual({ tables_new: 2, columns_new: 11, columns_changed: 3, columns_renamed: 1, columns_missing: 2, relationships_new: 1 });
  });

  it("writes only what changed: positions, changed fields, missing_since; nothing for unchanged columns", () => {
    const { model } = demoCrmWithMappings();
    const file = read("crm_snapshot_2026-10-20.csv");
    const { changes } = importInto(model, file, { systemId: systemNamed(model, "CRM").id });
    const byName = new Map(model.columns.map((c) => [c.id, c.name]));
    const patches = Object.fromEntries(changes.columns.update.map((u) => [byName.get(u.id), u.patch]));
    expect(patches).toEqual({
      cust_no: { data_type: "varchar", type_length: 25, type_precision: null, type_scale: null, is_nullable: false, comment: "Customer number shown to the customer" },
      email_addr: { type_length: 255, data_type: "varchar", type_precision: null, type_scale: null },
      dob: { name: "date_of_birth" },
      updated_ts: { ordinal: 7 },
      segment: { missing_since: LATER },
      created_ts: { missing_since: LATER },
      city: { data_type: "nvarchar", type_length: 80, type_precision: null, type_scale: null },
    });
    // classifications are the modeller's: a re-import never writes them (P1)
    expect(changes.columns.update.every((u) => !("is_business_key" in u.patch) && !("is_pii" in u.patch))).toBe(true);
  });

  it("P2: a file without column_comment, nullable or primary_key compares and writes none of them", () => {
    const first = importInto(emptyModel(), csv("d,s,t,a,1,int,no,yes,The key\nd,s,t,b,2,int,yes,no,Bee"), { newName: "S" });
    const bare = readStandard("database,schema,table,column,data_type\nd,s,t,a,int\nd,s,t,b,int", "bare.csv");
    const again = importInto(first.model, bare, { systemId: systemNamed(first.model, "S").id });
    expect(statuses(again.plan, "t")).toEqual(["a:unchanged", "b:unchanged"]);
    expect(noChanges(again.changes)).toBe(true);
    expect(columnNamed(again.model, "t", "a").comment).toBe("The key");
  });

  it("a comment the file would overwrite shows as a change (step 1, answer 8)", () => {
    let { model } = importInto(emptyModel(), csv("d,s,t,a,1,int,yes,no,From the source"), { newName: "S" });
    model = editColumn(model, columnNamed(model, "t", "a").id, { comment: "Typed by Anna" });
    const plan = importInto(model, csv("d,s,t,a,1,int,yes,no,From the source"), { systemId: systemNamed(model, "S").id }).plan;
    expect(planColumn(plan, "t", "a")).toMatchObject({ status: "changed", changes: [{ field: "comment", before: "Typed by Anna", after: "From the source" }] });
  });

  it("a name that changes only in case is a change of the name (F22)", () => {
    const first = importInto(emptyModel(), csv("d,s,t,Email,1,int,yes,no,"), { newName: "S" });
    const again = importInto(first.model, csv("d,s,t,email,1,int,yes,no,"), { systemId: systemNamed(first.model, "S").id });
    expect(planColumn(again.plan, "t", "email").changes).toEqual([{ field: "name", before: "Email", after: "email" }]);
    expect(columnNamed(again.model, "t", "email").id).toBe(columnNamed(first.model, "t", "Email").id);
  });

  it("refuses a system with two tables or columns that differ only in case", () => {
    const first = importInto(emptyModel(), csv("d,s,t,a,1,int,yes,no,"), { newName: "S" });
    const twin = { ...first.model.tables[0]!, id: "01900000-0000-7000-8000-f00000000001", name: "T" };
    const model: ImportModel = { ...first.model, tables: [...first.model.tables, twin] };
    expect(buildPlan(model, csv("d,s,t,a,1,int,yes,no,"), { systemId: systemNamed(model, "S").id }, allOf(csv("d,s,t,a,1,int,yes,no,"))).errors).toEqual([
      "S has two tables that differ only in case: s.t and s.T.",
    ]);
  });
});

describe("missing and back (P3, item 32)", () => {
  const withFk = (body: string) =>
    readStandard(`database,schema,table,column,ordinal,data_type,nullable,primary_key,fk_name,fk_ref_table,fk_ref_column\n${body}`, "fk.csv");
  const fullFk = withFk("d,s,a,id,1,int,no,yes,,,\nd,s,a,x,2,int,yes,no,,,\nd,s,b,id,1,int,no,yes,,,\nd,s,b,a_id,2,int,yes,no,FK_b_a,a,id");

  it("a table and a column not in the file become missing; their rows, mappings and relationships stay", () => {
    const first = importInto(emptyModel(), fullFk, { newName: "S" });
    const missing = importInto(first.model, withFk("d,s,b,id,1,int,no,yes,,,"), { systemId: systemNamed(first.model, "S").id });
    expect(missing.plan.tables.map((t) => [t.key, t.status])).toEqual([["d|s|b", "changed"], ["d|s|a", "missing"]]);
    expect(statuses(missing.plan, "b")).toEqual(["id:unchanged", "a_id:missing"]);
    expect(statuses(missing.plan, "a")).toEqual(["id:missing", "x:missing"]);
    expect(missing.plan.relationships.map((r) => [r.name, r.status])).toEqual([["FK_b_a", "missing"]]);
    expect(tableNamed(missing.model, "a").missing_since).toBe(LATER);
    expect(missing.model.columns.filter((c) => c.missing_since).length).toBe(3);
    expect(missing.model.relationships[0]!.missing_since).toBe(LATER);
    expect(missing.model.tables.length).toBe(2); // nothing deleted
    expect(importSummary(missing.changes.counts)).toBe("3 missing from source");
  });

  it("still missing on the next import, back when found again", () => {
    const first = importInto(emptyModel(), fullFk, { newName: "S" });
    const sys = { systemId: systemNamed(first.model, "S").id };
    const missing = importInto(first.model, withFk("d,s,b,id,1,int,no,yes,,,"), sys);
    const still = importInto(missing.model, withFk("d,s,b,id,1,int,no,yes,,,"), sys);
    expect(still.plan.tables.map((t) => t.status)).toEqual(["unchanged", "still_missing"]);
    expect(still.plan.relationships.map((r) => r.status)).toEqual(["still_missing"]);
    expect(noChanges(still.changes)).toBe(true);
    const back = importInto(still.model, fullFk, sys);
    expect(back.plan.tables.map((t) => [t.key, t.status])).toEqual([["d|s|a", "back"], ["d|s|b", "changed"]]);
    expect(statuses(back.plan, "a")).toEqual(["id:back", "x:back"]);
    expect(statuses(back.plan, "b")).toEqual(["id:unchanged", "a_id:back"]);
    expect(back.plan.relationships.map((r) => [r.name, r.status])).toEqual([["FK_b_a", "back"]]);
    expect(back.model.tables.every((t) => !t.missing_since) && back.model.columns.every((c) => !c.missing_since) && !back.model.relationships[0]!.missing_since).toBe(true);
  });

  it("relationships to a missing table become missing with it", () => {
    const first = importInto(emptyModel(), fullFk, { newName: "S" });
    const plan = importInto(first.model, withFk("d,s,a,id,1,int,no,yes,,,\nd,s,a,x,2,int,yes,no,,,"), { systemId: systemNamed(first.model, "S").id }).plan;
    expect(plan.tables.map((t) => [t.key, t.status])).toEqual([["d|s|a", "unchanged"], ["d|s|b", "missing"]]);
    expect(plan.relationships.map((r) => [r.name, r.status])).toEqual([["FK_b_a", "missing"]]);
  });
});

describe("scope (P4) and the mass warning (item 23, S7A-06)", () => {
  const twoSchemas = "d,s,a,id,1,int,no,yes,\nd,s,b,id,1,int,no,yes,\nd,s,c,id,1,int,no,yes,\nd,t,x,id,1,int,no,yes,";

  it("an unselected table is untouched; missing is judged only in the selected tables' schemas", () => {
    const first = importInto(emptyModel(), csv(twoSchemas), { newName: "S" });
    const sys = { systemId: systemNamed(first.model, "S").id };
    // a file with a, b and x changed; b left out of the scope; c not in the file
    const file = csv("d,s,a,id,1,bigint,no,yes,\nd,s,b,id,1,bigint,no,yes,\nd,t,x,id,1,bigint,no,yes,");
    const plan = buildPlan(first.model, file, sys, allOf(file, { scope: new Set(["d|s|a"]) }));
    expect(plan.tables.map((t) => [t.key, t.status])).toEqual([["d|s|a", "changed"], ["d|s|c", "missing"]]);
    // x's schema t was not selected: x is neither compared nor missing; b is in the file, so not missing either
  });

  it("“Only columns of the tables in the file” marks no other table missing", () => {
    const first = importInto(emptyModel(), csv(twoSchemas), { newName: "S" });
    const file = csv("d,s,a,id,1,int,no,yes,\nd,s,a,new_col,2,int,yes,no,");
    const plan = buildPlan(first.model, file, { systemId: systemNamed(first.model, "S").id }, allOf(file, { compare: "tables" }));
    expect(plan.tables.map((t) => [t.key, t.status])).toEqual([["d|s|a", "changed"]]);
    expect(plan.massWarning).toBeNull();
  });

  it("the mass warning: more than half of the system's present columns would be missing", () => {
    const first = importInto(emptyModel(), csv(twoSchemas), { newName: "S" });
    const sys = { systemId: systemNamed(first.model, "S").id };
    const one = csv("d,s,a,id,1,int,no,yes,");
    expect(buildPlan(first.model, one, sys, allOf(one)).massWarning).toBeNull(); // 2 of 4: not more than half
    // with one more column in c: 3 of 5 would be missing
    const sOnly = csv("d,s,a,id,1,int,no,yes,");
    const firstMore = importInto(emptyModel(), csv(`${twoSchemas}\nd,s,c,more,2,int,yes,no,`), { newName: "S2" });
    const plan = buildPlan(firstMore.model, sOnly, { systemId: systemNamed(firstMore.model, "S2").id }, allOf(sOnly));
    expect(plan.massWarning).toEqual({ missing: 3, present: 5 });
    expect(buildPlan(firstMore.model, sOnly, { systemId: systemNamed(firstMore.model, "S2").id }, allOf(sOnly, { compare: "tables" })).massWarning).toBeNull();
  });
});

describe("renames (P5, S7A-07)", () => {
  it("suggests a gone and a new column with the same position and type, and pre-selects it", () => {
    const { model } = demoCrmWithMappings();
    const file = read("crm_snapshot_2026-10-20.csv");
    const plan = buildPlan(model, file, { systemId: systemNamed(model, "CRM").id }, allOf(file));
    expect(plan.renames.map((r) => [r.from, r.suggested, r.choice, r.options])).toEqual([
      ["dob", "date_of_birth", "date_of_birth", ["date_of_birth", "consent_flag", "created_on", "customer_segment"]],
      ["segment", "", "", ["consent_flag", "created_on", "customer_segment"]],
      ["created_ts", "", "", ["consent_flag", "created_on", "customer_segment"]],
    ]);
  });

  it("a rename keeps the column's id, its mappings and its BK and PII; its rule is rewritten", () => {
    const { model, ids } = demoCrmWithMappings();
    const file = read("crm_snapshot_2026-10-20.csv");
    const key = "crmprod|dbo|customers|created_ts";
    const { plan, model: after } = importInto(model, file, { systemId: systemNamed(model, "CRM").id }, allOf(file, { renames: new Map([[key, "created_on"]]) }));
    expect(planColumn(plan, "customers", "created_on")).toMatchObject({ status: "rename", renameKey: key });
    expect(columnNamed(after, "customers", "created_on").id).toBe(columnNamed(model, "customers", "created_ts").id);
    expect(columnNamed(after, "customers", "date_of_birth")).toMatchObject({ id: columnNamed(model, "customers", "dob").id, is_pii: false });
    // the mapping in review keeps its status; its rule now names the new column (P6)
    const created = after.mappings.find((m) => m.id === ids.created)!;
    expect(created).toMatchObject({ status: "review", rule_expression: "CAST(created_on AS date)", review_reason: null });
    expect(plan.mappings.find((m) => m.mappingId === ids.created)).toMatchObject({ sendsBack: false, reasons: ["its rule now reads CAST(created_on AS date)"] });
    expect(plan.renames.find((r) => r.key === key)!.options).not.toContain("date_of_birth"); // paired with dob already
  });

  it("“It was removed”: the gone column is missing and the new one is added", () => {
    const { model } = demoCrmWithMappings();
    const file = read("crm_snapshot_2026-10-20.csv");
    const plan = buildPlan(model, file, { systemId: systemNamed(model, "CRM").id }, allOf(file, { renames: new Map([["crmprod|dbo|customers|dob", ""]]) }));
    expect(planColumn(plan, "customers", "dob").status).toBe("missing");
    expect(planColumn(plan, "customers", "date_of_birth").status).toBe("new");
  });

  it("one new column cannot be paired twice", () => {
    const { model } = demoCrmWithMappings();
    const file = read("crm_snapshot_2026-10-20.csv");
    const renames = new Map([["crmprod|dbo|customers|segment", "created_on"], ["crmprod|dbo|customers|created_ts", "created_on"]]);
    const plan = buildPlan(model, file, { systemId: systemNamed(model, "CRM").id }, allOf(file, { renames }));
    expect(planColumn(plan, "customers", "created_on")).toMatchObject({ status: "rename", existing: { name: "segment" } });
    expect(planTable(plan, "customers").columns.filter((c) => c.existing?.name === "segment").map((c) => c.status)).toEqual(["rename"]);
    expect(planColumn(plan, "customers", "created_ts").status).toBe("missing");
  });

  it("a rename alone does not change a relationship over that column", () => {
    const fk = (col: string) =>
      readStandard(`database,schema,table,column,ordinal,data_type,primary_key,fk_name,fk_ref_table,fk_ref_column\nd,s,a,id,1,int,yes,,,\nd,s,b,${col},1,int,no,FK_b_a,a,id`, "fk.csv");
    const first = importInto(emptyModel(), fk("a_id"), { newName: "S" });
    const again = importInto(first.model, fk("a_ref"), { systemId: systemNamed(first.model, "S").id }, allOf(fk("a_ref"), { renames: new Map([["d|s|b|a_id", "a_ref"]]) }));
    expect(again.plan.relationships.map((r) => r.status)).toEqual(["unchanged"]);
    expect(again.changes.relationshipColumns.insert).toEqual([]);
  });
});

describe("mappings when their source changes (P6, S7A-08)", () => {
  it("a direct mapping goes back to review for a new type conflict, with its reason; the approval is cleared", () => {
    const { model, ids } = demoCrmWithMappings();
    const file = read("crm_snapshot_2026-10-20.csv");
    const { plan, model: after } = importInto(model, file, { systemId: systemNamed(model, "CRM").id });
    expect(plan.mappings.find((m) => m.mappingId === ids.email)).toMatchObject({
      label: "Customer.email",
      sendsBack: true,
      reasons: ["type conflict, varchar(255) into string(120)"],
      conflicts: [{ short: "varchar(255) into string(120)" }],
    });
    expect(after.mappings.find((m) => m.id === ids.email)).toMatchObject({
      status: "review",
      approved_by: null,
      approved_at: null,
      review_reason: "type conflict, varchar(255) into string(120)",
    });
  });

  it("a business key column that changes type sends its approved mapping back", () => {
    const { model, ids } = demoCrmWithMappings();
    const file = read("crm_snapshot_2026-10-20.csv");
    const plan = buildPlan(model, file, { systemId: systemNamed(model, "CRM").id }, allOf(file));
    // cust_no varchar(20) → varchar(25) into customer_number string(20): also a new conflict
    expect(plan.mappings.find((m) => m.mappingId === ids.custNo)!.reasons).toEqual([
      "type conflict, varchar(25) into string(20)",
      "business key column changed type, varchar(20) → varchar(25)",
    ]);
  });

  it("a combined mapping (AD-26): a renamed input in the rule and a business key change, never a type conflict", () => {
    const setUp = demoCrmWithMappings();
    const ids = setUp.ids;
    let model = setUp.model;
    model = { ...model, columns: model.columns.map((c) => (c.name === "fname" ? { ...c, is_business_key: true } : c)) };
    const file = csv(
      "crmprod,dbo,customers,cust_id,1,int,no,yes,\ncrmprod,dbo,customers,fname,2,nvarchar(80),yes,no,\ncrmprod,dbo,customers,last_name,3,int,yes,no,",
    );
    const choices = allOf(file, { compare: "tables", renames: new Map([["crmprod|dbo|customers|lname", "last_name"]]) });
    const { plan, model: after } = importInto(model, file, { systemId: systemNamed(model, "CRM").id }, choices);
    const impact = plan.mappings.find((m) => m.mappingId === ids.fullName)!;
    expect(impact).toMatchObject({
      sendsBack: true,
      conflicts: [],
      reasons: ["business key column changed type, nvarchar(50) → nvarchar(80)", "its rule now reads CONCAT(fname, ' ', last_name)"],
      ruleAfter: "CONCAT(fname, ' ', last_name)",
    });
    expect(after.mappings.find((m) => m.id === ids.fullName)).toMatchObject({ status: "review", rule_expression: "CONCAT(fname, ' ', last_name)" });
  });

  it("a draft or review mapping keeps its status and gets no reason; a renamed input without a rule changes nothing", () => {
    const { model, ids } = demoCrmWithMappings();
    const file = read("crm_snapshot_2026-10-20.csv");
    const { plan, model: after } = importInto(model, file, { systemId: systemNamed(model, "CRM").id });
    // dob → date_of_birth (suggested): a direct mapping in review, no rule
    expect(plan.mappings.find((m) => m.mappingId === ids.dob)).toBeUndefined();
    expect(after.mappings.find((m) => m.id === ids.dob)).toMatchObject({ status: "review", review_reason: null });
  });

  it("a mapping that fits again is reported; a missing input changes no status", () => {
    let model = importInto(emptyModel(), csv("d,s,t,a,1,varchar(200),yes,no,\nd,s,t,b,2,int,yes,no,"), { newName: "S" }).model;
    model = withEntity(model, "E", [{ name: "x", type_length: 100 }, { name: "y", data_type: "integer" }]);
    const x = withMapping(model, attributeNamed(model, "x").id, [columnNamed(model, "t", "a").id], { status: "draft" });
    const y = withMapping(x.model, attributeNamed(x.model, "y").id, [columnNamed(x.model, "t", "b").id]);
    model = y.model;
    const { plan, model: after } = importInto(model, csv("d,s,t,a,1,varchar(80),yes,no,"), { systemId: systemNamed(model, "S").id });
    expect(plan.mappings).toEqual([expect.objectContaining({ mappingId: x.mappingId, sendsBack: false, reasons: [], fitsAgain: [columnNamed(model, "t", "a").id] })]);
    expect(after.mappings.find((m) => m.id === y.mappingId)!.status).toBe("approved");
    expect(planColumn(plan, "t", "b")).toMatchObject({ status: "missing", mappingIds: [y.mappingId] });
  });
});

describe("relationships (item 30)", () => {
  const fk = (body: string) => readStandard(`database,schema,table,column,ordinal,data_type,primary_key,fk_name,fk_ref_schema,fk_ref_table,fk_ref_column\n${body}`, "fk.csv");

  it("skips a key whose target is neither in the file nor in the system, with its warning", () => {
    const plan = buildPlan(emptyModel(), fk("d,s,b,a_id,1,int,no,FK_b_a,s,a,id"), { newName: "S" }, allOf(fk("d,s,b,a_id,1,int,no,FK_b_a,s,a,id")));
    expect(plan.relationships).toEqual([]);
    expect(plan.warnings).toEqual(["Foreign key FK_b_a on s.b refers to s.a, which is neither in this file nor in the system. Relationship skipped."]);
  });

  it("points a key without target columns at the target's primary key; a target only in the system resolves", () => {
    const first = importInto(emptyModel(), fk("d,s,a,id,1,int,yes,,,,"), { newName: "S" });
    const again = importInto(first.model, fk("d,s,b,a_id,1,int,no,FK_b_a,s,a,"), { systemId: systemNamed(first.model, "S").id }, allOf(fk("d,s,b,a_id,1,int,no,FK_b_a,s,a,"), { compare: "tables" }));
    expect(again.plan.relationships.map((r) => [r.status, r.pairs])).toEqual([["new", [{ from: "a_id", to: "id" }]]]);
    expect(again.model.relationships[0]!.columns.map((c) => c.to_column_id)).toEqual([columnNamed(first.model, "a", "id").id]);
  });

  it("other column pairs make a relationship changed; its pairs are replaced", () => {
    const body = (to: string) => `d,s,a,id,1,int,yes,,,,\nd,s,a,code,2,int,no,,,,\nd,s,b,a_id,1,int,no,FK_b_a,s,a,${to}`;
    const first = importInto(emptyModel(), fk(body("id")), { newName: "S" });
    const again = importInto(first.model, fk(body("code")), { systemId: systemNamed(first.model, "S").id });
    expect(again.plan.relationships.map((r) => r.status)).toEqual(["changed"]);
    expect(again.changes.relationshipColumns.remove).toHaveLength(1);
    expect(again.model.relationships[0]!.columns.map((c) => c.to_column_id)).toEqual([columnNamed(first.model, "a", "code").id]);
  });

  it("a key the file no longer declares is missing", () => {
    const first = importInto(emptyModel(), fk("d,s,a,id,1,int,yes,,,,\nd,s,b,a_id,1,int,no,FK_b_a,s,a,id"), { newName: "S" });
    const again = importInto(first.model, fk("d,s,a,id,1,int,yes,,,,\nd,s,b,a_id,1,int,no,,,,"), { systemId: systemNamed(first.model, "S").id });
    expect(again.plan.relationships.map((r) => [r.name, r.status])).toEqual([["FK_b_a", "missing"]]);
  });
});

describe("rewriteRule", () => {
  it("rewrites whole words, ignoring case, in one pass", () => {
    const r = (rule: string, map: [string, string][]) => rewriteRule(rule, new Map(map));
    expect(r("CAST(created_ts AS date)", [["created_ts", "created_on"]])).toBe("CAST(created_on AS date)");
    expect(r("customers.[CREATED_TS] + created_ts_old", [["created_ts", "created_on"]])).toBe("customers.[created_on] + created_ts_old");
    expect(r("a + b", [["a", "b"], ["b", "c"]])).toBe("b + c");
    expect(r("nothing here", [["x", "y"]])).toBeNull();
  });
});
