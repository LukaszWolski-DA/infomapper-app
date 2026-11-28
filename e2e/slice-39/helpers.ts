// Slice 39's helpers: InfoCatalog's licence as test data, the settings' box, the e2e file's workspace rows and their
// change events.

import { expect, type Page } from "@playwright/test";
import { STORE_SCHEMA } from "../../src/compose/tables";
import { CATALOG_TABLES, catalogItemCount } from "../../src/compose/catalog";
import { DEMO_PASSWORD } from "../../src/data/local/demo-password";
import { readDb, writeDb } from "../../src/data/local/file";
import { createLocalDataStore } from "../../src/data/local/store";
import type { SeedUserName } from "../slice-00/helpers";
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

/** Signs in through the test users' list (every organization unlocked) and waits for the landing zone or a workspace. */
export async function signInTo(page: Page, name: SeedUserName) {
  await page.goto("/sign-in");
  await page.getByTestId("button-dev-user").filter({ hasText: name }).click();
  await expect(page.getByTestId("page-landing").or(page.getByTestId("bar-top"))).toBeVisible();
}

/** Signs in with an organization's password (slice 8), unlocking that organization only. */
export async function signInWithOrganization(page: Page, email: string, organization: string) {
  await page.goto("/sign-in");
  const panel = page.getByTestId("panel-sign-in");
  await panel.getByTestId("input-sign-in-email").fill(email);
  await panel.getByTestId("button-sign-in-continue").click();
  const list = panel.getByTestId("list-sign-in-organizations");
  const field = panel.getByTestId("input-sign-in-password");
  await expect(list.or(field)).toBeVisible();
  if (await list.isVisible()) await list.getByTestId("button-sign-in-organization").filter({ hasText: organization }).click();
  await field.fill(DEMO_PASSWORD);
  await panel.getByTestId("button-sign-in").click();
  await expect(page.getByTestId("page-landing").or(page.getByTestId("bar-top"))).toBeVisible();
}

/** Test data: the person a member of another organization (an `organization_member` row). */
export async function makeMember(userId: string, organizationId: string, role: "owner" | "admin" | "member" = "member") {
  const db = await readDb(E2E_DB);
  db.organization_member.push({ organization_id: organizationId, user_id: userId, role, created_at: new Date().toISOString() });
  await writeDb(E2E_DB, db);
}

/** The InfoCatalog tile's item count as the catalog index reads it (every readable workspace of the organization). */
export async function itemsOf(userId: string, organizationId: string) {
  const store = createLocalDataStore(E2E_DB, STORE_SCHEMA);
  const all = new Set((await readDb(E2E_DB)).organization.map((o) => o.id));
  return catalogItemCount(await store.catalog.read(userId, all, { organizationId, workspaceId: null }, CATALOG_TABLES));
}

export const landing = (page: Page) => page.getByTestId("page-landing");
export const allApps = (page: Page) => page.getByTestId("button-all-apps");
export const notFoundPage = (page: Page) => page.getByTestId("page-not-found");
