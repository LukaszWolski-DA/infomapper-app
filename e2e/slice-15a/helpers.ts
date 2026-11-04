// Slice 15a's helpers: the Sales star's canvas and ids, the InfoCube box, the Cube tab, roles on cards, and direct
// calls of the domain's commands (a "direct call is refused": the command as the server runs it, without the page).

import type { Page } from "@playwright/test";
import { STORE_SCHEMA } from "../../src/compose";
import { createLocalDataStore } from "../../src/data/local/store";
import type { CommandContext, CommandResult } from "../../src/domain/changes";
import { updateWorkspaceSettings } from "../../src/domain/commands/workspace";
import { uuidv7 } from "../../src/domain/ids";
import { dimensionalCount } from "../../src/domain/model/levels";
import type { WorkspaceAccess } from "../../src/domain/permissions";
import { salesStarCanvasId, starId } from "../../src/modules/infocube/data/sales-star";
import type { CubeEntity } from "../../src/modules/infocube/domain/types";
import { E2E_DB } from "../config";
import { canvasUrl, RETAIL, SEED_IDS } from "../slice-01a/helpers";

export * from "../slice-14b/helpers";
export { changeRoleAs } from "../slice-08/helpers";

/** The e2e data file with InfoCube's tables known (the composition root's schema). */
export const cubeStore = () => createLocalDataStore(E2E_DB, STORE_SCHEMA);

export const STAR = salesStarCanvasId(RETAIL);
/** The canvas "Sales star" in Order management. */
export const starUrl = () => canvasUrl(STAR, SEED_IDS.projOrderManagement);
/** The whole star at 50 %: the logical model on the left, the facts and dimensions on the right. */
export const STAR_VIEW = { x: 20, y: 20, zoom: 0.5 } as const;
export const entityIdOf = (key: "sales" | "cust" | "prod" | "date" | "orders") => starId(RETAIL, `entity:${key}`);

export const workspaceHome = (ws: string = RETAIL) => `/w/${ws}`;
export const settingsUrl = (ws: string = RETAIL) => `/w/${ws}?tab=settings`;

/** The InfoCube box of the workspace settings and its parts. */
export const infocubeBox = (page: Page) => page.getByTestId("box-infocube");
export const infocubeCheck = (page: Page) => page.getByTestId("checkbox-infocube");

/** A card's role in its header (`card-role`), by the card's name. */
export const roleOf = (page: Page, name: string) =>
  page.locator(".react-flow__node").filter({ has: page.getByTestId("card-name").getByText(name, { exact: true }) }).getByTestId("card-role");

/** The workspace's stored row and its InfoCube rows. */
export async function workspaceRow(ws: string = RETAIL) {
  return (await cubeStore().workspaces.get(ws))!;
}
export async function cubeEntities(ws: string = RETAIL): Promise<CubeEntity[]> {
  return cubeStore().modules.list(ws, "cube_entity");
}
export async function liveEntityNamed(name: string, ws: string = RETAIL) {
  return (await cubeStore().model.load(ws)).entities.find((e) => e.name === name);
}

/** A domain command's refusal as a person: the message, or null when the command would write (it never applies). */
export async function refusalAs<T>(userId: string, command: (ctx: CommandContext, access: WorkspaceAccess) => CommandResult<T>, ws: string = RETAIL): Promise<string | null> {
  const s = cubeStore();
  const workspace = (await s.workspaces.get(ws))!;
  const access = { workspace, member: await s.workspaces.getMember(ws, userId) };
  const ctx = { actorId: userId, now: new Date().toISOString(), newId: () => uuidv7() };
  const result = command(ctx, access);
  return result.ok ? null : result.error.message;
}

/** Turning InfoCube on or off as a person, as `updateWorkspaceSettingsAction` sends it (with the licence and the count). */
export async function switchRefusal(userId: string, on: boolean, ws: string = RETAIL): Promise<string | null> {
  const s = cubeStore();
  const workspace = (await s.workspaces.get(ws))!;
  const [organization, licences, model] = await Promise.all([
    s.organizations.get(workspace.organization_id),
    s.organizations.listLicences(workspace.organization_id),
    s.model.load(ws),
  ]);
  const state = { licensed: licences.some((l) => l.module === "infocube"), organizationName: organization?.name ?? "", dimensionalEntities: dimensionalCount(model.entities, ws) };
  return refusalAs(userId, (ctx, access) => updateWorkspaceSettings(ctx, access, { workspaceId: ws, expectedVersion: workspace.version, infocube: on }, state), ws);
}

/** Grants InfoMate the licence in the e2e data file, as `scripts/licence.ts grant` does (test data only). */
export async function grantLicence(organizationId: string = SEED_IDS.orgInfoMate): Promise<void> {
  const { readDb, writeDb } = await import("../../src/data/local/file");
  const db = await readDb(E2E_DB);
  const at = new Date().toISOString();
  db.organization_licence.push({ id: uuidv7(), version: 1, created_at: at, created_by: SEED_IDS.userLukasz, updated_at: at, updated_by: SEED_IDS.userLukasz, deleted_at: null, organization_id: organizationId, module: "infocube" });
  await writeDb(E2E_DB, db);
}

/** Deletes an entity from the model through its panel and the impact dialog (one undo step on the server). */
export async function deleteFromModel(page: Page, name: string): Promise<void> {
  await page.locator(".react-flow__node").filter({ has: page.getByTestId("card-name").getByText(name, { exact: true }) }).getByTestId("card-name").click();
  await page.getByTestId("button-delete-entity").click();
  const dialog = page.getByTestId("dialog-delete-entity");
  await page.getByTestId("table-entity-impact").waitFor();
  await dialog.getByTestId("button-confirm-delete-entity").click();
  await dialog.waitFor({ state: "hidden" });
}
