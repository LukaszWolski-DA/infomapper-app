// A dimension's unknown member in the store, the change groups, undo and the model checks (slice 22 step 2, D-77): a
// file written before slice 22 loads with every dimension's unknown member on and a fact's none (S22-01, acceptance F4);
// the adapter's rules for `cube_entity`'s shape and for `cube_attribute`; an attribute's and an entity's delete take the
// stored values in the same change group and one undo brings both back (PRD item 9); undo refuses a value whose
// attribute is deleted; the two checks, `unkval` and `nounk` (PRD item 8).

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { STORE_SCHEMA, UNDO_TABLES } from "@/compose";
import { cubeModuleChecks } from "@/compose/checks";
import { addFullDemoData, addModuleDemoData } from "@/compose/seed";
import { seedDevData } from "@/data/local/dev-data";
import { readDb, writeDb } from "@/data/local/file";
import type { DevDb } from "@/data/local/schema";
import { buildSeed, SEED_IDS, SEED_USERS } from "@/data/local/seed";
import { createLocalDataStore } from "@/data/local/store";
import { buildWriteSet, type CommandContext, type CommandResult, type Write, type WriteSet } from "@/domain/changes";
import { deleteAttribute } from "@/domain/commands/attribute";
import { deleteEntity } from "@/domain/commands/entity";
import { cascadingModuleTables, moduleCascade } from "@/domain/commands/module-cascade";
import { revertChangeGroup, type WorkspaceRows } from "@/domain/commands/undo";
import { makeCtx, member, workspace } from "@/domain/__fixtures__/domain";
import { modelChecks, projectScope, type CheckGroup, type ModelChecks } from "@/domain/model/checks";
import { lookupModel } from "@/domain/model/requirements";
import type { WorkspaceAccess } from "@/domain/permissions";
import type { Attribute, Entity, WorkspaceModel } from "@/domain/types";
import { starId } from "@/modules/infocube/data/sales-star";
import { upgradeCubeEntity, type InfoCubeDb } from "@/modules/infocube/data/tables";
import { setUnknownValue, updateCubeEntity } from "@/modules/infocube/domain/commands";
import { cubeRequirementFeeds, mappingIndex } from "@/modules/infocube/domain/mappings";
import type { CubeAttribute, CubeEntity } from "@/modules/infocube/domain/types";
import { cubePageRows } from "@/modules/infocube/domain/view";

const WS = SEED_IDS.wsRetailDwh;
type Rows = Record<string, Record<string, unknown>[]>;

let issued = 0;
/** A command context whose ids are new in this file: the fixture's contexts each start at the same id. */
function ctxOf(actorId?: string): CommandContext {
  return { ...makeCtx(actorId), newId: () => `01900000-0000-7000-8000-a${String(++issued).padStart(11, "0")}` };
}

function starRows(): Rows {
  const db = buildSeed() as unknown as Rows;
  addModuleDemoData(db as never);
  return Object.fromEntries(Object.entries(db).filter(([k]) => Array.isArray(db[k])).map(([k, rows]) => [k, rows.filter((r) => r.workspace_id === WS)]));
}

function apply(rows: Rows, writeSet: WriteSet): Rows {
  const next = structuredClone(rows);
  for (const w of writeSet.writes) {
    const list = (next[w.table] ??= []);
    if (w.kind === "insert") list.push(structuredClone(w.row) as unknown as Record<string, unknown>);
    else if (w.kind === "update") {
      const id = (w.before as unknown as { id: string }).id;
      list[list.findIndex((r) => r.id === id)] = structuredClone(w.row) as unknown as Record<string, unknown>;
    }
  }
  return next;
}

const ok = <T>(r: CommandResult<T>) => {
  if (!r.ok) throw new Error(r.error.message);
  return r;
};

