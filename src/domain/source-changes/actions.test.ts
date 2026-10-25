import { describe, expect, it } from "vitest";
import type { CommandContext } from "../changes";
import { ids, requirement, requirementLink, workspace } from "../__fixtures__/domain";
import { attributeNamed, columnNamed, importId, tableNamed, withMapping } from "../__fixtures__/import";
import { ACTOR, applyEdits, crmAfterReimport, rowsOf } from "../__fixtures__/source-changes";
import type { ImportModel } from "../import/model";
import { FOUR_EYES_MESSAGE } from "../model/mapping-rules";
import type { SourceChange, SourceRelationship, SourceRelationshipColumn } from "../types";
import {
  actionsFor,
  approveAgain,
  approveAllEdits,
  approveAllPlan,
  decideColumnByColumn,
  deleteForChange,
  leaveInReview,
  mapToAttribute,
  markAsNeeded,
  markNotNeeded,
  movePlan,
  moveMappings,
  moveTargets,
  acknowledge,
  retire,
  type ActionResult,
} from "./actions";
import { coverageChangeText } from "./coverage";
import { sourceDeleteCascade, sourceDeleteImpact, type SourceDeleteRows } from "./delete";
import { inputColumnsOf, isHistorical, mappingUntil, untilOf } from "./rules";

const NOW = "2026-10-06T10:00:00.000Z";
const ctx = (actorId = ACTOR): CommandContext => ({ actorId, now: NOW, newId: importId });

function scenario() {
  const s = crmAfterReimport();
  const change = (label: string, kind?: SourceChange["kind"]) => s.model.changes!.find((c) => c.object_label === label && (!kind || c.kind === kind))!;
  const col = (table: string, name: string) => columnNamed(s.model, table, name);
  const mapping = (id: string) => s.model.mappings.find((m) => m.id === id)!;
  return { ...s, change, col, mapping };
}

function applied(model: ImportModel, r: ActionResult): ImportModel {
  if (!r.ok) throw new Error(r.error.message);
  return applyEdits(model, r.edits);
}

const changeIn = (m: ImportModel, id: string) => m.changes!.find((c) => c.id === id)!;
const deleteRows = (m: ImportModel, more: Partial<SourceDeleteRows> = {}): SourceDeleteRows & ReturnType<typeof rowsOf> => ({
  ...rowsOf(m),
  relationships: [],
  relationshipColumns: [],
  canvasItems: [],
  ...more,
});

describe("the actions each kind offers (item 10)", () => {
  it("per kind, and approve again only when the mapping fits (P8)", () => {
    const s = scenario();
    const rows = rowsOf(s.model);
    expect(actionsFor(rows, s.change("dbo.customers.segment"))).toEqual(["retire", "move", "delete"]);
    expect(actionsFor(rows, s.change("dbo.orders"))).toEqual(["retire", "delete"]);
    expect(actionsFor(rows, s.change("dbo.customers.phone"))).toEqual(["map", "not_needed"]);
    expect(actionsFor(rows, s.change("dbo.payments"))).toEqual(["not_needed", "split"]);
    expect(actionsFor(rows, s.change("dbo.customers.cust_no"))).toEqual(["approve", "leave"]);
    expect(actionsFor(rows, s.change("dbo.customers.email"))).toEqual(["leave"]);
  });
});

