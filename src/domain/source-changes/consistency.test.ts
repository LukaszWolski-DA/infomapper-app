import { describe, expect, it } from "vitest";
import { ids, requirement, requirementLink } from "../__fixtures__/domain";
import { attributeNamed, columnNamed, tableNamed } from "../__fixtures__/import";
import { ACTOR, applyEdits, crmAfterReimport, rowsOf } from "../__fixtures__/source-changes";
import type { ImportModel } from "../import/model";
import { buildRequirementIndex } from "../model/requirement-index";
import type { CanvasItem, Requirement, RequirementLink } from "../types";
import { retire } from "./actions";
import { CONSISTENCY_TEXT, modelConsistency, type ConsistencyModel, type ConsistencyRequirement } from "./consistency";
import { touchedBy } from "./touched";

const NOW = "2026-10-06T10:00:00.000Z";
const entityNamed = (m: ImportModel, name: string) => m.entities.find((e) => e.name === name)!;
const C1 = "00000000-0000-7000-8000-0000000000c1", C2 = "00000000-0000-7000-8000-0000000000c2";

const asModel = (m: ImportModel): ConsistencyModel =>
  ({ entities: m.entities, attributes: m.attributes, mappings: m.mappings, mappingInputs: m.mappingInputs, sourceTables: m.tables, sourceColumns: m.columns, sourceSystems: m.systems }) as unknown as ConsistencyModel;

const card = (canvasId: string, target: { entity_id?: string; source_table_id?: string }): CanvasItem =>
  ({ id: `${canvasId}:${target.entity_id ?? target.source_table_id}`, canvas_id: canvasId, entity_id: target.entity_id ?? null, source_table_id: target.source_table_id ?? null, requirement_id: null, deleted_at: null }) as CanvasItem;

function run(m: ImportModel, items: CanvasItem[], reqs: { requirements: Requirement[]; links: RequirementLink[] } = { requirements: [], links: [] }) {
  const model = asModel(m);
  const index = buildRequirementIndex(reqs.requirements, reqs.links, model as never);
  const project: ConsistencyRequirement[] = index.requirements.map((r) => {
    const c = index.coverage(r.id);
    return { id: r.id, key: r.key, name: r.name, covered: c.covered.length, total: c.total, bestCanvasId: C1 };
  });
  return modelConsistency(model, items, [C1, C2], index, project, m.changes ?? []);
}

const names = (c: ReturnType<typeof run>, group: string) => c.groups.find((g) => g.id === group)?.lines.map((l) => l.name) ?? [];

