// InfoCube's dimensional mappings in the change groups (slice 15c step 2, M1, Q-5, X2): the star's 20 mappings; a
// mapping goes with its target, and whole when one of its inputs goes with its logical attribute, in the same change
// group, through the composition root's registry; one undo brings everything back and redo deletes it again. An input
// removed on purpose leaves its mapping. The store's rules for both tables.

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { STORE_SCHEMA, UNDO_TABLES } from "@/compose";
import { addModuleDemoData } from "@/compose/seed";
import { readDb } from "@/data/local/file";
import { DEV_DB_FORMAT, findViolation, type DevDb } from "@/data/local/schema";
import { buildSeed, SEED_IDS } from "@/data/local/seed";
import { buildWriteSet, type CommandContext, type CommandResult, type Write, type WriteSet } from "@/domain/changes";
import { deleteAttribute } from "@/domain/commands/attribute";
import { deleteEntity } from "@/domain/commands/entity";
import { cascadingModuleTables, moduleCascade } from "@/domain/commands/module-cascade";
import { revertChangeGroup, type WorkspaceRows } from "@/domain/commands/undo";
import { makeCtx, member, workspace } from "@/domain/__fixtures__/domain";
import type { WorkspaceAccess } from "@/domain/permissions";
import type { CubeMapping, CubeMappingInput } from "@/modules/infocube/domain/types";

const WS = SEED_IDS.wsRetailDwh;
type Rows = Record<string, Record<string, unknown>[]>;
type Named = { id: string; version: number; name: string; entity_id: string };

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

/** `withModuleCascades` without the store. */
function withCascades(ctx: CommandContext, rows: Rows, writeSet: WriteSet): WriteSet {
  const tables = cascadingModuleTables(writeSet.writes, UNDO_TABLES);
  const live = Object.fromEntries(tables.map((t) => [t, (rows[t] ?? []).filter((r) => r.deleted_at === null)]));
  const extra = moduleCascade(ctx, writeSet.writes, UNDO_TABLES, live);
  if (!extra.length) return writeSet;
  const rebuilt = buildWriteSet(ctx, WS, [...writeSet.writes, ...extra]);
  return { ...writeSet, writes: rebuilt.writes, events: rebuilt.events.map((e) => ({ ...e, change_group_id: writeSet.changeGroupId })) };
}

const modeler = (): WorkspaceAccess => ({ workspace: workspace({ id: WS, infocube: true }), member: member("modeler", { workspace_id: WS }) });
const entityNamed = (rows: Rows, name: string) => rows.entity!.find((e) => e.name === name && e.deleted_at === null) as never as Named;
const attributeOf = (rows: Rows, entity: string, name: string) =>
  rows.attribute!.find((a) => a.entity_id === entityNamed(rows, entity).id && a.name === name) as never as Named;
const mappings = (rows: Rows) => (rows.cube_mapping ?? []) as unknown as CubeMapping[];
const inputs = (rows: Rows) => (rows.cube_mapping_input ?? []) as unknown as CubeMappingInput[];
const live = <T extends { deleted_at: string | null }>(list: T[]) => list.filter((r) => r.deleted_at === null);
const mappingOnto = (rows: Rows, entity: string, name: string) => mappings(rows).find((m) => m.attribute_id === attributeOf(rows, entity, name).id)!;
const deletedIn = (writeSet: WriteSet, table: string) =>
  writeSet.writes.filter((w) => w.table === table && w.kind === "update" && (w.row as { deleted_at: unknown }).deleted_at !== null).map((w) => (w as unknown as { row: { id: string } }).row.id).sort();

const isLive = (r: Record<string, unknown>) => r.deleted_at === null;

function deleteAttr(rows: Rows, a: Named): WriteSet {
  const ctx = makeCtx();
  const mine = (rows.mapping ?? []).filter((m) => m.attribute_id === a.id && m.deleted_at === null);
  const mineInputs = (rows.mapping_input ?? []).filter((i) => mine.some((m) => m.id === i.mapping_id) && i.deleted_at === null);
  const links = { labelLinks: (rows.label_link ?? []).filter(isLive) as never, requirementLinks: (rows.requirement_link ?? []).filter(isLive) as never };
  return withCascades(ctx, rows, ok(deleteAttribute(ctx, modeler(), { attribute: a as never, mappings: mine as never, mappingInputs: mineInputs as never, attributeInputs: [], ...links }, { attributeId: a.id, expectedVersion: a.version })).writeSet);
}

