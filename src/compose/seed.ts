// The modules' demo data for the development file (slice 15a, O5): `npm run seed` and `npm run reset-dev-data` add it;
// the e2e reseed does not, so earlier specs' data is unchanged. Slice 15's specs add it themselves.

import type { DevDb } from "@/data/local/schema";
import { SEED_IDS, SEED_USERS } from "@/data/local/seed";
import { addSalesStar, addStarDerivations } from "@/modules/infocube/data/sales-star";

/** The Sales star in "Retail Co – DWH", with InfoMate's InfoCube licence and InfoCube on there. */
export function addModuleDemoData(db: DevDb, at?: string): boolean {
  return addSalesStar(db, { workspaceId: SEED_IDS.wsRetailDwh, organizationId: SEED_IDS.orgInfoMate, projectId: SEED_IDS.projOrderManagement, authorId: SEED_USERS.anna.id }, at);
}

/**
 * The demo data with slice 18's derivations on the star (item 5, F20): a lookup and a calculated attribute. For
 * `npm run seed`, `npm run reset-dev-data`, `npm run demo` and slice 18's fixtures; slice 15's fixtures keep
 * `addModuleDemoData`, so their specs read the star as it was.
 */
export function addDemoData(db: DevDb, at?: string): boolean {
  const added = addModuleDemoData(db, at);
  addStarDerivations(db, SEED_IDS.wsRetailDwh, SEED_USERS.anna.id, at);
  return added;
}
