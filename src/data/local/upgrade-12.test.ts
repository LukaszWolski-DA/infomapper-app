// The local data file's upgrade from format 11 to 12 (slice 15a, item 7; S15-02): every entity gets `model_level`
// logical, every workspace `infocube` false, and the file an empty `organization_licence`; nothing else changes, no
// change event and no log line; the file is written back at once, and a file at format 12 is read as it is (the upgrade
// is not repeated). A module's tables are not part of the format (AD-33): the upgraded file has none.

import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seedDevData } from "./dev-data";
import { readDb } from "./file";
import { DEV_DB_FORMAT, findViolation, type DevDb } from "./schema";

let dir: string;
let file: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "infomapper-upgrade12-"));
  file = path.join(dir, "dev-db.json");
  await seedDevData(file);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(dir, { recursive: true, force: true });
});

const without = (row: object, columns: readonly string[]) => Object.fromEntries(Object.entries(row).filter(([k]) => !columns.includes(k)));

/** The seeded file as slices 11 to 14b wrote it: format 11, without the slice's columns and table. */
async function asFormat11(): Promise<DevDb> {
  const db = await readDb(file);
  const old = {
    ...without(db, ["organization_licence"]),
    format: 11,
    entity: db.entity.map((e) => without(e, ["model_level"])),
    workspace: db.workspace.map((w) => without(w, ["infocube"])),
  };
  await writeFile(file, JSON.stringify(old), "utf8");
  return db;
}

const counts = (db: DevDb) => Object.fromEntries(Object.entries(db).filter(([k]) => k !== "format").map(([k, rows]) => [k, (rows as unknown[]).length]));

describe("the upgrade to format 12 (slice 15a, S15-02)", () => {
  it("makes every entity logical and every workspace's InfoCube off, with no licences, keeping every row and count", async () => {
    const db = await asFormat11();
    expect(db.entity.length && db.workspace.length).toBeGreaterThan(0);
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    const upgraded = await readDb(file);
    expect(upgraded.format).toBe(DEV_DB_FORMAT);
    expect(DEV_DB_FORMAT).toBe(12);
    expect(upgraded.entity.every((e) => e.model_level === "logical")).toBe(true);
    expect(upgraded.workspace.every((w) => w.infocube === false)).toBe(true);
    expect(upgraded.organization_licence).toEqual([]);
    expect(counts(upgraded)).toEqual(counts(db));
    // no change event, no log line, no module table
    expect(upgraded.change_event).toEqual(db.change_event);
    expect(log).not.toHaveBeenCalled();
    expect(Object.keys(upgraded).filter((k) => k.startsWith("cube_"))).toEqual([]);
    // nothing else changed
    expect(upgraded).toEqual(db);
    expect(findViolation(upgraded)).toBeNull();
  });

  it("writes the upgraded file back at once", async () => {
    await asFormat11();
    await readDb(file);
    const onDisk = JSON.parse(await readFile(file, "utf8")) as DevDb;
    expect(onDisk.format).toBe(12);
    expect(onDisk.entity.every((e) => e.model_level === "logical") && onDisk.workspace.every((w) => w.infocube === false)).toBe(true);
    expect(onDisk.organization_licence).toEqual([]);
  });

  it("is not repeated: a file at format 12 is read as it is, a dimensional entity and a switched-on workspace kept", async () => {
    const db = await readDb(file);
    const [entity] = db.entity;
    const [workspace] = db.workspace;
    const set = {
      ...db,
      entity: db.entity.map((e) => (e.id === entity!.id ? { ...e, model_level: "dimensional" as const } : e)),
      workspace: db.workspace.map((w) => (w.id === workspace!.id ? { ...w, infocube: true } : w)),
    };
    await writeFile(file, JSON.stringify(set), "utf8");
    const before = await stat(file);

    const read = await readDb(file);
    expect(read).toEqual(set);
    expect((await stat(file)).mtimeMs).toBe(before.mtimeMs);
  });

  it("refuses a model level other than logical or dimensional, and two live licences of one module (the migration's rules)", async () => {
    const db = await readDb(file);
    expect(findViolation({ ...db, entity: db.entity.map((e, n) => (n ? e : { ...e, model_level: "physical" as never })) })).toMatchObject({
      kind: "check",
      table: "entity",
      detail: expect.stringContaining("entity_model_level_ck"),
    });
    const [org] = db.organization;
    const licence = (id: string, deleted_at: string | null = null) => ({
      id,
      organization_id: org!.id,
      module: "infocube" as const,
      version: 1,
      created_at: org!.created_at,
      created_by: org!.created_by,
      updated_at: org!.created_at,
      updated_by: org!.created_by,
      deleted_at,
    });
    const L1 = "01900000-0000-7000-8000-0000000c0001", L2 = "01900000-0000-7000-8000-0000000c0002";
    // an ended licence and a new one: fine; two live ones: refused
    expect(findViolation({ ...db, organization_licence: [licence(L1, org!.created_at), licence(L2)] })).toBeNull();
    expect(findViolation({ ...db, organization_licence: [licence(L1), licence(L2)] })).toMatchObject({ kind: "unique", table: "organization_licence" });
    expect(findViolation({ ...db, organization_licence: [{ ...licence(L1), module: "infobase" as never }] })).toMatchObject({
      kind: "check",
      detail: expect.stringContaining("organization_licence_module_ck"),
    });
  });
});
