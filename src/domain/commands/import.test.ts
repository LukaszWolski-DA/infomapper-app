import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { access, archived, ids, makeCtx, mappingInput, sourceTable } from "../__fixtures__/domain";
import { allOf, importId } from "../__fixtures__/import";
import type { CommandResult, Write, WriteSet } from "../changes";
import { planFingerprint } from "../import/compare";
import { relationshipsWithColumns, type ImportModel } from "../import/model";
import { buildPlan, type ImportTarget, type PlanChoices } from "../import/plan";
import { readStandard } from "../import/standard";
import { lastContentEditor } from "../model/mapping-rules";
import { countsForCoverage } from "../model/requirements";
import type { Attribute, ChangeEvent, Entity, Mapping, MappingInput, SourceChange, SourceColumn, SourceRelationship, SourceRelationshipColumn, SourceTable, WorkspaceRole } from "../types";
import { importSources, STALE_REVIEW_FIELD, type ImportState } from "./import";
import { setMappingStatus, updateMapping } from "./mapping";
import { deleteSourceTable } from "./source";
import { revertChangeGroup, UNDOABLE_TABLES, type WorkspaceRows } from "./undo";

const sample = (name: string) => readFileSync(new URL(`../import/samples/${name}`, import.meta.url), "utf8");
const T1 = "2026-10-22T08:00:00.000Z";
/** A context whose ids never repeat across the test file (makeCtx counts from 1 each time). */
const ctxOf = (actor: string = ids.actor) => ({ ...makeCtx(actor), newId: importId });

/** Every row by table, as the store holds them (deleted rows too). */
type Db = { [T in (typeof UNDOABLE_TABLES)[number]]: Record<string, unknown>[] };
const emptyDb = (): Db => Object.fromEntries(UNDOABLE_TABLES.map((t) => [t, []])) as unknown as Db;

function applyTo(db: Db, writeSet: WriteSet): Db {
  const next = Object.fromEntries(Object.entries(db).map(([t, rows]) => [t, [...rows]])) as Db;
  for (const w of writeSet.writes as Write[]) {
    const rows = next[w.table as keyof Db];
    if (w.kind === "insert") rows.push(w.row as unknown as Record<string, unknown>);
    else if (w.kind === "update") rows[rows.findIndex((r) => r.id === (w.row as { id: string }).id)] = w.row as unknown as Record<string, unknown>;
  }
  return next;
}

const live = <R>(rows: unknown[]) => (rows as (R & { deleted_at: string | null })[]).filter((r) => r.deleted_at === null);

function stateOf(db: Db): ImportState {
  const relationships = live<SourceRelationship>(db.source_relationship);
  const relationshipColumns = live<SourceRelationshipColumn>(db.source_relationship_column);
  const model: ImportModel = {
    systems: live(db.source_system),
    tables: live(db.source_table),
    columns: live(db.source_column),
    relationships: relationshipsWithColumns(relationships, relationshipColumns),
    mappings: live(db.mapping),
    mappingInputs: live(db.mapping_input),
    attributes: live(db.attribute),
    entities: live(db.entity),
    changes: live(db.source_change),
  };
  return { model, relationships, relationshipColumns };
}

/** The input the review would send: its choices and the fingerprint of the plan it showed. */
function inputFor(db: Db, text: string, target: ImportTarget, over: Partial<PlanChoices> = {}, name = "crm.csv") {
  const read = readStandard(text, name);
  const choices = allOf(read, over);
  const plan = buildPlan(stateOf(db).model, read, target, choices);
  return {
    target,
    channel: "file" as const,
    sourceLabel: name,
    text,
    scope: [...choices.scope],
    compare: choices.compare,
    renames: [...choices.renames],
    fingerprint: planFingerprint(plan),
  };
}

const okSet = <T>(r: CommandResult<T>): WriteSet & { value: T } => {
  if (!r.ok) throw new Error(r.error.message);
  return Object.assign(r.writeSet, { value: r.value });
};