/** The write set as `runCommand` applies it: with the module rows that follow its deletes, in the same change group. */
function withCascades(ctx: CommandContext, rows: Rows, writeSet: WriteSet): WriteSet {
  const tables = cascadingModuleTables(writeSet.writes, UNDO_TABLES);
  const live = Object.fromEntries(tables.map((t) => [t, (rows[t] ?? []).filter((r) => r.deleted_at === null)]));
  const extra = moduleCascade(ctx, writeSet.writes, UNDO_TABLES, live);
  if (!extra.length) return writeSet;
  const rebuilt = buildWriteSet(ctx, WS, [...writeSet.writes, ...extra]);
  return { ...writeSet, writes: rebuilt.writes, events: rebuilt.events.map((e) => ({ ...e, change_group_id: writeSet.changeGroupId })) };
}

const modeler = (): WorkspaceAccess => ({ workspace: workspace({ id: WS, infocube: true }), member: member("modeler", { workspace_id: WS }) });
const attributeId = (key: string) => starId(WS, `attribute:${key}`);
const attributeOf = (rows: Rows, key: string) => (rows.attribute as unknown as Attribute[]).find((a) => a.id === attributeId(key))!;
const cubeOfAttribute = (rows: Rows, a: Attribute) => (rows.cube_entity as unknown as CubeEntity[]).find((c) => c.entity_id === a.entity_id && c.deleted_at === null)!;
const valueOf = (rows: Rows, key: string) => ((rows.cube_attribute ?? []) as unknown as CubeAttribute[]).filter((v) => v.attribute_id === attributeId(key));
const liveValue = (rows: Rows, key: string) => valueOf(rows, key).find((v) => v.deleted_at === null) ?? null;

/** Types a value as a person does, through the command, with the row the page knows. */
function setValue(rows: Rows, key: string, value: string): { rows: Rows; writeSet: WriteSet } {
  const a = attributeOf(rows, key);
  const row = liveValue(rows, key);
  const r = ok(setUnknownValue(ctxOf(), modeler(), { attribute: a, cube: cubeOfAttribute(rows, a), row }, { attributeId: a.id, value, current: row && { id: row.id, version: row.version } }));
  return { rows: apply(rows, r.writeSet), writeSet: r.writeSet };
}

function removeAttribute(rows: Rows, key: string): { rows: Rows; writeSet: WriteSet } {
  const a = attributeOf(rows, key);
  const ctx = ctxOf();
  const writeSet = withCascades(ctx, rows, ok(deleteAttribute(ctx, modeler(), { attribute: a, mappings: [], mappingInputs: [], attributeInputs: [] }, { attributeId: a.id, expectedVersion: a.version })).writeSet);
  return { rows: apply(rows, writeSet), writeSet };
}

function removeEntity(rows: Rows, name: string): { rows: Rows; writeSet: WriteSet } {
  const e = (rows.entity as unknown as Entity[]).find((x) => x.name === name)!;
  const ctx = ctxOf();
  const state = { entity: e, attributes: rows.attribute as never, mappings: [], mappingInputs: [], attributeInputs: [], relationships: [], canvasItems: [], entities: rows.entity as never };
  const writeSet = withCascades(ctx, rows, ok(deleteEntity(ctx, modeler(), state, { entityId: e.id, expectedVersion: e.version })).writeSet);
  return { rows: apply(rows, writeSet), writeSet };
}

const undo = (rows: Rows, writeSet: WriteSet) => revertChangeGroup(ctxOf(), modeler(), { events: writeSet.events, rows: rows as unknown as WorkspaceRows }, "undo", UNDO_TABLES);

describe("the seeded star (S22-01)", () => {
  it("has every dimension's unknown member on, every fact's none, and no stored value", () => {
    const db = buildSeed() as unknown as Rows;
    addFullDemoData(db as never);
    const cubes = db.cube_entity as unknown as CubeEntity[];
    expect(cubes.filter((c) => c.role === "dimension").map((c) => c.has_unknown_member)).toEqual([true, true, true, true, true]);
    expect(cubes.filter((c) => c.role === "fact").map((c) => c.has_unknown_member)).toEqual([null, null]);
    expect(db.cube_attribute ?? []).toEqual([]);
  });
});

