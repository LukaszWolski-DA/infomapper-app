import { describe, expect, it } from "vitest";
import { requirement, requirementLink } from "../__fixtures__/domain";
import { allOf, columnNamed, emptyModel, importInto, LATER, tableNamed, withMapping, attributeNamed } from "../__fixtures__/import";
import { CHANGED, crmAfterReimport, crmWithMappings, FULL, standardOf } from "../__fixtures__/source-changes";
import { planFingerprint } from "../import/compare";
import { buildPlan, importSummary } from "../import/plan";
import type { SourceChange } from "../types";
import { coverageDelta, coverageChangeText, scopeModelOf } from "./coverage";
import { raisedCallout } from "./texts";

const raised = (changes: readonly SourceChange[]) => changes.filter((c) => c.status === "open").map((c) => `${c.kind}:${c.severity}:${c.object_label}`);

describe("raising changes (S7B-01, items 6 and 8)", () => {
  it("a first import of a system raises none", () => {
    const first = importInto(emptyModel(), FULL, { newName: "CRM" });
    expect(first.plan.raises).toEqual([]);
    expect(first.changes.counts).toMatchObject({ changes_raised: 0, changes_high: 0 });
    expect(importSummary(first.changes.counts)).toBe("2 new tables, 7 new columns");
  });

  it("a re-import raises each kind with its severity, label and detail; the summary and the counts carry them", () => {
    const { model, mappings, changes } = crmAfterReimport();
    expect(raised(model.changes!)).toEqual([
      "new_column:normal:dbo.customers.created_on",
      "new_column:normal:dbo.customers.phone",
      "column_left:high:dbo.customers.segment",
      "column_left:normal:dbo.customers.created_ts",
      "new_table:normal:dbo.payments",
      "table_left:normal:dbo.orders",
      "business_key_changed:high:dbo.customers.cust_no",
      "type_conflict:high:dbo.customers.email",
    ]);
    const by = (kind: string) => model.changes!.find((c) => c.kind === kind)!;
    expect(by("column_left").detail).toBe("Not in the file. Was char(3), with 2 mappings.");
    expect(model.changes!.find((c) => c.object_label === "dbo.customers.created_ts")!.detail).toBe("Not in the file. Was datetime2(7), with 1 mapping.");
    expect(by("table_left").detail).toBe("Not in the file. Its 2 columns are marked missing from source.");
    expect(by("new_table").detail).toBe("New in the source, 2 columns with no mapping yet.");
    expect(model.changes!.find((c) => c.object_label === "dbo.customers.phone")!.detail).toBe("New in the source, varchar(30).");
    expect(by("business_key_changed")).toMatchObject({
      mapping_id: mappings.custNo,
      detail: "The approved mapping to Customer.customer_number went back to review: business key column changed type, varchar(20) → varchar(25).",
    });
    expect(by("type_conflict")).toMatchObject({ mapping_id: mappings.email, detail: "The approved mapping to Customer.email went back to review: type conflict, varchar(255) into string(120)." });
    // new rows get their ids: the new column's change names it, the new table's too
    expect(by("new_table").source_table_id).toBe(tableNamed(model, "payments").id);
    expect(model.changes!.find((c) => c.object_label === "dbo.customers.phone")!.source_column_id).toBe(columnNamed(model, "customers", "phone").id);
    // every change names the import and the system
    expect(new Set(model.changes!.map((c) => c.source_import_id))).toEqual(new Set([changes.importId]));
    expect(changes.counts).toMatchObject({ changes_raised: 8, changes_high: 3 });
    expect(importSummary(changes.counts)).toBe("1 new table, 4 new columns, 2 changed columns, 4 missing from source, 8 to resolve (3 high)");
    // the review says it before the import (item 9)
    const { plan } = crmAfterReimport();
    expect(raisedCallout(plan.raises, "CRM")).toBe(
      "After the import, 8 changes to resolve, 3 of them high. They wait on CRM’s page until you decide: new columns, columns that left, new tables, a table that left, business key changes, type conflicts.",
    );
    expect(raisedCallout([], "CRM")).toBeNull();
  });

  it("a draft or review mapping's new conflict is not a change (Q13); a business key change without a sent-back mapping is", () => {
    const base = crmWithMappings();
    // cust_no's only mapping is a draft
    const model = { ...base.model, mappings: base.model.mappings.map((m) => (m.id === base.mappings.custNo || m.id === base.mappings.email ? { ...m, status: "draft" as const, approved_by: null, approved_at: null } : m)) };
    const plan = buildPlan(model, CHANGED, { systemId: base.systemId }, allOf(CHANGED));
    expect(plan.mappings.find((m) => m.mappingId === base.mappings.email)!.reasons).toEqual(["type conflict, varchar(255) into string(120)"]);
    expect(plan.raises.filter((r) => r.mappingId)).toEqual([]);
    expect(plan.raises.find((r) => r.kind === "business_key_changed")).toMatchObject({
      mappingId: null,
      severity: "high",
      detail: "Business key column changed type, varchar(20) → varchar(25). Hash keys built on it change too.",
    });
  });

  it("a mapping whose rule names a renamed input: rule_updated, normal", () => {
    const base = crmWithMappings();
    const systemId = base.systemId;
    const r = withMapping(base.model, attributeNamed(base.model, "created_at").id, [columnNamed(base.model, "customers", "created_ts").id], { rule: "CAST(created_ts AS date)" });
    const model = r.model;
    const renamed = standardOf("crm,dbo,customers,id,1,int,no,yes,\ncrm,dbo,customers,cust_no,2,varchar(20),no,no,BK\ncrm,dbo,customers,email,3,varchar(120),yes,no,\ncrm,dbo,customers,segment,4,char(3),yes,no,\ncrm,dbo,customers,created_on,5,datetime2,yes,no,");
    const plan = buildPlan(model, renamed, { systemId }, allOf(renamed, { compare: "tables" }));
    expect(plan.raises.map((x) => [x.kind, x.severity, x.mappingId, x.objectLabel])).toEqual([["rule_updated", "normal", r.mappingId, "dbo.customers.created_on"]]);
  });
});