const as = (role: WorkspaceRole, ws = {}) => access(role, ws);

function firstImport() {
  const db0 = emptyDb();
  const ctx = ctxOf();
  const result = okSet(importSources(ctx, as("modeler"), stateOf(db0), inputFor(db0, sample("crm_sqlserver_catalog.tsv"), { newName: "CRM" })));
  return { db: applyTo(db0, result), result, ctx };
}

/** Customer.email string(120) with an approved direct mapping from customers.email_addr, approved by someone else. */
function withEmailMapping(db: Db) {
  const entity: Entity = { id: ids.customer, workspace_id: ids.ws, version: 1, created_at: T1, created_by: ids.someoneElse, updated_at: T1, updated_by: ids.someoneElse, deleted_at: null, concept_id: ids.conceptCustomer, name: "Customer", stereotype: "object", definition_html: null, definition_text: null };
  const attr: Attribute = {
    ...entity,
    id: ids.email,
    entity_id: ids.customer,
    name: "email",
    sort_order: 0,
    data_type: "string",
    custom_type: null,
    type_length: 120,
    type_precision: null,
    type_scale: null,
    is_primary_key: false,
    is_foreign_key: false,
    is_business_key: false,
    is_pii: true,
    is_nullable: true,
    copied_from_attribute_id: null,
  } as Attribute;
  const column = (db.source_column as unknown as SourceColumn[]).find((c) => c.name === "email_addr")!;
  const mapping: Mapping = {
    id: ids.mapEmail,
    workspace_id: ids.ws,
    version: 1,
    created_at: T1,
    created_by: ids.someoneElse,
    updated_at: T1,
    updated_by: ids.someoneElse,
    deleted_at: null,
    attribute_id: ids.email,
    kind: "direct",
    rule_expression: null,
    status: "approved",
    note_html: null,
    note_text: null,
    approved_by: ids.someoneElse,
    approved_at: T1,
    review_reason: null,
  };
  const input: MappingInput = mappingInput(ids.inEmail, { source_column_id: column.id, mapping_id: ids.mapEmail });
  return { ...db, entity: [entity], attribute: [attr], mapping: [mapping], mapping_input: [input] } as unknown as Db;
}

