// The modules' demo data for the development file (slice 15a, O5): `npm run seed` and `npm run reset-dev-data` add it;
// the e2e reseed does not, so earlier specs' data is unchanged. Slice 15's specs add it themselves.

import type { DevDb } from "@/data/local/schema";
import { SEED_IDS, SEED_USERS } from "@/data/local/seed";
import { addChecksDemo } from "@/data/local/seed-checks";
import { addSalesStar, addStarDerivations, addStarTypes } from "@/modules/infocube/data/sales-star";
import { addDocumentsDemo } from "@/modules/infodocumenter/data/demo";
import { DOCUMENT_SECTION_KINDS } from "./documents";
import { baselineSummary, type BaselineContent, type BaselineInsert } from "@/domain/baseline/content";
import { baselineNameKey } from "@/domain/baseline/names";
import { SNAPSHOT_SCHEMA } from "@/domain/baseline/upgrade";
import { baselineContentOfRows } from "./baselines";

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

/** The demo's baseline (slice 35): its id, name and the time it was taken (10:12 in Warsaw on 15 September 2026). */
export const DEMO_BASELINE = {
  id: "01a0f9e9-2035-7b1a-8c35-5e1f0a7e3501",
  name: "Stage 1 sign-off",
  note: "Agreed with Retail Co on 15 September.",
  at: "2026-09-15T08:12:00.000Z",
} as const;

/**
 * Slice 35's demo (PRD "The demo", step 1's Q8 and F14): the baseline "Stage 1 sign-off" of "Retail Co – DWH", taken
 * from today's demo model by the same rule as every baseline (`baselineContentOfRows`), minus what the prototype says
 * came later: REQ-105 with its links and `Customer.segment_code` (it has no mapping); with the mapping `customers.cust_no →
 * Customer.customer_number` still a draft and `customers.cust_no` still `varchar(10)`. Run last by the seed, the reset,
 * `npm run demo` (`addSeedDemoData`, so `pg:seed` too) and slice 35's fixtures; never by an earlier fixture. No change
 * event, as the seed's other rows. False when the workspace is not there or the baseline is already.
 */
export function addBaselinesDemoData(db: DevDb): boolean {
  if (db.baseline.some((b) => b.id === DEMO_BASELINE.id)) return false;
  const now = baselineContentOfRows(db, SEED_IDS.wsRetailDwh);
  if (!now) return false;
  const content = structuredClone(now) as { -readonly [K in keyof BaselineContent]: BaselineContent[K] };
  const m = content.model;
  const req = content.requirements.find((r) => r.key === "REQ-105");
  if (req) {
    content.requirements = content.requirements.filter((r) => r.id !== req.id);
    content.requirementLinks = content.requirementLinks.filter((k) => k.requirement_id !== req.id);
  }
  const customer = m.entities.find((e) => e.name === "Customer" && e.model_level === "logical");
  const segment = m.attributes.find((a) => a.entity_id === customer?.id && a.name === "segment_code");
  if (segment) {
    m.attributes = m.attributes.filter((a) => a.id !== segment.id);
    content.requirementLinks = content.requirementLinks.filter((k) => k.attribute_id !== segment.id);
  }
  const customers = m.sourceTables.find((t) => t.name === "customers");
  const custNo = m.sourceColumns.find((c) => c.source_table_id === customers?.id && c.name === "cust_no");
  if (custNo) custNo.type_length = 10;
  const number = m.attributes.find((a) => a.entity_id === customer?.id && a.name === "customer_number");
  const fromCustNo = new Set(m.mappingInputs.filter((i) => i.source_column_id === custNo?.id).map((i) => i.mapping_id));
  const mapping = m.mappings.find((x) => x.attribute_id === number?.id && fromCustNo.has(x.id));
  if (mapping) Object.assign(mapping, { status: "draft", approved_by: null, approved_at: null });
  const row: BaselineInsert = {
    id: DEMO_BASELINE.id,
    workspace_id: SEED_IDS.wsRetailDwh,
    version: 1,
    created_at: DEMO_BASELINE.at,
    created_by: SEED_USERS.lukasz.id,
    updated_at: DEMO_BASELINE.at,
    updated_by: SEED_USERS.lukasz.id,
    deleted_at: null,
    name: DEMO_BASELINE.name,
    name_key: baselineNameKey(DEMO_BASELINE.name),
    note: DEMO_BASELINE.note,
    snapshot_schema: SNAPSHOT_SCHEMA,
    ...baselineSummary(content),
    snapshot: content,
  };
  db.baseline.push(row);
  return true;
}

/** What the seed, the reset and `npm run demo` write: `addFullDemoData`, `addDocumentsDemoData` (slice 25), then the baseline (slice 35). */
export function addSeedDemoData(db: DevDb, at?: string): boolean {
  const added = addFullDemoData(db, at);
  addDocumentsDemoData(db, at);
  addBaselinesDemoData(db);
  return added;
}
