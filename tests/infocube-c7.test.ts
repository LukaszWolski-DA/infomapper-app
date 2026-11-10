// C-7 as Łukasz changed it (4 November 2026) and the cascades of InfoCube's rows (slice 15a step 3), through the domain
// with the composition root's registry: InfoCube is turned off only without facts or dimensions; while it is off no
// create, paste, undo or redo adds or brings back a fact or a dimension; deleting an entity or an attribute takes its
// InfoCube rows along in the same change group, and one undo brings them back. Then the local adapter's own count.

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { STORE_SCHEMA, UNDO_TABLES } from "@/compose";
import { seedDevData } from "@/data/local/dev-data";
import { readDb } from "@/data/local/file";
import { createLocalDataStore } from "@/data/local/store";
import { buildWriteSet, type CommandContext, type CommandResult, type Write, type WriteSet } from "@/domain/changes";
import { deleteAttribute } from "@/domain/commands/attribute";
import { deleteEntity } from "@/domain/commands/entity";
import { cascadingModuleTables, moduleCascade } from "@/domain/commands/module-cascade";
import { revertChangeGroup, type WorkspaceRows } from "@/domain/commands/undo";
import { updateWorkspaceSettings } from "@/domain/commands/workspace";
import { dimensionalCount, INFOCUBE_OFF_MESSAGE, turnOffRefusedMessage } from "@/domain/model/levels";
import { access, attribute, canvas, concept, entity, ids, link, makeCtx, project } from "@/domain/__fixtures__/domain";
import type { Entity, Workspace } from "@/domain/types";
import { createCubeEntity } from "@/modules/infocube/domain/commands";
import type { CubeMeasure } from "@/modules/infocube/domain/types";

type Rows = { -readonly [T in keyof WorkspaceRows]: NonNullable<WorkspaceRows[T]>[number][] };

function seed(): Rows {
  return {
    project: [project(ids.projectA)],
    canvas: [canvas(ids.canvas1)],
    project_canvas: [link(ids.projectA, ids.canvas1)],
    concept: [concept(ids.conceptSales)],
    entity: [entity(ids.salesOrder)],
    attribute: [attribute(ids.orderId)],
    attribute_input: [],
    relationship: [],
    source_system: [],
    source_table: [],
    source_column: [],
    source_relationship: [],
    source_relationship_column: [],
    source_import: [],
    source_change: [],
    mapping: [],
    mapping_input: [],
    canvas_item: [],
    frame: [],
    label: [],
    label_link: [],
    project_pinned_label: [],
    note: [],
    requirement: [],
    requirement_link: [],
    classification: [],
    classification_link: [],
    stereotype: [],
    cube_entity: [],
    cube_measure: [],
  };
}

/** Applies a write set as the adapter does (without its checks). */
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

const ok = <T>(r: CommandResult<T>) => {
  if (!r.ok) throw new Error(r.error.message);
  return r;
};

/** What runCommand does after a command (`withModuleCascades`): InfoCube's rows that follow the deletes, one group. */
function withCascades(ctx: CommandContext, rows: Rows, writeSet: WriteSet): WriteSet {
  const tables = cascadingModuleTables(writeSet.writes, UNDO_TABLES);
  const live = Object.fromEntries(tables.map((t) => [t, ((rows as unknown as Record<string, { deleted_at: string | null }[]>)[t] ?? []).filter((r) => r.deleted_at === null)]));
  const extra = moduleCascade(ctx, writeSet.writes, UNDO_TABLES, live);
  if (!extra.length) return writeSet;
  const rebuilt = buildWriteSet(ctx, ids.ws, [...writeSet.writes, ...extra]);
  return { ...writeSet, writes: rebuilt.writes, events: rebuilt.events.map((e) => ({ ...e, change_group_id: writeSet.changeGroupId })) };
}

const on = { infocube: true };
const KB = { licensed: true, organizationName: "KB" };
const factOf = (rows: Rows) => rows.entity.find((e) => e.model_level === "dimensional")!;