describe("retire (P6, item 11, S7B-04)", () => {
  it("a column: retired, its mappings historical with until the day it left; the change resolved", () => {
    const s = scenario();
    const c = s.change("dbo.customers.segment");
    const after = applied(s.model, retire(ctx(), rowsOf(s.model), c.id));
    const segment = columnNamed(after, "customers", "segment");
    expect(segment.retired_since).toBe(NOW);
    expect(untilOf(segment)).toBe("2026-10-05");
    expect(changeIn(after, c.id)).toMatchObject({ status: "resolved", resolution: "Retired: kept as historical", resolved_by: ACTOR, resolved_at: NOW });
    // a direct mapping is historical; the combined one with a live input is not (Q10)
    const inputs = (id: string) => inputColumnsOf(id, after.mappingInputs, after.columns);
    expect(isHistorical(inputs(s.mappings.segment))).toBe(true);
    expect(mappingUntil(inputs(s.mappings.segment))).toBe("2026-10-05");
    expect(isHistorical(inputs(s.mappings.label))).toBe(false);
    expect(mappingUntil(inputs(s.mappings.label))).toBeNull();
  });

  it("a table: the table and its missing columns, and a column change of its own settled with it", () => {
    const s = scenario();
    const table = tableNamed(s.model, "orders");
    const custId = columnNamed(s.model, "orders", "cust_id");
    const earlier: SourceChange = { ...s.change("dbo.customers.created_ts"), id: importId(), source_table_id: table.id, source_column_id: custId.id, object_label: "dbo.orders.cust_id" };
    const model = { ...s.model, changes: [...s.model.changes!, earlier] };
    const c = s.change("dbo.orders");
    const after = applied(model, retire(ctx(), rowsOf(model), c.id));
    expect(tableNamed(after, "orders").retired_since).toBe(NOW);
    expect(after.columns.filter((x) => x.source_table_id === table.id).every((x) => x.retired_since === NOW)).toBe(true);
    expect(changeIn(after, c.id).resolution).toBe("Retired: kept as historical");
    expect(changeIn(after, earlier.id).resolution).toBe("Settled: the table was retired");
  });

  it("refuses a change already resolved", () => {
    const s = scenario();
    const c = s.change("dbo.customers.segment");
    const once = applied(s.model, retire(ctx(), rowsOf(s.model), c.id));
    expect(retire(ctx(), rowsOf(once), c.id)).toEqual({ ok: false, error: { code: "conflict", message: "This change is already resolved." } });
  });
});

describe("move its mappings (item 12, Q5, S7B-05)", () => {
  it("offers the system's present columns, the same table first", () => {
    const s = scenario();
    const groups = moveTargets(rowsOf(s.model), s.change("dbo.customers.segment"));
    expect(groups.map((g) => g.table.name)).toEqual(["customers", "payments"]);
    expect(groups[0]!.columns.map((c) => `${c.name} · ${c.type}`)).toEqual(["id · int", "cust_no · varchar(25)", "email · varchar(255)", "created_on · date", "phone · varchar(30)"]);
  });

  it("a direct and a combined mapping: that input only, approved to review with the reason, the rule rewritten, the old column retired", () => {
    const s = scenario();
    const c = s.change("dbo.customers.segment");
    const phone = s.col("customers", "phone");
    const after = applied(s.model, moveMappings(ctx(), rowsOf(s.model), c.id, phone.id));
    const segment = s.mapping(s.mappings.segment);
    const label = after.mappings.find((m) => m.id === s.mappings.label)!;
    expect(after.mappings.find((m) => m.id === segment.id)).toMatchObject({ status: "review", approved_by: null, review_reason: "moved from segment after it left the source" });
    expect(label).toMatchObject({ status: "review", rule_expression: "CONCAT(phone, email)", review_reason: "moved from segment after it left the source" });
    expect(inputColumnsOf(label.id, after.mappingInputs, after.columns).map((x) => x.name)).toEqual(["phone", "email"]);
    expect(columnNamed(after, "customers", "segment").retired_since).toBe(NOW);
    expect(changeIn(after, c.id).resolution).toBe("Mappings moved to customers.phone");
    expect(changeIn(after, s.change("dbo.customers.phone").id).resolution).toBe("Settled: mappings moved here from segment");
  });

  it("a draft stays a draft; its rule is rewritten", () => {
    const s = scenario();
    const r = withMapping(s.model, attributeNamed(s.model, "created_at").id, [s.col("customers", "created_ts").id], { status: "draft", rule: "CAST(created_ts AS date)" });
    const c = s.change("dbo.customers.created_ts");
    const after = applied(r.model, moveMappings(ctx(), rowsOf(r.model), c.id, s.col("customers", "created_on").id));
    expect(after.mappings.find((m) => m.id === r.mappingId)).toMatchObject({ status: "draft", rule_expression: "CAST(created_on AS date)", review_reason: null });
  });

  it("onto a column the combined mapping already reads: the old input is removed, and the form says so first", () => {
    const s = scenario();
    const c = s.change("dbo.customers.segment");
    const email = s.col("customers", "email");
    const plan = movePlan(rowsOf(s.model), c, email.id);
    if (!plan.ok) throw new Error();
    expect(plan.steps.map((x) => [x.attribute, x.dropsInput, x.backToReview, x.note])).toEqual([
      ["Customer.segment_code", false, true, null],
      ["Customer.label", true, true, "Customer.label already reads email; the input from segment is removed."],
    ]);
    const after = applied(s.model, moveMappings(ctx(), rowsOf(s.model), c.id, email.id));
    expect(inputColumnsOf(s.mappings.label, after.mappingInputs, after.columns).map((x) => x.name)).toEqual(["email"]);
  });

  it("refuses a direct mapping that would repeat another mapping of the attribute from the target", () => {
    const s = scenario();
    const r = withMapping(s.model, attributeNamed(s.model, "segment_code").id, [s.col("customers", "phone").id], { status: "draft" });
    expect(moveMappings(ctx(), rowsOf(r.model), s.change("dbo.customers.segment").id, s.col("customers", "phone").id)).toEqual({
      ok: false,
      error: { code: "conflict", message: "Customer.segment_code already has a mapping from phone. Delete this one instead." },
    });
  });
});

