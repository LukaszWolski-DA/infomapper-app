import { describe, expect, it } from "vitest";
import type { CommandContext } from "../changes";
import { importId } from "../__fixtures__/import";
import { ACTOR, applyEdits, crmAfterReimport } from "../__fixtures__/source-changes";
import { settleByStatus, settleDeletedMappings, settleMappedColumn, settleMergedMappings, settleRemovedInput } from "./settle";

const ctx: CommandContext = { actorId: ACTOR, now: "2026-10-06T10:00:00.000Z", newId: importId };

describe("changes settled elsewhere (Q12, P7)", () => {
  const s = crmAfterReimport();
  const change = (label: string) => s.model.changes!.find((c) => c.object_label === label)!;
  const resolution = (edits: ReturnType<typeof settleByStatus>, label: string) => applyEdits(s.model, edits).changes!.find((c) => c.id === change(label).id)!.resolution;

  it("a mapping deleted with its entity, its attribute or by itself", () => {
    expect(resolution(settleDeletedMappings(ctx, s.model.changes, [s.mappings.email], "attribute"), "dbo.customers.email")).toBe("Settled: the attribute was deleted");
    expect(resolution(settleDeletedMappings(ctx, s.model.changes, [s.mappings.email], "entity"), "dbo.customers.email")).toBe("Settled: the entity was deleted");
    expect(resolution(settleDeletedMappings(ctx, s.model.changes, [s.mappings.email], "mapping"), "dbo.customers.email")).toBe("Settled: the mapping was deleted");
    expect(resolution(settleMergedMappings(ctx, s.model.changes, [s.mappings.email]), "dbo.customers.email")).toBe("Settled: the mapping was merged into another");
  });

  it("a status set in the mapping panel answers the review", () => {
    expect(resolution(settleByStatus(ctx, s.model.changes, s.mappings.custNo, "approved"), "dbo.customers.cust_no")).toBe("Settled: the mapping was approved in its panel");
    expect(resolution(settleByStatus(ctx, s.model.changes, s.mappings.custNo, "draft"), "dbo.customers.cust_no")).toBe("Settled: the mapping's status was set to Draft in its panel");
    expect(resolution(settleByStatus(ctx, s.model.changes, s.mappings.custNo, "review"), "dbo.customers.cust_no")).toBe("Settled: the mapping's status was set to In review in its panel");
  });

  it("an input removed, and a new column mapped by another path", () => {
    const email = change("dbo.customers.email");
    expect(resolution(settleRemovedInput(ctx, s.model.changes, s.mappings.email, { id: email.source_column_id!, name: "email" }), "dbo.customers.email")).toBe("Settled: email no longer feeds the mapping");
    const phone = change("dbo.customers.phone");
    expect(resolution(settleMappedColumn(ctx, s.model.changes, phone.source_column_id!, "Customer.label", "review"), "dbo.customers.phone")).toBe("Settled: mapped to Customer.label (in review)");
  });

  it("settles nothing that is not about the object, and never a resolved change twice", () => {
    expect(settleDeletedMappings(ctx, s.model.changes, ["01900000-0000-7000-8000-ffffffffffff"], "mapping")).toEqual([]);
    const once = applyEdits(s.model, settleByStatus(ctx, s.model.changes, s.mappings.custNo, "approved"));
    expect(settleByStatus(ctx, once.changes, s.mappings.custNo, "approved")).toEqual([]);
  });
});