describe("an older row's upgrade (F4)", () => {
  const old = { id: "x", workspace_id: WS, entity_id: "e", version: 3, deleted_at: null };
  const slice19 = { fact_type: null, is_factless: null, base_fact_entity_id: null, dim_kind: "standard", history: "history", snapshot_period: null };
  it("turns a dimension's unknown member on and gives a fact none, from slice 19's shape and from slice 18's", () => {
    expect(upgradeCubeEntity({ ...old, role: "dimension", grain: null, ...slice19 })).toEqual({ ...old, role: "dimension", grain: null, ...slice19, has_unknown_member: true });
    expect(upgradeCubeEntity({ ...old, role: "fact", grain: "g", ...slice19, fact_type: "periodic", is_factless: true, dim_kind: null, history: null })).toMatchObject({ fact_type: "periodic", is_factless: true, has_unknown_member: null });
    expect(upgradeCubeEntity({ ...old, role: "dimension", grain: null, scd_type: 2 })).toMatchObject({ history: "history", has_unknown_member: true });
    expect(upgradeCubeEntity({ ...old, role: "fact", grain: null, scd_type: null })).toMatchObject({ fact_type: "transaction", has_unknown_member: null });
  });
  it("keeps a dimension turned off and leaves a current row alone (idempotent)", () => {
    const off = { ...old, role: "dimension", grain: null, ...slice19, has_unknown_member: false };
    expect(upgradeCubeEntity(off)).toBeNull();
    expect(upgradeCubeEntity(upgradeCubeEntity({ ...old, role: "dimension", grain: null, ...slice19 })!)).toBeNull();
  });
});