describe("delete (item 13, Q4, Q7, S7B-06)", () => {
  it("a column: its direct mapping goes, the combined one loses the input and goes to review; the impact before, with coverage", () => {
    const s = scenario();
    const c = s.change("dbo.customers.segment");
    const segmentCode = attributeNamed(s.model, "segment_code");
    const rows = deleteRows(s.model);
    const cascade = sourceDeleteCascade(rows, { columnId: c.source_column_id! })!;
    const impact = sourceDeleteImpact(rows, cascade, {
      canvases: [],
      requirements: [requirement(undefined, { key: "REQ-101" })],
      requirementLinks: [requirementLink(undefined, { attribute_id: segmentCode.id })],
    });
    expect(impact).toMatchObject({ what: "column", label: "dbo.customers.segment", columns: 0, relationships: [] });
    expect(impact.mappings.map((m) => [m.attribute, m.status, m.effect])).toEqual([
      ["Customer.segment_code", "approved", "deleted"],
      ["Customer.label", "approved", "loses this input"],
    ]);
    // the change's column left, so its approved mapping already covers nothing: deleting it changes no coverage
    expect(impact.coverage).toEqual([]);

    const result = deleteForChange(ctx(), rows, c.id);
    const after = applied(s.model, result);
    expect(after.mappings.find((m) => m.id === s.mappings.segment)!.deleted_at).toBe(NOW);
    expect(after.mappings.find((m) => m.id === s.mappings.label)).toMatchObject({ deleted_at: null, status: "review", review_reason: "segment was deleted from the source" });
    expect(inputColumnsOf(s.mappings.label, after.mappingInputs, after.columns).map((x) => x.name)).toEqual(["email"]);
    expect(columnNamed(after, "customers", "segment").deleted_at).toBe(NOW);
    expect(changeIn(after, c.id).resolution).toBe("Deleted from the model");
  });

  it("the coverage line: a present column's approved mapping deleted", () => {
    const s = scenario();
    const custNo = s.col("customers", "cust_no");
    const r = withMapping(s.model, attributeNamed(s.model, "label").id, [custNo.id]);
    const label = attributeNamed(s.model, "label");
    const rows = deleteRows(r.model);
    const cascade = sourceDeleteCascade(rows, { columnId: custNo.id })!;
    const impact = sourceDeleteImpact(rows, cascade, { canvases: [], requirements: [requirement(undefined, { key: "REQ-101" })], requirementLinks: [requirementLink(undefined, { attribute_id: label.id })] });
    expect(impact.coverage.map((d) => [d.requirement.key, coverageChangeText(d), d.why])).toEqual([["REQ-101", "1 of 1 → 0 of 1", ["label: mapping deleted"]]]);
  });

  it("a table: its columns, relationships both ways and every open change on it", () => {
    const s = scenario();
    const orders = tableNamed(s.model, "orders");
    const custId = s.col("orders", "cust_id");
    const std = { workspace_id: ids.ws, version: 1, created_at: NOW, created_by: ACTOR, updated_at: NOW, updated_by: ACTOR, deleted_at: null };
    const rel: SourceRelationship = { ...std, id: importId(), source_table_id: orders.id, to_source_table_id: tableNamed(s.model, "customers").id, name: "FK_orders_customers", kind: "declared", missing_since: null };
    const pair: SourceRelationshipColumn = { ...std, id: importId(), source_relationship_id: rel.id, from_column_id: custId.id, to_column_id: s.col("customers", "id").id, sort_order: 0 };
    const own: SourceChange = { ...s.change("dbo.customers.created_ts"), id: importId(), source_table_id: orders.id, source_column_id: custId.id, object_label: "dbo.orders.cust_id" };
    const model = { ...s.model, changes: [...s.model.changes!, own] };
    const rows = deleteRows(model, { relationships: [rel], relationshipColumns: [pair] });
    const cascade = sourceDeleteCascade(rows, { tableId: orders.id })!;
    expect(sourceDeleteImpact(rows, cascade, { canvases: [], requirements: [], requirementLinks: [] })).toMatchObject({ what: "table", label: "dbo.orders", columns: 2, relationships: [{ id: rel.id, name: "FK_orders_customers" }] });
    const c = s.change("dbo.orders");
    const result = deleteForChange(ctx(), rows, c.id);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.edits.filter((e) => e.kind === "update" && (e.table === "source_relationship" || e.table === "source_relationship_column")).length).toBe(2);
    const after = applyEdits(model, result.edits);
    expect(tableNamed(after, "orders").deleted_at).toBe(NOW);
    expect(changeIn(after, c.id).resolution).toBe("Deleted from the model");
    expect(changeIn(after, own.id).resolution).toBe("Settled: the table was deleted");
  });
});

