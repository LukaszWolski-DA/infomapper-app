// Slice 35 (B2.3, B4.2, B4.6; step 1's Q2, Q5, F19): a baseline's content and the comparison of two states, on the demo
// ("Retail Co – DWH" with the star, the documents and the demo's "Stage 1 sign-off").

import { describe, expect, it } from "vitest";
import { BASELINE_MODULE_TABLES } from "@/compose/tables";
import { baselineContentOfRows } from "@/compose/baselines";
import { addSeedDemoData, DEMO_BASELINE } from "@/compose/seed";
import type { DevDb } from "@/data/local/schema";
import { buildSeed, SEED_IDS } from "@/data/local/seed";
import { compareBaselines, filterChanges, olderFirst, type BaselineChange } from "@/domain/baseline/compare";
import { baselineSummary, CONTENT_TABLES, type BaselineContent, type BaselineInsert } from "@/domain/baseline/content";
import { COMPARE_WORDS, fieldText, valueText, whatChanged } from "@/domain/baseline/words";

const W = COMPARE_WORDS.en;

function demo(): { db: DevDb; now: BaselineContent; stage1: BaselineContent } {
  const db = buildSeed();
  addSeedDemoData(db);
  const now = baselineContentOfRows(db, SEED_IDS.wsRetailDwh)!;
  const stage1 = (db.baseline.find((b) => b.id === DEMO_BASELINE.id) as BaselineInsert).snapshot;
  return { db, now, stage1 };
}
type Mutable = { -readonly [K in keyof BaselineContent]: BaselineContent[K] extends readonly (infer R)[] ? R[] : BaselineContent[K] };
const mutable = (c: BaselineContent): Mutable => structuredClone(c) as unknown as Mutable;
const line = (c: BaselineChange) => `${c.change} ${W.kinds[c.kind]} ${c.label}${c.fields.length ? `: ${whatChanged(c, W)}` : ""}`;

describe("a baseline's content (the design of 11 November 2026)", () => {
  it("holds the model, sources, classifications, stereotypes, mappings, requirements, projects, canvases, frames, InfoCube's rows and four settings", () => {
    const { now } = demo();
    expect(Object.keys(now).sort()).toEqual(["canvasItems", "canvases", "frames", "model", "modules", "projectCanvases", "projects", "requirementLinks", "requirements", "settings"]);
    expect(Object.keys(now.settings).sort()).toEqual(["dv2_mode", "four_eyes", "infocube", "naming_conventions"]);
    expect(Object.keys(now.modules).sort()).toEqual([...BASELINE_MODULE_TABLES].sort());
    expect(Object.keys(now.modules)).not.toContain("document_definition");
    expect(now.modules.cube_entity!.length).toBeGreaterThan(0);
    for (const field of Object.keys(CONTENT_TABLES.model)) expect(now.model, field).toHaveProperty(field);
    expect(now.model).toHaveProperty("lostOriginals");
  });

  it("leaves out labels, notes, change events, people, members and access", () => {
    const { now } = demo();
    const text = JSON.stringify(now);
    for (const left of ["labels", "labelLinks", "notes", "members", "people", "organization", "workspace", "change_event", "access_hash", "auth_user_id", "email"]) {
      expect(Object.keys(now), left).not.toContain(left);
    }
    expect(text).not.toContain("@");
  });

  it("holds the live rows only, both ends live for links; the deleted originals that live copies point to as id, name, entity", () => {
    const { db } = demo();
    const attr = db.attribute.find((a) => a.workspace_id === SEED_IDS.wsRetailDwh && a.copied_from_attribute_id && a.deleted_at === null)!;
    const original = db.attribute.find((a) => a.id === attr.copied_from_attribute_id)!;
    original.deleted_at = "2026-11-24T10:00:00.000Z";
    const entity = db.entity.find((e) => e.workspace_id === SEED_IDS.wsRetailDwh && e.deleted_at === null && e.name === "Product")!;
    entity.deleted_at = "2026-11-24T10:00:00.000Z";
    const c = baselineContentOfRows(db, SEED_IDS.wsRetailDwh)!;
    expect(c.model.attributes.some((a) => a.id === original.id)).toBe(false);
    expect(c.model.lostOriginals).toContainEqual({ id: original.id, name: original.name, entityName: expect.any(String) });
    expect(c.model.entities.some((e) => e.id === entity.id)).toBe(false);
    expect(c.requirementLinks.some((k) => k.entity_id === entity.id)).toBe(false);
  });

  it("counts logical entities, mappings and requirements, as the Overview (Łukasz's answer 2)", () => {
    const { now, stage1 } = demo();
    expect(baselineSummary(now)).toEqual({
      entity_count: now.model.entities.filter((e) => e.model_level === "logical").length,
      mapping_count: now.model.mappings.length,
      requirement_count: now.requirements.length,
    });
    expect(baselineSummary(stage1).requirement_count).toBe(baselineSummary(now).requirement_count - 1);
  });
});

