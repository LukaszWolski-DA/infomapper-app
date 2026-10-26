// Slice 7c's e2e helpers: a source column's or table's panel opened on "Customer & orders", the Classifications
// section's toggles and the classification list's dialog on the page, classifications read back from the e2e data file
// (by code or name), and Data Vault 2.0 mode switched as test data.

import { expect, type Page } from "@playwright/test";
import { buildWriteSet } from "../../src/domain/changes";
import { uuidv7 } from "../../src/domain/ids";
import { indexOf } from "../../src/domain/model/classifications";
import { canvasUrl, expectToast, loadModel, openCanvas, RETAIL, SEED_IDS, signInAs, store } from "../slice-07a/helpers";

export { asPerson } from "../slice-04a/helpers";
export { undo } from "../slice-03a/helpers";
export { archive, importNow, openWizard, reviewFile, reviewRow, sample } from "../slice-07a/helpers";
export { importAs } from "../slice-07b/helpers";
export { callActionDirectly, captureActionId } from "../slice-00/helpers";
export { canvasUrl, expectToast, loadModel, RETAIL, SEED_IDS, signInAs, store };

type User = Parameters<typeof signInAs>[1];

/** A table's id by name, and a column's by its table and name (Retail Co – DWH). */
export async function tableId(table: string): Promise<string> {
  return (await loadModel()).sourceTables.find((t) => t.name === table)!.id;
}
export async function columnId(table: string, column: string): Promise<string> {
  const m = await loadModel();
  const t = m.sourceTables.find((x) => x.name === table)!;
  return m.sourceColumns.find((c) => c.source_table_id === t.id && c.name === column)!.id;
}

/** Signs in and opens a column's panel on "Customer & orders" (the `?row=` arrival, slice 7b). */
export async function openColumn(page: Page, table: string, column: string, user: User = "Łukasz") {
  await signInAs(page, user);
  await openCanvas(page, `${canvasUrl()}?row=${await columnId(table, column)}`);
  await expect(page.getByTestId("panel-source-column").locator("h2")).toHaveText(column);
}

/** Signs in and opens a table's panel, through one of its columns' panels. */
export async function openTable(page: Page, table: string, column: string, user: User = "Łukasz") {
  await openColumn(page, table, column, user);
  await page.getByTestId("panel-source-column").getByRole("button", { name: table, exact: true }).click();
  await expect(page.getByTestId("panel-source-table").locator("h2")).toHaveText(table);
}

const exact = (name: string) => new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}$`);

/** A classification's toggle in the open panel's Classifications section. */
export const toggle = (page: Page, name: string) => page.getByTestId("section-classifications").getByTestId("toggle-classification").filter({ hasText: exact(name) });

/** The group labels the open panel's section shows. */
export const groups = (page: Page) => page.getByTestId("section-classifications").getByTestId("classification-group").locator("> div:first-child");

/** Opens the classification list from the open panel. */
export async function openList(page: Page) {
  await page.getByTestId("button-edit-classifications").click();
  await expect(page.getByTestId("dialog-classifications")).toBeVisible();
}

/** A row of the list by its current name (read-only rows show the name as text, editable ones in an input). */
export const listRow = (page: Page, name: string) =>
  page
    .getByTestId("dialog-classifications")
    .getByTestId("classification-row")
    .filter({ has: page.locator(`input[value="${name}"], [data-testid="classification-name"]:text-is("${name}")`) });

/** The codes (or names, for own ones) of an object's classifications in the e2e data file. */
export async function classesOf(objectId: string): Promise<string[]> {
  const m = await loadModel();
  return indexOf(m)
    .of(objectId)
    .map((c) => c.code ?? c.name);
}

/** A classification of Retail Co – DWH by code (removed ones too). */
export async function classification(code: string) {
  return (await loadModel()).classifications.find((c) => c.code === code)!;
}

/** Data Vault 2.0 mode on or off, as test data. */
export async function setDataVault(on: boolean): Promise<void> {
  const s = store();
  const workspace = (await s.workspaces.get(RETAIL))!;
  const ctx = { actorId: SEED_IDS.userLukasz, now: new Date().toISOString(), newId: () => uuidv7() };
  const row = { ...workspace, dv2_mode: on, version: workspace.version + 1, updated_at: ctx.now, updated_by: ctx.actorId };
  const applied = await s.apply(buildWriteSet(ctx, RETAIL, [{ kind: "update", table: "workspace", before: workspace, row }]));
  if (!applied.ok) throw new Error(applied.error.message);
}

/** Waits for a toggle to show the stored state (after a write the page refreshes). */
export async function expectPressed(page: Page, name: string, pressed: boolean) {
  await expect(toggle(page, name)).toHaveAttribute("aria-pressed", String(pressed));
}

export { expectToast as toast };
