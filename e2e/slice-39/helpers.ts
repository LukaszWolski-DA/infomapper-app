// Slice 39's helpers: InfoCatalog's licence as test data, the settings' box, the e2e file's workspace rows and their
// change events.

import type { Page } from "@playwright/test";
import { readDb, writeDb } from "../../src/data/local/file";
import { SEED_IDS } from "../../src/data/local/seed";
import { uuidv7 } from "../../src/domain/ids";
import { E2E_DB } from "../config";

export { expectToast, signInAs } from "../slice-00/helpers";
export { SEED_IDS };

export const RETAIL = SEED_IDS.wsRetailDwh;
export const settingsUrl = (ws: string = RETAIL) => `/w/${ws}?tab=settings`;

/** InfoCatalog's licence for an organization, as test data (the seed has none, C5). */
export async function grantCatalogLicence(organizationId: string = SEED_IDS.orgInfoMate) {
  const db = await readDb(E2E_DB);
  const at = new Date().toISOString();
  db.organization_licence.push({ id: uuidv7(), version: 1, created_at: at, created_by: SEED_IDS.userLukasz, updated_at: at, updated_by: SEED_IDS.userLukasz, deleted_at: null, organization_id: organizationId, module: "infocatalog" });
  await writeDb(E2E_DB, db);
}

/** A workspace's stored row. */
export async function storedWorkspace(ws: string = RETAIL) {
  return (await readDb(E2E_DB)).workspace.find((w) => w.id === ws)!;
}

/** The workspace row's change events that changed `catalog_shown`, oldest first. */
export async function catalogEvents(ws: string = RETAIL) {
  return (await readDb(E2E_DB)).change_event.filter(
    (e) => e.workspace_id === ws && e.object_type === "workspace" && e.object_id === ws && (e.before_image as { catalog_shown?: boolean } | null)?.catalog_shown !== (e.after_image as { catalog_shown?: boolean } | null)?.catalog_shown,
  );
}

export const catalogBox = (page: Page) => page.getByTestId("box-infocatalog");
export const catalogCheck = (page: Page) => page.getByTestId("checkbox-catalog-shown");
