import { describe, expect, it } from "vitest";
import { access, archived, ids } from "../__fixtures__/domain";
import { columnNamed, importId } from "../__fixtures__/import";
import { crmAfterReimport, rowsOf } from "../__fixtures__/source-changes";
import type { CommandResult, Write, WriteSet } from "../changes";
import type { ImportModel } from "../import/model";
import { changeLabel } from "../model/change-label";
import type { SourceChange, SourceImport, WorkspaceRole } from "../types";
import {
  approveChangeAgain,
  approveImportAgain,
  deleteChangeObject,
  leaveChangeInReview,
  markColumnNeeded,
  retireChange,
  splitChange,
  type SourceChangeState,
} from "./source-change";
import { revertChangeGroup, UNDOABLE_TABLES, type WorkspaceRows } from "./undo";

const NOW = "2026-10-06T10:00:00.000Z";
const ctx = (actor: string = ids.actor) => ({ actorId: actor, now: NOW, newId: importId });

function scenario() {
  const s = crmAfterReimport();
  const change = (label: string) => s.model.changes!.find((c) => c.object_label === label)!;
  const state: SourceChangeState = { ...rowsOf(s.model), relationships: [], relationshipColumns: [], canvasItems: [] };
  return { ...s, change, state };
}

const ref = (c: SourceChange) => ({ changeId: c.id, expectedVersion: c.version });
const ok = <T>(r: CommandResult<T>): WriteSet & { value: T } => {
  if (!r.ok) throw new Error(r.error.message);
  return Object.assign(r.writeSet, { value: r.value });
};

/** The workspace's rows as the store holds them, for undo. */
function rowsFor(m: ImportModel): Record<string, unknown[]> {
  const rows: Record<string, unknown[]> = Object.fromEntries(UNDOABLE_TABLES.map((t) => [t, []]));
  const anImport = m.changes![0]!;
  const record = { id: anImport.source_import_id, workspace_id: ids.ws, source_system_id: anImport.source_system_id, deleted_at: null } as unknown as SourceImport;
  Object.assign(rows, {
    source_system: [...m.systems],
    source_table: [...m.tables],
    source_column: [...m.columns],
    mapping: [...m.mappings],
    mapping_input: [...m.mappingInputs],
    attribute: [...m.attributes],
    entity: [...m.entities],
    source_change: [...m.changes!],
    source_import: [record],
  });
  return rows;
}
function applyTo(rows: Record<string, unknown[]>, ws: WriteSet): Record<string, unknown[]> {
  const next = Object.fromEntries(Object.entries(rows).map(([t, r]) => [t, [...r]]));
  for (const w of ws.writes as Write[]) {
    if (w.kind === "remove") continue;
    const list = next[w.table]!;
    const i = list.findIndex((r) => (r as { id: string }).id === (w.row as { id: string }).id);
    if (w.kind === "insert") list.push(w.row);
    else list[i] = w.row;
  }
  return next;
}
const changeOf = (rows: Record<string, unknown[]>, id: string) => (rows.source_change as SourceChange[]).find((c) => c.id === id)!;

describe("the commands on changes to resolve (item 19, S7B-15)", () => {
  it("one change group with an event per row; the toast's resolution and label; the undo label", () => {
    const s = scenario();
    const c = s.change("dbo.customers.segment");
    const r = ok(retireChange(ctx(), access("modeler"), s.state, ref(c)));
    expect(r.value).toEqual({ resolution: "Retired: kept as historical", label: "dbo.customers.segment" });
    expect(r.events.map((e) => [e.object_type, e.operation])).toEqual([["source_column", "update"], ["source_change", "update"]]);
    expect(new Set(r.events.map((e) => e.change_group_id)).size).toBe(1);
    expect(changeLabel(r.events)).toBe("Retire dbo.customers.segment");
  });

  it("roles: reviewers answer a review (approve again, leave in review) and nothing else; readers nothing; an archived workspace nothing", () => {
    const s = scenario();
    const as = (role: WorkspaceRole, ws = {}) => access(role, ws);
    expect(retireChange(ctx(), as("reviewer"), s.state, ref(s.change("dbo.customers.segment")))).toMatchObject({ ok: false, error: { code: "forbidden" } });
    expect(splitChange(ctx(), as("reviewer"), s.state, ref(s.change("dbo.payments")))).toMatchObject({ ok: false, error: { code: "forbidden" } });
    const custNo = s.change("dbo.customers.cust_no");
    expect(approveChangeAgain(ctx(), as("reviewer"), { ...s.state, contentAuthorId: ids.someoneElse }, ref(custNo)).ok).toBe(true);
    expect(leaveChangeInReview(ctx(), as("reviewer"), s.state, ref(custNo)).ok).toBe(true);
    expect(leaveChangeInReview(ctx(), as("reader"), s.state, ref(custNo))).toMatchObject({ ok: false, error: { code: "forbidden" } });
    expect(approveChangeAgain(ctx(), as("owner", archived), { ...s.state, contentAuthorId: ids.someoneElse }, ref(custNo))).toMatchObject({ ok: false, error: { code: "archived" } });
  });

  it("a change read at an older version is refused", () => {
    const s = scenario();
    const c = s.change("dbo.customers.segment");
    expect(retireChange(ctx(), access("modeler"), s.state, { changeId: c.id, expectedVersion: c.version + 1 })).toMatchObject({ ok: false, error: { code: "stale_version" } });
  });

  it("four-eyes: the importer cannot approve again; someone else can (S7B-08)", () => {
    const s = scenario();
    const c = s.change("dbo.customers.cust_no");
    const on = access("modeler", { four_eyes: true });
    expect(approveChangeAgain(ctx(), on, { ...s.state, contentAuthorId: ids.actor }, ref(c))).toMatchObject({ ok: false, error: { code: "forbidden" } });
    expect(approveChangeAgain(ctx(), on, { ...s.state, contentAuthorId: ids.someoneElse }, ref(c)).ok).toBe(true);
  });
});

