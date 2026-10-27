import { describe, expect, it } from "vitest";
import type { CommandContext, CommandResult, Write } from "../changes";
import { access } from "../__fixtures__/domain";
import { allOf, attributeNamed, classify, columnNamed, importId, importInto, tableNamed } from "../__fixtures__/import";
import { ACTOR, applyEdits, CHANGED, crmAfterReimport, crmWithMappings } from "../__fixtures__/source-changes";
import { removeClassification, setClassification } from "../commands/classification";
import { deleteAttribute } from "../commands/attribute";
import { deleteEntity } from "../commands/entity";
import { createMapping, deleteMapping, mergeMappings, removeMappingInput, setMappingStatus } from "../commands/mapping";
import { deleteSourceTable } from "../commands/source";
import type { ImportModel } from "../import/model";
import type { SourceChange } from "../types";
import { settleAfterWrites, settleByStatus, settleDeletedMappings, settleMappedColumn, settleMergedMappings, settleRemovedInput } from "./settle";

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

describe("settled by any command's writes (settleAfterWrites, Q12)", () => {
  const modeler = access("modeler");
  const writesOf = (r: CommandResult<unknown>): Write[] => {
    if (!r.ok) throw new Error(r.error.message);
    return r.writeSet.writes;
  };
  const names = (m: ImportModel) => ({ entities: m.entities, attributes: m.attributes, mappings: m.mappings, sourceColumns: m.columns });
  /** The settlements of the writes, as label → resolution. */
  const settledBy = (m: ImportModel, writes: Write[]) =>
    Object.fromEntries(settleAfterWrites(ctx, writes, m.changes!, names(m)).map((e) => [(e as { row: SourceChange }).row.object_label, (e as { row: SourceChange }).row.resolution]));
  const live = <R extends { deleted_at: string | null }>(rows: readonly R[]) => rows.filter((r) => r.deleted_at === null);

  it("a status set in the mapping panel", () => {
    const s = crmAfterReimport();
    const m = s.model.mappings.find((x) => x.id === s.mappings.custNo)!;
    const writes = writesOf(setMappingStatus(ctx, modeler, { mapping: m, contentAuthorId: "someone" }, { mappingId: m.id, expectedVersion: m.version, status: "approved" }));
    expect(settledBy(s.model, writes)).toEqual({ "dbo.customers.cust_no": "Settled: the mapping was approved in its panel" });
    const draft = writesOf(setMappingStatus(ctx, modeler, { mapping: m, contentAuthorId: "someone" }, { mappingId: m.id, expectedVersion: m.version, status: "draft" }));
    expect(settledBy(s.model, draft)).toEqual({ "dbo.customers.cust_no": "Settled: the mapping's status was set to Draft in its panel" });
  });

  it("a mapping deleted by itself, with its attribute, with its entity", () => {
    const s = crmAfterReimport();
    const m = s.model.mappings.find((x) => x.id === s.mappings.email)!;
    const inputs = s.model.mappingInputs.filter((i) => i.mapping_id === m.id);
    expect(settledBy(s.model, writesOf(deleteMapping(ctx, modeler, { mapping: m, inputs }, { mappingId: m.id, expectedVersion: m.version })))).toEqual({
      "dbo.customers.email": "Settled: the mapping was deleted",
    });
    const a = attributeNamed(s.model, "email");
    expect(settledBy(s.model, writesOf(deleteAttribute(ctx, modeler, { attribute: a, mappings: s.model.mappings, mappingInputs: s.model.mappingInputs }, { attributeId: a.id, expectedVersion: a.version })))).toEqual({
      "dbo.customers.email": "Settled: the attribute was deleted",
    });
    const e = s.model.entities[0]!;
    const all = settledBy(s.model, writesOf(deleteEntity(ctx, modeler, { entity: e, attributes: s.model.attributes, mappings: s.model.mappings, mappingInputs: s.model.mappingInputs, relationships: [], canvasItems: [] }, { entityId: e.id, expectedVersion: e.version })));
    expect(all).toEqual({ "dbo.customers.cust_no": "Settled: the entity was deleted", "dbo.customers.email": "Settled: the entity was deleted" });
  });

  it("merged into another mapping", () => {
    const s = crmAfterReimport();
    // a second mapping of Customer.email, from phone, to merge the sent-back one into
    const r = createMapping(ctx, modeler, { attribute: attributeNamed(s.model, "email"), column: columnNamed(s.model, "customers", "phone"), mappings: s.model.mappings, mappingInputs: s.model.mappingInputs }, { attributeId: attributeNamed(s.model, "email").id, sourceColumnId: columnNamed(s.model, "customers", "phone").id });
    const model = applyEdits(s.model, writesOf(r));
    const other = live(model.mappings).find((m) => m.attribute_id === attributeNamed(s.model, "email").id && m.id !== s.mappings.email)!;
    const sent = model.mappings.find((m) => m.id === s.mappings.email)!;
    const writes = writesOf(
      mergeMappings(ctx, modeler, { mappings: [other, sent], inputs: model.mappingInputs }, { mappings: [{ mappingId: other.id, expectedVersion: other.version }, { mappingId: sent.id, expectedVersion: sent.version }], ruleExpression: "COALESCE(phone, email)" }),
    );
    expect(settledBy(model, writes)["dbo.customers.email"]).toBe("Settled: the mapping was merged into another");
  });

  it("an input removed: its change settles, and the status the removal changes is not a panel's", () => {
    const s = crmAfterReimport();
    const label = s.model.mappings.find((m) => m.id === s.mappings.label)!;
    const email = columnNamed(s.model, "customers", "email");
    const own: SourceChange = { ...s.model.changes!.find((c) => c.kind === "type_conflict")!, id: importId(), mapping_id: label.id, source_column_id: email.id, object_label: "label's email" };
    const model = { ...s.model, changes: [...s.model.changes!, own] };
    const input = model.mappingInputs.find((i) => i.mapping_id === label.id && i.source_column_id === email.id)!;
    const writes = writesOf(removeMappingInput(ctx, modeler, { mapping: label, inputs: model.mappingInputs }, { mappingId: label.id, expectedVersion: label.version, mappingInputId: input.id }));
    expect(settledBy(model, writes)).toEqual({ "label's email": "Settled: email no longer feeds the mapping" });
  });

  it("a new column mapped by another path (a drag, the attribute panel)", () => {
    const s = crmAfterReimport();
    const a = attributeNamed(s.model, "created_at");
    const c = columnNamed(s.model, "customers", "created_on");
    const writes = writesOf(createMapping(ctx, modeler, { attribute: a, column: c, mappings: s.model.mappings, mappingInputs: s.model.mappingInputs }, { attributeId: a.id, sourceColumnId: c.id }));
    expect(settledBy(s.model, writes)).toEqual({ "dbo.customers.created_on": "Settled: mapped to Customer.created_at (draft)" });
  });

  it("a source table deleted from its panel", () => {
    const s = crmAfterReimport();
    const payments = s.model.tables.find((t) => t.name === "payments")!;
    const writes = writesOf(
      deleteSourceTable(ctx, modeler, { table: payments, columns: s.model.columns, canvasItems: [], mappings: s.model.mappings, mappingInputs: s.model.mappingInputs, attributes: s.model.attributes, entities: s.model.entities }, { sourceTableId: payments.id, expectedVersion: payments.version }),
    );
    expect(settledBy(s.model, writes)).toEqual({ "dbo.payments": "Settled: the table was deleted" });
  });

  it("nothing for an import's own writes (it settles by the source, P7)", () => {
    const s = crmAfterReimport();
    expect(settleAfterWrites(ctx, [{ kind: "insert", table: "source_import", row: {} as never }], s.model.changes!, names(s.model))).toEqual([]);
  });
});

