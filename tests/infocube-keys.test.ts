// InfoCube's key links in the change groups (slice 15b step 2, role-playing RP-B, RP-07, RP-08): a link goes with its
// relationship or its attribute in the same change group, through the composition root's registry, and one undo brings
// both back. An attribute that stops being a foreign key leaves its link in place (R3: inactive, nothing deletes it). The
// store's rules for `cube_key`, and what the format-13 upgrade does with a 15a file's InfoCube rows (nothing; R6).

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { STORE_SCHEMA, UNDO_TABLES } from "@/compose";
import { addModuleDemoData } from "@/compose/seed";
import { seedDevData } from "@/data/local/dev-data";
import { readDb } from "@/data/local/file";
import { DEV_DB_FORMAT, findViolation, type DevDb } from "@/data/local/schema";
import { buildSeed, SEED_IDS } from "@/data/local/seed";
import { buildWriteSet, type CommandContext, type CommandResult, type WriteSet } from "@/domain/changes";
import { deleteAttribute, updateAttribute } from "@/domain/commands/attribute";
import { cascadingModuleTables, moduleCascade } from "@/domain/commands/module-cascade";
import { deleteRelationship } from "@/domain/commands/relationship";
import { revertChangeGroup, type WorkspaceRows } from "@/domain/commands/undo";
import { makeCtx, member, workspace } from "@/domain/__fixtures__/domain";
import type { WorkspaceAccess } from "@/domain/permissions";
import { addKey, linkKey, type KeyState } from "@/modules/infocube/domain/commands";
import { cubeIndex } from "@/modules/infocube/domain/keys";
import type { CubeKey } from "@/modules/infocube/domain/types";

const WS = SEED_IDS.wsRetailDwh;
type Rows = Record<string, Record<string, unknown>[]>;

/** The Retail Co – DWH workspace's rows of the seed with the star, as undo reads them. */
function starRows(): Rows {
  const db = buildSeed() as unknown as Rows;
  addModuleDemoData(db as never);
  return Object.fromEntries(Object.entries(db).filter(([k]) => Array.isArray(db[k])).map(([k, rows]) => [k, rows.filter((r) => r.workspace_id === WS)]));
}

/** Applies a write set as the adapter does (without its checks). */
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

/** What runCommand does after a command (`withModuleCascades`): the module rows that follow the deletes, one group. */
function withCascades(ctx: CommandContext, rows: Rows, writeSet: WriteSet): WriteSet {
  const tables = cascadingModuleTables(writeSet.writes, UNDO_TABLES);
  const live = Object.fromEntries(tables.map((t) => [t, (rows[t] ?? []).filter((r) => r.deleted_at === null)]));
  const extra = moduleCascade(ctx, writeSet.writes, UNDO_TABLES, live);
  if (!extra.length) return writeSet;
  const rebuilt = buildWriteSet(ctx, WS, [...writeSet.writes, ...extra]);
  return { ...writeSet, writes: rebuilt.writes, events: rebuilt.events.map((e) => ({ ...e, change_group_id: writeSet.changeGroupId })) };
}

/** A modeler of Retail Co – DWH with InfoCube on (the fixtures' workspace and member, moved to the star's workspace). */
const modeler = (): WorkspaceAccess => ({ workspace: workspace({ id: WS, infocube: true }), member: member("modeler", { workspace_id: WS }) });
const shipDate = (rows: Rows) => rows.relationship!.find((r) => r.from_role === "Ship date") as never as { id: string; version: number };
const linkOf = (rows: Rows, relationshipId: string) => (rows.cube_key as unknown as CubeKey[]).find((k) => k.relationship_id === relationshipId)!;
const deletedIn = (writeSet: WriteSet) =>
  writeSet.writes.filter((w) => w.kind === "update" && (w.row as { deleted_at: unknown }).deleted_at !== null).map((w) => `${w.table}:${(w as unknown as { row: { id: string } }).row.id}`);

