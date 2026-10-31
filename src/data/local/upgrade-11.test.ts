// The local data file's upgrade from format 10 to 11 (slice 11, item 5; S11-12): entities and attributes get `alias`
// null, canvases and canvas items `entity_names` and `attribute_names` null, nothing else changes, no change event and
// no log line; the file is written back at once, and a file at format 11 is read as it is.

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
  dir = await mkdtemp(path.join(tmpdir(), "infomapper-upgrade11-"));
  file = path.join(dir, "dev-db.json");
  await seedDevData(file);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(dir, { recursive: true, force: true });
});

const without = (row: object, columns: readonly string[]) => Object.fromEntries(Object.entries(row).filter(([k]) => !columns.includes(k)));
const NAMES = ["entity_names", "attribute_names"];

/** The seeded file as slice 10c wrote it: format 10, without the slice's columns. */
async function asFormat10(): Promise<DevDb> {
  const db = await readDb(file);
  const old = {
    ...db,
    format: 10,
    entity: db.entity.map((e) => without(e, ["alias"])),
    attribute: db.attribute.map((a) => without(a, ["alias"])),
    canvas: db.canvas.map((c) => without(c, NAMES)),
    canvas_item: db.canvas_item.map((i) => without(i, NAMES)),
  };
  await writeFile(file, JSON.stringify(old), "utf8");
  return db;
}

const counts = (db: DevDb) => Object.fromEntries(Object.entries(db).filter(([k]) => k !== "format").map(([k, rows]) => [k, (rows as unknown[]).length]));
const allNull = (rows: readonly object[], columns: readonly string[]) =>
  rows.every((r) => columns.every((c) => c in r && (r as Record<string, unknown>)[c] === null));

describe("the upgrade to format 11 (slice 11, S11-12)", () => {
  it("gives every row its new columns as null, keeps every row and count, and writes no change event or log line", async () => {
    const db = await asFormat10();
    expect(db.entity.length && db.attribute.length && db.canvas.length && db.canvas_item.length).toBeGreaterThan(0);
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    const upgraded = await readDb(file);
    expect(upgraded.format).toBe(DEV_DB_FORMAT);
    expect(DEV_DB_FORMAT).toBe(11);
    expect(allNull(upgraded.entity, ["alias"])).toBe(true);
    expect(allNull(upgraded.attribute, ["alias"])).toBe(true);
    expect(allNull(upgraded.canvas, NAMES)).toBe(true);
    expect(allNull(upgraded.canvas_item, NAMES)).toBe(true);
    expect(counts(upgraded)).toEqual(counts(db));
    expect(upgraded.change_event).toEqual(db.change_event);
    expect(log).not.toHaveBeenCalled();
    // nothing else changed, the look included
    expect(upgraded).toEqual(db);
    expect(findViolation(upgraded)).toBeNull();
  });

  it("writes the upgraded file back at once", async () => {
    await asFormat10();
    await readDb(file);
    const onDisk = JSON.parse(await readFile(file, "utf8")) as DevDb;
    expect(onDisk.format).toBe(11);
    expect(allNull(onDisk.entity, ["alias"]) && allNull(onDisk.canvas, NAMES) && allNull(onDisk.canvas_item, NAMES)).toBe(true);
  });

  it("reads a file at format 11 as it is: aliases and names kept, the file not written again", async () => {
    const db = await readDb(file);
    const [entity] = db.entity;
    const [canvas] = db.canvas;
    const item = db.canvas_item.find((i) => i.entity_id && i.canvas_id === canvas!.id)!;
    const set = {
      ...db,
      entity: db.entity.map((e) => (e.id === entity!.id ? { ...e, alias: "Klient" } : e)),
      canvas: db.canvas.map((c) => (c.id === canvas!.id ? { ...c, attribute_names: "alias" as const } : c)),
      canvas_item: db.canvas_item.map((i) => (i.id === item.id ? { ...i, attribute_names: "name" as const } : i)),
    };
    await writeFile(file, JSON.stringify(set), "utf8");
    const before = await stat(file);

    const read = await readDb(file);
    expect(read).toEqual(set);
    expect((await stat(file)).mtimeMs).toBe(before.mtimeMs);
  });

  it("refuses a mode other than name or alias, on a canvas and on a card (the migration's CHECKs)", async () => {
    const db = await readDb(file);
    expect(findViolation({ ...db, canvas: db.canvas.map((c, n) => (n ? c : { ...c, entity_names: "both" as never })) })).toMatchObject({ kind: "check", table: "canvas", detail: expect.stringContaining("canvas_entity_names_ck") });
    expect(findViolation({ ...db, canvas_item: db.canvas_item.map((i, n) => (n ? i : { ...i, attribute_names: "" as never })) })).toMatchObject({ kind: "check", table: "canvas_item", detail: expect.stringContaining("canvas_item_attribute_names_ck") });
  });
});