describe("settling by import (S7B-03, P7)", () => {
  it("a column and a table that come back settle their changes and lose retired_since; a new column that leaves settles its change", () => {
    const after = crmAfterReimport();
    // segment retired meanwhile
    const segment = columnNamed(after.model, "customers", "segment");
    const model = { ...after.model, columns: after.model.columns.map((c) => (c.id === segment.id ? { ...c, retired_since: LATER } : c)) };
    const back = standardOf(
      "crm,dbo,customers,id,1,int,no,yes,\ncrm,dbo,customers,cust_no,2,varchar(25),no,no,BK\ncrm,dbo,customers,email,3,varchar(255),yes,no,\ncrm,dbo,customers,segment,4,char(3),yes,no,\ncrm,dbo,customers,created_on,6,date,yes,no,\ncrm,dbo,orders,id,1,int,no,yes,\ncrm,dbo,orders,cust_id,2,int,no,no,\ncrm,dbo,payments,id,1,int,no,yes,\ncrm,dbo,payments,amount,2,decimal(18,2),yes,no,",
    );
    const again = importInto(model, back, { systemId: after.systemId }, allOf(back));
    const res = (label: string) => again.model.changes!.find((c) => c.object_label === label && c.status === "resolved");
    expect(res("dbo.customers.segment")).toMatchObject({ resolution: "Back in the source on 2026-10-05", resolved_at: LATER });
    expect(res("dbo.orders")).toMatchObject({ resolution: "Back in the source on 2026-10-05" });
    expect(res("dbo.customers.phone")).toMatchObject({ resolution: "Left the source on 2026-10-05 before a decision" });
    expect(columnNamed(again.model, "customers", "segment")).toMatchObject({ missing_since: null, retired_since: null });
    // phone left before a decision: its new-column change settles, and it raises its own “left” change
    expect(again.plan.raises.map((r) => `${r.kind}:${r.objectLabel}`)).toEqual(["column_left:dbo.customers.phone"]);
  });

  it("P8: a change resolved between the review and the import changes the plan's fingerprint", () => {
    const after = crmAfterReimport();
    const target = { systemId: after.systemId };
    const shown = buildPlan(after.model, FULL, target, allOf(FULL));
    const resolved = { ...after.model, changes: after.model.changes!.map((c) => (c.object_label === "dbo.orders" ? { ...c, status: "resolved" as const, version: c.version + 1 } : c)) };
    expect(planFingerprint(buildPlan(after.model, FULL, target, allOf(FULL)))).toBe(planFingerprint(shown));
    expect(planFingerprint(buildPlan(resolved, FULL, target, allOf(FULL)))).not.toBe(planFingerprint(shown));
  });
});

describe("coverage before and after an import (S7B-02, Q3)", () => {
  it("names the requirements whose coverage changes, with before, after and why", () => {
    const { before, model, mappings } = crmAfterReimport();
    const email = before.attributes.find((a) => a.name === "email")!;
    const number = before.attributes.find((a) => a.name === "customer_number")!;
    const reqs = [requirement(undefined, { key: "REQ-101", name: "Contact" }), requirement("01900000-0000-7000-8000-00000000e102", { key: "REQ-102", name: "Untouched" })];
    const links = [
      requirementLink(undefined, { attribute_id: email.id }),
      requirementLink("01900000-0000-7000-8000-00000000e202", { attribute_id: number.id }),
      requirementLink("01900000-0000-7000-8000-00000000e203", { requirement_id: reqs[1]!.id, attribute_id: before.attributes.find((a) => a.name === "label")!.id }),
    ];
    const delta = coverageDelta(reqs, links, scopeModelOf(before), scopeModelOf(model));
    expect(delta.map((d) => [d.requirement.key, coverageChangeText(d)])).toEqual([
      ["REQ-101", "2 of 2 → 0 of 2"],
      ["REQ-102", "1 of 1 → 0 of 1"],
    ]);
    expect(delta[0]!.why).toEqual([
      "customer_number: mapping back to review, business key column changed type, varchar(20) → varchar(25)",
      "email: mapping back to review, type conflict, varchar(255) into string(120)",
    ]);
    // the combined mapping keeps its approval, but an input that left covers nothing (D-31)
    expect(model.mappings.find((m) => m.id === mappings.label)!.status).toBe("approved");
    expect(delta[1]!.why).toEqual(["segment missing from source"]);
  });
});