describe("comparing (B4.2, B4.6)", () => {
  it("finds nothing between a state and itself, also after the content's round trip through JSON (F19)", () => {
    const { now } = demo();
    expect(compareBaselines(now, JSON.parse(JSON.stringify(now)) as BaselineContent)).toEqual([]);
  });

  it("shows the demo's Stage 1 sign-off against Now (S35-04)", () => {
    const { now, stage1 } = demo();
    expect(compareBaselines(stage1, now).map(line)).toEqual([
      "added Attribute Customer.segment_code",
      "changed Mapping customers.cust_no → Customer.customer_number: status: Draft → Approved",
      "added Requirement REQ-105 Personal data is encrypted at rest",
      "changed Source column CRM · customers.cust_no: type: varchar(10) → varchar(20)",
    ]);
    // the other way round: the same items, added becoming removed
    expect(compareBaselines(now, stage1).map((c) => c.change)).toEqual(["removed", "changed", "removed", "changed"]);
  });

  it("covers every kind: added, changed and removed; short values old → new, long texts (changed); ids by name in their own state", () => {
    const { now } = demo();
    const after = mutable(now);
    const m = after.model as unknown as { [K in keyof BaselineContent["model"]]: BaselineContent["model"][K] extends readonly (infer R)[] ? R[] : never };
    const customer = m.entities.find((e) => e.name === "Customer" && e.model_level === "logical")!;
    customer.name = "Client";
    customer.definition_html = "<p>Someone who buys.</p>";
    const otherConcept = m.concepts.find((x) => x.id !== customer.concept_id)!;
    customer.concept_id = otherConcept.id;
    const email = m.attributes.find((a) => a.entity_id === customer.id && a.name === "email")!;
    Object.assign(email, { is_primary_key: true, is_nullable: !email.is_nullable, type_length: 200, data_type: "string" });
    const mapping = m.mappings.find((x) => x.status === "approved")!;
    mapping.status = "review";
    mapping.rule_expression = "UPPER(x)";
    const rel = m.relationships[0]!;
    rel.to_role = "buyer";
    rel.description = "Changed.";
    after.requirements = after.requirements.slice(1);
    const table = m.sourceTables.find((t) => t.name === "customers")!;
    table.schema_name = "crm";
    table.comment = "From CRM.";
    const column = m.sourceColumns.find((c) => c.source_table_id === table.id && c.name === "fname")!;
    column.is_nullable = !column.is_nullable;
    const bk = m.classifications.find((x) => x.code === "BK" && x.deleted_at === null)!;
    m.classificationLinks.push({ ...m.classificationLinks[0]!, id: "01a0f9e9-2035-7000-8000-00000000c001", classification_id: bk.id, source_table_id: null, source_column_id: column.id });
    m.entities.push({ ...customer, id: "01a0f9e9-2035-7000-8000-00000000e001", name: "Invoice" });
    const lost = m.sourceColumns.findIndex((c) => c.name === "lname");
    m.sourceColumns.splice(lost, 1);

    const changes = compareBaselines(now, after as unknown as BaselineContent);
    const shown = changes.map(line);
    expect(shown).toContain("added Entity Invoice");
    expect(shown).toContain(`changed Entity Client: name: Customer → Client, concept: ${now.model.concepts.find((x) => x.id === now.model.entities.find((e) => e.id === customer.id)!.concept_id)!.name} → ${otherConcept.name}, definition (changed)`);
    expect(shown.find((s) => s.startsWith("changed Attribute Client.email"))).toBe(
      `changed Attribute Client.email: type: ${valueText(`string(${now.model.attributes.find((a) => a.id === email.id)!.type_length})`, W)} → string(200), PK: no → yes, nullable: ${email.is_nullable ? "no → yes" : "yes → no"}`,
    );
    expect(shown.find((s) => s.startsWith("changed Mapping") && s.includes("status: Approved → In review"))).toContain("rule (changed)");
    expect(shown.some((s) => s.startsWith("changed Relationship") && s.endsWith("role at the right end: – → buyer, description (changed)"))).toBe(true);
    expect(shown.filter((s) => s.startsWith("removed Requirement"))).toHaveLength(1);
    expect(shown).toContain("changed Source table CRM · customers: schema: dbo → crm, comment (changed)");
    expect(shown.find((s) => s.startsWith("changed Source column CRM · customers.fname"))).toMatch(/nullable: (yes → no|no → yes), classifications: Personal data → Business key, Personal data$/);
    expect(shown).toContain("removed Source column CRM · customers.lname");
    // an attribute's label follows its entity's new name; the kinds come in their order
    const kinds = changes.map((c) => c.kind);
    expect(kinds).toEqual([...kinds].sort((a, b) => ["entity", "attribute", "mapping", "relationship", "requirement", "source_table", "source_column"].indexOf(a) - ["entity", "attribute", "mapping", "relationship", "requirement", "source_table", "source_column"].indexOf(b)));
  });

  it("writes values: yes and no, – for empty, lists joined, closed lists by their labels", () => {
    expect(valueText(true, W)).toBe("yes");
    expect(valueText(false, W)).toBe("no");
    expect(valueText(null, W)).toBe("–");
    expect(valueText("", W)).toBe("–");
    expect(valueText([], W)).toBe("–");
    expect(valueText(["A", "B"], W)).toBe("A, B");
    expect(valueText({ list: "requirement_priority", code: "wont" }, W)).toBe("Won't");
    expect(fieldText({ field: "pk", before: false, after: true }, W)).toBe("PK: no → yes");
    expect(fieldText({ field: "expression", long: true }, W)).toBe("expression (changed)");
  });

  it("filters by the item's label in any letter case and by kind (S35-04 as changed)", () => {
    const { now, stage1 } = demo();
    const all = compareBaselines(stage1, now);
    expect(filterChanges(all, "CUST").map((c) => c.label)).toEqual(["Customer.segment_code", "customers.cust_no → Customer.customer_number", "CRM · customers.cust_no"]);
    expect(filterChanges(all, "", "requirement").map((c) => c.kind)).toEqual(["requirement"]);
    expect(filterChanges(all, "nothing like this")).toEqual([]);
  });

  it("puts the older state first, whichever row it was asked from; Now is always the newer", () => {
    const a = { created_at: "2026-09-15T08:12:00.000Z", n: "a" }, b = { created_at: "2026-11-24T10:00:00.000Z", n: "b" };
    expect(olderFirst(b, a)).toEqual([a, b]);
    expect(olderFirst(a, b)).toEqual([a, b]);
    expect(olderFirst(a, null)).toEqual([a, null]);
    expect(olderFirst(null, b)).toEqual([b, null]);
  });
});

