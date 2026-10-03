// Seeding and resetting the local data file (npm run seed, npm run reset-dev-data, npm run seed:large).

import { existsSync } from "node:fs";
import { assertNotProduction, readDb, removeDb, writeDb } from "./file";
import { buildSeed } from "./seed";
import { addLargeWorkspace } from "./seed-large";

export async function seedDevData(file: string): Promise<"created" | "exists"> {
  assertNotProduction();
  if (existsSync(file)) return "exists";
  await writeDb(file, buildSeed());
  return "created";
}

export async function resetDevData(file: string): Promise<void> {
  assertNotProduction();
  await removeDb(file);
  await writeDb(file, buildSeed());
}

/** Adds the workspace “Performance test” (seeding the demo data first if there is no file yet). */
export async function seedLargeData(file: string): Promise<"created" | "exists"> {
  assertNotProduction();
  if (!existsSync(file)) await writeDb(file, buildSeed());
  const db = await readDb(file);
  if (!addLargeWorkspace(db, new Date().toISOString())) return "exists";
  await writeDb(file, db);
  return "created";
}