describe("map, not needed, decide column by column, mark as needed (items 14, 15, 18, S7B-07)", () => {
  it("map to an attribute: a draft direct mapping; a mapping that exists is refused", () => {
    const s = scenario();
    const c = s.change("dbo.customers.created_on");
    const createdAt = attributeNamed(s.model, "created_at");
    const after = applied(s.model, mapToAttribute(ctx(), rowsOf(s.model), c.id, createdAt.id, ids.ws));
    const m = after.mappings.find((x) => x.attribute_id === createdAt.id && x.created_at === NOW)!;
    expect(m).toMatchObject({ kind: "direct", status: "draft" });
    expect(inputColumnsOf(m.id, after.mappingInputs, after.columns).map((x) => x.name)).toEqual(["created_on"]);
    expect(changeIn(after, c.id).resolution).toBe("Mapped to Customer.created_at (draft)");
    const again = { ...after, changes: s.model.changes };
    expect(mapToAttribute(ctx(), rowsOf(again), c.id, createdAt.id, ids.ws)).toEqual({ ok: false, error: { code: "conflict", message: "That mapping already exists." } });
  });

  it("not needed on a column and on a table; mark as needed takes it back (P10)", () => {
    const s = scenario();
    const one = applied(s.model, markNotNeeded(ctx(), rowsOf(s.model), s.change("dbo.customers.phone").id));
    expect(columnNamed(one, "customers", "phone").not_needed).toBe(true);
    expect(changeIn(one, s.change("dbo.customers.phone").id).resolution).toBe("Marked not needed");
    const all = applied(s.model, markNotNeeded(ctx(), rowsOf(s.model), s.change("dbo.payments").id));
    expect(all.columns.filter((x) => x.source_table_id === tableNamed(s.model, "payments").id).map((x) => x.not_needed)).toEqual([true, true]);
    const back = markAsNeeded(ctx(), columnNamed(one, "customers", "phone"));
    if (!back.ok) throw new Error();
    expect(applyEdits(one, back.edits).columns.find((x) => x.name === "phone")!.not_needed).toBe(false);
    expect(markAsNeeded(ctx(), columnNamed(s.model, "customers", "phone"))).toEqual({ ok: false, error: { code: "invalid", message: "Nothing to change." } });
  });

  it("decide column by column: one new-column change per column, same import", () => {
    const s = scenario();
    const c = s.change("dbo.payments");
    const after = applied(s.model, decideColumnByColumn(ctx(), rowsOf(s.model), c.id, ids.ws));
    expect(changeIn(after, c.id).resolution).toBe("Split into one decision per column");
    const fresh = after.changes!.filter((x) => x.created_at === NOW);
    expect(fresh.map((x) => [x.kind, x.object_label, x.detail, x.source_import_id === c.source_import_id, x.status])).toEqual([
      ["new_column", "dbo.payments.id", "New in the source, int.", true, "open"],
      ["new_column", "dbo.payments.amount", "New in the source, decimal(18,2).", true, "open"],
    ]);
  });
});