describe("columns that lose Business key (slice 7c, Q7)", () => {
  const modeler = access("modeler");
  /** CRM after the re-import with cust_no's mapping a draft: a business key change without a mapping stays open. */
  function withColumnChange() {
    const base = crmWithMappings();
    const model = { ...base.model, mappings: base.model.mappings.map((m) => (m.id === base.mappings.custNo ? { ...m, status: "draft" as const, approved_by: null, approved_at: null } : m)) };
    const after = importInto(model, CHANGED, { systemId: base.systemId }, allOf(CHANGED)).model;
    const change = after.changes!.find((c) => c.kind === "business_key_changed")!;
    expect(change).toMatchObject({ mapping_id: null, status: "open" });
    return { model: after, change, custNo: columnNamed(after, "customers", "cust_no") };
  }
  const settleNames = (m: ImportModel) => ({ entities: m.entities, attributes: m.attributes, mappings: m.mappings, sourceColumns: m.columns, classifications: m.classifications });
  const resolutions = (m: ImportModel, writes: Write[]) =>
    settleAfterWrites(ctx, writes, m.changes!, settleNames(m)).map((e) => [(e as { row: SourceChange }).row.kind, (e as { row: SourceChange }).row.mapping_id, (e as { row: SourceChange }).row.resolution]);
  const toggle = (m: ImportModel, columnId: string, code: string, on: boolean) => {
    const r = setClassification(ctx, modeler, { classifications: m.classifications!, links: m.classificationLinks!, tables: m.tables, columns: m.columns }, {
      classificationId: m.classifications!.find((c) => c.code === code)!.id,
      target: { kind: "source_column", id: columnId },
      on,
    });
    if (!r.ok) throw new Error(r.error.message);
    return r.writeSet.writes;
  };

  it("a toggle off settles the column's business key change without a mapping", () => {
    const { model, custNo } = withColumnChange();
    expect(resolutions(model, toggle(model, custNo.id, "BK", false))).toEqual([["business_key_changed", null, "Settled: cust_no is no longer a business key"]]);
  });

  it("removing Business key from the list settles it with the classification's name", () => {
    const { model } = withColumnChange();
    const bk = model.classifications!.find((c) => c.code === "BK")!;
    const r = removeClassification(ctx, modeler, { classifications: model.classifications!, links: model.classificationLinks! }, { classificationId: bk.id, expectedVersion: bk.version });
    if (!r.ok) throw new Error(r.error.message);
    expect(resolutions(model, r.writeSet.writes)).toEqual([["business_key_changed", null, "Settled: the classification Business key was removed"]]);
  });

  it("a mapping's business key change stays open; another classification settles nothing", () => {
    const s = crmAfterReimport();
    const custNo = columnNamed(s.model, "customers", "cust_no");
    expect(s.model.changes!.some((c) => c.kind === "business_key_changed" && c.mapping_id !== null && c.status === "open")).toBe(true);
    expect(resolutions(s.model, toggle(s.model, custNo.id, "BK", false))).toEqual([]);
    const { model, change } = withColumnChange();
    const linked = classify(model, change.source_column_id!, "PII");
    expect(resolutions(linked, toggle(linked, change.source_column_id!, "PII", false))).toEqual([]);
  });

  it("a deleted column settles by its deletion, and its classification links go with it (answer F18)", () => {
    const { model } = withColumnChange();
    const customers = tableNamed(model, "customers");
    const r = deleteSourceTable(
      ctx,
      modeler,
      { table: customers, columns: model.columns, canvasItems: [], mappings: model.mappings, mappingInputs: model.mappingInputs, attributes: model.attributes, entities: model.entities, classificationLinks: model.classificationLinks },
      { sourceTableId: customers.id, expectedVersion: customers.version },
    );
    if (!r.ok) throw new Error(r.error.message);
    const goneLinks = r.writeSet.writes.filter((w) => w.table === "classification_link");
    expect(goneLinks.length).toBe(model.classificationLinks!.filter((l) => model.columns.some((c) => c.id === l.source_column_id && c.source_table_id === customers.id)).length);
    expect(goneLinks.length).toBeGreaterThan(0);
    expect(resolutions(model, r.writeSet.writes).filter(([kind]) => kind === "business_key_changed")).toEqual([["business_key_changed", null, "Settled: the table was deleted"]]);
  });
});
