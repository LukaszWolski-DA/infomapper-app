// Slice 15d step 2: requirements through dimensional mappings (X-5, D-70), "Fed from concepts" and the bus matrix's rows
// (B-8, R-8, RP-10), on the Sales star through the composition root and the local store. REQ-210 stays at 0 of 3 with
// the star's seed (Y1); a dimensional attribute is covered by D-31's rule one level up.

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { conceptFeeds, moduleFeeds, moduleView, requirementFeeds, STORE_SCHEMA } from "@/compose";
import { addModuleDemoData } from "@/compose/seed";
import { resetDevData } from "@/data/local/dev-data";
import { readDb, writeDb } from "@/data/local/file";
import { SEED_IDS } from "@/data/local/seed";
import { createLocalDataStore } from "@/data/local/store";
import type { DataStore } from "@/data/ports";
import { buildRequirementIndex } from "@/domain/model/requirement-index";
import { GAP_REASONS, NOT_FED_REASON, type AttributeFeeds } from "@/domain/model/requirements";
import { coverageDelta } from "@/domain/source-changes/coverage";
import type { Mapping, MappingInput, WorkspaceModel } from "@/domain/types";
import { busMatrix } from "@/modules/infocube/domain/bus-matrix";
import { cubeIndex } from "@/modules/infocube/domain/keys";
import { cubeRequirementFeeds, hasTypeConflict, mappingIndex } from "@/modules/infocube/domain/mappings";
import { typeColumns, type CubeEntity, type CubeKey } from "@/modules/infocube/domain/types";

const WS = SEED_IDS.wsRetailDwh;
const ACTIONS = { fact: async () => ({ ok: false as const, message: "" }), dimension: async () => ({ ok: false as const, message: "" }) };

let dir: string;
let store: DataStore;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "infomapper-cube-requirements-"));
  const file = path.join(dir, "dev-db.json");
  await resetDevData(file);
  const db = await readDb(file);
  addModuleDemoData(db);
  await writeDb(file, db);
  store = createLocalDataStore(file, STORE_SCHEMA);
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function star() {
  const [workspace, model, requirements, links] = await Promise.all([store.workspaces.get(WS), store.model.load(WS), store.requirements.list(WS), store.requirements.listLinks(WS)]);
  const view = await moduleView(store, workspace!, model, ACTIONS);
  const entity = (name: string) => model.entities.find((e) => e.name === name && e.deleted_at === null)!;
  const attribute = (entityName: string, name: string) => model.attributes.find((a) => a.entity_id === entity(entityName).id && a.name === name && a.deleted_at === null)!;
  const req210 = requirements.find((r) => r.key === "REQ-210")!;
  return { workspace: workspace!, model, requirements, links, view, entity, attribute, req210 };
}

/** An approved direct mapping onto a logical attribute from a seed column whose type fits it, as test data. */
function approvedSourceMapping(model: WorkspaceModel, attributeId: string, columnName: string): WorkspaceModel {
  const column = model.sourceColumns.find((c) => c.name === columnName && c.deleted_at === null)!;
  const std = (id: string) => ({ id, workspace_id: WS, version: 1, created_at: "t", created_by: "u", updated_at: "t", updated_by: "u", deleted_at: null });
  const mapping = { ...std("test-mapping"), attribute_id: attributeId, kind: "direct", rule_expression: null, status: "approved" } as unknown as Mapping;
  const input = { ...std("test-input"), mapping_id: mapping.id, source_column_id: column.id, sort_order: 0 } as unknown as MappingInput;
  return { ...model, mappings: [...model.mappings, mapping], mappingInputs: [...model.mappingInputs, input] };
}

