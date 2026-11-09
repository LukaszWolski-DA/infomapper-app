// InfoCube types in the store, the change groups and undo (slice 19 step 2, D-74): the local adapter reads a file's older
// `cube_entity` rows in the new shape before any read or check, and a write to the table passes with them (F1); a base
// fact's delete clears its aggregates' base in the same change group, one undo brings both back (F7); undo refuses a
// revert that makes a fact an aggregate of itself or of a deleted fact (F6).

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { STORE_SCHEMA, UNDO_TABLES } from "@/compose";
import { addModuleDemoData } from "@/compose/seed";
import { seedDevData } from "@/data/local/dev-data";
import { readDb, writeDb } from "@/data/local/file";
import { buildSeed, SEED_IDS, SEED_USERS } from "@/data/local/seed";
import { createLocalDataStore } from "@/data/local/store";
import { buildWriteSet, type CommandContext, type CommandResult, type WriteSet } from "@/domain/changes";
import { deleteEntity } from "@/domain/commands/entity";
import { cascadingModuleTables, moduleCascade } from "@/domain/commands/module-cascade";
import { revertChangeGroup, type WorkspaceRows } from "@/domain/commands/undo";
import { ids, makeCtx, member, workspace } from "@/domain/__fixtures__/domain";
import type { WorkspaceAccess } from "@/domain/permissions";
import type { Entity } from "@/domain/types";
import { AGGREGATE_TEXTS } from "@/modules/infocube/domain/aggregates";
import { updateCubeEntity } from "@/modules/infocube/domain/commands";
import { upgradeCubeEntity } from "@/modules/infocube/data/tables";
import type { CubeEntity } from "@/modules/infocube/domain/types";

const WS = SEED_IDS.wsRetailDwh;
type Rows = Record<string, Record<string, unknown>[]>;

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

function withCascades(ctx: CommandContext, rows: Rows, writeSet: WriteSet): WriteSet {
  const tables = cascadingModuleTables(writeSet.writes, UNDO_TABLES);
  const live = Object.fromEntries(tables.map((t) => [t, (rows[t] ?? []).filter((r) => r.deleted_at === null)]));
  const extra = moduleCascade(ctx, writeSet.writes, UNDO_TABLES, live);
  if (!extra.length) return writeSet;
  const rebuilt = buildWriteSet(ctx, WS, [...writeSet.writes, ...extra]);
  return { ...writeSet, writes: rebuilt.writes, events: rebuilt.events.map((e) => ({ ...e, change_group_id: writeSet.changeGroupId })) };
}

const modeler = (): WorkspaceAccess => ({ workspace: workspace({ id: WS, infocube: true }), member: member("modeler", { workspace_id: WS }) });
const entityNamed = (rows: Rows, name: string) => (rows.entity as unknown as Entity[]).find((e) => e.name === name)!;
const cubeOf = (rows: Rows, name: string) => (rows.cube_entity as unknown as CubeEntity[]).find((c) => c.entity_id === entityNamed(rows, name).id)!;

/** Sets a fact's base as a person does, through the command. */
function setBase(rows: Rows, fact: string, base: string | null): { rows: Rows; writeSet: WriteSet } {
  const c = cubeOf(rows, fact);
  const ctx = makeCtx();
  const r = ok(
    updateCubeEntity(ctx, modeler(), { cube: c, cubeEntities: rows.cube_entity as unknown as CubeEntity[], entities: rows.entity as unknown as Entity[] }, {
      cubeEntityId: c.id,
      expectedVersion: c.version,
      baseFactEntityId: base && entityNamed(rows, base).id,
    }),
  );
  return { rows: apply(rows, r.writeSet), writeSet: r.writeSet };
}

function deleteFact(rows: Rows, name: string): { rows: Rows; writeSet: WriteSet } {
  const e = entityNamed(rows, name);
  const ctx = makeCtx();
  const state = { entity: e, attributes: rows.attribute as never, mappings: [], mappingInputs: [], attributeInputs: [], relationships: [], canvasItems: [], entities: rows.entity as never };
  const writeSet = withCascades(ctx, rows, ok(deleteEntity(ctx, modeler(), state, { entityId: e.id, expectedVersion: e.version })).writeSet);
  return { rows: apply(rows, writeSet), writeSet };
}