describe("the local file (F4, Q2)", () => {
  let dir: string;
  let file: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "im-unknown-"));
    file = path.join(dir, "dev-db.json");
    await seedDevData(file, addModuleDemoData);
  });
  afterEach(async () => rm(dir, { recursive: true, force: true }));

  /** The file as slice 21 left it: no `has_unknown_member`, no `cube_attribute`. */
  async function writeOlder() {
    const db = (await readDb(file)) as unknown as Rows;
    db.cube_entity = db.cube_entity!.map((r) => {
      const { has_unknown_member, ...rest } = r;
      void has_unknown_member;
      return rest;
    });
    delete db.cube_attribute;
    await writeDb(file, db as never);
  }

  it("loads a file written before slice 22 with every dimension on, and a write to the table passes and stores the column", async () => {
    await writeOlder();
    const store = createLocalDataStore(file, STORE_SCHEMA);
    const rows = await store.modules.list(WS, "cube_entity");
    expect(rows.map((r) => [r.role, r.has_unknown_member])).toEqual([
      ["fact", null],
      ["dimension", true],
      ["dimension", true],
      ["dimension", true],
      ["fact", null],
    ]);
    const undoRows = (await store.model.loadForUndo(WS)) as unknown as Rows;
    expect(undoRows.cube_entity!.every((c) => "has_unknown_member" in c)).toBe(true);
    const cust = rows[1]!;
    const r = ok(updateCubeEntity(ctxOf(SEED_USERS.anna.id), modeler(), { cube: cust }, { cubeEntityId: cust.id, expectedVersion: cust.version, hasUnknownMember: false }));
    expect(await store.apply(r.writeSet)).toEqual({ ok: true });
    const stored = ((await readDb(file)) as unknown as Rows).cube_entity!;
    expect(stored.every((c) => "has_unknown_member" in c)).toBe(true);
    expect(stored.find((c) => c.id === cust.id)).toMatchObject({ has_unknown_member: false, version: cust.version + 1 });
  });

  it("refuses a fact with an unknown member and a dimension without the flag (cube_entity_shape_ck)", async () => {
    const store = createLocalDataStore(file, STORE_SCHEMA);
    const rows = await store.modules.list(WS, "cube_entity");
    const ctx = ctxOf(SEED_USERS.anna.id);
    const forced = (row: CubeEntity, has_unknown_member: boolean | null) =>
      store.apply(buildWriteSet(ctx, WS, [{ kind: "update", table: "cube_entity", before: row, row: { ...row, version: row.version + 1, has_unknown_member } }] as Write[]));
    const onFact = await forced(rows.find((r) => r.role === "fact")!, true);
    expect(!onFact.ok && onFact.error.message).toMatch(/cube_entity_shape_ck/);
    const noneOnDimension = await forced(rows.find((r) => r.role === "dimension")!, null);
    expect(!noneOnDimension.ok && noneOnDimension.error.message).toMatch(/cube_entity_shape_ck/);
  });

  it("stores a value in a file that had no cube_attribute table, lists it, and keeps one live row per attribute, never empty", async () => {
    await writeOlder();
    const store = createLocalDataStore(file, STORE_SCHEMA);
    expect(await store.modules.list(WS, "cube_attribute")).toEqual([]);
    const model = await store.model.load(WS);
    const a = model.attributes.find((x) => x.id === attributeId("cust.segment_code"))!;
    const cube = (await store.modules.list(WS, "cube_entity")).find((c) => c.entity_id === a.entity_id)!;
    const ctx = ctxOf(SEED_USERS.anna.id);
    const first = ok(setUnknownValue(ctx, modeler(), { attribute: a, cube, row: null }, { attributeId: a.id, value: " n/a ", current: null }));
    expect(await store.apply(first.writeSet)).toEqual({ ok: true });
    const [row] = await store.modules.list(WS, "cube_attribute");
    expect(row).toMatchObject({ attribute_id: a.id, unknown_value: "n/a", version: 1, deleted_at: null });

    // a second live row for the attribute (a writer that skipped the command's check)
    const second = ok(setUnknownValue(ctxOf(SEED_USERS.anna.id), modeler(), { attribute: a, cube, row: null }, { attributeId: a.id, value: "other", current: null }));
    const twice = await store.apply(second.writeSet);
    expect(!twice.ok && twice.error.message).toMatch(/attribute_id/);
    for (const bad of ["", " n/a"]) {
      const forced = await store.apply(buildWriteSet(ctxOf(SEED_USERS.anna.id), WS, [{ kind: "update", table: "cube_attribute", before: row, row: { ...row!, version: 2, unknown_value: bad } }] as Write[]));
      expect(!forced.ok && forced.error.message, JSON.stringify(bad)).toMatch(/cube_attribute_unknown_value_ck/);
    }

    // cleared: the row is soft-deleted, and a new value is a new row
    const cleared = ok(setUnknownValue(ctxOf(SEED_USERS.anna.id), modeler(), { attribute: a, cube, row: row! }, { attributeId: a.id, value: "", current: { id: row!.id, version: 1 } }));
    expect(await store.apply(cleared.writeSet)).toEqual({ ok: true });
    const again = ok(setUnknownValue(ctxOf(SEED_USERS.anna.id), modeler(), { attribute: a, cube, row: null }, { attributeId: a.id, value: "none", current: null }));
    expect(await store.apply(again.writeSet)).toEqual({ ok: true });
    expect((await store.modules.list(WS, "cube_attribute")).map((v) => v.unknown_value)).toEqual(["none"]);
    const all = ((await readDb(file)) as unknown as Rows).cube_attribute!;
    expect(all.map((v) => [v.unknown_value, v.deleted_at === null])).toEqual([["n/a", false], ["none", true]]);
  });
});

describe("deletes take the stored values (PRD item 9)", () => {
  it("an attribute's delete deletes its value in the same change group, and one undo brings both back", () => {
    const typed = setValue(starRows(), "cust.segment_code", "n/a").rows;
    const { rows, writeSet } = removeAttribute(typed, "cust.segment_code");
    expect(attributeOf(rows, "cust.segment_code").deleted_at).not.toBeNull();
    expect(liveValue(rows, "cust.segment_code")).toBeNull();
    expect(writeSet.writes.filter((w) => w.table === "cube_attribute")).toHaveLength(1);
    expect(new Set(writeSet.events.map((e) => e.change_group_id)).size).toBe(1);
    const back = apply(rows, ok(undo(rows, writeSet)).writeSet);
    expect(attributeOf(back, "cust.segment_code").deleted_at).toBeNull();
    expect(liveValue(back, "cust.segment_code")).toMatchObject({ unknown_value: "n/a" });
  });

  it("a dimension's delete takes every value of its attributes, and one undo brings them back", () => {
    let typed = setValue(starRows(), "cust.segment_code", "n/a").rows;
    typed = setValue(typed, "cust.customer_key", "0").rows;
    typed = setValue(typed, "prod.sku", "none").rows;
    const { rows, writeSet } = removeEntity(typed, "Dim Customer");
    expect([liveValue(rows, "cust.segment_code"), liveValue(rows, "cust.customer_key")]).toEqual([null, null]);
    expect(liveValue(rows, "prod.sku")).toMatchObject({ unknown_value: "none" });
    expect(new Set(writeSet.events.map((e) => e.change_group_id)).size).toBe(1);
    const back = apply(rows, ok(undo(rows, writeSet)).writeSet);
    expect([liveValue(back, "cust.segment_code")?.unknown_value, liveValue(back, "cust.customer_key")?.unknown_value]).toEqual(["n/a", "0"]);
  });

  it("an attribute without a stored value deletes as before", () => {
    const { writeSet } = removeAttribute(starRows(), "cust.segment_code");
    expect(writeSet.writes.filter((w) => w.table === "cube_attribute")).toHaveLength(0);
  });
});