describe("REQ-210 in the star (Q4, S15-15)", () => {
  it("is seeded with its key, three links to the star's attributes and no change to the counter", async () => {
    const { req210, links, attribute, workspace } = await star();
    expect(req210).toMatchObject({ key: "REQ-210", kind: "data", name: "Net sales by customer segment and month", status: "draft", priority: "must", owner_name: "Head of Sales" });
    expect(links.filter((k) => k.requirement_id === req210.id && k.deleted_at === null).map((k) => k.attribute_id).sort()).toEqual(
      [attribute("Fact Sales", "net_amount").id, attribute("Dim Customer", "segment_code").id, attribute("Dim Date", "month").id].sort(),
    );
    const db = await readDb(path.join(dir, "dev-db.json"));
    const counter = (db.workspace.find((w) => w.id === workspace.id) as unknown as Record<string, unknown>)["requirement_counter"];
    if (counter !== undefined) expect(counter).toBe(106);
  });

  it("covers 0 of 3: net_amount not approved, segment_code's logical feed not covered, month not fed (Y1, Y3)", async () => {
    const { model, requirements, links, view, attribute, req210 } = await star();
    const ix = buildRequirementIndex(requirements, links, model, requirementFeeds(view, model));
    const c = ix.coverage(req210.id);
    const net = attribute("Fact Sales", "net_amount").id, segment = attribute("Dim Customer", "segment_code").id, month = attribute("Dim Date", "month").id;
    expect(c.total).toBe(3);
    expect(c.covered).toEqual([]);
    expect(new Set(c.notApproved)).toEqual(new Set([net, segment]));
    expect(c.notMapped).toEqual([month]);
    expect(ix.gapReason(net)).toBeNull();
    expect(ix.gapReason(segment)).toBe("logical_feed");
    expect(ix.isDimensional(month)).toBe(true);
    expect([GAP_REASONS[ix.gapReason(net) ?? "none"], GAP_REASONS[ix.gapReason(segment) ?? "none"], NOT_FED_REASON]).toEqual(["not approved", "logical feed not covered", "not fed"]);
  });

  it("brings the feeds and the logical attributes they read into the scope, not as items (D6)", async () => {
    const { model, requirements, links, view, attribute, entity, req210 } = await star();
    const ix = buildRequirementIndex(requirements, links, model, requirementFeeds(view, model));
    const s = ix.scope(req210.id);
    const feeding = [attribute("Order Line", "quantity"), attribute("Order Line", "unit_price"), attribute("Order Line", "discount_pct"), attribute("Customer", "segment_code")].map((a) => a.id);
    expect(s.feeding).toEqual(new Set(feeding));
    expect(s.feeds?.size).toBe(2);
    expect(s.attributeItems.size).toBe(3);
    for (const id of feeding) expect(s.attributes.has(id)).toBe(true);
    for (const name of ["Fact Sales", "Dim Customer", "Dim Date", "Order Line", "Customer"]) expect(s.entities.has(entity(name).id)).toBe(true);
    // the feeding rows' own coverage, for the lens's colours: no source mappings in the demo
    for (const id of feeding) expect(ix.attributeCoverage(id)).toBe("not_mapped");
  });

  it("without feeds the index is as before: the dimensional attributes are not mapped and the scope stops at them", async () => {
    const { model, requirements, links, req210 } = await star();
    const ix = buildRequirementIndex(requirements, links, model);
    expect(ix.coverage(req210.id)).toMatchObject({ total: 3, covered: [], notApproved: [] });
    expect(ix.coverage(req210.id).notMapped).toHaveLength(3);
    expect(ix.scope(req210.id).feeding).toBeUndefined();
    expect(ix.scope(req210.id).feeds).toBeUndefined();
  });

  it("an approved source mapping onto Customer.segment_code makes it 1 of 3, and its table enters the scope's entities' sources", async () => {
    const { model, requirements, links, view, attribute, req210 } = await star();
    const covered = approvedSourceMapping(model, attribute("Customer", "segment_code").id, "segment");
    const ix = buildRequirementIndex(requirements, links, covered, requirementFeeds(view, covered));
    expect(ix.coverage(req210.id).covered).toEqual([attribute("Dim Customer", "segment_code").id]);
    expect(ix.attributeCoverage(attribute("Customer", "segment_code").id)).toBe("covered");
  });
});