describe("approve again and leave in review (item 16, P8, S7B-08)", () => {
  const ws = (fourEyes: boolean) => workspace({ four_eyes: fourEyes });

  it("approves a mapping that fits, settling the change; refuses one that does not", () => {
    const s = scenario();
    const c = s.change("dbo.customers.cust_no");
    const after = applied(s.model, approveAgain(ctx(), rowsOf(s.model), c.id, ws(false), ACTOR));
    expect(after.mappings.find((m) => m.id === s.mappings.custNo)).toMatchObject({ status: "approved", approved_by: ACTOR, approved_at: NOW, review_reason: null });
    expect(changeIn(after, c.id).resolution).toBe("Approved again");
    expect(approveAgain(ctx(), rowsOf(s.model), s.change("dbo.customers.email").id, ws(false), ACTOR)).toEqual({
      ok: false,
      error: { code: "conflict", message: "This mapping does not fit the source yet, so it cannot be approved again." },
    });
  });

  it("four-eyes on refuses the person who imported (the last editor) and accepts someone else", () => {
    const s = scenario();
    const c = s.change("dbo.customers.cust_no");
    expect(approveAgain(ctx(), rowsOf(s.model), c.id, ws(true), ACTOR)).toEqual({ ok: false, error: { code: "forbidden", message: FOUR_EYES_MESSAGE } });
    expect(approveAgain(ctx(), rowsOf(s.model), c.id, ws(true), ids.someoneElse).ok).toBe(true);
  });

  it("leave it in review settles only the change; a business key change without a mapping is acknowledged", () => {
    const s = scenario();
    const c = s.change("dbo.customers.email");
    const result = leaveInReview(ctx(), rowsOf(s.model), c.id);
    if (!result.ok) throw new Error();
    expect(result.edits.map((e) => e.table)).toEqual(["source_change"]);
    expect(changeIn(applyEdits(s.model, result.edits), c.id).resolution).toBe("Left in review");
    const loose: SourceChange = { ...s.change("dbo.customers.cust_no"), id: importId(), mapping_id: null };
    const model = { ...s.model, changes: [...s.model.changes!, loose] };
    expect(actionsFor(rowsOf(model), loose)).toEqual(["acknowledge"]);
    expect(changeIn(applied(model, acknowledge(ctx(), rowsOf(model), loose.id)), loose.id).resolution).toBe("Acknowledged: hash keys built on it change");
  });
});

describe("approve again all {n} (item 17, P9, Q11, S7B-09)", () => {
  it("lists those that don't fit first, then those four-eyes keeps from this person; approves the rest in one set of edits", () => {
    const s = scenario();
    const importOf = s.change("dbo.customers.cust_no").source_import_id;
    const off = approveAllPlan(rowsOf(s.model), importOf, workspace({ four_eyes: false }), ACTOR, () => ids.someoneElse);
    expect(off.approve.map((e) => e.attribute)).toEqual(["Customer.customer_number"]);
    expect(off.notFit.map((e) => [e.attribute, e.why])).toEqual([["Customer.email", ["type conflict, varchar(255) into string(120)"]]]);
    expect(off.refused).toEqual([]);
    const after = applyEdits(s.model, approveAllEdits(ctx(), rowsOf(s.model), off));
    expect(after.mappings.find((m) => m.id === s.mappings.custNo)!.status).toBe("approved");
    expect(after.mappings.find((m) => m.id === s.mappings.email)!.status).toBe("review");
    expect(changeIn(after, s.change("dbo.customers.cust_no").id).resolution).toBe("Approved again");

    const on = approveAllPlan(rowsOf(s.model), importOf, workspace({ four_eyes: true }), ACTOR, () => ACTOR);
    expect([on.approve.length, on.notFit.map((e) => e.attribute), on.refused.map((e) => e.attribute)]).toEqual([0, ["Customer.email"], ["Customer.customer_number"]]);
  });
});