const undo = (rows: Rows, writeSet: WriteSet) => revertChangeGroup(makeCtx(), modeler(), { events: writeSet.events, rows: rows as unknown as WorkspaceRows }, "undo", UNDO_TABLES);

describe("a base fact's delete (F7)", () => {
  it("clears its aggregates' base in the same change group, and one undo brings both back", () => {
    const based = setBase(starRows(), "Fact Orders", "Fact Sales").rows;
    expect(cubeOf(based, "Fact Orders").base_fact_entity_id).toBe(entityNamed(based, "Fact Sales").id);
    const { rows, writeSet } = deleteFact(based, "Fact Sales");
    const orders = cubeOf(rows, "Fact Orders");
    expect(orders).toMatchObject({ base_fact_entity_id: null, deleted_at: null });
    expect(new Set(writeSet.events.map((e) => e.change_group_id)).size).toBe(1);
    const back = apply(rows, ok(undo(rows, writeSet)).writeSet);
    expect(entityNamed(back, "Fact Sales").deleted_at).toBeNull();
    expect(cubeOf(back, "Fact Orders").base_fact_entity_id).toBe(entityNamed(back, "Fact Sales").id);
  });

  it("leaves an aggregate deleted in the same write as it is", () => {
    const based = setBase(starRows(), "Fact Orders", "Fact Sales").rows;
    const { writeSet } = deleteFact(based, "Fact Orders");
    expect(writeSet.writes.filter((w) => w.table === "cube_entity")).toHaveLength(1);
  });
});

describe("undo refuses a base that would not hold (F6)", () => {
  it("a cycle someone made meanwhile", () => {
    const set = setBase(starRows(), "Fact Orders", "Fact Sales");
    const cleared = setBase(set.rows, "Fact Orders", null);
    const other = setBase(cleared.rows, "Fact Sales", "Fact Orders").rows;
    expect(undo(other, cleared.writeSet)).toMatchObject({ ok: false, error: { message: AGGREGATE_TEXTS.undoSelf("Fact Orders") } });
  });

  it("a base fact someone deleted meanwhile", () => {
    const set = setBase(starRows(), "Fact Orders", "Fact Sales");
    const cleared = setBase(set.rows, "Fact Orders", null);
    const gone = deleteFact(cleared.rows, "Fact Sales").rows;
    expect(undo(gone, cleared.writeSet)).toMatchObject({ ok: false, error: { message: AGGREGATE_TEXTS.undoDeleted("Fact Orders") } });
  });

  it("an undo that leaves a live base passes", () => {
    const set = setBase(starRows(), "Fact Orders", "Fact Sales");
    const cleared = setBase(set.rows, "Fact Orders", null);
    expect(undo(cleared.rows, cleared.writeSet).ok).toBe(true);
  });
});

describe("the local adapter reads older cube_entity rows in the new shape (F1)", () => {
  let dir: string;
  let file: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "im-types-"));
    file = path.join(dir, "db.json");
    await seedDevData(file, addModuleDemoData);
    // the file as slice 18 left it: `scd_type`, none of the new columns
    const db = (await readDb(file)) as unknown as Rows;
    db.cube_entity = db.cube_entity!.map((r) => {
      const { fact_type, is_factless, base_fact_entity_id, dim_kind, history, snapshot_period, ...rest } = r;
      void [fact_type, is_factless, base_fact_entity_id, dim_kind, snapshot_period];
      return { ...rest, scd_type: r.role === "fact" ? null : ({ keep: 0, overwrite: 1, history: 2 } as Record<string, number>)[history as string] };
    });
    await writeDb(file, db as never);
  });
  afterEach(async () => rm(dir, { recursive: true, force: true }));

  it("lists them converted, and a write to the table passes and stores the new shape", async () => {
    const store = createLocalDataStore(file, STORE_SCHEMA);
    const rows = await store.modules.list(WS, "cube_entity");
    expect(rows.map((r) => [r.role, r.history, r.fact_type, "scd_type" in r])).toEqual([
      ["fact", null, "transaction", false],
      ["dimension", "history", null, false],
      ["dimension", "overwrite", null, false],
      ["dimension", "keep", null, false],
      ["fact", null, "transaction", false],
    ]);
    const date = rows[3]!;
    const r = ok(updateCubeEntity(makeCtx(SEED_USERS.anna.id), modeler(), { cube: date, cubeEntities: rows }, { cubeEntityId: date.id, expectedVersion: date.version, history: "snapshot" }));
    expect(await store.apply(r.writeSet)).toEqual({ ok: true });
    const stored = ((await readDb(file)) as unknown as Rows).cube_entity!;
    expect(stored.some((c) => "scd_type" in c)).toBe(false);
    expect(stored.find((c) => c.id === date.id)).toMatchObject({ history: "snapshot", dim_kind: "standard", version: date.version + 1 });
  });

  it("reads them converted for undo too", async () => {
    const store = createLocalDataStore(file, STORE_SCHEMA);
    const undoRows = (await store.model.loadForUndo(WS)) as unknown as Rows;
    expect(undoRows.cube_entity!.every((c) => !("scd_type" in c) && c.role !== undefined)).toBe(true);
  });
});