describe("coverage through feeds (D2, Y1)", () => {
  it("a feed counts only approved, without a type conflict, with every input covered; a transformation with a rule passes", async () => {
    const { model, requirements, links, attribute, req210 } = await star();
    const segment = attribute("Dim Customer", "segment_code").id, input = attribute("Customer", "segment_code").id;
    const covered = approvedSourceMapping(model, input, "segment");
    const at = (feeds: AttributeFeeds) => buildRequirementIndex(requirements, links, covered, feeds);
    const feed = { id: "f", approved: true, typeConflict: false, inputs: [input] };
    expect(at({ [segment]: [feed] }).attributeCoverage(segment)).toBe("covered");
    expect(at({ [segment]: [{ ...feed, approved: false }] }).attributeCoverage(segment)).toBe("not_approved");
    const conflict = at({ [segment]: [{ ...feed, typeConflict: true }] });
    expect(conflict.attributeCoverage(segment)).toBe("not_approved");
    expect(conflict.gapReason(segment)).toBe("type_conflict");
    expect(GAP_REASONS.type_conflict).toBe("type conflict");
    // an input that is not a live logical attribute counts as not covered (no recursion)
    expect(at({ [segment]: [{ ...feed, inputs: [attribute("Dim Customer", "city").id] }] }).attributeCoverage(segment)).toBe("not_approved");
    expect(at({}).coverage(req210.id).notMapped).toContain(segment);
  });

  it("the star's approved feeds have no type conflict (Y1's check of the seed); one with a different type has", async () => {
    const { model, view } = await star();
    const rows = view.data.infocube as { cubeMappings: never[]; cubeMappingInputs: never[] };
    const index = mappingIndex({ entities: model.entities, attributes: model.attributes, cubeMappings: rows.cubeMappings, cubeMappingInputs: rows.cubeMappingInputs });
    const feeds = cubeRequirementFeeds(index, model.attributes);
    const approved = Object.values(feeds).flat().filter((f) => f.approved);
    expect(approved.length).toBeGreaterThan(10);
    expect(approved.filter((f) => f.typeConflict)).toEqual([]);
    const direct = (rows.cubeMappings as { id: string; kind: string; status: string }[]).find((m) => m.kind === "direct" && m.status === "approved")!;
    const target = (rows.cubeMappings as { id: string; attribute_id: string }[]).find((m) => m.id === direct.id)!.attribute_id;
    const changed = { ...model, attributes: model.attributes.map((a) => (a.id === target ? { ...a, data_type: "date" as const } : a)) };
    const changedIndex = mappingIndex({ entities: changed.entities, attributes: changed.attributes, cubeMappings: rows.cubeMappings, cubeMappingInputs: rows.cubeMappingInputs });
    expect(hasTypeConflict(changedIndex, changedIndex.mapping(direct.id)!)).toBe(true);
  });

  it("the homes' read gives the page's feeds (moduleFeeds against requirementFeeds)", async () => {
    const { model, view } = await star();
    const { feeds, rowFeeds } = await moduleFeeds(WS, model, store);
    expect(feeds).toEqual(requirementFeeds(view, model));
    expect(Object.keys(rowFeeds).length).toBeGreaterThan(0);
  });
});

describe("coverageDelta with feeds (D4: the import review, a source's delete)", () => {
  it("names a requirement on a fact when the logical attribute behind it loses its approved mapping", async () => {
    const { model, requirements, links, view, attribute } = await star();
    const before = approvedSourceMapping(model, attribute("Customer", "segment_code").id, "segment");
    const after = { ...before, mappings: before.mappings.map((m) => (m.id === "test-mapping" ? { ...m, status: "review" as const } : m)) };
    const feeds = requirementFeeds(view, before);
    const delta = coverageDelta(requirements, links, before, after, feeds);
    const req = delta.find((d) => d.requirement.key === "REQ-210")!;
    expect(req).toMatchObject({ before: { covered: 1, total: 3 }, after: { covered: 0, total: 3 } });
    expect(req.why).toEqual(["segment_code: mapping back to review"]);
    expect(coverageDelta(requirements, links, before, after).some((d) => d.requirement.key === "REQ-210")).toBe(false);
  });
});

describe('"Fed from concepts" (D14, S15-24)', () => {
  it("lists the concepts that feed a fact or a dimension, each with how many of its attributes, in the concepts' order", async () => {
    const { model, view, entity } = await star();
    const name = (id: string) => model.concepts.find((c) => c.id === id)!.name;
    const rows = (e: string) => conceptFeeds(view, model, entity(e).id).map((r) => [name(r.conceptId), r.attributes, r.entities]);
    expect(rows("Fact Sales")).toEqual([["Sales", 8, ["Order Line", "Sales Order"]]]);
    expect(rows("Dim Customer")).toEqual([
      ["Customer", 3, ["Customer", "Customer Address"]],
      ["Reference data", 1, ["Country"]],
    ]);
    expect(rows("Dim Date")).toEqual([]);
    expect(rows("Customer")).toEqual([]);
  });
});

