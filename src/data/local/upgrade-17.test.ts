// The local data file's upgrade from format 16 to 17 (slice 25, F4): every workspace gets `infodoc` false; nothing else
// changes, no change event and no log line; the file is written back at once, and a current file is read as it is.

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
  dir = await mkdtemp(path.join(tmpdir(), "infomapper-upgrade17-"));
  file = path.join(dir, "dev-db.json");
  await seedDevData(file);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(dir, { recursive: true, force: true });
});

/** The seeded file as slice 24 wrote it: format 16, workspaces without `infodoc`. */
async function asFormat16(): Promise<DevDb> {
  const db = await readDb(file);
  const old = { ...db, format: 16, workspace: db.workspace.map((w) => Object.fromEntries(Object.entries(w).filter(([k]) => k !== "infodoc"))) };
  await writeFile(file, JSON.stringify(old), "utf8");
  return db;
}

describe("the upgrade to format 17 (slice 25, F4)", () => {
  it("turns InfoDocumenter off in every workspace and changes nothing else; no change event, no log line", async () => {
    const db = await asFormat16();
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    const upgraded = await readDb(file);

    expect(upgraded.format).toBe(DEV_DB_FORMAT);
    expect(upgraded.workspace.length).toBeGreaterThan(0);
    for (const w of upgraded.workspace) expect(w.infodoc).toBe(false);
    expect(upgraded).toEqual(db);
    expect(upgraded.change_event).toHaveLength(db.change_event.length);
    expect(log).not.toHaveBeenCalled();
    expect(findViolation(upgraded)).toBeNull();
    const onDisk = JSON.parse(await readFile(file, "utf8")) as DevDb;
    expect(onDisk.format).toBe(DEV_DB_FORMAT);
    expect(onDisk.workspace.every((w) => w.infodoc === false)).toBe(true);
  });

  it("keeps a switch that is on: a current file is read as it is", async () => {
    const db = await readDb(file);
    const edited = { ...db, workspace: db.workspace.map((w, i) => (i === 0 ? { ...w, infodoc: true } : w)) };
    await writeFile(file, JSON.stringify(edited), "utf8");
    const before = await stat(file);
    expect(await readDb(file)).toEqual(edited);
    expect((await stat(file)).mtimeMs).toBe(before.mtimeMs);
  });
});
