// Slice 10a's steps: slice 9's (toasts, change groups, the panels' fields) and the line and row menus of the canvas.
// Saves are started without waiting for the page: the point of step 2 is that the second write does not need to.

import { expect, type Locator, type Page } from "@playwright/test";
import { pointOnLine } from "../slice-01b/helpers";

export * from "../slice-09/helpers";
export { canvasCommits } from "../slice-03b/helpers";

/** A mapping's line on the canvas. */
export const mappingLine = (page: Page, mappingId: string): Locator =>
  page.getByTestId("layer-lines").locator(`[data-testid="line-mapping"][data-mapping="${mappingId}"]`);

/** A relationship's line on the canvas. */
export const relationshipLine = (page: Page, relationshipId: string): Locator =>
  page.getByTestId("layer-lines").locator(`[data-testid="line-relationship"][data-relationship="${relationshipId}"]`);

/** Right-clicks a line and picks an item of its menu (`at` as in `pointOnLine`). */
export async function lineMenu(page: Page, line: Locator, item: string, at = 0.5): Promise<void> {
  const p = await pointOnLine(line, at);
  await page.mouse.click(p.x, p.y, { button: "right" });
  await toolboxItem(page, item).click();
}

/** An item of the open toolbox by its label, without its shortcut or check mark. */
export const toolboxItem = (page: Page, item: string): Locator =>
  page
    .getByTestId("menu-toolbox")
    .getByTestId("toolbox-item")
    .filter({ has: page.locator("span.min-w-0").getByText(item, { exact: true }) });

/** Right-clicks an element (a row, a card's header) and picks an item of its menu. */
export async function menuOn(page: Page, target: Locator, item: string): Promise<void> {
  const b = (await target.boundingBox())!;
  await page.mouse.click(b.x + Math.min(30, b.width / 2), b.y + b.height / 2, { button: "right" });
  await toolboxItem(page, item).click();
}

/** The canvas commit counter (development) once it has not moved for half a second. */
export async function settledCommits(page: Page, read: (page: Page) => Promise<number>): Promise<number> {
  let last = -1;
  for (;;) {
    const now = await read(page);
    if (now === last) return now;
    last = now;
    await page.waitForTimeout(500);
  }
}

export { expect };