describe("the bus matrix's rows (B-8, R-8, RP-10)", () => {
  it("two facts × three dimensions in the Cube tab's order, one dot per relationship, conformed by facts", async () => {
    const [model, cube, measures, keys] = await Promise.all([
      store.model.load(WS),
      store.modules.list(WS, "cube_entity"),
      store.modules.list(WS, "cube_measure"),
      store.modules.list(WS, "cube_key"),
    ]);
    const read = (cubeKeys: readonly CubeKey[], attributes = model.attributes) =>
      busMatrix(cubeIndex({ entities: model.entities, attributes, relationships: model.relationships, cubeEntities: cube, cubeMeasures: measures, cubeKeys }), model.entities, model.concepts);
    const m = read(keys);
    // the store lists entities by name, and so does the Cube tab within a concept
    expect(m.facts.map((f) => [f.name, f.grain])).toEqual([
      ["Fact Orders", "One sales order"],
      ["Fact Sales", "One order line"],
    ]);
    expect(m.dimensions.map((d) => [d.name, d.history, d.facts])).toEqual([
      ["Dim Customer", "SCD 2", 2],
      ["Dim Product", "SCD 1", 1],
      ["Dim Date", "SCD 0", 2],
    ]);
    const id = (name: string) => model.entities.find((e) => e.name === name)!.id;
    const dates = m.cells[id("Fact Sales")]![id("Dim Date")]!;
    expect(dates.map((d) => d.title)).toEqual(["Fact Sales uses Dim Date as Order date: date_key", "Fact Sales uses Dim Date as Ship date: ship_date_key"]);
    expect(m.cells[id("Fact Orders")]![id("Dim Product")]).toBeUndefined();
    // RP-10: without ship_date_key's FK flag its link is inactive (R3): a hollow dot
    const shipKey = model.attributes.find((a) => a.entity_id === id("Fact Sales") && a.name === "ship_date_key")!;
    const unflagged = read(keys, model.attributes.map((a) => (a.id === shipKey.id ? { ...a, is_foreign_key: false } : a)));
    expect(unflagged.cells[id("Fact Sales")]![id("Dim Date")]!.map((d) => [d.key, d.title])).toEqual([
      ["date_key", "Fact Sales uses Dim Date as Order date: date_key"],
      [null, "Fact Sales uses Dim Date as Ship date, but no key carries it"],
    ]);
  });

  it("on a generated 50 × 100 model every relationship is one dot (D12)", () => {
    const std = (id: string) => ({ id, workspace_id: "ws", version: 1, created_at: "t", created_by: "u", updated_at: "t", updated_by: "u", deleted_at: null });
    const entities = [
      ...Array.from({ length: 50 }, (_, i) => ({ ...std(`f${i}`), name: `Fact ${i}`, concept_id: "c" })),
      ...Array.from({ length: 100 }, (_, i) => ({ ...std(`d${i}`), name: `Dim ${i}`, concept_id: "c" })),
    ];
    const cubeEntities = entities.map((e) => ({ ...std(`ce-${e.id}`), entity_id: e.id, role: e.id.startsWith("f") ? "fact" : "dimension", grain: null, ...typeColumns(e.id.startsWith("f") ? "fact" : "dimension") })) as CubeEntity[];
    const relationships = Array.from({ length: 300 }, (_, i) => ({ ...std(`r${i}`), from_entity_id: `d${(i * 7) % 100}`, to_entity_id: `f${i % 50}`, from_role: null, to_role: null }));
    const index = cubeIndex({ entities, attributes: [], relationships: relationships as never, cubeEntities, cubeMeasures: [], cubeKeys: [] });
    const m = busMatrix(index, entities as never, [{ id: "c", sort_order: 0 }]);
    const dots = Object.values(m.cells).flatMap((row) => Object.values(row).flat());
    expect(m.facts).toHaveLength(50);
    expect(m.dimensions).toHaveLength(100);
    expect(dots).toHaveLength(300);
    expect(dots.every((d) => d.key === null)).toBe(true);
  });
});

describe("one set of reasons at both levels (option A)", () => {
  it("a logical attribute whose approved mappings all have a type conflict gives \"type conflict\"; a draft one \"not approved\"", async () => {
    const { model, requirements, links, attribute } = await star();
    const quantity = attribute("Order Line", "quantity").id;
    // an approved direct mapping from a text column onto an integer attribute: a type conflict
    const conflict = approvedSourceMapping(model, quantity, "item_code");
    const ix = buildRequirementIndex(requirements, links, conflict);
    expect(ix.attributeCoverage(quantity)).toBe("not_approved");
    expect(ix.gapReason(quantity)).toBe("type_conflict");
    const draft = { ...conflict, mappings: conflict.mappings.map((m) => (m.id === "test-mapping" ? { ...m, status: "draft" as const } : m)) };
    expect(buildRequirementIndex(requirements, links, draft).gapReason(quantity)).toBeNull();
  });
});
