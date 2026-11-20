// The demo and "Performance test" built in memory (slice 29, Q7): `npm run seed`'s rows (the star, InfoDocumenter's
// documents, slice 20's checks) and `npm run seed:large`'s workspace, by the seed's own functions. No file is read: the
// Postgres loader and the contract suite start from these, never from a JSON file (so never from Łukasz's model).
import { addSeedDemoData } from "../../src/compose/seed";
import { STORE_SCHEMA } from "../../src/compose/tables";
import type { DevDb } from "../../src/data/local/schema";
import { buildSeed } from "../../src/data/local/seed";
import { addLargeWorkspace } from "../../src/data/local/seed-large";

export function seedRows(now: Date = new Date()): DevDb {
  const db = buildSeed(now);
  addSeedDemoData(db);
  if (!addLargeWorkspace(db, now.toISOString(), STORE_SCHEMA)) throw new Error('"Performance test" was not added.');
  return db;
}
