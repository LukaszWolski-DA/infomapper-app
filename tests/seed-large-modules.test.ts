// `npm run seed:large` on a file the seed made (fix/seed-large-module-tables): since the Sales star became part of the
// seed, every seeded file holds InfoCube's rows, which the core schema refuses. The script passes the composed schema.

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { STORE_SCHEMA } from "@/compose";
import { addFullDemoData } from "@/compose/seed";
import { seedDevData, seedLargeData } from "@/data/local/dev-data";
import { readDb } from "@/data/local/file";
import { findViolation } from "@/data/local/schema";
import { LARGE_IDS } from "@/data/local/seed-large";

describe("seed:large on a seeded file with the modules' demo rows", () => {
  let dir: string;
  let file: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "seed-large-modules-"));
    file = path.join(dir, "db.json");
    await seedDevData(file, addFullDemoData);
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  it("with STORE_SCHEMA: created, the file holds Performance test and the star", async () => {
    expect(await seedLargeData(file, STORE_SCHEMA)).toBe("created");
    const db = await readDb(file);
    expect(db.workspace.some((w) => w.id === LARGE_IDS.workspace)).toBe(true);
    const cube = db as unknown as Record<string, unknown[] | undefined>;
    expect(cube.cube_entity?.length).toBeGreaterThan(0);
    expect(cube.cube_mapping?.length).toBeGreaterThan(0);
    expect(findViolation(db, undefined, STORE_SCHEMA)).toBeNull();
  }, 60_000);

  it("without a schema: throws no rules for cube_entity (the default stays the core schema on purpose)", async () => {
    await expect(seedLargeData(file)).rejects.toThrow("cube_entity: no rules for cube_entity");
  }, 60_000);
});