/** The seed with one fact (made by InfoCube's command), and its attribute `amount` as a measure. */
function withFact() {
  const ctx = makeCtx();
  const made = ok(createCubeEntity(ctx, access("modeler", on), { concept: concept(ids.conceptSales), entities: seed().entity, canvas: null }, "fact", { conceptId: ids.conceptSales }));
  let rows = apply(seed(), made.writeSet);
  const fact = factOf(rows);
  const amount = attribute("01900000-0000-7000-8000-0000000e0001", { entity_id: fact.id, name: "amount" });
  const measure: CubeMeasure = {
    id: "01900000-0000-7000-8000-0000000e0002",
    workspace_id: ids.ws,
    version: 1,
    created_at: ctx.now,
    created_by: ids.actor,
    updated_at: ctx.now,
    updated_by: ids.actor,
    deleted_at: null,
    attribute_id: amount.id,
    additivity: "additive",
    semi_note: null,
  };
  rows = apply(rows, buildWriteSet(ctx, ids.ws, [{ kind: "insert", table: "attribute", row: amount }, { kind: "insert", table: "cube_measure", row: measure }] as Write[]));
  return { rows, made, fact, amount, measure };
}

const deleteFact = (rows: Rows, fact: Entity, ctx = makeCtx()) =>
  withCascades(
    ctx,
    rows,
    ok(deleteEntity(ctx, access("modeler", on), { entity: fact, attributes: rows.attribute, mappings: [], mappingInputs: [], attributeInputs: [], relationships: [], canvasItems: [], entities: rows.entity }, { entityId: fact.id, expectedVersion: fact.version })).writeSet,
  );

const turnOff = (rows: Rows, ws: Partial<Workspace> = on) =>
  updateWorkspaceSettings(makeCtx(), access("owner", ws), { workspaceId: ids.ws, expectedVersion: 3, infocube: false }, { ...KB, dimensionalEntities: dimensionalCount(rows.entity, ids.ws) });

describe("turning InfoCube off (C-7, 4 November 2026)", () => {
  it("is refused with one fact, and allowed once it is deleted", () => {
    const { rows, fact } = withFact();
    expect(turnOff(rows)).toMatchObject({ ok: false, error: { code: "invalid", message: turnOffRefusedMessage(1) } });
    expect(turnOffRefusedMessage(1)).toBe("InfoCube can be turned off only when this workspace has no facts or dimensions. It has 1: delete them first.");

    const afterDelete = apply(rows, deleteFact(rows, fact));
    const off = ok(turnOff(afterDelete));
    expect(off.value.workspace.infocube).toBe(false);
  });
});

describe("deleting takes InfoCube's rows along (X-4, E14)", () => {
  it("soft-deletes the fact's cube_entity and its attributes' cube_measure in the same change group", () => {
    const { rows, fact, measure } = withFact();
    const del = deleteFact(rows, fact);
    const cube = rows.cube_entity!.find((c) => c.entity_id === fact.id)!;
    const deleted = del.writes.filter((w) => w.kind === "update" && (w.row as { deleted_at: unknown }).deleted_at !== null).map((w) => `${w.table}:${(w as unknown as { row: { id: string } }).row.id}`);
    expect(deleted).toEqual(expect.arrayContaining([`entity:${fact.id}`, `cube_entity:${cube.id}`, `cube_measure:${measure.id}`]));
    expect(new Set(del.events.map((e) => e.change_group_id))).toEqual(new Set([del.changeGroupId]));
    // nothing else of InfoCube's is written, and a logical entity's delete takes nothing of InfoCube's
    const logical = rows.entity.find((e) => e.id === ids.salesOrder)!;
    const plain = withCascades(makeCtx(), rows, ok(deleteEntity(makeCtx(), access("modeler", on), { entity: logical, attributes: rows.attribute, mappings: [], mappingInputs: [], attributeInputs: [], relationships: [], canvasItems: [] }, { entityId: logical.id, expectedVersion: logical.version })).writeSet);
    expect(plain.writes.some((w) => w.table.startsWith("cube_"))).toBe(false);
  });

  it("soft-deletes a measure's cube_measure with its attribute", () => {
    const { rows, amount, measure } = withFact();
    const ctx = makeCtx();
    const del = withCascades(ctx, rows, ok(deleteAttribute(ctx, access("modeler", on), { attribute: amount, mappings: [], mappingInputs: [], attributeInputs: [] }, { attributeId: amount.id, expectedVersion: amount.version })).writeSet);
    expect(del.writes.map((w) => w.table)).toEqual(["attribute", "cube_measure"]);
    expect((del.writes[1] as { row: CubeMeasure }).row).toMatchObject({ id: measure.id, deleted_at: ctx.now, version: 2 });
  });

  it("brings everything back with one undo, with InfoCube on", () => {
    const { rows, fact, measure } = withFact();
    const del = deleteFact(rows, fact);
    const afterDelete = apply(rows, del);
    const undone = ok(revertChangeGroup(makeCtx(), access("modeler", on), { events: del.events, rows: afterDelete }, "undo", UNDO_TABLES));
    const back = apply(afterDelete, undone.writeSet);
    expect(back.entity.find((e) => e.id === fact.id)!.deleted_at).toBeNull();
    expect(back.cube_entity!.find((c) => c.entity_id === fact.id)).toMatchObject({ deleted_at: null, role: "fact" });
    expect(back.cube_measure!.find((m) => m.id === measure.id)!.deleted_at).toBeNull();
  });
});