describe("undo and the stored values (Q3)", () => {
  it("undoes and redoes a typed value, a changed one and a cleared one", () => {
    const first = setValue(starRows(), "cust.segment_code", "n/a");
    const none = apply(first.rows, ok(undo(first.rows, first.writeSet)).writeSet);
    expect(liveValue(none, "cust.segment_code")).toBeNull();
    const changed = setValue(first.rows, "cust.segment_code", "none");
    const back = apply(changed.rows, ok(undo(changed.rows, changed.writeSet)).writeSet);
    expect(liveValue(back, "cust.segment_code")).toMatchObject({ unknown_value: "n/a" });
    const a = attributeOf(changed.rows, "cust.segment_code");
    const row = liveValue(changed.rows, "cust.segment_code")!;
    const cleared = ok(setUnknownValue(ctxOf(), modeler(), { attribute: a, cube: cubeOfAttribute(changed.rows, a), row }, { attributeId: a.id, value: "", current: { id: row.id, version: row.version } }));
    const empty = apply(changed.rows, cleared.writeSet);
    expect(liveValue(empty, "cust.segment_code")).toBeNull();
    expect(liveValue(apply(empty, ok(undo(empty, cleared.writeSet)).writeSet), "cust.segment_code")).toMatchObject({ unknown_value: "none" });
  });

  it("refuses to bring back a value whose attribute was deleted meanwhile", () => {
    const first = setValue(starRows(), "cust.segment_code", "n/a");
    const a = attributeOf(first.rows, "cust.segment_code");
    const row = liveValue(first.rows, "cust.segment_code")!;
    const cleared = ok(setUnknownValue(ctxOf(), modeler(), { attribute: a, cube: cubeOfAttribute(first.rows, a), row }, { attributeId: a.id, value: "", current: { id: row.id, version: row.version } }));
    const gone = removeAttribute(apply(first.rows, cleared.writeSet), "cust.segment_code").rows;
    expect(undo(gone, cleared.writeSet).ok).toBe(false);
  });

  it("refuses to undo a typed value that someone changed meanwhile", () => {
    const first = setValue(starRows(), "cust.segment_code", "n/a");
    const other = setValue(first.rows, "cust.segment_code", "none").rows;
    expect(undo(other, first.writeSet).ok).toBe(false);
  });
});

// ---- the checks (PRD item 8) ----

type Db = DevDb & InfoCubeDb;
const live = <T extends { deleted_at: string | null; workspace_id: string }>(rows: readonly T[]) => rows.filter((r) => r.deleted_at === null && r.workspace_id === WS);

function modelOf(db: Db): WorkspaceModel {
  return {
    concepts: live(db.concept),
    entities: live(db.entity).sort((a, b) => a.name.localeCompare(b.name)),
    attributes: live(db.attribute).sort((a, b) => a.entity_id.localeCompare(b.entity_id) || a.sort_order - b.sort_order),
    relationships: live(db.relationship),
    sourceSystems: live(db.source_system),
    sourceTables: live(db.source_table),
    sourceColumns: live(db.source_column),
    mappings: live(db.mapping),
    mappingInputs: live(db.mapping_input),
    attributeInputs: live(db.attribute_input),
    sourceRelationships: [],
    sourceRelationshipColumns: [],
    classifications: [],
    classificationLinks: [],
    stereotypes: [],
    lostOriginals: [],
  };
}

