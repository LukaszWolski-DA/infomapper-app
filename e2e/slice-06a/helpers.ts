// Slice 6a's e2e helpers: the view-state bar's chips (`chip-<id>`, their × `chip-<id>-off`, “+{n}” `chip-more`), test
// data that turns on what the chips show (a row filter, a collapsed card), and the breadcrumbs row.

import { updateCanvasItem } from "../../src/domain/commands/canvas-item";
import { expect, type Page } from "./fixtures";
import { asLukasz, item } from "../slice-05a/helpers";

export { counters } from "../slice-04p/helpers";

export * from "../slice-05a/helpers";

export const viewBar = (page: Page) => page.getByTestId("bar-view-state");
export const chip = (page: Page, id: string) => page.getByTestId(`chip-${id}`);
export const chipOff = (page: Page, id: string) => page.getByTestId(`chip-${id}-off`);
export const breadcrumbsRow = (page: Page) => page.getByTestId("nav-breadcrumbs");

/** The chips shown in the row, in order, as their texts (without the ×); “+{n}” as itself. */
export const chipTexts = (page: Page) =>
  viewBar(page)
    .locator(':scope > [data-testid^="chip-"]')
    .evaluateAll((els) => els.map((e) => (e.textContent ?? "").replace(/×$/, "").trim()));

/** Waits for the row to show exactly these chips. */
export const expectChips = (page: Page, texts: string[]) => expect.poll(() => chipTexts(page)).toEqual(texts);

/** Test data: a card of Customer & orders with a row filter or collapsed, saved through the domain as Łukasz. */
export async function setCard(name: string, view: { rowFilter?: "all" | "mapped" | "unmapped" | "keys" | "labeled"; collapsed?: boolean }, canvasId?: string): Promise<void> {
  const i = await item(name, canvasId);
  await asLukasz((ctx, access) => updateCanvasItem(ctx, access, { item: i }, { canvasItemId: i.id, expectedVersion: i.version, ...view }));
}