describe("a key link goes with its relationship or its attribute (RP-B, RP-07, RP-08)", () => {
  it("is soft-deleted with its relationship in the same change group, and one undo brings both back", () => {
    const rows = starRows();
    const rel = shipDate(rows);
    const link = linkOf(rows, rel.id);
    const ctx = makeCtx();
    const del = withCascades(ctx, rows, ok(deleteRelationship(ctx, modeler(), { relationship: rel as never }, { relationshipId: rel.id, expectedVersion: rel.version })).writeSet);
    expect(deletedIn(del)).toEqual([`relationship:${rel.id}`, `cube_key:${link.id}`]);
    expect(new Set(del.events.map((e) => e.change_group_id))).toEqual(new Set([del.changeGroupId]));

    const after = apply(rows, del);
    const undone = ok(revertChangeGroup(makeCtx(), modeler(), { events: del.events, rows: after as unknown as WorkspaceRows }, "undo", UNDO_TABLES));
    const back = apply(after, undone.writeSet);
    expect(back.relationship!.find((r) => r.id === rel.id)!.deleted_at).toBeNull();
    expect(linkOf(back, rel.id)).toMatchObject({ id: link.id, attribute_id: link.attribute_id, deleted_at: null });
  });

  it("is soft-deleted with its attribute; the relationship stays", () => {
    const rows = starRows();
    const rel = shipDate(rows);
    const link = linkOf(rows, rel.id);
    const key = rows.attribute!.find((a) => a.id === link.attribute_id) as never as { id: string; version: number; name: string };
    expect(key.name).toBe("ship_date_key");
    const ctx = makeCtx();
    const del = withCascades(ctx, rows, ok(deleteAttribute(ctx, modeler(), { attribute: key as never, mappings: [], mappingInputs: [] }, { attributeId: key.id, expectedVersion: key.version })).writeSet);
    expect(deletedIn(del)).toEqual([`attribute:${key.id}`, `cube_key:${link.id}`]);
    expect(del.writes.some((w) => w.table === "relationship")).toBe(false);
  });

  it("stays when its attribute's foreign key flag is cleared (R3: inactive, not deleted)", () => {
    const rows = starRows();
    const link = linkOf(rows, shipDate(rows).id);
    const key = rows.attribute!.find((a) => a.id === link.attribute_id) as never as { id: string; version: number };
    const ctx = makeCtx();
    const cleared = withCascades(ctx, rows, ok(updateAttribute(ctx, modeler(), { attribute: key as never, attributes: rows.attribute as never }, { attributeId: key.id, expectedVersion: key.version, isForeignKey: false })).writeSet);
    expect(cleared.writes.map((w) => w.table)).toEqual(["attribute"]);
    // the panels read it as no key while the flag is off, and as the key again once it is back (RP-06 with R3)
    const after = apply(rows, cleared);
    expect(cubeIndex(keyState(after)).keyOf(shipDate(after).id)).toBeNull();
    const back = apply(after, ok(revertChangeGroup(makeCtx(), modeler(), { events: cleared.events, rows: after as unknown as WorkspaceRows }, "undo", UNDO_TABLES)).writeSet);
    expect(cubeIndex(keyState(back)).keyOf(shipDate(back).id)?.name).toBe("ship_date_key");
  });
});

/** The model and InfoCube's rows a key command reads. */
const keyState = (rows: Rows): KeyState =>
  ({ entities: rows.entity, attributes: rows.attribute, relationships: rows.relationship, cubeEntities: rows.cube_entity, cubeMeasures: rows.cube_measure, cubeKeys: rows.cube_key }) as unknown as KeyState;

describe("Add key and a key's link in undo and redo (R-3, RP-04)", () => {
  it("adds the key, renumbers and links it in one change group; one undo removes the attribute and the link, the role stays; redo brings both", () => {
    // Fact Sales' Ship date relationship without its link: Add key makes ship_date_key_2 (ship_date_key is taken)
    const start = starRows();
    const rel = shipDate(start);
    const unlinked = ok(linkKey(makeCtx(), modeler(), keyState(start), { relationshipId: rel.id, currentKeyId: linkOf(start, rel.id).id, attributeId: null }));
    const rows = apply(start, unlinked.writeSet);
    const ctx = makeCtx();
    const added = ok(addKey(ctx, modeler(), keyState(rows), { relationshipId: rel.id, currentKeyId: null }));
    expect(added.value.name).toBe("ship_date_key_2");
    const groups = new Set(added.writeSet.events.map((e) => e.change_group_id));
    expect(groups).toEqual(new Set([added.writeSet.changeGroupId]));
    const after = apply(rows, added.writeSet);
    // Fact Sales' attributes in their order: the new key after the last key attribute, the rest renumbered
    const factId = (rows.attribute!.find((a) => a.name === "ship_date_key") as { entity_id: string }).entity_id;
    const order = (r: Rows) =>
      (r.attribute as unknown as { entity_id: string; name: string; sort_order: number; deleted_at: string | null }[])
        .filter((a) => a.entity_id === factId && a.deleted_at === null)
        .sort((x, y) => x.sort_order - y.sort_order)
        .map((a) => `${a.sort_order}:${a.name}`);
    const before = order(rows);
    const keys = before.filter((n) => /_key/.test(n)).length;
    expect(order(after)).toEqual([...before.slice(0, keys), `${keys}:ship_date_key_2`, ...before.slice(keys).map((n) => n.replace(/^\d+/, (d) => String(Number(d) + 1)))]);
    expect(cubeIndex(keyState(after)).keyOf(rel.id)?.name).toBe("ship_date_key_2");

    const undone = ok(revertChangeGroup(makeCtx(), modeler(), { events: added.writeSet.events, rows: after as unknown as WorkspaceRows }, "undo", UNDO_TABLES));
    const back = apply(after, undone.writeSet);
    expect(back.attribute!.find((a) => a.id === added.value.attributeId)!.deleted_at).not.toBeNull();
    expect((back.cube_key as unknown as CubeKey[]).find((k) => k.id === added.value.keyId)!.deleted_at).not.toBeNull();
    expect(order(back)).toEqual(before);
    expect(shipDate(back)).toBeTruthy(); // the relationship and its role stay
    expect(cubeIndex(keyState(back)).keyOf(rel.id)).toBeNull();

    const redone = apply(back, ok(revertChangeGroup(makeCtx(), modeler(), { events: undone.writeSet.events, rows: back as unknown as WorkspaceRows }, "redo", UNDO_TABLES)).writeSet);
    expect(cubeIndex(keyState(redone)).keyOf(rel.id)?.name).toBe("ship_date_key_2");
  });
});

