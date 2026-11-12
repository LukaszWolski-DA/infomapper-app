// The modules' demo data for the development file (slice 15a, O5): `npm run seed` and `npm run reset-dev-data` add it;
// the e2e reseed does not, so earlier specs' data is unchanged. Slice 15's specs add it themselves.

import type { DevDb } from "@/data/local/schema";
import { SEED_IDS, SEED_USERS } from "@/data/local/seed";
import { addChecksDemo } from "@/data/local/seed-checks";
import { addSalesStar, addStarDerivations, addStarTypes } from "@/modules/infocube/data/sales-star";
import { addDocumentsDemo } from "@/modules/infodocumenter/data/demo";
import { DOCUMENT_SECTION_KINDS } from "./documents";

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

/**
 * Slice 19's demo on the star (item 8; Łukasz, step 1, answer 6): Fact Orders an aggregate of Fact Sales, Dim Category an
 * outrigger of Dim Product, Dim Order Flags a junk dimension, Dim Product a month-end snapshot. Run after `addDemoData`
 * by `npm run seed`, `npm run reset-dev-data`, `npm run demo` (`addFullDemoData`) and slice 19's fixtures; slice 15's and
 * 18's fixtures do not, so their specs read the star as it was.
 */
export function addInfoCubeTypesDemoData(db: DevDb, at?: string): boolean {
  return addStarTypes(db, SEED_IDS.wsRetailDwh, SEED_USERS.anna.id, at);
}

/**
 * Slice 19's demo and everything before it: `addDemoData`, then `addInfoCubeTypesDemoData`. Slice 19's fixtures and its
 * unit test read this (slice 20, F23), so they keep what they read before slice 20's demo.
 */
export function addTypesDemoData(db: DevDb, at?: string): boolean {
  const added = addDemoData(db, at);
  addInfoCubeTypesDemoData(db, at);
  return added;
}

/**
 * Slice 20's demo for the model checks (PRD item 7): copies of the demo model's keys and what the checks find, in "Retail
 * Co – DWH". InfoMapper's own step. Run by `addFullDemoData` and slice 20's fixtures only.
 */
export function addChecksDemoData(db: DevDb, at?: string): boolean {
  return addChecksDemo(db, SEED_IDS.wsRetailDwh, SEED_USERS.anna.id, at);
}

/** Slice 20's whole demo: `addTypesDemoData`, then `addChecksDemoData`; the seed adds slice 25's documents after it (`addSeedDemoData`). */
export function addFullDemoData(db: DevDb, at?: string): boolean {
  const added = addTypesDemoData(db, at);
  addChecksDemoData(db, at);
  return added;
}

/**
 * Slice 25's demo (F31, F32): InfoMate's InfoDocumenter licence, InfoDocumenter on in "Retail Co – DWH" and three live
 * documents (a shared data dictionary, Łukasz's private S2T for Order management, Anna's private dictionary). Run after
 * `addFullDemoData` by the seed, the reset, `npm run demo` (`addSeedDemoData`) and slice 25's fixtures; never inside
 * `addFullDemoData`, so slice 20's and 22's fixtures and the benches read the demo as before.
 */
export function addDocumentsDemoData(db: DevDb, at?: string): boolean {
  return addDocumentsDemo(
    db,
    { workspaceId: SEED_IDS.wsRetailDwh, organizationId: SEED_IDS.orgInfoMate, ownerId: SEED_USERS.lukasz.id, modelerId: SEED_USERS.anna.id, projectId: SEED_IDS.projOrderManagement },
    DOCUMENT_SECTION_KINDS.values(),
    at,
  );
}

/** What the seed, the reset and `npm run demo` write: `addFullDemoData`, then `addDocumentsDemoData` (slice 25). */
export function addSeedDemoData(db: DevDb, at?: string): boolean {
  const added = addFullDemoData(db, at);
  addDocumentsDemoData(db, at);
  return added;
}