function checksOf(db: Db, project: string | null, on = true): ModelChecks {
  const model = modelOf(db);
  const rows = cubePageRows(live(db.cube_entity ?? []), live(db.cube_measure ?? []), live(db.cube_key ?? []), live(db.cube_mapping ?? []), live(db.cube_mapping_input ?? []), live(db.cube_attribute ?? []));
  const feeds = cubeRequirementFeeds(mappingIndex({ entities: model.entities, attributes: model.attributes, cubeMappings: rows.cubeMappings as never, cubeMappingInputs: rows.cubeMappingInputs as never }), model.attributes);
  const canvases = project ? db.project_canvas.filter((l) => l.project_id === project).map((l) => l.canvas_id) : [];
  const input = { model, lookup: lookupModel(model, feeds), scope: project ? projectScope(live(db.canvas_item), canvases) : null };
  return modelChecks(input, cubeModuleChecks(on, rows, input));
}

const demo = (): Db => {
  const db = buildSeed() as Db;
  addFullDemoData(db);
  return db;
};
const group = (c: ModelChecks, id: string): CheckGroup | undefined => c.groups.find((g) => g.id === id);
const lines = (g: CheckGroup | undefined) => (g?.items ?? []).map((i) => i.text()).map((t) => `${t.name} · ${t.detail}`);
const PROJECT = SEED_IDS.projOrderManagement;
let n = 0;
function store(db: Db, key: string, unknown_value: string, over: Partial<CubeAttribute> = {}) {
  const at = "2026-11-09T08:00:00.000Z";
  (db.cube_attribute ??= []).push({ id: `01900000-0000-7000-8000-0000000d${(++n).toString(16).padStart(4, "0")}`, workspace_id: WS, version: 1, created_at: at, created_by: SEED_USERS.anna.id, updated_at: at, updated_by: SEED_USERS.anna.id, deleted_at: null, attribute_id: attributeId(key), unknown_value, ...over });
}
const cube = (db: Db, key: string) => db.cube_entity.find((c) => c.id === starId(WS, `cube-entity:${key}`))!;
const attribute = (db: Db, key: string) => db.attribute.find((a) => a.id === attributeId(key))!;

describe("the model checks: unknown member values that do not fit (unkval, High)", () => {
  it("has no line on the demo as seeded, and the other groups' counts do not change with the two groups there", () => {
    const c = checksOf(demo(), PROJECT);
    // a group without a line is not listed
    expect([group(c, "unkval"), group(c, "nounk")]).toEqual([undefined, undefined]);
    expect(c.count).toBe(c.groups.reduce((sum, g) => sum + g.items.length, 0));
  });

  it("gives one High line for a stored abc in Dim Customer.customer_key: it opens the attribute, marks its row and names its dimension", () => {
    const db = demo();
    store(db, "cust.customer_key", "abc");
    store(db, "cust.segment_code", "n/a");
    const g = group(checksOf(db, PROJECT), "unkval")!;
    expect(lines(g)).toEqual(["Dim Customer.customer_key · unknown member: “abc” is not an Integer"]);
    const ref = { t: "attribute", id: attributeId("cust.customer_key") };
    expect(g).toMatchObject({ high: true, module: "InfoCube", title: "Unknown member values that do not fit", short: "value does not fit" });
    expect(g.items[0]).toMatchObject({ go: ref, panels: [ref], marks: [ref], entities: [starId(WS, "entity:cust")] });
  });

  it("follows the attribute's type: the line goes when the type fits the value and comes when it stops fitting", () => {
    const db = demo();
    store(db, "cust.customer_key", "abc");
    store(db, "cust.city", "2026-11-09");
    attribute(db, "cust.customer_key").data_type = "string";
    expect(lines(group(checksOf(db, PROJECT), "unkval"))).toEqual([]);
    attribute(db, "cust.city").data_type = "boolean";
    expect(lines(group(checksOf(db, PROJECT), "unkval"))).toEqual(["Dim Customer.city · unknown member: “2026-11-09” is not a Boolean"]);
    Object.assign(attribute(db, "cust.city"), { data_type: "string", type_length: 5 });
    expect(lines(group(checksOf(db, PROJECT), "unkval"))).toEqual(["Dim Customer.city · unknown member: “2026-11-09” is longer than String(5)"]);
  });

  it("skips a dimension whose unknown member is off, a deleted value and a deleted attribute", () => {
    const db = demo();
    store(db, "cust.customer_key", "abc");
    cube(db, "cust").has_unknown_member = false;
    expect(lines(group(checksOf(db, PROJECT), "unkval"))).toEqual([]);
    cube(db, "cust").has_unknown_member = true;
    store(db, "prod.product_key", "x", { deleted_at: "2026-11-09T09:00:00.000Z" });
    expect(lines(group(checksOf(db, PROJECT), "unkval"))).toHaveLength(1);
    attribute(db, "cust.customer_key").deleted_at = "2026-11-09T09:00:00.000Z";
    expect(lines(group(checksOf(db, PROJECT), "unkval"))).toEqual([]);
  });

  it("stands before the facts' hints among InfoCube's groups, after the broken feeds", () => {
    const db = demo();
    store(db, "cust.customer_key", "abc");
    cube(db, "prod").has_unknown_member = false;
    const ids = checksOf(db, PROJECT).groups.filter((g) => g.module === "InfoCube").map((g) => g.id);
    expect(ids).toEqual(["feeds", "unkval", "facts", "nounk", "under"].filter((id) => ids.includes(id)));
    expect(ids).toEqual(expect.arrayContaining(["unkval", "nounk", "under"]));
  });
});

