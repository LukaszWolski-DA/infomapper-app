// Test fixtures for changes to resolve (slice 7b, step 2). Not used by application code.
//   FULL: a system “CRM” with customers (id, cust_no BK, email, segment, created_ts) and orders (id, cust_id).
//   CHANGED, re-imported with “Anything in the imported schemas”: cust_no varchar(20) → (25) (business key), email
//   varchar(120) → (255) (a type conflict into Customer.email string(120)), segment and created_ts gone, created_on
//   and phone new, orders gone, payments new.
//   Mappings: Customer.customer_number ← cust_no and Customer.email ← email (approved, both go back to review);
//   Customer.segment_code ← segment (approved, on a column that leaves); Customer.label ← segment, email (combined,
//   approved, a rule: no type conflict, D-49); Customer.created_at ← created_ts (draft).

import { materialize } from "../import/materialize";
import type { ImportModel } from "../import/model";
import { readStandard } from "../import/standard";
import type { Edit } from "../source-changes/rules";
import type { ChangeActionRows } from "../source-changes/actions";
import { ids, T0 } from "./domain";
import { allOf, attributeNamed, columnNamed, emptyModel, IMPORTER, importId, importInto, LATER, systemNamed, withEntity, withMapping } from "./import";

const HEAD = "database,schema,table,column,ordinal,data_type,nullable,primary_key,classifications";
export const standardOf = (body: string) => readStandard(`${HEAD}\n${body}`, "crm.csv");

export const FULL = standardOf(
  [
    "crm,dbo,customers,id,1,int,no,yes,",
    "crm,dbo,customers,cust_no,2,varchar(20),no,no,BK",
    "crm,dbo,customers,email,3,varchar(120),yes,no,",
    "crm,dbo,customers,segment,4,char(3),yes,no,",
    "crm,dbo,customers,created_ts,5,datetime2,yes,no,",
    "crm,dbo,orders,id,1,int,no,yes,",
    "crm,dbo,orders,cust_id,2,int,no,no,",
  ].join("\n"),
);

export const CHANGED = standardOf(
  [
    "crm,dbo,customers,id,1,int,no,yes,",
    "crm,dbo,customers,cust_no,2,varchar(25),no,no,BK",
    "crm,dbo,customers,email,3,varchar(255),yes,no,",
    "crm,dbo,customers,created_on,6,date,yes,no,",
    "crm,dbo,customers,phone,7,varchar(30),yes,no,",
    "crm,dbo,payments,id,1,int,no,yes,",
    "crm,dbo,payments,amount,2,\"decimal(18,2)\",yes,no,",
  ].join("\n"),
);

/** CRM imported from FULL, with Customer and its mappings. */
export function crmWithMappings() {
  let model = importInto(emptyModel(), FULL, { newName: "CRM" }).model;
  model = withEntity(model, "Customer", [
    { name: "customer_number" },
    { name: "email", type_length: 120 },
    { name: "segment_code", type_length: 3 },
    { name: "label" },
    { name: "created_at", data_type: "date" },
  ]);
  const col = (name: string) => columnNamed(model, "customers", name).id;
  const map = (attr: string, cols: string[], over?: Parameters<typeof withMapping>[3]) => {
    const r = withMapping(model, attributeNamed(model, attr).id, cols.map(col), over);
    model = r.model;
    return r.mappingId;
  };
  const m = {
    custNo: map("customer_number", ["cust_no"]),
    email: map("email", ["email"]),
    segment: map("segment_code", ["segment"]),
    label: map("label", ["segment", "email"], { rule: "CONCAT(segment, email)" }),
    created: map("created_at", ["created_ts"], { status: "draft" }),
  };
  return { model, mappings: m, systemId: systemNamed(model, "CRM").id };
}

/** CRM after the re-import of CHANGED, its changes stored. */
export function crmAfterReimport() {
  const before = crmWithMappings();
  const result = importInto(before.model, CHANGED, { systemId: before.systemId }, allOf(CHANGED));
  return { ...before, before: before.model, plan: result.plan, changes: result.changes, model: result.model };
}

/** The same import's rows as the command writes them: new rows dated by the import (the derivation reads that). */
export const atImport = (model: ImportModel, changes: ReturnType<typeof importInto>["changes"]) =>
  materialize(model, changes, { workspaceId: ids.ws, actorId: IMPORTER, now: LATER });

export const rowsOf = (m: ImportModel): ChangeActionRows => ({
  tables: m.tables,
  columns: m.columns,
  mappings: m.mappings,
  mappingInputs: m.mappingInputs,
  attributes: m.attributes,
  entities: m.entities,
  changes: m.changes ?? [],
});

const KEYS = { source_table: "tables", source_column: "columns", mapping: "mappings", mapping_input: "mappingInputs", source_change: "changes" } as const;

/** The model after an action's edits (the tables the import model has; the others are read from the edits). */
export function applyEdits(m: ImportModel, edits: readonly Edit[]): ImportModel {
  const out: Record<string, { id: string }[]> = {};
  for (const [table, key] of Object.entries(KEYS)) out[table] = [...((m[key] as readonly { id: string }[] | undefined) ?? [])];
  for (const e of edits) {
    const rows = out[e.table];
    if (!rows || e.kind === "remove") continue;
    const row = e.row as { id: string };
    const i = rows.findIndex((r) => r.id === row.id);
    if (e.kind === "insert") rows.push(row);
    else if (i >= 0) rows[i] = row;
  }
  return { ...m, tables: out.source_table, columns: out.source_column, mappings: out.mapping, mappingInputs: out.mapping_input, changes: out.source_change } as unknown as ImportModel;
}

export const ACTOR = ids.actor;
export const newIds = () => importId;
export { IMPORTER, LATER, T0 };