describe("importSources (items 28, 40; P7, P8)", () => {
  it("a new system: one change group with a change event per row, and the import recorded with its counts", () => {
    const { db, result } = firstImport();
    expect(result.value).toMatchObject({ systemName: "CRM", summary: "2 new tables, 15 new columns, 1 new relationship", sentBack: 0 });
    const tables = new Set(result.events.map((e) => e.object_type));
    expect([...tables].sort()).toEqual(["source_column", "source_import", "source_relationship", "source_relationship_column", "source_system", "source_table"]);
    expect(result.events).toHaveLength(result.writes.length);
    expect(new Set(result.events.map((e) => e.change_group_id)).size).toBe(1);
    expect(result.labelNothing).toBe(true); // P9
    expect(db.source_import[0]).toMatchObject({ channel: "file", source_label: "crm.csv", tables_new: 2, columns_new: 15, relationships_new: 1, created_by: ids.actor });
  });

  it("the query channel: the server reads SQL Server's timestamp as rowversion, as the review did (step 7)", () => {
    const db0 = emptyDb();
    const text = "database,schema,table,column,data_type\nd,dbo,t,ver,timestamp";
    const read = readStandard(text, "pasted query result", { vendor: "sqlserver" });
    const choices = allOf(read, {});
    const plan = buildPlan(stateOf(db0).model, read, { newName: "Billing" }, choices);
    const input = { ...inputFor(db0, text, { newName: "Billing" }, {}, "pasted query result"), channel: "query" as const, vendor: "sqlserver" as const, fingerprint: planFingerprint(plan) };
    const result = okSet(importSources(ctxOf(), as("modeler"), stateOf(db0), input));
    expect(applyTo(db0, result).source_column[0]).toMatchObject({ name: "ver", data_type: "rowversion" });
    // without the vendor the server plans timestamp(6): not what the review showed, so nothing is written (P8)
    expect(importSources(ctxOf(), as("modeler"), stateOf(db0), { ...input, vendor: undefined }).ok).toBe(false);
  });

  it("refuses readers and reviewers, and an archived workspace; the server refuses before it reads", () => {
    const db = emptyDb();
    const input = inputFor(db, sample("hr_snapshot_2026-10-20.csv"), { newName: "HR" });
    for (const role of ["reader", "reviewer"] as const) {
      expect(importSources(ctxOf(), as(role), stateOf(db), input)).toMatchObject({ ok: false, error: { code: "forbidden" } });
    }
    expect(importSources(ctxOf(), as("owner", archived), stateOf(db), input)).toMatchObject({ ok: false, error: { code: "archived" } });
    expect(importSources(ctxOf(), as("admin"), stateOf(db), input).ok).toBe(true);
  });

  it("P8: a change to the system between the review and the import writes nothing and says so", () => {
    const { db } = firstImport();
    const system = db.source_system[0]!.id as string;
    const changed = sample("crm_snapshot_2026-10-20.csv");
    const input = inputFor(db, changed, { systemId: system });
    // meanwhile someone edits a column the import reads
    const edited = { ...db, source_column: db.source_column.map((c) => (c.name === "cust_no" ? { ...c, comment: "Meanwhile", version: (c.version as number) + 1 } : c)) };
    expect(importSources(ctxOf(), as("modeler"), stateOf(edited), input)).toEqual({
      ok: false,
      error: { code: "conflict", message: "CRM changed since you opened this review. The review now shows the current state; check it and import again.", fields: { [STALE_REVIEW_FIELD]: "stale" } },
    });
    expect(importSources(ctxOf(), as("modeler"), stateOf(db), input).ok).toBe(true);
  });

  it("refuses a file the server cannot read, and an empty scope", () => {
    const db = emptyDb();
    expect(importSources(ctxOf(), as("modeler"), stateOf(db), { ...inputFor(db, sample("hr_snapshot_2026-10-20.csv"), { newName: "HR" }), text: "" })).toMatchObject({
      ok: false,
      error: { message: "The file is empty." },
    });
    expect(importSources(ctxOf(), as("modeler"), stateOf(db), { ...inputFor(db, sample("hr_snapshot_2026-10-20.csv"), { newName: "HR" }), scope: [] })).toMatchObject({
      ok: false,
      error: { message: "Select at least one table to import." },
    });
  });

  it("a re-import sends an approved mapping back to review with its reason; undo puts back everything (S7A-09)", () => {
    const first = firstImport();
    const db = withEmailMapping(first.db);
    const system = db.source_system[0]!.id as string;
    const ctx = ctxOf();
    const result = okSet(importSources(ctx, as("modeler"), stateOf(db), inputFor(db, sample("crm_snapshot_2026-10-20.csv"), { systemId: system }, {}, "crm_snapshot.csv")));
    const after = applyTo(db, result);
    expect(result.value.sentBack).toBe(1);
    expect(after.mapping[0]).toMatchObject({ status: "review", approved_by: null, approved_at: null, review_reason: "type conflict, varchar(255) into string(120)" });
    // one undo step brings back the columns, the mapping's approval, and removes what was added
    const undo = revertChangeGroup(ctxOf(), as("modeler"), { events: result.events, rows: after as unknown as WorkspaceRows }, "undo");
    if (!undo.ok) throw new Error(undo.error.message);
    const back = applyTo(after, undo.writeSet);
    const comparable = (rows: Record<string, unknown>[]) =>
      rows.filter((r) => r.deleted_at === null).map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !["version", "updated_at", "updated_by"].includes(k))));
    for (const t of ["source_table", "source_column", "source_relationship", "source_relationship_column", "mapping", "source_import"] as const) {
      expect(comparable(back[t]), t).toEqual(comparable(db[t]));
    }
  });

  it("slice 7b: the import stores the changes it raises with their events; a later import settles them; undo takes them back", () => {
    const first = firstImport();
    const db = withEmailMapping(first.db);
    const system = db.source_system[0]!.id as string;
    const result = okSet(importSources(ctxOf(), as("modeler"), stateOf(db), inputFor(db, sample("crm_snapshot_2026-10-20.csv"), { systemId: system }, {}, "crm_snapshot.csv")));
    const after = applyTo(db, result);
    const changes = after.source_change as unknown as SourceChange[];
    expect(changes.length).toBe(result.value.counts.changes_raised);
    expect(changes.every((c) => c.status === "open" && c.source_import_id === result.value.importId && c.created_by === ids.actor)).toBe(true);
    expect(result.events.filter((e) => e.object_type === "source_change").length).toBe(changes.length);
    expect(result.value.summary).toMatch(/, \d+ to resolve \(\d+ high\)$/);
    // the full file again: what left is back, what was new and is gone left before a decision
    const again = okSet(importSources(ctxOf(), as("modeler"), stateOf(after), inputFor(after, sample("crm_sqlserver_catalog.tsv"), { systemId: system })));
    const settled = (applyTo(after, again).source_change as unknown as SourceChange[]).filter((c) => c.status === "resolved");
    expect(settled.length).toBeGreaterThan(0);
    expect(settled.every((c) => /^(Back in the source|Left the source) on \d{4}-\d{2}-\d{2}/.test(c.resolution!) && c.resolved_by === ids.actor)).toBe(true);
    // undoing the first re-import is refused now (its changes were settled since, 7a's all or nothing); undoing the
    // second, then the first, works
    expect(revertChangeGroup(ctxOf(), as("modeler"), { events: result.events, rows: applyTo(after, again) as unknown as WorkspaceRows }, "undo").ok).toBe(false);
    const undoAgain = okSet(revertChangeGroup(ctxOf(), as("modeler"), { events: again.events, rows: applyTo(after, again) as unknown as WorkspaceRows }, "undo"));
    const back = applyTo(applyTo(after, again), undoAgain);
    const undoFirst = okSet(revertChangeGroup(ctxOf(), as("modeler"), { events: result.events, rows: back as unknown as WorkspaceRows }, "undo"));
    expect((applyTo(back, undoFirst).source_change as unknown as SourceChange[]).every((c) => c.deleted_at !== null)).toBe(true);
  });

  it("four-eyes (answer 7): the person who imported is the last editor of a mapping the import sent back", () => {
    const first = firstImport();
    const db = withEmailMapping(first.db);
    const system = db.source_system[0]!.id as string;
    const result = okSet(importSources(ctxOf(), as("modeler"), stateOf(db), inputFor(db, sample("crm_snapshot_2026-10-20.csv"), { systemId: system })));
    const after = applyTo(db, result);
    const mapping = after.mapping[0] as unknown as Mapping;
    expect(lastContentEditor(mapping, result.events as ChangeEvent[])).toBe(ids.actor);
    const approve = (role: WorkspaceRole, actor: string, fourEyes: boolean) =>
      setMappingStatus(ctxOf(actor), as(role, { four_eyes: fourEyes }), { mapping, contentAuthorId: lastContentEditor(mapping, result.events) }, { mappingId: mapping.id, expectedVersion: mapping.version, status: "approved" });
    expect(approve("modeler", ids.actor, true)).toMatchObject({ ok: false, error: { code: "forbidden" } });
    expect(approve("reviewer", ids.someoneElse, true).ok).toBe(true);
    // four-eyes off: the person who imported approves it again, and the reason is cleared
    const self = approve("modeler", ids.actor, false);
    expect(self.ok && (self.writeSet.writes[0] as { row: Mapping }).row).toMatchObject({ status: "approved", review_reason: null });
  });

  it("a content change or any status change clears the reason (answer 6)", () => {
    const first = firstImport();
    const db = withEmailMapping(first.db);
    const result = okSet(importSources(ctxOf(), as("modeler"), stateOf(db), inputFor(db, sample("crm_snapshot_2026-10-20.csv"), { systemId: db.source_system[0]!.id as string })));
    const mapping = applyTo(db, result).mapping[0] as unknown as Mapping;
    const toDraft = setMappingStatus(ctxOf(), as("modeler"), { mapping, contentAuthorId: ids.someoneElse }, { mappingId: mapping.id, expectedVersion: mapping.version, status: "draft" });
    expect(toDraft.ok && (toDraft.writeSet.writes[0] as { row: Mapping }).row.review_reason).toBeNull();
    const ruled = updateMapping(ctxOf(), as("modeler"), { mapping, inputs: [mappingInput(ids.inEmail, { mapping_id: mapping.id })] }, { mappingId: mapping.id, expectedVersion: mapping.version, note: "x" });
    expect(ruled.ok && (ruled.writeSet.writes[0] as { row: Mapping }).row.review_reason).toBe(mapping.review_reason); // a note is not content (D-51)
    const kind = updateMapping(ctxOf(), as("modeler"), { mapping, inputs: [mappingInput(ids.inEmail, { mapping_id: mapping.id })] }, { mappingId: mapping.id, expectedVersion: mapping.version, kind: "transform", ruleExpression: "LOWER(email_addr)" });
    expect(kind.ok && (kind.writeSet.writes[0] as { row: Mapping }).row.review_reason).toBeNull();
  });
});

