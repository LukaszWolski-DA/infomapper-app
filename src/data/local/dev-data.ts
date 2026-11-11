// Seeding and resetting the local data file (npm run seed, npm run reset-dev-data, npm run seed:large).

import { existsSync } from "node:fs";
import { assertNotProduction, readDb, removeDb, writeDb } from "./file";
import { CORE_SCHEMA, type DevDb, type LocalSchema } from "./schema";
import { buildSeed } from "./seed";
import { addLargeWorkspace } from "./seed-large";

/** What a caller adds to the fresh seed: the modules' demo data, from the composition root (slice 15a, O5). */
export type SeedExtra = (db: DevDb) => unknown;

function seeded(extra?: SeedExtra): DevDb {
  const db = buildSeed();
  extra?.(db);
  return db;
}

export async function seedDevData(file: string, extra?: SeedExtra): Promise<"created" | "exists"> {
  assertNotProduction();
  if (existsSync(file)) return "exists";
  await writeDb(file, seeded(extra));
  return "created";
}

export async function resetDevData(file: string, extra?: SeedExtra): Promise<void> {
  assertNotProduction();
  await removeDb(file);
  await writeDb(file, seeded(extra));
}

/**
 * Adds the workspace “Performance test” (seeding the demo data first if there is no file yet). `schema` checks the whole
 * file afterwards: the core one by default; a file with a module's rows needs the composed one (`STORE_SCHEMA`).
 */
export async function seedLargeData(file: string, schema: LocalSchema = CORE_SCHEMA): Promise<"created" | "exists"> {
  assertNotProduction();
  if (!existsSync(file)) await writeDb(file, buildSeed());
  const db = await readDb(file);
  if (!addLargeWorkspace(db, new Date().toISOString(), schema)) return "exists";
  await writeDb(file, db);
  return "created";
}
