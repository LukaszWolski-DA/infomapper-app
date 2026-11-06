// Slice 15d's helpers: the requirement panel's gaps, the lens's rows, the lit dimensional lines under Focus, the bus
// matrix and "Fed from concepts". Everything earlier comes from slice 15c's helpers.

import type { Locator } from "@playwright/test";
import type { Page } from "./fixtures";

export * from "../slice-15c/helpers";
export { approvedMapping } from "../slice-04b1/helpers";
export { ids } from "../slice-01b/helpers";

/** The requirement panel's gaps: "{label} {reason}", sorted. */
export const gapsOf = async (page: Page): Promise<string[]> =>
  (await page.getByTestId("item-req-gap").evaluateAll((els) => els.map((e) => `${(e as HTMLElement).innerText.split("\n")[0]} ${(e as HTMLElement).dataset.why}`))).sort();

/** The rows the lens colours, by colour (their attribute ids, sorted). */
export const lensRows = async (page: Page, colour: "covered" | "gap"): Promise<string[]> =>
  (await page.getByTestId(`coverage-row-${colour}`).evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.row ?? ""))).sort();

/** The dimensional lines lit under Focus (their mapping ids, each once, sorted). */
export const litModules = async (page: Page): Promise<string[]> =>
  [...new Set(await page.getByTestId("lit-module").evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.ext ?? "")))].sort();

/** Opens the bus matrix from the Cube tab. */
export async function openBusMatrix(page: Page): Promise<Locator> {
  if ((await page.getByTestId("tab-cube").getAttribute("aria-selected")) !== "true") await page.getByTestId("tab-cube").click();
  await page.getByTestId("button-bus-matrix").click();
  const dialog = page.getByTestId("dialog-bus-matrix");
  await dialog.waitFor();
  return dialog;
}

/** A fact's row of the bus matrix. */
export const busFact = (dialog: Locator, entityId: string) => dialog.locator(`[data-testid="bus-fact"][data-entity-id="${entityId}"]`);

/** A cell's dots: their titles and keys, in order. */
export const busDots = (dialog: Locator, factId: string, dimensionId: string) =>
  busFact(dialog, factId)
    .locator(`[data-testid="bus-cell"][data-dimension-id="${dimensionId}"] [data-testid="bus-dot"]`)
    .evaluateAll((els) => els.map((e) => ({ title: (e as HTMLElement).title, key: (e as HTMLElement).dataset.key, text: e.textContent })));

/** "Fed from concepts"' rows: "{concept} {n attributes}" and each row's title. */
export const conceptRows = (page: Page) =>
  page
    .getByTestId("item-cube-fed-from-concept")
    .evaluateAll((els) => els.map((e) => ({ text: (e as HTMLElement).innerText.replace(/\s+/g, " ").trim(), title: (e as HTMLElement).title })));