describe("rules that come with source imports", () => {
  it("deleting a source table takes its relationships in both directions with it", () => {
    const { db } = firstImport();
    const tables = db.source_table as unknown as SourceTable[];
    const customers = tables.find((t) => t.name === "customers")!;
    const columns = (db.source_column as unknown as SourceColumn[]).filter((c) => c.source_table_id === customers.id);
    const r = deleteSourceTable(
      ctxOf(),
      as("modeler"),
      { table: customers, columns, canvasItems: [], mappings: [], mappingInputs: [], attributes: [], entities: [], relationships: db.source_relationship as unknown as SourceRelationship[], relationshipColumns: db.source_relationship_column as unknown as SourceRelationshipColumn[] },
      { sourceTableId: customers.id, expectedVersion: customers.version },
    );
    if (!r.ok) throw new Error(r.error.message);
    const deleted = r.writeSet.events.filter((e) => e.operation === "delete").map((e) => e.object_type);
    expect(deleted.filter((t) => t === "source_relationship")).toHaveLength(1); // the key from customer_addresses to customers
    expect(deleted.filter((t) => t === "source_relationship_column")).toHaveLength(1);
  });

  it("coverage (answer 9): an approved mapping from a column missing from source covers nothing", () => {
    const { db } = firstImport();
    const model = withEmailMapping(db);
    const columns = model.source_column as unknown as SourceColumn[];
    const scope = (cols: SourceColumn[]) => ({
      entities: model.entity as unknown as Entity[],
      attributes: model.attribute as unknown as Attribute[],
      mappings: model.mapping as unknown as Mapping[],
      mappingInputs: model.mapping_input as unknown as MappingInput[],
      sourceTables: [sourceTable()],
      sourceColumns: cols,
    });
    const mapping = model.mapping[0] as unknown as Mapping;
    expect(countsForCoverage(mapping, scope(columns))).toBe(true);
    expect(countsForCoverage(mapping, scope(columns.map((c) => (c.name === "email_addr" ? { ...c, missing_since: T1 } : c))))).toBe(false);
  });
});
