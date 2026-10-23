// Slice 7a's e2e helpers: the import wizard on “Customer & orders”, its files (src/domain/import/samples/, read from
// disk: P10, the app has none), and the data the import writes, read back from the e2e data file.

import fs from "node:fs";
import path from "node:path";
import { expect, type Page } from "@playwright/test";
import { createLocalDataStore } from "../../src/data/local/store";
import { buildWriteSet } from "../../src/domain/changes";
import { uuidv7 } from "../../src/domain/ids";
import { E2E_DB } from "../config";
import { canvasUrl, expectToast, loadModel, openCanvas, RETAIL, SEED_IDS, signInAs } from "../slice-01a/helpers";

export { asPerson, setFourEyes } from "../slice-04a/helpers";
export { canvasUrl, expectToast, loadModel, openCanvas, RETAIL, SEED_IDS, signInAs };

export const store = () => createLocalDataStore(E2E_DB);

/** A test file's text (src/domain/import/samples/). */
export const sample = (name: string) => fs.readFileSync(path.resolve("src", "domain", "import", "samples", name), "utf8");

/** Signs in, opens “Customer & orders”, the Sources tab and the wizard. */
export async function openWizard(page: Page, user: Parameters<typeof signInAs>[1] = "Łukasz") {
  await signInAs(page, user);
  await openCanvas(page, canvasUrl());
  await page.getByTestId("tab-sources").click();
  await page.getByTestId("button-import-sources").click();
  const dialog = page.getByTestId("dialog-import");
  await expect(dialog).toBeVisible();
  return dialog;
}

/** Hands a file to a drop zone's input (`import-file`, `query-file`, `ddl-file`). */
export async function giveFile(page: Page, input: "import-file" | "query-file" | "ddl-file", name: string, text: string) {
  await page.getByTestId(`input-${input}`).setInputFiles({ name, mimeType: "text/plain", buffer: Buffer.from(text, "utf8") });
}

/** Picks the target: an existing system by name, or a new one. */
export async function target(page: Page, system: { existing: string } | { new: string }) {
  // the two targets are a segmented control: their radios are visually hidden, their labels are clicked
  if ("existing" in system) {
    await page.getByText("An existing system", { exact: true }).click();
    await page.getByTestId("system-choice").filter({ hasText: system.existing }).getByTestId("radio-system").check();
  } else {
    await page.getByText("A new system", { exact: true }).click();
    await page.getByTestId("input-new-system-name").fill(system.new);
  }
}

export const next = (page: Page) => page.getByTestId("button-wizard-next").click();

/** Step 1 with a file in the standard, then on to the review (all tables, the default scope). */
export async function reviewFile(page: Page, system: { existing: string } | { new: string }, name: string, text: string) {
  await target(page, system);
  await giveFile(page, "import-file", name, text);
  await expect(page.getByTestId("import-loaded")).toBeVisible();
  await next(page);
  await next(page);
  await expect(page.getByTestId("wizard-step-3")).toHaveAttribute("aria-current", "step");
}

/** “Import into …”, then the toast. */
export async function importNow(page: Page, toast: string | RegExp) {
  await page.getByTestId("button-wizard-import").click();
  await expectToast(page, toast, 15_000);
  await expect(page.getByTestId("dialog-import")).toHaveCount(0);
}

/** A filter's count in the review. */
export const filterCount = async (page: Page, filter: string) => Number((await page.getByTestId(`filter-${filter}`).locator("b").textContent())!.replace(/,/g, ""));

/** The review's row of a column (by its name in the file, or its old name when missing). */
export const reviewRow = (page: Page, column: string) => page.getByTestId("review-row").filter({ has: page.locator(`text="${column}"`) }).first();

export async function systemNamed(name: string) {
  return (await loadModel()).sourceSystems.find((s) => s.name === name) ?? null;
}

export async function imports(systemId?: string) {
  return store().model.listImports(RETAIL, systemId);
}

/** Test data: “Retail Co – DWH” archived (as the settings write it). */
export async function archive(): Promise<void> {
  const s = store();
  const workspace = (await s.workspaces.get(RETAIL))!;
  const ctx = { actorId: SEED_IDS.userLukasz, now: new Date().toISOString(), newId: () => uuidv7() };
  const row = { ...workspace, archived_at: ctx.now, archived_by: ctx.actorId, version: workspace.version + 1, updated_at: ctx.now, updated_by: ctx.actorId };
  const applied = await s.apply(buildWriteSet(ctx, RETAIL, [{ kind: "update", table: "workspace", before: workspace, row }]));
  if (!applied.ok) throw new Error(applied.error.message);
}

/** The demo CRM as the SQL Server query gives it, with customers.segment and customer_addresses left out. */
export const crmPartial = () =>
  sample("crm_sqlserver_catalog.tsv")
    .split(/\r?\n/)
    .filter((line) => !/\tsegment\t/.test(line) && !/\tcustomer_addresses\t/.test(line))
    .join("\r\n");