describe("while InfoCube is off nothing adds or brings back a fact or dimension (C-7)", () => {
  it("refuses the undo of the fact's delete, and lets it through once InfoCube is on again", () => {
    const { rows, fact } = withFact();
    const del = deleteFact(rows, fact);
    const afterDelete = apply(rows, del);
    const off = { infocube: false };
    expect(revertChangeGroup(makeCtx(), access("modeler", off), { events: del.events, rows: afterDelete }, "undo", UNDO_TABLES)).toMatchObject({
      ok: false,
      error: { code: "forbidden", message: INFOCUBE_OFF_MESSAGE },
    });
    expect(revertChangeGroup(makeCtx(), access("modeler", on), { events: del.events, rows: afterDelete }, "undo", UNDO_TABLES).ok).toBe(true);
  });

  it("lets the undo of a fact's create through (it deletes), and refuses its redo", () => {
    const { made } = withFact();
    const created = apply(seed(), made.writeSet);
    const undone = ok(revertChangeGroup(makeCtx(), access("modeler", { infocube: false }), { events: made.writeSet.events, rows: created }, "undo", UNDO_TABLES));
    const afterUndo = apply(created, undone.writeSet);
    expect(factOf(afterUndo).deleted_at).not.toBeNull();
    expect(revertChangeGroup(makeCtx(), access("modeler", { infocube: false }), { events: undone.writeSet.events, rows: afterUndo }, "redo", UNDO_TABLES)).toMatchObject({
      ok: false,
      error: { message: INFOCUBE_OFF_MESSAGE },
    });
  });

  it("refuses New fact and New dimension", () => {
    for (const role of ["fact", "dimension"] as const) {
      expect(createCubeEntity(makeCtx(), access("modeler"), { concept: concept(ids.conceptSales), entities: [], canvas: null }, role, { conceptId: ids.conceptSales })).toMatchObject({
        ok: false,
        error: { code: "forbidden", message: INFOCUBE_OFF_MESSAGE },
      });
    }
  });
});

// ---- the local adapter's own count (a create and a turn-off that each read the state before the other wrote) ----

let dir: string;
let file: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "infomapper-c7-"));
  file = path.join(dir, "dev-db.json");
  await seedDevData(file);
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("the local adapter keeps C-7 (slice 15a)", () => {
  it("refuses a fact in a workspace with InfoCube off, and turning InfoCube off over a fact", async () => {
    const db = await readDb(file);
    const ws = db.workspace[0]!;
    const by = db.app_user[0]!.id;
    const ctx = makeCtx(by);
    const conceptId = db.concept.find((c) => c.workspace_id === ws.id)!.id;
    const base = { workspace_id: ws.id, version: 1, created_at: ctx.now, created_by: by, updated_at: ctx.now, updated_by: by, deleted_at: null };
    const fact: Entity = { ...base, id: "01900000-0000-7000-8000-0000000f0001", concept_id: conceptId, name: "Fact Sales", alias: null, model_level: "dimensional", stereotype: "object", definition_html: null, definition_text: null };
    const store = createLocalDataStore(file, STORE_SCHEMA);
    const insert = () => buildWriteSet(ctx, ws.id, [{ kind: "insert", table: "entity", row: fact }] as Write[]);

    const before = await readFile(file, "utf8");
    expect(await store.apply(insert())).toMatchObject({ ok: false, error: { code: "forbidden", message: INFOCUBE_OFF_MESSAGE } });
    expect(await readFile(file, "utf8")).toBe(before);

    // with InfoCube on the fact is stored; turning it off over the fact is refused with the count
    await writeFile(file, JSON.stringify({ ...db, workspace: db.workspace.map((w) => (w.id === ws.id ? { ...w, infocube: true } : w)) }), "utf8");
    expect(await store.apply(insert())).toEqual({ ok: true });
    const current = (await readDb(file)).workspace.find((w) => w.id === ws.id)!;
    const offRow = { ...current, infocube: false, version: current.version + 1 };
    expect(await store.apply(buildWriteSet(ctx, ws.id, [{ kind: "update", table: "workspace", before: current, row: offRow }] as Write[]))).toMatchObject({
      ok: false,
      error: { code: "invalid", message: turnOffRefusedMessage(1) },
    });
  });
});
