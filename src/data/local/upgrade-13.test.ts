// The local data file's upgrade from format 12 to 13 (slice 15b, RP-A): every relationship gets `from_role` and
// `to_role` null; nothing else changes, no change event and no log line; the file is written back at once, and a file at
// format 13 is read as it is (the upgrade is not repeated, roles kept). A module's tables are not part of the format
// (AD-33): what the upgrade does with a 15a file's InfoCube rows (nothing) is in `tests/infocube-keys.test.ts`.

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
  dir = await mkdtemp(path.join(tmpdir(), "infomapper-upgrade13-"));
  file = path.join(dir, "dev-db.json");
  await seedDevData(file);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(dir, { recursive: true, force: true });
});

const without = (row: object, columns: readonly string[]) => Object.fromEntries(Object.entries(row).filter(([k]) => !columns.includes(k)));

/** The seeded file as slice 15a wrote it: format 12, relationships without roles. */
async function asFormat12(): Promise<DevDb> {
  const db = await readDb(file);
  await writeFile(file, JSON.stringify({ ...db, format: 12, relationship: db.relationship.map((r) => without(r, ["from_role", "to_role"])) }), "utf8");
  return db;
}

const counts = (db: DevDb) => Object.fromEntries(Object.entries(db).filter(([k]) => k !== "format").map(([k, rows]) => [k, (rows as unknown[]).length]));

describe("the upgrade to format 13 (slice 15b, RP-A)", () => {
  it("gives every relationship two null roles, keeping every row and count; no change event, no log line", async () => {
    const db = await asFormat12();
    expect(db.relationship.length).toBeGreaterThan(0);
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    const upgraded = await readDb(file);
    expect(DEV_DB_FORMAT).toBe(13);
    expect(upgraded.format).toBe(13);
    expect(upgraded.relationship.every((r) => r.from_role === null && r.to_role === null)).toBe(true);
    expect(counts(upgraded)).toEqual(counts(db));
    expect(upgraded.change_event).toEqual(db.change_event);
    expect(log).not.toHaveBeenCalled();
    // nothing else changed: the seed's relationships have no roles
    expect(upgraded).toEqual(db);
    expect(findViolation(upgraded)).toBeNull();
  });

  it("writes the upgraded file back at once", async () => {
    await asFormat12();
    await readDb(file);
    const onDisk = JSON.parse(await readFile(file, "utf8")) as DevDb;
    expect(onDisk.format).toBe(13);
    expect(onDisk.relationship.every((r) => r.from_role === null && r.to_role === null)).toBe(true);
  });

  it("is not repeated: a file at format 13 is read as it is, its roles kept", async () => {
    const db = await readDb(file);
    const [first] = db.relationship;
    const named = { ...db, relationship: db.relationship.map((r) => (r.id === first!.id ? { ...r, from_role: "billing", to_role: "shipping" } : r)) };
    await writeFile(file, JSON.stringify(named), "utf8");
    const before = await stat(file);
    expect(await readDb(file)).toEqual(named);
    expect((await stat(file)).mtimeMs).toBe(before.mtimeMs);
  });
});
