// Slice 4a's steps on top of slice 3b's: the demo requirements and their links from the e2e data file, requirement
// test data written through the domain, the left panel's Requirements tab, a requirement's panel, and four-eyes as
// test data.

import { buildWriteSet, type CommandContext, type CommandResult } from "../../src/domain/changes";
import { uuidv7 } from "../../src/domain/ids";
import type { WorkspaceAccess } from "../../src/domain/permissions";
import type { Requirement } from "../../src/domain/types";
import { expect, type Page } from "./fixtures";
import { RETAIL, SEED_IDS, store } from "../slice-03b/helpers";

export * from "../slice-03b/helpers";

/** The live requirements and links in the e2e data file. */
export const loadRequirements = () => store().requirements.list(RETAIL);
export const loadRequirementLinks = () => store().requirements.listLinks(RETAIL);
export const requirementByKey = async (key: string): Promise<Requirement> => (await loadRequirements()).find((r) => r.key === key)!;
/** The live links of a requirement, as target ids (whichever column is set). */
export async function tracesOf(key: string): Promise<string[]> {
  const r = await requirementByKey(key);
  return (await loadRequirementLinks())
    .filter((k) => k.requirement_id === r.id)
    .map((k) => k.entity_id ?? k.attribute_id ?? k.mapping_id ?? k.source_table_id ?? k.source_column_id!)
    .sort();
}

/** Test data written through the domain as a given person; the command reads the requirements as stored now. */
export async function asPerson<T>(userId: string, command: (ctx: CommandContext, access: WorkspaceAccess) => CommandResult<T>): Promise<T> {
  const s = store();
  const workspace = (await s.workspaces.get(RETAIL))!;
  const access = { workspace, member: await s.workspaces.getMember(RETAIL, userId) };
  const ctx = { actorId: userId, now: new Date().toISOString(), newId: () => uuidv7() };
  const result = command(ctx, access);
  if (!result.ok) throw new Error(result.error.message);
  const applied = await s.apply(result.writeSet);
  if (!applied.ok) throw new Error(applied.error.message);
  return result.value;
}

/** Test data: four-eyes on or off for “Retail Co – DWH” (the settings dialog is slice 0's; here as the server writes it). */
export async function setFourEyes(on: boolean): Promise<void> {
  const s = store();
  const workspace = (await s.workspaces.get(RETAIL))!;
  const ctx = { actorId: SEED_IDS.userLukasz, now: new Date().toISOString(), newId: () => uuidv7() };
  const row = { ...workspace, four_eyes: on, version: workspace.version + 1, updated_at: ctx.now, updated_by: ctx.actorId };
  const applied = await s.apply(buildWriteSet(ctx, RETAIL, [{ kind: "update", table: "workspace", before: workspace, row }]));
  if (!applied.ok) throw new Error(applied.error.message);
}

/** Opens the left panel's Requirements tab. */
export async function openRequirementsTab(page: Page): Promise<void> {
  await page.getByTestId("tab-requirements").click();
  await expect(page.getByTestId("tab-requirements")).toHaveAttribute("aria-selected", "true");
}

/** A requirement's row in the Requirements tab. */
export const requirementRow = (page: Page, key: string) => page.locator(`[data-testid="tree-req"][data-key="${key}"]`);

/** Opens a requirement's panel from the Requirements tab. */
export async function openRequirement(page: Page, key: string): Promise<void> {
  if ((await page.getByTestId("tab-requirements").getAttribute("aria-selected")) !== "true") await openRequirementsTab(page);
  await requirementRow(page, key).click();
  await expect(page.getByTestId("input-req-key")).toHaveValue(key);
}

/** Waits until the requirement panel shows this version (a fresh page after a write; the next edit needs it). */
export async function expectPanelVersion(page: Page, key: string): Promise<void> {
  const r = await requirementByKey(key);
  await expect(page.getByTestId("panel-requirement")).toHaveAttribute("data-version", String(r.version));
}

/** The rows of the Requirements section of the open element panel: `REQ-101` or `REQ-101 via attribute`. */
export const sectionRows = (page: Page) =>
  page.getByTestId("item-requirement").evaluateAll((els) => els.map((e) => `${(e as HTMLElement).dataset.key}${(e as HTMLElement).dataset.via ? ` ${(e as HTMLElement).dataset.via}` : ""}`));

/** Opens an entity's panel from the Model tab (its card on this canvas, or a new card in a free spot). */
export async function openEntityFromTree(page: Page, name: string): Promise<void> {
  await page.getByTestId("tab-model").click();
  await page.getByTestId("tree-item").filter({ has: page.getByText(name, { exact: true }) }).click();
  await expect(page.getByTestId("panel-entity")).toBeVisible();
}
