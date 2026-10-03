// Seeding and resetting the local data file (npm run seed, npm run reset-dev-data).

import { existsSync } from "node:fs";
import { assertNotProduction, removeDb, writeDb } from "./file";
import { buildSeed } from "./seed";

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
