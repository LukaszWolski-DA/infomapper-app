// The table registry (slice 15a, AD-33, E1; the risk Łukasz named after step 1): every table the migrations create is
// known to the local adapter and to undo, through the composition root, and a module's table that is not registered is
// refused loudly, never skipped. With an empty registry undo and the adapter know exactly InfoMapper's tables (S15-01).
// The build already fails when a module's table is missing from `src/compose/tables.ts`'s records; this checks the
// migrations against them at run time.

import { readdirSync, readFileSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { STORE_SCHEMA, UNDO_TABLES } from "@/compose";
import { seedDevData } from "@/data/local/dev-data";
import { readDb } from "@/data/local/file";
import { CORE_SCHEMA, localSchema, RULES, findViolation, type DevDb } from "@/data/local/schema";
import { createLocalDataStore } from "@/data/local/store";
import { buildWriteSet, type Write, type WriteSet } from "@/domain/changes";
import { CORE_UNDO_TABLES, OUTSIDE_UNDO, UNDOABLE_TABLES, isUndoable, revertChangeGroup, undoTables, type WorkspaceRows } from "@/domain/commands/undo";
import { access, attribute, canvas, canvasItem, concept, entity, ids, link, makeCtx, mapping, mappingInput, project, relationship, sourceColumn, sourceSystem, sourceTable } from "@/domain/__fixtures__/domain";
import type { Entity } from "@/domain/types";
import type { CubeEntity } from "@/modules/infocube/domain/types";
import { NOT_IN_DOMAIN_YET } from "./schema/compare-schema";

const MIGRATIONS = path.resolve(__dirname, "../supabase/migrations");

/** Every table a migration creates, minus the ones no slice has built yet. */
function migratedTables(): string[] {
  const names = new Set<string>();
  for (const f of readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql"))) {
    for (const m of readFileSync(path.join(MIGRATIONS, f), "utf8").matchAll(/^create table (\w+)/gim)) names.add(m[1]!);
  }
  for (const t of NOT_IN_DOMAIN_YET) names.delete(t);
  return [...names].sort();
}

describe("the table registry against the migrations (slice 15a)", () => {
  it("knows every table a migration creates in the local adapter, and no other", () => {
    expect([...STORE_SCHEMA.tables].sort()).toEqual(migratedTables());
  });

  it("puts every table but the change log in the undo history or outside it, never both", () => {
    for (const table of migratedTables().filter((t) => t !== "change_event")) {
      const inside = UNDO_TABLES.undoable.includes(table);
      expect(inside !== UNDO_TABLES.outside.has(table), table).toBe(true);
    }
    expect(STORE_SCHEMA.undoable).toEqual(UNDO_TABLES.undoable);
    // InfoCube's description rows are undo steps (X-4: one undo brings a deleted fact back with them)
    expect(UNDO_TABLES.undoable).toEqual(expect.arrayContaining(["cube_entity", "cube_measure"]));
    expect(UNDO_TABLES.outside.has("organization_licence")).toBe(true);
  });
});

describe("an empty registry (S15-01)", () => {
  it("leaves undo and the adapter with InfoMapper's tables only", () => {
    expect(CORE_UNDO_TABLES.undoable).toEqual([...UNDOABLE_TABLES]);
    expect([...CORE_UNDO_TABLES.outside].sort()).toEqual([...OUTSIDE_UNDO].sort());
    expect(CORE_UNDO_TABLES.nouns).toEqual({});
    expect(CORE_UNDO_TABLES.actions).toEqual({});
    expect([...CORE_SCHEMA.tables].sort()).toEqual(Object.keys(RULES).sort());
    expect(CORE_SCHEMA.undoable).toEqual([...UNDOABLE_TABLES]);
  });

  it("refuses a module table that takes an InfoMapper table's name", () => {
    expect(() => undoTables({ entity: { parents: [], noun: "x" } } as never)).toThrow(/InfoMapper's/);
    expect(() => localSchema({ attribute: RULES.attribute } as never)).toThrow(/InfoMapper's/);
  });
});

// ---- undo with a module's rows ----

const ctx = makeCtx();
const modeler = access("modeler");
const DIM = "01900000-0000-7000-8000-0000000d0001";
const CUBE = "01900000-0000-7000-8000-0000000d0002";
const std = { workspace_id: ids.ws, version: 1, created_at: ctx.now, created_by: ids.actor, updated_at: ctx.now, updated_by: ids.actor, deleted_at: null };

const dimension = (): Entity => entity(DIM, { name: "Dim Customer", model_level: "dimensional" });
const cubeRow = (over: Partial<CubeEntity> = {}): CubeEntity => ({ id: CUBE, ...std, entity_id: DIM, role: "dimension", grain: null, scd_type: 1, ...over });

type Rows = { -readonly [T in keyof WorkspaceRows]: NonNullable<WorkspaceRows[T]>[number][] };
function seed(): Rows {
  return {
    project: [project(ids.projectA)],
    canvas: [canvas(ids.canvas1)],
    project_canvas: [link(ids.projectA, ids.canvas1)],
    concept: [concept(ids.conceptCustomer), concept(ids.conceptSales)],
    entity: [entity(ids.customer), entity(ids.salesOrder)],
    attribute: [attribute(ids.customerId), attribute(ids.email), attribute(ids.orderId)],
    relationship: [relationship()],
    source_system: [sourceSystem()],
    source_table: [sourceTable()],
    source_column: [sourceColumn(ids.colCustId), sourceColumn(ids.colEmail), sourceColumn(ids.colFirstName)],
    source_relationship: [],
    source_relationship_column: [],
    source_import: [],
    source_change: [],
    mapping: [mapping()],
    mapping_input: [mappingInput()],
    canvas_item: [canvasItem(ids.itemCustomer)],
    frame: [],
    label: [],
    label_link: [],
    project_pinned_label: [],
    note: [],
    requirement: [],
    requirement_link: [],
    classification: [],
    classification_link: [],
  };
}

/** Applies a write set as the adapter does (without its checks); a module's table starts on its first row. */
function apply(rows: Rows, writeSet: WriteSet): Rows {
  const next = structuredClone(rows) as unknown as Record<string, Record<string, unknown>[]>;
  for (const w of writeSet.writes) {
    const list = (next[w.table] ??= []);
    if (w.kind === "insert") list.push(structuredClone(w.row) as unknown as Record<string, unknown>);
    else if (w.kind === "update") {
      const id = (w.before as unknown as { id: string }).id;
      list[list.findIndex((r) => r.id === id)] = structuredClone(w.row) as unknown as Record<string, unknown>;
    }
  }
  return next as unknown as Rows;
}

const createDimension = () => buildWriteSet(ctx, ids.ws, [
  { kind: "insert", table: "entity", row: dimension() },
  { kind: "insert", table: "cube_entity", row: cubeRow() },
] as Write[]);

describe("undo with a module's rows (slice 15a)", () => {
  it("throws on a table it does not know instead of calling the step not undoable", () => {
    const events = createDimension().events;
    expect(() => isUndoable(events)).toThrow(/does not know the table cube_entity/);
    expect(isUndoable(events, UNDO_TABLES)).toBe(true);
  });

  it("undoes and redoes an entity with its InfoCube row in one step", () => {
    const done = createDimension();
    const afterDo = apply(seed(), done);
    const undone = revertChangeGroup(makeCtx(), modeler, { events: done.events, rows: afterDo }, "undo", UNDO_TABLES);
    if (!undone.ok) throw new Error(undone.error.message);
    const afterUndo = apply(afterDo, undone.writeSet);
    expect(afterUndo.entity.find((e) => e.id === DIM)!.deleted_at).not.toBeNull();
    expect(afterUndo.cube_entity!.find((c) => c.id === CUBE)!.deleted_at).not.toBeNull();

    const redone = revertChangeGroup(makeCtx(), modeler, { events: undone.writeSet.events, rows: afterUndo }, "redo", UNDO_TABLES);
    if (!redone.ok) throw new Error(redone.error.message);
    const afterRedo = apply(afterUndo, redone.writeSet);
    expect(afterRedo.entity.find((e) => e.id === DIM)!.deleted_at).toBeNull();
    expect(afterRedo.cube_entity!.find((c) => c.id === CUBE)).toMatchObject({ deleted_at: null, role: "dimension", scd_type: 1 });
  });

  it("refuses to bring an InfoCube row back without its entity (its registered parent)", () => {
    const rows = apply(seed(), createDimension());
    const cube = rows.cube_entity![0]!;
    // the row deleted alone, then its entity deleted in a later step
    const dropCube = buildWriteSet(ctx, ids.ws, [{ kind: "update", table: "cube_entity", before: cube, row: { ...cube, version: 2, deleted_at: ctx.now } }] as Write[]);
    const afterDrop = apply(rows, dropCube);
    const dim = afterDrop.entity.find((e) => e.id === DIM)!;
    const afterEntity = apply(afterDrop, buildWriteSet(ctx, ids.ws, [{ kind: "update", table: "entity", before: dim, row: { ...dim, version: 2, deleted_at: ctx.now } }] as Write[]));
    const undone = revertChangeGroup(makeCtx(), modeler, { events: dropCube.events, rows: afterEntity }, "undo", UNDO_TABLES);
    expect(undone.ok).toBe(false);
  });

  it("undoes an old change event without model_level as logical (S15-02, F6)", () => {
    const rows = seed();
    const customer = rows.entity[0]!;
    const oldCustomer = Object.fromEntries(Object.entries(customer).filter(([k]) => k !== "model_level")) as unknown as Entity;
    // a rename recorded before slice 15a: neither image has the column
    const old = buildWriteSet(ctx, ids.ws, [{ kind: "update", table: "entity", before: oldCustomer, row: { ...oldCustomer, name: "Client", version: 2 } }] as Write[]);
    const now = { ...rows, entity: rows.entity.map((e) => (e.id === customer.id ? { ...e, name: "Client", version: 2 } : e)) };
    const undone = revertChangeGroup(makeCtx(), modeler, { events: old.events, rows: now }, "undo", UNDO_TABLES);
    if (!undone.ok) throw new Error(undone.error.message);
    const written = undone.writeSet.writes[0]!;
    expect(written.kind === "update" && written.row).toMatchObject({ name: "Customer", model_level: "logical" });
  });
});

// ---- the local adapter with a module's rows ----

let dir: string;
let file: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "infomapper-registry-"));
  file = path.join(dir, "dev-db.json");
  await seedDevData(file);
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

/** A dimensional entity and its InfoCube row in the seeded file's first workspace. */
async function dimensionIn(db: DevDb, cubeId = CUBE) {
  const ws = db.workspace[0]!;
  const by = db.app_user[0]!.id;
  const at = "2026-11-04T10:00:00.000Z";
  const base = { workspace_id: ws.id, version: 1, created_at: at, created_by: by, updated_at: at, updated_by: by, deleted_at: null };
  const conceptId = db.concept.find((c) => c.workspace_id === ws.id)!.id;
  const row: Entity = { ...base, id: DIM, concept_id: conceptId, name: "Dim Customer", alias: null, model_level: "dimensional", stereotype: "object", definition_html: null, definition_text: null };
  const cube: CubeEntity = { ...base, id: cubeId, entity_id: DIM, role: "dimension", grain: null, scd_type: 1 };
  const c = makeCtx(by);
  return { ws, row, cube, ctx: c, at };
}

describe("the local adapter with a module's rows (slice 15a)", () => {
  it("refuses a module's row without the module's registration, before anything is written", async () => {
    const db = await readDb(file);
    const { ws, row, cube, ctx: c } = await dimensionIn(db);
    const before = await readFile(file, "utf8");
    const result = await createLocalDataStore(file, CORE_SCHEMA).apply(buildWriteSet(c, ws.id, [{ kind: "insert", table: "entity", row }, { kind: "insert", table: "cube_entity", row: cube }] as Write[]));
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.message).toMatch(/does not know the table cube_entity/);
    expect(await readFile(file, "utf8")).toBe(before);
  });

  it("stores, checks and reads back a module's rows with the composition root's schema", async () => {
    const db = await readDb(file);
    const { ws, row, cube, ctx: c } = await dimensionIn(db);
    const store = createLocalDataStore(file, STORE_SCHEMA);
    const result = await store.apply(buildWriteSet(c, ws.id, [{ kind: "insert", table: "entity", row }, { kind: "insert", table: "cube_entity", row: cube }] as Write[]));
    expect(result).toEqual({ ok: true });

    const onDisk = JSON.parse(await readFile(file, "utf8")) as DevDb & { cube_entity: CubeEntity[] };
    expect(onDisk.cube_entity).toEqual([cube]);
    expect(findViolation(onDisk, undefined, STORE_SCHEMA)).toBeNull();
    // the file read without the registration has a table nobody knows
    expect(findViolation(onDisk)).toMatchObject({ kind: "unknown_table", table: "cube_entity" });
    const rows = await store.model.loadForUndo(ws.id);
    expect(rows.cube_entity).toEqual([cube]);

    // a second live row for one dimensional entity, and a shape a dimension may not have, are refused
    const second = await store.apply(buildWriteSet(c, ws.id, [{ kind: "insert", table: "cube_entity", row: { ...cube, id: "01900000-0000-7000-8000-0000000d0003" } }] as Write[]));
    expect(second.ok).toBe(false);
    const grainOnDimension = await store.apply(buildWriteSet(c, ws.id, [{ kind: "update", table: "cube_entity", before: cube, row: { ...cube, version: 2, grain: "One order line" } }] as Write[]));
    expect(!grainOnDimension.ok && grainOnDimension.error.message).toMatch(/cube_entity_shape_ck/);
  });
});