describe("undo (S7B-10)", () => {
  it("an action is one undo step: the change opens again, its objects come back", () => {
    const s = scenario();
    const c = s.change("dbo.customers.segment");
    const rows = rowsFor(s.model);
    const r = ok(deleteChangeObject(ctx(), access("modeler"), s.state, ref(c)));
    const after = applyTo(rows, r);
    expect(changeOf(after, c.id)).toMatchObject({ status: "resolved", resolution: "Deleted from the model" });
    expect(changeLabel(r.events)).toBe("Delete dbo.customers.segment");
    const undo = ok(revertChangeGroup(ctx(), access("modeler"), { events: r.events, rows: after as unknown as WorkspaceRows }, "undo"));
    const back = applyTo(after, undo);
    expect(changeOf(back, c.id)).toMatchObject({ status: "open", resolution: null, resolved_by: null });
    expect((back.source_column as { id: string; deleted_at: string | null }[]).find((x) => x.id === c.source_column_id)!.deleted_at).toBeNull();
    expect((back.mapping as { id: string; deleted_at: string | null; status: string }[]).find((m) => m.id === s.mappings.label)).toMatchObject({ deleted_at: null, status: "approved" });
  });

  it("a reviewer undoes their own approve-again", () => {
    const s = scenario();
    const c = s.change("dbo.customers.cust_no");
    const rows = rowsFor(s.model);
    const r = ok(approveChangeAgain(ctx(), access("reviewer"), { ...s.state, contentAuthorId: ids.someoneElse }, ref(c)));
    const after = applyTo(rows, r);
    expect(changeLabel(r.events)).toBe("Approve again dbo.customers.cust_no");
    const undo = revertChangeGroup(ctx(), access("reviewer"), { events: r.events, rows: after as unknown as WorkspaceRows }, "undo");
    expect(undo.ok).toBe(true);
  });

  it("a new table decided column by column: undo takes the new changes back", () => {
    const s = scenario();
    const c = s.change("dbo.payments");
    const rows = rowsFor(s.model);
    const r = ok(splitChange(ctx(), access("modeler"), s.state, ref(c)));
    const after = applyTo(rows, r);
    expect((after.source_change as SourceChange[]).filter((x) => x.status === "open" && x.kind === "new_column" && x.source_table_id === c.source_table_id)).toHaveLength(2);
    const back = applyTo(after, ok(revertChangeGroup(ctx(), access("modeler"), { events: r.events, rows: after as unknown as WorkspaceRows }, "undo")));
    expect((back.source_change as SourceChange[]).filter((x) => x.deleted_at === null && x.source_table_id === c.source_table_id).map((x) => [x.kind, x.status])).toEqual([["new_table", "open"]]);
  });
});

describe("approve again all {n} and mark as needed (items 17, 18)", () => {
  it("approves what was shown in one group; a list that changed meanwhile is refused", () => {
    const s = scenario();
    const importOf = s.change("dbo.customers.cust_no").source_import_id;
    const state = { ...s.state, authorOf: () => ids.someoneElse };
    expect(approveImportAgain(ctx(), access("modeler"), state, { importId: importOf, count: 2 })).toMatchObject({ ok: false, error: { code: "stale_version" } });
    const r = ok(approveImportAgain(ctx(), access("reviewer"), state, { importId: importOf, count: 1 }));
    expect([r.value.approved, r.value.resolution, r.value.label, r.value.plan.notFit.map((e) => e.attribute)]).toEqual([1, "Approved again", "1 mapping", ["Customer.email"]]);
    expect(changeLabel(r.events)).toBe("Approve again dbo.customers.cust_no");
  });

  it("mark as needed: its own undo step, editors only", () => {
    const s = scenario();
    const phone = { ...columnNamed(s.model, "customers", "phone"), not_needed: true };
    const r = ok(markColumnNeeded(ctx(), access("modeler"), { column: phone }, { sourceColumnId: phone.id, expectedVersion: phone.version }));
    expect(changeLabel(r.events)).toBe("Mark phone as needed");
    expect(markColumnNeeded(ctx(), access("reviewer"), { column: phone }, { sourceColumnId: phone.id, expectedVersion: phone.version })).toMatchObject({ ok: false, error: { code: "forbidden" } });
  });
});
