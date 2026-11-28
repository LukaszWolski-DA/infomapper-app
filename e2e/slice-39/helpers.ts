// Slice 39's helpers: InfoCatalog's licence as test data, the settings' box, the e2e file's workspace rows and their
// change events.

import { expect, type Page } from "@playwright/test";
import { STORE_SCHEMA } from "../../src/compose/tables";
import { CATALOG_TABLES, catalogItemCount } from "../../src/compose/catalog";
import { DEMO_PASSWORD } from "../../src/data/local/demo-password";
import { readDb, writeDb } from "../../src/data/local/file";
import { createLocalDataStore } from "../../src/data/local/store";
import { addLargeWorkspace } from "../../src/data/local/seed-large";
import type { CommandContext, CommandResult } from "../../src/domain/changes";
import { createEntity } from "../../src/domain/commands/entity";
import { createWorkspace, updateWorkspaceSettings } from "../../src/domain/commands/workspace";
import type { WorkspaceAccess } from "../../src/domain/permissions";
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

const domainStore = () => createLocalDataStore(E2E_DB, STORE_SCHEMA);

/** Runs a domain command as a person in a workspace and applies it to the e2e file (test data through the domain, C9). */
export async function inWorkspace<T>(userId: string, ws: string, command: (ctx: CommandContext, access: WorkspaceAccess) => CommandResult<T>): Promise<T> {
  const s = domainStore();
  const workspace = (await s.workspaces.get(ws))!;
  const access = { workspace, member: await s.workspaces.getMember(ws, userId) };
  const result = command({ actorId: userId, now: new Date().toISOString(), newId: () => uuidv7() }, access);
  if (!result.ok) throw new Error(result.error.message);
  const applied = await s.apply(result.writeSet);
  if (!applied.ok) throw new Error(applied.error.message);
  return result.value;
}

/** Test data: a new InfoMate workspace made by Łukasz (its owner; nobody else has a role in it), with one entity. */
export async function workspaceWithoutAnna(name: string, entity: string): Promise<string> {
  const s = domainStore();
  const organization = await s.organizations.get(SEED_IDS.orgInfoMate);
  const organizationMember = await s.organizations.getMember(SEED_IDS.orgInfoMate, SEED_IDS.userLukasz);
  const ctx = { actorId: SEED_IDS.userLukasz, now: new Date().toISOString(), newId: () => uuidv7() };
  const made = createWorkspace(ctx, { organization, organizationMember }, { organizationId: SEED_IDS.orgInfoMate, name });
  if (!made.ok) throw new Error(made.error.message);
  const applied = await s.apply(made.writeSet);
  if (!applied.ok) throw new Error(applied.error.message);
  await addEntity(made.value.workspaceId, entity, "Harbour");
  return made.value.workspaceId;
}

/** Test data: an entity in a workspace, in a new concept of its own, made by Łukasz. */
export async function addEntity(ws: string, name: string, concept = `${name} concept`) {
  const model = await domainStore().model.load(ws);
  return inWorkspace(SEED_IDS.userLukasz, ws, (ctx, access) => createEntity(ctx, access, { concept: null, concepts: model.concepts, entities: model.entities, canvas: null }, { name, newConcept: { name: concept } }));
}

/** Test data: the workspace's switch "Shown in InfoCatalog" set by Łukasz through the domain (InfoMate licensed). */
export async function showInCatalog(ws: string, on: boolean) {
  const workspace = await storedWorkspace(ws);
  return inWorkspace(SEED_IDS.userLukasz, ws, (ctx, access) =>
    updateWorkspaceSettings(ctx, access, { workspaceId: ws, expectedVersion: workspace.version, catalogShown: on }, undefined, undefined, { licensed: true, organizationName: "InfoMate" }),
  );
}

/** Test data: an entity's name and definition (the e2e file's row), for Polish letters and long names. */
export async function renameEntity(from: string, name: string, definition?: string, ws: string = RETAIL) {
  const db = await readDb(E2E_DB);
  const e = db.entity.find((x) => x.workspace_id === ws && x.name === from && x.deleted_at === null);
  if (!e) throw new Error(`No entity ${from}`);
  e.name = name;
  if (definition !== undefined) {
    e.definition_text = definition;
    e.definition_html = `<p>${definition}</p>`;
  }
  await writeDb(E2E_DB, db);
  return e.id;
}

/** Test data: "Performance test" (Łukasz's InfoMate workspace with 2,713 items), for more than 200 results. */
export async function addPerformanceTest() {
  const db = await readDb(E2E_DB);
  addLargeWorkspace(db, new Date().toISOString(), STORE_SCHEMA);
  await writeDb(E2E_DB, db);
}