const undo = (after: Rows, step: WriteSet) => ok(revertChangeGroup(makeCtx(), modeler(), { events: step.events, rows: after as unknown as WorkspaceRows }, "undo", UNDO_TABLES)).writeSet;

describe("the star's dimensional mappings (slice 15c, prototype `cubeDemo`, `cubeDemoV2`)", () => {
  it("has the prototype's 20 mappings: their statuses, kinds, inputs and the unfed attributes", () => {
    const rows = starRows();
    expect(mappings(rows)).toHaveLength(20);
    expect(mappings(rows).filter((m) => m.status !== "approved").map((m) => [m.status, m.note !== null])).toEqual([["review", false], ["draft", true], ["draft", false]]);
    expect(mappings(rows).every((m) => (m.status === "approved") === (m.approved_at !== null && m.approved_by !== null))).toBe(true);
    const net = mappingOnto(rows, "Fact Sales", "net_amount");
    expect(net).toMatchObject({ kind: "transform", status: "review" });
    expect(inputs(rows).filter((i) => i.mapping_id === net.id).sort((a, b) => a.sort_order - b.sort_order).map((i) => rows.attribute!.find((a) => a.id === i.attribute_id)!.name)).toEqual(["quantity", "unit_price", "discount_pct"]);
    // IC-10's figures: Order Line feeds six mappings, four of them approved
    const line = entityNamed(rows, "Order Line");
    const fromLine = new Set(inputs(rows).filter((i) => rows.attribute!.some((a) => a.id === i.attribute_id && a.entity_id === line.id)).map((i) => i.mapping_id));
    expect(fromLine.size).toBe(6);
    expect(mappings(rows).filter((m) => fromLine.has(m.id) && m.status === "approved")).toHaveLength(4);
    // unfed: Dim Date, the dimensions' keys, ship_date_key
    const fed = new Set(mappings(rows).map((m) => m.attribute_id));
    for (const [e, a] of [["Dim Date", "month"], ["Dim Customer", "customer_key"], ["Dim Product", "product_key"], ["Fact Sales", "ship_date_key"]] as const) {
      expect(fed.has(attributeOf(rows, e, a).id), `${e}.${a}`).toBe(false);
    }
    // every input reads a logical attribute, every target is dimensional
    const levelOf = (attributeId: string) => rows.entity!.find((e) => e.id === rows.attribute!.find((a) => a.id === attributeId)!.entity_id)!.model_level;
    expect(new Set(inputs(rows).map((i) => levelOf(i.attribute_id)))).toEqual(new Set(["logical"]));
    expect(new Set(mappings(rows).map((m) => levelOf(m.attribute_id)))).toEqual(new Set(["dimensional"]));
  });
});