describe("model consistency (item 25, S7B-13)", () => {
  it("each group with its severity and hint, after a re-import", () => {
    const s = crmAfterReimport();
    const customer = entityNamed(s.model, "Customer").id;
    const c = run(s.model, [card(C1, { entity_id: customer })]);
    const gone = c.groups.find((g) => g.id === "gone")!;
    expect(gone).toMatchObject({ title: CONSISTENCY_TEXT.gone, severity: "high", hint: CONSISTENCY_TEXT.goneHint });
    expect(names(c, "gone")).toEqual(["customers.segment → Customer.segment_code", "customers.segment, customers.email → Customer.label", "customers.created_ts → Customer.created_at"]);
    expect(gone.lines[0]!.meta).toBe("Approved, missing since 2026-10-05");
    expect(c.groups.find((g) => g.id === "no_source")).toMatchObject({ severity: "normal", hint: CONSISTENCY_TEXT.noSourceHint });
    expect(names(c, "no_source")).toEqual(["Customer.segment_code", "Customer.label", "Customer.created_at"]);
    expect(c.groups.find((g) => g.id === "no_source")!.lines.map((l) => l.meta)).toEqual([CONSISTENCY_TEXT.columnsLeft, CONSISTENCY_TEXT.columnsLeft, CONSISTENCY_TEXT.columnsLeft]);
    const conflicts = c.groups.find((g) => g.id === "conflicts")!;
    expect(conflicts.lines.find((l) => l.name === "customers.email → Customer.email")?.meta).toBe("In review: varchar(255) into string(120)");
    expect(names(c, "review")).toEqual(["customers.cust_no → Customer.customer_number", "customers.email → Customer.email"]);
    // the system's open changes, workspace-wide, opening its panel
    expect(c.systems).toEqual([{ open: { t: "system", id: s.systemId }, canvasId: C1, name: "CRM", meta: CONSISTENCY_TEXT.toDecide((s.model.changes ?? []).filter((x) => x.status === "open").length) }]);
    expect(c.count).toBe(c.groups.reduce((n, g) => n + g.lines.length, 0) + (s.model.changes ?? []).filter((x) => x.status === "open").length);
  });

  it("scoped to the project: nothing when neither end has a card on its canvases; systems stay", () => {
    const s = crmAfterReimport();
    const c = run(s.model, [card("00000000-0000-7000-8000-0000000000ff", { entity_id: entityNamed(s.model, "Customer").id })]);
    expect(c.groups).toEqual([]);
    expect(c.systems).toHaveLength(1);
  });

  it("each line opens on the first canvas with both ends, else one end, else the first", () => {
    const s = crmAfterReimport();
    const customer = entityNamed(s.model, "Customer").id, customers = tableNamed(s.model, "customers").id;
    const c = run(s.model, [card(C1, { entity_id: customer }), card(C2, { entity_id: customer }), card(C2, { source_table_id: customers })]);
    expect(c.groups.find((g) => g.id === "review")!.lines[0]).toMatchObject({ open: { t: "map" }, canvasId: C2 });
    expect(c.groups.find((g) => g.id === "no_source")!.lines[0]).toMatchObject({ open: { t: "row", id: attributeNamed(s.model, "segment_code").id }, canvasId: C1 });
    expect(c.systems[0]!.canvasId).toBe(C2);
  });

  it("live after an action: a retired column's mappings leave “left the source” and become a historical source", () => {
    const s = crmAfterReimport();
    const change = s.model.changes!.find((x) => x.object_label === "dbo.customers.segment")!;
    const r = retire({ actorId: ACTOR, now: NOW, newId: () => ids.actor }, rowsOf(s.model), change.id);
    if (!r.ok) throw new Error(r.error.message);
    const after = applyEdits(s.model, r.edits);
    const c = run(after, [card(C1, { entity_id: entityNamed(after, "Customer").id })]);
    // retired is decided: neither the historical direct mapping nor the combined one (its other input is present) is listed
    expect(names(c, "gone")).toEqual(["customers.created_ts → Customer.created_at"]);
    const noSource = c.groups.find((g) => g.id === "no_source")!.lines;
    expect(noSource.find((l) => l.name === "Customer.segment_code")?.meta).toBe(CONSISTENCY_TEXT.historicalOnly);
  });

  it("affected requirements, and a no-source group high when one of them scopes it", () => {
    const s = crmAfterReimport();
    const segment = attributeNamed(s.model, "segment_code").id;
    const r = requirement(ids.req101, { key: "REQ-1", name: "Segments" });
    const c = run(s.model, [card(C1, { entity_id: entityNamed(s.model, "Customer").id })], { requirements: [r], links: [requirementLink(ids.reqLink1, { requirement_id: r.id, attribute_id: segment })] });
    expect(c.requirements.map((x) => x.key)).toEqual(["REQ-1"]);
    expect(c.groups.find((g) => g.id === "no_source")!.severity).toBe("high");
  });

  it("all well: nothing listed and a zero count", () => {
    const s = crmAfterReimport();
    const c = run({ ...s.model, changes: [] }, []);
    expect(c).toEqual({ groups: [], requirements: [], systems: [], count: 0 });
  });
});

describe("what source changes touch (items 26–27, S7B-14)", () => {
  it("all open changes: their objects, the columns that left and not retired, mappings in review, with their ends", () => {
    const s = crmAfterReimport();
    const t = touchedBy(asModel(s.model) as never, s.model.changes ?? [], "open");
    const customers = tableNamed(s.model, "customers").id, payments = tableNamed(s.model, "payments").id;
    expect(t.lit.tables.has(customers) && t.lit.tables.has(payments)).toBe(true);
    expect(t.lit.entities).toEqual(new Set([entityNamed(s.model, "Customer").id]));
    // every mapping reads a touched column
    expect(t.mappings).toBe(s.model.mappings.length);
    expect(t.attributes).toBe(5);
    expect(t.lit.rows.size).toBe(0);
  });

  it("one import: its changes, open or resolved; another import's selection lights nothing", () => {
    const s = crmAfterReimport();
    const importId = s.model.changes![0]!.source_import_id;
    const one = touchedBy(asModel(s.model) as never, s.model.changes ?? [], importId);
    expect(one.tables).toBeGreaterThan(0);
    const resolved = (s.model.changes ?? []).map((c) => ({ ...c, status: "resolved" as const }));
    expect(touchedBy(asModel(s.model) as never, resolved, importId).tables).toBe(one.tables);
    expect(touchedBy(asModel(s.model) as never, s.model.changes ?? [], "00000000-0000-7000-8000-000000000999")).toMatchObject({ tables: 0, mappings: 0, attributes: 0 });
  });

  it("a retired column is no longer touched by “All open changes” once its change is resolved", () => {
    const s = crmAfterReimport();
    const segment = columnNamed(s.model, "customers", "segment");
    const only = (s.model.changes ?? []).filter((c) => c.source_column_id === segment.id);
    const model = { ...s.model, columns: s.model.columns.map((c) => (c.missing_since ? { ...c, retired_since: NOW } : c)) };
    const t = touchedBy(asModel(model) as never, only.map((c) => ({ ...c, status: "resolved" as const })), "open");
    // mappings sent back to review with a reason still count
    expect(t.mappings).toBe(2);
  });
});