export const catalogUrl = (params: Record<string, string> = {}) => `/catalog?${new URLSearchParams({ org: SEED_IDS.orgInfoMate, ...params }).toString()}`;
export const searchField = (page: Page) => page.getByTestId("input-catalog-search");
export const resultRows = (page: Page) => page.getByTestId("row-catalog-result");
export const resultNames = (page: Page) => page.getByTestId("text-result-name").allTextContents();
export const kindTab = (page: Page, key: string) => page.locator(`[data-testid="tab-catalog-kind"][data-kind="${key}"]`);
export const scopeSelect = (page: Page) => page.getByTestId("select-catalog-scope");

/** Types a search and waits for its answer: the address holds the words and the rows (or the empty box) show. */
export async function searchFor(page: Page, text: string) {
  await searchField(page).fill(text);
  const q = new URLSearchParams({ q: text }).toString().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  await expect(page).toHaveURL(new RegExp(`[?&]${q}(&|$)`));
  // the rows shown are this search's answer, not the one before it
  await expect(page.getByTestId("page-catalog")).toHaveAttribute("data-query", text);
  await expect(resultRows(page).first().or(page.getByTestId("box-catalog-nothing"))).toBeVisible();
}

// ---- step 6: the drawer (S39-04) and Open in InfoMapper (S39-05) ----

export const drawer = (page: Page) => page.getByTestId("drawer-catalog");
export const drawerName = (page: Page) => page.getByTestId("text-drawer-name");
export const drawerLink = (page: Page, name: string) => drawer(page).getByTestId("button-drawer-link").filter({ hasText: name });
export const factOf = (page: Page, label: string) => drawer(page).locator(`[data-testid="text-drawer-fact"][data-label="${label}"]`);

/** An item's reference as the address holds it (`{kind}:{workspaceId}:{id}`). */
export const itemRef = (kind: string, id: string, ws: string = RETAIL) => `${kind}:${ws}:${id}`;

/** Waits until the drawer has slid in: its right edge at the window's. */
export async function drawerIn(page: Page) {
  const width = page.viewportSize()!.width;
  await expect.poll(async () => {
    const b = await drawer(page).boundingBox();
    return b ? Math.round(b.x + b.width) : null;
  }).toBe(width);
  return (await drawer(page).boundingBox())!;
}

/** The result row of an item by its kind and name (the first such row). */
export const rowNamed = (page: Page, kind: string, name: string) =>
  resultRows(page).and(page.locator(`[data-kind="${kind}"]`)).filter({ has: page.getByTestId("text-result-name").getByText(name, { exact: true }) }).first();

/** Waits until the drawer shows this item's answer (its reference and name). */
export async function expectDrawerAt(page: Page, ref: string, name?: string) {
  await expect(drawer(page).getByTestId("details-catalog-item")).toHaveAttribute("data-item", ref);
  await expect(drawer(page).getByTestId("details-catalog-item")).not.toHaveAttribute("aria-busy", "true");
  if (name !== undefined) await expect(drawerName(page)).toHaveText(name);
}

/** Opens a result's drawer with a click on its row. */
export async function openRow(page: Page, kind: string, name: string) {
  const row = rowNamed(page, kind, name);
  const ref = itemRef(kind, (await row.getAttribute("data-id"))!, (await row.getAttribute("data-workspace"))!);
  await row.click();
  await expectDrawerAt(page, ref, undefined);
  return ref;
}

/** The demo's live rows by name (Retail Co – DWH). */
export async function demoId(kind: "entity" | "attribute" | "source_table" | "source_column" | "requirement", name: string, owner?: string): Promise<string> {
  const db = await readDb(E2E_DB);
  const live = <T extends { workspace_id: string; deleted_at: string | null }>(xs: T[]) => xs.filter((x) => x.workspace_id === RETAIL && x.deleted_at === null);
  if (kind === "entity") return live(db.entity).find((e) => e.name === name)!.id;
  if (kind === "source_table") return live(db.source_table).find((t) => t.name === name)!.id;
  if (kind === "requirement") return live(db.requirement).find((r) => r.key === name)!.id;
  if (kind === "attribute") {
    const entity = live(db.entity).find((e) => e.name === owner)!.id;
    return live(db.attribute).find((a) => a.entity_id === entity && a.name === name)!.id;
  }
  const table = live(db.source_table).find((t) => t.name === owner)!.id;
  return live(db.source_column).find((c) => c.source_table_id === table && c.name === name)!.id;
}
