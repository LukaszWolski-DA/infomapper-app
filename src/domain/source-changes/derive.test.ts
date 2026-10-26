import { describe, expect, it } from "vitest";
import { changeEvent, ids } from "../__fixtures__/domain";
import { allOf, importId, importInto } from "../__fixtures__/import";
import { atImport, CHANGED, crmWithMappings, IMPORTER, LATER, T0 } from "../__fixtures__/source-changes";
import type { ImportModel } from "../import/model";
import type { SourceImport } from "../types";
import { deriveSourceChanges, kindOfReason } from "./derive";

/** A data file as slice 7a leaves it: CRM imported at T0, re-imported at LATER; no changes to resolve stored. */
function sevenA() {
  const base = crmWithMappings();
  const { changes, plan } = importInto(base.model, CHANGED, { systemId: base.systemId }, allOf(CHANGED));
  const model: ImportModel = { ...atImport(base.model, changes), changes: [] };
  const record = (id: string, at: string): SourceImport => ({
    id,
    workspace_id: ids.ws,
    version: 1,
    created_at: at,
    created_by: IMPORTER,
    updated_at: at,
    updated_by: IMPORTER,
    deleted_at: null,
    source_system_id: base.systemId,
    channel: "file",
    source_label: "crm.csv",
    tables_new: 0,
    columns_new: 0,
    columns_changed: 0,
    columns_renamed: 0,
    columns_missing: 0,
    relationships_new: 0,
    changes_raised: 0,
    changes_high: 0,
  });
  const first = record(importId(), T0);
  const second = record(changes.importId, LATER);
  const group = importId();
  const events = [
    changeEvent({ change_group_id: group, object_type: "source_import", object_id: second.id, operation: "create", occurred_at: LATER }),
    ...plan.mappings
      .filter((m) => m.sendsBack)
      .map((m) =>
        changeEvent({
          change_group_id: group,
          object_type: "mapping",
          object_id: m.mappingId,
          operation: "update",
          occurred_at: LATER,
          before_image: { status: "approved" },
          after_image: { status: "review", review_reason: m.reasons.join("; ") },
        }),
      ),
  ];
  // the system existed before its first import (the seed's CRM): the first import adds no new tables then
  const systems = model.systems.map((s) => ({ ...s, created_at: "2026-09-01T00:00:00.000Z" }));
  return { base, plan, model: { ...model, systems }, imports: [first, second], events, second };
}

const rowsFor = (s: ReturnType<typeof sevenA>) => ({
  systems: s.model.systems,
  tables: s.model.tables,
  columns: s.model.columns,
  imports: s.imports,
  mappings: s.model.mappings,
  mappingInputs: s.model.mappingInputs,
  attributes: s.model.attributes,
  entities: s.model.entities,
  events: s.events,
});

describe("the derivation of slice 7a's changes (P2, Q1, Q3, S7B-12)", () => {
  it("raises what the import would have raised, named by its import, dated and signed as it, marked as derived", () => {
    const s = sevenA();
    const derived = deriveSourceChanges(rowsFor(s), importId);
    // the same changes the engine raises for this import (the business key change is the mapping's)
    const fromPlan = s.plan.raises.map((r) => `${r.kind}:${r.objectLabel}`).sort();
    expect(derived.map((c) => `${c.kind}:${c.object_label}`).sort()).toEqual(fromPlan);
    for (const c of derived) {
      expect(c).toMatchObject({ source_import_id: s.second.id, created_at: LATER, created_by: IMPORTER, status: "open" });
      expect(c.detail.endsWith(" Raised when slice 7b was installed.")).toBe(true);
    }
    expect(derived.find((c) => c.kind === "type_conflict")!.detail).toBe(
      "The approved mapping to Customer.email went back to review: type conflict, varchar(255) into string(120). Raised when slice 7b was installed.",
    );
    expect(derived.find((c) => c.kind === "column_left" && c.object_label.endsWith("segment"))!.severity).toBe("high");
  });

  it("leaves out new columns and tables that have a mapping by now (Q3), and a column that left with its table", () => {
    const s = sevenA();
    const phone = s.model.columns.find((c) => c.name === "phone")!;
    const label = s.model.attributes.find((a) => a.name === "label")!;
    const mapped = { ...s, model: { ...s.model, mappingInputs: [...s.model.mappingInputs, { ...s.model.mappingInputs[0]!, id: importId(), source_column_id: phone.id, mapping_id: s.base.mappings.label }] } };
    expect(label).toBeTruthy();
    const labels = deriveSourceChanges(rowsFor(mapped), importId).map((c) => c.object_label);
    expect(labels).not.toContain("dbo.customers.phone");
    expect(labels).toContain("dbo.orders");
    expect(labels).not.toContain("dbo.orders.cust_id");
  });

  it("derives nothing from a file without imports, and reads the kind from a reason's words", () => {
    const s = sevenA();
    expect(deriveSourceChanges({ ...rowsFor(s), imports: [] }, importId)).toEqual([]);
    expect(kindOfReason("its rule now reads CONCAT(a; b); business key column changed type, int → bigint")).toBe("business_key_changed");
    expect(kindOfReason("its rule now reads x")).toBe("rule_updated");
    expect(kindOfReason("type conflict, varchar(9) into string(3); its rule now reads y")).toBe("type_conflict");
    expect(kindOfReason("something else")).toBeNull();
  });
});
