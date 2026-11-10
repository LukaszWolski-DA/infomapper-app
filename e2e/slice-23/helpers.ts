// Slice 23's helpers: the workspace home's Metadata conventions tab (its rows by code or name, the Add row, the removal's
// dialog, the naming conventions), the e2e data file's classifications and workspaces, and slice 7c's panels.

import { expect, type Locator, type Page } from "@playwright/test";
import { readDb } from "../../src/data/local/file";
import { E2E_DB } from "../config";
import { hydrated } from "../slice-09/helpers";
import { listRow, loadModel, RETAIL, signInAs } from "../slice-07c/helpers";

export * from "../slice-07c/helpers";
export { undoButton, redoButton } from "../slice-12a/helpers";
export { hydrated, recordToasts } from "../slice-09/helpers";
export { createFromSwitcher } from "../slice-00/helpers";

type User = Parameters<typeof signInAs>[1];

export const conventionsUrl = (ws: string = RETAIL) => `/w/${ws}?tab=conventions`;
export const settingsTabUrl = (ws: string = RETAIL) => `/w/${ws}?tab=settings`;

/** Signs in and opens the tab of Retail Co – DWH (or another workspace). */
export async function openConventions(page: Page, user: User = "Łukasz", ws: string = RETAIL) {
  await signInAs(page, user);
  await page.goto(conventionsUrl(ws));
  await hydrated(page);
  await expect(page.getByTestId("classification-row").first()).toBeVisible();
}

/** A row of the tab by its classification's code (built-in or own). */
export const rowOf = (page: Page, code: string): Locator => page.locator(`[data-testid="classification-row"][data-code="${code}"]`);
/** A row of the tab by its current name. */
export const rowNamed = listRow;

export const nameInput = (row: Locator) => row.getByTestId("input-classification-name");
export const definitionInput = (row: Locator) => row.getByTestId("input-classification-definition");

/** Types a value into a field and leaves it (blur), as a person does. */
export async function typeAndLeave(field: Locator, text: string) {
  await field.fill(text);
  await field.blur();
}

/** Adds an own classification through the tab's Add row. */
export async function addOwn(page: Page, scope: "column" | "table", name: string, code = "") {
  await page.getByTestId(`input-new-${scope}-classification`).fill(name);
  await page.getByTestId(`input-new-${scope}-code`).fill(code);
  await page.getByTestId(`button-add-${scope}-classification`).click();
}

/** A classification of Retail Co – DWH in the e2e data file, by code or by name (removed ones too). */
export async function stored(by: { code?: string; name?: string }) {
  return (await loadModel()).classifications.find((c) => (by.code ? c.code === by.code : c.name === by.name));
}

/** A workspace's row in the e2e data file, by name. */
export async function workspaceNamed(name: string) {
  return (await readDb(E2E_DB)).workspace.find((w) => w.name === name);
}

/** A workspace's built-in classification by code, in the e2e data file. */
export async function builtinOfWorkspace(workspaceId: string, code: string) {
  return (await readDb(E2E_DB)).classification.find((c) => c.workspace_id === workspaceId && c.code === code);
}