describe("the model checks: dimensions without an unknown member (nounk, Normal)", () => {
  it("gives one Normal line for Dim Product turned off, naming its fact; it opens and marks the dimension", () => {
    const db = demo();
    cube(db, "prod").has_unknown_member = false;
    const g = group(checksOf(db, PROJECT), "nounk")!;
    expect(lines(g)).toEqual(["Dim Product · used by Fact Sales"]);
    const ref = { t: "entity", id: starId(WS, "entity:prod") };
    expect(g).toMatchObject({ high: false, module: "InfoCube", title: "Dimensions without an unknown member", short: "no unknown member" });
    expect(g.items[0]).toMatchObject({ go: ref, panels: [ref], marks: [ref], entities: [ref.id] });
  });

  it("names every fact once, however many relationships join them", () => {
    const db = demo();
    cube(db, "date").has_unknown_member = false;
    cube(db, "cust").has_unknown_member = false;
    expect(lines(group(checksOf(db, PROJECT), "nounk"))).toEqual(["Dim Customer · used by Fact Orders, Fact Sales", "Dim Date · used by Fact Orders, Fact Sales"]);
  });

  it("has no line for a dimension no fact relates to (an outrigger), or whose only fact is deleted", () => {
    const db = demo();
    cube(db, "cat").has_unknown_member = false;
    cube(db, "flags").has_unknown_member = false;
    expect(lines(group(checksOf(db, PROJECT), "nounk"))).toEqual([]);
    cube(db, "prod").has_unknown_member = false;
    db.entity.find((e) => e.id === starId(WS, "entity:sales"))!.deleted_at = "2026-11-09T09:00:00.000Z";
    expect(lines(group(checksOf(db, PROJECT), "nounk"))).toEqual([]);
  });

  it("is in the whole model's checks too, and follows the project's scope", () => {
    const db = demo();
    cube(db, "prod").has_unknown_member = false;
    expect(lines(group(checksOf(db, null), "nounk"))).toEqual(["Dim Product · used by Fact Sales"]);
    expect(lines(group(checksOf(db, SEED_IDS.projCustomer360), "nounk"))).toEqual([]);
  });
});

describe("InfoCube off", () => {
  it("shows neither group", () => {
    const db = demo();
    store(db, "cust.customer_key", "abc");
    cube(db, "prod").has_unknown_member = false;
    const c = checksOf(db, PROJECT, false);
    expect([group(c, "unkval"), group(c, "nounk")]).toEqual([undefined, undefined]);
  });
});