describe("Q-5: a mapping goes whole when one of its inputs goes with its attribute (X2)", () => {
  it("deleting Order Line.quantity takes its direct mapping and net_amount's three-input mapping, whole; undo brings all back; redo again", () => {
    const rows = starRows();
    const quantity = attributeOf(rows, "Order Line", "quantity");
    const net = mappingOnto(rows, "Fact Sales", "net_amount");
    const direct = mappingOnto(rows, "Fact Sales", "quantity");
    const del = deleteAttr(rows, quantity);
    expect(deletedIn(del, "cube_mapping")).toEqual([net.id, direct.id].sort());
    expect(deletedIn(del, "cube_mapping_input")).toEqual(inputs(rows).filter((i) => i.mapping_id === net.id || i.mapping_id === direct.id).map((i) => i.id).sort());
    expect(new Set(del.events.map((e) => e.change_group_id))).toEqual(new Set([del.changeGroupId]));
    // the targets stay, unfed
    const after = apply(rows, del);
    expect(after.attribute!.find((a) => a.id === net.attribute_id)!.deleted_at).toBeNull();
    expect(live(mappings(after))).toHaveLength(18);

    const undone = undo(after, del);
    const back = apply(after, undone);
    expect(live(mappings(back))).toHaveLength(20);
    expect(live(inputs(back))).toHaveLength(inputs(rows).length);

    const redone = ok(revertChangeGroup(makeCtx(), modeler(), { events: undone.events, rows: back as unknown as WorkspaceRows }, "redo", UNDO_TABLES)).writeSet;
    expect(live(mappings(apply(back, redone)))).toHaveLength(18);
  });

  it("deleting the target Dim Customer.city takes its mapping and its input; Customer Address.city stays", () => {
    const rows = starRows();
    const city = attributeOf(rows, "Dim Customer", "city");
    const mapping = mappingOnto(rows, "Dim Customer", "city");
    const del = deleteAttr(rows, city);
    expect(deletedIn(del, "cube_mapping")).toEqual([mapping.id]);
    expect(deletedIn(del, "cube_mapping_input")).toEqual(inputs(rows).filter((i) => i.mapping_id === mapping.id).map((i) => i.id));
    expect(del.writes.some((w) => w.table === "attribute" && (w.row as { id: string }).id === attributeOf(rows, "Customer Address", "city").id)).toBe(false);
  });

  it("deleting Order Line takes its six mappings whole, in one change group, and one undo brings them back", () => {
    const rows = starRows();
    const line = entityNamed(rows, "Order Line");
    const ctx = makeCtx();
    const of = (t: string) => (rows[t] ?? []).filter(isLive);
    const model = {
      entity: line, entities: of("entity"), attributes: of("attribute").filter((a) => a.entity_id === line.id), relationships: of("relationship"),
      mappings: of("mapping"), mappingInputs: of("mapping_input"), attributeInputs: of("attribute_input"), canvasItems: of("canvas_item"), notes: of("note"),
      labelLinks: of("label_link"), requirementLinks: of("requirement_link"),
    };
    const result = deleteEntity(ctx, modeler(), model as never, { entityId: line.id, expectedVersion: (line as unknown as { version: number }).version });
    const del = withCascades(ctx, rows, ok(result).writeSet);
    expect(deletedIn(del, "cube_mapping")).toHaveLength(6);
    const after = apply(rows, del);
    expect(live(mappings(after))).toHaveLength(14);
    expect(live(mappings(apply(after, undo(after, del))))).toHaveLength(20);
  });

  it("an input removed on purpose leaves its mapping", () => {
    const rows = starRows();
    const net = mappingOnto(rows, "Fact Sales", "net_amount");
    const input = inputs(rows).find((i) => i.mapping_id === net.id && i.sort_order === 2)!;
    const ctx = makeCtx();
    const removed = buildWriteSet(ctx, WS, [{ kind: "update", table: "cube_mapping_input", before: input, row: { ...input, deleted_at: ctx.now, version: input.version + 1 } } as unknown as Write]);
    expect(withCascades(ctx, rows, { ...removed, changeGroupId: removed.events[0]!.change_group_id } as WriteSet).writes).toHaveLength(1);
  });
});

describe("the store's rules for the dimensional mappings", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "infocube-mappings-"));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("reads the star's file at the current format with no violation; a second live input of one attribute and an approval without its date are refused", async () => {
    const db = buildSeed() as DevDb & Record<string, unknown[]>;
    addModuleDemoData(db as never);
    const file = path.join(dir, "db.json");
    await writeFile(file, JSON.stringify({ ...db, format: DEV_DB_FORMAT }), "utf8");
    const onDisk = (await readDb(file)) as unknown as Record<string, Record<string, unknown>[]>;
    expect(onDisk.cube_mapping).toHaveLength(20);
    expect(findViolation(onDisk as never, undefined, STORE_SCHEMA)).toBeNull();

    const input = onDisk.cube_mapping_input![0]!;
    const twice = { ...onDisk, cube_mapping_input: [...onDisk.cube_mapping_input!, { ...input, id: "01900000-0000-7000-8000-0000000e0001" }] };
    expect(findViolation(twice as never, undefined, STORE_SCHEMA)).toMatchObject({ table: "cube_mapping_input" });
    const mapping = onDisk.cube_mapping!.find((m) => m.status === "approved")!;
    const undated = { ...onDisk, cube_mapping: onDisk.cube_mapping!.map((m) => (m.id === mapping.id ? { ...m, approved_at: null } : m)) };
    expect(findViolation(undated as never, undefined, STORE_SCHEMA)).toMatchObject({ table: "cube_mapping" });
  });
});