// Step 5 (Łukasz's acceptance): a reference is compared by its id and shown by name; a rename is one change, on the
// renamed row, never on the rows that point to it.
describe("references compared by id, shown by name (step 5)", () => {
  type Model = { [K in keyof BaselineContent["model"]]: BaselineContent["model"][K] extends readonly (infer R)[] ? R[] : never };
  function edited(edit: (m: Model, c: Mutable) => void): { now: BaselineContent; changes: BaselineChange[] } {
    const { now } = demo();
    const after = mutable(now);
    edit(after.model as unknown as Model, after);
    return { now, changes: compareBaselines(now, after as unknown as BaselineContent) };
  }
  const only = (changes: BaselineChange[]) => {
    expect(changes).toHaveLength(1);
    return changes[0]!;
  };

  it("an entity renamed: one change, its name; its attributes, mappings and relationships unchanged", () => {
    const c = only(edited((m) => { m.entities.find((e) => e.name === "Customer" && e.model_level === "logical")!.name = "Client"; }).changes);
    expect(line(c)).toBe("changed Entity Client: name: Customer → Client");
  });
  it("an attribute renamed: one change; the mappings to it unchanged", () => {
    const c = only(edited((m) => { const e = m.entities.find((x) => x.name === "Customer" && x.model_level === "logical")!; m.attributes.find((a) => a.entity_id === e.id && a.name === "birth_date")!.name = "date_of_birth"; }).changes);
    expect(line(c)).toBe("changed Attribute Customer.date_of_birth: name: birth_date → date_of_birth");
  });
  it("a source table renamed: one change; its columns and the mappings reading them unchanged", () => {
    const c = only(edited((m) => { m.sourceTables.find((t) => t.name === "customers")!.name = "clients"; }).changes);
    expect(line(c)).toBe("changed Source table CRM · clients: name: customers → clients");
  });
  it("a source column renamed: one change; the mappings reading it unchanged", () => {
    const c = only(edited((m) => { m.sourceColumns.find((x) => x.name === "dob")!.name = "birth_dt"; }).changes);
    expect(line(c)).toBe("changed Source column CRM · customers.birth_dt: name: dob → birth_dt");
  });
  it("a concept renamed: no entity changes (concepts are not compared as items)", () => {
    expect(edited((m) => { const e = m.entities.find((x) => x.name === "Customer" && x.model_level === "logical")!; m.concepts.find((x) => x.id === e.concept_id)!.name = "Party"; }).changes).toEqual([]);
  });
  it("a stereotype renamed: no entity changes", () => {
    const { now } = demo();
    const used = now.model.entities.find((e) => e.stereotype !== null)!.stereotype!;
    const { changes } = edited((m) => { m.stereotypes.find((x) => x.code === used)!.name = "Renamed stereotype"; });
    expect(changes).toEqual([]);
  });
  it("a classification renamed: no table or column changes", () => {
    expect(edited((m) => { m.classifications.find((x) => x.code === "PII")!.name = "Sensitive"; }).changes).toEqual([]);
  });

  it("a mapping pointed at another attribute: its target old → new by name", () => {
    const { changes } = edited((m) => {
      const e = m.entities.find((x) => x.name === "Customer" && x.model_level === "logical")!;
      const birth = m.attributes.find((a) => a.entity_id === e.id && a.name === "birth_date")!;
      const email = m.attributes.find((a) => a.entity_id === e.id && a.name === "email")!;
      m.mappings.find((x) => x.attribute_id === birth.id)!.attribute_id = email.id;
    });
    expect(line(only(changes))).toBe("changed Mapping customers.dob → Customer.email: target attribute: Customer.birth_date → Customer.email");
  });
  it("a column's classifications changed: old → new by name", () => {
    const { changes } = edited((m) => {
      const col = m.sourceColumns.find((x) => x.name === "dob")!;
      const bk = m.classifications.find((x) => x.code === "BK" && x.deleted_at === null)!;
      m.classificationLinks.push({ ...m.classificationLinks[0]!, id: "01a0f9e9-2035-7000-8000-00000000c002", classification_id: bk.id, source_table_id: null, source_column_id: col.id });
    });
    expect(line(only(changes))).toBe("changed Source column CRM · customers.dob: classifications: Personal data → Business key, Personal data");
  });

  it("Łukasz's case: Customer renamed and customers.dob → Customer.birth_date approved: exactly two changes", () => {
    const { changes } = edited((m) => {
      const e = m.entities.find((x) => x.name === "Customer" && x.model_level === "logical")!;
      e.name = "Client";
      const birth = m.attributes.find((a) => a.entity_id === e.id && a.name === "birth_date")!;
      m.mappings.find((x) => x.attribute_id === birth.id)!.status = "approved";
    });
    expect(changes.map(line)).toEqual([
      "changed Entity Client: name: Customer → Client",
      "changed Mapping customers.dob → Client.birth_date: status: In review → Approved",
    ]);
  });
});
