// The local data file's upgrade from format 9 to 10 (slice 10c, item 2, F11; S10C-10): every attribute gets
// `copied_from_attribute_id` null, nothing else changes, no change event and no log line; the file is written back at
// once. The adapter's foreign key accepts a deleted original (F9). Since slice 11 the file goes on to format 11
// (`upgrade-11.test.ts`).

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seedDevData } from "./dev-data";
import { readDb } from "./file";
import { DEV_DB_FORMAT, findViolation, type DevDb } from "./schema";

let dir: string;
let file: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "infomapper-upgrade10-"));
  file = path.join(dir, "dev-db.json");
  await seedDevData(file);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(dir, { recursive: true, force: true });
});

/** The seeded file as slice 8 to 10b wrote it: format 9, attributes without the column. */
async function asFormat9(): Promise<DevDb> {
  const db = await readDb(file);
  const old = {
    ...db,
    format: 9,
    attribute: db.attribute.map((a) => Object.fromEntries(Object.entries(a).filter(([k]) => k !== "copied_from_attribute_id"))),
  };
  await writeFile(file, JSON.stringify(old), "utf8");
  return db;
}

const counts = (db: DevDb) => Object.fromEntries(Object.entries(db).filter(([k]) => k !== "format").map(([k, rows]) => [k, (rows as unknown[]).length]));

describe("the upgrade to format 10 (slice 10c, S10C-10)", () => {
  it("gives every attribute the column as null, keeps every row and count, and writes no change event or log line", async () => {
    const db = await asFormat9();
    expect(db.attribute.length).toBeGreaterThan(0);
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    const upgraded = await readDb(file);
    expect(upgraded.format).toBe(DEV_DB_FORMAT);
    expect(upgraded.attribute.every((a) => "copied_from_attribute_id" in a && a.copied_from_attribute_id === null)).toBe(true);
    expect(counts(upgraded)).toEqual(counts(db));
    expect(upgraded.change_event).toEqual(db.change_event);
    expect(log).not.toHaveBeenCalled();
    // nothing else changed
    expect(upgraded).toEqual(db);
    expect(findViolation(upgraded)).toBeNull();
  });

  it("writes the upgraded file back at once", async () => {
    await asFormat9();
    await readDb(file);
    const onDisk = JSON.parse(await readFile(file, "utf8")) as DevDb;
    expect(onDisk.format).toBe(DEV_DB_FORMAT);
    expect(onDisk.attribute.every((a) => a.copied_from_attribute_id === null)).toBe(true);
  });

  it("keeps a format-10 file's links on its way to the current format", async () => {
    const db = await readDb(file);
    const [original, copy] = db.attribute;
    const linked = { ...db, attribute: db.attribute.map((a) => (a.id === copy!.id ? { ...a, copied_from_attribute_id: original!.id } : a)) };
    // as slice 10c wrote it: format 10, without slice 11's columns
    const strip = (row: object) => Object.fromEntries(Object.entries(row).filter(([k]) => !["alias", "entity_names", "attribute_names"].includes(k)));
    const format10 = { ...linked, format: 10, entity: linked.entity.map(strip), attribute: linked.attribute.map(strip), canvas: linked.canvas.map(strip), canvas_item: linked.canvas_item.map(strip) };
    await writeFile(file, JSON.stringify(format10), "utf8");

    const read = await readDb(file);
    expect(read.attribute.find((a) => a.id === copy!.id)!.copied_from_attribute_id).toBe(original!.id);
    expect(read).toEqual(linked);
  });
});

describe("copied_from_attribute_id as a foreign key in the local adapter (F9)", () => {
  it("accepts a link to a deleted attribute and refuses one to an attribute that does not exist", async () => {
    const db = await readDb(file);
    const [original, copy] = db.attribute;
    const deleted = { ...db, attribute: db.attribute.map((a) => (a.id === original!.id ? { ...a, deleted_at: "2026-10-30T12:00:00.000Z" } : a.id === copy!.id ? { ...a, copied_from_attribute_id: original!.id } : a)) };
    expect(findViolation(deleted)).toBeNull();

    const dangling = { ...db, attribute: db.attribute.map((a) => (a.id === copy!.id ? { ...a, copied_from_attribute_id: "01900000-0000-7000-8000-00000000dead" } : a)) };
    expect(findViolation(dangling)).toMatchObject({ kind: "foreign_key", table: "attribute" });
  });
});
