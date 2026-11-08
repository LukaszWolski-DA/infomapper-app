// The local data file's upgrade from format 13 to 14 (slice 18, Q2): every attribute gets `is_calculated` false and
// `calc_rule` null, and the file an empty `attribute_input`; nothing else changes, no change event and no log line; the
// file is written back at once, and a file at format 14 is read as it is (its calculations kept). InfoCube's two new
// `cube_mapping` columns are not part of the format (AD-33): InfoCube reads them as null where a row lacks them.

import { readFile, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seedDevData } from "./dev-data";
import { readDb } from "./file";
import { DEV_DB_FORMAT, findViolation, type DevDb } from "./schema";

let dir: string;
let file: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "infomapper-upgrade14-"));
  file = path.join(dir, "dev-db.json");
  await seedDevData(file);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(dir, { recursive: true, force: true });
});

const without = (row: object, columns: readonly string[]) => Object.fromEntries(Object.entries(row).filter(([k]) => !columns.includes(k)));

/** The seeded file as slice 17 wrote it: format 13, attributes without the two columns, no `attribute_input`. */
async function asFormat13(): Promise<DevDb> {
  const db = await readDb(file);
  const old: Record<string, unknown> = { ...db, format: 13, attribute: db.attribute.map((a) => without(a, ["is_calculated", "calc_rule"])) };
  delete old.attribute_input;
  await writeFile(file, JSON.stringify(old), "utf8");
  return db;
}

const counts = (db: DevDb) => Object.fromEntries(Object.entries(db).filter(([k]) => k !== "format").map(([k, rows]) => [k, (rows as unknown[]).length]));

describe("the upgrade to format 14 (slice 18, Q2)", () => {
  it("gives every attribute no calculation and the file no inputs, keeping every row and count; no change event, no log line", async () => {
    const db = await asFormat13();
    expect(db.attribute.length).toBeGreaterThan(0);
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    const upgraded = await readDb(file);
    expect(upgraded.format).toBe(DEV_DB_FORMAT);
    expect(upgraded.attribute.every((a) => a.is_calculated === false && a.calc_rule === null)).toBe(true);
    expect(upgraded.attribute_input).toEqual([]);
    expect(counts(upgraded)).toEqual(counts(db));
    expect(upgraded.change_event).toEqual(db.change_event);
    expect(log).not.toHaveBeenCalled();
    // nothing else changed: the plain seed has no calculation
    expect(upgraded).toEqual(db);
    expect(findViolation(upgraded)).toBeNull();
  });

  it("writes the upgraded file back at once", async () => {
    await asFormat13();
    await readDb(file);
    const onDisk = JSON.parse(await readFile(file, "utf8")) as DevDb;
    expect(onDisk.format).toBe(DEV_DB_FORMAT);
    expect(onDisk.attribute_input).toEqual([]);
    expect(onDisk.attribute.every((a) => a.is_calculated === false && a.calc_rule === null)).toBe(true);
  });

  it("is not repeated: a file at format 14 is read as it is, its calculation kept", async () => {
    const db = await readDb(file);
    const [first] = db.attribute;
    const calculated = { ...db, attribute: db.attribute.map((a) => (a.id === first!.id ? { ...a, is_calculated: true, calc_rule: "a * b" } : a)) };
    await writeFile(file, JSON.stringify(calculated), "utf8");
    const before = await stat(file);
    expect(await readDb(file)).toEqual(calculated);
    expect((await stat(file)).mtimeMs).toBe(before.mtimeMs);
  });
});