describe("an older row's upgrade (F1)", () => {
  const old = { id: "x", workspace_id: ids.ws, entity_id: "e", version: 3, deleted_at: null };
  it("converts a fact and each SCD type, and drops scd_type", () => {
    expect(upgradeCubeEntity({ ...old, role: "fact", grain: "g", scd_type: null })).toEqual({
      ...old, role: "fact", grain: "g", fact_type: "transaction", is_factless: false, base_fact_entity_id: null, dim_kind: null, history: null, snapshot_period: null, has_unknown_member: null,
    });
    for (const [scd, history] of [[0, "keep"], [1, "overwrite"], [2, "history"], [undefined, "overwrite"]] as const) {
      const r = upgradeCubeEntity({ ...old, role: "dimension", grain: null, ...(scd === undefined ? {} : { scd_type: scd }) })!;
      expect(r).toMatchObject({ dim_kind: "standard", history, fact_type: null, is_factless: null, snapshot_period: null });
      expect("scd_type" in r).toBe(false);
    }
  });

  it("leaves a current row alone (idempotent)", () => {
    const current = upgradeCubeEntity({ ...old, role: "dimension", grain: null, scd_type: 2 })!;
    expect(upgradeCubeEntity(current)).toBeNull();
  });
});

describe("slice 19's demo (item 8, answer 6)", () => {
  it("makes Fact Orders an aggregate, Dim Category an outrigger, Dim Order Flags junk and Dim Product a snapshot, once", async () => {
    const { addTypesDemoData, addInfoCubeTypesDemoData } = await import("@/compose/seed");
    const { typeContext, cubeTitle, tabMeta } = await import("@/modules/infocube/domain/view");
    const db = buildSeed() as never as Parameters<typeof addTypesDemoData>[0] & { cube_entity: CubeEntity[] };
    expect(addTypesDemoData(db)).toBe(true);
    expect(addInfoCubeTypesDemoData(db)).toBe(false);
    const rows = db.cube_entity.filter((c) => c.workspace_id === WS);
    const x = typeContext(rows, db.relationship.filter((r) => r.workspace_id === WS), db.entity.filter((e) => e.workspace_id === WS));
    const named = (name: string) => rows.find((c) => c.entity_id === db.entity.find((e) => e.name === name && e.workspace_id === WS)!.id)!;
    expect(["Fact Orders", "Dim Category", "Dim Order Flags", "Dim Product", "Fact Sales"].map((n) => [n, cubeTitle(named(n), x).short, tabMeta(named(n), x)])).toEqual([
      ["Fact Orders", "Fact · Aggregate", "aggregate · grain set"],
      ["Dim Category", "Dimension · Outrigger", "SCD 1 · outrigger"],
      ["Dim Order Flags", "Dimension · Junk", "SCD 1 · junk"],
      ["Dim Product", "Dimension · Snapshot", "Snapshot · Month-end"],
      ["Fact Sales", "Fact", "grain set"],
    ]);
  });
});