// ---- the local file: the store's rules, and the format-13 upgrade of a 15a file with the star ----

let dir: string;
let file: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "infomapper-keys-"));
  file = path.join(dir, "dev-db.json");
  await seedDevData(file, addModuleDemoData);
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

type FileDb = DevDb & { cube_entity: unknown[]; cube_measure: unknown[]; cube_key: CubeKey[] };
const without = (row: object, columns: readonly string[]) => Object.fromEntries(Object.entries(row).filter(([k]) => !columns.includes(k)));

describe("the store's rules for key links (RP-B)", () => {
  it("refuses a second live link of one relationship or of one attribute, allows one after a deleted one", async () => {
    const db = (await readDb(file)) as FileDb;
    expect(db.cube_key).toHaveLength(6);
    expect(findViolation(db, undefined, STORE_SCHEMA)).toBeNull();
    const [first] = db.cube_key;
    const id = "01900000-0000-7000-8000-0000000c0b01";
    const freeAttribute = db.attribute.find((a) => !db.cube_key.some((k) => k.attribute_id === a.id))!.id;
    const freeRelationship = db.relationship.find((r) => !db.cube_key.some((k) => k.relationship_id === r.id))!.id;
    const sameRelationship = { ...first!, id, attribute_id: freeAttribute };
    const sameAttribute = { ...first!, id, relationship_id: freeRelationship };
    const withKey = (keys: CubeKey[]) => findViolation({ ...db, cube_key: keys } as DevDb, undefined, STORE_SCHEMA);
    expect(withKey([...db.cube_key, sameRelationship])).toMatchObject({ kind: "unique", table: "cube_key" });
    expect(withKey([...db.cube_key, sameAttribute])).toMatchObject({ kind: "unique", table: "cube_key" });
    // the old link deleted: a new one for its relationship is fine
    const ended = db.cube_key.map((k) => (k.id === first!.id ? { ...k, deleted_at: "2026-11-04T00:00:00.000Z" } : k));
    expect(withKey([...ended, sameRelationship])).toBeNull();
    // a link to a relationship that does not exist is refused (the foreign key)
    expect(withKey([...ended, { ...sameRelationship, relationship_id: "01900000-0000-7000-8000-0000000c0bff" }])).toMatchObject({ kind: "foreign_key", table: "cube_key" });
  });
});

describe("the format-13 upgrade of a 15a file with the star (R6)", () => {
  it("adds the null roles and leaves InfoCube's rows as they were: no key link is made by name", async () => {
    const db = (await readDb(file)) as FileDb;
    // the file as slice 15a wrote it: format 12, no roles, no key links (15a's star had neither)
    const old = { ...without(db, ["cube_key"]), format: 12, relationship: db.relationship.map((r) => without(r, ["from_role", "to_role"])) } as unknown as FileDb;
    await writeFile(file, JSON.stringify(old), "utf8");
    const upgraded = (await readDb(file)) as FileDb;
    expect(upgraded.format).toBe(DEV_DB_FORMAT);
    expect(upgraded.relationship.every((r) => r.from_role === null && r.to_role === null)).toBe(true);
    expect(upgraded.cube_entity).toEqual(old.cube_entity);
    expect(upgraded.cube_measure).toEqual(old.cube_measure);
    expect("cube_key" in upgraded).toBe(false);
  });
});
